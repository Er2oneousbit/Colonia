/**
 * models/arena.js
 * ----------------------------------------------------------------------------
 * The Great Arena of the 3D look on its 5 x 5 footprint (20 m): the Flavian
 * amphitheatre (the Colosseum, AD 70 to 80) in miniature, from the record
 * rather than the 2D sprite:
 *
 *   - The façade: three storeys of arcades, eighty arches round, each
 *     framed by engaged half-columns carrying an entablature: Tuscan below,
 *     Ionic in the middle, Corinthian above (the orders climbing as
 *     Vitruvius ranks them); statues stood in the upper arches (the coins of
 *     Titus show them); over the arcades the attic, a solid wall with
 *     Corinthian pilasters, a small window in every other bay and bronze
 *     shields between, and the corbels that held the masts of the velarium,
 *     which the sailors of the fleet at Misenum worked.
 *   - The entrances: the arches numbered for the crowd, the four on the
 *     axes for the emperor, the magistrates and the procession; the north
 *     entrance with its little porch.
 *   - Inside: the arena (Latin for sand) on its wooden floor with the
 *     trapdoors of the lifts that raised beasts and scenery from the
 *     hypogeum below; the podium, a wall high enough to keep the beasts
 *     out, faced in marble, the senators' broad terrace behind it, the
 *     emperor's box (pulvinar) on the south side of the short axis and the
 *     editor's across from it; the cavea in tiers (maeniana) by rank,
 *     divided by walls (baltei) and pierced by the mouths of the stairs
 *     (vomitoria); the women and the poor at the top.
 *
 * So, in 20 m: an oval 19.4 by 16.4 m, 4 m high; forty bays round, the
 * three storeys of arches with their half-columns and entablatures, white
 * statues in the middle storey's arches, the dark of the ambulatories
 * behind; the attic with its pilasters, windows, shields and masts; the
 * porch at the front entrance; the sand 8 by 5 m with its trapdoors and
 * the gates at both ends; the podium in marble with the governor's box on
 * the far side under a purple canopy; three tiers of seats; the velarium
 * spread over the top tier on show days. Its height is held low (4 m, the
 * real one is 48 m on 188) because from the game's camera a wall hides
 * ground 1.7 times its height behind it: at 4 m the near fifth of the sand
 * is behind the façade, and the fights stand in the rest.
 *
 * States (models.js partShows tags): 'open' a show on (the awning, the
 * lamps lit, the gates open, the crowd: models/venues.js), 'out' staffed and
 * idle (the gates open, attendants raking), 'shut' (the gates shut).
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, Shape, ExtrudeGeometry, Matrix4, SphereGeometry, ConeGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { TaggedParts } from './masonry.js';
import { lin, figureMass } from './domus.js';
import {
  venueMaterials, sweep, ellipseCurves, caveaProfile, box, staff, gates, sandFloor, rakeLines, rowSeats, tinted, velarium, lampstand,
} from './venue.js';

/** The Great Arena's measures (metres): the tests, the lab and the game read them. */
export const ARENA = Object.freeze({
  half: 10,
  /** The sand's half axes (x, z). */
  arena: Object.freeze([3.85, 2.5]),
  podium: 0.8,
  /** The façade's bays round, and the storeys' tops (the base's, three arcades', the attic's). */
  bays: 40,
  storeys: Object.freeze([0.12, 1.2, 2.2, 3.14, 3.92]),
});

const A = ARENA;
const CAVEA = caveaProfile({ podium: A.podium, walk: 0.32, tiers: [[3, 0.55, 0.3, 0.2], [3, 0.55, 0.3, 0.2], [2, 0.55, 0.3, 0]] });
/** The top terrace behind the last row, the ambulatory's back wall, the façade's face (offsets from the sand's edge). */
const TERRACE = CAVEA.top.d + 0.28;
const BACK = 5.42;
const FACE = 5.72;
const AT = ellipseCurves(A.arena[0], A.arena[1]);
const [S0, S1, S2, S3, S4] = A.storeys;

