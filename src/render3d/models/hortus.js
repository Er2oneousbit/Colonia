/**
 * models/hortus.js
 * ----------------------------------------------------------------------------
 * The garden of the 3D look: a viridarium on one tile (4 m), designed from
 * the gardens of Pompeii and Herculaneum as Wilhelmina Jashemski excavated
 * them (the root cavities filled with plaster, the pollen, the paintings of
 * gardens on their walls) and the writers (Pliny the Younger's letters on
 * his Tuscan villa's box and roses, Pliny the Elder on the Campanian rose),
 * not from the sprite:
 *
 *   - Beds edged with clipped box (Buxus), gravel walks between them, the
 *     beds' edges set with tiles on edge as Pompeii's were.
 *   - Roses (Rosa gallica, the twelve-petalled rose of Campania), myrtle,
 *     laurel, oleander, acanthus at the foot of things, Madonna lilies,
 *     violets; a vine on a pergola, hung with oscilla (marble discs that
 *     turned in the wind, carved with masks).
 *   - At the middle a marble basin on its foot (labrum), a sundial, or a
 *     pool with a winged boy (Eros) on a column.
 *
 * A plot is one of four designs (DESIGNS), turned by its tile (models/
 * decor.js), so a row of gardens is no pattern; all four share the cross
 * of walks to the middle of each side, so gardens side by side join: the
 * box hedge round a plot is its own kits (`hedge`, `post`, `stub`), which
 * decor.js leaves out where another garden adjoins and runs on across the
 * tile's edge where the run goes on into the next garden.
 *
 * The month's season (SEASONS): winter (the vine bare, the roses pruned
 * back to canes), spring (young leaves, violets), May and June (the roses
 * out, the lilies, the myrtle's white flowers), high summer (the oleanders
 * in flower, green grapes), autumn (the vintage: purple grapes, the vine's
 * leaves turning red and gold, rose hips). Untended (`worn`): the box
 * ragged and browning with shoots standing out of it, the plants leggy and
 * dry, weeds in the walks, the basin dry with leaves in it, an oscillum
 * fallen.
 *
 * The leaves are the countryside's sprays (flora/: the spray textures cut
 * out by their alpha, lit as one mass, swaying), so a garden's laurel is
 * the woods' laurel; far out (level 2) and for the build ghost they are
 * solid clumps instead (cards would draw as squares in the ghost's tint).
 *
 * Metres, the tile's middle at the origin, y up. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { Vector3, CylinderGeometry, SphereGeometry, BoxGeometry, IcosahedronGeometry, CircleGeometry, TorusGeometry } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { material, waterMaterial, iceMaterial } from '../materials.js';
import { artRng, smoothstep } from '../texgen.js';
import { slab, TaggedParts } from './masonry.js';
import { lin, weeds, ruralMaterials } from './rural.js';
import { castraMaterials } from './castra.js';
import { limb, balls } from './orchard.js';
import { cardGeometry, buildTree } from '../flora/treeModel.js';
import { foliageMaterial } from '../flora/floraMaterials.js';
import { loft, victory, ellipsoid } from './statuary.js';

/** The four designs of a plot. */
export const DESIGNS = Object.freeze(['labrum', 'pergola', 'sundial', 'pool']);
/** The garden's seasons, and the season of each month (0 = Ianuarius). */
export const SEASONS = Object.freeze(['winter', 'spring', 'bloom', 'summer', 'autumn']);
const MONTH_SEASON = ['winter', 'winter', 'spring', 'spring', 'bloom', 'bloom', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];

/** The season a garden shows in `month` (null, seasons off: high summer). */
export function gardenSeason(month) {
  if (month === null || month === undefined) return 'summer';
  return MONTH_SEASON[((Math.round(month) % 12) + 12) % 12];
}

/** The hedge's measures (metres): its outer face in from the tile's edge, thickness, height, the walk's gap. */
export const HEDGE = Object.freeze({ inset: 0.07, thick: 0.38, h: 0.56, gap: 0.42, post: 0.72 });
/** Where a side's run of hedge ends at a corner (the post's inner face). */
export const HEDGE_END = 2 - HEDGE.inset - HEDGE.thick;
/** A stub of hedge: from a little inside the run's end out to the tile's edge (its half length, its middle). */
export const STUB = Object.freeze({ half: (2 - HEDGE_END + 0.02) / 2, mid: (2 + HEDGE_END - 0.02) / 2 });
/** The walks' half width. */
const WALK = 0.35;

/** An sRGB colour for a spray: linear, lifted to undo the spray textures' own pale grey (as treeModel.js does). */
const leafLin = (hex) => lin(hex, 1.5);
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];

const PALETTE = {
  rose: [0x3d5a2a, 0x46632e, 0x355226],
  roseBloom: [0xb8243e, 0xc8385a, 0xd8627e, 0xa01c30, 0xe8889c],
  oleander: [0x4e663a, 0x587240, 0x46603a],
  oleanderBloom: [0xe87aa4, 0xf096b8, 0xd8608e, 0xf4b4c8],
  myrtle: [0x2f5228, 0x375c2e, 0x2a4824],
  white: [0xf4f0e4, 0xece6d6, 0xfaf6ec],
  acanthus: [0x2c5224, 0x355e2c, 0x28481f],
  lily: [0x5c7c3a, 0x668640],
  vine: [0x46682a, 0x4e722e, 0x3e5e26],
  vineSpring: [0x8ab04a, 0x98bc54],
  vineAutumn: [0xb84a2a, 0xc8902a, 0x9a3a24, 0xd0a03a],
  dry: [0x7a7438, 0x8a7a40, 0x6a6a34, 0x7e6a3a],
  dead: [0x7a5a34, 0x6a4c2c, 0x8a6a40],
  violet: [0x5a3a8a, 0x6a48a0],
};

// ---------------------------------------------------------------------------
// Sprays
// ---------------------------------------------------------------------------

/** Bins of geometry while a plot is built: by material key, and the sprays by `species|texture`. */
function bins() {
  return { soil: [], gravel: [], tile: [], marble: [], plaster: [], lining: [], wood: [], bark: [], bronze: [], solid: [], fruit: [], box: [], water: [], cards: new Map() };
}

/**
 * Sprays over a crown: an ellipsoid round (x, cy, z) of radius r and half
 * height hh, `n` sprays `size` long, each a colour of `palette` (sRGB),
 * shaded darker inside and toward the foot; pointing outward and up as the
 * woods' sprays do (treeModel.js card). Into out.cards under `sp|tex`.
 */
