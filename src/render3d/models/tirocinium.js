/**
 * models/tirocinium.js
 * ----------------------------------------------------------------------------
 * The barracks (Tirocinium) of the 3D look: where a recruit (tiro) was
 * examined, sworn and armed before he went to his unit, from what the
 * writers and the finds say of it rather than from the 2D sprite:
 *
 *   - Vegetius (book 1) on the recruit: measured for height, sworn in,
 *     marked, then drilled at the post (palus), a stake six feet high set
 *     in the ground, struck with a wicker shield and a wooden sword twice
 *     the weight of the real ones; the probatio, the examination, was a
 *     clerk's business, and the papyri keep the lists of men "approved"
 *   - the armoury (armamentarium) of a fort, its racks of arms, as the
 *     storerooms by the principia at Corbridge and the armour stores at
 *     Carlisle show: a legionary's set was his curved shield (scutum), two
 *     pila (an iron shank on a wooden shaft), a helmet (galea, with its
 *     neck guard and cheek pieces) and a sword (gladius)
 *
 * So, in 12 m: the armoury along the left, its doors to the yard, before it
 * a rack of eight places, each a set of arms when the barracks holds one (a
 * recruit's 50 weapons: models/militaryModels.js barracksMore, `more` kits
 * 'barracks:set'); the office along the back under a veranda, the clerk's
 * table and the measuring rod, a rack of eight places for the arrows (a
 * sheaf for every 50: 'barracks:arrows'); the horse line along the right,
 * a rail and a trough, a horse for every 100 units it holds (the farms'
 * horses); the sanded drill yard with four posts, wicker shields and
 * wooden swords; a low wall round it, a gate to the street.
 *
 * States (models.js partShows; militaryModels.js barracksState):
 *   'out'   staffed, a recruit in training: he strikes at the post under
 *           the eye of his instructor, the clerk at his table
 *   'open'  staffed, no recruit: the clerk at his table, the doors open
 *   'shut'  no staff: the armoury's doors and the gate shut, nobody
 * Tags: 'staffed' (open or out), 'out', 'shut'.
 *
 * Metres, the middle at the origin, y up, the gate toward +z.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry, ConeGeometry, Matrix4 } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { TaggedParts, slab, lantern, lanternPane } from './masonry.js';
import { gableRoof, leanTo, lin, D } from './rural.js';
import { figureParts } from './figure.js';
import { castraMaterials, box, cyl, staff, vexillum } from './castra.js';

/** The barracks' measures (metres): the tests, the lab and the game read them. */
export const BARRACKS = Object.freeze({
  /** The armoury (x0, x1, z0, z1), its eave. */
  armoury: Object.freeze([-5.5, -3.7, -5.55, 3.0, 2.0]),
  /** The office along the back (x0, x1, z0, z1), its eave, the veranda's front. */
  office: Object.freeze([-3.5, 5.7, -5.6, -4.1, 1.9, -3.35]),
  /** The arms rack: its line (x), the places' z. */
  armsX: -3.2,
  armsZ: Object.freeze([-2.45, -1.75, -1.05, -0.35, 0.35, 1.05, 1.75, 2.45]),
  /** The arrows' rack: its line (z), the places' x. */
  arrowsZ: -2.95,
  arrowsX: Object.freeze([-1.1, -0.5, 0.1, 0.7, 1.3, 1.9, 2.5, 3.1]),
  /** The horse line: the horses' places (x, z), facing the rail (+x). */
  horses: Object.freeze([Object.freeze([3.85, -1.9]), Object.freeze([3.85, -0.55]), Object.freeze([3.85, 0.8]), Object.freeze([3.85, 2.15])]),
  /** The posts (pali) in the drill yard. */
  pali: Object.freeze([[-0.7, 0.3], [1.7, 0.3], [-0.7, 2.9], [1.7, 2.9]]),
  /** The lanterns on the gate's piers (x, y, z). */
  lamps: Object.freeze([Object.freeze([-1.45, 1.55, 5.82]), Object.freeze([1.45, 1.55, 5.82])]),
});

const B = BARRACKS;
const RED = lin(0xa8322b);

