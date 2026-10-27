# Tasks

## 1. Project setup

- [ ] 1.1 Create `package.json` with `"type": "module"`, `"private": true`, `"engines": { "node": ">=22" }` and the scripts `typecheck`, `lint`, `test`, `check` and `build`. Add the devDependencies from `design.md` with exact versions and run `npm install`. Commit `package-lock.json`
- [ ] 1.2 Confirm that `.gitignore` ignores `dist/` and `node_modules/`
- [ ] 1.3 Create `tsconfig.json` with `strict` and the additional options from the spec, `noEmit`, `allowJs: false` and the `include` list `src`, `test` and `vitest.config.ts`

## 2. Plugin skeleton

- [ ] 2.1 Create `src/types/blockbench.d.ts` that declares only `Plugin.register` with the options the plugin uses
- [ ] 2.2 Create `src/plugin.ts` that calls `Plugin.register('vulpes', { title: 'Vulpes', author: 'OneLiteFeather', description, version, variant: 'desktop', onload, onunload })`, with empty `onload` and `onunload` functions

## 3. Pure module with a test

- [ ] 3.1 Write `test/problem.test.ts` for `problemSlugOf` first: a Vulpes type returns its slug, another namespace returns `undefined`, and an empty slug returns `undefined`. Run it and see it fail
- [ ] 3.2 Implement `src/problem.ts` with `problemSlugOf` until the tests pass

## 4. Lint, test runner and bundle

- [ ] 4.1 Create `eslint.config.mjs` with `eslint:recommended`, `strictTypeChecked` and `stylisticTypeChecked` for TypeScript files, and the error rules from the spec. Verify that `npm run lint` passes
- [ ] 4.2 Create `vitest.config.ts` that includes `test/**/*.test.ts` and enables `sequence.shuffle`. Verify that `npm run test` passes
- [ ] 4.3 Create `esbuild.config.mjs` that bundles `src/plugin.ts` to `dist/vulpes.js` as an unminified IIFE without source maps
- [ ] 4.4 Make `npm run build` run `typecheck` before esbuild, and make `npm run check` run `typecheck`, `lint` and `test`

## 5. Verify the chains

- [ ] 5.1 Run `npm run check` and `npm run build` and confirm that both pass. Confirm that `dist/vulpes.js` is one file, is not minified and contains `Plugin.register(`
- [ ] 5.2 Add a temporary `any` and a temporary type error to a source file. Confirm that `npm run check` and `npm run build` fail, then remove both. Do not commit these changes
- [ ] 5.3 Confirm that a Blockbench desktop app loads `dist/vulpes.js` through File > Plugins > Load Plugin from File, if a desktop app is available

## 6. Document and ship

- [ ] 6.1 Update `README.md` with how to install, build, check and load `dist/vulpes.js` in Blockbench
- [ ] 6.2 Run `openspec validate --all --strict` and confirm that it passes
- [ ] 6.3 Commit the code and the ticked tasks as `build: set up strict typescript with esbuild`
- [ ] 6.4 Open the pull request with the title `build: set up strict typescript with esbuild`
