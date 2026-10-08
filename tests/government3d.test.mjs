/**
 * government3d.test.mjs - the 3D senate house and governor's residences (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the four have models; a build ghost shows each at work
 *   - each look (its model and every instanced column) fits its footprint at
 *     every view turn and level of detail, standing on the ground
 *   - each level of detail is lighter than the one before, within budget
 *   - states from the sim's fields: staffed or not; trouble (a mob making for
 *     it, an enemy near) puts a staffed one on its guard
 *   - every part's tag shows in some state; people only at work and close
 *     up, the doors and fountains by the state
 *   - a hard frost freezes the residences' water and stops their fountains
 *   - the columns are kits of their own, instanced; what a roof shelters
 *     takes no snow; letters only close up
 *   - the lamps light at night only while staffed, on the front
 *   - the game's pass draws a palace's states from one kit
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Group } from 'three';
import { MODELS, hasModel, modelMatrix, modelLamps, partShows, modelFor } from '../src/render3d/models.js';
import { curiaActors } from '../src/render3d/models/curia.js';
import { kitOf } from '../src/render3d/kit.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import { governmentState, alarmed, governmentLook, ALARM_TILES, GOVERNMENT_TYPES } from '../src/render3d/models/government.js';
import { BUILDINGS } from '../src/data/buildings.js';

const TYPES = ['senate', 'governor_house', 'governor_villa', 'governor_palace'];
const RESIDENCES = TYPES.slice(1);
const STATES = ['open', 'shut', 'out'];
const SIZE = (type) => BUILDINGS[type].size;

/** A game with its walkers and units, for the state's reading of trouble. */
const gameWith = ({ walkers = [], units = [], tick = 1 } = {}) => ({
  time: { totalTicks: tick },
  walkers: new Map(walkers.map((w, i) => [i + 1, w])),
  units: new Map(units.map((u, i) => [i + 1, u])),
});

test('government3d: the senate house and the three residences have models; a ghost shows each at work', () => {
  assert.deepEqual([...GOVERNMENT_TYPES].sort(), [...TYPES].sort());
  for (const t of TYPES) {
    assert.ok(hasModel(t), t);
    // (A ghost: no id, staffed as modelPass.js placeGhost makes it, a game with trouble about.)
    const game = gameWith({ units: [{ side: 'enemy', x: 1, y: 1 }] });
    assert.equal(MODELS[t].variant({ id: null, type: t, x: 0, y: 0, size: SIZE(t), efficiency: 1 }, { snow: 0 }, { game }).state, 'open', t);
  }
});

