# Proposal

Ships as `feat(auth): sign in to vulpes with the device flow`.

## Why

Designers work in the Blockbench desktop app and should not have to leave it to get a model into Vulpes. Every request the plugin makes to Vulpes must carry the designer's identity, and the identity provider that Stelaris already uses owns that identity. The plugin must not see the designer's password, so sign-in runs in the system browser through the OAuth 2.0 Device Authorization Grant (RFC 8628), which is designed for clients that cannot show the provider's login page themselves.

## What Changes

- Add plugin settings for the Vulpes backend URL, the OIDC issuer and the client id. None of them is hard-coded.
- Add a "Vulpes" menu with "Sign in" and "Sign out" entries. The entries reflect the current state.
- Sign in shows a device code dialog with the user code and the verification URI, opens the verification URI in the system browser, and polls the token endpoint until the designer approves, denies or the code expires.
- Keep the access token and the refresh token. Refresh the access token before it expires, and once after a `401` response.
- When a refresh fails, switch to a signed-out state and ask the designer to sign in again. No stale token is used.
- Sign out discards both tokens on this machine.

Not part of this change:

- Backend validation of the bearer token. This is a separate change in Vulpes-Backend.
- Opening and saving models. This is `add-remote-models`, which depends on this change.

## Capabilities

### New Capabilities

- `vulpes-login`: Plugin settings, sign-in with the device flow, token lifecycle and sign-out for the Vulpes backend.

### Modified Capabilities

None. This repository has no existing specs.

## Impact

- **Code**: the first plugin source and manifest of this repository. Both are created by the implementation tasks.
- **Identity provider**: the client must be allowed to use the device flow, and the provider must issue refresh tokens for the scopes the backend requires.
- **Backend**: none in this change. The backend accepts bearer tokens in a separate change.
- **Security**: tokens are kept in browser storage that the local user profile can read. The trade-off is documented in `design.md`.
