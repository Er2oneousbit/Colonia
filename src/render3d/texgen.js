/**
 * texgen.js
 * ----------------------------------------------------------------------------
 * The toolkit the procedural PBR textures are made with (surfaces.js): noise,
 * cells, height fields and the maps made from them. Pure arithmetic on typed
 * arrays, no DOM and no three.js, so it runs in node:test and could run in a
 * worker.
 *
 * Everything here TILES: a texture covers u, v in [0, 1) and wraps, so every
 * noise is periodic over the texture (its lattice wraps at a whole number of
 * cells) and every filter reads across the edges. A seam in a stone texture
 * shows at once on a wall of blocks.
 *
 * Randomness is seeded (a hash of the lattice point and a seed), never
 * Math.random: the same seed gives the same stone, so screenshots compare.
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
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
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

/** Ridged noise: sharp creases where the noise crosses zero (veins, cracks). 0..1, 1 on the crease. */
export function ridge(u, v, cells, octaves, seed, sx = 1) {
  const n = fbm(u, v, cells, octaves, seed, 0.5, sx) - 0.5;
  return 1 - Math.min(1, Math.abs(n) * 2);
}

/**
 * Voronoi cells periodic over the texture: `cells` x `cells` jittered
 * feature points. Writes into `out` (reused, no allocation per pixel):
 *   id    a stable number for the nearest cell (per-stone colour, height)
 *   f1    distance to the nearest feature point (cell units)
 *   edge  distance to the nearest cell border (cell units): the true
 *         distance to the bisector, so borders come out straight, as the
 *         joints between cut polygonal paving stones are
 *   cx,cy the nearest feature point (cell units, unwrapped)
 */
export function voronoi(u, v, cells, seed, jitter, out, sy = 1) {
  const cy = Math.max(1, Math.round(cells * sy));
  const pts = cellPoints(cells, cy, seed, jitter);
  const x = u * cells;
  const y = v * cy;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let best = 1e9;
  let bx = 0;
  let by = 0;
  let bid = 0;
  let bgx = 0;
  let bgy = 0;
  // Nearest feature point first (a point stays inside its own cell, so the 3 x 3 around the pixel holds it).
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = xi + i;
      const gy = yi + j;
      const k = (mod(gy, cy) * cells + mod(gx, cells)) * 2;
      const fx = gx + pts[k];
      const fy = gy + pts[k + 1];
      const d = (fx - x) * (fx - x) + (fy - y) * (fy - y);
      if (d < best) {
        best = d;
        bx = fx;
        by = fy;
        bid = k / 2;
        bgx = gx;
        bgy = gy;
      }
    }
  }
  // Then the distance to the nearest bisector with any other point: every
  // neighbour of the winning cell can share a border with it.
  // A border lies at least len / 2 - f1 away (half the gap between the two
  // points, less how far the pixel is from its own), so a point further
  // than 2 (edge + f1) cannot bring a nearer border: skipped before its
  // square root, without changing the answer.
  const f1 = Math.sqrt(best);
  let edge = 1e9;
  let far = 1e18;
  for (let j = -2; j <= 2; j++) {
    for (let i = -2; i <= 2; i++) {
      if (i === 0 && j === 0) continue;
      const gx = bgx + i;
      const gy = bgy + j;
      const k = (mod(gy, cy) * cells + mod(gx, cells)) * 2;
      const fx = gx + pts[k];
      const fy = gy + pts[k + 1];
      const dx = fx - bx;
      const dy = fy - by;
      const len2 = dx * dx + dy * dy;
      if (len2 >= far) continue;
      const len = Math.sqrt(len2);
      if (len < 1e-6) continue;
      const mx = (fx + bx) / 2;
      const my = (fy + by) / 2;
      const d = ((mx - x) * dx + (my - y) * dy) / len;
      if (d < edge) {
        edge = d;
        // (A hair of margin, so rounding never skips a point the exact sums would keep.)
        const r = Math.max(0, edge + f1) + 1e-7;
        far = 4 * r * r;
      }
    }
  }
  out.id = bid;
  out.f1 = f1;
  out.edge = edge;
  out.cx = bx;
  out.cy = by;
  return out;
}

/** Each cell's feature point (offset inside the cell), kept per layout: a recipe asks for the same cells a million times. */
const POINTS = new Map();
/**
 * The last few layouts asked for, compared by their numbers before any key
 * is built: a recipe often asks for two or three layouts in turn for every
 * pixel, which a single "last one" missed every time.
 */
const RECENT = [];
const RECENT_MAX = 6;
function cellPoints(cx, cy, seed, jitter) {
  for (let i = 0; i < RECENT.length; i++) {
    const r = RECENT[i];
    if (r.cx === cx && r.cy === cy && r.seed === seed && r.jitter === jitter) return r.p;
  }
  const key = `${cx},${cy},${seed},${jitter}`;
  let p = POINTS.get(key);
  if (p) {
    remember(cx, cy, seed, jitter, p);
    return p;
  }
  p = new Float32Array(cx * cy * 2);
  for (let y = 0; y < cy; y++) {
    for (let x = 0; x < cx; x++) {
      const k = (y * cx + x) * 2;
      p[k] = 0.5 + (hash2(x, y, seed) - 0.5) * jitter;
      p[k + 1] = 0.5 + (hash2(x, y, seed + 7) - 0.5) * jitter;
    }
  }
  if (POINTS.size > 64) POINTS.clear();
  POINTS.set(key, p);
  remember(cx, cy, seed, jitter, p);
  return p;
}

function remember(cx, cy, seed, jitter, p) {
  RECENT.unshift({ cx, cy, seed, jitter, p });
  if (RECENT.length > RECENT_MAX) RECENT.pop();
}

