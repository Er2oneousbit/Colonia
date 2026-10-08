/**
 * models/praetoriumMaius.js
 * ----------------------------------------------------------------------------
 * The governor's villa of the 3D look (the Praetorium Maius, 4 x 4, 16 m),
 * from the great houses of the record rather than the 2D sprite:
 *
 *   - The peristyle house: in the grandest houses of Pompeii and
 *     Herculaneum (the House of the Vettii, the House of the Faun's second
 *     peristyle, the House of the Stags) and in the commanders' houses of
 *     the legionary fortresses (the praetorium at Inchtuthil, at Xanten), a
 *     garden court surrounded by porticoes was the heart of the house. In
 *     the Vettii's: fourteen marble and bronze statues and statuettes round
 *     the garden, most of them fountains, water from the town's mains into
 *     marble basins, clipped box, flowers; red walls with painted panels
 *     under the porticoes.
 *   - The dining room (triclinium) opened on the garden, so that the
 *     diners on their three couches round the table looked out on it
 *     (Vitruvius VI.7 would have the summer triclinium face the north, and
 *     the garden); the House of the Vettii's and the Villa of the Mysteries'
 *     great rooms open so.
 *
 * So, in 16 m: the street front with a porch on two marble Ionic columns,
 * the governor's standard, lanterns and benches; inside, the great
 * peristyle (its columns stuccoed red and white, instanced:
 * models/government.js) round a garden: a long pool with a marble basin
 * in it whose jet plays, four marble statues, box-edged beds of flowers,
 * lemon trees in pots; at the back the triclinium under its own taller
 * gable and pediment, open on the garden between two marble columns, its
 * couches round the table toward the opening; rooms either side of it.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  lived in: the doors and shutters open, the fountain playing,
 *           the governor at dinner with two guests reclined on the couches,
 *           a piper playing to them, the lady and her daughter walking by
 *           the pool, a gardener at work; the guard at the door; lamps lit
 *   'shut'  no servants: shut up, the fountain still, nobody
 *   'out'   trouble near: doors and shutters shut, the household indoors,
 *           the fountain playing, three guards at the door and one on his
 *           round in the garden, the lamps lit
 * The people are actors (people/: praetoriumMaiusActors), moving on the GPU.
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { slab, TaggedParts } from './masonry.js';
import { staff } from './castra.js';

import {
  govMaterials, dressWall, box, D, lin, gable, slope, gableTri, rake, porch, standard, FRESCO, wallAlong, frescoFace, darkIn, doubleDoor, shutters, coping, slabs,
  court, column, columnsRound, statue, threshold, rectPool, labrum, jet, couch, boxEdging, bedPlants, flowerBed, gardenTree, lantern, lanternPane,
  guardActor, togateActor, servantActor, matronActor,
} from './domus.js';
import { DYES } from '../people/actors.js';
import { DINE } from '../people/clips.js';

/** The villa's measures (metres): the tests, the lab and the game read them. */
export const PRAETORIUM_MAIUS = Object.freeze({
  half: 8,
  floorY: 0.14,
  /** The outer walls' faces: the street front, the sides, the back; the back range's front (the peristyle's back wall). */
  front: 6.9,
  side: 7.88,
  back: -7.88,
  range: -4.2,
  /** The peristyle's ring: its walls' top, its eave, the garden's edge (the columns' line). */
  peri: Object.freeze({ top: 3.6, eave: 2.85, inner: Object.freeze([-5.6, 5.6, -2.4, 4.6]) }),
  /** The triclinium: its side walls' outer faces (|x|), its eave, the opening on the garden (half width, height). */
  tric: Object.freeze({ x: 2.6, eave: 4.3, open: Object.freeze([2.0, 3.45]) }),
  /**
   * The dining group in the triclinium, toward its opening on the garden:
   * the round table's middle (z) and radius, the couches' length; the
   * couches stand round it (DINING below), their tops at couch().
   */
  dine: Object.freeze({ z: -4.3, r: 0.5, len: 2.4 }),
  /** The pool in the garden (x, z, w, d) and the basin in it. */
  pool: Object.freeze([0, 1.25, 5.0, 2.1]),
  /** The street door: its half width and height. */
  door: Object.freeze([0.8, 2.8]),
  /** The lanterns either side of the door (x, y, z), facing the street. */
  lamps: Object.freeze([Object.freeze([-1.85, 2.35, 7.04]), Object.freeze([1.85, 2.35, 7.04])]),
});

