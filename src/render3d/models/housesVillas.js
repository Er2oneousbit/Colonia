/**
 * models/housesVillas.js
 * ----------------------------------------------------------------------------
 * The three richest 2 x 2 homes (8 m) of the 3D homes, each with four looks:
 *
 *   Insula        the tenement's richer neighbour: three storeys of plastered
 *                 rubble over a tufa footing and the plaster's red dado, shops with
 *                 counters along the street, balconies on timber beam ends or
 *                 (in one look) an outside timber stair wrapping the corner,
 *                 washing lines and pots on the sills, a light well open to
 *                 the sky, and a tiled roof in several pitches (the front
 *                 wing steepest) with terracotta smoke vents. After the
 *                 insulae of Herculaneum and the tall houses of Ostia's
 *                 early centuries, kept to the rubble-and-plaster of 300 BC.
 *   Villa         a town villa of a well-off family: a blank plastered street
 *                 front with a studded door between stucco pilasters and a
 *                 small barred porter's window, two storeys round a peristyle
 *                 court (Tuscan columns of stuccoed tufa, a cistern head), a
 *                 tiled roof that rises to the open compluvium over the
 *                 atrium, and a walled kitchen garden at the back with a fig.
 *                 After the House of the Surgeon and the atrium houses of
 *                 Pompeii's early Samnite town. Painted terracotta plaques
 *                 (antefixes) ride the eaves of the best look.
 *   Garden Villa  the villa with its garden made much of: the house along
 *                 one side (the back, or the left: the looks turn it), a
 *                 loggia of Tuscan columns on the garden side, and a walled
 *                 garden of box-edged beds, a fountain basin, a herm, a
 *                 sundial, a vine pergola on posts, cypresses and a garden
 *                 gate. After the gardens of the House of the Vettii and the
 *                 Villa of the Mysteries' terraces.
 *
 * The games are set in the Republic (from 300 BC): plaster over rubble and
 * tufa, no bare brick, no chimney (smoke leaves by the roof, by a vent here).
 *
 * States, as the tenement's: 'open' lived in (shutters back, doors and the
 * garden gate open, people), 'shut' empty (shutters closed, the shops boarded).
 * ----------------------------------------------------------------------------
 */

import { cyl } from './castra.js';
import { lin } from './rural.js';
import { cypress, bush, hedge, herm, roofSlope } from './learning.js';
import {
  Bag, box, WASH, TUFA, WOODS, CLOTH, shell, wall, windowTrim, doorLeaf, doorFrame, balcony, awning, ridgeRoof, pentRoof, slabBox, fig, frame,
} from './houseKit.js';
import { boards, counter, laundry, band, sign } from './housesTall.js';
import { DYES } from '../people/actors.js';

/** Mirror a look left to right on odd looks: the stair door and the shops swap sides. */
const RIGHT = [1, -1, 1, -1];
const OAK = lin(WOODS.oak);
const sum = (a) => a.reduce((s, v) => s + v, 0);
const seg = (lod, near = 10) => (lod ? 6 : near);
const IRON = lin(0x2a2420);
/** Far out (level 2) every other window of a row: the same rhythm in half the quads. */
const thin = (list, lod) => (lod === 2 ? list.filter((_, i) => i % 2 === 0) : list);

/** The free stretches of a wall (x from -W to W) between openings `{ x, w }`, with `gap` clear of each. */
function runs(W, opens, gap = 0.1) {
  const sorted = [...opens].sort((a, b) => a.x - b.x);
  const out = [];
  let x = -W;
  for (const o of sorted) {
    const a = o.x - o.w / 2 - gap;
    if (a - x > 0.05) out.push([x, a]);
    x = Math.max(x, o.x + o.w / 2 + gap);
  }
  if (W - x > 0.05) out.push([x, W]);
  return out;
}

/**
 * Run `build` and slide the plaster texture on what it added so that its base `from` (metres up) lies
 * above the texture's red dado. The plaster (surfaces.js) repeats every 4 m up a wall and paints a
 * dado in the first 1.3 m of each repeat, so a plain tall wall would show a red stripe at every
 * 4 m: the ground floor keeps the one dado, the storeys above start in the plain wash.
 */
function plainFrom(bag, from, build) {
  const n = (bag.o.plaster ?? []).length;
  const out = build();
  const list = bag.o.plaster ?? [];
  for (let i = n; i < list.length; i++) {
    const uv = list[i].attributes.uv;
    if (!uv) continue;
    for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) + 1.4 - from);
  }
  return out;
}

/** A window box or a pot of herbs on a sill: `put` frame, `x`, sill height `y`. */
function sillPot(bag, put, x, y) {
  if (bag.lod) return;
  bag.add('clay', put(cyl(0.075, 0.055, 0.12, 7, x, y, 0.12, lin(0xb06a3c))));
  bag.add('leaf', put(box(0.15, 0.09, 0.12, x, y + 0.11, 0.12, [0.05, 0.12, 0.03])));
}

/** A board tilted to run from (za, ya) up to (zb, yb) along z at x: a stair's stringer or rail. */
function slant(bag, key, x, za, ya, zb, yb, w, t, col) {
  let [z0, y0, z1, y1] = [za, ya, zb, yb];
  if (z1 < z0) [z0, y0, z1, y1] = [z1, y1, z0, y0];
  const len = Math.hypot(z1 - z0, y1 - y0);
  const g = box(w, t, len, 0, -t / 2, 0, col);
  g.rotateX(-Math.atan2(y1 - y0, z1 - z0));
  g.translate(x, (y0 + y1) / 2, (z0 + z1) / 2);
  bag.add(key, g);
}

/** Roofs over quads (the tenement's corner order): tile and the boards under it. */
function slopes(bag, quads, seed) {
  quads.forEach((q, i) => {
    const r = roofSlope(q, { lod: bag.lod, seed: seed + i });
    bag.add('tile', r.tile);
    bag.add('wood', r.wood);
  });
}

/** A terracotta vent on a roof: a short pot with a lid on stones, smoke leaving by its gap. */
function vent(bag, x, y, z) {
  if (bag.lod === 2) return;
  const s = seg(bag.lod, 8);
  bag.add('clay', cyl(0.1, 0.13, 0.42, s, x, y, z, lin(0xb8683c, 0.95)));
  bag.add('clay', cyl(0.02, 0.2, 0.1, s, x, y + 0.42, z, lin(0xa85a34)));
  bag.add('dark', cyl(0.07, 0.07, 0.02, 6, x, y + 0.405, z));
}

// ---------------------------------------------------------------------------
// The insula
// ---------------------------------------------------------------------------

/** The insula's measures (metres): the people, the lamps and the tests read them. */
export const INSULA = Object.freeze({
  half: 3.55, well: 1.3, floors: Object.freeze([2.8, 2.5, 2.5]), floorY: 0.06,
  shops: Object.freeze([[-2.3, 1.3], [-0.85, 1.3], [0.6, 1.3]]),
  stair: 2.4,
  counterZ: 3.03,
});

