# vulpes-blockbench

A Blockbench desktop plugin that lets designers open and save `.bbmodel` files
directly from and to Vulpes, the content management system for Minecraft server
content. Designers stay in Blockbench: they sign in once, pick a project and a
model from Vulpes, and save changes back with Ctrl+S.

The plugin targets the Blockbench desktop app (Electron) only. The web version of
Blockbench is not supported, because the plugin relies on the local system browser
for sign-in and on the desktop file system and network stack.

Status: **in design**. The OpenSpec changes under `openspec/changes/` describe the
planned behaviour. The build toolchain is in place, and the plugin only registers
itself so far. The sign-in and model features are not implemented yet.

## Requirements

- Node.js 22 or newer
- Blockbench desktop app (Electron). The web version is not supported.

## Development

```sh
npm install
npm run check   # type check (tsc), lint (ESLint, no warnings) and tests (Vitest)
npm run build   # type check, then bundle to dist/vulpes.js
```

The sources are strict TypeScript under `src/`. esbuild bundles `src/plugin.ts`
into one readable, unminified file, `dist/vulpes.js`. The bundle is not minified and
not obfuscated, because the Blockbench plugin store does not accept obfuscated plugins.

## Load the plugin in Blockbench

1. Run `npm run build`.
2. In Blockbench, open **File > Plugins > Load Plugin from File** and select
   `dist/vulpes.js`.

The plugin is registered as `vulpes`. The planned changes are described in
`openspec/changes/`.
