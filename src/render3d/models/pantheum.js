/**
 * models/pantheum.js
 * ----------------------------------------------------------------------------
 * The Pantheon (pantheum) of the 3D look on its 5 x 5 footprint (20 m), from
 * Hadrian's building as it stands in Rome (rebuilt about AD 118 to 125 on
 * Agrippa's site, his name kept on the frieze), not from the 2D sprite:
 *
 *   - The portico: sixteen monolithic granite columns with Corinthian
 *     capitals and bases of white marble, eight across the front in grey
 *     granite from Mons Claudianus, two groups of four behind in the red
 *     granite of Aswan, dividing it into a wide middle aisle to the great
 *     bronze doors and two side aisles ending in apses where Augustus and
 *     Agrippa stood; the entablature with M AGRIPPA L F COS TERTIVM FECIT
 *     in bronze letters; the pediment, where holes show a bronze eagle and
 *     wreath were fixed; a tiled roof.
 *   - The intermediate block between the portico and the rotunda, taller
 *     than the portico, a second pediment showing over the first (the
 *     "ghost" pediment: the portico was built lower than first meant).
 *   - The rotunda: a drum of brick-faced concrete in three zones divided by
 *     cornices, relieving arches of brick in its face over the voids in the
 *     wall; on it the stepped rings that buttress the dome's foot; the dome
 *     itself, in courses of ever lighter concrete, sheathed in gilt bronze
 *     tiles (stripped in 663, the lead after them is today's) to the oculus,
 *     nine metres across in Rome, its bronze rim. Inside, a sphere would
 *     touch the floor: the coffered dome over the drum, the light from the
 *     oculus falling on the floor.
 *   - The forecourt: a long square closed by colonnades on its sides
 *     (excavated in front of the portico), paved in travertine.
 *
 * In 20 m: the rotunda 12 m across at the back, the block, a portico of 9.6
 * m, the forecourt's colonnades down both sides to the street. Built in
 * five stages (data/monuments.js pantheum), read as a timeline `t` from 0
 * to 5: the ring and the portico's foundations (0); the drum rising, its
 * relieving arches, the block (1); the columns, the entablature, the
 * pediment and the roof (2); the stepped rings and the dome in courses up
 * to the oculus on its centering (3); the bronze tiles, the doors, the
 * letters, the forecourt and its colonnades (4).
 *
 * States (models.js partShows tags): 'open' (staffed and working: the doors
 * open, the lampstands lit, people in the portico), 'shut' (the doors shut).
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry } from 'three';
import { boxUV, tintGeometry, revolve, tube } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, TaggedParts } from './masonry.js';
import { column, gable, gableTri, rake, letters, textWidth, doubleDoor, slope } from './domus.js';
import { sacraMaterials, box, D, lin } from './sacra.js';
import { hearthFire } from './sacra.js';
import { DYES } from '../people/actors.js';
import { artRng } from '../texgen.js';

/** The Pantheon's measures (metres): the game, the lab and the tests read them. */
export const PANTHEUM = Object.freeze({
  half: 10,
  /** The floor of the portico and the rotunda (the steps' top). */
  floorY: 0.6,
  /** The rotunda: its middle's z, its outer radius, the wall's thickness, the drum's top outside. */
  rot: Object.freeze({ z: -3.65, r: 6.0, wall: 1.25, top: 5.8, zones: Object.freeze([2.6, 4.4]) }),
  /** The stepped rings on the dome's foot: their radii and the height of each. */
  rings: Object.freeze({ r: Object.freeze([5.75, 5.55, 5.35, 5.15, 4.95, 4.75]), step: 0.225 }),
  /** The dome's outside: a sphere's cap (centre y, radius) from the rings' top to the oculus (its radius). */
  dome: Object.freeze({ cy: 5.397, R: 5.063, oculus: 1.05 }),
  /** The block between portico and rotunda: half width, its front z, its top. */
  block: Object.freeze({ hw: 4.75, z0: 1.4, z1: 3.4, top: 6.2 }),
  /** The portico: half width, from the block's front to its front z; the columns' height; the entablature's. */
  porch: Object.freeze({ hw: 4.85, z0: 3.4, z1: 7.6, colH: 3.9, ent: 0.85, pitch: D(23) }),
  /** The steps up to the portico: their foot's z and number. */
  steps: Object.freeze([8.5, 4]),
  /** The forecourt's colonnades: the columns' x, the wall's x, from z0 to z1, their height. */
  fore: Object.freeze({ col: 6.35, wall: 9.65, z0: -0.4, z1: 9.4, colH: 2.8, n: 8 }),
  /** The door: half width, height over the floor. */
  door: Object.freeze([0.85, 3.3]),
});

const P = PANTHEUM;
const R = P.rot;
const RIN = R.r - R.wall;
/** The inside's sphere: centre y (the springing), radius. */
const INNER = Object.freeze({ cy: P.floorY + RIN, r: RIN });

/** The portico's columns: [x, z, ry, shade] (the front row grey, the two groups of four behind red). */
export const PANTHEUM_COLUMNS = Object.freeze((() => {
  const front = [-4.2, -3.0, -1.8, -0.6, 0.6, 1.8, 3.0, 4.2];
  const out = front.map((x) => Object.freeze([x, 7.15, 0, 'grey']));
  for (const z of [5.75, 4.35]) for (const x of [-4.2, -1.8, 1.8, 4.2]) out.push(Object.freeze([x, z, 0, 'pink']));
  return out;
})());

