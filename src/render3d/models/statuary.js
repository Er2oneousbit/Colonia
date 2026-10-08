/**
 * models/statuary.js
 * ----------------------------------------------------------------------------
 * Sculpture for the 3D look: the statues on their bases (signa.js), the
 * quadriga on the triumphal arch (fornix.js), the garden's statuettes
 * (hortus.js). Statues are the one thing a player zooms to 6x to look at,
 * where a 2 m figure is some 400 device pixels tall, so the bodies here are
 * sculpted rather than the town's mannequins (learning.js person()):
 *
 *   - loft(): rings of ellipses along an axis, joined into a closed skin
 *     and pushed about by a function (a cuirass's chest, a toga's folds,
 *     a horse's barrel). Limbs are tubes whose radius swells over the
 *     muscles (orchard.js limb with a bump).
 *   - figure(): a man of 1.8 m in one of the poses the Roman statue types
 *     use, after the statues themselves:
 *       cuirass   the general addressing his troops (adlocutio), as the
 *                 Augustus of Prima Porta: a muscle cuirass, its fringe
 *                 of leather strips (pteruges), the cloak (paludamentum)
 *                 rolled round the hips and over the left forearm, the
 *                 right arm raised, the weight on the right leg, a spear
 *                 held upright in the left hand
 *       toga      the magistrate in his toga (the Togatus Barberini, the
 *                 Augustus of Via Labicana): the long skirt of folds, the
 *                 curved overfold (sinus) and the band across the chest
 *                 (balteus), the left arm wrapped in it, a book roll in
 *                 the right hand
 *       seated    the emperor enthroned as the king of the gods (Claudius from
 *                 Lanuvium, Augustus from Cumae): bare to the waist, the
 *                 mantle over the lap and the left shoulder, a sceptre
 *                 high in the right hand, a Victory on a globe in the left
 *       rider     the horseman (Marcus Aurelius on the Capitol): seated
 *                 astride, the cloak falling behind, the right arm held
 *                 out in the gesture of clemency, the reins in the left
 *   - horse(): the Capitoline horse, stepping out with its right foreleg
 *     raised high, its neck arched, its head turned a little.
 *   - victory(): a winged Victory on a globe holding up a wreath, the
 *     statuette of Victory the Romans set on columns and in their hands.
 *   - carve(): Roman capitals cut in stone or set in gilt bronze (the
 *     letters of masonry.js GLYPHS, with N, D and Q).
 *
 * Every geometry has position, normal, uv (metres) and an RGB colour, so
 * merge() takes them; colour is the sculpture's own shading (darker in its
 * folds and toward its foot), the material (marble, bronze, gilding) is the
 * caller's. Metres, y up, facing +z, the figure standing on y 0 over the
 * origin.
 * ----------------------------------------------------------------------------
 */

import {
  BufferGeometry, Float32BufferAttribute, SphereGeometry, BoxGeometry, CylinderGeometry, ConeGeometry, TorusGeometry,
  Vector3, Matrix4, Quaternion,
} from 'three';
import { boxUV, tintGeometry, tube } from '../shapes.js';
import { artRng, smoothstep } from '../texgen.js';
import { limb } from './orchard.js';
import { GLYPHS } from './masonry.js';

const TAU = Math.PI * 2;
const gauss = (v, w) => Math.exp(-(v * v) / (w * w));

// ---------------------------------------------------------------------------
// Loft
// ---------------------------------------------------------------------------

/**
 * A skin over rings of ellipses along an axis. `rings`: [a, c1, c2, r1, r2]
 * where `a` is the place along the axis and (c1, c2) the ring's centre and
 * (r1, r2) its radii across it: along y, [y, x, z, rx, rz]; along z,
 * [z, x, y, rx, ry]. Angle 0 is +z (along y) or +y (along z), so a skin
 * can be cut to the angles a0..a1 (an open shell: a saddle cloth, a
 * cloak's back). Options:
 *   seg            steps round
 *   deform(p, th, t, i)   move point p {x, y, z}: th its angle, t its share along the rings
 *   tint(p, th, t)        its vertex colour (a number or [r, g, b])
 *   caps           close both ends (only for a full turn)
 * Faces point out of the skin; normals are smooth.
 */
export function loft(rings, { seg = 16, axis = 'y', deform = null, tint = null, caps = true, a0 = 0, a1 = TAU, smooth = 1 } = {}) {
  // `smooth`: rings between the given ones (a Catmull-Rom curve through each of a ring's numbers), so
  // a few rings make a body that turns smoothly, not one of flat bands a polished bronze shows up.
  if (smooth > 1 && rings.length > 2) rings = smoothRings(rings, smooth);
  const N = rings.length;
  const full = Math.abs(a1 - a0 - TAU) < 1e-6;
  const cols = seg + 1;
  const pos = [];
  const uv = [];
  const col = [];
  const idx = [];
  // Arc along the rings (v) and the girth (u), in metres.
  const span = [0];
  for (let i = 1; i < N; i++) span.push(span[i - 1] + Math.hypot(rings[i][0] - rings[i - 1][0], rings[i][3] - rings[i - 1][3]));
  const total = span[N - 1] || 1;
  const p = { x: 0, y: 0, z: 0 };
  const point = (r, th) => {
    const [a, c1, c2, r1, r2] = r;
    const s = Math.sin(th);
    const c = Math.cos(th);
    if (axis === 'y') {
      p.x = c1 + r1 * s;
      p.y = a;
      p.z = c2 + r2 * c;
    } else {
      p.x = c1 + r1 * s;
      p.y = c2 + r2 * c;
      p.z = a;
    }
  };
  const push = (r, th, t, i, u, v) => {
    point(r, th);
    if (deform) deform(p, th, t, i);
    pos.push(p.x, p.y, p.z);
    uv.push(u, v);
    const k = tint ? tint(p, th, t) : 1;
    if (typeof k === 'number') col.push(k, k, k);
    else col.push(k[0], k[1], k[2]);
  };
  for (let i = 0; i < N; i++) {
    const r = rings[i];
    const girth = Math.PI * (r[3] + r[4]) * ((a1 - a0) / TAU);
    for (let j = 0; j <= seg; j++) {
      const th = a0 + ((a1 - a0) * j) / seg;
      push(r, full && j === seg ? a0 : th, span[i] / total, i, (j / seg) * girth, span[i]);
    }
  }
  // (A ring along z is the y-axis ring with y and z swapped: a mirror, so its faces wind the other way.)
  const flip = axis !== 'y';
  const tri = (a, b, c) => (flip ? idx.push(a, c, b) : idx.push(a, b, c));
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      tri(a, b, c);
      tri(b, d, c);
    }
  }
  if (caps && full) {
    // Each cap a fan of its own points (the ring's copied), so its edge stays sharp: shared with the
    // skin, the normals there would bend round the end and shade a dark band where two runs meet.
    for (const [i, sign] of [[0, -1], [N - 1, 1]]) {
      const r = rings[i];
      const centre = pos.length / 3;
      push([r[0], r[1], r[2], 0, 0], 0, i / Math.max(1, N - 1), i, 0, span[i]);
      const ring = pos.length / 3;
      for (let j = 0; j < seg; j++) {
        const s = i * cols + j;
        pos.push(pos[s * 3], pos[s * 3 + 1], pos[s * 3 + 2]);
        uv.push(uv[s * 2], uv[s * 2 + 1]);
        col.push(col[s * 3], col[s * 3 + 1], col[s * 3 + 2]);
      }
      for (let j = 0; j < seg; j++) {
        const a = ring + j;
        const b = ring + ((j + 1) % seg);
        if (sign > 0) tri(centre, a, b);
        else tri(centre, b, a);
      }
    }
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  if (full) {
    // The seam: the first and last columns are the same points; give both the sum of their normals.
    const n = g.attributes.normal.array;
    for (let i = 0; i < N; i++) {
      const A = i * cols * 3;
      const B = (i * cols + seg) * 3;
      const v = [n[A] + n[B], n[A + 1] + n[B + 1], n[A + 2] + n[B + 2]];
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      for (let q = 0; q < 3; q++) n[A + q] = n[B + q] = v[q] / l;
    }
  }
  return g;
}

