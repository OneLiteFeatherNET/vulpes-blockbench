import { describe, expect, it } from 'vitest';
import type { Page } from '../../src/api/dto';
import type { RevisionSummary } from '../../src/revisions/dto';
import { createRevisionsController, type RevisionsFailure, type RevisionsHost, type RevisionsView } from '../../src/revisions/controller';

function revision(number: number): RevisionSummary {
  return { id: `rev-${String(number)}`, number, sha1: 'abc', size: 1, comment: undefined, creationDate: '2026-10-20T10:00:00Z', current: number === 3 };
}

type PageAnswer = { ok: true; value: Page<RevisionSummary> } | { ok: false; failure: RevisionsFailure };

/** A host whose answers the test sets. It records the page numbers it was asked for. */
function fakeHost(initialKey: string | undefined): {
  host: RevisionsHost;
  asked: number[];
  answer: (answer: PageAnswer) => void;
  setKey: (key: string | undefined) => void;
  opened: RevisionSummary[];
} {
  let key = initialKey;
  let next: PageAnswer = { ok: true, value: { items: [], totalSize: 0 } };
  const asked: number[] = [];
  const opened: RevisionSummary[] = [];
  const host: RevisionsHost = {
    linkedKey: () => key,
    listRevisions: (page) => {
      asked.push(page);
      return Promise.resolve(next);
    },
    openRevision: (item) => {
      opened.push(item);
      return Promise.resolve();
    },
    restoreRevision: () => Promise.resolve(),
  };
  return {
    host,
    asked,
    opened,
    answer: (value) => {
      next = value;
    },
    setKey: (value) => {
      key = value;
    },
  };
}

function setup(initialKey: string | undefined): {
  controller: ReturnType<typeof createRevisionsController>;
  views: RevisionsView[];
  fake: ReturnType<typeof fakeHost>;
  latest: () => RevisionsView;
} {
  const fake = fakeHost(initialKey);
  const views: RevisionsView[] = [];
  const controller = createRevisionsController(fake.host, (view) => {
    views.push(view);
  });
  return { controller, views, fake, latest: () => controller.current() };
}

describe('revisions controller', () => {
  it('reports not linked and asks for nothing when the open project is not linked', async () => {
    const { controller, fake, latest } = setup(undefined);
    await controller.refresh();
    expect(latest().status, 'the status').toBe('not_linked');
    expect(fake.asked.length, 'the pages requested').toBe(0);
  });

  it('loads the first page of a linked model', async () => {
    const { controller, fake, latest } = setup('vulpes:item/ruby');
    fake.answer({ ok: true, value: { items: [revision(3), revision(2)], totalSize: 2 } });
    await controller.refresh();
    expect(fake.asked, 'the pages requested').toEqual([0]);
    expect(latest().status, 'the status').toBe('ready');
    expect(latest().items.map((item) => item.number), 'the numbers').toEqual([3, 2]);
  });

  it('keeps the key of the linked model in its view', async () => {
    const { controller, fake, latest } = setup('vulpes:item/ruby');
    fake.answer({ ok: true, value: { items: [], totalSize: 0 } });
    await controller.refresh();
    expect(latest().key, 'the key').toBe('vulpes:item/ruby');
  });

  it('reports unavailable without an error message when the backend has no revisions', async () => {
    const { controller, fake, latest } = setup('vulpes:item/ruby');
    fake.answer({ ok: false, failure: { kind: 'unavailable' } });
    await controller.refresh();
    expect(latest().status, 'the status').toBe('unavailable');
    expect(latest().error, 'the error').toBeUndefined();
  });

  it('keeps the error message of a failed page', async () => {
    const { controller, fake, latest } = setup('vulpes:item/ruby');
    fake.answer({ ok: false, failure: { kind: 'message', message: 'offline' } });
    await controller.refresh();
    expect(latest().status, 'the status').toBe('error');
    expect(latest().error, 'the error').toBe('offline');
  });

  it('appends the next page on load more', async () => {
    const { controller, fake, latest } = setup('vulpes:item/ruby');
    fake.answer({ ok: true, value: { items: [revision(3)], totalSize: 2 } });
    await controller.refresh();
    fake.answer({ ok: true, value: { items: [revision(2)], totalSize: 2 } });
    await controller.loadMore();
    expect(fake.asked, 'the pages requested').toEqual([0, 1]);
    expect(latest().items.length, 'the revisions shown').toBe(2);
    expect(latest().hasMore, 'has more').toBe(false);
  });

  it('asks for nothing on load more when every revision is loaded', async () => {
    const { controller, fake } = setup('vulpes:item/ruby');
    fake.answer({ ok: true, value: { items: [revision(3)], totalSize: 1 } });
    await controller.refresh();
    await controller.loadMore();
    expect(fake.asked, 'the pages requested').toEqual([0]);
  });

  it('clears the list when the model is no longer linked', async () => {
    const { controller, fake, latest } = setup('vulpes:item/ruby');
    fake.answer({ ok: true, value: { items: [revision(3)], totalSize: 1 } });
    await controller.refresh();
    fake.setKey(undefined);
    await controller.refresh();
    expect(latest().status, 'the status').toBe('not_linked');
    expect(latest().items.length, 'the revisions shown').toBe(0);
  });

  it('marks the view busy while a revision is opened', async () => {
    const { controller, fake, views } = setup('vulpes:item/ruby');
    fake.answer({ ok: true, value: { items: [revision(3)], totalSize: 1 } });
    await controller.refresh();
    await controller.open(revision(3));
    expect(views.some((view) => view.busy), 'a view with busy set').toBe(true);
    expect(controller.current().busy, 'busy after the open').toBe(false);
    expect(fake.opened.map((item) => item.number), 'the opened revisions').toEqual([3]);
  });
});