/** The forecourt colonnades' columns [x, z] (on the ground). */
export const FORE_COLUMNS = Object.freeze((() => {
  const F = P.fore;
  const out = [];
  for (const s of [-1, 1]) for (let i = 0; i < F.n; i++) out.push(Object.freeze([s * F.col, F.z0 + 0.4 + (i * (F.z1 - F.z0 - 0.8)) / (F.n - 1)]));
  return out;
})());

/** When each part is built on the timeline (stage units): [start, end]. */
export const PANTHEUM_TIMES = Object.freeze({
  trench: [0, 0.3],
  footing: [0.2, 1.0],
  podium: [0.6, 1.0],
  drum: [1.0, 1.95],
  block: [1.3, 2.0],
  columns: [2.0, 2.55],
  entablature: [2.5, 2.75],
  roof: [2.7, 3.0],
  rings: [3.0, 3.2],
  dome: [3.2, 3.95],
  tiles: [4.0, 4.35],
  fore: [4.1, 4.7],
  finish: [4.3, 4.6],
});

/** How far part `k` is along at `t`: 0 not begun, 1 done. */
export function pgrow(t, k) {
  const [a, b] = PANTHEUM_TIMES[k];
  return Math.max(0, Math.min(1, (t - a) / (b - a)));
}

/** How many of the portico's columns stand at `t` (the front row first). */
export function pantheumColumnsAt(t) {
  return Math.round(pgrow(t, 'columns') * PANTHEUM_COLUMNS.length);
}

/** The lamps: the two bronze lampstands either side of the doors, facing the street. */
export const PANTHEUM_LAMPS = Object.freeze([-1, 1].map((s) => Object.freeze([s * 1.5, P.floorY + 1.75, P.block.z1 + 0.45, 1])));

// ---------------------------------------------------------------------------
// The materials
// ---------------------------------------------------------------------------

/** The Pantheon's materials: the temples' (sacra.js), the granites, the concrete, the bronze tiles. */
export function pantheumMaterials() {
  const m = sacraMaterials();
  return {
    ...m,
    // Granite: the grey lava's speckled grain, tinted (Mons Claudianus's grey, Aswan's red).
    grey: material('granite-grey', { surface: 'lava', color: 0xcfcfd2, rough: 0.8, vertexColors: true, snow: 0.8 }),
    pink: material('granite-pink', { surface: 'lava', color: 0xe8a894, rough: 0.8, vertexColors: true, snow: 0.8 }),
    concrete: material('roman-concrete', { surface: 'cocciopesto', color: 0xbdb4a6, vertexColors: true, snow: 1 }),
    // The dome's gilt bronze tiles, mellowed (gold leaf over bronze, weathered).
    tiles: material('dome-bronze', { surface: 'bronze', color: 0xd8b878, rough: 0.75, vertexColors: true, snow: 0.6 }),
    // The inside's stucco, its coffers in its vertices; no snow falls inside (but under the oculus).
    inside: material('pantheon-inside', { surface: 'stucco', color: 0xe8e0d0, vertexColors: true, snow: 0 }),
  };
}

// ---------------------------------------------------------------------------
// The rotunda
// ---------------------------------------------------------------------------

/** A ring wall (annulus) from radius r0 to r1, y0 to y1, `seg` sides, as one solid: outer, top, inner (no foot). */
function ringWall(r0, r1, y0, y1, seg, tint = 0.95) {
  return revolve([[r1, y0], [r1, y1], [r1, y1], [r0, y1], [r0, y1], [r0, y0]], { segments: seg, metres: 1, tint: () => tint });
}

/** The drum up to height `h` (outside), with its cornices and relieving arches once its zones are built. */
function drum(out, t, lod, seed) {
  const g = pgrow(t, 'drum');
  if (g <= 0) return;
  const seg = lod === 2 ? 24 : lod ? 48 : 96;
  const y0 = P.floorY;
  const top = y0 + (R.top - y0) * g;
  // The brick face outside, the core's top while it rises, the inside's wall.
  const outer = revolve([[R.r, y0], [R.r, top]], { segments: seg, metres: 0.96, tint: (p) => 0.9 + 0.1 * Math.min(1, (p.y - y0) / 2) });
  out.brick.push(outer.translate(0, 0, R.z));
  out.concrete.push(revolve([[R.r, top], [RIN, top]], { segments: seg, metres: 1, tint: () => 0.85 }).translate(0, 0, R.z));
  out.inside.push(revolve([[RIN, top], [RIN, y0]], { segments: seg, metres: 1, tint: () => 0.55 }).translate(0, 0, R.z));
  // The plinth round its foot, the cornices dividing its zones once the wall is past them.
  out.trav.push(ringWall(R.r - 0.02, R.r + 0.14, 0, y0 + 0.25, seg, 0.88).translate(0, 0, R.z));
  for (const zy of [...R.zones, R.top]) {
    if (top < zy - 0.01) continue;
    const prof = zy === R.top
      ? [[R.r - 0.05, zy - 0.3], [R.r + 0.1, zy - 0.3], [R.r + 0.12, zy - 0.18], [R.r + 0.24, zy - 0.08], [R.r + 0.26, zy], [R.r - 0.05, zy]]
      : [[R.r - 0.05, zy - 0.16], [R.r + 0.08, zy - 0.16], [R.r + 0.14, zy - 0.04], [R.r + 0.16, zy], [R.r - 0.05, zy]];
    out.trav.push(revolve(prof, { segments: seg, metres: 1, tint: () => 0.95 }).translate(0, 0, R.z));
  }
  // Relieving arches in the brick over the wall's hidden voids: arcs a little proud, in each zone.
  if (lod === 0) {
    const levels = [[y0 + 1.6, 0.9, 16], [R.zones[0] + 1.05, 0.8, 16], [R.zones[1] + 0.8, 0.75, 16]];
    levels.forEach(([yb, w, n], li) => {
      if (top < yb + w / 2 + 0.05) return;
      for (let k = 0; k < n; k++) {
        const phi = ((k + 0.5 * (li % 2)) / n) * Math.PI * 2;
        const pts = [];
        for (let j = 0; j <= 8; j++) {
          const a = (j / 8) * Math.PI;
          const ph = phi + (Math.cos(a) * w * 0.5) / R.r;
          pts.push([Math.sin(ph) * (R.r + 0.015), yb + Math.sin(a) * w * 0.5, R.z + Math.cos(ph) * (R.r + 0.015)]);
        }
        out.brickArch.push(tube(pts, 0.05, { radial: 4, segments: 10, around: 0.2 }));
      }
    });
  }
  void seed;
}

