/**
 * industry3d.test.mjs - the 3D clay pit, timber yard, iron mine and marble quarry, and the eight workshops (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the twelve have models; a build ghost shows them staffed, empty, nobody
 *   - every look (the body, each stock step, the frozen look of the two
 *     with water) fits its 2 x 2 footprint at every turn and level of
 *     detail, standing on the ground, low (the quarry face 4 m at most)
 *   - each level of detail is lighter than the one before, within budget
 *   - the store as a step of 0 to 3 from the producer's own good and the
 *     sim's cap, a kit and a matrix for each step, cached until it changes
 *   - states from the sim: staffed or not; each part's tag shows in some
 *     state and the states differ; the people at work, on the footprint
 *   - a hard frost freezes the standing water of the clay pit and the quarry
 *   - the iron mine's furnace smokes while staffed, and so do the Potter's kiln and the Weaponsmith's forge
 *   - the workshops: one kit (a plastered shed on a tufa footing under a tiled
 *     roof, open to the street, boards across it when shut), each store (the
 *     raw material, the Fletcher's iron, the product) in steps of its own cap,
 *     each trade's fittings and people, the ice of the standing water
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
import { workshopState, WORKSHOP_OUT_CAP } from '../src/render3d/models/workshops.js';
import { clayPitActors } from '../src/render3d/models/clayPit.js';
import { timberYardActors, TIMBER_YARD } from '../src/render3d/models/timberYard.js';
import { ironMineActors, IRON_MINE, mineWindlass } from '../src/render3d/models/ironMine.js';
import { marbleQuarryActors, quarryWindlass } from '../src/render3d/models/marbleQuarry.js';
import { POTTER, potterActors } from '../src/render3d/models/wsPotter.js';
import { carpenterActors } from '../src/render3d/models/wsCarpenter.js';
import { oilPressActors, OIL_PRESS, pressWindlass } from '../src/render3d/models/wsOilPress.js';
import { wineryActors, WINERY } from '../src/render3d/models/wsWinery.js';
import { weaponsmithActors, WEAPONSMITH } from '../src/render3d/models/wsWeaponsmith.js';
import { fletcherActors } from '../src/render3d/models/wsFletcher.js';
import { linenWeaverActors } from '../src/render3d/models/wsLinen.js';
import { clothingMakerActors } from '../src/render3d/models/wsClothing.js';
import { WS } from '../src/render3d/models/workshopKit.js';
import { BUILDINGS } from '../src/data/buildings.js';

const TYPES = ['clay_pit', 'timber_yard', 'iron_mine', 'marble_quarry'];
const GOOD = { clay_pit: 'clay', timber_yard: 'timber', iron_mine: 'iron', marble_quarry: 'marble' };
const ICE = { clay_pit: true, timber_yard: false, iron_mine: false, marble_quarry: true };
const ACTORS = { clay_pit: clayPitActors, timber_yard: timberYardActors, iron_mine: ironMineActors, marble_quarry: marbleQuarryActors };

// The eight workshops: what each holds, makes, whether it has standing water, and its people.
const WORKSHOPS = ['pottery_ws', 'furniture_ws', 'oil_ws', 'wine_ws', 'weapons_ws', 'fletcher_ws', 'linen_ws', 'clothing_ws'];
const INPUT = { pottery_ws: 'clay', furniture_ws: 'timber', oil_ws: 'olives', wine_ws: 'grapes', weapons_ws: 'iron', fletcher_ws: 'timber', linen_ws: 'flax', clothing_ws: 'linen' };
const INPUT2 = { fletcher_ws: 'iron' };
const OUTPUT = { pottery_ws: 'pottery', furniture_ws: 'furniture', oil_ws: 'oil', wine_ws: 'wine', weapons_ws: 'weapons', fletcher_ws: 'arrows', linen_ws: 'linen', clothing_ws: 'clothing' };
const WS_ICE = { pottery_ws: false, furniture_ws: false, oil_ws: false, wine_ws: false, weapons_ws: true, fletcher_ws: false, linen_ws: true, clothing_ws: true };
const WS_ACTORS = { pottery_ws: potterActors, furniture_ws: carpenterActors, oil_ws: oilPressActors, wine_ws: wineryActors, weapons_ws: weaponsmithActors, fletcher_ws: fletcherActors, linen_ws: linenWeaverActors, clothing_ws: clothingMakerActors };
/** What each trade's people do, in order (clips.js). */
const WS_CLIPS = {
  pottery_ws: ['sit', 'stir'], furniture_ws: ['hammer', 'hoe', 'sweep'], oil_ws: ['windlass', 'stir', 'carry'], wine_ws: ['tread', 'windlass', 'carry'],
  weapons_ws: ['hammer', 'pump'], fletcher_ws: ['sit', 'shoot'], linen_ws: ['prune', 'spin'], clothing_ws: ['prune', 'sit', 'tread'],
};
Object.assign(GOOD, INPUT);
Object.assign(ACTORS, WS_ACTORS);
Object.assign(ICE, WS_ICE);
const ALL = [...TYPES, ...WORKSHOPS];
/** The kinds of store a type shows: a producer's one, a workshop's raw material (and the Fletcher's iron) and product. */
const kinds = (type) => (WORKSHOPS.includes(type) ? ['in', ...(INPUT2[type] ? ['in2'] : []), 'out'] : ['stock']);
/** The kit of a type's store: '<type>:stock:<n>' for a producer, '<type>:<in|in2|out>:<n>' for a workshop. */
const storeKey = (type, kind, n) => `${type}:${kind}:${n}`;
const S = 2;

