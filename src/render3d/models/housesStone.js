/**
 * models/housesStone.js
 * ----------------------------------------------------------------------------
 * Three more of the 3D homes, between the cottage and the apartment house,
 * each on one 4 m tile with four looks (houses.js lists them):
 *
 *   Stone Cottage   level 6. A one-storey house of tufa: bare ashlar or
 *                   rubble in opus incertum, or plaster over a footing of
 *                   bare stone; a tiled gable with terracotta antefixes, a
 *                   vent in the gable for the loft, one shuttered window, a
 *                   studded door, a bench by it, once a vine on a trellis.
 *                   After the small tufa houses of Cosa and Ardea.
 *   Merchant House  level 8. A townhouse with a real shop: a wide mouth onto
 *                   the street with a masonry counter (as the tabernae of
 *                   Pompeii), the shutter boards stacked inside the jamb
 *                   (they shut it when the house stands empty), jars, cloth
 *                   and baskets on the counter, a sign, the family's rooms
 *                   above behind a timber balcony or under a pergola, red
 *                   dado on plastered walls, a tiled roof with a clay smoke
 *                   vent on the ridge.
 *   Domus           level 9. The atrium house of the 4th and 3rd centuries
 *                   BC, as the House of the Surgeon at Pompeii: a tall blank
 *                   front of limestone ashlar or plaster, a narrow door (the
 *                   fauces) between two small shops or two high slit windows,
 *                   a Tuscan atrium roof that falls inward from the outer
 *                   walls to the compluvium (Vitruvius VI.3) with the
 *                   impluvium basin showing below, and a small gable over the
 *                   door with a painted terracotta plaque at its apex.
 *
 * Republican, as the other homes: no bare brick faces, no chimney (the smoke
 * leaves by the roof), no glass. The shop boards shut by the house's state
 * ('shut' when empty); the kit has no time of day, so by day and night alike
 * the boards stand stacked and the shop is open while people live there.
 * Builders, lamps and people are put together by houses.js.
 * ----------------------------------------------------------------------------
 */

import { cyl } from './castra.js';
import { lin } from './rural.js';
import { pot } from './healing.js';
import { roofSlope } from './learning.js';
import { DYES } from '../people/actors.js';
import {
  Bag, box, WASH, TUFA, WOODS, CLOTH, shell, windowTrim, doorLeaf, doorFrame, balcony, ridgeRoof, slabBox,
} from './houseKit.js';
import { boards, counter, sign, sillPots, RIGHT } from './housesTall.js';

const OAK = lin(WOODS.oak);
/** Limestone ashlar, a cooler grey than tufa. */
const LIME_STONE = 0xcfc8b6;

/** The Stone Cottage's measures (metres): the tests, the lab and the people read them. */
export const STONE = Object.freeze({
  x0: -1.65, x1: 1.65, z0: -1.7, z1: 0.95, h: 3.1, door: Object.freeze({ w: 0.85, h: 1.85 }),
  doorX: Object.freeze([0.55, -0.5, 0.45, -0.45]),
  /** The window (sill y, w, h); its x is across the door from it. */
  win: Object.freeze({ y: 1.15, w: 0.62, h: 0.78 }),
});
/** The Merchant House's measures. */
export const MERCHANT = Object.freeze({
  x0: -1.75, x1: 1.75, z0: -1.65, z1: 1.35, lower: 2.35, upper: 1.85, floorY: 0.06,
  mouth: Object.freeze({ x: -0.5, w: 2.1, h: 2.0 }),
  stair: 1.15, counterZ: 0.78,
});
/** The Domus's measures. */
export const DOMUS = Object.freeze({
  x0: -1.75, x1: 1.75, z0: -1.75, z1: 1.45, h: 3.85, floorY: 0.06,
  door: Object.freeze({ w: 0.85, h: 1.95 }),
  /** The compluvium: its middle (x = 0, z), half sizes, and how far its rim stands under the eaves. */
  zc: -0.1, hx: 0.7, hz: 0.55, drop: 0.7,
  /** The small shops of looks 0 and 3: x of each middle, width, height. */
  shop: Object.freeze({ x: 1.12, w: 0.9, h: 1.75 }),
});

