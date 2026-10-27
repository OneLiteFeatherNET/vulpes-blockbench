// "Open from Vulpes": project dialog, then a paged model dialog. The model opens as
// a normal Blockbench project that carries its remote reference.

import type { AssetSummary, ProjectSummary } from '../api/dto';
import type { EnvironmentService } from '../environment/service';
import { isRecord, parseJsonText } from '../json';
import { formatIdOf } from '../model/format';
import { describeFailure } from '../problem';
import { listAllProjects, loadNextModelPage } from '../remote/catalog';
import { emptyModelList, hasMoreModels, type ModelList } from '../remote/model-list';
import type { RemoteReference } from '../remote/reference';
import { notify } from './notify';
import { setLink } from './project-link';
import { clientFor, configuredBaseUrl, fieldText, messageText, runAction } from './remote-context';

interface OpenSession {
  readonly baseUrl: string;
}

export async function startOpenFromVulpes(service: EnvironmentService): Promise<void> {
  const baseUrl = configuredBaseUrl(service);
  if (baseUrl === undefined) {
    return;
  }
  await showProjects({ baseUrl }, undefined);
}

async function showProjects(session: OpenSession, selected: string | undefined): Promise<void> {
  const result = await listAllProjects(clientFor(session.baseUrl));
  if (!result.ok) {
    notify(messageText(describeFailure(result.failure)));
    return;
  }
  if (result.value.length === 0) {
    notify('There are no projects in Vulpes.');
    return;
  }
  projectDialog(session, result.value, selected);
}

function projectDialog(session: OpenSession, projects: readonly ProjectSummary[], selected: string | undefined): void {
  const first = projects[0];
  if (first === undefined) {
    return;
  }
  const options: Record<string, string> = {};
  for (const project of projects) {
    options[project.id] = `${project.displayName} (${project.key})`;
  }
  const dialog: Dialog = new Dialog('vulpes_open_project', {
    title: 'Open from Vulpes: choose a project',
    form: { project: { label: 'Project', type: 'select', options, value: selected ?? first.id } },
    buttons: ['Next', 'Cancel'],
    confirmIndex: 0,
    cancelIndex: 1,
    onConfirm(result) {
      const chosen = projects.find((project) => project.id === fieldText(result, 'project'));
      if (chosen === undefined) {
        return false;
      }
      dialog.hide();
      runAction(() => startModels(session, chosen));
      return false;
    },
  });
  dialog.show();
}

async function startModels(session: OpenSession, project: ProjectSummary): Promise<void> {
  const result = await loadNextModelPage(clientFor(session.baseUrl), project.id, emptyModelList());
  if (!result.ok) {
    modelDialog(session, project, emptyModelList(), { error: messageText(describeFailure(result.failure)) });
    return;
  }
  modelDialog(session, project, result.value, {});
}

interface DialogState {
  readonly error?: string;
  readonly selected?: string;
}

function modelDialog(session: OpenSession, project: ProjectSummary, list: ModelList, state: DialogState): void {
  const first = list.items[0];
  const options: Record<string, string> = {};
  for (const asset of list.items) {
    options[asset.id] = `${asset.key} (${asset.fileName})`;
  }
  const actions: ((selected: string | undefined) => void)[] = [];
  const buttons: string[] = [];
  if (first !== undefined) {
    buttons.push('Open');
    actions.push((selected) => {
      const asset = list.items.find((item) => item.id === selected);
      if (asset !== undefined) {
        runAction(() => openModel(session, project, list, asset));
      }
    });
  }
  if (hasMoreModels(list)) {
    buttons.push('Load more');
    actions.push((selected) => {
      runAction(() => loadMore(session, project, list, selected));
    });
  }
  buttons.push('Back');
  actions.push(() => {
    runAction(() => showProjects(session, project.id));
  });
  const cancelIndex = buttons.length;
  buttons.push('Cancel');
  actions.push(() => undefined);

  const lines = state.error !== undefined
    ? [state.error]
    : [list.totalSize === 0 ? 'This project has no Blockbench models yet.' : `${project.displayName}: ${String(list.items.length)} of ${String(list.totalSize)} models.`];
  const form: { form?: Record<string, FormField> } = first === undefined
    ? {}
    : { form: { model: { label: 'Model', type: 'select', options, value: state.selected ?? first.id } } };

  const dialog: Dialog = new Dialog('vulpes_open_model', {
    title: `Open from Vulpes: ${project.displayName}`,
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

async function loadMore(session: OpenSession, project: ProjectSummary, list: ModelList, selected: string | undefined): Promise<void> {
  const result = await loadNextModelPage(clientFor(session.baseUrl), project.id, list);
  if (!result.ok) {
    modelDialog(session, project, list, { error: messageText(describeFailure(result.failure)), ...optionalSelected(selected) });
    return;
  }
  modelDialog(session, project, result.value, optionalSelected(selected));
}

function optionalSelected(selected: string | undefined): DialogState {
  return selected === undefined ? {} : { selected };
}

async function openModel(session: OpenSession, project: ProjectSummary, list: ModelList, asset: AssetSummary): Promise<void> {
  const result = await clientFor(session.baseUrl).readModel(project.id, asset.id);
  if (!result.ok) {
    const { failure } = result;
    if (failure.kind === 'problem' && failure.problem.code === 'PROJECT_NOT_FOUND') {
      notify(messageText(describeFailure(failure)));
      await showProjects(session, undefined);
      return;
    }
    modelDialog(session, project, list, { error: messageText(describeFailure(failure)), selected: asset.id });
    return;
  }
  const model = parseJsonText(result.value.text);
  if (!isRecord(model)) {
    modelDialog(session, project, list, { error: 'The model in Vulpes is not a Blockbench model.', selected: asset.id });
    return;
  }
  const reference: RemoteReference = {
    baseUrl: session.baseUrl,
    projectId: project.id,
    assetId: asset.id,
    key: asset.key,
    etag: result.value.etag,
  };
  placeProject(model, asset.fileName, reference);
}

/** Opens the model as a new project. Parse errors in Blockbench become a notice. */
function placeProject(model: Record<string, unknown>, fileName: string, reference: RemoteReference): void {
  try {
    setupProject(formatIdOf(model));
    Codecs.project.parse(model, '');
  } catch (error: unknown) {
    notify(`Blockbench could not open this model: ${error instanceof Error ? error.message : 'unknown error'}`);
    return;
  }
  const opened = Project;
  if (opened === null || opened === undefined) {
    notify('Blockbench did not open the model.');
    return;
  }
  opened.name = fileName.replace(/\.bbmodel$/u, '');
  setLink(opened, reference);
  opened.saved = true;
  notify(`Opened ${reference.key} from Vulpes.`);
}
