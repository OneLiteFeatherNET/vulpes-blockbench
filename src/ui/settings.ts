// The plugin settings, in the category `general`. The plugin owns them, so they
// appear in the plugin's own Settings tab and under General in Preferences. No
// category is created, because Settings.addCategory needs the settings dialog first.

import { DEFAULT_DEV_BASE_URL, DEFAULT_PROD_BASE_URL, isProfileId, requiresConfirmation, type ProfileId } from '../environment/profiles';
import { DEFAULT_DEV_SIGNALING_HOST, DEFAULT_PROD_SIGNALING_HOST } from '../live/signaling-settings';
import { SETTING_IDS } from './blockbench-storage';
import { emitVulpesChange } from './change-bus';
import { confirmMessage } from './feedback';

/**
 * Registers the settings. The URLs are stored raw and checked when they are used, so
 * typing is never interrupted. The returned function removes the settings.
 */
export function registerPluginSettings(): () => void {
  // The last environment the designer confirmed. A switch to Prod is checked against it.
  let confirmed: ProfileId = 'dev';

  // Restores the confirmed value. Setting.value does not run onChange, so this cannot loop.
  const revert = (): void => {
    active.value = confirmed;
    Settings.saveLocalStorages();
    emitVulpesChange();
  };

  const onActiveChanged = (next: string): void => {
    if (!isProfileId(next)) {
      return;
    }
    if (!requiresConfirmation(confirmed, next)) {
      confirmed = next;
      emitVulpesChange();
      return;
    }
    confirmMessage(
      tl('vulpes.confirm_prod.title'),
      tl('vulpes.confirm_prod.message'),
      tl('vulpes.confirm_prod.button'),
      () => {
        confirmed = 'prod';
        emitVulpesChange();
      },
      revert,
    );
  };

  const active = new Setting(SETTING_IDS.active, {
    name: tl('vulpes.setting.active.name'),
    description: tl('vulpes.setting.active.description'),
    category: 'general',
    type: 'select',
    value: 'dev',
    options: { dev: tl('vulpes.env.dev'), prod: tl('vulpes.env.prod') },
    plugin: 'vulpes',
    onChange: onActiveChanged,
  });
  confirmed = isProfileId(active.value) ? active.value : 'dev';

  const dev = new Setting(SETTING_IDS.dev, {
    name: tl('vulpes.setting.dev_url.name'),
    description: tl('vulpes.setting.dev_url.description'),
    category: 'general',
    type: 'text',
    value: DEFAULT_DEV_BASE_URL,
    plugin: 'vulpes',
    onChange: emitVulpesChange,
  });
  const prod = new Setting(SETTING_IDS.prod, {
    name: tl('vulpes.setting.prod_url.name'),
    description: tl('vulpes.setting.prod_url.description'),
    category: 'general',
    type: 'text',
    value: DEFAULT_PROD_BASE_URL,
    plugin: 'vulpes',
    onChange: emitVulpesChange,
  });
  const devHost = new Setting(SETTING_IDS.devSignalingHost, {
    name: tl('vulpes.live.setting.dev_host.name'),
    description: tl('vulpes.live.setting.dev_host.description'),
    category: 'general',
    type: 'text',
    value: DEFAULT_DEV_SIGNALING_HOST,
    plugin: 'vulpes',
    onChange: emitVulpesChange,
  });
  const prodHost = new Setting(SETTING_IDS.prodSignalingHost, {
    name: tl('vulpes.live.setting.prod_host.name'),
    description: tl('vulpes.live.setting.prod_host.description'),
    category: 'general',
    type: 'text',
    value: DEFAULT_PROD_SIGNALING_HOST,
    plugin: 'vulpes',
    onChange: emitVulpesChange,
  });

  return () => {
    active.delete();
    dev.delete();
    prod.delete();
    devHost.delete();
    prodHost.delete();
  };
}
