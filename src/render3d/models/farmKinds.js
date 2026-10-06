/**
 * models/farmKinds.js
 * ----------------------------------------------------------------------------
 * What each kind of farm has besides its farmhouse (farmstead.js): the
 * working things in its yard and on its field, by the field's step of the
 * year (farm.js reads it from the sim), as the agricultural writers and the
 * excavated farms show them:
 *
 *   wheat       the threshing floor (area): a round floor of beaten clay
 *               edged with stones (Columella and Varro: hard, level,
 *               open to the wind); a straw stack (meta) round a pole that
 *               is biggest just after the harvest and dwindles as the
 *               straw is used; sheaves stooked on the floor when the field
 *               is ripe; the grain heaped on it and the threshing sledge
 *               (tribulum, a board studded with flints) just after
 *   vegetables  the kitchen garden (hortus) behind a wattle fence; a well
 *               with a sweep (tolleno, Pliny's name for the counterweighted
 *               pole) and a stone channel taking the water along the beds;
 *               baskets of the crop when it is ready
 *   orchard     drying hurdles on trestles (figs and apple slices were
 *               dried for the winter); ladders in the trees and baskets
 *               under them at the harvest
 *   olive       an open shed over the trapetum, the olive mill Cato
 *               describes (a stone basin, two millstones on a beam turning
 *               about a pillar), jars (dolia) for the oil; cloths spread
 *               under the trees and ladders at the harvest (olives were
 *               beaten and picked onto cloths)
 *   vineyard    a treading vat (calcatorium) with the basin its must runs
 *               into, dolia sunk to their rims in the yard as at the Villa
 *               Regina at Boscoreale; baskets of grapes at the vintage
 *   flax        a retting pond (flax was soaked to free its fibres) with
 *               bundles weighted under the water just after the pulling,
 *               drying racks, stooks of pulled flax when it is ripe
 *   pig farm    a sty (hara) of rubble walls under a lean-to roof, its low
 *               doors to the pen, a stone trough, the pen's fence; the
 *               pigs themselves are livestock.js's
 *   horse ranch a stable block of three stalls, a hay stack, a stone
 *               water trough, the paddock's post-and-rail fence; the
 *               horses are livestock.js's
 *
 * `step` is the field's step (farm.js farmStep: 0 just harvested and sown,
 * 1 sprouting, 2 growing, 3 ripening, 4 ripe), `cond` 'n' (worked), 'r'
 * (resting for the winter: the tools put away) or 'i' (idle: no workers,
 * weeds coming in, things left lying).
 *
 * Metres, the farm's middle at the origin; the yard is FARMHOUSE.yard.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, BoxGeometry, IcosahedronGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry, merge } from '../shapes.js';
import { shallowWaterMaterial, stagnantMaterial } from '../materials.js';
import { artRng, smoothstep } from '../texgen.js';
import {
  Parts, blk, beam, post, railFence, wattleFence, sack, basket, heap, jar, cart, ladder, strawStack,
  weeds, houseShell, leanTo, gableRoof, lin, paint, D,
} from './rural.js';

/** Where the orchard's and the olive grove's trees stand (metres): where the 3D ground hoes round them. */
export const TREE_SPOTS = Object.freeze([0, 1, 2].flatMap((r) => [0, 1, 2].map((k) => Object.freeze([(1.2 + k * 0.62) * 4 - 6, (0.45 + r * 0.95) * 4 - 6]))));
/** The vine rows' middles along z, and their run along x (where the ground works the earth along each). */
export const VINE_ROWS = Object.freeze({ zs: Object.freeze([0, 1, 2, 3, 4, 5].map((r) => (0.3 + r * 0.48) * 4 - 6)), x0: -2.15, x1: 5.6 });
/** The pig pen (inside its fence, the ground's mud: the art's u 1 to S - 0.12, v 0.15 to S - 0.12), and where pigs roam in it. */
export const PEN = Object.freeze({ x0: -2.0, z0: -5.4, x1: 5.52, z1: 5.52, roam: Object.freeze([-1.5, -2.9, 5.1, 5.1]) });
/** The ranch's paddock, where its horses graze (two areas round the stable and its yard). */
export const PADDOCK = Object.freeze({ right: Object.freeze([-0.2, -4.9, 5.1, 5.0]), left: Object.freeze([-4.9, 0.6, -0.5, 5.0]) });

/** A straw sheaf: a bundle tied round its middle, the ears at the top; `flax`: the pulled stalks, roots and all. */
function sheaf(lod, seed, flax = false) {
  const h = flax ? 0.95 : 1.0;
  const seg = lod === 0 ? 10 : lod === 1 ? 6 : 4;
  const P = profileOf([[0, 0], [0.12, 0], [0.11, h * 0.3], [0.07, h * 0.42], [0.08, h * 0.5], [0.15, h * 0.8], [0.13, h * 0.95], [0, h]]);
  return revolve(P, { segments: seg, metres: 1, tint: (p) => (p.y > h * 0.7 ? (flax ? 0.8 : 1.15) : 0.85) });
}

/** A stook: sheaves leaning together in a ring, at (x, z). */
function stook(x, z, n, lod, seed, flax = false) {
  const rnd = artRng(seed);
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd() * 0.3;
    const g = sheaf(lod, seed + k, flax);
    g.rotateZ(0.22 + rnd() * 0.08);
    g.rotateY(-a);
    g.translate(x + Math.cos(a) * 0.17, 0, z + Math.sin(a) * 0.17);
    out.push(g);
  }
  return out;
}

