/**
 * models/praetorium.js
 * ----------------------------------------------------------------------------
 * The governor's house of the 3D look (the Praetorium, 3 x 3, 12 m), from
 * the Roman town house rather than the 2D sprite:
 *
 *   - The atrium house of Pompeii (the House of the Faun, the House of the
 *     Vettii, the House of the Tragic Poet): a blank front on the street,
 *     the door between pilasters with capitals, a mosaic greeting in the
 *     threshold (the Faun's HAVE, others' SALVE), stone benches outside
 *     where clients waited for the morning call; the narrow entrance (the
 *     fauces) into the atrium, its roof falling inward on four columns (a
 *     tetrastyle atrium, as the Silver Wedding's) to the opening over the
 *     impluvium; the master's strongbox there, the lararium for the
 *     household's gods; the tablinum open between the atrium and the
 *     peristyle behind, a garden of clipped box and flowers round a
 *     cistern's mouth, its columns stuccoed and painted red below, as the
 *     Vettii's; walls painted red and black and ochre in panels.
 *   - A provincial governor lived in the praetorium of his capital, often
 *     a house like this taken over or built for him; a soldier stood at
 *     his door.
 *
 * So, in 12 m: the street front stuccoed white on a travertine socle, the
 * door and its lanterns, benches, a guard; the atrium ring (the roof
 * falling in to its opening) over the impluvium; the peristyle behind,
 * fourteen red-and-white columns (instanced: models/government.js) round
 * the garden, the back wall painted with a lararium in it.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  lived in: the doors and shutters open, the governor in his
 *           toga with a client in the garden, the lady of the house on her
 *           bench, the servants about; the guard at the door; lamps lit
 *   'shut'  no servants: shut up, doors and shutters closed, nobody
 *   'out'   trouble near: doors and shutters shut, the household indoors,
 *           three guards at the door, the lamps lit
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { slab, tuscanColumn, TaggedParts } from './masonry.js';
import { sentry, staff } from './castra.js';
import {
  govMaterials, box, D, gable, standard, FRESCO, wallAlong, frescoFace, darkIn, doubleDoor, shutters, ringRoof, coping, rectMinus, slabs, court,
  architraveRound, columnsRound, impluvium, threshold, togate, servant, matron, addPeople, boxEdging, bedPlants, flowerBed, gardenTree,
  lantern, lanternPane,
} from './domus.js';
import { gableTri } from './curia.js';

/** The house's measures (metres): the tests, the lab and the game read them. */
export const PRAETORIUM = Object.freeze({
  half: 6,
  floorY: 0.14,
  /** The outer walls' faces: the street front, the sides, the back; the wall between the two courts. */
  front: 5.0,
  side: 5.88,
  back: -5.88,
  mid: 1.0,
  /** The atrium's ring: its walls' top, its eave over the opening, the opening (compluvium) [x0, x1, z0, z1]. */
  atrium: Object.freeze({ top: 3.3, eave: 2.65, inner: Object.freeze([-1.9, 1.9, 2.4, 3.75]) }),
  /** The peristyle's ring and its garden's edge (the columns' line). */
  peri: Object.freeze({ top: 2.95, eave: 2.45, inner: Object.freeze([-4.35, 4.35, -4.55, -0.45]) }),
  /** The street door: its half width and height. */
  door: Object.freeze([0.65, 2.55]),
  /** The lanterns either side of the door (x, y, z), facing the street. */
  lamps: Object.freeze([Object.freeze([-1.55, 2.1, 5.14]), Object.freeze([1.55, 2.1, 5.14])]),
});

const P = PRAETORIUM;
const FY = P.floorY;
const T = 0.3;
const BEAM = 0.3;

/** The atrium's and the peristyle's columns: [x, z] places and their height (base to abacus), for government.js. */
export const PRAETORIUM_COLS = Object.freeze({
  atrium: Object.freeze([[-1.9, 2.4], [1.9, 2.4], [-1.9, 3.75], [1.9, 3.75]]),
  atriumH: P.atrium.eave - BEAM - FY,
  periH: P.peri.eave - BEAM - FY,
});

