/**
 * games.test.mjs - the Great Arena's city-wide 5 and its performers' long
 * walks, and the games (Ludi) and races (Circenses) held at the Arena and the
 * hippodrome: their cost, what stops them, the cooldown, the lift to the
 * city mood and its fade, and saves.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { BUILDINGS, ENT_BASE_MAX, ARENA_ENT_BONUS, VENUE_SEATS } from '../src/data/buildings.js';
import { WALKER_TYPES } from '../src/data/walkers.js';
import { GAMES, GAME_KINDS, GAMES_FADE } from '../src/data/games.js';
import { updateEntertainmentBase, seatCoverage, arenaStaffed } from '../src/sim/entertainment.js';
import { updateServiceSpawns } from '../src/sim/services.js';
import { entertainmentScore } from '../src/sim/housing.js';
import { computeSentiment } from '../src/sim/population.js';
import { holdGames, gamesBlocked, gamesCost, gamesVenue, gamesMonth, gamesStateOf, newGamesState } from '../src/sim/games.js';
import { serializeGame, deserializeGame, upgradeGamesV32 } from '../src/core/save.js';
import { Building, newHouseData, removeBuilding } from '../src/sim/entities.js';
import { withDemoMarble } from '../src/dev/demoCity.js';
import { newGame, build, findFree } from './helpers.mjs';

/** A venue of this type put straight into the city (no map), staffed or not, with shows or not. */
function venue(game, type, { staffed = true, shows = {} } = {}) {
  const b = new Building(game.nextBuildingId++, type, 0, 0);
  b.efficiency = staffed ? 1 : 0;
  Object.assign(b.shows, shows);
  game.buildings.set(b.id, b);
  return b;
}

/** A Great Arena on the map with a road along its front, staffed: { game, arena }. */
function arenaCity() {
  const game = newGame({ size: 96 });
  const spot = findFree(game, 7, 8);
  assert.ok(spot, 'room for an Arena and its road');
  const x = spot.x + 1;
  const y = spot.y + 1;
  // (Its marble waived: the Arena costs 600 since v0.19.10, which these tests are not about.)
  assert.ok(withDemoMarble(game, () => build(game, 'colosseum', x + 2, y + 2)).ok, 'placed'); // held by its middle tile
  assert.ok(build(game, 'road', x - 1, y + 5, x + 6, y + 5).ok, 'a road along it');
  game.processRoadChanges();
  const arena = game.buildings.get(game.map.building[game.map.idx(x, y)]);
  assert.equal(arena.type, 'colosseum');
  arena.efficiency = 1;
  return { game, arena };
}

// ---------------------------------------------------------------------------
// The Arena's city-wide 5
// ---------------------------------------------------------------------------

test('arena: a staffed Great Arena gives every home a flat 5 on the base, shows or not; unstaffed, nothing', () => {
  const game = newGame();
  game.city.population = 1000;
  const arena = venue(game, 'colosseum', { staffed: false });
  updateEntertainmentBase(game);
  assert.equal(game.city.entBase, 0, 'nobody works there: nothing');
  assert.equal(arenaStaffed(game), false);
  arena.efficiency = 0.4; // staffed, even short of hands, and no shows
  updateEntertainmentBase(game);
  assert.equal(game.city.entBase, ARENA_ENT_BONUS);
  assert.equal(game.city.entCoverage.colosseum, 0, 'no shows: its seats count for nothing');
  const h = newHouseData();
  assert.equal(entertainmentScore(game, h), 5, 'a home no entertainer has visited gets it too');
});

test('arena: its seats and its 5 are counted once each; a second Arena adds seats, not another 5', () => {
  const game = newGame();
  game.city.population = 4000;
  venue(game, 'colosseum', { shows: { colosseum: 10 } });
  updateEntertainmentBase(game);
  // 2,000 seats of 4,000 people: 50% of one seat kind. floor(50 / 3 / 5) = 3, and 5 after.
  assert.equal(game.city.entCoverage.colosseum, 50);
  assert.equal(game.city.entBase, Math.floor(50 / 3 / 5) + 5);
  venue(game, 'colosseum', { shows: { amphitheater: 10 } });
  updateEntertainmentBase(game);
  assert.equal(game.city.entCoverage.colosseum, 100, `two Arenas seat ${2 * VENUE_SEATS.colosseum}`);
  assert.equal(game.city.entBase, Math.floor(100 / 3 / 5) + 5, 'still one 5');
  assert.equal(seatCoverage(game).arena, ARENA_ENT_BONUS);
});

