/**
 * models/castraArcher.js
 * ----------------------------------------------------------------------------
 * The archer fort (Praesidium) of the 3D look: the post of an auxiliary
 * cohort of archers (sagittarii), lighter than the legion's, after the turf
 * and timber forts that came first on every frontier and the archers who
 * held them (the Hamian archers from Syria at Carvoran on Hadrian's Wall and
 * at Bar Hill on the Antonine Wall):
 *
 *   - a rampart of cut turves laid in courses (Vegetius: turves a foot and a
 *     half long), its outer face battered, a timber breastwork of stakes on
 *     top; towers of four posts at the corners with a fighting platform and
 *     a roof of boards, open below; a timber gate tower over the passage, a
 *     painted board over it, COH I HAMIORVM
 *   - leather tents (papiliones, of calf hide panels as found at Vindolanda)
 *     in rows on one side of the yard, a hearth with its cauldron
 *   - a timber shrine for the standards at the back, thatched: the cohort's
 *     signum with its hand and discs, its vexillum in the archers' green
 *   - the butts: straw targets on trestles against the back rampart, arrows
 *     in them; a rack of composite bows and quivers by the gate
 *
 * States as the legion fort's (castraLegion.js): 'open' manned, 'out'
 * deployed (the standards out), 'shut' empty (the gate shut); 'home' and
 * 'staffed' tags.
 *
 * Metres, the fort's middle at the origin, y up, the gate toward +z.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, ConeGeometry } from 'three';
import { boxUV, tintGeometry, tube } from '../shapes.js';
import { artRng } from '../texgen.js';
import { lin } from './rural.js';
import {
  CASTRA, fortBag, pour, assemble, TANK_WATER, onSide, prism, box, cyl, staff, gravel, tent, signum, vexillum, imago,
  standardBase, inscribe, sentry, D,
} from './castra.js';

/** The archer fort's measures (metres): the tests, the lab and the game read them. */
export const ARCHER_FORT = Object.freeze({
  /** The rampart: its walk's height, the bank's inner foot, the breastwork's top. */
  walk: 0.95,
  bankFoot: 4.55,
  stakes: 1.55,
  /** The shrine: x0, x1, z0, z1. */
  shrine: Object.freeze([-1.15, 1.15, -5.15, -3.75]),
  /** The tents' places (x, z) on the left of the yard. */
  tents: Object.freeze([[-3.45, -3.2], [-2.15, -3.2], [-3.45, -1.3], [-2.15, -1.3], [-3.45, 0.6]]),
  /** The butts (x, z), facing the gate. */
  butts: Object.freeze([[2.35, -4.35], [3.75, -4.0]]),
  lamps: Object.freeze([Object.freeze([-1.06, 1.55, 5.55]), Object.freeze([1.06, 1.55, 5.55])]),
});

const A = ARCHER_FORT;
const GREEN = lin(0x3f7a3a);

/** Turves in courses: a vertex colour banding the bank every 0.16 m, each course its own green or brown. */
function turfTint(x, y, z) {
  const c = Math.floor(y / 0.16);
  const k = ((c * 0.618 + Math.floor((x + z) / 0.42) * 0.31) % 1);
  const g = 0.78 + 0.2 * k;
  // (The joints between courses darker.)
  const j = Math.abs(y / 0.16 - c - 0.5) > 0.42 ? 0.78 : 1;
  return g * j;
}

/**
 * A turf rampart's run on the front side from x a0 to a1: the bank (outer
 * face battered, the walk on top), the breastwork of stakes on its outer
 * edge, a walk of boards. `out` lists by material key.
 */
