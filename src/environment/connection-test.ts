/** The part of `fetch` that the connection test uses. Only the status is read. */
export type FetchLike = (url: string) => Promise<{ readonly status: number }>;

export type ConnectionResult =
  | { readonly kind: 'ok'; readonly status: number }
  | { readonly kind: 'http-error'; readonly status: number }
  | { readonly kind: 'network-error'; readonly message: string };

/**
 * Sends one read to the backend and reports the outcome. A rejected request
 * means no response arrived, which is also how a CORS block shows up.
 */
export async function testConnection(baseUrl: string, fetchFn: FetchLike): Promise<ConnectionResult> {
  const root = baseUrl.replace(/\/+$/u, '');
  try {
    const response = await fetchFn(`${root}/project/?size=1`);
    if (response.status >= 200 && response.status < 300) {
      return { kind: 'ok', status: response.status };
    }
    return { kind: 'http-error', status: response.status };
  } catch (error: unknown) {
    return {
      kind: 'network-error',
      message: error instanceof Error ? error.message : 'unknown network error',
    };
  }
}
