/**
 * models/valetudinarium.js
 * ----------------------------------------------------------------------------
 * The hospital of the 3D look: a valetudinarium on a 3 x 3 footprint (12 m),
 * from the record rather than from the 2D sprite:
 *
 *   - Rome's hospitals were the army's: the legionary fortresses' at
 *     Inchtuthil, Novaesium (Neuss), Vetera (Xanten), Carnuntum, the
 *     auxiliary forts' smaller ones (Housesteads). Their plan is the same
 *     everywhere: ranges of small wards round a court, each ward (for four
 *     or five beds) opening off a corridor that ran round the court, so the
 *     sick lay away from the noise; an entrance hall at the front and, at
 *     the back or across the court from it, a larger hall (taken for the
 *     operating theatre or the reception of the wounded). Pseudo-Hyginus
 *     sets the hospital apart, quiet; Celsus and Scribonius Largus write of
 *     the surgeon's work; instruments, probes and a surgeon's tools were
 *     found at Neuss, with the seeds of medicinal plants (fenugreek,
 *     henbane, centaury, plantain) from its court's garden.
 *   - Towns had no public hospitals before the Christian xenodochia; this
 *     is the soldiers' plan adapted to a town, as the game asks: the wards
 *     as the military ones, the court a garden of herbs, the gate to the
 *     street, the god of healing (Asclepius, and Hygieia, health) at an
 *     altar in the court, as at the forts.
 *
 * So, in 12 m: ranges of wards on three sides under low tiled roofs, white
 * plaster on a red socle, a covered corridor round the court on columns
 * stuccoed red and white, a ward's door every two metres, a bed in each
 * where it can be seen through the door; at the back, the taller operating
 * hall under its own gable with a round window in the pediment, its wide
 * door open on the surgeon at work; the court a garden of raised herb beds
 * on gravel walks round a well-head, a couch in the sun, a bench, the altar
 * with its serpent staff; a low wall to the street, the gate between piers
 * under VALETVDINARIVM, lanterns.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the sick in their beds and in the court, the orderlies,
 *           the doctor among his herbs, the surgeon in the hall, the doors
 *           open, the lanterns lit at night
 *   'shut'  no staff: the doors shut, the beds empty, nobody
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z,
 * as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, BoxGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, tuscanColumn, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin, gableRoof, D } from './rural.js';
import { staff, inscribe, people, mirrorX } from './castra.js';
import { person, box } from './learning.js';
import { healthMaterials, lectus, abed, sleeper, herbBed, asclepius, basinStand, table, potRow } from './healing.js';

/** The hospital's measures (metres): the tests, the lab and the game read them. */
export const VALETUDINARIUM = Object.freeze({
  half: 6,
  /** The ranges: the outer walls' faces (|x| and the back's z), the wards' inner wall (the corridor's back), the corridor's columns. */
  outer: 5.93,
  wards: 3.95,
  columns: 3.0,
  /** The side ranges' front end (z); the eaves' height; the floors'. */
  front: 4.6,
  eave: 2.35,
  floorY: 0.15,
  /** The operating hall: its half width (x), its front (z), its eaves. */
  hall: Object.freeze({ x: 1.7, z: -3.0, eave: 3.2 }),
  /** The wards' doors along the side ranges (z), and the back range's (x, each side of the hall). */
  sideDoors: Object.freeze([-3.05, -1.25, 0.55, 2.35]),
  backDoor: 2.8,
  /** The gate in the street wall: its opening (|x|), its piers' height. */
  gate: 0.8,
  gateH: 2.45,
  /** The lanterns: on the gate's piers, and one hung by the hall's door (x, y, z), facing the street. */
  lamps: Object.freeze([Object.freeze([-1.08, 2.53, 5.73]), Object.freeze([1.08, 2.53, 5.73]), Object.freeze([1.16, 2.02, -2.8])]),
});

const V = VALETUDINARIUM;
const RED = lin(0xa83a26);
const T = 0.26; // the walls' thickness

/** Paint the lower part (under y) of a column red, as Pompeii's stuccoed columns. */
function redBelow(geos, y) {
  for (const g of geos) {
    const c = g.attributes.color;
    const p = g.attributes.position;
    for (let i = 0; i < c.count; i++) if (p.getY(i) < y) c.setXYZ(i, c.getX(i) * RED[0] * 1.6, c.getY(i) * RED[1] * 1.6, c.getZ(i) * RED[2] * 1.6);
  }
  return geos;
}

