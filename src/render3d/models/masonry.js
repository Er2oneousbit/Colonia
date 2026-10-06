/**
 * models/masonry.js
 * ----------------------------------------------------------------------------
 * Building parts the market, the forum and the warehouse share: cheap cut
 * stones for pavings and ashlar courses, a Tuscan column, a roof of
 * tegulae and imbrices on any four-sided slope, a wall with arched or
 * square openings, and the turned shapes the goods and fittings use.
 *
 * Why not shapes.js block() everywhere: a block is a rounded box of 108 to
 * 300 triangles, right for the well's twenty stones and wrong for a
 * paving of eighty flags or a facade of forty blocks. slab() is a box with
 * a chamfered top (18 triangles) pushed out of square by its seed, which
 * at the game's zooms reads the same.
 *
 * Metres, y up, as the other models (models/well.js); every geometry has
 * position, normal, uv (metres) and an RGB colour, so merge() takes them.
 * ----------------------------------------------------------------------------
 */

import {
  BufferGeometry, Float32BufferAttribute, CylinderGeometry, Shape, Path, ExtrudeGeometry, BoxGeometry,
} from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { artRng, smoothstep } from '../texgen.js';
import { material } from '../materials.js';

const D = (deg) => (deg * Math.PI) / 180;

/**
 * A cut stone w x h x d, centred on x and z, its foot at y 0: a box whose
 * top edges are chamfered (`bevel`), its corners nudged by the seed
 * (`wobble`), its top tipped a little (`tilt`, metres across), a tone of
 * its own (`tone`) and dirt toward its foot (`grime`).
 */
export function slab(w, h, d, { bevel = 0.015, seed = 1, wobble = 0.004, tilt = 0, tone = 0.06, grime = 0.2, bottom = false } = {}) {
  const rnd = artRng(seed);
  const b = Math.min(bevel, w * 0.3, d * 0.3, h * 0.45);
  const x = w / 2;
  const z = d / 2;
  const jit = () => (rnd() - 0.5) * 2 * wobble;
  const tx = (rnd() - 0.5) * tilt;
  const tz = (rnd() - 0.5) * tilt;
  // Corners: the foot (4), the top's outer ring where the chamfer starts (4), the top's inner ring (4).
  const foot = [[-x, z], [x, z], [x, -z], [-x, -z]].map(([px, pz]) => [px + jit(), 0, pz + jit()]);
  const ring = foot.map(([px, , pz]) => [px, h - b + jit() * 0.5, pz]);
  const top = foot.map(([px, , pz]) => [px - Math.sign(px) * b + jit() * 0.3, h + jit() * 0.3 + (px / w) * tx + (pz / d) * tz, pz - Math.sign(pz) * b + jit() * 0.3]);
  const pos = [];
  const quad = (a, bb, c, dd) => pos.push(...a, ...bb, ...c, ...a, ...c, ...dd);
  // The top, the chamfer round it, the four sides.
  quad(top[0], top[1], top[2], top[3]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(ring[i], ring[j], top[j], top[i]);
    quad(foot[i], foot[j], ring[j], ring[i]);
  }
  // (Its underside only when asked: a stone on the ground never shows it, a strongbox's raised lid does.)
  if (bottom) quad(foot[3], foot[2], foot[1], foot[0]);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  boxUV(g, rnd() * 3, rnd() * 3);
  const k = 1 + (rnd() * 2 - 1) * tone;
  return tintGeometry(g, (px, py) => k * (1 - grime * (1 - Math.min(1, py / Math.max(0.05, Math.min(h, 0.3)))) ** 2));
}

/**
 * Flags over a rectangle (x0..x1, z0..z1), h thick, in courses of `rowW`
 * of seeded lengths; `skip(x, z)` leaves a flag out (under a building's
 * own floor). At lod 2 one slab. Returns a list of geometries.
 */
