# Spec Delta

## Purpose

The build toolchain makes the Vulpes plugin for Blockbench a strict TypeScript project. Type errors, lint findings and failing tests stop the build, and the build produces one readable file that Blockbench can load.

## ADDED Requirements

### Requirement: A type error fails the build
The build SHALL type-check the sources with `tsc --noEmit` before esbuild runs. A type error MUST make `npm run build` exit with a failure, and no output file MUST be written in that run.

#### Scenario: Type error stops the build
- **WHEN** a source file contains a type error and `npm run build` is run
- **THEN** the type check reports the error, `npm run build` exits with a non-zero status, and `dist/vulpes.js` is not written

#### Scenario: Clean sources build
- **WHEN** the sources have no type errors and `npm run build` is run
- **THEN** the type check passes and esbuild writes `dist/vulpes.js`

### Requirement: Any type errors fail the type check
The compiler SHALL run with `strict` and the additional checks `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, `verbatimModuleSyntax`, `isolatedModules`, `noUnusedLocals`, `noUnusedParameters`, `forceConsistentCasingInFileNames`, and `allowJs` set to false.

#### Scenario: Indexed access may be undefined
- **WHEN** code reads an array element by index without checking it
- **THEN** the type check reports that the value may be `undefined`

#### Scenario: JavaScript sources are not compiled
- **WHEN** a `.js` file is added under `src/`
- **THEN** the type check does not read it and the build does not include it

### Requirement: Lint rejects loose typing
The lint configuration SHALL report an error for `any`, non-null assertions, `ts-ignore`, `ts-nocheck`, `ts-expect-error` without a description, floating promises, unsafe `any` access, function declarations without a return type, and switch statements that do not cover every union member. A lint warning MUST fail the check.

#### Scenario: Explicit any is rejected
- **WHEN** a source file declares a value with the type `any`
- **THEN** lint reports `@typescript-eslint/no-explicit-any` as an error and `npm run check` exits with a non-zero status

#### Scenario: Non-null assertion is rejected
- **WHEN** a source file uses the `!` postfix operator on a value
- **THEN** lint reports `@typescript-eslint/no-non-null-assertion` as an error

#### Scenario: Unexplained suppression is rejected
- **WHEN** a source file contains a `// @ts-ignore` comment or a `// @ts-expect-error` comment without a description
- **THEN** lint reports `@typescript-eslint/ban-ts-comment` as an error

#### Scenario: Lint warning fails the check
- **WHEN** lint reports only warnings and `npm run check` is run
- **THEN** `npm run check` exits with a non-zero status

### Requirement: The check runs type check, lint and tests
The project SHALL provide `npm run check`, which runs `tsc --noEmit`, ESLint and Vitest, and fails when any of them fails.

#### Scenario: Failing test fails the check
- **WHEN** a Vitest test fails and `npm run check` is run
- **THEN** `npm run check` exits with a non-zero status

#### Scenario: Passing check
- **WHEN** the type check, lint and every test pass
- **THEN** `npm run check` exits with a zero status

### Requirement: Tests run in random order
Vitest SHALL run the tests in shuffled order, so that a test depending on the order of other tests fails.

#### Scenario: Order dependency is detected
- **WHEN** a test relies on the state left by another test and the tests run shuffled
- **THEN** the test fails in at least one run

### Requirement: The build produces one readable plugin file
The build SHALL bundle `src/plugin.ts` with esbuild into one file, `dist/vulpes.js`. The file MUST NOT be minified and MUST NOT be obfuscated, and it MUST contain the `Plugin.register` call.

#### Scenario: Output is a single file
- **WHEN** `npm run build` succeeds
- **THEN** `dist/vulpes.js` is the only file written to `dist/`

#### Scenario: Output is readable
- **WHEN** `dist/vulpes.js` is opened
- **THEN** it has several lines, keeps the identifiers of the source, and contains the text `Plugin.register(`

#### Scenario: Output has no source map
- **WHEN** `npm run build` succeeds
- **THEN** no `.map` file is written

### Requirement: The plugin registers itself as a desktop plugin
The entry file SHALL call `Plugin.register` with the id `vulpes`, the title `Vulpes`, the author `OneLiteFeather` and the variant `desktop`, and it SHALL provide `onload` and `onunload` functions.

#### Scenario: Registration on load
- **WHEN** Blockbench loads `dist/vulpes.js`
- **THEN** the plugin is registered with the id `vulpes` and the variant `desktop`

### Requirement: Network responses are unknown until parsed
Values that come from outside the program, including HTTP response bodies, parsed JSON and stored data, SHALL be typed `unknown` until a type guard or parser checks them. Code MUST NOT use a type assertion on such a value.

#### Scenario: Parsed JSON is not used as a typed value
- **WHEN** the result of `JSON.parse` is assigned to a typed variable without a type guard
- **THEN** the type check reports an error

### Requirement: Dependencies are pinned
Every devDependency in `package.json` SHALL use an exact version without `^` or `~`, and `package-lock.json` SHALL be committed.

#### Scenario: Exact versions
- **WHEN** `package.json` is read
- **THEN** each devDependency version is an exact semantic version

#### Scenario: Lock file is present
- **WHEN** the repository is cloned
- **THEN** `package-lock.json` is present at the root

### Requirement: The project is an ES module with a Node floor
The `package.json` SHALL set `"type": "module"`, `"private": true` and `"engines": { "node": ">=22" }`.

#### Scenario: Package metadata
- **WHEN** `package.json` is read
- **THEN** it declares an ES module, a private package and a Node engine of 22 or newer

### Requirement: The Problem Details slug parser
The project SHALL provide `problemSlugOf(type)`, which returns the slug of a `urn:vulpes:problem:<slug>` type and returns `undefined` for any other value.

#### Scenario: Vulpes problem type
- **WHEN** `problemSlugOf` receives `urn:vulpes:problem:key-taken`
- **THEN** it returns `key-taken`

#### Scenario: Other namespace
- **WHEN** `problemSlugOf` receives a type that does not start with `urn:vulpes:problem:`
- **THEN** it returns `undefined`

#### Scenario: Empty slug
- **WHEN** `problemSlugOf` receives `urn:vulpes:problem:`
- **THEN** it returns `undefined`
