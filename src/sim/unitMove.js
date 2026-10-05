/**
 * unitMove.js
 * ----------------------------------------------------------------------------
 * How a land unit (sim/units.js) moves: what it may step on (passable), a
 * step toward a point sliding along obstacles (moveToward), the straight-line
 * test (straightClear), A* routes over open land (landRoute, replan,
 * followUnitPath), the long march along one (marchTo), the approach to an
 * enemy (approach) and the one unchecked step inside a fort's walls
 * (stepFree). Shared by soldiers and raiders (sim/military.js), Caesar's men
 * (sim/legion.js), wolves (sim/wildlife.js), villagers (sim/natives.js),
 * prefects in a fight (sim/prefectFight.js) and the raiders' landing
 * (sim/navy.js). Imports only the map and entities.js (the pathfinder is
 * reached through game.pf): no military module.
 * ----------------------------------------------------------------------------
 */

import { Terrain, Road, Wall } from '../world/map.js';
import { STRIDE_WRAP } from './entities.js';

export function passable(game, side, i) {
  const map = game.map;
  const t = map.terrain[i];
  if (t === Terrain.ROCK) return false;
  if (t === Terrain.WATER && map.road[i] !== Road.BRIDGE) return false;
  if (map.building[i]) return false;
  const w = map.wall[i];
  if (w === Wall.WALL) return false;
  if (w === Wall.GATE && side !== 'rome') return false; // (a gate opens for Rome only: not for raiders, nor wolves)
  return true;
}

/** Can the unit step to continuous position (nx, ny)? */
function canEnter(game, u, nx, ny) {
  const map = game.map;
  const tx = Math.floor(nx);
  const ty = Math.floor(ny);
  if (!map.inBounds(tx, ty)) return false;
  if (tx === Math.floor(u.x) && ty === Math.floor(u.y)) return true;
  return passable(game, u.side, map.idx(tx, ty));
}

/**
 * Step toward a point, sliding along obstacles.
 * @returns {boolean} true when (almost) there
 */
export function moveToward(game, u, tx, ty, speed) {
  const dx = tx - u.x;
  const dy = ty - u.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.05) {
    u.moving = false;
    return true;
  }
  const step = Math.min(d, speed);
  const nx = u.x + (dx / d) * step;
  const ny = u.y + (dy / d) * step;
  const sdx = dx - dy; // screen-space x direction
  if (Math.abs(sdx) > 0.01) u.facing = sdx > 0 ? 1 : -1;
  u.moving = true;
  if (canEnter(game, u, nx, ny)) {
    u.x = nx;
    u.y = ny;
    u.stuck = 0;
  } else if (Math.abs(dx) > 0.01 && canEnter(game, u, u.x + Math.sign(dx) * step, u.y)) {
    u.x += Math.sign(dx) * step;
    u.stuck++;
  } else if (Math.abs(dy) > 0.01 && canEnter(game, u, u.x, u.y + Math.sign(dy) * step)) {
    u.y += Math.sign(dy) * step;
    u.stuck++;
  } else {
    u.stuck += 2;
    u.moving = false;
  }
  if (u.moving) u.walked = (u.walked + step) % STRIDE_WRAP;
  return false;
}

/**
 * Is the straight line from the unit to (x, y) walkable for it, tile by tile
 * (no water but bridges, no rock, building or wall; a gate only for Rome)?
 */
export function straightClear(game, u, x, y) {
  const map = game.map;
  const d = Math.hypot(x - u.x, y - u.y);
  const n = Math.ceil(d / 0.4);
  for (let k = 1; k <= n; k++) {
    const tx = Math.floor(u.x + ((x - u.x) * k) / n);
    const ty = Math.floor(u.y + ((y - u.y) * k) / n);
    if (!map.inBounds(tx, ty)) return false;
    if (tx === Math.floor(u.x) && ty === Math.floor(u.y)) continue;
    if (!passable(game, u.side, map.idx(tx, ty))) return false;
  }
  return true;
}

/**
 * One tick toward an enemy: straight at him when the way is open, else along
 * an A* route (over a bridge, through a gate), planned at once and again when
 * he has moved off from where it ends or the unit picks another enemy.
 * Before, a soldier walked straight at a raider across a river and planned a
 * route only after a day stuck on the bank (playtest).
 */
export function approach(game, u, target, speed) {
  const map = game.map;
  // A route is kept while it still ends near the enemy (soldiers switch
  // enemies every few ticks to spread out: a fresh route each time walked
  // them back to their own tile's middle, and they stood jittering).
  if (u.path && u.pathFor) {
    const end = u.path[u.path.length - 1];
    if (Math.hypot(map.xOf(end) + 0.5 - target.x, map.yOf(end) + 0.5 - target.y) > 3) u.path = null;
    else u.pathFor = target.id;
  }
  if (!u.path && !u.noPath && !straightClear(game, u, target.x, target.y)) {
    replan(game, u, target.x, target.y);
    u.pathFor = target.id;
    // From the next tile on: the route's first tile is the one he stands on.
    if (u.path && u.path.length > 1) u.pathIndex = 1;
  }
  if (u.path) { followUnitPath(game, u, speed); return; }
  moveToward(game, u, target.x, target.y, speed);
}