export function paving(x0, x1, z0, z1, h, seed, { rowW = 0.6, minL = 0.5, maxL = 1.0, skip = null, lod = 0, tone = 0.07, grime = 0.15, bevel = 0.012 } = {}) {
  if (lod === 2) return [slab(x1 - x0, h, z1 - z0, { bevel: 0.01, seed, wobble: 0, tone: 0, grime }).translate((x0 + x1) / 2, 0, (z0 + z1) / 2)];
  // (From the middle distance a joint every metre and a half reads as well as every half metre.)
  if (lod === 1) {
    rowW *= 1.8;
    minL *= 1.8;
    maxL *= 1.8;
  }
  const rnd = artRng(seed);
  const out = [];
  const gap = 0.008;
  let n = 0;
  for (let z = z0; z < z1 - 0.05; z += rowW) {
    const zb = Math.min(z1, z + rowW);
    let x = x0;
    while (x < x1 - 0.05) {
      let xb = Math.min(x1, x + minL + rnd() * (maxL - minL));
      if (x1 - xb < minL * 0.5) xb = x1;
      const cx = (x + xb) / 2;
      const cz = (z + zb) / 2;
      if (!skip || !skip(cx, cz)) {
        out.push(slab(xb - x - gap, h + (rnd() - 0.5) * 0.006, zb - z - gap, {
          bevel, seed: seed * 31 + ++n, wobble: lod ? 0 : 0.004, tilt: lod ? 0 : 0.008, tone, grime,
        }).translate(cx, 0, cz));
      }
      x = xb;
    }
  }
  return out;
}

/**
 * A Tuscan column standing on y 0: a square plinth, a torus, the shaft
 * tapering to 0.85 of its foot, an echinus and a square abacus; `h` to the
 * abacus's top, `r` the shaft's radius at its foot. Returns geometries.
 */
export function tuscanColumn(r, h, lod = 0, { plinth = true } = {}) {
  const seg = lod === 2 ? 6 : lod ? 10 : 20;
  const n = lod ? 2 : 4;
  const out = [];
  const ph = plinth ? r * 0.45 : 0;
  if (plinth) out.push(slab(r * 2.7, ph, r * 2.7, { bevel: r * 0.08, wobble: 0, tone: 0, grime: 0.3 }));
  const capH = r * 0.75;
  const shaftTop = h - capH;
  // The base's torus and the shaft, one turned profile (entasis: a slight swell a third up).
  const P = [[r * 1.18, ph], ...(lod === 2 ? [] : [{ arc: [r * 1.12, ph + r * 0.2, r * 0.2, D(-90), D(90)], n }])];
  const steps = lod ? 3 : 6;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const y = ph + r * 0.42 + (shaftTop - ph - r * 0.42) * t;
    P.push([r * (1 - 0.15 * t + 0.03 * Math.sin(Math.PI * t * 0.9)), y]);
  }
  // The echinus (a quarter round) and the neck under it.
  P.push([r * 0.9, shaftTop + r * 0.06]);
  if (lod < 2) P.push({ arc: [r * 0.9, shaftTop + r * 0.42, r * 0.36, D(-90), D(0)], n });
  P.push([r * 1.26, shaftTop + r * 0.42], [0, shaftTop + r * 0.42]);
  out.push(revolve(profileOf(P), { segments: seg, metres: 1, tint: (p) => 0.78 + 0.22 * smoothstep(0, 0.6, p.y) }));
  // The abacus: square.
  out.push(slab(r * 2.6, capH - r * 0.42, r * 2.6, { bevel: r * 0.06, wobble: 0, tone: 0, grime: 0 }).translate(0, shaftTop + r * 0.42, 0));
  return out;
}

/**
 * A tiled roof on a four-sided slope: `quad` gives its corners as [x, y, z]
 * (the eave's two ends first, left to right as seen from below it, then
 * the top edge's, right to left), flat tegulae as one sheet with a row of
 * shading per course, imbrices (half pipes over the joints) running down
 * it every `pitch` metres and clipped to its sides, antefixes along the
 * eave. Returns { tiles: [geometries] } in terracotta.
 */
