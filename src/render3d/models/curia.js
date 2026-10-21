/**
 * models/curia.js
 * ----------------------------------------------------------------------------
 * The senate house of the 3D look: a colony's curia on a 4 x 4 footprint
 * (16 m), as the game's 300 BC knew it, from the record rather than the 2D
 * sprite:
 *
 *   - The Curia Hostilia of the Forum Romanum as the Republic had it before
 *     Sulla rebuilt it (about 80 BC): a plain rectangular hall on a low
 *     podium, built of tufa in squared courses (opus quadratum, as the
 *     Servian Wall and the walls of Cosa), its walls plastered and painted,
 *     the senators on tiers of benches inside, the president's platform at
 *     the far end, the doors opening on the Comitium.
 *   - The council halls of the Latin colonies (Cosa's by its forum, Alba
 *     Fucens, Paestum after it became a colony): the same plain hall, with a
 *     porch.
 *   - The Etrusco-Italic temple, whose porch and roof every early Roman
 *     public building copied (Vitruvius IV.7; the terracottas of Satricum,
 *     Veii and Pyrgi): unfluted Tuscan columns of plastered tufa on stone
 *     bases, a timber architrave under a timber-trussed gable of tegulae and
 *     imbrices at a low pitch, the eaves and the gable's raking edges faced
 *     with painted terracotta plaques (red, black and cream), antefixes along
 *     the eave and a painted terracotta acroterion at the ridge. Men of the
 *     council wore the toga with the broad purple stripe on its tunic; a
 *     magistrate walked behind lictors carrying the fasces.
 *
 * So, in 16 m: a low podium of tufa with a flight of steps between two
 * bronze statues of honoured citizens in the toga; a porch of four Tuscan
 * columns (instanced: models/government.js) under the one roof of the hall,
 * a pair of bronze lampstands and benches of stone under it; behind it the
 * hall, its walls stuccoed cream over a red dado and scored as blocks, its
 * corners left as bare tufa quoins, the timber doors studded with bronze
 * under a tablet cut S·P·Q·R; the gable with its raking plaques and a disc
 * acroterion at the ridge. No windows (a Republican hall took its light from
 * the door and the roof), no marble, no brick, no vault.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the doors open, senators coming up the steps and
 *           talking in the porch (two seated on its bench), a magistrate in
 *           the purple-bordered toga at the door, his lictors at the foot
 *           of the steps; the lamps lit at night
 *   'shut'  no staff: the doors shut, nobody, the lamps out
 *   'out'   a mob or an enemy close (models/government.js): the doors shut,
 *           soldiers on the steps, the lamps lit
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry } from 'three';
import { boxUV, tintGeometry, frameSweep, revolve, profileOf } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, TaggedParts } from './masonry.js';

import {
  govMaterials, box, D, gable, gableTri, wallAlong, doubleDoor, letters, statue, lantern, lanternPane, FRESCO,
} from './domus.js';
import { lin } from './rural.js';
import { DYES } from '../people/actors.js';
import { SEAT_H } from '../people/clips.js';

/** The curia's measures (metres): the tests, the lab and the game read them. */
export const CURIA = Object.freeze({
  half: 8,
  /** The podium's top (the porch's and the hall's floor): a low one, five steps up. */
  floorY: 1.0,
  /** The podium: x half width, front and back z. */
  podium: Object.freeze([5.5, 3.7, -7.6]),
  /** The steps: half width, the foot's z, their number. */
  steps: Object.freeze([3.3, 6.1, 5]),
  /** The hall's outer faces: x half width, front z, back z; the eave (the walls' top, under the beam). */
  hall: Object.freeze([5.0, 0.6, -7.45]),
  eave: 6.2,
  /** The porch: its columns' line (z), their x, their height (base to abacus). */
  porchZ: 3.15,
  cols: Object.freeze([-4.45, -1.75, 1.75, 4.45]),
  colH: 4.7,
  /** The door (half width, height over the floor). */
  door: Object.freeze([1.1, 3.4]),
  /** The lampstands' lanterns (x, y, z) in the porch, facing the street. */
  lamps: Object.freeze([Object.freeze([-2.1, 2.95, 1.25]), Object.freeze([2.1, 2.95, 1.25])]),
});

