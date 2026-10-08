/**
 * people/body.js
 * ----------------------------------------------------------------------------
 * The bodies of the 3D look's people, skinned to the rig (rig.js), in its
 * rest pose: a man (`m`), a woman (`f`) and a child (`c`, built at a man's
 * size and drawn at about three quarters, its head scaled up by the shader).
 *
 *   - the trunk: rings of a rounded section up from the crotch to the neck
 *     (hips, waist, chest, shoulders; a woman's narrower shoulders, wider
 *     hips and bust); mostly under clothes, but bare on a victimarius
 *   - the limbs: tubes along the joints with the muscles' swell (deltoid,
 *     biceps, forearm, thigh, calf), each bone's share blended at the joint
 *   - the hands: a palm, the four fingers as one curling part with grooves
 *     between them, a thumb; the nails
 *   - the feet in sandals: the sole, the straps over the instep and round
 *     the ankle
 *   - the head: a skull and face from one surface (a sphere shaped and
 *     carved: the brow, the eye sockets, the nose with its wings, the lips,
 *     the chin, the cheekbones, the jaw narrowing to the neck), its rows and
 *     columns crowded where the face is; the eyes (white and iris) in their
 *     sockets, the brows in the hair's colour, the ears.
 *
 * Levels of detail: 0 the close look (about 4,000 triangles for the body
 * and head), 1 (about 800), 2 (about 220): the same shapes on fewer rows
 * and columns, the face's carving at 0 and 1 only.
 * ----------------------------------------------------------------------------
 */

import { Mesher, SLOTS, trunkWeights, chainWeights, rigid, weights, smooth } from './mesher.js';
import { BONE, BONES } from './rig.js';

const TAU = Math.PI * 2;
const gauss = (x) => Math.exp(-x * x);

/** Superellipse sign power: a section between an ellipse and a rounded box. */
const sp = (v, n) => Math.sign(v) * Math.abs(v) ** (2 / n);

/** Rows and columns by level of detail. */
const RES = [
  { trunkR: 8, trunkC: 12, limbR: 9, limbC: 8, handC: 8, handR: 3, footR: 7, footC: 8, headR: 20, headC: 28, ear: 5, eye: 6, thumb: true, sandal: true },
  { trunkR: 5, trunkC: 7, limbR: 4, limbC: 5, handC: 4, handR: 1, footR: 3, footC: 4, headR: 9, headC: 10, ear: 0, eye: 0, thumb: false, sandal: true },
  { trunkR: 2, trunkC: 5, limbR: 2, limbC: 3, handC: 3, handR: 1, footR: 2, footC: 3, headR: 4, headC: 6, ear: 0, eye: 0, thumb: false, sandal: false },
];

// ---------------------------------------------------------------------------
// The trunk
// ---------------------------------------------------------------------------

/**
 * The trunk's section at height y for body `kind`: { a: half width, bf:
 * depth ahead of the middle, bb: behind, zc: its middle's z, n: its
 * squareness }. Garments (garments.js) wrap their rings round this.
 */
export function trunkSection(y, kind = 'm') {
  // [y, a, bf, bb, zc]
  const M = [
    [0.8, 0.12, 0.06, 0.075, 0.0], [0.86, 0.158, 0.09, 0.1, 0.0], [0.93, 0.166, 0.098, 0.104, 0.0], [1.0, 0.155, 0.1, 0.092, 0.005],
    [1.06, 0.146, 0.1, 0.088, 0.005], [1.14, 0.152, 0.104, 0.09, 0.0], [1.22, 0.162, 0.112, 0.096, -0.005], [1.3, 0.172, 0.108, 0.1, -0.01],
    [1.36, 0.178, 0.092, 0.098, -0.015], [1.4, 0.165, 0.075, 0.085, -0.015], [1.43, 0.11, 0.058, 0.065, -0.016], [1.46, 0.056, 0.05, 0.05, -0.015],
  ];
  const F = [
    [0.8, 0.13, 0.065, 0.08, 0.0], [0.86, 0.172, 0.092, 0.108, -0.005], [0.93, 0.18, 0.098, 0.11, -0.005], [1.0, 0.162, 0.094, 0.094, 0.0],
    [1.06, 0.128, 0.088, 0.082, 0.005], [1.14, 0.13, 0.092, 0.084, 0.0], [1.22, 0.142, 0.1, 0.088, -0.005], [1.3, 0.15, 0.098, 0.09, -0.01],
    [1.36, 0.158, 0.085, 0.088, -0.015], [1.4, 0.148, 0.07, 0.078, -0.015], [1.43, 0.1, 0.055, 0.06, -0.016], [1.46, 0.05, 0.046, 0.046, -0.015],
  ];
  const C = M.map(([yy, a, bf, bb, zc]) => [yy, a * 0.93, bf * 0.95, bb * 0.95, zc]);
  const T = kind === 'f' ? F : kind === 'c' ? C : M;
  let i = 0;
  while (i < T.length - 2 && T[i + 1][0] < y) i++;
  const [y0, ...a0] = T[i];
  const [y1, ...a1] = T[i + 1];
  const k = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
  const s = k * k * (3 - 2 * k);
  const v = a0.map((q, j) => q + (a1[j] - q) * s);
  return { a: v[0], bf: v[1], bb: v[2], zc: v[3], n: 2.25 };
}