/** The outer walls, the wall between the courts, their socle and copings, the street front's door, windows, pilasters. */
function walls(lod, seed, out) {
  const { front: zf, side: xs, back: zb, mid: zm } = P;
  const ta = P.atrium.top;
  const tp = P.peri.top;
  const [dw, dh] = P.door;
  const win = [[-3.4, 0.6], [3.4, 0.6]];
  const winY = [2.1, 2.75];
  // The street front: the door and two small windows high up.
  const ops = [{ a: -dw, b: dw, lo: FY, hi: FY + dh }, ...win.map(([x, w]) => ({ a: x - w / 2, b: x + w / 2, lo: winY[0], hi: winY[1] }))];
  out.stucco.push(...wallAlong('x', -xs, xs, zf - T / 2, T, 0, ta, ops));
  // The sides: high along the atrium, lower along the peristyle; a window into each side room.
  for (const s of [-1, 1]) {
    const x = s * (xs - T / 2);
    out.stucco.push(...wallAlong('z', zm, zf - T, x, T, 0, ta, [{ a: 2.55, b: 3.1, lo: winY[0], hi: winY[1] }]));
    out.stucco.push(...wallAlong('z', zb, zm, x, T, 0, tp));
    out.dark.push(darkIn('z', 2.55, 3.1, winY[0], winY[1], s * (xs - T), -s));
  }
  out.stucco.push(box(2 * xs, tp, T, 0, 0, zb + T / 2));
  // Between the courts: the tablinum's wide opening.
  out.stucco.push(...wallAlong('x', -xs + T, xs - T, zm, T, 0, ta, [{ a: -1.5, b: 1.5, lo: FY, hi: 2.55 }]));
  // A socle of travertine round the outside, and copings on every wall's top.
  out.trav.push(box(2 * xs + 0.04, 0.45, 0.04, 0, 0, zf + 0.02, 0.9));
  out.trav.push(box(2 * xs + 0.04, 0.45, 0.04, 0, 0, zb - 0.02, 0.9));
  for (const s of [-1, 1]) out.trav.push(box(0.04, 0.45, zf - zb, s * (xs + 0.02), 0, (zf + zb) / 2, 0.9));
  if (lod < 2) {
    out.cope.push(...coping('x', -xs, xs, zf - T / 2, T, ta));
    out.cope.push(...coping('x', -xs, xs, zb + T / 2, T, tp));
    out.cope.push(...coping('x', -xs, xs, zm, T, ta));
    for (const s of [-1, 1]) {
      out.cope.push(...coping('z', zm, zf, s * (xs - T / 2), T, ta));
      out.cope.push(...coping('z', zb, zm, s * (xs - T / 2), T, tp));
    }
  }
  // The door's pilasters with their capitals and the cornice over it; the threshold's greeting.
  for (const s of [-1, 1]) {
    out.trav.push(box(0.26, dh + 0.25, 0.12, s * (dw + 0.13), 0, zf + 0.06, 0.95));
    if (lod < 2) out.trav.push(box(0.34, 0.16, 0.18, s * (dw + 0.13), dh + 0.25, zf + 0.09, 0.97));
  }
  out.trav.push(box(2 * dw + 0.8, 0.14, 0.24, 0, dh + 0.41, zf + 0.1, 0.97));
  out.trav.push(slab(2 * dw, FY, 0.4, { bevel: 0.01, seed, wobble: 0, tone: 0, grime: 0.3 }).translate(0, 0, zf - 0.1));
  out.tesserae.push(...threshold('HAVE', 0, FY, 4.2, 1.15, 0.6, lod));
  // The windows' dark, their sills.
  for (const [x, w] of win) {
    out.dark.push(darkIn('x', x - w / 2, x + w / 2, winY[0], winY[1], zf - T, -1));
    out.trav.push(box(w + 0.12, 0.06, 0.1, x, winY[0] - 0.06, zf + 0.04, 0.95));
  }
  // The front's painted dado (red, as Pompeian fronts were) between the socle and the white above, broken by the door.
  for (const [a, b] of [[-xs, -dw - 0.26], [dw + 0.26, xs]]) out.stucco.push(box(b - a, 0.7, 0.012, (a + b) / 2, 0.45, zf + 0.006, () => FRESCO.red));
  for (const s of [-1, 1]) out.stucco.push(box(0.012, 0.7, zf - zb, s * (xs + 0.006), 0.45, (zf + zb) / 2, () => FRESCO.red));
  // The porch over the door (prothyron): two columns, a beam, a little tiled gable with its pediment to the street.
  const px = 0.98;
  const pz = 5.72;
  for (const s of [-1, 1]) {
    for (const g of tuscanColumn(0.1, 2.5, lod)) out.trav.push(g.translate(s * px, 0.06, pz));
    out.trav.push(box(0.2, 0.2, pz - zf + 0.1, s * px, 2.56, (pz + zf) / 2, 0.95));
  }
  out.trav.push(box(2 * px + 0.24, 0.2, 0.22, 0, 2.56, pz, 0.95));
  const pr = gable({ x0: -1.22, x1: 1.22, z0: zf, z1: 5.8, eaveY: 2.78, pitch: D(22), along: 'z', over: 0.1, gableOver: 0.1, lod, seed: seed + 30 });
  out.tile.push(...pr.tile);
  out.wood.push(...pr.wood);
  out.stucco.push(gableTri(-1.2, 1.2, 5.84, 0.08, 2.76, pr.ridgeY - 0.04));
  // The pavement before the house: flags, a kerb, the clients' benches against the front.
  out.pave.push(box(2 * xs + 0.1, 0.06, 5.96 - zf, 0, 0, (5.96 + zf) / 2, 0.92));
  out.trav.push(box(2 * xs + 0.1, 0.12, 0.16, 0, 0, 5.88, 0.85));
  for (const s of [-1, 1]) {
    out.trav.push(slab(1.5, 0.08, 0.38, { bevel: 0.01, seed: seed + 5 + s, wobble: 0, tone: 0, grime: 0.1 }).translate(s * 2.1, 0.36, zf + 0.21));
    out.stucco.push(box(1.44, 0.36, 0.34, s * 2.1, 0, zf + 0.19, 0.85));
  }
}