const C = CURIA;
const PY = C.floorY;
const [HX, HZ1, HZ0] = C.hall;
const WALL = 0.45;
/** The roof's pitch: low, as an Etrusco-Italic temple's (a Greek one's is steeper). */
const PITCH = D(17);
/** How far the tiles reach past the walls at the eaves (x) and the gables (z). */
const OVER = 0.7;
const GABLE_OVER = 0.2;
/** The painted terracotta's colours (linear RGB): red ground, black outlines, cream motifs. */
const TC = Object.freeze({ red: lin(0xa8452c), black: lin(0x1f1813), cream: lin(0xe6d8b8) });

/** The curia's materials: the shared ones, and tufa (the harbour's and the engineer's: one key, one look). */
function curiaMaterials() {
  return { ...govMaterials(), tufa: material('tufa', { surface: 'tufa', vertexColors: true, snow: 1 }) };
}

/** The podium, the steps, the cheeks and the paving round it. */
function podium(lod, seed, out) {
  const [px, pz1, pz0] = C.podium;
  const hz = (pz1 - pz0) / 2;
  const cz = (pz1 + pz0) / 2;
  // A base, the die, a crown under the floor's edge: one profile run round the podium (a plain Republican one).
  const prof = [[0.12, 0], [0.12, 0.14], [0.05, 0.2], [0, 0.24], [0, PY - 0.16], [0.05, PY - 0.12], [0.09, PY - 0.08], [0.09, PY], [-Math.min(px, hz), PY]];
  const g = frameSweep(prof, px, hz, { tint: (p) => (p.y < 0.25 ? 0.8 : 0.95) });
  g.translate(0, 0, cz);
  out.tufa.push(g);
  // The steps up the front.
  const [sw, sz, n] = C.steps;
  const rise = PY / n;
  const tread = (sz - pz1) / n;
  for (let k = 0; k < n; k++) {
    const z0 = sz - (k + 1) * tread;
    out.tufa.push(slab(2 * sw, (k + 1) * rise, z0 + tread - pz1 + 0.02, { bevel: 0.012, seed: seed + k, wobble: lod ? 0 : 0.002, tone: 0.03, grime: 0.25 }).translate(0, 0, (pz1 - 0.02 + z0 + tread) / 2));
  }
  // The cheeks either side: walls stepping down with the flight.
  for (const s of [-1, 1]) {
    const x = s * (sw + 0.3);
    out.tufa.push(slab(0.6, PY, sz - 0.9 - pz1 + 0.05, { bevel: 0.015, seed: seed + 20 + s, wobble: 0, tone: 0.02, grime: 0.3 }).translate(x, 0, (pz1 - 0.05 + sz - 0.9) / 2));
    out.tufa.push(box(0.68, 0.08, sz - 0.9 - pz1 + 0.05, x, PY, (pz1 - 0.05 + sz - 0.9) / 2, 0.95));
  }
  // The precinct's paving round the podium and the steps.
  const H = C.half - 0.08;
  const skip = (x, z) => (Math.abs(x) < px + 0.15 && z < pz1 + 0.1) || (Math.abs(x) < sw + 0.62 && z < sz + 0.02);
  out.paving.push(...paving(-H, H, pz0 - 0.3, H, 0.06, seed + 40, { rowW: 0.8, minL: 0.7, maxL: 1.3, lod, skip, tone: 0.06, grime: 0.15 }));
  // A kerb of tufa at the precinct's street edge.
  out.tufa.push(box(2 * H, 0.1, 0.18, 0, 0, H - 0.09, 0.9));
  // The floor of the porch: flags of tufa on the podium.
  out.tufa.push(...paving(-px + 0.05, px - 0.05, HZ1, pz1 + 0.06, 0.03, seed + 50, { rowW: 0.9, minL: 0.9, maxL: 1.5, lod, tone: 0.05, grime: 0.05 }).map((p) => p.translate(0, PY, 0)));
}

