/**
 * models/training.js
 * ----------------------------------------------------------------------------
 * The training buildings of the shows as the game draws them (render3d/
 * models.js MODELS takes these entries as they are): which look a building
 * shows and its state, from the sim's own fields, read only.
 *
 *   actor_troupe      the Grex (models/grex.js)
 *   gladiator_school  the Ludus Gladiatorius (models/ludusGladiatorius.js)
 *   menagerie         the Vivarium (models/vivarium.js)
 *   chariot_maker     the Factio (models/factio.js)
 *
 * Each is 'shut' with no staff (sim/entertainment.js trains nobody then),
 * 'out' while staffed with one of its performers on the road to a venue (a
 * `performer` walker it sent: sim/entertainment.js updateTraining, his
 * origin this building), else 'open' (training). The sim keeps no count of
 * the beasts a menagerie holds, so its beasts are always in their cages;
 * the one on its way to the arena is gone from its cage while 'out'. A
 * build ghost (no walkers) shows each training. In a hard frost (snow 2 or
 * 3) a menagerie's and a stable's troughs freeze (their `:ice` looks).
 * Their people and beasts are actors (people/actors.js: each model's
 * *Actors(state), packed once a state); the stable's colours are its
 * faction's (one of the four, by the building's id).
 * ----------------------------------------------------------------------------
 */

import { cast } from '../people/actors.js';
import { buildGrex, GREX, grexActors } from './grex.js';

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3), as models.js reads it. */
const frost = (place) => (place.snow || 0) >= 2;

/** Has this building a performer of its own on the road (a walker it sent to a venue)? */
export function performerOut(b, game) {
  if (!b.walkers || !b.walkers.length || !game || !game.walkers) return false;
  for (const id of b.walkers) {
    const w = game.walkers.get(id);
    if (w && w.type === 'performer') return true;
  }
  return false;
}

/** A training building's state: 'shut' unstaffed, 'out' staffed with a performer on the road, else 'open'. */
export function trainingState(b, game) {
  if (!(b.efficiency > 0)) return 'shut';
  return performerOut(b, game) ? 'out' : 'open';
}

/** Lanterns for models.js modelLamps: the panes' middles, each facing the way it is given (+1 the street, +z). */
const lampsAt = (list) => Object.freeze(list.map(([x, y, z, s = 1]) => Object.freeze([x, y + 0.11, z, s])));

/**
 * One entry: its looks by key (`key(b, place)`), its state, its lamps while
 * staffed; `actors(state, b)` its people as actors, packed once a state (and
 * whatever else `castKey` says they depend on).
 */
function entry({ type, build, lamps, actors, keyOf = () => type, castKey = (state) => state, warm = [type] }) {
  const lit = lampsAt(lamps);
  const casts = new Map();
  const castOf = (state, b) => {
    const k = castKey(state, b);
    let c = casts.get(k);
    if (!c) {
      c = cast(actors(state, b));
      casts.set(k, c);
    }
    return c;
  };
  return Object.freeze({
    variant: (b, place, ctx) => {
      const state = trainingState(b, ctx && ctx.game);
      const ice = frost(place || {});
      return { key: keyOf(b, ice), state, ice, actors: castOf(state, b) };
    },
    warm,
    lamps: (b) => (b.efficiency > 0 ? lit : []),
    build: (key, lod) => build(key, lod).group,
  });
}

/** Each type's people by its state (and its building: a stable's faction), as specs (the lab's crowd packs them itself). */
const ACTORS = {
  actor_troupe: grexActors,
};

/** A training building's actors' specs in `state` (people/actors.js). */
export function trainingActors(type, state, b) {
  return ACTORS[type](state, b);
}

export const TRAINING_MODELS = Object.freeze({
  actor_troupe: entry({ type: 'actor_troupe', build: (key, lod) => buildGrex({ lod }), lamps: GREX.lamps, actors: grexActors }),
});
