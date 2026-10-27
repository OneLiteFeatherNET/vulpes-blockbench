# Spec Delta

## Purpose

Designers open Blockbench models from Vulpes, save them back, and create new models in Vulpes from the Blockbench desktop app. A model opened from Vulpes is a Vulpes project asset of kind `BBMODEL`. It keeps its remote reference, and no save overwrites a newer version without the designer's choice.

## ADDED Requirements

### Requirement: Open a model from Vulpes
The plugin SHALL offer an "Open from Vulpes" dialog that lists the projects of the backend, then the `BBMODEL` assets of the chosen project, and opens the chosen model as a Blockbench project. The plugin MUST show models one page at a time.

#### Scenario: Designer opens a model
- **WHEN** the designer chooses a project and then a model in the "Open from Vulpes" dialog
- **THEN** the plugin reads the content of the asset and opens its JSON as a Blockbench project with its textures embedded

#### Scenario: Model list has several pages
- **WHEN** a project has more models than fit on one page
- **THEN** the dialog shows the first page of 50 models and loads the next page when the designer asks for it

#### Scenario: Project no longer listed
- **WHEN** the chosen project is no longer in the project list
- **THEN** the dialog shows that the project no longer exists and keeps the project list open

### Requirement: Save a new model to Vulpes
The plugin SHALL create a new `BBMODEL` asset in Vulpes from the current Blockbench project when the designer picks a project and enters a key. The plugin MUST send the model JSON unchanged, including its embedded textures, in one multipart request, and MUST NOT upload textures separately.

#### Scenario: New model is created
- **WHEN** the designer picks a project, enters the key `vulpes:item/ruby` and confirms
- **THEN** the plugin sends a multipart request with the field `key` set to `vulpes:item/ruby` and the field `file` holding the model JSON under a file name ending in `.bbmodel`, and on `201 Created` links the Blockbench project to the asset `id` and the `ETag` from the response

#### Scenario: Project no longer exists on save
- **WHEN** the create responds with `PROJECT_NOT_FOUND`
- **THEN** the dialog shows that the project no longer exists and keeps the entered key

#### Scenario: Key is already used
- **WHEN** the backend responds with `RESOURCE_CONFLICT`
- **THEN** the dialog shows that a model or texture with this key already exists, keeps the entered key and links nothing

#### Scenario: Key is rejected by the backend
- **WHEN** the backend responds with `VALIDATION_FAILED` and a violation with code `ASSET_KEY_INVALID` on field `key`
- **THEN** the dialog shows the violation message from the backend next to the key field

#### Scenario: Empty key
- **WHEN** the designer confirms with an empty key
- **THEN** the plugin does not send a request and asks for a key

### Requirement: Save an opened model back with Ctrl+S
The plugin SHALL save a Blockbench project that is linked to a Vulpes asset when the designer uses Ctrl+S or File > Save. The save MUST send the new content to the content endpoint of that asset with the stored ETag in `If-Match`. On success, the plugin MUST replace the stored ETag with the `ETag` of the response.

#### Scenario: Save succeeds
- **WHEN** the designer saves a linked project and the backend responds with `200` and a new `ETag`
- **THEN** the plugin stores the new ETag and reports that the model was saved to Vulpes

#### Scenario: Unlinked project is saved
- **WHEN** the designer saves a project that is not linked to a Vulpes asset
- **THEN** the plugin behaves as Blockbench does without this plugin

#### Scenario: Save sends the stored ETag
- **WHEN** the plugin saves a linked project
- **THEN** the `If-Match` header carries the ETag exactly as it was last received, including its quotes

#### Scenario: Replacement without an ETag is refused
- **WHEN** the plugin is asked to save a linked project that has no stored ETag
- **THEN** the plugin sends no request and reports that the project must be opened from Vulpes again

### Requirement: Conflicts never overwrite silently
The plugin SHALL open a conflict dialog when the backend responds with `ASSET_PRECONDITION_FAILED` (HTTP `412`). The dialog MUST offer three choices: Overwrite, Load latest and Save as copy. The plugin MUST NOT send a save that overwrites a newer version without one of these choices.

#### Scenario: Designer overwrites
- **WHEN** the designer chooses Overwrite in the conflict dialog
- **THEN** the plugin sends the local JSON with `If-Match` set to the `ETag` header of the `412` response, exactly as received, and sends no `GET` before it

