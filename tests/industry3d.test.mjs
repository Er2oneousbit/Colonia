/**
 * industry3d.test.mjs - the 3D clay pit, timber yard, iron mine and marble quarry (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the four have models; a build ghost shows them staffed, empty, nobody
 *   - every look (the body, each stock step, the frozen look of the two
 *     with water) fits its 2 x 2 footprint at every turn and level of
 *     detail, standing on the ground, low (the quarry face 4 m at most)
 *   - each level of detail is lighter than the one before, within budget
 *   - the store as a step of 0 to 3 from the producer's own good and the
 *     sim's cap, a kit and a matrix for each step, cached until it changes
 *   - states from the sim: staffed or not; each part's tag shows in some
 *     state and the states differ; the people at work, on the footprint
 *   - a hard frost freezes the standing water of the clay pit and the quarry
 *   - the iron mine's furnace smokes while staffed
 *   - the lanterns light at night only while staffed, one at each view turn
 *   - the game's pass draws a producer from its kits
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Group, Matrix4, Vector3 } from 'three';
import { CONFIG } from '../src/config.js';
import { MODELS, hasModel, modelFor, modelMatrix, modelLamps, partShows } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import { iceMaterial } from '../src/render3d/materials.js';
import { actorBounds, pack } from '../src/render3d/people/actors.js';
import { stockStep, STOCK_STEPS } from '../src/render3d/models/industryKit.js';
import { industryState } from '../src/render3d/models/industry.js';
import { clayPitActors } from '../src/render3d/models/clayPit.js';
import { timberYardActors, TIMBER_YARD } from '../src/render3d/models/timberYard.js';
import { ironMineActors, IRON_MINE, mineWindlass } from '../src/render3d/models/ironMine.js';
import { marbleQuarryActors, quarryWindlass } from '../src/render3d/models/marbleQuarry.js';
import { BUILDINGS } from '../src/data/buildings.js';

const TYPES = ['clay_pit', 'timber_yard', 'iron_mine', 'marble_quarry'];
const GOOD = { clay_pit: 'clay', timber_yard: 'timber', iron_mine: 'iron', marble_quarry: 'marble' };
const ICE = { clay_pit: true, timber_yard: false, iron_mine: false, marble_quarry: true };
const ACTORS = { clay_pit: clayPitActors, timber_yard: timberYardActors, iron_mine: ironMineActors, marble_quarry: marbleQuarryActors };
const S = 2;

/** Every look the game can ask a producer for. */
const looks = (type) => [type, ...(ICE[type] ? [`${type}:ice`] : []), ...[1, 2, 3].map((n) => `${type}:stock:${n}`)];

const building = (type, stock, efficiency = 1) => ({ id: 7, type, x: 10, y: 10, size: S, efficiency, stock: { [GOOD[type]]: stock } });

test('industry3d: the four raw producers have models, of the sim\'s size, and a ghost shows them staffed and empty', () => {
  for (const t of TYPES) {
    assert.ok(hasModel(t), t);
    assert.equal(BUILDINGS[t].size, S, `${t} is 2 x 2`);
    assert.equal(BUILDINGS[t].produces, GOOD[t], `${t} makes ${GOOD[t]}`);
    const v = MODELS[t].variant({ id: null, type: t, efficiency: 1 }, { snow: 0 }, null);
    assert.equal(v.state, 'open', t);
    assert.deepEqual(v.more, [], `${t}: a ghost has no stock, no smoke`);
  }
});

