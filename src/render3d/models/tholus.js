/**
 * models/tholus.js
 * ----------------------------------------------------------------------------
 * The oracle of the 3D look (oraculum) on a 2 x 2 footprint (8 m), from the
 * record rather than the 2D sprite: a round shrine over a sacred spring.
 *
 *   - The tholos: the round temple the Greeks built in their sanctuaries
 *     (the tholos of Athena Pronaia below Delphi, on three steps) and the
 *     Romans after them (the round temple at Tivoli on its cliff over
 *     the falls, eighteen Corinthian columns round a cella with a door and
 *     two windows, garlands and ox skulls carved on its frieze; the round
 *     temple by the Tiber). Here ten Corinthian columns (kits of their
 *     own, instanced, each turned to face out) on three steps round a
 *     cella with its door to the front and two windows, the frieze
 *     carved with garlands and ox skulls (bucrania), a conical roof of
 *     tiles with a gilt finial.
 *   - The oracle itself: Apollo's at Delphi spoke from a cleft in the rock
 *     over a spring (Castalia), his priestess on a bronze tripod; the
 *     Sibyl's at Cumae from a cave in the tufa; Fortuna's at Praeneste by
 *     lots drawn by a boy from an olive-wood chest. Here a rock outcrop
 *     beside the shrine with its cleft breathing vapour, the spring
 *     running from it into a stone basin; inside, glimpsed through the
 *     door, the tripod with its cauldron over the omphalos stone; outside,
 *     Apollo's laurel, cypresses behind, two bronze tripods burning either
 *     side of the approach, votive gifts left on the steps.
 *
 * It has no staff (the sim's oracle has none): always at work, its fires
 * lit. In a hard frost (snow 2 or 3) its spring and basin are ice.
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry, IcosahedronGeometry, TorusGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { material, iceMaterial } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab, paving, TaggedParts } from './masonry.js';
import { column, darkIn, FRESCO } from './domus.js';
import { cypress, bush } from './learning.js';
import { pot } from './healing.js';
import { sacraMaterials, hearthFire, festoon, box, D } from './sacra.js';
import { cultStatue } from './numina.js';

/** The oracle's measures (metres). */
export const THOLUS = Object.freeze({
  half: 4,
  /** The steps' outer radii and their height each; the stylobate's top. */
  steps: Object.freeze([3.55, 3.28, 3.01]),
  step: 0.22,
  floorY: 0.66,
  /** The columns' ring, their number, their height (base to abacus). */
  ring: 2.62,
  n: 10,
  colH: 3.0,
  /** The cella's outer radius and its wall's thickness. */
  cella: 1.72,
  wall: 0.3,
  /** The door: half width, height. */
  door: Object.freeze([0.5, 2.15]),
  /** The tripods burning either side of the approach (x, z), their flames' height. */
  tripods: Object.freeze([Object.freeze([-1.55, 3.35]), Object.freeze([1.55, 3.35])]),
  tripodH: 1.25,
  /** The rock of the cleft and the spring's basin. */
  rock: Object.freeze([2.85, 2.95]),
  basin: Object.freeze([1.72, 3.6, 1.0, 0.52]),
});

const O = THOLUS;
const PY = O.floorY;
const AB = PY + O.colH;
const ENT = 0.62;

/** The columns' places [x, z, ry] (each turned to face out from the middle) and the floor they stand on. */
export const THOLUS_COLUMNS = Object.freeze({
  at: Object.freeze(Array.from({ length: O.n }, (_, i) => {
    const a = (i / O.n) * Math.PI * 2 + Math.PI / O.n;
    return Object.freeze([Math.sin(a) * O.ring, Math.cos(a) * O.ring, a]);
  })),
  floor: PY,
});

/** Where vapour rises (the cleft) and the tripods' smoke: [x, y, z, kind] for models/religion.js. */
export function tholusVents() {
  const [rx, rz] = O.rock;
  return [[rx - 0.25, 0.7, rz + 0.1, 'vapour'], ...O.tripods.map(([x, z]) => [x, O.tripodH + 0.12, z, 'thin'])];
}

