/**
 * models/venues.js
 * ----------------------------------------------------------------------------
 * The entertainment venues as the game draws them (render3d/models.js
 * MODELS takes these entries as they are): which look a venue shows and its
 * state, from the sim's own fields, read only.
 *
 *   theater          the theatre (models/theatrum.js)
 *   amphitheater     the amphitheatre (models/amphitheatrum.js)
 *   colosseum        the Great Arena (models/arena.js)
 *   hippodrome       the Circus's first section, the rounded end (models/circus.js)
 *   hippodrome_part  its other two sections: the middle and the starting gates
 *
 * States (models.js partShows tags):
 *   'open'  a show on: staffed with shows booked (sim/services.js
 *           venueActive, the same test that sends its entertainers out):
 *           the crowd in the seats, the performers, the velarium spread, the
 *           torches lit
 *   'out'   staffed, nothing booked: the gates open, an attendant at work
 *   'shut'  no staff: the gates shut, nobody
 * A hippodrome's sections take their state from the hippodrome (its main
 * section: sim/entities.js mainOf). A build ghost shows a venue staffed and
 * empty ('out').
 *
 * What is on (venueActs): a play (actors from a Grex), bouts (gladiators
 * from a Ludus), a hunt (beasts from a Vivarium), races (teams from a
 * Factio), by the venue's `shows` booked: an amphitheatre with both a play
 * and bouts shows both, a Great Arena both bouts and a hunt.
 *
 * The crowd (`more`: models/venue.js crowd groups, instanced across every
 * venue in view) fills as many of the seats as the city can fill: the
 * people over the seats of every working venue of the kind (VENUE_SEATS),
 * a fifth at a time; the hippodrome by the city's size alone (it seats
 * everyone). It rises and sits with the show (crowdMore), by the game's
 * clock: paused, it holds still.
 * ----------------------------------------------------------------------------
 */

import { Matrix4, Group } from 'three';
import { VENUE_SEATS, SHOW_KINDS } from '../../data/buildings.js';
import { cast, NOBODY, DYES, hash01 } from '../people/actors.js';
import { buildCrowdGroup, CROWD_VARIANTS } from './venue.js';
import { buildTheatrum, theatrumSeats, THEATRUM_LAMPS } from './theatrum.js';
import { buildAmphitheatrum, buildAmphitheatrumStage, amphitheatrumSeats, AMPHITHEATRUM_LAMPS } from './amphitheatrum.js';
import { buildArena, buildArenaBay, arenaSeats, ARENA_LAMPS, ARENA_BAYS } from './arena.js';
import { buildCircus, buildLapCounter, circusSeats, circusLamps, LAP_PLACES } from './circus.js';
import { lapsNow, leaderU } from './venueShow.js';
import { theaterActors, amphitheaterActors, colosseumActors, hippodromeActors } from './venueActors.js';

/** The venue types drawn as models. */
export const VENUE_TYPES = Object.freeze(['theater', 'amphitheater', 'colosseum', 'hippodrome', 'hippodrome_part']);

/** The game a venue was last drawn in (lamps are asked of the building alone: modelLamps). */
let lastGame = null;

/** The building that holds a venue's state: a hippodrome's main section for its parts, else itself. */
export function venueOf(b, game) {
  if (b && b.main && game && game.buildings) return game.buildings.get(b.main) || b;
  return b;
}

/** A show on at venue `b` (shows booked: sim/services.js venueActive's test). */
function booked(b) {
  return !!b.shows && SHOW_KINDS.some((k) => b.shows[k] > 0);
}

/** A venue's state: 'shut' unstaffed, 'open' staffed with shows booked, else 'out'; a ghost (no id) 'out'. */
export function venueState(b, game = null) {
  const v = venueOf(b, game);
  if (v.id === null || v.id === undefined) return 'out';
  if (!(v.efficiency > 0)) return 'shut';
  return booked(v) ? 'open' : 'out';
}

