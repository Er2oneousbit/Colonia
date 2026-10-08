/**
 * people/garments.js
 * ----------------------------------------------------------------------------
 * Roman dress for the 3D look's people, each garment a piece of its own
 * (pieces.js), skinned to the rig over the body (body.js) and swapped per
 * person by the actors (actors.js), after the record (the Ara Pacis's
 * procession, the togate statues, the Pompeian frescoes, the soldiers'
 * tombstones), not any game's art:
 *
 *   tunic    the tunica of two widths of wool sewn at the shoulders and sides,
 *            short wide sleeves, belted and bloused over the belt; the clavi
 *            (the stripes from the shoulders to the hem: a senator's broad,
 *            others' narrow) in the trim's colour; to the knee (a man), above
 *            it (a slave, a worker: short), to the ankles (a woman, a boy at a
 *            rite, a man of years); a woman's girdled high under the bust,
 *            the flounce (instita) of the matron's stola at its hem
 *   toga     the toga of the Augustan citizen: wrapped from the ankles over
 *            the left shoulder and round under the right arm, its top edge
 *            rolled into the balteus across the chest, the sinus hanging in a
 *            curve in front to the knee, the umbo pulled out over the balteus,
 *            the folds laid over the bent left forearm; its border (the
 *            praetexta of a magistrate or a boy) in the trim's colour;
 *            `velato` drawn up over the back of the head for a sacrifice
 *   palla    a woman's mantle over both shoulders, wrapped to the knees,
 *            `veil` drawn over her head
 *   pallium  the Greek mantle of a teacher or a philosopher, over the left
 *            shoulder, the right shoulder free
 *   paenula  the closed hooded travelling cloak
 *   lorica   a soldier's mail shirt (hamata) with its doubled shoulders, the
 *            belt (cingulum) with its studded apron, the scarf (focale)
 *   limus    the victimarius's apron from the waist to the feet, its purple
 *            hem; nothing above it
 *   caligae  the soldier's open boots of straps; helmet (the imperial Gallic
 *            bowl with its neck guard, brow and cheek pieces); the bulla, the
 *            gold amulet a freeborn child wore; a festival's wreath
 *
 * Drape: rings round the body pushed out over what is under them, the
 * folds a sum of waves round the ring whose depth grows away from where the
 * cloth is held (the belt, the shoulder), diagonal where the cloth is
 * wrapped (a toga, a palla); the fold's depth darkens its tone. Weights: the
 * trunk's above the waist, the skirt's below (mesher.js skirtWeights).
 * ----------------------------------------------------------------------------
 */

import { Matrix4, Vector3 } from 'three';
import { Mesher, SLOTS, trunkWeights, skirtWeights, chainWeights, weights, rigid, smooth } from './mesher.js';
import { trunkSection, trunkPoint, limbTube, armRadius, legRadius, headPoint, headAngles, headWeights, HEAD_C, footPoint, gauss, TAU } from './body.js';
import { BONE, BONES, BONE_COUNT } from './rig.js';
import { poseAt } from './clips.js';

/** Rows and columns of a garment by level of detail. */
const GR = [{ rows: 24, cols: 40, sleeve: 8, sleeveC: 12 }, { rows: 9, cols: 14, sleeve: 3, sleeveC: 6 }, { rows: 4, cols: 7, sleeve: 1, sleeveC: 4 }];

/** Folds round a ring: a sum of waves (seed shifts them), from -1 to 1 roughly. */
function folds(phi, seed = 0, n = [9, 14, 5]) {
  return 0.55 * Math.sin(n[0] * phi + seed * 1.7 + 0.4) + 0.3 * Math.sin(n[1] * phi + seed * 2.9 + 1.9) + 0.25 * Math.sin(n[2] * phi + seed * 0.7);
}

/**
 * A ring's columns round a garment with split columns where a stripe starts
 * and ends (the same angle twice, one each side), so a stripe's edge is
 * sharp: [{ phi, stripe }], -pi to pi.
 */
function columns(cols, stripes = []) {
  const out = [];
  const edges = [];
  for (const [a, b] of stripes) edges.push(a, b);
  const base = [];
  for (let j = 0; j <= cols; j++) base.push(-Math.PI + (TAU * j) / cols);
  const all = [...new Set([...base, ...edges])].sort((a, b) => a - b);
  const inside = (phi) => stripes.some(([a, b]) => phi > a + 1e-6 && phi < b - 1e-6);
  for (const phi of all) {
    if (edges.some((e) => Math.abs(e - phi) < 1e-9)) {
      // Its two sides: the plain cloth's vertex and the stripe's, at one place.
      const into = stripes.some(([a]) => Math.abs(a - phi) < 1e-9);
      out.push({ phi, stripe: !into }, { phi, stripe: into });
    } else {
      out.push({ phi, stripe: inside(phi) });
    }
  }
  return out;
}

/** The angle of a point x across the trunk's front (or back) at height y, for stripes. */
function phiAt(x, y, kind, back = false) {
  const s = trunkSection(y, kind);
  const a = Math.asin(Math.max(-1, Math.min(1, x / (s.a + 0.015))));
  return back ? (a > 0 ? Math.PI - a : -Math.PI - a) : a;
}

/**
 * A garment's skirt and body as one loft: rings from `hem` up to `top`
 * (a function of phi for a wrapped one), each pushed out from the trunk by
 * off(y, phi) (over the hips the hips' section held, below them an oval
 * that clears the legs and flares to the hem), folded by fold(y, phi).
 */