test('arena: the 5 comes after the cap, so the base runs 0 to 31 with every seat kind full and races too', () => {
  const game = newGame();
  game.city.population = 300;
  venue(game, 'theater', { shows: { theater: 10 } });
  venue(game, 'amphitheater', { shows: { amphitheater: 10 } });
  venue(game, 'hippodrome', { shows: { hippodrome: 10 } });
  updateEntertainmentBase(game);
  assert.equal(game.city.entBase, Math.floor(300 / 15), 'two seat kinds full and the races: 20');
  venue(game, 'colosseum', { shows: { colosseum: 10 } });
  updateEntertainmentBase(game);
  assert.equal(game.city.entBase, ENT_BASE_MAX + ARENA_ENT_BONUS);
  assert.equal(game.city.entBase, 31);
});

// ---------------------------------------------------------------------------
// The Arena's performers walk twice as far
// ---------------------------------------------------------------------------

test('arena: its performers set out on a round of 52 tiles, twice an entertainer\'s; a theater\'s keep 26', () => {
  assert.equal(BUILDINGS.colosseum.roam, 2 * WALKER_TYPES.entertainer.roam);
  assert.equal(BUILDINGS.colosseum.roam, WALKER_TYPES.charioteer.roam, 'as far as the charioteer');
  assert.equal(BUILDINGS.theater.roam, undefined);
  assert.equal(BUILDINGS.amphitheater.roam, undefined);
  const { game, arena } = arenaCity();
  arena.shows.colosseum = 10;
  arena.spawnTimer = 0;
  updateServiceSpawns(game, arena);
  const w = arena.walkers.map((id) => game.walkers.get(id)).find((x) => x && x.type === 'entertainer');
  assert.ok(w, 'a performer goes out');
  assert.equal(w.roamLeft, 52);
  assert.equal(w.venue, 'colosseum');
  assert.equal(w.speed, CONFIG.WALKER_SPEED, 'at walking pace (only the charioteer drives)');
  // A theater on the same road: the entertainer's own 26.
  const spot = findFree(game, 4, 4);
  assert.ok(build(game, 'theater', spot.x + 1, spot.y + 1).ok);
  assert.ok(build(game, 'road', spot.x, spot.y, spot.x, spot.y + 3).ok);
  game.processRoadChanges();
  const th = game.buildings.get(game.map.building[game.map.idx(spot.x + 1, spot.y + 1)]);
  th.efficiency = 1;
  th.shows.theater = 10;
  th.spawnTimer = 0;
  updateServiceSpawns(game, th);
  const tw = th.walkers.map((id) => game.walkers.get(id)).find((x) => x && x.type === 'entertainer');
  assert.ok(tw);
  assert.equal(tw.roamLeft, WALKER_TYPES.entertainer.roam);
});

// ---------------------------------------------------------------------------
// Ludi and Circenses
// ---------------------------------------------------------------------------

test('games: the numbers (Ludi +10 at the Arena, Circenses +8 at the hippodrome, 6 months each, money by the population)', () => {
  assert.deepEqual([...GAME_KINDS], ['ludi', 'circenses']);
  assert.deepEqual([GAMES.ludi.venue, GAMES.ludi.mood, GAMES.ludi.cooldown, GAMES.ludi.factor], ['colosseum', 10, 6, 'games']);
  assert.deepEqual([GAMES.circenses.venue, GAMES.circenses.mood, GAMES.circenses.cooldown, GAMES.circenses.factor], ['hippodrome', 8, 6, 'races']);
  assert.equal(GAMES_FADE, 0.8);
  const game = newGame();
  game.city.population = 1000;
  assert.equal(gamesCost(game, 'ludi'), 800);
  assert.equal(gamesCost(game, 'circenses'), 650);
  game.city.population = 5000;
  assert.equal(gamesCost(game, 'ludi'), 3200);
  assert.equal(gamesCost(game, 'circenses'), 2650);
});

