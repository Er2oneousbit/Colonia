/**
 * models/regia.js
 * ----------------------------------------------------------------------------
 * The governor's palace of the 3D look (the Regia, 5 x 5, 20 m), the city's
 * most splendid building, from the palaces of the record rather than the 2D
 * sprite:
 *
 *   - The palaces Rome's governors took over or built: Herod's palace on
 *     the promontory at Caesarea, the praetorium of Judaea's prefects
 *     (where Pilate lived), its rooms round a great court with a pool;
 *     the governor's praetorium at Cologne by the Rhine, a long front of
 *     porticoes and a great hall; the palace at Fishbourne (a client king's,
 *     about AD 75): four wings round a formal garden of clipped hedges,
 *     an entrance hall on the axis and, across the garden from it, the
 *     audience chamber up a flight of steps; mosaics and painted walls
 *     throughout. The emperors' own palace on the Palatine (the Domus
 *     Flavia) set its throne room (the aula regia) behind a porch at the
 *     head of a court with fountains.
 *   - A governor of an imperial province was the emperor's legate,
 *     legatus Augusti pro praetore (LEGATVS AVG PR PR on his monuments);
 *     his house was the seat of his court and the province's government,
 *     guarded by soldiers seconded from the legions, his lictors at his door.
 *
 * So, in 20 m: the whole raised on a platform of travertine; up a flight of
 * steps between gilt statues and the governor's standards, a propylon of
 * four Corinthian columns under a pediment cut REGIA; a court open to the
 * street over a marble parapet, porticoes of marble Ionic columns down
 * either side (instanced: models/government.js) and across the back, a
 * garden of clipped box, lawns and cypresses round two fountains whose
 * basins play, marble statues along the walk; across the court the hall
 * (aula) up three steps behind a porch of six Corinthian columns with gilt
 * capitals, LEGATVS AVG PR PR on its frieze, a gilt eagle on its gable, its
 * ridge gilded; the governor's private wings of two storeys either side.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  lived in: the doors open, the fountains playing, the governor
 *           addressing the court from the hall's steps, his officers by
 *           him, petitioners below, his lictors at the gate, the household
 *           at work in the garden; guards at the propylon; lamps lit
 *   'shut'  no servants: shut up, the fountains still, nobody
 *   'out'   trouble near: the doors shut, the household gone in, soldiers
 *           lining the steps and the gate, one on his round down the walk,
 *           the fountains playing, lamps lit
 * The people are actors (people/: regiaActors), moving on the GPU.
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry, TorusGeometry, Shape, ExtrudeGeometry } from 'three';
import { boxUV, tintGeometry, frameSweep } from '../shapes.js';
import { slab, paving, TaggedParts } from './masonry.js';
import { aquila } from './castra.js';
import { cypress } from './learning.js';
import {
  govMaterials, dressWall, box, D, gable, slope, gableTri, rake, standard, FRESCO, wallAlong, frescoFace, darkIn, doubleDoor, coping, ridgeCap, court, column, statue, roundPool, labrum, jet, boxEdging, bedPlants, flowerBed, letters, lantern, lanternPane, guardActor, togateActor, servantActor, matronActor,
} from './domus.js';
import { DYES } from '../people/actors.js';

/** The palace's measures (metres): the tests, the lab and the game read them. */
export const REGIA = Object.freeze({
  half: 10,
  /** The platform's top (the floor of the court's porticoes, the hall's foot), its front edge. */
  floorY: 0.9,
  platFront: 8.1,
  /** The outer walls' faces: the sides, the back; the parapet's line along the street; the back range's front. */
  side: 9.6,
  back: -9.6,
  parapet: 7.6,
  range: -3.6,
  /** The court's ring (sides and back): its walls' top, its eave, the court's edge (the columns' line). */
  ring: Object.freeze({ top: 4.75, eave: 4.0, inner: Object.freeze([-7.2, 7.2, -1.6, 7.6]) }),
  /** The hall: its side walls' outer faces (|x|), its eave; its porch's columns (z, x, height) on a stylobate. */
  hall: Object.freeze({ x: 5.4, eave: 6.5, colZ: -1.95, cols: Object.freeze([-4.6, -2.75, -0.92, 0.92, 2.75, 4.6]), colH: 4.4, step: 0.45 }),
  /** The propylon: its columns' line (z), x, height. */
  gate: Object.freeze({ z: 7.85, cols: Object.freeze([-2.2, -0.85, 0.85, 2.2]), h: 4.1 }),
  /** The two fountains (x, z), their pools' radius. */
  fountains: Object.freeze([Object.freeze([-2.4, 1.9]), Object.freeze([2.4, 1.9])]),
  poolR: 1.25,
  /** The lampstands' lanterns (x, y, z), facing the street: at the head of the steps, and on the hall's porch either side of its door. */
  lamps: Object.freeze([Object.freeze([-3.3, 2.55, 7.95]), Object.freeze([3.3, 2.55, 7.95]), Object.freeze([-1.85, 3.0, -1.45]), Object.freeze([1.85, 3.0, -1.45])]),
});