function drapeLoft(m, { kind, rows, cols, hem, top, off, fold, slot, tone = null, weightsAt, stripes = [], hemWave = 0.012, seed = 1, front = 0 }) {
  const C = columns(cols, stripes);
  const yTop = typeof top === 'function' ? top : () => top;
  const yHem = typeof hem === 'function' ? hem : (phi) => hem + hemWave * Math.sin(3 * phi + seed);
  return m.grid(rows, C.length - 1, (i, j) => {
    const { phi, stripe } = C[j];
    const y0 = yHem(phi);
    const y1 = yTop(phi);
    // Rows crowded toward the top (where the shape changes most: the shoulders, the belt).
    const v = i / rows;
    const y = y0 + (y1 - y0) * (1 - (1 - v) ** 1.25);
    const o = off(y, phi);
    let p;
    let c;
    if (y >= 0.9) {
      p = trunkPoint(y, phi, kind, o);
      c = [0, y, trunkSection(y, kind).zc];
    } else {
      // Below the hips: the hips' oval, widening as it falls (it must clear a stride), flaring to the hem.
      const s = trunkSection(0.9, kind);
      const k = smooth(0.9, 0.2, y);
      const a = s.a + o + 0.03 * k;
      const bf = s.bf + o + 0.06 * k;
      const bb = s.bb + o + 0.05 * k;
      const sx = Math.sin(phi);
      const cz = Math.cos(phi);
      p = [a * Math.sign(sx) * Math.abs(sx) ** 0.9, y, s.zc + (cz > 0 ? bf : bb) * Math.sign(cz) * Math.abs(cz) ** 0.9];
      c = [0, y, s.zc];
    }
    const f = fold(y, phi);
    // Out along the ring's own outward direction (from its middle).
    const dx = p[0] - c[0];
    const dz = p[2] - c[2];
    const dl = Math.hypot(dx, dz) || 1;
    p[0] += (dx / dl) * f;
    p[2] += (dz / dl) * f + front * smooth(0.95, 0.4, y) * Math.max(0, Math.cos(phi));
    const t = tone ? tone(y, phi, f) : 0.88 + 6 * f;
    return { p, c, uv: [phi * 0.2, y], w: weightsAt(p[0], y, p[2], phi), slot: stripe ? SLOTS.TRIM : typeof slot === 'function' ? slot(y, phi) : slot, tone: Math.max(0.55, Math.min(1.12, t)) };
  });
}

/** A short wide sleeve over the upper arm (u to `end`, 0 the shoulder, 1 the elbow), its end turned in to the arm. */
function sleeve(m, s, kind, R, { end = 0.5, slot = SLOTS.TUNIC, off = 0.016, flare = 0.014, foldAmp = 0.004 } = {}) {
  const k = s > 0 ? 'L' : 'R';
  const js = [BONE[`arm${k}`], BONE[`fore${k}`], BONE[`hand${k}`]];
  limbTube(m, js, {
    r: (u) => armRadius(u, kind) + off + flare * smooth(0.1, end, u),
    u0: -0.28, u1: end, rows: R.sleeve, cols: R.sleeveC, side: s, slot,
    extra: (u) => (u < 0.2 ? { k: smooth(0.2, -0.15, u) * 0.6, list: [[`clav${k}`, 0.4], ['chest', 0.6]] } : null),
    along: (p, u, phi) => {
      // Folds hanging from the shoulder seam.
      const f = foldAmp * Math.sin(phi * 5 + s) * smooth(0, end, u);
      p[1] -= f;
    },
    tone: (u, phi) => 0.86 + 0.1 * Math.cos(phi),
    uvScale: 3,
  });
  // The cuff turned in to the arm, so no one sees into the sleeve.
  limbTube(m, js, { r: (u) => armRadius(u, kind) + (u < end + 0.01 ? off + flare : 0.002), u0: end, u1: end + 0.02, rows: 1, cols: R.sleeveC, side: s, slot, tone: () => 0.6 });
}

// ---------------------------------------------------------------------------
// The tunic
// ---------------------------------------------------------------------------

/**
 * A tunic: `len` short | knee | long; `kind` the body; `belt` its height
 * (a woman's under the bust); `clavi` 'narrow' or 'broad'; `instita` a band
 * at the hem (the matron's stola).
 */
