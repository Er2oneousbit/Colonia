/**
 * ground/groundSurfaces.js
 * ----------------------------------------------------------------------------
 * The procedural surfaces of the 3D ground: one tiling MapSet per layer of
 * the ground shader's texture arrays (groundMaterial.js), painted from noise
 * as surfaces.js paints the well's stone, but for ground seen from a city
 * builder's height: a tile is 4 m, the closest zoom shows about 45 px a
 * metre, so 256 px textures over 2 to 5 m are sharp enough and cheap.
 *
 * The kinds follow the Mediterranean countryside of the Roman provinces:
 * short grazed pasture, lush meadow with flowers (the fertile land farms
 * need), dry garrigue scrub of cushion shrubs on stony soil, an oak and pine
 * wood's litter and moss, bare limestone, dune sand, a beach's finer sand
 * and shells, a farm's ploughed furrows, the silt and pebbles of a riverbed;
 * and what people laid on it: a gravelled road (via glareata), polygonal
 * polygonal basalt paving for a town's streets (as Pompeii's), a forum's
 * travertine flagstones in courses, and the rubble of a fallen building.
 *
 * Every layer has the same size (a texture array's layers must) and packs:
 *   albedo  sRGB colour, ALPHA = height (0..1), which the shader blends
 *           kinds by: where two kinds meet, the higher one's bumps win, so
 *           grass grows over the edge of a road in tufts, not along a line
 *   normal  tangent-space normal map
 *   orm     R occlusion, G roughness, B how much of the pixel is living
 *           plants (the season's colour tints only those: the soil between
 *           the blades stays brown in every month)
 *
 * Pure arithmetic (texgen.js): runs in node:test and in the paint pool's
 * workers (paint/pool.js).
 * ----------------------------------------------------------------------------
 */

import {
  Field, MapSet, fbm, ridge, voronoi, hash2, normalMap, cavity, rgb, mixRgb, clamp01, smoothstep, lerp,
} from '../texgen.js';

/** Texture size of every layer (px). */
export const GROUND_SIZE = 256;

const cell = () => ({ id: 0, f1: 0, edge: 0, cx: 0, cy: 0 });

function eachPixel(n, paint) {
  for (let y = 0; y < n; y++) {
    const v = (y + 0.5) / n;
    for (let x = 0; x < n; x++) paint((x + 0.5) / n, v, y * n + x);
  }
}

/** Store the height (normalised) in the albedo's alpha and the plant cover in the ORM's blue. */
function finish(m, h, veg) {
  const n = m.size;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n * n; i++) {
    lo = Math.min(lo, h.data[i]);
    hi = Math.max(hi, h.data[i]);
  }
  const k = hi > lo ? 1 / (hi - lo) : 0;
  for (let i = 0; i < n * n; i++) {
    m.albedo[i * 4 + 3] = Math.round(clamp01((h.data[i] - lo) * k) * 255);
    m.orm[i * 4 + 2] = Math.round(clamp01(veg ? veg(i) : 0) * 255);
  }
  return m;
}

const scale = (c, k) => { c[0] *= k; c[1] *= k; c[2] *= k; return c; };

/**
 * Grazed pasture: short blades in tufts, the blades streaking every way
 * (three directions of stretched noise), dark gaps between them, the odd
 * patch of bare earth and of clover. Painted green: the season tints it.
 */
function grass(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const bare = new Field(n);
  bare.fill((u, v) => smoothstep(0.66, 0.8, fbm(u, v, 6, 4, seed + 1)) * 0.7);
  const blade = (u, v, s) => {
    // Short strokes three ways: along u, along v and along the diagonal.
    const a = fbm(u, v, 110, 2, s, 0.5, 4);
    const b = fbm(v, u, 110, 2, s + 1, 0.5, 4);
    const c = fbm((u + v) % 1, (v - u + 1) % 1, 80, 2, s + 2, 0.5, 4);
    return Math.max(a, b, c);
  };
  h.fill((u, v, i) => {
    const tuft = fbm(u, v, 14, 3, seed + 3);
    return tuft * 0.45 + blade(u, v, seed + 4) * 0.55 - bare.data[i] * 0.4;
  });
  const cav = cavity(h, 2, 6);
  const dark = rgb('#3c561c');
  const mid = rgb('#5d7b2a');
  const lite = rgb('#84a044');
  const straw = rgb('#9a9450');
  const soil = rgb('#6d5838');
  const col = [0, 0, 0];
  const veg = new Float32Array(n * n);
  eachPixel(n, (u, v, i) => {
    const t = clamp01((h.data[i] - 0.25) * 1.5);
    mixRgb(dark, mid, smoothstep(0.1, 0.55, t), col);
    mixRgb(col, lite, smoothstep(0.5, 0.95, t) * 0.7, col);
    // Tufts a shade apart, tips gone to straw in streaks.
    scale(col, 0.9 + fbm(u, v, 9, 3, seed + 5) * 0.2);
    mixRgb(col, straw, smoothstep(0.62, 0.8, fbm(u, v, 12, 3, seed + 6)) * 0.3, col);
    mixRgb(col, rgb('#4d7a2c'), smoothstep(0.72, 0.8, fbm(u, v, 9, 3, seed + 7)) * 0.4, col);
    const b = bare.data[i] * (1 - t * 0.5);
    mixRgb(col, soil, clamp01(b * 1.3), col);
    mixRgb(col, rgb('#28311a'), cav.data[i] * 0.5, col);
    veg[i] = 1 - clamp01(b * 1.3);
    m.set(i, col, 1 - cav.data[i] * 0.55, 0.86 + b * 0.08);
  });
  m.normal = normalMap(h, 0.025 / 2.5);
  return finish(m, h, (i) => veg[i]);
}

