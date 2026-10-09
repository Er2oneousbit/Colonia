/**
 * models/theatrum.js
 * ----------------------------------------------------------------------------
 * The theatre of the 3D look on its 2 x 2 footprint (8 m), from the record
 * rather than the 2D sprite:
 *
 *   - Pompeii's two theatres: the Large Theatre on the slope by the
 *     Triangular Forum, its cavea in three tiers (the ima cavea's four broad
 *     steps for the decurions' chairs, the bronze letters of the Holconii
 *     who rebuilt it under Augustus), its stage of brick faced in marble;
 *     the Small Theatre (the theatrum tectum, about 80 BC) beside it, the
 *     cavea held between two walls, its parapet ends carved as kneeling
 *     Atlas figures, the tribunals over the passages.
 *   - Vitruvius (V.6-7) on the Roman theatre: the orchestra a half circle,
 *     the stage (pulpitum) no higher than five feet so the seated could
 *     see, the scaenae frons with its three doors (the royal door in the
 *     middle, the guests' doors either side), the passages (aditus) between
 *     the cavea and the stage covered by the tribunals.
 *   - The stages of Orange, Sabratha and Merida for the scaenae frons: two
 *     orders of columns in coloured marbles standing proud of the wall in
 *     pairs, framing the doors, an entablature broken over each pair,
 *     statues in niches between; the pulpitum's front cut with rectangular
 *     and curved niches.
 *   - The velarium: linen awnings on masts round the top of the cavea,
 *     spread on show days (Pompeii's painted notices promise "vela
 *     erunt": there will be awnings).
 *
 * So, in 8 m: the cavea a half circle open to the back (-z), a broad step
 * for the decurions' chairs round the orchestra and four rows of seats, a
 * parapet and walkway at the top, its outer wall dressed with pilasters and
 * the arched mouths of the stairs (vomitoria); masts on the parapet with
 * the awning spread over the top row on show days, furled on their yards
 * otherwise; the orchestra paved in coloured marble; the passages either
 * side under the tribunals (the editor of the games in his chair on one);
 * the stage of boards on its niched front, two lampstands; the scaenae
 * frons in two orders round the three doors, panelled in coloured marble,
 * statues in the upper niches; the stage house behind under a lean-to of
 * tiles.
 *
 * The cavea faces the back (-z) and the stage stands behind it: from the
 * game's camera, which looks from the front, the audience is seen from
 * behind and above, watching the actors, who face the camera; turned, the
 * view looks over the stage house at the faces of the crowd.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'   a play on (staffed, actors booked: sim/entertainment.js): the
 *            awning spread, the lamps and torches lit, the royal door open,
 *            the crowd and the actors (models/venues.js)
 *   'out'    staffed, no play booked: the doors open, the awning furled,
 *            a stagehand sweeping the boards
 *   'shut'   no staff: the doors shut, nobody
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { TaggedParts } from './masonry.js';
import { column, statue, lin, D } from './domus.js';
import {
  venueMaterials, flatParts, sweep, ellipseCurves, caveaProfile, box, staff, lampstand, torch, gates, stone, rowSeats, sheet,
} from './venue.js';

/** The theatre's measures (metres): the tests, the lab and the game read them. */
export const THEATRUM = Object.freeze({
  half: 4,
  /** The orchestra's centre (z) and radius: the cavea's half circles are about it. */
  cz: -1.0,
  orchestra: 0.82,
  /** The stage: its floor's height, its front's z, its half width; the scaenae frons's face. */
  stageY: 0.55,
  stageZ: -1.55,
  stageX: 2.85,
  frons: -2.45,
  /** The frons's top, the stage house's back wall. */
  frontTop: 3.05,
  back: -3.95,
});

const T = THEATRUM;
/** The cavea: a low step round the orchestra, the broad step of the decurions' chairs, four rows of seats. */
const CAVEA = caveaProfile({ podium: 0.16, walk: 0.62, tiers: [[4, 0.55, 0.34, 0]] });
/** The walkway and parapet at the top, and the outer wall (d from the orchestra's edge). */
const TOP = Object.freeze({ d: CAVEA.top.d, y: CAVEA.top.y, par: 0.46, wall: 0.1 });
const OUTER = T.orchestra + TOP.d + TOP.wall;
/** The curve family: half circles about the orchestra's centre, from the right end (+x) to the left (-x). */
const AT = ellipseCurves(T.orchestra, T.orchestra, 0, Math.PI, 0, T.cz);

