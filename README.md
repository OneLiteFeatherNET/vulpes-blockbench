# vulpes-blockbench

A Blockbench desktop plugin that lets designers open and save `.bbmodel` files
directly from and to Vulpes, the content management system for Minecraft server
content. Designers stay in Blockbench: they pick a project and a model from Vulpes,
and save changes back with Ctrl+S.

The plugin targets the Blockbench desktop app (Electron) only. The web version of
Blockbench is not supported.

Status: **implemented, desktop verification pending**. The features below are in
the code and covered by unit tests. The end-to-end check in the Blockbench desktop
app is still open (see Limitations). The planned changes are described in
`openspec/changes/`.

## Features

- **Open from Vulpes**: choose a project, then a model. The model opens as a normal
  Blockbench project. Models are listed 50 at a time, with "Load more".
- **Save new model to Vulpes**: choose a project and enter a key such as
  `vulpes:item/ruby`. The model is created as a Vulpes asset.
- **Ctrl+S / File > Save** on a model from Vulpes saves it back to Vulpes.
- **Conflict handling**: if the model changed in Vulpes since you opened it, the
  plugin asks what to do. Nothing is overwritten silently.
- **Local files stay local**: File > Save As and File > Export write files only and
  never contact Vulpes.

## How to use

1. Set the Vulpes URLs in **Vulpes > Settings...** (see Settings below).
2. Open a model with **Vulpes > Open from Vulpes...**, choose the project and the model.
3. Edit the model and press **Ctrl+S** to save it back to Vulpes.
4. For a new model, choose **Vulpes > Save new model to Vulpes...**, pick a project,
   and enter a key. The key is the Minecraft resource location, for example
   `vulpes:item/ruby`. The file is named `ruby.bbmodel` in Vulpes.

When Vulpes has a newer version of the model, a dialog offers three choices:

- **Overwrite** replaces the newer version with your local model.
- **Load latest** replaces your local model with the newer version, after a
  confirmation. Local changes are lost.
- **Save as copy** keeps both. It asks for a new key and creates a copy in Vulpes.
  The original model is not changed.

If Vulpes cannot be reached, your local model stays open and unchanged. Press Ctrl+S
again when the connection is back.

## Settings

The plugin has two environments, **Dev** and **Prod**. Set them in
**Vulpes > Settings...**; the same values appear in Blockbench's settings under
the category Vulpes:

- **Active environment** decides where **Open from Vulpes** and **Save new model**
  go. A switch to Prod asks for confirmation.
- **Dev URL** defaults to `http://localhost:8085`.
- **Prod URL** has no default. Enter it yourself. It must use `https://`, except for
  `localhost` and `127.0.0.1`. An unconfigured environment is refused with a notice.

A model saved to Vulpes always goes back to the server it was opened from, even when
the active environment is different. The notice after the save says so.

## Requirements

- Node.js 22 or newer
- Blockbench desktop app (Electron). The web version is not supported.

## Limitations

- **No sign-in yet.** Requests are sent without a token. The backend has no
  authentication yet, so any client that can reach it can read and overwrite models.
  The token seam in the client is ready for sign-in (`add-device-login`).
- **CORS.** The backend allows only `localhost` and `127.0.0.1` origins. A backend
  that is reached from another origin must allow the Blockbench renderer origin for
  the headers `Authorization` and `If-Match`, and expose `ETag`.
- **The link is not saved in the .bbmodel file.** The connection to Vulpes lives in
  the open project. A file saved with Save As or Export, or a model opened from a
  file, is not linked to Vulpes. Open the model from Vulpes again to link it.
- **Size limit.** A model larger than 8 MB is rejected by the backend. Reduce the
  embedded textures.
- **No offline queue.** A failed save is retried by pressing Ctrl+S again.
- **Not verified in the desktop app yet.** The unit tests cover the logic. The
  behaviour of Ctrl+S routing, project restore and the dialogs needs a manual check
  in the Blockbench desktop app against a running backend.

## Install

1. Download `vulpes.js` from the [latest release](https://github.com/OneLiteFeatherNET/vulpes-blockbench/releases/latest).
2. In Blockbench, open **File > Plugins > Load Plugin from File** and select the downloaded file.

To run a local build instead, see [Load the plugin in Blockbench](#load-the-plugin-in-blockbench).

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

## Contributing

- Commits and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org),
  for example `feat(settings): ...` or `fix: ...`. Pull requests are squash-merged, so the
  title becomes the commit on `main`. Release Please reads these types to pick the next version
  and write the changelog.
- Behaviour changes start with an OpenSpec proposal under `openspec/changes/`, merged in its own
  pull request before the implementation.
- Run `npm run check` before you push.

## License

Apache-2.0. See [LICENSE](LICENSE).
