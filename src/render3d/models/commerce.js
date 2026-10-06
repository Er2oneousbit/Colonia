/**
 * models/commerce.js
 * ----------------------------------------------------------------------------
 * The market, the forum and the warehouse as the game draws them
 * (render3d/models.js MODELS takes these entries as they are): which look
 * a building shows, its state, and the kits that stand in its frame.
 *
 *   market     the shell ('market': its awnings out when staffed, rolled
 *              up when not) and, as extras, the display of each good it
 *              holds at a stall, in three steps of fullness
 *              ('market:ware:<good>'), and the fish on the tholos
 *              ('market:fish'): models/market.js marketWares
 *   forum      one look; its state 'open' (staffed: doors open, clerk and
 *              coin at the table) or 'shut'
 *   warehouse  the shell ('warehouse': its gate open when staffed) and, as
 *              extras, one load of a good for every 100 units it holds
 *              ('warehouse:load:<good>'), placed load by load in the court's
 *              bays: models/warehouse.js warehouseLoads
 *
 * A good's display or load is one kit shared by every building that shows
 * it, drawn instanced, its matrix the building's times the stall's or
 * square metre's (`at`). Nothing is rebuilt as the stock changes: only the
 * list of what stands where, and that only when a step or a load changes
 * (the lists are cached by the building's stock record).
 * ----------------------------------------------------------------------------
 */

import { buildMarket, marketWares, marketState, marketShows, buildTholosFish, MARKET } from './market.js';
import { buildForum, forumState, forumShows, FORUM } from './forum.js';
import { buildWarehouse, warehouseLoads, warehouseState, warehouseShows, WAREHOUSE } from './warehouse.js';
import { buildLoad, buildDisplay, wareMaterials } from './wares.js';
import { ART_PX } from '../projection.js';

/** Metres in a game tile (models.js TILE_M). */
const M = 4;

/**
 * Night lights in the model's frame, in tiles of its footprint from its
 * top corner (u along +x, v along +z) and px of art height, as the 2D
 * art's torches are (render/lighting.js TORCHES): the lamps the models
 * hang by their doors, so the game's night lights them where they are.
 */
const lampAt = (S, [x, y, z]) => [x / M + S / 2, z / M + S / 2, y / M / ART_PX];

/**
 * A good's kit as the game draws it: casting shadows only close up. A
 * stack of jars throws a shadow a few pixels long from the middle zooms
 * out, and each part casting is one more draw call in the sun's pass,
 * about a hundred of them over a city's stores.
 */
function goods(group, lod) {
  if (lod > 0) group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

export const COMMERCE_MODELS = Object.freeze({
  market: Object.freeze({
    variant: (b, place) => ({ key: 'market', state: marketState(b), ice: false, extras: marketWares(b.stock, place.T || 0) }),
    shows: marketShows,
    // (One display stands for all the goods' materials: wareMaterials makes them all with the shell.)
    warm: ['market', 'market:ware:wheat:3', 'market:fish:3'],
    // The tholos's lamp under its roof.
    lights: (S) => [lampAt(S, [0, 2.05, 0])],
    build(key, lod) {
      const [, kind, good] = key.split(':');
      // ('market:ware:<good>:<step>', 'market:fish:<step>': a kit a step, merged by material.)
      if (kind === 'ware') return goods(buildDisplay(good, lod, Number(key.split(':')[3]) || 0).group, lod);
      if (kind === 'fish') return goods(buildTholosFish(lod, Number(good) || 0).group, lod);
      wareMaterials();
      return buildMarket({ lod }).group;
    },
  }),
  forum: Object.freeze({
    variant: (b) => ({ key: 'forum', state: forumState(b), ice: false }),
    shows: forumShows,
    warm: ['forum'],
    lights: (S) => FORUM.lamps.map((p) => lampAt(S, p)),
    build: (key, lod) => buildForum({ lod }).group,
  }),
  warehouse: Object.freeze({
    variant: (b, place) => ({ key: 'warehouse', state: warehouseState(b), ice: false, extras: warehouseLoads(b.stock, place.T || 0) }),
    shows: warehouseShows,
    warm: ['warehouse', 'warehouse:load:wine'],
    lights: (S) => [lampAt(S, WAREHOUSE.lamp)],
    build(key, lod) {
      const [, kind, good] = key.split(':');
      if (kind === 'load') return goods(buildLoad(good, lod).group, lod);
      wareMaterials();
      return buildWarehouse({ lod }).group;
    },
  }),
});