/**
 * Score a stuccoed face as courses of blocks (close up): bed joints and the
 * courses' broken vertical joints, boxes a hair proud of the plane `at`
 * (axis 'x': the face runs along x, `n` the side it faces; 'z': along z).
 * `ops` are the openings [{ a, b, lo, hi }] along the face, left unscored.
 */
function scoreFace(axis, a, b, at, n, y0, y1, ops, out, { course = 0.55, blockL = 1.15 } = {}) {
  const p = at + n * 0.004;
  const line = (len, h, c, y, w) => (axis === 'x' ? box(len, h, w, c, y, p) : box(w, h, len, p, y, c));
  for (let y = y0 + course, i = 0; y < y1 - 0.1; y += course, i++) {
    // (Each course's bed joint broken where an opening crosses it.)
    let x0 = a;
    for (const o of [...ops].sort((q, r) => q.a - r.a)) {
      if (y < o.lo - 0.01 || y > o.hi + 0.01) continue;
      if (o.a - 0.05 > x0) out.joints.push(line(o.a - 0.05 - x0, 0.022, (x0 + o.a - 0.05) / 2, y, 0.008));
      x0 = o.b + 0.05;
    }
    if (b - x0 > 0.05) out.joints.push(line(b - x0, 0.022, (x0 + b) / 2, y, 0.008));
    // Each course's joints a half block on from the last.
    for (let x = a + (i % 2 ? blockL / 2 : blockL); x < b - 0.1; x += blockL) {
      const inOpening = ops.some((o) => x > o.a - 0.02 && x < o.b + 0.02 && y + course > o.lo && y < o.hi);
      if (!inOpening) out.joints.push(line(0.022, course - 0.022, x, y - course + 0.022, 0.008));
    }
  }
}

/** A band of red dado, a metre high at the floor, a hair proud of a face (`gaps` [[a, b]] left bare: the door). */
function dado(axis, a, b, at, n, gaps, out) {
  const t = 0.02;
  const c = at + n * t / 2;
  const cuts = [a, ...gaps.flatMap((g) => [g[0], g[1]]), b];
  for (let i = 0; i + 1 < cuts.length; i += 2) {
    const p0 = cuts[i];
    const p1 = cuts[i + 1];
    if (p1 - p0 < 0.02) continue;
    out.red.push(axis === 'x' ? box(p1 - p0, 1.0, t, (p0 + p1) / 2, PY, c) : box(t, 1.0, p1 - p0, c, PY, (p0 + p1) / 2));
  }
}

/**
 * The bare tufa quoins at a hall corner (cx, cz), `sx` and `sz` the corner's
 * outward signs: blocks in courses, long on one face and short on the other
 * and the reverse in the next, a little proud of the stucco, so the ashlar
 * shows through the plaster at the angles as it does at Pompeii.
 */
function quoins(cx, cz, sx, sz, top, out) {
  const course = 0.55;
  const t = 0.03;
  for (let y = PY, i = 0; y + course <= top + 1e-6; y += course, i++) {
    const long = i % 2 ? 0.45 : 0.85;
    const short = i % 2 ? 0.85 : 0.45;
    out.tufa.push(box(long, course - 0.02, t, cx - sx * long / 2, y, cz + sz * t / 2, (px, py) => 0.88 + 0.1 * Math.sin(py * 7 + i)));
    out.tufa.push(box(t, course - 0.02, short, cx + sx * t / 2, y, cz - sz * short / 2, (px, py) => 0.88 + 0.1 * Math.sin(py * 5 + i)));
  }
}

