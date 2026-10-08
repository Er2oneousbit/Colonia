/**
 * training3d.test.mjs - the 3D actor troupe, gladiator school, menagerie and chariot stable (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the four have models; a build ghost shows each training
 *   - the state from the sim's fields: no staff shut; staffed with a
 *     performer of its own on the road out; else open (a walker of another
 *     kind, or one gone, changes nothing); a hard frost freezes the troughs
 *   - each look fits its footprint at every view turn and level of detail
 *   - each level of detail is lighter than the one before, within budget
 *   - every part shows in some state; what tours or goes to the arena is
 *     gone while 'out' (the troupe's cart, the leopard's gate swung open,
 *     the stable's harnessed team)
 *   - the people and beasts keep to the footprint at every turn, the beasts
 *     in their cages and yards; nobody but the beasts while shut
 *   - the beasts' new gaits plant their feet; an orbit's CPU twin goes round
 *     its circle, each team horse at the car's angle
 *   - the lanterns light only while staffed; a stable's faction by its id
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Matrix4, Vector3 } from 'three';
import { MODELS, hasModel, modelMatrix, modelLamps, partShows } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { trainingState, performerOut } from '../src/render3d/models/training.js';
import { VIVARIUM } from '../src/render3d/models/vivarium.js';
import { factionOf, FACTIO_COLOURS, FACTIO } from '../src/render3d/models/factio.js';
import { actorBounds, orbitPose, pack } from '../src/render3d/people/actors.js';
import { buildPiece } from '../src/render3d/people/pieces.js';
import { GAITS, BEAST_CLIPS, BEAST_CLIP_INDEX, beastPoseAt, gaitFoot, LEGS, SPECIES } from '../src/render3d/units/quadRig.js';
import { BUILDINGS } from '../src/data/buildings.js';

const TYPES = ['actor_troupe', 'gladiator_school', 'menagerie', 'chariot_maker'];
const STATES = ['open', 'out', 'shut'];
const game = { walkers: new Map([[1, { type: 'performer' }], [2, { type: 'labor' }]]) };
/** A stand-in building of `type` in `state`. */
const bOf = (type, state, id = 5) => ({ id, type, size: BUILDINGS[type].size, efficiency: state === 'shut' ? 0 : 1, walkers: state === 'out' ? [1] : [] });
const keyOf = (type, ice = false) => MODELS[type].variant(bOf(type, 'open'), { snow: ice ? 3 : 0 }, { game }).key;

test('training3d: the four have models; a ghost shows each training', () => {
  for (const t of TYPES) {
    assert.ok(hasModel(t), t);
    assert.equal(MODELS[t].variant({ id: null, type: t, efficiency: 1 }, { snow: 0 }, null).state, 'open', t);
  }
});

test('training3d: the state from the sim: shut unstaffed, out with a performer of its own on the road, else open', () => {
  assert.equal(trainingState({ efficiency: 0, walkers: [1] }, game), 'shut');
  assert.equal(trainingState({ efficiency: 0.4, walkers: [1] }, game), 'out');
  assert.equal(trainingState({ efficiency: 1, walkers: [2] }, game), 'open', 'a walker of another kind');
  assert.equal(trainingState({ efficiency: 1, walkers: [9] }, game), 'open', 'a walker gone');
  assert.equal(trainingState({ efficiency: 1, walkers: [1] }, null), 'open', 'no game to ask');
  assert.equal(performerOut({ walkers: [] }, game), false);
  for (const t of TYPES) {
    for (const s of STATES) assert.equal(MODELS[t].variant(bOf(t, s), { snow: 0 }, { game }).state, s, `${t} ${s}`);
  }
  // A hard frost freezes the troughs (the troupe has none).
  for (const t of ['gladiator_school', 'menagerie', 'chariot_maker']) {
    assert.ok(keyOf(t, true).endsWith(':ice') && !keyOf(t).endsWith(':ice'), t);
    assert.ok(MODELS[t].variant(bOf(t, 'open'), { snow: 2 }, { game }).ice);
    assert.ok(!MODELS[t].variant(bOf(t, 'open'), { snow: 1 }, { game }).ice);
  }
});

