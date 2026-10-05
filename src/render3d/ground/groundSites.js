/**
 * ground/groundSites.js
 * ----------------------------------------------------------------------------
 * What the game's buildings and fires make of the ground under them, for
 * the 3D ground's type and site maps (groundMap.js GroundMap's hooks):
 *
 *   - a farm's field, by its crop (SITE: grain, vegetables, flax, an
 *     orchard's or an olive grove's grass, vine rows, a pig pen's mud, a
 *     horse ranch's paddock), how far it has grown (its progress, in
 *     GROWTH_STEPS steps), resting for the winter, left idle; and the strip
 *     its farmhouse stands on (the art's u 0..1, render/buildingArt.js
 *     farmArt, turned with the farm) as a farmyard
 *   - every other building's yard of trodden earth (a garden or a statue
 *     keeps the grass it stands in; a pier over the water, the water)
 *   - the footing of a wall, and of an aqueduct off the roads
 *   - rubble a fire left (the ruin's cause, sim/ruins.js), and a fire still
 *     burning (game.fires)
 *
 * Render only: it reads the game and never writes it. The site words are
 * worked out for the whole map only when the map's revision changes
 * (a building comes or goes, the sim touches the map), then kept; a farm's
 * growth and a fire change between revisions, so their tiles are `live`:
 * read again every update (a few hundred tiles at most).
 * ----------------------------------------------------------------------------
 */

import { SITE, BURN, S_RESTING, S_IDLE, siteWord } from './groundMap.js';
import { Terrain } from '../../world/map.js';
import { farmDormant } from '../../sim/production.js';
import { turnUV } from '../../render/turn.js';

/** A farm's field by its type (any other farm's is ploughed soil). */
export const FIELD_OF = Object.freeze({
  farm_wheat: SITE.GRAIN,
  farm_veg: SITE.VEG,
  farm_flax: SITE.FLAX,
  farm_fruit: SITE.ORCHARD,
  farm_olive: SITE.OLIVE,
  farm_vine: SITE.VINES,
  farm_pig: SITE.PEN,
});

/** Ruin causes that are fires (sim/ruins.js RUIN_CAUSES): their rubble is ash and charred timber. */
export const BURNED_BY = Object.freeze(new Set(['fire', 'wrath', 'raidFire', 'riot', 'legionFire', 'revoltFire']));

/** A field's growth is shown in this many steps (each a new upload of the site map). */
export const GROWTH_STEPS = 64;

/**
 * The site word (groundMap.js siteWord) of map tile (x, y) under building
 * `b`, or 0 where the ground keeps its own look.
 */
export function buildingSite(game, b, x, y) {
  const map = game.map;
  if (map.terrain[y * map.w + x] === Terrain.WATER) return 0; // (a pier's rows over the water: the water)
  const kind = b.def.kind;
  if (kind === 'decor') return 0; // a garden, a statue: in the grass
  const S = b.size;
  const t = (b.turn || 0) & 3;
  const lu = x - b.x;
  const lv = y - b.y;
  if (kind === 'farm') {
    if (b.herd !== undefined) return siteWord(SITE.PADDOCK, 0, 0, S, lu, lv, t);
    // Where this tile's middle lies in the art (drawn at turn 0): the farmhouse stands on u 0..1.
    const [u] = turnUV(lu + 0.5, lv + 0.5, S, (4 - t) & 3);
    if (u < 1) return siteWord(SITE.YARD, 0, 0, S, lu, lv, t);
    const growth = Math.floor(Math.max(0, Math.min(99.999, b.progress || 0)) / 100 * GROWTH_STEPS) / (GROWTH_STEPS - 1);
    const flags = (farmDormant(game, b) ? S_RESTING : 0) | (b.efficiency > 0 ? 0 : S_IDLE);
    return siteWord(FIELD_OF[b.type] || SITE.SOIL, growth, flags, S, lu, lv, t);
  }
  if (b.type === 'native_crops') return siteWord(SITE.SOIL, 0.6, 0, S, lu, lv, t);
  return siteWord(SITE.YARD, 0, 0, S, lu, lv, t);
}

/**
 * The hooks of a game's ground (groundMap.js GroundMap): call prepare()
 * before each update (ground.js does), which rebuilds the site words when
 * the map's revision changed and rereads the farms' otherwise.
 */
export function gameSiteHooks(game) {
  let rev = -1;
  let map = null;
  let words = null;
  let farms = []; // [building, tiles[]]
  let fires = []; // last update's burning tiles: refreshed once more as they go out
  const rebuild = () => {
    map = game.map;
    const n = map.w * map.h;
    if (!words || words.length !== n) words = new Uint32Array(n);
    else words.fill(0);
    farms = [];
    for (const b of game.buildings.values()) {
      const tiles = [];
      for (let y = b.y; y < b.y + b.size; y++) {
        for (let x = b.x; x < b.x + b.size; x++) {
          if (!map.inBounds(x, y)) continue;
          const i = y * map.w + x;
          if (map.building[i] !== b.id) continue;
          words[i] = buildingSite(game, b, x, y);
          tiles.push(i);
        }
      }
      if (b.def.kind === 'farm' && b.herd === undefined) farms.push([b, tiles]);
    }
    // A wall, and an aqueduct where no road runs under it, stands on its footing.
    for (let i = 0; i < n; i++) {
      if (words[i] || map.building[i]) continue;
      if (map.wall[i] || (map.aqueduct[i] && !map.road[i])) words[i] = siteWord(SITE.FOOTING);
    }
    rev = map.revision;
  };
  const hooks = {
    prepare() {
      if (game.map !== map || game.map.revision !== rev) {
        rebuild();
        return;
      }
      // Between revisions only a farm's crop changes: read again.
      for (const [b, tiles] of farms) for (const i of tiles) words[i] = buildingSite(game, b, i % map.w, (i / map.w) | 0);
    },
    farmAt: (i) => {
      const id = map.building[i];
      if (!id) return false;
      const b = game.buildings.get(id);
      return !!b && b.def.kind === 'farm';
    },
    buildingAt: (i) => map.building[i] !== 0,
    siteAt: (i) => words[i],
    // (Walls' and aqueducts' footings all belong together.)
    ownerAt: (i) => map.building[i] || (words[i] ? -1 : 0),
    burnAt: (i) => {
      const rec = map.rubble[i] && game.ruins ? game.ruins.get(i) : null;
      return (rec && BURNED_BY.has(rec.cause) ? BURN.BURNT : 0) | (game.fires && game.fires.has(i) ? BURN.BURNING : 0);
    },
    live() {
      const out = [];
      for (const [, tiles] of farms) for (const i of tiles) out.push(i);
      for (const i of fires) out.push(i);
      fires = game.fires ? [...game.fires.keys()] : [];
      for (const i of fires) out.push(i);
      return out;
    },
  };
  return hooks;
}
