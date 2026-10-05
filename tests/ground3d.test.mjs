/**
 * ground3d.test.mjs - headless tests for the 3D ground (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * The ground's look is judged by eye (the look lab's Ground scene, the
 * game under ?renderer=3d); these hold what the eye cannot check each time:
 *   - the type map read from a map: kinds (beach by the water, scrub only
 *     far from it, a farm's soil, the bed under water), road links and
 *     surfaces, rubble, bridges, the shore's signed distance and the water's
 *     kind (sea or fresh)
 *   - the type map follows the map: only what changed is packed again,
 *     reported by chunk; nothing when nothing changed
 *   - chunks cover the map exactly; a view turn moves the ground as
 *     render/view.js moves a map point
 *   - snow and season as smooth numbers
 *   - every ground texture layer tiles, has the same size and its height
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Box3 } from 'three';
import { GameMap, Terrain, Road } from '../src/world/map.js';
import { toView } from '../src/render/view.js';
import {
  GroundMap, KIND, ROAD_SURFACE, G_RUBBLE, G_BRIDGE, WATER_KIND, CHUNK, SHORE_MAX, SCRUB_DIST, BEACH_DIST,
  shoreByte, shoreDist, shoreField, waterKinds, kindOf, roadByte,
} from '../src/render3d/ground/groundMap.js';
import { GROUND_LAYERS, LAYER, makeGroundLayer } from '../src/render3d/ground/groundSurfaces.js';
import { groundArrays, packLayers } from '../src/render3d/ground/groundTextures.js';
import { Ground, groundSnow, seasonAt, SEASON_LOOKS } from '../src/render3d/ground/ground.js';
import { labGroundMap } from '../src/dev/labGround.js';

/** A map of grass with a sea along its top rows and a two-wide river down column 30. */
function testMap(n = 64) {
  const map = new GameMap(n, n);
  map.terrain.fill(Terrain.GRASS);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (y < 10) map.terrain[map.idx(x, y)] = Terrain.WATER;
      else if (x === 30 || x === 31) map.terrain[map.idx(x, y)] = Terrain.WATER;
    }
  }
  return map;
}

/** Small texture arrays (the tests check structure, not sharpness). */
let TEX = null;
function tex() {
  if (!TEX) TEX = groundArrays(packLayers(GROUND_LAYERS.map((l) => makeGroundLayer(l.name, 16)), 16), 1);
  return TEX;
}

test('3D ground: the shore distance is signed, half a tile either side of a straight shore, capped far away', () => {
  const map = testMap();
  const d = shoreField(map);
  const at = (x, y) => d[map.idx(x, y)];
  assert.equal(at(5, 9), -0.5); // the last row of sea
  assert.equal(at(5, 10), 0.5); // the first row of land
  assert.equal(at(5, 8), -1.5);
  assert.equal(at(10, 14), 4.5); // four rows into the land, far from the river
  assert.ok(Math.abs(at(10, 60) - SHORE_MAX) < 1e-6); // far from any water
  assert.equal(at(30, 40), -0.5); // the river's tiles are each next to land
  // Packed and unpacked in a byte, to a sixteenth of a tile.
  for (const v of [-7.9, -0.5, 0, 0.5, 3.25, 7.9]) assert.ok(Math.abs(shoreDist(shoreByte(v)) - v) < 1 / 32, `${v}`);
  assert.equal(shoreByte(-20), shoreByte(-SHORE_MAX));
});

test('3D ground: a body of water deep somewhere is the open sea, a river or pond is fresh water', () => {
  const map = new GameMap(64, 64);
  map.terrain.fill(Terrain.GRASS);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 64; x++) map.terrain[map.idx(x, y)] = Terrain.WATER; // a sea 20 deep
  for (let y = 30; y < 64; y++) map.terrain[map.idx(40, y)] = Terrain.WATER; // a river one wide
  const kinds = waterKinds(map, shoreField(map));
  assert.equal(kinds[map.idx(5, 5)], WATER_KIND.SEA);
  assert.equal(kinds[map.idx(5, 19)], WATER_KIND.SEA); // the whole body, its shallow edge too
  assert.equal(kinds[map.idx(40, 50)], WATER_KIND.FRESH);
  assert.equal(kinds[map.idx(10, 40)], WATER_KIND.LAND);
});