/** The atrium: its ring of roof on four columns, the impluvium, the side rooms' walls and doors, the fauces, the paintings, the strongbox. */
function atrium(lod, seed, out) {
  const { top, eave, inner } = P.atrium;
  const { side: xs, front: zf, mid: zm } = P;
  const r = ringRoof([-xs, xs, zm, zf], inner, top, eave, { lod, seed });
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  out.beam.push(...architraveRound(inner, eave - BEAM, eave));
  // The impluvium under the opening; the floor round it (sheltered: the roof is over it).
  const imp = impluvium(0, 3.075, 3.1, 1.0, FY + 0.03, lod);
  out.trav.push(...imp.rim);
  out.pool.push(...imp.floor);
  out.water.push(...imp.water);
  out.floor.push(...slabs(rectMinus([-xs + T, xs - T, zm + T / 2, zf - T], [[-1.55, 1.55, 2.575, 3.575]]), 0, FY, 0.92));
  // The rooms either side (alae, cubicula): walls with two doors each, the dark inside.
  const wy = 2.8;
  for (const s of [-1, 1]) {
    const x = s * 3.05;
    const doors = [{ a: 1.35, b: 2.15, lo: FY, hi: 2.1 }, { a: 2.9, b: 3.7, lo: FY, hi: 2.1 }];
    out.inner.push(...wallAlong('z', zm + T / 2, zf - T, x, 0.2, FY, wy, doors));
    for (const d of doors) out.dark.push(darkIn('z', d.a, d.b, d.lo, d.hi, x + s * 0.1, s));
    out.fresco.push(...frescoFace('z', zm + T / 2, zf - T, x - s * 0.1, -s, FY, wy, { gaps: doors.map((d) => [d.a, d.b]), lod, main: FRESCO.red, panel: 1.0 }));
  }
  // The fauces: the passage from the door, between the front rooms; its floor the threshold's mosaic.
  for (const s of [-1, 1]) {
    out.inner.push(box(0.2, wy - FY, zf - T - 3.95, s * 0.85, FY, (zf - T + 3.95) / 2));
    out.inner.push(box(3.05 - 0.85, wy - FY, 0.2, s * 1.95, FY, 3.95));
    out.fresco.push(...frescoFace('x', s * 0.95, s * 2.95, 3.85, -1, FY, wy, { lod, main: FRESCO.black, frame: FRESCO.red, panel: 1.0 }).map((g) => g));
  }
  // The back wall of the atrium, painted either side of the tablinum's opening.
  out.fresco.push(...frescoFace('x', -2.95, 2.95, zm + T / 2, 1, FY, wy, { gaps: [[-1.5, 1.5]], lod, main: FRESCO.red, panel: 0.9 }));
  if (lod < 2) {
    // The master's strongbox (arca) on its plinth, bound in bronze, as the Vettii's in their atrium.
    out.wood.push(box(0.9, 0.55, 0.55, -2.25, FY + 0.12, 1.55, 0.6));
    out.trav.push(box(1.0, 0.12, 0.62, -2.25, FY, 1.55, 0.9));
    out.bronze.push(box(0.92, 0.05, 0.57, -2.25, FY + 0.6, 1.55), box(0.06, 0.56, 0.57, -2.6, FY + 0.12, 1.55), box(0.06, 0.56, 0.57, -1.9, FY + 0.12, 1.55));
    // A marble table (cartibulum) behind the impluvium.
    out.marble.push(slab(1.0, 0.06, 0.5, { bevel: 0.01, seed: seed + 9, wobble: 0, tone: 0, grime: 0 }).translate(0, FY + 0.78, 1.95));
    for (const s of [-1, 1]) out.marble.push(slab(0.12, 0.78, 0.42, { bevel: 0.01, seed: seed + 10 + s, wobble: 0, tone: 0, grime: 0.1 }).translate(s * 0.38, FY, 1.95));
  }
}

