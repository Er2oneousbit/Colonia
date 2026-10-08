/**
 * walls3d.test.mjs - the 3D town walls, gates and watchtower (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - every neighbour mask is one of the six pieces turned, and the piece a
 *     tile shows at every view turn is its map mask turned with the view
 *   - a gate's passage runs along its road at every turn
 *   - towers: round beside a gate on its line, square at corners whose runs
 *     go on (none on a staircase of corners), every INTERVAL tiles on a
 *     run but never near a gate or another tower; stubs into a Turris
 *   - damage levels from the sim's hit points
 *   - the pieces meet seamlessly: every piece's section at the tile's edge
 *     is the straight wall's, at every quarter turn; each fits its tile
 *     and stands on the ground; each level of detail lighter, in budget
 *   - the province picks the stone
 *   - in the game's pass: walls built, damaged, broken and cleared change
 *     the instances, from shared kits; a gate shuts with an enemy near;
 *     a new wall rises; the Turris shows its archers while manned
 *   - a dragged wall's ghost shows the pieces it would build
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Group, Box3, Vector3 } from 'three';
import { GameMap, Wall } from '../src/world/map.js';
import { rotMask } from '../src/render/view.js';
import { CANON, INTERVAL, shapeOf, wallMask, wallPiece, towerOf, gateAxis, damageLevel, wallLookOf, parseWallKey } from '../src/render3d/walls/wallLayout.js';
import { buildWallPiece, wallKeys, WALL, WALL_TOP } from '../src/render3d/models/townWall.js';
import { buildTurris, TURRIS } from '../src/render3d/models/turris.js';
import { MODELS, hasModel, modelMatrix, modelLamps, partShows } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import { wallModelPlace, wallGhosts, gateShut, wallRise, noteWalls, gateTorchPoints, wallCoverSpec } from '../src/render3d/walls/wallGame.js';
import { damageWall, wallHpOf } from '../src/sim/damage.js';
import { newGame, build, findFree } from './helpers.mjs';

/** A blank map with walls at the given tiles ([x, y, kind]) and roads. */
function mapWith(walls, roads = []) {
  const map = new GameMap(24, 24);
  for (const [x, y, k = Wall.WALL] of walls) map.wall[map.idx(x, y)] = k;
  for (const [x, y] of roads) map.road[map.idx(x, y)] = 1;
  return map;
}
const NONE = new Map();

test('walls3d: every mask is one of the six pieces turned', () => {
  for (let m = 0; m < 16; m++) {
    const { shape, T } = shapeOf(m);
    assert.equal(rotMask(CANON[shape], T), m, `mask ${m}`);
  }
});

test('walls3d: the piece a tile shows at every view turn is its map mask turned with the view', () => {
  // A plus, an L, a T and an end: every shape.
  const map = mapWith([[10, 10], [11, 10], [9, 10], [10, 9], [10, 11], [5, 5], [6, 5], [5, 6], [15, 15], [16, 15], [17, 15], [16, 16], [3, 20]]);
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      if (!map.wall[map.idx(x, y)]) continue;
      const m = wallMask(map, NONE, x, y);
      for (let vt = 0; vt < 4; vt++) {
        const p = wallPiece(map, NONE, x, y, vt, 'polygonal');
        assert.equal(rotMask(CANON[p.shape], p.T), rotMask(m, vt), `(${x}, ${y}) at turn ${vt}`);
        assert.equal(parseWallKey(p.key).shape, p.shape);
      }
    }
  }
  assert.equal(wallPiece(map, NONE, 10, 10, 0, 'polygonal').shape, 'cross');
  assert.equal(wallPiece(map, NONE, 5, 5, 0, 'polygonal').shape, 'corner');
  assert.equal(wallPiece(map, NONE, 16, 15, 0, 'polygonal').shape, 'tee');
  assert.equal(wallPiece(map, NONE, 3, 20, 0, 'polygonal').shape, 'lone');
  assert.equal(wallPiece(map, NONE, 17, 15, 0, 'polygonal').shape, 'end');
});

