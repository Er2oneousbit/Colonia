/**
 * models/castraPalisade.js
 * ----------------------------------------------------------------------------
 * The rampart the three forts share: a camp of the Republic, earth and
 * timber, and nothing like the town wall's stone curtain (townWall.js, a
 * wall of 5 m with a walk at 3.6 m).
 *
 * The record. Polybius (book 6, 27 to 32) describes the camp the legions
 * dug at every halt: a ditch (fossa), the earth thrown up inside it into a
 * bank (agger), and on the bank a palisade of stakes (sudes, the vallum),
 * each soldier carrying two or three of them on the march; the camp had
 * four gates, a street (via principalis) across it, and between the tents
 * and the bank an empty strip, the intervallum, so that missiles and fire
 * thrown from outside fell short of the men's quarters. The Republic's own
 * camps are known from the siege camps round Numantia in Spain
 * (Renieblas, Peña Redonda, Castillejo: 2nd century BC), a rectangle of
 * bank and ditch with a gate in each side, and from the turf and timber
 * forts that followed them. In a standing camp the gate got a timber tower
 * (as the forts of the first century AD show in their post holes) and the
 * corners a platform for a watch.
 *
 * What is here, on the 3 x 3 footprint (12 m), in metres, in the frame of
 * the front side (along x, the outside toward +z) turned onto the others by
 * quarter turns (onSide):
 *   - the bank 1.2 m high, steep on both faces and turf-faced, its crest a
 *     trodden walk behind the stakes, its four corners filled in
 *   - the palisade on the crest's outer edge, the stakes sharpened and
 *     their tops cut to uneven heights about 2.5 m over the ground, bound
 *     by two rails along the inside
 *   - the ditch outside, a dark channel (the model cannot sink the
 *     ground) behind a low counterscarp, broken by a causeway at the gate
 *   - a watch platform on four posts at each corner, its deck 2.0 m up,
 *     a ladder to it, the palisade for its outer rail
 *   - the gate in the front: a tower of timber on four posts over the
 *     passage (deck 2.75 m, roof of boards, 4.8 m to its top), plank doors,
 *     a painted board over it, the bank's ends faced with planks
 *   - a trodden strip along the inside of the bank (the intervallum)
 *
 * The game's own constraint (castra.js): the camera hides ground up to 1.7
 * times the height of whatever stands between it and the ground, so a man
 * near a side hides behind a tall palisade; each fort sets `stake` as high
 * as its men's places in the yard (data/units.js FORT_YARD) allow, the
 * legion's 2.5 m, the others lower where their men stand nearer the wall
 * (tests/military3d.test.mjs yardHidden checks every spot from every corner).
 * The gate tower is left out of the click cover (TaggedParts `cover: false`):
 * the cover is a box as high as the model, and one slim tower would make it
 * 4.8 m over the whole footprint and hide the men in the yard from clicks.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, ConeGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { artRng } from '../texgen.js';
import { paving } from './masonry.js';
import { lin } from './rural.js';
import { CASTRA, box, prism, outward, onSide, mirrorX, fortBag, pour, inscribe, D } from './castra.js';

/** The rampart's measures (metres): the models, the sentries and the tests read them. */
export const CAMP = Object.freeze({
  /** The bank's height, its inner face (z) and where its crest ends outside. */
  bank: 1.2,
  inner: 4.75,
  crestOut: 5.32,
  /** The bank's outer toe, the ditch's outer edge, the counterscarp's outer edge (the footprint's, 6 m, less a little). */
  toe: 5.64,
  ditchOut: 5.9,
  edge: 5.98,
  /** The stakes' row (its middle) and radius; the default height of their tops over the ground. */
  stakeZ: 5.22,
  stakeR: 0.085,
  stake: 2.5,
  /** The crest's walk: where a sentry stands (y, z). */
  walkY: 1.23,
  walkZ: 4.94,
  /** A corner platform's deck. */
  deck: 2.0,
  /** The gate tower: its deck, the underside of its lintel, its posts' tops, its roof's top, the doors' height, its depth (z0 to z1) and the posts' half width. */
  gate: Object.freeze({ deck: 2.75, lintel: 2.12, post: 4.5, top: 4.8, door: 2.0, z0: 4.7, z1: 5.45, half: CASTRA.gateHalf + 0.2 }),
});

const K = CAMP;

