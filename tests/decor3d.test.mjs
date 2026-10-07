/**
 * decor3d.test.mjs - the 3D gardens, statues, gardeners' yard and triumphal arch (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 *   - the six have models; a build ghost shows each as built (a garden's
 *     leaves solid, a statue tended, the yard at work, an arch along the
 *     road under it)
 *   - a garden's or a statue's look is tended or neglected from the same
 *     care step as its sprite (render/buildingArt.js artState)
 *   - a garden's season follows the month; its plot and turn vary by tile
 *   - gardens side by side join: no hedge between them, the runs carried
 *     on to the tile's edge, posts only at outer corners
 *   - the arch's passage lies along its road at every axis and turn
 *   - every look fits its footprint at every turn and level of detail, on
 *     the ground; each level lighter than the one before, within budget
 *   - the yard's states; the lamps (the yard while staffed, the grand
 *     statue's while tended)
 *   - the game's pass draws gardens as their `more` kits, shared
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Box3, Group, Matrix4, Raycaster, Vector3 } from 'three';
import { MODELS, hasModel, modelMatrix, modelLamps, partShows, modelFor } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { ModelPass } from '../src/render3d/modelPass.js';
import {
  decorState, NEGLECT_STEP, gardenMask, hedgeLayout, gardenPlot, statueDesign, archAxis, archKey, yardState, tileHash,
} from '../src/render3d/models/decor.js';
import { gardenSeason, DESIGNS } from '../src/render3d/models/hortus.js';
import { SIGNA } from '../src/render3d/models/signa.js';
import { artState } from '../src/render/buildingArt.js';
import { BUILDINGS } from '../src/data/buildings.js';

const TYPES = ['garden', 'statue_small', 'statue_medium', 'statue_large', 'gardener_yard', 'triumphal_arch'];

/** A small map the variants read: building and road layers, and the buildings. */
function fakeGame(w = 12, h = 12) {
  const n = w * h;
  const map = {
    w, h, building: new Uint16Array(n), road: new Uint8Array(n), desirability: new Float32Array(n),
    inBounds: (x, y) => x >= 0 && y >= 0 && x < w && y < h,
    idx: (x, y) => y * w + x,
    hasRoad(x, y) { return this.inBounds(x, y) && this.road[this.idx(x, y)] !== 0; },
  };
  const buildings = new Map();
  const add = (type, x, y, props = {}) => {
    const id = buildings.size + 1;
    const S = BUILDINGS[type].size;
    const b = { id, type, def: BUILDINGS[type], x, y, size: S, turn: 0, careStep: 0, efficiency: 1, ...props };
    buildings.set(id, b);
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) map.building[map.idx(x + dx, y + dy)] = id;
    return b;
  };
  return { map, buildings, add, walkers: new Map(), time: { month: 4 } };
}

test('decor3d: the six have models; a ghost shows each as built', () => {
  const game = fakeGame();
  for (let x = 0; x < 12; x++) game.map.road[game.map.idx(x, 5)] = 1;
  const ctx = { game, month: 6 };
  for (const t of TYPES) {
    assert.ok(hasModel(t), t);
    const ghost = { id: null, type: t, x: 2, y: 4, size: BUILDINGS[t].size, efficiency: 1, hasWater: false };
    const v = MODELS[t].variant(ghost, { snow: 0 }, ctx);
    assert.ok(v.key, t);
    if (t === 'garden') {
      // The ghost's leaves are solid (sprays would draw as squares in its tint), and it is tended.
      assert.match(v.more[0].key, /^garden:plot:[a-z]+:summer:tended:plain$/);
    }
    if (t.startsWith('statue')) assert.match(v.key, /:tended$/);
    if (t === 'gardener_yard') assert.equal(v.state, 'open');
    // A ghost over a road along x (its middle row on y 5): the arch along it.
    if (t === 'triumphal_arch') assert.equal(v.key, 'triumphal_arch:0');
  }
  // A ghost over a road along y.
  const g2 = fakeGame();
  for (let y = 0; y < 12; y++) g2.map.road[g2.map.idx(6, y)] = 1;
  assert.equal(MODELS.triumphal_arch.variant({ id: null, type: 'triumphal_arch', x: 5, y: 2, size: 3 }, { snow: 0 }, { game: g2 }).key, 'triumphal_arch:1');
});

