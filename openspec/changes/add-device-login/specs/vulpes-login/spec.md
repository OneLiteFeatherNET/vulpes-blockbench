# Spec Delta

## Purpose

The Vulpes plugin for Blockbench signs the designer in to Vulpes through the identity provider that Stelaris uses, and keeps the designer signed in until the provider rejects the refresh token.

## ADDED Requirements

### Requirement: Plugin settings identify the backend and the identity provider
The plugin SHALL provide settings for the Vulpes backend URL, the OIDC issuer and the client id. The plugin MUST NOT contain a default value for any of them. The issuer MUST be an `https` URL, or an `http://localhost` URL for local development. Sign-in MUST stay unavailable while a setting is missing or invalid.

#### Scenario: Settings are empty after installation
- **WHEN** the plugin is installed and no settings have been entered
- **THEN** the backend URL, issuer and client id are empty, and "Sign in" is unavailable

#### Scenario: Non-https issuer is rejected
- **WHEN** the designer enters `http://id.example.org` as the issuer
- **THEN** the plugin rejects the value with a message that names the issuer and keeps sign-in unavailable

#### Scenario: Localhost issuer is accepted
- **WHEN** the designer enters `http://localhost:8080` as the issuer and the other settings are valid
- **THEN** the plugin accepts the issuer and enables "Sign in"

### Requirement: Sign-in uses the device authorization grant
The plugin SHALL sign the designer in with the OAuth 2.0 Device Authorization Grant (RFC 8628). The plugin MUST NOT ask for the designer's password, and it MUST NOT open an in-app browser window for the sign-in.

#### Scenario: Designer starts sign-in
- **WHEN** the designer chooses "Sign in" in the "Vulpes" menu
- **THEN** the plugin requests a device code from the device authorization endpoint and shows the user code and the verification URI

#### Scenario: Verification URI opens in the system browser
- **WHEN** the device code dialog is shown
- **THEN** the plugin opens the verification URI, or the complete verification URI when the provider returns one, in the system browser

#### Scenario: Designer approves the request
- **WHEN** the designer approves the request in the browser and the token endpoint returns tokens
- **THEN** the plugin stores the access token and the refresh token, closes the dialog and shows the signed-in state

#### Scenario: Designer denies the request
- **WHEN** the token endpoint returns `access_denied`
- **THEN** the plugin stops polling, closes the dialog and reports that sign-in was denied

#### Scenario: Device code expires
- **WHEN** the token endpoint returns `expired_token`
- **THEN** the plugin stops polling and offers to start the sign-in again

#### Scenario: Provider asks to slow down
- **WHEN** the token endpoint returns `slow_down`
- **THEN** the plugin waits 5 seconds longer before each following poll

#### Scenario: Designer cancels
- **WHEN** the designer closes the device code dialog before the request is approved
- **THEN** the plugin stops polling and stores no tokens

### Requirement: Endpoints are discovered from the issuer
The plugin SHALL read the device authorization endpoint and the token endpoint from the discovery document of the configured issuer. The plugin MUST NOT hard-code any provider URL.

#### Scenario: Discovery succeeds
- **WHEN** the plugin signs in and `<issuer>/.well-known/openid-configuration` returns both endpoints
- **THEN** the plugin uses those endpoints for the device request and the polls

#### Scenario: Discovery lacks an endpoint
- **WHEN** the discovery document does not contain the device authorization endpoint
- **THEN** the plugin reports that the provider does not support sign-in from the plugin and stores no tokens

### Requirement: Access tokens are refreshed silently
The plugin SHALL refresh the access token before it expires and SHALL use the refresh token that the provider returns most recently. The plugin SHALL expose one function that adds the bearer token to a request, so that other code does not read or refresh tokens itself.

#### Scenario: Token expires soon
- **WHEN** a request is made and the access token expires within 30 seconds
- **THEN** the plugin refreshes the access token first and sends the request with the new token

#### Scenario: Provider rotates the refresh token
- **WHEN** a refresh returns a new refresh token
- **THEN** the plugin stores the new refresh token and discards the old one

#### Scenario: Backend rejects the token once
- **WHEN** a request returns `401` with a token that was valid when it was sent
- **THEN** the plugin refreshes the token and retries the request exactly once

### Requirement: Failed refresh leads to the signed-out state
The plugin SHALL enter the signed-out state when the provider rejects the refresh token. It SHALL keep the tokens when the refresh fails only because the network is unavailable.

#### Scenario: Refresh token is rejected
- **WHEN** the token endpoint returns `invalid_grant` for a refresh
- **THEN** the plugin clears the stored tokens, shows "Sign in" in the "Vulpes" menu and asks the designer to sign in before the next Vulpes action

#### Scenario: Network is unavailable during refresh
- **WHEN** the token endpoint cannot be reached during a refresh
- **THEN** the plugin keeps the stored tokens, reports that Vulpes cannot be reached, and tries the refresh again on the next request

### Requirement: Sign-out discards the tokens on this machine
The plugin SHALL discard the access token and the refresh token when the designer chooses "Sign out". The plugin MUST NOT write tokens to project files, exports or logs.

#### Scenario: Designer signs out
- **WHEN** the designer chooses "Sign out" in the "Vulpes" menu
- **THEN** the plugin removes both tokens and shows "Sign in" in the menu

#### Scenario: Tokens never reach an export
- **WHEN** the designer exports a model to a local file
- **THEN** the exported file contains no token or token-derived value

### Requirement: Token storage failures do not break Blockbench
The plugin SHALL treat an unavailable or failing token storage as the signed-out state, and it MUST NOT let the error stop Blockbench from starting or working offline.

#### Scenario: Storage throws on read
- **WHEN** reading the stored tokens throws an error
- **THEN** the plugin treats the designer as signed out and Blockbench continues to start normally
