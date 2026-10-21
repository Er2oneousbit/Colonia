/**
 * models/basilica.js
 * ----------------------------------------------------------------------------
 * The Hall of Justice (basilica) of the 3D look, a monument on a 5 x 5
 * footprint (20 m), as the earliest kind of basilica, from the record
 * rather than the 2D sprite:
 *
 *   - The Basilica Porcia (184 BC) and the Aemilia (179 BC) as first built,
 *     on the Forum Romanum: a long roofed hall beside the forum, a nave
 *     between aisles on columns, its walls carried up over the aisles'
 *     roofs as a clerestory to light it, a portico on the forum side where
 *     the money changers set their tables, the courts sitting inside, the
 *     merchants and the idle meeting out of the rain.
 *   - Pompeii's basilica (late second century BC), the best kept: five
 *     doors from the forum, a nave ringed by columns of brick stuccoed, the
 *     tribunal raised at the far end, where the magistrate sat.
 *   - Vitruvius (V.1) and the basilica he built at Fano: its breadth a
 *     third to a half of its length, the aisles a third of the nave's
 *     width, the roof a gable over the nave (its trusses of timber).
 *   - Building it, as the republic's builders did: foundations and walls of
 *     tufa ashlar (opus quadratum), the blocks laid in courses and lifted
 *     by a crane on the treadwheel or by shear legs; the column drums
 *     stacked, fluted and stuccoed only once they stand; the whole
 *     stuccoed and painted at the end (the first Pompeian style: a red
 *     dado, the field above in cream, the stucco scored as blocks); the
 *     timber trusses raised one by one, then the tiles. No concrete is
 *     used in it, no brick, and no vault: those are later.
 *
 * So, in 20 m: a podium of tufa with four steps up from the street to a
 * portico of eight Ionic columns, BASILICA cut in its frieze; behind it
 * the hall's front with three doors; the hall, 18.8 by 11 m, its walls of
 * tufa stuccoed, a red dado and cream above, with high windows, aisles
 * under lean-to roofs on all four sides, the nave's clerestory of plain
 * rectangular windows over them under a tiled gable; inside, the tribunal,
 * a raised rectangular platform at the back of the nave with steps up, a
 * timber rail, the magistrate's curule chair, the assessors' bench and the
 * statue of the colony's founder on a column. Twelve Ionic columns inside
 * (the back row broken where the tribunal stands, its architrave there of
 * timber) and the porch's eight are kits of their own (instanced:
 * models/monumentModels.js), tufa drums stuccoed white.
 *
 * Built in its four stages (data/monuments.js), each rising as its work is
 * done (`prog`: the stage plus the quarter of it done, worksite.js
 * siteView): the foundations (the plan set out with stakes and cords,
 * trenches, the podium's tufa courses rising), the walls and piers (the
 * ashlar courses, the column drums stacked, the porch's columns, the
 * clerestory), the roof (the trusses one by one along the nave, each hoisted
 * on slings, the aisles' rafters, the tiles), the tribunal (the platform
 * of tufa, its steps and rail, the chair, the bench, the founder's
 * column), each with its site dressing (models/worksite.js). Finished:
 * stucco, the statue, the doors.
 *
 * Metres, the footprint's middle at the origin, y up, the street (the
 * forum) toward +z. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { slab, paving, TaggedParts, tuscanColumn } from './masonry.js';
import { material } from '../materials.js';
import { artRng } from '../texgen.js';
import { govMaterials, box, D, gable, slope, gableTri, rake, wallAlong, darkIn, doubleDoor, letters, statue, lantern, lanternPane, column, lin, FRESCO } from './domus.js';
import { DYES } from '../people/actors.js';
import { SEAT_H } from '../people/clips.js';
import { crewMason, crewCarrier, crewMixer, crewForeman, LIFT } from './worksite.js';

/** The basilica's measures (metres): the tests, the lab and the game read them. */
export const BASILICA3D = Object.freeze({
  half: 10,
  /** The podium's top: the porch's and the hall's floor. */
  floorY: 0.9,
  /** The podium: x half width, its back and front z. */
  podium: Object.freeze([9.7, -6.7, 7.4]),
  /** The steps: half width, the foot's z, their number. */
  steps: Object.freeze([8.6, 9.4, 4]),
  /** The hall's outer faces: x half width, back z, front z; its walls' thickness and top. */
  hall: Object.freeze([9.4, -6.4, 4.6]),
  wallT: 0.6,
  wallTop: 7.9,
  /** The red dado's height over the floor line, on the outer walls. */
  dado: 1.5,
  /** The nave's column lines (z, front and back), its columns along x, its ends (x), the end columns' z. */
  nave: Object.freeze({ zf: 2.2, zb: -4.0, xs: Object.freeze([-7.0, -4.2, -1.4, 1.4, 4.2, 7.0]), zEnd: -0.9 }),
  colH: 6.0,
  /** The clerestory's top (the nave roof's eave), its windows' sill and head over the floor line. */
  clerTop: 11.0,
  /** The aisles' roof: from the outer walls' top up to this height at the clerestory. */
  aisleTop: 9.3,
  /** The porch: its columns' line (z), their x, their height. */
  porchZ: 6.9,
  porchXs: Object.freeze([-8.4, -6.0, -3.6, -1.2, 1.2, 3.6, 6.0, 8.4]),
  porchH: 5.0,
  /**
   * The tribunal, a raised rectangle against the back wall's inner face
   * (z -5.8) reaching into the nave: its half width (x), its height over
   * the floor, its front z; its steps' half width and number; the chair's
   * z, the founder's column (x, z, height).
   */
  tribunal: Object.freeze({ hw: 3.0, y: 1.1, z: -2.7, stepHW: 1.3, steps: 3, chairZ: -4.7, column: Object.freeze([2.5, -5.2, 3.0]) }),
  /** The doors in the front wall: x middle, half width, height over the floor. */
  doors: Object.freeze([Object.freeze([0, 1.3, 4.4]), Object.freeze([-4.2, 0.9, 3.6]), Object.freeze([4.2, 0.9, 3.6])]),
  /** The lampstands' lanterns (x, y, z) in the porch by the middle door. */
  lamps: Object.freeze([Object.freeze([-2.2, 2.75, 5.6]), Object.freeze([2.2, 2.75, 5.6])]),
});

const B = BASILICA3D;
const Y0 = B.floorY;
const [HX, HZ0, HZ1] = B.hall;
const T = B.wallT;
/** The back wall's inner face, where the tribunal's platform stands against it. */
const BACK = HZ0 + T;
/** A course of ashlar: the height the joints are scored at, and the blocks' length. */
const COURSE = 0.5;
const BLOCK = 1.2;
/** The painted stucco's colours (linear): cream over the red dado. */
const CREAM = lin(0xf2e6c4);

/** A share of a span: 0 before a, 1 after b, in between in proportion. */
const share = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));

/**
 * When each part goes up, in `prog` (the stage, 0 to 4, plus the share of
 * it done in quarters): [start, end] of its rise. The schedule the stage's
 * look and its site dressing follow.
 */
export const SCHEDULE = Object.freeze({
  setOut: [0, 0.25], // stakes, cords and trenches, gone once the podium rises
  podium: [0, 1], // the tufa courses of the podium, moulded at 1
  walls: [1, 1.75], // the outer walls
  columns: [1, 1.5], // the nave's drums stacked; finished (fluted, stuccoed) at 1.75
  porch: [1.25, 1.75], // the porch's drums; finished at 1.75
  clerestory: [1.75, 2.25],
  trusses: [2.25, 2.75],
  rafters: [2.5, 2.75],
  tiles: [2.75, 3],
  dais: [3, 3.5], // the tribunal's platform, course by course
  rail: [3.5, 3.75], // its steps and its timber rail
  fittings: [3.75, 4], // the chair, the bench, the founder's column
});