const V = PRAETORIUM_MAIUS;
const FY = V.floorY;
const T = 0.3;
const BEAM = 0.3;
const XS = V.side;
const ZF = V.front;
const ZB = V.back;
const ZR = V.range;
const TX = V.tric.x;
/** A couch's top over its foot (domus.js couch: the coverlet's top). */
const COUCH_TOP = 0.69;
/** The lemon trees' pots (z), at the garden's front corners. */
const LEMON_Z = 3.6;
/** The couch's depth (domus.js couch). */
const COUCH_W = 0.95;
/**
 * The three couches round the table [x, z, ry]: across the back (the lectus
 * medius) and down either side, each a hand from the table so a diner on
 * his elbow reaches it (people/clips.js dine: his right hand to the table
 * 0.55 before him); their fronts toward it.
 */
const DINING = Object.freeze([
  Object.freeze([0, V.dine.z - V.dine.r - 0.45 - COUCH_W / 2, 0]),
  Object.freeze([-(0.975 + COUCH_W / 2), V.dine.z + 0.4, Math.PI / 2]),
  Object.freeze([0.975 + COUCH_W / 2, V.dine.z + 0.4, -Math.PI / 2]),
]);

/** The street front, the sides, the back, the porch, the pavement. */
function walls(lod, seed, out) {
  const top = V.peri.top;
  const [dw, dh] = V.door;
  const win = [[-4.4, 0.7], [4.4, 0.7]];
  const winY = [2.2, 2.95];
  const ops = [{ a: -dw, b: dw, lo: FY, hi: FY + dh }, ...win.map(([x, w]) => ({ a: x - w / 2, b: x + w / 2, lo: winY[0], hi: winY[1] }))];
  out.stucco.push(...wallAlong('x', -XS, XS, ZF - T / 2, T, 0, top, ops));
  for (const [x, w] of win) {
    out.dark.push(darkIn('x', x - w / 2, x + w / 2, winY[0], winY[1], ZF - T + 0.012, -1, 0.06));
    out.trav.push(box(w + 0.14, 0.06, 0.1, x, winY[0] - 0.06, ZF + 0.04, 0.95));
  }
  // The sides run the whole depth; the back.
  for (const s of [-1, 1]) {
    out.stucco.push(...wallAlong('z', ZB, ZF, s * (XS - T / 2), T, 0, top, [{ a: -6.3, b: -5.6, lo: winY[0], hi: winY[1] }]));
    out.dark.push(darkIn('z', -6.3, -5.6, winY[0], winY[1], s * (XS - T), -s));
  }
  out.stucco.push(box(2 * XS, top, T, 0, 0, ZB + T / 2));
  // The socle, the painted dado, the copings along the peristyle's walls.
  out.trav.push(box(2 * XS + 0.04, 0.45, 0.04, 0, 0, ZF + 0.02, 0.9));
  out.trav.push(box(2 * XS + 0.04, 0.45, 0.04, 0, 0, ZB - 0.02, 0.9));
  for (const s of [-1, 1]) out.trav.push(box(0.04, 0.45, ZF - ZB + 0.04, s * (XS + 0.02), 0, (ZF + ZB) / 2, 0.9));
  for (const [a, b] of [[-XS, -dw - 0.26], [dw + 0.26, XS]]) out.stucco.push(box(b - a, 0.55, 0.012, (a + b) / 2, 0.45, ZF + 0.006, () => FRESCO.dado));
  for (const s of [-1, 1]) out.stucco.push(box(0.012, 0.55, ZF - ZB, s * (XS + 0.006), 0.45, (ZF + ZB) / 2, () => FRESCO.dado));
  for (const s of [-1, 1]) dressWall('z', ZB + 0.3, ZF - 0.3, s * XS, s, { y0: 0.45, top, step: 2.3, win: [2.15, 2.8], lod, out, skip: [[-6.45, -5.45]] });
  dressWall('x', -XS + 0.3, XS - 0.3, ZB, -1, { y0: 0.45, top, step: 2.6, win: [2.15, 2.8], lod, out });
  if (lod < 2) {
    out.cope.push(...coping('x', -XS, XS, ZF - T / 2, T, top));
    for (const s of [-1, 1]) out.cope.push(...coping('z', ZR, ZF, s * (XS - T / 2), T, top));
  }
  // The door's frame and the porch on two marble Ionic columns.
  for (const s of [-1, 1]) out.trav.push(box(0.26, dh + 0.25, 0.12, s * (dw + 0.13), 0, ZF + 0.06, 0.95));
  out.trav.push(slab(2 * dw, FY, 0.4, { bevel: 0.01, seed, wobble: 0, tone: 0, grime: 0.3 }).translate(0, 0, ZF - 0.1));
  porch({ half: 1.2, zf: ZF, depth: 0.92, h: 2.75, lod, seed: seed + 30, out, order: 'ionic', stone: 'marble' });
  out.tesserae.push(...threshold('SALVE', 0, FY, ZF - 0.75, 1.5, 0.62, lod));
  // The pavement, its kerb, the clients' benches.
  out.pave.push(box(2 * XS + 0.1, 0.06, 7.96 - ZF, 0, 0, (7.96 + ZF) / 2, 0.92));
  out.trav.push(box(2 * XS + 0.1, 0.12, 0.16, 0, 0, 7.88, 0.85));
  for (const s of [-1, 1]) {
    out.trav.push(slab(1.7, 0.08, 0.38, { bevel: 0.01, seed: seed + 5 + s, wobble: 0, tone: 0, grime: 0.1 }).translate(s * 2.9, 0.36, ZF + 0.21));
    out.stucco.push(box(1.64, 0.36, 0.34, s * 2.9, 0, ZF + 0.19, 0.85));
  }
}