export function tunic(kind, lod, { len = 'knee', belt = null, clavi = 'narrow', instita = false, sleeves = 0.5 } = {}) {
  const R = GR[lod];
  const m = new Mesher();
  const hem = { short: 0.6, knee: 0.47, long: 0.1 }[len];
  const by = belt ?? (kind === 'f' ? 1.2 : 1.0);
  const high = by > 1.1;
  const w = clavi === 'broad' ? 0.034 : 0.012;
  const stripes = lod === 2 ? [] : [[phiAt(0.06 - w / 2, 1.2, kind), phiAt(0.06 + w / 2, 1.2, kind)], [phiAt(-0.06 - w / 2, 1.2, kind), phiAt(-0.06 + w / 2, 1.2, kind)],
    [phiAt(0.06 + w / 2, 1.2, kind, true), phiAt(0.06 - w / 2, 1.2, kind, true)], [phiAt(-0.06 + w / 2, 1.2, kind, true), phiAt(-0.06 - w / 2, 1.2, kind, true)]]
    .map(([a, b]) => (a < b ? [a, b] : [b, a]));
  const long = len === 'long';
  drapeLoft(m, {
    kind, rows: R.rows, cols: R.cols, hem, top: 1.452, stripes, seed: 3,
    off: (y, phi) => {
      // Over the shoulders the cloth bridges to the arms' tops; bloused over the belt; close at the belt.
      const sh = smooth(1.3, 1.4, y) * (1 - smooth(1.43, 1.452, y)) * Math.abs(Math.sin(phi)) ** 2;
      const blouse = 0.018 * gauss((y - (by + 0.05)) / 0.05);
      const pinch = -0.006 * gauss((y - by) / 0.012);
      const neck = y > 1.43 ? 0.01 : 0;
      return 0.012 + 0.07 * sh + blouse + pinch + neck;
    },
    fold: (y, phi) => {
      if (lod === 2) return 0;
      // Below the belt: hanging folds deepening to the hem; above it: soft folds gathered at the belt.
      const below = Math.max(0, by - y);
      const amp = y < by ? 0.004 + 0.013 * Math.min(1, below / (by - hem)) : 0.004 * gauss((y - by - 0.06) / 0.08);
      return amp * folds(phi + (long ? 0.15 * y : 0), 2);
    },
    weightsAt: (x, y, z) => (y > by ? trunkWeights(x, y, z, { legs: 0.2 }) : skirtWeights(x, y, z, { long })),
    slot: (y) => (instita && y < hem + 0.05 ? SLOTS.TRIM : SLOTS.TUNIC),
    tone: (y, phi, f) => 0.86 + 5 * f + 0.06 * Math.cos(phi) - 0.1 * gauss((y - by) / 0.02),
  });
  // The neck's opening: the cloth turned in to the neck.
  m.grid(1, R.cols, (i, j) => {
    const phi = -Math.PI + (TAU * j) / R.cols;
    const p = i === 0 ? trunkPoint(1.452, phi, kind, 0.022) : trunkPoint(1.44, phi, kind, 0.0);
    return { p, c: [0, 1.6, 0], uv: [phi * 0.2, 0], w: trunkWeights(p[0], p[1], p[2]), slot: SLOTS.TUNIC, tone: 0.6 };
  });
  // The belt: a cord or a leather band round the waist (a woman's girdle under the bust).
  if (lod < 2) {
    m.grid(2, R.cols, (i, j) => {
      const phi = -Math.PI + (TAU * j) / R.cols;
      const y = by + (i - 1) * 0.009;
      const p = trunkPoint(y, phi, kind, 0.012 + (i === 1 ? 0.006 : 0));
      return { p, c: [0, y, 0], uv: [phi * 0.2, y], w: trunkWeights(p[0], y, p[2], { legs: 0.1 }), slot: high ? SLOTS.ACCENT : SLOTS.LEATHER, tone: i === 1 ? 0.95 : 0.7 };
    });
  }
  if (sleeves > 0) for (const s of [1, -1]) sleeve(m, s, kind, R, { end: sleeves, slot: SLOTS.TUNIC });
  return m;
}

// ---------------------------------------------------------------------------
// Wrapped garments: the toga, the palla, the pallium
// ---------------------------------------------------------------------------

/**
 * Re-author vertices made in a reference pose (the toga's left arm bent
 * across the waist) back to the rest pose the skinning starts from: each
 * vertex through the inverse of its blended skinning matrix in that pose.
 */
function fromPose(m, from, poseName = 'idle@toga', t = 0) {
  const pose = poseAt(poseName, t);
  const S = new Float32Array(BONE_COUNT * 12);
  pose.write(S);
  const M = new Matrix4();
  const inv = new Matrix4();
  const v = new Vector3();
  const n = m.count;
  for (let i = from; i < n; i++) {
    const e = new Array(16).fill(0);
    for (let k = 0; k < 4; k++) {
      const b = m.bones[i * 4 + k];
      const w = m.wts[i * 4 + k];
      if (!w) continue;
      const o = b * 12;
      // (Rows of the 3 x 4 into a column-major 4 x 4.)
      e[0] += w * S[o]; e[4] += w * S[o + 1]; e[8] += w * S[o + 2]; e[12] += w * S[o + 3];
      e[1] += w * S[o + 4]; e[5] += w * S[o + 5]; e[9] += w * S[o + 6]; e[13] += w * S[o + 7];
      e[2] += w * S[o + 8]; e[6] += w * S[o + 9]; e[10] += w * S[o + 10]; e[14] += w * S[o + 11];
    }
    e[15] = 1;
    M.fromArray(e);
    inv.copy(M).invert();
    v.set(m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]).applyMatrix4(inv);
    m.pos[i * 3] = v.x;
    m.pos[i * 3 + 1] = v.y;
    m.pos[i * 3 + 2] = v.z;
  }
}

/** Where the posed (toga) left forearm lies: elbow and wrist, from the reference pose. */
function togaForearm() {
  const p = poseAt('idle@toga', 0);
  return { elbow: p.jointOf('foreL').toArray(), wrist: p.jointOf('handL').toArray() };
}

/**
 * The toga (and the pallium, lighter: `pallium`): see the header. `velato`
 * draws it over the back of the head. `len` its hem's height.
 */
