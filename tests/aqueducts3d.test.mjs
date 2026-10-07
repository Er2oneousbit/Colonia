/**
 * aqueducts3d.test.mjs - the 3D aqueducts and the castellum aquae (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the piece a tile shows at every view turn is its map mask turned with
 *     the view, its reservoir arms where the reservoirs are
 *   - over a road, the road's arch, its line across the road at every turn
 *   - full and dry: the water and the falls show only while it runs, the
 *     silt only dry, the ice only on running water in a hard frost
 *   - the pieces meet seamlessly: every arcade arm's section at the tile's
 *     edge is the straight's, a stair into a reservoir meets the castellum's
 *     inlet; each piece fits its tile, each level of detail lighter
 *   - the castellum fits its footprint at every turn; its inlets stand where
 *     the aqueducts reach it at every view turn, into its house at its back
 *   - in the game's pass: aqueducts and reservoirs drawn from shared kits,
 *     full or dry as the sim says; a new aqueduct rises; a dragged
 *     aqueduct's ghost shows the pieces it would build
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Group, Box3, Vector3, Matrix4 } from 'three';
import { GameMap, Terrain } from '../src/world/map.js';
import { rotMask, toView } from '../src/render/view.js';
import { aqueductPiece, aqueductMask, parseAqueductKey, reservoirJoins, sideOf, ARM_BITS, aqueductLookOf } from '../src/render3d/aqueducts/aqueductLayout.js';
import { buildAqueductPiece, aqueductKeys, AQ, AQ_TOP } from '../src/render3d/models/aqueduct.js';
import { buildCastellum, buildInlet, RES } from '../src/render3d/models/castellum.js';
import { MODELS, hasModel, modelMatrix, partShows } from '../src/render3d/models.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import { aqueductModelPlace, aqueductGhosts, aqueductRise, noteAqueducts, inletMatrix, reservoirMore } from '../src/render3d/aqueducts/aqueductGame.js';
import { updateWater } from '../src/sim/water.js';
import { newGame, build } from './helpers.mjs';

const NONE = new Map();

/** A blank map with aqueducts at [x, y, water] and roads at [x, y]. */
function mapWith(aqs, roads = []) {
  const map = new GameMap(24, 24);
  for (const [x, y, w = 1] of aqs) map.aqueduct[map.idx(x, y)] = w;
  for (const [x, y] of roads) map.road[map.idx(x, y)] = 1;
  return map;
}

/** A reservoir on a map: its building in a map of buildings. */
function withReservoir(map, id, x, y, extra = {}) {
  const b = { id, type: 'reservoir', def: { kind: 'reservoir' }, x, y, size: 3, turn: 0, hasWater: true, ...extra };
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) map.building[map.idx(x + dx, y + dy)] = id;
  return b;
}

/** The canonical arms as masks: [connections, reservoirs]. */
function armMasks(arms) {
  let conn = 0;
  let res = 0;
  ARM_BITS.forEach((b, k) => {
    if (arms[k] !== '-') conn |= b;
    if (arms[k] === 'r') res |= b;
  });
  return [conn, res];
}

test('aqueducts3d: the piece a tile shows at every view turn is its map mask turned with the view', () => {
  // A plus, an L, a T, an end, a lone tile, and arms into a reservoir.
  const map = mapWith([[10, 10], [11, 10], [9, 10], [10, 9], [10, 11], [3, 3], [4, 3], [3, 4], [15, 15], [16, 15], [17, 15], [16, 16], [3, 20], [8, 17], [8, 18]]);
  const res = withReservoir(map, 50, 5, 17);
  const buildings = new Map([[50, res]]);
  let checked = 0;
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      if (!map.aqueduct[map.idx(x, y)]) continue;
      const m = aqueductMask(map, buildings, x, y);
      for (let vt = 0; vt < 4; vt++) {
        const p = aqueductPiece(map, buildings, x, y, vt, 'lime');
        const [conn, rs] = armMasks(p.arms);
        assert.equal(rotMask(conn, p.T), rotMask(m & 15, vt), `(${x}, ${y}) at turn ${vt}: ${p.arms}`);
        assert.equal(rotMask(rs, p.T), rotMask(m >> 4, vt), `(${x}, ${y}) reservoirs at turn ${vt}`);
        assert.equal(parseAqueductKey(p.key).arms, p.arms);
        checked++;
      }
    }
  }
  assert.ok(checked >= 60);
  assert.equal(aqueductPiece(map, buildings, 10, 10, 0, 'lime').arms, 'aaaa');
  assert.equal(aqueductPiece(map, buildings, 3, 20, 0, 'lime').arms, '----');
  // (8, 17) is beside the reservoir's east side (x 5..7): a stair down into it on its west.
  const into = aqueductPiece(map, buildings, 8, 17, 0, 'lime');
  assert.ok(into.arms.includes('r') && !into.road, into.arms);
  // The province picks the stone.
  assert.equal(aqueductLookOf('tufa'), 'tufa');
  assert.equal(aqueductLookOf('brick'), 'brick');
  assert.equal(aqueductLookOf('polygonal'), 'lime');
});

