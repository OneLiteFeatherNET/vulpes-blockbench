import { createEnvironmentService, type EnvironmentService } from '../environment/service';
import { isProfileId, requiresConfirmation, type ProfileId } from '../environment/profiles';
import { askProdConfirmation, openSettingsDialog } from './settings-dialog';
import { blockbenchStorage, readNativeActive, writeNativeActive } from './blockbench-storage';
import { registerNativeSettings, removeNativeSettings } from './native-settings';
import { refreshVulpesMenu, removeVulpesMenu } from './vulpes-menu';
import { installRemoteModels, type RemoteModels } from './remote-models';
import { clearNotice } from './notify';

// The active environment as the designer last confirmed it. A change in the
// native settings dialog is compared with it to ask for the Prod confirmation.
let lastActive: ProfileId = 'dev';

// The remote model features. They exist only while the plugin is loaded.
let remote: RemoteModels | undefined;

/** Each call reads the stored values again, so both views always show the same data. */
function currentService(): EnvironmentService {
  return createEnvironmentService(blockbenchStorage);
}

function refreshLabel(): void {
  const active = currentService().snapshot().active;
  lastActive = active;
  refreshVulpesMenu(active, {
    onOpenFromVulpes: () => {
      remote?.openFromVulpes();
    },
    onSaveNewToVulpes: () => {
      remote?.saveNewToVulpes();
    },
    onSettings: () => {
      openSettingsDialog(currentService(), refreshLabel);
    },
  });
}

function onNativeActiveChanged(): void {
  const next = readNativeActive();
  if (!isProfileId(next)) {
    return;
  }
  if (!requiresConfirmation(lastActive, next)) {
    lastActive = next;
    refreshLabel();
    return;
  }
  askProdConfirmation(
    () => {
      currentService().switchTo('prod', true);
      refreshLabel();
    },
    () => {
      writeNativeActive(lastActive);
      refreshLabel();
    },
  );
}

export function mountVulpesUi(): void {
  const snapshot = currentService().snapshot();
  registerNativeSettings(
    { active: snapshot.active, dev: snapshot.baseUrls.dev, prod: snapshot.baseUrls.prod },
    onNativeActiveChanged,
    refreshLabel,
  );
  remote = installRemoteModels(currentService);
  refreshLabel();
}

export function unmountVulpesUi(): void {
  remote?.dispose();
  remote = undefined;
  removeVulpesMenu();
  removeNativeSettings();
  clearNotice();
}
