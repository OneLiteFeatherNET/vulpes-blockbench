// The host of the sidebar panel. The panel renders and reacts; every request, every
// project change and every message goes through this host.

import type { AssetSummary, ProjectSummary } from '../api/dto';
import { testConnection } from '../environment/connection-test';
import type { EnvironmentService } from '../environment/service';
import { listAllProjects } from '../remote/catalog';
import { MODEL_PAGE_SIZE } from '../remote/model-list';
import { describeFailure, type ApiFailure } from '../problem';
import type { PanelError, PanelResult, VulpesPanelHost } from './panel/host';
import { errorMessage, quickMessage } from './feedback';
import { currentService } from './blockbench-storage';
import { subscribeVulpesChange } from './change-bus';
import { openAsset } from './open-from-vulpes';
import { linkOf } from './project-link';
import { clientFor, messageText, notConfigured, originOf, runAction } from './remote-context';
import { startSaveNewToVulpes } from './save-to-vulpes';
import { saveCurrentToVulpes } from './save-codec';

function failed(failure: ApiFailure): { readonly ok: false; readonly error: PanelError } {
  return { ok: false, error: { message: messageText(describeFailure(failure)) } };
}

function unconfigured(service: EnvironmentService): { readonly ok: false; readonly error: PanelError } {
  return { ok: false, error: { message: messageText(notConfigured(service)) } };
}

/** Builds the host the sidebar panel is created with. Each call reads the stored settings again. */
export function createPanelHost(): VulpesPanelHost {
  return {
    activeEnvironment: () => {
      const service = currentService();
      return { id: service.activeProfile().id, configured: service.configuredActiveProfile().ok };
    },

    testConnection: async () => {
      const service = currentService();
      const origin = originOf(service);
      if (origin === undefined) {
        errorMessage(messageText(notConfigured(service)));
        return;
      }
      const outcome = await testConnection(origin.baseUrl, (url) => fetch(url));
      switch (outcome.kind) {
        case 'ok':
          quickMessage(tl('vulpes.test.ok', [origin.baseUrl, String(outcome.status)]));
          return;
        case 'http-error':
          errorMessage(tl('vulpes.test.http', [origin.baseUrl, String(outcome.status)]));
          return;
        case 'network-error':
          errorMessage(tl('vulpes.test.network', [origin.baseUrl, outcome.message]));
          return;
      }
    },

    listProjects: async (): Promise<PanelResult<readonly ProjectSummary[]>> => {
      const service = currentService();
      const origin = originOf(service);
      if (origin === undefined) {
        return unconfigured(service);
      }
      const result = await listAllProjects(clientFor(origin.baseUrl));
      return result.ok ? { ok: true, value: result.value } : failed(result.failure);
    },

    listModels: async (projectId: string, page: number) => {
      const service = currentService();
      const origin = originOf(service);
      if (origin === undefined) {
        return unconfigured(service);
      }
      const result = await clientFor(origin.baseUrl).listModels(projectId, page, MODEL_PAGE_SIZE);
      if (!result.ok) {
        return failed(result.failure);
      }
      return {
        ok: true,
        value: { items: result.value.items, hasMore: (page + 1) * MODEL_PAGE_SIZE < result.value.totalSize },
      };
    },

    openModel: async (projectId: string, model: AssetSummary) => {
      const service = currentService();
      const origin = originOf(service);
      if (origin === undefined) {
        errorMessage(messageText(notConfigured(service)));
        return;
      }
      const message = await openAsset(origin, projectId, model);
      if (message !== undefined) {
        errorMessage(messageText(message));
      }
    },

    saveCurrentAsNew: () => {
      runAction(async () => {
        const project = Project;
        if (project !== null && project !== undefined && linkOf(project) !== undefined) {
          saveCurrentToVulpes();
          return;
        }
        await startSaveNewToVulpes(currentService());
      });
    },

    currentLink: () => {
      const project = Project;
      if (project === null || project === undefined) {
        return undefined;
      }
      const record = linkOf(project);
      return record === undefined ? undefined : { environment: record.environment, key: record.key };
    },

    onChange: subscribeVulpesChange,
  };
}