/** Rings `k` times as many, each number of a ring on a Catmull-Rom curve through the given ones. */
function smoothRings(rings, k) {
  const out = [];
  const n = rings.length;
  const at = (i) => rings[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    for (let s = 0; s < k; s++) {
      const t = s / k;
      const p0 = at(i - 1);
      const p1 = at(i);
      const p2 = at(i + 1);
      const p3 = at(i + 2);
      out.push(p1.map((_, j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t * t * t)));
    }
  }
  out.push(rings[n - 1]);
  // (A curve may overshoot a radius to below nothing at a pointed end: keep them positive.)
  for (const r of out) {
    r[3] = Math.max(0.001, r[3]);
    r[4] = Math.max(0.001, r[4]);
  }
  return out;
}

/** A ball of radius r squashed by (sx, sy, sz) at (x, y, z): a joint, a deltoid, a fist. */
function ellipsoid(r, sx, sy, sz, x, y, z, w = 10, h = 8) {
  const g = new SphereGeometry(r, w, h);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return tintGeometry(boxUV(g));
}

/** A tapering limb a -> b -> c (Vector3s or arrays), radii r0 to r1, swelling by `bulge` at t = at. */
function member(pts, r0, r1, { radial = 10, segs = 8, bulge = 0, at = 0.35, wide = 0.25 } = {}) {
  return limb(pts, r0, r1, { radial, segs, bump: bulge ? (t) => bulge * gauss(t - at, wide) : null });
}

// ---------------------------------------------------------------------------
// The head
// ---------------------------------------------------------------------------

/**
 * A portrait head at (x, y, z) (the middle of the skull), turned ry, its
 * face toward +z: the skull and jaw, the nose, brows and eye sockets cut
 * so the light finds a face, ears, the hair in short locks (Augustus's
 * comma-shaped fringe), a beard (`beard`: Marcus Aurelius's), a laurel
 * wreath (`wreath`). Returns { skin, hair, wreath } geometries.
 */
export function head(x, y, z, ry = 0, { lod = 0, beard = false, wreath = false, scale = 1, veil = false } = {}) {
  const w = lod === 2 ? 8 : lod ? 14 : 24;
  const h = lod === 2 ? 6 : lod ? 10 : 18;
  const g = new SphereGeometry(1, w, h);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    let px = P.getX(i);
    let py = P.getY(i);
    let pz = P.getZ(i);
    // The jaw narrows and the chin comes forward under the face.
    const low = smoothstep(0.0, -0.9, py);
    px *= 1 - 0.28 * low;
    pz *= 1 - 0.12 * low;
    if (pz > 0 && py < -0.3) pz += 0.08 * smoothstep(-0.3, -0.8, py) * gauss(px, 0.5);
    // The face flatter than the skull; the back of the skull fuller.
    if (pz > 0.5) pz = 0.5 + (pz - 0.5) * 0.7;
    if (pz < -0.3 && py > -0.2) pz -= 0.06 * gauss(py - 0.25, 0.5);
    if (lod < 2) {
      const front = smoothstep(0.55, 0.9, P.getZ(i));
      // The nose: a ridge down the middle of the face, deepest at its tip.
      pz += front * 0.42 * gauss(px, 0.12) * smoothstep(0.12, -0.32, py) * smoothstep(-0.48, -0.3, py);
      // The brow over the eyes, the sockets under it, the mouth's line.
      pz += front * 0.11 * gauss(py - 0.12, 0.08) * gauss(Math.abs(px) - 0.3, 0.3);
      pz -= front * 0.15 * gauss(py + 0.02, 0.1) * gauss(Math.abs(px) - 0.32, 0.14);
      pz -= front * 0.04 * gauss(py + 0.52, 0.04) * gauss(px, 0.25);
    }
    P.setXYZ(i, px * 0.085, py * 0.112, pz * 0.1);
  }
  g.computeVertexNormals();
  const skin = [tintGeometry(boxUV(g), (px, py, pz) => 0.82 + 0.18 * smoothstep(-0.05, 0.08, pz) - 0.12 * gauss(py + 0.002, 0.012) * smoothstep(0.06, 0.09, pz))];
  // Ears.
  if (lod < 2) for (const s of [-1, 1]) skin.push(ellipsoid(0.026, 0.45, 1, 0.75, s * 0.083, -0.005, -0.012, 7, 5));
  // The neck under it.
  skin.push(member([[0, -0.2, -0.02], [0, -0.13, -0.008], [0, -0.06, 0.0]], 0.052, 0.05, { radial: lod ? 8 : 12, segs: 2 }));
  const hair = [];
  if (veil) {
    // The toga drawn over the head (capite velato), as a magistrate sacrificing.
    const v = new SphereGeometry(1.08, w, h, 0, TAU, 0, Math.PI * 0.62);
    v.scale(0.1, 0.122, 0.112);
    v.rotateX(-0.2);
    v.translate(0, 0.004, -0.012);
    hair.push(tintGeometry(boxUV(v), (px, py) => 0.86 + 0.14 * smoothstep(-0.06, 0.1, py)));
  } else if (lod < 2) {
    // The hair: a cap over the skull, cut at the brow, lower at the nape, in locks.
    const cap = new SphereGeometry(1, w, Math.round(h * 0.7), 0, TAU, 0, Math.PI * 0.58);
    const C = cap.attributes.position;
    for (let i = 0; i < C.count; i++) {
      const th = Math.atan2(C.getX(i), C.getZ(i));
      const ph = Math.acos(Math.max(-1, Math.min(1, C.getY(i))));
      const lock = lod === 0 ? 0.05 * Math.sin(th * 16 + ph * 6) * Math.sin(ph * 11) : 0;
      // (Lower over the nape than over the brow.)
      const back = Math.max(0, -Math.cos(th));
      const k = 1.06 + lock;
      C.setXYZ(i, C.getX(i) * 0.087 * k, (C.getY(i) - back * 0.25 * smoothstep(0.6, 1.4, ph)) * 0.115 * k, C.getZ(i) * 0.103 * k);
    }
    cap.rotateX(-0.32);
    cap.translate(0, 0.012, -0.006);
    cap.computeVertexNormals();
    hair.push(tintGeometry(boxUV(cap), (px, py, pz) => 0.8 + 0.2 * smoothstep(0, 0.1, py)));
  }
  if (beard && lod < 2) {
    const b = new SphereGeometry(1, w, h);
    const B = b.attributes.position;
    for (let i = 0; i < B.count; i++) {
      const curl = lod === 0 ? 0.06 * Math.sin(B.getX(i) * 19) * Math.sin(B.getY(i) * 17) : 0;
      B.setXYZ(i, B.getX(i) * 0.074 * (1 + curl), B.getY(i) * 0.07 * (1 + curl), B.getZ(i) * 0.06 * (1 + curl));
    }
    b.translate(0, -0.075, 0.045);
    b.computeVertexNormals();
    hair.push(tintGeometry(boxUV(b), () => 0.85));
  }
  const wreaths = [];
  if (wreath && lod < 2) {
    // The corona laurea: leaves along a band round the head, over the brow.
    const n = lod ? 12 : 26;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      const leaf = new SphereGeometry(0.018, 5, 3);
      leaf.scale(1, 0.45, 1.8);
      leaf.rotateY(a + Math.PI / 2 + 0.6);
      leaf.rotateZ(0.3 * Math.sin(k * 2.1));
      leaf.translate(Math.sin(a) * 0.092, 0.05 + 0.025 * Math.cos(a), Math.cos(a) * 0.104 - 0.006);
      wreaths.push(tintGeometry(boxUV(leaf)));
    }
  }
  const m = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ry), new Vector3(scale, scale, scale));
  for (const list of [skin, hair, wreaths]) for (const q of list) q.applyMatrix4(m);
  return { skin, hair, wreath: wreaths };
}

