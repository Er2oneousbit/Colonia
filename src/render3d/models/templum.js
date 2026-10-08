/**
 * models/templum.js
 * ----------------------------------------------------------------------------
 * The grand temple of the 3D look (templum) on a 3 x 3 footprint (12 m),
 * from the record rather than the 2D sprite:
 *
 *   - Augustus's temple of Mars Ultor in his forum: of white Luna marble
 *     on a high podium, a deep porch of Corinthian columns across the
 *     front and down the sides, none at the back (peripteros sine
 *     postico), its back against the precinct's tall wall; the cult
 *     statues in an apse at the end of the cella, seen from the forum
 *     through the bronze doors.
 *   - the temples standing in a court ringed by porticoes, as Apollo's at
 *     Pompeii and the Capitolium of Brescia: the altar in the court before
 *     the steps, the portico's columns round it, the precinct's wall
 *     shutting out the town.
 *
 * So, in 12 m: a marble temple on a podium of travertine, a hexastyle
 * front and four columns down each side (the god's order: models/numina.js),
 * the back a solid wall as wide as the porch; a big altar in the court; a
 * portico of Tuscan columns under a lean-to roof down each side of the
 * court against the precinct wall, which closes the back and the sides, its
 * inside painted; the court open to the street at the front. The design is
 * the small temple's (models/aedes.js builds both from their measures),
 * larger and in marble, with the same per-god identity.
 *
 * States as the small temple's (models/aedes.js).
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { slope } from './domus.js';
import { slab } from './masonry.js';
import { FRESCO, coping } from './domus.js';
import { box, D } from './sacra.js';
import { buildTempleBody, buildTempleGod, buildTempleColumn, templeColumns, templeLamps, templeHearth, templeFrame } from './aedes.js';

/** The side columns' places down each side of the cella, behind the front row. */
const SIDE_Z = Object.freeze([0.06, -1.18, -2.42, -3.66]);

/** The grand temple's measures (metres): see AEDES (models/aedes.js) for what each says. */
export const TEMPLUM = Object.freeze({
  name: 'templum',
  half: 6,
  k: 1.35,
  floorY: 1.9,
  podium: Object.freeze([3.56, 1.8, -5.15]),
  steps: Object.freeze([2.55, 3.62, 9]),
  cella: Object.freeze([2.4, -0.62, -5.0]),
  wall: 0.44,
  porchZ: 1.3,
  cols: Object.freeze([-3.1, -1.86, -0.62, 0.62, 1.86, 3.1]),
  more: Object.freeze(SIDE_Z.flatMap((z) => [Object.freeze([-3.1, z]), Object.freeze([3.1, z])])),
  colH: 4.7,
  ent: 1.08,
  door: Object.freeze([0.86, 3.65]),
  altar: Object.freeze([0, 4.78, 2.1, 1.15, 1.15]),
  lamps: Object.freeze([Object.freeze([-1.55, -0.12]), Object.freeze([1.55, -0.12])]),
  pitch: D(16),
  walls: 'marble',
  statue: 1.62,
  base: Object.freeze([1.4, 0.72, 1.05]),
  spots: Object.freeze({ left: Object.freeze([-3.55, 4.55]), right: Object.freeze([3.55, 4.55]), cornerL: Object.freeze([-3.7, 5.35]), cornerR: Object.freeze([3.7, 5.35]) }),
  crowd: Object.freeze([[-3.3, 5.2, 2.0], [-2.45, 5.55, 2.6], [-3.55, 3.95, 1.2], [3.35, 4.0, -1.2], [2.55, 5.5, -2.6], [3.45, 5.0, -1.9], [-1.65, 5.75, 2.9], [1.55, 5.75, -2.9]]),
  crowdSteps: Object.freeze([[-1.3, 3, 0.2], [1.15, 5, -0.25], [-0.45, 7, 0.1]]),
});

const M = TEMPLUM;

/** The precinct: its wall's inner faces (x half, back z), its height, the portico's columns' line and height. */
export const PRECINCT = Object.freeze({ x: 5.42, back: -5.45, t: 0.4, h: 3.7, front: 5.2, colX: 4.42, colH: 3.0, colZ: Object.freeze([4.5, 2.25, 0, -2.25, -4.5]) });
const P = PRECINCT;

/** The portico's columns' places [x, z] (both sides of the court). */
export const PORTICO_COLUMNS = Object.freeze(P.colZ.flatMap((z) => [Object.freeze([-P.colX, z]), Object.freeze([P.colX, z])]));

/** The temple's back wall widened out to its side colonnades (the wall the side entablature rests on). */
function backWings(T, out, lod) {
  const [CX, , CZ0] = M.cella;
  const W = M.wall;
  const ex = T.EX;
  for (const s of [-1, 1]) {
    const x0 = CX;
    const x1 = ex + 0.02;
    out.marble.push(box(x1 - x0, M.colH, W, s * (x0 + x1) / 2, T.PY, CZ0 + W / 2, 0.95));
    // A pilaster at its outer end, facing down the side.
    out.marble.push(box(0.07, M.colH, 0.5, s * (x1 + 0.035), T.PY, CZ0 + W / 2, 0.97));
    if (lod < 2) out.marble.push(box(0.11, 0.28, 0.58, s * (x1 + 0.055), T.AB - 0.28, CZ0 + W / 2, 0.99));
  }
}

