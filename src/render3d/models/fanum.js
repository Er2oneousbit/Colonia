/**
 * models/fanum.js
 * ----------------------------------------------------------------------------
 * The Great Sanctuary (fanum) of the 3D look on its 5 x 5 footprint (20 m),
 * one design for the five gods, from the record rather than the 2D sprite:
 * the terraced hillside sanctuaries of the late Republic.
 *
 *   - Fortuna Primigenia at Praeneste: terraces stacked up the hill, faced
 *     in polygonal limestone below and squared stone above, two long ramps
 *     climbing across the lowest face to meet in the middle, a terrace of
 *     arched rooms, a stair up the axis to the top.
 *   - Jupiter Anxur at Terracina: the summit platform carried on a row of
 *     arches over vaulted rooms (the substructure that still stands over
 *     the sea), the temple on its podium at the top.
 *   - Hercules Victor at Tibur: the temple in a court closed by porticoes
 *     on three sides, raised on great arched substructures; the
 *     Tabularium's arches framed by engaged half-columns are the same
 *     builders' manner.
 *
 * So, in 20 m: a forecourt at the street; the lower terrace (1.6 m) in
 * polygonal masonry with two ramps against its face meeting at a landing
 * on the axis; the middle terrace (3.4 m) behind an arcade of arched rooms
 * (dark inside), a stair up the axis; the top terrace (5.4 m) behind an
 * arcade with engaged half-columns and an attic cut with the sanctuary's
 * name in gilt letters; on it the sacred court, porticoes down both sides
 * and the temple at its back, a hexastyle podium temple of the god's
 * order, painted and gilded as the god's temples are (its kits are the
 * small temple's builders from these measures: models/aedes.js
 * buildTempleBody, buildTempleGod, so its frieze, pediment, acroteria,
 * cult statue and the things at its altar are the god's own, numina.js).
 * Each god's own ground on the lower terrace's wings (fanumGods.js): Ceres
 * a sacred grove and the cista, Neptune a spring and its basins with
 * bronze dolphins, Mercury a market colonnade and the caduceus, Mars the
 * spoils and the sacred spears, Venus myrtle, roses and doves.
 *
 * Built in four stages (data/monuments.js fanum), read here as a timeline
 * `t` from 0 to 4 (the stage and its share done: sacredMonuments.js): the
 * ground marked and the footings, the massif rising to the lower terrace
 * and the ramps (stage 0); the middle and top terraces, their arcades,
 * the stairs, the temple's podium and cella (1); the columns, the
 * porticoes, the entablatures and the roofs (2); the paving, the god's
 * things, the statues, the grove planted (3). What is built up to `t`
 * stands; the work under way rises course by course; the scaffolds,
 * cranes, centering and piles are the shared site's (models/worksite.js).
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BufferGeometry, Float32BufferAttribute, Shape, ExtrudeGeometry, CylinderGeometry } from 'three';
import { boxUV, tintGeometry, revolve, profileOf, tube } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, TaggedParts } from './masonry.js';
import { gable, slope, letters, textWidth, rake, darkIn } from './domus.js';
import { sacraMaterials, box, D, lin } from './sacra.js';
import { templeFrame, templeColumns } from './aedes.js';
import { NUMEN } from './numina.js';
import { artRng } from '../texgen.js';

/** The sanctuary's measures (metres): the game, the lab and the tests read them. */
export const FANUM = Object.freeze({
  half: 10,
  /** The terraces: their tops (y) and their surfaces' fronts and backs (z). */
  t1: Object.freeze({ y: 1.6, z0: 2.6, z1: 7.0 }),
  t2: Object.freeze({ y: 3.4, z0: -1.6, z1: 2.6 }),
  t3: Object.freeze({ y: 5.4, z0: -9.85, z1: -1.6 }),
  /** The massif's sides (x). */
  side: 9.8,
  /** The ramps against the lower face: their width (z from the face), their inner and outer ends (x). */
  ramp: Object.freeze({ d: 1.3, xIn: 2.1, xOut: 9.6 }),
  /** The stairs up the axis: half width. */
  stairW: 1.45,
  /** The temple on the top terrace: its middle's z. */
  templeZ: -5.7,
  /** The porticoes down the court's sides: the wall's x, the columns' x, from z0 to z1, the columns' height. */
  porticus: Object.freeze({ wall: 9.55, col: 6.75, z0: -9.4, z1: -2.3, colH: 2.7, n: 6 }),
});

const F = FANUM;

/**
 * The summit temple's measures (models/aedes.js reads a temple's from such a
 * table): a hexastyle podium temple, a little grander than a town's small
 * temple, its cella faced in marble.
 */