/** The look's progress from the sim's view of it (worksite.js siteView): the stage plus its quarters done. */
export function progOf(view) {
  return Math.min(4, view.stage + (view.finished ? 0 : view.step / 4));
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** A box from (x0, y0, z0) to (x1, y1, z1), tone k (empty if flat). */
function span(x0, x1, y0, y1, z0, z1, k = 1) {
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return null;
  return box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, k);
}

/** Is the point (p along the wall, y) in or against one of the openings? */
const inOpening = (openings, p, y, pad = 0.1) => openings.some((o) => p > o.a - pad && p < o.b + pad && y > o.lo - pad && y < o.hi + pad);

/**
 * The stucco scored to look like ashlar (lod 0): a joint every COURSE up
 * the wall, the vertical joints staggered BLOCK apart, thin boxes proud of
 * both faces (the joint material, a shade darker than the face), stopping
 * at the openings.
 */
function scoreJoints(axis, a, b, at, t, y0, y1, openings, out, lod) {
  if (lod > 0) return;
  const th = t + 0.03;
  for (let y = y0 + COURSE; y < y1 - 0.05; y += COURSE) out.joint.push(...wallAlong(axis, a, b, at, th, y - 0.007, y + 0.007, openings, 0.92));
  let row = 0;
  for (let y = y0; y < y1 - COURSE + 1e-6; y += COURSE, row++) {
    for (let p = a + (row % 2 ? BLOCK / 2 : BLOCK); p < b - 0.1; p += BLOCK) {
      if (inOpening(openings, p, y + COURSE / 2, 0.05)) continue;
      out.joint.push(axis === 'x' ? box(0.014, COURSE, th, p, y, at, 0.92) : box(th, COURSE, 0.014, at, y, p, 0.92));
    }
  }
}

/**
 * A wall along x (axis 'x', a to b, its middle at `at`) or z, from y0 to its
 * full height `yTop`, built to `f` of it: plain boxes round its openings
 * (wallAlong), and while it rises a ragged top (the next course's blocks
 * set along it, some still to come, lod 0 and 1). Under construction it is
 * bare tufa (out.tufa); finished it is stuccoed and painted (out.paint):
 * a red dado `dado` high, cream above it, the joints scored. Pushes to out
 * and returns the height reached.
 */
function riseWall(axis, a, b, at, t, y0, yTop, f, openings, out, lod, seed, { done = false, dado = 0 } = {}) {
  if (f <= 0) return y0;
  const y1 = y0 + (yTop - y0) * f;
  if (done) {
    const d = Math.min(y1, y0 + dado);
    if (dado > 0) out.paint.push(...wallAlong(axis, a, b, at, t, y0, d, openings, () => FRESCO.dado));
    out.paint.push(...wallAlong(axis, a, b, at, t, d, y1, openings, () => CREAM));
    scoreJoints(axis, a, b, at, t, y0, y1, openings, out, lod);
    return y1;
  }
  out.tufa.push(...wallAlong(axis, a, b, at, t, y0, y1, openings, 0.95));
  if (f < 1 && lod < 2) {
    // The course being laid: blocks set along the top with gaps where the crane has yet to bring them.
    const rnd = artRng(seed);
    const n = Math.floor((b - a) / BLOCK);
    for (let i = 0; i < n; i++) {
      if (i % 3 === 2 || (lod === 1 && i % 2)) continue;
      const p = a + (i + 0.5) * BLOCK;
      if (openings.some((o) => p > o.a && p < o.b && y1 > o.lo && y1 < o.hi)) continue;
      const h = COURSE * (0.5 + 0.5 * rnd());
      out.tufa.push(axis === 'x' ? box(BLOCK * 0.96, h, t * 0.96, p, y1, at, 0.88 + rnd() * 0.08) : box(t * 0.96, h, BLOCK * 0.96, at, y1, p, 0.88 + rnd() * 0.08));
    }
  }
  return y1;
}

/** A column under construction: smooth drums stacked to `f` of its height on its base (unfluted until it stands whole). */
function drums(x, z, h, f, lod, out, y0 = Y0) {
  if (f <= 0) return;
  const r = h / 18;
  const seg = lod === 2 ? 6 : lod ? 10 : 18;
  out.tufa.push(slab(r * 3, 0.18, r * 3, { bevel: 0.01, seed: x * 7 + z, wobble: 0, tone: 0.03, grime: 0.1 }).translate(x, y0, z));
  const dh = 0.85;
  const n = Math.min(Math.round((h - 0.4) / dh), Math.floor(((h - 0.4) / dh) * f + 1e-6));
  for (let i = 0; i < n; i++) {
    const g = new CylinderGeometry(r * (1 - 0.15 * ((i + 1) * dh) / h), r * (1 - 0.15 * (i * dh) / h), dh - 0.01, seg, 1);
    g.translate(x, y0 + 0.18 + i * dh + dh / 2, z);
    out.tufa.push(tintGeometry(boxUV(g), () => 0.93 + 0.05 * (i % 2)));
  }
}

/**
 * The podium: tufa ashlar laid in courses round a rubble core while it
 * rises (f < 1), the outer ring a course ahead of the core, or faced and
 * moulded (f = 1) with its steps.
 */
function podium(prog, done, lod, seed, out) {
  const [px, pz0, pz1] = B.podium;
  const f = share(prog, ...SCHEDULE.podium);
  if (f < 1) {
    if (f > 0) {
      const h = Y0 * f;
      out.rubble.push(span(-px + 0.6, px - 0.6, 0, h * 0.97, pz0 + 0.6, pz1 - 0.6, 0.62));
      // The ring of ashlar: whole courses, the last of them one course of blocks short of its run.
      const hc = Math.min(Y0, Math.max(COURSE * 0.5, Math.floor(h / (COURSE * 0.9)) * COURSE * 0.9));
      out.tufa.push(span(-px, px, 0, hc, pz1 - 0.6, pz1, 0.85), span(-px, px, 0, hc, pz0, pz0 + 0.6, 0.85));
      for (const s of [-1, 1]) out.tufa.push(span(s > 0 ? px - 0.6 : -px, s > 0 ? px : -px + 0.6, 0, hc, pz0 + 0.6, pz1 - 0.6, 0.85));
      // Blocks waiting on the course below the next to be set, along the front.
      if (lod < 2) for (let x = -px + 0.8; x < px - 0.5; x += 2.4) out.tufa.push(box(1.1, COURSE * 0.8, 0.55, x, hc, pz1 - 0.55, 0.9));
    }
    return;
  }
  // Faced: a moulded base, the die and a crown in tufa.
  out.tufa.push(span(-px, px, 0, Y0 - 0.12, pz0, pz1, 0.92));
  out.tufa.push(span(-px - 0.12, px + 0.12, 0, 0.22, pz0 - 0.12, pz1, 0.85));
  out.tufa.push(span(-px - 0.08, px + 0.08, Y0 - 0.12, Y0, pz0 - 0.08, pz1, 0.97));
  // The steps up the front, between cheeks: laid last, the strip before the podium being the yard till then.
  if (!done) return;
  const [sw, sz, n] = B.steps;
  const rise = Y0 / n;
  const tread = (sz - pz1) / n;
  for (let k = 0; k < n; k++) {
    const z0 = sz - (k + 1) * tread;
    out.tufa.push(slab(2 * sw, (k + 1) * rise, z0 + tread - pz1 + 0.02, { bevel: 0.012, seed: seed + k, wobble: lod ? 0 : 0.002, tone: 0.03, grime: 0.25 }).translate(0, 0, (pz1 - 0.02 + z0 + tread) / 2));
  }
  for (const s of [-1, 1]) out.tufa.push(slab(0.5, Y0 + 0.1, sz - pz1, { bevel: 0.015, seed: seed + 9 + s, wobble: 0, tone: 0.02, grime: 0.3 }).translate(s * (sw + 0.25), 0, (sz + pz1) / 2));
}

