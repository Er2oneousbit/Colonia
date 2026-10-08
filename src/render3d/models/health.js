/**
 * models/health.js
 * ----------------------------------------------------------------------------
 * The barber, the physician, the baths and the hospital as the game draws
 * them (render3d/models.js MODELS takes these entries as they are): which
 * look a building shows and its state, from the sim's own fields, read only.
 *
 *   barber    the tonstrina (models/tonstrina.js)
 *   clinic    the medicus's consulting room (models/medicus.js)
 *   baths     the balneum (models/balneum.js)
 *   hospital  the valetudinarium (models/valetudinarium.js)
 *
 * The barber, the physician and the hospital are 'open' while staffed
 * (people at work, doors open, lanterns lit at night), 'shut' with no staff;
 * their walkers out on their rounds change nothing. The baths run on piped
 * water as the fountain does (its states, from the sim's hasWater
 * and staff, as the 2D sprite shows it): 'flowing' (the fire in, bathers,
 * the spout running), 'still' (water, nobody), 'dry' (no water: the sim
 * sends no bather out, sim/services.js); in a hard frost (snow 2 or 3) their
 * pool's water is ice and, while they work, steam rises from the dome, the
 * window and the vents. A build ghost shows each at work (the baths dry
 * where no pipe reaches). Their people are actors (people/actors.js: each
 * model's *Actors(state), the baths' by their frost too), packed once.
 * ----------------------------------------------------------------------------
 */

import { buildTonstrina, TONSTRINA, tonstrinaActors } from './tonstrina.js';
import { buildMedicus, MEDICUS, medicusActors } from './medicus.js';
import { buildBalneum, BALNEUM, balneumActors } from './balneum.js';
import { buildValetudinarium, VALETUDINARIUM, valetudinariumActors } from './valetudinarium.js';
import { cast } from '../people/actors.js';

/** A barber's, a physician's or a hospital's state: 'open' staffed, 'shut' not. */
export function healthState(b) {
  return b.efficiency > 0 ? 'open' : 'shut';
}

/**
 * The baths' state: 'flowing' with water and staff, 'still' with water
 * alone, 'dry' without (the fountain's states and tags: models.js
 * fountainState, partShows).
 */
export function bathsState(b) {
  if (!b.hasWater) return 'dry';
  return b.efficiency > 0 ? 'flowing' : 'still';
}

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3), as models.js reads it. */
const frost = (place) => (place.snow || 0) >= 2;

/** Lanterns for models.js modelLamps: the panes' middles, each facing the way it is given (+1 the street, +z). */
const lampsAt = (list) => Object.freeze(list.map(([x, y, z, s = 1]) => Object.freeze([x, y + 0.11, z, s])));

/**
 * One entry for a building open or shut by its staff; `actors(state)` its
 * people as actors (people/actors.js), packed once a state.
 */
function staffed(type, build, lamps, actors) {
  const lit = lampsAt(lamps);
  const casts = {};
  const castOf = (state) => (casts[state] ??= cast(actors(state)));
  return Object.freeze({
    variant: (b) => {
      const state = healthState(b);
      return { key: type, state, ice: false, actors: castOf(state) };
    },
    warm: [type],
    lamps: (b) => (b.efficiency > 0 ? lit : []),
    build: (key, lod) => build({ lod }).group,
  });
}

/** The baths' people by their state and frost (models/balneum.js balneumActors: nobody stands in a frozen pool), packed once. */
const BATHS_CASTS = {};
const bathsCast = (state, ice) => (BATHS_CASTS[`${state}${ice ? ':ice' : ''}`] ??= cast(balneumActors(state, ice)));

/** The baths' lanterns at the gate, and the caldarium's window (facing +x: s 0, sx 1), lit while they work. */
const BATH_LAMPS = Object.freeze([...lampsAt(BALNEUM.lamps), Object.freeze([...BALNEUM.window, 0, 1])]);

export const HEALTH_MODELS = Object.freeze({
  barber: staffed('barber', buildTonstrina, [TONSTRINA.lamp], tonstrinaActors),
  clinic: staffed('clinic', buildMedicus, [MEDICUS.lamp], medicusActors),
  hospital: staffed('hospital', buildValetudinarium, VALETUDINARIUM.lamps, valetudinariumActors),
  baths: Object.freeze({
    // (The frozen look's ice is the water's program: warming the one look compiles both.)
    warm: ['baths'],
    variant: (b, place) => {
      const ice = frost(place);
      const state = bathsState(b);
      return { key: ice ? 'baths:ice' : 'baths', state, ice, actors: bathsCast(state, ice) };
    },
    lamps: (b) => (bathsState(b) === 'flowing' ? BATH_LAMPS : []),
    build: (key, lod) => buildBalneum({ lod, ice: key.endsWith(':ice') }).group,
  }),
});
