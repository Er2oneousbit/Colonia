/**
 * surfaces.js
 * ----------------------------------------------------------------------------
 * Recipes for the procedural PBR surfaces of the 3D look: each makes a
 * tiling MapSet (texgen.js: albedo, normal, occlusion/roughness/metalness)
 * from noise, the way a texture artist would paint it, in layers: the base
 * material, its structure (grain, strata, pores, cells), then wear and dirt.
 *
 *   SURFACES[name] = { metres, size, make(size, seed) => MapSet }
 *
 * `metres` is how much of the world one repeat of the texture covers:
 * meshes are given UVs in metres (shapes.js), and the material scales them
 * by 1 / metres, so a stone's grain is the same size on a block as on a
 * curb. Colours are written in sRGB (the albedo texture is tagged so) and
 * kept in the range of real materials (no albedo under about 0.03 or over
 * 0.9 linear), or physically based light makes them glow or go dead.
 *
 * All pure arithmetic (texgen.js), so it runs in node:test.
 * ----------------------------------------------------------------------------
 */

import {
  Field, MapSet, fbm, fbmField, ridge, ridgeField, voronoi, hash2, normalMap, cavity, rgb, mixRgb, clamp01, smoothstep, lerp,
} from './texgen.js';

/** Scratch cell result for voronoi() (one per recipe call is enough: recipes are synchronous). */
const cell = () => ({ id: 0, f1: 0, edge: 0, cx: 0, cy: 0 });

/** Fill a MapSet pixel by pixel: paint(u, v, i) is called for every pixel centre. */
function eachPixel(n, paint) {
  for (let y = 0; y < n; y++) {
    const v = (y + 0.5) / n;
    for (let x = 0; x < n; x++) paint((x + 0.5) / n, v, y * n + x);
  }
}

/**
 * Limestone of the puteal (the well's curb): a fine pale stone with grain,
 * a few pits, faint warm veins and cloudy tone. Smooth-ish where hands and
 * ropes wore it, which the model's vertex colours and roughness add.
 */
function limestone(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const vein = new Field(n);
  // (The noises read at the pixel centres are made a texture at a time: fbmField.)
  const grain = fbmField(n, 24, 4, seed + 1);
  const body = fbmField(n, 5, 5, seed);
  h.fill((u, v, i) => {
    voronoi(u, v, 36, seed + 2, 0.9, c);
    const pit = hash2(c.id, 3, seed) < 0.05 ? smoothstep(0.12, 0.03, c.f1) : 0;
    return body[i] * 0.45 + grain[i] * 0.45 - pit * 0.6;
  });
  const warp = fbmField(n, 3, 3, seed + 5);
  vein.fill((u, v, i) => {
    const w = warp[i];
    return Math.pow(ridge(u + w * 0.35, v + w * 0.2, 3, 4, seed + 6), 14);
  });
  const cav = cavity(h, 3, 6);
  const base = rgb('#d0c09c');
  const warm = rgb('#b99f78');
  const cool = rgb('#dcd3bd');
  const veinCol = rgb('#a08a66');
  const dirt = rgb('#7a6a50');
  const col = [0, 0, 0];
  const tone = fbmField(n, 3, 4, seed + 9);
  const coolN = fbmField(n, 6, 3, seed + 11);
  const speckN = fbmField(n, 64, 2, seed + 13);
  eachPixel(n, (u, v, i) => {
    const t = tone[i];
    mixRgb(base, warm, smoothstep(0.45, 0.75, t) * 0.8, col);
    mixRgb(col, cool, smoothstep(0.5, 0.25, coolN[i]) * 0.6, col);
    mixRgb(col, veinCol, vein.data[i] * 0.45, col);
    const speck = speckN[i];
    const k = 0.94 + speck * 0.1;
    col[0] *= k; col[1] *= k; col[2] *= k;
    mixRgb(col, dirt, cav.data[i] * 0.45, col);
    m.set(i, col, 1 - cav.data[i] * 0.4, 0.62 + speck * 0.18 + cav.data[i] * 0.15);
  });
  m.normal = normalMap(h, 0.0035 / 0.8);
  return m;
}

