/**
 * texpaint.test.mjs - how the procedural textures are made (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the paint pool (render3d/paint/pool.js): never more workers than its
 *     size, the biggest textures first, every job answered once, a failed
 *     worker handing its work to the page, idle workers ended, cancelling
 *   - the cache (paint/cache.js): the key names the job and the recipes'
 *     version, which changes with any recipe, and an entry that does not
 *     fit is never used
 *   - the recipes paint the same pixels as before they were made faster
 *     (fingerprints of every texture; the noise against the plain version)
 *   - the stand-ins are each texture's average, the textures are made at
 *     once at their final size, and the painted maps go into the same ones
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { PaintPool, CancelledError, poolSize, loadAll } from '../src/render3d/paint/pool.js';
import { textureKey, RECIPE_VERSION, cacheGetAll } from '../src/render3d/paint/cache.js';
import { mapsFit, paintJob } from '../src/render3d/paint/jobs.js';
import { STAND_INS, standIn, fillPixels } from '../src/render3d/paint/standIns.js';
import { gnoise, voronoi, fbm, fbmField, ridge, ridgeField } from '../src/render3d/texgen.js';
import { SURFACES, makeSurface, makeSurfaceAt } from '../src/render3d/surfaces.js';
import { GROUND_LAYERS, GROUND_SIZE, makeGroundLayer } from '../src/render3d/ground/groundSurfaces.js';
import { packStandIns, liveGroundArrays } from '../src/render3d/ground/groundTextures.js';
import { LOOK, surfaceTextures } from '../src/render3d/materials.js';
import { bundleTexWorker } from '../scripts/texWorker.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A stand-in for a worker: answers each job after `delay` ms with maps naming it; `crash` fires onerror instead. */
function fakeWorkers({ delay = 5, crash = false } = {}) {
  const made = [];
  const sent = [];
  const create = () => {
    const w = {
      dead: false,
      postMessage(msg) {
        sent.push(msg.job.name);
        setTimeout(() => {
          if (w.dead) return;
          if (crash) {
            w.onerror({ message: 'boom', preventDefault() {} });
            return;
          }
          const px = msg.job.size * msg.job.size * 4;
          w.onmessage({ data: { id: msg.id, albedo: new Uint8Array(px), normal: new Uint8Array(px), orm: new Uint8Array(px).fill(msg.job.size % 251), height: null } });
        }, delay);
      },
      terminate() { w.dead = true; },
    };
    made.push(w);
    return w;
  };
  return { create, made, sent };
}

test('paint pool: all but two cores, at least one, at most eight', () => {
  assert.equal(poolSize(16), 8);
  assert.equal(poolSize(32), 8);
  assert.equal(poolSize(8), 6);
  assert.equal(poolSize(4), 2);
  assert.equal(poolSize(2), 1);
  assert.equal(poolSize(1), 1);
  assert.equal(poolSize(undefined), 2);
});

test('paint pool: never more workers than its size, the biggest texture first, every job answered once', async () => {
  const f = fakeWorkers();
  const pool = new PaintPool({ size: 2, createWorker: f.create, idleMs: 1000 });
  const sizes = { a: 64, b: 256, c: 128, d: 256, e: 64, f: 512 };
  const jobs = Object.entries(sizes).map(([name, size]) => ({ kind: 'ground', name, size }));
  const runs = jobs.map((j) => pool.run(j));
  assert.equal(pool.workers.length, 2);
  const out = await Promise.all(runs);
  // The first job went at once (a worker was free); after that the queue's order: biggest first, then the older.
  assert.deepEqual(f.sent, ['a', 'b', 'f', 'd', 'c', 'e']);
  assert.equal(pool.started, 2, 'never more than two workers');
  out.forEach((m, i) => {
    assert.equal(m.albedo.length, jobs[i].size * jobs[i].size * 4, 'each job its own maps');
    assert.equal(m.orm[0], jobs[i].size % 251);
  });
  // A higher priority goes before a bigger texture.
  f.sent.length = 0;
  const busy = [pool.run({ kind: 'ground', name: 'x', size: 32 }), pool.run({ kind: 'ground', name: 'y', size: 32 })];
  const later = [pool.run({ kind: 'ground', name: 'big', size: 512 }), pool.run({ kind: 'ground', name: 'urgent', size: 32 }, 5)];
  await Promise.all([...busy, ...later]);
  assert.deepEqual(f.sent, ['x', 'y', 'urgent', 'big']);
  pool.dispose();
});

