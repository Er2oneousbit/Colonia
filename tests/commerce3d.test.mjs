/**
 * commerce3d.test.mjs - the 3D market, forum and warehouse (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - every look (the three shells, every good's load and display) fits
 *     its footprint at every turn and level of detail, standing on the
 *     ground, and a model of S tiles stands S tiles wide (a 3 x 3 model
 *     once stood three times too big)
 *   - each level of detail is lighter than the one before, within budget
 *   - states: staffed or not (open, shut), what each shows
 *   - the market's wares: steps of fullness by its caps, the goods it holds
 *     at the stalls the camera sees best, fish on the tholos
 *   - the warehouse's loads: one for every 100 units or part, 32 at most,
 *     the far bays first at every turn
 *   - the game's pass: loads drawn as instances, nothing rebuilt as stock
 *     changes, the lists cached until it does
 *   - the models' lamps where the game's night lights them
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Group, Vector3 } from 'three';
import { CONFIG, HALF_H } from '../src/config.js';
import { MODELS, hasModel, modelMatrix, modelLamps, TILE_M } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import { WARE_GOODS, displayStep, displayShows } from '../src/render3d/models/wares.js';
import { marketWares, marketState, marketShows, stallOrder, MARKET_GOODS, MARKET_STALLS } from '../src/render3d/models/market.js';
import { forumState, forumShows } from '../src/render3d/models/forum.js';
import { warehouseLoads, loadsOf, slotOrder, BAYS, SLOT_COUNT, warehouseState, fitLoads } from '../src/render3d/models/warehouse.js';
import { WAREHOUSE_GOODS, FOOD_TYPES, HOUSE_GOODS } from '../src/data/goods.js';


const SIZE = { market: 2, forum: 2, warehouse: 3 };

/** Every look the game can ask the three for. */
const LOOKS = [
  ['market', 'market'], ['market', 'market:fish:3'], ...MARKET_GOODS.map((g) => ['market', `market:ware:${g}:3`]),
  ['forum', 'forum'],
  ['warehouse', 'warehouse'], ...WARE_GOODS.map((g) => ['warehouse', `warehouse:load:${g}`]),
];

/** The world box of a look placed as the game places it: the shell's frame, or a ware's or load's at `at`. */
function placedBox(type, key, lod, T, at = null) {
  const g = MODELS[type].build(key, lod);
  g.updateMatrixWorld(true);
  const local = new Box3().setFromObject(g);
  const m = modelMatrix(30, 12, SIZE[type], T, 0);
  if (at) m.multiply(at);
  return local.applyMatrix4(m);
}

test('commerce3d: the market, forum and warehouse have models, a stock-less ghost shows only the shell', () => {
  for (const t of ['market', 'forum', 'warehouse']) assert.ok(hasModel(t), t);
  // (A ghost has no stock: nothing but the building.)
  const ghost = { id: null, type: 'warehouse', efficiency: 1 };
  assert.deepEqual(MODELS.warehouse.variant(ghost, { snow: 0 }, null).more, []);
  assert.deepEqual(MODELS.market.variant({ ...ghost, type: 'market' }, { snow: 0 }, null).more, []);
});

test('commerce3d: a model of S tiles stands S tiles wide (metres to tiles is a quarter, whatever the footprint)', () => {
  // The warehouse is 12 m across: on a 3 x 3 footprint it spans 3 tiles, not 9.
  const b = placedBox('warehouse', 'warehouse', 1, 0);
  assert.ok(b.max.x - b.min.x > 2.8 && b.max.x - b.min.x <= 3 + 1e-6, `width ${b.max.x - b.min.x}`);
  const m = placedBox('market', 'market', 1, 0);
  assert.ok(m.max.x - m.min.x > 1.8 && m.max.x - m.min.x <= 2 + 1e-6, `width ${m.max.x - m.min.x}`);
  // The one-tile models are as they were.
  const w = new Vector3(2, 0, 0).applyMatrix4(modelMatrix(0, 0, 1, 0));
  assert.ok(Math.abs(w.x - (0.5 + 2 / TILE_M)) < 1e-9);
});

