// The designer-facing message of a failed item call. A missing item and a component
// changed meanwhile have their own text; every other failure uses the problem mapping.

import { describeFailure, type ApiFailure, type UserMessage } from '../problem';

export function describeAssignmentFailure(failure: ApiFailure): UserMessage {
  if (failure.kind === 'problem') {
    if (failure.problem.status === 404) {
      return { key: 'vulpes.items.not_found', params: [] };
    }
    if (failure.problem.status === 409) {
      return { key: 'vulpes.items.changed', params: [] };
    }
  }
  return describeFailure(failure);
}
