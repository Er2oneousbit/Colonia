/**
 * models/rural.js
 * ----------------------------------------------------------------------------
 * The building kit of the countryside, shared by the farms (farmstead.js,
 * farmKinds.js) and the granary (granary.js): how a Roman farmer or a
 * town's builder put a working building together, as excavated farmsteads
 * in Italy and the agricultural writers (Cato, Varro, Columella) show it.
 *
 *   - walls of rough field stones in lime mortar (opus incertum) on a
 *     footing of bigger stones, dressed limestone at the corners (quoins),
 *     a lime wash worn off in patches (the `rubble` surface)
 *   - roofs of fired clay tiles: flat tegulae with raised edges, the joints
 *     between them covered by half-round imbrices, laid in courses that
 *     each overlap the one below, a row of imbrices along the ridge, the
 *     rafters' ends under the eaves (tiledSlope, gableRoof, leanTo)
 *   - doors of boards under a timber lintel on a stone threshold, small
 *     windows with wooden shutters (houseShell)
 *   - the yard's things: posts and rails, wattle hurdles, sacks, baskets,
 *     jars, a two-wheeled cart, ladders, straw stacks round a pole
 *
 * Every helper returns plain geometries in metres (y up, the building's
 * middle at the origin), with UVs in metres and vertex colours, to be
 * merged one mesh a material (shapes.js merge). Colours that ARE the thing's
 * colour (a leaf, a pig) are linear-light vertex colours (lin()); the
 * others are greys that darken a textured surface (grime at a foot).
 *
 * `lod` 0..2 as everywhere in the 3D look: 0 for the closest zooms, 1 the
 * small things left out and the round things coarser, 2 the far zooms,
 * where a farm is a few dozen pixels across and a few thousand triangles
 * must do for all of it.
 * ----------------------------------------------------------------------------
 */

import { BufferGeometry, Float32BufferAttribute, CylinderGeometry, BoxGeometry, IcosahedronGeometry, Group, Mesh } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { revolve, profileOf, block, tube, merge, tintGeometry, boxUV } from '../shapes.js';
import { material } from '../materials.js';
import { artRng, smoothstep } from '../texgen.js';

const D = (deg) => (deg * Math.PI) / 180;

/** An sRGB colour (hex) as linear-light [r, g, b] for vertex colours, which three reads as linear. */
export function lin(hex, k = 1) {
  const f = (byte) => {
    const v = byte / 255;
    return (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) * k;
  };
  return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
}

/** Mix two [r, g, b] colours. */
export function mixc(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Paint a whole geometry one colour (linear [r, g, b]), times a per-vertex factor f(x, y, z) if given. */
export function paint(g, rgb, f = null) {
  return tintGeometry(g, (x, y, z) => {
    const k = f ? f(x, y, z) : 1;
    return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
  });
}

/**
 * The countryside's materials, made once and shared (materials.js caches by
 * key: the well's limestone, oak, iron and rope are these same materials).
 */
export function ruralMaterials() {
  return {
    wall: material('rubble-wall', { surface: 'rubble', vertexColors: true, snow: 1 }),
    stone: material('limestone', { surface: 'limestone', vertexColors: true, snow: 1 }),
    wood: material('wood', { surface: 'wood', vertexColors: true, snow: 1 }),
    iron: material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }),
    rope: material('rope', { surface: 'rope', vertexColors: true, snow: 0.6, normal: 1 }),
    tile: material('roof-tile', { surface: 'terracotta', vertexColors: true, snow: 1 }),
    clay: material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 0.8 }),
    thatch: material('thatch', { surface: 'thatch', vertexColors: true, snow: 1 }),
    bark: material('bark', { surface: 'bark', vertexColors: true, snow: 0.6 }),
    wicker: material('wicker', { surface: 'wicker', vertexColors: true, snow: 0.8 }),
    sack: material('sacking', { surface: 'wool', vertexColors: true, color: 0xd9c7a0, snow: 0.8 }),
    earth: material('beaten-earth', { surface: 'earth', vertexColors: true, snow: 1 }),
    // Plain colours carried by the vertices: leaves and blossom, the animals' coats, fruit and
    // vegetables (one program for all: materials.js PLAIN).
    leaf: material('foliage', { roughness: 0.7, snow: 0.85, wet: 0.6 }),
    hide: material('hide', { roughness: 0.82, snow: 0.2, wet: 0.5 }),
    produce: material('produce', { roughness: 0.42, snow: 0.35, wet: 0.4 }),
    // What is seen through a door or a window: the dark inside.
    dark: material('interior', { color: 0x2a231c, roughness: 0.95, snow: 0, wet: 0 }),
  };
}

/**
 * A block at the full detail (shapes.js: bevelled, pushed out of square),
 * or past it a plain box of 12 triangles: from a middle zoom out a bevel
 * is under a pixel, and a farm's hundred small timbers would cost a
 * hundred triangles each.
 */
export function blk(lod, w, h, d, opts = {}) {
  if (lod === 0) return block(w, h, d, opts);
  const g = new BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  boxUV(g, ((opts.seed || 0) * 0.37) % 3, ((opts.seed || 0) * 0.61) % 3);
  const grime = opts.grime || 0;
  const k = 1 + ((((opts.seed || 0) * 0.7131) % 1) * 2 - 1) * (opts.tone || 0);
  return tintGeometry(g, (x, y) => k * (1 - grime * (1 - Math.min(1, y / Math.max(0.05, Math.min(h, 0.35)))) ** 2));
}

/** A box from (x0, y0, z0) to (x1, y1, z1), squared, with UVs in the world's metres so pieces of one wall meet seamlessly. */
export function wallBlock(x0, x1, y0, y1, z0, z1, { bevel = 0.012, seed = 1, grime = 0.3, lod = 0 } = {}) {
  const g = blk(lod, x1 - x0, y1 - y0, z1 - z0, { bevel, seed, wobble: 0, grime, seg: 1 });
  g.translate((x0 + x1) / 2, y0, (z0 + z1) / 2);
  boxUV(g);
  return g;
}

