/**
 * models/arvum.js
 * ----------------------------------------------------------------------------
 * A native village's plot of the 3D look (Arvum, 1 x 1: a tile of 4 m), from
 * the record. The hill peoples' fields were small and won from stony slopes:
 * the castellari's terraces held up by walls of dry stone, the stones picked
 * off the soil heaped at a corner; the crops the seeds and grains found in
 * their hut floors: emmer and spelt (the hulled wheats), barley, millet
 * (panic and broomcorn: Strabo's Ligurians eat it), and the field bean.
 *
 *   ligurian  a terrace's dry stone wall along the plot's downhill edge, the
 *             cleared stones heaped in a corner
 *   native    a wattle hurdle along two sides against the beasts
 *
 * The crop by the plot (a village grows them side by side), its growth by
 * the month (the sim does not grow the villages' crops: this is the look of
 * the year in the hills, not a harvest), its stage one of:
 *   bare     tilled earth (the ground's own soil under it), a few clods
 *   shoot    the first green in rows
 *   green    a hand high and more, filling the rows
 *   tall     in ear (or the beans in flower), still green
 *   ripe     gold (the hulled wheats a little red, barley pale with its long
 *            awns, millet's heads drooping, the beans' pods black)
 *   stubble  cut: the stalks' stubble, the sheaves stood up to dry
 * The plants sway in the wind (their material bends them by height).
 *
 * Metres, the tile's middle at the origin, y up; the rows along x. Levels of
 * detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry, Matrix4, Vector3 } from 'three';
import { boxUV, tintGeometry, merge } from '../shapes.js';
import { artRng } from '../texgen.js';
import { material, LOOK_KIND } from '../materials.js';
import { TaggedParts } from './masonry.js';
import { blk, wattleFence, lin, mixc } from './rural.js';
import { villageMaterials, gridGeo } from './villageKit.js';

const TAU = Math.PI * 2;

/** The crops a plot may grow, by people. */
export const CROPS = Object.freeze({
  ligurian: Object.freeze(['spelt', 'barley', 'millet', 'beans']),
  native: Object.freeze(['spelt', 'barley', 'millet', 'beans']),
});

/** The stages of a plot's year (see the header). */
export const STAGES = Object.freeze(['bare', 'shoot', 'green', 'tall', 'ripe', 'stubble']);

/**
 * Each crop's stage by month (0 Ianuarius): the hulled wheats and barley sown
 * in autumn and cut in early summer, millet sown in spring and cut in late
 * summer, beans sown in late winter and pulled in June.
 */
const CALENDAR = Object.freeze({
  spelt: ['shoot', 'shoot', 'green', 'green', 'tall', 'ripe', 'stubble', 'stubble', 'bare', 'bare', 'shoot', 'shoot'],
  barley: ['shoot', 'shoot', 'green', 'green', 'tall', 'ripe', 'stubble', 'bare', 'bare', 'bare', 'shoot', 'shoot'],
  millet: ['bare', 'bare', 'bare', 'shoot', 'green', 'green', 'tall', 'ripe', 'stubble', 'bare', 'bare', 'bare'],
  beans: ['bare', 'shoot', 'green', 'green', 'tall', 'ripe', 'stubble', 'bare', 'bare', 'bare', 'bare', 'bare'],
});

/** A crop's stage in a month (null: the seasons not shown, a summer's green). */
export function cropStage(crop, month) {
  if (month === null || month === undefined) return 'green';
  return CALENDAR[crop][((Math.round(month) % 12) + 12) % 12];
}

/** The plants' material: their colours in the vertices, bending with the wind by height (as wood bends). */
function cropMaterial() {
  return material('village-crop', { roughness: 0.78, snow: 0.75, wet: 0.6, sway: 0.06, swayH: 1.0, kind: LOOK_KIND.WOOD });
}

/** Colours (linear) of a crop's plants at a stage: [leaf, ear]. */
function colours(crop, stage) {
  const G = lin(0x58772f);
  const g2 = lin(0x6f8a3a);
  switch (stage) {
    case 'shoot': return [lin(0x7d9a3e), lin(0x7d9a3e)];
    case 'green': return [G, g2];
    case 'tall': return crop === 'beans' ? [lin(0x4e6a2c), lin(0xe8e4dc)] : [mixc(G, lin(0x9aa44a), 0.35), lin(0x8fa04a)];
    case 'ripe':
      if (crop === 'beans') return [lin(0x6a6236), lin(0x2a2420)];
      if (crop === 'millet') return [lin(0xa08a48), lin(0xc0a050)];
      if (crop === 'barley') return [lin(0xbaa264), lin(0xc4a868)];
      return [lin(0xb89650), lin(0xb87a3e)];
    default: return [lin(0xb8a060), lin(0xc8b070)];
  }
}

