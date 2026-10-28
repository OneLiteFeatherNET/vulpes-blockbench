// Keeps the `events` stream of one asset open. The stream is read with `fetch` and the SSE parser,
// and it is reopened after a backoff when it ends or fails, for any reason other than its own close.
// A backend without the live-session routes ends it for good. The fetch and the timers are injected,
// so the lifecycle is tested with a fake fetch and fake timers.

import { parseJsonText } from '../json';
import { problemFromResponse } from '../problem';
import { isRouteMissing } from './availability';
import { createSseParser, decodeLiveEvent, type LiveEvent } from './events';
import { createReconnectBackoff } from './reconnect-backoff';

/** The part of a response the stream reads. A `Response` of the global fetch fits it. */
export interface EventsResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly body: { getReader(): { read(): Promise<{ readonly done: boolean; readonly value?: unknown }> } } | null;
  text(): Promise<string>;
}

export type EventsFetch = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<EventsResponse>;

export interface StreamTimers<H> {
  setTimeout(handler: () => void, ms: number): H;
  clearTimeout(handle: H): void;
}

export interface EventStreamOptions<H> {
  readonly url: string;
  readonly fetch: EventsFetch;
  readonly timers: StreamTimers<H>;
  readonly onEvent: (event: LiveEvent) => void;
  /** Called once when the backend answers that it has no live-session routes. The stream then stops for good. */
  readonly onUnsupported: () => void;
}

export interface EventStream {
  /** Aborts the open request and clears a pending reconnect. No reconnect follows. */
  close(): void;
}

export function openEventStream<H>(options: EventStreamOptions<H>): EventStream {
  const controller = new AbortController();
  const backoff = createReconnectBackoff();
  let closed = false;
  let retry: H | undefined;
  // `close` runs between the awaits below, so the state is read through a function, which keeps TypeScript from narrowing it.
  const isClosed = (): boolean => closed;

  const scheduleRetry = (): void => {
    retry = options.timers.setTimeout(() => {
      retry = undefined;
      void connect();
    }, backoff.nextDelayMs());
  };

  /** Reads the body until it ends. Each chunk resets the backoff, so a reopened stream that delivers data starts again at one second. */
  const readBody = async (response: EventsResponse): Promise<void> => {
    if (response.body === null) {
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser();
    let next = await reader.read();
    while (!next.done) {
      // The chunk is untrusted: only bytes are decoded, anything else is skipped.
      const bytes: unknown = next.value;
      if (bytes instanceof Uint8Array) {
        backoff.reset();
        for (const block of parser.push(decoder.decode(bytes, { stream: true }))) {
          const event = decodeLiveEvent(block);
          if (event !== undefined) {
            options.onEvent(event);
          }
        }
      }
      next = await reader.read();
    }
  };

  const connect = async (): Promise<void> => {
    // The stream carries no Authorization header, as the open question in design.md assumes. A fetch
    // stream, not EventSource, is used because the SSE parser needs the raw text and the 404 status.
    let response: EventsResponse;
    try {
      response = await options.fetch(options.url, { headers: { Accept: 'text/event-stream' }, signal: controller.signal });
    } catch {
      // The close aborted the request, or the connection failed. Only a failure is retried.
      if (!isClosed()) {
        scheduleRetry();
      }
      return;
    }
    if (isClosed()) {
      return;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (isRouteMissing({ kind: 'problem', problem: problemFromResponse(response.status, parseJsonText(body), undefined) })) {
        closed = true;
        options.onUnsupported();
        return;
      }
      if (!isClosed()) {
        scheduleRetry();
      }
      return;
    }
    try {
      await readBody(response);
    } catch {
      // The close aborted the read, or the connection dropped. Only a drop is retried, below.
    }
    if (!isClosed()) {
      scheduleRetry();
    }
  };

  void connect();

  return {
    close: (): void => {
      closed = true;
      controller.abort();
      if (retry !== undefined) {
        options.timers.clearTimeout(retry);
        retry = undefined;
      }
    },
  };
}
