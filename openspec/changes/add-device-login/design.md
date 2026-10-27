# Design

## Context

The plugin runs inside the Blockbench desktop app, which is an Electron application. It is a strict TypeScript plugin, bundled by esbuild into one plugin file that calls `Plugin.register`, with `variant: 'desktop'` in its registration. The build is set up by `add-build-toolchain`. The web version of Blockbench is out of scope.

Vulpes-Backend validates bearer tokens from the identity provider that Stelaris uses. The plugin therefore needs a token from that provider, and it needs one without handling the designer's password. The OAuth 2.0 Device Authorization Grant (RFC 8628) fits this: the plugin asks for a device code, shows the designer a short user code, and polls while the designer approves the request in the system browser.

**Deferred.** This change waits for the shared backend auth change, which is one change across Vulpes-Backend and the Stelaris OIDC setup. Until it exists, the backend accepts requests without a token, and the plugin works without sign-in in development.

## Goals / Non-Goals

**Goals:**
- Sign in and sign out from the Blockbench desktop app.
- Keep the designer signed in across Blockbench restarts, until the refresh token is rejected.
- Give the `remote-models` capability one function that attaches a valid bearer token to a request, so that no other code handles tokens.

**Non-Goals:**
- Backend token validation, roles or per-project authorization.
- Token revocation on sign out. It is only added if the provider advertises a revocation endpoint, and not in this change.
- Support for the web version of Blockbench, or for browsers outside Electron.

## Decisions

### Device flow with endpoint discovery
The plugin reads `<issuer>/.well-known/openid-configuration` to find the device authorization endpoint and the token endpoint. Discovery keeps the issuer as the only identity setting. If the provider does not publish discovery metadata, the endpoints become settings. This is an assumption to confirm with the provider owner.

The plugin requests the scopes `openid offline_access` plus any scope the backend needs. `offline_access` is required for a refresh token. The backend scope is open and listed in Open Questions.

### Second public client
The plugin is a public client registered next to Stelaris. It must be allowed to use the device flow, and it must receive a token for the same backend audience as Stelaris, because the backend validates one audience. Both points are set in the identity provider, and the shared backend auth change defines them.

### Network access from the renderer
The plugin calls the identity provider with `fetch` from the Blockbench renderer. The spike in task 1.0 checks that these calls are not blocked by CORS and that the response bodies can be read.

Using Node modules through `requireNativeModule` instead of `fetch` is rejected. Designers would have to accept a permission prompt for the plugin, and calls outside `fetch` cannot be tested with the fake `fetch` that the flow modules use.

If CORS blocks a call, the fix is on the identity provider side, not in the plugin. The provider's client must allow the Blockbench origin, which the spike records, for the discovery, device authorization and token endpoints. This is an identity provider configuration change, tracked outside this repository. This follows the rule of `add-remote-models` (Network access), which applies it to the Vulpes backend.

### Settings are validated, not defaulted
The three settings start empty. The plugin rejects an issuer that is not an `https` URL, except `http://localhost` for local development. Sign in is disabled until all three settings are valid. A value that is never stored in the plugin code is never logged.

### Opening the verification URI
The verification URI opens in the system browser. An Electron window inside Blockbench would be a second browser context with its own cookies, so it is not used. The exact desktop call is verified during implementation.

### Polling follows RFC 8628
The poll interval comes from the device authorization response. The plugin waits at least that long between polls and adds 5 seconds after each `slow_down` response. It handles these token endpoint errors:
- `authorization_pending`: keep polling.
- `slow_down`: increase the interval.
- `access_denied`: stop, and show "sign-in was denied".
- `expired_token`: stop, and offer to start over.

Polling stops when the user code expires, when the designer cancels, or when the dialog closes. Timers and the clock are injected, so tests run without waiting.

### Token storage trade-off
Tokens are stored in `localStorage`, which the Blockbench profile holds on the local disk. Anything that runs as the same local user can read them, including other Blockbench plugins. Electron `safeStorage` (backed by the OS keychain) would be stronger, but it needs the main process, and the plugin API does not give direct access to it. For v1 the plugin accepts this risk, and the mitigations are:
- The access token is short-lived. The refresh token is replaced whenever the provider rotates it.
- Tokens are never written to project files, exports or logs.
- Every storage read and write is wrapped in `try/catch`. If storage is unavailable, the designer is signed out.

Moving the tokens to `safeStorage` is a possible follow-up. It is not part of this change.

### Refresh and signed-out state
Before a request, the plugin refreshes the access token if it expires within 30 seconds. If a request returns `401`, the plugin refreshes once and retries once. If the refresh fails with `invalid_grant`, or with any other error that means the refresh token is no longer valid, the plugin clears the tokens and enters the signed-out state. The menu then shows "Sign in", and remote actions ask the designer to sign in first.

A network error during refresh does not sign the designer out. The tokens stay, and the next request tries again.

## Risks / Trade-offs

- **The provider does not allow the device flow for this client**: sign-in cannot start. → Confirm with the provider owner before implementation. The spec does not change.
- **Blockbench closes during polling**: the device code is lost. → Sign-in starts again. This is acceptable, because the code is short-lived.
- **Local tokens can be read by the local user**: → Accepted for v1, documented above.

## Open Questions

- Which scopes does the backend require? The shared backend auth change defines them.
- Which audience does the backend validate for Stelaris and for the plugin? It must be the same audience.
- Does the provider publish discovery metadata? If not, endpoints become settings.