/** A blade (a long thin triangle, both faces) from (x, 0, z) up to `h`, leaning `lean` toward angle `a`. */
function blade(list, x, z, h, w, a, lean, c, rnd) {
  const tx = x + Math.sin(a) * lean;
  const tz = z + Math.cos(a) * lean;
  const px = Math.cos(a) * w;
  const pz = -Math.sin(a) * w;
  const mid = [(x + tx) / 2 + Math.sin(a) * lean * 0.15, h * 0.55, (z + tz) / 2 + Math.cos(a) * lean * 0.15];
  const pts = [[x - px, 0, z - pz], [x + px, 0, z + pz], [mid[0] + px * 0.7, mid[1], mid[2] + pz * 0.7], [mid[0] - px * 0.7, mid[1], mid[2] - pz * 0.7], [tx, h, tz]];
  const k = 0.85 + rnd() * 0.3;
  for (const face of [0, 1]) {
    const g = gridGeo(1, 1, (i, j) => {
      const p = i === 0 ? pts[j] : [pts[3 - j][0], pts[3 - j][1], pts[3 - j][2]];
      return { p, uv: [j, p[1]], c: [c[0] * k * (0.6 + 0.4 * p[1] / h), c[1] * k * (0.6 + 0.4 * p[1] / h), c[2] * k * (0.6 + 0.4 * p[1] / h)] };
    }, { flip: face === 1 });
    list.push(g);
    const tip = gridGeo(1, 1, (i, j) => {
      const p = i === 0 ? (j ? pts[2] : pts[3]) : pts[4];
      return { p, uv: [j, p[1]], c: [c[0] * k, c[1] * k, c[2] * k] };
    }, { flip: face === 0 });
    list.push(tip);
  }
}

/** An ear (or a millet's head, a bean's pod cluster) at (x, y, z): a slender spindle bent over `droop` toward angle `a`. */
function ear(list, x, y, z, len, r, a, droop, c, lod, awns = 0) {
  const g = new SphereGeometry(r, 4, lod === 0 ? 3 : 2);
  // (A spindle: the sphere drawn out along its stalk, its foot at the origin, bent over about the axis across its lean.)
  g.scale(1, len / (2 * r), 1).translate(0, len / 2, 0);
  const rot = new Matrix4().makeRotationAxis(new Vector3(Math.cos(a), 0, -Math.sin(a)), droop);
  g.applyMatrix4(rot).translate(x, y, z);
  const shade = (py) => 0.72 + 0.28 * Math.min(1, Math.max(0, (py - y) / len));
  list.push(tintGeometry(boxUV(g), (px, py) => [c[0] * shade(py), c[1] * shade(py), c[2] * shade(py)]));
  if (awns && lod === 0) {
    // The awns: on along the ear's line from its tip.
    const dir = new Vector3(0, 1, 0).applyMatrix4(rot);
    const s = new CylinderGeometry(0.0008, 0.004, awns, 3, 1).translate(0, awns / 2, 0).applyMatrix4(rot).translate(x + dir.x * len, y + dir.y * len, z + dir.z * len);
    list.push(tintGeometry(boxUV(s), () => c));
  }
}

