/**
 * models/mansio.js
 * ----------------------------------------------------------------------------
 * The Caravanserai (Mansio Magna), a monument on a 5 x 5 footprint (20 m),
 * a great road station after the record:
 *
 *   - The mansiones of the Roman roads (the official stations a day's
 *     journey apart, listed in the Antonine Itinerary): a square courtyard
 *     ringed by ranges of rooms, a colonnade round it, stables, a bath
 *     suite, its own well; the excavated ones at Godmanchester, Vindolanda
 *     and Thenae show the type, the rooms in a ring round the court, a
 *     small bath at a corner, the stables and the stores along the sides.
 *   - The caravan inns of the eastern provinces (the pandocheia of the
 *     Syrian roads, the khans that followed them): two storeys of rooms
 *     over a court, an open gallery on posts before the upper rooms, the
 *     beasts and the goods below, a single gate high and wide enough for a
 *     loaded wagon, shut at night.
 *   - Pompeii's inns and taverns (the caupona of Euxinus, the stable inns
 *     by the gates): a counter of masonry with the dolia set in its top, the
 *     wine jugs, tables under a vine on its trellis, the innkeeper, a
 *     painted sign; the stable yards with their mangers and watering
 *     troughs, the carts in the yard.
 *   - The road's traffic: the mule trains (muli) with pack saddles and
 *     panniers, the ox wagons (plaustra), the post's horses, travellers in
 *     their hooded cloaks (paenulae).
 *
 * So, in 20 m: four ranges of two storeys round a court, a hipped roof of
 * tiles over them meeting in valleys at the inner corners; the gatehouse
 * over the middle of the front range, a storey higher, its arch big enough
 * for a wagon, MANSIO cut over it; round the court a colonnade of stone
 * carrying the timber gallery of the upper rooms with its rail; along the
 * left range the stables (the beasts at their mangers under the
 * colonnade), along the right the stores, along the back the tavern with
 * its counter and the tables in the court under a vine; the well and the
 * watering trough in the middle; the bath's little dome and its flue at the
 * back corner.
 *
 * The site, as the sim builds it in three stages (data/monuments.js):
 *   0  the courtyard: the ranges' footings in their trenches, the court
 *      paved from the back forward, the well sunk and its head set
 *   1  the colonnade and the stables: the ground storey rising course by
 *      course, the colonnade's columns, the mangers
 *   2  the inn: the upper storey rising, the gallery's deck and rail, the
 *      roofs (the rafters, then the tiles), the gatehouse, the tavern fitted
 * each `f` (0..1) of the way through (mansioSite: its scaffolds, cranes,
 * piles and crew as models/worksite.js draws them).
 *
 * Finished, its state (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed and fed: the kitchen's smoke, the tavern's fire and
 *           lamps, the gate open
 *   'out'   staffed, its larder empty: the gate open, the hearth cold
 *   'shut'  too few hands: the gate shut
 * `sacked`: the gate's leaves broken, rubble, soot, the gallery's rail and a
 * stretch of the roof burned through.
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z,
 * as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { material, shallowWaterMaterial, iceMaterial } from '../materials.js';
import { slab, paving, tuscanColumn, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin, ruralMaterials, jar, sack, basket, heap } from './rural.js';
import { staff, inscribe } from './castra.js';
import { roofSlope } from './learning.js';
import { healthMaterials, steamMaterial, plume, coals, table } from './healing.js';
import { box, bag, placed, risingWall, rubbleHeap, scorch, addSite } from './civicParts.js';
import { siteParts } from './worksiteStub.js';
import { DYES } from '../people/actors.js';
import { SEAT_H } from '../people/clips.js';

/** The Caravanserai's measures (metres): the tests, the lab and the game read them. */
export const MANSIO = Object.freeze({
  half: 10,
  /** The outer walls' faces (|x|, |z|), the court's walls (the ranges' inner faces), the colonnade's line. */
  out: 9.8,
  inner: 6.4,
  cols: 4.8,
  /** The ground storey's top (the gallery's deck), the upper storey's eaves, the ridge's height and its line (|x| or |z|). */
  floor1: 3.0,
  eave: 5.6,
  ridge: 7.0,
  ridgeAt: 8.1,
  /** The roof's eaves over the court (their height and line) and outside (the line). */
  innerEave: 4.85,
  innerEaveAt: 4.55,
  outerEaveAt: 9.96,
  /** The gatehouse: its half width, its walls' top, the gate's half width and its arch's springing. */
  gate: Object.freeze({ half: 2.3, top: 8.0, w: 1.55, spring: 2.7, z0: 6.2 }),
  /** The bath's dome at the back right corner: its middle, the drum's radius and top. */
  bath: Object.freeze({ x: 7.6, z: -7.7, r: 1.35, top: 7.3 }),
  /** The well's middle in the court. */
  well: Object.freeze([0, 0.6]),
});

const M = MANSIO;
const G = M.gate;

/** The three stages of the site and the finished inn. */
export const MANSIO_STAGES = 3;

/** Is stage s (0-2) of a site at `stage` with `f` of it done: 1 built, its share while under way, 0 not begun. */
function share(stage, f, s) {
  return stage > s ? 1 : stage === s ? f : 0;
}

/** The four ranges: each the side it faces (its outer wall's facing: +z front, +x right, -z back, -x left). */
const SIDES = Object.freeze([
  Object.freeze({ name: 'front', ry: 0 }),
  Object.freeze({ name: 'right', ry: Math.PI / 2 }),
  Object.freeze({ name: 'back', ry: Math.PI }),
  Object.freeze({ name: 'left', ry: -Math.PI / 2 }),
]);

/** A point (a, b) in a range's own frame (a along it, b outward from the middle) to the model's (x, z). */
function frame(ry, a, b) {
  const s = Math.sin(ry);
  const c = Math.cos(ry);
  // (Turned by ry about y, as a geometry built facing +z: its +z goes to (sin ry, cos ry).)
  return [a * c + b * s, -a * s + b * c];
}

/** Turn a geometry built in a range's frame (front's) to its side. */
function toSide(g, ry) {
  if (ry) g.rotateY(ry);
  return g;
}

/** A wall in a range's frame: along a about `a`, its face at b facing outward (+b) or in (-b), cut at course c. */
function rangeWall(list, ry, len, h, t, a, b, inward, openings, c, lod, y0 = 0) {
  for (const g of risingWall(len, h, t, openings, c, lod)) {
    if (inward) g.rotateY(Math.PI);
    g.translate(a, y0, b);
    list.push(toSide(g, ry));
  }
}

// ---------------------------------------------------------------------------
// The ground and the court
// ---------------------------------------------------------------------------