/** The masts round the top of the cavea (angles), and their height. */
const MASTS = [0, 1, 2, 3, 4, 5, 6].map((k) => (k * Math.PI) / 6);
const MAST_H = 1.7;

/** The front door of each vomitorium (angle of the cavea): the stairs up to the walkway. */
const VOMITORIA = [D(38), D(90), D(142)];

/** A colour of the marbles the stages were faced with (linear RGB). */
const MARBLE = {
  giallo: lin(0xe2c27a), cipollino: lin(0xb8c4b0), pavonazzetto: lin(0xece4e0), africano: lin(0x6a5a52), porphyry: lin(0x7a2e2e), white: lin(0xf2efe8), verde: lin(0x4f6a58),
};

/**
 * A column (domus.js column, its shaft smooth: the stages' shafts were
 * polished coloured stone, never fluted), made once by order, height and
 * level and copied: a frons's sixteen columns were most of its kit's
 * making.
 */
const COLUMNS = new Map();
function columnCopy(order, h, lod) {
  const key = `${order}|${h}|${lod}`;
  let c = COLUMNS.get(key);
  if (!c) {
    c = column(order, h, lod, { smooth: true });
    COLUMNS.set(key, c);
  }
  return { stone: c.stone.map((g) => g.clone()), cap: c.cap.map((g) => g.clone()) };
}

/** Paint a geometry's existing vertex colours times a linear colour. */
function tinted(g, c) {
  const col = g.attributes.color;
  if (!col) return tintGeometry(g, () => c);
  for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * c[0], col.getY(i) * c[1], col.getZ(i) * c[2]);
  return g;
}

/** The cavea: the steps swept round the orchestra, the parapet, the outer wall and its dressing, the end walls. */
function cavea(lod, p, M) {
  const n = lod === 0 ? 48 : lod === 1 ? 24 : 12;
  // Steps, walkway and parapet, the outer wall: one profile from the orchestra's edge round and down.
  const prof = [...CAVEA.profile, [TOP.d, TOP.y + TOP.par], [TOP.d + TOP.wall, TOP.y + TOP.par], [TOP.d + TOP.wall, 0]];
  // A riser darker than its tread (the shade under each step's nose), the walls a little warmer.
  const tint = (x, y, z, i) => {
    const tread = i >= 3 && i < CAVEA.profile.length - 1 && (i - 3) % 2 === 1;
    const k = tread ? 1.0 : 0.82;
    return [k, k * 0.98, k * 0.94];
  };
  p.add('seats', M.seats, sweep(AT, prof, n, { tint }));
  // The end walls (analemmata) at either end of the half circle, facing the stage (-z): the profile's section filled.
  for (const s of [1, -1]) p.add('seats', M.seats, endWall(s, prof));
  // The parapet's coping (marble) and its walkway's edge.
  p.add('marble', M.marble, sweep(AT, [[TOP.d - 0.03, TOP.y + TOP.par], [TOP.d - 0.03, TOP.y + TOP.par + 0.05], [TOP.d + TOP.wall + 0.04, TOP.y + TOP.par + 0.05], [TOP.d + TOP.wall + 0.04, TOP.y + TOP.par]], n, { tint: () => 0.95 }));
  // The orchestra's rim: a marble kerb, and the proedria's step faced in marble.
  p.add('marble', M.marble, sweep(AT, [[-0.02, 0], [-0.02, 0.17], [0.05, 0.17]], n, { tint: () => 0.92 }));
  // The outer wall's dressing: pilasters, a string course, the arched mouths of the vomitoria.
  if (lod < 2) {
    for (let k = 0; k <= 12; k++) {
      const th = (k / 12) * Math.PI;
      const g = box(0.22, TOP.y + TOP.par - 0.05, 0.06, 0, 0, 0, 0.92);
      g.rotateY(-th + Math.PI / 2);
      const [x, z] = AT(TOP.d + TOP.wall + 0.03, th / Math.PI);
      g.translate(x, 0, z);
      p.add('trav', M.trav, g);
    }
    p.add('trav', M.trav, sweep(AT, [[TOP.d + TOP.wall, 1.02], [TOP.d + TOP.wall + 0.06, 1.02], [TOP.d + TOP.wall + 0.06, 1.1], [TOP.d + TOP.wall, 1.12]], n, { tint: () => 0.95 }));
  }
  for (const th of VOMITORIA) {
    const [x, z] = AT(TOP.d + TOP.wall + 0.005, th / Math.PI);
    const ry = -th + Math.PI / 2;
    const mouth = box(0.62, 1.05, 0.03, 0, 0, 0, 1);
    const arch = new CylinderGeometry(0.31, 0.31, 0.03, lod ? 8 : 14, 1, false, -Math.PI / 2, Math.PI);
    arch.rotateX(-Math.PI / 2);
    arch.translate(0, 1.05, 0);
    for (const g of [mouth, tintGeometry(boxUV(arch))]) {
      g.rotateY(ry);
      g.translate(x, 0, z);
      p.add('dark', M.dark, g);
    }
    // The voussoirs round it.
    if (lod === 0) {
      for (let k = 0; k <= 6; k++) {
        const a = Math.PI * (k / 6);
        const v = box(0.12, 0.1, 0.05, Math.cos(a) * 0.37, 1.05 + Math.sin(a) * 0.37 - 0.05, 0, 0.98);
        v.rotateY(ry);
        v.translate(x, 0, z);
        p.add('trav', M.trav, v);
      }
    }
  }
}

