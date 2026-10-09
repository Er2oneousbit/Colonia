/**
 * models/housesTall.js
 * ----------------------------------------------------------------------------
 * The three town houses of the 3D homes, each with four looks:
 *
 *   Townhouse        a narrow two-storey house on one 4 m tile: a shop
 *                    (taberna) open to the street across a wide doorway with
 *                    the wooden boards that shut it, a stair door beside it,
 *                    the family's rooms above with a balcony (maenianum) or
 *                    windows with shutters, a tiled roof; after the narrow
 *                    houses of Herculaneum and Pompeii along the Via dell'
 *                    Abbondanza, whose shops opened onto the street and whose
 *                    upper rooms were lived in (the House of the Wooden
 *                    Partition's neighbours).
 *   Apartment House  a three-storey house on one tile in Ostia's manner:
 *                    brick-faced concrete with a stucco string course between
 *                    the storeys, a shop and a stair door below, windows
 *                    with wooden shutters, a balcony on brick corbels, a
 *                    low tiled roof (the Casa dei Dipinti, the houses of the
 *                    Via dei Balconi).
 *   Tenement         an Ostian insula on a 2 x 2 footprint (8 m): four storeys
 *                    of brick-faced concrete round a small light court, shops
 *                    along the street front, balconies on brick corbels,
 *                    windows rising in rows on the street and the court, a
 *                    stucco band, a tiled roof sloping outward from the
 *                    court's rim (the Garden Houses and the Casa di Diana).
 *
 * States: 'open' lived in (shutters back, doors open, people), 'shut' empty
 * (shutters closed, the shop boarded up).
 * ----------------------------------------------------------------------------
 */

import { cyl } from './castra.js';
import { lin } from './rural.js';
import { pot } from './healing.js';
import { artRng } from '../texgen.js';
import { roofSlope } from './learning.js';
import { merge } from '../shapes.js';
import {
  Bag, box, WASH, BRICK, WOODS, CLOTH, shell, wall, windowTrim, doorLeaf, doorFrame, balcony, awning, ridgeRoof, slabBox,
} from './houseKit.js';

/** Mirror a look left to right on odd variants: the stair door and the shop swap sides. */
const RIGHT = [1, -1, 1, -1];

/** The townhouse's measures (metres): the tests, the lab and the people read them. */
export const TOWNHOUSE = Object.freeze({
  x0: -1.72, x1: 1.72, z0: -1.62, z1: 1.35, lower: 2.6, upper: 1.9, floorY: 0.06,
  /** The shop's mouth: x of its middle (mirrored by RIGHT), width, height. */
  mouth: Object.freeze({ x: -0.35, w: 2.0, h: 2.1 }),
  /** The counter's middle (z) and the shopkeeper's place behind it. */
  counterZ: 0.73,
  stair: 1.1,
});

/** The apartment house's measures. */
export const APARTMENT = Object.freeze({
  x0: -1.72, x1: 1.72, z0: -1.68, z1: 1.5, floors: Object.freeze([2.4, 1.9, 1.7]), floorY: 0.06,
  mouth: Object.freeze({ x: -0.5, w: 1.9, h: 2.1 }),
  counterZ: 0.92,
  stair: 1.2,
});

/** The tenement's measures (an 8 m footprint). */
export const TENEMENT = Object.freeze({
  half: 3.62, court: 1.5, floors: Object.freeze([2.0, 1.6, 1.6, 1.6]), upperH: 1.6, floorY: 0.06,
  /** The street front's shops: x of each middle, width; and the stair door's x. */
  shops: Object.freeze([[-2.25, 1.5], [-0.55, 1.5], [1.15, 1.5]]),
  stair: 2.75,
  counterZ: 3.1,
  /** The court's rim and how much higher the roof's inner edge stands than the eaves. */
  rise: 0.3,
});

const OAK = lin(WOODS.oak);
const sum = (a) => a.reduce((s, v) => s + v, 0);

/** A shop's mouth boarded up: boards across in the wall's depth (shown only 'shut'; open, they stand stacked inside). */
function boards(bag, put, x, w, h) {
  const n = bag.lod === 2 ? 1 : Math.round(w / 0.25);
  for (let k = 0; k < n; k++) {
    const bw = w / n;
    bag.add('woodShut', put(box(bw - 0.012, h - 0.02, 0.045, x - w / 2 + bw * (k + 0.5), 0.01, -0.06, lin(WOODS.oak, 0.68 + 0.09 * ((k * 37) % 3)))));
  }
  if (bag.lod < 2) bag.add('woodShut', put(box(w + 0.1, 0.07, 0.05, x, h * 0.5, -0.02, lin(WOODS.oak, 0.6))));
}

