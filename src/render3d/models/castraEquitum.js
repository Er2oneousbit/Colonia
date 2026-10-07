/**
 * models/castraEquitum.js
 * ----------------------------------------------------------------------------
 * The cavalry fort (Castra Equitum) of the 3D look: the fort of an ala, a
 * regiment of horse, after the cavalry forts of Hadrian's Wall and the
 * stable-barracks found in them:
 *
 *   - at Wallsend, South Shields and Chesters the troopers lived with their
 *     horses: long blocks with the horses' stalls on one side, the drains
 *     of their urine running down the middle, and the men's rooms over or
 *     beside them; so here a stable-barrack along the left of the yard,
 *     its stalls open to the yard under a lean-to of tiles, a manger and a
 *     hay rack in each, the decurion's house at its end
 *   - the curtain rendered and limewashed (as many forts' walls were),
 *     dressed quoins at the towers, red-tiled tower roofs, the gate's arch
 *     high enough for a rider, ALA PETRIANA over it (the Wall's biggest
 *     cavalry regiment, at Stanwix)
 *   - the horse yard of beaten earth, a stone trough, a hay rick; the
 *     troopers' four-horned saddles (the kind found at Vindolanda, rebuilt
 *     from their leather covers) on a rack
 *   - the standards: the ala's vexillum in gold, and its dragon (draco),
 *     the windsock standard Arrian describes, a bronze head with a tail of
 *     cloth (the Niederbieber head)
 *
 * The horses in the stalls are drawn as the farms' horses (`more`, one for
 * each trooper of the ala: models/militaryModels.js fortMore), so only the
 * building is here. States as the legion fort's: 'open', 'out', 'shut';
 * 'home' and 'staffed' tags.
 *
 * Metres, the fort's middle at the origin, y up, the gate toward +z.
 * ----------------------------------------------------------------------------
 */

import { ConeGeometry, Matrix4 } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { slab } from './masonry.js';
import { gableRoof, leanTo, lin, D } from './rural.js';
import {
  CASTRA, fortBag, pour, assemble, TANK_WATER, onSide, stoneRun, stoneTower, stoneGate, box, staff, tank,
  vexillum, draco, imago, standardBase, inscribe, sentry, oven, limewash,
} from './castra.js';

/** The cavalry fort's measures (metres): the tests, the lab and the game read them. */
export const CAVALRY_FORT = Object.freeze({
  /** The stable-barrack: x0 (its back wall), x1 (its open front), z0, z1; its roof's top and eave. */
  stable: Object.freeze([-4.72, -2.45, -4.25, 2.2, 2.2, 1.5]),
  /** Stalls along it (one horse each, `more`). */
  stalls: 8,
  /** The decurion's house at its end: x0, x1, z0, z1. */
  house: Object.freeze([-4.72, -2.65, 2.42, 4.25]),
  lamps: Object.freeze([Object.freeze([-1.08, 1.62, 5.62]), Object.freeze([1.08, 1.62, 5.62])]),
});

const Q = CAVALRY_FORT;
const GOLD = lin(0xc9962e);

/**
 * Where the horse in stall k stands: its matrix in the fort's metres, head
 * to the manger at the back wall (-x), where the roof is highest, its
 * quarters and tail toward the yard under the eave.
 */
export function stallMatrix(k, out = new Matrix4()) {
  const [x0, , z0, z1] = Q.stable;
  const w = (z1 - z0) / Q.stalls;
  const m = new Matrix4().makeRotationY(-Math.PI / 2);
  m.setPosition(x0 + 1.62, 0.06, z0 + (k + 0.5) * w);
  return out.copy(m);
}