export const FANUM_TEMPLE = Object.freeze({
  name: 'fanum-aedes',
  // (The body's precinct is left out, but its kerb lands at the summit's front edge.)
  half: 4.08,
  k: 1.05,
  floorY: 1.4,
  podium: Object.freeze([2.95, 1.2, -3.7]),
  steps: Object.freeze([1.95, 2.55, 7]),
  cella: Object.freeze([2.72, -0.95, -3.6]),
  wall: 0.34,
  porchZ: 0.85,
  cols: Object.freeze([-2.6, -1.56, -0.52, 0.52, 1.56, 2.6]),
  more: Object.freeze([Object.freeze([-2.6, -0.12]), Object.freeze([2.6, -0.12])]),
  colH: 3.5,
  ent: 0.84,
  door: Object.freeze([0.62, 2.75]),
  altar: Object.freeze([0, 3.25, 1.1, 0.7, 0.95]),
  lamps: Object.freeze([Object.freeze([-1.3, -0.5]), Object.freeze([1.3, -0.5])]),
  pitch: D(17),
  walls: 'marble',
  statue: 1.12,
  base: Object.freeze([0.9, 0.52, 0.72]),
  spots: Object.freeze({ left: Object.freeze([-2.75, 2.25]), right: Object.freeze([2.75, 2.25]), cornerL: Object.freeze([-3.5, 2.9]), cornerR: Object.freeze([3.5, 2.9]) }),
  crowd: Object.freeze([[-2.6, 3.55, 1.9], [-3.1, 2.75, 0.9], [-3.4, 1.9, 1.2], [2.65, 2.45, -1.3], [3.2, 3.2, -1.0], [3.5, 1.7, -2.2]]),
  crowdSteps: Object.freeze([[-0.8, 3, 0.2], [0.6, 5, -0.25]]),
});

/** Where the temple's kits stand in the sanctuary's frame: [x, y, z]. */
export const TEMPLE_AT = Object.freeze([0, F.t3.y, F.templeZ]);

/** The temple's column places [x, z] (its own frame) and the porticoes' [x, z] (the sanctuary's, on the top terrace). */
export const FANUM_COLUMNS = Object.freeze(templeColumns(FANUM_TEMPLE));
export const PORTICO_COLUMNS = Object.freeze((() => {
  const P = F.porticus;
  const out = [];
  for (const s of [-1, 1]) for (let i = 0; i < P.n; i++) out.push(Object.freeze([s * P.col, P.z0 + 0.35 + (i * (P.z1 - P.z0 - 0.7)) / (P.n - 1)]));
  return out;
})());

/**
 * When each part is built, on the timeline (stage units: stage k runs from
 * k to k + 1): [start, end]. A part shows once `t` passes its start and is
 * whole at its end; walls rise between.
 */
export const FANUM_TIMES = Object.freeze({
  footings: [0, 0.3],
  lower: [0.2, 0.95],
  ramps: [0.65, 1.0],
  middle: [1.0, 1.4],
  upper: [1.3, 1.75],
  stairs: [1.4, 1.85],
  podium: [1.7, 1.85],
  cella: [1.82, 2.0],
  columns: [2.0, 2.4],
  porticoes: [2.05, 2.5],
  entablature: [2.4, 2.6],
  roofs: [2.6, 2.95],
  parapets: [2.5, 2.9],
  paving: [3.0, 3.3],
  gods: [3.25, 3.8],
  statues: [3.5, 3.8],
});

/** How far part `k` is along at `t`: 0 not begun, 1 done. */
export function grow(t, k) {
  const [a, b] = FANUM_TIMES[k];
  return Math.max(0, Math.min(1, (t - a) / (b - a)));
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** A ramp's body: a wedge along x from (xa, ya) to (xb, yb) on the ground, z0..z1 deep. */
function wedge(xa, ya, xb, yb, z0, z1) {
  const P = [
    [xa, 0, z1], [xb, 0, z1], [xb, yb, z1], [xa, ya, z1],
    [xa, 0, z0], [xb, 0, z0], [xb, yb, z0], [xa, ya, z0],
  ];
  const pos = [];
  const q = (a, b, c, d) => pos.push(...P[a], ...P[b], ...P[c], ...P[a], ...P[c], ...P[d]);
  const flip = xb > xa;
  // Front (+z), back, top, the high end.
  if (flip) { q(0, 1, 2, 3); q(5, 4, 7, 6); q(3, 2, 6, 7); q(1, 5, 6, 2); } else { q(1, 0, 3, 2); q(4, 5, 6, 7); q(2, 3, 7, 6); q(5, 1, 2, 6); }
  if (ya > 0) { if (flip) q(4, 0, 3, 7); else q(0, 4, 7, 3); }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return tintGeometry(boxUV(g));
}

/**
 * An arcaded face along x at z (its face at z, `d` deep behind it), from x0
 * to x1 and y0 to y1: piers between arches of span `span`, springing
 * `spring` over y0, the wall over them one piece whose foot runs round the
 * arches' heads. Built up to `top` (the course being laid): the piers rise
 * first; the arched strip over them only once the wall is past its crowns.
 * Returns { face, dark, arches: [x, ...] }.
 */
function arcadeFace(x0, x1, z, d, y0, y1, { n, spring, top = y1, lod = 0, skip = null }) {
  const L = x1 - x0;
  const pier = (L / n) * 0.34;
  const span = L / n - pier;
  const r = span / 2;
  const ys = y0 + spring;
  const out = { face: [], dark: [], arches: [] };
  const h = Math.min(top, y1);
  if (h <= y0 + 0.01) return out;
  const xs = [];
  for (let k = 0; k < n; k++) xs.push(x0 + pier / 2 + (k + 0.5) * (L / n));
  out.arches = xs;
  // The piers, from the foot to the springing (or the course under way).
  const pierTop = Math.min(h, ys);
  const edges = [x0, ...xs.flatMap((x) => [x - r, x + r]), x1];
  for (let k = 0; k + 1 < edges.length; k += 2) {
    const a = edges[k];
    const b = edges[k + 1];
    if (b - a > 0.01) out.face.push(box(b - a, pierTop - y0, d, (a + b) / 2, y0, z - d / 2));
  }
  // Behind the openings, the dark of the rooms.
  for (const x of xs) {
    if (skip && skip(x)) continue;
    out.dark.push(box(span, Math.min(h, ys + r) - y0, 0.05, x, y0, z - d + 0.04));
  }
  if (h < ys + r + 0.08) {
    // (The arches are being turned on their centering: the wall over the piers waits.)
    return out;
  }
  // The strip over the springing, its foot round the heads of the arches.
  const s = new Shape();
  const seg = lod === 2 ? 4 : lod ? 7 : 12;
  s.moveTo(x0, ys);
  for (const x of xs) {
    s.lineTo(x - r, ys);
    for (let k = 1; k < seg; k++) {
      const a = Math.PI - (k / seg) * Math.PI;
      s.lineTo(x + Math.cos(a) * r, ys + Math.sin(a) * r);
    }
    s.lineTo(x + r, ys);
  }
  s.lineTo(x1, ys);
  s.lineTo(x1, h);
  s.lineTo(x0, h);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, z - d);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  out.face.push(tintGeometry(boxUV(g)));
  return out;
}