/** The lamps for models.js modelLamps: the two tripods' fires, facing the street. */
export const THOLUS_LAMPS = Object.freeze(O.tripods.map(([x, z]) => Object.freeze([x, O.tripodH + 0.3, z, 1])));

/** A ring (annulus) solid from radius r0 to r1, y0 to y1, `seg` sides. */
function ring(r0, r1, y0, y1, seg, tint = 0.95) {
  return revolve(profileOf([[r1, y0], [r1, y1], [r0, y1], [r0, y0], [r1, y0]]), { segments: seg, metres: 1, tint: () => tint });
}

/** The steps, the cella with its door and windows, the entablature, the roof. */
function shrine(lod, seed, out) {
  const seg = lod === 2 ? 16 : lod ? 32 : 64;
  // Three steps, the stylobate on top.
  O.steps.forEach((r, i) => {
    const y = i * O.step;
    out.trav.push(revolve(profileOf([[r, y], [r, y + O.step - 0.02], [r - 0.02, y + O.step], [0, y + O.step]]), { segments: seg, metres: 1, tint: (p) => 0.86 + 0.1 * (p.y / PY) }));
  });
  // The floor of the walk round the cella, under the roof (no snow).
  out.floor.push(ring(O.cella - 0.02, O.steps[2] - 0.05, PY - 0.01, PY + 0.01, seg, 0.9));
  // The cella's wall: a drum with its door and two windows (the openings cut as gaps between arcs).
  const R = O.cella;
  const [dw, dh] = O.door;
  const gaps = [{ a: 0, w: (dw + 0.02) / R, lo: PY, hi: PY + dh }, { a: D(90), w: 0.3 / R, lo: PY + 1.5, hi: PY + 2.4 }, { a: D(-90), w: 0.3 / R, lo: PY + 1.5, hi: PY + 2.4 }];
  const N = lod === 2 ? 20 : lod ? 36 : 72;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const open = gaps.filter((g) => Math.abs(ang(am - g.a)) < g.w);
    // A segment of wall from the floor to the top, less the opening it crosses.
    const spans = [];
    let y = PY;
    for (const g of open.sort((p, q) => p.lo - q.lo)) {
      if (g.lo > y) spans.push([y, g.lo]);
      y = g.hi;
    }
    spans.push([y, AB]);
    for (const [y0, y1] of spans) out.marble.push(arcPiece(R, R - O.wall, y0, y1, a0, a1));
  }
  // The door's frame and lintel; the windows' sills; the dark inside the windows.
  // (Set into the curve of the drum: each jamb's back in the wall where it stands, the lintel's ends too.)
  const onWall = (x) => Math.sqrt(R * R - x * x);
  for (const s of [-1, 1]) out.marble.push(box(0.13, dh + 0.04, 0.14, s * (dw + 0.065), PY, onWall(dw + 0.13) + 0.04, 0.97));
  out.marble.push(box(2 * dw + 0.3, 0.17, 0.22, 0, PY + dh, onWall(dw + 0.15) + 0.09, 0.97));
  for (const s of [-1, 1]) {
    out.marble.push(box(0.12, 0.08, 0.7, s * (R + 0.04), PY + 1.46, 0, 0.95));
    if (lod < 2) out.dark.push(box(0.05, 0.9, 0.62, s * (R - O.wall - 0.03), PY + 1.5, 0));
    if (lod === 0) for (let k = -1; k <= 1; k++) out.bronze.push(box(0.02, 0.9, 0.02, s * (R - O.wall / 2), PY + 1.5, k * 0.15));
  }
  // The inside: a floor, painted walls (a band of red over a black dado, close up), the ceiling's dark.
  out.floor.push(tintGeometry(boxUV(new CylinderGeometry(R - O.wall, R - O.wall, 0.02, seg, 1).translate(0, PY + 0.01, 0)), () => 0.85));
  if (lod < 2) {
    out.fresco.push(revolve(profileOf([[R - O.wall - 0.005, PY], [R - O.wall - 0.005, PY + 0.85]]), { segments: seg, metres: 1, tint: () => FRESCO.black }));
    out.fresco.push(revolve(profileOf([[R - O.wall - 0.005, PY + 0.85], [R - O.wall - 0.005, AB]]), { segments: seg, metres: 1, tint: () => FRESCO.red }));
    // (Revolved profiles face out: these are seen from inside, so turned inside out.)
    for (const g of out.fresco.slice(-2)) flip(g);
    out.dark.push(tintGeometry(boxUV(new CylinderGeometry(R - O.wall, R - O.wall, 0.04, seg, 1).translate(0, AB - 0.03, 0))));
  } else {
    out.dark.push(darkIn('x', -dw, dw, PY, PY + dh, R - O.wall, -1));
  }
  // The entablature: an architrave ring on the columns, the frieze, the cornice; the walk's ceiling.
  const ro = O.ring + 0.24;
  out.marble.push(ring(O.ring - 0.24, ro, AB, AB + 0.18, seg, 0.94));
  out.marble.push(ring(O.ring - 0.22, ro + 0.03, AB + 0.18, AB + 0.36, seg, 0.97));
  out.marble.push(ring(O.ring - 0.22, ro - 0.01, AB + 0.36, AB + ENT - 0.14, seg, 0.95));
  out.marble.push(revolve(profileOf([[ro - 0.01, AB + ENT - 0.14], [ro + 0.08, AB + ENT - 0.1], [ro + 0.16, AB + ENT - 0.04], [ro + 0.16, AB + ENT], [O.ring - 0.22, AB + ENT]]), { segments: seg, metres: 1, tint: () => 0.99 }));
  // The ceiling over the walk, and the cella's wall carried up to the roof inside the entablature.
  out.dark.push(ring(R, O.ring - 0.2, AB + 0.3, AB + 0.33, seg, 0.5));
  out.marble.push(ring(R - O.wall, R, AB, AB + ENT, seg, 0.9));
  // The frieze's garlands swinging between ox skulls (Tivoli's), close up.
  if (lod === 0) {
    const fy = AB + 0.36;
    const fr = ro;
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const P = (a, y) => [Math.sin(a) * (fr + 0.01), y, Math.cos(a) * (fr + 0.01)];
      const f = festoon(P(a0, fy + 0.11), P(a1, fy + 0.11), { sag: 0.08, r: 0.025, lod: 1, seed: i });
      out.carved.push(...f.leaf);
      // The skull: a long head, its horns curving out.
      const sk = new SphereGeometry(0.045, 6, 4);
      sk.scale(0.8, 1.4, 0.5);
      sk.translate(0, 0, 0);
      sk.rotateY(a0);
      const [sx, sy, sz] = P(a0, fy + 0.12);
      sk.translate(sx, sy, sz);
      out.carved.push(tintGeometry(boxUV(sk)));
    }
  }
  // The roof: a cone of tiles, ribbed with cover tiles down its slope, a gilt finial.
  const ry = AB + ENT;
  const rr = ro + 0.22;
  const apex = ry + 1.25;
  out.tile.push(revolve(profileOf([[rr, ry - 0.06], [rr, ry + 0.02], [0.3, apex - 0.05], [0, apex]]), { segments: seg, metres: 0.5, tint: (p) => 0.82 + 0.18 * Math.sin(p.y * 22) ** 2 }));
  if (lod < 2) {
    const ribs = lod ? 16 : 32;
    for (let i = 0; i < ribs; i++) {
      const a = (i / ribs) * Math.PI * 2;
      const P = (r, y) => [Math.sin(a) * r, y, Math.cos(a) * r];
      out.tile.push(tube([P(rr + 0.01, ry + 0.06), P(0.32, apex - 0.02)], 0.035, { radial: lod ? 3 : 5, segments: 2, around: 0.2 }));
    }
    if (lod === 0) {
      // Antefixes round the eave.
      for (let i = 0; i < 32; i++) {
        const a = ((i + 0.5) / 32) * Math.PI * 2;
        const g = new SphereGeometry(0.07, 5, 3, 0, Math.PI);
        g.scale(1, 1.4, 0.3);
        g.rotateY(a);
        g.translate(Math.sin(a) * (rr + 0.02), ry + 0.1, Math.cos(a) * (rr + 0.02));
        out.tile.push(tintGeometry(boxUV(g), () => 0.9));
      }
    }
  }
  // The finial: a gilt tripod's bowl on a drum, Apollo's sign at the top of his shrine.
  out.marble.push(revolve(profileOf([[0.34, apex - 0.1], [0.3, apex + 0.12], [0.24, apex + 0.16], [0, apex + 0.16]]), { segments: lod ? 10 : 18, metres: 0.5 }));
  out.gilt.push(...tripod(0, apex + 0.16, 0, 0.75, lod));
}

