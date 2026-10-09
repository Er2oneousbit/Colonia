/**
 * models/thermae.js
 * ----------------------------------------------------------------------------
 * The Great Baths (Thermae), a monument on a 5 x 5 footprint (20 m), as
 * the imperial baths were laid out, in miniature, from the record:
 *
 *   - The Baths of Caracalla (AD 212-216) and of Diocletian (AD 298-306):
 *     one axis through the bath block, the cold swimming pool (natatio)
 *     open to the sky at one end, then the frigidarium, its great hall
 *     under three cross (groin) vaults lit by half-round "thermal" windows
 *     split by two mullions, then the small tepidarium, then the caldarium
 *     standing out from the block on the sun side, round, domed, its drum
 *     cut by tall windows to take the afternoon sun (Seneca, Letters 86, on
 *     the new baths' great windows against the old dark ones); a palaestra
 *     on either side of the block, an exercise court with its colonnades.
 *   - The Stabian and Forum Baths at Pompeii: the furnace (praefurnium)
 *     between the hot rooms, fed from a service yard with its woodstore;
 *     the floors raised on stacks of brick (pilae: the hypocaust) for the
 *     heat to run under them, and up the walls in box flue tiles to vents.
 *   - Frontinus and the great baths' own reservoirs: a cistern fed by the
 *     aqueduct behind the block, its water piped to the pools.
 *   - Vitruvius 5.10 (the hot rooms toward the winter sunset; the vaults of
 *     concrete rendered), 5.11 (the palaestra's colonnades); Seneca's noise
 *     of the ball players, the man lifting lead weights, the oil and the
 *     strigil, the plunge; Martial's crowd; statues in niches along the
 *     natatio's wall (Caracalla's Farnese pieces stood in such niches).
 *
 * So, in 20 m: along the front (+z, the street) the natatio, raised in its
 * marble rim behind a low parapet, the frigidarium's façade behind it with
 * its columns, niches and statues under the three lunettes; a vestibule at
 * either front corner (the changing rooms) with its door to the street;
 * behind the frigidarium the tepidarium, then the caldarium's sixteen-sided
 * drum and saucer dome, bulging out to the back; a palaestra of sand down
 * each side with a colonnade along its outer wall; at the back corners the
 * service yards, the cistern on one side and the woodstore on the other,
 * a furnace mouth in the drum's foot on each.
 *
 * The site, as the sim builds it in four stages (data/monuments.js):
 *   0  foundations and the hypocaust: footings in their trenches, the
 *      pilae rising row by row in the hot rooms, the pool dug
 *   1  the hot and warm halls: every wall of the block rising course by
 *      course, the drum with its window jambs open to the sky
 *   2  the cold hall and the pool: the vaults turned on their centering, the
 *      frigidarium's bays one by one, the dome ring by ring
 *   3  the palaestra: the block rendered and glazed, the colonnades and
 *      the vestibules rising, the sand laid
 * each `f` (0..1) of the way through (thermaeSite: its scaffolds, cranes,
 * centering and piles as models/worksite.js draws them).
 *
 * Finished, its state (meshes tagged in userData.when, models.js partShows):
 *   'flowing'  working (staffed, heated, piped): the furnace's coals lit,
 *              smoke from its flues, the windows lit from within at
 *              night, the doors open; in a hard frost steam from the
 *              windows, the oculus and the vents ('ice')
 *   'still'    water but cold (no timber, or no staff): the furnace dark,
 *              the doors shut, the pools full and still
 *   'dry'      no piped water: the pools empty, a stain at the waterline
 * `sacked`: raiders' work: rubble at the doors, columns thrown down, soot
 * up the walls, the statues gone, a roof broken in.
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z,
 * as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry, BoxGeometry, Vector3 } from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { material, shallowWaterMaterial, streamMaterial, iceMaterial } from '../materials.js';
import { slab, paving, tuscanColumn, wallWithOpenings, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin, woodpile, ruralMaterials, leanTo } from './rural.js';
import { staff, inscribe } from './castra.js';
import { roofSlope } from './learning.js';
import { healthMaterials, steamMaterial, plume, coals } from './healing.js';
import { statue } from './domus.js';
import { box, bag, placed, risingWall, groinSkin, barrelSkin, lunetteWall, drumFacets, rubbleHeap, fallenColumn, scorch } from './civicParts.js';
import { addSite } from './worksite.js';
import { DYES } from '../people/actors.js';
import { SEAT_H } from '../people/clips.js';

/** The baths' measures (metres): the tests, the lab and the game read them. */
export const THERMAE = Object.freeze({
  half: 10,
  /** The frigidarium: x0..x1, z0..z1 (outer faces), its bays' width, the vaults' springing, its walls' thickness. */
  frig: Object.freeze({ x0: -4.8, x1: 4.8, z0: 1.4, z1: 4.6, bay: 3.2, spring: 4.4, t: 0.45 }),
  /** The tepidarium: x0..x1, z0..z1, its barrel's springing (the barrel runs along x). */
  tep: Object.freeze({ x0: -2.2, x1: 2.2, z0: -1.7, z1: 1.4, spring: 3.4 }),
  /** The caldarium's drum: its middle (x, z), the corners' radius, its sides, its wall's top, thickness. */
  cald: Object.freeze({ x: 0, z: -5.6, R: 3.9, n: 16, top: 5.2, t: 0.5 }),
  /** The natatio: x0..x1, z0..z1 (its walls' outer faces), its rim's height, its water's. */
  pool: Object.freeze({ x0: -4.4, x1: 4.4, z0: 5.4, z1: 9.0, rim: 1.0, water: 0.9 }),
  /** The palaestrae (either side, by |x|): the outer wall's face, the colonnade's line, the court's z0..z1, the wall's height. */
  pal: Object.freeze({ wall: 9.8, cols: 8.15, z0: -5.6, z1: 6.6, h: 3.4, eave: 2.75 }),
  /** The vestibules (either front corner, by |x|): x0..x1, z0..z1, their eaves. */
  vest: Object.freeze({ x0: 5.2, x1: 9.8, z0: 6.6, z1: 9.8, eave: 3.6 }),
  /** The service yards (either back corner): |x| from x0, z0..z1, their walls' height. */
  yard: Object.freeze({ x0: 4.1, z0: -9.8, z1: -5.6, h: 2.4 }),
  /** The cistern in the left yard: x0..x1, z0..z1, its walls' top. */
  cistern: Object.freeze({ x0: -9.5, x1: -6.2, z0: -9.5, z1: -6.4, h: 3.0 }),
  /** The furnace mouths: the drum's facets they open from (one into each yard). */
  furnaces: Object.freeze([4, 11]),
});

const T = THERMAE;
const F = T.frig;
const C = T.cald;
const P = T.pool;
const PAL = T.pal;
const V = T.vest;

/** The dome: its foot over the drum's cornice, its rise, the oculus's radius. */
const DOME = Object.freeze({ foot: C.top + 0.75, r: C.R - 0.55, rise: 2.05, oculus: 0.42 });

/** The four stages of the site and the finished baths. */
export const THERMAE_STAGES = 4;

/** Is stage s (0-3) of a site at `stage` with `f` of it done: 1 built, its share while under way, 0 not begun. */
function share(stage, f, s) {
  return stage > s ? 1 : stage === s ? f : 0;
}

/** The facets of the caldarium's drum (civicParts.js drumFacets), and which have windows (all but those joining the tepidarium). */
function facets() {
  return drumFacets(C.x, C.z, C.R, C.n).map((q) => ({ ...q, window: q.k >= 3 && q.k <= 12, furnace: T.furnaces.includes(q.k) }));
}

// ---------------------------------------------------------------------------
// The ground
// ---------------------------------------------------------------------------

/** The ground: the site's dug earth; finished, flags along the walks, the palaestrae's sand, the yards' earth. */
function ground(lod, seed, out, stage, f) {
  const H = T.half;
  if (stage < 4) {
    // (Trodden earth over the whole site; once the block stands the walks are paved, at the end the sand laid.)
    out.earth.push(box(2 * H - 0.04, 0.02, 2 * H - 0.04, 0, 0, 0, (x, y, z) => 0.85 + 0.12 * Math.cos(x * 0.9) * Math.cos(z * 0.7)));
  } else {
    out.earth.push(box(2 * H - 0.04, 0.02, 2 * H - 0.04, 0, 0, 0, 0.9));
  }
  const paved = share(stage, f, 2) >= 0.6 || stage >= 3;
  if (paved) {
    // The walk between the frigidarium's façade and the pool, round the pool, and in front of the parapet.
    out.flags.push(...paving(F.x0 - 0.3, F.x1 + 0.3, F.z1, P.z0, 0.05, seed, { rowW: 0.55, minL: 0.5, maxL: 0.9, lod }));
    for (const s of [-1, 1]) out.flags.push(...paving(s < 0 ? -V.x0 : P.x1, s < 0 ? P.x0 : V.x0, P.z0, H - 0.1, 0.05, seed + 3 + s, { rowW: 0.55, minL: 0.5, maxL: 0.9, lod }));
    out.flags.push(...paving(P.x0, P.x1, P.z1, H - 0.1, 0.05, seed + 7, { rowW: 0.5, minL: 0.5, maxL: 0.9, lod }));
  }
  // The palaestrae's sand (stage 3 lays it).
  if (share(stage, f, 3) >= 0.35) {
    for (const s of [-1, 1]) {
      const a = s * 2.25;
      const b = s * PAL.cols - s * 0.25;
      out.sand.push(box(Math.abs(b - a), 0.035, PAL.z1 - PAL.z0 - 0.2, (a + b) / 2, 0, (PAL.z0 + PAL.z1) / 2, (x, y, z) => 0.9 + 0.1 * Math.cos(x * 1.7) * Math.cos(z * 1.3)));
    }
  }
}