/** A flight of steps up the axis from (zFoot, yFoot) to (zTop, yTop), `w` wide, `n` steps: slabs. */
function stair(w, zFoot, yFoot, zTop, yTop, n, seed, lod) {
  const out = [];
  const rise = (yTop - yFoot) / n;
  const tread = (zFoot - zTop) / n;
  for (let i = 0; i < n; i++) {
    const zf = zFoot - i * tread;
    // Each a block from the foot's level up to its own top, back to the top's face (none hangs in the air).
    out.push(slab(w, yFoot + (i + 1) * rise, zf - zTop + 0.02, { bevel: 0.012, seed: seed + i, wobble: lod ? 0 : 0.002, tone: 0.04, grime: 0.25 }).translate(0, 0, (zf + zTop - 0.02) / 2));
  }
  return out;
}

/** A parapet along x from a to b at z (or along z: `axis`), on y0: a low wall and its coping. */
function parapet(out, axis, a, b, at, y0, { h = 0.55, t = 0.3, lod = 0 } = {}) {
  if (b - a < 0.05) return;
  const L = b - a;
  const m = (a + b) / 2;
  if (axis === 'x') {
    out.ashlar.push(box(L, h, t, m, y0, at));
    out.trav.push(box(L + 0.04, 0.08, t + 0.08, m, y0 + h, at, 0.95));
  } else {
    out.ashlar.push(box(t, h, L, at, y0, m));
    out.trav.push(box(t + 0.08, 0.08, L + 0.04, at, y0 + h, m, 0.95));
  }
  void lod;
}

/** A moulded cornice band along x at z on y (its foot), `L` long, standing out `o`. */
function cornice(out, x0, x1, z, y, o = 0.12, h = 0.16) {
  out.trav.push(box(x1 - x0 + 2 * o, h * 0.45, 0.2 + o, (x0 + x1) / 2, y, z - 0.1 + o / 2, 0.92));
  out.trav.push(box(x1 - x0 + 2 * o + 0.06, h * 0.55, 0.26 + o, (x0 + x1) / 2, y + h * 0.45, z - 0.13 + o / 2 + 0.03, 0.98));
}

/** The top of a massif not yet paved: rough concrete and rubble, darker in its hollows. */
function roughTop(x0, x1, z0, z1, y) {
  return box(x1 - x0, 0.04, z1 - z0, (x0 + x1) / 2, y - 0.04, (z0 + z1) / 2, 0.82);
}

/** An engaged half-column (Tuscan) standing on y0 at (x, z) against a face, `h` tall: shaft, base and capital. */
function halfColumn(x, z, y0, h, lod) {
  const r = h / 15;
  const seg = lod ? 6 : 12;
  const shaft = new CylinderGeometry(r * 0.88, r, h - 0.3 * r * 3, seg, 1, false, -Math.PI / 2, Math.PI);
  shaft.translate(x, y0 + 0.45 * r + (h - 0.9 * r) / 2, z);
  const out = [tintGeometry(boxUV(shaft), () => 0.96)];
  out.push(box(2.3 * r, 0.45 * r, 1.2 * r, x, y0, z + 0.6 * r - 0.02, 0.9));
  out.push(box(2.4 * r, 0.45 * r, 1.25 * r, x, y0 + h - 0.45 * r, z + 0.62 * r - 0.02, 0.98));
  return out;
}

// ---------------------------------------------------------------------------
// The massif: terraces, faces, ramps, stairs
// ---------------------------------------------------------------------------

/**
 * The stepped massif up to `t`: the footings, the lower terrace's block,
 * then the middle's and the top's over the back, each face rising course
 * by course; the ramps; the stairs; the tops paved once the paving's time
 * comes (rough concrete before).
 */