/** A point of the trunk's surface at height y, angle phi (0 ahead, +pi/2 the left side), pushed out `off`. */
export function trunkPoint(y, phi, kind = 'm', off = 0) {
  const s = trunkSection(y, kind);
  const sx = Math.sin(phi);
  const cz = Math.cos(phi);
  let x = (s.a + off) * sp(sx, s.n);
  let z = s.zc + (cz > 0 ? s.bf + off : s.bb + off) * sp(cz, s.n);
  if (kind === 'f' && cz > 0) {
    // The bust: two soft swells ahead of the chest.
    const b = 0.028 * gauss((y - 1.24) / 0.05) * (gauss((x - 0.072) / 0.045) + gauss((x + 0.072) / 0.045));
    z += b * cz;
  }
  if (cz < 0) {
    // The shoulder blades and the buttocks behind; the spine's groove between them.
    z -= 0.008 * gauss((y - 1.3) / 0.06) * (gauss((x - 0.07) / 0.05) + gauss((x + 0.07) / 0.05)) * -cz;
    z += 0.006 * gauss(x / 0.012) * gauss((y - 1.2) / 0.15) * -cz;
  } else {
    // The chest's muscles over the ribs, the belly's softness (a man's).
    if (kind === 'm') z += 0.007 * gauss((y - 1.27) / 0.05) * (gauss((x - 0.07) / 0.05) + gauss((x + 0.07) / 0.05)) * cz;
  }
  return [x, y, z];
}

function trunk(m, kind, R) {
  const rows = R.trunkR;
  const cols = R.trunkC;
  const y0 = 0.8;
  const y1 = 1.47;
  const base = m.grid(rows, cols, (i, j) => {
    const y = y0 + ((y1 - y0) * i) / rows;
    const phi = -Math.PI + (TAU * j) / cols;
    const p = trunkPoint(y, phi, kind);
    return { p, c: [0, y, trunkSection(y, kind).zc], uv: [phi * 0.16, y], w: trunkWeights(p[0], p[1], p[2], { legs: 0.6 }), slot: SLOTS.SKIN, tone: 0.9 + 0.1 * smooth(0.8, 1.0, y) };
  });
  // The crotch closed under the trunk.
  const c = m.vertex([0, y0 - 0.02, 0], [0, y0], weights([['root', 1]]), SLOTS.SKIN, 0.8);
  const ring = [];
  for (let j = 0; j <= cols; j++) ring.push(base + j);
  m.fan(ring, c, true);
}

// ---------------------------------------------------------------------------
// Limbs
// ---------------------------------------------------------------------------

/**
 * A tube along joints `js` (bone indices: the chain's joints at rest), with
 * radius r(u) (u in joints along the chain) and a section squashed by
 * flat(u) (its width across over its depth), from u0 (a dome over the
 * top when below 0) to u1; weights along the chain, blended at its joints;
 * `extra(u)` weights mixed in (the trunk's at the shoulder).
 */
