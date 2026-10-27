import { describe, expect, it } from 'vitest';
import { isRouteMissing } from '../../src/live/availability';
import { problemFromResponse, type ApiFailure } from '../../src/problem';

function problemFailure(status: number, body: unknown): ApiFailure {
  return { kind: 'problem', problem: problemFromResponse(status, body, undefined) };
}

describe('isRouteMissing', () => {
  it('reports a 404 without a problem code as a missing route', () => {
    expect(isRouteMissing(problemFailure(404, undefined)), 'a bare 404').toBe(true);
  });

  it('does not report a 404 that carries a problem code', () => {
    const body = { title: 'Not Found', status: 404, code: 'RESOURCE_NOT_FOUND' };
    expect(isRouteMissing(problemFailure(404, body)), 'a 404 with RESOURCE_NOT_FOUND').toBe(false);
  });

  it('does not report a 500 without a problem code', () => {
    expect(isRouteMissing(problemFailure(500, undefined)), 'a bare 500').toBe(false);
  });

  it('does not report a failure without a response', () => {
    expect(isRouteMissing({ kind: 'unreachable', message: 'offline' }), 'an unreachable backend').toBe(false);
  });

  it('does not report an unexpected body as a missing route', () => {
    expect(isRouteMissing({ kind: 'unexpected', status: 404 }), 'a 404 whose body did not fit').toBe(false);
  });
});