/** Plan an A* route for a unit to a tile (used when steering gets stuck or for long marches). */
function planPath(game, u, goalX, goalY) {
  return landRoute(game, u.side, u.x, u.y, goalX, goalY);
}

/**
 * An A* route over open land for a unit of `side` from (x, y) to the tile
 * of (goalX, goalY), or the nearest open tile within 3 of it: tile indices,
 * or null. (Also asked before a man is sent to train, sim/training.js
 * startTrips: is there a way there on foot, and how long is it?)
 */
export function landRoute(game, side, x, y, goalX, goalY) {
  const map = game.map;
  const u = { side, x, y };
  let gx = Math.max(0, Math.min(map.w - 1, Math.floor(goalX)));
  let gy = Math.max(0, Math.min(map.h - 1, Math.floor(goalY)));
  // If the goal tile is blocked, aim for the nearest open tile around it.
  if (!passable(game, u.side, map.idx(gx, gy))) {
    let found = false;
    for (let r = 1; r <= 3 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          const x = gx + dx;
          const y = gy + dy;
          if (map.inBounds(x, y) && passable(game, u.side, map.idx(x, y))) { gx = x; gy = y; found = true; }
        }
      }
    }
    if (!found) return null;
  }
  const start = map.idx(Math.floor(u.x), Math.floor(u.y));
  const cost = (i) => {
    if (!passable(game, u.side, i)) return Infinity;
    if (map.road[i]) return 0.7;
    return map.terrain[i] === Terrain.TREES ? 1.8 : 1;
  };
  return game.pf.astar(start, map.idx(gx, gy), cost, { maxNodes: 9000 });
}

/** Follow u.path; returns true when the path is finished. */
export function followUnitPath(game, u, speed) {
  if (!u.path || u.pathIndex >= u.path.length) {
    u.path = null;
    return true;
  }
  const map = game.map;
  const i = u.path[u.pathIndex];
  const last = u.pathIndex === u.path.length - 1;
  const tx = map.xOf(i) + 0.5 + (last ? 0 : u.ox * 0.5);
  const ty = map.yOf(i) + 0.5 + (last ? 0 : u.oy * 0.5);
  if (moveToward(game, u, tx, ty, speed)) u.pathIndex++;
  if (u.stuck > 30) {
    u.path = null; // blocked (something was built on the way): re-plan later
    u.stuck = 0;
  }
  return false;
}

/**
 * A step straight toward (tx, ty), the ground unchecked: only inside a
 * fort's walls (nothing there stands in a man's way) and through its gate,
 * between the door tile and the open tile in front of it.
 */
export function stepFree(u, tx, ty, speed) {
  const dx = tx - u.x;
  const dy = ty - u.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.05) { u.moving = false; return true; }
  const step = Math.min(d, speed);
  u.x += (dx / d) * step;
  u.y += (dy / d) * step;
  const sdx = dx - dy;
  if (Math.abs(sdx) > 0.01) u.facing = sdx > 0 ? 1 : -1;
  u.moving = true;
  u.stuck = 0;
  u.walked = (u.walked + step) % STRIDE_WRAP;
  return false;
}

/**
 * One tick of a long march over open land to (tx, ty): along an A* route
 * where steering alone would not do, as a soldier marches to his post.
 * (Soldiers leaving for a distant battle, Caesar's men going home.)
 * @returns {number} the distance left before this tick's step
 */
export function marchTo(game, u, tx, ty, speed) {
  if (u.noPath > 0) u.noPath--;
  const d = Math.hypot(tx - u.x, ty - u.y);
  if (u.path) { followUnitPath(game, u, speed); return d; }
  if ((d > 5 || !straightClear(game, u, tx, ty)) && u.stuck === 0 && !u.noPath) {
    replan(game, u, tx, ty);
    if (u.path) return d;
  }
  moveToward(game, u, tx, ty, speed);
  if (u.stuck > 20) replan(game, u, tx, ty);
  return d;
}

/** Plan an A* route, remembering failures for a while so we do not retry every tick. */
export function replan(game, u, x, y) {
  u.stuck = 0;
  if (u.noPath > 0) return;
  u.path = planPath(game, u, x, y);
  u.pathIndex = 0;
  if (u.pathGate) u.pathGate = false; // (a route to a fort's gate says so after: marchToPost)
  if (!u.path) u.noPath = 60;
}

// For Caesar's legionaries (sim/legion.js), wolves and prefects, who move as raiders do.
export { moveToward as moveUnitToward };