function turfRun(a0, a1, { lod, seed, out }) {
  const O = CASTRA.O;
  const w = A.walk;
  const sec = [[A.bankFoot, 0], [O, 0], [O - 0.32, w], [A.bankFoot + 0.42, w]];
  out.turf.push(prism(a0, a1, sec, lod === 2 ? (x, y) => 0.85 + 0.15 * Math.min(1, y / w) : turfTint));
  const zs = O - 0.36;
  // The walk's boards.
  if (lod < 2) out.wood.push(box(a1 - a0, 0.04, 0.62, (a0 + a1) / 2, w, zs - 0.38, 0.85));
  // The breastwork: a rail and stakes, their tops cut to points.
  const top = A.stakes;
  if (lod === 0) {
    const rnd = artRng(seed);
    const n = Math.round((a1 - a0) / 0.15);
    for (let k = 0; k < n; k++) {
      const x = a0 + (k + 0.5) * ((a1 - a0) / n);
      const h = top - w - 0.12 + (rnd() - 0.5) * 0.08;
      const r = 0.065 + rnd() * 0.012;
      const g = new CylinderGeometry(r, r * 1.05, h, 6, 1, true);
      g.translate(x, w + h / 2 - 0.05, zs);
      out.wood.push(tintGeometry(boxUV(g), (gx, gy) => 0.7 + 0.3 * Math.min(1, (gy - w) / 0.4)));
      const tip = new ConeGeometry(r, 0.14, 6, 1, true);
      tip.translate(x, w + h - 0.05 + 0.07, zs);
      out.wood.push(tintGeometry(boxUV(tip), () => 0.95));
    }
    // A rail along the inside, lashed to the stakes.
    out.wood.push(box(a1 - a0, 0.07, 0.06, (a0 + a1) / 2, w + 0.32, zs - 0.09, 0.8));
  } else {
    // A row of points as one strip: a board with a toothed top.
    const n = Math.round((a1 - a0) / (lod ? 0.3 : 0.6));
    const g = new BoxGeometry(a1 - a0, 1, 0.12, n * 2, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) {
        const u = (p.getX(i) + (a1 - a0) / 2) / ((a1 - a0) / (n * 2));
        p.setY(i, Math.round(u) % 2 ? top - 0.12 : top);
      } else p.setY(i, w - 0.05);
    }
    g.computeVertexNormals();
    g.translate((a0 + a1) / 2, 0, zs);
    out.wood.push(tintGeometry(boxUV(g), (x, y) => 0.75 + 0.25 * Math.min(1, (y - w) / 0.4)));
  }
}

/**
 * A timber tower of four posts on the front-right corner (or wherever x0..x1,
 * z0..z1 says): braced below, a platform of boards at `deck`, a breastwork
 * of planks round it, a roof of boards on the posts, a ladder up from the
 * walk.
 */