/** A shop's masonry counter in its frame at local z, and its wares: kind 'amph', 'fruit', 'cloth', 'bread'. */
function counter(bag, put, x, w, z, kind, floorY) {
  const lod = bag.lod;
  const cw = Math.min(w - 0.3, 1.6);
  bag.add('plaster', put(box(cw, 0.9, 0.45, x, floorY, z, lin(WASH.lime, 0.9))));
  bag.add('stone', put(box(cw + 0.06, 0.06, 0.5, x, floorY + 0.9, z, 0.95)));
  if (lod === 2) return;
  const top = floorY + 0.96;
  if (kind === 'amph') {
    for (let k = 0; k < 3; k++) bag.add('clay', put(pot('amph', x - 0.5 + k * 0.5, top, z + 0.02, 0.5, lod, 0.9 + 0.05 * k)));
  } else if (kind === 'fruit') {
    for (let k = 0; k < 3; k++) {
      bag.add('clay', put(cyl(0.2, 0.15, 0.2, lod ? 6 : 10, x - 0.5 + k * 0.5, top, z, lin(0xb08850))));
      bag.add('paint', put(cyl(0.17, 0.05, 0.1, lod ? 6 : 8, x - 0.5 + k * 0.5, top + 0.2, z, [[0.55, 0.12, 0.05], [0.6, 0.3, 0.04], [0.15, 0.3, 0.05]][k])));
    }
  } else if (kind === 'cloth') {
    const cols = [CLOTH.madder, CLOTH.woad, CLOTH.weld, CLOTH.linen];
    for (let k = 0; k < 4; k++) {
      bag.add('paint', put(box(0.34, 0.1, 0.36, x - 0.55 + k * 0.37, top, z, lin(cols[k]))), put(box(0.32, 0.1, 0.34, x - 0.55 + k * 0.37, top + 0.1, z, lin(cols[(k + 2) % 4]))));
    }
  } else {
    for (let k = 0; k < 5; k++) bag.add('clay', put(cyl(0.16, 0.18, 0.07, lod ? 6 : 10, x - 0.55 + k * 0.28, top + (k % 2) * 0.07, z + (k % 2) * 0.05 - 0.05, lin(0xc89850, 0.9))));
  }
}

/** A brick chimney stack with a stone cap, its foot at (x, y, z), h tall. */
function chimney(bag, x, z, y, h = 1.4) {
  bag.add('brick', box(0.5, h, 0.5, x, y, z, lin(BRICK.dark, 0.9)));
  if (bag.lod < 2) bag.add('stone', box(0.62, 0.08, 0.62, x, y + h, z, 0.95));
}

/** A line of laundry across x0..x1 at y, on the wall's frame at local z: a rope and cloths hanging from it. */
function laundry(bag, put, x0, x1, y, z, seed) {
  if (bag.lod === 2) return;
  const rnd = artRng(seed);
  bag.add('wood', put(box(x1 - x0, 0.02, 0.02, (x0 + x1) / 2, y, z, lin(0x8a7a5a, 0.8))));
  const cols = [CLOTH.linen, CLOTH.madder, CLOTH.woad, CLOTH.linen, CLOTH.weld];
  let x = x0 + 0.15;
  let k = 0;
  while (x < x1 - 0.3) {
    const w = 0.25 + rnd() * 0.18;
    const d = 0.45 + rnd() * 0.35;
    bag.add('paint', put(box(w, d, 0.015, x + w / 2, y - d, z, lin(cols[k % cols.length], 0.95))));
    x += w + 0.08 + rnd() * 0.08;
    k++;
  }
}

/** Pots of herbs on a sill (a window box): `n` along the sill at x, y. */
function sillPots(bag, put, x, y, w, seed) {
  if (bag.lod === 2) return;
  bag.add('wood', put(box(w, 0.14, 0.2, x, y - 0.01, 0.14, lin(WOODS.oak, 0.8))));
  bag.add('leaf', put(box(w - 0.04, 0.12, 0.14, x, y + 0.13, 0.14, [0.05, 0.12, 0.03])));
  void seed;
}