function massif(out, t, god, lod, seed) {
  const X = F.side;
  const { t1, t2, t3 } = F;
  const back = t3.z0;
  // The footings: a low course round the whole plan, laid in the trenches.
  const fo = grow(t, 'footings');
  if (fo > 0 && grow(t, 'lower') < 0.3) {
    const h = 0.12 + 0.3 * fo;
    for (const [x0, x1, z0, z1] of [[-X, X, t1.z1 - 0.6, t1.z1], [-X, X, back + 0.05, back + 0.6], [-X, -X + 0.6, back, t1.z1], [X - 0.6, X, back, t1.z1], [-X, X, t2.z1 - 0.5, t2.z1 + 0.1], [-X, X, t3.z1 - 0.5, t3.z1 + 0.1]]) {
      out.core.push(box(x1 - x0, h, z1 - z0, (x0 + x1) / 2, -0.25, (z0 + z1) / 2, 0.85));
    }
    // The trenches' spoil heaped by them, the plan marked out on the ground.
    out.earth.push(box(2 * X - 0.2, 0.04, t1.z1 - back - 0.1, 0, -0.02, (t1.z1 + back) / 2, 0.75));
  }
  // The lower block: the whole plan up to the lower terrace's top.
  const lo = grow(t, 'lower');
  if (lo > 0) {
    const h = t1.y * lo;
    // Polygonal limestone faces (Praeneste's lowest terraces); the core inside.
    out.poly.push(box(2 * X, h, 0.5, 0, 0, t1.z1 - 0.25));
    out.poly.push(box(0.5, h, t1.z1 - back - 0.5, -X + 0.25, 0, (t1.z1 - 0.5 + back) / 2));
    out.poly.push(box(0.5, h, t1.z1 - back - 0.5, X - 0.25, 0, (t1.z1 - 0.5 + back) / 2));
    out.poly.push(box(2 * X - 1, h, 0.5, 0, 0, back + 0.25));
    out.core.push(box(2 * X - 1, h - 0.02, t1.z1 - back - 1, 0, 0, (t1.z1 + back) / 2, 0.8));
    if (lo >= 1) cornice(out, -X, X, t1.z1, t1.y - 0.16, 0.06, 0.16);
    // Small niches along the lower face over the ramps (dark), once it stands.
    if (lo >= 1 && lod < 2) {
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
        const x = s * (3.4 + k * 1.6);
        out.dark.push(darkIn('x', x - 0.22, x + 0.22, 0.75 + (Math.abs(x) - 2.1) * 0.21 * 0, 1.25, t1.z1, 1));
      }
    }
    if (lo < 1) out.core.push(roughTop(-X + 0.5, X - 0.5, back + 0.5, t1.z1 - 0.5, h));
  }
  // The ramps up the lower face, meeting at the landing on the axis.
  const ra = grow(t, 'ramps');
  if (ra > 0) {
    const { d, xIn, xOut } = F.ramp;
    const z0 = t1.z1;
    const z1 = t1.z1 + d;
    for (const s of [-1, 1]) {
      const xa = s * xOut;
      const xb = s * (xIn + (xOut - xIn) * (1 - ra));
      const yb = t1.y * (Math.abs(xb - xa) / (xOut - xIn));
      out.poly.push(wedge(xa, 0, xb, yb, z0, z1));
      if (ra >= 1 && lod < 2) out.trav.push(rake(s * xOut, 0.02, s * xIn, t1.y + 0.02, z1 - 0.15, 0.3, 0.05, 0.92));
    }
    if (ra >= 1) {
      out.poly.push(box(2 * xIn, t1.y, d, 0, 0, (z0 + z1) / 2));
      // The ramps' outer parapets, sloping with them, and the landing's.
      if (grow(t, 'parapets') > 0) {
        for (const s of [-1, 1]) {
          out.ashlar.push(rake(s * xOut, 0.0, s * xIn, t1.y, z1 - 0.12, 0.24, 0.55, 0.95));
          out.trav.push(rake(s * xOut, 0.55, s * xIn, t1.y + 0.55, z1 - 0.12, 0.32, 0.07, 0.97));
        }
        parapet(out, 'x', -xIn, xIn, z1 - 0.12, t1.y, { lod });
      }
    }
  }
  // The middle block, over everything behind the lower terrace.
  const mi = grow(t, 'middle');
  if (mi > 0) {
    const h = (t2.y - t1.y) * mi;
    const y0 = t1.y;
    // Its face: an arcade of arched rooms either side of the stair (squared limestone, travertine piers' caps).
    for (const s of [-1, 1]) {
      const xa = s > 0 ? F.stairW + 0.15 : -X;
      const xb = s > 0 ? X : -F.stairW - 0.15;
      const a = arcadeFace(xa, xb, t2.z1, 0.6, y0, t2.y, { n: 4, spring: 0.85, top: y0 + h, lod });
      out.ashlar.push(...a.face);
      out.dark.push(...a.dark);
    }
    out.ashlar.push(box(2 * F.stairW + 0.3, h, 0.6, 0, y0, t2.z1 - 0.3));
    out.ashlar.push(box(0.5, h, t2.z1 - back - 0.6, -X + 0.25, y0, (t2.z1 - 0.6 + back) / 2));
    out.ashlar.push(box(0.5, h, t2.z1 - back - 0.6, X - 0.25, y0, (t2.z1 - 0.6 + back) / 2));
    out.ashlar.push(box(2 * X - 1, h, 0.5, 0, y0, back + 0.25));
    out.core.push(box(2 * X - 1, h - 0.02, t2.z1 - back - 1.1, 0, y0, (t2.z1 - 0.6 + back + 0.5) / 2, 0.8));
    if (mi >= 1) cornice(out, -X, X, t2.z1, t2.y - 0.16, 0.08, 0.16);
    if (mi < 1) out.core.push(roughTop(-X + 0.5, X - 0.5, back + 0.5, t2.z1 - 0.6, y0 + h));
  }
  // The top block, over the summit court.
  const up = grow(t, 'upper');
  if (up > 0) {
    const h = (t3.y - t2.y) * up;
    const y0 = t2.y;
    // Its face: arches framed by engaged half-columns under an entablature (the Tabularium's manner).
    const top = y0 + h;
    const ent = t3.y - 0.55;
    for (const s of [-1, 1]) {
      const xa = s > 0 ? F.stairW + 0.15 : -X;
      const xb = s > 0 ? X : -F.stairW - 0.15;
      const a = arcadeFace(xa, xb, t3.z1, 0.6, y0, ent, { n: 4, spring: 0.7, top: Math.min(top, ent), lod });
      out.ashlar.push(...a.face);
      out.dark.push(...a.dark);
      if (up >= 1 && lod < 2) {
        const L = xb - xa;
        for (let k = 0; k <= 4; k++) out.trav.push(...halfColumn(xa + (k * L) / 4 + (k === 0 ? 0.25 : k === 4 ? -0.25 : 0), t3.z1, y0, ent - y0, lod));
      }
    }
    out.ashlar.push(box(2 * F.stairW + 0.3, Math.min(h, ent - y0), 0.6, 0, y0, t3.z1 - 0.3));
    // The attic over the entablature, the sanctuary's name cut in it.
    if (top > ent) out.ashlar.push(box(2 * X, top - ent, 0.6, 0, ent, t3.z1 - 0.3));
    out.ashlar.push(box(0.5, h, t3.z1 - back - 0.6, -X + 0.25, y0, (t3.z1 - 0.6 + back) / 2));
    out.ashlar.push(box(0.5, h, t3.z1 - back - 0.6, X - 0.25, y0, (t3.z1 - 0.6 + back) / 2));
    out.ashlar.push(box(2 * X - 1, h, 0.5, 0, y0, back + 0.25));
    out.core.push(box(2 * X - 1, h - 0.02, t3.z1 - back - 1.1, 0, y0, (t3.z1 - 0.6 + back + 0.5) / 2, 0.8));
    if (up >= 1) {
      out.trav.push(box(2 * X + 0.1, 0.12, 0.72, 0, ent - 0.12, t3.z1 - 0.3, 0.96));
      cornice(out, -X, X, t3.z1, t3.y - 0.16, 0.08, 0.16);
    }
    if (up < 1) out.core.push(roughTop(-X + 0.5, X - 0.5, back + 0.5, t3.z1 - 0.6, top));
    // The flanks over the vaulted substructures (Terracina's, Tibur's): a row of arched openings into
    // the dark along each side of the summit's block, their arches dressed in travertine.
    if (up >= 1) sideVaults(out, lod);
  }
  // The stairs up the axis.
  const st = grow(t, 'stairs');
  if (st > 0) {
    const w = 2 * F.stairW;
    const nMid = Math.round((t2.y - t1.y) / 0.2);
    const nTop = Math.round((t3.y - t2.y) / 0.2);
    if (st > 0) for (const g of stair(w, t2.z1 + nMid * 0.24, t1.y, t2.z1, t2.y, nMid, seed + 300, lod)) out.trav.push(g);
    if (st >= 0.5) for (const g of stair(w, t3.z1 + nTop * 0.22, t2.y, t3.z1, t3.y, nTop, seed + 340, lod)) out.trav.push(g);
    // Their cheeks.
    for (const s of [-1, 1]) {
      const x = s * (F.stairW + 0.15);
      out.trav.push(rake(t2.z1, t2.y + 0.05, t2.z1 + nMid * 0.24, t1.y + 0.05, 0, 0.3, 0.12, 0.95).rotateY(-Math.PI / 2).translate(x, 0, 0));
      if (st >= 0.5) out.trav.push(rake(t3.z1, t3.y + 0.05, t3.z1 + nTop * 0.22, t2.y + 0.05, 0, 0.3, 0.12, 0.95).rotateY(-Math.PI / 2).translate(x, 0, 0));
    }
  }
  // The tops: paved once the paving's time comes, rough concrete before.
  const pv = grow(t, 'paving');
  const tops = [[t1, -X + 0.02, X - 0.02], [t2, -X + 0.02, X - 0.02], [t3, -X + 0.02, X - 0.02]];
  const skipT3 = (x, z) => (Math.abs(x) < FANUM_TEMPLE.podium[0] + 0.12 && z < F.templeZ + FANUM_TEMPLE.steps[1] + 0.05 && z > F.templeZ + FANUM_TEMPLE.podium[2] - 0.12) || Math.abs(x) > F.porticus.col - 0.25;
  const skipStair = (x) => Math.abs(x) < F.stairW + 0.3;
  tops.forEach(([T, x0, x1], i) => {
    const ok = i === 0 ? lo >= 1 : i === 1 ? mi >= 1 : up >= 1;
    if (!ok) return;
    const z0 = i === 2 ? T.z0 + 0.02 : T.z0;
    const z1 = T.z1 - (i === 0 ? 0 : 0.6);
    if (pv > 0.25 * (i + 1) || t >= 4) {
      const skip = i === 2 ? skipT3 : i === 1 ? (x, z) => skipStair(x) && z > T.z0 + 0.05 && z < T.z1 && false : null;
      out.paving.push(...paving(x0, x1, z0, z1, T.y - 0.05, seed + 400 + i * 20, { rowW: 0.75, minL: 0.65, maxL: 1.2, lod: Math.max(lod, 1) === 1 && lod === 0 ? 0 : lod, skip, tone: 0.07, grime: 0.12 }).map((g) => g.translate(0, 0, 0)));
    } else {
      out.core.push(box(x1 - x0, 0.03, z1 - z0, (x0 + x1) / 2, T.y - 0.03, (z0 + z1) / 2, 0.86));
    }
  });
  // The forecourt's flags before the ramps (with the last paving).
  if (pv >= 1 || t >= 4) out.paving.push(...paving(-F.half + 0.05, F.half - 0.05, t1.z1 + F.ramp.d, F.half - 0.05, 0.03, seed + 470, { rowW: 0.7, minL: 0.6, maxL: 1.1, lod, tone: 0.08, grime: 0.18 }));
  // The parapets along the terraces' edges (where no stair or ramp lands).
  const pa = grow(t, 'parapets');
  if (pa >= 1) {
    for (const [T, y] of [[t1, t1.y], [t2, t2.y], [t3, t3.y]]) {
      const z = T.z1 - (T === t1 ? 0.15 : 0.45);
      if (T === t1) {
        parapet(out, 'x', -X + 0.15, -F.ramp.xIn, z, y, { lod });
        parapet(out, 'x', F.ramp.xIn, X - 0.15, z, y, { lod });
      } else {
        parapet(out, 'x', -X + 0.15, -F.stairW - 0.3, z, y, { lod });
        parapet(out, 'x', F.stairW + 0.3, X - 0.15, z, y, { lod });
      }
    }
  }
  void god;
}