export function tiledRoof(quad, { pitch = 0.42, lod = 0, seed = 1, antefix = true, thick = 0.06, imbrexR = 0.07 } = {}) {
  const [e0, e1, t1, t0] = quad;
  const rnd = artRng(seed);
  const tiles = [];
  // The sheet: rows along the slope, each course a shade lighter or darker (old tiles mixed with new).
  const courses = lod === 2 ? 1 : Math.max(2, Math.round(dist(e0, t0) / 0.5));
  const pos = [];
  const col = [];
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  for (let c = 0; c < courses; c++) {
    // Each course starts a little down over the one below it (lifted by a tile's thickness there): no gap between.
    const lap = c ? 0.25 : 0;
    const a0 = lerp(e0, t0, (c - lap) / courses);
    const a1 = lerp(e1, t1, (c - lap) / courses);
    const b0 = lerp(e0, t0, (c + 1) / courses);
    const b1 = lerp(e1, t1, (c + 1) / courses);
    // Each course laps over the one below it: its lower edge a tile's thickness up.
    const lift = lod === 2 ? 0 : thick * 0.5;
    const up = (p, k) => [p[0], p[1] + k, p[2]];
    pos.push(...up(a0, lift), ...up(a1, lift), ...b1, ...up(a0, lift), ...b1, ...b0);
    const s = 0.86 + rnd() * 0.18;
    for (let k = 0; k < 6; k++) col.push(s, s, s);
  }
  const sheet = new BufferGeometry();
  sheet.setAttribute('position', new Float32BufferAttribute(pos, 3));
  sheet.setAttribute('color', new Float32BufferAttribute(col, 3));
  sheet.computeVertexNormals();
  // (Whichever way round the caller gave the corners, the tiles face the sky.)
  if (sheet.attributes.normal.getY(0) < 0) {
    const p = sheet.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const x = p.getX(i + 1);
      const y = p.getY(i + 1);
      const z = p.getZ(i + 1);
      p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
      p.setXYZ(i + 2, x, y, z);
    }
    sheet.computeVertexNormals();
  }
  boxUV(sheet);
  tiles.push(sheet);
  if (lod === 2) return { tiles };
  // Imbrices: half pipes over the joints, straight down the slope, every `pitch` across it,
  // each clipped to the slope's sides (a hipped or a valleyed side cuts the runs short).
  const mid = (a, b) => a.map((v, i) => (v + b[i]) / 2);
  const em = mid(e0, e1);
  const U = sub(mid(t0, t1), em);
  const L = sub(e1, e0);
  const ll = Math.hypot(L[0], L[1], L[2]);
  for (let i = 0; i < 3; i++) L[i] /= ll;
  const lat = (p) => dot(sub(p, em), L);
  const [a0, b0, a1, b1] = [lat(e0), lat(t0), lat(e1), lat(t1)];
  const lo = Math.min(a0, b0);
  const hi = Math.max(a1, b1);
  const n = Math.max(1, Math.round((hi - lo) / pitch));
  const radial = lod ? 3 : 5;
  for (let k = 1; k < n; k++) {
    const x = lo + ((hi - lo) * k) / n;
    // Inside while side 0's lateral (a0 to b0 as s goes 0 to 1) is at most x, and side 1's at least x.
    let s0 = 0;
    let s1 = 1;
    for (const [a, b, sign] of [[a0, b0, 1], [a1, b1, -1]]) {
      const d = (b - a) * sign;
      const c = (x - a) * sign; // inside where d * s <= c
      if (Math.abs(d) < 1e-9) {
        if (c < 0) s1 = -1;
        continue;
      }
      if (d > 0) s1 = Math.min(s1, c / d);
      else s0 = Math.max(s0, c / d);
    }
    if (s1 - s0 < 0.05) continue;
    const at = (s) => [em[0] + L[0] * x + U[0] * s, em[1] + L[1] * x + U[1] * s, em[2] + L[2] * x + U[2] * s];
    const from = at(s1);
    const to = at(s0);
    tiles.push(imbrex(from, to, radial, rnd, imbrexR));
    if (antefix && lod === 0 && s0 < 1e-6) tiles.push(antefixAt(to, sub(to, from), rnd));
  }
  return { tiles };
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A half pipe (imbrex run) from a to b, lying on the slope, ridge up. */
function imbrex(a, b, radial, rnd, r = 0.07) {

  const g = new CylinderGeometry(r, r * 1.05, dist(a, b), radial * 2, 1, true, Math.PI / 2, Math.PI);
  // Built along y: lay it along a -> b, its open side down.
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const l = Math.hypot(dx, dy, dz);
  // (Its -z half, turned to lie along z, is the half facing up: a ridge, not a gutter.)
  g.rotateX(Math.PI / 2);
  // Now along z with its ridge up; tip and turn it to the run's direction.
  const yaw = Math.atan2(dx, dz);
  const pitchA = -Math.asin(dy / l);
  g.rotateX(pitchA);
  g.rotateY(yaw);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.01, (a[2] + b[2]) / 2);
  boxUV(g);
  const s = 0.9 + rnd() * 0.15;
  return tintGeometry(g, () => s);
}

/** An antefix: a small upright palmette closing an imbrex at the eave. */
function antefixAt(p, down, rnd) {
  const g = revolve(profileOf([[0, 0], [0.06, 0], [0.075, 0.05], [0.05, 0.11], [0.015, 0.15], [0, 0.155]]), { segments: 5, metres: 0.6 });
  g.scale(1, 1, 0.12);
  g.rotateY(Math.atan2(down[0], down[2]));
  g.translate(p[0], p[1] - 0.02, p[2]);
  const s = 0.95 + rnd() * 0.1;
  return tintGeometry(g, () => s);
}

