/**
 * walkers/beasts.js
 * ----------------------------------------------------------------------------
 * The walkers' animals and vehicles, drawn in the people's material as rigid
 * pieces (walkers/material.js): their vertices name a hinge instead of bones,
 * so a cart's wheels roll with the ground it covers and a beast's legs step
 * with it, on the GPU, from one texel of distance a figure.
 *
 *   beast:mule[:pack]   the Roman mule (mulus) of the pack trains: about
 *                       1.3 m at the withers, long ears, a roached mane, a
 *                       tufted tail; a pack saddle and two wicker panniers
 *                       heaped with the goods (their colour the accent)
 *   beast:horse[:trot]  a small Roman horse, about 1.45 m, a bridle and a
 *                       breast strap; trotting for a chariot
 *   beast:ox            a draught ox of the Italian grey breeds, lyre horns,
 *                       a dewlap, the yoke on its neck
 *   cart:handcart       a two-wheeled handcart, its shafts its handles (held
 *                       where the push clip puts the hands: clips.js HANDCART)
 *   cart:wagon          a farm's plaustrum: solid plank wheels, a wicker body,
 *                       the pole to the ox's yoke
 *   cart:chariot        a racing chariot (biga): the light car with its
 *                       breastwork in the faction's colour, spoked wheels,
 *                       the pole, the yoke on the two horses, the reins
 *   rope                a lead rope from the hand (its own origin) one metre
 *                       ahead, sagging: stretched to reach the halter
 *
 * Coats: a beast's coat is its instance's skin colour (smooth, unwoven), its
 * mane and tail the hair's; the dark points (legs, muzzle) a shade of it.
 * Metres, standing on y 0, facing +z, the body's middle over the origin (a
 * vehicle's: see each).
 * ----------------------------------------------------------------------------
 */

import { Mesher, SLOTS } from '../people/mesher.js';

const TAU = Math.PI * 2;
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Hinge weights (walkers/material.js): none, a wheel's, a leg's upper and lower part, the neck's nod. */
const STILL = Object.freeze({ b: [0, 0, 0, 0], w: [1, 0, 0, 0] });
const wheelW = (y, z) => ({ b: [1, 0, 0, 0], w: [1, y, z, 0] });
const upperW = (n, hip, amp) => ({ b: [2 + n, 0, 0, 0], w: [1, hip[0], hip[1], amp] });
const lowerW = (n, hip, knee, amp) => ({ b: [6 + n, Math.round(hip[0] * 100), Math.round(hip[1] * 100) + 128, 0], w: [1, knee[0], knee[1], amp] });
const nodW = (withers, amp) => ({ b: [10, 0, 0, 0], w: [1, withers[0], withers[1], amp] });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nrm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * A tube along points `pts`, radius r(i) at each (its section `fx` wide and
 * `fy` deep of that), `seg` round, closed at the ends by domes when `caps`.
 * `w(i)` its weights, `slot(i)`, `tone(i, phi)`.
 */
function tube(m, pts, r, { seg = 8, fx = 1, fy = 1, w = () => STILL, slot = () => SLOTS.SKIN, tone = () => 1, caps = true, up = null } = {}) {
  const n = pts.length;
  const R = typeof r === 'function' ? r : (i) => r;
  const W = typeof w === 'function' ? w : () => w;
  const S = typeof slot === 'function' ? slot : () => slot;
  const frames = pts.map((p, i) => {
    const d = nrm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
    const ref = up || (Math.abs(d[1]) > 0.8 ? [0, 0, 1] : [0, 1, 0]);
    const a = nrm(cross(ref, d));
    const b = cross(d, a);
    return { d, a, b };
  });
  // Rows: a dome before the first point, the points, a dome after the last.
  const rows = [];
  const DOME = caps ? 2 : 0;
  for (let k = DOME; k > 0; k--) rows.push({ i: 0, s: Math.cos((Math.PI / 2) * (k / (DOME + 0.5))), out: -Math.sin((Math.PI / 2) * (k / (DOME + 0.5))) });
  for (let i = 0; i < n; i++) rows.push({ i, s: 1, out: 0 });
  for (let k = 1; k <= DOME; k++) rows.push({ i: n - 1, s: Math.cos((Math.PI / 2) * (k / (DOME + 0.5))), out: Math.sin((Math.PI / 2) * (k / (DOME + 0.5))) });
  m.grid(rows.length - 1, seg, (ri, j) => {
    const { i, s, out } = rows[ri];
    const f = frames[i];
    const rr = R(i);
    const phi = (TAU * j) / seg;
    const ca = Math.cos(phi) * rr * fx * s;
    const sb = Math.sin(phi) * rr * fy * s;
    const c = pts[i];
    const o = out * rr * 0.9;
    const p = [c[0] + f.a[0] * ca + f.b[0] * sb + f.d[0] * o, c[1] + f.a[1] * ca + f.b[1] * sb + f.d[1] * o, c[2] + f.a[2] * ca + f.b[2] * sb + f.d[2] * o];
    return { p, c, uv: [phi * 0.05, i * 0.1], w: W(i), slot: S(i), tone: tone(i, phi) };
  });
}