test('walls3d: a gate\'s passage runs along its road at every view turn', () => {
  // A wall along x crossing a road along y at (10, 8).
  const walls = [];
  for (let x = 6; x <= 14; x++) walls.push([x, 8, x === 10 ? Wall.GATE : Wall.WALL]);
  const roads = [];
  for (let y = 2; y < 20; y++) roads.push([10, y]);
  const map = mapWith(walls, roads);
  assert.equal(gateAxis(map, NONE, 10, 8), 'x');
  for (let vt = 0; vt < 4; vt++) {
    const p = wallPiece(map, NONE, 10, 8, vt, 'tufa');
    assert.ok(p.gate && p.key === 'wall:tufa:gate:0');
    // The canonical gate's wall runs along model x: turned T, along view u when T is even.
    const wallAlongU = (p.T & 1) === 0;
    // The map's x axis is the view's u at turns 0 and 2.
    assert.equal(wallAlongU, (vt & 1) === 0, `turn ${vt}`);
  }
  // A gate on its own, its road along x: its wall runs along y.
  const lone = mapWith([[5, 5, Wall.GATE]], [[4, 5], [5, 5], [6, 5]]);
  assert.equal(gateAxis(lone, NONE, 5, 5), 'y');
});

test('walls3d: towers flank gates, stand at corners and along runs, never crowded', () => {
  const walls = [];
  // A long run along x at y = 8 from 1 to 22, a gate at 6 across a road, a west wall down from (1, 8).
  for (let x = 1; x <= 22; x++) walls.push([x, 8, x === 6 ? Wall.GATE : Wall.WALL]);
  for (let y = 9; y <= 20; y++) walls.push([1, y]);
  const roads = [];
  for (let y = 0; y < 24; y++) roads.push([6, y]);
  const map = mapWith(walls, roads);
  const tw = (x, y) => towerOf(map, NONE, x, y, wallMask(map, NONE, x, y));
  assert.equal(tw(5, 8), 'round');
  assert.equal(tw(7, 8), 'round');
  assert.equal(tw(1, 8), 'square', 'a corner whose runs go on');
  // Along the run, only at INTERVAL / 2 modulo INTERVAL, and not within two tiles of the gate.
  const along = [];
  for (let x = 2; x <= 21; x++) if (tw(x, 8) === 'square') along.push(x);
  assert.deepEqual(along, along.filter((x) => x % INTERVAL === INTERVAL / 2));
  assert.ok(along.includes(12), JSON.stringify(along));
  assert.ok(!along.includes(20), 'two tiles from the end of the run: none');
  assert.ok(!along.includes(4), 'two tiles from the gate: none');
  // A staircase of corners (a wall dragged on a diagonal): no towers.
  const stairs = mapWith([[3, 3], [4, 3], [4, 4], [5, 4], [5, 5], [6, 5], [6, 6]]);
  for (const [x, y] of [[4, 3], [4, 4], [5, 4], [5, 5], [6, 5]]) assert.equal(towerOf(stairs, NONE, x, y, wallMask(stairs, NONE, x, y)), null, `(${x}, ${y})`);
});

test('walls3d: a wall runs into a watchtower beside it by a stub', () => {
  const map = mapWith([[5, 8], [6, 8], [7, 8]]);
  const turris = { id: 3, type: 'tower', def: { kind: 'tower' }, x: 8, y: 7, size: 2 };
  for (const [x, y] of [[8, 7], [9, 7], [8, 8], [9, 8]]) map.building[map.idx(x, y)] = 3;
  const b = new Map([[3, turris]]);
  assert.equal(wallMask(map, b, 7, 8), 2 | 8);
  for (let vt = 0; vt < 4; vt++) assert.deepEqual(wallPiece(map, b, 7, 8, vt, 'ashlar').stubs, [rotMask(2, vt)]);
  assert.deepEqual(wallPiece(map, b, 6, 8, 0, 'ashlar').stubs, []);
});

test('walls3d: damage follows the sim\'s hit points', () => {
  assert.equal(damageLevel(220, 220), 0);
  assert.equal(damageLevel(110, 220), 0);
  assert.equal(damageLevel(109, 220), 1);
  assert.equal(damageLevel(55, 220), 1);
  assert.equal(damageLevel(54, 220), 2);
  const map = mapWith([[5, 5], [6, 5]]);
  assert.equal(wallPiece(map, NONE, 5, 5, 0, 'brick', { hp: 40, max: 220 }).key, 'wall:brick:end:2');
});