/** A palus: a squared stake 1.8 m high, its face hacked by the recruits' swords. */
function palus(x, z, lod, out) {
  out.wood.push(box(0.2, 1.8, 0.2, x, 0, z, (gx, gy) => 0.62 + 0.3 * Math.min(1, gy / 1.2)));
  if (lod === 0) {
    for (let k = 0; k < 5; k++) out.dark.push(box(0.12, 0.012, 0.005, x - 0.02 + (k % 2) * 0.04, 0.8 + k * 0.17, z + 0.102));
  }
}

/** A wicker shield (oval, twice the weight of a real one) standing on y 0, its face +z. */
function wickerShield(lod) {
  const g = new CylinderGeometry(0.34, 0.34, 0.04, lod ? 10 : 18, 1);
  g.rotateX(Math.PI / 2);
  g.scale(1, 1.45, 1);
  g.translate(0, 0.5, 0);
  return tintGeometry(boxUV(g), (x, y) => 0.8 + 0.2 * Math.abs(Math.sin(x * 40 + y * 6)));
}

/** A legionary's shield (scutum): a curved board, its face +z, painted red with a gilt boss and edge. */
export function scutum(lod) {
  // (Enough rows and columns of vertices for its painted edge and bands to fall between them.)
  const g = new CylinderGeometry(0.6, 0.6, 1.05, lod === 0 ? 16 : 6, lod === 0 ? 14 : 4, true, -0.55, 1.1);
  g.translate(0, 0.525, -0.6);
  boxUV(g);
  const gold = lin(0xd8a84a);
  return tintGeometry(g, (x, y) => {
    const edge = Math.abs(y - 0.525) > 0.47 || Math.abs(x) > 0.29;
    // A gilt thunderbolt's arms across its face (a band either way from the boss).
    const band = Math.abs(y - 0.525) < 0.035 || (Math.abs(x) < 0.03 && Math.abs(y - 0.525) < 0.42);
    return edge || band ? gold : RED;
  });
}

/** A pilum: a wooden shaft and its long iron shank with a pyramid point, `h` long, standing on y 0. */
function pilum(h, lod, out, x, z, tilt = 0) {
  const sh = h * 0.68;
  const a = [x, 0, z];
  const b = [x + tilt * sh, sh, z];
  out.wood.push(staff(a, b, 0.016, lod ? 4 : 6));
  if (lod < 2) out.wood.push(cyl(0.026, 0.026, 0.1, lod ? 4 : 6, b[0], sh - 0.12, z, 0.7));
  const c = [x + tilt * h, h - 0.06, z];
  out.iron.push(staff(b, c, 0.006, 4));
  const tip = new ConeGeometry(0.014, 0.06, 4);
  tip.translate(c[0], h - 0.03, z);
  out.iron.push(tintGeometry(boxUV(tip), () => 0.9));
}