/** The stepped rings on the dome's foot, and the dome in courses up to the oculus. */
function dome(out, t, lod) {
  const seg = lod === 2 ? 24 : lod ? 48 : 96;
  const z = R.z;
  const rg = pgrow(t, 'rings');
  if (rg > 0) {
    // The rings: steps of concrete, rendered, each a little in from the one below.
    let y = R.top;
    const n = Math.max(1, Math.round(P.rings.r.length * rg));
    for (let i = 0; i < n; i++) {
      const r = P.rings.r[i];
      const ny = y + P.rings.step;
      out.stucco.push(revolve([[r, y], [r, ny], [r, ny], [RIN - 0.1, ny]], { segments: seg, metres: 1, tint: () => 0.92 - i * 0.012 }).translate(0, 0, z));
      y = ny;
    }
    // (The inside: the sphere from the springing to the rings' top, its coffers below.)
  }
  const dg = pgrow(t, 'dome');
  const yRings = R.top + P.rings.r.length * P.rings.step;
  const finished = pgrow(t, 'tiles');
  const { cy, R: RO, oculus } = P.dome;
  const yTopOut = cy + Math.sqrt(RO * RO - oculus * oculus);
  const yTopIn = INNER.cy + Math.sqrt(INNER.r * INNER.r - (oculus - 0.05) ** 2);
  const ringsTop = P.rings.r[P.rings.r.length - 1];
  if (dg <= 0 && rg < 1) {
    insideDome(out, Math.min(yRings, INNER.cy + 0.6), seg, z, lod);
    return;
  }
  // The courses' top: the outside's height reached.
  const yT = dg > 0 ? yRings + (yTopOut - yRings) * dg : yRings;
  const rows = lod === 2 ? 6 : lod ? 12 : 24;
  const outerPts = [];
  for (let k = 0; k <= rows; k++) {
    const y = yRings + ((Math.min(yT, yTopOut) - yRings) * k) / rows;
    const r = k === 0 ? ringsTop : Math.sqrt(Math.max(0, RO * RO - (y - cy) ** 2));
    outerPts.push([Math.max(oculus, Math.min(ringsTop, r)), y]);
  }
  const whole = dg >= 1;
  // The outer face: bronze tiles once tiled, the concrete before.
  if (dg > 0) {
    const tiled = finished > 0;
    const outerGeo = revolve(outerPts, {
      segments: seg,
      metres: tiled ? 0.6 : 1,
      tint: (p) => (tiled ? 0.82 + 0.18 * Math.min(1, (p.y - yRings) / 2.5) : 0.9),
    }).translate(0, 0, z);
    (tiled ? out.tiles : out.concrete).push(outerGeo);
    // The courses' top while it rises: across to the inside.
    if (!whole) {
      const yi = Math.min(yT, yTopIn);
      const ri = Math.sqrt(Math.max(0, INNER.r * INNER.r - (yi - INNER.cy) ** 2));
      const ro = outerPts[outerPts.length - 1][0];
      out.concrete.push(revolve([[ro, yT], [ri, yi]], { segments: seg, metres: 1, tint: () => 0.8 }).translate(0, 0, z));
      insideDome(out, yi, seg, z, lod);
    } else {
      // The oculus: its wall down through the shell, a bronze rim round it.
      out.concrete.push(revolve([[oculus, yTopOut], [oculus - 0.05, yTopIn]], { segments: seg, metres: 1, tint: () => 0.7 }).translate(0, 0, z));
      out.bronze.push(revolve([[oculus + 0.06, yTopOut - 0.02], [oculus + 0.06, yTopOut + 0.1], [oculus - 0.02, yTopOut + 0.1], [oculus - 0.02, yTopOut - 0.02]], { segments: seg, metres: 0.3 }).translate(0, 0, z));
      insideDome(out, yTopIn, seg, z, lod);
      // The tiles' courses and their ribs (close up).
      if (tiled && lod === 0) {
        for (let k = 0; k < 32; k++) {
          const a = (k / 32) * Math.PI * 2;
          const pts = outerPts.filter((_, i) => i % 3 === 0 || i === outerPts.length - 1).map(([r, y]) => [Math.sin(a) * (r + 0.02), y + 0.01, z + Math.cos(a) * (r + 0.02)]);
          out.tiles.push(tube(pts, 0.035, { radial: 4, segments: pts.length * 2, around: 0.2 }));
        }
      }
    }
  }
  void lod;
}

