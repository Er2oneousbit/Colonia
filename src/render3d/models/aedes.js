/**
 * models/aedes.js
 * ----------------------------------------------------------------------------
 * The small temple of the 3D look (aedes, a god's house) on a 2 x 2
 * footprint (8 m), from the record rather than the 2D sprite: the Roman
 * podium temple in small, after the Temple of Portunus by the Tiber (a
 * tetrastyle porch on a high podium, its cella walls set with pilasters,
 * tufa and travertine stuccoed white), the Maison Carree at Nimes (its
 * frieze once carried a dedication in gilt bronze letters, whose pin holes
 * are still read) and the Temple of Hercules at Cori (a deep porch, a
 * plain cella):
 *
 *   - a high podium with a moulded foot and crown, a flight of steps up the
 *     front only, between cheek walls; the porch of four columns across the
 *     front and one more either side behind them (the columns are kits of
 *     their own, instanced, by the god's order: models/religion.js); the
 *     cella behind, its door of bronze, pilasters at its corners; the
 *     entablature round it all, its frieze painted and cut with the
 *     dedication in gilt letters; the pediment with its sculpture on a
 *     painted ground, the acroteria, a tiled roof with terracotta
 *     antefixes; inside, the cult statue on its base against a painted
 *     wall, glimpsed through the open doors.
 *   - the altar in front of the steps, on the precinct's paving: the rite
 *     was done outside, at the altar, in the god's sight through the doors.
 *
 * The builders here take a temple's measures (`AEDES`, or the grand
 * temple's: models/templum.js), so both sizes are one design.
 *
 * One kit (the body: `buildTempleBody`) is the same for every god, so a
 * city's temples of all five gods share it; each god's own kit
 * (`buildTempleGod`) holds what makes it that god's: the painted frieze and
 * pediment, the sculpture, the acroteria, the cult statue, the things left
 * at the altar (models/numina.js says which).
 *
 * States (meshes tagged in userData.when, models.js partShows; the state
 * from models/religion.js templeState):
 *   'open'  staffed: the doors open, the fire lit on the altar, the priest
 *           offering at it with his attendant, a worshipper praying (the
 *           people are actors, people/: templeActors)
 *   'shut'  unstaffed: the doors shut, cold ash on the altar, nobody
 *   'out'   a festival of this god this month: the doors open, garlands
 *           hung between the columns and over the altar, a big fire, a
 *           crowd in wreaths, the flute player, the victim led to the altar
 * Tags: 'staffed' (open or festival), 'open', 'shut', 'out'.
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry } from 'three';
import { frameSweep, revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { slab, paving, TaggedParts, tuscanColumn } from './masonry.js';
import { column, gable, gableTri, rake, wallAlong, darkIn, doubleDoor, letters, textWidth, FRESCO } from './domus.js';
import { sacraMaterials, ara, hearthFire, festoon, box, D, lin } from './sacra.js';
import { DYES } from '../people/actors.js';
import { NUMEN, placeBins, pourBins, acroterion, pedimentRelief, cultStatue, wheatSheaf, plough, anchor, trophy, clipeus, dove, rooster, trident, caduceus, shell } from './numina.js';
import { herm, bush } from './learning.js';

/** The small temple's measures (metres): the game, the lab and the tests read them. */
export const AEDES = Object.freeze({
  name: 'aedes',
  half: 4,
  /** Details' scale (mouldings, dentils, people's spacing): 1 here, more on the grand temple. */
  k: 1,
  /** The podium's top: the porch's and the cella's floor. */
  floorY: 1.35,
  /** The podium: x half width, front z, back z. */
  podium: Object.freeze([2.35, 1.1, -3.65]),
  /** The steps: half width, the foot's z, their number. */
  steps: Object.freeze([1.42, 2.42, 6]),
  /** The cella's outer faces: x half width, front z, back z; its wall's thickness. */
  cella: Object.freeze([2.2, -1.05, -3.55]),
  wall: 0.32,
  /** The columns: the front row's z, their x; the others' places [x, z] (the returns); their height (base to abacus). */
  porchZ: 0.78,
  cols: Object.freeze([-2.04, -0.72, 0.72, 2.04]),
  more: Object.freeze([Object.freeze([-2.04, -0.36]), Object.freeze([2.04, -0.36])]),
  colH: 3.3,
  /** The entablature's height over the abacus. */
  ent: 0.8,
  /** The door: half width, height over the floor. */
  door: Object.freeze([0.58, 2.6]),
  /** The altar's middle (x, z), its size (w, d, h). */
  altar: Object.freeze([0, 3.22, 1.0, 0.66, 0.92]),
  /** The lampstands in the porch either side of the door (x, z). */
  lamps: Object.freeze([Object.freeze([-1.15, -0.55]), Object.freeze([1.15, -0.55])]),
  /** The pitch of the roof (and the pediment). */
  pitch: D(17),
  /** The cella's walls: stucco over tufa (the small temple's) or marble ('marble'). */
  walls: 'stucco',
  /** The cult statue's scale (a man of 1.8 m is 1) and its base [w, h, d]. */
  statue: 1.06,
  base: Object.freeze([0.86, 0.5, 0.7]),
  /** Where the god's things stand: left and right of the steps, the precinct's front corners. */
  spots: Object.freeze({ left: Object.freeze([-2.67, 2.22]), right: Object.freeze([2.67, 2.22]), cornerL: Object.freeze([-2.9, 2.7]), cornerR: Object.freeze([2.9, 2.7]) }),
  /** The festival's crowd [x, z, facing] (on the paving) and on the steps ([x, step, facing]). */
  crowd: Object.freeze([[-2.7, 3.4, 1.9], [-2.95, 2.75, 0.9], [-2.55, 2.1, 1.2], [2.65, 2.35, -1.3], [3.0, 3.1, -1.0], [2.55, 3.45, -2.2]]),
  crowdSteps: Object.freeze([[-0.6, 3, 0.2], [0.45, 4, -0.25]]),
});