test('games: held at a staffed Arena with shows, paid in full; the lift, the message, the cooldown', () => {
  const game = newGame();
  game.city.population = 1000;
  const arena = venue(game, 'colosseum', { shows: { amphitheater: 5 } }); // gladiators only: shows enough
  const t0 = game.city.treasury;
  const ledger0 = game.city.finance.thisYear.festivals;
  assert.equal(gamesBlocked(game, 'ludi', arena), null);
  assert.deepEqual(holdGames(game, 'ludi', arena.id), { ok: true });
  assert.equal(t0 - game.city.treasury, 800);
  assert.equal(game.city.finance.thisYear.festivals - ledger0, 800, 'booked with the festivals');
  const s = game.city.games.ludi;
  assert.deepEqual([s.boost, s.cooldown, s.held], [10, 6, 1]);
  assert.ok(game.messages.some((m) => /^Ludi at the Arena!/.test(m.text)));
  // Again at once: the cooldown, and nothing taken.
  const t1 = game.city.treasury;
  const again = holdGames(game, 'ludi', arena.id);
  assert.equal(again.ok, false);
  assert.match(again.reason, /^The city still talks of the last Ludi: the next in 6 months\.$/);
  assert.equal(game.city.treasury, t1);
  // Each kind counts its own: the races are not held back by the games.
  venue(game, 'hippodrome', { shows: { hippodrome: 5 } });
  assert.equal(gamesBlocked(game, 'circenses'), null);
  // The cooldown counts down a month at a time.
  for (let m = 0; m < 5; m++) gamesMonth(game);
  assert.match(gamesBlocked(game, 'ludi', arena), /next in 1 month\.$/);
  gamesMonth(game);
  assert.equal(gamesBlocked(game, 'ludi', arena), null);
  gamesMonth(game);
  assert.equal(game.city.games.ludi.cooldown, 0, 'never below 0');
});

test('games: refused, with the reasons, at an unstaffed venue, one without shows, the wrong venue, or short of money', () => {
  const game = newGame();
  game.city.population = 1000;
  const arena = venue(game, 'colosseum', { staffed: false, shows: { colosseum: 5 } });
  assert.equal(gamesBlocked(game, 'ludi', arena), 'Nobody works at the Arena.');
  arena.efficiency = 1;
  arena.shows.colosseum = 0;
  assert.match(gamesBlocked(game, 'ludi', arena), /^Needs gladiators or beasts booked/);
  const theater = venue(game, 'theater', { shows: { theater: 5 } });
  assert.equal(gamesBlocked(game, 'ludi', theater), 'Needs an Arena (Great Arena).');
  assert.equal(holdGames(game, 'ludi', 999999).ok, false, 'a venue that is gone');
  arena.shows.colosseum = 5;
  game.city.treasury = 500;
  assert.equal(gamesBlocked(game, 'ludi', arena), 'Needs 800 Dn, 500 in the treasury.');
  const t = game.city.treasury;
  assert.equal(holdGames(game, 'ludi', arena.id).ok, false);
  assert.equal(game.city.treasury, t, 'nothing taken');
  assert.equal(game.city.games.ludi.cooldown, 0, 'and no cooldown');
  // The money and the venue together.
  arena.efficiency = 0;
  assert.equal(gamesBlocked(game, 'ludi', arena), 'Nobody works at the Arena. Needs 800 Dn, 500 in the treasury.');
  // The races: no hippodrome, then one without races.
  game.city.treasury = 5000;
  assert.equal(gamesBlocked(game, 'circenses'), 'Needs a Circus (Hippodrome).');
  const hip = venue(game, 'hippodrome');
  assert.match(gamesBlocked(game, 'circenses'), /^Needs races booked: a Factio/);
  hip.shows.hippodrome = 3;
  assert.equal(holdGames(game, 'circenses').ok, true, 'held at the best venue when none is named');
  assert.deepEqual([game.city.games.circenses.boost, game.city.games.circenses.cooldown], [8, 6]);
});

test('games: the advisor\'s venue is one that can hold them, else a staffed one, else any', () => {
  const game = newGame();
  assert.equal(gamesVenue(game, 'ludi'), null);
  const a = venue(game, 'colosseum', { staffed: false });
  assert.equal(gamesVenue(game, 'ludi'), a);
  const b = venue(game, 'colosseum');
  assert.equal(gamesVenue(game, 'ludi'), b, 'staffed first');
  const c = venue(game, 'colosseum', { shows: { colosseum: 4 } });
  assert.equal(gamesVenue(game, 'ludi'), c, 'with shows first');
});

