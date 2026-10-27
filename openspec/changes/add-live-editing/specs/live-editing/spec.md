# Spec Delta

## Purpose

Two designers edit one Vulpes model at the same time. The plugin uses Blockbench's native edit sessions for the live editing itself, and Vulpes tells each plugin instance which session is running for a model. Every participant may save, and a save by one participant keeps the others from failing on their next save.

## ADDED Requirements

### Requirement: Start a live session for a linked model
The plugin SHALL offer "Start live session" in a "Live editing" section of the Vulpes panel for a model linked to Vulpes. Starting SHALL start a Blockbench edit session on the linked project with the Blockbench username and SHALL register the session token in Vulpes.

#### Scenario: Designer starts a session
- **WHEN** the designer presses "Start live session" on a linked model and no session is registered for it
- **THEN** the plugin starts the native edit session on that project, registers its token with the signaling host of the active environment, and shows the participant count

#### Scenario: Model is not linked
- **WHEN** the designer presses "Start live session" on a model that is not linked to Vulpes
- **THEN** the plugin tells the designer to use "Save to Vulpes" first and starts nothing

#### Scenario: Another session is already registered
- **WHEN** Vulpes answers the registration with a conflict because another session is active
- **THEN** the plugin ends the native session it just started and shows that a live session is already running for this model

#### Scenario: Signaling host is not configured
- **WHEN** the active environment has no signaling host
- **THEN** the section shows that live editing is not available in this environment and starts nothing

### Requirement: Keep a hosted session registered
While the designer hosts a session, the plugin SHALL refresh its registration in Vulpes every 20 seconds. When the session ends, the plugin SHALL remove the registration.

#### Scenario: Registration is refreshed
- **WHEN** the designer hosts a session for 20 seconds
- **THEN** the plugin sends the registration again with the same token

#### Scenario: Session is left
- **WHEN** the designer leaves or closes the hosted session
- **THEN** the plugin removes the registration with the token of that session

### Requirement: Show a running session and join it
The plugin SHALL show "<host> is editing live" with a "Join" action for a linked model whose session is registered in Vulpes and which this instance does not take part in. The information SHALL come from a read of the registration and from `session` events.

#### Scenario: Designer joins a running session
- **WHEN** the designer presses "Join" on a model with a registered session
- **THEN** the plugin sets the signaling host of the active environment and joins the native session with the registered token

#### Scenario: Joined project is linked to the asset
- **WHEN** the joined project receives the model from the host
- **THEN** the plugin links that project to the same environment, project, asset and key as the host, and holds the current `ETag` of the asset, so Ctrl+S saves it

#### Scenario: Session ends while joining
- **WHEN** the session ends before the model arrives
- **THEN** the plugin shows that the session is no longer available and links nothing

### Requirement: Every participant may save
While a linked model is open, the plugin SHALL listen to the `saved` events of its asset. Each `saved` event SHALL update the held `ETag` of every local project linked to that asset, so a later save of any participant is not refused with `412` because of an earlier save by another participant.

#### Scenario: Save by another participant updates the held ETag
- **WHEN** a `saved` event arrives for an asset linked to a local project and carries an `ETag` the project does not hold
- **THEN** the plugin stores that `ETag` in the link of the project and the next Ctrl+S of the project sends it as `If-Match`

#### Scenario: Save by another participant is announced
- **WHEN** a `saved` event carries an `ETag` that no local project holds
- **THEN** the plugin shows the quick message "Saved by someone else - revision n"

#### Scenario: Own save is not announced
- **WHEN** the `saved` event is for the save made by this project
- **THEN** the plugin updates nothing and shows no message

#### Scenario: Save still conflicts
- **WHEN** a save still returns `412` after the held `ETag` was updated
- **THEN** the existing conflict choices of the save apply

### Requirement: Feature availability
The plugin SHALL show that live editing is not available on this backend when the live-session routes or the `events` stream answer `404` without a problem code, and SHALL keep the rest of the plugin working.

#### Scenario: Older backend
- **WHEN** the plugin reads the registration of a model and the backend answers `404` without a problem code
- **THEN** the section shows "live editing is not available on this backend" and no session is started or joined

### Requirement: Signaling host settings per environment
The plugin SHALL provide a "Dev signaling host" setting, default `localhost`, and a "Prod signaling host" setting, default empty. A host SHALL be a bare host name. An empty or invalid host SHALL disable live editing for that environment. Before a start or join, the plugin SHALL set the signaling host of the active environment on the Blockbench edit session.

#### Scenario: Invalid host is rejected
- **WHEN** the designer enters a value with a scheme, a port or a path as a signaling host
- **THEN** the plugin treats the host as empty and live editing is disabled for that environment

#### Scenario: Host is applied before a start
- **WHEN** the designer starts a session in the Dev environment with the default host
- **THEN** the native edit session connects through `localhost`