function sprays(out, { sp, tex, x, cy, z, r, hh, n, size, palette, rnd, up = 0.35, flat = 1 }) {
  const key = `${sp}|${tex}`;
  if (!out.cards.has(key)) out.cards.set(key, []);
  const list = out.cards.get(key);
  const centre = new Vector3(x, cy, z);
  for (let i = 0; i < n; i++) {
    const az = rnd() * Math.PI * 2;
    const t = rnd() * 2 - 1;
    const ring = Math.sqrt(Math.max(0, 1 - t * t));
    const f = 0.7 + rnd() * 0.35;
    const p = new Vector3(x + Math.cos(az) * r * ring * f, cy + t * hh * f * flat, z + Math.sin(az) * r * ring * f);
    const o = p.clone().sub(centre);
    o.y *= r / Math.max(0.1, hh);
    if (o.lengthSq() < 1e-6) o.set(0, 1, 0);
    o.normalize();
    const dir = o.clone().multiplyScalar(1 - up).add(new Vector3(0, up, 0)).add(new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.8)).normalize();
    let side = new Vector3(0, 1, 0).cross(dir);
    if (side.lengthSq() < 1e-4) side = new Vector3(1, 0, 0);
    side.normalize().applyAxisAngle(dir, (rnd() - 0.5) * 1.6);
    const s = size * (0.8 + rnd() * 0.4);
    p.addScaledVector(dir, -s * 0.3);
    const low = p.y + Math.min(0, dir.y * s) - Math.abs(side.y) * s * 0.5;
    if (low < 0.03) p.y += 0.03 - low;
    // Darker inside the crown and toward its foot, as a crown shades itself.
    const k = (0.55 + 0.45 * smoothstep(-1, 1, t)) * (0.8 + 0.2 * f);
    const c = leafLin(pick(rnd, palette)).map((v) => v * k);
    list.push({ p, dir, side, size: s, cell: Math.floor(rnd() * 4), out: o, c });
  }
}

/**
 * Weeds come up over x0..x1, z0..z1 (rural.js weeds: lumpy tufts, green
 * going dry), `y` over the ground, smooth at every level (a tuft of twenty
 * flat faces reads as a cut gem), dulled to the colour of a neglected
 * plot, and cut off at the ground (what is under it is never seen).
 */