/** What is on at a venue (its `shows` booked): { play, bouts, hunt, races }. */
export function venueActs(b, game = null) {
  const s = venueOf(b, game).shows || {};
  return { play: s.theater > 0, bouts: s.amphitheater > 0, hunt: s.colosseum > 0, races: s.hippodrome > 0 };
}

/** The acts as a short key ('p', 'b', 'h', 'r' in that order). */
export function actsKey(a) {
  return `${a.play ? 'p' : ''}${a.bouts ? 'b' : ''}${a.hunt ? 'h' : ''}${a.races ? 'r' : ''}`;
}

/** People one hippodrome's stands fill (render-only: the sim seats the whole city in it). */
export const CIRCUS_FILL = 3000;
/** The crowd comes and goes a fifth of the seats at a time. */
const FILL_STEPS = 5;

/** The share of a venue's seats taken, 1 to FILL_STEPS fifths (0 with no show), kept per game by its tick. */
const FILL = { game: null, tick: -1, by: {} };
export function venueFill(game, type) {
  if (!game || !game.city || !game.buildings) return FILL_STEPS;
  const tick = game.time ? game.time.totalTicks : 0;
  if (FILL.game !== game || FILL.tick !== tick) {
    FILL.game = game;
    FILL.tick = tick;
    FILL.by = {};
  }
  if (FILL.by[type] !== undefined) return FILL.by[type];
  const pop = game.city.population || 0;
  let seats = 0;
  if (type === 'hippodrome') seats = CIRCUS_FILL;
  else {
    for (const b of game.buildings.values()) if (b.type === type && b.efficiency > 0 && booked(b)) seats += VENUE_SEATS[type] || 0;
  }
  const share = seats > 0 ? Math.min(1, pop / seats) : 1;
  const n = Math.max(1, Math.min(FILL_STEPS, Math.ceil(share * FILL_STEPS)));
  FILL.by[type] = n;
  return n;
}

/** The game's clock in ticks (a show's people move by it: paused, they hold), from the pass or a lab's stand-in. */
export function showTick(ctx) {
  if (!ctx) return 0;
  if (ctx.tick !== undefined) return ctx.tick;
  const g = ctx.game;
  return g && g.time ? g.time.totalTicks : 0;
}

// ---------------------------------------------------------------------------
// The crowd
// ---------------------------------------------------------------------------

/** Each venue's seats (in its own metres): [[x, y, z, ry, band, rise], ...], made once. */
const SEATS = new Map();
function seatsOf(type, section = 0) {
  const key = `${type}:${section}`;
  let s = SEATS.get(key);
  if (!s) {
    s = type === 'theater' ? theatrumSeats() : type === 'amphitheater' ? amphitheatrumSeats() : type === 'colosseum' ? arenaSeats() : type === 'hippodrome' ? circusSeats(section) : [];
    SEATS.set(key, s);
  }
  return s;
}

/** Ticks a crowd's mood holds before it may change (a quarter of a second at 1x). */
const BEAT_TICKS = 2;
/** Moods a crowd cycles through (kept lists: one a beat of the cycle). */
const MOODS = 16;

/**
 * Is the group at seat `i` (`s` its seat) on its feet in mood `m`? A theatre
 * applauds now and then; an arena's crowd jumps up as the blows land.
 */
function standing(type, i, s, m, section) {
  const h = hash01(i, m, 7);
  if (type === 'theater') return m >= 13 ? h < 0.55 : h < 0.04;
  // The circus: on their feet where the chariots are passing (m: the leader's place, half tiles along the track).
  if (type === 'hippodrome') {
    const U = (s[0] + 10 + section * 20) / 4;
    return Math.abs(U - m / 2) < 1.8 ? hash01(i, 9) < 0.55 : h < 0.05;
  }
  // A wave of excitement round the arena, and some on their feet all the time.
  const th = Math.atan2(s[2], s[0]);
  const wave = Math.sin(th * 2 - (m / MOODS) * Math.PI * 4);
  return h < 0.05 + Math.max(0, wave) ** 3 * 0.35;
}

