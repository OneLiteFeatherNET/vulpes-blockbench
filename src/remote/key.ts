export type KeyCheck = { readonly ok: true; readonly key: string } | { readonly ok: false; readonly reason: 'empty' };

/**
 * Trims the key the designer typed. Only emptiness is checked here: the grammar of a
 * key (`namespace:path`) is owned by the backend, which answers with its own message.
 */
export function normalizeKey(raw: string): KeyCheck {
  const key = raw.trim();
  return key === '' ? { ok: false, reason: 'empty' } : { ok: true, key };
}
