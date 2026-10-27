# Spec Delta

## Purpose

The Vulpes plugin for Blockbench looks and behaves like part of Blockbench. Its entries sit where designers look for them: the File menu, the start screen, a sidebar panel and the plugin settings. Ctrl+S saves through Blockbench's own save action, and every save goes to the backend the project came from.

## ADDED Requirements

### Requirement: No own top-level menu
The plugin SHALL NOT add a top-level menu to the menu bar. Its actions SHALL appear only in the File menu and in the sidebar panel.

#### Scenario: Plugin loaded
- **WHEN** the plugin is loaded
- **THEN** the menu bar contains no menu with the id `vulpes` and no label that starts with "Vulpes"

### Requirement: Sidebar panel in the left bar
The plugin SHALL add a panel named "Vulpes" in the left bar. The panel SHALL show the active environment as a badge that reads `DEV` or `PROD`. The `PROD` badge SHALL be visually distinct from the `DEV` badge.

#### Scenario: Production is visible
- **WHEN** the active environment is `prod`
- **THEN** the Vulpes panel shows the badge `PROD` in the distinct style

#### Scenario: Development is visible
- **WHEN** the active environment is `dev`
- **THEN** the Vulpes panel shows the badge `DEV`

### Requirement: Panel offers the working actions
The Vulpes panel SHALL offer a "Test connection" button, a project picker for the active environment, a searchable and paged list of the models of the chosen project, a refresh action, and "Save to Vulpes" for the current project. A double-click on a model, or its open button, SHALL open the model through the Open from Vulpes flow.

#### Scenario: Designer opens a model from the panel
- **WHEN** the designer double-clicks a model in the panel list
- **THEN** the model opens as a Blockbench project through the Open from Vulpes flow

#### Scenario: Search narrows the list
- **WHEN** the designer types a search term in the panel
- **THEN** the list shows only the models whose key or file name contains the term, ignoring case

#### Scenario: Connection test in the panel
- **WHEN** the designer presses "Test connection" and the backend answers with a `2xx` status
- **THEN** the panel shows that the connection succeeded, with the status, and no dialog opens

### Requirement: Panel shows the link state of the current project
The Vulpes panel SHALL show the link state of the current project. A linked project SHALL show its key, its environment and the time of its last successful save in this session. A project that is not linked SHALL show that it is not linked.

#### Scenario: Linked project
- **WHEN** the current project was opened from Vulpes key `vulpes:item/ruby` in the `prod` environment and saved once in this session
- **THEN** the panel shows that the project is linked to `vulpes:item/ruby` in `prod`, with the time of that save

#### Scenario: Unlinked project
- **WHEN** the current project was never opened from or saved to Vulpes
- **THEN** the panel shows that the project is not linked

### Requirement: Distribution is internal only
The plugin SHALL be released as one file, `vulpes.js`, on the GitHub releases of the repository. The plugin SHALL NOT be submitted to the official Blockbench plugin store, and the bundle SHALL remain one readable file that calls `Plugin.register`.

#### Scenario: Release artifact
- **WHEN** a release is built
- **THEN** the release contains `vulpes.js` as a single unminified file that calls `Plugin.register`

### Requirement: File menu entries for opening and saving
The plugin SHALL add the action `vulpes_open`, named "Open from Vulpes...", to the File menu at the group `#open`. It SHALL add the action `vulpes_save_new`, named "Save to Vulpes...", to the File menu at the group `#project`. Both actions SHALL have the category `file` and SHALL have no default key.

#### Scenario: Open entry placement
- **WHEN** the File menu is opened
- **THEN** "Open from Vulpes..." appears in the group that holds "Open Model", "Open Model from Link" and "New Window"

#### Scenario: Save new entry placement
- **WHEN** the File menu is opened
- **THEN** "Save to Vulpes..." appears in the group that holds "Save Project" and "Save Project As"

#### Scenario: No default keys
- **WHEN** the plugin is loaded for the first time
- **THEN** neither action has a key, and the designer can set a key for each in the keybind settings under the category `file`

### Requirement: Start screen and File > New tile
The plugin SHALL register a model loader named "Vulpes model" that is shown on the start screen and in File > New. Starting it SHALL open the Open from Vulpes flow.

#### Scenario: Tile on the start screen
- **WHEN** the designer opens the start screen
- **THEN** the start screen shows the tile "Vulpes model"

#### Scenario: Tile starts the flow
- **WHEN** the designer starts the "Vulpes model" tile
- **THEN** the Open from Vulpes flow opens

### Requirement: Ctrl+S saves through the save codec
The plugin SHALL register a save codec named `vulpes` with `remember` set to `false`. A project that is opened from Vulpes or saved to Vulpes SHALL have the export codec `vulpes`, an export path of the form `vulpes://<environment>/<projectId>/<assetId>` and an empty save path. Ctrl+S, which runs Blockbench's own "Save Model" action, SHALL save the project through that codec. The plugin SHALL NOT replace the click handler of any Blockbench action.

#### Scenario: Ctrl+S saves to the origin
- **WHEN** the designer presses Ctrl+S on a project that was opened from Vulpes
- **THEN** the content is sent to the asset of the export path, with the stored ETag in `If-Match`, and the project is marked as saved

