import { describe, expect, it } from 'vitest';
import { parseRevision, parseRevisionPage } from '../../src/revisions/dto';

const REVISION = {
  id: '6f1c0000-0000-4000-8000-000000000010',
  number: 3,
  sha1: '0a1b2c',
  size: 35,
  comment: 'Fixed the hand',
  creationDate: '2026-10-20T10:00:00Z',
  current: true,
};

/** A copy of the revision without one member, so a test can omit a field. */
function without(record: Record<string, unknown>, name: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== name));
}

describe('parseRevision', () => {
  it('reads every field of a revision', () => {
    expect(parseRevision(REVISION), 'the parsed revision').toEqual({
      id: REVISION.id,
      number: 3,
      sha1: '0a1b2c',
      size: 35,
      comment: 'Fixed the hand',
      creationDate: '2026-10-20T10:00:00Z',
      current: true,
    });
  });

  it('reads a null comment as no comment', () => {
    expect(parseRevision({ ...REVISION, comment: null })?.comment, 'the comment').toBeUndefined();
  });

  it('reads a missing comment as no comment', () => {
    expect(parseRevision(without(REVISION, 'comment'))?.comment, 'the comment').toBeUndefined();
  });

  it('rejects a comment that is not a string', () => {
    expect(parseRevision({ ...REVISION, comment: 7 }), 'the parsed revision').toBeUndefined();
  });

  it('rejects a revision number below one', () => {
    expect(parseRevision({ ...REVISION, number: 0 }), 'the parsed revision').toBeUndefined();
  });

  it('rejects a current flag that is not a boolean', () => {
    expect(parseRevision({ ...REVISION, current: 'yes' }), 'the parsed revision').toBeUndefined();
  });

  it('rejects a revision without an id', () => {
    expect(parseRevision(without(REVISION, 'id')), 'the parsed revision').toBeUndefined();
  });

  it('rejects a value that is not an object', () => {
    expect(parseRevision('3'), 'the parsed revision').toBeUndefined();
  });
});

describe('parseRevisionPage', () => {
  it('reads the content and the total size of the envelope', () => {
    const page = parseRevisionPage({ content: [REVISION], pageable: {}, totalSize: 4 });
    expect(page?.items.length, 'the number of revisions').toBe(1);
    expect(page?.totalSize, 'the total size').toBe(4);
  });

  it('rejects the whole page when one revision is invalid', () => {
    const page = parseRevisionPage({ content: [REVISION, { ...REVISION, number: 'x' }], pageable: {}, totalSize: 2 });
    expect(page, 'the parsed page').toBeUndefined();
  });

  it('rejects a body without a content array', () => {
    expect(parseRevisionPage({ totalSize: 0 }), 'the parsed page').toBeUndefined();
  });
});
