// Recognises a backend that predates live sessions. Such a backend answers 404 on the
// live-session and events routes without a problem code. A registration that is absent
// is also a 404, but it carries a code, so the two are told apart by the code.

import type { ApiFailure } from '../problem';

/** True when the request reached a backend that has no such route. */
export function isRouteMissing(failure: ApiFailure): boolean {
  return failure.kind === 'problem' && failure.problem.status === 404 && failure.problem.code === undefined;
}
