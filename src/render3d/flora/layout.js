/**
 * flora/layout.js
 * ----------------------------------------------------------------------------
 * Which trees, shrubs and rocks stand on a map tile, and where, for the
 * WebGL renderer's 3D countryside (flora/floraPass.js). Pure: tested in node.
 *
 * Deterministic from the map alone, as the 2D sprites are: the tile's own
 * byte of the variant layer (random, saved with the map, never changed),
 * its place, its distance to water, and the province's climate
 * (species.js CLIMATES). Nothing here reads a neighbour's terrain, so
 * clearing a tile never changes the trees on the tiles round it.
 *
 *   - The habitat by the distance to water: the banks (2 tiles or less)
 *     take the riparian trees (poplar, willow, plane), the dry ground (7
 *     and more) the pines, holm oaks and wild olives.
 *   - Stands: a smooth field over the map (value noise whose lattice values
 *     are variant bytes of tiles 6 apart) picks a stand's species from the
 *     habitat's weights, so woods grow in patches of one kind as they do;
 *     about two trees in five are drawn from the whole mix instead, and the
 *     accents (the cypress) only that way.
 *   - Each tile has a main tree near its middle; some a second, smaller one
 *     (a big tree's crown fills a tile: 4 m) and some a shrub under them.
 *
 * Rocks: an outcrop, boulders and scree by the tile's byte; on a volcanic
 * province's map (Puteoli, Volsinii) some boulders are dark lava.
 *
 * A plant or rock is { sp | kind, v (its shape, a seed), x, z (where on the
 * tile, 0..1 along map x and y), yaw (radians), s (scale) }.
 * ----------------------------------------------------------------------------
 */

import { SPECIES, SPECIES_IDS, CLIMATES, ACCENTS, ROCKS, TREE_VARIANTS } from './species.js';

/** Tiles between the stand field's lattice points. */
export const STAND_CELL = 6;
/** The share of trees drawn from the stand's species (the rest from the whole mix). */
const STAND_SHARE = 0.62;