// ---------------------------------------------------------------------------
// Foundations and the hypocaust
// ---------------------------------------------------------------------------

/** The footings under the block's walls, in their trenches at first; the hypocaust's pilae in the hot rooms. */
function foundations(lod, seed, out, stage, f) {
  const k = share(stage, f, 0);
  // Stage 0: the trenches dug (dark strips) and the footings rising in them; after, a low socle shows.
  const footH = stage === 0 ? 0.08 + 0.32 * Math.min(1, f * 1.7) : 0.4;
  const runs = [
    // [x0, x1, z0, z1]: the frigidarium's walls, the tepidarium's, the pool's rim.
    [F.x0, F.x1, F.z1 - F.t, F.z1], [F.x0, F.x1, F.z0, F.z0 + F.t], [F.x0, F.x0 + F.t, F.z0, F.z1], [F.x1 - F.t, F.x1, F.z0, F.z1],
    [T.tep.x0, T.tep.x0 + 0.4, T.tep.z0, T.tep.z1], [T.tep.x1 - 0.4, T.tep.x1, T.tep.z0, T.tep.z1],
  ];
  if (stage === 0) {
    for (const [x0, x1, z0, z1] of runs) out.trench.push(box(x1 - x0 + 0.5, 0.025, z1 - z0 + 0.5, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0.8));
    // The drum's ring of trench.
    for (const q of facets()) out.trench.push(placed(box(q.len + 0.1, 0.025, C.t + 0.5, 0, 0, -C.t / 2, 0.8), q.x, 0, q.z, q.ry));
  }
  for (const [x0, x1, z0, z1] of runs) out.core.push(box(x1 - x0 + 0.1, footH, z1 - z0 + 0.1, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0.85));
  for (const q of facets()) out.core.push(placed(box(q.len + 0.12, footH, C.t + 0.12, 0, 0, -C.t / 2, 0.85), q.x, 0, q.z, q.ry));
  // The hypocaust: a grid of pilae (square bricks stacked some 60 cm) over the tepidarium's and the
  // caldarium's floors, rising row by row; once the walls go up the suspended floor covers them.
  if (stage === 0) {
    const pil = [];
    const step = lod === 2 ? 1.2 : 0.6;
    for (let x = -3.0; x <= 3.0 + 1e-6; x += step) {
      for (let z = -8.6; z <= 0.8 + 1e-6; z += step) {
        const inCald = Math.hypot(x - C.x, z - C.z) < C.R - C.t - 0.35;
        const inTep = x > T.tep.x0 + 0.5 && x < T.tep.x1 - 0.5 && z > T.tep.z0 + 0.2 && z < T.tep.z1 - 0.5;
        if (inCald || inTep) pil.push([x, z]);
      }
    }
    // (Laid from the back forward: the rows the share has reached.)
    pil.sort((a, b) => a[1] - b[1]);
    const n = Math.round(pil.length * Math.min(1, k * 1.3));
    pil.slice(0, n).forEach(([x, z], i) => out.brick.push(box(0.22, 0.6, 0.22, x, 0.04, z, 0.8 + 0.15 * ((i * 7) % 3) / 2)));
    // The base slab of tiles they stand on.
    out.signinum.push(box(4.0, 0.04, 2.6, 0, 0, -0.3, 0.8));
    const disc = new CylinderGeometry(C.R - C.t - 0.2, C.R - C.t - 0.2, 0.04, lod ? 16 : 32, 1);
    out.signinum.push(tintGeometry(boxUV(disc.translate(C.x, 0.02, C.z)), () => 0.8));
  } else {
    // The suspended floor over them (seen from above while the walls are low and the vaults open).
    out.signinum.push(box(T.tep.x1 - T.tep.x0 - 0.8, 0.06, T.tep.z1 - T.tep.z0 - 0.4, 0, 0.66, (T.tep.z0 + T.tep.z1) / 2, 0.9));
    const disc = new CylinderGeometry(C.R - C.t - 0.05, C.R - C.t - 0.05, 0.06, lod ? 16 : 32, 1);
    out.signinum.push(tintGeometry(boxUV(disc.translate(C.x, 0.69, C.z)), () => 0.9));
    out.signinum.push(box(F.x1 - F.x0 - 0.9, 0.05, F.z1 - F.z0 - 0.9, 0, 0.1, (F.z0 + F.z1) / 2, 0.85));
  }
  void seed;
}

// ---------------------------------------------------------------------------
// The bath block
// ---------------------------------------------------------------------------

/** A wall built along x facing +z at its face's middle (x, z), turned ry, cut at course c. */
function wallAt(list, len, h, t, x, z, ry, openings, c, lod) {
  for (const g of risingWall(len, h, t, openings, c, lod)) list.push(placed(g, x, 0, z, ry));
}

/** The frigidarium: its walls and openings, the lunettes and their thermal windows, the three groin vaults. */
function frigidarium(lod, seed, out, stage, f, finished) {
  const wallK = share(stage, f, 1);
  const c = F.spring * wallK;
  const seg = lod === 2 ? 6 : lod ? 10 : 18;
  const a = F.bay / 2;
  const cx = [-F.bay, 0, F.bay];
  // The front wall (on the pool): three arched openings to the walk; the back: a door to the tepidarium.
  const front = cx.map((x) => ({ x, w: 1.45, h: 2.35, arch: true, y: 0.1 }));
  const back = [{ x: 0, w: 1.3, h: 2.3, arch: true, y: 0.1 }, { x: -F.bay, w: 0.7, h: 0.9, y: 2.6, arch: true }, { x: F.bay, w: 0.7, h: 0.9, y: 2.6, arch: true }];
  const end = [{ x: 0, w: 1.7, h: 2.5, arch: true, y: 0.1 }];
  const len = F.x1 - F.x0;
  wallAt(out.brick, len, F.spring, F.t, 0, F.z1, 0, front, c, lod);
  wallAt(out.brick, len, F.spring, F.t, 0, F.z0, Math.PI, back, c, lod);
  wallAt(out.brick, F.z1 - F.z0 - 2 * F.t, F.spring, F.t, F.x1, (F.z0 + F.z1) / 2, Math.PI / 2, end, c, lod);
  wallAt(out.brick, F.z1 - F.z0 - 2 * F.t, F.spring, F.t, F.x0, (F.z0 + F.z1) / 2, -Math.PI / 2, end, c, lod);
  // The dark of the hall through its openings (a box inside, faces in).
  if (wallK > 0.3) out.dark.push(box(len - 2 * F.t - 0.02, Math.min(c, F.spring) - 0.12, F.z1 - F.z0 - 2 * F.t - 0.02, 0, 0.12, (F.z0 + F.z1) / 2, 1));
  // A cornice of travertine at the springing, all round.
  if (stage >= 2) {
    for (const z of [F.z0 - 0.06, F.z1 + 0.06]) out.trav.push(slab(len + 0.3, 0.14, 0.24, { bevel: 0.015, seed: seed + z, wobble: 0, tone: 0.03, grime: 0.2 }).translate(0, F.spring, z));
    for (const x of [F.x0 - 0.06, F.x1 + 0.06]) out.trav.push(slab(0.24, 0.14, F.z1 - F.z0 + 0.3, { bevel: 0.015, seed: seed + x, wobble: 0, tone: 0.03, grime: 0.2 }).translate(x, F.spring, (F.z0 + F.z1) / 2));
  }
  // The vaults: stage 2 turns the three bays one after another; each bay's lunettes go up with it.
  const vk = share(stage, f, 2);
  const skin = stage >= 3 ? out.coldVault : out.vaultBare;
  const r = a + 0.2;
  const sy = F.spring + 0.14;
  for (let b = 0; b < 3; b++) {
    const up = stage >= 3 ? 1 : stage === 2 ? Math.min(1, Math.max(0, vk * 3.3 - b * 1.1)) : 0;
    if (up <= 0) continue;
    skin.push(groinSkin(cx[b], (F.z0 + F.z1) / 2, r, sy, seg, up));
    // The lunettes over the bay's two long sides (front and back), with their thermal windows.
    if (up >= 1) {
      for (const [z, ry] of [[F.z1, 0], [F.z0, Math.PI]]) {
        const l = lunetteWall(r, F.t, seg, a - 0.35, 0.15);
        out.brick.push(placed(l.wall, cx[b], sy, z, ry));
        if (l.glass && stage >= 3) out.glass.push(placed(l.glass, cx[b], sy, z, ry));
        if (l.glass && stage >= 3) out.glassDark.push(placed(l.glass.clone(), cx[b], sy, z, ry));
      }
    }
  }
  // The lunettes over the hall's two ends (the run of the vault along x), facing the palaestrae.
  if (stage >= 3 || (stage === 2 && vk > 0.95)) {
    for (const [x, ry] of [[F.x1, Math.PI / 2], [F.x0, -Math.PI / 2]]) {
      const l = lunetteWall(r, F.t, seg, a - 0.35, 0.15);
      out.brick.push(placed(l.wall, x, sy, (F.z0 + F.z1) / 2, ry));
      if (l.glass && stage >= 3) {
        out.glass.push(placed(l.glass, x, sy, (F.z0 + F.z1) / 2, ry));
        out.glassDark.push(placed(l.glass.clone(), x, sy, (F.z0 + F.z1) / 2, ry));
      }
    }
  }
  // The façade on the pool: four columns of green cipollino on pedestals carrying their own bits of
  // entablature, and between the openings and at the ends niches with statues (finished).
  if (stage >= 3 || (stage === 2 && vk > 0.5)) {
    const colX = [-4.0, -1.6, 1.6, 4.0];
    const colH = F.spring - 0.95;
    for (const x of colX) {
      out.trav.push(slab(0.62, 0.75, 0.62, { bevel: 0.02, seed: seed + x * 3, wobble: 0.002, tone: 0.04, grime: 0.4 }).translate(x, 0.05, F.z1 + 0.42));
      for (const g of tuscanColumn(0.2, colH, lod)) out.cipollino.push(g.translate(x, 0.8, F.z1 + 0.42));
      out.marble.push(slab(0.72, 0.42, 0.78, { bevel: 0.015, seed: seed + x * 5, wobble: 0, tone: 0.02, grime: 0 }).translate(x, 0.8 + colH, F.z1 + 0.36));
    }
    // The architrave and frieze running across between the columns' bits, at the springing.
    out.marble.push(slab(len + 0.2, 0.22, 0.3, { bevel: 0.012, seed: seed + 11, wobble: 0, tone: 0.02, grime: 0.1 }).translate(0, F.spring - 0.15, F.z1 + 0.12));
  }
  void finished;
}

