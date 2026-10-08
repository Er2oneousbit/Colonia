/**
 * units/quadMesh.js
 * ----------------------------------------------------------------------------
 * The beasts' bodies, skinned to their skeleton (quadRig.js): surfaces made
 * of rings lofted along the body from the rump to the brisket, up the neck,
 * along the head, down each leg from the shoulder's or the haunch's muscle
 * mass to the paw or the hoof, and along the tail; each ring a superellipse
 * whose width, depth and keel follow the animal's anatomy (the deep narrow
 * chest and tucked loins of a wolf, a horse's barrel, an elephant's bulk),
 * every vertex weighted to the bones that move it (the shoulder's muscle to
 * the leg as well as the thorax, so it rolls with the stride).
 *
 *   quad:wolf             the grey wolf: the darker saddle (the hair colour),
 *                         grizzled grey-fawn flanks (the skin colour), the
 *                         cream of the throat, belly, inner legs and cheeks
 *                         (the trim colour), the dark lips, nose and pads,
 *                         amber eyes, erect ears, the bushy tail
 *   quad:horse[:tack]     the horse; tack 'saddle' (the four-horned Roman
 *                         saddle on its cloth, the accent colour; girth,
 *                         breast strap and breeching hung with bronze
 *                         phalerae; the bridle), 'bare' (a Numidian's: a
 *                         neck rope, no bit), 'yoke' (a chariot pony's yoke
 *                         saddle and breast strap); its coat the skin, its
 *                         mane, tail and points the hair, socks the trim
 *   quad:elephant[:tower] the war elephant: grey wrinkled hide, the great
 *                         ears, the trunk, the tusks; 'tower' the fighting
 *                         tower on its back over a saddle cloth (the accent)
 *                         with shields hung on its sides (the trim)
 *
 * Metres, standing on y 0, facing +z. The slots and colours are the people's
 * (people/mesher.js SLOTS), so the people's material draws them.
 * ----------------------------------------------------------------------------
 */

import { Mesher, SLOTS, weights } from '../people/mesher.js';
import { QB, LEGS, SPECIES, restJoints } from './quadRig.js';

