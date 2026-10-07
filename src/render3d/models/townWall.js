/**
 * models/townWall.js
 * ----------------------------------------------------------------------------
 * The town wall of the 3D look, its towers and its gate, one 4 m tile a
 * piece (walls/wallLayout.js picks the piece), from the walls Rome built
 * round its towns in the Republic and the early Empire rather than from
 * the 2D sprites:
 *
 *   - The curtain: about two storeys to the wall-walk, as the Servian Wall
 *     (squared tufa, opus quadratum), the polygonal walls of Cosa, Alatri
 *     and Norba, Paestum's limestone, Turin's brick; on a footing of
 *     bigger stones, a string course under the walk, a parapet on each
 *     face (the breastwork, then merlons with crenels between, capped
 *     with dressed stone). The stone is the province's (WALL_LOOKS). Here
 *     a wall 1.9 m thick, 3.6 m to the walk, 5.2 m to the merlons' tops:
 *     less than a real circuit's 6 to 10 m, because from the game's camera,
 *     30 degrees down, a wall hides 1.7 times its height of the town behind
 *     it, and because the 2D art drew it lower still.
 *   - Towers: square ones at the corners, the junctions and every eight
 *     tiles along a run (Pompeii's towers, Aosta's), each a storey over
 *     the walk with arched windows under a hipped roof of tiles; round
 *     (sixteen-sided) ones flanking a gate, as the Porta Palatina's in
 *     Turin, under a cone of tiles.
 *   - The gate: a gatehouse across the road, deeper than the wall, a
 *     single arched passage (Pompeii's Porta Marina, the Porta Palatina's
 *     carriageway) with dressed voussoirs and a keystone, a gallery storey
 *     over it with arched windows (the Porta Palatina's), a crenellated
 *     top; timber doors studded with iron in the passage, open to the
 *     townsfolk ('open') and shut while enemies are on the map ('shut');
 *     iron brackets with torches either side of the arch, which the
 *     night's light map lights.
 *   - Damage, from the sim's hit points (walls/wallLayout.js damageLevel):
 *     1 cracked (merlons knocked off, cracks, fallen stones at the foot, a
 *     gate's leaf hanging), 2 breaching (the wall broken down in a notch
 *     to two metres, a heap of rubble each side; a gate's top broken, a
 *     leaf down in the road). A broken wall leaves the sim's rubble on the
 *     ground (the 3D ground draws it); built again, it rises new.
 *
 * Seams. Tiles of wall meet at their edges: every piece's walk, parapets,
 * cornice and footing run at the same heights and thicknesses to the edge
 * on the line of the wall, and the merlons stand at fixed places along it
 * (every MERLON_P from the tile's middle, a crenel across the edge), the
 * same at every quarter turn. The stone's textures are read at the world's
 * metres (materials.js worldUV), so the masonry runs on from tile to tile.
 *
 * Metres, the tile's middle at the origin, y up, a piece along its
 * canonical mask (walls/wallLayout.js CANON: +x is E, +z is S). Levels of
 * detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, ConeGeometry, IcosahedronGeometry, ExtrudeGeometry, Shape, BufferGeometry, Float32BufferAttribute } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { artRng, smoothstep } from '../texgen.js';
import { slab, tiledRoof, TaggedParts } from './masonry.js';
import { ruralMaterials, doorLeaf, blk } from './rural.js';
import { CANON, parseWallKey } from '../walls/wallLayout.js';

/** The wall's measures (metres): the tests, the cover sprites and the lab read them. */
export const WALL = Object.freeze({
  half: 2,
  hw: 0.95, // the curtain's half thickness
  footH: 0.5, // the footing course
  footOut: 0.13, // how far it stands out of the face
  walk: 3.6, // the wall-walk
  cornice: Object.freeze([3.42, 3.6]),
  corniceOut: 0.07,
  parT: 0.36, // a parapet's thickness
  breast: 4.45, // the breastwork's top (the crenels' sills)
  merlonH: 0.75,
  merlonP: 4 / 3, // merlons along the wall, from the tile's middle: a crenel across the edge
  merlonW: 0.74,
  cap: 0.06,
  square: Object.freeze({ half: 1.75, top: 7.4, roof: 1.55 }),
  round: Object.freeze({ r: 1.9, top: 7.6, roof: 1.7, sides: 16 }),
  gate: Object.freeze({ depth: 1.55, pass: 1.15, spring: 2.4, top: 6.2, torch: Object.freeze([1.62, 2.95]) }),
});
const W = WALL;
/** The merlons' tops: the wall's height. */
export const WALL_TOP = W.breast + W.merlonH + W.cap;

/**
 * The provinces' stones (walls/wallLayout.js wallLookOf says which): the
 * curtain's face, its parapet, its footing, and the dressed stone of the
 * string courses, copings, voussoirs and quoins.
 */
export const WALL_LOOKS = Object.freeze({
  // Cosa's polygonal blocks below, coursed limestone for the parapet and towers (as the later rebuilds).
  polygonal: Object.freeze({ body: 'polygonal', upper: 'ashlarLime', foot: 'polygonal', dressed: 'travertine' }),
  tufa: Object.freeze({ body: 'ashlar', upper: 'ashlar', foot: 'ashlar', dressed: 'travertine' }),
  ashlar: Object.freeze({ body: 'ashlarLime', upper: 'ashlarLime', foot: 'ashlarLime', dressed: 'travertine' }),
  brick: Object.freeze({ body: 'brick', upper: 'brick', foot: 'ashlarLime', dressed: 'travertine' }),
});

/** The materials of a look: its stones read at the world's metres, and the tiles, timber and iron. */
export function wallMaterials(look) {
  const L = WALL_LOOKS[look] || WALL_LOOKS.polygonal;
  const stone = (s) => material(`wall-${s}`, { surface: s, worldUV: true, snow: 1 });
  const r = ruralMaterials();
  return {
    body: stone(L.body), upper: stone(L.upper), foot: stone(L.foot), dressed: stone(L.dressed),
    tile: r.tile, wood: r.wood, iron: r.iron, dark: r.dark,
    // A crack's shadow and the dirt in it: plain, as dark as a joint.
    crack: material('wall-crack', { color: 0x1e1a15, roughness: 0.95, snow: 0, wet: 0.3 }),
  };
}