/** The measures a temple's builders derive from its own: the abacus, the eave, the entablature's lines, the gable. */
export function templeFrame(M) {
  const PY = M.floorY;
  const AB = PY + M.colH;
  const EAVE = AB + M.ent;
  const colX = Math.max(...M.cols.map(Math.abs));
  const EX = colX + 0.2 * M.k;
  const EZ1 = M.porchZ + 0.2 * M.k;
  const EZ0 = M.cella[2] - 0.04;
  const RISE = (EX + 0.28) * Math.tan(M.pitch);
  return {
    PY, AB, EAVE, EX, EZ1, EZ0,
    // The pediments' tympana (their faces, front and back), the gable's half width, the apex.
    G: { z: EZ1 + 0.06, back: EZ0 - 0.06, hw: EX + 0.28, foot: EAVE, apex: EAVE + RISE, front: EZ1 - 0.06, rear: EZ0 - 0.16 },
  };
}

/** Where a temple's altar fire burns: its hearth (x, y, z). */
export function templeHearth(M) {
  const [x, z, , , h] = M.altar;
  return [x, h + 0.12 + 0.02, z];
}

/** A temple's column places [x, z]: the front row and the others. */
export function templeColumns(M) {
  return Object.freeze([...M.cols.map((x) => Object.freeze([x, M.porchZ])), ...M.more]);
}

/** The lamps for models.js modelLamps: the altar's fire and the porch's lampstands, facing the street. */
export function templeLamps(M) {
  return Object.freeze([
    Object.freeze([M.altar[0], M.altar[4] + 0.5, M.altar[1], 1]),
    ...M.lamps.map(([x, z]) => Object.freeze([x, M.floorY + 1.72 * M.k, z, 1])),
  ]);
}

// ---------------------------------------------------------------------------
// The body (every god's)
// ---------------------------------------------------------------------------

/** The podium, the steps between their cheeks, the porch's floor. */
function podium(M, T, lod, seed, out) {
  const { PY } = T;
  const [px, pz1, pz0] = M.podium;
  const CZ1 = M.cella[1];
  const hz = (pz1 - pz0) / 2;
  const cz = (pz1 + pz0) / 2;
  const k = M.k;
  const prof = lod === 2
    ? [[0.1, 0], [0.1, PY], [-Math.min(px, hz), PY]]
    : [[0.12 * k, 0], [0.12 * k, 0.14 * k], [0.06 * k, 0.2 * k], [0.02 * k, 0.28 * k], [0, 0.3 * k], [0, PY - 0.2 * k], [0.04 * k, PY - 0.16 * k], [0.09 * k, PY - 0.1 * k], [0.11 * k, PY - 0.06 * k], [0.11 * k, PY], [-Math.min(px, hz), PY]];
  out.trav.push(frameSweep(prof, px, hz, { tint: (p) => (p.y < 0.3 * k ? 0.8 : 0.95) }).translate(0, 0, cz));
  const [sw, sz, n] = M.steps;
  const rise = PY / n;
  const tread = (sz - pz1) / n;
  for (let i = 0; i < n; i++) {
    const z0 = sz - (i + 1) * tread;
    out.trav.push(slab(2 * sw, (i + 1) * rise, z0 + tread - pz1 + 0.02, { bevel: 0.012, seed: seed + i, wobble: lod ? 0 : 0.002, tone: 0.03, grime: 0.25 }).translate(0, 0, (pz1 - 0.02 + z0 + tread) / 2));
  }
  // The cheeks either side of the flight, capped with marble.
  const cw = 0.44 * k;
  for (const s of [-1, 1]) {
    const x = s * (sw + cw / 2);
    const z1 = sz - 0.12;
    out.trav.push(slab(cw, PY, z1 - pz1 + 0.05, { bevel: 0.015, seed: seed + 20 + s, wobble: 0, tone: 0.02, grime: 0.3 }).translate(x, 0, (pz1 - 0.05 + z1) / 2));
    out.marble.push(box(cw + 0.06, 0.07 * k, z1 - pz1 + 0.05, x, PY, (pz1 - 0.05 + z1) / 2, 0.95));
  }
  // The porch's floor: marble flags on the podium (sheltered by the roof: no snow).
  out.floor.push(...paving(-px + 0.06, px - 0.06, CZ1, pz1 + 0.06, 0.03, seed + 50, { rowW: 0.7 * k, minL: 0.7 * k, maxL: 1.2 * k, lod, tone: 0.05, grime: 0.05 }).map((p) => p.translate(0, PY, 0)));
}

/** The precinct's paving round the podium and the steps, a kerb at the street; `skip(x, z)` leaves more out. */
function precinct(M, lod, seed, out, skipMore = null) {
  const [px, pz1] = M.podium;
  const [sw, sz] = M.steps;
  const H = M.half - 0.06;
  const cw = 0.44 * M.k;
  const skip = (x, z) => (Math.abs(x) < px + 0.14 && z < pz1 + 0.06) || (Math.abs(x) < sw + cw + 0.02 && z < sz + 0.02) || (skipMore ? skipMore(x, z) : false);
  out.paving.push(...paving(-H, H, -H, H, 0.05, seed + 40, { rowW: 0.7 * M.k, minL: 0.6 * M.k, maxL: 1.2 * M.k, lod, skip, tone: 0.07, grime: 0.15 }));
  out.trav.push(box(2 * H, 0.08, 0.16, 0, 0, H - 0.08, 0.88));
}