/** The bare stone footing under a plastered wall. */
const FOOT = lin(TUFA, 0.82);

// ---------------------------------------------------------------------------
// Stone Cottage
// ---------------------------------------------------------------------------

const STONE_LOOKS = [
  { key: 'plaster', wall: WASH.cream, foot: true, roof: 'gable-x', shut: WOODS.olive, extra: [] },
  { key: 'rubble', wall: TUFA, foot: false, roof: 'gable-z', shut: WOODS.oak, extra: [] },
  { key: 'plaster', wall: WASH.ochre, foot: true, roof: 'gable-x', shut: WOODS.brown, extra: ['trellis'] },
  { key: 'plaster', wall: WASH.white, foot: true, roof: 'gable-z', shut: WOODS.olive, extra: [], dado: WASH.red },
];

/** The window's x for a look: on the side the door leaves free. */
const stoneWinX = (v) => (STONE.doorX[v & 3] > 0 ? -0.8 : 0.8);

/** A stone cottage, its look `v` (0 to 3), at a level of detail. */
export function buildStoneCottage(v = 0, lod = 0) {
  const L = STONE_LOOKS[v & 3];
  const bag = new Bag(`stonecottage${v}`, lod, 1101 + v * 17);
  const { x0, x1, z0, z1, h, door, win } = STONE;
  const dx = STONE.doorX[v & 3];
  const wx = stoneWinX(v & 3);
  const wash = lin(L.wall);
  const col = lin(L.shut);
  // The trodden step before the door and the bench's ground.
  slabBox(bag, 'earth', -1.9, 1.9, z1 - 0.05, z1 + 0.95, 0.03, lin(0xa89574, 0.92));
  const puts = shell(bag, {
    x0, x1, z0, z1, h, t: 0.3, c: wash, k: L.key === 'rubble' ? 1.2 : 0.97, key: L.key,
    openings: {
      '+z': [{ x: dx, y: 0, w: door.w, h: door.h }, { x: wx, y: win.y, w: win.w, h: win.h }],
      '+x': [{ x: 0.2, y: 1.2, w: 0.45, h: 0.55 }],
    },
  });
  const front = puts['+z'];
  // A bare stone footing under the plaster, skipping the door.
  if (L.foot) {
    const fh = 0.5;
    const p = 0.05;
    const ds = [dx - door.w / 2, dx + door.w / 2];
    slabBox(bag, 'rubble', x0 - p, ds[0], z1 - 0.02, z1 + p, fh, FOOT);
    slabBox(bag, 'rubble', ds[1], x1 + p, z1 - 0.02, z1 + p, fh, FOOT);
    slabBox(bag, 'rubble', x0 - p, x0 + 0.02, z0 - p, z1, fh, FOOT);
    slabBox(bag, 'rubble', x1 - 0.02, x1 + p, z0 - p, z1, fh, FOOT);
    slabBox(bag, 'rubble', x0 - p, x1 + p, z0 - p, z0 + 0.02, fh, FOOT);
  }
  if (L.dado && lod < 2) {
    const ds = [dx - door.w / 2, dx + door.w / 2];
    for (const [a, b] of [[x0 + 0.05, ds[0]], [ds[1], x1 - 0.05]]) bag.add('plaster', front(box(b - a, 0.62, 0.014, (a + b) / 2, 0.5, 0.007, lin(L.dado))));
  }
  // The window and its shutters (open while lived in, shut when empty).
  windowTrim(bag, front, { x: wx, y: win.y, w: win.w, h: win.h }, { shutters: 'open', col });
  windowTrim(bag, puts['+x'], { x: 0.2, y: 1.2, w: 0.45, h: 0.55 }, { shutters: 'closed', col, sill: false });
  // The studded door: stone jambs, a leaf with rows of nail heads when shut, swung in when lived in.
  doorFrame(bag, front, { x: dx, w: door.w, h: door.h });
  doorLeaf(bag, front, { x: dx, w: door.w, h: door.h, col: lin(WOODS.oak), open: true });
  if (lod === 0) {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      bag.add('woodShut', front(box(0.05, 0.05, 0.02, dx - 0.25 + c * 0.25, 0.3 + r * 0.42, 0.014, lin(0x2a2420))));
    }
    // The doorstep.
    bag.add('rubble', front(box(door.w + 0.3, 0.1, 0.32, dx, 0, 0.16, lin(TUFA, 0.9))));
  }
  // A bench under the window, of oak on two stone ends.
  bag.add('wood', front(box(1.0, 0.07, 0.34, wx, 0.44, 0.24, lin(WOODS.oak, 0.85))));
  if (lod < 2) for (const s of [-1, 1]) bag.add('rubble', front(box(0.09, 0.44, 0.3, wx + s * 0.4, 0, 0.24, lin(TUFA, 0.9))));
  // The vine on its trellis: lattice and foliage over the door.
  if (L.extra.includes('trellis') && lod < 2) {
    for (const s of [-1, 1]) bag.add('wood', front(box(0.06, 2.2, 0.06, dx + s * 0.62, 0, 0.55, lin(WOODS.oak, 0.8))));
    bag.add('wood', front(box(1.4, 0.07, 0.07, dx, 2.2, 0.55, lin(WOODS.oak, 0.8))));
    if (lod === 0) for (const z of [0.18, 0.55]) bag.add('wood', front(box(1.2, 0.04, 0.04, dx, 2.2, z, lin(WOODS.oak, 0.8))));
    bag.add('leaf', front(box(1.3, 0.22, 0.5, dx, 2.2, 0.38, [0.05, 0.12, 0.03])), front(box(0.3, 1.4, 0.2, dx + (dx > 0 ? -0.62 : 0.62), 0.8, 0.55, [0.06, 0.11, 0.03])));
  }
  // The tiled gable (antefixes come with the tiles) and a vent in it for the loft.
  const roof = { x0, x1, z0, z1, eaveY: h, fill: wash.map((c) => c * 0.96) };
  if (L.roof === 'gable-x') {
    ridgeRoof(bag, { ...roof, along: 'x', rise: 0.75, over: 0.26 });
    if (lod < 2) bag.add('dark', puts['+x'](box(0.42, 0.2, 0.02, 0, h + 0.22, 0.01)));
  } else {
    ridgeRoof(bag, { ...roof, along: 'z', rise: 0.72, over: 0.2 });
    if (lod < 2) bag.add('dark', front(box(0.42, 0.2, 0.02, 0, h + 0.22, 0.01)));
  }
  return Object.assign(bag.build(), { doorX: dx });
}

