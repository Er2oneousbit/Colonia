/**
 * desirability.js
 * ----------------------------------------------------------------------------
 * How pleasant each tile is to live on. Every building radiates a value that
 * fades with distance: gardens, statues and temples are positive, industry
 * and storage are negative. Terrain adds a little: waterfront views and trees
 * are nice, rubble is not. Houses need a minimum desirability to evolve.
 *
 * Formula for a source [value, step, stepSize, range] at distance d (1..range):
 *   value + floor((d - 1) / step) * stepSize, never crossing zero.
 * Tiles inside the source's own footprint are not affected.
 * ----------------------------------------------------------------------------
 */

import { CONFIG } from '../config.js';
import { HOUSE_TIERS } from '../data/housing.js';
import { Road, Terrain } from '../world/map.js';
import { careScale } from './gardens.js';
import { SITE_DES, GIFTS } from '../data/monuments.js';
import { isSite, fanumOf } from './monumentEffects.js';

/** Add one source's contribution to a desirability layer (the map's unless given), times `scale` (0..1). */
function radiate(map, x, y, size, des, scale = 1, layer = map.desirability) {
  const [value, step, stepSize, range] = des;
  if (!value || range <= 0 || scale <= 0) return;
  const x0 = Math.max(0, x - range);
  const y0 = Math.max(0, y - range);
  const x1 = Math.min(map.w - 1, x + size - 1 + range);
  const y1 = Math.min(map.h - 1, y + size - 1 + range);
  for (let ty = y0; ty <= y1; ty++) {
    const dy = ty < y ? y - ty : ty > y + size - 1 ? ty - (y + size - 1) : 0;
    for (let tx = x0; tx <= x1; tx++) {
      const dx = tx < x ? x - tx : tx > x + size - 1 ? tx - (x + size - 1) : 0;
      const d = Math.max(dx, dy);
      if (d === 0 || d > range) continue;
      let v = value + Math.floor((d - 1) / Math.max(1, step)) * stepSize;
      if ((value > 0 && v < 0) || (value < 0 && v > 0)) v = 0;
      layer[ty * map.w + tx] += scale === 1 ? v : Math.round(v * scale);
    }
  }
}

const PLAZA_DES = [4, 1, -1, 3];

/**
 * How much of its desirability a building gives: all of it, except a
 * governor's residence, which gives it as far as it is staffed (an empty
 * residence is a shuttered house), and a garden or statue, which gives it
 * as far as it is tended (sim/gardens.js careScale). Labor marks
 * desirability for a new pass when a residence's staffing changes
 * (sim/labor.js), and the gardens' care when a decoration's step changes.
 */
export function desScale(b, venus = false) {
  if (b.def.kind === 'residence') return b.efficiency;
  // Venus's Great Sanctuary at work: gardens and statues give half again as much.
  return b.def.tended ? careScale(b) * (venus ? GIFTS.venus.decor : 1) : 1;
}

/**
 * A building's desirability source: a home's by its level, a monument still
 * being built a noisy yard's (SITE_DES; the finished one's own once done),
 * anything else its data's.
 */
function desOf(b) {
  if (b.house) return HOUSE_TIERS[b.house.tier].desOut;
  return isSite(b) ? SITE_DES : b.def.des;
}
const RUBBLE_DES = [-2, 1, 1, 1];

/**
 * The ground's own share of desirability (waterfront, trees, plazas, rubble)
 * is the O(map) part of a pass, and a home evolving or a building going up
 * changes none of it. So it is kept, with copies of the four layers it was
 * worked out from, and redone only when one of them differs. The compare is
 * what makes it safe: terrain, rubble, road and waterDist are written from a
 * dozen places (construction and its undo, fires, collapses, quakes, housing,
 * map generation) and not every one marks anything, so no flag of ours could
 * be trusted to be set by all of them. Roads are copied whole, so a new road
 * redoes the base needlessly, which is only slower, never wrong.
 */
const baseCache = new WeakMap();

/** Are `a` and `b` the same bytes? Four at a time where the alignment allows. */
function sameBytes(a, b) {
  const n = a.length;
  const n4 = n >> 2;
  if (!(a.byteOffset & 3) && !(b.byteOffset & 3)) {
    const x = new Uint32Array(a.buffer, a.byteOffset, n4);
    const y = new Uint32Array(b.buffer, b.byteOffset, n4);
    for (let i = 0; i < n4; i++) if (x[i] !== y[i]) return false;
    for (let i = n4 << 2; i < n; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Drop the kept ground layer, so the next pass works it out afresh (for tests; a load builds a new map anyway). */
export function forgetDesirabilityBase(map) {
  baseCache.delete(map);
}

/** Work the ground's desirability out into `out`. */
function groundDesirability(map, out) {
  out.fill(0);
  // Terrain: waterfront bonus and a touch of green near trees.
  for (let i = 0; i < map.size; i++) {
    const wd = map.waterDist[i];
    if (wd >= 1 && wd <= 3) out[i] += 4 - wd;
  }
  for (let i = 0; i < map.size; i++) {
    if (map.terrain[i] === Terrain.TREES) {
      const x = i % map.w;
      const y = (i / map.w) | 0;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        if (map.inBounds(x + dx, y + dy)) out[map.idx(x + dx, y + dy)] += 1;
      }
    }
    if (map.road[i] === Road.PLAZA) radiate(map, i % map.w, (i / map.w) | 0, 1, PLAZA_DES, 1, out);
    if (map.rubble[i]) radiate(map, i % map.w, (i / map.w) | 0, 1, RUBBLE_DES, 1, out);
  }
}

/** The ground layer for this map: the kept one if the four layers it reads are as they were. */
function groundLayer(map) {
  let c = baseCache.get(map);
  if (c && c.size === map.size && sameBytes(c.terrain, map.terrain) && sameBytes(c.rubble, map.rubble)
    && sameBytes(c.road, map.road) && sameBytes(c.waterDist, map.waterDist)) return c.base;
  if (!c || c.size !== map.size) {
    c = {
      size: map.size,
      base: new Int16Array(map.size),
      terrain: new Uint8Array(map.size),
      rubble: new Uint8Array(map.size),
      road: new Uint8Array(map.size),
      waterDist: new Uint8Array(map.size),
    };
    baseCache.set(map, c);
  }
  groundDesirability(map, c.base);
  c.terrain.set(map.terrain);
  c.rubble.set(map.rubble);
  c.road.set(map.road);
  c.waterDist.set(map.waterDist);
  return c.base;
}

export function updateDesirability(game) {
  const { map } = game;
  const des = map.desirability;
  des.set(groundLayer(map));
  const venus = fanumOf(game, 'venus');
  for (const b of game.buildings.values()) radiate(map, b.x, b.y, b.size, desOf(b), desScale(b, venus));
  for (let i = 0; i < map.size; i++) {
    if (des[i] < CONFIG.DES_MIN) des[i] = CONFIG.DES_MIN;
    else if (des[i] > CONFIG.DES_MAX) des[i] = CONFIG.DES_MAX;
  }
}
