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
 *                         mane, tail and points the hair, socks the trim;
 *                         'mule' the mule (mulus) on the horse's frame: the
 *                         long ears, no hanging mane or forelock (a mule's
 *                         was roached), with 'pack' a pack saddle and two
 *                         panniers (the accent colour: the goods)
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
  { trunk: 24, round: 22, neck: 8, head: 14, headR: 16, leg: 16, legR: 14, tail: 10, tailR: 10 },
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
      [-0.57, 0.62, 0.585, 0.0094, 0.0, 2], [-0.555, 0.65, 0.54, 0.059, 0.0, 2], [-0.53, 0.672, 0.49, 0.0944, 0.0, 2.1], [-0.45, 0.69, 0.455, 0.1322, 0.0, 2.2], [-0.36, 0.7, 0.47, 0.1298, 0.1, 2.1],
      [-0.24, 0.704, 0.51, 0.1086, 0.2, 2.1], [-0.12, 0.708, 0.505, 0.1121, 0.25, 2], [0.0, 0.72, 0.455, 0.1322, 0.3, 2],
      [0.1, 0.745, 0.405, 0.1463, 0.42, 2], [0.2, 0.775, 0.385, 0.144, 0.5, 2], [0.29, 0.785, 0.41, 0.1345, 0.5, 2],
      [0.35, 0.76, 0.45, 0.118, 0.45, 2], [0.39, 0.72, 0.52, 0.0826, 0.3, 2],
    ],
    neck: [[0.0, 0.6, 0.2, 0.115, 0.1955, 0.1725], [0.35, 0.68, 0.35, 0.1115, 0.1552, 0.1552], [0.7, 0.77, 0.45, 0.0989, 0.1207, 0.1265], [1, 0.835, 0.52, 0.0851, 0.092, 0.1035]],
    head: {
      from: [0, 0.87, 0.49], to: [0, 0.825, 0.79],
      keys: [[0, 0.05, -0.045, 0.045], [0.1, 0.076, -0.066, 0.068], [0.25, 0.083, -0.07, 0.08], [0.4, 0.07, -0.05, 0.073], [0.52, 0.05, -0.036, 0.052],
        [0.68, 0.041, -0.028, 0.037], [0.85, 0.035, -0.023, 0.029], [0.95, 0.031, -0.02, 0.023], [1, 0.012, -0.012, 0.012]],
      jaw: [[0.25, -0.035, -0.072, 0.052], [0.45, -0.03, -0.056, 0.046], [0.65, -0.022, -0.04, 0.034], [0.85, -0.018, -0.032, 0.025], [0.97, -0.018, -0.026, 0.013]],
      eye: [0.41, 0.036, 0.052, 0.012], nose: [1.0, 0.0, 0.019], ear: { base: 0.05, deep: 0.032, h: 0.085, tilt: 0.22 },
    },
    fore: [[-0.35, 0.042, 0.062, 0.058], [0, 0.046, 0.058, 0.055], [0.45, 0.045, 0.045, 0.052], [1, 0.037, 0.035, 0.04],
      [1.3, 0.035, 0.033, 0.03], [1.85, 0.024, 0.023, 0.021], [2.05, 0.025, 0.025, 0.024], [2.6, 0.02, 0.02, 0.019], [3, 0.022, 0.022, 0.02]],
    hind: [[-0.35, 0.055, 0.085, 0.085], [0.15, 0.056, 0.075, 0.085], [0.55, 0.05, 0.055, 0.07], [1, 0.042, 0.04, 0.05],
      [1.3, 0.037, 0.03, 0.046], [1.85, 0.024, 0.02, 0.026], [2.05, 0.022, 0.019, 0.032], [2.5, 0.02, 0.019, 0.019], [3, 0.022, 0.022, 0.02]],
    paw: { len: 0.066, w: 0.029, h: 0.027 },
    tail: [[0, 0.035], [0.5, 0.045], [1.2, 0.055], [2, 0.054], [2.6, 0.042], [3, 0.01]],
    hairy: 1,
  },
  horse: {
    trunk: [
      [-0.92, 1.25, 1.17, 0.012, 0, 2], [-0.9, 1.3, 1.1, 0.07, 0, 2], [-0.85, 1.36, 1.0, 0.15, 0, 2.0], [-0.72, 1.41, 0.93, 0.2, 0.05, 2.0], [-0.55, 1.42, 0.88, 0.215, 0.1, 2.0],
      [-0.3, 1.39, 0.84, 0.22, 0.15, 2.0], [-0.05, 1.38, 0.8, 0.225, 0.18, 2.0], [0.18, 1.41, 0.78, 0.22, 0.25, 2.0],
      [0.36, 1.46, 0.79, 0.2, 0.35, 2.0], [0.5, 1.43, 0.86, 0.18, 0.45, 2.0], [0.6, 1.35, 0.95, 0.15, 0.4, 2.0], [0.66, 1.25, 1.03, 0.1, 0.3, 2],
    ],
    neck: [[0.0, 1.2, 0.56, 0.18, 0.24, 0.2], [0.3, 1.34, 0.68, 0.15, 0.2, 0.15], [0.62, 1.5, 0.8, 0.114, 0.16, 0.11], [1, 1.66, 0.91, 0.09, 0.11, 0.1]],
    head: {
      from: [0, 1.73, 0.88], to: [0, 1.3, 1.37],
      keys: [[0.0, 0.04, -0.06, 0.065], [0.08, 0.07, -0.12, 0.0975], [0.22, 0.065, -0.135, 0.1105], [0.4, 0.058, -0.07, 0.091], [0.62, 0.05, -0.055, 0.0754],
        [0.82, 0.05, -0.055, 0.0715], [0.94, 0.045, -0.06, 0.0754], [1.0, 0.02, -0.03, 0.039]],
      jaw: [[0.82, -0.04, -0.07, 0.04], [0.95, -0.04, -0.07, 0.035], [1, -0.05, -0.065, 0.02]],
      eye: [0.2, 0.03, 0.078, 0.018], nose: [0.98, 0.03, 0.016], ear: { base: 0.04, deep: 0.03, h: 0.13, tilt: 0.1 },
    },
    fore: [[-0.35, 0.08, 0.13, 0.11], [0, 0.085, 0.11, 0.1], [0.5, 0.075, 0.07, 0.08], [1, 0.065, 0.06, 0.07],
      [1.3, 0.06, 0.055, 0.05], [1.9, 0.04, 0.042, 0.035], [2.05, 0.045, 0.048, 0.04], [2.5, 0.033, 0.03, 0.035], [2.95, 0.04, 0.042, 0.045], [3, 0.04, 0.042, 0.042]],
    hind: [[-0.35, 0.1, 0.14, 0.15], [0.2, 0.1, 0.11, 0.13], [0.6, 0.085, 0.08, 0.1], [1, 0.07, 0.06, 0.08],
      [1.3, 0.06, 0.05, 0.075], [1.85, 0.042, 0.035, 0.045], [2.05, 0.04, 0.035, 0.06], [2.5, 0.033, 0.03, 0.034], [2.95, 0.04, 0.042, 0.045], [3, 0.04, 0.042, 0.042]],
    hoof: { r: 0.06, h: 0.085 },
    tail: [[0, 0.055], [0.6, 0.045], [1.2, 0.035], [2, 0.025], [3, 0.015]],
  },
  elephant: {
    trunk: [
      [-1.53, 1.9, 1.75, 0.03, 0, 2], [-1.5, 2.05, 1.6, 0.25, 0, 2], [-1.42, 2.3, 1.35, 0.5, 0, 2.3], [-1.2, 2.44, 1.22, 0.62, 0.05, 2.4], [-0.9, 2.45, 1.18, 0.66, 0.08, 2.4],
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
  // The menagerie's beasts (models/vivarium.js). A lion: deep in the chest, narrow in the loins, the belly's
  // fold of skin hanging between the legs; a broad skull, a short deep muzzle, small round ears.
  lion: {
    trunk: [
      [-0.93, 0.93, 0.87, 0.02, 0, 2], [-0.91, 0.98, 0.76, 0.1, 0, 2], [-0.86, 1.01, 0.69, 0.16, 0, 2.1], [-0.74, 1.03, 0.63, 0.19, 0.05, 2.2], [-0.56, 1.02, 0.62, 0.19, 0.1, 2.2],
      [-0.36, 1.0, 0.65, 0.17, 0.15, 2.1], [-0.16, 1.01, 0.62, 0.18, 0.2, 2.0], [0.04, 1.04, 0.58, 0.2, 0.3, 2.0],
      [0.2, 1.08, 0.55, 0.21, 0.4, 2.0], [0.36, 1.11, 0.57, 0.2, 0.45, 2.0], [0.48, 1.08, 0.63, 0.17, 0.4, 2.0], [0.56, 1.0, 0.71, 0.12, 0.3, 2],
    ],
    neck: [[0.0, 0.88, 0.32, 0.17, 0.24, 0.22], [0.35, 0.96, 0.46, 0.155, 0.2, 0.2], [0.7, 1.05, 0.58, 0.135, 0.17, 0.17], [1, 1.11, 0.66, 0.115, 0.13, 0.14]],
    head: {
      // (A cat's muzzle is short, broad and deep, its face flat in front: no wolf's snout.)
      from: [0, 1.14, 0.66], to: [0, 1.04, 1.0],
      keys: [[0, 0.07, -0.07, 0.085], [0.12, 0.11, -0.1, 0.125], [0.3, 0.125, -0.11, 0.14], [0.48, 0.105, -0.09, 0.13], [0.62, 0.09, -0.078, 0.115],
        [0.78, 0.082, -0.072, 0.105], [0.9, 0.074, -0.066, 0.095], [0.97, 0.062, -0.055, 0.08], [1, 0.03, -0.03, 0.04]],
      jaw: [[0.3, -0.06, -0.125, 0.095], [0.5, -0.055, -0.11, 0.09], [0.7, -0.05, -0.095, 0.08], [0.88, -0.045, -0.08, 0.065], [0.97, -0.045, -0.068, 0.04]],
      eye: [0.47, 0.06, 0.072, 0.016], nose: [0.99, 0.012, 0.03], ear: { base: 0.08, deep: 0.045, h: 0.07, tilt: 0.35 },
    },
    fore: [[-0.35, 0.085, 0.12, 0.11], [0, 0.085, 0.1, 0.1], [0.45, 0.08, 0.075, 0.085], [1, 0.065, 0.06, 0.065],
      [1.3, 0.06, 0.055, 0.05], [1.85, 0.045, 0.045, 0.04], [2.05, 0.048, 0.05, 0.045], [2.6, 0.042, 0.042, 0.04], [3, 0.045, 0.045, 0.042]],
    hind: [[-0.35, 0.1, 0.15, 0.15], [0.15, 0.1, 0.13, 0.14], [0.55, 0.085, 0.09, 0.11], [1, 0.065, 0.06, 0.075],
      [1.3, 0.055, 0.045, 0.07], [1.85, 0.04, 0.035, 0.045], [2.05, 0.04, 0.036, 0.05], [2.5, 0.037, 0.036, 0.036], [3, 0.042, 0.042, 0.04]],
    paw: { len: 0.13, w: 0.062, h: 0.05 },
    tail: [[0, 0.05], [0.5, 0.04], [1.2, 0.032], [2, 0.027], [2.6, 0.024], [3, 0.018]],
    tuft: 0.055,
  },
  // A brown bear: a rounded bulk, the hump of muscle over the shoulders, a dished face, short round ears, the
  // soles flat on the ground, long pale claws on the forefeet; a stub of a tail.
  bear: {
    trunk: [
      [-0.84, 0.85, 0.75, 0.03, 0, 2], [-0.8, 0.95, 0.6, 0.16, 0, 2.2], [-0.7, 1.0, 0.5, 0.25, 0.05, 2.3], [-0.5, 1.01, 0.46, 0.29, 0.05, 2.3], [-0.25, 1.0, 0.45, 0.3, 0.08, 2.3],
      [0, 1.02, 0.45, 0.3, 0.1, 2.3], [0.2, 1.08, 0.47, 0.29, 0.12, 2.2], [0.36, 1.14, 0.5, 0.27, 0.15, 2.2], [0.5, 1.09, 0.56, 0.23, 0.15, 2.1],
      [0.6, 0.99, 0.66, 0.17, 0.1, 2], [0.65, 0.91, 0.74, 0.08, 0, 2],
    ],
    neck: [[0, 0.86, 0.42, 0.22, 0.24, 0.26], [0.4, 0.88, 0.55, 0.19, 0.2, 0.22], [0.75, 0.92, 0.65, 0.16, 0.16, 0.17], [1, 0.95, 0.72, 0.13, 0.13, 0.13]],
    head: {
      from: [0, 0.99, 0.7], to: [0, 0.86, 1.12],
      keys: [[0, 0.08, -0.08, 0.1], [0.15, 0.12, -0.11, 0.14], [0.32, 0.12, -0.11, 0.142], [0.5, 0.085, -0.085, 0.1], [0.66, 0.064, -0.07, 0.074],
        [0.82, 0.055, -0.06, 0.06], [0.95, 0.05, -0.046, 0.05], [1, 0.02, -0.02, 0.025]],
      jaw: [[0.35, -0.05, -0.11, 0.08], [0.6, -0.04, -0.085, 0.06], [0.85, -0.035, -0.065, 0.045], [0.97, -0.035, -0.05, 0.03]],
      eye: [0.42, 0.055, 0.072, 0.012], nose: [0.99, 0.012, 0.028], ear: { base: 0.07, deep: 0.05, h: 0.065, tilt: 0.45 },
    },
    fore: [[-0.4, 0.13, 0.17, 0.16], [0, 0.12, 0.14, 0.14], [0.5, 0.1, 0.11, 0.12], [1, 0.085, 0.085, 0.09], [1.5, 0.076, 0.072, 0.076], [2, 0.07, 0.07, 0.07], [2.5, 0.068, 0.07, 0.066], [3, 0.07, 0.075, 0.07]],
    hind: [[-0.4, 0.15, 0.2, 0.2], [0, 0.14, 0.16, 0.17], [0.5, 0.11, 0.12, 0.13], [1, 0.09, 0.09, 0.1], [1.5, 0.08, 0.075, 0.08], [2, 0.072, 0.07, 0.068], [2.5, 0.07, 0.07, 0.066], [3, 0.07, 0.075, 0.07]],
    paw: { len: 0.15, w: 0.08, h: 0.055, claws: 0.05 },
    tail: [[0, 0.06], [1.5, 0.045], [3, 0.02]],
    shaggy: 1,
  },
};
// The leopard: the lion's frame at SPECIES.leopard's scale, slimmer through the body and limbs, no tuft.
ANATOMY.leopard = scaledAnatomy(ANATOMY.lion, 0.64, 0.86);

// The villages' flocks (models/villages.js), cloven-hoofed (`cloven`: their own small hooves). A goat: lean, the
// back straight, deep in the chest for its size, a long narrow face, ears out to the side, horns and a beard
// (goatHorns). A sheep: a deep round barrel under its fleece (its coat in the mantle's slot: the wool's weave),
// a small face, ears out flat, a long thin tail.
ANATOMY.goat = {
  trunk: [
    [-0.47, 0.66, 0.6, 0.01, 0, 2], [-0.45, 0.7, 0.52, 0.06, 0, 2], [-0.4, 0.73, 0.46, 0.105, 0, 2], [-0.3, 0.74, 0.43, 0.125, 0.05, 2], [-0.1, 0.73, 0.41, 0.135, 0.1, 2],
    [0.08, 0.75, 0.39, 0.135, 0.15, 2], [0.2, 0.77, 0.41, 0.125, 0.25, 2], [0.29, 0.74, 0.46, 0.105, 0.25, 2], [0.34, 0.68, 0.53, 0.065, 0.2, 2],
  ],
  neck: [[0, 0.67, 0.28, 0.07, 0.09, 0.085], [0.35, 0.74, 0.34, 0.06, 0.075, 0.072], [0.7, 0.83, 0.4, 0.05, 0.062, 0.06], [1, 0.91, 0.44, 0.045, 0.05, 0.05]],
  head: {
    from: [0, 0.97, 0.42], to: [0, 0.82, 0.65],
    keys: [[0, 0.03, -0.04, 0.04], [0.15, 0.05, -0.055, 0.05], [0.35, 0.046, -0.05, 0.048], [0.6, 0.034, -0.036, 0.034], [0.85, 0.028, -0.03, 0.027], [1, 0.012, -0.012, 0.013]],
    jaw: [[0.55, -0.02, -0.04, 0.026], [0.85, -0.02, -0.034, 0.02], [1, -0.02, -0.03, 0.012]],
    eye: [0.3, 0.024, 0.044, 0.01], nose: [0.98, 0.01, 0.01], ear: { base: 0.03, deep: 0.02, h: 0.085, tilt: 1.1 },
  },
  fore: [[-0.35, 0.04, 0.055, 0.05], [0, 0.04, 0.05, 0.045], [0.5, 0.032, 0.03, 0.035], [1, 0.024, 0.022, 0.025], [1.3, 0.02, 0.02, 0.02], [2, 0.015, 0.016, 0.015], [2.5, 0.016, 0.016, 0.016], [3, 0.017, 0.018, 0.018]],
  hind: [[-0.35, 0.05, 0.07, 0.07], [0.2, 0.045, 0.055, 0.06], [0.6, 0.035, 0.035, 0.045], [1, 0.026, 0.024, 0.03], [1.3, 0.022, 0.02, 0.025], [2, 0.015, 0.015, 0.016], [2.5, 0.016, 0.016, 0.016], [3, 0.017, 0.018, 0.018]],
  cloven: { r: 0.02, h: 0.045 },
  tail: [[0, 0.022], [1, 0.02], [2, 0.016], [3, 0.008]],
};
ANATOMY.sheep = {
  trunk: [
    [-0.5, 0.6, 0.52, 0.03, 0, 2], [-0.47, 0.66, 0.44, 0.11, 0, 2.2], [-0.4, 0.69, 0.38, 0.16, 0, 2.3], [-0.28, 0.71, 0.35, 0.18, 0.05, 2.3], [-0.1, 0.71, 0.34, 0.19, 0.08, 2.3],
    [0.08, 0.72, 0.34, 0.19, 0.1, 2.3], [0.2, 0.72, 0.36, 0.175, 0.15, 2.2], [0.3, 0.69, 0.4, 0.15, 0.15, 2.1], [0.37, 0.63, 0.47, 0.1, 0.1, 2],
  ],
  neck: [[0, 0.6, 0.28, 0.1, 0.11, 0.11], [0.35, 0.64, 0.34, 0.085, 0.09, 0.09], [0.7, 0.69, 0.4, 0.065, 0.07, 0.068], [1, 0.73, 0.45, 0.05, 0.055, 0.05]],
  head: {
    from: [0, 0.78, 0.43], to: [0, 0.66, 0.63],
    keys: [[0, 0.03, -0.04, 0.04], [0.15, 0.05, -0.05, 0.048], [0.35, 0.045, -0.045, 0.044], [0.6, 0.035, -0.035, 0.033], [0.85, 0.03, -0.03, 0.028], [1, 0.012, -0.012, 0.014]],
    jaw: [[0.55, -0.018, -0.036, 0.024], [0.85, -0.018, -0.03, 0.019], [1, -0.018, -0.026, 0.012]],
    eye: [0.32, 0.022, 0.04, 0.009], nose: [0.98, 0.008, 0.011], ear: { base: 0.028, deep: 0.018, h: 0.075, tilt: 1.6 },
  },
  fore: [[-0.35, 0.045, 0.06, 0.055], [0, 0.04, 0.05, 0.045], [0.5, 0.03, 0.03, 0.033], [1, 0.022, 0.02, 0.023], [1.3, 0.018, 0.018, 0.018], [2, 0.014, 0.015, 0.014], [2.5, 0.015, 0.015, 0.015], [3, 0.016, 0.017, 0.017]],
  hind: [[-0.35, 0.055, 0.075, 0.075], [0.2, 0.048, 0.058, 0.062], [0.6, 0.034, 0.034, 0.042], [1, 0.024, 0.022, 0.027], [1.3, 0.02, 0.019, 0.022], [2, 0.014, 0.014, 0.015], [2.5, 0.015, 0.015, 0.015], [3, 0.016, 0.017, 0.017]],
  cloven: { r: 0.018, h: 0.04 },
  tail: [[0, 0.04], [1, 0.035], [2, 0.03], [3, 0.018]],
  fleece: 1,
};

/** An anatomy at k of its size, its widths a further `wk` (a slimmer beast on a frame like another's). */
function scaledAnatomy(A, k, wk) {
  const H = A.head;
  return {
    trunk: A.trunk.map(([z, top, bot, w, keel, n]) => [z * k, top * k, bot * k, w * k * wk, keel, n]),
    neck: A.neck.map(([s, y, z, w, hu, hd]) => [s, y * k, z * k, w * k * wk, hu * k * wk, hd * k * wk]),
    head: {
      from: H.from.map((v) => v * k), to: H.to.map((v) => v * k),
      keys: H.keys.map(([s, a, b, w]) => [s, a * k, b * k, w * k * wk]),
      jaw: H.jaw.map(([s, a, b, w]) => [s, a * k, b * k, w * k * wk]),
      eye: [H.eye[0], H.eye[1] * k, H.eye[2] * k * wk, H.eye[3] * k], nose: [H.nose[0], H.nose[1] * k, H.nose[2] * k],
      ear: { base: H.ear.base * k, deep: H.ear.deep * k, h: H.ear.h * k * 1.1, tilt: H.ear.tilt },
    },
    fore: A.fore.map(([u, s, f, b]) => [u, s * k * wk, f * k * wk, b * k * wk]),
    hind: A.hind.map(([u, s, f, b]) => [u, s * k * wk, f * k * wk, b * k * wk]),
    paw: { len: A.paw.len * k, w: A.paw.w * k * wk, h: A.paw.h * k },
    tail: A.tail.map(([u, r]) => [u, r * k]),
  };
}

/** The menagerie's beasts: their coats and feet are their own (each function's `SHOW` branches). */
const SHOW = new Set(['lion', 'leopard', 'bear']);
/** The cats among them: amber eyes, pale bellies. */
const CATS = new Set(['lion', 'leopard']);

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
    let { p, d } = along(pts, Math.max(0, Math.min(pts.length - 1, u)));
    if (u < 0) {
      // (Above its top joint a limb rises straight up into the body: the shoulder's or the haunch's mass.)
      // (Rising a little and in toward the middle, so it stays inside the body that hides its top.)
      const k = -u;
      p = add(pts[0], [-pts[0][0] * 0.45 * Math.min(1, k), k * 0.35 * len(sub(pts[1], pts[0])), 0]);
      d = nrm(add(mul([0, -1, 0], Math.min(1, -u * 2)), mul(d, Math.max(0, 1 + u * 2))));
    }
    const c = p;
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

/**
 * Is a point of a leopard's coat in a spot? The nearest of a jittered grid's
 * points (one a 7 cm cell) within a third of a cell: solid spots, which is
 * what a vertex's tone can draw (the rosettes' rings are under a pixel).
 */
function leopardSpot(p) {
  const c = 0.07;
  const gx = Math.floor(p[0] / c);
  const gy = Math.floor(p[1] / c);
  const gz = Math.floor(p[2] / c);
  let best = 9;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (let k = -1; k <= 1; k++) {
        const x = gx + i;
        const y = gy + j;
        const z = gz + k;
        const q = [(x + 0.5 + 0.35 * noise(x, y, z)) * c, (y + 0.5 + 0.35 * noise(y, z, x)) * c, (z + 0.5 + 0.35 * noise(z, x, y)) * c];
        best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) / c);
      }
    }
  }
  return best < 0.36;
}