/**
 * Meadow, the fertile land: taller, softer grass laid over by the wind in
 * swathes, richer and yellower than the pasture, with clumps of clover and
 * flowers (yellow, white, a few purple) in drifts.
 */
function meadow(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const lay = new Field(n);
  // Swathes laid one way or another: which way the stems lean, in big soft patches.
  lay.fill((u, v) => fbm(u, v, 3, 2, seed + 8));
  h.fill((u, v, i) => {
    const along = fbm(u, v, 70, 2, seed, 0.5, 3);
    const across = fbm(v, u, 70, 2, seed + 2, 0.5, 3);
    const stems = lerp(along, across, smoothstep(0.4, 0.6, lay.data[i]));
    return stems * 0.5 + fbm(u, v, 10, 3, seed + 1) * 0.5;
  });
  const cav = cavity(h, 3, 4);
  const low = rgb('#4c6a20');
  const mid = rgb('#71892e');
  const high = rgb('#9aa443');
  const flowers = [rgb('#f0d23e'), rgb('#f2eee0'), rgb('#e6bd30'), rgb('#a982bd'), rgb('#f4f1e4'), rgb('#e9a43a')];
  const col = [0, 0, 0];
  eachPixel(n, (u, v, i) => {
    const t = h.data[i];
    mixRgb(low, mid, smoothstep(0.3, 0.55, t), col);
    mixRgb(col, high, smoothstep(0.55, 0.8, t) * 0.7, col);
    // Sheen where the laid stems catch the light.
    mixRgb(col, rgb('#b3b25c'), smoothstep(0.55, 0.62, lay.data[i]) * smoothstep(0.62, 0.38, lay.data[i]) * 0.25, col);
    mixRgb(col, rgb('#557a2c'), smoothstep(0.65, 0.78, fbm(u, v, 7, 3, seed + 3)) * 0.45, col);
    mixRgb(col, rgb('#2c3615'), cav.data[i] * 0.45, col);
    // Flowers: round heads on some cells, many more in the drifts.
    voronoi(u, v, 40, seed + 4, 0.95, c);
    const drift = smoothstep(0.5, 0.72, fbm(u, v, 5, 2, seed + 5));
    if (hash2(c.id, 1, seed) < 0.05 + drift * 0.45) {
      const head = smoothstep(0.3, 0.16, c.f1);
      const kind = Math.floor(hash2(c.id, 2, seed) * flowers.length);
      if (head > 0) mixRgb(col, flowers[kind], head * 0.95, col);
    }
    m.set(i, col, 1 - cav.data[i] * 0.45, 0.8);
  });
  m.normal = normalMap(h, 0.035 / 2.5);
  return finish(m, h, () => 0.95);
}

/**
 * Garrigue: pale stony soil, dry tussocks of straw-coloured grass and
 * round dark cushions of thyme, rosemary and kermes oak, each with a
 * shadowed rim.
 */
