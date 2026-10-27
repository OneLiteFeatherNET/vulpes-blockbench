import { SETTING_IDS } from './blockbench-storage';

export const SETTINGS_CATEGORY = 'vulpes';

/**
 * Registers the three native settings in the category "Vulpes". `onActiveChanged`
 * runs when the designer changes the active environment in the native dialog.
 */
export function registerNativeSettings(
  initial: { active: string; dev: string; prod: string },
  onActiveChanged: () => void,
  onUrlChanged: () => void,
): void {
  Settings.addCategory(SETTINGS_CATEGORY, { name: 'Vulpes' });
  new Setting(SETTING_IDS.active, {
    name: 'Active environment',
    category: SETTINGS_CATEGORY,
    type: 'select',
    value: initial.active,
    options: { dev: 'Dev', prod: 'Prod' },
    plugin: 'vulpes',
    onChange: onActiveChanged,
  });
  new Setting(SETTING_IDS.dev, {
    name: 'Dev URL',
    category: SETTINGS_CATEGORY,
    type: 'text',
    value: initial.dev,
    plugin: 'vulpes',
    onChange: onUrlChanged,
  });
  new Setting(SETTING_IDS.prod, {
    name: 'Prod URL',
    category: SETTINGS_CATEGORY,
    type: 'text',
    value: initial.prod,
    plugin: 'vulpes',
    onChange: onUrlChanged,
  });
}

/** Removes the three settings the plugin registered. The category stays, because the API has no call for it. */
export function removeNativeSettings(): void {
  for (const id of Object.values(SETTING_IDS)) {
    settings[id]?.delete();
  }
}