/** The niches' statues along the façade (Hygieia, the goddess of health, and an athlete), finished. */
function statues(lod, out) {
  for (const [x, kind] of [[-2.8, 'draped'], [2.8, 'nude']]) {
    out.dark.push(box(0.7, 2.3, 0.02, x, 0.5, F.z1 + 0.005, 1));
    const s = statue(x, F.z1 + 0.32, 0, { y0: 0.05, h: 1.0, kind, lod, scale: 0.92, base: 0.45 });
    out.trav.push(...s.base);
    out.statue_marble.push(...s.statue);
  }
}

/** The tepidarium: its two short walls (the long ones are the halls it joins), the barrel along x, its lunettes. */
function tepidarium(lod, seed, out, stage, f) {
  const P0 = T.tep;
  const c = P0.spring * share(stage, f, 1);
  const r = (P0.z1 - P0.z0) / 2;
  const zc = (P0.z0 + P0.z1) / 2;
  const seg = lod === 2 ? 6 : lod ? 10 : 18;
  for (const [x, ry] of [[P0.x1, Math.PI / 2], [P0.x0, -Math.PI / 2]]) {
    wallAt(out.brick, P0.z1 - P0.z0, P0.spring, 0.4, x, zc, ry, [{ x: 0, w: 0.9, h: 1.2, y: 1.2, arch: true }], c, lod);
  }
  if (stage >= 1 && c >= P0.spring - 1e-6) out.dark.push(box(P0.x1 - P0.x0 - 0.8, P0.spring - 0.1, P0.z1 - P0.z0 - 0.2, 0, 0.1, zc, 1));
  const up = stage >= 3 ? 1 : stage === 2 ? Math.min(1, share(stage, f, 2) * 2.5) : 0;
  if (up > 0) {
    (stage >= 3 ? out.warmVault : out.vaultBare).push(barrelSkin(P0.x0 - 0.05, P0.x1 + 0.05, P0.spring, zc, r + 0.15, seg, up));
    if (up >= 1) {
      for (const [x, ry] of [[P0.x1, Math.PI / 2], [P0.x0, -Math.PI / 2]]) {
        const l = lunetteWall(r + 0.15, 0.4, seg, r - 0.45, 0.12);
        out.brick.push(placed(l.wall, x, P0.spring, zc, ry));
        if (l.glass && stage >= 3) {
          out.glass.push(placed(l.glass, x, P0.spring, zc, ry));
          out.glassDark.push(placed(l.glass.clone(), x, P0.spring, zc, ry));
        }
      }
    }
  }
  void seed;
}

/** The caldarium: the drum's sixteen faces (the windows, the furnace mouths), its cornice and steps, the dome. */
function caldarium(lod, seed, out, stage, f) {
  const c = C.top * share(stage, f, 1);
  const seg = C.n;
  const win = { w: 1.0, h: 2.35, y: 1.55, arch: true };
  for (const q of facets()) {
    // (The two facets against the tepidarium are its wall: a door through the nearer.)
    if (q.k === 0 || q.k === C.n - 1) {
      wallAt(out.brick, q.len + 0.04, C.top, C.t, q.x, q.z, q.ry, [], c, lod);
      continue;
    }
    const ops = [];
    if (q.window) ops.push({ x: 0, ...win });
    if (q.furnace) ops.push({ x: 0, w: 0.7, h: 0.55, y: 0, arch: true });
    wallAt(out.brick, q.len + 0.04, C.top, C.t, q.x, q.z, q.ry, ops, c, lod);
    // Pilasters at the corners between faces (lod 0, 1), a step out from the wall.
    if (lod < 2 && q.k >= 2 && q.k <= 13) {
      const th = ((q.k) / C.n) * Math.PI * 2;
      out.brick.push(placed(box(0.26, c, 0.12, 0, 0, 0.04, 0.88), C.x + Math.sin(th) * (C.R - 0.02), 0, C.z + Math.cos(th) * (C.R - 0.02), th));
    }
    // The windows' glass and their bronze bars (stage 3 glazes them), the furnace mouth's dark.
    if (q.window && stage >= 3) {
      const gl = new BoxGeometry(win.w, win.h + win.w / 2, 0.03);
      gl.translate(0, win.y + (win.h + win.w / 2) / 2, -C.t * 0.5);
      out.glass.push(placed(tintGeometry(boxUV(gl.clone())), q.x, 0, q.z, q.ry));
      out.glassDark.push(placed(tintGeometry(boxUV(gl)), q.x, 0, q.z, q.ry));
      if (lod < 2) {
        for (const g of [box(win.w, 0.035, 0.04, 0, win.y + win.h * 0.5, -C.t * 0.45, 0.8), box(0.035, win.h + win.w / 2, 0.04, 0, win.y, -C.t * 0.45, 0.8)]) out.bronze.push(placed(g, q.x, 0, q.z, q.ry));
      }
      out.trav.push(placed(slab(win.w + 0.2, 0.08, 0.2, { bevel: 0.01, seed: seed + q.k, wobble: 0, tone: 0.03, grime: 0.3 }), q.x, win.y - 0.08, q.z + Math.cos(q.ry) * 0.06, q.ry));
    }
  }
  if (stage >= 1 && c >= C.top - 1e-6) {
    // The room's dark inside, seen through the windows (a cylinder, faces in).
    const inside = new CylinderGeometry(C.R - C.t - 0.02, C.R - C.t - 0.02, C.top - 0.75, seg, 1, true);
    inside.scale(-1, 1, 1);
    out.dark.push(tintGeometry(boxUV(inside.translate(C.x, 0.75 + (C.top - 0.75) / 2, C.z))));
  }
  if (stage < 2) return;
  // The cornice and the stepped rings at the dome's foot (the Pantheon's and the great baths' way of
  // weighting a dome's haunches), concrete faced in brick.
  const ring = revolve(profileOf([[C.R + 0.1, C.top], [C.R + 0.1, C.top + 0.18], [C.R - 0.15, C.top + 0.18], [C.R - 0.15, C.top + 0.45], [C.R - 0.4, C.top + 0.45], [C.R - 0.4, DOME.foot], [DOME.r - 0.05, DOME.foot]]), { segments: seg, metres: 1, tint: () => 0.9 });
  (stage >= 3 ? out.trav : out.core).push(ring.translate(C.x, 0, C.z));
  // The dome: a saucer rising ring by ring through stage 2 (its centering under it, worksite.js), the oculus open.
  const up = stage >= 3 ? 1 : Math.min(1, share(stage, f, 2) * 1.25);
  const n = lod === 2 ? 4 : lod ? 7 : 12;
  const prof = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const a = u * Math.PI / 2;
    const r = DOME.oculus + (DOME.r - DOME.oculus) * Math.cos(a * 0.92) ** 0.9;
    const y = DOME.foot + DOME.rise * Math.sin(a);
    if (u <= up + 1e-6) prof.push([r, y]);
  }
  if (up >= 1) prof.push([DOME.oculus + 0.06, DOME.foot + DOME.rise + 0.08], [DOME.oculus - 0.02, DOME.foot + DOME.rise + 0.08], [DOME.oculus - 0.04, DOME.foot + DOME.rise - 0.1]);
  if (prof.length >= 2) {
    const dome = revolve(prof, { segments: lod === 2 ? 16 : 32, metres: 1, tint: (p) => 0.82 + 0.18 * Math.min(1, (p.y - DOME.foot) / DOME.rise) });
    (stage >= 3 ? out.warmVault : out.vaultBare).push(dome.translate(C.x, 0, C.z));
  }
  if (up >= 1) {
    const hole = new CylinderGeometry(DOME.oculus - 0.04, DOME.oculus - 0.04, 0.02, lod ? 10 : 18, 1);
    out.dark.push(tintGeometry(boxUV(hole.translate(C.x, DOME.foot + DOME.rise - 0.25, C.z))));
  }
  // The flue vents on the cornice, terracotta pipe ends sooted at the top (the box tiles' outlets).
  if (stage >= 3 && lod < 2) {
    for (const k of [3, 5, 7, 8, 10, 12]) {
      const th = ((k + 0.5) / C.n) * Math.PI * 2;
      const x = C.x + Math.sin(th) * (C.R - 0.3);
      const z = C.z + Math.cos(th) * (C.R - 0.3);
      out.vents.push(tintGeometry(boxUV(new CylinderGeometry(0.08, 0.09, 0.4, lod ? 6 : 10, 1, true).translate(x, C.top + 0.38, z)), (px, py) => (py > C.top + 0.5 ? 0.35 : 0.9)));
    }
  }
}