/** The site's earth, the court's paving (laid from the back forward in stage 0), the well and the trough. */
function court(lod, seed, out, stage, f) {
  const H = M.half;
  out.earth.push(box(2 * H - 0.04, 0.02, 2 * H - 0.04, 0, 0, 0, (x, y, z) => 0.85 + 0.12 * Math.cos(x * 0.9) * Math.cos(z * 0.7)));
  const k = share(stage, f, 0);
  const I = M.inner;
  if (stage === 0) {
    // The trenches for the ranges' walls (outer and court side).
    for (const s of SIDES) {
      for (const b of [M.out - 0.2, I + 0.15]) {
        const g = box(2 * b + 0.4, 0.025, 0.9, 0, 0, b, 0.8);
        out.trench.push(toSide(g, s.ry));
      }
    }
  }
  // The paving of the court: flags from the back forward as the stage goes on; the colonnade's floor.
  const z1 = stage === 0 ? -I + 2 * I * Math.min(1, k * 1.15) : I;
  if (z1 > -I + 0.3) out.flags.push(...paving(-I, I, -I, z1, 0.05, seed, { rowW: 0.62, minL: 0.55, maxL: 1.0, lod, skip: (x, z) => Math.hypot(x - M.well[0], z - M.well[1]) < 0.8 }));
  // The well: its shaft's ring at stage 0, the stone head (a puteal) and the frame with its pulley after.
  const [wx, wz] = M.well;
  const seg = lod === 2 ? 10 : lod ? 16 : 28;
  if (k >= 0.4 || stage > 0) {
    const head = revolve(profileOf([[0.62, 0], [0.62, 0.7], [0.68, 0.74], [0.68, 0.82], [0.5, 0.82], [0.5, 0.2]]), { segments: seg, metres: 1, tint: (p) => 0.8 + 0.2 * Math.min(1, p.y / 0.8) });
    out.trav.push(head.translate(wx, 0.04, wz));
    out.dark.push(tintGeometry(boxUV(new CylinderGeometry(0.5, 0.5, 0.02, seg, 1).translate(wx, 0.4, wz))));
  }
  if (stage > 0) {
    for (const s of [-1, 1]) out.wood.push(box(0.12, 2.0, 0.12, wx + s * 0.75, 0.04, wz, 0.75));
    out.wood.push(box(1.7, 0.12, 0.14, wx, 2.0, wz, 0.75));
    if (lod < 2) {
      out.wood.push(tintGeometry(boxUV(new CylinderGeometry(0.12, 0.12, 0.06, 12, 1).rotateZ(Math.PI / 2).translate(wx, 1.86, wz)), () => 0.7));
      out.rope.push(staff([wx, 1.8, wz + 0.1], [wx, 0.95, wz + 0.1], 0.008, 4));
      out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.11, 0.09, 0.2, 10, 1).translate(wx, 0.86, wz + 0.1)), () => 0.75));
    }
    // The watering trough beside it: a long stone basin for the beasts.
    const [tx, tz] = [-2.4, 0.4];
    out.trav.push(slab(0.8, 0.62, 2.6, { bevel: 0.015, seed: seed + 7, wobble: 0.003, tone: 0.04, grime: 0.4 }).translate(tx, 0.04, tz));
    out.troughWater.push(box(0.6, 0.01, 2.4, tx, 0.6, tz));
  }
}

// ---------------------------------------------------------------------------
// The ranges
// ---------------------------------------------------------------------------

/**
 * One range on side `s`: its outer wall, its court wall (the stable's wide
 * doors, the stores' doors, the tavern's front, the rooms' doors above),
 * the colonnade before it, the gallery over that, the room partitions'
 * dark. Built in the front range's frame, turned to its side.
 */