test('3D ground: kinds read from where a tile lies: beach by the water, scrub only far from it, soil under a farm, a bed under water', () => {
  assert.equal(kindOf(Terrain.SAND, 0, 0, 1.5, false), KIND.BEACH);
  assert.equal(kindOf(Terrain.SAND, 0, 0, BEACH_DIST + 1, false), KIND.SAND);
  assert.equal(kindOf(Terrain.WATER, 0, 0, -2, false), KIND.BED);
  assert.equal(kindOf(Terrain.MEADOW, 0, 0, 5, true), KIND.SOIL);
  assert.equal(kindOf(Terrain.TREES, 0, 0, 5, false), KIND.FOREST);
  assert.equal(kindOf(Terrain.ROCK, 0, 0, 5, false), KIND.ROCK);
  // Near water grass is always grass; far from it, some patches dry to scrub, not all.
  let near = 0;
  let far = 0;
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 60; x++) {
      if (kindOf(Terrain.GRASS, x, y, SCRUB_DIST - 1, false) === KIND.SCRUB) near++;
      if (kindOf(Terrain.GRASS, x, y, SHORE_MAX, false) === KIND.SCRUB) far++;
    }
  }
  assert.equal(near, 0);
  assert.ok(far > 300 && far < 2400, `scrub is patches, not all or nothing: ${far} of 3600`);
});

test('3D ground: the road byte holds the links, the surface (gravel, the Imperial basalt, a plaza), rubble and bridges', () => {
  const map = testMap();
  for (let x = 5; x <= 8; x++) map.road[map.idx(x, 20)] = Road.ROAD;
  map.road[map.idx(6, 21)] = Road.ROAD;
  map.road[map.idx(7, 19)] = Road.PLAZA;
  map.fixedRoad[map.idx(8, 20)] = 1;
  map.rubble[map.idx(10, 20)] = 1;
  map.road[map.idx(30, 25)] = Road.BRIDGE;
  const g = (x, y) => roadByte(map, x, y);
  assert.equal(g(5, 20) & 15, 2); // only east
  assert.equal(g(6, 20) & 15, 2 | 4 | 8); // east, south, west
  assert.equal(g(7, 20) & 15, 1 | 2 | 8); // north is the plaza
  assert.equal((g(6, 20) >> 4) & 3, ROAD_SURFACE.GRAVEL);
  assert.equal((g(8, 20) >> 4) & 3, ROAD_SURFACE.BASALT);
  assert.equal((g(7, 19) >> 4) & 3, ROAD_SURFACE.FLAGS);
  assert.equal(g(10, 20), G_RUBBLE);
  assert.equal(g(30, 25), G_BRIDGE);
  assert.equal(g(12, 30), 0);
});