/**
 * A row of painted terracotta revetment plaques (antepagmenta): `len` long,
 * `h` high and `d` deep, built along x about the origin, one plaque about
 * `step` long: a red ground, a black fillet top and bottom and, close up, a
 * cream lozenge with a dark boss in the middle of each. Returns geometries.
 */
function plaqueRow(len, h, d, step, lod) {
  const n = Math.max(1, Math.round(len / step));
  const w = len / n;
  const geos = [];
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * w;
    // (A hair's gap between plaques, so the joints read from the ground.)
    geos.push(box(w - 0.015, h, d, x, -h / 2, 0, () => TC.red));
    if (lod === 2) continue;
    geos.push(box(w - 0.015, h * 0.14, d + 0.012, x, h * 0.33, 0, () => TC.black));
    geos.push(box(w - 0.015, h * 0.14, d + 0.012, x, -h * 0.47, 0, () => TC.black));
    if (lod === 0) {
      geos.push(box(w * 0.34, h * 0.46, d + 0.02, x, -h * 0.23, 0, () => TC.cream));
      geos.push(box(w * 0.14, h * 0.2, d + 0.03, x, -h * 0.1, 0, () => TC.black));
    }
  }
  return geos;
}

/**
 * `plaqueRow` hung under a line whose middle is (cx, cy, cz): turned `roll`
 * about z (a rake climbing to the right) and then `yaw` about y (a run along z).
 */
function placePlaques(len, h, d, cx, cy, cz, roll, yaw, lod, out) {
  // (The row's middle sits half its height below the line, along the line's normal.)
  const x = cx + Math.sin(roll) * h / 2;
  const y = cy - Math.cos(roll) * h / 2;
  for (const g of plaqueRow(len, h, d, 0.5, lod)) {
    g.rotateZ(roll);
    g.rotateY(yaw);
    g.translate(x, y, cz);
    out.clay.push(g);
  }
}

/** The acroterion on the ridge at (0, z): a plinth of red terracotta and a standing disc, a cream rim, a red face, a boss. */
function acroterion(apex, z, lod, out) {
  out.clay.push(box(0.5, 0.26, 0.4, 0, apex - 0.02, z, () => TC.red));
  out.clay.push(box(0.56, 0.05, 0.46, 0, apex + 0.24, z, () => TC.black));
  const seg = lod ? 12 : 28;
  const disc = (r, t, col) => {
    const g = new CylinderGeometry(r, r, t, seg, 1);
    g.rotateX(Math.PI / 2);
    g.translate(0, apex + 0.29 + 0.62, z);
    out.clay.push(tintGeometry(boxUV(g), () => col));
  };
  disc(0.62, 0.09, TC.cream);
  disc(0.5, 0.11, TC.red);
  if (lod === 0) {
    disc(0.36, 0.13, TC.black);
    disc(0.3, 0.15, TC.cream);
    disc(0.1, 0.18, TC.red);
  }
}