export function toga(kind, lod, { velato = false, pallium = false } = {}) {
  const R = GR[lod];
  const m = new Mesher();
  const hem = pallium ? 0.3 : 0.1;
  // The top edge: high over the left shoulder, down under the right arm, diagonal front and back.
  const top = (phi) => 1.335 + 0.115 * Math.sin(phi) - 0.02 * Math.cos(phi);
  const shoulder = (y, phi) => smooth(1.28, 1.42, y) * Math.max(0, Math.sin(phi)) ** 1.5;
  drapeLoft(m, {
    kind, rows: R.rows, cols: R.cols, hem, top, seed: 5,
    off: (y, phi) => 0.03 + 0.08 * shoulder(y, phi) + 0.012 * smooth(1.0, 0.6, y),
    fold: (y, phi) => {
      if (lod === 2) return 0;
      // Diagonal folds running down from the left shoulder to the right, deeper below.
      const d = phi - 2.2 * (1.25 - y);
      const amp = 0.006 + 0.014 * smooth(1.2, 0.3, y);
      return amp * folds(d, 5, [7, 11, 4]);
    },
    weightsAt: (x, y, z) => (y > 1.0 ? trunkWeights(x, y, z, { legs: 0.2, arms: x > 0 ? 1 : 0.3 }) : skirtWeights(x, y, z, { long: true })),
    slot: SLOTS.MANTLE,
    tone: (y, phi, f) => 0.86 + 4.5 * f + 0.05 * Math.cos(phi),
  });
  // The balteus: the top edge rolled thick, its border (praetexta) on its outer side.
  if (lod < 2) {
    const n = R.cols;
    const rr = 0.022;
    m.grid(n, 6, (i, j) => {
      const phi = -Math.PI + (TAU * i) / n;
      const y = top(phi);
      const c = trunkPoint(y, phi, kind, 0.03 + 0.08 * shoulder(y, phi) + rr * 0.6);
      const a = (TAU * j) / 6;
      // Round the roll: out from the body and up.
      const ox = Math.sin(phi);
      const oz = Math.cos(phi);
      const p = [c[0] + ox * Math.cos(a) * rr, c[1] + Math.sin(a) * rr, c[2] + oz * Math.cos(a) * rr];
      const outer = Math.cos(a) > 0.3 && Math.sin(a) > -0.2;
      return { p, c, uv: [phi * 0.2, a * 0.02], w: trunkWeights(p[0], p[1], p[2], { arms: p[0] > 0 ? 1 : 0.3 }), slot: outer ? SLOTS.TRIM : SLOTS.MANTLE, tone: 0.8 + 0.2 * Math.cos(a) };
    });
  }
  if (!pallium) {
    // The sinus: the drape hanging in a curve in front, from under the right arm to the left shoulder.
    const rows = Math.max(2, Math.round(R.rows / 3));
    const cols = Math.max(3, Math.round(R.cols / 3));
    m.grid(rows, cols, (i, j) => {
      const s = j / cols;
      const v = i / rows;
      const topY = 1.2 + 0.2 * s;
      const lowY = 1.2 + 0.2 * s - 0.58 * Math.sin(Math.PI * Math.min(1, s * 1.15)) ** 1.1;
      const y = topY + (lowY - topY) * v;
      const x = -0.19 + 0.33 * s;
      const phi = Math.atan2(x, 0.12);
      const base = y > 0.9 ? trunkPoint(y, phi, kind, 0.045) : [x, y, 0.15];
      const bulge = 0.04 * Math.sin(Math.PI * v) + 0.02 * v + (lod === 0 ? 0.01 * Math.sin(s * 14 + v * 3) * v : 0);
      const p = [base[0] * 1.02, y, Math.max(base[2], 0.14) + bulge];
      const edge = i === rows;
      return { p, c: [p[0] * 0.5, y, 0], uv: [s * 0.4, y], w: y > 1.0 ? trunkWeights(p[0], y, p[2], { arms: 0.2 }) : skirtWeights(p[0], y, p[2], { long: true }), slot: edge && lod === 0 ? SLOTS.TRIM : SLOTS.MANTLE, tone: 0.8 + 0.2 * Math.sin(Math.PI * v) };
    });
    // The umbo: the pouch pulled out over the balteus.
    if (lod < 2) {
      const c = [-0.015, 1.25, 0.15];
      const n = lod === 0 ? 8 : 4;
      m.grid(n, n, (i, j) => {
        const th = (Math.PI * i) / n;
        const ph = (TAU * j) / n;
        const r = 0.042 * (1 + (lod === 0 ? 0.12 * Math.sin(ph * 3 + th * 2) : 0));
        const p = [c[0] + Math.sin(th) * Math.sin(ph) * r * 1.2, c[1] + Math.cos(th) * r * 0.9, c[2] + Math.sin(th) * Math.cos(ph) * r * 0.6];
        return { p, c, uv: [ph * 0.05, th * 0.05], w: trunkWeights(p[0], p[1], p[2]), slot: SLOTS.MANTLE, tone: 0.85 };
      });
    }
  }
  // Over the left arm: the cloth over the upper arm to the elbow...
  const k = 'L';
  limbTube(m, [BONE[`arm${k}`], BONE[`fore${k}`], BONE[`hand${k}`]], {
    r: (u) => armRadius(u, kind) + 0.032 + 0.006 * Math.sin(u * 9), u0: -0.3, u1: pallium ? 1.0 : 1.35, rows: R.sleeve + 2, cols: R.sleeveC, side: 1, slot: SLOTS.MANTLE,
    extra: (u) => (u < 0.2 ? { k: smooth(0.2, -0.15, u) * 0.6, list: [['clavL', 0.4], ['chest', 0.6]] } : null),
    tone: (u, phi) => 0.84 + 0.12 * Math.cos(phi), uvScale: 3,
  });
  // ...and the folds hanging from the bent forearm (made in the toga's pose, brought back to rest).
  if (!pallium) {
    const from = m.count;
    const { elbow, wrist } = togaForearm();
    const rows = Math.max(2, Math.round(R.rows / 3));
    const cols = Math.max(2, Math.round(R.sleeveC / 2));
    for (const side of [1, -1]) {
      m.grid(rows, cols, (i, j) => {
        const s = j / cols;
        const v = i / rows;
        const top = [elbow[0] + (wrist[0] - elbow[0]) * s, elbow[1] + (wrist[1] - elbow[1]) * s, elbow[2] + (wrist[2] - elbow[2]) * s];
        const y = top[1] - 0.04 - (0.62 - 0.2 * s) * v;
        const p = [top[0] + 0.03 + 0.02 * v, y, top[2] + side * (0.035 + 0.03 * v) + (lod === 0 ? 0.008 * Math.sin(s * 9 + v * 4) * v : 0)];
        const wf = 1 - smooth(0, 0.6, v);
        const w = weights([['foreL', wf * 0.8], ['armL', wf * 0.2], ['root', (1 - wf) * 0.6], ['thighL', (1 - wf) * 0.4]]);
        return { p, c: [top[0] + 0.03, y, top[2]], uv: [s * 0.3, y], w, slot: SLOTS.MANTLE, tone: 0.82 + 0.1 * side };
      });
    }
    fromPose(m, from);
  }
  if (velato) hood(m, kind, lod, R, SLOTS.MANTLE);
  return m;
}

