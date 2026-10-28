// Validates the signaling host of an environment. The host is a bare host name: no scheme,
// port, path or space. An empty value disables live editing for the environment.

export type SignalingHostProblem = 'space' | 'scheme' | 'path' | 'port' | 'characters';

export type SignalingHostResult =
  | { readonly ok: true; readonly host: string | undefined }
  | { readonly ok: false; readonly reason: SignalingHostProblem };

// Dot-separated labels of lowercase letters, digits and hyphens. A label neither starts nor ends with a hyphen.
const HOST_NAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/u;

function refuse(reason: SignalingHostProblem): SignalingHostResult {
  return { ok: false, reason };
}

/** Returns the host to use, `host: undefined` when the value is empty, or the reason it was refused. */
export function validateSignalingHost(value: string): SignalingHostResult {
  if (value === '') {
    return { ok: true, host: undefined };
  }
  if (/\s/u.test(value)) {
    return refuse('space');
  }
  if (value.includes('://')) {
    return refuse('scheme');
  }
  if (value.includes('/')) {
    return refuse('path');
  }
  if (value.includes(':')) {
    return refuse('port');
  }
  if (!HOST_NAME.test(value)) {
    return refuse('characters');
  }
  return { ok: true, host: value };
}
