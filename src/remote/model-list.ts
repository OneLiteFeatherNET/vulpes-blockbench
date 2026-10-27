import type { AssetSummary } from '../api/dto';

/** The number of models requested per page. */
export const MODEL_PAGE_SIZE = 50;

export interface ModelList {
  readonly items: readonly AssetSummary[];
  readonly totalSize: number;
  /** The zero-based index of the page to request next. */
  readonly nextPage: number;
}

export function emptyModelList(): ModelList {
  return { items: [], totalSize: 0, nextPage: 0 };
}

/** Adds one page to the list. The list is immutable, so a failed page request leaves the old list in use. */
export function appendPage(list: ModelList, page: { readonly items: readonly AssetSummary[]; readonly totalSize: number }): ModelList {
  return {
    items: [...list.items, ...page.items],
    totalSize: page.totalSize,
    nextPage: list.nextPage + 1,
  };
}

export function hasMoreModels(list: ModelList): boolean {
  return list.items.length < list.totalSize;
}