/** A hanging shop sign: a bracket out of the wall at (x, y) and a painted board from it. */
function sign(bag, put, x, y, c) {
  if (bag.lod === 2) return;
  bag.add('wood', put(box(0.04, 0.04, 0.4, x, y, 0.2, lin(WOODS.oak, 0.7))));
  bag.add('paint', put(box(0.04, 0.4, 0.3, x, y - 0.44, 0.22, lin(c))));
  bag.add('wood', put(box(0.02, 0.2, 0.02, x, y - 0.2, 0.36, lin(WOODS.oak, 0.7))));
}

/** A string course of stucco: a band across a wall at y, `w` wide (x from the frame's origin), a little proud. */
function band(bag, put, x, w, y, h = 0.08) {
  if (bag.lod === 2) return;
  bag.add('plaster', put(box(w, h, 0.06, x, y, 0.0, lin(WASH.white, 0.97))));
}

// ---------------------------------------------------------------------------
// The townhouse
// ---------------------------------------------------------------------------

const TOWN_LOOKS = [
  { lower: 'plaster', lowerC: WASH.lime, upper: WASH.ochre, roof: 'gable-x', shut: WOODS.olive, balcony: true, ware: 'amph', extra: 'sign', shutters: 'open' },
  { lower: 'plaster', lowerC: WASH.red, upper: WASH.white, roof: 'hip', shut: WOODS.oak, balcony: false, ware: 'fruit', extra: 'awning', shutters: 'closed' },
  { lower: 'plaster', lowerC: WASH.cream, upper: WASH.pink, roof: 'gable-z', shut: WOODS.brown, balcony: true, ware: 'cloth', extra: 'laundry', shutters: 'open' },
  { lower: 'brick', lowerC: BRICK.yellow, upper: WASH.lime, roof: 'gable-x', shut: WOODS.olive, balcony: false, ware: 'bread', extra: 'chimney', shutters: 'open' },
];

/** A townhouse, its look `v` (0 to 3), at a level of detail. */
export function buildTownhouse(v = 0, lod = 0) {
  const L = TOWN_LOOKS[v & 3];
  const bag = new Bag(`townhouse${v}`, lod, 901 + v * 19);
  const { x0, x1, z0, z1, lower, upper, floorY, mouth } = TOWNHOUSE;
  const sg = RIGHT[v & 3];
  const mx = mouth.x * sg;
  const sx = TOWNHOUSE.stair * sg;
  const top = lower + upper;
  const col = lin(L.shut);
  // The shop's floor, a step up from the street.
  slabBox(bag, 'flags', x0, x1, z0 + 0.3, z1 + 0.04, floorY, lin(0xa89c86, 0.9));
  // The ground floor: the shop's mouth, the stair door, a window at the back of each side.
  const low = shell(bag, {
    x0, x1, z0, z1, h: lower, t: 0.3, c: lin(L.lowerC), k: 0.97, key: L.lower,
    openings: {
      '+z': [{ x: mx, y: 0, w: mouth.w, h: mouth.h }, { x: sx, y: 0, w: 0.85, h: 1.9 }],
      '+x': [{ x: 0.3, y: 1.3, w: 0.5, h: 0.6 }],
      '-x': [{ x: -0.3, y: 1.3, w: 0.5, h: 0.6 }],
    },
  });
  const front = low['+z'];
  doorFrame(bag, front, { x: mx, w: mouth.w, h: mouth.h });
  doorFrame(bag, front, { x: sx, w: 0.85, h: 1.9 });
  doorLeaf(bag, front, { x: sx, w: 0.85, h: 1.9, col: lin(WOODS.oak, 0.9), open: true });
  boards(bag, front, mx, mouth.w, mouth.h);
  counter(bag, front, mx, mouth.w, TOWNHOUSE.counterZ - z1, L.ware, floorY);
  // The living rooms: windows (or a balcony's door and a window) with their shutters.
  const wins = L.balcony
    ? [{ x: mx, y: 0.05, w: 0.85, h: 1.6, door: true }, { x: sx, y: 0.4, w: 0.58, h: 0.9 }]
    : [-0.95, 0.15, 1.15].map((x) => ({ x: x * sg, y: 0.4, w: 0.54, h: 0.9 }));
  const up = shell(bag, {
    x0, x1, z0, z1, y0: lower, h: upper, t: 0.3, c: lin(L.upper), k: 0.97, key: L.upperKey || 'plaster',
    openings: { '+z': wins, '+x': [{ x: 0.1, y: 0.4, w: 0.55, h: 0.85 }], '-x': [{ x: -0.1, y: 0.4, w: 0.55, h: 0.85 }], '-z': [{ x: 0.5, y: 0.4, w: 0.55, h: 0.85 }] },
  });
  const upFront = up['+z'];
  let k = 0;
  for (const w of wins) {
    if (w.door) {
      doorLeaf(bag, upFront, { x: w.x, y: lower + w.y, w: w.w, h: w.h, col: lin(WOODS.oak, 0.9), open: true });
      continue;
    }
    windowTrim(bag, upFront, { x: w.x, y: lower + w.y, w: w.w, h: w.h }, { shutters: L.shutters === 'closed' || k % 2 ? 'closed' : 'open', col });
    if (!L.balcony) sillPots(bag, upFront, w.x, lower + w.y - 0.2, w.w + 0.1, k);
    k++;
  }
  for (const s of ['+x', '-x', '-z']) windowTrim(bag, up[s], { x: s === '+x' ? 0.1 : s === '-x' ? -0.1 : 0.5, y: lower + 0.4, w: 0.55, h: 0.85 }, { shutters: 'closed', col, sill: false });
  band(bag, up['+z'], 0, x1 - x0, lower - 0.04);
  // The balcony, or what the look hangs on its front.
  if (L.balcony) balcony(bag, upFront, { x: mx, w: 1.9, d: 0.5, y: lower, col: OAK });
  if (L.extra === 'sign') sign(bag, front, mx + mouth.w / 2 + 0.15, 2.3, CLOTH.madder);
  if (L.extra === 'awning') awning(bag, front, { x: mx, w: mouth.w + 0.3, y: 2.3, d: 0.6, drop: 0.3, cols: [lin(CLOTH.madder), lin(CLOTH.linen)] });
  if (L.extra === 'laundry') laundry(bag, upFront, mx - 0.85, mx + 0.85, lower + 1.3, 0.42, 5);
  // The roof.
  const fill = lin(L.upper, 0.96);
  const roof = { x0, x1, z0, z1, eaveY: top, fill, over: 0.22 };
  if (L.roof === 'gable-x') ridgeRoof(bag, { ...roof, along: 'x', rise: 0.72 });
  else if (L.roof === 'gable-z') ridgeRoof(bag, { ...roof, along: 'z', rise: 0.72, over: 0.18 });
  else ridgeRoof(bag, { ...roof, along: 'x', rise: 0.68, hip: true });
  if (L.extra === 'chimney') chimney(bag, -1.0 * sg, -0.7, top - 0.1);
  return Object.assign(bag.build(), { mouthX: mx, stairX: sx });
}