function range(lod, seed, out, stage, f, s, sacked) {
  const ry = s.ry;
  const I = M.inner;
  const O = M.out;
  const half = s.name === 'front' || s.name === 'back' ? O : I;
  const len = 2 * half;
  const g1 = M.floor1 * share(stage, f, 1);
  const g2 = stage < 2 ? 0 : (M.eave - M.floor1) * share(stage, f, 2);
  const gate = s.name === 'front';
  // The ground storey: the outer wall (small high windows; the front's gate) and the court wall.
  const outerOps = [];
  for (let a = -half + 1.6; a < half - 1.0; a += 2.4) if (!gate || Math.abs(a) > G.half + 0.4) outerOps.push({ x: a, w: 0.5, h: 0.6, y: 1.9 });
  if (gate) outerOps.push({ x: 0, w: G.w * 2, h: G.spring, arch: true });
  const innerOps = [];
  const bays = s.name === 'front' || s.name === 'back' ? 5 : 4;
  const span = 2 * I;
  for (let k = 0; k < bays; k++) {
    const a = -I + (k + 0.5) * (span / bays);
    if (gate && Math.abs(a) < G.half) continue;
    if (s.name === 'left') innerOps.push({ x: a, w: 1.9, h: 2.4, arch: true });
    else if (s.name === 'back' && Math.abs(a) < 1.5) innerOps.push({ x: a, w: 2.2, h: 2.3 });
    else innerOps.push({ x: a, w: 1.0, h: 2.1 });
  }
  if (gate) innerOps.push({ x: 0, w: G.w * 2, h: G.spring, arch: true });
  const wallFace = s.name === 'front' || s.name === 'back' ? out.plaster : out.plaster;
  // (Built in the front's frame: the outer face at b = O facing out, the court face at b = I facing in.)
  if (g1 > 0) {
    rangeWall(wallFace, ry, len, M.floor1, 0.4, 0, O, false, outerOps, g1, lod);
    rangeWall(out.plaster, ry, span, M.floor1, 0.3, 0, I, true, innerOps, g1, lod);
    // A red socle outside, to the height of a wheel's hub.
    if (lod < 2) out.red.push(toSide(box(len - 0.02, 0.7, 0.012, 0, 0, O + 0.006, 1), ry));
  }
  // The rooms' dark seen through the doors (between the walls, under the floor), the range's floor.
  if (g1 >= M.floor1 - 1e-6) out.dark.push(toSide(box(span - 0.1, M.floor1 - 0.06, O - I - 0.72, 0, 0.04, (O + I) / 2, 1), ry));
  // The upper storey: windows out, a door to each room off the gallery.
  if (g2 > 0) {
    const up = [];
    for (let a = -half + 1.6; a < half - 1.0; a += 2.4) if (!gate || Math.abs(a) > G.half + 0.3) up.push({ x: a, w: 0.6, h: 0.9, y: 0.7 });
    const doors = [];
    for (let k = 0; k < bays; k++) {
      const a = -I + (k + 0.5) * (span / bays);
      if (!gate || Math.abs(a) > G.half + 0.2) doors.push({ x: a, w: 0.85, h: 1.95, y: 0.1 });
    }
    rangeWall(out.plaster, ry, len, M.eave - M.floor1, 0.4, 0, O, false, up, g2, lod, M.floor1);
    rangeWall(out.plaster, ry, span, M.eave - M.floor1, 0.3, 0, I, true, doors, g2, lod, M.floor1);
    out.floor.push(toSide(box(span, 0.12, O - I, 0, M.floor1 - 0.06, (O + I) / 2, 0.9), ry));
    if (g2 >= M.eave - M.floor1 - 1e-6) out.dark.push(toSide(box(span - 0.1, M.eave - M.floor1 - 0.1, O - I - 0.72, 0, M.floor1 + 0.06, (O + I) / 2, 1), ry));
  }
  // The colonnade before the court wall: columns at the corners and between, carrying the gallery's beam.
  const k1 = share(stage, f, 1);
  const n = 5;
  const shown = stage >= 2 ? n : Math.round(n * Math.min(1, Math.max(0, (k1 - 0.2) * 1.5)));
  for (let k = 0; k < shown; k++) {
    const a = -M.cols + (k * 2 * M.cols) / (n - 1);
    // (The corner columns belong to the front and back ranges' rows; the sides' skip them.)
    if ((s.name === 'left' || s.name === 'right') && (k === 0 || k === n - 1)) continue;
    const [x, z] = frame(ry, a, M.cols);
    for (const g of tuscanColumn(0.16, M.floor1 - 0.26, lod)) out.cols.push(g.translate(x, 0.05, z));
  }
  if (stage >= 2 || k1 > 0.9) {
    out.wood.push(toSide(box(2 * M.cols + 0.3, 0.26, 0.26, 0, M.floor1 - 0.26, M.cols, 0.8), ry));
    // The colonnade's floor: beaten, a step up from the court.
    out.floor.push(toSide(box(2 * I - 0.02, 0.06, I - M.cols + 0.2, 0, 0.0, (I + M.cols - 0.2) / 2, 0.9), ry));
  }
  // The gallery: its deck over the colonnade, joists showing at its edge; the rail and the posts to the roof.
  if (stage >= 2 && share(stage, f, 2) > 0.3) {
    out.wood.push(toSide(box(2 * I - 0.02, 0.1, I - M.cols + 0.25, 0, M.floor1, (I + M.cols - 0.25) / 2, 0.82), ry));
    const railK = sacked && s.name === 'right' ? 0.45 : 1;
    const rail = 2 * M.cols * railK;
    out.wood.push(toSide(box(rail, 0.07, 0.08, -M.cols + rail / 2, M.floor1 + 0.95, M.cols + 0.04, 0.75), ry));
    out.wood.push(toSide(box(rail, 0.05, 0.05, -M.cols + rail / 2, M.floor1 + 0.45, M.cols + 0.04, 0.7), ry));
    if (lod < 2) {
      const baluster = lod ? 0.6 : 0.3;
      for (let a = -M.cols + 0.15; a < -M.cols + rail - 0.1; a += baluster) out.wood.push(toSide(box(0.04, 0.9, 0.04, a, M.floor1 + 0.1, M.cols + 0.04, 0.72), ry));
    }
    for (let k = 0; k < n; k++) {
      const a = -M.cols + (k * 2 * M.cols) / (n - 1);
      if ((s.name === 'left' || s.name === 'right') && (k === 0 || k === n - 1)) continue;
      const [x, z] = frame(ry, a, M.cols);
      out.wood.push(box(0.16, M.innerEave - M.floor1 - 0.02, 0.16, x, M.floor1 + 0.1, z, 0.7));
    }
  }
  void seed;
}

/** The fittings of each range at ground level: the stables' mangers and hay, the stores' racks, the tavern's counter, tables and vine. */
function fittings(lod, seed, out, stage, f, sacked) {
  const I = M.inner;
  if (stage >= 1 && share(stage, f, 1) > 0.6) {
    // The stables (left): a stone manger along the court wall, hay racks over it, straw on the floor.
    out.trav.push(slab(0.55, 0.75, 2 * M.cols - 0.6, { bevel: 0.015, seed: seed + 1, wobble: 0.003, tone: 0.04, grime: 0.5 }).translate(-I + 0.3, 0.05, 0));
    out.hay.push(box(0.4, 0.12, 2 * M.cols - 0.8, -I + 0.3, 0.72, 0, (x, y, z) => 0.8 + 0.2 * Math.sin(z * 9)));
    if (lod < 2) for (let z = -M.cols + 0.6; z < M.cols - 0.4; z += 0.45) out.wood.push(staff([-I + 0.06, 1.1, z], [-I + 0.42, 1.65, z], 0.018, 4));
    out.hay.push(box(1.4, 0.03, 2 * M.cols - 0.4, -I + 1.0, 0.05, 0, (x, y, z) => 0.7 + 0.2 * Math.cos(x * 7 + z * 3)));
  }
  if (stage < 2 || share(stage, f, 2) < 0.8) return;
  // The tavern (back): the counter, L-shaped, its top inset with the dolia's mouths; a shelf of jugs behind.
  const cz = -I + 1.15;
  out.plaster.push(box(3.0, 1.0, 0.5, 0.2, 0.05, cz, 0.9));
  out.plaster.push(box(0.5, 1.0, 1.0, -1.05, 0.05, cz - 0.75, 0.9));
  out.red.push(box(3.0, 0.5, 0.01, 0.2, 0.08, cz + 0.255, 1));
  out.marble.push(slab(3.1, 0.06, 0.6, { bevel: 0.01, seed: seed + 9, wobble: 0, tone: 0.03, grime: 0 }).translate(0.2, 1.05, cz));
  for (const x of [-0.6, 0.2, 1.0]) out.dark.push(tintGeometry(boxUV(new CylinderGeometry(0.17, 0.17, 0.01, 12, 1).translate(x, 1.115, cz))));
  if (lod < 2) {
    out.wood.push(box(2.6, 0.05, 0.25, 0.2, 1.7, -I + 0.16, 0.7));
    for (let k = 0; k < 6; k++) {
      const j = jar({ amphora: false, lod: 1, seed: seed + k });
      for (const g of [j].flat()) out.clay.push(g.scale ? g.scale(0.45, 0.45, 0.45).translate(-0.9 + k * 0.44, 1.75, -I + 0.16) : g);
    }
  }
  // The tables under the vine, benches each side; the vine on its trellis (posts and a canopy of leaves).
  for (const [tx, tz] of [[-2.6, -3.6], [2.6, -3.6]]) {
    out.wood.push(...table(tx, tz, 1.4, 0.7, 0.72, 0));
    for (const s of [-1, 1]) {
      out.wood.push(box(1.4, 0.06, 0.32, tx, SEAT_H - 0.06, tz + s * 0.65, 0.78));
      for (const e of [-0.55, 0.55]) out.wood.push(box(0.08, SEAT_H - 0.06, 0.26, tx + e, 0, tz + s * 0.65, 0.7));
    }
  }
  const vz0 = -4.6;
  const vz1 = -2.4;
  for (const x of [-3.8, -1.4, 1.4, 3.8]) out.wood.push(box(0.12, 2.65, 0.12, x, 0.04, vz1, 0.7));
  for (const z of [vz0 + 0.1, vz1]) out.wood.push(box(7.8, 0.1, 0.1, 0, 2.65, z, 0.7));
  if (lod < 2) for (let x = -3.6; x <= 3.7; x += 0.6) out.wood.push(box(0.05, 0.05, vz1 - vz0, x, 2.75, (vz0 + vz1) / 2, 0.7));
  if (!sacked) {
    const leaves = heapLeaves(-3.9, 3.9, vz0, vz1, 2.85, seed, lod);
    out.vine.push(...leaves);
  }
}

