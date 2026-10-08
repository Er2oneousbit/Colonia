/**
 * people/mesher.js
 * ----------------------------------------------------------------------------
 * What the people's builders (body.js, garments.js, hair.js, props.js) make
 * their skinned meshes with: a vertex list carrying, besides its place, its
 * UV (metres, for the wool's texture), its four bones and their weights (the
 * rig's: rig.js) and its material slot and tone (material.js: which of the
 * person's colours it takes, and a shade baked in, darker in a fold's depth).
 *
 * Surfaces are grids of rows and columns (rings up a body, round a limb),
 * closed round or not. Normals come from the faces, then are averaged over
 * vertices at one place (a grid's seam, a stripe's split column, two grids
 * meeting), so a piece is shaded smooth across its own seams.
 *
 * Weights: a vertex names its bones with weights in any number; the four
 * biggest are kept, normalised to sum to 1 (the tests check every vertex).
 * ----------------------------------------------------------------------------
 */

import { BufferGeometry, Float32BufferAttribute, Uint8BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute } from 'three';
import { BONE } from './rig.js';

/**
 * The material slots: which colour a vertex takes (an instance's own, or a
 * fixed one) and how it takes the light. material.js reads this table for
 * its uniforms; the vertex carries only the slot's number.
 *   col    -1 a fixed colour (rgb, sRGB hex), else an instance colour's index
 *          (actors.js COLOURS: 0 tunic, 1 mantle, 2 skin, 3 hair, 4 trim,
 *          5 leather, 6 accent, 7 metal)
 *   rough, metal; tex the wool's texture's share (0 smooth, 1 woven);
 *   snow   how much settles; wet how much rain darkens it
 */
export const SLOTS = Object.freeze({
  SKIN: { i: 0, col: 2, rough: 0.52, metal: 0, tex: 0, snow: 0, wet: 0.25 },
  HAIR: { i: 1, col: 3, rough: 0.62, metal: 0, tex: 0.35, snow: 0.8, wet: 0.6 },
  TUNIC: { i: 2, col: 0, rough: 0.9, metal: 0, tex: 1, snow: 0.7, wet: 1 },
  MANTLE: { i: 3, col: 1, rough: 0.9, metal: 0, tex: 1, snow: 0.8, wet: 1 },
  TRIM: { i: 4, col: 4, rough: 0.85, metal: 0, tex: 0.8, snow: 0.6, wet: 1 },
  LEATHER: { i: 5, col: 5, rough: 0.6, metal: 0, tex: 0.2, snow: 0.4, wet: 0.8 },
  ACCENT: { i: 6, col: 6, rough: 0.8, metal: 0, tex: 0.7, snow: 0.6, wet: 1 },
  METAL: { i: 7, col: 7, rough: 0.48, metal: 1, tex: 0.7, snow: 0.4, wet: 0.3 },
  EYE: { i: 8, col: -1, rgb: 0xc8bcae, rough: 0.25, metal: 0, tex: 0, snow: 0, wet: 0 },
  IRIS: { i: 9, col: -1, rgb: 0x2a1a10, rough: 0.2, metal: 0, tex: 0, snow: 0, wet: 0 },
  LIPS: { i: 10, col: 2, tint: 0xb06258, rough: 0.42, metal: 0, tex: 0, snow: 0, wet: 0.2 },
  WOOD: { i: 11, col: -1, rgb: 0x7a5434, rough: 0.7, metal: 0, tex: 0.3, snow: 0.5, wet: 0.8 },
  PAPYRUS: { i: 12, col: -1, rgb: 0xd8c49a, rough: 0.85, metal: 0, tex: 0.4, snow: 0.3, wet: 0.6 },
  GOLD: { i: 13, col: -1, rgb: 0xe0aa48, rough: 0.28, metal: 1, tex: 0, snow: 0.3, wet: 0.2 },
  LEAF: { i: 14, col: -1, rgb: 0x2f4a1e, rough: 0.7, metal: 0, tex: 0.3, snow: 0.8, wet: 0.6 },
  WAX: { i: 15, col: -1, rgb: 0x241c16, rough: 0.35, metal: 0, tex: 0, snow: 0.3, wet: 0.3 },
  IRON: { i: 16, col: -1, rgb: 0x6a6c70, rough: 0.42, metal: 1, tex: 0, snow: 0.4, wet: 0.3 },
  BRONZE: { i: 17, col: -1, rgb: 0xb08848, rough: 0.32, metal: 1, tex: 0, snow: 0.4, wet: 0.3 },
  ROPE: { i: 18, col: -1, rgb: 0x9a8058, rough: 0.9, metal: 0, tex: 0.6, snow: 0.5, wet: 0.8 },
  NAIL: { i: 19, col: 2, tint: 0xe8c8b8, rough: 0.35, metal: 0, tex: 0, snow: 0, wet: 0.2 },
  DARK: { i: 20, col: -1, rgb: 0x15100c, rough: 0.6, metal: 0, tex: 0, snow: 0, wet: 0 },
  WHITE: { i: 21, col: -1, rgb: 0xeee8dc, rough: 0.88, metal: 0, tex: 1, snow: 0.8, wet: 1 },
  PURPLE: { i: 22, col: -1, rgb: 0x5a1838, rough: 0.85, metal: 0, tex: 0.9, snow: 0.6, wet: 1 },
  BROW: { i: 23, col: 3, rough: 0.7, metal: 0, tex: 0.2, snow: 0, wet: 0.4 },
});