/** A hood of the garment's cloth over the back of the head and down to the shoulders, the face left open. */
function hood(m, kind, lod, R, slot) {
  const rows = lod === 0 ? 12 : lod === 1 ? 5 : 3;
  const cols = lod === 0 ? 20 : lod === 1 ? 8 : 5;
  const open = 0.95;
  // Over the head: the crown, the sides to the jaw, the back to the nape.
  m.grid(rows, cols, (i, j) => {
    const th = 0.05 + (2.25 * i) / rows;
    const ph = open + ((TAU - 2 * open) * j) / cols;
    const off = 0.02 + 0.012 * smooth(1.2, 2.3, th) + (lod === 0 ? 0.004 * Math.sin(ph * 7 + th * 3) : 0);
    const { p } = headPoint(th, ph, kind, off, 0);
    // (Falling straight past the jaw, not following it in.)
    if (th > 1.6) {
      const k = smooth(1.6, 2.3, th);
      p[0] *= 1 + 0.25 * k;
      p[2] = p[2] * (1 - 0.3 * k) - 0.02 * k;
    }
    const w = weights([['head', 1 - smooth(1.7, 2.3, th) * 0.7], ['neck', smooth(1.7, 2.3, th) * 0.7]]);
    return { p, c: HEAD_C, uv: [ph * 0.05, th * 0.05], w, slot, tone: 0.75 + 0.2 * Math.cos(th) };
  });
  // From the hood's foot down over the nape and the shoulders into the toga's top.
  m.grid(Math.max(2, rows / 3), cols, (i, j) => {
    const ph = open + ((TAU - 2 * open) * j) / cols;
    const v = i / Math.max(2, rows / 3);
    const { p: a } = headPoint(2.3, ph, kind, 0.032, 0);
    a[0] *= 1.25;
    a[2] = a[2] * 0.7 - 0.02;
    const b = trunkPoint(1.38, ph, kind, 0.06);
    const p = [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v, a[2] + (b[2] - a[2]) * v];
    const w = weights([['neck', 1 - v], ['chest', v]]);
    return { p, c: [0, p[1], -0.01], uv: [ph * 0.05, p[1]], w, slot, tone: 0.78 };
  });
}

/** A woman's palla: over both shoulders, wrapped to the knees, the folds diagonal; `veil` over her head. */
export function palla(kind, lod, { veil = false } = {}) {
  const R = GR[lod];
  const m = new Mesher();
  const hem = (phi) => 0.55 - 0.08 * Math.sin(phi) + 0.02 * Math.sin(3 * phi);
  drapeLoft(m, {
    kind, rows: R.rows, cols: R.cols, hem, top: 1.45, seed: 7,
    off: (y, phi) => {
      const sh = smooth(1.3, 1.42, y) * (1 - smooth(1.44, 1.45, y)) * Math.abs(Math.sin(phi)) ** 1.5;
      return 0.034 + 0.09 * sh + (y > 1.43 ? 0.02 : 0);
    },
    fold: (y, phi) => {
      if (lod === 2) return 0;
      const d = phi + 1.8 * (1.3 - y);
      return (0.004 + 0.012 * smooth(1.3, 0.6, y)) * folds(d, 7, [8, 13, 3]);
    },
    weightsAt: (x, y, z) => (y > 1.0 ? trunkWeights(x, y, z, { legs: 0.2, arms: 0.8 }) : skirtWeights(x, y, z)),
    slot: (y) => (y < 0.6 ? SLOTS.TRIM : SLOTS.MANTLE),
    tone: (y, phi, f) => 0.86 + 4.5 * f + 0.05 * Math.cos(phi),
    hemWave: 0,
  });
  // Over the arms to the elbows, the mantle's fall.
  for (const s of [1, -1]) {
    const k = s > 0 ? 'L' : 'R';
    limbTube(m, [BONE[`arm${k}`], BONE[`fore${k}`], BONE[`hand${k}`]], {
      r: (u) => armRadius(u, kind) + 0.036 + 0.02 * smooth(0.3, 1, u), u0: -0.3, u1: 0.95, rows: R.sleeve + 1, cols: R.sleeveC, side: s, slot: SLOTS.MANTLE,
      extra: (u) => (u < 0.25 ? { k: smooth(0.25, -0.15, u) * 0.7, list: [[`clav${k}`, 0.4], ['chest', 0.6]] } : null),
      tone: (u, phi) => 0.82 + 0.12 * Math.cos(phi), uvScale: 3,
    });
  }
  if (veil) hood(m, kind, lod, R, SLOTS.MANTLE);
  return m;
}

