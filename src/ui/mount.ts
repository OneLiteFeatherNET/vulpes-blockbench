// The plugin's onload and onunload. Each registration returns its removal. Unload clears
// the links of open projects first, then removes the registrations in reverse order.

import { coreTranslations } from '../i18n/core';
import { itemTranslations } from '../i18n/items';
import { panelTranslations } from '../i18n/panel';
import { registerAssignItemAction } from './assign-item';
import { revisionTranslations } from '../i18n/revisions';
import { registerFileActions } from './file-actions';
import { registerModelLoader } from './model-loader';
import { createPanelHost } from './panel-host';
import { createVulpesPanel } from './panel/vulpes-panel';
import { detachAll } from './project-link';
import { registerPluginSettings } from './settings';
import { registerVulpesCodec } from './save-codec';
import { registerRevisionActions } from './revisions';

let removals: (() => void)[] = [];

function registerTranslations(): void {
  Language.addTranslations('en', { ...coreTranslations.en, ...panelTranslations.en, ...itemTranslations.en, ...revisionTranslations.en });
  Language.addTranslations('de', { ...coreTranslations.de, ...panelTranslations.de, ...itemTranslations.de, ...revisionTranslations.de });
}

export function mountVulpesUi(): void {
  registerTranslations();
  const registered = [registerVulpesCodec(), registerPluginSettings(), registerFileActions(), registerRevisionActions(), registerModelLoader(), registerAssignItemAction()];
  // The panel comes last: it reads the settings and the actions when it is created.
  const panel = createVulpesPanel(createPanelHost());
  removals = [...registered, () => {
    panel.dispose();
  }];
}

export function unmountVulpesUi(): void {
  detachAll();
  for (const remove of [...removals].reverse()) {
    remove();
  }
  removals = [];
}
