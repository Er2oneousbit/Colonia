/**
 * models/curia.js
 * ----------------------------------------------------------------------------
 * The senate house of the 3D look: a town's curia on a 4 x 4 footprint
 * (16 m), from the record rather than the 2D sprite:
 *
 *   - The Curia Julia in the Forum Romanum (begun by Caesar, finished by
 *     Augustus, rebuilt by Diocletian after the fire of 283, and standing
 *     because it became a church): a tall hall of brick on a raised floor,
 *     its front faced with stucco scored to imitate blocks of marble, three
 *     great windows high in the front under a pediment, bronze doors (the
 *     originals hang in the Lateran), a few steps up; inside, three broad
 *     steps along each side for the senators' chairs, a floor of coloured
 *     marble, the president's platform at the far end and the statue of
 *     Victory on her globe with the altar before it, where senators burned
 *     incense as they came in. Octavian's coins of 29 to 27 BC show the new
 *     curia with a Victory on a globe at the top of its gable.
 *   - The curiae of the towns, where the decurions (the town council) sat:
 *     Pompeii's on the forum's south side, Sabratha's on a podium behind a
 *     portico with steps up to it, Timgad's off the forum. Men of the
 *     council wore the toga with the broad purple stripe on its tunic; a
 *     magistrate walked behind lictors carrying the fasces.
 *
 * So, in 16 m: a podium of travertine with a flight of steps between two
 * bronze statues of honoured citizens; a porch of six Corinthian columns
 * (instanced: models/government.js) carrying an entablature cut CVRIA, a
 * pair of bronze lampstands and benches of marble under it; behind it the
 * hall, its front stuccoed white and scored as marble, its sides and back
 * of bare brick with arched windows high up, the bronze doors under a
 * tablet cut S·P·Q·R, the pediment with an oak wreath in gilt bronze, a
 * gilt Victory on her globe at its top, a tiled roof.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the doors open, senators coming up the steps and
 *           talking in the porch (two seated on its bench), a magistrate in
 *           the purple-bordered toga at the door, his lictors at the foot
 *           of the steps; the lamps lit at night
 *   'shut'  no staff: the doors shut, nobody, the lamps out
 *   'out'   a mob or an enemy close (models/government.js): the doors shut,
 *           soldiers on the steps, the lamps lit
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, TorusGeometry, SphereGeometry, CylinderGeometry } from 'three';
import { boxUV, tintGeometry, frameSweep, revolve, profileOf } from '../shapes.js';
import { slab, paving, wallWithOpenings, TaggedParts } from './masonry.js';

import {
  govMaterials, guard, box, D, gable, slope, gableTri, rake, wallAlong, darkIn, doubleDoor, letters, statue, victory, togate, lictor, addPeople, lantern, lanternPane,
} from './domus.js';

/** The curia's measures (metres): the tests, the lab and the game read them. */
export const CURIA = Object.freeze({
  half: 8,
  /** The podium's top (the porch's and the hall's floor). */
  floorY: 1.25,
  /** The podium: x half width, front and back z. */
  podium: Object.freeze([5.5, 3.7, -7.6]),
  /** The steps: half width, the foot's z, their number. */
  steps: Object.freeze([3.3, 6.1, 6]),
  /** The hall's outer faces: x half width, front z, back z; the eave (the cornice's foot). */
  hall: Object.freeze([5.0, 0.6, -7.45]),
  eave: 9.6,
  /** The porch: its columns' line (z), their x, their height (base to abacus). */
  porchZ: 3.15,
  cols: Object.freeze([-4.75, -3.2, -1.6, 1.6, 3.2, 4.75]),
  colH: 5.2,
  /** The door (half width, height over the floor). */
  door: Object.freeze([1.25, 4.3]),
  /** The lampstands' lanterns (x, y, z) in the porch, facing the street. */
  lamps: Object.freeze([Object.freeze([-2.1, 2.95, 1.25]), Object.freeze([2.1, 2.95, 1.25])]),
});