/** The inside of the dome from the springing up to y: the coffers in five rings of 28 (their shade in the vertices), the drum's inside below. */
function insideDome(out, yTo, seg, z, lod) {
  if (lod === 2) return;
  const rows = lod ? 10 : 20;
  const pts = [];
  const y0 = INNER.cy;
  for (let k = rows; k >= 0; k--) {
    const y = y0 + ((yTo - y0) * k) / rows;
    pts.push([Math.sqrt(Math.max(0, INNER.r * INNER.r - (y - y0) ** 2)), y]);
  }
  // (Walked from the top down: the solid is outside, the face looks in.)
  const g = revolve(pts, {
    segments: seg,
    metres: 1,
    tint: (p, th) => {
      const lat = (p.y - y0) / INNER.r;
      const coffer = lat < 0.82 && Math.cos(th * 28) > 0.2 && Math.sin(lat * Math.PI * 6.1) > -0.1;
      return coffer ? 0.42 : 0.6;
    },
  });
  out.inside.push(g.translate(0, 0, z));
}

// ---------------------------------------------------------------------------
// The block and the portico
// ---------------------------------------------------------------------------

function block(out, t, lod, seed) {
  const g = pgrow(t, 'block');
  if (g <= 0) return;
  const B = P.block;
  const y0 = P.floorY;
  const h = (B.top - y0) * g;
  const [dw, dh] = P.door;
  // Its walls: brick, the door's opening in its front, the front stuccoed in marble's white.
  out.brick.push(box(0.6, h, B.z1 - B.z0, -B.hw + 0.3, y0, (B.z0 + B.z1) / 2));
  out.brick.push(box(0.6, h, B.z1 - B.z0, B.hw - 0.3, y0, (B.z0 + B.z1) / 2));
  out.brick.push(box(2 * B.hw - 1.2, h, B.z1 - B.z0 - 0.7, 0, y0, (B.z0 + B.z1 - 0.7) / 2));
  // The front: either side of the door, over it once the wall passes the lintel.
  for (const s of [-1, 1]) out.marble.push(box(B.hw - dw, h, 0.7, s * (dw + (B.hw - dw) / 2), y0, B.z1 - 0.35));
  if (h > dh) out.marble.push(box(2 * dw, h - dh, 0.7, 0, y0 + dh, B.z1 - 0.35));
  out.dark.push(box(2 * dw, Math.min(h, dh), 0.05, 0, y0, B.z1 - 0.7));
  if (g < 1) return;
  // The cornices continuing the drum's, the top's cornice, the ghost pediment over the portico's roof.
  for (const zy of [...R.zones, R.top]) out.trav.push(box(2 * B.hw + 0.24, 0.16, B.z1 - B.z0 + 0.12, 0, zy - 0.16, (B.z0 + B.z1) / 2 + 0.06, 0.95));
  out.trav.push(box(2 * B.hw + 0.3, 0.22, B.z1 - B.z0 + 0.16, 0, B.top - 0.22, (B.z0 + B.z1) / 2 + 0.08, 0.97));
  const rise = (B.hw + 0.15) * Math.tan(P.porch.pitch);
  out.marble.push(gableTri(-B.hw, B.hw, B.z1 - 0.05, 0.5, B.top, B.top + rise));
  for (const s of [-1, 1]) out.trav.push(rake(s * (B.hw + 0.2), B.top - 0.02, 0, B.top + rise + 0.12, B.z1 + 0.03, 0.3, 0.18, 0.96));
  const r = gable({ x0: -B.hw, x1: B.hw, z0: B.z0 + 0.2, z1: B.z1 - 0.1, eaveY: B.top, pitch: P.porch.pitch, along: 'z', lod, seed: seed + 9, over: 0.2, gableOver: 0.05 });
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  // The marble frame of the doors; the apses in the side aisles' ends with their statues (Augustus, Agrippa).
  out.marble.push(box(0.26, dh + 0.1, 0.16, -dw - 0.13, y0, B.z1 + 0.04, 0.98));
  out.marble.push(box(0.26, dh + 0.1, 0.16, dw + 0.13, y0, B.z1 + 0.04, 0.98));
  out.marble.push(box(2 * dw + 0.6, 0.3, 0.2, 0, y0 + dh + 0.05, B.z1 + 0.05, 0.98));
  if (lod < 2) {
    for (const s of [-1, 1]) {
      const x = s * 3.0;
      out.dark.push(box(1.3, 2.6, 0.04, x, y0 + 0.5, B.z1 + 0.005));
      const body = revolve([[0.22, 0], [0.23, 0.1], [0.2, 0.7], [0.17, 1.05], [0.21, 1.28], [0.22, 1.42], [0.16, 1.52], [0.05, 1.57], [0, 1.57]], { segments: lod ? 8 : 12, metres: 0.5 });
      out.statueBronze.push(body.scale(1.05, 1.05, 0.8).translate(x, y0 + 0.55, B.z1 + 0.25));
      out.statueBronze.push(tintGeometry(boxUV(new SphereGeometry(0.115, lod ? 7 : 10, 6).scale(0.92, 1.12, 1).translate(x, y0 + 0.55 + 1.75, B.z1 + 0.25))));
      out.marble.push(slab(0.7, 0.55, 0.6, { bevel: 0.015, seed: seed + s, wobble: 0, tone: 0, grime: 0.1 }).translate(x, y0, B.z1 + 0.25));
    }
  }
}