/** The cella: its walls, the door's frame, the pilasters, the inside the open doors show. */
function cella(M, T, lod, seed, out) {
  const { PY, AB } = T;
  const [CX, CZ1, CZ0] = M.cella;
  const W = M.wall;
  const k = M.k;
  const [dw, dh] = M.door;
  const top = AB;
  const ops = [{ a: -dw, b: dw, lo: PY, hi: PY + dh }];
  const walls = M.walls === 'marble' ? out.marble : out.stucco;
  // The front wall (with the door), the sides and the back.
  walls.push(...wallAlong('x', -CX + W, CX - W, CZ1 - W / 2, W, PY, top, ops, 0.97));
  for (const s of [-1, 1]) walls.push(box(W, top - PY, CZ1 - CZ0, s * (CX - W / 2), PY, (CZ1 + CZ0) / 2, 0.96));
  walls.push(box(2 * CX - 2 * W, top - PY, W, 0, PY, CZ0 + W / 2, 0.95));
  // Marble walls laid in courses (close up): the joints a shade darker, each course broken a half block on.
  if (M.walls === 'marble' && lod === 0) {
    const course = 0.6;
    const L = 1.2;
    for (const s of [-1, 1]) {
      for (let y = PY + course, i = 0; y < top - 0.05; y += course, i++) {
        out.joints.push(box(0.008, 0.02, CZ1 - CZ0, s * (CX + 0.004), y, (CZ1 + CZ0) / 2));
        for (let z = CZ0 + (i % 2 ? L / 2 : L); z < CZ1 - 0.1; z += L) out.joints.push(box(0.008, course - 0.02, 0.02, s * (CX + 0.004), y - course + 0.02, z));
      }
    }
  }
  // A moulded base round the walls' foot.
  if (lod < 2) {
    const hz = (CZ1 - CZ0) / 2;
    const base = frameSweep([[0.06 * k, 0], [0.06 * k, 0.08 * k], [0.03 * k, 0.14 * k], [0, 0.2 * k], [-0.3, 0.2 * k]], CX, hz, { tint: () => 0.9 });
    base.translate(0, PY, (CZ1 + CZ0) / 2);
    out.marble.push(base);
  }
  // Pilasters at the cella's corners and halfway along its sides (antae at the front corners).
  const pw = 0.4 * k;
  const pil = (x, z, alongX, kk = 0.95) => {
    out.marble.push(alongX ? box(pw, M.colH, 0.07, x, PY, z, kk) : box(0.07, M.colH, pw, x, PY, z, kk));
    // Its capital: a moulded block a little proud.
    if (lod < 2) out.marble.push(alongX ? box(pw + 0.08, 0.22 * k, 0.11, x, AB - 0.22 * k, z, 0.98) : box(0.11, 0.22 * k, pw + 0.08, x, AB - 0.22 * k, z, 0.98));
  };
  for (const s of [-1, 1]) {
    pil(s * (CX - pw / 2), CZ1 + 0.035, true);
    pil(s * (CX + 0.035), CZ1 - pw / 2, false);
    pil(s * (CX + 0.035), (CZ1 + CZ0) / 2, false);
    pil(s * (CX + 0.035), CZ0 + pw / 2, false);
    pil(s * (CX - pw / 2), CZ0 - 0.035, true);
  }
  // The door's frame of marble and its lintel, a cornice over it.
  for (const s of [-1, 1]) out.marble.push(box(0.2 * k, dh + 0.06, 0.1, s * (dw + 0.1 * k), PY, CZ1 + 0.05, 0.96));
  out.marble.push(box(2 * dw + 0.5 * k, 0.22 * k, 0.14, 0, PY + dh, CZ1 + 0.06, 0.96));
  out.marble.push(box(2 * dw + 0.7 * k, 0.07 * k, 0.24, 0, PY + dh + 0.22 * k, CZ1 + 0.1, 0.98));
  // The threshold, then the inside: a floor of marble, the walls painted red over a dark dado, the
  // statue's base against the back wall.
  out.floor.push(box(2 * dw, 0.03, W + 0.04, 0, PY, CZ1 - W / 2, 0.9));
  const ix = CX - W;
  out.floor.push(box(2 * ix, 0.02, CZ1 - CZ0 - 2 * W, 0, PY, (CZ1 + CZ0) / 2, 0.82));
  if (lod < 2) {
    const zb = CZ0 + W + 0.006;
    const zr = (CZ1 - W + CZ0 + W) / 2;
    const L = CZ1 - CZ0 - 2 * W;
    const dado = 0.9 * k;
    out.fresco.push(box(2 * ix, dado, 0.012, 0, PY, zb, () => FRESCO.black));
    out.fresco.push(box(2 * ix, top - PY - dado, 0.012, 0, PY + dado, zb, () => FRESCO.red));
    for (const s of [-1, 1]) {
      out.fresco.push(box(0.012, dado, L, s * (ix - 0.006), PY, zr, () => FRESCO.black));
      out.fresco.push(box(0.012, top - PY - dado, L, s * (ix - 0.006), PY + dado, zr, () => FRESCO.red));
    }
    // The ceiling's dark, so the inside does not read as open to the sky.
    out.dark.push(box(2 * ix, 0.04, L, 0, top - 0.05, zr));
    const [bw, bh, bd] = M.base;
    out.marble.push(slab(bw, bh, bd, { bevel: 0.015, seed: seed + 5, wobble: 0, tone: 0.02, grime: 0.1 }).translate(0, PY, CZ0 + W + bd / 2 + 0.15));
  } else {
    out.dark.push(darkIn('x', -dw, dw, PY, PY + dh, CZ1 - W, -1));
  }
}

