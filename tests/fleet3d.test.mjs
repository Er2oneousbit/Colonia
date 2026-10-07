/**
 * fleet3d.test.mjs - the 3D Navalia, Statio and Portus (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the three have models; a build ghost faces the water the terrain
 *     gives, staffed, its slip empty, no crew at drill
 *   - the water side: the building's own, a ghost's from the terrain, the
 *     sprite's default; each side turns the model's front (+z) to it
 *   - the hull on the slip by the sim's progress, split at 50 as the 2D
 *     sprite's two looks are
 *   - every look, with all it can hold, fits its 3 x 3 footprint at every
 *     water side, view turn and level of detail, and stands out over its
 *     front rows (the land row behind, the water rows before)
 *   - the stock shows a load a hundred, as many as there are places
 *   - a Portus drills only while a ship trains there and it is fully staffed
 *   - every tagged part shows in a state, and the states differ
 *   - each level of detail is lighter than the one before, within budget
 *   - the lamps light while staffed, on the footprint, the shed's facing
 *     the water, the open ones seen at every turn
 *   - a hard frost takes the foam from round the piles
 *   - the game's pass draws a navalia from kits shared by every side
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Group, Matrix4 } from 'three';
import { MODELS, hasModel, modelMatrix, modelLamps, partShows, modelFor } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import { hullStep, waterSideOf, sideAngle, turnPoint, stockLoads, portusDrill } from '../src/render3d/models/fleet.js';
import { NAVALIA } from '../src/render3d/models/navalia.js';
import { HARBOUR } from '../src/render3d/models/harbour.js';
import { GameMap, Terrain } from '../src/world/map.js';
import { waterRowsSide } from '../src/sim/entities.js';

const TYPES = ['navalia', 'naval_station', 'portus'];
const FULL = { timber: 5000, iron: 5000, linen: 5000 };

/** A map with water rows on side `side` of a 3 x 3 footprint at (x, y). */
function shoreMap(side, x = 4, y = 4) {
  const map = new GameMap(16, 16);
  map.terrain.fill(Terrain.GRASS);
  for (let ty = 0; ty < 16; ty++) {
    for (let tx = 0; tx < 16; tx++) {
      const wet = side === 0 ? ty < y + 2 : side === 1 ? tx > x : side === 2 ? ty > y : tx < x + 2;
      if (wet) map.terrain[map.idx(tx, ty)] = Terrain.WATER;
    }
  }
  return map;
}

/** The kits a look shows ([{ key, mats, n, state }]) as the pass places them, for a building record. */
function looks(type, b, place = { snow: 0 }, ctx = null) {
  const v = MODELS[type].variant(b, place, ctx);
  return [{ key: v.key, n: 1, mats: new Matrix4().toArray(), state: v.state }, ...(v.more || [])];
}

test('fleet3d: the three have models; a ghost faces the water the terrain gives, staffed, empty, no drill', () => {
  for (const t of TYPES) assert.ok(hasModel(t), t);
  for (let side = 0; side < 4; side++) {
    const map = shoreMap(side);
    assert.equal(waterRowsSide(map, 4, 4, 3), side, 'the test map');
    const ghost = { id: null, type: 'navalia', x: 4, y: 4, size: 3, efficiency: 1 };
    assert.equal(waterSideOf(ghost, { game: { map } }), side);
    const l = looks('navalia', ghost, { snow: 0 }, { game: { map } });
    assert.ok(l.every((e) => !e.key.includes('hull') && !e.key.includes('load')), 'no hull, no stock on a ghost');
    assert.equal(l[1].state, 'open');
    const p = looks('portus', { ...ghost, type: 'portus' }, { snow: 0 }, { game: { map, units: new Map() } });
    assert.ok(p.some((e) => e.key === 'portus:rack') && !p.some((e) => e.key === 'portus:drill'));
  }
});

test('fleet3d: the water side: the building\'s own, a ghost\'s from the terrain, else the sprite\'s; each turns the front to it', () => {
  assert.equal(waterSideOf({ waterSide: 3 }, null), 3);
  assert.equal(waterSideOf({ id: null, x: 0, y: 0, size: 3 }, null), 1, "the sprite's default");
  // The model's front (+z) turned to face each side: 0 = -y, 1 = +x, 2 = +y, 3 = -x (art turn 0: x = u, z = v).
  const want = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let s = 0; s < 4; s++) {
    const [x, , z] = turnPoint([0, 0, 1], s);
    assert.ok(Math.abs(x - want[s][0]) < 1e-9 && Math.abs(z - want[s][1]) < 1e-9, `side ${s}: ${x}, ${z}`);
    const m = new Matrix4().makeRotationY(sideAngle(s));
    const e = m.elements;
    assert.ok(Math.abs(e[8] - want[s][0]) < 1e-9 && Math.abs(e[10] - want[s][1]) < 1e-9, `side ${s}'s matrix`);
  }
});

