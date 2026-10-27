// Entry point of the Blockbench plugin. Only the UI layer calls Blockbench
// globals; the logic modules receive their collaborators as parameters.

import { mountVulpesUi, unmountVulpesUi } from './ui/mount';

Plugin.register('vulpes', {
  title: 'Vulpes',
  author: 'OneLiteFeather',
  description: 'Open and save Blockbench models from and to Vulpes.',
  version: __PLUGIN_VERSION__,
  variant: 'desktop',
  onload() {
    mountVulpesUi();
  },
  onunload() {
    unmountVulpesUi();
  },
});