/** The paenula: a closed bell of thick wool from the neck to the knees, its hood down on the back. */
export function paenula(kind, lod) {
  const R = GR[lod];
  const m = new Mesher();
  drapeLoft(m, {
    kind, rows: R.rows, cols: R.cols, hem: 0.56, top: 1.45, seed: 9,
    off: (y, phi) => {
      // A bell: close at the neck, over the shoulders and arms, falling wide.
      const sh = smooth(1.25, 1.42, y) * Math.abs(Math.sin(phi)) ** 1.2;
      return 0.03 + 0.11 * sh + 0.1 * smooth(1.3, 0.7, y) * Math.abs(Math.sin(phi)) ** 0.8 + (y > 1.43 ? 0.02 : 0);
    },
    fold: (y, phi) => (lod === 2 ? 0 : (0.003 + 0.01 * smooth(1.2, 0.6, y)) * folds(phi, 9, [6, 10, 3])),
    weightsAt: (x, y, z) => trunkWeights(x, y, z, { legs: 0.2, arms: 0.6 }),
    slot: SLOTS.MANTLE,
    hemWave: 0.005,
  });
  // The hood lying on the back.
  if (lod < 2) {
    const n = lod === 0 ? 8 : 4;
    m.grid(n, n, (i, j) => {
      const u = i / n;
      const v = j / n - 0.5;
      const y = 1.45 - 0.2 * u;
      const p = [v * 0.2 * (1 - 0.4 * u), y, trunkSection(y, kind).zc - trunkSection(y, kind).bb - 0.06 - 0.03 * Math.sin(Math.PI * u)];
      return { p, c: [0, y, 0], uv: [v, u], w: trunkWeights(p[0], y, p[2]), slot: SLOTS.MANTLE, tone: 0.8 };
    });
  }
  return m;
}

// ---------------------------------------------------------------------------
// A soldier's
// ---------------------------------------------------------------------------

/** The mail shirt with its doubled shoulders, the belt and its studded apron, the scarf at the neck. */
export function lorica(kind, lod) {
  const R = GR[lod];
  const m = new Mesher();
  drapeLoft(m, {
    kind, rows: Math.max(3, Math.round(R.rows * 0.6)), cols: R.cols, hem: 0.74, top: 1.45, seed: 11,
    off: (y, phi) => {
      const sh = smooth(1.3, 1.4, y) * (1 - smooth(1.43, 1.45, y)) * Math.abs(Math.sin(phi)) ** 2;
      return 0.024 + 0.075 * sh + (y > 1.43 ? 0.012 : 0);
    },
    fold: (y, phi) => (lod === 2 ? 0 : 0.002 * Math.sin(phi * 12) * smooth(1.0, 0.75, y)),
    weightsAt: (x, y, z) => (y > 0.98 ? trunkWeights(x, y, z, { legs: 0.2 }) : skirtWeights(x, y, z)),
    slot: SLOTS.METAL,
    // The mail's rows catch the light in bands.
    tone: (y) => 0.78 + 0.12 * Math.sin(y * 260),
    hemWave: 0,
  });
  // The doubled shoulders (humeralia): a short cape of mail over them.
  m.grid(Math.max(2, R.sleeve + 1), R.cols, (i, j) => {
    const phi = -Math.PI + (TAU * j) / R.cols;
    const v = i / Math.max(2, R.sleeve + 1);
    const y = 1.46 - 0.2 * v * (0.6 + 0.4 * Math.abs(Math.sin(phi)));
    const sh = Math.abs(Math.sin(phi)) ** 2;
    const p = trunkPoint(y, phi, kind, 0.038 + 0.075 * sh * smooth(1.46, 1.32, y) + 0.01);
    return { p, c: [0, y, 0], uv: [phi * 0.2, y], w: trunkWeights(p[0], y, p[2], { arms: 0.8 }), slot: SLOTS.METAL, tone: 0.9 };
  });
  for (const s of [1, -1]) sleeve(m, s, kind, R, { end: 0.42, slot: SLOTS.METAL, off: 0.024, flare: 0.006, foldAmp: 0 });
  if (lod < 2) {
    // The belt, and its apron of studded straps in front.
    m.grid(2, R.cols, (i, j) => {
      const phi = -Math.PI + (TAU * j) / R.cols;
      const y = 0.985 + (i - 1) * 0.022;
      const p = trunkPoint(y, phi, kind, 0.036 + (i === 1 ? 0.004 : 0));
      return { p, c: [0, y, 0], uv: [phi * 0.2, y], w: trunkWeights(p[0], y, p[2], { legs: 0.1 }), slot: SLOTS.LEATHER, tone: 0.8 };
    });
    for (let k = 0; k < 4; k++) {
      const x = -0.05 + k * 0.033;
      m.grid(lod === 0 ? 6 : 2, 1, (i, j) => {
        const y = 0.965 - (0.24 * i) / (lod === 0 ? 6 : 2);
        const xx = x + (j - 0.5) * 0.018;
        const z = trunkSection(0.9, kind).bf + 0.05 + 0.01 * smooth(0.95, 0.7, y);
        const stud = lod === 0 && i % 2 === 1;
        return { p: [xx, y, z], c: [xx, y, 0], uv: [xx, y], w: weights([['root', 0.7], [x > 0 ? 'thighL' : 'thighR', 0.3]]), slot: stud ? SLOTS.BRONZE : SLOTS.LEATHER, tone: 0.8 };
      });
    }
    // The focale: a scarf knotted round the neck.
    m.grid(2, R.sleeveC + 2, (i, j) => {
      const phi = -Math.PI + (TAU * j) / (R.sleeveC + 2);
      const y = 1.44 + i * 0.03;
      const r = 0.062 + 0.012 * (i === 1 ? 0.3 : 1);
      const p = [Math.sin(phi) * r, y, -0.012 + Math.cos(phi) * r * 0.98 + 0.02 * gauss(phi / 0.4)];
      return { p, c: [0, y, -0.012], uv: [phi * 0.05, y], w: weights([['chest', 0.5], ['neck', 0.5]]), slot: SLOTS.ACCENT, tone: 0.85 };
    });
  }
  return m;
}

