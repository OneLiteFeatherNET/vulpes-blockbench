# Spec Delta

## Purpose

The Vulpes plugin for Blockbench lets the designer switch between a Dev and a Prod Vulpes backend. The active environment is always visible, production is never used by accident, and a save goes to the backend that the project was opened from.

## ADDED Requirements

### Requirement: Two fixed environment profiles
The plugin SHALL provide exactly two environment profiles, `dev` and `prod`. Each profile SHALL have an editable backend base URL. The default base URL of `dev` SHALL be `http://localhost:8085`. The plugin MUST NOT contain a default production URL, and the default base URL of `prod` SHALL be empty.

#### Scenario: Fresh install
- **WHEN** the plugin is loaded for the first time with no stored settings
- **THEN** the active environment is `dev`, the Dev base URL is `http://localhost:8085` and the Prod base URL is empty

#### Scenario: No production URL in code
- **WHEN** the plugin source is searched for a production host name
- **THEN** no production URL is found

### Requirement: The active environment survives a restart
The plugin SHALL store the active environment and both base URLs with Blockbench's settings mechanism, so that they are restored after Blockbench restarts.

#### Scenario: Restart keeps the active environment
- **WHEN** the designer switches to `prod` after entering a valid Prod URL, and Blockbench is restarted
- **THEN** the active environment is `prod` and the Prod base URL is the entered value

#### Scenario: Unreadable stored value
- **WHEN** a stored value is missing, is not a string, or is not one of the two profiles
- **THEN** the plugin uses the default for that field and Blockbench keeps starting

#### Scenario: Storage throws
- **WHEN** reading or writing the stored settings throws an error
- **THEN** the plugin falls back to the defaults for the session and Blockbench keeps running

### Requirement: Settings dialog from the Vulpes menu
The plugin SHALL add a "Settings..." entry to the "Vulpes" menu. The entry SHALL open a dialog with a selector for the active environment (Dev or Prod), a field for the Dev URL, a field for the Prod URL and a "Test connection" button.

#### Scenario: Designer opens settings
- **WHEN** the designer chooses "Settings..." in the "Vulpes" menu
- **THEN** the dialog shows the active environment and both base URLs as currently stored

#### Scenario: Designer changes a URL
- **WHEN** the designer enters a valid Dev URL and confirms the dialog
- **THEN** the Dev URL is stored and the next backend action uses it

#### Scenario: Designer enters an invalid URL
- **WHEN** the designer confirms the dialog with a URL that fails validation
- **THEN** the dialog stays open, shows the reason next to the field and stores nothing

### Requirement: Native settings category mirrors the stored values
The plugin SHALL register the active environment and both base URLs as native Blockbench settings in a category named "Vulpes". The native settings and the plugin dialog SHALL read and write the same stored values.

#### Scenario: Change in the native settings dialog
- **WHEN** the designer changes the Dev URL in the native settings dialog
- **THEN** the settings dialog of the plugin shows the new Dev URL the next time it is opened

#### Scenario: Change in the plugin dialog
- **WHEN** the designer changes the active environment in the plugin dialog and confirms
- **THEN** the native setting of the active environment shows the new value

### Requirement: Connection test without closing the dialog
The plugin SHALL test the connection to the base URL of the chosen environment with a `GET` to `{baseUrl}/project/?size=1`. The test SHALL NOT close the settings dialog, and it SHALL show the result as a notification while the dialog stays open.

#### Scenario: Backend answers
- **WHEN** the designer tests a base URL and the backend responds with a `2xx` status
- **THEN** a notification shows that the connection succeeded and the dialog stays open

#### Scenario: Backend answers with an error status
- **WHEN** the designer tests a base URL and the backend responds with a status that is not `2xx`
- **THEN** a notification shows that status and the dialog stays open

#### Scenario: Network error
- **WHEN** the designer tests a base URL and the request fails without a response
- **THEN** a notification shows a network error and names a possible CORS block as one cause, and the dialog stays open

#### Scenario: Test uses no response content
- **WHEN** the test receives a response
- **THEN** the plugin reads only the status and does not parse the body

### Requirement: Base URL validation
The plugin SHALL validate every base URL with pure functions. A valid URL MUST parse, MUST use the `http` or `https` protocol, and MUST NOT contain a query string or a fragment. The plugin SHALL remove a trailing slash from a valid URL. For the `prod` profile the protocol MUST be `https`, except when the host is `localhost` or `127.0.0.1`.

#### Scenario: Trailing slash is removed
- **WHEN** the designer enters `http://localhost:8085/`
- **THEN** the stored base URL is `http://localhost:8085`

#### Scenario: Unparseable URL is rejected
- **WHEN** the designer enters `not a url`
- **THEN** the URL is rejected with the reason that it cannot be parsed