test('paint pool: idle workers are ended; a cancelled job never answers and frees its worker', async () => {
  const f = fakeWorkers({ delay: 20 });
  const pool = new PaintPool({ size: 1, createWorker: f.create, idleMs: 10 });
  const first = pool.run({ kind: 'ground', name: 'a', size: 32 });
  const queued = pool.run({ kind: 'ground', name: 'b', size: 32 });
  queued.cancel();
  await assert.rejects(queued, CancelledError);
  first.cancel();
  await assert.rejects(first, CancelledError);
  assert.equal(f.made[0].dead, true, 'the worker painting a cancelled job is ended');
  assert.equal(pool.workers.length, 0);
  const third = await pool.run({ kind: 'ground', name: 'c', size: 32 });
  assert.equal(third.albedo.length, 32 * 32 * 4);
  assert.deepEqual(f.sent, ['a', 'c'], 'the dropped job was never sent');
  await wait(40);
  assert.equal(pool.workers.length, 0, 'an idle worker is ended');
  assert.ok(f.made.every((w) => w.dead));
  pool.dispose();
});

test('paint pool: a worker that cannot start, or dies, hands its job and the queue to the page', async () => {
  // Workers forbidden (the page's policy): every job painted on the page.
  const none = new PaintPool({ size: 4, createWorker: () => { throw new Error('forbidden'); } });
  const job = { kind: 'ground', name: 'sand', size: 32 };
  const m = await none.run(job);
  assert.ok(mapsFit(job, m));
  assert.deepEqual([...m.albedo.slice(0, 64)], [...makeGroundLayer('sand', 32).albedo.slice(0, 64)]);
  assert.equal(none.onPage, 1);
  // A worker that dies mid-job: its job and the rest are painted on the page.
  const f = fakeWorkers({ crash: true });
  const dies = new PaintPool({ size: 1, createWorker: f.create });
  const jobs = ['sand', 'beach', 'soil'].map((name) => ({ kind: 'ground', name, size: 32 }));
  const out = await Promise.all(jobs.map((j) => dies.run(j)));
  out.forEach((o, i) => assert.ok(mapsFit(jobs[i], o), jobs[i].name));
  assert.equal(dies.broken, true);
  assert.equal(dies.onPage, 3);
  assert.ok(f.made[0].dead);
});

test('loadAll: each job comes once, painted where the cache has none (node has no cache)', async () => {
  const f = fakeWorkers();
  const pool = new PaintPool({ size: 3, createWorker: f.create });
  const jobs = ['a', 'b', 'c', 'd'].map((name, i) => ({ kind: 'ground', name, size: 32 * (i + 1) }));
  const got = [];
  await loadAll(jobs, (i, maps, cached) => got.push([i, maps.albedo.length, cached]), { pool });
  got.sort((x, y) => x[0] - y[0]);
  assert.deepEqual(got, jobs.map((j, i) => [i, j.size * j.size * 4, false]));
  // Biggest first: all four were queued together, then handed out.
  assert.deepEqual(f.sent, ['d', 'c', 'b', 'a']);
  pool.dispose();
});

