// Installs the remote model features: the reference property, the save routing and
// the two menu actions. `dispose` removes all of it again.

import { saveLinkedProject } from './linked-save';
import { startOpenFromVulpes } from './open-from-vulpes';
import { installSaveRouting } from './save-routing';
import { startSaveNewToVulpes } from './save-to-vulpes';
import { registerLinkProperty, unregisterLinkProperty } from './project-link';
import { runAction, type ServiceProvider } from './remote-context';

export interface RemoteModels {
  openFromVulpes(): void;
  saveNewToVulpes(): void;
  dispose(): void;
}

export function installRemoteModels(service: ServiceProvider): RemoteModels {
  registerLinkProperty();
  const restoreRouting = installSaveRouting((project, reference) => {
    saveLinkedProject(service(), project, reference);
  });
  return {
    openFromVulpes: () => {
      runAction(() => startOpenFromVulpes(service()));
    },
    saveNewToVulpes: () => {
      runAction(() => startSaveNewToVulpes(service()));
    },
    dispose: () => {
      restoreRouting();
      unregisterLinkProperty();
    },
  };
}