test('games: a factor of the city mood, "games" and "races", fading a fifth a month; apart from the festivals\' lift', () => {
  const game = newGame();
  game.city.population = 1000;
  const control = newGame();
  control.city.population = 1000;
  for (const g of [game, control]) g.city.festivalBoost = 6;
  venue(game, 'colosseum', { shows: { colosseum: 5 } });
  venue(game, 'hippodrome', { shows: { hippodrome: 5 } });
  assert.ok(holdGames(game, 'ludi').ok);
  assert.ok(holdGames(game, 'circenses').ok);
  const f = computeSentiment(game);
  const fc = computeSentiment(control);
  assert.equal(f.games, 10);
  assert.equal(f.races, 8);
  assert.equal(f.festival, fc.festival, 'the festivals\' lift is its own');
  assert.ok(!('games' in fc) && !('races' in fc), 'listed only while felt');
  // The city mood moves halfway to its target each month: 18 more of target, 9 more of mood.
  assert.equal(game.city.sentiment - control.city.sentiment, 9);
  assert.ok(Math.abs(game.city.games.ludi.boost - 8) < 1e-9);
  const f2 = computeSentiment(game);
  assert.ok(Math.abs(f2.games - 8) < 1e-9 && Math.abs(f2.races - 6.4) < 1e-9);
  // Until under half a point, then gone from the breakdown.
  let months = 2;
  while ('games' in computeSentiment(game)) months++;
  assert.equal(game.city.games.ludi.boost, 0);
  assert.equal(months, 14, '10 x 0.8^13 = 0.55 is the last listed');
  // Held again while a lift is left: back to the full value, not on top.
  game.city.games.ludi.cooldown = 0;
  game.city.games.ludi.boost = 3;
  assert.ok(holdGames(game, 'ludi').ok);
  assert.equal(game.city.games.ludi.boost, 10);
});

test('games: the venue torn down after its games keeps the lift; the Arena\'s 5 goes with it', () => {
  const { game, arena } = arenaCity();
  game.city.population = 1000;
  arena.shows.colosseum = 10;
  updateEntertainmentBase(game);
  assert.ok(game.city.entBase >= ARENA_ENT_BONUS);
  assert.ok(holdGames(game, 'ludi', arena.id).ok);
  removeBuilding(game, arena);
  updateEntertainmentBase(game);
  assert.equal(game.city.entBase, 0);
  assert.equal(computeSentiment(game).games, 10, 'the city remembers the day');
  assert.equal(game.city.games.ludi.cooldown, 6, 'and a new Arena waits like any other');
});

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

test('save: the games\' lifts, cooldowns and counts are kept; a save before version 32 has held none', () => {
  const game = newGame({ seed: 'games-save' });
  game.city.games.ludi = { boost: 6.4, cooldown: 4, held: 2 };
  game.city.games.circenses = { boost: 0, cooldown: 1, held: 1 };
  const data = JSON.parse(JSON.stringify(serializeGame(game)));
  assert.equal(data.version, CONFIG.SAVE_VERSION);
  assert.ok(CONFIG.SAVE_VERSION >= 33, 'games came with version 33');
  const same = deserializeGame(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(same.city.games, game.city.games);
  // Version 31: no games at all.
  const old = JSON.parse(JSON.stringify(data));
  old.version = 31;
  delete old.city.games;
  assert.deepEqual(deserializeGame(old).city.games, newGamesState());
  // Version 31 with something in its place (whatever an old file holds): fresh all the same.
  const odd = JSON.parse(JSON.stringify(data));
  odd.version = 31;
  odd.city.games = 'junk';
  assert.deepEqual(deserializeGame(odd).city.games, newGamesState());
  // A hand-edited current save: a kind out of shape starts fresh, the other is kept.
  const hand = JSON.parse(JSON.stringify(data));
  hand.city.games.ludi.boost = 'lots';
  const fixed = deserializeGame(hand);
  assert.deepEqual(fixed.city.games.ludi, { boost: 0, cooldown: 0, held: 0 });
  assert.deepEqual(fixed.city.games.circenses, game.city.games.circenses);
  // A hand-edited lift or wait beyond what holding them gives comes down to it; an array is no state.
  const big = JSON.parse(JSON.stringify(data));
  big.city.games.ludi = { boost: 1e6, cooldown: 1e9, held: 2 };
  assert.deepEqual(deserializeGame(big).city.games.ludi, { boost: GAMES.ludi.mood, cooldown: GAMES.ludi.cooldown, held: 2 });
  const arr = JSON.parse(JSON.stringify(data));
  arr.city.games = [];
  assert.deepEqual(deserializeGame(arr).city.games, newGamesState());
  // The step on its own.
  const g2 = newGame({ seed: 'games-save-2' });
  g2.city.games.ludi.cooldown = 3;
  upgradeGamesV32(g2);
  assert.deepEqual(g2.city.games, newGamesState());
  assert.deepEqual(gamesStateOf({}), newGamesState(), 'a city without any');
});