/**
 * Travertine of the platform blocks: banded strata along u, the stone's
 * typical open pores stretched along the bedding, warm beige, worn smooth
 * on top (the model darkens and dirties the foot of each block).
 */
function travertine(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const pore = new Field(n);
  const c = cell();
  pore.fill((u, v) => {
    voronoi(u, v, 24, seed + 3, 0.95, c, 3.2);
    const p = hash2(c.id, 1, seed) < 0.22 ? smoothstep(0.22, 0.06, c.f1 * (0.7 + hash2(c.id, 2, seed) * 0.8)) : 0;
    voronoi(u, v, 48, seed + 4, 0.95, c, 3);
    const q = hash2(c.id, 5, seed) < 0.18 ? smoothstep(0.24, 0.06, c.f1) : 0;
    return Math.max(p, q * 0.8);
  });
  const strata = fbmField(n, 10, 5, seed, 0.55, 8);
  const grain = fbmField(n, 40, 3, seed + 1);
  h.fill((u, v, i) => strata[i] * 0.35 + grain[i] * 0.3 - pore.data[i] * 0.9);
  const cav = cavity(h, 2, 5);
  const a = rgb('#c4ad86');
  const b = rgb('#ad9470');
  const lite = rgb('#d6c8aa');
  const hole = rgb('#806b50');
  const col = [0, 0, 0];
  const bandN = fbmField(n, 12, 4, seed + 7, 0.5, 10);
  const liteN = fbmField(n, 4, 3, seed + 8);
  const grit = fbmField(n, 80, 2, seed + 9);
  eachPixel(n, (u, v, i) => {
    const band = bandN[i];
    mixRgb(a, b, smoothstep(0.4, 0.7, band), col);
    mixRgb(col, lite, smoothstep(0.55, 0.8, liteN[i]) * 0.5, col);
    mixRgb(col, hole, Math.max(pore.data[i] * 0.6, cav.data[i] * 0.35), col);
    const g = 0.95 + grit[i] * 0.1;
    col[0] *= g; col[1] *= g; col[2] *= g;
    m.set(i, col, 1 - Math.max(pore.data[i] * 0.7, cav.data[i] * 0.4), 0.78 + pore.data[i] * 0.2);
  });
  m.normal = normalMap(h, 0.006 / 1.0);
  return m;
}

/**
 * Basalt street paving as at Pompeii: big polygonal lava blocks, each a
 * slightly cushioned top with its own tone and tilt, set in dark joints of
 * grit. The tops are polished by feet and wheels (lower roughness), the
 * joints rough and dusty, and the Vesuvian lava's pale leucite specks show.
 * Also keeps the low-pass height (`height`) for the mesh to be displaced
 * by, while the normal map carries only what the mesh cannot (joints,
 * pores, chips): both together, not twice the slope.
 */