/** The portico's podium and steps, its entablature with the dedication, its pediment and roof. */
function portico(out, t, lod, seed) {
  const C = P.porch;
  const y0 = P.floorY;
  const po = pgrow(t, 'podium');
  if (po > 0) {
    out.trav.push(box(2 * C.hw + 0.2, y0 * po, C.z1 - C.z0 + 0.2, 0, 0, (C.z0 + C.z1) / 2 + 0.1));
    if (po >= 1) {
      const [sz, n] = P.steps;
      const rise = y0 / n;
      const tread = (sz - C.z1 - 0.1) / n;
      for (let i = 0; i < n; i++) {
        const zf = sz - i * tread;
        out.trav.push(slab(2 * C.hw + 0.2, (i + 1) * rise, zf - (C.z1 + 0.1) + 0.02, { bevel: 0.012, seed: seed + i, wobble: lod ? 0 : 0.002, tone: 0.04, grime: 0.25 }).translate(0, 0, (zf + C.z1 + 0.1) / 2));
      }
      // The portico's floor of marble (under the roof: no snow).
      out.floor.push(...paving(-C.hw, C.hw, C.z0, C.z1, 0.02, seed + 30, { rowW: 0.8, minL: 0.8, maxL: 1.3, lod, tone: 0.05, grime: 0.04 }).map((g) => g.translate(0, y0, 0)));
    }
  }
  const en = pgrow(t, 'entablature');
  const AB = y0 + C.colH;
  if (en > 0) {
    const h = C.ent * Math.min(1, en * 1.4);
    out.marble.push(box(2 * C.hw + 0.1, h, 0.5, 0, AB, C.z1 - 0.2));
    for (const s of [-1, 1]) out.marble.push(box(0.5, h, C.z1 - C.z0 - 0.5, s * (C.hw - 0.2), AB, (C.z0 + C.z1 - 0.5) / 2));
    // The beams over the middle aisle's columns, back to the block.
    for (const x of [-1.8, 1.8]) out.marble.push(box(0.42, h * 0.6, C.z1 - C.z0 - 0.5, x, AB, (C.z0 + C.z1 - 0.5) / 2, 0.9));
  }
  const ro = pgrow(t, 'roof');
  if (ro > 0 && en >= 1) {
    const top = AB + C.ent;
    const hw = C.hw + 0.15;
    const rise = hw * Math.tan(C.pitch);
    if (ro < 1) {
      out.wood.push(box(0.18, 0.18, C.z1 - C.z0, 0, top + rise - 0.25, (C.z0 + C.z1) / 2, 0.8));
      for (let z = C.z0 + 0.3; z <= C.z1; z += 0.8) for (const s of [-1, 1]) out.wood.push(rake(0, top + rise - 0.2, s * hw, top, z, 0.12, 0.14, 0.8));
    } else {
      // The pediment: the tympanum set back, the raking cornices, its bronze eagle and wreath.
      out.marble.push(gableTri(-hw + 0.1, hw - 0.1, C.z1 - 0.1, 0.3, top, top + rise - 0.08));
      for (const s of [-1, 1]) out.trav.push(rake(s * (hw + 0.2), top - 0.04, 0, top + rise + 0.1, C.z1 + 0.04, 0.4, 0.2, 0.97));
      out.marble.push(box(2 * hw + 0.3, 0.16, 0.5, 0, top - 0.04, C.z1 - 0.15, 0.98));
      const r = gable({ x0: -hw, x1: hw, z0: C.z0 + 0.05, z1: C.z1 + 0.05, eaveY: top + 0.1, pitch: C.pitch, along: 'z', lod, seed: seed + 60, over: 0.25, gableOver: 0.18 });
      out.tile.push(...r.tile);
      out.wood.push(...r.wood);
      if (lod < 2) {
        const ey = top + rise * 0.42;
        out.gilt.push(tintGeometry(boxUV(new SphereGeometry(0.16, lod ? 6 : 10, 6).scale(1, 1, 0.5).translate(0, ey, C.z1 - 0.06))));
        for (const s of [-1, 1]) out.gilt.push(box(0.55, 0.1, 0.05, s * 0.32, ey + 0.05, C.z1 - 0.06).rotateZ(0));
        out.gilt.push(tube(Array.from({ length: 17 }, (_, k) => {
          const a = (k / 16) * Math.PI * 2;
          return [Math.cos(a) * 0.55, ey + Math.sin(a) * 0.38, C.z1 - 0.05];
        }), 0.035, { radial: 4, segments: 32, around: 0.2, closed: true }));
      }
    }
  }
  // The dedication in bronze letters on the frieze, with the last of the finishing.
  if (pgrow(t, 'finish') > 0 && en >= 1) {
    const text = 'M·AGRIPPA·L·F·COS·TERTIVM·FECIT';
    const hgt = Math.min(0.24, (2 * C.hw - 0.8) / Math.max(1, textWidth(text, 1)));
    const fy = AB + 0.36;
    if (lod === 0) out.gilt.push(...letters(text, fy, C.z1 + 0.06, hgt));
    else if (lod === 1) out.gilt.push(box(textWidth(text, hgt), hgt * 0.6, 0.008, 0, fy + 0.04, C.z1 + 0.06));
  }
}