/** Turves in courses: a vertex colour banding the bank every 0.16 m, each course its own green or brown, the joints darker. */
export function turfCourses(x, y, z) {
  const c = Math.floor(y / 0.16);
  const k = ((c * 0.618 + Math.floor((x + z) / 0.42) * 0.31) % 1);
  const j = Math.abs(y / 0.16 - c - 0.5) > 0.42 ? 0.78 : 1;
  return (1.0 + 0.25 * k) * j;
}

/** A squared timber from a to b, `w` square (a plain box, cheap). */
export function timberBeam(a, b, w) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const g = new BoxGeometry(w, len, w);
  g.translate(0, len / 2, 0);
  g.rotateX(Math.acos(Math.max(-1, Math.min(1, dy / len))));
  g.rotateY(Math.atan2(dx, dz));
  g.translate(a[0], a[1], a[2]);
  return tintGeometry(boxUV(g), () => 0.8);
}

/** A post: w square from the ground (or `y0`) up to `h`, darker at its foot. */
function post(w, h, x, z, y0 = 0) {
  return box(w, h - y0, w, x, y0, z, (gx, gy) => 0.7 + 0.3 * Math.min(1, gy / 0.5));
}

// ---------------------------------------------------------------------------
// The bank and the ditch
// ---------------------------------------------------------------------------

/** One run of the bank on the front side, from x a0 to a1: turf-faced, steep inside and out, the crest trodden. */
function bankRun(a0, a1, { lod, out }) {
  const sec = [[K.inner, 0], [K.toe, 0], [K.crestOut, K.bank], [K.inner, K.bank]];
  out.turf.push(prism(a0, a1, sec, lod === 2 ? (x, y) => 0.85 + 0.15 * Math.min(1, y / K.bank) : turfCourses));
  // The trodden crest between the inner face and the stakes.
  if (lod < 2) out.earth.push(box(a1 - a0, 0.04, K.stakeZ - K.stakeR - K.inner, (a0 + a1) / 2, K.bank - 0.01, (K.inner + K.stakeZ - K.stakeR) / 2, 0.8));
}

/** A corner of the bank, front-right: the two runs' faces meeting in a hip (a frustum, its inner faces upright). */
function bankCorner(lod, out) {
  const a = K.inner;
  const t = K.crestOut;
  const b = K.toe;
  const h = K.bank;
  const P = (x, y, z) => [x, y, z];
  const quads = [
    [P(a, 0, a), P(b, 0, a), P(b, 0, b), P(a, 0, b)],
    [P(a, h, a), P(a, h, t), P(t, h, t), P(t, h, a)],
    [P(a, 0, a), P(a, 0, b), P(a, h, t), P(a, h, a)],
    [P(a, 0, a), P(a, h, a), P(t, h, a), P(b, 0, a)],
    [P(t, h, a), P(t, h, t), P(b, 0, b), P(b, 0, a)],
    [P(a, h, t), P(a, 0, b), P(b, 0, b), P(t, h, t)],
  ];
  const pos = [];
  for (const [p, q, r, s] of quads) pos.push(...p, ...q, ...r, ...p, ...r, ...s);
  outward(pos, [(a + b) / 2, h / 2, (a + b) / 2]);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  boxUV(g);
  out.turf.push(tintGeometry(g, lod === 2 ? (x, y) => 0.85 + 0.15 * Math.min(1, y / h) : turfCourses));
  // (Its crest is covered by the runs' trodden strips; the platform stands on it.)
}

/**
 * The ditch's run from x a0 to a1: a dark channel on the ground between the
 * bank's toe and the counterscarp, a low mound of the spoil beyond it.
 */
function ditchRun(a0, a1, { lod, out }) {
  out.earth.push(box(a1 - a0, 0.025, K.ditchOut - K.toe, (a0 + a1) / 2, 0, (K.toe + K.ditchOut) / 2, 0.42));
  const sec = [[K.ditchOut, 0], [K.edge, 0], [K.edge, 0.09], [K.ditchOut + 0.05, 0.14]];
  out.turf.push(prism(a0, a1, sec, lod === 2 ? () => 0.8 : turfCourses));
}

// ---------------------------------------------------------------------------
// The palisade
// ---------------------------------------------------------------------------

/**
 * The palisade's run from x a0 to a1 on the crest's outer edge: sharpened
 * stakes side by side (a pointed strip from afar), two rails along their
 * inside. `stake` is the height of their tops over the ground.
 */
