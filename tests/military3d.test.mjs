/**
 * military3d.test.mjs - the 3D forts, barracks and military academy (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - all five have models; a build ghost shows each manned or staffed
 *   - each look fits its 3 x 3 footprint at every view turn and level of
 *     detail, standing on the ground; the stock's kits fit it too
 *   - each level of detail is lighter than the one before, within budget
 *   - a soldier at rest in a fort's yard (data/units.js FORT_YARD) is not
 *     hidden by the model from any of the four corners the camera looks
 *     from: the walls, towers and buildings are kept low where the men stand
 *   - states from the sim's fields: a fort deployed or with men away is
 *     'out' (its standards gone with them), manned or staffed 'open', else
 *     'shut'; the barracks training a recruit 'out'; the academy with men
 *     drilling 'out'
 *   - every part's tag shows in some state; the standards only at home; the
 *     gate open while manned
 *   - the cavalry fort's stalls hold a horse a trooper; the barracks' racks
 *     fill with its stock, its horse line with its horses
 *   - a hard frost freezes the forts' water
 *   - the lanterns light at night only while manned or staffed, on the front
 *   - the game's pass draws a fort by its state from one kit, its stalls'
 *     horses as the farms' horse kits
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Group, Matrix4, Raycaster, Vector3 } from 'three';
import { MODELS, hasModel, modelMatrix, modelLamps, partShows, modelFor } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import {
  fortState, barracksState, academyState, barracksShows, barracksMore, militaryMore, fortMen,
} from '../src/render3d/models/militaryModels.js';
import { TANK_WATER } from '../src/render3d/models/castra.js';
import { CAVALRY_FORT } from '../src/render3d/models/castraEquitum.js';
import { iceMaterial } from '../src/render3d/materials.js';
import { FORT_YARD, FORT_GATEWAY } from '../src/data/units.js';

const FORTS = ['fort_legion', 'fort_archer', 'fort_cavalry'];
const TYPES = [...FORTS, 'barracks', 'military_academy'];
const STATES = ['open', 'out', 'shut'];
const UNIT = { fort_legion: 'legionary', fort_archer: 'archer', fort_cavalry: 'cavalry' };

/** A game with units of forts (each { fort, side }), recruits and drill, a time. */
function gameWith({ units = [], walkers = [], battle = null } = {}) {
  return {
    time: { totalTicks: 1 },
    units: new Map(units.map((u, i) => [i + 1, { id: i + 1, side: 'rome', ...u }])),
    walkers: new Map(walkers.map((w, i) => [100 + i, { id: 100 + i, ...w }])),
    military: battle ? { battle } : {},
  };
}

/** Every key a building type's looks are built under. */
function keysOf(type) {
  if (FORTS.includes(type)) return [type, `${type}:ice`];
  if (type === 'barracks') return ['barracks', 'barracks:set', 'barracks:arrows'];
  return [type];
}

test('military3d: the forts, the barracks and the academy have models; a ghost shows each manned or staffed', () => {
  for (const t of TYPES) assert.ok(hasModel(t), t);
  for (const t of TYPES) {
    const v = MODELS[t].variant({ id: null, type: t, size: 3, efficiency: 1 }, { snow: 0 }, null);
    assert.equal(v.state, 'open', t);
    // (A ghost holds no stock and no horses.)
    assert.equal((v.more || []).length, 0, t);
  }
});

