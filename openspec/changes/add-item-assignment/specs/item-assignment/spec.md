# Spec Delta

## Purpose

A designer assigns the Blockbench model of a linked project to an item of the same Vulpes project. The model key is written to the item's `minecraft:item_model` component, and the designer decides before an existing value is replaced.

## ADDED Requirements

### Requirement: Offer the assignment for a linked model
The plugin SHALL offer an "Assign to item" entry in the File menu and in the panel footer while the open project is linked to Vulpes. The plugin MUST NOT offer it for a project that is not linked.

#### Scenario: Linked project shows the entry
- **WHEN** the designer has a project open that is linked to a Vulpes asset
- **THEN** the File menu and the panel footer offer "Assign to item"

#### Scenario: Unlinked project hides the entry
- **WHEN** the designer has a project open that is not linked to Vulpes
- **THEN** the panel footer does not show "Assign to item"

### Requirement: Choose the item from the project of the model
The plugin SHALL list the items of the Vulpes project that the linked model belongs to, and MUST let the designer filter them by name or key. The plugin MUST use the base URL of the link, not the active environment.

#### Scenario: Designer filters the items
- **WHEN** the designer types part of an item name or key in the search field and refreshes the dialog
- **THEN** the item selector lists only the items whose name or key contains the text, ignoring case

#### Scenario: Link points to another environment
- **WHEN** the active environment is Dev and the linked model belongs to Prod
- **THEN** the item list and the assignment go to the Prod base URL of the link

#### Scenario: Project has no items
- **WHEN** the linked project has no items
- **THEN** the plugin shows that the project has no items and opens no dialog

### Requirement: Show the current model of the selected item
The plugin SHALL show the current `minecraft:item_model` value of the selected item when the designer refreshes the dialog. The plugin MUST read it only for that item.

#### Scenario: Item uses a model
- **WHEN** the designer refreshes the dialog with an item whose `minecraft:item_model` is `vulpes:item/old`
- **THEN** the dialog shows `vulpes:item/old` as the current model

#### Scenario: Item has no model
- **WHEN** the designer refreshes the dialog with an item that has no `minecraft:item_model` component
- **THEN** the dialog shows that no model is assigned yet

### Requirement: Write the model key to the item
The plugin SHALL write the key of the linked model to the `minecraft:item_model` component of the chosen item when the designer confirms. The plugin MUST create the component when the item has none, and MUST update the existing component when its value differs.

#### Scenario: Item has no model
- **WHEN** the designer confirms the assignment for an item without `minecraft:item_model`
- **THEN** the plugin creates the component with the model key as its value and reports the assignment with the item name and the key

#### Scenario: Item already uses the model
- **WHEN** the designer confirms the assignment for an item whose `minecraft:item_model` equals the model key
- **THEN** the plugin sends no write and reports that the item already uses the model

#### Scenario: Item uses another model
- **WHEN** the designer confirms the assignment for an item whose `minecraft:item_model` is `vulpes:item/old`
- **THEN** the plugin asks the designer to replace `vulpes:item/old` and writes only after the designer confirms

#### Scenario: Designer declines the replacement
- **WHEN** the designer declines the replacement of another model
- **THEN** the plugin sends no write and the item keeps its value

#### Scenario: Confirmed replacement updates the entry
- **WHEN** the designer confirms the replacement of another model
- **THEN** the plugin updates the existing component by its id with the model key as its value

### Requirement: Report assignment errors
The plugin SHALL show the Vulpes error of a failed assignment with a message for the case. A missing item and a component changed meanwhile MUST have messages of their own.

#### Scenario: Item no longer exists
- **WHEN** the backend answers `404` to the write
- **THEN** the plugin shows that the item no longer exists in Vulpes

#### Scenario: Component changed meanwhile
- **WHEN** the backend answers `409` to the write
- **THEN** the plugin shows that the item changed in Vulpes meanwhile and asks the designer to try again

#### Scenario: Vulpes is unreachable
- **WHEN** no response arrives for a request of the assignment
- **THEN** the plugin shows that Vulpes cannot be reached and leaves the project unchanged