/** The vents' places on the drum's cornice (smoke and steam rise from them). */
function ventAt(k) {
  const th = ((k + 0.5) / C.n) * Math.PI * 2;
  return [C.x + Math.sin(th) * (C.R - 0.3), C.top + 0.58, C.z + Math.cos(th) * (C.R - 0.3)];
}

/** The furnace mouths in the drum's foot (facets T.furnaces): their coals, an apron, the boiler beside the right one. */
function furnaces(lod, seed, out, stage) {
  if (stage < 2) return;
  for (const q of facets().filter((x) => x.furnace)) {
    const nx = Math.sin(q.ry);
    const nz = Math.cos(q.ry);
    const mx = q.x - nx * C.t * 0.6;
    const mz = q.z - nz * C.t * 0.6;
    out.dark.push(placed(box(0.7, 0.9, 0.02, 0, 0, -C.t + 0.02, 1), q.x, 0, q.z, q.ry));
    const cl = coals(mx, 0.02, mz, 0.3, { seed: seed + q.k, lod });
    out.coalsLit.push(...cl.hot);
    out.coalsCold.push(...cl.hot.map((g) => g.clone()));
    out.charcoal.push(...cl.dark);
    out.brick.push(placed(box(0.9, 0.04, 0.6, 0, 0, 0.3, 0.7), q.x, 0, q.z, q.ry));
  }
}

// ---------------------------------------------------------------------------
// The natatio, the parapet, the vestibules, the palaestrae
// ---------------------------------------------------------------------------