/** A square float field that wraps at its edges. */
export class Field {
  constructor(size) {
    this.size = size;
    this.data = new Float32Array(size * size);
  }
  /** A field on values made elsewhere (a height field sent back from a worker), not copied. */
  static wrap(size, data) {
    const f = Object.create(Field.prototype);
    f.size = size;
    f.data = data;
    return f;
  }
  /** Fill from f(u, v, i) with u, v at pixel centres. */
  fill(f) {
    const n = this.size;
    for (let y = 0; y < n; y++) {
      const v = (y + 0.5) / n;
      for (let x = 0; x < n; x++) this.data[y * n + x] = f((x + 0.5) / n, v, y * n + x);
    }
    return this;
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
  /** A box blur of radius r px, wrapped (softens a mask into a gradient). */
  blur(r) {
    const n = this.size;
    const tmp = new Float32Array(n * n);
    const w = 2 * r + 1;
    const d = this.data;
    for (let y = 0; y < n; y++) {
      const row = y * n;
      let s = 0;
      for (let k = -r; k <= r; k++) s += d[row + mod(k, n)];
      for (let x = 0; x < n; x++) {
        tmp[row + x] = s / w;
        s += d[row + mod(x + r + 1, n)] - d[row + mod(x - r, n)];
      }
    }
    for (let x = 0; x < n; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[mod(k, n) * n + x];
      for (let y = 0; y < n; y++) {
        this.data[y * n + x] = s / w;
        s += tmp[mod(y + r + 1, n) * n + x] - tmp[mod(y - r, n) * n + x];
      }
    }
    return this;
  }
}

/**
 * A tangent-space normal map (RGBA bytes) from a height field. `depth` is
 * how deep a height of 1 is, in texture widths: a 512 px texture of a 0.6 m
 * stone face whose pits go 3 mm deep has depth 0.003 / 0.6. Green points to
 * +v (three.js's convention for a texture uploaded with flipY off, so v
 * grows with the row).
 */
export function normalMap(field, depth) {
  const n = field.size;
  const out = new Uint8Array(n * n * 4);
  const k = depth * n; // height per px step, in px
  const d = field.data;
  for (let y = 0; y < n; y++) {
    // The rows above and below, wrapped (indexed directly: at() per tap was most of the cost).
    const rt = (y === 0 ? n - 1 : y - 1) * n;
    const rm = y * n;
    const rb = (y === n - 1 ? 0 : y + 1) * n;
    for (let x = 0; x < n; x++) {
      const xl = x === 0 ? n - 1 : x - 1;
      const xr = x === n - 1 ? 0 : x + 1;
      // Sobel: smoother than a plain difference, so a 1 px pore is not a spike.
      const tl = d[rt + xl];
      const t = d[rt + x];
      const tr = d[rt + xr];
      const l = d[rm + xl];
      const r = d[rm + xr];
      const bl = d[rb + xl];
      const b = d[rb + x];
      const br = d[rb + xr];
      const dx = (tr + 2 * r + br - tl - 2 * l - bl) / 8;
      const dy = (bl + 2 * b + br - tl - 2 * t - tr) / 8;
      let nx = -dx * k;
      let ny = -dy * k;
      let nz = 1;
      // (sqrt, not Math.hypot: several times faster, and the two differ only in the last bit.)
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * n + x) * 4;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * Cavity: how far a pixel sits below the average of its neighbourhood
 * (radius r px), 0 for a bump or flat, up to 1 for a deep pit. Pits and
 * joints collect dirt and get less light, so it feeds both the colour and
 * the AO channel.
 */
export function cavity(field, r, scale) {
  const n = field.size;
  const avg = new Field(n);
  avg.data.set(field.data);
  avg.blur(r);
  const out = new Field(n);
  for (let i = 0; i < n * n; i++) out.data[i] = clamp01((avg.data[i] - field.data[i]) * scale);
  return out;
}

const RGB = new Map();
/**
 * sRGB hex to 0..1 sRGB components (colours are mixed in sRGB, as a
 * painter mixes). Kept per hex: recipes name their colours where they use
 * them, inside the pixel loops, and parsing a million times is not free.
 * The array is shared: never change it. (Not frozen: a frozen array is
 * another kind of array to V8, and mixRgb, handed both kinds, ran at a
 * fraction of its speed.)
 */
export function rgb(hex) {
  let c = RGB.get(hex);
  if (!c) {
    const v = parseInt(hex.replace('#', ''), 16);
    c = [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
    RGB.set(hex, c);
  }
  return c;
}

/** Mix two [r, g, b] colours into `out`. */
export function mixRgb(a, b, t, out = [0, 0, 0]) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

/** A set of maps of one size: albedo (sRGB), normal, and ORM (R occlusion, G roughness, B metalness, as three.js reads them). */
export class MapSet {
  constructor(size) {
    this.size = size;
    this.albedo = new Uint8Array(size * size * 4);
    this.orm = new Uint8Array(size * size * 4);
    this.normal = null;
    /** The height field, kept when a mesh is displaced by the same heights (the paving). */
    this.height = null;
  }
  /** Write pixel i's colour (0..1 sRGB) and occlusion, roughness, metalness. */
  set(i, c, ao, rough, metal = 0) {
    const a = this.albedo;
    const o = this.orm;
    const j = i * 4;
    a[j] = Math.round(clamp01(c[0]) * 255);
    a[j + 1] = Math.round(clamp01(c[1]) * 255);
    a[j + 2] = Math.round(clamp01(c[2]) * 255);
    a[j + 3] = 255;
    o[j] = Math.round(clamp01(ao) * 255);
    o[j + 1] = Math.round(clamp01(rough) * 255);
    o[j + 2] = Math.round(clamp01(metal) * 255);
    o[j + 3] = 255;
  }
}