/** The entablature round the porch and the cella, the pediments, the roof. */
function roof(M, T, lod, seed, out) {
  const { AB, EAVE, EX, EZ1, EZ0 } = T;
  const [, CZ1] = M.cella;
  const W = M.wall;
  const k = M.k;
  // Each band a solid beam 0.42 deep, standing out `d` past the line: the front's and the back's run
  // the whole width, the sides' fit between them (no two faces in one plane at the corners).
  const runs = (y, h, d, kk) => {
    const t = 0.42 * k + d;
    return [
      box(2 * (EX + d), h, t, 0, y, EZ1 + d - t / 2, kk),
      box(2 * (EX + d), h, t, 0, y, EZ0 - d + t / 2, kk),
      ...[-1, 1].map((s) => box(t, h, EZ1 - EZ0 + 2 * d - 2 * t, s * (EX + d - t / 2), y, (EZ1 + EZ0) / 2, kk)),
    ];
  };
  // Architrave (two fasciae; one band far off), frieze, cornice: each a ring round the building.
  const e = M.ent / 0.8;
  const bands = lod === 2
    ? [[0, M.ent, 0.05, 0.96]]
    : [[0, 0.14 * e, -0.02, 0.94], [0.14 * e, 0.14 * e, 0.0, 0.97], [0.28 * e, 0.3 * e, -0.03, 0.95], [0.58 * e, 0.08 * e, 0.06 * k, 0.97], [0.66 * e, 0.14 * e, 0.14 * k, 0.99]];
  for (const [y, h, d, kk] of bands) out.marble.push(...runs(AB + y, h, d + 0.02, kk));
  // The beams of the porch's ceiling, from the columns back to the cella; the ceiling's dark over the
  // porch and round the cella (the walk between the cella and its columns, on a peripteral temple).
  if (lod === 0) for (const x of M.cols) out.marble.push(box(0.26 * k, 0.2 * k, M.porchZ - CZ1, x, AB + 0.08 * e, (M.porchZ + CZ1) / 2, 0.85));
  out.dark.push(box(2 * EX - 0.2, 0.03, EZ1 - EZ0 - 0.2, 0, AB + 0.28 * e, (EZ1 + EZ0) / 2, 0.5));
  // Dentils under the cornice, along the front and the sides.
  if (lod === 0) {
    const step = 0.13 * k;
    for (let x = -EX - 0.1; x <= EX + 0.1; x += step) out.marble.push(box(0.07 * k, 0.07 * e, 0.08 * k, x, AB + 0.58 * e, EZ1 + 0.09 * k, 0.9));
    for (const s of [-1, 1]) for (let z = EZ0; z <= EZ1; z += step) out.marble.push(box(0.08 * k, 0.07 * e, 0.07 * k, s * (EX + 0.09 * k), AB + 0.58 * e, z, 0.9));
  }
  // The roof: tiles on a gable from front to back, its ridge along the cella.
  const r = gable({ x0: -EX - 0.04, x1: EX + 0.04, z0: EZ0 - 0.04, z1: EZ1 + 0.04, eaveY: EAVE, pitch: M.pitch, along: 'z', lod, seed: seed + 60, over: 0.24 * k, gableOver: 0.16 * k });
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  const apex = r.ridgeY;
  // The pediments, front and back: the tympanum set back in the frame of the raking cornices.
  const hw = EX + 0.16;
  const tt = W - 0.1;
  for (const [z, n] of [[EZ1 + 0.04, 1], [EZ0 - 0.04, -1]]) {
    // (Its outer face: T.G.front, T.G.rear.)
    const face = n > 0 ? z - 0.1 : z + 0.1 - tt;
    out.stucco.push(gableTri(-hw + 0.08, hw - 0.08, n > 0 ? face : face + tt, tt, EAVE, apex - 0.08));
    for (const s of [-1, 1]) {
      out.marble.push(rake(s * (hw + 0.18), EAVE - 0.04, 0, apex + 0.08, z + n * 0.12, 0.34 * k, 0.2 * e));
      if (lod === 0) out.marble.push(rake(s * (hw + 0.04), EAVE - 0.1, 0, apex - 0.06, z + n * 0.04, 0.22 * k, 0.08 * e, 0.9));
    }
    // The plinths the acroteria stand on, at the apex and the corners.
    out.marble.push(slab(0.4 * k, 0.14 * k, 0.34 * k, { bevel: 0.015, seed: seed + 70, wobble: 0, tone: 0, grime: 0 }).translate(0, apex + 0.02, z + n * 0.1));
    for (const s of [-1, 1]) out.marble.push(slab(0.34 * k, 0.12 * k, 0.3 * k, { bevel: 0.015, seed: seed + 72 + s, wobble: 0, tone: 0, grime: 0 }).translate(s * (hw + 0.12), EAVE - 0.03, z + n * 0.1));
  }
}

/** The bronze lampstands in the porch either side of the door. */
function lampstands(M, T, lod, out) {
  const k = M.k;
  for (const [x, z] of M.lamps) {
    out.bronze.push(revolve(profileOf([[0, 0], [0.13, 0], [0.14, 0.03], [0.07, 0.08], [0.04, 0.14], [0.026, 0.2], [0.022, 1.5], [0.04, 1.54], [0.03, 1.57], [0.11, 1.62], [0.12, 1.66], [0, 1.65]].map(([r, y]) => [r * k, y * k])), { segments: lod === 2 ? 5 : lod ? 8 : 12, metres: 0.4 }).translate(x, T.PY, z));
  }
}

/** A step's top (y) and the middle of its tread (z): `i` counted from the foot, 1 the lowest. */
export function stepAt(M, i) {
  const [, sz, n] = M.steps;
  const tread = (sz - M.podium[1]) / n;
  return [(M.floorY / n) * i, sz - i * tread + tread / 2];
}

/**
 * The people of the rite (people/actors.js specs, in the temple's metres), by
 * state: while the temple is kept ('open') the priest, his head veiled,
 * walks between the foot of the steps (praying toward the god, his hands
 * raised) and the altar (pouring from the patera over the fire), his boy
 * with the incense box by the altar, a woman veiled praying by the way; at
 * a festival ('out') the priest sacrificing, the boy, the flute player whose
 * music covered any ill-omened sound, the victimarius with his axe by the
 * victim, the crowd in their wreaths on the paving and the steps; nobody
 * while it is not kept.
 */
