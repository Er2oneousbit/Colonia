/**
 * models/ludus.js
 * ----------------------------------------------------------------------------
 * The school of the 3D look: a ludus litterarius on a 2 x 2 footprint (8 m),
 * the elementary school where boys (and some girls) of seven to eleven
 * learnt their letters and sums, from what is known of Roman schools rather
 * than from the 2D sprite:
 *
 *   - A school was seldom a building of its own. The master (the ludi
 *     magister, or litterator) rented a pergula, a room or booth open to the
 *     street, or taught under a portico of the forum, the class shut off
 *     from the street by no more than a curtain. The painting of the forum
 *     at Pompeii from the Praedia of Julia Felix shows one in the colonnade:
 *     boys seated with tablets on their knees, a master, a boy being beaten.
 *   - The relief of a school from Neumagen on the Moselle: the master in a
 *     high round-backed chair (a cathedra), a boy either side reading from a
 *     roll, a third arriving late with his box of rolls (a capsa). Boys wrote
 *     on wax tablets with a stylus, read aloud from rolls, counted on their
 *     fingers and on a counting board (abacus) with pebbles (calculi); the
 *     master kept a cane (ferula) at hand. The letters were set out for them
 *     on a whitened board (album). A slave (the capsarius, or the boy's
 *     paedagogus) carried his things and brought him before dawn: school
 *     began at first light and was out by noon.
 *
 * So, in 8 m: a portico along the back under a tiled lean-to on four
 * columns stuccoed red below and white above, the house wall behind it with
 * a door and a red dado, cupboards and book boxes in its shade; before it, in
 * the open court, the master on a low dais in his wicker cathedra under a
 * striped awning, the album on its easel with the alphabet painted on it,
 * the counting table; benches round the court where the boys sit, a boy
 * reciting before the master; a low wall round the court, open to the
 * street; LVDVS painted on a board under the portico's beam.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the master teaching, the boys on their benches with
 *           tablets and capsae, the awning out, a slave waiting at the gate,
 *           the door's curtain drawn back, the lantern lit at night
 *   'shut'  no staff: the awning rolled up, the door shut, nobody
 *
 * Metres, the footprint's middle at the origin, y up, the street (the open
 * front of the court) toward +z, as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, SphereGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { slab, tuscanColumn, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin } from './rural.js';
import { staff, inscribe, people, clothBothSides } from './castra.js';
import { learningMaterials, person, at, tablet, capsa, arcSweep, roofSlope, roll, box } from './learning.js';

/** The school's measures (metres): the tests, the lab and the game read them. */
export const LUDUS = Object.freeze({
  half: 4,
  /** The court's beaten earth. */
  floorY: 0.04,
  /** The back wall's inner face, the portico's columns' line, its floor's top. */
  back: -3.69,
  colZ: -2.12,
  stepY: 0.2,
  /** The roof: its eave (z, y) and its top over the back wall. */
  eave: Object.freeze([-1.72, 2.52]),
  ridge: Object.freeze([-3.97, 3.36]),
  /** The court's walls: their height; the gate's gap in the front wall. */
  wallH: 0.95,
  gate: Object.freeze([-1.05, 1.05]),
  /** The master's dais (x0, x1, z0, z1, height) and his chair's middle (x, z). */
  dais: Object.freeze([-0.78, 0.78, -1.98, -0.92, 0.22]),
  chair: Object.freeze([0, -1.5]),
  /** The benches: [x0, z0, x1, z1] each, their seats at seatY. */
  benches: Object.freeze([[-2.62, -0.25, -2.3, 2.15], [2.3, -0.25, 2.62, 2.15], [-1.35, 2.62, 1.35, 2.94]]),
  seatY: 0.4,
  /**
   * The lantern on the right gate pier (x, y, z), facing the street (one under the portico would sit
   * behind the awning, and the night's glow, which has no depth, would show on the roof).
   */
  lamp: Object.freeze([1.17, 1.38, 3.78]),
});

const L = LUDUS;
const H = 3.93;
const RED = lin(0xa83a26);

/** The rake of the portico's roof: its underside's height over z. */
function roofY(z) {
  const [ez, ey] = L.eave;
  const [rz, ry] = L.ridge;
  return ey + ((z - ez) * (ry - ey)) / (rz - ez);
}