function scrub(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const bush = new Field(n);
  const stone = new Field(n);
  const ids = new Int32Array(n * n);
  bush.fill((u, v, i) => {
    voronoi(u, v, 6, seed + 1, 1.0, c);
    ids[i] = c.id;
    // Cushions grow in loose groups: where the group noise is high, more and bigger.
    const group = fbm(u, v, 3, 2, seed + 11);
    const r = (0.12 + hash2(c.id, 1, seed) * 0.3) * (0.6 + group * 0.8);
    const here = hash2(c.id, 2, seed) < 0.25 + group * 0.5;
    return here ? smoothstep(r, r * 0.3, c.f1 * (0.8 + fbm(u, v, 24, 3, seed + 2) * 0.4)) : 0;
  });
  stone.fill((u, v) => {
    voronoi(u, v, 30, seed + 3, 0.9, c);
    return hash2(c.id, 1, seed) < 0.1 ? smoothstep(0.42, 0.22, c.f1) : 0;
  });
  h.fill((u, v, i) => {
    const tuss = smoothstep(0.3, 0.6, fbm(u, v, 14, 3, seed + 4)) * 0.35 * (fbm(u, v, 80, 2, seed + 5, 0.5, 3) * 0.6 + 0.4);
    return fbm(u, v, 6, 3, seed) * 0.15 + Math.sqrt(bush.data[i]) * 0.75 + stone.data[i] * 0.3 + tuss;
  });
  const cav = cavity(h, 3, 4);
  const soil = rgb('#94805e');
  const soil2 = rgb('#7f6c50');
  const straw = rgb('#9c9558');
  const leaf = [rgb('#4a5530'), rgb('#56603a'), rgb('#5d5a35'), rgb('#3f4b2c')];
  const col = [0, 0, 0];
  const veg = new Float32Array(n * n);
  eachPixel(n, (u, v, i) => {
    mixRgb(soil, soil2, smoothstep(0.4, 0.7, fbm(u, v, 5, 3, seed + 6)), col);
    // Dry grass over most of it, in tussocks (straw on top, still green at the base).
    const tuss = smoothstep(0.3, 0.55, fbm(u, v, 14, 3, seed + 4));
    const blades = fbm(u, v, 80, 2, seed + 5, 0.5, 3);
    mixRgb(col, mixRgb(rgb('#7c8448'), straw, smoothstep(0.35, 0.7, blades), [0, 0, 0]), tuss * 0.9, col);
    if (stone.data[i] > 0) mixRgb(col, rgb('#a59c88'), stone.data[i] * 0.8, col);
    const b = bush.data[i];
    if (b > 0) {
      const lc = mixRgb(leaf[Math.floor(hash2(ids[i], 3, seed) * leaf.length)], rgb('#76784a'), fbm(u, v, 60, 2, seed + 7) * 0.35, [0, 0, 0]);
      // The cushion's lit crown and its shaded skirt.
      scale(lc, 0.75 + 0.35 * b);
      mixRgb(col, lc, smoothstep(0.0, 0.25, b), col);
    }
    mixRgb(col, rgb('#4a3c2a'), cav.data[i] * 0.55, col);
    veg[i] = Math.max(smoothstep(0.0, 0.25, b), tuss * 0.6);
    m.set(i, col, 1 - cav.data[i] * 0.6, 0.9 - b * 0.1);
  });
  m.normal = normalMap(h, 0.08 / 3);
  return finish(m, h, (i) => veg[i]);
}

/** A wood's floor: leaf litter of oak and the needles of pine, twigs, cushions of moss, a fern or two. */
function forest(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const leafId = new Int32Array(n * n);
  const leafF = new Field(n);
  leafF.fill((u, v, i) => {
    voronoi(u, v, 70, seed + 1, 1.0, c, 1);
    leafId[i] = c.id;
    return smoothstep(0.55, 0.15, c.f1);
  });
  const needles = new Field(n);
  needles.fill((u, v) => Math.max(fbm(u, v, 120, 2, seed + 6, 0.5, 6), fbm(v, u, 120, 2, seed + 7, 0.5, 6)));
  const twig = new Field(n);
  twig.fill((u, v) => Math.pow(ridge(u, v, 8, 3, seed + 2, 0.4), 22) * smoothstep(0.5, 0.65, fbm(u, v, 5, 2, seed + 3)));
  const moss = new Field(n);
  // Moss, ivy and the low evergreens of a Mediterranean wood's floor cover half of it.
  moss.fill((u, v) => smoothstep(0.42, 0.6, fbm(u, v, 5, 4, seed + 4)) * (0.75 + fbm(u, v, 40, 2, seed + 8) * 0.5));
  h.fill((u, v, i) => leafF.data[i] * 0.3 + needles.data[i] * 0.15 + fbm(u, v, 10, 3, seed) * 0.3 + twig.data[i] * 0.35 + moss.data[i] * 0.25);
  const cav = cavity(h, 2, 6);
  const litter = [rgb('#6b5134'), rgb('#7d5f39'), rgb('#5a4430'), rgb('#86663d'), rgb('#6f5838'), rgb('#7a6a45')];
  const col = [0, 0, 0];
  eachPixel(n, (u, v, i) => {
    const lc = litter[Math.floor(hash2(leafId[i], 1, seed) * litter.length)];
    mixRgb(rgb('#55432e'), lc, leafF.data[i], col);
    mixRgb(col, rgb('#8a6c44'), smoothstep(0.6, 0.75, needles.data[i]) * 0.35, col);
    mixRgb(col, mixRgb(rgb('#4c6226'), rgb('#6a7c36'), fbm(u, v, 30, 2, seed + 5), [0, 0, 0]), clamp01(moss.data[i]) * 0.9, col);
    mixRgb(col, rgb('#9a8460'), twig.data[i] * 0.6, col);
    mixRgb(col, rgb('#2a2016'), cav.data[i] * 0.55, col);
    m.set(i, col, 1 - cav.data[i] * 0.6, 0.86 - moss.data[i] * 0.05);
  });
  m.normal = normalMap(h, 0.03 / 3);
  return finish(m, h, (i) => clamp01(moss.data[i]));
}