function basalt(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const stoneId = new Int32Array(n * n);
  const edgeF = new Field(n);
  const GROUT = 0.012; // joint half width, cell units (about 6 mm): Roman paviors fitted the blocks tight
  // The mesh gets only each stone's own level and tilt (`plate`): the joints
  // are too fine for a mesh a game would draw, and a blurred joint in the
  // mesh makes every stone a pillow. Joints, arrises and chips are left to
  // the normal map, the occlusion and the colour.
  const plate = new Field(n);
  // (The noises read at the pixel centres are made a texture at a time: fbmField.)
  const warpU = fbmField(n, 3, 3, seed + 11);
  const warpV = fbmField(n, 3, 3, seed + 12);
  const topN = fbmField(n, 22, 3, seed + 2);
  const jointN = fbmField(n, 60, 2, seed + 3);
  const chipN = fbmField(n, 30, 3, seed + 4);
  h.fill((u, v, i) => {
    // Warp the cells a little so the stones come in many sizes and their edges are not ruler-straight.
    const wu = u + (warpU[i] - 0.5) * 0.09;
    const wv = v + (warpV[i] - 0.5) * 0.09;
    voronoi(wu, wv, 9, seed, 1.0, c);
    stoneId[i] = c.id;
    edgeF.data[i] = c.edge;
    const e = c.edge;
    const r1 = hash2(c.id, 1, seed);
    const tx = (hash2(c.id, 4, seed) - 0.5) * 0.25;
    const tz = (hash2(c.id, 5, seed) - 0.5) * 0.25;
    const level = 0.8 + (r1 - 0.5) * 0.12 + tx * (wu * 9 - c.cx) + tz * (wv * 9 - c.cy);
    plate.data[i] = level;
    // A worn, rounded arris: the stone falls into the joint over 2 to 3 cm.
    const bevel = smoothstep(GROUT, GROUT + 0.035, e);
    const top = level + (topN[i] - 0.5) * 0.04;
    const joint = 0.2 + jointN[i] * 0.08;
    // Chips knocked out of the arrises.
    const chip = smoothstep(0.64, 0.8, chipN[i]) * (1 - smoothstep(GROUT + 0.03, GROUT + 0.14, e));
    return lerp(joint, top, bevel) - chip * 0.2;
  });
  const low = plate.blur(2);
  const high = new Field(n);
  for (let i = 0; i < n * n; i++) high.data[i] = h.data[i] - low.data[i];
  const cav = cavity(h, 4, 3);
  const tones = [rgb('#45403a'), rgb('#4d463d'), rgb('#3f3d3a'), rgb('#4a4339'), rgb('#554c41')];
  const grit = rgb('#2f2a24');
  const dust = rgb('#8c8172');
  const speck = rgb('#bdb6a8');
  const col = [0, 0, 0];
  const dustN = fbmField(n, 9, 3, seed + 6);
  const mottN = fbmField(n, 40, 3, seed + 7);
  const roughN = fbmField(n, 50, 2, seed + 9);
  eachPixel(n, (u, v, i) => {
    const id = stoneId[i];
    const e = edgeF.data[i];
    const r2 = hash2(id, 2, seed);
    const r3 = hash2(id, 3, seed);
    const base = tones[Math.floor(r2 * tones.length)];
    const inJoint = 1 - smoothstep(GROUT * 0.5, GROUT + 0.015, e);
    const wear = smoothstep(GROUT + 0.08, 0.32, e) * (0.6 + r3 * 0.4);
    // Stone: mottled, darker and smoother where polished, dusty near the joints.
    mixRgb(base, dust, (1 - wear) * 0.18 + dustN[i] * 0.1, col);
    const mott = 0.88 + mottN[i] * 0.24;
    col[0] *= mott; col[1] *= mott; col[2] *= mott;
    const sp = hash2(Math.floor(u * n * 0.5), Math.floor(v * n * 0.5), seed + 8) < 0.005 ? 0.3 : 0;
    mixRgb(col, speck, sp * (1 - inJoint), col);
    mixRgb(col, grit, inJoint, col);
    mixRgb(col, rgb('#3a3632'), cav.data[i] * 0.5, col);
    const rough = lerp(0.72 - wear * 0.2, 0.95, inJoint) + (roughN[i] - 0.5) * 0.08;
    m.set(i, col, 1 - Math.max(inJoint * 0.45, cav.data[i] * 0.6), rough);
  });
  m.normal = normalMap(high, 0.018 / 4.8);
  m.height = low;
  return m;
}

/** Grey-yellow tufa of the kerb stones: soft, porous, with black scoria specks. */
function tufa(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const sc = new Field(n);
  sc.fill((u, v) => {
    voronoi(u, v, 30, seed + 1, 0.9, c);
    return hash2(c.id, 1, seed) < 0.18 ? smoothstep(0.28, 0.12, c.f1) : 0;
  });
  h.fill((u, v, i) => fbm(u, v, 8, 5, seed) * 0.5 + fbm(u, v, 48, 3, seed + 2) * 0.4 - sc.data[i] * 0.3);
  const cav = cavity(h, 2, 6);
  const a = rgb('#b0a283');
  const b = rgb('#9b8f74');
  const dark = rgb('#3a3631');
  const col = [0, 0, 0];
  eachPixel(n, (u, v, i) => {
    mixRgb(a, b, smoothstep(0.35, 0.7, fbm(u, v, 4, 4, seed + 4)), col);
    mixRgb(col, dark, sc.data[i] * 0.8, col);
    mixRgb(col, rgb('#5d5446'), cav.data[i] * 0.6, col);
    m.set(i, col, 1 - cav.data[i] * 0.5, 0.88);
  });
  m.normal = normalMap(h, 0.006 / 1.0);
  return m;
}

