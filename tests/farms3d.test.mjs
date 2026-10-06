/**
 * farms3d.test.mjs - the 3D farms' and granary's looks (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * The WebGL back end draws the farms and the granary as models
 * (render3d/models/farm.js, granary.js); the browser smoke test checks they
 * draw and pick. These cover what decides how they look:
 *   - a farm's look from the sim: its step (growth), resting for the winter,
 *     idle, the ranch's herd, a pig farm's pigs, the trees' season
 *   - a farm's kits change only when its look does (no rebuild a day), and
 *     its animals move by their matrices alone
 *   - the granary's places filled by its stock, food by food, from empty to
 *     full, never more than its capacity's share
 *   - every farm kind and the granary, at every step, condition, level of
 *     detail and view turn, stays inside its 3 x 3 footprint and stands on
 *     the ground; each level is lighter than the one before
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Matrix4, Vector3, Box3 } from 'three';
import { MODELS, modelFor, modelMatrix, hasModel, modelLamps, TILE_M } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { farmStep, farmLook, farmParts, fruitOf, pigCount, horsesOut, dressStep, FARM_KIND, moveAnimals } from '../src/render3d/models/farm.js';
import { granaryStock, granaryParts, STOCK_SLOTS, GRANARY_FOODS, GRANARY } from '../src/render3d/models/granary.js';
import { treeLookOf } from '../src/render3d/models/orchard.js';
import { TREE_SPOTS } from '../src/render3d/models/farmKinds.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { CONFIG } from '../src/config.js';

const FARMS = Object.keys(FARM_KIND);

test('farms3d: every farm and the granary have a model; a farm needs the 3D ground for its field', () => {
  for (const t of [...FARMS, 'granary']) assert.ok(hasModel(t), t);
  for (const t of FARMS) assert.equal(MODELS[t].needsGround, true, t);
  assert.ok(!MODELS.granary.needsGround);
  // Every farm type of the game is one of them (a new farm would need a model, or keeps its sprite).
  for (const [type, def] of Object.entries(BUILDINGS)) if (def.kind === 'farm') assert.ok(FARMS.includes(type), type);
});

test('farms3d: the field\'s step by fifths of its progress, as the 2D art reads it; fruit as it ripens', () => {
  assert.deepEqual([0, 19.9, 20, 39, 40, 59, 60, 79, 80, 99.9, 100].map(farmStep), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4]);
  assert.equal(farmStep(undefined), 0);
  assert.deepEqual([0, 1, 2, 3, 4].map(fruitOf), [0, 0, 0, 1, 2]);
});

test('farms3d: a farm\'s look from the sim: step, resting, idle, herd, pigs, the season', () => {
  const b = (type, progress, efficiency = 1, herd) => ({ type, progress, efficiency, herd });
  // Worked, ripe, summer.
  let l = farmLook(b('farm_fruit', 90), { month: 6 });
  assert.deepEqual({ kind: l.kind, step: l.step, cond: l.cond, tree: l.tree, fruit: l.fruit }, { kind: 'orchard', step: 4, cond: 'n', tree: 'leaf', fruit: 2 });
  // No workers: idle, whatever the season says.
  l = farmLook(b('farm_wheat', 50, 0), { resting: true, month: 0 });
  assert.equal(l.cond, 'i');
  // Resting for the winter (Insane): no harvest scene, no fruit, bare trees.
  l = farmLook(b('farm_vine', 90), { resting: true, month: 0 });
  assert.deepEqual([l.cond, l.fruit, l.tree], ['r', 0, 'bare']);
  // A ranch's horses are its herd; half in the stable in a winter's rest; at least one.
  assert.equal(farmLook(b('horse_ranch', 0, 1, 6)).horses, 6);
  assert.equal(farmLook(b('horse_ranch', 0, 1, 7), { resting: true }).horses, 4);
  assert.equal(horsesOut(0, 'n'), 1);
  // A pig farm's pigs grow with its step (as the 2D art's); two in a winter's rest.
  assert.deepEqual([0, 1, 2, 3, 4].map((s) => pigCount(s, 'n')), [2, 4, 6, 8, 10]);
  assert.equal(pigCount(4, 'r'), 2);
  // The trees' look by month: winter bare, spring blossom, summer leaf, autumn colour; seasons off: summer.
  assert.deepEqual([11, 0, 1, 2, 3, 4, 8, 9, 10, null].map(treeLookOf), ['bare', 'bare', 'bare', 'blossom', 'blossom', 'leaf', 'leaf', 'autumn', 'autumn', 'leaf']);
});

test('farms3d: a farm\'s kits change only when its look does, not with each day\'s growth', () => {
  const def = MODELS.farm_olive;
  const ctx = { game: null, month: 6, frame: 1, clock: 0 };
  const b = { id: 41, type: 'farm_olive', progress: 61, efficiency: 1 };
  const v1 = def.variant(b, {}, ctx);
  // A day's growth within the same step: the very same list (nothing rebuilt).
  b.progress = 66;
  ctx.frame = 2;
  const v2 = def.variant(b, {}, ctx);
  assert.equal(v2.more, v1.more);
  // Past a step: a new look.
  b.progress = 81;
  const v3 = def.variant(b, {}, ctx);
  assert.notEqual(v3.more, v1.more);
  assert.ok(v3.more.some((m) => m.key.startsWith('dress:olive:4')));
  // Each kit key is one the pass can build.
  for (const m of [...v3.more, { key: v3.key }]) assert.ok(modelFor(m.key), m.key);
  // A few kinds look alike at several steps: fewer kits.
  assert.equal(dressStep('olive', 1), dressStep('olive', 3));
  assert.notEqual(dressStep('wheat', 1), dressStep('wheat', 3));
});

test('farms3d: the animals move by their matrices alone, and stay in their pen', () => {
  const look = { kind: 'sty', step: 4, cond: 'n', tree: 'leaf', fruit: 0, pigs: 10, horses: 0 };
  const fp = farmParts(look, 3);
  const a = fp.animals;
  assert.equal(a.n, 10);
  const keys = fp.more.map((m) => m.key);
  const at = (t) => {
    moveAnimals(a, t);
    let n = 0;
    const pts = [];
    for (const e of a.slots) {
      n += e.n;
      for (let j = 0; j < e.n; j++) pts.push(new Vector3().setFromMatrixPosition(new Matrix4().fromArray(e.mats, j * 16)));
    }
    return { n, pts };
  };
  const s0 = at(0);
  const s1 = at(40);
  assert.equal(s0.n, 10);
  assert.equal(s1.n, 10);
  assert.deepEqual(fp.more.map((m) => m.key), keys, 'the same kits, only their matrices move');
  assert.ok(s0.pts.some((p, i) => p.distanceTo(s1.pts[i]) > 0.05), 'some pig has walked on in 40 s');
  // Every pig inside the pen's fence at every moment.
  for (let t = 0; t < 600; t += 7.3) {
    for (const p of at(t).pts) assert.ok(p.x > -2.0 && p.x < 5.52 && p.z > -5.4 && p.z < 5.52, `pig at ${p.x}, ${p.z}`);
  }
});

test('farms3d: the granary\'s places fill with its stock, food by food, round its four sides', () => {
  const N = STOCK_SLOTS.length;
  const cap = CONFIG.GRANARY_CAPACITY;
  const filled = (s) => granaryStock(s, cap).reduce((a, f) => a + f.n, 0);
  assert.equal(N, 20);
  assert.equal(filled({}), 0, 'empty: nothing on the platform');
  assert.equal(filled({ wheat: cap }), N, 'full: every place');
  assert.equal(filled({ wheat: cap / 2 }), N / 2);
  assert.equal(filled({ wheat: cap / 4, fish: cap / 4 }), N / 2);
  // A place is a cart's load (capacity / 20): one load shows one place.
  assert.equal(filled({ meat: cap / N }), 1);
  // Each food in proportion, every food held shows.
  const f = granaryStock({ wheat: 1000, vegetables: 400, fruit: 400, meat: 300, fish: 300 }, cap);
  assert.deepEqual(f.map((x) => x.food), [...GRANARY_FOODS]);
  assert.ok(f.every((x) => x.n >= 1));
  assert.equal(f.reduce((a, x) => a + x.n, 0), N);
  assert.ok(f[0].n > f[1].n && f[0].n >= 8);
  // A little of a second food still shows beside a lot of the first.
  const small = granaryStock({ wheat: 1100, fish: 20 }, cap);
  assert.equal(small.find((x) => x.food === 'fish').n, 1);
  // Never more than the places, whatever the stock (an older save over capacity).
  assert.equal(filled({ wheat: cap * 3 }), N);
  // The places a half-full granary fills are spread round all four sides (each side shows its share).
  const more = granaryParts(granaryStock({ wheat: cap / 2 }, cap));
  const sides = new Set();
  for (const m of more) for (let j = 0; j < m.n; j++) {
    const p = new Vector3().setFromMatrixPosition(new Matrix4().fromArray(m.mats, j * 16));
    sides.add(Math.abs(p.x) > Math.abs(p.z) ? (p.x > 0 ? '+x' : '-x') : (p.z > 0 ? '+z' : '-z'));
  }
  assert.equal(sides.size, 4);
});

test('farms3d: the granary\'s look follows its staff; its lantern lights only while staffed', () => {
  const ctx = { frame: 1 };
  assert.equal(MODELS.granary.variant({ id: 5, efficiency: 1, stock: {} }, {}, ctx).key, 'granary:n');
  assert.equal(MODELS.granary.variant({ id: 6, efficiency: 0, stock: {} }, {}, ctx).key, 'granary:i');
  // Its stock kept per building: rebuilt only when a place fills or empties.
  const b = { id: 7, efficiency: 1, stock: { wheat: 600 } };
  const a1 = MODELS.granary.variant(b, {}, ctx).more;
  b.stock.wheat = 610;
  assert.equal(MODELS.granary.variant(b, {}, ctx).more, a1);
  b.stock.wheat = 900;
  assert.notEqual(MODELS.granary.variant(b, {}, ctx).more, a1);
  // A lantern at the front door and one at the back: the view shows the one on its side (the
  // light map has no depth, so the other's glow would show through the store); none shut.
  const [front, back] = GRANARY.lamps;
  const at = (T) => modelLamps({ type: 'granary', size: 3, efficiency: 1 }, T);
  for (let T = 0; T < 4; T++) assert.equal(at(T).length, 1, `turn ${T}`);
  const [u, v, z] = at(0)[0];
  assert.ok(Math.abs(u - (1.5 + front[0] / TILE_M)) < 1e-9 && Math.abs(v - (1.5 + front[2] / TILE_M)) < 1e-9 && z > 0, 'turn 0: the front lantern');
  const [u3, v3] = at(3)[0];
  assert.ok(Math.abs(u3 - v) < 1e-9 && Math.abs(v3 - (3 - u)) < 1e-9, 'turn 3: the front lantern, turned as art turns');
  const [u1, v1] = at(1)[0];
  const bu = 1.5 + back[0] / TILE_M;
  const bv = 1.5 + back[2] / TILE_M;
  assert.ok(Math.abs(u1 - (3 - bv)) < 1e-9 && Math.abs(v1 - bu) < 1e-9, 'turn 1: the back lantern');
  assert.equal(modelLamps({ type: 'granary', size: 3, efficiency: 0 }, 0).length, 0);
  assert.equal(modelLamps({ type: 'farm_wheat', size: 3, efficiency: 1 }, 0).length, 0);
});

/** Every vertex of a kit placed by `m`, through `fn(x, y, z)`. */
function eachVertex(kit, m, fn) {
  const v = new Vector3();
  for (const p of kit.parts) {
    const pos = p.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      fn(v);
    }
  }
}