function palisadeRun(a0, a1, { lod, seed, out, stake = K.stake }) {
  const base = K.bank - 0.08;
  const zs = K.stakeZ;
  const r = K.stakeR;
  const len = a1 - a0;
  if (lod === 0) {
    const rnd = artRng(seed);
    const n = Math.max(1, Math.round(len / (r * 2.05)));
    for (let k = 0; k < n; k++) {
      const x = a0 + (k + 0.5) * (len / n);
      // (Cut to uneven lengths in the field, a few centimetres either way.)
      const top = stake + (rnd() - 0.5) * 0.14;
      const rr = r * (0.9 + rnd() * 0.2);
      const h = top - base - 0.12;
      const g = new CylinderGeometry(rr, rr * 1.08, h, 6, 1, true);
      g.translate(x, base + h / 2, zs);
      const shade = 0.82 + rnd() * 0.3;
      out.wood.push(tintGeometry(boxUV(g), (gx, gy) => shade * (0.72 + 0.28 * Math.min(1, (gy - base) / 0.5))));
      const tip = new ConeGeometry(rr, 0.2, 6, 1, true);
      tip.translate(x, base + h + 0.1, zs);
      out.wood.push(tintGeometry(boxUV(tip), () => shade * 1.05));
    }
    // Two rails along the inside, lashed to the stakes.
    for (const y of [K.bank + 0.5, K.bank + 1.0]) out.wood.push(box(len, 0.07, 0.07, (a0 + a1) / 2, y, zs - r - 0.03, 0.82));
  } else {
    // A row of points as one strip: a board with a toothed top.
    const n = Math.max(1, Math.round(len / (lod === 1 ? 0.34 : 0.7)));
    const g = new BoxGeometry(len, 1, 2 * r, n * 2, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) {
        const u = (p.getX(i) + len / 2) / (len / (n * 2));
        p.setY(i, Math.round(u) % 2 ? stake - 0.18 : stake);
      } else p.setY(i, base);
    }
    g.computeVertexNormals();
    g.translate((a0 + a1) / 2, 0, zs);
    out.wood.push(tintGeometry(boxUV(g), (x, y) => 0.8 + 0.25 * Math.min(1, (y - base) / 0.6)));
  }
}

// ---------------------------------------------------------------------------
// The watch platform at a corner
// ---------------------------------------------------------------------------

/**
 * A watch platform on the front-right corner: four posts, a deck of boards
 * at CAMP.deck, a plank rail on its two inner sides (the palisade is its
 * outer rail), braces under the deck, a ladder up from the yard. `side` its
 * width; its outer faces flush with the crest's outer edge.
 */
