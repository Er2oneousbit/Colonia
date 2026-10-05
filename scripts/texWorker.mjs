/**
 * texWorker.mjs - bundle the paint pool's worker (src/render3d/paint/worker.js)
 * ----------------------------------------------------------------------------
 * Used by build.mjs (the game and the lab inline the code as a string and
 * start it as Blob workers) and by the tests. Returns the code and its
 * version: a short hash of the code itself, which holds every line that
 * paints a texture (the recipes, the noise, the job), so a change to any
 * of them makes another version and the browser's kept textures
 * (src/render3d/paint/cache.js) are painted again, never read back stale.
 * `plugins` lets a test change a source as it is read.
 * ----------------------------------------------------------------------------
 */

import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function bundleTexWorker(esbuild, { minify = true, plugins = [] } = {}) {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src', 'render3d', 'paint', 'worker.js')],
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    minify,
    legalComments: 'none',
    write: false,
    logLevel: 'warning',
    plugins,
  });
  const code = result.outputFiles[0].text;
  return { code, version: crypto.createHash('sha256').update(code).digest('hex').slice(0, 16) };
}
