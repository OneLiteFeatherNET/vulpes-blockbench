# Proposal

Ships as `feat(model): browse and restore model revisions`.

Depends on `add-remote-models`, which provides the open, save and conflict flows and the `ETag` handling this change builds on, and on the backend change `add-asset-revisions` in Vulpes-Backend. That change records a revision on every create and replace of an asset, accepts an optional `comment` on both, and adds the revision routes this plugin calls. Until the backend change is deployed, the plugin shows that revisions are not available instead of failing.

## Why

A designer who saves a model in Blockbench overwrites the only copy in Vulpes. When a texture or an element was removed by mistake, or an earlier version was better, the designer has no way back short of rebuilding the model by hand. The Vulpes web UI keeps no history for models either, so the Blockbench plugin is the only place where the designer can see what changed and when.

## What Changes

- Every save from Blockbench creates a revision in Vulpes. Ctrl+S stays as it is, without a prompt.
- Add a "Save to Vulpes with comment..." action in the File menu. It asks for a short comment and saves the linked model with it. It has no default key binding.
- Add a "Revisions" section to the Vulpes sidebar panel. For the linked model it lists the revisions, newest first, with number, date, comment and a marker for the current one. The list loads one page at a time and refreshes after each save and restore.
- "Open" a revision as a new Blockbench project named `<key> @ r<number>`. The project is not linked to Vulpes, so Ctrl+S on it never writes to Vulpes.
- "Restore" a revision after a confirmation. Restoring creates a new revision with the old content. The plugin then asks whether to load the restored content into the open project, and warns first when the open project has unsaved changes.
- A `412` during restore uses the same conflict choices as a save.

Not part of this change (non-goals):

- Deleting or pruning revisions, and comparing two revisions.
- Restoring into a new model or into another key. Restore always targets the linked asset.
- Editing a comment after it was saved.
- Revisions of textures or other asset kinds. The section shows `BBMODEL` revisions only.
- Sign-in. Requests keep the optional token of `add-remote-models`.

## Capabilities

### New Capabilities

- `model-revisions`: Saving with a comment, listing, opening and restoring the revisions of a linked model.

### Modified Capabilities

None.

## Impact

- **Code**: the Vulpes API client gains the revision calls and an optional comment on replace. The new logic lives in `src/revisions/`, the Blockbench glue in `src/ui/revisions.ts` and the strings in `src/i18n/revisions.ts`. The shared panel, save and client files get small additive edits.
- **API**: consumes `GET .../asset/{id}/revision`, `GET .../revision/{revisionId}/content` and `POST .../revision/{revisionId}/restore` of Vulpes-Backend, plus the `comment` field of the replace call.
- **Compatibility**: a backend without revisions answers `404` on the revision routes. The plugin then shows "revisions not available on this backend" in the panel and in the action, and nothing else changes.
- **Risk**: restore changes the asset that the open project is linked to. The reload of the restored content is the existing load-latest path, so its confirmation and its handling of local changes apply unchanged.