test('3D ground: the type map follows the map, repacking only the chunks that changed', () => {
  const map = testMap(96);
  let farms = new Set();
  const gm = new GroundMap(map);
  assert.equal(gm.update((i) => farms.has(i)), true);
  assert.equal(gm.dirty.length, 9, 'the first update packs every chunk (96 / 32 = 3 x 3)');
  assert.equal(gm.update((i) => farms.has(i)), false, 'nothing changed: nothing packed');
  // A road in the middle of chunk (1, 1).
  map.road[map.idx(40, 40)] = Road.ROAD;
  map.touch();
  assert.equal(gm.update((i) => farms.has(i)), true);
  assert.deepEqual(gm.dirty, [1 * 3 + 1]);
  assert.equal((gm.data[map.idx(40, 40) * 4 + 1] >> 4) & 3, ROAD_SURFACE.GRAVEL);
  // A road on a chunk's edge links into the next chunk's tile: both are packed again.
  map.road[map.idx(63, 40)] = Road.ROAD;
  map.road[map.idx(64, 40)] = Road.ROAD;
  map.touch();
  gm.update((i) => farms.has(i));
  assert.deepEqual(gm.dirty, [1 * 3 + 1, 1 * 3 + 2]);
  assert.equal(gm.data[map.idx(63, 40) * 4 + 1] & 15, 2);
  // Cleared again: the neighbour loses its link.
  map.road[map.idx(64, 40)] = Road.NONE;
  map.touch();
  gm.update((i) => farms.has(i));
  assert.equal(gm.data[map.idx(63, 40) * 4 + 1] & 15, 0);
  // A farm placed: its tiles become soil; the revision alone (with nothing changed) repacks nothing.
  farms = new Set([map.idx(70, 70), map.idx(71, 70)]);
  map.touch();
  gm.update((i) => farms.has(i));
  assert.equal(gm.data[map.idx(70, 70) * 4], KIND.SOIL);
  assert.deepEqual(gm.dirty, [2 * 3 + 2]);
  map.touch();
  assert.equal(gm.update((i) => farms.has(i)), false);
  // Rubble and trees cut down.
  map.rubble[map.idx(20, 80)] = 1;
  map.terrain[map.idx(21, 80)] = Terrain.TREES;
  map.touch();
  gm.update((i) => farms.has(i));
  assert.ok(gm.data[map.idx(20, 80) * 4 + 1] & G_RUBBLE);
  assert.equal(gm.data[map.idx(21, 80) * 4], KIND.FOREST);
  // New water (never in a game, but a lab or an editor): the shore is worked out again everywhere.
  map.terrain[map.idx(80, 80)] = Terrain.WATER;
  map.touch();
  gm.update((i) => farms.has(i));
  assert.equal(gm.dirty.length, 9);
  assert.ok(shoreDist(gm.data[map.idx(80, 81) * 4 + 2]) === 0.5);
});

test('3D ground: chunks cover the map exactly, and a view turn moves a map point where view.js says', () => {
  for (const [w, h] of [[64, 64], [96, 80], [256, 256]]) {
    const map = testMap(Math.max(w, h));
    const m2 = new GameMap(w, h);
    m2.terrain.set(map.terrain.subarray(0, w * h));
    const ground = new Ground(m2, tex(), { quality: 'low' });
    assert.equal(ground.meshes.length, Math.ceil(w / CHUNK) * Math.ceil(h / CHUNK));
    let area = 0;
    const all = new Box3();
    for (const m of ground.meshes) {
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox;
      area += (b.max.x - b.min.x) * (b.max.z - b.min.z);
      all.union(b);
    }
    assert.equal(area, w * h);
    assert.deepEqual([all.min.x, all.min.z, all.max.x, all.max.z], [0, 0, w, h]);
    for (let t = 0; t < 4; t++) {
      ground.setTurn(t);
      for (const [x, y] of [[0, 0], [w, 0], [3.5, h - 1.25], [w * 0.3, h * 0.7]]) {
        const p = new Vector3(x, 0, y).applyMatrix4(ground.inner.matrixWorld);
        const [u, v] = toView(x, y, t, w, h);
        assert.ok(Math.abs(p.x - u) < 1e-9 && Math.abs(p.z - v) < 1e-9 && Math.abs(p.y) < 1e-12, `turn ${t} (${x}, ${y}): ${p.x}, ${p.z} vs ${u}, ${v}`);
      }
    }
    ground.dispose();
  }
});

test('3D ground: snow lies by the weather\'s cover, growing smoothly; none under a trace, all of it when deep', () => {
  assert.equal(groundSnow(0), 0);
  assert.equal(groundSnow(0.05), 0);
  assert.equal(groundSnow(1), 1);
  let prev = -1;
  for (let c = 0; c <= 1.0001; c += 0.01) {
    const s = groundSnow(c);
    assert.ok(s >= prev && s >= 0 && s <= 1);
    prev = s;
  }
  // The console's levels (ui/console.js snow 0..3) each lie deeper than the last.
  const lv = [0, 0.28, 0.62, 0.95].map(groundSnow);
  assert.ok(lv[0] === 0 && lv[1] > 0.15 && lv[2] > lv[1] + 0.2 && lv[3] > 0.95);
});