test('texture cache: the key names the job and the recipes\' version; no build, no cache; an entry that does not fit is refused', async () => {
  const job = { kind: 'surface', name: 'basalt', size: 1024 };
  assert.equal(textureKey(job, 'abc'), 'surface:basalt:1024:abc');
  assert.notEqual(textureKey(job, 'abc'), textureKey({ ...job, size: 512 }, 'abc'));
  assert.notEqual(textureKey(job, 'abc'), textureKey({ ...job, kind: 'ground' }, 'abc'));
  assert.notEqual(textureKey(job, 'abc'), textureKey(job, 'abd'));
  // The sources run unbundled: no version, so nothing is read back (a recipe there may be mid-edit).
  assert.equal(RECIPE_VERSION, null);
  assert.deepEqual(await cacheGetAll([job]), [null]);
  // What a cache entry must be to be used.
  const small = { kind: 'surface', name: 'basalt', size: 4 };
  const ok = { albedo: new Uint8Array(64), normal: new Uint8Array(64), orm: new Uint8Array(64), height: new Float32Array(16) };
  assert.ok(mapsFit(small, ok));
  assert.ok(!mapsFit(small, { ...ok, height: null }), 'the paving needs its height');
  assert.ok(!mapsFit(small, { ...ok, albedo: new Uint8Array(60) }), 'a short map');
  assert.ok(!mapsFit(small, { ...ok, normal: [1, 2, 3] }), 'not bytes');
  assert.ok(!mapsFit(small, null));
  assert.ok(mapsFit({ kind: 'ground', name: 'sand', size: 4 }, { ...ok, height: null }));
});

test('texture cache: the recipes\' version changes with any recipe, and stays put without one', async () => {
  const esbuild = await import('esbuild');
  const a = await bundleTexWorker(esbuild);
  const b = await bundleTexWorker(esbuild);
  assert.equal(a.version, b.version, 'the same code, the same version');
  assert.match(a.version, /^[0-9a-f]{16}$/);
  // One colour of one ground layer changed: another version.
  const tweak = {
    name: 'tweak',
    setup(build) {
      build.onLoad({ filter: /groundSurfaces\.js$/ }, async (args) => {
        const fs = await import('node:fs');
        const src = fs.readFileSync(args.path, 'utf8');
        assert.ok(src.includes("rgb('#4a453f')"));
        return { contents: src.replace("rgb('#4a453f')", "rgb('#4a4540')"), loader: 'js' };
      });
    },
  };
  const c = await bundleTexWorker(esbuild, { plugins: [tweak] });
  assert.notEqual(c.version, a.version);
  // The worker holds every recipe: the look's surfaces and the ground's layers.
  assert.ok(a.code.includes('travertine') && a.code.includes('rubble'));
});

// ---------------------------------------------------------------------------
// The recipes' pixels.

/** Every texture at 64 px, fingerprinted (sha256 of its maps) before the noise and cells were made faster. */
const FINGERPRINTS = {
  limestone: '257f9acfeb1cb019',
  travertine: '81773d236215b206',
  basalt: '5106c904d9ebbb75',
  tufa: 'e869e1a030575eb0',
  cocciopesto: '1683c7a6e95f0a1d',
  plaster: 'fe17e4f2c88d28e8',
  wood: '266ec614979fdb59',
  bronze: '83459f8a594d0c66',
  iron: '705c65033789a25e',
  earth: '296c72efdf82c58c',
  rope: 'dc7fe7c3cad1f352',
  wool: '8d60a5713e11b058',
  ripples: '85c9a55a9d589e28',
  terracotta: '9f130a4bdc8b83a2',
  'ground.grass': 'bd33c3c46a42fc8f',
  'ground.meadow': '8a1a65f620208c47',
  'ground.scrub': 'eebfd02682726269',
  'ground.forest': '30676587015c59db',
  'ground.rock': '04786a1cc7b9f5f4',
  'ground.sand': 'c9740138f2791d85',
  'ground.beach': 'f1707c9ef7b9189d',
  'ground.soil': 'bd4ae2725d3d980e',
  'ground.bed': '5e39feecc0792e83',
  'ground.gravel': '97370bf848076459',
  'ground.basalt': '55dd4e5c7af7c8a5',
  'ground.flags': '01061c18ce67deb0',
  'ground.rubble': 'da11071bcd876efc',
  'ground.ripples': '291da91d3ae54b63',
};

