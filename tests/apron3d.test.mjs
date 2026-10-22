/**
 * apron3d.test.mjs - the land past the map's rim in the 3D ground (node:test)
 * ----------------------------------------------------------------------------
 * The look is judged by eye (the game under ?renderer=3d, the edge pictures);
 * these hold the rules: the apron's ground is the nearest rim tile's kind
 * (water stays water, sand stays sand, rock stays rock),
 * its trees follow a grass or forest rim, stand none within the playable
 * rim, are few and deterministic, and the ground builds one extra mesh for it.
 * (The smallest map is 16 x 16.)
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { GameMap, Terrain } from '../src/world/map.js';
import { GroundMap, KIND } from '../src/render3d/ground/groundMap.js';
import { Ground } from '../src/render3d/ground/ground.js';
import { blankGroundArrays } from '../src/render3d/ground/groundTextures.js';
import { apronKind, apronTrees, apronWidth, inApron, rimTile, APRON_TILES, APRON_TILES_UBER } from '../src/render3d/ground/apron.js';
import { climateOf } from '../src/render3d/flora/species.js';
import { Flora } from '../src/render3d/flora/flora.js';

const CTX = climateOf({ region: 'Etruria', site: 'etruria', type: 'river' });

/** Grass, with sea down the left three columns, sand along the bottom row and rock along the top row. */
function rimMap() {
  const map = new GameMap(16, 16);
  map.terrain.fill(Terrain.GRASS);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 3; x++) map.terrain[map.idx(x, y)] = Terrain.WATER;
  for (let x = 3; x < 16; x++) {
    map.terrain[map.idx(x, 15)] = Terrain.SAND;
    map.terrain[map.idx(x, 0)] = Terrain.ROCK;
  }
  map.computeWaterDistance();
  return map;
}

function packed(map, hooks = {}) {
  const types = new GroundMap(map);
  types.update(hooks);
  return types;
}

test('apron: its width is 8 tiles, 16 on the biggest map', () => {
  assert.equal(apronWidth(new GameMap(64, 64)), APRON_TILES);
  assert.equal(apronWidth(new GameMap(256, 256)), APRON_TILES_UBER);
});

test('apron: each apron tile takes the kind of the nearest rim tile (water, sand, rock, grass go on)', () => {
  const map = rimMap();
  const types = packed(map);
  assert.deepEqual(rimTile(map, -5, 7), [0, 7]);
  assert.deepEqual(rimTile(map, 20, -3), [15, 0]);
  // Water on the left: the apron there is water's bed, as the rim tile.
  for (const y of [1, 7, 14]) for (const x of [-1, -4, -8]) assert.equal(apronKind(types, x, y), KIND.BED, `(${x},${y})`);
  assert.equal(apronKind(types, -3, 7), types.data[map.idx(0, 7) * 4]);
  // Sand along the bottom, rock along the top, grass on the right.
  assert.ok([KIND.SAND, KIND.BEACH].includes(apronKind(types, 8, 20)));
  assert.equal(apronKind(types, 8, -6), KIND.ROCK);
  assert.equal(apronKind(types, 20, 8), types.data[map.idx(15, 8) * 4]);
  assert.ok([KIND.GRASS, KIND.MEADOW, KIND.SCRUB].includes(apronKind(types, 20, 8)));
  // Inside the map the kind is the tile's own.
  assert.equal(apronKind(types, 8, 8), types.data[map.idx(8, 8) * 4]);
  assert.ok(inApron(map, -1, 3) && inApron(map, 3, 16) && !inApron(map, 15, 15));
});

test('apron: trees stand on a grass or forest rim only, never within the playable rim, deterministically and few', () => {
  const map = rimMap();
  const a = apronTrees(map, CTX);
  assert.ok(a.length > 0, `${a.length} trees`);
  for (const t of a) {
    assert.ok(t.x < 0 || t.z < 0 || t.x >= map.w || t.z >= map.h, 'outside the map');
    const dx = t.x - Math.max(0, Math.min(map.w, t.x));
    const dz = t.z - Math.max(0, Math.min(map.h, t.z));
    assert.ok(Math.hypot(dx, dz) >= 1, 'a crown clear of the rim');
    const [rx, ry] = rimTile(map, Math.floor(t.x), Math.floor(t.z));
    assert.equal(map.terrain[map.idx(rx, ry)], Terrain.GRASS, 'a grass rim');
  }
  // None off the water's rim (left), the sand's (bottom) or the rock's (top).
  assert.ok(!a.some((t) => t.x < 0));
  assert.ok(!a.some((t) => t.z < 0 || t.z >= map.h));
  assert.deepEqual(apronTrees(map, CTX), a);
  // A big forested map's apron stays under the cap.
  const big = new GameMap(256, 256);
  big.terrain.fill(Terrain.TREES);
  assert.ok(apronTrees(big, CTX).length <= 420);
});

test('apron: the ground builds one more mesh for it, in one draw call, and not without one', () => {
  const map = rimMap();
  const tex = blankGroundArrays(16);
  const plain = new Ground(map, tex, { quality: 'low' });
  const wide = new Ground(map, tex, { quality: 'low', apron: 8 });
  assert.equal(wide.meshes.length, plain.meshes.length + 1);
  assert.equal(plain.apronMesh, null);
  assert.equal(wide.material.userData.ground.uGApron.value, 8);
  assert.equal(plain.material.userData.ground.uGApron.value, 0);
  // Four quads in one geometry, covering the frame of 8 tiles round the map.
  const g = wide.apronMesh.geometry;
  g.computeBoundingBox();
  assert.deepEqual([g.boundingBox.min.x, g.boundingBox.min.z, g.boundingBox.max.x, g.boundingBox.max.z], [-8, -8, 24, 24]);
  assert.equal(g.index.count, 24);
  wide.dispose();
  plain.dispose();
});

test('apron: the flora lays the apron trees out in a chunk of their own, kept with the map', () => {
  const map = rimMap();
  const trees = apronTrees(map, CTX);
  const f = new Flora(null, { slot: new Group() });
  f.setMap(map, CTX, trees);
  assert.equal(f.apronChunk, f.chunks.length - 1);
  assert.equal(f.chunks[f.apronChunk].recs.length, trees.length);
  assert.equal(f.counts().trees, trees.length);
  f.setMap(map, CTX, null);
  assert.equal(f.apronChunk, -1);
  assert.equal(f.counts().trees, 0);
});
