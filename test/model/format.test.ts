import { describe, expect, it } from 'vitest';
import { formatIdOf } from '../../src/model/format';

describe('formatIdOf', () => {
  it('reads the model format from the meta block', () => {
    expect(formatIdOf({ meta: { model_format: 'java_block' } })).toBe('java_block');
  });

  it('falls back to free when the meta block is missing', () => {
    expect(formatIdOf({ elements: [] })).toBe('free');
  });

  it('falls back to free when the model format is not a string', () => {
    expect(formatIdOf({ meta: { model_format: 3 } })).toBe('free');
  });

  it('falls back to free for a value that is not a model', () => {
    expect(formatIdOf('not a model')).toBe('free');
  });
});