const C = CURIA;
const PY = C.floorY;
const [HX, HZ1, HZ0] = C.hall;
const WALL = 0.45;

/** The podium, the steps, the cheeks and the paving round it. */
function podium(lod, seed, out) {
  const [px, pz1, pz0] = C.podium;
  const hz = (pz1 - pz0) / 2;
  const cz = (pz1 + pz0) / 2;
  // A moulded base, the die, a crown under the floor's edge: one profile run round the podium.
  const prof = [[0.14, 0], [0.14, 0.16], [0.07, 0.22], [0.02, 0.3], [0, 0.32], [0, PY - 0.2], [0.05, PY - 0.16], [0.1, PY - 0.1], [0.12, PY - 0.06], [0.12, PY], [-Math.min(px, hz), PY]];
  const g = frameSweep(prof, px, hz, { tint: (p) => (p.y < 0.3 ? 0.8 : 0.95) });
  g.translate(0, 0, cz);
  out.trav.push(g);
  // The steps up the front.
  const [sw, sz, n] = C.steps;
  const rise = PY / n;
  const tread = (sz - pz1) / n;
  for (let k = 0; k < n; k++) {
    const z0 = sz - (k + 1) * tread;
    out.trav.push(slab(2 * sw, (k + 1) * rise, z0 + tread - pz1 + 0.02, { bevel: 0.012, seed: seed + k, wobble: lod ? 0 : 0.002, tone: 0.03, grime: 0.25 }).translate(0, 0, (pz1 - 0.02 + z0 + tread) / 2));
  }
  // The cheeks either side: walls stepping down with the flight, a pedestal at the foot of each.
  for (const s of [-1, 1]) {
    const x = s * (sw + 0.3);
    out.trav.push(slab(0.6, PY, sz - 0.9 - pz1 + 0.05, { bevel: 0.015, seed: seed + 20 + s, wobble: 0, tone: 0.02, grime: 0.3 }).translate(x, 0, (pz1 - 0.05 + sz - 0.9) / 2));
    out.marble.push(box(0.68, 0.08, sz - 0.9 - pz1 + 0.05, x, PY, (pz1 - 0.05 + sz - 0.9) / 2, 0.95));
  }
  // The precinct's paving round the podium and the steps.
  const H = C.half - 0.08;
  const skip = (x, z) => (Math.abs(x) < px + 0.15 && z < pz1 + 0.1) || (Math.abs(x) < sw + 0.62 && z < sz + 0.02);
  out.paving.push(...paving(-H, H, pz0 - 0.3, H, 0.06, seed + 40, { rowW: 0.8, minL: 0.7, maxL: 1.3, lod, skip, tone: 0.06, grime: 0.15 }));
  // A kerb of travertine at the precinct's street edge.
  out.trav.push(box(2 * H, 0.1, 0.18, 0, 0, H - 0.09, 0.9));
  // The floor of the porch: marble flags on the podium.
  out.marble.push(...paving(-px + 0.05, px - 0.05, HZ1, pz1 + 0.06, 0.03, seed + 50, { rowW: 0.9, minL: 0.9, maxL: 1.5, lod, tone: 0.05, grime: 0.05 }).map((p) => p.translate(0, PY, 0)));
}