/** The plants of a crop at a stage, rows along x, `rows` z places; returns geometries for the crop material. */
function plants(crop, stage, lod, seed, x0, x1, z0, z1) {
  const out = [];
  if (stage === 'bare') return out;
  const rnd = artRng(seed);
  const [leaf, earC] = colours(crop, stage);
  const rowGap = crop === 'beans' ? 0.42 : 0.3;
  const step = (crop === 'beans' ? 0.24 : 0.17) * (lod === 0 ? 1 : 2.2);
  const rows = Math.floor((z1 - z0) / rowGap);
  const H = { shoot: 0.12, green: crop === 'beans' ? 0.35 : 0.42, tall: crop === 'beans' ? 0.55 : crop === 'millet' ? 0.95 : 0.85, ripe: crop === 'beans' ? 0.5 : crop === 'millet' ? 0.9 : 0.82, stubble: 0.1 }[stage];
  if (lod === 2) {
    // Far out: each row a low hedge of the crop's colour (two quads either way), the stubble a pale band.
    for (let r = 0; r < rows; r++) {
      const z = z0 + rowGap * (r + 0.5);
      for (const face of [0, 1]) {
        out.push(gridGeo(1, 1, (i, j) => ({ p: [x0 + (x1 - x0) * j, H * i, z + (i ? 0 : (face ? 0.06 : -0.06))], uv: [j, i], c: i ? earC : leaf }), { flip: face === 1 }));
      }
    }
    return out;
  }
  for (let r = 0; r < rows; r++) {
    const z = z0 + rowGap * (r + 0.5);
    for (let x = x0 + step * 0.5; x < x1; x += step) {
      const px = x + (rnd() - 0.5) * step * 0.5;
      const pz = z + (rnd() - 0.5) * 0.06;
      const h = H * (0.8 + rnd() * 0.35);
      if (stage === 'stubble') {
        // Cut stalks: a few stiff short stems, pale.
        for (let k = 0; k < (lod === 0 ? 3 : 2); k++) blade(out, px + (rnd() - 0.5) * 0.05, pz + (rnd() - 0.5) * 0.05, h, 0.005, rnd() * TAU, 0.01, earC, rnd);
        continue;
      }
      if (crop === 'beans') {
        // A bean plant: a stem and leaves in pairs up it; flowers, or the black pods when ripe.
        const n = stage === 'shoot' ? 2 : lod === 0 ? 5 : 3;
        for (let k = 0; k < n; k++) blade(out, px, pz, h * (0.55 + 0.45 * (k / n)), 0.035, rnd() * TAU, 0.12 + rnd() * 0.08, leaf, rnd);
        if (stage === 'tall' || stage === 'ripe') {
          for (let k = 0; k < (lod === 0 ? 3 : 1); k++) ear(out, px + (rnd() - 0.5) * 0.08, h * (0.35 + rnd() * 0.4), pz + (rnd() - 0.5) * 0.08, stage === 'ripe' ? 0.09 : 0.03, stage === 'ripe' ? 0.012 : 0.015, rnd() * TAU, 0.6, earC, lod);
        }
        continue;
      }
      // Grain: a tuft of blades leaning out; in ear, stalks with their ears (barley's awns long).
      const inEar = stage === 'tall' || stage === 'ripe';
      const n = stage === 'shoot' ? 3 : lod === 0 ? (inEar ? 2 : 5) : 2;
      for (let k = 0; k < n; k++) {
        const a = rnd() * TAU;
        blade(out, px, pz, h * (stage === 'tall' || stage === 'ripe' ? 0.6 : 1) * (0.7 + rnd() * 0.3), crop === 'millet' ? 0.018 : 0.009, a, (stage === 'shoot' ? 0.03 : 0.1) + rnd() * 0.06, leaf, rnd);
      }
      if (stage === 'tall' || stage === 'ripe') {
        const stalks = lod === 0 ? 3 : 1;
        for (let k = 0; k < stalks; k++) {
          const a = rnd() * TAU;
          const lean = 0.04 + rnd() * 0.05;
          const sx = px + Math.sin(a) * lean;
          const sz = pz + Math.cos(a) * lean;
          blade(out, px, pz, h, 0.004, a, lean, mixc(leaf, earC, 0.5), rnd);
          const droop = crop === 'millet' ? 1.6 : stage === 'ripe' ? (crop === 'barley' ? 0.9 : 0.45) : 0.15;
          ear(out, sx, h - 0.02, sz, crop === 'millet' ? 0.13 : 0.08, crop === 'millet' ? 0.022 : 0.0105, a, droop, earC, lod, crop === 'barley' ? 0.09 : crop === 'spelt' ? 0.03 : 0);
        }
      }
    }
  }
  return out;
}

/** Sheaves stood up to dry in the stubble: bundles bound at the waist, the ears splayed at the top. */
function sheaves(out, crop, lod, seed) {
  const rnd = artRng(seed + 3);
  const [, earC] = colours(crop, 'ripe');
  const n = lod === 2 ? 2 : 4;
  for (let k = 0; k < n; k++) {
    const x = -1.2 + k * 0.8 + (rnd() - 0.5) * 0.2;
    const z = -0.6 + (k % 2) * 0.9 + (rnd() - 0.5) * 0.2;
    const g = new CylinderGeometry(0.14, 0.1, 0.62, lod === 0 ? 10 : 6, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      // Pinched at the band a third of the way down.
      const pinch = 1 - 0.35 * Math.exp(-((y - 0.08) ** 2) / 0.006);
      p.setXYZ(i, p.getX(i) * pinch, y, p.getZ(i) * pinch);
    }
    g.computeVertexNormals();
    g.rotateZ((rnd() - 0.5) * 0.2).translate(x, 0.31, z);
    out.thatch.push(tintGeometry(boxUV(g), () => [earC[0] * 2.2, earC[1] * 2.2, earC[2] * 2.2]));
  }
}

