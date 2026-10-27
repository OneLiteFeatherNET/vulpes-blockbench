// The contract between the "Vulpes" sidebar panel and the rest of the plugin. The
// panel only renders and reacts; every backend call and every project change goes
// through this host, so the panel never talks to Blockbench projects or the API itself.

import type { AssetSummary, ProjectSummary } from '../../api/dto';
import type { ProfileId } from '../../environment/profiles';

/** The environment the panel shows in its badge. */
export interface PanelEnvironment {
  readonly id: ProfileId;
  /** False when the active environment has no base URL yet. */
  readonly configured: boolean;
}

/** The Vulpes link of the selected Blockbench project, if it has one. */
export interface PanelLink {
  readonly environment: ProfileId;
  readonly key: string;
}

/** A failed host call, already translated for display. */
export interface PanelError {
  readonly message: string;
}

export type PanelResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: PanelError };

export interface ModelPage {
  readonly items: readonly AssetSummary[];
  readonly hasMore: boolean;
}

export interface VulpesPanelHost {
  readonly activeEnvironment: () => PanelEnvironment;
  /** Tests the active environment and shows the outcome itself. */
  readonly testConnection: () => Promise<void>;
  readonly listProjects: () => Promise<PanelResult<readonly ProjectSummary[]>>;
  /** Loads the zero-based page of Blockbench models of a project. */
  readonly listModels: (projectId: string, page: number) => Promise<PanelResult<ModelPage>>;
  /** Opens a model as a new Blockbench project; reports failures itself. */
  readonly openModel: (projectId: string, model: AssetSummary) => Promise<void>;
  /** Starts the "Save to Vulpes" flow for the selected project. */
  readonly saveCurrentAsNew: () => void;
  readonly currentLink: () => PanelLink | undefined;
  /** Notifies when the environment, the selected project or its link changed. Returns the unsubscribe. */
  readonly onChange: (listener: () => void) => () => void;
}
