# Design

## Context

`add-remote-models` links a Blockbench project to a Vulpes asset with a `LinkRecord` (environment, base URL, project id, asset id, key, `ETag`), held in memory by `src/ui/project-link.ts`. Saves replace the asset with `If-Match` set to the held `ETag` (`src/remote/save.ts`). `add-model-revisions` adds revisions. This change adds live sessions on top of Blockbench's native edit sessions and the registry that Vulpes keeps for them.

### Finding: how the plugin reaches Blockbench's `EditSession`

Source read from Blockbench 5.2 (read-only). Line numbers refer to `js/edit_sessions.js` unless stated otherwise.

- `EditSession` is a class (`:4`) that Blockbench declares as an ambient global type (`types/custom/edit_session.d.ts:6`). Blockbench uses it as a bare identifier in global-scope code (`js/web.ts:78`). Plugins run in the same page and can use it the same way. The plugin does not need a Blockbench change.
- The constructor attaches the instance to the current project (`:17`: `if (Project) Project.EditSession = this;`). The current session is therefore reachable as `Project.EditSession` (`js/io/project.ts:53`) while a project is open, and it is what the native dialog reads (`:460`).
- `start(username)` (`:23`) and `join(username, token)` (`:82`) read the signaling host at call time, from `EditSession.defaults.ip` (`:28`, `:88`). `defaults` is a plain object (`:364`), so the plugin sets `EditSession.defaults.ip` before each call. Port `9000`, path `/sessions` and `secure: true` are hard-coded (`:29-31`, `:89-91`).
- Username: `start` and `join` write `settings.username.value` (`:35`, `:97`). The plugin passes `settings.username.value` and falls back to `EditSession.defaults.placeholder_names`.
- Events the plugin subscribes to with `Blockbench.on`: `create_session {peer, token}` (`:50`), `join_session {conn}` (`:124`), `quit_session` (`:134`), `user_joins_session` and `user_leaves_session` (`:392`, `:400`). Subscribing to `load_project` shows when the joined project has been created from `init_model` (`:272` calls `setupProject`).
- Creating a session on an empty Blockbench is done by the native dialog (`:495-506`: `Formats.free.new()` then `new EditSession()` and `start`). The plugin always starts from the linked project, so this path is not used.
- Side effects that come with the native API and are accepted: `start` copies the token to the clipboard (`:49`) and re-opens the native edit-session dialog (`:51`). `quit` is asynchronous: it dispatches `quit_session` first and destroys the peer 400 ms later (`:145-150`).
- Blockbench version pin: `EditSession` is internal, not a documented plugin API. The plugin declares only the members it uses in `src/types/edit-session.d.ts`. The plugin is tested against Blockbench 5.2, and the Blockbench upgrade checklist must re-check the members listed here.

### Backend contract (`add-live-sessions`)

- `GET {base}/project/{p}/asset/{id}/live-session` returns `200 {token, host, startedAt, expiresAt}` or `404` when none.
- `PUT {base}/project/{p}/asset/{id}/live-session` with `{token, host}` creates or refreshes the registration (TTL 60 s). The plugin refreshes every 20 s while hosting. `409 RESOURCE_CONFLICT` means another session is active.
- `DELETE {base}/project/{p}/asset/{id}/live-session?token=` returns `204`.
- `GET {base}/project/{p}/asset/{id}/events` is an SSE stream. `event: saved` carries `{etag, sha1, revision}`. `event: session` carries `{state: started|ended, token, host}`. `404` means the backend does not support it.

## Goals / Non-Goals

Goals: start and join a live session from the panel without copying tokens; keep every participant able to save; announce saves by others; keep the native editing behaviour unchanged.

Non-goals: see the proposal. In particular, no own transport and no own TURN.

## Decisions

### Pure logic in `src/live/`, Blockbench glue in `src/ui/live-editing.ts`

Registry client and parsers, SSE event parsing, the `ETag` propagation decision, the session view state and the refresh scheduler take their dependencies as parameters (`fetch`, timers, the clock). They do not touch Blockbench globals. Tests use a fake fetch with a fake response stream, and fake timers. Only `src/ui/live-editing.ts` reads `EditSession`, `Project` and `Blockbench`.

### Session state

