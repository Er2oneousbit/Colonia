/**
 * monuments3d.test.mjs - the work camp and the Hall of Justice in 3D (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - both have models; every look (each stage's quarters, finished,
 *     sacked, a raid's setback; the camp's supplies) with its `more` kits
 *     fits its footprint at every view turn and level, on the ground
 *   - each level lighter than the one before, within budget
 *   - the stage mapping: the sim's stage and work pick the look, the crew
 *     on site turns the cranes, a halt stills them, a raid topples the
 *     scaffolds; finished, open or shut by its staff
 *   - the camp's state from its crew and staff, its supply from its larder
 *     and water, its parked wagons from its carts out
 *   - the people stand on the footprint at every turn; nobody unstaffed
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Matrix4, Vector3 } from 'three';
import { MODELS, hasModel, modelMatrix, modelFor, modelLamps } from '../src/render3d/models.js';
import { campState, campSupply, basilicaKey, BASILICA_LOOKS } from '../src/render3d/models/monumentModels.js';
import { siteView } from '../src/render3d/models/worksite.js';
import { progOf } from '../src/render3d/models/basilica.js';
import { actorBounds } from '../src/render3d/people/actors.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { MONUMENT_TYPES } from '../src/data/monuments.js';

const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

/** A basilica as the sim keeps it, at quarter q of its building (16 finished). */
function basilica(q, extra = {}, mon = {}) {
  const t = MONUMENT_TYPES.basilica;
  const stage = Math.floor(q / 4);
  const st = t.stages[stage];
  const got = st ? Object.fromEntries(Object.entries(st.goods).map(([g, n]) => [g, n])) : {};
  return {
    id: 5, type: 'basilica', x: 10, y: 10, size: 5, def: BUILDINGS.basilica, efficiency: 1, walkers: [],
    mon: { stage, work: st ? (st.work * (q % 4)) / 4 + 0.01 : 0, got, way: {}, paid: true, halted: false, store: 0, sacked: false, ...mon }, ...extra,
  };
}
const gameWith = (crewOn = null, raid = null) => ({
  time: { totalTicks: 1, totalDays: 50 }, military: { active: raid }, walkers: new Map(), units: new Map(),
  buildings: new Map(crewOn ? [[2, { id: 2, camp: { crew: { state: 'site', since: 0, site: crewOn } } }]] : []),
});

/** Every look a type shows, with its `more`, as one Box3 in its metres. */
function lookBox(key, more, lod) {
  const b = new Box3().setFromObject(modelFor(key).build(key, lod));
  const m = new Matrix4();
  for (const e of more || []) {
    const g = modelFor(e.key).build(e.key, lod);
    g.updateMatrixWorld(true);
    const kb = new Box3().setFromObject(g);
    for (let j = 0; j < e.n; j++) b.union(kb.clone().applyMatrix4(m.fromArray(e.mats, j * 16)));
  }
  return b;
}

test('monuments3d: the work camp and the Hall of Justice have models', () => {
  assert.ok(hasModel('work_camp') && hasModel('basilica'));
  assert.equal(BUILDINGS.work_camp.size, 3);
  assert.equal(BUILDINGS.basilica.size, 5);
});

test('monuments3d: every look fits its footprint at every turn and level, on the ground', () => {
  const e = 1e-6;
  const cases = [
    ...Array.from({ length: 16 }, (_, q) => ({ b: basilica(q), g: gameWith(5) })),
    { b: basilica(6, {}, { setbackRaid: 'raid:3' }), g: gameWith(5, { id: 3 }) },
    { b: basilica(16), g: gameWith() },
    { b: basilica(16, {}, { sacked: true }), g: gameWith() },
    ...['ok', 'hungry', 'dry', 'both'].map((s) => ({
      b: { id: 7, type: 'work_camp', x: 10, y: 10, size: 3, def: BUILDINGS.work_camp, efficiency: 1, walkers: [], camp: { fed: s === 'ok' || s === 'dry', water: s === 'ok' || s === 'hungry', crew: { state: 'home' } } },
      g: gameWith(),
    })),
  ];
  for (const { b, g } of cases) {
    const v = MODELS[b.type].variant(b, { snow: 0 }, { game: g, clock: 7 });
    const S = b.size;
    for (let lod = 0; lod < 3; lod += 2) {
      const box = lookBox(v.key, v.more, lod);
      for (let T = 0; T < 4; T++) {
        const w = box.clone().applyMatrix4(modelMatrix(20, 9, S, T, 0));
        assert.ok(w.min.x >= 20 - e && w.max.x <= 20 + S + e && w.min.z >= 9 - e && w.max.z <= 9 + S + e, `${v.key} lod ${lod} turn ${T}: ${JSON.stringify(w)}`);
        assert.ok(w.min.y > -0.02 && w.max.y < 4.2, `${v.key}: ${w.min.y} to ${w.max.y} tiles`);
      }
    }
  }
});

test('monuments3d: each level of detail lighter than the one before, within budget', () => {
  for (const key of [...BASILICA_LOOKS, 'work_camp:ok', 'work_camp:both']) {
    const n = [0, 1, 2].map((l) => {
      let k = 0;
      modelFor(key).build(key, l).traverse((o) => { if (o.isMesh) k += tris(o.geometry); });
      return k;
    });
    assert.ok(n[0] >= n[1] && n[1] > n[2], `${key}: ${n}`);
    assert.ok(n[0] < 60000 && n[1] < 20000 && n[2] < 8000, `${key}: ${n}`);
  }
});

