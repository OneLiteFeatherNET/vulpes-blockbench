// The Blockbench glue of live editing. It starts and joins the native edit session, follows
// its events, registers the session in Vulpes, and follows the `saved` and `session` events
// of the linked asset. The decisions are in src/live/; this file only wires the events, the
// timers, the stream and the native calls, so the Blockbench globals stay in one place.

import { isRecord, parseJsonText } from '../json';
import { isRouteMissing } from '../live/availability';
import { createSseParser, decodeLiveEvent, type LiveEvent, type SavedEvent, type SessionEvent } from '../live/events';
import { decideEtagPropagation, type LocalLink } from '../live/etag-propagation';
import { createLiveRegistryClient, isRegistrationConflict, type LiveRegistryClient } from '../live/registration';
import { createRefreshScheduler, type RefreshScheduler } from '../live/refresh';
import { initialSessionView, reduceSessionView, type SessionView, type ViewEvent } from '../live/session-state';
import type { LinkRecord } from '../link/link-state';
import { describeFailure, problemFromResponse, type ApiFailure } from '../problem';
import { currentService, storedSignalingHost } from './blockbench-storage';
import { emitVulpesChange, subscribeVulpesChange } from './change-bus';
import { errorMessage, quickMessage } from './feedback';
import { rendererFetch } from './fetch-adapter';
import { attachLink, heldRecord, linkOf, updateHeldEtag } from './project-link';
import { clientFor, messageText, runAction } from './remote-context';

/** A start from the call until its registration is answered. */
interface PendingStart {
  readonly session: EditSession;
  readonly record: LinkRecord;
  readonly host: string;
}

/** A join from the call until the model has arrived and been linked. */
interface PendingJoin {
  readonly session: EditSession;
  readonly record: LinkRecord;
}

/** The registration this instance holds for the session it hosts. */
interface HeldRegistration {
  readonly live: LiveRegistryClient;
  readonly record: LinkRecord;
  readonly token: string;
}

/** The `events` stream of the linked asset. `key` names the asset it follows. */
interface EventStream {
  readonly key: string;
  readonly abort: AbortController;
}

interface LiveEditing {
  start(project: BlockbenchProject): void;
  join(project: BlockbenchProject): void;
  leave(): void;
  view(): SessionView;
  dispose(): void;
}

function registryFor(baseUrl: string): LiveRegistryClient {
  return createLiveRegistryClient({ baseUrl, fetch: rendererFetch });
}

function assetKey(record: LinkRecord): string {
  return `${record.baseUrl}|${record.projectId}|${record.assetId}`;
}

function eventsUrl(record: LinkRecord): string {
  const root = record.baseUrl.replace(/\/+$/u, '');
  return `${root}/project/${encodeURIComponent(record.projectId)}/asset/${encodeURIComponent(record.assetId)}/events`;
}

/** The username of a session. Undefined lets Blockbench take one of its placeholder names. */
function sessionUsername(): string | undefined {
  const raw: unknown = settings['username']?.value;
  return typeof raw === 'string' && raw.trim() !== '' ? raw : undefined;
}

/** The signaling host of the active environment. Empty when live editing is disabled there. */
function activeHost(): string {
  return storedSignalingHost(currentService().activeProfile().id);
}

function linkedProjectRecord(): LinkRecord | undefined {
  const project = Project;
  return project === null || project === undefined ? undefined : linkOf(project);
}