/** The hall: walls (brick sides and back, the front stuccoed and scored as marble), cornice, windows, the doorway, the pediment and the roof. */
function hall(lod, seed, out) {
  const top = C.eave;
  const [dw, dh] = C.door;
  const wins = [[-3.0, 0.95], [0, 1.05], [3.0, 0.95]];
  const winY = [8.15, 9.2];
  // The front wall: openings for the door and the three windows.
  const ops = [{ a: -dw, b: dw, lo: PY, hi: PY + dh }, ...wins.map(([x, w]) => ({ a: x - w / 2, b: x + w / 2, lo: winY[0], hi: winY[1] }))];
  // (Between the brick sides, which run the hall's whole length: no two faces in one plane at the corners.)
  out.stucco.push(...wallAlong('x', -HX + WALL, HX - WALL, HZ1 - WALL / 2, WALL, PY, top, ops, 0.97));
  // Scored as marble blocks (close up): joints in courses, each course's joints a half block on from the last.
  if (lod === 0) {
    const course = 0.62;
    const blockL = 1.25;
    const z = HZ1 + 0.004;
    for (let y = PY + course, i = 0; y < top - 0.1; y += course, i++) {
      // (Each course's bed joint broken where an opening crosses it.)
      let x0 = -HX + WALL;
      for (const o of [...ops].sort((p, q) => p.a - q.a)) {
        if (y < o.lo - 0.01 || y > o.hi + 0.01) continue;
        if (o.a - 0.05 > x0) out.joints.push(box(o.a - 0.05 - x0, 0.022, 0.008, (x0 + o.a - 0.05) / 2, y, z));
        x0 = o.b + 0.05;
      }
      out.joints.push(box(HX - WALL - x0, 0.022, 0.008, (x0 + HX - WALL) / 2, y, z));
      for (let x = -HX + WALL + (i % 2 ? blockL / 2 : blockL); x < HX - WALL - 0.1; x += blockL) {
        const inOpening = ops.some((o) => x > o.a - 0.02 && x < o.b + 0.02 && y + course > o.lo && y < o.hi);
        if (!inOpening) out.joints.push(box(0.022, course - 0.022, 0.008, x, y - course + 0.022, z));
      }
    }
  }
  // The windows' frames and sills in marble; the dark of the hall behind them.
  for (const [x, w] of wins) {
    out.marble.push(box(w + 0.3, 0.12, 0.2, x, winY[0] - 0.12, HZ1 + 0.05, 0.95));
    out.marble.push(box(w + 0.3, 0.16, 0.12, x, winY[1], HZ1 + 0.03, 0.95));
    for (const s of [-1, 1]) out.marble.push(box(0.12, winY[1] - winY[0], 0.08, x + s * (w / 2 + 0.06), winY[0], HZ1 + 0.03, 0.93));
    out.dark.push(darkIn('x', x - w / 2, x + w / 2, winY[0], winY[1], HZ1 - WALL, -1));
    // A grille of bronze bars across the opening (close up).
    if (lod === 0) for (let k = 1; k < 4; k++) out.bronze.push(box(0.025, winY[1] - winY[0], 0.025, x - w / 2 + (k * w) / 4, winY[0], HZ1 - WALL / 2));
  }
  // The doorway: a frame of marble, the tablet over it cut S·P·Q·R.
  for (const s of [-1, 1]) out.marble.push(box(0.26, dh + 0.1, 0.12, s * (dw + 0.13), PY, HZ1 + 0.06, 0.96));
  out.marble.push(box(2 * dw + 0.7, 0.3, 0.16, 0, PY + dh, HZ1 + 0.08, 0.96));
  out.marble.push(box(2 * dw + 0.9, 0.08, 0.24, 0, PY + dh + 0.3, HZ1 + 0.1, 0.98));
  out.marble.push(box(2.2, 0.62, 0.08, 0, PY + dh + 0.52, HZ1 + 0.04, 0.97));
  if (lod === 0) out.letters.push(...letters('S·P·Q·R', PY + dh + 0.66, HZ1 + 0.085, 0.32));
  else if (lod === 1) out.letters.push(box(1.5, 0.3, 0.006, 0, PY + dh + 0.66, HZ1 + 0.084));
  // The threshold and the floor inside the doorway (coloured marble), the hall's dark beyond.
  out.floor.push(box(2 * dw, 0.03, WALL + 1.4, 0, PY, HZ1 - (WALL + 1.4) / 2, 0.9));
  if (lod === 0) {
    // Opus sectile: squares of porphyry and giallo antico in the white, as the Curia's floor.
    for (let k = 0; k < 4; k++) {
      for (const s of [-1, 1]) {
        out.floor.push(box(0.42, 0.034, 0.42, s * 0.62, PY, HZ1 - WALL - 0.2 - k * 0.55, () => (k + (s > 0 ? 1 : 0)) % 2 ? [0.42, 0.12, 0.1] : [0.85, 0.66, 0.3]));
      }
    }
  }
  out.dark.push(box(2 * dw + 0.2, dh, 0.05, 0, PY, HZ1 - WALL - 1.45));
  for (const s of [-1, 1]) out.dark.push(box(0.05, dh, 1.5, s * (dw + 0.05), PY, HZ1 - WALL - 0.72));
  // The sides and the back: brick, with three arched windows high in each side.
  for (const s of [-1, 1]) {
    const L = HZ1 - HZ0;
    const w = wallWithOpenings(L, top - PY, WALL, lod === 2 ? [] : [-2.6, 0, 2.6].map((x) => ({ x, w: 1.05, h: 1.3, y: 6.4 - PY, arch: true })), { lod, y0: PY });
    w.rotateY(s * Math.PI / 2);
    w.translate(s * HX, 0, (HZ1 + HZ0) / 2);
    out.brick.push(w);
    if (lod < 2) {
      for (const zz of [-2.6, 0, 2.6]) {
        const z = (HZ1 + HZ0) / 2 + zz;
        out.dark.push(darkIn('z', z - 0.55, z + 0.55, 6.4, 6.4 + 1.3 + 0.53, s * (HX - WALL), -s));
        out.marble.push(box(0.16, 0.08, 1.3, s * (HX + 0.06), 6.32, z, 0.95));
      }
    }
  }
  out.brick.push(box(2 * HX, top - PY, WALL, 0, PY, HZ0 + WALL / 2));
  // A plinth course of travertine round the brick, at the floor.
  for (const s of [-1, 1]) out.trav.push(box(0.08, 0.5, HZ1 - HZ0, s * (HX + 0.04), PY, (HZ1 + HZ0) / 2, 0.92));
  out.trav.push(box(2 * HX + 0.16, 0.5, 0.08, 0, PY, HZ0 - 0.04, 0.92));
  // The cornice round the eave (stucco on brick corbels, as the Curia's).
  const hz = (HZ1 - HZ0) / 2;
  const cz = (HZ1 + HZ0) / 2;
  const cor = frameSweep([[0, 0], [0.06, 0.05], [0.06, 0.14], [0.14, 0.2], [0.26, 0.24], [0.26, 0.34], [-0.3, 0.34]], HX, hz, { tint: (p) => (p.y < 0.15 ? 0.88 : 0.97) });
  cor.translate(0, top, cz);
  out.stucco.push(cor);
  if (lod === 0) {
    // Its corbels (modillions) along the sides and the front.
    for (let z = HZ0 + 0.4; z < HZ1; z += 0.6) for (const s of [-1, 1]) out.stucco.push(box(0.14, 0.09, 0.1, s * (HX + 0.1), top + 0.05, z, 0.9));
    for (let x = -HX + 0.3; x < HX; x += 0.6) out.stucco.push(box(0.1, 0.09, 0.14, x, top + 0.05, HZ1 + 0.1, 0.9));
  }
  // The roof: a tiled gable from front to back, its ridge along the hall.
  const roof = gable({ x0: -HX - 0.05, x1: HX + 0.05, z0: HZ0, z1: HZ1, eaveY: top + 0.34, pitch: D(23), along: 'z', lod, seed: seed + 60, over: 0.32, gableOver: 0.28 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  const apex = roof.ridgeY;
  // The pediment: its tympanum set back in the frame of the raking cornices, an oak wreath in gilt bronze in it.
  const pz = HZ1;
  const py0 = top + 0.34;
  out.stucco.push(gableTri(-HX + 0.05, HX - 0.05, pz - 0.06, WALL - 0.06, py0, apex - 0.05));
  out.brick.push(gableTri(-HX + 0.05, HX - 0.05, HZ0 + WALL, WALL, py0, apex - 0.05));
  for (const s of [-1, 1]) {
    out.stucco.push(rake(s * (HX + 0.3), py0 - 0.06, 0, apex + 0.04, pz + 0.12, 0.42, 0.22));
    if (lod === 0) out.stucco.push(rake(s * (HX + 0.15), py0 - 0.12, 0, apex - 0.1, pz + 0.04, 0.26, 0.1, 0.9));
  }
  if (lod < 2) {
    const wy = (py0 + apex) / 2 - 0.12;
    const wreath = new TorusGeometry(0.42, 0.075, lod ? 5 : 8, lod ? 14 : 28);
    wreath.translate(0, wy, pz - 0.03);
    out.gilt.push(tintGeometry(boxUV(wreath)));
    if (lod === 0) {
      // Its oak leaves, and the ribbons trailing from its foot.
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        const leaf = new SphereGeometry(0.075, 5, 3);
        leaf.scale(0.7, 1.4, 0.5);
        leaf.rotateZ(a);
        leaf.translate(Math.sin(a) * 0.42, wy + Math.cos(a) * 0.42, pz + 0.03);
        out.gilt.push(tintGeometry(boxUV(leaf)));
      }
    }
  }
  // Victory on her globe at the gable's top, gilt; palmettes at its corners.
  out.marble.push(slab(0.62, 0.32, 0.62, { bevel: 0.02, seed: seed + 70, wobble: 0, tone: 0, grime: 0 }).translate(0, apex - 0.04, pz + 0.05));
  out.gilt.push(...victory(0, apex + 0.28, pz + 0.05, 0.92, lod));
  for (const s of [-1, 1]) {
    out.marble.push(slab(0.46, 0.22, 0.46, { bevel: 0.02, seed: seed + 72 + s, wobble: 0, tone: 0, grime: 0 }).translate(s * (HX + 0.05), py0 - 0.04, pz + 0.05));
    if (lod < 2) {
      const palm = revolve(profileOf([[0, 0], [0.12, 0], [0.2, 0.18], [0.16, 0.42], [0.06, 0.58], [0, 0.6]]), { segments: lod ? 6 : 10, metres: 0.5 });
      palm.scale(1, 1, 0.3);
      palm.translate(s * (HX + 0.05), py0 + 0.18, pz + 0.05);
      out.gilt.push(palm);
    }
  }
}

/** The porch: the entablature on the columns (instanced apart), its roof, the antae, the benches and the lampstands. */
function porch(lod, seed, out) {
  const ab = PY + C.colH;
  const pz = C.porchZ;
  const xL = C.cols[C.cols.length - 1] + 0.42;
  const zf = pz + 0.42;
  // The antae: pilasters on the hall's front at the porch's ends, under the entablature's returns.
  for (const s of [-1, 1]) out.marble.push(box(0.56, C.colH, 0.24, s * C.cols[C.cols.length - 1], PY, HZ1 + 0.12, 0.95));
  // Architrave (three fasciae), frieze (CVRIA), cornice: along the front and back along each side to the hall.
  const runs = [
    (y, h, d, k) => box(2 * xL, h, d, 0, y, pz, k),
    ...[-1, 1].map((s) => (y, h, d, k) => box(d, h, zf - HZ1, s * C.cols[C.cols.length - 1], y, (zf + HZ1) / 2, k)),
  ];
  const bands = lod === 2 ? [[0, 1.12, 0.58, 0.96]] : [[0, 0.17, 0.56, 0.95], [0.17, 0.17, 0.6, 0.97], [0.34, 0.17, 0.64, 0.99], [0.51, 0.42, 0.58, 0.95], [0.93, 0.12, 0.74, 0.97], [1.05, 0.12, 0.86, 0.99]];
  for (const run of runs) for (const [y, h, d, k] of bands) out.marble.push(run(ab + y, h, d, k));
  const fr = ab + 0.51;
  if (lod === 0) out.letters.push(...letters('CVRIA', fr + 0.06, pz + 0.295, 0.3));
  else if (lod === 1) out.letters.push(box(1.7, 0.28, 0.006, 0, fr + 0.07, pz + 0.294));
  // The porch's roof: a low tiled slope from the hall's front down to the cornice, boards under it.
  const top = ab + 1.17;
  const r = slope([[xL + 0.1, top - 0.02, zf + 0.05], [-xL - 0.1, top - 0.02, zf + 0.05], [-xL - 0.1, top + 0.32, HZ1 + 0.02], [xL + 0.1, top + 0.32, HZ1 + 0.02]], { lod, seed: seed + 5 });
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  // The coffered ceiling under it (close up): beams across from the columns to the wall.
  if (lod === 0) for (const x of C.cols) out.marble.push(box(0.3, 0.22, pz - HZ1, x, ab - 0.0 + 0.0 + 0.9, (pz + HZ1) / 2, 0.85));
  // Marble benches along the hall's front, either side of the door.
  for (const s of [-1, 1]) {
    const bx = s * 3.15;
    out.sheltered.push(slab(1.9, 0.08, 0.5, { bevel: 0.01, seed: seed + 10 + s, wobble: 0, tone: 0, grime: 0 }).translate(bx, PY + 0.4, HZ1 + 0.35));
    for (const e of [-1, 1]) out.sheltered.push(slab(0.16, 0.4, 0.44, { bevel: 0.012, seed: seed + 12 + e, wobble: 0.002, tone: 0.03, grime: 0.2 }).translate(bx + e * 0.78, PY, HZ1 + 0.35));
  }
  // Bronze lampstands (candelabra) on lion's-foot tripods, a lantern on each.
  for (const [lx, ly, lz] of C.lamps) {
    out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.025, 0.035, ly - PY - 0.1, lod ? 5 : 8, 1).translate(lx, PY + (ly - PY - 0.1) / 2 + 0.06, lz))));
    out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.11, 0.06, 0.06, lod ? 5 : 10, 1).translate(lx, ly - 0.06, lz))));
    if (lod < 2) {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const leg = new BoxGeometry(0.03, 0.03, 0.26);
        leg.rotateX(0.5);
        leg.rotateY(a);
        leg.translate(lx + Math.sin(a) * 0.09, PY + 0.07, lz + Math.cos(a) * 0.09);
        out.bronze.push(tintGeometry(boxUV(leg)));
      }
      const l = lantern(lx, ly - 0.01, lz, lod);
      out.bronze.push(...l.bronze);
      out.pane.push(l.pane);
    }
  }
}

