/**
 * religion3d.test.mjs - the 3D temples, the oracle and the mission post (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the twelve types have models; a build ghost shows each at work
 *   - each look (its own kit and every kit of its `more`) fits its footprint
 *     at every view turn and level of detail, standing on the ground
 *   - each level of detail is lighter than the one before, within budget
 *   - states from the sim's fields: staffed or not, its god's festival this
 *     month, its god angered (the smoke); the oracle always at work, the
 *     mission post staffed or not
 *   - every part's tag shows in some state; the doors, the fire and the
 *     people by the state, people only close up, garlands only at a festival
 *   - the body and the columns are shared kits: every god's temple of a size
 *     draws the same body, the gods of an order the same columns
 *   - a hard frost freezes the oracle's spring
 *   - the lamps light at night while staffed (the oracle's always), on the front
 *   - the game's pass draws five gods' temples from one body kit
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Group } from 'three';
import { MODELS, hasModel, modelMatrix, modelLamps, partShows, modelFor } from '../src/render3d/models.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import {
  RELIGION_TYPES, TEMPLE_TYPES, GRAND_TYPES, religionLook, templeState, festivalNow, godAngry, missionState,
} from '../src/render3d/models/religion.js';
import { NUMEN, GODS } from '../src/render3d/models/numina.js';
import { BUILDINGS } from '../src/data/buildings.js';

const SIZE = (type) => BUILDINGS[type].size;
const STATES = ['open', 'shut', 'out'];
/** The parts the religion module does not own (the farms' pig and olive, the warehouse's loads): their own builders. */
const extra = (key, lod) => modelFor(key).build(key, lod);

/** A game whose god `god` has had a festival this month (`fest`) and is angered (`angry`). */
const gameWith = (god, { fest = false, angry = false } = {}) => ({
  city: { gods: { [god]: { festivalsHeld: fest ? 1 : 0, monthsSinceFestival: fest ? 0 : 3, angered: angry } } },
});

const building = (type, props = {}) => ({ id: 5, type, x: 0, y: 0, size: SIZE(type), efficiency: 1, ...props });

test('religion3d: the temples, the oracle and the mission post have models; a ghost shows each at work', () => {
  assert.equal(RELIGION_TYPES.length, 12);
  for (const t of RELIGION_TYPES) {
    assert.ok(hasModel(t), t);
    const god = BUILDINGS[t].god;
    // (A ghost: no id, staffed as modelPass.js placeGhost makes it, its god's festival on.)
    const game = god ? gameWith(god, { fest: true, angry: true }) : null;
    const v = MODELS[t].variant({ id: null, type: t, x: 0, y: 0, size: SIZE(t), efficiency: 1 }, { snow: 0 }, { game });
    assert.equal(v.state, 'open', t);
    assert.ok(!v.more.some((e) => e.key === 'sacra:smoke:wrath'), `${t}: a ghost has no omen`);
  }
});