const R = REGIA;
const PY = R.floorY;
const T = 0.3;
const BEAM = 0.32;
const XS = R.side;
const ZB = R.back;
const ZP = R.parapet;
const ZR = R.range;
const HX = R.hall.x;
const HY = PY + R.hall.step;
/** The porticoes' floor, a step up from the garden on the platform. */
const FL = PY + 0.12;

/** A prism: the polygon `pts` ([x, y] pairs) in the x-y plane, from z back to z - t. */
function prism(pts, z, t) {
  const s = new Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  g.translate(0, 0, z - t);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return tintGeometry(boxUV(g));
}

/** The platform with its mouldings, the steps and the forecourt with its statues, standards and cypresses. */
function platform(lod, seed, out) {
  const front = R.platFront;
  const hz = (front - ZB) / 2;
  const cz = (front + ZB) / 2;
  const prof = [[0.14, 0], [0.14, 0.14], [0.06, 0.2], [0, 0.26], [0, PY - 0.16], [0.06, PY - 0.12], [0.12, PY - 0.06], [0.12, PY], [-Math.min(XS, hz), PY]];
  // (A little inside the footprint: the moulding's foot stands 14 cm proud.)
  const g = frameSweep(prof, XS + 0.24, hz - 0.2, { tint: (p) => (p.y < 0.26 ? 0.82 : 0.95) });
  g.translate(0, 0, cz - 0.2 + 0.2);
  out.trav.push(g);
  // The steps up to the gate.
  const n = 5;
  const rise = PY / n;
  const tread = 0.36;
  const sw = 2.6;
  for (let k = 0; k < n; k++) {
    const z0 = front + (n - k - 1) * tread;
    out.trav.push(slab(2 * sw, (k + 1) * rise, z0 + tread - front + 0.02, { bevel: 0.012, seed: seed + k, wobble: lod ? 0 : 0.002, tone: 0.03, grime: 0.25 }).translate(0, 0, (front - 0.02 + z0 + tread) / 2));
  }
  // The forecourt: flags to the street, a kerb.
  const H = R.half - 0.06;
  out.pave.push(...paving(-H, H, front + 0.1, H, 0.06, seed + 30, { rowW: 0.9, minL: 0.8, maxL: 1.4, lod, skip: (x) => Math.abs(x) < sw + 0.05, tone: 0.05, grime: 0.12 }));
  out.trav.push(box(2 * H, 0.1, 0.16, 0, 0, H - 0.08, 0.88));
  // Gilt statues on tall pedestals either side of the steps: the emperor and his heir, as the province honoured them.
  for (const s of [-1, 1]) {
    const st = statue(s * 3.35, 9.15, -s * 0.2, { y0: 0.06, h: 1.4, kind: 'togate', lod, base: 0.9, scale: 1.12 });
    out.trav.push(...st.base);
    out.giltStatue.push(...st.statue);
  }
  // Cypresses at the platform's front corners.
  for (const s of [-1, 1]) {
    const c = cypress(s * 8.6, 9.1, 4.6, { lod, seed: seed + 50 + s });
    out.leaf.push(...c.leaf);
    out.wood.push(...c.wood);
  }
}