export function groundWeeds(n, x0, x1, z0, z1, seed, lod, y = 0.02) {
  return weeds(n, x0, x1, z0, z1, seed, Math.max(1, lod)).map((g) => {
    g.translate(0, y, 0);
    const P = g.attributes.position;
    const C = g.attributes.color;
    for (let i = 0; i < P.count; i++) {
      if (P.getY(i) < 0) P.setY(i, 0);
      C.setXYZ(i, C.getX(i) * 0.62, C.getY(i) * 0.6, C.getZ(i) * 0.5);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** A lumpy closed clump (far out, and the ghost's): a welded icosphere pushed about, its colour by height. */
function clump(x, y, z, r, sy, colour, detail, rnd) {
  let g = new IcosahedronGeometry(r, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  const ph = [rnd() * 6, rnd() * 6];
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const vx = P.getX(i) / r;
    const vy = P.getY(i) / r;
    const vz = P.getZ(i) / r;
    const k = 1 + 0.14 * Math.sin(vx * 5 + ph[0]) * Math.sin(vz * 4 + vy * 3 + ph[1]);
    P.setXYZ(i, vx * r * k, Math.max(-0.95, vy) * r * sy * k, vz * r * k);
  }
  g.computeVertexNormals();
  boxUV(g);
  g.translate(x, y, z);
  const c = lin(colour);
  return tintGeometry(g, (px, py) => {
    const t = Math.min(1, Math.max(0, (py - y + r * sy) / (2 * r * sy)));
    return c.map((v) => v * (0.55 + 0.45 * t));
  });
}

/**
 * A shrub: sprays over its crown (close up) or a clump (far, the ghost),
 * its stems under it; flowers as blossom sprays among the leaves.
 *   leaf     { sp, tex, palette }: the spray and its colours
 *   flowers  { palette, share } or null
 */
function shrub(out, { x, z, h, r, y0 = 0, leaf, flowers = null, dens = 1, lod, rnd, plain, up = 0.35, stems = 3, share = 1 }) {
  const cy = y0 + h * 0.55;
  const hh = h * 0.45;
  if (lod === 2 || plain) {
    if (share > 0.05) out.solid.push(clump(x, cy, z, r, hh / r, leaf.palette[0], lod === 2 ? 1 : 2, rnd));
    if (flowers && lod < 2) out.solid.push(...[0, 1, 2].map((k) => clump(x + (rnd() - 0.5) * r, cy + hh * 0.6, z + (rnd() - 0.5) * r, r * 0.25, 0.6, flowers.palette[k % flowers.palette.length], 0, rnd)));
    return;
  }
  const area = 2 * Math.PI * r * hh * 2;
  const n = Math.max(4, Math.round(area * 26 * dens * (lod ? 0.4 : 1) * share));
  const size = (lod ? 0.42 : 0.3) * Math.min(1.3, Math.max(0.7, r / 0.45));
  if (share > 0) sprays(out, { ...leaf, x, cy, z, r, hh, n, size, rnd, up });
  if (flowers) sprays(out, { sp: 'myrtle', tex: 'leaf-blossom', palette: flowers.palette, x, cy: cy + hh * 0.15, z, r: r * 1.02, hh: hh * 0.9, n: Math.round(n * flowers.share), size: size * 0.75, rnd, up: 0.6 });
  if (lod === 0) {
    for (let k = 0; k < stems; k++) {
      const a = (k / stems) * Math.PI * 2 + rnd();
      out.bark.push(limb([[x, y0, z], [x + Math.cos(a) * r * 0.2, y0 + h * 0.3, z + Math.sin(a) * r * 0.2], [x + Math.cos(a) * r * 0.45, y0 + h * 0.6, z + Math.sin(a) * r * 0.45]], 0.018, 0.008, { radial: 4, segs: 3 }));
    }
  }
}

// ---------------------------------------------------------------------------
// The plants
// ---------------------------------------------------------------------------

/** A rose bush (Rosa gallica): flowering in May and June, pruned to canes in winter, hips in autumn. */
function rose(out, x, z, { season, worn, lod, rnd, plain, h = 0.85 }) {
  const leaf = { sp: 'myrtle', tex: 'leaf-ovate', palette: worn ? PALETTE.dry : PALETTE.rose };
  if (season === 'winter') {
    // Pruned back: a stool of canes, reddish.
    if (lod === 2 || plain) {
      out.solid.push(clump(x, 0.25, z, 0.22, 0.9, 0x5a3a2a, 0, rnd));
      return;
    }
    for (let k = 0; k < (lod ? 4 : 9); k++) {
      const a = rnd() * Math.PI * 2;
      const hh = 0.35 + rnd() * 0.35 + (worn ? 0.4 : 0);
      out.bark.push(limb([[x, 0, z], [x + Math.cos(a) * 0.08, hh * 0.5, z + Math.sin(a) * 0.08], [x + Math.cos(a) * 0.18, hh, z + Math.sin(a) * 0.18]], 0.012, 0.006, { radial: 4, segs: 3 }));
    }
    return;
  }
  const bloom = season === 'bloom' ? { palette: PALETTE.roseBloom, share: worn ? 0.12 : 0.55 } : season === 'summer' && !worn ? { palette: PALETTE.roseBloom, share: 0.1 } : null;
  const hgt = worn ? h * 1.35 : h;
  shrub(out, { x, z, h: hgt, r: worn ? 0.5 : 0.42, leaf, flowers: bloom, lod, rnd, plain, share: season === 'spring' ? 0.7 : worn ? 0.6 : 1 });
  if (season === 'autumn' && lod < 2 && !plain) {
    out.fruit.push(balls(Array.from({ length: lod ? 5 : 12 }, () => ({ p: [x + (rnd() - 0.5) * 0.6, hgt * (0.5 + rnd() * 0.45), z + (rnd() - 0.5) * 0.6], r: 0.02, c: lin(0xb02a1a) })), lod ? 0 : 1));
  }
}

/** Oleander (Nerium oleander), the pink-flowered shrub of Pompeii's gardens: in flower through high summer. */
function oleander(out, x, z, { season, worn, lod, rnd, plain }) {
  const fl = !worn && (season === 'summer' || season === 'bloom') ? { palette: PALETTE.oleanderBloom, share: season === 'summer' ? 0.5 : 0.18 } : null;
  shrub(out, { x, z, h: 1.9, r: 0.6, leaf: { sp: 'olive', tex: 'leaf-lance', palette: worn ? PALETTE.dry : PALETTE.oleander }, flowers: fl, lod, rnd, plain, up: 0.55, stems: 5, share: worn ? 0.65 : 1 });
}

/** Myrtle (Myrtus communis), Venus's shrub, clipped round: white flowers in June and July. */
function myrtle(out, x, z, { season, worn, lod, rnd, plain, h = 1.1 }) {
  const fl = !worn && (season === 'bloom' || season === 'summer') ? { palette: PALETTE.white, share: 0.2 } : null;
  shrub(out, { x, z, h: worn ? h * 1.25 : h, r: worn ? 0.55 : 0.46, leaf: { sp: 'myrtle', tex: 'leaf-ovate', palette: worn ? PALETTE.dry : PALETTE.myrtle }, flowers: fl, lod, rnd, plain, dens: 1.3 });
}

/** Acanthus (Acanthus mollis): a rosette of big lobed leaves on the ground, its spikes of flowers in early summer. */
function acanthus(out, x, z, { season, worn, lod, rnd, plain }) {
  if (lod === 2 || plain) {
    out.solid.push(clump(x, 0.12, z, 0.4, 0.45, worn ? 0x6a6a34 : 0x2c5224, 1, rnd));
    return;
  }
  const key = 'oak|leaf-lobed';
  if (!out.cards.has(key)) out.cards.set(key, []);
  const list = out.cards.get(key);
  const n = lod ? 7 : 14;
  const pal = worn ? PALETTE.dry : PALETTE.acanthus;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const dir = new Vector3(Math.cos(a), 0.45 + rnd() * 0.5, Math.sin(a)).normalize();
    const side = new Vector3(-Math.sin(a), 0, Math.cos(a));
    const s = 0.42 + rnd() * 0.18;
    list.push({ p: new Vector3(x + Math.cos(a) * 0.05, 0.03, z + Math.sin(a) * 0.05), dir, side, size: s, width: s * 0.8, cell: Math.floor(rnd() * 4), out: new Vector3(Math.cos(a) * 0.4, 0.9, Math.sin(a) * 0.4).normalize(), c: leafLin(pick(rnd, pal)).map((v) => v * (0.7 + rnd() * 0.3)) });
  }
  // The flower spikes: tall stems hooded mauve and white, in May and June.
  if (season === 'bloom' && !worn) {
    for (let k = 0; k < (lod ? 2 : 3); k++) {
      const sx = x + (rnd() - 0.5) * 0.2;
      const sz = z + (rnd() - 0.5) * 0.2;
      const hgt = 0.9 + rnd() * 0.3;
      out.bark.push(tintGeometry(boxUV(new CylinderGeometry(0.012, 0.016, hgt, 4, 1).translate(sx, hgt / 2, sz)), () => lin(0x6a7a40)));
      out.fruit.push(tintGeometry(boxUV(new CylinderGeometry(0.02, 0.05, hgt * 0.45, lod ? 5 : 7, 1).translate(sx, hgt * 0.78, sz)), (px, py) => lin((Math.floor(py * 40) & 1) ? 0xc0a8c8 : 0xece6ea)));
    }
  }
}

/** Madonna lilies (Lilium candidum): leafy stems, white trumpets at the top in June; dry stalks after. */
function lilies(out, x, z, { season, worn, lod, rnd, plain }) {
  if (season === 'winter') {
    out.solid.push(clump(x, 0.04, z, 0.18, 0.4, worn ? 0x6a6a34 : 0x4c6e30, 0, rnd));
    return;
  }
  const n = lod === 2 ? 2 : lod ? 3 : 6;
  for (let k = 0; k < n; k++) {
    const sx = x + (rnd() - 0.5) * 0.4;
    const sz = z + (rnd() - 0.5) * 0.4;
    const hgt = season === 'spring' ? 0.5 + rnd() * 0.2 : 0.95 + rnd() * 0.3;
    const dry = worn || season === 'autumn';
    out.bark.push(tintGeometry(boxUV(new CylinderGeometry(0.008, 0.012, hgt, 4, 1).translate(sx, hgt / 2, sz)), () => lin(dry ? 0x8a7a48 : 0x5a7a34)));
    if (lod < 2 && !plain) sprays(out, { sp: 'olive', tex: 'leaf-lance', palette: dry ? PALETTE.dry : PALETTE.lily, x: sx, cy: hgt * 0.45, z: sz, r: 0.1, hh: hgt * 0.4, n: lod ? 3 : 6, size: 0.18, rnd, up: 0.7 });
    if (season === 'bloom' && !worn) {
      for (let f = 0; f < (lod ? 1 : 3); f++) {
        const a = rnd() * 6.28;
        const tr = new CylinderGeometry(0.026, 0.005, 0.085, lod ? 5 : 7, 1, true);
        tr.rotateZ(1.1);
        tr.rotateY(a);
        tr.translate(sx + Math.cos(a) * 0.04, hgt - 0.03, sz + Math.sin(a) * 0.04);
        out.fruit.push(tintGeometry(boxUV(tr), () => lin(0xf6f2e6)));
      }
    }
  }
}

/** A border of violets or low herbs along a bed: low clumps, purple flowers in spring. */
function violets(out, x0, x1, z, { season, worn, lod, rnd }) {
  if (lod === 2) return;
  const n = Math.round((x1 - x0) / (lod ? 0.4 : 0.22));
  for (let k = 0; k < n; k++) {
    const x = x0 + ((k + 0.5) / n) * (x1 - x0);
    out.solid.push(clump(x, 0.05, z + (rnd() - 0.5) * 0.06, 0.09, 0.6, worn ? 0x7a7438 : 0x3a5a2a, 0, rnd));
    if (season === 'spring' && !worn && lod === 0) out.fruit.push(balls([{ p: [x, 0.11, z], r: 0.025, c: lin(pick(rnd, PALETTE.violet)) }], 0));
  }
}

/** A clipped box ball (topiary) on the ground at (x, z), radius r. */
function boxBall(out, x, z, r, { worn, lod, rnd }) {
  const g = new SphereGeometry(r, lod === 2 ? 8 : lod ? 12 : 18, lod === 2 ? 6 : lod ? 9 : 13);
  const P = g.attributes.position;
  const ph = rnd() * 6;
  for (let i = 0; i < P.count; i++) {
    const k = worn ? 1 + 0.18 * Math.sin(P.getX(i) * 25 + ph) * Math.sin(P.getY(i) * 21 + P.getZ(i) * 17) : 1;
    P.setXYZ(i, P.getX(i) * k, Math.max(-r * 0.6, P.getY(i)) * k, P.getZ(i) * k);
  }
  g.computeVertexNormals();
  g.translate(x, r * 0.85, z);
  out.box.push(tintGeometry(boxUV(g), (px, py) => {
    const k = 0.7 + 0.3 * Math.min(1, py / (2 * r));
    return worn ? [1.1 * k, 0.9 * k, 0.55 * k] : k;
  }));
}

// ---------------------------------------------------------------------------
// The hedge
// ---------------------------------------------------------------------------

/**
 * A run of clipped box from x0 to x1 along x on the +z side (its outer face
 * at z = 2 - inset), ends `round0` / `round1` clipped round (at the walk's
 * gap) or square (against a post or the next run); `worn`: ragged and
 * browning, shoots standing out of its top. Its waves are of x, so two runs
 * that meet at a tile's edge meet in the same section.
 */
function hedgeRun(x0, x1, { worn, lod, round0 = false, round1 = false, height = HEDGE.h }) {
  const z1 = 2 - HEDGE.inset;
  const zc = z1 - HEDGE.thick / 2;
  const len = x1 - x0;
  const n = Math.max(2, Math.round(len / (lod === 2 ? 1 : lod ? 0.3 : 0.1)));
  const rings = [];
  for (let k = 0; k <= n; k++) {
    const x = x0 + (k / n) * len;
    // A clipped end: drawn in over its last 12 cm.
    const e0 = round0 ? smoothstep(0, 0.14, x - x0) : 1;
    const e1 = round1 ? smoothstep(0, 0.14, x1 - x) : 1;
    const e = Math.max(0.35, Math.min(e0, e1));
    rings.push([x, zc, height / 2, (HEDGE.thick / 2) * (0.75 + 0.25 * e), (height / 2) * (0.8 + 0.2 * e)]);
  }
  // (Along x: a loft along z, built with z for x and turned.)
  const g = loft(rings.map(([x, zz, yy, rz, ry]) => [x, zz, yy, rz, ry]), {
    axis: 'z', seg: lod === 2 ? 6 : lod ? 12 : 20, caps: true,
    deform: (p, th) => {
      // Clipped square: the ellipse pushed out toward its box, the foot flat on the ground.
      const s = Math.sin(th);
      const c = Math.cos(th);
      const k = 1 / Math.max(Math.abs(s), Math.abs(c)) ** 0.85;
      p.x = zc + (p.x - zc) * Math.min(1.35, k);
      p.y = height / 2 + (p.y - height / 2) * Math.min(1.35, k);
      const along = p.z;
      if (worn && lod < 2) {
        // Ragged: lumps and dips in the clipped faces, the top uneven.
        const w = 0.05 * Math.sin(along * 7.3 + p.y * 9) * Math.sin(along * 3.1 + 1.7) + 0.03 * Math.sin(along * 17 + p.x * 11);
        p.x += Math.sign(s) * w * Math.abs(s);
        p.y += (c > 0 ? 1 : 0.3) * w * 1.6 * Math.abs(c);
      } else if (lod === 0) {
        p.x += 0.008 * Math.sin(along * 13 + th * 3) * s;
        p.y += 0.008 * Math.sin(along * 11 + th * 2) * Math.max(0, c);
      }
      p.y = Math.max(0, p.y);
    },
    tint: (p) => {
      const t = Math.min(1, p.y / height);
      const base = 0.62 + 0.38 * t;
      if (!worn) return base;
      // Browning in patches, worst at the foot.
      const brown = smoothstep(0.2, 0.7, 0.5 + 0.5 * Math.sin(p.z * 2.3 + 1) * Math.sin(p.z * 5.1));
      return [base * (1.0 + 0.35 * brown), base * (0.92 - 0.1 * brown), base * (0.55 - 0.15 * brown)];
    },
  });
  // Built with x along the loft's z: turn it so the run lies along x (z -> x), on the +z side.
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const ax = P.getZ(i);
    const az = P.getX(i);
    P.setXYZ(i, ax, P.getY(i), az);
  }
  // (Swapping x and z mirrors it: its faces wind the other way round.)
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  g.computeVertexNormals();
  boxUV(g);
  const out = [g];
  if (worn && lod < 2) {
    // Shoots standing out of the top, unclipped.
    const rnd = artRng(Math.round(x0 * 100) + 7);
    for (let k = 0; k < Math.round(len * (lod ? 2 : 5)); k++) {
      const x = x0 + rnd() * len;
      const y = height + 0.02;
      out.push(limb([[x, y - 0.05, zc + (rnd() - 0.5) * 0.2], [x + (rnd() - 0.5) * 0.1, y + 0.1 + rnd() * 0.12, zc + (rnd() - 0.5) * 0.3]], 0.03, 0.012, { radial: 4, segs: 2 }));
    }
  }
  // Inside its own length and its tile: a ragged face's lumps and its shoots stop at the run's ends
  // (a stub's at the tile's edge, where the next garden's begins).
  for (const q of out) {
    const P = q.attributes.position;
    for (let i = 0; i < P.count; i++) {
      P.setX(i, Math.max(x0, Math.min(x1, P.getX(i))));
      P.setZ(i, Math.min(1.998, P.getZ(i)));
    }
  }
  return out;
}

/** The corner post: a taller clipped block where two runs meet, a ball of box on it (tended). */
function hedgePost({ worn, lod }) {
  const c = 2 - HEDGE.inset - HEDGE.thick / 2;
  const t = HEDGE.thick + 0.04;
  const g = slab(t, HEDGE.post, t, { bevel: 0.06, seed: 3, wobble: worn ? 0.04 : 0.008, tone: 0, grime: 0 });
  g.translate(c, 0, c);
  const out = [tintGeometry(boxUV(g), (px, py) => (worn ? [1.1 * (0.65 + 0.35 * py / HEDGE.post), 0.9 * (0.65 + 0.35 * py / HEDGE.post), 0.55] : 0.65 + 0.35 * Math.min(1, py / HEDGE.post)))];
  if (!worn && lod < 2) {
    const ball = new SphereGeometry(0.17, lod ? 10 : 16, lod ? 8 : 12);
    ball.translate(c, HEDGE.post + 0.14, c);
    out.push(tintGeometry(boxUV(ball), (px, py) => 0.8 + 0.2 * smoothstep(HEDGE.post, HEDGE.post + 0.3, py)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// The plot
// ---------------------------------------------------------------------------

/** The ground of a plot: loam over the tile, the cross of gravel walks, the beds' tile edging. */
function ground(out, { worn, lod, rnd }) {
  out.soil.push(slab(3.98, 0.035, 3.98, { bevel: 0.01, seed: 2, wobble: 0, tone: 0, grime: 0 }));
  for (const along of ['x', 'z']) {
    const g = slab(along === 'x' ? 4 : 2 * WALK, 0.048, along === 'x' ? 2 * WALK : 4, { bevel: 0.01, seed: 4, wobble: 0, tone: 0, grime: 0 });
    out.gravel.push(along === 'x' ? g : g.translate(0, -0.001, 0));
  }
  if (lod === 0 && !worn) {
    // Tiles on edge along each bed's edge on the walks.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        out.tile.push(tintGeometry(boxUV(new BoxGeometry(1.12, 0.07, 0.03).translate(sx * (WALK + 0.58), 0.035, sz * (WALK + 0.015))), () => 0.85 + rnd() * 0.15));
        out.tile.push(tintGeometry(boxUV(new BoxGeometry(0.03, 0.07, 1.12).translate(sx * (WALK + 0.015), 0.035, sz * (WALK + 0.58))), () => 0.85 + rnd() * 0.15));
      }
    }
  }
  if (worn && lod < 2) {
    // Weeds come up through the gravel and over the beds.
    out.solid.push(...groundWeeds(lod ? 6 : 14, -1.6, 1.6, -WALK, WALK, 31, lod));
    out.solid.push(...groundWeeds(lod ? 4 : 9, -WALK, WALK, -1.6, 1.6, 37, lod));
  }
}

/** A marble basin on its foot (labrum), water in it (ice in a frost; dry and leaf-strewn untended), on a round of gravel. */
function labrum(out, { worn, ice, lod, rnd }) {
  const seg = lod === 2 ? 10 : lod ? 18 : 36;
  out.gravel.push(revolve(profileOf([[0, 0], [0.72, 0], [0.72, 0.05], [0, 0.05]]), { segments: seg, metres: 1 }));
  out.marble.push(revolve(profileOf([[0, 0.04], [0.26, 0.04], [0.26, 0.09], [0.2, 0.12], [0.11, 0.18], [0.085, 0.3], [0.08, 0.62], [0.12, 0.68], [0.36, 0.76], [0.46, 0.8], [0.48, 0.86], [0.45, 0.88], [0.42, 0.82], [0.0, 0.76]]), {
    segments: seg, metres: 1, tint: (p) => 0.78 + 0.22 * smoothstep(0, 0.6, p.y),
  }));
  if (worn) {
    if (lod < 2) for (let k = 0; k < 7; k++) out.solid.push(tintGeometry(boxUV(new BoxGeometry(0.06, 0.006, 0.04).rotateY(rnd() * 6).translate((rnd() - 0.5) * 0.5, 0.79, (rnd() - 0.5) * 0.5)), () => lin(pick(rnd, PALETTE.dead))));
  } else {
    out.water.push(tintGeometry(boxUV(new CircleGeometry(0.43, seg).rotateX(-Math.PI / 2).translate(0, 0.835, 0))));
  }
}

/** A sundial (hemicyclium): a block cut with a hollow bowl facing the sky, on a fluted column. */
function sundial(out, { worn, lod }) {
  const seg = lod === 2 ? 8 : lod ? 14 : 24;
  out.gravel.push(revolve(profileOf([[0, 0], [0.6, 0], [0.6, 0.05], [0, 0.05]]), { segments: seg, metres: 1 }));
  out.marble.push(revolve(profileOf([[0, 0.04], [0.2, 0.04], [0.2, 0.1], [0.15, 0.14], [0.12, 0.16], [0.11, 0.86], [0.15, 0.9], [0.15, 0.94], [0, 0.94]]), { segments: seg, metres: 0.6 }));
  // The dial: a flat marble disc on a square capital, its hour lines cut in it, a bronze gnomon
  // (the flat dial, as the one found in the forum of Pompeii's Temple of Apollo; askew untended).
  out.marble.push(slab(0.32, 0.06, 0.32, { bevel: 0.01, seed: 5, wobble: 0, tone: 0, grime: 0.1 }).translate(0, 0.94, 0));
  const dial = revolve(profileOf([[0, 0], [0.22, 0], [0.23, 0.03], [0.22, 0.05], [0, 0.05]]), { segments: seg, metres: 0.6 });
  if (worn) dial.rotateZ(0.08);
  out.marble.push(dial.translate(0, 1.0, 0));
  if (lod < 2) {
    for (let k = 0; k <= (lod ? 4 : 10); k++) {
      const a = -Math.PI / 2 + (k / (lod ? 4 : 10)) * Math.PI;
      out.bronze.push(tintGeometry(boxUV(new BoxGeometry(0.004, 0.003, 0.16).translate(0, 0, 0.08).rotateY(a).translate(0, 1.051, -0.02)), () => 0.35));
    }
    // The gnomon: a triangle of bronze standing on the dial, its edge toward the pole.
    const gn = new BoxGeometry(0.006, 0.12, 0.16);
    const P = gn.attributes.position;
    for (let i = 0; i < P.count; i++) if (P.getY(i) > 0 && P.getZ(i) > 0) P.setY(i, -0.06);
    gn.computeVertexNormals();
    out.bronze.push(tintGeometry(boxUV(gn.translate(0, 1.11, -0.02))));
  }
}

/** A pool (piscina) with a marble kerb, its water, and a winged boy in bronze on a little column in it. */
function pool(out, { worn, ice, lod, rnd }) {
  const h = 0.62;
  const kerb = 0.12;
  for (const [w, d, x, z] of [[2 * h, kerb, 0, h - kerb / 2], [2 * h, kerb, 0, -h + kerb / 2], [kerb, 2 * h - 2 * kerb, h - kerb / 2, 0], [kerb, 2 * h - 2 * kerb, -h + kerb / 2, 0]]) {
    out.marble.push(slab(w, 0.22, d, { bevel: 0.015, seed: 7, wobble: 0, tone: 0.02, grime: 0.15 }).translate(x, 0, z));
  }
  out.lining.push(slab(2 * h - 2 * kerb, 0.06, 2 * h - 2 * kerb, { bevel: 0.005, seed: 9, wobble: 0, tone: 0, grime: 0 }));
  if (!worn) out.water.push(tintGeometry(boxUV(new BoxGeometry(2 * h - 2 * kerb, 0.005, 2 * h - 2 * kerb).translate(0, 0.165, 0))));
  else if (lod < 2) out.solid.push(...groundWeeds(lod ? 2 : 5, -0.4, 0.4, -0.4, 0.4, 41, lod, 0.06));
  out.marble.push(revolve(profileOf([[0, 0], [0.08, 0], [0.08, 0.04], [0.055, 0.07], [0.05, 0.42], [0.07, 0.46], [0, 0.46]]), { segments: lod === 2 ? 6 : 12, metres: 0.4 }));
  if (lod < 2) for (const g of victory(lod, { scale: 0.42 })) out.bronze.push(g.translate(0, 0.46, 0));
}

/**
 * A pergola over the walk along x: four stuccoed pillars, beams and
 * slats, a vine trained up each pillar and over the top, oscilla hanging
 * between the pillars. By the season the vine is bare, in young leaf, in
 * full leaf with green grapes, or turning with purple ones.
 */
function pergola(out, { season, worn, lod, rnd, plain }) {
  const px = 1.22;
  const pz = 0.6;
  const top = 2.1;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      out.plaster.push(slab(0.17, top, 0.17, { bevel: 0.012, seed: 11 + sx + sz * 3, wobble: 0.002, tone: 0.03, grime: 0.4 }).translate(sx * px, 0, sz * pz));
      if (lod < 2) out.plaster.push(slab(0.22, 0.06, 0.22, { bevel: 0.01, seed: 13, wobble: 0, tone: 0, grime: 0 }).translate(sx * px, top - 0.06, sz * pz));
    }
  }
  for (const sz of [-1, 1]) out.wood.push(tintGeometry(boxUV(new BoxGeometry(2 * px + 0.5, 0.12, 0.1).translate(0, top + 0.06, sz * pz)), () => 0.8));
  const slats = lod === 2 ? 3 : lod ? 5 : 9;
  for (let k = 0; k < slats; k++) {
    const x = -px - 0.15 + ((k + 0.5) / slats) * (2 * px + 0.3);
    out.wood.push(tintGeometry(boxUV(new BoxGeometry(0.06, 0.06, 2 * pz + 0.45).translate(x, top + 0.15, 0)), () => 0.75));
  }
  // The vines: a trunk up each pillar, the canopy over the slats.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (px - 0.14);
      const z = sz * (pz + 0.12);
      out.bark.push(limb([[x, 0, z], [x + 0.04, 0.7, z - sz * 0.03], [x - 0.03, 1.4, z + sz * 0.02], [x, top + 0.1, z - sz * 0.1]], 0.04, 0.025, { radial: lod === 2 ? 4 : 6, segs: lod ? 4 : 10, twist: 2 }));
    }
  }
  const leaf = season === 'winter' ? null : season === 'spring' ? PALETTE.vineSpring : season === 'autumn' ? PALETTE.vineAutumn : PALETTE.vine;
  if (worn || season === 'winter') {
    // Canes: last year's growth over the top, bare (winter) or tangled and dead (untended).
    if (lod < 2 && !plain) {
      for (let k = 0; k < (lod ? 8 : 18); k++) {
        const x0 = (rnd() - 0.5) * 2 * px;
        out.bark.push(limb([[x0, top + 0.2, (rnd() - 0.5) * 2 * pz], [x0 + (rnd() - 0.5) * 0.8, top + 0.28 + rnd() * 0.1, (rnd() - 0.5) * 2 * pz], [x0 + (rnd() - 0.5) * 1.2, top + 0.1 + (worn ? -0.5 * rnd() : 0.2), (rnd() - 0.5) * 2.2 * pz]], 0.012, 0.006, { radial: 3, segs: 3 }));
      }
    }
  }
  if (leaf) {
    const pal = worn ? PALETTE.dead.concat(PALETTE.dry) : leaf;
    if (lod === 2 || plain) {
      out.solid.push(clump(0, 0, 0, px + 0.2, 0.2, pal[0], 1, rnd).scale(1, 1, (pz + 0.25) / (px + 0.2)).translate(0, top + 0.25, 0));
    } else {
      // Leaves over the top, lying flat to the sun, hanging over the beams' edges.
      const key = 'plane|leaf-palmate';
      if (!out.cards.has(key)) out.cards.set(key, []);
      const list = out.cards.get(key);
      const n = Math.round((lod ? 26 : 70) * (season === 'spring' ? 0.55 : worn ? 0.45 : 1));
      for (let i = 0; i < n; i++) {
        const edge = rnd() < 0.3;
        const x = (rnd() - 0.5) * (2 * px + 0.5);
        const z = edge ? (rnd() < 0.5 ? -1 : 1) * (pz + 0.15 + rnd() * 0.15) : (rnd() - 0.5) * (2 * pz + 0.3);
        const dir = edge ? new Vector3((rnd() - 0.5) * 0.4, -0.7, Math.sign(z) * 0.6).normalize() : new Vector3(rnd() - 0.5, 0.25, rnd() - 0.5).normalize();
        let side = new Vector3(0, 1, 0).cross(dir);
        if (side.lengthSq() < 1e-4) side = new Vector3(1, 0, 0);
        side.normalize();
        const s = (lod ? 0.6 : 0.42) * (0.8 + rnd() * 0.4);
        list.push({ p: new Vector3(x, top + 0.2 + rnd() * 0.12, z), dir, side, size: s, cell: Math.floor(rnd() * 4), out: new Vector3(0, 1, 0), c: leafLin(pick(rnd, pal)).map((v) => v * (0.75 + rnd() * 0.25)) });
      }
    }
    // Grapes: green in high summer, purple at the vintage, hanging under the canopy.
    if ((season === 'summer' || season === 'autumn') && !worn && lod < 2 && !plain) {
      const grape = season === 'summer' ? 0x9ab050 : 0x3a2040;
      const items = [];
      for (let b = 0; b < (lod ? 4 : 8); b++) {
        const x = (rnd() - 0.5) * 2 * (px - 0.2);
        const z = (rnd() - 0.5) * 2 * (pz - 0.1);
        for (let k = 0; k < (lod ? 4 : 14); k++) {
          const t = k / 14;
          items.push({ p: [x + (rnd() - 0.5) * 0.08 * (1 - t), top - 0.02 - t * 0.2, z + (rnd() - 0.5) * 0.08 * (1 - t)], r: 0.022, c: lin(grape) });
        }
      }
      out.fruit.push(balls(items, lod ? -1 : 0));
    }
  }
  // Oscilla: marble discs carved with a mask, hung by a chain between the pillars (one fallen, untended).
  if (lod < 2) {
    for (const [x, z, k] of [[-0.6, pz, 0], [0.62, -pz, 1]]) {
      const fallen = worn && k === 1;
      const d = new CylinderGeometry(0.13, 0.13, 0.025, lod ? 10 : 18, 1);
      d.rotateX(Math.PI / 2);
      if (fallen) {
        d.rotateX(Math.PI / 2 - 0.15);
        d.translate(x + 0.2, 0.06, z - 0.3);
      } else {
        d.translate(x, top - 0.42, z);
        out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.004, 0.004, 0.3, 3, 1).translate(x, top - 0.14, z)), () => 0.5));
      }
      out.marble.push(tintGeometry(boxUV(d), () => 0.95));
      if (!fallen && lod === 0) out.marble.push(ellipsoid(0.055, 1, 1.15, 0.5, x, top - 0.42, z + 0.016, 8, 6));
    }
  }
}