/** The hall: stuccoed tufa walls (cream over a red dado, scored as blocks), quoins, the doorway, the one roof, the plaques and the acroteria. */
function hall(lod, seed, out) {
  const top = C.eave;
  const [dw, dh] = C.door;
  const ops = [{ a: -dw, b: dw, lo: PY, hi: PY + dh }];
  const cream = () => FRESCO.white;
  // The front wall (between the sides), the sides (the hall's whole length) and the back.
  out.stucco.push(...wallAlong('x', -HX + WALL, HX - WALL, HZ1 - WALL / 2, WALL, PY, top, ops, cream));
  for (const s of [-1, 1]) out.stucco.push(...wallAlong('z', HZ0, HZ1, s * (HX - WALL / 2), WALL, PY, top, [], cream));
  out.stucco.push(...wallAlong('x', -HX + WALL, HX - WALL, HZ0 + WALL / 2, WALL, PY, top, [], cream));
  // Painted dado: red to a man's height, on every face.
  dado('x', -HX + WALL, HX - WALL, HZ1, 1, [[-dw - 0.3, dw + 0.3]], out);
  dado('x', -HX + WALL, HX - WALL, HZ0, -1, [], out);
  for (const s of [-1, 1]) dado('z', HZ0, HZ1, s * HX, s, [], out);
  // Scored as courses of tufa blocks above it (close up).
  if (lod === 0) {
    scoreFace('x', -HX + WALL, HX - WALL, HZ1, 1, PY + 1.0, top, ops, out);
    scoreFace('x', -HX + WALL, HX - WALL, HZ0, -1, PY + 1.0, top, [], out);
    for (const s of [-1, 1]) scoreFace('z', HZ0, HZ1, s * HX, s, PY + 1.0, top, [], out);
  }
  // The corners left as bare tufa blocks.
  if (lod < 2) for (const sx of [-1, 1]) for (const sz of [-1, 1]) quoins(sx * HX, sz > 0 ? HZ1 : HZ0, sx, sz, top, out);
  // A plain moulded cornice of stucco round the wall's top, under the roof's overhang.
  const cor = frameSweep([[0, 0], [0.05, 0.04], [0.09, 0.1], [0.09, 0.2], [-0.3, 0.2]], HX, (HZ1 - HZ0) / 2, { tint: (p) => (p.y < 0.1 ? 0.88 : 0.97) });
  cor.translate(0, top - 0.2, (HZ1 + HZ0) / 2);
  out.stucco.push(cor);
  // The doorway: jambs and lintel of dressed tufa, the tablet over it cut S·P·Q·R on a cream ground.
  for (const s of [-1, 1]) out.tufa.push(box(0.24, dh + 0.1, 0.1, s * (dw + 0.12), PY, HZ1 + 0.05, 0.95));
  out.tufa.push(box(2 * dw + 0.6, 0.24, 0.14, 0, PY + dh, HZ1 + 0.07, 0.95));
  out.stucco.push(box(2.2, 0.62, 0.05, 0, PY + dh + 0.36, HZ1 + 0.025, 1));
  if (lod === 0) out.letters.push(...letters('S·P·Q·R', PY + dh + 0.5, HZ1 + 0.052, 0.32));
  else if (lod === 1) out.letters.push(box(1.5, 0.3, 0.006, 0, PY + dh + 0.5, HZ1 + 0.052));
  // The threshold and the floor inside the doorway, the hall's dark beyond.
  out.floor.push(box(2 * dw, 0.03, WALL + 1.4, 0, PY, HZ1 - (WALL + 1.4) / 2, 0.9));
  out.dark.push(box(2 * dw + 0.2, dh, 0.05, 0, PY, HZ1 - WALL - 1.45));
  for (const s of [-1, 1]) out.dark.push(box(0.05, dh, 1.5, s * (dw + 0.05), PY, HZ1 - WALL - 0.72));
  // The roof: one timber-trussed gable of tegulae and imbrices over hall and porch, its ridge along the hall, the eaves reaching far out.
  const zf = C.porchZ + 0.3;
  const eaveY = top + 0.05;
  const roof = gable({ x0: -HX, x1: HX, z0: HZ0, z1: zf, eaveY, pitch: PITCH, along: 'z', lod, seed: seed + 60, over: OVER, gableOver: GABLE_OVER });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  const apex = roof.ridgeY;
  const eY = eaveY - OVER * Math.tan(PITCH);
  const zFront = zf + GABLE_OVER;
  const zBack = HZ0 - GABLE_OVER;
  // The tympanums, plain stucco behind the raking plaques: the front's on the porch's beam, the back's on the wall.
  out.stucco.push(gableTri(-HX + 0.05, HX - 0.05, zf + 0.08, 0.35, eaveY, apex - 0.05));
  out.stucco.push(gableTri(-HX + 0.05, HX - 0.05, HZ0 + WALL, WALL + 0.1, top, apex - 0.05));
  if (lod === 2) return;
  // The eaves faced with plaques, hung under the tiles' edge along each side ...
  const ph = 0.42;
  for (const s of [-1, 1]) placePlaques(zFront - zBack, ph, 0.1, s * (HX + OVER - 0.06), eY, (zFront + zBack) / 2, 0, Math.PI / 2, lod, out);
  // ... and the gables' raking edges, front and back, from the eave up to the ridge.
  const xe = HX + OVER;
  const run = Math.hypot(xe, apex - eY);
  const climb = Math.atan2(apex - eY, xe);
  for (const z of [zFront - 0.06, zBack + 0.06]) {
    for (const s of [-1, 1]) placePlaques(run, ph * 0.85, 0.1, (s * xe) / 2, (eY + apex) / 2, z, s > 0 ? -climb : climb, 0, lod, out);
  }
  // The acroteria at the ridge's ends: a painted terracotta disc on a plinth, a palmette on each eave's corner.
  for (const [z, dz] of [[zf + 0.15, 1], [HZ0 - 0.1, -1]]) {
    acroterion(apex, z, lod, out);
    for (const s of [-1, 1]) {
      const palm = revolve(profileOf([[0, 0], [0.1, 0], [0.16, 0.14], [0.12, 0.32], [0.04, 0.42], [0, 0.44]]), { segments: lod ? 5 : 8, metres: 0.5 });
      palm.scale(1, 1, 0.25);
      palm.translate(s * (HX + OVER - 0.05), eY + 0.02, z + dz * 0.05);
      out.clay.push(tintGeometry(boxUV(palm), () => TC.red));
    }
  }
}

