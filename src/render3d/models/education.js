/**
 * models/education.js
 * ----------------------------------------------------------------------------
 * The school, the library and the academy as the game draws them
 * (render3d/models.js MODELS takes these entries as they are): which look a
 * building shows and its state, from the sim's own fields, read only.
 *
 *   school   the ludus litterarius (models/ludus.js)
 *   library  the bibliotheca (models/bibliotheca.js)
 *   academy  the academia (models/academia.js)
 *
 * Each is 'open' while staffed (people at their lessons and books, doors
 * and cupboards open, the lanterns lit at night), 'shut' with no staff
 * (empty, shut up). Their walkers out on their rounds (a teacher, a
 * librarian, a scholar) change nothing: the building is still at work.
 * A build ghost shows each open.
 * ----------------------------------------------------------------------------
 */

import { buildSchool, LUDUS, schoolActors } from './ludus.js';
import { cast, NOBODY } from '../people/actors.js';
import { buildLibrary, BIBLIOTHECA, libraryActors } from './bibliotheca.js';
import { buildAcademia, ACADEMIA, academiaActors } from './academia.js';

/** A school's, a library's or an academy's state: 'open' staffed, 'shut' not. */
export function educationState(b) {
  return b.efficiency > 0 ? 'open' : 'shut';
}

/** Lamps for models.js modelLamps: the lanterns' panes, each facing the way it is given (+1 the street, +z). */
const lampsAt = (list) => Object.freeze(list.map(([x, y, z, s = 1]) => Object.freeze([x, y + 0.11, z, s])));

/**
 * One entry: a look, its state, its lamps while staffed; `actors(state)` its
 * people as actors (people/actors.js), packed once a state.
 */
function entry(type, build, lamps, actors = null) {
  const lit = lampsAt(lamps);
  const casts = {};
  const castOf = (state) => (casts[state] ??= actors ? cast(actors(state)) : NOBODY);
  return Object.freeze({
    variant: (b) => {
      const state = educationState(b);
      return { key: type, state, ice: false, actors: castOf(state) };
    },
    warm: [type],
    lamps: (b) => (b.efficiency > 0 ? lit : []),
    build: (key, lod) => build({ lod }).group,
  });
}

export const EDUCATION_MODELS = Object.freeze({
  school: entry('school', buildSchool, [LUDUS.lamp], schoolActors),
  library: entry('library', buildLibrary, BIBLIOTHECA.lamps, libraryActors),
  academy: entry('academy', buildAcademia, ACADEMIA.lamps, academiaActors),
});
