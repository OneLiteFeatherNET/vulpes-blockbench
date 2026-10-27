import { describe, expect, it } from 'vitest';
import { createVulpesClient, type VulpesClient } from '../../src/api/client';
import { listAllProjects, loadNextModelPage } from '../../src/remote/catalog';
import { emptyModelList } from '../../src/remote/model-list';
import { fakeFetch, type FakeFetch } from '../support/fake-fetch';

const BASE = 'http://localhost:8085';
const PROJECT_ID = '6f1c0000-0000-4000-8000-000000000002';

function projectAt(index: number): { id: string; displayName: string; key: string } {
  return { id: `p-${String(index)}`, displayName: `Project ${String(index)}`, key: `p${String(index)}` };
}

function projectPage(from: number, count: number, totalSize: number): string {
  const content = Array.from({ length: count }, (_, offset) => projectAt(from + offset));
  return JSON.stringify({ content, pageable: {}, totalSize });
}

function clientFor(recorder: FakeFetch): VulpesClient {
  return createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
}

describe('listAllProjects', () => {
  it('collects the projects of every page', async () => {
    const recorder = fakeFetch((request) =>
      request.url.includes('page=0') ? { status: 200, body: projectPage(0, 50, 51) } : { status: 200, body: projectPage(50, 1, 51) },
    );
    const result = await listAllProjects(clientFor(recorder));
    expect(result.ok && result.value.length, 'the number of projects').toBe(51);
    expect(recorder.requests.length, 'the number of requests').toBe(2);
  });

  it('stops at an empty page even when the total says there are more', async () => {
    const recorder = fakeFetch(() => ({ status: 200, body: projectPage(0, 0, 60) }));
    const result = await listAllProjects(clientFor(recorder));
    expect(result.ok && result.value, 'the projects').toEqual([]);
    expect(recorder.requests.length, 'the number of requests').toBe(1);
  });

  it('reports a failure of a later page', async () => {
    const recorder = fakeFetch((request) =>
      request.url.includes('page=0') ? { status: 200, body: projectPage(0, 50, 51) } : { status: 503 },
    );
    const result = await listAllProjects(clientFor(recorder));
    expect(result.ok, 'ok').toBe(false);
  });
});

describe('loadNextModelPage', () => {
  it('requests the page after the last one loaded and appends it', async () => {
    const body = JSON.stringify({
      content: [{ id: 'a-1', key: 'vulpes:item/ruby', fileName: 'ruby.bbmodel', size: 1, sha1: 'abc' }],
      pageable: {},
      totalSize: 1,
    });
    const recorder = fakeFetch(() => ({ status: 200, body }));
    const result = await loadNextModelPage(clientFor(recorder), PROJECT_ID, emptyModelList());
    expect(recorder.requests[0]?.url, 'the URL').toContain('page=0&size=50');
    expect(result.ok && result.value.items.length, 'the models').toBe(1);
  });

  it('keeps the failure so that the caller keeps the list it had', async () => {
    const recorder = fakeFetch(() => ({ status: 500, body: '' }));
    const result = await loadNextModelPage(clientFor(recorder), PROJECT_ID, emptyModelList());
    expect(result.ok, 'ok').toBe(false);
  });
});
