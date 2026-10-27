import { describe, expect, it } from 'vitest';
import { createVulpesClient, type VulpesClient } from '../../src/api/client';
import type { HttpRequest } from '../../src/api/http';
import { fakeFetch, headerOf, unreachableFetch } from '../support/fake-fetch';

const BASE = 'http://localhost:8085';
const PROJECT_ID = '6f1c0000-0000-4000-8000-000000000002';
const ASSET_ID = '6f1c0000-0000-4000-8000-000000000001';
const ETAG = '"0a1b2c"';
const MODEL_TEXT = '{"meta":{"format_version":"4.10"}}';

const ASSET_BODY = JSON.stringify({
  id: ASSET_ID,
  key: 'vulpes:item/ruby',
  fileName: 'ruby.bbmodel',
  size: 35,
  sha1: '0a1b2c',
});

function clientWith(
  respond: Parameters<typeof fakeFetch>[0],
  token?: () => string | undefined,
): { client: VulpesClient; requests: HttpRequest[] } {
  const recorder = fakeFetch(respond);
  const client = createVulpesClient({
    baseUrl: `${BASE}/`,
    fetch: recorder.fetch,
    ...(token === undefined ? {} : { token }),
  });
  return { client, requests: recorder.requests };
}

describe('listProjects', () => {
  it('requests one page of projects from the project endpoint', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: '{"content":[],"pageable":{},"totalSize":0}' }));
    await client.listProjects(0, 50);
    expect(requests[0]?.method, 'the method').toBe('GET');
    expect(requests[0]?.url, 'the URL, with the trailing slash of the base URL removed').toBe(
      `${BASE}/project/?page=0&size=50`,
    );
  });

  it('returns the projects of the page', async () => {
    const body = JSON.stringify({
      content: [{ id: PROJECT_ID, displayName: 'Items', key: 'items' }],
      pageable: {},
      totalSize: 1,
    });
    const { client } = clientWith(() => ({ status: 200, body }));
    const result = await client.listProjects(0, 50);
    expect(result.ok && result.value.items[0]?.displayName, 'the first project name').toBe('Items');
  });

  it('reports an unreadable 200 body as an unexpected response', async () => {
    const { client } = clientWith(() => ({ status: 200, body: '{"nope":true}' }));
    const result = await client.listProjects(0, 50);
    expect(result, 'the result').toEqual({ ok: false, failure: { kind: 'unexpected', status: 200 } });
  });
});

describe('listModels', () => {
  it('requests the BBMODEL assets of one project, one page at a time', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: '{"content":[],"pageable":{},"totalSize":0}' }));
    await client.listModels(PROJECT_ID, 2, 50);
    expect(requests[0]?.url, 'the URL').toBe(
      `${BASE}/project/${PROJECT_ID}/asset/?kind=BBMODEL&page=2&size=50`,
    );
  });
});

describe('readModel', () => {
  it('downloads the content and returns it with the ETag exactly as received', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, headers: { ETag: ETAG }, body: MODEL_TEXT }));
    const result = await client.readModel(PROJECT_ID, ASSET_ID);
    expect(requests[0]?.url, 'the URL').toBe(`${BASE}/project/${PROJECT_ID}/asset/${ASSET_ID}/content`);
    expect(result, 'the result').toEqual({ ok: true, value: { text: MODEL_TEXT, etag: ETAG } });
  });

  it('never sends If-Match on a read', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, headers: { ETag: ETAG }, body: MODEL_TEXT }));
    await client.readModel(PROJECT_ID, ASSET_ID);
    expect(headerOf(requests[0] ?? { method: 'GET', url: '', headers: {} }, 'If-Match'), 'the If-Match header').toBeUndefined();
  });

  it('reports a content response without an ETag as unexpected', async () => {
    const { client } = clientWith(() => ({ status: 200, body: MODEL_TEXT }));
    const result = await client.readModel(PROJECT_ID, ASSET_ID);
    expect(result.ok, 'ok').toBe(false);
  });
});

