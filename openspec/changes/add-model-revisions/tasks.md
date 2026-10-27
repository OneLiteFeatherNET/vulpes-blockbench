# Tasks

## 1. Revision contract in the API client

- [ ] 1.1 Parse the revision page and each revision (`id`, `number`, `sha1`, `size`, `comment` or null, `creationDate`, `current`). Test every field, a null comment, a page with one invalid revision and a body that is not a page
- [ ] 1.2 Add `listRevisions`, `readRevision` and `restoreRevision` to the client. Test the URL and method of each, that `If-Match` is set on restore only, that `readRevision` requires an ETag, and that restore refuses a missing or weak ETag without sending a request
- [ ] 1.3 Add the optional `comment` to the replace call and send it as a multipart field only when it is not empty. Test the field present, the field absent when no comment is given, and that the file part is unchanged
- [ ] 1.4 Classify a `404` without a problem code on a revision route as unavailable. Test a `404` with `PROJECT_NOT_FOUND` keeps its normal message

## 2. Pure revision logic

- [ ] 2.1 Implement the revision paging (page size 20, next page, has-more) with its tests, including a failed page that leaves the list unchanged
- [ ] 2.2 Implement the restore outcome (restored, conflict, failed) and the decision after a restore (done, or ask to reload with or without the unsaved-changes warning). Test each outcome with a fake client
- [ ] 2.3 Implement the snapshot name `<key> @ r<number>`. Test a key with a slash and a colon
- [ ] 2.4 Implement the revision controller state: not linked, loading, ready, unavailable, error, load more, and the refresh on change. Test each transition with a fake host

## 3. Save with comment

- [ ] 3.1 Thread an optional comment through the linked save of the codec module, so Ctrl+S keeps sending none. Test that Ctrl+S sends no comment
- [ ] 3.2 Register the "Save to Vulpes with comment..." action in the File menu group `#project`, category `file`, without a default key. Route the prompt result through the linked save. Verify the prompt, cancel and not-linked paths in the Blockbench desktop app

## 4. Revisions section

- [ ] 4.1 Add the section to the Vulpes panel template and forward its clicks to the revision controller. Keep the panel state and its host unchanged
- [ ] 4.2 Implement the Blockbench host of the section: read the held record of the open project, call the client with the record's base URL, and map `unavailable` to its message
- [ ] 4.3 Implement "Open" for a revision as a snapshot with no link, and verify in the desktop app that Ctrl+S on it does not reach Vulpes

## 5. Restore

- [ ] 5.1 Confirm the restore with a message box, call the restore with the held ETag, and store the new ETag from the response
- [ ] 5.2 Ask whether to load the restored content, warn about unsaved changes, and load through the existing load-latest path. Verify both answers in the desktop app
- [ ] 5.3 Reuse the conflict choices on `412`. Verify Overwrite, Load latest and Save as copy with a restore

## 6. Strings and verification

- [ ] 6.1 Add the English and German strings in `src/i18n/revisions.ts` and register them. The translation test checks that both languages have every key and the same placeholders
- [ ] 6.2 Review every new test for F.I.R.S.T.: no timers, no system clock, no shared state, one behaviour per test and an assertion in each
- [ ] 6.3 Run `npm run check` and `npm run build` green, and verify the revision flows end to end against a Vulpes-Backend that includes `add-asset-revisions`, and against an older backend that answers `404`
- [ ] 6.4 Commit the code as `feat(model): browse and restore model revisions` and open the pull request with that title, after `add-remote-models` and the backend change `add-asset-revisions` are merged