/** The stable-barrack: back and end walls, the stalls' partitions and posts, mangers and racks, the lean-to. */
function stable(lod, seed, out) {
  const [x0, x1, z0, z1, top, eave] = Q.stable;
  const L = z1 - z0;
  const cz = (z0 + z1) / 2;
  const t = 0.2;
  out.stone.push(box(x1 - x0, 0.06, L, (x0 + x1) / 2, 0, cz, 0.7));
  out.plaster.push(box(t, top, L + 0.04, x0 + t / 2, 0, cz, (x, y) => 0.8 + 0.2 * Math.min(1, y / 0.6)));
  // The end walls: their tops slope with the roof.
  for (const z of [z0 + t / 2, z1 - t / 2]) {
    const g = box(x1 - x0, 1, t, (x0 + x1) / 2, 0, z, 0.85);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) - x0) / (x1 - x0);
      p.setY(i, p.getY(i) > 0.5 ? top + (eave - top) * u : 0);
    }
    g.computeVertexNormals();
    out.plaster.push(g);
  }
  // Straw on the floor; the drain down the stalls.
  if (lod < 2) out.hay.push(box(x1 - x0 - 0.3, 0.025, L - 0.4, (x0 + x1) / 2 + 0.05, 0.06, cz, 0.8));
  // Posts along the open front, a stall to each bay; partitions of boards back to the wall.
  const n = Q.stalls;
  const w = L / n;
  for (let k = 0; k <= n; k++) {
    const z = Math.min(z1 - 0.07, Math.max(z0 + 0.07, z0 + k * w));
    out.wood.push(box(0.12, eave - 0.05, 0.12, x1 - 0.06, 0, z, (x, y) => 0.7 + 0.3 * Math.min(1, y / 0.5)));
    if (k > 0 && k < n) {
      out.wood.push(box(x1 - x0 - 1.05, 1.15, 0.05, x0 + t + (x1 - x0 - 1.05) / 2, 0.06, z, 0.75));
      if (lod === 0) out.wood.push(box(0.08, 1.35, 0.08, x0 + t + (x1 - x0 - 1.05), 0, z, 0.75));
    }
  }
  // The manger along the back wall, a hay rack over it (slats), hay in it.
  out.wood.push(box(0.42, 0.28, L - 0.3, x0 + t + 0.22, 0.62, cz, 0.7));
  out.hay.push(box(0.34, 0.06, L - 0.4, x0 + t + 0.22, 0.88, cz, 0.9));
  if (lod < 2) {
    out.hay.push(box(0.22, 0.3, L - 0.4, x0 + t + 0.14, 1.22, cz, 0.85));
    if (lod === 0) for (let k = 0; k < Math.round(L / 0.12); k++) out.wood.push(staff([x0 + t + 0.02, 1.05, z0 + 0.2 + k * 0.12], [x0 + t + 0.3, 1.6, z0 + 0.2 + k * 0.12], 0.012, 3));
  }
  // The lean-to of tiles: from the back wall's top down over the stalls' fronts.
  const r = leanTo({ L: L + 0.3, span: x1 - x0, topY: top, eaveY: eave, lod, seed: seed + 5, over: 0.2 });
  for (const g of [...r.tile, ...r.wood]) {
    g.rotateY(Math.PI / 2);
    g.translate(x0, 0, cz);
  }
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  // The beam along the front over the posts.
  out.wood.push(box(0.14, 0.14, L + 0.2, x1 - 0.06, eave - 0.14, cz, 0.75));
}

/** The decurion's house at the stable's end: plastered, a tiled gable, a door to the yard. */
function house(lod, seed, out) {
  const [x0, x1, z0, z1] = Q.house;
  const eave = 1.55;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  out.stone.push(box(x1 - x0 + 0.06, 0.22, z1 - z0 + 0.06, cx, 0, cz, 0.7));
  out.plaster.push(box(x1 - x0, eave - 0.22, z1 - z0, cx, 0.22, cz, (x, y) => 0.82 + 0.18 * Math.min(1, y / 0.8)));
  // A red dado and the door and window toward the yard (+x).
  out.red.push(box(0.01, 0.45, z1 - z0 - 0.02, x1 + 0.004, 0.22, cz, 0.9));
  out.dark.push(box(0.02, 1.0, 0.5, x1 + 0.008, 0.22, cz - 0.3));
  out.dark.push(box(0.02, 0.3, 0.32, x1 + 0.008, 0.85, cz + 0.45));
  out.wood.push(box(0.05, 0.08, 0.66, x1 + 0.02, 1.22, cz - 0.3, 0.8));
  const roof = gableRoof({ x0, x1, z0, z1, eaveY: eave, pitch: D(24), along: 'z', lod, seed: seed + 3, over: 0.22, gableOver: 0.16 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  for (const z of [z0 + 0.04, z1 - 0.04]) {
    const g = box(x1 - x0 - 0.02, 1, 0.08, cx, 0, z, 0.9);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? eave + (roof.ridgeY - eave) * (1 - Math.abs(p.getX(i) - cx) / ((x1 - x0) / 2)) : eave);
    g.computeVertexNormals();
    out.plaster.push(g);
  }
  // A chimney pot of the hearth.
  if (lod < 2) out.clay.push(box(0.2, 0.32, 0.2, x0 + 0.5, roof.ridgeY - 0.25, cz + 0.4, 0.8));
}

/**
 * A four-horned saddle (after the Vindolanda covers, Connolly's rebuild):
 * a padded seat with a horn at each corner, a cloth under it, on y = 0
 * along x (the horse's way), at (x, y, z).
 */
function saddle(x, y, z, lod, out, cloth) {
  out.cloth.push(tintGeometry(box(0.7, 0.03, 0.62, x, y - 0.02, z, 1), () => cloth));
  const seat = slab(0.55, 0.12, 0.42, { bevel: 0.05, seed: 3, wobble: 0.005, tone: 0, grime: 0 });
  seat.translate(x, y, z);
  out.leather.push(tintGeometry(seat, () => lin(0x6a4428)));
  if (lod === 2) return;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const h = new ConeGeometry(0.04, sx > 0 ? 0.16 : 0.12, 6);
      h.rotateZ(-sx * 0.35);
      h.translate(x + sx * 0.22, y + 0.17, z + sz * 0.15);
      out.leather.push(tintGeometry(boxUV(h), () => lin(0x5a3820)));
    }
  }
}

