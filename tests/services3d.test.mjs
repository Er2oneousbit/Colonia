/**
 * services3d.test.mjs - the 3D prefecture and engineer's post (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - both have models; a build ghost shows them staffed, the crew at home
 *   - each look fits its one tile at every view turn and level of detail,
 *     standing on the ground
 *   - each level of detail is lighter than the one before, within budget
 *   - states from the sim's fields: staffed or not; a prefecture's crew out
 *     at a fire (its walkers on fire duty, counted as sim/risk.js counts
 *     them) empties its racks and leaves one man at the door
 *   - every part's tag shows in at least one state, and the states differ
 *   - a hard frost freezes the pump's water
 *   - the lanterns light at night only while staffed, on the front
 *   - the game's pass draws a prefecture's parts by its state
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Group } from 'three';
import { MODELS, hasModel, modelMatrix, modelLamps, partShows } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import { prefectureState, engineerState, crewOut } from '../src/render3d/models/services.js';
import { PUMP_WATER, prefectureActors } from '../src/render3d/models/prefecture.js';
import { ENGINEER } from '../src/render3d/models/engineer.js';
import { iceMaterial } from '../src/render3d/materials.js';

const TYPES = ['prefecture', 'engineer_post'];
const STATES = { prefecture: ['open', 'out', 'shut'], engineer_post: ['open', 'shut'] };

/** A game with walkers in the given states, all the prefecture's. */
function gameWith(states) {
  const walkers = new Map(states.map((s, i) => [100 + i, { id: 100 + i, type: 'prefect', state: s }]));
  return { game: { walkers }, ids: [...walkers.keys()] };
}

test('services3d: the prefecture and the engineer\'s post have models; a ghost shows them staffed, the crew home', () => {
  for (const t of TYPES) assert.ok(hasModel(t), t);
  const ghost = { id: null, type: 'prefecture', efficiency: 1 };
  assert.equal(MODELS.prefecture.variant(ghost, { snow: 0 }, null).state, 'open');
  assert.equal(MODELS.engineer_post.variant({ ...ghost, type: 'engineer_post' }, { snow: 0 }, null).state, 'open');
});

