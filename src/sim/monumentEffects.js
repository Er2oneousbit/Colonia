/**
 * monumentEffects.js
 * ----------------------------------------------------------------------------
 * Which monument the city has, whether it works, and what that changes: the
 * one place every other system asks (religion, trade, health, crime, taxes,
 * farms, fishing, homes, raids...). Light on purpose: it imports data only,
 * so any system can ask without an import cycle. The machinery that builds
 * a monument and runs it is sim/monuments.js.
 *
 * A finished monument works ("is open") while:
 *   - it is not sacked (a raid brought it to 0 hit points: closed until it
 *     is patched back to full, sim/monuments.js monumentStruck);
 *   - at least OPEN_STAFF (75%) of its staff is at work;
 *   - one that burns or eats a good (the Pharus, the Thermae, the Mansio
 *     Magna) has some in its store;
 *   - the Thermae has piped water, like any baths.
 * No fading in or out: the effects start and stop on the day.
 *
 * A city without a monument asks and gets the old answer (every query falls
 * through to 1, 0 or false), so the balance sim's cities are unchanged.
 * ----------------------------------------------------------------------------
 */

import { MONUMENT_TYPES, OPEN_STAFF } from '../data/monuments.js';

/**
 * The city's monument building (a site or a finished one), or null. One per
 * city, so the first found. Looked up again only when the map changes (a
 * building added or removed touches it: sim/entities.js), so the many
 * per-home questions below cost nothing in a city without one.
 */
export function cityMonument(game) {
  if (!game.buildings || !game.map) return null; // (a bare game of the trade rules' tests: no city at all)
  const rev = game.map.revision;
  const c = game.monumentCache;
  if (c && c.rev === rev) {
    const b = c.id ? game.buildings.get(c.id) : null;
    if (!c.id || (b && b.def.kind === 'monument')) return b || null;
  }
  let found = null;
  for (const b of game.buildings.values()) if (b.def.kind === 'monument') { found = b; break; }
  game.monumentCache = { rev, id: found ? found.id : 0 };
  return found;
}

/**
 * A new site's state (sim/monuments.js explains each field): its first
 * stage under way, its money already paid with the placing cost.
 */
export function newSiteState() {
  return { stage: 0, work: 0, got: {}, way: {}, paid: true, halted: false, store: 0, sacked: false, wasOpen: false };
}

/** A new work camp's state (sim/monuments.js): an empty larder, its crew at home. */
export function newCampState() {
  return { larder: 0, water: false, fed: false, factor: 0, shortSince: -1, crew: { state: 'home', since: 0, site: 0 } };
}

/** A monument's hit points: its site's while it is built, then the finished monument's (data/monuments.js hp). */
export function monumentHp(b) {
  const t = monumentType(b);
  return t ? t.hp[isFinished(b) ? 1 : 0] : 0;
}

/**
 * A monument's look, its art state (render/buildingArt.js artState, part of
 * the sprite key): the stage being built (0-based; the number of stages when
 * finished), plus 8 x the side its rows on the water face for the Pharus
 * (0 = -y, 1 = +x, 2 = +y, 3 = -x; a waterside building turns itself).
 */
export function monumentLook(stage, side = 0) {
  return stage + 8 * (side > 0 ? side : 0);
}

/** A monument building's type row (data/monuments.js). */
export function monumentType(b) {
  return b && b.def.mon ? MONUMENT_TYPES[b.def.mon] : null;
}

/** Is this monument finished (every stage built)? */
export function isFinished(b) {
  const t = monumentType(b);
  return !!t && !!b.mon && b.mon.stage >= t.stages.length;
}

/** Is this a monument still being built (a construction site)? */
export function isSite(b) {
  return !!b && b.def.kind === 'monument' && !isFinished(b);
}

/**
 * Why a finished monument is closed today, or null when it works: sacked,
 * too few hands, its store empty, or (the Thermae) no piped water.
 */
export function closedReason(b) {
  if (!isFinished(b)) return 'unfinished';
  if (b.mon.sacked) return 'sacked';
  if (!(b.efficiency >= OPEN_STAFF)) return 'staff';
  const t = monumentType(b);
  if (t.store && !(b.mon.store > 0)) return 'store';
  if (t.needs === 'piped' && !b.hasWater) return 'water';
  return null;
}

/** Does this finished monument work today? */
export function monumentOpen(b) {
  return closedReason(b) === null;
}

/** The city's monument if it is finished and working today, else null. */
export function openMonument(game) {
  const b = cityMonument(game);
  return b && monumentOpen(b) ? b : null;
}

/** The working monument of this type (data/monuments.js key: 'thermae', 'pharus'...), or null. */
export function openOf(game, type) {
  const b = openMonument(game);
  return b && b.def.mon === type ? b : null;
}

/** The god of the working Fanum (its gift is in force), or null. */
export function openFanumGod(game) {
  const b = openOf(game, 'fanum');
  return b ? b.def.deity : null;
}

/** Is `god`'s Great Sanctuary finished and working? */
export function fanumOf(game, god) {
  return openFanumGod(game) === god;
}

/** Is the city's finished monument standing (open or not)? Culture counts it while it stands. */
export function monumentStands(game) {
  const b = cityMonument(game);
  return !!b && isFinished(b);
}