const TAU = Math.PI * 2;
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, k) => a + (b - a) * k;
const gauss = (x) => Math.exp(-x * x);
/** A stable noise in [-1, 1] from numbers (no randomness: the same beast every build). */
const noise = (a, b, c = 0) => {
  const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Rings and columns by level of detail. */
const RES = [
  { trunk: 22, round: 20, neck: 8, head: 12, headR: 14, leg: 14, legR: 10, tail: 8, tailR: 8 },
  { trunk: 11, round: 12, neck: 4, head: 6, headR: 8, leg: 7, legR: 6, tail: 4, tailR: 5 },
  { trunk: 6, round: 7, neck: 2, head: 3, headR: 5, leg: 4, legR: 4, tail: 2, tailR: 4 },
];

/** Interpolate keyed rows [[s, ...values]] at s (smooth between keys, held past the ends). */
function keyed(keys, s) {
  if (s <= keys[0][0]) return keys[0].slice(1);
  const n = keys.length;
  if (s >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0;
  while (keys[i + 1][0] < s) i++;
  const a = keys[i];
  const b = keys[i + 1];
  // (Catmull-Rom through the neighbours: no corners at the keys.)
  const a0 = keys[Math.max(0, i - 1)];
  const b1 = keys[Math.min(n - 1, i + 2)];
  const k = (s - a[0]) / (b[0] - a[0]);
  const k2 = k * k;
  const k3 = k2 * k;
  const out = [];
  for (let j = 1; j < a.length; j++) {
    const p0 = a0[j];
    const p1 = a[j];
    const p2 = b[j];
    const p3 = b1[j];
    out.push(0.5 * (2 * p1 + (-p0 + p2) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k2 + (-p0 + 3 * p1 - 3 * p2 + p3) * k3));
  }
  return out;
}

/** A superellipse's point at angle phi (0 on top, +pi/2 the left side), half width w, up hu, down hd, keel k, squareness n. */
function ringPt(phi, w, hu, hd, keel = 0, n = 2.2) {
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const e = 2 / n;
  const sx = Math.sign(s) * Math.abs(s) ** e;
  const cy = Math.sign(c) * Math.abs(c) ** e;
  const kx = 1 - keel * Math.max(0, -c) ** 2;
  return [w * sx * kx, (c >= 0 ? hu : hd) * cy];
}

// ---------------------------------------------------------------------------
// The anatomy of each species
// ---------------------------------------------------------------------------

/**
 * Each species' surfaces:
 *   trunk  [z, top y, bottom y, half width, keel, squareness] from rump to brisket
 *   neck   [s, y, z, half width, half height up, half height down] chest to skull
 *   head   { from, to (the skull's axis, back to nose), keys [s, up, down, half width] },
 *          jaw keys [s, up, down, half width] along the same axis (on the jaw bone)
 *   fore, hind  [u, side radius, front radius, back radius] down the leg's joints (u 0 its top joint,
 *          1 the next, 2, 3 the foot's; below 0 inside the body)
 *   tail   [u, radius] along the tail's joints (3 its end)
 */
const ANATOMY = {
  wolf: {
    trunk: [
      [-0.555, 0.655, 0.56, 0.035, 0, 2], [-0.53, 0.675, 0.49, 0.08, 0, 2.2], [-0.45, 0.695, 0.455, 0.108, 0, 2.3], [-0.36, 0.7, 0.47, 0.106, 0.1, 2.2],
      [-0.24, 0.703, 0.515, 0.088, 0.2, 2.1], [-0.12, 0.706, 0.525, 0.085, 0.2, 2.1], [0.0, 0.715, 0.475, 0.1, 0.3, 2.1],
      [0.1, 0.738, 0.425, 0.113, 0.42, 2.1], [0.2, 0.77, 0.405, 0.112, 0.5, 2.1], [0.29, 0.775, 0.43, 0.104, 0.52, 2.1],
      [0.35, 0.745, 0.475, 0.088, 0.45, 2.1], [0.385, 0.71, 0.53, 0.06, 0.3, 2],
    ],
    neck: [[0, 0.62, 0.29, 0.09, 0.13, 0.11], [0.3, 0.68, 0.38, 0.088, 0.11, 0.12], [0.6, 0.76, 0.46, 0.08, 0.095, 0.11], [1, 0.84, 0.53, 0.068, 0.075, 0.09]],
    head: {
      from: [0, 0.875, 0.5], to: [0, 0.85, 0.87],
      keys: [[0, 0.045, -0.04, 0.035], [0.09, 0.07, -0.06, 0.06], [0.22, 0.078, -0.065, 0.075], [0.36, 0.07, -0.05, 0.078], [0.48, 0.052, -0.035, 0.058],
        [0.62, 0.04, -0.022, 0.042], [0.78, 0.033, -0.016, 0.034], [0.92, 0.03, -0.014, 0.026], [1, 0.012, -0.012, 0.012]],
      jaw: [[0.2, -0.035, -0.07, 0.05], [0.4, -0.03, -0.055, 0.048], [0.6, -0.02, -0.038, 0.034], [0.85, -0.016, -0.03, 0.024], [0.97, -0.016, -0.024, 0.012]],
      eye: [0.42, 0.034, 0.05, 0.0115], nose: [1.0, 0.0, 0.0175], ear: { base: 0.052, deep: 0.035, h: 0.11, tilt: 0.25 },
    },
    fore: [[-0.9, 0.05, 0.075, 0.065], [-0.5, 0.055, 0.07, 0.06], [0, 0.05, 0.05, 0.05], [0.45, 0.045, 0.038, 0.048], [1, 0.033, 0.03, 0.036],
      [1.3, 0.03, 0.028, 0.026], [1.85, 0.02, 0.019, 0.018], [2.05, 0.021, 0.02, 0.02], [2.6, 0.016, 0.016, 0.015], [3, 0.019, 0.02, 0.018]],
    hind: [[-0.7, 0.07, 0.1, 0.09], [-0.3, 0.075, 0.09, 0.095], [0.15, 0.068, 0.07, 0.085], [0.55, 0.055, 0.05, 0.065], [1, 0.04, 0.035, 0.045],
      [1.3, 0.034, 0.025, 0.04], [1.85, 0.021, 0.017, 0.022], [2.05, 0.019, 0.016, 0.03], [2.5, 0.016, 0.015, 0.016], [3, 0.019, 0.02, 0.018]],
    paw: { len: 0.075, w: 0.032, h: 0.03 },
    tail: [[0, 0.04], [0.5, 0.055], [1.2, 0.065], [2, 0.062], [2.6, 0.048], [3, 0.012]],
    hairy: 1,
  },
  horse: {
    trunk: [
      [-0.9, 1.3, 1.12, 0.06, 0, 2], [-0.85, 1.36, 1.0, 0.15, 0, 2.2], [-0.72, 1.41, 0.93, 0.2, 0.05, 2.4], [-0.55, 1.42, 0.88, 0.215, 0.1, 2.4],
      [-0.3, 1.39, 0.84, 0.22, 0.15, 2.3], [-0.05, 1.38, 0.8, 0.225, 0.18, 2.3], [0.18, 1.41, 0.78, 0.22, 0.25, 2.3],
      [0.36, 1.46, 0.79, 0.2, 0.35, 2.2], [0.5, 1.43, 0.86, 0.18, 0.45, 2.2], [0.6, 1.35, 0.95, 0.15, 0.4, 2.1], [0.66, 1.25, 1.03, 0.1, 0.3, 2],
    ],
    neck: [[0, 1.2, 0.56, 0.15, 0.24, 0.2], [0.3, 1.34, 0.68, 0.125, 0.2, 0.15], [0.62, 1.5, 0.8, 0.095, 0.16, 0.11], [1, 1.66, 0.91, 0.075, 0.11, 0.1]],
    head: {
      from: [0, 1.73, 0.88], to: [0, 1.3, 1.37],
      keys: [[0, 0.04, -0.06, 0.05], [0.08, 0.07, -0.12, 0.075], [0.22, 0.065, -0.135, 0.085], [0.4, 0.058, -0.07, 0.07], [0.62, 0.05, -0.055, 0.058],
        [0.82, 0.05, -0.055, 0.055], [0.94, 0.045, -0.06, 0.058], [1, 0.02, -0.03, 0.03]],
      jaw: [[0.82, -0.04, -0.07, 0.04], [0.95, -0.04, -0.07, 0.035], [1, -0.05, -0.065, 0.02]],
      eye: [0.2, 0.03, 0.078, 0.018], nose: [0.98, 0.03, 0.016], ear: { base: 0.04, deep: 0.03, h: 0.13, tilt: 0.1 },
    },
    fore: [[-1, 0.09, 0.16, 0.12], [-0.5, 0.095, 0.15, 0.12], [0, 0.09, 0.11, 0.1], [0.5, 0.075, 0.07, 0.08], [1, 0.065, 0.06, 0.07],
      [1.3, 0.06, 0.055, 0.05], [1.9, 0.04, 0.042, 0.035], [2.05, 0.045, 0.048, 0.04], [2.5, 0.033, 0.03, 0.035], [2.95, 0.04, 0.042, 0.045], [3, 0.04, 0.042, 0.042]],
    hind: [[-0.8, 0.13, 0.17, 0.17], [-0.3, 0.13, 0.15, 0.17], [0.2, 0.11, 0.11, 0.13], [0.6, 0.085, 0.08, 0.1], [1, 0.07, 0.06, 0.08],
      [1.3, 0.06, 0.05, 0.075], [1.85, 0.042, 0.035, 0.045], [2.05, 0.04, 0.035, 0.06], [2.5, 0.033, 0.03, 0.034], [2.95, 0.04, 0.042, 0.045], [3, 0.04, 0.042, 0.042]],
    hoof: { r: 0.06, h: 0.085 },
    tail: [[0, 0.055], [0.6, 0.045], [1.2, 0.035], [2, 0.025], [3, 0.015]],
  },
  elephant: {
    trunk: [
      [-1.5, 2.05, 1.6, 0.25, 0, 2], [-1.42, 2.3, 1.35, 0.5, 0, 2.3], [-1.2, 2.44, 1.22, 0.62, 0.05, 2.4], [-0.9, 2.45, 1.18, 0.66, 0.08, 2.4],
      [-0.5, 2.38, 1.12, 0.68, 0.1, 2.4], [-0.1, 2.4, 1.1, 0.7, 0.1, 2.4], [0.3, 2.5, 1.12, 0.67, 0.15, 2.3], [0.6, 2.52, 1.25, 0.6, 0.2, 2.2],
      [0.85, 2.42, 1.42, 0.5, 0.2, 2.1], [0.98, 2.3, 1.6, 0.36, 0.1, 2],
    ],
    neck: [[0, 2.06, 0.82, 0.42, 0.4, 0.45], [0.5, 2.1, 1.0, 0.4, 0.38, 0.42], [1, 2.15, 1.12, 0.38, 0.38, 0.4]],
    head: {
      from: [0, 2.32, 0.98], to: [0, 1.92, 1.86],
      keys: [[0, 0.15, -0.2, 0.25], [0.15, 0.38, -0.32, 0.36], [0.35, 0.42, -0.32, 0.38], [0.55, 0.36, -0.26, 0.32], [0.75, 0.24, -0.16, 0.24], [0.9, 0.12, -0.1, 0.17], [1, 0.05, -0.05, 0.1]],
      jaw: [[0.45, -0.22, -0.4, 0.2], [0.6, -0.18, -0.36, 0.17], [0.72, -0.14, -0.26, 0.1]],
      eye: [0.5, 0.06, 0.29, 0.022], nose: null, ear: null,
    },
    fore: [[-0.6, 0.22, 0.3, 0.3], [0, 0.2, 0.24, 0.24], [0.5, 0.19, 0.2, 0.2], [1, 0.17, 0.17, 0.17], [1.5, 0.16, 0.15, 0.15], [2, 0.15, 0.15, 0.15], [2.6, 0.16, 0.16, 0.16], [3, 0.19, 0.19, 0.19]],
    hind: [[-0.6, 0.24, 0.32, 0.32], [0, 0.22, 0.26, 0.26], [0.5, 0.2, 0.2, 0.22], [1, 0.18, 0.17, 0.18], [1.5, 0.16, 0.15, 0.15], [2, 0.15, 0.15, 0.15], [2.6, 0.16, 0.16, 0.16], [3, 0.19, 0.19, 0.19]],
    foot: { r: 0.2, h: 0.12 },
    tail: [[0, 0.06], [1, 0.035], [2, 0.025], [3, 0.012]],
    trunkR: [[0, 0.18], [0.6, 0.15], [1.2, 0.12], [2, 0.09], [2.7, 0.065], [3, 0.05]],
    wrinkled: 1,
  },
};

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

/** The trunk's weights at a point: the pelvis, the loins, the thorax along it; the legs' muscles near their tops. */
function trunkWeights(J, p) {
  const zr = J[QB.root][2];
  const zs = J[QB.spine][2];
  const zc = J[QB.chest][2];
  const list = [];
  const z = p[2];
  if (z <= zr) list.push([QB.root, 1]);
  else if (z <= zs) {
    const k = smooth(zr, zs, z);
    list.push([QB.root, 1 - k], [QB.spine, k]);
  } else if (z <= zc) {
    const k = smooth(zs, zc, z);
    list.push([QB.spine, 1 - k], [QB.chest, k]);
  } else list.push([QB.chest, 1]);
  // The shoulder's and the haunch's muscle mass moves with its leg.
  for (let l = 0; l < 4; l++) {
    const a = J[LEGS[l][0]];
    if (Math.sign(p[0] || 1) !== Math.sign(a[0])) continue;
    const reach = l < 2 ? 0.55 : 0.65;
    const scale = Math.abs(a[1]) * reach * 0.5;
    const d = Math.hypot((p[1] - a[1]) * 0.8, p[2] - a[2]) / scale;
    const k = gauss(d) * smooth(0, Math.abs(a[0]) * 0.9, Math.abs(p[0])) * (p[1] < a[1] + scale * 0.6 ? 1 : 0.4);
    if (k > 0.02) list.push([LEGS[l][0], k * 0.7]);
  }
  return weights(list);
}

/** Weights down a chain of bones at u (joints; 1.5 is half way down the second), blended at the joints; below 0 into `parent`. */
function chainW(bones, u, parent = -1, blend = 0.15) {
  if (u < 0 && parent >= 0) {
    const k = smooth(-0.05, -0.8, u);
    return weights([[bones[0], 1 - k], [parent, k]]);
  }
  const n = bones.length;
  const i = Math.max(0, Math.min(n - 1, Math.floor(u)));
  const f = u - i;
  if (f > 1 - blend && i + 1 < n) {
    const k = smooth(1 - blend, 1 + blend, f);
    return weights([[bones[i], 1 - k], [bones[i + 1], k]]);
  }
  if (f < blend && i > 0) {
    const k = smooth(-blend, blend, f);
    return weights([[bones[i], k], [bones[i - 1], 1 - k]]);
  }
  return weights([[bones[i], 1]]);
}

// ---------------------------------------------------------------------------
// The surfaces
// ---------------------------------------------------------------------------

/** A point `u` (in joints) along a polyline of joints `pts`, and its direction there. */
function along(pts, u) {
  const n = pts.length;
  const i = Math.max(0, Math.min(n - 2, Math.floor(u)));
  const f = u - i;
  const a = pts[i];
  const b = pts[i + 1];
  const p = add(a, mul(sub(b, a), f));
  // The direction blended across a joint, so the rings turn smoothly round it.
  const d0 = nrm(sub(b, a));
  let d = d0;
  if (f < 0.25 && i > 0) d = nrm(add(mul(nrm(sub(a, pts[i - 1])), 0.5 - 2 * f), mul(d0, 0.5 + 2 * f)));
  else if (f > 0.75 && i + 2 < n) d = nrm(add(mul(d0, 1.5 - 2 * (f - 0.5)), mul(nrm(sub(pts[i + 2], b)), 2 * (f - 0.75))));
  return { p, d };
}

/**
 * A limb or tail lofted along joints `pts` from u0 to u1: rings square to its
 * line, `rad(u)` -> [side, front, back] radii (the front toward `fwd`, so a
 * leg's muscle shows ahead or behind), weights `w(u, p)`, slot and tone by
 * (u, phi, p).
 */
function limbLoft(m, pts, { u0, u1, rows, cols, rad, w, slot, tone, fwd = [0, 0, 1], side = 1 }) {
  m.grid(rows, cols, (i, j) => {
    const u = u0 + ((u1 - u0) * i) / rows;
    const { p, d } = along(pts, Math.max(0, Math.min(pts.length - 1, u)));
    const c = u < 0 ? add(pts[0], mul(nrm(sub(pts[0], pts[1])), -u * len(sub(pts[1], pts[0])))) : p;
    // The ring's axes: x the beast's side, `fw` its front square to the line.
    let fw = sub(fwd, mul(d, fwd[0] * d[0] + fwd[1] * d[1] + fwd[2] * d[2]));
    if (len(fw) < 1e-4) fw = [0, 1, 0];
    fw = nrm(fw);
    const sx = nrm(cross(fw, d));
    const phi = (TAU * j) / cols;
    const [rs, rf, rb] = rad(u);
    const cf = Math.cos(phi);
    const r2 = cf >= 0 ? rf : rb;
    const q = add(c, add(mul(sx, Math.sin(phi) * rs * side), mul(fw, cf * r2)));
    return { p: q, c, uv: [phi * 0.05, u * 0.2], w: w(u, q), slot: slot(u, phi, q), tone: tone(u, phi, q) };
  });
}

/** An ellipsoid about c (radii rx, ry, rz), its grid rows x cols, on weights w; slot and tone by its point. */
function ellipsoid(m, c, rx, ry, rz, rows, cols, w, slot, tone = () => 1) {
  m.grid(rows, cols, (i, j) => {
    const th = (Math.PI * i) / rows;
    const ph = (TAU * j) / cols;
    const p = [c[0] + Math.sin(th) * Math.sin(ph) * rx, c[1] + Math.cos(th) * ry, c[2] + Math.sin(th) * Math.cos(ph) * rz];
    return { p, c, uv: [ph * 0.05, th * 0.05], w: typeof w === 'function' ? w(p) : w, slot: typeof slot === 'function' ? slot(p, th, ph) : slot, tone: tone(p, th, ph) };
  });
}

/** The colour regions of a wolf's coat at a body point (its angle round the ring: 0 the back). */
function wolfSlot(phi, y, below) {
  const c = Math.cos(phi);
  if (c > 0.55) return SLOTS.HAIR;
  if (c < below) return SLOTS.TRIM;
  return SLOTS.SKIN;
}

/** Fur's grizzle: a fine tone noise (wolf), a short coat's sheen (horse), a hide's wrinkles (elephant). */
function coatTone(sp, p, base = 1) {
  if (sp === 'wolf') return base * (0.9 + 0.12 * noise(p[0] * 40, p[1] * 40, p[2] * 40));
  if (sp === 'elephant') return base * (0.88 + 0.08 * Math.sin(p[1] * 60 + p[2] * 7) * Math.sin(p[2] * 45) + 0.04 * noise(p[0] * 9, p[1] * 9, p[2] * 9));
  return base * (0.95 + 0.04 * noise(p[0] * 20, p[1] * 20, p[2] * 20));
}

/** The trunk (body) loft. */
function trunk(m, sp, A, J, R) {
  const z0 = A.trunk[0][0];
  const z1 = A.trunk[A.trunk.length - 1][0];
  m.grid(R.trunk, R.round, (i, j) => {
    const z = lerp(z0, z1, i / R.trunk);
    const [top, bot, w, keel, n] = keyed(A.trunk, z);
    const phi = (TAU * j) / R.round;
    const yc = (top + bot) / 2;
    const h = (top - bot) / 2;
    const [x, y] = ringPt(phi, w, h, h, keel, n);
    // (The ends rounded into caps: the rump behind, the brisket's front.)
    let pz = z;
    if (i === 0) pz -= 0.02;
    const p = [x, yc + y, pz];
    const c = [0, yc, z];
    let slot = SLOTS.SKIN;
    let tone = coatTone(sp, p);
    if (sp === 'wolf') {
      slot = wolfSlot(phi, yc + y, -0.45 + 0.25 * smooth(0, 0.3, z));
      // The saddle's dark fading down the flanks.
      if (slot === SLOTS.SKIN) tone *= 0.92 + 0.12 * (1 - Math.cos(phi));
    } else if (sp === 'horse') {
      tone *= 0.9 + 0.1 * Math.cos(phi) - 0.05 * gauss((Math.cos(phi) + 1) / 0.4);
    }
    return { p, c, uv: [phi * 0.3, z], w: trunkWeights(J, p), slot, tone };
  });
  // Close the ends: the rump's cap and the brisket's.
  for (const end of [0, 1]) {
    const z = end ? z1 : z0;
    const [top, bot] = keyed(A.trunk, z);
    const ctr = [0, (top + bot) / 2, z + (end ? 0.01 : -0.03)];
    const base = m.count;
    const ring = [];
    for (let j = 0; j <= R.round; j++) {
      const phi = (TAU * j) / R.round;
      const [, , w, keel, n] = keyed(A.trunk, z);
      const h = (top - bot) / 2;
      const [x, y] = ringPt(phi, w * 0.98, h * 0.98, h * 0.98, keel, n);
      const p = [x, ctr[1] + y, z + (end ? 0 : -0.02)];
      ring.push(m.vertex(p, [0, 0], trunkWeights(J, p), sp === 'wolf' ? wolfSlot(phi, p[1], -0.45) : SLOTS.SKIN, coatTone(sp, p) * 0.9));
    }
    const cv = m.vertex(ctr, [0, 0], trunkWeights(J, ctr), SLOTS.SKIN, 0.85);
    void base;
    m.fan(ring, cv, end === 0);
  }
}

/** The neck: from inside the chest up to the skull, its weights the chest's, the neck's, the head's. */
function neck(m, sp, A, J, R) {
  m.grid(R.neck, R.round, (i, j) => {
    const s = i / R.neck;
    const [y, z, w, hu, hd] = keyed(A.neck, s);
    const phi = (TAU * j) / R.round;
    const [x, dy] = ringPt(phi, w, hu, hd, sp === 'wolf' ? -0.2 : 0.1, 2.1);
    // (The neck's rings lean back with it: a ring square to its line.)
    const tilt = Math.atan2(keyed(A.neck, Math.min(1, s + 0.05))[0] - keyed(A.neck, Math.max(0, s - 0.05))[0], keyed(A.neck, Math.min(1, s + 0.05))[1] - keyed(A.neck, Math.max(0, s - 0.05))[1]);
    const p = [x, y + dy * Math.sin(tilt), z - dy * Math.cos(tilt) * 0.85];
    const c = [0, y, z];
    const k1 = smooth(0.05, 0.45, s);
    const k2 = smooth(0.45, 0.85, s);
    const k3 = smooth(0.85, 1.0, s);
    const wt = weights([[QB.chest, 1 - k1], [QB.neck, k1 * (1 - k2)], [QB.neck2, k2 * (1 - k3)], [QB.head, k3]]);
    let slot = SLOTS.SKIN;
    let tone = coatTone(sp, p);
    if (sp === 'wolf') {
      // The ruff: the throat cream, the back of the neck dark.
      slot = Math.cos(phi) > 0.5 ? SLOTS.HAIR : Math.cos(phi) < -0.2 ? SLOTS.TRIM : SLOTS.SKIN;
      tone *= 1 + 0.05 * Math.sin(phi * 7 + s * 9);
    }
    return { p, c, uv: [phi * 0.3, s], w: wt, slot, tone };
  });
}

/** The skull (on the head bone) and the lower jaw (on the jaw), lofted along the head's axis; eyes, nose, ears. */
function head(m, sp, A, J, R, lod) {
  const H = A.head;
  const ax = nrm(sub(H.to, H.from));
  const L = len(sub(H.to, H.from));
  // The head's up: square to its axis in the beast's middle plane.
  const up = nrm(sub([0, 1, 0], mul(ax, ax[1])));
  const at = (s, a, b, w, phi, n = 2.3) => {
    const [x, y] = ringPt(phi, w, a, -b, 0, n);
    const c = add(H.from, mul(ax, s * L));
    return { p: add(add(c, mul(up, y)), [x, 0, 0]), c };
  };
  const hw = weights([[QB.head, 1]]);
  m.grid(R.head, R.headR, (i, j) => {
    const s = i / R.head;
    const [a, b, w] = keyed(H.keys, s);
    const phi = (TAU * j) / R.headR;
    // (The upper half the skull's; below, the upper jaw's line.)
    const { p, c } = at(s, a, b, w, phi);
    let slot = SLOTS.SKIN;
    let tone = coatTone(sp, p);
    if (sp === 'wolf') {
      const cphi = Math.cos(phi);
      // A wolf's mask: the cheeks and the muzzle's sides pale, the top of the muzzle and the brow darker; the lips dark.
      slot = cphi > 0.6 ? SLOTS.HAIR : cphi < -0.55 ? (s > 0.5 ? SLOTS.DARK : SLOTS.TRIM) : s > 0.3 && Math.abs(Math.sin(phi)) > 0.5 && cphi < 0.3 ? SLOTS.TRIM : SLOTS.SKIN;
      if (s > 0.94) slot = SLOTS.DARK;
    } else if (sp === 'horse') {
      // The muzzle darker and softer.
      if (s > 0.85) tone *= 0.7;
    }
    return { p, c, uv: [phi * 0.1, s], w: hw, slot, tone };
  });
  // The lower jaw (on its own bone: a wolf's snaps open).
  if (H.jaw) {
    const jw = weights([[QB.jaw, 1]]);
    const s0 = H.jaw[0][0];
    const s1 = H.jaw[H.jaw.length - 1][0];
    const rows = Math.max(2, Math.round(R.head * 0.6));
    m.grid(rows, R.headR, (i, j) => {
      const s = lerp(s0, s1, i / rows);
      const [a, b, w] = keyed(H.jaw, s);
      const phi = (TAU * j) / R.headR;
      const mid = (a + b) / 2;
      const h = (a - b) / 2;
      const { p, c } = at(s, h, h, w, phi);
      const q = add(p, mul(up, mid));
      return { p: q, c: add(c, mul(up, mid)), uv: [phi * 0.1, s], w: jw, slot: sp === 'wolf' ? (Math.cos(phi) > 0.3 ? SLOTS.DARK : SLOTS.TRIM) : SLOTS.SKIN, tone: coatTone(sp, q) * 0.9 };
    });
    if (sp === 'wolf' && lod < 2) {
      // The teeth along the jaw's rim: a row of white points either side, the canines longer.
      for (const s of [1, -1]) {
        for (let k = 0; k < (lod === 0 ? 6 : 3); k++) {
          const ss = lerp(0.55, 0.95, k / 5);
          const [a, , w] = keyed(H.keys, ss);
          void a;
          const c = add(add(H.from, mul(ax, ss * L)), add(mul(up, -0.012), [s * w * 0.75, 0, 0]));
          const h = k === 5 ? 0.02 : 0.009;
          ellipsoid(m, c, 0.004, h, 0.004, 2, 4, weights([[QB.head, 1]]), SLOTS.WHITE);
        }
      }
    }
  }
  // Eyes.
  if (H.eye && lod < 2) {
    const [s, yUp, xOut, r] = H.eye;
    for (const sd of [1, -1]) {
      const c = add(add(H.from, mul(ax, s * L)), add(mul(up, yUp), [sd * xOut, 0, 0]));
      ellipsoid(m, c, r * 0.8, r, r, 4, 6, hw, (p) => (Math.abs(p[0]) > Math.abs(c[0]) + r * 0.3 || p[2] > c[2] + r * 0.4 ? (sp === 'wolf' ? SLOTS.ACCENT : SLOTS.DARK) : SLOTS.DARK));
      if (sp === 'wolf') ellipsoid(m, add(c, [sd * r * 0.5, 0, r * 0.35]), r * 0.4, r * 0.55, r * 0.4, 3, 5, hw, SLOTS.DARK);
    }
  }
  // The nose (a wolf's leather; a horse's nostrils).
  if (H.nose) {
    const [s, yUp, r] = H.nose;
    if (sp === 'wolf') {
      const c = add(add(H.from, mul(ax, s * L)), mul(up, yUp + 0.004));
      ellipsoid(m, c, r * 1.1, r * 0.8, r, 3, 6, hw, SLOTS.DARK, () => 0.5);
    } else if (lod < 2) {
      for (const sd of [1, -1]) {
        const c = add(add(H.from, mul(ax, s * L)), add(mul(up, yUp - 0.01), [sd * 0.03, 0, 0]));
        ellipsoid(m, c, r * 0.7, r, r * 0.6, 3, 5, hw, SLOTS.DARK);
      }
    }
  }
  // The ears, on their own bones: a wolf's erect and pointed, furred, the inside pale; a horse's long and mobile.
  if (H.ear) {
    const E = H.ear;
    for (const [sd, bone] of [[1, QB.earL], [-1, QB.earR]]) {
      const base = J[bone];
      const ew = weights([[bone, 1]]);
      const rows = lod === 0 ? 5 : 2;
      const cols = lod === 0 ? 8 : 4;
      m.grid(rows, cols, (i, j) => {
        const v = i / rows;
        const phi = (TAU * j) / cols;
        // A cone flattened to a cupped blade, its hollow facing forward and out.
        const r = (1 - v) ** 0.9;
        const bx = Math.sin(phi) * E.base * 0.5 * r;
        const bz = Math.cos(phi) * E.deep * 0.5 * r * (Math.cos(phi) > 0 ? 0.35 : 1);
        const p = [base[0] + bx + sd * E.h * v * E.tilt, base[1] + E.h * v, base[2] + bz - 0.01 * v];
        const inner = Math.cos(phi) > 0.2 && v < 0.85;
        return { p, c: [base[0] + sd * E.h * v * E.tilt, base[1] + E.h * v, base[2] - 0.01], uv: [phi * 0.02, v], w: ew, slot: sp === 'wolf' ? (inner ? SLOTS.TRIM : SLOTS.HAIR) : SLOTS.SKIN, tone: inner ? 0.75 : 0.9 };
      });
    }
  }
}

/** A leg lofted from inside the body to its foot, the paw or the hoof below. */
function leg(m, sp, A, J, R, l, lod) {
  const fore = l < 2;
  const sd = l % 2 === 0 ? 1 : -1;
  const bones = LEGS[l];
  const pts = bones.map((b) => J[b]);
  const keys = fore ? A.fore : A.hind;
  const u0 = keys[0][0];
  const u1 = keys[keys.length - 1][0];
  const parent = fore ? QB.chest : QB.root;
  limbLoft(m, pts, {
    u0, u1, rows: R.leg, cols: R.legR, side: sd,
    rad: (u) => keyed(keys, u),
    w: (u) => chainW(bones, u, parent),
    slot: (u, phi) => {
      if (sp === 'wolf') {
        // The legs pale inside and behind, the front of the forelegs' lower part with a dark streak.
        const inside = Math.sin(phi) < -0.3;
        if (u > 1.6 && fore && Math.cos(phi) > 0.6) return SLOTS.HAIR;
        return inside || u > 1.9 ? SLOTS.TRIM : u < 0.4 && Math.cos(phi) > 0.7 ? SLOTS.HAIR : SLOTS.SKIN;
      }
      if (sp === 'horse') return u > 1.8 ? SLOTS.TRIM : SLOTS.SKIN;
      return SLOTS.SKIN;
    },
    tone: (u, phi, p) => coatTone(sp, p) * (sp === 'horse' && u > 1.6 ? 0.85 : 1) * (0.94 + 0.06 * Math.cos(phi)),
  });
  // The foot.
  const D = J[bones[3]];
  const fw = weights([[bones[3], 1]]);
  if (sp === 'wolf') {
    const P = A.paw;
    const c = [D[0], P.h * 0.75, D[2] + P.len * 0.45];
    ellipsoid(m, c, P.w, P.h * 0.85, P.len * 0.62, lod === 0 ? 5 : 3, lod === 0 ? 10 : 6, (p) => weights([[bones[3], 1], [bones[2], p[1] > 0.045 ? 0.3 : 0]]), (p) => (p[1] < 0.012 ? SLOTS.DARK : SLOTS.TRIM), (p) => coatTone(sp, p) * 0.95);
    if (lod === 0) {
      // The toes and their claws.
      for (let k = 0; k < 4; k++) {
        const x = (k - 1.5) * P.w * 0.55;
        const tc = [D[0] + x, P.h * 0.45, D[2] + P.len * (0.85 - 0.12 * Math.abs(k - 1.5))];
        ellipsoid(m, tc, P.w * 0.32, P.h * 0.48, P.w * 0.38, 3, 5, fw, SLOTS.TRIM, () => 0.9);
        ellipsoid(m, add(tc, [0, -0.008, P.w * 0.35]), 0.004, 0.005, 0.009, 2, 4, fw, SLOTS.DARK);
      }
    }
  } else if (sp === 'horse') {
    // The pastern down to the hoof, slanting forward; the hoof a dark horn cone.
    const H = A.hoof;
    const toe = fore ? 0.07 : 0.06;
    const top = [D[0], H.h + 0.02, D[2] + toe * 0.5];
    const bot = [D[0], 0.0, D[2] + toe];
    limbLoft(m, [D, top, bot], {
      u0: 0, u1: 2, rows: lod === 0 ? 4 : 2, cols: R.legR, side: sd,
      rad: (u) => (u < 1 ? [lerp(0.04, 0.042, u), lerp(0.042, 0.048, u), lerp(0.042, 0.045, u)] : [lerp(0.05, H.r, u - 1), lerp(0.052, H.r * 1.05, u - 1), lerp(0.05, H.r * 0.85, u - 1)]),
      w: () => fw,
      slot: (u) => (u > 1.02 ? SLOTS.DARK : SLOTS.TRIM),
      tone: (u) => (u > 1 ? 0.6 + 0.2 * (u - 1) : 0.85),
    });
    ellipsoid(m, [bot[0], 0.004, bot[2] - 0.01], H.r * 0.95, 0.005, H.r * 0.85, 1, R.legR, fw, SLOTS.DARK);
  } else {
    // An elephant's round foot, its nails at the front.
    const F = A.foot;
    limbLoft(m, [D, [D[0], 0, D[2] + 0.02]], {
      u0: 0, u1: 1, rows: 2, cols: R.legR + 2, side: sd,
      rad: (u) => [lerp(0.19, F.r, u), lerp(0.19, F.r * 1.05, u), lerp(0.19, F.r, u)],
      w: () => fw, slot: () => SLOTS.SKIN, tone: (u, phi, p) => coatTone(sp, p) * 0.85,
    });
    ellipsoid(m, [D[0], 0.004, D[2] + 0.02], F.r, 0.006, F.r, 1, R.legR + 2, fw, SLOTS.DARK);
    if (lod < 2) {
      for (let k = 0; k < 4; k++) {
        const a = -0.75 + k * 0.5;
        ellipsoid(m, [D[0] + Math.sin(a) * F.r, 0.035, D[2] + 0.02 + Math.cos(a) * F.r], 0.04, 0.035, 0.02, 2, 5, fw, SLOTS.PAPYRUS, () => 0.85);
      }
    }
  }
}

/** The tail along its bones: a wolf's bushy brush with its dark tip; a horse's dock under the hair; an elephant's tassel. */
function tail(m, sp, A, J, R, lod) {
  const S = SPECIES[sp];
  const bones = [QB.tail1, QB.tail2, QB.tail3];
  const pts = [J[QB.tail1], J[QB.tail2], J[QB.tail3], S.tailEnd];
  limbLoft(m, pts, {
    u0: -0.15, u1: 3, rows: R.tail, cols: R.tailR, fwd: [0, 1, 0],
    rad: (u) => {
      const r = keyed(A.tail, u)[0];
      return [r, r * (sp === 'wolf' ? 1.1 : 1), r * (sp === 'wolf' ? 0.95 : 1)];
    },
    w: (u) => chainW(bones, Math.min(2.99, u), QB.root),
    slot: (u, phi) => (sp === 'wolf' ? (u > 2.4 ? SLOTS.DARK : Math.cos(phi) > 0 ? SLOTS.HAIR : SLOTS.SKIN) : sp === 'horse' ? SLOTS.HAIR : SLOTS.SKIN),
    tone: (u, phi, p) => coatTone(sp, p) * (sp === 'wolf' && u > 2.4 ? 1.6 : 1) * (1 + (sp === 'wolf' ? 0.08 * Math.sin(phi * 6 + u * 8) : 0)),
  });
  if (sp === 'horse') {
    // The hair of the tail: a long full fall from the dock, swinging with it.
    const fall = [J[QB.tail1], J[QB.tail2], J[QB.tail3], S.tailEnd, [0, 0.42, -1.0]];
    limbLoft(m, fall, {
      u0: 0.3, u1: 4, rows: lod === 0 ? 10 : lod === 1 ? 5 : 3, cols: lod === 0 ? 10 : 6, fwd: [0, 1, 0],
      rad: (u) => {
        const r = 0.05 + 0.05 * smooth(0.3, 2.2, u) - 0.06 * smooth(3.2, 4, u);
        return [r * 0.8, r, r * 1.1];
      },
      w: (u) => chainW(bones, Math.min(2.99, u)),
      slot: () => SLOTS.HAIR,
      tone: (u, phi) => 0.8 + 0.15 * Math.sin(phi * 9 + u * 3),
    });
  } else if (sp === 'elephant') {
    ellipsoid(m, add(S.tailEnd, [0, -0.04, 0]), 0.04, 0.08, 0.04, 3, 5, weights([[QB.tail3, 1]]), SLOTS.DARK);
  }
}

/** A horse's mane along the crest of its neck and its forelock, on the neck's bones. */
function mane(m, A, J, lod) {
  const n = lod === 0 ? 12 : lod === 1 ? 6 : 3;
  const N = A.neck;
  // Two faces of a fin standing up from the crest, falling to the left a little.
  for (const face of [1, -1]) {
    m.grid(n, 1, (i, j) => {
      const s = 0.05 + (0.97 * i) / n;
      const [y, z, , hu] = keyed(N, Math.min(1, s));
      const h = 0.1 * (1 - 0.4 * s) * (lod === 0 ? 1 + 0.15 * Math.sin(i * 2.3) : 1);
      const base = [0, y + hu * 0.98, z - 0.02];
      const p = j === 0 ? base : [0.035 + 0.02 * s, base[1] + h * 0.6, base[2] - h * 0.45];
      p[0] += face * 0.006;
      const k1 = smooth(0.05, 0.45, s);
      const k2 = smooth(0.45, 0.85, s);
      const k3 = smooth(0.85, 1.0, s);
      return { p, c: [face * -1, base[1] - 0.2, base[2]], uv: [s, j], w: weights([[QB.chest, 1 - k1], [QB.neck, k1 * (1 - k2)], [QB.neck2, k2 * (1 - k3)], [QB.head, k3]]), slot: SLOTS.HAIR, tone: 0.8 + 0.15 * j };
    });
  }
  // The forelock between the ears.
  const H = A.head;
  const ax = nrm(sub(H.to, H.from));
  const c = add(H.from, add(mul(ax, 0.06), [0, 0.07, 0]));
  ellipsoid(m, c, 0.04, 0.025, 0.06, 2, 5, weights([[QB.head, 1]]), SLOTS.HAIR, () => 0.85);
}

// ---------------------------------------------------------------------------
// Tack and towers
// ---------------------------------------------------------------------------

/** A band round the body at z (a girth, a breast strap): a flat strip of `width`, slot, on the trunk's weights. */
function band(m, A, J, z, width, slot, cols, { out = 0.012, tone = 0.85, lean = 0 } = {}) {
  for (const k of [0, 1]) {
    void k;
  }
  m.grid(1, cols, (i, j) => {
    const zz = z + (i - 0.5) * width;
    const phi = (TAU * j) / cols;
    const zl = zz + lean * Math.cos(phi);
    const [top, bot, w, keel, n] = keyed(A.trunk, zl);
    const yc = (top + bot) / 2;
    const h = (top - bot) / 2;
    const [x, y] = ringPt(phi, w + out, h + out, h + out, keel, n);
    const p = [x, yc + y, zl];
    return { p, c: [0, yc, zl], uv: [phi, i], w: trunkWeights(J, p), slot, tone };
  });
}

/** The Roman four-horned saddle on its cloth, girth, breast strap and breeching with phalerae; the bridle. */
function saddle(m, A, J, lod) {
  const seatZ = SPECIES.horse.seat.at[2];
  const cols = lod === 0 ? 20 : lod === 1 ? 10 : 6;
  // The saddle cloth: a skirt over the back, hanging below the saddle each side with a fringe.
  m.grid(lod === 0 ? 6 : 2, lod === 0 ? 10 : 4, (i, j) => {
    const z = seatZ - 0.32 + (0.62 * j) / (lod === 0 ? 10 : 4);
    const v = i / (lod === 0 ? 6 : 2);
    const phi = (-1 + 2 * v) * 1.35;
    const [top, bot, w, keel, n] = keyed(A.trunk, z);
    const yc = (top + bot) / 2;
    const h = (top - bot) / 2;
    const [x, y] = ringPt(phi, w + 0.02, h + 0.02, h + 0.02, keel, n);
    const p = [x, yc + y, z];
    return { p, c: [0, yc, z], uv: [phi, z], w: trunkWeights(J, p), slot: Math.abs(phi) > 1.25 ? SLOTS.TRIM : SLOTS.ACCENT, tone: 0.85 + 0.1 * Math.cos(phi * 3) };
  });
  // The saddle's tree and seat: a leather pad on top, the four horns at its corners (two over the thighs before, two behind the seat).
  const top = keyed(A.trunk, seatZ)[0];
  const tw = weights([[QB.spine, 0.7], [QB.chest, 0.3]]);
  ellipsoid(m, [0, top + 0.035, seatZ], 0.17, 0.045, 0.27, lod === 0 ? 4 : 2, lod === 0 ? 12 : 6, tw, SLOTS.LEATHER, () => 0.8);
  if (lod < 2) {
    for (const [hx, hz, lean] of [[0.11, 0.18, 0.5], [-0.11, 0.18, 0.5], [0.12, -0.2, -0.35], [-0.12, -0.2, -0.35]]) {
      const base = [hx, top + 0.06, seatZ + hz];
      const tip = [hx * 1.25, top + 0.17, seatZ + hz + lean * 0.12];
      limbLoft(m, [base, tip], { u0: 0, u1: 1, rows: 2, cols: 6, rad: (u) => [0.025 * (1 - 0.5 * u), 0.025 * (1 - 0.5 * u), 0.025 * (1 - 0.5 * u)], w: () => tw, slot: () => SLOTS.LEATHER, tone: () => 0.75, fwd: [0, 0, 1] });
      // (A bronze cap on each horn.)
      ellipsoid(m, tip, 0.016, 0.012, 0.016, 2, 5, tw, SLOTS.BRONZE);
    }
  }
  // The girth, the breast strap, the breeching round the quarters.
  band(m, A, J, seatZ + 0.12, 0.05, SLOTS.LEATHER, cols, { out: 0.022 });
  if (lod < 2) {
    band(m, A, J, 0.5, 0.045, SLOTS.LEATHER, cols, { out: 0.02, lean: 0.12 });
    band(m, A, J, -0.66, 0.045, SLOTS.LEATHER, cols, { out: 0.02, lean: -0.1 });
    // The phalerae: bronze discs on the straps.
    for (const [z, phi] of [[0.52, 1.5], [0.52, -1.5], [0.56, 2.5], [0.56, -2.5], [-0.68, 1.6], [-0.68, -1.6], [-0.66, 2.3], [-0.66, -2.3]]) {
      const [tp, bt, w, keel, n] = keyed(A.trunk, z);
      const yc = (tp + bt) / 2;
      const h = (tp - bt) / 2;
      const [x, y] = ringPt(phi, w + 0.03, h + 0.03, h + 0.03, keel, n);
      const p = [x, yc + y, z];
      ellipsoid(m, p, 0.035, 0.035, 0.035, 2, lod === 0 ? 8 : 5, trunkWeights(J, p), SLOTS.BRONZE);
    }
  }
}

/** The bridle on a horse's head (with a bit and reins up to the withers: the rider's hands are there). */
function bridle(m, A, lod) {
  const H = A.head;
  const ax = nrm(sub(H.to, H.from));
  const L = len(sub(H.to, H.from));
  const up = nrm(sub([0, 1, 0], mul(ax, ax[1])));
  const hw = weights([[QB.head, 1]]);
  const n = lod === 0 ? 14 : 7;
  for (const [s, extra] of [[0.08, 0.012], [0.82, 0.008]]) {
    const [a, b, w] = keyed(H.keys, s);
    m.grid(1, n, (i, j) => {
      const phi = (TAU * j) / n;
      const [x, y] = ringPt(phi, w + extra, a + extra, -(b - extra), 0, 2.3);
      const c = add(H.from, mul(ax, s * L + (i - 0.5) * 0.025));
      return { p: add(add(c, mul(up, y)), [x, 0, 0]), c, uv: [phi, i], w: hw, slot: SLOTS.LEATHER, tone: 0.8 };
    });
  }
  if (lod < 2) {
    // The cheek straps down each side.
    for (const sd of [1, -1]) {
      const p0 = add(add(H.from, mul(ax, 0.08 * L)), [sd * (keyed(H.keys, 0.08)[2] + 0.012), 0, 0]);
      const p1 = add(add(H.from, mul(ax, 0.82 * L)), add(mul(up, -0.02), [sd * (keyed(H.keys, 0.82)[2] + 0.01), 0, 0]));
      limbLoft(m, [p0, p1], { u0: 0, u1: 1, rows: 2, cols: 4, rad: () => [0.006, 0.012, 0.012], w: () => hw, slot: () => SLOTS.LEATHER, tone: () => 0.8 });
    }
  }
}

/** A Numidian's rope round the horse's neck (they rode without bit or bridle). */
function neckRope(m, A, J, lod) {
  const n = lod === 0 ? 14 : 7;
  m.grid(1, n, (i, j) => {
    const s = 0.55 + (i - 0.5) * 0.04;
    const [y, z, w, hu, hd] = keyed(A.neck, s);
    const phi = (TAU * j) / n;
    const [x, dy] = ringPt(phi, w + 0.012, hu + 0.012, hd + 0.012, 0.1, 2.1);
    const p = [x, y + dy, z];
    return { p, c: [0, y, z], uv: [phi, i], w: weights([[QB.neck, 0.6], [QB.neck2, 0.4]]), slot: SLOTS.ROPE, tone: 0.9 };
  });
}

/** An elephant's fighting tower on its back: a cloth, a deck, wooden sides with shields hung on them. */
function tower(m, A, J, lod) {
  const deck = SPECIES.elephant.deck.at;
  const tw = weights([[QB.spine, 0.8], [QB.chest, 0.2]]);
  // The saddle cloth hanging down the flanks, its border the trim.
  m.grid(lod === 0 ? 6 : 2, lod === 0 ? 10 : 4, (i, j) => {
    const z = deck[2] - 0.75 + (1.5 * j) / (lod === 0 ? 10 : 4);
    const v = i / (lod === 0 ? 6 : 2);
    const phi = (-1 + 2 * v) * 1.2;
    const [top, bot, w, keel, n] = keyed(A.trunk, z);
    const yc = (top + bot) / 2;
    const h = (top - bot) / 2;
    const [x, y] = ringPt(phi, w + 0.03, h + 0.03, h + 0.03, keel, n);
    const p = [x, yc + y, z];
    return { p, c: [0, yc, z], uv: [phi, z], w: trunkWeights(J, p), slot: Math.abs(phi) > 1.08 ? SLOTS.TRIM : SLOTS.ACCENT, tone: 0.85 + 0.1 * Math.cos(phi * 4) };
  });
  // The tower: a box of planks, open on top.
  const W = 0.62;
  const D = 0.72;
  const H = 0.62;
  const y0 = deck[1] - 0.06;
  const box = (c, w, h, d, slot, tone) => {
    const corners = (x, y, z) => [c[0] + (x * w) / 2, c[1] + (y * h) / 2, c[2] + (z * d) / 2];
    const faces = [[[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]],
      [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]],
      [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]];
    for (const f of faces) {
      const ids = f.map((q) => m.vertex(corners(...q), [q[0] * w + q[2] * d, q[1] * h], tw, slot, tone));
      m.tri(ids[0], ids[1], ids[2]);
      m.tri(ids[0], ids[2], ids[3]);
    }
  };
  box([0, y0, deck[2]], W + 0.1, 0.06, D + 0.1, SLOTS.WOOD, 0.75);
  for (const sx of [1, -1]) box([sx * W / 2, y0 + H / 2, deck[2]], 0.04, H, D, SLOTS.WOOD, 0.85);
  for (const sz of [1, -1]) box([0, y0 + H / 2, deck[2] + sz * D / 2], W, H, 0.04, SLOTS.WOOD, 0.8);
  if (lod < 2) {
    // The rims and the corner posts.
    for (const sx of [1, -1]) for (const sz of [1, -1]) box([sx * W / 2, y0 + H / 2 + 0.03, deck[2] + sz * D / 2], 0.06, H + 0.08, 0.06, SLOTS.WOOD, 0.6);
    // Round shields hung on its sides, painted.
    for (const sx of [1, -1]) {
      for (const dz of [-0.2, 0.2]) {
        const c = [sx * (W / 2 + 0.03), y0 + H * 0.55, deck[2] + dz];
        m.grid(1, lod === 0 ? 12 : 6, (i, j) => {
          const a = (TAU * j) / (lod === 0 ? 12 : 6);
          const r = i ? 0.17 : 0.001;
          return { p: [c[0] + sx * (i ? 0 : 0.03), c[1] + Math.sin(a) * r, c[2] + Math.cos(a) * r], c: [c[0] - sx, c[1], c[2]], uv: [a, i], w: tw, slot: i ? SLOTS.TRIM : SLOTS.BRONZE, tone: 0.9 };
        });
      }
    }
  }
}

/** The elephant's tusks: curved ivory from the mouth forward and up. */
function tusks(m, A, lod) {
  const H = A.head;
  const ax = nrm(sub(H.to, H.from));
  const L = len(sub(H.to, H.from));
  const up = nrm(sub([0, 1, 0], mul(ax, ax[1])));
  for (const sd of [1, -1]) {
    const base = add(add(H.from, mul(ax, 0.6 * L)), add(mul(up, -0.2), [sd * 0.17, 0, 0]));
    const pts = [base, add(base, [sd * 0.03, -0.22, 0.28]), add(base, [sd * 0.06, -0.24, 0.56]), add(base, [sd * 0.08, -0.08, 0.78])];
    limbLoft(m, pts, {
      u0: 0, u1: 3, rows: lod === 0 ? 8 : 4, cols: lod === 0 ? 8 : 5,
      rad: (u) => {
        const r = 0.06 * (1 - u / 3.2);
        return [r, r, r];
      },
      w: () => weights([[QB.head, 1]]), slot: (u) => (u < 0.4 ? SLOTS.SKIN : SLOTS.WHITE), tone: (u) => 0.95 - 0.1 * u / 3,
    });
  }
}

/** The elephant's ears: great flat fans hung from the head on their own bones. */
function bigEars(m, J, lod) {
  const rows = lod === 0 ? 8 : lod === 1 ? 4 : 2;
  const cols = lod === 0 ? 12 : lod === 1 ? 6 : 4;
  for (const [sd, bone] of [[1, QB.earL], [-1, QB.earR]]) {
    const base = J[bone];
    const ew = weights([[bone, 0.9], [QB.head, 0.1]]);
    for (const face of [1, -1]) {
      m.grid(rows, cols, (i, j) => {
        const v = i / rows;
        const a = -Math.PI * 0.5 + (Math.PI * 1.15 * j) / cols;
        // From its root along the head back and down: an African's ear, broad and tall.
        const r = 0.55 * v * (1 + 0.15 * Math.sin(a * 2));
        const p = [base[0] + sd * (0.04 + 0.08 * v) + face * 0.012, base[1] + Math.sin(a) * r * 0.95 - 0.1 * v, base[2] - 0.05 - Math.cos(a) * r * 0.6 - 0.15 * v];
        return { p, c: [base[0] - sd + face * 2 * sd, p[1], p[2]], uv: [a, v], w: ew, slot: SLOTS.SKIN, tone: face > 0 ? 0.9 : 0.75 + 0.1 * v };
      }, { flip: (face > 0) !== (sd > 0) });
    }
  }
}

/** The elephant's trunk on its three bones. */
function elephantTrunk(m, A, J, R) {
  const S = SPECIES.elephant;
  const bones = [QB.trunk1, QB.trunk2, QB.trunk3];
  const pts = [J[QB.trunk1], J[QB.trunk2], J[QB.trunk3], S.trunkEnd];
  limbLoft(m, pts, {
    u0: -0.4, u1: 3, rows: R.leg + 2, cols: R.legR, fwd: [0, 0, 1],
    rad: (u) => {
      const r = keyed(A.trunkR, Math.max(0, u))[0];
      return [r, r * 1.05, r * 0.95];
    },
    w: (u) => chainW(bones, Math.min(2.99, u), QB.head),
    slot: () => SLOTS.SKIN,
    // (Its rings: the trunk's folds.)
    tone: (u, phi, p) => coatTone('elephant', p) * (0.85 + 0.1 * Math.sin(u * 40)),
  });
}

// ---------------------------------------------------------------------------
// The builder
// ---------------------------------------------------------------------------

/** A beast by its key's parts: species ('wolf', 'horse', 'elephant') and options (tack, tower), at `lod`. */
export function buildQuad(species, opts, lod) {
  const A = ANATOMY[species];
  if (!A) throw new Error(`No beast ${species}`);
  const J = restJoints(species);
  const R = RES[Math.max(0, Math.min(2, lod | 0))];
  const m = new Mesher();
  trunk(m, species, A, J, R);
  neck(m, species, A, J, R);
  head(m, species, A, J, R, lod);
  for (let l = 0; l < 4; l++) leg(m, species, A, J, R, l, lod);
  tail(m, species, A, J, R, lod);
  if (species === 'horse') {
    mane(m, A, J, lod);
    if (opts.has('saddle')) {
      saddle(m, A, J, lod);
      bridle(m, A, lod);
    } else if (opts.has('yoke')) {
      bridle(m, A, lod);
      band(m, A, J, 0.5, 0.05, SLOTS.LEATHER, lod === 0 ? 16 : 8, { out: 0.02, lean: 0.12 });
      band(m, A, J, 0.12, 0.06, SLOTS.LEATHER, lod === 0 ? 16 : 8, { out: 0.02 });
    } else if (opts.has('bare')) {
      neckRope(m, A, J, lod);
    }
  } else if (species === 'elephant') {
    bigEars(m, J, lod);
    elephantTrunk(m, A, J, R);
    tusks(m, A, lod);
    if (opts.has('tower')) tower(m, A, J, lod);
  }
  return m;
}

/** A beast's piece key: `quad:<species>[:opt...]`. */
export function isQuadKey(key) {
  return key.startsWith('quad:');
}

/** The Mesher of a beast's piece by its key. */
export function quadMesher(key, lod) {
  const [, species, ...opts] = key.split(':');
  return buildQuad(species, new Set(opts), lod);
}