test('services3d: every look fits its tile at every turn and level of detail, on the ground', () => {
  const e = 1e-6;
  for (const type of TYPES) {
    for (const key of type === 'prefecture' ? ['prefecture', 'prefecture:ice'] : ['engineer_post']) {
      for (let lod = 0; lod < 3; lod++) {
        const g = MODELS[type].build(key, lod);
        g.updateMatrixWorld(true);
        const local = new Box3().setFromObject(g);
        for (let T = 0; T < 4; T++) {
          const b = local.clone().applyMatrix4(modelMatrix(20, 9, 1, T, 0));
          assert.ok(b.min.x >= 20 - e && b.max.x <= 21 + e && b.min.z >= 9 - e && b.max.z <= 10 + e, `${key} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
          assert.ok(b.min.y > -0.003 && b.max.y < 1.2, `${key} lod ${lod}: from ${b.min.y} to ${b.max.y} tiles high`);
        }
      }
    }
  }
});

test('services3d: each level of detail is lighter than the one before, and within budget', () => {
  const budget = [30000, 8000, 2500];
  for (const type of TYPES) {
    const t = [0, 1, 2].map((l) => kitOf(MODELS[type].build(type, l)).triangles);
    assert.ok(t[0] > t[1] && t[1] > t[2], `${type}: ${t}`);
    t.forEach((n, l) => assert.ok(n < budget[l], `${type} lod ${l}: ${n}`));
  }
});

test('services3d: states from the sim: staffed or not, and a prefecture\'s crew out at a fire', () => {
  const { game, ids } = gameWith(['roam', 'toFire', 'extinguish', 'returning']);
  const b = { type: 'prefecture', efficiency: 1, walkers: ids };
  // Running to a fire or fighting one: on fire duty (sim/risk.js fireCrewOut). Patrolling or walking home: not.
  assert.equal(crewOut(game, b), 2);
  assert.equal(prefectureState(b, game), 'out');
  assert.equal(prefectureState({ ...b, walkers: [ids[0], ids[3]] }, game), 'open');
  // No staff: shut, unless men are still at a fire (they fight on; the kit is with them); no game (a
  // ghost, a test): its walkers cannot be read, so home.
  assert.equal(prefectureState({ ...b, efficiency: 0, walkers: [ids[0]] }, game), 'shut');
  assert.equal(prefectureState({ ...b, efficiency: 0 }, game), 'out');
  assert.equal(prefectureState(b, null), 'open');
  assert.equal(crewOut(game, { walkers: [999] }), 0, 'a walker gone is not out');
  assert.equal(engineerState({ efficiency: 0.4 }), 'open');
  assert.equal(engineerState({ efficiency: 0 }), 'shut');
  // The model's variant reads the pass's game.
  assert.equal(MODELS.prefecture.variant(b, { snow: 0 }, { game }).state, 'out');
});

/** A built look's meshes by name, each the states it shows in. */
function shownIn(type, key = type) {
  const g = MODELS[type].build(key, 0);
  const out = new Map();
  g.traverse((o) => {
    if (!o.isMesh) return;
    const states = STATES[type].filter((s) => partShows(o.userData.when, s, false));
    out.set(`${o.name}|${o.userData.when}`, { name: o.name, states, mesh: o });
  });
  return out;
}

test('services3d: every part shows in some state, and each state shows what it should', () => {
  for (const type of TYPES) {
    for (const [k, v] of shownIn(type)) assert.ok(v.states.length, `${type} ${k} shows in no state`);
  }
  const p = [...shownIn('prefecture').values()];
  const states = (name) => p.filter((v) => v.name === name).flatMap((v) => v.states).sort();
  // The racked kit is there at home (staffed or not), gone while the crew is out.
  for (const kit of ['buckets', 'ladder', 'hook', 'axes', 'centones']) assert.ok(!states(kit).includes('out') && states(kit).includes('shut') && states(kit).includes('open'), kit);
  // Doors open while staffed, shut when not; the lantern lit while staffed.
  assert.deepEqual(p.filter((v) => v.name === 'doors').map((v) => v.states.join('+')).sort(), ['open+out', 'shut']);
  assert.deepEqual(p.filter((v) => v.name === 'lamp' && v.mesh.material.name === 'lantern-pane').flatMap((v) => v.states).sort(), ['open', 'out']);
  // Two men when all are home, one left at the door while the others are out, none when shut (actors: people/).
  const men = (s) => prefectureActors(s).length;
  assert.deepEqual([men('open'), men('out'), men('shut')], [2, 1, 0]);
  // The pump's beam: the pumpman rocks his own while he works it; the kit's stands still otherwise.
  assert.deepEqual(p.filter((v) => v.name === 'beam').map((v) => v.states.join('+')).sort(), ['out', 'shut']);
  assert.ok(prefectureActors('open').some((a) => a.clip === 'pump' && a.props.R === 'beam'));
  // The yard: the block hoisted and two men working, or let down onto rollers and nobody.
  const e = [...shownIn('engineer_post').values()];
  assert.deepEqual(e.filter((v) => v.name === 'block').map((v) => v.states.join()).sort(), ['open', 'shut']);
  assert.ok(e.some((v) => v.name === 'rollers' && v.states.join() === 'shut'));
  const builders = (s) => new Set(e.filter((v) => /^(winder|surveyor)-/.test(v.name) && v.states.includes(s)).map((v) => v.name.split('-')[0])).size;
  assert.deepEqual([builders('open'), builders('shut')], [2, 0]);
  // The groma stands whatever the state, it is the yard's sign: its cross (the bracket's end, at the
  // staff's top) is in parts shown in both states.
  const [gx, gz, gh] = ENGINEER.groma;
  const near = (m) => {
    m.updateMatrixWorld(true);
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (Math.hypot(pos.getX(i) - (gx + 0.24), pos.getY(i) - (ENGINEER.floorY + gh + 0.04), pos.getZ(i) - gz) < 0.05) return true;
    }
    return false;
  };
  assert.ok(e.some((v) => v.states.length === 2 && near(v.mesh)), "the groma's cross");
});

test('services3d: in a hard frost the prefecture\'s pump water is ice', () => {
  const v = MODELS.prefecture.variant({ efficiency: 1 }, { snow: 2 }, null);
  assert.equal(v.key, 'prefecture:ice');
  assert.equal(MODELS.prefecture.variant({ efficiency: 1 }, { snow: 1 }, null).key, 'prefecture');
  const water = (key) => {
    let m = null;
    MODELS.prefecture.build(key, 1).traverse((o) => { if (o.isMesh && o.name === PUMP_WATER) m = o.material; });
    return m;
  };
  assert.equal(water('prefecture:ice'), iceMaterial());
  assert.notEqual(water('prefecture'), iceMaterial());
});

test('services3d: the lanterns light at night only while staffed, on the front, where the night lights them', () => {
  for (const type of TYPES) {
    const b = { type, size: 1, efficiency: 1 };
    assert.deepEqual(modelLamps({ ...b, efficiency: 0 }, 0), [], `${type}: dark with nobody at work`);
    const lit = [0, 1, 2, 3].map((T) => modelLamps(b, T));
    for (const pts of lit) for (const [u, v, z] of pts) assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1 && z > 5 && z < 40, `${type}: ${u}, ${v}, ${z}`);
    // A lamp on the front is seen from the view at two turns of four.
    assert.equal(lit.filter((pts) => pts.length).length, 2, type);
  }
});

test('services3d: the game\'s pass draws a prefecture\'s parts by its state, from one kit', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const { game, ids } = gameWith(['roam', 'roam']);
  game.map = { desirability: [0], idx: () => 0 };
  const r = { game, weather: {}, time: 0 };
  const b = { id: 4, type: 'prefecture', size: 1, x: 0, y: 0, efficiency: 1, walkers: ids };
  const frame = () => mp.update(r, [{ b, T: 0, vx: 0, vy: 0, state: 0, snow: 0 }], 2);
  const shown = (name) => {
    const k = mp.kits.get('prefecture|2');
    return k.meshes.filter((im) => im.userData.part.when === name).reduce((a, im) => a + im.count, 0);
  };
  frame();
  assert.ok(shown('home') >= 1 && shown('staffed') >= 1 && shown('shut') === 0, 'home, staffed');
  const kit = mp.kits.get('prefecture|2');
  // A man sent to a fire: the racks empty, the doors stay open; nothing rebuilt.
  game.walkers.get(ids[1]).state = 'toFire';
  frame();
  assert.equal(shown('home'), 0);
  assert.ok(shown('staffed') >= 1);
  // Unstaffed with the man still at the fire: still out (the kit is with him). Back home: shut.
  b.efficiency = 0;
  frame();
  assert.equal(shown('home'), 0);
  game.walkers.get(ids[1]).state = 'roam';
  frame();
  assert.ok(shown('shut') >= 1 && shown('staffed') === 0);
  assert.equal(mp.kits.get('prefecture|2'), kit, 'the same kit through every state');
  mp.dispose();
});
