/**
 * waterside3d.test.mjs - the 3D Emporium, Shipyard and Fishing Wharf (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the three have models, of the sim's sizes; a build ghost faces the
 *     water the terrain gives, staffed, empty (no goods, no boat, no smoke)
 *   - the dock's goods as loads: a hundred units a load, in the quay's
 *     places, each good together; over the places the loads are shared out
 *     in proportion; the yard's timber (two loads) and the wharf's baskets
 *     (one in twenty-five fish) as the sim's stocks read
 *   - the boat on the slip by the sim's progress (split at 50 as the
 *     sprite's two looks), none while a spare waits afloat
 *   - every look, with all it can hold, fits its footprint at every water
 *     side, view turn and level of detail, within the heights the brief
 *     gives; the front line stays clear for the ship and the boats (the
 *     mooring puts them a hand off it, never over it)
 *   - the front rows stand out over the water: piles there, none under the
 *     land row
 *   - every tagged part shows in a state, and the states differ; the people
 *     work only while staffed, on the footprint
 *   - each level of detail is lighter than the one before, within budget
 *   - the lamps light while staffed, on the footprint, seen at every turn
 *   - a hard frost takes the foam from round the piles
 *   - an older save's building wholly on land keeps its sprite
 *   - the game's pass draws a dock from kits shared by every side
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Group, Matrix4, Vector3 } from 'three';
import { MODELS, hasModel, modelMatrix, modelLamps, partShows, modelFor } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import { actorBounds, pack } from '../src/render3d/people/actors.js';
import { waterSideOf } from '../src/render3d/models/fleet.js';
import { dockLoads, yardLoads } from '../src/render3d/models/waterside.js';
import { TRADE_DOCK, tradeDockActors } from '../src/render3d/models/tradeDock.js';
import { FISH_YARD, fishHullStep, fishYardActors } from '../src/render3d/models/fishYard.js';
import { FISH_WHARF, basketCount, fishWharfActors } from '../src/render3d/models/fishWharf.js';
import { HARBOUR } from '../src/render3d/models/harbour.js';
import { alongside } from '../src/render3d/ships/moorings.js';
import { DESIGNS, extentOf } from '../src/render3d/ships/designs.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { GameMap, Terrain } from '../src/world/map.js';
import { waterRowsSide, waterRowsFor } from '../src/sim/entities.js';

const TYPES = ['dock', 'shipyard', 'wharf'];
const SIZE = { dock: 3, shipyard: 2, wharf: 2 };
/** The shore line of each in its own metres (the land behind it, the water rows before it). */
const SHORE = { dock: HARBOUR.shore, shipyard: FISH_YARD.shore, wharf: FISH_WHARF.shore };
/** The tallest each may stand (m): the dock's crane up to 6, the rest low. */
const HEIGHT = { dock: 6, shipyard: 4, wharf: 3.5 };
const FULL = { timber: 5000, wine: 3000, oil: 900, iron: 400, marble: 700, fish: 400 };

