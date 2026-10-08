/**
 * flora3d.test.mjs - the 3D countryside's trees and rocks (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * The WebGL back end draws the map's trees and rocks as models
 * (render3d/flora/); the browser smoke test checks they draw and that a
 * click on a forest tile still picks it. These cover what decides what
 * stands where and when it changes:
 *   - a tile's plants and rocks come from the variant layer and its place
 *     alone: the same map gives the same wood; the banks take the riparian
 *     trees; a stand clumps round one species; the province's climate and
 *     rock (a volcanic one's lava boulders)
 *   - clearing a forest tile (a building placed over it) takes its trees
 *     away at the map's next revision and leaves its neighbours' as they
 *     were; a road or a building hides them as it hides their sprites
 *   - the level of detail by a tile's size on the screen; the looks by month
 *   - every species grows inside its tile's reach and on the ground, each
 *     level lighter than the one before; the rocks sit in the ground
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Group, Box3 } from 'three';
import { GameMap, Terrain, Road } from '../src/world/map.js';
import { generateMap } from '../src/world/mapgen.js';
import { SPECIES, SPECIES_IDS, CLIMATES, lookOf, looksOf, climateOf, ROCKS } from '../src/render3d/flora/species.js';
import { treesOfTile, rocksOfTile, habitatOf, standField, WOOD_SCALE } from '../src/render3d/flora/layout.js';
import { Flora, floraLod, tileFlora, FLORA_LOD0_PX, FLORA_LOD1_PX, CHUNK } from '../src/render3d/flora/flora.js';
import { buildTree } from '../src/render3d/flora/treeModel.js';
import { buildRock } from '../src/render3d/flora/rockModel.js';
import { kitOf } from '../src/render3d/kit.js';

const TYR = climateOf({ region: 'Etruria', site: 'etruria', type: 'river' });

/** A real generated map (a river valley), its forests and rocks as the game makes them. */
function riverMap(seed = 'flora') {
  return generateMap({ width: 64, height: 64, seed, type: 'river' }).map;
}

/** Every forest tile's plants on `map`. */
function woodOf(map, ctx = TYR) {
  const out = new Map();
  for (let i = 0; i < map.size; i++) if (map.terrain[i] === Terrain.TREES) out.set(i, treesOfTile(map, i, ctx));
  return out;
}

test('flora3d: a tile\'s plants come from the variant layer and its place: the same map, the same wood', () => {
  const a = woodOf(riverMap());
  const b = woodOf(riverMap());
  assert.ok(a.size > 100, `a wood to test on (${a.size} tiles)`);
  assert.deepEqual([...a.entries()], [...b.entries()]);
  // Another variant byte, another tile.
  const m = riverMap();
  const i = [...a.keys()][10];
  const before = JSON.stringify(treesOfTile(m, i, TYR));
  m.variant[i] = (m.variant[i] + 97) & 255;
  assert.notEqual(JSON.stringify(treesOfTile(m, i, TYR)), before);
  // Every plant on its tile, a species of the climate, a shape of its species, a sane size.
  for (const list of a.values()) {
    assert.ok(list.length >= 1 && list.length <= 3);
    for (const p of list) {
      assert.ok(SPECIES[p.sp], p.sp);
      assert.ok(p.x > 0 && p.x < 1 && p.z > 0 && p.z < 1, JSON.stringify(p));
      assert.ok(p.v === 0 || p.v === 1);
      assert.ok(p.s / WOOD_SCALE > 0.5 && p.s / WOOD_SCALE < 1.3);
    }
  }
});

test('flora3d: a wood stays below the town: trees about twice a house high, and room between the crowns', () => {
  const wood = woodOf(riverMap());
  let plants = 0;
  let tallest = 0;
  for (const list of wood.values()) {
    plants += list.length;
    for (const p of list) if (SPECIES[p.sp].form !== 'shrub') tallest = Math.max(tallest, SPECIES[p.sp].size.h * p.s);
  }
  // A one-storey house is about 3 m to its ridge: no tree past 7.5 m, the slim cypress the tallest (at nature's size they reached 11).
  assert.ok(tallest < 7.5, `the tallest tree ${tallest.toFixed(1)} m`);
  // About one plant and a third a tile (it was nearer two: a thicket that hid the streets).
  const per = plants / wood.size;
  assert.ok(per > 1 && per < 1.45, `${per.toFixed(2)} plants a tile`);
});