/** The honorary statues at the foot of the steps: bronze men in the toga on inscribed pedestals. */
function statues(lod, seed, out) {
  const [sw, sz] = C.steps;
  for (const s of [-1, 1]) {
    const st = statue(s * (sw + 0.3), sz - 0.55, s * -0.25, { y0: 0.06, h: 1.15, kind: 'togate', lod, base: 0.95 });
    out.trav.push(...st.base);
    out.statue.push(...st.statue);
  }
}

/** The senators and the magistrate's lictors (staffed, close up only). */
function senators(mats) {
  const [, sz, n] = C.steps;
  const rise = PY / n;
  const tread = (sz - C.podium[1]) / n;
  const list = [];
  // Coming up the steps, and one arriving at their foot.
  list.push(...togate(mats, -1.15, rise * 3, sz - 3 * tread + 0.18, Math.PI + 0.1, { hair: 0x8a8070 }));
  list.push(...togate(mats, 0.9, rise * 1, sz - 1 * tread + 0.18, Math.PI - 0.15, { hair: 0x2e2119 }));
  list.push(...togate(mats, 1.9, 0.06, sz + 0.75, Math.PI - 0.5, { hair: 0x4a3828, arms: 'hold' }));
  // Two talking in the porch.
  list.push(...togate(mats, -3.05, PY, 2.25, 0.85, { hair: 0xb8b0a0, arms: 'orate' }));
  list.push(...togate(mats, -2.35, PY, 2.75, -2.3, { hair: 0x2a1e14 }));
  // Two seated on the bench to the right.
  list.push(...togate(mats, 2.6, PY, HZ1 + 0.42, 0.1, { sit: 0.46, arms: 'lap', hair: 0x6a6058 }));
  list.push(...togate(mats, 3.65, PY, HZ1 + 0.42, -0.25, { sit: 0.46, arms: 'teach', hair: 0x2a1e14 }));
  // The magistrate at the door, in the toga with its purple border.
  list.push(...togate(mats, 0.35, PY, HZ1 + 0.95, 0.2, { praetexta: true, arms: 'orate', hair: 0x3a2a1c }));
  // His lictors waiting at the foot of the steps, the fasces on their shoulders.
  list.push(...lictor(mats, -2.55, 0.06, sz + 0.55, 0.2));
  list.push(...lictor(mats, -1.75, 0.06, sz + 0.7, -0.1));
  return list;
}