/**
 * Rocky ground: grey limestone breaking through thin soil, as on a karst
 * hillside: rounded boulders and low outcrops, scree and gravel round them,
 * lichen on the stone and tufts of dry grass in the pockets of soil. (On a
 * rock tile the game stands its boulders on this.)
 */
function rock(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const ids = new Int32Array(n * n);
  const boulder = new Field(n);
  boulder.fill((u, v, i) => {
    const wu = u + (fbm(u, v, 6, 3, seed + 1) - 0.5) * 0.08;
    const wv = v + (fbm(u, v, 6, 3, seed + 2) - 0.5) * 0.08;
    voronoi(wu, wv, 5, seed, 0.8, c);
    ids[i] = c.id;
    const r = hash2(c.id, 1, seed);
    if (r > 0.75) return 0;
    // A rounded stone round its point, its outline roughened.
    const R = 0.22 + r * 0.32;
    const d = c.f1 * (0.85 + fbm(u, v, 18, 3, seed + 3) * 0.3);
    const x = clamp01(1 - d / R);
    return Math.sqrt(x) * (0.6 + r * 0.5);
  });
  const scree = new Field(n);
  const sIds = new Int32Array(n * n);
  scree.fill((u, v, i) => {
    voronoi(u, v, 40, seed + 3, 0.9, c);
    sIds[i] = c.id;
    return hash2(c.id, 1, seed) < 0.18 ? smoothstep(0.42, 0.2, c.f1) * 0.3 : 0;
  });
  h.fill((u, v, i) => Math.max(boulder.data[i] * (0.9 + (fbm(u, v, 24, 3, seed + 4) - 0.5) * 0.25), scree.data[i]) + fbm(u, v, 6, 3, seed + 5) * 0.1);
  const cav = cavity(h, 4, 3);
  const greys = [rgb('#8e897e'), rgb('#827d73'), rgb('#99927f'), rgb('#7d776d'), rgb('#9d9584')];
  const col = [0, 0, 0];
  const veg = new Float32Array(n * n);
  eachPixel(n, (u, v, i) => {
    const b = boulder.data[i];
    // Between the stones: brown stony soil, tufts of grass in its pockets.
    mixRgb(rgb('#86735a'), rgb('#74644c'), smoothstep(0.4, 0.7, fbm(u, v, 5, 3, seed + 6)), col);
    const tuft = smoothstep(0.6, 0.7, fbm(u, v, 20, 3, seed + 7)) * (1 - smoothstep(0, 0.1, b));
    mixRgb(col, rgb('#66703a'), tuft * 0.75, col);
    if (scree.data[i] > 0) mixRgb(col, greys[Math.floor(hash2(sIds[i], 2, seed) * greys.length)], smoothstep(0, 0.15, scree.data[i]) * 0.7, col);
    if (b > 0) {
      const sc = mixRgb(greys[Math.floor(hash2(ids[i], 2, seed) * greys.length)], rgb('#b0a894'), smoothstep(0.5, 0.8, fbm(u, v, 10, 4, seed + 8)) * 0.35, [0, 0, 0]);
      scale(sc, 0.9 + fbm(u, v, 60, 2, seed + 9) * 0.18);
      const li = smoothstep(0.62, 0.7, fbm(u, v, 22, 3, seed + 10)) * smoothstep(0.3, 0.7, b);
      mixRgb(sc, hash2(ids[i], 4, seed) < 0.5 ? rgb('#b3b08e') : rgb('#b3924f'), li * 0.5, sc);
      mixRgb(col, sc, smoothstep(0.0, 0.1, b), col);
    }
    mixRgb(col, rgb('#3e3a33'), cav.data[i] * 0.65, col);
    veg[i] = tuft;
    m.set(i, col, 1 - cav.data[i] * 0.7, b > 0 ? 0.78 : 0.92);
  });
  m.normal = normalMap(h, 0.5 / 6);
  return finish(m, h, (i) => veg[i]);
}

