import { describe, expect, it } from 'vitest';
import { defaultSnapshot } from '../../src/environment/profiles';
import { parseSnapshot } from '../../src/environment/snapshot';

describe('parseSnapshot', () => {
  it('falls back to the defaults for a value that is not an object', () => {
    expect(parseSnapshot('dev'), 'a string is not a snapshot').toEqual(defaultSnapshot());
  });

  it('falls back to the defaults for null', () => {
    expect(parseSnapshot(null), 'null is not a snapshot').toEqual(defaultSnapshot());
  });

  it('falls back to dev for an unknown active profile id', () => {
    const raw = { active: 'staging', baseUrls: { dev: 'http://localhost:8085', prod: '' } };
    expect(parseSnapshot(raw).active).toBe('dev');
  });

  it('keeps a valid stored Dev URL', () => {
    const raw = { active: 'dev', baseUrls: { dev: 'http://localhost:9000/', prod: '' } };
    expect(parseSnapshot(raw).baseUrls.dev).toBe('http://localhost:9000');
  });

  it('falls back to the default for a stored URL that fails validation', () => {
    const raw = { active: 'prod', baseUrls: { dev: 'http://localhost:8085', prod: 'http://example.org' } };
    expect(parseSnapshot(raw).baseUrls.prod).toBe('');
  });

  it('falls back to the defaults for a missing baseUrls field', () => {
    expect(parseSnapshot({ active: 'prod' })).toEqual({ ...defaultSnapshot(), active: 'prod' });
  });
});