test('walls3d: the province picks the stone', () => {
  const g = (site, type = 'river') => ({ scenario: { site, map: { type } } });
  assert.equal(wallLookOf(g('cosa')), 'polygonal');
  assert.equal(wallLookOf(g('etruria')), 'polygonal');
  assert.equal(wallLookOf(g('puteoli')), 'tufa');
  assert.equal(wallLookOf(g('mutina')), 'brick');
  assert.equal(wallLookOf(g('paestum')), 'ashlar');
  assert.equal(wallLookOf(g('narbo')), 'ashlar');
  assert.equal(wallLookOf(g('cosa', 'desert')), 'ashlar');
  assert.equal(wallLookOf({}), 'polygonal');
});

/** The (y, across) points of a geometry's vertices on the plane x = X (to a millimetre), as a sorted list of strings. */
function sectionAt(group, X, matrix = null) {
  const out = new Set();
  const v = new Vector3();
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    if (!o.isMesh || o.name === 'rubble' || o.name === 'crack') return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      if (matrix) v.applyMatrix4(matrix);
      if (Math.abs(v.x - X) < 1e-4) out.add(`${o.name}:${v.y.toFixed(3)},${v.z.toFixed(3)}`);
    }
  });
  return [...out].sort();
}

test('walls3d: the pieces meet seamlessly: every arm\'s section at the tile\'s edge is the straight wall\'s', () => {
  for (const lod of [0, 1, 2]) {
    const straight = buildWallPiece('wall:polygonal:straight:0', lod);
    const ref = sectionAt(straight.group, WALL.half);
    assert.ok(ref.length > 8, `lod ${lod}: a section`);
    assert.deepEqual(sectionAt(straight.group, -WALL.half).map((s) => s), ref.map((s) => s), `lod ${lod}: both ends of a straight`);
    for (const key of ['wall:polygonal:corner:0', 'wall:polygonal:tee:0', 'wall:polygonal:cross:0', 'wall:polygonal:end:0', 'wall:polygonal:straight+square:0', 'wall:polygonal:corner+round:0']) {
      const piece = buildWallPiece(key, lod);
      const { shape } = parseWallKey(key);
      // Each arm turned onto +x: its section at the edge.
      for (let T = 0; T < 4; T++) {
        if (!(rotMask(CANON[shape], -T & 3) & 2)) continue;
        // (Turn the piece so that this arm points +x: a quarter turn back T times.)
        const g = new Group();
        g.add(piece.group.clone());
        g.rotation.y = (T * Math.PI) / 2;
        assert.deepEqual(sectionAt(g, WALL.half), ref, `${key} lod ${lod} arm ${T}`);
      }
    }
  }
});

test('walls3d: every piece fits its tile (towers\' eaves a little over), stands on the ground, lighter at each level, in budget', () => {
  const budget = [8000, 2500, 900];
  for (const key of wallKeys('polygonal')) {
    const tris = [];
    for (let lod = 0; lod < 3; lod++) {
      const m = buildWallPiece(key, lod);
      const box = new Box3().setFromObject(m.group);
      const { shape, tower, damage } = parseWallKey(key);
      // (Rubble falls a little past the tile, onto its neighbours.)
      const reach = (shape === 'stub' ? 3.3 : tower ? 2.3 : 2.0) + (damage ? 1.05 : 0);
      assert.ok(box.min.y > -1.2 && box.max.y < 10, `${key} lod ${lod}: height ${box.min.y}..${box.max.y}`);
      assert.ok(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) <= reach, `${key} lod ${lod}: ${JSON.stringify(box)}`);
      tris.push(m.triangles);
      assert.ok(m.triangles < budget[lod], `${key} lod ${lod}: ${m.triangles}`);
    }
    assert.ok(tris[0] >= tris[1] && tris[1] >= tris[2], `${key}: ${tris}`);
  }
  const t = [0, 1, 2].map((lod) => buildTurris({ lod }).triangles);
  assert.ok(t[0] > t[1] && t[1] > t[2] && t[0] < 40000 && t[2] < 3000, `turris ${t}`);
  // The curtain's top, the gate's and the towers': a wall two storeys to its walk.
  assert.ok(WALL.walk > 3 && WALL_TOP > 4.8 && WALL_TOP < 5.6);
});