/** Every look the game can ask a producer for. */
const looks = (type) => [type, ...(ICE[type] ? [`${type}:ice`] : []), ...kinds(type).flatMap((k) => [1, 2, 3].map((n) => storeKey(type, k, n)))];

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

test('industry3d: the eight workshops have models, of the sim\'s size, for the goods of the sim\'s recipes, and a ghost shows them staffed and empty', () => {
  for (const t of WORKSHOPS) {
    assert.ok(hasModel(t), t);
    assert.equal(BUILDINGS[t].size, S, `${t} is 2 x 2`);
    assert.equal(BUILDINGS[t].kind, 'workshop', t);
    assert.equal(BUILDINGS[t].produces, OUTPUT[t], `${t} makes ${OUTPUT[t]}`);
    assert.deepEqual(Object.keys(BUILDINGS[t].recipe), [INPUT[t], ...(INPUT2[t] ? [INPUT2[t]] : [])], `${t} takes its recipe's goods`);
    const v = MODELS[t].variant({ id: null, type: t, efficiency: 1 }, { snow: 0 }, null);
    assert.equal(v.state, 'open', t);
    assert.deepEqual(v.more, [], `${t}: a ghost has no stock, no smoke`);
  }
  assert.equal(workshopState({ efficiency: 0.2 }), 'open');
  assert.equal(workshopState({ efficiency: 0 }), 'shut');
});

