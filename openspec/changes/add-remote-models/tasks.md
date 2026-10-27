# Tasks

## 1. Spike: save routing, codec round trip and network path

- [ ] 1.1 Verify whether Ctrl+S and File > Save can be routed to Vulpes for a remote project, using `Blockbench.on('save_project')`, a custom `Codec` or `Project.save_path`. Record the result
- [ ] 1.2 Verify that `Codecs.project.compile()` and `Codecs.project.load()` (or `parse`) round-trip a `.bbmodel` without losing data. Record the result
- [ ] 1.3 Verify where the remote reference survives autosave, Save As to a local file and a restart of Blockbench, and whether it leaks into exported files. Record the result
- [ ] 1.4 Verify from the Blockbench renderer against Vulpes-Backend: the project list and the asset list are readable, the `ETag` is readable on `200`, `201` and the `412` response, and a multipart `POST` with an `If-Match` header passes the preflight. Record the renderer origin. If the origin is blocked by the backend's localhost-only CORS policy, the backend change that allows it is made before task 2 and is tracked in Vulpes-Backend. Record the result
- [ ] 1.5 Write the outcome in the "Spike outcome" section of `design.md`, and adjust tasks 2 to 6 if the outcome changes the design

## 2. Vulpes API client

- [ ] 2.1 Implement the calls: list projects (`GET /project/`), list models (`GET /project/{projectId}/asset/?kind=BBMODEL&page&size`), read content (`GET .../{id}/content`), create (multipart `POST /project/{projectId}/asset/`), and replace (multipart `POST .../{id}/content` with `If-Match`). Test the request each call builds with a fake `fetch`, including the multipart field names `file` and `key` and a file name ending in `.bbmodel`
- [ ] 2.2 Implement the Problem Details parser, which branches on `code` and reads `errors` with each violation's `field`, `code` and `message`. Implement the message table from `design.md`. Test every listed code, a violation on `key` and on `file`, an unknown code, a `413` without a code, and a body that is not Problem Details
- [ ] 2.3 Read the `ETag` response header of a `412` into `VulpesProblem.etag`. Test it, including a `412` whose header is missing
- [ ] 2.4 Test that a replacement is never sent without an ETag, and that `GET` and create requests never send `If-Match`
- [ ] 2.5 Add the optional token provider. Test that `Authorization: Bearer` is sent only when a provider returns a token

## 3. Open from Vulpes

- [ ] 3.1 Implement the project list and the paged model list (`page`, `size=50`), with the paging logic covered by unit tests
- [ ] 3.2 Build the "Open from Vulpes" dialog. Opening a model loads its bytes as a normal Blockbench project and stores the remote reference with the asset id, the key and the `ETag` from the response header
- [ ] 3.3 Show the error and unreachable states in the dialog without closing it or losing the selection

## 4. Save to Vulpes (new model)

- [ ] 4.1 Build the "Save to Vulpes" dialog with a project picker and a key field. Only an empty key is rejected on the client
- [ ] 4.2 Send the compiled JSON with the multipart create call, using the key from the field and the file name from `design.md`. Store the reference from the `201` body. Show `ASSET_KEY_INVALID` next to the key field and `RESOURCE_CONFLICT` as the key-taken message
- [ ] 4.3 Test that the textures embedded in the `.bbmodel` are sent unchanged and that no separate upload happens

## 5. Save to Vulpes (existing model)

- [ ] 5.1 Route Ctrl+S and File > Save for remote projects to the replace call with the stored ETag, as the spike outcome allows. Store the `ETag` from the `200` response
- [ ] 5.2 Open the conflict dialog on `412` with Overwrite, Load latest (with confirmation) and Save as copy, and implement each choice. Overwrite sends the replacement with `If-Match` set to the `ETag` of the `412` response, without a `GET`, and opens the conflict dialog again on a second `412`. Test each path with a fake `fetch`
- [ ] 5.3 Keep the local project and the stored ETag unchanged on a network error or any other error, and show the mapped message
- [ ] 5.4 Verify that File > Export and Save As to a file send nothing to Vulpes

## 6. Verify and ship

- [ ] 6.1 Review every test for F.I.R.S.T.: no sleeps, no system clock reads, no shared mutable state, and every test has an assertion
- [ ] 6.2 Verify open, save new, save existing, conflict and offline behaviour end to end in the Blockbench desktop app against a Vulpes-Backend instance that includes `add-asset-replace-precondition`
- [ ] 6.3 Commit the change as `feat(model): open and save models from vulpes` and open the pull request with that title, after `add-build-toolchain` and the backend changes are merged