/** One end wall of the cavea (s +1 at +x, -1 at -x): the profile's section in the plane z = cz, facing -z. */
function endWall(s, prof) {
  const out = [];
  // A box under each step of the profile, from the ground up, in the end's plane: the wall is their union.
  for (let i = 0; i + 1 < prof.length; i++) {
    const [d0, y0] = prof[i];
    const [d1, y1] = prof[i + 1];
    if (d1 - d0 < 0.01) continue;
    const h = Math.max(y0, y1);
    const r0 = T.orchestra + d0;
    const r1 = T.orchestra + d1;
    out.push(box(r1 - r0, h, 0.14, s * (r0 + r1) / 2, 0, T.cz - 0.07, 0.9));
  }
  return out;
}

/** The orchestra: coloured marble in a pattern of rings and rays (opus sectile), and the passages either side. */
function orchestra(lod, p, M) {
  const R = T.orchestra;
  const rings = lod === 2 ? 1 : 3;
  const rays = lod === 0 ? 12 : 6;
  for (let i = 0; i < rings; i++) {
    const r0 = (R * i) / rings;
    const r1 = (R * (i + 1)) / rings;
    for (let j = 0; j < rays; j++) {
      const a0 = (Math.PI * j) / rays;
      const a1 = (Math.PI * (j + 1)) / rays;
      const at = ellipseCurves(r0, r0, a0, a1, 0, T.cz);
      const c = (i + j) % 2 ? MARBLE.giallo : i === rings - 1 ? MARBLE.africano : MARBLE.pavonazzetto;
      p.add('marble', M.marble, sweep(at, [[r1 - r0, 0.025], [0, 0.025]], lod ? 3 : 4, { tint: () => c }));
    }
  }
  // The passages either side, between the cavea's ends and the stage: flagged.
  for (const s of [1, -1]) {
    p.add('paving', M.flags, stone(lod, 3.0, 0.03, T.cz - T.stageZ, s * (T.orchestra + 1.5), 0, (T.cz + T.stageZ) / 2, { seed: 3 + s, tone: 0.04 }));
  }
  // Before the stage, the strip of the orchestra along the diameter.
  p.add('marble', M.marble, box(2 * T.orchestra, 0.025, T.cz - T.stageZ, 0, 0, (T.cz + T.stageZ) / 2, 0.95));
}