function createLiveEditing(): LiveEditing {
  let view: SessionView = initialSessionView;
  // The native session this instance runs, as a host or as a guest.
  let native: EditSession | undefined;
  let pendingStart: PendingStart | undefined;
  let pendingJoin: PendingJoin | undefined;
  let held: HeldRegistration | undefined;
  let scheduler: RefreshScheduler | undefined;
  let stream: EventStream | undefined;
  // The base URL of a backend without the live-session routes. Nothing is retried against it.
  let unsupportedBase: string | undefined;
  let handles: { delete(): void }[] = [];
  let unsubscribe: (() => void) | undefined;

  const apply = (event: ViewEvent): boolean => {
    const step = reduceSessionView(view, event);
    view = step.state;
    if (step.accepted) {
      emitVulpesChange();
    }
    return step.accepted;
  };

  const reportUnavailable = (): void => {
    errorMessage(tl('vulpes.live.unavailable.backend'));
  };

  const reportFailure = (failure: ApiFailure): void => {
    if (isRouteMissing(failure)) {
      reportUnavailable();
      return;
    }
    errorMessage(messageText(describeFailure(failure)));
  };

  /** Stops the refresh and removes the registration this instance holds. Removal is asynchronous and its result is not awaited. */
  const release = (): void => {
    scheduler?.stop();
    scheduler = undefined;
    const registration = held;
    held = undefined;
    if (registration !== undefined) {
      void registration.live.removeRegistration(registration.record.projectId, registration.record.assetId, registration.token);
    }
  };

  const onQuit = (): void => {
    release();
    native = undefined;
    pendingStart = undefined;
    pendingJoin = undefined;
    apply({ kind: 'left' });
  };

  const registerHosted = async (pending: PendingStart, token: string): Promise<void> => {
    const { record, session, host } = pending;
    const live = registryFor(record.baseUrl);
    const result = await live.register(record.projectId, record.assetId, { token, host });
    if (native !== session) {
      // The session ended while the registration was on its way, so the one just stored is removed.
      if (result.ok) {
        void live.removeRegistration(record.projectId, record.assetId, token);
      }
      return;
    }
    if (!result.ok) {
      if (isRegistrationConflict(result.failure)) {
        errorMessage(tl('vulpes.live.already_running'));
      } else {
        reportFailure(result.failure);
      }
      // The native session was started before its token was registered, so it is ended again.
      session.quit();
      return;
    }
    held = { live, record, token };
    scheduler = createRefreshScheduler({
      timers: {
        setInterval: (handler, ms) => setInterval(handler, ms),
        clearInterval: (handle) => {
          clearInterval(handle);
        },
      },
      refresh: () => live.register(record.projectId, record.assetId, { token, host }),
    });
    scheduler.start();
  };

  const onCreateSession = (data: unknown): void => {
    const pending = pendingStart;
    if (pending === undefined || !isRecord(data)) {
      return;
    }
    const token = data['token'];
    if (typeof token !== 'string' || token === '' || data['peer'] !== pending.session.peer) {
      return;
    }
    pendingStart = undefined;
    if (!apply({ kind: 'native-session-created', token })) {
      return;
    }
    runAction(() => registerHosted(pending, token));
  };

  const onUserJoins = (): void => {
    if (native !== undefined) {
      apply({ kind: 'participants-changed', participants: Object.keys(native.clients).length });
    }
  };

  const onUserLeaves = (): void => {
    // user_leaves_session is dispatched before the client is removed, so the leaving client still counts.
    if (native !== undefined) {
      apply({ kind: 'participants-changed', participants: Math.max(1, Object.keys(native.clients).length - 1) });
    }
  };

  const start = (project: BlockbenchProject): void => {
    const host = activeHost();
    if (host === '') {
      errorMessage(tl('vulpes.live.unavailable.environment'));
      return;
    }
    const record = linkOf(project);
    if (record === undefined) {
      errorMessage(tl('vulpes.live.not_linked'));
      return;
    }
    if (!apply({ kind: 'start-requested' })) {
      return;
    }
    if (Project !== project) {
      project.select();
    }
    // The native session reads its signaling host when it starts, so the host is set first.
    EditSession.defaults.ip = host;
    const session = new EditSession();
    native = session;
    pendingStart = { session, record, host };
    session.start(sessionUsername());
  };

  const join = (project: BlockbenchProject): void => {
    if (activeHost() === '') {
      errorMessage(tl('vulpes.live.unavailable.environment'));
      return;
    }
    const record = linkOf(project);
    if (record === undefined) {
      errorMessage(tl('vulpes.live.not_linked'));
      return;
    }
    runAction(async () => {
      const read = await registryFor(record.baseUrl).readRegistration(record.projectId, record.assetId);
      if (!read.ok) {
        reportFailure(read.failure);
        return;
      }
      const registration = read.value;
      if (registration === undefined) {
        errorMessage(tl('vulpes.live.join_failed.no_session'));
        return;
      }
      apply({ kind: 'registration-read', registration });
      if (!apply({ kind: 'join-requested' })) {
        return;
      }
      EditSession.defaults.ip = registration.host;
      const session = new EditSession();
      native = session;
      pendingJoin = { session, record };
      session.join(sessionUsername(), registration.token);
    });
  };

  const linkJoined = async (project: BlockbenchProject, pending: PendingJoin): Promise<void> => {
    const { session, record } = pending;
    const result = await clientFor(record.baseUrl).readModel(record.projectId, record.assetId);
    if (native !== session) {
      // The session ended while the model was read, so nothing is linked.
      return;
    }
    if (!result.ok) {
      apply({ kind: 'guest-joined' });
      errorMessage(
        result.failure.kind === 'unexpected' ? tl('vulpes.live.join_failed.no_version') : messageText(describeFailure(result.failure)),
      );
      return;
    }
    attachLink(project, { ...record, etag: result.value.etag });
    apply({ kind: 'guest-joined' });
  };

  const onLoadProject = (): void => {
    const pending = pendingJoin;
    const project = Project;
    if (pending === undefined || project === null || project === undefined) {
      return;
    }
    // init_model dispatches load_project before it sets Project.EditSession (js/edit_sessions.js:272-275),
    // so the joined project has no session yet. A project that already has one belongs to another session.
    const owner = project.EditSession;
    if (owner !== null && owner !== undefined && owner !== pending.session) {
      return;
    }
    pendingJoin = undefined;
    runAction(() => linkJoined(project, pending));
  };

  const refreshRegistration = async (record: LinkRecord): Promise<void> => {
    if (unsupportedBase === record.baseUrl) {
      return;
    }
    const result = await registryFor(record.baseUrl).readRegistration(record.projectId, record.assetId);
    if (!result.ok) {
      if (isRouteMissing(result.failure)) {
        unsupportedBase = record.baseUrl;
        reportUnavailable();
      }
      return;
    }
    apply({ kind: 'registration-read', registration: result.value });
  };

  const announceSave = (saved: SavedEvent, record: LinkRecord): void => {
    const links = ModelProject.all.flatMap((project): LocalLink[] => {
      const held = heldRecord(project);
      return held === undefined ? [] : [{ projectKey: project.uuid, environment: held.environment, assetId: held.assetId, etag: held.etag }];
    });
    const decision = decideEtagPropagation({ environment: record.environment, assetId: record.assetId, saved, links });
    for (const update of decision.updates) {
      updateHeldEtag(update.projectKey, update.etag);
    }
    if (decision.updates.length > 0) {
      emitVulpesChange();
    }
    if (decision.announcement !== undefined) {
      quickMessage(tl('vulpes.live.saved_by_other', [String(decision.announcement.revision)]));
    }
  };

  const onSessionEvent = (session: SessionEvent, record: LinkRecord): void => {
    if (session.state === 'ended') {
      if (view.kind === 'joining' && view.token === session.token) {
        errorMessage(tl('vulpes.live.join_failed.no_session'));
      }
      apply({ kind: 'session-ended', token: session.token });
    }
    runAction(() => refreshRegistration(record));
  };

  const handleEvent = (event: LiveEvent, record: LinkRecord): void => {
    if (event.kind === 'saved') {
      announceSave(event.saved, record);
      return;
    }
    onSessionEvent(event.session, record);
  };

  const closeStream = (): void => {
    stream?.abort.abort();
    stream = undefined;
  };

  const followEvents = async (record: LinkRecord, signal: AbortSignal): Promise<void> => {
    // The stream carries no Authorization header, as the open question in design.md assumes. A fetch
    // stream, not EventSource, is used because the SSE parser needs the raw text and the 404 status.
    const response = await fetch(eventsUrl(record), { headers: { Accept: 'text/event-stream' }, signal }).catch((): undefined => undefined);
    if (response === undefined) {
      return;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (isRouteMissing({ kind: 'problem', problem: problemFromResponse(response.status, parseJsonText(body), undefined) })) {
        unsupportedBase = record.baseUrl;
        reportUnavailable();
      }
      return;
    }
    if (response.body === null) {
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser();
    try {
      let next = await reader.read();
      while (!next.done) {
        // The chunk is untrusted: only bytes are decoded, anything else is skipped.
        const bytes: unknown = next.value;
        if (bytes instanceof Uint8Array) {
          for (const block of parser.push(decoder.decode(bytes, { stream: true }))) {
            const event = decodeLiveEvent(block);
            if (event !== undefined) {
              handleEvent(event, record);
            }
          }
        }
        next = await reader.read();
      }
    } catch {
      // The stream was aborted (the linked project changed, or Blockbench unloads) or the connection dropped.
      // A dropped stream is not retried: the next change of the linked project opens it again.
    }
  };

  /** Follows the events of the linked project's asset. Only one stream is open, for the project that is current. */
  const syncStream = (): void => {
    const record = linkedProjectRecord();
    if (record === undefined) {
      closeStream();
      return;
    }
    const key = assetKey(record);
    if (stream?.key === key) {
      return;
    }
    closeStream();
    if (unsupportedBase === record.baseUrl) {
      return;
    }
    const abort = new AbortController();
    stream = { key, abort };
    runAction(() => followEvents(record, abort.signal));
    runAction(() => refreshRegistration(record));
  };

  const leave = (): void => {
    native?.quit();
  };

  const dispose = (): void => {
    closeStream();
    unsubscribe?.();
    unsubscribe = undefined;
    for (const handle of handles) {
      handle.delete();
    }
    handles = [];
    const current = native;
    release();
    native = undefined;
    pendingStart = undefined;
    pendingJoin = undefined;
    // The listeners are gone, so the quit below does not reach onQuit. The registration was removed by release.
    if (current?.hosting === true) {
      current.quit();
    }
  };

  handles = [
    Blockbench.on('create_session', onCreateSession),
    Blockbench.on('quit_session', onQuit),
    Blockbench.on('user_joins_session', onUserJoins),
    Blockbench.on('user_leaves_session', onUserLeaves),
    Blockbench.on('load_project', onLoadProject),
  ];
  unsubscribe = subscribeVulpesChange(syncStream);
  syncStream();

  return {
    start,
    join,
    leave,
    view: () => view,
    dispose,
  };
}

let current: LiveEditing | undefined;

/** Registers live editing and returns its removal. Called from mountVulpesUi. */
export function registerLiveEditing(): () => void {
  const editing = createLiveEditing();
  current = editing;
  return () => {
    editing.dispose();
    if (current === editing) {
      current = undefined;
    }
  };
}

/** Starts a live session on a linked project. The panel calls it; without the module registered it does nothing. */
export function startLiveSession(project: BlockbenchProject): void {
  current?.start(project);
}

/** Joins the live session of a linked project, when Vulpes registers one. */
export function joinLiveSession(project: BlockbenchProject): void {
  current?.join(project);
}

/** Leaves the live session this instance runs, as a host or as a guest. */
export function leaveLiveSession(): void {
  current?.leave();
}

/** The state the panel shows. It is `none` while live editing is not registered. */
export function liveSessionView(): SessionView {
  return current?.view() ?? initialSessionView;
}
