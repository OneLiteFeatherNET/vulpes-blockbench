# Design

## Context

The plugin is written in TypeScript under `src/`. esbuild bundles it into one
readable file, `dist/vulpes.js`, which Blockbench loads with File > Plugins > Load
Plugin from File. The plugin runs in the Blockbench desktop app (Electron), so the
output runs in a browser-like renderer with `fetch`, but without the plugin being
able to rely on a bundler at runtime.

`add-device-login` and `add-remote-models` build on this toolchain. They receive
network responses, tokens and Blockbench state, so the strictness of the checks is
what keeps those changes honest.

## Goals / Non-Goals

**Goals:**
- Every type error, lint finding and failing test fails `npm run check` and `npm run build`.
- The build output is one file that a reader can read and that Blockbench accepts.
- Logic that does not need Blockbench can be tested with Vitest without Blockbench.
- Every tool version is pinned, so a fresh install reproduces the same checks.

**Non-Goals:**
- Any Vulpes behaviour. `src/plugin.ts` only registers the plugin.
- Minification, obfuscation, source maps and a release pipeline.
- A web build of the plugin.

## Decisions

### Versions
Every devDependency is pinned to an exact version. `package-lock.json` is committed.
Versions were checked with `npm view` on 2026-10-27.

| Package | Version | Reason |
|---|---|---|
| `typescript` | 6.0.3 | Newest 6.x. 7.0.2 is not used: `typescript-eslint` 8.72.1 accepts `typescript` `<6.1.0` only, and 7.x would break the lint setup. |
| `esbuild` | 0.28.2 | Latest. Bundles and does not type-check. |
| `eslint` | 10.13.0 | Latest. Flat config only. |
| `@eslint/js` | 10.0.1 | Latest. Provides `eslint:recommended`. |
| `typescript-eslint` | 8.72.1 | Latest. Provides `strictTypeChecked` and `stylisticTypeChecked`. |
| `vitest` | 5.0.5 | Latest. Engines `^22.12.0 \|\| ^24 \|\| >=26`, which covers the Node 22 floor. |
| `vite` | 8.3.5 | Latest. `vitest` declares it as a required peer (`^6.4 \|\| ^7 \|\| ^8`), so it is pinned here rather than left to npm. |
| `@types/node` | 22.20.5 | Latest 22.x. Matches the minimum Node version of the project. Needed by Vite's type declarations. |

`package.json` sets `"type": "module"`, `"private": true` and `"engines": { "node": ">=22" }`.

### Blockbench types are hand-written
`blockbench-types` 5.2.1 exists, but it is not used. Its runtime dependencies include
`electron` (`^43.4.0`), `vue` and `typescript` `^5.8.3`. Installing it would pull a
desktop application and a second TypeScript into a plugin that needs only a few
globals. It also types far more of the Blockbench API than the plugin uses.

Instead, `src/types/blockbench.d.ts` declares only what the code uses: `Plugin.register`
with the options that are set (`title`, `author`, `description`, `version`, `variant`,
`onload`, `onunload`). Each new global is added together with the code that uses it.

### Strict compiler options
`tsconfig.json` sets `strict: true` and these additional options: `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`,
`useUnknownInCatchVariables`, `verbatimModuleSyntax`, `isolatedModules`,
`noUnusedLocals`, `noUnusedParameters`, `forceConsistentCasingInFileNames` and
`allowJs: false`. `noEmit` is set, because esbuild writes the output. The `include`
list covers `src`, `test` and `vitest.config.ts`.

### Lint rules
`eslint.config.mjs` uses the flat config with `eslint:recommended`,
typescript-eslint `strictTypeChecked` and `stylisticTypeChecked`, applied only to
TypeScript files with type information. These rules are errors on top of the presets:
- `@typescript-eslint/no-explicit-any`
- `@typescript-eslint/no-non-null-assertion`
- `@typescript-eslint/ban-ts-comment`: `ts-ignore` and `ts-nocheck` are banned,
  `ts-expect-error` needs a description.
- `@typescript-eslint/no-floating-promises`
- `@typescript-eslint/no-unsafe-*` (all of them, as in the preset)
- `@typescript-eslint/explicit-function-return-type`: every function declaration and
  arrow function assigned to a named constant declares its return type. This is stricter
  than the exported-functions-only rule that was asked for, and it is kept on purpose.
- `@typescript-eslint/switch-exhaustiveness-check`

The lint command is `eslint . --max-warnings 0`, so a warning fails the run.

### Scripts and the failing chain
- `typecheck`: `tsc --noEmit`
- `lint`: `eslint . --max-warnings 0`
- `test`: `vitest run`
- `check`: `typecheck`, then `lint`, then `test`
- `build`: `typecheck`, then `node esbuild.config.mjs`

esbuild does not type-check, so `build` runs `tsc --noEmit` first. A type error fails
the build before esbuild runs.

### One readable output file
`esbuild.config.mjs` bundles `src/plugin.ts` with these settings: `bundle: true`,
`format: 'iife'`, `platform: 'browser'`, `target: 'es2022'`, `minify: false`,
`sourcemap: false`, `legalComments: 'inline'`, into `dist/vulpes.js`. The IIFE wrapper
keeps the plugin's top-level code out of the global scope, and the file still contains
`Plugin.register(` as written in the source. `dist/` is ignored by git.

### Network responses are unknown until parsed
Every value that comes from outside the program is typed `unknown` when it enters the
code: HTTP response bodies, the parsed JSON of a `.bbmodel`, storage contents and
Blockbench values that the plugin does not control. Such a value becomes a typed
value only through a hand-written type guard or parser that checks each field. A
type assertion (`as`) on JSON or on any external value is not allowed. This rule is
reviewed in code review. Lint does not enforce it, because the assertion rule cannot
tell an external value from an internal one.

### Logic modules take their collaborators as parameters
Logic modules (the API client, the Problem Details mapping, the device flow and the
conflict handling) do not read Blockbench globals. They receive `fetch`, a clock
(`() => number`) and a storage object as parameters. This is how they run under Vitest
without Blockbench. Only the UI layer (`src/plugin.ts` and the dialogs added by later
changes) calls `Plugin`, `Dialog`, `Action`, `MenuBar` or `Codecs`. The rule is
enforced by review until the first logic module exists, when a lint rule for these
globals is added.

### Tests follow F.I.R.S.T.
Tests live under `test/`. Vitest runs with `sequence.shuffle: true`, so a test that
depends on order fails. A test uses an injected clock or fake timers instead of waiting,
a fake `fetch` instead of the network, and its own fixture instead of shared state. Each
test has one behaviour and an assertion with a message that names the behaviour.

## Layout

```
src/plugin.ts              Plugin.register only
src/problem.ts             problemSlugOf, a pure parser for urn:vulpes:problem:<slug>
src/types/blockbench.d.ts  Blockbench globals used by the plugin
test/problem.test.ts       Vitest test for problemSlugOf
tsconfig.json
eslint.config.mjs
vitest.config.ts
esbuild.config.mjs
```

## Risks / Trade-offs

- **Pinned tools fall behind**: a newer release may fix a bug. → Each bump is a separate change that runs `npm run check`.
- **Shuffled test order exposes order dependencies**: a test that passes in one order and fails in another is a bug in the test. Shuffling is enabled on purpose.
- **`@types/node` is available to all source files**: a Node API could be used by mistake. → Accepted for now. The plugin code is reviewed for browser-only APIs.
