/**
 * ground3d.test.mjs - headless tests for the 3D ground (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * The ground's look is judged by eye (the look lab's Ground scene, the
 * game under ?renderer=3d); these hold what the eye cannot check each time:
 *   - the type map read from a map: kinds (beach by the water, scrub only
 *     far from it, the bed under water), road links and surfaces, rubble,
 *     bridges, the shore's signed distance and the water's kind (sea or
 *     fresh)
 *   - the site map: what the game's buildings make of the ground (a farm's
 *     field by its crop and growth, its farmhouse yard turned with it, a
 *     building's yard, a wall's footing), linked only within one site; a
 *     fire's rubble and its embers; kept up to date as buildings come, go,
 *     grow and burn, with nothing left stale
 *   - the type map follows the map: only what changed is packed again,
 *     reported by chunk; nothing when nothing changed
 *   - chunks cover the map exactly; a view turn moves the ground as
 *     render/view.js moves a map point
 *   - snow and season as smooth numbers
 *   - the ground's texture layers: one per kind first, in KIND's order;
 *     patterns square to the map never turned (their pixels are painted on
 *     the GPU and checked in the smoke test's lab)
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
  SITE, BURN, A_BURNT, A_BURNING, S_RESTING, S_IDLE, siteWord,
} from '../src/render3d/ground/groundMap.js';
import { gameSiteHooks, buildingSite, GROWTH_STEPS } from '../src/render3d/ground/groundSites.js';
import { galleryMap, CARDS } from '../src/dev/labGallery.js';
import { newGame, findFree } from './helpers.mjs';
import { addBuilding, removeBuilding } from '../src/sim/entities.js';
import { igniteBuilding, collapseBuilding, putOutTile } from '../src/sim/risk.js';
import { GROUND_LAYERS, LAYER } from '../src/render3d/ground/groundSurfaces.js';
import { blankGroundArrays } from '../src/render3d/ground/groundTextures.js';
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

/** Blank texture arrays (the material's program does not depend on their pixels). */
let TEX = null;
function tex() {
  if (!TEX) TEX = blankGroundArrays(16);
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

test('3D ground: kinds read from where a tile lies: beach by the water, scrub only far from it, a bed under water', () => {
  assert.equal(kindOf(Terrain.SAND, 0, 0, 1.5), KIND.BEACH);
  assert.equal(kindOf(Terrain.SAND, 0, 0, BEACH_DIST + 1), KIND.SAND);
  assert.equal(kindOf(Terrain.WATER, 0, 0, -2), KIND.BED);
  assert.equal(kindOf(Terrain.MEADOW, 0, 0, 5), KIND.MEADOW, 'a farm\'s field is the site map\'s: the meadow stays under it');
  assert.equal(kindOf(Terrain.TREES, 0, 0, 5), KIND.FOREST);
  assert.equal(kindOf(Terrain.ROCK, 0, 0, 5), KIND.ROCK);
  // Near water grass is always grass; far from it, some patches dry to scrub, not all.
  let near = 0;
  let far = 0;
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 60; x++) {
      if (kindOf(Terrain.GRASS, x, y, SCRUB_DIST - 1) === KIND.SCRUB) near++;
      if (kindOf(Terrain.GRASS, x, y, SHORE_MAX) === KIND.SCRUB) far++;
    }
  }
  assert.equal(near, 0);
  assert.ok(far > 300 && far < 2400, `scrub is patches, not all or nothing: ${far} of 3600`);
});

test('3D ground: the road byte holds the links, the surface (gravel, a town street\'s basalt, a plaza), rubble and bridges', () => {
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
  // A street: a building (not a farm) beside the road paves it; a farm beside it leaves a country road.
  const town = (i) => i === map.idx(6, 22);
  const farm = (i) => false;
  assert.equal((roadByte(map, 6, 21, (i) => town(i) && !farm(i)) >> 4) & 3, ROAD_SURFACE.BASALT);
  assert.equal((roadByte(map, 5, 20, (i) => town(i)) >> 4) & 3, ROAD_SURFACE.GRAVEL);
});