/** A triangle strip of a ring's piece: the outer face and the top/bottom between radii r1 (outer) and r0, from angle a0 to a1. */
function arcPiece(r1, r0, y0, y1, a0, a1) {
  const steps = 2;
  const pos = [];
  const P = (r, a, y) => [Math.sin(a) * r, y, Math.cos(a) * r];
  for (let i = 0; i < steps; i++) {
    const b0 = a0 + ((a1 - a0) * i) / steps;
    const b1 = a0 + ((a1 - a0) * (i + 1)) / steps;
    // Outer face (facing out), inner face (facing in), the top.
    pos.push(...P(r1, b0, y0), ...P(r1, b1, y0), ...P(r1, b1, y1), ...P(r1, b0, y0), ...P(r1, b1, y1), ...P(r1, b0, y1));
    pos.push(...P(r0, b1, y0), ...P(r0, b0, y0), ...P(r0, b0, y1), ...P(r0, b1, y0), ...P(r0, b0, y1), ...P(r0, b1, y1));
    pos.push(...P(r1, b0, y1), ...P(r1, b1, y1), ...P(r0, b1, y1), ...P(r1, b0, y1), ...P(r0, b1, y1), ...P(r0, b0, y1));
    pos.push(...P(r1, b1, y0), ...P(r1, b0, y0), ...P(r0, b0, y0), ...P(r1, b1, y0), ...P(r0, b0, y0), ...P(r0, b1, y0));
  }
  // The ends (the jambs of an opening): both, cheap, hidden where they meet the next piece.
  for (const [a, f] of [[a0, -1], [a1, 1]]) {
    const q = [P(r1, a, y0), P(r0, a, y0), P(r0, a, y1), P(r1, a, y1)];
    if (f > 0) pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    else pos.push(...q[1], ...q[0], ...q[3], ...q[1], ...q[3], ...q[2]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return tintGeometry(boxUV(g), () => 0.96);
}

/** Turn a geometry's faces inside out (seen from within). */
function flip(g) {
  const idx = g.index;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, b);
    }
  }
  const n = g.attributes.normal;
  if (n) for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

