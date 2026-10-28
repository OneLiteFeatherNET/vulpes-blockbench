import { describe, expect, it } from 'vitest';
import { openEventStream, type EventsFetch, type EventStreamOptions, type StreamTimers } from '../../src/live/event-stream';
import type { LiveEvent } from '../../src/live/events';

const URL = 'https://vulpes.example/project/p1/asset/a1/events';
const SAVED_BLOCK = 'event: saved\ndata: {"etag":"\\"0a1b2c\\"","sha1":"0a1b2c","revision":3}\n\n';

/** One request the fake fetch received. The test decides how it is answered. */
interface Connection {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  /** Answers with a response of this status. Returns the body the test writes to and ends. */
  answer(status?: number, text?: string): FakeBody;
  /** Fails the request as a network error does. */
  fail(): void;
}

interface FakeBody {
  write(text: string): void;
  end(): void;
}

interface Harness {
  readonly fetch: EventsFetch;
  readonly timers: StreamTimers<number>;
  readonly connections: Connection[];
  /** The delays of the timers that are still pending, in the order they were set. */
  pendingDelays(): number[];
  /** Runs the oldest pending timer. */
  fireNextTimer(): void;
}

/** Each test builds its own harness, so no state is shared between tests. */
function harness(): Harness {
  const connections: Connection[] = [];
  const scheduled = new Map<number, { handler: () => void; ms: number }>();
  let nextId = 1;

  const fetch: EventsFetch = (url, init) =>
    new Promise((resolve, reject) => {
      const encoder = new TextEncoder();
      const connection: Connection = {
        url,
        headers: init.headers,
        answer: (status = 200, text = '') => {
          let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
          const body = new ReadableStream<Uint8Array>({
            start: (created) => {
              controller = created;
            },
          });
          init.signal.addEventListener('abort', () => controller?.error(new DOMException('aborted', 'AbortError')));
          resolve({
            ok: status >= 200 && status < 300,
            status,
            body,
            text: () => Promise.resolve(text),
          });
          return {
            write: (chunk) => controller?.enqueue(encoder.encode(chunk)),
            end: () => controller?.close(),
          };
        },
        fail: () => { reject(new TypeError('network down')); },
      };
      init.signal.addEventListener('abort', () => { reject(new DOMException('aborted', 'AbortError')); });
      connections.push(connection);
    });

  const timers: StreamTimers<number> = {
    setTimeout: (handler, ms) => {
      const id = nextId;
      nextId += 1;
      scheduled.set(id, { handler, ms });
      return id;
    },
    clearTimeout: (id) => {
      scheduled.delete(id);
    },
  };

  return {
    fetch,
    timers,
    connections,
    pendingDelays: () => [...scheduled.values()].map((timer) => timer.ms),
    fireNextTimer: () => {
      const oldest = scheduled.entries().next();
      if (oldest.done) {
        throw new Error('no timer is pending');
      }
      const [id, timer] = oldest.value;
      scheduled.delete(id);
      timer.handler();
    },
  };
}

/** Lets the chains of promises started by the stream finish. Only microtasks run, so the test stays deterministic. */
async function settle(): Promise<void> {
  for (let index = 0; index < 50; index += 1) {
    await Promise.resolve();
  }
}

function open(h: Harness, overrides: Partial<EventStreamOptions<number>> = {}): { close(): void; events: LiveEvent[]; unsupported: () => number } {
  const events: LiveEvent[] = [];
  let unsupportedCalls = 0;
  const stream = openEventStream<number>({
    url: URL,
    fetch: h.fetch,
    timers: h.timers,
    onEvent: (event) => {
      events.push(event);
    },
    onUnsupported: () => {
      unsupportedCalls += 1;
    },
    ...overrides,
  });
  return { close: () => { stream.close(); }, events, unsupported: () => unsupportedCalls };
}

describe('openEventStream', () => {
  it('opens the events url and asks for an event stream', () => {
    const h = harness();
    open(h);
    expect(h.connections[0]?.url, 'the requested url').toBe(URL);
    expect(h.connections[0]?.headers['Accept'], 'the accept header').toBe('text/event-stream');
  });

  it('passes the decoded events of the stream to the listener', async () => {
    const h = harness();
    const stream = open(h);
    h.connections[0]?.answer().write(SAVED_BLOCK);
    await settle();
    expect(stream.events.map((event) => event.kind), 'the kinds of the events').toEqual(['saved']);
  });

  it('reconnects after the stream ends', async () => {
    const h = harness();
    open(h);
    h.connections[0]?.answer().end();
    await settle();
    h.fireNextTimer();
    expect(h.connections.length, 'the requests after the timer fired').toBe(2);
  });

  it('schedules the first reconnect one second after the stream ends', async () => {
    const h = harness();
    open(h);
    h.connections[0]?.answer().end();
    await settle();
    expect(h.pendingDelays(), 'the pending delays').toEqual([1_000]);
  });

  it('reconnects after the fetch fails', async () => {
    const h = harness();
    open(h);
    h.connections[0]?.fail();
    await settle();
    h.fireNextTimer();
    expect(h.connections.length, 'the requests after the timer fired').toBe(2);
  });

  it('doubles the delay while the reconnects keep failing', async () => {
    const h = harness();
    open(h);
    h.connections[0]?.fail();
    await settle();
    h.fireNextTimer();
    h.connections[1]?.fail();
    await settle();
    expect(h.pendingDelays(), 'the pending delays').toEqual([2_000]);
  });

  it('returns to one second after a reopened stream delivers data', async () => {
    const h = harness();
    open(h);
    h.connections[0]?.fail();
    await settle();
    h.fireNextTimer();
    const body = h.connections[1]?.answer();
    body?.write(': keep-alive\n\n');
    body?.end();
    await settle();
    expect(h.pendingDelays(), 'the pending delays').toEqual([1_000]);
  });

  it('keeps the doubled delay when the reopened stream ends without data', async () => {
    const h = harness();
    open(h);
    h.connections[0]?.fail();
    await settle();
    h.fireNextTimer();
    h.connections[1]?.answer().end();
    await settle();
    expect(h.pendingDelays(), 'the pending delays').toEqual([2_000]);
  });

  it('reconnects when the events route answers with a server error', async () => {
    const h = harness();
    open(h);
    h.connections[0]?.answer(503, '');
    await settle();
    expect(h.pendingDelays(), 'the pending delays').toEqual([1_000]);
  });

  it('does not reconnect when the backend has no live-session routes', async () => {
    const h = harness();
    const stream = open(h);
    h.connections[0]?.answer(404, JSON.stringify({ status: 404, title: 'Not Found' }));
    await settle();
    expect(h.pendingDelays(), 'the pending delays').toEqual([]);
    expect(stream.unsupported(), 'the unsupported notifications').toBe(1);
  });

  it('does not reconnect after it was closed while the stream was open', async () => {
    const h = harness();
    const stream = open(h);
    h.connections[0]?.answer();
    await settle();
    stream.close();
    await settle();
    expect(h.pendingDelays(), 'the pending delays').toEqual([]);
    expect(h.connections.length, 'the requests').toBe(1);
  });

  it('clears a pending reconnect when it is closed', async () => {
    const h = harness();
    const stream = open(h);
    h.connections[0]?.answer().end();
    await settle();
    stream.close();
    expect(h.pendingDelays(), 'the pending delays').toEqual([]);
  });

  it('does not reconnect when it is closed while the fetch is still pending', async () => {
    const h = harness();
    const stream = open(h);
    stream.close();
    await settle();
    expect(h.pendingDelays(), 'the pending delays').toEqual([]);
  });
});
