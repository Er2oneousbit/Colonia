/**
 * models/aqueduct.js
 * ----------------------------------------------------------------------------
 * The aqueduct of the 3D look, one 4 m tile a piece (aqueducts/
 * aqueductLayout.js picks the piece), from the arcades Rome carried its
 * water on rather than from the 2D sprites:
 *
 *   - The arcade: piers of squared stone (the Aqua Claudia's peperino over
 *     the Campagna, the Pont du Gard's limestone, Segovia's granite; brick-
 *     faced concrete for the Aqua Alexandrina) on a plinth, an impost at
 *     the springing, a semicircular arch of voussoirs, a string course
 *     over the arches. An arch a tile, its piers straddling the tile's
 *     edges, so any two tiles meet on a pier. Where the line turns,
 *     branches or ends, a solid pier stands at the tile's middle, its arms
 *     pierced by a narrow arch each (a long arcade's turns were carried on
 *     heavier piers).
 *   - The specus on top, as Frontinus and Vitruvius describe it: a channel
 *     about two feet wide between walls of masonry, lined with opus
 *     signinum (lime with crushed tile, which water does not get through:
 *     the lining's pink), its floor and sides sound with a band of sinter
 *     where the water stands; covered with stone slabs, here only over the
 *     piers (the channel runs open between them so the water is seen, as
 *     the open channel along the top of Segovia's arcade).
 *   - Over a road, one wide arch of dressed travertine, its piers in
 *     rusticated blocks and a blank tablet in the attic over it: the
 *     arches that carried the Aqua Claudia over the Via Labicana and the
 *     Via Praenestina (the Porta Maggiore), high enough for a cart.
 *   - Into a reservoir the channel steps down from the arcade to the
 *     castellum's inlet in a stair of drops (models/castellum.js meets it
 *     at AQ.inlet), the water tumbling down each.
 *
 * States by the parts' tags (models.js partShows): 'full' the water in the
 * channel and the damp of its leaks down the piers, 'flow' its falls, 'dry'
 * the silt left on the channel's floor, 'ice' its margins frozen in a hard
 * frost (only on running water).
 *
 * Seams. Every piece runs its plinth, half pier, string course, channel,
 * coping and slabs to the tile's edge at the same heights and widths on
 * its line, so any two meet at any turn; the stone's textures are read at
 * the world's metres (materials.js worldUV), and so is the channel's water,
 * whose ripples run on from tile to tile.
 *
 * Metres, the tile's middle at the origin, y up, a piece along its
 * canonical arms (E +x, S +z, W -x, N -z). Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, ExtrudeGeometry, Shape, Vector2, BufferGeometry, Float32BufferAttribute, MeshPhysicalMaterial, Color } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { material, patchLook, surfaceTextures, streamMaterial, iceMaterial } from '../materials.js';
import { artRng, smoothstep } from '../texgen.js';
import { slab, TaggedParts } from './masonry.js';
import { parseAqueductKey } from '../aqueducts/aqueductLayout.js';

/** The aqueduct's measures (metres): the reservoir, the tests, the lab and the cover read them. */
export const AQ = Object.freeze({
  half: 2,
  hw: 0.65, // the arcade's half thickness
  span: 1.4, // a straight's arch: its half opening (2.8 m); the half piers fill the rest to the edge
  roadSpan: 1.56, // the road's arch: 3.1 m, a cart's width and more
  footH: 0.3,
  footOut: 0.06,
  spring: 2.05, // the impost's top, where the arches spring
  impost: 0.14,
  ring: 0.36, // the voussoirs' depth
  body: 3.72, // the arcade's top, under the string course
  course: Object.freeze([3.72, 3.86]),
  courseOut: 0.07,
  ch: 0.34, // the channel's inner half width (0.68 m: the Aqua Marcia's specus is about 0.9)
  liner: 0.05, // the signinum's thickness on the channel's walls
  floor: 3.98, // the channel's floor
  wallTop: 4.62,
  coping: 0.1,
  copeOut: 0.03,
  water: 4.5, // near the brim: from the game's camera, 30 degrees down, the near wall hides a deeper channel's water
  slabL: 0.42, // a cover slab's half over the pier at each edge
  slabH: 0.13,
  slabW: 0.48,
  smallSpring: 1.6, // a junction arm's narrow arch
  inlet: 2.2, // the channel's floor where it steps down into a reservoir, at the tile's edge
  steps: 4,
});
/** The top of the cover slabs: the aqueduct's height. */
export const AQ_TOP = AQ.wallTop + AQ.coping + AQ.slabH;

/**
 * The stones of the three looks (aqueducts/aqueductLayout.js aqueductLookOf):
 * the arcade's body, its plinth, its dressed stone (impost, string course,
 * coping, slabs) and its arch rings. The walls' materials, so no new program
 * and no new texture.
 */