/** A round floor of beaten clay edged with stones, its top at y 0.07. */
function threshingFloor(cx, cz, r, lod, seed, idle) {
  const seg = lod === 0 ? 40 : lod === 1 ? 20 : 12;
  const floor = new CylinderGeometry(r, r + 0.05, 0.07, seg, 1);
  floor.translate(cx, 0.035, cz);
  boxUV(floor);
  const earth = [tintGeometry(floor, (x, y, z) => {
    const d = Math.hypot(x - cx, z - cz) / r;
    // Swept pale in the middle, where the beasts trod round and round.
    return (y > 0.06 ? 1.12 - 0.22 * smoothstep(0.3, 1, d) : 0.7) * (idle ? 0.9 : 1);
  })];
  const stone = [];
  if (lod < 2) {
    const n = lod === 0 ? 30 : 16;
    const rnd = artRng(seed);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const w = (2 * Math.PI * r) / n - 0.03;
      const g = blk(lod, w, 0.12 + rnd() * 0.04, 0.2, { bevel: 0.04, seed: seed + k, wobble: 0.02, grime: 0.5, seg: 1, tone: 0.12 });
      g.rotateY(-a + Math.PI / 2);
      g.translate(cx + Math.cos(a) * (r + 0.08), 0, cz + Math.sin(a) * (r + 0.08));
      stone.push(g);
    }
  }
  return { earth, stone };
}

/** The threshing sledge (tribulum): a board with its front curled up, the flints under it. */
function tribulum(x, z, yaw, lod) {
  const g = blk(lod, 0.62, 0.06, 1.3, { bevel: 0.01, seed: 501, wobble: 0.004, grime: 0.3, seg: 1 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const zz = p.getZ(i);
    if (zz > 0.4) p.setY(i, p.getY(i) + (zz - 0.4) ** 2 * 0.9);
  }
  g.computeVertexNormals();
  g.rotateY(yaw);
  g.translate(x, 0.07, z);
  return g;
}

/** A heap of loose grain (and the chaff round it) on the floor at (x, z). */
function grainHeap(x, z, r, h, lod) {
  const seg = lod === 0 ? 20 : 10;
  const g = revolve(profileOf([[r * 1.25, 0], [r, h * 0.2], [r * 0.6, h * 0.7], [0, h]]), { segments: seg, metres: 0.5 });
  g.translate(x, 0.07, z);
  return paint(g, lin(0xc6a35a), (xx, y) => 0.85 + 0.2 * smoothstep(0, h, y - 0.07));
}

/** A wheat farm's yard. */
function wheat(p, lod, step, cond) {
  const idle = cond === 'i';
  const fl = threshingFloor(-4.0, 1.35, 1.55, lod, 600, idle);
  p.add('earth', fl.earth).add('stone', fl.stone);
  // The straw stack: big after the harvest, used up over the year; slumped and grey when nobody tends it.
  const size = [1.0, 0.95, 0.88, 0.8, 0.7][step];
  const st = strawStack(size, 1.2 + size * 1.4, 610 + step, lod, idle ? 0.6 : 0);
  for (const g of [...st.thatch, ...st.wood]) g.translate(-4.5, 0, 4.65);
  p.add('thatch', st.thatch).add('wood', st.wood);
  if (cond === 'n' && step === 0) {
    // Just threshed: the grain heaped on the floor, the sledge beside it, sacks filled.
    p.add('produce', grainHeap(-3.8, 1.2, 0.55, 0.32, lod));
    p.add('wood', tribulum(-4.6, 1.9, 0.6, lod));
    for (const [k, x, z] of [[0, -2.7, 3.2], [1, -2.6, 3.7], [2, -3.1, 3.5]]) {
      const s = sack(0.4, 0.6, 620 + k, lod);
      s.rotateY(k * 0.7);
      s.translate(x, 0, z);
      p.add('sack', s);
    }
  }
  if (cond === 'n' && step === 4) {
    // Reaping: sheaves stooked on the floor and by it.
    for (const [k, x, z] of [[0, -4.3, 1.0], [1, -3.5, 1.8], [2, -2.75, 4.6], [3, -2.8, 5.45]]) p.add('thatch', stook(x, z, lod === 2 ? 4 : 7, lod, 630 + k * 10));
  }
  if (idle) p.add('leaf', weeds(lod === 2 ? 5 : 14, -5.6, -2.3, -0.2, 5.6, 640, lod));
}

/** A small well-head of rough stone at (x, z), its water dark down the shaft. */
function wellHead(x, z, lod) {
  const seg = lod === 0 ? 24 : lod === 1 ? 12 : 8;
  const g = revolve(profileOf([[0.5, 0], [0.5, 0.7], [0.46, 0.74], [0.34, 0.74], [0.3, 0.7], [0.3, -0.2]]), { segments: seg, metres: 2.0, tint: (pp) => (Math.hypot(pp.x, pp.z) < 0.32 ? Math.max(0.1, smoothstep(-0.2, 0.7, pp.y)) : 0.75 + 0.25 * smoothstep(0, 0.5, pp.y)) });
  g.translate(x, 0, z);
  return g;
}

/**
 * The sweep (tolleno): a forked post, a long pole pivoting on it, a stone
 * lashed to its short end, the bucket on a rope from its long end over the
 * well at (wx, wz). Returns { wood, stone, rope, bronze }.
 */
function sweep(px, pz, wx, wz, lod) {
  const wood = [];
  const stone = [];
  const rope = [];
  const H = 2.0;
  wood.push(blk(lod, 0.16, H, 0.16, { bevel: 0.02, seed: 701, wobble: 0.006, grime: 0.4, seg: 1 }).translate(px, 0, pz));
  // The fork's two tines over the pivot.
  if (lod < 2) for (const s of [-1, 1]) wood.push(blk(lod, 0.06, 0.25, 0.05, { bevel: 0.01, seed: 702 + s, wobble: 0.003, grime: 0, seg: 1 }).translate(px, H - 0.05, pz + s * 0.07));
  // The pole: its long end raised over the well, its short end down with the stone.
  const dx = wx - px;
  const dz = wz - pz;
  const L = Math.hypot(dx, dz);
  const ux = dx / L;
  const uz = dz / L;
  const front = [wx + ux * 0.25, H + 0.75, wz + uz * 0.25];
  const back = [px - ux * 1.5, H - 0.55, pz - uz * 1.5];
  wood.push(beam(back, front, 0.075, 703, lod));
  const w = blk(lod, 0.38, 0.32, 0.34, { bevel: 0.08, seed: 704, wobble: 0.04, grime: 0.3, seg: 1 });
  w.translate(back[0] + ux * 0.15, back[1] - 0.3, back[2] + uz * 0.15);
  stone.push(w);
  // The rope and the bucket hanging over the well.
  const bucketY = 1.05;
  rope.push(beam([front[0], bucketY + 0.3, front[2]], front, 0.016, 705, 1));
  const b = revolve(profileOf([[0, 0], [0.13, 0], [0.16, 0.26], [0.15, 0.27], [0.12, 0.02], [0, 0.02]]), { segments: lod === 0 ? 14 : 8, metres: 0.6 });
  b.translate(front[0], bucketY, front[2]);
  wood.push(b);
  return { wood, stone, rope };
}

/** A stone-lined channel along a polyline of [x, z] points, water in it. Returns { stone, water }. */
function channel(points, lod) {
  const stone = [];
  const water = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    for (const s of [-1, 1]) {
      const kerb = blk(lod, 0.1, 0.1, len + 0.1, { bevel: 0.02, seed: 720 + i * 3 + s, wobble: 0.01, grime: 0.4, seg: 1, tone: 0.1 });
      kerb.translate(s * 0.12, 0, 0);
      kerb.rotateY(yaw);
      kerb.translate((ax + bx) / 2, 0, (az + bz) / 2);
      stone.push(kerb);
    }
    const wv = new BoxGeometry(0.15, 0.002, len + 0.05);
    wv.rotateY(yaw);
    wv.translate((ax + bx) / 2, 0.065, (az + bz) / 2);
    boxUV(wv);
    water.push(tintGeometry(wv));
  }
  return { stone, water };
}