test('decor3d: tended or neglected from the care step the sprite uses', () => {
  for (const type of ['garden', 'statue_small', 'statue_medium', 'statue_large']) {
    for (let step = 0; step <= 4; step++) {
      const b = { type, def: BUILDINGS[type], careStep: step, x: 3, y: 3, size: BUILDINGS[type].size };
      const sprite = artState(b);
      assert.equal(decorState(b), sprite === 1 ? 'worn' : 'tended', `${type} step ${step}`);
      assert.equal(decorState(b), step >= NEGLECT_STEP ? 'worn' : 'tended');
    }
  }
  // A statue's look changes with it; nothing else does.
  const b = { type: 'statue_medium', x: 4, y: 7, careStep: 0 };
  const tended = MODELS.statue_medium.variant(b, { snow: 0 }, null).key;
  b.careStep = 3;
  const worn = MODELS.statue_medium.variant(b, { snow: 0 }, null).key;
  assert.equal(tended.replace(':tended', ':worn'), worn);
});

test('decor3d: a garden\'s season follows the month; designs and turns vary by tile', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(gardenSeason),
    ['winter', 'winter', 'spring', 'spring', 'bloom', 'bloom', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']);
  assert.equal(gardenSeason(null), 'summer', 'seasons off: high summer');
  const game = fakeGame();
  const g = game.add('garden', 4, 4);
  const key = (month) => MODELS.garden.variant(g, { snow: 0 }, { game, month }).more[0].key;
  assert.match(key(0), /:winter:tended$/);
  assert.match(key(4), /:bloom:tended$/);
  g.careStep = 4;
  assert.match(key(9), /:autumn:worn$/);
  // A hard frost freezes a tended basin's water (only the designs that have water).
  g.careStep = 0;
  const frozen = MODELS.garden.variant(g, { snow: 3 }, { game, month: 0 }).more[0].key;
  assert.equal(frozen.endsWith(':ice'), ['labrum', 'pool'].includes(gardenPlot(g).design), frozen);
  // Over a row of tiles every design shows up, and more than one turn.
  const designs = new Set();
  const rots = new Set();
  for (let x = 0; x < 40; x++) {
    designs.add(gardenPlot({ x, y: 7 }).design);
    rots.add(gardenPlot({ x, y: 7 }).rot);
  }
  assert.equal(designs.size, DESIGNS.length);
  assert.ok(rots.size >= 3);
  // Statues too: a row of them is not one statue repeated.
  for (const [type, size] of [['statue_small', 'small'], ['statue_medium', 'medium'], ['statue_large', 'large']]) {
    const seen = new Set();
    for (let x = 0; x < 30; x++) seen.add(statueDesign({ type, x, y: 2 }));
    assert.equal(seen.size, SIGNA[size].length, type);
  }
  assert.notEqual(tileHash(3, 4), tileHash(4, 3));
});

test('decor3d: gardens side by side join their hedges', () => {
  const game = fakeGame();
  const a = game.add('garden', 2, 2);
  const lone = hedgeLayout(gardenMask(a, game));
  assert.deepEqual(lone.n, [4, 0, 4], 'alone: four runs, a post at each corner');
  const b = game.add('garden', 3, 2);
  const c = game.add('garden', 4, 2);
  // (Their own frames at turn 0: +x is the map's +x, +z its +y.)
  assert.equal(gardenMask(a, game), 0b0010, 'the first of a row: a garden on its +x');
  assert.equal(gardenMask(b, game), 0b1010, 'the middle: on +x and -x');
  const mid = hedgeLayout(gardenMask(b, game));
  assert.deepEqual(mid.n, [2, 4, 0], 'the middle: its two long runs, each carried on both ways, no posts');
  const end = hedgeLayout(gardenMask(a, game));
  assert.deepEqual(end.n, [3, 2, 2], 'an end: three runs, two carried on into the next, posts at its outer corners');
  // A turned garden reads its neighbours in its own frame.
  a.turn = 1;
  // (Turned a quarter, its own -z points along the map's +x.)
  assert.equal(gardenMask(a, game), 0b0100);
  // Another type beside it is no garden.
  const g2 = fakeGame();
  const d = g2.add('garden', 5, 5);
  g2.add('statue_small', 6, 5);
  assert.equal(gardenMask(d, g2), 0);
  // The stubs end at the tile's edge, on the run's line.
  const box = new Box3();
  const stub = modelFor('garden:stub:tended').build('garden:stub:tended', 0);
  stub.updateMatrixWorld(true);
  const s = new Box3().setFromObject(stub);
  for (let k = 0; k < mid.n[1]; k++) {
    const m = new Matrix4().fromArray(mid.stubs, k * 16);
    box.copy(s).applyMatrix4(m);
    const reach = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z));
    assert.ok(Math.abs(reach - 2) < 0.01, `stub ${k} reaches ${reach}`);
  }
});