// ---------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------

/** A hand at wrist `w` reaching along `dir` (Vector3), palm facing `palm`: a paddle with its thumb. */
function hand(w, dir, palm, lod) {
  const d = dir.clone().normalize();
  const n = palm.clone().sub(d.clone().multiplyScalar(palm.dot(d))).normalize();
  const side = new Vector3().crossVectors(d, n).normalize();
  const g = new BoxGeometry(0.075, 0.11, 0.032, 1, lod ? 1 : 3, 1);
  // Rounded off: the fingers' ends and the heel of the hand.
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const yy = P.getY(i);
    P.setX(i, P.getX(i) * (1 - 0.25 * smoothstep(0.02, 0.055, yy)));
    P.setZ(i, P.getZ(i) * (1 - 0.4 * smoothstep(0.03, 0.055, yy)));
  }
  g.computeVertexNormals();
  g.translate(0, 0.055, 0);
  const basis = new Matrix4().makeBasis(side, d, n);
  g.applyMatrix4(basis);
  g.translate(w.x, w.y, w.z);
  const thumb = member([w.clone().addScaledVector(side, 0.03), w.clone().addScaledVector(side, 0.055).addScaledVector(d, 0.035).addScaledVector(n, 0.02), w.clone().addScaledVector(side, 0.06).addScaledVector(d, 0.065).addScaledVector(n, 0.025)], 0.014, 0.01, { radial: 5, segs: 3 });
  return [tintGeometry(boxUV(g)), thumb];
}

const v3 = (a) => new Vector3(a[0], a[1], a[2]);

/**
 * An arm from the shoulder `sh` by the elbow `el` to the wrist `wr` ([x, y,
 * z]), the hand reaching on along `reach` with its palm toward `palm`:
 * the deltoid, the upper arm, the forearm, the hand. Returns geometries.
 */
function arm(sh, el, wr, reach, palm, lod, { bare = true } = {}) {
  const radial = lod === 2 ? 5 : lod ? 7 : 11;
  const out = [];
  const S = v3(sh);
  const E = v3(el);
  const W = v3(wr);
  out.push(ellipsoid(0.066, 1, 0.95, 0.95, S.x * 1.02, S.y, S.z, lod ? 8 : 12, lod ? 6 : 9));
  out.push(member([S, S.clone().lerp(E, 0.5), E], 0.063, 0.045, { radial, segs: lod ? 3 : 6, bulge: bare ? 0.16 : 0.06, at: 0.45 }));
  out.push(ellipsoid(0.046, 1, 1, 1, E.x, E.y, E.z, lod ? 7 : 10, lod ? 5 : 7));
  out.push(member([E, E.clone().lerp(W, 0.5), W], 0.048, 0.03, { radial, segs: lod ? 3 : 6, bulge: bare ? 0.18 : 0, at: 0.22 }));
  if (lod < 2) out.push(...hand(W, v3(reach), v3(palm), lod));
  return out;
}

/** A leg from the hip by the knee to the ankle ([x, y, z]), the foot pointing along `toe`; `sole`: a sandal under it. */
function leg(hip, knee, ankle, toe, lod) {
  const radial = lod === 2 ? 5 : lod ? 8 : 12;
  const H = v3(hip);
  const K = v3(knee);
  const A = v3(ankle);
  const out = [];
  out.push(member([H, H.clone().lerp(K, 0.5), K], 0.102, 0.06, { radial, segs: lod ? 3 : 7, bulge: 0.14, at: 0.25, wide: 0.3 }));
  out.push(ellipsoid(0.047, 1, 1.1, 1, K.x, K.y, K.z + 0.012, lod ? 7 : 10, lod ? 5 : 8));
  out.push(member([K, K.clone().lerp(A, 0.5), A], 0.058, 0.035, { radial, segs: lod ? 3 : 7, bulge: 0.3, at: 0.26, wide: 0.2 }));
  // The foot: a wedge from the heel to the toes, along `toe`.
  const t = v3(toe).normalize();
  const g = new BoxGeometry(0.085, 0.07, 0.25, 1, 1, lod ? 1 : 3);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const zz = P.getZ(i);
    // Lower toward the toes, rounded at the heel.
    if (P.getY(i) > 0) P.setY(i, P.getY(i) - 0.045 * smoothstep(-0.05, 0.12, zz));
    P.setX(i, P.getX(i) * (1 - 0.3 * smoothstep(0.06, 0.125, zz)));
  }
  g.computeVertexNormals();
  g.translate(0, 0.035, 0.06);
  g.rotateY(Math.atan2(t.x, t.z));
  g.rotateX(-Math.asin(Math.max(-1, Math.min(1, t.y))));
  g.translate(A.x, A.y - 0.07, A.z);
  out.push(tintGeometry(boxUV(g)));
  return out;
}

