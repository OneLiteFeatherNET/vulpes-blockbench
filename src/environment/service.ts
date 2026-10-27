import type { EnvironmentProfile, EnvironmentSnapshot } from './profiles';
import { requireBaseUrl, type ConfiguredProfile } from './validation';
import { loadSnapshot, type EnvironmentStorage } from './storage';

/**
 * A read-only view of the environment settings. The settings themselves are the store:
 * the designer changes them in the plugin settings, and each call here reads them again.
 */
export interface EnvironmentService {
  snapshot(): EnvironmentSnapshot;
  activeProfile(): EnvironmentProfile;
  configuredActiveProfile(): ConfiguredProfile;
}

export function createEnvironmentService(storage: EnvironmentStorage): EnvironmentService {
  const current: EnvironmentSnapshot = loadSnapshot(storage);

  const profileOf = (snapshot: EnvironmentSnapshot): EnvironmentProfile => ({
    id: snapshot.active,
    baseUrl: snapshot.baseUrls[snapshot.active],
  });

  return {
    snapshot: () => current,
    activeProfile: () => profileOf(current),
    configuredActiveProfile: () => requireBaseUrl(profileOf(current)),
  };
}
