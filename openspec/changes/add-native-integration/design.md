# Design

## Context

The plugin is a Blockbench desktop plugin (`variant: 'desktop'`). Two changes built the logic and the first UI: `add-environment-settings` (two environments, validation, the origin of a save) and `add-remote-models` (open, save, conflicts). Their UI is not idiomatic. It has its own top-level menu, its own settings dialog and category, and it replaces the click handlers of `export_over` and `save_project`. This change moves the same behaviour into the places where Blockbench users look for it, and it removes the click replacement.

Logic modules keep their rules and receive their collaborators as parameters. Only `src/ui/` calls Blockbench globals.

## Verified Blockbench API

Source: the Blockbench 5.2.2 source in the read-only clone (commit `ec0b282`), paths relative to its `js/` directory. Line numbers are as read in that commit.

| Need | Verified name | Source |
|---|---|---|
| File menu groups | Separators `open` (line 109) and `project` (line 190). The `open` group holds `open_model`, `open_from_link` (188) and `new_window` (189). The `project` group holds `save_project`, `save_project_as` (192), `save_project_incremental`, `convert_project` and `close_project` (195) | `interface/menu_bar.ts` |
| Action in a menu | `MenuBar.addAction(action, path)`. The first path segment names the menu (`file`). `#group` is a group anchor, and it inserts at the **end** of the named group. Numeric indexes and item ids are the other forms | `interface/menu_bar.ts:862`, `interface/menu.ts:767-790` |
| Remove an action | `Action.delete()` removes it from every menu it is in. | `interface/actions.ts:588-597` |
| Action category and keys | `category` (default `misc`, line 123). Without a `keybind` option the action gets an empty `Keybind` that the user can set in the keybind settings (lines 124-135). | `interface/actions.ts:123-135` |
| Top-level menu label | `BarMenuOptions.name` (line 12) is passed through `tl()` and becomes the label at construction (lines 36-37). A change needs a new `BarMenu`, as the current code does | `interface/menu_bar.ts:11-37` |
| Remove a top-level menu | `BarMenu.delete()` removes the label and the `MenuBar.menus` entry (lines 74-78) | `interface/menu_bar.ts:74` |
| Start screen and File > New | `new ModelLoader(id, { icon, name, description, show_on_start_screen, onStart })`. `show_on_start_screen` defaults to `true` (line 44). `new()` calls `onStart` (line 59). `delete()` removes it (line 62). File > New lists `ModelLoader.loaders` (menu_bar.ts:128-129) and the start screen does too (`interface/start_screen.ts:199, 225`) | `io/model_loader.ts` |
| Sidebar panel | `new Panel(id, { default_position: { slot: 'left_bar' }, component, ... })`. `PanelSlot` includes `left_bar` (line 23). The default slot is `left_bar` (line 74). `component?: Vue.Component` (line 124). `Panel.delete()` (line 1090) | `interface/panels.ts` |
| Setting | `new Setting(id, data)` with `name`, `type`, `value`, `category` (default `general`, line 96), `plugin` (default `Plugins.currently_loading`, line 101), `options` for `select`, `onChange` (line 118). Stored in the global `settings[id]`. | `interface/settings.ts:20-101` |
| Setting value | The `value` setter writes `master_value` (lines 150-162). `Settings.saveLocalStorages()` writes the `settings` key of `localStorage` (lines 486-496) | `interface/settings.ts` |
| Remove a setting | `setting.delete()` removes it from `settings` and from its category (lines 181-189) | `interface/settings.ts:181` |
| Add a category | `Settings.addCategory` reads `Settings.dialog.sidebar` (line 480-481), so it needs the settings dialog, which `settings_window.ts:119` creates. This is why it crashed. **This change does not call it.** | `interface/settings.ts:474-484` |
| Plugin settings tab | `selected_plugin_settings()` and the list in the plugin manager filter by `setting.plugin` (`plugin_loader.ts:1489, 1750`) | `plugin_loader.ts` |
| Change handler, plugin tab | Text inputs call `changePluginSetting(setting)` on every `@input` (`plugin_loader.ts:2035, 2039`). That method waits 20 ms, then calls `setting.onChange(setting.value)` and saves (`plugin_loader.ts:1589-1596`). The select is bound as `@change="changePluginSetting"setting` (`plugin_loader.ts:2048`), see Finding 3 | `plugin_loader.ts` |
| Change handler, Preferences | `onChange` runs **after** the designer presses Done. `Settings.save()` has already stored the values (`interface/settings_window.ts:343-363`) | `interface/settings_window.ts` |
| Save action | `export_over`, label "Save Model" (`lang/en.json:1677`), keybind Ctrl+S (`io/io.js:378-381`). It runs `saveTextures()`, writes the project codec to `Project.save_path` when set (388-390), and writes `Codecs[Project.export_codec] ?? Format.codec` to `Project.export_path` when set (384, 391-393). The `export` branch only runs when there is no `save_path` (396) | `io/io.js:378-416` |
| Project save action | `save_project`, label "Save Project", in the `project` group. It calls `codec.write` when `save_path` is set and `codec.export()` otherwise (`formats/bbmodel.js:873-886`) | `formats/bbmodel.js` |
| Codec | `new Codec(id, data)` registers `Codecs[id]` (line 113). `compile`, `write`, `parse`, `load`, `overwrite` and `afterSave` are merged from the data (lines 121-127). `remember` (line 130). `delete()` (line 365) | `io/codec.ts` |
| Codec write | The default `write` calls `Blockbench.writeFile` (line 321-326). The default `afterSave` sets `save_path`, `export_path`, `export_codec` and `saved` only for the project codec and the format codec (lines 336-350), and it names the project from the path (line 354) | `io/codec.ts` |
| Codec load | `load` sets `export_path`, `export_codec` and the name only when `remember` is `true` (lines 164-168). `parse(model, path)` sets `Project.name` from the path (`formats/bbmodel.js:411`, name at `:455`) | `io/codec.ts`, `formats/bbmodel.js` |
| Project fields | `save_path`, `export_path`, `export_codec` (lines 136-138), `uuid` (line 21), `saved` setter dispatching `saved_state_changed` (lines 232-235) | `io/project.ts` |
| Quick message | `Blockbench.showQuickMessage(message, time)` applies `tl()` to the message (line 135-136) | `api.ts` |
| Message box | `Blockbench.showMessageBox(options, cb)` (line 170). `commands` closes the box with the command id as the first argument (`interface/dialog.ts:939-941`). `buttons`, `confirm`, `cancel` and `checkboxes` (lines 921-946) | `api.ts`, `interface/dialog.ts` |
| Dialog button | `onButton` returning `false` keeps the dialog open (`interface/dialog.ts:519-523`) | `interface/dialog.ts` |
| Translations | `tl(key)` (line 57). `Language.addTranslations(lang, strings)` (line 126) sets the strings when the Blockbench language matches `lang`, or for `en` when a key is missing | `languages.ts` |
| Plugin metadata | `about` (line 164), `icon` (169), `tags` as a tuple of up to three (173), `variant` (177), `min_version` (181), `website` (210), `repository` (214), `bug_tracker` (218), `onload`, `onunload` (227, 231) | `plugin_loader.ts` |