const INS_LOOKS = [
  { wash: WASH.sand, court: WASH.ochre, shut: WOODS.olive, ware: ['amph', 'cloth', 'fruit'], bal: [3.2, 0], stair: false, extra: 'laundry', pitch: [1.3, 1.1, 0.9], shutters: 'open' },
  { wash: WASH.ochre, court: WASH.cream, shut: WOODS.oak, ware: ['bread', 'amph', 'cloth'], bal: [0, 0], stair: true, extra: 'pots', pitch: [1.4, 1.0, 0.8], shutters: 'closed' },
  { wash: WASH.yellow, court: WASH.pink, shut: WOODS.brown, ware: ['fruit', 'bread', 'amph'], bal: [2.2, 3.2], stair: false, extra: 'awning', pitch: [1.2, 1.2, 1.0], shutters: 'open' },
  { wash: WASH.pink, court: WASH.cream, shut: WOODS.olive, ware: ['cloth', 'fruit', 'bread'], bal: [0, 2.6], stair: false, extra: 'sign', pitch: [1.35, 1.05, 0.85], shutters: 'open' },
];

/** The outside timber stair on the +x side: two flights and two landings, doors to the second and third floors. */
function outsideStair(bag, H, ys) {
  const X = H + 0.2;
  const w = 0.4;
  const flight = (zA, yA, zB, yB, n) => {
    const d = Math.abs(zB - zA) / n;
    for (let i = 0; i < n; i++) {
      const z = zA + ((zB - zA) * (i + 0.5)) / n;
      const y = yA + ((yB - yA) * (i + 1)) / n;
      bag.add('wood', box(w, 0.05, d + 0.02, X, y - 0.05, z, OAK));
    }
    slant(bag, 'wood', X, zA, yA, zB, yB, w, 0.1, lin(WOODS.oak, 0.8));
    if (bag.lod === 2) return;
    slant(bag, 'wood', X + 0.19, zA, yA + 0.95, zB, yB + 0.95, 0.05, 0.05, OAK);
    for (let i = 0; i <= n; i += 3) {
      const z = zA + ((zB - zA) * i) / n;
      bag.add('wood', box(0.05, 0.95, 0.05, X + 0.19, yA + ((yB - yA) * i) / n, z, OAK));
    }
  };
  // (Far out the flights are their stringers alone: a slab running up the side.)
  flight(-3.2, 0.06, 0.8, ys[1], bag.lod === 2 ? 0 : 13);
  flight(0.8, ys[1], -2.2, ys[2], bag.lod === 2 ? 0 : 10);
  for (const [z0, z1, y] of [[0.8, 1.8, ys[1]], [-3.3, -2.2, ys[2]]]) {
    bag.add('wood', box(0.44, 0.06, z1 - z0, X, y - 0.06, (z0 + z1) / 2, OAK));
    if (bag.lod < 2) {
      bag.add('wood', box(0.05, 0.9, z1 - z0, X + 0.19, y, (z0 + z1) / 2, OAK));
      bag.add('wood', box(0.05, 0.9, 0.05, X + 0.19, y, z0, OAK));
    }
  }
}