#### Scenario: Overwrite meets a newer version again
- **WHEN** the designer chooses Overwrite and the replacement responds with `412`
- **THEN** the plugin opens the conflict dialog again with the new `ETag`, and sends nothing else

#### Scenario: Designer loads the latest version
- **WHEN** the designer chooses Load latest and confirms that local changes are lost
- **THEN** the plugin replaces the content of the project with the current content of the asset and stores the `ETag` of that response

#### Scenario: Designer cancels Load latest
- **WHEN** the designer chooses Load latest and does not confirm
- **THEN** the local project and the stored ETag stay unchanged

#### Scenario: Designer saves a copy
- **WHEN** the designer chooses Save as copy and enters a new key
- **THEN** the plugin creates a new asset with that key, links the project to the new asset, and leaves the original asset in Vulpes unchanged

#### Scenario: Conflict dialog is dismissed
- **WHEN** the designer closes the conflict dialog without choosing
- **THEN** nothing is sent to Vulpes and the local project stays unchanged

### Requirement: The remote reference is stored with the project
The plugin SHALL store the backend URL, project id, asset id, key and last known ETag of a linked model with the Blockbench project. The reference MUST NOT be written into the model JSON that is sent to Vulpes.

#### Scenario: Reference after open
- **WHEN** a model is opened from Vulpes
- **THEN** the project holds the backend URL, the project id, the asset id, the key and the ETag from the response

#### Scenario: Reference is not sent to Vulpes
- **WHEN** the plugin saves a linked project
- **THEN** the request body contains no field of the remote reference

### Requirement: Vulpes errors are shown as messages the designer can act on
The plugin SHALL choose the message for an error response by its problem `code`, and by the `field` and `code` of each violation, never by the URL in `type`. An unknown `code`, a status without a code, or a body that is not Problem Details SHALL show the HTTP status and the problem `title` or `detail` when present.

#### Scenario: Known code
- **WHEN** the backend responds with `RESOURCE_NOT_FOUND`
- **THEN** the plugin shows the message for `RESOURCE_NOT_FOUND` from the mapping table

#### Scenario: Unknown code
- **WHEN** the backend responds with a problem `code` that the plugin does not know
- **THEN** the plugin shows the HTTP status and the problem `title` or `detail`

#### Scenario: Body is not Problem Details
- **WHEN** the backend responds with an error status and a body that is not Problem Details
- **THEN** the plugin shows the HTTP status and does not show the raw body

#### Scenario: Model too large
- **WHEN** the backend responds with HTTP `413`
- **THEN** the plugin shows that the model is larger than 8 MB and nothing is saved

### Requirement: Failed requests keep local work intact
The plugin SHALL keep the local Blockbench project unchanged when a request to Vulpes fails without a response, times out or fails with an error status. The plugin MUST keep the stored ETag unchanged after such a failure.

#### Scenario: Vulpes cannot be reached on save
- **WHEN** a save gets no response from the backend
- **THEN** the plugin reports that Vulpes cannot be reached, keeps the local project and the stored ETag, and lets the designer save again

#### Scenario: Create is lost after the backend stored the model
- **WHEN** a create gets no response and the designer retries with the same key, and the retry responds with `RESOURCE_CONFLICT`
- **THEN** the dialog shows that the model may already exist and suggests opening it from Vulpes

### Requirement: Local export never contacts Vulpes
The plugin SHALL keep File > Export and Save As to a local file separate from Vulpes. These actions MUST NOT send any request to the backend.

#### Scenario: Designer exports to a file
- **WHEN** the designer exports a linked project to a local file
- **THEN** the plugin writes the file locally and sends no request to Vulpes

### Requirement: Requests carry a token only when a token provider exists
The plugin SHALL send every request to the Vulpes API through one request function. When a token provider is configured, the function MUST add `Authorization: Bearer <token>` to the request. When no token provider is configured, the function MUST send the request without an `Authorization` header.

#### Scenario: No token provider
- **WHEN** the plugin sends a request and no token provider is configured
- **THEN** the request has no `Authorization` header and is sent anyway

#### Scenario: Token provider present
- **WHEN** the plugin sends a request and a token provider returns a token
- **THEN** the request carries `Authorization: Bearer` with that token

#### Scenario: Backend answers unauthorized
- **WHEN** the backend responds with HTTP `401`
- **THEN** the plugin shows "Sign in again" and changes nothing locally
