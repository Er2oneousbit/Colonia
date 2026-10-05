/**
 * units.js
 * ----------------------------------------------------------------------------
 * The Unit class and its bookkeeping. Soldiers, raiders, Caesar's men,
 * rebel gladiators, wolves, native villagers and ships of war are all units
 * (the fields are listed in the class), kept in game.units: spawning, removal
 * with the counts a death moves (the raid's, the legion's, the stats), and the
 * counts per fort. The lowest layer of the military code: it imports no other
 * military module, so every one of them (sim/unitMove.js, sim/combat.js,
 * sim/wildlife.js, sim/navy.js, sim/legion.js... and sim/military.js, which
 * runs them all) may import this one. A wolf's death is not counted here:
 * core/game.js listens for 'unitDied' and calls sim/wildlife.js wolfKilled,
 * since wildlife.js stands above this module and may not be imported by it.
 * ----------------------------------------------------------------------------
 */

import { UNIT_TYPES } from '../data/units.js';
import { GIFTS } from '../data/monuments.js';
import { fanumOf } from './monumentEffects.js';

export class Unit {
  constructor(id, type, x, y) {
    const def = UNIT_TYPES[type];
    if (!def) throw new Error(`Unknown unit type "${type}"`);
    this.id = id;
    this.type = type;
    this.side = def.side;
    this.x = x; // continuous tile coordinates
    this.y = y;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.cooldown = 0;
    this.state = 'idle';
    this.target = 0; // enemy unit id
    this.fort = 0; // Roman: fort building id
    this.slot = 0; // Roman: formation slot
    this.invasion = 0; // raider: invasion id
    this.path = null; // tile indices when following an A* path
    this.pathIndex = 0;
    this.stuck = 0;
    this.facing = 1; // screen direction for art
    this.moving = false;
    this.strikeTick = -99; // last attack (art swings the weapon)
    this.hitTick = -99; // last time it was hurt (health bar flashes)
    this.ox = 0; // small personal offset so crowds do not stack perfectly
    this.oy = 0;
    this.px = x; // position at the start of the tick (render interpolation)
    this.py = y;
    this.walked = 0; // tiles walked, modulo STRIDE_WRAP (drives the leg animation)
    this.trained = false; // Roman: trained at a Military Academy or the Portus (sim/training.js)
    this.drill = 0; // Roman: id of the Campus (a soldier) or Portus (a ship) it is on a trip to, 0 = none
    this.drillDay = 0; // ...the day he set out
    this.drillDays = 0; // ...and how long the trip may take (sim/training.js startDrill)
    this.trainLeft = 0; // ...and, there, the ticks of training left
    this.trainWait = 0; // ...and the ticks it has waited there for a full staff
  }
}

/** Create a unit and register it. */
export function spawnUnit(game, type, x, y, init = {}) {
  const u = new Unit(game.nextUnitId++, type, x, y);
  u.ox = (game.rng.next() - 0.5) * 0.5;
  u.oy = (game.rng.next() - 0.5) * 0.5;
  // Tougher raiders on harder difficulties (their attack is scaled in enemyPower()).
  if (u.side === 'enemy') u.hp = u.maxHp = Math.round(u.maxHp * enemyPower(game, u));
  Object.assign(u, init);
  game.units.set(u.id, u);
  return u;
}

/** Remove a unit (death, disbanding, fleeing off the map). */
export function removeUnit(game, u, cause = 'died') {
  if (!game.units.has(u.id)) return;
  game.units.delete(u.id);
  const st = game.military.stats;
  if (cause === 'died') {
    const inv = game.military.active;
    const mine = inv && inv.id === u.invasion;
    if (UNIT_TYPES[u.type].naval) {
      // A sunk raider ship drowns the raiders still aboard: they count as slain.
      const drowned = u.side === 'enemy' ? (u.crew || []).length : 0;
      if (u.side === 'enemy') {
        st.shipsSunk = (st.shipsSunk || 0) + 1;
        st.enemiesKilled += drowned;
        if (mine) { inv.killed += drowned; inv.shipsSunk = (inv.shipsSunk || 0) + 1; }
        game.message(drowned ? `A raider ship has been sunk with ${drowned} raider${drowned === 1 ? '' : 's'} aboard!` : 'A raider ship has been sunk!', 'good', Math.floor(u.x), Math.floor(u.y));
      } else {
        st.shipsLost = (st.shipsLost || 0) + 1;
        game.message('A liburnian has been sunk! The Navalia can build another.', 'bad', Math.floor(u.x), Math.floor(u.y));
      }
      u.crew = [];
      game.events.emit('sound', { name: 'splash' });
    } else if (u.side === 'native') {
      // A villager (sim/natives.js): no enemy of the province's, no soldier of Rome's.
      if (game.city.natives) game.city.natives.slain++;
    } else if (u.side === 'enemy') {
      st.enemiesKilled++;
      if (u.legion) {
        // One of Caesar's men (sim/legion.js): his army's count, not a raid's.
        const cs = game.military.caesar;
        if (cs && cs.army && cs.army.id === u.legion) cs.army.killed++;
        if (cs) cs.stats.slain++;
      } else if (mine) inv.killed++;
    } else if (u.side === 'rome') {
      st.soldiersLost++;
    }
    // (A wolf's death is counted on this event by core/game.js, which calls
    // sim/wildlife.js wolfKilled: that module stands above this one.)
    game.events.emit('unitDied', { x: u.x, y: u.y, side: u.side, type: u.type });
  }
}

export function unitsOfFort(game, fortId) {
  const out = [];
  for (const u of game.units.values()) if (u.fort === fortId) out.push(u);
  return out;
}

/** Raiders in the province: on land, and still aboard their ships. */
export function enemyCount(game) {
  let n = 0;
  for (const u of game.units.values()) {
    if (u.side !== 'enemy') continue;
    n += UNIT_TYPES[u.type].naval ? (u.crew || []).length : 1;
  }
  return n;
}

/** Raider ships on the map (sailing in, offshore or leaving). */
export function raiderShipCount(game) {
  let n = 0;
  for (const u of game.units.values()) if (u.side === 'enemy' && UNIT_TYPES[u.type].naval) n++;
  return n;
}

/** Soldiers alive per fort id, in one pass over the units. */
export function garrisonCounts(game) {
  const out = new Map();
  for (const u of game.units.values()) if (u.fort) out.set(u.fort, (out.get(u.fort) || 0) + 1);
  return out;
}

/**
 * Strength multiplier for a unit: raiders scale with difficulty, Caesar's
 * men never do (the difficulty sets how many he sends, sim/legion.js), and
 * Rome's soldiers and liburnians strike harder only while Mars's Great
 * Sanctuary is at work (sim/monumentEffects.js).
 */
export function enemyPower(game, u) {
  if (u.side === 'rome') return fanumOf(game, 'mars') ? GIFTS.mars.attack : 1;
  return u.side === 'enemy' && !u.legion && u.type !== 'imperial' ? game.difficulty.enemy : 1;
}
