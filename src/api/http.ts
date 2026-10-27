// The HTTP shapes the Vulpes client uses. They are declared here, not taken from the
// DOM library, which the project keeps out of its type environment. The Blockbench
// glue adapts the renderer's `fetch` and `FormData` to these shapes.

/** One file part of a multipart request. The content is text, because the models are JSON. */
export interface MultipartFile {
  readonly name: string;
  readonly contentType: string;
  readonly text: string;
}

export interface MultipartBody {
  /** Text fields, such as `key`. */
  readonly fields: Readonly<Record<string, string>>;
  readonly file: MultipartFile;
}

export interface HttpRequest {
  readonly method: 'GET' | 'POST';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: MultipartBody;
}

export interface HttpHeaderReader {
  get(name: string): string | null;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: HttpHeaderReader;
  text(): Promise<string>;
}

/** Sends one request. It rejects when no response arrives, for example when the backend is down or blocked by CORS. */
export type FetchLike = (request: HttpRequest) => Promise<HttpResponse>;

// A strong ETag as the backend sends it: the SHA-1 in double quotes. Weak values
// (W/"...") are refused, because the backend compares If-Match exactly.
const STRONG_ETAG = /^"[^"]+"$/u;

/** Returns the ETag header value exactly as received, or undefined when it is missing or not a strong ETag. */
export function parseEntityTag(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return STRONG_ETAG.test(value) ? value : undefined;
}
