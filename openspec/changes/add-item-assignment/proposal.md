# Proposal

Ships as `feat(model): assign a vulpes model to an item`.

Depends on `add-remote-models`, which provides the link of a project to its Vulpes project and asset, and on `add-native-integration`, which places the plugin's actions in the File menu and the panel footer where this change adds its entry points.

It does not depend on `add-device-login`. Like the other Vulpes calls, the item calls send a bearer token only when a token provider is configured.

## Why

A designer builds an item model in Blockbench, saves it to Vulpes and then has to open the Vulpes web UI, find the item and type the model key into its `minecraft:item_model` component. The key is easy to mistype, and nothing in Blockbench shows which item already uses the model. The designer should be able to pick the item in Blockbench and assign the model in the same place where the model was saved.

## What Changes

- Add an "Assign to item..." entry to the File menu, in the project group, and a button in the "Vulpes" panel footer. Both are shown for a project that is linked to Vulpes. The entry is named by its translation key, has no default key binding and is removed when the plugin unloads.
- The dialog lists the items of the linked model's Vulpes project. The designer filters them by name or key. The item list is loaded once for the dialog.
- The dialog shows the current `minecraft:item_model` value of the selected item when the designer refreshes the selection.
- Confirming writes the model key into the `minecraft:item_model` component of the item. The plugin creates the component when the item has none, and asks before it replaces another value.
- Vulpes errors for these calls are shown with messages of their own for a missing item and for a component written meanwhile, and the other errors use the existing problem-details messages.

Not part of this change (non-goals):

- Creating items, or editing other components of an item.
- Removing the `minecraft:item_model` component.
- Assigning a model to several items at once.
- A server-side search. The item list is read in pages and filtered in the plugin.
- Concurrency control for items. The backend has no ETag for items, so the last write wins, as it does in the web UI.
- Checking that the model key names an existing asset. The designer assigns the key of the linked model, which exists by construction.

## Capabilities

### New Capabilities

- `item-assignment`: Assigning the key of a linked Blockbench model to an item of its Vulpes project.

### Modified Capabilities

None.

## Impact

- **Code**: a new item API in the Vulpes client, pure planning modules under `src/items/`, the dialog and the actions in `src/ui/assign-item.ts`, and the messages in `src/i18n/items.ts`.
- **API**: consumes existing endpoints of Vulpes-Backend only: `GET /project/{projectId}/item/`, `GET /item/{itemId}/components`, `PUT /item/{itemId}/component` and `POST /item/{itemId}/component`. Adds no endpoint.
- **CORS**: the item writes use the `PUT` method and a JSON body, so the browser sends a preflight for them. The backend's CORS policy is checked in the spike (see `design.md`).
- **Risk**: the backend accepts `PUT` on a component of an item that has the key already, and answers `409`. The plugin handles that case without writing twice.