/**
 * A wall along x (`axis` 'x') or z from `a` to `b`, `thick` through, its
 * middle at `at` on the other axis, from y0 to y1, with openings
 * [{ a, b, lo, hi }] along it (doors from the footing, windows between):
 * the pieces round them, which leave the openings' reveals as real faces.
 */
export function wallRun(axis, a, b, at, thick, y0, y1, openings = [], seed = 1, lod = 0) {
  const out = [];
  const put = (p0, p1, q0, q1, grime) => {
    if (p1 - p0 < 1e-3 || q1 - q0 < 1e-3) return;
    const c0 = at - thick / 2;
    const c1 = at + thick / 2;
    out.push(axis === 'x'
      ? wallBlock(p0, p1, q0, q1, c0, c1, { seed: seed + out.length, grime, lod })
      : wallBlock(c0, c1, q0, q1, p0, p1, { seed: seed + out.length, grime, lod }));
  };
  const ops = [...openings].sort((p, q) => p.a - q.a);
  let x = a;
  for (const o of ops) {
    put(x, o.a, y0, y1, 0.35);
    put(o.a, o.b, y0, o.lo, 0.35);
    put(o.a, o.b, o.hi, y1, 0);
    x = o.b;
  }
  put(x, b, y0, y1, 0.35);
  return out;
}

/**
 * A tiled roof slope in its own plane: x across it (-L/2..L/2, along the
 * ridge), z down it from the ridge (0) to the eave (len), y off it. Flat
 * tegulae in courses every COURSE m, each course's lower end resting on the
 * one below (a step down at each course), the joints covered by imbrices.
 * Vertex colours: each tile its own tone, darker in the pans' joints and
 * toward the eave where the water runs.
 */