export function limbTube(m, js, { r, flat = () => 1, u0 = 0, u1 = js.length - 1, rows, cols, slot = SLOTS.SKIN, side = 1, tone = () => 1, extra = null, off = 0, along = null, uvScale = 1 }) {
  const P = js.map((b) => BONES[b].at);
  const at = (u) => {
    const i = Math.max(0, Math.min(P.length - 2, Math.floor(u)));
    const f = u - i;
    const a = P[i];
    const b = P[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };
  const dirAt = (u) => {
    const i = Math.max(0, Math.min(P.length - 2, Math.floor(Math.min(u, P.length - 1.001))));
    const a = P[i];
    const b = P[i + 1];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(...d);
    return d.map((q) => q / l);
  };
  const bones = js.slice(0, -1);
  return m.grid(rows, cols, (i, j) => {
    let u = u0 + ((u1 - u0) * i) / rows;
    // Below 0: a dome over the top of the limb (a shoulder's, a hip's), its radius closing.
    let dome = 1;
    let lift = 0;
    if (u < 0) {
      const k = u / u0;
      dome = Math.sqrt(Math.max(0, 1 - k * k));
      lift = -u * 0.05;
      u = 0;
    }
    const c = at(u);
    const d = dirAt(u);
    // The section's axes: across (x-ish) and ahead (z-ish), square to the limb.
    let ax = [1, 0, 0];
    const dot = ax[0] * d[0];
    ax = [ax[0] - dot * d[0], -dot * d[1], -dot * d[2]];
    const al = Math.hypot(...ax);
    ax = ax.map((q) => q / al);
    const bz = [d[1] * ax[2] - d[2] * ax[1], d[2] * ax[0] - d[0] * ax[2], d[0] * ax[1] - d[1] * ax[0]];
    const phi = (TAU * j) / cols;
    const rr = (r(u) + off) * dome;
    const fl = flat(u);
    const sx = Math.sin(phi) * rr * Math.sqrt(fl) * side;
    const sz = Math.cos(phi) * rr / Math.sqrt(fl);
    const p = [c[0] + ax[0] * sx + bz[0] * sz - d[0] * lift, c[1] + ax[1] * sx + bz[1] * sz - d[1] * lift, c[2] + ax[2] * sx + bz[2] * sz - d[2] * lift];
    if (along) along(p, u, phi);
    let w = chainWeights(bones, Math.min(u, bones.length - 0.001));
    if (extra) {
      const e = extra(u, p);
      if (e) w = weights([...w.b.map((b, k) => [b, w.w[k] * (1 - e.k)]), ...e.list.map(([b, q]) => [b, q * e.k])]);
    }
    return { p, c: [c[0] - d[0] * lift, c[1] - d[1] * lift, c[2] - d[2] * lift], uv: [phi * 0.05 * uvScale, -u * 0.3 * uvScale], w, slot: typeof slot === 'function' ? slot(u, phi, p) : slot, tone: tone(u, phi) };
  });
}

/** The arm's radius along it (u: 0 the shoulder, 1 the elbow, 2 the wrist). */
export function armRadius(u, kind) {
  const k = kind === 'f' ? 0.86 : kind === 'c' ? 0.9 : 1;
  const r = u < 1
    ? 0.047 + 0.006 * gauss((u - 0.22) / 0.2) - 0.009 * smooth(0.3, 1, u)
    : 0.036 + 0.006 * gauss((u - 1.28) / 0.22) - 0.009 * smooth(1.3, 2, u);
  return r * k;
}

/** The leg's radius (u: 0 the hip, 1 the knee, 2 the ankle). */
export function legRadius(u, kind) {
  const k = kind === 'f' ? 0.94 : kind === 'c' ? 0.9 : 1;
  const r = u < 1
    ? 0.074 - 0.022 * smooth(0.1, 1, u) + 0.004 * gauss((u - 0.3) / 0.3)
    : 0.05 + 0.01 * gauss((u - 1.32) / 0.2) - 0.016 * smooth(1.4, 2, u);
  return r * k;
}

function arms(m, kind, R) {
  for (const s of [1, -1]) {
    const k = s > 0 ? 'L' : 'R';
    limbTube(m, [BONE[`arm${k}`], BONE[`fore${k}`], BONE[`hand${k}`]], {
      r: (u) => armRadius(u, kind),
      // The forearm flatter toward the wrist.
      flat: (u) => (u > 1 ? 1 + 0.35 * smooth(1, 2, u) : 1),
      u0: -0.22, u1: 2.02, rows: R.limbR, cols: R.limbC, side: s,
      extra: (u) => (u < 0.18 ? { k: smooth(0.18, -0.1, u) * 0.6, list: [[`clav${k}`, 0.5], ['chest', 0.5]] } : null),
      tone: (u, phi) => 0.92 + 0.08 * Math.cos(phi),
    });
  }
}

function legs(m, kind, R) {
  for (const s of [1, -1]) {
    const k = s > 0 ? 'L' : 'R';
    limbTube(m, [BONE[`thigh${k}`], BONE[`shin${k}`], BONE[`foot${k}`]], {
      r: (u) => legRadius(u, kind),
      flat: (u) => (u < 1 ? 1 : 0.92),
      u0: -0.15, u1: 2.0, rows: R.limbR, cols: R.limbC, side: s,
      extra: (u) => (u < 0.15 ? { k: smooth(0.15, -0.1, u) * 0.5, list: [['root', 1]] } : null),
      // The shin's bone ahead, the calf behind.
      along: (p, u, phi) => {
        if (u > 1.05 && u < 1.9) p[2] += 0.006 * Math.max(0, -Math.cos(phi)) * gauss((u - 1.3) / 0.25) * -1;
      },
    });
  }
}

/** The neck: from inside the shoulders up into the head. */
function neck(m, kind, R) {
  const rows = Math.max(2, Math.round(R.limbR / 2));
  const cols = R.limbC;
  const r = kind === 'f' ? 0.047 : kind === 'c' ? 0.048 : 0.056;
  m.grid(rows, cols, (i, j) => {
    const y = 1.41 + (0.16 * i) / rows;
    const phi = -Math.PI + (TAU * j) / cols;
    const z = -0.018 + 0.012 * smooth(1.4, 1.57, y);
    // (Narrower at the top under the jaw; the throat's front.)
    const rr = r * (1 - 0.08 * smooth(1.45, 1.55, y));
    const p = [Math.sin(phi) * rr, y, z + Math.cos(phi) * rr * 0.95];
    const w = weights([['chest', smooth(1.47, 1.41, y)], ['neck', 1], ['head', 1.5 * smooth(1.5, 1.57, y)]]);
    return { p, c: [0, y, z], uv: [phi * 0.05, y], w, slot: SLOTS.SKIN, tone: 0.86 + 0.14 * smooth(1.42, 1.5, y) };
  });
}

// ---------------------------------------------------------------------------
// Hands and feet
// ---------------------------------------------------------------------------

/**
 * A hand at rest (hanging, the palm to the thigh, the thumb ahead): the palm
 * from the wrist to the knuckles, the four fingers as one part (grooved
 * between them close up) on the fingers' bone, the thumb on the hand's.
 */
function hand(m, s, kind, R, lod) {
  const k = s > 0 ? 'L' : 'R';
  const W = BONES[BONE[`hand${k}`]].at;
  const F = BONES[BONE[`fing${k}`]].at;
  const sc = kind === 'f' ? 0.9 : kind === 'c' ? 0.92 : 1;
  const cols = R.handC;
  const rows = R.handR;
  // The palm and the fingers: a rounded flat section (x its thickness, z its width) down from the wrist.
  const len = (W[1] - F[1]) / sc;
  const fing = 0.088;
  const total = len + fing;
  const section = (t, phi) => {
    // t: 0 the wrist, 1 the fingertips.
    const atF = len / total;
    let half = t < atF ? 0.036 + 0.006 * smooth(0, atF, t) : 0.042 - 0.012 * smooth(atF, 1, t);
    let thick = t < atF ? 0.016 - 0.002 * smooth(0, atF, t) : 0.011 - 0.003 * smooth(atF, 1, t);
    // The tips rounded off.
    if (t > 0.9) {
      const q = (t - 0.9) / 0.1;
      half *= Math.sqrt(Math.max(0.02, 1 - q * q * 0.85));
      thick *= Math.sqrt(Math.max(0.05, 1 - q * q * 0.8));
    }
    let x = Math.sin(phi) * thick;
    let z = Math.cos(phi) * half;
    // Grooves between the fingers on both faces (close up).
    if (lod === 0 && t > atF + 0.02) x *= 1 - 0.18 * Math.abs(Math.sin(Math.cos(phi) * Math.PI * 2)) ** 3 * smooth(atF, atF + 0.1, t);
    // The palm's heel thicker at the thumb's side.
    if (t < atF) x *= 1 + 0.25 * Math.max(0, Math.cos(phi)) * (1 - t / atF);
    return [x, z];
  };
  m.grid(rows * 2 + 2, cols, (i, j) => {
    const t = i / (rows * 2 + 2);
    const phi = (TAU * j) / cols;
    const [x, z] = section(t, phi);
    const y = W[1] - t * total * sc;
    // The fingers hang a little ahead of the palm and curve in toward the palm at their tips.
    const curl = 0.012 * smooth(0.5, 1, t);
    const p = [W[0] + s * (x * sc - curl), y, W[2] + 0.01 + z * sc];
    const knuckle = len / total;
    const fw = smooth(knuckle - 0.06, knuckle + 0.06, t);
    const w = weights([[`hand${k}`, 1 - fw], [`fing${k}`, fw]]);
    // The nails on the fingertips' backs (the side away from the palm).
    const nail = lod === 0 && t > 0.88 && t < 0.98 && s * Math.sin(phi) * s > 0.4 && Math.abs(Math.cos(phi)) < 0.85;
    return { p, c: [W[0], y, W[2] + 0.01], uv: [phi * 0.02, t * 0.15], w, slot: nail ? SLOTS.NAIL : SLOTS.SKIN, tone: 0.95 - 0.1 * (t > knuckle ? 0 : 0) };
  });
  if (!R.thumb) return;
  // The thumb: from the palm's front edge, down, ahead and in toward the palm.
  const base = [W[0] + s * 0.004, W[1] - 0.025 * sc, W[2] + 0.038 * sc];
  const tip = [W[0] - s * 0.008, W[1] - 0.075 * sc, W[2] + 0.06 * sc];
  const trows = lod === 0 ? 4 : 2;
  const tcols = Math.max(4, cols - 2);
  const d = [tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]];
  const dl = Math.hypot(...d);
  const dn = d.map((q) => q / dl);
  let ax = [1, 0, 0];
  const dt = dn[0];
  ax = [1 - dt * dn[0], -dt * dn[1], -dt * dn[2]];
  const al = Math.hypot(...ax);
  ax = ax.map((q) => q / al);
  const bz = [dn[1] * ax[2] - dn[2] * ax[1], dn[2] * ax[0] - dn[0] * ax[2], dn[0] * ax[1] - dn[1] * ax[0]];
  m.grid(trows, tcols, (i, j) => {
    const t = i / trows;
    const phi = (TAU * j) / tcols;
    let r = (0.0125 - 0.003 * t) * sc;
    if (t > 0.8) r *= Math.sqrt(Math.max(0.05, 1 - ((t - 0.8) / 0.2) ** 2));
    const c = [base[0] + d[0] * t, base[1] + d[1] * t, base[2] + d[2] * t];
    const sx = Math.sin(phi) * r * s;
    const sz = Math.cos(phi) * r * 1.1;
    const p = [c[0] + ax[0] * sx + bz[0] * sz, c[1] + ax[1] * sx + bz[1] * sz, c[2] + ax[2] * sx + bz[2] * sz];
    return { p, c, uv: [phi * 0.02, t * 0.06], w: rigid(`hand${k}`), slot: SLOTS.SKIN, tone: 0.95 };
  });
}