/** The peristyle: its ring of roof (the back side split either side of the triclinium), the paintings, the rooms' doors. */
function peristyle(lod, seed, out) {
  const { top, eave, inner } = V.peri;
  const [a0, a1, b0, b1] = inner;
  court({ outer: [-XS, XS, ZR, ZF], inner, topY: top, eaveY: eave, floorY: FY, step: 2.0, lod, seed, out, beamH: BEAM, skip: 'b', holes: [[-TX, TX, ZR, b0]] });
  // The back portico in two pieces either side of the triclinium, which opens on the garden between them.
  const E = (x, z) => [x, eave, z];
  const Tp = (x, z) => [x, top, z];
  for (const q of [[E(-TX, b0), E(a0, b0), Tp(-XS, ZR), Tp(-TX, ZR)], [E(a1, b0), E(TX, b0), Tp(TX, ZR), Tp(XS, ZR)]]) {
    const r = slope(q, { lod, seed: seed + 9 });
    out.tile.push(...r.tile);
    out.wood.push(...r.wood);
  }
  for (const s of [-1, 1]) out.beam.push(box(Math.abs(a0) - TX + 0.13, BEAM, 0.26, s * (TX + (Math.abs(a0) - TX) / 2 + 0.065), eave - BEAM, b0, 0.95));
  // The walls round the porticoes, painted; doors into the rooms beyond, dark.
  const fy = top - 0.3;
  const doorsAt = (zs) => zs.map((z) => [z - 0.45, z + 0.45]);
  for (const s of [-1, 1]) {
    const gaps = doorsAt([-0.8, 2.8]);
    out.fresco.push(...frescoFace('z', ZR + T, ZF - T, s * (XS - T), -s, FY, fy, { gaps, lod, main: FRESCO.red, frame: FRESCO.ochre, panel: 1.5 }));
    for (const [g0, g1] of gaps) out.dark.push(box(0.03, 2.2, g1 - g0, s * (XS - T - 0.015), FY, (g0 + g1) / 2));
  }
  const fGaps = [[-0.8, 0.8], [-3.6, -2.7], [2.7, 3.6]];
  out.fresco.push(...frescoFace('x', -XS + T, XS - T, ZF - T, -1, FY, fy, { gaps: fGaps, lod, main: FRESCO.black, frame: FRESCO.red, panel: 1.4 }));
  for (const [g0, g1] of fGaps.slice(1)) out.dark.push(box(g1 - g0, 2.2, 0.03, (g0 + g1) / 2, FY, ZF - T - 0.015));
  // The back range's wall on the portico: doors into its rooms, painted between.
  const bGaps = [[-6.0, -5.1], [-4.0, -3.1], [3.1, 4.0], [5.1, 6.0]];
  for (const s of [-1, 1]) {
    const own = bGaps.filter(([g0]) => Math.sign(g0) === s);
    const [x0, x1] = s < 0 ? [-XS + T, -TX] : [TX, XS - T];
    out.stucco.push(...wallAlong('x', x0, x1, ZR + T / 2, T, 0, top, own.map(([g0, g1]) => ({ a: g0, b: g1, lo: FY, hi: FY + 2.2 }))));
    for (const [g0, g1] of own) out.dark.push(darkIn('x', g0, g1, FY, FY + 2.2, ZR, -1));
    out.fresco.push(...frescoFace('x', x0, x1, ZR + T, 1, FY, fy, { gaps: own, lod, main: FRESCO.red, frame: FRESCO.ochre, panel: 1.3 }));
  }
}