/** Vegetables in baskets at (x, z): cabbages, onions, turnips, leeks by `kind`. */
const VEG = [
  { c: [0x5d8f3c, 0x6f9e48, 0x4f8034], r: 0.075, n: 6 }, // cabbages
  { c: [0x8a3a4a, 0xa4545a, 0xc8a070], r: 0.045, n: 14 }, // onions, red and brown
  { c: [0xe6dccc, 0xb57aa8, 0xd8c8b8], r: 0.05, n: 12 }, // turnips
  { c: [0xc75a2c, 0xd9a440, 0x8c4a6a], r: 0.045, n: 14 }, // carrots and beets
];
function vegBasket(p, x, z, kind, full, lod, seed) {
  const b = basket(0.25, 0.28, full, lod);
  b.wicker.translate(x, 0, z);
  p.add('wicker', b.wicker);
  if (full > 0 && b.fill) {
    const v = VEG[kind % VEG.length];
    const top = 0.28 * (0.35 + 0.65 * full);
    const h = heap(lod === 2 ? 2 : Math.round(v.n * full), 0.2, top - 0.02, v.r * (lod === 2 ? 1.6 : 1), v.c.map((c) => lin(c)), seed, lod);
    if (h) {
      h.translate(x, 0, z);
      p.add('produce', h);
    }
  }
}

/** A kitchen garden's yard and fence. */
function vegetables(p, lod, step, cond) {
  const idle = cond === 'i';
  const fence = wattleFence([[-1.95, -1.45], [-1.95, -5.85], [5.85, -5.85], [5.85, 5.85], [-1.95, 5.85], [-1.95, 4.9]], { seed: 740, lod });
  p.add('wicker', fence.wicker).add('wood', fence.wood);
  p.add('stone', wellHead(-2.85, 0.45, lod));
  const sw = sweep(-4.2, 0.45, -2.85, 0.45, lod);
  p.add('wood', sw.wood).add('stone', sw.stone).add('rope', sw.rope);
  const ch = channel([[-2.35, 0.45], [-1.75, 0.45], [-1.75, 4.6]], lod);
  p.add('stone', ch.stone);
  if (!idle && cond !== 'r') p.add('water', ch.water);
  if (cond === 'n' && step >= 3) {
    const spots = step === 4 ? [[-3.9, 2.4], [-3.3, 2.75], [-4.5, 2.95], [-3.8, 3.4], [-2.85, 3.3]] : [[-3.6, 2.6]];
    spots.forEach(([x, z], k) => vegBasket(p, x, z, k, step === 4 ? 1 : 0.5, lod, 750 + k));
  } else if (!idle) {
    // Empty baskets stacked, waiting.
    for (let k = 0; k < 3; k++) {
      const b = basket(0.25, 0.28, 0, lod);
      b.wicker.translate(-4.4, k * 0.2, 3.0);
      p.add('wicker', b.wicker);
    }
  }
  if (idle) {
    const b = basket(0.25, 0.28, 0, lod);
    b.wicker.rotateZ(1.7);
    b.wicker.translate(-3.6, 0.25, 2.9);
    p.add('wicker', b.wicker);
    p.add('leaf', weeds(lod === 2 ? 5 : 14, -5.6, -2.3, -0.2, 5.6, 760, lod));
  }
}