test('aqueducts3d: over a road, the road\'s arch, its line across the road at every view turn', () => {
  // An aqueduct along x at y = 8 over a road along y at x = 10.
  const aqs = [];
  for (let x = 6; x <= 14; x++) aqs.push([x, 8, 2]);
  const roads = [];
  for (let y = 2; y < 20; y++) roads.push([10, y]);
  const map = mapWith(aqs, roads);
  for (let vt = 0; vt < 4; vt++) {
    const p = aqueductPiece(map, NONE, 10, 8, vt, 'tufa');
    assert.ok(p.road && p.key === 'aqueduct:tufa:a-a-:road', p.key);
    // The straight is built along model x: turned T, along the view's u when T is even; the map's x is u at turns 0 and 2.
    assert.equal((p.T & 1) === 0, (vt & 1) === 0, `turn ${vt}`);
    assert.ok(!aqueductPiece(map, NONE, 9, 8, vt, 'tufa').road);
  }
  // A lone tile over a road along x: its line runs along y, across the road.
  const lone = mapWith([[5, 5]], [[4, 5], [5, 5], [6, 5]]);
  for (let vt = 0; vt < 4; vt++) {
    const p = aqueductPiece(lone, NONE, 5, 5, vt, 'lime');
    assert.ok(p.road && p.key === 'aqueduct:lime:----:road');
    assert.equal((p.T & 1) === 0, (vt & 1) === 1, `turn ${vt}`);
  }
  // The arch clears a cart: its crown over 3.5 m, its opening over 3 m wide.
  assert.ok(AQ.spring + AQ.roadSpan > 3.5 && AQ.roadSpan * 2 > 3);
});

test('aqueducts3d: full and dry: water and falls only while it runs, silt only dry, ice only on running water in a frost', () => {
  const map = mapWith([[5, 5, 2], [6, 5, 1]]);
  assert.equal(aqueductPiece(map, NONE, 5, 5, 0, 'lime').state, 'flowing');
  assert.equal(aqueductPiece(map, NONE, 6, 5, 0, 'lime').state, 'dry');
  for (const key of ['aqueduct:lime:a-a-', 'aqueduct:lime:ra--', 'aqueduct:lime:a-a-:road']) {
    const m = buildAqueductPiece(key, 0);
    const tags = (state, ice) => m.meshes.filter((x) => partShows(x.userData.when, state, ice)).map((x) => x.name);
    const flowing = tags('flowing', false);
    const dry = tags('dry', false);
    assert.ok(flowing.includes('water') && !flowing.includes('silt') && !flowing.includes('ice'), `${key}: ${flowing}`);
    assert.ok(dry.includes('silt') && !dry.includes('water') && !dry.includes('sheet') && !dry.includes('leak'), `${key}: ${dry}`);
    assert.ok(tags('flowing', true).includes('ice') && !tags('dry', true).includes('ice'), key);
    if (parseAqueductKey(key).arms.includes('r')) assert.ok(flowing.includes('sheet'), `${key}: the falls down its stair`);
  }
  const c = buildCastellum({ lod: 0 });
  const shows = (state, ice) => c.meshes.filter((x) => partShows(x.userData.when, state, ice)).map((x) => x.name);
  assert.ok(shows('flowing', false).includes('pool') && shows('flowing', false).includes('fall'));
  assert.ok(!shows('dry', false).includes('pool') && shows('dry', false).includes('puddle') && shows('dry', false).includes('silt'));
  assert.ok(shows('flowing', true).includes('ice') && !shows('dry', true).includes('ice'));
  // The frosty look: its dry puddle is ice.
  const frozen = buildCastellum({ lod: 0, ice: true }).meshes.find((x) => x.name === 'puddle');
  assert.equal(frozen.material.name, 'ice');
  // The reservoir's state from the sim's hasWater.
  assert.equal(MODELS.reservoir.variant({ id: null, hasWater: true }, { snow: 0 }, null).state, 'flowing');
  assert.equal(MODELS.reservoir.variant({ id: null, hasWater: false }, { snow: 3 }, null).key, 'reservoir:lime:ice');
});

