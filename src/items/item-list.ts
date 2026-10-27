// Reads the item lists the assignment needs, one page after another, and filters the
// items in the plugin: the Vulpes API has no search for items.

import type { ApiResult, VulpesClient } from '../api/client';
import type { Page } from '../api/dto';
import type { ComponentEntry, ItemSummary } from './item-dto';

export const ITEM_PAGE_SIZE = 50;

/** Case-insensitive. A blank query matches every item. The name and the key are both searched. */
export function matchesItemSearch(item: ItemSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  return item.uiName.toLowerCase().includes(needle) || item.key.toLowerCase().includes(needle);
}

export function visibleItems(items: readonly ItemSummary[], query: string): readonly ItemSummary[] {
  return items.filter((item) => matchesItemSearch(item, query));
}

/** Reads every page. Stops at an empty page, so a backend that never runs out cannot loop forever. */
async function readAllPages<T>(readPage: (page: number) => Promise<ApiResult<Page<T>>>): Promise<ApiResult<T[]>> {
  const items: T[] = [];
  let page = 0;
  let done = false;
  while (!done) {
    const result = await readPage(page);
    if (!result.ok) {
      return { ok: false, failure: result.failure };
    }
    items.push(...result.value.items);
    page += 1;
    done = result.value.items.length === 0 || items.length >= result.value.totalSize;
  }
  return { ok: true, value: items };
}

export function listAllItems(client: VulpesClient, projectId: string): Promise<ApiResult<ItemSummary[]>> {
  return readAllPages((page) => client.listItems(projectId, page, ITEM_PAGE_SIZE));
}

export function listAllComponents(client: VulpesClient, itemId: string): Promise<ApiResult<ComponentEntry[]>> {
  return readAllPages((page) => client.listComponents(itemId, page, ITEM_PAGE_SIZE));
}