/** The stage (pulpitum): its niched front, the floor of boards, the slot of the curtain, two stairs down. */
function stage(lod, p, M) {
  const Y = T.stageY;
  const X = T.stageX;
  const z0 = T.stageZ;
  const z1 = T.frons;
  // The front wall, faced in marble, with niches: rectangular and curved by turns.
  p.add('marble', M.marble, box(2 * X, Y, 0.12, 0, 0, z0 - 0.06, 0.95));
  if (lod < 2) {
    const n = 7;
    for (let k = 0; k < n; k++) {
      const x = -X + ((k + 0.5) * 2 * X) / n;
      if (k % 2) p.add('dark', M.dark, box(0.36, Y - 0.2, 0.02, x, 0.1, z0 + 0.005, 1));
      else {
        const g = new CylinderGeometry(0.2, 0.2, Y - 0.18, lod ? 6 : 10, 1, true, Math.PI / 2, Math.PI);
        g.translate(x, 0.09 + (Y - 0.18) / 2, z0 + 0.0);
        p.add('dark', M.dark, tintGeometry(boxUV(g), () => 1));
      }
    }
  }
  // The floor: boards along x on the stage's depth.
  const boards = lod === 0 ? 9 : 3;
  for (let k = 0; k < boards; k++) {
    const dz = (z0 - z1) / boards;
    p.add('wood', M.wood, box(2 * X, 0.04, dz - 0.01, 0, Y - 0.04, z1 + dz * (k + 0.5), 0.92 + 0.06 * Math.sin(k * 3.1)));
  }
  // The body under the floor, from the front wall back to the frons.
  p.add('stone', M.stone, box(2 * X, Y - 0.04, z0 - z1 - 0.12, 0, 0, (z0 - 0.12 + z1) / 2, 0.75));
  // Stairs down to the orchestra at each end of the front.
  for (const s of [1, -1]) {
    for (let k = 0; k < 3; k++) p.add('marble', M.marble, box(0.36, ((k + 1) * Y) / 4, 0.16, s * (X - 0.3), 0, z0 + 0.08 + (2 - k) * 0.16, 0.9));
  }
}

