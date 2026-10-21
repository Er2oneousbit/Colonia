/**
 * models/thermae.js
 * ----------------------------------------------------------------------------
 * The Great Baths (Thermae), a monument on a 5 x 5 footprint (20 m), as a
 * great public bath of the Greek cities of Italy and Sicily stood about
 * 300 BC: a palaestra, a cold pool, and a block of round and long bath
 * rooms, all of tufa stuccoed and painted under timber roofs. No vaults, no
 * glass, no concrete, no hypocaust: those are three to six centuries later.
 *
 * The record it is built from:
 *   - The Greek public baths of the fourth century BC at Gela, Syracuse,
 *     Olympia, Eretria and Megara Hyblaea: rooms of hip-baths (sitz baths,
 *     the bather seated in a clay tub) set in a ring round the wall of a
 *     round room (a tholos) under a conical tiled roof; a sweat room
 *     (laconicum) likewise round, with a smoke hole at the apex; a long
 *     rectangular hall of individual tubs under a timber-trussed gable; an
 *     open-air cold plunge pool; water warmed in bronze boilers over a
 *     stoked furnace, carried by clay and lead pipes; a cistern.
 *   - The oldest phase of the Stabian Baths at Pompeii (fifth to fourth
 *     century BC, Samnite): the same plan in a small town, hip-bath rooms
 *     round a court, the furnace yard behind.
 *   - Vitruvius 5.11, the Greek palaestra: a court of porticoes round a
 *     square, the colonnade of a Doric or Tuscan order, a running track
 *     (the xystos) along the side, benches and a basin; the athletes'
 *     oil, the ball games and the lifted weights.
 *
 * So, in 20 m: from the street (+z) the low front wall with the gate and,
 * behind it, the natatio (the cold pool, open to the sky, its tufa rim);
 * left of the gate the palaestra, a sand court with a stuccoed colonnade of
 * tufa columns along three sides (west, north, street) under lean-to tiled
 * roofs, a running track down the east edge; behind the court and the
 * pool the bath block: the long tub hall (tiled gable, high square
 * windows with timber shutters), then the two tholoi side by side, the hot
 * hip-bath room and the sweat room with its smoke hole; behind them the
 * furnace yard: the praefurnium (the stoke hole) in a masonry base, the
 * bronze boilers on it, a terracotta flue, the woodpile and the shed, the
 * cistern fed from the aqueduct with its lead pipe to the boilers. Walls
 * are tufa ashlar and rubble, stuccoed cream over a red dado; the eaves
 * carry terracotta antefixes.
 *
 * The site, as the sim builds it in four stages (data/monuments.js):
 *   0  foundations and the pool dug: trenches, rubble footings under the
 *      hall and the tholoi, the pool's pit
 *   1  the walls: ashlar rising course by course on every wall, the
 *      tholoi's drums, the pool's basin, under scaffolds and the crane
 *   2  the roofs' timber: the hall's trusses raised one by one with the
 *      ridge and purlins, the tholoi's cones of rafters and hoops, the
 *      pool's tufa rim laid
 *   3  tiles and stucco: the roofs tiled panel by panel with their
 *      antefixes, the walls rendered and the dado painted, then the
 *      palaestra's colonnade, its sand and the gate
 * each `f` (0..1) of the way through (thermaeSite: its scaffolds, cranes
 * and piles as models/worksite.js draws them).
 *
 * Finished, its state (meshes tagged in userData.when, models.js partShows):
 *   'flowing'  working (staffed, heated, piped): the stoke hole's coals lit,
 *              smoke from the flue and the cones' smoke holes, the hall's
 *              windows lit from within at night (lamplight behind the open
 *              shutters), the hot room's roof clear of snow; in a hard
 *              frost steam from the smoke holes and the windows ('ice')
 *   'still'    water but cold (no timber, or no staff): the furnace dark,
 *              the pool full and still
 *   'dry'      no piped water: the pool empty, a stain at the waterline
 * `sacked`: raiders' work: rubble at the gate, columns thrown down, soot up
 * the walls, the statues gone, a hall roof panel and a cone burnt in.
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z,
 * as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry, BoxGeometry, Vector3, Shape, ExtrudeGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube, D } from '../shapes.js';
import { material, shallowWaterMaterial, streamMaterial, iceMaterial } from '../materials.js';
import { slab, paving, tuscanColumn, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin, woodpile, ruralMaterials, leanTo, gableRoof } from './rural.js';
import { staff } from './castra.js';
import { roofSlope } from './learning.js';
import { healthMaterials, steamMaterial, plume, coals } from './healing.js';
import { statue } from './domus.js';
import { box, bag, placed, risingWall, rubbleHeap, fallenColumn, scorch } from './civicParts.js';
import { addSite } from './worksite.js';
import { DYES } from '../people/actors.js';
import { SEAT_H } from '../people/clips.js';

/** The baths' measures (metres): the tests, the lab and the game read them. */
export const THERMAE = Object.freeze({
  half: 10,
  /** The tub hall: x0..x1, z0..z1 (outer faces), its walls' thickness, its eaves, the sill of its high windows. */
  hall: Object.freeze({ x0: -9.6, x1: -0.3, z0: -6.0, z1: -0.8, t: 0.5, eave: 3.7, win: 3.05 }),
  /** The two tholoi (round bath rooms): middle, outer radius, wall thickness and height, the cone's rise, its top radius. */
  hot: Object.freeze({ x: 2.1, z: -3.4, R: 2.4, t: 0.55, h: 3.0, rise: 2.5, top: 0.3 }),
  sweat: Object.freeze({ x: 6.5, z: -3.4, R: 2.0, t: 0.5, h: 2.8, rise: 2.1, top: 0.42 }),
  /** The natatio: x0..x1, z0..z1 (its walls' outer faces), its rim's height, its water's. */
  pool: Object.freeze({ x0: 2.6, x1: 8.0, z0: 4.6, z1: 9.0, rim: 0.9, water: 0.8 }),
  /**
   * The palaestra: its outer walls (west x, street z), the colonnade's lines (west x, north z, street z),
   * the court's east end, the wall's height, the roofs' eaves, the running track's x0..x1 and z0..z1.
   */
  pal: Object.freeze({ west: -9.8, street: 9.8, colW: -7.5, colN: 1.4, colS: 7.6, east: 0.4, h: 2.9, eave: 2.5, track: Object.freeze({ x0: 8.8, x1: 9.7, z0: -0.4, z1: 9.4 }) }),
  /** The gate in the street wall: x0..x1; the wall's low run to its east. */
  gate: Object.freeze({ x0: 0.8, x1: 2.3, low: 1.3 }),
  /** The service yard behind the block: z0..z1, its walls' height. */
  yard: Object.freeze({ z0: -9.8, z1: -6.0, h: 2.4 }),
  /** The praefurnium's masonry base (the boilers stand on it): x0..x1, z0..z1, its height. */
  base: Object.freeze({ x0: 0.7, x1: 3.5, z0: -7.9, z1: -5.8, h: 0.95 }),
  /** The cistern in the west yard: x0..x1, z0..z1, its walls' top. */
  cistern: Object.freeze({ x0: -9.5, x1: -6.2, z0: -9.5, z1: -6.4, h: 3.0 }),
});

const T = THERMAE;
const H = T.hall;
const A = T.hot;
const B = T.sweat;
const P = T.pool;
const PAL = T.pal;
const G = T.gate;
const Y = T.yard;
const BASE = T.base;

/** The four stages of the site and the finished baths. */
export const THERMAE_STAGES = 4;

/** Is stage s (0-3) of a site at `stage` with `f` of it done: 1 built, its share while under way, 0 not begun. */
function share(stage, f, s) {
  return stage > s ? 1 : stage === s ? f : 0;
}

/** Is the render on (the walls cream over the red dado)? Tufa ashlar shows until stage 3 is a third through. */
function stuccoed(stage, f) {
  return stage >= 4 || (stage === 3 && f >= 0.35);
}

/** The list a wall goes into: tufa ashlar, or the render. */
function skinOf(out, stage, f) {
  return stuccoed(stage, f) ? out.plaster : out.ash;
}

/** The hall's ridge's height: a low Greek pitch of 22 degrees over the half span. */
const HALL_RIDGE = H.eave + ((H.z1 - H.z0) / 2) * Math.tan(D(22));
/** The hall's roof panels (tiled one after another along it) and its trusses. */
const HALL_PANELS = 4;
const HALL_TRUSSES = 7;
const trussX = (i) => H.x0 + 0.9 + (i * (H.x1 - H.x0 - 1.8)) / (HALL_TRUSSES - 1);

// ---------------------------------------------------------------------------
// Small parts
// ---------------------------------------------------------------------------

/** A wall built along x facing +z at its face's middle (x, z), turned ry, cut at course c. */
function wallAt(list, len, h, t, x, z, ry, openings, c, lod) {
  for (const g of risingWall(len, h, t, openings, c, lod)) list.push(placed(g, x, 0, z, ry));
}

/** A round wall (a tholos's drum) about (cx, cz): outer radius R, `t` thick, `c` high, hard edges at the top. */
function drum(cx, cz, R, t, c, lod, k = 0.9) {
  const prof = profileOf([[R, 0], [R, c], { sharp: true }, [R - t, c], { sharp: true }, [R - t, 0]]);
  return revolve(prof, { segments: lod === 2 ? 14 : lod ? 24 : 40, metres: 1, tint: () => k }).translate(cx, 0, cz);
}

/** A gable's triangular end wall, w wide at the foot, `rise` high, `t` thick, its face at z = 0 (back to -t). */
function gableEnd(w, rise, t) {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, rise);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t);
  return tintGeometry(boxUV(g), () => 0.92);
}

/** A palmette antefix (the tile closing the eave's last imbrex) at (x, y, z) facing ry: a small upright terracotta plate. */
function antefix(x, y, z, ry) {
  return placed(box(0.15, 0.2, 0.05, 0, 0, 0, 0.95), x, y, z, ry);
}