/** A trestle carrying a wicker drying hurdle at (x, z), along x, with fruit drying on it (`fruit`: colours) or bare. */
function dryingHurdle(p, x, z, fruit, lod, seed) {
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) p.add('wood', blk(lod, 0.06, 0.7, 0.06, { seed: seed + s * 3 + t, grime: 0.3 }).translate(x + s * 0.7, 0, z + t * 0.32));
  }
  const tray = blk(lod, 1.7, 0.05, 0.8, { bevel: 0.015, seed: seed + 9, wobble: 0.005, grime: 0, seg: 1 });
  tray.translate(x, 0.7, z);
  p.add('wicker', tray);
  if (fruit && lod < 2) {
    const rnd = artRng(seed);
    const items = [];
    for (let k = 0; k < (lod === 0 ? 46 : 18); k++) {
      const g = new IcosahedronGeometry(0.04, 0);
      g.scale(1, 0.5, 1);
      g.translate(x + (rnd() - 0.5) * 1.5, 0.77, z + (rnd() - 0.5) * 0.65);
      items.push(paint(g, lin(fruit[Math.floor(rnd() * fruit.length)])));
    }
    p.add('produce', merge(items));
  }
}

/** Fruit by row of the orchard (farm.js): apples, pears, figs. */
const FRUIT_COL = [[0xb8322a, 0xc9542c, 0xa62a24], [0xc9b84a, 0xb9a43c], [0x4b2a44, 0x5a3050]];

/** An orchard's yard; ladders and baskets among the trees at the harvest. */
function orchard(p, lod, step, cond) {
  const idle = cond === 'i';
  dryingHurdle(p, -4.0, 0.9, cond === 'n' && (step === 0 || step === 4) ? [0x6a3a48, 0x7a4a3a, 0xb07a4a] : null, lod, 800);
  dryingHurdle(p, -4.0, 2.5, cond === 'n' && step === 0 ? [0xc8a060, 0xb08850] : null, lod, 810);
  if (!idle) {
    for (let k = 0; k < 3; k++) {
      const b = basket(0.25, 0.28, 0, lod);
      b.wicker.translate(-4.6, k * 0.2, 4.6);
      p.add('wicker', b.wicker);
    }
  }
  if (cond === 'n' && step === 4) {
    // Ladders up into two trees, full baskets under three.
    for (const [k, ti] of [[0, 1], [1, 5]]) {
      const [tx, tz] = TREE_SPOTS[ti];
      const l = ladder(2.6, 0.3, 820 + k, lod);
      l.translate(0, 0, 0.75);
      l.rotateY(k ? 2.2 : -0.6);
      l.translate(tx, 0, tz);
      p.add('wood', l);
    }
    for (const [k, ti, dx, dz] of [[0, 0, 0.9, 0.6], [1, 4, -0.8, 0.9], [2, 8, 0.7, -0.9], [3, 2, -0.9, -0.5]]) {
      const [tx, tz] = TREE_SPOTS[ti];
      const b = basket(0.24, 0.26, 1, lod);
      b.wicker.translate(tx + dx, 0, tz + dz);
      p.add('wicker', b.wicker);
      const row = Math.floor(ti / 3);
      const h = heap(lod === 2 ? 2 : 10, 0.18, 0.24, row === 2 ? 0.04 : 0.05, FRUIT_COL[row].map((c) => lin(c)), 830 + k, lod);
      if (h) {
        h.translate(tx + dx, 0, tz + dz);
        p.add('produce', h);
      }
    }
  }
  if (idle) {
    const l = ladder(2.6, 0, 840, lod);
    l.rotateX(-Math.PI / 2 + 0.04);
    l.translate(-3.2, 0.03, 4.0);
    p.add('wood', l);
    p.add('leaf', weeds(lod === 2 ? 5 : 14, -5.6, -2.3, -0.2, 5.6, 850, lod));
  }
}