/** An insula, its look `v` (0 to 3), at a level of detail. */
export function buildInsula(v = 0, lod = 0) {
  const L = INS_LOOKS[v & 3];
  const bag = new Bag(`insula${v}`, lod, 1301 + v * 31);
  const { half: H, well: W, floors, floorY } = INSULA;
  const ys = floors.map((_, i) => sum(floors.slice(0, i)));
  const top = sum(floors);
  const sg = RIGHT[v & 3];
  const wash = lin(L.wash);
  const col = lin(L.shut);
  // The ground floor: three shops and the stair door on the street, small windows on the sides and back.
  const SH = 1.9;
  const shopOpen = INSULA.shops.map(([x, w]) => ({ x: x * sg, y: 0, w, h: SH }));
  const door = { x: INSULA.stair * sg, y: 0, w: 0.9, h: 1.8 };
  const sideWin = thin([-1.9, 1.9], lod).map((x) => ({ x, y: 1.25, w: 0.45, h: 0.55 }));
  slabBox(bag, 'flags', -H, H, -H + 0.3, H + 0.04, floorY, lin(0xa89c86, 0.9));
  const low = shell(bag, {
    x0: -H, x1: H, z0: -H, z1: H, h: floors[0], t: 0.32, c: wash, k: 0.97,
    openings: { '+z': [...shopOpen, door], '+x': sideWin, '-x': sideWin, '-z': thin([-2.4, -0.8, 0.8, 2.4], lod).map((x) => ({ x, y: 1.25, w: 0.45, h: 0.55 })) },
  });
  const fr = low['+z'];
  INSULA.shops.forEach(([x, w], i) => {
    doorFrame(bag, fr, { x: x * sg, w, h: SH });
    boards(bag, fr, x * sg, w, SH);
    counter(bag, fr, x * sg, w, INSULA.counterZ - H, L.ware[i], floorY);
  });
  doorFrame(bag, fr, { x: door.x, w: door.w, h: door.h });
  doorLeaf(bag, fr, { x: door.x, w: door.w, h: door.h, col: lin(WOODS.oak, 0.9), open: true });
  // The tufa footing along the street (and the sides): proud of the plaster, round the openings. (The red dado above it is the plaster texture's own.)
  for (const [a, b] of runs(H - 0.05, [...shopOpen, door])) {
    bag.add('rubble', fr(box(b - a, 0.55, 0.07, (a + b) / 2, 0, 0.03, lin(TUFA, 0.95))));
  }
  for (const s of ['+x', '-x']) {
    bag.add('rubble', low[s](box(6.3, 0.55, 0.07, 0, 0, 0.03, lin(TUFA, 0.95))));
  }
  // The two upper storeys: windows (doors where a balcony runs), shutters, pots on the sills.
  const FX = thin([-2.7, -1.35, 0, 1.35, 2.7], lod);
  const backX = thin([-2.4, -0.8, 0.8, 2.4], lod);
  const upFront = [];
  for (let f = 1; f < 3; f++) {
    const y0 = ys[f];
    const bw = L.bal[f - 1];
    const frontOpen = FX.map((x) => (bw && Math.abs(x) < bw / 2 - 0.1 ? { x, y: 0.05, w: 0.8, h: 1.75 } : { x, y: 0.5, w: 0.52, h: 0.95 }));
    // (The outside stair's doors on the +x side: the second floor at z 1.2, the third at z -2.7; that side's x runs the other way from z.)
    const doorX = f === 1 ? -1.2 : 2.7;
    const sideX = thin([-2.3, -0.75, 0.8, 2.3], lod);
    const sideOpen = (s) => {
      const stairSide = L.stair && s === '+x';
      const wins = sideX.filter((x) => !stairSide || Math.abs(x - doorX) > 0.9).map((x) => ({ x, y: 0.55, w: 0.5, h: 0.9 }));
      return stairSide ? [...wins, { x: doorX, y: 0.05, w: 0.9, h: 1.75 }] : wins;
    };
    const up = plainFrom(bag, y0, () => shell(bag, {
      x0: -H, x1: H, z0: -H, z1: H, y0, h: floors[f], t: 0.32, c: wash, k: 0.97,
      openings: { '+z': frontOpen, '+x': sideOpen('+x'), '-x': sideOpen('-x'), '-z': backX.map((x) => ({ x, y: 0.55, w: 0.5, h: 0.9 })) },
    }));
    upFront.push(up['+z']);
    const trim = (put, o, i, closed) => windowTrim(bag, put, { x: o.x, y: y0 + o.y, w: o.w, h: o.h }, { shutters: closed || (i + v + f) % 3 === 0 ? 'closed' : L.shutters, col, sill: o.h < 1.5 });
    frontOpen.forEach((o, i) => {
      trim(up['+z'], o, i, false);
      if (!bw || o.h < 1.5) sillPot(bag, up['+z'], o.x, y0 + o.y);
    });
    for (const s of ['+x', '-x']) sideOpen(s).forEach((o, i) => { if (!(s === '+x' && L.stair && o.h > 1.5)) trim(up[s], o, i, true); });
    backX.forEach((x, i) => trim(up['-z'], { x, y: 0.55, w: 0.5, h: 0.9 }, i, true));
    if (L.stair) {
      doorFrame(bag, up['+x'], { x: doorX, y: y0, w: 0.9, h: 1.75 });
      doorLeaf(bag, up['+x'], { x: doorX, y: y0, w: 0.9, h: 1.75, col: lin(WOODS.oak, 0.9), open: true });
    }
    if (bw) balcony(bag, up['+z'], { x: 0, w: bw, d: 0.38, y: y0, corbels: true, col: OAK });
    plainFrom(bag, y0, () => {
      band(bag, up['+z'], 0, 2 * H + 0.1, y0 - 0.04);
      band(bag, up['-z'], 0, 2 * H + 0.1, y0 - 0.04);
    });
  }
  if (L.stair) outsideStair(bag, H, ys);
  // Washing across the front, an awning or a sign on a shop, cloths on the well's rope.
  if (L.extra === 'laundry') laundry(bag, upFront[1], -2.2, -0.6, ys[2] + 1.55, 0.05, 31 + v);
  if (L.extra === 'awning') awning(bag, fr, { x: INSULA.shops[1][0] * sg, w: 1.5, y: 2.3, d: 0.45, drop: 0.3, cols: [lin(CLOTH.madder), lin(CLOTH.linen)] });
  if (L.extra === 'sign') sign(bag, fr, (INSULA.shops[2][0] + 0.9) * sg, 2.35, CLOTH.woad);
  if (L.extra === 'pots' && lod < 2) for (const [x] of INSULA.shops) bag.add('clay', fr(cyl(0.12, 0.09, 0.3, seg(lod), (x + 0.5) * sg, floorY, 0.3, lin(0xb88050))));
  // The light well: its four walls inside, with windows, a well-head and a washing line across it.
  // (One wall a storey: the plaster texture's dado would stripe a wall as tall as the well.)
  const cwin = (xs, f) => (lod === 2 ? [] : xs.map((x) => ({ x, y: f ? 0.5 : 1.0, w: 0.5, h: f ? 0.9 : 0.7 })));
  const courtWall = (s, plane, w, xs) => (lod === 2 ? [top] : floors).map((h, f) => plainFrom(bag, f ? ys[f] : 1.4, () => wall(bag, s, plane, 0, { w, y0: lod === 2 ? 0 : ys[f], h, t: 0.3, c: lin(L.court, 0.96), k: 0.95, open: cwin(xs, f) })));
  const cf = courtWall('-z', -W, 2 * W + 0.6, [-0.55, 0.55]);
  courtWall('+z', -W, 2 * W + 0.6, [-0.55, 0.55]);
  const cr = courtWall('-x', -W, 2 * W, [-0.5, 0.5]);
  courtWall('+x', -W, 2 * W, [-0.5, 0.5]);
  slabBox(bag, 'flags', -W, W, -W, W, floorY + 0.01, lin(0x9c917c, 0.9));
  if (lod < 1) {
    for (const [puts, xs] of [[cf, [-0.55, 0.55]], [cr, [-0.5, 0.5]]]) puts.forEach((put, f) => { for (const o of cwin(xs, f)) windowTrim(bag, put, { ...o, y: ys[f] + o.y }, { shutters: 'closed', col, sill: false }); });
    bag.add('stone', cyl(0.28, 0.3, 0.5, 12, 0, floorY, 0, 0.97));
    bag.add('dark', cyl(0.19, 0.19, 0.01, 12, 0, floorY + 0.5, 0, 1));
    bag.add('wood', box(2 * W - 0.2, 0.02, 0.02, 0, 3.4, 0, lin(0x8a7a5a, 0.8)));
    for (let k = 0; k < 4; k++) bag.add('paint', box(0.26, 0.5, 0.015, -0.85 + k * 0.56, 2.9, 0, lin([CLOTH.linen, CLOTH.madder, CLOTH.linen, CLOTH.woad][k], 0.95)));
  }
  // The roof in several pitches: the front wing steepest, the back wing shallower, the side wings hipped and lower.
  const rf = (o) => plainFrom(bag, top - 0.05, () => ridgeRoof(bag, { eaveY: top, kind: 'tile', fill: wash.map((c) => c * 0.96), over: 0.18, gableOver: 0.1, ...o }));
  rf({ x0: -H, x1: H, z0: W, z1: H, along: 'x', rise: L.pitch[0] });
  rf({ x0: -H, x1: H, z0: -H, z1: -W, along: 'x', rise: L.pitch[1] });
  rf({ x0: W, x1: H, z0: -W, z1: W, along: 'z', rise: L.pitch[2], hip: true });
  rf({ x0: -H, x1: -W, z0: -W, z1: W, along: 'z', rise: L.pitch[2], hip: true });
  const frontRidge = top + L.pitch[0] - 0.12;
  vent(bag, -1.7 * sg, frontRidge, (W + H) / 2);
  vent(bag, 1.9 * sg, frontRidge, (W + H) / 2);
  vent(bag, 0.6 * sg, top + L.pitch[1] - 0.12, -(W + H) / 2);
  return Object.assign(bag.build(), { shopsX: INSULA.shops.map(([x]) => x * sg) });
}

/** The insula's lit windows: three on each of the two upper floors' fronts, and a lamp in each shop. */
export function insulaLamps(v) {
  const sg = RIGHT[v & 3];
  const [f0, f1] = INSULA.floors;
  const out = [];
  for (const y of [f0 + 1.0, f0 + f1 + 1.0]) for (const x of [-2.7, -1.35, 0, 1.35, 2.7]) out.push(Object.freeze([x * sg, y, INSULA.half + 0.05, 1]));
  for (const [x] of INSULA.shops) out.push(Object.freeze([x * sg, 1.5, INSULA.half - 0.35, 1]));
  return Object.freeze(out);
}