/** The rooms across the back either side of the triclinium: two tiled gables along x, their ends' gable walls. */
function backRange(lod, seed, out) {
  const top = V.peri.top;
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [-XS, -TX] : [TX, XS];
    const r = gable({ x0, x1, z0: ZB, z1: ZR, eaveY: top, pitch: D(18), along: 'x', over: 0.06, gableOver: 0.0, lod, seed: seed + s });
    out.tile.push(...r.tile);
    out.wood.push(...r.wood);
    const g = gableTri(ZB + 0.02, ZR - 0.02, T / 2, T, top, r.ridgeY - 0.03);
    // (A quarter turn the way that takes its span (x) onto z as it is: -z would put it at the front.)
    g.rotateY(-Math.PI / 2);
    g.translate(s * (XS - T / 2), 0, 0);
    out.stucco.push(g);
  }
  out.floor.push(...slabs([[-XS + T, -TX, ZB + T, ZR], [TX, XS - T, ZB + T, ZR]], 0, FY, 0.9));
}

/** The triclinium: its walls and paintings, the opening on the garden with two marble columns, the gable and pediment, couches and table. */
function triclinium(lod, seed, out) {
  const { eave, open: [ow, oh] } = V.tric;
  const zf = V.peri.inner[2];
  // The side walls and the antae at the front; the lintel over the opening.
  for (const s of [-1, 1]) {
    out.stucco.push(box(T, eave, zf - ZB - T, s * (TX - T / 2), 0, (zf + ZB + T) / 2));
    out.stucco.push(box(TX - T - ow, eave, T, s * (ow + (TX - T - ow) / 2), 0, zf - T / 2));
  }
  out.stucco.push(box(2 * ow, eave - FY - oh, T, 0, FY + oh, zf - T / 2));
  out.marble.push(box(2 * TX + 0.1, 0.28, 0.42, 0, eave - 0.28, zf - 0.15, 0.97));
  // Inside, painted: a black dado, red panels framed in ochre, a white frieze.
  const fy = eave - 0.35;
  out.fresco.push(...frescoFace('x', -TX + T, TX - T, ZB + T, 1, FY, fy, { lod, main: FRESCO.red, frame: FRESCO.ochre, panel: 1.3 }));
  for (const s of [-1, 1]) out.fresco.push(...frescoFace('z', ZB + T, zf - T, s * (TX - T), -s, FY, fy, { lod, main: FRESCO.red, frame: FRESCO.ochre, panel: 1.3 }));
  // Its floor: a mosaic of black and white, a border round a field of squares (close up).
  out.tesserae.push(box(2 * (TX - T), FY, zf - ZB - T, 0, 0, (zf + ZB + T) / 2, () => FRESCO.white));
  if (lod < 2) {
    const x0 = -TX + T + 0.25;
    const x1 = TX - T - 0.25;
    const z0 = ZB + T + 0.25;
    const z1 = zf - 0.35;
    for (const [a, b, c, d] of [[x0, x1, z0, z0 + 0.12], [x0, x1, z1 - 0.12, z1], [x0, x0 + 0.12, z0, z1], [x1 - 0.12, x1, z0, z1]]) out.tesserae.push(box(b - a, 0.006, d - c, (a + b) / 2, FY, (c + d) / 2, () => FRESCO.black));
    if (lod === 0) {
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 8; j++) {
          if ((i + j) % 2) continue;
          out.tesserae.push(box(0.26, 0.004, 0.26, x0 + 0.42 + i * 0.52, FY, z0 + 0.42 + j * 0.5, () => FRESCO.black));
        }
      }
    }
  }
  // Two marble Ionic columns in the opening.
  for (const s of [-1, 1]) {
    const c = column('ionic', oh, lod);
    for (const g of [...c.stone, ...c.cap]) out.marble.push(g.translate(s * 0.72, FY, zf - 0.15));
  }
  // The roof: a taller gable along the room, its pediment over the opening, raking cornices, acroteria.
  const r = gable({ x0: -TX, x1: TX, z0: ZB, z1: zf, eaveY: eave + 0.02, pitch: D(23), along: 'z', over: 0.22, gableOver: 0.05, lod, seed: seed + 3 });
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  out.stucco.push(gableTri(-TX + 0.02, TX - 0.02, zf - 0.02, T - 0.04, eave, r.ridgeY - 0.03));
  out.stucco.push(gableTri(-TX + 0.02, TX - 0.02, ZB + T, T, eave, r.ridgeY - 0.03));
  for (const s of [-1, 1]) out.marble.push(rake(s * (TX + 0.12), eave - 0.03, 0, r.ridgeY + 0.04, zf + 0.06, 0.2, 0.14));
  if (lod < 2) {
    out.gilt.push(tintGeometry(boxUV(new CylinderGeometry(0.0, 0.16, 0.42, lod ? 5 : 8, 1).translate(0, r.ridgeY + 0.3, zf + 0.06))));
    for (const s of [-1, 1]) out.gilt.push(tintGeometry(boxUV(new CylinderGeometry(0.0, 0.11, 0.3, lod ? 5 : 8, 1).translate(s * (TX + 0.05), eave + 0.15, zf + 0.06))));
  }
  // Three couches round the table: across the back and down either side, coverlets of purple and saffron.
  const cY = FY;
  for (const [k, [x, z, ry]] of DINING.entries()) {
    const c = couch(x, z, cY, ry, V.dine.len, lod, lin(k ? 0xb07a20 : 0x6e1a3c));
    out.inWood.push(...c.wood);
    out.cloth.push(...c.cloth);
  }
  // The table, its top a little over the couches' (the diners reach down to it from their elbows).
  const tz = V.dine.z;
  const tY = cY + COUCH_TOP + 0.07;
  out.inMarble.push(tintGeometry(boxUV(new CylinderGeometry(V.dine.r, V.dine.r, 0.05, lod ? 10 : 20, 1).translate(0, tY - 0.025, tz)), () => 0.95));
  out.inMarble.push(tintGeometry(boxUV(new CylinderGeometry(0.07, 0.14, tY - 0.05 - cY, lod ? 6 : 10, 1).translate(0, cY + (tY - 0.05 - cY) / 2, tz)), () => 0.9));
  if (lod === 0) {
    // Dishes and a jug on the table.
    for (const [x, z] of [[-0.18, -0.12], [0.2, 0.08], [0.0, 0.26]]) out.silver.push(tintGeometry(boxUV(new CylinderGeometry(0.1, 0.07, 0.03, 10, 1).translate(x, tY + 0.015, tz + z))));
    out.silver.push(tintGeometry(boxUV(new CylinderGeometry(0.04, 0.06, 0.2, 8, 1).translate(0.15, tY + 0.1, tz - 0.25))));
  }
}