/**
 * Cocciopesto of the raised pavement: lime mortar reddened with crushed
 * tile, rows of small white limestone tesserae set into it (as in front of
 * Pompeian houses), hairline cracks and worn patches.
 */
function cocciopesto(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const tess = new Field(n);
  const c = cell();
  const ROWS = 14; // tesserae rows per 2 m: one every 14 cm
  tess.fill((u, v) => {
    const row = Math.floor(v * ROWS);
    const off = (row % 2) * 0.5;
    const col = Math.floor(u * ROWS + off);
    if (hash2(col, row, seed) < 0.12) return 0; // a lost tessera
    const cu = (col + 0.5 - off) / ROWS + (hash2(col, row, seed + 1) - 0.5) * 0.006;
    const cv = (row + 0.5) / ROWS + (hash2(col, row, seed + 2) - 0.5) * 0.006;
    let du = Math.abs(u - cu);
    du = Math.min(du, 1 - du);
    const dv = Math.abs(v - cv);
    const s = 0.0045; // half a tessera: about 1 cm square
    return smoothstep(s + 0.0015, s, Math.max(du, dv));
  });
  const crack = new Field(n);
  const crackN = ridgeField(n, 3, 4, seed + 5);
  const crackMask = fbmField(n, 3, 2, seed + 6);
  crack.fill((u, v, i) => Math.pow(crackN[i], 30) * smoothstep(0.45, 0.6, crackMask[i]));
  // The aggregate's cells, kept: the colour reads the same ones.
  const aggId = new Int32Array(n * n);
  const aggF1 = new Float64Array(n * n);
  const mortar = fbmField(n, 10, 4, seed);
  h.fill((u, v, i) => {
    voronoi(u, v, 90, seed + 3, 0.9, c);
    aggId[i] = c.id;
    aggF1[i] = c.f1;
    const agg = hash2(c.id, 1, seed) < 0.3 ? smoothstep(0.4, 0.2, c.f1) * 0.25 : 0;
    return mortar[i] * 0.4 + agg + tess.data[i] * 0.15 - crack.data[i] * 0.5;
  });
  const cav = cavity(h, 3, 5);
  const red = rgb('#8a5644');
  const pale = rgb('#a07a62');
  const frag = rgb('#7a3e30');
  const white = rgb('#e2ddd0');
  const col = [0, 0, 0];
  const paleN = fbmField(n, 5, 4, seed + 7);
  eachPixel(n, (u, v, i) => {
    mixRgb(red, pale, smoothstep(0.45, 0.75, paleN[i]) * 0.7, col);
    if (hash2(aggId[i], 2, seed) < 0.25) mixRgb(col, frag, smoothstep(0.42, 0.25, aggF1[i]) * 0.7, col);
    mixRgb(col, white, tess.data[i] * 0.9, col);
    mixRgb(col, rgb('#4e3a30'), Math.max(cav.data[i] * 0.6, crack.data[i] * 0.7), col);
    m.set(i, col, 1 - cav.data[i] * 0.5, 0.82 - tess.data[i] * 0.2);
  });
  m.normal = normalMap(h, 0.004 / 2.0);
  return m;
}

/**
 * The plastered house wall, 4 m wide and 4 m tall (it repeats along the
 * wall, not up it: v is the height, 0 at the street). A black socle, a
 * Pompeian red dado to 1.3 m, a dark band, then ochre-cream plaster; rain
 * streaks, rising damp at the foot, and patches where the plaster fell off
 * to show the opus incertum (rubble in mortar) behind it.
 */