/** The scaenae frons: the wall panelled in marble, two orders of columns proud of it in pairs, the three doors, statues above. */
function frons(lod, p, M, state) {
  const Y = T.stageY;
  const X = T.stageX + 1.1;
  const zf = T.frons;
  const top = T.frontTop;
  // The wall from the stage to its top (behind the parascaenia too), faced in panels of coloured marble.
  p.add('stucco', M.stucco, box(2 * X, top, 0.28, 0, 0, zf - 0.14, 0.9));
  // The doors' openings: the royal door in a curved recess, the guests' either side.
  const doors = [[0, 0.62, 1.32], [-1.55, 0.48, 1.12], [1.55, 0.48, 1.12]];
  for (const [x, w, h] of doors) p.add('dark', M.dark, box(w, h, 0.02, x, Y, zf + 0.004, 1));
  // The leaves: open while staffed (the royal door wide on a show day), shut otherwise.
  for (const [x, w, h] of doors) {
    for (const [st, open] of [['staffed', true], ['shut', false]]) {
      const g = gates(x, zf + 0.01, w, h, Y, open, lod);
      p.add(`door-wood-${st}`, M.wood, g.wood, { when: st });
      if (g.bronze.length) p.add(`door-bronze-${st}`, M.bronze, g.bronze, { when: st });
    }
  }
  // Marble panels on the wall (lod 0): a dado, upright panels between the columns, a frieze.
  if (lod === 0) {
    const cols = [MARBLE.cipollino, MARBLE.giallo, MARBLE.pavonazzetto, MARBLE.verde];
    for (let k = 0; k < 12; k++) {
      const x = -X + 0.3 + (k * (2 * X - 0.6)) / 11;
      if (doors.some(([dx, w]) => Math.abs(x - dx) < w / 2 + 0.2)) continue;
      p.add('marble', M.marble, tinted(box(0.34, 0.95, 0.02, x, Y + 0.25, zf + 0.004), cols[k % cols.length]));
    }
    p.add('marble', M.marble, tinted(box(2 * X, 0.16, 0.03, 0, Y, zf + 0.012), MARBLE.africano));
    p.add('marble', M.marble, tinted(box(2 * X, 0.12, 0.03, 0, top - 0.42, zf + 0.012), MARBLE.giallo));
  }
  // The columns: the lower order on pedestals in pairs before the wall, the upper smaller; coloured shafts.
  const lowH = 1.15;
  const upH = 0.82;
  const xs = [-2.62, -2.05, -1.0, -0.52, 0.52, 1.0, 2.05, 2.62];
  const shafts = [MARBLE.giallo, MARBLE.cipollino, MARBLE.pavonazzetto, MARBLE.porphyry];
  const cz = zf + 0.26;
  const ped = 0.24;
  xs.forEach((x, k) => {
    if (lod < 2) p.add('marble', M.marble, stone(lod, 0.26, ped, 0.26, x, Y, cz, { seed: k, tone: 0.02 }));
    const lo = columnCopy('corinthian', lowH, lod);
    for (const g of lo.stone) p.add('marble', M.marble, tinted(g.translate(x, Y + ped, cz), shafts[(k >> 1) % 4]));
    for (const g of lo.cap) p.add('marble', M.marble, g.translate(x, Y + ped, cz));
    if (lod < 2) {
      const up = columnCopy('ionic', upH, lod);
      const y2 = Y + ped + lowH + 0.22;
      for (const g of up.stone) p.add('marble', M.marble, tinted(g.translate(x, y2, cz - 0.04), shafts[((k >> 1) + 2) % 4]));
      for (const g of up.cap) p.add('marble', M.marble, g.translate(x, y2, cz - 0.04));
    }
  });
  // The entablatures broken forward over each pair (the lower and the upper), and pediments over the doors.
  const pairs = [[-2.62, -2.05], [-1.0, -0.52], [0.52, 1.0], [2.05, 2.62]];
  for (const [a, b] of pairs) {
    const y1 = Y + ped + lowH;
    p.add('marble', M.marble, box(b - a + 0.34, 0.22, 0.42, (a + b) / 2, y1, zf + 0.21, 0.97));
    if (lod < 2) p.add('marble', M.marble, box(b - a + 0.28, 0.14, 0.34, (a + b) / 2, y1 + 0.22 + upH, zf + 0.17, 0.97));
  }
  // The continuous cornice between, and the top.
  p.add('marble', M.marble, box(2 * X, 0.12, 0.2, 0, Y + ped + lowH + 0.05, zf + 0.1, 0.92));
  p.add('marble', M.marble, box(2 * X + 0.1, 0.12, 0.32, 0, top - 0.12, zf + 0.04, 0.95));
  // Pediments: a triangle over each guests' door, a curved one over the royal door.
  if (lod < 2) {
    for (const x of [-1.55, 1.55]) {
      // (A four-sided cone turned to face front and flattened: a triangle, its apex up.)
      const g = new CylinderGeometry(0.0001, 0.42, 0.24, 4, 1);
      g.rotateY(Math.PI / 4);
      g.scale(1.3, 1, 0.22);
      g.translate(x, Y + 1.32 + 0.12, zf + 0.06);
      p.add('marble', M.marble, tintGeometry(boxUV(g), () => 0.94));
    }
    const arc = new CylinderGeometry(0.46, 0.46, 0.12, lod ? 8 : 16, 1, false, -Math.PI / 2, Math.PI);
    arc.rotateX(-Math.PI / 2);
    arc.translate(0, Y + 1.42, zf + 0.06);
    p.add('marble', M.marble, tintGeometry(boxUV(arc), () => 0.94));
  }
  // Statues in the upper order's bays: muses and a god in the middle, in marble.
  if (lod < 2) {
    const y2 = Y + ped + lowH + 0.22;
    for (const [k, x] of [-1.55, 0, 1.55].entries()) {
      p.add('dark', M.dark, box(0.36, 0.72, 0.02, x, y2 + 0.04, zf + 0.004, 1));
      const s = statue(x, zf + 0.16, 0, { y0: y2 - 0.21, h: 0.2, kind: k === 1 ? 'nude' : 'draped', lod, scale: 0.42, base: 0.3 });
      p.add('marble', M.marble, s.statue);
    }
  }
  // The lampstands at the stage's ends (lit on a show day).
  for (const s of [1, -1]) {
    const l = lampstand(s * (T.stageX - 0.25), T.stageZ - 0.3, 1.25, Y, lod);
    p.add('bronze', M.bronze, l.bronze);
    p.add('flame', M.flame, l.flames, { when: 'open', cast: false });
    p.add('embers', M.embers, l.hot, { when: 'open', cast: false });
  }
  void state;
}

