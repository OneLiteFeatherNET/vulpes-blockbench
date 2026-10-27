import type { FetchLike, HttpRequest, HttpResponse } from '../../src/api/http';

/** A canned response. Header names are matched case-insensitively. */
export interface Canned {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface FakeFetch {
  readonly fetch: FetchLike;
  /** Every request that reached the fake, in order. Each test owns its own instance. */
  readonly requests: HttpRequest[];
}

/** A fetch that records each request and answers with what `respond` returns. */
export function fakeFetch(respond: (request: HttpRequest) => Canned): FakeFetch {
  const requests: HttpRequest[] = [];
  const fetch: FetchLike = (request) => {
    requests.push(request);
    return Promise.resolve(toResponse(respond(request)));
  };
  return { fetch, requests };
}

/** A fetch that never gets a response, as when the backend is down or blocked by CORS. */
export function unreachableFetch(message: string): { fetch: FetchLike; requests: HttpRequest[] } {
  const requests: HttpRequest[] = [];
  const fetch: FetchLike = (request) => {
    requests.push(request);
    return Promise.reject(new TypeError(message));
  };
  return { fetch, requests };
}

function toResponse(canned: Canned): HttpResponse {
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

/** Reads a header of a recorded request, or undefined when it is absent. */
export function headerOf(request: HttpRequest, name: string): string | undefined {
  const match = Object.entries(request.headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1];
}