The plugin keeps one view state: `none` (no registration, not in a session), `available` (registered by another host, not joined), `hosting` (this project started the session, participant count known), `joining` (join requested, waiting for `init_model`), `joined` (receiving the model). Transitions come from the local events (`create_session`, `join_session`, `quit_session`, `user_joins_session`, `user_leaves_session`, `load_project`) and from the registry state (GET results and `session` events).

### Guest link after join

`init_model` is processed after the `receive_session_data` event (`:247` before `:257`), so the guest project does not exist yet when the message arrives. The plugin moves to `joining` on join and links the first `load_project` event that arrives while `joining` is set and `Project.EditSession` is the joined session. The link is the same `LinkRecord` as the host's (environment, project id, asset id, key). The current `ETag` comes from a GET of the asset content headers; a missing strong `ETag` leaves the project unlinked and shows an error.

### ETag propagation

A `saved` event carries the new `ETag` (`"<sha1>"`). For every local project whose link has the same environment and asset id, the plugin sets the held `ETag` to the event's value. The message "Saved by someone else - revision n" is shown only when no local project already held that `ETag`, which means the save was not made from this Blockbench instance. A save made by this instance has already updated its own held record, so it causes no message. A `saved` event whose `ETag` the link already holds changes nothing and shows no message.

While an own save of the asset is in flight, its `saved` events are held (`src/live/own-saves.ts`). The save codec marks the start and the end of each save of a linked project, after the outcome has been applied. When the save succeeds, held events whose `ETag` is the save's `ETag` are dropped as its echo, and the others are processed as usual. When the save fails, all held events are processed as usual. Events that arrive while no own save is in flight are processed at once.

Blockbench's native undo synchronisation keeps the models of the participants in step. The `ETag` propagation only prevents false `412` on the next save; it does not change the model.

### Refresh and cleanup

While hosting, the plugin PUTs `{token, host}` every 20 seconds through an injected scheduler. On `quit_session` the plugin sends `DELETE` with the held token. On `409` at start, the plugin quits the native session it just started, because the native session was created before the token was known, and it shows "A live session is already running for this model". On plugin unload the plugin quits any session it hosts, as `desktop.ts:724` does for the native close.

### Settings

Two entries per profile in the existing settings module: "Dev signaling host" (default `localhost`) and "Prod signaling host" (default empty). The host is a bare host name (no scheme, no port, no path); anything else is rejected by the validator and treated as empty. An empty host disables live editing for that environment, and the panel says so.

### SSE and authentication

The stream is read with `fetch` and a small SSE parser (`createSseParser` in `src/live/events.ts`), not with `EventSource`. `fetch` can send request headers, so the bearer token of a later change can be added to the stream; `EventSource` cannot set an `Authorization` header. `fetch` also gives explicit control over the stop (an `AbortController` per stream) and over the reconnect. The request carries only `Accept: text/event-stream`, so the plugin connects to `events` without the bearer token, which is the open question below. `saved` and `session` blocks are decoded; other event names and invalid payloads are ignored. A dropped stream is retried after a backoff: 1 second after the first drop, doubling on each further attempt, capped at 30 seconds. The delay returns to 1 second once a reopened stream has delivered data. The policy is a pure unit (`src/live/reconnect-backoff.ts`); the lifecycle is `src/live/event-stream.ts`, which takes the `fetch` and the timers as parameters. The stream is opened for the linked asset whenever a linked project is open, and it is aborted when the linked project changes or closes; the abort clears a pending reconnect and no reconnect follows. A backend that answers `404` without a problem code on `events` stops the stream for good, as on the other routes.

`EventSource` was rejected. It reconnects on its own, so a dropped stream and a refused one look the same to the plugin. It cannot set request headers, and its only stop is `close()`, so it cannot carry the later bearer token or the explicit reconnect policy above.

## Risks / Trade-offs

- `EditSession` is an internal Blockbench class. A Blockbench upgrade can rename members; the members listed above are re-checked on each upgrade and covered by the manual checks in the tasks.
- Guest linking depends on `load_project` firing for the `init_model` project. If it does not, the guest stays unlinked and the panel shows "Link this project to save" as a fallback.
- The native start copies the token to the clipboard and re-opens the native dialog. Both are accepted for now.
- A session that disconnects without `quit_session` (crash) leaves a registration until its TTL (60 s) expires.

## Open questions

- Does `events` accept the connection without a bearer token, or does the backend need a token or cookie for the stream? The plugin assumes no token for `events`; `add-live-sessions` must confirm this.
- Which signaling hosts exist per environment besides the Dev default `localhost`?
