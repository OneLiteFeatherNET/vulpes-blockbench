# Spec Delta

## Purpose

A model opened from Vulpes keeps a history in Vulpes: every save creates a revision. Designers look at that history in Blockbench, open an earlier revision read-only and restore one. Restoring never discards a revision, it adds a new one.

## ADDED Requirements

### Requirement: Save with a comment
The plugin SHALL offer a "Save to Vulpes with comment" action for a linked model. The action SHALL ask for a comment and save the model with that comment. Ctrl+S and File > Save MUST NOT ask for a comment.

#### Scenario: Designer saves with a comment
- **WHEN** the designer runs "Save to Vulpes with comment" on a linked model and enters `Fixed the hand`
- **THEN** the plugin replaces the asset with the model and sends the field `comment` with the value `Fixed the hand`

#### Scenario: Designer saves without a comment
- **WHEN** the designer presses Ctrl+S on a linked model
- **THEN** the plugin replaces the asset without asking and without sending a `comment` field

#### Scenario: Comment prompt is cancelled
- **WHEN** the designer cancels the comment prompt
- **THEN** the plugin sends nothing to Vulpes

#### Scenario: Model is not linked
- **WHEN** the designer runs "Save to Vulpes with comment" on a model that is not linked
- **THEN** the plugin tells the designer to use "Save to Vulpes" first and sends nothing

### Requirement: List the revisions of a linked model
The plugin SHALL show a "Revisions" section in the Vulpes panel for a linked model. The section SHALL list the revisions newest first with number, creation date, comment and a marker on the current revision. The section MUST load one page at a time and MUST refresh after each successful save and restore.

#### Scenario: Revisions are listed
- **WHEN** the designer selects a linked model
- **THEN** the section shows the first page of revisions, the current revision marked as current

#### Scenario: More revisions exist
- **WHEN** the model has more revisions than one page holds
- **THEN** the section offers "Load more" and appends the next page when the designer asks for it

#### Scenario: Backend has no revisions
- **WHEN** the revision route answers `404` without a problem code
- **THEN** the section shows that revisions are not available on this backend and no error dialog appears

#### Scenario: Model is not linked
- **WHEN** no model is open or the open model is not linked
- **THEN** the section says that revisions need a linked model and shows no list

### Requirement: Open a revision read-only
The plugin SHALL open a chosen revision as a new Blockbench project named `<key> @ r<number>` that is not linked to Vulpes. The opened project MUST NOT carry an export codec, an export path or a save path that points to Vulpes.

#### Scenario: Designer opens revision 3
- **WHEN** the designer chooses "Open" on revision 3 of `vulpes:item/ruby`
- **THEN** the plugin opens the content of that revision as a project named `vulpes:item/ruby @ r3` and tells the designer that it is a read-only snapshot that can be restored from the panel

#### Scenario: Ctrl+S on a snapshot
- **WHEN** the designer saves the opened snapshot with Ctrl+S
- **THEN** the plugin sends nothing to Vulpes

### Requirement: Restore a revision
The plugin SHALL restore a chosen revision of the linked model after the designer confirms. The restore MUST send the held `ETag` of the linked model in `If-Match`. On success the plugin SHALL keep the new `ETag` and ask whether to load the restored content into the open project.

#### Scenario: Designer restores revision 2
- **WHEN** the designer confirms the restore of revision 2
- **THEN** the plugin sends the restore request with `If-Match` set to the held `ETag` and, on `200`, stores the new `ETag` from the response header

#### Scenario: Restored content is loaded
- **WHEN** the designer confirms loading the restored content into the open project and the project has no unsaved changes
- **THEN** the open project shows the restored content and stays linked to the same asset

#### Scenario: Unsaved changes would be lost
- **WHEN** the open project has unsaved changes and the designer is asked to load the restored content
- **THEN** the question states that the unsaved changes will be lost, and the project is kept unchanged when the designer declines

#### Scenario: The model changed in Vulpes
- **WHEN** the restore responds with `412 ASSET_PRECONDITION_FAILED`
- **THEN** the plugin shows the conflict choices of a save: Overwrite repeats the restore with the `ETag` of the `412` response, Load latest and Save as copy behave as for a save

#### Scenario: Restore is declined
- **WHEN** the designer cancels the restore confirmation
- **THEN** the plugin sends nothing to Vulpes

### Requirement: Never send a restore without a valid ETag
The plugin MUST NOT send a restore request whose `If-Match` is missing or not a strong `ETag`.

#### Scenario: Held ETag is invalid
- **WHEN** the held `ETag` of the linked model is not a strong ETag
- **THEN** the plugin sends no restore request and shows the refusal message