test('3D ground: the corners of a block, the crossings at its ends and a short gap between two blocks pave with its streets', () => {
  // Roads round a 2 x 2 block of homes at (11..12, 11..12): a ring from 10 to 13.
  const map = testMap(64);
  for (let k = 10; k <= 13; k++) {
    for (const [x, y] of [[k, 10], [k, 13], [10, k], [13, k]]) map.road[map.idx(x, y)] = Road.ROAD;
  }
  // A straight road on east from the block's north-east corner, a gap of one tile, then another home on its south.
  for (let x = 14; x <= 16; x++) map.road[map.idx(x, 10)] = Road.ROAD;
  const homes = new Set([map.idx(11, 11), map.idx(12, 11), map.idx(11, 12), map.idx(12, 12), map.idx(16, 11)]);
  const town = (i) => homes.has(i);
  const surface = (x, y) => (roadByte(map, x, y, town) >> 4) & 3;
  // The corner (10, 10) touches the block only at its corner: paved (it was gravel when only the four sides counted).
  for (const [x, y] of [[10, 10], [13, 10], [10, 13], [13, 13]]) assert.equal(surface(x, y), ROAD_SURFACE.BASALT, `corner ${x},${y}`);
  // (15, 10): no home beside it, but between (14, 10) (the block's diagonal) and (16, 10) (a home south): paved.
  assert.equal(surface(14, 10), ROAD_SURFACE.BASALT);
  assert.equal(surface(15, 10), ROAD_SURFACE.BASALT);
  // The road on from there, past every home, stays a country road.
  map.road[map.idx(17, 10)] = Road.ROAD;
  map.road[map.idx(18, 10)] = Road.ROAD;
  assert.equal(surface(18, 10), ROAD_SURFACE.GRAVEL);
});

test('3D ground: a road is paved when a building comes beside it, and gravel again when it goes (not for a farm)', () => {
  const map = testMap(64);
  for (let x = 10; x <= 20; x++) map.road[map.idx(x, 30)] = Road.ROAD;
  const bld = new Set();
  const farms = new Set();
  const gm = new GroundMap(map);
  const update = () => gm.update({ farmAt: (i) => farms.has(i), buildingAt: (i) => bld.has(i) });
  const surf = (x, y) => (gm.data[map.idx(x, y) * 4 + 1] >> 4) & 3;
  update();
  assert.equal(surf(15, 30), ROAD_SURFACE.GRAVEL);
  bld.add(map.idx(15, 31));
  map.touch();
  update();
  assert.equal(surf(15, 30), ROAD_SURFACE.BASALT);
  // The street runs past the home's corners (a diagonal counts), no further.
  assert.equal(surf(14, 30), ROAD_SURFACE.BASALT, 'past its corner');
  assert.equal(surf(16, 30), ROAD_SURFACE.BASALT, 'past its other corner');
  assert.equal(surf(13, 30), ROAD_SURFACE.GRAVEL, 'only the road beside it');
  farms.add(map.idx(15, 31));
  map.touch();
  update();
  assert.equal(surf(15, 30), ROAD_SURFACE.GRAVEL, 'a lane by a farm is a country road');
  farms.clear();
  bld.clear();
  map.touch();
  update();
  assert.equal(surf(15, 30), ROAD_SURFACE.GRAVEL);
});