/**
 * The foot's section at z (from the ankle, ahead +): its half width, its top
 * over the sole; the sole at y 0.005.
 */
function footSection(z, kind) {
  const k = kind === 'f' ? 0.92 : kind === 'c' ? 0.95 : 1;
  const half = (z < 0 ? 0.03 + 0.008 * smooth(-0.065, 0, z) : 0.038 + 0.01 * smooth(0, 0.13, z) - 0.012 * smooth(0.14, 0.2, z)) * k;
  const top = (z < 0.01 ? 0.1 - 0.035 * smooth(-0.02, -0.07, z) : 0.1 - 0.06 * smooth(0.01, 0.13, z) - 0.012 * smooth(0.13, 0.2, z)) * k;
  return { half, top };
}

const FOOT_Z0 = -0.072;
const FOOT_Z1 = 0.2;

/** A point on a foot's surface: z along it, phi round its section (0 the top, pi the sole), `off` outward. */
export function footPoint(s, z, phi, kind = 'm', off = 0) {
  const k = s > 0 ? 'L' : 'R';
  const A = BONES[BONE[`foot${k}`]].at;
  const { half, top } = footSection(z, kind);
  // The ends closed: the heel's back and the toes' tip.
  let squash = 1;
  if (z < FOOT_Z0 + 0.02) squash = Math.sqrt(Math.max(0.03, 1 - ((FOOT_Z0 + 0.02 - z) / 0.02) ** 2));
  if (z > FOOT_Z1 - 0.025) squash = Math.sqrt(Math.max(0.03, 1 - ((z - (FOOT_Z1 - 0.025)) / 0.025) ** 2));
  const c = Math.cos(phi);
  const sn = Math.sin(phi);
  // A flat sole, a rounded top.
  const y = c > 0 ? 0.005 + (top - 0.005) * (0.5 + 0.5 * sp(c, 2.6)) : 0.005 + (top - 0.005) * 0.5 * (1 + sp(c, 6));
  const h = (top - 0.005) * 0.5 + 0.005;
  const yy = h + (y - h) * squash;
  // The big toe's side (inside) a little fuller.
  const x = sp(sn, 2.4) * (half + off) * squash * (1 + 0.08 * (s * sn < 0 ? 1 : 0) * smooth(0.1, 0.16, z));
  return [A[0] + x, yy + (c > 0 ? off : -off * 0.3), A[2] + z];
}