// ---------------------------------------------------------------------------
// The apartment house
// ---------------------------------------------------------------------------

const APT_LOOKS = [
  { brick: BRICK.red, ground: 'brick', roof: 'gable-x', shut: WOODS.olive, balcony: 2, ware: 'amph', extra: 'sign', shutters: 'open' },
  { brick: WASH.cream, upperKey: 'plaster', ground: 'plaster', groundC: WASH.lime, roof: 'hip', shut: WOODS.oak, balcony: 3, ware: 'cloth', extra: 'laundry', shutters: 'closed' },
  { brick: WASH.ochre, upperKey: 'plaster', ground: 'plaster', groundC: WASH.sand, roof: 'gable-z', shut: WOODS.brown, balcony: 2, ware: 'fruit', extra: 'awning', shutters: 'open' },
  { brick: WASH.pink, upperKey: 'plaster', ground: 'brick', groundC: BRICK.red, roof: 'gable-x', shut: WOODS.olive, balcony: 0, ware: 'bread', extra: 'chimney', shutters: 'open' },
];

/** An apartment house, its look `v` (0 to 3), at a level of detail. */
export function buildApartment(v = 0, lod = 0) {
  const L = APT_LOOKS[v & 3];
  const bag = new Bag(`apartment${v}`, lod, 951 + v * 23);
  const { x0, x1, z0, z1, floors, floorY, mouth } = APARTMENT;
  const sg = RIGHT[v & 3];
  const mx = mouth.x * sg;
  const sx = APARTMENT.stair * sg;
  const f1 = floors[0];
  const top = sum(floors);
  const col = lin(L.shut);
  const brickC = lin(L.brick);
  slabBox(bag, 'flags', x0, x1, z0 + 0.3, z1 + 0.04, floorY, lin(0xa89c86, 0.9));
  const low = shell(bag, {
    x0, x1, z0, z1, h: f1, t: 0.32, c: L.groundC ? lin(L.groundC) : brickC, k: 0.97, key: L.ground,
    openings: {
      '+z': [{ x: mx, y: 0, w: mouth.w, h: mouth.h }, { x: sx, y: 0, w: 0.9, h: 1.95 }],
      '+x': [{ x: 0.5, y: 1.3, w: 0.5, h: 0.6 }],
      '-x': [{ x: -0.5, y: 1.3, w: 0.5, h: 0.6 }],
    },
  });
  const front = low['+z'];
  doorFrame(bag, front, { x: mx, w: mouth.w, h: mouth.h });
  doorFrame(bag, front, { x: sx, w: 0.9, h: 1.95 });
  doorLeaf(bag, front, { x: sx, w: 0.9, h: 1.95, col: lin(WOODS.oak, 0.9), open: true });
  boards(bag, front, mx, mouth.w, mouth.h);
  counter(bag, front, mx, mouth.w, APARTMENT.counterZ - z1, L.ware, floorY);
  // The upper storeys: three windows a floor on the front, two on the sides; a balcony floor has doors.
  const rows = [f1 + 0.4, f1 + floors[1] + 0.35];
  const xs = [-1.1, 0, 1.1].map((x) => x * sg);
  const front3 = [];
  for (let fl = 0; fl < 2; fl++) {
    for (const x of xs) {
      const door = L.balcony === fl + 2 && x === 0;
      front3.push({ x, y: door ? rows[fl] - 0.3 : rows[fl], w: door ? 0.9 : 0.56, h: door ? 1.5 : fl ? 0.85 : 0.95, door, fl });
    }
  }
  const sideWin = (fl) => [-0.9, 0.9].map((x) => ({ x, y: rows[fl], w: 0.5, h: fl ? 0.85 : 0.95 }));
  const up = shell(bag, {
    x0, x1, z0, z1, y0: f1, h: top - f1, t: 0.32, c: brickC, k: 0.97, key: L.upperKey || 'brick',
    openings: {
      '+z': front3.map((w) => ({ x: w.x, y: w.y - f1, w: w.w, h: w.h })),
      '+x': [...sideWin(0), ...sideWin(1)].map((w) => ({ ...w, y: w.y - f1 })),
      '-x': [...sideWin(0), ...sideWin(1)].map((w) => ({ ...w, y: w.y - f1 })),
      '-z': front3.map((w) => ({ x: w.x, y: w.y - f1, w: w.w, h: w.h })),
    },
  });
  const upFront = up['+z'];
  front3.forEach((w, i) => {
    if (w.door) doorLeaf(bag, upFront, { x: w.x, y: w.y, w: w.w, h: w.h, col: lin(WOODS.oak, 0.9), open: true });
    else {
      windowTrim(bag, upFront, { x: w.x, y: w.y, w: w.w, h: w.h }, { shutters: L.shutters === 'closed' || (i + v) % 3 === 0 ? 'closed' : 'open', col });
      if (!L.balcony && w.fl === 0) sillPots(bag, upFront, w.x, w.y - 0.2, w.w + 0.1, i);
    }
  });
  for (const s of ['+x', '-x']) for (const w of [...sideWin(0), ...sideWin(1)]) windowTrim(bag, up[s], { x: w.x, y: w.y, w: w.w, h: w.h }, { shutters: 'closed', col, sill: false });
  for (const w of front3) windowTrim(bag, up['-z'], { x: w.x, y: w.y, w: w.w, h: w.h }, { shutters: 'closed', col, sill: false });
  // The stucco string courses between the storeys and under the eaves, round the house.
  // One thin band at the first floor (a string course), not a stripe a storey.
  for (const y of [f1 - 0.04]) {
    band(bag, up['+z'], 0, x1 - x0 + 0.1, y);
    band(bag, up['-z'], 0, x1 - x0 + 0.1, y);
    band(bag, up['+x'], 0, z1 - z0 - 0.5, y);
    band(bag, up['-x'], 0, z1 - z0 - 0.5, y);
  }
  // The balcony on brick corbels (a floor's doors open onto it), laundry, sign, awning.
  if (L.balcony) balcony(bag, upFront, { x: 0, w: L.balcony === 2 ? 3.1 : 2.2, d: 0.45, y: L.balcony === 2 ? f1 : f1 + floors[1], corbels: true, col: OAK });
  if (L.extra === 'sign') sign(bag, front, mx + mouth.w / 2 + 0.15, 2.3, CLOTH.woad);
  if (L.extra === 'awning') awning(bag, front, { x: mx, w: mouth.w + 0.3, y: 2.35, d: 0.42, drop: 0.3, cols: [lin(CLOTH.woad), lin(CLOTH.linen)] });
  if (L.extra === 'laundry') laundry(bag, upFront, -1.2, 1.2, f1 + floors[1] + 1.3, 0.38, 11);
  const roof = { x0, x1, z0, z1, eaveY: top, over: 0.25, fill: brickC.map((c) => c * 0.96) };
  roof.over = 0.22;
  if (L.roof === 'gable-x') ridgeRoof(bag, { ...roof, along: 'x', rise: 0.62 });
  else if (L.roof === 'gable-z') ridgeRoof(bag, { ...roof, along: 'z', rise: 0.65, over: 0.18 });
  else ridgeRoof(bag, { ...roof, along: 'x', rise: 0.6, hip: true });
  if (L.extra === 'chimney') chimney(bag, 1.0 * sg, -0.8, top - 0.1);
  return Object.assign(bag.build(), { mouthX: mx, stairX: sx });
}