function fingerprint(m) {
  const h = crypto.createHash('sha256');
  h.update(m.albedo);
  h.update(m.normal);
  h.update(m.orm);
  if (m.height) h.update(new Uint8Array(m.height.data.buffer));
  return h.digest('hex').slice(0, 16);
}

test('recipes: every texture paints the same pixels as before the speed-ups (a change of look must update these on purpose)', () => {
  const now = {};
  for (const name of Object.keys(SURFACES)) now[name] = fingerprint(makeSurfaceAt(name, 64));
  for (const l of GROUND_LAYERS) now[`ground.${l.name}`] = fingerprint(makeGroundLayer(l.name, 64));
  assert.deepEqual(now, FINGERPRINTS);
  // The job a worker runs paints what the recipe paints.
  const viaJob = paintJob({ kind: 'surface', name: 'basalt', size: 64 });
  const direct = makeSurfaceAt('basalt', 64);
  assert.deepEqual(viaJob.albedo, direct.albedo);
  assert.deepEqual(viaJob.height, direct.height.data);
});

/** The plain noise and cells, as they were before being made faster: the fast ones must agree. */
function refGnoise(x, y, px, py, seed) {
  const mod = (a, n) => ((a % n) + n) % n;
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const grad = (ix, iy, dx, dy) => {
    let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h ^= h >>> 13;
    const a = ((((h >>> 24) * 2) / 2 + 0.5) / 256) * Math.PI * 2;
    return Math.fround(Math.cos(a)) * dx + Math.fround(Math.sin(a)) * dy;
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const x0 = mod(xi, px);
  const x1 = x0 + 1 === px ? 0 : x0 + 1;
  const y0 = mod(yi, py);
  const y1 = y0 + 1 === py ? 0 : y0 + 1;
  const a = lerp(grad(x0, y0, fx, fy), grad(x1, y0, fx - 1, fy), fade(fx));
  const b = lerp(grad(x0, y1, fx, fy - 1), grad(x1, y1, fx - 1, fy - 1), fade(fx));
  return lerp(a, b, fade(fy));
}

test('recipes: the fast noise gives the same bits as the plain one, the fast cells the same cells and borders', () => {
  let s = 12345;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let k = 0; k < 4000; k++) {
    const px = 1 + Math.floor(rnd() * 200);
    const py = 1 + Math.floor(rnd() * 200);
    // Points on the lattice, off it either side (warped coordinates), far off.
    const x = (rnd() * 3 - 1) * px;
    const y = (rnd() * 3 - 1) * py;
    const seed = Math.floor(rnd() * 1e6) - 5e5;
    assert.equal(gnoise(x, y, px, py, seed), refGnoise(x, y, px, py, seed));
  }
  // A whole texture of noise at once is fbm() at every pixel centre, to the bit (stretched, and not).
  for (const [n, cells, oct, seed, gain, sx] of [[48, 3, 3, 7, 0.5, 1], [40, 22, 3, -9, 0.55, 1], [32, 10, 5, 3, 0.55, 8], [50, 120, 2, 5, 0.5, 0.05]]) {
    const f = fbmField(n, cells, oct, seed, gain, sx);
    const r = ridgeField(n, cells, oct, seed, sx);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = (x + 0.5) / n;
        const v = (y + 0.5) / n;
        assert.equal(f[y * n + x], fbm(u, v, cells, oct, seed, gain, sx));
        assert.equal(r[y * n + x], ridge(u, v, cells, oct, seed, sx));
      }
    }
  }
  // Cells: the border distance by brute force over every neighbour, as before.
  const out = {};
  for (let k = 0; k < 1500; k++) {
    const cells = 3 + Math.floor(rnd() * 60);
    const u = rnd() * 1.2 - 0.1;
    const v = rnd() * 1.2 - 0.1;
    const jitter = rnd();
    voronoi(u, v, cells, 7, jitter, out, 1);
    const fast = { ...out };
    // The plain version: nearest point, then every bisector of the 5 x 5 round it.
    const pt = (gx, gy) => {
      const m = (a, n) => ((a % n) + n) % n;
      const h = (ix, iy, sd) => {
        let q = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(sd | 0, 0x9e3779b1);
        q = Math.imul(q ^ (q >>> 15), 0x85ebca6b);
        q = Math.imul(q ^ (q >>> 13), 0xc2b2ae35);
        return ((q ^ (q >>> 16)) >>> 0) / 4294967296;
      };
      const cx = m(gx, cells);
      const cy = m(gy, cells);
      return [gx + Math.fround(0.5 + (h(cx, cy, 7) - 0.5) * jitter), gy + Math.fround(0.5 + (h(cx, cy, 14) - 0.5) * jitter)];
    };
    const x = u * cells;
    const y = v * cells;
    let best = Infinity;
    let b = null;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const p = pt(Math.floor(x) + i, Math.floor(y) + j);
      const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
      if (d < best) { best = d; b = [...p, Math.floor(x) + i, Math.floor(y) + j]; }
    }
    let edge = Infinity;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      if (!i && !j) continue;
      const p = pt(b[2] + i, b[3] + j);
      const dx = p[0] - b[0];
      const dy = p[1] - b[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      edge = Math.min(edge, (((p[0] + b[0]) / 2 - x) * dx + ((p[1] + b[1]) / 2 - y) * dy) / len);
    }
    assert.equal(fast.cx, b[0]);
    assert.equal(fast.cy, b[1]);
    assert.ok(Math.abs(fast.f1 - Math.sqrt(best)) < 1e-12);
    assert.ok(Math.abs(fast.edge - edge) < 1e-12, `edge ${fast.edge} vs ${edge}`);
  }
});