export const SLOT_COUNT = 24;

/** Bone weights from a list of [bone (name or index), weight]: the four biggest, normalised. */
export function weights(list) {
  const acc = new Map();
  for (const [b, w] of list) {
    if (!(w > 0)) continue;
    const i = typeof b === 'string' ? BONE[b] : b;
    acc.set(i, (acc.get(i) || 0) + w);
  }
  const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!top.length) top.push([BONE.root, 1]);
  const sum = top.reduce((s, [, w]) => s + w, 0);
  const out = { b: [0, 0, 0, 0], w: [0, 0, 0, 0] };
  top.forEach(([i, w], k) => {
    out.b[k] = i;
    out.w[k] = w / sum;
  });
  return out;
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
export { smooth };

/**
 * The trunk's weights at a point (x, y, z) of the rest pose: the root, the
 * spine, the chest, the neck by height; toward the shoulders the clavicle
 * and the arm; toward the hips the thighs (`legs` how much: a tunic's skirt
 * takes more than the body's own hips).
 */
export function trunkWeights(x, y, z, { legs = 0.5, arms = 1 } = {}) {
  const list = [];
  const rs = smooth(1.02, 1.12, y);
  const sc = smooth(1.16, 1.28, y);
  const cn = smooth(1.42, 1.47, y);
  list.push(['root', 1 - rs]);
  list.push(['spine', rs * (1 - sc)]);
  list.push(['chest', sc * (1 - cn)]);
  list.push(['neck', cn]);
  // The shoulders: out to the side and high, the arm's share.
  const ax = Math.abs(x);
  const sh = smooth(0.1, 0.18, ax) * smooth(1.24, 1.36, y) * arms;
  if (sh > 0) {
    const k = x > 0 ? 'L' : 'R';
    list.push([`clav${k}`, sh * 0.35]);
    list.push([`arm${k}`, sh * 0.5]);
  }
  // The hips: low and to the side, the thigh's share (front more than back: a step pulls the front).
  const hp = smooth(0.95, 0.78, y) * smooth(0.0, 0.09, ax) * legs * (z < -0.03 ? 0.6 : 1);
  if (hp > 0) list.push([x > 0 ? 'thighL' : 'thighR', hp]);
  return weights(list);
}

/**
 * A skirt's weights (a tunic's below the belt, a stola's, a toga's): the
 * root at the belt, more of the thighs going down (each side its own, the
 * middle shared, so the cloth spans a stride), the shins below the knee for
 * a long one (so a seated man's hem falls to his feet), the back held more
 * by the root (a seat behind it).
 */