test('3D ground: the type map follows the map, repacking only the chunks that changed', () => {
  const map = testMap(96);
  let farms = new Set();
  const gm = new GroundMap(map);
  const hk = { farmAt: (i) => farms.has(i), siteAt: (i) => (farms.has(i) ? siteWord(SITE.GRAIN, 0.5, 0, 3) : 0), ownerAt: (i) => (farms.has(i) ? 7 : 0) };
  assert.equal(gm.update(hk), true);
  assert.equal(gm.dirty.length, 9, 'the first update packs every chunk (96 / 32 = 3 x 3)');
  assert.equal(gm.update(hk), false, 'nothing changed: nothing packed');
  // A road in the middle of chunk (1, 1).
  map.road[map.idx(40, 40)] = Road.ROAD;
  map.touch();
  assert.equal(gm.update(hk), true);
  assert.deepEqual(gm.dirty, [1 * 3 + 1]);
  assert.equal((gm.data[map.idx(40, 40) * 4 + 1] >> 4) & 3, ROAD_SURFACE.GRAVEL);
  // A road on a chunk's edge links into the next chunk's tile: both are packed again.
  map.road[map.idx(63, 40)] = Road.ROAD;
  map.road[map.idx(64, 40)] = Road.ROAD;
  map.touch();
  gm.update(hk);
  assert.deepEqual(gm.dirty, [1 * 3 + 1, 1 * 3 + 2]);
  assert.equal(gm.data[map.idx(63, 40) * 4 + 1] & 15, 2);
  // Cleared again: the neighbour loses its link.
  map.road[map.idx(64, 40)] = Road.NONE;
  map.touch();
  gm.update(hk);
  assert.equal(gm.data[map.idx(63, 40) * 4 + 1] & 15, 0);
  // A farm placed: its tiles become a field (the site map), linked to each other; the grass stays
  // the kind under it; the revision alone (with nothing changed) repacks nothing.
  farms = new Set([map.idx(70, 70), map.idx(71, 70)]);
  map.touch();
  gm.update(hk);
  assert.ok([KIND.GRASS, KIND.SCRUB].includes(gm.data[map.idx(70, 70) * 4]), 'the grass (here far from water, maybe scrub) stays under the field');
  assert.equal(gm.detail[map.idx(70, 70) * 4], SITE.GRAIN);
  assert.equal(gm.detail[map.idx(70, 70) * 4 + 2] & 15, 2, 'linked east to its other tile only');
  assert.equal(gm.detail[map.idx(71, 70) * 4 + 2] & 15, 8);
  assert.deepEqual(gm.dirty, [2 * 3 + 2]);
  map.touch();
  assert.equal(gm.update(hk), false);
  // Rubble and trees cut down.
  map.rubble[map.idx(20, 80)] = 1;
  map.terrain[map.idx(21, 80)] = Terrain.TREES;
  map.touch();
  gm.update(hk);
  assert.ok(gm.data[map.idx(20, 80) * 4 + 1] & G_RUBBLE);
  assert.equal(gm.data[map.idx(21, 80) * 4], KIND.FOREST);
  // New water (never in a game, but a lab or an editor): the shore is worked out again everywhere.
  map.terrain[map.idx(80, 80)] = Terrain.WATER;
  map.touch();
  gm.update(hk);
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

test('3D ground: one texture layer a kind, first and in KIND\'s order; patterns square to the map never turned', () => {
  assert.equal(GROUND_LAYERS.length, new Set(GROUND_LAYERS.map((l) => l.name)).size);
  for (const [name, k] of Object.entries(KIND)) assert.equal(LAYER[name === 'BED' ? 'bed' : name.toLowerCase()], k, name);
  for (const name of ['soil', 'basalt', 'flags']) assert.equal(GROUND_LAYERS[LAYER[name]].anti, false, name);
  for (const l of GROUND_LAYERS) assert.ok(l.metres > 0 && l.fields && l.colour, l.name);
});

test('3D ground: the look lab\'s patch holds every kind of ground, a road of each surface, rubble, sea and river', () => {
  const { map, scrub, farm } = labGroundMap();
  const gm = new GroundMap(map);
  gm.kindHook = (i, k) => (scrub[i] && k === KIND.GRASS ? KIND.SCRUB : k);
  gm.update({ farmAt: (i) => !!farm[i] });
  const kinds = new Set();
  const surfaces = new Set();
  let rubble = 0;
  for (let i = 0; i < map.w * map.h; i++) {
    kinds.add(gm.data[i * 4]);
    surfaces.add((gm.data[i * 4 + 1] >> 4) & 3);
    if (gm.data[i * 4 + 1] & G_RUBBLE) rubble++;
  }
  for (const k of Object.values(KIND)) if (k !== KIND.SOIL) assert.ok(kinds.has(k), `kind ${k}`);
  for (const s of [ROAD_SURFACE.GRAVEL, ROAD_SURFACE.BASALT, ROAD_SURFACE.FLAGS]) assert.ok(surfaces.has(s), `surface ${s}`);
  assert.ok(rubble >= 4);
});

test('3D ground: a site word packs a field\'s crop, growth, rest and idling, its size, place and turn; links only within one site', () => {
  const w = siteWord(SITE.FLAX, 0.5, S_RESTING | S_IDLE, 3, 2, 1, 3);
  assert.equal(w & 255, SITE.FLAX);
  assert.equal((w >>> 8) & 255, 128);
  assert.equal((w >>> 16) & (S_RESTING | S_IDLE), S_RESTING | S_IDLE);
  assert.equal(((w >>> 16) >> 6) & 3, 2, 'size 3');
  assert.equal((w >>> 24) & 7, 2);
  assert.equal(((w >>> 24) >> 3) & 7, 1);
  assert.equal((w >>> 24) >> 6, 3);
  assert.equal(siteWord(SITE.NONE, 1, S_IDLE), 0);
  // Two farms side by side: each one plot, an edge between them; a yard beside a field of the same farm: an edge too.
  const map = new GameMap(16, 16);
  const owner = (i) => (map.xOf(i) < 4 ? 1 : map.xOf(i) < 8 ? 2 : 0);
  const site = (i) => (map.yOf(i) > 2 || !owner(i) ? 0 : map.xOf(i) === 0 ? siteWord(SITE.YARD) : siteWord(SITE.GRAIN, 0.2));
  const gm = new GroundMap(map);
  gm.update({ siteAt: site, ownerAt: owner });
  const links = (x, y) => gm.detail[map.idx(x, y) * 4 + 2] & 15;
  assert.equal(links(2, 1), 1 | 2 | 4 | 8);
  assert.equal(links(3, 1) & 2, 0, 'no link into the next farm');
  assert.equal(links(4, 1) & 8, 0);
  assert.equal(links(1, 1) & 8, 0, 'no link from the field into its own yard');
  assert.equal(links(0, 1), 1 | 4, 'the yard links only along itself');
  assert.equal(links(2, 0) & 1, 0, 'the map\'s edge ends it');
  assert.equal(links(2, 2) & 4, 0);
});

test('3D ground: growth and fires change between revisions; refresh() repacks only the live tiles, and says which map changed', () => {
  const map = new GameMap(32, 32);
  let growth = 0.1;
  let burn = 0;
  const field = map.idx(5, 5);
  const ruin = map.idx(20, 20);
  const hk = {
    siteAt: (i) => (i === field ? siteWord(SITE.GRAIN, growth) : 0),
    ownerAt: (i) => (i === field ? 3 : 0),
    burnAt: (i) => (i === ruin ? burn : 0),
  };
  const gm = new GroundMap(map);
  gm.update(hk);
  assert.deepEqual(gm.refresh([field, ruin], hk), { types: false, sites: false }, 'nothing changed');
  growth = 0.6;
  assert.deepEqual(gm.refresh([field, ruin], hk), { types: false, sites: true });
  assert.equal(gm.detail[field * 4 + 1], Math.round(0.6 * 255));
  burn = BURN.BURNT | BURN.BURNING;
  assert.deepEqual(gm.refresh([field, ruin], hk), { types: true, sites: false });
  assert.equal(gm.data[ruin * 4 + 3] & (A_BURNT | A_BURNING), A_BURNT | A_BURNING);
  burn = BURN.BURNT;
  gm.refresh([ruin], hk);
  assert.equal(gm.data[ruin * 4 + 3] & (A_BURNT | A_BURNING), A_BURNT, 'gone out: the ash stays');
});

/** A small game with a farm on open land at (x, y), turned `turn`. */
function farmGame(type = 'farm_wheat', turn = 0) {
  const game = newGame({ size: 64 });
  const at = findFree(game, 3, 3);
  const b = addBuilding(game, type, at.x, at.y, undefined, { turn });
  return { game, b };
}

test('3D ground: a farm\'s site: its crop, growth in steps, and the farmhouse\'s yard on the art\'s first column, turned with the farm', () => {
  for (let turn = 0; turn < 4; turn++) {
    const { game, b } = farmGame('farm_wheat', turn);
    let yards = 0;
    for (let y = b.y; y < b.y + 3; y++) {
      for (let x = b.x; x < b.x + 3; x++) {
        const w = buildingSite(game, b, x, y);
        const s = w & 255;
        assert.ok(s === SITE.YARD || s === SITE.GRAIN, `turn ${turn}: ${s}`);
        if (s === SITE.YARD) {
          yards++;
          // The art's u 0..1 turned onto the map (render/turn.js turnUV): x = 0 at turn 0, y = 0 at turn 1...
          const [lx, ly] = [x - b.x, y - b.y];
          assert.ok([lx === 0, ly === 0, lx === 2, ly === 2][turn], `turn ${turn}: yard at ${lx},${ly}`);
        }
        assert.equal((w >>> 24) >> 6, turn);
      }
    }
    assert.equal(yards, 3);
  }
  const { game, b } = farmGame('farm_flax');
  const field = (x, y) => buildingSite(game, b, x, y);
  b.progress = 0;
  assert.equal((field(b.x + 2, b.y) >>> 8) & 255, 0);
  b.progress = 99.9;
  assert.equal((field(b.x + 2, b.y) >>> 8) & 255, 255);
  b.progress = 50;
  const g = ((field(b.x + 2, b.y) >>> 8) & 255) / 255;
  assert.ok(Math.abs(g - Math.floor(50 / 100 * GROWTH_STEPS) / (GROWTH_STEPS - 1)) < 1 / 255);
  assert.equal(field(b.x + 2, b.y) & 255, SITE.FLAX);
  b.efficiency = 0;
  assert.ok((field(b.x + 2, b.y) >>> 16) & S_IDLE, 'no workers: idle');
  const pig = farmGame('farm_pig');
  assert.equal(buildingSite(pig.game, pig.b, pig.b.x + 2, pig.b.y + 2) & 255, SITE.PEN);
});

test('3D ground: the game\'s ground follows its buildings: placed, growing, burned, burned out, cleared, demolished; nothing left stale', () => {
  const game = newGame({ size: 64 });
  const map = game.map;
  const hooks = gameSiteHooks(game);
  const gm = new GroundMap(map);
  const step = () => {
    hooks.prepare();
    const a = gm.update(hooks);
    const r = gm.refresh(hooks.live(), hooks);
    return { revision: a, ...r };
  };
  step();
  const at = findFree(game, 3, 3);
  const farm = addBuilding(game, 'farm_wheat', at.x, at.y);
  farm.efficiency = 1;
  const fieldTile = map.idx(at.x + 2, at.y + 1);
  assert.equal(step().revision, true);
  assert.equal(gm.detail[fieldTile * 4], SITE.GRAIN);
  // It grows with no map revision: the live refresh carries it.
  const rev = map.revision;
  farm.progress = 80;
  const s1 = step();
  assert.equal(map.revision, rev);
  assert.equal(s1.revision, false);
  assert.equal(s1.sites, true);
  assert.ok(gm.detail[fieldTile * 4 + 1] > 190);
  // A house beside it: a yard; burned: ash, burning; the fire goes out: ash only; the rubble cleared: grass again.
  const spot = findFree(game, 2, 2, { x: 50, y: 50 });
  const house = addBuilding(game, 'house', spot.x, spot.y, 2);
  step();
  const ht = map.idx(spot.x, spot.y);
  assert.equal(gm.detail[ht * 4], SITE.YARD);
  igniteBuilding(game, house, 'fire');
  step();
  assert.equal(gm.detail[ht * 4], SITE.NONE, 'no yard left under the ruin');
  assert.equal(gm.data[ht * 4 + 3] & (A_BURNT | A_BURNING), A_BURNT | A_BURNING);
  assert.ok(gm.data[ht * 4 + 1] & G_RUBBLE);
  for (const i of [...game.fires.keys()]) putOutTile(game, i);
  const s2 = step();
  assert.equal(s2.types, true, 'the fire going out is uploaded');
  assert.equal(gm.data[ht * 4 + 3] & (A_BURNT | A_BURNING), A_BURNT);
  map.rubble[ht] = 0;
  map.touch();
  step();
  assert.equal(gm.data[ht * 4 + 3] & A_BURNT, 0, 'cleared: no ash');
  assert.equal(gm.data[ht * 4 + 1] & G_RUBBLE, 0);
  // A collapse leaves rubble, not ash.
  const spot2 = findFree(game, 1, 1, { x: 10, y: 50 });
  const hut = addBuilding(game, 'house', spot2.x, spot2.y, 1);
  step();
  collapseBuilding(game, hut);
  step();
  const t2 = map.idx(spot2.x, spot2.y);
  assert.ok(gm.data[t2 * 4 + 1] & G_RUBBLE);
  assert.equal(gm.data[t2 * 4 + 3] & A_BURNT, 0);
  // The farm demolished: its field gone, the meadow or grass back.
  removeBuilding(game, farm);
  step();
  assert.equal(gm.detail[fieldTile * 4], SITE.NONE);
  // Packed from scratch, the maps are the same as kept up to date.
  const fresh = new GroundMap(map);
  hooks.prepare();
  fresh.update(hooks);
  assert.deepEqual(fresh.data, gm.data);
  assert.deepEqual(fresh.detail, gm.detail);
});

test('3D ground: a wall and an aqueduct stand on their footing, one site along them; not under a road', () => {
  const game = newGame({ size: 64 });
  const map = game.map;
  const hooks = gameSiteHooks(game);
  const gm = new GroundMap(map);
  const spot = findFree(game, 6, 1);
  for (let x = spot.x; x < spot.x + 6; x++) map.wall[map.idx(x, spot.y)] = 1;
  map.aqueduct[map.idx(spot.x + 2, spot.y + 1)] = 1;
  map.road[map.idx(spot.x + 3, spot.y + 1)] = 1;
  map.aqueduct[map.idx(spot.x + 3, spot.y + 1)] = 1;
  map.touch();
  hooks.prepare();
  gm.update(hooks);
  const site = (x, y) => gm.detail[map.idx(x, y) * 4];
  assert.equal(site(spot.x + 1, spot.y), SITE.FOOTING);
  assert.equal(gm.detail[map.idx(spot.x + 1, spot.y) * 4 + 2] & 10, 10, 'linked along the wall');
  assert.equal(site(spot.x + 2, spot.y + 1), SITE.FOOTING);
  assert.equal(site(spot.x + 3, spot.y + 1), SITE.NONE, 'the road over it is the road');
  map.wall[map.idx(spot.x + 1, spot.y)] = 0;
  map.touch();
  hooks.prepare();
  gm.update(hooks);
  assert.equal(site(spot.x + 1, spot.y), SITE.NONE, 'a broken wall leaves no footing behind');
});

test('3D ground: the look lab\'s Ground types gallery has a card for every kind and site, each inside the map', () => {
  const g = galleryMap();
  const gm = new GroundMap(g.map);
  gm.kindHook = g.kindHook;
  gm.waterHook = g.waterHook;
  gm.update(g.hooks);
  const kinds = new Set();
  const sites = new Set();
  const surfaces = new Set();
  let burnt = 0;
  let burning = 0;
  for (let i = 0; i < g.map.w * g.map.h; i++) {
    kinds.add(gm.data[i * 4]);
    sites.add(gm.detail[i * 4]);
    surfaces.add((gm.data[i * 4 + 1] >> 4) & 3);
    if (gm.data[i * 4 + 3] & A_BURNT) burnt++;
    if (gm.data[i * 4 + 3] & A_BURNING) burning++;
  }
  for (const k of Object.values(KIND)) if (k !== KIND.SOIL) assert.ok(kinds.has(k), `kind ${k}`);
  for (const s of Object.values(SITE)) assert.ok(sites.has(s), `site ${s}`);
  for (const s of Object.values(ROAD_SURFACE)) assert.ok(surfaces.has(s), `surface ${s}`);
  assert.ok(burnt > 4 && burning > 0);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length);
  for (const c of g.cards) assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= g.map.w && c.y + c.h <= g.map.h, c.id);
  // No scrub in the gallery but where a card asks for it.
  const scrubCard = g.cards.find((c) => c.id === 'scrub');
  for (let i = 0; i < g.map.w * g.map.h; i++) {
    if (gm.data[i * 4] !== KIND.SCRUB) continue;
    const x = g.map.xOf(i);
    const y = g.map.yOf(i);
    assert.ok(g.cards.some((c) => ['scrub', 'sand', 'roadedge'].includes(c.id) && x >= c.x && y >= c.y && x < c.x + c.w && y < c.y + c.h), `${x},${y}`);
  }
  assert.ok(scrubCard);
});

test('3D ground: the live tiles are read again only when the caller asks (Low redraws its picture for each change)', () => {
  const map = new GameMap(32, 32);
  let growth = 0.2;
  const field = map.idx(4, 4);
  const hooks = { siteAt: (i) => (i === field ? siteWord(SITE.GRAIN, growth) : 0), ownerAt: (i) => (i === field ? 1 : 0), live: () => [field] };
  const ground = new Ground(map, tex(), { quality: 'low', hooks });
  assert.equal(ground.update(), false, 'nothing changed');
  growth = 0.7;
  assert.equal(ground.update(false), false, 'not asked: the growth waits');
  assert.equal(ground.types.detail[field * 4 + 1], Math.round(0.2 * 255));
  assert.equal(ground.update(true), true);
  assert.equal(ground.types.detail[field * 4 + 1], Math.round(0.7 * 255));
  ground.dispose();
});