/** A ring (hoop) of timber rods about (cx, cz), radius r at height y, n sides. */
function hoop(cx, cz, r, y, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = ((i + 1) / n) * Math.PI * 2;
    out.push(staff([cx + Math.sin(a) * r, y, cz + Math.cos(a) * r], [cx + Math.sin(b) * r, y, cz + Math.cos(b) * r], 0.035, 4));
  }
  return out;
}

/** A tube of tile or clay standing on y (a chimney pot, a smoke hole's ring): radius r, from y0 to y1, `t` thick. */
function pot(cx, cz, r, y0, y1, t, lod) {
  return revolve(profileOf([[r + t, y0], [r + t, y1], { sharp: true }, [r - t, y1], { sharp: true }, [r - t, y0]]), { segments: lod ? 10 : 18, metres: 1, tint: () => 0.85 }).translate(cx, 0, cz);
}

// ---------------------------------------------------------------------------
// The ground
// ---------------------------------------------------------------------------

/** The ground: the site's trodden earth, the walks paved once the walls stand, the court's and the track's sand. */
function ground(lod, seed, out, stage, f) {
  const Hh = T.half;
  out.earth.push(box(2 * Hh - 0.04, 0.02, 2 * Hh - 0.04, 0, 0, 0, (x, y, z) => 0.85 + 0.12 * Math.cos(x * 0.9) * Math.cos(z * 0.7)));
  if (stage >= 3) {
    // The walk from the gate to the court, round the pool, and between the pool and the tholoi.
    out.flags.push(...paving(G.x0 + 0.1, G.x1 - 0.1, P.z1 - 0.2, PAL.street - 0.4, 0.05, seed, { rowW: 0.55, minL: 0.5, maxL: 0.9, lod }));
    out.flags.push(...paving(PAL.east + 0.1, P.x1 + 0.7, -1.0, P.z0, 0.05, seed + 3, { rowW: 0.55, minL: 0.5, maxL: 0.9, lod }));
    out.flags.push(...paving(PAL.east + 0.1, P.x0, P.z0, P.z1 - 0.2, 0.05, seed + 5, { rowW: 0.55, minL: 0.5, maxL: 0.9, lod }));
  }
  // The court's sand and the track's (stage 3 lays them).
  if (share(stage, f, 3) >= 0.5) {
    const rough = (x, y, z) => 0.9 + 0.1 * Math.cos(x * 1.7) * Math.cos(z * 1.3);
    const cx0 = PAL.colW + 0.25;
    const cz0 = PAL.colN + 0.25;
    const cz1 = PAL.colS - 0.25;
    out.sand.push(box(PAL.east - cx0, 0.035, cz1 - cz0, (cx0 + PAL.east) / 2, 0, (cz0 + cz1) / 2, rough));
    const tk = PAL.track;
    out.sand.push(box(tk.x1 - tk.x0, 0.035, tk.z1 - tk.z0, (tk.x0 + tk.x1) / 2, 0, (tk.z0 + tk.z1) / 2, rough));
  }
}

// ---------------------------------------------------------------------------
// Foundations
// ---------------------------------------------------------------------------

/** The trenches dug and the rubble footings rising in them under the hall and the tholoi; the pool's pit. */
function foundations(lod, seed, out, stage, f) {
  const footH = stage === 0 ? 0.08 + 0.3 * Math.min(1, f * 1.7) : 0.38;
  const runs = [
    [H.x0, H.x1, H.z1 - H.t, H.z1], [H.x0, H.x1, H.z0, H.z0 + H.t], [H.x0, H.x0 + H.t, H.z0, H.z1], [H.x1 - H.t, H.x1, H.z0, H.z1],
  ];
  if (stage === 0) {
    for (const [x0, x1, z0, z1] of runs) out.trench.push(box(x1 - x0 + 0.5, 0.025, z1 - z0 + 0.5, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0.8));
    for (const q of [A, B]) {
      const ring = new CylinderGeometry(q.R + 0.3, q.R + 0.3, 0.025, lod ? 20 : 36, 1);
      out.trench.push(tintGeometry(boxUV(ring.translate(q.x, 0.0125, q.z)), () => 0.8));
    }
    // The pool's pit: the earth dug out, darker.
    out.trench.push(box(P.x1 - P.x0 - 0.1, 0.03, P.z1 - P.z0 - 0.1, (P.x0 + P.x1) / 2, 0, (P.z0 + P.z1) / 2, 0.62));
  }
  for (const [x0, x1, z0, z1] of runs) out.core.push(box(x1 - x0 + 0.1, footH, z1 - z0 + 0.1, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0.85));
  for (const q of [A, B]) out.core.push(drum(q.x, q.z, q.R + 0.1, q.t + 0.2, footH, lod, 0.85));
  void seed;
}

// ---------------------------------------------------------------------------
// The tub hall
// ---------------------------------------------------------------------------

/** The window openings of one long wall of the hall (offsets from its middle): four high squares under the eaves. */
const HALL_WINDOWS = Object.freeze([-3.3, -1.1, 1.1, 3.3]);