/** The trapetum: a stone basin on a round base, two millstones on a beam turning about a pillar, at (x, z). */
function trapetum(p, x, z, lod) {
  const seg = lod === 0 ? 32 : lod === 1 ? 16 : 10;
  const base = new CylinderGeometry(0.85, 0.9, 0.5, seg, 1);
  base.translate(x, 0.25, z);
  boxUV(base);
  p.add('wall', tintGeometry(base, (xx, y) => 0.7 + 0.3 * smoothstep(0, 0.5, y)));
  const basin = revolve(profileOf([[0.85, 0.5], [0.86, 0.82], [0.8, 0.86], [0.72, 0.84], [0.7, 0.62], [0.32, 0.6], [0.18, 0.62], [0, 0.62]]), { segments: seg, metres: 0.8, tint: (pp) => (Math.hypot(pp.x, pp.z) < 0.71 && pp.y < 0.8 ? 0.7 : 1) });
  basin.translate(x, 0, z);
  p.add('stone', basin);
  // The pillar (miliarium) and the millstones (orbes) on their beam.
  const pillar = new CylinderGeometry(0.12, 0.14, 0.55, lod ? 8 : 12, 1);
  pillar.translate(x, 0.88, z);
  boxUV(pillar);
  p.add('stone', tintGeometry(pillar));
  for (const s of [-1, 1]) {
    const orb = new CylinderGeometry(0.34, 0.34, 0.2, seg, 1);
    orb.rotateZ(Math.PI / 2);
    orb.translate(x + s * 0.4, 0.62 + 0.34, z);
    boxUV(orb);
    p.add('stone', tintGeometry(orb, () => 0.9));
  }
  p.add('wood', beam([x - 1.25, 0.96, z], [x + 1.25, 0.96, z], 0.08, 860, lod));
}

/** An olive grove's yard: the mill shed and the oil jars; cloths, ladders and baskets at the harvest. */
function olive(p, lod, step, cond) {
  const idle = cond === 'i';
  // The open shed over the mill: four posts and a tiled gable roof.
  const sx0 = -5.65;
  const sx1 = -2.4;
  // (The shed at the yard's far end over the oil jars; the mill in the open before the house, where
  // the camera sees it.)
  const sz0 = 3.15;
  const sz1 = 5.85;
  for (const [x, z] of [[sx0 + 0.15, sz0 + 0.15], [sx1 - 0.15, sz0 + 0.15], [sx0 + 0.15, sz1 - 0.15], [sx1 - 0.15, sz1 - 0.15]]) {
    const pst = post(x, z, 2.05, { seed: 870 + x * 3 + z, lod });
    p.add('wood', pst.wood).add('stone', pst.stone);
  }
  p.add('wood', beam([sx0 + 0.15, 2.05, sz0 + 0.15], [sx1 - 0.15, 2.05, sz0 + 0.15], 0.12, 875, lod));
  p.add('wood', beam([sx0 + 0.15, 2.05, sz1 - 0.15], [sx1 - 0.15, 2.05, sz1 - 0.15], 0.12, 876, lod));
  const roof = gableRoof({ x0: sx0 + 0.05, x1: sx1 - 0.05, z0: sz0 + 0.05, z1: sz1 - 0.05, eaveY: 2.17, pitch: D(24), along: 'x', lod, seed: 880, over: 0.15, gableOver: 0.12 });
  p.add('tile', roof.tile).add('wood', roof.wood);
  trapetum(p, -4.0, 1.35, lod);
  // Dolia for the oil under the shed, half sunk.
  for (const [k, x, z] of [[0, -5.0, 4.5], [1, -4.0, 4.6], [2, -3.0, 4.5]]) {
    const d = jar({ sunk: 0.45, lod, seed: 890 + k });
    d.translate(x, 0, z);
    p.add('clay', d);
  }
  if (cond === 'n' && step === 4) {
    // Cloths under three trees, ladders in two, baskets of olives.
    for (const [k, ti] of [[0, 0], [1, 4], [2, 7]]) {
      const [tx, tz] = TREE_SPOTS[ti];
      const g = new BoxGeometry(2.4, 0.01, 2.0, 6, 1, 5);
      const pos = g.attributes.position;
      const rnd = artRng(900 + k);
      for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + 0.012 + rnd() * 0.02);
      g.computeVertexNormals();
      g.rotateY(k * 0.5);
      g.translate(tx, 0, tz);
      boxUV(g);
      p.add('sack', tintGeometry(g, () => 1.08));
      const items = heap(lod === 2 ? 0 : lod === 0 ? 40 : 12, 0.9, 0.0, 0.03, [lin(0x2b2030), lin(0x4a5a2a), lin(0x3a2838)], 910 + k, lod, 0.8);
      if (items) {
        items.translate(tx, 0, tz);
        p.add('produce', items);
      }
    }
    for (const [k, ti] of [[0, 1], [1, 5]]) {
      const [tx, tz] = TREE_SPOTS[ti];
      const l = ladder(2.5, 0.3, 920 + k, lod);
      l.translate(0, 0, 0.75);
      l.rotateY(k ? 2.4 : -0.4);
      l.translate(tx, 0, tz);
      p.add('wood', l);
    }
    for (let k = 0; k < 3; k++) {
      const b = basket(0.24, 0.26, 1, lod);
      b.wicker.translate(-2.65, 0, 0.0 + k * 0.6);
      p.add('wicker', b.wicker);
      const h = heap(lod === 2 ? 2 : 16, 0.18, 0.24, 0.032, [lin(0x2b2030), lin(0x3a2838)], 930 + k, lod);
      if (h) {
        h.translate(-2.65, 0, 0.0 + k * 0.6);
        p.add('produce', h);
      }
    }
  }
  if (idle) p.add('leaf', weeds(lod === 2 ? 5 : 14, -5.6, -2.3, -0.2, 5.6, 940, lod));
}

