/**
 * civic3d.test.mjs - the 3D Great Baths and Caravanserai (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - both have models; a build ghost shows each finished and at work
 *   - the stage mapping from the sim's site record: the stage, the step of
 *     its work, halted, a camp's crew on the site, finished, sacked
 *   - the states: the baths heated, cold without timber or hands, dry
 *     without piped water; the inn fed, unfed, unstaffed; the stores' kits
 *   - every look (each stage at each step, finished, frozen, sacked) fits its
 *     footprint at every view turn and level of detail, on the ground; each
 *     level lighter, within budget
 *   - the people and the beasts stay on the footprint in every state
 *   - the lamps light only while it works; the new clips, props and the mule
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3 } from 'three';
import { MODELS, hasModel, modelMatrix, modelFor, modelLamps } from '../src/render3d/models.js';
import { CIVIC_MODELS, CIVIC_TYPES, STEPS, civicLook, thermaeState, mansioState } from '../src/render3d/models/civicMonuments.js';
import { actorBounds } from '../src/render3d/people/actors.js';
import { buildPiece } from '../src/render3d/people/pieces.js';
import { CLIP_INDEX } from '../src/render3d/people/clips.js';
import { PROP_NAMES } from '../src/render3d/people/props.js';
import { MONUMENT_TYPES } from '../src/data/monuments.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { Matrix4, Vector3 } from 'three';

const stagesOf = (type) => MONUMENT_TYPES[BUILDINGS[type].mon].stages.length;

/** A monument as the sim keeps it: its site record, staff, water; a game with a camp's crew on it if asked. */
function scene(type, { stage = 99, work = 0, store = 100, sacked = false, halted = false, staff = 1, water = true, crew = false } = {}) {
  const def = BUILDINGS[type];
  const n = stagesOf(type);
  const s = Math.min(n, stage);
  const mon = { stage: s, work: s < n ? MONUMENT_TYPES[def.mon].stages[s].work * work : 0, got: {}, way: {}, paid: true, halted, store, sacked, wasOpen: false };
  const b = { id: 7, type, x: 20, y: 9, size: def.size, turn: 0, def, mon, efficiency: staff, hasWater: water };
  const buildings = new Map([[b.id, b]]);
  if (crew) buildings.set(8, { id: 8, type: 'work_camp', camp: { crew: { state: 'site', site: b.id, since: 0 } } });
  const game = { buildings, time: { totalTicks: 40 }, map: { w: 64, h: 64 } };
  return { b, game };
}