function foot(m, s, kind, R) {
  const k = s > 0 ? 'L' : 'R';
  const rows = R.footR;
  const cols = R.footC;
  const toeZ = BONES[BONE[`toe${k}`]].at[2] - BONES[BONE[`foot${k}`]].at[2];
  m.grid(rows, cols, (i, j) => {
    const z = FOOT_Z0 + ((FOOT_Z1 - FOOT_Z0) * i) / rows;
    const phi = (TAU * j) / cols;
    const p = footPoint(s, z, phi, kind);
    const t = smooth(toeZ - 0.03, toeZ + 0.01, z);
    const A = BONES[BONE[`foot${k}`]].at;
    return { p, c: [A[0], 0.04, A[2] + z], uv: [phi * 0.03, z], w: weights([[`foot${k}`, 1 - t], [`toe${k}`, t]]), slot: SLOTS.SKIN, tone: 0.9 };
  });
}

/** A sandal under a foot: the sole, straps over the instep and the toes, a strap round the ankle. */
export function sandal(m, s, kind, lod) {
  const k = s > 0 ? 'L' : 'R';
  const cols = lod === 0 ? 12 : lod === 1 ? 6 : 4;
  const A = BONES[BONE[`foot${k}`]].at;
  const toeZ = BONES[BONE[`toe${k}`]].at[2] - A[2];
  const fw = (z) => weights([[`foot${k}`, 1 - smooth(toeZ - 0.03, toeZ + 0.01, z)], [`toe${k}`, smooth(toeZ - 0.03, toeZ + 0.01, z)]]);
  // The sole: the foot's outline a few millimetres out, 13 mm thick.
  const rows = lod === 0 ? 10 : 4;
  const outline = (i) => FOOT_Z0 - 0.006 + ((FOOT_Z1 - FOOT_Z0 + 0.016) * i) / rows;
  for (const [y, flip] of [[0.0, true], [0.013, false]]) {
    m.grid(rows, 1, (i, j) => {
      const z = Math.min(FOOT_Z1, Math.max(FOOT_Z0, outline(i)));
      const { half } = footSection(z, kind);
      const end = i === 0 || i === rows ? 0.5 : 1;
      const x = (j ? 1 : -1) * (half + 0.006) * end;
      return { p: [A[0] + x, y, A[2] + outline(i)], uv: [x, outline(i)], w: fw(outline(i)), slot: SLOTS.LEATHER, tone: y ? 0.7 : 0.5 };
    }, { flip: flip !== (s < 0) });
  }
  // The sole's edge.
  m.grid(1, rows * 2 + 1, (i, j) => {
    const side = j <= rows ? 1 : -1;
    const ii = side > 0 ? j : rows * 2 + 1 - j;
    const z = Math.min(FOOT_Z1, Math.max(FOOT_Z0, outline(Math.min(rows, ii))));
    const { half } = footSection(z, kind);
    const end = ii === 0 || ii >= rows ? 0.5 : 1;
    const x = side * (half + 0.006) * end;
    return { p: [A[0] + x, i * 0.013, A[2] + outline(Math.min(rows, ii))], uv: [j * 0.02, i * 0.013], w: fw(z), slot: SLOTS.LEATHER, tone: 0.45 };
  }, { flip: s > 0 });
  if (lod === 2) return;
  // Straps: bands a little proud of the foot, round its top half, at the toes, the instep, the ankle.
  const strap = (z, wdt, over = 1) => {
    m.grid(1, cols, (i, j) => {
      const phi = -Math.PI / 2 * over + (Math.PI * over * j) / cols;
      const p = footPoint(s, z + (i - 0.5) * wdt, phi, kind, 0.0035);
      return { p, c: [A[0], 0.03, A[2] + z], uv: [phi * 0.02, i * wdt], w: fw(z), slot: SLOTS.LEATHER, tone: 0.75 };
    });
  };
  strap(0.13, 0.012);
  strap(0.06, 0.016);
  strap(0.0, 0.014, 1.15);
  if (lod === 0) {
    // The thong between the big toe and the next, up to the instep strap.
    strap(0.095, 0.008, 0.35);
  }
}