/** The parapet along the street either side of the gate, and the propylon: four Corinthian columns, the pediment cut REGIA. */
function front(lod, seed, out) {
  const { z: gz, cols, h } = R.gate;
  const gx = 2.75;
  // The parapet: a low wall with a marble coping and pilasters, from the court's side walls to the gate.
  for (const s of [-1, 1]) {
    const [a, b] = s < 0 ? [-XS + T, -gx] : [gx, XS - T];
    out.stucco.push(box(b - a, 1.05, 0.34, (a + b) / 2, PY, ZP, 0.95));
    out.marble.push(box(b - a + 0.04, 0.1, 0.44, (a + b) / 2, PY + 1.05, ZP, 0.97));
    if (lod < 2) for (let x = a + 0.9; x < b - 0.4; x += 1.6) out.marble.push(box(0.3, 1.18, 0.42, x, PY, ZP, 0.95));
  }
  // The gate's floor runs out to the head of the steps; its two side walls (antae) to the court.
  out.marble.push(box(2 * gx, 0.04, R.platFront - ZP + 0.3, 0, PY, (R.platFront + ZP - 0.3) / 2, 0.96));
  for (const s of [-1, 1]) out.stucco.push(box(0.4, h, 1.0, s * gx, PY, ZP - 0.2, 0.96));
  // The entablature on the columns (architrave, frieze cut REGIA, cornice), returning to the antae.
  const top = PY + h;
  const bands = lod === 2 ? [[0, 1.0, 0.56]] : [[0, 0.32, 0.54], [0.32, 0.4, 0.58], [0.72, 0.12, 0.7], [0.84, 0.14, 0.82]];
  for (const [y, hh, d] of bands) {
    out.marble.push(box(2 * gx + 0.4, hh, d, 0, top + y, gz, 0.96));
    for (const s of [-1, 1]) out.marble.push(box(d * 0.8, hh, gz - ZP + 0.2, s * gx, top + y, (gz + ZP - 0.2) / 2, 0.95));
  }
  if (lod === 0) out.letters.push(...letters('REGIA', top + 0.38, gz + 0.295, 0.28));
  else if (lod === 1) out.letters.push(box(1.7, 0.26, 0.006, 0, top + 0.39, gz + 0.294));
  // The gable: its roof along the gate, a pediment to the street, gilt acroteria.
  const r = gable({ x0: -gx - 0.2, x1: gx + 0.2, z0: ZP - 0.7, z1: gz + 0.2, eaveY: top + 0.98, pitch: D(22), along: 'z', over: 0.12, gableOver: 0.0, lod, seed: seed + 3 });
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  out.stucco.push(gableTri(-gx - 0.18, gx + 0.18, gz + 0.16, 0.2, top + 0.98, r.ridgeY - 0.02));
  out.stucco.push(gableTri(-gx - 0.18, gx + 0.18, ZP - 0.5, 0.2, top + 0.98, r.ridgeY - 0.02));
  for (const s of [-1, 1]) out.marble.push(rake(s * (gx + 0.32), top + 0.94, 0, r.ridgeY + 0.05, gz + 0.24, 0.24, 0.14));
  if (lod < 2) {
    out.gilt.push(tintGeometry(boxUV(new CylinderGeometry(0, 0.2, 0.5, lod ? 5 : 8, 1).translate(0, r.ridgeY + 0.34, gz + 0.2))));
    for (const s of [-1, 1]) out.gilt.push(tintGeometry(boxUV(new CylinderGeometry(0, 0.14, 0.36, lod ? 5 : 8, 1).translate(s * (gx + 0.2), top + 1.15, gz + 0.2))));
  }
  // Its four Corinthian columns (part of the gate's own kit: four, not worth instancing apart).
  for (const x of cols) {
    const c = column('corinthian', h, lod);
    for (const geo of [...c.stone, ...c.cap]) out.marble.push(geo.translate(x, PY, gz));
  }
}

/** The court's ring (its sides and the back either side of the hall), the side walls and their paintings, the porticoes' ends. */
function ring(lod, seed, out) {
  const { top, eave, inner } = R.ring;
  const [a0, a1, b0] = inner;
  court({ outer: [-XS, XS, ZR, ZP], inner, topY: top, eaveY: eave, floorY: FL, step: 2.3, lod, seed, out, beamH: BEAM, skip: 'fb', holes: [[-HX, HX, ZR, b0]] });
  // The back pieces either side of the hall's porch.
  const E = (x, z) => [x, eave, z];
  const Tp = (x, z) => [x, top, z];
  for (const q of [[E(-HX, b0), E(a0, b0), Tp(-XS, ZR), Tp(-HX, ZR)], [E(a1, b0), E(HX, b0), Tp(HX, ZR), Tp(XS, ZR)]]) {
    const r = slope(q, { lod, seed: seed + 9 });
    out.tile.push(...r.tile);
    out.wood.push(...r.wood);
  }
  for (const s of [-1, 1]) out.beam.push(box(Math.abs(a0) - HX + 0.13, BEAM, 0.26, s * (HX + (Math.abs(a0) - HX) / 2 + 0.065), eave - BEAM, b0, 0.95));
  // The outer side walls, painted inside with doors into the wings' rooms; the portico's front ends closed by a wall to the street.
  const gaps = [[-0.6, 0.4], [2.6, 3.6], [5.2, 6.2]];
  for (const s of [-1, 1]) {
    out.stucco.push(box(T, top, ZP - ZR, s * (XS - T / 2), 0, (ZP + ZR) / 2));
    out.fresco.push(...frescoFace('z', ZR + T, ZP - T, s * (XS - T), -s, PY, top - 0.35, { gaps, lod, main: FRESCO.red, frame: FRESCO.ochre, panel: 1.6 }));
    for (const [g0, g1] of gaps) out.dark.push(box(0.03, 2.5, g1 - g0, s * (XS - T - 0.015), PY, (g0 + g1) / 2));
    const end = prism([[0, 0], [XS - a1, 0], [XS - a1, top + 0.06], [0, eave + 0.06]].map(([x, y]) => [s < 0 ? -x : x, y]), ZP + 0.2, 0.3);
    end.translate(s * a1, 0, 0);
    out.stucco.push(end);
  }
  // The court's back wall either side of the hall (the wings' fronts) up to the ring's top: doors to the wings.
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [-XS + T, -HX] : [HX, XS - T];
    const own = [[s * 6.6 - 0.5, s * 6.6 + 0.5]].map(([p, q]) => [Math.min(p, q), Math.max(p, q)]);
    out.fresco.push(...frescoFace('x', x0, x1, ZR + T, 1, PY, top - 0.35, { gaps: own, lod, main: FRESCO.black, frame: FRESCO.red, panel: 1.5 }));
    for (const [g0, g1] of own) out.dark.push(darkIn('x', g0, g1, PY, PY + 2.5, ZR + T, -1, 0.04).translate(0, 0, 0.06));
  }
  if (lod < 2) for (const s of [-1, 1]) out.cope.push(...coping('z', ZR, ZP + 0.2, s * (XS - T / 2), T, top));
  // The long outer walls dressed with pilasters and high windows.
  for (const s of [-1, 1]) dressWall('z', ZR + 0.2, ZP + 0.1, s * XS, s, { y0: PY, top, step: 2.3, win: [PY + 1.9, PY + 2.6], lod, out });
}