test('religion3d: every look fits its footprint at every turn and level of detail, on the ground', () => {
  const e = 1e-6;
  for (const type of RELIGION_TYPES) {
    const S = SIZE(type);
    for (let lod = 0; lod < 3; lod++) {
      // (Angry too: an angry god's smoke is the tallest and widest thing a temple shows.)
      for (const [state, angry] of type.startsWith('temple') ? [...STATES.map((s) => [s, false]), ['open', true], ['out', true]] : [['open', false]]) {
        const g = religionLook(type, lod, { state, angry, extra });
        g.updateMatrixWorld(true);
        const local = new Box3().setFromObject(g);
        for (let T = 0; T < 4; T++) {
          const b = local.clone().applyMatrix4(modelMatrix(20, 9, S, T, 0));
          assert.ok(b.min.x >= 20 - e && b.max.x <= 20 + S + e && b.min.z >= 9 - e && b.max.z <= 9 + S + e, `${type} ${state} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
          assert.ok(b.min.y > -0.003 && b.max.y < 4, `${type} ${state} lod ${lod}: from ${b.min.y} to ${b.max.y} tiles high`);
        }
      }
    }
  }
});

/** Triangles a look draws in a state (each kit's parts that show in its own state). */
function drawn(type, lod, state = 'open') {
  let n = 0;
  religionLook(type, lod, { state, extra }).traverse((o) => {
    if (o.isMesh && partShows(o.userData.when, o.userData.state, false)) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
  });
  return n;
}

test('religion3d: each level of detail is lighter than the one before, and within budget', () => {
  const budget = (type) => (type.startsWith('temple_large') ? [85000, 19000, 6500] : type.startsWith('temple') ? [52000, 12000, 3600] : type === 'oracle' ? [56000, 14000, 5600] : [40000, 13000, 2500]);
  for (const type of RELIGION_TYPES) {
    const t = [0, 1, 2].map((l) => drawn(type, l));
    assert.ok(t[0] > t[1] && t[1] > t[2], `${type}: ${t}`);
    t.forEach((n, l) => assert.ok(n < budget(type)[l], `${type} lod ${l}: ${n}`));
  }
});

test('religion3d: the state from the sim: unstaffed, at work, its god\'s festival this month; the omen of an angry god', () => {
  for (const type of [...TEMPLE_TYPES, ...GRAND_TYPES]) {
    const god = BUILDINGS[type].god;
    assert.equal(templeState(building(type, { efficiency: 0 }), gameWith(god, { fest: true })), 'shut', type);
    assert.equal(templeState(building(type), gameWith(god)), 'open', type);
    assert.equal(templeState(building(type), null), 'open', type);
    assert.equal(templeState(building(type), gameWith(god, { fest: true })), 'out', type);
    // Another god's festival is not this temple's.
    const other = GODS.find((g) => g !== god);
    assert.equal(templeState(building(type), gameWith(other, { fest: true })), 'open', type);
    const smoke = (b, game) => MODELS[type].variant(b, { snow: 0 }, { game }).more.filter((m) => m.key.startsWith('sacra:smoke')).map((m) => m.key);
    assert.deepEqual(smoke(building(type), gameWith(god)), ['sacra:smoke:thin'], type);
    assert.deepEqual(smoke(building(type), gameWith(god, { fest: true })), ['sacra:smoke:thick'], type);
    assert.deepEqual(smoke(building(type), gameWith(god, { angry: true })), ['sacra:smoke:wrath'], type);
    assert.deepEqual(smoke(building(type), gameWith(god, { angry: true, fest: true })), ['sacra:smoke:wrath'], type);
    // Unstaffed: the fire out, no smoke at all, angry or not.
    assert.deepEqual(smoke(building(type, { efficiency: 0 }), gameWith(god, { angry: true })), [], type);
    // The festival's victim by the altar: the farms' pig, only then.
    const pig = (game) => MODELS[type].variant(building(type), { snow: 0 }, { game }).more.some((m) => m.key.startsWith('pig:'));
    assert.ok(pig(gameWith(god, { fest: true })) && !pig(gameWith(god)), type);
  }
  // A festival this month: months since it back at 0 with one held; never in a new game.
  assert.ok(festivalNow(gameWith('mars', { fest: true }), 'mars'));
  assert.ok(!festivalNow({ city: { gods: { mars: { festivalsHeld: 0, monthsSinceFestival: 0 } } } }, 'mars'));
  assert.ok(!festivalNow({ city: { gods: { mars: { festivalsHeld: 2, monthsSinceFestival: 1 } } } }, 'mars'));
  assert.ok(godAngry(gameWith('venus', { angry: true }), 'venus') && !godAngry(gameWith('venus'), 'venus') && !godAngry(null, 'venus'));
  // The oracle has no staff: always at work. The mission post: staffed or not.
  assert.equal(MODELS.oracle.variant(building('oracle', { efficiency: 0 }), { snow: 0 }, null).state, 'open');
  assert.equal(missionState(building('mission_post')), 'open');
  assert.equal(missionState(building('mission_post', { efficiency: 0 })), 'shut');
});

/** A kit's meshes, each with the states it shows in. */
function partsOf(key, lod = 0) {
  const out = [];
  modelFor(key).build(key, lod).traverse((o) => {
    if (o.isMesh) out.push({ name: o.name, when: o.userData.when, mesh: o, states: STATES.filter((s) => partShows(o.userData.when, s, false)) });
  });
  return out;
}

test('religion3d: every part shows in some state; the doors, the fire, the people and the garlands by the state', () => {
  const keys = [...RELIGION_TYPES, 'aedes:body', 'templum:body', 'aedes:col:tuscan', 'aedes:col:ionic', 'aedes:col:corinthian', 'templum:col:corinthian', 'templum:porticus', 'oracle:col', 'sacra:smoke:wrath'];
  for (const key of keys) for (const p of partsOf(key)) assert.ok(p.states.length, `${key} ${p.name}|${p.when} shows in no state`);
  for (const key of ['aedes:body', 'templum:body']) {
    const parts = partsOf(key);
    const by = (name) => parts.filter((p) => p.name === name).map((p) => p.states.join('+')).sort();
    // Doors open while kept (and at a festival), shut when not.
    assert.deepEqual(by('doors'), ['open+out', 'shut'], key);
    // The fire's embers while kept, its flames (the festival's bigger), cold ash when not.
    assert.deepEqual(by('fire'), ['open+out'], key);
    assert.deepEqual(by('flames'), ['open', 'out'], key);
    assert.deepEqual(by('ash'), ['shut'], key);
    assert.deepEqual(by('garlands'), ['out'], key);
    const people = (s, lod = 0) => partsOf(key, lod).filter((p) => /^(rite|feast)-/.test(p.name) && p.states.includes(s)).length;
    assert.ok(people('open') >= 2 && people('out') >= 3, key);
    assert.equal(people('shut'), 0, `${key}: nobody when unstaffed`);
    assert.equal(people('open', 1), 0, `${key}: people only close up`);
  }
  // The mission post: the gate open while kept, the standard flying, the envoys at the gate.
  const mp = partsOf('mission_post');
  assert.deepEqual(mp.filter((p) => p.name === 'gate').map((p) => p.states.join()).sort(), ['open', 'shut']);
  assert.ok(mp.some((p) => p.name === 'standard-cloth' && p.states.join() === 'open'));
  assert.ok(mp.some((p) => /^envoys-/.test(p.name) && p.states.join() === 'open'));
});

test('religion3d: the body and the columns are shared: every god\'s temple of a size draws the same body, an order the same columns', () => {
  for (const [types, word] of [[TEMPLE_TYPES, 'aedes'], [GRAND_TYPES, 'templum']]) {
    const bodies = new Set();
    for (const type of types) {
      const god = BUILDINGS[type].god;
      const v = MODELS[type].variant(building(type), { snow: 0 }, { game: gameWith(god) });
      assert.equal(v.key, type, 'the god\'s own kit');
      bodies.add(v.more.find((m) => m.key.endsWith(':body')).key);
      const cols = v.more.find((m) => m.key.includes(':col:'));
      assert.equal(cols.key, `${word}:col:${NUMEN[god].order}`);
      assert.equal(cols.mats.length, cols.n * 16);
      for (const m of v.more) assert.ok(MODELS[type].warm.includes(m.key) || /^(sacra:smoke:(thick|wrath)|pig:)/.test(m.key), `${type}: ${m.key} warmed`);
      // The god's own kit is the lesser part of the look: most of it is shared.
      const own = drawnKit(type, 0, 'open');
      assert.ok(own < drawnKit(`${word}:body`, 0, 'open') + drawnKit(cols.key, 0, 'always') * cols.n, `${type}: ${own}`);
    }
    assert.deepEqual([...bodies], [`${word}:body`]);
  }
  // The same list every frame for the same state (made once), not a new one a building.
  const a = MODELS.temple_mars.variant(building('temple_mars', { id: 1 }), { snow: 0 }, { game: gameWith('mars') }).more;
  const b = MODELS.temple_mars.variant(building('temple_mars', { id: 2, x: 9 }), { snow: 0 }, { game: gameWith('mars') }).more;
  assert.equal(a, b);
});

/** Triangles of one kit that show in a state. */
function drawnKit(key, lod, state) {
  let n = 0;
  modelFor(key).build(key, lod).traverse((o) => {
    if (o.isMesh && partShows(o.userData.when, state, false)) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
  });
  return n;
}

test('religion3d: a hard frost freezes the oracle\'s spring; the snow keeps off what a roof shelters', () => {
  assert.equal(MODELS.oracle.variant(building('oracle'), { snow: 3 }, null).key, 'oracle:ice');
  assert.equal(MODELS.oracle.variant(building('oracle'), { snow: 1 }, null).key, 'oracle');
  const water = (key) => partsOf(key).filter((p) => p.name === 'water').map((p) => p.mesh.material.name);
  assert.deepEqual(water('oracle:ice'), ['ice']);
  assert.ok(!partsOf('oracle:ice').some((p) => p.name === 'stream'), 'the spring stops');
  const snowOf = (key, name) => partsOf(key).find((p) => p.name === name).mesh.material.userData.look.uLookSnowMul.value;
  assert.equal(snowOf('aedes:body', 'floor'), 0);
  assert.ok(snowOf('aedes:body', 'roof') > 0);
});

test('religion3d: the lamps light at night while staffed (the oracle\'s always), on the front', () => {
  for (const type of RELIGION_TYPES) {
    const S = SIZE(type);
    const b = { type, size: S, efficiency: 1 };
    if (type !== 'oracle') assert.deepEqual(modelLamps({ ...b, efficiency: 0 }, 0), [], `${type}: dark with nobody there`);
    else assert.ok(modelLamps({ ...b, efficiency: 0 }, 0).length, 'the oracle\'s fires burn unstaffed');
    const lit = [0, 1, 2, 3].map((T) => modelLamps(b, T));
    for (const pts of lit) for (const [u, v, z] of pts) assert.ok(u >= 0 && u <= S && v >= 0 && v <= S && z > 1 && z < 60, `${type}: ${u}, ${v}, ${z}`);
    assert.equal(lit.filter((pts) => pts.length).length, 2, type);
  }
});

test('religion3d: the game\'s pass draws five gods\' temples from one body kit, each god\'s own apart', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const game = { city: { gods: Object.fromEntries(GODS.map((g) => [g, { festivalsHeld: 0, monthsSinceFestival: 2, angered: false }])) }, map: { desirability: [0], idx: () => 0 } };
  const r = { game, weather: {}, time: 0 };
  const placed = TEMPLE_TYPES.map((type, i) => ({ b: { id: i + 1, type, size: 2, x: i * 3, y: 0, efficiency: 1 }, T: 0, vx: i * 3, vy: 0, state: 0, snow: 0 }));
  mp.update(r, placed, 2);
  const count = (key, when) => mp.kits.get(`${key}|2`).meshes.filter((im) => im.userData.part.when === when).reduce((a, im) => Math.max(a, im.count), 0);
  assert.equal(count('aedes:body', 'always'), 5, 'one body kit, five copies');
  assert.equal(count('aedes:col:corinthian', 'always'), 3 * 6, 'Mercury, Mars and Venus: six columns each');
  for (const type of TEMPLE_TYPES) assert.equal(count(type, 'always'), 1, type);
  // A festival of Mars: his temple's body shows the feast, the others' stay at work, from the same kit.
  game.city.gods.mars.festivalsHeld = 1;
  game.city.gods.mars.monthsSinceFestival = 0;
  mp.update(r, placed, 2);
  assert.equal(count('aedes:body', 'out'), 1);
  assert.equal(count('aedes:body', 'open'), 4);
  mp.dispose();
});