/**
 * The plot's edging: a terrace's dry stone wall along its front (+z) and the
 * cleared stones heaped in a corner (the Ligurians'), or hurdles along two
 * sides (the generic people's); the row ridges of the tilled soil.
 */
function edging(out, people, lod, seed) {
  const rnd = artRng(seed);
  if (people === 'ligurian') {
    // The terrace's wall: its face along the front edge, its top level with the plot.
    out.drystone.push(boxUV(blk(1, 3.92, 0.42, 0.34, { bevel: 0.04, seed, wobble: 0.025, grime: 0.4 }).translate(0, -0.06, 1.8)));
    if (lod === 0) {
      const n = 11;
      for (let k = 0; k < n; k++) {
        const g = blk(1, 0.3 + rnd() * 0.08, 0.1, 0.3, { seed: seed + k, wobble: 0.02, grime: 0.15 });
        g.rotateZ((rnd() - 0.5) * 0.1).rotateY((rnd() - 0.5) * 0.15).translate(-1.78 + (3.56 * k) / (n - 1), 0.32, 1.8);
        out.drystone.push(g);
      }
    }
    // The heap of stones picked off the soil, in the back corner.
    const heapN = lod === 2 ? 3 : lod === 1 ? 7 : 14;
    for (let k = 0; k < heapN; k++) {
      const a = rnd() * TAU;
      const d = Math.sqrt(rnd()) * 0.35;
      const s = 0.12 + rnd() * 0.1;
      const g = blk(lod === 0 ? 0 : 1, s * 1.3, s, s, { bevel: 0.03, seed: seed + 40 + k, wobble: 0.02, grime: 0.3 });
      g.rotateY(rnd() * 3).translate(-1.42 + Math.sin(a) * d, (1 - d / 0.35) * 0.18 * (k > heapN / 2 ? 1 : 0), -1.42 + Math.cos(a) * d);
      out.drystone.push(g);
    }
  } else {
    const f = wattleFence([[-1.9, 1.85], [-1.9, -1.9], [1.9, -1.9]], { h: 0.8, seed, lod });
    out.wicker.push(...f.wicker);
    out.wood.push(...f.wood);
  }
  // The row ridges (the full and middle levels): low banks of earth the rows grow on.
  if (lod < 2) {
    const rows = 11;
    for (let r = 0; r < rows; r++) {
      const z = -1.65 + 0.3 * (r + 0.5);
      // (Across the ridge: its foot behind, its crest, its foot ahead; a little wavy along it.)
      const n = lod === 0 ? 8 : 3;
      const ph = rnd() * TAU;
      out.earth.push(gridGeo(2, n, (i, j) => {
        const x = -1.7 + (3.4 * j) / n;
        const crest = 0.05 + (lod === 0 ? 0.01 * Math.sin(x * 5 + ph) : 0);
        return { p: [x, i === 1 ? crest : 0.004, z + (i - 1) * 0.13], uv: [x, z + (i - 1) * 0.13], c: i === 1 ? 0.85 : 0.6 };
      }, { flip: true }));
    }
  }
}

/**
 * Build a plot: `people`, `crop` (CROPS), `stage` (STAGES). Returns { group,
 * meshes, triangles }.
 */
export function buildPlot(people, crop, stage, { lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = { drystone: [], wicker: [], wood: [], earth: [], crop: [], thatch: [] };
  const seed = 1500 + CROPS[people].indexOf(crop) * 13 + STAGES.indexOf(stage) * 3 + (people === 'ligurian' ? 0 : 400);
  edging(out, people, lod, seed);
  out.crop.push(...plants(crop, stage, lod, seed + 7, -1.7, 1.7, -1.65, 1.6));
  if (stage === 'stubble') sheaves(out, crop, lod, seed);
  const m = villageMaterials();
  const p = new TaggedParts(`arvum-${people}-${crop}-${stage}`);
  p.add('drystone', m.drystone, out.drystone);
  p.add('wicker', m.wicker, out.wicker);
  p.add('wood', m.wood, out.wood);
  p.add('earth', m.earth, out.earth, { cast: false });
  if (out.crop.length) p.add('crop', cropMaterial(), [merge(out.crop)], { cast: lod < 2 });
  p.add('sheaves', m.thatch, out.thatch);
  return p.build();
}
