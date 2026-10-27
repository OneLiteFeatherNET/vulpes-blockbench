// Entry point of the Blockbench plugin. Only the UI layer calls Blockbench
// globals; the logic modules receive their collaborators as parameters.

Plugin.register('vulpes', {
  title: 'Vulpes',
  author: 'OneLiteFeather',
  description: 'Open and save Blockbench models from and to Vulpes.',
  version: '0.1.0',
  variant: 'desktop',
  onload() {
    // Nothing to set up until the sign-in and model features are added.
  },
  onunload() {
    // Nothing to tear down until the sign-in and model features are added.
  },
});