/**
 * The crowd's `more` list for a venue of `type` (`section` of a
 * hippodrome) with `fill` fifths of its seats taken, in mood `m`: each
 * kind of group (pose, band, variant) one entry with the matrices of its
 * seats. Kept by signature: a city's venues share the lists.
 */
const CROWDS = new Map();
export function crowdMore(type, section, fill, m) {
  const sig = `${type}|${section}|${fill}|${m}`;
  let list = CROWDS.get(sig);
  if (list) return list;
  const by = new Map();
  const mat = new Matrix4();
  seatsOf(type, section).forEach((s, i) => {
    // Filled in from the front (the best seats go first) by the seat's own number.
    if (hash01(i, 3) * FILL_STEPS >= fill) return;
    const pose = standing(type, i, s, m, section) ? 'up' : 'sit';
    const variant = Math.floor(hash01(i, 5) * CROWD_VARIANTS) % CROWD_VARIANTS;
    // (One kit for every venue's rows: their steps differ by a few centimetres, too little to see in a
    // seated man's shins, and a kit a step was three times the crowd's draw calls.)
    const key = `crowd:${pose}:${s[4]}:${variant}`;
    let e = by.get(key);
    if (!e) {
      e = [];
      by.set(key, e);
    }
    mat.makeRotationY(s[3]).setPosition(s[0], s[1], s[2]);
    e.push(...mat.elements);
  });
  list = Object.freeze([...by.entries()].map(([key, f]) => Object.freeze({ key, n: f.length / 16, mats: new Float32Array(f), state: 'always' })));
  CROWDS.set(sig, list);
  return list;
}

/** No crowd: one list for every venue without a show (the lists joined to it are kept by it: a new one a frame grew them without end). */
const NO_CROWD = Object.freeze([]);

/** A venue's crowd now: none unless a show is on; its mood by the game's clock. */
function crowdNow(type, section, state, game, ctx) {
  if (state !== 'open') return NO_CROWD;
  const tick = showTick(ctx);
  const m = type === 'hippodrome' ? Math.round(leaderU(tick) * 2) : Math.floor(tick / BEAT_TICKS) % MOODS;
  return crowdMore(type, section, venueFill(game, type), m);
}

// ---------------------------------------------------------------------------
// The people
// ---------------------------------------------------------------------------

const ACTORS = { theater: theaterActors, amphitheater: amphitheaterActors, colosseum: colosseumActors, hippodrome: hippodromeActors };
const CASTS = new Map();
/** A venue's people by its state and its acts (models/venueActors.js), packed once. */
export function venueCast(type, state, acts, section = 0) {
  const sig = `${type}|${section}|${state}|${actsKey(acts)}`;
  let c = CASTS.get(sig);
  if (!c) {
    const list = ACTORS[type] ? ACTORS[type](state, acts, section) : [];
    c = list.length ? cast(list) : NOBODY;
    CASTS.set(sig, c);
  }
  return c;
}

// ---------------------------------------------------------------------------
// The entries
// ---------------------------------------------------------------------------

const I16 = new Matrix4().toArray(new Float32Array(16));
/** Kits a venue shows with what is on: the amphitheatre's stage of boards for a play. */
const EXTRA = {
  amphitheater: (acts) => (acts.play ? [Object.freeze({ key: 'amphitheater:stage', n: 1, mats: I16, state: 'always' })] : []),
};
/** Kits a venue always shows, instanced apart: the Great Arena's façade, a kit a kind of bay (models/arena.js). */
const BASE = { colosseum: ARENA_BAYS };
/**
 * A venue's `more`: its own kits (BASE), its crowd and the kits of what is
 * on, the list kept by signature and made again only when the crowd's
 * list changes (a beat of the show), never a frame.
 */