function timberTower({ lod, seed, out, x0, x1, z0, z1, deck = 1.85, rail = 0.48, roofY = 2.58, ladder = true }) {
  const t = 0.16;
  const posts = [[x0 + t / 2, z0 + t / 2], [x1 - t / 2, z0 + t / 2], [x1 - t / 2, z1 - t / 2], [x0 + t / 2, z1 - t / 2]];
  for (const [x, z] of posts) out.wood.push(box(t, roofY, t, x, 0, z, (gx, gy) => 0.7 + 0.3 * Math.min(1, gy / 0.5)));
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  // The deck and its beams.
  out.wood.push(box(x1 - x0 + 0.06, 0.09, z1 - z0 + 0.06, cx, deck - 0.09, cz, 0.85));
  // The breastwork of planks round the deck (gaps for shooting through on the outer faces).
  const bw = 0.05;
  for (const [a, b, at, ax] of [[x0, x1, z1, 'x'], [x0, x1, z0, 'x'], [z0, z1, x0, 'z'], [z0, z1, x1, 'z']]) {
    out.wood.push(ax === 'x' ? box(b - a + 0.06, rail, bw, (a + b) / 2, deck, at, 0.8) : box(bw, rail, b - a + 0.06, at, deck, (a + b) / 2, 0.8));
  }
  if (lod < 2) {
    // Cross-braces below the deck on the outer faces, the posts' feet in the bank.
    for (const [a, b, at, ax] of [[x0, x1, z1 - t / 2, 'x'], [z0, z1, x1 - t / 2, 'z'], [x0, x1, z0 + t / 2, 'x'], [z0, z1, x0 + t / 2, 'z']]) {
      const p0 = ax === 'x' ? [a + 0.1, 0.35, at] : [at, 0.35, a + 0.1];
      const p1 = ax === 'x' ? [b - 0.1, deck - 0.15, at] : [at, deck - 0.15, b - 0.1];
      out.wood.push(staffBeam(p0, p1, 0.07));
    }
  }
  // The roof: four boarded slopes to a point.
  const o = 0.08;
  const r = roofY;
  const apex = r + 0.55;
  const cs = [[x0 - o, z0 - o], [x1 + o, z0 - o], [x1 + o, z1 + o], [x0 - o, z1 + o]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = cs[i];
    const [bx, bz] = cs[(i + 1) % 4];
    const g = new BoxGeometry(1, 1, 1);
    // (A thin wedge: a tri as a flat pyramid face with some thickness, built from the box's eight corners.)
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const u = p.getX(k) + 0.5;
      const v = p.getY(k) + 0.5;
      const d = p.getZ(k) > 0 ? 0.05 : 0;
      const ex = ax + (bx - ax) * u;
      const ez = az + (bz - az) * u;
      const X = ex + (cx - ex) * v;
      const Z = ez + (cz - ez) * v;
      p.setXYZ(k, X, r + (apex - r) * v + d, Z);
    }
    g.computeVertexNormals();
    out.wood.push(tintGeometry(boxUV(g), (gx, gy) => 0.62 + 0.25 * Math.min(1, (gy - r) / 0.5)));
  }
  if (ladder && lod < 2) {
    // A ladder from the walk up to the deck on the inner side.
    const lx = x0 + 0.35;
    const lz = z0 - 0.25;
    for (const s of [-1, 1]) out.wood.push(staffBeam([lx + s * 0.18, A.walk, lz - 0.25], [lx + s * 0.18, deck + 0.3, lz + 0.05], 0.045));
    if (lod === 0) for (let k = 1; k < 6; k++) {
      const y = A.walk + (k * (deck - A.walk)) / 6;
      const zz = lz - 0.25 + (0.3 * k) / 6;
      out.wood.push(box(0.36, 0.03, 0.03, lx, y, zz, 0.85));
    }
  }
}

/** A squared timber from a to b, `w` square (rural.js beam without its bevel: a plain box, cheap). */
function staffBeam(a, b, w) {
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

/** The gate: a timber tower over the passage on four great posts, plank doors, a painted board. */
function gate(lod, seed, out) {
  const gh = CASTRA.gateHalf;
  const z0 = CASTRA.gateIn;
  const z1 = CASTRA.O - 0.05;
  const deck = 2.25;
  timberTower({ lod, seed, out, x0: -gh - 0.2, x1: gh + 0.2, z0, z1, deck, rail: 0.55, roofY: 3.05, ladder: false });
  // The turf's ends either side, revetted with planks.
  for (const s of [-1, 1]) out.wood.push(box(0.06, A.walk + 0.1, z1 - A.bankFoot, s * (gh + 0.23), 0, (z1 + A.bankFoot) / 2, 0.7));
  // A lintel beam over the passage under the deck.
  out.wood.push(box(2 * gh + 0.4, 0.18, 0.2, 0, deck - 0.27, z1 - 0.1, 0.8));
  // The doors: two leaves of vertical planks, hung on the outer posts.
  const dh = deck - 0.3;
  const zd = z1 - 0.18;
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = [];
      const n = lod === 0 ? 5 : 1;
      for (let k = 0; k < n; k++) leaf.push(box((gh - 0.04) / n - 0.008, dh - 0.05, 0.06, -(gh - 0.04) + ((k + 0.5) * (gh - 0.04)) / n, 0.04, 0, 0.72 + ((k * 0.37) % 1) * 0.12));
      if (lod === 0) for (const y of [0.35, dh - 0.45]) leaf.push(box(gh - 0.1, 0.1, 0.03, -(gh - 0.04) / 2, y, -0.045, 0.7));
      for (const g of leaf) {
        if (s < 0) g.scale(-1, 1, 1);
        if (open) g.rotateY(-s * D(86));
        g.translate(s * (gh - 0.02), 0, zd);
      }
      (open ? out.doorOpen : out.doorShut).push(...leaf);
    }
  }
  // The painted board over the passage, outside: the cohort's name.
  const bz = z1 + 0.02;
  out.paint.push(tintGeometry(box(1.7, 0.26, 0.04, 0, deck - 0.05, bz, 1), () => lin(0xe2d4b0)));
  if (lod === 0) out.letters.push(...inscribe('COH·I·HAMIORVM', deck + 0.01, bz + 0.024, 0.13));
  else if (lod === 1) out.letters.push(box(1.3, 0.1, 0.006, 0, deck + 0.02, bz + 0.022));
}

