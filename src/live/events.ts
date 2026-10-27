// Parses the payloads of the live-editing event stream and the raw SSE text that carries
// them. Payloads are untrusted: every field is checked, and a payload that does not fit
// yields undefined instead of an exception.

import { parseEntityTag } from '../api/http';
import { isRecord, parseJsonText } from '../json';

/** A save of the asset. `etag` is the strong ETag of the new content, as it is sent in `If-Match`. */
export interface SavedEvent {
  readonly etag: string;
  readonly sha1: string;
  readonly revision: number;
}

export type SessionState = 'started' | 'ended';

/** The live session of the asset. `host` is the signaling host the session uses. */
export interface SessionEvent {
  readonly state: SessionState;
  readonly token: string;
  readonly host: string;
}

export type LiveEvent =
  | { readonly kind: 'saved'; readonly saved: SavedEvent }
  | { readonly kind: 'session'; readonly session: SessionEvent };

/** One complete SSE block. `event` is `message` when the block names no event. */
export interface SseBlock {
  readonly event: string;
  readonly data: string;
}

export interface SseParser {
  /** Takes the next chunk of the stream and returns the blocks it completes, in order. */
  push(chunk: string): SseBlock[];
}

export function parseSavedEvent(value: unknown): SavedEvent | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const etag = value['etag'];
  const sha1 = value['sha1'];
  const revision = value['revision'];
  if (typeof etag !== 'string' || parseEntityTag(etag) === undefined) {
    return undefined;
  }
  if (typeof sha1 !== 'string' || sha1 === '' || typeof revision !== 'number' || !Number.isInteger(revision)) {
    return undefined;
  }
  return { etag, sha1, revision };
}

export function parseSessionEvent(value: unknown): SessionEvent | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const state = value['state'];
  const token = value['token'];
  const host = value['host'];
  if (state !== 'started' && state !== 'ended') {
    return undefined;
  }
  if (typeof token !== 'string' || token === '' || typeof host !== 'string' || host === '') {
    return undefined;
  }
  return { state, token, host };
}

/** Turns one SSE block into a typed event. Unknown event names and payloads that do not fit yield undefined. */
export function decodeLiveEvent(block: SseBlock): LiveEvent | undefined {
  const payload = parseJsonText(block.data);
  switch (block.event) {
    case 'saved': {
      const saved = parseSavedEvent(payload);
      return saved === undefined ? undefined : { kind: 'saved', saved };
    }
    case 'session': {
      const session = parseSessionEvent(payload);
      return session === undefined ? undefined : { kind: 'session', session };
    }
    default:
      return undefined;
  }
}

/**
 * A stateful parser for `text/event-stream`. A block is emitted when its blank line arrives,
 * so a block split over two chunks is emitted once. A CR that ends a chunk waits for the
 * next chunk, because it may be the first half of a CRLF.
 */
export function createSseParser(): SseParser {
  let pending = '';
  let eventName: string | undefined;
  let dataLines: string[] = [];

  const handleLine = (line: string, blocks: SseBlock[]): void => {
    if (line === '') {
      if (dataLines.length > 0) {
        blocks.push({ event: eventName === undefined || eventName === '' ? 'message' : eventName, data: dataLines.join('\n') });
      }
      eventName = undefined;
      dataLines = [];
      return;
    }
    if (line.startsWith(':')) {
      return;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    if (field === 'event') {
      eventName = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }
  };

  return {
    push: (chunk: string): SseBlock[] => {
      pending += chunk;
      const blocks: SseBlock[] = [];
      let start = 0;
      let index = 0;
      while (index < pending.length) {
        const char = pending.charAt(index);
        if (char !== '\n' && char !== '\r') {
          index += 1;
          continue;
        }
        if (char === '\r' && index + 1 === pending.length) {
          break;
        }
        handleLine(pending.slice(start, index), blocks);
        index += char === '\r' && pending.charAt(index + 1) === '\n' ? 2 : 1;
        start = index;
      }
      pending = pending.slice(start);
      return blocks;
    },
  };
}
