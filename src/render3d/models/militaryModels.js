/**
 * models/militaryModels.js
 * ----------------------------------------------------------------------------
 * The forts, the barracks and the military academy as the game draws them
 * (render3d/models.js MODELS takes these entries as they are): which look a
 * building shows and its state, from the sim's own fields, read only.
 *
 *   fort_legion, fort_archer, fort_cavalry   (castraLegion.js,
 *        castraArcher.js, castraEquitum.js) 'out' while deployed (a rally
 *        point) or with men away at a distant battle (the standards go out
 *        with the men), else 'open' while manned or staffed, else 'shut'
 *        (fortState). The soldiers themselves are the game's, drawn in the
 *        yard over the model. The cavalry fort's stalls hold a horse for
 *        each trooper of the ala (`more`: the farms' horses).
 *   barracks       (tirocinium.js) 'out' while a recruit is being trained
 *        (staffed and his training begun: b.trainProgress), 'open' staffed,
 *        'shut' not; the arms, arrows and horses it holds fill its racks and
 *        its horse line (`more`: a set of arms for each 50 weapons, a sheaf
 *        for each 50 arrows, a horse for each 100 units of horses).
 *   military_academy  (campus.js) 'out' while men drill there (recruits
 *        training at it, or soldiers sent from their forts), 'open'
 *        staffed, 'shut' not.
 *
 * Each lights its lanterns at night while 'open' or 'out' (models.js
 * modelLamps). In a hard frost a tank's water is ice (':ice').
 * ----------------------------------------------------------------------------
 */

import { iceMaterial } from '../materials.js';
import { postsAway } from '../../sim/away.js';
import { FORT_CAPACITY } from '../../data/units.js';
import { buildLegionFort, LEGION_FORT } from './castraLegion.js';
import { buildArcherFort, ARCHER_FORT } from './castraArcher.js';
import { buildCavalryFort, CAVALRY_FORT, stallMatrix } from './castraEquitum.js';
import { buildBarracks, buildArmsSet, buildArrowSheaf, BARRACKS, ARMS_MATS, ARROW_MATS, HORSE_MATS } from './tirocinium.js';
import { buildAcademy, ACADEMY, RING_HORSE } from './campus.js';
import { TANK_WATER } from './castra.js';
import { HORSE_COATS } from './livestock.js';

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3), as models.js reads it. */
const frost = (place) => ((place && place.snow) || 0) >= 2;

/**
 * What the forts' states read from the sim, worked out once a tick for all
 * of them: the men of each fort (garrison) and the forts with men away at a
 * distant battle. Kept per game, by the tick.
 */
const MEMO = new WeakMap();
/**
 * The game the pass last drew (models.js modelLamps asks a model's lamps of
 * the building alone): a fort's lanterns follow the state its model shows.
 */
let lastGame = null;
export function armyOf(game) {
  if (!game || !game.units) return null;
  lastGame = game;
  const tick = game.time ? game.time.totalTicks : 0;
  let m = MEMO.get(game);
  if (m && m.tick === tick && m.n === game.units.size) return m;
  const men = new Map();
  for (const u of game.units.values()) if (u.fort && u.side === 'rome') men.set(u.fort, (men.get(u.fort) || 0) + 1);
  let away;
  try {
    away = postsAway(game);
  } catch {
    away = new Set();
  }
  m = { tick, n: game.units.size, men, away };
  MEMO.set(game, m);
  return m;
}

/**
 * A fort's state: 'out' deployed (its rally point set) or with men away at
 * a distant battle; else 'open' while it has men or staff; else 'shut'. A
 * ghost (no id) shows it manned.
 */
export function fortState(b, game) {
  if (b.id === null || b.id === undefined) return 'open';
  const army = armyOf(game);
  if (b.rally || (army && army.away.has(b.id))) return 'out';
  const men = army ? army.men.get(b.id) || 0 : 0;
  return men > 0 || b.efficiency > 0 ? 'open' : 'shut';
}

/** How many men a fort has (its garrison, in the yard or out), 0 to FORT_CAPACITY. */
export function fortMen(b, game) {
  const army = armyOf(game);
  return army ? Math.min(FORT_CAPACITY, army.men.get(b.id) || 0) : 0;
}