/** A vineyard's yard: the treading vat and its basin, dolia sunk to their rims; grapes at the vintage. */
function vines(p, lod, step, cond) {
  const idle = cond === 'i';
  // The vat: low walls lined with cocciopesto (a reddish lime mortar), a spout to the basin in front.
  const x0 = -5.55;
  const x1 = -3.25;
  const z0 = 0.1;
  const z1 = 2.0;
  const H = 0.55;
  const T = 0.18;
  p.add('wall', blk(lod, x1 - x0, H, T, { seed: 960, grime: 0.4 }).translate((x0 + x1) / 2, 0, z0 + T / 2));
  p.add('wall', blk(lod, x1 - x0, H, T, { seed: 961, grime: 0.4 }).translate((x0 + x1) / 2, 0, z1 - T / 2));
  p.add('wall', blk(lod, T, H, z1 - z0 - 2 * T, { seed: 962, grime: 0.4 }).translate(x0 + T / 2, 0, (z0 + z1) / 2));
  p.add('wall', blk(lod, T, H, z1 - z0 - 2 * T, { seed: 963, grime: 0.4 }).translate(x1 - T / 2, 0, (z0 + z1) / 2));
  const floor = new BoxGeometry(x1 - x0 - 2 * T, 0.04, z1 - z0 - 2 * T);
  floor.translate((x0 + x1) / 2, 0.2, (z0 + z1) / 2);
  boxUV(floor);
  p.add('clay', tintGeometry(floor, () => 0.8));
  // The lip of each wall, of stone.
  if (lod < 2) {
    p.add('stone', blk(lod, x1 - x0 + 0.04, 0.06, T + 0.04, { seed: 964, grime: 0 }).translate((x0 + x1) / 2, H, z0 + T / 2));
    p.add('stone', blk(lod, x1 - x0 + 0.04, 0.06, T + 0.04, { seed: 965, grime: 0 }).translate((x0 + x1) / 2, H, z1 - T / 2));
  }
  // The basin the must runs into, sunk, and a spout of terracotta.
  const bx = -2.75;
  const bz = 1.05;
  const basin = revolve(profileOf([[0.42, 0], [0.42, 0.14], [0.36, 0.16], [0.32, 0.1], [0.3, -0.3]]), { segments: lod === 0 ? 20 : 10, metres: 1, tint: (pp) => (Math.hypot(pp.x, pp.z) < 0.33 ? 0.3 : 1) });
  basin.translate(bx, 0, bz);
  p.add('stone', basin);
  const spout = new CylinderGeometry(0.04, 0.05, 0.4, 6, 1, true);
  spout.rotateZ(Math.PI / 2);
  spout.translate(x1 + 0.12, 0.3, bz);
  boxUV(spout);
  p.add('clay', tintGeometry(spout));
  // Dolia sunk to their rims in two rows, their wooden lids on.
  for (let k = 0; k < 4; k++) {
    const x = -5.0 + (k % 2) * 1.35 + Math.floor(k / 2) * 0.6;
    const z = 3.4 + Math.floor(k / 2) * 1.35;
    const d = jar({ sunk: 0.98, lod, seed: 970 + k });
    d.translate(x, 0, z);
    p.add('clay', d);
    if (lod < 2) {
      const lid = new CylinderGeometry(0.31, 0.31, 0.05, lod ? 10 : 18, 1);
      lid.translate(x, 0.155, z);
      boxUV(lid);
      p.add('wood', tintGeometry(lid, () => 0.9));
    }
  }
  if (cond === 'n' && step === 4) {
    const spots = [[-3.0, 2.5], [-2.55, 3.1], [-2.5, -1.9], [-2.5, 2.15], [-3.6, 2.7]];
    spots.forEach(([x, z], k) => {
      const b = basket(0.25, 0.3, 1, lod);
      b.wicker.translate(x, 0, z);
      p.add('wicker', b.wicker);
      const h = heap(lod === 2 ? 2 : 18, 0.2, 0.27, 0.035, [lin(0x3c2147), lin(0x4a2a55), lin(0x2e1a36)], 980 + k, lod);
      if (h) {
        h.translate(x, 0, z);
        p.add('produce', h);
      }
    });
    // Grapes trodden in the vat.
    const must = new BoxGeometry(x1 - x0 - 2 * T - 0.04, 0.02, z1 - z0 - 2 * T - 0.04);
    must.translate((x0 + x1) / 2, 0.3, (z0 + z1) / 2);
    boxUV(must);
    p.add('produce', paint(must, lin(0x3a1a2c)));
  }
  if (idle) p.add('leaf', weeds(lod === 2 ? 5 : 14, -5.6, -2.3, -0.2, 5.6, 990, lod));
}