/** Dirt splashed up the foot of the wall and darker joints low down: a vertex colour by height. */
const grime = (y) => 0.78 + 0.22 * smoothstep(0.0, 1.6, y);

/** A box from (x0, y0, z0) to (x1, y1, z1), split along y at lod 0 so its foot's grime fades up it. */
function box(x0, x1, y0, y1, z0, z1, lod = 1, k = 1) {
  const h = y1 - y0;
  const segH = lod === 0 && y0 < 1.6 ? Math.max(1, Math.min(4, Math.ceil(h / 0.8))) : 1;
  const g = new BoxGeometry(x1 - x0, h, z1 - z0, 1, segH, 1);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  boxUV(g);
  return tintGeometry(g, (x, y) => k * grime(y));
}

/** A box along `axis` ('x' or 'z'): from c0 to c1 along it, from a0 to a1 across it. */
function boxAlong(axis, c0, c1, a0, a1, y0, y1, lod, k = 1) {
  return axis === 'x' ? box(c0, c1, y0, y1, Math.min(a0, a1), Math.max(a0, a1), lod, k) : box(Math.min(a0, a1), Math.max(a0, a1), y0, y1, c0, c1, lod, k);
}

// ------------------------------------------------------------------ the curtain

/** Arms of a mask: E, S, W, N present (bits 2, 4, 8, 1). */
function armsOf(mask) {
  return { E: !!(mask & 2), S: !!(mask & 4), W: !!(mask & 8), N: !!(mask & 1) };
}

/**
 * The parapets' runs of a piece with arms `a`: lines on the faces of the
 * wall's plan (a centre square of half width hw and an arm to each edge
 * with a neighbour), each { axis, at, inward, c0, c1, e0, e1 }: along
 * `axis` at `at` across it, the parapet inward of it by `inward` (+1/-1),
 * from c0 to c1, each end 'edge' (the tile's: the next tile carries on),
 * 'convex' (an outer corner) or 'concave' (an inner one).
 */
export function parapetRuns(a) {
  const hw = W.hw;
  const H = W.half;
  const runs = [];
  // On line z = s*hw (along x): the W arm's side, the centre's (open unless an arm leaves that way), the E arm's.
  for (const s of [-1, 1]) {
    const across = s < 0 ? a.N : a.S;
    const segs = [[-H, -hw, a.W], [-hw, hw, !across], [hw, H, a.E]];
    pushRuns(runs, 'x', s * hw, -s, segs, !across);
  }
  // On line x = s*hw (along z): the N arm's side, the centre's, the S arm's.
  for (const s of [-1, 1]) {
    const across = s < 0 ? a.W : a.E;
    const segs = [[-H, -hw, a.N], [-hw, hw, !across], [hw, H, a.S]];
    pushRuns(runs, 'z', s * hw, -s, segs, !across);
  }
  return runs;
}

