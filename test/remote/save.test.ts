import { describe, expect, it } from 'vitest';
import { createVulpesClient, type VulpesClient } from '../../src/api/client';
import type { HttpRequest } from '../../src/api/http';
import { createLinked, loadLatest, overwriteLinked, saveLinked } from '../../src/remote/save';
import type { RemoteReference } from '../../src/remote/reference';
import { fakeFetch, headerOf, unreachableFetch, type FakeFetch } from '../support/fake-fetch';

const BASE = 'http://localhost:8085';
const PROJECT_ID = '6f1c0000-0000-4000-8000-000000000002';
const ASSET_ID = '6f1c0000-0000-4000-8000-000000000001';
const NEW_ASSET_ID = '6f1c0000-0000-4000-8000-000000000003';
const OLD_ETAG = '"old"';
const NEW_ETAG = '"new"';
const TEXT = '{"meta":{"format_version":"4.10"}}';

const REFERENCE: RemoteReference = { baseUrl: BASE, projectId: PROJECT_ID, assetId: ASSET_ID, key: 'vulpes:item/ruby', etag: OLD_ETAG };

const ASSET = (id: string): string => JSON.stringify({ id, key: 'vulpes:item/ruby', fileName: 'ruby.bbmodel', size: 1, sha1: 'abc' });
const PRECONDITION = JSON.stringify({ title: 'Asset precondition failed', status: 412, code: 'ASSET_PRECONDITION_FAILED' });
const CONFLICT = JSON.stringify({ title: 'Resource conflict', status: 409, code: 'RESOURCE_CONFLICT' });

function clientFor(recorder: FakeFetch): VulpesClient {
  return createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
}

describe('saveLinked', () => {
  it('replaces the content with the stored ETag in If-Match', async () => {
    const recorder = fakeFetch(() => ({ status: 200, headers: { ETag: NEW_ETAG }, body: ASSET(ASSET_ID) }));
    await saveLinked(clientFor(recorder), REFERENCE, TEXT);
    expect(headerOf(recorder.requests[0] ?? blank(), 'If-Match'), 'If-Match').toBe(OLD_ETAG);
  });

  it('returns the reference with the ETag of the response', async () => {
    const recorder = fakeFetch(() => ({ status: 200, headers: { ETag: NEW_ETAG }, body: ASSET(ASSET_ID) }));
    const outcome = await saveLinked(clientFor(recorder), REFERENCE, TEXT);
    expect(outcome, 'the outcome').toEqual({ kind: 'saved', reference: { ...REFERENCE, etag: NEW_ETAG } });
  });

  it('reports a 412 as a conflict that carries the current ETag', async () => {
    const recorder = fakeFetch(() => ({ status: 412, headers: { ETag: '"current"' }, body: PRECONDITION }));
    const outcome = await saveLinked(clientFor(recorder), REFERENCE, TEXT);
    expect(outcome, 'the outcome').toEqual({ kind: 'conflict', currentEtag: '"current"' });
  });

  it('reports a 412 without an ETag header as a conflict without a current ETag', async () => {
    const recorder = fakeFetch(() => ({ status: 412, body: PRECONDITION }));
    const outcome = await saveLinked(clientFor(recorder), REFERENCE, TEXT);
    expect(outcome, 'the outcome').toEqual({ kind: 'conflict', currentEtag: undefined });
  });

  it('keeps the local state when Vulpes cannot be reached', async () => {
    const recorder = unreachableFetch('Failed to fetch');
    const outcome = await saveLinked(createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch }), REFERENCE, TEXT);
    expect(outcome.kind, 'the kind').toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.message.text, 'the message').toContain('Local work is kept');
    }
  });

  it('sends nothing when the reference has no valid ETag', async () => {
    const recorder = fakeFetch(() => ({ status: 200, body: ASSET(ASSET_ID) }));
    const outcome = await saveLinked(clientFor(recorder), { ...REFERENCE, etag: 'W/"old"' }, TEXT);
    expect(recorder.requests, 'the requests').toEqual([]);
    expect(outcome.kind, 'the kind').toBe('failed');
  });

  it('reports a deleted model with the message that offers a copy', async () => {
    const body = JSON.stringify({ title: 'Resource not found', status: 404, code: 'RESOURCE_NOT_FOUND' });
    const recorder = fakeFetch(() => ({ status: 404, body }));
    const outcome = await saveLinked(clientFor(recorder), REFERENCE, TEXT);
    expect(outcome.kind === 'failed' && outcome.message.text.includes('Save as copy'), 'the message').toBe(true);
  });
});

