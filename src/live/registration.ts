// The registry client of live sessions. It reads, sets and removes the registration of
// one asset's live session. Like the asset client, it never throws and never sends a
// request that the backend would have to refuse for lack of a precondition.

import type { ApiResult } from '../api/client';
import type { HttpRequest, HttpResponse } from '../api/http';
import { isRecord, parseJsonText } from '../json';
import { problemFromResponse, type ApiFailure } from '../problem';

/**
 * The registry sends DELETE, which the asset client's `HttpRequest` does not allow. The
 * registry therefore has its own request and fetch shapes, with the same fields.
 */
export type LiveHttpMethod = 'GET' | 'PUT' | 'DELETE';

export interface LiveHttpRequest extends Omit<HttpRequest, 'method'> {
  readonly method: LiveHttpMethod;
}

/** Sends one registry request. It rejects when no response arrives. */
export type LiveFetch = (request: LiveHttpRequest) => Promise<HttpResponse>;

/** The live session registered for an asset. The times are the backend's ISO strings, kept as they came. */
export interface LiveRegistration {
  readonly token: string;
  readonly host: string;
  readonly startedAt: string;
  readonly expiresAt: string;
}

export interface LiveRegistrationRequest {
  readonly token: string;
  readonly host: string;
}

export interface LiveRegistryOptions {
  readonly baseUrl: string;
  readonly fetch: LiveFetch;
  /** Returns the bearer token, or nothing. Omitted until sign-in exists. */
  readonly token?: () => string | undefined;
}

export interface LiveRegistryClient {
  /** The registration of the asset, or undefined when no session is registered. */
  readRegistration(projectId: string, assetId: string): Promise<ApiResult<LiveRegistration | undefined>>;
  /** Creates or refreshes the registration. A 409 means another session is registered (see `isRegistrationConflict`). */
  register(projectId: string, assetId: string, request: LiveRegistrationRequest): Promise<ApiResult<LiveRegistration>>;
  /** Removes the registration that carries this token. */
  removeRegistration(projectId: string, assetId: string, token: string): Promise<ApiResult<undefined>>;
}

function text(record: Record<string, unknown>, name: string): string | undefined {
  const value = record[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Reads a registration body. Returns undefined when a field is missing or the body is not a record. */
export function parseRegistration(value: unknown): LiveRegistration | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const token = text(value, 'token');
  const host = text(value, 'host');
  const startedAt = text(value, 'startedAt');
  const expiresAt = text(value, 'expiresAt');
  if (token === undefined || host === undefined || startedAt === undefined || expiresAt === undefined) {
    return undefined;
  }
  return { token, host, startedAt, expiresAt };
}

/** True when the failure is a 409: another live session is registered for the asset. */
export function isRegistrationConflict(failure: ApiFailure): boolean {
  return failure.kind === 'problem' && failure.problem.status === 409;
}

interface Reply {
  readonly status: number;
  readonly text: string;
}

type Exchange = { readonly kind: 'reply'; readonly reply: Reply } | { readonly kind: 'unreachable'; readonly message: string };

const JSON_CONTENT_TYPE = 'application/json';

function isSuccess(status: number): boolean {
  return status >= 200 && status <= 299;
}

function failureOf(reply: Reply): ApiFailure {
  return { kind: 'problem', problem: problemFromResponse(reply.status, parseJsonText(reply.text), undefined) };
}

function readReply<T>(reply: Reply, accept: (body: unknown) => T | undefined): ApiResult<T> {
  if (!isSuccess(reply.status)) {
    return { ok: false, failure: failureOf(reply) };
  }
  const value = accept(parseJsonText(reply.text));
  return value === undefined ? { ok: false, failure: { kind: 'unexpected', status: reply.status } } : { ok: true, value };
}

export function createLiveRegistryClient(options: LiveRegistryOptions): LiveRegistryClient {
  const root = options.baseUrl.replace(/\/+$/u, '');

  const authorization = (): Record<string, string> => {
    const token = options.token?.();
    return token === undefined || token === '' ? {} : { Authorization: `Bearer ${token}` };
  };

  const liveSessionUrl = (projectId: string, assetId: string): string =>
    `${root}/project/${encodeURIComponent(projectId)}/asset/${encodeURIComponent(assetId)}/live-session`;

  const exchange = async (request: LiveHttpRequest): Promise<Exchange> => {
    try {
      const response = await options.fetch(request);
      const body = await response.text();
      return { kind: 'reply', reply: { status: response.status, text: body } };
    } catch (error: unknown) {
      return { kind: 'unreachable', message: error instanceof Error ? error.message : 'unknown network error' };
    }
  };

  const send = async <T>(request: LiveHttpRequest, accept: (body: unknown) => T | undefined): Promise<ApiResult<T>> => {
    const outcome = await exchange(request);
    return outcome.kind === 'unreachable'
      ? { ok: false, failure: { kind: 'unreachable', message: outcome.message } }
      : readReply(outcome.reply, accept);
  };

  return {
    readRegistration: async (projectId, assetId) => {
      const outcome = await exchange({ method: 'GET', url: liveSessionUrl(projectId, assetId), headers: authorization() });
      if (outcome.kind === 'unreachable') {
        return { ok: false, failure: { kind: 'unreachable', message: outcome.message } };
      }
      // A 404 with a problem code is the backend's answer "none". A bare 404 means the route is missing.
      if (outcome.reply.status === 404) {
        const problem = problemFromResponse(404, parseJsonText(outcome.reply.text), undefined);
        return problem.code === undefined ? { ok: false, failure: { kind: 'problem', problem } } : { ok: true, value: undefined };
      }
      return readReply(outcome.reply, parseRegistration);
    },

    register: (projectId, assetId, request) =>
      send(
        {
          method: 'PUT',
          url: liveSessionUrl(projectId, assetId),
          headers: { ...authorization(), 'Content-Type': JSON_CONTENT_TYPE },
          json: JSON.stringify({ token: request.token, host: request.host }),
        },
        parseRegistration,
      ),

    removeRegistration: async (projectId, assetId, token) => {
      const outcome = await exchange({
        method: 'DELETE',
        url: `${liveSessionUrl(projectId, assetId)}?token=${encodeURIComponent(token)}`,
        headers: authorization(),
      });
      if (outcome.kind === 'unreachable') {
        return { ok: false, failure: { kind: 'unreachable', message: outcome.message } };
      }
      return isSuccess(outcome.reply.status) ? { ok: true, value: undefined } : { ok: false, failure: failureOf(outcome.reply) };
    },
  };
}