test('fleet3d: the hull on the slip by the sim\'s progress, split at 50 as the sprite\'s two looks', () => {
  const cases = [[0, 0], [undefined, 0], [-1, 0], [0.5, 1], [24.9, 1], [25, 2], [49.9, 2], [50, 3], [74.9, 3], [75, 4], [99.99, 4], [100, 4]];
  for (const [p, s] of cases) assert.equal(hullStep(p), s, `progress ${p}`);
  // As buildingArt.js artState: frames under 50 (steps 1, 2), planked from 50 (steps 3, 4).
  for (let p = 1; p < 100; p += 0.5) assert.equal(hullStep(p) >= 3, p >= 50, `progress ${p}`);
  const b = { id: 1, type: 'navalia', waterSide: 2, efficiency: 1, stock: {} };
  for (const [p, s] of [[0, 0], [30, 2], [80, 4]]) {
    const keys = looks('navalia', { ...b, progress: p }).map((e) => e.key);
    assert.equal(keys.includes(`navalia:hull:${s}`), s > 0, `${p}: ${keys}`);
    assert.equal(keys.filter((k) => k.startsWith('navalia:hull')).length, s ? 1 : 0);
  }
});

test('fleet3d: the stock shows a load a hundred, as many as there are places', () => {
  assert.equal(stockLoads({}, 'timber'), 0);
  assert.equal(stockLoads({ timber: 1 }, 'timber'), 1);
  assert.equal(stockLoads({ timber: 300 }, 'timber'), 3);
  assert.equal(stockLoads({ timber: 301 }, 'timber'), 4);
  assert.equal(stockLoads({ timber: 99999 }, 'timber'), NAVALIA.stock.timber.length);
  assert.equal(stockLoads({ iron: 150 }, 'iron'), 2);
  const l = looks('navalia', { id: 1, waterSide: 1, efficiency: 1, progress: 0, stock: { timber: 250, linen: 100 } });
  assert.equal(l.find((e) => e.key === 'warehouse:load:timber').n, 3);
  assert.equal(l.find((e) => e.key === 'warehouse:load:linen').n, 1);
  assert.ok(!l.some((e) => e.key === 'warehouse:load:iron'));
});

test('fleet3d: a Portus drills only while a ship trains there and it is fully staffed and reached', () => {
  const units = new Map([[7, { id: 7, type: 'liburnian', drill: 20, state: 'training' }], [8, { id: 8, type: 'liburnian', drill: 21, state: 'drill' }]]);
  const game = { units };
  assert.equal(portusDrill({ id: 20, efficiency: 1, accessRoad: 5 }, game), true);
  assert.equal(portusDrill({ id: 20, efficiency: 0.9, accessRoad: 5 }, game), false, 'short of staff: the drill waits');
  assert.equal(portusDrill({ id: 20, efficiency: 1, accessRoad: -1 }, game), false, 'no road');
  assert.equal(portusDrill({ id: 21, efficiency: 1, accessRoad: 5 }, game), false, 'one still rowing there has not begun');
  assert.equal(portusDrill({ id: null, efficiency: 1 }, game), false, 'a ghost');
  assert.equal(portusDrill({ id: 20, efficiency: 1 }, null), false);
  const keys = (b) => looks('portus', { waterSide: 0, type: 'portus', ...b }, { snow: 0 }, { game }).map((e) => e.key);
  assert.ok(keys({ id: 20, efficiency: 1, accessRoad: 5 }).includes('portus:drill'));
  assert.ok(keys({ id: 20, efficiency: 1, accessRoad: 5 }).includes('portus:corvus:down'));
  assert.ok(keys({ id: 22, efficiency: 1, accessRoad: 5 }).includes('portus:rack'));
  assert.ok(keys({ id: 22, efficiency: 1, accessRoad: 5 }).includes('portus:corvus:up'));
});

/** The world box of every kit of a look, built at `lod`, placed as the pass places it. */
function lookBox(type, b, lod, T, vx = 20, vy = 9, place = { snow: 0 }, ctx = null) {
  const box = new Box3();
  const m = modelMatrix(vx, vy, 3, T, 0);
  for (const e of looks(type, b, place, ctx)) {
    const g = modelFor(e.key).build(e.key, lod);
    g.updateMatrixWorld(true);
    const local = new Box3();
    g.traverse((o) => {
      if (!o.isMesh || !partShows(o.userData.when, e.state || 'always', false)) return;
      o.geometry.computeBoundingBox();
      local.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    });
    if (local.isEmpty()) continue;
    for (let j = 0; j < e.n; j++) box.union(local.clone().applyMatrix4(new Matrix4().multiplyMatrices(m, new Matrix4().fromArray(e.mats, j * 16))));
  }
  return box;
}

