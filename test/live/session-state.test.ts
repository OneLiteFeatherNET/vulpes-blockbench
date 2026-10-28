import { describe, expect, it } from 'vitest';
import { initialSessionView, reduceSessionView, type SessionView, type ViewEvent } from '../../src/live/session-state';

const TOKEN = 'aaaaaaaaaaaaaaaa';
const OTHER_TOKEN = 'bbbbbbbbbbbbbbbb';
const HOST = 'localhost';
const OTHER_HOST = 'signal.example.net';

const NONE: SessionView = { kind: 'none' };
const AVAILABLE: SessionView = { kind: 'available', host: HOST, token: TOKEN };
const HOSTING: SessionView = { kind: 'hosting', token: TOKEN, participants: 1 };
const JOINING: SessionView = { kind: 'joining', token: TOKEN, host: HOST };
const JOINED: SessionView = { kind: 'joined', token: TOKEN, host: HOST };

function apply(state: SessionView, event: ViewEvent): { state: SessionView; accepted: boolean } {
  return reduceSessionView(state, event);
}

describe('initialSessionView', () => {
  it('starts with no session', () => {
    expect(initialSessionView, 'the initial view').toEqual(NONE);
  });
});

describe('local events from none', () => {
  it('accepts a start request and keeps none until the native session exists', () => {
    expect(apply(NONE, { kind: 'start-requested' }), 'the result').toEqual({ state: NONE, accepted: true });
  });

  it('turns a native session with its token into hosting with one participant', () => {
    expect(apply(NONE, { kind: 'native-session-created', token: TOKEN }), 'the result').toEqual({ state: HOSTING, accepted: true });
  });

  it('refuses a join request, because there is nothing to join', () => {
    expect(apply(NONE, { kind: 'join-requested' }), 'the result').toEqual({ state: NONE, accepted: false });
  });
});

describe('local events from available', () => {
  it('moves a join request to joining with the registered token and host', () => {
    expect(apply(AVAILABLE, { kind: 'join-requested' }), 'the result').toEqual({ state: JOINING, accepted: true });
  });

  it('refuses a start request, because a session is already registered', () => {
    expect(apply(AVAILABLE, { kind: 'start-requested' }), 'the result').toEqual({ state: AVAILABLE, accepted: false });
  });
});

describe('local events while hosting', () => {
  it('updates the participant count', () => {
    expect(apply(HOSTING, { kind: 'participants-changed', participants: 3 }), 'the result').toEqual({
      state: { kind: 'hosting', token: TOKEN, participants: 3 },
      accepted: true,
    });
  });

  it('returns to none when the designer leaves the hosted session', () => {
    expect(apply(HOSTING, { kind: 'left' }), 'the result').toEqual({ state: NONE, accepted: true });
  });

  it('refuses a second start request while hosting', () => {
    expect(apply(HOSTING, { kind: 'start-requested' }), 'the result').toEqual({ state: HOSTING, accepted: false });
  });
});

describe('local events while joining', () => {
  it('refuses a second join while joining and leaves the state unchanged', () => {
    expect(apply(JOINING, { kind: 'join-requested' }), 'the result').toEqual({ state: JOINING, accepted: false });
  });

  it('moves to joined when the guest project has loaded', () => {
    expect(apply(JOINING, { kind: 'guest-joined' }), 'the result').toEqual({ state: JOINED, accepted: true });
  });

  it('returns to none when the designer leaves before the model arrives', () => {
    expect(apply(JOINING, { kind: 'left' }), 'the result').toEqual({ state: NONE, accepted: true });
  });
});

describe('local events while joined', () => {
  it('refuses a join request while joined', () => {
    expect(apply(JOINED, { kind: 'join-requested' }), 'the result').toEqual({ state: JOINED, accepted: false });
  });

  it('returns to none when the designer leaves the session', () => {
    expect(apply(JOINED, { kind: 'left' }), 'the result').toEqual({ state: NONE, accepted: true });
  });

  it('refuses a participant count, which only a hosting view shows', () => {
    expect(apply(JOINED, { kind: 'participants-changed', participants: 2 }), 'the result').toEqual({ state: JOINED, accepted: false });
  });
});

describe('registry events', () => {
  it('shows a registration read from none as available', () => {
    const result = apply(NONE, { kind: 'registration-read', registration: { token: TOKEN, host: HOST } });
    expect(result, 'the result').toEqual({ state: AVAILABLE, accepted: true });
  });

  it('keeps none when the registration read finds no session', () => {
    expect(apply(NONE, { kind: 'registration-read', registration: undefined }), 'the result').toEqual({ state: NONE, accepted: true });
  });

  it('returns available to none when the registration read finds no session', () => {
    expect(apply(AVAILABLE, { kind: 'registration-read', registration: undefined }), 'the result').toEqual({ state: NONE, accepted: true });
  });

  it('takes the newer registration when a read finds a different one while available', () => {
    const result = apply(AVAILABLE, {
      kind: 'registration-read',
      registration: { token: OTHER_TOKEN, host: OTHER_HOST },
    });
    expect(result.state, 'the state').toEqual({ kind: 'available', token: OTHER_TOKEN, host: OTHER_HOST });
  });

  it('keeps hosting when a read finds the own registration', () => {
    const result = apply(HOSTING, { kind: 'registration-read', registration: { token: TOKEN, host: HOST } });
    expect(result.state, 'the state').toEqual(HOSTING);
  });

  it('shows a started session as available from none', () => {
    expect(apply(NONE, { kind: 'session-started', token: TOKEN, host: HOST }).state, 'the state').toEqual(AVAILABLE);
  });

  it('shows a started session as available from available', () => {
    expect(apply(AVAILABLE, { kind: 'session-started', token: OTHER_TOKEN, host: OTHER_HOST }).state, 'the state').toEqual({
      kind: 'available',
      token: OTHER_TOKEN,
      host: OTHER_HOST,
    });
  });

  it('keeps hosting when a started session is announced', () => {
    expect(apply(HOSTING, { kind: 'session-started', token: TOKEN, host: HOST }).state, 'the state').toEqual(HOSTING);
  });

  it('returns available to none when its session ends', () => {
    expect(apply(AVAILABLE, { kind: 'session-ended', token: TOKEN }), 'the result').toEqual({ state: NONE, accepted: true });
  });

  it('keeps available when a different session ends', () => {
    expect(apply(AVAILABLE, { kind: 'session-ended', token: OTHER_TOKEN }).state, 'the state').toEqual(AVAILABLE);
  });

  it('returns joining to none when the session ends before the model arrives', () => {
    expect(apply(JOINING, { kind: 'session-ended', token: TOKEN }), 'the result').toEqual({ state: NONE, accepted: true });
  });

  it('keeps hosting when the registry reports its session as ended', () => {
    expect(apply(HOSTING, { kind: 'session-ended', token: TOKEN }).state, 'the state').toEqual(HOSTING);
  });
});