/** The peristyle: its ring of roof on the columns, the garden, the paintings and the lararium on the back wall. */
function peristyle(lod, seed, out) {
  const { top, eave, inner } = P.peri;
  const { side: xs, back: zb, mid: zm } = P;
  const cols = court({ outer: [-xs, xs, zb, zm], inner, topY: top, eaveY: eave, floorY: FY, step: 1.75, lod, seed: seed + 3, out, beamH: BEAM });
  // The walls round the porticoes, painted: red panels at the back, black along the sides, as in the Vettii's.
  out.fresco.push(...frescoFace('x', -xs + T, xs - T, zb + T, 1, FY, top - 0.25, { lod, main: FRESCO.red, frame: FRESCO.ochre, panel: 1.4 }));
  for (const s of [-1, 1]) out.fresco.push(...frescoFace('z', zb + T, zm - T / 2, s * (xs - T), -s, FY, top - 0.25, { lod, main: FRESCO.black, frame: FRESCO.red, panel: 1.3 }));
  out.fresco.push(...frescoFace('x', -xs + T, xs - T, zm - T / 2, -1, FY, top - 0.1, { gaps: [[-1.5, 1.5]], lod, main: FRESCO.ochre, frame: FRESCO.red, panel: 1.2 }));
  // The garden: a lawn, gravel walks crossing at the cistern's mouth, four beds edged in clipped box.
  const [a0, a1, b0, b1] = inner;
  const g = [a0 + 0.21, a1 - 0.21, b0 + 0.21, b1 - 0.21];
  const gy = FY - 0.1;
  const cz = (g[2] + g[3]) / 2;
  out.lawn.push(box(g[1] - g[0], gy, g[3] - g[2], 0, 0, cz, 0.95));
  out.gravel.push(box(g[1] - g[0], 0.02, 0.6, 0, gy, cz, 0.95), box(0.6, 0.02, g[3] - g[2], 0, gy, cz, 0.95));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x0 = sx < 0 ? g[0] + 0.25 : 0.55;
      const x1 = sx < 0 ? -0.55 : g[1] - 0.25;
      const z0 = sz < 0 ? g[2] + 0.25 : cz + 0.55;
      const z1 = sz < 0 ? cz - 0.55 : g[3] - 0.25;
      out.leaf.push(...boxEdging(x0, x1, z0, z1, gy, 0.32, lod, seed + 20 + sx * 3 + sz));
      out.earth.push(box(x1 - x0 - 0.44, 0.04, z1 - z0 - 0.44, (x0 + x1) / 2, gy, (z0 + z1) / 2, 0.8));
      out.leaf.push(...bedPlants(x0 + 0.4, x1 - 0.4, (z0 + z1) / 2 - 0.05, (z0 + z1) / 2 + 0.05, gy, seed + 30 + sx * 5 + sz, lod));
      out.flowers.push(...flowerBed(x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 0.3, gy, seed + 40 + sx * 7 + sz, lod, 14));
    }
  }
  // Two small laurels at the back of the garden.
  for (const s of [-1, 1]) {
    const t = gardenTree(s * 2.4, gy, g[2] + 0.35, 1.7, lod, seed + 50 + s);
    out.wood.push(...t.wood);
    out.leaf.push(...t.leaf);
  }
  // The cistern's mouth (a marble puteal) where the walks cross.
  out.marble.push(revolve(profileOf([[0.32, gy], [0.34, gy + 0.08], [0.3, gy + 0.14], [0.3, gy + 0.62], [0.34, gy + 0.68], [0.34, gy + 0.74], [0.24, gy + 0.74], [0.24, gy + 0.3]]), { segments: lod === 2 ? 8 : lod ? 14 : 28, metres: 1, tint: (p) => 0.85 + 0.15 * Math.min(1, (p.y - gy) / 0.7) }).translate(0, 0, cz));
  // The lararium in the back wall: a little shrine of two columns and a pediment over a painted niche.
  if (lod < 2) {
    const z = zb + T;
    out.stucco.push(box(1.3, 0.9, 0.36, 0, FY, z + 0.18, 0.95));
    out.fresco.push(box(0.9, 1.0, 0.01, 0, FY + 1.0, z + 0.01, () => FRESCO.ochre));
    for (const s of [-1, 1]) out.stucco.push(tintGeometry(boxUV(new CylinderGeometry(0.05, 0.06, 1.0, lod ? 6 : 10, 1).translate(s * 0.5, FY + 1.4, z + 0.28)), () => 0.95));
    out.stucco.push(box(1.3, 0.1, 0.4, 0, FY + 1.9, z + 0.2, 0.95));
    out.stucco.push(gableTri(-0.68, 0.68, z + 0.4, 0.4, FY + 2.0, FY + 2.32));
    // A bronze lamp and offerings on its altar.
    out.bronze.push(box(0.16, 0.06, 0.08, 0.2, FY + 0.9, z + 0.25));
  }
  // A marble bench along the back portico.
  out.marble.push(slab(1.6, 0.07, 0.42, { bevel: 0.01, seed: seed + 60, wobble: 0, tone: 0, grime: 0 }).translate(2.7, FY + 0.4, zb + T + 0.32));
  for (const e of [-1, 1]) out.marble.push(slab(0.14, 0.4, 0.38, { bevel: 0.01, seed: seed + 61 + e, wobble: 0, tone: 0.03, grime: 0.2 }).translate(2.7 + e * 0.66, FY, zb + T + 0.32));
  return cols;
}

