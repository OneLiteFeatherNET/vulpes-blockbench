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

/**
 * A message for the designer: a key of the translation table, its parameters, and the
 * input it belongs to. The glue passes it through `tl()`, so no English text lives here.
 */
export interface UserMessage {
  readonly key: string;
  readonly params: readonly string[];
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
      return { key: 'vulpes.problem.project_not_found', params: [] };
    case 'RESOURCE_NOT_FOUND':
      return { key: 'vulpes.problem.model_deleted', params: [] };
    case 'VALIDATION_FAILED': {
      const key = firstViolation(problem, 'key');
      if (key !== undefined) {
        return { key: 'vulpes.problem.violation', params: [key.message], field: 'key' };
      }
      const file = firstViolation(problem, 'file');
      if (file !== undefined) {
        return { key: 'vulpes.problem.file_rejected', params: [file.message], field: 'file' };
      }
      const first = problem.violations[0];
      return first === undefined
        ? { key: 'vulpes.problem.validation', params: [] }
        : { key: 'vulpes.problem.validation_detail', params: [first.message] };
    }
    case 'RESOURCE_CONFLICT':
      return { key: 'vulpes.problem.key_conflict', params: [], field: 'key' };
    case 'ASSET_PRECONDITION_FAILED':
      return { key: 'vulpes.problem.changed', params: [] };
    case 'INVALID_REQUEST':
    case 'METHOD_NOT_ALLOWED':
    case 'UNSUPPORTED_MEDIA_TYPE':
      return {
        key: 'vulpes.problem.plugin_bug',
        params: [String(problem.status), problem.detail ?? problem.title ?? ''],
      };
    case 'INTERNAL_ERROR':
      return { key: 'vulpes.problem.internal', params: [problem.traceId ?? 'none'] };
    case undefined:
      return describeWithoutCode(problem);
  }
}

function describeWithoutCode(problem: VulpesProblem): UserMessage {
  if (problem.status === 413) {
    return { key: 'vulpes.problem.too_large', params: [] };
  }
  if (problem.status === 401) {
    return { key: 'vulpes.problem.sign_in', params: [] };
  }
  const label = problem.title ?? problem.detail;
  return label === undefined
    ? { key: 'vulpes.problem.http_status', params: [String(problem.status)] }
    : { key: 'vulpes.problem.http_title', params: [String(problem.status), label] };
}

/** The message for a request that produced no problem body: no response, or a response the plugin cannot read. */
export function describeFailure(failure: ApiFailure): UserMessage {
  switch (failure.kind) {
    case 'unreachable':
      return { key: 'vulpes.problem.unreachable', params: [failure.message] };
    case 'problem':
      return describeProblem(failure.problem);
    case 'unexpected':
      return { key: 'vulpes.problem.unexpected', params: [String(failure.status)] };
    case 'refused':
      return { key: 'vulpes.problem.refused', params: [] };
  }
}