test('military3d: every look fits its 3 x 3 footprint at every turn and level of detail, on the ground', () => {
  const e = 1e-6;
  for (const type of TYPES) {
    for (const key of keysOf(type)) {
      for (let lod = 0; lod < 3; lod++) {
        const g = MODELS[type].build(key, lod);
        g.updateMatrixWorld(true);
        const local = new Box3().setFromObject(g);
        for (let T = 0; T < 4; T++) {
          const b = local.clone().applyMatrix4(modelMatrix(20, 9, 3, T, 0));
          assert.ok(b.min.x >= 20 - e && b.max.x <= 23 + e && b.min.z >= 9 - e && b.max.z <= 12 + e, `${key} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
          assert.ok(b.min.y > -0.01 && b.max.y < 1.25, `${key} lod ${lod}: from ${b.min.y} to ${b.max.y} tiles high`);
        }
      }
    }
  }
  // The stock's kits in their places, and the horses in theirs, inside the footprint.
  const full = barracksMore({ weapons: 400, arrows: 400, horses: 400 });
  const stalls = militaryMore('fort_cavalry', { men: 8 });
  for (const it of [...full, ...stalls, ...militaryMore('military_academy', { state: 'out' })]) {
    const g = modelFor(it.key).build(it.key, 0);
    g.updateMatrixWorld(true);
    const local = new Box3().setFromObject(g);
    for (let j = 0; j < it.n; j++) {
      const b = local.clone().applyMatrix4(new Matrix4().fromArray(it.mats, j * 16));
      assert.ok(b.min.x > -6 && b.max.x < 6 && b.min.z > -6 && b.max.z < 6, `${it.key} #${j}: ${JSON.stringify(b)}`);
    }
  }
});

test('military3d: each level of detail is lighter than the one before, and within budget', () => {
  const budget = [60000, 16000, 5000];
  for (const type of TYPES) {
    const t = [0, 1, 2].map((l) => kitOf(MODELS[type].build(type, l)).triangles);
    assert.ok(t[0] > t[1] && t[1] > t[2], `${type}: ${t}`);
    t.forEach((n, l) => assert.ok(n < budget[l], `${type} lod ${l}: ${n}`));
  }
  // A set of arms, a sheaf of arrows: small enough for eight of each.
  for (const key of ['barracks:set', 'barracks:arrows']) {
    const t = [0, 1, 2].map((l) => kitOf(MODELS.barracks.build(key, l)).triangles);
    assert.ok(t[0] >= t[1] && t[1] >= t[2] && t[0] < 2000, `${key}: ${t}`);
  }
});

/**
 * How much of a figure standing at (x, z) a model hides from the camera at
 * each of its four corners: the lowest height (metres) from which a ray
 * toward the camera (30 degrees down, along a diagonal) is clear of every
 * opaque part but the standards' (thin poles, like the 2D fort's flagpole).
 */
function hiddenAt(meshes, x, z) {
  const rc = new Raycaster();
  const cos = Math.sqrt(0.75) / Math.SQRT2;
  const dirs = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => new Vector3(a * cos, 0.5, b * cos).normalize());
  return dirs.map((d) => {
    let h = 0.05;
    for (; h < 3; h += 0.05) {
      rc.set(new Vector3(x, h, z), d);
      if (!rc.intersectObjects(meshes, false).some((q) => q.distance > 0.02)) break;
    }
    return h;
  });
}

test('military3d: no fort hides its men at rest in the yard, from any corner the camera looks from', () => {
  for (const type of FORTS) {
    for (const lod of [0, 1]) {
      const g = MODELS[type].build(type, lod);
      g.updateMatrixWorld(true);
      // Every opaque part of every state at once (the shut gate's leaves, the sentry), but the standards.
      const meshes = [];
      g.traverse((o) => { if (o.isMesh && !o.material.transparent && !o.name.startsWith('std-')) meshes.push(o); });
      // A trooper on his horse stands taller: a little more of him may go behind a parapet.
      const most = type === 'fort_cavalry' ? 0.5 : 0.41;
      for (const [u, v] of FORT_YARD[UNIT[type]]) {
        const hid = hiddenAt(meshes, (u - 1.5) * 4, (v - 1.5) * 4);
        assert.ok(Math.max(...hid) <= most, `${type} lod ${lod}: a man at (${u}, ${v}) hidden up to ${hid.map((h) => h.toFixed(2))} m`);
      }
      // The gateway is open for the men to walk through (data/units.js FORT_GATEWAY): no opaque part
      // stands in the passage up to a rider's head, the gate's leaves swung back.
      const [gu] = FORT_GATEWAY;
      const gx = (gu - 1.5) * 4;
      const rc = new Raycaster();
      const open = meshes.filter((m) => partShows(m.userData.when, 'open', false));
      for (const y of [0.3, 1.0, 1.7]) {
        rc.set(new Vector3(gx, y, 6.5), new Vector3(0, 0, -1));
        const hit = rc.intersectObjects(open, false).filter((q) => q.point.z > 4.2);
        assert.equal(hit.length, 0, `${type} lod ${lod}: the gateway blocked at ${y} m by ${hit.map((q) => q.object.name)}`);
      }
    }
  }
});

test('military3d: a fort\'s state from the sim: deployed or men away, manned or staffed, empty', () => {
  const f = { id: 7, type: 'fort_legion', efficiency: 1, rally: null };
  const game = gameWith({ units: [{ fort: 7 }, { fort: 7 }, { fort: 9 }] });
  assert.equal(fortState(f, game), 'open');
  assert.equal(fortMen(f, game), 2);
  assert.equal(fortState({ ...f, rally: { x: 3.5, y: 4.5 } }, game), 'out', 'deployed: the standards go out');
  assert.equal(fortState({ ...f, efficiency: 0 }, game), 'open', 'its men home, no staff');
  assert.equal(fortState({ ...f, id: 8, efficiency: 0 }, game), 'shut', 'nobody');
  assert.equal(fortState({ ...f, id: 8, efficiency: 0.5 }, game), 'open', 'staffed, waiting for recruits');
  // Men away at a distant battle (sim/away.js): out, though nobody stands at a rally point.
  const away = gameWith({ battle: { sent: { men: [{ fort: 7, type: 'legionary' }], ships: [] } } });
  assert.equal(fortState(f, away), 'out');
  // The model reads the pass's game.
  assert.equal(MODELS.fort_legion.variant({ ...f, rally: { x: 1, y: 1 } }, { snow: 0 }, { game }).state, 'out');
});

test('military3d: the barracks and the academy\'s states from the sim', () => {
  assert.equal(barracksState({ id: 3, efficiency: 1, trainProgress: 40 }), 'out');
  assert.equal(barracksState({ id: 3, efficiency: 1, trainProgress: 0 }), 'open');
  assert.equal(barracksState({ id: 3, efficiency: 0, trainProgress: 40 }), 'shut');
  const a = { id: 5, efficiency: 1 };
  const quiet = gameWith();
  assert.equal(academyState(a, quiet), 'open');
  assert.equal(academyState({ ...a, efficiency: 0 }, quiet), 'shut');
  // A recruit training there, or a soldier sent from his fort whose days there have begun.
  assert.equal(academyState(a, gameWith({ walkers: [{ type: 'recruit', state: 'training', academy: 5 }] })), 'out');
  assert.equal(academyState(a, gameWith({ walkers: [{ type: 'recruit', state: 'toAcademy', academy: 5 }] })), 'open', 'still on his way');
  assert.equal(academyState(a, gameWith({ units: [{ fort: 2, drill: 5, trainLeft: 30 }] })), 'out');
  assert.equal(academyState(a, gameWith({ units: [{ fort: 2, drill: 5, trainLeft: 0 }] })), 'open', 'not arrived');
  assert.equal(academyState(a, gameWith({ walkers: [{ type: 'recruit', state: 'training', academy: 6 }] })), 'open', 'another academy');
  // A rider in the ring while men drill: the farms' horse.
  assert.deepEqual(MODELS.military_academy.variant(a, { snow: 0 }, { game: gameWith({ units: [{ fort: 2, drill: 5, trainLeft: 3 }] }) }).more.map((m) => m.key), ['horse:2:stand']);
});

/** A built look's meshes by name, each with the states it shows in. */
function shownIn(type, key = type) {
  const out = [];
  MODELS[type].build(key, 0).traverse((o) => {
    if (o.isMesh) out.push({ name: o.name, when: o.userData.when, states: STATES.filter((s) => partShows(o.userData.when, s, false)) });
  });
  return out;
}

test('military3d: every part shows in some state; the standards stay home while deployed; the gate opens while manned', () => {
  for (const type of TYPES) for (const p of shownIn(type)) assert.ok(p.states.length, `${type} ${p.name}|${p.when} shows in no state`);
  for (const type of FORTS) {
    const p = shownIn(type);
    const std = p.filter((v) => v.name.startsWith('std-'));
    assert.ok(std.length >= 3, `${type}: its standards`);
    for (const v of std) assert.deepEqual(v.states, ['open', 'shut'], `${type} ${v.name}`);
    assert.deepEqual(p.filter((v) => v.name === 'doors').map((v) => v.states.join('+')).sort(), ['open+out', 'shut'], type);
    assert.ok(p.some((v) => v.name.startsWith('sentry-') && v.states.join() === 'open'), `${type}: a sentry while manned`);
  }
  // The barracks: a recruit at the post only while one trains, the clerk while staffed.
  const b = shownIn('barracks');
  assert.ok(b.some((v) => v.name.startsWith('recruit-') && v.states.join() === 'out'));
  assert.ok(b.some((v) => v.name.startsWith('clerk-') && v.states.join() === 'open,out'));
  // The academy: men drilling only while they drill, the master while staffed.
  const a = shownIn('military_academy');
  assert.ok(a.some((v) => v.name.startsWith('drill-') && v.states.join() === 'out'));
  assert.ok(a.some((v) => v.name.startsWith('master-') && v.states.join() === 'open,out'));
});

test('military3d: the cavalry\'s stalls hold a horse a trooper; the barracks shows its stock', () => {
  const horses = (more) => more.filter((m) => m.key.startsWith('horse:')).reduce((n, m) => n + m.n, 0);
  for (let n = 0; n <= 8; n++) assert.equal(horses(militaryMore('fort_cavalry', { men: n })), Math.min(n, CAVALRY_FORT.stalls));
  // The same list for the same count (made once).
  assert.equal(militaryMore('fort_cavalry', { men: 3 }), militaryMore('fort_cavalry', { men: 3 }));
  const game = gameWith({ units: [{ fort: 4 }, { fort: 4 }, { fort: 4 }] });
  const v = MODELS.fort_cavalry.variant({ id: 4, type: 'fort_cavalry', efficiency: 1 }, { snow: 0 }, { game });
  assert.equal(horses(v.more), 3);
  // A set of arms for each 50 weapons (a legionary's), a sheaf for each 50 arrows, a horse for each 100.
  assert.deepEqual(barracksShows({}), { sets: 0, sheaves: 0, horses: 0 });
  assert.deepEqual(barracksShows({ weapons: 50, arrows: 51, horses: 99 }), { sets: 1, sheaves: 2, horses: 0 });
  assert.deepEqual(barracksShows({ weapons: 400, arrows: 400, horses: 400 }), { sets: 8, sheaves: 8, horses: 4 });
  const more = barracksMore({ weapons: 150, arrows: 100, horses: 200 });
  assert.equal(more.find((m) => m.key === 'barracks:set').n, 3);
  assert.equal(more.find((m) => m.key === 'barracks:arrows').n, 2);
  assert.equal(horses(more), 2);
  assert.equal(barracksMore({ weapons: 140, arrows: 90, horses: 250 }), more, 'kept by what it shows');
});

test('military3d: in a hard frost the forts\' water is ice', () => {
  for (const type of FORTS) {
    assert.equal(MODELS[type].variant({ id: 1, efficiency: 1 }, { snow: 2 }, null).key, `${type}:ice`);
    assert.equal(MODELS[type].variant({ id: 1, efficiency: 1 }, { snow: 1 }, null).key, type);
    const water = (key) => {
      let m = null;
      MODELS[type].build(key, 1).traverse((o) => { if (o.isMesh && o.name === TANK_WATER) m = o.material; });
      return m;
    };
    assert.equal(water(`${type}:ice`), iceMaterial(), type);
    assert.notEqual(water(type), iceMaterial(), type);
  }
});

test('military3d: the lanterns light at night only while manned or staffed, on the front', () => {
  for (const type of TYPES) {
    const b = { id: 99, type, size: 3, efficiency: 1 };
    assert.deepEqual(modelLamps({ ...b, efficiency: 0 }, 0), [], `${type}: dark with nobody there`);
    const lit = [0, 1, 2, 3].map((T) => modelLamps(b, T));
    for (const pts of lit) for (const [u, v, z] of pts) assert.ok(u >= 0 && u <= 3 && v >= 0 && v <= 3 && z > 5 && z < 40, `${type}: ${u}, ${v}, ${z}`);
    assert.equal(lit.filter((pts) => pts.length).length, 2, type);
  }
  // A deployed fort's gate stays lit (its staff keep it), though its men are out.
  assert.ok(modelLamps({ id: 98, type: 'fort_archer', size: 3, efficiency: 0, rally: { x: 1, y: 1 } }, 0).length > 0);
});

test('military3d: the game\'s pass draws a fort by its state from one kit, its stalls\' horses as the farms\' kits', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const game = gameWith({ units: [{ fort: 4 }, { fort: 4 }] });
  game.map = { desirability: [0], idx: () => 0 };
  const r = { game, weather: {}, time: 0 };
  const b = { id: 4, type: 'fort_cavalry', size: 3, x: 0, y: 0, efficiency: 1, rally: null };
  const frame = () => mp.update(r, [{ b, T: 0, vx: 0, vy: 0, state: 0, snow: 0 }], 2);
  const shown = (when) => mp.kits.get('fort_cavalry|2').meshes.filter((im) => im.userData.part.when === when).reduce((a, im) => a + im.count, 0);
  const horses = () => [...mp.kits.values()].filter((k) => k.key.startsWith('horse:')).reduce((a, k) => a + Math.max(...k.meshes.map((im) => im.count)), 0);
  frame();
  assert.ok(shown('home') >= 1 && shown('staffed') >= 1 && shown('shut') === 0);
  assert.equal(horses(), 2);
  const kit = mp.kits.get('fort_cavalry|2');
  // Deployed: the standards out, the gate open; a third trooper joins.
  b.rally = { x: 9.5, y: 9.5 };
  game.units.set(3, { id: 3, side: 'rome', fort: 4 });
  game.time.totalTicks++;
  frame();
  assert.equal(shown('home'), 0);
  assert.ok(shown('staffed') >= 1);
  assert.equal(horses(), 3);
  assert.equal(mp.kits.get('fort_cavalry|2'), kit, 'the same kit through every state');
  mp.dispose();
});
