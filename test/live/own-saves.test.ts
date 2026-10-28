import { describe, expect, it } from 'vitest';
import { createOwnSaves } from '../../src/live/own-saves';

const ASSET = 'dev|p1|a1';
const OTHER_ASSET = 'dev|p1|a2';
const OWN = '"own"';
const OTHER = '"other"';

describe('createOwnSaves', () => {
  it('does not hold an event when no own save of the asset is in flight', () => {
    const saves = createOwnSaves<string>();
    expect(saves.hold(ASSET, OTHER, 'event'), 'the held flag').toBe(false);
  });

  it('holds an event while an own save of its asset is in flight', () => {
    const saves = createOwnSaves<string>();
    saves.begin(ASSET);
    expect(saves.hold(ASSET, OTHER, 'event'), 'the held flag').toBe(true);
  });

  it('does not hold an event of another asset while an own save is in flight', () => {
    const saves = createOwnSaves<string>();
    saves.begin(ASSET);
    expect(saves.hold(OTHER_ASSET, OTHER, 'event'), 'the held flag').toBe(false);
  });

  it('drops a held event whose ETag is the ETag of the own save', () => {
    const saves = createOwnSaves<string>();
    saves.begin(ASSET);
    saves.hold(ASSET, OWN, 'echo');
    expect(saves.finish(ASSET, { kind: 'saved', etag: OWN }), 'the events to process').toEqual([]);
  });

  it('releases a held event with another ETag when the own save ends', () => {
    const saves = createOwnSaves<string>();
    saves.begin(ASSET);
    saves.hold(ASSET, OTHER, 'someone else');
    expect(saves.finish(ASSET, { kind: 'saved', etag: OWN }), 'the events to process').toEqual(['someone else']);
  });

  it('releases every held event when the own save fails', () => {
    const saves = createOwnSaves<string>();
    saves.begin(ASSET);
    saves.hold(ASSET, OWN, 'echo');
    saves.hold(ASSET, OTHER, 'someone else');
    expect(saves.finish(ASSET, { kind: 'failed' }), 'the events to process').toEqual(['echo', 'someone else']);
  });

  it('keeps holding until the last of several own saves of the asset has ended', () => {
    const saves = createOwnSaves<string>();
    saves.begin(ASSET);
    saves.begin(ASSET);
    saves.hold(ASSET, OTHER, 'someone else');
    expect(saves.finish(ASSET, { kind: 'saved', etag: OWN }), 'the events after the first save').toEqual([]);
    expect(saves.hold(ASSET, OTHER, 'later'), 'the held flag after the first save').toBe(true);
    expect(saves.finish(ASSET, { kind: 'failed' }), 'the events after the last save').toEqual(['someone else', 'later']);
  });

  it('processes events immediately again once the own save has ended', () => {
    const saves = createOwnSaves<string>();
    saves.begin(ASSET);
    saves.finish(ASSET, { kind: 'failed' });
    expect(saves.hold(ASSET, OTHER, 'event'), 'the held flag').toBe(false);
  });
});