/** Every (y, z) point (rounded to the millimetre) of the always-shown meshes at the plane x = at, after turning arm `a` to +x. */
function edgeSection(model, at, turnBack = 0) {
  const out = new Set();
  const m = new Matrix4().makeRotationY((turnBack * Math.PI) / 2);
  const v = new Vector3();
  for (const mesh of model.meshes) {
    if (mesh.userData.when !== 'always') continue;
    const p = mesh.geometry.attributes.position;
    for (let k = 0; k < p.count; k++) {
      v.set(p.getX(k), p.getY(k), p.getZ(k)).applyMatrix4(m);
      if (Math.abs(v.x - at) < 1e-4) out.add(`${v.y.toFixed(3)},${v.z.toFixed(3)}`);
    }
  }
  return out;
}

/** The bounding boxes of a section's points: [ymin, ymax, zmin, zmax] by height band, as a sorted string. */
function outline(section) {
  const ys = [...new Set([...section].map((s) => s.split(',')[0]))].sort();
  const zs = [...new Set([...section].map((s) => s.split(',')[1]))].sort();
  return `${ys.join(' ')} | ${zs.join(' ')}`;
}

test('aqueducts3d: the pieces meet at every edge: each arcade arm\'s section is the straight\'s; a stair meets the castellum\'s inlet', () => {
  const straight = outline(edgeSection(buildAqueductPiece('aqueduct:lime:a-a-', 0), AQ.half));
  for (const key of aqueductKeys('lime')) {
    const { arms, road } = parseAqueductKey(key);
    const m = buildAqueductPiece(key, 0);
    for (let a = 0; a < 4; a++) {
      // A road arch's line meets its neighbours on both ends whatever is there (an open end is closed by its own cap).
      const meets = arms[a] === 'a';
      if (!meets) continue;
      // Turned back so arm a lies along +x (a quarter turn takes +x to +z: undo a quarters).
      const s = outline(edgeSection(m, AQ.half, a));
      assert.equal(s, straight, `${key} arm ${a}${road ? ' (road)' : ''}`);
    }
  }
  // The stair's last step at the edge is the castellum inlet's channel where it starts (its footprint's edge).
  const stair = outline(edgeSection(buildAqueductPiece('aqueduct:lime:r---', 0), AQ.half));
  const inlet = outline(edgeSection(buildInlet({ lod: 0 }), RES.half));
  assert.equal(stair, inlet);
});

test('aqueducts3d: each piece fits its tile and stands on the ground; each level of detail lighter, in budget', () => {
  const budget = [2600, 2100, 2000];
  for (const key of aqueductKeys('tufa')) {
    const tris = [];
    for (let lod = 0; lod < 3; lod++) {
      const m = buildAqueductPiece(key, lod);
      m.group.updateMatrixWorld(true);
      const box = new Box3().setFromObject(m.group);
      assert.ok(box.min.y > -0.01 && box.max.y <= AQ_TOP + 1e-3, `${key} lod ${lod}: height ${box.min.y}..${box.max.y}`);
      // (The course and coping stand a few centimetres out of the faces, within the tile.)
      assert.ok(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) <= AQ.half + 1e-3, `${key} lod ${lod}: ${JSON.stringify(box)}`);
      tris.push(m.triangles);
      assert.ok(m.triangles < budget[lod], `${key} lod ${lod}: ${m.triangles}`);
    }
    assert.ok(tris[0] >= tris[1] && tris[1] >= tris[2], `${key}: ${tris}`);
  }
  // The arcade's run, the commonest piece, is light far out.
  assert.ok(buildAqueductPiece('aqueduct:lime:a-a-', 2).triangles < 300);
  assert.ok(AQ_TOP > 4.5 && AQ_TOP < 5.5, 'about the town wall\'s height');
});

