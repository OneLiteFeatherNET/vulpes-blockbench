// The view state of a live session as the panel shows it. The reducer is pure: local
// events (what the designer did) and registry events (what Vulpes reports) go in, and a
// new state with an `accepted` flag comes out. A refused event leaves the state unchanged.

export type SessionView =
  | { readonly kind: 'none' }
  | { readonly kind: 'available'; readonly host: string; readonly token: string }
  | { readonly kind: 'hosting'; readonly token: string; readonly participants: number }
  | { readonly kind: 'joining'; readonly token: string; readonly host: string }
  | { readonly kind: 'joined'; readonly token: string; readonly host: string };

export type ViewEvent =
  | { readonly kind: 'start-requested' }
  | { readonly kind: 'join-requested' }
  | { readonly kind: 'native-session-created'; readonly token: string }
  | { readonly kind: 'guest-joined' }
  | { readonly kind: 'participants-changed'; readonly participants: number }
  | { readonly kind: 'left' }
  | { readonly kind: 'registration-read'; readonly registration: { readonly token: string; readonly host: string } | undefined }
  | { readonly kind: 'session-started'; readonly token: string; readonly host: string }
  | { readonly kind: 'session-ended'; readonly token: string };

export interface ViewStep {
  readonly state: SessionView;
  /** False when the event does not apply in the current state. The state is then unchanged. */
  readonly accepted: boolean;
}

const NONE: SessionView = { kind: 'none' };

export const initialSessionView: SessionView = NONE;

function accept(state: SessionView): ViewStep {
  return { state, accepted: true };
}

function refuse(state: SessionView): ViewStep {
  return { state, accepted: false };
}

/** A registration read or a started session makes an idle view available. A view in a session keeps its state. */
function withRegistration(state: SessionView, registration: { readonly token: string; readonly host: string } | undefined): SessionView {
  if (state.kind !== 'none' && state.kind !== 'available') {
    return state;
  }
  return registration === undefined ? NONE : { kind: 'available', host: registration.host, token: registration.token };
}

function withStartedSession(state: SessionView, token: string, host: string): SessionView {
  if (state.kind !== 'none' && state.kind !== 'available') {
    return state;
  }
  return { kind: 'available', host, token };
}

/** An ended session clears the view only when it is the one the view shows, and only before the model arrived or while available. */
function withEndedSession(state: SessionView, token: string): SessionView {
  if ((state.kind === 'available' || state.kind === 'joining') && state.token === token) {
    return NONE;
  }
  return state;
}

export function reduceSessionView(state: SessionView, event: ViewEvent): ViewStep {
  switch (event.kind) {
    case 'start-requested':
      return state.kind === 'none' ? accept(state) : refuse(state);

    case 'join-requested':
      return state.kind === 'available' ? accept({ kind: 'joining', token: state.token, host: state.host }) : refuse(state);

    case 'native-session-created':
      return state.kind === 'none' ? accept({ kind: 'hosting', token: event.token, participants: 1 }) : refuse(state);

    case 'guest-joined':
      return state.kind === 'joining' ? accept({ kind: 'joined', token: state.token, host: state.host }) : refuse(state);

    case 'participants-changed':
      return state.kind === 'hosting' ? accept({ kind: 'hosting', token: state.token, participants: event.participants }) : refuse(state);

    case 'left':
      return state.kind === 'hosting' || state.kind === 'joining' || state.kind === 'joined' ? accept(NONE) : refuse(state);

    case 'registration-read':
      return accept(withRegistration(state, event.registration));

    case 'session-started':
      return accept(withStartedSession(state, event.token, event.host));

    case 'session-ended':
      return accept(withEndedSession(state, event.token));
  }
}