/** Points round the façade's face, evenly spaced by length: [t, x, z, ry] for `n` bays (ry turns +z outward). */
function bayPoints(n) {
  const fine = 2000;
  const len = [0];
  let prev = AT(FACE, 0);
  for (let k = 1; k <= fine; k++) {
    const p = AT(FACE, k / fine);
    len.push(len[k - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
    prev = p;
  }
  const total = len[fine];
  const out = [];
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const want = (total * i) / n;
    while (j < fine - 1 && len[j + 1] < want) j++;
    const f = (want - len[j]) / Math.max(1e-9, len[j + 1] - len[j]);
    const t = (j + f) / fine;
    const [x, z] = AT(FACE, t);
    // Outward: the normal of the ellipse there.
    const th = t * Math.PI * 2;
    const nx = Math.cos(th) / (A.arena[0] + FACE);
    const nz = Math.sin(th) / (A.arena[1] + FACE);
    out.push([t, x, z, Math.atan2(nx, nz)]);
  }
  return out;
}

/** A spandrel: the wall over an arch, w wide, from the arch's springing (y 0) to `h`, the arch of radius r cut from below; `depth` thick (toward -z). */
function spandrel(w, h, r, depth, seg) {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2, h);
  s.lineTo(w / 2, h);
  s.lineTo(w / 2, 0);
  s.lineTo(r, 0);
  s.absarc(0, 0, r, 0, Math.PI, false);
  s.lineTo(-w / 2, 0);
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -depth);
  return tintGeometry(boxUV(g));
}

/**
 * One bay of the façade in its own frame (the face at z 0, outward +z, w
 * wide), every storey: half piers either side, the arch over each opening,
 * an engaged half-column at the left edge (the next bay's right), the
 * entablatures, the attic with its pilaster, a window or a shield. `k` the
 * bay's number (alternate bays differ). Returns { trav, marble, dark, bronze, statue }.
 */
