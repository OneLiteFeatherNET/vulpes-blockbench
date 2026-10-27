# Tasks

## 1. Spike: CORS and the item endpoints

- [ ] 1.1 Verify from the Blockbench renderer against Vulpes-Backend that the item list, the components and a `PUT` with a JSON body pass the preflight, and record the renderer origin. If the preflight is blocked, make the backend change first and track it in Vulpes-Backend. Record the result
- [ ] 1.2 Verify the response bodies of the item list and the component endpoints against the backend DTOs, and record any field that differs from `design.md`
- [ ] 1.3 Write the outcome in the "Spike outcome" section of `design.md`

## 2. Item API and planning

- [ ] 2.1 Add the item calls to the Vulpes client: list items, list components, create a component (`PUT`) and update a component (`POST` with the id). Test the URL, the method, the JSON body and that no `If-Match` is sent
- [ ] 2.2 Parse the item and component bodies with type guards. Test a valid page, an item without `key`, and a component without `value`
- [ ] 2.3 Read every page of items and components with the stop rule of the project list. Test a multi-page list, an empty page and a failed later page
- [ ] 2.4 Implement the filter of items by name or key, case-insensitive. Test a blank query, a match on the name and a match on the key
- [ ] 2.5 Implement the plan from the components and the model key: `already-assigned`, `create`, `replace`. Test each outcome, a component with another key, and a non-string value shown as JSON
- [ ] 2.6 Implement the assignment over the client with the confirmation as an injected function. Test create, no-op, a confirmed replacement with the id, a declined replacement with no write, and a `404` and a `409` mapped to their messages

## 3. Dialog and actions

- [ ] 3.1 Add the English and German texts in `src/i18n/items.ts`. Test that both tables have the same keys and that the placeholders match
- [ ] 3.2 Build the "Assign to item" dialog with the search field, the item selector, the Refresh button and the current value line. Opening it reads the items of the linked project once
- [ ] 3.3 Add the File menu entry `vulpes_assign_item` and the panel footer button, shown for a linked project only, and remove the entry on unload
- [ ] 3.4 Show the success message with the item name and the key, and the already-assigned message as a quick message

## 4. Verify and ship

- [ ] 4.1 Review every test for F.I.R.S.T.: no sleeps, no system clock reads, no shared mutable state, and every test has an assertion
- [ ] 4.2 Verify the assignment end to end in the Blockbench desktop app against a Vulpes-Backend instance, for an item without the component, an item with the same model and an item with another model
- [ ] 4.3 Open the code pull request with the title `feat(model): assign a vulpes model to an item`, after the proposal pull request is merged