/** The tub hall's walls: the door to the portico, the high windows with their shutters, the gable ends once the trusses stand. */
function hall(lod, seed, out, stage, f) {
  const c = H.eave * share(stage, f, 1);
  if (c <= 0) return;
  const W = skinOf(out, stage, f);
  const len = H.x1 - H.x0;
  const xc = (H.x0 + H.x1) / 2;
  const zc = (H.z0 + H.z1) / 2;
  const wins = HALL_WINDOWS.map((x) => ({ x, w: 0.5, h: 0.5, y: H.win }));
  const door = { x: -1.0, w: 1.2, h: 2.2, y: 0 };
  wallAt(W, len, H.eave, H.t, xc, H.z1, 0, [door, ...wins], c, lod);
  wallAt(W, len, H.eave, H.t, xc, H.z0, Math.PI, [...wins, { x: 2.5, w: 1.0, h: 2.1, y: 0 }], c, lod);
  const len2 = H.z1 - H.z0 - 2 * H.t;
  wallAt(W, len2, H.eave, H.t, H.x1, zc, Math.PI / 2, [], c, lod);
  wallAt(W, len2, H.eave, H.t, H.x0, zc, -Math.PI / 2, [], c, lod);
  // The gable ends (rubble and ashlar up to the ridge) once the roof timber is up.
  if (stage >= 3 || (stage === 2 && f > 0.7)) {
    const span = H.z1 - H.z0 - 0.1;
    const rise = HALL_RIDGE - H.eave;
    W.push(placed(gableEnd(span, rise, H.t), H.x1, H.eave, zc, Math.PI / 2), placed(gableEnd(span, rise, H.t), H.x0, H.eave, zc, -Math.PI / 2));
  }
  if (c < H.eave - 1e-6) return;
  // The dark of the hall through the door and the windows (a box inside, faces in).
  out.dark.push(box(len - 2 * H.t - 0.02, H.eave - 0.12, len2 - 0.02, xc, 0.1, zc, 1));
  // The door's tufa jambs and lintel.
  const dx = xc + door.x;
  out.tufa.push(slab(door.w + 0.5, 0.22, 0.55, { bevel: 0.012, seed: seed + 1, wobble: 0.002, tone: 0.04, grime: 0.2 }).translate(dx, door.h, H.z1 - 0.2));
  for (const e of [-1, 1]) out.tufa.push(slab(0.22, door.h, 0.5, { bevel: 0.012, seed: seed + 2 + e, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(dx + e * (door.w / 2 + 0.11), 0, H.z1 - 0.2));
  if (stage < 3 || (stage === 3 && f < 0.5)) return;
  // The door of timber planks, shut.
  out.wood.push(box(door.w - 0.04, door.h - 0.04, 0.06, dx, 0.02, H.z1 - 0.3, 0.85));
  // The high windows: the opening's dark, the lit pane for the night, the timber shutters swung open, a tufa sill.
  for (const [wz, ry, sgn] of [[H.z1, 0, 1], [H.z0, Math.PI, -1]]) {
    for (const x of HALL_WINDOWS) {
      const wx = xc + x * sgn;
      out.glassDark.push(placed(box(0.5, 0.5, 0.03, 0, H.win, -H.t * 0.55, 1), wx, 0, wz, ry));
      out.glass.push(placed(box(0.5, 0.5, 0.03, 0, H.win, -H.t * 0.55, 1), wx, 0, wz, ry));
      for (const e of [-1, 1]) {
        const leaf = placed(box(0.24, 0.5, 0.035, e * 0.12, 0, 0, 0.8), 0, 0, 0, e * 1.25);
        out.wood.push(placed(leaf, wx + e * 0.27 * sgn, H.win, wz + (ry ? -0.02 : 0.02), ry));
      }
      out.tufa.push(placed(slab(0.66, 0.08, 0.2, { bevel: 0.01, seed: seed + x * 3, wobble: 0, tone: 0.03, grime: 0.2 }), wx, H.win - 0.08, wz + (ry ? -0.04 : 0.04), ry));
    }
  }
  // The red dado along the hall's court face (a man's height).
  out.red.push(box(len, 0.95, 0.012, xc, 0.02, H.z1 + 0.006, 1));
  out.red.push(placed(box(len, 0.95, 0.012, 0, 0.02, 0.006, 1), xc, 0, H.z0, Math.PI));
}

/** The hall's roof timber and its tiles: trusses raised one by one (stage 2), the panels tiled one after another (stage 3). */
function hallRoof(lod, seed, out, stage, f, sacked) {
  if (stage < 2) return;
  const zc = (H.z1 + H.z0) / 2;
  const framed = stage >= 3 ? HALL_TRUSSES : Math.max(1, Math.min(HALL_TRUSSES, Math.round(HALL_TRUSSES * Math.min(1, f * 1.15))));
  const tiledShare = stage >= 4 ? 1 : stage === 3 ? Math.min(1, f / 0.75) : 0;
  const nTiled = Math.min(HALL_PANELS, Math.ceil(HALL_PANELS * tiledShare - 1e-9));
  const pw = (H.x1 - H.x0) / HALL_PANELS;
  const panelOf = (x) => Math.min(HALL_PANELS - 1, Math.max(0, Math.floor((x - H.x0) / pw)));
  // A panel the raiders burnt through shows its trusses again (its tiles gone).
  const broken = (i) => sacked && i === 2;
  const covered = (x) => panelOf(x) < nTiled && !broken(panelOf(x));
  const zl = H.z0 - 0.1;
  const zr = H.z1 + 0.1;
  const trusses = stage >= 4 && !sacked ? 0 : framed;
  for (let i = 0; i < trusses; i++) {
    const x = trussX(i);
    if (covered(x)) continue;
    // A king-post truss: the tie beam across the walls, the rafters, the post and two struts.
    out.wood.push(staff([x, H.eave + 0.04, zl], [x, H.eave + 0.04, zr], 0.075, 5));
    out.wood.push(staff([x, H.eave, zl], [x, HALL_RIDGE, zc], 0.06, 5), staff([x, H.eave, zr], [x, HALL_RIDGE, zc], 0.06, 5));
    out.wood.push(staff([x, H.eave + 0.04, zc], [x, HALL_RIDGE - 0.02, zc], 0.06, 5));
    for (const z of [zl, zr]) out.wood.push(staff([x, H.eave + 0.06, zc + (z - zc) * 0.45], [x, HALL_RIDGE - 0.35, zc], 0.045, 4));
  }
  // The ridge pole and the purlins over the trusses raised so far.
  if (framed >= 2 && trusses > 0) {
    const xa = trussX(0);
    const xb = trussX(framed - 1);
    const ym = H.eave + (HALL_RIDGE - H.eave) * 0.5;
    out.wood.push(staff([xa, HALL_RIDGE, zc], [xb, HALL_RIDGE, zc], 0.07, 5));
    for (const z of [zc + (zl - zc) * 0.5, zc + (zr - zc) * 0.5]) out.wood.push(staff([xa, ym, z], [xb, ym, z], 0.05, 4));
  }
  // The tiles: a panel of the roof each (the gable's overhang only at the ends), the antefixes along the eaves.
  for (let i = 0; i < HALL_PANELS; i++) {
    if (i >= nTiled || broken(i)) continue;
    const xa = H.x0 + i * pw - (i === 0 ? 0.22 : 0);
    const xb = H.x0 + (i + 1) * pw + (i === HALL_PANELS - 1 ? 0.22 : 0);
    const r = gableRoof({ x0: xa, x1: xb, z0: H.z0, z1: H.z1, eaveY: H.eave, along: 'x', lod, seed: seed + i * 5, gableOver: 0 });
    out.tile.push(...r.tile);
    out.wood.push(...r.wood);
    if (lod < 2) {
      const step = lod ? 0.9 : 0.45;
      for (let x = xa + 0.2; x < xb - 0.1; x += step) out.tile.push(antefix(x, H.eave - 0.14, H.z1 + 0.33, 0), antefix(x, H.eave - 0.14, H.z0 - 0.33, Math.PI));
    }
  }
}

// ---------------------------------------------------------------------------
// The tholoi
// ---------------------------------------------------------------------------

/** A tholos's door (toward the front) with its tufa frame, and small square windows round the drum (dark openings). */
function tholosOpenings(q, lod, seed, out) {
  const dz = q.z + q.R - q.t * 0.45;
  out.dark.push(placed(box(0.9, 2.0, 0.04, 0, 0.02, 0), q.x, 0, dz, 0));
  const lz = q.z + q.R - 0.12;
  out.tufa.push(slab(1.3, 0.22, 0.5, { bevel: 0.012, seed: seed + 1, wobble: 0.002, tone: 0.04, grime: 0.2 }).translate(q.x, 2.0, lz));
  for (const e of [-1, 1]) out.tufa.push(slab(0.22, 2.0, 0.46, { bevel: 0.012, seed: seed + 2 + e, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(q.x + e * 0.56, 0, lz));
  // Windows: small and high, round the drum (the lit ones, in the hot room, glow at night).
  for (const a of [1.15, 2.1, 4.2, 5.15]) {
    const wx = q.x + Math.sin(a) * (q.R - q.t * 0.5);
    const wz = q.z + Math.cos(a) * (q.R - q.t * 0.5);
    out.glassDark.push(placed(box(0.4, 0.45, 0.04, 0, q.h - 0.95, 0), wx, 0, wz, a));
    if (q === A && lod < 2) out.glass.push(placed(box(0.4, 0.45, 0.04, 0, q.h - 0.95, 0), wx, 0, wz, a));
  }
}

/** One tholos: its drum rising (ashlar, then stucco over a red dado), its door and windows, then its conical roof. */
function tholos(q, lod, seed, out, stage, f, sacked) {
  const c = q.h * share(stage, f, 1);
  const W = stuccoed(stage, f);
  if (c > 0) {
    (W ? out.plaster : out.ash).push(drum(q.x, q.z, q.R, q.t, c, lod, 0.92));
    if (c >= q.h - 1e-6) {
      if (W) out.red.push(revolve(profileOf([[q.R + 0.012, 0.02], [q.R + 0.012, 0.95]]), { segments: lod === 2 ? 14 : lod ? 24 : 40, metres: 1, tint: () => 1 }).translate(q.x, 0, q.z));
      tholosOpenings(q, lod, seed, out);
      // The room's dark inside seen through the door and windows (a cylinder, faces in).
      const inside = new CylinderGeometry(q.R - q.t - 0.02, q.R - q.t - 0.02, q.h - 0.1, lod ? 14 : 24, 1, true);
      inside.scale(-1, 1, 1);
      out.dark.push(tintGeometry(boxUV(inside.translate(q.x, 0.1 + (q.h - 0.1) / 2, q.z))));
    }
  }
  if (stage < 2) return;
  coneRoof(q, lod, seed, out, stage, f, sacked);
}

/** A tholos's conical roof: the cone of rafters and hoops (stage 2), then tiles climbing it from the eave (stage 3), antefixes round the eave. */
function coneRoof(q, lod, seed, out, stage, f, sacked) {
  const Re = q.R + 0.38;
  const yE = q.h + 0.02;
  const yTop = q.h + q.rise;
  const n = lod === 2 ? 8 : 14;
  const raised = stage >= 3 ? 1 : Math.min(1, f * 1.15);
  const tiled = stage >= 4 ? 1 : stage === 3 ? Math.min(1, f / 0.75) : 0;
  const burnt = sacked && q === A;
  const up = burnt ? 0.5 : tiled;
  const tileList = q === A ? out.hotTile : out.tile;
  // The rafters from the eave to the ring at the top, and the hoops that tie them; hidden under the tiles when done.
  if (stage < 4 || burnt) {
    const nr = Math.max(1, Math.round(n * raised));
    for (let i = 0; i < nr; i++) {
      const a = (i / n) * Math.PI * 2;
      out.wood.push(staff([q.x + Math.sin(a) * (Re + 0.1), yE - 0.18, q.z + Math.cos(a) * (Re + 0.1)], [q.x + Math.sin(a) * q.top, yTop - 0.05, q.z + Math.cos(a) * q.top], 0.055, 4));
    }
    if (raised > 0.5 && lod < 2) {
      for (const u of [0.3, 0.62]) out.wood.push(...hoop(q.x, q.z, q.top + (Re - q.top) * (1 - u) ** 1.25, yE + q.rise * u + 0.02, lod ? 10 : 16));
    }
    out.wood.push(...hoop(q.x, q.z, Re - 0.1, yE - 0.1, lod ? 12 : 20));
  }
  if (up <= 0) return;
  const steps = lod === 2 ? 4 : 9;
  const outer = [];
  for (let k = 0; k <= steps; k++) {
    const u = (k / steps) * up;
    outer.push([q.top + (Re - q.top) * (1 - u) ** 1.25, yE + q.rise * u]);
  }
  // (A shell 6 cm thick: the underside walked back down.)
  const inner = outer.slice().reverse().map(([r, y]) => [Math.max(0.01, r - 0.04), y - 0.06]);
  const ribs = lod === 0 ? 30 : 0;
  tileList.push(revolve(profileOf([...outer, { sharp: true }, ...inner]), {
    segments: lod === 2 ? 16 : lod ? 24 : 48,
    metres: 1,
    // (The imbrices' ribs, a hair of relief round the cone.)
    deform: ribs ? (p, th) => { const k = 1 + 0.012 * Math.sin(th * ribs); p.x *= k; p.z *= k; } : null,
    tint: (p) => 0.85 + 0.15 * Math.min(1, Math.max(0, (p.y - yE) / q.rise)),
  }).translate(q.x, 0, q.z));
  if (lod < 2) {
    const m = lod ? 14 : 30;
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2;
      tileList.push(antefix(q.x + Math.sin(a) * (Re - 0.02), yE - 0.08, q.z + Math.cos(a) * (Re - 0.02), a));
    }
  }
  if (up < 1) return;
  if (q === A) {
    // A clay chimney pot at the top for the hot room's steam.
    tileList.push(pot(q.x, q.z, q.top, yTop - 0.05, yTop + 0.32, 0.06, lod));
  } else {
    // The laconicum's smoke hole: a ring of tile round it, a bronze disc over it on three short posts.
    tileList.push(pot(q.x, q.z, q.top, yTop - 0.05, yTop + 0.16, 0.06, lod));
    if (lod < 2) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const px = q.x + Math.sin(a) * (q.top + 0.02);
        const pz = q.z + Math.cos(a) * (q.top + 0.02);
        out.bronze.push(staff([px, yTop + 0.14, pz], [px, yTop + 0.42, pz], 0.018, 4));
      }
      out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(q.top + 0.18, q.top + 0.18, 0.035, lod ? 10 : 18, 1).translate(q.x, yTop + 0.44, q.z)), () => 0.8));
    }
  }
  void seed;
}