### Findings from the source

These findings change assumptions in the brief or in the earlier changes. Each one has a task that checks it in the desktop app.

1. **Save As of a linked project writes to Vulpes too.** `export_over` writes the project file to `save_path` and, in a second independent `if`, writes the export codec to `export_path` (io.js:388-393). A local Save Project or Save Project As sets `save_path` (codec.ts:343-344) but does not clear `export_path` or `export_codec`. After a local Save As, one Ctrl+S would therefore write the local file and the Vulpes asset. The rule in the spec is that a local save ends the Vulpes link. The mechanism is not chosen yet. The candidates are a wrapper of `Codecs.project.afterSave`, which is restored on unload, or a Blockbench event if one turns out to fire after the file is written. The spike chooses it (task 1.2).
2. **The save codec must set `saved` itself, and must not use the default `afterSave`.** The default `afterSave` sets `saved` only for the project and format codecs (codec.ts:336-350), and its message names the file from the path. The `vulpes` codec overrides `afterSave` and `write`.
3. **The plugin tab's select does not call `onChange`.** The select is bound as `@change="changePluginSetting"setting` (plugin_loader.ts:2048), which passes no setting to the handler. The Preferences dialog calls `onChange` after Done (settings_window.ts:362). The Prod confirmation therefore runs in the Preferences dialog. In the plugin tab it may not run at all. Task 1.4 checks this.
4. **The plugin tab fires `onChange` on every keystroke.** Text fields call `changePluginSetting` on `@input` (plugin_loader.ts:2035, 2039). A rule that restores the previous value on an invalid URL would interrupt typing in that tab. Task 1.4 checks this, and the fallback is in Open Questions.
5. **A Prod switch is stored before it is confirmed.** In the Preferences dialog `onChange` runs after `Settings.save()` (settings_window.ts:343-363). The confirmation therefore reverts the value on Cancel. It does not block the store. No request can run while the modal confirmation is open, so the stored value is not used for a request in that window.
6. **`file.#open` and `file.#project` add at the end of the group.** The path grammar has no item-id form (menu.ts:767-790). The action cannot be placed "directly after `open_from_link`" or "directly after `save_project_as`" by id. A numeric index would depend on the position of every other item and on other plugins, so it is not used. The actions land after `new_window` in the `open` group, and after `close_project` in the `project` group.
7. **A codec that is not registered leaves a dangling route.** `export_over` falls back to the format codec when `Codecs[Project.export_codec]` is missing (io.js:384). With the plugin unloaded, a `vulpes://` export path would then be written as a file. On unload the plugin clears the link of every open project whose export codec is `vulpes`.