describe('overwriteLinked', () => {
  it('sends the ETag of the conflict, not the stored one, and sends no GET first', async () => {
    const recorder = fakeFetch(() => ({ status: 200, headers: { ETag: NEW_ETAG }, body: ASSET(ASSET_ID) }));
    await overwriteLinked(clientFor(recorder), REFERENCE, TEXT, '"current"');
    expect(recorder.requests.map((request) => request.method), 'the methods').toEqual(['POST']);
    expect(headerOf(recorder.requests[0] ?? blank(), 'If-Match'), 'If-Match').toBe('"current"');
  });

  it('reports another 412 as a conflict with the newest ETag', async () => {
    const recorder = fakeFetch(() => ({ status: 412, headers: { ETag: '"newer"' }, body: PRECONDITION }));
    const outcome = await overwriteLinked(clientFor(recorder), REFERENCE, TEXT, '"current"');
    expect(outcome, 'the outcome').toEqual({ kind: 'conflict', currentEtag: '"newer"' });
  });
});

describe('loadLatest', () => {
  it('reads the current content and the ETag that came with it', async () => {
    const recorder = fakeFetch(() => ({ status: 200, headers: { ETag: NEW_ETAG }, body: TEXT }));
    const outcome = await loadLatest(clientFor(recorder), REFERENCE);
    expect(outcome, 'the outcome').toEqual({ kind: 'loaded', text: TEXT, reference: { ...REFERENCE, etag: NEW_ETAG } });
  });
});

describe('createLinked', () => {
  it('creates the model under the key and links the reference to the new asset', async () => {
    const recorder = fakeFetch(() => ({ status: 201, headers: { ETag: NEW_ETAG }, body: ASSET(NEW_ASSET_ID) }));
    const outcome = await createLinked(clientFor(recorder), { baseUrl: BASE, projectId: PROJECT_ID }, 'vulpes:item/ruby', TEXT);
    expect(outcome, 'the outcome').toEqual({
      kind: 'created',
      reference: { baseUrl: BASE, projectId: PROJECT_ID, assetId: NEW_ASSET_ID, key: 'vulpes:item/ruby', etag: NEW_ETAG },
    });
  });

  it('reports a taken key as a failure on the key field', async () => {
    const recorder = fakeFetch(() => ({ status: 409, body: CONFLICT }));
    const outcome = await createLinked(clientFor(recorder), { baseUrl: BASE, projectId: PROJECT_ID }, 'vulpes:item/ruby', TEXT);
    expect(outcome.kind === 'failed' && outcome.message.field, 'the field').toBe('key');
  });

  it('reports a create that answered with neither a version tag nor a digest as a failure', async () => {
    const withoutDigest = JSON.stringify({ id: NEW_ASSET_ID, key: 'vulpes:item/ruby', fileName: 'ruby.bbmodel', size: 1 });
    const recorder = fakeFetch(() => ({ status: 201, body: withoutDigest }));
    const outcome = await createLinked(clientFor(recorder), { baseUrl: BASE, projectId: PROJECT_ID }, 'vulpes:item/ruby', TEXT);
    expect(outcome.kind, 'the kind').toBe('failed');
  });
});

function blank(): HttpRequest {
  return { method: 'POST', url: '', headers: {} };
}
