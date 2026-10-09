/**
 * villages3d.test.mjs - the native villages in 3D (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the hut, the meeting place and the plot have models; a ghost, or a
 *     piece seen without a game, is calm
 *   - the state from the sim's fields: calm, trading (a mission post at
 *     work), angry (anger at its top), at war (the meeting place's attack);
 *     a plot follows its meeting place
 *   - every look (each people, state, form, turn) fits its footprint at every
 *     view turn and level of detail; its people keep on it too
 *   - each level of detail is lighter than the one before, within budget
 *   - a hut's door faces its meeting place; its lamp is on its door's side,
 *     the meeting place's fire lit whichever way the view is turned
 *   - the plots' crops follow the months; the people match the state (men
 *     with spears when angry, none at home at war, the goods out to trade)
 *   - the grinder's hands reach the quern's stone; the new clips loop
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Matrix4, Vector3 } from 'three';
import { MODELS, hasModel, modelMatrix, modelLamps, modelFor } from '../src/render3d/models.js';
import { VILLAGE_TYPES, villageState, villageLook, hutLook, buildPart } from '../src/render3d/models/villages.js';
import { cropStage, CROPS } from '../src/render3d/models/arvum.js';
import { HUT_FORMS } from '../src/render3d/models/tugurium.js';
import { actorBounds } from '../src/render3d/people/actors.js';
import { poseAt, QUERN } from '../src/render3d/people/clips.js';
import { NATIVES } from '../src/data/natives.js';

const MID = 1000000;

/** A village of one people in a state: its meeting place at (10, 10), the game the pieces live in. */
function village(people, state) {
  const calm = state === 'calm' || state === 'trade';
  const m = { id: MID, type: 'native_meeting', x: 10, y: 10, size: 2, village: MID, anger: calm ? 20 : NATIVES.ANGER_MAX, attackDays: state === 'war' ? 2 : 0 };
  const buildings = new Map([[m.id, m]]);
  if (state === 'trade') buildings.set(7, { id: 7, type: 'mission_post', efficiency: 1, accessRoad: 0 });
  const game = { city: { natives: { people } }, buildings, time: { totalTicks: 1 } };
  const hut = (id, x, y) => {
    const b = { id, type: 'native_hut', x, y, size: 1, village: MID, anger: m.anger };
    buildings.set(id, b);
    return b;
  };
  const plot = (id, x, y) => {
    const b = { id, type: 'native_crops', x, y, size: 1, village: MID };
    buildings.set(id, b);
    return b;
  };
  return { m, game, hut, plot };
}

const STATES = ['calm', 'trade', 'angry', 'war'];
const PEOPLES = ['ligurian', 'native'];
/** Huts all round the meeting place (each door's turn), plots of every crop. */
const HUTS = [[13, 9], [8, 12], [11, 14], [9, 8], [14, 12], [7, 10], [12, 7], [13, 13]];

test('villages3d: the hut, the meeting place and the plot have models; a ghost is calm', () => {
  for (const t of VILLAGE_TYPES) {
    assert.ok(hasModel(t), t);
    assert.equal(villageState({ id: null, type: t, x: 0, y: 0, size: 1 }, null), 'calm');
  }
  // Every kit key the entries warm can be built.
  for (const t of VILLAGE_TYPES) for (const key of MODELS[t].warm) assert.ok(modelFor(key), key);
});

test('villages3d: the state from the sim: calm, trading, angry, at war; a plot follows its meeting place', () => {
  for (const s of STATES) {
    const v = village('ligurian', s);
    const h = v.hut(MID + 1, 13, 9);
    const p = v.plot(MID + 20, 7, 13);
    assert.equal(villageState(v.m, v.game), s, `meeting ${s}`);
    assert.equal(villageState(h, v.game), s, `hut ${s}`);
    assert.equal(villageState(p, v.game), s, `plot ${s}`);
  }
  // A hut still angry beside a calmed meeting place is angry; calmed with no post, calm.
  const v = village('native', 'calm');
  const h = v.hut(MID + 1, 13, 9);
  h.anger = NATIVES.ANGER_MAX;
  assert.equal(villageState(h, v.game), 'angry');
  h.anger = 3;
  assert.equal(villageState(h, v.game), 'calm');
});

const e = 1e-6;
/** Does `group` (in the model's metres) stand on an S x S footprint at every view turn? */
function fits(group, S, what) {
  group.updateMatrixWorld(true);
  const local = new Box3().setFromObject(group, true);
  for (let T = 0; T < 4; T++) {
    const b = local.clone().applyMatrix4(modelMatrix(20, 9, S, T, 0));
    assert.ok(b.min.x >= 20 - e && b.max.x <= 20 + S + e && b.min.z >= 9 - e && b.max.z <= 9 + S + e, `${what} turn ${T}: ${JSON.stringify(b)}`);
    assert.ok(b.min.y > -0.07 && b.max.y < 2.2, `${what}: ${b.min.y} to ${b.max.y} tiles high`);
  }
}

