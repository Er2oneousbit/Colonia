/**
 * models/civicMonuments.js
 * ----------------------------------------------------------------------------
 * The civic monuments as the game draws them (render3d/models.js MODELS
 * takes these entries as they are): the Great Baths (thermae, models/
 * thermae.js) and the Caravanserai (mansio_magna, models/mansio.js), which
 * look a monument shows and its state, read from the sim's own fields
 * (b.mon: sim/monuments.js), never written.
 *
 * The look (civicLook):
 *   a ghost   (a building being placed: no id, no site record) the finished
 *             monument at work
 *   a site    the stage under way (b.mon.stage) and how far its work has
 *             gone (b.mon.work over the stage's work), in STEPS steps a
 *             stage: a kit a step (`<type>:s<stage>:<step>`), its rising
 *             courses and the site's dressing (models/worksite.js) built
 *             into it, so a site costs one kit, rebuilt a few times a stage;
 *             its crew (actors) at work while a camp's crew is on the site
 *             and it is not halted; a halted site or one with no crew on it
 *             stands still, nobody on it
 *   finished  its own kit (`<type>`, `<type>:ice` in a hard frost), or
 *             `<type>:sacked` while raiders have it sacked; its state:
 *     thermae       'flowing' working (staffed, its store holds timber, on
 *                   piped water), 'still' water but cold (no timber, or too
 *                   few hands: the furnace dark), 'dry' no piped water; the
 *                   woodstore's stacks (`thermae:wood`, `more`) while it
 *                   holds timber
 *     mansio_magna  'open' staffed and fed (its kitchen's smoke, the food on
 *                   the tables), 'out' staffed with an empty larder, 'shut'
 *                   too few hands; its stores' food (`mansio_magna:food`,
 *                   `more`) while it holds any
 * The casts (people/actors.js) by the actors' own state, packed once.
 * ----------------------------------------------------------------------------
 */

import { Matrix4 } from 'three';
import { MONUMENT_TYPES, OPEN_STAFF } from '../../data/monuments.js';
import { cast, NOBODY } from '../people/actors.js';
import { buildThermae, buildThermaeWood, thermaeActors, thermaeSite, THERMAE_LAMPS, THERMAE_STAGES } from './thermae.js';
import { buildMansio, buildMansioFood, mansioActors, mansioSite, MANSIO_LAMPS, MANSIO_STAGES } from './mansio.js';

/** The civic monuments drawn as models. */
export const CIVIC_TYPES = Object.freeze(['thermae', 'mansio_magna']);

/** Steps a stage is drawn in (a kit a step): the courses rise a quarter of a stage at a time. */
export const STEPS = 4;

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3), as models.js reads it. */
const frost = (place) => (place && place.snow) >= 2;

/** Is a camp's crew at work on site `b` now? Asked once a game tick for all sites (a city's buildings walked once). */
const CREW = { game: null, tick: -1, on: new Set() };
export function crewOnSite(b, game) {
  if (!game || !game.buildings) return false;
  const tick = game.time ? game.time.totalTicks : 0;
  if (CREW.game !== game || CREW.tick !== tick) {
    CREW.game = game;
    CREW.tick = tick;
    CREW.on = new Set();
    for (const c of game.buildings.values()) {
      const crew = c.camp && c.camp.crew;
      if (crew && crew.state === 'site') CREW.on.add(crew.site);
    }
  }
  return CREW.on.has(b.id);
}

/**
 * A monument's look from the sim (see the header): { phase: 'ghost' |
 * 'site' | 'done', stage, step, f (the share of the stage shown), halted,
 * crew, sacked }.
 */
export function civicLook(b, game = null) {
  const t = MONUMENT_TYPES[b.def ? b.def.mon : b.type];
  const n = t ? t.stages.length : 1;
  if (b.id === null || b.id === undefined || !b.mon) return { phase: 'ghost', stage: n, step: 0, f: 1, halted: false, crew: false, sacked: false };
  const stage = Math.max(0, Math.min(n, b.mon.stage | 0));
  if (stage >= n) return { phase: 'done', stage: n, step: 0, f: 1, halted: false, crew: false, sacked: !!b.mon.sacked };
  const work = t.stages[stage].work;
  const prog = work > 0 ? Math.max(0, Math.min(1, (b.mon.work || 0) / work)) : 0;
  const step = Math.min(STEPS - 1, Math.floor(prog * STEPS));
  const halted = !!b.mon.halted;
  return { phase: 'site', stage, step, f: (step + 0.5) / STEPS, halted, crew: !halted && crewOnSite(b, game), sacked: false };
}