const MORE = new Map();
function moreOf(type, section, state, acts, game, ctx) {
  const crowd = crowdNow(type, section, state, game, ctx);
  const extra = state === 'open' && EXTRA[type] ? EXTRA[type](acts) : [];
  const base = BASE[type] || [];
  if (!extra.length && !base.length) return crowd;
  const sig = `${type}|${section}|${state}|${actsKey(acts)}`;
  let m = MORE.get(sig);
  if (!m || m.crowd !== crowd) {
    m = { crowd, list: Object.freeze([...base, ...crowd, ...extra]) };
    MORE.set(sig, m);
  }
  return m.list;
}

/** A hippodrome's section: 0 its main (the curved end), else the part's own (1 the middle, 2 the gates); a ghost's from the plan. */
export function sectionOf(b) {
  if (b.main) return b.section || 1;
  return b.section || 0;
}

/** The eggs and dolphins on section 1's spina for `laps` counted: the eggs still up, the dolphins turned head down one a lap. */
const LAPS = new Map();
export function circusLaps(laps) {
  let list = LAPS.get(laps);
  if (list) return list;
  const m = new Matrix4();
  const r = new Matrix4();
  const eggs = [];
  const up = [];
  const down = [];
  LAP_PLACES.eggs.forEach(([x, y, z], i) => { if (i >= laps) eggs.push(...m.makeTranslation(x, y, z).elements); });
  LAP_PLACES.dolphins.forEach(([x, y, z], i) => {
    m.makeTranslation(x, y, z);
    if (i < laps) m.multiply(r.makeRotationZ(1.1));
    (i < laps ? down : up).push(...m.elements);
  });
  list = Object.freeze([
    ...(eggs.length ? [Object.freeze({ key: 'hippodrome:egg', n: eggs.length / 16, mats: new Float32Array(eggs), state: 'always' })] : []),
    Object.freeze({ key: 'hippodrome:dolphin', n: 7, mats: new Float32Array([...down, ...up]), state: 'always' }),
  ]);
  LAPS.set(laps, list);
  return list;
}

/** The hippodrome's sections' entry (both types): each section its own kit, the main's state and acts. */
function circusEntry() {
  const builds = {};
  for (let k = 0; k < 3; k++) builds[`hippodrome:s${k}`] = (o) => buildCircus(k, o);
  builds['hippodrome:egg'] = (o) => buildLapCounter('egg', o);
  builds['hippodrome:dolphin'] = (o) => buildLapCounter('dolphin', o);
  const lamps = [0, 1, 2].map((k) => circusLamps(k));
  const joined = new Map();
  return Object.freeze({
    variant: (b, place, ctx) => {
      const game = ctx ? ctx.game : null;
      if (game) lastGame = game;
      const k = sectionOf(b);
      const state = venueState(b, game);
      const acts = venueActs(b, game);
      let more = crowdNow('hippodrome', k, state, game, ctx);
      if (k === 1) {
        // The laps counted in the race now running (none idle: every egg up, every dolphin level).
        const laps = state === 'open' && acts.races ? lapsNow(showTick(ctx)) : 0;
        const counters = circusLaps(laps);
        const sig = `${laps}`;
        let j = joined.get(more);
        if (!j || j.sig !== sig) {
          j = { sig, list: Object.freeze([...more, ...counters]) };
          joined.set(more, j);
        }
        more = j.list;
      }
      return { key: `hippodrome:s${k}`, state, ice: false, more, actors: venueCast('hippodrome', state, acts, k) };
    },
    warm: ['hippodrome:s0', 'hippodrome:s1', 'hippodrome:s2', 'hippodrome:egg', 'hippodrome:dolphin', 'crowd:sit:toga:0', 'crowd:up:plebs:1'],
    lamps: (b) => (venueState(b, lastGame) === 'open' ? lamps[sectionOf(b)] : []),
    build: (key, lod) => (builds[key] || builds['hippodrome:s0'])({ lod }).group,
  });
}