/** A straw target on a trestle facing +z, at (x, z): rings painted on its face, arrows in it (lod 0). */
function butt(x, z, lod, out, seed) {
  const r = 0.42;
  const cy = 0.95;
  const disc = new CylinderGeometry(r, r, 0.22, lod === 0 ? 20 : lod === 1 ? 12 : 8, 1);
  disc.rotateX(Math.PI / 2);
  disc.translate(x, cy, z);
  out.straw.push(tintGeometry(boxUV(disc), () => 0.95));
  if (lod < 2) {
    // The painted rings on its face.
    const rings = [[0.36, 0x9a2a1e], [0.25, 0xe8dcc0], [0.14, 0x9a2a1e], [0.05, 0x1e1a16]];
    rings.forEach(([rr, hex], i) => {
      const d = new CylinderGeometry(rr, rr, 0.005, lod === 0 ? 20 : 12, 1);
      d.rotateX(Math.PI / 2);
      d.translate(x, cy, z + 0.112 + i * 0.002);
      out.paint.push(tintGeometry(boxUV(d), () => lin(hex)));
    });
  }
  // The trestle: two legs splayed, a back strut.
  for (const s of [-1, 1]) out.wood.push(staffBeam([x + s * 0.32, 0, z + 0.12], [x + s * 0.16, cy + 0.2, z - 0.06], 0.06));
  out.wood.push(staffBeam([x, 0, z - 0.55], [x, cy + 0.1, z - 0.12], 0.06));
  if (lod === 0) {
    // Arrows stuck in it.
    const rnd = artRng(seed);
    for (let k = 0; k < 5; k++) {
      const a = rnd() * Math.PI * 2;
      const rr = rnd() * 0.28;
      const px = x + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      out.wood.push(staff([px, py, z + 0.1], [px + (rnd() - 0.5) * 0.08, py + (rnd() - 0.3) * 0.08, z + 0.62], 0.007, 3));
      out.paint.push(tintGeometry(box(0.003, 0.05, 0.1, px + (rnd() - 0.5) * 0.08, py + 0.0, z + 0.56, 1), () => lin(0xd8d0c0)));
    }
  }
}

/** A rack of composite bows and quivers at (x, z), along x: two posts and a rail, the bows' recurved limbs, quivers hung. */
function bowRack(x, z, lod, out) {
  for (const s of [-1, 1]) out.wood.push(box(0.08, 1.25, 0.08, x + s * 0.7, 0, z, 0.8));
  out.wood.push(box(1.5, 0.07, 0.07, x, 1.12, z, 0.8));
  out.wood.push(box(1.5, 0.06, 0.06, x, 0.45, z - 0.06, 0.8));
  if (lod === 2) return;
  // Bows hung by their strings from the rail: a curve of horn and wood, the tips turned back.
  for (let k = 0; k < 5; k++) {
    const bx = x - 0.56 + k * 0.28;
    const pts = [[0.06, 0.5, 0], [0.0, 0.38, 0], [-0.02, 0.0, 0], [0.0, -0.38, 0], [0.06, -0.5, 0]];
    const g = tube(pts.map(([px, py]) => [bx + px * 0.6, 0.62 + py * 0.95, z + 0.06]), 0.014, { radial: lod ? 3 : 5, segments: lod ? 4 : 10, around: 0.1 });
    out.leather.push(tintGeometry(g, () => lin(0x5a3a22)));
    if (lod === 0) out.rope.push(staff([bx + 0.036, 1.1, z + 0.06], [bx + 0.036, 0.15, z + 0.06], 0.003, 3));
  }
  // Quivers on pegs at the ends, fletchings out of their mouths.
  for (const s of [-1, 1]) {
    const qx = x + s * 0.82;
    const q = new CylinderGeometry(0.06, 0.05, 0.55, lod ? 6 : 10, 1);
    q.rotateZ(s * 0.12);
    q.translate(qx, 0.75, z + 0.05);
    out.leather.push(tintGeometry(boxUV(q), () => lin(0x6b4a2a)));
    if (lod === 0) for (let k = 0; k < 5; k++) out.paint.push(tintGeometry(box(0.012, 0.12, 0.012, qx - 0.03 + (k % 3) * 0.03, 1.04, z + 0.03 + (k >> 1) * 0.03, 1), () => lin(k % 2 ? 0xe8e0d0 : 0x8a2a1e)));
  }
}

