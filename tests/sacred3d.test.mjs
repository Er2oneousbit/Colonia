/**
 * sacred3d.test.mjs - the Great Sanctuaries, the Pantheon and the Lighthouse in 3D (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the seven types have models; a build ghost shows each finished, at work
 *   - the stage mapping: the sim's stage and work in quarters to a timeline,
 *     the crew, the halt, the raid's setback, the sack, the opening, the
 *     lighthouse lit or dark by its store
 *   - every stage's look (its own kit and every kit of its `more`) fits its
 *     footprint at every view turn, on every level of detail, within budget
 *   - each god's sanctuary is its god's: the temple's order, the god's kit
 *     (frieze, dedication, pediment: numina.js), the god's own ground
 *   - the people stand on the footprint; a working site has its crew, a
 *     halted one none; lamps only while open (lit)
 *   - the game's pass draws a sanctuary from its kits
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Group, Matrix4 } from 'three';
import { MODELS, hasModel, modelFor, modelMatrix, modelLamps, partShows } from '../src/render3d/models.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import {
  SACRED_TYPES, FANUM_TYPES, sacredView, partState, stepOf, timelineOf, timeOfKey, standIn, crewGame, woodLevel,
} from '../src/render3d/models/sacredMonuments.js';
import { NUMEN, GODS } from '../src/render3d/models/numina.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { MONUMENT_TYPES } from '../src/data/monuments.js';

const stagesOf = (type) => MONUMENT_TYPES[BUILDINGS[type].mon].stages.length;

/** A look as one Group: its own kit and every kit of its `more`, each mesh shown as its state says. */
function look(type, b, game, lod) {
  const v = MODELS[type].variant(b, { snow: 0 }, { game, clock: 1.5 });
  const g = new Group();
  const add = (key, state, m) => {
    const k = modelFor(key).build(key, lod);
    if (m) {
      k.matrixAutoUpdate = false;
      k.matrix.copy(m);
    }
    k.traverse((o) => { if (o.isMesh) o.visible = partShows(o.userData.when, state, false); });
    g.add(k);
  };
  add(v.key, v.state, null);
  for (const e of v.more || []) for (let j = 0; j < e.n; j++) add(e.key, e.state || 'always', new Matrix4().fromArray(e.mats, j * 16));
  g.updateMatrixWorld(true);
  return { g, v };
}