/** Merge a line's present segments into runs; an end at the centre's corner is convex if the run takes in the centre's side. */
function pushRuns(runs, axis, at, inward, segs, centre) {
  let cur = null;
  for (const [c0, c1, on] of segs) {
    if (on) {
      if (cur) cur.c1 = c1;
      else cur = { axis, at, inward, c0, c1 };
    } else if (cur) {
      runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);
  const H = W.half;
  for (const r of runs) {
    if (r.axis !== axis || r.at !== at || r.e0) continue;
    const end = (c) => (Math.abs(Math.abs(c) - H) < 1e-6 ? 'edge' : centre && Math.abs(c) < H - 1e-6 && r.c0 <= -W.hw + 1e-6 && r.c1 >= W.hw - 1e-6 ? 'convex' : 'concave');
    r.e0 = end(r.c0);
    r.e1 = end(r.c1);
  }
}

/** Intervals of [c0, c1] outside (-t, t) (a tower stands over the middle): 0, 1 or 2 of them. */
function outside(c0, c1, t) {
  if (!t) return [[c0, c1]];
  const out = [];
  if (c0 < -t) out.push([c0, Math.min(c1, -t)]);
  if (c1 > t) out.push([Math.max(c0, t), c1]);
  return out.filter(([a, b]) => b - a > 0.02);
}

/**
 * The curtain of a piece: its footing, body, string course, walk,
 * parapets and merlons for arms `a`, the middle left to a tower of half
 * width `tower` (its own body hides what would be there). `dmg` 0..2.
 * Adds to `P` (TaggedParts) with materials `M`.
 */
function curtain(P, M, a, { lod, tower = 0, dmg = 0, seed = 1 }) {
  const hw = W.hw;
  const H = W.half;
  const e = W.footOut;
  const cells = [['C', -hw, hw, -hw, hw]];
  if (a.E) cells.push(['E', hw, H, -hw, hw]);
  if (a.W) cells.push(['W', -H, -hw, -hw, hw]);
  if (a.S) cells.push(['S', -hw, hw, hw, H]);
  if (a.N) cells.push(['N', -hw, hw, -H, -hw]);
  const body = [];
  const foot = [];
  // The breach's notch (dmg 2): the wall broken down toward the tile's middle, in steps of blocks.
  // (Its jag is seeded by the place, so the body, its string course and its parapet agree.)
  const notch = (x, z) => Math.min(W.walk, 1.75 + 1.05 * Math.max(0, Math.hypot(x, z) - 0.25) + (hashOf(seed, Math.round(x * 4) * 31 + Math.round(z * 4)) - 0.5) * 0.3);
  for (const [id, x0, x1, z0, z1] of cells) {
    // The footing stands out of every face that is not an arm's end.
    const fx0 = id === 'C' && !a.W ? x0 - e : id === 'N' || id === 'S' ? x0 - e : x0;
    const fx1 = id === 'C' && !a.E ? x1 + e : id === 'N' || id === 'S' ? x1 + e : x1;
    const fz0 = id === 'C' && !a.N ? z0 - e : id === 'E' || id === 'W' ? z0 - e : z0;
    const fz1 = id === 'C' && !a.S ? z1 + e : id === 'E' || id === 'W' ? z1 + e : z1;
    foot.push(box(fx0, fx1, 0, W.footH, fz0, fz1, lod, 0.92));
    if (dmg < 2) {
      body.push(box(x0, x1, W.footH, W.walk, z0, z1, lod));
      continue;
    }
    // Breaching: the lower courses whole, the rest in slices along the cell's long side, each
    // broken off at the notch's height there.
    body.push(box(x0, x1, W.footH, 1.75, z0, z1, lod));
    const alongX = x1 - x0 >= z1 - z0;
    const len = alongX ? x1 - x0 : z1 - z0;
    const n = Math.max(1, Math.round(len / 0.45));
    for (let k = 0; k < n; k++) {
      const s0 = (alongX ? x0 : z0) + (len * k) / n;
      const s1 = (alongX ? x0 : z0) + (len * (k + 1)) / n;
      const m = (s0 + s1) / 2;
      const top = alongX ? notch(m, (z0 + z1) / 2) : notch((x0 + x1) / 2, m);
      if (top <= 1.8) continue;
      body.push(alongX ? box(s0, s1, 1.75, top, z0, z1, lod) : box(x0, x1, 1.75, top, s0, s1, lod));
    }
  }
  P.add('foot', M.foot, foot);
  P.add('body', M.body, body);
  // A tower's half width over the middle (a round one's where its face crosses the wall's face).
  const runs = parapetRuns(a);
  const up = [];
  const dressed = [];
  const cracks = [];
  const broken = (c, r) => dmg >= 2 && notch(r.axis === 'x' ? c : r.at, r.axis === 'x' ? r.at : c) < W.walk - 0.05;
  let mi = 0;
  for (const r of runs) {
    // Convex ends: the runs along z stop short of the run along x's parapet (no two tops in one place);
    // concave ends: the runs along x reach in over the corner's square (no notch inside it).
    let c0 = r.c0;
    let c1 = r.c1;
    if (r.axis === 'z') {
      if (r.e0 === 'convex') c0 += W.parT;
      if (r.e1 === 'convex') c1 -= W.parT;
    } else {
      if (r.e0 === 'concave') c0 -= W.parT;
      if (r.e1 === 'concave') c1 += W.parT;
    }
    const a0 = r.at;
    const a1 = r.at + r.inward * W.parT;
    for (const [s0, s1] of outside(c0, c1, tower)) {
      // The string course under the walk, standing out of the face; round the outer corners.
      if (lod < 2) {
        const out = r.at - r.inward * W.corniceOut;
        const k0 = r.e0 !== 'edge' && Math.abs(s0 - c0) < 1e-6 ? s0 - (r.e0 === 'convex' ? W.corniceOut + (r.axis === 'z' ? W.parT : 0) : 0) : s0;
        const k1 = r.e1 !== 'edge' && Math.abs(s1 - c1) < 1e-6 ? s1 + (r.e1 === 'convex' ? W.corniceOut + (r.axis === 'z' ? W.parT : 0) : 0) : s1;
        // (Cut where a breach broke the wall below it.)
        for (const [q0, q1] of dmg >= 2 ? solid(k0, k1, (c) => !broken(c, r)) : [[k0, k1]]) dressed.push(boxAlong(r.axis, q0, q1, out, r.at + r.inward * 0.3, W.cornice[0], W.cornice[1], lod));
      }
      // The breastwork: solid to the crenels' sills, its top a dressed coping.
      for (const [q0, q1] of dmg >= 2 ? solid(s0, s1, (c) => !broken(c, r)) : [[s0, s1]]) {
        up.push(boxAlong(r.axis, q0, q1, a0, a1, W.walk, W.breast - (lod < 2 ? W.cap : 0), lod));
        if (lod < 2) dressed.push(boxAlong(r.axis, q0, q1, a0 - r.inward * 0.02, a1 + r.inward * 0.02, W.breast - W.cap, W.breast, lod));
      }
      // Merlons at their fixed places along the line, clipped to the run, and clear of the
      // merlon on an outer corner (a crenel of at least 0.3 m beside it).
      const lo = r.e0 === 'convex' && !tower ? r.c0 + CORNER_M + 0.3 : -Infinity;
      const hi = r.e1 === 'convex' && !tower ? r.c1 - CORNER_M - 0.3 : Infinity;
      const P0 = Math.ceil((s0 - W.merlonW / 2) / W.merlonP);
      const P1 = Math.floor((s1 + W.merlonW / 2) / W.merlonP);
      for (let k = P0; k <= P1; k++) {
        const m0 = Math.max(s0, lo, k * W.merlonP - W.merlonW / 2);
        const m1 = Math.min(s1, hi, k * W.merlonP + W.merlonW / 2);
        if (m1 - m0 < 0.28) continue;
        mi++;
        // Cracked: about half knocked off; breaching: those over the breach too.
        if (dmg >= 1 && hashOf(seed, mi) < 0.5) continue;
        if (broken((m0 + m1) / 2, r)) continue;
        up.push(boxAlong(r.axis, m0, m1, a0, a1, W.breast, W.breast + W.merlonH, lod));
        if (lod < 2) dressed.push(boxAlong(r.axis, m0 - 0.02, m1 + 0.02, a0 - r.inward * 0.025, a1 + r.inward * 0.025, W.breast + W.merlonH, WALL_TOP, lod));
      }
    }
  }
  // A merlon on each outer corner of the centre square, where the parapets meet.
  if (!tower) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        if ((sx < 0 ? a.W : a.E) || (sz < 0 ? a.N : a.S)) continue;
        if (dmg >= 1 && hashOf(seed, 100 + sx * 3 + sz) < 0.5) continue;
        if (broken(0, { axis: 'x', at: sz * hw })) continue;
        const x0 = sx < 0 ? -hw : hw - CORNER_M;
        const z0 = sz < 0 ? -hw : hw - CORNER_M;
        up.push(box(x0, x0 + CORNER_M, W.breast, W.breast + W.merlonH, z0, z0 + CORNER_M, lod));
        if (lod < 2) dressed.push(box(x0 - 0.025, x0 + CORNER_M + 0.025, W.breast + W.merlonH, WALL_TOP, z0 - 0.025, z0 + CORNER_M + 0.025, lod));
      }
    }
  }
  P.add('upper', M.upper, up);
  P.add('dressed', M.dressed, dressed);
  if (dmg >= 1) {
    // Cracks down both faces of the curtain (lod 0 and 1), and stones fallen at the foot.
    if (lod < 2) {
      for (const r of runs) {
        if (r.e0 !== 'edge' && r.e1 !== 'edge' && r.c1 - r.c0 < 1) continue;
        const c = (r.c0 + r.c1) / 2 + (hashOf(seed, r.at * 7 + r.inward) - 0.5) * 0.8;
        if (Math.abs(c) < tower + 0.1) continue;
        cracks.push(crack(r.axis, c, r.at - r.inward * 0.006, -r.inward, dmg >= 2 ? 1.0 : 1.2, dmg >= 2 ? 1.75 : 3.3, seed + mi));
      }
    }
    P.add('crack', M.crack, cracks, { cast: false });
    P.add('rubble', M.body, rubbleAt(a, dmg, lod, seed));
  }
}