test('industry3d: every look fits its footprint at every turn and level of detail, on the ground, low', () => {
  const e = 1e-6;
  for (const type of TYPES) {
    for (const key of looks(type)) {
      for (let lod = 0; lod < 3; lod++) {
        const g = MODELS[type].build(key, lod);
        g.updateMatrixWorld(true);
        const local = new Box3().setFromObject(g);
        for (let T = 0; T < 4; T++) {
          const b = local.clone().applyMatrix4(modelMatrix(30, 12, S, T, 0));
          assert.ok(b.min.x >= 30 - e && b.max.x <= 30 + S + e && b.min.z >= 12 - e && b.max.z <= 12 + S + e, `${key} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
          // (Metres up: 4 m is one tile; the quarry's face may rise to 4 m, the rest are under 3.5.)
          assert.ok(b.min.y > -0.003 && b.max.y * 4 <= (type === 'marble_quarry' ? 4.05 : type === 'iron_mine' ? 3.8 : 3.5), `${key} lod ${lod}: ${b.max.y * 4} m high`);
        }
      }
    }
  }
});

test('industry3d: a model of 2 x 2 tiles stands two tiles wide (metres to tiles is a quarter, whatever the footprint)', () => {
  for (const type of TYPES) {
    const g = MODELS[type].build(type, 1);
    g.updateMatrixWorld(true);
    const b = new Box3().setFromObject(g).applyMatrix4(modelMatrix(0, 0, S, 0, 0));
    assert.ok(b.max.x - b.min.x > 1.8 && b.max.x - b.min.x <= S + 1e-6, `${type}: ${b.max.x - b.min.x} tiles wide`);
  }
});

test('industry3d: each level of detail is lighter than the one before, and within budget', () => {
  const budget = [20000, 10000, 3500];
  for (const type of TYPES) {
    const t = [0, 1, 2].map((l) => kitOf(MODELS[type].build(type, l)).triangles);
    assert.ok(t[0] > t[1] && t[1] > t[2], `${type}: ${t}`);
    t.forEach((n, l) => assert.ok(n < budget[l], `${type} lod ${l}: ${n}`));
    // A store is a few thousand at most close up, and a full one is heavier than a third of one.
    const s = [1, 2, 3].map((n) => kitOf(MODELS[type].build(`${type}:stock:${n}`, 0)).triangles);
    assert.ok(s[0] > 0 && s[0] <= s[1] && s[1] <= s[2] && s[2] < 5000, `${type} stock: ${s}`);
    const far = kitOf(MODELS[type].build(`${type}:stock:3`, 2)).triangles;
    assert.ok(far < s[2], `${type} stock far out: ${far} < ${s[2]}`);
  }
});

test('industry3d: the store as a step of 0 to 3 of the sim\'s cap, any stock at least a third', () => {
  const cap = CONFIG.PRODUCER_MAX_STOCK;
  assert.equal(STOCK_STEPS, 3);
  // The sim's lots are CART_CAPACITY (100) up to the cap (400): 0, 100, 200, 300, 400.
  assert.deepEqual([0, 100, 200, 300, 400].map((n) => stockStep(n, cap)), [0, 1, 2, 3, 3]);
  assert.deepEqual([undefined, -5, 1, 133, 134, 266, 267, 9999].map((n) => stockStep(n, cap)), [0, 0, 1, 1, 2, 2, 3, 3]);
  for (const type of TYPES) {
    const more = (n) => MODELS[type].variant(building(type, n), { snow: 0 }, null).more.filter((m) => m.key.includes(':stock:')).map((m) => m.key);
    assert.deepEqual(more(0), [], `${type}: empty shows no store`);
    assert.deepEqual(more(100), [`${type}:stock:1`]);
    assert.deepEqual(more(200), [`${type}:stock:2`]);
    assert.deepEqual(more(400), [`${type}:stock:3`]);
    // (A kit and one matrix; the same list while the step holds, so nothing is rebuilt as the stock changes.)
    const a = MODELS[type].variant(building(type, 300), { snow: 0 }, null).more;
    const b = MODELS[type].variant(building(type, 400), { snow: 0 }, null).more;
    assert.equal(a, b, `${type}: one list for a step`);
    assert.equal(a.find((m) => m.key.includes(':stock:')).n, 1);
    // Every kit the variant names builds, by the game's own lookup.
    for (const m of a) assert.ok(modelFor(m.key), `${m.key} has a builder`);
    // A producer without a stock record (an old save, a test) shows none.
    assert.deepEqual(MODELS[type].variant({ id: 3, type, efficiency: 1 }, { snow: 0 }, null).more.filter((m) => m.key.includes(':stock:')), []);
  }
});

/** A built look's meshes by name, each the states it shows in. */
function shownIn(type, key = type) {
  const g = MODELS[type].build(key, 0);
  const out = [];
  g.traverse((o) => {
    if (!o.isMesh) return;
    out.push({ name: o.name, when: o.userData.when, states: ['open', 'shut'].filter((s) => partShows(o.userData.when, s, false)), mesh: o });
  });
  return out;
}

test('industry3d: states from the sim: staffed or not; every part shows in some state and the two states differ', () => {
  assert.equal(industryState({ efficiency: 0.4 }), 'open');
  assert.equal(industryState({ efficiency: 0 }), 'shut');
  for (const type of TYPES) {
    const parts = shownIn(type);
    for (const p of parts) assert.ok(p.states.length, `${type} ${p.name}|${p.when} shows in no state`);
    const open = parts.filter((p) => p.states.includes('open')).length;
    const shut = parts.filter((p) => p.states.includes('shut')).length;
    assert.ok(parts.some((p) => p.when === 'open') && parts.some((p) => p.when === 'shut'), `${type}: a part for each state`);
    assert.ok(open > 0 && shut > 0);
    assert.equal(MODELS[type].variant(building(type, 0, 0), { snow: 0 }, null).state, 'shut');
    assert.equal(MODELS[type].variant(building(type, 0, 1), { snow: 0 }, null).state, 'open');
  }
  const named = (type, name, when) => shownIn(type).filter((p) => p.name === name && p.when === when).length;
  // The shear legs: the block hoisted on its tongs while it works, let down onto rollers (the crank hangs) when it does not.
  assert.ok(named('marble_quarry', 'marble', 'open') >= 1 && named('marble_quarry', 'marble', 'shut') >= 1, 'the hoisted block and the let-down one');
  assert.ok(named('marble_quarry', 'wood', 'shut') >= 1, 'rollers and the hanging crank when idle');
  // The bloomery's glow and the bloom only while the fire is lit; the picks lean at the adit when no one holds them.
  assert.ok(named('iron_mine', 'ember', 'open') >= 1 && named('iron_mine', 'ember', 'shut') === 0, 'the furnace lit only while staffed');
  assert.ok(named('iron_mine', 'wood', 'shut') >= 1, 'picks leaning');
  // The saw in its kerf while it works, leaning when it does not.
  assert.ok(named('timber_yard', 'iron', 'open') >= 1 && named('timber_yard', 'iron', 'shut') >= 1, 'the saw');
  assert.ok(named('clay_pit', 'pit-clay', 'open') === 0 && named('clay_pit', 'rawClay', 'open') >= 1, 'the barrow\'s load only while it works');
});

test('industry3d: part names are materials of the brief, and the standing water is its own part', () => {
  // ('leaf' is the grass cap of the quarry's and the mine's hills: a plain colour carried by the vertices.)
  const allowed = new Set(['earth', 'rawClay', 'ore', 'marble', 'stone', 'wood', 'thatch', 'rope', 'iron', 'bronze', 'wicker', 'hide', 'clay', 'dark', 'ember', 'water', 'lamp', 'leaf']);
  for (const type of TYPES) {
    for (const key of looks(type)) {
      for (const p of shownIn(type, key)) {
        assert.ok(allowed.has(p.name), `${key}: part ${p.name}`);
        assert.ok(p.mesh.material, `${key}: ${p.name} has a material`);
      }
    }
  }
  const has = (type, name) => shownIn(type).some((p) => p.name === name);
  assert.ok(has('clay_pit', 'water') && has('clay_pit', 'thatch') && has('clay_pit', 'rawClay'));
  assert.ok(has('timber_yard', 'thatch') && has('timber_yard', 'iron') && has('timber_yard', 'wood'));
  assert.ok(has('iron_mine', 'ore') && has('iron_mine', 'clay') && has('iron_mine', 'dark') && has('iron_mine', 'stone'));
  assert.ok(has('marble_quarry', 'marble') && has('marble_quarry', 'water') && has('marble_quarry', 'rope'));
});

test('industry3d: the people at work: who, where, doing what; nobody when idle; on the footprint at every turn', () => {
  const m = new Matrix4();
  const p = new Vector3();
  const want = { clay_pit: ['hoe', 'hoe', 'hoe'], timber_yard: ['hoe', 'pump', 'pump'], iron_mine: ['hoe', 'windlass', 'hammer'], marble_quarry: ['windlass', 'hammer', 'hammer'] };
  for (const type of TYPES) {
    assert.deepEqual(ACTORS[type]('shut'), [], `${type}: nobody idle`);
    assert.deepEqual(ACTORS[type]('open').map((a) => a.clip), want[type], type);
    const staffed = MODELS[type].variant(building(type, 0), { snow: 0 }, null);
    const idle = MODELS[type].variant(building(type, 0, 0), { snow: 0 }, null);
    assert.equal(staffed.actors.actors.length, 3, type);
    assert.equal(idle.actors.actors.length, 0, type);
    assert.equal(staffed.actors, MODELS[type].variant(building(type, 100), { snow: 0 }, null).actors, `${type}: one cast for a state`);
    // (Every spec packs: its clip, props and garments exist.)
    for (const spec of ACTORS[type]('open')) assert.ok(pack(spec), `${type} ${spec.clip}`);
    for (let T = 0; T < 4; T++) {
      modelMatrix(0, 0, S, T, 0, m);
      for (const act of staffed.actors.actors) {
        for (const c of actorBounds(act, 0.3)) {
          for (const [dx, dz] of [[c.r, 0], [-c.r, 0], [0, c.r], [0, -c.r]]) {
            p.set(c.x + dx, 0, c.z + dz).applyMatrix4(m);
            assert.ok(p.x >= -1e-6 && p.x <= S + 1e-6 && p.z >= -1e-6 && p.z <= S + 1e-6, `${type} turn ${T}: an actor at ${c.x.toFixed(2)}, ${c.z.toFixed(2)} off the footprint`);
          }
        }
      }
    }
  }
  // The windlass winders stand where the roller's crank is (people/clips.js WINDLASS: the axle ahead of him, to his left).
  for (const [type, axis] of [['iron_mine', mineWindlass()], ['marble_quarry', quarryWindlass()]]) {
    const winder = ACTORS[type]('open').find((a) => a.clip === 'windlass');
    assert.equal(winder.props.R, 'crank');
    assert.ok(Math.abs(winder.at[2] - axis.z - 0.44) < 1e-6 && winder.at[0] > axis.x1, `${type}: at the roller's right end`);
  }
  // The sawyers draw one saw: one on the log, one on the ground, either side of the cut, facing each other.
  const [feller, top, low] = ACTORS.timber_yard('open');
  assert.equal(feller.props.R, 'axe');
  assert.ok(top.at[1] > low.at[1] + 1 && Math.abs(top.at[2] - low.at[2]) < 1e-6 && Math.abs(Math.abs(top.ry - low.ry) - Math.PI) < 1e-6);
  assert.ok(top.at[0] < TIMBER_YARD.saw.cut && low.at[0] > TIMBER_YARD.saw.cut);
});

test('industry3d: a hard frost freezes the standing water of the clay pit and the quarry\'s trough', () => {
  const water = (type, key) => {
    let m = null;
    MODELS[type].build(key, 1).traverse((o) => { if (o.isMesh && o.name === 'water') m = o.material; });
    return m;
  };
  for (const type of TYPES) {
    const b = building(type, 0);
    assert.equal(MODELS[type].variant(b, { snow: 2 }, null).key, ICE[type] ? `${type}:ice` : type, type);
    assert.equal(MODELS[type].variant(b, { snow: 3 }, null).key, ICE[type] ? `${type}:ice` : type, type);
    assert.equal(MODELS[type].variant(b, { snow: 1 }, null).key, type, `${type}: a light snow is not a frost`);
    if (!ICE[type]) continue;
    assert.equal(water(type, `${type}:ice`), iceMaterial());
    assert.notEqual(water(type, type), iceMaterial());
  }
});

test('industry3d: the iron mine\'s furnace smokes while it is staffed, over its top', () => {
  const smoke = (b) => MODELS.iron_mine.variant(b, { snow: 0 }, null).more.filter((m) => m.key === 'sacra:smoke:thin');
  assert.equal(smoke(building('iron_mine', 0)).length, 1);
  assert.equal(smoke(building('iron_mine', 0, 0)).length, 0, 'out when idle');
  const m = smoke(building('iron_mine', 0))[0];
  assert.deepEqual([m.mats[12], m.mats[13], m.mats[14]].map((v) => +v.toFixed(3)), [IRON_MINE.furnace.x, IRON_MINE.furnace.top, IRON_MINE.furnace.z]);
  assert.ok(modelFor(m.key), 'the temples\' smoke kit');
  for (const t of ['clay_pit', 'timber_yard', 'marble_quarry']) assert.equal(MODELS[t].variant(building(t, 0), { snow: 0 }, null).more.filter((x) => x.key.startsWith('sacra')).length, 0, t);
});

test('industry3d: the lanterns light at night only while staffed, one at each view turn, inside the footprint', () => {
  for (const type of TYPES) {
    const b = { type, size: S, efficiency: 1 };
    assert.deepEqual(modelLamps({ ...b, efficiency: 0 }, 0), [], `${type}: dark with nobody at work`);
    for (let T = 0; T < 4; T++) {
      const pts = modelLamps(b, T);
      assert.equal(pts.length, 1, `${type} turn ${T}: one lamp the view sees`);
      const [u, v, z] = pts[0];
      assert.ok(u > 0 && u < S && v > 0 && v < S && z > 0, `${type}: ${u}, ${v}, ${z}`);
    }
  }
});

test('industry3d: the game\'s pass draws a producer from its kits, the store as a kit of its own, nothing rebuilt as the stock changes', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const game = { map: { desirability: [0], idx: () => 0 }, walkers: new Map() };
  const r = { game, weather: {}, time: 0 };
  const b = building('iron_mine', 0);
  const frame = () => {
    for (let i = 0; i < 4; i++) mp.update(r, [{ b, T: 0, vx: 0, vy: 0, state: 0, snow: 0 }], 1);
    for (let i = 0; i < 400 && (mp.stats.deferred > 0 || mp.people.dirty); i++) mp.update(r, [{ b, T: 0, vx: 0, vy: 0, state: 0, snow: 0 }], 1);
  };
  const drawn = (key, when) => {
    const k = mp.kits.get(`${key}|1`);
    return k ? k.meshes.filter((im) => !when || im.userData.part.when === when).reduce((n, im) => n + im.userData.n, 0) : 0;
  };
  frame();
  assert.ok(drawn('iron_mine', 'open') >= 1 && drawn('iron_mine', 'shut') === 0, 'staffed: its open parts');
  assert.equal(drawn('iron_mine:stock:1'), 0, 'empty: no store');
  assert.ok(drawn('sacra:smoke:thin') >= 1, 'smoke while staffed');
  assert.equal(mp.people.stats.people, 3, 'its three men');
  const kit = mp.kits.get('iron_mine|1');
  b.stock.iron = 100;
  frame();
  assert.ok(drawn('iron_mine:stock:1') >= 1 && drawn('iron_mine:stock:3') === 0, 'a third');
  b.stock.iron = 400;
  frame();
  assert.ok(drawn('iron_mine:stock:3') >= 1 && drawn('iron_mine:stock:1') === 0, 'full');
  assert.equal(mp.kits.get('iron_mine|1'), kit, 'the same kit through every step');
  b.efficiency = 0;
  frame();
  assert.ok(drawn('iron_mine', 'shut') >= 1 && drawn('iron_mine', 'open') === 0, 'idle: its shut parts');
  assert.equal(drawn('sacra:smoke:thin'), 0, 'the furnace is out');
  assert.equal(mp.people.stats.people, 0, 'nobody');
  mp.dispose();
});
