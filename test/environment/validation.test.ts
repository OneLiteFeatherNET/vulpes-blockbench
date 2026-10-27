import { describe, expect, it } from 'vitest';
import { requireBaseUrl, validateBaseUrl } from '../../src/environment/validation';

describe('validateBaseUrl', () => {
  it('removes a trailing slash from a valid URL', () => {
    expect(validateBaseUrl('http://localhost:8085/', 'dev')).toEqual({
      ok: true,
      value: 'http://localhost:8085',
    });
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateBaseUrl('  http://localhost:8085  ', 'dev')).toEqual({
      ok: true,
      value: 'http://localhost:8085',
    });
  });

  it('accepts an empty URL as not configured for prod', () => {
    expect(validateBaseUrl('', 'prod')).toEqual({ ok: true, value: '' });
  });

  it('rejects a value that does not parse as a URL', () => {
    expect(validateBaseUrl('not a url', 'dev')).toEqual({ ok: false, reason: 'unparseable' });
  });

  it('rejects a protocol other than http or https', () => {
    expect(validateBaseUrl('ftp://vulpes.example.org', 'dev')).toEqual({
      ok: false,
      reason: 'protocol',
    });
  });

  it('rejects a query string', () => {
    expect(validateBaseUrl('https://vulpes.example.org/?debug=1', 'prod')).toEqual({
      ok: false,
      reason: 'query-or-fragment',
    });
  });

  it('rejects a fragment', () => {
    expect(validateBaseUrl('https://vulpes.example.org/#top', 'prod')).toEqual({
      ok: false,
      reason: 'query-or-fragment',
    });
  });

  it('accepts http for dev on a non-local host', () => {
    expect(validateBaseUrl('http://vulpes.example.org', 'dev')).toEqual({
      ok: true,
      value: 'http://vulpes.example.org',
    });
  });

  it('rejects http for prod on a public host', () => {
    expect(validateBaseUrl('http://vulpes.example.org', 'prod')).toEqual({
      ok: false,
      reason: 'prod-requires-https',
    });
  });

  it('accepts https for prod on a public host', () => {
    expect(validateBaseUrl('https://vulpes.example.org', 'prod')).toEqual({
      ok: true,
      value: 'https://vulpes.example.org',
    });
  });

  it('accepts http for prod on localhost', () => {
    expect(validateBaseUrl('http://localhost:8085', 'prod')).toEqual({
      ok: true,
      value: 'http://localhost:8085',
    });
  });

  it('accepts http for prod on 127.0.0.1', () => {
    expect(validateBaseUrl('http://127.0.0.1:8085', 'prod')).toEqual({
      ok: true,
      value: 'http://127.0.0.1:8085',
    });
  });
});

describe('requireBaseUrl', () => {
  it('returns the base URL of a configured profile', () => {
    expect(requireBaseUrl({ id: 'dev', baseUrl: 'http://localhost:8085' })).toEqual({
      ok: true,
      baseUrl: 'http://localhost:8085',
    });
  });

  it('reports not configured for a profile with an empty base URL', () => {
    expect(requireBaseUrl({ id: 'prod', baseUrl: '' })).toEqual({
      ok: false,
      reason: 'not-configured',
    });
  });
});