/** The precinct: its walls at the back and sides, the porticoes down the court's sides under lean-to roofs. */
function precinct(T, out, lod, seed) {
  const H = M.half - 0.04;
  const { x: px, back: bz, t, h, front } = P;
  // The walls: ashlar outside (the travertine), painted plaster inside (red panels over a black dado).
  out.trav.push(box(2 * H, h, t, 0, 0, bz - t / 2, 0.92));
  for (const s of [-1, 1]) out.trav.push(box(t, h, front - bz, s * (px + t / 2), 0, (front + bz) / 2, 0.92));
  // Their coping, and the piers that end them at the street.
  out.marble.push(...coping('x', -H + 0.07, H - 0.07, bz - t / 2, t, h, 0.95));
  for (const s of [-1, 1]) {
    out.marble.push(...coping('z', bz, front, s * (px + t / 2), t, h, 0.95));
    out.trav.push(slab(t + 0.2, h + 0.3, 0.7, { bevel: 0.02, seed: seed + s, wobble: 0, tone: 0.02, grime: 0.3 }).translate(s * (px + t / 2), 0, front + 0.3));
  }
  // The walls' insides: painted, a dark dado, red panels framed in ochre (close up), under the porticoes.
  if (lod < 2) {
    for (const s of [-1, 1]) {
      const x = s * (px - 0.006);
      out.plaster.push(box(0.012, 0.9, front - bz - 0.1, x, 0.05, (front + bz) / 2, () => FRESCO.black));
      out.plaster.push(box(0.012, P.colH - 0.95, front - bz - 0.1, x, 0.95, (front + bz) / 2, () => FRESCO.red));
      if (lod === 0) {
        for (let z = bz + 0.9; z < front - 0.4; z += 1.9) out.plaster.push(box(0.016, 0.06, 1.3, x, 1.0, z + 0.65, () => FRESCO.ochre), box(0.016, 0.06, 1.3, x, P.colH - 0.15, z + 0.65, () => FRESCO.ochre), box(0.016, P.colH - 1.1, 0.06, x, 1.0, z, () => FRESCO.ochre), box(0.016, P.colH - 1.1, 0.06, x, 1.0, z + 1.3, () => FRESCO.ochre));
      }
    }
  }
  // The porticoes: a beam on the columns, a lean-to roof from the wall down to it, the ceiling's dark.
  const cx = P.colX;
  const beamY = P.colH;
  for (const s of [-1, 1]) {
    out.marble.push(box(0.4, 0.3, front - bz + 0.1, s * cx, beamY, (front + bz) / 2 + 0.05, 0.95));
    const eave = cx - 0.32;
    const z0 = bz;
    const z1 = front + 0.05;
    const quad = s > 0
      ? [[eave, beamY + 0.32, z1], [eave, beamY + 0.32, z0], [px + 0.02, h + 0.05, z0], [px + 0.02, h + 0.05, z1]]
      : [[-eave, beamY + 0.32, z0], [-eave, beamY + 0.32, z1], [-px - 0.02, h + 0.05, z1], [-px - 0.02, h + 0.05, z0]];
    const r = slope(quad, { lod, seed: seed + 10 + s });
    out.tile.push(...r.tile);
    out.wood.push(...r.wood);
    out.dark.push(box(px - cx, 0.03, front - bz, s * (cx + px) / 2, beamY + 0.28, (front + bz) / 2, 0.5));
  }
}

/** Build the grand temple's body (every god's): { group, meshes, triangles }. */
export function buildTemplumBody({ lod = 0, seed = 701 } = {}) {
  const skip = (x, z) => Math.abs(x) > P.x - 0.02 || z < P.back + 0.02;
  return buildTempleBody(M, {
    lod, seed, skipPaving: skip,
    extra: (T, out, l) => {
      backWings(T, out, l);
      precinct(T, out, l, seed + 500);
    },
  });
}

export const buildTemplumGod = (god, opts = {}) => buildTempleGod(M, god, opts);
export const buildTemplumColumn = (order, opts = {}) => buildTempleColumn('templum', order, M.colH, opts);
/** The portico's Tuscan column (stuccoed), standing on y 0. */
export const buildPorticoColumn = (opts = {}) => buildTempleColumn('templum-portico', 'tuscan', P.colH, opts);

/** The temple's columns, with the floor they stand on (the podium's top). */
export const TEMPLUM_COLUMNS = Object.assign(templeColumns(M).slice(), { floor: M.floorY });
export const TEMPLUM_LAMPS = templeLamps(M);
export const TEMPLUM_GABLE = Object.freeze(templeFrame(M).G);
export const templumHearth = () => templeHearth(M);