// ---------------------------------------------------------------------------
// The villa
// ---------------------------------------------------------------------------

/** The villa's measures: the house runs z -1.4 to 3.6 (the street), the garden behind it. */
export const VILLA = Object.freeze({
  half: 3.6, zB: -1.4, floors: Object.freeze([3.2, 2.8]), floorY: 0.06,
  court: Object.freeze({ cz: 1.05, hx: 2.0, hz: 1.5 }),
  // (The compluvium's rim stands lower than the walls: the roof slopes in to it, as the real ones drained into the impluvium.)
  rim: 5.35,
});

const VILLA_LOOKS = [
  { wash: WASH.sand, shut: WOODS.olive, court: WASH.ochre, plaques: false, shutters: 'open' },
  { wash: WASH.ochre, shut: WOODS.oak, court: WASH.cream, plaques: false, shutters: 'closed' },
  { wash: WASH.pink, shut: WOODS.brown, court: WASH.red, plaques: false, shutters: 'open' },
  { wash: WASH.yellow, shut: WOODS.olive, court: WASH.white, plaques: true, shutters: 'open' },
];

/** A Tuscan column of stuccoed tufa: plain shaft narrowing upward, a block capital and a plinth. */
function column(bag, x, y, z, h, r) {
  const c = lin(WASH.white, 0.97);
  plainFrom(bag, 0, () => {
    bag.add('plaster', cyl(r * 0.8, r, h, bag.lod === 2 ? 4 : seg(bag.lod, 10), x, y, z, c));
    if (bag.lod === 2) return;
    bag.add('plaster', box(r * 2.9, 0.08, r * 2.9, x, y + h, z, c), box(r * 2.4, 0.06, r * 2.4, x, y + h + 0.08, z, lin(WASH.cream, 0.97)));
    if (bag.lod === 0) bag.add('plaster', box(r * 2.5, 0.07, r * 2.5, x, y, z, c));
  });
}

