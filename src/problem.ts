// Reads the error bodies of the Vulpes API (RFC 9457 problem details with the
// extension members `code`, `traceId` and `errors`) and turns them into messages.
// Branches on `code` only. The `type` URI is documentation and is never matched.

import { isRecord } from './json';

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'INVALID_REQUEST',
  'RESOURCE_NOT_FOUND',
  'PROJECT_NOT_FOUND',
  'RESOURCE_CONFLICT',
  'ASSET_PRECONDITION_FAILED',
  'METHOD_NOT_ALLOWED',
  'UNSUPPORTED_MEDIA_TYPE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return ERROR_CODES.some((code) => code === value);
}

export interface Violation {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

/** An error response of the Vulpes API. Fields the body did not carry are undefined. */
export interface VulpesProblem {
  readonly status: number;
  /** The problem `code`, or undefined when it is missing or not one this plugin knows. */
  readonly code: ErrorCode | undefined;
  readonly title: string | undefined;
  readonly detail: string | undefined;
  readonly traceId: string | undefined;
  readonly violations: readonly Violation[];
  /** The `ETag` header of the response, exactly as received. */
  readonly etag: string | undefined;
}

/** Why a request did not produce its result. */
export type ApiFailure =
  | { readonly kind: 'unreachable'; readonly message: string }
  | { readonly kind: 'problem'; readonly problem: VulpesProblem }
  | { readonly kind: 'unexpected'; readonly status: number }
  /** The request was not sent, because a replacement needs a valid ETag. */
  | { readonly kind: 'refused' };

/** A message for the designer. `field` names the input the message belongs to. */
export interface UserMessage {
  readonly text: string;
  readonly field?: 'key' | 'file';
}

type Fields = Record<string, unknown>;

/** A body counts as problem details only when it carries a title and a numeric status. */
function isProblemBody(body: unknown): body is Fields {
  return isRecord(body) && typeof body['title'] === 'string' && typeof body['status'] === 'number';
}

function readViolation(value: unknown): Violation | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const field = value['field'];
  const code = value['code'];
  const message = value['message'];
  if (typeof field !== 'string' || typeof code !== 'string' || typeof message !== 'string') {
    return undefined;
  }
  return { field, code, message };
}

/** Builds the problem of one error response. `body` is the parsed JSON, or undefined when it was not JSON. */
export function problemFromResponse(status: number, body: unknown, etag: string | undefined): VulpesProblem {
  if (!isProblemBody(body)) {
    return { status, code: undefined, title: undefined, detail: undefined, traceId: undefined, violations: [], etag };
  }
  const code = body['code'];
  const title = body['title'];
  const detail = body['detail'];
  const traceId = body['traceId'];
  const errors = Array.isArray(body['errors']) ? body['errors'] : [];
  const violations: Violation[] = [];
  for (const entry of errors) {
    const violation = readViolation(entry);
    if (violation !== undefined) {
      violations.push(violation);
    }
  }
  return {
    status,
    code: isErrorCode(code) ? code : undefined,
    title: typeof title === 'string' ? title : undefined,
    detail: typeof detail === 'string' ? detail : undefined,
    traceId: typeof traceId === 'string' ? traceId : undefined,
    violations,
    etag,
  };
}

function firstViolation(problem: VulpesProblem, field: string): Violation | undefined {
  return problem.violations.find((violation) => violation.field === field);
}

/** The message for an error response, chosen by its code. */
export function describeProblem(problem: VulpesProblem): UserMessage {
  switch (problem.code) {
    case 'PROJECT_NOT_FOUND':
      return { text: 'The project no longer exists in Vulpes. Pick another project.' };
    case 'RESOURCE_NOT_FOUND':
      return { text: 'The model was deleted in Vulpes. Use "Save as copy" to keep your work.' };
    case 'VALIDATION_FAILED': {
      const key = firstViolation(problem, 'key');
      if (key !== undefined) {
        return { text: key.message, field: 'key' };
      }
      const file = firstViolation(problem, 'file');
      if (file !== undefined) {
        return { text: `Vulpes rejected the model file: ${file.message}`, field: 'file' };
      }
      const first = problem.violations[0];
      return { text: first === undefined ? 'Vulpes rejected the request.' : `Vulpes rejected the request: ${first.message}` };
    }
    case 'RESOURCE_CONFLICT':
      return {
        text: 'A model or texture with this key already exists. Choose another key. If an earlier save may have succeeded, open the model from Vulpes instead.',
        field: 'key',
      };
    case 'ASSET_PRECONDITION_FAILED':
      return { text: 'The model changed in Vulpes since it was opened.' };
    case 'INVALID_REQUEST':
    case 'METHOD_NOT_ALLOWED':
    case 'UNSUPPORTED_MEDIA_TYPE':
      return {
        text: `This is a plugin bug (HTTP ${String(problem.status)}): ${problem.detail ?? problem.title ?? 'no detail given'}`,
      };
    case 'INTERNAL_ERROR':
      return { text: `Vulpes failed on its side. Trace ID: ${problem.traceId ?? 'none'}.` };
    case undefined:
      return describeWithoutCode(problem);
  }
}

function describeWithoutCode(problem: VulpesProblem): UserMessage {
  if (problem.status === 413) {
    return { text: 'The model is larger than 8 MB. Reduce the embedded textures.' };
  }
  if (problem.status === 401) {
    return { text: 'Sign in again.' };
  }
  const label = problem.title ?? problem.detail;
  return { text: label === undefined ? `Vulpes answered HTTP ${String(problem.status)}.` : `Vulpes answered HTTP ${String(problem.status)}: ${label}` };
}

/** The message for a request that produced no problem body: no response, or a response the plugin cannot read. */
export function describeFailure(failure: ApiFailure): UserMessage {
  switch (failure.kind) {
    case 'unreachable':
      return { text: `Vulpes cannot be reached (${failure.message}). Local work is kept.` };
    case 'problem':
      return describeProblem(failure.problem);
    case 'unexpected':
      return { text: `Vulpes sent a response this plugin cannot read (HTTP ${String(failure.status)}).` };
    case 'refused':
      return { text: 'Nothing was sent: this model has no version tag from Vulpes. Open it from Vulpes again.' };
  }
}
