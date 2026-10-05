/**
 * combat.js
 * ----------------------------------------------------------------------------
 * The rules of a fight, apart from who fights whom and when (each side's
 * per-tick code: sim/military.js, sim/legion.js, sim/wildlife.js,
 * sim/natives.js, sim/navy.js, sim/prefectFight.js): who is hostile to Rome,
 * a blow's damage against training and close order, a missile's as it lands,
 * a hit and the death it may bring (hurt, through sim/units.js removeUnit),
 * the nearest foe, a warband's kinds of warrior (warbandType, raidPeople)
 * and the compass word for a map edge (screenDirection: the raids and the
 * fleet both say where a warband comes from). Imports sim/units.js and data
 * only.
 * ----------------------------------------------------------------------------
 */

import { UNIT_TYPES } from '../data/units.js';
import { peopleById } from '../data/peoples.js';
import { removeUnit, enemyPower } from './units.js';

/** The people of a raid (its own, kept from its launch), or of the province's next one. */
export function raidPeople(game, inv = game.military.active) {
  return peopleById(inv?.people || game.military.people);
}

/**
 * Is this unit hostile to Rome, so that soldiers, watchtowers and prefects
 * fight it? One rule for all three, so a new kind of foe needs no change to
 * any of them:
 *   side 'enemy'   raiders, Caesar's legionaries: always
 *   side 'wild'    wild animals that hunt the city's people (wolves): always
 *   side 'native'  a villager of a native village: only while his village is
 *                  attacking the city (`u.attacking` set); in peace he walks
 *                  his own paths and is left alone
 * Rome's own units never are. Ships of either side are left to the fleet
 * (land units never see them), whatever this says.
 * Hostile is not the same as "an enemy in the province": only side 'enemy'
 * holds up a victory or the peace rating (sim/ratings.js enemiesInProvince).
 */
export function hostileToRome(u) {
  if (u.side === 'enemy' || u.side === 'wild') return true;
  return u.side === 'native' && !!u.attacking;
}

/** One blow or missile: attack (+-25%) less half the target's defense, at least 2. `defense`: the target's now (unitDefense). */
export function rollDamage(game, attDef, tgtDef, power = 1, defense = tgtDef.defense) {
  const raw = attDef.attack * power * (0.75 + game.rng.next() * 0.5) - defense * 0.5;
  return Math.max(2, raw);
}

/**
 * Is a Roman soldier holding position: standing his ground, at his post (by
 * the fort, or where it was deployed) or standing to fight a raider in reach,
 * and not running after one or marching? A trained legionary holding
 * position is in close order. (Colonia's soldiers step out to meet a raider
 * near their post, and deployed ones go out to meet raiders around their
 * rally point, rather than wait in line, so standing still is the test, not
 * the spot: a test of "at his post" alone gave a garrison that charges no
 * close order at all.)
 */
export function holdingPosition(game, u) {
  if (u.moving || !u.fort) return false;
  if (u.state === 'idle') return true;
  if (u.state !== 'engage') return false;
  // Standing to fight means his raider is in reach: one blocked from reaching
  // his raider also stands still, but is no formation.
  const t = u.target ? game.units.get(u.target) : null;
  return !!t && Math.hypot(t.x - u.x, t.y - u.y) <= UNIT_TYPES[u.type].range;
}

/**
 * A unit's defense right now: its type's, plus what training gives
 * (data/units.js): trainedDefense always, holdDefense while holding
 * position. Untrained units (and every raider) have their type's.
 */
export function unitDefense(game, u) {
  const def = UNIT_TYPES[u.type];
  if (!u.trained) return def.defense;
  let d = def.defense + (def.trainedDefense || 0);
  if (def.holdDefense && holdingPosition(game, u)) d += def.holdDefense;
  return d;
}

/**
 * A missile's damage on arrival: a trained legionary holding position takes
 * only holdMissile of it; a unit with a thick hide (an elephant's
 * missileShare) takes that share of any.
 */
export function missileDamage(game, target, dmg) {
  const hide = UNIT_TYPES[target.type].missileShare;
  if (hide) dmg *= hide;
  if (!target.trained) return dmg;
  const share = UNIT_TYPES[target.type].holdMissile;
  return share && holdingPosition(game, target) ? dmg * share : dmg;
}

export function hurt(game, target, dmg) {
  target.hp -= dmg;
  target.hitTick = game.time.totalTicks;
  if (target.hp <= 0) removeUnit(game, target, 'died');
}

/** Melee hit or launch a missile at another unit. */
export function attackUnit(game, u, def, target) {
  u.strikeTick = game.time.totalTicks;
  u.cooldown = def.cooldown;
  const sdx = (target.x - u.x) - (target.y - u.y);
  if (Math.abs(sdx) > 0.01) u.facing = sdx > 0 ? 1 : -1;
  const dmg = rollDamage(game, def, UNIT_TYPES[target.type], enemyPower(game, u), unitDefense(game, target));
  if (def.ranged) {
    game.projectiles.push({ x: u.x, y: u.y, z: 10, target: target.id, damage: dmg, speed: 0.4, kind: u.side === 'enemy' ? 'stone' : 'arrow', life: 60 });
    game.events.emit('sound', { name: 'arrow' });
  } else {
    hurt(game, target, dmg);
    game.events.emit('sound', { name: 'clash' });
  }
}

/** Nearest hostile unit within `range` of (x, y). */
export function nearestHostile(list, x, y, range) {
  let best = null;
  let bestD = range;
  for (const e of list) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > bestD) continue;
    best = e;
    bestD = d;
  }
  return best;
}

const DIRS = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];

/** Compass direction of a tile as seen on screen from the map center. */
export function screenDirection(map, x, y) {
  const cx = map.w / 2;
  const cy = map.h / 2;
  const sx = (x - y) - (cx - cy);
  const sy = (x + y) - (cx + cy);
  const a = Math.atan2(-sy, sx); // screen up = north
  const k = Math.round(a / (Math.PI / 4));
  return DIRS[(k + 8) % 8];
}

/**
 * One warrior of a warband, one roll. The generic band: horsemen from 1,200
 * people, slingers from 700. A people with a mix (data/peoples.js): its own
 * kinds in its own shares, whatever the city's size.
 */
export function warbandType(game, people = raidPeople(game)) {
  const roll = game.rng.next();
  if (people.mix) {
    let sum = 0;
    for (const share of Object.values(people.mix)) sum += share;
    let acc = 0;
    for (const [type, share] of Object.entries(people.mix)) {
      acc += share / sum;
      if (roll < acc) return type;
    }
    return Object.keys(people.mix)[0];
  }
  const pop = game.city.population;
  if (pop >= 1200 && roll < 0.22) return 'horseman';
  if (pop >= 700 && roll > 0.8) return 'slinger';
  return 'raider';
}

// For Caesar's legionaries (sim/legion.js), who strike as raiders do.
export { attackUnit as attackWith };
