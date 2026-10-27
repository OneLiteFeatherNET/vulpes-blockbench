# Design

## Context

The plugin talks to one Vulpes backend at a time. Vulpes-Backend runs locally for development on port `8085`, and the production backend runs on a separate host. Until now the backend address was a fixed value in code. This change adds a switch that Blockbench users can see and change, and it keeps saves tied to the backend a project came from.

The plugin is an Electron-only Blockbench plugin (`variant: 'desktop'`). Logic modules receive `fetch` and storage as parameters, so they run under Vitest without Blockbench. Only the UI layer calls Blockbench globals.

## Verified Blockbench API

The names below were checked against the Blockbench source on GitHub (`JannisX11/blockbench`, branch `master`, fetched during this proposal). The UI layer uses these names and no others. Where the source did not show a detail, the design says so and the task list verifies it in the desktop app.

| Need | Verified name | Source |
|---|---|---|
| Native setting | `new Setting(id, data)`, where `data` is `SettingOptions` with `name`, `type`, `value`, `category`, `description`, `options` (for `select`), `condition`, `onChange`, `requires_restart`, `plugin`. A setting is stored in the global `settings[id]` | `js/interface/settings.ts` |
| Read a setting | `Settings.get(id)` or `settings[id].value` | `js/interface/settings.ts` |
| Write a setting | `settings[id].value = v`, then `Settings.saveLocalStorages()`, which writes `master_value` of each setting to the `settings` key of `localStorage` | `js/interface/settings.ts` |
| Native category | `Settings.addCategory(id, { name, open })` | `js/interface/settings.ts` |
| Remove a native setting | `setting.delete()`, an instance method. It removes the entry from `settings` and from `Settings.structure[category].items`. No call removes a category | `js/interface/settings.ts` |
| Top-level menu | `new BarMenu(id, structure, options)`, registered in `MenuBar.menus[id]`. `MenuBar.addMenu(menu, position?)` adds it to the bar | `js/interface/menu_bar.ts` |
| Entry in a menu | `MenuBar.addAction(action, path)`, where `path` is dot-separated and the first segment names the menu, such as `vulpes.settings` | `js/interface/menu_bar.ts` |
| Remove an entry | `MenuBar.removeAction(path)`, and `BarMenu.delete()` for a top-level menu. `MenuBar.update()` redraws the bar | `js/interface/menu_bar.ts` |
| Menu item shape | `CustomMenuItem`: `name`, `id?`, `icon`, `children?`, `click?(context, event)`, `condition?`, `keybind?` | `js/interface/menu.ts` |
| Dialog | `new Dialog(id?, options)` with `title`, `form`, `buttons`, `onConfirm`, `onCancel`, `onButton`, `onOpen`, `onClose`. Methods `show()`, `hide()`, `close(button?, event?)`. Static `Dialog.open` holds the open dialog | `js/interface/dialog.ts` |
| Status bar | **No plugin entry point.** The status bar exposes only `Interface.addSuggestedModifierKey` and `Interface.removeSuggestedModifierKey`, which show modifier-key hints. Its template is fixed | `js/interface/status_bar.ts` |

Not verified from the source, and checked in the desktop app during implementation:
- The exact `BarMenu` option that sets the top-level label. The label change in this design relies on it, so the implementation verifies the option name before it uses it.
- Which form field types the `form` option accepts, and whether an `onButton` handler can keep the dialog open. The design requires the dialog to stay open after "Test connection". If the source does not allow this, the result is shown in a second dialog step instead, and this design is revised.

## Goals / Non-Goals

**Goals:**
- Make the active environment visible in Blockbench at all times, through the menu label.
- Keep `prod` safe by default: no URL, a confirmation for each switch, and a clear "not configured" message.
- Keep the stored values in one place, so the settings dialog and the native settings category show the same data.
- Keep all validation and resolution logic pure, so it is tested without Blockbench.

**Non-Goals:**
- Sign-in fields, device flow and token storage (`add-device-login`).
- Remote model open, save and conflict handling (`add-remote-models`).
- A status bar entry (no verified API).
- Removing the "Vulpes" settings category when the plugin unloads (no verified API).

## Decisions

### Profiles model

There are two fixed profiles, `dev` and `prod`. A profile holds only its id and its base URL:

```
EnvironmentProfile = { id: 'dev' | 'prod', baseUrl: string }
```

The `baseUrl` of `dev` defaults to `http://localhost:8085`. The `baseUrl` of `prod` defaults to the empty string. The stored state is:

```
EnvironmentSnapshot = { active: 'dev' | 'prod', profiles: { dev: string, prod: string } }
```

The active profile defaults to `dev`. The login change adds its own fields to the profile type. This is the seam: the profile is a record that the login change extends, and the storage guard in this change ignores unknown fields only if the login change says so. It is not a list of profiles, so new profiles are not added by users.

### Storage through a small interface

The logic depends on an interface, not on Blockbench:

```
EnvironmentStorage = {
  read(): unknown;      // raw stored value, untrusted
  write(snapshot: EnvironmentSnapshot): void;
}
```

The Blockbench implementation maps these two calls onto the native settings: `read` returns the stored values of the native settings, and `write` sets each `settings[id].value` and then calls `Settings.saveLocalStorages()`. The Blockbench implementation is in the UI layer. The logic receives the interface as a parameter.

Stored values are untrusted, so `read()` returns `unknown` and a type guard `parseSnapshot(unknown)` turns it into a snapshot. Any invalid value falls back to the default for that field. A failing `read` or `write` (a storage exception) is caught in the store, and the state falls back to the defaults. Blockbench keeps running.

### Two views, one source

