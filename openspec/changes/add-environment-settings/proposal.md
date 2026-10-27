# Proposal

Ships as `feat(settings): switch between dev and prod backends`.

Depends on `add-build-toolchain`, which provides the strict TypeScript sources, the checks and the bundled `dist/vulpes.js` that this change extends.

`add-remote-models` takes its base URL from this change. That change does not define its own backend setting: every request it sends goes to the base URL of the environment that this change resolves, and every remote project keeps the base URL it was opened from (see `design.md`, Origin-bound saves). This proposal does not edit `add-remote-models`.

It does not depend on `add-device-login`. The profile model leaves a seam for the issuer and client id that the login change adds, but this change adds no login field.

## Why

Designers and developers test against a local Vulpes backend, while artists work against production. Without a visible switch, the plugin points at one backend, and a designer who thinks they are on the local backend saves a model to production, or the other way round. The backend address is currently a value in code or in a local file that nobody sees in Blockbench. The owner asked for a settings menu that switches between Dev and Prod and shows the active environment at all times.

## What Changes

- Add two fixed environment profiles, `dev` and `prod`. Each has an editable backend base URL. `dev` defaults to `http://localhost:8085`, the local backend port. `prod` has no default: production URLs are not hard-coded, and `prod` stays not configured until someone enters its URL.
- Persist the active environment and both base URLs with Blockbench's own settings mechanism, so they survive a restart of Blockbench.
- Add a "Vulpes" menu entry "Settings..." that opens a dialog with the active environment (Dev or Prod), the Dev URL, the Prod URL, and a "Test connection" button. The dialog stays open after the test and shows the result: success, HTTP status, or a network error, which may be a CORS rejection.
- Register the same values in Blockbench's native settings dialog under a "Vulpes" category. Both views read and write the same stored values, so they stay in sync.
- Show the active environment in the "Vulpes" menu label, for example "Vulpes (Prod)", so that nobody saves to production by accident.
- Ask for confirmation once for every switch to `prod`.
- Validate every base URL with pure functions: it must parse and use `http` or `https`, a trailing slash is removed, and `prod` must use `https` unless the host is `localhost` or `127.0.0.1`. An empty `prod` URL is "not configured", and every backend action reports that instead of sending a request.
- Add the pure helper `resolveSaveTarget(reference, activeProfile, profiles)`. It decides which origin a save goes to and whether the save confirmation must name a different environment. Remote saving is not built in this change, so the helper has no caller yet.
- On unload, remove the menu entry and the settings that the plugin registered.

Not part of this change (non-goals):

- Issuer and client id fields, and sign-in. They come with `add-device-login`, which extends the profile type.
- Opening and saving models, which are in `add-remote-models`.
- A status bar entry. The Blockbench API verified for this proposal offers no plugin entry point in the status bar (see `design.md`).
- Blockbench's own settings category removal on unload. The API verified for this proposal has no call for it.
- Any production URL in the plugin code.

## Capabilities

### New Capabilities

- `environment-settings`: The two fixed environment profiles, their base URLs, the persisted active environment, the settings dialog and native settings category, the active-environment label, the production switch confirmation, URL validation, origin-bound saves and unload cleanup.

### Modified Capabilities

None. This repository has no existing specs.

## Impact

- **Code**: `src/environment/` (pure modules: profiles, validation, storage interface, service, `resolveSaveTarget`, connection test) and `src/ui/` (the menu, the settings dialog and the native settings category), plus the registration in `src/plugin.ts` and minimal declarations in `src/types/blockbench.d.ts`.
- **Blockbench**: uses `Setting`, `Settings.addCategory`, `BarMenu`, `MenuBar`, `Action` and `Dialog`. The verified names and their source files are in `design.md`.
- **Backend**: none. The connection test calls `GET {baseUrl}/project/?size=1`, a read that the backend already serves.
- **Security**: the base URLs are not secrets. Production is never the default, and a save never goes to the active environment by accident, because it goes to the origin the project was opened from.

## Capabilities of related changes

- `add-remote-models` will read the origin of a remote project through `resolveSaveTarget` and send its requests to that origin. It will not add a second base URL setting.
- `add-device-login` will add the issuer and client id to the profile type and to its settings, at the seam described in `design.md`.
