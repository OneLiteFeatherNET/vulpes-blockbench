import { describe, expect, it } from 'vitest';
import { createVulpesClient } from '../../src/api/client';
import type { HttpRequest } from '../../src/api/http';
import { assignModelToItem, type AssignmentOutcome } from '../../src/items/assignment';
import { fakeFetch, type Canned, type FakeFetch, unreachableFetch } from '../support/fake-fetch';

const BASE = 'http://localhost:8085';
const ITEM_ID = '6f1c0000-0000-4000-8000-000000000003';
const KEY = 'vulpes:item/ruby';
const OLD_ID = 'c-old';

function page(content: unknown[]): string {
  return JSON.stringify({ content, pageable: {}, totalSize: content.length });
}

function entry(id: string, componentKey: string, value: unknown): Record<string, unknown> {
  return { id, componentKey, value };
}

/** The component the backend returns after a write. */
function stored(): string {
  return JSON.stringify(entry('c-stored', 'minecraft:item_model', KEY));
}

function bodyOf(request: HttpRequest | undefined): unknown {
  const parsed: unknown = JSON.parse(request?.json ?? '');
  return parsed;
}

/** A backend with the given components. Writes answer with `write`, which defaults to success. */
function backend(components: unknown[], write: (request: HttpRequest) => Canned = () => ({ status: 200, body: stored() })): FakeFetch {
  return fakeFetch((request) => (request.method === 'GET' ? { status: 200, body: page(components) } : write(request)));
}

function run(recorder: FakeFetch, confirm: () => Promise<boolean> = () => Promise.resolve(true)): Promise<AssignmentOutcome> {
  const client = createVulpesClient({ baseUrl: BASE, fetch: recorder.fetch });
  return assignModelToItem(client, { itemId: ITEM_ID, modelKey: KEY, confirmReplace: confirm });
}

describe('assignModelToItem', () => {
  it('creates the component when the item has none', async () => {
    const recorder = backend([entry('c-food', 'minecraft:food', { nutrition: 4 })]);
    const outcome = await run(recorder);
    expect(outcome, 'the outcome').toEqual({ kind: 'assigned', mode: 'created' });
    const write = recorder.requests[1];
    expect(write?.method, 'the write method').toBe('PUT');
    expect(bodyOf(write), 'the body').toEqual({ componentKey: 'minecraft:item_model', value: KEY });
  });

  it('sends no write when the item already uses the model key', async () => {
    const recorder = backend([entry('c-model', 'minecraft:item_model', KEY)]);
    const outcome = await run(recorder);
    expect(outcome, 'the outcome').toEqual({ kind: 'already-assigned' });
    expect(recorder.requests.map((request) => request.method), 'the requests').toEqual(['GET']);
  });

  it('asks before it replaces another model, and names the old value', async () => {
    const recorder = backend([entry(OLD_ID, 'minecraft:item_model', 'vulpes:item/old')]);
    const asked: string[] = [];
    const outcome = await run(recorder, () => {
      asked.push('asked');
      return Promise.resolve(true);
    });
    expect(asked, 'the number of questions').toEqual(['asked']);
    expect(outcome, 'the outcome').toEqual({ kind: 'assigned', mode: 'replaced' });
  });

  it('updates the existing entry by its id after the designer confirms', async () => {
    const recorder = backend([entry(OLD_ID, 'minecraft:item_model', 'vulpes:item/old')]);
    await run(recorder);
    const write = recorder.requests[1];
    expect(write?.method, 'the write method').toBe('POST');
    expect(bodyOf(write), 'the body').toEqual({ id: OLD_ID, componentKey: 'minecraft:item_model', value: KEY });
  });

  it('writes nothing when the designer declines the replacement', async () => {
    const recorder = backend([entry(OLD_ID, 'minecraft:item_model', 'vulpes:item/old')]);
    const outcome = await run(recorder, () => Promise.resolve(false));
    expect(outcome, 'the outcome').toEqual({ kind: 'declined' });
    expect(recorder.requests.map((request) => request.method), 'the requests').toEqual(['GET']);
  });

  it('reports a 409 on create as a failed problem with status 409', async () => {
    const recorder = backend([], () => ({ status: 409, body: JSON.stringify({ title: 'Conflict', status: 409, code: 'RESOURCE_CONFLICT' }) }));
    const outcome = await run(recorder);
    expect(outcome.kind === 'failed' && outcome.failure.kind === 'problem' && outcome.failure.problem.status, 'the status').toBe(409);
  });

  it('reports a 404 on update as a failed problem with status 404', async () => {
    const recorder = backend([entry(OLD_ID, 'minecraft:item_model', 'vulpes:item/old')], () => ({
      status: 404,
      body: JSON.stringify({ title: 'Not found', status: 404, code: 'RESOURCE_NOT_FOUND' }),
    }));
    const outcome = await run(recorder);
    expect(outcome.kind === 'failed' && outcome.failure.kind === 'problem' && outcome.failure.problem.status, 'the status').toBe(404);
  });

  it('reports an unreachable backend while reading the components', async () => {
    const recorder = unreachableFetch('Failed to fetch');
    const outcome = await run(recorder);
    expect(outcome.kind === 'failed' && outcome.failure.kind, 'the failure kind').toBe('unreachable');
    expect(recorder.requests.length, 'the number of requests').toBe(1);
  });
});
