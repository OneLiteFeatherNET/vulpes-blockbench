# Design

## Context

`add-remote-models` links a Blockbench project to a Vulpes asset with a `RemoteReference` (base URL, project id, asset id, key, `ETag`), held in memory by `src/ui/project-link.ts`. Saves replace the asset with `If-Match` set to the held `ETag`. The backend change `add-asset-revisions` keeps every version of an asset as a numbered revision. This change exposes those revisions in the plugin.

The backend contract this change codes against:

- `POST .../asset/{id}/content` and create accept an optional multipart field `comment`.
- `GET .../asset/{id}/revision?page&size` returns `{ content, pageable, totalSize }` of `{ id, number, sha1, size, comment | null, creationDate, current }`, newest first.
- `GET .../asset/{id}/revision/{revisionId}/content` returns the bytes with `ETag: "<sha1>"`.
- `POST .../asset/{id}/revision/{revisionId}/restore` with `If-Match: "<current ETag>"` returns `200` with the asset and a new `ETag`. The restore creates revision n+1 with the old bytes. A stale `If-Match` returns `412 ASSET_PRECONDITION_FAILED` with the current `ETag` header.
- Backends without revisions answer `404` on these routes.

## Goals / Non-Goals

Goals: a comment on demand without touching Ctrl+S; browsing the history of the linked model; opening an old version read-only; restoring an old version under the same conflict rules as a save.

Non-goals: see the proposal.

## Decisions

### Logic outside Blockbench

The revision DTO guards, the paging, the availability rule, the restore decision and the snapshot name are plain TypeScript in `src/revisions/`. They take a client, a clock-free fetch and plain values, so Vitest runs them with a fake fetch. Only `src/ui/revisions.ts` reads `Project`, `Dialog` and `Codecs`.

### Availability of the revision routes

A `404` from a revision route with no problem `code` means the backend has no revisions. The plugin maps that to `unavailable` and shows `vulpes.revisions.unavailable`. A `404` with a known code (`PROJECT_NOT_FOUND`, `RESOURCE_NOT_FOUND`) keeps its normal message, so a deleted model is not reported as a missing feature.

### Comment on save

The "Save to Vulpes with comment..." action asks with `Blockbench.textPrompt`, trims the answer, and calls the same linked save as Ctrl+S with the comment. An empty answer saves without a comment. Cancelling the prompt does nothing. The comment is passed as a parameter, never stored, so the next Ctrl+S carries no comment.

### Open a revision as a snapshot

Opening a revision parses its bytes with `Codecs.project.parse`, sets the project name to `<key> @ r<number>`, and clears the export codec, the export path and the save path. The snapshot has no link record, so the codec `vulpes` never writes to it. Ctrl+S on a snapshot falls back to Blockbench's local save.

### Restore

Restore is confirmed with a message box. The plugin sends the restore with `If-Match` set to the held `ETag` of the linked project. On `200` the new `ETag` from the response header replaces the held one, and the plugin asks whether to load the restored content into the open project. If the project has unsaved changes, the question says they will be lost. Loading uses the existing load-latest path (`loadLatestInto`), so the reload reads the asset as it is now.

On `412` the conflict dialog of `add-remote-models` is reused. Overwrite repeats the restore with the `ETag` of the `412` response, Load latest and Save as copy behave as they do for a save. Restore never sends a request without a valid `ETag`.

### Panel section

The section is a second controller, `src/revisions/controller.ts`, with its own view state. `vulpes-panel.ts` renders it next to the panel state and forwards the clicks. The panel state, its host and the panel host are not changed, so the revision work does not touch the paging or the search of models.

### Strings

All new strings are in `src/i18n/revisions.ts` and registered in `mount.ts` next to the existing tables. Both languages have every key, and the placeholders match, as `test/i18n` checks.

## Contract notes

- The revision `id` is a string, like the asset ids. A numeric id would fail the guard and the section would show the unexpected-response message.
- `creationDate` is shown as the backend sends it, formatted by the locale of Blockbench.
- The page size for revisions is 20.

## Risks / Trade-offs

- `Blockbench.textPrompt` is used as documented for Blockbench 5.2. It is verified in the desktop app before the change ships, as the save routing is.
- Refreshing the list on every change event costs one request per selection change of a linked project. The list is small, so this is accepted to keep the change simple.
- A restore that succeeds but whose response carries no `ETag` is treated as a failure. The asset then keeps the old `ETag` in the plugin, so the next save gets a `412` and the designer is asked, instead of overwriting unseen content.

## Open Questions

- Whether the backend returns the restored asset's `ETag` on the `200` of restore. The contract says so, and the plugin relies on it.
