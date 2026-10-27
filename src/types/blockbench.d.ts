// Blockbench globals used by the plugin. Hand-written on purpose: the
// blockbench-types package pulls in electron and other large dependencies.
// Add a declaration here together with the code that first uses it.

interface VulpesPluginOptions {
  title: string;
  author: string;
  description: string;
  version: string;
  variant: 'desktop';
  onload: () => void;
  onunload: () => void;
}

declare const Plugin: {
  register: (id: string, options: VulpesPluginOptions) => void;
};