#### Scenario: No click is replaced
- **WHEN** the plugin is loaded
- **THEN** the click handlers of the Blockbench actions `export_over` and `save_project` are the ones that Blockbench registered

#### Scenario: Display name is not the path
- **WHEN** a model is opened from Vulpes with the key `vulpes:item/ruby`
- **THEN** the project name is `ruby`, and the `vulpes://` path is not used as a name

### Requirement: A local save ends the Vulpes link
A project that is saved to a local file with File > Save Project or Save Project As SHALL NOT be written to Vulpes by a later Ctrl+S. The local copy SHALL NOT be linked to Vulpes.

#### Scenario: Save Project As of a linked project
- **WHEN** the designer saves a project from Vulpes to a local file with Save Project As and then presses Ctrl+S
- **THEN** no request is sent to Vulpes, and the Ctrl+S writes only the local file

### Requirement: Save without a known ETag is refused
The save codec SHALL NOT send a replacement of a Vulpes asset without an ETag that the plugin holds for the project. When no ETag is held, the codec SHALL send no request and SHALL tell the designer to open the model from Vulpes again.

#### Scenario: Restart before the save
- **WHEN** the designer presses Ctrl+S on a project whose export path is `vulpes://` and the plugin holds no ETag for it
- **THEN** no request is sent, and the designer sees the message to open the model from Vulpes again

### Requirement: Settings in the general category
The plugin SHALL register three settings owned by the plugin, in the category `general`: the active environment (a select with `dev` and `prod`), the Dev URL and the Prod URL. The plugin SHALL NOT create a settings category.

#### Scenario: Plugin settings tab
- **WHEN** the designer opens the plugin's own Settings tab
- **THEN** the tab lists the active environment, the Dev URL and the Prod URL

#### Scenario: No own category
- **WHEN** the plugin is loaded
- **THEN** no settings category with the id `vulpes` exists

### Requirement: Confirmation for each switch to production
The plugin SHALL ask the designer to confirm every switch of the active environment to `prod`. Cancel SHALL restore the previous active environment. Switching to `dev` SHALL NOT ask.

#### Scenario: Cancel keeps the previous environment
- **WHEN** the designer switches the active environment from `dev` to `prod` and cancels the confirmation
- **THEN** the stored active environment is `dev` again and the panel badge reads `DEV`

#### Scenario: Confirmed switch
- **WHEN** the designer switches to `prod` and confirms
- **THEN** the stored active environment is `prod` and the panel badge reads `PROD`

### Requirement: Invalid base URLs are rejected
The plugin SHALL validate every base URL with the rules of `add-environment-settings`. An invalid URL SHALL be rejected with a message that names the rule, and the previous value SHALL be restored.

#### Scenario: Invalid Prod URL
- **WHEN** the designer enters an `http` URL for a host other than `localhost` or `127.0.0.1` as the Prod URL
- **THEN** a message names the rule, and the previous Prod URL is stored again

### Requirement: Feedback uses quick messages, message boxes and the conflict box
A successful save SHALL be reported with `Blockbench.showQuickMessage`. An error SHALL be reported with `Blockbench.showMessageBox`. A `412` response SHALL open a message box with the commands Overwrite, Load latest, Save as copy and Cancel. Cancel SHALL be the default.

#### Scenario: Success is quiet
- **WHEN** a save succeeds
- **THEN** a quick message names the saved model and the environment, and no dialog opens

#### Scenario: Conflict offers four commands
- **WHEN** the backend responds with `412` to a save
- **THEN** a message box offers Overwrite, Load latest, Save as copy and Cancel, and Cancel is the default

### Requirement: Translated strings with English as source
Every string that the designer sees SHALL be passed through `tl()`. The plugin SHALL provide the English strings as the source and the German strings as the translation, and both tables SHALL have the same keys.

#### Scenario: Keys match
- **WHEN** the translation tables are compared
- **THEN** every key of the English table exists in the German table, and the other way round

### Requirement: Metadata for the plugin
The plugin SHALL declare an icon that is a Material icon name, an `about` text, at most three tags, `min_version` `5.2.0`, and the GitHub repository of the plugin as `website`, `repository` and `bug_tracker`.

#### Scenario: Declared metadata
- **WHEN** the plugin registers itself
- **THEN** it declares `min_version` `5.2.0`, at most three tags, and the repository URL as `repository`

### Requirement: Unload removes everything the plugin registered
The plugin SHALL remove, in `onunload`, every action, menu entry, model loader, panel, codec, setting and listener that it registered in `onload`. It SHALL also clear the Vulpes link of every open project whose export codec is `vulpes`.

#### Scenario: Unload and reload
- **WHEN** the plugin is unloaded and loaded again
- **THEN** the File menu, the start screen, the settings and the panel show each entry exactly once

#### Scenario: Open linked project after unload
- **WHEN** the plugin is unloaded while a project is open that was opened from Vulpes
- **THEN** the export codec and the export path of that project are cleared, and Ctrl+S does not write a `vulpes://` path as a file