function plaster(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const loss = new Field(n);
  const c = cell();
  const H = 4; // metres the texture spans vertically
  const lossN = fbmField(n, 3, 5, seed + 1);
  loss.fill((u, v, i) => {
    const y = v * H;
    const t = lossN[i] + smoothstep(1.2, 0.1, y) * 0.12 - smoothstep(2.0, 3.0, y) * 0.05;
    return smoothstep(0.73, 0.745, t);
  });
  const stones = new Int32Array(n * n);
  const stoneE = new Field(n);
  const skin = fbmField(n, 30, 3, seed + 4);
  h.fill((u, v, i) => {
    const plasterH = 0.75 + skin[i] * 0.05;
    if (loss.data[i] <= 0) return plasterH;
    voronoi(u, v, 22, seed + 2, 0.95, c);
    stones[i] = c.id;
    stoneE.data[i] = c.edge;
    const rubble = 0.15 + smoothstep(0.02, 0.12, c.edge) * 0.25 + fbm(u, v, 40, 2, seed + 3) * 0.08;
    return lerp(plasterH, rubble, loss.data[i]);
  });
  const cav = cavity(h, 3, 4);
  const socle = rgb('#2c2623');
  const red = rgb('#8d3426');
  const band = rgb('#3a2a22');
  const cream = rgb('#d6c29c');
  const ochre = rgb('#c7a26d');
  const mortar = rgb('#6f675a');
  const rub = [rgb('#6d655b'), rgb('#5a4c3e'), rgb('#86765c'), rgb('#4a4744'), rgb('#7a5f45')];
  const damp = rgb('#4f4a3c');
  const col = [0, 0, 0];
  const wobN = fbmField(n, 12, 2, seed + 5);
  const dadoN = fbmField(n, 6, 4, seed + 6);
  const creamN = fbmField(n, 5, 4, seed + 7);
  const fadeN = fbmField(n, 3, 3, seed + 8);
  // The streaks' noise is read with u and v swapped (stretched down the wall): pixel (x, y) is (y, x) of the field.
  const streakN = fbmField(n, 40, 3, seed + 9, 0.5, 0.06);
  const tideN = fbmField(n, 8, 3, seed + 10);
  eachPixel(n, (u, v, i) => {
    const y = v * H;
    // The painted zones, with brushy edges.
    const wob = (wobN[i] - 0.5) * 0.02;
    if (y < 0.28 + wob) col.splice(0, 3, ...socle);
    else if (y < 1.3 + wob) mixRgb(red, rgb('#a4473a'), dadoN[i] * 0.6, col);
    else if (y < 1.36 + wob) col.splice(0, 3, ...band);
    else mixRgb(cream, ochre, smoothstep(0.35, 0.75, creamN[i]) * 0.6, col);
    // Faded by sun: a soft wash of chalky pale over everything painted.
    mixRgb(col, rgb('#e3d8c6'), 0.08 + fadeN[i] * 0.12, col);
    // Rain streaks run down from the top.
    const streak = smoothstep(0.55, 0.8, streakN[(i % n) * n + ((i / n) | 0)]) * smoothstep(1.2, 3.8, y);
    mixRgb(col, rgb('#8b7f6c'), streak * 0.25, col);
    // Rubble where the plaster is gone.
    if (loss.data[i] > 0) {
      const id = stones[i];
      const r = rub[Math.floor(hash2(id, 1, seed) * rub.length)];
      const inMortar = 1 - smoothstep(0.02, 0.07, stoneE.data[i]);
      const rc = mixRgb(r, mortar, inMortar, [0, 0, 0]);
      mixRgb(col, rc, loss.data[i], col);
    }
    // Rising damp: darker and greener at the foot, with an irregular tide line.
    const tide = 0.45 + tideN[i] * 0.35;
    mixRgb(col, damp, smoothstep(tide, 0, y) * 0.55, col);
    // The broken edge of the plaster casts a dark rim into the hole.
    const rim = loss.data[i] > 0 && loss.data[i] < 1 ? 1 - Math.abs(loss.data[i] - 0.5) * 2 : 0;
    mixRgb(col, rgb('#2e2924'), Math.max(cav.data[i] * 0.7, rim * 0.6), col);
    m.set(i, col, 1 - Math.max(cav.data[i] * 0.6, rim * 0.5), 0.86 + loss.data[i] * 0.08);
  });
  m.normal = normalMap(h, 0.02 / 4);
  return m;
}

/**
 * Weathered oak: grain running along v (the length of a post or plank),
 * annual rings bent by knots, open checks along the grain, sun-greyed.
 */