export function templeActors(M, state) {
  if (state !== 'open' && state !== 'out') return [];
  const [ax, az, aw] = M.altar;
  const k = M.k;
  const y = 0.05;
  const list = [];
  const priestDress = { body: 'm', dress: ['tunic:long', 'toga:velato'], hair: 'bald', old: true, props: { R: 'patera' }, colours: { tunic: DYES.white, mantle: DYES.candida, skin: 0xb88560, hair: 0x8a8478 } };
  // At the altar's left, facing it (+x): the patera held out over its top.
  const at = [ax - aw / 2 - 0.36, y, az];
  const boy = { body: 'c', dress: ['tunic:knee', 'bulla'], hair: 'curls', props: { R: 'acerra' }, clip: 'hold', at: [at[0] - 0.42, y, az + 0.5], ry: Math.PI / 2 + 0.35, colours: { tunic: DYES.white, trim: DYES.white } };
  if (state === 'open') {
    // The priest's way: from the foot of the steps (where he prays toward the god) to the altar and back.
    const [, sz] = stepAt(M, 0);
    const foot = [ax - 0.42 * k, y, sz + 0.28];
    const dx = at[0] - foot[0];
    const dz = at[2] - foot[2];
    list.push({
      ...priestDress, clip: 'walk', at: foot, ry: Math.atan2(dx, dz), seed: 11,
      route: { length: Math.hypot(dx, dz), speed: 0.75, pauseEnd: 9, pauseStart: 5, clipEnd: 'sacrifice', clipStart: 'pray', faceEnd: Math.PI / 2, faceStart: Math.PI },
    });
    list.push({ ...boy, seed: 12 });
    // A woman praying by the way, her palla over her head.
    list.push({ body: 'f', dress: ['tunic:long:stola', 'palla:veil'], hair: 'bun', clip: 'pray', at: [ax + aw / 2 + 0.55, y, az - 0.15], ry: Math.PI + 0.35, seed: 13 });
    return list;
  }
  list.push({ ...priestDress, clip: 'sacrifice', at, ry: Math.PI / 2, seed: 21 });
  list.push({ ...boy, seed: 22 });
  list.push({ body: 'm', dress: ['tunic:long', 'wreath'], hair: 'crop', props: { R: 'tibiae' }, clip: 'flute', at: [at[0] - 0.4, y, az - 0.6], ry: Math.PI / 2 + 0.5, seed: 23, colours: { tunic: DYES.white } });
  list.push({ body: 'm', dress: ['limus', 'wreath'], hair: 'crop', props: { L: 'axe' }, clip: 'shoulder', at: [ax + aw / 2 + 0.6 * k, y, az + 0.45], ry: -Math.PI / 2 - 0.3, seed: 24, colours: { tunic: DYES.white, trim: DYES.purple } });
  // The crowd: men, women and children in their best, wreathed; cheering, praying, talking.
  const acts = ['cheer', 'pray', 'talk', 'listen', 'cheer', 'idle', 'pray', 'cheer'];
  const place = [...M.crowd.map(([x, z, ry]) => [x, y, z, ry]), ...M.crowdSteps.map(([x, i, ry]) => {
    const [sy, sz] = stepAt(M, i);
    return [x, sy, sz, ry];
  })];
  // (Kept a body's breadth inside the footprint: a person never stands over the street.)
  const inside = (v) => Math.sign(v) * Math.min(Math.abs(v), M.half - 0.35);
  place.forEach(([x, yy, z, ry], i) => list.push(worshipper(i, [inside(x), yy, inside(z)], ry, acts[i % acts.length])));
  return list;
}

/** One of a festival's crowd: a man, a woman or a child by turns, wreathed, their colours by their seed. */
function worshipper(i, at, ry, clip) {
  const seed = 40 + i * 3.7;
  const kind = i % 5 === 3 ? 'c' : i % 3 === 1 ? 'f' : 'm';
  if (kind === 'f') return { body: 'f', dress: ['tunic:long:stola', i % 2 ? 'palla:veil' : 'palla'], hair: 'bun', clip: clip === 'cheer' ? 'cheer' : 'pray', at, ry, seed };
  if (kind === 'c') return { body: 'c', dress: ['tunic:knee', 'bulla', 'wreath'], hair: 'curls', clip: 'cheer', at, ry, seed };
  return { body: 'm', dress: i % 4 === 0 ? ['tunic:knee', 'toga', 'wreath'] : ['tunic:knee', 'wreath'], hair: i % 2 ? 'crop' : 'curls', clip, at, ry, seed };
}

/** Garlands for a festival: festoons between the front columns and back along the porch's sides, one on the altar. */
function garlands(M, T, lod, out) {
  const y = T.AB - 0.06;
  const k = M.k;
  const pts = M.cols.map((x) => [x, y, M.porchZ + 0.2 * k]);
  for (let i = 0; i + 1 < pts.length; i++) {
    const f = festoon(pts[i], pts[i + 1], { sag: 0.42 * k, r: 0.055 * k, lod, seed: i + 1 });
    out.garland.push(...f.leaf);
    out.flowers.push(...f.flowers);
  }
  const xo = Math.max(...M.cols) + 0.2 * k;
  const back = Math.min(...M.more.filter(([x]) => Math.abs(Math.abs(x) - (xo - 0.2 * k)) < 0.01).map(([, z]) => z), M.porchZ);
  for (const s of [-1, 1]) {
    const f = festoon([s * xo, y, M.porchZ], [s * xo, y, Math.max(back, M.porchZ - 3)], { sag: 0.35 * k, r: 0.05 * k, lod, seed: 9 + s });
    out.garland.push(...f.leaf);
    out.flowers.push(...f.flowers);
  }
  const [ax, az, aw, ad, ah] = M.altar;
  const f = festoon([ax - aw / 2 + 0.05, ah + 0.02, az + ad / 2 + 0.02], [ax + aw / 2 - 0.05, ah + 0.02, az + ad / 2 + 0.02], { sag: 0.3 * k, r: 0.045 * k, lod, seed: 21 });
  out.garland.push(...f.leaf);
  out.flowers.push(...f.flowers);
}

/** The bins a temple's body gathers, by material key. */
export function bodyBins() {
  const keys = ['trav', 'paving', 'marble', 'joints', 'stucco', 'tile', 'wood', 'bronze', 'dark', 'floor', 'fresco', 'garland', 'flowers', 'plaster'];
  return Object.fromEntries(keys.map((key) => [key, []]));
}

/**
 * Build the body every god's temple of measures M shares: { group, meshes,
 * triangles }, its meshes tagged in userData.when. `extra(T, out, lod)`
 * adds a size's own parts to the bins (the grand temple's precinct).
 */