// ---------------------------------------------------------------------------
// Merchant House
// ---------------------------------------------------------------------------

const MERCHANT_LOOKS = [
  { lower: WASH.lime, upper: WASH.ochre, dado: WASH.red, roof: 'gable-x', shut: WOODS.olive, top: 'balcony', ware: 'amph', basket: true, extra: 'sign' },
  { lower: WASH.cream, upper: WASH.white, dado: WASH.mud, roof: 'gable-z', shut: WOODS.oak, top: 'pergola', ware: 'cloth', basket: false, extra: 'sign' },
  { lower: WASH.white, upper: WASH.pink, dado: WASH.red, roof: 'gable-x', shut: WOODS.brown, top: 'balcony', ware: 'fruit', basket: true, extra: 'sign' },
  { lower: WASH.sand, upper: WASH.lime, dado: WASH.red, roof: 'hip', shut: WOODS.olive, top: 'pergola', ware: 'bread', basket: true, extra: 'sign' },
];

/** The gaps in a wall's dado: runs of x0..x1 not covered by the (lo, hi) openings. */
function runs(x0, x1, holes) {
  const out = [];
  let at = x0;
  for (const [a, b] of [...holes].sort((p, q) => p[0] - q[0])) {
    if (a > at) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (x1 > at) out.push([at, x1]);
  return out;
}

/** Planks stacked on end inside a shop mouth's jamb, as they stand by day. */
function stackedBoards(bag, put, x, w, h) {
  if (bag.lod > 0) return;
  for (let k = 0; k < 5; k++) bag.add('wood', put(box(0.2, h - 0.12, 0.035, x - w / 2 + 0.12 + k * 0.045, 0.01, -0.13 + k * 0.012, lin(WOODS.oak, 0.66 + 0.08 * ((k * 5) % 3)))));
}

/** A merchant house, its look `v` (0 to 3), at a level of detail. */
export function buildMerchant(v = 0, lod = 0) {
  const L = MERCHANT_LOOKS[v & 3];
  const bag = new Bag(`merchant${v}`, lod, 1201 + v * 19);
  const { x0, x1, z0, z1, lower, upper, floorY, mouth } = MERCHANT;
  const sg = RIGHT[v & 3];
  const mx = mouth.x * sg;
  const sx = MERCHANT.stair * sg;
  const top = lower + upper;
  const col = lin(L.shut);
  slabBox(bag, 'flags', x0, x1, z0 + 0.3, z1 + 0.04, floorY, lin(0xa89c86, 0.9));
  const low = shell(bag, {
    x0, x1, z0, z1, h: lower, t: 0.3, c: lin(L.lower), k: 0.97, key: 'plaster',
    openings: {
      '+z': [{ x: mx, y: 0, w: mouth.w, h: mouth.h }, { x: sx, y: 0, w: 0.8, h: 1.9 }],
      '+x': [{ x: 0.3, y: 1.3, w: 0.5, h: 0.6 }],
      '-x': [{ x: -0.3, y: 1.3, w: 0.5, h: 0.6 }],
    },
  });
  const front = low['+z'];
  doorFrame(bag, front, { x: mx, w: mouth.w, h: mouth.h });
  doorFrame(bag, front, { x: sx, w: 0.8, h: 1.9 });
  doorLeaf(bag, front, { x: sx, w: 0.8, h: 1.9, col: lin(WOODS.oak, 0.9), open: true });
  // The shop: boards across it when empty, stacked in the jamb while lived in; the masonry counter and its wares.
  boards(bag, front, mx, mouth.w, mouth.h);
  stackedBoards(bag, front, mx, mouth.w, mouth.h);
  counter(bag, front, mx, mouth.w, MERCHANT.counterZ - z1, L.ware, floorY);
  if (L.basket && lod < 2) {
    for (const [dx, r] of [[0.85, 0.2], [1.0, 0.16]]) bag.add('clay', front(cyl(r, r * 0.8, 0.26, lod ? 6 : 10, mx + dx, floorY + 0.96, MERCHANT.counterZ - z1, lin(0xb08850))));
    bag.add('clay', front(pot('amph', mx - 0.97, floorY + 0.96, MERCHANT.counterZ - z1 + 0.05, 0.5, lod, 0.9)));
  }
  // The red dado along the street front, between the openings.
  if (lod < 2) {
    for (const [a, b] of runs(x0 + 0.05, x1 - 0.05, [[mx - mouth.w / 2 - 0.1, mx + mouth.w / 2 + 0.1], [sx - 0.45, sx + 0.45]])) {
      if (b - a > 0.08) bag.add('plaster', front(box(b - a, 0.9, 0.014, (a + b) / 2, 0.06, 0.007, lin(L.dado))));
    }
  }
  // The family's rooms above: two windows, or the balcony's door and one.
  const wins = L.top === 'balcony'
    ? [{ x: mx, y: 0.05, w: 0.85, h: 1.6, door: true }, { x: sx, y: 0.4, w: 0.58, h: 0.9 }]
    : [{ x: mx - 0.55, y: 0.4, w: 0.56, h: 0.9 }, { x: mx + 0.55, y: 0.4, w: 0.56, h: 0.9 }, { x: sx, y: 0.4, w: 0.56, h: 0.9 }];
  const up = shell(bag, {
    x0, x1, z0, z1, y0: lower, h: upper, t: 0.3, c: lin(L.upper), k: 0.97, key: 'plaster',
    openings: { '+z': wins, '+x': [{ x: 0.1, y: 0.4, w: 0.55, h: 0.85 }], '-x': [{ x: -0.1, y: 0.4, w: 0.55, h: 0.85 }] },
  });
  const upFront = up['+z'];
  let k = 0;
  for (const w of wins) {
    if (w.door) {
      doorLeaf(bag, upFront, { x: w.x, y: lower + w.y, w: w.w, h: w.h, col: lin(WOODS.oak, 0.9), open: true });
      continue;
    }
    windowTrim(bag, upFront, { x: w.x, y: lower + w.y, w: w.w, h: w.h }, { shutters: 'open', col });
    if (L.top === 'pergola') sillPots(bag, upFront, w.x, lower + w.y - 0.2, w.w + 0.1, k);
    k++;
  }
  for (const s of ['+x', '-x']) windowTrim(bag, up[s], { x: s === '+x' ? 0.1 : -0.1, y: lower + 0.4, w: 0.55, h: 0.85 }, { shutters: 'closed', col, sill: false });
  if (lod < 2) bag.add('plaster', up['+z'](box(x1 - x0, 0.08, 0.06, 0, lower - 0.04, 0, lin(WASH.white, 0.97))));
  if (L.top === 'balcony') balcony(bag, upFront, { x: mx, w: 1.9, d: 0.5, y: lower, col: OAK });
  else {
    // A pergola on timber over the shop: two posts, a beam, rafters to the wall, a roof of reeds and vine.
    const px = [mx - mouth.w / 2 - 0.05, mx + mouth.w / 2 + 0.05];
    const y = 2.38;
    const d = 0.5;
    for (const x of px) bag.add('wood', front(box(0.09, y, 0.09, x, 0, d - 0.05, lin(WOODS.oak, 0.8))));
    bag.add('wood', front(box(mouth.w + 0.3, 0.1, 0.1, mx, y, d - 0.05, lin(WOODS.oak, 0.82))));
    if (lod < 2) {
      for (let r = 0; r < 5; r++) bag.add('wood', front(box(0.06, 0.07, d, mx - mouth.w / 2 + (mouth.w * r) / 4, y + 0.1, d / 2, lin(WOODS.oak, 0.75))));
      bag.add('leaf', front(box(mouth.w + 0.1, 0.1, d - 0.05, mx, y + 0.17, d / 2, [0.05, 0.12, 0.03])));
    }
  }
  if (L.extra === 'sign') sign(bag, front, mx + mouth.w / 2 + 0.17, 2.3, CLOTH.madder);
  // The roof, with a clay vent on the ridge for the hearth's smoke.
  const roof = { x0, x1, z0, z1, eaveY: top, fill: lin(L.upper, 0.96), over: 0.22 };
  let ridgeY;
  let vx = 0.5 * -sg;
  let vz = (z0 + z1) / 2;
  if (L.roof === 'gable-x') ridgeY = ridgeRoof(bag, { ...roof, along: 'x', rise: 0.75 }).ridgeY;
  else if (L.roof === 'gable-z') { ridgeY = ridgeRoof(bag, { ...roof, along: 'z', rise: 0.75, over: 0.18 }).ridgeY; vx = 0; vz = -0.3; } else ridgeY = ridgeRoof(bag, { ...roof, along: 'x', rise: 0.7, hip: true }).ridgeY;
  if (lod < 2) bag.add('clay', pot('jar', vx, ridgeY - 0.02, vz, 0.34, lod, 0.7));
  return Object.assign(bag.build(), { mouthX: mx, stairX: sx });
}

// ---------------------------------------------------------------------------
// Domus
// ---------------------------------------------------------------------------

const DOMUS_LOOKS = [
  { key: 'rubble', wall: TUFA, dado: null, shops: true, slits: false, shut: WOODS.oak },
  { key: 'plaster', wall: WASH.ochre, dado: WASH.red, shops: false, slits: true, shut: WOODS.olive },
  { key: 'rubble', wall: LIME_STONE, dado: null, shops: false, slits: true, shut: WOODS.brown },
  { key: 'plaster', wall: WASH.white, dado: WASH.red, shops: true, slits: false, shut: WOODS.olive },
];

/** A high slit window's x on a blank front, by side. */
const SLIT_X = [-1.0, 1.0];

/** The atrium roof: four slopes falling inward from the eaves to the compluvium's rim; returns nothing. */
function atriumRoof(bag, { x0, x1, z0, z1, eaveY, zc, hx, hz, drop }, over = 0.15) {
  const slopeOf = (run) => drop / run;
  // (The tiles ride 0.3 m above the wall tops (the slope falls 0.2 m across a wall's thickness), so the walls' flat tops do not show as a rim round the roof.)
  eaveY += 0.3;
  const yr = eaveY - drop;
  const X = x1 + over;
  const Zf = z1 + over;
  const Zb = z0 - over;
  // (An eave stands a little lower out past the wall: the slope carried on over the overhang.)
  const yeF = eaveY - slopeOf(z1 - (zc + hz)) * over;
  const yeB = eaveY - slopeOf(zc - hz - z0) * over;
  const yeS = eaveY - slopeOf(x1 - hx) * over;
  const slopes = [
    [[-X, yeF, Zf], [X, yeF, Zf], [hx, yr, zc + hz], [-hx, yr, zc + hz]],
    [[X, yeB, Zb], [-X, yeB, Zb], [-hx, yr, zc - hz], [hx, yr, zc - hz]],
    [[-X, yeS, Zb], [-X, yeS, Zf], [-hx, yr, zc + hz], [-hx, yr, zc - hz]],
    [[X, yeS, Zf], [X, yeS, Zb], [hx, yr, zc - hz], [hx, yr, zc + hz]],
  ];
  slopes.forEach((q, i) => {
    const r = roofSlope(q, { lod: bag.lod, seed: bag.seed + 41 + i });
    bag.add('tile', r.tile);
    bag.add('wood', r.wood);
  });
  // The timbers round the opening, and the basin below it with its water.
  if (bag.lod < 2) {
    bag.add('wood', box(2 * hx + 0.16, 0.12, 0.12, 0, yr - 0.03, zc + hz, lin(WOODS.oak, 0.75)), box(2 * hx + 0.16, 0.12, 0.12, 0, yr - 0.03, zc - hz, lin(WOODS.oak, 0.75)));
    bag.add('wood', box(0.12, 0.12, 2 * hz, -hx, yr - 0.03, zc, lin(WOODS.oak, 0.75)), box(0.12, 0.12, 2 * hz, hx, yr - 0.03, zc, lin(WOODS.oak, 0.75)));
    const bw = 1.0;
    const bd = 0.8;
    const rim = lin(LIME_STONE, 0.9);
    bag.add('rubble', box(bw, 0.16, 0.12, 0, DOMUS.floorY, zc + bd / 2, rim), box(bw, 0.16, 0.12, 0, DOMUS.floorY, zc - bd / 2, rim), box(0.12, 0.16, bd, -bw / 2, DOMUS.floorY, zc, rim), box(0.12, 0.16, bd, bw / 2, DOMUS.floorY, zc, rim));
    bag.add('paint', box(bw - 0.1, 0.02, bd - 0.1, 0, DOMUS.floorY + 0.12, zc, lin(0x4d7a8a, 0.9)));
  }
}

/** A domus, its look `v` (0 to 3), at a level of detail. */
export function buildDomus(v = 0, lod = 0) {
  const L = DOMUS_LOOKS[v & 3];
  const bag = new Bag(`domus${v}`, lod, 1301 + v * 23);
  const { x0, x1, z0, z1, h, door, floorY, zc, hx, hz, drop, shop } = DOMUS;
  const col = lin(L.shut);
  const wash = lin(L.wall);
  // The atrium's floor, seen through the compluvium.
  slabBox(bag, 'flags', x0, x1, z0 + 0.3, z1 + 0.04, floorY, lin(0xa89c86, 0.9));
  const openings = [{ x: 0, y: 0, w: door.w, h: door.h }];
  if (L.shops) for (const s of [-1, 1]) openings.push({ x: s * shop.x, y: 0, w: shop.w, h: shop.h });
  if (L.slits) for (const x of SLIT_X) openings.push({ x, y: 2.9, w: 0.3, h: 0.55 });
  // (The rubble texture is dark: lifted so a tufa front reads pale in the sun.)
  const puts = shell(bag, { x0, x1, z0, z1, h, t: 0.3, c: wash, k: L.key === 'rubble' ? 1.25 : 0.97, key: L.key, openings: { '+z': openings, '+x': [{ x: 0, y: 2.8, w: 0.3, h: 0.5 }], '-x': [{ x: 0, y: 2.8, w: 0.3, h: 0.5 }] } });
  const front = puts['+z'];
  // The fauces: stone jambs, a narrow studded door.
  doorFrame(bag, front, { x: 0, w: door.w, h: door.h });
  doorLeaf(bag, front, { x: 0, w: door.w, h: door.h, col: lin(WOODS.oak), open: true });
  if (lod === 0) {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) bag.add('woodShut', front(box(0.05, 0.05, 0.02, -0.25 + c * 0.25, 0.3 + r * 0.45, 0.014, lin(0x2a2420))));
    bag.add('rubble', front(box(door.w + 0.3, 0.1, 0.3, 0, 0, 0.15, lin(LIME_STONE, 0.9))));
  }
  if (L.shops) {
    for (const s of [-1, 1]) {
      const x = s * shop.x;
      doorFrame(bag, front, { x, w: shop.w, h: shop.h });
      boards(bag, front, x, shop.w, shop.h);
      // A little masonry counter and a jar on it.
      bag.add('plaster', front(box(shop.w - 0.1, 0.85, 0.4, x, floorY, -0.12, lin(WASH.lime, 0.9))));
      if (lod === 0) bag.add('clay', front(pot('amph', x, floorY + 0.85, -0.12, 0.4, lod, 0.9)));
    }
  }
  if (L.slits) for (const x of SLIT_X) windowTrim(bag, front, { x, y: 2.9, w: 0.3, h: 0.55 }, { shutters: 'closed', col, sill: false });
  for (const s of ['+x', '-x']) windowTrim(bag, puts[s], { x: 0, y: 2.8, w: 0.3, h: 0.5 }, { shutters: 'closed', col, sill: false });
  // The red dado along the front.
  if (L.dado && lod < 2) {
    const holes = [[-door.w / 2 - 0.1, door.w / 2 + 0.1]];
    for (const [a, b] of runs(x0 + 0.05, x1 - 0.05, holes)) bag.add('plaster', front(box(b - a, 1.0, 0.014, (a + b) / 2, 0.06, 0.007, lin(L.dado))));
  }
  // The roofs: the atrium's, falling inward, and the little gable over the door with the plaque at its apex.
  atriumRoof(bag, { x0, x1, z0, z1, eaveY: h, zc, hx, hz, drop });
  const gx = 1.3;
  ridgeRoof(bag, { x0: -gx, x1: gx, z0: z1 - 0.7, z1, eaveY: h + 0.28, rise: 0.85, along: 'z', over: 0.1, gableOver: 0.1, fill: wash.map((c) => c * 0.96) });
  if (lod < 2) {
    // The painted terracotta plaque at the apex, a pale field in a dark frame.
    bag.add('clay', front(box(0.5, 0.4, 0.06, 0, h + 0.5, 0.0, lin(0xb8683f, 0.95))));
    bag.add('paint', front(box(0.36, 0.26, 0.02, 0, h + 0.57, 0.045, lin(0xe9ddbd))));
  }
  return Object.assign(bag.build(), { doorX: 0 });
}