/** A villa, its look `v` (0 to 3), at a level of detail. */
export function buildVilla(v = 0, lod = 0) {
  const L = VILLA_LOOKS[v & 3];
  const bag = new Bag(`villa${v}`, lod, 1411 + v * 37);
  const { half: H, zB, floors, floorY, rim } = VILLA;
  const { cz, hx, hz } = VILLA.court;
  const zF = H;
  const sg = RIGHT[v & 3];
  const wash = lin(L.wash);
  const col = lin(L.shut);
  const top = sum(floors);
  // The street front is blank but for the door, the porter's window and three small windows high up; the sides and back have windows.
  const doorO = { x: 0, y: 0, w: 1.0, h: 2.1 };
  const lodge = { x: 1.9 * sg, y: 1.3, w: 0.4, h: 0.5 };
  const hi = (x) => ({ x, y: 0.7, w: 0.4, h: 0.7 });
  const sideRow = (xs, y, h) => thin(xs, lod).map((x) => ({ x, y, w: 0.5, h }));
  const walls = (y0, h, open) => shell(bag, { x0: -H, x1: H, z0: zB, z1: zF, y0, h, t: 0.32, c: wash, k: 0.97, openings: open });
  slabBox(bag, 'flags', -H, H, zB + 0.3, zF + 0.04, floorY, lin(0xa89c86, 0.9));
  const low = walls(0, floors[0], {
    '+z': [doorO, lodge], '+x': sideRow([-1.5, 1.2], 1.4, 0.5), '-x': sideRow([-1.5, 1.2], 1.4, 0.5), '-z': [{ x: 0, y: 0, w: 1.0, h: 2.1 }, ...sideRow([-2.3, 2.3], 1.2, 0.8)],
  });
  const up = plainFrom(bag, floors[0], () => walls(floors[0], floors[1], {
    '+z': thin([-2.4, 0, 2.4], lod).map(hi), '+x': sideRow([-1.5, 0.2, 1.4], 0.6, 0.9), '-x': sideRow([-1.5, 0.2, 1.4], 0.6, 0.9), '-z': sideRow([-2.4, -0.8, 0.8, 2.4], 0.6, 0.9),
  }));
  const fr = low['+z'];
  // The door between two stucco pilasters, studded; the porter's window barred and shuttered.
  doorFrame(bag, fr, { x: 0, w: doorO.w, h: doorO.h });
  doorLeaf(bag, fr, { x: 0, w: doorO.w, h: doorO.h, col: lin(WOODS.oak, 0.85), open: true });
  if (lod === 0) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 6; j++) bag.add('woodShut', fr(box(0.07, 0.07, 0.03, -0.3 + i * 0.3, 0.25 + j * 0.33, 0.012, IRON)));
  }
  if (lod < 2) plainFrom(bag, 0, () => { for (const s of [-1, 1]) bag.add('plaster', fr(box(0.22, doorO.h + 0.3, 0.1, s * 0.82, 0, 0.04, lin(WASH.white, 0.97)))); });
  windowTrim(bag, fr, { x: lodge.x, y: lodge.y, w: lodge.w, h: lodge.h }, { shutters: 'open', col, sill: true });
  if (lod === 0) for (let k = -1; k <= 1; k++) bag.add('dark', fr(box(0.02, lodge.h, 0.02, lodge.x + k * 0.12, lodge.y, 0.02)));
  // The tufa footing along the street (the red dado above it is the plaster texture's), and the string course at the floor.
  for (const [a, b] of runs(H - 0.05, [doorO, lodge], 0.35)) {
    bag.add('rubble', fr(box(b - a, 0.5, 0.07, (a + b) / 2, 0, 0.03, lin(TUFA, 0.95))));
  }
  plainFrom(bag, floors[0], () => {
    band(bag, up['+z'], 0, 2 * H + 0.1, floors[0] - 0.04);
    band(bag, up['-z'], 0, 2 * H + 0.1, floors[0] - 0.04);
  });
  [-2.4, 0, 2.4].forEach((x, i) => windowTrim(bag, up['+z'], { x, y: floors[0] + 0.7, w: 0.4, h: 0.7 }, { shutters: (i + v) % 2 ? 'closed' : L.shutters, col, sill: true }));
  for (const s of ['+x', '-x']) [-1.5, 0.2, 1.4].forEach((x, i) => windowTrim(bag, up[s], { x, y: floors[0] + 0.6, w: 0.5, h: 0.9 }, { shutters: 'closed', col, sill: true }));
  [-2.4, -0.8, 0.8, 2.4].forEach((x, i) => windowTrim(bag, up['-z'], { x, y: floors[0] + 0.6, w: 0.5, h: 0.9 }, { shutters: (i + v) % 2 ? L.shutters : 'closed', col, sill: true }));
  doorFrame(bag, low['-z'], { x: 0, w: 1.0, h: 2.1 });
  doorLeaf(bag, low['-z'], { x: 0, w: 1.0, h: 2.1, col: lin(WOODS.oak, 0.85), open: true });
  // The peristyle court: inner walls with doorways and upper windows, a colonnade, the cistern head.
  const courtC = lin(L.court, 0.96);
  const cw = (xs, y, h, w) => xs.map((x) => ({ x, y, w, h }));
  // (In two pieces, the ground floor and the upper, so the texture's dado shows once.)
  const inner = (s, plane, c, w, xs) => (lod === 2 ? [[0, rim, []]] : [[0, floors[0], cw(xs, 0, 2.0, 0.85)], [floors[0], rim - floors[0], cw(xs, 0.55, 0.9, 0.5)]]).forEach(([y0, h, open]) => {
    plainFrom(bag, y0 ? y0 : 1.4, () => wall(bag, s, plane, c, { w, y0, h, t: 0.3, c: courtC, k: 0.95, open: lod === 2 ? [] : open }));
  });
  inner('-z', -(cz + hz), 0, 2 * hx + 0.6, [-1.0, 0, 1.0]);
  inner('+z', cz - hz, 0, 2 * hx + 0.6, [-1.0, 0, 1.0]);
  inner('-x', -hx, cz, 2 * hz, [-0.5, 0.5]);
  inner('+x', -hx, cz, 2 * hz, [-0.5, 0.5]);
  slabBox(bag, 'flags', -hx, hx, cz - hz, cz + hz, floorY + 0.01, lin(0xb0a48c, 0.9));
  // The columns: along the front and back of the court four apiece, one midway on each side.
  const cx = hx - 0.55;
  const cd = hz - 0.55;
  const colH = 2.7;
  const xs4 = thin([-cx, -cx / 3, cx / 3, cx], lod).length < 2 ? [-cx, cx] : thin([-cx, -cx / 3, cx / 3, cx], lod);
  for (const z of [cz - cd, cz + cd]) for (const x of xs4) column(bag, x, floorY, z, colH, 0.12);
  for (const x of [-cx, cx]) column(bag, x, floorY, cz, colH, 0.12);
  // The portico's lean-to roof between the inner walls and the columns, and the architrave along them.
  const yw = 3.3;
  const yc = 2.95;
  slopes(bag, [
    [[cx, yc, cz + cd], [-cx, yc, cz + cd], [-hx, yw, cz + hz], [hx, yw, cz + hz]],
    [[-cx, yc, cz - cd], [cx, yc, cz - cd], [hx, yw, cz - hz], [-hx, yw, cz - hz]],
    [[-cx, yc, cz + cd], [-cx, yc, cz - cd], [-hx, yw, cz - hz], [-hx, yw, cz + hz]],
    [[cx, yc, cz - cd], [cx, yc, cz + cd], [hx, yw, cz + hz], [hx, yw, cz - hz]],
  ], bag.seed + 200);
  if (lod < 2) {
    for (const z of [cz - cd, cz + cd]) bag.add('plaster', box(2 * cx + 0.3, 0.2, 0.2, 0, floorY + colH + 0.14, z, lin(WASH.cream, 0.97)));
    for (const x of [-cx, cx]) bag.add('plaster', box(0.2, 0.2, 2 * cd + 0.3, x, floorY + colH + 0.14, cz, lin(WASH.cream, 0.97)));
  }
  // The cistern head: a round stone kerb with a dark mouth, and a rope-worn lip.
  bag.add('stone', cyl(0.3, 0.33, 0.55, seg(lod, 12), 0, floorY + 0.01, cz, 0.97));
  bag.add('dark', cyl(0.2, 0.2, 0.01, 10, 0, floorY + 0.56, cz));
  // The roof: four slopes falling from the eaves to the rim of the compluvium, the open square over the atrium that drained the rain into the impluvium.
  const o = 0.28;
  const ex = H + o;
  const ez1 = zF + o;
  const ez0 = zB - o;
  const ye = top + 0.15;
  const rx = hx;
  const rz0 = cz - hz;
  const rz1 = cz + hz;
  slopes(bag, [
    [[rx, rim, rz1], [-rx, rim, rz1], [-ex, ye, ez1], [ex, ye, ez1]],
    [[-rx, rim, rz0], [rx, rim, rz0], [ex, ye, ez0], [-ex, ye, ez0]],
    [[rx, rim, rz0], [rx, rim, rz1], [ex, ye, ez1], [ex, ye, ez0]],
    [[-rx, rim, rz1], [-rx, rim, rz0], [-ex, ye, ez0], [-ex, ye, ez1]],
  ], bag.seed + 300);
  // A stucco lip round the compluvium and, on the best look, painted terracotta plaques along the eaves.
  if (lod < 2) {
    plainFrom(bag, rim, () => {
      for (const z of [rz0, rz1]) bag.add('plaster', box(2 * rx + 0.2, 0.14, 0.14, 0, rim - 0.04, z, lin(WASH.white, 0.97)));
      for (const x of [-rx, rx]) bag.add('plaster', box(0.14, 0.14, 2 * hz, x, rim - 0.04, cz, lin(WASH.white, 0.97)));
    });
  }
  if (L.plaques && lod < 2) {
    const tint = [lin(0xc8643c), lin(0xe0d2b0), lin(0xb04a38), lin(0xe0d2b0)];
    const n = lod ? 8 : 15;
    for (let i = 0; i < n; i++) {
      const x = -H + 0.25 + ((2 * H - 0.5) * i) / (n - 1);
      bag.add('clay', box(0.26, 0.3, 0.06, x, ye - 0.08, ez1 - 0.04, lin(0xb8683c)));
      if (!lod) bag.add('paint', box(0.18, 0.2, 0.02, x, ye - 0.03, ez1 - 0.005, tint[i % 4]));
    }
  }
  // The kitchen garden behind: a low wall with tile coping, beds of vegetables, a bean frame, a water jar and the fig.
  const gz0 = -3.55;
  const gz1 = zB - 0.02;
  const gwall = (x0, x1, z0, z1, h) => {
    plainFrom(bag, 0, () => bag.add('plaster', box(x1 - x0, h, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, lin(L.wash, 0.95))));
    if (lod < 2) bag.add('clay', box(x1 - x0 + 0.08, 0.07, z1 - z0 + 0.08, (x0 + x1) / 2, h, (z0 + z1) / 2, lin(0xb8683c)));
  };
  gwall(-H + 0.1, H - 0.1, gz0 - 0.1, gz0 + 0.15, 1.9);
  gwall(-H + 0.1, -H + 0.35, gz0, gz1, 1.6);
  gwall(H - 0.35, H - 0.1, gz0, gz1, 1.6);
  slabBox(bag, 'earth', -H + 0.35, H - 0.35, gz0 + 0.15, gz1, 0.03, lin(0x7a6a4a, 0.9));
  const veg = [[0.07, 0.16, 0.04], [0.09, 0.2, 0.05], [0.12, 0.17, 0.03]];
  const rowsZ = lod === 2 ? [-2.6] : lod ? [-2.9, -2.2] : [-3.0, -2.55, -2.1];
  for (const z of rowsZ) {
    for (const [x0, x1] of [[-3.0, -0.9], [0.0, 1.5]]) {
      bag.add('earth', box(x1 - x0, 0.1, 0.34, (x0 + x1) / 2, 0.03, z, lin(0x5f4f34, 0.9)));
      bag.add('leaf', box(x1 - x0 - 0.1, 0.14, 0.22, (x0 + x1) / 2, 0.12, z, veg[(Math.round(z * 10) + v) % 3 + 0]));
    }
  }
  fig(bag, 2.55, -2.7, lod === 2 ? 0.9 : 1.15, 21 + v);
  if (lod < 2) {
    bag.add('clay', cyl(0.2, 0.16, 0.55, seg(lod), -3.1, 0.03, -1.8, lin(0xb08850)));
    for (let k = 0; k < 3; k++) bag.add('wood', cyl(0.025, 0.025, 1.5, 4, -0.4 + k * 0.4, 0.03, -3.3, lin(WOODS.oak, 0.8)));
    bag.add('wood', box(1.0, 0.03, 0.03, 0, 1.5, -3.3, lin(WOODS.oak, 0.8)));
  }
  return bag.build();
}