/** The shrine of the standards: a small timber hall, plastered panels between its posts, thatched; the standards before it. */
function shrine(lod, seed, out, std) {
  const [x0, x1, z0, z1] = A.shrine;
  const cx = (x0 + x1) / 2;
  const eave = 1.5;
  // A sill of stones, the posts, the panels plastered and limewashed.
  out.stone.push(box(x1 - x0 + 0.1, 0.18, z1 - z0 + 0.1, cx, 0, (z0 + z1) / 2, 0.75));
  out.plaster.push(box(x1 - x0 - 0.06, eave - 0.18, z1 - z0 - 0.06, cx, 0.18, (z0 + z1) / 2, 0.92));
  for (const x of [x0, cx - 0.42, cx + 0.42, x1]) for (const z of [z0, z1]) out.wood.push(box(0.12, eave - 0.18, 0.12, Math.max(x0 + 0.06, Math.min(x1 - 0.06, x)), 0.18, z + (z === z0 ? 0.06 : -0.06), 0.75));
  out.wood.push(box(x1 - x0 + 0.04, 0.1, 0.13, cx, eave - 0.1, z1 - 0.06, 0.75));
  // The doorway (dark) and its frame.
  out.dark.push(box(0.7, 1.0, 0.02, cx, 0.18, z1 + 0.005));
  // The thatch: two thick slopes meeting on a ridge along z, steep, as a thatcher lays it.
  const rise = 0.95;
  for (const sgn of [-1, 1]) {
    const e = sgn * ((x1 - x0) / 2 + 0.3);
    const sec = [[e, eave - 0.1], [0, eave + rise], [0, eave + rise - 0.22], [e * 0.93, eave - 0.26]];
    // (prism runs along x and its section is in (z, y): built so, then turned to run along z.)
    const th = prism(z0 - 0.25, z1 + 0.3, sec, (gx, gy) => 0.78 + 0.22 * Math.min(1, (gy - eave + 0.2) / rise));
    th.rotateY(-Math.PI / 2);
    th.translate(cx, 0, 0);
    out.thatch.push(th);
  }
  // Gables of boards.
  for (const z of [z1, z0]) {
    const g = box(x1 - x0 - 0.04, 1, 0.05, cx, 0, z + (z === z1 ? -0.04 : 0.04), 0.7);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? eave + rise * 0.82 * (1 - Math.abs(p.getX(i) - cx) / ((x1 - x0) / 2)) : eave);
    g.computeVertexNormals();
    out.wood.push(g);
  }
  // The standards before its door.
  const z = z1 + 0.55;
  standardBase(-0.5, 0.5, z, lod, out, 3);
  signum(0, z, 2.0, lod, std, { hand: true, discs: 4 });
  vexillum(-0.5, z, 1.95, lod, std, GREEN);
  imago(0.5, z, 1.8, lod, std);
}