/** The arched mouths of the vaults along both flanks of the summit's block (a face at x = +-side). */
function sideVaults(out, lod) {
  const X = F.side;
  const n = 4;
  const z0 = F.t3.z0 + 0.6;
  const z1 = F.t3.z1 - 0.4;
  const L = (z1 - z0) / n;
  const w = L * 0.62;
  const spring = 2.0;
  const r = w / 2;
  const seg = lod === 2 ? 5 : lod ? 8 : 12;
  for (const s of [-1, 1]) {
    for (let k = 0; k < n; k++) {
      const z = z0 + (k + 0.5) * L;
      out.dark.push(darkIn('z', z - r, z + r, 0, spring, s * X, s));
      // (A whole disc round the springing: its lower half lies over the dark below, so the two read as one arch.)
      const head = new CylinderGeometry(r, r, 0.05, seg * 2, 1).rotateZ(Math.PI / 2);
      out.dark.push(tintGeometry(boxUV(head)).translate(s * (X + 0.025), spring, z));
      if (lod < 2) {
        const pts = [];
        for (let j = 0; j <= seg; j++) {
          const a = (j / seg) * Math.PI;
          pts.push([s * (X + 0.04), spring + Math.sin(a) * (r + 0.1), z + Math.cos(a) * (r + 0.1)]);
        }
        out.trav.push(tube(pts, 0.09, { radial: 4, segments: seg * 2, around: 0.3 }));
        for (const dz of [-1, 1]) out.trav.push(box(0.12, 0.16, 0.3, s * (X + 0.04), spring - 0.16, z + dz * (r + 0.1)));
      }
    }
  }
}