test('flora3d: the banks take the riparian trees, dry ground the pines and holm oaks; woods grow in stands', () => {
  const m = riverMap();
  const wood = woodOf(m);
  const count = (pred) => {
    const c = {};
    for (const [i, list] of wood) if (pred(i)) c[list[0].sp] = (c[list[0].sp] || 0) + 1;
    return c;
  };
  const wet = count((i) => habitatOf(m.waterDist[i]) === 'wet');
  const dry = count((i) => habitatOf(m.waterDist[i]) === 'dry');
  // The main tree on a bank is one of the climate's bank trees.
  for (const sp of Object.keys(wet)) assert.ok(sp in CLIMATES.tyrrhenian.wet, `${sp} on a bank`);
  assert.ok(Object.keys(wet).length > 0, 'some banks are wooded');
  for (const sp of Object.keys(dry)) assert.ok(sp in CLIMATES.tyrrhenian.dry, `${sp} on dry ground`);
  // Stands: neighbouring forest tiles share their main species far more often than a random mix would.
  let same = 0;
  let pairs = 0;
  for (const [i, list] of wood) {
    const j = i + 1;
    if (!wood.has(j) || habitatOf(m.waterDist[i]) !== habitatOf(m.waterDist[j])) continue;
    pairs++;
    if (wood.get(j)[0].sp === list[0].sp) same++;
  }
  assert.ok(pairs > 50 && same / pairs > 0.35, `${same} of ${pairs} neighbours alike`);
  // The stand field is smooth: tiles side by side differ little.
  let jump = 0;
  for (let x = 0; x < 63; x++) jump = Math.max(jump, Math.abs(standField(m, x + 1, 20) - standField(m, x, 20)));
  assert.ok(jump < 0.2, `stand field jumps ${jump}`);
});

test('flora3d: the province decides the mix: the desert\'s palms, the Po\'s poplars, the volcanic lava boulders', () => {
  assert.equal(climateOf({ type: 'desert', region: 'Etruria' }).climate, 'desert');
  assert.equal(climateOf({ region: 'Gallia Cisalpina' }).climate, 'padane');
  assert.equal(climateOf({ region: 'Hispania' }).climate, 'iberian');
  assert.equal(climateOf({ region: 'Nowhere' }).climate, 'tyrrhenian');
  assert.ok(climateOf({ site: 'puteoli', region: 'Campania' }).volcanic > 0);
  assert.equal(climateOf({ site: 'etruria', region: 'Etruria' }).volcanic, 0);
  // No stone pine or wild olive on the Po; palms only in the desert.
  assert.ok(!('pine' in CLIMATES.padane.dry) && !('olive' in CLIMATES.padane.dry));
  for (const [k, c] of Object.entries(CLIMATES)) if (k !== 'desert') for (const h of ['wet', 'fresh', 'dry']) assert.ok(!('palm' in c[h]), `${k} ${h}`);
  // Rocks: limestone on most maps, lava boulders among them on a volcanic one.
  const m = riverMap('rocks');
  const rocks = (ctx) => {
    const kinds = {};
    for (let i = 0; i < m.size; i++) {
      if (m.terrain[i] !== Terrain.ROCK) continue;
      for (const r of rocksOfTile(m, i, ctx)) {
        kinds[r.kind] = (kinds[r.kind] || 0) + 1;
        assert.ok(r.v >= 0 && r.v < ROCKS[r.kind].n);
        assert.ok(r.x > 0 && r.x < 1 && r.z > 0 && r.z < 1);
      }
    }
    return kinds;
  };
  const lime = rocks(TYR);
  assert.ok(lime.outcrop > 0 && lime.boulder > 0 && lime.scree > 0 && !lime.lava, JSON.stringify(lime));
  const volc = rocks(climateOf({ site: 'puteoli', region: 'Campania' }));
  assert.ok(volc.lava > 0, JSON.stringify(volc));
});

