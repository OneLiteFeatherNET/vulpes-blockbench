# Proposal

Ships as `feat(model): open and save models from vulpes`.

Depends on `add-build-toolchain`, which provides the strict TypeScript build, and on `add-device-login`, which provides the signed-in state and the authorized request function.

## Why

Designers export a `.bbmodel` from Blockbench, find the right project in the Vulpes web UI and upload the file again. Each round trip loses track of which file belongs to which model, and a second copy of a model can end up in Vulpes without anyone noticing. Designers should open a model from Vulpes into Blockbench, save it back with Ctrl+S, and never need the web UI for this.

## What Changes

- Add an "Open from Vulpes" dialog. It lists projects, then the models of the chosen project, and opens the chosen model as a normal Blockbench project.
- Add a "Save to Vulpes" action for a new model. The designer picks a project and enters a resource-location key such as `vulpes:item/ruby`.
- Save an opened or saved model back to Vulpes with Ctrl+S or File > Save. The plugin remembers where the model came from.
- Protect every save against concurrent edits. If the model changed in Vulpes since it was opened, the designer chooses how to continue. A save never overwrites a newer version silently.
- Show clear messages for Vulpes errors, and keep the local project intact when Vulpes cannot be reached.

Not part of this change (non-goals):

- Linking models to items, fonts or advancements.
- A texture library. Textures stay embedded in the `.bbmodel`, and the backend extracts them.
- Web Blockbench support.
- Publishing the plugin to the official Blockbench plugin store.

## Capabilities

### New Capabilities

- `remote-models`: Opening, saving and conflict handling of Blockbench models that are stored in Vulpes.

### Modified Capabilities

None.

## Impact

- **Code**: the Vulpes API client, the open and save dialogs, the save routing for remote projects, and the error mapping, all in this repository.
- **API**: consumes the `/blockbench/v1` contract of Vulpes-Backend. Requires the backend to allow the plugin's requests (see `design.md`, Contract notes).
- **Risk**: how Ctrl+S reaches the plugin is not yet verified. A spike comes first and may change `design.md`.
