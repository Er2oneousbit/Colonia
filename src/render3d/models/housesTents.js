/**
 * models/housesTents.js
 * ----------------------------------------------------------------------------
 * The three poorest homes, what a colony's first settlers lived in, each on
 * one 4 m tile with four looks (houses.js lists them with the rest):
 *
 *   Tent         a settler's tent of undyed wool or hide over a ridge pole on
 *                forked poles, guy ropes to pegs, a flap that is tied back
 *                when the family is in, a ring of stones for the cooking
 *                fire in front with a pot hung on a tripod, a basket or a
 *                bundle beside. Patched, and sagging between its poles, in
 *                some looks. About 2 m at the ridge.
 *   Family Tent  a larger tent in two bays on three poles, a hide awning
 *                stretched out in front on two poles as a porch, a rush mat
 *                under it, a water jar, a second fire, and in one look washing
 *                on a line from a pole to a stake.
 *   Lean-to      poles leant against a ridge beam on two forked posts, roofed
 *                with brush, reed and turf, a wattle wall closing one end, a
 *                doorway with a hide curtain, a low footing of dry stone or
 *                turf, a woodpile and a hearth; in one look a wattle pen with
 *                a pig and its trough. 2.2 m at the beam.
 *
 * Sources: the soldiers' leather tents of Vindolanda and Trajan's Column (the
 * tent's cut and its crossed front poles, castra.js `tent`), the shepherds'
 * and charcoal burners' shelters of Latium that Vitruvius calls the first
 * houses (book 2: forked poles, brush and mud, "like the swallows' nests"),
 * and the wattle and turf huts under the early Palatine. A settler of 300 BC
 * carried wool and hide and cut the rest on the spot, so nothing here is
 * dyed bright and nothing is squared.
 *
 * States, as every home (houses.js): 'open' when people live there (the flap
 * tied back, the curtain drawn aside, embers in the fire, a few people near
 * enough), 'shut' when empty (the flap and the curtain hanging closed, a dead
 * fire). Each look stays inside its tile, the street toward +z.
 * ----------------------------------------------------------------------------
 */

import { BufferGeometry, Float32BufferAttribute } from 'three';
import { boxUV } from '../shapes.js';
import { cyl, staff } from './castra.js';
import { lin, paint } from './rural.js';
import { pot } from './healing.js';
import { buildPig } from './livestock.js';
import { Bag, box, tri, pentRoof } from './houseKit.js';

/** Weathered timber: the wood material is dark, so its colour is pushed light for poles cut green and left to grey. */
const WOOD = 0xf0d8b0;

/** The tent's measures (metres): the ridge runs along z, the flap faces the street. */
export const TENT = Object.freeze({ zf: 0.75, zb: -1.45, hw: 0.95, H: 1.95 });
/** The family tent's: two bays, the awning in front of the flap. */
export const FTENT = Object.freeze({ zf: 0.9, zm: -0.35, zb: -1.6, hw: 1.2, H: 2.0, awningZ: 1.85 });
/** The lean-to's: the beam over the front, the roof falling away to the back. */
export const LEAN = Object.freeze({ x: 1.35, zR: -0.5, zF: 0.62, zB: -1.5, ridgeY: 2.2, eaveY: 1.8, backY: 0.8, plateY: 1.4, doorX0: 0.3, doorX1: 1.2 });

/**
 * The looks of the tent: the cloth, how far it sags, patches ([side, u0, u1, v0, v1, colour] on a slope),
 * the ridge's x, where the fire is and what hangs on it ('pot' on a tripod or 'stones'), what lies beside.
 */
const TENT_LOOKS = [
  { cx: 0.1, col: 0xe6d2a4, sag: 0.07, patches: [], fire: [0.1, 1.45], pot: true, extra: ['basket'], sg: 1 },
  { cx: -0.1, col: 0x96704a, sag: 0.13, patches: [[1, 0.2, 0.6, 0.15, 0.7, 0xb59a6a], [-1, 0.55, 0.85, 0.3, 0.8, 0xe9d9ae]], fire: [-0.2, 1.42], pot: false, extra: ['bundle'], sg: -1 },
  { cx: 0.15, col: 0xdcc596, sag: 0.1, patches: [[-1, 0.3, 0.7, 0.2, 0.65, 0x9a8052]], fire: [0.25, 1.42], pot: true, extra: ['sack', 'logs'], sg: 1 },
  { cx: -0.15, col: 0xa28558, sag: 0.05, patches: [[1, 0.6, 0.9, 0.4, 0.85, 0xe4d3a8]], fire: [-0.1, 1.46], pot: true, extra: ['jar'], sg: -1 },
];

