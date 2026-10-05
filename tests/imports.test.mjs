/**
 * imports.test.mjs - the module graph has no cycles (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * Guards the sim's layering (docs/ARCHITECTURE.md "The sim's layering"): a
 * sim module imports only modules below it, and sim/military.js is the
 * orchestrator that imports everything. Two checks over the source text, no
 * module is loaded:
 *   - no import cycle anywhere under src (Tarjan's strongly connected
 *     components over the import graph; `export { x } from './y.js'` counts
 *     as an edge, since the re-exporting module loads y.js too);
 *   - inside src/sim nobody imports a name that military.js, navy.js,
 *     battle.js, trade.js, market.js or legion.js only re-export: those
 *     re-exports are for the UI, the dev tools and the tests, and a sim
 *     module taking one through them would close a cycle again.
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
// The modules that re-export part of the military toolbox for code outside the sim.
const RE_EXPORTERS = ['military.js', 'navy.js', 'battle.js', 'trade.js', 'market.js', 'legion.js'];

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
});
const rel = (p) => path.relative(SRC, p).split(path.sep).join('/');

/** The names of an import or re-export clause: `a, b as c` gives [a, c] for an export, [a, b] for an import. */
function clauseNames(clause, asExport) {
  return clause.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = s.match(/^(\S+)\s+as\s+(\S+)$/);
    return m ? (asExport ? m[2] : m[1]) : s;
  });
}

/** Every relative import and re-export of a file: [{ to, names, reExport }]. */
function edgesOf(file, text) {
  const out = [];
  for (const m of text.matchAll(/^(import|export)\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s+'(\.[^']+)';/gm)) {
    const names = [];
    if (m[2]) names.push(m[2]);
    if (m[3]) names.push(...clauseNames(m[3], m[1] === 'export'));
    out.push({ to: path.normalize(path.join(path.dirname(file), m[4])), names, reExport: m[1] === 'export' });
  }
  return out;
}

const files = walk(SRC).map((p) => path.normalize(p));
const graph = new Map(files.map((p) => [p, edgesOf(p, readFileSync(p, 'utf8'))]));

/** Tarjan: the strongly connected components with more than one module. */
function cycles() {
  let index = 0;
  const stack = [];
  const idx = new Map();
  const low = new Map();
  const on = new Set();
  const found = [];
  const strong = (v) => {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    on.add(v);
    for (const e of graph.get(v)) {
      const w = e.to;
      if (!graph.has(w)) continue;
      if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); } else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      const c = [];
      let w;
      do { w = stack.pop(); on.delete(w); c.push(w); } while (w !== v);
      if (c.length > 1) found.push(c.map(rel).sort());
    }
  };
  for (const v of graph.keys()) if (!idx.has(v)) strong(v);
  return found;
}

test('imports: no module under src takes part in an import cycle (re-exports count as edges)', () => {
  const found = cycles();
  assert.deepEqual(found, [], `cycles:\n${found.map((c) => '  ' + c.join(' -> ')).join('\n')}`);
});

test('imports: inside src/sim a re-exported name is imported from its own module, never through the re-export', () => {
  const simDir = path.join(SRC, 'sim');
  const reExported = new Map(); // normalized path of a re-exporter -> Set of the names it re-exports
  for (const name of RE_EXPORTERS) {
    const p = path.normalize(path.join(simDir, name));
    const names = new Set();
    for (const e of graph.get(p)) if (e.reExport) for (const n of e.names) names.add(n);
    reExported.set(p, names);
    assert.ok(names.size > 0, `${name} re-exports part of the toolbox (none found: has the layering changed?)`);
  }
  const bad = [];
  for (const p of files) {
    if (!p.startsWith(path.normalize(simDir))) continue;
    for (const e of graph.get(p)) {
      if (e.reExport) continue;
      const names = reExported.get(e.to);
      if (!names) continue;
      for (const n of e.names) if (names.has(n)) bad.push(`${rel(p)} imports ${n} from ${rel(e.to)}`);
    }
  }
  assert.deepEqual(bad, [], `through a re-export:\n  ${bad.join('\n  ')}`);
});