/** Dune sand: warm, with wind ripples and the odd darker grain. */
function sand(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  h.fill((u, v) => {
    const w = fbm(u, v, 3, 3, seed + 1) * 0.6;
    const rip = Math.sin((v * 22 + w * 2 + fbm(u, v, 6, 2, seed + 2) * 0.6) * Math.PI * 2);
    return 0.5 + rip * 0.18 * smoothstep(0.25, 0.6, fbm(u, v, 4, 2, seed + 3)) + fbm(u, v, 5, 3, seed) * 0.3;
  });
  const col = [0, 0, 0];
  eachPixel(n, (u, v, i) => {
    mixRgb(rgb('#b49c70'), rgb('#c4ae84'), smoothstep(0.35, 0.7, fbm(u, v, 5, 4, seed + 4)), col);
    mixRgb(col, rgb('#9c8059'), smoothstep(0.45, 0.25, h.data[i]) * 0.35, col);
    scale(col, 0.95 + hash2(Math.floor(u * n), Math.floor(v * n), seed + 5) * 0.08);
    m.set(i, col, 1, 0.92);
  });
  m.normal = normalMap(h, 0.02 / 3);
  return finish(m, h, () => 0);
}

/** A beach: pale fine sand, broken shells and a few smooth pebbles (the wet band is the shader's). */
function beach(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const shell = new Field(n);
  const ids = new Int32Array(n * n);
  shell.fill((u, v, i) => {
    voronoi(u, v, 50, seed + 1, 0.95, c);
    ids[i] = c.id;
    return hash2(c.id, 1, seed) < 0.08 ? smoothstep(0.32, 0.16, c.f1) : 0;
  });
  h.fill((u, v, i) => fbm(u, v, 6, 4, seed) * 0.5 + fbm(u, v, 40, 2, seed + 2) * 0.2 + shell.data[i] * 0.35);
  const cav = cavity(h, 2, 6);
  const col = [0, 0, 0];
  const bits = [rgb('#f0e8d8'), rgb('#e3cfb0'), rgb('#8f8676'), rgb('#c9b9a2')];
  eachPixel(n, (u, v, i) => {
    mixRgb(rgb('#bfad86'), rgb('#cbbd98'), smoothstep(0.35, 0.7, fbm(u, v, 4, 3, seed + 3)), col);
    scale(col, 0.96 + hash2(Math.floor(u * n), Math.floor(v * n), seed + 4) * 0.07);
    if (shell.data[i] > 0) mixRgb(col, bits[Math.floor(hash2(ids[i], 2, seed) * bits.length)], shell.data[i], col);
    mixRgb(col, rgb('#9c8a68'), cav.data[i] * 0.5, col);
    m.set(i, col, 1 - cav.data[i] * 0.4, 0.88 - shell.data[i] * 0.3);
  });
  m.normal = normalMap(h, 0.015 / 3);
  return finish(m, h, () => 0);
}

/** A farm's tilled soil: ploughed furrows along u (a field lies square to the map), clods, a few weeds. */
function soil(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const FURROWS = 6; // per 3 m repeat: one every 50 cm
  h.fill((u, v) => {
    const w = (fbm(u, v, 4, 2, seed + 1) - 0.5) * 0.04;
    const f = 0.5 + 0.5 * Math.cos((v + w) * FURROWS * Math.PI * 2);
    return Math.pow(f, 0.7) * 0.6 + fbm(u, v, 30, 3, seed + 2) * 0.35;
  });
  const cav = cavity(h, 3, 4);
  const col = [0, 0, 0];
  const weed = new Field(n);
  weed.fill((u, v) => smoothstep(0.72, 0.8, fbm(u, v, 30, 2, seed + 5)) * smoothstep(0.5, 0.8, fbm(u, v, 3, 2, seed + 6)));
  eachPixel(n, (u, v, i) => {
    mixRgb(rgb('#5e4430'), rgb('#7c5f42'), smoothstep(0.3, 0.8, h.data[i]), col);
    mixRgb(col, rgb('#8f7656'), smoothstep(0.6, 0.8, fbm(u, v, 5, 3, seed + 3)) * 0.3, col);
    mixRgb(col, rgb('#5c6e2c'), weed.data[i] * 0.8, col);
    mixRgb(col, rgb('#2e2118'), cav.data[i] * 0.6, col);
    m.set(i, col, 1 - cav.data[i] * 0.6, 0.94);
  });
  m.normal = normalMap(h, 0.07 / 3);
  return finish(m, h, (i) => weed.data[i]);
}