const COURSE = 0.54;
const PERIOD = 0.5;
const IMB = 0.085; // an imbrex's half width
export function tiledSlope(L, len, lod = 0, seed = 1) {
  const rnd = artRng(seed);
  const tone = new Map();
  const toneOf = (c, k) => {
    const key = c * 1000 + k;
    let t = tone.get(key);
    if (t === undefined) {
      t = 0.86 + rnd() * 0.24;
      tone.set(key, t);
    }
    return t;
  };
  if (lod >= 2) {
    // From far out a plain slope; the tiles' rows are only a shade.
    const g = new BufferGeometry();
    const p = [-L / 2, 0.05, 0, L / 2, 0.05, 0, L / 2, 0.05, len, -L / 2, 0.05, len];
    g.setAttribute('position', new Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new Float32BufferAttribute([-L / 2, 0, L / 2, 0, L / 2, len, -L / 2, len], 2));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
    return tintGeometry(g, (x, y, z) => 0.95 - 0.15 * smoothstep(len * 0.6, len, z));
  }
  // Samples across a period (from one joint's middle): the imbrex's curve, then the pan.
  const fine = lod === 0;
  const across = fine ? [0, 0.45, 0.8, 1.0, 1.25, 3.0] : [0, 0.75, 1.0, 3.0];
  const xs = [];
  const n = Math.ceil(L / PERIOD);
  const x0 = -n * PERIOD / 2;
  for (let k = 0; k <= n; k++) {
    const j = x0 + k * PERIOD;
    for (const s of [-1, 1]) {
      for (const f of across) {
        if (s < 0 && f === 0) continue;
        const d = f * IMB;
        if (d > PERIOD / 2) continue;
        xs.push(j + s * d);
      }
    }
  }
  xs.sort((a, b) => a - b);
  const xsIn = xs.filter((x) => x >= -L / 2 && x <= L / 2);
  if (xsIn[0] > -L / 2) xsIn.unshift(-L / 2);
  if (xsIn[xsIn.length - 1] < L / 2) xsIn.push(L / 2);
  const height = (x) => {
    const m = ((x - x0) % PERIOD + PERIOD) % PERIOD;
    const d = Math.min(m, PERIOD - m);
    return d < IMB ? 0.03 + 0.068 * Math.sqrt(Math.max(0, 1 - (d / IMB) ** 2)) : 0.03;
  };
  const geos = [];
  const courses = Math.ceil(len / COURSE);
  for (let c = 0; c < courses; c++) {
    const za = c * COURSE;
    const zb = Math.min(len, (c + 1) * COURSE - 0.004);
    const rows = fine ? [za, (za + zb) / 2, zb] : [za, zb];
    const pos = [];
    const uv = [];
    const col = [];
    for (const z of rows) {
      const lift = 0.024 * ((z - za) / COURSE);
      for (const x of xsIn) {
        const h = height(x);
        const onImb = h > 0.031;
        pos.push(x, h + lift * (onImb ? 1.4 : 1), z);
        uv.push(x, z);
        const k = Math.floor((x - x0) / PERIOD + (onImb ? 0.5 : 0));
        let t = toneOf(c, k * 2 + (onImb ? 1 : 0));
        // The pan darkens into the shade under the imbrices either side.
        if (!onImb) {
          const m = ((x - x0) % PERIOD + PERIOD) % PERIOD;
          t *= 0.84 + 0.16 * smoothstep(IMB, IMB * 2.2, Math.min(m, PERIOD - m));
        }
        t *= 1 - 0.18 * smoothstep(len * 0.55, len, z);
        col.push(t, t, t);
      }
    }
    const W = xsIn.length;
    const idx = [];
    for (let r = 0; r < rows.length - 1; r++) {
      for (let i = 0; i < W - 1; i++) {
        const a = r * W + i;
        const b = a + W;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    // The course's lower end: a lip down to the course below, so the step reads as a tile's edge.
    const base = pos.length / 3;
    const last = (rows.length - 1) * W;
    for (let i = 0; i < W; i++) {
      pos.push(pos[(last + i) * 3], 0.0, pos[(last + i) * 3 + 2]);
      uv.push(uv[(last + i) * 2], uv[(last + i) * 2 + 1] + 0.03);
      col.push(col[(last + i) * 3] * 0.7, col[(last + i) * 3 + 1] * 0.7, col[(last + i) * 3 + 2] * 0.7);
    }
    for (let i = 0; i < W - 1; i++) {
      const a = last + i;
      const b = base + i;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    geos.push(g);
  }
  return merge(geos);
}

/** A half-round of imbrices along x (a ridge, a hip), radius r, length L, on y = 0. */
function ridgeCap(L, r, lod) {
  const g = new CylinderGeometry(r, r, L, lod === 0 ? 12 : lod === 1 ? 6 : 4, 1, true, -Math.PI / 2, Math.PI);
  g.rotateZ(-Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  boxUV(g);
  return tintGeometry(g, () => 0.92);
}

/** The underside of a slope (the rafters and boards seen under the eave), facing down. */
function underside(L, len) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-L / 2, -0.02, 0, L / 2, -0.02, 0, L / 2, -0.02, len, -L / 2, -0.02, len], 3));
  g.setAttribute('uv', new Float32BufferAttribute([0, -L / 2, 0, L / 2, len, L / 2, len, -L / 2], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return tintGeometry(g, () => 0.55);
}

/**
 * A gable roof over the rectangle x0..x1, z0..z1 (the walls' outer faces),
 * its ridge along `along`, eaves at eaveY, slopes at `pitch` (radians;
 * Roman tiled roofs were low, about 20 to 25 degrees), running `over` past
 * the walls at the eaves and `gableOver` at the gables. Returns { tile,
 * wood, ridgeY }: the tiles and ridge, the boards under the eaves and the
 * rafters' ends.
 */
export function gableRoof({ x0, x1, z0, z1, eaveY, pitch = D(22), along = 'z', lod = 0, seed = 1, over = 0.35, gableOver = 0.22 }) {
  const alongX = along === 'x';
  const L = (alongX ? x1 - x0 : z1 - z0) + 2 * gableOver;
  const H = (alongX ? z1 - z0 : x1 - x0) / 2;
  const rise = H * Math.tan(pitch);
  const ridgeY = eaveY + rise;
  const len = (H + over) / Math.cos(pitch);
  const tile = [];
  const wood = [];
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const place = (g, s) => {
    // Its plane tilted down from the ridge toward +z (s = 1) or -z, then turned to the ridge's axis.
    g.rotateX(pitch);
    if (s < 0) g.rotateY(Math.PI);
    g.translate(0, ridgeY + 0.02, 0);
    if (!alongX) g.rotateY(Math.PI / 2);
    g.translate(cx, 0, cz);
    return g;
  };
  for (const s of [1, -1]) {
    tile.push(place(tiledSlope(L, len, lod, seed + (s > 0 ? 1 : 2)), s));
    wood.push(place(underside(L, len), s));
    if (lod < 2) {
      // The verge: a board along each gable edge of the slope.
      for (const e of [-1, 1]) {
        const v = blk(lod, 0.07, 0.13, len, { bevel: 0.01, seed: seed + 7 + e, wobble: 0.002, grime: 0, seg: 1 });
        v.translate(e * (L / 2 + 0.02), -0.06, len / 2);
        wood.push(place(v, s));
      }
    }
  }
  const cap = ridgeCap(L + 0.04, 0.1, lod);
  cap.translate(0, ridgeY + 0.07, 0);
  if (!alongX) cap.rotateY(Math.PI / 2);
  cap.translate(cx, 0, cz);
  tile.push(cap);
  // The rafters' ends under the eaves, every 0.6 m.
  if (lod === 0) {
    const n = Math.floor(L / 0.6);
    for (const s of [1, -1]) {
      for (let k = 0; k <= n; k++) {
        const x = -L / 2 + 0.15 + (k * (L - 0.3)) / n;
        const r = blk(lod, 0.09, 0.11, over + 0.2, { bevel: 0.012, seed: seed + 30 + k, wobble: 0.003, grime: 0, seg: 1 });
        r.translate(0, -0.05, 0);
        r.rotateX(s * pitch);
        r.translate(x, eaveY + 0.02, s * (H + over / 2 - 0.05));
        if (!alongX) r.rotateY(Math.PI / 2);
        r.translate(cx, 0, cz);
        wood.push(r);
      }
    }
  }
  return { tile, wood, ridgeY };
}

/**
 * A lean-to (pent) roof: one tiled slope from `topY` at the wall it leans
 * on down to `eaveY`, over a run `span` out from that wall and `L` along
 * it. Built facing +z (the wall at z = 0, the eave at z = span), centred on
 * x; turn and move it into place. Returns { tile, wood }.
 */
export function leanTo({ L, span, topY, eaveY, lod = 0, seed = 1, over = 0.25 }) {
  const pitch = Math.atan2(topY - eaveY, span);
  const len = (span + over) / Math.cos(pitch);
  const tile = tiledSlope(L, len, lod, seed);
  tile.rotateX(pitch);
  tile.translate(0, topY + 0.02, 0);
  const wood = underside(L, len);
  wood.rotateX(pitch);
  wood.translate(0, topY + 0.02, 0);
  const out = { tile: [tile], wood: [wood] };
  // Its wall plate: a beam along the wall under the roof's top.
  if (lod < 2) {
    const plate = blk(lod, 0.12, 0.12, L, { bevel: 0.012, seed: seed + 3, wobble: 0.003, grime: 0, seg: 1 });
    plate.rotateY(Math.PI / 2);
    plate.translate(0, topY - 0.12, 0.08);
    out.wood.push(plate);
  }
  return out;
}

/**
 * A timber post on a stone base (as porticoes and sheds stood: the wood
 * kept off the wet ground), from y = 0 to `h`, at (x, z).
 */
export function post(x, z, h, { r = 0.09, seed = 1, lod = 0, base = true } = {}) {
  const wood = [];
  const stone = [];
  const p = blk(lod, r * 2, h - (base ? 0.22 : 0), r * 2, { bevel: 0.015, seed, wobble: 0.004, grime: 0.15, seg: 1 });
  p.translate(x, base ? 0.22 : 0, z);
  wood.push(p);
  if (base) {
    const b = blk(lod, r * 2 + 0.14, 0.22, r * 2 + 0.14, { bevel: 0.03, seed: seed + 50, wobble: 0.01, grime: 0.5, seg: lod ? 1 : 2 });
    b.translate(x, 0, z);
    stone.push(b);
  }
  return { wood, stone };
}

/** A beam from point a to point b ([x, y, z]), `w` square. */
export function beam(a, b, w = 0.1, seed = 1, lod = 0) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.max(1e-4, Math.hypot(dx, dy, dz));
  const g = blk(lod, w, len, w, { bevel: Math.min(0.012, w * 0.15), seed, wobble: 0.002, grime: 0, seg: 1 });
  // Built standing (y up its length): turn y onto the beam's direction.
  const yaw = Math.atan2(dx, dz);
  const tilt = Math.acos(Math.max(-1, Math.min(1, dy / len)));
  g.rotateX(tilt);
  g.rotateY(yaw);
  g.translate(a[0], a[1], a[2]);
  return g;
}

/**
 * The shell of a small building: footing, rubble walls with quoins at the
 * corners, openings, the dark inside, and a gable roof. `doors` and
 * `windows`: [{ side: '+x'|'-x'|'+z'|'-z', at (along the side, from its
 * middle), w, h, y (a window's sill) , shut }]. Returns parts by material
 * and the roof's ridge height.
 */
export function houseShell({ x0, x1, z0, z1, eaveY, pitch = D(22), along = 'z', lod = 0, seed = 1, thick = 0.4, footH = 0.32, doors = [], windows = [], wash = true }) {
  const rnd = artRng(seed);
  const out = { wall: [], stone: [], wood: [], tile: [], dark: [], iron: [] };
  // The footing: a course of bigger stones, a little proud of the wall.
  const fo = 0.05;
  if (lod < 2) {
    const course = (axis, a, b, at, sd) => {
      let p = a;
      while (b - p > 0.05) {
        const q = Math.min(b, p + 0.45 + rnd() * 0.45);
        const w = q - p - 0.012;
        const g = axis === 'x'
          ? blk(lod, w, footH, thick + 2 * fo, { bevel: 0.03, seed: seed * 31 + sd++, wobble: 0.012, grime: 0.55, seg: 1, tone: 0.1 })
          : blk(lod, thick + 2 * fo, footH, w, { bevel: 0.03, seed: seed * 31 + sd++, wobble: 0.012, grime: 0.55, seg: 1, tone: 0.1 });
        if (axis === 'x') g.translate((p + q) / 2, 0, at); else g.translate(at, 0, (p + q) / 2);
        out.stone.push(g);
        p = q;
      }
      return sd;
    };
    let sd = 1;
    sd = course('x', x0 - fo, x1 + fo, z0 + thick / 2, sd);
    sd = course('x', x0 - fo, x1 + fo, z1 - thick / 2, sd);
    sd = course('z', z0 + thick + fo, z1 - thick - fo, x0 + thick / 2, sd);
    course('z', z0 + thick + fo, z1 - thick - fo, x1 - thick / 2, sd);
  } else {
    out.stone.push(wallBlock(x0 - fo, x1 + fo, 0, footH, z0 - fo, z1 + fo, { grime: 0.5 }));
  }
  // The walls, round their openings.
  const opens = { '+x': [], '-x': [], '+z': [], '-z': [] };
  const sideLen = { '+x': z1 - z0, '-x': z1 - z0, '+z': x1 - x0, '-z': x1 - x0 };
  const mid = { '+x': (z0 + z1) / 2, '-x': (z0 + z1) / 2, '+z': (x0 + x1) / 2, '-z': (x0 + x1) / 2 };
  for (const d of doors) opens[d.side].push({ a: mid[d.side] + d.at - d.w / 2, b: mid[d.side] + d.at + d.w / 2, lo: footH, hi: footH + d.h, door: d });
  for (const w of windows) opens[w.side].push({ a: mid[w.side] + w.at - w.w / 2, b: mid[w.side] + w.at + w.w / 2, lo: w.y, hi: w.y + w.h, win: w });
  const y0 = footH;
  out.wall.push(...wallRun('z', z0, z1, x0 + thick / 2, thick, y0, eaveY, opens['-x'], seed + 100, lod));
  out.wall.push(...wallRun('z', z0, z1, x1 - thick / 2, thick, y0, eaveY, opens['+x'], seed + 200, lod));
  out.wall.push(...wallRun('x', x0 + thick, x1 - thick, z0 + thick / 2, thick, y0, eaveY, opens['-z'], seed + 300, lod));
  out.wall.push(...wallRun('x', x0 + thick, x1 - thick, z1 - thick / 2, thick, y0, eaveY, opens['+z'], seed + 400, lod));
  // The gables: triangles of wall up to the ridge on the two ends.
  const alongX = along === 'x';
  const span = alongX ? z1 - z0 : x1 - x0;
  const rise = (span / 2) * Math.tan(pitch);
  for (const e of [-1, 1]) {
    const g = new BoxGeometry(span, rise, thick, 2, 1, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const top = pos.getY(i) > 0;
      const x = pos.getX(i);
      pos.setY(i, top ? rise * (1 - Math.abs(x) / (span / 2)) : 0);
    }
    g.computeVertexNormals();
    if (!alongX) {
      // A gable on a -z or +z end wall spans x.
      g.translate((x0 + x1) / 2, eaveY, e < 0 ? z0 + thick / 2 : z1 - thick / 2);
    } else {
      g.rotateY(Math.PI / 2);
      g.translate(e < 0 ? x0 + thick / 2 : x1 - thick / 2, eaveY, (z0 + z1) / 2);
    }
    boxUV(g);
    out.wall.push(tintGeometry(g));
  }
  // Quoins: dressed blocks at the corners, long and short in turn up the wall.
  if (lod < 2) {
    const corners = [[x0, z0, 1, 1], [x1, z0, -1, 1], [x1, z1, -1, -1], [x0, z1, 1, -1]];
    let k = 0;
    for (const [cx, cz, sx, sz] of corners) {
      for (let y = footH, i = 0; y < eaveY - 0.15; y += 0.31, i++) {
        const h = Math.min(0.29, eaveY - y);
        const long = (i + k) % 2 === 0;
        const lx = long ? 0.55 : 0.32;
        const lz = long ? 0.32 : 0.55;
        const g = blk(lod, lx, h, lz, { bevel: 0.02, seed: seed * 7 + k * 50 + i, wobble: 0.006, grime: 0.15, seg: 1, tone: 0.08 });
        g.translate(cx + sx * (lx / 2 - 0.01), y, cz + sz * (lz / 2 - 0.01));
        out.stone.push(g);
      }
      k++;
    }
  }
  // The dark inside, seen through doors and windows.
  out.dark.push(wallBlock(x0 + thick - 0.02, x1 - thick + 0.02, footH - 0.02, eaveY, z0 + thick - 0.02, z1 - thick + 0.02, { grime: 0 }));
  // Doors: a stone threshold, a timber lintel, leaves of boards (ajar unless shut).
  for (const side of Object.keys(opens)) {
    for (const o of opens[side]) {
      const ax = side === '+z' || side === '-z' ? 'x' : 'z';
      const face = side === '+x' ? x1 : side === '-x' ? x0 : side === '+z' ? z1 : z0;
      const w = o.b - o.a;
      const at = (o.a + o.b) / 2;
      // Place a piece built at the origin facing +z onto this side: x along the side, z out of the wall.
      const onSide = (g) => {
        if (side === '-z') g.rotateY(Math.PI);
        else if (side === '+x') g.rotateY(Math.PI / 2);
        else if (side === '-x') g.rotateY(-Math.PI / 2);
        if (ax === 'x') g.translate(at, 0, face);
        else g.translate(face, 0, at);
        return g;
      };
      // (Built so its local x runs along the side the way onSide turns it: centre it at 0.)
      const lintel = blk(lod, w + 0.36, 0.16, thick + 0.06, { bevel: 0.015, seed: seed + 500 + o.a * 10, wobble: 0.004, grime: 0, seg: 1 });
      lintel.translate(0, o.hi, -thick / 2);
      out.wood.push(onSide(lintel));
      if (o.door) {
        const sill = blk(lod, w + 0.12, 0.07, thick + 0.12, { bevel: 0.015, seed: seed + 600, wobble: 0.004, grime: 0.2, seg: 1 });
        sill.translate(0, footH - 0.05, -thick / 2 + 0.04);
        out.stone.push(onSide(sill));
        if (lod < 2) {
          // Shut in the doorway, or swung open flat against the wall outside (the inside is dark).
          const lw = w - 0.04;
          const leaf = doorLeaf(lw, o.hi - o.lo - 0.03, seed + 700, lod);
          if (o.door.shut) {
            leaf.translate(0, footH, -thick / 2);
          } else {
            leaf.translate(lw / 2, 0, 0);
            leaf.rotateY(-0.25);
            leaf.translate(w / 2, footH, 0.04);
          }
          out.wood.push(onSide(leaf));
        } else if (o.door.shut) {
          const leaf = blk(lod, w, o.hi - o.lo, 0.05, { bevel: 0.005, seed: seed + 700, wobble: 0, grime: 0.3, seg: 1 });
          leaf.translate(0, footH, -thick / 2);
          out.wood.push(onSide(leaf));
        }
      } else if (o.win) {
        const sill = blk(lod, w + 0.1, 0.05, thick + 0.08, { bevel: 0.01, seed: seed + 800, wobble: 0.003, grime: 0, seg: 1 });
        sill.translate(0, o.lo - 0.05, -thick / 2 + 0.03);
        out.stone.push(onSide(sill));
        if (lod < 2) {
          // Two shutter leaves of boards, open against the wall, or shut in the opening.
          for (const s of [-1, 1]) {
            const sh = blk(lod, w / 2 - 0.01, o.hi - o.lo - 0.02, 0.035, { bevel: 0.006, seed: seed + 900 + s, wobble: 0.002, grime: 0.2, seg: 1 });
            if (o.win.shut) sh.translate(s * (w / 4), o.lo + 0.01, -0.06);
            else sh.translate(s * (w / 2 + w / 4 + 0.01), o.lo + 0.01, 0.025);
            out.wood.push(onSide(sh));
          }
        }
      }
    }
  }
  const roof = gableRoof({ x0, x1, z0, z1, eaveY, pitch, along, lod, seed: seed + 1000 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  out.ridgeY = roof.ridgeY;
  return out;
}

/** A door leaf of three boards and two ledges, w x h, its foot at y 0, centred on x, its face toward +z. */
export function doorLeaf(w, h, seed = 1, lod = 0) {
  const boards = [];
  const nb = 3;
  for (let k = 0; k < nb; k++) {
    const b = blk(lod, w / nb - 0.006, h, 0.045, { bevel: 0.007, seed: seed + k, wobble: 0.002, grime: 0.35, seg: 1 });
    b.translate(-w / 2 + (k + 0.5) * (w / nb), 0, 0);
    boards.push(b);
  }
  for (const y of [0.3, h - 0.42]) {
    const b = blk(lod, w - 0.03, 0.09, 0.03, { bevel: 0.007, seed: seed + 9 + y, wobble: 0.002, grime: 0, seg: 1 });
    b.translate(0, y, -0.035);
    boards.push(b);
  }
  return merge(boards);
}

/**
 * Posts and rails along a polyline of [x, z] points (a paddock's or a
 * pen's fence): split posts every ~2 m, two rails between them. Returns
 * wood geometries.
 */
export function railFence(points, { h = 1.15, rails = [0.45, 0.95], seed = 1, lod = 0, every = 2.0 } = {}) {
  const rnd = artRng(seed);
  const out = [];
  if (lod >= 2) {
    // Far out: a rail is a thin line; one rail and the posts at the corners.
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1];
      const [bx, bz] = points[i];
      out.push(beam([ax, h * 0.75, az], [bx, h * 0.75, bz], 0.07, seed + i, lod));
      out.push(beam([ax, 0, az], [ax, h, az], 0.11, seed + 40 + i, lod));
    }
    const [lx, lz] = points[points.length - 1];
    out.push(beam([lx, 0, lz], [lx, h, lz], 0.11, seed + 99, lod));
    return out;
  }
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / every));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const px = ax + (bx - ax) * t;
      const pz = az + (bz - az) * t;
      const ph = h + (rnd() - 0.5) * 0.08;
      const p = blk(lod, 0.11 + rnd() * 0.03, ph, 0.1 + rnd() * 0.03, { bevel: 0.015, seed: seed + i * 50 + k, wobble: 0.008, grime: 0.4, seg: 1 });
      p.rotateY(rnd() * 0.6);
      p.translate(px, 0, pz);
      out.push(p);
    }
    for (const ry of rails) {
      const sag = (rnd() - 0.5) * 0.05;
      out.push(beam([ax, ry + sag, az], [bx, ry - sag, bz], 0.065 + rnd() * 0.015, seed + i * 7 + ry * 10, lod));
    }
  }
  const [lx, lz] = points[points.length - 1];
  const p = blk(lod, 0.12, h, 0.12, { bevel: 0.015, seed: seed + 999, wobble: 0.008, grime: 0.4, seg: 1 });
  p.translate(lx, 0, lz);
  out.push(p);
  return out;
}