test('aqueducts3d: the castellum fits its 3 x 3 footprint at every turn, each level lighter', () => {
  assert.ok(hasModel('reservoir') && hasModel('aqueduct'));
  const tris = [];
  for (let lod = 0; lod < 3; lod++) {
    const c = buildCastellum({ look: 'brick', lod });
    tris.push(c.triangles);
    c.group.updateMatrixWorld(true);
    const local = new Box3().setFromObject(c.group);
    for (let T = 0; T < 4; T++) {
      const b = local.clone().applyMatrix4(modelMatrix(10, 4, 3, T, 0));
      assert.ok(b.min.x >= 10 - 1e-6 && b.max.x <= 13 + 1e-6 && b.min.z >= 4 - 1e-6 && b.max.z <= 7 + 1e-6, `lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
    }
  }
  assert.ok(tris[0] > tris[1] && tris[1] > tris[2] && tris[0] < 16000 && tris[2] < 1500, `${tris}`);
});

test('aqueducts3d: a reservoir\'s inlets stand where its aqueducts reach it at every view turn; the one at its back runs into its house', () => {
  // A reservoir at (8, 8) with an aqueduct on each side and one at a corner tile of its north side.
  const map = mapWith([[11, 9, 2], [9, 11, 2], [7, 10, 1], [9, 7, 2], [8, 7, 2]]);
  const b = withReservoir(map, 9, 8, 8);
  const joins = reservoirJoins(map, b, () => false);
  assert.equal(joins.length, 5);
  // Map east (x + 3) is the model's +x face at turn 0; south (y + 3) its +z; west -x; north -z.
  const at = (x, y) => joins.find((j) => {
    const [lx, lz] = [[2, j.k], [-j.k, 2], [-2, -j.k], [j.k, -2]][j.side];
    return lx === x - 9 && lz === y - 9;
  });
  assert.ok(at(11, 9) && at(9, 11) && at(7, 10) && at(9, 7) && at(8, 7), JSON.stringify(joins));
  assert.equal(at(7, 10).state, 'dry');
  // The aqueduct at the middle of its back (north at turn 0) runs into the house.
  const more = reservoirMore({ map }, b, 'lime');
  const keys = more.map((m) => `${m.key}:${m.state}:${m.n}`);
  assert.ok(keys.includes('reservoir:lime:house:flowing:1') && keys.includes('reservoir:lime:inlet:flowing:3') && keys.includes('reservoir:lime:inlet:dry:1'), keys.join(' '));
  // Every inlet's outer end lands on the middle of the edge it shares with its aqueduct, at every view turn.
  const mid = new Vector3(RES.half, AQ.inlet, 0);
  for (let vt = 0; vt < 4; vt++) {
    const corners = [[8, 8], [11, 8], [8, 11], [11, 11]].map(([x, y]) => toView(x, y, vt, map.w, map.h));
    const vx = Math.min(...corners.map((c) => c[0]));
    const vy = Math.min(...corners.map((c) => c[1]));
    const M = modelMatrix(vx, vy, 3, vt, 0);
    for (const j of joins) {
      const [lx, lz] = [[2, j.k], [-j.k, 2], [-2, -j.k], [j.k, -2]][j.side];
      // The shared edge's middle on the map: from the footprint's middle toward the aqueduct's tile, 1.5 tiles.
      const ex = 9.5 + (Math.abs(lx) === 2 ? lx * 0.75 : lx);
      const ey = 9.5 + (Math.abs(lz) === 2 ? lz * 0.75 : lz);
      const [ux, uy] = toView(ex, ey, vt, map.w, map.h);
      const p = mid.clone().applyMatrix4(inletMatrix(j.side, j.k)).applyMatrix4(M);
      assert.ok(Math.abs(p.x - ux) < 1e-6 && Math.abs(p.z - uy) < 1e-6, `turn ${vt} join ${JSON.stringify(j)}: ${p.x},${p.z} not ${ux},${uy}`);
    }
  }
  // sideOf: each face's k as a quarter turn of the +x face's.
  assert.deepEqual(sideOf(2, -1), { side: 0, k: -1 });
  assert.deepEqual(sideOf(1, 2), { side: 1, k: -1 });
  assert.deepEqual(sideOf(-2, 1), { side: 2, k: -1 });
  assert.deepEqual(sideOf(1, -2), { side: 3, k: 1 });
  // An intake on its side on open water.
  const wet = mapWith([]);
  for (let y = 0; y < 24; y++) wet.terrain[wet.idx(4, y)] = Terrain.WATER;
  const w = withReservoir(wet, 3, 5, 5);
  const wj = reservoirJoins(wet, w, (x, y) => wet.terrain[wet.idx(x, y)] === Terrain.WATER);
  assert.deepEqual(wj, [{ side: 2, k: 0, kind: 'water' }]);
});

/** A renderer stand-in for aqueductGame.js: the game, the view turn and clock. */
function fakeRenderer(game, vt = 0) {
  return {
    game, viewTurn: vt, time: 0, pal: { snow: 0 },
    footAt(x, y) { return { vx: x, vy: y, wx: 0, wy: 0 }; },
  };
}

/** Every aqueduct tile and reservoir of a game as the pass's placed models. */
function placed(r) {
  const map = r.game.map;
  const out = [];
  for (let i = 0; i < map.size; i++) {
    if (!map.aqueduct[i]) continue;
    const a = aqueductModelPlace(r, map.xOf(i), map.yOf(i), i, map.xOf(i), map.yOf(i));
    out.push({ b: a.b, ...a.place });
  }
  for (const b of r.game.buildings.values()) if (b.type === 'reservoir') out.push({ b, T: 0, state: 0, snow: 0, vx: b.x, vy: b.y, rise: 0 });
  return out;
}

/** Instances drawn of each kit key at a level (its most shown part's count). */
function counts(mp, lod = 2) {
  const out = {};
  for (const k of mp.kits.values()) {
    if (k.lod !== lod) continue;
    const n = Math.max(0, ...k.meshes.map((im) => im.count));
    if (n) out[k.key] = n;
  }
  return out;
}

/** A reservoir on a shore and a run of aqueduct from it over open land: { game, res, run } or null. */
function shoreWorks(game) {
  const map = game.map;
  for (let y = 3; y < map.h - 6; y++) {
    for (let x = 3; x < map.w - 14; x++) {
      if (!map.isNearTerrain(x, y, 3, Terrain.WATER, 1)) continue;
      let free = true;
      const open = (tx, ty) => map.isFree(tx, ty) && map.terrain[map.idx(tx, ty)] !== Terrain.TREES;
      for (let dy = 0; dy < 3 && free; dy++) for (let dx = 0; dx < 3; dx++) if (!open(x + dx, y + dy)) free = false;
      // (The run east of it on dry land: an aqueduct beside the water would touch it too.)
      for (let dx = 3; dx < 10 && free; dx++) if (!open(x + dx, y + 1) || map.isNearTerrain(x + dx, y + 1, 1, Terrain.WATER, 1)) free = false;
      if (!free) continue;
      // (A building is placed by its middle tile.)
      build(game, 'reservoir', x + 1, y + 1);
      const res = [...game.buildings.values()].find((b) => b.type === 'reservoir' && b.x === x && b.y === y);
      if (!res) continue;
      build(game, 'aqueduct', x + 3, y + 1, x + 9, y + 1);
      updateWater(game);
      return { res, run: { x0: x + 3, x1: x + 9, y: y + 1 } };
    }
  }
  return null;
}

test('aqueducts3d: in the game\'s pass, aqueducts and reservoirs draw from shared kits, full or dry as the sim says', () => {
  const game = newGame({ seed: 'aqueducts3d' });
  const works = shoreWorks(game);
  assert.ok(works, 'a reservoir on a shore');
  const map = game.map;
  const { res, run } = works;
  assert.ok(res.hasWater);
  for (let x = run.x0; x <= run.x1; x++) assert.equal(map.aqueduct[map.idx(x, run.y)], 2, `(${x}, ${run.y}) carries water`);
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const r = fakeRenderer(game);
  mp.update(r, placed(r), 2);
  assert.equal(mp.stats.byType.aqueduct, run.x1 - run.x0 + 1);
  assert.equal(mp.stats.byType.reservoir, 1);
  const c = counts(mp);
  const look = parseAqueductKey(aqueductModelPlace(r, run.x0, run.y, map.idx(run.x0, run.y), 0, 0).b.key).look;
  // The stair into the reservoir, the straights, the end; the reservoir's inlet where the run meets it.
  assert.equal(c[`aqueduct:${look}:a-a-`], run.x1 - run.x0 - 1, JSON.stringify(c));
  assert.equal(c[`aqueduct:${look}:a-r-`], 1, JSON.stringify(c));
  assert.equal(c[`aqueduct:${look}:--a-`] || c[`aqueduct:${look}:a---`], 1, JSON.stringify(c));
  assert.ok(c[`reservoir:${look}:inlet`] >= 1, JSON.stringify(c));
  // Running: the channels' water parts drawn, their silt not.
  const kit = [...mp.kits.values()].find((k) => k.key === `aqueduct:${look}:a-a-` && k.lod === 2);
  const part = (name) => kit.meshes.find((im) => im.userData.part.geometry && im.userData.part.when === name);
  assert.ok(part('full').count > 0 && part('dry').count === 0);
  // The run cut off from the reservoir: the tiles beyond are dry, their silt shows.
  build(game, 'clear', run.x0, run.y, run.x0, run.y);
  updateWater(game);
  mp.update(r, placed(r), 2);
  assert.equal(mp.stats.byType.aqueduct, run.x1 - run.x0);
  assert.ok(part('dry').count > 0 && part('full').count === 0);
  // (The pass builds the levels either side in spare time: count this level's.)
  const at2 = () => [...mp.kits.values()].filter((k) => k.lod === 2).length;
  const kitsBefore = at2();
  mp.update(r, placed(r), 2);
  assert.equal(at2(), kitsBefore, 'nothing rebuilt when nothing changed');
  mp.dispose();
});

test('aqueducts3d: a new aqueduct rises; a dragged aqueduct\'s ghost shows each tile as the piece it would be', () => {
  const game = newGame({ seed: 'aqueducts3d-rise' });
  const map = game.map;
  noteAqueducts(map, 5);
  let spot = null;
  for (let y = 4; y < map.h - 8 && !spot; y++) {
    for (let x = 4; x < map.w - 8 && !spot; x++) {
      let ok = true;
      for (let d = 0; d < 6 && ok; d++) ok = map.isFree(x + d, y) && map.isFree(x, y + d) && map.terrain[map.idx(x + d, y)] === Terrain.GRASS && map.terrain[map.idx(x, y + d)] === Terrain.GRASS;
      if (ok) spot = { x, y };
    }
  }
  assert.ok(spot);
  build(game, 'aqueduct', spot.x, spot.y, spot.x + 2, spot.y);
  noteAqueducts(map, 6);
  const i = map.idx(spot.x, spot.y);
  const s0 = aqueductRise(map, i, 6);
  const s1 = aqueductRise(map, i, 6.25);
  assert.ok(s0 > 10 && s1 > 0 && s1 < s0, `${s0} ${s1}`);
  assert.equal(aqueductRise(map, i, 7), 0);
  // The ghost of an L dragged from a fresh spot: two ends and a corner among straights.
  const plan = { tool: 'aqueduct', kind: 'path', items: [] };
  const y0 = spot.y + 2;
  for (let x = spot.x; x < spot.x + 5; x++) plan.items.push({ x, y: y0, ok: true, exists: false });
  for (let y = y0 + 1; y < y0 + 4; y++) plan.items.push({ x: spot.x, y, ok: true, exists: false });
  const ghosts = aqueductGhosts(fakeRenderer(game), plan);
  assert.equal(ghosts.length, 8);
  const arms = ghosts.map((g) => parseAqueductKey(g.variant.key).arms);
  assert.equal(arms.filter((a) => a === 'a---').length, 2, arms.join(' '));
  assert.equal(arms.filter((a) => a === 'aa--').length, 1, arms.join(' '));
  assert.ok(ghosts.every((g) => g.variant.state === 'dry'));
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  mp.update(fakeRenderer(game), [], 2, ghosts);
  const ghosted = [...mp.kits.values()].flatMap((k) => (k.ghosts ? k.ghosts.ok : [])).filter(Boolean);
  assert.ok(ghosted.some((im) => im.count > 0));
  mp.dispose();
});