/** The stage house behind the frons (its lean-to of tiles) and the wings either side (parascaenia). */
function house(lod, p, M) {
  const zf = T.frons - 0.28;
  const zb = T.back;
  const X = T.half - 0.05;
  const hb = 2.4;
  // Walls: the back with its doors, the two ends.
  // (Brick outside, as the stage buildings of Orange and Ostia stand, travertine at the corners and in a plinth.)
  p.add('brick', M.brick, box(2 * X, hb, 0.24, 0, 0, zb + 0.12, 0.95));
  for (const s of [1, -1]) p.add('brick', M.brick, box(0.24, hb, zf - zb, s * (X - 0.12), 0, (zf + zb) / 2, 0.95));
  p.add('trav', M.trav, box(2 * X + 0.04, 0.3, 0.28, 0, 0, zb + 0.12, 0.92));
  p.add('trav', M.trav, box(2 * X + 0.04, 0.12, 0.3, 0, hb - 0.12, zb + 0.12, 0.95));
  for (const s of [1, -1]) {
    p.add('trav', M.trav, box(0.28, 0.3, zf - zb, s * (X - 0.12), 0, (zf + zb) / 2, 0.92));
    p.add('trav', M.trav, box(0.3, 0.12, zf - zb, s * (X - 0.12), hb - 0.12, (zf + zb) / 2, 0.95));
  }
  for (const x of [-1.6, 0, 1.6]) p.add('dark', M.dark, box(0.55, 1.05, 0.02, x, 0, zb - 0.004, 1));
  // The lean-to roof: tiles from the frons's top down to the back wall's, as boards and a tiled face.
  const y0 = T.frontTop - 0.1;
  const y1 = hb;
  const slopeL = Math.hypot(zf - zb, y0 - y1);
  // (Its eave over the back wall, within the footprint.)
  const tiles = box(2 * X + 0.08, 0.08, slopeL + 0.04, 0, -0.04, 0, 1);
  // (High at the frons, down to the back wall: a turn about x that lifts +z.)
  tiles.rotateX(-Math.atan2(y0 - y1, zf - zb));
  tiles.translate(0, (y0 + y1) / 2, (zf + zb) / 2);
  p.add('tile', M.tile, tiles);
  if (lod === 0) {
    // The imbrices' ridges down the slope.
    for (let k = 0; k < 22; k++) {
      const x = -X + (k + 0.5) * ((2 * X) / 22);
      const r = staff([x, y0 + 0.03, zf + 0.04], [x, y1 + 0.03, zb + 0.06], 0.045, 5);
      p.add('tile', M.tile, tintGeometry(r, () => 0.9));
    }
  }
  // The wings (parascaenia): either side of the stage, from the passages back to the frons; a door onto the stage.
  for (const s of [1, -1]) {
    const x0 = T.stageX;
    const x1 = T.half - 0.05;
    const zA = T.stageZ;
    const zB = T.frons;
    p.add('brick', M.brick, box(x1 - x0, 1.9, zA - zB, s * (x0 + x1) / 2, 0, (zA + zB) / 2, 0.95));
    p.add('trav', M.trav, box(x1 - x0 + 0.02, 0.1, zA - zB + 0.02, s * (x0 + x1) / 2, 1.9, (zA + zB) / 2, 0.95));
    p.add('dark', M.dark, box(0.02, 0.9, 0.45, s * (x0 - 0.004), T.stageY, (zA + zB) / 2, 1));
    // The tribunal over the passage: a box from the cavea's end to the wing, its balustrade, at y 1.2.
    const tz0 = T.cz - 0.04;
    const tz1 = zA;
    p.add('trav', M.trav, box(x1 - x0 + 0.5, 0.16, tz0 - tz1, s * (x0 + x1 - 0.5) / 2, 1.18, (tz0 + tz1) / 2, 0.95));
    p.add('marble', M.marble, box(x1 - x0 + 0.5, 0.36, 0.06, s * (x0 + x1 - 0.5) / 2, 1.34, tz0 - 0.03, 0.97));
    p.add('marble', M.marble, box(0.06, 0.36, tz0 - tz1, s * (x0 - 0.22), 1.34, (tz0 + tz1) / 2, 0.97));
  }
}

