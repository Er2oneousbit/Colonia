/**
 * models/services.js
 * ----------------------------------------------------------------------------
 * The prefecture and the engineer's post as the game draws them
 * (render3d/models.js MODELS takes these entries as they are): which look
 * a building shows and its state, from the sim's own fields, read only.
 *
 *   prefecture     the watch house (models/prefecture.js): 'out' while any
 *                  of its men are on fire duty (running to a fire or
 *                  fighting one: sim/risk.js fireCrewOut), else 'open'
 *                  staffed or 'shut' not. In a hard frost the pump's water
 *                  freezes ('prefecture:ice').
 *   engineer_post  the builders' yard (models/engineer.js): 'open'
 *                  staffed, 'shut' not.
 *
 * Both light their lantern at night while staffed (models.js modelLamps).
 * ----------------------------------------------------------------------------
 */

import { buildPrefecture, PREFECTURE, PUMP_WATER, prefectureActors } from './prefecture.js';
import { cast } from '../people/actors.js';
import { buildEngineerPost, ENGINEER } from './engineer.js';
import { iceMaterial } from '../materials.js';

/** The watch house's people by state (prefecture.js prefectureActors), packed once each. */
const PREFECTURE_CASTS = {};
const prefectureCast = (state) => (PREFECTURE_CASTS[state] ??= cast(prefectureActors(state)));

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

/**
 * The prefecture's state: 'out' (men at a fire), else 'open' (staffed, all
 * home) or 'shut' (no staff). Out comes first: men already at a fire keep
 * fighting it when the post loses its staff (the sim counts them whatever
 * its efficiency), and the kit they took is not back on the racks.
 */
export function prefectureState(b, game) {
  if (crewOut(game, b) > 0) return 'out';
  return b.efficiency > 0 ? 'open' : 'shut';
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
    variant: (b, place, ctx) => {
      const state = prefectureState(b, ctx && ctx.game);
      return { key: frost(place) ? 'prefecture:ice' : 'prefecture', state, ice: false, actors: prefectureCast(state) };
    },
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
