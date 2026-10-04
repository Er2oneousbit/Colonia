/**
 * games.js
 * ----------------------------------------------------------------------------
 * Ludi (games) at a Great Arena and Circenses (chariot races) at the
 * hippodrome: the governor pays for a great day at the venue, and the whole
 * city's mood lifts for a while (data/games.js has the numbers).
 *
 * Held at one venue of the kind, which must be staffed (efficiency above 0)
 * and have its shows booked, the same rule its shows have for sending out
 * performers (sim/services.js venueActive): gladiators or beasts at an
 * Arena, races at the hippodrome. They cost money only, all at once, or are
 * not held. The lift is a factor of the city mood (sim/population.js
 * computeSentiment), "Games" or "Races" in the breakdown, so it lifts every
 * home's mood through the city's (sim/mood.js); it fades by a fifth a month.
 * Each kind has its own cooldown, city-wide: a second Arena does not let the
 * city hold Ludi twice as often.
 *
 * State (saved, version 32): city.games = { ludi: { boost, cooldown, held },
 * circenses: {...} }; boost is the lift still felt, cooldown the months
 * before the next, held how many were held in this city.
 *
 * A venue torn down after its games changes nothing: the lift is the
 * people's memory of the day, as a festival's is.
 * ----------------------------------------------------------------------------
 */

import { GAMES, GAME_KINDS, GAMES_FADE } from '../data/games.js';
import { BUILDINGS } from '../data/buildings.js';
import { transact } from './economy.js';
import { venueActive } from './services.js';
import { mainOf } from './entities.js';
import { withArticle } from './risk.js';

/** A new city's games: none held, nothing to wait for. */
export function newGamesState() {
  const s = {};
  for (const k of GAME_KINDS) s[k] = { boost: 0, cooldown: 0, held: 0 };
  return s;
}

/**
 * The city's games state, made whole: a kind missing or out of shape (a
 * hand-edited save) starts as in a new city, so nothing downstream reads NaN.
 */
export function gamesStateOf(city) {
  if (!city.games || typeof city.games !== 'object') city.games = newGamesState();
  for (const k of GAME_KINDS) {
    const s = city.games[k];
    const ok = s && typeof s === 'object' && [s.boost, s.cooldown, s.held].every((v) => Number.isFinite(v) && v >= 0);
    if (!ok) city.games[k] = { boost: 0, cooldown: 0, held: 0 };
  }
  return city.games;
}

/** What a kind of games costs now: base plus perHead a citizen (Dn, whole). */
export function gamesCost(game, kind) {
  const d = GAMES[kind];
  return Math.round(d.base + game.city.population * d.perHead);
}

/** The venue kind's name for the player: "Arena (Great Arena)". */
function venueName(kind) {
  const d = BUILDINGS[GAMES[kind].venue];
  return `${d.name} (${d.en})`;
}

/**
 * Why venue `b` cannot hold games of this kind, or null: it must be of the
 * kind's venue, staffed and have its shows booked.
 */
export function gamesVenueBlocked(b, kind) {
  const d = GAMES[kind];
  if (!b || b.def.kind !== 'venue' || b.def.venue !== d.venue) return `Needs ${withArticle(venueName(kind))}.`;
  if (!(b.efficiency > 0)) return `Nobody works at the ${BUILDINGS[d.venue].name}.`;
  if (!venueActive(b)) {
    return kind === 'circenses'
      ? 'Needs races booked: a Factio (Chariot Stable) sends the teams.'
      : 'Needs gladiators or beasts booked: a Ludus Gladiatorius (Gladiator School) or a Vivarium (Menagerie) sends them.';
  }
  return null;
}

/**
 * The venue the advisor's button holds a kind of games at: the first (by
 * id) that can hold them, else the first staffed one, else any, else null.
 */
export function gamesVenue(game, kind) {
  const d = GAMES[kind];
  let best = null;
  let rank = 0;
  for (const b of game.buildings.values()) {
    if (b.def.kind !== 'venue' || b.def.venue !== d.venue) continue;
    const r = !gamesVenueBlocked(b, kind) ? 3 : b.efficiency > 0 ? 2 : 1;
    if (r > rank || (r === rank && b.id < best.id)) { best = b; rank = r; }
  }
  return best;
}

/**
 * Why games of this kind cannot be held at venue `b` now (the best venue for
 * them when `b` is not given), or null when they can: the cooldown alone,
 * else what the venue lacks and the money the treasury is short of.
 */
export function gamesBlocked(game, kind, b = gamesVenue(game, kind)) {
  const d = GAMES[kind];
  if (!d) return 'Unknown games.';
  const s = gamesStateOf(game.city)[kind];
  if (s.cooldown > 0) return `The city still talks of the last ${d.name}: the next in ${s.cooldown} month${s.cooldown === 1 ? '' : 's'}.`;
  const short = [];
  const venue = gamesVenueBlocked(b, kind);
  if (venue) short.push(venue);
  const cost = gamesCost(game, kind);
  if (cost > game.city.treasury && !game.cheats.freeBuild) short.push(`Needs ${cost} Dn, ${Math.floor(game.city.treasury)} in the treasury.`);
  return short.length ? short.join(' ') : null;
}

/**
 * Hold games of this kind at venue `venueId` (the best venue when not
 * given), paid in full or not at all. The lift is set to the kind's full
 * value (not added to what is left of the last), and its cooldown starts.
 * @returns {{ok:boolean, reason?:string}}
 */
export function holdGames(game, kind, venueId = null) {
  const d = GAMES[kind];
  if (!d) return { ok: false, reason: 'Unknown games.' };
  // (A section of the hippodrome stands for the whole; an id that is gone is no venue.)
  const b = venueId === null ? gamesVenue(game, kind) : mainOf(game, game.buildings.get(venueId)) ?? null;
  const why = gamesBlocked(game, kind, b);
  if (why) return { ok: false, reason: why };
  const s = gamesStateOf(game.city)[kind];
  transact(game, 'festivals', -gamesCost(game, kind)); // the Finance advisor's "Festivals and games"
  s.boost = Math.max(s.boost, d.mood);
  s.cooldown = d.cooldown;
  s.held++;
  game.message(kind === 'circenses'
    ? 'Circenses! The whole city packs the Circus to cheer the chariots, and talks of nothing else for days.'
    : 'Ludi at the Arena! Gladiators and beasts fill the sand, and the whole city talks of nothing else for days.', 'good', b.x, b.y);
  game.events.emit('sound', { name: 'festival' }); // the festival's jingle and music (app.js)
  return { ok: true };
}

/**
 * The month's city mood: each kind's lift still felt, as its factor ("games",
 * "races"), listed only while it is; then the lifts fade a fifth, and one
 * under half a point (nothing, as the advisor rounds it) is gone.
 * Called by computeSentiment, which sums the factors.
 */
export function gamesMood(game, f) {
  const st = gamesStateOf(game.city);
  for (const k of GAME_KINDS) if (st[k].boost > 0) f[GAMES[k].factor] = st[k].boost;
}

/** After the month's mood: the lifts fade (see gamesMood). */
export function fadeGames(game) {
  const st = gamesStateOf(game.city);
  for (const k of GAME_KINDS) {
    const left = st[k].boost * GAMES_FADE;
    st[k].boost = left < 0.5 ? 0 : left;
  }
}

/** Monthly: each kind's cooldown counts down (game.js onMonth, with the festivals'). */
export function gamesMonth(game) {
  const st = gamesStateOf(game.city);
  for (const k of GAME_KINDS) if (st[k].cooldown > 0) st[k].cooldown--;
}