/** The masts round the top of the cavea, and the velarium: spread on a show day, furled otherwise. */
function velarium(lod, p, M) {
  const R = OUTER - 0.05;
  const y0 = TOP.y + TOP.par;
  const top = y0 + MAST_H;
  for (const th of MASTS) {
    // (Standing in the parapet, braced by a console on the outer wall.)
    const [x, z] = AT(TOP.d + TOP.wall * 0.5, th / Math.PI);
    p.add('wood', M.wood, staff([x, y0 - 0.4, z], [x, top, z], 0.032, lod ? 5 : 8));
    // The console the mast stands in, on the outer wall.
    if (lod < 2) p.add('trav', M.trav, box(0.16, 0.1, 0.16, x, y0 - 0.45, z, 0.92));
    // Furled: the linen rolled on a short yard.
    const roll = new CylinderGeometry(0.07, 0.07, 0.5, lod ? 5 : 8);
    roll.rotateZ(Math.PI / 2);
    roll.rotateY(-th);
    roll.translate(x, top - 0.25, z);
    // (Furled whenever no play is on: the same roll in both those states, two tags of one geometry.)
    const furled = tintGeometry(boxUV(roll), () => lin(0xe8dcc0));
    p.add('velum-furled-out', M.velum, furled, { when: 'out' });
    p.add('velum-furled-shut', M.velum, furled.clone(), { when: 'shut' });
  }
  // Spread: a band of linen from the masts' tops in over the top row, sagging between the masts, stripes of madder.
  const inR = R - 1.15;
  const n = lod === 0 ? 36 : 12;
  const rows = lod === 0 ? 4 : 2;
  const pos = [];
  const cols = [];
  const quads = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const th = Math.PI * t;
    // Sag between the masts (every sixth of the half circle), deepest midway.
    const sag = 0.05 * Math.sin(Math.PI * ((t * 6) % 1));
    for (let j = 0; j <= rows; j++) {
      const s = j / rows;
      const r = R + (inR - R) * s;
      const y = top - 0.06 - s * 0.22 - sag * (0.5 + s) - 0.03 * Math.sin(Math.PI * s);
      pos.push(r * Math.cos(th), y, T.cz + r * Math.sin(th));
      // (Its madder bands close up only: far out a quad is wider than a band.)
      const stripe = lod === 0 && Math.floor(t * 48) % 4 === 0;
      cols.push(...(stripe ? lin(0xa83a2a) : lin(0xeee2c8)));
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) quads.push(i * (rows + 1) + j);
  p.add('velum', M.velum, sheet(pos, cols, quads, rows + 1), { when: 'open' });
  // Its ropes from each mast's top down in to the inner edge.
  if (lod < 2) {
    for (const th of MASTS) {
      const [x, z] = AT(TOP.d + TOP.wall * 0.5, th / Math.PI);
      const ix = inR * Math.cos(th);
      const iz = T.cz + inR * Math.sin(th);
      p.add('rope', M.rope, staff([x, top, z], [ix, top - 0.3, iz], 0.012, 4), { when: 'open', cast: false });
    }
  }
}

/** Torches on the outer wall by the vomitoria (lit on a show day). */
function torches(lod, p, M) {
  for (const th of VOMITORIA) {
    for (const s of [-1, 1]) {
      const a = th + s * 0.16;
      const [x, z] = AT(TOP.d + TOP.wall + 0.12, a / Math.PI);
      // (The bracket and its cold torch: lit, they are the night's light map's, models/venues.js lamps.)
      const t = torch(x, 1.35, z, lod, 0.45);
      p.add('bronze', M.bronze, t.bronze);
    }
  }
}

/**
 * The theatre at a level of detail: { group, meshes, triangles }. Its parts
 * tagged for the states (see the header); the crowd and the people are
 * the registry's (models/venues.js).
 */
export function buildTheatrum({ lod = 0 } = {}) {
  const M = venueMaterials();
  const p = new TaggedParts('theatrum');
  cavea(lod, p, M);
  orchestra(lod, p, M);
  stage(lod, p, M);
  frons(lod, p, M);
  house(lod, p, M);
  velarium(lod, p, M);
  torches(lod, p, M);
  for (const [x, y, z, ry] of CHAIRS) chair(x, y, z, ry, lod, p, M);
  chair(TRIBUNAL[0], TRIBUNAL[1], TRIBUNAL[2], TRIBUNAL[3], lod, p, M, true);
  // The ground round it: flags along the front and the sides.
  p.add('paving', M.flags, box(2 * T.half - 0.02, 0.025, T.half - (T.cz + OUTER) - 0.02, 0, 0, (T.half + T.cz + OUTER) / 2, 0.96));
  return flatParts(p.build());
}