export const AQUEDUCT_STONES = Object.freeze({
  tufa: Object.freeze({ body: 'ashlar', foot: 'ashlar', dressed: 'travertine', ring: 'travertine' }),
  lime: Object.freeze({ body: 'ashlarLime', foot: 'ashlarLime', dressed: 'travertine', ring: 'travertine' }),
  brick: Object.freeze({ body: 'brick', foot: 'ashlarLime', dressed: 'travertine', ring: 'brick' }),
});

/** The water in the channel: running, its ripples read at the world's metres so they run on across the tiles. */
let WATER = null;
export function aqueductWater() {
  const nm = surfaceTextures('ripples', 'aqueduct').normalMap;
  // (After the look is reset the textures are new: so is the material.)
  if (WATER && WATER.normalMap === nm) return WATER;
  WATER = new MeshPhysicalMaterial({
    color: new Color('#3a7f8a'),
    roughness: 0.05,
    metalness: 0,
    ior: 1.333,
    normalMap: nm,
    normalScale: new Vector2(0.7, 0.7),
    transparent: true,
    opacity: 0.9,
    // (The faint clear coat of the look's water: the same features, one program.)
    clearcoat: 1e-4,
    clearcoatRoughness: 0.05,
  });
  WATER.name = 'aqueduct-water';
  patchLook(WATER, { snow: 0, wet: 0, worldUV: true });
  return WATER;
}

/**
 * The still water of a castellum's tank (models/castellum.js): deep and
 * green, its reflection of the sky dulled (a tank 8 m across under the open
 * sky read as a swimming bath with the well's glassy water), its own copy
 * of the ripples drawn large and drifting slowly (at the well's 1.2 m they
 * tiled across the tank).
 */
let POOL = null;
export function poolWater() {
  const t = surfaceTextures('ripples', 'castellum');
  if (POOL && POOL.normalMap === t.normalMap) return POOL;
  t.normalMap.repeat.set(1 / 3.4, 1 / 3.4);
  POOL = new MeshPhysicalMaterial({
    color: new Color('#173f3a'),
    roughness: 0.1,
    metalness: 0,
    ior: 1.333,
    normalMap: t.normalMap,
    normalScale: new Vector2(0.35, 0.35),
    transparent: true,
    opacity: 0.9,
    envMapIntensity: 0.55,
    clearcoat: 1e-4,
    clearcoatRoughness: 0.1,
  });
  POOL.name = 'castellum-water';
  patchLook(POOL, { snow: 0, wet: 0, worldUV: true });
  return POOL;
}

/**
 * The channel's water runs (every aqueduct at once: one material): its
 * ripples slide one way across the world, about a metre a second, whatever
 * way a tile's channel runs (the world's UVs have no "along"). A
 * castellum's tank drifts.
 */
export function aqueductLife(t) {
  if (WATER) WATER.normalMap.offset.set(t * 0.62, t * 0.48);
  if (POOL) POOL.normalMap.offset.set(t * 0.011, -t * 0.008);
}

/** The materials of a look. */
export function aqueductMaterials(look) {
  const L = AQUEDUCT_STONES[look] || AQUEDUCT_STONES.lime;
  const stone = (s) => material(`wall-${s}`, { surface: s, worldUV: true, snow: 1 });
  return {
    body: stone(L.body), foot: stone(L.foot), dressed: stone(L.dressed), ring: stone(L.ring),
    // Opus signinum: the channel's lining, pink with its crushed tile.
    lining: material('aq-signinum', { surface: 'cocciopesto', worldUV: true, snow: 0.7 }),
    // What a dry channel keeps: silt and dead leaves, dull.
    // (The earth's grain read at the world's metres, tinted to a grey-brown mud: a plain colour read as paper.)
    silt: material('aq-silt', { surface: 'earth', worldUV: true, color: 0xb8a487, snow: 0.8, wet: 0.6 }),
    // The damp under a leaking joint, darker and greener down the pier.
    leak: material('aq-leak', { color: 0x26332a, roughness: 0.5, opacity: 0.32, snow: 0, wet: 0 }),
    water: aqueductWater(),
    sheet: streamMaterial(true),
    ice: iceMaterial(),
  };
}

/** Dirt splashed up the foot of the piers: a vertex colour by height. */
const grime = (y) => 0.8 + 0.2 * smoothstep(0.0, 1.4, y);

/** A box from (x0, y0, z0) to (x1, y1, z1), tinted by height (and `k`). */
function box(x0, x1, y0, y1, z0, z1, k = 1, f = null) {
  const g = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  boxUV(g);
  return tintGeometry(g, f || ((x, y) => k * grime(y)));
}