/** A merlon's side on an outer corner of the wall. */
const CORNER_M = 0.62;

/** The pieces of [c0, c1] where `keep(c)` holds, in steps of 0.25 m. */
function solid(c0, c1, keep) {
  const out = [];
  const n = Math.max(1, Math.round((c1 - c0) / 0.25));
  let s = null;
  for (let k = 0; k < n; k++) {
    const q0 = c0 + ((c1 - c0) * k) / n;
    const q1 = c0 + ((c1 - c0) * (k + 1)) / n;
    if (keep((q0 + q1) / 2)) {
      if (s === null) s = q0;
      if (k === n - 1) out.push([s, q1]);
    } else if (s !== null) {
      out.push([s, q0]);
      s = null;
    }
  }
  return out;
}

/** A seeded number 0..1 for the k-th thing of a piece. */
function hashOf(seed, k) {
  const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A crack down a wall's face: a zigzag ribbon a few centimetres wide, in
 * the face's plane at `at` across `axis`, facing `out` (+1/-1), from y0
 * down to y1 around `c` along it.
 */
function crack(axis, c, at, out, y1, y0, seed) {
  const rnd = artRng(seed);
  const pos = [];
  let x = c;
  let y = y0;
  const step = 0.28;
  while (y > y1) {
    const nx = x + (rnd() - 0.5) * 0.32;
    const ny = y - step * (0.7 + rnd() * 0.6);
    const w0 = 0.03 + rnd() * 0.03;
    const w1 = 0.03 + rnd() * 0.03;
    const p = (cc, yy) => (axis === 'x' ? [cc, yy, at] : [at, yy, cc]);
    const q = [p(x - w0, y), p(x + w0, y), p(nx + w1, ny), p(nx - w1, ny)];
    // Wound to face out of the wall.
    // (Unflipped, a quad on a face along x faces -z, one along z faces +x.)
    const flip = axis === 'x' ? out > 0 : out < 0;
    if (flip) pos.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
    else pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    // A branch now and then.
    if (rnd() < 0.3) {
      const bx = nx + (rnd() - 0.5) * 0.5;
      const by = ny + 0.12;
      const r = [p(nx - 0.012, ny), p(nx + 0.012, ny), p(bx + 0.008, by), p(bx - 0.008, by)];
      if (flip) pos.push(...r[0], ...r[2], ...r[1], ...r[0], ...r[3], ...r[2]);
      else pos.push(...r[0], ...r[1], ...r[2], ...r[0], ...r[2], ...r[3]);
    }
    x = nx;
    y = ny;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  boxUV(g);
  return tintGeometry(g);
}

/** Stones fallen from the wall, at the foot of each face of the arms (more and bigger when breaching). */
function rubbleAt(a, dmg, lod, seed) {
  const rnd = artRng(seed + 31);
  const out = [];
  const n = lod === 2 ? (dmg >= 2 ? 3 : 1) : (dmg >= 2 ? 9 : 4) - lod * 2;
  for (const s of [-1, 1]) {
    for (let k = 0; k < n; k++) {
      const along = (rnd() - 0.5) * 2.6;
      const off = W.hw + 0.15 + rnd() * (dmg >= 2 ? 0.9 : 0.6);
      const w = 0.25 + rnd() * (dmg >= 2 ? 0.45 : 0.3);
      const h = 0.18 + rnd() * 0.22;
      const g = slab(w, h, w * (0.6 + rnd() * 0.5), { seed: seed + k * 7 + s, bevel: 0.03, wobble: 0.03, tilt: 0.15, tone: 0.1, grime: 0.3 });
      g.rotateY(rnd() * Math.PI);
      // Across the wall's line (E-W if it has an E or W arm, else N-S).
      const ew = a.E || a.W || (!a.N && !a.S);
      if (ew) g.translate(along, 0, s * off);
      else g.translate(s * off, 0, along);
      out.push(g);
    }
    // Breaching: a heap of broken masonry against the foot of the breach.
    if (dmg >= 2) {
      // A lumpy mound of broken core and mortar (a squashed, dented ball half sunk), stones on it.
      const heap = new IcosahedronGeometry(1, lod === 2 ? 0 : lod ? 1 : 2);
      const p = heap.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const k = 0.8 + 0.35 * hashOf(seed + s, Math.round(x * 5) * 97 + Math.round(y * 5) * 13 + Math.round(z * 5));
        p.setXYZ(i, x * k * 1.5, y * k * 0.8, z * k * 0.85);
      }
      heap.computeVertexNormals();
      const ew = a.E || a.W || (!a.N && !a.S);
      if (ew) heap.translate(0, -0.15, s * (W.hw + 0.45));
      else heap.rotateY(Math.PI / 2).translate(s * (W.hw + 0.45), -0.15, 0);
      boxUV(heap);
      out.push(tintGeometry(heap, (x, y) => 0.42 + 0.25 * Math.min(1, Math.max(0, y))));
      for (let k = 0; k < 5 - lod * 2; k++) {
        const g = slab(0.3 + rnd() * 0.3, 0.2 + rnd() * 0.15, 0.3 + rnd() * 0.25, { seed: seed + 50 + k, bevel: 0.03, wobble: 0.03, tilt: 0.2, tone: 0.1 });
        g.rotateY(rnd() * 3).rotateX((rnd() - 0.5) * 0.6);
        const al = (rnd() - 0.5) * 1.8;
        const off = W.hw + 0.25 + rnd() * 0.5;
        if (ew) g.translate(al, 0.3 + rnd() * 0.25, s * off);
        else g.translate(s * off, 0.3 + rnd() * 0.25, al);
        out.push(g);
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ towers

/** An arched opening's dark recess on a face (a window), w wide, h to the springing, in the plane z = at facing +z or -z. */
function archedPanel(w, h, y0, at, face, lod) {
  const s = new Shape();
  const seg = lod === 0 ? 8 : 4;
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  for (let k = 1; k <= seg; k++) {
    const t = (k / seg) * Math.PI;
    s.lineTo(Math.cos(t) * (w / 2), h + Math.sin(t) * (w / 2));
  }
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false, curveSegments: seg });
  g.deleteAttribute('uv');
  g.translate(0, y0, at + (face > 0 ? -0.025 : -0.005));
  if (face < 0) g.rotateY(Math.PI);
  g.computeVertexNormals();
  boxUV(g);
  return tintGeometry(g);
}

/** The dressed surround of an arched window (lod 0): a ring of stones round its head, a sill. */
function archSurround(w, h, y0, z, lod) {
  const out = [];
  const n = lod === 0 ? 7 : 3;
  const R = w / 2 + 0.11;
  for (let k = 0; k < n; k++) {
    const t0 = (k / n) * Math.PI;
    const t1 = ((k + 1) / n) * Math.PI;
    const tm = (t0 + t1) / 2;
    const len = (R - 0.04) * (t1 - t0) * 0.96;
    const g = new BoxGeometry(len, 0.13, 0.06);
    g.rotateZ(tm + Math.PI / 2);
    g.translate(Math.cos(tm) * (w / 2 + 0.06), y0 + h + Math.sin(tm) * (w / 2 + 0.06), z);
    out.push(tintGeometry(boxUV(g)));
  }
  const sill = new BoxGeometry(w + 0.2, 0.08, 0.1);
  sill.translate(0, y0 - 0.04, z);
  out.push(tintGeometry(boxUV(sill)));
  return out;
}

/** A square tower over the middle of a piece: body, string courses, windows, a hipped roof of tiles. */
function squareTower(P, M, { lod, dmg, seed }) {
  const T = W.square;
  const h = T.half;
  const top = dmg >= 2 ? 5.9 : T.top;
  // (Its footing and string course a little higher than the curtain's they meet: no two tops in one plane.)
  P.add('foot', M.foot, box(-h - W.footOut, h + W.footOut, 0, W.footH + 0.03, -h - W.footOut, h + W.footOut, lod, 0.92));
  P.add('upper', M.upper, box(-h, h, W.footH, top, -h, h, lod));
  const dressed = [];
  const dark = [];
  if (lod < 2) {
    // String courses at the walk and under the eaves; quoins up the corners (lod 0).
    dressed.push(box(-h - 0.06, h + 0.06, W.cornice[0] - 0.02, W.cornice[1] + 0.03, -h - 0.06, h + 0.06, lod));
    if (dmg < 2) dressed.push(box(-h - 0.1, h + 0.1, top - 0.2, top, -h - 0.1, h + 0.1, lod));
    if (lod === 0) {
      for (let y = W.footH, k = 0; y < top - 0.4; y += 0.5, k++) {
        const long = k % 2 ? 0.55 : 0.32;
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const ax = k % 2 ? long : 0.32;
          const az = k % 2 ? 0.32 : long;
          dressed.push(box(sx < 0 ? -h - 0.012 : h - ax, sx < 0 ? -h + ax : h + 0.012, y, y + 0.48, sz < 0 ? -h - 0.012 : h - az, sz < 0 ? -h + az : h + 0.012, lod));
        }
      }
    }
  }
  // Two arched windows on each face of the storey over the walk.
  const wy = 4.75;
  for (const face of [0, 1, 2, 3]) {
    for (const x of [-0.62, 0.62]) {
      const g = archedPanel(0.5, 0.75, wy, h + 0.01, 1, lod).translate(x, 0, 0);
      const s = lod < 2 ? archSurround(0.5, 0.75, wy, h + 0.02, lod).map((q) => q.translate(x, 0, 0)) : [];
      for (const q of [g, ...s]) q.rotateY((face * Math.PI) / 2);
      dark.push(g);
      dressed.push(...s);
    }
  }
  P.add('dressed', M.dressed, dressed);
  P.add('dark', M.dark, dark, { cast: false });
  if (dmg >= 2) {
    // The roof fallen in, the top broken: a few stones standing up from the walls' head.
    const up = [];
    const rnd = artRng(seed + 5);
    for (let k = 0; k < 10; k++) {
      const t = rnd() * 4;
      const side = Math.floor(t);
      const f = (t - side) * 2 * h - h;
      const [x, z] = [[f, -h + 0.25], [h - 0.25, f], [f, h - 0.25], [-h + 0.25, f]][side];
      const g = slab(0.5, 0.25 + rnd() * 0.6, 0.5, { seed: seed + k, bevel: 0.02, wobble: 0.03 });
      g.translate(x, top, z);
      up.push(g);
    }
    P.add('upper', M.upper, up);
    return;
  }
  // A hipped roof of tiles from the eaves over the cornice to an apex.
  const eaveY = top - 0.05;
  const o = h + 0.32;
  const apex = [0, eaveY + T.roof, 0];
  const tiles = [];
  for (const q of [[[-o, eaveY, o], [o, eaveY, o]], [[o, eaveY, o], [o, eaveY, -o]], [[o, eaveY, -o], [-o, eaveY, -o]], [[-o, eaveY, -o], [-o, eaveY, o]]]) {
    tiles.push(...tiledRoof([q[0], q[1], apex, apex], { lod, seed: seed + q[0][0] * 3 + q[0][2], pitch: 0.36, antefix: lod === 0 }).tiles);
  }
  if (lod < 2) {
    // Ridge tiles down the hips, and the bronze finial's stand at the apex.
    for (const [x, z] of [[-o, o], [o, o], [o, -o], [-o, -o]]) tiles.push(hipRidge([x, eaveY, z], apex, lod));
  }
  P.add('roof', M.tile, tiles);
}

/** A row of ridge tiles from a to b (a roof's hip), a half pipe. */
function hipRidge(a, b, lod) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const l = Math.hypot(dx, dy, dz);
  const g = new CylinderGeometry(0.085, 0.085, l, lod ? 6 : 10, 1, true, 0, Math.PI);
  g.rotateX(Math.PI / 2);
  g.rotateZ(Math.PI / 2);
  g.rotateX(-Math.asin(dy / l));
  g.rotateY(Math.atan2(dx, dz));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.04, (a[2] + b[2]) / 2);
  boxUV(g);
  return tintGeometry(g, () => 0.92);
}