/** The villa's lit windows: three small ones high on the front, and the porter's lodge. */
export function villaLamps(v) {
  const sg = RIGHT[v & 3];
  const y = VILLA.floors[0] + 1.0;
  return Object.freeze([-2.4, 0, 2.4].map((x) => Object.freeze([x, y, VILLA.half + 0.05, 1])).concat([Object.freeze([1.9 * sg, 1.6, VILLA.half + 0.05, 1])]));
}

// ---------------------------------------------------------------------------
// The garden villa
// ---------------------------------------------------------------------------

/** The garden villa's measures, in the house-at-the-back frame (the looks turn it a quarter): the house z -3.6 to -0.4, the garden before it. */
export const GARDEN_VILLA = Object.freeze({
  half: 3.6, z0: -3.6, z1: -0.4, floors: Object.freeze([2.7, 2.3]), floorY: 0.06,
  colX: Object.freeze([-3.15, -2.25, -1.35, -0.45, 0.45, 1.35, 2.25, 3.15]),
  loggiaZ: 0.55,
});

const GV_LOOKS = [
  { wash: WASH.sand, shut: WOODS.olive, turn: false, shutters: 'open', pergola: true },
  { wash: WASH.ochre, shut: WOODS.oak, turn: true, shutters: 'open', pergola: false },
  { wash: WASH.pink, shut: WOODS.brown, turn: false, shutters: 'closed', pergola: false },
  { wash: WASH.yellow, shut: WOODS.olive, turn: true, shutters: 'open', pergola: true },
];

/** The house of the garden villa along the back: ground floor behind a loggia, rooms above, a hipped roof. */
function gvHouse(bag, L, v) {
  const { half: H, z0, z1, floors, floorY, colX, loggiaZ } = GARDEN_VILLA;
  const lod = bag.lod;
  const wash = lin(L.wash);
  const col = lin(L.shut);
  const top = sum(floors);
  const grid = (xs, y, w, h) => xs.map((x) => ({ x, y, w, h }));
  const lowOpen = { '+z': [...grid([-1.8, 0, 1.8], 0, 0.95, 2.1), ...grid(thin([-2.7, -0.9, 0.9, 2.7], lod), 1.0, 0.55, 0.8)], '+x': grid([-1.0], 1.1, 0.5, 0.7), '-x': grid([-1.0], 1.1, 0.5, 0.7), '-z': grid([-2.4, 2.4], 1.1, 0.5, 0.7) };
  const upX = thin([-2.7, -1.35, 0, 1.35, 2.7], lod);
  const upOpen = { '+z': grid(upX, 0.5, 0.52, 0.95), '+x': grid([-1.0], 0.5, 0.5, 0.9), '-x': grid([-1.0], 0.5, 0.5, 0.9), '-z': grid([-2.4, 0, 2.4], 0.5, 0.5, 0.9) };
  slabBox(bag, 'flags', -H, H, z0 + 0.3, z1 + 0.04, floorY, lin(0xa89c86, 0.9));
  const low = shell(bag, { x0: -H, x1: H, z0, z1, h: floors[0], t: 0.32, c: wash, k: 0.97, openings: lowOpen });
  const up = plainFrom(bag, floors[0], () => shell(bag, { x0: -H, x1: H, z0, z1, y0: floors[0], h: floors[1], t: 0.32, c: wash, k: 0.97, openings: upOpen }));
  const fr = low['+z'];
  // (z of the garden-side wall is z1: the frame's origin sits on it, so loggia depth is out of it.)
  for (const x of [-1.8, 0, 1.8]) {
    doorFrame(bag, fr, { x, w: 0.95, h: 2.1 });
    doorLeaf(bag, fr, { x, w: 0.95, h: 2.1, col: lin(WOODS.oak, 0.85), open: true });
  }
  thin([-2.7, -0.9, 0.9, 2.7], lod).forEach((x, i) => windowTrim(bag, fr, { x, y: 1.0, w: 0.55, h: 0.8 }, { shutters: (i + v) % 2 ? 'closed' : L.shutters, col, sill: true }));
  upX.forEach((x, i) => windowTrim(bag, up['+z'], { x, y: floors[0] + 0.5, w: 0.52, h: 0.95 }, { shutters: (i + v) % 3 === 0 ? 'closed' : L.shutters, col, sill: true }));
  for (const s of ['+x', '-x']) windowTrim(bag, up[s], { x: -1.0, y: floors[0] + 0.5, w: 0.5, h: 0.9 }, { shutters: 'closed', col, sill: true });
  [-2.4, 0, 2.4].forEach((x) => windowTrim(bag, up['-z'], { x, y: floors[0] + 0.5, w: 0.5, h: 0.9 }, { shutters: 'closed', col, sill: true }));
  plainFrom(bag, floors[0], () => {
    band(bag, up['+z'], 0, 2 * H + 0.1, floors[0] - 0.04);
    band(bag, up['-z'], 0, 2 * H + 0.1, floors[0] - 0.04);
  });
  // The loggia: Tuscan columns on a step, an architrave, a lean-to roof over the walk.
  const colH = 2.4;
  for (const x of thin(colX, lod)) column(bag, x, floorY, loggiaZ, colH, 0.115);
  if (lod < 2) bag.add('plaster', box(2 * H, 0.2, 0.22, 0, floorY + colH + 0.14, loggiaZ, lin(WASH.cream, 0.97)));
  slabBox(bag, 'flags', -H, H, z1, loggiaZ + 0.2, floorY + 0.02, lin(0xb0a48c, 0.9));
  pentRoof(bag, { x0: -H, x1: H, zHigh: z1, zLow: loggiaZ + 0.1, yHigh: 3.0, yLow: 2.75, over: 0.12 });
  for (const s of [-1, 1]) if (lod < 2) bag.add('plaster', box(0.2, 0.6, 0.2, s * (H - 0.1), floors[0] + 0.1, loggiaZ - 0.25, lin(WASH.white, 0.97)));
  // The roof, hipped along the house.
  ridgeRoof(bag, { x0: -H, x1: H, z0, z1, eaveY: top, rise: 1.0, along: 'x', hip: true, over: 0.28, kind: 'tile' });
  if (lod < 2) {
    bag.add('clay', cyl(0.1, 0.13, 0.4, seg(lod, 8), -1.2 * RIGHT[v & 3], top + 0.9, (z0 + z1) / 2, lin(0xb8683c, 0.95)));
    bag.add('clay', cyl(0.02, 0.19, 0.1, seg(lod, 8), -1.2 * RIGHT[v & 3], top + 1.3, (z0 + z1) / 2, lin(0xa85a34)));
  }
}