/** The plan set out on the ground (the start of the foundations): stakes and cords at the walls' lines, trenches dug along them. */
function setOut(prog, lod, out) {
  if (prog >= SCHEDULE.setOut[1]) return;
  const [px, pz0, pz1] = B.podium;
  // Trenches along the outer walls' lines and the nave's: dark earth, a spoil heap beside each.
  const lines = [[-px, px, pz1 - 0.4, pz1], [-px, px, pz0, pz0 + 0.4], [-px, -px + 0.4, pz0, pz1], [px - 0.4, px, pz0, pz1], [-7.4, 7.4, B.nave.zf - 0.25, B.nave.zf + 0.25], [-7.4, 7.4, B.nave.zb - 0.25, B.nave.zb + 0.25]];
  // (Over the yard's earth, 3 cm up: the trench's dark floor, the spoil heaped along its inner side (the footprint's edge is close).)
  for (const [k, [x0, x1, z0, z1]] of lines.entries()) {
    out.trench.push(span(x0, x1, 0.03, 0.04, z0, z1, 0.55));
    const alongX = x1 - x0 > z1 - z0;
    const r = new CylinderGeometry(0.28, 0.28, alongX ? x1 - x0 : z1 - z0, lod ? 5 : 8, 1);
    if (alongX) r.rotateZ(Math.PI / 2).scale(1, 0.4, 1).translate((x0 + x1) / 2, 0.08, (k === 1 ? z1 + 0.35 : z0 - 0.35));
    else r.rotateX(Math.PI / 2).scale(1, 0.4, 1).translate(k === 2 ? x1 + 0.35 : x0 - 0.35, 0.08, (z0 + z1) / 2);
    if (k < 4) out.trench.push(tintGeometry(boxUV(r), () => 0.85));
  }
  // Stakes at the corners and cords stretched between them (the groma set the right angles).
  const corners = [[-px - 0.2, pz0 - 0.25], [px + 0.2, pz0 - 0.25], [px + 0.2, pz1 + 0.3], [-px - 0.2, pz1 + 0.3]];
  for (const [x, z] of corners) out.boards.push(span(x - 0.04, x + 0.04, 0, 0.6, z - 0.04, z + 0.04, 0.7));
  if (lod < 2) {
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      out.cord.push(ax === bx ? span(ax - 0.006, ax + 0.006, 0.5, 0.512, Math.min(az, bz), Math.max(az, bz), 1) : span(Math.min(ax, bx), Math.max(ax, bx), 0.5, 0.512, az - 0.006, az + 0.006, 1));
    }
  }
}

/** The outer walls (front, sides, back), rising; finished, stuccoed and painted with a plinth, a cornice, sills and lintels. */
function outerWalls(prog, done, lod, seed, out) {
  const f = share(prog, ...SCHEDULE.walls);
  if (f <= 0) return;
  const top = B.wallTop;
  const opt = { done, dado: B.dado };
  // The front: three doors, two windows over the side doors' line at the ends.
  const front = [
    ...B.doors.map(([x, w, h]) => ({ a: x - w, b: x + w, lo: Y0, hi: Y0 + h })),
    ...[-7.2, 7.2].map((x) => ({ a: x - 0.6, b: x + 0.6, lo: Y0 + 3.0, hi: Y0 + 4.8 })),
  ];
  riseWall('x', -HX, HX, HZ1 - T / 2, T, Y0, top, f, front, out, lod, seed, opt);
  // The sides: four windows each, high.
  const sideWins = [-4.6, -1.9, 0.8, 3.1].map((z) => ({ a: z - 0.6, b: z + 0.6, lo: Y0 + 3.4, hi: Y0 + 5.4 }));
  for (const s of [-1, 1]) riseWall('z', HZ0 + T, HZ1 - T, s * (HX - T / 2), T, Y0, top, f, sideWins, out, lod, seed + s, opt);
  // The back: a plain wall behind the tribunal, a window either side of it.
  const back = [-6.6, 6.6].map((x) => ({ a: x - 0.6, b: x + 0.6, lo: Y0 + 3.4, hi: Y0 + 5.4 }));
  const y1 = riseWall('x', -HX, HX, HZ0 + T / 2, T, Y0, top, f, back, out, lod, seed + 5, opt);
  // Windows' dark.
  const winDark = (axis, a, b, lo, hi, at, n) => out.dark.push(darkIn(axis, a, b, lo, hi, at, n));
  for (const o of sideWins) for (const s of [-1, 1]) if (y1 > o.hi) winDark('z', o.a, o.b, o.lo, o.hi, s * (HX - T), -s);
  for (const o of front.slice(3)) if (y1 > o.hi) winDark('x', o.a, o.b, o.lo, o.hi, HZ1 - T, -1);
  for (const o of back) if (y1 > o.hi) winDark('x', o.a, o.b, o.lo, o.hi, HZ0 + T, 1);
  if (!done) return;
  // Finished: a plinth of tufa, a stucco cornice under the eave, the doors' frames in tufa, sills at the windows.
  out.tufa.push(span(-HX - 0.04, HX + 0.04, Y0, Y0 + 0.5, HZ1, HZ1 + 0.04, 0.92));
  for (const s of [-1, 1]) out.tufa.push(span(s > 0 ? HX : -HX - 0.04, s > 0 ? HX + 0.04 : -HX, Y0, Y0 + 0.5, HZ0, HZ1, 0.92));
  out.tufa.push(span(-HX - 0.04, HX + 0.04, Y0, Y0 + 0.5, HZ0 - 0.04, HZ0, 0.92));
  const cor = (x0, x1, z0, z1) => out.stucco.push(span(x0, x1, top - 0.32, top, z0, z1, 0.97));
  cor(-HX - 0.12, HX + 0.12, HZ1 - 0.02, HZ1 + 0.12);
  cor(-HX - 0.12, HX + 0.12, HZ0 - 0.12, HZ0 + 0.02);
  for (const s of [-1, 1]) cor(s > 0 ? HX - 0.02 : -HX - 0.12, s > 0 ? HX + 0.12 : -HX + 0.02, HZ0, HZ1);
  if (lod < 2) {
    for (const s of [-1, 1]) for (const o of sideWins) out.tufa.push(span(s > 0 ? HX - 0.02 : -HX - 0.1, s > 0 ? HX + 0.1 : -HX + 0.02, o.lo - 0.08, o.lo, o.a - 0.1, o.b + 0.1, 0.95));
  }
  for (const [x, w, h] of B.doors) {
    for (const s of [-1, 1]) out.tufa.push(span(x + s * w - (s > 0 ? 0 : 0.22), x + s * w + (s > 0 ? 0.22 : 0), Y0, Y0 + h + 0.1, HZ1 - 0.02, HZ1 + 0.1, 0.96));
    out.tufa.push(span(x - w - 0.3, x + w + 0.3, Y0 + h, Y0 + h + 0.32, HZ1 - 0.02, HZ1 + 0.14, 0.97));
  }
}

/** The nave's columns while they are drums (finished, they are instanced kits: naveColumns()). */
function naveDrums(prog, lod, out) {
  const f = share(prog, ...SCHEDULE.columns);
  if (prog >= 1.75) return;
  for (const [x, z] of naveColumns()) drums(x, z, B.colH, f, lod, out);
}

/**
 * The nave's column places [x, z]: both long rows, the end ones, and the
 * back row broken in the middle where the tribunal stands (its two middle
 * columns left out, the architrave there a timber one).
 */