function wood(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const ring = new Field(n);
  const bend = fbmField(n, 4, 3, seed, 0.5, 0.15);
  ring.fill((u, v, i) => {
    const w = bend[i];
    const r = Math.sin((u * 26 + w * 3.5) * Math.PI * 2);
    return r * 0.5 + 0.5;
  });
  const check = new Field(n);
  const checkN = ridgeField(n, 6, 3, seed + 3, 0.08);
  const checkMask = fbmField(n, 3, 2, seed + 4);
  check.fill((u, v, i) => Math.pow(checkN[i], 40) * smoothstep(0.45, 0.65, checkMask[i]));
  const grainN = fbmField(n, 60, 3, seed + 1, 0.5, 0.1);
  h.fill((u, v, i) => ring.data[i] * 0.25 + grainN[i] * 0.35 - check.data[i] * 0.8);
  const cav = cavity(h, 2, 6);
  const grey = rgb('#7f705f');
  const brown = rgb('#5e4836');
  const dark = rgb('#3a2e24');
  const col = [0, 0, 0];
  const greyN = fbmField(n, 5, 3, seed + 6);
  const fibN = fbmField(n, 120, 2, seed + 7, 0.5, 0.05);
  eachPixel(n, (u, v, i) => {
    mixRgb(brown, grey, 0.15 + greyN[i] * 0.45, col);
    const late = smoothstep(0.6, 0.95, ring.data[i]);
    mixRgb(col, dark, late * 0.3, col);
    mixRgb(col, dark, Math.max(check.data[i] * 0.9, cav.data[i] * 0.5), col);
    const fib = 0.92 + fibN[i] * 0.16;
    col[0] *= fib; col[1] *= fib; col[2] *= fib;
    m.set(i, col, 1 - Math.max(check.data[i] * 0.7, cav.data[i] * 0.4), 0.82 + late * 0.08);
  });
  m.normal = normalMap(h, 0.004 / 1.0);
  return m;
}

/**
 * Bronze of the bucket: warm metal where handled, verdigris (non-metal,
 * rough, blue-green) in blotches and dark brown oxide, faint hammer
 * dimples from beating the sheet.
 */
function bronze(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  h.fill((u, v) => {
    voronoi(u, v, 18, seed, 0.9, c);
    return 1 - c.f1 * c.f1 * 0.6 + fbm(u, v, 40, 2, seed + 1) * 0.1;
  });
  const metal = rgb('#a77b4f');
  const oxide = rgb('#3e2c1f');
  const verd = rgb('#5d8a77');
  const verd2 = rgb('#7a9c86');
  const col = [0, 0, 0];
  eachPixel(n, (u, v, i) => {
    // Old bronze is mostly a dark warm brown; verdigris only in small soft spots.
    const pat = smoothstep(0.66, 0.78, fbm(u, v, 6, 5, seed + 2)) * 0.6;
    const ox = 0.55 + 0.35 * smoothstep(0.3, 0.7, fbm(u, v, 5, 4, seed + 3));
    mixRgb(metal, oxide, ox * 0.75, col);
    const vc = mixRgb(verd, verd2, fbm(u, v, 20, 2, seed + 4), [0, 0, 0]);
    mixRgb(col, vc, pat, col);
    const metalness = (1 - pat) * (1 - ox * 0.5);
    m.set(i, col, 1 - pat * 0.15, lerp(0.38 + ox * 0.2, 0.85, pat), metalness);
  });
  m.normal = normalMap(h, 0.0008 / 0.3);
  return m;
}

/** Wrought iron: dark, hammered, with rust blooming in patches. */
function iron(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  h.fill((u, v) => fbm(u, v, 14, 4, seed) * 0.6 + fbm(u, v, 60, 2, seed + 1) * 0.3);
  const metal = rgb('#46433f');
  const rust = rgb('#6a4430');
  const rust2 = rgb('#4e3426');
  const col = [0, 0, 0];
  eachPixel(n, (u, v, i) => {
    const r = smoothstep(0.55, 0.75, fbm(u, v, 6, 5, seed + 2)) * 0.8;
    mixRgb(metal, mixRgb(rust2, rust, fbm(u, v, 30, 2, seed + 3), [0, 0, 0]), r, col);
    m.set(i, col, 1, lerp(0.55, 0.92, r), (1 - r) * 0.8);
  });
  m.normal = normalMap(h, 0.0015 / 0.25);
  return m;
}

