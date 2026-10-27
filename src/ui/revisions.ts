// The Blockbench side of the revision feature: the "Save to Vulpes with comment" action,
// the host of the "Revisions" panel section, opening a revision as a read-only snapshot,
// and restoring one. The rules live in src/revisions/; this file only reads the project and
// shows dialogs.

import { isRevisionsUnavailable, revisionFailureMessage } from '../revisions/availability';
import { fileNameForKey } from '../link/display-name';
import type { LinkRecord } from '../link/link-state';
import { formatIdOf } from '../model/format';
import { isRecord, parseJsonText } from '../json';
import { describeFailure, type ApiFailure } from '../problem';
import type { RevisionSummary } from '../revisions/dto';
import type { RevisionsFailure, RevisionsHost } from '../revisions/controller';
import { REVISION_PAGE_SIZE } from '../revisions/paging';
import { planRestore, restoreRevision } from '../revisions/restore';
import { snapshotName } from '../revisions/snapshot';
import { clientFor, messageText, runAction } from './remote-context';
import { errorMessage, confirmMessage, conflictMessage, quickMessage } from './feedback';
import { emitVulpesChange } from './change-bus';
import { askCopyKey, loadLatestInto, saveCurrentToVulpes } from './save-codec';
import { attachLink, heldRecord, linkOf } from './project-link';

/** The record of the open project, when it is linked. Restores and snapshots need it. */
function linkedRecord(): { readonly project: BlockbenchProject; readonly record: LinkRecord } | undefined {
  const project = Project;
  if (project === null || project === undefined) {
    return undefined;
  }
  const linked = linkOf(project);
  const held = heldRecord(project);
  return linked === undefined || held === undefined ? undefined : { project, record: held };
}

/** Registers the "Save to Vulpes with comment..." action in the File menu. The returned function removes it. */
export function registerRevisionActions(): () => void {
  const action = new Action('vulpes_save_comment', {
    name: 'vulpes.action.save_comment',
    description: 'vulpes.action.save_comment.description',
    icon: 'history',
    category: 'file',
    click: () => {
      saveWithComment();
    },
  });
  MenuBar.addAction(action, 'file.#project');
  return () => {
    action.delete();
  };
}

/** Asks for a comment and saves the linked model with it. An empty answer saves without one; a cancelled prompt sends nothing. */
function saveWithComment(): void {
  const project = Project;
  if (project === null || project === undefined || linkOf(project) === undefined) {
    errorMessage(tl('vulpes.comment.not_linked'));
    return;
  }
  Blockbench.textPrompt(tl('vulpes.comment.title'), '', (text: unknown) => {
    if (typeof text !== 'string') {
      return;
    }
    const comment = text.trim();
    saveCurrentToVulpes(comment === '' ? undefined : comment);
  });
}

function revisionsFailure(failure: ApiFailure): RevisionsFailure {
  return isRevisionsUnavailable(failure) ? { kind: 'unavailable' } : { kind: 'message', message: messageText(describeFailure(failure)) };
}

/** Builds the host the "Revisions" section is created with. Each call reads the open project again. */
export function createRevisionsHost(): RevisionsHost {
  return {
    linkedKey: () => linkedRecord()?.record.key,

    listRevisions: async (page: number) => {
      const linked = linkedRecord();
      if (linked === undefined) {
        return { ok: false, failure: { kind: 'message', message: tl('vulpes.revisions.not_linked') } };
      }
      const { record } = linked;
      const result = await clientFor(record.baseUrl).listRevisions(record.projectId, record.assetId, page, REVISION_PAGE_SIZE);
      return result.ok ? { ok: true, value: result.value } : { ok: false, failure: revisionsFailure(result.failure) };
    },

    openRevision: async (revision: RevisionSummary) => {
      const linked = linkedRecord();
      if (linked === undefined) {
        errorMessage(tl('vulpes.revisions.linked_only'));
        return;
      }
      const { record } = linked;
      const result = await clientFor(record.baseUrl).readRevision(record.projectId, record.assetId, revision.id);
      if (!result.ok) {
        errorMessage(messageText(revisionFailureMessage(result.failure)));
        return;
      }
      const model = parseJsonText(result.value.text);
      if (!isRecord(model)) {
        errorMessage(tl('vulpes.open.not_model'));
        return;
      }
      const name = snapshotName(record.key, revision.number);
      const message = openSnapshot(model, fileNameForKey(record.key), name);
      if (message !== undefined) {
        errorMessage(message);
        return;
      }
      quickMessage(tl('vulpes.revisions.snapshot_opened', [name]));
    },

    restoreRevision: (revision: RevisionSummary) => {
      askRestore(revision);
      return Promise.resolve();
    },
  };
}

