/**
 * berths.js
 * ----------------------------------------------------------------------------
 * Where buildings meet the water, and the ways over it. A dock's, naval
 * station's, navalia's or Portus's berth (dockBerth, shoreBerth) and which
 * navigable water a building stands by (waterOf). Two water routes, which
 * differ and so both stay: shipPath for merchant ships, over navigable water,
 * under ship bridges and never past a low bridge; waterPath for warships and
 * raider ships, within one body of their water (map.navBody, split at low
 * bridges), so they never leave it (sim/bridges.js). Imports only entities.js,
 * so the fleet (sim/navy.js), trade (sim/trade.js), distant battles
 * (sim/battle.js) and training (sim/training.js) share these without
 * importing one another.
 * ----------------------------------------------------------------------------
 */

import { shoreWaterAt, waterSideOf } from './entities.js';

/**
 * The navigable water tile where ships tie up at a dock (cached), or -1:
 * alongside its quay, just past its rows out over the water
 * (sim/entities.js shoreWaterAt; one wholly on land from an older save, the
 * water beside it). Also records which edge of the dock faces the water
 * (dock.waterSide: 0 = -y, 1 = +x, 2 = +y, 3 = -x) for the art. The
 * Navalia, the Naval Station and the Portus use it too (sim/navy.js).
 */
export function dockBerth(game, dock) {
  const map = game.map;
  if (dock.berth === undefined || dock.berth < 0 || !map.navigable[dock.berth]) {
    dock.berth = shoreWaterAt(map, dock.def, dock.x, dock.y, dock.size);
    if (dock.berth >= 0) dock.waterSide = waterSideOf(map, dock, dock.berth);
  }
  return dock.berth;
}

/** Water route between two navigable tiles (ships sail under ship bridges, never past a low bridge: sim/bridges.js). */
export function shipPath(game, from, to) {
  const nav = game.map.navigable;
  const low = game.map.bridgeLow;
  return game.pf.astar(from, to, (i) => (nav[i] && !low[i] ? 1 : Infinity), { maxNodes: game.map.size * 4 });
}

/** Water route between two tiles of the same navigable water (ships pass under bridges), or null. */
export function waterPath(game, from, to) {
  const body = game.map.navBody;
  const b = body[from];
  if (!b || body[to] !== b) return null;
  return game.pf.astar(from, to, (i) => (body[i] === b ? 1 : Infinity), { maxNodes: game.map.size * 4 });
}

/** The water tile beside a station or navalia (its berths, its slip), or -1. Cached, with the side facing the water. */
export function shoreBerth(game, b) {
  return dockBerth(game, b);
}

/** Which navigable water a station or navalia stands by (0: none). */
export function waterOf(game, b) {
  const i = shoreBerth(game, b);
  return i >= 0 ? game.map.navBody[i] : 0;
}