// ---------------------------------------------------------------------------
// The tenement
// ---------------------------------------------------------------------------

const TEN_LOOKS = [
  { brick: BRICK.red, key: 'brick', court: WASH.cream, shut: WOODS.olive, ware: ['amph', 'cloth', 'fruit'], shutters: 'open' },
  { brick: BRICK.yellow, key: 'brick', court: WASH.ochre, shut: WOODS.oak, ware: ['bread', 'amph', 'cloth'], shutters: 'closed' },
  { brick: WASH.ochre, key: 'plaster', court: WASH.white, shut: WOODS.brown, ware: ['fruit', 'bread', 'amph'], shutters: 'open' },
  { brick: WASH.pink, key: 'plaster', court: WASH.cream, shut: WOODS.olive, ware: ['cloth', 'fruit', 'bread'], shutters: 'open' },
];

/** The windows of a row on a wall: `xs` centres, each w x h at y (up from the row's floor). */
function windowRow(xs, y, w, h) {
  return xs.map((x) => ({ x, y, w, h }));
}

/** The street front's and the back's window centres, and the sides'. */
const FRONT_X = [-2.8, -1.4, 0, 1.4, 2.8];
const SIDE_X = [-2.4, -0.8, 0.8, 2.4];

/**
 * One upper storey of the tenement, built once at the floor (y 0 up the storey's height) as its own bag: the four
 * walls with their windows and shutters. The three upper storeys are the same, so the tenement copies this up its
 * height instead of building every window three times (a tenement was 30 to 50 ms to build, five times the frame's
 * building budget).
 */
