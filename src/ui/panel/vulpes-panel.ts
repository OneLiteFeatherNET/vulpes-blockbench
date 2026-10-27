// The "Vulpes" sidebar panel. Blockbench mounts the Vue 2 component; this file wires it
// to the panel controller and the host. The component only renders the view state and
// forwards clicks, so every decision stays in panel-state.ts.

import type { AssetSummary } from '../../api/dto';
import type { VulpesPanelHost } from './host';
import { createPanelController, type PanelViewState } from './panel-state';

const PANEL_ID = 'vulpes';

const PANEL_CSS = `
.vulpes_panel { display: flex; flex-direction: column; gap: 6px; padding: 6px 8px; min-height: 0; flex-grow: 1; }
.vulpes_row { display: flex; align-items: center; gap: 6px; }
.vulpes_row > .vulpes_grow { flex-grow: 1; min-width: 0; }
.vulpes_badge { padding: 1px 8px; border-radius: 4px; border: 1px solid var(--color-border); font-weight: 600; }
.vulpes_badge.vulpes_flagged { background-color: var(--color-accent); border-color: var(--color-accent); color: var(--color-accent_text); }
.vulpes_badge.vulpes_unconfigured { opacity: 0.6; }
.vulpes_note { margin: 0; color: var(--color-subtle_text); }
.vulpes_error { color: var(--color-light); }
.vulpes_panel .vulpes_model_list { min-height: 0; }
.vulpes_model_row { display: flex; align-items: center; gap: 6px; padding: 3px 6px; cursor: pointer; }
.vulpes_model_row:hover { background-color: var(--color-border); }
.vulpes_model_name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vulpes_model_key { color: var(--color-subtle_text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vulpes_model_row > .vulpes_grow { flex-grow: 1; min-width: 0; }
.vulpes_footer { display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--color-border); padding-top: 6px; }
`;

const PANEL_TEMPLATE = `
  <div class="vulpes_panel">
    <div class="vulpes_row">
      <span class="vulpes_badge" :class="{ vulpes_flagged: view.environment.flagged, vulpes_unconfigured: !view.environment.configured }">
        {{ view.environment.configured ? t('vulpes.panel.' + view.environment.id) : t('vulpes.panel.not_configured') }}
      </span>
      <span class="vulpes_grow"></span>
      <button class="vulpes_button" :disabled="view.testing" @click="testConnection()">{{ t('vulpes.panel.test_connection') }}</button>
    </div>

    <div class="vulpes_row">
      <div class="bar_select vulpes_grow">
        <div class="bar_select_wrapper">
          <select :disabled="view.projects.items.length === 0" :value="view.selectedProjectId" @change="selectProject($event.target.value)">
            <option v-if="view.selectedProjectId === undefined" value="">{{ t('vulpes.panel.choose_project') }}</option>
            <option v-for="project in view.projects.items" :key="project.id" :value="project.id">{{ project.displayName }}</option>
          </select>
        </div>
      </div>
      <button class="vulpes_button" :disabled="view.projects.status === 'loading'" @click="refresh()">{{ t('vulpes.panel.refresh') }}</button>
    </div>
    <p v-if="view.projects.status === 'not_configured'" class="vulpes_note">{{ t('vulpes.panel.not_configured') }}</p>
    <p v-else-if="view.projects.status === 'loading'" class="vulpes_note">{{ t('vulpes.panel.loading') }}</p>
    <p v-else-if="view.projects.status === 'error'" class="vulpes_note vulpes_error">{{ t('vulpes.panel.error', view.projects.error) }}</p>

    <input type="search" class="dark_bordered" :value="view.search" :placeholder="t('vulpes.panel.search')" @input="setSearch($event.target.value)">

    <ul class="list vulpes_model_list">
      <li v-for="model in view.visibleModels" :key="model.id" class="vulpes_model_row" @dblclick="openModel(model)">
        <span class="vulpes_grow">
          <span class="vulpes_model_name">{{ model.fileName }}</span>
          <span class="vulpes_model_key">{{ model.key }}</span>
        </span>
        <button class="vulpes_button" :disabled="view.openingModelId !== undefined" @click.stop="openModel(model)">{{ t('vulpes.panel.open') }}</button>
      </li>
    </ul>
    <p v-if="view.models.status === 'error'" class="vulpes_note vulpes_error">{{ t('vulpes.panel.error', view.models.error) }}</p>
    <p v-else-if="view.models.status === 'loading'" class="vulpes_note">{{ t('vulpes.panel.loading') }}</p>
    <p v-else-if="view.models.status === 'ready' && view.visibleModels.length === 0" class="vulpes_note">{{ t('vulpes.panel.empty') }}</p>
    <div class="vulpes_row">
      <button v-if="view.models.hasMore" class="vulpes_button" :disabled="view.models.status === 'loading'" @click="loadMore()">{{ t('vulpes.panel.load_more') }}</button>
    </div>

    <div class="vulpes_footer">
      <p v-if="view.link.kind === 'linked'" class="vulpes_note">{{ t('vulpes.panel.linked_to', [view.link.key, t('vulpes.panel.' + view.link.environment)]) }}</p>
      <p v-else class="vulpes_note">{{ t('vulpes.panel.not_linked') }}</p>
      <button @click="saveCurrentAsNew()">{{ t('vulpes.panel.save_new') }}</button>
    </div>
  </div>
`;

/** Creates the panel and keeps it in step with the host. The result removes both again. */
export function createVulpesPanel(host: VulpesPanelHost): { dispose(): void } {
  let disposed = false;
  const controller = createPanelController(host, (view) => {
    if (!disposed) {
      holder.view = view;
    }
  });
  // Vue 2 observes this object in place, so assigning `view` re-renders the component.
  const holder: { view: PanelViewState } = { view: controller.current() };

  const css = Blockbench.addCSS(PANEL_CSS);
  const panel = new Panel(PANEL_ID, {
    name: 'vulpes.panel.title',
    icon: 'cloud_sync',
    growable: true,
    default_position: { slot: 'left_bar' },
    component: {
      data: () => holder,
      methods: {
        t: (key: string, args?: string | (string | number)[]) => tl(key, args),
        testConnection: () => {
          void controller.testConnection();
        },
        refresh: () => {
          void controller.refresh();
        },
        selectProject: (projectId: string) => {
          void controller.selectProject(projectId);
        },
        setSearch: (query: string) => {
          controller.setSearch(query);
        },
        loadMore: () => {
          void controller.loadMore();
        },
        openModel: (model: AssetSummary) => {
          void controller.openModel(model);
        },
        saveCurrentAsNew: () => {
          controller.saveCurrentAsNew();
        },
      },
      template: PANEL_TEMPLATE,
    },
  });

  const unsubscribe = host.onChange(() => {
    void controller.onHostChange();
  });
  void controller.refresh();

  return {
    dispose(): void {
      disposed = true;
      unsubscribe();
      panel.vue?.$destroy();
      panel.delete();
      css.delete();
    },
  };
}