/** A helmet (galea): its bowl, the neck guard behind, cheek pieces, a crest knob; on a peg at (x, y, z) facing +x. */
function galea(x, y, z, lod, out) {
  const bowl = new SphereGeometry(0.12, lod ? 8 : 14, lod ? 5 : 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  bowl.translate(x, y, z);
  out.bronze.push(tintGeometry(boxUV(bowl), () => 0.95));
  if (lod === 2) return;
  const guard = box(0.06, 0.02, 0.26, x - 0.13, y - 0.02, z, 0.9);
  guard.rotateZ(0);
  out.bronze.push(guard);
  for (const s of [-1, 1]) out.bronze.push(box(0.08, 0.11, 0.012, x + 0.03, y - 0.12, z + s * 0.11, 0.85));
  out.bronze.push(cyl(0.015, 0.02, 0.04, 6, x, y + 0.11, z, 1));
}

/**
 * A set of arms as the rack holds it, in the rack place's frame (the rack
 * along z at x 0, the yard toward +x): a shield leaning against the rail,
 * two pila standing in it, a helmet on its peg, a sword hung by its belt.
 * The barracks' `more` kit 'barracks:set'.
 */
export function buildArmsSet(lod = 0) {
  const out = { wood: [], iron: [], bronze: [], paint: [], leather: [] };
  const sc = scutum(lod);
  sc.rotateX(-0.18);
  sc.rotateY(Math.PI / 2);
  sc.translate(0.24, 0.02, 0);
  out.paint.push(sc);
  if (lod < 2) {
    const boss = new SphereGeometry(0.07, lod ? 6 : 10, lod ? 4 : 6, 0, Math.PI * 2, 0, Math.PI / 2);
    boss.rotateZ(-Math.PI / 2 + 0.18);
    boss.translate(0.36, 0.54, 0);
    out.bronze.push(tintGeometry(boxUV(boss), () => 1));
  }
  pilum(2.0, lod, out, -0.04, -0.18, 0.0);
  if (lod < 2) pilum(2.0, lod, out, -0.04, 0.2, 0.0);
  galea(0.0, 1.38, 0, lod, out);
  if (lod === 0) {
    // The sword in its scabbard hung by its belt from the top rail.
    const strap = lin(0x4a3020);
    out.leather.push(tintGeometry(staff([0.05, 0.75, 0.16], [0.05, 1.28, 0.16], 0.028, 5), () => strap));
    out.bronze.push(cyl(0.032, 0.032, 0.03, 6, 0.05, 1.28, 0.16, 0.9), cyl(0.02, 0.03, 0.06, 6, 0.05, 0.7, 0.16, 0.9));
    out.leather.push(tintGeometry(staff([0.05, 1.3, 0.16], [0.02, 1.32, 0.06], 0.01, 3), () => strap));
  }
  return finish('arms-set', out);
}

/** A sheaf of arrows in a quiver-case, as the rack holds it (the rack along x at z 0, the yard toward +z). */
export function buildArrowSheaf(lod = 0) {
  const out = { wood: [], iron: [], bronze: [], paint: [], leather: [] };
  const q = new CylinderGeometry(0.075, 0.065, 0.55, lod === 0 ? 10 : 6, 1);
  q.translate(0, 0.275 + 0.3, 0);
  out.leather.push(tintGeometry(boxUV(q), () => lin(0x6b4a2a)));
  // The shafts and their fletchings standing out of it.
  const n = lod === 0 ? 9 : lod === 1 ? 4 : 1;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const r = n === 1 ? 0 : 0.04;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    out.wood.push(staff([x, 0.6, z], [x * 1.5, 1.05, z * 1.5], 0.006, 3));
    out.paint.push(tintGeometry(box(0.014, 0.13, 0.014, x * 1.45, 0.92, z * 1.45, 1), () => lin(k % 3 ? 0xe9e2d2 : 0x8a2a1e)));
  }
  return finish('arrow-sheaf', out);
}

/** A small kit's group (TaggedParts by material). */
function finish(name, out) {
  const m = castraMaterials();
  const p = new TaggedParts(name);
  p.add('wood', m.wood, out.wood);
  p.add('iron', m.iron, out.iron);
  p.add('bronze', m.bronze, out.bronze);
  p.add('paint', m.paint, out.paint);
  p.add('leather', material('strap-leather', { color: 0xffffff, roughness: 0.7, vertexColors: true, snow: 0.5 }), out.leather);
  return p.build();
}

/** The matrices of the places: the arms rack's (the rack's frame turned so its yard faces +x) and the arrows'. */
export const ARMS_MATS = Object.freeze(B.armsZ.map((z) => new Matrix4().makeTranslation(B.armsX + 0.05, 0.03, z)));
export const ARROW_MATS = Object.freeze(B.arrowsX.map((x) => new Matrix4().makeTranslation(x, 0.03, B.arrowsZ)));
/** A horse at the line: facing the rail (+x). */
export const HORSE_MATS = Object.freeze(B.horses.map(([x, z]) => new Matrix4().makeRotationY(Math.PI / 2).setPosition(x, 0.03, z)));