function trianglesOf(g) {
  let n = 0;
  g.traverse((o) => { if (o.isMesh && o.visible) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
  return n;
}

function boundsOf(g) {
  const b = new Box3();
  g.traverse((o) => { if (o.isMesh && o.visible) b.expandByObject(o); });
  return b;
}

test('sacred3d: the seven monuments have models; a ghost shows each finished and at work', () => {
  assert.equal(SACRED_TYPES.length, 7);
  for (const t of SACRED_TYPES) {
    assert.ok(hasModel(t), t);
    const v = sacredView({ id: null, type: t, x: 0, y: 0, size: BUILDINGS[t].size }, null);
    assert.ok(v.finished && v.open && v.t === stagesOf(t), t);
  }
});

test('sacred3d: the stage mapping, from the sim\'s stage and work in quarters', () => {
  assert.equal(stepOf(0, 60), 0);
  assert.equal(stepOf(14.9, 60), 0);
  assert.equal(stepOf(15, 60), 1);
  assert.equal(stepOf(59.9, 60), 3);
  assert.equal(stepOf(80, 60), 3);
  assert.equal(timelineOf(2, 1, 4), 2.375);
  assert.equal(timelineOf(4, 0, 4), 4);
  assert.equal(timeOfKey('2.1', 4), 2.375);
  assert.equal(timeOfKey('done', 5), 5);
  for (const type of SACRED_TYPES) {
    const n = stagesOf(type);
    for (let s = 0; s < n; s++) {
      const b = standIn(type, { stage: s, share: 0.6 });
      const v = sacredView(b, crewGame(b.id));
      assert.equal(v.stage, s);
      assert.equal(v.step, 2, `${type} ${s}`);
      assert.equal(v.key, `${s}.2`);
      assert.ok(!v.finished && v.crew && !v.open, `${type} ${s}`);
      assert.equal(partState(v), 'shut');
      // No crew on it, or halted: the site stands still.
      assert.ok(!sacredView(b, { buildings: new Map(), time: { totalTicks: 1 } }).crew);
      assert.ok(!sacredView(standIn(type, { stage: s, halted: true }), crewGame(b.id)).crew);
    }
    // Finished: open while staffed (and stocked), closed without staff, sacked by raiders.
    assert.ok(sacredView(standIn(type), null).open, type);
    assert.ok(!sacredView(standIn(type, { staffed: false }), null).open, type);
    const sk = sacredView(standIn(type, { sacked: true }), null);
    assert.ok(sk.sacked && !sk.open, type);
    // Struck: a site set back in the raid now on (and only then).
    const site = standIn(type, { stage: 1 });
    site.mon.setbackRaid = 'raid:7';
    assert.ok(sacredView(site, { ...crewGame(1), military: { active: { id: 7 } } }).struck, type);
    assert.ok(!sacredView(site, { ...crewGame(1), military: { active: { id: 8 } } }).struck, type);
  }
  // The lighthouse lit with keepers and timber, dark without either; its store's logs.
  assert.ok(sacredView(standIn('pharus'), null).lit);
  assert.ok(!sacredView(standIn('pharus', { store: false }), null).lit);
  assert.equal(woodLevel(standIn('pharus')), 3);
  assert.equal(woodLevel(standIn('pharus', { store: false })), 0);
  // A sanctuary on its god's feast.
  const fest = { city: { gods: { mars: { festivalsHeld: 1, monthsSinceFestival: 0 } } } };
  assert.equal(partState(sacredView(standIn('fanum_mars'), fest)), 'out');
  assert.equal(partState(sacredView(standIn('fanum_venus'), fest)), 'open');
});

test('sacred3d: every stage fits its footprint at every turn and level, within budget', () => {
  const e = 1e-6;
  const budget = { fanum: [130000, 40000, 12000], pantheum: [120000, 30000, 9000], pharus: [60000, 24000, 6000] };
  for (const type of SACRED_TYPES) {
    const S = BUILDINGS[type].size;
    const n = stagesOf(type);
    const word = BUILDINGS[type].mon;
    const cases = [];
    for (let s = 0; s <= n; s++) for (const share of s === n ? [0] : [0.1, 0.9]) cases.push({ stage: s, share });
    cases.push({ sacked: true });
    for (const c of cases) {
      const b = standIn(type, c);
      const tris = [];
      for (let lod = 0; lod < 3; lod++) {
        const { g } = look(type, b, crewGame(b.id), lod);
        tris.push(trianglesOf(g));
        const local = boundsOf(g);
        for (let T = 0; T < 4; T++) {
          const w = local.clone().applyMatrix4(modelMatrix(20, 9, S, T, 0));
          assert.ok(w.min.x >= 20 - e && w.max.x <= 20 + S + e && w.min.z >= 9 - e && w.max.z <= 9 + S + e, `${type} ${JSON.stringify(c)} lod ${lod} turn ${T}: ${JSON.stringify(w)}`);
          assert.ok(w.max.y < 5.5, `${type} ${JSON.stringify(c)}: ${w.max.y} tiles high`);
        }
      }
      tris.forEach((t, l) => assert.ok(t < budget[word][l], `${type} ${JSON.stringify(c)} lod ${l}: ${t}`));
      if (c.stage === undefined || c.stage === n) assert.ok(tris[0] > tris[1] && tris[1] > tris[2], `${type}: ${tris}`);
    }
  }
});

test('sacred3d: each god\'s sanctuary is its god\'s: the order, the god\'s kit, the dedication', () => {
  const keys = new Set();
  for (const god of GODS) {
    const type = `fanum_${god}`;
    const v = MODELS[type].variant(standIn(type), { snow: 0 }, { game: null });
    const more = v.more.map((m) => m.key);
    assert.ok(more.includes(`fanum:god:${god}`), god);
    assert.ok(more.includes(`fanum:col:${NUMEN[god].order}`), god);
    assert.ok(more.includes('fanum:body'), god);
    keys.add(v.key);
    // The god's ground differs: each god's own kit has its own parts (a basin's water only Neptune's).
    const parts = [];
    modelFor(v.key).build(v.key, 0).traverse((o) => { if (o.isMesh) parts.push(o.name); });
    assert.equal(parts.includes('water'), god === 'neptune' || god === 'venus', god);
  }
  assert.equal(keys.size, 5);
  // Before its roof is on, no god's kit: the temple is still rising.
  const early = MODELS.fanum_mars.variant(standIn('fanum_mars', { stage: 1 }), { snow: 0 }, { game: null });
  assert.ok(!early.more.some((m) => m.key.startsWith('fanum:god')));
});

test('sacred3d: people on the footprint; a working site has its crew, a halted one none; lamps only while open', () => {
  for (const type of SACRED_TYPES) {
    const S = BUILDINGS[type].size;
    const half = S * 2;
    const open = MODELS[type].variant(standIn(type), { snow: 0 }, { game: null });
    assert.ok(open.actors.actors.length > 0, type);
    for (let s = 0; s < stagesOf(type); s++) {
      const b = standIn(type, { stage: s });
      const working = MODELS[type].variant(b, { snow: 0 }, { game: crewGame(b.id), clock: 1 });
      assert.ok(working.actors.actors.length > 0, `${type} ${s}`);
      for (const a of working.actors.actors) {
        const [x, , z] = a.at || [0, 0, 0];
        assert.ok(Math.abs(x) <= half && Math.abs(z) <= half, `${type} ${s}: ${x}, ${z}`);
      }
      const halted = MODELS[type].variant(standIn(type, { stage: s, halted: true }), { snow: 0 }, { game: crewGame(b.id) });
      assert.equal(halted.actors.actors.length, 0, `${type} ${s} halted`);
    }
    for (const a of open.actors.actors) {
      const [x, , z] = a.at || [0, 0, 0];
      assert.ok(Math.abs(x) <= half - 0.2 && Math.abs(z) <= half - 0.2, `${type}: ${x}, ${z}`);
    }
    assert.ok(modelLamps(standIn(type), 0).length > 0, type);
    assert.equal(modelLamps(standIn(type, { staffed: false }), 0).length, 0, type);
    assert.equal(modelLamps(standIn(type, { stage: 1 }), 0).length, 0, type);
  }
  assert.equal(modelLamps(standIn('pharus', { store: false }), 0).length, 0);
});

test('sacred3d: the game\'s pass draws a sanctuary and a site from their kits, the site\'s wheels turning', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const done = standIn('fanum_venus', { id: 1, x: 0, y: 0 });
  const site = standIn('pantheum', { id: 2, x: 8, y: 0, stage: 3 });
  const game = crewGame(2);
  game.buildings.set(1, done);
  game.buildings.set(2, site);
  const r = { game, weather: {}, time: 2, motionOn: true };
  const placed = [done, site].map((b) => ({ b, T: 0, vx: b.x, vy: b.y, state: 0, snow: 0 }));
  mp.update(r, placed, 2);
  assert.equal(mp.stats.byType.fanum_venus, 1);
  assert.equal(mp.stats.byType.pantheum, 1);
  const shown = (key) => [...mp.kits.values()].some((k) => k.key === key && k.meshes.some((im) => im.count > 0));
  assert.ok(shown('fanum_venus:done') && shown('fanum:body') && shown('fanum:god:venus'));
  assert.ok(shown('pantheum:3.2'));
  assert.ok(shown('site:wheel'), 'a working treadwheel turns');
  mp.dispose();
});

void FANUM_TYPES;