export function naveColumns() {
  const { zf, zb, xs, zEnd } = B.nave;
  return [...xs.map((x) => [x, zf]), ...xs.filter((x) => Math.abs(x) > B.tribunal.hw).map((x) => [x, zb]), [xs[0], zEnd], [xs[xs.length - 1], zEnd]];
}

/** The porch's column places [x, z]. */
export function porchColumns() {
  return B.porchXs.map((x) => [x, B.porchZ]);
}

/** The architrave over the nave's columns, the clerestory's walls rising on it, their plain rectangular windows. */
function clerestory(prog, done, lod, seed, out) {
  if (prog < 1.75) return;
  const { zf, zb, xs } = B.nave;
  const x0 = xs[0] - 0.4;
  const x1 = xs[xs.length - 1] + 0.4;
  const e0 = Y0 + B.colH;
  const e1 = e0 + 0.6;
  // The architrave round the nave, stuccoed (the clerestory rises while it stands bare); across the tribunal's
  // opening in the back row a timber one carries the wall over the gap.
  const gap = xs.filter((x) => Math.abs(x) > B.tribunal.hw);
  const gx0 = gap.filter((x) => x < 0).pop() + 0.36;
  const gx1 = gap.filter((x) => x > 0)[0] - 0.36;
  out.stucco.push(span(x0, x1, e0, e1, zf - 0.36, zf + 0.36, 0.95));
  out.stucco.push(span(x0, gx0, e0, e1, zb - 0.36, zb + 0.36, 0.95), span(gx1, x1, e0, e1, zb - 0.36, zb + 0.36, 0.95));
  out.timber.push(span(gx0, gx1, e0, e1, zb - 0.3, zb + 0.3, 0.8));
  for (const x of [xs[0], xs[xs.length - 1]]) out.stucco.push(span(x - 0.36, x + 0.36, e0, e1, zb + 0.36, zf - 0.36, 0.95));
  const f = share(prog, ...SCHEDULE.clerestory);
  if (f <= 0) return;
  const t = 0.5;
  // Plain rectangular windows between the columns, their heads a hand under the clerestory's top.
  const sill = B.aisleTop + 0.15;
  const winH = 1.1;
  const wr = 0.45;
  const bays = [];
  for (let i = 0; i + 1 < xs.length; i++) bays.push((xs[i] + xs[i + 1]) / 2);
  const ops = bays.map((x) => ({ a: x - wr, b: x + wr, lo: sill, hi: sill + winH }));
  let y1 = e1;
  for (const z of [zf, zb]) y1 = riseWall('x', x0, x1, z, t, e1, B.clerTop, f, ops, out, lod, seed + z, { done });
  const zc = B.nave.zEnd + 1.6;
  const endOps = [{ a: zc - wr, b: zc + wr, lo: sill, hi: sill + winH }];
  for (const x of [xs[0], xs[xs.length - 1]]) riseWall('z', zb + t / 2, zf - t / 2, x, t, e1, B.clerTop, f, endOps, out, lod, seed + x, { done });
  if (y1 >= sill + winH) {
    for (const z of [zf, zb]) {
      const s = z === zf ? 1 : -1;
      for (const x of bays) {
        out.dark.push(darkIn('x', x - wr, x + wr, sill, sill + winH, z - s * t / 2, -s, 0.04));
        // A sill of tufa under each window, finished.
        if (done && lod < 2) out.tufa.push(span(x - wr - 0.08, x + wr + 0.08, sill - 0.08, sill, z - t / 2 - 0.05, z + t / 2 + 0.05, 0.95));
      }
    }
    for (const x of [xs[0], xs[xs.length - 1]]) {
      const s = x > 0 ? 1 : -1;
      out.dark.push(darkIn('z', zc - wr, zc + wr, sill, sill + winH, x - s * t / 2, -s, 0.04));
    }
  }
}

/** One roof truss at x, raised `yo` over its seat: a tie beam across the nave, two rafters, a king post, struts. */
function truss(x, yo, half, ridge, zc, lod, out) {
  const { zf, zb } = B.nave;
  const base = B.clerTop + yo;
  out.timber.push(span(x - 0.13, x + 0.13, base - 0.1, base + 0.18, zb - 0.3, zf + 0.3, 0.85));
  for (const s of [-1, 1]) {
    out.timber.push(beamBetween([x, base + 0.1, zc + s * (half + 0.1)], [x, ridge + yo, zc], 0.2, 0.82));
    if (lod < 2) out.timber.push(beamBetween([x, base + 0.18, zc], [x, base + 0.1 + (ridge - B.clerTop) * 0.55, zc + s * half * 0.45], 0.14, 0.8));
  }
  out.timber.push(span(x - 0.1, x + 0.1, base + 0.18, ridge + yo, zc - 0.1, zc + 0.1, 0.8));
}

/** The roof: the nave's trusses going up along it, the aisles' rafters, then the tiles; the gable ends. */
function roofs(prog, done, lod, seed, out) {
  const { zf, zb, xs } = B.nave;
  const x0 = xs[0] - 0.25;
  const x1 = xs[xs.length - 1] + 0.25;
  const tr = share(prog, ...SCHEDULE.trusses);
  const tiled = done || prog >= SCHEDULE.tiles[1];
  const aisleTiled = done || prog >= SCHEDULE.tiles[0];
  const pitch = D(23);
  const half = (zf - zb) / 2 + 0.25;
  const ridge = B.clerTop + half * Math.tan(pitch);
  const zc = (zf + zb) / 2;
  // The trusses: made on the ground, hoisted on slings and set on the clerestory's walls, from the -x end along.
  if (tr > 0 && !tiled) {
    const n = 7;
    const shown = Math.ceil(n * tr - 1e-6);
    const xAt = (i) => x0 + 0.2 + ((x1 - x0 - 0.4) * i) / (n - 1);
    for (let i = 0; i < shown; i++) {
      // The last one up while the work is not done: still a metre and a half off its seat, hanging on its slings.
      const hoisted = i === shown - 1 && tr < 1;
      const yo = hoisted ? 1.5 : 0;
      truss(xAt(i), yo, half, ridge, zc, lod, out);
      if (hoisted && lod < 2) {
        const hook = [xAt(i), ridge + yo + 2.4, zc];
        for (const s of [-1, 1]) out.cord.push(beamBetween([xAt(i), B.clerTop + yo + 0.1, zc + s * (half + 0.1)], hook, 0.035, 0.9));
      }
    }
    // The ridge beam and purlins along the trusses set so far.
    if (shown > 1 && lod < 2) {
      const xe = xAt(shown - (tr < 1 ? 2 : 1));
      out.timber.push(span(x0 + 0.1, xe + 0.1, ridge - 0.12, ridge + 0.05, zc - 0.08, zc + 0.08, 0.8));
      for (const s of [-1, 1]) for (const k of [0.35, 0.7]) {
        const y = B.clerTop + 0.1 + (ridge - B.clerTop - 0.1) * k;
        const z = zc + s * (half + 0.1) * (1 - k);
        out.timber.push(span(x0 + 0.1, xe + 0.1, y, y + 0.14, z - 0.07, z + 0.07, 0.78));
      }
    }
  }
  // The aisles' rafters (before their tiles): timbers from the outer walls up to the clerestory.
  const rf = share(prog, ...SCHEDULE.rafters);
  const top = B.wallTop;
  const at = B.aisleTop;
  if (rf > 0 && !aisleTiled && lod < 2) {
    for (let x = -HX + 0.4; x < HX; x += 1.2) {
      if (Math.abs(x) > xs[xs.length - 1] + 0.3) continue;
      out.timber.push(beamBetween([x, top + 0.05, HZ1 - 0.1], [x, at, zf + 0.25], 0.14, 0.8));
      out.timber.push(beamBetween([x, top + 0.05, HZ0 + 0.1], [x, at, zb - 0.25], 0.14, 0.8));
    }
  }
  if (aisleTiled) {
    const o = 0.3;
    // Four lean-to slopes from the outer walls' tops up to the clerestory, meeting at the hips.
    const eY = top - 0.02;
    const q = [
      [[HX + o, eY, HZ1 + o], [-HX - o, eY, HZ1 + o], [x0, at, zf + 0.25], [x1, at, zf + 0.25]],
      [[-HX - o, eY, HZ0 - o], [HX + o, eY, HZ0 - o], [x1, at, zb - 0.25], [x0, at, zb - 0.25]],
      [[-HX - o, eY, HZ1 + o], [-HX - o, eY, HZ0 - o], [x0, at, zb - 0.25], [x0, at, zf + 0.25]],
      [[HX + o, eY, HZ0 - o], [HX + o, eY, HZ1 + o], [x1, at, zf + 0.25], [x1, at, zb - 0.25]],
    ];
    q.forEach((quad, k) => {
      const r = slope(quad, { lod, seed: seed + k * 3, antefix: lod === 0 });
      out.tile.push(...r.tile);
      out.wood.push(...r.wood);
    });
  }
  if (tiled) {
    const r = gable({ x0, x1, z0: zb - 0.25, z1: zf + 0.25, eaveY: B.clerTop, pitch, along: 'x', over: 0.35, gableOver: 0.3, lod, seed: seed + 20 });
    out.tile.push(...r.tile);
    out.wood.push(...r.wood);
    // The gable ends: pediments over the clerestory's ends (cream once painted).
    for (const s of [-1, 1]) {
      const g = gableTri(zb - 0.25, zf + 0.25, 0, 0.5, B.clerTop, r.ridgeY - 0.05);
      g.rotateY(-s * Math.PI / 2);
      g.translate(s * (xs[xs.length - 1] + 0.25) - s * 0.0, 0, (zb + zf) / 2 - 0 * s);
      out[done ? 'paint' : 'tufa'].push(recentre(g, zb, zf));
      if (done && lod < 2) {
        const zA = zb - 0.55;
        const zB = zf + 0.55;
        const g2 = rake(zA, B.clerTop - 0.06, (zA + zB) / 2, r.ridgeY + 0.02, 0, 0.36, 0.2);
        g2.rotateY(-s * Math.PI / 2);
        g2.translate(s * (xs[xs.length - 1] + 0.3), 0, 0);
        out.stucco.push(g2);
      }
    }
  }
}