/** A stable 0..1 from integers (a 32-bit hash: the same tree on every machine). */
export function hashUnit(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The habitat of a tile `wd` tiles from water: 'wet', 'fresh' or 'dry'. */
export function habitatOf(wd) {
  return wd <= 2 ? 'wet' : wd <= 6 ? 'fresh' : 'dry';
}

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * The stand field at map tile (x, y): 0..1, smooth over a few tiles, from
 * the variant bytes of the lattice's tiles (every STAND_CELL tiles).
 */
export function standField(map, x, y) {
  const fx = x / STAND_CELL;
  const fy = y / STAND_CELL;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const at = (lx, ly) => {
    const tx = Math.min(map.w - 1, Math.max(0, lx * STAND_CELL));
    const ty = Math.min(map.h - 1, Math.max(0, ly * STAND_CELL));
    // (A second byte mixed in: a lattice of single bytes alone is coarse.)
    return (map.variant[ty * map.w + tx] + hashUnit(lx, ly, 77) * 255) / 510;
  };
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
  return a + (b - a) * ty;
}

/** Pick from weights { name: w } at u (0..1) along their running sum, in a fixed order; `skip` left out. */
export function pickWeighted(weights, u, skip = null) {
  const names = Object.keys(weights).filter((n) => !skip || !skip.includes(n));
  let total = 0;
  for (const n of names) total += weights[n];
  let at = u * total;
  for (const n of names) {
    at -= weights[n];
    if (at < 0) return n;
  }
  return names[names.length - 1];
}

/**
 * The plants on tile i of `map` (a forest tile), for climate `ctx`
 * (species.js climateOf). Returns [{ sp, v, x, z, yaw, s }], the main tree
 * first.
 */
export function treesOfTile(map, i, ctx) {
  const x = i % map.w;
  const y = (i / map.w) | 0;
  const vb = map.variant[i];
  const clim = CLIMATES[ctx.climate] || CLIMATES.tyrrhenian;
  const weights = clim[habitatOf(map.waterDist[i])];
  const h = (k) => hashUnit(i * 7 + vb, k, 0x5f1a);
  const stand = pickWeighted(weights, standField(map, x, y), ACCENTS);
  const pick = (k) => (h(k) < STAND_SHARE ? stand : pickWeighted(weights, h(k + 1)));
  const out = [];
  const main = pick(1);
  const big = SPECIES[main].size.r >= 2.4;
  // The main tree near the tile's middle; a big crown alone, a smaller one with a second tree.
  const second = !big && (vb & 3) < 2;
  const spread = second ? 0.17 : 0.1;
  const a = h(3) * Math.PI * 2;
  out.push(plant(main, 0.5 + Math.cos(a) * spread * h(4), 0.5 + Math.sin(a) * spread * h(4), 0.88 + h(5) * 0.26, h(6), h(7)));
  if (second) {
    const sp = pick(8);
    // Across the tile from the first, smaller.
    const r = 0.26 + h(9) * 0.06;
    out.push(plant(sp, 0.5 - Math.cos(a) * r, 0.5 - Math.sin(a) * r, 0.62 + h(10) * 0.18, h(11), h(12)));
  }
  // A shrub under them on drier ground (never on the banks: reeds and grass there).
  if (habitatOf(map.waterDist[i]) !== 'wet' && ((vb >> 2) & 7) < 3 && clim.shrub) {
    const b = a + Math.PI * (0.5 + h(13));
    out.push(plant(clim.shrub, 0.5 + Math.cos(b) * 0.3, 0.5 + Math.sin(b) * 0.3, 0.7 + h(14) * 0.4, h(15), h(16)));
  }
  return out;
}

/** A plant record: species `sp` at (x, z) on its tile, scale s, its shape and turn from two hashes. */
function plant(sp, x, z, s, hv, hy) {
  return { sp, v: Math.floor(hv * TREE_VARIANTS) % TREE_VARIANTS, x, z, yaw: hy * Math.PI * 2, s };
}

/**
 * The rocks on tile i of `map` (a rock tile), for `ctx` (climateOf):
 * [{ kind, v, x, z, yaw, s }], the biggest first.
 */
export function rocksOfTile(map, i, ctx) {
  const vb = map.variant[i];
  const h = (k) => hashUnit(i * 13 + vb, k, 0x2c0c);
  const lava = (k) => ctx.volcanic > 0 && h(k) < ctx.volcanic;
  const out = [];
  const rock = (kind, x, z, s, k) => {
    const n = ROCKS[kind].n;
    out.push({ kind, v: Math.floor(h(k) * n) % n, x, z, yaw: h(k + 1) * Math.PI * 2, s });
  };
  const boulder = (x, z, s, k) => rock(lava(k + 2) ? 'lava' : 'boulder', x, z, s, k);
  switch (vb & 3) {
    case 0:
      // A bedded outcrop filling the tile, scree at its foot.
      rock(lava(40) ? 'lava' : 'outcrop', 0.5 + (h(1) - 0.5) * 0.12, 0.5 + (h(2) - 0.5) * 0.12, 0.85 + h(3) * 0.25, 4);
      rock('scree', 0.5, 0.5, 0.9 + h(6) * 0.2, 7);
      break;
    case 1:
      // Two boulders and scree.
      boulder(0.33 + h(1) * 0.08, 0.36 + h(2) * 0.1, 0.9 + h(3) * 0.3, 10);
      boulder(0.64 + h(4) * 0.08, 0.62 + h(5) * 0.08, 0.6 + h(6) * 0.25, 14);
      rock('scree', 0.5, 0.5, 0.8 + h(7) * 0.3, 18);
      break;
    case 2:
      // A big boulder and two small ones.
      boulder(0.45 + h(1) * 0.1, 0.45 + h(2) * 0.1, 1.05 + h(3) * 0.3, 20);
      boulder(0.78, 0.3 + h(4) * 0.2, 0.42 + h(5) * 0.2, 24);
      boulder(0.25 + h(6) * 0.1, 0.78, 0.38 + h(7) * 0.2, 28);
      break;
    default:
      // A low ledge of the bedding with a boulder broken off it.
      rock(lava(42) ? 'lava' : 'outcrop', 0.42 + h(1) * 0.1, 0.42 + h(2) * 0.1, 0.62 + h(3) * 0.2, 32);
      boulder(0.74, 0.72, 0.55 + h(4) * 0.25, 36);
      rock('scree', 0.55, 0.55, 0.7 + h(5) * 0.2, 40);
  }
  return out;
}

/** The species' indices (SPECIES_IDS) by name, for packing a plant into numbers. */
export const SPECIES_INDEX = Object.freeze(Object.fromEntries(SPECIES_IDS.map((n, k) => [n, k])));
