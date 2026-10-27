// The state of the "Revisions" section as a plain view model. The controller asks the host
// for pages and keeps only the latest answer of each request. It uses no Vue, no Blockbench
// and no timers, so Vitest runs it with a fake host.

import type { Page } from '../api/dto';
import type { RevisionSummary } from './dto';
import { appendRevisionPage, emptyRevisionList, hasMoreRevisions, type RevisionList } from './paging';

export type RevisionsStatus = 'not_linked' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface RevisionsView {
  readonly status: RevisionsStatus;
  /** The key of the linked model, or undefined when the open project is not linked. */
  readonly key: string | undefined;
  readonly items: readonly RevisionSummary[];
  readonly hasMore: boolean;
  readonly error: string | undefined;
  /** True while a revision is being opened or restored, so the buttons stay disabled. */
  readonly busy: boolean;
}

export type RevisionsFailure = { readonly kind: 'unavailable' } | { readonly kind: 'message'; readonly message: string };

export type RevisionPageAnswer = { readonly ok: true; readonly value: Page<RevisionSummary> } | { readonly ok: false; readonly failure: RevisionsFailure };

/** What the section needs from the Blockbench side. The host reports its own failures to the designer where a dialog is needed. */
export interface RevisionsHost {
  readonly linkedKey: () => string | undefined;
  /** Loads one zero-based page of the revisions of the linked model. */
  readonly listRevisions: (page: number) => Promise<RevisionPageAnswer>;
  readonly openRevision: (revision: RevisionSummary) => Promise<void>;
  readonly restoreRevision: (revision: RevisionSummary) => Promise<void>;
}

export interface RevisionsController {
  current(): RevisionsView;
  /** Reloads the first page for the linked model, or clears the section when nothing is linked. */
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  open(revision: RevisionSummary): Promise<void>;
  restore(revision: RevisionSummary): Promise<void>;
}

interface InternalState {
  readonly key: string | undefined;
  readonly list: RevisionList;
  readonly status: RevisionsStatus;
  readonly error: string | undefined;
  readonly busy: boolean;
}

function toView(state: InternalState): RevisionsView {
  return {
    status: state.status,
    key: state.key,
    items: state.list.items,
    hasMore: hasMoreRevisions(state.list),
    error: state.error,
    busy: state.busy,
  };
}

export function createRevisionsController(host: RevisionsHost, render: (view: RevisionsView) => void): RevisionsController {
  let state: InternalState = { key: undefined, list: emptyRevisionList(), status: 'not_linked', error: undefined, busy: false };
  // An answer counts only if no newer refresh started meanwhile.
  let generation = 0;

  function update(patch: Partial<InternalState>): void {
    state = { ...state, ...patch };
    render(toView(state));
  }

  async function fetchPage(page: number, base: RevisionList): Promise<void> {
    const current = generation;
    update({ status: 'loading', error: undefined });
    const answer = await host.listRevisions(page);
    if (current !== generation) {
      return;
    }
    if (answer.ok) {
      update({ status: 'ready', list: appendRevisionPage(base, answer.value), error: undefined });
    } else if (answer.failure.kind === 'unavailable') {
      update({ status: 'unavailable', list: emptyRevisionList(), error: undefined });
    } else {
      update({ status: 'error', error: answer.failure.message });
    }
  }

  return {
    current: () => toView(state),

    async refresh(): Promise<void> {
      generation++;
      const key = host.linkedKey();
      if (key === undefined) {
        update({ key: undefined, list: emptyRevisionList(), status: 'not_linked', error: undefined });
        return;
      }
      update({ key, list: emptyRevisionList() });
      await fetchPage(0, emptyRevisionList());
    },

    async loadMore(): Promise<void> {
      if (state.status === 'loading' || !hasMoreRevisions(state.list)) {
        return;
      }
      await fetchPage(state.list.nextPage, state.list);
    },

    async open(revision: RevisionSummary): Promise<void> {
      if (state.busy) {
        return;
      }
      update({ busy: true });
      try {
        await host.openRevision(revision);
      } finally {
        update({ busy: false });
      }
    },

    async restore(revision: RevisionSummary): Promise<void> {
      if (state.busy) {
        return;
      }
      update({ busy: true });
      try {
        await host.restoreRevision(revision);
      } finally {
        update({ busy: false });
      }
    },
  };
}