/**
 * A bronze tripod (Apollo's: the priestess sat on one at Delphi, and they
 * were the god's prize and his gift), its bowl's rim at y0 + h: three
 * legs, rings, the cauldron. At (x, y0, z). Returns geometries.
 */
export function tripod(x, y0, z, h, lod = 0) {
  const out = [];
  const r = h * 0.28;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    const top = [x + Math.sin(a) * r * 0.9, y0 + h * 0.86, z + Math.cos(a) * r * 0.9];
    const foot = [x + Math.sin(a) * r * 1.25, y0, z + Math.cos(a) * r * 1.25];
    out.push(tube([foot, [x + Math.sin(a) * r * 1.05, y0 + h * 0.45, z + Math.cos(a) * r * 1.05], top], h * 0.022, { radial: lod ? 4 : 6, segments: lod ? 3 : 6, around: 0.1 }));
    if (lod === 0) {
      // A lion's paw for a foot.
      const paw = new SphereGeometry(h * 0.04, 6, 4);
      paw.scale(1, 0.6, 1.3);
      paw.translate(foot[0], foot[1] + h * 0.02, foot[2]);
      out.push(tintGeometry(boxUV(paw)));
    }
  }
  const bowl = revolve(profileOf([[0, y0 + h * 0.62], [r * 0.5, y0 + h * 0.66], [r * 0.95, y0 + h * 0.82], [r * 1.02, y0 + h], [r * 0.94, y0 + h * 0.98], [0, y0 + h * 0.9]]), { segments: lod ? 10 : 18, metres: 0.4 });
  out.push(bowl.translate(x, 0, z));
  if (lod < 2) {
    const ring1 = new TorusGeometry(r * 1.12, h * 0.014, 4, lod ? 12 : 20);
    ring1.rotateX(Math.PI / 2);
    ring1.translate(x, y0 + h * 0.45, z);
    out.push(tintGeometry(boxUV(ring1)));
    // The ring handles on the cauldron's rim.
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.3 + Math.PI / 3;
      const hdl = new TorusGeometry(h * 0.07, h * 0.012, 4, 10);
      hdl.rotateY(a);
      hdl.translate(x + Math.sin(a) * r, y0 + h * 1.05, z + Math.cos(a) * r);
      out.push(tintGeometry(boxUV(hdl)));
    }
  }
  return out;
}