/** The bed under water: grey-olive silt, pebbles, and dark weed in patches. */
function bed(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const peb = new Field(n);
  const ids = new Int32Array(n * n);
  peb.fill((u, v, i) => {
    voronoi(u, v, 30, seed + 1, 0.9, c);
    ids[i] = c.id;
    return hash2(c.id, 1, seed) < 0.35 ? smoothstep(0.45, 0.2, c.f1) : 0;
  });
  h.fill((u, v, i) => fbm(u, v, 5, 4, seed) * 0.5 + peb.data[i] * 0.5);
  const cav = cavity(h, 2, 5);
  const col = [0, 0, 0];
  const stones = [rgb('#8d8778'), rgb('#a59b86'), rgb('#6c6a60'), rgb('#7d7262')];
  eachPixel(n, (u, v, i) => {
    mixRgb(rgb('#a39a7a'), rgb('#857d62'), smoothstep(0.3, 0.7, fbm(u, v, 4, 3, seed + 2)), col);
    if (peb.data[i] > 0) mixRgb(col, stones[Math.floor(hash2(ids[i], 2, seed) * 4)], peb.data[i], col);
    mixRgb(col, rgb('#3f4a2a'), smoothstep(0.62, 0.75, fbm(u, v, 6, 3, seed + 3)) * 0.7, col);
    mixRgb(col, rgb('#4a4436'), cav.data[i] * 0.5, col);
    m.set(i, col, 1 - cav.data[i] * 0.5, 0.7);
  });
  m.normal = normalMap(h, 0.04 / 3);
  return finish(m, h, () => 0);
}

/**
 * Via glareata: a road of rammed gravel, as most of the provinces' roads
 * were: light stones bedded in packed earth, larger ones worked up to the
 * top, finer grit where wheels and feet go.
 */
function gravel(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const ids = new Int32Array(n * n);
  const stone = new Field(n);
  stone.fill((u, v, i) => {
    voronoi(u, v, 48, seed + 1, 0.95, c);
    ids[i] = c.id;
    return hash2(c.id, 1, seed) < 0.55 ? smoothstep(0.5, 0.2, c.f1 * (0.8 + hash2(c.id, 2, seed) * 0.5)) : 0;
  });
  h.fill((u, v, i) => stone.data[i] * 0.6 + fbm(u, v, 6, 3, seed) * 0.3 + fbm(u, v, 90, 2, seed + 2) * 0.15);
  const cav = cavity(h, 2, 5);
  const col = [0, 0, 0];
  const stones = [rgb('#c9bda5'), rgb('#b7a98f'), rgb('#d3c8b0'), rgb('#a39784'), rgb('#bba78a')];
  eachPixel(n, (u, v, i) => {
    mixRgb(rgb('#a8946f'), rgb('#bba886'), smoothstep(0.35, 0.7, fbm(u, v, 5, 3, seed + 3)), col);
    if (stone.data[i] > 0) mixRgb(col, stones[Math.floor(hash2(ids[i], 3, seed) * stones.length)], smoothstep(0, 0.5, stone.data[i]), col);
    mixRgb(col, rgb('#6e5e48'), cav.data[i] * 0.6, col);
    m.set(i, col, 1 - cav.data[i] * 0.55, 0.84 - stone.data[i] * 0.1);
  });
  m.normal = normalMap(h, 0.03 / 2);
  return finish(m, h, () => 0);
}

/**
 * Basalt paving of a town's streets (silice stratae): big polygonal lava
 * blocks fitted close, each its own tone and tilt, polished on top, grit in
 * the joints. The well's street (surfaces.js basalt) at a game's scale:
 * joints wide enough to read at 256 px.
 */