test('training3d: every look fits its footprint at every turn and level of detail, on the ground', () => {
  const e = 1e-6;
  for (const type of TYPES) {
    const S = BUILDINGS[type].size;
    for (const key of [keyOf(type), keyOf(type, true)]) {
      for (let lod = 0; lod < 3; lod++) {
        const g = MODELS[type].build(key, lod);
        g.updateMatrixWorld(true);
        const local = new Box3().setFromObject(g);
        for (let T = 0; T < 4; T++) {
          const b = local.clone().applyMatrix4(modelMatrix(20, 9, S, T, 0));
          assert.ok(b.min.x >= 20 - e && b.max.x <= 20 + S + e && b.min.z >= 9 - e && b.max.z <= 9 + S + e, `${key} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
          assert.ok(b.min.y > -0.004 && b.max.y < 1.1, `${key} lod ${lod}: from ${b.min.y} to ${b.max.y} tiles high`);
        }
      }
    }
  }
});

test('training3d: each level of detail is lighter than the one before, and within budget', () => {
  const budget = { actor_troupe: [16000, 5000, 2500], gladiator_school: [32000, 11000, 4500], menagerie: [16000, 8000, 3000], chariot_maker: [12000, 5000, 2000] };
  for (const type of TYPES) {
    const t = [0, 1, 2].map((l) => kitOf(MODELS[type].build(keyOf(type), l)).triangles);
    assert.ok(t[0] > t[1] && t[1] > t[2], `${type}: ${t}`);
    t.forEach((n, l) => assert.ok(n < budget[type][l], `${type} lod ${l}: ${n}`));
  }
});

/** A look's meshes with the states each shows in. */
function shownIn(type, key = keyOf(type)) {
  const out = [];
  MODELS[type].build(key, 0).traverse((o) => {
    if (o.isMesh) out.push({ name: o.name, when: o.userData.when, states: STATES.filter((s) => partShows(o.userData.when, s, false)) });
  });
  return out;
}

test('training3d: every part shows in some state; what tours or goes to the arena is gone while out', () => {
  for (const type of TYPES) for (const p of shownIn(type)) assert.ok(p.states.length, `${type} ${p.name}|${p.when}`);
  const states = (type, name) => shownIn(type).filter((p) => p.name === name).map((p) => p.states.join('+')).sort();
  assert.deepEqual(states('actor_troupe', 'cart'), ['open+shut'], 'the troupe tours with its cart');
  assert.deepEqual(states('menagerie', 'cart'), ['open+shut'], 'the cage cart goes with its beast');
  assert.deepEqual(states('menagerie', 'cage-gate'), ['open+shut', 'out'], 'the leopard\'s gate swung open while it is out');
  for (const type of TYPES) assert.deepEqual(states(type, 'doors'), ['open+out', 'shut'], `${type}: the gate`);
  // Out: the troupe's players gone, a pair from the ring, the leopard from its cage, the harnessed team from the yard.
  const n = (type, s) => MODELS[type].variant(bOf(type, s), { snow: 0 }, { game }).actors.actors;
  for (const type of TYPES) assert.ok(n(type, 'out').length < n(type, 'open').length, `${type}: fewer while out`);
  assert.ok(n('menagerie', 'open').some((a) => a.beast === 'quad:leopard') && !n('menagerie', 'out').some((a) => a.beast === 'quad:leopard'));
  // Shut: nobody but the beasts in their cages and the horses in their stalls.
  assert.equal(n('actor_troupe', 'shut').length, 0);
  assert.equal(n('gladiator_school', 'shut').length, 0);
  assert.ok(n('menagerie', 'shut').length > 0 && n('menagerie', 'shut').every((a) => a.beast));
  assert.ok(n('chariot_maker', 'shut').length === FACTIO.stalls[4] && n('chariot_maker', 'shut').every((a) => a.beast));
});

test('training3d: their people and beasts keep to the footprint at every turn; the beasts in their cages and yard', () => {
  const m = new Matrix4();
  const p = new Vector3();
  for (const type of TYPES) {
    const S = BUILDINGS[type].size;
    for (const s of STATES) {
      const v = MODELS[type].variant(bOf(type, s), { snow: 0 }, { game });
      for (const a of v.actors.actors) for (const k of a.pieces) assert.ok(buildPiece(k, 2).index.count > 0, `${type}: ${k} builds`);
      for (let T = 0; T < 4; T++) {
        modelMatrix(0, 0, S, T, 0, m);
        for (const a of v.actors.actors) {
          for (const c of actorBounds(a, 0.3)) {
            for (const [dx, dz] of [[c.r, 0], [-c.r, 0], [0, c.r], [0, -c.r]]) {
              p.set(c.x + dx, 0, c.z + dz).applyMatrix4(m);
              assert.ok(p.x >= -1e-6 && p.x <= S + 1e-6 && p.z >= -1e-6 && p.z <= S + 1e-6, `${type} ${s} turn ${T}: ${a.beast || a.pieces[0]} at ${c.x.toFixed(2)}, ${c.z.toFixed(2)} off the footprint`);
            }
          }
        }
      }
    }
  }
  // The caged beasts stay behind their bars (the cages' z and x), the bear in his yard.
  const beasts = MODELS.menagerie.variant(bOf('menagerie', 'open'), { snow: 0 }, { game }).actors.actors.filter((a) => a.beast);
  for (const a of beasts) {
    for (const c of actorBounds(a, 0)) {
      if (a.beast === 'quad:bear') {
        const [x0, x1, z0, z1] = VIVARIUM.bear;
        assert.ok(c.x - c.r > x0 && c.x + c.r * 0.5 < x1 && c.z > z0 && c.z < z1, `the bear in his yard: ${c.x}, ${c.z}`);
      } else {
        assert.ok(c.z < VIVARIUM.barsZ - 0.2, `${a.beast} behind its bars: ${c.z}`);
      }
    }
  }
});

test('training3d: the new gaits plant their feet; an orbit goes round its circle, the team as one', () => {
  for (const name of ['horse:trot', 'lion:walk', 'leopard:walk', 'bear:walk']) {
    const G = GAITS[BEAST_CLIPS[name].gait];
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const P = beastPoseAt(name, t);
      for (let l = 0; l < 4; l++) {
        const ft = gaitFoot(G, l, t);
        if (!ft.down || (t - G.phase[l] + 1) % 1 > G.duty * 0.7) continue;
        const j = P.jointOf(LEGS[l][3]);
        const rest = P.J[LEGS[l][3]];
        assert.ok(Math.hypot(j.z - rest[2] - ft.z, j.y - rest[1]) < 0.04, `${name}: leg ${l} planted at ${t}`);
      }
    }
  }
  // The plantigrade bear: its hind foot's sole lies flat (the cannon slanted at rest), so the heel is low.
  assert.ok(SPECIES.bear.slant && !SPECIES.wolf.slant);
  for (const n of ['lion:stand', 'lion:lie', 'lion:roar', 'leopard:lie', 'bear:stand', 'bear:rise']) assert.ok(n in BEAST_CLIP_INDEX, n);
  // An orbit's twin: its radius kept, one lap in 2 pi r / v seconds, facing along its way.
  const o = { r: 2.25, speed: 2.6, x: 0, z: 0 };
  const lap = (2 * Math.PI * o.r) / o.speed;
  for (const t of [0, lap / 4, lap / 3, lap]) {
    const q = orbitPose(o, t);
    assert.ok(Math.abs(Math.hypot(q.x, q.z) - o.r) < 1e-9);
  }
  const a = orbitPose(o, 0.01);
  const b = orbitPose(o, 0.02);
  const dir = Math.atan2(b.x - a.x, b.z - a.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(dir - a.yaw), Math.cos(dir - a.yaw))) < 0.02, 'it faces the way it goes');
  // The stable's team: every horse at the car's angle at every moment (they turn as one), its speed its circle's.
  const team = MODELS.chariot_maker.variant(bOf('chariot_maker', 'open'), { snow: 0 }, { game }).actors.actors.filter((x) => x.orbit);
  assert.equal(team.length, 4);
  for (const t of [0.3, 2.1, 5.7]) {
    const yaws = team.map((x) => orbitPose(x.orbit, t).yaw);
    for (const y of yaws) assert.ok(Math.abs(y - yaws[0]) < 1e-9);
  }
  assert.ok(team.every((x) => x.sync), 'the team in step');
  // A beast packs as one piece on its own clips; a car as a rigid piece.
  const lion = pack({ beast: 'quad:lion', clip: 'lion:walk', route: { length: 2, speed: 0.8, clipEnd: 'lion:roar' } });
  assert.deepEqual([...lion.pieces], ['quad:lion']);
  assert.equal(lion.misc[3], 1);
  assert.equal(lion.clip[0], BEAST_CLIP_INDEX['lion:walk']);
  assert.equal(lion.clip[3] % 128, BEAST_CLIP_INDEX['lion:roar']);
  assert.equal(pack({ rigid: 'cart:chariot' }).misc[3], 2);
  assert.throws(() => pack({ beast: 'quad:lion', clip: 'walk' }), /No beast clip/);
});

test('training3d: the lanterns light only while staffed, in the footprint; a stable\'s faction by its id', () => {
  for (const type of TYPES) {
    const S = BUILDINGS[type].size;
    assert.equal(modelLamps(bOf(type, 'shut'), 0).length, 0, type);
    // (A lamp on a face turned from the view is left out: the light map has no depth.)
    assert.ok(modelLamps(bOf(type, 'open'), 0).length > 0, type);
    for (let T = 0; T < 4; T++) {
      const lit = modelLamps(bOf(type, 'open'), T);
      for (const [u, v] of lit) assert.ok(u >= 0 && u <= S && v >= 0 && v <= S, `${type}: a lamp at ${u}, ${v}`);
    }
  }
  const factions = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((id) => factionOf({ id })));
  assert.equal(factions.size, 4, 'all four colours');
  assert.equal(factionOf({ id: 12 }), factionOf({ id: 12 }));
  assert.ok(MODELS.chariot_maker.variant(bOf('chariot_maker', 'open', 1), { snow: 0 }, { game }).key !== MODELS.chariot_maker.variant(bOf('chariot_maker', 'open', 2), { snow: 0 }, { game }).key);
  assert.equal(FACTIO_COLOURS.length, 4);
});