/**
 * A run of wattle hurdles along a polyline (a kitchen garden's fence, as
 * Columella and Varro describe the cheap one: stakes with withies woven
 * through), `h` high: wicker panels and stakes. Returns { wicker, wood }.
 */
export function wattleFence(points, { h = 0.95, seed = 1, lod = 0 } = {}) {
  const rnd = artRng(seed);
  const wicker = [];
  const wood = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 1.8));
    const yaw = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      const mx = ax + (bx - ax) * (t0 + t1) / 2;
      const mz = az + (bz - az) * (t0 + t1) / 2;
      const pl = (len / n) - 0.04;
      const ph = h + (rnd() - 0.5) * 0.06;
      const g = lod >= 2
        ? blk(lod, 0.06, ph, pl, { bevel: 0.01, seed: seed + k, wobble: 0, grime: 0.3, seg: 1 })
        : blk(lod, 0.07, ph, pl, { bevel: 0.025, seed: seed + i * 20 + k, wobble: 0.015, grime: 0.35, seg: 1 });
      // (Its weave runs along the panel: u along it, v up it.)
      g.rotateY(yaw);
      g.translate(mx, 0, mz);
      // UVs: along the panel and up it, whatever its direction.
      const pos = g.attributes.position;
      const uv = g.attributes.uv;
      for (let j = 0; j < pos.count; j++) {
        const along = (pos.getX(j) - ax) * Math.sin(yaw) + (pos.getZ(j) - az) * Math.cos(yaw);
        uv.setXY(j, along, pos.getY(j));
      }
      wicker.push(g);
      if (lod < 2) {
        const s = blk(lod, 0.06, ph + 0.12, 0.06, { bevel: 0.01, seed: seed + 300 + i * 20 + k, wobble: 0.004, grime: 0.4, seg: 1 });
        s.translate(ax + (bx - ax) * t0, 0, az + (bz - az) * t0);
        wood.push(s);
      }
    }
  }
  return { wicker, wood };
}

