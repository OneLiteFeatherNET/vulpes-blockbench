# Proposal

Ships as `feat(model): open and save models from vulpes`.

Depends on `add-build-toolchain`, which provides the strict TypeScript build, and on two backend changes in Vulpes-Backend: the existing project asset API from draft PR #238 (the asset endpoints this change calls), and `add-asset-replace-precondition`, which adds the opt-in `If-Match` on content replacement.

It does not depend on `add-device-login`. Requests carry a bearer token only when a token provider is configured, so the first version works against a local backend without sign-in. Sign-in arrives later with the shared backend auth change (see `add-device-login`, deferred).

## Why

Designers export a `.bbmodel` from Blockbench, find the right project in the Vulpes web UI and upload the file again. Each round trip loses track of which file belongs to which model, and a second copy of a model can end up in Vulpes without anyone noticing. Designers should open a model from Vulpes into Blockbench, save it back with Ctrl+S, and never need the web UI for this.

## What Changes

- Add an "Open from Vulpes" dialog. It lists projects, then the Blockbench models (`BBMODEL` assets) of the chosen project, and opens the chosen model as a normal Blockbench project.
- Add a "Save to Vulpes" action for a new model. The designer picks a project and enters a resource-location key such as `vulpes:item/ruby`.
- Save an opened or saved model back to Vulpes with Ctrl+S or File > Save. The plugin remembers where the model came from.
- Protect every save against concurrent edits with the `If-Match` precondition. If the model changed in Vulpes since it was opened, the designer chooses how to continue. A save never overwrites a newer version silently.
- Show clear messages for Vulpes errors, read from the `code` of the error body, and keep the local project intact when Vulpes cannot be reached.

Not part of this change (non-goals):

- Linking models to items, fonts or advancements.
- A texture library. Textures stay embedded in the `.bbmodel`, and the backend extracts them.
- Sign-in, token refresh and sign-out. These belong to `add-device-login`, which is deferred.
- A separate API for the plugin. The plugin uses the existing asset endpoints of Vulpes-Backend.
- Web Blockbench support.
- Publishing the plugin to the official Blockbench plugin store.

## Capabilities

### New Capabilities

- `remote-models`: Opening, saving and conflict handling of Blockbench models that are stored as Vulpes project assets.

### Modified Capabilities

None.

## Impact

- **Code**: the Vulpes API client, the open and save dialogs, the save routing for remote projects, and the error mapping, all in this repository.
- **API**: consumes the existing project asset API of Vulpes-Backend (`/project/{projectId}/asset`), which the web UI also uses. Needs the `If-Match` precondition of `add-asset-replace-precondition`. Adds no new endpoints.
- **CORS**: the backend allows only `localhost` and `127.0.0.1` origins today (a preflight from `null` or `file://` gets `403`) and exposes the `ETag` header. Whether the Blockbench renderer origin must be added is decided by the spike (see `design.md`, Network access). Any such change is made in the backend.
- **Risk**: how Ctrl+S reaches the plugin is not yet verified. A spike comes first and may change `design.md`.