function basalt(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const ids = new Int32Array(n * n);
  const edgeF = new Field(n);
  const GROUT = 0.03;
  h.fill((u, v, i) => {
    const wu = u + (fbm(u, v, 3, 3, seed + 11) - 0.5) * 0.09;
    const wv = v + (fbm(u, v, 3, 3, seed + 12) - 0.5) * 0.09;
    voronoi(wu, wv, 9, seed, 1.0, c);
    ids[i] = c.id;
    edgeF.data[i] = c.edge;
    const level = 0.8 + (hash2(c.id, 1, seed) - 0.5) * 0.15;
    const bevel = smoothstep(GROUT, GROUT + 0.06, c.edge);
    return lerp(0.15, level + (fbm(u, v, 22, 3, seed + 2) - 0.5) * 0.05, bevel);
  });
  const cav = cavity(h, 3, 3);
  const tones = [rgb('#4a453f'), rgb('#524b42'), rgb('#45423e'), rgb('#4e473d'), rgb('#5a5146')];
  const col = [0, 0, 0];
  eachPixel(n, (u, v, i) => {
    const e = edgeF.data[i];
    const inJoint = 1 - smoothstep(GROUT * 0.6, GROUT + 0.02, e);
    const wear = smoothstep(GROUT + 0.08, 0.35, e);
    mixRgb(tones[Math.floor(hash2(ids[i], 2, seed) * tones.length)], rgb('#8c8172'), (1 - wear) * 0.2 + fbm(u, v, 9, 3, seed + 6) * 0.1, col);
    scale(col, 0.88 + fbm(u, v, 40, 3, seed + 7) * 0.24);
    mixRgb(col, rgb('#2c2722'), inJoint, col);
    mixRgb(col, rgb('#38342f'), cav.data[i] * 0.4, col);
    m.set(i, col, 1 - Math.max(inJoint * 0.5, cav.data[i] * 0.5), lerp(0.62 - wear * 0.15, 0.95, inJoint));
  });
  m.normal = normalMap(h, 0.03 / 4.8);
  return finish(m, h, () => 0);
}

/**
 * A forum's flagstones: rectangular slabs of travertine laid in courses
 * along u, each course its own width, each slab its own length and tone,
 * with worn corners and dark joints.
 */
function flags(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const ids = new Int32Array(n * n);
  const edgeF = new Field(n);
  // Courses: 4 m in 4 courses of 0.8 to 1.2 m (relative widths summing to 1).
  const ws = [0.27, 0.22, 0.29, 0.22];
  const JOINT = 0.006;
  const slabAt = (u, v) => {
    let v0 = 0;
    let row = 0;
    while (row < ws.length - 1 && v >= v0 + ws[row]) { v0 += ws[row]; row++; }
    const v1 = v0 + ws[row];
    // Slabs along the course: lengths from 0.25 to 0.45 of the repeat (1 to 1.8 m), wrapping.
    const L = [0.3, 0.25, 0.45];
    const off = hash2(row, 7, seed);
    let uu = (u + off) % 1;
    let k = 0;
    let s0 = 0;
    const order = [L[row % 3], L[(row + 1) % 3], L[(row + 2) % 3]];
    while (k < 2 && uu >= s0 + order[k]) { s0 += order[k]; k++; }
    const s1 = k === 2 ? 1 : s0 + order[k];
    const e = Math.min(uu - s0, s1 - uu, v - v0, v1 - v);
    return { id: row * 7 + k, e };
  };
  h.fill((u, v, i) => {
    const s = slabAt(u, v);
    ids[i] = s.id;
    edgeF.data[i] = s.e;
    const lvl = 0.8 + (hash2(s.id, 1, seed) - 0.5) * 0.08;
    return lerp(0.2, lvl + (fbm(u, v, 16, 3, seed + 1) - 0.5) * 0.04, smoothstep(JOINT, JOINT + 0.012, s.e));
  });
  const cav = cavity(h, 2, 4);
  const tones = [rgb('#cbbd9c'), rgb('#d6c9aa'), rgb('#c2b190'), rgb('#d0c1a0'), rgb('#bfae8c')];
  const col = [0, 0, 0];
  const c = cell();
  eachPixel(n, (u, v, i) => {
    const inJoint = 1 - smoothstep(JOINT * 0.5, JOINT + 0.006, edgeF.data[i]);
    mixRgb(tones[Math.floor(hash2(ids[i], 2, seed) * tones.length)], rgb('#e0d6c0'), smoothstep(0.55, 0.8, fbm(u, v, 6, 3, seed + 2)) * 0.4, col);
    // Travertine's pores: small dark pits stretched along the bedding.
    voronoi(u, v, 70, seed + 3, 0.95, c, 2.5);
    const pore = hash2(c.id, 1, seed) < 0.15 ? smoothstep(0.25, 0.08, c.f1) : 0;
    mixRgb(col, rgb('#8d7c5e'), pore * 0.6, col);
    mixRgb(col, rgb('#5d5243'), inJoint, col);
    mixRgb(col, rgb('#8a7c62'), cav.data[i] * 0.5, col);
    m.set(i, col, 1 - Math.max(inJoint * 0.5, cav.data[i] * 0.4), lerp(0.7, 0.95, inJoint));
  });
  m.normal = normalMap(h, 0.02 / 4);
  return finish(m, h, () => 0);
}

/**
 * Rubble of a fallen building: broken stone and brick, roof tile shards,
 * lumps of mortar, charred timber and ash.
 */