/** The vine's canopy over the trellis: clumps of leaves (lod 2: a sheet). */
function heapLeaves(x0, x1, z0, z1, y, seed, lod) {
  if (lod === 2) return [box(x1 - x0, 0.12, z1 - z0, (x0 + x1) / 2, y, (z0 + z1) / 2, 0.75)];
  const out = [];
  let k = 0;
  const step = lod ? 0.9 : 0.55;
  for (let x = x0 + 0.3; x < x1; x += step) {
    for (let z = z0 + 0.25; z < z1; z += step) {
      const r = 0.28 + 0.12 * ((k * 37) % 7) / 7;
      const s = new SphereGeometry(r, lod ? 5 : 7, lod ? 3 : 5);
      s.scale(1.2, 0.5, 1.2);
      s.translate(x + 0.1 * Math.sin(k * 3.1), y + 0.04 * Math.cos(k * 1.7), z + 0.1 * Math.cos(k * 2.3));
      const t = 0.75 + 0.25 * ((k * 53) % 11) / 11;
      out.push(tintGeometry(boxUV(s), () => [0.32 * t, 0.46 * t, 0.16 * t]));
      k++;
    }
  }
  void seed;
  return out;
}

// ---------------------------------------------------------------------------
// The roof, the gatehouse, the bath
// ---------------------------------------------------------------------------

/**
 * The roof: eight slopes of tiles round the court, an outer and an inner
 * one a range, each a trapezoid whose ends run along the diagonals, so the
 * outer ones meet in hips at the outer corners and the inner ones in
 * valleys at the court's. Stage 2 lays it: the rafters first, then the tiles.
 */
function roof(lod, seed, out, stage, f, sacked) {
  const k = share(stage, f, 2);
  if (stage < 2 || k < 0.45) return;
  const tiles = stage > 2 || k >= 0.7;
  const R = M.ridgeAt;
  const Oe = M.outerEaveAt;
  const Ie = M.innerEaveAt;
  for (const s of SIDES) {
    const outer = [[-Oe, M.eave - 0.1, Oe], [Oe, M.eave - 0.1, Oe], [R, M.ridge, R], [-R, M.ridge, R]];
    const inner = [[Ie, M.innerEave, Ie], [-Ie, M.innerEave, Ie], [-R, M.ridge, R], [R, M.ridge, R]];
    for (const [q, name] of [[outer, 'out'], [inner, 'in']]) {
      const turned = q.map(([x, y, z]) => {
        const [a, b] = frame(s.ry, x, z);
        return [a, y, b];
      });
      // A sacked inn's right range has its inner slope burned through: its rafters bare.
      const bare = !tiles || (sacked && s.name === 'right' && name === 'in');
      if (bare) {
        const [e0, e1, t1, t0] = turned;
        for (let j = 1; j < 8; j++) {
          const u = j / 8;
          const a = e0.map((v, i) => v + (e1[i] - v) * u);
          const b = t0.map((v, i) => v + (t1[i] - v) * u);
          out.wood.push(staff(a, b, 0.05, 4));
        }
        continue;
      }
      const r = roofSlope(turned, { lod, seed: seed + s.ry * 10 + (name === 'in' ? 3 : 0) });
      out.tile.push(...r.tile);
      out.wood.push(...r.wood);
    }
  }
  // The ridges' caps.
  if (tiles) for (const s of SIDES) out.tile.push(toSide(box(2 * R, 0.12, 0.26, 0, M.ridge - 0.04, R, 0.8), s.ry));
}

