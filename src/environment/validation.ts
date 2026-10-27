import type { EnvironmentProfile, ProfileId } from './profiles';

export type UrlRejection =
  | 'unparseable'
  | 'protocol'
  | 'query-or-fragment'
  | 'prod-requires-https';

export type UrlValidation =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: UrlRejection };

export type ConfiguredProfile =
  | { readonly ok: true; readonly baseUrl: string }
  | { readonly ok: false; readonly reason: 'not-configured' };

const LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1'];

/**
 * Validates a base URL typed by the designer. An empty value is returned as an
 * empty string; `requireBaseUrl` reports it as not configured.
 */
export function validateBaseUrl(raw: string, profile: ProfileId): UrlValidation {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { ok: true, value: '' };
  }
  const withoutSlash = trimmed.replace(/\/+$/u, '');

  let url: URL;
  try {
    url = new URL(withoutSlash);
  } catch {
    return { ok: false, reason: 'unparseable' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'protocol' };
  }
  if (url.search !== '' || url.hash !== '') {
    return { ok: false, reason: 'query-or-fragment' };
  }
  if (profile === 'prod' && url.protocol === 'http:' && !LOCAL_HOSTS.includes(url.hostname)) {
    return { ok: false, reason: 'prod-requires-https' };
  }
  return { ok: true, value: withoutSlash };
}

/** Returns the base URL of a profile, or `not-configured` when it is empty. */
export function requireBaseUrl(profile: EnvironmentProfile): ConfiguredProfile {
  if (profile.baseUrl === '') {
    return { ok: false, reason: 'not-configured' };
  }
  return { ok: true, baseUrl: profile.baseUrl };
}