/**
 * A sack of grain (or of beans, flour, chaff), standing: a soft bag of
 * coarse cloth, bulging, its neck tied. w x h, on y = 0.
 */
export function sack(w = 0.42, h = 0.62, seed = 1, lod = 0) {
  const g = block(w, h * 0.86, w * 0.78, { bevel: Math.min(w, h) * 0.32, seed, wobble: 0.025, grime: 0.15, seg: lod ? 1 : 2, topSag: 0.06 });
  // Bulge the middle, pinch toward the neck.
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / (h * 0.86);
    const k = 1 + 0.12 * Math.sin(Math.PI * Math.min(1, y * 1.1)) - 0.25 * smoothstep(0.75, 1, y);
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  boxUV(g, (seed % 7) * 0.13, (seed % 5) * 0.17);
  const parts = [g];
  if (lod === 0) {
    const neck = new CylinderGeometry(0.035, 0.06, h * 0.16, 7, 1);
    neck.translate(0, h * 0.86 + h * 0.06, 0);
    boxUV(neck);
    parts.push(tintGeometry(neck, () => 0.85));
  }
  return merge(parts);
}

/** A sack lying on its side (a stack's lower rows). */
export function sackLying(w = 0.42, h = 0.62, seed = 1, lod = 0) {
  const g = sack(w, h, seed, lod);
  g.translate(0, -h / 2, 0);
  g.rotateZ(Math.PI / 2);
  g.translate(0, w * 0.39, 0);
  return g;
}