export function skirtWeights(x, y, z, { long = false } = {}) {
  if (y > 1.0) return trunkWeights(x, y, z, { legs: 0.3 });
  const sL = smooth(-0.1, 0.1, x);
  const back = z < 0 ? 1 - 0.55 * smooth(0, -0.08, z) : 1;
  const a = smooth(1.0, 0.6, y) * 0.92 * back;
  const b = long ? smooth(0.48, 0.2, y) * 0.65 : 0;
  const list = [['root', 1 - a]];
  list.push(['thighL', a * sL * (1 - b)], ['thighR', a * (1 - sL) * (1 - b)]);
  if (b > 0) list.push(['shinL', a * sL * b], ['shinR', a * (1 - sL) * b]);
  // (A little of the spine at the top: the belt rides with the waist.)
  if (y > 0.95) list.push(['spine', smooth(0.95, 1.0, y) * 0.3]);
  return weights(list);
}

/**
 * A limb's weights at a parameter u along a chain of joints (bones[i] runs
 * from joint i to joint i + 1; u in joints, so 1.5 is half way down the
 * second bone): its bone, blended with the next over `blend` (a fraction of
 * a bone) either side of each joint.
 */
export function chainWeights(bones, u, blend = 0.18) {
  const n = bones.length;
  const i = Math.max(0, Math.min(n - 1, Math.floor(u)));
  const f = u - i;
  const list = [[bones[i], 1]];
  if (f > 1 - blend && i + 1 < n) {
    const k = smooth(1 - blend, 1 + blend, f) ;
    list[0][1] = 1 - k;
    list.push([bones[i + 1], k]);
  } else if (f < blend && i > 0) {
    const k = smooth(-blend, blend, f);
    list[0][1] = k;
    list.push([bones[i - 1], 1 - k]);
  }
  return weights(list);
}

/** A rigid part's weights: all on one bone. */
export function rigid(bone) {
  return weights([[bone, 1]]);
}

export class Mesher {
  constructor() {
    this.pos = [];
    this.uv = [];
    this.bones = [];
    this.wts = [];
    this.mat = [];
    this.idx = [];
  }

  get count() {
    return this.pos.length / 3;
  }

  /** One vertex: p [x, y, z], uv [u, v], w (weights()), slot (SLOTS entry), tone (a shade, 1 plain). */
  vertex(p, uv, w, slot, tone = 1) {
    this.pos.push(p[0], p[1], p[2]);
    this.uv.push(uv[0], uv[1]);
    this.bones.push(w.b[0], w.b[1], w.b[2], w.b[3]);
    this.wts.push(w.w[0], w.w[1], w.w[2], w.w[3]);
    this.mat.push(slot.i, tone);
    return this.count - 1;
  }

  tri(a, b, c) {
    this.idx.push(a, b, c);
  }

