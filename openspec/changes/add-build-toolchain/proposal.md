# Proposal

Ships as `build: set up strict typescript with esbuild`.

`add-device-login` and `add-remote-models` depend on this change. Both are written
against the TypeScript sources, the type checks and the single bundled file that
this change creates.

## Why

The plugin will talk to a backend, parse untrusted JSON and hold tokens. Plain
JavaScript gives no compile-time check for any of that, and a typo in a response
field only shows up when a designer hits it in Blockbench. The product owner
decided that the plugin is written in strict TypeScript, with the checks wired
so that nothing can be merged while a check is loose.

The plugin is loaded by Blockbench as one file. Blockbench's plugin store does not
accept obfuscated code, so the build must produce one readable file and must not
minify it.

## What Changes

- Add TypeScript sources under `src/`, with a `tsconfig.json` that turns on strict
  mode and the additional checks the product owner asked for.
- Bundle `src/plugin.ts` with esbuild into one unminified file, `dist/vulpes.js`.
  esbuild does not type-check, so `npm run build` runs `tsc --noEmit` first and a
  failed type check fails the build.
- Add ESLint with typescript-eslint `strictTypeChecked` and `stylisticTypeChecked`.
  Lint errors for `any`, non-null assertions, unchecked type-suppression comments,
  floating promises, unsafe `any` access and non-exhaustive switches fail the run.
  Warnings also fail it.
- Add `npm run check`, which runs `tsc --noEmit`, ESLint and Vitest.
- Add Vitest with one test that proves the test setup works.
- Add a minimal `src/plugin.ts` that only registers the plugin, and a hand-written
  type declaration for the Blockbench globals that are used.
- Pin every devDependency to an exact version and commit `package-lock.json`.
- Document how to build the plugin and how to load `dist/vulpes.js` in Blockbench.

Not part of this change (non-goals):

- Any Vulpes feature. The plugin only registers itself.
- Minification or obfuscation of the output.
- A release or publishing workflow.

## Capabilities

### New Capabilities

- `build-toolchain`: The strict type checks, lint rules, test runner and the
  bundling of the plugin into one readable file.

### Modified Capabilities

None. This repository has no existing specs.

## Impact

- **Code**: `src/`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`,
  `esbuild.config.mjs`, `package.json`, `package-lock.json`, `README.md`.
- **Tooling**: Node.js 22 or newer is required. Every devDependency is pinned.
- **Blockbench**: none at runtime. The plugin only calls `Plugin.register` in this change.
- **Security**: none. No network access and no storage in this change.
