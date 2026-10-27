// Ctrl+S and File > Save for a linked project, and the conflict dialog that opens
// when Vulpes has a newer version. Nothing is overwritten without the designer's choice.

import type { EnvironmentService } from '../environment/service';
import { parseJsonText, isRecord } from '../json';
import { formatIdOf } from '../model/format';
import type { UserMessage } from '../problem';
import type { RemoteReference } from '../remote/reference';
import { createLinked, loadLatest, overwriteLinked, saveLinked, type SaveOutcome } from '../remote/save';
import { notify } from './notify';
import { setLink } from './project-link';
import { clientFor, fieldText, runAction, savedNotice } from './remote-context';

/** Saves the linked project to the origin of its reference, never to the active environment. */
export function saveLinkedProject(service: EnvironmentService, project: BlockbenchProject, reference: RemoteReference): void {
  runAction(async () => {
    const text = Codecs.project.compile();
    const outcome = await saveLinked(clientFor(reference.baseUrl), reference, text);
    applyOutcome(service, project, text, reference, outcome);
  });
}

function applyOutcome(
  service: EnvironmentService,
  project: BlockbenchProject,
  text: string,
  reference: RemoteReference,
  outcome: SaveOutcome,
): void {
  switch (outcome.kind) {
    case 'saved':
      setLink(project, outcome.reference);
      project.saved = true;
      notify(savedNotice(service, outcome.reference));
      return;
    case 'conflict':
      openConflictDialog(service, project, text, reference, outcome.currentEtag);
      return;
    case 'failed':
      notify(outcome.message.text);
      return;
  }
}

interface Choice {
  readonly label: string;
  readonly run: () => void;
}

function openConflictDialog(
  service: EnvironmentService,
  project: BlockbenchProject,
  text: string,
  reference: RemoteReference,
  currentEtag: string | undefined,
): void {
  const choices: Choice[] = [];
  // Overwrite needs the ETag of the 412 response. Without it the replacement cannot be sent safely.
  if (currentEtag !== undefined) {
    choices.push({
      label: 'Overwrite',
      run: () => {
        runAction(async () => {
          const outcome = await overwriteLinked(clientFor(reference.baseUrl), reference, text, currentEtag);
          applyOutcome(service, project, text, reference, outcome);
        });
      },
    });
  }
  choices.push({
    label: 'Load latest',
    run: () => {
      confirmLoadLatest(project, reference);
    },
  });
  choices.push({
    label: 'Save as copy',
    run: () => {
      askCopyKey(service, project, text, reference, '', undefined);
    },
  });

  // Enter and Escape both mean Cancel, so a stray Enter never overwrites.
  const cancelIndex = choices.length;
  const dialog: Dialog = new Dialog('vulpes_conflict', {
    title: 'The model changed in Vulpes',
    lines: [
      'Someone saved this model in Vulpes after you opened it.',
      'Overwrite replaces that version. Load latest discards your local changes. Save as copy keeps both.',
    ],
    buttons: [...choices.map((choice) => choice.label), 'Cancel'],
    confirmIndex: cancelIndex,
    cancelIndex,
    onButton(index) {
      const choice = choices[index];
      if (choice === undefined) {
        return undefined;
      }
      dialog.hide();
      choice.run();
      return false;
    },
  });
  dialog.show();
}

function confirmLoadLatest(project: BlockbenchProject, reference: RemoteReference): void {
  const dialog: Dialog = new Dialog('vulpes_load_latest', {
    title: 'Load the latest version from Vulpes?',
    lines: ['Your local changes to this model will be lost.'],
    buttons: ['Load latest', 'Cancel'],
    confirmIndex: 0,
    cancelIndex: 1,
    onConfirm() {
      dialog.hide();
      runAction(() => loadLatestInto(project, reference));
    },
  });
  dialog.show();
}

/** Replaces the local project with the latest version. The designer confirmed that local changes are lost. */
async function loadLatestInto(project: BlockbenchProject, reference: RemoteReference): Promise<void> {
  const outcome = await loadLatest(clientFor(reference.baseUrl), reference);
  if (outcome.kind === 'failed') {
    notify(outcome.message.text);
    return;
  }
  const model = parseJsonText(outcome.text);
  if (!isRecord(model)) {
    notify('The latest version in Vulpes is not a Blockbench model. The local model was kept.');
    return;
  }
  const name = project.name;
  project.select();
  const closed = await project.close(true);
  if (!closed) {
    notify('The local model was kept.');
    return;
  }
  setupProject(formatIdOf(model));
  Codecs.project.parse(model, '');
  const fresh = Project;
  if (fresh === null || fresh === undefined) {
    return;
  }
  fresh.name = name;
  setLink(fresh, outcome.reference);
  fresh.saved = true;
  notify('Loaded the latest version from Vulpes.');
}

/** Asks for a new key and creates a copy. The original asset in Vulpes is not changed. */
function askCopyKey(
  service: EnvironmentService,
  project: BlockbenchProject,
  text: string,
  reference: RemoteReference,
  prefill: string,
  error: UserMessage | undefined,
): void {
  const keyError = error?.field === 'key' ? error.text : undefined;
  const otherError = error !== undefined && keyError === undefined ? error.text : undefined;
  const dialog: Dialog = new Dialog('vulpes_save_copy', {
    title: 'Save as copy in Vulpes',
    lines: otherError === undefined ? ['The original model in Vulpes stays as it is.'] : [otherError],
    form: {
      key: { label: keyError === undefined ? 'New key' : `New key: ${keyError}`, type: 'text', value: prefill },
    },
    buttons: ['Save copy', 'Cancel'],
    confirmIndex: 0,
    cancelIndex: 1,
    onConfirm(result) {
      const raw = fieldText(result, 'key') ?? '';
      const key = raw.trim();
      if (key === '') {
        notify('Enter a key for the copy first.');
        return false;
      }
      dialog.hide();
      runAction(async () => {
        const outcome = await createLinked(
          clientFor(reference.baseUrl),
          { baseUrl: reference.baseUrl, projectId: reference.projectId },
          key,
          text,
        );
        if (outcome.kind === 'failed') {
          askCopyKey(service, project, text, reference, key, outcome.message);
          return;
        }
        setLink(project, outcome.reference);
        project.saved = true;
        notify(`Saved a copy to Vulpes as ${key}. The original is unchanged.`);
      });
      return false;
    },
  });
  dialog.show();
}