/** The torso's rings, hips to neck ([y, x, z, rx, rz]) for a man of 1.8 m. */
const TORSO = [
  [0.84, 0, -0.012, 0.148, 0.108], [0.92, 0, -0.016, 0.17, 0.122], [1.0, 0, -0.008, 0.162, 0.114],
  [1.08, 0, -0.002, 0.146, 0.104], [1.18, 0, 0.004, 0.157, 0.11], [1.28, 0, 0.008, 0.178, 0.12],
  [1.37, 0, 0.004, 0.192, 0.118], [1.44, 0, -0.008, 0.2, 0.1], [1.495, 0, -0.012, 0.172, 0.088], [1.54, 0, -0.006, 0.072, 0.064],
];

/**
 * The torso: a skin over TORSO, its weight on the right leg (the right hip
 * up, the left shoulder up: contrapposto), and on its front the chest and
 * belly a sculptor gave a hero, which the muscle cuirass copies in bronze
 * (`cuirass`: its edge flared over the hips, its rib down the middle).
 */
function torso(lod, { cuirass = false, shift = 0, sway = 1 } = {}) {
  const seg = lod === 2 ? 8 : lod ? 14 : 26;
  // (A hero's build: broader and deeper than the town's people, as the sculptors gave it.)
  const rings = TORSO.filter((r, i) => lod < 2 || i % 2 === 0 || i === TORSO.length - 1).map((r, i, a) => [r[0] + shift, r[1], r[2], r[3] * (i === a.length - 1 ? 1.15 : 1.1), r[4] * (i === a.length - 1 ? 1.1 : 1.14)]);
  return loft(rings, {
    seg, smooth: lod === 2 ? 1 : lod ? 2 : 3,
    deform: (p, th) => {
      const y = p.y - shift;
      const front = Math.max(0, Math.cos(th));
      // The pectorals, the belly's ridges, the line down the middle.
      p.z += front * (0.022 * gauss(y - 1.33, 0.06) * gauss(Math.abs(p.x) - 0.085, 0.07) + 0.008 * gauss(y - 1.16, 0.08) * gauss(Math.abs(p.x) - 0.045, 0.04));
      p.z -= front * 0.006 * gauss(p.x, 0.014) * smoothstep(1.02, 1.12, y) * smoothstep(1.42, 1.3, y);
      if (cuirass) p.z += front * 0.012 * gauss(y - 1.0, 0.03);
      // Contrapposto: the right hip up, the left shoulder up.
      p.y += sway * (0.022 * (p.x / 0.17) * smoothstep(1.12, 0.92, y) - 0.012 * (p.x / 0.2) * smoothstep(1.28, 1.44, y));
    },
    tint: (q) => 0.8 + 0.2 * smoothstep(0.85 + shift, 1.3 + shift, q.y),
  });
}

/**
 * A skirt of folds from `top` (y) down to the hem at `hem`, flaring from
 * `r0` to `r1` (rx; rz is 0.72 of it): a tunic's, a toga's, a peplos's.
 * `folds` how many round it, `deep` their depth at the hem.
 */
function skirt(top, hem, r0, r1, lod, { folds = 11, deep = 0.018, cz = 0, seed = 1, depth = 0.72, back = 0 } = {}) {
  const rnd = artRng(seed);
  const ph = rnd() * TAU;
  const n = lod === 2 ? 3 : lod ? 5 : 9;
  const rings = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const y = top + (hem - top) * t;
    const r = r0 + (r1 - r0) * Math.pow(t, 0.8);
    rings.push([y, 0, cz - back * t, r, r * depth]);
  }
  return loft(rings, {
    seg: lod === 2 ? 10 : lod ? 18 : 36,
    caps: true,
    deform: (p, th, t) => {
      if (lod === 2) return;
      // Folds deepening toward the hem, the hem itself uneven.
      const f = Math.sin(th * folds + ph + Math.sin(th * 3 + ph) * 0.8);
      const k = 1 + (deep / r1) * f * (0.25 + 0.75 * t);
      p.x *= k;
      p.z = cz - back * t + (p.z - cz + back * t) * k;
      if (t > 0.98) p.y += 0.012 * Math.sin(th * 5 + ph);
    },
    tint: (q, th, t) => 0.9 - 0.25 * Math.max(0, -Math.sin(th * folds + ph)) * (0.3 + 0.7 * t),
  });
}

/** A hanging drape from `top` [x, y, z] down to `bottom`, `w0` to `w1` wide, `thick`, in folds (a cloak off the arm). */
function drape(top, bottom, w0, w1, lod, { thick = 0.035, folds = 4, seed = 1, turn = 0 } = {}) {
  const rnd = artRng(seed);
  const ph = rnd() * TAU;
  const n = lod === 2 ? 2 : lod ? 4 : 8;
  const rings = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    rings.push([top[1] + (bottom[1] - top[1]) * t, top[0] + (bottom[0] - top[0]) * t, top[2] + (bottom[2] - top[2]) * t, w0 + (w1 - w0) * t, thick * (1 + t * 0.6)]);
  }
  const g = loft(rings, {
    seg: lod === 2 ? 6 : lod ? 10 : 20,
    deform: (p, th, t) => {
      if (lod === 2) return;
      const f = Math.sin(Math.sin(th) * folds * 2.2 + ph);
      p.z += f * 0.022 * (0.3 + t);
      if (t > 0.97) p.y += 0.04 * Math.abs(Math.sin(th * 2 + ph));
    },
    tint: (q, th) => 0.82 + 0.18 * Math.cos(th),
  });
  if (turn) {
    const cx = (top[0] + bottom[0]) / 2;
    const cz = (top[2] + bottom[2]) / 2;
    g.translate(-cx, 0, -cz).rotateY(turn).translate(cx, 0, cz);
  }
  return g;
}

/** A spear or a sceptre from `a` to `b`, a leaf-shaped head (`spear`) or a knob and an eagle's perch (sceptre). */
function staffOf(a, b, r, lod, kind = 'spear') {
  const out = [];
  const A = v3(a);
  const B = v3(b);
  const len = A.distanceTo(B);
  const g = new CylinderGeometry(r, r * 1.1, len, lod ? 6 : 8, 1);
  g.translate(0, len / 2, 0);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q);
  g.translate(A.x, A.y, A.z);
  out.push(tintGeometry(boxUV(g)));
  const d = B.clone().sub(A).normalize();
  if (kind === 'spear') {
    const tip = new ConeGeometry(r * 2.6, 0.24, lod ? 4 : 6, 1);
    tip.scale(1, 1, 0.35);
    tip.translate(0, 0.12, 0);
    tip.applyQuaternion(q);
    tip.translate(B.x, B.y, B.z);
    out.push(tintGeometry(boxUV(tip)));
  } else {
    out.push(ellipsoid(r * 2.6, 1, 1, 1, B.x + d.x * r * 2, B.y + d.y * r * 2, B.z + d.z * r * 2, lod ? 6 : 10, lod ? 4 : 7));
  }
  return out;
}