/** The beds of each design: what grows where (bed corners: [sx, sz] of the four quadrants). */
function beds(design, out, o) {
  const at = (sx, sz) => [sx * 0.95, sz * 0.95];
  const { rnd } = o;
  const plant = {
    rose: ([x, z]) => {
      rose(out, x - 0.25, z - 0.2, o);
      rose(out, x + 0.28, z + 0.22, { ...o, h: 0.75 });
      if (!o.plain) lilies(out, x + 0.3, z - 0.32, o);
    },
    myrtle: ([x, z]) => myrtle(out, x, z, o),
    acanthus: ([x, z]) => {
      acanthus(out, x - 0.15, z + 0.1, o);
      lilies(out, x + 0.35, z - 0.3, o);
    },
    oleander: ([x, z]) => oleander(out, x, z, o),
    box: ([x, z]) => {
      for (const [dx, dz] of [[-0.3, -0.3], [0.3, 0.3], [0.3, -0.3], [-0.3, 0.3]]) boxBall(out, x + dx, z + dz, 0.2 + rnd() * 0.04, o);
    },
    laurel: ([x, z]) => {
      if (o.lod === 2 || o.plain) {
        out.solid.push(clump(x, 1.6, z, 0.75, 1.3, o.worn ? 0x5a5a30 : 0x2e4e26, o.lod === 2 ? 1 : 2, rnd));
        out.bark.push(tintGeometry(boxUV(new CylinderGeometry(0.05, 0.07, 1.0, 5, 1).translate(x, 0.5, z)), () => lin(0x5a5248)));
      } else {
        // The woods' bay laurel, smaller in a garden (flora/treeModel.js: its sprays, its bark).
        const t = buildTree({ species: 'laurel', variant: Math.floor(rnd() * 2), look: 'leaf', lod: o.lod });
        const k = 0.7;
        for (const m of t.meshes) {
          const g = m.geometry.clone();
          g.scale(k * 0.62, k, k * 0.62).translate(x, 0, z);
          if (o.worn) {
            const c = g.attributes.color;
            for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * 1.35, c.getY(i) * 1.05, c.getZ(i) * 0.6);
          }
          (out.trees ??= []).push({ g, material: m.material });
          m.geometry.dispose();
        }
      }
    },
  };
  const plans = {
    labrum: [['rose', 1, 1], ['acanthus', -1, 1], ['rose', -1, -1], ['acanthus', 1, -1]],
    pergola: [['myrtle', 1, 1], ['oleander', -1, 1], ['box', -1, -1], ['rose', 1, -1]],
    sundial: [['laurel', -1, -1], ['rose', 1, 1], ['acanthus', 1, -1], ['box', -1, 1]],
    pool: [['oleander', 1, -1], ['oleander', -1, 1], ['rose', 1, 1], ['acanthus', -1, -1]],
  };
  for (const [what, sx, sz] of plans[design]) plant[what](at(sx, sz));
  // Violets along the beds' walk edges, in two of them.
  violets(out, WALK + 0.1, 1.45, WALK + 0.12, o);
  violets(out, -1.45, -WALK - 0.1, -WALK - 0.12, o);
}