/** A round (sixteen-sided) tower flanking a gate, battered at its foot, under a cone of tiles. */
function roundTower(P, M, { lod, dmg, seed }) {
  const T = W.round;
  const sides = lod === 2 ? 8 : T.sides;
  const top = dmg >= 2 ? 6.0 : T.top;
  const prism = (r0, r1, y0, y1, open = false) => {
    const g = new CylinderGeometry(r1, r0, y1 - y0, sides, lod === 0 && y0 < 1 ? 3 : 1, open);
    // (A flat face toward each axis: the gate's and the wall's.)
    g.rotateY(Math.PI / sides);
    g.translate(0, (y0 + y1) / 2, 0);
    // Flat-shaded facets: a sixteen-sided tower is cut stone, not a turned pot.
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    boxUV(ng);
    return tintGeometry(ng, (x, y) => grime(y));
  };
  P.add('foot', M.foot, prism(T.r + 0.16, T.r + 0.1, 0, W.footH + 0.03));
  P.add('upper', M.upper, prism(T.r + 0.04, T.r, W.footH, top));
  const dressed = [];
  const dark = [];
  if (lod < 2) {
    dressed.push(prism(T.r + 0.07, T.r + 0.07, W.cornice[0] - 0.02, W.cornice[1] + 0.03));
    if (dmg < 2) dressed.push(prism(T.r + 0.11, T.r + 0.11, top - 0.2, top));
  }
  // Arched windows facing out of the wall's line, each side, and toward the gate's road.
  for (const ry of [0, Math.PI]) {
    for (const x of [-0.55, 0.55]) {
      const g = archedPanel(0.48, 0.8, 4.7, T.r * Math.cos(Math.PI / sides) + 0.01, 1, lod).translate(x * 0.9, 0, 0);
      g.rotateY(ry);
      dark.push(g);
      if (lod < 2) for (const q of archSurround(0.48, 0.8, 4.7, T.r * Math.cos(Math.PI / sides) + 0.02, lod)) dressed.push(q.translate(x * 0.9, 0, 0).rotateY(ry));
    }
  }
  P.add('dressed', M.dressed, dressed);
  P.add('dark', M.dark, dark, { cast: false });
  if (dmg >= 2) return;
  // The cone of tiles, its ridges of imbrices running down it.
  const R = T.r + 0.3;
  const cone = new ConeGeometry(R, T.roof, lod === 2 ? 8 : 24, 1, true);
  cone.translate(0, top - 0.05 + T.roof / 2, 0);
  boxUV(cone);
  const tiles = [tintGeometry(cone, (x, y, z) => 0.92 + 0.08 * Math.sin(Math.atan2(z, x) * 24))];
  if (lod < 2) {
    const n = lod === 0 ? 20 : 10;
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2;
      tiles.push(hipRidge([Math.cos(t) * R, top - 0.05, Math.sin(t) * R], [Math.cos(t) * 0.06, top - 0.05 + T.roof - 0.04, Math.sin(t) * 0.06], 1));
    }
  }
  P.add('roof', M.tile, tiles);
}

