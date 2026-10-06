/**
 * models/services.js
 * ----------------------------------------------------------------------------
 * The prefecture and the engineer's post as the game draws them
 * (render3d/models.js MODELS takes these entries as they are): which look
 * a building shows and its state, from the sim's own fields, read only.
 *
 *   prefecture     the watch house (models/prefecture.js): 'shut' with no
 *                  staff; staffed, 'out' while any of its men are on fire
 *                  duty (running to a fire or fighting one: sim/risk.js
 *                  fireCrewOut), else 'open'. In a hard frost the pump's
 *                  water freezes ('prefecture:ice').
 *   engineer_post  the builders' yard (models/engineer.js): 'open'
 *                  staffed, 'shut' not.
 *
 * Both light their lantern at night while staffed (models.js modelLamps).
 * ----------------------------------------------------------------------------
 */

import { buildPrefecture, PREFECTURE, PUMP_WATER } from './prefecture.js';
import { buildEngineerPost, ENGINEER } from './engineer.js';
import { iceMaterial } from '../materials.js';

/**
 * How many of a prefecture's men are on fire duty: running to a fire or at
 * one. The same count the sim makes when it decides whether the prefecture
 * can send another (sim/risk.js fireCrewOut), read here without touching
 * the sim: its walkers (b.walkers, ids into game.walkers) by their state.
 */
export function crewOut(game, b) {
  if (!game || !game.walkers || !b.walkers) return 0;
  let n = 0;
  for (const id of b.walkers) {
    const w = game.walkers.get(id);
    if (w && (w.state === 'toFire' || w.state === 'extinguish')) n++;
  }
  return n;
}

/** The prefecture's state: 'shut' (no staff), 'out' (staffed, men at a fire), 'open' (staffed, all home). */
export function prefectureState(b, game) {
  if (!(b.efficiency > 0)) return 'shut';
  return crewOut(game, b) > 0 ? 'out' : 'open';
}

/** The engineer's post's state: 'open' staffed, 'shut' not. */
export function engineerState(b) {
  return b.efficiency > 0 ? 'open' : 'shut';
}

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3), as models.js reads it. */
const frost = (place) => ((place && place.snow) || 0) >= 2;

/** A lamp's point for models.js modelLamps: the lantern's panes, facing the front (+z). */
const lampAt = ([x, y, z]) => Object.freeze([Object.freeze([x, y + 0.11, z, 1])]);
const PREFECTURE_LAMP = lampAt(PREFECTURE.lamp);
const ENGINEER_LAMP = lampAt(ENGINEER.lamp);

export const SERVICE_MODELS = Object.freeze({
  prefecture: Object.freeze({
    // (A ghost has no id and no walkers: it shows the watch house staffed, its crew at home.)
    variant: (b, place, ctx) => ({ key: frost(place) ? 'prefecture:ice' : 'prefecture', state: prefectureState(b, ctx && ctx.game), ice: false }),
    warm: ['prefecture'],
    lamps: (b) => (b.efficiency > 0 ? PREFECTURE_LAMP : []),
    build(key, lod) {
      const m = buildPrefecture({ lod });
      if (key.endsWith(':ice')) for (const mesh of m.meshes) if (mesh.name === PUMP_WATER) mesh.material = iceMaterial();
      return m.group;
    },
  }),
  engineer_post: Object.freeze({
    variant: (b) => ({ key: 'engineer_post', state: engineerState(b), ice: false }),
    warm: ['engineer_post'],
    lamps: (b) => (b.efficiency > 0 ? ENGINEER_LAMP : []),
    build: (key, lod) => buildEngineerPost({ lod }).group,
  }),
});
