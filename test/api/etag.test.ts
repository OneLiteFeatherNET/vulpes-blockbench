import { describe, expect, it } from 'vitest';
import { parseEntityTag } from '../../src/api/http';

describe('parseEntityTag', () => {
  it('accepts a quoted strong ETag and returns it unchanged', () => {
    expect(parseEntityTag('"0a1b2c"')).toBe('"0a1b2c"');
  });

  it('rejects a weak ETag, because the backend never matches W/ values', () => {
    expect(parseEntityTag('W/"0a1b2c"')).toBeUndefined();
  });

  it('rejects an ETag without quotes', () => {
    expect(parseEntityTag('0a1b2c')).toBeUndefined();
  });

  it('rejects a missing header', () => {
    expect(parseEntityTag(null)).toBeUndefined();
  });

  it('rejects an empty quoted value', () => {
    expect(parseEntityTag('""')).toBeUndefined();
  });
});
