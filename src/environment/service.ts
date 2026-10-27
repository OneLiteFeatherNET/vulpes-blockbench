import {
  type EnvironmentProfile,
  type EnvironmentSnapshot,
  type ProfileId,
  requiresConfirmation,
} from './profiles';
import { requireBaseUrl, type ConfiguredProfile, type UrlValidation, validateBaseUrl } from './validation';
import { loadSnapshot, saveSnapshot, type EnvironmentStorage } from './storage';

export type SwitchResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'confirmation-required' };

export interface EnvironmentService {
  snapshot(): EnvironmentSnapshot;
  activeProfile(): EnvironmentProfile;
  configuredActiveProfile(): ConfiguredProfile;
  /** Validates and stores a base URL. An invalid value changes nothing. */
  setBaseUrl(profile: ProfileId, raw: string): UrlValidation;
  /** Switches the active environment. A switch to `prod` needs `confirmed`. */
  switchTo(to: ProfileId, confirmed: boolean): SwitchResult;
}

/** Creates a service with its own state. Each caller passes its own storage. */
export function createEnvironmentService(storage: EnvironmentStorage): EnvironmentService {
  let current: EnvironmentSnapshot = loadSnapshot(storage);

  const commit = (next: EnvironmentSnapshot): void => {
    current = next;
    saveSnapshot(storage, next);
  };

  const profileOf = (snapshot: EnvironmentSnapshot): EnvironmentProfile => ({
    id: snapshot.active,
    baseUrl: snapshot.baseUrls[snapshot.active],
  });

  return {
    snapshot: () => current,
    activeProfile: () => profileOf(current),
    configuredActiveProfile: () => requireBaseUrl(profileOf(current)),
    setBaseUrl(profile, raw) {
      const result = validateBaseUrl(raw, profile);
      if (result.ok) {
        commit({
          ...current,
          baseUrls: { ...current.baseUrls, [profile]: result.value },
        });
      }
      return result;
    },
    switchTo(to, confirmed) {
      if (requiresConfirmation(current.active, to) && !confirmed) {
        return { ok: false, reason: 'confirmation-required' };
      }
      commit({ ...current, active: to });
      return { ok: true };
    },
  };
}