// ---------------------------------------------------------------------------
// Stand-ins, and the textures they stand in.

test('stand-ins: every texture has one, and it is the painted texture\'s average', () => {
  const mean = (bytes) => {
    const s = [0, 0, 0, 0];
    for (let i = 0; i < bytes.length; i++) s[i & 3] += bytes[i];
    return s.map((v) => Math.round(v / (bytes.length / 4)));
  };
  const hex = (a) => a.map((v) => v.toString(16).padStart(2, '0')).join('');
  const check = (kind, name, m) => {
    const s = standIn(kind, name);
    const a = mean(m.albedo);
    const o = mean(m.orm);
    const off = Math.max(...a.map((v, k) => Math.abs(v - s.albedo[k])), ...o.map((v, k) => Math.abs(v - s.orm[k])));
    assert.ok(off <= 6, `${kind} ${name}: the stand-in is ${off} off its average; paint/standIns.js should read  ${name}: '${hex(a)} ${hex(o)}',`);
    assert.deepEqual(s.normal, [128, 128, 255, 255], 'a flat normal');
  };
  assert.deepEqual(Object.keys(STAND_INS.surface).sort(), Object.keys(SURFACES).sort());
  assert.deepEqual(Object.keys(STAND_INS.ground).sort(), GROUND_LAYERS.map((l) => l.name).sort());
  // (At full size: a recipe's blurs and cavities are in pixels, so a smaller texture averages otherwise.)
  for (const name of Object.keys(SURFACES)) check('surface', name, makeSurface(name));
  for (const l of GROUND_LAYERS) check('ground', l.name, makeGroundLayer(l.name, GROUND_SIZE));
});

