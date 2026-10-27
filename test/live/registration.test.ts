import { describe, expect, it } from 'vitest';
import { createLiveRegistryClient, isRegistrationConflict, parseRegistration, type LiveRegistryClient } from '../../src/live/registration';
import type { LiveHttpRequest } from '../../src/live/registration';
import { recordingFetch, rejectingFetch, type CannedReply } from './fake-live-fetch';

const BASE = 'http://localhost:8085';
const PROJECT_ID = '6f1c0000-0000-4000-8000-000000000002';
const ASSET_ID = '6f1c0000-0000-4000-8000-000000000001';
const PATH = `${BASE}/project/${PROJECT_ID}/asset/${ASSET_ID}/live-session`;
const TOKEN = 'aaaaaaaaaaaaaaaa';
const HOST = 'localhost';
const REGISTRATION = { token: TOKEN, host: HOST, startedAt: '2026-10-27T10:00:00Z', expiresAt: '2026-10-27T10:01:00Z' };
const CONFLICT_BODY = JSON.stringify({ title: 'Resource conflict', status: 409, code: 'RESOURCE_CONFLICT' });

function clientWith(
  respond: (request: LiveHttpRequest) => CannedReply,
  token?: () => string | undefined,
): { client: LiveRegistryClient; requests: LiveHttpRequest[] } {
  const recorder = recordingFetch(respond);
  const client = createLiveRegistryClient({
    baseUrl: `${BASE}/`,
    fetch: recorder.fetch,
    ...(token === undefined ? {} : { token }),
  });
  return { client, requests: recorder.requests };
}

describe('parseRegistration', () => {
  it('reads the token, host, start and expiry of a registration', () => {
    expect(parseRegistration(REGISTRATION), 'the registration').toEqual(REGISTRATION);
  });

  it.each(['token', 'host', 'startedAt', 'expiresAt'] as const)('rejects a registration without %s', (field) => {
    const body = Object.fromEntries(Object.entries(REGISTRATION).filter(([key]) => key !== field));
    expect(parseRegistration(body), `the result without ${field}`).toBeUndefined();
  });

  it('rejects a registration with an empty token', () => {
    expect(parseRegistration({ ...REGISTRATION, token: '' }), 'the result').toBeUndefined();
  });

  it.each([null, 'token', ['token']])('rejects a body that is not a record: %j', (body) => {
    expect(parseRegistration(body), 'the result').toBeUndefined();
  });
});

describe('readRegistration', () => {
  it('reads the registration of one asset from the live-session path', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: JSON.stringify(REGISTRATION) }));
    await client.readRegistration(PROJECT_ID, ASSET_ID);
    expect(requests[0]?.method, 'the method').toBe('GET');
    expect(requests[0]?.url, 'the URL').toBe(PATH);
  });

  it('returns the registration of a 200 response', async () => {
    const { client } = clientWith(() => ({ status: 200, body: JSON.stringify(REGISTRATION) }));
    const result = await client.readRegistration(PROJECT_ID, ASSET_ID);
    expect(result, 'the result').toEqual({ ok: true, value: REGISTRATION });
  });

  it('answers none for a 404 that carries a problem code', async () => {
    const body = JSON.stringify({ title: 'Not found', status: 404, code: 'RESOURCE_NOT_FOUND' });
    const { client } = clientWith(() => ({ status: 404, body }));
    const result = await client.readRegistration(PROJECT_ID, ASSET_ID);
    expect(result, 'the result').toEqual({ ok: true, value: undefined });
  });

  it('reports a 404 without a problem code as a failure, not as none, because an older backend has no route', async () => {
    const { client } = clientWith(() => ({ status: 404 }));
    const result = await client.readRegistration(PROJECT_ID, ASSET_ID);
    expect(result.ok, 'ok').toBe(false);
    if (!result.ok && result.failure.kind === 'problem') {
      expect(result.failure.problem.status, 'the status').toBe(404);
      expect(result.failure.problem.code, 'the code').toBeUndefined();
    }
  });

  it('reports an unreadable 200 body as unexpected', async () => {
    const { client } = clientWith(() => ({ status: 200, body: '{"token":"x"}' }));
    const result = await client.readRegistration(PROJECT_ID, ASSET_ID);
    expect(result, 'the result').toEqual({ ok: false, failure: { kind: 'unexpected', status: 200 } });
  });

  it('URL-encodes the project and asset ids in the path', async () => {
    const { client, requests } = clientWith(() => ({ status: 404, body: '{"status":404,"title":"x","code":"RESOURCE_NOT_FOUND"}' }));
    await client.readRegistration('a/b c', 'd?e');
    expect(requests[0]?.url, 'the URL').toBe(`${BASE}/project/a%2Fb%20c/asset/d%3Fe/live-session`);
  });

  it('sends the bearer token when one is given', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: JSON.stringify(REGISTRATION) }), () => 'secret');
    await client.readRegistration(PROJECT_ID, ASSET_ID);
    expect(requests[0]?.headers['Authorization'], 'the Authorization header').toBe('Bearer secret');
  });

  it('reports an unreachable backend as unreachable', async () => {
    const client = createLiveRegistryClient({ baseUrl: BASE, fetch: rejectingFetch('blocked') });
    const result = await client.readRegistration(PROJECT_ID, ASSET_ID);
    expect(result, 'the result').toEqual({ ok: false, failure: { kind: 'unreachable', message: 'blocked' } });
  });
});