// ------------------------------------------------------------------ the gate

/**
 * The gatehouse across a road along z (its wall along x): an arched
 * passage, a gallery storey over it, crenels; the doors tagged 'open' and
 * 'shut'.
 */
function gatehouse(P, M, { lod, dmg, seed }) {
  const G = W.gate;
  const d = G.depth;
  const p = G.pass;
  const top = dmg >= 2 ? 5.0 : G.top;
  const seg = lod === 0 ? 14 : lod === 1 ? 8 : 5;
  // The block with its passage: an outline with the arch cut up into it, carried through its depth.
  const s = new Shape();
  s.moveTo(-W.half, 0);
  s.lineTo(-p, 0);
  s.lineTo(-p, G.spring);
  for (let k = 1; k < seg; k++) {
    const t = Math.PI - (k / seg) * Math.PI;
    s.lineTo(Math.cos(t) * p, G.spring + Math.sin(t) * p);
  }
  s.lineTo(p, G.spring);
  s.lineTo(p, 0);
  s.lineTo(W.half, 0);
  s.lineTo(W.half, top);
  s.lineTo(-W.half, top);
  s.closePath();
  const body = new ExtrudeGeometry(s, { depth: 2 * d, bevelEnabled: false, curveSegments: seg, steps: 1 });
  body.deleteAttribute('uv');
  body.translate(0, 0, -d);
  body.computeVertexNormals();
  boxUV(body);
  P.add('upper', M.upper, tintGeometry(body, (x, y) => grime(y)));
  // Its footing, either side of the passage.
  const foot = [];
  for (const sx of [-1, 1]) foot.push(box(sx < 0 ? -W.half : p - 0.02, sx < 0 ? -p + 0.02 : W.half, 0, W.footH, -d - W.footOut, d + W.footOut, lod, 0.92));
  P.add('foot', M.foot, foot);
  const dressed = [];
  const dark = [];
  const iron = [];
  const wood = [];
  // Voussoirs round the arch on both faces, a keystone standing proud; impost blocks at the springing.
  const nv = lod === 0 ? 13 : lod === 1 ? 7 : 0;
  for (const f of [-1, 1]) {
    for (let k = 0; k < nv; k++) {
      if (dmg >= 2 && k === (nv - 1) / 2) continue; // (the keystone fallen)
      const t0 = (k / nv) * Math.PI;
      const t1 = ((k + 1) / nv) * Math.PI;
      const key = k === (nv - 1) / 2;
      const r0 = p;
      const r1 = p + (key ? 0.52 : 0.42);
      const g = voussoir(r0, r1, t0 + 0.006, t1 - 0.006, key ? 0.09 : 0.05);
      g.translate(0, G.spring, 0);
      if (f > 0) g.translate(0, 0, d);
      else g.rotateY(Math.PI).translate(0, 0, -d);
      dressed.push(g);
    }
    if (lod < 2) {
      for (const sx of [-1, 1]) dressed.push(box(sx < 0 ? -p - 0.32 : p - 0.02, sx < 0 ? -p + 0.02 : p + 0.32, G.spring - 0.22, G.spring, f > 0 ? d - 0.02 : -d - 0.06, f > 0 ? d + 0.06 : -d + 0.02, lod));
      // String course at the walk, the cornice under the crenels.
      dressed.push(box(-W.half, W.half, W.cornice[0], W.cornice[1], f > 0 ? d - 0.02 : -d - W.corniceOut, f > 0 ? d + W.corniceOut : -d + 0.02, lod));
      if (dmg < 2) dressed.push(box(-W.half, W.half, top - 0.2, top, f > 0 ? d - 0.02 : -d - 0.1, f > 0 ? d + 0.1 : -d + 0.02, lod));
    }
    // The gallery's arched windows over the passage (the Porta Palatina's upper storeys).
    if (dmg < 2 || lod === 2) {
      for (const x of [-1.15, 0, 1.15]) {
        const g = archedPanel(0.52, 0.7, 4.55, d + 0.01, 1, lod).translate(x, 0, 0);
        if (f < 0) g.rotateY(Math.PI);
        dark.push(g);
        if (lod < 2) for (const q of archSurround(0.52, 0.7, 4.55, d + 0.02, lod)) dressed.push(f < 0 ? q.translate(x, 0, 0).rotateY(Math.PI) : q.translate(x, 0, 0));
      }
    }
    // Torches in iron brackets either side of the arch.
    if (lod < 2) {
      for (const sx of [-1, 1]) {
        const [tx, ty] = G.torch;
        const z = f * (d + 0.02);
        const arm = new BoxGeometry(0.04, 0.04, 0.32);
        arm.translate(sx * tx, ty - 0.1, z + f * 0.14);
        iron.push(tintGeometry(boxUV(arm)));
        const ring = new CylinderGeometry(0.06, 0.05, 0.08, 8, 1, true);
        ring.translate(sx * tx, ty, z + f * 0.28);
        iron.push(tintGeometry(boxUV(ring)));
        const stick = new CylinderGeometry(0.035, 0.03, 0.5, 6, 1);
        stick.rotateX(f * 0.25);
        stick.translate(sx * tx, ty + 0.12, z + f * 0.3);
        wood.push(tintGeometry(boxUV(stick), (x, y) => (y > ty + 0.3 ? 0.25 : 0.8)));
      }
    }
  }
  P.add('dressed', M.dressed, dressed);
  P.add('dark', M.dark, dark, { cast: false });
  if (iron.length) P.add('iron', M.iron, iron);
  if (wood.length) P.add('torch', M.wood, wood);
  // The parapets and merlons on its top, round all four sides.
  const up = [];
  if (dmg < 2) {
    const pT = W.parT;
    const runs = [
      { axis: 'x', at: -d, inward: 1, c0: -W.half, c1: W.half }, { axis: 'x', at: d, inward: -1, c0: -W.half, c1: W.half },
      { axis: 'z', at: -W.half, inward: 1, c0: -d + pT, c1: d - pT }, { axis: 'z', at: W.half, inward: -1, c0: -d + pT, c1: d - pT },
    ];
    const bTop = top + (W.breast - W.walk);
    let mi = 0;
    for (const r of runs) {
      up.push(boxAlong(r.axis, r.c0, r.c1, r.at, r.at + r.inward * pT, top, bTop - (lod < 2 ? W.cap : 0), lod));
      if (lod < 2) dressed.push(boxAlong(r.axis, r.c0, r.c1, r.at - r.inward * 0.02, r.at + r.inward * (pT + 0.02), bTop - W.cap, bTop, lod));
      const n = r.axis === 'x' ? 4 : 3;
      for (let k = 0; k < n; k++) {
        mi++;
        if (dmg >= 1 && hashOf(seed, mi) < 0.45) continue;
        const span = r.c1 - r.c0;
        const c = r.c0 + ((k + 0.5) * span) / n;
        const half = Math.min(W.merlonW, span / n - 0.35) / 2;
        up.push(boxAlong(r.axis, c - half, c + half, r.at, r.at + r.inward * pT, bTop, bTop + W.merlonH, lod));
        if (lod < 2) dressed.push(boxAlong(r.axis, c - half - 0.02, c + half + 0.02, r.at - r.inward * 0.025, r.at + r.inward * (pT + 0.025), bTop + W.merlonH, bTop + W.merlonH + W.cap, lod));
      }
    }
  } else {
    // Breaching: the top broken off in steps.
    const rnd = artRng(seed + 9);
    for (let k = 0; k < (lod === 2 ? 4 : 9); k++) {
      const x = -W.half + 0.25 + rnd() * (2 * W.half - 0.5);
      const z = (rnd() < 0.5 ? -1 : 1) * (d - 0.3);
      up.push(slab(0.55, 0.2 + rnd() * 0.7, 0.55, { seed: seed + k, bevel: 0.02, wobble: 0.03 }).translate(x, top, z));
    }
  }
  P.add('upper', M.upper, up);
  // Its doors: two leaves of studded boards in the passage's middle, hinged at its sides; a board
  // tympanum fixed over them under the arch.
  const lh = G.spring;
  const leafW = p;
  const leaves = { open: [], shut: [] };
  const studs = { open: [], shut: [] };
  for (const sx of [-1, 1]) {
    const leaf = () => {
      const g = doorLeaf(leafW - 0.02, lh - 0.02, seed + sx, lod);
      g.translate(-sx * (leafW / 2), 0.01, 0);
      return g;
    };
    const stud = () => {
      const out = [];
      if (lod !== 0) return out;
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 3; c++) {
          const b = new BoxGeometry(0.045, 0.045, 0.03);
          b.translate(-sx * (0.18 + c * ((leafW - 0.36) / 2)), 0.3 + r * ((lh - 0.6) / 5), 0.035);
          out.push(tintGeometry(boxUV(b)));
        }
      }
      return out;
    };
    // Shut: across the passage; open: swung back flat against its side (into the town's side, -z).
    const place = (g, open) => {
      if (open) g.rotateY(-sx * Math.PI / 2 * 0.96);
      g.translate(sx * p, 0, 0);
      return g;
    };
    const hang = dmg >= 1 && sx > 0;
    for (const st of ['open', 'shut']) {
      const open = st === 'open';
      const g = place(leaf(), open);
      const t = stud().map((q) => place(q, open));
      if (hang) {
        // Battered: one leaf hangs from its lower pin, or lies in the road when breaching.
        if (dmg >= 2) {
          const down = doorLeaf(leafW - 0.02, lh - 0.02, seed + 5, lod);
          down.rotateX(-Math.PI / 2).translate(0.35, 0.08, 1.4);
          leaves[st].push(down);
          continue;
        }
        g.translate(-sx * p, 0, 0).rotateZ(0.12).translate(sx * p, -0.05, 0);
      }
      leaves[st].push(g);
      studs[st].push(...t);
    }
  }
  for (const st of ['open', 'shut']) {
    P.add('door', M.wood, leaves[st], { when: st });
    if (studs[st].length) P.add('stud', M.iron, studs[st], { when: st });
  }
  if (lod < 2) {
    // The tympanum under the arch, over the doors.
    const t = new Shape();
    t.moveTo(-p, 0);
    t.lineTo(p, 0);
    for (let k = 1; k < seg; k++) {
      const a = (k / seg) * Math.PI;
      t.lineTo(Math.cos(a) * p, Math.sin(a) * p);
    }
    t.lineTo(-p, 0);
    const g = new ExtrudeGeometry(t, { depth: 0.06, bevelEnabled: false, curveSegments: seg });
    g.deleteAttribute('uv');
    g.translate(0, G.spring, -0.03);
    g.computeVertexNormals();
    P.add('board', M.wood, tintGeometry(boxUV(g), () => 0.7));
  }
  if (dmg >= 1) {
    const cracks = [];
    if (lod < 2) {
      for (const f of [-1, 1]) cracks.push(crack('x', -1.55 + hashOf(seed, f) * 0.3, f * (d + 0.006), f, dmg >= 2 ? 0.6 : 1.4, top - 0.4, seed + f));
    }
    P.add('crack', M.crack, cracks, { cast: false });
    P.add('rubble', M.body, rubbleAt({ E: true, W: true }, dmg, lod, seed).map((g) => {
      // (Pushed out past the gatehouse's deeper faces.)
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + Math.sign(pos.getZ(i)) * (d - W.hw));
      return g;
    }));
  }
}