export function buildTempleBody(M, { lod = 0, seed = 601, extra = null, skipPaving = null } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const T = templeFrame(M);
  const out = bodyBins();
  podium(M, T, lod, seed, out);
  precinct(M, lod, seed, out, skipPaving);
  cella(M, T, lod, seed + 100, out);
  roof(M, T, lod, seed + 200, out);
  lampstands(M, T, lod, out);
  const [ax, az, aw, ad, ah] = M.altar;
  const altar = ara(ax, az, { w: aw, d: ad, h: ah, lod, seed: seed + 300 });
  out.trav.push(...altar.stone);
  out.marble.push(...altar.marble);
  if (extra) extra(T, out, lod);
  const m = sacraMaterials();
  const p = new TaggedParts(M.name);
  const small = { cast: false };
  p.add('stone', m.trav, out.trav);
  p.add('paving', m.trav, out.paving, small);
  p.add('marble', m.marble, out.marble);
  if (out.joints.length) p.add('joints', m.joint, out.joints, small);
  p.add('stucco', m.stucco, out.stucco);
  if (out.plaster.length) p.add('plaster', m.fresco, out.plaster, small);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  p.add('bronze', m.bronze, out.bronze, { cast: lod === 0 });
  p.add('inside', m.dark, out.dark, small);
  // The porch's and the cella's floors, the cella's painted walls: under the roof, no snow.
  p.add('floor', m.shelteredMarble, out.floor, small);
  if (out.fresco.length) p.add('fresco', m.fresco, out.fresco, small);
  // The doors: bronze, open while the temple is kept (and on a festival), shut when it is not.
  const CZ1 = M.cella[1];
  const [dw, dh] = M.door;
  const dz = CZ1 - M.wall / 2 + 0.04;
  const shut = doubleDoor(0, dz, 2 * dw, dh, T.PY, { open: false, lod, metal: true });
  const open = doubleDoor(0, dz, 2 * dw, dh, T.PY, { open: true, lod, metal: true });
  p.add('doors', m.bronze, open.bronze, { when: 'staffed' });
  p.add('doors', m.bronze, shut.bronze, { when: 'shut' });
  // The fire on the altar: lit while the temple is kept, bigger on a festival; cold ash when not.
  const fr = Math.min(0.2 * M.k, ad * 0.3);
  const fire = hearthFire(altar.hearth, fr, { lod, seed: seed + 310, big: M.k });
  const big = hearthFire(altar.hearth, fr, { lod, seed: seed + 311, big: 1.6 * M.k });
  p.add('coals', m.ash, fire.dark, small);
  p.add('fire', m.embers, fire.hot, { when: 'staffed', cast: false });
  p.add('flames', m.flame, fire.flames, { when: 'open', cast: false });
  p.add('flames', m.flame, big.flames, { when: 'out', cast: false });
  p.add('ash', m.ash, fire.ash, { when: 'shut', cast: false });
  // The lampstands' flames: lit while it is kept.
  if (lod < 2) {
    const flames = M.lamps.map(([x, z]) => hearthFire([x, T.PY + 1.62 * M.k, z], 0.06, { lod: 1, seed: seed + 320 + x, big: 0.45 * M.k }).flames).flat();
    p.add('lamp', m.flame, flames, { when: 'staffed', cast: false });
  }
  if (lod < 2) {
    garlands(M, T, lod, out);
    p.add('garlands', m.garland, out.garland, { when: 'out', cast: false });
    if (out.flowers.length) p.add('blooms', m.flowers, out.flowers, { when: 'out', cast: false });
  }
  return p.build();
}

// ---------------------------------------------------------------------------
// Each god's own
// ---------------------------------------------------------------------------

/** The frieze painted in the god's colour round the building, its dedication in gilt letters on the front. */
function frieze(M, T, god, lod, out) {
  const { AB, EX, EZ1, EZ0 } = T;
  const N = NUMEN[god];
  const e = M.ent / 0.8;
  const y0 = AB + 0.28 * e;
  const h = 0.3 * e;
  const d = 0.012;
  // A few millimetres proud of the frieze's faces (front, back, sides).
  const out1 = 0.01;
  const fz = EZ1 + out1 + d / 2;
  const bz = EZ0 - out1 - d / 2;
  const sx = EX + out1 + d / 2;
  out.paint.push(box(2 * EX + 0.02, h - 0.02, d, 0, y0 + 0.01, fz, () => N.frieze));
  out.paint.push(box(2 * EX + 0.02, h - 0.02, d, 0, y0 + 0.01, bz, () => N.frieze));
  for (const s of [-1, 1]) out.paint.push(box(d, h - 0.02, EZ1 - EZ0 + 0.02, s * sx, y0 + 0.01, (EZ1 + EZ0) / 2, () => N.frieze));
  if (lod === 2) return;
  // A painted line along the frieze's top and foot in the god's second colour.
  for (const yy of [y0 + 0.012, y0 + h - 0.032]) {
    out.paint.push(box(2 * EX + 0.03, 0.02, d, 0, yy, fz + 0.004, () => N.trim));
    out.paint.push(box(2 * EX + 0.03, 0.02, d, 0, yy, bz - 0.004, () => N.trim));
    for (const s of [-1, 1]) out.paint.push(box(d, 0.02, EZ1 - EZ0 + 0.03, s * (sx + 0.004), yy, (EZ1 + EZ0) / 2, () => N.trim));
  }
  // The dedication, in gilt bronze letters on the front (close up); far off a gilt line.
  const text = N.dedication;
  const lh = Math.min(0.17 * e, (2 * EX - 0.6) / Math.max(1, textWidth(text, 1)));
  if (lod === 0) out.gilt.push(...letters(text, y0 + (h - lh) / 2, fz + 0.008, lh));
  else out.gilt.push(box(textWidth(text, lh), lh * 0.7, 0.006, 0, y0 + (h - lh * 0.7) / 2, fz + 0.008));
  // Neptune's frieze: a running wave (the Vitruvian scroll) along its foot, front and back.
  if (god === 'neptune' && lod === 0) {
    for (const zz of [fz + 0.006, bz - 0.006]) {
      const pts = [];
      for (let x = -EX + 0.05; x <= EX - 0.05; x += 0.03) pts.push([x, y0 + 0.05 * e + 0.025 * e * Math.sin(x * 14 / e), zz]);
      out.paint.push(tintGeometry(tube(pts, 0.012 * e, { radial: 3, segments: pts.length * 2, around: 0.1 }), () => N.trim));
    }
  }
}