test('stand-ins: one colour fills every pixel, from any pixel on', () => {
  const out = fillPixels(new Uint8Array(4 * 6), [1, 2, 3, 4], 3, 2);
  assert.deepEqual([...out], [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 0, 0, 0, 0]);
  const packed = packStandIns(8);
  const px = 64;
  GROUND_LAYERS.forEach((l, i) => {
    const s = standIn('ground', l.name);
    for (const at of [i * px, i * px + px - 1]) {
      assert.deepEqual([...packed.albedo.slice(at * 4, at * 4 + 4)], s.albedo, l.name);
      assert.deepEqual([...packed.orm.slice(at * 4, at * 4 + 4)], s.orm, l.name);
      assert.deepEqual([...packed.normal.slice(at * 4, at * 4 + 4)], [128, 128, 255, 255], l.name);
    }
  });
});

test('materials: a surface\'s textures come at once, at their final size, holding its stand-in; the painted maps go into the same textures', async () => {
  const was = LOOK.textureScale;
  LOOK.textureScale = 0.125;
  try {
    const t = surfaceTextures('bronze');
    const size = 32;
    assert.equal(t.size, size);
    assert.equal(t.ready, false);
    assert.equal(t.maps, null);
    const s = standIn('surface', 'bronze');
    assert.equal(t.map.image.width, size);
    assert.equal(t.map.image.data.length, size * size * 4);
    assert.deepEqual([...t.map.image.data.slice(-4)], s.albedo);
    assert.deepEqual([...t.normalMap.image.data.slice(0, 4)], [128, 128, 255, 255]);
    const { map, normalMap, orm } = t;
    const v = map.version;
    const maps = await t.whenReady;
    assert.equal(t.ready, true);
    assert.ok(t.map === map && t.normalMap === normalMap && t.orm === orm, 'the same texture objects: a material on them never changes');
    assert.equal(map.image.width, size, 'the same size: uploaded into, never made anew');
    assert.ok(map.version > v, 'marked for upload');
    const painted = makeSurface('bronze', undefined, 0.125);
    assert.deepEqual(map.image.data, painted.albedo);
    assert.deepEqual(orm.image.data, painted.orm);
    assert.equal(maps.metres, SURFACES.bronze.metres);
    // The paving's height comes with its maps, as a field the street samples.
    const basalt = await surfaceTextures('basalt').whenReady;
    assert.equal(basalt.height.size, basalt.size);
    assert.ok(Math.abs(basalt.height.sample(0.3, 0.6) - makeSurface('basalt', undefined, 0.125).height.sample(0.3, 0.6)) < 1e-6);
  } finally {
    LOOK.textureScale = was;
  }
});

test('ground textures: a layer painted after its array went to the GPU uploads alone; before, it rides with the whole upload', () => {
  const listeners = new Set();
  const src = { packed: packStandIns(8), listen(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  const tex = liveGroundArrays(src, 1);
  const uploads = [];
  const renderer = { initTexture: (a) => uploads.push(a) };
  tex.upload(renderer, 0);
  assert.deepEqual(uploads, [tex.albedo]);
  const vAlbedo = tex.albedo.version;
  const vNormal = tex.normal.version;
  for (const fn of listeners) fn(3);
  assert.deepEqual([...tex.albedo.layerUpdates], [3], 'on the GPU: only the new layer');
  assert.equal(tex.normal.layerUpdates.size, 0, 'not yet on the GPU: no layer updates (the first upload sends the whole array)');
  assert.ok(tex.albedo.version > vAlbedo && tex.normal.version > vNormal, 'both marked for upload');
  // A lost context: the next upload of each array is whole again.
  tex.lost();
  assert.equal(tex.albedo.layerUpdates.size, 0);
  for (const fn of listeners) fn(5);
  assert.equal(tex.albedo.layerUpdates.size, 0);
  tex.dispose();
  assert.equal(listeners.size, 0, 'freed arrays stop listening');
});
