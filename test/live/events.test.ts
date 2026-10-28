import { describe, expect, it } from 'vitest';
import { createSseParser, decodeLiveEvent, parseSavedEvent, parseSessionEvent } from '../../src/live/events';

const SAVED = { etag: '"0a1b2c"', sha1: '0a1b2c', revision: 3 };
const SESSION = { state: 'started', token: 'aaaaaaaaaaaaaaaa', host: 'localhost' };

describe('parseSavedEvent', () => {
  it('reads the etag, sha1 and revision of a saved event', () => {
    expect(parseSavedEvent(SAVED), 'the event').toEqual(SAVED);
  });

  it.each(['etag', 'sha1', 'revision'] as const)('rejects a saved event without %s', (field) => {
    const body = Object.fromEntries(Object.entries(SAVED).filter(([key]) => key !== field));
    expect(parseSavedEvent(body), `the result without ${field}`).toBeUndefined();
  });

  it('rejects a saved event whose etag is weak, because If-Match needs a strong value', () => {
    expect(parseSavedEvent({ ...SAVED, etag: 'W/"0a1b2c"' }), 'the result').toBeUndefined();
  });

  it('rejects a saved event whose revision is not a number', () => {
    expect(parseSavedEvent({ ...SAVED, revision: '3' }), 'the result').toBeUndefined();
  });

  it.each([null, 'saved', [SAVED]])('rejects a payload that is not a record: %j', (body) => {
    expect(parseSavedEvent(body), 'the result').toBeUndefined();
  });
});

describe('parseSessionEvent', () => {
  it('reads the state, token and host of a started session', () => {
    expect(parseSessionEvent(SESSION), 'the event').toEqual(SESSION);
  });

  it('reads an ended session', () => {
    expect(parseSessionEvent({ ...SESSION, state: 'ended' }), 'the event').toEqual({ ...SESSION, state: 'ended' });
  });

  it('rejects a session state other than started or ended', () => {
    expect(parseSessionEvent({ ...SESSION, state: 'paused' }), 'the result').toBeUndefined();
  });

  it.each(['token', 'host'] as const)('rejects a session event without %s', (field) => {
    const body = Object.fromEntries(Object.entries(SESSION).filter(([key]) => key !== field));
    expect(parseSessionEvent(body), `the result without ${field}`).toBeUndefined();
  });

  it.each([null, 'session', [SESSION]])('rejects a payload that is not a record: %j', (body) => {
    expect(parseSessionEvent(body), 'the result').toBeUndefined();
  });
});

describe('decodeLiveEvent', () => {
  it('turns a saved block into a saved event', () => {
    const event = decodeLiveEvent({ event: 'saved', data: JSON.stringify(SAVED) });
    expect(event, 'the event').toEqual({ kind: 'saved', saved: SAVED });
  });

  it('turns a session block into a session event', () => {
    const event = decodeLiveEvent({ event: 'session', data: JSON.stringify(SESSION) });
    expect(event, 'the event').toEqual({ kind: 'session', session: SESSION });
  });

  it('ignores an unknown event name', () => {
    expect(decodeLiveEvent({ event: 'ping', data: JSON.stringify(SAVED) }), 'the event').toBeUndefined();
  });

  it('ignores a block whose data is not JSON', () => {
    expect(decodeLiveEvent({ event: 'saved', data: 'not json' }), 'the event').toBeUndefined();
  });
});

describe('createSseParser', () => {
  it('emits a block with its event name and data', () => {
    const parser = createSseParser();
    expect(parser.push('event: saved\ndata: {"a":1}\n\n'), 'the blocks').toEqual([{ event: 'saved', data: '{"a":1}' }]);
  });

  it('emits a block split over two chunks only once it is complete', () => {
    const parser = createSseParser();
    expect(parser.push('event: sa'), 'the blocks after the first chunk').toEqual([]);
    expect(parser.push('ved\ndata: {}\n'), 'the blocks before the blank line').toEqual([]);
    expect(parser.push('\n'), 'the blocks after the blank line').toEqual([{ event: 'saved', data: '{}' }]);
  });

  it('joins multi-line data with a newline', () => {
    const parser = createSseParser();
    expect(parser.push('data: first\ndata: second\n\n'), 'the blocks').toEqual([{ event: 'message', data: 'first\nsecond' }]);
  });

  it('ignores comment lines that start with a colon', () => {
    const parser = createSseParser();
    expect(parser.push(': keep-alive\nevent: saved\ndata: x\n\n'), 'the blocks').toEqual([{ event: 'saved', data: 'x' }]);
  });

  it('ignores a block without a data line', () => {
    const parser = createSseParser();
    expect(parser.push('event: saved\n\n'), 'the blocks').toEqual([]);
  });

  it('names a block without an event line message', () => {
    const parser = createSseParser();
    expect(parser.push('data: x\n\n'), 'the blocks').toEqual([{ event: 'message', data: 'x' }]);
  });

  it('does not carry the event name of one block into the next', () => {
    const parser = createSseParser();
    expect(parser.push('event: saved\ndata: a\n\ndata: b\n\n'), 'the blocks').toEqual([
      { event: 'saved', data: 'a' },
      { event: 'message', data: 'b' },
    ]);
  });

  it('accepts CRLF line endings, even when the CR ends a chunk', () => {
    const parser = createSseParser();
    expect(parser.push('data: x\r'), 'the blocks after the first chunk').toEqual([]);
    expect(parser.push('\n\r\n'), 'the blocks after the second chunk').toEqual([{ event: 'message', data: 'x' }]);
  });
});