/** The private wings behind the court's back corners: two storeys, windows in rows, tiled gables along x. */
function wings(lod, seed, out) {
  const eave = 5.6;
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [-XS, -HX] : [HX, XS];
    const cx = (x0 + x1) / 2;
    const w = x1 - x0;
    // The front over the court's portico roof: an upper storey's windows; the back to the street behind.
    const wins = [-1.2, 0, 1.2].map((dx) => ({ a: cx + dx - 0.35, b: cx + dx + 0.35, lo: 4.95, hi: 5.4 }));
    out.stucco.push(...wallAlong('x', x0, x1, ZR + T / 2, T, 0, eave, wins));
    for (const o of wins) out.dark.push(darkIn('x', o.a, o.b, o.lo, o.hi, ZR + T, -1));
    const back = [-1.2, 0, 1.2].flatMap((dx) => [{ a: cx + dx - 0.32, b: cx + dx + 0.32, lo: 2.2, hi: 2.8 }, { a: cx + dx - 0.32, b: cx + dx + 0.32, lo: 4.6, hi: 5.2 }]);
    out.stucco.push(...wallAlong('x', x0, x1, ZB + T / 2, T, 0, eave, back));
    for (const o of back) {
      out.dark.push(darkIn('x', o.a, o.b, o.lo, o.hi, ZB + T, 1));
      out.wood.push(box(o.b - o.a + 0.1, 0.05, 0.08, (o.a + o.b) / 2, o.lo - 0.05, ZB - 0.02, 0.6));
    }
    out.stucco.push(...wallAlong('z', ZB, ZR, s * (XS - T / 2), T, 0, eave));
    // A string course between the storeys, outside.
    out.trav.push(box(w + 0.04, 0.12, 0.06, cx, 3.9, ZB - 0.02, 0.9));
    out.trav.push(box(0.06, 0.12, ZR - ZB, s * (XS + 0.02), 3.9, (ZR + ZB) / 2, 0.9));
    dressWall('z', ZB + 0.2, ZR - 0.1, s * XS, s, { y0: PY, top: eave, step: 2.0, win: [4.4, 5.0], lod, out });
    const r = gable({ x0, x1, z0: ZB, z1: ZR, eaveY: eave, pitch: D(20), along: 'x', over: 0.06, gableOver: 0.0, lod, seed: seed + s });
    out.tile.push(...r.tile);
    out.wood.push(...r.wood);
    const g = gableTri(ZB + 0.02, ZR - 0.02, T / 2, T, eave, r.ridgeY - 0.03);
    // (A quarter turn the way that takes its span (x) onto z as it is: -z would put it at the front.)
    g.rotateY(-Math.PI / 2);
    g.translate(s * (XS - T / 2), 0, 0);
    out.stucco.push(g);
  }
}