function upperFloor(bag, L, col, v) {
  const { half: H, upperH } = TENEMENT;
  const fb = new Bag('floor', bag.lod, bag.seed + 5);
  // (Far out every other window, a little wider: the same rhythm in half the quads.)
  const far = bag.lod === 2;
  const FX = far ? [-2.1, 0, 2.1] : FRONT_X;
  const SX = far ? [-1.6, 1.6] : SIDE_X;
  const win = (xs, w) => windowRow(xs, 0.4, far ? w + 0.05 : w, 0.8);
  const puts = shell(fb, {
    x0: -H, x1: H, z0: -H, z1: H, h: upperH, t: 0.32, c: lin(L.brick), k: 0.97, key: L.key,
    openings: { '+z': win(FX, 0.52), '-z': win(FX, 0.52), '+x': win(SX, 0.5), '-x': win(SX, 0.5) },
  });
  const trim = (put, xs, w, tag) => xs.forEach((x, i) => {
    windowTrim(fb, put, { x, y: 0.4, w, h: 0.8 }, { shutters: tag === 'closed' || (i + v) % 3 === 0 ? 'closed' : 'open', col, sill: true });
  });
  trim(puts['+z'], FRONT_X, 0.52, L.shutters);
  trim(puts['-z'], FRONT_X, 0.52, 'closed');
  trim(puts['+x'], SIDE_X, 0.5, 'closed');
  trim(puts['-x'], SIDE_X, 0.5, 'closed');
  return fb;
}