/** The soldier's caligae: open boots of straps over the foot and up the ankle (the toes bare). */
export function caligae(kind, lod) {
  const m = new Mesher();
  const cols = lod === 0 ? 12 : lod === 1 ? 6 : 4;
  const rows = lod === 0 ? 10 : lod === 1 ? 4 : 2;
  for (const s of [1, -1]) {
    const k = s > 0 ? 'L' : 'R';
    const A = BONES[BONE[`foot${k}`]].at;
    const toeZ = BONES[BONE[`toe${k}`]].at[2] - A[2];
    // Over the foot from the heel to the ball, straps and gaps by rows (the gaps darker: the foot under them).
    m.grid(rows, cols, (i, j) => {
      const z = -0.075 + (0.21 * i) / rows;
      const phi = -Math.PI * 0.62 + (Math.PI * 1.24 * j) / cols;
      const p = footPoint(s, z, phi, kind, 0.004);
      const strap = lod === 2 || (i + (j % 2)) % 2 === 0;
      const t = smooth(toeZ - 0.03, toeZ + 0.01, z);
      return { p, c: [A[0], 0.04, A[2] + z], uv: [phi * 0.03, z], w: weights([[`foot${k}`, 1 - t], [`toe${k}`, t]]), slot: SLOTS.LEATHER, tone: strap ? 0.85 : 0.45 };
    });
    // The upper round the ankle, laced.
    limbTube(m, [BONE[`thigh${k}`], BONE[`shin${k}`], BONE[`foot${k}`]], {
      r: (u) => legRadius(u, kind) + 0.007, u0: 1.72, u1: 2.0, rows: lod === 0 ? 4 : 1, cols, side: s, slot: SLOTS.LEATHER,
      tone: (u, phi) => (lod === 0 && Math.sin(phi * 6) > 0.4 ? 0.5 : 0.82),
    });
    // The sole, its hobnails' row.
    m.grid(1, 1, (i, j) => {
      const z = -0.08 + 0.29 * i;
      const x = (j - 0.5) * 0.11;
      return { p: [A[0] + x, 0.002, A[2] + z], uv: [x, z], w: rigid(`foot${k}`), slot: SLOTS.LEATHER, tone: 0.35 };
    }, { flip: s < 0 });
  }
  return m;
}

/** The imperial Gallic helmet: the bowl, the brow's reinforcing ridge, the neck guard, the cheek pieces. */
export function helmet(kind, lod) {
  const m = new Mesher();
  const rows = lod === 0 ? 10 : lod === 1 ? 5 : 3;
  const cols = lod === 0 ? 24 : lod === 1 ? 10 : 6;
  const { ph } = headAngles(1, cols, 0);
  // The bowl.
  m.grid(rows, cols, (i, j) => {
    const th = 0.02 + (1.32 * i) / rows;
    const phi = ph[j];
    const front = Math.cos(phi);
    // (Lower behind than in front: it sits back over the forehead.)
    const t = th * (front > 0 ? 1 - 0.18 * front : 1 + 0.06 * -front);
    const { p } = headPoint(t, phi, kind, 0.011, 0);
    return { p, c: HEAD_C, uv: [phi * 0.05, th * 0.05], w: rigid('head'), slot: SLOTS.METAL, tone: 0.95 - 0.15 * Math.sin(th) * (i === rows ? 1 : 0) };
  });
  // The neck guard: a flared brim out and down behind.
  m.grid(Math.max(1, rows / 3), cols, (i, j) => {
    const phi = Math.PI * 0.45 + (Math.PI * 1.1 * j) / cols;
    const v = i / Math.max(1, rows / 3);
    const { p: a } = headPoint(1.36, phi, kind, 0.011, 0);
    const back = Math.max(0, -Math.cos(phi));
    const p = [a[0] * (1 + 0.5 * v * back), a[1] - 0.02 * v - 0.03 * v * back, a[2] - (0.03 + 0.05 * back) * v];
    return { p, c: [HEAD_C[0], a[1], HEAD_C[2]], uv: [phi * 0.05, v], w: rigid('head'), slot: SLOTS.METAL, tone: 0.85 };
  });
  if (lod < 2) {
    // The brow ridge: a band across the front.
    m.grid(1, cols, (i, j) => {
      const phi = -1.3 + (2.6 * j) / cols;
      const { p } = headPoint(1.12 - 0.04 * Math.cos(phi), phi, kind, 0.016 + 0.008 * i, 0);
      p[1] += 0.004 * i;
      return { p, c: HEAD_C, uv: [phi, i], w: rigid('head'), slot: SLOTS.METAL, tone: 1 };
    });
    // The cheek pieces hanging either side of the face.
    for (const s of [1, -1]) {
      m.grid(lod === 0 ? 4 : 2, lod === 0 ? 4 : 2, (i, j) => {
        const v = i / (lod === 0 ? 4 : 2);
        const u = j / (lod === 0 ? 4 : 2);
        const phi = s * (1.05 + 0.5 * u);
        const th = 1.38 + 0.62 * v;
        const { p } = headPoint(th, phi, kind, 0.014, 0);
        p[2] += 0.006 * v;
        return { p, c: HEAD_C, uv: [u, v], w: rigid('head'), slot: SLOTS.METAL, tone: 0.9 };
      });
    }
    // The knob on top where a crest may stand.
    const top = [HEAD_C[0], HEAD_C[1] + 0.112, HEAD_C[2]];
    m.grid(3, 6, (i, j) => {
      const th = (Math.PI * i) / 3;
      const phi = (TAU * j) / 6;
      return { p: [top[0] + Math.sin(th) * Math.sin(phi) * 0.012, top[1] + Math.cos(th) * 0.01, top[2] + Math.sin(th) * Math.cos(phi) * 0.012], c: top, uv: [0, 0], w: rigid('head'), slot: SLOTS.BRONZE, tone: 1 };
    });
  }
  return m;
}

