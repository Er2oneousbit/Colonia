/**
 * models/castraLegion.js
 * ----------------------------------------------------------------------------
 * The legion fort (Castra) of the 3D look: a stone fort of the legions in
 * miniature, after the forts and milecastles the legions built on Hadrian's
 * Wall (their building stones name the Second, Sixth and Twentieth legions)
 * and the stone forts of the German frontier (the Saalburg):
 *
 *   - a curtain of dressed sandstone, a crenellated parapet over a walk
 *     carried by an earth bank behind the wall; square corner towers
 *     roofed with tiles; the main gate (porta praetoria) between two towers,
 *     its arch of voussoirs, its two leaves bound with iron, a plaque over
 *     it cut LEG II AVG (the Second Legion Augusta, the Wall's builders)
 *   - the headquarters (principia) against the back rampart, facing the
 *     gate across the yard: a podium, a portico of four Tuscan columns, the
 *     shrine of the standards (aedes) behind it, stuccoed red and white
 *   - before its steps the standards on their stone base: the eagle
 *     (aquila), two centuries' signa with their discs, the vexillum in the
 *     legion's red, the emperor's portrait (imago)
 *   - two barrack blocks along the sides, a door and a window to each
 *     eight-man room (contubernium), under pent roofs of tiles over a
 *     veranda; a bread oven and a water tank in the lee of the rampart
 *   - the yard gravelled, the street from the gate to the headquarters
 *     paved (via praetoria)
 *
 * States (models.js partShows; models/militaryModels.js fortState):
 *   'open'  men at home: the gate open, the lanterns lit; sentries pace the
 *           walk over the gate and the rampart's walks and stand on guard at
 *           each end, two men guard the standards (legionActors)
 *   'out'   deployed, or men away at a distant battle: the standards are out
 *           with the men (their base empty), the gate open, nobody on watch
 *   'shut'  nobody: the gate shut, the lanterns dark
 * Tags: 'home' (open or shut: the standards on their base), 'staffed'
 * (open or out: the gate's leaves swung back, the lanterns lit).
 *
 * The men at rest in the yard are the game's own soldiers, drawn over the
 * model; the people here (people/actors.js) are the fort's watch only.
 *
 * Metres, the fort's middle at the origin, y up, the gate toward +z.
 * ----------------------------------------------------------------------------
 */

import { paving, slab, tuscanColumn } from './masonry.js';
import { gableRoof, lin } from './rural.js';
import {
  CASTRA, fortBag, assemble, TANK_WATER, stoneRun, stoneTower, stoneGate, barrackBlock, onSide, mirrorX, box, gravel,
  aquila, signum, vexillum, imago, standardBase, oven, tank, inscribe, soldier, wallSentry,
} from './castra.js';

/** The legion fort's measures (metres): the tests, the lab and the game read them. */
export const LEGION_FORT = Object.freeze({
  /** The headquarters' podium: x0, x1, z0 (against the back rampart), z1 (its front), its height. */
  principia: Object.freeze([-1.6, 1.6, -5.3, -3.4, 0.3]),
  /** The standards' base (z) and the poles' height. */
  standards: Object.freeze([-2.72, 2.05]),
  /** The barrack blocks' yard faces (|x|) and their ends (z). */
  blocks: Object.freeze([3.25, 4.72, -3.7, 3.25]),
  /** The lanterns by the gate (x, y, z): the game's night lights them while the fort is manned (models.js modelLamps). */
  lamps: Object.freeze([Object.freeze([-1.08, 1.62, 5.62]), Object.freeze([1.08, 1.62, 5.62])]),
});

const L = LEGION_FORT;
/** The headquarters' roof pitch: low, so its pediment hides little of the yard seen over it. */
const PITCH = (20 * Math.PI) / 180;
const RED = lin(0xa8322b);

const bag = fortBag;