/** An outline in the x-y plane (points [x, y]) carried from z0 to z1. */
function extrude(points, z0, z1, k = 1) {
  const s = new Shape(points.map(([x, y]) => new Vector2(x, y)));
  const g = new ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1, steps: 1 });
  g.deleteAttribute('uv');
  g.translate(0, 0, z0);
  g.computeVertexNormals();
  boxUV(g);
  return tintGeometry(g, (x, y) => k * grime(y));
}

/** A flat rectangle at height y over x0..x1, z0..z1 facing up, its UVs in metres (k: a tint, or f(x, z)). */
function flat(x0, x1, z0, z1, y, f = null) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0], 3));
  g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new Float32BufferAttribute([x0, z0, x0, z1, x1, z1, x1, z0], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return tintGeometry(g, f ? (x, yy, z) => f(x, z) : null);
}

/** Turn a canonical (+x) arm's geometry to arm `a` (0 E, 1 S, 2 W, 3 N): a quarter turn takes +x to +z. */
function toArm(g, a) {
  if (a) g.rotateY((-a * Math.PI) / 2);
  return g;
}

/** Points of a semicircle from angle PI to 0 about (cx, cy), radius r, `n` segments (the ends left out). */
function arc(cx, cy, r, n) {
  const out = [];
  for (let k = 1; k < n; k++) {
    const t = Math.PI - (k / n) * Math.PI;
    out.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  return out;
}

/** One wedge of an arch's ring about (cx, cy) in the x-y plane, from r0 to r1 between t0 and t1, standing `t` out of the face at z (out +1 or -1). */
function voussoir(cx, cy, r0, r1, t0, t1, z, out, t) {
  const pts = [[Math.cos(t0) * r0, Math.sin(t0) * r0], [Math.cos(t0) * r1, Math.sin(t0) * r1], [Math.cos(t1) * r1, Math.sin(t1) * r1], [Math.cos(t1) * r0, Math.sin(t1) * r0]];
  const g = extrude(pts.map(([x, y]) => [x + cx, y + cy]), 0, t + 0.02);
  g.translate(0, 0, -0.02);
  if (out < 0) g.rotateY(Math.PI).translate(2 * cx, 0, 0);
  return g.translate(0, 0, z);
}

/**
 * The arch rings of an opening of half width r about x = cx, springing at
 * y0, on both faces: `n` voussoirs (a keystone in the middle standing
 * proud), `depth` deep, `t` out of the face.
 */
function archRing(cx, y0, r, n, depth, t, keyExtra = 0.08) {
  const out = [];
  for (const f of [1, -1]) {
    for (let k = 0; k < n; k++) {
      const key = n % 2 === 1 && k === (n - 1) / 2;
      const t0 = Math.PI - (k / n) * Math.PI;
      const t1 = Math.PI - ((k + 1) / n) * Math.PI;
      out.push(voussoir(cx, y0, r, r + depth + (key ? keyExtra : 0), t1 + 0.005, t0 - 0.005, f * AQ.hw, f, key ? t + 0.03 : t));
    }
  }
  return out;
}

// ------------------------------------------------------------------ plan regions

/**
 * Cells over the tile's plan (merged into runs along x): the grid cut at
 * `cuts` both ways, each cell kept where `keep(x, z)` holds at its middle.
 */
function cellsWhere(keep, cuts) {
  const H = AQ.half;
  const xs = [...new Set([-H, H, ...cuts.filter((c) => c > -H && c < H)])].sort((a, b) => a - b);
  const out = [];
  for (let zi = 0; zi + 1 < xs.length; zi++) {
    let run = null;
    for (let xi = 0; xi + 1 < xs.length; xi++) {
      const on = keep((xs[xi] + xs[xi + 1]) / 2, (xs[zi] + xs[zi + 1]) / 2);
      if (on) {
        if (run) run.x1 = xs[xi + 1];
        else run = { x0: xs[xi], x1: xs[xi + 1], z0: xs[zi], z1: xs[zi + 1] };
      } else if (run) {
        out.push(run);
        run = null;
      }
    }
    if (run) out.push(run);
  }
  return out;
}

/**
 * Is (x, z) within `w` of the line through the middle and out along each
 * arm, arm k (0..3: E, S, W, N) reaching `reach(k)` from the middle?
 */
function nearLine(x, z, w, reach) {
  if (Math.abs(x) <= w && Math.abs(z) <= w) return true;
  return (x >= 0 && x <= reach(0) && Math.abs(z) <= w)
    || (z >= 0 && z <= reach(1) && Math.abs(x) <= w)
    || (x <= 0 && x >= -reach(2) && Math.abs(z) <= w)
    || (z <= 0 && z >= -reach(3) && Math.abs(x) <= w);
}

/**
 * How far from the middle a piece's top and its channel run along each arm
 * (arms E, S, W, N: 'a', 'r' or '-'; `full` the letters of a road arch's
 * line, there whatever its neighbours; `caps` those of them with no
 * neighbour, where the channel stops `cap` short of the edge). The top
 * stops at the middle's pier toward a reservoir (the stair down is built on
 * its own: cascade); the channel opens through the pier's side into it.
 */
function reaches(arms, { caps = '', cap = 0, full = '' } = {}) {
  const H = AQ.half;
  const L = 'ESWN';
  const arcade = (k) => arms[k] === 'a' || full.includes(L[k]);
  return {
    top: (k) => (arcade(k) ? H : 0),
    chan: (k) => (arms[k] === 'r' ? AQ.hw : arcade(k) ? (caps.includes(L[k]) ? H - cap : H) : 0),
  };
}

/**
 * The plan of the arcade's top, as cells: within `o` of the line, less (if
 * `i`) the channel within `i` of it. Returns [{ x0, x1, z0, z1 }].
 */
export function planCells(arms, o, i = 0, opts = {}) {
  const R = reaches(arms, opts);
  const H = AQ.half;
  const cap = opts.cap || 0;
  // (Toward a reservoir the hole runs on to the edge: nothing of the top stands there to cut.)
  const hole = (k) => (arms[k] === 'r' ? H : R.chan(k));
  const keep = (x, z) => nearLine(x, z, o, R.top) && !(i && nearLine(x, z, i, hole));
  return cellsWhere(keep, [-o, o, ...(i ? [-i, i] : []), ...(cap ? [-H + cap, H - cap] : [])]);
}

/** Is (x, z) in the channel (within `i` of the line, as far as it runs each way)? */
function chanAt(arms, i, opts = {}) {
  const R = reaches(arms, opts);
  return (x, z) => nearLine(x, z, i, R.chan);
}

/** The channel's own plan, within `i` of the line: where its floor, water, silt and ice lie. */
export function chanCells(arms, i, opts = {}) {
  const H = AQ.half;
  const cap = opts.cap || 0;
  return cellsWhere(chanAt(arms, i, opts), [-i, i, -AQ.hw, AQ.hw, ...(cap ? [-H + cap, H - cap] : [])]);
}

// ------------------------------------------------------------------ the pieces

/**
 * The top of a piece over its plan: the string course, the channel's walls
 * and signinum lining, its coping, the cover slabs over the edge piers,
 * and the water, silt and ice of its states. `dressedWalls`: a road arch's
 * attic faced in dressed stone.
 */
function top(P, M, arms, lod, { caps = '', full = '', seed = 1, dressedWalls = false } = {}) {
  const o = AQ.hw;
  const i = AQ.ch;
  const cap = caps ? 0.34 : 0;
  const opts = { caps, cap, full };
  const course = planCells(arms, o + AQ.courseOut, 0, opts).map((c) => box(c.x0, c.x1, AQ.course[0], AQ.course[1], c.z0, c.z1, 0.96));
  P.add('dressed', M.dressed, course);
  // The channel's walls (outside the lining) and the lining's skin on their inner faces.
  const walls = planCells(arms, o, i + AQ.liner, opts);
  P.add(dressedWalls ? 'dressed' : 'body', dressedWalls ? M.dressed : M.body, walls.map((c) => box(c.x0, c.x1, AQ.course[1], AQ.wallTop, c.z0, c.z1)));
  // (The skin: the lining between the channel and its walls, split at the water line for its band of sinter.)
  const skin = planCells(arms, i + AQ.liner, i, opts);
  const band = [AQ.water - 0.07, AQ.water + 0.05];
  const lining = [];
  for (const c of skin) {
    if (lod < 2) {
      lining.push(box(c.x0, c.x1, AQ.floor, band[0], c.z0, c.z1, 0.95, () => 0.95));
      lining.push(box(c.x0, c.x1, band[0], band[1], c.z0, c.z1, 1, (x, y) => (y > band[0] + 0.01 && y < band[1] - 0.01 ? 1.25 : 1.12)));
      lining.push(box(c.x0, c.x1, band[1], AQ.wallTop, c.z0, c.z1, 1, () => 1.02));
    } else {
      lining.push(box(c.x0, c.x1, AQ.floor, AQ.wallTop, c.z0, c.z1, 1, () => 1));
    }
  }
  // The channel's floor: the lining's bed from the course up.
  const chan = chanCells(arms, i, opts);
  for (const c of chan) lining.push(box(c.x0, c.x1, AQ.course[1], AQ.floor, c.z0, c.z1, 1, () => 0.9));
  P.add('lining', M.lining, lining);
  // Coping over the walls and the skin, a little proud of the faces.
  const coping = planCells(arms, o + AQ.copeOut, i, opts).map((c) => box(c.x0, c.x1, AQ.wallTop, AQ.wallTop + AQ.coping, c.z0, c.z1, 1));
  P.add('dressed', M.dressed, coping);
  // Cover slabs over the piers at the edges an arcade arm reaches (a capped road arch's open end has none).
  const slabs = [];
  const H = AQ.half;
  for (let a = 0; a < 4; a++) {
    if (!(arms[a] === 'a' || (full.includes('ESWN'[a]) && !caps.includes('ESWN'[a])))) continue;
    const g = lod === 2
      ? box(-AQ.slabL, AQ.slabL, 0, AQ.slabH, -AQ.slabW, AQ.slabW, 1, () => 0.98)
      // (One stone for every edge, square and unwobbled: the next tile's half of it, turned a half turn, is its mirror.)
      : slab(AQ.slabL * 2, AQ.slabH, AQ.slabW * 2, { seed: 5, bevel: 0.02, wobble: 0, tone: 0, grime: 0 });
    // (Half of a slab centred on the edge: the next tile's piece lays the other half.)
    g.translate(H, AQ.wallTop + AQ.coping, 0);
    slabs.push(clipX(toArm(g, a)));
  }
  P.add('dressed', M.dressed, slabs);
  // The states: water standing in the channel, silt on its dry floor, ice along its margins.
  P.add('water', M.water, chan.map((c) => flat(c.x0, c.x1, c.z0, c.z1, AQ.water)), { when: 'full', cast: false });
  const rnd = artRng(seed + 41);
  P.add('silt', M.silt, chan.map((c) => flat(c.x0, c.x1, c.z0, c.z1, AQ.floor + 0.004, (x, z) => 0.8 + 0.35 * Math.abs(Math.sin(x * 5.1 + z * 3.3 + rnd() * 0.5)))), { when: 'dry', cast: false });
  P.add('ice', M.ice, iceMargins(chan, chanAt(arms, i, opts)), { when: 'ice', cast: false });
}

/** Clip a geometry built over the edge at x = +-H back inside the tile (a slab centred on the edge: its half on this side). */
function clipX(g) {
  const pos = g.attributes.position;
  const H = AQ.half;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k);
    const z = pos.getZ(k);
    if (x > H) pos.setX(k, H);
    else if (x < -H) pos.setX(k, -H);
    if (z > H) pos.setZ(k, H);
    else if (z < -H) pos.setZ(k, -H);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/**
 * Thin strips of ice along the channel's walls (the margins of running
 * water freeze first): along every side of its cells that a wall stands
 * beside (`isChan(x, z)` false just past it), never across a junction.
 */
function iceMargins(chan, isChan, y = AQ.water + 0.004) {
  const w = 0.085;
  const H = AQ.half;
  const out = [];
  const step = 0.05;
  // A side from a to b (along x if `alongX`) at `at`, the wall past it at at + dir * eps.
  const side = (alongX, a, b, at, dir) => {
    let s0 = null;
    for (let t = a; t <= b + 1e-9; t += step) {
      const tt = Math.min(t + step / 2, b);
      const [px, pz] = alongX ? [tt, at + dir * 0.01] : [at + dir * 0.01, tt];
      const wall = Math.abs(px) < H && Math.abs(pz) < H && !isChan(px, pz);
      const end = t + step > b + 1e-9;
      if (wall && s0 === null) s0 = t;
      if ((!wall || end) && s0 !== null) {
        const s1 = wall ? b : t;
        if (s1 - s0 > 1e-3) {
          const [x0, x1, z0, z1] = alongX ? [s0, s1, Math.min(at, at - dir * w), Math.max(at, at - dir * w)] : [Math.min(at, at - dir * w), Math.max(at, at - dir * w), s0, s1];
          out.push(flat(x0, x1, z0, z1, y));
        }
        s0 = null;
      }
    }
  };
  for (const c of chan) {
    side(true, c.x0, c.x1, c.z0, -1);
    side(true, c.x0, c.x1, c.z1, 1);
    side(false, c.z0, c.z1, c.x0, -1);
    side(false, c.z0, c.z1, c.x1, 1);
  }
  return out;
}

/** The plinth round a pier from x0 to x1 (both faces, and its ends where `ends`). */
function plinth(x0, x1, ends = false) {
  const e = AQ.footOut;
  return box(x0 - (ends ? e : 0), x1 + (ends ? e : 0), 0, AQ.footH, -AQ.hw - e, AQ.hw + e, 0.9);
}

/** The impost band at the springing on a pier's two faces from x0 to x1. */
function impost(x0, x1, y = AQ.spring) {
  const out = [];
  for (const f of [1, -1]) out.push(box(x0, x1, y - AQ.impost, y, f > 0 ? AQ.hw - 0.01 : -AQ.hw - 0.05, f > 0 ? AQ.hw + 0.05 : -AQ.hw + 0.01, 1));
  return out;
}

/**
 * The arch of a straight run (or a road's): half piers at the tile's edges,
 * one arch between, voussoirs on both faces. `road`: the road's dressed
 * arch (rusticated piers, a bigger ring, a tablet in the attic); `caps`:
 * the ends of its line with no neighbour (the channel closed there).
 */
function archPiece(P, M, arms, lod, { road = false, caps = '', seed = 1 } = {}) {
  const H = AQ.half;
  // The road's arch is wider, its piers slimmer (the arcade's half piers meet them at the edge, where
  // both are the wall's full section, their imposts at one height): a cart's width, a gate in the line.
  const r = road ? AQ.roadSpan : AQ.span;
  const spring = AQ.spring;
  const n = lod === 0 ? 18 : lod === 1 ? 10 : 6;
  const outline = [[-H, 0], [-r, 0], [-r, spring], ...arc(0, spring, r, n), [r, spring], [r, 0], [H, 0], [H, AQ.body], [-H, AQ.body]];
  P.add(road ? 'dressed' : 'body', road ? M.dressed : M.body, extrude(outline, -AQ.hw, AQ.hw));
  P.add('foot', M.foot, [plinth(r - AQ.footOut, H), plinth(-H, -r + AQ.footOut)]);
  const dressed = [];
  if (lod < 2) dressed.push(...impost(r, H, spring), ...impost(-H, -r, spring));
  const nv = lod === 0 ? (road ? 15 : 11) : lod === 1 ? 7 : 0;
  if (nv) {
    // (The road's ring runs up under the string course, which stands out further: its crown is lost behind it.)
    const ring = archRing(0, spring, r, nv, road ? AQ.course[1] - AQ.spring - AQ.roadSpan : AQ.ring, road ? 0.06 : 0.035, road ? 0 : 0.08);
    if (road) dressed.push(...ring);
    else P.add('ring', M.ring, ring);
  }
  if (road && lod < 2) {
    // Rusticated piers: big blocks left rough-faced, standing proud in courses (the Porta Maggiore's).
    const rnd = artRng(seed + 7);
    const courses = lod === 0 ? 4 : 2;
    for (const sx of [1, -1]) {
      for (const f of [1, -1]) {
        for (let c = 0; c < courses; c++) {
          const y0 = AQ.footH + 0.02 + (c * (spring - AQ.impost - AQ.footH - 0.04)) / courses;
          const h = (spring - AQ.impost - AQ.footH - 0.04) / courses - 0.03;
          const g = slab(H - r - 0.06, 0.07, h, { seed: seed + c * 5 + (sx > 0 ? 1 : 2) + (f > 0 ? 9 : 0), bevel: 0.03, wobble: 0.012, tone: 0.07, grime: 0.1 });
          // (A slab lies flat: stood up against the face, its thickness out of it.)
          g.rotateX((f * Math.PI) / 2);
          g.translate(sx * (r + (H - r) / 2 + (rnd() - 0.5) * 0.02), y0 + h / 2, f * AQ.hw);
          dressed.push(g);
        }
      }
    }
    // The blank tablet in the attic over the arch, on both faces: a frame standing proud round it.
    const t0 = AQ.course[1] + 0.07;
    const t1 = AQ.wallTop - 0.08;
    for (const f of [1, -1]) {
      const z0 = Math.min(f * AQ.hw, f * (AQ.hw + 0.045));
      const z1 = Math.max(f * AQ.hw, f * (AQ.hw + 0.045));
      dressed.push(box(-1.12, 1.12, t0, t0 + 0.06, z0, z1), box(-1.12, 1.12, t1 - 0.06, t1, z0, z1));
      dressed.push(box(-1.12, -1.06, t0 + 0.06, t1 - 0.06, z0, z1), box(1.06, 1.12, t0 + 0.06, t1 - 0.06, z0, z1));
    }
  }
  P.add('dressed', M.dressed, dressed);
  top(P, M, arms, lod, { caps, full: 'EW', seed, dressedWalls: road });
  if (lod < 2) leaks(P, M, seed, [[-r - 0.3, 0.3], [r + 0.3, 0.3]]);
}

/**
 * The damp of a running channel's leaks: dark streaks down the faces from
 * under the string course (seeded places along x, `spots` [x, width]).
 */
function leaks(P, M, seed, spots, arm = 0) {
  const rnd = artRng(seed + 13);
  const out = [];
  for (const [x, w] of spots) {
    for (const f of [1, -1]) {
      if (rnd() < 0.35) continue;
      const len = 0.9 + rnd() * 1.4;
      const y1 = AQ.course[0] - 0.02;
      const y0 = y1 - len;
      const xx = Math.max(-AQ.half + w, Math.min(AQ.half - w, x + (rnd() - 0.5) * 0.2));
      const half = w * (0.5 + rnd() * 0.5);
      const z = f * (AQ.hw + 0.006);
      const g = new BufferGeometry();
      // A tapering streak: wide under the joint, narrow where it dries.
      g.setAttribute('position', new Float32BufferAttribute([xx - half, y1, z, xx + half, y1, z, xx + half * 0.25, y0, z, xx - half * 0.25, y0, z], 3));
      g.setAttribute('normal', new Float32BufferAttribute([0, 0, f, 0, 0, f, 0, 0, f, 0, 0, f], 3));
      g.setAttribute('uv', new Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
      g.setIndex(f > 0 ? [0, 3, 2, 0, 2, 1] : [0, 1, 2, 0, 2, 3]);
      out.push(toArm(tintGeometry(g), arm));
    }
  }
  P.add('leak', M.leak, out, { when: 'full', cast: false });
}

/**
 * A junction, an end or a lone tile: a solid pier at the tile's middle, an
 * arm of arcade to each edge with an aqueduct beside it (a narrow arch
 * through it, between the pier and the edge's half pier), a stair of drops
 * down into each reservoir beside it.
 */
function junctionPiece(P, M, arms, lod, seed) {
  const o = AQ.hw;
  const H = AQ.half;
  const r = AQ.span;
  P.add('body', M.body, box(-o, o, 0, AQ.body, -o, o));
  const foot = [box(-o - AQ.footOut, o + AQ.footOut, 0, AQ.footH, -o - AQ.footOut, o + AQ.footOut, 0.9)];
  const body = [];
  const ring = [];
  const dressed = [];
  const n = lod === 0 ? 10 : lod === 1 ? 6 : 4;
  const sr = (r - o) / 2;
  const sc = (r + o) / 2;
  for (let a = 0; a < 4; a++) {
    if (arms[a] === 'a') {
      // The arm: from the pier's face to the edge, a narrow arch through it beside the edge's half pier.
      const outline = [[r, 0], [H, 0], [H, AQ.body], [o, AQ.body], [o, AQ.smallSpring], ...arc(sc, AQ.smallSpring, sr, n), [r, AQ.smallSpring]];
      body.push(toArm(extrude(outline, -AQ.hw, AQ.hw), a));
      foot.push(toArm(plinth(r - AQ.footOut, H), a));
      if (lod < 2) {
        // (The edge pier's impost at the arcade's springing, as the straight's half of the same pier: they meet.)
        for (const g of impost(r, H)) dressed.push(toArm(g, a));
        if (lod === 0) for (const g of archRing(sc, AQ.smallSpring, sr, 5, 0.22, 0.03, 0.05)) ring.push(toArm(g, a));
      }
    } else if (arms[a] === 'r') {
      cascade(P, M, a, lod, seed + a);
      // (Its plinth stops short of the edge: past it the castellum's podium steps up.)
      foot.push(toArm(box(o, H - 0.05, 0, AQ.footH, -AQ.hw - AQ.footOut, AQ.hw + AQ.footOut, 0.9), a));
    }
  }
  P.add('body', M.body, body);
  P.add('foot', M.foot, foot);
  P.add('dressed', M.dressed, dressed);
  P.add('ring', M.ring, ring);
  top(P, M, arms, lod, { seed });
  if (lod < 2) leaks(P, M, seed, [[0, 0.35]]);
}

/** The heights of the stair down into a reservoir: risers at x[k], the floor after each. */
export function cascadeSteps(n = AQ.steps) {
  const o = AQ.hw;
  const run = (AQ.half - o) / n;
  const drop = (AQ.floor - AQ.inlet) / n;
  return Array.from({ length: n }, (_, k) => ({ x: o + k * run, x1: k === n - 1 ? AQ.half : o + (k + 1) * run, floor: AQ.floor - (k + 1) * drop }));
}

/**
 * Arm `a` stepping down into a reservoir: the channel falls from the
 * arcade's floor to AQ.inlet at the edge in AQ.steps drops, on a solid wall
 * (its walls and coping stepping down with it), the water tumbling over
 * each drop ('flow') and standing shallow on each tread ('full').
 */
function cascade(P, M, a, lod, seed) {
  const i = AQ.ch;
  const o = AQ.hw;
  const bed = AQ.course[1] - AQ.course[0] + (AQ.floor - AQ.course[1]);
  const wallH = AQ.wallTop - AQ.floor;
  const body = [];
  const walls = [];
  const lining = [];
  const coping = [];
  const water = [];
  const sheets = [];
  const silt = [];
  // (Far out, two drops: the stair is a few pixels and each step costs a dozen boxes.)
  const steps = cascadeSteps(lod === 2 ? 2 : AQ.steps);
  let above = AQ.water;
  for (const s of steps) {
    const f = s.floor;
    body.push(box(s.x, s.x1, 0, f - bed, -o, o));
    for (const sz of [1, -1]) {
      const [z0, z1] = sz > 0 ? [i + AQ.liner, o] : [-o, -i - AQ.liner];
      walls.push(box(s.x, s.x1, f - bed, f + wallH, z0, z1));
      const [l0, l1] = sz > 0 ? [i, i + AQ.liner] : [-i - AQ.liner, -i];
      if (lod < 2) lining.push(box(s.x, s.x1, f - bed, f + wallH, l0, l1, 1, () => 1.05));
      const [c0, c1] = sz > 0 ? [i, o + AQ.copeOut] : [-o - AQ.copeOut, -i];
      coping.push(box(s.x, s.x1, f + wallH, f + wallH + AQ.coping, c0, c1));
    }
    lining.push(box(s.x, s.x1, f - bed, f, -i, i, 1, () => 0.9));
    const shallow = f + 0.1;
    water.push(flat(s.x, s.x1, -i, i, shallow));
    silt.push(flat(s.x, s.x1, -i, i, f + 0.004, (x, z) => 0.85 + 0.3 * Math.abs(Math.sin(x * 7.0 + z * 4.0))));
    // The fall over this drop: a sheet from the water above, curling out and down onto this tread.
    sheets.push(fall(s.x, above, shallow, i - 0.02, lod));
    above = shallow;
  }
  P.add('body', M.body, body.map((g) => toArm(g, a)));
  P.add('body', M.body, walls.map((g) => toArm(g, a)));
  P.add('lining', M.lining, lining.map((g) => toArm(g, a)));
  P.add('dressed', M.dressed, coping.map((g) => toArm(g, a)));
  P.add('water', M.water, water.map((g) => toArm(g, a)), { when: 'full', cast: false });
  P.add('silt', M.silt, silt.map((g) => toArm(g, a)), { when: 'dry', cast: false });
  P.add('sheet', M.sheet, sheets.map((g) => toArm(g, a)), { when: 'flow', cast: false });
}

/**
 * A sheet of water falling over a drop at x0 from y0 to y1, `hw` half wide:
 * out over the lip and down (a few rows), its u along the fall in metres
 * (the stream's ripples run along u: materials.js streamMaterial).
 */
export function fall(x0, y0, y1, hw, lod = 0) {
  const rows = lod === 0 ? 5 : 3;
  const pos = [];
  const uv = [];
  const idx = [];
  let along = 0;
  let prev = null;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    // Out from the lip as it falls, then down: a quarter of a parabola.
    const x = x0 - 0.01 + 0.09 * Math.sqrt(t);
    const y = y0 + (y1 - y0) * t * t * 0.4 + (y1 - y0) * t * 0.6;
    if (prev) along += Math.hypot(x - prev[0], y - prev[1]);
    prev = [x, y];
    pos.push(x, y, -hw, x, y, hw);
    uv.push(along, -hw, along, hw);
    if (r) {
      const b = (r - 1) * 2;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return tintGeometry(g);
}

/**
 * A piece by its kit key (aqueducts/aqueductLayout.js aqueductPiece):
 * 'aqueduct:LOOK:ARMS[:road]'. Returns { group, meshes, triangles }.
 */
export function buildAqueductPiece(key, lod = 0) {
  const { look, arms, road } = parseAqueductKey(key);
  const M = aqueductMaterials(look);
  const P = new TaggedParts(key);
  const seed = 11 + [...arms].reduce((s, c, k) => s + (c === 'a' ? 3 : c === 'r' ? 7 : 1) * (k + 1), 0) + (road ? 50 : 0);
  if (road) {
    // Its line along model x; an end of it with no neighbour closes the channel.
    const caps = (arms[0] === '-' ? 'E' : '') + (arms[2] === '-' ? 'W' : '');
    archPiece(P, M, arms, lod, { road: true, caps, seed });
  } else if (arms === 'a-a-') {
    archPiece(P, M, arms, lod, { seed });
  } else {
    junctionPiece(P, M, arms, lod, seed);
  }
  return P.build();
}

/** Every arms string a piece can have (canonical: as aqueductPiece writes them), for the warm-up and the tests. */
export function aqueductKeys(look) {
  const out = new Set();
  const CANON_ARMS = ['----', 'a---', 'a-a-', 'aa--', 'aaa-', 'aaaa'];
  for (const base of CANON_ARMS) {
    // Each present arm may lead into a reservoir instead.
    const present = [...base].map((c, k) => (c === 'a' ? k : -1)).filter((k) => k >= 0);
    for (let m = 0; m < 1 << present.length; m++) {
      const a = [...base];
      present.forEach((k, j) => { if (m & (1 << j)) a[k] = 'r'; });
      out.add(`aqueduct:${look}:${a.join('')}`);
    }
  }
  for (const a of ['a-a-', 'a---', '--a-', '----']) out.add(`aqueduct:${look}:${a}:road`);
  return [...out];
}