/** Every look of a type (and its `more` kits by their matrices), at a level: Box3s in the building's metres. */
function looksOf(type, lod) {
  const out = [];
  const add = (key, mats = null) => {
    const g = modelFor(key).build(key, lod);
    g.updateMatrixWorld(true);
    const box = new Box3().setFromObject(g);
    if (box.isEmpty()) return;
    if (!mats) out.push({ key, box });
    else for (let k = 0; k < mats.length / 16; k++) out.push({ key, box: box.clone().applyMatrix4(new Matrix4().fromArray(mats, k * 16)) });
  };
  if (type === 'garden') {
    for (const d of DESIGNS) for (const s of ['winter', 'bloom', 'autumn']) for (const st of ['tended', 'worn']) add(`garden:plot:${d}:${s}:${st}`);
    for (const mask of [0, 0b1010, 0b1111, 0b0011]) {
      const h = hedgeLayout(mask);
      if (h.n[0]) add('garden:hedge:worn', h.runs);
      if (h.n[1]) add('garden:stub:worn', h.stubs);
      if (h.n[2]) add('garden:post:tended', h.posts);
    }
  } else if (type.startsWith('statue')) {
    const size = { statue_small: 'small', statue_medium: 'medium', statue_large: 'large' }[type];
    for (const d of SIGNA[size]) for (const st of ['tended', 'worn']) add(`${type}:${d}:${st}`);
  } else if (type === 'triumphal_arch') {
    add('triumphal_arch:0');
    add('triumphal_arch:1');
  } else add(type);
  return out;
}