/** The rock outcrop of the cleft: lumps of grey limestone, the cleft dark between them. */
function rock(lod, seed, out) {
  const [x, z] = O.rock;
  const rnd = artRng(seed);
  const lumps = [[0, 0, 1.0, 0.95], [-0.55, 0.35, 0.7, 0.6], [0.45, -0.5, 0.75, 0.8], [0.6, 0.45, 0.5, 0.42], [-0.15, -0.75, 0.55, 0.55]];
  for (const [dx, dz, r, h] of lumps.map((l) => l.map((v) => v * 0.76))) {
    let g = new IcosahedronGeometry(r, lod === 2 ? 0 : lod ? 1 : 2);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g = mergeVertices(g, 1e-4);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const px = P.getX(i);
      const py = P.getY(i);
      const pz = P.getZ(i);
      const k = 1 + 0.18 * Math.sin(px * 7 + rnd() * 0.2) * Math.sin(pz * 5 + py * 3);
      // Flat underneath (it sits on the ground), strata across it.
      P.setXYZ(i, px * k, Math.max(0, py * (h / r) * k + 0.04 * Math.sin(py * 18)), pz * k * 0.85);
    }
    g.computeVertexNormals();
    boxUV(g);
    g.translate(x + dx, 0, z + dz);
    out.rock.push(tintGeometry(g, (px, py) => 0.75 + 0.25 * Math.min(1, py / h)));
  }
  // The cleft: a dark slit in the rock's face toward the basin.
  out.dark.push(box(0.1, 0.42, 0.3, x - 0.34, 0.14, z + 0.14));
}

/** The spring's basin: a stone trough fed from the cleft. Returns its water's geometries. */
function basin(lod, seed, out) {
  const [x, z, w, d] = O.basin;
  const h = 0.42;
  const t = 0.14;
  for (const s of [-1, 1]) {
    out.trav.push(slab(w, h, t, { bevel: 0.02, seed: seed + s, wobble: 0, tone: 0.03, grime: 0.3 }).translate(x, 0.04, z + s * (d / 2 - t / 2)));
    out.trav.push(slab(t, h, d - 2 * t, { bevel: 0.02, seed: seed + 3 + s, wobble: 0, tone: 0.03, grime: 0.3 }).translate(x + s * (w / 2 - t / 2), 0.04, z));
  }
  out.trav.push(box(w - 2 * t, 0.04, d - 2 * t, x, 0.06, z, 0.6));
  const water = [tintGeometry(boxUV(new CylinderGeometry(1, 1, 0.01, 4, 1).rotateY(Math.PI / 4).scale((w - 2 * t) / Math.SQRT2, 1, (d - 2 * t) / Math.SQRT2).translate(x, h - 0.04, z)))];
  // The spring's thread of water from the rock's foot into the basin.
  const stream = lod < 2 ? [tube([[x + 0.62, 0.55, z - 0.42], [x + 0.5, 0.5, z - 0.25], [x + 0.32, h - 0.03, z - 0.08]], 0.025, { radial: 5, segments: 6, around: 0.1 })] : [];
  return { water, stream };
}