/** A gable end wall over w (x0..x1) at z, `t` thick, from eave up to the ridge at its middle. */
function gableWall(x0, x1, z, eave, ridge, t = T) {
  const half = (x1 - x0) / 2;
  const mid = (x0 + x1) / 2;
  const g = new BoxGeometry(x1 - x0, 1, t, 2, 1, 1);
  g.translate(mid, 0.5, z);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? eave + (ridge - eave) * Math.max(0, 1 - Math.abs(p.getX(i) - mid) / half) - 0.04 : eave - 0.02);
  g.computeVertexNormals();
  return tintGeometry(boxUV(g), () => 0.93);
}

/**
 * A range's gable roof without its rafters' ends: a hundred bevelled ends
 * along the three ranges were a fifth of the hospital's triangles, and from
 * the game's camera an eave's shadow says as much. The hall keeps its own.
 */
function rangeRoof(opts) {
  const roof = gableRoof(opts);
  roof.wood = roof.wood.filter((g) => {
    g.computeBoundingBox();
    const s = g.boundingBox.getSize(g.boundingBox.min.clone());
    return Math.max(s.x, s.y, s.z) > 0.6;
  });
  return roof;
}

/** The lists a range is built into (the left one, then mirrored for the right). */
function bag() {
  const keys = ['plaster', 'red', 'floor', 'trav', 'tile', 'wood', 'dark', 'shelter', 'linen', 'doorOpen', 'doorShut'];
  return Object.fromEntries(keys.map((k) => [k, []]));
}

/** Push bag `from` into `to`. */
function pour(from, to) {
  for (const [k, list] of Object.entries(from)) to[k].push(...list);
}

/** A door in a wall along z at x (its face toward +x): its dark, its frame, its leaf open (swung in) or shut. */
function doorAlongZ(x, z, w, h, y0, out) {
  out.dark.push(box(0.02, h, w, x - T + 0.03, y0, z));
  for (const s of [-1, 1]) out.trav.push(slab(T + 0.04, h, 0.1, { bevel: 0.008, seed: Math.round(z * 31 + s), wobble: 0, tone: 0.04, grime: 0.2 }).translate(x - T / 2, y0, z + s * (w / 2 + 0.05)));
  out.trav.push(slab(T + 0.06, 0.12, w + 0.3, { bevel: 0.01, seed: Math.round(z * 17), wobble: 0, tone: 0.04, grime: 0 }).translate(x - T / 2, y0 + h, z));
  const shut = box(0.05, h - 0.02, w - 0.02, x - T + 0.06, y0, z, 0.72);
  out.doorShut.push(shut);
  const open = box(w - 0.02, h - 0.02, 0.05, 0, 0, 0, 0.72);
  // (Swung in against the ward's wall, hinged at its -z jamb.)
  open.translate(-(w - 0.02) / 2, y0, 0);
  open.translate(x - T + 0.03, 0, z - w / 2 + 0.04);
  out.doorOpen.push(open);
}

/**
 * The left range (x < 0): its outer wall with high windows, the wards' wall
 * with their doors, partitions, the floor, the corridor's columns, the
 * front gable, the roof; a bed in each ward under its window, opposite its
 * door. Returns the bag and the beds' places ([x, z] each, along z).
 */