/** The armoury: plastered walls on a footing, tiled gable along z, two doors to the yard (open or shut). */
function armoury(lod, seed, out) {
  const [x0, x1, z0, z1, eave] = B.armoury;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const t = 0.22;
  out.stone.push(box(x1 - x0 + 0.06, 0.3, z1 - z0 + 0.06, cx, 0, cz, 0.72));
  // Walls; the yard's in pieces round the doors.
  const doors = [-3.6, 0.8];
  const dw = 1.1;
  const dh = 1.55;
  out.plaster.push(box(t, eave - 0.3, z1 - z0, x0 + t / 2, 0.3, cz, 0.88));
  for (const z of [z0 + t / 2, z1 - t / 2]) out.plaster.push(box(x1 - x0 - 2 * t, eave - 0.3, t, cx, 0.3, z, 0.88));
  let zz = z0;
  for (const dz of doors) {
    out.plaster.push(box(t, eave - 0.3, dz - dw / 2 - zz, x1 - t / 2, 0.3, (zz + dz - dw / 2) / 2, 0.9));
    out.plaster.push(box(t, eave - 0.3 - dh, dw, x1 - t / 2, 0.3 + dh, dz, 0.9));
    zz = dz + dw / 2;
  }
  out.plaster.push(box(t, eave - 0.3, z1 - zz, x1 - t / 2, 0.3, (zz + z1) / 2, 0.9));
  // A red dado along the yard's face.
  out.red.push(box(0.01, 0.6, z1 - z0 - 0.04, x1 + 0.004, 0.3, cz, 0.92));
  for (const dz of doors) {
    out.dark.push(box(0.02, dh, dw, x1 - t - 0.01, 0.3, dz));
    out.stone.push(box(0.3, 0.12, dw + 0.24, x1 - t / 2, 0.3 + dh, dz, 0.9));
    // The doors: two leaves, swung in against the reveals when open, shut across.
    for (const s of [-1, 1]) {
      const shut = box(0.06, dh - 0.02, dw / 2 - 0.01, x1 - t / 2, 0.3, dz + s * dw / 4, 0.68);
      out.doorShut.push(shut);
      const open = box(dw / 2 - 0.01, dh - 0.02, 0.06, x1 - t - (dw / 4), 0.3, dz + s * (dw / 2 - 0.04), 0.68);
      out.doorOpen.push(open);
    }
  }
  const roof = gableRoof({ x0, x1, z0, z1, eaveY: eave, pitch: D(24), along: 'z', lod, seed: seed + 3, over: 0.3, gableOver: 0.16 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood.slice(0, 6));
  for (const g of roof.wood.slice(6)) g.dispose();
  for (const z of [z0 + 0.05, z1 - 0.05]) {
    const g = box(x1 - x0 - 0.02, 1, 0.1, cx, 0, z, 0.88);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? eave + (roof.ridgeY - eave) * (1 - Math.abs(p.getX(i) - cx) / ((x1 - x0) / 2)) : eave);
    g.computeVertexNormals();
    out.plaster.push(g);
  }
  // The arms rack before it: posts, two rails, eight pegs on the top rail.
  const rx = B.armsX;
  const za = B.armsZ[0] - 0.4;
  const zb = B.armsZ[B.armsZ.length - 1] + 0.4;
  for (const z of [za, (za + zb) / 2, zb]) out.wood.push(box(0.09, 1.3, 0.09, rx, 0, z, 0.78));
  out.wood.push(box(0.08, 0.08, zb - za, rx, 1.22, (za + zb) / 2, 0.8));
  out.wood.push(box(0.1, 0.1, zb - za, rx + 0.04, 0.42, (za + zb) / 2, 0.8));
  // A plank with holes for the pila's feet.
  out.wood.push(box(0.2, 0.05, zb - za, rx - 0.02, 0.03, (za + zb) / 2, 0.7));
  if (lod < 2) for (const z of B.armsZ) out.wood.push(box(0.03, 0.03, 0.03, rx, 1.32, z, 0.7));
}

