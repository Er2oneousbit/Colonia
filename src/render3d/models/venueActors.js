/**
 * models/venueActors.js
 * ----------------------------------------------------------------------------
 * The venues' people as actors (people/actors.js): the players on the
 * stage, the musicians, the officials of the games, the magistrate who
 * gives them and the front rows that are real people (the crowd behind
 * them is models/venue.js's kits), by a venue's state and what is on.
 * The fighters, the beasts and the chariots move about their arena and
 * their track, so they are figures of the units' pass (models/venueShow.js).
 *
 * Each list is in its venue's own metres (facing +z), cached by state and
 * acts by the registry (models/venues.js venueCast).
 * ----------------------------------------------------------------------------
 */

import { DYES } from '../people/actors.js';
import { SEAT_H } from '../people/clips.js';
import { togateActor, servantActor } from './domus.js';
import { THEATRUM, THEATRUM_SPOTS } from './theatrum.js';
import { AMPHITHEATRUM_SPOTS } from './amphitheatrum.js';

/** An actor of the stage (all men, as Rome's were): a long bright robe, a mask over the head. */
function player(at, ry, seed, { clip = 'orate', comic = false, colours = {} } = {}) {
  return {
    body: 'm', dress: comic ? ['tunic:short', 'pallium'] : ['tunic:long', 'pallium'], hair: 'curls', at, ry, seed, clip,
    props: { L: comic ? 'personaComic' : 'persona' },
    colours: { tunic: DYES.saffron, mantle: DYES.madder, ...colours },
  };
}

/** The tibicen: the double pipes that accompanied the play, a wreath, a long robe. */
function piper(at, ry, seed) {
  return { body: 'm', dress: ['tunic:long', 'wreath'], hair: 'curls', at, ry, seed, clip: 'flute', props: { R: 'tibiae' }, colours: { tunic: DYES.white, trim: DYES.madder } };
}

/** The theatre's people (models/theatrum.js), by its state and acts. */
export function theaterActors(state, acts = {}) {
  const T = THEATRUM;
  const Y = T.stageY;
  const zs = THEATRUM_SPOTS.stage[2];
  if (state === 'shut') return [];
  if (state === 'out') {
    // A stagehand sweeping the boards, and the doorkeeper at the royal door.
    return [
      servantActor([0.8, Y, zs + 0.1], -Math.PI / 2, 41, { clip: 'sweep', props: { R: 'broom' }, route: { length: 1.6, speed: 0.35, pauseEnd: 3, pauseStart: 3, clipEnd: 'sweep', clipStart: 'sweep' } }),
      servantActor([0, Y, T.frons + 0.45], 0, 42, { clip: 'idle' }),
    ];
  }
  const out = [];
  if (acts.play !== false) {
    // The play: a tragic hero declaiming, a slave of the comedy answering him, the piper at the side.
    out.push(player([-0.55, Y, zs + 0.12], 0.25, 51, { clip: 'orate' }));
    out.push(player([0.7, Y, zs + 0.05], -0.45, 52, { clip: 'talk', comic: true, colours: { tunic: DYES.sky, mantle: DYES.ochre } }));
    out.push(player([1.65, Y, zs - 0.25], -0.6, 53, { clip: 'listen', colours: { tunic: DYES.white, mantle: DYES.woad } }));
    out.push(piper([-2.2, Y, zs - 0.1], 0.6, 54));
  }
  // The decurions in their chairs on the broad step round the orchestra (the bisellia), in the toga.
  // (A seated actor's feet stand SEAT_H under the seat's top: the chairs are that high.)
  THEATRUM_SPOTS.chairs.forEach(([x, y, z, ry], k) => out.push(togateActor([x, y + 0.45 - SEAT_H, z], ry, 60 + k, { clip: 'sit', praetexta: k === 0 })));
  // The editor of the games on the tribunal over the passage, his lictor behind him.
  const [tx, ty, tz, tr] = THEATRUM_SPOTS.tribunal;
  out.push(togateActor([tx, ty + 0.45 - SEAT_H, tz], tr, 70, { clip: 'sit', praetexta: true }));
  out.push({ body: 'm', dress: ['tunic:knee'], hair: 'crop', at: [tx + 0.42, ty, tz - 0.12], ry: tr, seed: 71, clip: 'guard', props: { R: 'fasces' }, colours: { tunic: DYES.madder } });
  return out;
}

/** The summa rudis: the referee of the bouts in his white tunic with its stripes, his staff upright. */
function referee(at, ry, seed) {
  return { body: 'm', dress: ['tunic:knee:broad'], hair: 'bald', beard: 'short', old: true, at, ry, seed, clip: 'guard', props: { R: 'rudis' }, colours: { tunic: DYES.white, trim: DYES.purple } };
}

/** An attendant of the arena (a slave of the games), raking the sand between the shows. */
function raker(at, ry, seed, length = 1.4) {
  return servantActor(at, ry, seed, { clip: 'sweep', props: { R: 'broom' }, route: { length, speed: 0.3, pauseEnd: 4, pauseStart: 4, clipEnd: 'sweep', clipStart: 'sweep' } });
}

/** The amphitheatre's people (models/amphitheatrum.js): the editor in his box, the referee, the musicians; a play's actors on its stage. */
export function amphitheaterActors(state, acts = {}) {
  if (state === 'shut') return [];
  if (state === 'out') return [raker([-1.2, 0.02, -0.6], Math.PI / 2, 81), raker([1.0, 0.02, 0.7], -Math.PI / 2, 82, 1.0)];
  const out = [];
  const [e1, e2] = AMPHITHEATRUM_SPOTS.editor;
  out.push(togateActor(e1, 0, 90, { clip: 'sit', praetexta: true }));
  out.push(togateActor(e2, 0, 91, { clip: 'sit' }));
  if (acts.bouts) {
    // (The bout's middle: models/venueShow.js SHOW_SPOTS; he stands off its circle, watching.)
    out.push(referee([1.55, 0.02, 0.95], Math.PI + 0.9, 92));
    out.push(piper([2.2, 0.02, -0.75], -Math.PI / 2 - 0.4, 93));
  }
  if (acts.play) {
    const [x, y, z] = AMPHITHEATRUM_SPOTS.stage;
    out.push(player([x - 0.05, y, z - 0.35], Math.PI / 2, 94, { clip: 'orate' }));
    out.push(player([x + 0.05, y, z + 0.4], Math.PI / 2 - 0.4, 95, { clip: 'talk', comic: true, colours: { tunic: DYES.sky, mantle: DYES.ochre } }));
  }
  return out;
}