test('industry3d: every look fits its footprint at every turn and level of detail, on the ground, low', () => {
  const e = 1e-6;
  for (const type of ALL) {
    for (const key of looks(type)) {
      for (let lod = 0; lod < 3; lod++) {
        const g = MODELS[type].build(key, lod);
        g.updateMatrixWorld(true);
        const local = new Box3().setFromObject(g);
        for (let T = 0; T < 4; T++) {
          const b = local.clone().applyMatrix4(modelMatrix(30, 12, S, T, 0));
          assert.ok(b.min.x >= 30 - e && b.max.x <= 30 + S + e && b.min.z >= 12 - e && b.max.z <= 12 + S + e, `${key} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
          // (Metres up: 4 m is one tile; the quarry's face may rise to 4 m, the Weaponsmith's flue to 3.9, the rest are under 3.5.)
          assert.ok(b.min.y > -0.003 && b.max.y * 4 <= (type === 'marble_quarry' ? 4.05 : type === 'weapons_ws' ? 3.9 : type === 'iron_mine' ? 3.8 : 3.5), `${key} lod ${lod}: ${b.max.y * 4} m high`);
        }
      }
    }
  }
});

test('industry3d: a model of 2 x 2 tiles stands two tiles wide (metres to tiles is a quarter, whatever the footprint)', () => {
  for (const type of ALL) {
    const g = MODELS[type].build(type, 1);
    g.updateMatrixWorld(true);
    const b = new Box3().setFromObject(g).applyMatrix4(modelMatrix(0, 0, S, 0, 0));
    assert.ok(b.max.x - b.min.x > 1.8 && b.max.x - b.min.x <= S + 1e-6, `${type}: ${b.max.x - b.min.x} tiles wide`);
  }
});

test('industry3d: each level of detail is lighter than the one before, and within budget', () => {
  const budget = [20000, 10000, 3500];
  for (const type of ALL) {
    const t = [0, 1, 2].map((l) => kitOf(MODELS[type].build(type, l)).triangles);
    assert.ok(t[0] > t[1] && t[1] > t[2], `${type}: ${t}`);
    t.forEach((n, l) => assert.ok(n < budget[l], `${type} lod ${l}: ${n}`));
    // A store is a few thousand at most close up, and a full one is heavier than a third of one.
    for (const kind of kinds(type)) {
      const s = [1, 2, 3].map((n) => kitOf(MODELS[type].build(storeKey(type, kind, n), 0)).triangles);
      assert.ok(s[0] > 0 && s[0] <= s[1] && s[1] <= s[2] && s[2] < 5000, `${type} ${kind}: ${s}`);
      const far = kitOf(MODELS[type].build(storeKey(type, kind, 3), 2)).triangles;
      assert.ok(far < s[2], `${type} ${kind} far out: ${far} < ${s[2]}`);
    }
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

test('industry3d: a workshop\'s stores as steps of 0 to 3 of their caps: the raw material (up to WORKSHOP_RAW_CAP), the Fletcher\'s iron, the product (two lots)', () => {
  assert.equal(CONFIG.WORKSHOP_RAW_CAP, 200);
  // (sim/production.js: a workshop stops at two lots of its product, so that is the product's cap.)
  assert.equal(WORKSHOP_OUT_CAP, CONFIG.CART_CAPACITY * 2);
  const stocked = (type, stock) => ({ id: 7, type, x: 10, y: 10, size: S, efficiency: 1, stock });
  for (const type of WORKSHOPS) {
    const more = (stock, kind) => MODELS[type].variant(stocked(type, stock), { snow: 0 }, null).more.filter((m) => m.key.startsWith(`${type}:${kind}:`)).map((m) => m.key);
    const raw = (n) => ({ [INPUT[type]]: n });
    const made = (n) => ({ [OUTPUT[type]]: n });
    // The raw material: 100 of 200 is a half, so two thirds; 200 is full; the lot sizes of the sim give 0, 1, 2, 3.
    assert.deepEqual(more({}, 'in'), [], `${type}: no raw material shows none`);
    assert.deepEqual(more(raw(60), 'in'), [`${type}:in:1`], type);
    assert.deepEqual(more(raw(100), 'in'), [`${type}:in:2`], type);
    assert.deepEqual(more(raw(200), 'in'), [`${type}:in:3`], type);
    assert.deepEqual(more(raw(60), 'out'), [], `${type}: raw material is not product`);
    // The product: the same steps of its own cap, not of the raw material's.
    assert.deepEqual(more(made(0), 'out'), []);
    assert.deepEqual(more(made(60), 'out'), [`${type}:out:1`], type);
    assert.deepEqual(more(made(100), 'out'), [`${type}:out:2`], type);
    assert.deepEqual(more(made(200), 'out'), [`${type}:out:3`], type);
    assert.deepEqual(more(made(200), 'in'), [], `${type}: product is not raw material`);
    // The second raw material is its own store: only the Fletcher has one.
    assert.deepEqual(more({ [INPUT2[type] || 'zzz']: 200 }, 'in2'), INPUT2[type] ? [`${type}:in2:3`] : [], type);
    if (INPUT2[type]) {
      assert.deepEqual(more({ timber: 60, iron: 200 }, 'in'), [`${type}:in:1`], 'timber: a third');
      assert.deepEqual(more({ timber: 60, iron: 200 }, 'in2'), [`${type}:in2:3`], 'iron: full');
    }
    // One list while the steps hold, so nothing is rebuilt as the stock changes; each a kit and one matrix.
    const a = MODELS[type].variant(stocked(type, { ...raw(190), ...made(150) }), { snow: 0 }, null).more;
    const b = MODELS[type].variant(stocked(type, { ...raw(200), ...made(170) }), { snow: 0 }, null).more;
    assert.equal(a, b, `${type}: one list for the steps`);
    for (const m of a) {
      assert.equal(m.n, 1);
      assert.ok(modelFor(m.key), `${m.key} has a builder`);
    }
    // No stock record (an old save, a test): no stores.
    assert.deepEqual(MODELS[type].variant({ id: 3, type, efficiency: 1 }, { snow: 0 }, null).more.filter((m) => m.key.includes(':in') || m.key.includes(':out')), []);
    // The stores are shown idle too: a closed shop still holds what it holds.
    assert.deepEqual(MODELS[type].variant({ ...stocked(type, raw(200)), efficiency: 0 }, { snow: 0 }, null).more.map((m) => m.key).filter((k) => k.startsWith(type)), [`${type}:in:3`], type);
    // The warm-up asks for the body and the fullest stores.
    for (const key of MODELS[type].warm) assert.ok(modelFor(key), `${key} is warmed`);
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
  for (const type of ALL) {
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
  // The workshops: the shop front open when staffed, boards across it when shut; the lantern lit or cold.
  for (const type of WORKSHOPS) {
    assert.ok(named(type, 'plaster', 'shut') >= 1, `${type}: boards across the front when shut`);
    assert.equal(named(type, 'plaster', 'open'), 0, `${type}: no boards in the way when open`);
    assert.ok(named(type, 'lamp', 'open') >= 1 && named(type, 'lamp', 'shut') >= 1, `${type}: the lantern lit or cold`);
  }
  // The kiln's mouth glows while it is fired and is bricked up when not; the forge's coals glow, or are black.
  assert.ok(named('pottery_ws', 'ember', 'open') >= 1 && named('pottery_ws', 'ember', 'shut') === 0 && named('pottery_ws', 'clay', 'shut') >= 1);
  assert.ok(named('weapons_ws', 'ember', 'open') >= 1 && named('weapons_ws', 'ember', 'shut') === 0 && named('weapons_ws', 'dark', 'shut') >= 1);
  // The tools laid by on the bench and the stirring stick on the vat's rim, when no one holds them.
  assert.ok(named('furniture_ws', 'iron', 'shut') >= 1, 'the carpenter\'s chisel on the baulk');
  assert.ok(named('weapons_ws', 'iron', 'shut') >= 1, 'the smith\'s tongs on the stump');
});

test('industry3d: part names are materials of the brief, and the standing water is its own part', () => {
  // ('leaf' is the grass cap of the quarry's and the mine's hills: a plain colour carried by the vertices.)
  const allowed = new Set(['earth', 'rawClay', 'ore', 'marble', 'stone', 'wood', 'thatch', 'rope', 'iron', 'bronze', 'wicker', 'hide', 'clay', 'dark', 'ember', 'water', 'lamp', 'leaf']);
  // (The workshops add the plaster of their walls over a footing of tufa, the roof's tiles, dyed cloth, bark, the liquids.)
  for (const m of ['plaster', 'tufa', 'tile', 'cloth', 'produce', 'bark']) allowed.add(m);
  for (const type of ALL) {
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

test('industry3d: the workshops share one kit: plastered walls on a tufa footing, a tiled roof, timber posts, a lantern, a yard', () => {
  for (const type of WORKSHOPS) {
    const parts = shownIn(type);
    const names = new Set(parts.map((p) => p.name));
    for (const need of ['plaster', 'tufa', 'tile', 'wood', 'stone', 'earth', 'bronze', 'lamp', 'wicker']) assert.ok(names.has(need), `${type}: has ${need}`);
    // The footprint inside which the shed stands, and the fittings round it.
    assert.ok(WS.zFront > WS.zBack && WS.eave < WS.back && WS.foot < WS.eave, 'the shed\'s measures');
    // The roof and the footing are in both states (one look for the shed).
    // (The tufa and the tiles are the same in both states; the plaster has the shut front's boards besides the walls.)
    for (const n of ['tufa', 'tile']) assert.ok(parts.filter((p) => p.name === n).every((p) => p.when === 'always' || p.when === undefined), `${type}: ${n} is the same in both states`);
    assert.ok(parts.some((p) => p.name === 'plaster' && p.when === 'always'), `${type}: the walls`);
  }
  // Each trade's own things, by the materials only it uses.
  const has = (type, key, name) => shownIn(type, key).some((p) => p.name === name);
  assert.ok(has('pottery_ws', 'pottery_ws', 'rawClay') && has('pottery_ws', 'pottery_ws', 'ember') && has('pottery_ws', 'pottery_ws:out:3', 'clay'), 'the kiln, the wheel\'s clay and the pots');
  assert.ok(has('furniture_ws', 'furniture_ws:out:3', 'cloth') && has('furniture_ws', 'furniture_ws:out:3', 'iron') && has('furniture_ws', 'furniture_ws:in:3', 'wood'), 'the couch\'s cushions, the chests\' bands and the baulks');
  assert.ok(has('oil_ws', 'oil_ws', 'rope') && has('oil_ws', 'oil_ws', 'produce') && has('oil_ws', 'oil_ws:in:3', 'wicker') && has('oil_ws', 'oil_ws:out:3', 'clay'), 'the press\'s mats, the oil\'s vat, the olives in baskets, the amphorae');
  assert.ok(has('wine_ws', 'wine_ws', 'produce') && has('wine_ws', 'wine_ws', 'clay') && has('wine_ws', 'wine_ws:in:3', 'wicker') && has('wine_ws', 'wine_ws:out:3', 'clay'), 'the must in the vat, the dolia, the grapes, the amphorae');
  assert.ok(has('weapons_ws', 'weapons_ws', 'ember') && has('weapons_ws', 'weapons_ws', 'water') && has('weapons_ws', 'weapons_ws:out:3', 'bronze') && has('weapons_ws', 'weapons_ws:in:3', 'iron'), 'the forge, the quench trough, the shields\' bosses, the bars');
  assert.ok(has('fletcher_ws', 'fletcher_ws', 'thatch') && has('fletcher_ws', 'fletcher_ws:out:3', 'cloth') && has('fletcher_ws', 'fletcher_ws:in2:3', 'iron'), 'the butt\'s straw, the feathers, the iron');
  assert.ok(has('linen_ws', 'linen_ws', 'water') && has('linen_ws', 'linen_ws', 'cloth') && has('linen_ws', 'linen_ws:in:3', 'thatch') && has('linen_ws', 'linen_ws:out:3', 'cloth'), 'the retting trough, the loom\'s cloth, the flax, the bolts');
  assert.ok(has('clothing_ws', 'clothing_ws', 'water') && has('clothing_ws', 'clothing_ws', 'wicker') && has('clothing_ws', 'clothing_ws:out:3', 'cloth'), 'the fuller\'s tub, the wicker cage, the garments');
});

test('industry3d: the people at work: who, where, doing what; nobody when idle; on the footprint at every turn', () => {
  const m = new Matrix4();
  const p = new Vector3();
  const want = { clay_pit: ['hoe', 'hoe', 'hoe'], timber_yard: ['hoe', 'pump', 'pump'], iron_mine: ['hoe', 'windlass', 'hammer'], marble_quarry: ['windlass', 'hammer', 'hammer'], ...WS_CLIPS };
  for (const type of ALL) {
    assert.deepEqual(ACTORS[type]('shut'), [], `${type}: nobody idle`);
    assert.deepEqual(ACTORS[type]('open').map((a) => a.clip), want[type], type);
    const staffed = MODELS[type].variant(building(type, 0), { snow: 0 }, null);
    const idle = MODELS[type].variant(building(type, 0, 0), { snow: 0 }, null);
    assert.equal(staffed.actors.actors.length, want[type].length, type);
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
  for (const [type, axis] of [['iron_mine', mineWindlass()], ['marble_quarry', quarryWindlass()], ['oil_ws', pressWindlass(OIL_PRESS.press)], ['wine_ws', pressWindlass(WINERY.press)]]) {
    const winder = ACTORS[type]('open').find((a) => a.clip === 'windlass');
    assert.equal(winder.props.R, 'crank');
    assert.ok(Math.abs(winder.at[2] - axis.z - 0.44) < 1e-6 && winder.at[0] > axis.x1, `${type}: at the roller's right end`);
  }
  // The sawyers draw one saw: one on the log, one on the ground, either side of the cut, facing each other.
  const [feller, top, low] = ACTORS.timber_yard('open');
  assert.equal(feller.props.R, 'axe');
  assert.ok(top.at[1] > low.at[1] + 1 && Math.abs(top.at[2] - low.at[2]) < 1e-6 && Math.abs(Math.abs(top.ry - low.ry) - Math.PI) < 1e-6);
  assert.ok(top.at[0] < TIMBER_YARD.saw.cut && low.at[0] > TIMBER_YARD.saw.cut);
  // The potter sits behind his wheel, facing it; the smith stands at the anvil facing it; the fletcher's archer faces the butt.
  const [potter] = ACTORS.pottery_ws('open');
  assert.ok(Math.abs(potter.at[2] + 0.3 - POTTER.wheel.z) < 1e-6 && Math.abs(potter.at[0] - POTTER.wheel.x) < 1e-6 && potter.ry === 0, 'at the wheel');
  const [smith, boy] = ACTORS.weapons_ws('open');
  assert.ok(Math.abs(smith.at[2] - WEAPONSMITH.anvil.z - 0.42) < 1e-6 && Math.abs(smith.at[0] - WEAPONSMITH.anvil.x) < 1e-6 && Math.abs(smith.ry - Math.PI) < 1e-6, 'at the anvil');
  assert.equal(boy.props.R, 'beam', 'the boy works the bellows\' beam');
  const [, archer] = ACTORS.fletcher_ws('open');
  assert.deepEqual([archer.props.L, archer.props.R], ['bow', 'arrow']);
  // The treaders walk in place at the pace of their floor (a vat's, not the treadwheel's pace of a man's walk).
  for (const t of ['wine_ws', 'clothing_ws']) assert.ok(ACTORS[t]('open').find((a) => a.clip === 'tread').speed > 0, `${t}: the treader's pace`);
});

test('industry3d: a hard frost freezes the standing water of the clay pit, the quarry\'s trough, the quench trough, the retting trough and the fuller\'s tub', () => {
  const water = (type, key) => {
    let m = null;
    MODELS[type].build(key, 1).traverse((o) => { if (o.isMesh && o.name === 'water') m = o.material; });
    return m;
  };
  for (const type of ALL) {
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

test('industry3d: the Potter\'s kiln and the Weaponsmith\'s forge smoke while staffed, over their tops; no other workshop does', () => {
  const smoke = (type, efficiency = 1) => MODELS[type].variant({ ...building(type, 0), efficiency }, { snow: 0 }, null).more.filter((m) => m.key.startsWith('sacra:smoke'));
  for (const [type, at, kind] of [['pottery_ws', POTTER.smoke, 'thin'], ['weapons_ws', WEAPONSMITH.smoke, 'thick']]) {
    assert.equal(smoke(type).length, 1, type);
    assert.equal(smoke(type, 0).length, 0, `${type}: out when idle`);
    const m = smoke(type)[0];
    assert.equal(m.key, `sacra:smoke:${kind}`, type);
    assert.deepEqual([m.mats[12], m.mats[13], m.mats[14]].map((v) => +v.toFixed(3)), [at.x, at.y, at.z], `${type}: over its fire`);
    assert.ok(modelFor(m.key), 'the temples\' smoke kit');
    assert.ok(MODELS[type].warm.includes(m.key), `${type}: the smoke is warmed up`);
  }
  // The forge's stack stands at the smoke's foot, through the roof: the smoke rises from the stack's top, 3.8 m up.
  assert.ok(WEAPONSMITH.smoke.y > WS.back && WEAPONSMITH.smoke.y <= 3.9);
  for (const t of WORKSHOPS.filter((w) => w !== 'pottery_ws' && w !== 'weapons_ws')) assert.equal(smoke(t).length, 0, t);
});

test('industry3d: the lanterns light at night only while staffed, one at each view turn, inside the footprint', () => {
  for (const type of ALL) {
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

test('industry3d: the game\'s pass draws a workshop from its kits: the stores of raw material and product apart, its smoke and its people, nothing rebuilt as the stock changes', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const game = { map: { desirability: [0], idx: () => 0 }, walkers: new Map() };
  const r = { game, weather: {}, time: 0 };
  const b = { id: 9, type: 'weapons_ws', x: 10, y: 10, size: S, efficiency: 1, stock: { iron: 0, weapons: 0 } };
  const frame = () => {
    for (let i = 0; i < 4; i++) mp.update(r, [{ b, T: 0, vx: 0, vy: 0, state: 0, snow: 0 }], 1);
    for (let i = 0; i < 400 && (mp.stats.deferred > 0 || mp.people.dirty); i++) mp.update(r, [{ b, T: 0, vx: 0, vy: 0, state: 0, snow: 0 }], 1);
  };
  const drawn = (key, when) => {
    const k = mp.kits.get(`${key}|1`);
    return k ? k.meshes.filter((im) => !when || im.userData.part.when === when).reduce((n, im) => n + im.userData.n, 0) : 0;
  };
  frame();
  assert.ok(drawn('weapons_ws', 'open') >= 1 && drawn('weapons_ws', 'shut') === 0, 'staffed: its open parts, the front open');
  assert.equal(drawn('weapons_ws:in:1') + drawn('weapons_ws:out:1'), 0, 'empty: no stores');
  assert.ok(drawn('sacra:smoke:thick') >= 1, 'smoke from the forge while staffed');
  assert.equal(mp.people.stats.people, 2, 'the smith and the boy');
  const kit = mp.kits.get('weapons_ws|1');
  b.stock.iron = 100;
  b.stock.weapons = 200;
  frame();
  assert.ok(drawn('weapons_ws:in:2') >= 1 && drawn('weapons_ws:out:3') >= 1 && drawn('weapons_ws:in:3') === 0, 'the iron at two thirds and the weapons full: each its own kit');
  b.stock.iron = 200;
  frame();
  assert.ok(drawn('weapons_ws:in:3') >= 1 && drawn('weapons_ws:in:2') === 0, 'the iron full');
  assert.equal(mp.kits.get('weapons_ws|1'), kit, 'the same kit through every step');
  b.efficiency = 0;
  frame();
  assert.ok(drawn('weapons_ws', 'shut') >= 1 && drawn('weapons_ws', 'open') === 0, 'idle: its boards across the front');
  assert.equal(drawn('sacra:smoke:thick'), 0, 'the forge is out');
  assert.equal(mp.people.stats.people, 0, 'nobody');
  assert.ok(drawn('weapons_ws:in:3') >= 1 && drawn('weapons_ws:out:3') >= 1, 'a closed shop still holds its stores');
  mp.dispose();
});
