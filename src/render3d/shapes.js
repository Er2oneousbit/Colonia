/**
 * shapes.js
 * ----------------------------------------------------------------------------
 * Geometry helpers for the 3D look: turned stone (a profile revolved, with a
 * hook to carve it), irregular bevelled blocks, tubes in metres, and the
 * per-vertex colour that bakes grime and contact darkening into a mesh.
 *
 * Conventions every helper keeps, so meshes can be merged and share
 * materials:
 *   - metres, y up;
 *   - UVs in metres (the material scales them by its texture's size), and
 *     around a revolved or tubular shape a whole number of texture repeats,
 *     or the seam would show;
 *   - attributes position, normal, uv and color on every geometry (colour
 *     white where nothing darkens it), so mergeGeometries takes any mix.
 * ----------------------------------------------------------------------------
 */

import {
  BufferGeometry, Float32BufferAttribute, CatmullRomCurve3, TubeGeometry, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { artRng } from './texgen.js';

/** Snap a length around a shape to a whole number of texture repeats (at least one). */
export function wrapLength(len, metres) {
  return Math.max(1, Math.round(len / metres)) * metres;
}

/**
 * Revolve a profile about the y axis.
 *   profile   [[r, y], ...] walked so the solid is on the LEFT (up the
 *             outside, inward across a top, down a bore); repeat a point
 *             for a hard edge (the zero-length step between the copies
 *             splits the normals there)
 *   segments  steps around
 *   metres    the texture repeat, to snap UVs around to whole repeats
 *   deform    (p, theta, i) => void: move point p {x, y, z} (flutes, grooves, dents)
 *   tint      (p, theta, i) => [r, g, b] or a number: the vertex colour (grime, baked occlusion)
 */
export function revolve(profile, { segments = 64, metres = 1, deform = null, tint = null } = {}) {
  const P = profile.length;
  const pos = new Float32Array(P * (segments + 1) * 3);
  const uv = new Float32Array(P * (segments + 1) * 2);
  const col = new Float32Array(P * (segments + 1) * 3);
  // Arc length along the profile (v) and the circumference used for u.
  const arc = [0];
  let rMax = 0;
  for (let i = 1; i < P; i++) arc.push(arc[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  for (const [r] of profile) rMax = Math.max(rMax, r);
  const around = wrapLength(2 * Math.PI * rMax, metres);
  const p = { x: 0, y: 0, z: 0 };
  for (let j = 0; j <= segments; j++) {
    const t = j / segments;
    const th = t * Math.PI * 2;
    const s = Math.sin(th);
    const c = Math.cos(th);
    for (let i = 0; i < P; i++) {
      const [r, y] = profile[i];
      p.x = r * s;
      p.y = y;
      p.z = r * c;
      if (deform) deform(p, j === segments ? 0 : th, i);
      const k = j * P + i;
      pos[k * 3] = p.x;
      pos[k * 3 + 1] = p.y;
      pos[k * 3 + 2] = p.z;
      uv[k * 2] = t * around;
      uv[k * 2 + 1] = arc[i];
      writeTint(col, k, tint ? tint(p, th, i) : 1);
    }
  }
  const idx = [];
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < P - 1; i++) {
      const a = j * P + i;
      const b = a + P;
      const cc = b + 1;
      const d = a + 1;
      idx.push(a, b, d, b, cc, d);
    }
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // The seam: the first and last rings are the same points with half the faces each; give both the sum.
  const n = g.attributes.normal.array;
  for (let i = 0; i < P; i++) {
    const a = i * 3;
    const b = (segments * P + i) * 3;
    for (let q = 0; q < 3; q++) {
      const v = n[a + q] + n[b + q];
      n[a + q] = v;
      n[b + q] = v;
    }
    const la = Math.hypot(n[a], n[a + 1], n[a + 2]) || 1;
    for (let q = 0; q < 3; q++) {
      n[a + q] /= la;
      n[b + q] /= la;
    }
  }
  return g;
}

/**
 * A profile swept round a rectangle, the way a mason runs a moulding round
 * a basin or the cap of a pillar: the rectangle's half sizes are `hx` and
 * `hz`, each profile point [d, y] lies `d` metres outside it (negative:
 * inside), and the four sides meet in mitres at the corners (each side is
 * its own strip, so the corners stay sharp). The profile is walked as for
 * revolve() (up the outside, inward across a top, down the inside), and a
 * last point at d = -min(hx, hz) closes a solid top. UVs: along each side in
 * metres (the side's own coordinate), and along the profile.
 *   deform, tint   as revolve's, with (p, side, i): side 0..3 is +z, +x, -z, -x
 *   steps          columns along each side (more, for a deform that carves a side: a notch)
 */
export function frameSweep(profile, hx, hz, { deform = null, tint = null, steps = 1 } = {}) {
  const P = profile.length;
  const arc = [0];
  for (let i = 1; i < P; i++) arc.push(arc[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  // Each side from one corner to the next, turning as revolve's theta turns (+z, then +x, -z, -x).
  const sides = [
    (d) => [[-(hx + d), hz + d], [hx + d, hz + d]],
    (d) => [[hx + d, hz + d], [hx + d, -(hz + d)]],
    (d) => [[hx + d, -(hz + d)], [-(hx + d), -(hz + d)]],
    (d) => [[-(hx + d), -(hz + d)], [-(hx + d), hz + d]],
  ];
  const pos = [];
  const uv = [];
  const col = [];
  const idx = [];
  const p = { x: 0, y: 0, z: 0 };
  sides.forEach((side, s) => {
    const base = pos.length / 3;
    for (let j = 0; j <= steps; j++) {
      const f = j / steps;
      for (let i = 0; i < P; i++) {
        const [d, y] = profile[i];
        const [a, b] = side(d);
        const x = a[0] + (b[0] - a[0]) * f;
        const z = a[1] + (b[1] - a[1]) * f;
        p.x = x;
        p.y = y;
        p.z = z;
        if (deform) deform(p, s, i);
        pos.push(p.x, p.y, p.z);
        // Along the side: x on the z sides, z on the x sides (so the stone's grain runs on round the corner).
        uv.push(s % 2 === 0 ? p.x : p.z, arc[i]);
        const t = tint ? tint(p, s, i) : 1;
        if (typeof t === 'number') col.push(t, t, t);
        else col.push(t[0], t[1], t[2]);
      }
    }
    for (let j = 0; j < steps; j++) {
      for (let i = 0; i < P - 1; i++) {
        const a = base + j * P + i;
        const b = a + P;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  });
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function writeTint(col, k, t) {
  if (typeof t === 'number') {
    col[k * 3] = t;
    col[k * 3 + 1] = t;
    col[k * 3 + 2] = t;
  } else {
    col[k * 3] = t[0];
    col[k * 3 + 1] = t[1];
    col[k * 3 + 2] = t[2];
  }
}

/**
 * A profile from a list of steps, for revolve(): each step is [r, y] or a
 * curve { arc: [cx, cy, radius, a0, a1], n } (a circular moulding traced
 * from angle a0 to a1, radians, in the r-y plane) or { sharp: true } to
 * repeat the last point (a hard edge).
 */
export function profileOf(steps) {
  const out = [];
  for (const s of steps) {
    if (Array.isArray(s)) out.push(s);
    else if (s.sharp) out.push(out[out.length - 1].slice());
    else if (s.arc) {
      const [cx, cy, rad, a0, a1] = s.arc;
      const n = s.n || 6;
      for (let k = 0; k <= n; k++) {
        const a = a0 + ((a1 - a0) * k) / n;
        out.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
      }
    }
  }
  return out;
}

/**
 * A rounded box with its vertices welded (no normals or UVs: block() makes
 * its own), kept by size: a roof's hundred tiles are one shape, and making
 * it (three's RoundedBoxGeometry, then the weld) was most of the street's
 * build time. Callers clone it.
 */
const BOXES = new Map();
function roundedBox(w, h, d, seg, r) {
  const key = `${w},${h},${d},${seg},${r}`;
  let g = BOXES.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, seg, r);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeVertices(g, 1e-5);
    if (BOXES.size > 256) BOXES.clear();
    BOXES.set(key, g);
  }
  return g;
}

/**
 * A stone block, w x h x d metres, centred on x and z with its bottom at y
 * 0: bevelled (radius `bevel`), then pushed out of square by a smooth
 * seeded wobble (`wobble` metres at most), so no two blocks of a course
 * are alike; UVs projected on its faces in metres from a random offset
 * (each block shows a different piece of the stone); vertex colour darker
 * toward its foot (`grime`: dirt and splash at the bottom of a block),
 * and lighter or darker as a whole by up to `tone` (stones from one quarry
 * still differ).
 */
export function block(w, h, d, { bevel = 0.02, seed = 1, wobble = 0.01, grime = 0.25, topSag = 0, seg = 2, tone = 0 } = {}) {
  const r = Math.min(bevel, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const g = roundedBox(w, h, d, seg, r).clone();
  const rnd = artRng(seed);
  // Three smooth waves per axis with random direction and phase: a wobble, not noise.
  const waves = [];
  for (let k = 0; k < 9; k++) {
    waves.push({ ax: k % 3, f: [rnd() * 6 - 3, rnd() * 6 - 3, rnd() * 6 - 3], ph: rnd() * 6.28, a: wobble * (0.4 + rnd() * 0.6) / 1.5 });
  }
  const sagX = (rnd() - 0.5) * topSag;
  const sagZ = (rnd() - 0.5) * topSag;
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const o = [0, 0, 0];
    for (const wv of waves) o[wv.ax] += wv.a * Math.sin(wv.f[0] * x + wv.f[1] * y + wv.f[2] * z + wv.ph);
    // A worn top dips toward one side (feet, weather).
    const top = (y + h / 2) / h;
    o[1] += top * (sagX * (x / w) + sagZ * (z / d));
    pos.setXYZ(i, x + o[0], y + h / 2 + o[1], z + o[2]);
  }
  g.computeVertexNormals();
  boxUV(g, rnd() * 3, rnd() * 3);
  const col = new Float32Array(pos.count * 3);
  const k = 1 + (rnd() * 2 - 1) * tone;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, pos.getY(i) / Math.max(0.05, Math.min(h, 0.35)));
    writeTint(col, i, k * (1 - grime * (1 - t) * (1 - t)));
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

/** Project UVs (metres) onto a geometry by each vertex's main normal axis, shifted by (ou, ov). */
export function boxUV(g, ou = 0, ov = 0) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let u;
    let v;
    if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u + ou;
    uv[i * 2 + 1] = v + ov;
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

/** Give a geometry a vertex colour from f(x, y, z) (a number or [r, g, b]); white if no f. */
export function tintGeometry(g, f = null) {
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) writeTint(col, i, f ? f(pos.getX(i), pos.getY(i), pos.getZ(i)) : 1);
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

/**
 * A tube along a smooth curve through `points` (Vector3 or [x, y, z]),
 * radius `radius`, UVs in metres along it and one texture repeat
 * (`around` metres) around it, so a rope's strands meet at the seam.
 */
export function tube(points, radius, { segments = 0, radial = 8, around = 0.06, closed = false, tension = 0.5 } = {}) {
  const pts = points.map((p) => (p.isVector3 ? p : new Vector3(p[0], p[1], p[2])));
  const curve = new CatmullRomCurve3(pts, closed, 'catmullrom', tension);
  const len = curve.getLength();
  const n = segments || Math.max(8, Math.ceil(len / 0.02));
  const g = new TubeGeometry(curve, n, radius, radial, closed);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * around);
  tintGeometry(g);
  g.userData.length = len;
  return g;
}

/** Merge geometries that share one material into one mesh's geometry (one draw call). */
export function merge(list) {
  const prepared = list.map((g) => {
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.color) tintGeometry(g);
    if (!g.attributes.uv) boxUV(g);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  });
  // mergeGeometries wants all indexed or all not: index the plain ones.
  const anyIndexed = prepared.some((g) => g.index);
  const fixed = prepared.map((g) => (anyIndexed && !g.index ? indexed(g) : g));
  return mergeGeometries(fixed, false);
}

/** A non-indexed geometry with a trivial index (0, 1, 2, ...). */
function indexed(g) {
  const n = g.attributes.position.count;
  const idx = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(idx);
  return g;
}

/** Triangles in a geometry. */
export function triangles(g) {
  return g.index ? g.index.count / 3 : g.attributes.position.count / 3;
}