/** The rampart: four runs (the front's either side of the gate), the corner towers, the gate. */
function rampart(lod, seed, out) {
  const O = CASTRA.O;
  const a = O - CASTRA.tower;
  const g = CASTRA.gateHalf + CASTRA.gateTower;
  // The front, either side of the gate.
  stoneRun(-a, -g, { lod, seed: seed + 1, out });
  stoneRun(g, a, { lod, seed: seed + 2, out });
  // The sides and the back, each built on the front and turned (the back's bank stops at the headquarters).
  for (const k of [1, 3]) {
    const side = bag();
    stoneRun(-a, a, { lod, seed: seed + 10 + k, out: side });
    for (const [key, list] of Object.entries(side)) out[key].push(...onSide(list, k));
  }
  const back = bag();
  const [px0, px1] = L.principia;
  stoneRun(-a, px0, { lod, seed: seed + 20, out: back });
  stoneRun(px0, px1, { lod, seed: seed + 21, out: back, bankFoot: CASTRA.O - 0.6 });
  stoneRun(px1, a, { lod, seed: seed + 22, out: back });
  for (const [key, list] of Object.entries(back)) out[key].push(...onSide(list, 2));
  // The corner towers, roofed with tiles.
  for (let k = 0; k < 4; k++) {
    const t = bag();
    stoneTower({ lod, seed: seed + 30 + k, out: t, h: 2.3, door: k % 2 ? 'z' : 'x', roof: true });
    for (const [key, list] of Object.entries(t)) out[key].push(...onSide(list, k));
  }
  stoneGate({ lod, seed: seed + 40, out, h: 2.55, merlon: 3.2, walk: 2.45, spring: 1.38, rise: 0.8, roof: false });
  // The plaque over the arch, outside: LEG II AVG.
  const z = CASTRA.O + 0.09;
  out.marble.push(box(1.1, 0.24, 0.04, 0, 2.2, z - 0.02, 0.95));
  if (lod === 0) out.letters.push(...inscribe('LEG·II·AVG', 2.245, z + 0.003, 0.14));
  else if (lod === 1) out.letters.push(box(0.8, 0.12, 0.006, 0, 2.26, z + 0.002));
}

