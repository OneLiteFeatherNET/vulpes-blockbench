import { describe, expect, it } from 'vitest';
import { createVulpesClient } from '../../src/api/client';
import { ITEM_PAGE_SIZE, listAllComponents, listAllItems, matchesItemSearch, visibleItems } from '../../src/items/item-list';
import type { ItemSummary } from '../../src/items/item-dto';
import { fakeFetch, unreachableFetch, type FakeFetch } from '../support/fake-fetch';

const BASE = 'http://localhost:8085';
const PROJECT_ID = '6f1c0000-0000-4000-8000-000000000002';
const ITEM_ID = '6f1c0000-0000-4000-8000-000000000003';

function item(index: number): ItemSummary {
  return { id: `i-${String(index)}`, uiName: `Item ${String(index)}`, key: `item_${String(index)}` };
}

function itemPage(from: number, count: number, totalSize: number): string {
  const content = Array.from({ length: count }, (_, offset) => {
    const entry = item(from + offset);
    return { id: entry.id, uiName: entry.uiName, key: entry.key };
  });
  return JSON.stringify({ content, pageable: {}, totalSize });
}

function componentPage(count: number, totalSize: number): string {
  const content = Array.from({ length: count }, (_, offset) => ({
    id: `c-${String(offset)}`,
    componentKey: `minecraft:test_${String(offset)}`,
    value: offset,
  }));
  return JSON.stringify({ content, pageable: {}, totalSize });
}

describe('matchesItemSearch', () => {
  const ruby: ItemSummary = { id: 'i-1', uiName: 'Ruby Sword', key: 'ruby_sword' };

  it('matches everything for a blank query', () => {
    expect(matchesItemSearch(ruby, '   '), 'a blank query').toBe(true);
  });

  it('matches part of the name, ignoring case', () => {
    expect(matchesItemSearch(ruby, 'SWORD'), 'the name').toBe(true);
  });

  it('matches part of the key', () => {
    expect(matchesItemSearch(ruby, 'ruby_'), 'the key').toBe(true);
  });

  it('rejects an item that matches neither name nor key', () => {
    expect(matchesItemSearch(ruby, 'shield'), 'the query').toBe(false);
  });
});

describe('visibleItems', () => {
  it('keeps the order of the items and drops the ones that do not match', () => {
    const items: ItemSummary[] = [
      { id: 'a', uiName: 'Apple', key: 'apple' },
      { id: 'b', uiName: 'Ruby', key: 'ruby' },
      { id: 'c', uiName: 'Pear', key: 'ruby_pear' },
    ];
    expect(visibleItems(items, 'ruby').map((entry) => entry.id), 'the ids').toEqual(['b', 'c']);
  });
});

describe('listAllItems', () => {
  it('reads every page of the project', async () => {
    const recorder: FakeFetch = fakeFetch((request) =>
      request.url.includes('page=0') ? { status: 200, body: itemPage(0, ITEM_PAGE_SIZE, ITEM_PAGE_SIZE + 1) } : { status: 200, body: itemPage(50, 1, 51) },
    );
    const client = createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
    const result = await listAllItems(client, PROJECT_ID);
    expect(result.ok && result.value.length, 'the number of items').toBe(51);
    expect(recorder.requests.length, 'the number of requests').toBe(2);
  });

  it('stops at an empty page even when the total says there are more', async () => {
    const recorder = fakeFetch(() => ({ status: 200, body: itemPage(0, 0, 60) }));
    const client = createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
    const result = await listAllItems(client, PROJECT_ID);
    expect(result.ok && result.value, 'the items').toEqual([]);
    expect(recorder.requests.length, 'the number of requests').toBe(1);
  });

  it('reports a failure of a later page', async () => {
    const recorder = fakeFetch((request) =>
      request.url.includes('page=0') ? { status: 200, body: itemPage(0, ITEM_PAGE_SIZE, ITEM_PAGE_SIZE + 1) } : { status: 503 },
    );
    const client = createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
    const result = await listAllItems(client, PROJECT_ID);
    expect(result.ok, 'ok').toBe(false);
  });

  it('reports an unreachable backend as a failure', async () => {
    const recorder = unreachableFetch('Failed to fetch');
    const client = createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
    const result = await listAllItems(client, PROJECT_ID);
    expect(result.ok ? undefined : result.failure.kind, 'the failure kind').toBe('unreachable');
  });
});

describe('listAllComponents', () => {
  it('reads every page of the components of the item', async () => {
    const recorder = fakeFetch((request) =>
      request.url.includes('page=0') ? { status: 200, body: componentPage(ITEM_PAGE_SIZE, ITEM_PAGE_SIZE + 2) } : { status: 200, body: componentPage(2, ITEM_PAGE_SIZE + 2) },
    );
    const client = createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
    const result = await listAllComponents(client, ITEM_ID);
    expect(result.ok && result.value.length, 'the number of components').toBe(ITEM_PAGE_SIZE + 2);
    expect(recorder.requests[1]?.url, 'the second page').toBe(`${BASE}/item/${ITEM_ID}/components?page=1&size=${String(ITEM_PAGE_SIZE)}`);
  });
});