/** A flax farm's yard: the retting pond, the drying racks, stooks of pulled flax when it is ripe. */
function flax(p, lod, step, cond) {
  const idle = cond === 'i';
  const px = -4.0;
  const pz = 1.25;
  const w = 2.7;
  const d = 1.9;
  // The pond's stone edge, and its water (green and still when nobody keeps it).
  const rnd = artRng(1000);
  const edge = [];
  const n = lod === 0 ? 7 : 3;
  for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      const x = px + (ax + (bx - ax) * (t0 + t1) / 2) * w / 2;
      const z = pz + (az + (bz - az) * (t0 + t1) / 2) * d / 2;
      const along = ax === bx ? d : w;
      const g = blk(lod, ax === bx ? 0.22 : along / n - 0.02, 0.14 + rnd() * 0.04, ax === bx ? along / n - 0.02 : 0.22, { bevel: 0.04, seed: 1001 + edge.length, wobble: 0.02, grime: 0.5, seg: 1, tone: 0.1 });
      g.translate(x, 0, z);
      edge.push(g);
    }
  }
  p.add('stone', edge);
  const water = new BoxGeometry(w - 0.2, 0.002, d - 0.2);
  water.translate(px, 0.07, pz);
  boxUV(water);
  p.add(idle ? 'stagnant' : 'water', tintGeometry(water));
  if (cond === 'n' && step === 0) {
    // Bundles soaking, weighted down with stones.
    for (let k = 0; k < 6; k++) {
      const s = sheaf(lod, 1010 + k, true);
      s.rotateZ(Math.PI / 2);
      s.translate(px - 0.45, 0.02, pz - 0.6 + k * 0.24);
      p.add('thatch', s);
      if (k % 2 === 0) p.add('stone', blk(lod, 0.22, 0.12, 0.2, { bevel: 0.05, seed: 1020 + k, wobble: 0.02, grime: 0.3, seg: 1 }).translate(px, 0.1, pz - 0.6 + k * 0.24));
    }
  }
  // Two drying racks: A-frames with a ridge pole, bundles leaning on them after the retting.
  for (const [k, rz] of [[0, 3.75], [1, 5.0]]) {
    for (const ex of [-1.2, 1.2]) {
      p.add('wood', beam([px + ex, 0, rz - 0.45], [px + ex, 1.35, rz], 0.05, 1030 + k, lod));
      p.add('wood', beam([px + ex, 0, rz + 0.45], [px + ex, 1.35, rz], 0.05, 1031 + k, lod));
    }
    p.add('wood', beam([px - 1.3, 1.33, rz], [px + 1.3, 1.33, rz], 0.05, 1032 + k, lod));
    if (cond === 'n' && step <= 1) {
      const m = lod === 2 ? 3 : 8;
      for (let j = 0; j < m; j++) {
        for (const side of [-1, 1]) {
          const s = sheaf(lod, 1040 + j + k * 20, true);
          s.rotateX(side * 0.32);
          s.translate(px - 1.05 + (j * 2.1) / (m - 1), 0, rz + side * 0.42);
          p.add('thatch', s);
        }
      }
    }
  }
  if (cond === 'n' && step === 4) {
    [2.7, 3.75, 4.8, 5.55].forEach((z, k) => p.add('thatch', stook(-2.5, z, lod === 2 ? 4 : 6, lod, 1060 + k * 10, true)));
  }
  if (idle) p.add('leaf', weeds(lod === 2 ? 5 : 14, -5.6, -2.3, -0.2, 5.6, 1070, lod));
}