test('decor3d: every look fits its footprint at every turn and level of detail, on the ground', () => {
  const e = 1e-3;
  for (const type of TYPES) {
    const S = BUILDINGS[type].size;
    for (let lod = 0; lod < 3; lod++) {
      for (const { key, box } of looksOf(type, lod)) {
        for (let T = 0; T < 4; T++) {
          const b = box.clone().applyMatrix4(modelMatrix(20, 9, S, T, 0));
          assert.ok(b.min.x >= 20 - e && b.max.x <= 20 + S + e && b.min.z >= 9 - e && b.max.z <= 9 + S + e, `${key} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
          assert.ok(b.min.y > -0.003, `${key} lod ${lod}: under the ground (${b.min.y})`);
          assert.ok(b.max.y < 3.6, `${key} lod ${lod}: ${b.max.y} tiles high`);
        }
      }
    }
  }
});

test('decor3d: each level of detail is lighter than the one before, and within budget', () => {
  const budget = {
    'garden:plot:pergola:autumn:worn': [20000, 4500, 1500],
    'garden:plot:sundial:bloom:tended': [20000, 4500, 1500],
    'garden:hedge:worn': [1600, 500, 120],
    'statue_small:victory:worn': [10000, 3000, 1500],
    'statue_small:herm:tended': [8000, 2000, 600],
    'statue_medium:augustus:worn': [26000, 8000, 3000],
    'statue_large:equestrian:worn': [36000, 12000, 4500],
    'statue_large:enthroned:worn': [36000, 12000, 4500],
    gardener_yard: [14000, 4000, 1500],
    'triumphal_arch:0': [80000, 26000, 9000],
  };
  for (const [key, b] of Object.entries(budget)) {
    const t = [0, 1, 2].map((l) => kitOf(modelFor(key).build(key, l)).triangles);
    assert.ok(t[0] > t[1] && t[1] > t[2], `${key}: ${t}`);
    t.forEach((n, l) => assert.ok(n < b[l], `${key} lod ${l}: ${n}`));
  }
});

/** Does a ray from `o` along `d` (in a look's own metres, at the passage's height) hit any of the look's meshes? */
function hits(group, o, d) {
  group.updateMatrixWorld(true);
  const ray = new Raycaster(o, d.normalize(), 0, 20);
  return ray.intersectObject(group, true).filter((h) => h.object.name !== 'paving' && h.object.name !== 'plinth').length > 0;
}

test('decor3d: the arch\'s passage runs along its road, at either axis and every turn', () => {
  for (const axis of [0, 1]) {
    for (let turn = 0; turn < 4; turn++) {
      const b = { type: 'triumphal_arch', x: 0, y: 0, size: 3, axis, turn };
      assert.equal(archAxis(b, null), axis);
      const key = archKey(b, null);
      const g = new Group();
      const look = modelFor(key).build(key, 0);
      // Stood on the map as the game stands it (turned by the building's turn; the view's at 0).
      look.applyMatrix4(new Matrix4().makeRotationY((-(turn & 3) * Math.PI) / 2));
      g.add(look);
      // In the world (x the map's x, z its y): a ray down the road through the bay is clear, one across it is not.
      const along = axis === 0 ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1);
      const across = axis === 0 ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
      const start = (v) => new Vector3(-v.x * 8, 2.2, -v.z * 8);
      assert.equal(hits(g, start(along), along.clone()), false, `axis ${axis} turn ${turn}: the road's way is open`);
      assert.equal(hits(g, start(across), across.clone()), true, `axis ${axis} turn ${turn}: across it, the piers`);
    }
  }
});

test('decor3d: the yard\'s states, and the lamps that light at night', () => {
  assert.equal(yardState({ efficiency: 0.4 }), 'open');
  assert.equal(yardState({ efficiency: 0 }), 'shut');
  const parts = [];
  MODELS.gardener_yard.build('gardener_yard', 0).traverse((o) => { if (o.isMesh) parts.push({ name: o.name, when: o.userData.when }); });
  const shownIn = (name, s) => parts.filter((p) => p.name.startsWith(name) && partShows(p.when, s, false)).length;
  assert.ok(shownIn('gardener-', 'open') >= 2 && shownIn('gardener-', 'shut') === 0, 'a gardener at work only while staffed');
  for (const n of ['gates', 'door', 'tools']) assert.ok(shownIn(n, 'open') === 1 && shownIn(n, 'shut') === 1, n);
  // The yard's lantern while staffed; the grand statue's lampstands while tended; the others none.
  const yard = { type: 'gardener_yard', size: 1, x: 0, y: 0, efficiency: 1 };
  assert.ok([0, 1, 2, 3].some((T) => modelLamps(yard, T).length));
  assert.deepEqual(modelLamps({ ...yard, efficiency: 0 }, 0), []);
  const grand = { type: 'statue_large', size: 3, x: 0, y: 0, careStep: 0 };
  for (let T = 0; T < 4; T++) {
    const pts = modelLamps(grand, T);
    assert.ok(pts.length >= 2, `turn ${T}`);
    for (const [u, v, z] of pts) assert.ok(u >= 0 && u <= 3 && v >= 0 && v <= 3 && z > 5, `${u} ${v} ${z}`);
  }
  assert.deepEqual(modelLamps({ ...grand, careStep: 4 }, 0), [], 'cold when neglected');
  assert.deepEqual(modelLamps({ type: 'garden', size: 1, careStep: 0 }, 0), []);
});

test('decor3d: the game\'s pass draws gardens as shared `more` kits', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const game = fakeGame();
  const row = [game.add('garden', 2, 2), game.add('garden', 3, 2), game.add('garden', 4, 2)];
  const r = { game, weather: {}, time: 0, seasonsOn: true };
  game.time.month = 6;
  const placed = row.map((b) => ({ b, T: 0, vx: b.x, vy: b.y, state: 0, snow: 0 }));
  mp.update(r, placed, 2);
  const count = (prefix) => [...mp.kits.values()].filter((k) => k.key.startsWith(prefix)).reduce((a, k) => a + Math.max(0, ...k.meshes.map((im) => im.count)), 0);
  assert.equal(count('garden:plot:'), 3, 'a plot each');
  assert.equal(count('garden:hedge:'), 3 + 2 + 3, 'runs: the ends three each, the middle two (no hedge where they join)');
  assert.equal(count('garden:post:'), 4, 'posts at the row\'s four outer corners');
  assert.equal(count('garden:stub:'), 2 + 4 + 2);
  const keysAt = () => [...mp.kits.values()].filter((k) => k.lod === 2).map((k) => k.key).sort().join();
  const kits = keysAt();
  mp.update(r, placed, 2);
  assert.equal(keysAt(), kits, 'no new looks frame to frame (only the levels either side, built ahead)');
  mp.dispose();
});