/** A box about c, w x h x d, turned `ry` about y. */
function box(m, c, w, h, d, slot, wt = STILL, tone = 1, ry = 0) {
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const corner = (x, y, z) => {
    const lx = (x * w) / 2;
    const lz = (z * d) / 2;
    return [c[0] + cy * lx + sy * lz, c[1] + (y * h) / 2, c[2] - sy * lx + cy * lz];
  };
  const faces = [
    [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]],
    [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]],
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
  ];
  for (const f of faces) {
    const ids = f.map((q) => m.vertex(corner(...q), [q[0] * w + q[2] * d, q[1] * h], wt, slot, tone));
    m.tri(ids[0], ids[1], ids[2]);
    m.tri(ids[0], ids[2], ids[3]);
  }
}

/** A lumpy dome of goods (a pannier's heap): base centre c, radius r, height h. */
function heap(m, c, r, h, seg, slot, wt = STILL) {
  const rows = Math.max(2, seg >> 1);
  m.grid(rows, seg, (i, j) => {
    const th = (Math.PI / 2) * (i / rows);
    const ph = (TAU * j) / seg;
    const lump = 1 + 0.1 * Math.sin(ph * 4 + i * 1.7);
    const rr = r * Math.cos(th) * lump;
    return { p: [c[0] + Math.cos(ph) * rr, c[1] + h * Math.sin(th), c[2] + Math.sin(ph) * rr], c: [c[0], c[1] - 0.05, c[2]], uv: [ph * 0.1, th], w: wt, slot, tone: 0.75 + 0.3 * Math.sin(th) };
  });
}

// ---------------------------------------------------------------------------
// Beasts
// ---------------------------------------------------------------------------

/**
 * Each beast's build, metres: the barrel (its length from rump to chest, its
 * middle's height, half its depth and width), the legs (their tops, x apart,
 * where the front and hind stand, knee heights), the neck and head (points
 * from the withers to the muzzle with radii), ears, mane and tail; the gaits'
 * swings (rad: the upper leg, the knee).
 */
const BEASTS = {
  mule: {
    len: 1.15, y: 0.98, H: 0.27, W: 0.23, legTop: 0.95, legX: 0.125, front: 0.36, hind: -0.42, knee: [0.44, 0.5],
    neck: [[0, 1.08, 0.36], [0, 1.27, 0.62], [0, 1.42, 0.84]], neckR: [0.17, 0.12, 0.09],
    head: [[0, 1.45, 0.9], [0, 1.33, 1.1], [0, 1.17, 1.27]], headR: [0.1, 0.085, 0.066],
    ears: 0.27, mane: 'roach', tail: [[0, 1.16, -0.6], [0, 0.95, -0.7], [0, 0.66, -0.72]], tailR: 0.032, tuft: 0.2,
    legR: [0.075, 0.042], hoof: 0.05, swing: { walk: [0.32, 0.55], trot: [0.42, 0.85] },
  },
  horse: {
    len: 1.3, y: 1.08, H: 0.29, W: 0.24, legTop: 1.05, legX: 0.13, front: 0.42, hind: -0.48, knee: [0.5, 0.56],
    neck: [[0, 1.2, 0.42], [0, 1.45, 0.68], [0, 1.66, 0.88]], neckR: [0.19, 0.13, 0.095],
    head: [[0, 1.7, 0.94], [0, 1.56, 1.16], [0, 1.37, 1.36]], headR: [0.105, 0.09, 0.068],
    ears: 0.13, mane: 'long', tail: [[0, 1.3, -0.68], [0, 1.08, -0.84], [0, 0.6, -0.9]], tailR: 0.06, tuft: 0,
    legR: [0.085, 0.045], hoof: 0.055, swing: { walk: [0.34, 0.6], trot: [0.46, 0.95] },
  },
  ox: {
    len: 1.5, y: 0.95, H: 0.37, W: 0.31, legTop: 0.9, legX: 0.17, front: 0.5, hind: -0.55, knee: [0.4, 0.45],
    neck: [[0, 1.0, 0.55], [0, 1.04, 0.78], [0, 1.02, 0.94]], neckR: [0.25, 0.21, 0.17],
    head: [[0, 1.02, 0.98], [0, 0.86, 1.22], [0, 0.7, 1.38]], headR: [0.135, 0.12, 0.095],
    ears: 0.12, mane: null, tail: [[0, 1.18, -0.75], [0, 0.9, -0.82], [0, 0.42, -0.8]], tailR: 0.028, tuft: 0.18,
    legR: [0.1, 0.055], hoof: 0.06, swing: { walk: [0.26, 0.45], trot: [0.26, 0.45] }, horns: true, dewlap: true, hump: 0.06,
  },
};

