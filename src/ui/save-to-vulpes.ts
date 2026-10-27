// "Save to Vulpes..." for a model that is not linked yet: pick a project, enter a key,
// create the asset. A linked model saves with Ctrl+S instead.

import type { ProjectSummary } from '../api/dto';
import type { EnvironmentService } from '../environment/service';
import { normalizeKey } from '../remote/key';
import { createLinked } from '../remote/save';
import { describeFailure, type UserMessage } from '../problem';
import { listAllProjects } from '../remote/catalog';
import { emitVulpesChange } from './change-bus';
import { errorMessage, quickMessage } from './feedback';
import { attachLink, linkOf } from './project-link';
import { clientFor, environmentName, fieldText, messageText, notConfigured, originOf, runAction, type Origin } from './remote-context';

interface NewModelContext {
  readonly project: BlockbenchProject;
  readonly origin: Origin;
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
    errorMessage(tl('vulpes.save_new.no_model'));
    return;
  }
  if (linkOf(project) !== undefined) {
    errorMessage(tl('vulpes.save_new.already_linked'));
    return;
  }
  const origin = originOf(service);
  if (origin === undefined) {
    errorMessage(messageText(notConfigured(service)));
    return;
  }
  const result = await listAllProjects(clientFor(origin.baseUrl));
  if (!result.ok) {
    errorMessage(messageText(describeFailure(result.failure)));
    return;
  }
  if (result.value.length === 0) {
    errorMessage(tl('vulpes.save_new.no_projects'));
    return;
  }
  newModelDialog({ project, origin, projects: result.value }, { key: '' });
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
    title: 'vulpes.save_new.title',
    lines: [otherError ?? tl('vulpes.save_new.hint')],
    form: {
      project: { label: tl('vulpes.field.project'), type: 'select', options, value: state.projectId ?? first.id },
      key: { label: keyError === undefined ? tl('vulpes.field.key') : tl('vulpes.field.key_error', [keyError]), type: 'text', value: state.key },
    },
    buttons: ['vulpes.save_new.button', 'dialog.cancel'],
    confirmIndex: 0,
    cancelIndex: 1,
    onConfirm(result) {
      const projectId = fieldText(result, 'project');
      const check = normalizeKey(fieldText(result, 'key') ?? '');
      if (projectId === undefined) {
        return false;
      }
      if (!check.ok) {
        errorMessage(tl('vulpes.save_new.key_required'));
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
    errorMessage(tl('vulpes.save_new.switch_back'));
    return;
  }
  const text = Codecs.project.compile();
  const outcome = await createLinked(clientFor(context.origin.baseUrl), { baseUrl: context.origin.baseUrl, projectId }, key, text);
  if (outcome.kind === 'failed') {
    newModelDialog(context, { projectId, key, error: outcome.message });
    return;
  }
  attachLink(context.project, { ...outcome.reference, environment: context.origin.environment });
  context.project.saved = true;
  emitVulpesChange();
  quickMessage(tl('vulpes.saved_new', [key, environmentName(context.origin.environment)]));
}