test('flora3d: a tile shows trees or rocks as the 2D renderer draws their sprites (not under a road or a building)', () => {
  const m = new GameMap(16, 16);
  m.terrain.fill(Terrain.TREES);
  m.terrain[m.idx(3, 3)] = Terrain.ROCK;
  m.terrain[m.idx(4, 4)] = Terrain.GRASS;
  m.road[m.idx(5, 5)] = Road.ROAD;
  m.building[m.idx(6, 6)] = 7;
  m.terrain[m.idx(7, 7)] = Terrain.ROCK;
  m.building[m.idx(7, 7)] = 8;
  assert.equal(tileFlora(m, m.idx(1, 1)), 1);
  assert.equal(tileFlora(m, m.idx(3, 3)), 2);
  assert.equal(tileFlora(m, m.idx(4, 4)), 0);
  assert.equal(tileFlora(m, m.idx(5, 5)), 0);
  assert.equal(tileFlora(m, m.idx(6, 6)), 0);
  assert.equal(tileFlora(m, m.idx(7, 7)), 0);
});

test('flora3d: clearing a forest tile takes its trees away at the next revision and leaves its neighbours\' as they were', () => {
  const m = riverMap();
  const f = new Flora(null, { slot: new Group() });
  f.setMap(m, TYR);
  const recsOf = (i) => f.chunks.flatMap((c) => c.recs).filter((r) => r.i === i).map((r) => JSON.stringify([r.b, r.x, r.z, r.yaw, r.s]));
  // A forest tile with forest all round it.
  let t = -1;
  for (let i = 0; i < m.size && t < 0; i++) {
    const x = i % m.w;
    const y = (i / m.w) | 0;
    if (x < 2 || y < 2 || x > m.w - 3 || y > m.h - 3) continue;
    let all = true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (m.terrain[m.idx(x + dx, y + dy)] !== Terrain.TREES) all = false;
    if (all) t = i;
  }
  assert.ok(t >= 0);
  const around = [t - 1, t + 1, t - m.w, t + m.w, t - m.w - 1, t + m.w + 1];
  const before = around.map(recsOf);
  const total = f.counts().trees;
  assert.ok(recsOf(t).length >= 1);
  const v0 = f.version;
  // Unchanged map: nothing laid out again.
  assert.equal(f.sync(), false);
  // Cleared (construction.js turns a cleared forest tile to grass) and the map touched.
  m.terrain[t] = Terrain.GRASS;
  m.revision++;
  assert.equal(f.sync(), true);
  assert.equal(f.version, v0 + 1);
  assert.deepEqual(recsOf(t), []);
  assert.deepEqual(around.map(recsOf), before);
  assert.equal(f.counts().trees, total - treesOfTile(m, t, TYR).length);
  // A building placed over a wood (its footprint's tiles) hides them too; taken away, they come back.
  const u = t + 2 * m.w;
  const had = recsOf(u);
  m.building[u] = 99;
  m.revision++;
  f.sync();
  assert.deepEqual(recsOf(u), []);
  m.building[u] = 0;
  m.revision++;
  f.sync();
  assert.deepEqual(recsOf(u), had);
  // Only the touched chunk was laid out again: the map is in chunks of CHUNK tiles.
  assert.equal(f.chunks.length, Math.ceil(m.w / CHUNK) * Math.ceil(m.h / CHUNK));
});

test('flora3d: the level of detail by a tile\'s width on the screen', () => {
  assert.equal(floraLod(FLORA_LOD0_PX), 0);
  assert.equal(floraLod(FLORA_LOD0_PX - 1), 1);
  assert.equal(floraLod(FLORA_LOD1_PX), 1);
  assert.equal(floraLod(FLORA_LOD1_PX - 1), 2);
  // At a pixel ratio of 2 (a tile 64 world px): 0.5x and 1x impostors, 1.5x and 2x the middle level, 3x to 6x the full trees.
  const at = (zoom) => floraLod(64 * zoom * 2);
  assert.deepEqual([0.5, 0.75, 1, 1.5, 2, 3, 4, 6].map(at), [2, 2, 2, 1, 1, 0, 0, 0]);
});

