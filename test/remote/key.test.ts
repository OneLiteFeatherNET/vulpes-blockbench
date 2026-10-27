import { describe, expect, it } from 'vitest';
import { normalizeKey } from '../../src/remote/key';

describe('normalizeKey', () => {
  it('returns the key without surrounding spaces', () => {
    expect(normalizeKey('  vulpes:item/ruby ')).toEqual({ ok: true, key: 'vulpes:item/ruby' });
  });

  it('rejects an empty key without sending anything', () => {
    expect(normalizeKey('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('leaves the grammar of the key to the backend', () => {
    expect(normalizeKey('Ruby')).toEqual({ ok: true, key: 'Ruby' });
  });
});