/**
 * A man of 1.8 m in a statue's pose (the header says which): { flesh,
 * cloth, gear, hair, wreath } geometries, standing on y 0 (the seated on
 * his throne's seat, the rider astride with his seat at y 0), facing +z.
 */
export function figure(pose = 'cuirass', { lod = 0, seed = 1, beard = false, wreath = false } = {}) {
  const out = { flesh: [], cloth: [], gear: [], hair: [], wreath: [] };
  const R = lod === 2 ? 5 : lod ? 8 : 12;
  const headAt = (dy = 0, dz = 0, ry = 0.12) => {
    const h = head(0.004, 1.705 + dy, 0.02 + dz, ry, { lod, beard, wreath, scale: 1.08 });
    out.flesh.push(...h.skin);
    out.hair.push(...h.hair);
    out.wreath.push(...h.wreath);
  };
  if (pose === 'cuirass') {
    // The weight on the right leg, the left drawn back on its toes.
    out.flesh.push(...leg([0.09, 0.92, 0], [0.095, 0.5, 0.025], [0.09, 0.09, 0.0], [0.15, 0, 1], lod));
    out.flesh.push(...leg([-0.09, 0.9, -0.01], [-0.12, 0.5, -0.04], [-0.15, 0.13, -0.17], [-0.12, -0.4, 1], lod));
    out.gear.push(torso(lod, { cuirass: true }));
    // The leather strips under the cuirass's edge, two rows, and the tunic's hem under them.
    out.cloth.push(skirt(0.97, 0.7, 0.17, 0.19, lod, { folds: 13, deep: 0.012, seed }));
    if (lod < 2) {
      const strips = lod ? 10 : 18;
      for (let row = 0; row < 2; row++) {
        for (let k = 0; k < strips; k++) {
          const a = ((k + row * 0.5) / strips) * TAU;
          const s = new BoxGeometry(0.05, 0.12, 0.012);
          s.translate(0, -0.06, 0);
          s.rotateX(0.22);
          s.rotateY(a);
          s.translate(Math.sin(a) * 0.175, 0.99 - row * 0.07, Math.cos(a) * 0.125 - 0.01);
          out.gear.push(tintGeometry(boxUV(s), () => 0.9 - row * 0.1));
        }
      }
    }
    // The right arm raised to speak, the left forward under the cloak with the spear.
    out.flesh.push(...arm([0.205, 1.45, -0.005], [0.33, 1.54, 0.13], [0.36, 1.8, 0.2], [0.02, 1, 0.12], [0, 0.05, 1], lod));
    out.flesh.push(...arm([-0.205, 1.44, -0.005], [-0.25, 1.19, 0.06], [-0.25, 1.1, 0.29], [0, 0.25, 1], [1, 0, 0], lod));
    // The cuirass's lower rim over the hips, its shoulder guards.
    if (lod < 2) {
      out.gear.push(loft([[0.965, 0, -0.012, 0.192, 0.142], [0.995, 0, -0.01, 0.198, 0.146], [1.02, 0, -0.008, 0.188, 0.136]], { seg: lod ? 16 : 30, caps: false }));
      for (const s of [-1, 1]) out.gear.push(ellipsoid(0.085, 0.9, 0.5, 1.05, s * 0.215, 1.47, -0.005, lod ? 8 : 12, lod ? 5 : 8));
    }
    // The cloak: wound round the hips in heavy folds (higher on the left), its end gathered over the
    // left forearm and hanging below it. A shell of cloth over the hips, faced inside too.
    const sash = (k, a0, a1) => loft([[0.85, 0, -0.012, 0.205 * k, 0.158 * k], [0.92, 0, -0.014, 0.228 * k, 0.174 * k], [0.99, 0, -0.012, 0.224 * k, 0.17 * k], [1.06, 0, -0.008, 0.198 * k, 0.15 * k]], {
      seg: lod === 2 ? 8 : lod ? 14 : 30, a0, a1, caps: false,
      deform: (p, th) => {
        p.y -= 0.05 * Math.sin(th);
        if (lod < 2) {
          const f = 1 + 0.07 * Math.sin(th * 9 + p.y * 30);
          p.x *= f;
          p.z = -0.012 + (p.z + 0.012) * f;
        }
      },
      tint: (q, th) => 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(th * 9 + q.y * 30)),
    });
    out.cloth.push(sash(1, -Math.PI * 0.82, Math.PI * 0.62), sash(0.97, Math.PI * 0.62, -Math.PI * 0.82));
    out.cloth.push(tube([[-0.21, 1.0, 0.1], [-0.25, 1.07, 0.17], [-0.26, 1.12, 0.25]], 0.05, { radial: R, segments: lod ? 4 : 10, around: 0.3 }));
    out.cloth.push(drape([-0.28, 1.08, 0.21], [-0.3, 0.36, 0.16], 0.08, 0.14, lod, { seed: seed + 3, turn: 0.3, thick: 0.045 }));
    out.gear.push(...staffOf([-0.245, 0.0, 0.31], [-0.245, 2.15, 0.31], 0.013, lod, 'spear'));
    // A shoulder strap of the cuirass, and the support a marble needs by its standing leg (a stump).
    if (lod < 2) for (const s of [-1, 1]) out.gear.push(tube([[s * 0.11, 1.33, 0.11], [s * 0.15, 1.47, 0.03], [s * 0.13, 1.44, -0.09]], 0.018, { radial: 5, segments: 6 }));
    headAt();
  } else if (pose === 'toga') {
    out.flesh.push(...leg([0.09, 0.92, 0], [0.095, 0.5, 0.02], [0.09, 0.09, 0.0], [0.12, 0, 1], lod));
    out.flesh.push(...leg([-0.09, 0.9, 0], [-0.1, 0.5, 0.03], [-0.12, 0.11, -0.06], [-0.15, -0.25, 1], lod));
    out.cloth.push(torso(lod, { sway: 0.6 }));
    // The toga's long skirt to the ankles, its curved overfold across the front, the band over the chest.
    out.cloth.push(skirt(1.04, 0.07, 0.17, 0.235, lod, { folds: 9, deep: 0.022, seed, back: 0.02 }));
    out.cloth.push(tube([[0.18, 1.02, 0.02], [0.14, 0.82, 0.12], [0.02, 0.62, 0.18], [-0.12, 0.72, 0.16], [-0.19, 0.92, 0.08]], 0.04, { radial: R, segments: lod ? 10 : 24, around: 0.3 }));
    out.cloth.push(tube([[-0.17, 1.47, 0.02], [-0.08, 1.36, 0.12], [0.06, 1.2, 0.13], [0.17, 1.05, 0.06]], 0.042, { radial: R, segments: lod ? 8 : 18, around: 0.3 }));
    if (lod < 2) out.cloth.push(ellipsoid(0.06, 1.1, 0.9, 0.7, -0.05, 1.28, 0.12, 9, 7));
    // The left arm wrapped, its fold hanging from the forearm; the right down with a roll.
    out.cloth.push(...arm([-0.205, 1.44, -0.005], [-0.24, 1.2, 0.05], [-0.22, 1.12, 0.27], [0.1, 0.15, 1], [1, 0, 0], lod, { bare: false }).slice(0, 3));
    out.cloth.push(ellipsoid(0.07, 1, 0.8, 1, -0.205, 1.43, -0.005, R, R - 2));
    out.cloth.push(drape([-0.24, 1.08, 0.22], [-0.27, 0.35, 0.16], 0.06, 0.12, lod, { seed: seed + 4, turn: 0.25 }));
    if (lod < 2) out.flesh.push(...hand(v3([-0.22, 1.12, 0.27]), v3([0.1, 0.15, 1]), v3([1, 0, 0]), lod));
    out.flesh.push(...arm([0.205, 1.44, -0.005], [0.24, 1.17, 0.05], [0.23, 0.97, 0.17], [0, -0.2, 1], [-1, 0, 0], lod));
    if (lod < 2) out.gear.push(...staffOf([0.21, 0.98, 0.27], [0.25, 1.0, 0.03], 0.024, lod, 'roll'));
    headAt(0, 0, -0.1);
  } else if (pose === 'seated') {
    // On the throne's seat (y 0): the hips at its back, the thighs out over it, the feet on a footstool.
    const sy = 0.0;
    for (const s of [-1, 1]) {
      out.flesh.push(...leg([s * 0.1, sy + 0.08, -0.02], [s * 0.13, sy + 0.1, 0.43], [s * 0.15, sy - 0.33, 0.5 + (s < 0 ? -0.04 : 0.04)], [s * 0.1, 0, 1], lod));
    }
    out.flesh.push(torso(lod, { shift: sy + 0.08 - 0.9, sway: 0.4 }));
    // The mantle over the lap and down between the knees, its end over the left shoulder.
    const lap = loft([[sy - 0.02, 0, 0.22, 0.25, 0.3], [sy + 0.12, 0, 0.2, 0.26, 0.31], [sy + 0.2, 0, 0.12, 0.22, 0.2]], {
      seg: lod === 2 ? 8 : lod ? 14 : 28,
      deform: (p, th) => { if (lod < 2) { const f = Math.sin(th * 7 + 1.3); p.x *= 1 + 0.03 * f; p.z += 0.01 * f; } },
      tint: (q, th) => 0.85 + 0.15 * Math.cos(th),
    });
    out.cloth.push(lap);
    out.cloth.push(drape([0, sy + 0.05, 0.42], [0, sy - 0.36, 0.5], 0.13, 0.17, lod, { seed: seed + 5, thick: 0.05 }));
    out.cloth.push(tube([[-0.18, sy + 0.15, 0.1], [-0.2, sy + 0.4, 0.06], [-0.19, sy + 0.62, 0.04], [-0.16, sy + 0.6, -0.08], [-0.08, sy + 0.3, -0.12]], 0.06, { radial: R, segments: lod ? 8 : 20, around: 0.3 }));
    // The right arm high on the sceptre, the left forward with a Victory on a globe.
    const up = sy + 0.08 - 0.9;
    out.flesh.push(...arm([0.205, 1.45 + up, -0.005], [0.34, 1.6 + up, 0.04], [0.34, 1.83 + up, 0.1], [0, 1, 0], [-1, 0, 0], lod));
    out.gear.push(...staffOf([0.34, sy - 0.4, 0.13], [0.34, 2.3 + up, 0.13], 0.018, lod, 'sceptre'));
    out.flesh.push(...arm([-0.205, 1.44 + up, -0.005], [-0.25, 1.2 + up, 0.12], [-0.22, 1.1 + up, 0.36], [0, 0.4, 1], [0, 1, 0], lod));
    out.gear.push(ellipsoid(0.07, 1, 1, 1, -0.21, 1.2 + up, 0.42, lod ? 8 : 14, lod ? 6 : 10));
    if (lod < 2) for (const g of victory(lod, { scale: 0.13 })) out.gear.push(g.translate(-0.21, 1.27 + up, 0.42));
    const hh = head(0.004, 1.705 + up, 0.02, 0.05, { lod, beard: true, wreath: true });
    out.flesh.push(...hh.skin);
    out.hair.push(...hh.hair);
    out.wreath.push(...hh.wreath);
  } else if (pose === 'rider') {
    // Astride: the seat at y 0, the thighs down round the horse's barrel, the feet hanging free.
    for (const s of [-1, 1]) {
      out.flesh.push(...leg([s * 0.11, 0.05, 0.0], [s * 0.27, -0.27, 0.24], [s * 0.24, -0.72, 0.12], [s * 0.1, -0.5, 1], lod));
    }
    out.cloth.push(skirt(0.12, -0.12, 0.17, 0.27, lod, { folds: 9, deep: 0.015, seed, depth: 0.95 }));
    const up = 0.08 - 0.9;
    out.gear.push(torso(lod, { shift: up, sway: 0 }));
    // The cloak pinned on the right shoulder, falling behind over the horse's croup.
    out.cloth.push(loft([[1.5 + up, 0.0, -0.04, 0.17, 0.08], [1.3 + up, 0.0, -0.12, 0.23, 0.1], [0.9 + up, 0.0, -0.2, 0.27, 0.1], [0.45 + up, 0.0, -0.3, 0.3, 0.09], [0.12 + up, 0, -0.42, 0.31, 0.06]], {
      seg: lod === 2 ? 8 : lod ? 12 : 24, a0: Math.PI * 0.55, a1: Math.PI * 1.45, caps: false,
      deform: (p, th, t) => { if (lod < 2) p.z -= 0.025 * Math.abs(Math.sin(th * 9)) * t; },
      tint: (q, th) => 0.75 + 0.25 * Math.abs(Math.sin(th * 4.5)),
    }));
    // (The shell's inner face too, so it is solid seen from either side.)
    out.cloth.push(loft([[1.49 + up, 0.0, -0.035, 0.16, 0.07], [1.3 + up, 0.0, -0.11, 0.22, 0.09], [0.9 + up, 0.0, -0.19, 0.26, 0.09], [0.45 + up, 0.0, -0.29, 0.29, 0.08], [0.13 + up, 0, -0.41, 0.3, 0.05]], {
      seg: lod === 2 ? 8 : lod ? 12 : 24, a0: Math.PI * 1.45, a1: Math.PI * 0.55, caps: false,
    }));
    out.flesh.push(...arm([0.205, 1.44 + up, -0.005], [0.36, 1.43 + up, 0.17], [0.47, 1.47 + up, 0.37], [0.25, 0.05, 1], [0, -1, 0.1], lod));
    out.flesh.push(...arm([-0.205, 1.44 + up, -0.005], [-0.24, 1.18 + up, 0.12], [-0.13, 1.12 + up, 0.33], [0.3, -0.1, 1], [0, -0.3, 1], lod));
    const h = head(0.004, 1.705 + up, 0.02, 0.15, { lod, beard: true, wreath: false });
    out.flesh.push(...h.skin);
    out.hair.push(...h.hair);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The horse
// ---------------------------------------------------------------------------

/**
 * The Capitoline horse (Marcus Aurelius's): a heavy war horse of about
 * 1.55 m at the withers stepping out, its right foreleg raised high, its
 * neck arched, its head turned a little to the right, mane and tail
 * dressed, a saddle cloth (the Romans rode without stirrups). `pose`
 * 'step' (raised foreleg) or 'draw' (a quadriga's horse, the forelegs
 * pawing up together, the head higher). Facing +z, its hooves on y 0, the
 * rider's seat at `HORSE.seat`. Returns { body, cloth } geometries.
 */
export const HORSE = Object.freeze({ seat: [0, 1.52, 0.02] });

export function horse({ lod = 0, pose = 'step', turnHead = 0.18, cloth = true } = {}) {
  const radial = lod === 2 ? 5 : lod ? 8 : 12;
  const seg = lod === 2 ? 8 : lod ? 14 : 24;
  const body = [];
  // The barrel, rump to breast.
  const rings = [
    [-0.86, 0, 1.2, 0.05, 0.05], [-0.8, 0, 1.2, 0.16, 0.19], [-0.66, 0, 1.2, 0.235, 0.27], [-0.44, 0, 1.17, 0.25, 0.29],
    [-0.12, 0, 1.14, 0.255, 0.3], [0.2, 0, 1.17, 0.25, 0.31], [0.42, 0, 1.22, 0.225, 0.3], [0.56, 0, 1.27, 0.17, 0.25], [0.64, 0, 1.32, 0.06, 0.08],
  ];
  body.push(loft(lod === 2 ? rings.filter((r, i) => i % 2 === 0) : rings, {
    axis: 'z', seg, smooth: lod === 2 ? 1 : lod ? 2 : 4,
    deform: (p, th) => {
      // A flat back, the croup rounded either side of the spine, the belly hanging.
      const top = Math.max(0, Math.cos(th));
      if (top > 0.6) p.y -= 0.03 * (top - 0.6) * 2.5;
      p.x *= 1 + 0.06 * gauss(p.z + 0.62, 0.12) * top;
    },
    tint: (q) => 0.72 + 0.28 * smoothstep(0.85, 1.45, q.y),
  }));
  // The neck, arched; then the head, turned.
  const drawn = pose === 'draw';
  const withers = new Vector3(0, 1.42, 0.4);
  const crest = new Vector3(0, 1.82, 0.62);
  const poll = new Vector3(Math.sin(turnHead) * 0.08, drawn ? 2.1 : 2.0, drawn ? 0.76 : 0.8);
  const neck = limb([withers, new Vector3(0, 1.62, 0.56), crest, poll], 0.27, 0.13, { radial, segs: lod ? 5 : 10 });
  neck.scale(0.74, 1, 1);
  neck.computeVertexNormals();
  body.push(neck);
  const headRings = [[-0.06, 0, 0.01, 0.06, 0.08], [0.0, 0, -0.005, 0.095, 0.13], [0.1, 0, -0.035, 0.105, 0.16], [0.2, 0, -0.04, 0.085, 0.12], [0.32, 0, -0.045, 0.07, 0.09], [0.44, 0, -0.05, 0.068, 0.08], [0.52, 0, -0.055, 0.07, 0.075], [0.57, 0, -0.06, 0.05, 0.055], [0.6, 0, -0.06, 0.02, 0.025]];
  const hd = loft(headRings, {
    axis: 'z', seg: lod === 2 ? 6 : lod ? 12 : 20, smooth: lod === 2 ? 1 : 3,
    // The face flat down its front (the forehead and the bridge of the nose), the cheeks round.
    deform: (p, th) => { const c = Math.cos(th); if (c > 0.35) p.y -= (c - 0.35) * 0.05; },
    tint: (q) => 0.85 - 0.3 * smoothstep(0.4, 0.58, q.z),
  });
  hd.rotateX(drawn ? 0.8 : 1.0);
  hd.rotateY(turnHead);
  hd.translate(poll.x, poll.y, poll.z);
  body.push(hd);
  if (lod < 2) {
    // The ears, pricked; the mane dressed in a crest along the neck; the forelock.
    for (const s of [-1, 1]) {
      const e = new ConeGeometry(0.03, 0.13, 5, 1);
      e.translate(0, 0.065, 0);
      e.rotateZ(-s * 0.25);
      e.rotateX(-0.25);
      e.translate(poll.x + s * 0.05, poll.y + 0.06, poll.z - 0.03);
      body.push(tintGeometry(boxUV(e)));
    }
    const mane = tube([[0, 1.62, 0.36], [0, 1.83, 0.5], [0, 2.0, 0.6], [poll.x * 0.8, poll.y + 0.07, poll.z - 0.05]], 0.05, { radial: 6, segments: lod ? 8 : 16 });
    const M = mane.attributes.position;
    for (let i = 0; i < M.count; i++) M.setX(i, M.getX(i) * 0.5);
    mane.computeVertexNormals();
    body.push(mane);
  }
  // The legs: forearm, knee, cannon, fetlock, pastern, hoof.
  const legOf = (pts, r0) => {
    const P = pts.map(v3);
    // The forearm or the gaskin heavy with muscle where it leaves the body, the cannon below lean.
    body.push(member(P.slice(0, 3), r0, r0 * 0.5, { radial, segs: lod ? 3 : 7, bulge: 0.25, at: 0.3, wide: 0.25 }));
    body.push(member(P.slice(2), r0 * 0.4, r0 * 0.32, { radial: Math.max(5, radial - 2), segs: lod ? 3 : 6, bulge: 0.3, at: 0.72, wide: 0.1 }));
    const hoof = new CylinderGeometry(0.05, 0.065, 0.08, radial, 1);
    const end = P[P.length - 1];
    const prev = P[P.length - 2];
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), end.clone().sub(prev).normalize());
    hoof.applyQuaternion(q);
    hoof.translate(end.x, end.y, end.z);
    body.push(tintGeometry(boxUV(hoof), () => 0.6));
  };
  const fx = 0.15;
  // Hind legs: hip, stifle, hock, fetlock, hoof.
  for (const s of [-1, 1]) legOf([[s * fx, 1.12, -0.6], [s * fx * 1.1, 0.86, -0.4], [s * fx, 0.56, -0.72], [s * fx, 0.2, -0.64], [s * fx, 0.04, -0.58]], 0.19);
  // Forelegs: one planted, one raised (the right), or both pawing (drawing a chariot).
  const raised = (s) => [[s * fx, 1.1, 0.42], [s * fx, 0.86, 0.5], [s * fx, 0.84, 0.76], [s * fx, 0.6, 0.72], [s * fx, 0.52, 0.8]];
  const planted = (s) => [[s * fx, 1.1, 0.42], [s * fx, 0.8, 0.44], [s * fx, 0.5, 0.45], [s * fx, 0.2, 0.47], [s * fx, 0.04, 0.5]];
  legOf(raised(1), 0.16);
  legOf(drawn ? raised(-1).map(([x, y, z]) => [x, y + 0.04, z - 0.03]) : planted(-1), 0.16);
  // The tail, dressed and falling.
  body.push(limb([[0, 1.24, -0.82], [0, 1.18, -0.98], [0, 0.85, -1.02], [0, 0.56, -0.98]], 0.06, 0.045, { radial: Math.max(5, radial - 3), segs: lod ? 4 : 10, bump: (t) => 0.6 * gauss(t - 0.55, 0.3) }));
  const clothes = [];
  if (cloth) {
    // The saddle cloth over the back and down the flanks, its fringe.
    clothes.push(loft([[-0.22, 0, 1.17, 0.27, 0.32], [0.04, 0, 1.17, 0.27, 0.325], [0.26, 0, 1.18, 0.265, 0.325]], {
      axis: 'z', seg: lod ? 10 : 18, a0: -Math.PI * 0.42, a1: Math.PI * 0.42, caps: false,
      tint: (q) => 0.75 + 0.25 * smoothstep(1.0, 1.4, q.y),
    }));
  }
  return { body, cloth: clothes };
}