/** The office along the back: plastered, its veranda on posts, the clerk's table, the measuring rod. */
function office(lod, seed, out) {
  const [x0, x1, z0, z1, eave, vz] = B.office;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const t = 0.22;
  out.stone.push(box(x1 - x0 + 0.06, 0.25, z1 - z0 + 0.06, cx, 0, cz, 0.72));
  out.plaster.push(box(x1 - x0, eave - 0.25, z1 - z0, cx, 0.25, cz, (x, y) => 0.84 + 0.16 * Math.min(1, (y - 0.25) / 0.6)));
  out.red.push(box(x1 - x0 - 0.04, 0.55, 0.01, cx, 0.25, z1 + 0.004, 0.92));
  // Doors and windows along the front.
  for (const [x, w, h, y] of [[-2.3, 0.8, 1.3, 0.25], [0.6, 0.8, 1.3, 0.25], [3.6, 0.8, 1.3, 0.25], [-1.0, 0.4, 0.34, 1.0], [2.1, 0.4, 0.34, 1.0], [4.9, 0.4, 0.34, 1.0]]) {
    out.dark.push(box(w, h, 0.02, x, y, z1 + 0.008));
    out.wood.push(box(w + 0.12, 0.07, 0.04, x, y + h, z1 + 0.02, 0.8));
  }
  const roof = gableRoof({ x0, x1, z0, z1, eaveY: eave, pitch: D(24), along: 'x', lod, seed: seed + 3, over: 0.25, gableOver: 0.16 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood.slice(0, 6));
  for (const g of roof.wood.slice(6)) g.dispose();
  for (const x of [x0 + 0.05, x1 - 0.05]) {
    const g = box(0.1, 1, z1 - z0 - 0.02, x, 0, cz, 0.88);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? eave + (roof.ridgeY - eave) * (1 - Math.abs(p.getZ(i) - cz) / ((z1 - z0) / 2)) : eave);
    g.computeVertexNormals();
    out.plaster.push(g);
  }
  // The veranda: a lean-to of tiles from the wall over posts.
  const span = vz - z1;
  const r = leanTo({ L: x1 - x0 - 0.1, span, topY: eave - 0.12, eaveY: 1.62, lod, seed: seed + 7, over: 0.15 });
  for (const g of [...r.tile, ...r.wood]) g.translate(cx, 0, z1);
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  const np = 6;
  for (let k = 0; k < np; k++) {
    const x = x0 + 0.2 + (k * (x1 - x0 - 0.4)) / (np - 1);
    out.wood.push(box(0.11, 1.6, 0.11, x, 0, vz - 0.06, (gx, gy) => 0.7 + 0.3 * Math.min(1, gy / 0.5)));
  }
  out.wood.push(box(x1 - x0 - 0.1, 0.11, 0.12, cx, 1.52, vz - 0.06, 0.78));
  // Flags under the veranda.
  out.flags.push(box(x1 - x0 - 0.1, 0.05, span, cx, 0, z1 + span / 2, 0.85));
  // The clerk's table and stool, a tablet and a box of rolls on it; the measuring rod by the wall.
  const tx = 0.6;
  const tz = z1 + 0.5;
  out.wood.push(slab(1.0, 0.05, 0.5, { bevel: 0.01, seed: seed + 20, wobble: 0.002, tone: 0.05, grime: 0 }).translate(tx, 0.72, tz));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.wood.push(box(0.05, 0.72, 0.05, tx + sx * 0.44, 0, tz + sz * 0.19, 0.7));
  if (lod < 2) {
    out.wood.push(box(0.3, 0.12, 0.2, tx + 0.28, 0.77, tz - 0.05, 0.62));
    out.paint.push(tintGeometry(box(0.22, 0.012, 0.16, tx - 0.15, 0.77, tz + 0.05, 1), () => lin(0x3a2a1c)));
    // The rod: a post with a sliding arm at five feet ten (the height the writers ask of a recruit).
    out.wood.push(box(0.08, 2.0, 0.08, tx - 1.1, 0, z1 + 0.15, 0.75));
    out.wood.push(box(0.36, 0.04, 0.06, tx - 0.95, 1.73, z1 + 0.15, 0.75));
    if (lod === 0) for (let k = 1; k < 7; k++) out.dark.push(box(0.003, 0.012, 0.085, tx - 1.06, k * 0.296, z1 + 0.15));
  }
}