/** How far a beast's gait carries it a cycle (metres): its legs' cycle follows the distance covered. */
export const BEAST_STRIDE = Object.freeze({ mule: 1.6, horse: 1.8, 'horse:trot': 2.6, ox: 1.5 });

/** The beast `kind` ('mule', 'horse', 'ox'), `opts` its key's options (pack, trot, yoke), at `lod`. */
export function buildBeast(kind, opts, lod) {
  const B = BEASTS[kind];
  const m = new Mesher();
  const seg = [14, 8, 5][lod];
  const st = [16, 8, 5][lod];
  const gait = opts.has('trot') ? 'trot' : 'walk';
  const [swing, kneeAmp] = B.swing[gait];
  const L = B.len;
  // The barrel: sections from the rump to the chest, rounded at both ends; the back dips behind the withers.
  const at = (t) => {
    const z = -L / 2 + L * t;
    const env = Math.sin(Math.PI * (0.04 + 0.92 * t)) ** 0.42;
    const chest = smooth(0.55, 0.9, t);
    const h = B.H * env * (1 + 0.08 * chest);
    const w = B.W * env * (1 - 0.06 * chest + 0.05 * smooth(0.0, 0.2, t) * (1 - smooth(0.2, 0.4, t)));
    const yc = B.y + 0.03 * smooth(0.6, 0.95, t) - 0.02 * smooth(0.3, 0.55, t) * (1 - smooth(0.55, 0.75, t)) + (B.hump || 0) * Math.exp(-(((t - 0.78) / 0.08) ** 2));
    return { z, h, w, yc };
  };
  m.grid(st, seg, (i, j) => {
    const t = i / st;
    const s = at(t);
    const phi = (TAU * j) / seg;
    // (The belly a little flatter than the back.)
    const sy = Math.sin(phi);
    const y = s.yc + sy * s.h * (sy < 0 ? 0.92 : 1);
    const p = [Math.cos(phi) * s.w, y, s.z];
    // Lighter under the belly, darker along the back.
    return { p, c: [0, s.yc, s.z], uv: [phi * 0.2, s.z], w: STILL, slot: SLOTS.SKIN, tone: 0.84 + 0.16 * (0.5 - 0.5 * sy) };
  });
  // Close the ends.
  for (const t of [0, 1]) {
    const s = at(t);
    const c = m.vertex([0, s.yc, s.z + (t ? 0.01 : -0.01)], [0, 0], STILL, SLOTS.SKIN, 0.85);
    const ring = [];
    for (let j = 0; j <= seg; j++) {
      const phi = (TAU * j) / seg;
      ring.push(m.vertex([Math.cos(phi) * s.w, s.yc + Math.sin(phi) * s.h, s.z], [0, 0], STILL, SLOTS.SKIN, 0.85));
    }
    m.fan(ring, c, t === 0);
  }
  // The neck and head nod together about the withers.
  const withers = [B.neck[0][1], B.neck[0][2]];
  const nod = nodW(withers, gait === 'trot' ? 0.05 : 0.04);
  tube(m, B.neck, (i) => B.neckR[i], { seg, fx: 0.72, fy: 1.15, w: nod, tone: (i, phi) => 0.85 + 0.1 * Math.sin(phi) });
  tube(m, B.head, (i) => B.headR[i], { seg, fx: kind === 'ox' ? 0.95 : 0.72, fy: 1.05, w: nod, tone: (i) => (i === 2 ? 0.55 : 0.88) });
  const poll = B.head[0];
  const muzzle = B.head[2];
  if (lod < 2) {
    // The eyes, the nostrils.
    const eye = [poll[1] + (muzzle[1] - poll[1]) * 0.3, poll[2] + (muzzle[2] - poll[2]) * 0.3];
    for (const s of [1, -1]) {
      tube(m, [[s * B.headR[0] * 0.66, eye[0] + 0.02, eye[1] - 0.005], [s * B.headR[0] * 0.74, eye[0] + 0.02, eye[1] + 0.005]], 0.017, { seg: 5, w: nod, slot: SLOTS.DARK, up: [0, 1, 0] });
      tube(m, [[s * 0.03, muzzle[1] - 0.005, muzzle[2] + 0.04], [s * 0.032, muzzle[1] - 0.01, muzzle[2] + 0.062]], 0.012, { seg: 4, w: nod, slot: SLOTS.DARK });
    }
  }
  // Ears.
  for (const s of [1, -1]) {
    const base = [s * 0.055, poll[1] + 0.06, poll[2] - 0.02];
    const tip = kind === 'ox'
      ? [s * (0.06 + B.ears), poll[1] - 0.0, poll[2] - 0.03]
      : [s * (0.08 + B.ears * 0.2), poll[1] + 0.06 + B.ears * 0.95, poll[2] - 0.06 - B.ears * 0.25];
    const mid = [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2];
    tube(m, [base, mid, tip], (i) => [0.035, 0.03, 0.006][i] * (kind === 'mule' ? 1.15 : 1), { seg: Math.max(4, seg >> 1), fx: 1, fy: 0.55, w: nod, tone: () => 0.8 });
  }
  // Horns: out, then up and forward (the lyre of the grey oxen), pale, darker tips.
  if (B.horns) {
    for (const s of [1, -1]) {
      const pts = [[s * 0.08, poll[1] + 0.07, poll[2] + 0.02], [s * 0.24, poll[1] + 0.12, poll[2] + 0.0], [s * 0.33, poll[1] + 0.26, poll[2] + 0.04], [s * 0.3, poll[1] + 0.38, poll[2] + 0.1]];
      tube(m, pts, (i) => [0.04, 0.032, 0.022, 0.008][i], { seg: Math.max(4, seg >> 1), w: nod, slot: SLOTS.PAPYRUS, tone: (i) => (i === 3 ? 0.45 : 0.95) });
    }
  }
  // The dewlap: a fold of skin hanging under the neck.
  if (B.dewlap && lod < 2) {
    const n = lod === 0 ? 6 : 3;
    for (const face of [1, -1]) {
      m.grid(n, 1, (i, j) => {
        const u = i / n;
        const top = [B.neck[0][1] - 0.18 + 0.12 * u, 0.5 + 0.48 * u];
        const y = top[0] - j * (0.16 * Math.sin(Math.PI * (0.15 + 0.7 * u)));
        return { p: [face * 0.02, y, top[1] + (1 - j) * 0], c: [-face, y, top[1]], uv: [u, j], w: nod, slot: SLOTS.SKIN, tone: 0.8 };
      }, { flip: face < 0 });
    }
  }
  // The mane: a roached crest (a mule's) or a long fall to one side (a horse's).
  if (B.mane && lod < 2) {
    const pts = B.neck.map((p, i) => [B.mane === 'long' ? -0.03 : 0, p[1] + B.neckR[i] * 1.05, p[2] - 0.04]);
    pts.push([0, poll[1] + 0.09, poll[2] + 0.02]);
    tube(m, pts, (i) => (B.mane === 'long' ? [0.05, 0.05, 0.045, 0.03] : [0.035, 0.035, 0.03, 0.02])[i], { seg: Math.max(4, seg >> 1), fx: B.mane === 'long' ? 0.8 : 0.4, fy: B.mane === 'long' ? 1.5 : 1.2, w: nod, slot: SLOTS.HAIR, tone: () => 0.9 });
  }
  // The tail, its tuft or its full fall.
  tube(m, B.tail, B.tailR, { seg: Math.max(4, seg >> 1), slot: B.tuft ? SLOTS.SKIN : SLOTS.HAIR, tone: () => 0.75 });
  if (B.tuft) {
    const end = B.tail[B.tail.length - 1];
    tube(m, [end, [end[0], end[1] - B.tuft * 0.5, end[2] - 0.01], [end[0], end[1] - B.tuft, end[2] - 0.02]], (i) => [0.04, 0.055, 0.02][i], { seg: Math.max(4, seg >> 1), slot: SLOTS.HAIR, tone: () => 0.6 });
  }
  // The legs: the upper part swung about its top, the lower bent at the knee; dark points, the hooves.
  const legs = [[1, B.front], [-1, B.front], [1, B.hind], [-1, B.hind]];
  legs.forEach(([s, z], n) => {
    const fore = n < 2;
    const hip = [B.legTop, z];
    const kneeY = fore ? B.knee[0] : B.knee[1];
    // A hind leg's hock is behind its top, its cannon slanting forward to the hoof.
    const knee = [kneeY, z + (fore ? 0.015 : -0.07)];
    const hoof = [0, z + (fore ? 0.02 : -0.01)];
    const x = s * B.legX;
    const up = upperW(n, hip, swing);
    const lo = lowerW(n, hip, knee, fore ? kneeAmp : -kneeAmp * 0.8);
    const seg4 = Math.max(4, seg - 4);
    // (The upper part rises into the body: the thigh's and the shoulder's mass.)
    tube(m, [[x, hip[0] + 0.12, hip[1]], [x * 1.05, (hip[0] + knee[0]) / 2 + 0.05, (hip[1] + knee[1]) / 2], [x, knee[0] - 0.03, knee[1]]],
      (i) => [B.legR[0] * 1.6, B.legR[0], B.legR[1] * 1.1][i], { seg: seg4, fx: 0.8, fy: 1.2, w: up, tone: (i) => (i === 2 ? 0.72 : 0.85), caps: false });
    tube(m, [[x, knee[0] + 0.04, knee[1]], [x, knee[0] - 0.02, knee[1]], [x, B.hoof + 0.09, hoof[1]], [x, B.hoof + 0.04, hoof[1] + 0.01]],
      (i) => [B.legR[1] * 1.15, B.legR[1], B.legR[1] * 0.85, B.legR[1] * 1.05][i], { seg: seg4, w: lo, tone: (i) => (kind === 'ox' ? 0.8 : 0.5 + 0.12 * (i < 2 ? 1 : 0)) });
    tube(m, [[x, B.hoof, hoof[1] + 0.012], [x, 0.002, hoof[1] + 0.02]], B.hoof, { seg: seg4, w: lo, slot: SLOTS.DARK, caps: true });
  });
  // Tack.
  if (kind === 'horse' || kind === 'mule') {
    if (lod < 2) {
      // The bridle: the noseband and the strap behind the ears.
      for (const [k, rr] of [[0.75, 0.075], [0.08, 0.1]]) {
        const c = [0, poll[1] + (muzzle[1] - poll[1]) * k, poll[2] + (muzzle[2] - poll[2]) * k];
        tube(m, ringPts(c, [0, muzzle[1] - poll[1], muzzle[2] - poll[2]], rr * (k > 0.5 ? 0.95 : 1.1), 10), 0.01, { seg: 3, w: nod, slot: SLOTS.LEATHER, caps: false });
      }
    }
  }
  if (opts.has('trot') && lod < 2) {
    // A chariot horse's breast strap and the yoke saddle at the withers.
    tube(m, ringPts([0, B.y + 0.05, L / 2 - 0.12], [0, 0.35, 1], B.W * 1.05, 12), 0.02, { seg: 3, slot: SLOTS.LEATHER, caps: false });
    box(m, [0, B.y + B.H + 0.04, L / 2 - 0.25], B.W * 1.6, 0.06, 0.14, SLOTS.LEATHER, STILL, 0.8);
  }
  if (opts.has('pack')) {
    // The pack saddle on a blanket, a wicker pannier each side heaped with the goods (the accent's colour).
    const top = B.y + B.H;
    box(m, [0, top + 0.01, -0.02], B.W * 2.1, 0.05, 0.6, SLOTS.MANTLE, STILL, 0.8);
    box(m, [0, top + 0.09, -0.02], 0.12, 0.12, 0.5, SLOTS.WOOD, STILL, 0.7);
    for (const s of [1, -1]) {
      const c = [s * (B.W + 0.12), top - 0.08, -0.02];
      tube(m, [[c[0], c[1] - 0.2, c[2]], [c[0], c[1] + 0.08, c[2]]], 0.16, { seg: Math.max(5, seg - 4), fx: 0.7, slot: SLOTS.ROPE, tone: () => 0.85, up: [0, 0, 1] });
      heap(m, [c[0], c[1] + 0.1, c[2]], 0.13, 0.1, Math.max(5, seg - 4), SLOTS.ACCENT);
    }
    // The girth under the belly.
    tube(m, ringPts([0, B.y, -0.02], [0, 0, 1], B.W * 1.02, 12, B.H * 1.02), 0.018, { seg: 3, slot: SLOTS.LEATHER, caps: false });
  }
  if (opts.has('yoke')) {
    // The yoke across the neck before the withers, its bows round it.
    const n0 = B.neck[1];
    tube(m, [[-0.45, n0[1] + 0.2, n0[2] - 0.05], [0, n0[1] + 0.26, n0[2] - 0.05], [0.45, n0[1] + 0.2, n0[2] - 0.05]], 0.05, { seg: Math.max(5, seg - 4), slot: SLOTS.WOOD, w: STILL });
    if (lod < 2) tube(m, ringPts([0, n0[1], n0[2] - 0.05], [0, 0, 1], B.neckR[1] * 0.9, 10, B.neckR[1] * 1.25), 0.016, { seg: 3, slot: SLOTS.WOOD, caps: false, w: nod });
  }
  return m;
}