describe('createModel', () => {
  it('posts a multipart body with the key and a .bbmodel file name', async () => {
    const { client, requests } = clientWith(() => ({ status: 201, headers: { ETag: ETAG }, body: ASSET_BODY }));
    await client.createModel(PROJECT_ID, 'vulpes:item/ruby', MODEL_TEXT);
    const request = requests[0];
    expect(request?.method, 'the method').toBe('POST');
    expect(request?.url, 'the URL').toBe(`${BASE}/project/${PROJECT_ID}/asset/`);
    expect(request?.body?.fields, 'the fields').toEqual({ key: 'vulpes:item/ruby' });
    expect(request?.body?.file.name, 'the file name').toBe('ruby.bbmodel');
    expect(request?.body?.file.text, 'the file, unchanged').toBe(MODEL_TEXT);
  });

  it('sends no If-Match on create', async () => {
    const { client, requests } = clientWith(() => ({ status: 201, headers: { ETag: ETAG }, body: ASSET_BODY }));
    await client.createModel(PROJECT_ID, 'vulpes:item/ruby', MODEL_TEXT);
    expect(headerOf(requests[0] ?? { method: 'POST', url: '', headers: {} }, 'If-Match'), 'the If-Match header').toBeUndefined();
  });

  it('returns the id from the body and the ETag from the header', async () => {
    const { client } = clientWith(() => ({ status: 201, headers: { ETag: ETAG }, body: ASSET_BODY }));
    const result = await client.createModel(PROJECT_ID, 'vulpes:item/ruby', MODEL_TEXT);
    expect(result.ok && result.value.asset.id, 'the id').toBe(ASSET_ID);
    expect(result.ok && result.value.etag, 'the etag').toBe(ETAG);
  });

  it('uses the ETag header when the backend sends one, even if the digest differs', async () => {
    const { client } = clientWith(() => ({ status: 201, headers: { ETag: '"header"' }, body: ASSET_BODY }));
    const result = await client.createModel(PROJECT_ID, 'vulpes:item/ruby', MODEL_TEXT);
    expect(result.ok && result.value.etag, 'the etag').toBe('"header"');
  });

  it('falls back to a strong ETag built from the body digest when the header is missing', async () => {
    const { client } = clientWith(() => ({ status: 201, body: ASSET_BODY }));
    const result = await client.createModel(PROJECT_ID, 'vulpes:item/ruby', MODEL_TEXT);
    expect(result.ok && result.value.etag, 'the etag').toBe(ETAG);
  });

  it('reports a create without an ETag header and without a digest as unexpected', async () => {
    const { client } = clientWith(() => ({ status: 201, body: JSON.stringify({ id: ASSET_ID, key: 'vulpes:item/ruby', fileName: 'ruby.bbmodel', size: 35 }) }));
    const result = await client.createModel(PROJECT_ID, 'vulpes:item/ruby', MODEL_TEXT);
    expect(result, 'the result').toEqual({ ok: false, failure: { kind: 'unexpected', status: 201 } });
  });

  it('returns the code of a rejected key', async () => {
    const body = JSON.stringify({
      title: 'Validation failed',
      status: 400,
      code: 'VALIDATION_FAILED',
      errors: [{ field: 'key', code: 'ASSET_KEY_INVALID', message: 'bad key' }],
    });
    const { client } = clientWith(() => ({ status: 400, body }));
    const result = await client.createModel(PROJECT_ID, 'Ruby', MODEL_TEXT);
    expect(result.ok, 'ok').toBe(false);
    if (!result.ok && result.failure.kind === 'problem') {
      expect(result.failure.problem.violations[0]?.field, 'the violated field').toBe('key');
    }
  });
});

