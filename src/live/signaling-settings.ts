// Chooses the signaling host of an environment from the raw setting values. The host
// decides where live editing connects. An empty result disables live editing for the
// environment. Only a missing or non-text value falls back to the default: an explicit
// empty or rejected value disables live editing.

import type { ProfileId } from '../environment/profiles';
import { validateSignalingHost } from './signaling-host';

export const DEFAULT_DEV_SIGNALING_HOST = 'localhost';
export const DEFAULT_PROD_SIGNALING_HOST = '';

function defaultHost(profile: ProfileId): string {
  return profile === 'dev' ? DEFAULT_DEV_SIGNALING_HOST : DEFAULT_PROD_SIGNALING_HOST;
}

/** The signaling host for a profile, given the raw stored value. An empty string means disabled. */
export function signalingHostFor(profile: ProfileId, raw: unknown): string {
  if (typeof raw !== 'string') {
    return defaultHost(profile);
  }
  const checked = validateSignalingHost(raw);
  return checked.ok && checked.host !== undefined ? checked.host : '';
}

/**
 * Reads the stored value through `read`. A reader that throws, for example while the
 * settings are not ready, yields the default of the profile.
 */
export function readSignalingHost(profile: ProfileId, read: () => unknown): string {
  let raw: unknown;
  try {
    raw = read();
  } catch {
    return defaultHost(profile);
  }
  return signalingHostFor(profile, raw);
}
