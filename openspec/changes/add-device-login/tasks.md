# Tasks

## 1. Spike, plugin skeleton and settings

- [ ] 1.0 Spike: verify that `fetch` from the Blockbench desktop renderer to the issuer's discovery document, device authorization endpoint and token endpoint is not blocked by CORS, and that the response bodies can be read. Record the result and the Blockbench origin in the design. If a call is blocked, apply the fallback in `design.md` (Network access from the renderer) before task 2.1
- [ ] 1.1 Complete the plugin registration in `src/plugin.ts`, which `add-build-toolchain` created, with `variant: 'desktop'`, registration and unregistration. Add a unit test that asserts the manifest declares the desktop variant, and verify that it passes
- [ ] 1.2 Add the settings for backend URL, issuer and client id, empty by default. Validate the issuer as `https` or `http://localhost`, and keep sign-in disabled while a setting is invalid. Cover the validation with unit tests and verify that they pass

## 2. Device flow

- [ ] 2.1 Read the endpoints from the issuer's discovery document. Test the parsing and the missing-endpoint error with a fake `fetch`
- [ ] 2.2 Request a device code and parse the response, including `verification_uri_complete` when present. Test it with a fake `fetch`
- [ ] 2.3 Implement the polling state machine for `authorization_pending`, `slow_down`, `access_denied`, `expired_token` and success. Test each transition with an injected clock and no real waiting
- [ ] 2.4 Show the device code dialog with the user code and the verification URI, open the URI in the system browser, and stop polling when the designer cancels or the dialog closes

## 3. Token lifecycle

- [ ] 3.1 Store the tokens through a wrapper around `localStorage` that catches storage errors and treats them as signed out. Test the wrapper with a fake storage
- [ ] 3.2 Refresh the access token within 30 seconds of expiry, store the rotated refresh token, and expose one `authorizedFetch` function for the other capabilities. Retry once after a `401`. Test both paths with a fake `fetch` and clock
- [ ] 3.3 On `invalid_grant`, clear the tokens and enter the signed-out state. On a network error, keep the tokens. Test both outcomes
- [ ] 3.4 Implement sign-out, which clears the tokens and does not call the backend

## 4. Menu and end-to-end check

- [ ] 4.1 Add the "Vulpes" menu with "Sign in" and "Sign out" entries, and show the entry that matches the signed-in state
- [ ] 4.2 Verify the device flow end to end in the Blockbench desktop app against a test client of the identity provider, including refresh after expiry
- [ ] 4.3 Commit the change as `feat(auth): sign in to vulpes with the device flow` and open the pull request with that title