/** A hearth of stones with a cauldron on a tripod (the tents' cooking). */
function hearth(x, z, lod, out) {
  const n = lod ? 6 : 9;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    out.stone.push(box(0.14, 0.1, 0.12, x + Math.cos(a) * 0.32, 0, z + Math.sin(a) * 0.32, 0.6));
  }
  out.dark.push(box(0.5, 0.02, 0.5, x, 0, z));
  if (lod === 2) return;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    out.iron.push(staff([x + Math.cos(a) * 0.42, 0, z + Math.sin(a) * 0.42], [x, 0.95, z], 0.012, 4));
  }
  const pot = new CylinderGeometry(0.17, 0.12, 0.22, lod ? 8 : 14, 1);
  pot.translate(x, 0.42, z);
  out.bronze.push(tintGeometry(boxUV(pot), () => 0.55));
  out.iron.push(staff([x, 0.53, z], [x, 0.93, z], 0.006, 3));
}

/** Build the archer fort: { group, meshes, triangles }; meshes tagged in userData.when. */
export function buildArcherFort({ lod = 0, seed = 131 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = fortBag();
  const std = { wood: [], gilt: [], silver: [], cloth: [], iron: [], bronze: [], rope: [] };
  const O = CASTRA.O;
  const tw = 1.45;
  const a = O - tw;
  const gx = CASTRA.gateHalf + 0.2;
  // The rampart: the front either side of the gate, then the sides and the back turned on.
  turfRun(-a, -gx, { lod, seed: seed + 1, out });
  turfRun(gx, a, { lod, seed: seed + 2, out });
  for (const k of [1, 2, 3]) {
    const side = fortBag();
    turfRun(-a, a, { lod, seed: seed + 10 + k, out: side });
    pour(side, out, (l) => onSide(l, k));
  }
  // The corners: the bank carried round under each tower, the tower over it.
  for (let k = 0; k < 4; k++) {
    const c = fortBag();
    c.turf.push(prism(a, O, [[A.bankFoot, 0], [O, 0], [O - 0.32, A.walk], [A.bankFoot + 0.42, A.walk]], turfTint));
    timberTower({ lod, seed: seed + 20 + k, out: c, x0: a + 0.02, x1: O - 0.08, z0: a + 0.02, z1: O - 0.08 });
    pour(c, out, (l) => onSide(l, k));
  }
  gate(lod, seed + 30, out);
  // The yard.
  gravel(-A.bankFoot, A.bankFoot, -A.bankFoot, A.bankFoot, out);
  const shrineStd = std;
  shrine(lod, seed + 40, out, shrineStd);
  // Tents in their rows on the left; a hearth before them.
  A.tents.forEach(([x, z], i) => {
    const t = tent({ L: 1.45, w: 1.15, h: 1.08, wall: 0.28, lod, open: i % 2 === 0, seed: seed + 50 + i });
    for (const list of Object.values(t)) for (const g of list) g.translate(x, 0.03, z);
    out.leather.push(...t.leather);
    out.wood.push(...t.wood);
    out.rope.push(...t.rope);
    out.dark.push(...t.dark);
  });
  hearth(-2.15, 0.75, lod, out);
  for (const [i, [x, z]] of A.butts.entries()) butt(x, z, lod, out, seed + 60 + i);
  bowRack(3.15, 3.85, lod, out);
  // A water butt by the gate.
  out.wood.push(cyl(0.3, 0.27, 0.72, lod ? 8 : 14, -2.6, 0, 4.05, 0.8));
  if (lod < 2) for (const y of [0.12, 0.55]) out.iron.push(cyl(0.305, 0.3, 0.05, lod ? 8 : 14, -2.6, y, 4.05, 0.6));
  out.water.push(cyl(0.26, 0.26, 0.01, lod ? 8 : 14, -2.6, 0.64, 4.05));
  // The timber of a turf fort, split from fresh oak and bleached by the weather: lighter than the
  // dark oak of a shed (its colours in its vertices: brightened together).
  for (const g of out.wood) {
    const c = g.attributes.color;
    for (let i = 0; i < c.array.length; i++) c.array[i] *= 1.4;
  }
  const { p, mats } = assemble('praesidium', out, std, lod, A.lamps);
  // A sentry on the gate's deck while the men are home: an archer, his bow in hand.
  if (lod === 0) sentry(p, mats, 'sentry', 0.45, 2.25, O - 0.45, 0.25, 'open', { cloth: 0x3f7a3a });
  return p.build();
}

export { TANK_WATER };
