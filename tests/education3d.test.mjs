/**
 * education3d.test.mjs - the 3D school, library and academy (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the three have models; a build ghost shows each at work
 *   - each look fits its footprint at every view turn and level of detail,
 *     standing on the ground
 *   - each level of detail is lighter than the one before, within budget
 *   - states from the sim's field: staffed or not (its walkers out change
 *     nothing)
 *   - every part's tag shows in some state; people only while at work, the
 *     doors, the cupboards, the gates and the awning by the state
 *   - what a roof shelters takes no snow
 *   - the lanterns light at night only while staffed, on the front
 *   - the game's pass draws a library's states from one kit
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Group } from 'three';
import { MODELS, hasModel, modelMatrix, modelLamps, partShows } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import { educationState } from '../src/render3d/models/education.js';
import { BUILDINGS } from '../src/data/buildings.js';

const TYPES = ['school', 'library', 'academy'];
const STATES = ['open', 'shut'];
const SIZE = (type) => BUILDINGS[type].size;

test('education3d: the school, the library and the academy have models; a ghost shows each at work', () => {
  for (const t of TYPES) {
    assert.ok(hasModel(t), t);
    // (A ghost: no id, no walkers, staffed as modelPass.js placeGhost makes it.)
    assert.equal(MODELS[t].variant({ id: null, type: t, efficiency: 1 }, { snow: 0 }, null).state, 'open', t);
  }
});

test('education3d: every look fits its footprint at every turn and level of detail, on the ground', () => {
  const e = 1e-6;
  for (const type of TYPES) {
    const S = SIZE(type);
    for (let lod = 0; lod < 3; lod++) {
      const g = MODELS[type].build(type, lod);
      g.updateMatrixWorld(true);
      const local = new Box3().setFromObject(g);
      for (let T = 0; T < 4; T++) {
        const b = local.clone().applyMatrix4(modelMatrix(20, 9, S, T, 0));
        assert.ok(b.min.x >= 20 - e && b.max.x <= 20 + S + e && b.min.z >= 9 - e && b.max.z <= 9 + S + e, `${type} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
        assert.ok(b.min.y > -0.003 && b.max.y < 1.3, `${type} lod ${lod}: from ${b.min.y} to ${b.max.y} tiles high`);
      }
    }
  }
});

test('education3d: each level of detail is lighter than the one before, and within budget', () => {
  const budget = { school: [32000, 8000, 2500], library: [46000, 12000, 4000], academy: [46000, 12000, 4000] };
  for (const type of TYPES) {
    const t = [0, 1, 2].map((l) => kitOf(MODELS[type].build(type, l)).triangles);
    assert.ok(t[0] > t[1] && t[1] > t[2], `${type}: ${t}`);
    t.forEach((n, l) => assert.ok(n < budget[type][l], `${type} lod ${l}: ${n}`));
  }
});

test('education3d: the state from the sim: open while staffed, shut without; walkers out change nothing', () => {
  assert.equal(educationState({ efficiency: 0.05 }), 'open');
  assert.equal(educationState({ efficiency: 1, walkers: [7, 8] }), 'open');
  assert.equal(educationState({ efficiency: 0, walkers: [7] }), 'shut');
  assert.equal(educationState({ efficiency: 0 }), 'shut');
  for (const t of TYPES) {
    const v = MODELS[t].variant({ type: t, efficiency: 0 }, { snow: 3 }, null);
    // (One look a type whatever the weather: nothing here freezes.)
    assert.deepEqual([v.key, v.state, v.ice], [t, 'shut', false]);
  }
});

/** A built look's meshes, each with the states it shows in. */
function shownIn(type, lod = 0) {
  const out = [];
  MODELS[type].build(type, lod).traverse((o) => {
    if (o.isMesh) out.push({ name: o.name, when: o.userData.when, mesh: o, states: STATES.filter((s) => partShows(o.userData.when, s, false)) });
  });
  return out;
}

