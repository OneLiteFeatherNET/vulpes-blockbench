// "Open from Vulpes": a project dialog, then a paged model dialog. A model opens as a
// normal Blockbench project that is linked to the asset it came from.

import type { AssetSummary, ProjectSummary } from '../api/dto';
import type { EnvironmentService } from '../environment/service';
import { isRecord, parseJsonText } from '../json';
import type { LinkRecord } from '../link/link-state';
import { describeFailure, type UserMessage } from '../problem';
import { listAllProjects, loadNextModelPage } from '../remote/catalog';
import { emptyModelList, hasMoreModels, type ModelList } from '../remote/model-list';
import { errorMessage } from './feedback';
import { placeModel } from './place-model';
import { clientFor, environmentName, fieldText, messageText, notConfigured, originOf, runAction, type Origin } from './remote-context';

export async function startOpenFromVulpes(service: EnvironmentService): Promise<void> {
  const origin = originOf(service);
  if (origin === undefined) {
    errorMessage(messageText(notConfigured(service)));
    return;
  }
  await showProjects(origin, undefined);
}

/** Opens one asset as a project. Returns the message to show when it fails, or undefined on success. */
export async function openAsset(origin: Origin, projectId: string, asset: AssetSummary): Promise<UserMessage | undefined> {
  const result = await clientFor(origin.baseUrl).readModel(projectId, asset.id);
  if (!result.ok) {
    return describeFailure(result.failure);
  }
  const model = parseJsonText(result.value.text);
  if (!isRecord(model)) {
    return { key: 'vulpes.open.not_model', params: [] };
  }
  const record: LinkRecord = {
    environment: origin.environment,
    baseUrl: origin.baseUrl,
    projectId,
    assetId: asset.id,
    key: asset.key,
    etag: result.value.etag,
  };
  return placeModel(model, record);
}

async function showProjects(origin: Origin, selected: string | undefined): Promise<void> {
  const result = await listAllProjects(clientFor(origin.baseUrl));
  if (!result.ok) {
    errorMessage(messageText(describeFailure(result.failure)));
    return;
  }
  if (result.value.length === 0) {
    errorMessage(tl('vulpes.open.no_projects', [environmentName(origin.environment)]));
    return;
  }
  projectDialog(origin, result.value, selected);
}

function projectDialog(origin: Origin, projects: readonly ProjectSummary[], selected: string | undefined): void {
  const first = projects[0];
  if (first === undefined) {
    return;
  }
  const options: Record<string, string> = {};
  for (const project of projects) {
    options[project.id] = `${project.displayName} (${project.key})`;
  }
  const dialog: Dialog = new Dialog('vulpes_open_project', {
    title: 'vulpes.open.project_title',
    form: { project: { label: tl('vulpes.field.project'), type: 'select', options, value: selected ?? first.id } },
    buttons: ['vulpes.button.next', 'dialog.cancel'],
    confirmIndex: 0,
    cancelIndex: 1,
    onConfirm(result) {
      const chosen = projects.find((project) => project.id === fieldText(result, 'project'));
      if (chosen === undefined) {
        return false;
      }
      dialog.hide();
      runAction(() => startModels(origin, chosen));
      return false;
    },
  });
  dialog.show();
}

async function startModels(origin: Origin, project: ProjectSummary): Promise<void> {
  const result = await loadNextModelPage(clientFor(origin.baseUrl), project.id, emptyModelList());
  if (!result.ok) {
    modelDialog(origin, project, emptyModelList(), { error: messageText(describeFailure(result.failure)) });
    return;
  }
  modelDialog(origin, project, result.value, {});
}

interface DialogState {
  readonly error?: string;
  readonly selected?: string;
}

function modelDialog(origin: Origin, project: ProjectSummary, list: ModelList, state: DialogState): void {
  const first = list.items[0];
  const options: Record<string, string> = {};
  for (const asset of list.items) {
    options[asset.id] = `${asset.key} (${asset.fileName})`;
  }
  const actions: ((selected: string | undefined) => void)[] = [];
  const buttons: string[] = [];
  if (first !== undefined) {
    buttons.push('vulpes.button.open');
    actions.push((selected) => {
      const asset = list.items.find((item) => item.id === selected);
      if (asset !== undefined) {
        runAction(async () => {
          const message = await openAsset(origin, project.id, asset);
          if (message !== undefined) {
            modelDialog(origin, project, list, { error: messageText(message), selected: asset.id });
          }
        });
      }
    });
  }
  if (hasMoreModels(list)) {
    buttons.push('vulpes.button.load_more');
    actions.push((selected) => {
      runAction(() => loadMore(origin, project, list, selected));
    });
  }
  buttons.push('vulpes.button.back');
  actions.push(() => {
    runAction(() => showProjects(origin, project.id));
  });
  const cancelIndex = buttons.length;
  buttons.push('dialog.cancel');
  actions.push(() => undefined);

  const lines = [
    state.error ??
      (list.totalSize === 0
        ? tl('vulpes.open.no_models')
        : tl('vulpes.open.count', [project.displayName, String(list.items.length), String(list.totalSize)])),
  ];
  const form: { form?: Record<string, FormField> } =
    first === undefined
      ? {}
      : { form: { model: { label: tl('vulpes.field.model'), type: 'select', options, value: state.selected ?? first.id } } };

  const dialog: Dialog = new Dialog('vulpes_open_model', {
    title: tl('vulpes.open.model_title', [project.displayName]),
    lines,
    ...form,
    buttons,
    confirmIndex: 0,
    cancelIndex,
    onButton(index) {
      const action = actions[index];
      if (action === undefined) {
        return undefined;
      }
      const selected = first === undefined ? undefined : fieldText(dialog.getFormResult(), 'model');
      dialog.hide();
      action(selected);
      return false;
    },
  });
  dialog.show();
}

async function loadMore(origin: Origin, project: ProjectSummary, list: ModelList, selected: string | undefined): Promise<void> {
  const result = await loadNextModelPage(clientFor(origin.baseUrl), project.id, list);
  if (!result.ok) {
    modelDialog(origin, project, list, { error: messageText(describeFailure(result.failure)), ...optionalSelected(selected) });
    return;
  }
  modelDialog(origin, project, result.value, optionalSelected(selected));
}

function optionalSelected(selected: string | undefined): DialogState {
  return selected === undefined ? {} : { selected };
}