  /**
   * A grid of (rows + 1) x (cols + 1) vertices from fn(i, j) -> { p, uv,
   * w, slot, tone }; `closed` joins the last column to the first (fn is
   * still asked for column cols: its vertex makes the UV's seam, and the
   * normals are averaged across it). `flip` turns the faces round.
   */
  grid(rows, cols, fn, { flip = false } = {}) {
    const base = this.count;
    // (A vertex may say where the inside is, `c`: the axis of the tube or the body it is on. Then each
    // quad faces away from it whatever way its rows and columns run.)
    const inside = [];
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= cols; j++) {
        const v = fn(i, j);
        this.vertex(v.p, v.uv || [0, 0], v.w, v.slot, v.tone ?? 1);
        inside.push(v.c || null);
      }
    }
    const W = cols + 1;
    const P = this.pos;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = base + i * W + j;
        const b = a + 1;
        const c = a + W;
        const d = c + 1;
        let fl = flip;
        const ci = inside[i * W + j] || inside[(i + 1) * W + j + 1];
        if (ci) {
          // The quad's normal (a, c, b order) against the way out from its inside.
          const n = quadNormal(P, a, b, c, d);
          const m = [0, 1, 2].map((k) => (P[a * 3 + k] + P[b * 3 + k] + P[c * 3 + k] + P[d * 3 + k]) / 4 - ci[k]);
          if (n[0] || n[1] || n[2]) fl = n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0;
        }
        if (fl) {
          this.tri(a, b, c);
          this.tri(b, d, c);
        } else {
          this.tri(a, c, b);
          this.tri(b, c, d);
        }
      }
    }
    return base;
  }

  /** A fan closing a ring of vertex indices to a point (a cap), facing by `flip`. */
  fan(ring, centre, flip = false) {
    for (let j = 0; j + 1 < ring.length; j++) {
      if (flip) this.tri(centre, ring[j + 1], ring[j]);
      else this.tri(centre, ring[j], ring[j + 1]);
    }
  }

  /** Append another mesher's vertices and faces. */
  add(m) {
    const base = this.count;
    this.pos.push(...m.pos);
    this.uv.push(...m.uv);
    this.bones.push(...m.bones);
    this.wts.push(...m.wts);
    this.mat.push(...m.mat);
    for (const i of m.idx) this.idx.push(i + base);
    return this;
  }

  /** Every vertex moved by f([x, y, z]) -> [x, y, z] (in place). */
  map(f) {
    for (let i = 0; i < this.pos.length; i += 3) {
      const q = f([this.pos[i], this.pos[i + 1], this.pos[i + 2]]);
      this.pos[i] = q[0];
      this.pos[i + 1] = q[1];
      this.pos[i + 2] = q[2];
    }
    return this;
  }

  /** The finished geometry: position, normal, uv, aBones, aWeights, aMat (slot, tone); indexed. */
  build() {
    const g = new BufferGeometry();
    const n = this.count;
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aBones', new Uint8BufferAttribute(this.bones, 4));
    g.setAttribute('aWeights', new Float32BufferAttribute(this.wts, 4));
    g.setAttribute('aMat', new Float32BufferAttribute(this.mat, 2));
    g.setIndex(n > 65535 ? new Uint32BufferAttribute(this.idx, 1) : new Uint16BufferAttribute(this.idx, 1));
    g.computeVertexNormals();
    smoothSeams(g);
    g.computeBoundingSphere();
    return g;
  }
}

/** The normal of quad a b c d as the faces (a, c, b) and (b, c, d) would face (not normalised). */
function quadNormal(P, a, b, c, d) {
  const v = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  const A = v(a);
  const B = v(b);
  const C = v(c);
  const D = v(d);
  // The diagonals' cross product: robust when an edge has closed to a point (a pole, a dome's top).
  const e1 = [C[0] - B[0], C[1] - B[1], C[2] - B[2]];
  const e2 = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
  return [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
}

/** Average the normals of vertices at one place (a grid's seam, a split stripe), so a piece shades smooth across them. */
function smoothSeams(g) {
  const p = g.attributes.position.array;
  const nrm = g.attributes.normal.array;
  const groups = new Map();
  for (let i = 0; i < p.length / 3; i++) {
    const k = `${Math.round(p[i * 3] * 2e4)},${Math.round(p[i * 3 + 1] * 2e4)},${Math.round(p[i * 3 + 2] * 2e4)}`;
    const l = groups.get(k);
    if (l) l.push(i);
    else groups.set(k, [i]);
  }
  for (const l of groups.values()) {
    if (l.length < 2) continue;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const i of l) {
      x += nrm[i * 3];
      y += nrm[i * 3 + 1];
      z += nrm[i * 3 + 2];
    }
    const len = Math.hypot(x, y, z) || 1;
    for (const i of l) {
      nrm[i * 3] = x / len;
      nrm[i * 3 + 1] = y / len;
      nrm[i * 3 + 2] = z / len;
    }
  }
}
