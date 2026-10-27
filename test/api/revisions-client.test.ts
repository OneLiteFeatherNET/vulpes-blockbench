import { describe, expect, it } from 'vitest';
import { createVulpesClient, type ApiResult, type VulpesClient } from '../../src/api/client';
import type { VulpesProblem } from '../../src/problem';
import type { HttpRequest } from '../../src/api/http';
import { fakeFetch, headerOf, type FakeFetch } from '../support/fake-fetch';

const BASE = 'http://localhost:8085';
const PROJECT_ID = '6f1c0000-0000-4000-8000-000000000002';
const ASSET_ID = '6f1c0000-0000-4000-8000-000000000001';
const REVISION_ID = '6f1c0000-0000-4000-8000-000000000010';
const ETAG = '"0a1b2c"';
const MODEL_TEXT = '{"meta":{"format_version":"4.10"}}';
const REVISION = {
  id: REVISION_ID,
  number: 3,
  sha1: '0a1b2c',
  size: 35,
  comment: null,
  creationDate: '2026-10-20T10:00:00Z',
  current: true,
};
const ASSET = JSON.stringify({ id: ASSET_ID, key: 'vulpes:item/ruby', fileName: 'ruby.bbmodel', size: 35, sha1: '0a1b2c' });

function clientWith(recorder: FakeFetch): VulpesClient {
  return createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
}

function problemOf(result: ApiResult<unknown>): VulpesProblem | undefined {
  return !result.ok && result.failure.kind === 'problem' ? result.failure.problem : undefined;
}

function firstRequest(recorder: FakeFetch): HttpRequest {
  return recorder.requests[0] ?? { method: 'GET', url: '', headers: {} };
}

describe('listRevisions', () => {
  it('requests one page of revisions of the asset', async () => {
    const recorder = fakeFetch(() => ({ status: 200, body: '{"content":[],"pageable":{},"totalSize":0}' }));
    await clientWith(recorder).listRevisions(PROJECT_ID, ASSET_ID, 1, 20);
    expect(firstRequest(recorder).url, 'the URL').toBe(`${BASE}/project/${PROJECT_ID}/asset/${ASSET_ID}/revision?page=1&size=20`);
    expect(firstRequest(recorder).method, 'the method').toBe('GET');
  });

  it('returns the revisions of the page', async () => {
    const body = JSON.stringify({ content: [REVISION], pageable: {}, totalSize: 1 });
    const result = await clientWith(fakeFetch(() => ({ status: 200, body }))).listRevisions(PROJECT_ID, ASSET_ID, 0, 20);
    expect(result.ok && result.value.items[0]?.number, 'the number of the first revision').toBe(3);
  });

  it('reports a 404 without a problem code, which the feature treats as unavailable', async () => {
    const result = await clientWith(fakeFetch(() => ({ status: 404, body: '' }))).listRevisions(PROJECT_ID, ASSET_ID, 0, 20);
    const problem = problemOf(result);
    expect(problem?.status, 'the status').toBe(404);
    expect(problem?.code, 'the code').toBeUndefined();
  });
});

describe('readRevision', () => {
  it('downloads the revision content with its ETag', async () => {
    const recorder = fakeFetch(() => ({ status: 200, headers: { ETag: ETAG }, body: MODEL_TEXT }));
    const result = await clientWith(recorder).readRevision(PROJECT_ID, ASSET_ID, REVISION_ID);
    expect(firstRequest(recorder).url, 'the URL').toBe(`${BASE}/project/${PROJECT_ID}/asset/${ASSET_ID}/revision/${REVISION_ID}/content`);
    expect(result, 'the result').toEqual({ ok: true, value: { text: MODEL_TEXT, etag: ETAG } });
  });

  it('reports a revision content response without an ETag as unexpected', async () => {
    const result = await clientWith(fakeFetch(() => ({ status: 200, body: MODEL_TEXT }))).readRevision(PROJECT_ID, ASSET_ID, REVISION_ID);
    expect(result.ok, 'ok').toBe(false);
  });
});

describe('restoreRevision', () => {
  it('posts to the restore route with If-Match set to the given ETag', async () => {
    const recorder = fakeFetch(() => ({ status: 200, headers: { ETag: '"new"' }, body: ASSET }));
    const result = await clientWith(recorder).restoreRevision(PROJECT_ID, ASSET_ID, REVISION_ID, ETAG);
    expect(firstRequest(recorder).method, 'the method').toBe('POST');
    expect(firstRequest(recorder).url, 'the URL').toBe(`${BASE}/project/${PROJECT_ID}/asset/${ASSET_ID}/revision/${REVISION_ID}/restore`);
    expect(headerOf(firstRequest(recorder), 'If-Match'), 'If-Match').toBe(ETAG);
    expect(result, 'the result').toEqual({ ok: true, value: { etag: '"new"' } });
  });

  it('carries the 412 ETag of a stale restore', async () => {
    const body = JSON.stringify({ title: 'Asset precondition failed', status: 412, code: 'ASSET_PRECONDITION_FAILED' });
    const result = await clientWith(fakeFetch(() => ({ status: 412, headers: { ETag: '"current"' }, body }))).restoreRevision(PROJECT_ID, ASSET_ID, REVISION_ID, ETAG);
    expect(problemOf(result)?.etag, 'the ETag').toBe('"current"');
  });

  it('refuses without sending when If-Match is not a strong ETag', async () => {
    const recorder = fakeFetch(() => ({ status: 200, headers: { ETag: '"new"' }, body: ASSET }));
    const result = await clientWith(recorder).restoreRevision(PROJECT_ID, ASSET_ID, REVISION_ID, 'W/"x"');
    expect(result, 'the result').toEqual({ ok: false, failure: { kind: 'refused' } });
    expect(recorder.requests.length, 'the requests sent').toBe(0);
  });

  it('reports a restore answer without an ETag as unexpected', async () => {
    const result = await clientWith(fakeFetch(() => ({ status: 200, body: ASSET }))).restoreRevision(PROJECT_ID, ASSET_ID, REVISION_ID, ETAG);
    expect(result.ok, 'ok').toBe(false);
  });
});

describe('replaceModel with a comment', () => {
  it('sends the comment as a multipart field', async () => {
    const recorder = fakeFetch(() => ({ status: 200, headers: { ETag: '"new"' }, body: ASSET }));
    await clientWith(recorder).replaceModel(PROJECT_ID, ASSET_ID, ETAG, 'vulpes:item/ruby', MODEL_TEXT, 'Fixed the hand');
    const body = firstRequest(recorder).body;
    expect(body?.fields['comment'], 'the comment field').toBe('Fixed the hand');
  });

  it('sends no comment field when the comment is empty', async () => {
    const recorder = fakeFetch(() => ({ status: 200, headers: { ETag: '"new"' }, body: ASSET }));
    await clientWith(recorder).replaceModel(PROJECT_ID, ASSET_ID, ETAG, 'vulpes:item/ruby', MODEL_TEXT, '');
    expect(firstRequest(recorder).body?.fields, 'the fields').toEqual({});
  });

  it('sends no comment field when no comment is given', async () => {
    const recorder = fakeFetch(() => ({ status: 200, headers: { ETag: '"new"' }, body: ASSET }));
    await clientWith(recorder).replaceModel(PROJECT_ID, ASSET_ID, ETAG, 'vulpes:item/ruby', MODEL_TEXT);
    expect(firstRequest(recorder).body?.fields, 'the fields').toEqual({});
  });
});