/** A tenement (an insula), its look `v` (0 to 3), at a level of detail. */
export function buildTenement(v = 0, lod = 0) {
  const L = TEN_LOOKS[v & 3];
  const bag = new Bag(`tenement${v}`, lod, 991 + v * 29);
  const { half: H, court: C, floors, floorY, rise } = TENEMENT;
  const ys = floors.map((_, i) => sum(floors.slice(0, i)));
  const top = sum(floors);
  const yr = top + rise;
  const col = lin(L.shut);
  const brickC = lin(L.brick);
  const sg = RIGHT[v & 3];
  // The ground floor: three shops and the stair door on the street, a door and two windows on a side, windows at the back.
  const SH = 1.8;
  const shopOpen = TENEMENT.shops.map(([x, w]) => ({ x: x * sg, y: 0, w, h: SH }));
  const front = [...shopOpen, { x: TENEMENT.stair * sg, y: 0, w: 0.9, h: 1.75 }];
  const side = [...windowRow([-1.6, 1.6], 1.1, 0.5, 0.5), { x: 0, y: 0, w: 0.95, h: 1.75 }];
  const back = windowRow([-2.4, -0.8, 0.8, 2.4], 1.1, 0.5, 0.5);
  slabBox(bag, 'flags', -H, H, -H + 0.3, H + 0.04, floorY, lin(0xa89c86, 0.9));
  const out = shell(bag, {
    x0: -H, x1: H, z0: -H, z1: H, h: floors[0], t: 0.32, c: brickC, k: 0.97, key: L.key,
    openings: { '+z': front, '+x': side, '-x': side, '-z': back },
  });
  const fr = out['+z'];
  TENEMENT.shops.forEach(([x, w], i) => {
    doorFrame(bag, fr, { x: x * sg, w, h: SH });
    boards(bag, fr, x * sg, w, SH);
    counter(bag, fr, x * sg, w, TENEMENT.counterZ - H, L.ware[i], floorY);
  });
  doorFrame(bag, fr, { x: TENEMENT.stair * sg, w: 0.9, h: 1.75 });
  doorLeaf(bag, fr, { x: TENEMENT.stair * sg, w: 0.9, h: 1.75, col: lin(WOODS.oak, 0.9), open: true });
  // The three upper storeys: one built, copied up the height.
  // (Each part's pieces merged once first: three storeys of two hundred small boxes cloned are most of the build.)
  const fb = upperFloor(bag, L, col, v);
  const floor = Object.fromEntries(Object.entries(fb.o).filter(([, list]) => list.length).map(([key, list]) => [key, merge(list)]));
  for (let f = 1; f < floors.length; f++) {
    for (const [key, one] of Object.entries(floor)) (bag.o[key] ??= []).push(one.clone().translate(0, ys[f], 0));
  }
  // One stucco band round the building at the first floor.
  for (const s of ['+z', '-z']) band(bag, out[s], 0, 2 * H + 0.1, ys[1] - 0.04);
  for (const s of ['+x', '-x']) band(bag, out[s], 0, 2 * H - 0.6, ys[1] - 0.04);
  // Balconies on brick corbels over the street front: a long one on the second floor, a short one above.
  balcony(bag, fr, { x: -1.4 * sg, w: 2.9, d: 0.25, y: ys[1], corbels: true, col: OAK });
  balcony(bag, fr, { x: 1.4 * sg, w: 1.6, d: 0.25, y: ys[2], corbels: true, col: OAK });
  laundry(bag, fr, 0.7 * sg - 0.8, 0.7 * sg + 0.8, ys[3] + 0.4, 0.0, 17 + v);
  // The court: its four walls inside, rising to the roof's inner edge, with their own windows.
  const courtC = lin(L.court, 0.96);
  const cwin = (xs2) => {
    const o = [];
    for (let f = 0; f < 4; f++) for (const x of xs2) o.push({ x, y: ys[f] + (f ? 0.35 : 0.9), w: 0.5, h: f ? 0.8 : 0.6 });
    return o;
  };
  const courtWall = (s, plane, w, xs2) => wall(bag, s, plane, 0, { w, y0: 0, h: yr, t: 0.3, c: courtC, k: 0.95, open: cwin(xs2) });
  const cf = courtWall('-z', -C, 2 * C + 0.6, [-0.7, 0.7]);
  courtWall('+z', -C, 2 * C + 0.6, [-0.7, 0.7]);
  const cr = courtWall('-x', -C, 2 * C, [-0.5, 0.5]);
  courtWall('+x', -C, 2 * C, [-0.5, 0.5]);
  if (lod < 1) {
    // The court's shutters, a well-head and a line of washing across it (close up only).
    for (const put of [cf, cr]) for (const w of cwin(put === cf ? [-0.7, 0.7] : [-0.5, 0.5])) windowTrim(bag, put, { x: w.x, y: w.y, w: w.w, h: w.h }, { shutters: 'closed', col, sill: false });
    bag.add('stone', cyl(0.3, 0.32, 0.5, 12, 0, floorY, 0, 0.97));
    bag.add('dark', cyl(0.2, 0.2, 0.01, 12, 0, floorY + 0.5, 0, 1));
    bag.add('wood', box(2 * C - 0.2, 0.02, 0.02, 0, 3.0, 0.0, lin(0x8a7a5a, 0.8)));
    for (let k = 0; k < 4; k++) bag.add('paint', box(0.28, 0.55, 0.015, -1.1 + k * 0.55, 2.45, 0.0, lin([CLOTH.linen, CLOTH.madder, CLOTH.linen, CLOTH.woad][k], 0.95)));
  }
  // (The roof is its own kit, the same for every look: buildTenementRoof.)
  return Object.assign(bag.build(), { shopsX: TENEMENT.shops.map(([x]) => x * sg), stairX: TENEMENT.stair * sg });
}

