import type { EnvironmentStorage } from '../environment/storage';
import type { EnvironmentSnapshot } from '../environment/profiles';

// The ids of the native settings. They are the stored values of the snapshot.
export const SETTING_IDS = {
  active: 'vulpes_active_environment',
  dev: 'vulpes_dev_url',
  prod: 'vulpes_prod_url',
} as const;

function settingValue(id: string): unknown {
  return settings[id]?.value;
}

function setSettingValue(id: string, value: string): void {
  const setting = settings[id];
  if (setting !== undefined) {
    setting.value = value;
  }
}

/**
 * The environment storage backed by the native Blockbench settings. Blockbench
 * keeps the values in its own localStorage entry, so both views read the same data.
 */
export const blockbenchStorage: EnvironmentStorage = {
  read(): unknown {
    return {
      active: settingValue(SETTING_IDS.active),
      baseUrls: {
        dev: settingValue(SETTING_IDS.dev),
        prod: settingValue(SETTING_IDS.prod),
      },
    };
  },
  write(snapshot: EnvironmentSnapshot): void {
    setSettingValue(SETTING_IDS.active, snapshot.active);
    setSettingValue(SETTING_IDS.dev, snapshot.baseUrls.dev);
    setSettingValue(SETTING_IDS.prod, snapshot.baseUrls.prod);
    Settings.saveLocalStorages();
  },
};

/** Reads the active environment as the native setting holds it. The value is untrusted. */
export function readNativeActive(): unknown {
  return settingValue(SETTING_IDS.active);
}

/** Sets the native active environment back to a known value, for example after a cancelled switch. */
export function writeNativeActive(active: string): void {
  setSettingValue(SETTING_IDS.active, active);
  Settings.saveLocalStorages();
}