/** The garden of the garden villa, in the house-at-the-back frame: z about 0.8 to 3.4, x -3.4 to 3.4. */
function gvGarden(bag, L, v) {
  const lod = bag.lod;
  const sand = lin(0xc8b890, 0.9);
  slabBox(bag, 'earth', -3.45, 3.45, 0.55, 3.45, 0.03, lin(0x8a7a58, 0.9));
  // The paths: the axis from the loggia to the gate, and a cross path.
  slabBox(bag, 'flags', -0.45, 0.45, 0.55, 3.45, 0.045, sand);
  slabBox(bag, 'flags', -3.45, 3.45, 1.65, 2.25, 0.045, sand);
  // The fountain basin on the crossing: a stone kerb, water, a pillar and bowl.
  const s = seg(lod, 16);
  bag.add('stone', cyl(0.62, 0.66, 0.38, s, 0, 0.04, 1.95, 0.97));
  bag.add('paint', cyl(0.52, 0.52, 0.02, s, 0, 0.38, 1.95, lin(0x5a7f8c, 0.9)));
  if (lod < 2) {
    bag.add('stone', cyl(0.07, 0.1, 0.7, 8, 0, 0.4, 1.95, 0.95));
    bag.add('stone', cyl(0.24, 0.1, 0.12, s, 0, 1.0, 1.95, 0.97));
  }
  // The box-edged beds (a parterre each side), each a bed of earth with flowers; a laurel in one and the sundial in the other.
  const bed = (x0, x1, z0, z1, seed) => {
    bag.add('earth', box(x1 - x0, 0.06, z1 - z0, (x0 + x1) / 2, 0.03, (z0 + z1) / 2, lin(0x5f4f34, 0.9)));
    if (lod === 2) { bag.add('leaf', box(x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, 0.03, (z0 + z1) / 2, [0.05, 0.11, 0.035])); return; }
    const t = 0.14;
    bag.add('leaf', hedge(x0, x1, z1 - t, z1, 0.4, { lod, seed }), hedge(x0, x1, z0, z0 + t, 0.4, { lod, seed: seed + 1 }), hedge(x0, x0 + t, z0 + t, z1 - t, 0.4, { lod, seed: seed + 2 }), hedge(x1 - t, x1, z0 + t, z1 - t, 0.4, { lod, seed: seed + 3 }));
    if (lod === 0) {
      const cols = [lin(CLOTH.madder), lin(CLOTH.weld), lin(CLOTH.linen), lin(CLOTH.murex)];
      for (let i = 0; i < 6; i++) bag.add('paint', box(0.07, 0.1, 0.07, x0 + 0.25 + (i % 3) * ((x1 - x0 - 0.5) / 2), 0.06, z0 + 0.3 + Math.floor(i / 3) * (z1 - z0 - 0.6), cols[(i + seed) % 4]));
    }
  };
  bed(-2.15, -0.85, 1.0, 3.25, 31 + v);
  bed(0.85, 2.15, 1.0, 3.25, 41 + v);
  if (lod < 2) bag.add('leaf', bush(-1.5, 0.6, 2.1, 0.3, { lod, seed: 7 + v }));
  if (lod < 2) {
    bag.add('stone', box(0.2, 0.75, 0.2, 1.5, 0.06, 2.1, 0.95), box(0.5, 0.05, 0.5, 1.5, 0.81, 2.1, 1));
    bag.add('stone', box(0.02, 0.2, 0.3, 1.5, 0.86, 2.1, 0.9));
  }
  // A herm by the right wall, two cypresses, a laurel in the corner.
  if (lod < 2) {
    const h = herm(2.85, 0.03, 1.15, -0.4, { h: 1.5, lod, beard: v % 2 === 0 });
    bag.add('stone', h.stone);
  }
  for (const [x, z, hh] of lod === 2 ? [[3.2, 0.95, 3.0]] : [[-3.2, 0.95, 3.2], [3.2, 0.95, 3.0]]) {
    const c = cypress(x, z, hh, { lod, seed: 9 + v });
    bag.add('leaf', c.leaf);
    bag.add('wood', c.wood);
  }
  // The pergola of vines on posts, along the left wall (two looks).
  if (L.pergola) {
    const wood = lin(WOODS.oak, 0.9);
    const post = (x, z) => bag.add('wood', cyl(0.06, 0.07, 2.3, 6, x, 0.03, z, wood));
    const zs = [1.0, 1.9, 2.8];
    for (const z of lod === 2 ? [1.9] : zs) for (const x of [-3.3, -2.5]) post(x, z);
    if (lod < 2) {
      for (const z of zs) bag.add('wood', box(1.1, 0.07, 0.09, -2.9, 2.3, z, wood));
      for (const x of [-3.3, -2.5]) bag.add('wood', box(0.07, 0.07, 2.0, x, 2.3, 1.9, wood));
      for (let i = 0; i < 5; i++) bag.add('leaf', box(0.5, 0.12, 0.55, -2.9 + (i % 2 ? 0.1 : -0.1), 2.38, 1.0 + i * 0.45, [0.05 + 0.01 * (i % 3), 0.12, 0.03]));
      if (lod === 0) for (const z of [1.3, 2.2, 2.6]) bag.add('paint', box(0.1, 0.22, 0.1, -2.9, 2.14, z, lin(0x5a3a5a)));
    }
  }
}