/** gableTri builds along x over [a, b]; turned a quarter onto z it sits about its own middle: put it back over [zb, zf]. */
function recentre(g, zb, zf) {
  g.computeBoundingBox();
  const bb = g.boundingBox;
  g.translate(0, 0, (zb + zf) / 2 - (bb.min.z + bb.max.z) / 2);
  return g;
}

/** A squared timber from a to b, w square, tone k. */
function beamBetween(a, b, w, k = 1) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.max(1e-3, Math.hypot(dx, dy, dz));
  const g = new BoxGeometry(w, len, w);
  g.translate(0, len / 2, 0);
  g.rotateX(Math.acos(Math.max(-1, Math.min(1, dy / len))));
  g.rotateY(Math.atan2(dx, dz));
  g.translate(a[0], a[1], a[2]);
  return tintGeometry(boxUV(g), () => k);
}

/** The porch: its columns' drums while they rise, its entablature with BASILICA cut in the frieze, its roof, the lampstands. */
function porch(prog, done, lod, seed, out) {
  const f = share(prog, ...SCHEDULE.porch);
  if (prog < 1.75) {
    for (const [x, z] of porchColumns()) drums(x, z, B.porchH, f, lod, out);
    return;
  }
  if (prog < 2) return;
  const ab = Y0 + B.porchH;
  const pz = B.porchZ;
  const xL = B.porchXs[B.porchXs.length - 1] + 0.42;
  const zf = pz + 0.42;
  // Architrave, frieze, cornice along the front and back along each end to the hall (stuccoed tufa).
  const bands = lod === 2 ? [[0, 0.9, 0.56, 0.96]] : [[0, 0.16, 0.54, 0.95], [0.16, 0.16, 0.58, 0.97], [0.32, 0.4, 0.56, 0.95], [0.72, 0.1, 0.7, 0.97], [0.82, 0.1, 0.8, 0.99]];
  for (const [y, h, d, k] of bands) {
    out.stucco.push(box(2 * xL, h, d, 0, ab + y, pz, k));
    for (const s of [-1, 1]) out.stucco.push(box(d, h, zf - HZ1, s * (xL - d / 2), ab + y, (zf + HZ1) / 2, k));
  }
  if (done) {
    const fr = ab + 0.32;
    if (lod === 0) out.letters.push(...letters('BASILICA', fr + 0.06, pz + 0.285, 0.28));
    else if (lod === 1) out.letters.push(box(2.6, 0.26, 0.006, 0, fr + 0.07, pz + 0.284));
  }
  // The roof: a low tiled slope from the hall's front down to the cornice (once the hall's roof is on).
  if (done || prog >= SCHEDULE.tiles[1]) {
    const top = ab + 0.92;
    const r = slope([[xL + 0.12, top - 0.02, zf + 0.08], [-xL - 0.12, top - 0.02, zf + 0.08], [-xL - 0.12, top + 0.55, HZ1 + 0.02], [xL + 0.12, top + 0.55, HZ1 + 0.02]], { lod, seed: seed + 5 });
    out.tile.push(...r.tile);
    out.wood.push(...r.wood);
  }
  // The porch's floor: tufa flags on the podium, finished.
  if (done) out.tufa.push(...paving(-HX, HX, HZ1, B.podium[2] + 0.04, 0.03, seed + 50, { rowW: 0.9, minL: 0.9, maxL: 1.5, lod, tone: 0.05, grime: 0.05 }).map((p) => p.translate(0, Y0, 0)));
}

/**
 * The tribunal: a rectangular platform of tufa against the back wall,
 * rising course by course (stage 3), then its steps and its timber rail,
 * then the magistrate's curule chair, the assessors' bench and the
 * founder's statue on its column.
 */