/** The pig farm: the sty, the trough, the pen's fence; in the yard the feed and the cart. */
function sty(p, lod, step, cond) {
  const idle = cond === 'i';
  const fence = railFence([[-2.0, 1.4], [-2.0, -5.4], [5.52, -5.4], [5.52, 5.52], [-2.0, 5.52], [-2.0, 2.6]], { h: 1.0, rails: [0.35, 0.75], seed: 1100, lod, every: 1.9 });
  p.add('wood', fence);
  // The gate, standing open against the fence.
  p.add('wood', beam([-1.9, 0.35, 2.6], [-0.8, 0.35, 3.0], 0.06, 1101, lod), beam([-1.9, 0.75, 2.6], [-0.8, 0.75, 3.0], 0.06, 1102, lod));
  // The sty: three rubble walls and a low front with two doorways, a lean-to roof falling to the back.
  const x0 = -1.85;
  const x1 = 1.65;
  const z0 = -5.35;
  const z1 = -3.45;
  const T = 0.3;
  const Hb = 1.35;
  const Hf = 1.6;
  const walls = [];
  walls.push(blk(lod, x1 - x0, Hb, T, { seed: 1110, grime: 0.5 }).translate((x0 + x1) / 2, 0, z0 + T / 2));
  // The side walls' tops slope with the roof, low at the back.
  for (const [k, x] of [[0, x0 + T / 2], [1, x1 - T / 2]]) {
    const g = blk(lod, T, Hf, z1 - z0 - T, { seed: 1111 + k, grime: 0.5 }).translate(x, 0, (z0 + z1 + T) / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > Hf * 0.7) pos.setY(i, y - (Hf - Hb) * (1 - (pos.getZ(i) - z0) / (z1 - z0)));
    }
    g.computeVertexNormals();
    walls.push(g);
  }
  // The front: piers between two low doorways.
  const doors = [[-0.85, 0.65], [0.75, 0.65]];
  let x = x0 + T;
  for (const [dc, dw] of doors) {
    walls.push(blk(lod, dc - dw / 2 - x, Hf, T, { seed: 1115 + x, grime: 0.5 }).translate((x + dc - dw / 2) / 2, 0, z1 - T / 2));
    walls.push(blk(lod, dw, Hf - 0.85, T, { seed: 1116 + x, grime: 0 }).translate(dc, 0.85, z1 - T / 2));
    x = dc + dw / 2;
  }
  walls.push(blk(lod, x1 - T - x, Hf, T, { seed: 1117, grime: 0.5 }).translate((x + x1 - T) / 2, 0, z1 - T / 2));
  p.add('wall', walls);
  p.add('dark', blk(1, x1 - x0 - 2 * T + 0.04, Hb - 0.05, z1 - z0 - 2 * T + 0.04, { seed: 1, grime: 0 }).translate((x0 + x1) / 2, 0, (z0 + z1) / 2));
  const roof = leanTo({ L: x1 - x0 + 0.3, span: z1 - z0 + 0.2, topY: Hf + 0.05, eaveY: Hb, lod, seed: 1120, over: 0.25 });
  // (Built leaning on a wall at z 0 falling to +z: turned to fall toward the back, -z.)
  for (const g of [...roof.tile, ...roof.wood]) {
    g.rotateY(Math.PI);
    g.translate((x0 + x1) / 2, 0, z1 + 0.1);
  }
  p.add('tile', roof.tile).add('wood', roof.wood);
  // The trough: a hollowed stone along the fence.
  const tr = blk(lod, 1.8, 0.34, 0.5, { bevel: 0.04, seed: 1130, wobble: 0.01, grime: 0.6, seg: 1 });
  tr.translate(3.3, 0, -4.85);
  p.add('stone', tr);
  if (lod < 2) {
    const slop = new BoxGeometry(1.6, 0.01, 0.32);
    slop.translate(3.3, 0.33, -4.85);
    boxUV(slop);
    p.add('produce', paint(slop, lin(idle ? 0x4a4a30 : 0x6a5a3a)));
  }
  // The yard: sacks of acorns and beans, a bedding stack, the cart.
  const st = strawStack(0.75, 1.6, 1140, lod, idle ? 0.6 : 0);
  for (const g of [...st.thatch, ...st.wood]) g.translate(-4.6, 0, 4.7);
  p.add('thatch', st.thatch).add('wood', st.wood);
  if (!idle) {
    for (const [k, x, z] of [[0, -4.9, 0.0], [1, -4.45, 0.1], [2, -4.7, 0.5]]) p.add('sack', sack(0.4, 0.58, 1150 + k, lod).rotateY(k).translate(x, 0, z));
    const c = cart(lod, 1160);
    for (const g of [...c.wood, ...c.iron]) g.translate(-3.3, 0, 2.0);
    p.add('wood', c.wood).add('iron', c.iron);
  } else {
    p.add('leaf', weeds(lod === 2 ? 6 : 18, -5.6, -2.3, -0.2, 5.6, 1170, lod));
  }
}

/** The horse ranch: the stable block, a hay stack, the water trough, the paddock's fence. */
function stable(p, lod, step, cond) {
  const idle = cond === 'i';
  const shell = houseShell({
    x0: -5.6, x1: -0.55, z0: -5.55, z1: -2.75, eaveY: 2.3, pitch: D(23), along: 'x', lod, seed: 1200, thick: 0.4,
    doors: [-4.75, -3.1, -1.45].map((x, k) => ({ side: '+z', at: x - (-3.075), w: 1.0, h: 1.75, shut: idle || k === 2 })),
    windows: [-4.3, -1.9].map((x) => ({ side: '-z', at: x - (-3.075), w: 0.5, h: 0.35, y: 1.6, shut: idle })),
  });
  p.addAll(shell);
  const fence = railFence([[0.0, -5.4], [5.52, -5.4], [5.52, 5.52], [-5.2, 5.52], [-5.2, 0.4]], { h: 1.3, rails: [0.55, 1.1], seed: 1210, lod, every: 2.1 });
  p.add('wood', fence);
  // The hay stack, and the trough of stone with its water.
  const st = strawStack(0.85, 2.1, 1220, lod, idle ? 0.6 : 0);
  for (const g of [...st.thatch, ...st.wood]) g.translate(-4.4, 0, -1.25);
  p.add('thatch', st.thatch).add('wood', st.wood);
  const tr = blk(lod, 2.0, 0.55, 0.62, { bevel: 0.04, seed: 1230, wobble: 0.01, grime: 0.6, seg: 1 });
  tr.translate(-1.5, 0, -1.6);
  p.add('stone', tr);
  const wv = new BoxGeometry(1.8, 0.002, 0.44);
  wv.translate(-1.5, 0.5, -1.6);
  boxUV(wv);
  p.add(idle ? 'stagnant' : 'water', tintGeometry(wv));
  if (idle) p.add('leaf', weeds(lod === 2 ? 6 : 18, -5.4, 5.2, -2.4, 5.2, 1240, lod));
}

const KINDS = { wheat, vegetables, orchard, olive, vines, flax, sty, stable };

/** Every kind of farm's dressing, by name (farm.js keys). */
export const DRESSINGS = Object.freeze(Object.keys(KINDS));

/**
 * A farm's dressing as a Group (Parts.build): `kind` one of DRESSINGS,
 * `step` 0..4, `cond` 'n', 'r' or 'i' (see the header).
 */
export function buildDressing(kind, { lod = 0, step = 0, cond = 'n' } = {}) {
  const p = new Parts();
  KINDS[kind](p, lod, Math.max(0, Math.min(4, step | 0)), cond);
  return p.build(`farm-${kind}`, { extra: { water: shallowWaterMaterial(), stagnant: stagnantMaterial() }, noShadow: ['water', 'stagnant'] });
}