/** The hall: its stylobate and steps, walls, the bronze doors, the porch's entablature (the columns apart), the gable, the eagle. */
function hall(lod, seed, out) {
  const { eave, colZ, colH, step } = R.hall;
  const zf = R.ring.inner[2];
  // The stylobate: the porch's floor three steps up from the court, the steps across its front.
  out.marble.push(box(2 * HX, step, zf - ZR, 0, PY, (zf + ZR) / 2, 0.95));
  for (let k = 0; k < 3; k++) {
    const d = (3 - k) * 0.3;
    out.marble.push(slab(2 * HX - 0.4, (step * (k + 1)) / 3, d, { bevel: 0.01, seed: seed + k, wobble: 0, tone: 0.02, grime: 0.12 }).translate(0, PY - 0.0, zf + d / 2));
  }
  // The walls: the front with its great door and two windows, the sides and back up to the eave (stucco scored as marble on the front).
  const dw = 1.35;
  const dh = 4.1;
  const wins = [[-3.6, 1.1], [3.6, 1.1]];
  const ops = [{ a: -dw, b: dw, lo: HY, hi: HY + dh }, ...wins.map(([x, w]) => ({ a: x - w / 2, b: x + w / 2, lo: HY + 2.2, hi: HY + 3.9 }))];
  out.stucco.push(...wallAlong('x', -HX, HX, ZR + T / 2, T, 0, eave, ops));
  for (const o of ops) out.dark.push(darkIn('x', o.a, o.b, o.lo, o.hi, ZR, -1, 0.06));
  for (const [x, w] of wins) {
    out.marble.push(box(w + 0.24, 0.1, 0.16, x, HY + 2.1, ZR + T + 0.06, 0.95));
    out.marble.push(box(w + 0.3, 0.16, 0.12, x, HY + 3.9, ZR + T + 0.04, 0.95));
  }
  for (const s of [-1, 1]) out.marble.push(box(0.24, dh + 0.1, 0.12, s * (dw + 0.12), HY, ZR + T + 0.06, 0.96));
  out.marble.push(box(2 * dw + 0.7, 0.3, 0.16, 0, HY + dh, ZR + T + 0.08, 0.96));
  for (const s of [-1, 1]) {
    out.stucco.push(...wallAlong('z', ZB, ZR, s * (HX - T / 2), T, 0, eave, [-7.6, -5.6].map((z) => ({ a: z - 0.45, b: z + 0.45, lo: 5.6, hi: 6.2 }))));
    for (const z of [-7.6, -5.6]) out.dark.push(darkIn('z', z - 0.45, z + 0.45, 5.6, 6.2, s * (HX - T), -s));
  }
  out.stucco.push(box(2 * HX, eave, T, 0, 0, ZB + T / 2));
  dressWall('x', -HX + 0.1, HX - 0.1, ZB, -1, { y0: PY, top: eave, step: 2.7, win: [4.4, 5.3], winW: 0.8, lod, out });
  // The porch: the entablature on its columns (LEGATVS AVG PR PR, the governor's title, on the frieze), returning to the wall.
  const ab = HY + colH;
  const bands = lod === 2 ? [[0, eave - ab, 0.6]] : [[0, 0.36, 0.56], [0.36, 0.44, 0.6], [0.8, 0.14, 0.74], [0.94, eave - ab - 0.94, 0.86]];
  for (const [y, hh, d] of bands) {
    out.marble.push(box(2 * HX + 0.2, hh, d, 0, ab + y, colZ, 0.96));
    for (const s of [-1, 1]) out.marble.push(box(d, hh, colZ - ZR, s * (HX - 0.2), ab + y, (colZ + ZR) / 2, 0.95));
  }
  if (lod === 0) out.letters.push(...letters('LEGATVS·AVG·PR·PR', ab + 0.44, colZ + 0.305, 0.3));
  else if (lod === 1) out.letters.push(box(4.6, 0.28, 0.006, 0, ab + 0.45, colZ + 0.304));
  // The roof: a gable along the hall over the porch, its pediment to the court; the ridge gilded, gilt acroteria, the eagle.
  const r = gable({ x0: -HX, x1: HX, z0: ZB, z1: colZ + 0.28, eaveY: eave + 0.02, pitch: D(22), along: 'z', over: 0.3, gableOver: 0.06, lod, seed: seed + 5 });
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  out.gilt.push(ridgeCap(0, ZB - 0.04, 0, colZ + 0.36, r.ridgeY + 0.05, lod, 0.13));
  out.stucco.push(gableTri(-HX + 0.02, HX - 0.02, colZ + 0.22, 0.3, eave, r.ridgeY - 0.04));
  out.stucco.push(gableTri(-HX + 0.02, HX - 0.02, ZB + T, T, eave, r.ridgeY - 0.04));
  for (const s of [-1, 1]) out.marble.push(rake(s * (HX + 0.32), eave - 0.04, 0, r.ridgeY + 0.06, colZ + 0.36, 0.28, 0.16));
  if (lod < 2) {
    // A gilt shield (clipeus) with a wreath in the pediment.
    const cy = (eave + r.ridgeY) / 2 - 0.1;
    out.gilt.push(tintGeometry(boxUV(new CylinderGeometry(0.5, 0.5, 0.06, lod ? 12 : 28, 1).rotateX(Math.PI / 2).translate(0, cy, colZ + 0.26))));
    if (lod === 0) {
      // Its rim, the boss in its middle, and a wreath round it.
      out.gilt.push(tintGeometry(boxUV(new TorusGeometry(0.47, 0.035, 5, 28).translate(0, cy, colZ + 0.3)), () => 0.9));
      out.gilt.push(tintGeometry(boxUV(new SphereGeometry(0.13, 10, 6).scale(1, 1, 0.5).translate(0, cy, colZ + 0.3))));
      out.gilt.push(tintGeometry(boxUV(new TorusGeometry(0.62, 0.06, 5, 28).translate(0, cy, colZ + 0.25)), () => 0.8));
    }
    for (const s of [-1, 1]) out.gilt.push(tintGeometry(boxUV(new CylinderGeometry(0, 0.17, 0.44, lod ? 5 : 8, 1).translate(s * (HX + 0.15), eave + 0.2, colZ + 0.3))));
    // The eagle on the gable's top (the legions' eagle, the emperor's bird: the governor is his legate).
    const bag = { gilt: [], wood: [] };
    aquila(0, 0, 0.3, lod, bag);
    // (The bird and its thunderbolt only: the standard's pole fittings and wreath under it are left out.)
    for (const geo of bag.gilt) {
      geo.computeBoundingBox();
      if (geo.boundingBox.min.y < 0.28) continue;
      out.gilt.push(geo.scale(4.2, 4.2, 4.2).translate(0, r.ridgeY + 0.2 - 0.32 * 4.2, colZ + 0.34));
    }
    out.marble.push(slab(0.7, 0.24, 0.7, { bevel: 0.02, seed: seed + 9, wobble: 0, tone: 0, grime: 0 }).translate(0, r.ridgeY - 0.04, colZ + 0.34));
  }
}