/** Every actor's feet and reach on the footprint at every view turn. */
function peopleFit(cast, S, what) {
  const m = new Matrix4();
  const p = new Vector3();
  for (let T = 0; T < 4; T++) {
    modelMatrix(0, 0, S, T, 0, m);
    for (const a of cast.actors) {
      for (const c of actorBounds(a, 0.3)) {
        for (const [dx, dz] of [[c.r, 0], [-c.r, 0], [0, c.r], [0, -c.r]]) {
          p.set(c.x + dx, 0, c.z + dz).applyMatrix4(m);
          assert.ok(p.x >= -e && p.x <= S + e && p.z >= -e && p.z <= S + e, `${what} turn ${T}: an actor at ${c.x.toFixed(2)}, ${c.z.toFixed(2)}`);
        }
      }
    }
  }
}

test('villages3d: every look fits its footprint at every turn and level, its people on it', () => {
  for (const people of PEOPLES) {
    for (const s of STATES) {
      const v = village(people, s);
      const pieces = [v.m, ...HUTS.map(([x, y], i) => v.hut(MID + 1 + i, x, y)), ...[0, 1, 2, 3, 4, 5].map((i) => v.plot(MID + 30 + i * 7, 6 + i, 15))];
      for (const b of pieces) {
        for (const month of [0, 5, 7]) {
          for (let lod = 0; lod < 3; lod += s === 'calm' && month === 5 ? 1 : 2) {
            const { group, variant } = villageLook(b, lod, { game: v.game, month });
            const what = `${people} ${s} ${b.type} ${b.id} m${month} lod ${lod}`;
            fits(group, b.size, what);
            if (lod === 0) peopleFit(variant.actors, b.size, what);
          }
        }
      }
    }
  }
});