function rubble(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const ids = new Int32Array(n * n);
  const lump = new Field(n);
  lump.fill((u, v, i) => {
    voronoi(u, v, 14, seed + 1, 1.0, c);
    ids[i] = c.id;
    const r = hash2(c.id, 1, seed);
    return r < 0.75 ? smoothstep(0.0, 0.12, c.edge) * (0.5 + r * 0.6) : 0;
  });
  const fine = new Field(n);
  fine.fill((u, v) => {
    voronoi(u, v, 46, seed + 2, 1.0, c);
    return hash2(c.id, 1, seed) < 0.5 ? smoothstep(0.0, 0.08, c.edge) : 0;
  });
  h.fill((u, v, i) => lump.data[i] * 0.7 + fine.data[i] * 0.25 + fbm(u, v, 8, 3, seed) * 0.2);
  const cav = cavity(h, 3, 3);
  const bits = [rgb('#a59c8c'), rgb('#8c8373'), rgb('#94604a'), rgb('#b2a690'), rgb('#7a6f60'), rgb('#5a4c40'), rgb('#9a8a74'), rgb('#857a6a')];
  const col = [0, 0, 0];
  eachPixel(n, (u, v, i) => {
    mixRgb(rgb('#6f655a'), rgb('#504840'), smoothstep(0.4, 0.7, fbm(u, v, 5, 3, seed + 3)), col);
    if (lump.data[i] > 0) mixRgb(col, bits[Math.floor(hash2(ids[i], 2, seed) * bits.length)], smoothstep(0, 0.4, lump.data[i]), col);
    else if (fine.data[i] > 0) mixRgb(col, bits[Math.floor(hash2(i >> 9, 3, seed) * 4)], fine.data[i] * 0.6, col);
    // Soot and ash in drifts.
    mixRgb(col, rgb('#2a2522'), smoothstep(0.6, 0.75, fbm(u, v, 4, 3, seed + 4)) * 0.55, col);
    mixRgb(col, rgb('#2c2622'), cav.data[i] * 0.7, col);
    m.set(i, col, 1 - cav.data[i] * 0.7, 0.9);
  });
  m.normal = normalMap(h, 0.12 / 3);
  return finish(m, h, () => 0);
}

/** Ripples for water: only the normal map matters (two scales of swell). */
function ripples(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  h.fill((u, v) => fbm(u, v, 3, 5, seed, 0.55) * 0.65 + fbm(u, v, 11, 3, seed + 1) * 0.35);
  eachPixel(n, (u, v, i) => m.set(i, [0.5, 0.5, 0.5], 1, 0.05));
  m.normal = normalMap(h, 0.06);
  return finish(m, h, () => 0);
}

/**
 * The layers of the ground's texture arrays, in order (a layer's index is
 * its kind's number for the first nine, groundMap.js KIND), how many
 * metres one repeat covers, and whether the shader may mix in a turned copy
 * against tiling (`anti`): not for a pattern laid square to the map, the
 * furrows, the paving's joints and the flagstones' courses.
 */
export const GROUND_LAYERS = Object.freeze([
  { name: 'grass', metres: 2.5, make: grass, anti: true },
  { name: 'meadow', metres: 2.5, make: meadow, anti: true },
  { name: 'scrub', metres: 3.5, make: scrub, anti: true },
  { name: 'forest', metres: 3, make: forest, anti: true },
  { name: 'rock', metres: 6, make: rock, anti: true },
  { name: 'sand', metres: 3, make: sand, anti: true },
  { name: 'beach', metres: 3, make: beach, anti: true },
  { name: 'soil', metres: 3, make: soil, anti: false },
  { name: 'bed', metres: 3, make: bed, anti: true },
  { name: 'gravel', metres: 2, make: gravel, anti: true },
  { name: 'basalt', metres: 4.8, make: basalt, anti: false },
  { name: 'flags', metres: 4, make: flags, anti: false },
  { name: 'rubble', metres: 3, make: rubble, anti: true },
  { name: 'ripples', metres: 6, make: ripples, anti: false },
]);

/** Layer index by name. */
export const LAYER = Object.freeze(Object.fromEntries(GROUND_LAYERS.map((l, i) => [l.name, i])));

/** Make one layer's maps (seeded by its name), `size` px square. */
export function makeGroundLayer(name, size = GROUND_SIZE) {
  const l = GROUND_LAYERS[LAYER[name]];
  if (!l) throw new Error(`Unknown ground layer: ${name}`);
  let k = 0;
  for (let i = 0; i < name.length; i++) k = (k * 31 + name.charCodeAt(i)) | 0;
  const maps = l.make(size, k);
  maps.metres = l.metres;
  return maps;
}