test('flora3d: looks by month: evergreens keep their leaves; the deciduous turn and stand bare; blossom in its month', () => {
  for (const sp of ['cypress', 'pine', 'holm', 'olive', 'laurel', 'palm']) assert.deepEqual(looksOf(sp), ['leaf'], sp);
  assert.equal(lookOf('oak', 6), 'leaf');
  assert.equal(lookOf('oak', 9), 'autumn');
  assert.equal(lookOf('oak', 0), 'dead'); // the downy oak keeps its dead leaves in winter
  assert.equal(lookOf('chestnut', 0), 'bare');
  assert.equal(lookOf('cherry', 3), 'blossom');
  assert.equal(lookOf('almond', 1), 'blossom');
  assert.equal(lookOf('almond', 3), 'spring');
  assert.equal(lookOf('myrtle', 5), 'flower');
  assert.equal(lookOf('poplar', null), 'leaf'); // seasons off: summer's
});

test('flora3d: every species grows on the ground within reach of its tile; each level is lighter', () => {
  const box = new Box3();
  for (const sp of SPECIES_IDS) {
    const tris = [];
    for (const lod of [0, 1]) {
      const t = buildTree({ species: sp, variant: 0, look: 'leaf', lod });
      const kit = kitOf(t.group);
      tris.push(kit.triangles);
      box.setFromObject(t.group);
      // On the ground (its roots a little into it), as tall as the species, never wider than a tile and a half each way.
      assert.ok(box.min.y > -0.5 && box.min.y < 0.05, `${sp} foot ${box.min.y}`);
      assert.ok(box.max.y > SPECIES[sp].size.h * 0.5 && box.max.y < SPECIES[sp].size.h * 1.3, `${sp} top ${box.max.y}`);
      const reach = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z);
      assert.ok(reach < 6.2, `${sp} reach ${reach}`);
      assert.ok(kit.parts.some((p) => p.material.alphaTest > 0), `${sp} has foliage`);
    }
    assert.ok(tris[1] < tris[0] * 0.6, `${sp} ${tris}`);
    assert.ok(tris[0] < 16000, `${sp} ${tris[0]} triangles at the full level`);
  }
  // A bare tree has no foliage; a blossoming cherry has its blossom.
  assert.ok(!kitOf(buildTree({ species: 'oak', look: 'bare', lod: 1 }).group).parts.some((p) => p.material.alphaTest > 0));
  assert.ok(kitOf(buildTree({ species: 'cherry', look: 'blossom', lod: 1 }).group).parts.some((p) => /blossom/.test(p.material.name)));
});

test('flora3d: rocks sit in the ground, each level lighter', () => {
  const box = new Box3();
  for (const [kind, r] of Object.entries(ROCKS)) {
    for (let v = 0; v < r.n; v++) {
      const tris = [0, 1, 2].map((lod) => buildRock({ kind, variant: v, lod }).triangles);
      assert.ok(tris[0] > tris[1] && tris[1] > tris[2], `${kind} ${v} ${tris}`);
      const g = buildRock({ kind, variant: v, lod: 1 }).group;
      box.setFromObject(g);
      // Sunk: some of it under the ground, never floating.
      assert.ok(box.min.y < 0, `${kind} ${v} foot ${box.min.y}`);
      assert.ok(box.max.y > 0.1 && box.max.y < 3, `${kind} ${v} top ${box.max.y}`);
    }
  }
});

test('flora3d: a desert province\'s rocks are bases of their own (their limestone is tinted): a new map never shows the last one\'s', () => {
  const m = riverMap('rocks');
  const f = new Flora(null, { slot: new Group() });
  f.setMap(m, TYR);
  const keys = (ctx) => {
    f.setMap(m, ctx);
    return f.bases.filter((b) => !b.tree && b.total).map((b) => b.key);
  };
  const plain = keys(TYR);
  const warm = keys(climateOf({ type: 'desert', region: 'Hispania' }));
  assert.ok(plain.length && warm.length);
  assert.ok(warm.every((k) => k.endsWith(':warm')) && plain.every((k) => !k.endsWith(':warm')));
});
