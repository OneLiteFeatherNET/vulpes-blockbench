// The state of the "Vulpes" panel as a plain view model. The controller calls the host,
// keeps only the latest answer of each request and renders a snapshot after each change.
// It uses no Vue, no Blockbench and no timers, so Vitest runs it with a fake host.

import type { AssetSummary, ProjectSummary } from '../../api/dto';
import type { ProfileId } from '../../environment/profiles';
import type { PanelEnvironment, PanelLink, VulpesPanelHost } from './host';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EnvironmentView {
  readonly id: ProfileId;
  readonly configured: boolean;
  /** True for Prod, which the badge draws in its distinct style. */
  readonly flagged: boolean;
}

export type LinkView =
  | { readonly kind: 'none' }
  | { readonly kind: 'linked'; readonly environment: ProfileId; readonly key: string };

export interface ProjectsView {
  readonly status: LoadStatus | 'not_configured';
  readonly items: readonly ProjectSummary[];
  readonly error: string | undefined;
}

export interface ModelsView {
  readonly status: LoadStatus;
  /** Every model loaded so far for the selected project, before the search filter. */
  readonly items: readonly AssetSummary[];
  readonly hasMore: boolean;
  readonly error: string | undefined;
}

export interface PanelViewState {
  readonly environment: EnvironmentView;
  readonly link: LinkView;
  readonly projects: ProjectsView;
  readonly selectedProjectId: string | undefined;
  readonly search: string;
  readonly models: ModelsView;
  /** The loaded models that match the search. */
  readonly visibleModels: readonly AssetSummary[];
  readonly testing: boolean;
  readonly openingModelId: string | undefined;
}

export interface PanelController {
  /** The latest view, for the first render. */
  current(): PanelViewState;
  /** Reloads the environment, the link, the projects and the models of the selection. */
  refresh(): Promise<void>;
  /** Called when the host reports a change. Reloads on an environment switch, otherwise only the link. */
  onHostChange(): Promise<void>;
  selectProject(projectId: string): Promise<void>;
  setSearch(query: string): void;
  loadMore(): Promise<void>;
  openModel(model: AssetSummary): Promise<void>;
  testConnection(): Promise<void>;
  saveCurrentAsNew(): void;
}

interface ModelsState {
  readonly items: readonly AssetSummary[];
  readonly nextPage: number;
  readonly hasMore: boolean;
  readonly status: LoadStatus;
  readonly error: string | undefined;
}

interface InternalState {
  readonly env: PanelEnvironment;
  readonly link: PanelLink | undefined;
  readonly projects: ProjectsView;
  readonly selectedProjectId: string | undefined;
  readonly search: string;
  readonly models: ModelsState;
  readonly testing: boolean;
  readonly openingModelId: string | undefined;
}

const NO_MODELS: ModelsState = { items: [], nextPage: 0, hasMore: false, status: 'idle', error: undefined };

export function environmentView(env: PanelEnvironment): EnvironmentView {
  return { id: env.id, configured: env.configured, flagged: env.id === 'prod' };
}

export function linkView(link: PanelLink | undefined): LinkView {
  return link === undefined ? { kind: 'none' } : { kind: 'linked', environment: link.environment, key: link.key };
}

/** Case-insensitive. An empty or blank query matches everything. */
export function matchesSearch(model: AssetSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  return model.key.toLowerCase().includes(needle) || model.fileName.toLowerCase().includes(needle);
}

export function visibleModels(items: readonly AssetSummary[], query: string): readonly AssetSummary[] {
  return items.filter((model) => matchesSearch(model, query));
}

/** Keeps the current selection when the project is still listed, otherwise picks the first one. */
function pickSelection(current: string | undefined, projects: readonly ProjectSummary[]): string | undefined {
  if (current !== undefined && projects.some((project) => project.id === current)) {
    return current;
  }
  return projects[0]?.id;
}

function toView(state: InternalState): PanelViewState {
  return {
    environment: environmentView(state.env),
    link: linkView(state.link),
    projects: state.projects,
    selectedProjectId: state.selectedProjectId,
    search: state.search,
    models: { status: state.models.status, items: state.models.items, hasMore: state.models.hasMore, error: state.models.error },
    visibleModels: visibleModels(state.models.items, state.search),
    testing: state.testing,
    openingModelId: state.openingModelId,
  };
}

