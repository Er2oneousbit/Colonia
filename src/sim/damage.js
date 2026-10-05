/**
 * damage.js
 * ----------------------------------------------------------------------------
 * Buildings and walls under attack: hit points (buildingMaxHp, wallHpOf), a
 * blow at a building (damageBuilding: at 0 it burns or collapses, a monument
 * is set back or sacked, and the loss is counted for the raid, the legion or
 * the revolt) and one at a wall or gate (damageWall). Struck by raiders
 * (sim/military.js), Caesar's men (sim/legion.js), native villagers
 * (sim/natives.js) and raider ships' fire pots (sim/navy.js). Imports
 * sim/risk.js, sim/monuments.js, sim/ruins.js and entities.js: no military
 * module. The slow repair once the fighting stops is sim/military.js
 * militaryDaily's.
 * ----------------------------------------------------------------------------
 */

import { TOOLS } from '../data/buildings.js';
import { Wall } from '../world/map.js';
import { mainOf } from './entities.js';
import { igniteBuilding, collapseBuilding, riskRates } from './risk.js';
import { recordRuin } from './ruins.js';
import { monumentHp } from './monumentEffects.js';
import { monumentStruck } from './monuments.js';

const WALL_HP = { [Wall.WALL]: 220, [Wall.GATE]: 320 };

export function buildingMaxHp(b) {
  if (b.def.kind === 'monument') return monumentHp(b); // a site's, then the finished monument's (data/monuments.js)
  if (b.def.hp) return b.def.hp;
  return (b.house ? 45 : 80) * b.size * b.size;
}

/**
 * Raiders (or a raider ship's fire pot, `fromSea`) hurt a building; at 0 hit
 * points it burns or collapses. Fire pots alone never let a raid carry off
 * plunder: only raiders who reach the city on foot do. `legion`: Caesar's
 * army struck it (sim/legion.js), which is no part of a raid.
 */
export function damageBuilding(game, b, dmg, { fromSea = false, legion = null, revolt = false } = {}) {
  if (b.def.kind === 'village') return; // a native village is not the province's to lose
  if (b.hp === undefined) b.hp = buildingMaxHp(b);
  b.hp -= dmg;
  b.lastRaided = game.time.totalDays;
  const inv = legion || revolt ? null : game.military.active; // (a gladiator's work is no raid's: sim/revolt.js)
  if (inv && !fromSea) inv.reached = true; // the warband made it to the city: plunder is possible
  if (b.hp > 0) return;
  // A monument already sacked has nothing more to lose until it is repaired.
  if (b.mon && b.mon.sacked && !game.difficulty.monumentRaze) { b.hp = 0; return; }
  if (inv) inv.buildingsLost++;
  if (legion) {
    legion.buildingsLost++;
    const cs = game.military.caesar;
    if (cs) cs.stats.buildingsLost = (cs.stats.buildingsLost || 0) + 1;
  }
  // (The raids' count; a revolt keeps its own, sim/revolt.js.)
  if (!revolt) game.military.stats.buildingsLost++;
  else if (game.military.revolt) game.military.revolt.buildingsLost = (game.military.revolt.buildingsLost || 0) + 1;
  game.city.ratings.peace = Math.max(0, game.city.ratings.peace - 1);
  // A monument never falls but on Insane: a site is set back, a finished
  // one sacked (sim/monuments.js monumentStruck). It counts as lost all the same.
  if (b.def.kind === 'monument') {
    if (monumentStruck(game, b)) return;
    game.message(`The ${b.def.name} has been razed! Everything built and delivered is lost; another monument may be started.`, 'bad', b.x, b.y);
  }
  const now = game.time.totalDays;
  const loud = now - game.military.lastLossMessageDay >= 4;
  if (loud) game.military.lastLossMessageDay = now;
  // Raiders torch most of what they break.
  // (A hippodrome's outer sections burn as the hippodrome does.)
  const who = legion ? 'legion' : revolt ? 'revolt' : 'raid';
  if (game.rng.chance(0.6) && riskRates(mainOf(game, b)).fire > 0) igniteBuilding(game, b, loud ? who : `${who}Quiet`);
  else collapseBuilding(game, b, loud ? who : `${who}Quiet`);
}

/** Raiders (or, `legion`, Caesar's men; `revolt`, rebel gladiators) hit a wall or gate on tile i. */
export function damageWall(game, i, dmg, legion = false, revolt = false) {
  const map = game.map;
  const kind = map.wall[i];
  if (!kind) return;
  const hp = (game.wallHp.get(i) ?? WALL_HP[kind]) - dmg;
  if (hp > 0) { game.wallHp.set(i, hp); return; }
  game.wallHp.delete(i);
  map.wall[i] = Wall.NONE;
  if (!map.road[i]) {
    map.rubble[i] = 1;
    recordRuin(game, [i], TOOLS.wall.name, legion ? 'legionWall' : revolt ? 'revoltWall' : 'raidWall', { type: 'wall', x: game.map.xOf(i), y: game.map.yOf(i), size: 1 });
  }
  map.touch();
  const now = game.time.totalDays;
  if (now - game.military.lastWallMessageDay >= 5) {
    game.military.lastWallMessageDay = now;
    const who = legion ? 'Caesar\'s legions have' : revolt ? 'Rebel gladiators have' : 'Raiders have';
    game.message(kind === Wall.GATE ? `${who} smashed a gate!` : `${who} broken through a wall!`, 'bad', map.xOf(i), map.yOf(i));
  }
  game.events.emit('collapse', { x: map.xOf(i), y: map.yOf(i), size: 1 });
}

export function wallHpOf(game, i) {
  const kind = game.map.wall[i];
  if (!kind) return { hp: 0, max: 0 };
  return { hp: game.wallHp.get(i) ?? WALL_HP[kind], max: WALL_HP[kind] };
}

export { WALL_HP };
// For Caesar's legionaries (sim/legion.js), who break walls as raiders do.
export { damageWall as damageWallAt };
