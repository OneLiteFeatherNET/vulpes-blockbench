// The two File menu entries: "Open from Vulpes..." in the open group and "Save to
// Vulpes..." in the project group. Neither has a default key; the designer binds one
// in the keybind settings under the category `file`.

import { currentService } from './blockbench-storage';
import { runAction } from './remote-context';
import { startOpenFromVulpes } from './open-from-vulpes';
import { startSaveNewToVulpes } from './save-to-vulpes';

/** Adds the two actions. The returned function removes them again. */
export function registerFileActions(): () => void {
  const open = new Action('vulpes_open', {
    name: 'vulpes.action.open',
    description: 'vulpes.action.open.description',
    icon: 'cloud_download',
    category: 'file',
    click: () => {
      runAction(() => startOpenFromVulpes(currentService()));
    },
  });
  MenuBar.addAction(open, 'file.#open');
  const saveNew = new Action('vulpes_save_new', {
    name: 'vulpes.action.save_new',
    description: 'vulpes.action.save_new.description',
    icon: 'cloud_upload',
    category: 'file',
    click: () => {
      runAction(() => startSaveNewToVulpes(currentService()));
    },
  });
  MenuBar.addAction(saveNew, 'file.#project');
  return () => {
    open.delete();
    saveNew.delete();
  };
}