/** The sanctuary's name cut in the top face's attic and gilded: FANVM CERERIS... */
function dedication(out, god, lod) {
  const name = { ceres: 'CERERIS', neptune: 'NEPTVNI', mercury: 'MERCVRII', mars: 'MARTIS', venus: 'VENERIS' }[god];
  const text = `FANVM ${name}`;
  const y0 = F.t3.y - 0.55 + 0.12;
  const h = 0.26;
  const z = F.t3.z1 + 0.012;
  if (lod === 0) out.gilt.push(...letters(text, y0 + (0.55 - 0.12 - 0.16 - h) / 2, z, h));
  else if (lod === 1) out.gilt.push(box(textWidth(text, h), h * 0.6, 0.008, 0, y0 + 0.06, z));
  // A painted band in the god's colour under the cornice, the length of the face.
  const N = NUMEN[god];
  out.paint.push(box(2 * F.side - 0.1, 0.05, 0.012, 0, F.t3.y - 0.2, F.t3.z1 + 0.008, () => N.trim));
}

// ---------------------------------------------------------------------------
// The porticoes round the summit court
// ---------------------------------------------------------------------------

/** The porticoes' walls, architraves, frieze in the god's colour and their lean-to roofs, up to `t`. */
function porticoes(out, t, god, lod, seed) {
  const P = F.porticus;
  const y0 = F.t3.y;
  const w = grow(t, 'porticoes');
  if (w <= 0) return;
  const N = NUMEN[god];
  const wallH = P.colH + 0.9;
  for (const s of [-1, 1]) {
    const xw = s * P.wall;
    // The back wall: stucco over squared stone, a dark red dado inside under the roof.
    out.ashlar.push(box(0.3, wallH * Math.min(1, w * 1.6), P.z1 - P.z0 + 0.3, xw, y0, (P.z0 + P.z1) / 2));
    if (w >= 1 && lod < 2) {
      out.fresco.push(box(0.012, 0.9, P.z1 - P.z0 - 0.1, xw - s * 0.156, y0, (P.z0 + P.z1) / 2, () => lin(0x6a2418, 1.2)));
      out.fresco.push(box(0.012, wallH - 1.0, P.z1 - P.z0 - 0.1, xw - s * 0.156, y0 + 0.9, (P.z0 + P.z1) / 2, () => lin(0xd8c8a0)));
    }
    // The end walls (antae) at the front and back.
    for (const z of [P.z0 - 0.1, P.z1 + 0.1]) out.ashlar.push(box(Math.abs(P.wall - P.col) + 0.35, wallH * Math.min(1, w * 1.6), 0.3, s * (P.wall + P.col) / 2, y0, z));
    const en = grow(t, 'entablature');
    if (en > 0) {
      const ay = y0 + P.colH;
      // The architrave on the columns, the frieze painted in the god's colour, a cornice.
      out.trav.push(box(0.34, 0.24, P.z1 - P.z0 + 0.3, s * P.col, ay, (P.z0 + P.z1) / 2, 0.95));
      out.paint.push(box(0.012, 0.18, P.z1 - P.z0 + 0.3, s * (P.col - 0.175), ay + 0.04, (P.z0 + P.z1) / 2, () => N.frieze));
      out.trav.push(box(0.42, 0.08, P.z1 - P.z0 + 0.36, s * P.col, ay + 0.24, (P.z0 + P.z1) / 2, 0.98));
      // The beams across to the wall.
      if (lod === 0) for (const [, z] of PORTICO_COLUMNS.filter(([x]) => Math.sign(x) === s)) out.wood.push(box(Math.abs(P.wall - P.col), 0.14, 0.14, s * (P.wall + P.col) / 2, ay + 0.18, z, 0.8));
    }
    const ro = grow(t, 'roofs');
    if (ro > 0) {
      // A lean-to of tiles from the wall's top down to the columns, its eave over the court.
      const hiY = y0 + wallH + 0.05;
      const loY = y0 + P.colH + 0.32;
      const xa = s * (P.wall + 0.2);
      const xb = s * (P.col - 0.45);
      if (ro >= 1) {
        const r = gableHalf(xa, hiY, xb, loY, P.z0 - 0.25, P.z1 + 0.25, lod, seed + (s > 0 ? 7 : 3));
        out.tile.push(...r.tile);
        out.wood.push(...r.wood);
      } else {
        // The rafters going up first.
        for (let z = P.z0; z <= P.z1 + 0.01; z += 0.9) out.wood.push(rake(xa, hiY - 0.12, xb, loY - 0.12, 0, 0.1, 0.12, 0.8).rotateY(0).translate(0, 0, z));
      }
    }
  }
  // The back of the court: a wall closing it behind the temple, coped in travertine.
  const bw = Math.min(1, w * 1.6);
  out.ashlar.push(box(2 * P.col + 0.3, 1.6 * bw, 0.3, 0, y0, F.t3.z0 + 0.15));
  if (bw >= 1) out.trav.push(box(2 * P.col + 0.4, 0.08, 0.38, 0, y0 + 1.6, F.t3.z0 + 0.15, 0.95));
}