/** One wedge of an arch's ring, from radius r0 to r1 between angles t0 and t1, `t` thick standing out of the face (+z). */
function voussoir(r0, r1, t0, t1, t) {
  const s = new Shape();
  s.moveTo(Math.cos(t0) * r0, Math.sin(t0) * r0);
  s.lineTo(Math.cos(t0) * r1, Math.sin(t0) * r1);
  s.lineTo(Math.cos(t1) * r1, Math.sin(t1) * r1);
  s.lineTo(Math.cos(t1) * r0, Math.sin(t1) * r0);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: t + 0.02, bevelEnabled: false });
  g.deleteAttribute('uv');
  g.translate(0, 0, -0.02);
  g.computeVertexNormals();
  boxUV(g);
  return tintGeometry(g);
}

// ------------------------------------------------------------------ pieces

/**
 * A piece by its kit key (walls/wallLayout.js wallPiece): 'wall:LOOK:SHAPE[+TOWER]:DMG',
 * 'wall:LOOK:gate:DMG' or 'wall:LOOK:stub:0'. Returns { group, meshes, triangles }.
 */
export function buildWallPiece(key, lod = 0) {
  const { look, shape, tower, damage } = parseWallKey(key);
  const M = wallMaterials(look);
  const P = new TaggedParts(key);
  const seed = 17 + damage * 101 + (shape.length * 7) + (tower ? tower.length * 13 : 0);
  if (shape === 'gate') {
    gatehouse(P, M, { lod, dmg: damage, seed });
  } else if (shape === 'stub') {
    // A length of wall from the tile's edge into the watchtower beside it (models/turris.js stands back from its footprint's edge).
    stub(P, M, lod);
  } else {
    const a = armsOf(CANON[shape]);
    const t = tower === 'square' ? W.square.half : tower === 'round' ? Math.sqrt(W.round.r ** 2 - W.hw ** 2) - 0.05 : 0;
    curtain(P, M, a, { lod, tower: t, dmg: tower ? Math.min(damage, 1) : damage, seed });
    if (tower === 'square') squareTower(P, M, { lod, dmg: damage, seed });
    else if (tower === 'round') roundTower(P, M, { lod, dmg: damage, seed });
  }
  return P.build();
}

