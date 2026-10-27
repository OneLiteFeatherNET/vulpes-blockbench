import {
  DEFAULT_DEV_BASE_URL,
  DEFAULT_PROD_BASE_URL,
  defaultSnapshot,
  isProfileId,
  type EnvironmentSnapshot,
  type ProfileId,
} from './profiles';
import { validateBaseUrl } from './validation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Turns stored data, which is untrusted, into a snapshot. Every field that is
 * missing or invalid falls back to its default.
 */
export function parseSnapshot(raw: unknown): EnvironmentSnapshot {
  const defaults = defaultSnapshot();
  if (!isRecord(raw)) {
    return defaults;
  }
  const active = isProfileId(raw['active']) ? raw['active'] : defaults.active;
  const stored = isRecord(raw['baseUrls']) ? raw['baseUrls'] : {};
  return {
    active,
    baseUrls: {
      dev: storedUrl(stored['dev'], 'dev', DEFAULT_DEV_BASE_URL),
      prod: storedUrl(stored['prod'], 'prod', DEFAULT_PROD_BASE_URL),
    },
  };
}

function storedUrl(value: unknown, profile: ProfileId, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const result = validateBaseUrl(value, profile);
  return result.ok ? result.value : fallback;
}