// ---------------------------------------------------------------------------
// Victory
// ---------------------------------------------------------------------------

/**
 * A winged Victory (Nike) alighting on a globe, a wreath held up in her
 * right hand, her peplos blown back: the statuette the Romans set on a
 * column or in an emperor's hand. 1 m tall at `scale` 1 (the globe's top
 * at y 0, her feet on it). Returns geometries.
 */
export function victory(lod = 0, { scale = 1 } = {}) {
  const out = [];
  const R = lod === 2 ? 5 : 7;
  // Her dress, blown back, the body over it; head; arms; wings.
  out.push(skirt(0.56, 0.0, 0.11, 0.14, lod, { folds: 7, deep: 0.012, back: 0.08 }));
  out.push(loft([[0.5, 0, -0.01, 0.1, 0.075], [0.62, 0, 0, 0.11, 0.08], [0.74, 0, 0, 0.12, 0.075], [0.8, 0, -0.005, 0.075, 0.05]], { seg: lod ? 10 : 16 }));
  out.push(ellipsoid(0.055, 1, 1.15, 1, 0, 0.88, 0.01, lod ? 8 : 12, lod ? 6 : 9));
  out.push(member([[0.11, 0.77, 0], [0.18, 0.88, 0.05], [0.2, 1.0, 0.08]], 0.025, 0.018, { radial: R, segs: 4 }));
  out.push(member([[-0.11, 0.77, 0], [-0.15, 0.64, 0.06], [-0.12, 0.58, 0.14]], 0.025, 0.018, { radial: R, segs: 4 }));
  const wr = new TorusGeometry(0.045, 0.01, 4, lod ? 8 : 14);
  wr.translate(0.2, 1.05, 0.08);
  out.push(tintGeometry(boxUV(wr)));
  if (lod < 2) {
    // A palm frond in her left hand.
    out.push(tube([[-0.12, 0.58, 0.14], [-0.14, 0.4, 0.18], [-0.12, 0.2, 0.2]], 0.008, { radial: 4, segments: 6 }));
  }
  for (const s of [-1, 1]) {
    // A wing: a feathered blade sweeping up and back from the shoulder, its edge scalloped.
    const pts = [];
    const n = lod ? 6 : 12;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      pts.push([s * (0.06 + 0.22 * t), 0.78 + 0.42 * Math.sin(t * 1.9) - 0.1 * t, -0.06 - 0.24 * t]);
    }
    const w = tube(pts, 0.03, { radial: 6, segments: n * 2 });
    const W = w.attributes.position;
    // Flattened, and broadening downward into the feathers' edge.
    for (let i = 0; i < W.count; i++) {
      const y = W.getY(i);
      W.setY(i, y - (lod < 2 ? 0.12 * Math.abs(Math.sin((W.getZ(i) + 0.06) * 30)) : 0.08) * smoothstep(0.78, 1.0, y));
    }
    w.scale(1, 1, 1);
    w.computeVertexNormals();
    out.push(w);
    const blade = loft([[0.78, s * 0.14, -0.2, 0.12, 0.018], [0.98, s * 0.2, -0.24, 0.1, 0.014], [1.12, s * 0.24, -0.27, 0.05, 0.01]], { seg: lod ? 8 : 12 });
    blade.rotateZ(s * -0.15);
    out.push(blade);
  }
  for (const g of out) g.scale(scale, scale, scale);
  return out;
}

