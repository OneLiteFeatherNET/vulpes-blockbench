// Tells a backend without revisions apart from every other failure. An older backend
// answers 404 on the revision routes without a problem code; a 404 with a code is a real
// answer (for example PROJECT_NOT_FOUND) and keeps its own message.

import { describeFailure, type ApiFailure, type UserMessage } from '../problem';

export function isRevisionsUnavailable(failure: ApiFailure): boolean {
  return failure.kind === 'problem' && failure.problem.status === 404 && failure.problem.code === undefined;
}

export function revisionFailureMessage(failure: ApiFailure): UserMessage {
  return isRevisionsUnavailable(failure) ? { key: 'vulpes.revisions.unavailable', params: [] } : describeFailure(failure);
}