/** The builders houses.js adds to its table, by kind. */
export const STONE_BUILDERS = Object.freeze({ stone: buildStoneCottage, merch: buildMerchant, domus: buildDomus });

/** The housing level each of these three draws. */
export const STONE_LEVELS = Object.freeze({ stone: 6, merch: 8, domus: 9 });

// ---------------------------------------------------------------------------
// People and lamps
// ---------------------------------------------------------------------------

const woman = (dress, extra) => ({ body: 'f', dress: ['tunic:long:stola', dress], hair: 'bun', ...extra });
const man = (extra) => ({ body: 'm', dress: ['tunic:knee'], hair: 'crop', ...extra });

/** The people of a stone cottage, merchant house or domus in its own metres (state 'open' only). */
export function stonePeople(kind, v) {
  const s = 600 + v * 7;
  if (kind === 'stone') {
    const dx = STONE.doorX[v & 3];
    const wx = stoneWinX(v & 3);
    return [
      woman('palla', { clip: 'sweep', props: { R: 'broom' }, at: [dx - Math.sign(dx) * 0.35, 0.03, STONE.z1 + 0.6], ry: 0.4, seed: s, colours: { tunic: DYES.saffron } }),
      man({ clip: 'sit', at: [wx, 0.03, STONE.z1 + 0.24], ry: 0.2, seed: s + 1, colours: { tunic: DYES.brownWool } }),
    ];
  }
  if (kind === 'merch') {
    const sg = RIGHT[v & 3];
    const mx = MERCHANT.mouth.x * sg;
    const list = [
      man({ clip: 'count', props: { R: 'coin' }, at: [mx, MERCHANT.floorY, MERCHANT.counterZ - 0.33], ry: 0, seed: s, colours: { tunic: DYES.madder } }),
      woman('palla', { clip: 'talk', at: [mx + 0.45, 0, MERCHANT.z1 + 0.55], ry: Math.PI + 0.4, seed: s + 1, colours: { tunic: DYES.oatmeal, mantle: DYES.woad } }),
    ];
    if (v === 0 || v === 2) list.push(woman('palla', { clip: 'idle', at: [mx, MERCHANT.lower + 0.07, MERCHANT.z1 + 0.22], ry: 0.2, seed: s + 2, colours: { tunic: DYES.white } }));
    return list;
  }
  return [
    man({ clip: 'idle', at: [0.0, 0.03, DOMUS.z1 + 0.45], ry: Math.PI, seed: s, colours: { tunic: DYES.white } }),
    woman('palla', { clip: 'talk', at: [0.75, 0.03, DOMUS.z1 + 0.5], ry: Math.PI + 0.5, seed: s + 1, colours: { tunic: DYES.oatmeal, mantle: DYES.madder } }),
  ];
}

/** The windows a home of these kinds may light by look: [x, y, z, s] each. */
export function stoneLamps(kind, v) {
  if (kind === 'stone') return [[stoneWinX(v & 3), STONE.win.y + STONE.win.h / 2, STONE.z1 + 0.05, 1]];
  if (kind === 'merch') {
    const sg = RIGHT[v & 3];
    return [[MERCHANT.stair * sg, MERCHANT.lower + 0.85, MERCHANT.z1 + 0.05, 1], [MERCHANT.mouth.x * sg, 1.0, MERCHANT.z1 + 0.05, 1]];
  }
  return DOMUS_LOOKS[v & 3].slits ? SLIT_X.map((x) => [x, 3.17, DOMUS.z1 + 0.05, 1]) : [[0, 1.0, DOMUS.z1 + 0.04, 1]];
}