/**
 * A clipped laurel's crown of sprays at (x, y0, z), `h` tall and `r`
 * round, for a model that has no garden of its own (a statue's potted
 * laurels): [{ name, material, geos }] for its parts, the sprays or, far
 * out, a clump.
 */
export function laurelCrown(x, y0, z, h, r, lod, seed = 1) {
  const out = bins();
  shrub(out, { x, z, h, r, y0, leaf: { sp: 'myrtle', tex: 'leaf-ovate', palette: PALETTE.myrtle }, lod, rnd: artRng(seed), dens: 1.4, stems: 0 });
  const m = hortusMaterials();
  const parts = [];
  if (out.solid.length) parts.push({ name: 'laurel-clump', material: m.solid, geos: out.solid });
  for (const [key, cards] of out.cards) {
    const [sp, tex] = key.split('|');
    parts.push({ name: `sprays-${sp}-${tex}`, material: foliageMaterial(sp, tex, lod > 0), geos: [cardGeometry(cards, tex, lod === 0)] });
  }
  return parts;
}

/** The garden's materials. */
export function hortusMaterials() {
  const c = castraMaterials();
  const r = ruralMaterials();
  return {
    soil: material('garden-loam', { surface: 'earth', color: 0x8a6a4c, vertexColors: true, snow: 1 }),
    gravel: material('garden-gravel', { surface: 'earth', color: 0xe6d8bc, vertexColors: true, snow: 1, rough: 1 }),
    tile: c.clay,
    marble: c.marble,
    // The pergola's pillars: stuccoed white (the plaster's painted dado is a wall's, not a pillar's).
    plaster: material('garden-stucco', { surface: 'limestone', color: 0xf4efe4, vertexColors: true, snow: 1 }),
    // A pool's floor and sides, painted blue as Pompeii's were.
    lining: material('pool-blue', { color: 0x4f8aa6, roughness: 0.7, vertexColors: true, snow: 1 }),
    wood: c.wood,
    bark: r.bark,
    bronze: c.bronze,
    solid: r.leaf,
    fruit: r.produce,
    box: material('box-hedge', { surface: 'boxleaf', vertexColors: true, snow: 0.9, wet: 0.6, normal: 1.4 }),
  };
}