/** The stub: 1.25 m of wall past the tile's +x edge, its parapets and merlons in step with the tile's. */
function stub(P, M, lod) {
  const x0 = W.half - 0.01;
  const x1 = W.half + 1.25;
  const hw = W.hw;
  P.add('foot', M.foot, box(x0, x1, 0, W.footH, -hw - W.footOut, hw + W.footOut, lod, 0.92));
  P.add('body', M.body, box(x0, x1, W.footH, W.walk, -hw, hw, lod));
  const up = [];
  const dressed = [];
  for (const s of [-1, 1]) {
    const a0 = s * hw;
    const a1 = s * (hw - W.parT);
    up.push(boxAlong('x', x0, x1, a0, a1, W.walk, W.breast - (lod < 2 ? W.cap : 0), lod));
    if (lod < 2) {
      dressed.push(boxAlong('x', x0, x1, a0 + s * W.corniceOut, s * (hw - 0.3), W.cornice[0], W.cornice[1], lod));
      dressed.push(boxAlong('x', x0, x1, a0 + s * 0.02, a1 - s * 0.02, W.breast - W.cap, W.breast, lod));
    }
    // The merlon at 2 + 2/3 (the next tile's first, at the same place along the line).
    const m = 2 * W.merlonP;
    up.push(boxAlong('x', m - W.merlonW / 2, m + W.merlonW / 2, a0, a1, W.breast, W.breast + W.merlonH, lod));
    if (lod < 2) dressed.push(boxAlong('x', m - W.merlonW / 2 - 0.02, m + W.merlonW / 2 + 0.02, a0 + s * 0.025, a1 - s * 0.025, W.breast + W.merlonH, WALL_TOP, lod));
  }
  P.add('upper', M.upper, up);
  P.add('dressed', M.dressed, dressed);
}

/** Every kit key a look can show (the lab's and the warm-up's list). */
export function wallKeys(look) {
  const out = [];
  for (const shape of Object.keys(CANON)) {
    for (const tower of ['', '+square', '+round']) for (let d = 0; d < 3; d++) out.push(`wall:${look}:${shape}${tower}:${d}`);
  }
  for (let d = 0; d < 3; d++) out.push(`wall:${look}:gate:${d}`);
  out.push(`wall:${look}:stub:0`);
  return out;
}