/** One venue's entry of MODELS: `builds` its kits by key (its own, and its parts by `type:part`). */
function entry(type, builds, lamps, warm = []) {
  return Object.freeze({
    variant: (b, place, ctx) => {
      const game = ctx ? ctx.game : null;
      if (game) lastGame = game;
      const state = venueState(b, game);
      const acts = venueActs(b, game);
      return { key: type, state, ice: false, more: moreOf(type, 0, state, acts, game, ctx), actors: venueCast(type, state, acts) };
    },
    // The building's own kit, its parts, and a crowd group of each pose (the crowd's two materials).
    warm: [type, ...warm, 'crowd:sit:toga:0', 'crowd:up:plebs:1'],
    lamps: (b) => (venueState(b, lastGame) === 'open' ? lamps : []),
    build: (key, lod) => (builds[key] || builds[type])({ lod }).group,
  });
}

export const VENUE_MODELS = Object.freeze({
  theater: entry('theater', { theater: buildTheatrum }, THEATRUM_LAMPS),
  amphitheater: entry('amphitheater', { amphitheater: buildAmphitheatrum, 'amphitheater:stage': buildAmphitheatrumStage }, AMPHITHEATRUM_LAMPS, ['amphitheater:stage']),
  colosseum: entry('colosseum', { colosseum: buildArena, 'colosseum:bay:even': (o) => buildArenaBay('even', o), 'colosseum:bay:odd': (o) => buildArenaBay('odd', o), 'colosseum:bay:gate': (o) => buildArenaBay('gate', o) }, ARENA_LAMPS, ARENA_BAYS.map((e) => e.key)),
  hippodrome: circusEntry(),
  hippodrome_part: circusEntry(),
});

/** A crowd group by its key: `crowd:<pose>:<band>:<variant>` (its rows' step the venues' 0.32 m). */
function buildCrowdPart(key, lod) {
  const [, pose, band, variant] = key.split(':');
  return buildCrowdGroup(pose, band, Number(variant), lod, 0.32);
}

/** The venues' parts for models.js MODEL_PARTS, by their key's first word. */
export const VENUE_PARTS = Object.freeze({
  crowd: Object.freeze({ build: buildCrowdPart }),
});

/**
 * A type's whole look as one Group, as the game shows it (the lab, the
 * tests): its own kit and every kit of its `more` at their places, each
 * mesh shown where `shows(when, state)` says.
 */
export function venueLook(type, lod, { state = 'open', acts = null, fill = FILL_STEPS, mood = 0, section = 0, shows = null } = {}) {
  const g = new Group();
  const def = VENUE_MODELS[type];
  const own = def.build(type.startsWith('hippodrome') ? `hippodrome:s${section}` : type, lod);
  own.traverse((o) => { if (o.isMesh) o.userData.state = state; });
  g.add(own);
  const a = acts || { play: true, bouts: true, hunt: true, races: true };
  const more = [...(BASE[type] || []), ...(state === 'open' ? [...crowdMore(type, section, fill, mood), ...(EXTRA[type] ? EXTRA[type](a) : [])] : [])];
  for (const e of more) {
    const kit = e.key.startsWith('crowd:') ? buildCrowdPart(e.key, lod) : def.build(e.key, lod);
    for (let j = 0; j < e.n; j++) {
      const c = j ? kit.clone() : kit;
      c.matrixAutoUpdate = false;
      c.matrix.fromArray(e.mats, j * 16);
      c.traverse((o) => { if (o.isMesh) o.userData.state = 'always'; });
      g.add(c);
    }
  }
  if (shows) g.traverse((o) => { if (o.isMesh) o.visible = shows(o.userData.when, o.userData.state); });
  return g;
}

/** sRGB colours of the factions (the walkers' charioteers' and the race's). */
export const FACTION_COLOURS = Object.freeze({ russata: DYES.madder, albata: DYES.candida, prasina: 0x3f8a4a, veneta: 0x3a62a8 });