/** The tops of the cones (smoke and steam rise from them) and of the flue: where the plumes stand. */
function ventAt(k) {
  if (k === 0) return [A.x, A.h + A.rise + 0.4, A.z];
  if (k === 1) return [B.x, B.h + B.rise + 0.6, B.z];
  return [FLUE.x, FLUE.top + 0.1, FLUE.z];
}

// ---------------------------------------------------------------------------
// The furnace yard
// ---------------------------------------------------------------------------

/** The flue's foot (beside the hot tholos's back wall, between the boilers), its top, its radius. */
const FLUE = Object.freeze({ x: 2.1, z: -6.3, top: 4.9, r: 0.13 });
/** The boilers on the base: their places (x, z). */
const BOILERS = Object.freeze([[1.3, -6.9], [2.9, -6.9]]);

/** The service yard: its walls, the cistern with its pipe, the praefurnium's base with the boilers and the flue, the woodstore's shed. */
function yard(lod, seed, out, stage, f) {
  const k = share(stage, f, 1);
  if (k <= 0) return;
  const W = skinOf(out, stage, f);
  const c = Y.h * Math.min(1, k * 1.5);
  const zc = (Y.z0 + Y.z1) / 2;
  wallAt(W, 19.6, Y.h, 0.4, 0, Y.z0, Math.PI, [], c, lod);
  wallAt(W, Y.z1 - Y.z0 - 0.4, Y.h, 0.35, 9.8, zc, Math.PI / 2, [{ x: 1.0, w: 1.6, h: 2.0 }], c, lod);
  wallAt(W, Y.z1 - Y.z0 - 0.4, Y.h, 0.35, -9.8, zc, -Math.PI / 2, [], c, lod);
  out.earth.push(box(19.0, 0.025, Y.z1 - Y.z0 - 0.4, 0, 0, zc, 0.72));
  // The cistern: a tufa tank, its walls going up with the others, its water open on top while the pipes run.
  const Q = T.cistern;
  const ch = Q.h * Math.min(1, k * 1.3);
  const cx = (Q.x0 + Q.x1) / 2;
  const cz = (Q.z0 + Q.z1) / 2;
  for (const [w, d, x, z] of [[Q.x1 - Q.x0, 0.35, cx, Q.z1 - 0.175], [Q.x1 - Q.x0, 0.35, cx, Q.z0 + 0.175], [0.35, Q.z1 - Q.z0 - 0.7, Q.x0 + 0.175, cz], [0.35, Q.z1 - Q.z0 - 0.7, Q.x1 - 0.175, cz]]) out.ash.push(box(w, ch, d, x, 0, z, 0.9));
  if (lod < 2) for (const x of [Q.x0 + 0.9, Q.x1 - 0.9]) out.ash.push(box(0.4, ch * 0.85, 0.28, x, 0, Q.z1 + 0.13, 0.82));
  // The praefurnium's base: rubble masonry, its stoke hole facing the yard.
  const bh = BASE.h * Math.min(1, k * 1.4);
  out.core.push(box(BASE.x1 - BASE.x0, bh, BASE.z1 - BASE.z0, (BASE.x0 + BASE.x1) / 2, 0, (BASE.z0 + BASE.z1) / 2, 0.9));
  if (stage < 2) return;
  out.terrace.push(slab(Q.x1 - Q.x0 + 0.1, 0.08, Q.z1 - Q.z0 + 0.1, { bevel: 0.01, seed, wobble: 0, tone: 0.02, grime: 0.3 }).translate(cx, Q.h, cz));
  out.blue.push(box(Q.x1 - Q.x0 - 0.7, 0.02, Q.z1 - Q.z0 - 0.7, cx, Q.h - 0.5, cz, 0.6));
  out.cisternWater.push(box(Q.x1 - Q.x0 - 0.7, 0.01, Q.z1 - Q.z0 - 0.7, cx, Q.h - 0.12, cz));
  // The aqueduct's channel arriving at the back on its piers, and a lead pipe from the tank to the boilers.
  out.terrace.push(box(0.5, 0.35, 0.5, Q.x0 + 0.6, Q.h - 0.35, Y.z0 + 0.15, 0.85));
  if (lod < 2) out.lead.push(tube([[Q.x1, 0.5, cz], [-3.0, 0.45, -7.7], [BOILERS[0][0] - 0.4, 1.2, BOILERS[0][1]]], 0.06, { radial: 6, segments: 10 }));
  if (stage < 3) return;
  // The stoke hole: a low arch in the base's face toward the yard, its tufa lintel; the boilers on the base; the flue beside.
  const mx = (BASE.x0 + BASE.x1) / 2;
  out.dark.push(box(0.72, 0.6, 0.03, mx, 0.0, BASE.z0 + 0.005, 1));
  out.ash.push(slab(1.0, 0.16, 0.3, { bevel: 0.01, seed: seed + 4, wobble: 0, tone: 0.03, grime: 0.3 }).translate(mx, 0.6, BASE.z0 - 0.05));
  const boiler = revolve(profileOf([[0, 0], [0.32, 0], [0.34, 0.04], [0.34, 0.7], [0.36, 0.74], [0.28, 0.82], [0.13, 0.88], [0.04, 0.9], [0.05, 0.96], [0, 0.96]]), { segments: lod === 2 ? 8 : lod ? 12 : 22, metres: 0.3, tint: (p) => 0.55 + 0.45 * Math.min(1, p.y / 0.7) });
  for (const [bx, bz] of BOILERS) out.bronze.push(boiler.clone().scale(1.25, 1.25, 1.25).translate(bx, BASE.h, bz));
  // The flue: a stack of clay pipes with collars, up beside the hot room's wall.
  const seg = lod ? 6 : 10;
  const n = lod === 2 ? 2 : 5;
  const yy = (FLUE.top - BASE.h) / n;
  for (let i = 0; i < n; i++) {
    out.clay.push(tintGeometry(boxUV(new CylinderGeometry(FLUE.r, FLUE.r * 1.02, yy, seg, 1).translate(FLUE.x, BASE.h + yy * (i + 0.5), FLUE.z)), () => 0.85 + 0.1 * (i % 2)));
    if (lod < 2) out.clay.push(tintGeometry(boxUV(new CylinderGeometry(FLUE.r * 1.35, FLUE.r * 1.35, 0.07, seg, 1).translate(FLUE.x, BASE.h + yy * i + 0.04, FLUE.z)), () => 0.8));
  }
  out.clay.push(tintGeometry(boxUV(new CylinderGeometry(FLUE.r * 1.5, FLUE.r * 1.1, 0.16, seg, 1).translate(FLUE.x, FLUE.top + 0.05, FLUE.z)), () => 0.8));
  // The woodstore's shed against the back wall of the east yard (its logs: the store's own kit, `more`).
  const lt = leanTo({ L: 4.4, span: 1.5, topY: 2.3, eaveY: 1.9, lod, seed: seed + 3, over: 0.1 });
  for (const g of [...lt.tile, ...lt.wood]) g.translate(7.2, 0, Y.z0 + 0.3);
  out.tile.push(...lt.tile);
  out.wood.push(...lt.wood);
  for (const x of [5.2, 7.2, 9.2]) out.wood.push(box(0.12, 1.92, 0.12, x, 0, Y.z0 + 1.75, 0.7));
  // The chopping block.
  out.logs.push(tintGeometry(boxUV(new CylinderGeometry(0.22, 0.24, 0.42, lod ? 7 : 12, 1).translate(6.0, 0.21, -6.6)), () => 0.9));
}

/** The woodstore's stacks (the store's own kit: shown while the baths hold timber). */
export function buildThermaeWood({ lod = 0, seed = 671 } = {}) {
  const p = new TaggedParts('thermae-wood');
  const logs = [];
  for (const [x, w] of [[5.6, 1.3], [7.1, 1.3], [8.6, 1.2]]) logs.push(...woodpile(w, 0.95, seed + x, lod).map((g) => g.rotateY(Math.PI / 2).translate(x, 0, Y.z0 + 0.95)));
  logs.push(...woodpile(1.1, 0.5, seed + 9, lod).map((g) => g.translate(4.9, 0, -8.2)));
  p.add('firewood', ruralMaterials().bark, logs);
  return p.build();
}

// ---------------------------------------------------------------------------
// The natatio
// ---------------------------------------------------------------------------

