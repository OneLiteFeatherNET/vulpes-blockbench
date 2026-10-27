// The save codec `vulpes`. Blockbench's own "Save Model" (Ctrl+S) calls it for a project
// whose export codec is `vulpes`, so no click of a built-in action is replaced. The
// codec never touches the file system: it sends the replacement to the asset of its
// export path, with the ETag the plugin holds, or it refuses.

import { parseJsonText, isRecord } from '../json';
import { decideWrite } from '../link/link-state';
import { parseVulpesPath } from '../link/vulpes-path';
import type { LinkRecord } from '../link/link-state';
import type { RemoteReference } from '../remote/reference';
import { createLinked, loadLatest, overwriteLinked, saveLinked, type SaveOutcome } from '../remote/save';
import { emitVulpesChange } from './change-bus';
import { conflictMessage, confirmMessage, errorMessage, quickMessage } from './feedback';
import { placeModel } from './place-model';
import { attachLink, detachLink, heldRecord, VULPES_CODEC } from './project-link';
import { clientFor, environmentName, fieldText, messageText, runAction } from './remote-context';

/** Registers the codec. The returned function removes it again. */
export function registerVulpesCodec(): () => void {
  const codec = new Codec(VULPES_CODEC, {
    name: tl('vulpes.codec.name'),
    remember: false,
    extension: 'bbmodel',
    compile: () => Codecs.project.compile(),
    write: (content: string, path: string) => {
      const project = Project;
      if (project !== null && project !== undefined) {
        writeLinked(project, content, path);
      }
    },
  });
  return () => {
    codec.delete();
  };
}

/** Saves the current project to its origin. Used by the panel and the comment action; Ctrl+S reaches the same path through the codec without a comment. */
export function saveCurrentToVulpes(comment?: string): void {
  const project = Project;
  if (project === null || project === undefined) {
    return;
  }
  writeLinked(project, Codecs.project.compile(), project.export_path, comment);
}

function writeLinked(project: BlockbenchProject, content: string, path: string, comment?: string): void {
  const decision = decideWrite({ localSavePath: project.save_path, path: parseVulpesPath(path), record: heldRecord(project) });
  switch (decision.kind) {
    case 'unlink':
      detachLink(project);
      emitVulpesChange();
      quickMessage(tl('vulpes.unlinked'));
      return;
    case 'refuse':
      errorMessage(tl(decision.reason === 'invalid-path' ? 'vulpes.problem.invalid_path' : 'vulpes.problem.refused'));
      return;
    case 'replace': {
      const record = decision.record;
      runAction(async () => {
        const outcome = await saveLinked(clientFor(record.baseUrl), record, content, comment);
        applyOutcome(project, record, content, outcome, comment);
      });
      return;
    }
  }
}

function withEnvironment(reference: RemoteReference, record: LinkRecord): LinkRecord {
  return { ...reference, environment: record.environment };
}

function applyOutcome(project: BlockbenchProject, record: LinkRecord, content: string, outcome: SaveOutcome, comment?: string): void {
  switch (outcome.kind) {
    case 'saved':
      attachLink(project, withEnvironment(outcome.reference, record));
      project.saved = true;
      emitVulpesChange();
      quickMessage(tl('vulpes.saved', [record.key, environmentName(record.environment)]));
      return;
    case 'conflict': {
      // Overwrite needs the ETag of the 412 response. Without it the replacement cannot be sent safely.
      const currentEtag = outcome.currentEtag;
      conflictMessage({
        overwrite:
          currentEtag === undefined
            ? undefined
            : () => {
                runAction(async () => {
                  const next = await overwriteLinked(clientFor(record.baseUrl), record, content, currentEtag, comment);
                  applyOutcome(project, record, content, next, comment);
                });
              },
        loadLatest: () => {
          confirmMessage(tl('vulpes.load_latest.title'), tl('vulpes.load_latest.message'), tl('vulpes.load_latest.button'), () => {
            runAction(() => loadLatestInto(project, record));
          });
        },
        saveCopy: () => {
          askCopyKey(project, record, content, '', undefined);
        },
      });
      return;
    }
    case 'failed':
      errorMessage(messageText(outcome.message));
      return;
  }
}

/** Replaces the local project with the latest version. The designer confirmed that local changes are lost. */
export async function loadLatestInto(project: BlockbenchProject, record: LinkRecord): Promise<void> {
  const outcome = await loadLatest(clientFor(record.baseUrl), record);
  if (outcome.kind === 'failed') {
    errorMessage(messageText(outcome.message));
    return;
  }
  const model = parseJsonText(outcome.text);
  if (!isRecord(model)) {
    errorMessage(tl('vulpes.latest_not_model'));
    return;
  }
  project.select();
  const closed = await project.close(true);
  if (!closed) {
    errorMessage(tl('vulpes.keep_local'));
    return;
  }
  const message = placeModel(model, withEnvironment(outcome.reference, record));
  if (message === undefined) {
    quickMessage(tl('vulpes.loaded_latest'));
  } else {
    errorMessage(messageText(message));
  }
}

/** Asks for a new key and creates a copy. The original asset in Vulpes is not changed. */
export function askCopyKey(project: BlockbenchProject, record: LinkRecord, content: string, prefill: string, error: string | undefined): void {
  const dialog: Dialog = new Dialog('vulpes_save_copy', {
    title: 'vulpes.copy.title',
    lines: [error ?? tl('vulpes.copy.hint')],
    form: {
      key: { label: tl('vulpes.field.new_key'), type: 'text', value: prefill },
    },
    buttons: ['vulpes.copy.button', 'dialog.cancel'],
    confirmIndex: 0,
    cancelIndex: 1,
    onConfirm(result) {
      const key = (fieldText(result, 'key') ?? '').trim();
      if (key === '') {
        errorMessage(tl('vulpes.copy.key_required'));
        return false;
      }
      dialog.hide();
      runAction(async () => {
        const outcome = await createLinked(clientFor(record.baseUrl), { baseUrl: record.baseUrl, projectId: record.projectId }, key, content);
        if (outcome.kind === 'failed') {
          askCopyKey(project, record, content, key, messageText(outcome.message));
          return;
        }
        attachLink(project, withEnvironment(outcome.reference, record));
        project.saved = true;
        emitVulpesChange();
        quickMessage(tl('vulpes.copy_saved', [key]));
      });
      return false;
    },
  });
  dialog.show();
}