test('education3d: every part shows in some state, and each state shows what it should', () => {
  for (const type of TYPES) for (const p of shownIn(type)) assert.ok(p.states.length, `${type} ${p.name}|${p.when} shows in no state`);
  const peopleIn = (type, s) => shownIn(type).filter((p) => /^(scholars|readers)-/.test(p.name) && p.states.includes(s)).length;
  // The school's people are actors (people/): the boys, the master, the slave at the gate, while it is open.
  const school = (efficiency) => MODELS.school.variant({ efficiency }).actors.actors;
  assert.ok(school(1).length >= 8, 'the school at its lessons');
  assert.equal(school(0).length, 0, 'nobody when the school is shut');
  for (const type of TYPES.filter((t) => t !== 'school')) {
    assert.ok(peopleIn(type, 'open') >= 3, `${type}: people at work`);
    assert.equal(peopleIn(type, 'shut'), 0, `${type}: nobody when shut`);
    // People only close up: a dozen figures are thousands of triangles under a pixel each further out.
    assert.equal(shownIn(type, 1).filter((p) => /^(scholars|readers)-/.test(p.name)).length, 0, `${type} lod 1`);
  }
  const states = (type, name) => shownIn(type).filter((p) => p.name === name).map((p) => p.states.join('+')).sort();
  // The school: the awning out while it teaches, rolled up when not; the door shut, or its curtain drawn back.
  assert.deepEqual(states('school', 'awning'), ['open']);
  assert.deepEqual(states('school', 'awning-rolled'), ['shut']);
  assert.deepEqual(states('school', 'doors'), ['shut']);
  assert.deepEqual(states('school', 'curtain'), ['open']);
  // The library: its cupboards and its gate open while staffed, shut when not; the rolls always on the shelves.
  assert.deepEqual(states('library', 'cupboard-doors'), ['open', 'shut']);
  assert.deepEqual(states('library', 'gates'), ['open', 'shut']);
  assert.deepEqual(states('library', 'rolls'), ['open+shut']);
  // The academy: the rooms' and the gate's doors.
  assert.deepEqual(states('academy', 'doors'), ['open', 'shut']);
  // Each lantern's lit pane while staffed, its dark one when not.
  for (const type of TYPES) {
    const lamps = shownIn(type).filter((p) => p.name === 'lamp');
    assert.deepEqual(lamps.filter((p) => p.mesh.material.name === 'lantern-pane').flatMap((p) => p.states), ['open'], type);
    assert.deepEqual(lamps.filter((p) => p.mesh.material.name === 'lantern-pane-out').flatMap((p) => p.states), ['shut'], type);
  }
});

test('education3d: inscriptions only close up, and what a roof shelters takes no snow', () => {
  for (const type of TYPES) {
    const letters = (lod) => shownIn(type, lod).filter((p) => p.name === 'letters').length;
    assert.ok(letters(0) === 1, `${type}: its name cut in capitals`);
    // Far out a stroke is under a pixel and the part one more draw call for every building in view.
    assert.equal(letters(2), 0, `${type}: no letters far out`);
  }
  // The look lays snow by a surface's facing (materials.js patchLook): a floor under a roof would whiten.
  const snowOf = (type, name) => {
    const p = shownIn(type).find((q) => q.name === name);
    return p.mesh.material.userData.look.uLookSnowMul.value;
  };
  for (const [type, name] of [['school', 'floor'], ['library', 'hall-floor'], ['library', 'cupboards'], ['academy', 'floor']]) {
    assert.equal(snowOf(type, name), 0, `${type} ${name}`);
  }
  assert.ok(snowOf('library', 'stone') > 0, 'the court under the sky takes it');
});

test('education3d: the lanterns light at night only while staffed, on the front, where the night lights them', () => {
  for (const type of TYPES) {
    const S = SIZE(type);
    const b = { type, size: S, efficiency: 1 };
    assert.deepEqual(modelLamps({ ...b, efficiency: 0 }, 0), [], `${type}: dark with nobody at work`);
    const lit = [0, 1, 2, 3].map((T) => modelLamps(b, T));
    for (const pts of lit) for (const [u, v, z] of pts) assert.ok(u >= 0 && u <= S && v >= 0 && v <= S && z > 5 && z < 40, `${type}: ${u}, ${v}, ${z}`);
    // Lamps on the front are seen from the view at two turns of four.
    assert.equal(lit.filter((pts) => pts.length).length, 2, type);
  }
});

test('education3d: the game\'s pass draws a library\'s states from one kit', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const game = { walkers: new Map(), map: { desirability: [0], idx: () => 0 } };
  const r = { game, weather: {}, time: 0 };
  const b = { id: 9, type: 'library', size: 2, x: 0, y: 0, efficiency: 1 };
  const frame = () => mp.update(r, [{ b, T: 0, vx: 0, vy: 0, state: 0, snow: 0 }], 2);
  const shown = (when) => mp.kits.get('library|2').meshes.filter((im) => im.userData.part.when === when).reduce((a, im) => a + im.count, 0);
  frame();
  assert.ok(shown('open') >= 1 && shown('shut') === 0, 'open');
  const kit = mp.kits.get('library|2');
  b.efficiency = 0;
  frame();
  assert.ok(shown('shut') >= 1 && shown('open') === 0, 'shut');
  assert.equal(mp.kits.get('library|2'), kit, 'the same kit through both states');
  mp.dispose();
});
