/**
 * away.js
 * ----------------------------------------------------------------------------
 * Who is away at a distant battle (sim/battle.js), as the questions the rest
 * of the sim asks: the records of the men and ships away (awayRecords), the
 * posts with anyone away (postsAway), whether a fort or station takes a new
 * recruit or ship (takesNewMen), the men away per post (awayCounts, awayOf)
 * and their pay (awayUpkeep). Asked by the barracks and the navalia
 * (sim/military.js, sim/navy.js), the trips to train (sim/training.js) and
 * the clear tool (sim/construction.js). Reads only game.military.battle and
 * recalls, with no imports from the sim, so sim/training.js can ask without
 * loading sim/battle.js, which imports training.
 * ----------------------------------------------------------------------------
 */

import { CONFIG } from '../config.js';
import { UNIT_TYPES } from '../data/units.js';

/** Ticks a soldier or ship may take to leave the province before it is taken to have found a way. */
export const AWAY_MAX_TICKS = CONFIG.TICKS_PER_DAY * 16;

/** The battle in progress, or null. */
export function currentBattle(game) {
  return game.military?.battle || null;
}

/** Records of the men and ships away (on the road, at the battle or coming home, recalled ones too). */
export function awayRecords(game) {
  const b = currentBattle(game);
  const out = b && b.sent ? [...b.sent.men, ...b.sent.ships] : [];
  for (const r of game.military?.recalls || []) out.push(...r.men, ...r.ships);
  return out;
}

/**
 * Fort and station ids with any man or ship away: on his way out of the
 * province, gone to a distant battle, or coming home from it.
 */
export function postsAway(game) {
  const out = new Set(awayCounts(game).keys());
  for (const u of game.units.values()) if (u.away && (u.fort || u.station)) out.add(u.fort || u.station);
  return out;
}

/**
 * May this fort or station take a new recruit (or liburnian)? Not while it
 * is deployed (a rally point) or any of its men are away: new men would
 * only stand about the city with nobody to lead them. `away`: postsAway(),
 * passed in by callers that check many posts.
 */
export function takesNewMen(game, post, away = postsAway(game)) {
  return !post.rally && !away.has(post.id);
}

/** Men and ships away per fort or station id (their places are kept). */
export function awayCounts(game) {
  const out = new Map();
  for (const r of awayRecords(game)) {
    const post = r.fort || r.station;
    if (post) out.set(post, (out.get(post) || 0) + 1);
  }
  return out;
}

/** The away records of one fort or station. */
export function awayOf(game, postId) {
  return awayRecords(game).filter((r) => (r.fort || r.station) === postId);
}

/** What the men and ships away cost a month (they are paid as at home). */
export function awayUpkeep(game) {
  let n = 0;
  // (Only men and ships with a post to come back to: dropAway releases the rest.)
  for (const r of awayRecords(game)) if (game.buildings.has(r.fort || r.station)) n += UNIT_TYPES[r.type]?.upkeep || 0;
  return n;
}