test('walls3d: the Turris fits its 2 x 2 footprint at every turn, its archers out while manned, its torches lit then', () => {
  assert.ok(hasModel('tower'));
  for (let lod = 0; lod < 3; lod++) {
    const g = MODELS.tower.build('tower:tufa', lod);
    g.updateMatrixWorld(true);
    const local = new Box3().setFromObject(g);
    for (let T = 0; T < 4; T++) {
      const b = local.clone().applyMatrix4(modelMatrix(10, 4, 2, T, 0));
      assert.ok(b.min.x >= 10 - 1e-6 && b.max.x <= 12 + 1e-6 && b.min.z >= 4 - 1e-6 && b.max.z <= 6 + 1e-6, `lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
    }
  }
  // A wall's stub meets the tower's face: it reaches past the footprint's edge to the stone.
  assert.ok(TURRIS.body > WALL.half - 1 + WALL.hw - 1e-6, 'the tower is as wide as a wall\'s two faces on a tile\'s line');
  const manned = MODELS.tower.variant({ efficiency: 1 }, {}, null);
  const idle = MODELS.tower.variant({ efficiency: 0 }, {}, null);
  assert.equal(manned.state, 'open');
  assert.equal(idle.state, 'shut');
  const kit = kitOf(MODELS.tower.build(manned.key, 0));
  const open = kit.parts.filter((p) => p.when === 'open');
  assert.ok(open.length >= 1, 'the open door');
  assert.ok(open.every((p) => !partShows(p.when, 'shut', false)));
  // The crew are actors (turris.js turrisActors): archers shooting from the gallery, a sentry pacing it, while manned.
  const crew = manned.actors.actors;
  assert.ok(crew.filter((a) => a.clipName === 'shoot').length >= 2 && crew.some((a) => a.routeLength > 0), 'the archers and the sentry');
  for (const a of crew) assert.ok(Math.abs(a.at[1] - (TURRIS.gallery + 0.08)) < 1e-6, 'on the gallery\'s planks');
  assert.equal(idle.actors.actors.length, 0);
  assert.deepEqual(modelLamps({ type: 'tower', size: 2, efficiency: 0 }, 0), []);
  for (let T = 0; T < 4; T++) assert.equal(modelLamps({ type: 'tower', size: 2, efficiency: 1 }, T).length, 1, `one torch in view at turn ${T}`);
});

/** A renderer stand-in for wallGame.js: the game, the view turn and clock. */
function fakeRenderer(game, vt = 0) {
  return {
    game, viewTurn: vt, time: 0, pal: { snow: 0 },
    footAt(x, y) { return { vx: x, vy: y, wx: 0, wy: 0 }; },
  };
}

/** Every wall tile of a game as the pass's placed models. */
function placed(r) {
  const map = r.game.map;
  const out = [];
  for (let i = 0; i < map.size; i++) {
    if (!map.wall[i]) continue;
    const w = wallModelPlace(r, map.xOf(i), map.yOf(i), i, map.xOf(i), map.yOf(i));
    out.push({ b: w.b, ...w.place });
  }
  return out;
}

/** Instances drawn of each kit key at a level. */
function counts(mp, lod = 2) {
  const out = {};
  for (const k of mp.kits.values()) {
    if (k.lod !== lod) continue;
    const n = Math.max(0, ...k.meshes.map((im) => im.count));
    if (n) out[k.key] = n;
  }
  return out;
}

test('walls3d: in the game\'s pass, walls built, damaged, broken and cleared change the instances, from shared kits', () => {
  const game = newGame({ seed: 'walls3d' });
  const spot = findFree(game, 10, 3, { x: 32, y: 32 });
  assert.ok(spot);
  const y = spot.y + 1;
  build(game, 'wall', spot.x, y, spot.x + 9, y);
  const map = game.map;
  let n = 0;
  for (let i = 0; i < map.size; i++) if (map.wall[i]) n++;
  assert.equal(n, 10);
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const r = fakeRenderer(game);
  mp.update(r, placed(r), 2);
  let c = counts(mp);
  const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(total(c), 10, JSON.stringify(c));
  assert.equal(mp.stats.byType.wall, 10);
  const look = wallLookOf(game);
  assert.equal(c[`wall:${look}:end:0`], 2, 'two ends');
  // (Kits at the level drawn: the pass also builds the next level of a kit in view when a frame has
  // time left (modelPass.js prefetch), so the count of every level depends on how fast the machine is.)
  const drawnKits = () => [...mp.kits.values()].filter((k) => k.lod === 2).length;
  const kitsBefore = drawnKits();
  // Raiders batter a tile: under half its hit points it shows cracked; under a quarter, breaching.
  const i = map.idx(spot.x + 3, y);
  damageWall(game, i, 120);
  mp.update(r, placed(r), 2);
  c = counts(mp);
  assert.equal(Object.keys(c).filter((k) => k.endsWith(':1')).length, 1, JSON.stringify(c));
  damageWall(game, i, 60);
  mp.update(r, placed(r), 2);
  c = counts(mp);
  assert.equal(Object.keys(c).filter((k) => k.endsWith(':2')).length, 1, JSON.stringify(c));
  assert.equal(wallHpOf(game, i).hp, 40);
  // Broken through: the tile is gone (rubble on the ground, the 3D ground's), its neighbours become ends.
  damageWall(game, i, 100);
  assert.equal(map.wall[i], Wall.NONE);
  assert.equal(map.rubble[i], 1);
  mp.update(r, placed(r), 2);
  c = counts(mp);
  assert.equal(total(c), 9);
  assert.equal(c[`wall:${look}:end:0`], 4, JSON.stringify(c));
  // Cleared: fewer again; the kits shared, none built for each tile.
  build(game, 'clear', spot.x, y, spot.x + 2, y);
  mp.update(r, placed(r), 2);
  assert.equal(total(counts(mp)), 6);
  assert.ok(drawnKits() <= kitsBefore + 4, `${drawnKits()} kits`);
  mp.dispose();
});

test('walls3d: a gate shuts while an enemy is near; a new wall rises; its torches face the view', () => {
  const game = newGame({ seed: 'walls3d-gate' });
  const map = game.map;
  // A gate wherever a wall is dragged across the Imperial road.
  let gate = null;
  for (let i = 0; i < map.size && !gate; i++) {
    const x = map.xOf(i);
    const yy = map.yOf(i);
    if (!map.road[i] || x < 4 || yy < 4 || x > map.w - 5 || yy > map.h - 5) continue;
    if (map.hasRoad(x, yy - 1) && map.hasRoad(x, yy + 1) && !map.hasRoad(x - 1, yy) && !map.hasRoad(x + 1, yy) && map.isFree(x - 1, yy) && map.isFree(x + 1, yy)) gate = { x, y: yy };
  }
  assert.ok(gate, 'a straight piece of road');
  build(game, 'wall', gate.x - 1, gate.y, gate.x + 1, gate.y);
  assert.equal(map.wall[map.idx(gate.x, gate.y)], Wall.GATE);
  const r = fakeRenderer(game);
  const at = () => wallModelPlace(r, gate.x, gate.y, map.idx(gate.x, gate.y), gate.x, gate.y).b.state;
  assert.equal(at(), 'open');
  game.units.set(999, { id: 999, side: 'enemy', x: gate.x + 3, y: gate.y + 2, hp: 10 });
  game.time.totalTicks += 1;
  assert.equal(gateShut(game, gate.x, gate.y), true);
  assert.equal(at(), 'shut');
  game.units.delete(999);
  game.time.totalTicks += 1;
  assert.equal(at(), 'open');
  // The flanking towers beside it on its line.
  assert.ok(wallModelPlace(r, gate.x - 1, gate.y, map.idx(gate.x - 1, gate.y), 0, 0).b.key.includes('+round'));
  // Rising: a wall built after the map was first seen sinks and comes up over half a second.
  const j = map.idx(gate.x + 1, gate.y);
  wallRise(map, j, 10); // (seen)
  const spot = findFree(game, 3, 1, gate);
  build(game, 'wall', spot.x, spot.y, spot.x + 2, spot.y);
  const k = map.idx(spot.x, spot.y);
  const s0 = wallRise(map, k, 20);
  const s1 = wallRise(map, k, 20.25);
  const s2 = wallRise(map, k, 21);
  assert.ok(s0 > 10 && s1 > 0 && s1 < s0 && s2 === 0, `${s0} ${s1} ${s2}`);
  assert.equal(wallRise(map, j, 20), 0, 'an old wall does not rise again');
  // The torches the night lights: two, on the face the view sees, near the tile.
  for (let vt = 0; vt < 4; vt++) {
    const pts = gateTorchPoints(fakeRenderer(game, vt), gate.x, gate.y);
    assert.equal(pts.length, 2);
    for (const [u, v, z] of pts) assert.ok(Math.abs(u - gate.x - 0.5) < 0.7 && Math.abs(v - gate.y - 0.5) < 0.7 && z > 20 && z < 40, `${u} ${v} ${z}`);
  }
});

test('walls3d: a dragged wall\'s ghost shows each tile as the piece it would be', () => {
  const game = newGame({ seed: 'walls3d-ghost' });
  const spot = findFree(game, 6, 6, { x: 30, y: 30 });
  const plan = { tool: 'wall', kind: 'path', items: [] };
  for (let x = spot.x; x < spot.x + 5; x++) plan.items.push({ x, y: spot.y, ok: true, exists: false, gate: false });
  for (let yy = spot.y + 1; yy < spot.y + 5; yy++) plan.items.push({ x: spot.x, y: yy, ok: true, exists: false, gate: false });
  const ghosts = wallGhosts(fakeRenderer(game), plan);
  assert.equal(ghosts.length, 9);
  const keys = ghosts.map((g) => parseWallKey(g.variant.key));
  assert.equal(keys.filter((k) => k.shape === 'end').length, 2);
  assert.equal(keys.filter((k) => k.shape === 'corner').length, 1);
  assert.ok(keys.find((k) => k.shape === 'corner').tower === 'square', 'the corner\'s runs go on: a tower');
  // Drawn by the pass as see-through copies of the same kits.
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  mp.update(fakeRenderer(game), [], 2, ghosts);
  const ghosted = [...mp.kits.values()].flatMap((k) => (k.ghosts ? k.ghosts.ok : [])).filter(Boolean);
  assert.ok(ghosted.length > 0 && ghosted.some((im) => im.count > 0));
  mp.dispose();
});

test('walls3d: a wall\'s click cover is as tall as its model', () => {
  const spec = wallCoverSpec({ shape: 'straight', T: 0, tower: null, gate: false });
  const tower = wallCoverSpec({ shape: 'straight', T: 0, tower: 'square', gate: false });
  // Art px a metre: 9.8 (render3d/projection.js): the wall's merlons stand about 51 px.
  assert.ok(spec.ay > 48 && spec.ay < 56, spec.ay);
  assert.ok(tower.ay > spec.ay + 30, tower.ay);
});

test('walls3d: the first wall a game shows rises too (the layer noted every frame, walls in view or not)', () => {
  const game = newGame({ seed: 'walls3d-first' });
  const map = game.map;
  noteWalls(map, 5);
  const spot = findFree(game, 3, 1, { x: 30, y: 30 });
  build(game, 'wall', spot.x, spot.y, spot.x + 2, spot.y);
  noteWalls(map, 6);
  assert.ok(wallRise(map, map.idx(spot.x, spot.y), 6.1) > 0);
  assert.equal(wallRise(map, map.idx(spot.x, spot.y), 7), 0);
});

test('walls3d: a gate reaches a watchtower on its line by a stub; a planned gate flanks itself in the ghost', () => {
  const map = mapWith([[5, 8], [6, 8, Wall.GATE]], [[6, 7], [6, 8], [6, 9]]);
  for (const [x, y] of [[7, 7], [8, 7], [7, 8], [8, 8]]) map.building[map.idx(x, y)] = 3;
  const b = new Map([[3, { id: 3, type: 'tower', def: { kind: 'tower' }, x: 7, y: 7, size: 2 }]]);
  for (let vt = 0; vt < 4; vt++) assert.deepEqual(wallPiece(map, b, 6, 8, vt, 'tufa').stubs, [rotMask(2, vt)], `turn ${vt}`);
  // A wall dragged across a road: the plan's gate gets its round towers in the ghost, as when built.
  const game = newGame({ seed: 'walls3d-ghostgate' });
  const m = game.map;
  let at = null;
  for (let i = 0; i < m.size && !at; i++) {
    const x = m.xOf(i);
    const y = m.yOf(i);
    if (m.road[i] && m.hasRoad(x, y - 1) && m.hasRoad(x, y + 1) && !m.hasRoad(x - 1, y) && !m.hasRoad(x + 1, y) && m.isFree(x - 1, y) && m.isFree(x + 1, y)) at = { x, y };
  }
  const plan = { tool: 'wall', kind: 'path', items: [-1, 0, 1].map((d) => ({ x: at.x + d, y: at.y, ok: true, exists: false, gate: d === 0 })) };
  const ghosts = wallGhosts(fakeRenderer(game), plan);
  assert.deepEqual(ghosts.map((g) => parseWallKey(g.variant.key).tower), ['round', null, 'round']);
  assert.equal(parseWallKey(ghosts[1].variant.key).shape, 'gate');
});