/**
 * The barracks' state: 'out' while a recruit is in training (staffed, his
 * training begun: sim/military.js updateBarracks counts b.trainProgress up
 * to 100 and starts again when he marches off), 'open' staffed, 'shut'
 * not. A ghost shows it staffed, nobody training.
 */
export function barracksState(b) {
  if (b.id === null || b.id === undefined) return 'open';
  if (!(b.efficiency > 0)) return 'shut';
  return b.trainProgress > 0 ? 'out' : 'open';
}

/**
 * Who drills at each academy now, counted once a tick (per game): recruits
 * training there (walkers 'training' with its id, sim/training.js) and
 * soldiers sent from their forts whose days there have begun (u.drill,
 * u.trainLeft), as sim/training.js inTraining counts them for the panels.
 */
const DRILL = new WeakMap();
export function drillersAt(game, id) {
  if (!game) return 0;
  const tick = game.time ? game.time.totalTicks : 0;
  let m = DRILL.get(game);
  if (!m || m.tick !== tick) {
    const n = new Map();
    if (game.walkers) for (const w of game.walkers.values()) if (!w.dead && w.type === 'recruit' && w.state === 'training' && w.academy) n.set(w.academy, (n.get(w.academy) || 0) + 1);
    if (game.units) for (const u of game.units.values()) if (u.drill && u.trainLeft > 0) n.set(u.drill, (n.get(u.drill) || 0) + 1);
    m = { tick, n };
    DRILL.set(game, m);
  }
  return m.n.get(id) || 0;
}

/** The academy's state: 'out' while men drill there, 'open' staffed, 'shut' not. A ghost shows it staffed and quiet. */
export function academyState(b, game) {
  if (b.id === null || b.id === undefined) return 'open';
  if (!(b.efficiency > 0)) return 'shut';
  return drillersAt(game, b.id) > 0 ? 'out' : 'open';
}

/** Matrices as modelPass.js `more` wants them: a Float32Array of n 4 x 4s. */
function mats(list) {
  const a = new Float32Array(list.length * 16);
  list.forEach((m, j) => m.toArray(a, j * 16));
  return a;
}

/** The horses of a stable or a line: one kit a coat (the farms' horses, shared), the k-th at matrix ms[k]. */
function horsesMore(n, ms, coat0 = 0) {
  const by = new Map();
  for (let k = 0; k < n; k++) {
    const key = `horse:${(coat0 + k) % HORSE_COATS.length}:stand`;
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(ms[k]);
  }
  return [...by].map(([key, list]) => Object.freeze({ key, n: list.length, mats: mats(list), state: 'always' }));
}

/** The cavalry fort's stalls, a horse for each trooper: made once for each count. */
const STALL_MATS = Array.from({ length: CAVALRY_FORT.stalls }, (_, k) => stallMatrix(k));
const STALLS = Array.from({ length: CAVALRY_FORT.stalls + 1 }, (_, n) => Object.freeze(horsesMore(n, STALL_MATS)));

/** How many sets of arms, sheaves of arrows and horses the barracks shows for its stock. */
export function barracksShows(stock = {}) {
  return {
    sets: Math.min(BARRACKS.armsZ.length, Math.ceil((stock.weapons || 0) / 50)),
    sheaves: Math.min(BARRACKS.arrowsX.length, Math.ceil((stock.arrows || 0) / 50)),
    horses: Math.min(BARRACKS.horses.length, Math.floor((stock.horses || 0) / 100)),
  };
}

/** The barracks' `more` for its stock, kept by what it shows (one list made for each, shared). */
const BARRACKS_MORE = new Map();
export function barracksMore(stock) {
  const s = barracksShows(stock || {});
  const sig = `${s.sets},${s.sheaves},${s.horses}`;
  let more = BARRACKS_MORE.get(sig);
  if (!more) {
    const list = [];
    if (s.sets) list.push(Object.freeze({ key: 'barracks:set', n: s.sets, mats: mats(ARMS_MATS.slice(0, s.sets)), state: 'always' }));
    if (s.sheaves) list.push(Object.freeze({ key: 'barracks:arrows', n: s.sheaves, mats: mats(ARROW_MATS.slice(0, s.sheaves)), state: 'always' }));
    list.push(...horsesMore(s.horses, HORSE_MATS, 1));
    more = Object.freeze(list);
    BARRACKS_MORE.set(sig, more);
  }
  return more;
}

