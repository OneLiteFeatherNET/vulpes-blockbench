import { describe, expect, it } from 'vitest';
import { buildVulpesPath, parseVulpesPath } from '../../src/link/vulpes-path';

const ruby = { environment: 'dev', projectId: 'p1', assetId: 'a1' } as const;

describe('vulpes path', () => {
  it('parses back the path it was built from', () => {
    expect(parseVulpesPath(buildVulpesPath(ruby))).toEqual(ruby);
  });

  it('builds the documented form', () => {
    expect(buildVulpesPath(ruby)).toBe('vulpes://dev/p1/a1');
  });

  it('keeps a slash inside an id from splitting the path', () => {
    const nested = { environment: 'prod', projectId: 'a/b', assetId: 'c' } as const;
    expect(parseVulpesPath(buildVulpesPath(nested))).toEqual(nested);
  });

  it('rejects an unknown environment', () => {
    expect(parseVulpesPath('vulpes://staging/p1/a1')).toBeUndefined();
  });

  it('rejects a path with a missing segment', () => {
    expect(parseVulpesPath('vulpes://dev/p1')).toBeUndefined();
  });

  it('rejects a path with an empty id', () => {
    expect(parseVulpesPath('vulpes://dev//a1')).toBeUndefined();
  });

  it('rejects a path with another scheme', () => {
    expect(parseVulpesPath('https://dev/p1/a1')).toBeUndefined();
  });

  it('rejects a malformed escape instead of throwing', () => {
    expect(parseVulpesPath('vulpes://dev/%E0%A4%A/a1')).toBeUndefined();
  });
});