/** Votive gifts on the steps: small vases, a statuette, a bronze plaque leaning (close up). */
function votives(lod, seed, out) {
  if (lod) return;
  const rnd = artRng(seed);
  const spots = [[-0.95, 3.05, O.step * 1], [1.05, 3.1, O.step * 1], [-0.7, 3.3, 0.04], [1.25, 2.85, O.step * 2], [-1.25, 2.8, O.step * 2]];
  for (const [x, z, y] of spots) {
    const kind = ['jar', 'flask', 'amph'][Math.floor(rnd() * 3)];
    out.clay.push(pot(kind, x, y, z, 0.16 + rnd() * 0.1, lod, 0.8 + rnd() * 0.3));
  }
  // A garland laid on the threshold.
  const f = festoon([-0.45, PY + 0.03, O.cella + 0.35], [0.45, PY + 0.03, O.cella + 0.35], { sag: -0.12, r: 0.04, lod, seed: 3 });
  out.leaf.push(...f.leaf);
  out.flowers.push(...f.flowers);
}

/** Build the oracle: { group, meshes, triangles }; `ice` freezes its spring and basin. */
export function buildTholus({ lod = 0, seed = 801, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['trav', 'marble', 'floor', 'fresco', 'dark', 'tile', 'gilt', 'bronze', 'carved', 'rock', 'clay', 'leaf', 'wood', 'flowers', 'paving'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  shrine(lod, seed, out);
  rock(lod, seed + 50, out);
  const water = basin(lod, seed + 60, out);
  votives(lod, seed + 70, out);
  // The ground: paving round the steps.
  const H = O.half - 0.06;
  const skip = (x, z) => Math.hypot(x, z) < O.steps[0] + 0.05 || (Math.abs(x - O.rock[0]) < 1.1 && Math.abs(z - O.rock[1]) < 1.1);
  out.paving.push(...paving(-H, H, -H, H, 0.04, seed + 80, { rowW: 0.7, minL: 0.6, maxL: 1.1, lod, skip, tone: 0.08, grime: 0.2 }));
  // Apollo's laurel by the approach; cypresses behind, a sacred grove's dark spires.
  // (A laurel grows as a many-stemmed bush: a few stems and clumps of leaves, not a ball on a pole.)
  const [lx, lz] = [-2.85, 2.6];
  for (const [dx, dz, h, r] of [[0, 0, 2.2, 0.7], [0.45, 0.3, 1.6, 0.55], [-0.4, 0.25, 1.4, 0.5], [0.15, -0.4, 1.8, 0.55]]) {
    out.wood.push(tube([[lx + dx * 0.3, 0.04, lz + dz * 0.3], [lx + dx * 0.8, h * 0.5, lz + dz * 0.8], [lx + dx, h - r * 0.5, lz + dz]], 0.035, { radial: lod ? 4 : 6, segments: 3, around: 0.2 }));
    out.leaf.push(...bush(lx + dx, h, lz + dz, r, { lod, seed: seed + 90 + Math.round(h * 10), squash: 1.25 }));
  }
  for (const [x, z, h] of [[-3.15, -3.0, 5.2], [3.1, -3.05, 4.6], [-2.45, -3.3, 4.0]]) {
    const c = cypress(x, z, h, { lod, seed: seed + x * 3 });
    out.leaf.push(...c.leaf);
    out.wood.push(...c.wood);
  }
  // The tripods burning either side of the approach, on low drums.
  for (const [x, z] of O.tripods) {
    out.marble.push(revolve(profileOf([[0.3, 0], [0.3, 0.08], [0.24, 0.12], [0.24, 0.3], [0.3, 0.34], [0.3, 0.4], [0, 0.4]]), { segments: lod ? 10 : 18, metres: 0.5 }).translate(x, 0.04, z));
    out.bronze.push(...tripod(x, 0.44, z, O.tripodH - 0.44, lod));
  }
  // Inside: the omphalos (the navel stone, netted with woollen fillets) and the tripod over it.
  if (lod < 2) {
    const om = new SphereGeometry(0.3, lod ? 10 : 18, lod ? 7 : 12);
    om.scale(1, 1.25, 1);
    om.translate(0, PY + 0.32, -0.55);
    out.marble.push(tintGeometry(boxUV(om), (px, py, pz) => (lod === 0 && (Math.sin(px * 40 + py * 30) > 0.92 || Math.sin(pz * 40 - py * 30) > 0.92) ? 0.7 : 0.95)));
    out.bronze.push(...tripod(0, PY, -0.55, 1.15, lod));
    // A statue of the god at the back (Fortuna, as at Praeneste, with her horn of plenty).
    const st = cultStatue('fortuna', lod === 0 ? 0 : 2);
    for (const g of st.stone) out.marble.push(g.scale(0.82, 0.82, 0.82).translate(0, PY + 0.3, -1.12));
    for (const g of st.gear) out.gilt.push(g.scale(0.82, 0.82, 0.82).translate(0, PY + 0.3, -1.12));
    out.marble.push(slab(0.5, 0.3, 0.36, { bevel: 0.01, seed: seed + 5, wobble: 0, tone: 0, grime: 0 }).translate(0, PY, -1.12));
  }
  const m = sacraMaterials();
  const p = new TaggedParts('tholus');
  const small = { cast: false };
  p.add('steps', m.trav, out.trav);
  p.add('paving', m.trav, out.paving, small);
  p.add('marble', m.marble, out.marble);
  p.add('floor', m.shelteredMarble, out.floor, small);
  if (out.fresco.length) p.add('fresco', m.fresco, out.fresco, small);
  p.add('inside', m.dark, out.dark, small);
  p.add('roof', m.tile, out.tile);
  p.add('gilt', m.gilt, out.gilt);
  p.add('bronze', m.bronze, out.bronze, { cast: lod === 0 });
  if (out.carved.length) p.add('carved', m.marble, out.carved, small);
  p.add('rock', material('oracle-rock', { surface: 'crag', color: 0xcfc6b4, vertexColors: true, snow: 1, normal: 0.9 }), out.rock);
  p.add('pots', m.clay, out.clay, small);
  p.add('leaf', m.leaf, out.leaf);
  p.add('wood', m.wood, out.wood, small);
  if (out.flowers.length) p.add('flowers', m.flowers, out.flowers, small);
  // The spring: its basin's water, the thread from the rock (ice in a hard frost, and no thread).
  p.add('water', ice ? iceMaterial() : m.water, water.water, small);
  if (!ice && water.stream.length) p.add('stream', m.stream, water.stream, small);
  // The tripods' fires: always burning (the oracle has no staff to let them die).
  const fires = O.tripods.map(([x, z]) => hearthFire([x, O.tripodH - 0.05, z], 0.1, { lod, seed: seed + 100 + x, big: 0.7 }));
  p.add('fire', m.embers, fires.flatMap((f) => f.hot), small);
  p.add('coals', m.ash, fires.flatMap((f) => f.dark), small);
  p.add('flames', m.flame, fires.flatMap((f) => f.flames), small);
  return p.build();
}

/** The oracle's Corinthian column (marble), standing on y 0: { group }. */
export function buildTholusColumn({ lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const m = sacraMaterials();
  const p = new TaggedParts('tholus-column');
  const c = column('corinthian', O.colH, lod);
  p.add('column', m.marble, c.stone);
  p.add('capital', m.marble, c.cap);
  return p.build();
}