/** Beaten earth: trodden brown soil with gravel, faint dry cracks and darker damp hollows. */
function earth(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const c = cell();
  const peb = new Field(n);
  const pebId = new Int32Array(n * n);
  peb.fill((u, v, i) => {
    voronoi(u, v, 70, seed + 1, 0.95, c);
    pebId[i] = c.id;
    return hash2(c.id, 1, seed) < 0.28 ? smoothstep(0.42, 0.18, c.f1 * (0.7 + hash2(c.id, 2, seed) * 0.6)) : 0;
  });
  const crack = new Field(n);
  const crackMask = fbmField(n, 4, 2, seed + 3);
  crack.fill((u, v, i) => {
    voronoi(u, v, 9, seed + 2, 0.8, c);
    return smoothstep(0.03, 0.0, c.edge) * smoothstep(0.5, 0.65, crackMask[i]);
  });
  const ground = fbmField(n, 6, 5, seed);
  h.fill((u, v, i) => ground[i] * 0.5 + peb.data[i] * 0.45 - crack.data[i] * 0.3);
  const cav = cavity(h, 3, 4);
  const soil = rgb('#7a6142');
  const dry = rgb('#98805a');
  const dampC = rgb('#5a4630');
  const stones = [rgb('#8d8577'), rgb('#a39079'), rgb('#6b655c'), rgb('#b0a38c')];
  const col = [0, 0, 0];
  const dryN = fbmField(n, 4, 4, seed + 4);
  const dampN = fbmField(n, 3, 3, seed + 5);
  eachPixel(n, (u, v, i) => {
    mixRgb(soil, dry, smoothstep(0.4, 0.7, dryN[i]), col);
    mixRgb(col, dampC, smoothstep(0.55, 0.75, dampN[i]) * 0.5, col);
    if (peb.data[i] > 0) mixRgb(col, stones[Math.floor(hash2(pebId[i], 3, seed) * 4)], peb.data[i], col);
    mixRgb(col, rgb('#3e3027'), Math.max(cav.data[i] * 0.6, crack.data[i] * 0.5), col);
    m.set(i, col, 1 - cav.data[i] * 0.6, 0.93 - peb.data[i] * 0.15);
  });
  m.normal = normalMap(h, 0.01 / 2);
  return m;
}

/** Hemp rope: three twisted strands (u along the rope, v around it) and loose fibres. */
function rope(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  h.fill((u, v) => {
    const s = 0.5 + 0.5 * Math.cos((v * 3 + u * 4) * Math.PI * 2);
    return Math.pow(s, 0.6) * 0.8 + fbm(u, v, 40, 2, seed, 0.5, 4) * 0.2;
  });
  const a = rgb('#a48d64');
  const b = rgb('#7d6847');
  const col = [0, 0, 0];
  eachPixel(n, (u, v, i) => {
    mixRgb(b, a, h.data[i], col);
    m.set(i, col, 0.6 + h.data[i] * 0.4, 0.95);
  });
  m.normal = normalMap(h, 0.4);
  return m;
}

/** Wool: a coarse tabby weave, undyed (the material's colour dyes it). */
function wool(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  const T = 48;
  h.fill((u, v) => {
    const a = Math.sin(u * T * Math.PI * 2);
    const b = Math.sin(v * T * Math.PI * 2);
    const over = (Math.floor(u * T * 2) + Math.floor(v * T * 2)) % 2 ? a : b;
    return 0.5 + over * 0.3 + fbm(u, v, 30, 2, seed) * 0.3;
  });
  const col = [0, 0, 0];
  const base = rgb('#e6dccb');
  eachPixel(n, (u, v, i) => {
    const k = 0.85 + h.data[i] * 0.2;
    col[0] = base[0] * k; col[1] = base[1] * k; col[2] = base[2] * k;
    m.set(i, col, 0.8 + h.data[i] * 0.2, 0.95);
  });
  m.normal = normalMap(h, 0.004);
  return m;
}