/** The garden: lawns, the walk on the axis, two fountains in round pools, parterres of box, marble statues, cypresses. */
function garden(lod, seed, out) {
  const [a0, a1, b0, b1] = R.ring.inner;
  const g = [a0 + 0.21, a1 - 0.21, b0 + 0.21 + 0.9, ZP - 0.2];
  const gy = PY;
  out.lawn.push(box(g[1] - g[0], 0.02, g[3] - g[2], 0, gy, (g[2] + g[3]) / 2, 0.95));
  // The walk from the gate to the hall's steps, paved in marble, and a cross walk between the fountains.
  out.walk.push(box(2.0, 0.04, g[3] - g[2] + 0.2, 0, gy, (g[2] + g[3]) / 2, 0.94));
  const fz = R.fountains[0][1];
  out.gravel.push(box(g[1] - g[0], 0.03, 0.9, 0, gy, fz, 0.95));
  // The fountains: a round pool, a basin on a foot in it, its jet playing.
  for (const [fx, z] of R.fountains) {
    const p = roundPool(fx, z, R.poolR, 0.42, lod);
    for (const geo of [...p.stone, ...p.water]) geo.translate(0, gy, 0);
    out.marble.push(...p.stone);
    out.pool.push(...p.water);
    const lb = labrum(fx, z, gy + 0.05, gy + p.y + 0.62, 0.55, lod);
    out.marble.push(...lb.marble);
    out.water.push(...lb.water);
    const j = jet(fx, lb.y + 0.05, z, 0.62, lb.y, lod, { n: lod ? 2 : 3, spread: 0.15 });
    out.jet.push(...j.stream);
    out.rings.push(...j.rings);
    if (lod < 2) {
      // The basin's overflow falling as a thin sheet into the pool.
      const sheetR = 0.56;
      const s = new CylinderGeometry(sheetR + 0.02, sheetR + 0.1, lb.y - (gy + p.y) - 0.02, lod ? 12 : 24, 1, true);
      s.translate(fx, (lb.y + gy + p.y) / 2 - 0.02, z);
      out.sheet.push(tintGeometry(boxUV(s)));
    }
  }
  // Parterres of clipped box round the fountains' pools, beds of flowers in them.
  const beds = [[-6.6, -4.2, -0.2, 4.0], [4.2, 6.6, -0.2, 4.0], [-6.6, -1.4, 4.4, 6.8], [1.4, 6.6, 4.4, 6.8]];
  beds.forEach(([x0, x1, z0, z1], k) => {
    out.leaf.push(...boxEdging(x0, x1, z0, z1, gy, 0.34, lod, seed + 20 + k));
    out.earth.push(box(x1 - x0 - 0.44, 0.05, z1 - z0 - 0.44, (x0 + x1) / 2, gy, (z0 + z1) / 2, 1.1));
    const alongX = x1 - x0 > z1 - z0;
    out.leaf.push(...(alongX ? bedPlants(x0 + 0.5, x1 - 0.5, (z0 + z1) / 2 - 0.05, (z0 + z1) / 2 + 0.05, gy, seed + 30 + k, lod) : bedPlants((x0 + x1) / 2 - 0.05, (x0 + x1) / 2 + 0.05, z0 + 0.5, z1 - 0.5, gy, seed + 30 + k, lod)));
    out.flowers.push(...flowerBed(x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 0.3, gy, seed + 40 + k, lod, 14));
  });
  // Marble statues along the walk, and cypresses at the garden's back corners.
  for (const [x, z, ry, kind] of [[-1.55, 0.35, Math.PI / 2, 'draped'], [1.55, 0.35, -Math.PI / 2, 'nude'], [-1.55, 5.6, Math.PI / 2, 'nude'], [1.55, 5.6, -Math.PI / 2, 'draped']]) {
    const s = statue(x, z, ry, { y0: gy, h: 1.1, kind, lod, base: 0.75, scale: 0.95 });
    out.marble.push(...s.base, ...s.statue);
  }
  for (const s of [-1, 1]) {
    const c = cypress(s * 6.15, -0.45, 3.6, { lod, seed: seed + 60 + s });
    for (const geo of [...c.leaf, ...c.wood]) geo.translate(0, gy, 0);
    out.leaf.push(...c.leaf);
    out.wood.push(...c.wood);
  }
}

