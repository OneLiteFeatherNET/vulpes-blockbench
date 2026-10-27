import { describe, expect, it } from 'vitest';
import { fileNameForKey } from '../../src/link/display-name';

describe('fileNameForKey', () => {
  it('takes the last segment of a flat key', () => {
    expect(fileNameForKey('vulpes:item/ruby')).toBe('ruby.bbmodel');
  });

  it('takes the last segment of a nested key', () => {
    expect(fileNameForKey('vulpes:item/nested/ruby')).toBe('ruby.bbmodel');
  });

  it('falls back to model when the key ends in a separator', () => {
    expect(fileNameForKey('vulpes:item/')).toBe('model.bbmodel');
  });

  it('never returns a vulpes path', () => {
    expect(fileNameForKey('vulpes:item/ruby')).not.toContain('vulpes://');
  });
});