## Goals / Non-Goals

**Goals:**
- Make the plugin look like part of Blockbench: no own menu, no own dialog, no foreign category.
- Keep the Dev and Prod distinction visible at all times in the panel.
- Route Ctrl+S through Blockbench's own save action, without replacing any click.
- Keep every save going to the origin of the project, never to the active environment.
- Keep all text translatable, and keep the unload path complete.

**Non-Goals:**
- Changing the Vulpes requests, conflict logic or error mapping of `add-remote-models`.
- A status bar entry (no verified API).
- Publishing to the store, and web Blockbench.

## Decisions

### D1. No top-level menu

The `BarMenu` `vulpes` and its entries are removed. `src/ui/vulpes-menu.ts` and `src/ui/settings-dialog.ts` are removed. The open and save-new actions live in the File menu (D4), and the settings live in the plugin settings (D7). The environment indicator is the panel badge (D2).

### D2. Sidebar panel

A `Panel` with id `vulpes` and `default_position: { slot: 'left_bar' }` sits in the left bar, like the outliner. Its content, top to bottom:

1. The environment badge, `DEV` or `PROD`. `PROD` uses a distinct colour and a border, and the label always reads the stored active environment.
2. The base URL of the active environment, and "Test connection". The test is `GET {baseUrl}/project/?size=1`, the same request as today. The result is shown in the panel, as "Connected (HTTP 200)", "HTTP 404", "Network error (a CORS block is one possible cause)", or "Not configured".
3. A project picker, which lists the projects of the active environment.
4. A search field and a paged list of models of the chosen project (`size=50`, "Load more"). A double-click or the "Open" button opens the model through the Open from Vulpes flow.
5. A refresh action for the project and model lists.
6. "Save to Vulpes" for the current project. For a linked project it saves to the origin (the same path as Ctrl+S). For an unlinked project it opens the Save to Vulpes dialog.
7. The link state of the current project: "Linked to `<key>` in `<dev|prod>`, last saved `<time>`" or "Not linked". The time is the last successful save of this session, and it is not persisted.

The panel reads the stored values again each time it is shown. It keeps no second copy.

### D3. Internal distribution only

The plugin is released on GitHub releases. `min_version` is `5.2.0`, and the task list checks the used APIs on 5.2.0 as well as on 5.2.2. If one is missing on 5.2.0, `min_version` is raised. The bundle stays one unminified file (`dist/vulpes.js`) that calls `Plugin.register`. Store-specific metadata is not needed.

### D4. File menu actions

- `vulpes_open`, name "Open from Vulpes...", category `file`, icon `cloud_download`, `MenuBar.addAction(action, 'file.#open')`. It lands at the end of the `open` group, after `new_window` (Finding 6).
- `vulpes_save_new`, name "Save to Vulpes...", category `file`, icon `cloud_upload`, `MenuBar.addAction(action, 'file.#project')`. It lands at the end of the `project` group, after `close_project` (Finding 6).
- Neither action has a `keybind` option. The keys are set by the designer in the Blockbench keybind settings, which lists them under the category `file`.

### D5. Start screen and File > New