/** The forecourt's paving and its colonnades down both sides (walls, architraves, lean-to roofs: the columns are a kit). */
function forecourt(out, t, lod, seed) {
  const g = pgrow(t, 'fore');
  const F = P.fore;
  if (g >= 1 || t >= 5) {
    // The square: travertine flags from the steps' foot and round the portico to the colonnades.
    out.paving.push(...paving(-F.col + 0.3, F.col - 0.3, P.steps[0], P.half - 0.05, 0.03, seed + 1, { rowW: 0.8, minL: 0.7, maxL: 1.2, lod, tone: 0.07, grime: 0.15 }));
    for (const s of [-1, 1]) out.paving.push(...paving(s > 0 ? P.porch.hw + 0.12 : -F.col + 0.3, s > 0 ? F.col - 0.3 : -P.porch.hw - 0.12, F.z0, P.steps[0], 0.03, seed + 2 + s, { rowW: 0.8, minL: 0.7, maxL: 1.2, lod, tone: 0.07, grime: 0.15 }));
  } else if (t >= 1) {
    out.earth.push(box(2 * P.half - 0.1, 0.02, P.half - F.z0, 0, -0.01, (P.half + F.z0) / 2, 0.8));
  }
  if (g <= 0) return;
  const wallH = F.colH + 0.9;
  for (const s of [-1, 1]) {
    const hw = Math.min(1, g * 1.6);
    out.stucco.push(box(0.3, wallH * hw, F.z1 - F.z0 + 0.3, s * F.wall, 0, (F.z0 + F.z1) / 2));
    out.stucco.push(box(Math.abs(F.wall - F.col) + 0.3, wallH * hw, 0.3, s * (F.wall + F.col) / 2, 0, F.z0 - 0.15));
    if (g < 0.6) continue;
    out.fresco.push(box(0.012, 0.9, F.z1 - F.z0, s * (F.wall - 0.156), 0, (F.z0 + F.z1) / 2, () => lin(0x6a2418, 1.2)));
    out.marble.push(box(0.36, 0.26, F.z1 - F.z0 + 0.2, s * F.col, F.colH, (F.z0 + F.z1) / 2, 0.95));
    out.marble.push(box(0.44, 0.08, F.z1 - F.z0 + 0.26, s * F.col, F.colH + 0.26, (F.z0 + F.z1) / 2, 0.98));
    if (g >= 1) {
      const hiY = wallH + 0.05;
      const loY = F.colH + 0.34;
      const xa = s * (F.wall + 0.2);
      const xb = s * (F.col - 0.45);
      const [za, zb] = xa > xb ? [F.z0 - 0.2, F.z1 + 0.2] : [F.z1 + 0.2, F.z0 - 0.2];
      const r = slope([[xb, loY, za], [xb, loY, zb], [xa, hiY, zb], [xa, hiY, za]], { lod, seed: seed + 10 + s });
      out.tile.push(...r.tile);
      out.wood.push(...r.wood);
    }
  }
}

/** The bronze doors (open or shut by the state), the lampstands and their flames. */
function doors(p, m, lod, seed) {
  const B = P.block;
  const [dw, dh] = P.door;
  const open = doubleDoor(0, B.z1 - 0.35, 2 * dw, dh, P.floorY, { open: true, lod, metal: true });
  const shut = doubleDoor(0, B.z1 - 0.35, 2 * dw, dh, P.floorY, { open: false, lod, metal: true });
  p.add('doors', m.bronze, open.bronze, { when: 'open' });
  p.add('doors', m.bronze, shut.bronze, { when: 'shut' });
  const stands = [];
  const flames = [];
  for (const [x, , z] of PANTHEUM_LAMPS) {
    stands.push(revolve([[0, 0], [0.16, 0], [0.17, 0.04], [0.08, 0.1], [0.04, 0.18], [0.03, 0.24], [0.026, 1.6], [0.05, 1.64], [0.035, 1.67], [0.15, 1.72], [0.16, 1.76], [0, 1.75]], { segments: lod === 2 ? 5 : lod ? 8 : 12, metres: 0.4 }).translate(x, P.floorY, z - 0.0));
    if (lod < 2) flames.push(...hearthFire([x, P.floorY + 1.74, z], 0.08, { lod: 1, seed: seed + x, big: 0.55 }).flames);
  }
  p.add('lampstands', m.bronze, stands, { cast: lod === 0 });
  if (flames.length) p.add('lamp', m.flame, flames, { when: 'open', cast: false });
}

/**
 * Build the Pantheon at timeline `t` (5 finished): { group, meshes,
 * triangles }, its meshes tagged in userData.when ('open', 'shut').
 */