/** The headquarters: the podium and steps, the portico, the shrine of the standards, the roof. */
function principia(lod, seed, out) {
  const [x0, x1, z0, z1, ph] = L.principia;
  const cx = (x0 + x1) / 2;
  // The podium, faced with ashlar; two steps up to it.
  out.ashlar.push(slab(x1 - x0, ph, z1 - z0, { bevel: 0.02, seed: seed + 1, wobble: 0, tone: 0, grime: 0.35 }).translate(cx, 0, (z0 + z1) / 2));
  for (let k = 0; k < 2; k++) {
    out.stone.push(slab(2.2 - k * 0.2, ph / 2 * (k + 1), 0.3 - k * 0.0, { bevel: 0.015, seed: seed + 2 + k, wobble: 0.002, tone: 0.03, grime: 0.3 }).translate(cx, 0, z1 + 0.3 - k * 0.15 - 0.15));
  }
  // The shrine: plastered walls, red below and white above, a wide door into its dark room.
  const cz0 = z0 + 0.05;
  const cz1 = z0 + 1.15;
  const eave = 1.66;
  const t = 0.16;
  const wx0 = x0 + 0.12;
  const wx1 = x1 - 0.12;
  const dw = 0.86;
  const dh = 1.18;
  // Front wall in three pieces round the door.
  for (const [a, b, y0, y1] of [[wx0, -dw / 2, ph, eave], [dw / 2, wx1, ph, eave], [-dw / 2, dw / 2, ph + dh, eave]]) {
    out.plaster.push(box(b - a, y1 - y0, t, (a + b) / 2, y0, cz1 - t / 2, 0.95));
  }
  // A red dado across the front, either side of the door.
  for (const [a, b] of [[wx0, -dw / 2], [dw / 2, wx1]]) out.red.push(box(b - a, 0.55, 0.01, (a + b) / 2, ph, cz1 + 0.003, 0.95));
  out.plaster.push(box(t, eave - ph, cz1 - cz0, wx0 + t / 2, ph, (cz0 + cz1) / 2, 0.9));
  out.plaster.push(box(t, eave - ph, cz1 - cz0, wx1 - t / 2, ph, (cz0 + cz1) / 2, 0.9));
  out.dark.push(box(dw, dh, 0.02, 0, ph, cz1 - t - 0.02));
  out.stone.push(box(dw + 0.2, 0.1, t + 0.06, 0, ph + dh, cz1 - t / 2, 0.9));
  // The portico: four Tuscan columns, an architrave over them.
  const colZ = z1 - 0.3;
  const colH = eave - ph - 0.16;
  for (const x of [-1.27, -0.43, 0.43, 1.27]) {
    for (const g of tuscanColumn(0.1, colH, lod)) out.stone.push(g.translate(x, ph, colZ));
  }
  out.stone.push(slab(x1 - x0 - 0.1, 0.16, 0.26, { bevel: 0.01, seed: seed + 9, wobble: 0, tone: 0, grime: 0 }).translate(cx, eave - 0.16, colZ));
  // The plaque on the architrave's face.
  if (lod === 0) out.letters.push(...inscribe('PRINCIPIA', eave - 0.13, colZ + 0.135, 0.1));
  // The roof: a tiled gable along z, its pediment over the portico.
  const roof = gableRoof({ x0, x1, z0: z0 - 0.02, z1: colZ + 0.12, eaveY: eave, pitch: PITCH, along: 'z', lod, seed: seed + 20, over: 0.18, gableOver: 0.12 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // The gables: triangles of plaster under the roof, front and back.
  for (const z of [colZ + 0.11, z0 + 0.06]) {
    const rise = ((x1 - x0) / 2) * Math.tan(PITCH);
    const g = box(x1 - x0 - 0.02, 1, 0.08, cx, 0, z, 0.95);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const top = p.getY(i) > 0.5;
      p.setY(i, top ? eave + rise * (1 - Math.abs(p.getX(i) - cx) / ((x1 - x0) / 2)) : eave);
    }
    g.computeVertexNormals();
    out.plaster.push(g);
  }
}

/** The standards before the headquarters' steps: the eagle in the middle, signa, the vexillum, the imago. */
function standards(lod, std, out) {
  const [z, h] = L.standards;
  standardBase(-0.9, 0.9, z, lod, out, 5);
  aquila(0, z, h + 0.15, lod, std);
  signum(-0.45, z, h, lod, std, { hand: true, discs: 5 });
  signum(0.45, z, h - 0.05, lod, std, { hand: false, discs: 4 });
  vexillum(-0.9, z, h + 0.1, lod, std, RED);
  imago(0.9, z, h - 0.1, lod, std);
}

/** The yard: gravel, the paved street from the gate to the headquarters, the oven, the tank. */
function yard(lod, seed, out) {
  const b = 4.75;
  gravel(-b, b, -b, b, out);
  out.flags.push(...paving(-0.95, 0.95, L.principia[3] + 0.32, CASTRA.gateIn, 0.06, seed + 1, { rowW: 0.62, minL: 0.5, maxL: 0.9, lod }));
  oven(3.75, 3.95, lod, out, { r: 0.42 });
  oven(-3.75, -3.95, lod, out, { r: 0.42 });
  tank(-3.55, 3.85, 1.0, 0.7, 0.55, lod, out, seed + 5);
}

/** Build the legion fort: { group, meshes, triangles }; meshes tagged in userData.when. */
export function buildLegionFort({ lod = 0, seed = 101 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bag();
  const std = { wood: [], gilt: [], silver: [], cloth: [], iron: [], bronze: [], rope: [] };
  rampart(lod, seed, out);
  principia(lod, seed + 100, out);
  standards(lod, std, out);
  yard(lod, seed + 200, out);
  // The barrack blocks: the right one built, the left one its mirror.
  const [bx0, bx1, bz0, bz1] = L.blocks;
  barrackBlock({ lod, seed: seed + 300, out, x0: bx0, x1: bx1, z0: bz0, z1: bz1, eave: 1.4, rooms: 4 });
  const left = bag();
  barrackBlock({ lod, seed: seed + 310, out: left, x0: bx0, x1: bx1, z0: bz0, z1: bz1, eave: 1.4, rooms: 4 });
  for (const [key, list] of Object.entries(left)) out[key].push(...mirrorX(list));
  const { p } = assemble('castra', out, std, lod, L.lamps);
  // (The watch are actors: legionActors.)
  return p.build();
}

/**
 * The legion fort's watch (people/actors.js specs, its metres) while its
 * men are home ('open'): a sentry pacing the walk over the gate (2.45 m up,
 * between its parapets), one on the front walk right of the gate, one on
 * the back walk behind the left barrack block (1 m up, clear of the blocks'
 * and the headquarters' roofs), each stopping at the ends to stand guard
 * looking out; and a guard either side of the standards before the
 * headquarters, as the aedes was guarded day and night. Nobody on watch
 * while the men are out with the standards, or the fort is empty.
 */
export function legionActors(state) {
  if (state !== 'open') return [];
  const [sz] = L.standards;
  return [
    wallSentry('legion', -0.95, 0.95, 2.45, CASTRA.gateIn + 0.46, 11),
    wallSentry('legion', 2.55, 3.95, 1.0, CASTRA.O - 0.7, 12),
    // (The back's walk, its x the front's turned: from 2.2 to 4.0 there is -2.2 to -4.0 here.)
    wallSentry('legion', 2.2, 4.0, 1.0, CASTRA.O - 0.7, 13, 2),
    soldier('legion', { at: [-1.4, CASTRA.floorY, sz + 0.1], ry: 0.15, seed: 14 }),
    soldier('legion', { at: [1.4, CASTRA.floorY, sz + 0.1], ry: -0.15, seed: 15 }),
  ];
}

export { TANK_WATER };