/** The family tent's looks: the two bays' cloth, the awning's, the washing, the fire's side. */
const FTENT_LOOKS = [
  { bays: [0xe4d1a2, 0xdcc698], awning: 0x8a6a48, sag: 0.08, line: false, fire: [1.5, 1.35], jar: -1.35, logs: false, sg: 1 },
  { bays: [0x9b7248, 0x8a6540], awning: 0xcfc3a3, sag: 0.12, line: false, fire: [-1.5, 1.3], jar: 1.35, logs: true, sg: -1 },
  { bays: [0xdfc999, 0xc4aa78], awning: 0x7a5c3e, sag: 0.1, line: true, fire: [1.5, 1.3], jar: 1.35, logs: false, sg: 1 },
  { bays: [0xc4aa78, 0xe4d1a2], awning: 0xa48a62, sag: 0.09, line: false, fire: [-1.5, 1.35], jar: -1.35, logs: true, sg: -1 },
];

/** The lean-to's looks: the roof ('thatch' or 'turf'), the footing, the wattle's tone, what stands about. */
const LEAN_LOOKS = [
  { roof: 'thatch', foot: 'stone', wattle: 0xd4b676, extra: ['wood', 'jar'] },
  { roof: 'turf', foot: 'turf', wattle: 0xb8965a, extra: ['basket', 'sack'] },
  { roof: 'thatch', foot: 'stone', wattle: 0xdcc084, extra: ['wood', 'rack'] },
  { roof: 'turf', foot: 'stone', wattle: 0xc4a468, extra: ['pen', 'jar'] },
];
/** The lean-to's hearth (x, z) and the stump a man sits on. */
const LEAN_HEARTH = Object.freeze([-0.1, 1.5]);

// ---------------------------------------------------------------------------
// Cloth, poles and ropes
// ---------------------------------------------------------------------------

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** How many cells a sheet is cut into, by level of detail: [along, across]. */
const CUT = [[8, 5], [4, 3], [1, 1]];

/**
 * A sheet of cloth stretched over four corners (A, B along its top edge, D, C below them), hanging
 * `sag` metres in the middle (nothing at the edges, so it never dips into the ground) and rippling
 * in z by `wave` when it hangs in folds. Returns the point at (u, v).
 */
function surface(A, B, C, D, { sag = 0, wave = 0 } = {}) {
  return (u, v) => {
    const p = lerp3(lerp3(A, B, u), lerp3(D, C, u), v);
    p[1] -= sag * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
    p[2] += wave * Math.sin(u * Math.PI * 6) * Math.sin(Math.PI * v) ;
    return p;
  };
}