export function buildPantheum(t, { lod = 0, seed = 1301 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['brick', 'brickArch', 'concrete', 'inside', 'stucco', 'trav', 'marble', 'floor', 'paving', 'tile', 'wood', 'tiles', 'bronze', 'gilt', 'dark', 'fresco', 'earth', 'statueBronze', 'core'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  // The foundations: the ring's trench and its concrete rising to the floor, the portico's.
  const tr = pgrow(t, 'trench');
  const fo = pgrow(t, 'footing');
  const seg = lod === 2 ? 24 : lod ? 48 : 96;
  if (tr > 0 && fo < 1) out.earth.push(box(2 * R.r + 2.4, 0.03, 18.4, 0, -0.015, -0.6, 0.72));
  if (fo > 0) {
    const h = P.floorY * fo;
    out.concrete.push(ringWall(RIN - 0.2, R.r + 0.15, -0.3, h, seg, 0.85).translate(0, 0, R.z));
    // The floor inside: marble once the drum is closed, the rough fill before.
    const disk = new CylinderGeometry(RIN - 0.15, RIN - 0.15, 0.04, seg, 1).translate(0, h - 0.02, R.z);
    out[fo >= 1 && t >= 2 ? 'inside' : 'concrete'].push(tintGeometry(boxUV(disk), (x, y, z) => (fo >= 1 && t >= 2 ? 0.8 + 0.2 * (((Math.floor((x + 50) / 1.1) + Math.floor((z + 50) / 1.1)) % 2)) : 0.8)));
  }
  drum(out, t, lod, seed);
  dome(out, t, lod);
  block(out, t, lod, seed + 100);
  portico(out, t, lod, seed + 200);
  forecourt(out, t, lod, seed + 300);
  const m = pantheumMaterials();
  const p = new TaggedParts('pantheum');
  const small = { cast: false };
  p.add('brick', m.brick, out.brick);
  if (out.brickArch.length) p.add('arches', m.brick, out.brickArch.map((g) => tintGeometry(g, () => 0.7)), small);
  p.add('concrete', m.concrete, out.concrete);
  if (out.inside.length) p.add('inside', m.inside, out.inside, small);
  p.add('stucco', m.stucco, out.stucco);
  p.add('dressings', m.trav, out.trav);
  p.add('marble', m.marble, out.marble);
  if (out.floor.length) p.add('floor', m.shelteredMarble, out.floor, small);
  if (out.paving.length) p.add('paving', m.trav, out.paving, small);
  p.add('roof', m.tile, out.tile);
  p.add('timber', m.wood, out.wood);
  if (out.tiles.length) p.add('tiles', m.tiles, out.tiles);
  if (out.bronze.length) p.add('bronze', m.bronze, out.bronze, small);
  if (out.gilt.length) p.add('gilt', m.gilt, out.gilt, small);
  if (out.dark.length) p.add('dark', m.dark, out.dark, small);
  if (out.fresco.length) p.add('fresco', m.fresco, out.fresco, small);
  if (out.earth.length) p.add('earth', material('beaten-earth', { surface: 'earth', vertexColors: true, snow: 1 }), out.earth, small);
  if (out.statueBronze.length) p.add('statues', m.statueBronze, out.statueBronze, { cast: lod === 0 });
  if (pgrow(t, 'finish') > 0) doors(p, m, lod, seed + 400);
  else if (pgrow(t, 'block') >= 1) p.add('dark-door', m.dark, [box(2 * P.door[0], P.door[1], 0.04, 0, P.floorY, P.block.z1 - 0.38)], small);
  return p.build();
}

/** A portico column: Corinthian, its shaft one piece of `shade` granite ('grey', 'pink') or marble ('fore', the forecourt's), standing on y 0. */
export function buildPantheumColumn(shade, { lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const m = pantheumMaterials();
  const h = shade === 'fore' ? P.fore.colH : P.porch.colH;
  const c = column('corinthian', h, lod, { smooth: shade !== 'fore' });
  const p = new TaggedParts(`pantheum-column-${shade}`);
  const shaft = c.stone.pop();
  p.add('base', m.marble, c.stone);
  p.add('shaft', shade === 'fore' ? m.marble : m[shade], [shaft]);
  p.add('capital', m.marble, c.cap);
  return p.build();
}

// ---------------------------------------------------------------------------
// The people and the site
// ---------------------------------------------------------------------------

/** The Pantheon's people at work: visitors in the portico and the forecourt, a priest at the doors, a boy with incense. */
export function pantheumActors(state) {
  if (state !== 'open') return [];
  const y = P.floorY + 0.03;
  const C = P.porch;
  return [
    { body: 'm', dress: ['tunic:long', 'toga:velato'], hair: 'bald', old: true, props: { R: 'patera' }, clip: 'pray', at: [0.0, y, P.block.z1 + 0.75], ry: Math.PI, seed: 401, colours: { tunic: DYES.white, mantle: DYES.candida } },
    { body: 'c', dress: ['tunic:knee', 'bulla'], hair: 'curls', props: { R: 'acerra' }, clip: 'hold', at: [0.55, y, P.block.z1 + 0.95], ry: Math.PI + 0.5, seed: 402, colours: { tunic: DYES.white, trim: DYES.white } },
    { body: 'm', dress: ['tunic:knee', 'toga'], hair: 'crop', clip: 'walk', at: [-0.6, y, C.z1 - 0.4], ry: Math.PI, seed: 403, colours: { mantle: DYES.candida }, route: { length: 2.4, speed: 0.6, pauseEnd: 6, pauseStart: 5, clipEnd: 'pray', clipStart: 'talk' } },
    { body: 'f', dress: ['tunic:long:stola', 'palla:veil'], hair: 'bun', clip: 'listen', at: [-3.0, y, 5.05], ry: 0.6, seed: 404 },
    { body: 'm', dress: ['tunic:knee'], hair: 'curls', clip: 'talk', at: [-2.5, y, 5.6], ry: -2.4, seed: 405 },
    { body: 'm', dress: ['tunic:knee', 'toga'], hair: 'crop', clip: 'orate', at: [3.1, y, 5.1], ry: -0.4, seed: 406, colours: { mantle: DYES.candida } },
    { body: 'f', dress: ['tunic:long:stola', 'palla'], hair: 'bun', clip: 'walk', at: [-4.4, 0.03, 9.2], ry: Math.PI / 2, seed: 407, route: { length: 3.4, speed: 0.6, pauseEnd: 5, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } },
    { body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'walk', at: [7.9, 0.03, 1.2], ry: 0, seed: 408, route: { length: 6.2, speed: 0.7, pauseEnd: 4, pauseStart: 4, clipEnd: 'idle', clipStart: 'idle' } },
  ];
}

/** A builder in an undyed tunic. */
function builder(seed, extra) {
  const tones = [DYES.undyed, DYES.oatmeal, DYES.fawn, DYES.brownWool, DYES.ochre];
  return { body: 'm', dress: ['tunic:short'], hair: seed % 3 ? 'crop' : 'curls', seed, colours: { tunic: tones[seed % tones.length] }, ...extra };
}

/** The crew by stage: masons at the drum or the portico, carriers, the crane's windlass. */
export function pantheumCrew(stage) {
  const list = [];
  const ringAt = (a, rr) => [Math.sin(a) * rr, 0.03, R.z + Math.cos(a) * rr];
  if (stage <= 1) {
    for (const [a, k] of [[0.6, 0], [1.4, 1], [-0.9, 2], [2.2, 3]]) {
      const at = ringAt(a, R.r + 0.75);
      list.push(builder(700 + k, { clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at, ry: a + Math.PI }));
    }
    list.push(builder(705, { clip: 'carry', props: { L: 'sack' }, at: [-7.6, 0.03, 4.4], ry: Math.PI / 2, route: { length: 6.0, speed: 0.75, pauseEnd: 3, pauseStart: 4, clipEnd: 'shoulder', clipStart: 'shoulder', faceEnd: Math.PI, faceStart: 0 } }));
  } else if (stage === 2) {
    list.push(builder(710, { clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [-2.4, P.floorY + 0.03, 6.4], ry: Math.PI }));
    list.push(builder(711, { clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [2.4, P.floorY + 0.03, 6.4], ry: Math.PI }));
    list.push(builder(712, { clip: 'carry', props: { L: 'sack' }, at: [-7.6, 0.03, 9.0], ry: Math.PI / 2, route: { length: 5.6, speed: 0.75, pauseEnd: 3, pauseStart: 4, clipEnd: 'shoulder', clipStart: 'shoulder', faceEnd: Math.PI, faceStart: 0 } }));
  } else {
    // Up on the rings, laying the dome's courses; others below.
    const yr = R.top + P.rings.step * 3 + 0.03;
    for (const [a, k] of [[0.4, 0], [1.3, 1], [-1.0, 2]]) {
      const at = [Math.sin(a) * 5.45, yr, R.z + Math.cos(a) * 5.45];
      list.push(builder(720 + k, { clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at, ry: a + Math.PI }));
    }
    list.push(builder(725, { clip: 'carry', props: { L: 'sack' }, at: [-7.6, 0.03, 9.0], ry: Math.PI / 2, route: { length: 5.6, speed: 0.75, pauseEnd: 3, pauseStart: 4, clipEnd: 'shoulder', clipStart: 'shoulder', faceEnd: Math.PI, faceStart: 0 } }));
  }
  return list;
}

/** The site's dressing at timeline `t`, with the goods in `piles` ({ good: 0..3 }). */
export function pantheumSite(t, piles = {}) {
  const site = { scaffolds: [], cranes: [], centering: [], piles: [], crew: [] };
  const stage = Math.floor(t);
  if (stage === 1) {
    // Scaffolds round the drum as it rises, on its four quarters.
    const h = (R.top - P.floorY) * pgrow(t, 'drum') + 1.2;
    for (const a of [0.35, 1.6, -1.4, -0.75]) {
      const rr = R.r + 0.55;
      site.scaffolds.push({ x: Math.sin(a) * rr, z: R.z + Math.cos(a) * rr, w: 3.6, d: 0.9, h, ry: a });
    }
    site.cranes.push({ x: 6.4, z: 4.2, ry: Math.PI, h: 7.0, kind: 'treadwheel' });
  } else if (stage === 2) {
    // The portico's columns raised by a treadwheel; a scaffold along its front for the entablature.
    site.cranes.push({ x: 7.3, z: 4.6, ry: 0, h: 6.5, kind: 'treadwheel' });
    if (pgrow(t, 'entablature') > 0) site.scaffolds.push({ x: 0, z: P.porch.z1 + 0.6, w: 9.6, d: 0.9, h: 5.6, ry: 0 });
    site.cranes.push({ x: -6.6, z: 6.8, ry: 0.3, h: 5.0, kind: 'shear' });
  } else if (stage === 3) {
    // The dome on its centering: the timber form of the whole vault, a crane lifting the courses' loads.
    site.centering.push({ x: 0, z: R.z, dome: RIN - 0.05, y: INNER.cy });
    for (const a of [0.3, 2.0, -1.8]) {
      const rr = R.r + 0.5;
      site.scaffolds.push({ x: Math.sin(a) * rr, z: R.z + Math.cos(a) * rr, w: 3.0, d: 0.9, h: R.top + 1.6, ry: a });
    }
    site.cranes.push({ x: 7.2, z: 0.2, ry: Math.PI, h: 11.5, kind: 'treadwheel' });
  } else if (stage === 4) {
    // The tilers' scaffold on the dome's flank, the forecourt's colonnades going up.
    if (pgrow(t, 'tiles') < 1) site.scaffolds.push({ x: 4.2, z: R.z + 2.0, w: 2.6, d: 2.6, h: 4.6, ry: 0.7, y: R.top });
  } else {
    site.cranes.push({ x: 6.6, z: 4.0, ry: Math.PI, h: 5.0, kind: 'shear' });
  }
  // (Down the sides, the rows of loads going in from the edge.)
  const spots = { clay: [-9.1, 2.6, Math.PI / 2], timber: [-9.1, 6.6, Math.PI / 2], marble: [9.1, 6.6, -Math.PI / 2], iron: [9.1, 2.6, -Math.PI / 2] };
  for (const [good, n] of Object.entries(piles)) {
    const s = spots[good];
    if (s && n > 0) site.piles.push({ x: s[0], z: s[1], ry: s[2], good, n: Math.min(6, n) });
  }
  site.crew = pantheumCrew(stage);
  return site;
}

/** A seeded scatter for the tests. */
export const pantheumRng = artRng;
void lin;