describe('replaceModel', () => {
  it('posts the content with If-Match set to the ETag it was given, unchanged', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, headers: { ETag: '"new"' }, body: ASSET_BODY }));
    await client.replaceModel(PROJECT_ID, ASSET_ID, ETAG, 'vulpes:item/ruby', MODEL_TEXT);
    const request = requests[0];
    expect(request?.method, 'the method').toBe('POST');
    expect(request?.url, 'the URL').toBe(`${BASE}/project/${PROJECT_ID}/asset/${ASSET_ID}/content`);
    expect(headerOf(request ?? { method: 'POST', url: '', headers: {} }, 'If-Match'), 'the If-Match header').toBe(ETAG);
    expect(request?.body?.file.name, 'the file name').toBe('ruby.bbmodel');
    expect(request?.body?.file.text, 'the file').toBe(MODEL_TEXT);
    expect(request?.body?.fields, 'no key field').toEqual({});
  });

  it('returns the new ETag of the response', async () => {
    const { client } = clientWith(() => ({ status: 200, headers: { ETag: '"new"' }, body: ASSET_BODY }));
    const result = await client.replaceModel(PROJECT_ID, ASSET_ID, ETAG, 'vulpes:item/ruby', MODEL_TEXT);
    expect(result.ok && result.value.etag, 'the etag').toBe('"new"');
  });

  it('uses the ETag header of a replacement when the backend sends one, even if the digest differs', async () => {
    const { client } = clientWith(() => ({ status: 200, headers: { ETag: '"header"' }, body: ASSET_BODY }));
    const result = await client.replaceModel(PROJECT_ID, ASSET_ID, ETAG, 'vulpes:item/ruby', MODEL_TEXT);
    expect(result.ok && result.value.etag, 'the etag').toBe('"header"');
  });

  it('falls back to a strong ETag built from the body digest when a replacement has no ETag header', async () => {
    const { client } = clientWith(() => ({ status: 200, body: ASSET_BODY }));
    const result = await client.replaceModel(PROJECT_ID, ASSET_ID, ETAG, 'vulpes:item/ruby', MODEL_TEXT);
    expect(result.ok && result.value.etag, 'the etag').toBe(ETAG);
  });

  it('reports a replacement without an ETag header and without a digest as unexpected', async () => {
    const { client } = clientWith(() => ({ status: 200, body: JSON.stringify({ id: ASSET_ID, key: 'vulpes:item/ruby', fileName: 'ruby.bbmodel', size: 35 }) }));
    const result = await client.replaceModel(PROJECT_ID, ASSET_ID, ETAG, 'vulpes:item/ruby', MODEL_TEXT);
    expect(result, 'the result').toEqual({ ok: false, failure: { kind: 'unexpected', status: 200 } });
  });

  it('carries the current ETag of a 412 in the problem', async () => {
    const body = JSON.stringify({ title: 'Asset precondition failed', status: 412, code: 'ASSET_PRECONDITION_FAILED' });
    const { client } = clientWith(() => ({ status: 412, headers: { ETag: '"current"' }, body }));
    const result = await client.replaceModel(PROJECT_ID, ASSET_ID, ETAG, 'vulpes:item/ruby', MODEL_TEXT);
    expect(result.ok, 'ok').toBe(false);
    if (!result.ok && result.failure.kind === 'problem') {
      expect(result.failure.problem.code, 'the code').toBe('ASSET_PRECONDITION_FAILED');
      expect(result.failure.problem.etag, 'the current etag').toBe('"current"');
    }
  });

  it('keeps a 412 without an ETag header as a problem without an etag', async () => {
    const body = JSON.stringify({ title: 'Asset precondition failed', status: 412, code: 'ASSET_PRECONDITION_FAILED' });
    const { client } = clientWith(() => ({ status: 412, body }));
    const result = await client.replaceModel(PROJECT_ID, ASSET_ID, ETAG, 'vulpes:item/ruby', MODEL_TEXT);
    if (!result.ok && result.failure.kind === 'problem') {
      expect(result.failure.problem.etag, 'the etag').toBeUndefined();
    }
  });

  it('refuses to send a replacement without a valid ETag', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: ASSET_BODY }));
    const result = await client.replaceModel(PROJECT_ID, ASSET_ID, '', 'vulpes:item/ruby', MODEL_TEXT);
    expect(requests, 'the requests sent').toEqual([]);
    expect(result, 'the result').toEqual({ ok: false, failure: { kind: 'refused' } });
  });

  it('refuses to send a weak ETag, which the backend never matches', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: ASSET_BODY }));
    await client.replaceModel(PROJECT_ID, ASSET_ID, 'W/"0a1b2c"', 'vulpes:item/ruby', MODEL_TEXT);
    expect(requests, 'the requests sent').toEqual([]);
  });
});

describe('error handling', () => {
  it('reports a request that gets no response as unreachable', async () => {
    const recorder = unreachableFetch('Failed to fetch');
    const client = createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
    const result = await client.listProjects(0, 50);
    expect(result, 'the result').toEqual({ ok: false, failure: { kind: 'unreachable', message: 'Failed to fetch' } });
  });

  it('keeps the status of an error body that is not JSON, without a code', async () => {
    const { client } = clientWith(() => ({ status: 502, body: '<html>gateway</html>' }));
    const result = await client.listProjects(0, 50);
    if (!result.ok && result.failure.kind === 'problem') {
      expect(result.failure.problem.code, 'the code').toBeUndefined();
      expect(result.failure.problem.status, 'the status').toBe(502);
    }
  });
});

describe('token provider', () => {
  it('adds Authorization: Bearer when the provider returns a token', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: '{"content":[],"pageable":{},"totalSize":0}' }), () => 'abc');
    await client.listProjects(0, 50);
    expect(headerOf(requests[0] ?? { method: 'GET', url: '', headers: {} }, 'Authorization'), 'the header').toBe('Bearer abc');
  });

  it('sends no Authorization header when the provider returns nothing', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: '{"content":[],"pageable":{},"totalSize":0}' }), () => undefined);
    await client.listProjects(0, 50);
    expect(headerOf(requests[0] ?? { method: 'GET', url: '', headers: {} }, 'Authorization'), 'the header').toBeUndefined();
  });

  it('sends no Authorization header when no provider is configured', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: '{"content":[],"pageable":{},"totalSize":0}' }));
    await client.listProjects(0, 50);
    expect(headerOf(requests[0] ?? { method: 'GET', url: '', headers: {} }, 'Authorization'), 'the header').toBeUndefined();
  });
});