/** The gatehouse over the front range's middle: a storey higher, its walls, the gate's arch both ways, its roof, the inscription. */
function gatehouse(lod, seed, out, stage, f, state) {
  const k = share(stage, f, 2);
  const z0 = G.z0;
  const z1 = M.out + 0.05;
  const zc = (z0 + z1) / 2;
  const d = z1 - z0;
  // The gate's piers of dressed stone (stage 1 with the ground storey), the voussoirs of its arch.
  const g1 = share(stage, f, 1);
  if (g1 > 0) {
    for (const s of [-1, 1]) out.trav.push(slab(0.5, Math.min(G.spring, (M.floor1 + 0.4) * g1), d + 0.1, { bevel: 0.015, seed: seed + s, wobble: 0.002, tone: 0.04, grime: 0.4 }).translate(s * (G.w + 0.25), 0, zc));
  }
  if (stage < 2) return;
  const c = M.floor1 + (G.top - M.floor1) * Math.min(1, k * 1.4);
  // Its side walls rise from the range's, and its front and back over the arch.
  for (const s of [-1, 1]) {
    for (const g of risingWall(d, G.top, 0.4, [{ x: 0, w: 0.5, h: 0.8, y: 5.6 }], c, lod)) out.plaster.push(placed(g, s * G.half, 0, zc, s * Math.PI / 2));
  }
  for (const [z, ry] of [[z1, 0], [z0, Math.PI]]) {
    for (const g of risingWall(2 * G.half, G.top, 0.4, [{ x: 0, w: G.w * 2, h: G.spring, arch: true }, { x: 0, w: 0.7, h: 1.0, y: 5.4, arch: true }], c, lod)) out.plaster.push(placed(g, 0, 0, z, ry));
  }
  out.dark.push(box(2 * G.half - 0.8, G.top - G.spring - G.w - 0.2, d - 0.8, 0, G.spring + G.w + 0.1, zc, 1));
  // The passage's paving, worn by the wheels.
  out.flags.push(...paving(-G.w, G.w, z0, z1, 0.06, seed + 5, { rowW: 0.5, minL: 0.5, maxL: 0.9, lod }));
  // The arch's travertine voussoirs and keystone on the street face, the inscription over it.
  if (k > 0.5 || stage > 2) {
    const n = lod === 2 ? 5 : 9;
    for (let j = 0; j <= n; j++) {
      const a = Math.PI - (j / n) * Math.PI;
      const r = G.w + 0.18;
      const v = slab(0.36, 0.36, 0.2, { bevel: 0.01, seed: seed + j, wobble: 0, tone: 0.04, grime: 0.2 });
      v.translate(0, -0.18, 0);
      v.rotateZ(a - Math.PI / 2);
      v.translate(Math.cos(a) * r, G.spring + Math.sin(a) * r, z1 + 0.06);
      out.trav.push(v);
    }
    out.marble.push(slab(3.0, 0.62, 0.08, { bevel: 0.01, seed: seed + 30, wobble: 0, tone: 0.02, grime: 0 }).translate(0, G.spring + G.w + 0.55, z1 + 0.04));
    if (lod === 0) out.letters.push(...inscribe('MANSIO', G.spring + G.w + 0.68, z1 + 0.085, 0.34));
    else if (lod === 1) out.letters.push(box(2.2, 0.32, 0.006, 0, G.spring + G.w + 0.68, z1 + 0.085));
  }
  // The gate's leaves: open (staffed) folded back inside the passage, shut across it, or broken (sacked).
  const lw = G.w - 0.02;
  const lh = G.spring + 0.2;
  for (const s of [-1, 1]) {
    const open = box(lw, lh, 0.1, 0, 0.05, 0, 0.7);
    open.translate(-s * lw / 2, 0, 0);
    const shut = open.clone();
    open.rotateY(s * 1.5);
    open.translate(s * G.w, 0, z0 + 0.6);
    shut.translate(s * G.w, 0, z1 - 0.5);
    if (state === 'sacked') {
      if (s < 0) out.wood.push(open.rotateZ(0.05));
      else out.wood.push(shut.rotateX(-1.45).translate(0, 0.1, 2.6));
    } else {
      out.doorOpen.push(open);
      out.doorShut.push(shut);
    }
  }
  if (k < 0.8 && stage === 2) return;
  // Its hipped roof.
  const y = G.top;
  const top = y + 1.2;
  const o = 0.3;
  const xa = -G.half - o;
  const xb = G.half + o;
  const za = z0 - o;
  const zb = Math.min(z1 + o, M.half - 0.02);
  const quads = [
    [[xa, y, zb], [xb, y, zb], [0.5, top, zc], [-0.5, top, zc]],
    [[xb, y, za], [xa, y, za], [-0.5, top, zc], [0.5, top, zc]],
    [[xa, y, za], [xa, y, zb], [-0.5, top, zc], [-0.5, top, zc]],
    [[xb, y, zb], [xb, y, za], [0.5, top, zc], [0.5, top, zc]],
  ];
  quads.forEach((q, i) => {
    const r = roofSlope(q, { lod, seed: seed + 40 + i });
    out.tile.push(...r.tile);
    out.wood.push(...r.wood);
  });
  out.trav.push(slab(2 * G.half + 0.3, 0.16, d + 0.3, { bevel: 0.01, seed: seed + 50, wobble: 0, tone: 0.02, grime: 0.1 }).translate(0, y - 0.16, zc));
}

/** The bath at the back right corner: its drum and dome rising through the roof, the furnace flue beside it. */
function bathCorner(lod, seed, out, stage, f) {
  if (stage < 2) return;
  const k = share(stage, f, 2);
  const B = M.bath;
  const seg = lod === 2 ? 10 : lod ? 16 : 28;
  const top = M.eave + (B.top - M.eave) * Math.min(1, k * 1.5);
  const drum = revolve(profileOf([[B.r, M.eave - 0.4], [B.r, top], [B.r + 0.08, top + 0.04], [B.r + 0.08, top + 0.14], [B.r - 0.2, top + 0.14]]), { segments: seg, metres: 1, tint: () => 0.9 });
  out.brick.push(drum.translate(B.x, 0, B.z));
  if (k >= 0.66 || stage > 2) {
    const prof = [];
    for (let j = 0; j <= 6; j++) {
      const a = (j / 6) * (Math.PI / 2);
      prof.push([Math.max(0.01, (B.r - 0.2) * Math.cos(a)), B.top + 0.14 + (B.r - 0.4) * Math.sin(a)]);
    }
    out.vault.push(revolve(prof, { segments: seg, metres: 1, tint: (p) => 0.82 + 0.18 * Math.min(1, (p.y - B.top) / 1) }).translate(B.x, 0, B.z));
    // Small windows round the drum.
    if (lod < 2) {
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2 + 0.3;
        out.dark.push(placed(box(0.3, 0.42, 0.02, 0, 0, 0, 1), B.x + Math.sin(a) * (B.r + 0.005), B.top - 0.75, B.z + Math.cos(a) * (B.r + 0.005), a));
      }
    }
  }
  // The flue stack against the back wall, capped; its smoke while the bath is fired (with the kitchen's).
  out.brick.push(box(0.45, 7.6, 0.45, 5.4, 0, -M.out + 0.25, 0.85));
  out.trav.push(slab(0.6, 0.1, 0.6, { bevel: 0.01, seed: seed + 3, wobble: 0, tone: 0, grime: 0.5 }).translate(5.4, 7.6, -M.out + 0.25));
  out.dark.push(box(0.25, 0.01, 0.25, 5.4, 7.71, -M.out + 0.25));
}

/** The kitchen's chimney over the tavern (back range, left of the middle) and the hearth glow seen through its door. */
function kitchen(lod, seed, out, stage) {
  if (stage < 3) return;
  out.brick.push(box(0.5, 1.5, 0.5, -2.6, M.ridge - 0.6, -M.ridgeAt, 0.85));
  out.trav.push(slab(0.66, 0.1, 0.66, { bevel: 0.01, seed, wobble: 0, tone: 0, grime: 0.5 }).translate(-2.6, M.ridge + 0.9, -M.ridgeAt));
  const c = coals(-0.6, 0.05, -M.inner - 0.9, 0.35, { seed: seed + 3, lod });
  out.coalsLit.push(...c.hot);
  out.coalsCold.push(...c.hot.map((g) => g.clone()));
  out.charcoal.push(...c.dark);
}

/** Where the smoke rises: the kitchen's chimney and the bath's flue. */
const SMOKE_AT = Object.freeze([[-2.6, M.ridge + 1.0, -M.ridgeAt], [5.4, 7.75, -M.out + 0.25]]);

// ---------------------------------------------------------------------------
// The store's food, a sacked inn
// ---------------------------------------------------------------------------