/**
 * The tenement's roof, one kit for all four looks (models/houses.js adds it in `more`): four slopes rising from the
 * eaves to the court's rim, a hipped roof with a light well. It is a third of the tenement's build, and the looks
 * share it, so it is built once and the walls' kit is built apart from it, each within the frame's building budget.
 * Its rim stands under a small temple's apex (7.3 m): a temple's roof stays above every home.
 */
export function buildTenementRoof(lod = 0) {
  const bag = new Bag('tenroof', lod, 1051);
  const { half: H, court: C, floors, rise } = TENEMENT;
  const top = sum(floors);
  const yr = top + rise;
  const E = H + 0.25;
  const slope = rise / (H - C);
  const ye = top - 0.25 * slope;
  const quads = [
    [[-E, ye, E], [E, ye, E], [C, yr, C], [-C, yr, C]],
    [[E, ye, -E], [-E, ye, -E], [-C, yr, -C], [C, yr, -C]],
    [[E, ye, E], [E, ye, -E], [C, yr, -C], [C, yr, C]],
    [[-E, ye, -E], [-E, ye, E], [-C, yr, C], [-C, yr, -C]],
  ];
  quads.forEach((q, i) => {
    const r = roofSlope(q, { lod, seed: bag.seed + 41 + i });
    bag.add('tile', r.tile);
    bag.add('wood', r.wood);
  });
  return bag.build();
}

// ---------------------------------------------------------------------------
// Lamps: the windows a home may light at night (models.js modelLamps: [x, y, z, s], facing the street)
// ---------------------------------------------------------------------------

/** The townhouse's: its upper windows' middles on the front, and the lamp in its shop. */
export function townLamps(v) {
  const L = TOWN_LOOKS[v & 3];
  const sg = RIGHT[v & 3];
  const mx = TOWNHOUSE.mouth.x * sg;
  const y = TOWNHOUSE.lower + 0.8;
  const xs = L.balcony ? [mx, TOWNHOUSE.stair * sg] : [-0.95, 0.15, 1.15].map((x) => x * sg);
  return Object.freeze([...xs.map((x) => Object.freeze([x, y, TOWNHOUSE.z1 + 0.05, 1])), Object.freeze([mx, 1.5, TOWNHOUSE.z1 - 0.35, 1])]);
}

/** The apartment house's: three windows on each of its two upper floors, and the shop's lamp. */
export function apartmentLamps(v) {
  const sg = RIGHT[v & 3];
  const [f1, f2] = APARTMENT.floors;
  const out = [];
  for (const y of [f1 + 0.9, f1 + f2 + 0.75]) for (const x of [-1.1, 0, 1.1]) out.push(Object.freeze([x * sg, y, APARTMENT.z1 + 0.05, 1]));
  out.push(Object.freeze([APARTMENT.mouth.x * sg, 1.5, APARTMENT.z1 - 0.35, 1]));
  return Object.freeze(out);
}

/** The tenement's: five windows on each of three floors, and a lamp in each shop. */
export function tenementLamps(v) {
  const sg = RIGHT[v & 3];
  const [, f2, f3, f4] = TENEMENT.floors;
  const ys = [TENEMENT.floors[0] + 0.8, TENEMENT.floors[0] + f2 + 0.8, TENEMENT.floors[0] + f2 + f3 + 0.8];
  void f4;
  const out = [];
  for (const y of ys) for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) out.push(Object.freeze([x * sg, y, TENEMENT.half + 0.05, 1]));
  for (const [x] of TENEMENT.shops) out.push(Object.freeze([x * sg, 1.5, TENEMENT.half - 0.35, 1]));
  return Object.freeze(out);
}
