import { describe, expect, it } from 'vitest';
import type { ApiFailure, VulpesProblem } from '../../src/problem';
import { describeAssignmentFailure } from '../../src/items/messages';

function problemWith(status: number, code: VulpesProblem['code']): ApiFailure {
  return {
    kind: 'problem',
    problem: { status, code, title: undefined, detail: undefined, traceId: undefined, violations: [], etag: undefined },
  };
}

describe('describeAssignmentFailure', () => {
  it('says that the item no longer exists on 404', () => {
    expect(describeAssignmentFailure(problemWith(404, 'RESOURCE_NOT_FOUND')).key, 'the key').toBe('vulpes.items.not_found');
  });

  it('says that the item changed meanwhile on 409', () => {
    expect(describeAssignmentFailure(problemWith(409, 'RESOURCE_CONFLICT')).key, 'the key').toBe('vulpes.items.changed');
  });

  it('uses the problem mapping for other errors', () => {
    expect(describeAssignmentFailure(problemWith(500, 'INTERNAL_ERROR')).key, 'the key').toBe('vulpes.problem.internal');
  });

  it('uses the unreachable message when no response arrived', () => {
    expect(describeAssignmentFailure({ kind: 'unreachable', message: 'offline' }).key, 'the key').toBe('vulpes.problem.unreachable');
  });
});
