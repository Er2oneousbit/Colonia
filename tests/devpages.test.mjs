/**
 * devpages.test.mjs - the unbundled pages can resolve three.js (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * index.html (npm run dev) and tests/e2e/render.html (npm run screenshots)
 * load the sources as they are, so the bare `import ... from 'three'` in
 * src/render3d needs an import map; the build inlines three.js instead.
 * Both pages were broken for two weeks without it (v0.30.3), and CI never
 * opens them, so this checks the map is there and points at a real file.
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const page of ['index.html', 'tests/e2e/render.html']) {
  test(`dev pages: ${page} maps the bare "three" import to the module in node_modules`, () => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const m = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    assert.ok(m, 'an import map');
    const map = JSON.parse(m[1]);
    const three = map.imports && map.imports.three;
    assert.ok(typeof three === 'string' && three.startsWith('/'), 'three mapped to a path from the server root');
    // (A fresh clone or an agent worktree without node_modules: the map is still checked, the file is not.)
    if (fs.existsSync(path.join(ROOT, "node_modules", "three"))) assert.ok(fs.existsSync(path.join(ROOT, three)), `${three} exists`);
    assert.ok(html.indexOf('<script type="importmap">') < html.indexOf('<script type="module"'), 'the map comes before the module script');
  });
}