/** One slope of tiles (a lean-to) from its top edge at (xa, ya) down to its eave at (xb, yb), across z0..z1: domus.js slope. */
function gableHalf(xa, ya, xb, yb, z0, z1, lod, seed) {
  // (The quad: the eave's ends left to right as seen from under it, then the top's, right to left.)
  const s = Math.sign(xa - xb);
  const [za, zb] = s > 0 ? [z0, z1] : [z1, z0];
  return slope([[xb, yb, za], [xb, yb, zb], [xa, ya, zb], [xa, ya, za]], { lod, seed });
}

// ---------------------------------------------------------------------------
// The temple while it is built (the finished temple is the god's kits: aedes.js)
// ---------------------------------------------------------------------------

/** The temple up to `t` (before the dedication's stage): its podium, the cella's walls, the entablature, the roof going on. */
function templeRising(out, t, lod, seed) {
  if (t >= 3) return;
  const M = FANUM_TEMPLE;
  const T = templeFrame(M);
  const [ox, oy, oz] = TEMPLE_AT;
  const put = (list, g) => list.push(g.translate(ox, oy, oz));
  const po = grow(t, 'podium');
  if (po > 0) {
    const [px, pz1, pz0] = M.podium;
    put(out.trav, box(2 * px, M.floorY * po, pz1 - pz0, 0, 0, (pz1 + pz0) / 2));
    if (po >= 1) {
      // The steps up the front.
      const [sw, sz, n] = M.steps;
      for (const g of stair(2 * sw, sz, 0, pz1, M.floorY, n, seed, lod)) put(out.trav, g);
    }
  }
  const ce = grow(t, 'cella');
  if (ce > 0) {
    const [CX, CZ1, CZ0] = M.cella;
    const h = M.colH * ce;
    const W = M.wall;
    put(out.marble, box(2 * CX, h, W, 0, M.floorY, CZ0 + W / 2));
    for (const s of [-1, 1]) put(out.marble, box(W, h, CZ1 - CZ0, s * (CX - W / 2), M.floorY, (CZ1 + CZ0) / 2));
    const [dw, dh] = M.door;
    for (const s of [-1, 1]) put(out.marble, box(CX - dw - W / 2, h, W, s * (dw + (CX - dw) / 2), M.floorY, CZ1 - W / 2));
    if (h > dh) put(out.marble, box(2 * dw, h - dh, W, 0, M.floorY + dh, CZ1 - W / 2));
    put(out.dark, box(2 * dw, Math.min(h, dh), 0.05, 0, M.floorY, CZ1 - W + 0.03));
  }
  const en = grow(t, 'entablature');
  if (en > 0) {
    const { AB, EX, EZ1, EZ0 } = T;
    const h = M.ent * Math.min(1, en * 1.5);
    put(out.marble, box(2 * EX, h, 0.45, 0, AB, EZ1 - 0.22));
    put(out.marble, box(2 * EX, h, 0.45, 0, AB, EZ0 + 0.22));
    for (const s of [-1, 1]) put(out.marble, box(0.45, h, EZ1 - EZ0 - 0.9, s * (EX - 0.22), AB, (EZ1 + EZ0) / 2));
  }
  const ro = grow(t, 'roofs');
  if (ro > 0 && en >= 1) {
    const { EAVE, EX, EZ1, EZ0, G } = T;
    if (ro < 1) {
      // The roof's timbers: the ridge beam and rafters, the tiles to come.
      put(out.wood, box(0.16, 0.16, EZ1 - EZ0 + 0.3, 0, G.apex - 0.2, (EZ1 + EZ0) / 2, 0.8));
      for (let z = EZ0; z <= EZ1 + 0.01; z += 0.75) {
        for (const s of [-1, 1]) put(out.wood, rake(0, G.apex - 0.15, s * (EX + 0.2), EAVE - 0.05, z, 0.1, 0.1, 0.8));
      }
    } else {
      const r = gable({ x0: -EX - 0.04, x1: EX + 0.04, z0: EZ0 - 0.04, z1: EZ1 + 0.04, eaveY: EAVE, pitch: M.pitch, along: 'z', lod, seed: seed + 60, over: 0.24, gableOver: 0.16 });
      for (const g of r.tile) put(out.tile, g);
      for (const s of [1, -1]) put(out.marble, box(2 * EX + 0.3, (G.apex - EAVE) * 0.5, 0.3, 0, EAVE, s > 0 ? EZ1 - 0.15 : EZ0 + 0.15));
    }
  }
}