The native settings dialog and the plugin's own dialog both read and write the same values. The native settings are the stored values: `Setting` entries with the ids `vulpes_active_environment`, `vulpes_dev_url` and `vulpes_prod_url`, in category `vulpes`. The plugin's dialog reads and writes these same settings through the storage interface. A change in either view is visible in the other view the next time it is read. The plugin does not keep a second copy of the values in memory after a write.

Native `select` settings take `options`. The active environment uses a `select` with the options `dev` and `prod`, and the URL fields use `text`.

### Validation rules

`validateBaseUrl(raw, profile)` returns a result, never throws:

1. The raw value is trimmed. An empty value is valid for `dev` (not used) and means "not configured" for `prod`.
2. The value must parse with `new URL(value)`. A value that does not parse is rejected.
3. The protocol must be `http:` or `https:`.
4. A trailing slash on the path is removed, so `http://localhost:8085/` is stored as `http://localhost:8085`. A query string or a fragment is rejected, because the base URL is a prefix for paths.
5. For `prod`, the protocol must be `https:` unless the host is `localhost` or `127.0.0.1`. A `prod` URL that is `http` on any other host is rejected with a message that names the rule.

`validateBaseUrl` returns `{ ok: true, value }` or `{ ok: false, reason }`, and the reason is a fixed code that the UI maps to text.

### Not configured

`requireBaseUrl(profile)` returns the base URL of the active profile, or a `not-configured` result when the URL is empty. Every backend action calls it first. When the result is `not-configured`, the action shows "Production is not configured. Enter the Prod URL in Settings." and sends no request. This applies to the connection test as well.

### Production switch confirmation

`requiresConfirmation(from, to)` returns `true` only when `to` is `prod` and `from` is not `prod`. Each switch to `prod` asks once. The dialog offers "Switch to Prod" and "Cancel". A cancel keeps the previous active profile. Switching from `prod` to `dev` needs no confirmation.

### Active environment in the menu label

The top-level menu is a `BarMenu` with the id `vulpes`. Its label reads `Vulpes (Dev)` or `Vulpes (Prod)`, depending on the active profile. The label changes when the active profile changes, through `MenuBar.update()`. Blockbench has no status bar entry API, so the menu label is the visible indicator.

### Origin-bound saves

A remote project remembers the base URL it was opened from. This change defines the pure helper:

```
resolveSaveTarget(reference: { baseUrl: string }, active: EnvironmentProfile, profiles: readonly EnvironmentProfile[])
  -> { baseUrl: string; isActive: boolean; targetName: 'dev' | 'prod' | undefined }
```

- The save goes to `reference.baseUrl`, never to the active profile's URL.
- `isActive` is `true` when the reference URL equals the active profile's URL.
- `targetName` names the environment whose URL matches the reference, if one matches. When none matches, it is `undefined`, and the confirmation says "the backend the project was opened from".
- The save confirmation names the target environment whenever `isActive` is `false`.

The reference is the `backendUrl` of the remote reference that `add-remote-models` stores with each project. This change defines only the shape `{ baseUrl }` that the helper needs. `add-remote-models` will pass its stored reference to the helper. Remote saving is not built in this change.

### Connection test

`testConnection(baseUrl, fetch)` sends one `GET` to `${baseUrl}/project/?size=1`. `fetch` is a parameter with the type of the global `fetch`. It returns a result:

- `{ kind: 'ok', status }` for a `2xx` response.
- `{ kind: 'http-error', status }` for any other response.
- `{ kind: 'network-error', message }` when `fetch` rejects. A rejection from the browser layer is how a CORS block shows up, and the message says that a CORS block is one possible cause.

The test does not read the response body. It uses only the status, so no response content is trusted. The dialog stays open after the test, and it shows the result as text. A test with an empty or invalid base URL is not sent: the validation result is shown instead.

### Unload

`onunload` removes what the plugin added: the `vulpes` menu through `BarMenu.delete()` (and `MenuBar.update()`), and each native setting through `setting.delete()`. The native category is not removed, because the verified API has no call for it. The category is empty after unload. This is a known limit and is recorded in the proposal.

### Layout

```
src/environment/profiles.ts          profile ids, defaults, requiresConfirmation
src/environment/validation.ts        validateBaseUrl, requireBaseUrl
src/environment/snapshot.ts          parseSnapshot (type guard for unknown storage data)
src/environment/storage.ts           EnvironmentStorage interface and the safe wrapper
src/environment/service.ts           state transitions: setActive, setBaseUrl, read on start
src/environment/resolve-save-target.ts
src/environment/connection-test.ts   testConnection with an injected fetch
src/ui/vulpes-menu.ts                BarMenu, label, Settings... action
src/ui/settings-dialog.ts            Dialog, Test connection, production confirmation
src/ui/native-settings.ts            Setting entries and the vulpes category
src/types/blockbench.d.ts            declarations for the APIs above
src/plugin.ts                        wires the UI layer in onload and removes it in onunload
test/environment/*.test.ts           one file per pure module
```

## Risks / Trade-offs

- **The menu label option is not verified**: the label cannot change. → The desktop check in `tasks.md` verifies the option before the label is built. If the option does not exist, the active environment is shown as the first entry in the menu and in the dialog title, and this design is revised.
- **The dialog cannot keep open after a test**: → The fallback above applies.
- **Native settings and the plugin dialog disagree**: a native setting is changed while the plugin dialog is open. → The dialog reads the stored values again when it is shown, and it does not cache them.
- **The category stays after unload**: → Accepted, and recorded as a known limit.
- **A user types a production URL that is not https**: → Rejected by the validation rule.

## Open Questions

- Which exact `BarMenu` option sets the top-level label? To be verified in the desktop app.
- Can `onButton` keep the dialog open? To be verified in the desktop app.