/**
 * The palace's people (people/actors.js specs, its metres), by state. Lived
 * in ('open'): the governor in the toga praetexta on the hall's top step
 * addressing the court, a tribune in his mail and a secretary with his
 * tablet by him; two petitioners on the walk below, listening; his lictors
 * on the top step of the stair with the fasces, two guards in the gate; a
 * slave carrying a sack up the walk and back, another sweeping it; the lady
 * of the house talking with her maid in the garden. Trouble near ('out'):
 * the household gone in, soldiers at the foot of the stair, in the gate,
 * by the fountains and on the hall's steps, one on his round down the walk.
 * Nobody in a palace shut up.
 */
export function regiaActors(state) {
  if (state === 'shut') return [];
  const gy = PY + 0.02;
  const walkY = PY + 0.04;
  const gate = [-1, 1].map((s, k) => guardActor([s * 1.5, PY + 0.04, ZP + 0.42], 0, 701 + k));
  if (state === 'out') {
    const list = [...gate];
    for (const [k, [x, z]] of [[-1.8, 9.35], [1.8, 9.35], [-0.6, 1.0], [0.6, 1.0], [-1.2, R.hall.colZ + 0.75], [1.2, R.hall.colZ + 0.75]].entries()) {
      // (At the stair's foot on the street, on the court's walk, on the hall's second step.)
      const y = z > 8.5 ? 0.06 : z > 0 ? walkY : PY + (2 * R.hall.step) / 3;
      list.push(guardActor([x, y, z], 0, 703 + k));
    }
    list.push(guardActor([0, walkY, 6.6], Math.PI, 710, { clip: 'patrol', route: { length: 4.6, speed: 0.9, pauseEnd: 3, pauseStart: 3, clipEnd: 'guard', clipStart: 'guard' } }));
    return list;
  }
  const zs = R.hall.colZ + 0.6;
  const lictor = { body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'shoulder', props: { L: 'fasces' }, colours: { tunic: DYES.madder, accent: DYES.madder } };
  return [
    ...gate,
    // On the hall's top step: the governor addressing the court, his tribune and his secretary by him.
    togateActor([0, HY, zs], 0, 711, { praetexta: true, clip: 'orate' }),
    { body: 'm', dress: ['tunic:knee', 'lorica', 'caligae'], hair: 'crop', clip: 'listen', at: [-1.1, HY, zs - 0.2], ry: 0.3, seed: 712, colours: { tunic: DYES.white, metal: 0xb08848 } },
    servantActor([1.2, HY, zs - 0.1], -0.4, 713, { clip: 'hold', props: { R: 'tablet' }, dress: ['tunic:knee'], colours: { tunic: DYES.white } }),
    // Two petitioners on the walk at the foot of the steps.
    togateActor([-0.4, walkY, -0.15], Math.PI + 0.1, 714, { clip: 'listen', broad: false }),
    { body: 'm', dress: ['tunic:knee', 'paenula'], hair: 'curls', clip: 'listen', at: [0.42, walkY, -0.05], ry: Math.PI - 0.2, seed: 715, colours: { mantle: DYES.walnut } },
    // His lictors on the stair's top step, the fasces on their shoulders.
    { ...lictor, at: [-0.6, PY, ZP + 0.75], ry: 0.1, seed: 716 },
    { ...lictor, at: [0.6, PY, ZP + 0.75], ry: -0.1, seed: 717 },
    // A slave carrying a sack up the walk to the hall and back; another sweeping the walk.
    servantActor([0.62, walkY, 6.7], Math.PI, 718, { clip: 'carry', props: { L: 'sack' }, route: { length: 6.0, speed: 0.75, pauseEnd: 2.5, pauseStart: 2.5, clipEnd: 'shoulder', clipStart: 'shoulder' } }),
    servantActor([-0.55, walkY, 4.6], 0.4, 719, { clip: 'sweep', props: { R: 'broom' } }),
    // The lady of the house in the garden, her maid listening.
    matronActor([-3.5, gy, 3.75], 0.9, 720, { clip: 'talk', colours: { tunic: DYES.white, mantle: DYES.oxblood, trim: DYES.weld } }),
    { body: 'f', dress: ['tunic:long'], hair: 'bun', clip: 'listen', at: [-2.75, gy, 4.05], ry: -2.2, seed: 721, colours: { tunic: DYES.oatmeal } },
  ];
}

