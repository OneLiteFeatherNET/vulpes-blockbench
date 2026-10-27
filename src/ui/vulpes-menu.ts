import { environmentLabel, type ProfileId } from '../environment/profiles';

// The top-level menu is kept here so that it can be replaced when the label changes.
let menu: BarMenu | undefined;

/**
 * Shows the "Vulpes" menu with the active environment in its label. Blockbench
 * has no status bar entry for plugins, so the label is the visible indicator.
 * The menu is rebuilt, because the label is set when the menu is created.
 */
export function refreshVulpesMenu(active: ProfileId, onSettings: () => void): void {
  menu?.delete();
  menu = new BarMenu(
    'vulpes',
    [{ name: 'Settings...', icon: 'settings', click: onSettings }],
    { name: environmentLabel(active) },
  );
  MenuBar.addMenu(menu);
  MenuBar.update();
}

export function removeVulpesMenu(): void {
  menu?.delete();
  menu = undefined;
  MenuBar.update();
}