/** The porch: the timber architrave on the columns (instanced apart), its plaques, the benches and the lampstands. */
function porch(lod, seed, out) {
  const ab = PY + C.colH;
  const pz = C.porchZ;
  const bh = C.eave - ab;
  // The timber architrave: a beam across the front on the columns, one down each side to the hall's front.
  out.wood.push(box(2 * HX, bh, 0.5, 0, ab, pz, 0.92));
  const xs = C.cols[C.cols.length - 1];
  for (const s of [-1, 1]) out.wood.push(box(0.4, bh, pz - HZ1 + 0.3, s * xs, ab, (pz + HZ1 + 0.3) / 2, 0.92));
  // Its face covered in painted plaques.
  if (lod < 2) placePlaques(2 * HX, bh * 0.95, 0.06, 0, ab + bh, pz + 0.28, 0, 0, lod, out);
  else out.clay.push(box(2 * HX, bh * 0.95, 0.06, 0, ab + bh * 0.05, pz + 0.25, () => TC.red));
  // Benches of tufa along the hall's front, either side of the door.
  for (const s of [-1, 1]) {
    const bx = s * 3.15;
    out.floor.push(slab(1.9, 0.08, 0.5, { bevel: 0.01, seed: seed + 10 + s, wobble: 0, tone: 0, grime: 0 }).translate(bx, PY + 0.4, HZ1 + 0.35));
    for (const e of [-1, 1]) out.floor.push(slab(0.16, 0.4, 0.44, { bevel: 0.012, seed: seed + 12 + e, wobble: 0.002, tone: 0.03, grime: 0.2 }).translate(bx + e * 0.78, PY, HZ1 + 0.35));
  }
  // Bronze lampstands (candelabra) on lion's-foot tripods, a lantern on each.
  for (const [lx, ly, lz] of C.lamps) {
    out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.025, 0.035, ly - PY - 0.1, lod ? 5 : 8, 1).translate(lx, PY + (ly - PY - 0.1) / 2 + 0.06, lz))));
    out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.11, 0.06, 0.06, lod ? 5 : 10, 1).translate(lx, ly - 0.06, lz))));
    if (lod < 2) {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const leg = new BoxGeometry(0.03, 0.03, 0.26);
        leg.rotateX(0.5);
        leg.rotateY(a);
        leg.translate(lx + Math.sin(a) * 0.09, PY + 0.07, lz + Math.cos(a) * 0.09);
        out.bronze.push(tintGeometry(boxUV(leg)));
      }
      const l = lantern(lx, ly - 0.01, lz, lod);
      out.bronze.push(...l.bronze);
      out.pane.push(l.pane);
    }
  }
}