// ---------------------------------------------------------------------------
// The head
// ---------------------------------------------------------------------------

/** The head's middle at rest. */
export const HEAD_C = Object.freeze([0, 1.6, 0.014]);

/**
 * The face's shape by body kind: the brow's ridge, the nose's length and
 * reach, the lips' fullness, the jaw's width, the chin.
 */
const FACE = {
  m: { brow: 0.006, nose: 1, lips: 1, jaw: 1, chin: 1, cheek: 1 },
  f: { brow: 0.0025, nose: 0.82, lips: 1.2, jaw: 0.86, chin: 0.85, cheek: 1.1 },
  c: { brow: 0.002, nose: 0.7, lips: 1.05, jaw: 0.84, chin: 0.8, cheek: 1.15 },
};

/**
 * A point of the head's surface in direction (theta from the crown, phi
 * round from the face, +pi/2 the left), pushed out `off` (hair, a veil),
 * with the face carved (`carve` 0 none, 1 the shapes): [x, y, z] and
 * which feature it is on ('lips', 'brow' or null).
 */
export function headPoint(theta, phi, kind = 'm', off = 0, carve = 1) {
  const F = FACE[kind];
  const dx = Math.sin(theta) * Math.sin(phi);
  const dy = Math.cos(theta);
  const dz = Math.sin(theta) * Math.cos(phi);
  // An egg: rounder over the crown, longer down to the jaw.
  const ry = dy > 0 ? 0.093 : 0.105;
  let x = 0.0745 * dx;
  let y = ry * dy;
  let z = 0.094 * dz;
  // The skull behind (the occiput's swell), the forehead's slope.
  if (dz < 0) z *= 1 + 0.06 * gauss((dy - 0.25) / 0.35);
  // The jaw narrowing toward the chin; the lower back drawn in toward the neck.
  const low = smooth(-0.05, -0.85, dy);
  x *= 1 - 0.2 * low * F.jaw ** -0.5 * (kind === 'm' ? 0.85 : 1);
  if (dz < 0) z *= 1 - 0.42 * smooth(-0.15, -0.8, dy);
  // The face a little flatter than the skull's sphere, the cheeks' sides.
  if (dz > 0) z *= 1 - 0.06 * smooth(0.6, 1, dz) * (1 - low);
  let feature = null;
  if (carve && dz > 0.15) {
    const fy = y;
    const fx = x;
    const ax = Math.abs(fx);
    const front = smooth(0.15, 0.55, dz);
    let dzf = 0;
    // The eye sockets.
    dzf -= 0.0085 * gauss(Math.hypot((ax - 0.031) / 0.017, (fy - 0.014) / 0.012)) * front;
    // The brow's ridge over them.
    dzf += F.brow * gauss(Math.hypot((ax - 0.028) / 0.028, (fy - 0.034) / 0.008)) * front;
    // The nose: the bridge from between the eyes to the tip, wider at its wings.
    const ny = (0.018 - fy) / 0.05 / F.nose;
    if (ny > -0.2 && ny < 1.35) {
      const k = Math.min(1, Math.max(0, ny));
      // (Low at the bridge between the eyes, rising to the tip: not a ridge from the brow.)
      const reach = (0.002 + 0.019 * k ** 1.7) * F.nose * (ny > 1 ? Math.max(0, 1 - (ny - 1) / 0.35) ** 0.6 : 1);
      const wide = 0.009 + 0.007 * k ** 2;
      dzf += reach * gauss(fx / wide) * front;
      // The wings of the nostrils at its foot.
      dzf += 0.0075 * F.nose * gauss(Math.hypot((ax - 0.014) / 0.007, (fy + 0.028 * F.nose + 0.006) / 0.006)) * front;
    }
    // Under the nose: the groove down to the lip (philtrum) and the lips.
    const my = -0.058;
    dzf += 0.0052 * F.lips * gauss(Math.hypot(fx / 0.02, (fy - my - 0.0055) / 0.0045)) * front;
    dzf += 0.0058 * F.lips * gauss(Math.hypot(fx / 0.018, (fy - my + 0.0075) / 0.0052)) * front;
    dzf -= 0.003 * gauss(Math.hypot(fx / 0.02, (fy - my + 0.0005) / 0.0017)) * front;
    // The corners of the mouth set in.
    dzf -= 0.003 * gauss(Math.hypot((ax - 0.022) / 0.006, (fy - my) / 0.006)) * front;
    // The chin.
    dzf += 0.007 * F.chin * gauss(Math.hypot(fx / 0.022, (fy + 0.092) / 0.014)) * front;
    // The cheekbones.
    dzf += 0.004 * F.cheek * gauss(Math.hypot((ax - 0.046) / 0.016, (fy + 0.004) / 0.014)) * front;
    // Below them the cheek eases in a little (a man's).
    if (kind === 'm') dzf -= 0.002 * gauss(Math.hypot((ax - 0.042) / 0.014, (fy + 0.045) / 0.02)) * front;
    z += dzf * carve;
    if (Math.hypot(fx / 0.021, (fy - my) / 0.012) < 1 && dzf > 0.0012) feature = 'lips';
    if (ax > 0.012 && ax < 0.05 && fy > 0.028 && fy < 0.041 - 0.006 * smooth(0.03, 0.05, ax)) feature = 'brow';
  }
  // Pushed out along the direction (hair, a hood).
  if (off) {
    const l = Math.hypot(x, y, z) || 1;
    x += (x / l) * off;
    y += (y / l) * off;
    z += (z / l) * off;
  }
  return { p: [HEAD_C[0] + x, HEAD_C[1] + y, HEAD_C[2] + z], feature };
}