/** The pediments' painted grounds and their sculpture (the back's centrepiece alone), the acroteria. */
function pediments(M, T, god, lod, out) {
  const { EAVE, EX, G } = T;
  const N = NUMEN[god];
  const hw = EX + 0.02;
  const apex = G.apex - 0.08;
  for (const [z, n] of [[G.front, 1], [G.rear, -1]]) {
    // The painted ground: a thin triangle a few millimetres proud of the tympanum's face.
    const g = gableTri(-hw, hw, 0.006, 0.006, EAVE + 0.02, apex - 0.06);
    if (n < 0) g.rotateY(Math.PI);
    out.paint.push(tintGeometry(g.translate(0, 0, z), () => N.ground));
    if (n > 0) {
      pourBins(placeBins(pedimentRelief(god, 2 * hw, apex - EAVE, lod), 0, EAVE + 0.03, z + 0.008), out, 'gilt');
    } else if (lod === 0) {
      // The back: the centrepiece alone (the sides' pairs cost as much again for a face seen half the time).
      pourBins(placeBins(pedimentRelief(god, 2 * hw, apex - EAVE, 1, { centre: true }), 0, EAVE + 0.03, z - 0.008, { ry: Math.PI }), out, 'gilt');
    }
  }
  // The acroteria: at the apex and the corners, front and back.
  for (const [z, ry] of [[G.z + 0.04, 0], [G.back - 0.04, Math.PI]]) {
    pourBins(placeBins(acroterion(god, 'apex', lod, 2 * G.hw), 0, G.apex + 0.16 * M.k, z, { ry }), out, 'gilt');
    for (const s of [-1, 1]) {
      pourBins(placeBins(acroterion(god, 'corner', lod, 2 * G.hw, s * (ry ? -1 : 1)), s * (G.hw + 0.12), EAVE + 0.09 * M.k, z, { ry }), out, 'gilt');
    }
  }
}

/** The god's own things about the temple: at the altar, by the steps, on the walls. */
function dressing(M, T, god, lod, out) {
  const { PY } = T;
  const [ax, az, aw, ad] = M.altar;
  const [CX, CZ1, CZ0] = M.cella;
  const k = M.k;
  const { left, right, cornerL, cornerR } = M.spots;
  const front = az + ad / 2 - 0.07 + 0.01;
  // The god's sign carved on the altar's face (close up).
  if (lod === 0) {
    const sign = {
      ceres: () => wheatSheaf(1, 'marble'),
      neptune: () => trident(1, 'marble', 1),
      mercury: () => caduceus(1, 'marble', 1),
      mars: () => clipeus(1, 'marble', 0.42),
      venus: () => shell(1, 'marble', 0.42),
    }[god]();
    const round = god === 'mars' || god === 'venus';
    placeBins(sign, ax, 0.12 + (god === 'mars' ? 0.42 : 0.18) * k, front + (god === 'mars' ? 0.03 : 0.01), { s: (round ? 0.5 : 0.42) * k });
    pourBins(sign, out, 'marble');
  }
  if (lod === 2) return;
  switch (god) {
    case 'ceres': {
      // Sheaves of the first wheat leaning on the altar, a plough laid by the steps, baskets of grain.
      for (const s of [-1, 1]) pourBins(placeBins(wheatSheaf(lod, 'straw', 4 + s), ax + s * (aw / 2 + 0.12), 0.05, az + 0.05, { s: 0.85 * k, ry: s * 0.4 }), out, 'straw');
      pourBins(placeBins(plough(lod), left[0] + 0.1, 0.05, left[1], { ry: -Math.PI / 2 + 0.2, s: 0.9 }), out, 'wood');
      for (const [x, z] of [[right[0] - 0.02, right[1] - 0.55], [right[0] + 0.28, right[1] - 0.05]]) {
        out.wicker.push(revolve(profileOf([[0, 0], [0.16, 0], [0.22, 0.3], [0, 0.3]]), { segments: lod ? 8 : 14, metres: 0.3 }).translate(x, 0.05, z));
        out.straw.push(tintGeometry(new CylinderGeometry(0.21, 0.21, 0.02, lod ? 8 : 14, 1).translate(x, 0.34, z), () => lin(0xd8b860)));
      }
      break;
    }
    case 'neptune': {
      // An anchor given by a ship's crew for a safe passage, leaning on the podium; a trident by the door.
      pourBins(placeBins(anchor(lod, 1.35 * k), left[0] + 0.3, 0.05, M.podium[1] + 0.12, { rx: -0.1 }), out, 'iron');
      pourBins(placeBins(trident(lod, 'bronze', 2.2 * k), M.door[0] + 0.37 * k, PY, CZ1 + 0.2), out, 'bronze');
      break;
    }
    case 'mercury': {
      // A herm of the god at the precinct's corner, as at a crossroads; a bronze rooster on a pillar.
      const hm = herm(cornerR[0], 0.05, cornerR[1], -0.5, { h: 1.6 * k, lod, beard: false, name: lod === 0 ? 'MERCVRIO' : null });
      out.marble.push(...hm.stone);
      out.letters.push(...hm.letters);
      out.marble.push(slab(0.3 * k, 1.0 * k, 0.3 * k, { bevel: 0.015, seed: 5, wobble: 0, tone: 0.02, grime: 0.2 }).translate(cornerL[0], 0.05, cornerL[1]));
      pourBins(placeBins(rooster(lod, 'bronze', 0.45 * k), cornerL[0], 0.05 + 1.0 * k, cornerL[1], { ry: -Math.PI / 2 + 0.5 }), out, 'bronze');
      break;
    }
    case 'mars': {
      // A bronze trophy of captured arms by the steps; shields of the spoils hung on the cella's walls.
      out.marble.push(slab(0.6 * k, 0.4 * k, 0.6 * k, { bevel: 0.015, seed: 7, wobble: 0, tone: 0.02, grime: 0.2 }).translate(left[0], 0.05, left[1]));
      pourBins(placeBins(trophy(lod, 'bronze', 1.7 * k), left[0], 0.05 + 0.4 * k, left[1], { ry: 0.5 }), out, 'bronze');
      for (const s of [-1, 1]) {
        // (Gilded, as the shields dedicated in temples were: dark bronze on white stucco read as holes.)
        for (const z of [CZ1 - 0.62 * k, CZ0 + 0.62 * k]) pourBins(placeBins(clipeus(lod, 'gilt', 0.3 * k), s * (CX + 0.02), PY + 2.2 * k, z, { ry: s * Math.PI / 2 }), out, 'gilt');
      }
      break;
    }
    default: {
      // Myrtles and roses in pots either side of the steps; doves on the roof's ridge.
      for (const [sx, sz, sgn] of [[left[0], left[1], -1], [right[0], right[1], 1]]) {
        for (const [dx, dz] of [[-0.12, -0.3], [0.5, 0.3]]) {
          const x = sx + sgn * dx;
          const z = sz + dz;
          out.clay.push(revolve(profileOf([[0, 0], [0.15, 0], [0.2, 0.32], [0.22, 0.36], [0, 0.36]]), { segments: lod ? 8 : 14, metres: 0.3 }).translate(x, 0.05, z));
          out.leaf.push(...bush(x, 0.75, z, 0.32, { lod, seed: 40 + Math.round(dx * 10) + sgn }));
          if (lod === 0) {
            for (let i = 0; i < 7; i++) {
              const a = i * 2.4;
              out.flowers.push(tintGeometry(boxUV(new CylinderGeometry(0.03, 0.03, 0.03, 5, 1).translate(x + Math.cos(a) * 0.24, 0.84 + (i % 3) * 0.08, z + Math.sin(a) * 0.24)), () => (i % 2 ? lin(0xd04a6a) : lin(0xf0e0e4))));
            }
          }
        }
      }
      const ridge = T.G.apex;
      for (const [z, kk] of [[CZ1 - 0.35 * k, 1], [(CZ1 + CZ0) / 2 - 0.4 * k, -1]]) pourBins(placeBins(dove(lod, 'marble', 0.26 * k), 0.02, ridge + 0.06, z, { ry: kk > 0 ? 0.3 : Math.PI + 0.4 }), out, 'marble');
      break;
    }
  }
}