`new ModelLoader('vulpes_model', { icon: 'cloud_download', name: 'Vulpes model', description: ..., show_on_start_screen: true, onStart })` where `onStart` starts the Open from Vulpes flow. The loader appears in File > New and on the start screen (model_loader.ts:44; menu_bar.ts:128-129; start_screen.ts:199, 225).

### D6. Native Ctrl+S through a save codec

The plugin registers `new Codec('vulpes', { name: 'Vulpes', remember: false, compile, write, afterSave, overwrite? })`. Its `compile` returns `Codecs.project.compile()`.

- **Opening**: after the model is parsed, the project has `export_codec = 'vulpes'`, `export_path = 'vulpes://<environment>/<projectId>/<assetId>'` and an empty `save_path`. The display name is passed to `parse` as the path argument, for example `ruby.bbmodel`, so `Project.name` becomes `ruby` (bbmodel.js:455). The `vulpes://` string is never a name.
- **Saving**: Ctrl+S runs `export_over`, which calls `saveTextures()` and then `Codecs.vulpes.write(compile(), export_path)` (io.js:391-393). `write` ignores the file system. It parses the path, takes the base URL and the ETag of `Project.uuid` from plugin memory, and sends the replacement with `If-Match` (the same request as `add-remote-models`). On `200` it stores the new ETag and sets `Project.saved = true` itself, because the default `afterSave` would not (codec.ts:336-350).
- **No ETag**: when the plugin memory has no ETag for the project (for example after a restart), `write` sends nothing and tells the designer to open the model from Vulpes again. The plugin never sends a replacement without an ETag.
- **Conflict**: a `412` opens the conflict dialog (D8). The codec does not write anything in that case.
- **Save As copy**: the copy is a new asset created with `POST`. The project then points to the new asset, as in `add-remote-models`.

No action is clicked or replaced. The only handler the plugin adds to Blockbench is the codec.

Fallback: if task 1.1 shows that `export_over` does not route to `Codecs.vulpes.write` as read here, the click replacement of the current `save-routing.ts` is kept as documented, this design is revised, and the proposal is updated before the code pull request.

### D7. Plugin settings in `general`

Three settings with `plugin: 'vulpes'` and the default category `general`:

- `vulpes_active_environment`, type `select`, options `dev` (Dev) and `prod` (Prod), default `dev`.
- `vulpes_dev_url`, type `text`, default `http://localhost:8085`.
- `vulpes_prod_url`, type `text`, default empty.

They appear in the plugin's Settings tab (plugin_loader.ts:1489, 1750) and in the Preferences dialog under General. No category is created (D1). Unload calls `setting.delete()` for each (settings.ts:181-189).

### D8. Feedback

- Success: `Blockbench.showQuickMessage(tl('vulpes.saved', [key, environment]))`.
- Errors: `Blockbench.showMessageBox({ title, message, icon, buttons: [tl('vulpes.button.ok')] })`. The text comes from the mapping of `add-remote-models`.
- Conflict on `412`: `Blockbench.showMessageBox({ title, message, icon: 'save', commands: { overwrite, load_latest, save_copy }, buttons: ['dialog.cancel'] })`. The commands mirror the save prompt of Blockbench (io.js:401-421). The callback receives the command id. Load latest asks for a second confirmation, because local changes are lost. Save as copy asks for a key.
- Settings validation: the message box names the rule. The value is restored (D9).

### D9. Settings behaviour

- **Validation**: `validateBaseUrl` of `add-environment-settings` decides. An invalid value is rejected with a message and the previous value is restored. Task 1.4 checks that this does not interrupt typing in the plugin tab (Finding 4). If it does, the rule applies to the Preferences dialog only, and the panel shows "invalid URL" and sends nothing.
- **Prod confirmation**: `onChange` of the active environment setting runs `requiresConfirmation(previous, next)`. Each switch to `prod` opens a message box with "Switch to Prod" and "Cancel". Cancel writes the previous value back with `setting.value = previous` and `Settings.saveLocalStorages()`. This does not call `onChange` again, because the value setter does not call it (settings.ts:158-160). The previous value is the last confirmed value that the plugin keeps in memory.
- **Plugin tab select**: the handler is not called from the plugin tab (Finding 3). The confirmation is enforced in the Preferences dialog. If task 1.4 shows that the plugin tab stores `prod` without any confirmation, the active environment select is removed from the plugin tab's path, and the design is revised.

