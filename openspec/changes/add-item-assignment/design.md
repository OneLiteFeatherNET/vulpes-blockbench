# Design

## Context

Items and their components belong to the Vulpes backend. The plugin reads them through the endpoints the web UI also uses. An item references a model through the component `minecraft:item_model`, whose value is the model's resource location, the asset key of the `.bbmodel`, for example `"vulpes:item/ruby"`.

The endpoints this change calls:
- `GET /project/{projectId}/item/?page&size` returns a page `{ content, pageable, totalSize }` of items with `id`, `uiName`, `key`, `comment` and `groupName`. There is no search parameter, so the plugin reads every page and filters.
- `GET /item/{itemId}/components?page&size` returns a page of `{ id, componentKey, value }`. The item id is the only path key, because components belong to the item.
- `PUT /item/{itemId}/component` with the body `{ componentKey, value }` adds a component. It answers `409` when the item already has the key.
- `POST /item/{itemId}/component` with the body `{ id, componentKey, value }` changes an existing component. It answers `409` when the item already has the key that the entry would change to, and `404` when the item or the component is gone.

Items carry no ETag, so no `If-Match` is sent. Two designers who assign at the same time see the later write win, the same as in the web UI.

## Decisions

**The planning is pure.** `src/items/` contains the item list paging and filter, the planning of the component write and the orchestration over an injected client. The Blockbench glue in `src/ui/assign-item.ts` only opens dialogs and shows messages. Vitest covers the pure parts with a fake fetch.

**The plan has four outcomes.** A component with the model key already present gives `already-assigned` and no write. A missing component gives `create`. A component with another value gives `replace`, and the plugin asks the designer first and names the old value. A confirmed replacement updates the entry found by its id. A declined one writes nothing.

**The link decides the environment.** The base URL and the project id come from the link record of the open project, the same record that saves use. The active environment is never consulted, so an assignment to a Prod model goes to Prod even when Dev is active.

**The dialog reopens for a refresh.** Blockbench forms offer text and select fields and a set of buttons, and this change uses only those. The "Refresh" button applies the search, reopens the dialog with the filtered list and shows the current value of the selected item. The current value is read only for that item.

**Errors keep their meaning.** A `404` on an item write means the item is gone, and a `409` means it was changed meanwhile. Both have their own message. Other errors go through the existing problem-details mapping.

## Spike outcome

Not yet run. Task 1.1 checks from the Blockbench renderer that the `PUT` preflight passes the backend's CORS policy, which today allows only localhost and 127.0.0.1 origins. If the preflight fails, the change to the backend is made before task 3 and is tracked in Vulpes-Backend.

## Goals and non-goals

Goals: the designer assigns the linked model to an item without the web UI, sees what the item uses now before it changes, and never loses another value without being asked.

Non-goals are listed in the proposal.
