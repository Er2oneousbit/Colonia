/**
 * ground/apron.js
 * ----------------------------------------------------------------------------
 * The apron: the land that goes on past the playable rim of the map, so the
 * eye reads a landscape and not a cliff edge beside the last farm. Pure
 * arithmetic (no DOM, no three.js), so node:test checks it.
 *
 * What it is made of:
 *   - The ground. Nothing is stored: the ground shader (groundMaterial.js)
 *     reads the type map clamped to the rim, so the apron outside a tile is
 *     that rim tile's ground (grass stays grass, water stays water with the
 *     same depth, sand and rock go on), minus what people made (roads, yards,
 *     fields and rubble are not read outside: the site map is zeroed there).
 *     `apronKind` is the same rule in JavaScript, for the tests.
 *     It fades into the horizon's colour over its width and has a faint kerb
 *     along the rim (both in the shader).
 *   - The trees (`apronTrees`, laid out by flora.js beside the map's own):
 *     the province's mix on a grass, meadow or forest rim, thinning out with
 *     the distance as the ground fades, none within the playable rim.
 *
 * It is static per map (the map's shape never changes), made once with it.
 * The sim, the saves, Classic and the minimap never see it, and a click past
 * the rim picks nothing (picking is the map's own).
 * ----------------------------------------------------------------------------
 */

import { Terrain } from '../../world/map.js';
import { CLIMATES, ACCENTS, TREE_VARIANTS } from '../flora/species.js';
import { hashUnit, habitatOf, pickWeighted, WOOD_SCALE } from '../flora/layout.js';

/** Tiles the apron is wide on a map, and on the biggest (Uber: 256 tiles a side) where the view reaches further. */
export const APRON_TILES = 8;
export const APRON_TILES_UBER = 16;
/** Maps at least this wide take the wider apron. */
const UBER_SIDE = 256;

/**
 * The horizon the apron fades into and the void beyond it (look.js MOODS.day's
 * backdrop), as sRGB bytes. The ground's picture is cleared to it, so the
 * faded edge and the empty space round it are one colour; before, the void
 * was near black beside the farmland.
 */
export const HORIZON_RGB = Object.freeze([0x5e, 0x59, 0x4e]);

/** Trees stand out to this share of the apron's width (beyond it the ground has faded too far for them). */
const TREE_REACH = 0.6;
/** Chance a grass tile of the apron has a tree, at its start and dropping to nothing at the reach. */
const TREE_DENSITY = 0.3;
/** A forest rim is denser. */
const FOREST_DENSITY = 0.55;
/** The most trees an apron holds (the flora's instance buffers and its fill pass stay small). */
const TREE_CAP = 420;

/** How wide the apron is on `map`, in tiles. */
export function apronWidth(map) {
  return Math.max(map.w, map.h) >= UBER_SIDE ? APRON_TILES_UBER : APRON_TILES;
}

/** The rim tile (map coordinates) the apron tile (x, y) takes its ground from: the nearest tile of the map. */
export function rimTile(map, x, y) {
  return [Math.max(0, Math.min(map.w - 1, x)), Math.max(0, Math.min(map.h - 1, y))];
}

/** Is the tile (x, y) outside the playable map? */
export function inApron(map, x, y) {
  return x < 0 || y < 0 || x >= map.w || y >= map.h;
}

/**
 * The kind of ground (groundMap.js KIND) of tile (x, y) of `types` (a
 * GroundMap): the tile's own if it is on the map, the nearest rim tile's if
 * not.
 */
export function apronKind(types, x, y) {
  const map = types.map;
  const [rx, ry] = rimTile(map, x, y);
  return types.data[(ry * map.w + rx) * 4];
}

/**
 * The apron's trees for `map` in province `ctx` (species.js climateOf):
 * [{ sp, v, x, z, yaw, s }] in map tiles, none within a tile and a half of
 * the rim (a crown would overhang the playable tiles). Deterministic
 * (hashed from the tile), at most TREE_CAP.
 */
export function apronTrees(map, ctx, width = apronWidth(map)) {
  const clim = CLIMATES[ctx.climate] || CLIMATES.tyrrhenian;
  const reach = width * TREE_REACH;
  const span = Math.ceil(reach);
  const out = [];
  for (let y = -span; y < map.h + span; y++) {
    for (let x = -span; x < map.w + span; x++) {
      if (!inApron(map, x, y)) continue;
      const [rx, ry] = rimTile(map, x, y);
      const d = Math.hypot(x - rx, y - ry);
      if (d < 1.5 || d > reach) continue;
      const ri = ry * map.w + rx;
      const t = map.terrain[ri];
      if (t !== Terrain.GRASS && t !== Terrain.MEADOW && t !== Terrain.TREES) continue;
      const h = (k) => hashUnit(x * 7 + 1000, y * 13 + 1000, k);
      if (h(1) >= (t === Terrain.TREES ? FOREST_DENSITY : TREE_DENSITY) * (1 - d / reach)) continue;
      const sp = pickWeighted(clim[habitatOf(map.waterDist[ri])], h(2), ACCENTS);
      out.push({
        sp,
        v: Math.floor(h(3) * TREE_VARIANTS) % TREE_VARIANTS,
        x: x + 0.15 + h(4) * 0.7,
        z: y + 0.15 + h(5) * 0.7,
        yaw: h(6) * Math.PI * 2,
        s: (0.85 + h(7) * 0.3) * WOOD_SCALE,
      });
    }
  }
  if (out.length <= TREE_CAP) return out;
  // Over the cap: thin evenly along the list, not just one side of the map.
  return Array.from({ length: TREE_CAP }, (_, i) => out[Math.floor((i * out.length) / TREE_CAP)]);
}