/**
 * A round wicker basket (a corbis), r across the rim, h high, on y = 0:
 * returns { wicker, fill } where fill is the surface of what is heaped in
 * it (`full` 0..1) as a dome for the caller to colour, or null.
 */
export function basket(r = 0.26, h = 0.3, full = 1, lod = 0) {
  const seg = lod === 0 ? 18 : lod === 1 ? 10 : 6;
  const P = profileOf([[0, 0.01], [r * 0.72, 0], [r * 0.95, h * 0.7], [r, h], [r * 1.06, h + 0.015], [r * 0.95, h + 0.01], [r * 0.9, h * 0.75], [r * 0.68, 0.04], [0, 0.04]]);
  const w = revolve(P, { segments: seg, metres: 0.4, tint: (p) => (Math.hypot(p.x, p.z) < r * 0.93 && p.y > 0.03 && p.y < h ? 0.55 : 1) });
  let fill = null;
  if (full > 0) {
    const top = h * (0.35 + 0.65 * Math.min(1, full));
    const dome = Math.min(1, full) * r * 0.45;
    fill = revolve(profileOf([[r * 0.92, top - 0.02], [r * 0.7, top + dome * 0.6], [r * 0.35, top + dome * 0.95], [0, top + dome]]), { segments: seg, metres: 0.4 });
  }
  return { wicker: w, fill };
}

/**
 * Small round things heaped in a basket or a crate (apples, onions, olives):
 * `n` low-poly balls of radius ~r inside a dome of radius R over y0, in one
 * colour family (`colours`: linear [r, g, b] list), seeded.
 */