/** The honorary statues at the foot of the steps: bronze men in the toga on pedestals of tufa. */
function statues(lod, seed, out) {
  const [sw, sz] = C.steps;
  for (const s of [-1, 1]) {
    const st = statue(s * (sw + 0.3), sz - 0.55, s * -0.25, { y0: 0.06, h: 1.15, kind: 'togate', lod, base: 0.95 });
    out.tufa.push(...st.base);
    out.statue.push(...st.statue);
  }
}

/**
 * The senate's people (people/actors.js specs, the curia's metres), by
 * state: in session ('open') senators in the toga over the tunic of the
 * broad purple stripe on the steps and in the porch, talking, two seated on
 * the bench, one pacing before the steps; the magistrate at the door in the
 * toga praetexta addressing them; his lictors at the foot of the steps with
 * the fasces on their shoulders. Under threat ('out'): soldiers of the guard
 * at the door and the foot of the steps, the doors barred. Nobody while it
 * stands empty.
 */
export function curiaActors(state) {
  const [, sz, n] = C.steps;
  const rise = PY / n;
  const tread = (sz - C.podium[1]) / n;
  const onStep = (i) => [rise * i, sz - i * tread + 0.18];
  if (state === 'out') {
    const guard = { body: 'm', dress: ['tunic:knee', 'lorica', 'caligae', 'helmet'], hair: 'crop', clip: 'guard', props: { R: 'spear', L: 'scutum' }, colours: { tunic: DYES.madder, accent: DYES.madder, metal: 0x8a8c90 } };
    return [
      { ...guard, at: [-1.05, PY, C.podium[1] - 0.15], ry: 0, seed: 81 },
      { ...guard, at: [1.05, PY, C.podium[1] - 0.15], ry: 0, seed: 82 },
      { ...guard, at: [-C.steps[0] - 0.5, 0.06, sz + 0.4], ry: 0.2, seed: 83 },
      { ...guard, at: [C.steps[0] + 0.5, 0.06, sz + 0.4], ry: -0.2, seed: 84 },
    ];
  }
  if (state !== 'open') return [];
  const senator = (seed, extra) => ({ body: 'm', dress: ['tunic:knee:broad', 'toga'], hair: seed % 3 ? 'crop' : 'bald', old: seed % 3 === 0, colours: { tunic: DYES.white, mantle: DYES.candida, trim: DYES.purple }, seed, ...extra });
  const list = [];
  // On the steps: two talking, one listening, going up to the session.
  const [y3, z3] = onStep(3);
  const [y1, z1] = onStep(1);
  list.push(senator(91, { clip: 'talk', at: [-1.15, y3, z3], ry: Math.PI + 0.5 }));
  list.push(senator(92, { clip: 'listen', at: [-0.55, y3, z3 - 0.1], ry: Math.PI - 0.9 }));
  list.push(senator(93, { clip: 'idle', at: [0.9, y1, z1], ry: Math.PI - 0.15 }));
  // Pacing before the steps, stopping to look up at the door.
  list.push(senator(94, { clip: 'walk', at: [-2.4, 0.06, sz + 1.35], ry: Math.PI / 2, route: { length: 4.6, speed: 0.8, pauseEnd: 5, pauseStart: 6, clipEnd: 'listen', clipStart: 'idle', faceEnd: Math.PI, faceStart: Math.PI } }));
  // Two talking in the porch.
  list.push(senator(95, { clip: 'talk', at: [-3.05, PY, 2.25], ry: 0.85 }));
  list.push(senator(96, { clip: 'listen', at: [-2.35, PY, 2.75], ry: -2.3 }));
  // Two seated on the bench to the right, one making his point.
  list.push(senator(97, { clip: 'sit', at: [2.6, PY + 0.46 - SEAT_H, HZ1 + 0.42], ry: 0.1 }));
  list.push(senator(98, { clip: 'teach', at: [3.65, PY + 0.46 - SEAT_H, HZ1 + 0.42], ry: -0.25 }));
  // The magistrate at the door in the toga praetexta, addressing them.
  list.push(senator(99, { clip: 'orate', dress: ['tunic:knee:broad', 'toga'], at: [0.35, PY, HZ1 + 0.95], ry: 0.2, colours: { tunic: DYES.white, mantle: DYES.candida, trim: DYES.purple, accent: DYES.murex } }));
  // His lictors at the foot of the steps, the fasces on their shoulders.
  const lictor = { body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'shoulder', props: { L: 'fasces' }, colours: { tunic: DYES.madder, accent: DYES.madder } };
  list.push({ ...lictor, at: [-2.55, 0.06, sz + 0.55], ry: 0.2, seed: 101 });
  list.push({ ...lictor, at: [-1.75, 0.06, sz + 0.7], ry: -0.1, seed: 102 });
  return list;
}