function bay(w, k, lod, entrance) {
  const out = { trav: [], dark: [], bronze: [], statue: [], marble: [] };
  const depth = FACE - BACK;
  const storeys = [[S0, S1, 0.098], [S1 + 0.1, S2, 0.086], [S2 + 0.08, S3, 0.076]];
  const seg = lod === 0 ? 10 : 3;
  storeys.forEach(([y0, y1, cr], s) => {
    const entH = 0.12;
    const top = y1 - entH;
    const ow = Math.min(w * 0.62, (top - y0) * 0.66) * (entrance && s === 0 ? 1.1 : 1);
    const spring = top - ow / 2 - 0.1;
    const pw = (w - ow) / 2;
    if (lod > 0) {
      // From the middle distance out: the storey a slab of wall, the arch a dark shape on its face (a
      // round head over its jambs), the entablature a band; the half-columns only at the middle level.
      out.trav.push(box(w, top - y0, depth, 0, y0, -depth / 2, 0.84));
      out.dark.push(box(ow, spring - y0, 0.02, 0, y0, 0.006, 1));
      const head = new CylinderGeometry(ow / 2, ow / 2, 0.02, lod === 1 ? 6 : 3, 1, false, -Math.PI / 2, Math.PI);
      head.rotateX(Math.PI / 2);
      head.translate(0, spring, 0.006);
      out.dark.push(tintGeometry(boxUV(head)));
      out.trav.push(box(w + 0.002, entH, depth + 0.16, 0, top, -depth / 2 + 0.08, 1.12));
      if (lod === 1) out.trav.push(tintGeometry(boxUV(new CylinderGeometry(cr * 1.05, cr * 1.15, top - y0, 4, 1, false, -Math.PI / 2, Math.PI).translate(-w / 2, y0 + (top - y0) / 2, 0)), () => 1.12));
      return;
    }
    // The half piers: each bay's own, either side of its opening.
    for (const sx of [-1, 1]) out.trav.push(box(pw, spring - y0, depth, sx * (w / 2 - pw / 2), y0, -depth / 2, 0.78));
    // The arch's wall over the opening, to the entablature.
    out.trav.push(tinted(spandrel(w, top - spring, ow / 2, depth, seg).translate(0, spring, 0), [0.8, 0.8, 0.8]));
    // The voussoirs' ring: a band proud of the face round the arch (full detail).
    if (lod === 0) {
      const ring = new CylinderGeometry(ow / 2 + 0.05, ow / 2 + 0.05, 0.03, 12, 1, true, -Math.PI / 2, Math.PI);
      ring.rotateX(Math.PI / 2);
      ring.translate(0, spring, 0.012);
      out.trav.push(tintGeometry(boxUV(ring), () => 0.97));
      // An impost moulding at the springing.
      for (const sx of [-1, 1]) out.trav.push(box(0.06, 0.04, 0.03, sx * (ow / 2 + 0.03), spring - 0.04, 0.012, 0.98));
    }
    // The dark of the ambulatory seen through the arch.
    out.dark.push(box(ow, spring - y0 + ow / 2, 0.02, 0, y0, -depth + 0.012, 1));
    // The engaged half-column at the bay's left edge, on a base, with its capital: Tuscan, Ionic, Corinthian.
    if (lod < 2) {
      const ch = top - y0;
      const col = new CylinderGeometry(cr * 1.05, cr * 1.15, ch - 0.06, lod ? 4 : 10, 1, false, -Math.PI / 2, Math.PI);
      col.translate(-w / 2, y0 + 0.03 + (ch - 0.06) / 2, 0);
      out.trav.push(tintGeometry(boxUV(col), () => 1.12));
      const capH = s === 2 ? 0.09 : 0.05;
      const cap = new CylinderGeometry(cr * (s === 2 ? 1.35 : 1.2), cr * 0.95, capH, lod ? 4 : 10, 1, false, -Math.PI / 2, Math.PI);
      cap.translate(-w / 2, top - capH / 2 - 0.02, 0);
      out.trav.push(tintGeometry(boxUV(cap), () => 1.02));
      if (s === 1 && lod === 0) for (const sx of [-1, 1]) out.trav.push(box(0.035, 0.035, 0.03, -w / 2 + sx * cr, top - 0.075, cr * 0.7, 1));
    }
    // The entablature: architrave, frieze, cornice, the cornice proud.
    // (Proud of the face and paler than the wall, so each storey reads as a band from the game's camera.)
    out.trav.push(box(w + 0.002, entH * 0.5, depth + 0.1, 0, top, -depth / 2 + 0.05, 1.05));
    out.trav.push(box(w + 0.002, entH * 0.5, depth + 0.2, 0, top + entH * 0.5, -depth / 2 + 0.1, 1.2));
    // A statue in the arch of the middle storey, every other bay (Titus's coins), and in the top one's.
    if (s >= 1 && (k + s) % 2 === 0) {
      out.statue.push(...figureMass(0, y0 + 0.05, -0.08, 0.36, lod + 1));
      out.trav.push(box(0.22, 0.05, 0.18, 0, y0, -0.08, 0.95));
    }
    // A balustrade across the upper arches.
    if (s >= 1 && lod === 0) out.trav.push(box(ow, 0.12, 0.05, 0, y0, -0.03, 0.9));
  });
  // The attic: a solid wall, a pilaster at the left edge, a window or a bronze shield, the corbels, the cornice.
  out.trav.push(box(w + 0.002, S4 - S3, depth, 0, S3, -depth / 2, 0.95));
  if (lod < 2) {
    out.trav.push(box(0.12, S4 - S3 - 0.1, 0.03, -w / 2, S3 + 0.02, 0.012, 1.0));
    if (k % 2) out.dark.push(box(0.22, 0.18, 0.02, 0, S3 + 0.4, 0.004, 1));
    else {
      const shield = new CylinderGeometry(0.15, 0.15, 0.03, lod ? 8 : 16);
      shield.rotateX(Math.PI / 2);
      shield.translate(0, S3 + 0.45, 0.02);
      out.bronze.push(tintGeometry(boxUV(shield), () => 0.95));
      if (lod === 0) {
        const boss = new SphereGeometry(0.05, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
        boss.rotateX(Math.PI / 2);
        boss.translate(0, S3 + 0.45, 0.035);
        out.bronze.push(tintGeometry(boxUV(boss), () => 1.1));
      }
    }
    // The corbels the masts stood on.
    out.trav.push(box(0.1, 0.08, 0.1, 0, S3 + 0.12, 0.05, 0.92));
  }
  out.trav.push(box(w + 0.004, 0.08, depth + 0.1, 0, S4, -depth / 2 + 0.05, 1.03));
  return out;
}

/** The façade: the bays round, placed on the ellipse; the steps round its foot; the porch at the front. */
/**
 * The façade's bays round the oval: three kits (models/venues.js instances
 * them, a copy a bay, as the government's colonnades are): 'even' and 'odd'
 * bays (the statues and the attic's windows and shields alternate) and the
 * four entrances on the axes; each built at the bays' mean width and
 * stretched along its chord to its own. [{ kind, mat }] in the arena's
 * metres.
 */
function bayPlaces() {
  const pts = bayPoints(A.bays);
  const out = [];
  const m = new Matrix4();
  const s = new Matrix4();
  for (let k = 0; k < A.bays; k++) {
    const [, x0, z0] = pts[k];
    const [, x1, z1] = pts[k + 1];
    const w = Math.hypot(x1 - x0, z1 - z0) + 0.004;
    const tm = (pts[k][0] + pts[k + 1][0]) / 2;
    const [cx, cz] = AT(FACE, tm);
    // (The face's chord between the bay's two points, outward: a turn about y.)
    m.makeRotationY(-Math.atan2(z1 - z0, x1 - x0)).setPosition(cx, 0, cz);
    m.multiply(s.makeScale(w / BAY_W, 1, 1));
    // The arches on the axes are the entrances: wider below.
    const axis = [0, 0.25, 0.5, 0.75].some((a) => Math.min(Math.abs(tm - a), Math.abs(tm - a - 1)) < 0.5 / A.bays);
    out.push({ kind: axis ? 'gate' : k % 2 ? 'odd' : 'even', mat: m.toArray(new Float32Array(16)) });
  }
  return out;
}

/** The bays' mean width (m): the kits are built at it. */
const BAY_W = (() => {
  const pts = bayPoints(A.bays);
  let sum = 0;
  for (let k = 0; k < A.bays; k++) sum += Math.hypot(pts[k + 1][1] - pts[k][1], pts[k + 1][2] - pts[k][2]);
  return sum / A.bays + 0.004;
})();

/** The façade's `more` (models/venues.js): each kind of bay one entry with the matrices of its bays. */
export const ARENA_BAYS = Object.freeze(['even', 'odd', 'gate'].map((kind) => {
  const list = bayPlaces().filter((b) => b.kind === kind);
  const mats = new Float32Array(list.length * 16);
  list.forEach((b, j) => mats.set(b.mat, j * 16));
  return Object.freeze({ key: `colosseum:bay:${kind}`, n: list.length, mats, state: 'always' });
}));

/** A bay of the façade by kind ('even', 'odd', 'gate'), at the mean width, in its own frame (its face at z 0, outward +z). */
export function buildArenaBay(kind, { lod = 0 } = {}) {
  const M = venueMaterials();
  const p = new TaggedParts(`arena-bay-${kind}`);
  const g = bay(BAY_W, kind === 'odd' ? 1 : 0, lod, kind === 'gate');
  for (const [key, list] of Object.entries(g)) {
    if (!list.length) continue;
    if (key === 'statue') p.add('statue', M.marble, list);
    else p.add(key, M[key], list);
  }
  return p.build();
}

/** The façade's own parts (the bays are kits of their own: ARENA_BAYS): the steps, the ambulatory's back, the porch. */
function facade(lod, p, M) {
  // The steps round the foot (the base), and the ambulatory's back wall behind the arches (dark).
  const N = lod === 0 ? 160 : lod === 1 ? 80 : 40;
  p.add('trav', M.trav, sweep(AT, [[FACE + 0.22, 0], [FACE + 0.22, 0.06], [FACE + 0.11, 0.06], [FACE + 0.11, S0], [FACE - 0.05, S0]], N, { tint: () => 0.9 }));
  p.add('dark', M.dark, sweep(AT, [[BACK, S0], [BACK, S3]], N, { tint: () => 1 }));
  // The ambulatories' floors at each storey (seen through the arches).
  for (const y of [S1, S2]) p.add('dark', M.dark, sweep(AT, [[BACK, y + 0.002], [FACE - 0.01, y + 0.002]], N, { tint: () => 1 }));
  // The front entrance's porch: two columns and a pediment before the arch on the +z axis.
  const [px, pz] = AT(FACE, 0.25);
  const ph = S1 - 0.02;
  for (const sx of [-0.55, 0.55]) {
    p.add('marble', M.marble, tintGeometry(boxUV(new CylinderGeometry(0.075, 0.085, ph - 0.1, lod ? 6 : 12).translate(px + sx, 0.06 + (ph - 0.1) / 2, pz + 0.55)), () => 0.97));
    p.add('marble', M.marble, box(0.2, 0.06, 0.2, px + sx, 0, pz + 0.55, 0.95));
  }
  p.add('marble', M.marble, box(1.42, 0.12, 0.7, px, ph - 0.06, pz + 0.3, 0.97));
  const ped = new ConeGeometry(0.78, 0.36, 3, 1);
  ped.rotateY(Math.PI / 2);
  ped.rotateX(Math.PI / 2);
  ped.rotateZ(Math.PI);
  ped.scale(1, 1, 0.9);
  const tri = new CylinderGeometry(0.0001, 0.78, 0.34, 4, 1);
  void ped;
  tri.rotateY(Math.PI / 4);
  tri.scale(1, 1, 0.42);
  tri.translate(px, ph + 0.06 + 0.17, pz + 0.3);
  p.add('marble', M.marble, tintGeometry(boxUV(tri), () => 0.95));
}

/** The cavea inside: the podium, the tiers and their walls, the terrace behind the top row, the attic's inner face. */
function cavea(lod, p, M) {
  const n = lod === 0 ? 128 : lod === 1 ? 64 : 32;
  const prof = [...CAVEA.profile, [TERRACE, CAVEA.top.y], [BACK, CAVEA.top.y], [BACK, S4], [FACE - 0.02, S4]];
  const nRows = CAVEA.profile.length;
  const tint = (x, y, z, i) => {
    if (i >= nRows - 1) return [0.95, 0.93, 0.88];
    const tread = i >= 3 && (i - 3) % 2 === 1;
    const k = tread ? 1 : 0.8;
    return [k, k * 0.97, k * 0.92];
  };
  p.add('seats', M.seats, sweep(AT, prof, n, { tint }));
  // The podium in marble: its face and coping, and the senators' terrace's balustrade.
  p.add('marble', M.marble, sweep(AT, [[-0.02, 0.02], [-0.02, A.podium], [-0.05, A.podium], [-0.05, A.podium + 0.07], [0.12, A.podium + 0.07]], n, { tint: (x, y) => (y < 0.12 ? 0.8 : 0.97) }));
  // The baltei's marble copings and the mouths of the vomitoria in them (dark), sixteen round.
  for (const r of CAVEA.rows) void r;
  const walls = [];
  let d = CAVEA.rows[2].d + CAVEA.rows[2].depth;
  walls.push([d, CAVEA.rows[2].y]);
  d = CAVEA.rows[5].d + CAVEA.rows[5].depth;
  walls.push([d, CAVEA.rows[5].y]);
  for (const [dw, yw] of walls) {
    p.add('marble', M.marble, sweep(AT, [[dw - 0.02, yw + 0.2], [dw - 0.02, yw + 0.24], [dw + 0.14, yw + 0.24]], n, { tint: () => 0.93 }));
    if (lod < 2) {
      for (let k = 0; k < 16; k++) {
        const t = (k + 0.5) / 16;
        const [x, z] = AT(dw - 0.006, t);
        const [x2, z2] = AT(dw - 1, t);
        const g = box(0.28, 0.2, 0.02, 0, yw, 0, 1);
        g.rotateY(Math.atan2(x2 - x, z2 - z));
        g.translate(x, 0, z);
        p.add('dark', M.dark, g);
      }
    }
  }
}

/** The arena: the sand, raked, with the trapdoors of the lifts; the gates at both ends; lampstands by them. */
function arena(lod, p, M) {
  p.add('sand', M.sand, sandFloor(AT, lod ? 40 : 80, 0.02));
  if (lod < 2) p.add('sand', M.sand, rakeLines(AT, [-0.3, -0.7, -1.1, -1.5, -1.9], 0.024, lod ? 64 : 128));
  // The trapdoors: two rows of boarded lids along the long axis, flush with the sand.
  if (lod < 2) {
    for (const z of [-0.75, 0.75]) {
      for (let k = 0; k < 7; k++) {
        const x = -2.7 + k * 0.9;
        p.add('wood', M.wood, box(0.42, 0.012, 0.42, x, 0.02, z, 0.62));
        if (lod === 0) for (const dx of [-0.1, 0.1]) p.add('iron', M.iron, box(0.03, 0.006, 0.4, x + dx, 0.032, z, 0.9));
      }
    }
  }
  for (const t of [0, 0.5]) {
    const s = t === 0 ? 1 : -1;
    const x = s * (A.arena[0] + 0.004);
    p.add('dark', M.dark, box(0.02, A.podium - 0.06, 1.0, x, 0, 0, 1));
    for (const [st, open] of [['staffed', true], ['shut', false]]) {
      const g = gates(0, 0, 0.98, A.podium - 0.08, 0, open, lod);
      for (const list of [g.wood, g.bronze]) {
        for (const q of list) {
          q.rotateY(s * Math.PI / 2);
          q.translate(x - s * 0.02, 0, 0);
        }
      }
      p.add(`gate-wood-${st}`, M.wood, g.wood, { when: st });
      if (g.bronze.length) p.add(`gate-bronze-${st}`, M.bronze, g.bronze, { when: st });
    }
    for (const z of [-0.85, 0.85]) {
      const l = lampstand(s * (A.arena[0] - 0.3), z, 1.0, 0.02, lod);
      p.add('bronze', M.bronze, l.bronze);
      p.add('flame', M.flame, l.flames, { when: 'open', cast: false });
    }
  }
}

/** The governor's box (pulvinar) on the far side: a platform over the podium, columns, a purple canopy, chairs; the editor's across. */
function boxes(lod, p, M) {
  for (const [side, w, chairs] of [[-1, 2.0, [-0.5, 0, 0.5]], [1, 1.4, [-0.25, 0.25]]]) {
    const z = side * (A.arena[1] + 0.25);
    const y = A.podium + 0.07;
    const back = side * 0.45;
    p.add('marble', M.marble, box(w, 0.08, 0.7, 0, y - 0.08, z + back * 0.4, 0.97));
    p.add('marble', M.marble, box(w, 0.32, 0.05, 0, y, z - side * 0.1, 0.95));
    for (const sx of [-w / 2 + 0.06, w / 2 - 0.06]) for (const sz of [-side * 0.06, side * 0.55]) {
      p.add('marble', M.marble, tintGeometry(boxUV(new CylinderGeometry(0.035, 0.04, 1.2, lod ? 5 : 8).translate(sx, y + 0.6, z + sz)), () => 0.96));
    }
    p.add('canopy', M.cloth, tinted(box(w + 0.06, 0.05, 0.75, 0, y + 1.2, z + side * 0.25, 1), lin(side < 0 ? 0x6a2248 : 0x9e2a1c)));
    if (side < 0 && lod < 2) {
      // The pediment of the emperor's box, gilt.
      const g = new CylinderGeometry(0.0001, 0.6, 0.26, 4, 1);
      g.rotateY(Math.PI / 4);
      g.scale(w / 1.2, 1, 0.3);
      g.translate(0, y + 1.38, z + side * 0.25);
      p.add('gilt', M.gilt, tintGeometry(boxUV(g), () => 0.9));
    }
    for (const x of chairs) {
      const cz = z + side * 0.3;
      p.add('bronze', M.bronze, box(0.46, 0.04, 0.34, x, y + 0.4, cz, 0.9));
      for (const sx of [-0.19, 0.19]) for (const sz of [-0.13, 0.13]) p.add('bronze', M.bronze, box(0.03, 0.4, 0.03, x + sx, y, cz + sz, 0.85));
      if (lod < 2) p.add('cushion', M.cloth, tinted(box(0.44, 0.05, 0.32, x, y + 0.44, cz), lin(0x6a2248)));
    }
  }
}

/** The Great Arena at a level of detail: { group, meshes, triangles }. */
export function buildArena({ lod = 0 } = {}) {
  const M = venueMaterials();
  const p = new TaggedParts('arena');
  facade(lod, p, M);
  cavea(lod, p, M);
  arena(lod, p, M);
  boxes(lod, p, M);
  // The masts on the attic's corbels, and the awning over the top tier on show days.
  const masts = lod === 2 ? 16 : 32;
  velarium(p, M, AT, { ts: Array.from({ length: masts }, (_, k) => (k + 0.5) / masts), dm: FACE + 0.08, dIn: FACE - 0.85, y0: S3 + 0.14, yTop: S4 + 0.95, drop: 0.22, lod, closed: true, stripes: 96 });
  return p.build();
}

/** Where the crowd sits: [[x, y, z, ry, band, rise], ...]: the togate in the first tier, the people in the second, the women and the poor in the third. */
export function arenaSeats() {
  const out = [];
  CAVEA.rows.forEach((r, k) => {
    // Clear of the gates, the boxes (first row only) and the vomitoria's gangways (the tiers' sixteenths).
    const skip = (t) => [0, 0.5].some((g) => Math.min(Math.abs(t - g), Math.abs(t - g - 1)) < 0.03)
      || (k < 2 && (Math.abs(t - 0.75) < 0.06 || Math.abs(t - 0.25) < 0.045))
      || Math.abs(((t * 16) % 1) - 0.5) < 0.12;
    for (const s of rowSeats(AT, r.d, r.y, 0, 1, skip)) out.push([...s, k < 3 ? 'toga' : k < 6 ? 'plebs' : 'pullati', r.rise]);
  });
  return out;
}

/** The lamps: the lampstands by the gates, and lanterns at the four entrances outside (each facing out). */
export const ARENA_LAMPS = Object.freeze([
  ...[1, -1].flatMap((s) => [-0.85, 0.85].map((z) => Object.freeze([s * (A.arena[0] - 0.3), 1.1, z, 0, -s]))),
  Object.freeze([0, 0.9, A.arena[1] + FACE + 0.2, 1]),
  Object.freeze([0, 0.9, -(A.arena[1] + FACE + 0.2), -1]),
  Object.freeze([A.arena[0] + FACE + 0.2, 0.9, 0, 0, 1]),
  Object.freeze([-(A.arena[0] + FACE + 0.2), 0.9, 0, 0, -1]),
]);

/** Where things are, for the people (models/venueActors.js): the boxes' chairs [x, y (floor), z, ry]. */
export const ARENA_SPOTS = Object.freeze({
  governor: Object.freeze([-0.5, 0, 0.5].map((x) => Object.freeze([x, A.podium + 0.07, -(A.arena[1] + 0.25 + 0.3), 0]))),
  editor: Object.freeze([-0.25, 0.25].map((x) => Object.freeze([x, A.podium + 0.07, A.arena[1] + 0.25 + 0.3, Math.PI]))),
});