test('government3d: every look and its columns fit the footprint at every turn and level of detail, on the ground', () => {
  const e = 1e-6;
  for (const type of TYPES) {
    const S = SIZE(type);
    for (let lod = 0; lod < 3; lod++) {
      const g = governmentLook(type, lod);
      g.updateMatrixWorld(true);
      const local = new Box3().setFromObject(g);
      for (let T = 0; T < 4; T++) {
        const b = local.clone().applyMatrix4(modelMatrix(20, 9, S, T, 0));
        assert.ok(b.min.x >= 20 - e && b.max.x <= 20 + S + e && b.min.z >= 9 - e && b.max.z <= 9 + S + e, `${type} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
        assert.ok(b.min.y > -0.003 && b.max.y < 4, `${type} lod ${lod}: from ${b.min.y} to ${b.max.y} tiles high`);
      }
    }
  }
});

/** Triangles a look draws in a state (its model's parts that show, and every column). */
function drawn(type, lod, state = 'open') {
  let n = 0;
  governmentLook(type, lod).traverse((o) => {
    if (o.isMesh && partShows(o.userData.when, state, false)) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
  });
  return n;
}

test('government3d: each level of detail is lighter than the one before, and within budget', () => {
  const budget = {
    senate: [60000, 12000, 4000], governor_house: [60000, 16000, 7000], governor_villa: [80000, 20000, 9000], governor_palace: [95000, 25000, 11000],
  };
  for (const type of TYPES) {
    const t = [0, 1, 2].map((l) => drawn(type, l));
    assert.ok(t[0] > t[1] && t[1] > t[2], `${type}: ${t}`);
    t.forEach((n, l) => assert.ok(n < budget[type][l], `${type} lod ${l}: ${n}`));
  }
});

test('government3d: the state from the sim: shut unstaffed, open staffed, out with a mob or an enemy close', () => {
  const b = { id: 7, x: 10, y: 10, size: 4, efficiency: 1 };
  assert.equal(governmentState({ ...b, efficiency: 0 }, gameWith()), 'shut');
  assert.equal(governmentState(b, gameWith()), 'open');
  assert.equal(governmentState(b, null), 'open');
  // A mob making for this very building, and one making for another.
  assert.equal(governmentState(b, gameWith({ walkers: [{ type: 'rioter', target: 7 }] })), 'out');
  assert.equal(governmentState(b, gameWith({ walkers: [{ type: 'rioter', target: 8 }] })), 'open');
  assert.equal(governmentState(b, gameWith({ walkers: [{ type: 'rioter', target: 7, dead: true }] })), 'open');
  // An enemy within ALARM_TILES of its middle, and one past it; a native warband only while it attacks.
  const mid = b.x + b.size / 2;
  assert.equal(governmentState(b, gameWith({ units: [{ side: 'enemy', x: mid + ALARM_TILES - 1, y: mid }] })), 'out');
  assert.equal(governmentState(b, gameWith({ units: [{ side: 'enemy', x: mid + ALARM_TILES + 1, y: mid }] })), 'open');
  assert.equal(governmentState(b, gameWith({ units: [{ side: 'native', x: mid, y: mid }] })), 'open');
  assert.equal(governmentState(b, gameWith({ units: [{ side: 'native', attacking: true, x: mid, y: mid }] })), 'out');
  assert.equal(governmentState(b, gameWith({ units: [{ side: 'rome', x: mid, y: mid }] })), 'open');
  // Unstaffed, no guard: shut whatever is about.
  assert.equal(governmentState({ ...b, efficiency: 0 }, gameWith({ walkers: [{ type: 'rioter', target: 7 }] })), 'shut');
  // The trouble is read once a tick (cached by the tick): a new tick sees the mob gone.
  const game = gameWith({ walkers: [{ type: 'rioter', target: 7 }], tick: 5 });
  assert.ok(alarmed(game, b));
  game.walkers.clear();
  assert.ok(alarmed(game, b), 'the same tick: cached');
  game.time.totalTicks = 6;
  assert.ok(!alarmed(game, b), 'the next tick');
});

/** A built look's own meshes (not its columns), each with the states it shows in. */
function shownIn(type, lod = 0) {
  const out = [];
  MODELS[type].build(type, lod).traverse((o) => {
    if (o.isMesh) out.push({ name: o.name, when: o.userData.when, mesh: o, states: STATES.filter((s) => partShows(o.userData.when, s, false)) });
  });
  return out;
}

test('government3d: every part shows in some state, and each state shows what it should', () => {
  for (const type of TYPES) for (const p of shownIn(type)) assert.ok(p.states.length, `${type} ${p.name}|${p.when} shows in no state`);
  const peopleIn = (type, s, lod = 0) => shownIn(type, lod).filter((p) => /^(senators|household|guard|guard-more)-/.test(p.name) && p.states.includes(s)).length;
  // The senate's people are actors (people/): senators in session, soldiers of the guard on the alert, nobody idle.
  const senate = (s) => curiaActors(s);
  assert.ok(senate('open').length >= 8 && senate('open').every((a) => a.dress.some((d) => d.startsWith('toga')) || a.props), 'the senate in session');
  assert.ok(senate('out').length >= 2 && senate('out').every((a) => a.clip === 'guard'), 'the guard on the alert');
  assert.equal(senate('shut').length, 0, 'nobody in an empty senate');
  for (const type of TYPES) {
    // (The doors and lamps below for every type; the kits' people for the residences.)
    if (type === 'senate') {
      const doors = shownIn(type).filter((p) => p.name === 'doors').map((p) => p.states.join('+')).sort();
      assert.deepEqual(doors, ['open', 'out', 'shut'], type);
      continue;
    }
    assert.ok(peopleIn(type, 'open') >= 3, `${type}: people at work`);
    assert.equal(peopleIn(type, 'shut'), 0, `${type}: nobody when shut`);
    assert.ok(peopleIn(type, 'out') >= 1, `${type}: guards on the alert`);
    // The household gone in when trouble comes; nobody far out (a crowd is thousands of triangles under a pixel each).
    assert.equal(shownIn(type).filter((p) => /^(senators|household)-/.test(p.name) && p.states.includes('out')).length, 0, `${type}: the household indoors`);
    assert.equal(peopleIn(type, 'open', 1), 0, `${type} lod 1`);
    // Doors: open at work, shut idle and on the alert.
    const doors = shownIn(type).filter((p) => p.name === 'doors').map((p) => p.states.join('+')).sort();
    assert.deepEqual(doors, ['open', 'out', 'shut'], type);
    // The lanterns' lit panes while there is anyone there, dark when idle.
    const lamps = shownIn(type).filter((p) => p.name === 'lamp');
    assert.deepEqual(lamps.filter((p) => p.mesh.material.name === 'lantern-pane').flatMap((p) => p.states), ['open', 'out'], type);
    assert.deepEqual(lamps.filter((p) => p.mesh.material.name === 'lantern-pane-out').flatMap((p) => p.states), ['shut'], type);
  }
  // The fountains play while the house is kept; the standards fly while the governor is in residence.
  for (const type of ['governor_villa', 'governor_palace']) {
    assert.deepEqual(shownIn(type).filter((p) => p.name === 'jet').flatMap((p) => p.states), ['open', 'out'], type);
  }
  for (const type of RESIDENCES) assert.ok(shownIn(type).some((p) => p.name === 'standard' && p.states.join() === 'open,out'), type);
});

test('government3d: a hard frost freezes the residences\' water and stops their fountains; the senate holds none', () => {
  for (const type of RESIDENCES) {
    const v = MODELS[type].variant({ id: 3, type, x: 0, y: 0, size: SIZE(type), efficiency: 1 }, { snow: 3 }, null);
    assert.equal(v.key, `${type}:ice`);
    const names = (key) => {
      const out = [];
      MODELS[type].build(key, 0).traverse((o) => { if (o.isMesh) out.push([o.name, o.material.name]); });
      return out;
    };
    const iced = names(`${type}:ice`);
    assert.ok(iced.filter(([n]) => n === 'water' || n === 'pool').every(([, m]) => m === 'ice'), `${type}: water frozen`);
    assert.ok(iced.some(([n]) => n === 'water' || n === 'pool'), `${type}: has water`);
    assert.equal(iced.filter(([n]) => n === 'jet' || n === 'rings' || n === 'sheet').length, 0, `${type}: no fountain running`);
    assert.equal(MODELS[type].variant({ id: 3, type, x: 0, y: 0, size: SIZE(type), efficiency: 1 }, { snow: 1 }, null).key, type);
  }
  assert.equal(MODELS.senate.variant({ id: 3, type: 'senate', x: 0, y: 0, size: 4, efficiency: 1 }, { snow: 3 }, null).key, 'senate');
});

test('government3d: the columns are kits of their own, one copy a column, built by their key', () => {
  for (const type of TYPES) {
    const v = MODELS[type].variant({ id: 3, type, x: 0, y: 0, size: SIZE(type), efficiency: 1 }, { snow: 0 }, null);
    assert.ok(v.more.length >= 1, type);
    for (const it of v.more) {
      assert.ok(it.key.startsWith(`${type}:col:`), it.key);
      assert.equal(it.mats.length, it.n * 16);
      assert.ok(it.n >= 4, `${type}: ${it.n} columns`);
      // modelPass.js builds a part's kit by its key's first word: the type's own builder.
      const k = kitOf(modelFor(it.key).build(it.key, 1));
      assert.ok(k.triangles > 50 && k.parts.length <= 2, `${it.key}: ${k.triangles} triangles in ${k.parts.length} parts`);
      assert.ok(MODELS[type].warm.includes(it.key), `${it.key} warmed`);
    }
  }
  // The same list every frame (made once), not a new one a building.
  const a = MODELS.governor_palace.variant({ id: 1, type: 'governor_palace', x: 0, y: 0, size: 5, efficiency: 1 }, { snow: 0 }, null).more;
  const b = MODELS.governor_palace.variant({ id: 2, type: 'governor_palace', x: 9, y: 9, size: 5, efficiency: 0 }, { snow: 0 }, null).more;
  assert.equal(a, b);
});

test('government3d: what a roof shelters takes no snow; letters only close up', () => {
  const snowOf = (type, name) => {
    const p = shownIn(type).find((q) => q.name === name);
    return p.mesh.material.userData.look.uLookSnowMul.value;
  };
  for (const type of RESIDENCES) {
    assert.equal(snowOf(type, 'fresco'), 0, `${type} fresco`);
    assert.equal(snowOf(type, 'floor'), 0, `${type} floor`);
    assert.ok(snowOf(type, 'roof') > 0, `${type} roof`);
  }
  for (const type of ['senate', 'governor_palace']) {
    assert.equal(shownIn(type, 0).filter((p) => p.name === 'letters').length, 1, `${type}: its name cut in capitals`);
    assert.equal(shownIn(type, 2).filter((p) => p.name === 'letters').length, 0, `${type}: none far out`);
  }
});

test('government3d: the lamps light at night only while staffed, on the front, where the night lights them', () => {
  for (const type of TYPES) {
    const S = SIZE(type);
    const b = { type, size: S, efficiency: 1 };
    assert.deepEqual(modelLamps({ ...b, efficiency: 0 }, 0), [], `${type}: dark with nobody there`);
    const lit = [0, 1, 2, 3].map((T) => modelLamps(b, T));
    for (const pts of lit) for (const [u, v, z] of pts) assert.ok(u >= 0 && u <= S && v >= 0 && v <= S && z > 5 && z < 60, `${type}: ${u}, ${v}, ${z}`);
    assert.equal(lit.filter((pts) => pts.length).length, 2, type);
  }
});

test('government3d: the game\'s pass draws a palace\'s states from one kit, its columns instanced', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const game = gameWith();
  game.map = { desirability: [0], idx: () => 0 };
  const r = { game, weather: {}, time: 0 };
  const b = { id: 9, type: 'governor_palace', size: 5, x: 0, y: 0, efficiency: 1 };
  const frame = () => mp.update(r, [{ b, T: 0, vx: 0, vy: 0, state: 0, snow: 0 }], 2);
  const kit = () => mp.kits.get('governor_palace|2');
  const shown = (when) => kit().meshes.filter((im) => im.userData.part.when === when).reduce((a, im) => a + im.count, 0);
  frame();
  assert.ok(shown('open') >= 1 && shown('shut') === 0 && shown('out') === 0, 'open');
  const first = kit();
  // The court's columns: one copy a column, in one kit.
  const cols = mp.kits.get('governor_palace:col:0|2');
  assert.ok(cols && cols.meshes[0].count === MODELS.governor_palace.variant(b, { snow: 0 }, null).more[0].n);
  b.efficiency = 0;
  frame();
  assert.ok(shown('shut') >= 1 && shown('open') === 0, 'shut');
  b.efficiency = 1;
  game.walkers.set(1, { type: 'rioter', target: 9 });
  game.time.totalTicks++;
  frame();
  assert.ok(shown('out') >= 1 && shown('open') === 0, 'out');
  assert.equal(kit(), first, 'the same kit through every state');
  mp.dispose();
});

test('government3d: a wall leaves every opening open, a window over a door too (the curia\'s front)', async () => {
  const { wallAlong } = await import('../src/render3d/models/domus.js');
  const ops = [{ a: -1.25, b: 1.25, lo: 0, hi: 4.3 }, { a: -0.5, b: 0.5, lo: 6, hi: 7 }, { a: 2, b: 3, lo: 6, hi: 7 }];
  const pieces = wallAlong('x', -5, 5, 0, 0.4, 0, 9, ops);
  const covered = (x, y) => pieces.some((g) => {
    g.computeBoundingBox();
    const bb = g.boundingBox;
    return x > bb.min.x && x < bb.max.x && y > bb.min.y && y < bb.max.y;
  });
  for (const o of ops) assert.ok(!covered((o.a + o.b) / 2, (o.lo + o.hi) / 2), `opening at ${o.a}..${o.b}, ${o.lo}..${o.hi}`);
  // And the wall is whole round them: between the door and the window over it, beside them, above.
  for (const [x, y] of [[0, 5], [0, 8], [-3, 2], [4, 6.5], [1, 6.5]]) assert.ok(covered(x, y), `wall at ${x}, ${y}`);
});
