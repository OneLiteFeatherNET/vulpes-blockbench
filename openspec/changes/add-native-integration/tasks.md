# Tasks

## 1. Verify the Blockbench behaviour in the desktop app

- [ ] 1.1 Register a codec `vulpes` with a `write` that records its calls, open a project with `export_codec` `vulpes`, `export_path` `vulpes://dev/x/y` and an empty `save_path`, and press Ctrl+S. Confirm that `write` is called once and that no file is written. If it is not called, revise `design.md` (D6, Fallback) before task 3.1
- [ ] 1.2 Save a linked project with Save Project As to a local file, then press Ctrl+S. Confirm whether a request reaches Vulpes. If it does, choose the mechanism that ends the link (Finding 1) and record it in `design.md` before task 3.1
- [ ] 1.3 Confirm that `parse` with the path `ruby.bbmodel` sets the name `ruby` and leaves `save_path` empty, and that `export_path` and `export_codec` survive a restart and an autosave. Record the result in `design.md` (Open Questions)
- [ ] 1.4 Confirm, in the Preferences dialog and in the plugin's Settings tab, that (a) the active environment change calls `onChange` and the Cancel revert shows in the open dialog, (b) typing a URL is not interrupted by validation, and (c) the plugin tab's select stores `prod` without confirmation or not. Record the result, and revise D9 if (b) or (c) fails
- [ ] 1.5 Confirm that a `Panel` with `default_position: { slot: 'left_bar' }` and a Vue component renders and updates its list, and that `Action` entries placed at `file.#open` and `file.#project` appear at the end of their groups. Record the result
- [ ] 1.6 Run the checks of 1.1 to 1.5 on Blockbench 5.2.0 as well. If an API is missing on 5.2.0, raise `min_version` in the metadata and revise `design.md`
- [ ] 1.7 Record the results of 1.1 to 1.6 in the Open Questions of `design.md` and mark the matching finding as confirmed or revised

## 2. Pure modules, tests first

- [ ] 2.1 Write tests for the `vulpes://` path: a path built from environment, project id and asset id parses back to the same values, and an unknown environment, a missing segment or a path with a different scheme is rejected. Run them and see them fail
- [ ] 2.2 Implement `src/link/vulpes-path.ts` until the tests pass
- [ ] 2.3 Write tests for the display name: `vulpes:item/ruby` gives `ruby.bbmodel`, `vulpes:item/nested/ruby` gives `ruby.bbmodel`, and no result contains `vulpes://`. Run them and see them fail
- [ ] 2.4 Implement `src/link/display-name.ts` until the tests pass
- [ ] 2.5 Write tests for the link state: a linked project with a save time shows the key, environment and time; an unlinked project shows "not linked"; a project with no ETag held returns the refusal decision. Run them and see them fail
- [ ] 2.6 Implement `src/link/link-state.ts` until the tests pass
- [ ] 2.7 Write tests for the panel search and paging: the search ignores case and matches key and file name, and paging reports whether "Load more" is needed. Run them and see them fail. Implement them until they pass
- [ ] 2.8 Write a test that the English and German tables have the same keys and that no value is empty. Run it and see it fail. Implement `src/i18n/strings.ts` until it passes

## 3. Blockbench integration

- [ ] 3.1 Implement `src/ui/save-codec.ts`: the codec `vulpes` with `remember: false`, `compile` that returns `Codecs.project.compile()`, a `write` that never touches the file system and sends the replacement with the ETag of `Project.uuid`, a refusal when no ETag is held, and an `afterSave` that sets `Project.saved`. Test each branch with a fake transport before the Blockbench wiring. Depends on 1.1 and 1.2
- [ ] 3.2 Implement the link removal of a local save, using the mechanism chosen in 1.2
- [ ] 3.3 Implement `src/ui/file-actions.ts`: `vulpes_open` and `vulpes_save_new`, category `file`, no keybind, placed at `file.#open` and `file.#project`
- [ ] 3.4 Implement `src/ui/model-loader.ts`: the "Vulpes model" tile with `show_on_start_screen: true`
- [ ] 3.5 Implement `src/ui/panel.ts`: the badge, the test button, the project picker, the searchable paged list, the refresh, "Save to Vulpes" and the link state
- [ ] 3.6 Implement `src/ui/settings.ts`: the three plugin settings in `general`, the Prod confirmation with Cancel revert, and the validation restore, as decided in 1.4
- [ ] 3.7 Implement `src/ui/feedback.ts`: the quick message, the error box and the conflict box with its four commands
- [ ] 3.8 Remove `src/ui/vulpes-menu.ts`, `src/ui/settings-dialog.ts`, `src/ui/native-settings.ts`, `src/ui/save-routing.ts` and the click replacement of `installSaveRouting`. Update the tests that referred to them
- [ ] 3.9 Implement `src/ui/mount.ts` with `onload` and `onunload` in the order of D12, and set the metadata of D11 in `src/plugin.ts`
- [ ] 3.10 Add the declarations of the new Blockbench members to `src/types/blockbench.d.ts`, with only the members the code uses

## 4. Verify

- [ ] 4.1 Run `npm run check` and confirm that the type check, lint and every Vitest test pass. Record the test count
- [ ] 4.2 Run `npm run build` and confirm that `dist/vulpes.js` is written and contains `Plugin.register(`
- [ ] 4.3 Review every new test for F.I.R.S.T.: no timers, no system clock reads, no shared mutable state, no reads of log output, and one behaviour per test
- [ ] 4.4 Check in the Blockbench desktop app, on 5.2.2 and on 5.2.0: the start screen tile, File > New, the two File menu entries and their keybinds in the keybind settings, Ctrl+S on a model from Vulpes, File > Save Project and Save Project As leaving Vulpes alone, the conflict box, the Preferences and plugin Settings views, the Prod confirmation with Cancel, the URL validation, the panel badge and list, the German strings, and the unload and reload
- [ ] 4.5 Check that the top-level menu bar contains no "Vulpes" menu and that Settings contains no category `vulpes`

## 5. Ship

- [ ] 5.1 Commit the code as `feat(ui): integrate vulpes natively into blockbench`, with no session trailer
- [ ] 5.2 Open the code pull request with the title `feat(ui): integrate vulpes natively into blockbench`