/** Ripples for water: only a normal map (the water's colour is the sky it reflects and the dark below). */
function ripples(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  h.fill((u, v) => fbm(u, v, 4, 5, seed, 0.55) * 0.7 + fbm(u, v, 14, 3, seed + 1) * 0.3);
  eachPixel(n, (u, v, i) => m.set(i, [1, 1, 1], 1, 0.05));
  m.normal = normalMap(h, 0.03);
  return m;
}

/** Terracotta (roof tiles, amphorae): fired clay, orange to brown in patches, soot and lichen in the hollows. */
function terracotta(n, seed) {
  const m = new MapSet(n);
  const h = new Field(n);
  h.fill((u, v) => fbm(u, v, 10, 4, seed) * 0.5 + fbm(u, v, 50, 2, seed + 1) * 0.3);
  const cav = cavity(h, 3, 5);
  const a = rgb('#b4653f');
  const b = rgb('#93533a');
  const pale = rgb('#c98a62');
  const soot = rgb('#4a3a30');
  const lichen = rgb('#8f8f6a');
  const col = [0, 0, 0];
  eachPixel(n, (u, v, i) => {
    mixRgb(a, b, smoothstep(0.35, 0.7, fbm(u, v, 4, 4, seed + 2)), col);
    mixRgb(col, pale, smoothstep(0.6, 0.8, fbm(u, v, 6, 3, seed + 3)) * 0.3, col);
    mixRgb(col, lichen, smoothstep(0.72, 0.8, fbm(u, v, 12, 3, seed + 4)) * 0.35, col);
    mixRgb(col, soot, cav.data[i] * 0.6, col);
    m.set(i, col, 1 - cav.data[i] * 0.5, 0.8);
  });
  m.normal = normalMap(h, 0.003 / 0.6);
  return m;
}

/**
 * Every surface: how much of the world one repeat covers (metres), the
 * texture size, its recipe, and whether it keeps its height field (`height`:
 * the paving's mesh is displaced by it).
 */
export const SURFACES = Object.freeze({
  limestone: { metres: 0.8, size: 512, make: limestone },
  travertine: { metres: 1.0, size: 512, make: travertine },
  basalt: { metres: 4.8, size: 1024, make: basalt, height: true },
  tufa: { metres: 1.0, size: 256, make: tufa },
  cocciopesto: { metres: 2.0, size: 512, make: cocciopesto },
  plaster: { metres: 4.0, size: 1024, make: plaster },
  wood: { metres: 1.0, size: 512, make: wood },
  bronze: { metres: 0.3, size: 256, make: bronze },
  iron: { metres: 0.25, size: 128, make: iron },
  earth: { metres: 2.0, size: 512, make: earth },
  rope: { metres: 0.06, size: 64, make: rope },
  wool: { metres: 0.12, size: 128, make: wool },
  ripples: { metres: 1.2, size: 256, make: ripples },
  terracotta: { metres: 0.6, size: 256, make: terracotta },
});

/**
 * A surface's texture size at `scale` (0.125 in the tests: the pattern is
 * the same, only less sharp), never under 32 px.
 */
export function surfaceSize(name, scale = 1) {
  const s = SURFACES[name];
  if (!s) throw new Error(`Unknown surface: ${name}`);
  return Math.max(32, Math.round(s.size * scale));
}

/** The seed a surface is painted with: a hash of its name. */
function nameSeed(name) {
  let k = 0;
  for (let i = 0; i < name.length; i++) k = (k * 31 + name.charCodeAt(i)) | 0;
  return k;
}

/** Make a surface's maps, `size` px square, seeded by its name unless a seed is given. */
export function makeSurfaceAt(name, size, seed = nameSeed(name)) {
  const s = SURFACES[name];
  if (!s) throw new Error(`Unknown surface: ${name}`);
  const maps = s.make(size, seed);
  maps.metres = s.metres;
  return maps;
}

/** Make a surface's maps at `scale` of its size (seeded by its name unless a seed is given). */
export function makeSurface(name, seed, scale = 1) {
  return makeSurfaceAt(name, surfaceSize(name, scale), seed === undefined ? nameSeed(name) : seed);
}