/** Build the curia: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut', 'out'). The porch's columns are not in it (government.js). */
export function buildCuria({ lod = 0, seed = 401 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['tufa', 'paving', 'stucco', 'red', 'joints', 'tile', 'wood', 'clay', 'bronze', 'letters', 'dark', 'floor', 'statue', 'pane'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  podium(lod, seed, out);
  hall(lod, seed + 100, out);
  porch(lod, seed + 200, out);
  statues(lod, seed + 300, out);
  const m = curiaMaterials();
  const p = new TaggedParts('curia');
  const small = { cast: false };
  if (lod === 2) out.letters = [];
  p.add('stone', m.tufa, out.tufa);
  p.add('paving', m.tufa, out.paving, small);
  p.add('stucco', m.stucco, out.stucco);
  p.add('dado', m.red, out.red);
  p.add('joints', m.joint, out.joints, small);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  p.add('terracotta', m.clay, out.clay);
  p.add('bronze', m.bronze, out.bronze, { cast: lod === 0 });
  p.add('letters', m.letters, out.letters, small);
  p.add('inside', m.dark, out.dark, small);
  // The porch's floor inside the door and its benches under the roof: no snow on them.
  p.add('floor', m.shelteredStone, out.floor, small);
  p.add('statues', m.statueBronze, out.statue);
  // The doors: timber studded with bronze, shut (idle, or barred against a mob) or open (in session).
  const [dw, dh] = C.door;
  const shut = doubleDoor(0, HZ1 - WALL / 2 + 0.05, 2 * dw, dh, PY, { open: false, lod });
  const open = doubleDoor(0, HZ1 - WALL / 2 + 0.05, 2 * dw, dh, PY, { open: true, lod });
  p.add('doors', m.wood, open.wood, { when: 'open' });
  p.add('doors', m.wood, shut.wood, { when: 'shut' });
  p.add('doors', m.wood, shut.wood.map((g) => g.clone()), { when: 'out' });
  p.add('door-studs', m.bronze, open.bronze, { when: 'open' });
  p.add('door-studs', m.bronze, shut.bronze, { when: 'shut' });
  p.add('door-studs', m.bronze, shut.bronze.map((g) => g.clone()), { when: 'out' });
  // The lanterns' panes: lit while there is anyone there (in session, or the guard), dark when idle.
  p.add('lamp', lanternPane(), out.pane, { when: 'staffed', cast: false });
  p.add('lamp', m.lampOut, out.pane.map((g) => g.clone()), { when: 'shut', cast: false });
  // (The senators, the magistrate, his lictors and the guard are actors: curiaActors.)
  return p.build();
}

/** The curia's lamps for models.js modelLamps: the porch's lanterns, facing the street. */
export const CURIA_LAMPS = Object.freeze(C.lamps.map(([x, y, z]) => Object.freeze([x, y + 0.1, z, 1])));