/** The stores' food (its own kit, shown while the larder holds some): sacks, amphorae, baskets of bread and fruit along the right colonnade. */
export function buildMansioFood({ lod = 0, seed = 781 } = {}) {
  const p = new TaggedParts('mansio-food');
  const R = ruralMaterials();
  const sacks = [];
  const jars = [];
  const fruit = [];
  const wicker = [];
  const x0 = M.inner - 0.55;
  for (let k = 0; k < (lod === 2 ? 3 : 6); k++) sacks.push(sack(0.42, 0.62, seed + k, lod).translate(x0 - (k % 2) * 0.5, 0.05, -3.6 + Math.floor(k / 2) * 0.55));
  for (let k = 0; k < (lod === 2 ? 3 : 7); k++) {
    const j = jar({ amphora: true, sunk: 0, lod, seed: seed + 20 + k });
    for (const g of [j].flat()) jars.push(g.translate(x0 - (k % 2) * 0.4, 0.05, 0.6 + Math.floor(k / 2) * 0.42));
  }
  for (const [x, z] of [[x0 - 0.1, 3.2], [x0 - 0.7, 3.4]]) {
    const b = basket(0.26, 0.3, 0, lod);
    wicker.push(b.wicker.translate(x, 0.05, z));
    const h = heap(lod === 2 ? 4 : 10, 0.2, 0.3, 0.06, [[0.62, 0.42, 0.18], [0.7, 0.5, 0.2]], seed + x, lod);
    if (h) fruit.push(h.translate(x, 0.05, z));
  }
  // Bread on the tavern's counter.
  const bread = heap(lod === 2 ? 3 : 6, 0.25, 1.1, 0.07, [[0.6, 0.4, 0.2], [0.55, 0.36, 0.18]], seed + 40, lod, 0.6);
  if (bread) fruit.push(bread.translate(0.9, 0, -M.inner + 1.15));
  p.add('sacks', R.sack, sacks);
  p.add('jars', R.clay, jars);
  p.add('baskets', R.wicker, wicker);
  p.add('produce', R.produce, fruit, { cast: false });
  return p.build();
}

/** What raiders leave of the inn: rubble in the gate and the court, soot over the doors. */
function sackedParts(lod, seed, out) {
  for (const [x, z, r, n] of [[0.4, 8.6, 1.0, 16], [3.2, 2.4, 0.9, 12], [-3.6, -3.0, 0.8, 10], [4.4, -4.0, 0.7, 9]]) out.rubble.push(...rubbleHeap(x, z, r, n, seed + x * 7 + z, lod));
  for (const [x, z, ry, w, h] of [[0, M.out + 0.42, 0, 3.6, 4.2], [M.inner - 0.01, 0.8, -Math.PI / 2, 3.0, 3.0], [-0.6, -M.inner + 0.01, 0, 2.6, 2.6]]) out.soot.push(scorch(x, 0.05, z, ry, w, h));
}

// ---------------------------------------------------------------------------
// The site's dressing
// ---------------------------------------------------------------------------

/** The site's dressing at stage `stage` with `f` of it done (models/worksite.js draws it), and its crew. */
export function mansioSite(stage, f) {
  const site = { scaffolds: [], cranes: [], centering: [], piles: [], crew: [] };
  if (stage >= MANSIO_STAGES) return site;
  const S = site;
  if (stage === 0) {
    S.piles.push({ x: 7.6, z: 8.2, ry: 0.2, good: 'clay', n: 3 }, { x: -7.8, z: 8.0, ry: -0.2, good: 'timber', n: 2 }, { x: -1.8, z: 3.6, ry: 0.1, good: 'stone', n: 2 });
    S.cranes.push({ x: 2.4, z: -2.6, ry: 0.6, h: 4.2, kind: 'shear' });
  } else if (stage === 1) {
    const h = Math.max(1.4, M.floor1 * f + 1.0);
    S.scaffolds.push({ x: 0, z: M.out + 0.55, w: 9.0, d: 0.9, h, ry: 0 }, { x: M.out + 0.55, z: -1.0, w: 7.0, d: 0.9, h, ry: Math.PI / 2 }, { x: -M.inner + 0.9, z: 0, w: 6.0, d: 0.8, h, ry: -Math.PI / 2 });
    S.cranes.push({ x: 2.2, z: -2.4, ry: 0.4, h: 6.0, kind: 'treadwheel' });
    S.piles.push({ x: 2.6, z: 3.0, ry: 0.1, good: 'timber', n: 4 }, { x: -2.6, z: 3.0, ry: -0.1, good: 'clay', n: 3 }, { x: 3.0, z: -1.0, ry: 0.3, good: 'iron', n: 1 });
  } else {
    const h = Math.max(M.floor1 + 1.4, M.floor1 + (M.eave - M.floor1) * f + 1.2);
    S.scaffolds.push({ x: 0, z: M.out + 0.55, w: 12.0, d: 0.9, h, ry: 0 }, { x: -M.out - 0.55 + 0.3, z: 0, w: 8.0, d: 0.8, h, ry: -Math.PI / 2 }, { x: 0, z: -M.out - 0.25, w: 8.0, d: 0.8, h, ry: Math.PI });
    S.cranes.push({ x: 2.2, z: -1.6, ry: 0.4, h: 8.5, kind: 'treadwheel' });
    S.piles.push({ x: 2.6, z: 2.8, ry: 0.1, good: 'timber', n: 3 }, { x: -2.8, z: 2.4, ry: -0.2, good: 'clay', n: 2 });
  }
  S.crew = siteCrew(stage, f);
  return site;
}

/** The builders at a stage (people/actors.js specs). */
function siteCrew(stage, f) {
  const tun = [DYES.undyed, DYES.oatmeal, DYES.fawn, DYES.brownWool, DYES.ochre, DYES.madder];
  const man = (i, clip, at, ry, extra = {}) => ({ body: 'm', dress: ['tunic:short'], hair: i % 3 ? 'crop' : 'curls', clip, at, ry, seed: 760 + stage * 20 + i, colours: { tunic: tun[i % tun.length] }, ...extra });
  const list = [man(0, 'read', [-1.2, 0.05, 4.4], 2.8, { dress: ['tunic:knee'], props: { L: 'tablet' } })];
  if (stage === 0) {
    list.push(man(1, 'hoe', [-3.2, 0.05, -2.0], 0.4, { props: { R: 'hoe' } }), man(2, 'hammer', [2.0, 0.05, -4.4], 0, { props: { R: 'hammer' } }));
    list.push(man(3, 'carry', [1.0, 0.05, 6.4], Math.PI, { props: { L: 'sack' }, route: { length: 4.0, speed: 0.8, pauseEnd: 3, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } }));
  } else if (stage === 1) {
    list.push(man(1, 'hammer', [-M.inner + 1.6, 0.05, 1.2], -Math.PI / 2, { props: { R: 'hammer' } }), man(2, 'stir', [-2.4, 0.05, 3.4], 0.6));
    list.push(man(3, 'carry', [3.4, 0.05, 2.4], Math.PI, { props: { L: 'sack' }, route: { length: 3.6, speed: 0.75, pauseEnd: 3, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } }));
    list.push(man(4, 'pump', [2.0, 0.05, -1.6], 0.4));
  } else {
    void f;
    list.push(man(1, 'hammer', [-2.0, 0.05, 2.0], 0, { props: { R: 'hammer' } }), man(2, 'carry', [3.2, 0.05, 2.0], Math.PI, { props: { L: 'sack' }, route: { length: 3.0, speed: 0.75, pauseEnd: 3, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } }));
    list.push(man(3, 'pump', [2.0, 0.05, -1.0], 0.4), man(4, 'sweep', [-3.6, 0.05, 1.0], 1.2, { props: { R: 'broom' } }));
  }
  return list;
}