/** Every record worth fitting: the busiest of each type (a finished hull and a full yard, a crew at drill). */
function busiest(type, side) {
  const units = new Map([[9, { drill: 5, state: 'training' }]]);
  const b = { id: 5, type, waterSide: side, efficiency: 1, accessRoad: 1, progress: 90, stock: FULL };
  return { b, ctx: { game: { units } } };
}

test('fleet3d: every look fits its footprint at every side, turn and level of detail, out over its front rows', () => {
  const e = 1e-6;
  for (const type of TYPES) {
    for (let side = 0; side < 4; side++) {
      const { b, ctx } = busiest(type, side);
      for (let lod = 0; lod < 3; lod++) {
        for (let T = 0; T < 4; T++) {
          const box = lookBox(type, b, lod, T, 20, 9, { snow: 0 }, ctx);
          const at = `${type} side ${side} lod ${lod} turn ${T}: ${JSON.stringify(box)}`;
          assert.ok(box.min.x >= 20 - e && box.max.x <= 23 + e && box.min.z >= 9 - e && box.max.z <= 12 + e, at);
          // (Piles and piers go down into the water, which the look clips at its surface.)
          assert.ok(box.min.y > -0.6 / 4 && box.max.y < 8 / 4, at);
        }
      }
    }
  }
});

test('fleet3d: the front rows stand out over the water: piles and piers there, the land row behind', () => {
  // In the model's own metres (front +z): the piles of the slip's bents and the shed's piers are over the water rows.
  for (const type of TYPES) {
    const g = MODELS[type].build(type, 1);
    g.updateMatrixWorld(true);
    let under = 0;
    let underLand = 0;
    g.traverse((o) => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) >= -0.2) continue;
        // (The quay's edge stones at the shore line go down into the water's edge.)
        if (p.getZ(i) > HARBOUR.shore - 0.35) under++;
        else underLand++;
      }
    });
    assert.ok(under > 50, `${type}: what stands in the water (${under})`);
    assert.equal(underLand, 0, `${type}: nothing under the land row's ground`);
  }
});

test('fleet3d: every tagged part shows in some state, and the states differ', () => {
  for (const type of TYPES) {
    const g = MODELS[type].build(type, 0);
    const seen = { open: 0, shut: 0 };
    g.traverse((o) => {
      if (!o.isMesh) return;
      const states = ['open', 'shut'].filter((s) => partShows(o.userData.when, s, false));
      assert.ok(states.length, `${type} ${o.name} (${o.userData.when}) shows in no state`);
      if (states.length === 1) seen[states[0]]++;
    });
    assert.ok(seen.open > 0 && seen.shut > 0, `${type}: ${JSON.stringify(seen)}`);
  }
  // The station's fire burns while staffed, cold ash when not; the lantern likewise.
  const names = (type, state) => {
    const out = new Set();
    MODELS[type].build(type, 0).traverse((o) => { if (o.isMesh && partShows(o.userData.when, state, false)) out.add(o.name); });
    return out;
  };
  assert.ok(names('naval_station', 'open').has('fire') && !names('naval_station', 'open').has('ash'));
  assert.ok(names('naval_station', 'shut').has('ash') && !names('naval_station', 'shut').has('fire'));
  // People only while staffed.
  for (const type of TYPES) assert.ok(![...names(type, 'shut')].some((n) => /^(winder|tallyman|sentry|sailor|master)-/.test(n)), type);
  // The hull's shipwrights only while the yard is staffed.
  const hull = (state) => { const s = new Set(); MODELS.navalia.build('navalia:hull:3', 0).traverse((o) => { if (o.isMesh && partShows(o.userData.when, state, false)) s.add(o.name); }); return s; };
  assert.ok([...hull('open')].some((n) => n.startsWith('shipwright')) && ![...hull('shut')].some((n) => n.startsWith('shipwright')));
});

test('fleet3d: each level of detail is lighter than the one before, and within budget', () => {
  // A look's kits together, its busiest: the building, a finished hull and a full yard; a crew at drill.
  const budget = [100000, 26000, 6500];
  for (const type of TYPES) {
    const { b, ctx } = busiest(type, 2);
    const t = [0, 1, 2].map((lod) => looks(type, b, { snow: 0 }, ctx).reduce((a, e) => a + e.n * kitOf(modelFor(e.key).build(e.key, lod)).triangles, 0));
    assert.ok(t[0] > t[1] && t[1] > t[2], `${type}: ${t}`);
    t.forEach((n, l) => assert.ok(n < budget[l], `${type} lod ${l}: ${n}`));
  }
});