export function heap(n, R, y0, r, colours, seed = 1, lod = 0, squash = 1) {
  const rnd = artRng(seed);
  const parts = [];
  const detail = lod === 0 ? 1 : 0;
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * R;
    const y = y0 + (1 - (d / R) ** 2) * R * 0.5 + rnd() * r * 0.4;
    const rr = r * (0.8 + rnd() * 0.4);
    const g = new IcosahedronGeometry(rr, detail);
    g.scale(1, squash, 1);
    g.translate(Math.cos(a) * d, y, Math.sin(a) * d);
    const c = colours[Math.floor(rnd() * colours.length)];
    const t = 0.85 + rnd() * 0.3;
    parts.push(paint(g, [c[0] * t, c[1] * t, c[2] * t], (x, yy) => 0.75 + 0.25 * smoothstep(y - rr, y + rr, yy)));
  }
  return parts.length ? merge(parts) : null;
}

/**
 * A storage jar: a dolium (the big globular jar of a farm's cella,
 * half sunk in the ground: `sunk` m) or, with `amphora`, a transport
 * amphora standing, its spike foot pushed into the earth.
 */
export function jar({ amphora = false, sunk = 0, lod = 0, seed = 1 } = {}) {
  const seg = lod === 0 ? 24 : lod === 1 ? 12 : 7;
  const P = amphora
    ? profileOf([[0, 0], [0.03, 0], [0.035, 0.08], [0.09, 0.22], [0.15, 0.42], [0.155, 0.58], [0.12, 0.72], [0.06, 0.8], [0.05, 0.96], [0.065, 0.99], [0.045, 1.0], [0, 0.98]])
    : profileOf([[0, 0], [0.22, 0], [0.42, 0.18], [0.52, 0.45], [0.5, 0.75], [0.38, 0.95], [0.3, 1.02], [0.33, 1.06], [0.33, 1.11], [0.27, 1.12], [0.25, 1.05], [0, 1.0]]);
  const g = revolve(P, { segments: seg, metres: 0.6, tint: (p) => (Math.hypot(p.x, p.z) < (amphora ? 0.045 : 0.26) && p.y > 0.9 ? 0.25 : 0.72 + 0.28 * smoothstep(0, 0.4, p.y)) });
  const parts = [g];
  if (amphora && lod < 2) {
    for (const s of [-1, 1]) parts.push(tube([[s * 0.05, 0.92, 0], [s * 0.1, 0.93, 0], [s * 0.11, 0.85, 0], [s * 0.12, 0.74, 0]], 0.012, { radial: lod ? 4 : 6, around: 0.6 }));
  }
  const out = merge(parts);
  out.translate(0, -sunk, 0);
  return out;
}

/**
 * A farm cart (plaustrum): a bed of planks with low side boards on an
 * axle between two solid wheels of three planks each (tympana, as the
 * reliefs show them), its pole resting on the ground. Facing +z (the pole
 * forward), on y = 0. Returns { wood, iron }.
 */
export function cart(lod = 0, seed = 1) {
  const wood = [];
  const iron = [];
  const R = 0.45;
  const track = 0.62;
  const seg = lod === 0 ? 20 : lod === 1 ? 12 : 8;
  for (const s of [-1, 1]) {
    const wheel = new CylinderGeometry(R, R, 0.09, seg, 1);
    wheel.rotateZ(Math.PI / 2);
    wheel.translate(s * track, R, 0);
    boxUV(wheel);
    wood.push(tintGeometry(wheel, (x, y, z) => 0.85 + 0.15 * Math.abs(Math.cos(Math.atan2(y - R, z) * 3))));
    if (lod < 2) {
      const tyre = new CylinderGeometry(R + 0.012, R + 0.012, 0.08, seg, 1, true);
      tyre.rotateZ(Math.PI / 2);
      tyre.translate(s * track, R, 0);
      boxUV(tyre);
      iron.push(tintGeometry(tyre));
      const hub = new CylinderGeometry(0.1, 0.12, 0.2, 10, 1);
      hub.rotateZ(Math.PI / 2);
      hub.translate(s * (track + 0.05), R, 0);
      boxUV(hub);
      wood.push(tintGeometry(hub, () => 0.8));
    }
  }
  wood.push(beam([-track - 0.1, R, 0], [track + 0.1, R, 0], 0.09, seed + 1, lod));
  // The bed: tilted forward, its pole on the ground.
  const tilt = 0.12;
  const bed = [];
  const bL = 1.9;
  const bW = 1.1;
  bed.push(blk(lod, bW, 0.05, bL, { bevel: 0.01, seed: seed + 2, wobble: 0.003, grime: 0.2, seg: 1 }));
  if (lod < 2) {
    for (const s of [-1, 1]) {
      const side = blk(lod, 0.04, 0.22, bL, { bevel: 0.008, seed: seed + 3 + s, wobble: 0.003, grime: 0.2, seg: 1 });
      side.translate(s * (bW / 2 - 0.02), 0.05, 0);
      bed.push(side);
    }
    const back = blk(lod, bW, 0.22, 0.04, { bevel: 0.008, seed: seed + 6, wobble: 0.003, grime: 0.2, seg: 1 });
    back.translate(0, 0.05, -bL / 2 + 0.02);
    bed.push(back);
  }
  const pole = beam([0, 0, bL / 2 - 0.1], [0, 0, bL / 2 + 1.6], 0.08, seed + 7, lod);
  bed.push(pole);
  for (const g of bed) {
    g.rotateX(tilt);
    g.translate(0, R + 0.06, -0.1);
    wood.push(g);
  }
  return { wood, iron };
}

/** A ladder leaning at `lean` from vertical, `h` tall, its foot at the origin, leaning toward -z. */
export function ladder(h = 3, lean = 0.32, seed = 1, lod = 0) {
  const parts = [];
  for (const s of [-1, 1]) parts.push(blk(lod, 0.055, h, 0.055, { bevel: 0.01, seed: seed + s, wobble: 0.004, grime: 0.3, seg: 1 }).translate(s * 0.2, 0, 0));
  if (lod < 2) {
    for (let y = 0.3; y < h - 0.1; y += 0.3) {
      const r = blk(lod, 0.4, 0.035, 0.035, { bevel: 0.006, seed: seed + y * 10, wobble: 0.002, grime: 0, seg: 1 });
      r.translate(0, y, 0);
      parts.push(r);
    }
  }
  const g = merge(parts);
  g.rotateX(-lean);
  return g;
}