/** A hay rick round a pole, thatched on top, at (x, z). */
function rick(x, z, r, h, lod, out) {
  const g = revolve(profileOf([[0, 0], [r, 0], [r * 1.06, h * 0.45], [r * 0.9, h * 0.7], [r * 0.4, h * 0.94], [0.05, h], [0, h]]), { segments: lod === 0 ? 18 : lod === 1 ? 10 : 7, metres: 0.8 });
  g.translate(x, 0, z);
  out.hay.push(tintGeometry(g, (gx, gy) => 0.82 + 0.18 * Math.min(1, gy / h)));
  out.wood.push(staff([x, h - 0.1, z], [x, h + 0.35, z], 0.035, 5));
}

/** Build the cavalry fort: { group, meshes, triangles }; meshes tagged in userData.when. */
export function buildCavalryFort({ lod = 0, seed = 151 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = fortBag();
  const std = { wood: [], gilt: [], silver: [], cloth: [], iron: [], bronze: [], rope: [] };
  const O = CASTRA.O;
  // (Smaller, lower corner towers than the legion's: the troopers' spots in the yard run nearer the corners.)
  const side = 1.3;
  const a = O - side;
  const g = CASTRA.gateHalf + CASTRA.gateTower;
  const wall = { facing: 'plaster', plain: true };
  // The rampart: limewashed walls, the front either side of the gate, the sides and back turned on.
  stoneRun(-a, -g, { lod, seed: seed + 1, out, ...wall });
  stoneRun(g, a, { lod, seed: seed + 2, out, ...wall });
  for (const k of [1, 2, 3]) {
    const run = fortBag();
    // (The left side's bank stops at the stable, built against the wall.)
    stoneRun(-a, a, { lod, seed: seed + 10 + k, out: run, ...wall, bankFoot: k === 3 ? O - 0.62 : 4.75 });
    pour(run, out, (l) => onSide(l, k));
  }
  for (let k = 0; k < 4; k++) {
    const t = fortBag();
    stoneTower({ lod, seed: seed + 30 + k, out: t, side, h: 2.0, door: k % 2 ? 'z' : 'x', roof: true, ...wall });
    pour(t, out, (l) => onSide(l, k));
  }
  stoneGate({ lod, seed: seed + 40, out, h: 2.15, merlon: 2.8, walk: 2.4, spring: 1.4, rise: 0.72, innerPar: 0.14, ...wall });
  const z = O + 0.09;
  out.marble.push(box(1.36, 0.24, 0.04, 0, 2.2, z - 0.02, 0.95));
  if (lod === 0) out.letters.push(...inscribe('ALA·PETRIANA', 2.245, z + 0.003, 0.13));
  else if (lod === 1) out.letters.push(box(1.0, 0.11, 0.006, 0, 2.26, z + 0.002));
  // (Everything of the rampart and the gate limewashed, its painted zones' red and black left below.)
  for (const gg of out.plaster) limewash(gg);
  // The horse yard: beaten earth.
  out.earth.push(box(2 * 4.75, CASTRA.floorY, 2 * 4.75, 0, 0, 0, (x, y, zz) => 0.82 + 0.18 * Math.cos(x * 0.5 + 1) * Math.cos(zz * 0.4)));
  stable(lod, seed + 50, out);
  house(lod, seed + 60, out);
  // The trough in the yard, the rick at the back, the saddles on their rack by the house.
  tank(1.2, 0.25, 1.5, 0.5, 0.5, lod, out, seed + 70);
  rick(4.0, -4.1, 0.55, 1.45, lod, out);
  const rx = -2.05;
  for (const s of [-1, 1]) out.wood.push(box(0.07, 0.85, 0.07, rx, 0, 3.2 + s * 0.6, 0.8));
  out.wood.push(box(0.1, 0.08, 1.4, rx, 0.85, 3.2, 0.8));
  for (const [k, c] of [[0, GOLD], [1, lin(0x8a2a1e)], [2, GOLD]]) {
    const sad = { cloth: [], leather: [] };
    saddle(0, 0, 0, lod, sad, c);
    for (const gg of [...sad.cloth, ...sad.leather]) {
      gg.rotateY(Math.PI / 2);
      gg.translate(rx, 0.93, 2.75 + k * 0.45);
    }
    out.cloth.push(...sad.cloth);
    out.leather.push(...sad.leather);
  }
  oven(3.9, 3.95, lod, out, { r: 0.4 });
  // The standards by the gate: the dragon, the vexillum, the portrait.
  const sz = 3.95;
  standardBase(-1.95, -1.05, sz, lod, out, 3);
  draco(-1.5, sz, 2.05, lod, std, lin(0xa8322b));
  vexillum(-1.05, sz, 1.95, lod, std, GOLD);
  imago(-1.95, sz, 1.8, lod, std);
  const { p, mats } = assemble('castra-equitum', out, std, lod, Q.lamps, { facing: 'plaster' });
  if (lod === 0) sentry(p, mats, 'sentry', 0.55, 2.45, O - 0.35, 0.2, 'open', { cloth: 0xc9962e, shield: GOLD });
  return p.build();
}

export { TANK_WATER };