/** The colour regions of a wolf's coat at a body point (its angle round the ring: 0 the back). */
function wolfSlot(phi, y, below) {
  const c = Math.cos(phi);
  if (c > 0.55) return SLOTS.HAIR;
  if (c < below) return SLOTS.TRIM;
  // (The coat in the mantle's slot: rough and woven, as fur takes the light; not the skin's sheen.)
  return SLOTS.MANTLE;
}
/** A wolf's coat's slot where a body piece would take the skin's. */
const FUR = SLOTS.MANTLE;

/** Fur's grizzle: a fine tone noise (wolf), a short coat's sheen (horse), a hide's wrinkles (elephant). */
function coatTone(sp, p, base = 1) {
  if (sp === 'wolf') return base * (0.86 + 0.12 * noise(p[0] * 40, p[1] * 40, p[2] * 40) + 0.08 * Math.sin(p[2] * 70 + p[1] * 30) * Math.sin(p[0] * 50 + p[2] * 20));
  if (sp === 'elephant') return base * (0.88 + 0.08 * Math.sin(p[1] * 60 + p[2] * 7) * Math.sin(p[2] * 45) + 0.04 * noise(p[0] * 9, p[1] * 9, p[2] * 9));
  // The show beasts: a lion's short close coat; a leopard's spots (a vertex's tone: blotches at the game's
  // zooms, where a rosette's ring would be a pixel); a bear's shaggy, grizzled coat.
  if (sp === 'lion') return base * (0.93 + 0.05 * noise(p[0] * 25, p[1] * 25, p[2] * 25) + 0.03 * Math.sin(p[2] * 40 + p[1] * 25));
  if (sp === 'leopard') return base * (leopardSpot(p) ? 0.22 : 0.96 + 0.04 * noise(p[0] * 30, p[1] * 30, p[2] * 30));
  if (sp === 'bear') return base * (0.82 + 0.14 * noise(p[0] * 32, p[1] * 32, p[2] * 32) + 0.07 * Math.sin(p[1] * 55 + p[2] * 18) * Math.sin(p[0] * 40));
  // A sheep's fleece in locks; a goat's coat a little shaggy along the flanks.
  if (sp === 'sheep') return base * (0.84 + 0.12 * noise(p[0] * 70, p[1] * 70, p[2] * 70) + 0.06 * noise(p[0] * 18, p[1] * 18, p[2] * 18));
  if (sp === 'goat') return base * (0.9 + 0.08 * noise(p[0] * 45, p[1] * 45, p[2] * 45) + 0.04 * Math.sin(p[1] * 90 + p[2] * 20));
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
      if (slot === FUR) tone *= 0.92 + 0.12 * (1 - Math.cos(phi));
    } else if (sp === 'horse') {
      tone *= 0.9 + 0.1 * Math.cos(phi) - 0.05 * gauss((Math.cos(phi) + 1) / 0.4);
    } else if (SHOW.has(sp)) {
      // A cat's pale belly; the back a shade darker. A bear's underside darker than its flanks.
      slot = sp !== 'bear' && Math.cos(phi) < -0.62 ? SLOTS.TRIM : FUR;
      tone *= sp === 'bear' ? 0.86 + 0.14 * Math.max(0, Math.cos(phi) + 0.3) : 0.94 - 0.06 * Math.max(0, Math.cos(phi));
    } else if (A.fleece) {
      // A sheep's fleece: the mantle's slot (the wool's weave), dingier under the belly.
      slot = FUR;
      tone *= 0.88 + 0.12 * Math.max(0, Math.cos(phi) + 0.4);
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
      ring.push(m.vertex(p, [0, 0], trunkWeights(J, p), sp === 'wolf' ? wolfSlot(phi, p[1], -0.45) : SHOW.has(sp) ? FUR : SLOTS.SKIN, coatTone(sp, p) * 0.9));
    }
    const cv = m.vertex(ctr, [0, 0], trunkWeights(J, ctr), SHOW.has(sp) ? FUR : SLOTS.SKIN, 0.85);
    void base;
    // (Both faces: a cap seen from inside the body is hidden by it anyway.)
    m.fan(ring, cv, false);
    m.fan(ring, cv, true);
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
      slot = Math.cos(phi) > 0.5 ? SLOTS.HAIR : Math.cos(phi) < -0.2 ? SLOTS.TRIM : FUR;
      tone *= 1 + 0.05 * Math.sin(phi * 7 + s * 9);
    } else if (SHOW.has(sp)) {
      // A cat's throat pale; a bear's neck all coat.
      slot = sp !== 'bear' && Math.cos(phi) < -0.45 ? SLOTS.TRIM : FUR;
    } else if (A.fleece) {
      // The fleece up the neck to behind the ears; the face bare.
      if (s < 0.82) slot = FUR;
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
      slot = cphi > 0.6 ? SLOTS.HAIR : cphi < -0.55 ? (s > 0.5 ? SLOTS.DARK : SLOTS.TRIM) : s > 0.3 && Math.abs(Math.sin(phi)) > 0.5 && cphi < 0.3 ? SLOTS.TRIM : FUR;
      if (s > 0.94) slot = SLOTS.DARK;
    } else if (sp === 'horse') {
      // The muzzle darker and softer.
      if (s > 0.85) tone *= 0.7;
    } else if (SHOW.has(sp)) {
      // A cat's muzzle and chin pale, the lips' line dark; a bear's muzzle paler than its brow.
      const cphi = Math.cos(phi);
      if (sp === 'bear') slot = s > 0.62 ? SLOTS.TRIM : FUR;
      else slot = cphi < -0.55 ? (s > 0.72 ? SLOTS.DARK : SLOTS.TRIM) : s > 0.55 && Math.abs(Math.sin(phi)) > 0.45 && cphi < 0.35 ? SLOTS.TRIM : FUR;
    } else if (A.cloven) {
      // A goat's or a sheep's muzzle darker; a sheep's poll in its fleece.
      if (s > 0.82) tone *= 0.72;
      if (A.fleece && s < 0.12 && Math.cos(phi) > 0) slot = FUR;
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
      return { p: q, c: add(c, mul(up, mid)), uv: [phi * 0.1, s], w: jw, slot: sp === 'wolf' || SHOW.has(sp) ? (Math.cos(phi) > 0.3 ? SLOTS.DARK : SLOTS.TRIM) : SLOTS.SKIN, tone: coatTone(sp, q) * 0.9 };
    });
    if ((sp === 'wolf' || sp === 'lion') && lod < 2) {
      // The teeth along the jaw's rim: a row of white points either side, the canines longer (a lion's bigger:
      // its roar shows them).
      const tk = sp === 'lion' ? 2 : 1;
      for (const s of [1, -1]) {
        for (let k = 0; k < (lod === 0 ? 6 : 3); k++) {
          const ss = lerp(0.55, 0.95, k / 5);
          const [a, , w] = keyed(H.keys, ss);
          void a;
          const c = add(add(H.from, mul(ax, ss * L)), add(mul(up, -0.012 * tk), [s * w * 0.75, 0, 0]));
          const h = (k === 5 ? 0.02 : 0.009) * tk;
          ellipsoid(m, c, 0.004 * tk, h, 0.004 * tk, 2, 4, weights([[QB.head, 1]]), SLOTS.WHITE);
        }
      }
    }
  }
  // Eyes.
  if (H.eye && lod < 2) {
    const [s, yUp, xOut, r] = H.eye;
    for (const sd of [1, -1]) {
      const c = add(add(H.from, mul(ax, s * L)), add(mul(up, yUp), [sd * xOut, 0, 0]));
      ellipsoid(m, c, r * 0.8, r, r, 4, 6, hw, (p) => (Math.abs(p[0]) > Math.abs(c[0]) + r * 0.3 || p[2] > c[2] + r * 0.4 ? (sp === 'wolf' || CATS.has(sp) ? SLOTS.ACCENT : SLOTS.DARK) : SLOTS.DARK));
      if (sp === 'wolf' || CATS.has(sp)) ellipsoid(m, add(c, [sd * r * 0.5, 0, r * 0.35]), r * 0.4, r * 0.55, r * 0.4, 3, 5, hw, SLOTS.DARK);
    }
  }
  // The nose (a wolf's leather; a horse's nostrils).
  if (H.nose) {
    const [s, yUp, r] = H.nose;
    if (sp === 'wolf') {
      const c = add(add(H.from, mul(ax, s * L)), mul(up, yUp + 0.004));
      ellipsoid(m, c, r * 1.1, r * 0.8, r, 3, 6, hw, SLOTS.DARK, () => 0.5);
    } else if (SHOW.has(sp)) {
      // The nose leather: a cat's a rosy brown (the leather's colour), a bear's black.
      const c = add(add(H.from, mul(ax, s * L)), mul(up, yUp + 0.004));
      ellipsoid(m, c, r * 1.15, r * 0.75, r * 0.9, 3, 6, hw, sp === 'bear' ? SLOTS.DARK : SLOTS.LEATHER, () => 0.7);
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
        // (A cat's or a bear's ear rounded at its top.)
        const r = SHOW.has(sp) ? Math.sqrt(Math.max(0, 1 - v * v)) : (1 - v) ** 0.9;
        const bx = Math.sin(phi) * E.base * 0.5 * r;
        const bz = Math.cos(phi) * E.deep * 0.5 * r * (Math.cos(phi) > 0 ? 0.35 : 1);
        const p = [base[0] + bx + sd * E.h * v * E.tilt, base[1] + E.h * v, base[2] + bz - 0.01 * v];
        const inner = Math.cos(phi) > 0.2 && v < 0.85;
        return { p, c: [base[0] + sd * E.h * v * E.tilt, base[1] + E.h * v, base[2] - 0.01], uv: [phi * 0.02, v], w: ew, slot: sp === 'wolf' ? (inner ? SLOTS.TRIM : SLOTS.HAIR) : SHOW.has(sp) ? (inner ? SLOTS.TRIM : sp === 'bear' ? FUR : SLOTS.HAIR) : SLOTS.SKIN, tone: inner ? 0.75 : 0.9 };
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
        return inside || u > 1.9 ? SLOTS.TRIM : u < 0.4 && Math.cos(phi) > 0.7 ? SLOTS.HAIR : FUR;
      }
      if (sp === 'horse') return u > 1.8 ? SLOTS.TRIM : SLOTS.SKIN;
      // A cat's legs pale inside; a bear's darker below the knees and elbows.
      if (sp === 'bear') return u > 1.25 ? SLOTS.HAIR : FUR;
      if (SHOW.has(sp)) return Math.sin(phi) < -0.35 || (!fore && Math.cos(phi) < -0.7 && u < 1) ? SLOTS.TRIM : FUR;
      return SLOTS.SKIN;
    },
    tone: (u, phi, p) => coatTone(sp, p) * (sp === 'horse' && u > 1.6 ? 0.85 : 1) * (0.94 + 0.06 * Math.cos(phi)),
  });
  // The foot.
  const D = J[bones[3]];
  const fw = weights([[bones[3], 1]]);
  if (sp === 'wolf' || SHOW.has(sp)) {
    // A paw (the wolf's and the show beasts': the cats' in their coat, the bear's dark with its long pale claws).
    const P = A.paw;
    const top = sp === 'wolf' ? SLOTS.TRIM : sp === 'bear' ? SLOTS.HAIR : FUR;
    const c = [D[0], P.h * 0.75, D[2] + P.len * 0.45];
    ellipsoid(m, c, P.w, P.h * 0.85, P.len * 0.62, lod === 0 ? 5 : 3, lod === 0 ? 10 : 6, (p) => weights([[bones[3], 1], [bones[2], p[1] > 0.045 ? 0.3 : 0]]), (p) => (p[1] < 0.012 ? SLOTS.DARK : top), (p) => coatTone(sp, p) * 0.95);
    if (lod === 0 || (P.claws && lod === 1)) {
      // The toes and their claws (a cat's drawn in: none to see).
      for (let k = 0; k < 4; k++) {
        const x = (k - 1.5) * P.w * 0.55;
        const tc = [D[0] + x, P.h * 0.45, D[2] + P.len * (0.85 - 0.12 * Math.abs(k - 1.5))];
        if (lod === 0) ellipsoid(m, tc, P.w * 0.32, P.h * 0.48, P.w * 0.38, 3, 5, fw, top, () => 0.9);
        if (P.claws) ellipsoid(m, add(tc, [0, -0.012, P.w * 0.3 + P.claws * 0.45]), 0.008, 0.009, P.claws * 0.55, 2, 4, fw, SLOTS.PAPYRUS, () => 0.8);
        else if (sp === 'wolf') ellipsoid(m, add(tc, [0, -0.008, P.w * 0.35]), 0.004, 0.005, 0.009, 2, 4, fw, SLOTS.DARK);
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
  } else if (A.cloven) {
    // A goat's or a sheep's pastern and its small cloven hoof (the cleft a dark line down its front).
    const H = A.cloven;
    const top = [D[0], H.h + 0.012, D[2] + 0.012];
    const bot = [D[0], 0.0, D[2] + 0.022];
    limbLoft(m, [D, top, bot], {
      u0: 0, u1: 2, rows: lod === 0 ? 3 : 2, cols: R.legR, side: sd,
      rad: (u) => (u < 1 ? [H.r * 0.85, H.r * 0.9, H.r * 0.85] : [lerp(H.r * 0.9, H.r, u - 1), lerp(H.r, H.r * 1.15, u - 1), lerp(H.r * 0.9, H.r * 0.8, u - 1)]),
      w: () => fw,
      slot: (u, phi) => (u > 1.05 ? SLOTS.DARK : SLOTS.SKIN),
      tone: (u, phi) => (u > 1 ? 0.55 + (Math.abs(Math.sin(phi)) < 0.2 && Math.cos(phi) > 0 ? -0.25 : 0.15) : 0.8),
    });
    ellipsoid(m, [bot[0], 0.003, bot[2]], H.r, 0.004, H.r * 1.1, 1, R.legR, fw, SLOTS.DARK);
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
    slot: (u, phi) => (sp === 'wolf' ? (u > 2.75 ? SLOTS.DARK : Math.cos(phi) > 0.75 && u < 2 ? SLOTS.HAIR : FUR) : sp === 'horse' ? SLOTS.HAIR : SHOW.has(sp) ? (A.tuft && u > 2.7 ? SLOTS.HAIR : FUR) : SLOTS.SKIN),
    tone: (u, phi, p) => coatTone(sp, p) * 1 * (1 + (sp === 'wolf' ? 0.08 * Math.sin(phi * 6 + u * 8) : 0)),
  });
  if (sp === 'horse') {
    // The hair of the tail: a long full fall from the dock, swinging with it.
    const fall = [J[QB.tail1], J[QB.tail2], J[QB.tail3], S.tailEnd, [0, 0.42, -1.0]];
    limbLoft(m, fall, {
      u0: 0.3, u1: 4, rows: lod === 0 ? 10 : lod === 1 ? 5 : 3, cols: lod === 0 ? 10 : 6, fwd: [0, 1, 0],
      rad: (u) => {
        const r = 0.035 + 0.035 * smooth(0.3, 2.2, u) - 0.045 * smooth(3.2, 4, u);
        return [r * 0.85, r, r];
      },
      w: (u) => chainW(bones, Math.min(2.99, u)),
      slot: () => SLOTS.HAIR,
      tone: (u, phi) => 0.8 + 0.15 * Math.sin(phi * 9 + u * 3),
    });
  } else if (sp === 'elephant') {
    ellipsoid(m, add(S.tailEnd, [0, -0.04, 0]), 0.04, 0.08, 0.04, 3, 5, weights([[QB.tail3, 1]]), SLOTS.DARK);
  } else if (A.tuft) {
    // A lion's tuft of dark hair at the tail's end.
    const r = A.tuft;
    ellipsoid(m, add(S.tailEnd, [0, -r * 0.4, -r * 0.3]), r * 0.85, r * 1.4, r * 0.85, lod === 0 ? 5 : 3, lod === 0 ? 8 : 5, weights([[QB.tail3, 1]]), SLOTS.HAIR, (q) => 0.75 + 0.2 * noise(q[0] * 60, q[1] * 60, q[2] * 60));
  }
}

