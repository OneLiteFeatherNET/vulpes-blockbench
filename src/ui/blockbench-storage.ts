import { createEnvironmentService, type EnvironmentService } from '../environment/service';
import type { EnvironmentStorage } from '../environment/storage';
import type { ProfileId } from '../environment/profiles';
import { validateBaseUrl } from '../environment/validation';
import { readSignalingHost } from '../live/signaling-settings';

// The ids of the plugin settings. The values are read from them, never copied.
export const SETTING_IDS = {
  active: 'vulpes_active_environment',
  dev: 'vulpes_dev_url',
  prod: 'vulpes_prod_url',
  devSignalingHost: 'vulpes_dev_signaling_host',
  prodSignalingHost: 'vulpes_prod_signaling_host',
} as const;

function settingValue(id: string): unknown {
  return settings[id]?.value;
}

/** A stored URL that fails the rules counts as not configured. The text stays in the setting, so the designer can correct it. */
function usableUrl(raw: unknown, profile: ProfileId): string {
  if (typeof raw !== 'string') {
    return '';
  }
  const checked = validateBaseUrl(raw, profile);
  return checked.ok ? checked.value : '';
}

const blockbenchStorage: EnvironmentStorage = {
  read(): unknown {
    return {
      active: settingValue(SETTING_IDS.active),
      baseUrls: {
        dev: usableUrl(settingValue(SETTING_IDS.dev), 'dev'),
        prod: usableUrl(settingValue(SETTING_IDS.prod), 'prod'),
      },
    };
  },
};

/** The signaling host of a profile. A missing or unreadable setting gives the default of the profile. */
export function storedSignalingHost(profile: ProfileId): string {
  const id = profile === 'dev' ? SETTING_IDS.devSignalingHost : SETTING_IDS.prodSignalingHost;
  return readSignalingHost(profile, () => settingValue(id));
}

/** A service over the stored settings. Each call reads them again, so every view shows the same data. */
export function currentService(): EnvironmentService {
  return createEnvironmentService(blockbenchStorage);
}