const tris = (g) => {
  let n = 0;
  g.traverse((o) => { if (o.isMesh) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
  return n;
};

test('civic3d: the baths and the inn have models; a ghost shows each finished and at work', () => {
  assert.deepEqual([...CIVIC_TYPES].sort(), ['mansio_magna', 'thermae']);
  for (const t of CIVIC_TYPES) {
    assert.ok(hasModel(t), t);
    const v = MODELS[t].variant({ id: null, type: t, x: 0, y: 0, size: 5, def: BUILDINGS[t], efficiency: 1 }, { snow: 0 }, { game: null });
    assert.equal(v.key, t);
    assert.equal(v.state, t === 'thermae' ? 'flowing' : 'open');
  }
});

test('civic3d: the stage mapping follows the sim: the stage, the step of its work, halted, crew, finished, sacked', () => {
  for (const t of CIVIC_TYPES) {
    const n = stagesOf(t);
    for (let s = 0; s < n; s++) {
      for (const [work, step] of [[0, 0], [0.3, 1], [0.6, 2], [0.99, 3]]) {
        const { b, game } = scene(t, { stage: s, work });
        const look = civicLook(b, game);
        assert.deepEqual([look.phase, look.stage, look.step], ['site', s, step], `${t} ${s} ${work}`);
        assert.ok(Math.abs(look.f - (step + 0.5) / STEPS) < 1e-9);
        assert.equal(MODELS[t].variant(b, {}, { game }).key, `${t}:s${s}:${step}`);
      }
    }
    // A camp's crew on the site: at work, its treadwheels turning (':w'), its people; halted: still, nobody.
    const busy = scene(t, { stage: 1, work: 0.5, crew: true });
    const v = MODELS[t].variant(busy.b, {}, { game: busy.game });
    assert.equal(v.key, `${t}:s1:2:w`);
    assert.ok(v.actors.actors.length >= 3, `${t}: its crew at work`);
    const halted = scene(t, { stage: 1, work: 0.5, crew: true, halted: true });
    const h = MODELS[t].variant(halted.b, {}, { game: halted.game });
    assert.equal(h.key, `${t}:s1:2`);
    assert.equal(h.actors.actors.length, 0);
    assert.equal(civicLook(scene(t).b).phase, 'done');
    assert.equal(MODELS[t].variant(scene(t, { sacked: true }).b, {}, {}).key, `${t}:sacked`);
    assert.equal(MODELS[t].variant(scene(t).b, { snow: 3 }, {}).key, `${t}:ice`);
  }
});

test('civic3d: the states: the baths heated, cold, dry; the inn fed, unfed, shut; the stores\' kits', () => {
  assert.deepEqual(thermaeState(scene('thermae').b), { kit: 'flowing', people: 'open', wood: true });
  assert.deepEqual(thermaeState(scene('thermae', { store: 0 }).b), { kit: 'still', people: 'cold', wood: false });
  assert.deepEqual(thermaeState(scene('thermae', { water: false }).b).kit, 'dry');
  assert.equal(thermaeState(scene('thermae', { staff: 0.5 }).b).people, 'shut');
  assert.equal(thermaeState(scene('thermae', { sacked: true }).b).kit, 'still');
  assert.equal(mansioState(scene('mansio_magna').b).kit, 'open');
  assert.equal(mansioState(scene('mansio_magna', { store: 0 }).b).kit, 'out');
  assert.equal(mansioState(scene('mansio_magna', { staff: 0.2 }).b).kit, 'shut');
  // The woodstore's stacks and the stores' food come and go with the store.
  assert.ok(MODELS.thermae.variant(scene('thermae').b, {}, {}).more.some((e) => e.key === 'thermae:wood'));
  assert.ok(!MODELS.thermae.variant(scene('thermae', { store: 0 }).b, {}, {}).more);
  assert.ok(MODELS.mansio_magna.variant(scene('mansio_magna').b, {}, {}).more.some((e) => e.key === 'mansio_magna:food'));
  assert.ok(!MODELS.mansio_magna.variant(scene('mansio_magna', { store: 0 }).b, {}, {}).more);
});

test('civic3d: every look fits its footprint at every view turn and level of detail, on the ground; each level lighter, within budget', () => {
  const e = 1e-6;
  const budget = { thermae: [75000, 30000, 12000], mansio_magna: [75000, 30000, 12000] };
  for (const t of CIVIC_TYPES) {
    const n = stagesOf(t);
    const keys = [t, `${t}:ice`, `${t}:sacked`];
    for (let s = 0; s < n; s++) for (let k = 0; k < STEPS; k++) keys.push(`${t}:s${s}:${k}`, `${t}:s${s}:${k}:w`);
    const counts = [];
    for (let lod = 0; lod < 3; lod++) {
      for (const key of keys) {
        const g = modelFor(key).build(key, lod);
        // (Smoke and steam drift with the wind: only what stands is held to the footprint.)
        g.children.filter((m) => m.name === 'smoke' || m.name === 'steam').forEach((m) => g.remove(m));
        g.updateMatrixWorld(true);
        const local = new Box3().setFromObject(g);
        // (The site's dressing is worksite.js's: its shear legs' feet are dug in, which the look clips.)
        const own = new Box3();
        for (const m of g.children) if (!m.name.startsWith('site-')) own.expandByObject(m);
        if (key === t) counts[lod] = tris(g);
        for (let T = 0; T < 4; T++) {
          const b = local.clone().applyMatrix4(modelMatrix(20, 9, 5, T, 0));
          assert.ok(b.min.x >= 20 - e && b.max.x <= 25 + e && b.min.z >= 9 - e && b.max.z <= 14 + e, `${key} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
          assert.ok(own.min.y > -0.003 && b.max.y < 3, `${key} lod ${lod}: from ${b.min.y} to ${b.max.y} tiles high`);
        }
      }
    }
    assert.ok(counts[0] > counts[1] && counts[1] > counts[2], `${t}: ${counts}`);
    counts.forEach((c, l) => assert.ok(c < budget[t][l], `${t} lod ${l}: ${c}`));
  }
});

test('civic3d: the people and the beasts stay on the footprint in every state and on every site', () => {
  const m = new Matrix4();
  const p = new Vector3();
  for (const t of CIVIC_TYPES) {
    const cases = [{}, { store: 0 }, { staff: 0.5 }, { water: false }];
    for (let s = 0; s < stagesOf(t); s++) cases.push({ stage: s, work: 0.6, crew: true });
    for (const c of cases) {
      const { b, game } = scene(t, c);
      for (const ice of [0, 3]) {
        const v = MODELS[t].variant(b, { snow: ice }, { game });
        for (let T = 0; T < 4; T++) {
          modelMatrix(0, 0, 5, T, 0, m);
          for (const act of v.actors.actors) {
            for (const q of actorBounds(act, 0.3)) {
              for (const [dx, dz] of [[q.r, 0], [-q.r, 0], [0, q.r], [0, -q.r]]) {
                p.set(q.x + dx, 0, q.z + dz).applyMatrix4(m);
                assert.ok(p.x >= -1e-6 && p.x <= 5 + 1e-6 && p.z >= -1e-6 && p.z <= 5 + 1e-6, `${t} ${JSON.stringify(c)} turn ${T}: an actor at ${q.x.toFixed(2)}, ${q.z.toFixed(2)}`);
              }
            }
          }
        }
      }
    }
  }
});

test('civic3d: the lamps light only while it works; nobody bathes in a frozen pool', () => {
  assert.ok(modelLamps(scene('thermae').b, 0).length > 0);
  for (const c of [{ store: 0 }, { water: false }, { sacked: true }, { stage: 1 }]) assert.equal(modelLamps(scene('thermae', c).b, 0).length, 0, JSON.stringify(c));
  assert.ok(modelLamps(scene('mansio_magna').b, 0).length > 0);
  assert.equal(modelLamps(scene('mansio_magna', { staff: 0.2 }).b, 0).length, 0);
  const warm = MODELS.thermae.variant(scene('thermae').b, { snow: 0 }, {}).actors.actors.length;
  const cold = MODELS.thermae.variant(scene('thermae').b, { snow: 3 }, {}).actors.actors.length;
  assert.ok(cold < warm, `${cold} < ${warm}`);
});

test('civic3d: the new clips, props and the mule build', () => {
  for (const c of ['trigon', 'halteres', 'swim']) assert.ok(c in CLIP_INDEX, c);
  for (const p of ['ball', 'halter']) assert.ok(PROP_NAMES.includes(p), p);
  for (const key of ['quad:horse:mule', 'quad:horse:mule:pack', 'prop:ball:R', 'prop:halter:L', 'beast:ox']) {
    for (let lod = 0; lod < 3; lod++) assert.ok(buildPiece(key, lod).attributes.position.count > 20, `${key} ${lod}`);
  }
  // A mule's ears are longer than a horse's: its head's piece reaches higher.
  const top = (key) => new Box3().setFromBufferAttribute(buildPiece(key, 0).attributes.position).max.y;
  assert.ok(top('quad:horse:mule') > top('quad:horse') + 0.05);
  assert.ok(CIVIC_MODELS.thermae && CIVIC_MODELS.mansio_magna);
});