test('villages3d: each level of detail is lighter than the one before, within budget', () => {
  const tris = (g) => {
    let n = 0;
    g.traverse((o) => { if (o.isMesh) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
    return n;
  };
  // [type, budget at levels 0 / 1 / 2] for a piece's whole look (its kits and their copies).
  const BUDGET = { native_hut: [16000, 5000, 1500], native_meeting: [45000, 14000, 5000], native_crops: [30000, 6000, 900] };
  for (const people of PEOPLES) {
    const v = village(people, 'trade');
    for (const b of [v.m, v.hut(MID + 1, 13, 9), v.hut(MID + 2, 8, 12), v.plot(MID + 20, 7, 13)]) {
      let last = Infinity;
      for (let lod = 0; lod < 3; lod++) {
        const n = tris(villageLook(b, lod, { game: v.game, month: 4 }).group);
        assert.ok(n <= last, `${people} ${b.type} lod ${lod}: ${n} over ${last}`);
        assert.ok(n <= BUDGET[b.type][lod], `${people} ${b.type} lod ${lod}: ${n} over budget ${BUDGET[b.type][lod]}`);
        last = n;
      }
    }
  }
});

test('villages3d: a hut\'s door faces its meeting place; its lamp on its door\'s side, the fire lit at every view turn', () => {
  const v = village('ligurian', 'calm');
  const ctx = { game: v.game, month: 5, clock: 0, frame: 10 };
  for (const [i, [x, y]] of HUTS.entries()) {
    const h = v.hut(MID + 1 + i, x, y);
    const L = hutLook(h, v.game, 'ligurian');
    // The quarter turn nearest the way to the meeting place's middle (map +x is the model's x, map +y its z).
    const dx = v.m.x + 1 - (x + 0.5);
    const dz = v.m.y + 1 - (y + 0.5);
    const want = (((Math.round(Math.atan2(dx, dz) / (Math.PI / 2)) % 4) + 4) % 4);
    assert.equal(L.q, want, `hut at ${x}, ${y}`);
    MODELS.native_hut.variant(h, { snow: 0 }, ctx);
    const lamps = MODELS.native_hut.lamps(h);
    assert.equal(lamps.length, 1);
    const [lx, , lz] = lamps[0];
    assert.ok(lx * Math.sin(L.q * Math.PI / 2) + lz * Math.cos(L.q * Math.PI / 2) > 0.6, 'the lamp at the door');
  }
  MODELS.native_meeting.variant(v.m, { snow: 0 }, ctx);
  for (let T = 0; T < 4; T++) assert.equal(modelLamps(v.m, T).length, 1, `the fire at turn ${T}`);
});

test('villages3d: the crops follow the months, and the people the state', () => {
  assert.equal(cropStage('spelt', 5), 'ripe');
  assert.equal(cropStage('millet', 5), 'green');
  assert.equal(cropStage('millet', 7), 'ripe');
  assert.equal(cropStage('beans', 0), 'bare');
  assert.equal(cropStage('barley', null), 'green');
  for (const c of CROPS.ligurian) for (let m = 0; m < 12; m++) assert.ok(buildPart(`arvum:ligurian:${c}:${cropStage(c, m)}`, 2));
  const clipsOf = (s, people = 'ligurian') => {
    const v = village(people, s);
    return MODELS.native_meeting.variant(v.m, { snow: 0 }, { game: v.game, month: 5 }).actors.actors.map((a) => a.clipName);
  };
  assert.ok(clipsOf('angry').filter((c) => c === 'guard' || c === 'protest').length >= 5, 'the men gathered with spears');
  assert.ok(clipsOf('angry').includes('horn') && clipsOf('war').includes('horn'), 'the war horn');
  assert.ok(!clipsOf('war').includes('guard'), 'at war the men are away');
  assert.ok(clipsOf('calm').includes('stir') && clipsOf('calm').includes('sitTalk'), 'calm: the cook, the elders');
  const keys = (s) => {
    const v = village('native', s);
    return MODELS.native_meeting.variant(v.m, { snow: 0 }, { game: v.game, month: 5 }).more.map((x) => x.key);
  };
  assert.ok(keys('trade').includes('vgoods') && !keys('calm').includes('vgoods'), 'the goods out to trade');
  assert.ok(keys('angry').includes('vfire:great') && keys('calm').includes('vfire:small'), 'the fire built high');
  // At war no man is home at a hut.
  for (const [i, [x, y]] of HUTS.entries()) {
    const v = village('ligurian', 'war');
    const h = v.hut(MID + 1 + i, x, y);
    const cast = MODELS.native_hut.variant(h, { snow: 0 }, { game: v.game, month: 5 }).actors;
    assert.ok(cast.actors.every((a) => !a.pieces.includes('body:m')), 'no man at home');
  }
  // Every form is used by some hut of each people.
  for (const people of PEOPLES) {
    const seen = new Set();
    for (let id = 1; id < 60; id++) seen.add(hutLook({ id: MID + id, type: 'native_hut', x: 3, y: 3 }, null, people).form);
    for (const f of HUT_FORMS[people]) assert.ok(seen.has(f), `${people} ${f}`);
  }
});

test('villages3d: the grinder\'s hands are on the quern\'s upper stone through her stroke', () => {
  for (let k = 0; k < 8; k++) {
    const p = poseAt('grind', k / 8);
    const stone = p.jointOf('propR');
    assert.ok(Math.abs(stone.y - QUERN.height) < 0.01, `the stone on the quern at ${k}`);
    for (const s of ['L', 'R']) {
      const h = p.jointOf(`hand${s}`);
      assert.ok(h.distanceTo(stone) < 0.2, `hand ${s} at the stone (${h.distanceTo(stone).toFixed(3)})`);
    }
  }
});

test('villages3d: whoever stands in a hut\'s yard stands clear of every form\'s roof; the fold\'s flock keeps inside its walls', async () => {
  const { hutActors, YARD } = await import('../src/render3d/models/villages.js');
  const { underEave, HUT } = await import('../src/render3d/models/tugurium.js');
  for (const form of Object.keys(HUT)) {
    for (const state of STATES) {
      for (const work of ['grind', 'spin']) {
        const L = { people: 'native', form, q: 0, jitter: 0, work, child: true, crone: true };
        for (const a of hutActors(L, state, 9)) {
          if (a.clip === 'grind' || a.clip === 'play' || a.beast) continue;
          // (The hut itself turns up to 0.18 off the yard's quarter turn: hutLook's jitter.)
          for (const j of [-0.18, 0, 0.18]) {
            const c = Math.cos(-j);
            const s = Math.sin(-j);
            const x = a.at[0] * c + a.at[2] * s;
            const z = -a.at[0] * s + a.at[2] * c;
            assert.ok(!underEave(form, x, z, 0.2), `${form} ${state}: ${a.clip} at ${a.at[0]}, ${a.at[2]} under the roof`);
          }
        }
      }
    }
  }
  assert.ok(YARD.door && YARD.side);
  // The fold's flock (beasts on the beast rig, walking a few steps and grazing) keeps inside the fold's walls,
  // the whole length of its routes, a beast's reach round it.
  const { meetingActors } = await import('../src/render3d/models/villages.js');
  const { CONCILIUM } = await import('../src/render3d/models/concilium.js');
  const [x0, z0, x1, z1] = CONCILIUM.fold;
  for (const people of PEOPLES) {
    const beasts = meetingActors(people, 'calm', 17).filter((a) => a.beast);
    assert.ok(beasts.length >= 3, 'a flock in the fold');
    for (const a of beasts) {
      const ends = [[a.at[0], a.at[2]]];
      if (a.route) ends.push([a.at[0] + Math.sin(a.ry) * a.route.length, a.at[2] + Math.cos(a.ry) * a.route.length]);
      for (const [x, z] of ends) assert.ok(x - 0.45 >= x0 - 0.05 && x + 0.45 <= x1 + 0.05 && z - 0.45 >= z0 - 0.05 && z + 0.45 <= z1 + 0.05, `${people}: a ${a.beast} at ${x.toFixed(2)}, ${z.toFixed(2)} out of the fold`);
    }
  }
});