/**
 * A straw or hay stack (meta) built round a pole, as stacks are still
 * built in Italy: a beehive of `r` radius and `h` height, settled and
 * combed down, the pole's tip out of the top. Returns { thatch, wood }.
 */
export function strawStack(r = 1.1, h = 2.4, seed = 1, lod = 0, slump = 0) {
  const rnd = artRng(seed);
  const seg = lod === 0 ? 28 : lod === 1 ? 14 : 8;
  const top = h * (1 - slump * 0.35);
  const P = profileOf([[0, 0.0], [r * 0.85, 0], [r * 0.98, top * 0.15], [r * (1 + slump * 0.12), top * 0.45], [r * 0.8, top * 0.72], [r * 0.45, top * 0.9], [r * 0.12, top * 0.99], [0, top]]);
  const ph = [rnd() * 6.28, rnd() * 6.28];
  const g = revolve(P, {
    segments: seg,
    metres: 1.0,
    deform: (p, th) => {
      const rr = Math.hypot(p.x, p.z);
      if (rr < 1e-4) return;
      const k = 1 + 0.04 * Math.sin(th * 3 + ph[0]) + 0.03 * Math.sin(th * 7 + ph[1]) * smoothstep(0, top, p.y);
      p.x *= k;
      p.z *= k;
    },
    tint: (p) => 0.62 + 0.38 * smoothstep(0, top * 0.4, p.y),
  });
  const wood = [];
  if (lod < 2) {
    const pole = new CylinderGeometry(0.035, 0.05, 0.9, 6, 1);
    pole.translate(0, top + 0.3, 0);
    boxUV(pole);
    wood.push(tintGeometry(pole));
  }
  return { thatch: [g], wood };
}

/** A pile of split logs (firewood) along x, `L` long, about `h` high, on y = 0. Returns bark geometries. */
export function woodpile(L = 1.6, h = 0.7, seed = 1, lod = 0) {
  const rnd = artRng(seed);
  const out = [];
  const rows = lod >= 2 ? 1 : Math.max(2, Math.round(h / 0.16));
  if (lod >= 2) {
    out.push(blk(lod, 0.5, h, L, { bevel: 0.05, seed, wobble: 0.02, grime: 0.3, seg: 1 }).rotateY(Math.PI / 2));
    return out;
  }
  for (let r = 0; r < rows; r++) {
    const n = Math.max(1, Math.round(L / 0.17) - r);
    for (let k = 0; k < n; k++) {
      const rad = 0.06 + rnd() * 0.025;
      const g = new CylinderGeometry(rad, rad * 0.95, 0.55 + rnd() * 0.1, lod ? 5 : 7, 1);
      g.rotateX(Math.PI / 2);
      g.translate(-L / 2 + (k + 0.5 + r * 0.5) * (L / Math.round(L / 0.17)), rad + r * 0.14, (rnd() - 0.5) * 0.06);
      boxUV(g);
      out.push(tintGeometry(g, (x, y, z) => (Math.abs(z) > 0.25 ? 1.25 : 0.95)));
    }
  }
  return out;
}

/** Tufts of weeds round a neglected place: n small green cones, for the `leaf` material. */
export function weeds(n, x0, x1, z0, z1, seed = 1, lod = 0) {
  const rnd = artRng(seed);
  const parts = [];
  const green = lin(0x6f7f3a);
  const dry = lin(0x9a8f55);
  for (let k = 0; k < n; k++) {
    const g = new IcosahedronGeometry(0.16 + rnd() * 0.14, 0);
    g.scale(1, 0.7 + rnd() * 0.6, 1);
    g.translate(x0 + rnd() * (x1 - x0), 0.06, z0 + rnd() * (z1 - z0));
    parts.push(paint(g, mixc(green, dry, rnd() * 0.5), (x, y) => 0.6 + 0.4 * smoothstep(0, 0.3, y)));
    if (lod >= 2 && k > n / 3) break;
  }
  return parts;
}

/** Weld a geometry's vertices (after building it from separate faces) so it shades smooth. */
export function welded(g, tol = 1e-4) {
  const keep = g.attributes.color;
  g.deleteAttribute('normal');
  const w = mergeVertices(g, tol);
  w.computeVertexNormals();
  if (!w.attributes.color && keep) w.setAttribute('color', keep);
  return w;
}

export { D };

/**
 * Geometries gathered by material while a model is built, then merged into
 * one mesh a material (a draw call each, and the kit's one part each).
 * `see` names the see-through materials (water) that cast no shadow.
 */
export class Parts {
  constructor() {
    this.by = new Map();
  }

  /** Add geometries (or arrays of them, or nulls, skipped) under a material's key in ruralMaterials(). */
  add(key, ...geos) {
    let list = this.by.get(key);
    if (!list) {
      list = [];
      this.by.set(key, list);
    }
    for (const g of geos.flat()) if (g) list.push(g);
    return this;
  }

  /** Add every list of a { key: [geometries] } record (houseShell's). */
  addAll(rec) {
    for (const [k, v] of Object.entries(rec)) if (Array.isArray(v)) this.add(k, v);
    return this;
  }

  /**
   * The model as a Group: one mesh a material, named by its key; `extra`
   * materials by key (water) beside ruralMaterials(); `noShadow` keys cast
   * none. Returns { group, meshes, triangles }.
   */
  build(name, { extra = {}, noShadow = [] } = {}) {
    const mats = { ...ruralMaterials(), ...extra };
    const group = new Group();
    group.name = name;
    const meshes = [];
    let tris = 0;
    for (const [key, list] of this.by) {
      if (!list.length) continue;
      const geo = list.length === 1 ? list[0] : merge(list);
      if (list.length > 1) for (const g of list) g.dispose();
      const mesh = new Mesh(geo, mats[key]);
      mesh.name = key;
      mesh.castShadow = !noShadow.includes(key);
      mesh.receiveShadow = true;
      group.add(mesh);
      meshes.push(mesh);
      tris += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
    }
    return { group, meshes, triangles: tris };
  }
}
