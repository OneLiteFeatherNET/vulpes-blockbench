// The "Vulpes model" tile of the start screen and of File > New.

import { currentService } from './blockbench-storage';
import { startOpenFromVulpes } from './open-from-vulpes';
import { runAction } from './remote-context';

/** Registers the loader. The returned function removes it again. */
export function registerModelLoader(): () => void {
  const loader = new ModelLoader('vulpes_model', {
    icon: 'cloud_download',
    name: 'vulpes.loader.name',
    description: 'vulpes.loader.description',
    category: 'loaders',
    show_on_start_screen: true,
    onStart: () => {
      runAction(() => startOpenFromVulpes(currentService()));
    },
  });
  return () => {
    loader.delete();
  };
}
