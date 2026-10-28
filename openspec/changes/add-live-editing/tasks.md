# Tasks

## 1. Verify the Blockbench behaviour in the desktop app

- [ ] 1.1 Confirm in the desktop app that `Project.EditSession` is set after `new EditSession()` on a linked project, and that `EditSession` is reachable from a plugin as a global
- [ ] 1.2 Confirm that a native session started from a linked project receives the `create_session` event with a 16-character token, and that the start re-opens the native dialog and copies the token
- [ ] 1.3 Confirm that a guest's joined project triggers `load_project` after `init_model`, and record which project is current at that moment
- [ ] 1.4 Confirm that `quit_session` fires before the peer is destroyed, so the registration can be removed
- [ ] 1.5 Record the Blockbench version and the members used (`EditSession`, `defaults.ip`, `start`, `join`, `quit`, `Project.EditSession`) in the Blockbench upgrade checklist

## 2. Pure registry and event logic, tests first

- [ ] 2.1 Parse the registration `{token, host, startedAt, expiresAt}` and the `saved` and `session` event payloads. Test every field, a missing field, an unknown event name, a `session` state other than started or ended, and a payload that is not a record
- [ ] 2.2 Add `readRegistration`, `register` and `removeRegistration` to the live client. Test the URL, method and body of each, `404` as none, `409` as conflict, `204` on delete, and that the token is URL-encoded in the delete query
- [ ] 2.3 Implement the SSE block parser for `event:` and `data:` lines, with fake response chunks. Test a block split over two chunks, a comment line and a block without a data line
- [ ] 2.4 Implement the `ETag` propagation decision: which local links to update for a `saved` event, and whether to announce it. Test an own save, a save by another participant, a project linked to another asset and a link with another environment
- [ ] 2.5 Implement the session view state (none, available, hosting, joining, joined) and its transitions from local events and `session` events. Test each transition, and that a second join while joining is refused
- [ ] 2.6 Implement the refresh scheduler with an injected timer. Test that a refresh happens after 20 seconds, that stopping clears it, and that a refresh failure keeps the schedule
- [ ] 2.7 Implement the signaling host validation. Test a bare host, a host with a scheme, a port, a path, an empty host and an uppercase host

## 3. Settings, storage and strings

- [ ] 3.1 Add the storage keys for the dev and prod signaling hosts and read them with a try/catch wrapper. Test that a missing or invalid value gives the default or empty
- [ ] 3.2 Declare the two settings in the existing settings module, category `general`, and have their changes emit the change bus. Verify the labels in the desktop app
- [ ] 3.3 Add the live editing strings in `src/i18n/live.ts` for en and de and merge them in `mount.ts`. Test key parity and placeholders with the existing i18n test pattern

## 4. Blockbench glue and panel

- [ ] 4.1 Declare the minimal `EditSession` type in `src/types/`. Declare only the members used in the proposal design
- [ ] 4.2 Implement `src/ui/live-editing.ts`: set `EditSession.defaults.ip`, start from the linked project, join with the registered token, subscribe to `create_session`, `join_session`, `quit_session`, `user_joins_session`, `user_leaves_session` and `load_project`, and remove the registration on quit and on unload. Keep the logic in the pure modules of section 2
- [ ] 4.3 Link the joined project to the host's asset on the first `load_project` while joining, and fetch the current `ETag` from the asset content headers. Verify in the desktop app that Ctrl+S saves the guest's project
- [ ] 4.4 Open one `events` stream per linked asset while a linked project is open, and abort it when the linked project changes. Apply the `ETag` propagation to every local link of the asset
- [ ] 4.5 Add the "Live editing" section to the Vulpes panel template and its state to the panel controller, with the Start, Join and Leave actions and the participant count. Test the controller transitions with a fake host

## 5. Verification

- [ ] 5.1 Run `npm run check` and `npm run build` green, and record the test count
- [ ] 5.2 Test two Blockbench instances against a local backend and sidecar: start, join, save by each side, and the message on the other side
- [ ] 5.3 Test a conflict with a stale `ETag` after a save by another participant, and check that the existing conflict choices appear
- [ ] 5.4 Test that the feature shows "not available" against a backend without the routes

## 6. Stream lifecycle and own saves

- [ ] 6.1 Reconnect the `events` stream after it ends or fails, with the backoff of design.md (1 second, doubling, capped at 30 seconds, back to 1 second after data). Test the policy as a pure unit, and the lifecycle with a fake fetch and fake timers: reconnect after a drop, no reconnect after close, no reconnect without the routes
- [ ] 6.2 Hold the `saved` events of an asset while an own save of it is in flight, drop the echo that carries the save's ETag, release the others when the save ends, and release all of them when it fails. Test the hold as a pure unit, and that a `saved` event whose ETag the link already holds changes nothing

## 7. Open the code pull request

- [ ] 7.1 Open the code pull request titled `feat(session): edit models live in vulpes-coordinated edit sessions` from the implementation branch, with no file under `openspec/`, after the proposal pull request is merged