/**
 * The rows' and columns' angles of the head's grid, crowded where the face
 * is (theta about 1.1 to 2.5, phi about 0) and sparse behind: the same
 * triangles give the nose and lips several rows each.
 */
export function headAngles(rows, cols, crowd = 0.5) {
  const th = [];
  const c = 1.78;
  const s0 = Math.sin(2 * (0 - c));
  for (let i = 0; i <= rows; i++) {
    const s = (Math.PI * i) / rows;
    th.push(s - (crowd / 2) * (Math.sin(2 * (s - c)) - s0));
  }
  const ph = [];
  for (let j = 0; j <= cols; j++) {
    const s = -Math.PI + (TAU * j) / cols;
    // (phi = s - a sin s: crowded about 0, the face; sparse behind.)
    ph.push(s - crowd * 1.1 * Math.sin(s) * 0.85);
  }
  return { th, ph };
}

/** The head's weights: the head's bone, the neck's at its foot. */
export function headWeights(y) {
  const k = smooth(1.5, 1.545, y);
  return weights([['head', k], ['neck', 1 - k]]);
}

function head(m, kind, R, lod) {
  const rows = R.headR;
  const cols = R.headC;
  const { th, ph } = headAngles(rows, cols, lod === 2 ? 0 : 0.5);
  const carve = lod === 2 ? 0 : 1;
  m.grid(rows, cols, (i, j) => {
    // (The crown's row a single point; the bottom's under the jaw, inside the neck.)
    const theta = Math.max(0.001, Math.min(Math.PI - 0.001, th[i]));
    const { p, feature } = headPoint(theta, ph[j], kind, 0, carve);
    const slot = feature === 'lips' ? SLOTS.LIPS : feature === 'brow' ? SLOTS.BROW : SLOTS.SKIN;
    // Darker in the eye sockets and under the brow, the ears' shade; lighter on the nose's ridge.
    const tone = 0.92 + 0.08 * Math.cos(ph[j]) * Math.sin(theta);
    return { p, c: HEAD_C, uv: [ph[j] * 0.05, -theta * 0.05], w: headWeights(p[1]), slot, tone };
  });
  if (R.eye) eyes(m, kind, R);
  if (R.ear) ears(m, kind, R);
  else if (lod === 1) earsLow(m, kind);
}

