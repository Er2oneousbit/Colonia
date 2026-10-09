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
import { ARENA_SPOTS } from './arena.js';
import { SHOW_SPOTS } from './venueShow.js';
import { CIRCUS_SPOTS, CIRCUS } from './circus.js';

/** An actor of the stage (all men, as Rome's were): a long bright robe, a mask over the head. */
function player(at, ry, seed, { clip = 'orate', comic = false, colours = {} } = {}) {
  return {
    body: 'm', dress: comic ? ['tunic:short', 'pallium'] : ['tunic:long', 'pallium'], hair: 'curls', at, ry, seed, clip,
    props: { L: comic ? 'sprop:comic' : 'sprop:tragic' },
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
    // (The comic mask's face is the trim colour: a slave's ruddy face.)
    out.push(player([0.7, Y, zs + 0.05], -0.45, 52, { clip: 'talk', comic: true, colours: { tunic: DYES.sky, mantle: DYES.ochre, trim: 0xb07a52 } }));
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
  return { body: 'm', dress: ['tunic:knee:broad'], hair: 'bald', beard: 'short', old: true, at, ry, seed, clip: 'guard', props: { R: 'sprop:virga' }, colours: { tunic: DYES.white, trim: DYES.purple } };
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
    out.push(player([x + 0.05, y, z + 0.4], Math.PI / 2 - 0.4, 95, { clip: 'talk', comic: true, colours: { tunic: DYES.sky, mantle: DYES.ochre, trim: 0xb07a52 } }));
  }
  return out;
}

/** The Great Arena's people (models/arena.js): the governor and his guests in the box, the editor across, a referee by each bout, the musicians. */
export function colosseumActors(state, acts = {}) {
  if (state === 'shut') return [];
  if (state === 'out') return [raker([-2.4, 0.02, -0.9], Math.PI / 2, 101, 1.8), raker([1.4, 0.02, 1.0], -Math.PI / 2, 102, 1.5), raker([0.2, 0.02, -1.4], Math.PI / 2, 103, 1.2)];
  const out = [];
  // The governor in the middle in the purple-bordered toga, his guests either side.
  ARENA_SPOTS.governor.forEach(([x, y, z, ry], k) => out.push(togateActor([x, y + 0.45 - SEAT_H, z], ry, 110 + k, { clip: 'sit', praetexta: k === 1 })));
  ARENA_SPOTS.editor.forEach(([x, y, z, ry], k) => out.push(togateActor([x, y + 0.45 - SEAT_H, z], ry, 120 + k, { clip: 'sit', praetexta: k === 0 })));
  if (acts.bouts) {
    // A referee off each bout's circle, turned to it (clear of the hunt's on the other side).
    [[-2.4, -0.75], [-1.3, -1.6]].forEach(([x, z], k) => {
      const [cx, cz] = SHOW_SPOTS.colosseum.bouts[k];
      out.push(referee([x, 0.02, z], Math.atan2(cx - x, cz - z), 130 + k));
    });
    out.push(piper([-3.2, 0.02, -1.0], Math.PI / 4, 135));
    out.push(piper([-3.35, 0.02, -0.55], Math.PI / 3, 136));
  }
  return out;
}

/** A section's own metres from the circus's track metres (models/circus.js). */
const inSection = (k, [X, y, z]) => [X - (k * 20 + 10), y, z];

/**
 * The hippodrome's people by section (models/circus.js): in the middle the
 * governor and his guests in their box and the two attendants who counted
 * the laps at the eggs and the dolphins; at the gates the magistrate in his
 * box, his arm up with the white cloth that started the race; attendants
 * raking the sand when no race is on.
 */
export function hippodromeActors(state, acts = {}, k = 0) {
  if (state === 'shut') return [];
  if (state === 'out') return [raker([-3, 0.02, 3.2], Math.PI / 2, 140 + k, 2.4), raker([2, 0.02, -3.4], -Math.PI / 2, 143 + k, 2.0)];
  const out = [];
  if (k === 1) {
    CIRCUS_SPOTS.governor.forEach((g, j) => {
      const [x, y, z] = inSection(1, g);
      out.push(togateActor([x, y + 0.45 - SEAT_H, z], 0, 150 + j, { clip: 'sit', praetexta: j === 1 }));
    });
    // The lap counters on the spina, by their frames, watching the cars.
    CIRCUS_SPOTS.counters.forEach((c, j) => {
      const [x, y, z] = inSection(1, c);
      // (Beside the frame, not under it: on the spina's coping a pace along.)
      out.push(servantActor([x + (j ? -1.55 : 1.55), y + 0.06, z * 0.5], j ? Math.PI : 0, 155 + j, { clip: 'cheer' }));
    });
  }
  if (k === 2) {
    const [X, y, z, ry] = CIRCUS_SPOTS.magistrate;
    const [x] = inSection(2, [X, y, z]);
    out.push(togateActor([x, y, z], ry, 160, { clip: 'orate', praetexta: true }));
    out.push(togateActor([x + 0.15, y, z + 0.7], ry, 161, { clip: 'listen' }));
  }
  if (k === 0 && acts.races) {
    // A trumpeter on the arch's top? None: the arch's attic is too small; a groom waits by the end's lampstand instead.
    out.push(servantActor([CIRCUS.curveX - 10 + 2.2, 0.02, 4.9], Math.PI, 165, { clip: 'cheer' }));
  }
  return out;
}
