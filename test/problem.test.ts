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
  it('tells the designer that the project no longer exists', () => {
    expect(describeProblem(problem({ status: 404, code: 'PROJECT_NOT_FOUND' })).text).toContain('no longer exists');
  });

  it('tells the designer that the model was deleted and offers a copy', () => {
    const message = describeProblem(problem({ status: 404, code: 'RESOURCE_NOT_FOUND' })).text;
    expect(message).toContain('deleted in Vulpes');
    expect(message).toContain('Save as copy');
  });

  it('attaches a key violation to the key field and shows its message', () => {
    const message = describeProblem(
      problem({ status: 400, code: 'VALIDATION_FAILED', violations: [KEY_VIOLATION] }),
    );
    expect(message.field, 'the field').toBe('key');
    expect(message.text).toBe(KEY_VIOLATION.message);
  });

  it('shows a file violation as a rejected model file', () => {
    const message = describeProblem(
      problem({
        status: 400,
        code: 'VALIDATION_FAILED',
        violations: [{ field: 'file', code: 'ASSET_INVALID_CONTENT', message: 'is not a JSON object' }],
      }),
    );
    expect(message.field, 'the field').toBe('file');
    expect(message.text).toContain('rejected the model file');
    expect(message.text).toContain('is not a JSON object');
  });

  it('describes a validation failure without a field violation generically', () => {
    const message = describeProblem(problem({ status: 400, code: 'VALIDATION_FAILED' }));
    expect(message.field, 'the field').toBeUndefined();
    expect(message.text).toContain('Vulpes rejected the request');
  });

  it('attaches a key conflict to the key field and explains a possible earlier save', () => {
    const message = describeProblem(problem({ status: 409, code: 'RESOURCE_CONFLICT' }));
    expect(message.field, 'the field').toBe('key');
    expect(message.text).toContain('already exists');
    expect(message.text).toContain('open the model from Vulpes');
  });

  it('describes a precondition failure as a changed model', () => {
    const message = describeProblem(problem({ status: 412, code: 'ASSET_PRECONDITION_FAILED' }));
    expect(message.text).toContain('changed in Vulpes');
  });

  it('shows the detail of a request error and names it as a plugin bug', () => {
    const message = describeProblem(
      problem({ status: 400, code: 'INVALID_REQUEST', detail: 'The file part is missing.' }),
    );
    expect(message.text).toContain('plugin bug');
    expect(message.text).toContain('The file part is missing.');
  });

  it('shows the trace id of an internal error', () => {
    const message = describeProblem(
      problem({ status: 500, code: 'INTERNAL_ERROR', traceId: 'trace-42' }),
    );
    expect(message.text).toContain('trace-42');
  });

  it('explains the 8 MB limit for a 413 without a code', () => {
    const message = describeProblem(problem({ status: 413 }));
    expect(message.text).toContain('8 MB');
  });

  it('asks for a sign-in on 401 without a code', () => {
    expect(describeProblem(problem({ status: 401 })).text).toContain('Sign in again');
  });

  it('shows the HTTP status and the title for an unknown code', () => {
    const message = describeProblem(problem({ status: 418, title: 'I am a teapot' }));
    expect(message.text).toContain('HTTP 418');
    expect(message.text).toContain('I am a teapot');
  });

  it('shows only the HTTP status when the body had no title or detail', () => {
    expect(describeProblem(problem({ status: 502 })).text).toBe('Vulpes answered HTTP 502.');
  });
});

describe('describeFailure', () => {
  it('says that Vulpes cannot be reached and that local work is kept', () => {
    const message = describeFailure({ kind: 'unreachable', message: 'Failed to fetch' });
    expect(message.text).toContain('cannot be reached');
    expect(message.text).toContain('Local work is kept');
  });

  it('says that the response was not understood, with its status', () => {
    const message = describeFailure({ kind: 'unexpected', status: 200 });
    expect(message.text).toContain('HTTP 200');
  });

  it('delegates a problem response to describeProblem', () => {
    const message = describeFailure({ kind: 'problem', problem: problem({ status: 404, code: 'PROJECT_NOT_FOUND' }) });
    expect(message.text).toContain('no longer exists');
  });
});

describe('describeFailure for a refused request', () => {
  it('explains that nothing was sent and that the model must be opened again', () => {
    const message = describeFailure({ kind: 'refused' });
    expect(message.text).toContain('Nothing was sent');
    expect(message.text).toContain('Open it from Vulpes again');
  });
});