/** The eyes in their sockets: a white ball, the iris and pupil where it looks out (ahead). */
function eyes(m, kind, R) {
  const n = R.eye;
  for (const s of [1, -1]) {
    // Where the socket's floor is: the ball sits in it, its front just behind the lids' line.
    const c = [HEAD_C[0] + s * 0.031, HEAD_C[1] + 0.012, HEAD_C[2] + 0.0645];
    const r = 0.0122;
    m.grid(n, n + 2, (i, j) => {
      const theta = (Math.PI * i) / n;
      const phi = (TAU * j) / (n + 2);
      const d = [Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi)];
      // Looking straight ahead, a hair inward (the eyes converge on what is before them).
      const look = d[2] * 0.995 - d[0] * s * 0.1;
      const slot = look > 0.82 ? SLOTS.IRIS : SLOTS.EYE;
      // (The upper lid's shadow over the ball's top: the eye reads under its brow, not staring.)
      const lid = d[1] > 0.35 ? 0.45 : 1;
      return { p: [c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r], c, uv: [0, 0], w: rigid('head'), slot, tone: (look > 0.96 ? 0.35 : 1) * lid };
    });
  }
}

/** The ears: a curled shell, its rim, standing out a little behind the cheek. */
function ears(m, kind, R) {
  const n = R.ear;
  const sc = kind === 'm' ? 1 : 0.9;
  for (const s of [1, -1]) {
    const c = [HEAD_C[0] + s * 0.068, HEAD_C[1] + 0.0, HEAD_C[2] - 0.012];
    m.grid(n, n, (i, j) => {
      const u = i / n;
      const v = j / n;
      // An oval leaf, its rim rolled forward, hollow in its bowl.
      const a = (u - 0.5) * 2;
      const b = (v - 0.5) * 2;
      const rr = Math.hypot(a, b);
      const h = 0.026 * sc;
      const w = 0.0145 * sc;
      const cup = 0.004 * (1 - Math.min(1, rr) ** 2) - 0.003 * Math.max(0, rr - 0.75) * 4;
      const y = a * h * (1 - 0.15 * Math.abs(b));
      const z = b * w - 0.004 * a;
      const x = s * (0.004 + 0.006 * (b + 1) * 0.5 - cup) ;
      return { p: [c[0] + x, c[1] + y - 0.004, c[2] + z], uv: [0, 0], w: rigid('head'), slot: SLOTS.SKIN, tone: 0.82 + 0.1 * rr };
    }, { flip: s < 0 });
    // Its back, so it is not see-through from behind.
    m.grid(n, n, (i, j) => {
      const a = (i / n - 0.5) * 2;
      const b = (j / n - 0.5) * 2;
      const h = 0.026 * sc;
      const w = 0.0145 * sc;
      const y = a * h * (1 - 0.15 * Math.abs(b));
      const z = b * w - 0.004 * a;
      const x = s * (0.0 + 0.004 * (b + 1) * 0.5);
      return { p: [c[0] + x, c[1] + y - 0.004, c[2] + z], uv: [0, 0], w: rigid('head'), slot: SLOTS.SKIN, tone: 0.75 };
    }, { flip: s > 0 });
  }
}

/** Far out the ears are a fin each side. */
function earsLow(m, kind) {
  const sc = kind === 'm' ? 1 : 0.9;
  for (const s of [1, -1]) {
    const c = [HEAD_C[0] + s * 0.072, HEAD_C[1] - 0.004, HEAD_C[2] - 0.012];
    const pts = [[0, 0.03 * sc, -0.004], [0.008 * s, 0.0, 0.012 * sc], [0, -0.028 * sc, 0.006], [0.004 * s, 0.0, -0.016 * sc]];
    const ids = pts.map((q) => m.vertex([c[0] + q[0], c[1] + q[1], c[2] + q[2]], [0, 0], rigid('head'), SLOTS.SKIN, 0.85));
    m.tri(ids[0], ids[1], ids[2]);
    m.tri(ids[0], ids[2], ids[3]);
    m.tri(ids[0], ids[2], ids[1]);
    m.tri(ids[0], ids[3], ids[2]);
  }
}

// ---------------------------------------------------------------------------
// A whole body
// ---------------------------------------------------------------------------

/** The body of `kind` ('m', 'f', 'c') at level `lod`: a Mesher (pieces.js builds it). */
export function buildBody(kind = 'm', lod = 0) {
  const R = RES[lod];
  const m = new Mesher();
  trunk(m, kind, R);
  neck(m, kind, R);
  arms(m, kind, R);
  legs(m, kind, R);
  for (const s of [1, -1]) {
    hand(m, s, kind, R, lod);
    foot(m, s, kind, R);
    if (R.sandal) sandal(m, s, kind, lod);
  }
  head(m, kind, R, lod);
  return m;
}

export { RES, gauss, TAU, sp };
