import { describe, expect, it } from 'vitest';
import { appendRevisionPage, emptyRevisionList, hasMoreRevisions, REVISION_PAGE_SIZE } from '../../src/revisions/paging';
import type { RevisionSummary } from '../../src/revisions/dto';

function revision(number: number): RevisionSummary {
  return { id: `rev-${String(number)}`, number, sha1: 'abc', size: 1, comment: undefined, creationDate: '2026-10-20T10:00:00Z', current: number === 1 };
}

function pageOf(numbers: number[], totalSize: number): { items: RevisionSummary[]; totalSize: number } {
  return { items: numbers.map(revision), totalSize };
}

describe('revision paging', () => {
  it('requests pages of 20 revisions', () => {
    expect(REVISION_PAGE_SIZE, 'the page size').toBe(20);
  });

  it('starts with no revisions and page zero next', () => {
    const list = emptyRevisionList();
    expect(list.items.length, 'the revisions').toBe(0);
    expect(list.nextPage, 'the next page').toBe(0);
    expect(hasMoreRevisions(list), 'has more').toBe(false);
  });

  it('appends a page after the revisions already loaded', () => {
    const list = appendRevisionPage(appendRevisionPage(emptyRevisionList(), pageOf([3, 2], 3)), pageOf([1], 3));
    expect(
      list.items.map((item) => item.number),
      'the numbers in order',
    ).toEqual([3, 2, 1]);
    expect(list.nextPage, 'the next page').toBe(2);
  });

  it('has more revisions while fewer are loaded than the total', () => {
    const list = appendRevisionPage(emptyRevisionList(), pageOf([3, 2], 3));
    expect(hasMoreRevisions(list), 'has more').toBe(true);
  });

  it('has no more revisions once every revision is loaded', () => {
    const list = appendRevisionPage(appendRevisionPage(emptyRevisionList(), pageOf([3, 2], 3)), pageOf([1], 3));
    expect(hasMoreRevisions(list), 'has more').toBe(false);
  });

  it('stops asking for pages when the backend answers with an empty page', () => {
    const list = appendRevisionPage(emptyRevisionList(), pageOf([], 5));
    expect(hasMoreRevisions(list), 'has more').toBe(false);
  });
});