### D10. Translations

All strings go through `tl(key)`. `Language.addTranslations('en', {...})` holds the source strings and `Language.addTranslations('de', {...})` the German ones. A pure test checks that both tables have the same keys. Keys have the prefix `vulpes.`.

### D11. Metadata

`Plugin.register` gets `icon` (a Material icon name, `cloud`), `about` (two or three sentences: what the plugin does, that it is internal, and that it talks to Vulpes), `tags` (`['Vulpes', 'CMS', 'Minecraft']`, three at most), `min_version: '5.2.0'`, and `website`, `repository` and `bug_tracker` set to `https://github.com/OneLiteFeatherNET/vulpes-blockbench`, the issues page and the GitHub repository. The version stays `__PLUGIN_VERSION__`.

### D12. Lifecycle

`onload` registers, in this order: the codec, the settings, the actions, the File menu entries, the model loader, the panel, and the listeners. `onunload` removes them in reverse order:

- `Action.delete()` for `vulpes_open` and `vulpes_save_new` (actions.ts:588) also removes their menu entries.
- `ModelLoader.delete()` (model_loader.ts:62).
- `Panel.delete()` (panels.ts:1090).
- `setting.delete()` for the three settings (settings.ts:181).
- `Codec.delete()` for `vulpes` (codec.ts:365).
- The wrapper of Finding 1, if one is used, is restored.
- The link of every open project with `export_codec === 'vulpes'` is cleared: `export_codec` and `export_path` are reset (Finding 7).

Blockbench's own settings category is not touched, because the plugin no longer creates one.

## Supersedes

The list in `proposal.md` names the requirements. The replacements are the designs of D1 to D12.

## Layout

```
src/ui/panel.ts                      the sidebar panel, the badge, the lists, the link state
src/ui/file-actions.ts               vulpes_open and vulpes_save_new, both with no default keys
src/ui/model-loader.ts               the "Vulpes model" tile
src/ui/save-codec.ts                 the vulpes codec: compile, write, afterSave, the link checks
src/ui/settings.ts                   the three plugin settings, the confirmation, the validation restore
src/ui/feedback.ts                   quick messages, error boxes, the conflict box
src/ui/mount.ts                      onload and onunload, in the order of D12
src/link/vulpes-path.ts              pure: build and parse vulpes://<environment>/<projectId>/<assetId>
src/link/display-name.ts             pure: the name passed to parse, from the model key
src/link/link-state.ts               pure: the link state text and the "no ETag" decision
src/i18n/strings.ts                  pure: the en and de tables
test/link/*.test.ts, test/i18n/*.test.ts   one file per pure module
```

Blockbench globals stay in `src/ui/`. `src/remote/` and `src/environment/` keep their rules.

## Risks / Trade-offs

- **Ctrl+S does not route as read**: the click replacement is the documented fallback (D6). The design is revised before the code pull request.
- **A Save As leaves the link in place**: Finding 1. The spike picks the mechanism before any code is written.
- **Typing in the plugin tab is interrupted**: Finding 4. The fallback is in D9.
- **The panel is a Vue component and its API surface is not verified in detail**: the panel is built against the `component` option, and task 1.5 checks that it renders in `left_bar`.
- **Restart drops the memory**: the ETag is kept in memory, so after a restart a linked project refuses to save until it is opened from Vulpes again (D6). This is intended, and the message says so. Whether the `vulpes://` export path survives a restart is not verified. Task 1.3 checks it.
- **Menu placement is at the end of a group**: Finding 6. The actions are not directly next to `open_from_link` or `save_project_as`. This is accepted.

## Open Questions

- Which mechanism stops a local Save As from keeping the Vulpes link? (Task 1.2.)
- Does `export_over` route to the codec when the codec is registered by a plugin, as read in io.js:384-393? (Task 1.1.)
- Does the plugin tab's Settings select store `prod` without any confirmation? (Task 1.4.)
- Does typing a URL in the plugin tab survive the validation restore? (Task 1.4.)
- Do the used APIs exist in Blockbench 5.2.0, the `min_version`? (Task 1.6.)
- Does `Project.export_path` survive a restart or autosave? (Task 1.3.)
- Does the Vue component of the panel render and update its list in `left_bar`? (Task 1.5.)