function tribunal(prog, done, lod, seed, out) {
  const f = share(prog, ...SCHEDULE.dais);
  if (f <= 0) return;
  const { hw, y: ht, z: zFront, stepHW, steps, chairZ, column: [cx, cz, ch] } = B.tribunal;
  const h = ht * f;
  const ty = Y0 + ht;
  // The platform: tufa to the course reached; whole once its steps go in (the top slab laid with them).
  out.tufa.push(span(-hw, hw, Y0, Y0 + h, BACK, zFront, 0.9));
  if (f < 1) return;
  out.tufa.push(span(-hw - 0.06, hw + 0.06, ty - 0.1, ty, BACK, zFront + 0.06, 0.97));
  if (prog < SCHEDULE.rail[0] && !done) return;
  const n = steps;
  for (let k = 0; k < n; k++) out.tufa.push(span(-stepHW, stepHW, Y0, Y0 + (ht * (k + 1)) / (n + 1), zFront, zFront + (n - k) * 0.34, 0.96));
  // The timber rail: posts and two bars along the sides and the front, open at the steps.
  const post = (x, z) => out.timber.push(span(x - 0.045, x + 0.045, ty, ty + 0.95, z - 0.045, z + 0.045, 0.8));
  const bars = (x0, x1, z0, z1) => { for (const y of [0.9, 0.55]) out.timber.push(span(x0, x1, ty + y, ty + y + 0.06, z0, z1, 0.82)); };
  for (const s of [-1, 1]) {
    for (let z = BACK + 0.4; z < zFront - 0.1; z += 1.0) post(s * (hw - 0.1), z);
    post(s * (hw - 0.1), zFront - 0.1);
    bars(s > 0 ? hw - 0.13 : -hw + 0.07, s > 0 ? hw - 0.07 : -hw + 0.13, BACK + 0.3, zFront - 0.07);
    for (let x = stepHW + 0.9; x < hw - 0.2; x += 0.9) post(s * x, zFront - 0.1);
    post(s * stepHW, zFront - 0.1);
    bars(s > 0 ? stepHW : -hw + 0.1, s > 0 ? hw - 0.1 : -stepHW, zFront - 0.13, zFront - 0.07);
  }
  if (prog < SCHEDULE.fittings[0] && !done) return;
  // The curule chair (sella curulis): an ivory seat on crossed legs, in the middle before the back wall.
  out.ivory.push(span(-0.3, 0.3, ty + SEAT_H - 0.06, ty + SEAT_H, chairZ - 0.24, chairZ + 0.24, 1));
  for (const s of [-1, 1]) for (const d of [-1, 1]) out.ivory.push(beamBetween([s * 0.26, ty, chairZ + d * 0.22], [s * 0.26, ty + SEAT_H - 0.06, chairZ - d * 0.22], 0.04, 0.95));
  // The assessors' bench along the back wall behind the chair, a seat of tufa on two slabs.
  out.tufa.push(slab(4.0, 0.08, 0.45, { bevel: 0.01, seed: seed + 1, wobble: 0, tone: 0.02, grime: 0.1 }).translate(0, ty + SEAT_H - 0.08, BACK + 0.3));
  for (const e of [-1, 1]) out.tufa.push(slab(0.14, SEAT_H - 0.08, 0.4, { bevel: 0.01, seed: seed + 2 + e, wobble: 0.002, tone: 0.03, grime: 0.2 }).translate(e * 1.9, ty, BACK + 0.3));
  // The founder's statue on a plain column (stuccoed), at the platform's back corner.
  for (const g of tuscanColumn(0.22, ch, lod)) out.stucco.push(g.translate(cx, ty, cz));
  if (done) {
    const st = statue(cx, cz, 0, { y0: ty + ch, h: 1.4, kind: 'togate', lod, base: 0.12 });
    out.tufa.push(...st.base);
    out.bronzeStatue.push(...st.statue);
  }
}

/** The hall's floor: beaten earth before, a floor of lime and crushed tile (opus signinum) finished. */
function floor(prog, done, lod, seed, out) {
  if (prog < 1) return;
  const key = done ? 'floor' : 'earth';
  out[key].push(span(-HX + T, HX - T, Y0, Y0 + 0.02, HZ0 + T, HZ1 - T, done ? 0.95 : 0.7));
}

/** The finished front: the bronze-studded doors (open or shut), the lampstands, the money changers' table and benches. */
function fittings(lod, seed, out) {
  // The doors: open while the courts sit, shut else; the dark of the hall behind them.
  for (const [x, w, h] of B.doors) {
    const open = doubleDoor(x, HZ1 - T + 0.04, 2 * w, h, Y0, { open: true, lod });
    const shut = doubleDoor(x, HZ1 - T / 2, 2 * w, h, Y0, { open: false, lod });
    out.doorsOpen.push(...(open.wood || []), ...(open.bronze || []));
    out.doorsShut.push(...(shut.wood || []), ...(shut.bronze || []));
    out.dark.push(box(2 * w + 0.1, h, 0.05, x, Y0, HZ1 - T - 2.2, 1));
  }
  // Bronze lampstands by the middle door, a lantern on each.
  for (const [lx, ly, lz] of B.lamps) {
    out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.025, 0.035, ly - Y0 - 0.1, lod ? 5 : 8, 1).translate(lx, Y0 + (ly - Y0 - 0.1) / 2 + 0.06, lz))));
    out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.11, 0.06, 0.06, lod ? 5 : 10, 1).translate(lx, ly - 0.06, lz))));
    if (lod < 2) {
      const l = lantern(lx, ly - 0.01, lz, lod);
      out.bronze.push(...l.bronze);
      out.pane.push(l.pane);
    }
  }
  // A money changer's table in the porch (the argentarii kept their counters in the basilicas' porticoes).
  const [mx, mz] = MONEY;
  out.wood.push(slab(1.2, 0.06, 0.6, { bevel: 0.008, seed: seed + 3, wobble: 0.002, tone: 0.05, grime: 0 }).translate(mx, Y0 + 0.8, mz));
  for (const s of [-1, 1]) out.wood.push(box(0.08, 0.8, 0.5, mx + s * 0.5, Y0, mz, 0.75));
  if (lod === 0) {
    for (let k = 0; k < 6; k++) out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.03, 0.03, 0.02 + 0.015 * (k % 3), 8, 1).translate(mx - 0.3 + k * 0.1, Y0 + 0.87, mz + 0.05 * (k % 2))), () => 0.9));
  }
  // Tufa benches against the hall's front either side of the middle door.
  for (const s of [-1, 1]) {
    const bx = s * 2.6;
    out.tufa.push(slab(1.5, 0.08, 0.45, { bevel: 0.01, seed: seed + 10 + s, wobble: 0, tone: 0, grime: 0 }).translate(bx, Y0 + SEAT_H - 0.08, HZ1 + 0.32));
    for (const e of [-1, 1]) out.tufa.push(slab(0.14, SEAT_H - 0.08, 0.4, { bevel: 0.01, seed: seed + 12 + e, wobble: 0.002, tone: 0.03, grime: 0.2 }).translate(bx + e * 0.62, Y0, HZ1 + 0.32));
  }
}

/** Where the money changer's table stands in the porch (x, z). */
const MONEY = Object.freeze([-6.4, 5.7]);