// ---------------------------------------------------------------------------
// Letters
// ---------------------------------------------------------------------------

/** The letters an inscription needs besides masonry.js GLYPHS: N, D, Q. */
const EXTRA = Object.freeze({
  N: { w: 0.7, s: [[0, 0, 0, 1], [0, 1, 0.7, 0], [0.7, 0, 0.7, 1]] },
  D: { w: 0.66, s: [[0, 0, 0, 1], [0, 1, 0.34, 1], [0.34, 1, 0.58, 0.84], [0.58, 0.84, 0.66, 0.5], [0.66, 0.5, 0.58, 0.16], [0.58, 0.16, 0.34, 0], [0.34, 0, 0, 0]] },
  Q: { w: 0.8, s: [...GLYPHS.O.s, [0.42, 0.04, 0.8, -0.16]] },
  ' ': { w: 0.3, s: [] },
});
const LETTERS = { ...GLYPHS, ...EXTRA };

/** The width of `text` at height h (metres): to fit a line to its panel. */
export function textWidth(text, h) {
  return [...text].reduce((a, ch) => a + LETTERS[ch].w * h + h * 0.28, -h * 0.28);
}

/**
 * `text` in Roman capitals centred on x = 0, its foot at y, its face at z,
 * `h` tall, `depth` proud of the face (gilt bronze letters stand out; cut
 * ones are painted red at the face). Geometries.
 */
export function carve(text, y, z, h, { depth = 0.006 } = {}) {
  const sw = h * 0.13;
  const gap = h * 0.28;
  let x = -textWidth(text, h) / 2;
  const out = [];
  for (const ch of text) {
    const g = LETTERS[ch];
    for (const [x0, y0, x1, y1] of g.s) {
      const ax = x + x0 * h;
      const ay = y + y0 * h;
      const bx = x + x1 * h;
      const by = y + y1 * h;
      const len = Math.hypot(bx - ax, by - ay) + sw * 0.8;
      const s = new BoxGeometry(len, sw, depth);
      s.rotateZ(Math.atan2(by - ay, bx - ax));
      s.translate((ax + bx) / 2, (ay + by) / 2, z);
      out.push(tintGeometry(boxUV(s)));
    }
    x += g.w * h + gap;
  }
  return out;
}

export { ellipsoid, member, skirt, drape, staffOf, gauss, torso, arm, leg, hand };
