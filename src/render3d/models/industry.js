/**
 * models/industry.js
 * ----------------------------------------------------------------------------
 * The four raw producers as the game draws them (render3d/models.js MODELS
 * takes these entries as they are): which look a building shows, its state
 * and its stock, from the sim's own fields, read only.
 *
 *   clay_pit       the clay pit (models/clayPit.js)
 *   timber_yard    the felling yard and saw pit (models/timberYard.js)
 *   iron_mine      the adit, windlass and bloomery (models/ironMine.js)
 *   marble_quarry  the quarry face and shear legs (models/marbleQuarry.js)
 *
 * State, as the engineer's post has it: 'open' while it is staffed
 * (efficiency above 0: the lantern lit, its people at work, the furnace
 * smoking), 'shut' when not. The sim's producers also stop when their
 * store is full (CONFIG.PRODUCER_MAX_STOCK), but the sprites showed no
 * difference there either, and a yard that stands idle with its men
 * waiting for the carts is a state the city should not read as a closed one.
 *
 * Stock: the producer's own good (b.stock[good], up to the cap) as a step
 * of 0 to 3 (none, a third, two thirds, full; industryKit.js stockStep),
 * drawn as a kit of its own for each step ('<type>:stock:<step>', the
 * market's way: a kit and a matrix in models.js `more`), so a store filling
 * rebuilds nothing.
 *
 * A hard frost (the sprites' deep snow) freezes the standing water of the
 * clay pit's floor and the quarry's trough ('<type>:ice').
 *
 * Every one lights its lantern at night while staffed (models.js modelLamps).
 * ----------------------------------------------------------------------------
 */

import { Matrix4 } from 'three';
import { CONFIG } from '../../config.js';
import { cast } from '../people/actors.js';
import { stockStep, lampPoints } from './industryKit.js';
import { buildClayPit, buildClayStock, clayPitActors, CLAY_PIT } from './clayPit.js';
import { buildTimberYard, buildTimberStock, timberYardActors, TIMBER_YARD } from './timberYard.js';
import { buildIronMine, buildOreStock, ironMineActors, IRON_MINE } from './ironMine.js';
import { WORKSHOP_MODELS } from './workshops.js';
import { buildMarbleQuarry, buildQuarryStock, marbleQuarryActors, MARBLE_QUARRY } from './marbleQuarry.js';

/** A raw producer's state: 'open' staffed, 'shut' not. */
export function industryState(b) {
  return b.efficiency > 0 ? 'open' : 'shut';
}

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3), as models.js reads it. */
const frost = (place) => ((place && place.snow) || 0) >= 2;

const IDENTITY = new Float32Array(new Matrix4().elements);

/** A kit and the one matrix it is drawn at, as a models.js `more` entry. */
const part = (key, mats = IDENTITY) => Object.freeze({ key, n: 1, mats, state: 'always' });

/** The smoke of the bloomery as a temples' smoke kit ('sacra:smoke:thin') over the furnace's top. */
const FURNACE_SMOKE = part('sacra:smoke:thin', new Float32Array(new Matrix4().makeTranslation(IRON_MINE.furnace.x, IRON_MINE.furnace.top, IRON_MINE.furnace.z).elements));

/**
 * The entry of one producer.
 *   type, good   its building type and the good it holds
 *   build        (key, lod) -> Group: the key's own look, or the stock's
 *   actors       (state) -> actor specs
 *   lamp         [x, y, z] of its lantern's base
 *   warm         the looks to build before the first draw
 *   ice          has standing water that freezes
 *   smoke        a kit added while staffed
 */
function producer({ type, good, buildBody, buildStock, actors, lamp, ice = false, smoke = null }) {
  const casts = {};
  const castOf = (state) => (casts[state] ??= cast(actors(state)));
  // The `more` of each (step, smoking) pair, made once.
  const mores = {};
  const moreOf = (step, smoking) => {
    const k = step * 2 + (smoking ? 1 : 0);
    return (mores[k] ??= Object.freeze([...(step ? [part(`${type}:stock:${step}`)] : []), ...(smoking && smoke ? [smoke] : [])]));
  };
  const lamps = lampPoints(lamp);
  return Object.freeze({
    warm: [type, `${type}:stock:3`, ...(smoke ? [smoke.key] : [])],
    lamps: (b) => (b.efficiency > 0 ? lamps : []),
    variant(b, place) {
      const state = industryState(b);
      // (A ghost has no id and no stock: the producer as it will stand, staffed and empty, its people not drawn.)
      const ghost = b.id === null || b.id === undefined;
      const step = ghost ? 0 : stockStep(b.stock && b.stock[good], CONFIG.PRODUCER_MAX_STOCK);
      const key = ice && frost(place) ? `${type}:ice` : type;
      return { key, state, ice: false, actors: castOf(state), more: moreOf(step, !ghost && state === 'open') };
    },
    build(key, lod) {
      const [, what, step] = key.split(':');
      if (what === 'stock') return buildStock(Number(step), { lod }).group;
      return buildBody({ lod, ice: what === 'ice' }).group;
    },
  });
}

export const INDUSTRY_MODELS = Object.freeze({
  clay_pit: producer({ type: 'clay_pit', good: 'clay', buildBody: buildClayPit, buildStock: buildClayStock, actors: clayPitActors, lamp: [CLAY_PIT.lamp[0] + 0.14, CLAY_PIT.lamp[1], CLAY_PIT.lamp[2]], ice: true }),
  timber_yard: producer({ type: 'timber_yard', good: 'timber', buildBody: buildTimberYard, buildStock: buildTimberStock, actors: timberYardActors, lamp: TIMBER_YARD.lamp }),
  iron_mine: producer({ type: 'iron_mine', good: 'iron', buildBody: buildIronMine, buildStock: buildOreStock, actors: ironMineActors, lamp: IRON_MINE.lamp, smoke: FURNACE_SMOKE }),
  marble_quarry: producer({ type: 'marble_quarry', good: 'marble', buildBody: buildMarbleQuarry, buildStock: buildQuarryStock, actors: marbleQuarryActors, lamp: [MARBLE_QUARRY.lamp[0], MARBLE_QUARRY.lamp[1] - 0.04, MARBLE_QUARRY.lamp[2]], ice: true }),
  // The eight workshops (models/workshops.js).
  ...WORKSHOP_MODELS,
});
