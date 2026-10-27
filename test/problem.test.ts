import { describe, expect, it } from 'vitest';
import {
  describeFailure,
  describeProblem,
  isErrorCode,
  problemFromResponse,
  type VulpesProblem,
} from '../src/problem';

const KEY_VIOLATION = {
  field: 'key',
  code: 'ASSET_KEY_INVALID',
  message: 'must be a resource location such as vulpes:item/ruby',
};

function problemBody(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'https://vulpes.onelitefeather.net/errors/resource-not-found',
    title: 'Resource not found',
    status: 404,
    detail: 'The asset was not found.',
    instance: '/project/p/asset/a/content',
    code: 'RESOURCE_NOT_FOUND',
    traceId: '0123456789abcdef0123456789abcdef',
    ...overrides,
  };
}

function problem(overrides: Partial<VulpesProblem>): VulpesProblem {
  return {
    status: 400,
    code: undefined,
    title: undefined,
    detail: undefined,
    traceId: undefined,
    violations: [],
    etag: undefined,
    ...overrides,
  };
}

describe('isErrorCode', () => {
  it('accepts a code that the backend defines', () => {
    expect(isErrorCode('ASSET_PRECONDITION_FAILED')).toBe(true);
  });

  it('rejects a code that the backend does not define', () => {
    expect(isErrorCode('SOMETHING_NEW')).toBe(false);
  });

  it('rejects a value that is not a string', () => {
    expect(isErrorCode(412)).toBe(false);
  });
});

describe('problemFromResponse', () => {
  it('reads the code, title, detail and trace id of a problem body', () => {
    const parsed = problemFromResponse(404, problemBody({}), undefined);
    expect(parsed.code, 'the code').toBe('RESOURCE_NOT_FOUND');
    expect(parsed.title, 'the title').toBe('Resource not found');
    expect(parsed.detail, 'the detail').toBe('The asset was not found.');
    expect(parsed.traceId, 'the trace id').toBe('0123456789abcdef0123456789abcdef');
  });

  it('reads each violation with its field, code and message', () => {
    const parsed = problemFromResponse(
      400,
      problemBody({ status: 400, code: 'VALIDATION_FAILED', errors: [KEY_VIOLATION] }),
      undefined,
    );
    expect(parsed.violations, 'the violations').toEqual([KEY_VIOLATION]);
  });

  it('drops a violation that lacks a string field', () => {
    const parsed = problemFromResponse(
      400,
      problemBody({ status: 400, code: 'VALIDATION_FAILED', errors: [{ code: 'X', message: 'no field' }] }),
      undefined,
    );
    expect(parsed.violations, 'the violations').toEqual([]);
  });

  it('treats an unknown code as no code', () => {
    const parsed = problemFromResponse(409, problemBody({ status: 409, code: 'SOMETHING_NEW' }), undefined);
    expect(parsed.code, 'the code').toBeUndefined();
    expect(parsed.title, 'the title is kept').toBe('Resource not found');
  });

  it('treats a body that is not problem details as having no code and no title', () => {
    const parsed = problemFromResponse(502, '<html>bad gateway</html>', undefined);
    expect(parsed.code, 'the code').toBeUndefined();
    expect(parsed.title, 'the title').toBeUndefined();
    expect(parsed.status, 'the status').toBe(502);
  });

  it('keeps the etag that the response header carried', () => {
    const parsed = problemFromResponse(412, problemBody({ status: 412 }), '"abc123"');
    expect(parsed.etag, 'the etag').toBe('"abc123"');
  });
});

