/**
 * models/civicParts.js
 * ----------------------------------------------------------------------------
 * Pieces the two civic monuments (the Great Baths, models/thermae.js, and
 * the Caravanserai, models/mansio.js) share: walls that rise course by
 * course while a site is built, the extrados of a groin vault and of a
 * barrel vault (and either only part turned yet), a lunette wall with a
 * thermal window, a polygonal drum, rubble and scorch for a sacked
 * monument. (The construction site's dressing is models/worksite.js's.)
 *
 * Why rising walls here and not a sunk model: a site sinks nothing, it
 * builds upward; a wall cut at the course reached keeps its openings where
 * they belong (a window's jambs stand open to the sky until the courses
 * close over its arch), which is how a half-built Roman wall looked.
 *
 * Metres, y up, as the other models (models/well.js); every geometry has
 * position, normal, uv (metres) and an RGB colour, so merge() takes them.
 * ----------------------------------------------------------------------------
 */

import { BufferGeometry, Float32BufferAttribute, Shape, Path, ExtrudeGeometry, BoxGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { artRng } from '../texgen.js';
import { wallWithOpenings } from './masonry.js';

const TAU = Math.PI * 2;

/** A box w x h x d, its foot at (x, y, z), UVs in metres, a vertex colour of k (a number or f(x, y, z)). */
export function box(w, h, d, x, y, z, k = 1) {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return tintGeometry(boxUV(g), typeof k === 'function' ? k : () => k);
}

/** Lists by key, empty: what a model's parts gather into before TaggedParts takes them. */
export function bag(keys) {
  return Object.fromEntries(keys.map((k) => [k, []]));
}

/** Turn a geometry built facing +z by ry about y, then move it to (x, y, z). */
export function placed(g, x, y, z, ry = 0) {
  if (ry) g.rotateY(ry);
  return g.translate(x, y, z);
}

/**
 * A wall `len` long and `h` high, `t` thick, built along x about 0 with its
 * face at z = 0 (back to -t), its foot at y 0, cut at the course reached `c`
 * (h or more: the whole wall). Openings { x, w, h, y = 0, arch } as
 * masonry.js wallWithOpenings. Below the whole height an opening whose sill
 * the courses have passed stands open to the top (its jambs only); one not
 * yet reached is not there at all. Returns geometries.
 */
export function risingWall(len, h, t, openings = [], c = h, lod = 0) {
  if (c >= h - 1e-6) return [wallWithOpenings(len, h, t, openings, { lod })];
  if (c <= 0.01) return [];
  // The gaps the courses have reached, as x spans with their sills; the solid runs between them.
  const gaps = openings
    .filter((o) => (o.y || 0) < c - 0.02)
    .map((o) => ({ a: o.x - o.w / 2, b: o.x + o.w / 2, sill: o.y || 0, top: (o.y || 0) + o.h + (o.arch ? o.w / 2 : 0) }))
    .sort((p, q) => p.a - q.a);
  const out = [];
  let x = -len / 2;
  const run = (a, b, y0, y1) => {
    if (b - a > 0.005 && y1 - y0 > 0.005) out.push(box(b - a, y1 - y0, t, (a + b) / 2, y0, -t / 2, 1));
  };
  for (const g of gaps) {
    run(x, g.a, 0, c);
    // Under its sill, and over its head once the courses have closed over it.
    run(g.a, g.b, 0, g.sill);
    if (g.top < c) run(g.a, g.b, g.top, c);
    x = g.b;
  }
  run(x, len / 2, 0, c);
  return out;
}

/**
 * The outer skin of a barrel vault (its extrados) along x from x0 to x1,
 * its springing at y0 either side of z = zc, radius r: the half cylinder,
 * or `upTo` (0..1) of its rise turned from each springing (a vault being
 * built rises from both haunches to the crown last). UVs in metres; darker
 * toward its feet (rain runs down it).
 */
export function barrelSkin(x0, x1, y0, zc, r, seg, upTo = 1) {
  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  const idx = [];
  const rows = [];
  for (let j = 0; j <= seg; j++) {
    const a = (j / seg) * Math.PI;
    if (Math.sin(a) <= upTo + 1e-6 || upTo >= 1) rows.push(a);
  }
  // (Rows split where the turned part stops: two runs from the haunches, joined at the crown once whole.)
  let prev = null;
  for (const a of rows) {
    const ny = Math.sin(a);
    const nz = Math.cos(a);
    const base = pos.length / 3;
    for (const x of [x0, x1]) {
      pos.push(x, y0 + r * ny, zc + r * nz);
      nor.push(0, ny, nz);
      uv.push(x, a * r);
      const t = 0.8 + 0.2 * ny;
      col.push(t, t, t);
    }
    if (prev !== null && a - prev < Math.PI / seg + 1e-6) idx.push(base - 2, base - 1, base, base - 1, base + 1, base);
    prev = a;
  }
  return geometry(pos, nor, uv, col, idx);
}

/**
 * The extrados of a groin vault over a square bay 2a wide centred on
 * (cx, cz), springing at y0: the two barrels' skins crossing, each kept
 * where it is the higher (the barrel along x over the bay's ±x quarters,
 * the one along z over its ±z quarters), the valleys over the groins.
 * `upTo` (0..1) of its rise turned (from the springing up: the crown last).
 */
export function groinSkin(cx, cz, a, y0, seg, upTo = 1) {
  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  const idx = [];
  for (const [axis, side] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
    let prev = null;
    for (let j = 0; j <= seg; j++) {
      const ang = (j / seg) * Math.PI;
      if (upTo < 1 && Math.sin(ang) > upTo + 1e-6) {
        prev = null;
        continue;
      }
      const across = a * Math.cos(ang);
      const y = y0 + a * Math.sin(ang);
      const inner = Math.abs(across);
      const base = pos.length / 3;
      for (const along of [inner, a]) {
        const s = side * along;
        // (A barrel along x over the ±x quarters: across is z; along z over the ±z quarters: across is x.)
        if (axis === 'x') {
          pos.push(cx + s, y, cz + across);
          nor.push(0, Math.sin(ang), Math.cos(ang));
          uv.push(cx + s, ang * a);
        } else {
          pos.push(cx + across, y, cz + s);
          nor.push(Math.cos(ang), Math.sin(ang), 0);
          uv.push(cz + s, ang * a);
        }
        const t = 0.8 + 0.2 * Math.sin(ang);
        col.push(t, t, t);
      }
      if (prev !== null) {
        // (geometry() winds each to face its normals.)
        idx.push(base - 2, base - 1, base, base - 1, base + 1, base);
      }
      prev = j;
    }
  }
  return geometry(pos, nor, uv, col, idx);
}

/**
 * A geometry from plain arrays (indexed), each triangle wound to face the
 * way its vertices' normals point (the look's materials draw one side only:
 * a skin wound the wrong way vanishes from above).
 */
function geometry(pos, nor, uv, col, idx) {
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3];
    const ux = pos[b] - pos[a];
    const uy = pos[b + 1] - pos[a + 1];
    const uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a];
    const vy = pos[c + 1] - pos[a + 1];
    const vz = pos[c + 2] - pos[a + 2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const d = n[0] * (nor[a] + nor[b] + nor[c]) + n[1] * (nor[a + 1] + nor[b + 1] + nor[c + 1]) + n[2] * (nor[a + 2] + nor[b + 2] + nor[c + 2]);
    if (d < 0) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

/**
 * The half disc of wall over a vault's end, radius r, t thick, built along x
 * about 0 with its face at z = 0 (back to -t), its foot (the springing) at
 * y 0. `thermal`: a thermal window through it (the baths' half-round
 * window split in three by two mullions, after the Baths of Diocletian), its
 * radius that, its sill `sill` over the springing. Returns { wall, glass }:
 * the glass a half disc set back in the opening (null without a window).
 */
export function lunetteWall(r, t, seg, thermal = 0, sill = 0) {
  const s = new Shape();
  s.moveTo(-r, 0);
  for (let k = 0; k <= seg; k++) {
    const a = Math.PI - (k / seg) * Math.PI;
    s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  let glass = null;
  if (thermal > 0) {
    const m = thermal * 0.09;
    const third = thermal / 3;
    const spans = [[-thermal, -third + m / 2], [-third + m / 2, third - m / 2], [third + m / 2, thermal]];
    // (Each light under its part of the arch; the mullions between them.)
    const arcY = (x) => sill + Math.sqrt(Math.max(0, thermal * thermal - x * x));
    for (let i = 0; i < 3; i++) {
      const [a, b] = spans[i];
      const lo = i === 0 ? a : a + (i === 1 ? 0 : m / 2);
      const hi = i === 2 ? b : b - (i === 1 ? 0 : m / 2);
      const p = new Path();
      p.moveTo(lo + (i === 0 ? 0.01 : 0), sill);
      const steps = Math.max(2, Math.round(seg / 3));
      for (let k = 0; k <= steps; k++) {
        const x = lo + ((hi - lo) * k) / steps;
        p.lineTo(x, Math.max(sill + 0.02, arcY(x) - 0.02));
      }
      p.lineTo(hi - (i === 2 ? 0.01 : 0), sill);
      p.closePath();
      s.holes.push(p);
    }
    const gs = new Shape();
    gs.moveTo(-thermal, sill);
    for (let k = 0; k <= seg; k++) {
      const a = Math.PI - (k / seg) * Math.PI;
      gs.lineTo(Math.cos(a) * thermal, sill + Math.sin(a) * thermal);
    }
    gs.closePath();
    glass = new ExtrudeGeometry(gs, { depth: 0.02, bevelEnabled: false, curveSegments: seg });
    glass.translate(0, 0, -t * 0.55);
    glass.deleteAttribute('uv');
    glass.computeVertexNormals();
    tintGeometry(boxUV(glass));
  }
  const g = new ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -t);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return { wall: tintGeometry(boxUV(g), () => 0.92), glass };
}

/**
 * The facets of a polygonal drum of `n` sides about (cx, cz), its corners
 * on radius R at angles (k / n) turns from +z (as shapes.js revolve lays its
 * segments, so a revolved dome sits square on it), each facet's middle
 * angle, its outward facing (ry) and its length along the outer face.
 */
export function drumFacets(cx, cz, R, n) {
  const out = [];
  const ap = R * Math.cos(Math.PI / n);
  const len = 2 * R * Math.sin(Math.PI / n);
  for (let k = 0; k < n; k++) {
    const th = ((k + 0.5) / n) * TAU;
    out.push({ k, th, ry: th, x: cx + Math.sin(th) * ap, z: cz + Math.cos(th) * ap, len });
  }
  return out;
}

/**
 * A heap of rubble (broken blocks and brick) about (x, z), r across, n
 * pieces, seeded: what raiders leave of a wall they pulled down, and a
 * builders' spoil. Returns geometries.
 */
export function rubbleHeap(x, z, r, n, seed, lod = 0) {
  const rnd = artRng(seed);
  const out = [];
  const count = lod === 2 ? Math.min(n, 4) : lod ? Math.ceil(n * 0.6) : n;
  for (let k = 0; k < count; k++) {
    const a = rnd() * TAU;
    const d = Math.sqrt(rnd()) * r;
    const w = 0.18 + rnd() * 0.32;
    const h = 0.1 + rnd() * 0.2;
    const g = new BoxGeometry(w, h, w * (0.5 + rnd() * 0.6));
    g.rotateX((rnd() - 0.5) * 0.8);
    g.rotateZ((rnd() - 0.5) * 0.8);
    g.rotateY(rnd() * 3);
    // (Piled higher toward the middle.)
    g.translate(x + Math.cos(a) * d, h * 0.3 + (1 - d / r) * r * 0.35, z + Math.sin(a) * d);
    // (Tipped, a block's corner may dip under the ground, which the look clips: lift it to stand on it.)
    g.computeBoundingBox();
    if (g.boundingBox.min.y < 0) g.translate(0, -g.boundingBox.min.y, 0);
    const t = 0.7 + rnd() * 0.3;
    out.push(tintGeometry(boxUV(g), () => t));
  }
  return out;
}

/**
 * A fallen column: its drums lying where they rolled, about (x, z) along
 * `ry`, r the shaft's radius, `n` drums each `len` long. Returns geometries.
 */
export function fallenColumn(x, z, ry, r, n, len, seed, lod = 0) {
  const rnd = artRng(seed);
  const out = [];
  const seg = lod === 2 ? 6 : lod ? 9 : 14;
  for (let k = 0; k < n; k++) {
    const c = cylinderLying(r * (1 - k * 0.04), len * (0.9 + rnd() * 0.15), seg);
    const along = k * len * 1.08 + (rnd() - 0.5) * 0.08;
    const side = (rnd() - 0.5) * 0.25;
    c.rotateY(ry + (rnd() - 0.5) * 0.35);
    c.translate(x + Math.sin(ry) * along + Math.cos(ry) * side, r, z + Math.cos(ry) * along - Math.sin(ry) * side);
    out.push(c);
  }
  return out;
}

/** A cylinder lying along z, radius r, `len` long, centred on its axis at the origin. */
function cylinderLying(r, len, seg) {
  const s = new Shape();
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * TAU;
    if (k === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return tintGeometry(boxUV(g), () => 0.9);
}

/**
 * Soot over a wall's face after a fire: a patch of dark, thin, standing on
 * the wall's face at (x, y, z) facing ry, w wide and h high, its alpha in the
 * vertex colour's darkness (a scorch material). Returns a geometry.
 */
export function scorch(x, y, z, ry, w, h) {
  const g = new BoxGeometry(w, h, 0.004);
  g.translate(0, h / 2, 0.003);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return tintGeometry(boxUV(g), (px, py) => 0.6 + 0.4 * Math.min(1, (py - y) / h));
}