/** A map with water rows on side `side` of an S x S footprint at (x, y). */
function shoreMap(side, S, x = 4, y = 4) {
  const rows = waterRowsFor(S);
  const map = new GameMap(16, 16);
  map.terrain.fill(Terrain.GRASS);
  for (let ty = 0; ty < 16; ty++) {
    for (let tx = 0; tx < 16; tx++) {
      const wet = side === 0 ? ty < y + rows : side === 1 ? tx >= x + S - rows : side === 2 ? ty >= y + S - rows : tx < x + rows;
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

/** The busiest record of each type: staffed, every stage and store full. */
const busiest = (type, side = 2) => ({ id: 5, type, size: SIZE[type], waterSide: side, efficiency: 1, accessRoad: 1, progress: 90, stock: FULL });

test('waterside3d: the three have models, of the sim\'s sizes; a ghost faces the water the terrain gives, staffed, empty', () => {
  for (const t of TYPES) {
    assert.ok(hasModel(t), t);
    assert.equal(BUILDINGS[t].size, SIZE[t], `${t}'s size`);
    assert.ok(BUILDINGS[t].placement === 'shore' || BUILDINGS[t].placement === 'fishingShore', `${t} is a waterside building`);
  }
  for (const t of TYPES) {
    for (let side = 0; side < 4; side++) {
      const map = shoreMap(side, SIZE[t]);
      assert.equal(waterRowsSide(map, 4, 4, SIZE[t]), side, `the test map of ${t}`);
      const ghost = { id: null, type: t, x: 4, y: 4, size: SIZE[t], efficiency: 1 };
      assert.equal(waterSideOf(ghost, { game: { map } }), side);
      const l = looks(t, ghost, { snow: 0 }, { game: { map } });
      assert.deepEqual(l.map((e) => e.key), [`${t}:none`, t], `${t}: a ghost shows the building alone`);
      assert.equal(l[1].state, 'open');
    }
  }
});

test('waterside3d: the dock\'s goods are loads of a hundred in the quay\'s places, each good together', () => {
  const P = TRADE_DOCK.loads.length;
  assert.deepEqual(dockLoads({}), []);
  assert.deepEqual(dockLoads({ timber: 1 }), [['timber', 1]]);
  assert.deepEqual(dockLoads({ timber: 100 }), [['timber', 1]]);
  assert.deepEqual(dockLoads({ timber: 101, wine: 250 }), [['timber', 2], ['wine', 3]], 'in the goods\' order, rounded up');
  assert.deepEqual(dockLoads({ horses: 400, wine: 100 }), [['wine', 1]], 'what the warehouse does not show is not shown');
  // Over the places: shared in proportion, each good held keeps one, never more than the places.
  const many = dockLoads({ timber: 2400, wine: 100, oil: 100 });
  assert.equal(many.reduce((s, [, n]) => s + n, 0), P);
  assert.ok(many.every(([, n]) => n >= 1), JSON.stringify(many));
  assert.ok(many.find(([g]) => g === 'timber')[1] > many.find(([g]) => g === 'wine')[1]);
  const full = dockLoads(FULL);
  assert.ok(full.reduce((s, [, n]) => s + n, 0) <= P);
  // The look: a kit of loads a good, as many as it has, at distinct places of the quay.
  const l = looks('dock', { id: 5, waterSide: 2, efficiency: 1, stock: { timber: 250, wine: 100, oil: 700 } });
  assert.equal(l.find((e) => e.key === 'warehouse:load:timber').n, 3);
  assert.equal(l.find((e) => e.key === 'warehouse:load:wine').n, 1);
  assert.equal(l.find((e) => e.key === 'warehouse:load:oil').n, 7);
  assert.ok(!l.some((e) => e.key === 'warehouse:load:iron'));
  const at = new Set();
  for (const e of l.filter((k) => k.key.startsWith('warehouse:load'))) for (let j = 0; j < e.n; j++) at.add(`${e.mats[j * 16 + 12].toFixed(2)},${e.mats[j * 16 + 14].toFixed(2)}`);
  assert.equal(at.size, 11, 'every load its own place');
  // (Every place is on the quay or in the shed's bays: over the footprint's land and mole, not out on the jetty's water.)
  for (const [x, y, z] of TRADE_DOCK.loads) assert.ok(x > -6 && x < TRADE_DOCK.mole[1] && z > -5.2 && z < TRADE_DOCK.front - 0.5 && y === TRADE_DOCK.top, `${x}, ${z}`);
});

test('waterside3d: the yard\'s timber is a load a hundred, two at most; the wharf\'s catch a basket in twenty-five fish', () => {
  assert.equal(yardLoads({}), 0);
  assert.equal(yardLoads({ timber: 1 }), 1);
  assert.equal(yardLoads({ timber: 100 }), 1);
  assert.equal(yardLoads({ timber: 101 }), 2);
  assert.equal(yardLoads({ timber: 400 }), 2, 'the places are the inputCap\'s two boats');
  assert.equal(BUILDINGS.shipyard.inputCap / 100, FISH_YARD.stock.length, 'the yard\'s places are the sim\'s store');
  assert.equal(basketCount(0), 0);
  assert.equal(basketCount(undefined), 0);
  assert.equal(basketCount(1), 1);
  assert.equal(basketCount(100), 4, 'a catch (100) is four baskets');
  assert.equal(basketCount(101), 5);
  assert.equal(basketCount(99999), FISH_WHARF.baskets.length);
  const y = looks('shipyard', { id: 1, waterSide: 1, efficiency: 1, stock: { timber: 150 } });
  assert.equal(y.find((e) => e.key === 'warehouse:load:timber').n, 2);
  const w = looks('wharf', { id: 1, waterSide: 1, efficiency: 1, stock: { fish: 130 } });
  assert.equal(w.find((e) => e.key === 'vessel:catch').n, 6);
  assert.ok(!looks('wharf', { id: 1, waterSide: 1, efficiency: 1, stock: { fish: 0 } }).some((e) => e.key === 'vessel:catch'));
});

test('waterside3d: the boat on the slip by the sim\'s progress, split at 50 as the sprite\'s two looks; none while a spare waits', () => {
  const cases = [[0, 0], [undefined, 0], [-1, 0], [0.5, 1], [24.9, 1], [25, 2], [49.9, 2], [50, 3], [74.9, 3], [75, 4], [99.99, 4]];
  for (const [p, s] of cases) assert.equal(fishHullStep({ progress: p }), s, `progress ${p}`);
  // As buildingArt.js artState: frames under 50 (steps 1, 2), planked from 50 (steps 3, 4).
  for (let p = 1; p < 100; p += 0.5) assert.equal(fishHullStep({ progress: p }) >= 3, p >= 50, `progress ${p}`);
  assert.equal(fishHullStep({ progress: 60, spareId: 7 }), 0, 'the finished boat is afloat: nothing on the slip');
  const b = { id: 1, waterSide: 2, efficiency: 1, stock: {} };
  for (const [p, s] of [[0, 0], [30, 2], [80, 4]]) {
    const keys = looks('shipyard', { ...b, progress: p }).map((e) => e.key);
    assert.equal(keys.includes(`shipyard:hull:${s}`), s > 0, `${p}: ${keys}`);
    assert.equal(keys.filter((k) => k.startsWith('shipyard:hull')).length, s ? 1 : 0);
  }
  // Every stage is built and differs from the one before (more of the boat each time).
  const tris = [1, 2, 3, 4].map((s) => kitOf(MODELS.shipyard.build(`shipyard:hull:${s}`, 0)).triangles);
  assert.ok(tris[0] < tris[1] && tris[1] < tris[2] && tris[2] < tris[3], tris.join(', '));
});

/** The world box of every kit of a look, built at `lod`, placed as the pass places it on an S x S footprint at (vx, vy). */
function lookBox(type, b, lod, T, vx = 20, vy = 9, place = { snow: 0 }, ctx = null, skip = /^(sacra)/) {
  const box = new Box3();
  const m = modelMatrix(vx, vy, SIZE[type], T, 0);
  for (const e of looks(type, b, place, ctx)) {
    if (skip && skip.test(e.key)) continue;
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

test('waterside3d: every look fits its footprint at every side, turn and level of detail, within its height', () => {
  const e = 1e-6;
  for (const type of TYPES) {
    const S = SIZE[type];
    for (let side = 0; side < 4; side++) {
      const b = busiest(type, side);
      for (let lod = 0; lod < 3; lod++) {
        for (let T = 0; T < 4; T++) {
          const box = lookBox(type, b, lod, T);
          const at = `${type} side ${side} lod ${lod} turn ${T}: ${JSON.stringify(box)}`;
          assert.ok(box.min.x >= 20 - e && box.max.x <= 20 + S + e && box.min.z >= 9 - e && box.max.z <= 9 + S + e, at);
          // (Piles and piers go down into the water, which the look clips at its surface.)
          assert.ok(box.min.y > -0.6 / 4 && box.max.y < HEIGHT[type] / 4, at);
        }
      }
    }
  }
});

test('waterside3d: the smoke kits rise over the footprint too (the kettle\'s, the smoke house\'s)', () => {
  // (Their kit is the temples' smoke, drawn at a point of the model: it must stay over the footprint and low.)
  for (const type of ['shipyard', 'wharf']) {
    const l = looks(type, busiest(type, 1));
    const smoke = l.find((e) => e.key === 'sacra:smoke:thin');
    assert.ok(smoke, `${type} smokes while staffed`);
    const g = modelFor(smoke.key).build(smoke.key, 0);
    const box = new Box3().setFromObject(g);
    const m = new Matrix4().fromArray(smoke.mats, 0);
    const p = new Vector3(0, 0, 0).applyMatrix4(m);
    assert.ok(Math.abs(p.x) < SIZE[type] * 2 && Math.abs(p.z) < SIZE[type] * 2, `${type}: the smoke's foot over the footprint`);
    assert.ok(p.y + box.max.y < 6, `${type}: smoke ends at ${p.y + box.max.y}`);
    // Staffed only: nothing smokes when nobody works there.
    assert.ok(!looks(type, { ...busiest(type, 1), efficiency: 0 }).some((e) => e.key === 'sacra:smoke:thin'), `${type}: no smoke when idle`);
  }
});

test('waterside3d: the front line stays clear: the ship\'s and the boats\' moorings lie off it, never over the footprint', () => {
  // ships/moorings.js alongside: a hull parallel to the front, its side MOOR_GAP off it, so a ship or boat at any
  // berth of the front clears the footprint. The model stands wholly inside it (the fit test above).
  const kinds = { dock: 'corbita', shipyard: 'fishing', wharf: 'fishing' };
  for (const type of TYPES) {
    const S = SIZE[type];
    for (let side = 0; side < 4; side++) {
      const map = shoreMap(side, S);
      const b = { x: 4, y: 4, size: S, waterSide: side };
      const { half, beam } = extentOf(DESIGNS[kinds[type]]);
      // Berth -1 is the front's middle; then each water tile just past the front.
      const past = (d) => (side === 0 ? [4 + d, 3] : side === 1 ? [4 + S, 4 + d] : side === 2 ? [4 + d, 4 + S] : [3, 4 + d]);
      const berths = [-1, ...[...Array(S).keys()].map((d) => map.idx(...past(d)))];
      for (const berth of berths) {
        const p = alongside(b, kinds[type], map, berth, null);
        const alongX = side === 0 || side === 2;
        const rect = alongX
          ? { x0: p.x - half / 4, x1: p.x + half / 4, y0: p.y - beam / 4, y1: p.y + beam / 4 }
          : { x0: p.x - beam / 4, x1: p.x + beam / 4, y0: p.y - half / 4, y1: p.y + half / 4 };
        const overlap = rect.x0 < 4 + S && rect.x1 > 4 && rect.y0 < 4 + S && rect.y1 > 4;
        assert.ok(!overlap, `${type} side ${side} berth ${berth}: the ${kinds[type]} at ${p.x.toFixed(2)}, ${p.y.toFixed(2)} over the footprint`);
        // It lies on the water side, close (a hand off the front).
        const out = [[0, -1], [1, 0], [0, 1], [-1, 0]][side];
        const front = side === 1 ? 4 + S : side === 3 ? 4 : side === 0 ? 4 : 4 + S;
        const gap = out[0] ? (p.x - front) * out[0] : (p.y - front) * out[1];
        assert.ok(gap > 0 && gap < 1, `${type} side ${side}: ${gap}`);
      }
    }
  }
});

test('waterside3d: the front rows stand out over the water: piles there, none under the land row', () => {
  // In the model's own metres (front +z): the piles of the jetties' bents and the slip's are over the water rows.
  for (const type of TYPES) {
    for (const key of [type, ...(type === 'shipyard' ? ['shipyard:hull:3'] : [])]) {
      const g = MODELS[type].build(key, 1);
      g.updateMatrixWorld(true);
      let under = 0;
      let underLand = 0;
      g.traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          if (p.getY(i) >= -0.2) continue;
          // (The quay's edge stones at the shore line go down into the water's edge.)
          if (p.getZ(i) > SHORE[type] - 0.35) under++;
          else underLand++;
        }
      });
      if (key === type) assert.ok(under > 50, `${key}: what stands in the water (${under})`);
      assert.equal(underLand, 0, `${key}: nothing under the land row's ground`);
    }
  }
});

test('waterside3d: every tagged part shows in some state, and the states differ; the people work only while staffed', () => {
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
  const names = (type, state) => {
    const out = new Set();
    MODELS[type].build(type, 0).traverse((o) => { if (o.isMesh && partShows(o.userData.when, state, false)) out.add(o.name); });
    return out;
  };
  // The crank hangs only while idle (at work the winder turns his own); the crane's crate swings on its hook only at work.
  for (const type of ['dock', 'shipyard']) {
    assert.ok(!names(type, 'open').has('crank') && names(type, 'shut').has('crank'), type);
  }
  assert.ok(names('dock', 'open').has('crate') && !names('dock', 'shut').has('crate'));
  // The shipyard's fire: embers while staffed, ash when not.
  assert.ok(names('shipyard', 'open').has('fire') && !names('shipyard', 'open').has('ash'));
  assert.ok(names('shipyard', 'shut').has('ash') && !names('shipyard', 'shut').has('fire'));
  // Lanterns: lit while staffed, cold when not.
  for (const type of TYPES) assert.ok(names(type, 'open').has('lamp') && names(type, 'shut').has('lamp'), type);
  // No still mannequins in the kits: the people are actors (people/), only while staffed.
  for (const type of TYPES) assert.ok(![...names(type, 'open'), ...names(type, 'shut')].some((n) => /^(docker|clerk|winder|shipwright|fisherman|gutter|carrier)/.test(n)), type);
  const people = (type, b) => MODELS[type].variant({ id: 1, type, waterSide: 2, stock: {}, accessRoad: 1, ...b }, { snow: 0 }, null).actors.actors;
  for (const type of TYPES) {
    assert.ok(people(type, { efficiency: 1 }).length > 0, `${type}: people while staffed`);
    assert.equal(people(type, { efficiency: 0 }).length, 0, `${type}: nobody when not`);
  }
  // The dock: dockers carrying loads, a winder at the crane, the clerk counting the dues.
  const clips = (type, b) => people(type, b).map((a) => a.clipName);
  assert.equal(clips('dock', { efficiency: 1 }).filter((c) => c === 'carry').length, 2, 'two dockers carrying');
  assert.ok(clips('dock', { efficiency: 1 }).includes('windlass') && clips('dock', { efficiency: 1 }).includes('count'));
  // The shipyard: the shipwright only with a boat on the slip; the winder and the kettle's man always.
  const wrights = (progress) => clips('shipyard', { efficiency: 1, progress }).filter((c) => c === 'hammer').length;
  assert.deepEqual([wrights(0), wrights(60)], [0, 1]);
  assert.ok(clips('shipyard', { efficiency: 1 }).includes('windlass') && clips('shipyard', { efficiency: 1 }).includes('stir'));
  // The wharf: a man seated mending a net, one gutting, one carrying the catch.
  assert.deepEqual(clips('wharf', { efficiency: 1 }).sort(), ['carry', 'count', 'sit']);
});

test('waterside3d: the people stand and walk on the footprint at every side and turn, and each cast is one cast a state', () => {
  const m = new Matrix4();
  const p = new Vector3();
  for (const type of TYPES) {
    const S = SIZE[type];
    for (let side = 0; side < 4; side++) {
      const b = { ...busiest(type, side) };
      const staffed = MODELS[type].variant(b, { snow: 0 }, null);
      assert.equal(staffed.actors, MODELS[type].variant(b, { snow: 0 }, null).actors, `${type}: one cast for a side and state`);
      for (let T = 0; T < 4; T++) {
        modelMatrix(0, 0, S, T, 0, m);
        for (const act of staffed.actors.actors) {
          for (const c of actorBounds(act, 0.3)) {
            for (const [dx, dz] of [[c.r, 0], [-c.r, 0], [0, c.r], [0, -c.r]]) {
              p.set(c.x + dx, 0, c.z + dz).applyMatrix4(m);
              assert.ok(p.x >= -1e-6 && p.x <= S + 1e-6 && p.z >= -1e-6 && p.z <= S + 1e-6, `${type} side ${side} turn ${T}: an actor at ${c.x.toFixed(2)}, ${c.z.toFixed(2)} off the footprint`);
            }
          }
        }
      }
    }
  }
  // (Every spec packs: its clip, props and garments exist.)
  for (const spec of [...tradeDockActors('open'), ...fishYardActors('open', true), ...fishWharfActors('open')]) assert.ok(pack(spec), spec.clip);
  assert.equal(tradeDockActors('shut').length + fishYardActors('shut', true).length + fishWharfActors('shut').length, 0);
});

test('waterside3d: each level of detail is lighter than the one before, and within budget', () => {
  // A look's kits together, its busiest: the building, a finished boat and a full store.
  const budget = [100000, 36000, 9000];
  for (const type of TYPES) {
    const b = busiest(type, 2);
    const t = [0, 1, 2].map((lod) => looks(type, b, { snow: 0 }).reduce((a, e) => a + e.n * kitOf(modelFor(e.key).build(e.key, lod)).triangles, 0));
    assert.ok(t[0] > t[1] && t[1] > t[2], `${type}: ${t}`);
    t.forEach((n, l) => assert.ok(n < budget[l], `${type} lod ${l}: ${n}`));
  }
});

test('waterside3d: the lamps light while staffed, on the footprint, seen at every turn', () => {
  for (const type of TYPES) {
    for (let side = 0; side < 4; side++) {
      const b = { type, size: SIZE[type], efficiency: 1, waterSide: side };
      assert.deepEqual(modelLamps({ ...b, efficiency: 0 }, 0), [], `${type}: dark with nobody at work`);
      for (let T = 0; T < 4; T++) {
        const pts = modelLamps(b, T);
        assert.ok(pts.length >= 1, `${type} side ${side} turn ${T}: a lamp is seen at every turn`);
        for (const [u, v, z] of pts) assert.ok(u >= 0 && u <= SIZE[type] && v >= 0 && v <= SIZE[type] && z > 0, `${type}: ${u}, ${v}, ${z}`);
      }
    }
  }
});

test('waterside3d: an older save\'s building wholly on land keeps its sprite', () => {
  for (const type of TYPES) {
    assert.equal(MODELS[type].fits({ id: 3, type, waterRows: 0 }), false, type);
    assert.equal(MODELS[type].fits({ id: 3, type, waterRows: waterRowsFor(SIZE[type]) }), true, type);
    assert.equal(MODELS[type].fits({ id: null, type }), true, `${type}: a ghost`);
  }
});

test('waterside3d: a hard frost takes the foam from round the piles (the water\'s margins freeze)', () => {
  for (const type of TYPES) {
    const b = { id: 1, type, waterSide: 2, efficiency: 1, stock: {} };
    const warm = looks(type, b, { snow: 1 })[0].key;
    const cold = looks(type, b, { snow: 2 })[1].key;
    assert.equal(warm, `${type}:none`, 'the building\'s own kit is empty: everything is in more');
    assert.equal(looks(type, b, { snow: 1 })[1].key, type);
    assert.equal(cold, `${type}:ice`);
    const foam = (key) => { let n = 0; MODELS[type].build(key, 1).traverse((o) => { if (o.isMesh && o.name === 'foam') n++; }); return n; };
    assert.equal(foam(type), 1, type);
    assert.equal(foam(cold), 0, type);
  }
});

test('waterside3d: the game\'s pass draws a dock from kits shared by every side, its goods as more', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const game = { map: { desirability: [0], idx: () => 0 }, walkers: new Map(), units: new Map() };
  const r = { game, weather: {}, time: 0 };
  const a = { id: 4, type: 'dock', size: 3, x: 0, y: 0, waterSide: 0, efficiency: 1, stock: { timber: 300 } };
  const c = { ...a, id: 5, x: 5, waterSide: 3, stock: { timber: 100, wine: 200 } };
  mp.update(r, [{ b: a, T: 0, vx: 0, vy: 0, state: 0, snow: 0 }, { b: c, T: 0, vx: 5, vy: 0, state: 0, snow: 0 }], 1);
  const count = (id) => { const k = mp.kits.get(id); return k ? Math.max(...k.meshes.map((im) => im.count)) : 0; };
  assert.equal(count('dock|1'), 2, 'one kit of the building for both sides');
  assert.equal(count('warehouse:load:timber|1'), 4, 'three loads and one');
  assert.equal(count('warehouse:load:wine|1'), 2);
  assert.equal(mp.stats.byType.dock, 2);
  // Unstaffed: the crane's crank hangs, and nobody works.
  a.efficiency = 0;
  mp.update(r, [{ b: a, T: 1, vx: 0, vy: 0, state: 0, snow: 0 }], 1);
  const k = mp.kits.get('dock|1');
  const by = (when) => k.meshes.filter((im) => im.userData.part.when === when).reduce((s, im) => s + im.count, 0);
  assert.ok(by('shut') >= 1 && by('open') === 0);
  mp.dispose();
});
