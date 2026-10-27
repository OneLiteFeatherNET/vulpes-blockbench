import { describe, expect, it } from 'vitest';
import type { EnvironmentProfile } from '../../src/environment/profiles';
import { resolveSaveTarget } from '../../src/environment/resolve-save-target';

const dev: EnvironmentProfile = { id: 'dev', baseUrl: 'http://localhost:8085' };
const prod: EnvironmentProfile = { id: 'prod', baseUrl: 'https://vulpes.example.org' };
const profiles = [dev, prod];

describe('resolveSaveTarget', () => {
  it('targets the reference URL when it matches the active profile', () => {
    expect(resolveSaveTarget({ baseUrl: dev.baseUrl }, dev, profiles)).toEqual({
      baseUrl: 'http://localhost:8085',
      isActive: true,
      targetName: 'dev',
    });
  });

  it('targets the other environment when the reference matches it', () => {
    expect(resolveSaveTarget({ baseUrl: dev.baseUrl }, prod, profiles)).toEqual({
      baseUrl: 'http://localhost:8085',
      isActive: false,
      targetName: 'dev',
    });
  });

  it('keeps the origin when it matches no profile', () => {
    expect(resolveSaveTarget({ baseUrl: 'https://old.example.org' }, prod, profiles)).toEqual({
      baseUrl: 'https://old.example.org',
      isActive: false,
      targetName: undefined,
    });
  });

  it('never targets the active URL when the reference differs from it', () => {
    expect(resolveSaveTarget({ baseUrl: dev.baseUrl }, prod, profiles).baseUrl).not.toBe(prod.baseUrl);
  });
});
