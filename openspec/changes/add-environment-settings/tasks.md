# Tasks

## 1. Verify the Blockbench API in the desktop app

- [ ] 1.1 Confirm in the Blockbench desktop app that the native `Setting` entries of the category `vulpes` appear in the settings dialog and that their values survive a restart
- [ ] 1.2 Confirm the `BarMenu` option that sets the top-level label, and that `MenuBar.update()` changes the label after a switch. If the option does not exist, revise `design.md` (Active environment in the menu label) before task 4.1
- [ ] 1.3 Confirm that a `Dialog` button can run the connection test while the dialog stays open. If it cannot, revise `design.md` (Connection test) before task 4.3
- [ ] 1.4 Record the results of 1.1 to 1.3 in the Open Questions of `design.md`

## 2. Pure modules, tests first

- [ ] 2.1 Write tests for `validateBaseUrl`: a trailing slash is removed, an unparseable value, a non-http protocol, a query string, a fragment, `https` for `prod`, and `http` for `prod` on `localhost` and `127.0.0.1`. Run them and see them fail
- [ ] 2.2 Implement `src/environment/validation.ts` and `src/environment/profiles.ts` until the tests pass
- [ ] 2.3 Write tests for `requireBaseUrl` (empty `prod` returns `not-configured`, a configured profile returns its URL) and for `requiresConfirmation` (only `dev` to `prod` asks). Run them and see them fail
- [ ] 2.4 Implement them until the tests pass
- [ ] 2.5 Write tests for `parseSnapshot` with unknown input: a non-object, missing fields, a wrong active id and a non-string URL fall back to the defaults. Run them and see them fail
- [ ] 2.6 Implement `src/environment/snapshot.ts` until the tests pass

## 3. Storage and service

- [ ] 3.1 Write tests for the safe storage wrapper with an in-memory fake: a read returns the stored snapshot, a read that throws returns the defaults, and a write that throws is caught without rethrowing. Run them and see them fail
- [ ] 3.2 Implement `src/environment/storage.ts` and `src/environment/service.ts` (`setActive`, `setBaseUrl`, load on start) until the tests pass. Each test builds its own fake storage
- [ ] 3.3 Write a test that `setBaseUrl` stores the trimmed, validated URL and that an invalid URL changes nothing. Run it and see it fail, then make it pass

## 4. Origin-bound saves and connection test

- [ ] 4.1 Write tests for `resolveSaveTarget`: a reference that matches the active profile is not flagged, a reference that matches the other profile names that profile, and a reference that matches no profile is named as the origin. Run them and see them fail
- [ ] 4.2 Implement `src/environment/resolve-save-target.ts` until the tests pass
- [ ] 4.3 Write tests for `testConnection` with a fake `fetch`: a `2xx` status is `ok`, a `404` is `http-error` with the status, a rejected `fetch` is `network-error`, the request URL is `{baseUrl}/project/?size=1`, and the body is not read. Run them and see them fail
- [ ] 4.4 Implement `src/environment/connection-test.ts` until the tests pass

## 5. Blockbench UI layer

- [ ] 5.1 Add the declarations for `Setting`, `Settings`, `BarMenu`, `MenuBar`, `Action` and `Dialog` to `src/types/blockbench.d.ts`, with only the members the code uses
- [ ] 5.2 Implement `src/ui/native-settings.ts`, which registers the category `vulpes` and the three settings and reads and writes the stored values through the storage interface
- [ ] 5.3 Implement `src/ui/settings-dialog.ts` with the environment selector, the two URL fields, the validation messages, the production confirmation and the "Test connection" button. Verify with the desktop app check in task 1
- [ ] 5.4 Implement `src/ui/vulpes-menu.ts`, which builds the menu with the "Settings..." entry and the label that shows the active environment
- [ ] 5.5 Wire `onload` and `onunload` in `src/plugin.ts`. `onunload` removes the menu and the native settings

## 6. Verify and ship

- [ ] 6.1 Run `npm run check` and confirm that the type check, lint and every Vitest test pass. Record the test count
- [ ] 6.2 Run `npm run build` and confirm that `dist/vulpes.js` is written and contains `Plugin.register(`
- [ ] 6.3 Review every test for F.I.R.S.T.: no timers, no system clock reads, no shared mutable state, and one behaviour per test
- [ ] 6.4 Verify in the Blockbench desktop app: the settings dialog, the native settings category, the label after a switch, the production confirmation, the connection test against the local backend, and the unload
- [ ] 6.5 Commit the code as `feat(settings): switch between dev and prod backends` and open the code pull request with the title `feat(settings): switch between dev and prod backends`
