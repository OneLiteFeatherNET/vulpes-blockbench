import { describe, expect, it } from 'vitest';
import { isRevisionsUnavailable, revisionFailureMessage } from '../../src/revisions/availability';
import type { ApiFailure, VulpesProblem } from '../../src/problem';

function problem(status: number, code: VulpesProblem['code'], title?: string): ApiFailure {
  return {
    kind: 'problem',
    problem: { status, code, title, detail: undefined, traceId: undefined, violations: [], etag: undefined },
  };
}

describe('isRevisionsUnavailable', () => {
  it('treats a 404 without a problem code as a backend without revisions', () => {
    expect(isRevisionsUnavailable(problem(404, undefined)), 'unavailable').toBe(true);
  });

  it('keeps a 404 with a known code as an ordinary failure', () => {
    expect(isRevisionsUnavailable(problem(404, 'PROJECT_NOT_FOUND')), 'unavailable').toBe(false);
  });

  it('does not treat a server error as a missing feature', () => {
    expect(isRevisionsUnavailable(problem(500, undefined)), 'unavailable').toBe(false);
  });

  it('does not treat an unreachable backend as a missing feature', () => {
    expect(isRevisionsUnavailable({ kind: 'unreachable', message: 'offline' }), 'unavailable').toBe(false);
  });
});

describe('revisionFailureMessage', () => {
  it('says that revisions are not available on this backend', () => {
    expect(revisionFailureMessage(problem(404, undefined)), 'the message').toEqual({ key: 'vulpes.revisions.unavailable', params: [] });
  });

  it('keeps the message of every other failure', () => {
    expect(revisionFailureMessage(problem(404, 'PROJECT_NOT_FOUND')).key, 'the key').toBe('vulpes.problem.project_not_found');
  });
});