/** The part (u0..u1, v0..v1) of a surface as a cloth mesh in colour `col`, lifted `lift` m (a patch over the roof). */
function sheet(at, lod, { u0 = 0, u1 = 1, v0 = 0, v1 = 1, col, lift = 0, cut = null, up = false }) {
  const [nu, nv] = cut || CUT[lod];
  const pos = [];
  const idx = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const p = at(u0 + ((u1 - u0) * i) / nu, v0 + ((v1 - v0) * j) / nv);
      pos.push(p[0], p[1] + lift, p[2]);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      idx.push(a, a + 1, a + nu + 2, a, a + nu + 2, a + nu + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // (A one-sided sheet, sods or reed, faces up: turned over when it was cut the other way about.)
  if (up && g.attributes.normal.getY(0) < 0) { g.setIndex(idx.map((w, i) => idx[i - (i % 3 === 1 ? -1 : i % 3 === 2 ? 1 : 0)])); g.computeVertexNormals(); }
  boxUV(g);
  // (The weave's mottling: a patchy tone, as hand-spun wool has.)
  return paint(g, lin(col), (x, y, z) => 0.88 + 0.12 * Math.sin(x * 9 + z * 7 + y * 3));
}

/** A pole between two points, in weathered wood. */
const pole = (a, b, r = 0.04, k = 0.9, tone = WOOD) => paint(staff(a, b, r, 5), lin(tone, k));
/** A rope between two points (close up only: it is a hair far out). */
const rope = (a, b) => paint(staff(a, b, 0.011, 3), lin(0xb59f78, 0.9));
/** A peg in the ground. */
const peg = (x, z) => cyl(0.028, 0.02, 0.14, 4, x, 0, z, lin(WOOD, 0.8));

/** Two crossed poles carrying the ridge pole at an end of a tent: they meet a hand above the ridge. */
function crossPoles(bag, cx, z, hw, H) {
  if (bag.lod === 2) return;
  for (const s of [-1, 1]) bag.add('wood', pole([cx - s * hw * 0.55, 0.03, z], [cx + s * 0.05, H + 0.14, z], 0.034));
}

/** A forked pole: a stem with a short crotch pair at its head, standing at (x, z). */
function forkPole(bag, x, z, h, r = 0.05) {
  bag.add('wood', pole([x, 0, z], [x, h, z], r, 0.85));
  if (bag.lod < 2) for (const s of [-1, 1]) bag.add('wood', pole([x, h - 0.18, z], [x + s * 0.11, h + 0.1, z], r * 0.7, 0.85));
}

/** A log lying from (x0, z0) to (x1, z1), r thick, on the ground. */
const logAt = (x0, z0, x1, z1, y = 0.07, r = 0.07, k = 0.85) => paint(staff([x0, y, z0], [x1, y, z1], r, 5), lin(0xe6c690, k));

/** A pile of logs lying along z at x, from z0 to z1: `n` on the ground, a row less on each above. */
function pile(bag, x, z0, z1, n = 3) {
  for (let r = 0; r < n; r++) {
    for (let i = 0; i < n - r; i++) bag.add('wood', logAt(x + (i - (n - r - 1) / 2) * 0.15, z0, x + (i - (n - r - 1) / 2) * 0.15, z1, 0.065 + r * 0.12, 0.065, 0.78 + 0.06 * ((i + r) % 3)));
  }
}

/** A basket: a rim and a woven belly of wicker brown. */
const basketAt = (x, z, r = 0.22, h = 0.28) => cyl(r, r * 0.78, h, 8, x, 0, z, lin(0xb08850));

// ---------------------------------------------------------------------------
// The cooking fire
// ---------------------------------------------------------------------------

/**
 * A ring of fieldstones on trodden earth at (x, z) with a dead bed of ash and, while the family is in
 * ('emberOpen'), glowing coals; `tripod` hangs a pot over it from three poles.
 */
function fire(bag, x, z, { r = 0.25, tripod = false, withPot = true } = {}) {
  const lod = bag.lod;
  bag.add('dark', cyl(r * 0.88, r * 0.88, 0.02, lod ? 5 : 9, x, 0, z));
  if (lod < 2) {
    const n = lod ? 6 : 9;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + bag.rnd() * 0.2;
      const g = box(0.13, 0.1, 0.1, 0, 0, 0, lin(0x8d877b, 0.75 + bag.rnd() * 0.3));
      g.rotateY(-a);
      g.translate(x + Math.cos(a) * r, 0, z + Math.sin(a) * r);
      bag.add('stone', g);
    }
  }
  if (lod === 0) {
    for (const [dx, dz, s] of [[0, 0, 0.07], [0.07, -0.04, 0.05], [-0.06, 0.05, 0.05]]) bag.add('emberOpen', box(s, 0.05, s, x + dx, 0.02, z + dz, lin(0xff7a2e)));
    for (const [dx, dz, a] of [[0.0, 0.1, 0.5], [-0.09, -0.04, 2.2]]) bag.add('wood', logAt(x + dx - 0.1 * Math.cos(a), z + dz - 0.1 * Math.sin(a), x + dx + 0.1 * Math.cos(a), z + dz + 0.1 * Math.sin(a), 0.07, 0.03, 0.5));
  }
  if (!tripod) return;
  // Three poles meeting over the fire, the pot on a cord from the crossing. Their feet straddle the cook's place.
  const apex = [x, 1.12, z];
  if (lod < 2) for (const a of [-0.5, 2.6, 4.7]) bag.add('wood', pole([x + Math.cos(a) * 0.36, 0.03, z + Math.sin(a) * 0.36], apex, 0.02, 0.85));
  if (withPot) {
    bag.add('clay', pot('jar', x, 0.52, z, 0.3, lod, 0.7));
    if (lod === 0) bag.add('rope', rope(apex, [x, 0.82, z]));
  }
}

// ---------------------------------------------------------------------------
// The ridge tent (the tent and each bay of the family tent)
// ---------------------------------------------------------------------------

/**
 * The cloth of a ridge tent whose ridge (at x = cx, height H) runs along z, in bays: [{ zf, zb, col }] from the
 * front to the back. `open` is how much of the front the flap leaves free, as a share of the half width (0.3).
 * The slopes sag between their poles, the front's flap hangs closed while the home is empty and is tied back to
 * the sides while it is lived in.
 */