test('farms3d: every farm and the granary fit their 3 x 3 footprint at every step, state, level and turn', () => {
  const kits = new Map();
  const kitOfKey = (key, lod) => {
    const id = `${key}|${lod}`;
    if (!kits.has(id)) kits.set(id, kitOf(modelFor(key).build(key, lod)));
    return kits.get(id);
  };
  const S = 3;
  const e = 1e-3;
  const looks = [];
  for (const type of FARMS) {
    for (const [progress, eff, month] of [[10, 1, 6], [90, 1, 6], [70, 1, 3], [50, 0, 0], [90, 1, 9]]) looks.push({ type, b: { id: null, type, progress, efficiency: eff, herd: 8, size: 3 }, month });
  }
  looks.push({ type: 'granary', b: { id: 9, type: 'granary', efficiency: 1, stock: { wheat: 2400 }, size: 3 } });
  for (const { type, b, month } of looks) {
    const v = MODELS[type].variant(b, {}, month === undefined ? null : { month, frame: 1, clock: 0, game: null });
    for (let lod = 0; lod < 3; lod++) {
      for (let T = 0; T < 4; T++) {
        const base = modelMatrix(30, 12, S, T, 0);
        const check = (kit, m) => eachVertex(kit, m, (p) => {
          assert.ok(p.x >= 30 - e && p.x <= 30 + S + e && p.z >= 12 - e && p.z <= 12 + S + e, `${type} ${v.key} lod ${lod} turn ${T}: ${p.x.toFixed(3)}, ${p.z.toFixed(3)}`);
          assert.ok(p.y > -0.3 && p.y < 2.2, `${type} lod ${lod}: ${p.y} tiles high`);
        });
        check(kitOfKey(v.key, lod), base);
        const l = new Matrix4();
        for (const it of v.more || []) {
          const k = kitOfKey(it.key, lod);
          for (let j = 0; j < it.n; j++) check(k, new Matrix4().multiplyMatrices(base, l.fromArray(it.mats, j * 16)));
        }
      }
    }
  }
});

