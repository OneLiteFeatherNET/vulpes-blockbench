// Entry point of the Blockbench plugin. Only the UI layer calls Blockbench
// globals; the logic modules receive their collaborators as parameters.

import { mountVulpesUi, unmountVulpesUi } from './ui/mount';

const REPOSITORY = 'https://github.com/OneLiteFeatherNET/vulpes-blockbench';

Plugin.register('vulpes', {
  title: 'Vulpes',
  author: 'OneLiteFeather',
  description: 'Open and save Blockbench models from and to Vulpes.',
  about: [
    'Opens models from Vulpes and saves them back. Use **File > Open from Vulpes**, the start screen tile, or the Vulpes panel in the left bar.',
    'Ctrl+S saves a linked model to the Vulpes it came from. **File > Save Project** and **Save Project As** stay local.',
    'The environment is Dev or Prod, set under General in the plugin settings. Each switch to Prod asks first.',
    'Internal use only. There is no sign-in yet.',
  ].join('\n\n'),
  icon: 'cloud_sync',
  tags: ['Vulpes', 'CMS', 'Minecraft'],
  version: __PLUGIN_VERSION__,
  variant: 'desktop',
  min_version: '5.2.0',
  website: REPOSITORY,
  repository: REPOSITORY,
  bug_tracker: `${REPOSITORY}/issues`,
  onload() {
    mountVulpesUi();
  },
  onunload() {
    unmountVulpesUi();
  },
});
