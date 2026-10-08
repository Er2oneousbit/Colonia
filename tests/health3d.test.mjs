/**
 * health3d.test.mjs - the 3D barber, physician, baths and hospital (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the four have models; a build ghost shows each at work (the baths dry
 *     where no pipe reaches)
 *   - each look fits its footprint at every view turn and level of detail,
 *     standing on the ground
 *   - each level of detail is lighter than the one before, within budget
 *   - states from the sim's fields: staffed or not; the baths' water and
 *     staff (flowing, still, dry) and the hard frost's ice
 *   - every part's tag shows in some state; people (actors) only at work;
 *     the baths' water, dry floor, smoke, steam and warm vaults by state
 *   - the people meet their work: the barber's razor at his client's head,
 *     the assistant's pestle in the mortar; nobody in a frozen pool
 *   - what a roof shelters takes no snow
 *   - the lanterns light at night only while at work, inside the footprint
 *   - the game's pass draws the baths' three states from one kit
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Group, Matrix4, Vector3 } from 'three';
import { MODELS, hasModel, modelMatrix, modelLamps, partShows } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import { healthState, bathsState } from '../src/render3d/models/health.js';
import { tonstrinaActors, CLIENT_HEAD } from '../src/render3d/models/tonstrina.js';
import { medicusActors, MEDICUS } from '../src/render3d/models/medicus.js';
import { balneumActors } from '../src/render3d/models/balneum.js';
import { valetudinariumActors } from '../src/render3d/models/valetudinarium.js';
import { poseAt, BONE, SHAVE, MORTAR } from '../src/render3d/people/clips.js';
import { REST } from '../src/render3d/people/pose.js';
import { HEAD_C } from '../src/render3d/people/body.js';
import { BUILDINGS } from '../src/data/buildings.js';

const TYPES = ['barber', 'clinic', 'baths', 'hospital'];
const SIZE = (type) => BUILDINGS[type].size;
/** The states each type shows. */
const STATES = { barber: ['open', 'shut'], clinic: ['open', 'shut'], hospital: ['open', 'shut'], baths: ['flowing', 'still', 'dry'] };
/** Its working state. */
const AT_WORK = { barber: 'open', clinic: 'open', hospital: 'open', baths: 'flowing' };

test('health3d: the four have models; a ghost shows each at work, the baths dry with no pipe', () => {
  for (const t of TYPES) {
    assert.ok(hasModel(t), t);
    // (A ghost: no id, staffed as modelPass.js placeGhost makes it, piped where the map is.)
    assert.equal(MODELS[t].variant({ id: null, type: t, efficiency: 1, hasWater: true }, { snow: 0 }, null).state, AT_WORK[t], t);
  }
  assert.equal(MODELS.baths.variant({ id: null, type: 'baths', efficiency: 1, hasWater: false }, { snow: 0 }, null).state, 'dry');
});