/** The victimarius's limus: from the waist to the feet, its hem's purple border; nothing above. */
export function limus(kind, lod) {
  const R = GR[lod];
  const m = new Mesher();
  drapeLoft(m, {
    kind, rows: Math.max(3, Math.round(R.rows * 0.7)), cols: R.cols, hem: 0.12, top: 1.04, seed: 13,
    off: (y) => 0.01 + 0.008 * gauss((y - 1.02) / 0.02),
    fold: (y, phi) => (lod === 2 ? 0 : (0.003 + 0.012 * smooth(1.0, 0.2, y)) * folds(phi, 13)),
    weightsAt: (x, y, z) => skirtWeights(x, y, z, { long: true }),
    slot: (y) => (y < 0.2 ? SLOTS.TRIM : SLOTS.TUNIC),
  });
  // Its top turned in to the waist.
  m.grid(1, R.cols, (i, j) => {
    const phi = -Math.PI + (TAU * j) / R.cols;
    const p = trunkPoint(1.04, phi, kind, i ? 0 : 0.012);
    return { p, c: [0, 1.2, 0], uv: [phi, 0], w: trunkWeights(p[0], p[1], p[2]), slot: SLOTS.TUNIC, tone: 0.6 };
  });
  return m;
}

/** The bulla: a gold amulet on a cord round a freeborn child's neck. */
export function bulla(kind, lod) {
  const m = new Mesher();
  const n = lod === 0 ? 10 : 5;
  // The cord, round the neck and down to the chest.
  m.grid(n, 3, (i, j) => {
    const phi = -Math.PI + (TAU * i) / n;
    const drop = 0.1 * Math.max(0, Math.cos(phi)) ** 2;
    const c = trunkPoint(1.43 - drop, phi, kind, 0.022);
    const a = (TAU * j) / 3;
    const p = [c[0] + Math.cos(a) * 0.003, c[1] + Math.sin(a) * 0.003, c[2] + Math.cos(a) * 0.003];
    return { p, c, uv: [0, 0], w: trunkWeights(p[0], p[1], p[2]), slot: SLOTS.LEATHER, tone: 0.8 };
  });
  // The bulla: a lens of gold.
  const c = trunkPoint(1.31, 0, kind, 0.03);
  m.grid(n / 2, n, (i, j) => {
    const th = (Math.PI * i) / (n / 2);
    const phi = (TAU * j) / n;
    const p = [c[0] + Math.sin(th) * Math.sin(phi) * 0.026, c[1] + Math.cos(th) * 0.026, c[2] + Math.sin(th) * Math.cos(phi) * 0.008];
    return { p, c, uv: [0, 0], w: rigid('chest'), slot: SLOTS.GOLD, tone: 1 };
  });
  return m;
}

/** A wreath of laurel or myrtle on the head (a festival's). */
export function wreath(kind, lod) {
  const m = new Mesher();
  const n = lod === 0 ? 30 : lod === 1 ? 12 : 6;
  const a = lod === 0 ? 5 : 3;
  m.grid(n, a, (i, j) => {
    const phi = -Math.PI + (TAU * i) / n;
    const { p: c } = headPoint(1.02 + 0.12 * Math.max(0, -Math.cos(phi)), phi, kind, 0.022, 0);
    const t = (TAU * j) / a;
    // Leaves: the band lumpy along it.
    const r = 0.011 * (1 + (lod === 0 ? 0.45 * Math.abs(Math.sin(i * 2.7)) : 0));
    const ox = Math.sin(phi);
    const oz = Math.cos(phi);
    const p = [c[0] + ox * Math.cos(t) * r, c[1] + Math.sin(t) * r, c[2] + oz * Math.cos(t) * r];
    return { p, c, uv: [0, 0], w: rigid('head'), slot: SLOTS.LEAF, tone: 0.75 + 0.3 * Math.sin(t) };
  });
  return m;
}

export { GR };