/** The garden's walls (low, plastered, tile-coped) and its gate, in the house-at-the-back frame; the looks that turn it move the gate to the left wall. */
function gvWalls(bag, L, v) {
  const lod = bag.lod;
  const H = GARDEN_VILLA.half;
  const wh = 1.1;
  const wall1 = (x0, x1, z0, z1) => {
    plainFrom(bag, 0, () => bag.add('plaster', box(x1 - x0, wh, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, lin(L.wash, 0.95))));
    if (lod < 2) bag.add('clay', box(x1 - x0 + 0.08, 0.07, z1 - z0 + 0.08, (x0 + x1) / 2, wh, (z0 + z1) / 2, lin(0xb8683c)));
  };
  const gate = 1.1;
  const gx = 0;
  if (L.turn) {
    wall1(-H + 0.1, H - 0.1, 3.3, 3.55);
    wall1(H - 0.35, H - 0.1, -0.4, 3.3);
    wall1(-H + 0.1, -H + 0.35, -0.4, 2.0 - gate / 2);
    wall1(-H + 0.1, -H + 0.35, 2.0 + gate / 2, 3.3);
  } else {
    wall1(-H + 0.1, gx - gate / 2, 3.3, 3.55);
    wall1(gx + gate / 2, H - 0.1, 3.3, 3.55);
    wall1(-H + 0.1, -H + 0.35, -0.4, 3.3);
    wall1(H - 0.35, H - 0.1, -0.4, 3.3);
  }
  // The gate: two posts with a lintel, the leaf (open when lived in).
  const put = L.turn ? frame('-x', H - 0.225, 2.0) : frame('+z', 3.425, gx);
  plainFrom(bag, 0, () => {
    for (const s of [-1, 1]) bag.add('plaster', put(box(0.34, 2.2, 0.34, s * (gate / 2 + 0.05), 0, 0, lin(WASH.white, 0.97))));
    bag.add('plaster', put(box(gate + 0.75, 0.16, 0.34, 0, 2.2, 0, lin(WASH.white, 0.97))));
  });
  if (lod < 2) bag.add('clay', put(box(gate + 0.85, 0.07, 0.42, 0, 2.36, 0, lin(0xb8683c))));
  doorLeaf(bag, put, { x: 0, w: gate, h: 1.6, col: lin(WOODS.oak, 0.9), open: true });
}

/** A garden villa, its look `v` (0 to 3), at a level of detail. */
export function buildGardenVilla(v = 0, lod = 0) {
  const L = GV_LOOKS[v & 3];
  const bag = new Bag(`gvilla${v}`, lod, 1511 + v * 41);
  // Built with the house at the back, then turned a quarter in the looks that put it on the left.
  const hb = new Bag('gv', lod, bag.seed);
  gvHouse(hb, L, v);
  gvGarden(hb, L, v);
  gvWalls(hb, L, v);
  if (L.turn) for (const list of Object.values(hb.o)) for (const g of list) g.rotateY(Math.PI / 2);
  for (const [key, list] of Object.entries(hb.o)) (bag.o[key] ??= []).push(...list);
  return bag.build();
}

/** The garden villa's lit windows: the rooms above the loggia (or, turned, the house's street end). */
export function gardenVillaLamps(v) {
  const L = GV_LOOKS[v & 3];
  const y = GARDEN_VILLA.floors[0] + 0.95;
  if (L.turn) return Object.freeze([Object.freeze([-3.0, y, 3.65, 1])]);
  return Object.freeze([-2.7, 0, 2.7].map((x) => Object.freeze([x, y, GARDEN_VILLA.z1 + 0.05, 1])));
}

// ---------------------------------------------------------------------------
// People (houses.js peopleOf)
// ---------------------------------------------------------------------------

const woman = (dress, extra) => ({ body: 'f', dress: ['tunic:long:stola', dress], hair: 'bun', ...extra });
const man = (extra) => ({ body: 'm', dress: ['tunic:knee'], hair: 'crop', ...extra });

/** A garden villa person in the house-at-the-back frame, turned with the model in the looks that turn. */
function turned(list, on) {
  return on ? list.map((a) => ({ ...a, at: [a.at[2], a.at[1], -a.at[0]], ry: (a.ry ?? 0) + Math.PI / 2 })) : list;
}

/** The people of the three, by kind and look (houses.js peopleOf, state 'open'). */
export const VILLA_PEOPLE = Object.freeze({
  ins(v, s) {
    const sg = RIGHT[v & 3];
    const [a, b, c] = INSULA.shops.map(([x]) => x * sg);
    const H = INSULA.half;
    return [
      man({ clip: 'count', props: { R: 'coin' }, at: [a, INSULA.floorY ?? 0.06, INSULA.counterZ - 0.33], ry: 0, seed: s, colours: { tunic: DYES.ochre } }),
      man({ clip: 'count', props: { R: 'coin' }, at: [c, 0.06, INSULA.counterZ - 0.33], ry: 0, seed: s + 1, colours: { tunic: DYES.green } }),
      woman('palla', { clip: 'talk', at: [b + 0.4, 0, H + 0.3], ry: Math.PI + 0.3, seed: s + 2, colours: { tunic: DYES.oatmeal, mantle: DYES.woad } }),
      // (On the second floor's balcony where the look has one, else at the stair door.)
      woman('palla', { clip: 'idle', at: INS_LOOKS[v & 3].bal[0] ? [-1.0 * sg, INSULA.floors[0] + 0.07, H + 0.2] : [INSULA.stair * sg - 0.9, 0, H + 0.25], ry: 0.2, seed: s + 3, colours: { tunic: DYES.rose } }),
    ];
  },
  villa(v, s) {
    const sg = RIGHT[v & 3];
    return [
      man({ clip: 'idle', at: [-0.95 * sg, 0.03, VILLA.half + 0.3], ry: 0.2, seed: s, colours: { tunic: DYES.brownWool } }),
      woman('palla', { clip: 'talk', at: [0.6, 0.07, VILLA.court.cz + 0.3], ry: 0.5, seed: s + 1, colours: { tunic: DYES.white, mantle: DYES.madder } }),
      woman('palla', { clip: 'sweep', props: { R: 'broom' }, at: [-0.6, 0.03, -2.0], ry: 0.3, seed: s + 2, colours: { tunic: DYES.undyed } }),
    ];
  },
  gvilla(v, s) {
    const on = GV_LOOKS[v & 3].turn;
    return turned([
      man({ clip: 'sweep', props: { R: 'broom' }, at: [1.0, 0.03, 2.9], ry: 2.2, seed: s, colours: { tunic: DYES.undyed } }),
      woman('palla', { clip: 'talk', at: [-0.7, 0.03, 1.2], ry: 0.9, seed: s + 1, colours: { tunic: DYES.white, mantle: DYES.madder } }),
      woman('palla', { clip: 'idle', at: [2.3, 0.07, 0.35], ry: 0.2, seed: s + 2, colours: { tunic: DYES.rose } }),
    ], on);
  },
});

/** The lamps of the three, by kind (houses.js windowsOf). */
export const VILLA_LAMPS = Object.freeze({ ins: insulaLamps, villa: villaLamps, gvilla: gardenVillaLamps });

/** The builders, merged into houses.js BUILDERS. */
export const VILLA_BUILDERS = Object.freeze({ ins: buildInsula, villa: buildVilla, gvilla: buildGardenVilla });