test('health3d: every look fits its footprint at every turn and level of detail, on the ground', () => {
  const e = 1e-6;
  for (const type of TYPES) {
    const S = SIZE(type);
    for (const key of type === 'baths' ? ['baths', 'baths:ice'] : [type]) {
      for (let lod = 0; lod < 3; lod++) {
        const g = MODELS[type].build(key, lod);
        g.updateMatrixWorld(true);
        const local = new Box3().setFromObject(g);
        for (let T = 0; T < 4; T++) {
          const b = local.clone().applyMatrix4(modelMatrix(20, 9, S, T, 0));
          assert.ok(b.min.x >= 20 - e && b.max.x <= 20 + S + e && b.min.z >= 9 - e && b.max.z <= 9 + S + e, `${key} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
          assert.ok(b.min.y > -0.003 && b.max.y < 1.3, `${key} lod ${lod}: from ${b.min.y} to ${b.max.y} tiles high`);
        }
      }
    }
  }
});

test('health3d: each level of detail is lighter than the one before, and within budget', () => {
  const budget = { barber: [16000, 5000, 1500], clinic: [28000, 6500, 2500], baths: [40000, 12000, 4500], hospital: [85000, 28000, 6000] };
  for (const type of TYPES) {
    const t = [0, 1, 2].map((l) => kitOf(MODELS[type].build(type, l)).triangles);
    assert.ok(t[0] > t[1] && t[1] > t[2], `${type}: ${t}`);
    t.forEach((n, l) => assert.ok(n < budget[type][l], `${type} lod ${l}: ${n}`));
  }
});

test('health3d: the state from the sim: staffed or not; the baths by their water and staff, frozen in a hard frost', () => {
  assert.equal(healthState({ efficiency: 0.1 }), 'open');
  assert.equal(healthState({ efficiency: 1, walkers: [3] }), 'open');
  assert.equal(healthState({ efficiency: 0, walkers: [3] }), 'shut');
  assert.equal(bathsState({ efficiency: 0.5, hasWater: true }), 'flowing');
  assert.equal(bathsState({ efficiency: 0, hasWater: true }), 'still');
  // (No water: the sim sends no bather out whatever its staff, sim/services.js.)
  assert.equal(bathsState({ efficiency: 1, hasWater: false }), 'dry');
  for (const t of ['barber', 'clinic', 'hospital']) {
    const v = MODELS[t].variant({ type: t, efficiency: 0 }, { snow: 3 }, null);
    assert.deepEqual([v.key, v.state, v.ice], [t, 'shut', false]);
  }
  const frozen = MODELS.baths.variant({ type: 'baths', efficiency: 1, hasWater: true }, { snow: 2 }, null);
  assert.deepEqual([frozen.key, frozen.state, frozen.ice], ['baths:ice', 'flowing', true]);
  const mild = MODELS.baths.variant({ type: 'baths', efficiency: 1, hasWater: true }, { snow: 1 }, null);
  assert.deepEqual([mild.key, mild.ice], ['baths', false]);
  // The baths' own tag: the furnace out and the doors shut, water or none.
  assert.deepEqual(['flowing', 'still', 'dry'].map((s) => partShows('cold', s, false)), [false, true, true]);
});

/** A built look's meshes, each with the states it shows in (and in a hard frost, `ice`). */
function shownIn(type, lod = 0, key = type, ice = false) {
  const out = [];
  MODELS[type].build(key, lod).traverse((o) => {
    if (o.isMesh) out.push({ name: o.name, when: o.userData.when, mesh: o, states: STATES[type].filter((s) => partShows(o.userData.when, s, ice)) });
  });
  return out;
}

test('health3d: every part shows in some state, and each state shows what it should', () => {
  for (const type of TYPES) {
    for (const p of shownIn(type, 0, type, type === 'baths')) assert.ok(p.states.length, `${type} ${p.name}|${p.when} shows in no state`);
  }
  // The people are actors (people/): a few at work, nobody in any other state; none merged into a kit.
  const peopleOf = (type, s) => {
    const b = { type, efficiency: s === 'still' || s === 'shut' ? 0 : 1, hasWater: s !== 'dry' };
    return MODELS[type].variant(b, { snow: 0 }, null).actors.actors.length;
  };
  for (const type of TYPES) {
    assert.ok(peopleOf(type, AT_WORK[type]) >= 3, `${type}: people at work`);
    for (const s of STATES[type].filter((q) => q !== AT_WORK[type])) assert.equal(peopleOf(type, s), 0, `${type}: nobody when ${s}`);
    assert.equal(shownIn(type).filter((p) => /^(customers|patients|bathers|sick)-/.test(p.name)).length, 0, `${type}: no still figures`);
  }
  const states = (type, name, ice = false) => shownIn(type, 0, ice ? `${type}:ice` : type, ice).filter((p) => p.name === name).map((p) => p.states.join('+')).sort();
  // The barber's and the physician's boards across the shop when shut; the physician's cabinet and coals.
  assert.deepEqual(states('barber', 'boards'), ['open', 'shut']);
  assert.deepEqual(states('clinic', 'boards'), ['shut']);
  assert.deepEqual(states('clinic', 'cabinet-doors'), ['open', 'shut']);
  assert.deepEqual(states('clinic', 'coals'), ['open', 'shut']);
  // The hospital's doors, open while it works.
  assert.deepEqual(states('hospital', 'doors'), ['open', 'shut']);
  // The baths: water while piped (frozen in a hard frost), a dry floor without; smoke while the fire is in,
  // steam only in a frost; the vaults warm (no snow) only while it works; the spout runs only at work.
  assert.deepEqual(states('baths', 'pool-water'), ['flowing+still']);
  assert.deepEqual(states('baths', 'leaves'), ['dry']);
  assert.deepEqual(states('baths', 'smoke'), ['flowing']);
  assert.deepEqual(states('baths', 'steam'), ['']);
  assert.deepEqual(states('baths', 'steam', true), ['flowing']);
  assert.deepEqual(states('baths', 'vaults'), ['flowing', 'still+dry']);
  assert.deepEqual(states('baths', 'stream'), ['flowing']);
  assert.deepEqual(states('baths', 'doors'), ['flowing', 'still+dry']);
  const water = shownIn('baths', 0, 'baths:ice', true).find((p) => p.name === 'pool-water');
  assert.equal(water.mesh.material.name, 'ice', 'the pool frozen');
  assert.equal(shownIn('baths', 0, 'baths:ice', true).filter((p) => p.name === 'stream').length, 0, 'no spout running into ice');
  const vaults = shownIn('baths').filter((p) => p.name === 'vaults');
  const snowOn = (p) => p.mesh.material.userData.look.uLookSnowMul.value;
  assert.ok(snowOn(vaults.find((p) => p.when === 'flow')) < snowOn(vaults.find((p) => p.when === 'cold')), 'the heat melts the snow on the vaults');
  // Each lantern's lit pane at work, its dark one when not.
  for (const type of TYPES) {
    const lamps = shownIn(type).filter((p) => p.name === 'lamp');
    assert.ok(lamps.length >= 2, type);
    assert.deepEqual([...new Set(lamps.filter((p) => p.mesh.material.name === 'lantern-pane').flatMap((p) => p.states))], [AT_WORK[type]], type);
    assert.ok(!lamps.filter((p) => p.mesh.material.name === 'lantern-pane-out').some((p) => p.states.includes(AT_WORK[type])), type);
  }
});

test('health3d: inscriptions only close up, and what a roof shelters takes no snow', () => {
  for (const type of TYPES) {
    const letters = (lod) => shownIn(type, lod).filter((p) => p.name === 'letters').length;
    assert.equal(letters(0), 1, `${type}: its name cut or painted in capitals`);
    assert.equal(letters(2), 0, `${type}: no letters far out`);
  }
  const snowOf = (type, name) => shownIn(type).find((q) => q.name === name).mesh.material.userData.look.uLookSnowMul.value;
  for (const type of TYPES) assert.equal(snowOf(type, 'floor'), 0, `${type}: its floor under the roof`);
  assert.equal(snowOf('barber', 'sheltered-wood'), 0);
  assert.ok(snowOf('hospital', 'gravel') > 0, 'the court under the sky takes it');
});

test('health3d: the lanterns light at night only while at work, inside the footprint', () => {
  for (const type of TYPES) {
    const S = SIZE(type);
    const b = { type, size: S, efficiency: 1, hasWater: true };
    assert.deepEqual(modelLamps({ ...b, efficiency: 0 }, 0), [], `${type}: dark with nobody at work`);
    const lit = [0, 1, 2, 3].map((T) => modelLamps(b, T));
    for (const pts of lit) for (const [u, v, z] of pts) assert.ok(u >= 0 && u <= S && v >= 0 && v <= S && z > 3 && z < 40, `${type}: ${u}, ${v}, ${z}`);
    // Lamps on the front are seen from the view at two turns of four (the baths' window, on its side, at another).
    assert.ok(lit.filter((pts) => pts.length).length >= 2, type);
  }
  assert.deepEqual(modelLamps({ type: 'baths', size: 2, efficiency: 1, hasWater: false }, 0), [], 'dry baths: their fire is out');
});

test('health3d: the game\'s pass draws the baths\' three states from one kit', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const game = { walkers: new Map(), map: { desirability: [0], idx: () => 0 } };
  const r = { game, weather: {}, time: 0 };
  const b = { id: 9, type: 'baths', size: 2, x: 0, y: 0, efficiency: 1, hasWater: true };
  const frame = () => mp.update(r, [{ b, T: 0, vx: 0, vy: 0, state: 0, snow: 0 }], 2);
  const shown = (when) => mp.kits.get('baths|2').meshes.filter((im) => im.userData.part.when === when).reduce((a, im) => a + im.count, 0);
  frame();
  const kit = mp.kits.get('baths|2');
  assert.ok(shown('flow') >= 1 && shown('full') >= 1 && shown('cold') === 0 && shown('dry') === 0, 'at work');
  b.efficiency = 0;
  frame();
  assert.ok(shown('flow') === 0 && shown('full') >= 1 && shown('cold') >= 1, 'still');
  b.hasWater = false;
  frame();
  assert.ok(shown('full') === 0 && shown('dry') >= 1 && shown('cold') >= 1, 'dry');
  assert.equal(mp.kits.get('baths|2'), kit, 'the same kit through the three states');
  mp.dispose();
});

test('health3d: the people meet their work: the razor at the client\'s head, the pestle in the mortar, nobody in a frozen pool', () => {
  const frame = (a) => new Matrix4().makeRotationY(a.ry).setPosition(...a.at);
  // The barber: the client's head (the shaved clip's, its middle as body.js makes it) where his shave clip has it.
  const [client, barber] = tonstrinaActors('open');
  const head = (t) => {
    const p = poseAt('shaved', t);
    return new Vector3(...HEAD_C).sub(REST[BONE.head]).applyMatrix4(p.world[BONE.head]).applyMatrix4(frame(client));
  };
  const want = new Vector3(...SHAVE.head).applyMatrix4(frame(barber));
  for (const t of [0, 0.3, 0.6]) assert.ok(head(t).distanceTo(want) < 0.03, `the client's head ${head(t).distanceTo(want).toFixed(3)} from the barber's`);
  assert.ok(Math.abs(CLIENT_HEAD[1] - head(0).y + client.at[1]) < 0.01);
  // The physician's assistant: his clip's mortar on the kit's, its mouth at the height his pestle works.
  const grinder = medicusActors('open').find((a) => a.clip === 'stir');
  const mouth = new Vector3(-0.02, MORTAR.height, MORTAR.ahead).applyMatrix4(frame(grinder));
  assert.ok(Math.hypot(mouth.x - MEDICUS.mortar[0], mouth.z - MEDICUS.mortar[1]) < 0.01, 'over the mortar');
  // (mortar(): the kit's pestle leans in it 0.14 over its foot, the mouth 0.12 over it.)
  let pestle = null;
  MODELS.clinic.build('clinic', 0).traverse((o) => { if (o.isMesh && o.name === 'pestle') pestle = new Box3().setFromObject(o); });
  const foot = (pestle.min.y + pestle.max.y) / 2 - 0.14;
  assert.ok(Math.abs(foot + 0.12 - mouth.y) < 0.01, `the mouth at ${(foot + 0.12).toFixed(3)}, the pestle's work at ${mouth.y.toFixed(3)}`);
  // The baths in a hard frost: nobody standing in the pool's ice; still or dry, nobody.
  assert.equal(balneumActors('flowing', true).length, balneumActors('flowing', false).length - 1);
  assert.equal(balneumActors('still').length + balneumActors('dry').length, 0);
  // The hospital's sick lie abed (the lie clip), in the wards, on the couch, on the table.
  assert.ok(valetudinariumActors('open').filter((a) => a.clip === 'lie').length >= 6);
});