/** The Great Baths' state for its kit (models.js partShows: flowing, still, dry) and its people's (open, cold, shut). */
export function thermaeState(b) {
  if (b.id === null || b.id === undefined || !b.mon) return { kit: 'flowing', people: 'open', wood: true };
  const water = !!b.hasWater;
  const staffed = b.efficiency >= OPEN_STAFF;
  const wood = (b.mon.store || 0) > 0;
  const sacked = !!b.mon.sacked;
  const kit = !water ? 'dry' : staffed && wood && !sacked ? 'flowing' : 'still';
  const people = sacked || !staffed ? 'shut' : kit === 'flowing' ? 'open' : water ? 'cold' : 'shut';
  return { kit, people, wood };
}

/** The Caravanserai's state (models.js partShows: open, out, shut), the same for its kit and its people; its larder. */
export function mansioState(b) {
  if (b.id === null || b.id === undefined || !b.mon) return { kit: 'open', people: 'open', food: true };
  const staffed = b.efficiency >= OPEN_STAFF;
  const food = (b.mon.store || 0) > 0;
  const s = b.mon.sacked || !staffed ? 'shut' : food ? 'open' : 'out';
  return { kit: s, people: s, food };
}

const I16 = new Matrix4().toArray(new Float32Array(16));
/** A `more` entry of one kit at the building's own frame. */
const one = (key) => Object.freeze([Object.freeze({ key, n: 1, mats: I16, state: 'always' })]);

/** Casts kept by a signature. */
const CASTS = new Map();
function castOf(sig, make) {
  let c = CASTS.get(sig);
  if (!c) {
    const list = make();
    c = list.length ? cast(list) : NOBODY;
    CASTS.set(sig, c);
  }
  return c;
}

/** Lanterns for models.js modelLamps: the panes' middles, facing the street (+z). */
const lampsAt = (list) => Object.freeze(list.map(([x, y, z, s = 1]) => Object.freeze([x, y + 0.11, z, s])));

/**
 * One monument's entry. `kind` its own: the stages, the builders (a site's
 * and a finished one's), the site's dressing, the state, its people, its
 * store's kit and its lamps.
 */
function entry(type, kind) {
  const lamps = lampsAt(kind.lamps);
  return Object.freeze({
    variant: (b, place, ctx) => {
      const game = ctx ? ctx.game : null;
      const look = civicLook(b, game);
      if (look.phase === 'site') {
        const key = `${type}:s${look.stage}:${look.step}`;
        const actors = look.crew ? castOf(`${key}|crew`, () => kind.site(look.stage, look.f).crew) : NOBODY;
        return { key, state: 'always', ice: false, actors };
      }
      const ice = frost(place);
      const st = kind.state(b);
      const key = look.sacked ? `${type}:sacked${ice ? ':ice' : ''}` : `${type}${ice ? ':ice' : ''}`;
      const people = look.sacked ? 'shut' : st.people;
      const actors = castOf(`${type}|${people}|${ice ? 1 : 0}`, () => kind.actors(people, ice));
      const stocked = kind.stocked(st) && !look.sacked;
      return { key, state: st.kit, ice: false, actors, ...(stocked ? { more: kind.more } : {}) };
    },
    // Its finished look and its store's kit (the programs and textures its sites ask for are among them).
    warm: [type, `${type}:s1:2`, kind.more[0].key],
    lamps: (b) => (kind.lit(b) ? lamps : []),
    build(key, lod) {
      const parts = key.split(':');
      if (parts[1] === kind.storeWord) return kind.store({ lod }).group;
      if (parts[1] && parts[1][0] === 's' && parts[1] !== 'sacked') {
        const stage = Number(parts[1].slice(1));
        const step = Number(parts[2]) || 0;
        return kind.build({ lod, stage, f: (step + 0.5) / STEPS }).group;
      }
      return kind.build({ lod, stage: kind.stages, ice: parts.includes('ice'), sacked: parts[1] === 'sacked' }).group;
    },
  });
}

export const CIVIC_MODELS = Object.freeze({
  thermae: entry('thermae', {
    stages: THERMAE_STAGES,
    build: buildThermae,
    site: thermaeSite,
    state: thermaeState,
    actors: thermaeActors,
    stocked: (st) => st.wood,
    storeWord: 'wood',
    store: buildThermaeWood,
    more: one('thermae:wood'),
    lamps: THERMAE_LAMPS,
    lit: (b) => civicLook(b).phase !== 'site' && thermaeState(b).kit === 'flowing' && !(b.mon && b.mon.sacked),
  }),
  mansio_magna: entry('mansio_magna', {
    stages: MANSIO_STAGES,
    build: buildMansio,
    site: mansioSite,
    state: mansioState,
    actors: mansioActors,
    stocked: (st) => st.food,
    storeWord: 'food',
    store: buildMansioFood,
    more: one('mansio_magna:food'),
    lamps: MANSIO_LAMPS,
    lit: (b) => civicLook(b).phase !== 'site' && mansioState(b).kit !== 'shut',
  }),
});