/**
 * A lion's mane: a shaggy collar of rings from the withers up the neck and
 * round the back of the skull, framing the face (its last rows turn in to
 * the head behind the eyes); its strands in the tone, its edge ragged. On
 * the chest's, the neck's and the head's bones as the neck is, so it moves
 * with the head. Hair colour; the lioness and the leopard have none.
 */
function lionMane(m, A, J, lod) {
  const H = A.head;
  const ax = nrm(sub(H.to, H.from));
  const L = len(sub(H.to, H.from));
  const up = nrm(sub([0, 1, 0], mul(ax, ax[1])));
  // The collar's line from the withers to round the face (centres), and its radii: half width, up, down.
  const face = add(H.from, mul(ax, 0.36 * L));
  const line = [[0, 1.02, 0.18], [0, 1.04, 0.36], [0, 1.1, 0.5], [0, 1.16, 0.62], face];
  const radii = [[0.17, 0.12, 0.3], [0.26, 0.22, 0.44], [0.3, 0.28, 0.48], [0.3, 0.29, 0.44], [0.24, 0.24, 0.27]];
  const rows = [12, 6, 3][lod];
  const cols = [22, 12, 7][lod];
  const lump = lod < 2;
  const n = line.length - 1;
  m.grid(rows + 1, cols, (i, j) => {
    // The last row turns in from the face's ring to the head's own surface (the ruff's edge into the fur).
    const last = i > rows;
    const u = Math.min(n, (n * Math.min(i, rows)) / rows);
    const { p: c, d } = along(line, u);
    const k = u - Math.floor(Math.min(u, n - 1e-6));
    const a = radii[Math.min(n, Math.floor(u))];
    const b = radii[Math.min(n, Math.floor(u) + 1)];
    let [w, hu, hd] = [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    if (last) {
      const [ka, kb, kw] = keyed(H.keys, 0.42);
      w = kw * 0.95;
      hu = ka * 0.95;
      hd = -kb * 0.95;
    }
    const phi = (TAU * j) / cols;
    // The ring square to the line; its up the head's up near the face, the world's at the withers.
    const upv = nrm(sub(u > n - 1 ? up : [0, 1, 0], mul(d, (u > n - 1 ? up : [0, 1, 0])[0] * d[0] + (u > n - 1 ? up : [0, 1, 0])[1] * d[1] + (u > n - 1 ? up : [0, 1, 0])[2] * d[2])));
    const side = nrm(cross(upv, d));
    // (Locks: a ragged edge round and along it, strongest where the ruff frames the face.)
    const shag = lump ? 1 + (0.1 + 0.08 * (i / rows)) * Math.sin(phi * 9 + i * 1.7) + 0.08 * noise(i, j) : 1;
    const [x, y] = ringPt(phi, w * shag, hu * shag, hd * shag, 0, 2.0);
    const centre = last ? add(face, mul(ax, 0.05 * L)) : c;
    const q = add(add(centre, mul(side, x)), mul(upv, y));
    const s = i / rows;
    const wt = weights([[QB.chest, 1 - smooth(0.05, 0.4, s)], [QB.neck, smooth(0.05, 0.4, s) * (1 - smooth(0.4, 0.75, s))], [QB.neck2, smooth(0.4, 0.75, s) * (1 - smooth(0.75, 0.95, s))], [QB.head, smooth(0.75, 0.95, s)]]);
    return { p: q, c: centre, uv: [phi * 0.3, s], w: wt, slot: SLOTS.HAIR, tone: 0.72 + 0.22 * Math.sin(phi * 11 + s * 6) * Math.sin(phi * 3.1 + i) + 0.12 * (1 - s) };
  });
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

/** The elephant's ears: great flaps hung from the head on their own bones, down and back over the neck. */
function bigEars(m, J, lod) {
  const rows = lod === 0 ? 8 : lod === 1 ? 4 : 2;
  const cols = lod === 0 ? 14 : lod === 1 ? 7 : 4;
  for (const [sd, bone] of [[1, QB.earL], [-1, QB.earR]]) {
    const base = J[bone];
    const ew = weights([[bone, 0.9], [QB.head, 0.1]]);
    // (Its root runs down the side of the head; the flap is an oval behind and below it, an African's tall ear.)
    const c = [base[0] + sd * 0.06, base[1] - 0.32, base[2] - 0.3];
    for (const face of [1, -1]) {
      m.grid(rows, cols, (i, j) => {
        const v = i / rows;
        const a = (TAU * j) / cols;
        const r = v * (1 + 0.06 * Math.sin(a * 3));
        // From the oval's middle out to its rim, the rim a little out from the head and curled.
        const y = c[1] + Math.cos(a) * 0.5 * r;
        const z = c[2] + Math.sin(a) * 0.36 * r;
        const x = c[0] + sd * (0.03 * v * v + 0.04 * Math.max(0, Math.sin(a)) * v) + face * sd * 0.015;
        return { p: [x, y, z], c: [c[0] - sd * face, y, z], uv: [a, v], w: ew, slot: SLOTS.SKIN, tone: (face > 0 ? 0.88 : 0.72) * (0.92 + 0.08 * Math.sin(a * 9 + v * 7)) };
      });
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
  const A = species === 'horse' && opts.has('mule') ? MULE : ANATOMY[species];
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
    if (!opts.has('mule')) mane(m, A, J, lod);
    if (opts.has('pack')) packSaddle(m, A, J, lod);
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
  } else if (species === 'lion') {
    // A maned male; 'maneless' a lioness.
    if (!opts.has('maneless')) lionMane(m, A, J, lod);
  } else if (species === 'elephant') {
    bigEars(m, J, lod);
    elephantTrunk(m, A, J, R);
    tusks(m, A, lod);
    if (opts.has('tower')) tower(m, A, J, lod);
  } else if (species === 'goat') {
    goatHorns(m, A, lod);
  }
  return m;
}

/**
 * A goat's horns, swept up and back from the poll in a scimitar's curve,
 * ridged, the colour of horn (the hair's slot, toned pale), and its beard
 * under the chin (the hair's slot); both on the head's bone.
 */
function goatHorns(m, A, lod) {
  const H = A.head;
  const ax = nrm(sub(H.to, H.from));
  const L = len(sub(H.to, H.from));
  const up = nrm(sub([0, 1, 0], mul(ax, ax[1])));
  const hw = () => weights([[QB.head, 1]]);
  for (const sd of [1, -1]) {
    const base = add(add(H.from, mul(ax, 0.2 * L)), add(mul(up, 0.04), [sd * 0.025, 0, 0]));
    const pts = [base, add(base, [sd * 0.015, 0.07, -0.03]), add(base, [sd * 0.035, 0.11, -0.1]), add(base, [sd * 0.05, 0.1, -0.17])];
    limbLoft(m, pts, {
      u0: 0, u1: 3, rows: lod === 0 ? 6 : 3, cols: lod === 0 ? 6 : 4,
      rad: (u) => {
        const r = 0.016 * (1 - u / 3.3);
        return [r * 0.8, r, r];
      },
      w: hw, slot: () => SLOTS.HAIR, tone: (u) => 1.6 - 0.25 * u + (lod === 0 ? 0.15 * Math.sin(u * 12) : 0),
    });
  }
  if (lod < 2) {
    const chin = add(add(H.from, mul(ax, 0.78 * L)), mul(up, -0.035));
    limbLoft(m, [chin, add(chin, [0, -0.04, -0.005]), add(chin, [0, -0.075, -0.015])], {
      u0: 0, u1: 2, rows: 2, cols: 4,
      rad: (u) => {
        const r = 0.012 * (1 - u / 2.2);
        return [r * 0.6, r, r];
      },
      w: hw, slot: () => SLOTS.HAIR, tone: () => 0.8,
    });
  }
}

/** The mule's anatomy: the horse's (it runs on the horse's rig and clips), its ears long and broad. */
const MULE = { ...ANATOMY.horse, head: { ...ANATOMY.horse.head, ear: { base: 0.065, deep: 0.045, h: 0.27, tilt: 0.28 } } };

/**
 * A mule's pack saddle: a pad and a wooden frame over the back, the girth,
 * and two wicker panniers hung either side heaped with the goods (the
 * accent colour), as the pack trains of the roads carried them.
 */
function packSaddle(m, A, J, lod) {
  const z = -0.1;
  const top = keyed(A.trunk, z)[0];
  const tw = weights([[QB.spine, 0.8], [QB.chest, 0.2]]);
  const cols = lod === 0 ? 12 : 6;
  ellipsoid(m, [0, top + 0.03, z], 0.22, 0.05, 0.36, lod === 0 ? 3 : 2, cols, tw, SLOTS.TRIM, () => 0.8);
  if (lod < 2) {
    for (const dz of [-0.2, 0.2]) {
      for (const sd of [1, -1]) limbLoft(m, [[0, top + 0.2, z + dz], [sd * 0.24, top - 0.02, z + dz]], { u0: 0, u1: 1, rows: 1, cols: 5, rad: () => [0.022, 0.022, 0.022], w: () => tw, slot: () => SLOTS.WOOD, tone: () => 0.8, fwd: [0, 0, 1] });
    }
  }
  band(m, A, J, z, 0.06, SLOTS.LEATHER, lod === 0 ? 16 : 8, { out: 0.024 });
  for (const sd of [1, -1]) {
    const [, bot, w] = keyed(A.trunk, z);
    const c = [sd * (w + 0.17), (top + bot) / 2 + 0.06, z];
    ellipsoid(m, c, 0.15, 0.24, 0.3, lod === 0 ? 5 : 3, cols, tw, (p) => (p[1] > c[1] + 0.17 ? SLOTS.ACCENT : SLOTS.ROPE), (p) => 0.8 + 0.15 * Math.sin(p[1] * 60));
  }
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