test('3D ground: the season moves smoothly through the year and wraps from autumn into winter', () => {
  for (let k = 0; k < 4; k++) assert.deepEqual(seasonAt(k).veg, SEASON_LOOKS[k].veg);
  const a = seasonAt(3.999);
  const b = seasonAt(0);
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(a.veg[c] - b.veg[c]) < 0.01);
  const mid = seasonAt(1.5);
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(mid.veg[c] - (SEASON_LOOKS[1].veg[c] + SEASON_LOOKS[2].veg[c]) / 2) < 1e-9);
});

test('3D ground: every texture layer has the same size, tiles, keeps its height in the alpha, and stays in the range of real ground', () => {
  const N = 64;
  assert.equal(GROUND_LAYERS.length, new Set(GROUND_LAYERS.map((l) => l.name)).size);
  // The kinds' layers come first, in KIND's order.
  for (const [name, k] of Object.entries(KIND)) assert.equal(LAYER[name === 'BED' ? 'bed' : name.toLowerCase()], k, name);
  // Patterns laid square to the map are never turned against tiling.
  for (const name of ['soil', 'basalt', 'flags']) assert.equal(GROUND_LAYERS[LAYER[name]].anti, false, name);
  for (const l of GROUND_LAYERS) {
    const m = makeGroundLayer(l.name, N);
    assert.equal(m.albedo.length, N * N * 4);
    assert.equal(m.normal.length, N * N * 4);
    assert.equal(m.orm.length, N * N * 4);
    let lo = 255;
    let hi = 0;
    let sum = 0;
    for (let i = 0; i < N * N; i++) {
      lo = Math.min(lo, m.albedo[i * 4 + 3]);
      hi = Math.max(hi, m.albedo[i * 4 + 3]);
      sum += (m.albedo[i * 4] + m.albedo[i * 4 + 1] + m.albedo[i * 4 + 2]) / 3;
    }
    assert.ok(lo === 0 && hi === 255, `${l.name}: height spans the alpha`);
    const mean = sum / (N * N);
    if (l.name !== 'ripples') assert.ok(mean > 30 && mean < 215, `${l.name}: mean albedo ${mean}`);
    // Tiling: the step across the wrap (column N-1 to 0, row N-1 to 0) is
    // no bigger than the biggest step between other columns or rows: a seam
    // would stand out over all of them (a joint may fall on it, as anywhere).
    for (const across of [true, false]) {
      const steps = [];
      for (let c = 0; c < N; c++) {
        let sumStep = 0;
        for (let r = 0; r < N; r++) {
          const a = across ? (r * N + c) : (c * N + r);
          const b = across ? (r * N + ((c + 1) % N)) : (((c + 1) % N) * N + r);
          for (const ch of [0, 1, 2, 3]) sumStep += Math.abs(m.albedo[a * 4 + ch] - m.albedo[b * 4 + ch]);
        }
        steps.push(sumStep);
      }
      const wrap = steps[N - 1];
      const most = Math.max(...steps.slice(0, N - 1));
      assert.ok(wrap <= most * 1.05, `${l.name}: seam ${across ? 'across' : 'down'} ${wrap} vs at most ${most} inside`);
    }
  }
});

test('3D ground: the look lab\'s patch holds every kind of ground, a road of each surface, rubble, sea and river', () => {
  const { map, scrub, farm } = labGroundMap();
  const gm = new GroundMap(map);
  gm.kindHook = (i, k) => (scrub[i] && k === KIND.GRASS ? KIND.SCRUB : k);
  gm.update((i) => !!farm[i]);
  const kinds = new Set();
  const surfaces = new Set();
  let rubble = 0;
  for (let i = 0; i < map.w * map.h; i++) {
    kinds.add(gm.data[i * 4]);
    surfaces.add((gm.data[i * 4 + 1] >> 4) & 3);
    if (gm.data[i * 4 + 1] & G_RUBBLE) rubble++;
  }
  for (const k of Object.values(KIND)) assert.ok(kinds.has(k), `kind ${k}`);
  for (const s of [ROAD_SURFACE.GRAVEL, ROAD_SURFACE.BASALT, ROAD_SURFACE.FLAGS]) assert.ok(surfaces.has(s), `surface ${s}`);
  assert.ok(rubble >= 4);
});
