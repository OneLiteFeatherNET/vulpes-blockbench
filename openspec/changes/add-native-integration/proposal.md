Ships as `feat(ui): integrate vulpes natively into blockbench`.

# Proposal

Depends on `add-build-toolchain` (strict TypeScript sources and the bundled `dist/vulpes.js`), `add-environment-settings` and `add-remote-models`. Both are implemented and not yet archived. This change replaces parts of their user interface, and the list in "Supersedes" names exactly which requirements it replaces. Those two changes are reconciled when they are archived. This proposal does not edit their specs.

It does not depend on `add-device-login`.

## Why

A designer who installs Vulpes should not notice a foreign plugin. Today the plugin adds its own top-level "Vulpes" menu, its own settings dialog and its own settings category, and it routes Ctrl+S by replacing the click handlers of the save actions. None of this is how Blockbench works. The first desktop test crashed on `Settings.addCategory`, because the category API needs the settings dialog to exist first. The click replacement is fragile: any change to the built-in actions can silently break the routing, and the Animated Java plugin uses the same technique, which the maintainers consider fragile.

## What Changes

- Remove the own top-level "Vulpes" menu.
- Add a sidebar panel "Vulpes" in the left bar, next to the outliner. It shows the environment as a badge (Dev, or Prod in a visually distinct style), a "Test connection" button, a project picker, a searchable and paged list of models (double-click or a button opens one), a refresh action, "Save to Vulpes" for the current project, and the link state of the current project: linked to key K in environment E with the last save time, or not linked.
- Add the File menu action "Open from Vulpes..." (`vulpes_open`) in the `#open` group of the File menu, and "Save to Vulpes..." (`vulpes_save_new`) in the `#project` group. Both are Blockbench actions in category `file`. They have no default keys and can be bound in Blockbench's keybind settings.
- Add a start screen and File > New tile "Vulpes model" (a model loader) that opens the Open from Vulpes flow.
- Route Ctrl+S natively. The plugin registers a save codec `vulpes`. A project opened from or saved to Vulpes is marked with that codec and a `vulpes://` export path, so Blockbench's own "Save Model" action (Ctrl+S) calls the codec. No action click is replaced anymore. File > Save Project and Save Project As stay local saves. A local copy is not linked to Vulpes.
- Move the three settings (active environment, Dev URL, Prod URL) into the existing category `general`, owned by the plugin. They appear in the plugin's own Settings tab. The own settings dialog and the own category are removed.
- Keep the Prod switch confirmation and the URL validation, but run them through the native setting's change handler.
- Report success with a quick message, errors with a message box, and the conflict on a `412` response with a message box whose commands mirror Blockbench's own save prompt (Overwrite, Load latest, Save as copy, Cancel).
- Put every user-facing string through `tl()`, with English as source and German as translation.
- Add the Blockbench metadata: a Material icon, an `about` text, up to three tags, `min_version: '5.2.0'`, and the GitHub repository as `website`, `repository` and `bug_tracker`.
- Remove everything registered in `onload` in `onunload`.

Distribution: internal only. The plugin is released as `vulpes.js` on GitHub releases and installed with File > Plugins > Load Plugin from File. It is not submitted to the official Blockbench plugin store. The single-file format stays: one readable, unminified `dist/vulpes.js` that calls `Plugin.register`.

Not part of this change (non-goals):

- Sign-in, device flow and token storage (`add-device-login`).
- Changes to the request, conflict or error logic of `add-remote-models`. Only the entry points and the save routing change.
- A status bar entry. Blockbench offers no plugin entry point for it (see `design.md`).
- Removing Blockbench's own settings category when the plugin unloads. This is not needed any more, because the settings are plugin settings in `general`.
- Publishing to the official plugin store, and web Blockbench support.

## Capabilities

### New Capabilities

- `native-integration`: the sidebar panel, the File menu and start screen entries, the native Ctrl+S routing through a save codec, the plugin settings in `general`, the confirmations and messages, the translations, the metadata and the lifecycle.

### Modified Capabilities

None. The other two changes are not archived, so their specs are not edited here.

## Supersedes

This change replaces the following requirements of the unarchived changes. The replacement is recorded here and is reconciled into their specs when those changes are archived.

`add-environment-settings`, `specs/environment-settings/spec.md`:

- "Settings dialog from the Vulpes menu": replaced by the plugin settings in `general` and the panel. The own dialog is removed.
- "Native settings category mirrors the stored values": replaced. The settings live in category `general` and are owned by the plugin, not in a category `vulpes`.
- "Connection test without closing the dialog": only the location changes. The test is a panel button, and the result is shown in the panel while the rule "no request for a missing URL" stays.
- "Confirmation for each switch to production": the mechanism changes. The confirmation runs from the native setting's change handler and reverts the value on Cancel. The rule itself stays.
- "Active environment is shown in the menu label": replaced by the environment badge in the panel. The menu label is no longer used.
- "Unload removes the plugin's entries": the category part is no longer needed, because no category is created.

`add-remote-models`, `specs/remote-models/spec.md`:

- "Save an opened model back with Ctrl+S": only the words "or File > Save" are replaced. Ctrl+S (Save Model) saves to Vulpes. File > Save Project and Save Project As do not. The routing mechanism changes from click replacement to the save codec.
- "The remote reference is stored with the project": the storage place changes. The Vulpes ids live in the export path of the project, and the base URL and the ETag live in plugin memory keyed by the project uuid. The reference is no longer a project property.

## Impact

- **Code**: `src/ui/` (new panel, actions, model loader, codec and settings; removed own menu, settings dialog, native category and click wrapping), `src/plugin.ts` (metadata and lifecycle), `src/types/blockbench.d.ts` (declarations for the new members), `src/` pure modules for link state, display name, the vulpes path and the translation table.
- **Blockbench**: uses `Action`, `Keybind`, `MenuBar.addAction`, `ModelLoader`, `Panel`, `Codec`, `Setting`, `Dialog`, `Blockbench.showMessageBox`, `Blockbench.showQuickMessage` and `Language.addTranslations`. The names and source locations are in `design.md`.
- **Backend**: none. The panel uses the endpoints of `add-remote-models`.
- **Compatibility**: `min_version` is `5.2.0`. The APIs were checked in the Blockbench 5.2.2 source. The task list checks them on 5.2.0 too.
- **Risk**: the native Ctrl+S routing is not verified in the desktop app. It is the first task. If it does not route as read in the source, the click-replacement fallback described in `design.md` applies, and this proposal is revised before the code pull request.
