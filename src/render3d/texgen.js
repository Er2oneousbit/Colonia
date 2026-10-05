/**
 * texgen.js
 * ----------------------------------------------------------------------------
 * Seeded randomness and noise for the 3D models' shapes on the CPU (where
 * the street's grass blades stand, how a block is pushed out of square),
 * and a wrapping height field read back from the GPU. The textures
 * themselves are painted on the GPU from the same noise in GLSL
 * (paint/glsl.js: the same lattice hash and gradients).
 *
 * The noise TILES: periodic over a whole number of lattice cells.
 * Randomness is seeded (a hash of the lattice point and a seed), never
 * Math.random: the same seed gives the same street, so screenshots compare.
 * ----------------------------------------------------------------------------
 */

/** A 32-bit integer hash of a lattice point and a seed, as a float in [0, 1). */
export function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A small seeded generator for art (sfc32-like quality is not needed here: mulberry32). */
export function artRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a mod n, never negative (one division: this runs for every lattice corner of every pixel). */
const mod = (a, n) => {
  const m = a % n;
  return m < 0 ? m + n : m;
};
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Gradient noise periodic over `px` x `py` lattice cells, about -0.7..0.7.
 * Gradient (not value) noise: value noise shows its square lattice as blocky
 * blobs, which reads as a pattern on stone.
 */
export function gnoise(x, y, px, py, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  // Wrapped onto the lattice in integers (a % on doubles is a slow library
  // call), and only when off it: most samples lie on it already.
  let x0 = xi | 0;
  if (x0 < 0 || x0 >= px) {
    x0 %= px;
    if (x0 < 0) x0 += px;
  }
  const x1 = x0 + 1 === px ? 0 : x0 + 1;
  let y0 = yi | 0;
  if (y0 < 0 || y0 >= py) {
    y0 %= py;
    if (y0 < 0) y0 += py;
  }
  const y1 = y0 + 1 === py ? 0 : y0 + 1;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  // The four corners' gradients, hashed as grad() does, written out: this
  // is the innermost loop of every texture, and the same arithmetic in the
  // same order gives the same bits as the calls did.
  const sx = Math.imul(seed, 0x9e3779b1);
  const hx0 = Math.imul(x0, 0x27d4eb2d);
  const hx1 = Math.imul(x1, 0x27d4eb2d);
  const hy0 = Math.imul(y0, 0x165667b1) ^ sx;
  const hy1 = Math.imul(y1, 0x165667b1) ^ sx;
  let h = hx0 ^ hy0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  let k = ((h ^ (h >>> 13)) >>> 24) * 2;
  const g00 = GRAD[k] * fx + GRAD[k + 1] * fy;
  h = hx1 ^ hy0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  k = ((h ^ (h >>> 13)) >>> 24) * 2;
  const g10 = GRAD[k] * (fx - 1) + GRAD[k + 1] * fy;
  h = hx0 ^ hy1;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  k = ((h ^ (h >>> 13)) >>> 24) * 2;
  const g01 = GRAD[k] * fx + GRAD[k + 1] * (fy - 1);
  h = hx1 ^ hy1;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  k = ((h ^ (h >>> 13)) >>> 24) * 2;
  const g11 = GRAD[k] * (fx - 1) + GRAD[k + 1] * (fy - 1);
  const a = g00 + (g10 - g00) * u;
  const b = g01 + (g11 - g01) * u;
  return a + (b - a) * v;
}

/** 256 unit gradients: a table lookup by hash bits is many times cheaper than a cos and sin per lattice corner. */
const GRAD = (() => {
  const g = new Float32Array(512);
  for (let i = 0; i < 256; i++) {
    const a = ((i + 0.5) / 256) * Math.PI * 2;
    g[i * 2] = Math.cos(a);
    g[i * 2 + 1] = Math.sin(a);
  }
  return g;
})();

/**
 * Fractal noise at texture coordinates (u, v) in [0, 1): `cells` lattice
 * cells across the texture for the first octave, each octave twice as many
 * (so every octave still tiles). Returns about 0..1, centred on 0.5.
 * `sx` stretches it along u (grain, strata): cells along u become cells/sx.
 */
export function fbm(u, v, cells, octaves, seed, gain = 0.5, sx = 1) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let cu = Math.max(1, Math.round(cells / sx));
  let cv = cells;
  for (let o = 0; o < octaves; o++) {
    sum += amp * gnoise(u * cu, v * cv, cu, cv, seed + o * 1013);
    norm += amp;
    amp *= gain;
    cu *= 2;
    cv *= 2;
  }
  return 0.5 + (sum / norm) * 0.9;
}

/**
 * A square float field that wraps at its edges: a texture's numbers read
 * back from the GPU (the paving's height), sampled where a mesh needs them.
 */
export class Field {
  constructor(size, data = new Float32Array(size * size)) {
    this.size = size;
    this.data = data;
  }
  /** A field on numbers made elsewhere (read back from the GPU), not copied. */
  static wrap(size, data) {
    return new Field(size, data);
  }
  /** The value at pixel (x, y), wrapped. */
  at(x, y) {
    const n = this.size;
    return this.data[mod(y, n) * n + mod(x, n)];
  }
  /** Bilinear sample at texture coordinates, wrapped (the CPU side of a displaced mesh reads its height this way). */
  sample(u, v) {
    const n = this.size;
    const x = u * n - 0.5;
    const y = v * n - 0.5;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const a = lerp(this.at(xi, yi), this.at(xi + 1, yi), fx);
    const b = lerp(this.at(xi, yi + 1), this.at(xi + 1, yi + 1), fx);
    return lerp(a, b, fy);
  }
}