/** The academy's rider's horse while men drill. */
const RIDER = Object.freeze(horsesMore(1, [RING_HORSE], 2));
const NONE = Object.freeze([]);

/**
 * The kits drawn in a building's frame besides its own (modelPass.js `more`)
 * for a lab's or a test's made-up building: { men } for a fort, { stock }
 * for the barracks, { state } for the academy.
 */
export function militaryMore(kind, it) {
  if (kind === 'fort_cavalry') return STALLS[Math.max(0, Math.min(CAVALRY_FORT.stalls, it.men || 0))];
  if (kind === 'barracks') return barracksMore(it.stock || {});
  if (kind === 'military_academy') return it.state === 'out' ? RIDER : NONE;
  return NONE;
}

/** A lamp's point for models.js modelLamps: [x, y, z, 1] facing the front (+z). */
const lampsOf = (list) => Object.freeze(list.map(([x, y, z]) => Object.freeze([x, y + 0.11, z, 1])));
const LAMPS = Object.freeze({
  fort_legion: lampsOf(LEGION_FORT.lamps),
  fort_archer: lampsOf(ARCHER_FORT.lamps),
  fort_cavalry: lampsOf(CAVALRY_FORT.lamps),
  barracks: lampsOf(BARRACKS.lamps),
  military_academy: lampsOf(ACADEMY.lamps),
});

/** Swap a named water mesh's material for ice (a hard frost). */
function frozen(group, name) {
  group.traverse((o) => { if (o.isMesh && o.name === name) o.material = iceMaterial(); });
  return group;
}

/** A fort's entry: its look (its tank frozen in a hard frost), its state, its lanterns lit unless it is empty. */
function fortModel(type, build) {
  return Object.freeze({
    variant(b, place, ctx) {
      const game = ctx && ctx.game;
      const v = { key: frost(place) ? `${type}:ice` : type, state: fortState(b, game), ice: false };
      // (A ghost's stalls are empty: the ala comes with its recruits.)
      if (type === 'fort_cavalry') v.more = STALLS[b.id === null || b.id === undefined ? 0 : fortMen(b, game)];
      return v;
    },
    warm: [type],
    lamps: (b) => (fortState(b, lastGame) === 'shut' ? NONE : LAMPS[type]),
    build(key, lod) {
      const g = build({ lod }).group;
      return key.endsWith(':ice') ? frozen(g, TANK_WATER) : g;
    },
  });
}

export const MILITARY_MODELS = Object.freeze({
  fort_legion: fortModel('fort_legion', buildLegionFort),
  fort_archer: fortModel('fort_archer', buildArcherFort),
  fort_cavalry: fortModel('fort_cavalry', buildCavalryFort),
  barracks: Object.freeze({
    // (A ghost holds nothing yet.)
    variant: (b) => ({ key: 'barracks', state: barracksState(b), ice: false, more: b.id === null || b.id === undefined ? NONE : barracksMore(b.stock) }),
    // (Its own kits' keys too: the strap leather and the paint are theirs.)
    warm: ['barracks', 'barracks:set', 'barracks:arrows'],
    lamps: (b) => (b.efficiency > 0 ? LAMPS.barracks : NONE),
    build(key, lod) {
      if (key === 'barracks:set') return buildArmsSet(lod).group;
      if (key === 'barracks:arrows') return buildArrowSheaf(lod).group;
      return buildBarracks({ lod }).group;
    },
  }),
  military_academy: Object.freeze({
    variant(b, place, ctx) {
      const state = academyState(b, ctx && ctx.game);
      return { key: 'military_academy', state, ice: false, more: state === 'out' ? RIDER : NONE };
    },
    warm: ['military_academy'],
    lamps: (b) => (b.efficiency > 0 ? LAMPS.military_academy : NONE),
    build: (key, lod) => buildAcademy({ lod }).group,
  }),
});