/** The household (lived in, close up): the governor and a client in the garden, the lady on her bench, servants. */
function household(m) {
  const list = [];
  const zb = P.back + T;
  list.push(...togate(m, -0.8, FY - 0.08, -2.5, Math.PI / 2 - 0.3, { praetexta: true, arms: 'orate', hair: 0x3a2a1c }));
  list.push(...togate(m, 0.8, FY - 0.08, -2.4, -Math.PI / 2 + 0.2, { arms: 'hold', hair: 0x6a6058 }));
  list.push(...matron(m, 2.55, FY, zb + 0.34, 0, { sit: 0.44, palla: 0x7a3a52 }));
  list.push(...servant(m, 3.6, FY, zb + 0.75, -0.5, { cloth: 0xb8a888, arms: 'hold' }));
  list.push(...servant(m, -3.0, FY - 0.08, -3.9, 0.6, { cloth: 0x8a7a5a, arms: 'reach' }));
  list.push(...servant(m, -4.9, FY, -1.5, 1.4, { cloth: 0xa89a7a }));
  return list;
}

/** Build the house: { group, meshes, triangles }; meshes tagged in userData.when. Its columns are not in it (government.js). */
export function buildPraetorium({ lod = 0, seed = 431 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['stucco', 'trav', 'cope', 'inner', 'fresco', 'tesserae', 'floor', 'pave', 'tile', 'wood', 'beam', 'stylobate', 'marble', 'bronze', 'dark',
    'pool', 'water', 'lawn', 'gravel', 'earth', 'leaf', 'flowers', 'pane'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  walls(lod, seed, out);
  atrium(lod, seed + 100, out);
  peristyle(lod, seed + 200, out);
  const m = govMaterials();
  const p = new TaggedParts('praetorium');
  const small = { cast: false };
  for (const [lx, ly, lz] of P.lamps) {
    out.wood.push(staff([lx, ly - 0.1, P.front], [lx, ly - 0.1, lz], 0.015, 4));
    if (lod < 2) {
      const l = lantern(lx, ly, lz, lod);
      out.bronze.push(...l.bronze);
      out.pane.push(l.pane);
    }
  }
  p.add('stucco', m.stucco, out.stucco);
  p.add('stone', m.trav, [...out.trav, ...out.cope]);
  p.add('inner', m.fresco, out.inner, small);
  p.add('fresco', m.fresco, out.fresco, small);
  p.add('tesserae', m.tesserae, out.tesserae, small);
  p.add('floor', m.shelteredFloor, out.floor, small);
  p.add('pave', m.trav, out.pave, small);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  p.add('beam', m.stucco, out.beam);
  p.add('stylobate', m.trav, out.stylobate, small);
  p.add('marble', m.marble, out.marble);
  p.add('bronze', m.bronze, out.bronze, small);
  p.add('inside', m.dark, out.dark, small);
  p.add('pool', m.marble, out.pool, small);
  p.add('water', m.shallow, out.water, small);
  p.add('lawn', m.lawn, out.lawn, small);
  p.add('gravel', m.gravel, out.gravel, small);
  p.add('earth', m.earth, out.earth, small);
  p.add('garden', m.leaf, out.leaf, { cast: lod === 0 });
  p.add('flowers', m.flowers, out.flowers, small);
  // The street door and the front windows' shutters: open while lived in, shut otherwise.
  const [dw, dh] = P.door;
  const dz = P.front - T / 2 + 0.04;
  const open = doubleDoor(0, dz, 2 * dw, dh, FY, { open: true, lod });
  const shut = doubleDoor(0, dz, 2 * dw, dh, FY, { open: false, lod });
  p.add('doors', m.wood, open.wood, { when: 'open' });
  p.add('doors', m.wood, shut.wood, { when: 'shut' });
  p.add('doors', m.wood, shut.wood.map((g) => g.clone()), { when: 'out' });
  if (lod < 2) {
    p.add('studs', m.bronze, open.bronze, { when: 'open', cast: false });
    p.add('studs', m.bronze, shut.bronze, { when: 'shut', cast: false });
    p.add('studs', m.bronze, shut.bronze.map((g) => g.clone()), { when: 'out', cast: false });
  }
  const sh = (o) => [-3.4, 3.4].flatMap((x) => shutters(x, P.front, 0.6, 0.65, 2.1, o, 1));
  p.add('shutters', m.wood, sh(true), { when: 'open', cast: false });
  p.add('shutters', m.wood, sh(false), { when: 'shut', cast: false });
  p.add('shutters', m.wood, sh(false), { when: 'out', cast: false });
  // The governor's standard by his door: flown while he is in residence.
  const st = standard(-1.75, 5.62, 0.06, 3.5, lod, { w: 0.6, hc: 0.66 });
  p.add('standard-pole', m.wood, st.wood, { when: 'staffed' });
  p.add('standard-gilt', m.gilt, st.gilt, { when: 'staffed', cast: false });
  p.add('standard', m.cloth, st.cloth, { when: 'staffed' });
  p.add('lamp', lanternPane(), out.pane, { when: 'staffed', cast: false });
  p.add('lamp', m.lampOut, out.pane.map((g) => g.clone()), { when: 'shut', cast: false });
  if (lod === 0) {
    addPeople(p, m, 'household', household(m), 'open');
    sentry(p, m, 'guard', 1.75, 0.06, P.front + 0.55, 0.15, 'staffed', { cloth: 0xa8322b, shield: [0.55, 0.12, 0.1] });
    sentry(p, m, 'guard-more', -3.3, 0.06, P.front + 0.5, -0.1, 'out', { cloth: 0xa8322b, shield: [0.55, 0.12, 0.1] });
    sentry(p, m, 'guard-more', 3.4, 0.06, P.front + 0.5, 0.1, 'out', { cloth: 0xa8322b, shield: [0.55, 0.12, 0.1] });
  }
  return p.build();
}

/** The house's colonnades for government.js: the atrium's four and the peristyle's. */
export const PRAETORIUM_COLONNADES = Object.freeze([
  Object.freeze({ order: 'pompeian', h: PRAETORIUM_COLS.atriumH, y: FY, at: PRAETORIUM_COLS.atrium }),
  Object.freeze({ order: 'pompeian', h: PRAETORIUM_COLS.periH, y: FY, at: columnsRound(P.peri.inner, 1.75) }),
]);

/** Its lamps for models.js modelLamps: the door's lanterns, facing the street. */
export const PRAETORIUM_LAMPS = Object.freeze(P.lamps.map(([x, y, z]) => Object.freeze([x, y + 0.1, z, 1])));