/** The natatio: its walls (the camera sees their outer faces), the marble rim, the blue inside, its water. */
function natatio(lod, seed, out, stage, f, ice, finished) {
  const { x0, x1, z0, z1, rim, water } = P;
  const t = 0.3;
  const k = stage >= 2 ? 1 : share(stage, f, 1);
  if (stage === 0) {
    out.trench.push(box(x1 - x0, 0.02, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0.7));
    return;
  }
  const h = (rim - 0.08) * k;
  for (const s of [-1, 1]) {
    out.plaster.push(box(x1 - x0, h, t, (x0 + x1) / 2, 0, s < 0 ? z0 + t / 2 : z1 - t / 2, 0.93));
    out.plaster.push(box(t, h, z1 - z0 - 2 * t, s < 0 ? x0 + t / 2 : x1 - t / 2, 0, (z0 + z1) / 2, 0.93));
  }
  if (stage < 2 || share(stage, f, 2) < 0.4) return;
  for (const s of [-1, 1]) {
    out.marble.push(slab(x1 - x0 + 0.08, 0.08, t + 0.1, { bevel: 0.012, seed: seed + s, wobble: 0.002, tone: 0.03, grime: 0 }).translate((x0 + x1) / 2, rim - 0.08, s < 0 ? z0 + t / 2 : z1 - t / 2));
    out.marble.push(slab(t + 0.1, 0.08, z1 - z0 - 2 * t, { bevel: 0.012, seed: seed + 3 + s, wobble: 0.002, tone: 0.03, grime: 0 }).translate(s < 0 ? x0 + t / 2 : x1 - t / 2, rim - 0.08, (z0 + z1) / 2));
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
      out.marble.push(slab(0.3, hh, 1.2, { bevel: 0.012, seed: seed + 10 + j + s * 5, wobble: 0.002, tone: 0.03, grime: 0.2 }).translate(s < 0 ? ix0 + 0.15 + (2 - j) * 0.3 : ix1 - 0.15 - (2 - j) * 0.3, 0.04, (iz0 + iz1) / 2));
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
  // Three bronze spouts on the back wall feeding it, their water running while the baths work.
  for (const x of [-2.6, 0, 2.6]) {
    const head = new SphereGeometry(0.1, lod ? 8 : 14, lod ? 6 : 10);
    head.scale(1, 0.9, 0.8);
    head.translate(x, rim + 0.12, z0 + 0.08);
    out.bronze.push(tintGeometry(boxUV(head), () => 0.75));
    out.trav.push(slab(0.32, rim + 0.04, 0.2, { bevel: 0.01, seed: seed + x, wobble: 0, tone: 0.03, grime: 0.3 }).translate(x, 0, z0 - 0.06));
    if (!ice) {
      const pts = [new Vector3(x, rim + 0.08, z0 + 0.16), new Vector3(x, rim + 0.04, z0 + 0.26), new Vector3(x, rim - 0.02, z0 + 0.34), new Vector3(x, water, z0 + 0.42)];
      out.stream.push(tube(pts, 0.03, { radial: lod ? 6 : 10, segments: lod ? 6 : 12, around: 0.2 }));
    }
  }
}

/** The low parapet along the street before the pool, its marble coping, two bronze statues on their bases at its ends. */
function parapet(lod, seed, out, stage, f) {
  const k = share(stage, f, 3);
  if (k <= 0) return;
  const z = 9.55;
  const h = 0.95 * Math.min(1, k * 2);
  out.plaster.push(box(P.x1 - P.x0 + 0.6, h, 0.3, 0, 0, z, 0.92));
  if (k > 0.5) out.marble.push(slab(P.x1 - P.x0 + 0.7, 0.08, 0.4, { bevel: 0.012, seed, wobble: 0.002, tone: 0.03, grime: 0 }).translate(0, h, z));
  if (k >= 1 || stage >= 4) {
    for (const x of [P.x0 - 0.1, P.x1 + 0.1]) out.trav.push(slab(0.6, 1.3, 0.6, { bevel: 0.015, seed: seed + x, wobble: 0.002, tone: 0.04, grime: 0.4 }).translate(x, 0, z));
  }
}

/** The bronze statues on the parapet's ends: athletes (the Apoxyomenos's kind, scraping off the oil), finished. */
function bronzes(lod, out) {
  for (const [x, ry] of [[P.x0 - 0.1, 0.4], [P.x1 + 0.1, -0.4]]) {
    const s = statue(x, 9.55, ry, { y0: 1.3, h: 1.0, kind: 'nude', lod, scale: 0.9, base: 0.0 });
    out.statueBronze.push(...s.statue);
  }
}

/** A vestibule (the changing rooms) at the front corner on side s: plastered walls, a door to the street and one to the court, a hipped roof. */
function vestibule(lod, seed, out, stage, f, s, sacked) {
  const k = share(stage, f, 3);
  if (k <= 0) return;
  const x0 = s * V.x0;
  const x1 = s * V.x1;
  const xa = Math.min(x0, x1);
  const xb = Math.max(x0, x1);
  const xc = (xa + xb) / 2;
  const w = xb - xa;
  const d = V.z1 - V.z0;
  const zc = (V.z0 + V.z1) / 2;
  const c = V.eave * Math.min(1, k * 1.6);
  const door = { x: s * 0.3, w: 1.4, h: 2.2, arch: true, y: 0.08 };
  wallAt(out.plaster, w, V.eave, 0.35, xc, V.z1, 0, [door], c, lod);
  wallAt(out.plaster, w, V.eave, 0.35, xc, V.z0, Math.PI, [{ x: -s * 0.4, w: 1.3, h: 2.2, arch: true, y: 0.08 }], c, lod);
  wallAt(out.plaster, d - 0.7, V.eave, 0.35, s > 0 ? xb : xa, zc, s > 0 ? Math.PI / 2 : -Math.PI / 2, [{ x: 0, w: 0.6, h: 0.8, y: 2.0 }], c, lod);
  wallAt(out.plaster, d - 0.7, V.eave, 0.35, s > 0 ? xa : xb, zc, s > 0 ? -Math.PI / 2 : Math.PI / 2, [], c, lod);
  out.red.push(box(w, 0.75, 0.012, xc, 0, V.z1 + 0.006, 1));
  if (c >= V.eave - 1e-6) out.dark.push(box(w - 0.72, V.eave - 0.1, d - 0.72, xc, 0.08, zc, 1));
  // The door's travertine frame and lintel.
  out.trav.push(slab(door.w + 0.4, 0.2, 0.42, { bevel: 0.012, seed: seed + s, wobble: 0, tone: 0.03, grime: 0.2 }).translate(xc + door.x, door.y + door.h + door.w / 2 + 0.04, V.z1 - 0.17));
  for (const e of [-1, 1]) out.trav.push(slab(0.22, door.y + door.h + 0.02, 0.4, { bevel: 0.012, seed: seed + e * 3, wobble: 0, tone: 0.03, grime: 0.3 }).translate(xc + door.x + e * (door.w / 2 + 0.1), 0, V.z1 - 0.16));
  if (k < 0.75 && stage < 4) return;
  // The roof: four slopes up to a short ridge (on the front one's inscription frieze).
  const y = V.eave;
  const top = y + 1.15;
  const o = 0.3;
  const quads = [
    [[xa - o, y, V.z1 + o], [xb + o, y, V.z1 + o], [xb - 1.2, top, zc], [xa + 1.2, top, zc]],
    [[xb + o, y, V.z0 - o], [xa - o, y, V.z0 - o], [xa + 1.2, top, zc], [xb - 1.2, top, zc]],
    [[xa - o, y, V.z0 - o], [xa - o, y, V.z1 + o], [xa + 1.2, top, zc], [xa + 1.2, top, zc]],
    [[xb + o, y, V.z1 + o], [xb + o, y, V.z0 - o], [xb - 1.2, top, zc], [xb - 1.2, top, zc]],
  ];
  quads.forEach((q, i) => {
    // (A sacked vestibule's back slope is broken in: its rafters bare.)
    if (sacked && s > 0 && i === 1) {
      for (let j = 0; j < 5; j++) out.wood.push(staff([xa + 0.4 + j * 0.9, y + 0.05, V.z0 - 0.2], [xa + 0.4 + j * 0.9, top - 0.05, zc], 0.05, 5));
      return;
    }
    const r = roofSlope(q, { lod, seed: seed + 20 + i });
    out.tile.push(...r.tile);
    out.wood.push(...r.wood);
  });
  // The cornice under the eaves.
  out.trav.push(slab(w + 0.2, 0.16, 0.2, { bevel: 0.01, seed: seed + 40, wobble: 0, tone: 0.02, grime: 0.1 }).translate(xc, y - 0.16, V.z1 + 0.05));
  if (s < 0) {
    if (lod === 0) out.letters.push(...inscribe('THERMAE', y - 0.62, V.z1 + 0.012, 0.32).map((g) => g.translate(xc, 0, 0)));
    else if (lod === 1) out.letters.push(box(2.6, 0.3, 0.006, xc, y - 0.62, V.z1 + 0.01));
  }
}

/** A palaestra on side s: its outer wall, the colonnade along it under a lean-to, benches, a basin. */
function palaestra(lod, seed, out, stage, f, s, sacked) {
  const k = share(stage, f, 3);
  if (k <= 0) return;
  const xw = s * PAL.wall;
  const len = PAL.z1 - PAL.z0;
  const zc = (PAL.z0 + PAL.z1) / 2;
  const c = PAL.h * Math.min(1, k * 2.2);
  wallAt(out.plaster, len, PAL.h, 0.35, xw, zc, s > 0 ? Math.PI / 2 : -Math.PI / 2, [], c, lod);
  // (The wall's inner face, toward the court, painted red to the height of a man.)
  if (c > 1) out.red.push(box(0.012, 1.0, len - 0.1, xw - s * 0.356, 0.12, zc, 1));
  // The back end's wall to the service yard.
  wallAt(out.plaster, PAL.wall - 4.1, T.yard.h + 0.4, 0.3, s * (PAL.wall + 4.1) / 2, PAL.z0, Math.PI, [{ x: s * -0.9, w: 1.1, h: 2.0 }], Math.min(c, T.yard.h + 0.4), lod);
  // The colonnade: columns along its line rising one by one, then the beam and the lean-to.
  const n = lod === 2 ? 6 : 9;
  const colH = PAL.eave - 0.24 - 0.12;
  const shown = stage >= 4 ? n : Math.round(n * Math.min(1, Math.max(0, (k - 0.25) * 1.6)));
  const floorX = (PAL.cols + PAL.wall - 0.35) / 2;
  if (shown > 0) out.floor.push(box(PAL.wall - 0.35 - PAL.cols + 0.3, 0.12, len - 0.1, s * floorX, 0, zc, 0.95));
  const fallen = sacked ? [2, 6] : [];
  for (let j = 0; j < shown; j++) {
    const z = PAL.z0 + 0.7 + (j * (len - 1.4)) / (n - 1);
    if (fallen.includes(j) && s > 0) {
      out.cols.push(...fallenColumn(s * (PAL.cols - 1.0), z + 0.3, s * 1.2, 0.13, 3, 0.7, seed + j, lod));
      out.trav.push(slab(0.36, 0.06, 0.36, { bevel: 0.01, seed: seed + j, wobble: 0, tone: 0, grime: 0.4 }).translate(s * PAL.cols, 0.12, z));
      continue;
    }
    for (const g of tuscanColumn(0.13, colH, lod)) out.cols.push(g.translate(s * PAL.cols, 0.12, z));
  }
  if (stage < 4 && k < 0.85) return;
  out.wood.push(box(0.22, 0.24, len, s * PAL.cols, PAL.eave - 0.24, zc, 0.85));
  const xi = s * (PAL.wall - 0.35);
  const xe = s * (PAL.cols - 0.3);
  const roof = roofSlope(s > 0
    ? [[xe, PAL.eave, PAL.z0], [xe, PAL.eave, PAL.z1], [xi, PAL.h + 0.05, PAL.z1], [xi, PAL.h + 0.05, PAL.z0]]
    : [[xe, PAL.eave, PAL.z1], [xe, PAL.eave, PAL.z0], [xi, PAL.h + 0.05, PAL.z0], [xi, PAL.h + 0.05, PAL.z1]], { lod, seed: seed + 9 + s });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // Coping on the wall's top.
  out.tile.push(box(0.45, 0.07, len, xw - s * 0.17, PAL.h, zc, 0.85));
  // Benches along the wall under the colonnade (the bathers' and the oil seller's), and a stone basin in the court.
  const legs = SEAT_H - 0.06;
  for (const z of [-3.2, 0.6, 4.2]) {
    out.trav.push(slab(0.42, 0.07, 1.4, { bevel: 0.01, seed: seed + z * 3, wobble: 0, tone: 0.03, grime: 0 }).translate(s * (PAL.wall - 0.62), 0.12 + legs, z));
    for (const e of [-0.5, 0.5]) out.trav.push(box(0.34, legs, 0.12, s * (PAL.wall - 0.62), 0.12, z + e, 0.75));
  }
  const lb = revolve(profileOf([[0, 0], [0.22, 0], [0.22, 0.06], [0.12, 0.12], [0.1, 0.6], [0.16, 0.68], [0.5, 0.78], [0.56, 0.86], [0.54, 0.88], [0.46, 0.84], [0.0, 0.76]]), { segments: lod === 2 ? 10 : lod ? 18 : 32, metres: 0.6 });
  out.marble.push(tintGeometry(lb.translate(s * 3.4, 0.035, -3.6), (px, py) => 0.85 + 0.15 * Math.min(1, py / 0.8)));
  out.labrumWater.push(tintGeometry(boxUV(new CylinderGeometry(0.46, 0.46, 0.01, lod ? 12 : 24, 1).translate(s * 3.4, 0.86, -3.6))));
}

/** The service yards: their walls, the cistern (left) with its inlet and pipe, the woodstore's shed (right). */
function yards(lod, seed, out, stage, f) {
  const k = share(stage, f, 1);
  if (k <= 0) return;
  const Y = T.yard;
  const c = Y.h * Math.min(1, k * 1.5);
  for (const s of [-1, 1]) {
    wallAt(out.plaster, PAL.wall - Y.x0, Y.h, 0.3, s * (PAL.wall + Y.x0) / 2, Y.z0, Math.PI, [], c, lod);
    wallAt(out.plaster, Y.z1 - Y.z0, Y.h, 0.3, s * PAL.wall, (Y.z0 + Y.z1) / 2, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? [{ x: 1.0, w: 1.6, h: 2.0 }] : [], c, lod);
    out.earth.push(box(PAL.wall - Y.x0 - 0.3, 0.025, Y.z1 - Y.z0 - 0.3, s * (PAL.wall + Y.x0) / 2, 0, (Y.z0 + Y.z1) / 2, 0.75));
  }
  // The cistern: a brick tank on buttresses, its water open on top while the pipes run.
  const Q = T.cistern;
  const ch = Q.h * Math.min(1, k * 1.3);
  const cx = (Q.x0 + Q.x1) / 2;
  const cz = (Q.z0 + Q.z1) / 2;
  for (const [w, d, x, z] of [[Q.x1 - Q.x0, 0.35, cx, Q.z1 - 0.175], [Q.x1 - Q.x0, 0.35, cx, Q.z0 + 0.175], [0.35, Q.z1 - Q.z0 - 0.7, Q.x0 + 0.175, cz], [0.35, Q.z1 - Q.z0 - 0.7, Q.x1 - 0.175, cz]]) out.brick.push(box(w, ch, d, x, 0, z, 0.9));
  if (lod < 2) for (const x of [Q.x0 + 0.9, Q.x1 - 0.9]) out.brick.push(box(0.4, ch * 0.85, 0.28, x, 0, Q.z1 + 0.13, 0.82));
  if (stage < 2) return;
  out.signinum.push(slab(Q.x1 - Q.x0 + 0.1, 0.08, Q.z1 - Q.z0 + 0.1, { bevel: 0.01, seed, wobble: 0, tone: 0.02, grime: 0.3 }).translate(cx, Q.h, cz).translate(0, 0, 0));
  out.blue.push(box(Q.x1 - Q.x0 - 0.7, 0.02, Q.z1 - Q.z0 - 0.7, cx, Q.h - 0.5, cz, 0.6));
  out.cisternWater.push(box(Q.x1 - Q.x0 - 0.7, 0.01, Q.z1 - Q.z0 - 0.7, cx, Q.h - 0.12, cz));
  // The aqueduct's channel arriving at the back on its piers, and a lead pipe from the tank to the drum.
  out.signinum.push(box(0.5, 0.35, 0.5, Q.x0 + 0.6, Q.h - 0.35, Y.z0 + 0.15, 0.85));
  if (lod < 2) out.lead.push(tube([[Q.x1, 0.5, cz], [Q.x1 + 1.2, 0.45, cz + 0.3], [C.x - C.R * 0.75, 0.5, C.z - 1.6]], 0.06, { radial: 6, segments: 10 }));
  // The woodstore's shed against the back wall of the right yard (its logs: the store's own kit, `more`).
  if (stage < 3) return;
  const lt = leanTo({ L: 4.4, span: 1.5, topY: 2.3, eaveY: 1.9, lod, seed: seed + 3, over: 0.1 });
  for (const g of [...lt.tile, ...lt.wood]) g.translate(7.2, 0, Y.z0 + 0.3);
  out.tile.push(...lt.tile);
  out.wood.push(...lt.wood);
  for (const x of [5.2, 7.2, 9.2]) out.wood.push(box(0.12, 1.92, 0.12, x, 0, Y.z0 + 1.75, 0.7));
  // The chopping block and the boiler on its brick base by the furnace.
  out.logs.push(tintGeometry(boxUV(new CylinderGeometry(0.22, 0.24, 0.42, lod ? 7 : 12, 1).translate(6.0, 0.21, -6.6)), () => 0.9));
  const [bx, bz] = [5.3, -7.1];
  out.brick.push(box(0.8, 0.7, 0.8, bx, 0, bz, 0.8));
  const boiler = revolve(profileOf([[0, 0], [0.32, 0], [0.34, 0.04], [0.34, 0.7], [0.36, 0.74], [0.28, 0.82], [0.13, 0.88], [0.04, 0.9], [0.05, 0.96], [0, 0.96]]), { segments: lod === 2 ? 8 : lod ? 12 : 22, metres: 0.3, tint: (p) => 0.55 + 0.45 * Math.min(1, p.y / 0.7) });
  out.bronze.push(boiler.translate(bx, 0.7, bz));
}

/** The woodstore's stacks (the store's own kit: shown while the baths hold timber). */
export function buildThermaeWood({ lod = 0, seed = 671 } = {}) {
  const p = new TaggedParts('thermae-wood');
  const logs = [];
  for (const [x, w] of [[5.6, 1.3], [7.1, 1.3], [8.6, 1.2]]) logs.push(...woodpile(w, 0.95, seed + x, lod).map((g) => g.rotateY(Math.PI / 2).translate(x, 0, T.yard.z0 + 0.95)));
  logs.push(...woodpile(1.1, 0.5, seed + 9, lod).map((g) => g.translate(6.6, 0, -7.4)));
  p.add('firewood', ruralMaterials().bark, logs);
  return p.build();
}

// ---------------------------------------------------------------------------
// A sacked baths
// ---------------------------------------------------------------------------

/** What raiders leave: rubble at the doors and in the court, soot up the walls, the statues thrown down. */
function sackedParts(lod, seed, out) {
  for (const [x, z, r, n] of [[-7.5, 9.9 - 0.5, 0.9, 16], [7.4, 9.3, 1.1, 18], [0, 4.95, 0.9, 14], [6.2, 2.0, 1.0, 14], [-6.6, -2.4, 0.8, 10], [-2.8, 5.0, 0.5, 8]]) out.rubble.push(...rubbleHeap(x, z, r, n, seed + x * 7 + z, lod));
  // Soot over the doors and the windows they fired.
  for (const [x, z, ry, w, h] of [[-7.5 + 0.3 * -1, V.z1 + 0.01, 0, 1.8, 3.4], [7.5 + 0.3, V.z1 + 0.01, 0, 1.8, 3.4], [-3.2, F.z1 + 0.01, 0, 1.6, 3.6], [3.2, F.z1 + 0.01, 0, 1.6, 3.2], [PAL.wall - 0.37, 1.0, -Math.PI / 2, 2.2, 3.0]]) out.soot.push(scorch(x, 0.2, z, ry, w, h));
  // A statue's broken pieces before its empty niche.
  out.marble.push(...fallenColumn(-2.8, 5.0, 0.6, 0.12, 2, 0.5, seed + 3, lod));
}

// ---------------------------------------------------------------------------
// The site's dressing
// ---------------------------------------------------------------------------

/**
 * The site's dressing at stage `stage` with `f` of it done (models/
 * worksite.js draws it): scaffolds where the walls rise, the cranes, the
 * centering under the vaults being turned, the stacks of the stage's goods,
 * and the crew (people/actors.js specs) at work on it. Centering and
 * scaffold heights are from this model's own measures; `y` (where the
 * interface has none) is the springing a centering stands at.
 */
export function thermaeSite(stage, f, work = false) {
  const site = { scaffolds: [], cranes: [], centering: [], piles: [], crew: [] };
  if (stage >= THERMAE_STAGES) return site;
  const S = site;
  const wallH = (H) => Math.max(1.4, Math.min(H, H * f + 1.0));
  if (stage === 0) {
    S.piles.push({ x: -7.4, z: 3.0, ry: 0.2, good: 'clay', n: 3 }, { x: 7.3, z: 2.2, ry: -0.3, good: 'timber', n: 2 }, { x: 7.0, z: -2.8, ry: 0.1, good: 'clay', n: 2 });
    S.cranes.push({ x: 6.6, z: -7.6, ry: -2.4, h: 4.5, kind: 'shear' });
  }
  if (stage === 1) {
    // Scaffolds round the drum's back and along the frigidarium's long walls.
    for (const k of [4, 6, 8, 10]) {
      const th = ((k + 0.5) / C.n) * Math.PI * 2;
      S.scaffolds.push({ x: C.x + Math.sin(th) * (C.R + 0.6), z: C.z + Math.cos(th) * (C.R + 0.6), w: 1.6, d: 0.9, h: wallH(C.top), ry: th });
    }
    S.scaffolds.push({ x: 0, z: F.z1 + 0.6, w: 8.4, d: 0.9, h: wallH(F.spring), ry: 0 });
    S.scaffolds.push({ x: F.x1 + 0.6, z: (F.z0 + F.z1) / 2, w: 2.4, d: 0.9, h: wallH(F.spring), ry: Math.PI / 2 });
    S.cranes.push({ x: 5.4, z: -3.0, ry: -2.2, h: 7.0, kind: 'treadwheel' });
    S.piles.push({ x: -7.2, z: 2.6, ry: 0.1, good: 'clay', n: 4 }, { x: 7.3, z: 3.8, ry: -0.2, good: 'iron', n: 1 }, { x: -7.0, z: -3.0, ry: 0.4, good: 'timber', n: 3 });
  }
  if (stage === 2) {
    // Centering under each bay not yet closed, the dome's under it while it rises.
    const done = f * 3.3;
    [-F.bay, 0, F.bay].forEach((x, b) => {
      if (done - b * 1.1 < 1) S.centering.push({ x, z: (F.z0 + F.z1) / 2, ry: 0, span: F.bay - 2 * F.t, rise: F.bay / 2 - F.t, depth: F.z1 - F.z0 - 2 * F.t, y: F.spring });
    });
    if (f * 1.25 < 1) S.centering.push({ x: C.x, z: C.z, dome: DOME.r - 0.1, y: DOME.foot });
    S.scaffolds.push({ x: C.x, z: C.z - C.R - 0.6, w: 3.2, d: 0.9, h: DOME.foot + 0.4, ry: Math.PI });
    S.scaffolds.push({ x: -3.0, z: F.z1 + 0.6, w: 3.6, d: 0.9, h: F.spring + 0.6, ry: 0 });
    S.cranes.push({ x: 5.6, z: -2.6, ry: -2.0, h: 9.0, kind: 'treadwheel' });
    S.piles.push({ x: -7.0, z: 2.0, ry: 0.15, good: 'marble', n: 3 }, { x: 7.2, z: 3.4, ry: -0.1, good: 'clay', n: 2 }, { x: -6.8, z: -2.6, ry: 0.3, good: 'marble', n: 2 });
  }
  if (stage === 3) {
    // The block done; scaffolds along the colonnades going up and at the vestibules.
    for (const s of [-1, 1]) S.scaffolds.push({ x: s * (PAL.cols - 0.7), z: 1.0, w: 6.0, d: 0.8, h: PAL.h + 0.4, ry: Math.PI / 2 });
    S.scaffolds.push({ x: 7.5, z: V.z1 + 0.05 - 0.6, w: 3.4, d: 0.8, h: V.eave + 0.5, ry: 0 });
    S.cranes.push({ x: 3.2, z: 7.6, ry: 0.6, h: 5.0, kind: 'shear' });
    S.piles.push({ x: -3.6, z: 2.3, ry: 0.05, good: 'marble', n: 2 }, { x: 3.8, z: -0.2, ry: 0.2, good: 'marble', n: 1 }, { x: -3.6, z: -2.4, ry: -0.2, good: 'stone', n: 1 });
  }
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
  list.push(man(0, 'read', [-3.6, 0.03, 7.2], 2.6, { dress: ['tunic:knee'], props: { L: 'tablet' } }));
  if (stage === 0) {
    list.push(man(1, 'hoe', [-2.0, 0.03, 2.9], 0.3, { props: { R: 'hoe' } }), man(2, 'hoe', [2.6, 0.03, 0.6], -2.4, { props: { R: 'hoe' } }));
    list.push(man(3, 'carry', [-6.4, 0.03, 2.6], 1.8, { props: { L: 'sack' }, route: { length: 4.0, speed: 0.8, pauseEnd: 3, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } }));
    list.push(man(4, 'hammer', [1.2, 0.03, -6.6], 0, { props: { R: 'hammer' } }));
  } else if (stage === 1) {
    const y = Math.max(0, Math.min(F.spring, F.spring * f + 1.0) - 1.4);
    list.push(man(1, 'hammer', [-1.6, y > 1 ? 1.4 : 0.03, F.z1 + 0.6], Math.PI, { props: { R: 'hammer' } }));
    list.push(man(2, 'carry', [-6.0, 0.03, 4.4], Math.PI * 0.85, { props: { L: 'sack' }, route: { length: 3.6, speed: 0.75, pauseEnd: 3, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } }));
    list.push(man(3, 'stir', [6.6, 0.03, 1.2], -1.6, {}));
    list.push(man(4, 'pump', [5.4, 0.03, -2.0], -2.2, {}));
  } else if (stage === 2) {
    list.push(man(1, 'hammer', [-3.0, F.spring + 0.6 - 1.4 + 1.4 * 0, F.z1 + 0.6], Math.PI, { props: { R: 'hammer' } }));
    list.push(man(2, 'carry', [6.2, 0.03, 0.4], Math.PI, { props: { L: 'sack' }, route: { length: 3.8, speed: 0.75, pauseEnd: 3, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } }));
    list.push(man(3, 'pump', [5.2, 0.03, -2.0], -2.0, {}));
    list.push(man(4, 'stir', [-6.4, 0.03, -1.0], 1.4, {}));
  } else {
    list.push(man(1, 'hammer', [-6.6, 0.03, -1.6], Math.PI / 2, { props: { R: 'hammer' } }), man(2, 'hammer', [6.8, 0.03, 3.4], -Math.PI / 2, { props: { R: 'chisel' } }));
    list.push(man(3, 'carry', [-3.2, 0.03, 2.4], Math.PI, { props: { L: 'sack' }, route: { length: 3.4, speed: 0.75, pauseEnd: 3, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } }));
    list.push(man(4, 'sweep', [4.2, 0.03, 0.8], 0.8, { props: { R: 'broom' } }));
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
 *            the walk; in each palaestra ball players at trigon, a man with
 *            his lead weights (halteres), a runner along the colonnade,
 *            bathers resting on the benches, the oil seller at his table;
 *            the stoker at the right furnace, the doorkeeper at a vestibule
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
  const fq = facets().find((q) => q.k === T.furnaces[0]);
  const fx = fq.x + Math.sin(fq.ry) * 1.2;
  const fz = fq.z + Math.cos(fq.ry) * 1.2;
  if (state === 'cold') {
    list.push({ ...stoker, clip: 'idle', at: [fx + 0.6, sand, fz - 0.3], ry: -2.2 });
    list.push({ ...door, clip: 'idle', at: [7.6, 0.05, V.z1 + 0.4], ry: 0.2 });
    return list;
  }
  list.push({ ...stoker, clip: 'sweep', props: { R: 'broom' }, at: [fx, sand, fz], ry: fq.ry + Math.PI });
  list.push({ ...door, clip: 'listen', at: [-7.0, 0.05, V.z1 + 0.45], ry: 0.3 });
  // The natatio: bathers to the waist (their feet on its floor), one sitting on the rim, his feet in the water.
  if (!ice) {
    list.push({ ...bare(0xa87452), hair: 'crop', clip: 'idle', at: [-2.2, 0.06, 7.0], ry: 0.6, seed: 610 });
    list.push({ ...bare(0xc8956c), hair: 'curls', clip: 'talk', at: [1.4, 0.06, 6.6], ry: -2.4, seed: 611 });
    list.push({ ...bare(0x8c5e40), hair: 'crop', beard: 'short', clip: 'listen', at: [0.8, 0.06, 7.4], ry: 2.3, seed: 612 });
    list.push({ ...bare(0xbf8b62), hair: 'curls', clip: 'swim', at: [-3.3, 0.06, 8.1], ry: Math.PI / 2, seed: 613, route: { length: 5.6, speed: 0.55, pauseEnd: 1, pauseStart: 1, clipEnd: 'idle', clipStart: 'idle', faceEnd: -Math.PI / 2, faceStart: Math.PI / 2 } });
  }
  list.push({ ...bare(0xb88560), hair: 'curls', clip: 'sit', at: [3.0, P.rim + 0.02 - SEAT_H, P.z0 + 0.18], ry: 0, seed: 614 });
  list.push({ body: 'f', dress: ['tunic:long', 'palla'], hair: 'bun', clip: 'talk', at: [-1.2, 0.06, 5.0], ry: Math.PI / 2, seed: 615, colours: { tunic: DYES.white, mantle: DYES.saffron } });
  list.push({ body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'listen', at: [-0.4, 0.06, 5.0], ry: -Math.PI / 2, seed: 616, colours: { tunic: DYES.sky } });
  // The palaestrae: trigon (three players passing the ball round a triangle), weights, a runner, the resting.
  for (const s of [-1, 1]) {
    const cx = s * 5.6;
    const tri = [[cx - 0.9, 1.6], [cx + 0.9, 1.6], [cx, 3.1]];
    tri.forEach(([x, z], i) => {
      const [nx, nz] = [cx - x, 2.1 - z];
      list.push({ ...bare([0xc8956c, 0xa87452, 0xd2a17a][i]), hair: i ? 'crop' : 'curls', clip: 'trigon', props: { R: 'ball' }, at: [x, sand, z], ry: Math.atan2(nx, nz), seed: 620 + i + (s > 0 ? 3 : 0), phase: i * 0.7 });
    });
    list.push({ ...bare(s > 0 ? 0x9a6a4a : 0xbf8b62), hair: 'crop', clip: 'halteres', props: { R: 'halter', L: 'halter' }, at: [s * 4.6, sand, -2.6], ry: s > 0 ? -2.6 : 2.6, seed: 630 + s });
    list.push({ ...bare(s > 0 ? 0xdcb08c : 0x8c5e40), hair: 'curls', clip: 'run', at: [s * 7.3, sand, -4.8], ry: 0, seed: 632 + s, route: { length: 10.2, speed: 2.4, pauseEnd: 2, pauseStart: 3, clipEnd: 'idle', clipStart: 'idle' } });
    // (The benches by the wall: their tops SEAT_H over the colonnade's floor.)
    list.push({ ...bare(0xa87452), hair: 'crop', clip: 'sit', at: [s * (PAL.wall - 0.6), 0.12, 0.3], ry: -s * Math.PI / 2, seed: 634 + s });
  }
  // The oil seller at his table of jars under the left colonnade, a bather buying.
  list.push({ body: 'm', dress: ['tunic:knee'], hair: 'curls', beard: 'short', clip: 'give', props: { R: 'jar' }, at: [-(PAL.wall - 0.75), 0.12, 4.6], ry: Math.PI / 2, seed: 637, colours: { tunic: DYES.ochre } });
  list.push({ ...bare(0xc8956c), hair: 'crop', clip: 'count', at: [-(PAL.cols - 0.2), sand, 4.6], ry: -Math.PI / 2, seed: 638 });
  return list;
}

// ---------------------------------------------------------------------------
// The build
// ---------------------------------------------------------------------------

const KEYS = ['earth', 'trench', 'flags', 'sand', 'floor', 'core', 'brick', 'plaster', 'red', 'signinum', 'trav', 'marble', 'cipollino', 'cols', 'tile', 'wood', 'dark',
  'letters', 'bronze', 'lead', 'logs', 'blue', 'water', 'ice', 'stain', 'leaves', 'stream', 'labrumWater', 'cisternWater', 'glass', 'glassDark', 'vents', 'coalsLit', 'coalsCold', 'charcoal',
  'coldVault', 'warmVault', 'vaultBare', 'rubble', 'soot', 'statueBronze', 'statue_marble'];

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
  ground(lod, seed, out, stage, f);
  foundations(lod, seed + 10, out, stage, f);
  frigidarium(lod, seed + 20, out, stage, f, done);
  tepidarium(lod, seed + 40, out, stage, f);
  caldarium(lod, seed + 60, out, stage, f);
  furnaces(lod, seed + 80, out, stage);
  natatio(lod, seed + 100, out, stage, f, ice, done);
  parapet(lod, seed + 120, out, stage, f);
  for (const s of [-1, 1]) {
    vestibule(lod, seed + 140 + s, out, stage, f, s, sacked);
    palaestra(lod, seed + 160 + s, out, stage, f, s, sacked);
  }
  yards(lod, seed + 180, out, stage, f);
  if (done && !sacked) {
    statues(lod, out);
    bronzes(lod, out);
  }
  if (sacked) sackedParts(lod, seed + 200, out);
  const m = healthMaterials();
  if (lod === 2) {
    // Far out: small things under a pixel join the parts there are anyway, or go.
    out.trav.push(...out.floor.splice(0));
    out.letters = out.lead = out.leaves = out.labrumWater = out.stream = out.charcoal = out.vents = [];
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
  p.add('brick', m.brick, out.brick);
  p.add('walls', m.plaster, out.plaster);
  p.add('dado', m.red, out.red, small);
  p.add('terrace', m.signinum, out.signinum);
  p.add('stone', m.trav, out.trav);
  p.add('marble', m.marble, out.marble);
  // The façade's columns of cipollino (a green-veined marble from Euboea, the great baths' favourite).
  p.add('cipollino', material('cipollino', { surface: 'marble', color: 0xb8c8b0, vertexColors: true, snow: 1 }), out.cipollino);
  p.add('columns', m.marble, out.cols);
  p.add('roof', m.tile, [...out.tile, ...out.vents]);
  p.add('wood', m.wood, out.wood);
  p.add('inside', m.dark, out.dark, small);
  p.add('letters', m.letters, out.letters, small);
  p.add('bronze', m.bronze, [...out.bronze, ...out.lead, ...out.statueBronze], small);
  p.add('statues', m.marble, out.statue_marble);
  p.add('firewood', ruralMaterials().bark, out.logs);
  // The vaults: rendered in lime; the hot rooms' melt the snow while the fire is in (balneum.js's two
  // materials, shared); the cold hall's keeps it; bare concrete while the site turns them.
  const render = { surface: 'limestone', color: 0xe6c8b6, vertexColors: true };
  p.add('vaults', material('vault-render', { ...render, snow: 1 }), out.coldVault);
  p.add('vaults-hot', material('vault-render', { ...render, snow: 1 }), out.warmVault, { when: done ? 'cold' : 'always' });
  if (done) p.add('vaults-hot', material('vault-render-warm', { ...render, snow: 0.12 }), out.warmVault.map((g) => g.clone()), { when: 'flow' });
  p.add('vaults-bare', m.core, out.vaultBare);
  // The pools: the painted inside, the water or ice, a dry one's leaves and stain.
  p.add('pool-paint', material('pool-blue', { surface: 'plaster', color: 0x7aa8b8, vertexColors: true, snow: 0.6 }), out.blue, small);
  if (ice) p.add('pool-water', iceMaterial(), out.ice, { when: 'full', cast: false });
  else p.add('pool-water', shallowWaterMaterial(), out.water, { when: 'full', cast: false });
  p.add('cistern-water', ice ? iceMaterial() : shallowWaterMaterial(), out.cisternWater, { when: 'full', cast: false });
  p.add('labrum-water', ice ? iceMaterial() : shallowWaterMaterial(), out.labrumWater, { when: 'full', cast: false });
  p.add('leaves', m.soil, out.leaves, { when: 'dry', cast: false });
  p.add('stain', m.stain, out.stain, { when: 'dry', cast: false });
  p.add('stream', streamMaterial(), out.stream, { when: 'flow', cast: false });
  // The windows: lit from within while the fire is in (the lanterns' horn, which the night lights); dark glass otherwise.
  const darkGlass = material('bath-glass-dark', { color: 0x3a3430, roughness: 0.25, snow: 0 });
  if (done) {
    p.add('window', lanternPane(), out.glass, { when: 'flow', cast: false });
    p.add('window', darkGlass, out.glassDark, { when: 'cold', cast: false });
  } else {
    p.add('window', darkGlass, out.glassDark, { cast: false });
  }
  if (done) p.add('coals', m.embers, out.coalsLit, { when: 'flow', cast: false });
  p.add('coals', m.ash, out.coalsCold, { when: done ? 'cold' : 'always', cast: false });
  p.add('charcoal', m.dark, out.charcoal, small);
  p.add('rubble', m.core, out.rubble);
  p.add('soot', material('soot', { color: 0x15110e, roughness: 1, opacity: 0.55, snow: 0, wet: 0 }), out.soot, small);
  if (done && !sacked && lod < 2) {
    for (const [lx, ly, lz] of THERMAE_LAMPS) {
      const l = lantern(lx, ly, lz, lod);
      p.add('lantern', m.bronze, [...l.bronze, staff([lx, ly + 0.3, lz], [lx, ly + 0.55, lz - 0.2], 0.012, 4)], small);
      p.add('lamp', lanternPane(), [l.pane], { when: 'flow', cast: false });
      p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'cold', cast: false });
    }
  }
  if (done && !sacked) {
    // Smoke from the furnaces' flues and the drum's vents while the fire is in; in a hard frost steam
    // from the oculus, the windows and the vents. (At every level: the program compiled with the rest.)
    const smoke = [lin(0x8a8580), lin(0x77716a)];
    const rows = lod === 2 ? 3 : lod ? 5 : 8;
    const vents = lod < 2 ? [3, 7, 10, 12] : [7];
    p.add('smoke', steamMaterial(), vents.map((k, i) => {
      const [x, y, z] = ventAt(k);
      return plume(x, y, z, { h: 1.8, r: 0.12, n: 3, seed: 30 + i, rows, rgb: smoke[i % 2], alpha: 0.85, lean: [-0.6, 0.35] });
    }), { when: 'flow', cast: false });
    const steam = [plume(C.x, DOME.foot + DOME.rise + 0.1, C.z, { h: 2.6, r: 0.32, n: 3, seed: 40, rows, alpha: 1, lean: [0.5, 0.4] })];
    if (lod < 2) {
      for (const k of [5, 8, 11]) {
        const th = ((k + 0.5) / C.n) * Math.PI * 2;
        steam.push(plume(C.x + Math.sin(th) * (C.R + 0.05), 4.2, C.z + Math.cos(th) * (C.R + 0.05), { h: 1.5, r: 0.18, n: 3, seed: 41 + k, rows, alpha: 0.85, lean: [Math.sin(th) * 0.5, Math.cos(th) * 0.5] }));
      }
      for (const x of [-F.bay, F.bay]) steam.push(plume(x, F.spring + 1.1, F.z1 + 0.1, { h: 1.2, r: 0.16, n: 3, seed: 50 + x, rows, alpha: 0.7, lean: [0.2, 0.5] }));
      steam.push(plume(0, P.water + 0.05, 7.2, { h: 0.9, r: 0.9, n: 2, seed: 60, rows, alpha: 0.45, lean: [0.3, 0.2] }));
    }
    p.add('steam', steamMaterial(), steam, { when: 'ice', cast: false });
  }
  // The site's dressing (models/worksite.js) in the site's own kit.
  if (!done) addSite(p, thermaeSite(stage, f, work), lod);
  return p.build();
}

/** The baths' lanterns (x, y, z): at the vestibules' street doors, facing the street; lit while they work. */
export const THERMAE_LAMPS = Object.freeze([
  Object.freeze([-7.0 - 0.95, 2.35, V.z1 + 0.22]), Object.freeze([-7.0 + 0.35, 2.35, V.z1 + 0.22]),
  Object.freeze([7.0 + 0.95 - 0.7, 2.35, V.z1 + 0.22]), Object.freeze([7.0 + 1.25, 2.35, V.z1 + 0.22]),
]);