/** The low wall round the yard: the right side and the front, the gate's piers; a coping of tiles. */
function enclosure(lod, seed, out) {
  const h = 0.9;
  const t = 0.26;
  const e = 5.85;
  const runs = [[[-3.65, -1.25], 'front'], [[1.25, e], 'front'], [[-4.12, e], 'right']];
  for (const [[a, b], side] of runs) {
    const g = side === 'front' ? box(b - a, h, t, (a + b) / 2, 0, e - t / 2, (x, y) => 0.8 + 0.2 * Math.min(1, y / 0.5)) : box(t, h, b - a, e - t / 2, 0, (a + b) / 2, (x, y) => 0.8 + 0.2 * Math.min(1, y / 0.5));
    out.plaster.push(g);
    out.tile.push(side === 'front' ? box(b - a, 0.06, t + 0.08, (a + b) / 2, h, e - t / 2, 0.9) : box(t + 0.08, 0.06, b - a, e - t / 2, h, (a + b) / 2, 0.9));
  }
  // The gate's piers, capped, and its leaves (open or shut).
  for (const s of [-1, 1]) {
    out.ashlar.push(box(0.4, 1.45, 0.4, s * 1.45, 0, e - 0.2, 0.9));
    out.stone.push(slab(0.5, 0.1, 0.5, { bevel: 0.015, seed: seed + s, wobble: 0, tone: 0, grime: 0 }).translate(s * 1.45, 1.45, e - 0.2));
    out.doorShut.push(box(1.22, 1.1, 0.05, s * 0.63, 0.03, e - 0.22, 0.72));
    const open = box(0.05, 1.1, 1.22, s * 1.2, 0.03, e - 0.22 - 0.63, 0.72);
    out.doorOpen.push(open);
  }
}

