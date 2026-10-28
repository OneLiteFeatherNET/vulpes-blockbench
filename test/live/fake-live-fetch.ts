// A recording fake for the registry's fetch. The registry sends DELETE, so its requests are
// `LiveHttpRequest`s and the shared `fakeFetch` of test/support, typed for `HttpRequest`, does not fit.

import type { HttpResponse } from '../../src/api/http';
import type { LiveFetch, LiveHttpRequest } from '../../src/live/registration';

/** A canned reply. Header names are matched case-insensitively. */
export interface CannedReply {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface RecordingFetch {
  readonly fetch: LiveFetch;
  /** Every request that reached the fake, in order. Each test owns its own instance. */
  readonly requests: LiveHttpRequest[];
}

/** A fetch that records each request and answers with what `respond` returns. */
export function recordingFetch(respond: (request: LiveHttpRequest) => CannedReply): RecordingFetch {
  const requests: LiveHttpRequest[] = [];
  const fetch: LiveFetch = (request) => {
    requests.push(request);
    return Promise.resolve(toResponse(respond(request)));
  };
  return { fetch, requests };
}

/** A fetch that never gets a response, as when the backend is down or blocked by CORS. */
export function rejectingFetch(message: string): LiveFetch {
  return () => Promise.reject(new TypeError(message));
}

function toResponse(canned: CannedReply): HttpResponse {
  const headers = new Map<string, string>();
  for (const [name, value] of Object.entries(canned.headers ?? {})) {
    headers.set(name.toLowerCase(), value);
  }
  return {
    status: canned.status,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    text: () => Promise.resolve(canned.body ?? ''),
  };
}