describe('register', () => {
  it('puts the token and host as a JSON body to the live-session path', async () => {
    const { client, requests } = clientWith(() => ({ status: 200, body: JSON.stringify(REGISTRATION) }));
    await client.register(PROJECT_ID, ASSET_ID, { token: TOKEN, host: HOST });
    const request = requests[0];
    expect(request?.method, 'the method').toBe('PUT');
    expect(request?.url, 'the URL').toBe(PATH);
    expect(request?.json, 'the JSON body').toBe(JSON.stringify({ token: TOKEN, host: HOST }));
    expect(request?.headers['Content-Type'], 'the content type').toBe('application/json');
  });

  it('returns the registration the backend stores', async () => {
    const { client } = clientWith(() => ({ status: 200, body: JSON.stringify(REGISTRATION) }));
    const result = await client.register(PROJECT_ID, ASSET_ID, { token: TOKEN, host: HOST });
    expect(result, 'the result').toEqual({ ok: true, value: REGISTRATION });
  });

  it('reports a 409 as a conflict', async () => {
    const { client } = clientWith(() => ({ status: 409, body: CONFLICT_BODY }));
    const result = await client.register(PROJECT_ID, ASSET_ID, { token: TOKEN, host: HOST });
    expect(result.ok, 'ok').toBe(false);
    if (!result.ok) {
      expect(isRegistrationConflict(result.failure), 'is a conflict').toBe(true);
    }
  });

  it('does not report a server error as a conflict', async () => {
    const { client } = clientWith(() => ({ status: 500, body: '' }));
    const result = await client.register(PROJECT_ID, ASSET_ID, { token: TOKEN, host: HOST });
    expect(result.ok, 'ok').toBe(false);
    if (!result.ok) {
      expect(isRegistrationConflict(result.failure), 'is a conflict').toBe(false);
    }
  });
});

describe('removeRegistration', () => {
  it('deletes the registration with the token in the query', async () => {
    const token = 'ab+cd/ef gh';
    const { client, requests } = clientWith(() => ({ status: 204 }));
    await client.removeRegistration(PROJECT_ID, ASSET_ID, token);
    expect(requests[0]?.method, 'the method').toBe('DELETE');
    expect(requests[0]?.url, 'the URL with the encoded token').toBe(`${PATH}?token=${encodeURIComponent(token)}`);
  });

  it('treats a 204 response as removed', async () => {
    const { client } = clientWith(() => ({ status: 204 }));
    const result = await client.removeRegistration(PROJECT_ID, ASSET_ID, TOKEN);
    expect(result, 'the result').toEqual({ ok: true, value: undefined });
  });

  it('reports a failed delete as a failure', async () => {
    const { client } = clientWith(() => ({ status: 500, body: '' }));
    const result = await client.removeRegistration(PROJECT_ID, ASSET_ID, TOKEN);
    expect(result.ok, 'ok').toBe(false);
  });
});