test('farms3d: trees stand where the 3D ground hoes round them; each level of detail is lighter', () => {
  // The ground's shader (groundMaterial.js) hoes round the sprite's tree spots: art (1.2 + 0.62 k, 0.45 + 0.95 r).
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
    const [x, z] = TREE_SPOTS[r * 3 + k];
    assert.ok(Math.abs((x + 6) / 4 - (1.2 + 0.62 * k)) < 1e-9 && Math.abs((z + 6) / 4 - (0.45 + 0.95 * r)) < 1e-9);
  }
  for (const key of ['farmstead:n', 'dress:wheat:4:n', 'dress:olive:4:n', 'dress:stable:0:n', 'tree:apple:0:leaf:2', 'tree:olive:1:leaf:2', 'vine:leaf:2', 'pig:0:stand', 'horse:2:graze', 'granary:n', 'gstock:fish']) {
    const t = [0, 1, 2].map((l) => kitOf(modelFor(key).build(key, l)).triangles);
    assert.ok(t[0] > t[1] && t[1] > t[2], `${key}: ${t}`);
  }
});

test('farms3d: the granary\'s piles never reach into each other, past the platform\'s edge, into the store or a doorway', () => {
  const foods = GRANARY_FOODS;
  const kits = Object.fromEntries(foods.map((f) => [f, kitOf(modelFor(`gstock:${f}`).build(`gstock:${f}`, 0))]));
  const boxes = {};
  for (const f of foods) {
    const b = new Box3();
    for (const p of kits[f].parts) {
      p.geometry.computeBoundingBox();
      b.union(p.geometry.boundingBox);
    }
    boxes[f] = b;
  }
  // Every place's matrix, as the pass places it (granaryParts of a full granary of one food).
  const all = granaryParts([{ food: 'wheat', n: STOCK_SLOTS.length }])[0];
  const at = (j) => new Matrix4().fromArray(all.mats, j * 16);
  const C = GRANARY.core;
  for (const fa of foods) {
    for (const fb of foods) {
      for (let i = 0; i < STOCK_SLOTS.length; i++) {
        const inv = at(i).invert();
        const box = boxes[fa].clone().expandByScalar(-0.02);
        for (let j = 0; j < STOCK_SLOTS.length; j++) {
          if (i === j) continue;
          let inside = 0;
          eachVertex(kits[fb], new Matrix4().multiplyMatrices(inv, at(j)), (p) => { if (box.containsPoint(p)) inside++; });
          assert.equal(inside, 0, `${fb} at place ${j} reaches into ${fa} at place ${i}`);
        }
      }
    }
    for (let j = 0; j < STOCK_SLOTS.length; j++) {
      eachVertex(kits[fa], at(j), (p) => {
        const out = Math.max(Math.abs(p.x), Math.abs(p.z));
        assert.ok(out <= GRANARY.half + 1e-6, `${fa} at place ${j} past the edge: ${out}`);
        assert.ok(out >= C - 1e-6, `${fa} at place ${j} inside the store`);
        // (The doorways: 1.6 m wide with their jambs, in the middle of each side.)
        assert.ok(Math.min(Math.abs(p.x), Math.abs(p.z)) > 1.02, `${fa} at place ${j} in a doorway: ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`);
      });
    }
  }
});
