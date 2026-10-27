// "Save to Vulpes" for a model that is not linked yet: pick a project, enter a key,
// create the asset. A model that is already linked saves with Ctrl+S instead.

import type { ProjectSummary } from '../api/dto';
import type { EnvironmentService } from '../environment/service';
import type { UserMessage } from '../problem';
import { describeFailure } from '../problem';
import { listAllProjects } from '../remote/catalog';
import { normalizeKey } from '../remote/key';
import { createLinked } from '../remote/save';
import { notify } from './notify';
import { linkOf, setLink } from './project-link';
import { clientFor, configuredBaseUrl, fieldText, messageText, runAction } from './remote-context';

interface NewModelContext {
  readonly project: BlockbenchProject;
  readonly baseUrl: string;
  readonly projects: readonly ProjectSummary[];
}

interface NewModelState {
  readonly projectId?: string;
  readonly key: string;
  readonly error?: UserMessage;
}

export async function startSaveNewToVulpes(service: EnvironmentService): Promise<void> {
  const project = Project;
  if (project === null || project === undefined) {
    notify('Open or create a model first.');
    return;
  }
  if (linkOf(project) !== undefined) {
    notify('This model is already linked to Vulpes. Use Ctrl+S to save it.');
    return;
  }
  const baseUrl = configuredBaseUrl(service);
  if (baseUrl === undefined) {
    return;
  }
  const result = await listAllProjects(clientFor(baseUrl));
  if (!result.ok) {
    notify(messageText(describeFailure(result.failure)));
    return;
  }
  if (result.value.length === 0) {
    notify('Create a project in Vulpes first.');
    return;
  }
  newModelDialog({ project, baseUrl, projects: result.value }, { key: '' });
}

function newModelDialog(context: NewModelContext, state: NewModelState): void {
  const first = context.projects[0];
  if (first === undefined) {
    return;
  }
  const options: Record<string, string> = {};
  for (const project of context.projects) {
    options[project.id] = `${project.displayName} (${project.key})`;
  }
  const keyError = state.error?.field === 'key' ? messageText(state.error) : undefined;
  const otherError = state.error !== undefined && keyError === undefined ? messageText(state.error) : undefined;
  const dialog: Dialog = new Dialog('vulpes_save_new', {
    title: 'Save to Vulpes as a new model',
    lines: otherError === undefined ? ['Keys look like vulpes:item/ruby.'] : [otherError],
    form: {
      project: { label: 'Project', type: 'select', options, value: state.projectId ?? first.id },
      key: { label: keyError === undefined ? 'Key' : `Key: ${keyError}`, type: 'text', value: state.key },
    },
    buttons: ['Save to Vulpes', 'Cancel'],
    confirmIndex: 0,
    cancelIndex: 1,
    onConfirm(result) {
      const projectId = fieldText(result, 'project');
      const check = normalizeKey(fieldText(result, 'key') ?? '');
      if (projectId === undefined) {
        return false;
      }
      if (!check.ok) {
        notify('Enter a key first, for example vulpes:item/ruby.');
        return false;
      }
      dialog.hide();
      runAction(() => createNewModel(context, projectId, check.key));
      return false;
    },
  });
  dialog.show();
}

async function createNewModel(context: NewModelContext, projectId: string, key: string): Promise<void> {
  if (Project !== context.project) {
    notify('Switch back to the model you want to save, then try again.');
    return;
  }
  const text = Codecs.project.compile();
  const outcome = await createLinked(clientFor(context.baseUrl), { baseUrl: context.baseUrl, projectId }, key, text);
  if (outcome.kind === 'failed') {
    newModelDialog(context, { projectId, key, error: outcome.message });
    return;
  }
  setLink(context.project, outcome.reference);
  context.project.saved = true;
  notify(`Saved to Vulpes as ${key}.`);
}