export function createPanelController(host: VulpesPanelHost, render: (view: PanelViewState) => void): PanelController {
  let state: InternalState = {
    env: host.activeEnvironment(),
    link: host.currentLink(),
    projects: { status: 'idle', items: [], error: undefined },
    selectedProjectId: undefined,
    search: '',
    models: NO_MODELS,
    testing: false,
    openingModelId: undefined,
  };
  // A request answers only if no newer request of its kind started meanwhile.
  // Environment switches invalidate everything; a new selection invalidates the models.
  let environmentGeneration = 0;
  let modelGeneration = 0;

  function update(patch: Partial<InternalState>): void {
    state = { ...state, ...patch };
    render(toView(state));
  }

  async function fetchPage(projectId: string, page: number, base: readonly AssetSummary[]): Promise<void> {
    const models = modelGeneration;
    const environment = environmentGeneration;
    update({ models: { ...state.models, status: 'loading', error: undefined } });
    const result = await host.listModels(projectId, page);
    if (models !== modelGeneration || environment !== environmentGeneration) {
      return;
    }
    if (result.ok) {
      update({
        models: { items: [...base, ...result.value.items], nextPage: page + 1, hasMore: result.value.hasMore, status: 'ready', error: undefined },
      });
    } else {
      update({ models: { ...state.models, status: 'error', error: result.error.message } });
    }
  }

  async function reload(keepSelection: boolean): Promise<void> {
    environmentGeneration++;
    modelGeneration++;
    const env = host.activeEnvironment();
    const link = host.currentLink();
    const previous = keepSelection ? state.selectedProjectId : undefined;
    if (!env.configured) {
      update({ env, link, projects: { status: 'not_configured', items: [], error: undefined }, selectedProjectId: undefined, models: NO_MODELS });
      return;
    }
    const environment = environmentGeneration;
    update({ env, link, projects: { status: 'loading', items: [], error: undefined }, models: NO_MODELS });
    const result = await host.listProjects();
    if (environment !== environmentGeneration) {
      return;
    }
    if (!result.ok) {
      update({ projects: { status: 'error', items: [], error: result.error.message }, selectedProjectId: undefined });
      return;
    }
    const selected = pickSelection(previous, result.value);
    update({ projects: { status: 'ready', items: result.value, error: undefined }, selectedProjectId: selected });
    if (selected !== undefined) {
      await fetchPage(selected, 0, []);
    }
  }

  return {
    current: () => toView(state),

    refresh: () => reload(true),

    async onHostChange(): Promise<void> {
      const env = host.activeEnvironment();
      if (env.id !== state.env.id || env.configured !== state.env.configured) {
        await reload(false);
        return;
      }
      update({ link: host.currentLink() });
    },

    async selectProject(projectId: string): Promise<void> {
      if (!state.projects.items.some((project) => project.id === projectId)) {
        return;
      }
      modelGeneration++;
      update({ selectedProjectId: projectId, models: NO_MODELS });
      await fetchPage(projectId, 0, []);
    },

    setSearch(query: string): void {
      update({ search: query });
    },

    async loadMore(): Promise<void> {
      const { selectedProjectId, models } = state;
      if (selectedProjectId === undefined || !models.hasMore || models.status === 'loading') {
        return;
      }
      await fetchPage(selectedProjectId, models.nextPage, models.items);
    },

    async openModel(model: AssetSummary): Promise<void> {
      const projectId = state.selectedProjectId;
      if (projectId === undefined || state.openingModelId !== undefined) {
        return;
      }
      update({ openingModelId: model.id });
      try {
        await host.openModel(projectId, model);
      } finally {
        update({ openingModelId: undefined });
      }
    },

    async testConnection(): Promise<void> {
      if (state.testing) {
        return;
      }
      update({ testing: true });
      try {
        await host.testConnection();
      } finally {
        update({ testing: false });
      }
    },

    saveCurrentAsNew(): void {
      host.saveCurrentAsNew();
    },
  };
}