test('monuments3d: the stage mapping follows the sim: stage, quarters done, crew, halt, raid, finished', () => {
  for (let q = 0; q < 16; q++) {
    const v = siteView(basilica(q), gameWith(5));
    assert.equal(progOf(v), q / 4, `q ${q}`);
    assert.equal(basilicaKey(v), `basilica:p${q}`);
  }
  assert.equal(basilicaKey(siteView(basilica(6, {}, { setbackRaid: 'raid:3' }), gameWith(5, { id: 3 }))), 'basilica:p6:x');
  assert.equal(basilicaKey(siteView(basilica(16), gameWith())), 'basilica:done');
  assert.equal(basilicaKey(siteView(basilica(16, {}, { sacked: true }), gameWith())), 'basilica:sacked');
  // The crew on site turns the treadwheel (siteMotion: its load rises); halted or no crew, it stands still.
  const loadY = (b, g, t) => {
    const v = MODELS.basilica.variant(b, { snow: 0 }, { game: g, clock: t });
    const e = v.more.find((x) => x.key.startsWith('site:load'));
    return new Vector3().setFromMatrixPosition(new Matrix4().fromArray(e.mats, 0)).y;
  };
  assert.ok(loadY(basilica(5), gameWith(5), 8) > loadY(basilica(5), gameWith(5), 2));
  assert.equal(loadY(basilica(5), gameWith(null), 8), loadY(basilica(5), gameWith(null), 2));
  assert.equal(loadY(basilica(5, {}, { halted: true }), gameWith(5), 8), loadY(basilica(5, {}, { halted: true }), gameWith(5), 2));
  // Its people: the crew while on site, the court while it sits; nobody halted, closed or sacked.
  const n = (b, g) => MODELS.basilica.variant(b, { snow: 0 }, { game: g }).actors.actors.length;
  assert.ok(n(basilica(5), gameWith(5)) > 3);
  assert.equal(n(basilica(5, {}, { halted: true }), gameWith(5)), 0);
  assert.equal(n(basilica(5), gameWith(null)), 0);
  assert.ok(n(basilica(16), gameWith()) > 8);
  assert.equal(n(basilica(16, { efficiency: 0.3 }), gameWith()), 0);
  assert.equal(n(basilica(16, {}, { sacked: true }), gameWith()), 0);
  // Its lamps: the porch's, while it sits.
  assert.ok(modelLamps(basilica(16), 0).length > 0);
  assert.equal(modelLamps(basilica(8), 0).length, 0);
});

test('monuments3d: the camp\'s state, supply and wagons from the sim', () => {
  const camp = (extra = {}, c = {}) => ({ id: 7, type: 'work_camp', x: 0, y: 0, size: 3, def: BUILDINGS.work_camp, efficiency: 1, walkers: [], camp: { fed: true, water: true, crew: { state: 'home' }, ...c }, ...extra });
  assert.equal(campState(camp({ efficiency: 0 })), 'shut');
  assert.equal(campState(camp()), 'open');
  for (const s of ['out', 'site', 'back']) assert.equal(campState(camp({}, { crew: { state: s } })), 'out');
  assert.equal(campSupply(camp()), 'ok');
  assert.equal(campSupply(camp({}, { fed: false })), 'hungry');
  assert.equal(campSupply(camp({}, { water: false })), 'dry');
  assert.equal(campSupply(camp({}, { fed: false, water: false })), 'both');
  assert.equal(campSupply(camp({ efficiency: 0 }, { fed: false })), 'ok');
  // Wagons parked: three less the carts on the roads.
  const g = { walkers: new Map([[1, { type: 'cart' }], [2, { type: 'buyer' }]]) };
  const v = MODELS.work_camp.variant(camp({ walkers: [1, 2] }), { snow: 0 }, { game: g });
  assert.equal(v.key, 'work_camp:ok');
  assert.equal(v.more[0].n, 2);
  assert.equal(MODELS.work_camp.variant(camp({ efficiency: 0 }), { snow: 0 }, { game: g }).actors.actors.length, 0);
  assert.ok(MODELS.work_camp.variant(camp(), { snow: 0 }, { game: g }).actors.actors.length > 6);
  assert.ok(MODELS.work_camp.variant(camp({}, { crew: { state: 'site' } }), { snow: 0 }, { game: g }).actors.actors.length <= 3);
  assert.ok(modelLamps(camp(), 0).length >= 2);
  assert.equal(modelLamps(camp({ efficiency: 0 }), 0).length, 0);
});

test('monuments3d: the people stand on the footprint at every view turn', () => {
  const m = new Matrix4();
  const p = new Vector3();
  const looks = [
    ...[0, 2, 5, 6, 9, 10, 13, 14].map((q) => [basilica(q), gameWith(5)]),
    [basilica(16), gameWith()],
    [{ id: 7, type: 'work_camp', x: 0, y: 0, size: 3, def: BUILDINGS.work_camp, efficiency: 1, walkers: [], camp: { fed: true, water: true, crew: { state: 'home' } } }, gameWith()],
  ];
  for (const [b, g] of looks) {
    const v = MODELS[b.type].variant(b, { snow: 0 }, { game: g });
    for (let T = 0; T < 4; T++) {
      modelMatrix(0, 0, b.size, T, 0, m);
      for (const a of v.actors.actors) {
        for (const c of actorBounds(a, 0.25)) {
          for (const [dx, dz] of [[c.r, 0], [-c.r, 0], [0, c.r], [0, -c.r]]) {
            p.set(c.x + dx, 0, c.z + dz).applyMatrix4(m);
            assert.ok(p.x >= -1e-6 && p.x <= b.size + 1e-6 && p.z >= -1e-6 && p.z <= b.size + 1e-6, `${b.type} ${b.mon ? b.mon.stage : ''} turn ${T}: ${c.x.toFixed(2)}, ${c.z.toFixed(2)}`);
          }
        }
      }
    }
  }
});