function watchPlatform({ lod, out, side }) {
  const x1 = K.crestOut;
  const x0 = x1 - side;
  const cx = (x0 + x1) / 2;
  const t = 0.15;
  const top = K.deck + 0.5;
  for (const [x, z] of [[x0 + t / 2, x0 + t / 2], [x1 - t / 2, x0 + t / 2], [x0 + t / 2, x1 - t / 2], [x1 - t / 2, x1 - t / 2]]) out.wood.push(post(t, top, x, z));
  // The deck and its beams.
  out.wood.push(box(side + 0.06, 0.09, side + 0.06, cx, K.deck - 0.09, cx, 0.85));
  // The plank rail on the two inner sides.
  const rail = 0.4;
  out.wood.push(box(side + 0.06, rail, 0.05, cx, K.deck, x0 + t / 2, 0.8), box(0.05, rail, side + 0.06, x0 + t / 2, K.deck, cx, 0.8));
  if (lod < 2) {
    // Cross-braces under the deck on the two inner faces.
    out.wood.push(timberBeam([x0 + 0.12, 0.35, x0 + t / 2], [x1 - 0.12, K.deck - 0.15, x0 + t / 2], 0.07));
    out.wood.push(timberBeam([x0 + t / 2, 0.35, x0 + 0.12], [x0 + t / 2, K.deck - 0.15, x1 - 0.12], 0.07));
    // A ladder from the yard to the deck on its inner face, its lower end out in the yard.
    const lx = x0 + 0.4;
    const lz = x0 - 0.02;
    for (const s of [-1, 1]) out.wood.push(timberBeam([lx + s * 0.17, 0, lz - 0.5], [lx + s * 0.17, K.deck + 0.2, lz], 0.045));
    if (lod === 0) for (let k = 1; k < 7; k++) out.wood.push(box(0.34, 0.03, 0.03, lx, (k * K.deck) / 7.3, lz - 0.5 + (0.5 * k) / 7.3, 0.85));
  }
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * The gate on the front side: a timber tower on four posts over the passage
 * (the bank's ends faced with planks), a deck at CAMP.gate.deck with a
 * plank breastwork, a roof of boards, a ladder up from the crest, two
 * plank doors (open: swung back against the passage; shut: across it), the
 * passage floored with flags over the causeway, a painted board `label`.
 * `out` as fortBag: doorOpen, doorShut.
 */
function timberGate({ lod, out, label, boardWidth = 1.7 }) {
  const gh = CASTRA.gateHalf;
  const G = K.gate;
  const px = G.half;
  const z0 = G.z0;
  const z1 = G.z1;
  const cz = (z0 + z1) / 2;
  const t = 0.2;
  for (const s of [-1, 1]) {
    for (const z of [z0 + t / 2, z1 - t / 2]) out.tower.push(post(t, G.post, s * (px - t / 2), z));
    // The bank's ends, faced with planks.
    out.wood.push(box(0.08, K.bank + 0.1, K.toe - K.inner + 0.05, s * (gh + 0.04), 0, (K.toe + K.inner) / 2, 0.72));
  }
  // The lintels over the passage, under the deck: the inner one low over the doors' tops, the outer one
  // high, so that the gate tower hides little of the yard (a man stands behind the gate, the camera at
  // the front corner looks through the gap between them).
  out.tower.push(box(2 * px, 0.2, 0.22, 0, G.lintel, z0 + 0.12, 0.8));
  out.tower.push(box(2 * px, 0.15, 0.18, 0, G.deck - 0.25 + 0.1, z1 - 0.1, 0.8));
  // The deck.
  out.tower.push(box(2 * px + 0.1, 0.1, z1 - z0 + 0.1, 0, G.deck - 0.1, cz, 0.85));
  // A plank breastwork round the deck (the board on its front, the others plain).
  const rail = 0.6;
  out.tower.push(box(2 * px, rail, 0.05, 0, G.deck, z0 + 0.03, 0.8));
  for (const s of [-1, 1]) out.tower.push(box(0.05, rail, z1 - z0, s * (px - 0.03), G.deck, cz, 0.8));
  out.tower.push(box(2 * px, rail, 0.06, 0, G.deck, z1 - 0.03, 0.82));
  if (lod < 2) {
    // Braces from the posts' feet to the deck on the two sides.
    for (const s of [-1, 1]) out.tower.push(timberBeam([s * (px - t / 2), 0.4, z0 + 0.2], [s * (px - t / 2), G.deck - 0.25, z1 - 0.2], 0.08));
    // A ladder up the tower's side from the crest, leaning on it.
    const lz = K.walkZ;
    for (const s of [-1, 1]) out.tower.push(timberBeam([px + 0.5, K.bank, lz + s * 0.17], [px + 0.02, G.deck + 0.25, lz + s * 0.17], 0.045));
    if (lod === 0) for (let k = 1; k < 6; k++) out.tower.push(box(0.03, 0.03, 0.34, px + 0.5 - (0.48 * k) / 6, K.bank + ((G.deck - K.bank + 0.25) * k) / 6.2, lz, 0.85));
  }
  // The roof: four boarded slopes to a point, over the posts (eaves at the posts' tops).
  const o = 0.12;
  const cs = [[-px - o, z0 - o], [px + o, z0 - o], [px + o, z1 + o], [-px - o, z1 + o]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = cs[i];
    const [bx, bz] = cs[(i + 1) % 4];
    const g = new BoxGeometry(1, 1, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const u = p.getX(k) + 0.5;
      const v = p.getY(k) + 0.5;
      const d = p.getZ(k) > 0 ? 0.05 : 0;
      const ex = ax + (bx - ax) * u;
      const ez = az + (bz - az) * u;
      p.setXYZ(k, ex + (0 - ex) * v, G.post + (G.top - G.post) * v + d, ez + (cz - ez) * v);
    }
    g.computeVertexNormals();
    out.tower.push(tintGeometry(boxUV(g), (gx, gy) => 0.62 + 0.25 * Math.min(1, (gy - G.post) / 0.4)));
  }
  // The passage's floor: flags over the causeway, from the yard to beyond the ditch.
  out.flags.push(...paving(-gh, gh, z0, K.edge, 0.05, 40, { rowW: 0.7, minL: 0.55, maxL: 0.95, lod }));
  // The doors: two leaves of vertical planks hung at the passage's sides, near its outer end.
  const dh = G.door;
  const zd = z1 - 0.2;
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = [];
      const n = lod === 0 ? 5 : 1;
      for (let k = 0; k < n; k++) leaf.push(box((gh - 0.04) / n - 0.008, dh - 0.05, 0.06, -(gh - 0.04) + ((k + 0.5) * (gh - 0.04)) / n, 0.04, 0, 0.72 + ((k * 0.37) % 1) * 0.12));
      if (lod === 0) for (const y of [0.35, dh - 0.45]) leaf.push(box(gh - 0.1, 0.1, 0.03, -(gh - 0.04) / 2, y, -0.045, 0.7));
      for (const g of leaf) {
        if (s < 0) mirrorX([g]);
        if (open) g.rotateY(-s * D(86));
        g.translate(s * (gh - 0.02), 0, zd);
      }
      (open ? out.doorOpen : out.doorShut).push(...leaf);
    }
  }
  // The painted board on the breastwork, outside: the unit's name.
  const bz = z1 + 0.02;
  out.towerPaint.push(tintGeometry(box(boardWidth, 0.3, 0.04, 0, G.deck + 0.12, bz, 1), () => lin(0xe2d4b0)));
  if (lod === 0) out.towerLetters.push(...inscribe(label, G.deck + 0.2, bz + 0.024, 0.13));
  else if (lod === 1) out.towerLetters.push(box(boardWidth * 0.75, 0.1, 0.006, 0, G.deck + 0.22, bz + 0.022));
}

