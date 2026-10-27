import { describe, expect, it } from 'vitest';
import { defaultSnapshot } from '../../src/environment/profiles';
import { loadSnapshot, type EnvironmentStorage } from '../../src/environment/storage';
import { memoryStorage } from './memory-storage';

const throwingStorage: EnvironmentStorage = {
  read(): unknown {
    throw new Error('storage unavailable');
  },
};

describe('loadSnapshot', () => {
  it('loads the stored snapshot', () => {
    const stored = { active: 'prod', baseUrls: { dev: 'http://localhost:8085', prod: 'https://v.example.org' } };
    expect(loadSnapshot(memoryStorage(stored)).active).toBe('prod');
  });

  it('returns the defaults when nothing is stored', () => {
    expect(loadSnapshot(memoryStorage(undefined))).toEqual(defaultSnapshot());
  });

  it('returns the defaults when reading throws', () => {
    expect(loadSnapshot(throwingStorage), 'a throwing read must not stop Blockbench').toEqual(
      defaultSnapshot(),
    );
  });
});