/** The bins as a model: one part a material; sprays by species and texture (lite past level 0). */
function finish(name, out, lod, { ice = false } = {}) {
  const m = hortusMaterials();
  const p = new TaggedParts(name);
  const small = { cast: lod === 0 };
  p.add('soil', m.soil, out.soil, { cast: false });
  p.add('gravel', m.gravel, out.gravel, { cast: false });
  p.add('tiles', m.tile, out.tile, { cast: false });
  p.add('marble', m.marble, out.marble);
  p.add('plaster', m.plaster, out.plaster);
  p.add('lining', m.lining, out.lining, { cast: false });
  p.add('wood', m.wood, out.wood);
  p.add('bark', m.bark, out.bark, small);
  p.add('bronze', m.bronze, out.bronze, small);
  p.add('plants', m.solid, out.solid);
  p.add('flowers', m.fruit, out.fruit, { cast: false });
  p.add('box', m.box, out.box);
  for (const [key, cards] of out.cards) {
    if (!cards.length) continue;
    const [sp, tex] = key.split('|');
    p.add(`sprays-${sp}-${tex}`, foliageMaterial(sp, tex, lod > 0), [cardGeometry(cards, tex, lod === 0)]);
  }
  for (const t of out.trees || []) p.add(`tree-${t.material.name}`, t.material, [t.g]);
  p.add('water', ice ? iceMaterial() : waterMaterial(), out.water, { cast: false });
  return p.build();
}