/** The garden: lawn, walks, the pool and its playing basin, statues, beds of flowers, lemons in pots. */
function garden(lod, seed, out) {
  const [a0, a1, b0, b1] = V.peri.inner;
  const g = [a0 + 0.21, a1 - 0.21, b0 + 0.21, b1 - 0.21];
  const gy = FY - 0.1;
  out.lawn.push(box(g[1] - g[0], gy, g[3] - g[2], 0, 0, (g[2] + g[3]) / 2, 0.95));
  // Gravel walks round the pool and down the middle to the triclinium.
  const [px, pz, pw, pd] = V.pool;
  out.gravel.push(box(pw + 1.4, 0.02, pd + 1.4, px, gy, pz, 0.95));
  out.gravel.push(box(1.2, 0.02, pz - pd / 2 - 0.7 - g[2], 0, gy, (g[2] + pz - pd / 2 - 0.7) / 2, 0.95));
  out.gravel.push(box(1.2, 0.02, g[3] - pz - pd / 2 - 0.7, 0, gy, (g[3] + pz + pd / 2 + 0.7) / 2, 0.95));
  const pool = rectPool(px, pz, pw, pd, gy + 0.02, 0.36, { lod, seed });
  out.marble.push(...pool.kerb);
  out.poolFloor.push(...pool.floor);
  out.pool.push(...pool.water);
  // The basin in the pool's middle, its jet playing.
  const lb = labrum(px, pz, pool.y - 0.3, pool.y + 0.62, 0.62, lod);
  out.marble.push(...lb.marble);
  out.water.push(...lb.water);
  const j = jet(px, lb.y + 0.06, pz, 0.5, lb.y, lod, { n: lod ? 2 : 4, spread: 0.16 });
  out.jet.push(...j.stream);
  out.rings.push(...j.rings);
  if (lod < 2) out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.02, 0.035, 0.1, 8, 1).translate(px, lb.y + 0.02, pz))));
  // Four marble statues: two facing the pool from either end, two before the triclinium.
  const st = [
    [-(pw / 2 + 1.05), pz, Math.PI / 2, 'draped'], [pw / 2 + 1.05, pz, -Math.PI / 2, 'nude'],
    [-4.35, -1.3, 0.35, 'nude'], [4.35, -1.3, -0.35, 'draped'],
  ];
  for (const [x, z, ry, kind] of st) {
    const s = statue(x, z, ry, { y0: gy, h: 1.0, kind, lod, base: 0.7, scale: 0.9 });
    out.marble.push(...s.base, ...s.statue);
  }
  // Beds of flowers edged in box, along the front and either side of the walk to the triclinium.
  const beds = [[-4.7, -1.1, 3.1, 4.05], [1.1, 4.7, 3.1, 4.05], [-3.5, -1.0, -1.85, -0.5], [1.0, 3.5, -1.85, -0.5]];
  beds.forEach(([x0, x1, z0, z1], k) => {
    out.leaf.push(...boxEdging(x0, x1, z0, z1, gy, 0.3, lod, seed + 20 + k));
    out.earth.push(box(x1 - x0 - 0.44, 0.04, z1 - z0 - 0.44, (x0 + x1) / 2, gy, (z0 + z1) / 2, 0.8));
    out.leaf.push(...bedPlants(x0 + 0.45, x1 - 0.45, (z0 + z1) / 2 - 0.05, (z0 + z1) / 2 + 0.05, gy, seed + 30 + k, lod));
    out.flowers.push(...flowerBed(x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 0.3, gy, seed + 40 + k, lod, 12));
  });
  // Lemon trees in terracotta pots at the front corners of the garden.
  for (const s of [-1, 1]) {
    const x = s * 4.95;
    const z = LEMON_Z;
    out.clay.push(tintGeometry(boxUV(new CylinderGeometry(0.3, 0.22, 0.5, lod ? 8 : 14, 1).translate(x, gy + 0.25, z)), () => 0.9));
    // (Kept low, the crown's foot at the height a gardener's shears work: people/clips.js prune.)
    const t = gardenTree(x, gy + 0.45, z, 1.4, lod, seed + 50 + s);
    out.wood.push(...t.wood);
    out.leaf.push(...t.leaf);
    if (lod === 0) {
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + s;
        out.flowers.push(box(0.07, 0.07, 0.07, x + Math.cos(a) * 0.38, gy + 1.3 + (k % 3) * 0.11, z + Math.sin(a) * 0.38, () => lin(0xe8c030)));
      }
    }
  }
}

