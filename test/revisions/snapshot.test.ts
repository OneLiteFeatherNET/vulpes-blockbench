import { describe, expect, it } from 'vitest';
import { snapshotName } from '../../src/revisions/snapshot';

describe('snapshotName', () => {
  it('names the snapshot with the key and the revision number', () => {
    expect(snapshotName('vulpes:item/ruby', 3), 'the name').toBe('vulpes:item/ruby @ r3');
  });

  it('keeps a slash of the key in the name', () => {
    expect(snapshotName('items/ruby', 12), 'the name').toBe('items/ruby @ r12');
  });
});