/** A box whose top follows the roof's rake (a wall under the lean-to), x0..x1, z0..z1, from y0. */
function raked(x0, x1, z0, z1, y0, drop = 0.06) {
  const g = new BoxGeometry(x1 - x0, 1, z1 - z0);
  g.translate((x0 + x1) / 2, 0.5, (z0 + z1) / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? roofY(p.getZ(i)) - drop : y0);
  g.computeVertexNormals();
  return tintGeometry(boxUV(g));
}

/**
 * The awning (velum): stripes of linen from the beam out over the master's
 * dais, on two poles with stays; or rolled up under the beam. Each stripe
 * its own strip (a colour shared across a strip's edge would smear).
 */
function awning(lod, out) {
  const x0 = -2.0;
  const x1 = 2.0;
  const n = lod === 2 ? 1 : 10;
  const [zA, yA] = [L.colZ + 0.1, 2.3];
  const [zB, yB] = [-0.62, 2.08];
  const cols = [lin(0xb0402c), lin(0xe8dcc0)];
  const pos = [];
  const col = [];
  const sag = lod ? 0 : 0.06;
  for (let k = 0; k < n; k++) {
    const a = x0 + ((x1 - x0) * k) / n;
    const b = x0 + ((x1 - x0) * (k + 1)) / n;
    const c = n === 1 ? lin(0xc8704e) : cols[k % 2];
    // Two rows a stripe: the sheet sags a little between the beam and the front rail.
    const zm = (zA + zB) / 2;
    const ym = (yA + yB) / 2 - sag;
    for (const [z0, y0, z1, y1] of [[zA, yA, zm, ym], [zm, ym, zB, yB]]) {
      // (Wound so its face is the sheet's top: the sun's side, where snow and light fall.)
      pos.push(a, y0, z0, b, y1, z1, b, y0, z0, a, y0, z0, a, y1, z1, b, y1, z1);
      for (let i = 0; i < 6; i++) col.push(...c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  out.awningOpen.push(boxUV(g));
  // Its front rail and the two poles, stays to pegs in the ground.
  out.poleOpen.push(staff([x0, yB, zB], [x1, yB, zB], 0.025, 5));
  for (const x of [x0, x1]) {
    out.poleOpen.push(staff([x, L.floorY, zB], [x, yB + 0.12, zB], 0.035, 6));
    if (lod === 0) out.ropeOpen.push(staff([x, yB + 0.08, zB], [x + Math.sign(x) * 0.5, L.floorY, zB + 0.55], 0.008, 3));
  }
  // Rolled: a striped roll along the beam's front.
  const m = lod === 2 ? 1 : 10;
  for (let k = 0; k < m; k++) {
    const a = x0 + ((x1 - x0) * k) / m;
    const r = new CylinderGeometry(0.09, 0.09, (x1 - x0) / m, lod ? 8 : 12, 1);
    r.rotateZ(Math.PI / 2);
    r.translate(a + (x1 - x0) / m / 2, yA - 0.06, zA + 0.12);
    const c = m === 1 ? lin(0xc8704e) : cols[k % 2];
    out.awningShut.push(tintGeometry(boxUV(r), () => c));
  }
}

/** The portico: its floor and step, the back wall with its door and dado, the side walls, the columns, beam and roof. */
function portico(lod, seed, out) {
  const t = 0.26;
  const back = L.back;
  // The floor of cocciopesto, a step up, edged in travertine along its front.
  out.floor.push(box(2 * H - 2 * t, L.stepY, L.colZ - back, 0, 0, (back + L.colZ) / 2, 0.95));
  out.trav.push(slab(2 * H - 2 * t, L.stepY, 0.36, { bevel: 0.015, seed, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(0, 0, L.colZ));
  // The back wall, plastered, its door to the master's lodging.
  const door = { x: -2.55, w: 0.95, h: 2.05 };
  const zb = back - t / 2;
  for (const [a, b] of [[-H, door.x - door.w / 2], [door.x + door.w / 2, H]]) out.plaster.push(box(b - a, roofY(-H) - 0.04, t, (a + b) / 2, 0, zb, 0.95));
  out.plaster.push(box(door.w, roofY(-H) - 0.04 - (L.stepY + door.h), t, door.x, L.stepY + door.h, zb, 0.95));
  // The inside of the doorway: dark, the lodging beyond; the travertine frame round it.
  out.dark.push(box(door.w, door.h, 0.02, door.x, L.stepY, zb - t / 2 + 0.03));
  for (const s of [-1, 1]) out.trav.push(slab(0.12, door.h + 0.02, t + 0.06, { bevel: 0.01, seed: seed + 3 + s, wobble: 0.002, tone: 0.04, grime: 0.25 }).translate(door.x + s * (door.w / 2 + 0.06), L.stepY, zb));
  out.trav.push(slab(door.w + 0.4, 0.16, t + 0.08, { bevel: 0.012, seed: seed + 5, wobble: 0, tone: 0.04, grime: 0 }).translate(door.x, L.stepY + door.h, zb));
  // Shut: the door's planks; open: a curtain drawn back to one side on its rod.
  out.doorShut.push(box(door.w - 0.02, door.h - 0.02, 0.05, door.x, L.stepY, zb + 0.02, 0.78));
  out.curtainOpen.push(box(0.2, door.h - 0.12, 0.06, door.x + door.w / 2 - 0.14, L.stepY + 0.05, back + 0.05, 1));
  if (lod < 2) out.poleOpen.push(staff([door.x - door.w / 2, L.stepY + door.h - 0.05, back + 0.06], [door.x + door.w / 2, L.stepY + door.h - 0.05, back + 0.06], 0.012, 4));
  // The dado: Pompeian red to a metre, a dark band over it, round the portico's walls.
  const dado = (a, b) => out.red.push(box(b - a, 0.95, 0.012, (a + b) / 2, L.stepY, back + 0.006));
  dado(-H + t, door.x - door.w / 2 - 0.12);
  dado(door.x + door.w / 2 + 0.12, H - t);
  if (lod < 2) out.paint.push(box(2 * H - 2 * t, 0.05, 0.014, 0, L.stepY + 0.95, back + 0.007, lin(0x2a1e18)));
  // The side walls under the rake, the court's low walls on from them to the front.
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -H : H - t;
    out.plaster.push(raked(x0, x0 + t, -H, L.colZ + 0.18, 0));
    out.red.push(box(0.012, 0.95, L.colZ - back - 0.1, s * (H - t - 0.006), L.stepY, (back + L.colZ) / 2, 1));
  }
  // The columns: brick stuccoed, red below and white above, as Pompeii's porticoes.
  const colH = L.eave[1] - 0.27 - L.stepY;
  for (const x of [-2.85, -0.95, 0.95, 2.85]) {
    for (const g of tuscanColumn(0.13, colH, lod)) {
      const c = g.attributes.color;
      const p = g.attributes.position;
      for (let i = 0; i < c.count; i++) if (p.getY(i) < 0.85) c.setXYZ(i, c.getX(i) * RED[0] * 1.6, c.getY(i) * RED[1] * 1.6, c.getZ(i) * RED[2] * 1.6);
      out.plaster.push(g.translate(x, L.stepY, L.colZ));
    }
  }
  // The beam over them, the rafters' ends under the eave.
  out.wood.push(box(2 * H - 0.06, 0.24, 0.22, 0, L.eave[1] - 0.27, L.colZ, 0.85));
  // The roof: one slope of tiles from the eave up over the back wall.
  const [ez, ey] = L.eave;
  const [rz, ry] = L.ridge;
  const roof = roofSlope([[-H, ey, ez], [H, ey, ez], [H, ry, rz], [-H, ry, rz]], { lod, seed: seed + 9 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // The sign under the beam between the middle columns: LVDVS, painted on a whitened board.
  const sy = L.eave[1] - 0.6;
  out.board.push(box(1.12, 0.3, 0.035, 0, sy, L.colZ + 0.13, lin(0xe9e1cd)));
  out.wood.push(box(1.18, 0.035, 0.05, 0, sy - 0.02, L.colZ + 0.13, 0.7), box(1.18, 0.035, 0.05, 0, sy + 0.29, L.colZ + 0.13, 0.7));
  if (lod === 0) out.letters.push(...inscribe('LVDVS', sy + 0.06, L.colZ + 0.152, 0.18));
  else if (lod === 1) out.letters.push(box(0.8, 0.14, 0.006, 0, sy + 0.08, L.colZ + 0.15));
  // Under the portico (sheltered: no snow): a cupboard of the master's rolls, a row of pegs with the boys' satchels, a bench.
  out.shelter.push(box(1.1, 1.55, 0.42, 2.6, L.stepY, back + 0.21, 0.62));
  if (lod < 2) {
    out.shelter.push(box(1.0, 0.03, 0.4, 2.6, L.stepY + 1.55, back + 0.22, 0.8));
    for (const x of [2.33, 2.87]) out.shelter.push(box(0.012, 1.3, 0.01, x, L.stepY + 0.15, back + 0.425, 0.4));
    out.shelter.push(box(1.6, 0.05, 0.34, 0.3, L.stepY + 0.42, back + 0.2, 0.78));
    for (const x of [-0.4, 1.0]) out.shelter.push(box(0.06, 0.42, 0.28, x, L.stepY, back + 0.2, 0.7));
    out.shelter.push(box(2.4, 0.05, 0.05, 0.3, L.stepY + 1.5, back + 0.03, 0.75));
  }
}

/** The court: its floor, low walls, the gate's piers. */
function court(lod, seed, out) {
  const t = 0.24;
  out.earth.push(box(2 * H - 2 * t, L.floorY, H - L.colZ - t, 0, 0, (L.colZ + H - t) / 2, (x, y, z) => 0.9 + 0.1 * Math.cos(x * 1.3) * Math.cos(z * 1.1)));
  // A worn path from the gate to the dais, flags at the gate.
  if (lod < 2) out.trav.push(slab(L.gate[1] - L.gate[0], 0.06, t + 0.04, { bevel: 0.01, seed: seed + 1, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(0, 0, H - t / 2));
  const w = L.wallH;
  for (const s of [-1, 1]) {
    const x = s * (H - t / 2);
    out.plaster.push(box(t, w, H - L.colZ - 0.18, x, 0, (L.colZ + 0.18 + H) / 2, 0.9));
    out.tile.push(box(t + 0.08, 0.06, H - L.colZ - 0.18, x, w, (L.colZ + 0.18 + H) / 2, 0.92));
  }
  for (const [a, b] of [[-H + t, L.gate[0] - 0.12], [L.gate[1] + 0.12, H - t]]) {
    out.plaster.push(box(b - a, w, t, (a + b) / 2, 0, H - t / 2, 0.9));
    out.tile.push(box(b - a, 0.06, t + 0.08, (a + b) / 2, w, H - t / 2, 0.92));
  }
  // The gate's piers, travertine, capped.
  for (const x of [L.gate[0] - 0.12, L.gate[1] + 0.12]) {
    out.trav.push(slab(0.3, L.lamp[1] - 0.08, 0.3, { bevel: 0.015, seed: seed + x * 10, wobble: 0.002, tone: 0.05, grime: 0.35 }).translate(x, 0, H - 0.15));
    out.trav.push(slab(0.38, 0.08, 0.38, { bevel: 0.012, seed: seed + x * 10 + 1, wobble: 0, tone: 0, grime: 0 }).translate(x, L.lamp[1] - 0.08, H - 0.15));
  }
}

/** The master's place: the dais, the cathedra, the footstool, the album on its easel, the counting table. */
function teacher(lod, seed, out) {
  const [x0, x1, z0, z1, h] = L.dais;
  out.wood.push(box(x1 - x0, h, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0.72));
  if (lod < 2) out.wood.push(box(0.6, h / 2, 0.24, (x0 + x1) / 2, 0, z1 + 0.12, 0.66));
  // The cathedra: a wicker armchair with its high round back, after the Neumagen master's.
  const [cx, cz] = L.chair;
  const seg = lod === 2 ? 8 : lod ? 14 : 22;
  const seat = new CylinderGeometry(0.26, 0.24, 0.42, seg, 1);
  seat.translate(cx, h + 0.21, cz);
  out.wicker.push(tintGeometry(boxUV(seat), (px, py) => 0.75 + 0.25 * ((py - h) / 0.42)));
  const back = arcSweep([[0.27, 0.0], [0.27, 0.62], [0.255, 0.66], [0.235, 0.62], [0.235, 0.0]], Math.PI * 0.42, Math.PI * 1.58, { segments: seg, tint: (p) => 0.8 + 0.2 * (p.y / 0.66) });
  back.translate(cx, h + 0.42, cz);
  out.wicker.push(back);
  // A cushion on the seat, the footstool before it, the cane against it.
  if (lod < 2) {
    const cu = new CylinderGeometry(0.22, 0.22, 0.05, seg, 1);
    cu.translate(cx, h + 0.445, cz);
    out.paint.push(tintGeometry(boxUV(cu), () => lin(0x7a2c34)));
    out.wood.push(box(0.42, 0.1, 0.24, cx, h, cz + 0.52, 0.8));
  }
  if (lod === 0) out.wood.push(staff([cx + 0.31, h, cz + 0.12], [cx + 0.27, h + 0.95, cz - 0.05], 0.009, 4));
  // The album: a whitened board on an easel, the alphabet painted on it in two lines.
  const [ax, az, ry] = [1.62, -1.35, -0.32];
  const board = [box(1.0, 0.68, 0.03, 0, 0.62, 0, lin(0xece6d6))];
  const frame = [];
  if (lod < 2) for (const [w, hh, x, y] of [[1.06, 0.04, 0, 0.6], [1.06, 0.04, 0, 1.3], [0.04, 0.74, -0.51, 0.6], [0.04, 0.74, 0.51, 0.6]]) frame.push(box(w, hh, 0.04, x, y, 0, 0.75));
  // (Its legs just outside the board's edges, the third behind it: the board leans back a tenth of a
  // radian, so at its top its face is 0.13 back and a leg must be further back still; the tilt sinks
  // the back leg's foot below the ground, so it starts a hand up.)
  const legs = [staff([-0.6, 0, 0.16], [-0.56, 1.38, -0.12], 0.022, 5), staff([0.6, 0, 0.16], [0.56, 1.38, -0.12], 0.022, 5), staff([0, 0.06, -0.5], [0, 1.28, -0.2], 0.022, 5)];
  if (lod < 2) legs.push(box(0.9, 0.04, 0.06, 0, 0.56, 0.04, 0.7));
  const letters = lod === 0
    ? [...inscribe('ABCDEFGHI', 1.06, 0.016, 0.1), ...inscribe('LMNOPRSTVX', 0.76, 0.016, 0.1)]
    : lod === 1 ? [box(0.7, 0.07, 0.004, 0, 1.08, 0.016), box(0.78, 0.07, 0.004, 0, 0.78, 0.016)] : [];
  for (const [list, key] of [[board, 'board'], [frame, 'wood'], [legs, 'wood'], [letters, 'ink']]) {
    for (const g of list) {
      g.rotateX(-0.1);
      g.rotateY(ry);
      g.translate(ax, L.floorY, az);
      out[key].push(g);
    }
  }
  // The counting table: a marble top on a turned leg, the abacus on it, its pebbles in their grooves.
  const [tx, tz] = [-1.55, -1.3];
  out.marble.push(slab(0.64, 0.05, 0.42, { bevel: 0.01, seed: seed + 7, wobble: 0, tone: 0, grime: 0 }).translate(tx, 0.72, tz));
  out.marble.push(tintGeometry(boxUV(new CylinderGeometry(0.06, 0.09, 0.72, lod ? 6 : 10, 1).translate(tx, 0.36, tz))));
  out.wood.push(box(0.48, 0.03, 0.3, tx, 0.77, tz, 0.7));
  if (lod === 0) {
    for (let k = 0; k < 6; k++) {
      out.wood.push(box(0.008, 0.008, 0.26, tx - 0.2 + k * 0.08, 0.8, tz, 0.4));
      for (let j = 0; j < 4; j++) {
        const b = new SphereGeometry(0.014, 6, 4);
        b.translate(tx - 0.2 + k * 0.08, 0.812, tz - 0.1 + j * 0.035 + (k % 3 === 1 && j > 1 ? 0.08 : 0));
        out.paint.push(tintGeometry(boxUV(b), () => (j === 0 ? lin(0x2a2622) : lin(0xd8d0c0))));
      }
    }
  }
}

/** The boys' benches: a plank on two legs each. */
function benches(lod, out) {
  for (const [x0, z0, x1, z1] of L.benches) {
    const along = x1 - x0 > z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    out.wood.push(box(x1 - x0, 0.05, z1 - z0, cx, L.seatY - 0.05, cz, 0.8));
    const len = along ? x1 - x0 : z1 - z0;
    for (const s of [-1, 1]) {
      const o = s * (len / 2 - 0.2);
      out.wood.push(along ? box(0.06, L.seatY - 0.05, z1 - z0 - 0.04, cx + o, 0, cz, 0.65) : box(x1 - x0 - 0.04, L.seatY - 0.05, 0.06, cx, 0, cz + o, 0.65));
    }
  }
}

/** The pupils and the master (only close up): seated with their tablets, one reciting, a slave at the gate. */
function scholars(mats) {
  const boy = 0.78;
  // (The benches stand on the ground under the court's earth: their seats are seatY over y 0.)
  const sit = (L.seatY - L.floorY) / boy;
  const tunics = [0xd8cdb4, 0xb88a52, 0x9a4a3a, 0xc9bca2, 0x6a7a5a, 0xd0c4a0, 0x8a5a3a];
  const hairs = [0x2e2119, 0x4a3020, 0x1e1812, 0x6a4a2a, 0x2e2119, 0x3a2a1a, 0x5a3a20];
  const skins = [0xa87a58, 0xb88a64, 0x9a6c4c, 0xc49a74, 0x8a5e40, 0xb08060, 0xa47456];
  const people = [];
  const things = { wood: [], wax: [], leather: [], paper: [], strap: [] };
  // Seated on the benches, facing the middle: two each side, three on the front bench with their backs to the street.
  const seats = [[-2.42, 0.25, Math.PI / 2], [-2.42, 1.45, Math.PI / 2], [2.42, 0.2, -Math.PI / 2], [2.42, 1.4, -Math.PI / 2], [-0.85, 2.82, Math.PI], [0.05, 2.82, Math.PI], [0.95, 2.82, Math.PI]];
  seats.forEach(([x, z, ry], i) => {
    const arms = ['lap', 'write', 'lap', 'read', 'write', 'lap', 'read'][i];
    people.push(...person(mats, { cloth: tunics[i], hair: hairs[i], skin: skins[i], sit, arms, lean: 0.14 }, x, L.floorY, z, ry + (i % 2 ? 0.12 : -0.1), boy));
    if (arms !== 'read') {
      // The tablet on his knees, tipped toward him.
      const [tx, tz] = at(x, z, ry, 0, 0.3 * boy);
      const tb = tablet(tx, L.floorY + (sit + 0.19) * boy, tz, ry, 0.19, 0.13, -0.25);
      things.wood.push(...tb.wood);
      things.wax.push(...tb.wax);
    } else {
      // An open roll held up before him.
      const [rx, rz] = at(x, z, ry, 0, 0.32 * boy);
      const y = L.floorY + (sit + 0.42) * boy;
      for (const s of [-1, 1]) {
        const [qx, qz] = at(rx, rz, ry, s * 0.12 * boy, 0);
        const g = new CylinderGeometry(0.022, 0.022, 0.2, 6, 1);
        g.translate(qx, y, qz);
        things.paper.push(tintGeometry(boxUV(g), () => [0.78, 0.66, 0.46]));
      }
      const sheet = new BoxGeometry(0.22 * boy, 0.16, 0.004);
      sheet.rotateY(ry);
      sheet.translate(rx, y, rz);
      things.paper.push(tintGeometry(boxUV(sheet), () => [0.86, 0.76, 0.56]));
    }
    // His capsa on the ground beside him.
    const [cx, cz] = at(x, z, ry, 0.38, -0.05);
    const c = capsa(cx, L.floorY, cz, { r: 0.1, h: 0.26, open: i % 3 !== 2, seed: 30 + i });
    for (const k of ['leather', 'paper', 'strap']) things[k].push(...c[k]);
  });
  // A boy before the master, reciting from his tablet; the master, teaching, his hand raised.
  people.push(...person(mats, { cloth: 0xe0d6c0, hair: 0x2e2119, arms: 'hold' }, 0.32, L.floorY, -0.5, Math.PI + 0.15, boy));
  const [hx, hz] = at(0.32, -0.5, Math.PI + 0.15, 0, 0.3 * boy);
  const tb = tablet(hx, L.floorY + 1.12 * boy, hz, Math.PI + 0.15, 0.19, 0.13, -1.2);
  things.wood.push(...tb.wood);
  things.wax.push(...tb.wax);
  const [cx, cz] = L.chair;
  // (On the cushion, his feet on the footstool: the chair's seat 0.42 over the dais, the cushion's 0.05, the stool's 0.1.)
  people.push(...person(mats, { cloth: 0xd8d0bc, cloth2: 0x6a4e34, hair: 0x6a625a, beard: true, long: true, sit: 0.37, arms: 'teach', lean: 0.04 }, cx, L.dais[4] + 0.1, cz + 0.02, 0));
  // The slave who brought a boy, waiting by the gate with a roll under his arm.
  people.push(...person(mats, { cloth: 0x8a7a62, hair: 0x1e1812, skin: 0x8a5e40, arms: 'hold' }, 1.55, L.floorY, 3.2, -Math.PI * 0.85));
  const r = roll(0.3, 0.035, 1.55 - 0.06, L.floorY + 1.1, 3.2 - 0.28, { ry: -Math.PI * 0.85 + Math.PI / 2 });
  things.paper.push(...r.paper);
  return { people, things };
}

/** Build the school: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildSchool({ lod = 0, seed = 211 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['earth', 'floor', 'shelter', 'trav', 'plaster', 'red', 'paint', 'tile', 'wood', 'dark', 'board', 'letters', 'ink', 'wicker', 'marble',
    'doorShut', 'curtainOpen', 'poleOpen', 'ropeOpen', 'awningOpen', 'awningShut'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  portico(lod, seed, out);
  court(lod, seed + 20, out);
  teacher(lod, seed + 40, out);
  benches(lod, out);
  awning(lod, out);
  const m = learningMaterials();
  // (Far out the snow on a cupboard is under a pixel: no part of its own, one draw call fewer.)
  if (lod === 2) out.wood.push(...out.shelter.splice(0));
  const p = new TaggedParts('school');
  const small = { cast: false };
  p.add('court', m.earth, out.earth, small);
  p.add('floor', m.shelteredFloor, out.floor, small);
  p.add('stone', m.trav, out.trav);
  p.add('walls', m.plaster, out.plaster);
  p.add('dado', m.red, out.red, small);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  // (Under the portico's roof: the cupboard, the bench, the pegs take no snow.)
  p.add('sheltered-wood', m.shelteredWood, out.shelter);
  p.add('wicker', m.wicker, out.wicker);
  p.add('marble', m.marble, out.marble);
  // The whitened boards and the painted things: one plain material, their colours in the vertices.
  p.add('paint', m.paint, [...out.paint, ...out.board], small);
  p.add('letters', m.letters, [...out.letters, ...out.ink], small);
  p.add('inside', m.dark, out.dark, small);
  p.add('doors', m.wood, out.doorShut, { when: 'shut' });
  p.add('curtain', m.cloth, out.curtainOpen.map((g) => tintGeometry(g, () => lin(0x8a6a3a))), { when: 'open' });
  p.add('poles', m.wood, out.poleOpen, { when: 'open' });
  p.add('stays', m.rope, out.ropeOpen, { when: 'open', cast: false });
  // The awning: the look's double-sided cloth, out over the master while the school is open.
  p.add('awning', clothBothSides(), out.awningOpen, { when: 'open' });
  p.add('awning-rolled', m.cloth, out.awningShut, { when: 'shut' });
  if (lod < 2) {
    const [lx, ly, lz] = L.lamp;
    const l = lantern(lx, ly, lz, lod);
    // (Standing on the pier's cap.)
    p.add('bronze', m.bronze, l.bronze, small);
    p.add('lamp', lanternPane(), [l.pane], { when: 'open', cast: false });
    p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
  }
  if (lod === 0) {
    const { people: folk, things } = scholars(m);
    people(p, m, 'scholars', folk, 'open');
    p.add('tablets', m.wood, things.wood, { when: 'open', cast: false });
    p.add('wax', m.paint, things.wax, { when: 'open', cast: false });
    p.add('capsae', m.leather, [...things.leather, ...things.strap], { when: 'open', cast: false });
    p.add('rolls', m.papyrus, things.paper, { when: 'open', cast: false });
  }
  return p.build();
}