/**
 * The villa's people (people/actors.js specs, its metres), by state. Lived
 * in ('open'): the governor at dinner on the middle couch in the toga
 * praetexta, a guest on each side couch, all reclined on the left elbow as
 * Romans dined (the dine clip), a slave standing by the table with a dish,
 * a girl playing the double pipes for them at the room's opening; in the
 * garden the lady of the house and her daughter walking the length of the
 * pool together, a gardener trimming a lemon tree; the guard at the door.
 * Trouble near ('out'): the household indoors, three soldiers at the door,
 * another walking his round past the pool. Nobody in a villa shut up.
 */
export function praetoriumMaiusActors(state) {
  if (state === 'shut') return [];
  const door = guardActor([1.55, 0.06, ZF + 0.55], 0.15, 601);
  const gy = FY - 0.08;
  const walk = { length: 4.4, speed: 0.55, pauseEnd: 5, pauseStart: 5, faceEnd: Math.PI, faceStart: Math.PI };
  if (state === 'out') {
    return [
      door, guardActor([-1.55, 0.06, ZF + 0.55], -0.15, 602), guardActor([4.4, 0.06, ZF + 0.55], 0.1, 603),
      guardActor([-2.8, gy, 2.75], Math.PI / 2, 604, { clip: 'patrol', route: { ...walk, speed: 0.9, pauseEnd: 3, pauseStart: 3, clipEnd: 'guard', clipStart: 'guard' } }),
    ];
  }
  // A diner stands his feet DINE.top under the couch's top, at its front edge where his hips lie, facing the table.
  const dy = FY + COUCH_TOP - DINE.top;
  const front = ([x, z, ry], along) => [x + Math.sin(ry) * COUCH_W / 2 + Math.cos(ry) * along, dy, z + Math.cos(ry) * COUCH_W / 2 - Math.sin(ry) * along];
  const [mid, left, right] = DINING;
  const tz = V.dine.z;
  return [
    door,
    togateActor(front(mid, -0.2), mid[2], 606, { praetexta: true, clip: 'dine', props: { L: 'cup' } }),
    togateActor(front(left, 0.35), left[2], 607, { clip: 'dine', props: { L: 'cup' } }),
    togateActor(front(right, -0.4), right[2], 608, { clip: 'dine', props: { L: 'cup' } }),
    servantActor([0.25, FY, tz + V.dine.r + 0.42], Math.PI, 609, { clip: 'hold', props: { R: 'patera' } }),
    // The piper at the room's opening, playing to the diners.
    { body: 'f', dress: ['tunic:long'], hair: 'bun', clip: 'flute', props: { R: 'tibiae' }, at: [-1.3, FY - 0.1, V.peri.inner[2] + 0.35], ry: Math.PI + 0.25, seed: 610, colours: { tunic: DYES.saffron } },
    // The lady and her daughter walking the pool's length together (in step: `sync`).
    matronActor([-2.8, gy, 2.95], Math.PI / 2, 611, { clip: 'walk', sync: true, route: { ...walk, clipEnd: 'talk', clipStart: 'idle' }, colours: { tunic: DYES.white, mantle: DYES.woad, trim: DYES.oxblood } }),
    { body: 'c', dress: ['tunic:long'], hair: 'bun', clip: 'walk', sync: true, at: [-2.8, gy, 2.52], ry: Math.PI / 2, seed: 612, route: { ...walk, speed: walk.speed / 0.78, length: walk.length / 0.78, clipEnd: 'listen', clipStart: 'idle' }, colours: { tunic: DYES.rose } },
    // The gardener at a lemon tree in its pot.
    servantActor([4.95, FY - 0.1, LEMON_Z - 0.82], 0, 613, { clip: 'prune', props: { R: 'shears' } }),
  ];
}