// ---------------------------------------------------------------------------
// The whole rampart
// ---------------------------------------------------------------------------

/** Fresh-cut oak is paler than a shed's dark boards: brighten a list of timber geometries' vertex colours. */
function freshen(list, k) {
  for (const g of list) {
    const c = g.attributes.color;
    if (c) for (let i = 0; i < c.array.length; i++) c.array[i] *= k;
  }
}

/**
 * The fort's rampart: bank, ditch, palisade, four platforms, the gate,
 * the strip inside. Poured into `out` (a fortBag). `stake` the palisade's
 * height over the ground (one number, or four for the front, the +x side,
 * the back and the -x side), `side` the corner platforms' width, `label`
 * the board over the gate.
 */
export function campRampart({ lod, seed, out: into, stake = K.stake, side = 1.3, label, boardWidth }) {
  const out = fortBag();
  // (One height for all four sides, or one for each: front, +x, back, -x.)
  const tops = Array.isArray(stake) ? stake : [stake, stake, stake, stake];
  const gh = CASTRA.gateHalf;
  const px = K.gate.half;
  const a = K.inner;
  const rim = K.stakeZ;
  const front = fortBag();
  // The front: either side of the gate.
  for (const s of [-1, 1]) {
    const [lo, hi] = s < 0 ? [-a, -gh] : [gh, a];
    bankRun(lo, hi, { lod, out: front });
    ditchRun(s * K.edge, s * (gh + 0.45), { lod, out: front });
    palisadeRun(s < 0 ? -rim : px, s < 0 ? -px : rim, { lod, seed: seed + 1 + (s > 0), out: front, stake: tops[0] });
  }
  timberGate({ lod, out: front, label, boardWidth });
  pour(front, out);
  // The sides and the back, built on the front and turned. (The side rows stop short of the corners'
  // stakes, which the front's and the back's rows already stand in.)
  for (const k of [1, 2, 3]) {
    const run = fortBag();
    bankRun(-a, a, { lod, out: run });
    ditchRun(-K.edge, K.edge, { lod, out: run });
    palisadeRun(-rim + 2 * K.stakeR, rim - 2 * K.stakeR, { lod, seed: seed + 10 + k, out: run, stake: tops[k] });
    pour(run, out, (l) => onSide(l, k));
  }
  // The corners: the bank filled in, a watch platform on it.
  for (let k = 0; k < 4; k++) {
    const c = fortBag();
    bankCorner(lod, c);
    watchPlatform({ lod, out: c, side });
    pour(c, out, (l) => onSide(l, k));
  }
  // The intervallum: a trodden strip along the inside of the bank, under whatever stands on it.
  if (lod < 2) {
    const w = 0.5;
    for (let k = 0; k < 4; k++) {
      const strip = [box(2 * a, 0.02, w, 0, CASTRA.floorY - 0.005, a - w / 2, 0.7)];
      out.earth.push(...onSide(strip, k));
    }
  }
  // The timber of a camp is green and split, paler than the boards of a shed.
  freshen(out.wood, 1.8);
  freshen(out.tower, 1.8);
  freshen(out.doorOpen, 1.8);
  freshen(out.doorShut, 1.8);
  pour(out, into);
}