/** The natatio: its walls (the camera sees their outer faces), the tufa rim, the blue inside, its water. */
function natatio(lod, seed, out, stage, f, ice, finished) {
  const { x0, x1, z0, z1, rim, water } = P;
  const t = 0.3;
  if (stage === 0) return;
  const k = stage >= 2 ? 1 : share(stage, f, 1);
  const W = skinOf(out, stage, f);
  const h = (rim - 0.08) * k;
  for (const s of [-1, 1]) {
    W.push(box(x1 - x0, h, t, (x0 + x1) / 2, 0, s < 0 ? z0 + t / 2 : z1 - t / 2, 0.93));
    W.push(box(t, h, z1 - z0 - 2 * t, s < 0 ? x0 + t / 2 : x1 - t / 2, 0, (z0 + z1) / 2, 0.93));
  }
  if (stage < 2 || share(stage, f, 2) < 0.4) return;
  for (const s of [-1, 1]) {
    out.ash.push(slab(x1 - x0 + 0.08, 0.08, t + 0.1, { bevel: 0.012, seed: seed + s, wobble: 0.002, tone: 0.03, grime: 0 }).translate((x0 + x1) / 2, rim - 0.08, s < 0 ? z0 + t / 2 : z1 - t / 2));
    out.ash.push(slab(t + 0.1, 0.08, z1 - z0 - 2 * t, { bevel: 0.012, seed: seed + 3 + s, wobble: 0.002, tone: 0.03, grime: 0 }).translate(s < 0 ? x0 + t / 2 : x1 - t / 2, rim - 0.08, (z0 + z1) / 2));
  }
  const ix0 = x0 + t;
  const ix1 = x1 - t;
  const iz0 = z0 + t;
  const iz1 = z1 - t;
  out.blue.push(box(ix1 - ix0, 0.04, iz1 - iz0, (ix0 + ix1) / 2, 0, (iz0 + iz1) / 2, (x, y, z) => 0.8 + 0.2 * Math.cos(x * 2.1) * Math.cos(z * 1.7)));
  for (const s of [-1, 1]) {
    out.blue.push(box(ix1 - ix0, rim - 0.12, 0.01, (ix0 + ix1) / 2, 0.04, s < 0 ? iz0 + 0.005 : iz1 - 0.005, 0.85));
    out.blue.push(box(0.01, rim - 0.12, iz1 - iz0, s < 0 ? ix0 + 0.005 : ix1 - 0.005, 0.04, (iz0 + iz1) / 2, 0.85));
  }
  // Steps down into it at each end, inside.
  for (const s of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const hh = ((j + 1) * (rim - 0.1)) / 3;
      out.ash.push(slab(0.3, hh, 1.2, { bevel: 0.012, seed: seed + 10 + j + s * 5, wobble: 0.002, tone: 0.03, grime: 0.2 }).translate(s < 0 ? ix0 + 0.15 + (2 - j) * 0.3 : ix1 - 0.15 - (2 - j) * 0.3, 0.04, (iz0 + iz1) / 2));
    }
  }
  if (!finished) return;
  // The water over the whole inside (ice in a hard frost); dry: leaves on the floor and a stain at the old line.
  const surf = box(ix1 - ix0, 0.01, iz1 - iz0, (ix0 + ix1) / 2, water - 0.01, (iz0 + iz1) / 2);
  (ice ? out.ice : out.water).push(surf);
  out.stain.push(box(ix1 - ix0 - 0.04, 0.6, 0.008, (ix0 + ix1) / 2, 0.06, iz0 + 0.012), box(0.008, 0.6, iz1 - iz0 - 0.04, ix1 - 0.012, 0.06, (iz0 + iz1) / 2));
  const rnd = (j) => ((Math.sin(j * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1;
  for (let j = 0; j < (lod === 2 ? 0 : lod ? 14 : 44); j++) {
    const l = new BoxGeometry(0.08, 0.006, 0.05);
    l.rotateY(rnd(j) * 6);
    l.translate(ix0 + 0.1 + rnd(j + 50) * (ix1 - ix0 - 0.2), 0.045, iz0 + 0.1 + rnd(j + 90) * (iz1 - iz0 - 0.2));
    out.leaves.push(tintGeometry(boxUV(l), () => (j % 3 ? [0.32, 0.2, 0.08] : [0.22, 0.17, 0.08])));
  }
  // Two bronze spouts on the back wall feeding it, their water running while the baths work.
  for (const x of [3.8, 7.0]) {
    const head = new SphereGeometry(0.1, lod ? 8 : 14, lod ? 6 : 10);
    head.scale(1, 0.9, 0.8);
    head.translate(x, rim + 0.12, z0 + 0.08);
    out.bronze.push(tintGeometry(boxUV(head), () => 0.75));
    out.ash.push(slab(0.32, rim + 0.04, 0.2, { bevel: 0.01, seed: seed + x, wobble: 0, tone: 0.03, grime: 0.3 }).translate(x, 0, z0 - 0.06));
    if (!ice) {
      const pts = [new Vector3(x, rim + 0.08, z0 + 0.16), new Vector3(x, rim + 0.04, z0 + 0.26), new Vector3(x, rim - 0.02, z0 + 0.34), new Vector3(x, water, z0 + 0.42)];
      out.stream.push(tube(pts, 0.03, { radial: lod ? 6 : 10, segments: lod ? 6 : 12, around: 0.2 }));
    }
  }
}

// ---------------------------------------------------------------------------
// The street wall and the gate
// ---------------------------------------------------------------------------

/** The lanterns on the gate's piers, facing the street (x, y, z). */
const GATE_LAMPS = Object.freeze([[0.55, 2.4, 9.6], [2.55, 2.4, 9.6]]);

/** The street wall: high before the court, low before the pool, the gate between two piers with its timber lintel and open leaves. */
function streetWall(lod, seed, out, stage, f) {
  const k = share(stage, f, 3);
  if (k <= 0) return;
  const W = skinOf(out, stage, f);
  const c = PAL.h * Math.min(1, k * 2.2);
  const z = PAL.street;
  const pierX = [G.x0 - 0.25, G.x1 + 0.25];
  const wx0 = PAL.west;
  const wx1 = pierX[0] - 0.25;
  wallAt(W, wx1 - wx0, PAL.h, 0.4, (wx0 + wx1) / 2, z, 0, [], c, lod);
  const lx0 = pierX[1] + 0.25;
  wallAt(W, PAL.street - lx0, G.low, 0.4, (lx0 + PAL.street) / 2, z, 0, [], Math.min(c, G.low), lod);
  for (const x of pierX) W.push(box(0.5, 2.4 * Math.min(1, k * 2.2), 0.5, x, 0, z - 0.2, 0.92));
  if (stuccoed(stage, f) && k >= 0.6) {
    out.red.push(box(wx1 - wx0, 0.95, 0.012, (wx0 + wx1) / 2, 0.02, z + 0.006, 1));
    out.red.push(box(PAL.street - lx0, 0.95, 0.012, (lx0 + PAL.street) / 2, 0.02, z + 0.006, 1));
  }
  if (stage < 4 && k < 0.85) return;
  // The gate: a timber lintel between the piers' tops, its leaves swung back inside.
  out.wood.push(box(G.x1 - G.x0 + 0.4, 0.22, 0.32, (G.x0 + G.x1) / 2, 2.2, z - 0.2, 0.85));
  for (const [hx, e] of [[G.x0, 1], [G.x1, -1]]) {
    const leaf = placed(box(0.7, 2.1, 0.06, e * 0.35, 0.02, 0, 0.85), 0, 0, 0, e * 1.2);
    out.wood.push(placed(leaf, hx, 0, z - 0.3, 0));
  }
  for (const x of pierX) out.ash.push(slab(0.62, 0.12, 0.62, { bevel: 0.012, seed: seed + x, wobble: 0, tone: 0.03, grime: 0.2 }).translate(x, 2.4, z - 0.2));
}

/** The low wall along the track's east edge. */
function trackWall(lod, seed, out, stage, f) {
  const k = share(stage, f, 3);
  if (k <= 0) return;
  const tk = PAL.track;
  wallAt(skinOf(out, stage, f), tk.z1 - tk.z0, 0.9, 0.3, 9.85, (tk.z0 + tk.z1) / 2, Math.PI / 2, [], 0.9 * Math.min(1, k * 2.2), lod);
}

// ---------------------------------------------------------------------------
// The palaestra
// ---------------------------------------------------------------------------

/** The colonnade's columns: west (x = colW), north (z = colN) and street (z = colS) lines, about 2 m apart; the corners shared. */
function columnSpots() {
  const spots = [];
  const along = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  for (const z of along(PAL.colN, PAL.colS, 4)) spots.push([PAL.colW, z]);
  for (const x of along(PAL.colW, PAL.east, 5).slice(1)) spots.push([x, PAL.colN]);
  for (const x of along(PAL.colW, PAL.east, 5).slice(1)) spots.push([x, PAL.colS]);
  return spots;
}

/** The palaestra: its west wall, the three colonnades' columns rising one by one, the beams and lean-to roofs, benches, a basin. */
function palaestra(lod, seed, out, stage, f, sacked) {
  const k = share(stage, f, 3);
  if (k <= 0) return;
  const W = skinOf(out, stage, f);
  const c = PAL.h * Math.min(1, k * 2.2);
  const z0 = H.z1 + 0.05;
  const z1 = PAL.street - 0.25;
  const len = z1 - z0;
  const zc = (z0 + z1) / 2;
  wallAt(W, len, PAL.h, 0.35, PAL.west, zc, -Math.PI / 2, [], c, lod);
  // (The wall's inner face, toward the court, painted red to the height of a man.)
  if (c > 1 && stuccoed(stage, f)) out.red.push(box(0.012, 0.95, len - 0.1, PAL.west + 0.356, 0.12, zc, 1));
  // The columns, rising one by one (the first third of the stage's second half), the portico floor.
  const spots = columnSpots();
  const colH = PAL.eave - 0.24 - 0.12;
  const shown = stage >= 4 ? spots.length : Math.round(spots.length * Math.min(1, Math.max(0, (k - 0.25) * 1.6)));
  if (shown > 0) {
    out.floor.push(box(PAL.colW + 0.2 - PAL.west - 0.35, 0.12, len, (PAL.west + 0.35 + PAL.colW + 0.2) / 2, 0, zc, 0.95));
    out.floor.push(box(PAL.east + 0.2 - PAL.colW - 0.2, 0.12, PAL.colN + 0.2 - z0, (PAL.colW + 0.2 + PAL.east + 0.2) / 2, 0, (z0 + PAL.colN + 0.2) / 2, 0.95));
    out.floor.push(box(PAL.east + 0.2 - PAL.colW - 0.2, 0.12, z1 - PAL.colS + 0.2, (PAL.colW + 0.2 + PAL.east + 0.2) / 2, 0, (PAL.colS - 0.2 + z1) / 2, 0.95));
  }
  const fallen = sacked ? [2, 6] : [];
  for (let j = 0; j < shown; j++) {
    const [x, z] = spots[j];
    if (fallen.includes(j)) {
      out.cols.push(...fallenColumn(x + 0.8, z + 0.3, 1.2, 0.15, 3, 0.7, seed + j, lod));
      out.ash.push(slab(0.36, 0.06, 0.36, { bevel: 0.01, seed: seed + j, wobble: 0, tone: 0, grime: 0.4 }).translate(x, 0.12, z));
      continue;
    }
    for (const g of tuscanColumn(0.15, colH, lod)) out.cols.push(g.translate(x, 0.12, z));
  }
  if (stage < 4 && k < 0.85) return;
  // The architrave of timber along the three lines, then the lean-to roofs from it to the walls, and antefixes along their eaves.
  const by = PAL.eave - 0.24;
  out.wood.push(box(0.22, 0.24, PAL.colS - PAL.colN, PAL.colW, by, (PAL.colN + PAL.colS) / 2, 0.85));
  for (const zz of [PAL.colN, PAL.colS]) out.wood.push(box(PAL.east - PAL.colW, 0.24, 0.22, (PAL.colW + PAL.east) / 2, by, zz, 0.85));
  const xe = PAL.colW + 0.2;
  const xi = PAL.west + 0.35;
  const top = PAL.h + 0.02;
  const zn = H.z1 - 0.05;
  const ys = PAL.colN + 0.2;
  const yf = PAL.colS - 0.2;
  const roofs = [
    // West: along the wall, from the whole length (its ends under the north and street roofs' ends).
    [[xe, PAL.eave, z1], [xe, PAL.eave, zn], [xi, top, zn], [xi, top, z1]],
    // North: against the hall's court wall.
    [[xe, PAL.eave, ys], [PAL.east + 0.2, PAL.eave, ys], [PAL.east + 0.2, top, zn], [xe, top, zn]],
    // Street: against the street wall.
    [[PAL.east + 0.2, PAL.eave, yf], [xe, PAL.eave, yf], [xe, top, z1], [PAL.east + 0.2, top, z1]],
  ];
  roofs.forEach((q, i) => {
    // (Sacked: the north slope burnt through, its rafters bare.)
    if (sacked && i === 1) {
      for (let j = 0; j < 6; j++) out.wood.push(staff([xe + 0.3 + j * 1.3, PAL.eave, ys], [xe + 0.3 + j * 1.3, top, zn], 0.045, 4));
      return;
    }
    const r = roofSlope(q, { lod, seed: seed + 9 + i });
    out.tile.push(...r.tile);
    out.wood.push(...r.wood);
  });
  if (lod < 2) {
    for (let z = zn + 0.3; z < z1; z += 0.5) out.tile.push(antefix(xe, PAL.eave - 0.06, z, Math.PI / 2));
    for (let x = xe + 0.3; x < PAL.east + 0.2; x += 0.5) out.tile.push(antefix(x, PAL.eave - 0.06, ys, 0), antefix(x, PAL.eave - 0.06, yf, Math.PI));
  }
  // Benches along the wall under the west portico, and a stone basin (a louterion) in the court.
  const legs = SEAT_H - 0.06;
  for (const z of [3.0, 5.8]) {
    out.ash.push(slab(0.42, 0.07, 1.4, { bevel: 0.01, seed: seed + z * 3, wobble: 0, tone: 0.03, grime: 0 }).translate(PAL.west + 0.62, 0.12 + legs, z));
    for (const e of [-0.5, 0.5]) out.ash.push(box(0.34, legs, 0.12, PAL.west + 0.62, 0.12, z + e, 0.75));
  }
  const lb = revolve(profileOf([[0, 0], [0.22, 0], [0.22, 0.06], [0.12, 0.12], [0.1, 0.6], [0.16, 0.68], [0.5, 0.78], [0.56, 0.86], [0.54, 0.88], [0.46, 0.84], [0.0, 0.76]]), { segments: lod === 2 ? 10 : lod ? 18 : 32, metres: 0.6 });
  out.marble.push(tintGeometry(lb.translate(-5.9, 0.035, 6.2), (px, py) => 0.85 + 0.15 * Math.min(1, py / 0.8)));
  out.labrumWater.push(tintGeometry(boxUV(new CylinderGeometry(0.46, 0.46, 0.01, lod ? 12 : 24, 1).translate(-5.9, 0.86, 6.2))));
}

/** The palaestra's statues: a Hermes on a tufa base, a bronze athlete scraping off the oil (the Apoxyomenos's kind), finished. */
function statues(lod, out) {
  const s = statue(-6.3, 2.8, 0.5, { y0: 0.05, h: 1.0, kind: 'nude', lod, scale: 0.9, base: 0.7 });
  out.ash.push(...s.base);
  out.statue_marble.push(...s.statue);
  out.ash.push(slab(0.62, 0.9, 0.62, { bevel: 0.015, seed: 5, wobble: 0.002, tone: 0.04, grime: 0.4 }).translate(-0.9, 0.035, 6.6));
  const b = statue(-0.9, 6.6, -0.6, { y0: 0.935, h: 1.0, kind: 'nude', lod, scale: 0.9, base: 0.0 });
  out.statueBronze.push(...b.statue);
}

// ---------------------------------------------------------------------------
// A sacked baths
// ---------------------------------------------------------------------------

/** What raiders leave: rubble at the gate and the doors, soot up the walls, the statues thrown down. */
function sackedParts(lod, seed, out) {
  const heaps = [[1.5, 8.6, 0.9, 24], [-5.0, 0.6, 1.1, 28], [2.1, -0.4, 1.2, 26], [-3.0, 6.4, 1.0, 22], [8.4, 6.5, 0.8, 16], [4.8, 3.0, 1.3, 30], [-4.0, -8.0, 1.0, 20], [6.5, -0.7, 0.9, 16]];
  heaps.forEach(([x, z, r, n], i) => (i % 2 ? out.ash : out.rubble).push(...rubbleHeap(x, z, r, n, seed + x * 7 + z, lod)));
  // Soot over the gate, the hall's door and the hot room's door, and up the west wall.
  for (const [x, z, ry, w, h] of [[1.55, PAL.street + 0.01, 0, 1.8, 3.2], [-5.0, H.z1 + 0.01, 0, 1.6, 3.4], [A.x, A.z + A.R + 0.02, 0, 1.6, 3.0], [PAL.west + 0.37, 3.5, Math.PI / 2, 2.2, 2.8]]) out.soot.push(scorch(x, 0.2, z, ry, w, h), scorch(x, 0.2, z + 0.002 * Math.cos(ry), ry, w * 0.6, h * 1.2));
  // A statue's broken pieces before its empty base.
  out.marble.push(...fallenColumn(-5.6, 3.0, 0.6, 0.12, 2, 0.5, seed + 3, lod));
}

// ---------------------------------------------------------------------------
// The site's dressing
// ---------------------------------------------------------------------------

/**
 * The site's dressing at stage `stage` with `f` of it done (models/
 * worksite.js draws it): scaffolds where the walls rise, the cranes, the
 * stacks of the stage's goods, and the crew (people/actors.js specs) at
 * work on it. No centering: the roofs are timber, raised on trusses and
 * rafters, not on arches. Scaffold heights are from this model's own
 * measures.
 */
export function thermaeSite(stage, f, work = false) {
  const site = { scaffolds: [], cranes: [], centering: [], piles: [], crew: [] };
  if (stage >= THERMAE_STAGES) return site;
  const S = site;
  const wallH = (h) => Math.max(1.4, Math.min(h, h * f + 1.0));
  const hallZ = (H.z0 + H.z1) / 2;
  if (stage === 0) {
    S.piles.push({ x: -2.4, z: 3.0, ry: 0.2, good: 'clay', n: 3 }, { x: 8.2, z: -0.4, ry: -0.3, good: 'timber', n: 2 }, { x: -7.0, z: 3.4, ry: 0.1, good: 'clay', n: 2 });
    S.cranes.push({ x: 1.6, z: 1.6, ry: -2.4, h: 4.5, kind: 'shear' });
  }
  if (stage === 1) {
    // Scaffolds along the hall's court wall and round the tholoi's fronts, the crane lifting ashlar.
    S.scaffolds.push({ x: -4.95, z: H.z1 + 0.6, w: 8.4, d: 0.9, h: wallH(H.eave), ry: 0 });
    S.scaffolds.push({ x: A.x, z: A.z + A.R + 0.55, w: 3.4, d: 0.9, h: wallH(A.h), ry: 0 });
    S.scaffolds.push({ x: B.x, z: B.z + B.R + 0.55, w: 3.0, d: 0.9, h: wallH(B.h), ry: 0 });
    S.cranes.push({ x: 1.4, z: 3.2, ry: -2.2, h: 7.0, kind: 'treadwheel' });
    S.piles.push({ x: -2.6, z: 4.2, ry: 0.1, good: 'stone', n: 4 }, { x: 6.8, z: 1.4, ry: -0.2, good: 'clay', n: 2 }, { x: -7.2, z: 3.2, ry: 0.4, good: 'timber', n: 2 });
  }
  if (stage === 2) {
    // The hall's trusses going up, the cones on the tholoi, the crane hoisting beams.
    S.scaffolds.push({ x: -4.95, z: H.z1 + 0.6, w: 8.4, d: 0.9, h: H.eave + 0.6, ry: 0 });
    S.scaffolds.push({ x: A.x, z: A.z + A.R + 0.55, w: 3.4, d: 0.9, h: A.h + 0.6, ry: 0 });
    S.scaffolds.push({ x: B.x, z: B.z + B.R + 0.55, w: 3.0, d: 0.9, h: B.h + 0.6, ry: 0 });
    S.cranes.push({ x: 1.4, z: 3.2, ry: -2.0, h: 9.0, kind: 'treadwheel' });
    S.piles.push({ x: -2.8, z: 4.4, ry: 0.15, good: 'timber', n: 4 }, { x: 6.8, z: 1.6, ry: -0.1, good: 'timber', n: 2 }, { x: -7.2, z: 3.0, ry: 0.3, good: 'stone', n: 2 });
  }
  if (stage === 3) {
    // The block roofed; scaffolds at the tholoi's eaves and the colonnade going up, the shear legs over the gate.
    S.scaffolds.push({ x: A.x, z: A.z + A.R + 0.55, w: 3.4, d: 0.9, h: A.h + 0.5, ry: 0 });
    S.scaffolds.push({ x: PAL.colW - 0.7, z: 4.4, w: 6.0, d: 0.8, h: PAL.h + 0.3, ry: Math.PI / 2 });
    S.cranes.push({ x: 1.5, z: 5.2, ry: 0.6, h: 5.0, kind: 'shear' });
    S.piles.push({ x: -3.0, z: 3.4, ry: 0.05, good: 'clay', n: 2 }, { x: 6.8, z: 1.5, ry: 0.2, good: 'marble', n: 1 }, { x: -3.2, z: 5.6, ry: -0.2, good: 'stone', n: 1 });
  }
  void hallZ;
  for (const c of S.cranes) c.work = work;
  S.crew = siteCrew(stage, f);
  return site;
}

/** The builders at a stage (people/actors.js specs): carrying, hammering, mixing, hauling, the foreman. */
function siteCrew(stage, f) {
  const tun = [DYES.undyed, DYES.oatmeal, DYES.fawn, DYES.brownWool, DYES.ochre, DYES.madder];
  const man = (i, clip, at, ry, extra = {}) => ({ body: 'm', dress: ['tunic:short'], hair: i % 3 ? 'crop' : 'curls', clip, at, ry, seed: 700 + stage * 20 + i, colours: { tunic: tun[i % tun.length] }, ...extra });
  const list = [];
  // The foreman with his tablet by the plan, everywhere.
  list.push(man(0, 'read', [-1.6, 0.03, 7.2], 2.6, { dress: ['tunic:knee'], props: { L: 'tablet' } }));
  if (stage === 0) {
    list.push(man(1, 'hoe', [-2.0, 0.03, -2.9], 0.3, { props: { R: 'hoe' } }), man(2, 'hoe', [5.0, 0.03, 7.0], -2.4, { props: { R: 'hoe' } }));
    list.push(man(3, 'carry', [-3.4, 0.03, 3.6], 1.8, { props: { L: 'sack' }, route: { length: 4.0, speed: 0.8, pauseEnd: 3, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } }));
    list.push(man(4, 'hammer', [1.2, 0.03, -7.6], 0, { props: { R: 'hammer' } }));
  } else if (stage === 1) {
    list.push(man(1, 'hammer', [-6.6, 0.03, 1.6], Math.PI, { props: { R: 'chisel' } }));
    list.push(man(2, 'carry', [-3.0, 0.03, 5.6], Math.PI * 0.85, { props: { L: 'sack' }, route: { length: 3.6, speed: 0.75, pauseEnd: 3, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } }));
    list.push(man(3, 'stir', [4.6, 0.03, 1.6], -1.6, {}));
    list.push(man(4, 'pump', [2.8, 0.03, 3.4], -2.2, {}));
  } else if (stage === 2) {
    list.push(man(1, 'hammer', [-6.0, 0.03, 1.4], Math.PI, { props: { R: 'hammer' } }));
    list.push(man(2, 'carry', [-3.0, 0.03, 5.8], Math.PI, { props: { L: 'sack' }, route: { length: 3.8, speed: 0.75, pauseEnd: 3, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } }));
    list.push(man(3, 'pump', [2.4, 0.03, 3.4], -2.0, {}));
    list.push(man(4, 'hammer', [5.2, 0.03, 1.2], 1.4, { props: { R: 'hammer' } }));
  } else {
    list.push(man(1, 'hammer', [-8.0, 0.03, 3.0], Math.PI / 2, { props: { R: 'hammer' } }), man(2, 'hammer', [3.4, 0.03, 1.0], -Math.PI / 2, { props: { R: 'chisel' } }));
    list.push(man(3, 'carry', [-3.2, 0.03, 5.4], Math.PI, { props: { L: 'sack' }, route: { length: 3.4, speed: 0.75, pauseEnd: 3, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } }));
    list.push(man(4, 'sweep', [-2.4, 0.03, 3.0], 0.8, { props: { R: 'broom' } }));
  }
  return list;
}

// ---------------------------------------------------------------------------
// The people
// ---------------------------------------------------------------------------

/**
 * The baths' people (people/actors.js specs, its metres) in their state:
 *   'open'   working: bathers in the natatio to the waist (not in a hard
 *            frost: its water is ice), one on its rim, a pair talking on
 *            the walk; in the palaestra ball players at trigon, a man with
 *            his lead weights (halteres), a runner on the track, bathers
 *            resting on the benches, the oil seller at his table; the
 *            stoker at the stoke hole, the doorkeeper at the gate
 *   'cold'   staffed but no timber: the stoker idle by his empty store, the
 *            doorkeeper, nobody bathing
 *   'shut'   nobody
 */
export function thermaeActors(state, ice = false) {
  if (state !== 'open' && state !== 'cold') return [];
  const bare = (skin, extra = {}) => ({ body: 'm', dress: ['limus'], colours: { tunic: DYES.white, trim: DYES.white, skin }, ...extra });
  const list = [];
  const sand = 0.035;
  const stoker = { body: 'm', dress: ['tunic:short'], hair: 'crop', colours: { tunic: DYES.brownWool, skin: 0x75492f }, seed: 640 };
  const door = { body: 'm', dress: ['tunic:knee'], hair: 'curls', colours: { tunic: DYES.fawn, skin: 0x9a6a4a }, seed: 641 };
  const mx = (BASE.x0 + BASE.x1) / 2;
  if (state === 'cold') {
    list.push({ ...stoker, clip: 'idle', at: [mx + 0.9, sand, BASE.z0 - 1.0], ry: -2.2 });
    list.push({ ...door, clip: 'idle', at: [G.x0 - 0.1, 0.05, PAL.street - 0.9], ry: Math.PI + 0.2 });
    return list;
  }
  list.push({ ...stoker, clip: 'sweep', props: { R: 'broom' }, at: [mx, sand, BASE.z0 - 0.95], ry: 0 });
  list.push({ ...door, clip: 'listen', at: [G.x1 + 0.2, 0.05, PAL.street - 1.0], ry: Math.PI - 0.3 });
  // The natatio: bathers to the waist (their feet on its floor), one sitting on the rim, his feet in the water.
  if (!ice) {
    list.push({ ...bare(0xa87452), hair: 'crop', clip: 'idle', at: [4.4, 0.06, 7.0], ry: 0.6, seed: 610 });
    list.push({ ...bare(0xc8956c), hair: 'curls', clip: 'talk', at: [6.4, 0.06, 6.6], ry: -2.4, seed: 611 });
    list.push({ ...bare(0x8c5e40), hair: 'crop', beard: 'short', clip: 'listen', at: [5.8, 0.06, 7.4], ry: 2.3, seed: 612 });
    list.push({ ...bare(0xbf8b62), hair: 'curls', clip: 'swim', at: [3.7, 0.06, 8.2], ry: Math.PI / 2, seed: 613, route: { length: 3.6, speed: 0.55, pauseEnd: 1, pauseStart: 1, clipEnd: 'idle', clipStart: 'idle', faceEnd: -Math.PI / 2, faceStart: Math.PI / 2 } });
  }
  list.push({ ...bare(0xb88560), hair: 'curls', clip: 'sit', at: [5.4, P.rim + 0.02 - SEAT_H, P.z0 + 0.18], ry: 0, seed: 614 });
  list.push({ body: 'f', dress: ['tunic:long', 'palla'], hair: 'bun', clip: 'talk', at: [4.0, 0.06, 2.8], ry: Math.PI / 2, seed: 615, colours: { tunic: DYES.white, mantle: DYES.saffron } });
  list.push({ body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'listen', at: [4.8, 0.06, 2.8], ry: -Math.PI / 2, seed: 616, colours: { tunic: DYES.sky } });
  // The palaestra: trigon (three players passing the ball round a triangle), weights, the resting, the oil seller.
  const cx = -3.6;
  const tri = [[cx - 0.9, 4.0], [cx + 0.9, 4.0], [cx, 5.5]];
  tri.forEach(([x, z], i) => {
    const [nx, nz] = [cx - x, 4.6 - z];
    list.push({ ...bare([0xc8956c, 0xa87452, 0xd2a17a][i]), hair: i ? 'crop' : 'curls', clip: 'trigon', props: { R: 'ball' }, at: [x, sand, z], ry: Math.atan2(nx, nz), seed: 620 + i, phase: i * 0.7 });
  });
  list.push({ ...bare(0x9a6a4a), hair: 'crop', clip: 'halteres', props: { R: 'halter', L: 'halter' }, at: [-1.4, sand, 2.8], ry: -2.6, seed: 630 });
  // The runner on the track along the east side (heading +z, then back).
  list.push({ ...bare(0xdcb08c), hair: 'curls', clip: 'run', at: [9.25, sand, PAL.track.z0 + 0.2], ry: 0, seed: 632, route: { length: 8.6, speed: 2.4, pauseEnd: 2, pauseStart: 3, clipEnd: 'idle', clipStart: 'idle' } });
  // (The benches by the west wall: their tops SEAT_H over the colonnade's floor.)
  list.push({ ...bare(0xa87452), hair: 'crop', clip: 'sit', at: [PAL.west + 0.62, 0.12, 3.0], ry: Math.PI / 2, seed: 634 });
  list.push({ body: 'm', dress: ['tunic:knee'], hair: 'curls', beard: 'short', clip: 'give', props: { R: 'jar' }, at: [PAL.west + 0.75, 0.12, 5.8], ry: Math.PI / 2, seed: 637, colours: { tunic: DYES.ochre } });
  list.push({ ...bare(0xc8956c), hair: 'crop', clip: 'count', at: [PAL.colW - 0.4, 0.12, 5.8], ry: -Math.PI / 2, seed: 638 });
  return list;
}

// ---------------------------------------------------------------------------
// The build
// ---------------------------------------------------------------------------

const KEYS = ['earth', 'trench', 'flags', 'sand', 'floor', 'core', 'ash', 'plaster', 'red', 'terrace', 'marble', 'cols', 'tile', 'hotTile', 'wood', 'dark', 'clay',
  'bronze', 'lead', 'logs', 'blue', 'water', 'ice', 'stain', 'leaves', 'stream', 'labrumWater', 'cisternWater', 'glass', 'glassDark', 'coalsLit', 'coalsCold', 'charcoal',
  'rubble', 'soot', 'statueBronze', 'statue_marble'];

/**
 * Build the baths: { group, meshes, triangles }; meshes tagged in
 * userData.when. `stage` 0-3 a site (`f` of the stage done) or 4 finished;
 * `ice` a hard frost (the natatio frozen); `sacked`.
 */
export function buildThermae({ lod = 0, stage = THERMAE_STAGES, f = 1, ice = false, sacked = false, work = false, seed = 601 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  stage = Math.max(0, Math.min(THERMAE_STAGES, stage | 0));
  f = Math.max(0, Math.min(1, f));
  const done = stage >= THERMAE_STAGES;
  const out = bag(KEYS);
  // (Dressed tufa and the trim of the walls are one stone, one list.)
  out.tufa = out.ash;
  ground(lod, seed, out, stage, f);
  foundations(lod, seed + 10, out, stage, f);
  hall(lod, seed + 20, out, stage, f);
  hallRoof(lod, seed + 30, out, stage, f, sacked);
  tholos(A, lod, seed + 40, out, stage, f, sacked);
  tholos(B, lod, seed + 60, out, stage, f, sacked);
  natatio(lod, seed + 100, out, stage, f, ice, done);
  streetWall(lod, seed + 120, out, stage, f);
  trackWall(lod, seed + 130, out, stage, f);
  palaestra(lod, seed + 160, out, stage, f, sacked);
  yard(lod, seed + 180, out, stage, f);
  if (done) {
    // The stoke hole's coals (lit while the fire is in, ash and charcoal when it is out).
    const mx = (BASE.x0 + BASE.x1) / 2;
    const cl = coals(mx, 0.02, BASE.z0 - 0.15, 0.28, { seed: seed + 80, lod });
    out.coalsLit.push(...cl.hot);
    out.coalsCold.push(...cl.hot.map((g) => g.clone()));
    out.charcoal.push(...cl.dark);
  }
  if (done && !sacked) statues(lod, out);
  if (sacked) sackedParts(lod, seed + 200, out);
  const m = healthMaterials();
  if (lod === 2) {
    // Far out: small things under a pixel join the parts there are anyway, or go.
    out.ash.push(...out.floor.splice(0));
    out.lead = out.leaves = out.labrumWater = out.stream = out.charcoal = [];
    out.statue_marble.length = 0;
    out.statueBronze.length = 0;
  }
  const p = new TaggedParts('thermae');
  const small = { cast: false };
  p.add('ground', m.earth, out.earth, small);
  p.add('trench', material('trench-earth', { surface: 'earth', color: 0x8a6e4e, vertexColors: true, snow: 1 }), out.trench, small);
  p.add('flags', m.flags, out.flags, small);
  p.add('sand', material('ring-sand', { surface: 'earth', color: 0xe8d4a8, vertexColors: true, snow: 1 }), out.sand, small);
  p.add('floor', m.shelteredFloor, out.floor, small);
  p.add('core', m.core, out.core);
  // The tufa of the walls, the pool's rim and the dressings: a golden-grey volcanic stone cut in blocks.
  p.add('stone', material('tufa-ashlar', { surface: 'limestone', color: 0xdcc8a0, vertexColors: true, snow: 1 }), out.ash);
  p.add('walls', m.plaster, out.plaster);
  p.add('dado', m.red, out.red, small);
  p.add('terrace', m.signinum, out.terrace);
  p.add('marble', m.marble, out.marble);
  // The colonnade's columns: tufa under a coat of white stucco.
  p.add('columns', m.plaster, out.cols);
  p.add('roof', m.tile, [...out.tile, ...(done ? [] : out.hotTile)]);
  // The hot room's cone: its tiles melt the snow while the fire is in (the one snow:1 look, the other the warm one).
  if (done) {
    p.add('roof-hot', m.tile, out.hotTile, { when: 'cold' });
    p.add('roof-hot', material('roof-tile-warm', { surface: 'terracotta', vertexColors: true, snow: 0.12 }), out.hotTile.map((g) => g.clone()), { when: 'flow' });
  }
  p.add('wood', m.wood, out.wood);
  p.add('inside', m.dark, out.dark, small);
  p.add('flue', m.clay, out.clay);
  p.add('bronze', m.bronze, [...out.bronze, ...out.lead, ...out.statueBronze], small);
  p.add('statues', m.marble, out.statue_marble);
  p.add('firewood', ruralMaterials().bark, out.logs);
  // The pools: the painted inside, the water or ice, a dry one's leaves and stain.
  p.add('pool-paint', material('pool-blue', { surface: 'plaster', color: 0x7aa8b8, vertexColors: true, snow: 0.6 }), out.blue, small);
  if (ice) p.add('pool-water', iceMaterial(), out.ice, { when: 'full', cast: false });
  else p.add('pool-water', shallowWaterMaterial(), out.water, { when: 'full', cast: false });
  p.add('cistern-water', ice ? iceMaterial() : shallowWaterMaterial(), out.cisternWater, { when: 'full', cast: false });
  p.add('labrum-water', ice ? iceMaterial() : shallowWaterMaterial(), out.labrumWater, { when: 'full', cast: false });
  p.add('leaves', m.soil, out.leaves, { when: 'dry', cast: false });
  p.add('stain', m.stain, out.stain, { when: 'dry', cast: false });
  p.add('stream', streamMaterial(), out.stream, { when: 'flow', cast: false });
  // The windows are open squares behind timber shutters: dark by day, lit with lamplight from within while
  // the fire is in (the lanterns' horn, which the night lights); dark otherwise.
  const darkOpening = material('bath-glass-dark', { color: 0x3a3430, roughness: 0.25, snow: 0 });
  if (done) {
    // (The night's glow on the ground is the lamps' list, THERMAE_LAMPS: the game's light map, as the lanterns'.)
    p.add('window', material('bath-window-lit', { color: 0x4a3c30, roughness: 0.25, emissive: 0xff9a40, emissiveIntensity: 0.14, snow: 0 }), out.glass, { when: 'flow', cast: false });
    p.add('window', darkOpening, out.glassDark, { when: 'cold', cast: false });
  } else {
    p.add('window', darkOpening, out.glassDark, { cast: false });
  }
  if (done) p.add('coals', m.embers, out.coalsLit, { when: 'flow', cast: false });
  p.add('coals', m.ash, out.coalsCold, { when: done ? 'cold' : 'always', cast: false });
  p.add('charcoal', m.dark, out.charcoal, small);
  p.add('rubble', m.core, out.rubble);
  p.add('soot', material('soot', { color: 0x15110e, roughness: 1, opacity: 0.55, snow: 0, wet: 0 }), out.soot, small);
  if (done && !sacked && lod < 2) {
    for (const [lx, ly, lz] of GATE_LAMPS) {
      const l = lantern(lx, ly, lz, lod);
      p.add('lantern', m.bronze, [...l.bronze, staff([lx, ly + 0.3, lz], [lx, ly + 0.55, lz - 0.2], 0.012, 4)], small);
      p.add('lamp', lanternPane(), [l.pane], { when: 'flow', cast: false });
      p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'cold', cast: false });
    }
  }
  if (done && !sacked) {
    // Smoke from the flue and the cones' tops while the fire is in; in a hard frost steam from the smoke
    // holes, the hall's windows and the pool. (At every level: the program compiled with the rest.)
    const smoke = [lin(0x8a8580), lin(0x77716a)];
    const rows = lod === 2 ? 3 : lod ? 5 : 8;
    const vents = lod < 2 ? [0, 1, 2] : [2];
    p.add('smoke', steamMaterial(), vents.map((k, i) => {
      const [x, y, z] = ventAt(k);
      return plume(x, y, z, { h: 2.6, r: k === 2 ? 0.16 : 0.2, n: 3, seed: 30 + i, rows, rgb: smoke[i % 2], alpha: 0.9, lean: [-0.8, 0.45] });
    }), { when: 'flow', cast: false });
    const steam = [plume(...ventAt(1), { h: 2.4, r: 0.3, n: 3, seed: 40, rows, alpha: 1, lean: [0.5, 0.4] })];
    if (lod < 2) {
      steam.push(plume(...ventAt(0), { h: 2.2, r: 0.26, n: 3, seed: 41, rows, alpha: 0.9, lean: [0.4, 0.4] }));
      const xc = (H.x0 + H.x1) / 2;
      for (const x of [-3.3, 1.1]) steam.push(plume(xc + x, H.win + 0.4, H.z1 + 0.1, { h: 1.2, r: 0.16, n: 3, seed: 50 + x, rows, alpha: 0.7, lean: [0.2, 0.5] }));
      steam.push(plume((P.x0 + P.x1) / 2, P.water + 0.05, 7.0, { h: 0.9, r: 0.9, n: 2, seed: 60, rows, alpha: 0.45, lean: [0.3, 0.2] }));
    }
    p.add('steam', steamMaterial(), steam, { when: 'ice', cast: false });
  }
  // The site's dressing (models/worksite.js) in the site's own kit.
  if (!done) addSite(p, thermaeSite(stage, f, work), lod);
  return p.build();
}

/**
 * The baths' lights at night (x, y, z[, s, sx]: models.js modelLamps): the lanterns on the gate's
 * piers facing the street, the hall's high windows facing the court, the stoke hole facing the
 * yard; lit while the baths work.
 */
export const THERMAE_LAMPS = Object.freeze([
  ...GATE_LAMPS.map((l) => Object.freeze(l)),
  ...HALL_WINDOWS.map((x) => Object.freeze([(H.x0 + H.x1) / 2 + x, H.win + 0.3, H.z1 + 0.15, 1, 0])),
  Object.freeze([(BASE.x0 + BASE.x1) / 2, 0.6, BASE.z0 - 0.3, -1, 0]),
]);