/** Confirms the restore with the designer, then sends it. Nothing is sent when the designer cancels. */
function askRestore(revision: RevisionSummary): void {
  const linked = linkedRecord();
  if (linked === undefined) {
    errorMessage(tl('vulpes.revisions.linked_only'));
    return;
  }
  const { project, record } = linked;
  const plan = planRestore(record.etag);
  if (plan.kind === 'refuse') {
    errorMessage(messageText(plan.message));
    return;
  }
  confirmMessage(
    tl('vulpes.revisions.restore_title', [String(revision.number)]),
    tl('vulpes.revisions.restore_message', [String(revision.number)]),
    tl('vulpes.revisions.restore_button'),
    () => {
      runAction(() => performRestore(project, record, revision, plan.ifMatch));
    },
  );
}

/** Parses the model as a project with no link: no export codec, no export path and no save path. */
function openSnapshot(model: Record<string, unknown>, parseName: string, name: string): string | undefined {
  try {
    setupProject(formatIdOf(model));
    Codecs.project.parse(model, parseName);
  } catch (error: unknown) {
    return tl('vulpes.parse_failed', [error instanceof Error ? error.message : 'unknown error']);
  }
  const opened = Project;
  if (opened === null || opened === undefined) {
    return tl('vulpes.not_opened');
  }
  opened.export_codec = '';
  opened.export_path = '';
  opened.save_path = '';
  opened.name = name;
  return undefined;
}

/** Restores one revision over the linked asset. A stale ETag offers the conflict choices of a save. */
async function performRestore(project: BlockbenchProject, record: LinkRecord, revision: RevisionSummary, ifMatch: string): Promise<void> {
  const outcome = await restoreRevision(clientFor(record.baseUrl), { projectId: record.projectId, assetId: record.assetId }, revision.id, ifMatch);
  switch (outcome.kind) {
    case 'restored': {
      const restored: LinkRecord = { ...record, etag: outcome.etag };
      attachLink(project, restored);
      emitVulpesChange();
      quickMessage(tl('vulpes.revisions.restored', [String(revision.number)]));
      askReload(project, restored);
      return;
    }
    case 'conflict': {
      const currentEtag = outcome.currentEtag;
      conflictMessage({
        overwrite:
          currentEtag === undefined
            ? undefined
            : () => {
                runAction(() => performRestore(project, record, revision, currentEtag));
              },
        loadLatest: () => {
          confirmMessage(tl('vulpes.load_latest.title'), tl('vulpes.load_latest.message'), tl('vulpes.load_latest.button'), () => {
            runAction(() => loadLatestInto(project, record));
          });
        },
        saveCopy: () => {
          askCopyKey(project, record, Codecs.project.compile(), '', undefined);
        },
      });
      return;
    }
    case 'failed':
      errorMessage(messageText(outcome.message));
      return;
  }
}

/** Asks whether the open project should show the restored content. Unsaved changes are named as lost. */
function askReload(project: BlockbenchProject, record: LinkRecord): void {
  confirmMessage(
    tl('vulpes.revisions.reload_title'),
    tl(project.saved ? 'vulpes.revisions.reload_message' : 'vulpes.revisions.reload_unsaved'),
    tl('vulpes.revisions.reload_button'),
    () => {
      runAction(() => loadLatestInto(project, record));
    },
    () => {
      quickMessage(tl('vulpes.revisions.reload_kept'));
    },
  );
}