test('commerce3d: every look fits its footprint at every turn and level of detail, on the ground', () => {
  const e = 1e-6;
  // Wares and loads at every stall and slot they can stand at.
  const stallAts = MARKET_STALLS.map((_, i) => marketWaresAt(i));
  const slotAts = [...new Set(slotOrder(0).flat())].map((i) => loadAt(i));
  for (const [type, key] of LOOKS) {
    const S = SIZE[type];
    const ats = key.startsWith('market:ware') ? stallAts : key.startsWith('warehouse:load') ? slotAts : [null];
    for (let lod = 0; lod < 3; lod++) {
      for (let T = 0; T < 4; T++) {
        for (const at of ats) {
          const b = placedBox(type, key, lod, T, at);
          assert.ok(b.min.x >= 30 - e && b.max.x <= 30 + S + e && b.min.z >= 12 - e && b.max.z <= 12 + S + e, `${key} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
          assert.ok(b.min.y > -0.01 && b.max.y < 1.6, `${key} lod ${lod}: from ${b.min.y} to ${b.max.y} tiles high`);
        }
      }
    }
  }
});

/** A stall's matrix (from a market that holds one good, so it takes stall `i` in T 0's order). */
function marketWaresAt(i) {
  // (stallMatrix is what marketWares hands out: read it back through the order.)
  const order = stallOrder(0);
  const stock = {};
  MARKET_GOODS.forEach((g, k) => { stock[g] = k <= order.indexOf(i) ? 800 : 0; });
  return marketWares(stock, 0)[order.indexOf(i)].at;
}
function loadAt(slot) {
  const stock = { wine: 3200 };
  const flat = slotOrder(0).flat();
  return warehouseLoads(stock, 0)[flat.indexOf(slot)].at;
}

test('commerce3d: each level of detail is lighter than the one before, and within budget', () => {
  const budget = { market: [26000, 13000, 5000], forum: [32000, 12000, 3000], warehouse: [20000, 12000, 5000] };
  for (const type of ['market', 'forum', 'warehouse']) {
    const t = [0, 1, 2].map((l) => kitOf(MODELS[type].build(type, l)).triangles);
    assert.ok(t[0] > t[1] && t[1] > t[2], `${type}: ${t}`);
    t.forEach((n, l) => assert.ok(n < budget[type][l], `${type} lod ${l}: ${n}`));
  }
  // A load is a few thousand at most close up, a few hundred far out: a full warehouse is 32 of them.
  for (const g of WARE_GOODS) {
    const t = [0, 1, 2].map((l) => kitOf(MODELS.warehouse.build(`warehouse:load:${g}`, l)).triangles);
    assert.ok(t[0] < 4500 && t[2] < 400 && t[2] < t[0], `${g}: ${t}`);
  }
});

test('commerce3d: staffed or not: the market\'s awnings, the forum\'s doors and clerk, the warehouse\'s gate', () => {
  for (const [fn, name] of [[marketState, 'market'], [forumState, 'forum'], [warehouseState, 'warehouse']]) {
    assert.equal(fn({ efficiency: 0.5 }), 'open', name);
    assert.equal(fn({ efficiency: 0 }), 'shut', name);
  }
  const tags = (type, key) => {
    const g = MODELS[type].build(key, 0);
    const out = new Map();
    g.traverse((o) => { if (o.isMesh) out.set(o.name, o.userData.when); });
    return out;
  };
  const f = tags('forum', 'forum');
  assert.equal(f.get('doors-open'), 'open');
  assert.equal(f.get('doors-shut'), 'shut');
  assert.equal(f.get('coin'), 'open');
  // The clerk and the citizens are actors (people/): there only while it works.
  assert.ok(MODELS.forum.variant({ efficiency: 1 }).actors.actors.length >= 2, 'a clerk and a citizen when it works');
  assert.equal(MODELS.forum.variant({ efficiency: 0 }).actors.actors.length, 0, 'nobody when it does not');
  assert.ok(forumShows('open', 'open') && !forumShows('open', 'shut') && forumShows('always', 'shut'));
  const m = tags('market', 'market');
  assert.equal(m.get('awnings'), 'open');
  assert.equal(m.get('awnings-rolled'), 'shut');
  assert.ok(marketShows('open', 'open') && !marketShows('shut', 'open'));
  const w = tags('warehouse', 'warehouse');
  assert.equal(w.get('doors-open'), 'open');
  assert.equal(w.get('doors-shut'), 'shut');
});

test('commerce3d: the market shows each good it holds in three steps, the most visible stalls first, fish on the tholos', () => {
  // Steps by the market's caps: a third, two thirds, more.
  assert.deepEqual([0, 1, 266, 267, 533, 534, 800].map((a) => displayStep(a, 800)), [0, 1, 1, 2, 2, 3, 3]);
  assert.equal(displayStep(150, CONFIG.MARKET_GOODS_CAP), 2);
  // Parts tagged fill1..fill3 show from their step up.
  assert.ok(displayShows('fill1', 1) && displayShows('fill1', 3) && !displayShows('fill2', 1) && displayShows('fill3', 3) && !displayShows('fill1', 0));
  const stock = { wheat: 700, vegetables: 0, fruit: 100, meat: 0, fish: 400, pottery: 250, furniture: 0, oil: 0, wine: 0, clothing: 0, marble: 0 };
  for (let T = 0; T < 4; T++) {
    const list = marketWares({ ...stock }, T);
    // (A kit a good and step: its key names both.)
    assert.deepEqual(list.map((e) => e.key), ['market:ware:wheat:3', 'market:ware:fruit:1', 'market:ware:pottery:3', 'market:fish:2']);
    // The goods take the stalls farthest from the camera (their counters face it over the court).
    const order = stallOrder(T);
    const depth = (at) => {
      const p = new Vector3().applyMatrix4(at).applyMatrix4(modelMatrix(0, 0, 2, T));
      return p.x + p.z;
    };
    const stalls = list.slice(0, 3).map((e) => depth(e.at));
    const all = order.map((i) => depth(marketWaresAt(i)));
    assert.ok(stalls.every((d) => d <= all[2] + 1e-9), `turn ${T}: the three farthest stalls`);
  }
  // Empty: nothing for sale.
  assert.deepEqual(marketWares({ wheat: 0 }, 0), []);
});

test('commerce3d: the warehouse shows a load for every 100 units or part, 32 at most, the far bays first', () => {
  assert.deepEqual([0, 1, 100, 101, 250, 3200].map(loadsOf), [0, 1, 1, 2, 3, 32]);
  assert.equal(SLOT_COUNT, 32);
  assert.equal(BAYS.length, 8);
  const stock = { wine: 450, timber: 120, marble: 0 };
  const list = warehouseLoads({ ...stock }, 0);
  assert.equal(list.length, 7);
  assert.deepEqual(list.map((e) => e.key.split(':')[2]), ['timber', 'timber', 'wine', 'wine', 'wine', 'wine', 'wine']);
  // Never more than it has room for (every good at its cap would be far more).
  const flood = Object.fromEntries(WARE_GOODS.map((g) => [g, 3200]));
  assert.equal(warehouseLoads(flood, 0).length, 32);
  // At every turn the first loads stand where the camera sees best: the far bays.
  for (let T = 0; T < 4; T++) {
    const l = warehouseLoads({ wine: 400 }, T);
    const depth = (at) => {
      const p = new Vector3().applyMatrix4(at).applyMatrix4(modelMatrix(0, 0, 3, T));
      return p.x + p.z;
    };
    const full = warehouseLoads({ wine: 3200 }, T).map((e) => depth(e.at));
    const first = l.map((e) => depth(e.at));
    assert.ok(Math.max(...first) < Math.max(...full) - 1, `turn ${T}: the first bay is not the nearest`);
    assert.ok(Math.min(...first) <= Math.min(...full) + 1e-9, `turn ${T}: the farthest load stands first`);
  }
});

test('commerce3d: the lists are cached by the stock record until a load or a step changes', () => {
  const stock = { wine: 450 };
  const a = warehouseLoads(stock, 0);
  assert.equal(warehouseLoads(stock, 0), a, 'the same array while nothing changed');
  stock.wine = 480; // still five loads
  assert.equal(warehouseLoads(stock, 0), a);
  stock.wine = 520;
  assert.notEqual(warehouseLoads(stock, 0), a, 'a sixth load');
  assert.notEqual(warehouseLoads(stock, 1), warehouseLoads(stock, 0), 'another turn, other bays');
  const m = { wheat: 700 };
  const b = marketWares(m, 0);
  m.wheat = 650;
  assert.equal(marketWares(m, 0), b);
  m.wheat = 100;
  assert.notEqual(marketWares(m, 0), b);
});

test('commerce3d: the game draws the loads as instances, builds a kit once a good, and rebuilds nothing as stock changes', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const map = { desirability: [0], idx: () => 0 };
  const r = { game: { map }, weather: {}, time: 0 };
  const b = { id: 9, type: 'warehouse', size: 3, x: 0, y: 0, efficiency: 1, stock: { wine: 450, oil: 0 } };
  const placed = () => [{ b, T: 0, vx: 0, vy: 0, state: 0, snow: 0 }];
  // (A frame builds kits for a few ms, drawing others at a level already built: a few frames and every look is built.)
  const frames = (n = 4) => { for (let i = 0; i < n; i++) mp.update(r, placed(), 2); };
  frames();
  const count = (key) => {
    const k = mp.kits.get(`${key}|2`);
    return k ? Math.max(...k.meshes.map((im) => im.count)) : 0;
  };
  assert.equal(count('warehouse:load:wine'), 5);
  assert.equal(count('warehouse'), 1);
  // (Kits at this level: the pass also builds the next level's ahead when it has time.)
  const atLod = () => [...mp.kits.keys()].filter((id) => id.endsWith('|2')).length;
  const kits = atLod();
  // A tick's worth of change: more wine, some oil. One more kit (oil's), the rest as they were.
  b.stock.wine = 900;
  b.stock.oil = 150;
  frames();
  assert.equal(count('warehouse:load:wine'), 9);
  assert.equal(count('warehouse:load:oil'), 2);
  assert.equal(atLod(), kits + 1);
  const wine = mp.kits.get('warehouse:load:wine|2');
  for (let i = 0; i < 5; i++) mp.update(r, placed(), 2);
  assert.equal(mp.kits.get('warehouse:load:wine|2'), wine, 'the same kit frame after frame');
  // Emptied: no loads drawn, and the gate shut when nobody works there.
  b.stock.wine = 0;
  b.stock.oil = 0;
  b.efficiency = 0;
  frames(1);
  assert.equal(count('warehouse:load:wine'), 0);
  const shell = mp.kits.get('warehouse|2');
  const shown = (name) => shell.meshes.find((im) => im.userData.part.when === name)?.count || 0;
  assert.equal(shown('shut'), 1);
  assert.equal(shown('open'), 0);
  // With this frame's building time spent, a look not built at this level shows at one that is.
  mp.buildUntil = 1;
  assert.equal(mp.kitFor('warehouse', 0), shell, 'the far shell while the close one waits');
  mp.buildUntil = 0;
  mp.dispose();
  assert.equal(rig.modelSlot.children.length, 0, 'every instanced mesh freed');
});

test('commerce3d: the models light their lamps while staffed, where the night lights them, the side in view', () => {
  for (const type of ['market', 'forum', 'warehouse']) {
    const S = SIZE[type];
    const b = { type, size: S, efficiency: 1 };
    assert.deepEqual(modelLamps({ ...b, efficiency: 0 }, 0), [], `${type}: dark with nobody at work`);
    const lit = [0, 1, 2, 3].map((T) => modelLamps(b, T));
    for (const pts of lit) for (const [u, v, z] of pts) assert.ok(u >= 0 && u <= S && v >= 0 && v <= S && z > 5 && z < 60, `${type}: ${u}, ${v}, ${z}`);
    // The tholos's lamp hangs in the open: lit at every turn, once.
    if (type === 'market') assert.ok(lit.every((pts) => pts.length === 1));
    // A door's and a gate's lamps face out of their front: seen at two turns of four.
    else assert.equal(lit.filter((pts) => pts.length).length, 2, type);
  }
});

test('commerce3d: every good a warehouse or a market can hold has a look, and a crowded warehouse hides no good', () => {
  assert.deepEqual([...WARE_GOODS].sort(), [...WAREHOUSE_GOODS].sort(), 'a load for every good a warehouse stores');
  assert.deepEqual([...MARKET_GOODS, 'fish'].sort(), [...FOOD_TYPES, ...HOUSE_GOODS].sort(), 'a stall (or the tholos) for every good a market holds');
  // Twenty goods at 160 units each: 3,200 units but 40 loads rounded up. Every good keeps one.
  const crowd = Object.fromEntries(WARE_GOODS.map((g) => [g, 160]));
  const list = warehouseLoads(crowd, 0);
  assert.equal(list.length, 32);
  assert.equal(new Set(list.map((e) => e.key.split(':')[2])).size, WARE_GOODS.length);
  assert.deepEqual(fitLoads([5, 1, 3], 6), [2, 1, 3]);
  assert.deepEqual(fitLoads([1, 1, 1], 2), [1, 1, 0]);
  assert.deepEqual(fitLoads([4, 4], 32), [4, 4]);
});

test('commerce3d: a look with no level built is built at once, whatever the frame\'s building time', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  // A frame whose building time is spent (as after a zoom into a city of stores): nothing else to draw, so built.
  mp.buildUntil = 1;
  for (const key of ['forum', 'warehouse', 'warehouse:load:iron']) assert.ok(mp.kitFor(key, 2) && mp.kits.has(`${key}|2`), key);
  mp.buildUntil = 0;
  mp.dispose();
});