/**
 * A plot: `design` one of DESIGNS, `season` of SEASONS, `worn` untended,
 * `ice` (its water frozen: a hard frost), `plain` (solid clumps for the
 * leaves: the build ghost). Returns { group, meshes, triangles }.
 */
export function buildPlot({ design = 'labrum', season = 'bloom', worn = false, ice = false, plain = false, lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const rnd = artRng(101 + DESIGNS.indexOf(design) * 31);
  const out = bins();
  const o = { season, worn, ice, lod, rnd, plain };
  ground(out, o);
  if (design === 'labrum') labrum(out, o);
  else if (design === 'sundial') sundial(out, o);
  else if (design === 'pool') pool(out, o);
  else pergola(out, o);
  beds(design, out, o);
  const plot = finish(`garden:${design}`, out, lod, { ice: ice && !worn });
  // Kept inside its tile and over the ground: a spray or a weed that strays over the edge would hang over
  // the neighbour's (and a stem's foot under the ground only costs depth).
  for (const m of plot.meshes) {
    const P = m.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      P.setX(i, Math.max(-1.99, Math.min(1.99, P.getX(i))));
      P.setZ(i, Math.max(-1.99, Math.min(1.99, P.getZ(i))));
      if (P.getY(i) < 0) P.setY(i, 0);
    }
  }
  return plot;
}