function sideRange(lod, seed) {
  const out = bag();
  const xo = -V.outer;
  const xw = -V.wards;
  const xc = -V.columns;
  const zf = V.front;
  const zb = -V.wards;
  const E = V.eave;
  const fy = V.floorY;
  // The floor of the wards and the corridor, the corridor's edge of travertine.
  out.floor.push(box(xc - xo + 0.14, fy, zf - zb - T, (xo + xc + 0.14) / 2, 0, (zb + zf - T) / 2, 0.95));
  out.trav.push(slab(0.36, fy + 0.01, zf - zb, { bevel: 0.012, seed, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(xc + 0.05, 0, (zb + zf) / 2));
  // The outer wall (high windows, for air and light: dark slits under the eave), a red socle.
  const wins = lod < 2 ? V.sideDoors : [];
  let z = zb;
  for (const wz of wins) {
    out.plaster.push(box(T, E - 0.12, wz - 0.22 - z, xo + T / 2, 0, (z + wz - 0.22) / 2, 0.93));
    out.plaster.push(box(T, 1.65, 0.44, xo + T / 2, 0, wz, 0.93), box(T, E - 0.12 - 2.05, 0.44, xo + T / 2, 2.05, wz, 0.93));
    out.dark.push(box(0.02, 0.4, 0.44, xo + 0.06, 1.65, wz));
    out.trav.push(slab(0.1, 0.05, 0.56, { bevel: 0.008, seed: Math.round(wz * 13), wobble: 0, tone: 0.03, grime: 0 }).translate(xo + 0.0, 1.6, wz));
    z = wz + 0.22;
  }
  out.plaster.push(box(T, E - 0.12, zf - z, xo + T / 2, 0, (z + zf) / 2, 0.93));
  out.red.push(box(0.012, 0.7, zf - zb + 0.0, xo - 0.006, 0, (zb + zf) / 2, 1));
  // The wards' wall to the corridor, its doors; the partitions between the wards.
  const h = 2.0;
  let a = zb;
  for (const dz of V.sideDoors) {
    out.plaster.push(box(T, E + 0.2, dz - 0.5 - a, xw - T / 2, 0, (a + dz - 0.5) / 2, 0.93));
    out.plaster.push(box(T, E + 0.2 - h - fy, 1.0, xw - T / 2, fy + h, dz, 0.93));
    doorAlongZ(xw, dz, 0.96, h, fy, out);
    a = dz + 0.5;
  }
  out.plaster.push(box(T, E + 0.2, zf - T - a, xw - T / 2, 0, (a + zf - T) / 2, 0.93));
  out.red.push(box(0.012, 0.85, zf - zb - T, xw + 0.006, fy, (zb + zf - T) / 2, 0.95));
  for (const pz of [-2.15, -0.35, 1.45, 3.25]) out.plaster.push(box(xw - xo - 2 * T + 0.02, E, 0.14, (xo + xw) / 2, 0, pz, 0.9));
  // The corridor's columns, the beam on them.
  const colH = E - 0.2 - fy;
  const zs = lod === 2 ? [-1.5, 1.5, 4.2] : [-1.5, 0.0, 1.5, 3.0, 4.35];
  for (const cz of zs) for (const g of redBelow(tuscanColumn(0.12, colH, lod), 0.75)) out.plaster.push(g.translate(xc, fy, cz));
  out.wood.push(box(0.2, 0.2, zf - zb + 0.95, xc, E - 0.2, (zb - 0.95 + zf) / 2, 0.85));
  // The front end: a gable wall across the range, a window in it.
  out.plaster.push(box(xc - xo + 0.1, E, T, (xo + xc + 0.1) / 2, 0, zf - T / 2, 0.93));
  const roofX0 = xo + 0.23;
  const roofX1 = xc + 0.15;
  const roof = rangeRoof({ x0: roofX0, x1: roofX1, z0: -4.4, z1: zf, eaveY: E, pitch: D(22), along: 'z', lod, seed: seed + 9, over: 0.25, gableOver: 0.18 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  out.plaster.push(gableWall(roofX0 - 0.23, roofX1 + 0.1, zf - T / 2, E, roof.ridgeY));
  if (lod < 2) {
    // A window in the gable end: its dark on the wall's face, a sill of travertine, a wooden frame, two bars.
    const wx = (xo + xw) / 2;
    out.dark.push(box(0.5, 0.36, 0.006, wx, 1.5, zf + 0.004));
    out.trav.push(slab(0.66, 0.05, 0.12, { bevel: 0.008, seed: seed + 17, wobble: 0, tone: 0.03, grime: 0 }).translate(wx, 1.45, zf + 0.02));
    for (const [w, h, x, y] of [[0.58, 0.04, wx, 1.86], [0.04, 0.36, wx - 0.27, 1.5], [0.04, 0.36, wx + 0.27, 1.5]]) out.wood.push(box(w, h, 0.05, x, y, zf + 0.0, 0.6));
    if (lod === 0) for (const dx of [-0.09, 0.09]) out.wood.push(box(0.02, 0.36, 0.02, wx + dx, 1.5, zf + 0.02, 0.4));
  }
  // The beds, one in each ward, along its outer wall.
  const beds = V.sideDoors.map((dz) => [xo + T + 0.45, dz]);
  return { out, beds };
}

/** The back range: the outer wall, the wards each side of the hall with their doors and beds, the corridor, the roofs. */
function backRange(lod, seed, out) {
  const zo = -V.outer;
  const zw = -V.wards;
  const zc = -V.columns;
  const E = V.eave;
  const fy = V.floorY;
  const hx = V.hall.x;
  const xo = V.outer;
  for (const s of [-1, 1]) {
    // From the corner to the hall: the floor, the outer wall, the wards' wall with a door, the corridor's columns.
    const xa = s < 0 ? -xo : hx;
    const xb = s < 0 ? -hx : xo;
    const mid = (xa + xb) / 2;
    out.floor.push(box(xb - xa, fy, zc - zo, mid, 0, (zo + zc) / 2, 0.95));
    out.trav.push(slab(V.wards - hx, fy + 0.01, 0.36, { bevel: 0.012, seed: seed + s, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(s * (V.wards + hx) / 2, 0, zc + 0.05));
    out.plaster.push(box(xb - xa, E - 0.12, T, mid, 0, zo + T / 2, 0.93));
    out.red.push(box(xb - xa, 0.7, 0.012, mid, 0, zo - 0.006, 1));
    // (The corner room behind the side range's first ward is shut off: no door.)
    const dx = s * V.backDoor;
    const w0 = s < 0 ? -V.wards : hx;
    const w1 = s < 0 ? -hx : V.wards;
    const cornerA = s < 0 ? -xo + T : V.wards;
    const cornerB = s < 0 ? -V.wards : xo - T;
    out.plaster.push(box(cornerB - cornerA, E + 0.2, T, (cornerA + cornerB) / 2, 0, zw - T / 2, 0.93));
    for (const [a, b] of [[w0, dx - 0.5], [dx + 0.5, w1]]) out.plaster.push(box(b - a, E + 0.2, T, (a + b) / 2, 0, zw - T / 2, 0.93));
    out.plaster.push(box(1.0, E + 0.2 - 2.0 - fy, T, dx, fy + 2.0, zw - T / 2, 0.93));
    out.red.push(box(w1 - w0, 0.85, 0.012, (w0 + w1) / 2, fy, zw + 0.006, 0.95));
    // Its door: dark within, the frame, the leaf open or shut (built along z and turned to face +z).
    const d = { dark: [], trav: [], doorShut: [], doorOpen: [] };
    doorAlongZ(0, 0, 0.96, 2.0, fy, d);
    for (const [k, list] of Object.entries(d)) {
      for (const g of list) {
        g.rotateY(-Math.PI / 2);
        g.translate(dx, 0, zw);
        out[k].push(g);
      }
    }
    // The partition between the corner room and the ward.
    out.plaster.push(box(T, E, zw - zo - T, s * V.wards - s * T / 2, 0, (zo + T + zw) / 2, 0.9));
    // The corridor's columns.
    for (const x of lod === 2 ? [s * 2.4] : [s * 2.35]) for (const g of redBelow(tuscanColumn(0.12, E - 0.2 - fy, lod), 0.75)) out.plaster.push(g.translate(x, fy, zc));
    for (const g of redBelow(tuscanColumn(0.12, E - 0.2 - fy, lod), 0.75)) out.plaster.push(g.translate(s * V.columns, fy, zc));
    out.wood.push(box(V.columns - hx + 0.2, 0.2, 0.2, s * (V.columns + hx) / 2, E - 0.2, zc, 0.85));
    // Its roof: a gable along x from the corner to the hall's wall (its end hidden in the hall's).
    const roof = rangeRoof({ x0: s < 0 ? -xo + 0.25 : hx - 0.1, x1: s < 0 ? -hx + 0.1 : xo - 0.25, z0: zo + 0.23, z1: zc + 0.15, eaveY: E, pitch: D(22), along: 'x', lod, seed: seed + 5 + s, over: 0.25, gableOver: 0.22 });
    out.tile.push(...roof.tile);
    out.wood.push(...roof.wood);
    // The outer gable at the corner.
    const gw = gableWall(zo + 0.0, zc + 0.4, 0, E, roof.ridgeY);
    // (Built along x: a quarter turn the other way brings x onto z, the back's -z.)
    gw.rotateY(-Math.PI / 2);
    gw.translate(s * (xo - T / 2), 0, 0);
    out.plaster.push(gw);
  }
}

/** The operating hall at the back: its walls, its wide door, the gable and pediment, inside the table and the instruments. */
function hall(lod, seed, out) {
  const { x: hx, z: zf, eave } = V.hall;
  const zo = -V.outer;
  const fy = V.floorY;
  out.floor.push(box(2 * hx, fy, zf - zo, 0, 0, (zo + zf) / 2, 0.95));
  // The walls: the sides and back to its eaves, white with a red socle; the front with the wide door.
  for (const s of [-1, 1]) {
    out.plaster.push(box(T, eave, zf - zo, s * (hx - T / 2), 0, (zo + zf) / 2, 0.93));
    out.redIn.push(box(0.012, 1.0, zf - zo - 2 * T, s * (hx - T - 0.006), fy, (zo + zf) / 2, 0.95));
  }
  out.plaster.push(box(2 * hx - 2 * T, eave, T, 0, 0, zo + T / 2, 0.93));
  out.redIn.push(box(2 * hx - 2 * T, 1.0, 0.012, 0, fy, zo + T + 0.006, 0.95));
  const dw = 1.7;
  const dh = 2.5;
  for (const s of [-1, 1]) out.plaster.push(box(hx - dw / 2, eave, T, s * (hx + dw / 2) / 2, 0, zf - T / 2, 0.93));
  out.plaster.push(box(dw, eave - dh - fy, T, 0, fy + dh, zf - T / 2, 0.93));
  out.dark.push(box(dw - 0.04, 0.01, 0.01, 0, fy + dh - 0.01, zf - T + 0.01));
  for (const s of [-1, 1]) out.trav.push(slab(0.12, dh + 0.02, T + 0.06, { bevel: 0.01, seed: seed + s, wobble: 0.002, tone: 0.04, grime: 0.25 }).translate(s * (dw / 2 + 0.06), fy, zf - T / 2));
  out.trav.push(slab(dw + 0.44, 0.16, T + 0.08, { bevel: 0.012, seed: seed + 3, wobble: 0, tone: 0.04, grime: 0 }).translate(0, fy + dh, zf - T / 2));
  out.trav.push(slab(dw + 0.5, fy, 0.5, { bevel: 0.015, seed: seed + 4, wobble: 0.003, tone: 0.05, grime: 0.3 }).translate(0, 0, zf + 0.22));
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = box(dw / 2 - 0.01, dh - 0.02, 0.05, -s * (dw / 4), 0, 0, 0.72);
      leaf.rotateY(open ? -s * 1.62 : 0);
      leaf.translate(s * dw / 2, fy, zf - T + 0.05);
      (open ? out.doorOpen : out.doorShut).push(leaf);
    }
  }
  // The roof: a gable, its ridge running back, the pediment over the door; a round window in it.
  const roof = gableRoof({ x0: -hx, x1: hx, z0: zo + 0.25, z1: zf, eaveY: eave, pitch: D(24), along: 'z', lod, seed: seed + 9, over: 0.18, gableOver: 0.24 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  for (const zz of [zf - T / 2, zo + T / 2]) out.plaster.push(gableWall(-hx, hx, zz, eave, roof.ridgeY));
  if (lod < 2) {
    out.trav.push(slab(2 * hx + 0.1, 0.08, 0.16, { bevel: 0.01, seed: seed + 12, wobble: 0, tone: 0, grime: 0 }).translate(0, eave - 0.02, zf + 0.04));
    const c = new CylinderGeometry(0.2, 0.2, 0.04, lod ? 12 : 24, 1);
    c.rotateX(Math.PI / 2);
    c.translate(0, eave + 0.36, zf + 0.01);
    out.dark.push(tintGeometry(boxUV(c)));
    // (Crossed bronze bars in it, close up.)
    if (lod === 0) for (const a of [0, Math.PI / 2]) out.bronze.push(box(0.4, 0.025, 0.025, 0, 0, 0, 0.8).translate(0, -0.0125, 0).rotateZ(a).translate(0, eave + 0.36, zf + 0.03));
    const ring = new CylinderGeometry(0.25, 0.25, 0.05, lod ? 12 : 24, 1, true);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, eave + 0.36, zf + 0.02);
    out.trav.push(tintGeometry(boxUV(ring), () => 0.9));
  }
  // Inside: the operating table, a stone slab on two piers; a side table of instruments and dressings, a shelf of pots.
  if (lod < 2) {
    out.marble.push(slab(1.9, 0.08, 0.72, { bevel: 0.012, seed: seed + 20, wobble: 0, tone: 0.03, grime: 0 }).translate(0, fy + 0.72, -4.25));
    for (const s of [-1, 1]) out.marble.push(slab(0.3, 0.72, 0.5, { bevel: 0.01, seed: seed + 21 + s, wobble: 0.002, tone: 0.03, grime: 0.3 }).translate(s * 0.65, fy, -4.25));
    out.shelter.push(...table(-0.95, zo + T + 0.4, 0.62, 1.0, 0.8, Math.PI / 2).map((g) => g.translate(0, fy, 0)));
    out.linen.push(box(0.9, 0.06, 0.5, -0.95, fy + 0.8, zo + T + 0.4, 0.95));
    out.shelter.push(box(1.0, 0.04, 0.26, 0.75, fy + 1.45, zo + T + 0.13, 0.8));
    if (lod === 0) out.pots.push(...potRow(0.28, 1.22, fy + 1.49, zo + T + 0.13, { seed: seed + 23, lod, s: 0.15 }));
  }
}

/** The court: gravel walks, herb beds, the well-head, the way from the gate, the couch, the bench, the altar. */
function court(lod, seed, out) {
  const xc = V.columns;
  const zc = -V.columns;
  const zf = V.outer - 0.24;
  // Gravel over the whole court (a shade lighter where it is walked), flags from the gate to the middle.
  out.gravel.push(box(2 * xc - 0.24, 0.03, zf - zc - 0.24, 0, 0, (zc + 0.24 + zf) / 2, (x, y, z) => 0.85 + 0.15 * Math.cos(x * 0.9) * Math.cos(z * 0.7)));
  out.gravel.push(box(V.outer * 2 - 0.5, 0.03, zf - V.front, 0, 0, (V.front + zf) / 2, 0.9));
  out.flags.push(...paving(-0.55, 0.55, 2.35, zf, 0.06, seed, { rowW: 0.55, minL: 0.5, maxL: 0.9, lod }));
  // Four raised beds of herbs round the well-head.
  const beds = [[-2.45, -0.5, -2.35, -0.55], [0.5, 2.45, -2.35, -0.55], [-2.45, -0.5, 0.45, 2.15], [0.5, 2.45, 0.45, 2.15]];
  const blooms = [0xb08ad0, 0xe8e0a0, 0xd05a4a, 0xf0f0e8];
  beds.forEach(([x0, x1, z0, z1], i) => {
    const b = herbBed(x0, x1, z0, z1, { lod, seed: seed + 10 + i, rows: 3, bloom: blooms[i] });
    out.bedWood.push(...b.wood);
    out.soil.push(...b.soil);
    out.leaf.push(...b.leaf);
    out.bloom.push(...b.bloom);
  });
  // The well-head (puteal) where the walks cross.
  const seg = lod === 2 ? 10 : lod ? 18 : 32;
  out.marble.push(revolve(profileOf([[0, 0.03], [0.42, 0.03], [0.42, 0.08], [0.38, 0.12], [0.38, 0.62], [0.42, 0.66], [0.42, 0.72], [0.32, 0.72], [0.32, 0.12]]), { segments: seg, metres: 0.8, tint: (p) => 0.82 + 0.18 * Math.min(1, p.y / 0.7) }).translate(0, 0, -0.2));
  out.dark.push(tintGeometry(boxUV(new CylinderGeometry(0.32, 0.32, 0.01, seg, 1).translate(0, 0.5, -0.2))));
  // The couch in the sun by the left corridor; a bench by the right.
  const c = lectus(-2.25, 3.55, 0, { w: 0.78, l: 1.8, h: 0.42, lod, tick: 0xd8ccb0, back: true });
  out.wood.push(...c.wood);
  out.linen.push(...c.cloth);
  out.trav.push(slab(0.42, 0.06, 1.3, { bevel: 0.01, seed: seed + 31, wobble: 0, tone: 0.03, grime: 0 }).translate(2.45, 0.44, 3.4));
  for (const k of [-1, 1]) out.trav.push(slab(0.34, 0.44, 0.14, { bevel: 0.01, seed: seed + 32 + k, wobble: 0.002, tone: 0.03, grime: 0.3 }).translate(2.45, 0, 3.4 + k * 0.48));
  // The altar of Asclepius and Hygieia: a block of stone, its bronze serpent staff on it.
  const [ax, az] = [1.85, 4.85];
  out.trav.push(slab(0.6, 0.12, 0.5, { bevel: 0.015, seed: seed + 40, wobble: 0.002, tone: 0.04, grime: 0.4 }).translate(ax, 0, az));
  out.trav.push(slab(0.48, 0.7, 0.38, { bevel: 0.012, seed: seed + 41, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(ax, 0.12, az));
  out.trav.push(slab(0.58, 0.1, 0.48, { bevel: 0.012, seed: seed + 42, wobble: 0, tone: 0, grime: 0 }).translate(ax, 0.82, az));
  const a = asclepius(ax, 0.92, az, 0.85, { lod, ry: -0.5 });
  out.wood.push(...a.wood);
  out.snake.push(...a.snake);
}

/** The street wall, low, with the gate between its piers under the inscription; the low walls of the forecourt's sides. */
function gate(lod, seed, out) {
  const zf = V.outer;
  const g = V.gate;
  const LOW = 1.1;
  for (const s of [-1, 1]) {
    const a = s < 0 ? -zf : g + 0.4;
    const b = s < 0 ? -g - 0.4 : zf;
    out.plaster.push(box(b - a, LOW, 0.24, (a + b) / 2, 0, zf - 0.12, 0.9));
    out.tile.push(box(b - a, 0.06, 0.32, (a + b) / 2, LOW, zf - 0.12, 0.9));
    out.red.push(box(b - a, 0.6, 0.012, (a + b) / 2, 0, zf + 0.0, 1));
    // The forecourt's side walls from the range's end to the street wall.
    out.plaster.push(box(0.24, LOW, zf - V.front - 0.24, s * (zf - 0.12), 0, (V.front + zf - 0.24) / 2, 0.9));
    out.tile.push(box(0.32, 0.06, zf - V.front - 0.24, s * (zf - 0.12), LOW, (V.front + zf - 0.24) / 2, 0.9));
  }
  const gh = V.gateH;
  for (const s of [-1, 1]) {
    out.trav.push(slab(0.4, gh, 0.4, { bevel: 0.015, seed: seed + s, wobble: 0.002, tone: 0.05, grime: 0.35 }).translate(s * (g + 0.2), 0, zf - 0.2));
    out.trav.push(slab(0.48, 0.08, 0.48, { bevel: 0.012, seed: seed + 3 + s, wobble: 0, tone: 0, grime: 0 }).translate(s * (g + 0.2), gh, zf - 0.2));
  }
  // The lintel over a wider span, carried on the piers' caps, VALETVDINARIVM cut in it.
  out.trav.push(slab(3.4, 0.34, 0.42, { bevel: 0.015, seed: seed + 9, wobble: 0.002, tone: 0.04, grime: 0 }).translate(0, gh + 0.08, zf - 0.21));
  if (lod === 0) out.letters.push(...inscribe('VALETVDINARIVM', gh + 0.17, zf, 0.16));
  else if (lod === 1) out.letters.push(box(2.6, 0.16, 0.006, 0, gh + 0.17, zf));
  // Its gates: two leaves of wood, open (swung in against the wall) or shut.
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = box(g - 0.02, 2.0, 0.06, -s * (g / 2), 0, 0, 0.7);
      leaf.rotateY(open ? -s * 1.55 : 0);
      leaf.translate(s * g, 0.02, zf - 0.3);
      (open ? out.doorOpen : out.doorShut).push(leaf);
    }
  }
}

/** The people (only close up): the sick abed and about the court, the orderlies, the doctor, the surgeon at work. */
function folk(mats, beds) {
  const list = [];
  const things = { bronze: [], wood: [], linen: [] };
  const fy = V.floorY;
  const blankets = [0x8a6a4a, 0x6a5a48, 0x9a7a5a, 0x7a6a5a, 0x8a5a3a, 0x6a6a5a];
  const skins = [0xa87a58, 0xb88a64, 0x9a6c4c, 0xc49a74, 0x8a5e40, 0xb08060];
  // The sick in the wards' beds (some beds empty), seen only through the doors: what shows over the blankets.
  beds.forEach(([x, z, ry], i) => {
    if (i % 3 === 2) return;
    list.push(...sleeper(mats, { hair: [0x2e2119, 0x4a3020, 0x1e1812][i % 3], skin: skins[i % 6], blanket: blankets[i % 6] }, x, fy + 0.42 + 0.12, z, ry));
  });
  // A convalescent on the couch in the sun.
  list.push(...abed(mats, { cloth: 0xc9bca2, hair: 0x3a2a1a, skin: 0xb88a64 }, -2.25, 0.42 + 0.12, 3.6, 0, { blanket: 0x7a4a3a }));
  // A soldier on a crutch, an orderly at his elbow, coming in from the gate.
  list.push(...person(mats, { cloth: 0xa8322b, hair: 0x2e2119, skin: 0xa87a58, arms: [[-0.26, 1.18, 0.1], [0.24, 0.9, 0.06]] }, 0.95, 0.03, 3.6, Math.PI - 0.2));
  things.wood.push(staff([0.95 + 0.27, 0.03, 3.6 - 0.05], [0.95 + 0.25, 1.28, 3.6 + 0.02], 0.022, 5));
  list.push(...person(mats, { cloth: 0xd8d0bc, hair: 0x1e1812, skin: 0x8a5e40, arms: [[-0.25, 1.0, 0.24], [0.12, 0.9, 0.2]] }, 1.42, 0.03, 3.75, Math.PI - 0.5));
  // A patient on the bench, his arm in a sling.
  list.push(...person(mats, { cloth: 0x6a7a5a, hair: 0x4a3020, skin: 0xb08060, sit: 0.5, arms: [[-0.12, 0.72, 0.3], [0.08, 0.88, 0.2]], lean: 0.08 }, 2.45, 0.0, 3.4, -Math.PI / 2));
  things.linen.push(box(0.2, 0.14, 0.14, 2.45 - 0.2, 0.86, 3.4 - 0.1, 0.95));
  // The doctor among his herbs, stooping to a bed; an orderly carrying a basin along the corridor.
  list.push(...person(mats, { cloth: 0xe0d8c4, cloth2: 0x4a5a6a, hair: 0x8a8680, beard: true, long: true, arms: 'reach' }, -1.5, 0.03, 0.15, Math.PI));
  list.push(...person(mats, { cloth: 0xc9bca2, hair: 0x2e2119, skin: 0x9a6c4c, arms: 'hold' }, -3.45, fy, 0.95, Math.PI));
  const bb = basinStand(-3.45, 0.95 - 0.28, { h: 1.16, r: 0.17, lod: 0, water: false });
  things.bronze.push(...bb.bowl);
  // In the hall: the patient on the table, the surgeon at his side, an orderly holding the lamp and the dressings.
  list.push(...abed(mats, { cloth: 0xd8cdb4, hair: 0x2e2119, skin: 0xb88a64 }, 0.0, fy + 0.8, -4.25, Math.PI / 2, { blanket: 0xe8e0d0 }));
  // (The surgeon across the table from the door, so the court sees him at work; the orderly at the patient's head.)
  list.push(...person(mats, { cloth: 0xe0d8c4, hair: 0x6a625a, skin: 0xa87a58, beard: true, long: true, arms: [[-0.2, 1.0, 0.42], [0.18, 1.02, 0.36]] }, 0.15, fy, -4.95, 0.1));
  list.push(...person(mats, { cloth: 0x8a7a62, hair: 0x1e1812, skin: 0x8a5e40, arms: 'hold' }, -1.22, fy, -4.2, Math.PI / 2));
  return { list, things };
}

/** Build the hospital: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildValetudinarium({ lod = 0, seed = 371 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['plaster', 'red', 'redIn', 'floor', 'trav', 'tile', 'wood', 'dark', 'shelter', 'linen', 'doorOpen', 'doorShut', 'gravel', 'flags', 'marble',
    'bedWood', 'soil', 'leaf', 'bloom', 'snake', 'letters', 'pots', 'beds', 'bedCloth', 'bronze'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  // The side ranges: the left one built, a copy mirrored for the right.
  const left = sideRange(lod, seed);
  const right = sideRange(lod, seed + 50);
  for (const list of Object.values(right.out)) mirrorX(list);
  pour(left.out, out);
  pour(right.out, out);
  backRange(lod, seed + 100, out);
  hall(lod, seed + 120, out);
  court(lod, seed + 140, out);
  gate(lod, seed + 160, out);
  // The beds: along each side ward's outer wall (head toward the back), across the back wards (head toward the hall).
  const beds = [
    ...left.beds.map(([x, z]) => [x, z, 0]),
    ...right.beds.map(([x, z]) => [-x, z, 0]),
    [-V.backDoor, -V.outer + T + 0.45, Math.PI / 2],
    [V.backDoor, -V.outer + T + 0.45, -Math.PI / 2],
  ];
  if (lod < 2) {
    for (const [x, z, ry] of beds) {
      const l = lectus(x, z, ry, { w: 0.74, l: 1.7, h: 0.42, lod, tick: 0xd8ccb0 });
      out.beds.push(...l.wood.map((g) => g.translate(0, V.floorY, 0)));
      out.bedCloth.push(...l.cloth.map((g) => g.translate(0, V.floorY, 0)));
    }
  }
  const m = healthMaterials();
  if (lod === 2) {
    out.wood.push(...out.bedWood.splice(0));
    out.plaster.push(...out.redIn.splice(0));
    out.letters = out.snake = out.bloom = out.pots = out.bronze = [];
  }
  const p = new TaggedParts('valetudinarium');
  const small = { cast: false };
  p.add('gravel', m.gravel, out.gravel, small);
  p.add('flags', m.flags, out.flags, small);
  p.add('floor', m.shelteredFloor, out.floor, small);
  p.add('stone', m.trav, out.trav);
  p.add('walls', m.plaster, out.plaster);
  p.add('dado', m.red, [...out.red, ...out.redIn], small);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, [...out.wood, ...out.bedWood]);
  p.add('sheltered-wood', m.shelteredWood, [...out.shelter, ...out.beds]);
  p.add('inside', m.dark, out.dark, small);
  p.add('marble', m.marble, out.marble);
  p.add('linen', m.linen, [...out.linen, ...out.bedCloth], small);
  p.add('soil', m.soil, out.soil, small);
  p.add('herbs', m.leaf, out.leaf, small);
  p.add('flowers', m.paint, out.bloom, small);
  p.add('serpent', m.gilt, out.snake, small);
  p.add('letters', m.letters, out.letters, small);
  p.add('pots', m.clay, out.pots, small);
  p.add('bronze', m.bronze, out.bronze, small);
  p.add('doors', m.wood, out.doorOpen, { when: 'open' });
  p.add('doors', m.wood, out.doorShut, { when: 'shut' });
  if (lod < 2) {
    for (const [lx, ly, lz] of V.lamps) {
      const l = lantern(lx, ly, lz, lod);
      // (The hall's hangs from an iron bracket out of its wall; the gate's stand on the piers' caps.)
      const hung = lz < 0 ? [staff([lx, ly + 0.3, lz], [lx, ly + 0.42, lz], 0.01, 4), staff([lx, ly + 0.42, lz], [lx, ly + 0.42, V.hall.z], 0.012, 4)] : [];
      p.add('lantern', m.bronze, [...l.bronze, ...hung], small);
      p.add('lamp', lanternPane(), [l.pane], { when: 'open', cast: false });
      p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
    }
  }
  if (lod === 0) {
    const { list, things } = folk(m, beds);
    people(p, m, 'sick', list, 'open');
    p.add('crutch', m.wood, things.wood, { when: 'open', cast: false });
    p.add('basin', m.bronze, things.bronze, { when: 'open', cast: false });
    p.add('dressings', m.linen, things.linen, { when: 'open', cast: false });
  }
  return p.build();
}

