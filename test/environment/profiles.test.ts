import { describe, expect, it } from 'vitest';
import { defaultSnapshot, requiresConfirmation } from '../../src/environment/profiles';

describe('defaultSnapshot', () => {
  it('defaults to dev with the local backend URL and an empty prod URL', () => {
    expect(defaultSnapshot()).toEqual({
      active: 'dev',
      baseUrls: { dev: 'http://localhost:8085', prod: '' },
    });
  });
});

describe('requiresConfirmation', () => {
  it('asks before switching from dev to prod', () => {
    expect(requiresConfirmation('dev', 'prod')).toBe(true);
  });

  it('does not ask before switching from prod to dev', () => {
    expect(requiresConfirmation('prod', 'dev')).toBe(false);
  });

  it('does not ask when the active environment stays prod', () => {
    expect(requiresConfirmation('prod', 'prod')).toBe(false);
  });
});