/** A side's run of hedge (the +z side, between the posts, a gap for the walk): its kit. */
export function buildHedge({ worn = false, lod = 0 } = {}) {
  const out = bins();
  out.box.push(...hedgeRun(-HEDGE_END, -HEDGE.gap, { worn, lod, round1: true }), ...hedgeRun(HEDGE.gap, HEDGE_END, { worn, lod, round0: true }));
  return finish('garden:hedge', out, lod);
}

/** A stub of hedge from the post's place out to the tile's edge (x -0.225..0.225 about its middle): where a run goes on into the next garden. */
export function buildHedgeStub({ worn = false, lod = 0 } = {}) {
  const out = bins();
  const half = STUB.half;
  out.box.push(...hedgeRun(-half, half, { worn, lod }));
  return finish('garden:stub', out, lod);
}

/** The corner post (at +x +z). */
export function buildHedgePost({ worn = false, lod = 0 } = {}) {
  const out = bins();
  out.box.push(...hedgePost({ worn, lod }));
  return finish('garden:post', out, lod);
}

/**
 * Every program a garden draws with (the warm-up compiles them before the
 * first draw: the sprays' full and lite materials differ in their maps, so
 * a level built later would compile at its first draw): a card of each.
 */
export function buildGardenWarm() {
  const out = bins();
  const p = new TaggedParts('garden:warm');
  const card = () => cardGeometry([{ p: new Vector3(0, 0.5, 0), dir: new Vector3(0, 1, 0), side: new Vector3(1, 0, 0), size: 0.1, cell: 0, out: new Vector3(0, 0, 1), c: [1, 1, 1] }], 'leaf-ovate', false);
  for (const [sp, tex] of [['myrtle', 'leaf-ovate'], ['myrtle', 'leaf-blossom'], ['olive', 'leaf-lance'], ['oak', 'leaf-lobed'], ['plane', 'leaf-palmate']]) {
    for (const lite of [false, true]) p.add(`w-${sp}-${tex}-${lite}`, foliageMaterial(sp, tex, lite), [card()]);
  }
  const t = buildTree({ species: 'laurel', variant: 0, look: 'leaf', lod: 1 });
  for (const m of t.meshes) p.add(`w-${m.material.name}`, m.material, [card()]);
  for (const m of t.meshes) m.geometry.dispose();
  const m = hortusMaterials();
  p.add('w-box', m.box, [card()]);
  p.add('w-ice', iceMaterial(), [card()]);
  void out;
  return p.build();
}

export { TorusGeometry };
