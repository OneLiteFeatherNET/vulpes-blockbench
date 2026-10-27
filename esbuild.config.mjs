// Bundles the plugin into one readable file for Blockbench. Type checking is
// not done here: `npm run build` runs `tsc --noEmit` before this script.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// The plugin version comes from package.json, so a release bump reaches the bundle.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

await build({
  entryPoints: ['src/plugin.ts'],
  bundle: true,
  outfile: 'dist/vulpes.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: false,
  sourcemap: false,
  legalComments: 'inline',
  define: { __PLUGIN_VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'info',
});
