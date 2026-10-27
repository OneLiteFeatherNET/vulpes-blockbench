// Paging of the revision list. The list is immutable: a failed page request leaves the
// list the caller already has in use.

import type { Page } from '../api/dto';
import type { RevisionSummary } from './dto';

/** The number of revisions requested per page. */
export const REVISION_PAGE_SIZE = 20;

export interface RevisionList {
  readonly items: readonly RevisionSummary[];
  readonly totalSize: number;
  /** The zero-based index of the page to request next. */
  readonly nextPage: number;
  /** Set when a page came back empty, so a backend that reports a larger total cannot keep the list open. */
  readonly exhausted: boolean;
}

export function emptyRevisionList(): RevisionList {
  return { items: [], totalSize: 0, nextPage: 0, exhausted: false };
}

export function appendRevisionPage(list: RevisionList, page: Page<RevisionSummary>): RevisionList {
  return {
    items: [...list.items, ...page.items],
    totalSize: page.totalSize,
    nextPage: list.nextPage + 1,
    exhausted: page.items.length === 0,
  };
}

export function hasMoreRevisions(list: RevisionList): boolean {
  return !list.exhausted && list.items.length < list.totalSize;
}