// ---------------------------------------------------------------------------
// The people and the beasts
// ---------------------------------------------------------------------------

/** Coats: mules' browns and greys, the post's horses' bays and greys ([coat, mane and points]). */
const COATS = Object.freeze([[0x5a4030, 0x2a1e16], [0x7a6a5a, 0x3a3028], [0x4a3a30, 0x1d1612], [0x9a5a2a, 0x2a1e16], [0xb8b4ac, 0x6e6a64]]);

/** A beast of the stables or the road: `opt` 'mule:pack', 'mule', '' (a horse). */
function beast(k, opt, at, ry, clip = 'horse:stand', extra = {}) {
  const [coat, mane] = COATS[k % COATS.length];
  const mule = opt.startsWith('mule');
  return { beast: opt ? `quad:horse:${opt}` : 'quad:horse', clip, at, ry, seed: 790 + k, scale: mule ? 0.88 : 1, colours: { skin: coat, mantle: coat, hair: mane, trim: coat, accent: [0xa3352b, 0x6a8a3a, 0xc8a050][k % 3], leather: 0x3a2618, metal: 0x8a6a40 }, ...extra };
}

/**
 * The inn's people and beasts (people/actors.js specs, its metres) in its state:
 *   'open'  the horses and mules at their mangers, a mule train coming in at
 *           the gate led by its muleteer, an ox wagon unloading by the
 *           stores with a porter carrying its sacks in, travellers at the
 *           tables under the vine, the innkeeper at his counter, a girl
 *           with a jug, a traveller in his hooded cloak at the well, a
 *           guest on the gallery, the stable boy with feed
 *   'out'   staffed, no food: the beasts stabled, the innkeeper idle at his
 *           counter, the stable boy; nobody at the tables
 *   'shut'  nobody (the beasts gone with their owners)
 */
export function mansioActors(state) {
  if (state !== 'open' && state !== 'out') return [];
  const I = M.inner;
  const list = [];
  // The stables: under the left colonnade, heads to the manger at the court wall.
  const stalls = [-3.3, -1.1, 1.1, 3.3];
  stalls.forEach((z, k) => {
    if (state === 'out' && k % 2) return;
    list.push(beast(k, k % 3 === 2 ? '' : 'mule', [-I + 1.55, 0.05, z], -Math.PI / 2 + (k % 2 ? 0.08 : -0.06)));
  });
  list.push({ body: 'm', dress: ['tunic:short'], hair: 'crop', clip: 'carry', props: { L: 'sack' }, at: [-M.cols + 0.5, 0.05, -M.cols + 0.4], ry: 0, seed: 801, colours: { tunic: DYES.fawn }, route: { length: 7.6, speed: 0.8, pauseEnd: 4, pauseStart: 4, clipEnd: 'give', clipStart: 'idle', faceEnd: -Math.PI / 2, faceStart: -Math.PI / 2 } });
  list.push({ body: 'm', dress: ['tunic:knee'], hair: 'curls', beard: 'short', clip: state === 'open' ? 'give' : 'idle', props: state === 'open' ? { R: 'cup' } : {}, at: [0.2, 0.05, -I + 0.55], ry: 0, seed: 802, colours: { tunic: DYES.oxblood } });
  if (state === 'out') return list;
  // A mule train coming in at the gate: two pack mules, their muleteer leading the first.
  const zIn = M.out - 0.6;
  const run = { length: 6.6, speed: 0.9, pauseEnd: 6, pauseStart: 2, clipEnd: 'horse:stand', clipStart: 'horse:stand' };
  list.push(beast(5, 'mule:pack', [0.55, 0.05, zIn], Math.PI, 'horse:walk', { route: run }));
  list.push(beast(6, 'mule:pack', [0.55, 0.05, zIn + 2.4], Math.PI, 'horse:walk', { route: { ...run, length: 4.6 } }));
  list.push({ body: 'm', dress: ['tunic:short', 'paenula'], hair: 'crop', beard: 'full', clip: 'walk', at: [-0.35, 0.05, zIn - 1.1], ry: Math.PI, seed: 803, colours: { tunic: DYES.brownWool, mantle: DYES.walnut }, route: { length: 6.6, speed: 0.9, pauseEnd: 6, pauseStart: 2, clipEnd: 'talk', clipStart: 'idle' } });
  // The ox wagon unloading by the stores, a porter carrying its sacks in.
  list.push({ rigid: 'cart:wagon', at: [3.0, 0, -0.4], ry: 0, seed: 804, colours: { accent: 0xb8a070 } });
  list.push({ rigid: 'beast:ox', at: [3.0, 0, 2.9], ry: 0, seed: 805, colours: { skin: 0xb8b0a0, hair: 0x8a8070, trim: 0xd8d0c0 } });
  list.push({ body: 'm', dress: ['tunic:short'], hair: 'curls', clip: 'shoulder', props: { L: 'sack' }, at: [3.75, 0.05, -0.2], ry: Math.PI / 2, seed: 806, colours: { tunic: DYES.undyed }, route: { length: 1.6, speed: 0.7, pauseEnd: 2, pauseStart: 3, clipEnd: 'give', clipStart: 'hold' } });
  // Travellers at the tables under the vine (the benches' tops SEAT_H high).
  for (const [tx, tz] of [[-2.6, -3.6], [2.6, -3.6]]) {
    list.push({ body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'sitTalk', at: [tx - 0.35, 0.05, tz - 0.62], ry: 0, seed: 810 + tx, colours: { tunic: tx < 0 ? DYES.woad : DYES.ochre } });
    list.push({ body: 'm', dress: ['tunic:knee', 'paenula'], hair: 'curls', beard: 'short', clip: 'sit', props: { R: 'cup' }, at: [tx + 0.35, 0.05, tz + 0.62], ry: Math.PI, seed: 812 + tx, colours: { tunic: DYES.oatmeal, mantle: DYES.green } });
  }
  list.push({ body: 'f', dress: ['tunic:long'], hair: 'bun', clip: 'jarCarry', props: { R: 'jar' }, at: [-1.2, 0.05, -2.6], ry: Math.PI / 2, seed: 815, colours: { tunic: DYES.rose, leather: 0xa8643a }, route: { length: 2.4, speed: 0.7, pauseEnd: 3, pauseStart: 3, clipEnd: 'jarStand', clipStart: 'jarStand' } });
  // A traveller at the well in his hooded cloak; a guest leaning on the gallery's rail over the court.
  list.push({ body: 'm', dress: ['tunic:knee', 'paenula'], hair: 'crop', clip: 'talk', at: [0.9, 0.05, 1.7], ry: -2.4, seed: 816, colours: { tunic: DYES.fawn, mantle: DYES.brownWool } });
  list.push({ body: 'm', dress: ['tunic:knee'], hair: 'curls', clip: 'idle', at: [-M.cols - 0.45, M.floor1 + 0.1, -1.4], ry: Math.PI / 2, seed: 817, colours: { tunic: DYES.madder } });
  return list;
}