/** Points round a ring about centre c square to `axis`, radius r (and rv the other way), closed. */
function ringPts(c, axis, r, n, rv = r) {
  const d = nrm(axis);
  const ref = Math.abs(d[1]) > 0.8 ? [0, 0, 1] : [0, 1, 0];
  const a = nrm(cross(ref, d));
  const b = cross(d, a);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const ph = (TAU * i) / n;
    out.push([c[0] + a[0] * Math.cos(ph) * r + b[0] * Math.sin(ph) * rv, c[1] + a[1] * Math.cos(ph) * r + b[1] * Math.sin(ph) * rv, c[2] + a[2] * Math.cos(ph) * r + b[2] * Math.sin(ph) * rv]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

/** A spoked wheel square to x at (x, axle y = radius r, z): hub, spokes, felloe, iron tyre; it rolls (hinge 1). */
function spokedWheel(m, x, r, z, spokes, lod, { tyre = SLOTS.IRON, felloe = SLOTS.WOOD } = {}) {
  const w = wheelW(r, z);
  const n = [24, 14, 8][lod];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (TAU * i) / n;
    pts.push([x, r + Math.sin(a) * r * 0.93, z + Math.cos(a) * r * 0.93]);
  }
  tube(m, pts, r * 0.07, { seg: lod === 2 ? 3 : 5, fx: 1.3, w, slot: felloe, caps: false, up: [1, 0, 0] });
  if (lod < 2) {
    const tp = pts.map(([px, py, pz]) => [px, r + (py - r) / 0.93, z + (pz - z) / 0.93]);
    tube(m, tp, r * 0.035, { seg: 3, fx: 2.2, w, slot: tyre, caps: false, up: [1, 0, 0] });
  }
  tube(m, [[x - 0.08, r, z], [x + 0.08, r, z]], r * 0.16, { seg: lod === 2 ? 4 : 8, w, slot: SLOTS.WOOD, tone: () => 0.8 });
  if (lod < 2) {
    for (let k = 0; k < spokes; k++) {
      const a = (TAU * k) / spokes;
      tube(m, [[x, r + Math.sin(a) * r * 0.14, z + Math.cos(a) * r * 0.14], [x, r + Math.sin(a) * r * 0.88, z + Math.cos(a) * r * 0.88]], r * 0.035, { seg: 4, w, slot: SLOTS.WOOD, caps: false });
    }
  } else {
    // Far out: the spokes as a disc of shade.
    tube(m, [[x - 0.01, r, z], [x + 0.01, r, z]], r * 0.86, { seg: 6, w, slot: SLOTS.WOOD, tone: () => 0.55 });
  }
}

/** A solid plank wheel (tympanum) square to x at (x, r, z), its hub and iron tyre. */
function solidWheel(m, x, r, z, lod) {
  const w = wheelW(r, z);
  const n = [20, 12, 8][lod];
  tube(m, [[x - 0.05, r, z], [x + 0.05, r, z]], r, { seg: n, w, slot: SLOTS.WOOD, tone: (i, phi) => 0.85 + 0.08 * Math.sin(phi * 3), caps: true, up: [0, 1, 0] });
  if (lod < 2) {
    // The planks' seams and the battens across them, the tyre, the hub.
    for (const dz of [-0.16, 0.16]) box(m, [x + 0.055 * Math.sign(x || 1), r, z + dz], 0.02, r * 1.6, 0.06, SLOTS.WOOD, w, 0.7);
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([x, r + Math.sin((TAU * i) / n) * r, z + Math.cos((TAU * i) / n) * r]);
    tube(m, pts, 0.02, { seg: 3, fx: 3, w, slot: SLOTS.IRON, caps: false, up: [1, 0, 0] });
  }
  tube(m, [[x - 0.12, r, z], [x + 0.12, r, z]], 0.08, { seg: lod === 2 ? 4 : 8, w, slot: SLOTS.WOOD, tone: () => 0.7 });
}

/** The handcart: in the pusher's frame (he at the origin, facing +z); its bed's top and middle, where loads sit. */
export const HANDCART_BED = Object.freeze({ y: 0.66, z: 1.33, x: 0.3, len: 1.0 });
/** The wagon: in its own frame (the middle of its bed over the origin); the bed's top and size. */
export const WAGON_BED = Object.freeze({ y: 0.9, z: 0, x: 0.52, len: 1.9, pole: 3.3 });
/** The chariot: in its driver's frame; his floor's height, the horses' places (their middles). */
export const CHARIOT = Object.freeze({ floor: 0.3, horses: [[0.42, 2.05], [-0.42, 2.05]] });

/** A vehicle by kind ('handcart', 'wagon', 'chariot') at `lod`. */
export function buildCart(kind, lod) {
  const m = new Mesher();
  if (kind === 'handcart') {
    const H = HANDCART_BED;
    // The shafts: from the handles down to the bed's back, along its sides to the front; the handles' grips.
    for (const s of [1, -1]) {
      tube(m, [[s * 0.23, 0.95, 0.26], [s * 0.25, 0.86, 0.48], [s * 0.29, H.y - 0.01, H.z - H.len / 2], [s * 0.3, H.y - 0.03, H.z + H.len / 2 + 0.08]], 0.026, { seg: lod === 2 ? 4 : 6, slot: SLOTS.WOOD, tone: () => 0.8 });
      if (lod < 2) tube(m, [[s * 0.228, 0.958, 0.22], [s * 0.232, 0.93, 0.42]], 0.031, { seg: 6, slot: SLOTS.LEATHER });
      // The low side boards.
      box(m, [s * (H.x + 0.02), H.y + 0.09, H.z], 0.03, 0.16, H.len, SLOTS.WOOD, STILL, 0.72);
    }
    // The bed's planks, the front and back boards.
    const planks = lod === 0 ? 5 : 1;
    for (let k = 0; k < planks; k++) {
      const pw = (H.x * 2) / planks;
      box(m, [-H.x + pw * (k + 0.5), H.y - 0.02, H.z], pw - (planks > 1 ? 0.008 : 0), 0.04, H.len + 0.04, SLOTS.WOOD, STILL, 0.85 + 0.07 * ((k * 7) % 3 - 1));
    }
    for (const dz of [-1, 1]) box(m, [0, H.y + 0.09, H.z + dz * (H.len / 2 + 0.01)], H.x * 2 + 0.06, 0.16, 0.03, SLOTS.WOOD, STILL, 0.68);
    // The axle under the bed, the wheels, a leg at the front to stand on.
    const r = 0.36;
    tube(m, [[-0.44, r, H.z], [0.44, r, H.z]], 0.03, { seg: 5, slot: SLOTS.WOOD, tone: () => 0.6 });
    for (const s of [1, -1]) spokedWheel(m, s * 0.42, r, H.z, 8, lod);
    tube(m, [[0, H.y - 0.04, H.z + H.len / 2 - 0.02], [0, 0.02, H.z + H.len / 2 + 0.06]], 0.025, { seg: 5, slot: SLOTS.WOOD, tone: () => 0.7 });
  } else if (kind === 'wagon') {
    const B = WAGON_BED;
    // The floor, the wicker body round it (corbis), its rim; the solid wheels under the middle; the pole.
    box(m, [0, B.y - 0.03, B.z], B.x * 2 + 0.06, 0.06, B.len, SLOTS.WOOD, STILL, 0.8);
    const sideH = 0.36;
    for (const s of [1, -1]) {
      box(m, [s * (B.x + 0.02), B.y + sideH / 2, B.z], 0.04, sideH, B.len, SLOTS.ROPE, STILL, 0.85);
      if (lod < 2) tube(m, [[s * (B.x + 0.02), B.y + sideH, -B.len / 2], [s * (B.x + 0.02), B.y + sideH, B.len / 2]], 0.025, { seg: 5, slot: SLOTS.WOOD });
    }
    for (const s of [1, -1]) box(m, [0, B.y + sideH / 2, s * (B.len / 2 + 0.02)], B.x * 2 + 0.08, sideH, 0.04, SLOTS.ROPE, STILL, 0.78);
    if (lod < 2) {
      // Stakes up the wicker.
      for (const s of [1, -1]) for (let k = 0; k < 5; k++) box(m, [s * (B.x + 0.045), B.y + sideH / 2, -B.len / 2 + 0.1 + k * ((B.len - 0.2) / 4)], 0.03, sideH + 0.06, 0.04, SLOTS.WOOD, STILL, 0.7);
    }
    const r = 0.48;
    tube(m, [[-0.78, r, 0], [0.78, r, 0]], 0.06, { seg: 6, slot: SLOTS.WOOD, tone: () => 0.6 });
    for (const s of [1, -1]) solidWheel(m, s * 0.72, r, 0, lod);
    tube(m, [[0, B.y - 0.05, B.len / 2 - 0.3], [0, B.y + 0.0, B.len / 2 + 0.6], [0, 1.0, B.pole - 0.4], [0, 1.08, B.pole]], 0.05, { seg: lod === 2 ? 4 : 7, slot: SLOTS.WOOD, tone: () => 0.75 });
  } else if (kind === 'chariot') {
    const C = CHARIOT;
    // The floor, a woven platform; the breastwork round the front and sides, its bronze rim.
    box(m, [0, C.floor - 0.02, 0.03], 0.62, 0.04, 0.6, SLOTS.ROPE, STILL, 0.8);
    const n = [12, 7, 4][lod];
    for (const face of [1, -1]) {
      m.grid(n, 1, (i, j) => {
        const a = -Math.PI * 0.62 + (Math.PI * 1.24 * i) / n;
        const R = 0.31 + (face > 0 ? 0.008 : 0);
        const h = 0.62 - 0.32 * Math.abs(Math.sin(a)) ** 3;
        const p = [Math.sin(a) * R, C.floor + j * h, 0.05 + Math.cos(a) * R * 0.9];
        return { p, c: [0, C.floor + 0.3, 0.05], uv: [a, j * h], w: STILL, slot: face > 0 ? SLOTS.ACCENT : SLOTS.WOOD, tone: face > 0 ? 1 : 0.6 };
      }, { flip: face < 0 });
    }
    if (lod < 2) {
      const rim = [];
      for (let i = 0; i <= n; i++) {
        const a = -Math.PI * 0.62 + (Math.PI * 1.24 * i) / n;
        rim.push([Math.sin(a) * 0.315, C.floor + 0.62 - 0.32 * Math.abs(Math.sin(a)) ** 3, 0.05 + Math.cos(a) * 0.315 * 0.9]);
      }
      tube(m, rim, 0.018, { seg: 4, slot: SLOTS.BRONZE, caps: true });
    }
    // The axle at the platform's back, light spoked wheels; the pole from under the floor up to the yoke.
    const r = 0.44;
    tube(m, [[-0.62, r, -0.18], [0.62, r, -0.18]], 0.03, { seg: 5, slot: SLOTS.WOOD, tone: () => 0.6 });
    for (const s of [1, -1]) spokedWheel(m, s * 0.58, r, -0.18, 6, lod);
    const yoke = C.horses[0][1] + 0.45;
    tube(m, [[0, C.floor - 0.04, 0.3], [0, 0.5, 0.9], [0, 0.95, 1.7], [0, 1.18, yoke]], 0.035, { seg: lod === 2 ? 4 : 6, slot: SLOTS.WOOD, tone: () => 0.7 });
    tube(m, [[-0.62, 1.22, yoke], [0, 1.25, yoke], [0.62, 1.22, yoke]], 0.035, { seg: lod === 2 ? 4 : 6, slot: SLOTS.WOOD });
    if (lod < 2) {
      // The reins: from the driver's hands (clips.js drive) to the horses' bits, slack.
      for (const [hx] of C.horses) {
        for (const s of [1, -1]) {
          const from = [s * 0.11, C.floor + 1.08, 0.46];
          const to = [hx + s * 0.05, 1.42, C.horses[0][1] + 1.3];
          const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 0.12, (from[2] + to[2]) / 2];
          tube(m, [from, mid, to], 0.007, { seg: 3, slot: SLOTS.LEATHER, caps: false });
        }
      }
    }
  } else {
    throw new Error(`No vehicle ${kind}`);
  }
  return m;
}

/** A lead rope, one metre along +z from its origin, sagging (walkers/material.js stretches it to its length). */
export function buildRope(lod) {
  const m = new Mesher();
  const n = [10, 6, 3][lod];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([0, -0.22 * Math.sin(Math.PI * u), u]);
  }
  tube(m, pts, 0.011, { seg: lod === 2 ? 3 : 4, slot: SLOTS.ROPE, caps: false, up: [0, 1, 0] });
  return m;
}

/** A rigid piece by its key: `beast:<kind>[:opts]`, `cart:<kind>`, `rope`. */
export function rigidMesher(key, lod) {
  const [what, kind, ...opts] = key.split(':');
  if (what === 'beast') {
    if (!BEASTS[kind]) throw new Error(`No beast ${kind}`);
    return buildBeast(kind, new Set(opts), lod);
  }
  if (what === 'cart') return buildCart(kind, lod);
  if (what === 'rope') return buildRope(lod);
  throw new Error(`No rigid piece ${key}`);
}

/** Is a piece's key a rigid one (a beast, a vehicle, a rope)? */
export function isRigidKey(key) {
  return key.startsWith('beast:') || key.startsWith('cart:') || key === 'rope';
}