/** Which of the temple's columns stand at `t` (in order, the front row first): their places in FANUM_COLUMNS. */
export function templeColumnsAt(t) {
  if (t >= 3) return FANUM_COLUMNS.length;
  return Math.round(grow(t, 'columns') * FANUM_COLUMNS.length);
}

/** How many of the porticoes' columns stand at `t`. */
export function porticoColumnsAt(t) {
  if (t >= 3) return PORTICO_COLUMNS.length;
  return Math.round(grow(t, 'porticoes') * PORTICO_COLUMNS.length);
}

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------

/** The materials of the sanctuary: the temples' (sacra.js) and its masonry's. */
export function fanumMaterials() {
  const m = sacraMaterials();
  return {
    ...m,
    poly: material('fanum-polygonal', { surface: 'polygonal', color: 0xf2ece0, vertexColors: true, snow: 1 }),
    ashlar: material('fanum-ashlar', { surface: 'ashlarLime', vertexColors: true, snow: 1 }),
    core: material('rubble-wall', { surface: 'rubble', vertexColors: true, snow: 1 }),
  };
}

/** The bins a sanctuary's kit gathers, by material key. */
export function fanumBins() {
  const keys = ['poly', 'ashlar', 'trav', 'core', 'paving', 'marble', 'dark', 'tile', 'wood', 'fresco', 'paint', 'gilt', 'bronze', 'earth', 'leaf', 'flowers', 'water', 'stream', 'ring', 'props', 'iron', 'clay', 'cloth', 'stucco'];
  return Object.fromEntries(keys.map((k) => [k, []]));
}

/**
 * The sanctuary's own kit at timeline `t` (4 finished) for `god`: the
 * massif, its faces, ramps, stairs and pavings, the porticoes, the temple
 * while it rises, the god's own ground once its time comes (`extra(out,
 * t, lod)`: fanumGods.js). { group, meshes, triangles }.
 */
export function buildFanum(god, t, { lod = 0, seed = 1201, extra = null } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = fanumBins();
  massif(out, t, god, lod, seed);
  porticoes(out, t, god, lod, seed + 500);
  templeRising(out, t, lod, seed + 700);
  if (grow(t, 'upper') >= 1) dedication(out, god, lod);
  if (extra) extra(out, t, lod);
  const m = fanumMaterials();
  const p = new TaggedParts(`fanum-${god}`);
  const small = { cast: false };
  p.add('polygonal', m.poly, out.poly);
  p.add('ashlar', m.ashlar, out.ashlar);
  p.add('dressings', m.trav, out.trav);
  p.add('core', m.core, out.core);
  p.add('paving', m.trav, out.paving, small);
  p.add('marble', m.marble, out.marble);
  p.add('inside', m.dark, out.dark, small);
  p.add('roof', m.tile, out.tile);
  p.add('timber', m.wood, out.wood);
  if (out.fresco.length) p.add('fresco', m.fresco, out.fresco, small);
  if (out.paint.length) p.add('paint', m.painted, out.paint, small);
  if (out.gilt.length) p.add('gilt', m.gilt, out.gilt, small);
  if (out.bronze.length) p.add('bronze', m.bronze, out.bronze, { cast: lod === 0 });
  if (out.earth.length) p.add('earth', material('beaten-earth', { surface: 'earth', vertexColors: true, snow: 1 }), out.earth, small);
  if (out.leaf.length) p.add('leaf', m.garland, out.leaf, { cast: lod < 2 });
  if (out.flowers.length) p.add('flowers', m.flowers, out.flowers, small);
  if (out.water.length) p.add('water', m.water, out.water, small);
  // (The springs' jets and the rings they make: the fountains' moving water, see-through.)
  if (out.stream.length) p.add('stream', m.stream, out.stream, small);
  if (out.ring.length) p.add('rings', m.ring, out.ring, small);
  if (out.stucco.length) p.add('stucco', m.stucco, out.stucco);
  if (out.props.length) p.add('props', m.paint, out.props, { cast: lod === 0 });
  if (out.iron.length) p.add('iron', m.iron, out.iron, small);
  if (out.clay.length) p.add('clay', m.clay, out.clay, small);
  if (out.cloth.length) p.add('cloth', m.cloth, out.cloth, small);
  return p.build();
}

/** A hash of a place for scattering: [0, 1). */
export function scatter(seed) {
  return artRng(seed);
}

export { tube, revolve, profileOf };
