# Proposal

Ships as `feat(session): edit vulpes models live with blockbench edit sessions`.

Depends on the backend change `add-live-sessions` in Vulpes-Backend, which adds the live-session registry and the `events` stream, and on the signaling sidecar: a PeerJS server per environment at `<signaling host>:9000` over TLS, which Blockbench's own edit sessions use. Until both are deployed, the plugin shows that live editing is not available instead of failing.

## Why

Two designers who work on the same Minecraft model today pass the `.bbmodel` file back and forth, and the second save overwrites the first. Blockbench already has peer-to-peer edit sessions that let several people edit one project at the same time. Vulpes knows which model is linked to which asset, so it can tell the designers that a session is running and who to join, without any manual token exchange.

## What Changes

- The "Vulpes" panel gets a "Live editing" section for the linked model. Without a session it offers "Start live session". With a session running for the asset it shows "<host> is editing live" and "Join". While the designer takes part, it shows the participant count and "Leave".
- Start uses Blockbench's native edit session. The plugin starts it on the linked project with the Blockbench username, then registers the session token in Vulpes and refreshes the registration every 20 seconds while hosting. Leaving or closing Blockbench removes the registration.
- Join uses the native session with the token from Vulpes. The joined project receives the model from the host. The plugin then links that project to the same asset, so Ctrl+S works for the guest too.
- Every participant may save. While a linked model is open, the plugin listens to the `events` stream of its asset. A save by anyone updates the held `ETag` of every local project linked to that asset, so the next Ctrl+S of any participant does not fail with `412`. The plugin shows a quick message "Saved by someone else - revision n" only when the save was not made by this project.
- Two new settings per environment profile: "Dev signaling host" (default `localhost`) and "Prod signaling host" (default empty, which disables live editing in Prod). The signaling host is applied to Blockbench's edit session before each start or join.
- Strings are in English and German.

Not part of this change (non-goals):

- Running our own TURN server or our own transport. Blockbench's PeerJS connection and the signaling sidecar are used unchanged.
- Merging concurrent edits. Blockbench's native undo/redo synchronisation is the only merge; the plugin adds no locking.
- Replacing Blockbench's chat, participant list or dialog. The native edit-session dialog stays, and the plugin reads its public session object.
- Live editing of textures or other asset kinds. Only `BBMODEL` assets are supported.
- Sign-in changes. Requests keep the optional token of `add-remote-models`.

## Capabilities

### New Capabilities

- `live-editing`: Starting, joining, leaving and announcing a live edit session for a linked model, and keeping the held `ETag` of all participants current.

### Modified Capabilities

None.

## Impact

- **Code**: the new logic lives in `src/live/` (registry client, event stream parsing, session view state, `ETag` propagation, refresh scheduling), the Blockbench glue in `src/ui/live-editing.ts`, the panel section in the existing panel files, and the strings in `src/i18n/live.ts`. The settings and the profile storage get two additive entries.
- **Backend**: `add-live-sessions` must be deployed. Older backends answer `404` on the new routes and the feature shows "not available on this backend".
- **Infrastructure**: a signaling sidecar per environment (`<host>:9000`, TLS). Prod has no default host, so live editing stays off there until one is configured.
- **Dependencies**: no new npm packages. The `EditSession` type is declared in `src/types/`; the event stream uses `fetch`, so no `EventSource` type is needed.