#### Scenario: Other protocols are rejected
- **WHEN** the designer enters `ftp://vulpes.example.org`
- **THEN** the URL is rejected with the reason that the protocol must be `http` or `https`

#### Scenario: Production requires https
- **WHEN** the designer enters `http://vulpes.example.org` as the Prod URL
- **THEN** the URL is rejected with the reason that production must use `https`

#### Scenario: Production localhost may use http
- **WHEN** the designer enters `http://127.0.0.1:8085` as the Prod URL
- **THEN** the URL is accepted

#### Scenario: Query string is rejected
- **WHEN** the designer enters `https://vulpes.example.org/?debug=1`
- **THEN** the URL is rejected with the reason that a base URL must not contain a query string

### Requirement: Production that is not configured blocks backend actions
The plugin SHALL report "not configured" for the `prod` profile when its base URL is empty, and every backend action MUST report that instead of sending a request.

#### Scenario: Designer switches to an unconfigured prod
- **WHEN** the active environment is `prod` and its base URL is empty, and the designer runs a backend action
- **THEN** the plugin shows that production is not configured, asks the designer to enter the Prod URL in Settings, and sends no request

#### Scenario: Connection test on unconfigured prod
- **WHEN** the designer tests the connection of an empty Prod URL
- **THEN** the dialog reports that production is not configured and no request is sent

### Requirement: Confirmation for each switch to production
The plugin SHALL ask the designer to confirm every switch of the active environment to `prod`. A switch from `dev` to `prod` and a switch from `prod` to `dev` are separate switches. Switching to `dev` SHALL NOT ask for confirmation.

#### Scenario: Switch to prod is confirmed
- **WHEN** the designer switches the active environment from `dev` to `prod` and confirms
- **THEN** the active environment is `prod`

#### Scenario: Switch to prod is cancelled
- **WHEN** the designer switches to `prod` and cancels the confirmation
- **THEN** the active environment stays `dev`

#### Scenario: Switch back to dev
- **WHEN** the designer switches the active environment from `prod` to `dev`
- **THEN** the switch happens without a confirmation

### Requirement: Active environment is shown in the menu label
The plugin SHALL show the active environment in the label of the "Vulpes" menu, as `Vulpes (Dev)` or `Vulpes (Prod)`. The label SHALL change when the active environment changes.

#### Scenario: Label shows production
- **WHEN** the active environment is `prod`
- **THEN** the "Vulpes" menu label reads `Vulpes (Prod)`

#### Scenario: Label follows a switch
- **WHEN** the designer switches the active environment from `prod` to `dev`
- **THEN** the "Vulpes" menu label reads `Vulpes (Dev)`

### Requirement: Saves go to the origin of the project
The plugin SHALL send a save of a remote project to the base URL that the project was opened from. A save MUST NOT go to the URL of the active environment when the two differ. When they differ, the save confirmation SHALL name the target environment.

#### Scenario: Save matches the active environment
- **WHEN** a remote project was opened from the URL of the active environment and the designer saves it
- **THEN** the save goes to that URL and the confirmation does not name a different environment

#### Scenario: Active environment changed after opening
- **WHEN** a remote project was opened from the Dev URL, the active environment is now `prod`, and the designer saves the project
- **THEN** the save goes to the Dev URL and the confirmation names `dev` as the target environment

#### Scenario: Origin matches no profile
- **WHEN** a remote project was opened from a URL that is neither profile's URL
- **THEN** the save goes to that URL and the confirmation names it as the backend the project was opened from

### Requirement: Remote references carry the base URL
The plugin SHALL keep the base URL of the backend in each remote reference that `add-remote-models` stores with a project. `add-remote-models` SHALL NOT define a separate backend setting. This requirement is implemented in `add-remote-models`, and this change provides the helper that resolves the target.

#### Scenario: Helper resolves a reference
- **WHEN** `resolveSaveTarget` receives a reference with a base URL and the active profile
- **THEN** it returns the reference base URL as the save target, whether or not it matches the active profile

### Requirement: Unload removes the plugin's entries
The plugin SHALL remove the "Vulpes" menu and the native settings that it registered when Blockbench unloads the plugin.

#### Scenario: Plugin is unloaded
- **WHEN** the plugin is unloaded
- **THEN** the "Vulpes" menu is removed from the menu bar and each native setting that the plugin registered is removed

### Requirement: Seam for the sign-in fields
The environment profile SHALL be a record that the sign-in change can extend with an issuer and a client id. This change SHALL NOT add any sign-in field.

#### Scenario: Profile holds only the base URL
- **WHEN** the environment profile type is read
- **THEN** it holds the profile id and the base URL and no sign-in field