/** Build the palace: { group, meshes, triangles }; meshes tagged in userData.when. Its court's and hall's columns are not in it (government.js). */
export function buildRegia({ lod = 0, seed = 491 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['stucco', 'trav', 'cope', 'fresco', 'floor', 'pave', 'walk', 'tile', 'wood', 'beam', 'stylobate', 'marble', 'bronze', 'gilt', 'giltStatue', 'letters', 'dark',
    'pool', 'water', 'jet', 'rings', 'sheet', 'lawn', 'gravel', 'earth', 'leaf', 'flowers', 'pane'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  platform(lod, seed, out);
  front(lod, seed + 100, out);
  ring(lod, seed + 200, out);
  wings(lod, seed + 300, out);
  hall(lod, seed + 400, out);
  garden(lod, seed + 500, out);
  // Bronze lampstands at the head of the steps.
  for (const [lx, ly, lz] of R.lamps) {
    // (On the platform at the steps, on the porch's floor at the hall.)
    const PY = lz > 0 ? REGIA.floorY : HY;
    out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.03, 0.045, ly - PY - 0.1, lod ? 5 : 8, 1).translate(lx, PY + (ly - PY - 0.1) / 2 + 0.05, lz))));
    out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.13, 0.07, 0.07, lod ? 5 : 10, 1).translate(lx, ly - 0.07, lz))));
    out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.16, 0.2, 0.06, lod ? 5 : 10, 1).translate(lx, PY + 0.03, lz))));
    if (lod < 2) {
      const l = lantern(lx, ly - 0.01, lz, lod);
      out.bronze.push(...l.bronze);
      out.pane.push(l.pane);
    }
  }
  const m = govMaterials();
  const p = new TaggedParts('regia');
  const small = { cast: false };
  if (lod === 2) out.letters = [];
  p.add('stucco', m.stucco, out.stucco);
  p.add('stone', m.trav, [...out.trav, ...out.cope]);
  p.add('fresco', m.fresco, out.fresco, small);
  p.add('floor', m.shelteredMarble, out.floor, small);
  p.add('pave', m.trav, out.pave, small);
  p.add('walk', m.marble, out.walk, small);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  p.add('beam', m.marble, out.beam);
  p.add('stylobate', m.marble, out.stylobate, small);
  p.add('marble', m.marble, out.marble);
  p.add('bronze', m.bronze, out.bronze, small);
  p.add('gilt', m.gilt, [...out.gilt, ...out.giltStatue]);
  p.add('letters', m.letters, out.letters, small);
  p.add('inside', m.dark, out.dark, small);
  p.add('pool', m.water, out.pool, small);
  p.add('water', m.shallow, out.water, small);
  p.add('jet', m.stream, out.jet, { when: 'staffed', cast: false });
  p.add('rings', m.ring, out.rings, { when: 'staffed', cast: false });
  p.add('sheet', m.sheet, out.sheet, { when: 'staffed', cast: false });
  p.add('lawn', m.lawn, out.lawn, small);
  p.add('gravel', m.gravel, out.gravel, small);
  p.add('earth', m.earth, out.earth, small);
  p.add('garden', m.leaf, out.leaf, { cast: lod < 2 });
  p.add('flowers', m.flowers, out.flowers, small);
  // The hall's bronze doors.
  const open = doubleDoor(0, ZR + T / 2, 2.7, 4.1, HY, { open: true, lod, metal: true });
  const shut = doubleDoor(0, ZR + T / 2, 2.7, 4.1, HY, { open: false, lod, metal: true });
  p.add('doors', m.bronze, open.bronze, { when: 'open' });
  p.add('doors', m.bronze, shut.bronze, { when: 'shut' });
  p.add('doors', m.bronze, shut.bronze.map((g) => g.clone()), { when: 'out' });
  // The governor's standards at the foot of the steps, flown while he is in residence.
  for (const s of [-1, 1]) {
    const st = standard(s * 4.55, 9.35, 0.06, 4.6, lod, { w: 0.8, hc: 0.9 });
    p.add('standard-pole', m.wood, st.wood, { when: 'staffed' });
    p.add('standard-gilt', m.gilt, st.gilt, { when: 'staffed', cast: false });
    p.add('standard', m.cloth, st.cloth, { when: 'staffed' });
  }
  p.add('lamp', lanternPane(), out.pane, { when: 'staffed', cast: false });
  p.add('lamp', m.lampOut, out.pane.map((g) => g.clone()), { when: 'shut', cast: false });
  // (The court, the household, the lictors and the guard are actors: regiaActors.)
  return p.build();
}

/** The court's and the hall's colonnades for government.js. */
export const REGIA_COLONNADES = Object.freeze([
  // Down either side of the court (none at the street end, where the porticoes end in a wall) and at the back corners.
  Object.freeze({
    order: 'ionic',
    smooth: true,
    h: R.ring.eave - BEAM - FL,
    y: FL,
    at: Object.freeze([-1, 1].flatMap((s) => [-1.6, 0.7, 3.0, 5.3].map((z) => [s * 7.2, z])).concat([[-5.85, -1.6], [5.85, -1.6]])),
  }),
  // The hall's porch: Corinthian with gilt capitals.
  Object.freeze({ order: 'gilt', h: R.hall.colH, y: HY, at: Object.freeze(R.hall.cols.map((x) => [x, R.hall.colZ])) }),
]);

/** Its lamps for models.js modelLamps: the lampstands at the head of the steps, facing the street. */
export const REGIA_LAMPS = Object.freeze(R.lamps.map(([x, y, z]) => Object.freeze([x, y + 0.1, z, 1])));