/**
 * Where the crowd sits: [[x, y, z, ry, band], ...] (models/venue.js
 * rowSeats for each row, the togate citizens in the two lower rows, the
 * people above), leaving the vomitoria's stairs clear.
 */
export function theatrumSeats() {
  const out = [];
  CAVEA.rows.forEach((r, k) => {
    // (Clear of the stairs: a gangway where each vomitorium comes up.)
    const skip = (t) => VOMITORIA.some((th) => Math.abs(t * Math.PI - th) < 0.09);
    for (const s of rowSeats(AT, r.d + 0.0, r.y, 0.02, 0.98, skip)) out.push([...s, k < 2 ? 'toga' : k < 3 ? 'plebs' : 'pullati', r.rise]);
  });
  return out;
}

/** The lamps (models.js modelLamps): the lampstands on the stage, the torches by the vomitoria, facing out. */
export const THEATRUM_LAMPS = Object.freeze([
  ...[1, -1].map((s) => Object.freeze([s * (T.stageX - 0.25), T.stageY + 1.35, T.stageZ - 0.3, 1])),
  ...VOMITORIA.map((th) => {
    const [x, z] = AT(TOP.d + TOP.wall + 0.12, th / Math.PI);
    const c = Math.cos(th);
    const sn = Math.sin(th);
    // (Facing out from the cavea: along z mostly, x at its ends.)
    return Object.freeze([x, 1.45, z, Math.abs(sn) >= Math.abs(c) ? 1 : 0, Math.abs(sn) >= Math.abs(c) ? 0 : Math.sign(c)]);
  }),
]);

/** The decurions' chairs on the broad step round the orchestra, and the editor's on the tribunal: [x, y (the floor), z, ry]. */
const CHAIRS = [0.32, 0.6, 2.54, 2.82].map((th) => {
  const r = T.orchestra + 0.32;
  const x = r * Math.cos(th);
  const z = T.cz + r * Math.sin(th);
  // (Turned to the stage's middle.)
  return Object.freeze([x, 0.16, z, Math.atan2(-x, (T.stageZ - 0.4) - z)]);
});
const TRIBUNAL = Object.freeze([T.stageX + 0.42, 1.34, (T.cz + T.stageZ) / 2 + 0.02, -Math.PI / 2 - 0.35]);

/** Where things are, for the people (models/venueActors.js). */
export const THEATRUM_SPOTS = Object.freeze({
  stage: Object.freeze([0, T.stageY, (T.stageZ + T.frons) / 2]),
  chairs: Object.freeze(CHAIRS),
  tribunal: TRIBUNAL,
});

/** A Roman chair at (x, y, z) facing ry, its seat SEAT_H high: the bisellium's bronze frame and cushion, or the curule chair's crossed legs. */
function chair(x, y, z, ry, lod, p, M, curule = false) {
  const H = 0.45;
  const parts = { bronze: [], cloth: [] };
  if (curule) {
    for (const s of [-1, 1]) for (const f of [-1, 1]) parts.bronze.push(staff([s * 0.2, 0, f * 0.16], [s * 0.2, H - 0.04, -f * 0.16], 0.016, 4));
  } else {
    for (const s of [-1, 1]) for (const f of [-1, 1]) parts.bronze.push(box(0.035, H - 0.06, 0.035, s * 0.24, 0, f * 0.15, 0.9));
  }
  parts.bronze.push(box(curule ? 0.46 : 0.56, 0.04, 0.36, 0, H - 0.07, 0, 0.9));
  parts.cloth.push(tintGeometry(box(curule ? 0.44 : 0.54, 0.05, 0.34, 0, H - 0.04, 0), () => lin(curule ? 0x6a2248 : 0x9e2a1c)));
  for (const [k, list] of Object.entries(parts)) {
    for (const g of list) {
      g.rotateY(ry);
      g.translate(x, y, z);
    }
    if (k === 'bronze') p.add('bronze', M.bronze, list);
    else if (lod < 2) p.add('cushion', M.cloth, list);
  }
}
