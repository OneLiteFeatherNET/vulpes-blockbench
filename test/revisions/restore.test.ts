import { describe, expect, it } from 'vitest';
import { createVulpesClient } from '../../src/api/client';
import { planRestore, restoreRevision } from '../../src/revisions/restore';
import { fakeFetch, headerOf } from '../support/fake-fetch';

const BASE = 'http://localhost:8085';
const PROJECT_ID = '6f1c0000-0000-4000-8000-000000000002';
const ASSET_ID = '6f1c0000-0000-4000-8000-000000000001';
const REVISION_ID = '6f1c0000-0000-4000-8000-000000000010';
const HELD_ETAG = '"held"';
const NEW_ETAG = '"restored"';
const PRECONDITION = JSON.stringify({ title: 'Asset precondition failed', status: 412, code: 'ASSET_PRECONDITION_FAILED' });

describe('planRestore', () => {
  it('sends the held strong ETag in If-Match', () => {
    expect(planRestore(HELD_ETAG), 'the plan').toEqual({ kind: 'send', ifMatch: HELD_ETAG });
  });

  it('refuses when no ETag is held', () => {
    expect(planRestore(undefined).kind, 'the plan').toBe('refuse');
  });

  it('refuses a weak ETag', () => {
    expect(planRestore('W/"held"').kind, 'the plan').toBe('refuse');
  });
});

describe('restoreRevision', () => {
  it('posts the restore and returns the new ETag of the response', async () => {
    const recorder = fakeFetch(() => ({ status: 200, headers: { ETag: NEW_ETAG }, body: '{}' }));
    const client = createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
    const outcome = await restoreRevision(client, { projectId: PROJECT_ID, assetId: ASSET_ID }, REVISION_ID, HELD_ETAG);
    expect(outcome, 'the outcome').toEqual({ kind: 'restored', etag: NEW_ETAG });
    expect(recorder.requests[0]?.url, 'the URL').toBe(`${BASE}/project/${PROJECT_ID}/asset/${ASSET_ID}/revision/${REVISION_ID}/restore`);
    expect(headerOf(recorder.requests[0] ?? { method: 'GET', url: '', headers: {} }, 'If-Match'), 'If-Match').toBe(HELD_ETAG);
  });

  it('reports a 412 as a conflict with the current ETag', async () => {
    const recorder = fakeFetch(() => ({ status: 412, headers: { ETag: '"current"' }, body: PRECONDITION }));
    const client = createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
    const outcome = await restoreRevision(client, { projectId: PROJECT_ID, assetId: ASSET_ID }, REVISION_ID, HELD_ETAG);
    expect(outcome, 'the outcome').toEqual({ kind: 'conflict', currentEtag: '"current"' });
  });

  it('reports a backend without revisions as an unavailable feature', async () => {
    const recorder = fakeFetch(() => ({ status: 404, body: '' }));
    const client = createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
    const outcome = await restoreRevision(client, { projectId: PROJECT_ID, assetId: ASSET_ID }, REVISION_ID, HELD_ETAG);
    expect(outcome.kind === 'failed' ? outcome.message.key : undefined, 'the message key').toBe('vulpes.revisions.unavailable');
  });

  it('sends nothing when the ETag is not strong', async () => {
    const recorder = fakeFetch(() => ({ status: 200, headers: { ETag: NEW_ETAG }, body: '{}' }));
    const client = createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
    await restoreRevision(client, { projectId: PROJECT_ID, assetId: ASSET_ID }, REVISION_ID, 'held');
    expect(recorder.requests.length, 'the requests sent').toBe(0);
  });
});
