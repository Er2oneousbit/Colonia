/**
 * houses3d.test.mjs - the 3D homes: tent, family tent, lean-to, hut, cottage, stone cottage, townhouse,
 * merchant house, domus, apartment house, tenement, insula, villa, garden villa, the four 3 x 3 villas, the two 4 x 4 palatia (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - which housing levels have a model, and which keep their sprite
 *   - a home's look is a stable hash of its id: the same after a reload, all
 *     looks used, each level and cell its own
 *   - every look of every level fits its footprint at every view turn and
 *     level of detail, standing on the ground
 *   - each level of detail is lighter than the one before; the far one is
 *     within the budget of a house in a city of hundreds
 *   - occupied or empty from the sim's pop; a block of four single-tile homes
 *     is a plot with four homes; the build ghost is a vacant lot
 *   - the shutters, doors and shop boards swap with the state, and every
 *     tagged part shows in some state
 *   - a few people, only near, only while lived in, inside the footprint
 *   - the lamps: only a lived-in home, a few windows by hash, on the front
 *   - a whole street of one level costs a few instanced draws, not one a house
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Group } from 'three';
import { MODELS, modelMatrix, modelLamps, partShows } from '../src/render3d/models.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import { HOUSE_LEVELS, CELLS, variantOf, houseKind, buildHouse, houseKeys, peopleOf } from '../src/render3d/models/houses.js';
import { VARIANTS } from '../src/render3d/models/houseKit.js';
import { HOUSE_TIERS } from '../src/data/housing.js';

const KINDS = Object.keys(HOUSE_LEVELS);
/** The four 3 x 3 villas (housesGrand.js) and their levels. */
const GRAND = ['villa', 'vmarble', 'mansion', 'palatium'];
const GRAND_TIERS = [15, 16, 17, 18];
/** The two 4 x 4 palatia (housesPalatia.js) and their levels. */
const PAL = ['grandpal', 'imperial'];
const PAL_TIERS = [19, 20];
/** A kit's footprint in tiles: the palatia 4, the great villas 3, the 2 x 2 homes, the tenement's roof and the plot 2, the rest 1. */
const tilesOf = (kind) => (PAL.includes(kind) ? 4 : GRAND.includes(kind) ? 3 : BIG.includes(kind) || kind === 'tenroof' || kind === 'plot' ? 2 : 1);
const home = (tier, extra = {}) => ({ id: 7, type: 'house', size: HOUSE_TIERS[tier].size, house: { tier, pop: 5 }, ...extra });
const triOf = (g) => {
  let n = 0;
  g.traverse((o) => { if (o.isMesh) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
  return n;
};
/** The 2 x 2 homes: the tenement, the insula, the town villa and the garden villa. */
const BIG = ['ten', 'ins', 'tvilla', 'gvilla'];
const NEAR = { peopleOn: true, people: { lod: 0 } };

test('houses3d: every level from the tent to the Imperial Palatium has a model', () => {
  const drawn = [];
  for (let tier = 0; tier < HOUSE_TIERS.length; tier++) {
    const b = home(tier);
    if (MODELS.house.fits(b)) drawn.push(tier);
  }
  assert.deepEqual(drawn, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], 'every level from the tent to the Imperial Palatium');
  assert.deepEqual(Object.values(HOUSE_LEVELS), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.deepEqual(KINDS.map((k) => HOUSE_TIERS[HOUSE_LEVELS[k]].name), ['Tent', 'Family Tent', 'Lean-to', 'Hut', 'Cottage', 'Stone Cottage', 'Townhouse', 'Merchant House', 'Domus', 'Apartment House', 'Tenement', 'Insula', 'Villa', 'Garden Villa', 'Peristyle Villa', 'Marble Villa', 'Mansion', 'Palatium', 'Grand Palatium', 'Imperial Palatium']);
  assert.equal(HOUSE_TIERS[11].size, 2);
  // A joined block of four single-tile homes is still drawn (as four); a lone tenement must be 2 x 2.
  assert.ok(MODELS.house.fits(home(5, { size: 2 })));
  assert.ok(!MODELS.house.fits(home(11, { size: 1 })));
  // The insula and the next two villas are 2 x 2 homes too, never a block of four singles.
  for (const t of [12, 13, 14]) {
    assert.equal(HOUSE_TIERS[t].size, 2);
    assert.ok(MODELS.house.fits(home(t)) && !MODELS.house.fits(home(t, { size: 1 })), `tier ${t}`);
  }
  // The great villas are 3 x 3 and nothing else: a smaller footprint (a villa that has not grown) keeps its sprite.
  for (const t of GRAND_TIERS) {
    assert.equal(HOUSE_TIERS[t].size, 3);
    assert.ok(MODELS.house.fits(home(t)));
    assert.ok(!MODELS.house.fits(home(t, { size: 2 })) && !MODELS.house.fits(home(t, { size: 4 })), `tier ${t}`);
  }
  // The two palatia are 4 x 4 and nothing else.
  for (const t of PAL_TIERS) {
    assert.equal(HOUSE_TIERS[t].size, 4);
    assert.ok(MODELS.house.fits(home(t)));
    for (const size of [1, 2, 3]) assert.ok(!MODELS.house.fits(home(t, { size })), `tier ${t} size ${size}`);
  }
  assert.ok(!MODELS.house.fits({ id: 1, type: 'house', size: 1 }), 'a building with no home record keeps its sprite');
});

test('houses3d: a home\'s look is a stable hash of its id, all looks used, each level and cell its own', () => {
  const level = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const seen = level.map(() => new Array(VARIANTS).fill(0));
  for (let id = 1; id <= 400; id++) {
    level.forEach((t, i) => {
      const v = variantOf(id, t);
      assert.equal(v, variantOf(id, t), 'the same every time (no random)');
      assert.ok(v >= 0 && v < VARIANTS);
      seen[i][v]++;
    });
  }
  for (const row of seen) for (const n of row) assert.ok(n > 400 * 0.15 && n < 400 * 0.35, `each look about a quarter of the homes: ${row}`);
  // A street of neighbours (ids in a row) is not one pattern: the runs of one look are short.
  let run = 1;
  let longest = 1;
  for (let id = 2; id <= 400; id++) {
    run = variantOf(id, 5) === variantOf(id - 1, 5) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  assert.ok(longest <= 8, `no long runs of one look: ${longest}`);
  // The four cells of a block differ for some ids, and a ghost (no id) shows look 0.
  assert.ok([...Array(40).keys()].some((id) => new Set(CELLS.map((_, c) => variantOf(id + 1, 5, c))).size > 1));
  assert.equal(variantOf(null, 5), 0);
});

test('houses3d: every look fits its footprint at every turn and level of detail, on the ground', () => {
  const e = 1e-6;
  for (const key of houseKeys()) {
    const [, kind] = key.split(':');
    const S = tilesOf(kind);
    for (let lod = 0; lod < 3; lod++) {
      const g = buildHouse(key, lod);
      g.updateMatrixWorld(true);
      const local = new Box3().setFromObject(g);
      for (let T = 0; T < 4; T++) {
        const b = local.clone().applyMatrix4(modelMatrix(20, 9, S, T, 0));
        assert.ok(b.min.x >= 20 - e && b.max.x <= 20 + S + e && b.min.z >= 9 - e && b.max.z <= 9 + S + e, `${key} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
        assert.ok(b.min.y > -0.003 && b.max.y < (BIG.includes(kind) ? 3.5 : 3.0), `${key} lod ${lod}: ${b.min.y} to ${b.max.y} tiles high`);
        // (A great villa's highest roof stands 7 to 9 m: 1.75 to 2.25 tiles.)
        if (GRAND.includes(kind) && lod === 0) assert.ok(b.max.y >= 1.74 && b.max.y <= 2.27, `${key}: ${b.max.y * 4} m to the highest roof`);
        // (The palatia's highest roof stands 9 to 11 m: the Grand Palatium's range, the Imperial one's belvedere.)
        if (PAL.includes(kind) && lod === 0) assert.ok(b.max.y >= 2.25 && b.max.y <= 2.75, `${key}: ${b.max.y * 4} m to the highest roof`);
      }
    }
  }
  // A block's homes: each cell's home inside its own quarter of the 2 x 2.
  for (const [cx, cz] of CELLS) {
    const g = buildHouse('house:cottage:2', 0);
    g.position.set(cx, 0, cz);
    g.updateMatrixWorld(true);
    const b = new Box3().setFromObject(g);
    assert.ok(Math.abs(b.min.x) <= 4 + e && Math.abs(b.max.x) <= 4 + e && Math.abs(b.min.z) <= 4 + e && Math.abs(b.max.z) <= 4 + e);
    assert.ok(Math.sign(cx) * (cx > 0 ? b.min.x : b.max.x) >= 0 - e, 'in its own half');
  }
});

test('houses3d: each level of detail is lighter than the one before; the far one is cheap enough for hundreds', () => {
  for (const key of houseKeys()) {
    const [, kind] = key.split(':');
    const t = [0, 1, 2].map((l) => triOf(buildHouse(key, l)));
    // (The lot and the plot are a few boxes at every level.)
    if (/lot|plot/.test(key)) assert.ok(t[2] <= t[0] && t[0] <= 260, `${key}: ${t}`);
    else assert.ok(t[0] > t[1] && t[1] > t[2], `${key}: ${t}`);
    // (The tenement's roof is a kit of its own; the insula and the 2 x 2 villas carry theirs, a little over the tenement's walls.)
    assert.ok(t[2] <= (kind === 'ten' ? 560 : PAL.includes(kind) ? 3200 : GRAND.includes(kind) ? 1700 : BIG.includes(kind) ? 700 : 320), `${key}: ${t[2]} triangles far out`);
    // (A great villa is 12 m of tiled roofs: the tenement's allowance and a half. A few stand in a city, not hundreds.)
    // (A palatium is 16 m of tiled roofs over two peristyles: a handful stand in a city.)
    assert.ok(t[0] < (PAL.includes(kind) ? 60000 : BIG.includes(kind) || GRAND.includes(kind) ? 30000 : 12000), `${key}: ${t[0]} triangles close up`);
  }
  // Each level is clearly richer than the one below at the middle level of detail (more to see in the facade).
  const mid = (kind) => [0, 1, 2, 3].reduce((s, v) => s + triOf(buildHouse(`house:${kind}:${v}`, 1)), 0) / 4;
  // (The cottage's yard walls and fig make it richer than the plain stone cottage, so the new kinds are checked among themselves.)
  assert.ok(mid('stone') < mid('domus') && mid('domus') < mid('merch'), 'the stone cottage, the domus and the merchant house climb');
  // The four great villas climb: the marble villa has the peristyle villa's plan and more, the mansion and the palatium more again.
  assert.ok(mid('villa') < mid('vmarble') && mid('vmarble') < mid('mansion'), 'the villas climb');
  assert.ok(mid('palatium') < mid('grandpal') && mid('grandpal') < mid('imperial'), 'the two palatia climb above the palatium');
  assert.ok(mid('villa') < mid('palatium') && mid('ten') < mid('villa'), 'the palatium is richer than the first great villa, which is richer than the tenement');
  assert.ok(mid('hut') < mid('cottage') + 1 && mid('cottage') < mid('town') && mid('town') < mid('apt') && mid('apt') < mid('ten') && mid('ten') < mid('ins'), 'richer up the ladder');
});

test('houses3d: occupied or empty from the sim, a block as a plot of four homes, the ghost a vacant lot', () => {
  const v = (b, ctx = null) => MODELS.house.variant(b, { snow: 0 }, ctx);
  const full = v(home(5));
  assert.equal(full.state, 'open');
  assert.match(full.key, /^house:cottage:[0-3]$/);
  assert.equal(v(home(5, { house: { tier: 5, pop: 0 } })).state, 'shut');
  assert.equal(v(home(5)).key, v(home(5)).key, 'the same home, the same look');
  assert.notEqual(new Set([...Array(60).keys()].map((i) => v(home(5, { id: i + 1 })).key)).size, 1, 'a street of one level shows several looks');
  // A block: a plot and four homes, in `more`, n summing to four, their matrices at the cells.
  const block = v(home(7, { size: 2, id: 11 }));
  assert.equal(block.key, 'house:plot');
  assert.equal(block.more.reduce((n, m) => n + m.n, 0), 4);
  for (const m of block.more) {
    assert.match(m.key, /^house:town:[0-3]$/);
    for (let j = 0; j < m.n; j++) {
      const x = m.mats[j * 16 + 12];
      const z = m.mats[j * 16 + 14];
      assert.ok(CELLS.some(([cx, cz]) => cx === x && cz === z), `a cell: ${x}, ${z}`);
    }
  }
  assert.deepEqual(v(home(11)).more.map((m) => m.key), ['house:tenroof:0'], 'a tenement is one home, its roof a kit all four looks share');
  // The house tool's ghost has no home: a vacant lot.
  assert.equal(v({ id: null, type: 'house', size: 1, x: 3, y: 3 }).key, 'house:lot');
  assert.ok(buildHouse('house:lot', 0).children.length > 0);
});

test('houses3d: shutters, doors and shop boards swap with the state; every tagged part shows somewhere', () => {
  for (const key of houseKeys().filter((k) => /:(tent|ftent|lean|hut|cottage|stone|town|merch|domus|apt|ten|ins|tvilla|gvilla|villa|vmarble|mansion|palatium|grandpal|imperial):/.test(k))) {
    const g = buildHouse(key, 0);
    const whens = new Set();
    g.traverse((o) => { if (o.isMesh) whens.add(o.userData.when); });
    for (const when of whens) assert.ok(['always', 'open', 'shut'].includes(when) && ['open', 'shut'].some((s) => partShows(when, s, false)), `${key}: ${when}`);
    const shows = (state) => {
      const ids = [];
      g.traverse((o) => { if (o.isMesh && partShows(o.userData.when, state, false)) ids.push(o.uuid); });
      return ids.join();
    };
    assert.ok(shows('open') !== shows('shut'), `${key}: the two states differ`);
    assert.ok(whens.has('open') && whens.has('shut'), `${key}: both states have parts of their own`);
  }
  // A shop's boards shut only when empty; a lit home's door and shutters open.
  const g = buildHouse('house:town:0', 0);
  const names = (state) => { const out = []; g.traverse((o) => { if (o.isMesh && o.userData.when === state) out.push(o.name); }); return out; };
  assert.ok(names('shut').includes('wood') && names('open').includes('wood'));
});

test('houses3d: a few people only near, only while lived in, inside the footprint', () => {
  const v = (b, ctx) => MODELS.house.variant(b, { snow: 0 }, ctx);
  for (const tier of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
    const b = home(tier);
    assert.equal(v(b, null).actors, undefined, `${tier}: no people for a ghost or a test`);
    assert.equal(v(b, { peopleOn: true, people: { lod: 2 } }).actors, undefined, `${tier}: none from far`);
    assert.equal(v(b, { peopleOn: false, people: { lod: 0 } }).actors, undefined);
    assert.equal(v({ ...b, house: { tier, pop: 0 } }, NEAR).actors, undefined, `${tier}: nobody in an empty home`);
    const near = v(b, NEAR).actors;
    assert.ok(near && near.actors.length >= 1 && near.actors.length <= (PAL_TIERS.includes(tier) ? 6 : GRAND_TIERS.includes(tier) ? 5 : 4), `${tier}: a few people (${near && near.actors.length})`);
    assert.equal(v(b, { peopleOn: true, people: { lod: 1 } }).actors, near, 'the same cast, packed once');
    // About half of a home's people are out, a different few by its id: not the same two at every door.
    const sizes = new Set([...Array(30).keys()].map((i) => v(home(tier, { id: i + 1 }), NEAR).actors.actors.length));
    assert.ok(sizes.size >= 2 || tier === 4 || tier === 5, `${tier}: ${[...sizes]}`);
  }
  // A block: each of its four homes has its people, in its own cell.
  assert.ok(v(home(5, { size: 2, id: 3 }), NEAR).actors.actors.length >= 2);
  for (const kind of KINDS) {
    const S = 2 * tilesOf(kind);
    for (let var1 = 0; var1 < VARIANTS; var1++) {
      for (const a of peopleOf(kind, var1)) {
        assert.ok(Math.abs(a.at[0]) < S + 0.05 && Math.abs(a.at[2]) < S + 0.05, `${kind} ${var1}: a person at ${a.at}`);
        assert.ok(a.at[1] >= 0 && a.at[1] < 9, `${kind} ${var1}: height ${a.at[1]}`);
      }
    }
  }
});

const lit_ = (tier, id) => MODELS.house.lamps(home(tier, { id }));
test('houses3d: lamps only in a lived-in home, a window here and there by hash, on the front', () => {
  const lit = (b) => MODELS.house.lamps(b);
  assert.deepEqual(lit(home(7, { house: { tier: 7, pop: 0 } })), []);
  assert.deepEqual(lit({ id: 3, type: 'house', size: 1 }), []);
  let some = 0;
  let all = 0;
  for (let id = 1; id <= 60; id++) {
    const b = home(10, { id });
    const l = lit(b);
    assert.deepEqual(l, lit(b), 'a stable choice');
    if (l.length) some++;
    all += l.length;
    for (const [x, y, z, s] of l) assert.ok(Math.abs(x) < 2 && y > 0.5 && y < 9 && z > 1 && z < 2 && s === 1, `${x}, ${y}, ${z}`);
    for (const T of [0, 1, 2, 3]) for (const [u, v] of modelLamps(b, T)) assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1);
  }
  assert.ok(some > 20 && some < 60 && all / 60 < 4, `a window here and there: ${some} of 60 homes, ${all / 60} each`);
  // The stone cottage, merchant house and domus light a front window or door, on their fronts, never an empty home's.
  for (const tier of [6, 8, 9]) {
    let lit = 0;
    for (let id = 1; id <= 40; id++) {
      const l = lit_(tier, id);
      lit += l.length;
      for (const [x, y, z] of l) assert.ok(Math.abs(x) < 2 && y > 0.5 && y < 5 && z > 0.8 && z < 2, `${tier}: ${x}, ${y}, ${z}`);
    }
    assert.ok(lit > 0, `tier ${tier} lights some windows`);
    assert.deepEqual(MODELS.house.lamps(home(tier, { house: { tier, pop: 0 } })), []);
  }
  // The villas light the door, a shop or a window of the front, inside their 12 m, only while lived in.
  for (const tier of GRAND_TIERS) {
    let n = 0;
    for (let id = 1; id <= 40; id++) {
      const l = lit_(tier, id);
      n += l.length;
      for (const [x, y, z] of l) assert.ok(Math.abs(x) < 6 && y > 0.8 && y < 8 && z > 3 && z < 6, `${tier}: ${x}, ${y}, ${z}`);
      for (const T of [0, 1, 2, 3]) for (const [u, v] of modelLamps(home(tier, { id }), T)) assert.ok(u >= 0 && u <= 3 && v >= 0 && v <= 3, `${tier}: ${u}, ${v}`);
    }
    assert.ok(n > 0, `tier ${tier} lights some windows`);
    assert.deepEqual(MODELS.house.lamps(home(tier, { house: { tier, pop: 0 } })), []);
  }
  // The palatia light the doors, a shop or a window of the front, inside their 16 m, only while lived in.
  for (const tier of PAL_TIERS) {
    let n = 0;
    for (let id = 1; id <= 40; id++) {
      const l = lit_(tier, id);
      n += l.length;
      for (const [x, y, z] of l) assert.ok(Math.abs(x) < 8 && y > 0.8 && y < 10 && z > 4 && z < 8, `${tier}: ${x}, ${y}, ${z}`);
      for (const T of [0, 1, 2, 3]) for (const [u, v] of modelLamps(home(tier, { id }), T)) assert.ok(u >= 0 && u <= 4 && v >= 0 && v <= 4, `${tier}: ${u}, ${v}`);
    }
    assert.ok(n > 0, `tier ${tier} lights some windows`);
    assert.deepEqual(MODELS.house.lamps(home(tier, { house: { tier, pop: 0 } })), []);
  }
  // Tenement and block lamps stay inside the footprint.
  for (const b of [home(11, { id: 5 }), home(12, { id: 5 }), home(13, { id: 5 }), home(14, { id: 5 }), home(14, { id: 8 }), home(4, { id: 6, size: 2 })]) for (const T of [0, 1, 2, 3]) for (const [u, v] of modelLamps(b, T)) assert.ok(u >= 0 && u <= 2 && v >= 0 && v <= 2, `${b.size}: ${u}, ${v}`);
});

test('houses3d: a street of one level costs a few instanced draws, not one a house', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const game = { walkers: new Map(), map: { desirability: [0], idx: () => 0 } };
  const r = { game, weather: {}, time: 0 };
  const street = (n) => {
    const placed = [];
    for (let i = 0; i < n; i++) {
      const tier = [4, 5, 7, 10][i % 4];
      placed.push({ b: home(tier, { id: i + 1, x: i, y: 0 }), T: i & 3, vx: i, vy: 0, state: tier, snow: 0 });
    }
    placed.push({ b: home(11, { id: 5000, x: 0, y: 5 }), T: 0, vx: 0, vy: 5, state: 11, snow: 0 });
    placed.push({ b: home(5, { id: 5001, size: 2, x: 9, y: 5 }), T: 0, vx: 9, vy: 5, state: 5, snow: 0 });
    assert.equal(mp.update(r, placed, 2), n + 2);
    let draws = 0;
    for (const k of mp.kits.values()) for (const im of k.meshes) if (im.userData.n > 0) draws++;
    return draws;
  };
  const few = street(120);
  const many = street(600);
  // 4 levels x 4 looks, the tenement, the plot, and each kit's parts: the draws follow the looks, not the homes.
  assert.ok(many <= few + 12 && many < 200, `${few} draws for 122 homes, ${many} for 602`);
  assert.ok(mp.kits.size <= 22, `${mp.kits.size} kits`);
  mp.dispose();
});

test('houses3d: no home shows bare brick or a chimney (the games are set in the Republic)', () => {
  // Bare brick-faced fronts are Ostia's, three centuries after 300 BC, and read as a modern
  // block; a Roman hearth had no chimney. Mud brick under plaster or thatch (the hut) is fine.
  for (const key of houseKeys()) {
    const g = buildHouse(key, 0);
    const names = [];
    g.traverse((o) => { if (o.isMesh) names.push(o.material?.name || ''); });
    assert.ok(!names.includes('brick'), `${key} uses the brick material`);
  }
});

test('houses3d: a gabled ridge off the middle of its house carries its ridge roll with it', () => {
  // (houseKit.js ridgeRoll once mirrored a ridge along z about z = 0: the villa's tablinum, on z 0.6 to 2.4, grew a roll on z -2.4 to -0.6 floating in the air.)
  const top = (key, above) => {
    const zs = [];
    buildHouse(key, 0).traverse((o) => {
      if (!o.isMesh || o.name !== 'roof') return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > above) zs.push(p.getZ(i));
    });
    return [Math.min(...zs), Math.max(...zs)];
  };
  const [a, b] = top('house:villa:0', 6.6);
  assert.ok(a > 0.4 && b < 2.7, `the tablinum's ridge lies over its hall: z ${a} to ${b}`);
  const [c, d] = top('house:palatium:0', 8.3);
  assert.ok(c > 0.6 && d < 3.9, `the nave's ridge lies over the nave: z ${c} to ${d}`);
});