function ridgeTent(bag, { cx, hw, H, bays, sag, patches = [], door = 0.3 }) {
  const lod = bag.lod;
  const e = 0.05;
  const zf = bays[0].zf;
  const zb = bays[bays.length - 1].zb;
  bays.forEach((bay, i) => {
    for (const s of [1, -1]) {
      const at = surface([cx, H, bay.zf], [cx, H, bay.zb], [cx + s * hw, e, bay.zb], [cx + s * hw, e, bay.zf], { sag });
      bag.add('cloth', sheet(at, lod, { col: bay.col }));
      if (i === 0) for (const [side, u0, u1, v0, v1, c] of patches) if (side === s && lod < 2) bag.add('cloth', sheet(at, lod, { u0, u1, v0, v1, col: c, lift: 0.014 }));
    }
  });
  // The back is closed by a gable of cloth; the front has the flap.
  const back = bays[bays.length - 1].col;
  bag.add('cloth', tri([cx - hw, e, zb], [cx + hw, e, zb], [cx, H, zb], [0, 0, -1], lin(back, 0.9)));
  const dk = door * hw;
  const front = (a, b, c, tone, key) => bag.add(key, tri(a, b, c, [0, 0, 1], lin(bays[0].col, tone)));
  if (lod < 2) bag.add('dark', tri([cx - dk, e, zf - 0.03], [cx + dk, e, zf - 0.03], [cx, H, zf - 0.03], [0, 0, 1], [0, 0, 0]));
  // Lived in: two flaps, one each side of a doorway as wide as `door`. Empty: one cloth across the front.
  front([cx - hw, e, zf + 0.004], [cx - dk, e, zf + 0.004], [cx, H, zf + 0.004], 0.92, 'clothOpen');
  front([cx + dk, e, zf + 0.004], [cx + hw, e, zf + 0.004], [cx, H, zf + 0.004], 0.92, 'clothOpen');
  front([cx - hw, e, zf + 0.012], [cx + hw, e, zf + 0.012], [cx, H, zf + 0.012], 0.8, 'clothShut');
  // The ridge pole rests in the crossings of the end poles and shows beyond the cloth.
  bag.add('wood', pole([cx, H + 0.03, zb - 0.3], [cx, H + 0.03, zf + 0.32], 0.036, 0.9));
  crossPoles(bag, cx, zf + 0.05, hw, H);
  crossPoles(bag, cx, zb - 0.05, hw, H);
  if (lod === 0) {
    // The flaps' ties, and the guy ropes to pegs.
    for (const s of [-1, 1]) bag.add('rope', rope([cx + s * dk, 0.25, zf + 0.03], [cx + s * (dk + 0.18), 0.25, zf + 0.12]));
    const ends = [[zf + 0.32, zf + 0.8, 1], [zb - 0.3, Math.max(zb - 0.45, -1.95), -1]];
    for (const [za, zp] of ends) for (const s of [-1, 1]) {
      const px = cx + s * (za > 0 ? 0.9 : 0.35);
      bag.add('rope', rope([cx, H + 0.03, za], [px, 0.05, zp]));
      bag.add('wood', peg(px, zp));
    }
    for (const bay of bays) {
      const zm = (bay.zf + bay.zb) / 2;
      for (const s of [-1, 1]) {
        bag.add('rope', rope([cx + s * hw * 0.92, 0.18, zm], [cx + s * (hw + 0.4), 0.05, zm]));
        bag.add('wood', peg(cx + s * (hw + 0.4), zm));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tent
// ---------------------------------------------------------------------------

/** A tent, its look `v` (0 to 3), at a level of detail. */
export function buildTent(v = 0, lod = 0) {
  const L = TENT_LOOKS[v & 3];
  const bag = new Bag(`tent${v}`, lod, 851 + v * 11);
  const { zf, zb, hw, H } = TENT;
  bag.add('earth', box(3.6, 0.03, 3.6, 0, 0, -0.02, lin(0xa89574, 0.9)));
  ridgeTent(bag, { cx: L.cx, hw, H, bays: [{ zf, zb, col: L.col }], sag: L.sag, patches: L.patches });
  fire(bag, L.fire[0], L.fire[1], { tripod: L.pot, withPot: true });
  const sg = L.sg;
  for (const e of L.extra) {
    if (e === 'basket') bag.add('clay', basketAt(L.cx + hw + 0.45, zf + 0.15));
    else if (e === 'bundle' && lod < 2) {
      // A bedroll of blankets bound with cord, beside the flap.
      bag.add('cloth', box(0.55, 0.2, 0.32, L.cx + sg * (hw + 0.1), 0, zf + 0.5, lin(0xb9a885)));
      if (lod === 0) bag.add('rope', box(0.03, 0.22, 0.34, L.cx + sg * (hw + 0.1) - 0.1, 0, zf + 0.5, lin(0x7a6a48)), box(0.03, 0.22, 0.34, L.cx + sg * (hw + 0.1) + 0.1, 0, zf + 0.5, lin(0x7a6a48)));
    } else if (e === 'sack' && lod < 2) bag.add('cloth', cyl(0.17, 0.23, 0.46, 7, L.cx - hw - 0.35, 0, zf - 0.2, lin(0xc2a477)));
    else if (e === 'logs' && lod < 2) pile(bag, L.cx + hw + 0.5, zf - 0.6, zf + 0.2, 2);
    else if (e === 'jar') bag.add('clay', pot('amph', L.cx + hw + 0.4, 0.02, zf + 0.3, 0.55, lod, 0.9));
  }
  if (lod < 2) {
    // A log to sit on, by the fire on the side the family sits.
    bag.add('wood', cyl(0.17, 0.19, 0.4, 7, L.fire[0] - sg * 0.85, 0, L.fire[1] + 0.12, lin(0xe6c690, 0.85)));
  }
  return Object.assign(bag.build(), { fire: L.fire });
}

// ---------------------------------------------------------------------------
// Family tent
// ---------------------------------------------------------------------------

/** A family tent, its look `v` (0 to 3). */
export function buildFamilyTent(v = 0, lod = 0) {
  const L = FTENT_LOOKS[v & 3];
  const bag = new Bag(`ftent${v}`, lod, 871 + v * 11);
  const { zf, zm, zb, hw, H, awningZ } = FTENT;
  bag.add('earth', box(3.6, 0.03, 3.6, 0, 0, -0.02, lin(0xa89574, 0.9)));
  ridgeTent(bag, {
    cx: 0, hw, H, door: 0.32, sag: L.sag,
    bays: [{ zf, zb: zm, col: L.bays[0] }, { zf: zm, zb, col: L.bays[1] }],
    patches: v === 1 ? [[1, 0.3, 0.75, 0.2, 0.7, 0xa59470]] : v === 3 ? [[-1, 0.2, 0.6, 0.25, 0.75, 0xcfc2a2]] : [],
  });
  // The middle pole's head shows a hand above the seam between the bays.
  if (lod < 2) bag.add('wood', pole([0, H - 0.02, zm], [0, H + 0.14, zm], 0.038));
  // The awning: a hide stretched from a batten at the front of the ridge out on two poles, the porch.
  const top = H - 0.2;
  const batten = 0.55;
  const low = 1.22;
  const aw = surface([-batten, top, zf + 0.06], [batten, top, zf + 0.06], [1.15, low, awningZ], [-1.15, low, awningZ], { sag: L.sag });
  bag.add('cloth', sheet(aw, lod, { col: L.awning, cut: lod === 0 ? [6, 5] : lod === 1 ? [3, 3] : [1, 1] }));
  for (const x of [-1.15, 1.15]) bag.add('wood', pole([x, 0, awningZ], [x, low + 0.06, awningZ], 0.045, 0.85));
  if (lod < 2) bag.add('wood', pole([-batten - 0.04, top + 0.01, zf + 0.06], [batten + 0.04, top + 0.01, zf + 0.06], 0.03, 0.85));
  if (lod === 0) {
    for (const s of [-1, 1]) {
      bag.add('rope', rope([s * 1.15, low + 0.04, awningZ], [s * 1.5, 0.05, awningZ + 0.05]));
      bag.add('wood', peg(s * 1.5, awningZ + 0.05));
    }
  }
  // Under it, a mat of rushes, and a water jar by the pole.
  bag.add('wicker', box(1.5, 0.03, 0.8, 0, 0.015, zf + 0.5, lin(0xb9a064)));
  bag.add('clay', pot('amph', L.jar, 0.02, awningZ - 0.35, 0.62, lod, 0.9));
  fire(bag, L.fire[0], L.fire[1], { r: 0.23, tripod: false });
  if (lod < 2) bag.add('clay', pot('jar', L.fire[0], 0.06, L.fire[1], 0.26, lod, 0.7));
  if (L.logs && lod < 2) pile(bag, L.sg * 1.74, -0.7, -0.05, 2);
  if (lod < 2) bag.add('wood', cyl(0.17, 0.19, 0.4, 7, L.fire[0] - L.sg * 0.8, 0, L.fire[1] + 0.1, lin(0xe6c690, 0.85)));
  if (L.line && lod < 2) {
    // Washing: a line from the awning pole to a stake, two cloths pegged on it.
    const a = [-1.15, low - 0.05, awningZ];
    const b = [-1.8, 0.95, 0.75];
    bag.add('wood', pole([b[0], 0, b[2]], [b[0], b[1] + 0.05, b[2]], 0.03, 0.85));
    bag.add('rope', rope(a, b));
    let k = 0;
    for (const [t0, t1, c] of [[0.2, 0.42, 0xe2d8bd], [0.55, 0.78, 0xb04a38]]) {
      const p0 = lerp3(a, b, t0);
      const p1 = lerp3(a, b, t1);
      const cl = surface(p0, p1, [p1[0], p1[1] - 0.52, p1[2]], [p0[0], p0[1] - 0.52, p0[2]], { sag: 0.02, wave: 0.03 });
      bag.add('cloth', sheet(cl, lod, { col: c, cut: [3, 3] }));
      k++;
    }
  }
  return Object.assign(bag.build(), { fire: L.fire });
}

// ---------------------------------------------------------------------------
// Lean-to
// ---------------------------------------------------------------------------

/** The roof's top at z: the shallow front slope from the ridge down to the eave, the steep back one down to the bank. */
function roofAt(z) {
  const { zR, zF, zB, ridgeY, eaveY, backY } = LEAN;
  return z >= zR ? ridgeY - ((z - zR) / (zF + 0.08 - zR)) * (ridgeY - eaveY) : ridgeY - ((zR - z) / (zR - zB)) * (ridgeY - backY);
}

/** A flat polygon in the plane x = X over the points (z, y), given round its edge, facing `out` (+1 or -1) along x. */
function endWall(X, pts, col, out) {
  const g = new BufferGeometry();
  const pos = [];
  for (const [z, y] of pts) pos.push(X, y, z);
  const idx = [];
  for (let i = 1; i < pts.length - 1; i++) idx.push(0, i, i + 1);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (g.attributes.normal.getX(0) * out < 0) { g.setIndex(idx.map((v, i) => idx[i - (i % 3 === 1 ? -1 : i % 3 === 2 ? 1 : 0)])); g.computeVertexNormals(); }
  boxUV(g);
  return paint(g, col);
}

/**
 * One slope of the roof from its high edge (zHigh, yHigh) to its low one, over x = -x..x: reed (the kit's thatch)
 * or sods (a lumpy sheet of grass gone brown, thick at its edge so it is not a sheet of paper).
 */
function roofSlope(bag, kind, zHigh, yHigh, zLow, yLow, over = 0.2) {
  const x = LEAN.x;
  if (kind === 'thatch') {
    pentRoof(bag, { x0: -x, x1: x, zHigh, zLow, yHigh, yLow, over, kind: 'thatch' });
    return;
  }
  const dz = Math.sign(zLow - zHigh);
  const s = (yLow - yHigh) / (zLow - zHigh);
  const zl = zLow + dz * over;
  const yl = yLow + s * dz * over;
  const at = surface([-x - over, yHigh, zHigh], [x + over, yHigh, zHigh], [x + over, yl, zl], [-x - over, yl, zl], {});
  const turf = sheet(at, bag.lod, { col: 0x8a9a52, cut: bag.lod === 0 ? [8, 5] : bag.lod === 1 ? [4, 3] : [1, 1], up: true });
  // (A turf roof is lumpy: the sods' own tops, a hair either way, the edges left true.)
  const p = turf.attributes.position;
  if (bag.lod < 2) {
    for (let i = 0; i < p.count; i++) {
      const inner = Math.abs(p.getZ(i) - zHigh) > 0.02 && Math.abs(p.getZ(i) - zl) > 0.02 && Math.abs(Math.abs(p.getX(i)) - x - over) > 0.02;
      if (inner) p.setY(i, p.getY(i) + (bag.rnd() - 0.5) * 0.06);
    }
  }
  turf.computeVertexNormals();
  bag.add('earth', turf);
  if (bag.lod < 2) bag.add('earth', box(2 * (x + over), 0.16, 0.14, 0, yl - 0.14, zl, lin(0x6a5a3a, 0.9)));
}

/** A lean-to, its look `v` (0 to 3). */
export function buildLeanTo(v = 0, lod = 0) {
  const L = LEAN_LOOKS[v & 3];
  const bag = new Bag(`lean${v}`, lod, 891 + v * 11);
  const { x, zR, zF, zB, ridgeY, eaveY, backY, plateY, doorX0, doorX1 } = LEAN;
  const wattle = lin(L.wattle);
  bag.add('earth', box(3.6, 0.03, 3.6, 0, 0, -0.02, lin(0xa89574, 0.9)));
  // The roof: poles leant against the ridge beam, a shallow slope forward to the front wall and a short steep one
  // behind to the ground, laid with brush and reed, or with sods. The street sees the front slope.
  roofSlope(bag, L.roof, zR, ridgeY, zF + 0.08, eaveY);
  roofSlope(bag, L.roof, zR, ridgeY, zB, backY);
  if (lod < 2) bag.add(L.roof === 'thatch' ? 'thatch' : 'earth', paint(staff([-x - 0.15, ridgeY + 0.02, zR], [x + 0.15, ridgeY + 0.02, zR], 0.1, 6), lin(L.roof === 'thatch' ? 0xb59a60 : 0x6a7440, 0.85)));
  // The ridge beam on its two forked posts, its ends showing past the roof.
  if (lod < 2) {
    bag.add('wood', pole([-x - 0.28, ridgeY - 0.1, zR], [x + 0.28, ridgeY - 0.1, zR], 0.07, 0.9));
    for (const px of [-x - 0.2, x + 0.2]) forkPole(bag, px, zR, ridgeY - 0.2, 0.06);
  }
  // Wattle closes the -x end; the +x end is a bank of turf and stone, the dark of the hearth's smoke gap above it.
  const edge = (z) => roofAt(z) - 0.12;
  const poly = [[zF, 0], [zB, 0], [zB, edge(zB)], [zR, edge(zR)], [zF, edge(zF)]];
  bag.add('wicker', endWall(-x, poly, wattle, -1));
  bag.add('dark', endWall(x - 0.02, poly, [0, 0, 0], 1));
  bag.add('earth', box(0.3, 0.72, zF - zB - 0.1, x, 0, (zF + zB) / 2 - 0.05, lin(0x7a6a46, 0.9)));
  if (L.foot === 'stone' && lod < 2) bag.add('stone', box(0.34, 0.2, zF - zB - 0.3, x + 0.1, 0.72, (zF + zB) / 2 - 0.1, lin(0x9a9284, 0.85)));
  // The back is low to the ground: a bank of earth against it.
  if (lod < 2) bag.add('earth', box(2 * x + 0.1, 0.34, 0.3, 0, 0, zB + 0.05, lin(0x7a6a46, 0.9)));
  // The front: forked posts under a plate, a wattle wall on the left, the low doorway on the right.
  for (const px of [-x, doorX1 + 0.08]) forkPole(bag, px, zF, plateY - 0.05, 0.065);
  bag.add('wood', pole([-x - 0.1, plateY + 0.02, zF], [doorX1 + 0.2, plateY + 0.02, zF], 0.07, 0.9));
  const wallX0 = -x + 0.06;
  const wallX1 = doorX0 - 0.02;
  bag.add('wicker', box(wallX1 - wallX0, plateY - 0.02, 0.09, (wallX0 + wallX1) / 2, 0, zF, wattle));
  if (lod === 0) for (let sx = wallX0 + 0.1; sx < wallX1; sx += 0.26) bag.add('wood', cyl(0.025, 0.025, plateY - 0.04, 4, sx, 0, zF + 0.055, lin(WOOD, 0.7)));
  // The footing of the front, on the side that holds the wattle: dry stone, or a bank of turf.
  const fw = wallX1 - wallX0 + 0.1;
  bag.add(L.foot === 'stone' ? 'stone' : 'earth', box(fw, L.foot === 'stone' ? 0.28 : 0.26, 0.3, (wallX0 + wallX1) / 2, 0, zF + 0.08, L.foot === 'stone' ? lin(0x9a9284, 0.85) : lin(0x84945a, 0.9)));
  // The dark of the doorway, and the hide curtain: drawn aside to the post while lived in, hanging across when empty.
  bag.add('dark', box(doorX1 - doorX0, plateY - 0.02, 0.05, (doorX0 + doorX1) / 2, 0, zF - 0.28));
  const hide = 0x7d5c3d;
  const cur = (x0, x1) => surface([x0, plateY - 0.04, zF + 0.05], [x1, plateY - 0.04, zF + 0.05], [x1, 0.06, zF + 0.05], [x0, 0.06, zF + 0.05], { wave: 0.035 });
  bag.add('clothShut', sheet(cur(doorX0, doorX1), lod, { col: hide, cut: lod === 0 ? [6, 5] : lod === 1 ? [3, 3] : [1, 1] }));
  bag.add('clothOpen', sheet(cur(doorX1 - 0.3, doorX1 + 0.02), lod, { col: hide, cut: lod === 0 ? [3, 5] : [2, 2] }));
  // The hearth in the yard.
  const [hx, hz] = LEAN_HEARTH;
  fire(bag, hx, hz, { r: 0.22 });
  if (lod < 2) bag.add('clay', pot('jar', hx, 0.06, hz, 0.24, lod, 0.7));
  for (const e of L.extra) {
    if (e === 'wood' && lod < 2) pile(bag, 1.72, -0.75, 0.1, lod ? 2 : 3);
    else if (e === 'jar') bag.add('clay', pot('amph', 1.65, 0.02, 1.35, 0.6, lod, 0.9));
    else if (e === 'basket') bag.add('clay', basketAt(1.7, 1.3));
    else if (e === 'sack' && lod < 2) bag.add('cloth', cyl(0.17, 0.23, 0.46, 7, 1.62, 0, 0.75, lin(0xc2a477)));
    else if (e === 'rack' && lod < 2) {
      // A frame of two posts and a rail with a hide stretched to dry.
      for (const px of [-1.75, -0.95]) bag.add('wood', pole([px, 0, 1.5], [px, 1.25, 1.5], 0.045, 0.85));
      bag.add('wood', pole([-1.8, 1.2, 1.5], [-0.9, 1.2, 1.5], 0.035, 0.85));
      bag.add('cloth', sheet(surface([-1.65, 1.15, 1.5], [-1.05, 1.15, 1.5], [-1.07, 0.5, 1.5], [-1.63, 0.5, 1.5], { wave: 0.02 }), lod, { col: 0x9a7a52, cut: [3, 3] }));
    } else if (e === 'pen') penAt(bag, L);
  }
  // A stump to sit on, by the hearth.
  if (lod < 2) bag.add('wood', cyl(0.17, 0.19, 0.4, 7, hx + 0.75, 0, hz + 0.04, lin(0xe6c690, 0.85)));
  return bag.build();
}

/** The pen of woven hurdles at the left of the yard: a pig in it (a trough beside, and the mud it rooted). */
function penAt(bag, L) {
  const [x0, x1, z0, z1] = [-1.9, -0.72, 1.0, 1.88];
  const col = lin(L.wattle, 0.9);
  const h = 0.72;
  bag.add('earth', box(x1 - x0 - 0.1, 0.034, z1 - z0 - 0.1, (x0 + x1) / 2, 0, (z0 + z1) / 2, lin(0x6e5c40, 0.8)));
  // (Far out the pen is its mud and one low rail along the street; the pig and the trough are a pixel.)
  if (bag.lod === 2) {
    bag.add('wicker', box(x1 - x0, h, 0.06, (x0 + x1) / 2, 0, z1, col));
    return;
  }
  for (const [a, b, c, d] of [[x0, x1, z1 - 0.03, z1 + 0.03], [x0, x1, z0 - 0.03, z0 + 0.03], [x0 - 0.03, x0 + 0.03, z0, z1], [x1 - 0.03, x1 + 0.03, z0, z1]]) bag.add('wicker', box(b - a, h, d - c, (a + b) / 2, 0, (c + d) / 2, col));
  if (bag.lod === 0) for (const px of [x0, (x0 + x1) / 2, x1]) for (const pz of [z0, z1]) bag.add('wood', cyl(0.04, 0.035, h + 0.2, 5, px, 0, pz, lin(WOOD, 0.8)));
  // The trough: a hollowed log on the street side of the pen.
  if (bag.lod < 2) bag.add('wood', box(0.55, 0.14, 0.2, x1 - 0.42, 0, z1 - 0.2, lin(WOOD, 0.8)), box(0.45, 0.02, 0.1, x1 - 0.42, 0.14, z1 - 0.2, lin(0x3a2c22)));
  const pig = buildPig({ coat: 1, pose: 'root', lod: bag.lod });
  pig.group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.rotateY(Math.PI / 2);
    g.scale(0.8, 0.8, 0.8);
    g.translate(-1.3, 0.0, 1.35);
    bag.add('hide', g);
  });
}

/** Lit window-like places for night: the hearth's glow at the front. */
export const TENT_LAMPS = Object.freeze(TENT_LOOKS.map((l) => Object.freeze([l.fire[0], 0.45, l.fire[1], 1])));
export const FTENT_LAMPS = Object.freeze(FTENT_LOOKS.map((l) => Object.freeze([l.fire[0], 0.4, l.fire[1], 1])));
export const LEAN_LAMPS = Object.freeze(LEAN_LOOKS.map(() => Object.freeze([(LEAN.doorX0 + LEAN.doorX1) / 2, 0.9, LEAN.zF + 0.1, 1])));

export { TENT_LOOKS, FTENT_LOOKS, LEAN_LOOKS, LEAN_HEARTH };