/** The precinct round the podium: paving (finished), beaten earth (building). */
function ground(done, lod, seed, out) {
  const H = B.half - 0.05;
  if (done) {
    const [px, pz0, pz1] = B.podium;
    const [sw, sz] = B.steps;
    const skip = (x, z) => (Math.abs(x) < px + 0.1 && z < pz1 + 0.05 && z > pz0 - 0.1) || (Math.abs(x) < sw + 0.5 && z < sz + 0.02 && z > pz1 - 0.1);
    out.paving.push(...paving(-H, H, -H, H, 0.05, seed, { rowW: 0.9, minL: 0.8, maxL: 1.4, lod, skip, tone: 0.06, grime: 0.15 }));
  } else out.earth.push(span(-H, H, 0, 0.03, -H, H, 0.85));
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

/** The materials the basilica takes (the government buildings', the site's). */
function basilicaMaterials() {
  const m = govMaterials();
  return {
    ...m,
    // Tufa, the stone of Latium: the foundations, the ashlar walls, the drums, the platform, the steps.
    tufa: material('tufa', { surface: 'tufa', vertexColors: true, snow: 1 }),
    rubble: material('rubble-wall', { surface: 'rubble', vertexColors: true, snow: 1 }),
    earthYard: material('beaten-earth', { surface: 'earth', vertexColors: true, snow: 1 }),
    trench: material('trench-earth-dark', { surface: 'earth', color: 0x6a5240, vertexColors: true, snow: 1 }),
    cord: material('rope', { surface: 'rope', vertexColors: true, snow: 0.6, normal: 1 }),
    ivory: material('ivory', { color: 0xf0e6d0, roughness: 0.35, vertexColors: true, snow: 0 }),
  };
}

/** A sheet of geometry lists by material. */
function bins() {
  return {
    tufa: [], stucco: [], paint: [], joint: [], rubble: [], boards: [], timber: [], wood: [], tile: [], dark: [], letters: [], bronze: [],
    bronzeStatue: [], pane: [], paving: [], earth: [], trench: [], cord: [], ivory: [], floor: [], doorsOpen: [], doorsShut: [],
  };
}

/**
 * Build the basilica at `prog` (0 to 4: the stage plus its quarters done;
 * 4 finished): { group, meshes, triangles }. Finished, its doors and lamps
 * are tagged ('open' the courts sitting, 'shut'); `sacked` breaks its
 * doors and leaves them out. Its columns, finished, are not in it (kits of
 * their own: buildBasilicaColumn). Its site dressing is the stage's own
 * (monumentModels.js adds worksite.js siteParts).
 */
export function buildBasilica({ lod = 0, prog = 4, sacked = false, seed = 71 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const done = prog >= 4;
  const out = bins();
  ground(done, lod, seed, out);
  setOut(prog, lod, out);
  podium(prog, done, lod, seed + 10, out);
  floor(prog, done, lod, seed + 15, out);
  outerWalls(prog, done, lod, seed + 20, out);
  naveDrums(prog, lod, out);
  clerestory(prog, done, lod, seed + 40, out);
  roofs(prog, done, lod, seed + 50, out);
  porch(prog, done, lod, seed + 60, out);
  tribunal(prog, done, lod, seed + 70, out);
  if (done) fittings(lod, seed + 80, out);
  if (sacked) out.doorsOpen = [];
  if (lod === 2) out.letters = out.cord = [];
  const m = basilicaMaterials();
  const p = new TaggedParts('basilica');
  const small = { cast: false };
  p.add('paving', m.tufa, out.paving, small);
  p.add('yard', m.earthYard, [...out.earth], small);
  p.add('trench', m.trench, out.trench, small);
  p.add('cord', m.cord, out.cord, small);
  p.add('stone', m.tufa, out.tufa);
  p.add('stucco', m.stucco, out.stucco);
  p.add('paint', m.fresco, out.paint);
  p.add('joints', m.joint, out.joint, small);
  p.add('core', m.rubble, out.rubble);
  p.add('boards', m.wood, [...out.boards, ...out.timber, ...out.wood]);
  p.add('roof', m.tile, out.tile);
  p.add('inside', m.dark, out.dark, small);
  p.add('letters', m.letters, out.letters, small);
  p.add('bronze', m.bronze, out.bronze, { cast: lod === 0 });
  p.add('statue', m.statueBronze, out.bronzeStatue);
  p.add('ivory', m.ivory, out.ivory);
  p.add('floor', m.tesserae, out.floor, small);
  if (done) {
    p.add('doors', m.wood, out.doorsOpen, { when: 'open' });
    p.add('doors', m.wood, out.doorsShut, { when: 'shut' });
    p.add('lamp', lanternPane(), out.pane, { when: 'open', cast: false });
    p.add('lamp', m.lampOut, out.pane.map((g) => g.clone()), { when: 'shut', cast: false });
  }
  return p.build();
}

/**
 * A column kit, tufa drums stuccoed white: the nave's ('nave') or the
 * porch's ('porch'), both Ionic, standing on y 0.
 */
export function buildBasilicaColumn(which, lod) {
  const m = basilicaMaterials();
  // (The nave's columns stand under the roof: seen through the doors and from the air while the roof
  // goes on, never close; they take the middle level's geometry at the full one.)
  const nave = which === 'nave';
  const c = column('ionic', nave ? B.colH : B.porchH, nave ? Math.max(1, lod) : lod);
  const p = new TaggedParts(`basilica-${which}-column`);
  p.add('column', m.stucco, c.stone);
  p.add('capital', m.stucco, c.cap);
  return p.build();
}

/** The lamps (models.js modelLamps): the porch's lanterns, facing the street. */
export const BASILICA_LAMPS = Object.freeze(B.lamps.map(([x, y, z]) => Object.freeze([x, y + 0.1, z, 1])));

// ---------------------------------------------------------------------------
// The site at each stage, and the people
// ---------------------------------------------------------------------------

/**
 * The site dressing at `prog` (models/worksite.js), its static part: the
 * scaffolds round what is rising, the cranes, the mortar pits (for the
 * stucco and the lime of the bedding); `struck` (raiders set it back in
 * this raid) brings its scaffolds down and heaps rubble. The cranes are
 * kept apart (siteMotion draws their wheels and loads, turning while the
 * crew works), so the stage's kit is the same with the crew there or not.
 * The goods on site are its piles (basilicaPiles), instanced apart too.
 * (No centering: nothing here is vaulted. The trusses are hoisted whole,
 * roofs()'s own.)
 */
export function basilicaSite(prog, struck = false) {
  const site = { scaffolds: [], cranes: [], centering: [], mortar: [], rubble: [] };
  if (prog >= 4) return site;
  const fWall = share(prog, ...SCHEDULE.walls);
  const wallH = (B.wallTop - Y0) * fWall;
  const fallen = !!struck;
  if (prog < 1) {
    // Pits for the lime in the yard before the podium; shear legs setting its first blocks.
    site.mortar.push({ x: -6.0, z: 8.7, ry: 0 }, { x: 4.6, z: 8.7, ry: 0 });
    site.cranes.push({ x: 0, z: 3.0, ry: 0, h: 4.5, kind: 'shear', load: 'stone' });
  } else if (prog < 2.25) {
    // Scaffolds round the outer walls, a lift over what is laid; the treadwheel in the nave lifting the blocks and drums.
    const h = Math.max(LIFT, Math.min(B.wallTop - Y0 + 1.0, wallH + 1.2));
    const d = T + 1.1;
    const y = Y0;
    site.scaffolds.push({ x: 0, z: HZ1 - T / 2, w: 2 * HX + 0.4, d: T + 1.9, h, ry: 0, fallen, y });
    site.scaffolds.push({ x: 0, z: HZ0 + T / 2, w: 2 * HX + 0.4, d: T + 1.9, h, ry: 0, fallen, y });
    // (The side scaffolds turned so their ladders face in, over the podium: a footprint holds no more.)
    for (const s of [-1, 1]) site.scaffolds.push({ x: s * (HX - T / 2 - 0.05), z: -0.9, w: 9.3, d, h, ry: -s * Math.PI / 2, fallen, y });
    site.cranes.push({ x: -5.0, z: -0.9, ry: Math.PI / 2, h: prog < 1.75 ? 9 : 12, kind: 'treadwheel', load: prog < 1.5 ? 'drum' : 'stone', apart: true, y: Y0 });
    if (prog >= 1.25 && prog < 1.75) site.cranes.push({ x: 6.0, z: B.porchZ + SHEAR_REACH, ry: Math.PI, h: 6.6, kind: 'shear', load: 'drum', stay: 1.6 });
    site.mortar.push({ x: 2.6, z: -0.9, ry: 0, y: Y0 });
  } else if (prog < 3) {
    // The roof: scaffolds along the clerestory inside, the crane lifting the trusses' timbers.
    const h = B.clerTop - Y0 + 0.6;
    for (const z of [B.nave.zf, B.nave.zb]) site.scaffolds.push({ x: 0, z, w: 15.2, d: 2.0, h, ry: 0, fallen, y: Y0 });
    site.cranes.push({ x: -5.0, z: -0.9, ry: Math.PI / 2, h: 13, kind: 'treadwheel', load: 'timber', apart: true, y: Y0 });
  } else {
    // The tribunal: a scaffold along the porch for its roof and its frieze; shear legs lifting the blocks and the column's drums.
    site.scaffolds.push({ x: 0, z: B.porchZ, w: 19.2, d: 1.6, h: B.porchH + 1.5, ry: 0, fallen, y: Y0 });
    site.cranes.push({ x: 7.2, z: B.porchZ + SHEAR_REACH, ry: Math.PI, h: 6.6, kind: 'shear', load: 'stone', stay: 1.6 });
  }
  if (struck) site.rubble.push({ x: -3.5, z: 8.7, w: 4, d: 1.6 }, { x: 4.5, z: 8.8, w: 3, d: 1.4 });
  return site;
}

/** How far ahead of its feet' line shear legs hang their load (worksite.js SHEAR: the feet at -0.6, the apex 0.95 on). */
const SHEAR_REACH = 0.35;

/**
 * Where each good's pile stands on the site (x, z): in a row along the yard
 * before the podium (the steps go in last), a pile three loads across.
 */
export const PILE_SPOTS = Object.freeze({
  clay: Object.freeze([-7.6, 8.2]), timber: Object.freeze([-3.8, 8.2]), marble: Object.freeze([0.2, 8.2]),
  iron: Object.freeze([4.0, 8.2]), furniture: Object.freeze([7.6, 8.2]),
});

/** The goods on site as piles (worksite.js pileMore takes them), from siteView's stock: at most a row of three each. */
export function basilicaPiles(stock) {
  const out = [];
  for (const [good, n] of Object.entries(stock || {})) {
    const at = PILE_SPOTS[good] || PILE_SPOTS.iron;
    out.push({ x: at[0], z: at[1], ry: 0, good, n: Math.min(n, 3) });
  }
  return out;
}

/**
 * The people of the basilica by its look (people/actors.js specs, its
 * metres). Finished and sitting ('open'): in the porch an advocate in the
 * toga pleading to a knot of listeners, two litigants arguing, the money
 * changer counting coin at his table with a customer, a scribe seated on
 * the bench writing, the magistrate in the purple-bordered toga walking
 * the porch with his two lictors; inside (seen through the doors) the
 * judge on the tribunal's chair, an advocate before him. Closed or sacked:
 * nobody. Building, with the crew on site: masons on the scaffolds' top
 * lifts dressing the courses, carriers with baskets between the piles and
 * the steps, men mixing mortar, the foreman; no crew, nobody.
 */
export function basilicaActors(prog, { open = false, crew = false } = {}) {
  if (prog >= 4) return open ? courtActors() : [];
  if (!crew) return [];
  const list = [crewForeman([-2.5, 0.03, 9.3], Math.PI * 0.9, 601)];
  const site = basilicaSite(prog);
  // Mortar mixers at each pit (its hoe's blade in the lime: the hoe clip's reach ahead of him).
  for (const [i, m] of site.mortar.entries()) list.push(crewMixer([m.x - 0.15, (m.y || 0) + 0.03, m.z - 0.95], 0, 610 + i));
  // Carriers walking along the front between the piles and the steps.
  list.push(crewCarrier([-8.6, 0.03, 9.6], Math.PI / 2, 6.5, 620, 'basket'));
  list.push(crewCarrier([8.4, 0.03, 9.5], -Math.PI / 2, 5.5, 621, prog >= 2 && prog < 3 ? 'plank' : 'sack'));
  // Masons on the top lift of the front scaffold, at work on the wall.
  const front = site.scaffolds[0];
  if (prog >= 1 && prog < 2.25 && front) {
    const lifts = Math.max(1, Math.floor(front.h / LIFT));
    const y = (front.y || 0) + lifts * LIFT + 0.07;
    for (const [k, x] of [-6.5, -1.8, 3.4].entries()) list.push(crewMason([x, y, HZ1 + 0.42 + 0.06], Math.PI, 630 + k));
  }
  if (prog >= 2.25 && prog < 3) {
    // Carpenters on the trusses' scaffold, at the clerestory's top.
    for (const [k, x] of [-3.5, 2.2].entries()) list.push(crewMason([x, Y0 + LIFT * Math.floor((B.clerTop - Y0 + 0.6) / LIFT) + 0.07, B.nave.zf + 0.62], Math.PI, 640 + k));
  }
  if (prog < 1) {
    // Men at the first courses, setting the blocks.
    for (const [k, x] of [-4, 3].entries()) list.push(crewMixer([x, 0.03, B.podium[2] + 0.9], Math.PI, 650 + k));
  }
  return list;
}

/** The court sitting: the people of a working basilica (see basilicaActors). */
function courtActors() {
  const y = Y0;
  const toga = (at, ry, seed, extra = {}) => ({
    body: 'm', dress: ['tunic:knee', 'toga'], hair: seed % 3 ? 'crop' : 'bald', old: seed % 3 === 0,
    colours: { tunic: DYES.white, mantle: DYES.candida }, at, ry, seed, ...extra,
  });
  const citizen = (at, ry, seed, extra = {}) => ({ body: 'm', dress: ['tunic:knee', 'pallium'], hair: seed % 2 ? 'curls' : 'crop', beard: seed % 3 ? null : 'short', at, ry, seed, ...extra });
  const [mx, mz] = MONEY;
  const list = [
    // The advocate pleading to his listeners in the porch, before the middle door.
    toga([1.2, y, 5.3], -Math.PI * 0.75, 701, { clip: 'orate' }),
    citizen([0.3, y, 4.95], Math.PI * 0.35, 702, { clip: 'listen' }),
    citizen([0.4, y, 5.85], Math.PI * 0.6, 703, { clip: 'listen' }),
    toga([-0.2, y, 5.45], Math.PI * 0.5, 704, { clip: 'listen' }),
    // Two litigants arguing at the east end.
    citizen([5.4, y, 5.6], -Math.PI / 2, 705, { clip: 'talk' }),
    citizen([4.6, y, 5.6], Math.PI / 2, 706, { clip: 'talk' }),
    // The money changer at his table counting coin, a customer before it.
    { body: 'm', dress: ['tunic:knee'], hair: 'bald', beard: 'short', clip: 'count', props: { R: 'coin' }, at: [mx, y, mz - 0.6], ry: 0, seed: 707, old: true, colours: { tunic: DYES.saffron } },
    citizen([mx + 0.1, y, mz + 0.7], Math.PI, 708, { clip: 'give', props: { R: 'purse' } }),
    // A scribe on the bench by the door, writing.
    { body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'write', props: { R: 'stylus', L: 'tablet' }, at: [2.6, y, HZ1 + 0.32 + 0.1], ry: 0, seed: 709, colours: { tunic: DYES.undyed } },
    // The magistrate walking the porch with his lictors (fasces on the shoulder).
    { ...toga([-5.0, y, 6.35], Math.PI / 2, 710, { colours: { tunic: DYES.white, mantle: DYES.candida, accent: DYES.murex } }), clip: 'walk', route: { length: 6.5, speed: 0.6, pauseEnd: 4, pauseStart: 4, clipEnd: 'talk', clipStart: 'idle' } },
    { body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'walk', props: { L: 'fasces' }, at: [-5.6, y, 6.85], ry: Math.PI / 2, seed: 711, route: { length: 6.5, speed: 0.6, pauseEnd: 4, pauseStart: 4, clipEnd: 'shoulder', clipStart: 'shoulder' }, colours: { tunic: DYES.madder } },
    { body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'walk', props: { L: 'fasces' }, at: [-5.6, y, 5.85], ry: Math.PI / 2, seed: 712, route: { length: 6.5, speed: 0.6, pauseEnd: 4, pauseStart: 4, clipEnd: 'shoulder', clipStart: 'shoulder' }, colours: { tunic: DYES.madder } },
    // Inside: the judge on the tribunal's curule chair, an advocate pleading before him.
    toga([0, y + B.tribunal.y, B.tribunal.chairZ + 0.1], 0, 713, { clip: 'sit', colours: { tunic: DYES.white, mantle: DYES.candida, accent: DYES.murex } }),
    toga([0.4, y, B.tribunal.z + 2.4], Math.PI, 714, { clip: 'orate' }),
  ];
  return list;
}
