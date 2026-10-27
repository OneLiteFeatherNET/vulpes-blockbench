import { describe, expect, it } from 'vitest';
import { createVulpesClient, type VulpesClient } from '../../src/api/client';
import type { HttpRequest } from '../../src/api/http';
import { fakeFetch, headerOf, type Canned } from '../support/fake-fetch';

const BASE = 'http://localhost:8085';
const PROJECT_ID = '6f1c0000-0000-4000-8000-000000000002';
const ITEM_ID = '6f1c0000-0000-4000-8000-000000000003';
const COMPONENT_ID = '6f1c0000-0000-4000-8000-000000000004';
const MODEL_KEY = 'vulpes:item/ruby';

const ITEM_PAGE = JSON.stringify({
  content: [{ id: ITEM_ID, uiName: 'Ruby', key: 'ruby', comment: '', groupName: 'gems' }],
  pageable: {},
  totalSize: 1,
});

const COMPONENT_BODY = JSON.stringify({ id: COMPONENT_ID, componentKey: 'minecraft:item_model', value: MODEL_KEY });

function clientWith(respond: (request: HttpRequest) => Canned): { client: VulpesClient; requests: HttpRequest[] } {
  const recorder = fakeFetch(respond);
  return { client: createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch }), requests: recorder.requests };
}

function bodyOf(request: HttpRequest | undefined): unknown {
  const text = request?.json ?? '';
  const parsed: unknown = JSON.parse(text);
  return parsed;
}

describe('listItems', () => {
  it('requests one page of items of the project', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: ITEM_PAGE }));
    await client.listItems(PROJECT_ID, 1, 50);
    expect(requests[0]?.method, 'the method').toBe('GET');
    expect(requests[0]?.url, 'the URL').toBe(`${BASE}/project/${PROJECT_ID}/item/?page=1&size=50`);
  });

  it('returns the id, name and key of each item', async () => {
    const { client } = clientWith(() => ({ status: 200, body: ITEM_PAGE }));
    const result = await client.listItems(PROJECT_ID, 0, 50);
    expect(result.ok && result.value.items, 'the items').toEqual([{ id: ITEM_ID, uiName: 'Ruby', key: 'ruby' }]);
  });

  it('sends no If-Match header', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: ITEM_PAGE }));
    await client.listItems(PROJECT_ID, 0, 50);
    expect(headerOf(requests[0] ?? { method: 'GET', url: '', headers: {} }, 'If-Match'), 'the If-Match header').toBeUndefined();
  });

  it('reports an unreadable 200 body as an unexpected response', async () => {
    const { client } = clientWith(() => ({ status: 200, body: '{"content":[{"id":"x"}],"totalSize":1}' }));
    const result = await client.listItems(PROJECT_ID, 0, 50);
    expect(result, 'the result').toEqual({ ok: false, failure: { kind: 'unexpected', status: 200 } });
  });
});

describe('listComponents', () => {
  it('requests one page of the components of the item', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: '{"content":[],"pageable":{},"totalSize":0}' }));
    await client.listComponents(ITEM_ID, 0, 50);
    expect(requests[0]?.url, 'the URL').toBe(`${BASE}/item/${ITEM_ID}/components?page=0&size=50`);
  });

  it('returns the id, key and value of each component', async () => {
    const body = JSON.stringify({
      content: [{ id: COMPONENT_ID, componentKey: 'minecraft:item_model', value: MODEL_KEY }],
      pageable: {},
      totalSize: 1,
    });
    const { client } = clientWith(() => ({ status: 200, body }));
    const result = await client.listComponents(ITEM_ID, 0, 50);
    expect(result.ok && result.value.items, 'the components').toEqual([
      { id: COMPONENT_ID, componentKey: 'minecraft:item_model', value: MODEL_KEY },
    ]);
  });
});

describe('createComponent', () => {
  it('puts the component to the component endpoint of the item, with componentKey and value only', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: COMPONENT_BODY }));
    await client.createComponent(ITEM_ID, 'minecraft:item_model', MODEL_KEY);
    const request = requests[0];
    expect(request?.method, 'the method').toBe('PUT');
    expect(request?.url, 'the URL').toBe(`${BASE}/item/${ITEM_ID}/component`);
    expect(bodyOf(request), 'the JSON body').toEqual({ componentKey: 'minecraft:item_model', value: MODEL_KEY });
    expect(headerOf(request ?? { method: 'PUT', url: '', headers: {} }, 'Content-Type'), 'the content type').toBe('application/json');
  });

  it('sends no If-Match header', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: COMPONENT_BODY }));
    await client.createComponent(ITEM_ID, 'minecraft:item_model', MODEL_KEY);
    expect(headerOf(requests[0] ?? { method: 'PUT', url: '', headers: {} }, 'If-Match'), 'the If-Match header').toBeUndefined();
  });

  it('returns the stored component from the response body', async () => {
    const { client } = clientWith(() => ({ status: 200, body: COMPONENT_BODY }));
    const result = await client.createComponent(ITEM_ID, 'minecraft:item_model', MODEL_KEY);
    expect(result.ok && result.value.id, 'the id').toBe(COMPONENT_ID);
  });

  it('returns the problem of a 409 response', async () => {
    const body = JSON.stringify({ title: 'Conflict', status: 409, code: 'RESOURCE_CONFLICT' });
    const { client } = clientWith(() => ({ status: 409, body }));
    const result = await client.createComponent(ITEM_ID, 'minecraft:item_model', MODEL_KEY);
    expect(result.ok ? undefined : result.failure.kind === 'problem' ? result.failure.problem.status : undefined, 'the status').toBe(409);
  });
});

describe('updateComponent', () => {
  it('posts the component with its id to the component endpoint of the item', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: COMPONENT_BODY }));
    await client.updateComponent(ITEM_ID, COMPONENT_ID, 'minecraft:item_model', MODEL_KEY);
    const request = requests[0];
    expect(request?.method, 'the method').toBe('POST');
    expect(request?.url, 'the URL').toBe(`${BASE}/item/${ITEM_ID}/component`);
    expect(bodyOf(request), 'the JSON body').toEqual({ id: COMPONENT_ID, componentKey: 'minecraft:item_model', value: MODEL_KEY });
  });

  it('sends no If-Match header', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: COMPONENT_BODY }));
    await client.updateComponent(ITEM_ID, COMPONENT_ID, 'minecraft:item_model', MODEL_KEY);
    expect(headerOf(requests[0] ?? { method: 'POST', url: '', headers: {} }, 'If-Match'), 'the If-Match header').toBeUndefined();
  });
});