/** The cult statue on its base in the cella (none far out: the doors show nothing there). */
function statueOf(M, T, god, lod, out) {
  if (lod === 2) return;
  const st = cultStatue(god, lod === 0 ? 0 : 2);
  const s = M.statue * (god === 'neptune' ? 0.94 : 1);
  const [, bh, bd] = M.base;
  const y = T.PY + bh;
  const z = M.cella[2] + M.wall + bd / 2 + 0.15;
  for (const g of st.stone) out.marble.push(g.scale(s, s, s).translate(0, y, z));
  for (const g of st.gear) out.gilt.push(g.scale(s, s, s).translate(0, y, z));
}

/** Build a god's own kit for a temple of measures M: { group, meshes, triangles }. */
export function buildTempleGod(M, god, { lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const T = templeFrame(M);
  const keys = ['paint', 'gilt', 'bronze', 'marble', 'terracotta', 'wood', 'iron', 'leaf', 'flowers', 'letters', 'straw', 'wicker', 'clay', 'cloth'];
  const out = Object.fromEntries(keys.map((key) => [key, []]));
  frieze(M, T, god, lod, out);
  pediments(M, T, god, lod, out);
  dressing(M, T, god, lod, out);
  statueOf(M, T, god, lod, out);
  const m = sacraMaterials();
  const p = new TaggedParts(`${M.name}-${god}`);
  const small = { cast: lod === 0 };
  p.add('paint', m.painted, out.paint, { cast: false });
  p.add('gilt', m.gilt, out.gilt, small);
  p.add('bronze', m.bronze, out.bronze, small);
  p.add('statue', m.marble, out.marble, small);
  p.add('terracotta', m.terracotta, out.terracotta, small);
  // The god's small things (a plough, an anchor, sheaves, baskets, pots and their plants, a herm's
  // name) in one part of plain colours: temples are many, and each part is a draw call (and one more
  // in the sun's shadow pass) for every kind of temple in view. Their colours go into their vertices.
  const props = [];
  for (const [key, hex] of [['wood', 0x6b4a2e], ['iron', 0x4c4c50], ['straw', 0xd8b860], ['wicker', 0x9a7a4a], ['clay', 0xa4552e], ['cloth', 0x8a3a2a], ['letters', 0x6a1e14], ['leaf', 0xffffff], ['flowers', 0xffffff]]) {
    for (const g of out[key]) props.push(dye(g, lin(hex)));
  }
  p.add('props', m.paint, props, small);
  return p.build();
}

/** Multiply a geometry's vertex colours (white if it has none) by `rgb`. */
function dye(g, rgb) {
  if (!g.attributes.color) return tintGeometry(g, () => rgb);
  const c = g.attributes.color;
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * rgb[0], c.getY(i) * rgb[1], c.getZ(i) * rgb[2]);
  return g;
}

/** A temple's column in `order` ('tuscan', 'ionic', 'corinthian'), its height `h`, standing on y 0: { group }. */
export function buildTempleColumn(name, order, h, { lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const m = sacraMaterials();
  const p = new TaggedParts(`${name}-column-${order}`);
  if (order === 'tuscan') {
    // Tufa stuccoed white, the Tuscan proportion (seven diameters: Vitruvius IV.7).
    p.add('column', m.stucco, tuscanColumn(h / 14, h, lod));
  } else {
    const c = column(order, h, lod);
    p.add('column', m.marble, c.stone);
    p.add('capital', m.marble, c.cap);
  }
  return p.build();
}

// ---------------------------------------------------------------------------
// The small temple
// ---------------------------------------------------------------------------

export const AEDES_COLUMNS = templeColumns(AEDES);
export const AEDES_LAMPS = templeLamps(AEDES);
export const AEDES_GABLE = Object.freeze(templeFrame(AEDES).G);
export const aedesHearth = () => templeHearth(AEDES);
export const buildAedesBody = (opts = {}) => buildTempleBody(AEDES, opts);
export const buildAedesGod = (god, opts = {}) => buildTempleGod(AEDES, god, opts);
export const buildAedesColumn = (order, opts = {}) => buildTempleColumn('aedes', order, AEDES.colH, opts);