/**
 * A wall in the x-y plane, `w` long (centred on x), `h` tall, `t` thick
 * (from z = 0 back to -t), with openings cut through it: each
 * { x, w, h, y = 0, arch = false } (an arch: a round head of half its
 * width on top of h). UVs in metres on its faces, so a brick or a stucco
 * texture runs on across it. lod 2: the openings' arches as fewer facets.
 */
export function wallWithOpenings(w, h, t, openings = [], { lod = 0, y0 = 0 } = {}) {
  const s = new Shape();
  s.moveTo(-w / 2, y0);
  s.lineTo(w / 2, y0);
  s.lineTo(w / 2, y0 + h);
  s.lineTo(-w / 2, y0 + h);
  s.closePath();
  const seg = lod === 2 ? 3 : lod ? 6 : 10;
  for (const o of openings) {
    const p = new Path();
    const oy = y0 + (o.y || 0);
    const x0 = o.x - o.w / 2;
    const x1 = o.x + o.w / 2;
    p.moveTo(x0, oy);
    if (o.arch) {
      p.lineTo(x0, oy + o.h);
      // The arch's head, from the left springing over to the right.
      for (let k = 1; k <= seg; k++) {
        const a = Math.PI - (k / seg) * Math.PI;
        p.lineTo(o.x + Math.cos(a) * (o.w / 2), oy + o.h + Math.sin(a) * (o.w / 2));
      }
      p.lineTo(x1, oy);
    } else {
      p.lineTo(x0, oy + o.h);
      p.lineTo(x1, oy + o.h);
      p.lineTo(x1, oy);
    }
    p.closePath();
    // (A hole is wound the other way round from its shape.)
    s.holes.push(p);
  }
  const g = new ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -t);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  boxUV(g);
  return tintGeometry(g);
}

/**
 * A bronze lantern standing on (x, y, z): a base and a domed cap with horn
 * panes between them that glow when lit. Returns { bronze, pane }; the
 * pane takes lanternPane(), the well's lantern glass, which the look lab
 * lights at night (the game's night lights it in its light map).
 */
export function lantern(x, y, z, lod = 0) {
  const seg = lod ? 6 : 12;
  const base = revolve(profileOf([[0, 0], [0.07, 0], [0.075, 0.02], [0.075, 0.04], [0.06, 0.048], [0, 0.048]]), { segments: seg, metres: 0.3 });
  const cap = revolve(profileOf([[0, 0.17], [0.065, 0.17], [0.08, 0.19], [0.05, 0.25], [0.02, 0.27], [0.015, 0.29], [0, 0.3]]), { segments: seg, metres: 0.3 });
  const pane = new CylinderGeometry(0.062, 0.062, 0.122, seg, 1, true).translate(0, 0.109, 0);
  return { bronze: [base.translate(x, y, z), cap.translate(x, y, z)], pane: tintGeometry(boxUV(pane.translate(x, y, z))) };
}

/** The lanterns' horn panes (the well's material: one key, so the lab's night lights them all). */
export function lanternPane() {
  return material('lantern-pane', { color: 0xc89a5a, roughness: 0.45, emissive: 0xffb25c, emissiveIntensity: 0, snow: 0 });
}

/** An ellipse's outline as strokes in a glyph's box (the bowl of an O), `n` of them. */
function bowl(cx, cy, rx, ry, n = 10) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const b = ((k + 1) / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, cx + Math.cos(b) * rx, cy + Math.sin(b) * ry]);
  }
  return out;
}

/** The C's strokes (the G is a C with its spur). */
const C_STROKES = [[0.66, 0.84, 0.46, 1], [0.46, 1, 0.2, 0.94], [0.2, 0.94, 0.05, 0.74], [0.05, 0.74, 0.05, 0.26], [0.05, 0.26, 0.2, 0.06], [0.2, 0.06, 0.46, 0], [0.46, 0, 0.68, 0.14]];
/**
 * Roman capitals as strokes, each [x0, y0, x1, y1] in a box one high and
 * `w` wide: the letters the buildings' inscriptions use (the forum's,
 * the watch house's, the builders' sign), the bowls as polygons.
 */
