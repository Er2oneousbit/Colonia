/**
 * materials3d.test.mjs - one material key, one look (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * render3d/materials.js shares materials by key: the first model to ask
 * makes it, every later one gets that. A key asked for with other options
 * from another file would silently take the first caller's look (the
 * baths' pool paint was the garden's flat blue, v0.30.3), so every call in
 * the model code is scanned here for a key with two sets of options.
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function* jsFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* jsFiles(p);
    else if (e.name.endsWith('.js')) yield p;
  }
}

test('materials3d: no material key is asked for with two different sets of options', () => {
  const byKey = new Map();
  for (const file of jsFiles(path.join(ROOT, 'src/render3d'))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bmaterial\('([\w-]+)'(?:,\s*(\{[^}]*\}))?\)/g)) {
      const opts = (m[2] || '{}').replace(/\s+/g, '');
      if (!byKey.has(m[1])) byKey.set(m[1], new Map());
      const seen = byKey.get(m[1]);
      if (!seen.has(opts)) seen.set(opts, []);
      seen.get(opts).push(path.relative(ROOT, file));
    }
  }
  assert.ok(byKey.size > 100, `material calls found (${byKey.size} keys)`);
  const bad = [...byKey].filter(([, seen]) => seen.size > 1).map(([key, seen]) => `${key}: ${[...seen].map(([o, f]) => `${o} <- ${f.join(', ')}`).join(' | ')}`);
  assert.deepEqual(bad, [], 'keys with differing options');
});