/** Build the barracks: { group, meshes, triangles }; meshes tagged in userData.when. */
export function buildBarracks({ lod = 0, seed = 171 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['gravel', 'flags', 'ashlar', 'stone', 'tile', 'wood', 'plaster', 'red', 'dark', 'iron', 'bronze', 'paint', 'wicker', 'doorOpen', 'doorShut'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  // The sanded drill yard.
  out.gravel.push(box(11.7, 0.03, 11.7, 0, 0, 0, (x, y, z) => 0.85 + 0.15 * Math.cos(x * 0.7) * Math.cos(z * 0.6)));
  armoury(lod, seed, out);
  office(lod, seed + 20, out);
  enclosure(lod, seed + 40, out);
  for (const [x, z] of B.pali) palus(x, z, lod, out);
  // The horse line: a rail on posts, a trough beyond it.
  const hx = 5.05;
  const za = B.horses[0][1] - 0.7;
  const zb = B.horses[B.horses.length - 1][1] + 0.7;
  for (const z of [za, (za + zb) / 2, zb]) out.wood.push(box(0.1, 1.1, 0.1, hx, 0, z, 0.78));
  out.wood.push(box(0.08, 0.08, zb - za, hx, 1.0, (za + zb) / 2, 0.8));
  out.wood.push(box(0.36, 0.38, zb - za - 0.3, hx + 0.32, 0, (za + zb) / 2, 0.7));
  out.dark.push(box(0.26, 0.01, zb - za - 0.4, hx + 0.32, 0.36, (za + zb) / 2));
  // The arrows' rack: a long low box of slots along the veranda's front.
  const ax0 = B.arrowsX[0] - 0.35;
  const ax1 = B.arrowsX[B.arrowsX.length - 1] + 0.35;
  out.wood.push(box(ax1 - ax0, 0.28, 0.3, (ax0 + ax1) / 2, 0.03, B.arrowsZ, 0.72));
  out.wood.push(box(ax1 - ax0, 0.05, 0.05, (ax0 + ax1) / 2, 0.9, B.arrowsZ - 0.12, 0.78));
  for (const x of [ax0 + 0.03, ax1 - 0.03]) out.wood.push(box(0.05, 0.95, 0.05, x, 0, B.arrowsZ - 0.12, 0.75));
  // Wicker shields and wooden swords by the posts, for the drill.
  if (lod < 2) {
    for (const [x, z] of [[0.5, 1.6], [0.75, 1.62], [1.0, 1.64]]) {
      const w = wickerShield(lod);
      w.rotateX(-0.2);
      w.translate(x, 0.03, z);
      out.wicker.push(w);
      out.wood.push(staff([x + 0.12, 0.03, z + 0.2], [x + 0.06, 0.7, z + 0.02], 0.02, 4));
    }
  }
  // The flag on its pole by the office.
  const std = { wood: [], gilt: [], silver: [], cloth: [], iron: [], bronze: [], rope: [] };
  vexillum(4.9, B.office[5] + 0.45, 2.55, lod, std, RED);
  const m = castraMaterials();
  if (lod === 2) out.iron = out.bronze = [];
  const p = new TaggedParts('tirocinium');
  p.add('yard', m.gravel, out.gravel, { cast: false });
  p.add('flags', m.flags, out.flags, { cast: false });
  p.add('ashlar', m.ashlar, out.ashlar);
  p.add('stone', m.stone, out.stone);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, [...out.wood, ...std.wood]);
  p.add('walls', m.plaster, out.plaster);
  p.add('dado', m.red, out.red, { cast: false });
  p.add('inside', m.dark, out.dark, { cast: false });
  p.add('iron', m.iron, [...out.iron, ...(lod < 2 ? std.iron : [])]);
  p.add('bronze', m.bronze, out.bronze);
  p.add('paint', m.paint, out.paint);
  p.add('wicker', material('wicker', { surface: 'wicker', vertexColors: true, snow: 0.8 }), out.wicker);
  p.add('cloth', m.cloth, std.cloth);
  p.add('gilt', m.gilt, std.gilt);
  p.add('doors', m.wood, out.doorOpen, { when: 'staffed' });
  p.add('doors', m.wood, out.doorShut, { when: 'shut' });
  if (lod < 2) {
    for (const [lx, ly, lz] of B.lamps) {
      const l = lantern(lx, ly, lz, lod);
      p.add('bronze', m.bronze, l.bronze);
      p.add('lamp', lanternPane(), [l.pane], { when: 'staffed', cast: false });
      p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
    }
  }
  // People: the clerk at his table while staffed; a recruit at the first post and his instructor while one trains.
  if (lod === 0) {
    const tz = B.office[3] + 0.5;
    const clerk = figureParts({ cloth: 0xd8ccb0, cloth2: 0x7a5a3a }, 0.6, 0.03, tz - 0.42, 0);
    for (const f of clerk) p.add(`clerk-${f.material.name}`, f.material, [f.g], { when: 'staffed' });
    const [px, pz] = B.pali[0];
    const recruit = figureParts({ cloth: 0xcfc3a8, reach: 1 }, px - 0.1, 0.03, pz + 0.62, Math.PI + 0.15);
    for (const f of recruit) p.add(`recruit-${f.material.name}`, f.material, [f.g], { when: 'out' });
    // His wicker shield on his left arm, his wooden sword raised.
    const ws = wickerShield(1);
    ws.scale(0.85, 0.85, 0.85);
    ws.rotateY(Math.PI + 0.15);
    ws.translate(px + 0.18, 0.45, pz + 0.46);
    p.add('recruit-wicker', material('wicker', { surface: 'wicker', vertexColors: true, snow: 0.8 }), [ws], { when: 'out' });
    p.add('recruit-sword', m.wood, [staff([px - 0.32, 1.25, pz + 0.38], [px - 0.2, 1.55, pz + 0.05], 0.025, 4)], { when: 'out' });
    const doctor = figureParts({ cloth: 0xa8322b, cloth2: 0x7a6248 }, px + 1.1, 0.03, pz + 1.15, -Math.PI * 0.75);
    for (const f of doctor) p.add(`doctor-${f.material.name}`, f.material, [f.g], { when: 'out' });
    p.add('doctor-vitis', m.wood, [staff([px + 0.82, 0.03, pz + 1.0], [px + 0.86, 1.0, pz + 0.95], 0.016, 4)], { when: 'out' });
  }
  return p.build();
}
