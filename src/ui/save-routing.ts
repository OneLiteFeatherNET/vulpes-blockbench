// Routes Ctrl+S and File > Save of a linked project to Vulpes. Both actions call
// Codecs.project.write for a project that has a file, and call the file dialog
// otherwise. The routing replaces the click of the two actions, because a Save As or
// an Export also reaches Codec.write, and those must stay local.

import type { RemoteReference } from '../remote/reference';
import { linkOf } from './project-link';

const SAVE_ACTIONS = ['export_over', 'save_project'] as const;

/**
 * Installs the routing. A linked project calls `onLinkedSave` instead of the original
 * click. The returned function restores the original clicks.
 */
export function installSaveRouting(
  onLinkedSave: (project: BlockbenchProject, reference: RemoteReference) => void,
): () => void {
  const restores: (() => void)[] = [];
  for (const id of SAVE_ACTIONS) {
    const action = BarItems[id];
    if (action === undefined) {
      continue;
    }
    const original = action.click;
    action.click = (event) => {
      const project = Project;
      const reference = project === null || project === undefined ? undefined : linkOf(project);
      if (project !== null && project !== undefined && reference !== undefined) {
        onLinkedSave(project, reference);
        return undefined;
      }
      return original(event);
    };
    restores.push(() => {
      action.click = original;
    });
  }
  return () => {
    for (const restore of restores.reverse()) {
      restore();
    }
  };
}