describe('describeProblem', () => {
  it('names the message of a missing project', () => {
    expect(describeProblem(problem({ status: 404, code: 'PROJECT_NOT_FOUND' })).key).toBe('vulpes.problem.project_not_found');
  });

  it('names the message of a deleted model, which offers a copy', () => {
    expect(describeProblem(problem({ status: 404, code: 'RESOURCE_NOT_FOUND' })).key).toBe('vulpes.problem.model_deleted');
  });

  it('attaches a key violation to the key field and passes its message as a parameter', () => {
    const message = describeProblem(problem({ status: 400, code: 'VALIDATION_FAILED', violations: [KEY_VIOLATION] }));
    expect(message, 'the message').toEqual({ key: 'vulpes.problem.violation', params: [KEY_VIOLATION.message], field: 'key' });
  });

  it('shows a file violation as a rejected model file', () => {
    const message = describeProblem(
      problem({
        status: 400,
        code: 'VALIDATION_FAILED',
        violations: [{ field: 'file', code: 'ASSET_INVALID_CONTENT', message: 'is not a JSON object' }],
      }),
    );
    expect(message, 'the message').toEqual({ key: 'vulpes.problem.file_rejected', params: ['is not a JSON object'], field: 'file' });
  });

  it('describes a validation failure without a field violation generically', () => {
    const message = describeProblem(problem({ status: 400, code: 'VALIDATION_FAILED' }));
    expect(message, 'the message').toEqual({ key: 'vulpes.problem.validation', params: [] });
  });

  it('attaches a key conflict to the key field', () => {
    const message = describeProblem(problem({ status: 409, code: 'RESOURCE_CONFLICT' }));
    expect(message, 'the message').toEqual({ key: 'vulpes.problem.key_conflict', params: [], field: 'key' });
  });

  it('describes a precondition failure as a changed model', () => {
    expect(describeProblem(problem({ status: 412, code: 'ASSET_PRECONDITION_FAILED' })).key).toBe('vulpes.problem.changed');
  });

  it('passes the status and the detail of a request error, which is a plugin bug', () => {
    const message = describeProblem(
      problem({ status: 400, code: 'INVALID_REQUEST', detail: 'The file part is missing.' }),
    );
    expect(message, 'the message').toEqual({
      key: 'vulpes.problem.plugin_bug',
      params: ['400', 'The file part is missing.'],
    });
  });

  it('passes the trace id of an internal error', () => {
    const message = describeProblem(problem({ status: 500, code: 'INTERNAL_ERROR', traceId: 'trace-42' }));
    expect(message, 'the message').toEqual({ key: 'vulpes.problem.internal', params: ['trace-42'] });
  });

  it('names the 8 MB limit for a 413 without a code', () => {
    expect(describeProblem(problem({ status: 413 })).key).toBe('vulpes.problem.too_large');
  });

  it('asks for a sign-in on 401 without a code', () => {
    expect(describeProblem(problem({ status: 401 })).key).toBe('vulpes.problem.sign_in');
  });

  it('passes the HTTP status and the title for an unknown code', () => {
    const message = describeProblem(problem({ status: 418, title: 'I am a teapot' }));
    expect(message, 'the message').toEqual({ key: 'vulpes.problem.http_title', params: ['418', 'I am a teapot'] });
  });

  it('passes only the HTTP status when the body had no title or detail', () => {
    expect(describeProblem(problem({ status: 502 })), 'the message').toEqual({ key: 'vulpes.problem.http_status', params: ['502'] });
  });
});

describe('describeFailure', () => {
  it('passes the reason when Vulpes cannot be reached', () => {
    const message = describeFailure({ kind: 'unreachable', message: 'Failed to fetch' });
    expect(message, 'the message').toEqual({ key: 'vulpes.problem.unreachable', params: ['Failed to fetch'] });
  });

  it('passes the status of a response the plugin cannot read', () => {
    const message = describeFailure({ kind: 'unexpected', status: 200 });
    expect(message, 'the message').toEqual({ key: 'vulpes.problem.unexpected', params: ['200'] });
  });

  it('delegates a problem response to describeProblem', () => {
    const message = describeFailure({ kind: 'problem', problem: problem({ status: 404, code: 'PROJECT_NOT_FOUND' }) });
    expect(message.key).toBe('vulpes.problem.project_not_found');
  });

  it('names the refusal of a request without a version tag', () => {
    expect(describeFailure({ kind: 'refused' })).toEqual({ key: 'vulpes.problem.refused', params: [] });
  });
});