export const GLYPHS = Object.freeze({
  T: { w: 0.7, s: [[0, 1, 0.7, 1], [0.35, 1, 0.35, 0]] },
  A: { w: 0.72, s: [[0, 0, 0.36, 1], [0.36, 1, 0.72, 0], [0.16, 0.36, 0.56, 0.36]] },
  B: { w: 0.62, s: [[0, 0, 0, 1], [0, 1, 0.4, 1], [0.4, 1, 0.54, 0.88], [0.54, 0.88, 0.54, 0.64], [0.54, 0.64, 0.4, 0.53], [0, 0.53, 0.42, 0.53], [0.42, 0.53, 0.6, 0.4], [0.6, 0.4, 0.6, 0.14], [0.6, 0.14, 0.44, 0], [0.44, 0, 0, 0]] },
  V: { w: 0.72, s: [[0, 1, 0.36, 0], [0.36, 0, 0.72, 1]] },
  L: { w: 0.56, s: [[0, 1, 0, 0], [0, 0, 0.56, 0]] },
  R: { w: 0.64, s: [[0, 0, 0, 1], [0, 1, 0.42, 1], [0.42, 1, 0.58, 0.86], [0.58, 0.86, 0.58, 0.64], [0.58, 0.64, 0.42, 0.5], [0.42, 0.5, 0, 0.5], [0.3, 0.5, 0.64, 0]] },
  I: { w: 0.08, s: [[0.04, 0, 0.04, 1]] },
  M: { w: 0.9, s: [[0, 0, 0.04, 1], [0.04, 1, 0.45, 0.06], [0.45, 0.06, 0.86, 1], [0.86, 1, 0.9, 0]] },
  P: { w: 0.62, s: [[0, 0, 0, 1], [0, 1, 0.42, 1], [0.42, 1, 0.58, 0.86], [0.58, 0.86, 0.58, 0.64], [0.58, 0.64, 0.42, 0.5], [0.42, 0.5, 0, 0.5]] },
  C: { w: 0.7, s: C_STROKES },
  G: { w: 0.72, s: [...C_STROKES.slice(0, -1), [0.46, 0, 0.68, 0.12], [0.68, 0.12, 0.68, 0.42], [0.68, 0.42, 0.42, 0.42]] },
  O: { w: 0.8, s: bowl(0.4, 0.5, 0.38, 0.5) },
  E: { w: 0.54, s: [[0, 0, 0, 1], [0, 1, 0.52, 1], [0, 0.52, 0.42, 0.52], [0, 0, 0.54, 0]] },
  F: { w: 0.54, s: [[0, 0, 0, 1], [0, 1, 0.52, 1], [0, 0.54, 0.42, 0.54]] },
  H: { w: 0.66, s: [[0, 0, 0, 1], [0.66, 0, 0.66, 1], [0, 0.52, 0.66, 0.52]] },
  S: { w: 0.6, s: [[0.56, 0.86, 0.42, 1], [0.42, 1, 0.16, 1], [0.16, 1, 0.03, 0.86], [0.03, 0.86, 0.03, 0.68], [0.03, 0.68, 0.16, 0.56], [0.16, 0.56, 0.44, 0.46], [0.44, 0.46, 0.57, 0.33], [0.57, 0.33, 0.57, 0.14], [0.57, 0.14, 0.44, 0], [0.44, 0, 0.16, 0], [0.16, 0, 0.02, 0.14]] },
  X: { w: 0.66, s: [[0, 0, 0.66, 1], [0, 1, 0.66, 0]] },
  '·': { w: 0.2, s: [[0.06, 0.46, 0.14, 0.46]] },
});

/**
 * `text` in cut strokes (letters from GLYPHS), centred on x = 0, its foot at
 * y, its face at z, `h` tall: geometries for a paint-red material, as Roman
 * inscriptions had their letters cut and filled with red.
 */
export function inscription(text, y, z, h) {
  const sw = h * 0.13;
  const gap = h * 0.28;
  const width = [...text].reduce((a, ch) => a + GLYPHS[ch].w * h + gap, -gap);
  let x = -width / 2;
  const out = [];
  for (const ch of text) {
    const g = GLYPHS[ch];
    for (const [x0, y0, x1, y1] of g.s) {
      const ax = x + x0 * h;
      const ay = y + y0 * h;
      const bx = x + x1 * h;
      const by = y + y1 * h;
      const len = Math.hypot(bx - ax, by - ay) + sw * 0.8;
      const s = new BoxGeometry(len, sw, 0.006);
      s.rotateZ(Math.atan2(by - ay, bx - ax));
      s.translate((ax + bx) / 2, (ay + by) / 2, z);
      out.push(tintGeometry(boxUV(s)));
    }
    x += g.w * h + gap;
  }
  return out;
}

/** The width of `text` set by inscription() at height `h` (metres). */
export function inscriptionWidth(text, h) {
  return [...text].reduce((a, ch) => a + GLYPHS[ch].w * h + h * 0.28, -h * 0.28);
}

/** A bent tube along points (re-exported for the goods: rails, hooks, handles). */
export { tube };
