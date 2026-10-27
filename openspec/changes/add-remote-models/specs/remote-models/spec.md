# Spec Delta

## Purpose

Designers open Blockbench models from Vulpes, save them back, and create new models in Vulpes from the Blockbench desktop app. A model opened from Vulpes keeps its remote reference, and no save overwrites a newer version without the designer's choice.

## ADDED Requirements

### Requirement: Open a model from Vulpes
The plugin SHALL offer an "Open from Vulpes" dialog that lists the projects of the signed-in designer, then the models of the chosen project, and opens the chosen model as a Blockbench project. The plugin MUST show models one page at a time.

#### Scenario: Designer opens a model
- **WHEN** the designer chooses a project and then a model in the "Open from Vulpes" dialog
- **THEN** the plugin fetches the model JSON and opens it as a Blockbench project with its textures embedded

#### Scenario: Model list has several pages
- **WHEN** a project has more models than fit on one page
- **THEN** the dialog shows the first page of 50 models and loads the next page when the designer asks for it

#### Scenario: Project no longer exists
- **WHEN** the model list request returns `project-not-found`
- **THEN** the dialog shows that the project no longer exists and keeps the project list open

### Requirement: Save a new model to Vulpes
The plugin SHALL create a new model in Vulpes from the current Blockbench project when the designer picks a project and enters a key. The plugin MUST send the model JSON unchanged, including its embedded textures, and MUST NOT upload textures separately.

#### Scenario: New model is created
- **WHEN** the designer picks a project, enters the key `vulpes:item/ruby` and confirms
- **THEN** the plugin sends the model JSON with that key and, on `201 Created`, links the Blockbench project to the new model and its ETag

#### Scenario: Key is already used
- **WHEN** the backend responds with `key-taken`
- **THEN** the dialog shows that a model with this key already exists, keeps the entered key and creates nothing

#### Scenario: Key is rejected by the backend
- **WHEN** the backend responds with `invalid-key`
- **THEN** the dialog shows the detail from the backend next to the key field

#### Scenario: Empty key
- **WHEN** the designer confirms with an empty key
- **THEN** the plugin does not send a request and asks for a key

### Requirement: Save an opened model back with Ctrl+S
The plugin SHALL save a Blockbench project that is linked to a Vulpes model when the designer uses Ctrl+S or File > Save. The save MUST send `PUT` with the stored ETag in `If-Match`. On success, the plugin MUST replace the stored ETag with the one in the response.

#### Scenario: Save succeeds
- **WHEN** the designer saves a linked project and the backend responds with `200` and a new ETag
- **THEN** the plugin stores the new ETag and reports that the model was saved to Vulpes

#### Scenario: Unlinked project is saved
- **WHEN** the designer saves a project that is not linked to a Vulpes model
- **THEN** the plugin behaves as Blockbench does without this plugin

#### Scenario: Save sends the stored ETag
- **WHEN** the plugin saves a linked project
- **THEN** the request carries the ETag exactly as it was last received, including its quotes

### Requirement: Conflicts never overwrite silently
The plugin SHALL open a conflict dialog when the backend responds with `precondition-failed`. The dialog MUST offer three choices: Overwrite, Load latest and Save as copy. The plugin MUST NOT send a save that overwrites a newer version without one of these choices.

#### Scenario: Designer overwrites
- **WHEN** the designer chooses Overwrite in the conflict dialog
- **THEN** the plugin fetches the current ETag of the model and sends the local JSON with `PUT` using that ETag

#### Scenario: Designer loads the latest version
- **WHEN** the designer chooses Load latest and confirms that local changes are lost
- **THEN** the plugin replaces the content of the project with the current model from Vulpes and stores the current ETag

#### Scenario: Designer cancels Load latest
- **WHEN** the designer chooses Load latest and does not confirm
- **THEN** the local project and the stored ETag stay unchanged

#### Scenario: Designer saves a copy
- **WHEN** the designer chooses Save as copy and enters a new key
- **THEN** the plugin creates a new model with that key, links the project to the new model, and leaves the original model in Vulpes unchanged

#### Scenario: Conflict dialog is dismissed
- **WHEN** the designer closes the conflict dialog without choosing
- **THEN** nothing is sent to Vulpes and the local project stays unchanged

### Requirement: The remote reference is stored with the project
The plugin SHALL store the backend URL, project id, model id, key and last known ETag of a linked model with the Blockbench project. The reference MUST NOT be written into the model JSON that is sent to Vulpes.

#### Scenario: Reference after open
- **WHEN** a model is opened from Vulpes
- **THEN** the project holds the backend URL, the project id, the model id, the key and the ETag from the response

#### Scenario: Reference is not sent to Vulpes
- **WHEN** the plugin saves a linked project
- **THEN** the request body contains no field of the remote reference

### Requirement: Vulpes errors are shown as messages the designer can act on
The plugin SHALL map every problem slug of the Blockbench API to a human readable message. An unknown slug, a non-Problem-Details body or a status without a slug SHALL show the HTTP status and the problem `title` or `detail` when present.

#### Scenario: Known slug
- **WHEN** the backend responds with `model-not-found`
- **THEN** the plugin shows the message for `model-not-found` from the mapping table

#### Scenario: Unknown slug
- **WHEN** the backend responds with a problem slug that the plugin does not know
- **THEN** the plugin shows the HTTP status and the problem `title` or `detail`

#### Scenario: Body is not Problem Details
- **WHEN** the backend responds with an error status and a body that is not Problem Details
- **THEN** the plugin shows the HTTP status and does not show the raw body

#### Scenario: Payload too large
- **WHEN** the backend responds with `payload-too-large`
- **THEN** the plugin shows that the model is larger than 8 MB and nothing is saved

### Requirement: Failed requests keep local work intact
The plugin SHALL keep the local Blockbench project unchanged when a request to Vulpes fails without a response, times out or fails with an error status. The plugin MUST keep the stored ETag unchanged after such a failure.

#### Scenario: Vulpes cannot be reached on save
- **WHEN** a save gets no response from the backend
- **THEN** the plugin reports that Vulpes cannot be reached, keeps the local project and the stored ETag, and lets the designer save again

#### Scenario: Create is lost after the backend stored the model
- **WHEN** a create gets no response and the designer retries with the same key
- **THEN** the dialog shows that the model may already exist and suggests opening it from Vulpes

### Requirement: Local export never contacts Vulpes
The plugin SHALL keep File > Export and Save As to a local file separate from Vulpes. These actions MUST NOT send any request to the backend.

#### Scenario: Designer exports to a file
- **WHEN** the designer exports a linked project to a local file
- **THEN** the plugin writes the file locally and sends no request to Vulpes

### Requirement: Requests use the signed-in designer's token
The plugin SHALL send every request to the Blockbench API through the authorized request function of the `vulpes-login` capability. When the designer is signed out, the plugin MUST ask the designer to sign in and MUST NOT send the request.

#### Scenario: Designer is signed out
- **WHEN** the designer opens the "Open from Vulpes" dialog while signed out
- **THEN** the plugin asks the designer to sign in and sends no request to the backend

#### Scenario: Token is rejected after refresh
- **WHEN** a request is still answered with `unauthorized` after one refresh
- **THEN** the plugin enters the signed-out state and shows the message "Sign in again"
