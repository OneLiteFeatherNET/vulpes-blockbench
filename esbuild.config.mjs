// Bundles the plugin into one readable file for Blockbench. Type checking is
// not done here: `npm run build` runs `tsc --noEmit` before this script.
import { build } from 'esbuild';

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
  logLevel: 'info',
});