// ---------------------------------------------------------------------------
// The build
// ---------------------------------------------------------------------------

const KEYS = ['earth', 'trench', 'flags', 'floor', 'core', 'plaster', 'red', 'brick', 'trav', 'marble', 'cols', 'tile', 'wood', 'dark', 'letters', 'bronze', 'rope', 'hay', 'clay',
  'vine', 'vault', 'troughWater', 'doorOpen', 'doorShut', 'coalsLit', 'coalsCold', 'charcoal', 'rubble', 'soot'];

/**
 * Build the inn: { group, meshes, triangles }; meshes tagged in
 * userData.when. `stage` 0-2 a site (`f` of the stage done) or 3 finished;
 * `ice` a hard frost (the trough frozen); `sacked`.
 */
export function buildMansio({ lod = 0, stage = MANSIO_STAGES, f = 1, ice = false, sacked = false, seed = 741 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  stage = Math.max(0, Math.min(MANSIO_STAGES, stage | 0));
  f = Math.max(0, Math.min(1, f));
  const done = stage >= MANSIO_STAGES;
  const out = bag(KEYS);
  court(lod, seed, out, stage, f);
  // The footings under every wall (a socle once built).
  const footH = stage === 0 ? 0.08 + 0.3 * Math.min(1, f * 1.6) : 0.3;
  for (const s of SIDES) {
    const half = s.name === 'front' || s.name === 'back' ? M.out : M.inner;
    for (const [b, t] of [[M.out - 0.2, 0.5], [M.inner + 0.15, 0.4]]) out.core.push(toSide(box(2 * (b === M.out - 0.2 ? half : M.inner) + 0.2, footH, t, 0, 0, b, 0.85), s.ry));
  }
  for (const s of SIDES) range(lod, seed + 10 + s.ry * 7, out, stage, f, s, sacked);
  fittings(lod, seed + 60, out, stage, f, sacked);
  roof(lod, seed + 80, out, stage, f, sacked);
  gatehouse(lod, seed + 100, out, stage, f, sacked ? 'sacked' : '');
  bathCorner(lod, seed + 120, out, stage, f);
  kitchen(lod, seed + 140, out, done ? 3 : stage);
  if (sacked) sackedParts(lod, seed + 160, out);
  const m = healthMaterials();
  const R = ruralMaterials();
  if (lod === 2) {
    out.trav.push(...out.floor.splice(0));
    out.letters = out.rope = out.charcoal = [];
  }
  const p = new TaggedParts('mansio');
  const small = { cast: false };
  p.add('ground', m.earth, out.earth, small);
  p.add('trench', material('trench-earth', { surface: 'earth', color: 0x8a6e4e, vertexColors: true, snow: 1 }), out.trench, small);
  p.add('flags', m.flags, out.flags, small);
  p.add('floor', m.shelteredFloor, out.floor, small);
  p.add('core', m.core, out.core);
  p.add('walls', m.plaster, out.plaster);
  p.add('dado', m.red, out.red, small);
  p.add('brick', m.brick, out.brick);
  p.add('stone', m.trav, out.trav);
  p.add('marble', m.marble, out.marble);
  p.add('columns', m.trav, out.cols);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  p.add('inside', m.dark, out.dark, small);
  p.add('letters', m.letters, out.letters, small);
  p.add('bronze', m.bronze, out.bronze, small);
  p.add('rope', R.rope, out.rope, small);
  p.add('hay', material('hay', { surface: 'thatch', color: 0xc4ad7c, vertexColors: true, snow: 1 }), out.hay, small);
  p.add('jugs', R.clay, out.clay, small);
  p.add('vine', R.leaf, out.vine, small);
  p.add('vault', material('vault-render', { surface: 'limestone', color: 0xe6c8b6, vertexColors: true, snow: 1 }), out.vault);
  p.add('trough-water', ice ? iceMaterial() : shallowWaterMaterial(), out.troughWater, { cast: false });
  p.add('rubble', m.core, out.rubble);
  p.add('soot', material('soot', { color: 0x15110e, roughness: 1, opacity: 0.55, snow: 0, wet: 0 }), out.soot, small);
  if (done) {
    p.add('gate', m.wood, out.doorOpen, { when: 'staffed' });
    p.add('gate', m.wood, out.doorShut, { when: 'shut' });
    p.add('coals', m.embers, out.coalsLit, { when: 'open', cast: false });
    // (Cold in both the other states: a part a state, as partShows has no tag for 'out' or 'shut'.)
    p.add('coals', m.ash, out.coalsCold, { when: 'out', cast: false });
    p.add('coals', m.ash, out.coalsCold.map((g) => g.clone()), { when: 'shut', cast: false });
    p.add('charcoal', m.dark, out.charcoal, small);
  } else {
    p.add('gate', m.wood, out.doorShut);
  }
  if (done && !sacked && lod < 2) {
    for (const [lx, ly, lz] of MANSIO_LAMPS) {
      const l = lantern(lx, ly, lz, lod);
      p.add('lantern', m.bronze, [...l.bronze, staff([lx, ly + 0.3, lz], [lx, ly + 0.5, lz - 0.2], 0.012, 4)], small);
      p.add('lamp', lanternPane(), [l.pane], { when: 'staffed', cast: false });
      p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
    }
  }
  if (done && !sacked) {
    // The kitchen's and the bath's smoke while the inn is fed and staffed.
    const rows = lod === 2 ? 3 : lod ? 5 : 8;
    const smoke = [lin(0x8a8580), lin(0x77716a)];
    p.add('smoke', steamMaterial(), SMOKE_AT.map(([x, y, z], i) => plume(x, y, z, { h: 1.8, r: 0.14, n: 3, seed: 70 + i, rows, rgb: smoke[i % 2], alpha: 0.85, lean: [-0.5, 0.4] })), { when: 'open', cast: false });
  }
  if (!done) addSite(p, siteParts(mansioSite(stage, f), lod));
  return p.build();
}

/** The inn's lanterns (x, y, z): either side of the gate on the street, facing it; lit while it is staffed. */
export const MANSIO_LAMPS = Object.freeze([
  Object.freeze([-G.w - 0.75, 2.5, M.out + 0.22]), Object.freeze([G.w + 0.75, 2.5, M.out + 0.22]),
]);