/** Build the villa: { group, meshes, triangles }; meshes tagged in userData.when. Its peristyle's columns are not in it (government.js). */
export function buildPraetoriumMaius({ lod = 0, seed = 461 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['stucco', 'trav', 'cope', 'fresco', 'tesserae', 'floor', 'pave', 'tile', 'wood', 'beam', 'stylobate', 'marble', 'bronze', 'gilt', 'silver', 'inWood', 'inMarble', 'dark',
    'poolFloor', 'pool', 'water', 'jet', 'rings', 'lawn', 'gravel', 'earth', 'leaf', 'flowers', 'clay', 'cloth', 'pane'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  walls(lod, seed, out);
  peristyle(lod, seed + 100, out);
  backRange(lod, seed + 200, out);
  triclinium(lod, seed + 300, out);
  garden(lod, seed + 400, out);
  for (const [lx, ly, lz] of V.lamps) {
    out.wood.push(staff([lx, ly - 0.1, ZF], [lx, ly - 0.1, lz], 0.015, 4));
    if (lod < 2) {
      const l = lantern(lx, ly, lz, lod);
      out.bronze.push(...l.bronze);
      out.pane.push(l.pane);
    }
  }
  const m = govMaterials();
  const p = new TaggedParts('praetorium-maius');
  const small = { cast: false };
  if (lod === 2) out.silver = [];
  p.add('stucco', m.stucco, out.stucco);
  p.add('stone', m.trav, [...out.trav, ...out.cope]);
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
  p.add('gilt', m.gilt, out.gilt, small);
  p.add('silver', m.shelteredSilver, out.silver, small);
  p.add('cushions', m.shelteredCloth, out.cloth, small);
  // The triclinium's furniture under its roof: no snow on it.
  p.add('furniture', m.shelteredWood, out.inWood, small);
  p.add('table', m.shelteredMarble, out.inMarble, small);
  p.add('inside', m.dark, out.dark, small);
  p.add('pool-floor', m.marble, out.poolFloor, small);
  p.add('pool', m.water, out.pool, small);
  p.add('water', m.shallow, out.water, small);
  p.add('jet', m.stream, out.jet, { when: 'staffed', cast: false });
  p.add('rings', m.ring, out.rings, { when: 'staffed', cast: false });
  p.add('lawn', m.lawn, out.lawn, small);
  p.add('gravel', m.gravel, out.gravel, small);
  p.add('earth', m.earth, out.earth, small);
  p.add('garden', m.leaf, out.leaf, { cast: lod === 0 });
  p.add('flowers', m.flowers, out.flowers, small);
  p.add('pots', m.clay, out.clay, small);
  const [dw, dh] = V.door;
  const dz = ZF - T / 2 + 0.04;
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
  const sh = (o) => [-4.4, 4.4].flatMap((x) => shutters(x, ZF, 0.7, 0.75, 2.2, o, 1));
  p.add('shutters', m.wood, sh(true), { when: 'open', cast: false });
  p.add('shutters', m.wood, sh(false), { when: 'shut', cast: false });
  p.add('shutters', m.wood, sh(false), { when: 'out', cast: false });
  // The governor's standards either side of the porch, flown while he is in residence.
  for (const s of [-1, 1]) {
    const st = standard(s * 2.0, ZF + 0.72, 0.06, 3.7, lod, { w: 0.62, hc: 0.7 });
    p.add('standard-pole', m.wood, st.wood, { when: 'staffed' });
    p.add('standard-gilt', m.gilt, st.gilt, { when: 'staffed', cast: false });
    p.add('standard', m.cloth, st.cloth, { when: 'staffed' });
  }
  p.add('lamp', lanternPane(), out.pane, { when: 'staffed', cast: false });
  p.add('lamp', m.lampOut, out.pane.map((g) => g.clone()), { when: 'shut', cast: false });
  // (The household, the diners and the guard are actors: praetoriumMaiusActors.)
  return p.build();
}

/** The peristyle's columns for government.js: round the garden, none across the triclinium's opening. */
export const PRAETORIUM_MAIUS_COLONNADES = Object.freeze([
  Object.freeze({
    order: 'pompeian',
    h: V.peri.eave - BEAM - FY,
    y: FY,
    at: Object.freeze(columnsRound(V.peri.inner, 2.0).filter(([x, z]) => !(Math.abs(z - V.peri.inner[2]) < 1e-6 && Math.abs(x) < TX + 0.3))
      .concat([[-TX - 0.15, V.peri.inner[2]], [TX + 0.15, V.peri.inner[2]]])),
  }),
]);

/** Its lamps for models.js modelLamps: the door's lanterns, facing the street. */
export const PRAETORIUM_MAIUS_LAMPS = Object.freeze(V.lamps.map(([x, y, z]) => Object.freeze([x, y + 0.1, z, 1])));