/** Build the curia: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut', 'out'). The porch's columns are not in it (government.js). */
export function buildCuria({ lod = 0, seed = 401 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['trav', 'paving', 'marble', 'stucco', 'joints', 'brick', 'tile', 'wood', 'bronze', 'gilt', 'letters', 'dark', 'floor', 'statue', 'pane', 'sheltered'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  podium(lod, seed, out);
  hall(lod, seed + 100, out);
  porch(lod, seed + 200, out);
  statues(lod, seed + 300, out);
  const m = govMaterials();
  const p = new TaggedParts('curia');
  const small = { cast: false };
  if (lod === 2) out.letters = [];
  p.add('stone', m.trav, out.trav);
  p.add('paving', m.trav, out.paving, small);
  p.add('marble', m.marble, out.marble);
  p.add('stucco', m.stucco, out.stucco);
  p.add('joints', m.joint, out.joints, small);
  p.add('brick', m.brick, out.brick);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  p.add('bronze', m.bronze, out.bronze, { cast: lod === 0 });
  p.add('gilt', m.gilt, out.gilt);
  p.add('letters', m.letters, out.letters, small);
  p.add('inside', m.dark, out.dark, small);
  // The porch's floor inside the door and its benches under the roof: no snow on them.
  p.add('floor', m.shelteredMarble, [...out.floor, ...out.sheltered], small);
  p.add('statues', m.statueBronze, out.statue);
  // The doors: bronze, shut (idle, or barred against a mob) or open (in session).
  const [dw, dh] = C.door;
  const shut = doubleDoor(0, HZ1 - WALL / 2 + 0.05, 2 * dw, dh, PY, { open: false, lod, metal: true });
  const open = doubleDoor(0, HZ1 - WALL / 2 + 0.05, 2 * dw, dh, PY, { open: true, lod, metal: true });
  p.add('doors', m.bronze, open.bronze, { when: 'open' });
  p.add('doors', m.bronze, shut.bronze, { when: 'shut' });
  p.add('doors', m.bronze, shut.bronze.map((g) => g.clone()), { when: 'out' });
  // The lanterns' panes: lit while there is anyone there (in session, or the guard), dark when idle.
  p.add('lamp', lanternPane(), out.pane, { when: 'staffed', cast: false });
  p.add('lamp', m.lampOut, out.pane.map((g) => g.clone()), { when: 'shut', cast: false });
  if (lod === 0) {
    addPeople(p, m, 'senators', senators(m), 'open');
    for (const s of [-1, 1]) addPeople(p, m, 'guard', guard(m, s * 1.05, PY, C.podium[1] - 0.15, 0), 'out');
  }
  return p.build();
}

/** The curia's lamps for models.js modelLamps: the porch's lanterns, facing the street. */
export const CURIA_LAMPS = Object.freeze(C.lamps.map(([x, y, z]) => Object.freeze([x, y + 0.1, z, 1])));