test('fleet3d: the lamps light while staffed, on the footprint; the shed\'s faces the water, the open ones every turn', () => {
  for (const type of TYPES) {
    for (let side = 0; side < 4; side++) {
      const b = { type, size: 3, efficiency: 1, waterSide: side };
      assert.deepEqual(modelLamps({ ...b, efficiency: 0 }, 0), [], `${type}: dark with nobody at work`);
      for (let T = 0; T < 4; T++) {
        const pts = modelLamps(b, T);
        assert.ok(pts.length >= 1, `${type} side ${side} turn ${T}: an open lamp is seen at every turn`);
        for (const [u, v, z] of pts) assert.ok(u >= 0 && u <= 3 && v >= 0 && v <= 3 && z > 5, `${type}: ${u}, ${v}, ${z}`);
      }
    }
  }
  // The navalia's lantern on the shed's front pillar faces the water: seen exactly at the turns whose
  // view sees the water side (its direction in (u, v), turned as the art turns, toward +u or +v).
  for (let side = 0; side < 4; side++) {
    for (let T = 0; T < 4; T++) {
      let [a, c] = [[0, -1], [1, 0], [0, 1], [-1, 0]][side];
      for (let k = 0; k < T; k++) [a, c] = [-c, a];
      const lit = modelLamps({ type: 'navalia', size: 3, efficiency: 1, waterSide: side }, T).length === 2;
      assert.equal(lit, a + c > 0, `side ${side} turn ${T}`);
    }
  }
  // A lamp given no facing along x is drawn as before the facing was added (the granary's, the forum's).
  for (const type of ['granary', 'forum']) {
    const b = { type, size: MODELS_SIZE[type], efficiency: 1 };
    for (let T = 0; T < 4; T++) {
      const old = [];
      for (const [x, y, z, s = 1] of MODELS[type].lamps(b)) {
        const face = [[0, s], [-s, 0], [0, -s], [s, 0]][T];
        if (face[0] + face[1] > 0) old.push(x);
      }
      assert.equal(modelLamps(b, T).length, old.length, `${type} turn ${T}`);
    }
  }
});

const MODELS_SIZE = { granary: 3, forum: 2 };

test('fleet3d: a fleet building of an older save, wholly on land, keeps its sprite', () => {
  for (const type of TYPES) {
    assert.equal(MODELS[type].fits({ id: 3, type, waterRows: 0 }), false, type);
    assert.equal(MODELS[type].fits({ id: 3, type, waterRows: 2 }), true, type);
    assert.equal(MODELS[type].fits({ id: null, type }), true, `${type}: a ghost`);
  }
});

test('fleet3d: a hard frost takes the foam from round the piles (the water\'s margins freeze)', () => {
  for (const type of TYPES) {
    const b = { id: 1, type, waterSide: 2, efficiency: 1, stock: {} };
    const warm = looks(type, b, { snow: 1 })[1].key;
    const cold = looks(type, b, { snow: 2 })[1].key;
    assert.equal(warm, type);
    assert.equal(cold, `${type}:ice`);
    const foam = (key) => { let n = 0; MODELS[type].build(key, 1).traverse((o) => { if (o.isMesh && o.name === 'foam') n++; }); return n; };
    assert.equal(foam(warm), 1, type);
    assert.equal(foam(cold), 0, type);
  }
});

test('fleet3d: the game\'s pass draws a navalia from kits shared by every side, its hull and stock as more', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const game = { map: { desirability: [0], idx: () => 0 }, walkers: new Map(), units: new Map() };
  const r = { game, weather: {}, time: 0 };
  const a = { id: 4, type: 'navalia', size: 3, x: 0, y: 0, waterSide: 0, efficiency: 1, progress: 60, stock: { timber: 300 } };
  const c = { ...a, id: 5, x: 5, waterSide: 3, progress: 10 };
  mp.update(r, [{ b: a, T: 0, vx: 0, vy: 0, state: 0, snow: 0 }, { b: c, T: 0, vx: 5, vy: 0, state: 0, snow: 0 }], 2);
  const count = (id) => { const k = mp.kits.get(id); return k ? Math.max(...k.meshes.map((im) => im.count)) : 0; };
  assert.equal(count('navalia|2'), 2, 'one kit of the building for both sides');
  assert.equal(count('navalia:hull:3|2'), 1);
  assert.equal(count('navalia:hull:1|2'), 1);
  assert.equal(count('warehouse:load:timber|2'), 6, 'three loads each');
  assert.equal(mp.stats.byType.navalia, 2);
  // Unstaffed: the windlass's bars laid down; the shipwrights' tag gone with the staff.
  a.efficiency = 0;
  mp.update(r, [{ b: a, T: 1, vx: 0, vy: 0, state: 0, snow: 0 }], 2);
  const k = mp.kits.get('navalia|2');
  const by = (when) => k.meshes.filter((im) => im.userData.part.when === when).reduce((s, im) => s + im.count, 0);
  assert.ok(by('shut') >= 1 && by('open') === 0);
  mp.dispose();
});
