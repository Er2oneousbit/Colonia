/**
 * models/commerce.js
 * ----------------------------------------------------------------------------
 * The market, the forum and the warehouse as the game draws them
 * (render3d/models.js MODELS takes these entries as they are): which look
 * a building shows, its state, and the kits that stand in its frame.
 *
 *   market     the shell ('market': its awnings out when staffed, rolled
 *              up when not: parts tagged 'open' and 'shut') and, as `more`,
 *              the display of each good it holds at a stall, in three steps
 *              of fullness ('market:ware:<good>:<step>'), and the fish on
 *              the tholos ('market:fish:<step>'): models/market.js
 *              marketWares
 *   forum      one look; its state 'open' (staffed: doors open, clerk and
 *              coin at the table) or 'shut'
 *   warehouse  the shell ('warehouse': its gate open when staffed) and, as
 *              `more`, one load of a good for every 100 units it holds
 *              ('warehouse:load:<good>'), placed load by load in the court's
 *              bays: models/warehouse.js warehouseLoads
 *
 * A good's display or load is one kit shared by every building that shows
 * it, drawn instanced (modelPass.js `more`), its matrix the building's
 * times the stall's or square metre's. Nothing is rebuilt as the stock
 * changes: only the list of what stands where, and that only when a step
 * or a load changes (the lists are cached by the building's stock record,
 * their matrices by the list).
 * ----------------------------------------------------------------------------
 */

import { Matrix4 } from 'three';
import { buildMarket, marketWares, marketState, buildTholosFish } from './market.js';
import { buildForum, forumState, FORUM, forumActors } from './forum.js';
import { cast, NOBODY } from '../people/actors.js';

/** The forum's people at work (forum.js forumActors), packed once on first use. */
let forumCast = null;
const FORUM_CAST = () => (forumCast ??= cast(forumActors('open')));
import { buildWarehouse, warehouseLoads, warehouseState, WAREHOUSE } from './warehouse.js';
import { buildLoad, buildDisplay, wareMaterials } from './wares.js';

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

const IDENTITY = new Matrix4();
/** The `more` of each list of wares or loads ([{ key, state, at }]), made once a list. */
const MORE = new WeakMap();

/**
 * A list of wares or loads as modelPass.js `more`: a kit and its matrices
 * (in the building's metres) for every good, in the list's order.
 */
function moreOf(list) {
  let more = MORE.get(list);
  if (more) return more;
  const byKey = new Map();
  for (const e of list) {
    if (!byKey.has(e.key)) byKey.set(e.key, []);
    byKey.get(e.key).push(e.at || IDENTITY);
  }
  more = [...byKey].map(([key, ats]) => {
    const mats = new Float32Array(ats.length * 16);
    ats.forEach((m, j) => m.toArray(mats, j * 16));
    return { key, n: ats.length, mats, state: 'always' };
  });
  MORE.set(list, more);
  return more;
}

/** A model's lamps while it is staffed: [x, y, z, s] in its metres, s the way its side faces along z (models.js modelLamps). */
const staffed = (b, lamps) => (b.efficiency > 0 ? lamps : []);
/** The tholos's lamp hangs in the open: lit from whichever side the view sees (modelLamps keeps one of the two). */
const THOLOS_LAMP = Object.freeze([Object.freeze([0, 2.05, 0, 1]), Object.freeze([0, 2.05, 0, -1])]);
const FORUM_LAMPS = Object.freeze(FORUM.lamps.map(([x, y, z]) => Object.freeze([x, y, z, 1])));
const GATE_LAMP = Object.freeze([Object.freeze([...WAREHOUSE.lamp, 1])]);

export const COMMERCE_MODELS = Object.freeze({
  market: Object.freeze({
    variant: (b, place) => ({ key: 'market', state: marketState(b), ice: false, more: moreOf(marketWares(b.stock, place.T || 0)) }),
    // (One display stands for all the goods' materials: wareMaterials makes them all with the shell.)
    warm: ['market', 'market:ware:wheat:3', 'market:fish:3'],
    lamps: (b) => staffed(b, THOLOS_LAMP),
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
    variant: (b) => {
      const state = forumState(b);
      return { key: 'forum', state, ice: false, actors: state === 'open' ? FORUM_CAST() : NOBODY };
    },
    warm: ['forum'],
    lamps: (b) => staffed(b, FORUM_LAMPS),
    build: (key, lod) => buildForum({ lod }).group,
  }),
  warehouse: Object.freeze({
    variant: (b, place) => ({ key: 'warehouse', state: warehouseState(b), ice: false, more: moreOf(warehouseLoads(b.stock, place.T || 0)) }),
    warm: ['warehouse', 'warehouse:load:wine'],
    lamps: (b) => staffed(b, GATE_LAMP),
    build(key, lod) {
      const [, kind, good] = key.split(':');
      if (kind === 'load') return goods(buildLoad(good, lod).group, lod);
      wareMaterials();
      return buildWarehouse({ lod }).group;
    },
  }),
});

