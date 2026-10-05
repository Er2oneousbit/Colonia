/**
 * military.js
 * ----------------------------------------------------------------------------
 * Soldiers, raiders, towers, walls and invasions.
 *
 * Supply chain (carts deliver only while forts have empty places)
 *   Weaponsmith (iron)          ---weapons---\
 *   Fletcher (timber + iron)    ---arrows----+--> Barracks --recruit walks by road--> Fort
 *   Horse Ranch (breeding herd) ---horses----/
 *   Warehouses forward stored weapons/arrows to barracks too; horses stay at
 *   the ranch (never in a warehouse) until a barracks needs them.
 *   One recruit: legionary 50 weapons, archer 50 arrows, cavalryman 1 horse.
 *
 * Units (both sides) move freely over open land in continuous tile
 * coordinates (tile centers are at .5). Roman soldiers at rest stand in
 * their fort's yard, inside its walls; while enemies are about they stand
 * on formation spots by it, where they always stood (or around a rally point the player
 * picks). At the fort they hold their ground (fight only what comes to
 * them); deployed, they engage raiders around the rally point. Raiders follow a "flow field": one
 * Dijkstra pass from every building tile gives each land tile the cost to
 * reach the nearest building, so every raider just walks downhill. Walls cost
 * extra in that field, so raiders pick the cheapest place to break through.
 *
 * Invasions are announced in three stages (raidWarning below): word of a
 * warband about 6 months ahead, the scouts' report of its size and road
 * about 3 months ahead, and a last warning a month ahead. Then a warband
 * spawns at a map edge that can reach the city's homes. It flees when mostly destroyed, or
 * withdraws (with plunder if it reached the city) after a while, so an
 * undefended city is punished but not wiped out. Where ships can sail, about
 * a third of raids come by sea instead: raider ships put the warband ashore
 * near the city (sim/navy.js, which also runs the fleet). Ships are units
 * too (`naval`), but sail and fight apart: soldiers, raiders and towers on
 * land never see them.
 * ----------------------------------------------------------------------------
 */

import { CONFIG } from '../config.js';
import { UNIT_TYPES, FORT_CAPACITY, TRAIN_DAYS } from '../data/units.js';
import { WALKER_TYPES } from '../data/walkers.js';
import { RECRUIT_COST, RECRUIT_SOURCE, GOODS } from '../data/goods.js';
import { INVASION_PRESETS } from '../data/scenarios.js';
import { difficultyOf } from '../data/difficulty.js';
import { spawnWalker, killWalker, inOwnFort } from './entities.js';
import { followPath } from './movement.js';
import { transact } from './economy.js';
import { withArticle } from './risk.js';
import { logGoods } from './goodsLedger.js';
import { spawnUnit, removeUnit, unitsOfFort, enemyCount, raiderShipCount, garrisonCounts, enemyPower } from './units.js';
import { passable, moveToward, straightClear, approach, followUnitPath, stepFree, marchTo, replan } from './unitMove.js';
import { hostileToRome, raidPeople, warbandType, rollDamage, hurt, attackUnit, nearestHostile, missileDamage, screenDirection } from './combat.js';
import { buildingMaxHp, damageBuilding, damageWall } from './damage.js';
import { fillField, computeField, computeRaidField } from './field.js';
import { formationSpots, postOf, yardSpot, fortGate, standsTo } from './forts.js';
import { awayCounts, awayOf, awayUpkeep, postsAway, takesNewMen, AWAY_MAX_TICKS } from './away.js';
import { seaRaidPlan, seaLandingNow, launchSeaInvasion, updateNavy, potHit, fleeingToShips, landingReached, updateNavalDemand, seaRaidDays } from './navy.js';
import { recruitDetour, recruitTrained, updateDrill, endDrill, drillSpot, trainAt } from './training.js';
import { newCaesarState, updateLegionary, refreshLegionField, legionCount, legionSummary } from './legion.js';
import { PEOPLES, PEOPLE_BY_MISSION, PEOPLE_BY_SITE, GENERIC_PEOPLE, WALKER_TARGET_SOLDIERS, peopleById } from '../data/peoples.js';
import { siteIdOf } from '../data/sites.js';
import { canHarm, harmWalker } from './walkerHarm.js';
import { updateWolves } from './wildlife.js';
import { revoltActive, revoltDaily, revoltMonthly, rebelCount } from './revolt.js';
import { leaveForBattle, dropAway } from './battle.js';
import { fightPrefect } from './prefectFight.js';
import { updateVillager } from './natives.js';
import { fanumOf } from './monumentEffects.js';
import { GIFTS } from '../data/monuments.js';
import { monumentSpent } from './monuments.js';

// The toolbox every military module shares lives below this one (see the
// header): the sim modules import it from those leaf modules directly, and
// these re-exports are for the UI, the dev tools and the tests, which keep
// importing it from here. Nothing in src/sim may import a moved name through
// here: a re-export is an import edge, and would close a cycle again.
export { Unit, spawnUnit, removeUnit, unitsOfFort, enemyCount, raiderShipCount, garrisonCounts, enemyPower } from './units.js';
export { passable, moveToward, straightClear, landRoute, marchTo, moveUnitToward } from './unitMove.js';
export { hostileToRome, raidPeople, warbandType, rollDamage, holdingPosition, unitDefense, missileDamage, hurt, attackUnit, attackWith, nearestHostile, screenDirection } from './combat.js';
export { WALL_HP, buildingMaxHp, damageBuilding, damageWallAt, wallHpOf } from './damage.js';
export { fillField, computeField, raidTargets } from './field.js';
export { militaryNeed, barracksHasRoom } from './demand.js';
export { fortPost, yardSpot, fortGate, standsTo, watchOf } from './forts.js';

// A fort that is not deployed holds its ground, as the original's legions did
// until sent out: a legionary or cavalryman takes on only an enemy within
// HOLD_REACH tiles of the fort's ranks (he steps out, strikes and steps
// back), and lets go once the enemy is HOLD_LEASH tiles beyond that; an
// archer only one his arrows reach from his post. Anyone answers an enemy
// striking at him (see inZone). To fight in the
// field, the player deploys the fort (a rally point): deployed troops guard
// def.aggro * 1.5 around it and chase up to 4 tiles farther (fightZone).
const HOLD_REACH = 2;
const HOLD_LEASH = 1;
const TOWER_RANGE = 8;
const TOWER_DAMAGE = 12;
const TOWER_COOLDOWN = 30; // ticks at full staff
const RAID_MAX_DAYS = 80; // raiders give up and withdraw after this long
const RAID_MAX_LOSSES = 10; // ...or after destroying this many buildings
export const RAID_MIN_POP = 300; // hamlets smaller than this are not worth raiding (the raid is put off)

// The warnings before a raid, in months before it strikes (militaryMonthly).
// Only the scouting at SCOUT_MONTHS draws anything (the side, by the game's
// stream, and land or sea, on a stream of its own); the rumour before it and
// the last warning after it only read state, so they change no raid.
export const RUMOUR_MONTHS = 6; // traders' word: a warband is gathering, not yet where or how big
export const SCOUT_MONTHS = 3; // the scouts fix its side, size and road (land or sea)
export const DOOR_MONTHS = 1; // a month away: the last warning

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * Whether raids may come by sea: what the switch asks (`wanted`), unless a
 * campaign mission rules them out with its `seaRaids: false` (Corduba's
 * Lusitanians and Narbo Martius's Cimbri and Teutones come over land,
 * whatever the Settings say). A sandbox's `seaRaids` is only where its setup
 * left the switch, which the Settings and the flag may move.
 */
export function seaRaidsFor(scenario, wanted) {
  if (scenario && scenario.id !== 'sandbox' && scenario.seaRaids === false) return false;
  return !!wanted;
}

/**
 * Fresh military state for a new game.
 * @param {object} scenario  scenario.military = invasion settings or null;
 *                           scenario.difficulty scales the wait for the first raid
 * @param {GameTime} time
 * @param {object} [flags]   debug flag raids=off|occasional|frequent overrides the scenario
 */
export function newMilitaryState(scenario, time, flags = {}) {
  let settings = scenario.military ? { ...scenario.military } : null;
  if (flags.raids === 'off') settings = null;
  else if (flags.raids && INVASION_PRESETS[flags.raids]) settings = { ...INVASION_PRESETS[flags.raids] };
  const wait = settings ? Math.max(6, Math.round(settings.first * difficultyOf(scenario.difficulty).raidInterval)) : 0;
  return {
    settings,
    nextRaidMonth: settings ? time.totalMonths + wait : null,
    warned: null, // { origin:{x,y}, size, dir, sea?, landing?, noShore? }: the scouts' report
    warnStage: 0, // warnings given for the coming raid: 0 none, 1 rumour, 2 scouted, 3 a month away
    active: null, // { id, origin, size, killed, buildingsLost, startDay, fleeing, plundered }
    nextInvasionId: 1,
    lastLossMessageDay: -99,
    lastWallMessageDay: -99,
    demand: { weapons: 0, arrows: 0, horses: 0 }, // see updateDemand()
    navalDemand: { timber: 0, iron: 0, linen: 0 }, // what the stations' empty berths need (sim/navy.js)
    lastUpkeep: 0,
    // Sea raids (sim/navy.js): the switch. Off (the sandbox's setup, the
    // Settings, a scenario's seaRaids: false or the flag searaids=off), every
    // raid comes by land, exactly as before. The flag searaids=on (Settings'
    // choice for a new mission) wins over a sandbox's setup, never over a
    // mission that rules sea raids out (seaRaidsFor).
    seaRaids: seaRaidsFor(scenario, flags.searaids === 'off' ? false : flags.searaids === 'on' ? true : scenario.seaRaids !== false),
    stats: { raids: 0, repelled: 0, enemiesKilled: 0, soldiersLost: 0, prefectsLost: 0, buildingsLost: 0, trained: 0, seaRaids: 0, shipsSunk: 0, shipsLost: 0, shipsBuilt: 0, boatsSunk: 0 },
    caesar: newCaesarState(), // Caesar's legions (sim/legion.js)
    battle: null, // a distant battle Caesar asked troops for (sim/battle.js)
    battles: { won: 0, lost: 0, lastEndMonth: -999 },
    recalls: [], // riders out and recalled troops coming home from a distant battle (sim/battle.js)
    people: peopleFor(scenario, flags.people), // who raids this province (data/peoples.js)
  };
}

/**
 * The people who raid a province (data/peoples.js), as an id: a debug or
 * sim flag's choice (an id, or 'site' for the province's own), else the
 * mission's own, else its site's. A sandbox meets the generic band unless
 * its setup asked for the province's own people (scenario.raiders 'site'),
 * so a sandbox plays as it did before peoples.
 */
export function peopleFor(scenario, flag = null) {
  const site = siteIdOf(scenario);
  if (flag === 'site') return PEOPLE_BY_SITE[site] || GENERIC_PEOPLE;
  if (flag && Object.hasOwn(PEOPLES, flag)) return flag;
  if (!scenario || scenario.id === 'sandbox') return scenario?.raiders === 'site' ? PEOPLE_BY_SITE[site] || GENERIC_PEOPLE : GENERIC_PEOPLE;
  return PEOPLE_BY_MISSION[scenario.id] || PEOPLE_BY_SITE[site] || GENERIC_PEOPLE;
}

/**
 * Words for a people in messages: `many` ("raiders" for the generic band,
 * so its messages read as they always did; else "Ligurians"), `name`.
 */
export function peopleWords(people) {
  const generic = !people.mix;
  return { many: generic ? 'raiders' : people.name, Many: generic ? 'Raiders' : people.name, generic };
}

// ---------------------------------------------------------------------------
// Forts & posts
// ---------------------------------------------------------------------------

const onTile = (u, p) => Math.floor(u.x) === Math.floor(p.x) && Math.floor(u.y) === Math.floor(p.y);

/** A step of a man in his fort's yard on his way out: to the door tile, then out of the gate. */
function leaveFort(u, gate, speed) {
  u.state = 'march';
  u.path = null;
  const to = onTile(u, gate.door) ? gate.out : gate.door;
  stepFree(u, to.x, to.y, speed);
}

/**
 * A step of a man at rest toward his spot in the yard: through the gate
 * when he is on its tile, straight to his spot inside, else on to the gate
 * as to any post (marchToPost). `gate` null: he is inside and cannot get
 * out, so he goes to his spot all the same.
 */
function goToYard(game, u, fort, gate, def) {
  if (inOwnFort(game, u) || !gate) {
    u.path = null;
    const spot = yardSpot(fort, u.slot);
    if (stepFree(u, spot.x, spot.y, def.speed)) { u.state = 'idle'; u.stuck = 0; } else u.state = 'march';
    return;
  }
  if (onTile(u, gate.out)) {
    u.state = 'march';
    u.path = null;
    stepFree(u, gate.door.x, gate.door.y, def.speed);
    return;
  }
  marchToPost(game, u, gate.out, def, true);
}

/**
 * One tick of a man's march to a spot outside (his place in the ranks, or
 * with `toGate` his fort's gate on his way in): idle once there, or as near
 * as the ground lets him (a spot built over). A route planned for the
 * other one (`u.pathGate` says which) is dropped: when the men stand to or
 * stand down halfway, they turn at once rather than walk it out.
 */
function marchToPost(game, u, post, def, toGate = false) {
  const d = Math.hypot(post.x - u.x, post.y - u.y);
  // Close enough, or as close as the terrain allows (post slot blocked).
  if (d < 0.15 || (d < 1.2 && u.stuck > 10)) { u.state = 'idle'; u.moving = false; u.path = null; u.stuck = 0; return; }
  u.state = 'march';
  if (u.pathFor) { u.path = null; u.pathFor = 0; } // a route toward an enemy who is gone
  if (u.path && !!u.pathGate !== toGate) u.path = null;
  if (u.path) { followUnitPath(game, u, def.speed); return; }
  const plan = () => { replan(game, u, post.x, post.y); if (toGate) u.pathGate = true; };
  if ((d > 5 || !straightClear(game, u, post.x, post.y)) && u.stuck === 0 && !u.noPath) {
    plan();
    if (u.path) return;
  }
  moveToward(game, u, post.x, post.y, def.speed);
  if (u.stuck > 20) plan();
}

/**
 * A fort was removed (demolished or destroyed by raiders): its soldiers have
 * nowhere to live and disband. Hooked to the 'buildingRemoved' event in Game.
 */
export function disbandFort(game, fort) {
  const men = unitsOfFort(game, fort.id);
  for (const u of men) removeUnit(game, u, 'disbanded');
  const away = dropAway(game, fort.id); // (at a distant battle: released there, sim/battle.js)
  const parts = [];
  if (men.length) parts.push(`its ${men.length} soldier${men.length === 1 ? '' : 's'} disbanded`);
  if (away) parts.push(`the ${away} away at a distant battle ${away === 1 ? 'is' : 'are'} released from service and will not come back`);
  if (parts.length) game.message(`With the ${fort.def.name} gone, ${parts.join(', and ')}.`, 'warn', fort.x, fort.y);
}

/** Send a fort's soldiers to a tile (they hold there and defend it). */
export function deployFort(game, fortId, tx, ty) {
  const fort = game.buildings.get(fortId);
  if (!fort || fort.def.kind !== 'fort') return false;
  fort.rally = { x: tx + 0.5, y: ty + 0.5 };
  for (const u of unitsOfFort(game, fortId)) { endDrill(u); u.path = null; u.target = 0; u.state = 'march'; } // (a man on his way to the Campus comes too)
  return true;
}

/** Bring a fort's soldiers home. */
export function recallFort(game, fortId) {
  const fort = game.buildings.get(fortId);
  if (!fort) return false;
  fort.rally = null;
  for (const u of unitsOfFort(game, fortId)) { u.path = null; u.target = 0; u.state = 'march'; }
  return true;
}

// ---------------------------------------------------------------------------
// Barracks & recruits
// ---------------------------------------------------------------------------

/**
 * Daily: how much of each military input the forts still need to fill their
 * ranks (weapons/arrows/horses, in units). Cached on game.military.demand.
 */
export function updateDemand(game) {
  updateNavalDemand(game); // the fleet's timber, iron and linen (sim/navy.js)
  const demand = { weapons: 0, arrows: 0, horses: 0 };
  const counts = garrisonCounts(game);
  const away = awayCounts(game); // men at a distant battle keep their places (sim/battle.js)
  const out = postsAway(game);
  for (const f of game.buildings.values()) {
    if (f.def.kind !== 'fort' || !takesNewMen(game, f, out)) continue; // (deployed or men away: no recruits)
    const room = FORT_CAPACITY - (counts.get(f.id) || 0) - (away.get(f.id) || 0) - (f.recruiting || 0);
    if (room <= 0) continue;
    for (const [good, n] of Object.entries(RECRUIT_COST[f.def.unit] || {})) demand[good] = (demand[good] || 0) + n * room;
  }
  game.military.demand = demand;
  return demand;
}

/** Daily: train a recruit and send him to the fort that needs one most. */
export function updateBarracks(game, b) {
  if (b.trainProgress === undefined) b.trainProgress = 0;
  if (b.efficiency <= 0 || b.accessRoad < 0) {
    b.blocked = b.accessRoad < 0 ? 'No road access.' : 'No workers.';
    return;
  }
  if (b.trainProgress < 100) b.trainProgress = Math.min(100, b.trainProgress + (b.efficiency * 100) / TRAIN_DAYS);
  if (b.trainProgress < 100) { b.blocked = ''; return; }

  // Forts that still have room, emptiest first. A fort whose men are away at
  // a distant battle keeps their places for them (sim/battle.js), and one
  // deployed or with men away takes no recruits until it is recalled and
  // its men are home: new men would only stand about the city.
  const counts = garrisonCounts(game);
  const away = awayCounts(game);
  const out = postsAway(game);
  const forts = [];
  let held = 0;
  for (const f of game.buildings.values()) {
    if (f.def.kind !== 'fort' || f.efficiency <= 0 || f.accessRoad < 0) continue;
    const have = (counts.get(f.id) || 0) + (away.get(f.id) || 0) + (f.recruiting || 0);
    if (have >= FORT_CAPACITY) continue;
    if (takesNewMen(game, f, out)) forts.push({ f, fill: have / FORT_CAPACITY });
    else held++;
  }
  if (!forts.length) { b.blocked = held ? 'No recruits while deployed: the forts with room are deployed or have men away.' : 'All staffed forts are fully manned.'; return; }
  forts.sort((a, c) => a.fill - c.fill);
  const missing = new Set();
  for (const { f } of forts) {
    const cost = RECRUIT_COST[f.def.unit] || {};
    const ok = Object.entries(cost).every(([good, n]) => (b.stock[good] || 0) >= n);
    if (!ok) { for (const good of Object.keys(cost)) missing.add(good); continue; }
    const path = game.pf.roadPath(b.accessRoad, f.accessRoad);
    if (!path) continue;
    for (const [good, n] of Object.entries(cost)) b.stock[good] -= n;
    f.recruiting = (f.recruiting || 0) + 1;
    // A fully staffed Military Academy: he is trained there first (sim/training.js).
    const detour = recruitDetour(game, b, f);
    const w = spawnWalker(game, 'recruit', b.accessRoad, b, {
      target: f.id, state: detour ? 'toAcademy' : 'toFort', academy: detour ? detour.academy.id : 0, trained: false, trainLeft: 0, trainWait: 0,
      reserve: { id: f.id, recruit: 1 }, unitType: f.def.unit,
    });
    if (!w) { f.recruiting--; for (const [good, n] of Object.entries(cost)) b.stock[good] += n; return; }
    for (const [good, n] of Object.entries(cost)) logGoods(game, good, 'used', n);
    followPath(game, w, detour ? detour.path : path);
    b.trainProgress = 0;
    b.blocked = '';
    game.military.stats.trained++;
    return;
  }
  b.blocked = missing.size
    ? `Waiting for ${[...missing].map((g) => `${GOODS[g].name.toLowerCase()} (${RECRUIT_SOURCE[g]})`).join(' or ')}.`
    : 'No road route to a fort.';
}

/** A recruit reached his fort: he becomes a soldier. */
export function recruitArrive(game, w) {
  const fort = game.buildings.get(w.target);
  if (fort && fort.def.kind === 'fort') {
    // (The places of men away at a distant battle are kept for them.)
    const used = new Set([...unitsOfFort(game, fort.id), ...awayOf(game, fort.id)].map((u) => u.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    if (slot < FORT_CAPACITY) {
      // The recruit steps off the road as a soldier and marches to his post.
      spawnUnit(game, fort.def.unit, w.x + 0.5, w.y + 0.5, { fort: fort.id, slot, state: 'march', trained: !!w.trained });
      if (w.trained) recruitTrained(game, w);
      game.events.emit('sound', { name: 'recruit' });
    }
  }
  killWalker(game, w); // releases the fort's "recruiting" reservation
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

/** Deployed, an enemy within this share of a soldier's aggro of himself is fought wherever he is. */
const DEPLOYED_SELF = 0.5;

/**
 * Where a soldier may fight right now (see HOLD_REACH). A zone is `spots`
 * (the ground it is measured from: an enemy's distance is to the nearest),
 * `guard` (an enemy this close to it is taken on), `leash` (a fight is given
 * up beyond this), `near` (an enemy this close to the soldier himself is
 * taken on too, inside the leash) and, holding the fort, `self` (an enemy
 * this close to him is fought wherever he is: a man marching home who is
 * struck strikes back) and `hold` (so is one striking at him, see inZone).
 *   Deployed: around the rally point, guard def.aggro * 1.5, leash 4 more,
 *   near his aggro, nothing else beyond the leash but an enemy close to
 *   him (self: half his aggro, at least his reach and a tile).
 *   Holding the fort: a legionary or cavalryman, the fort's ranks (every
 *   spot of its formation: the men hold their ground together, or raiders
 *   cut down the front man while the rest look on), guard HOLD_REACH; an
 *   archer, his own post, guard his range. Leash HOLD_LEASH more (an archer:
 *   none).
 */
function fightZone(game, def, fort, post) {
  if (fort.rally) {
    const guard = def.aggro * 1.5;
    // On the march to the rally point too, an enemy that comes close is
    // fought wherever he is (DEPLOYED_SELF): with none, soldiers walked
    // past raiders, struck or not, on their way there (playtest).
    return { spots: [fort.rally], guard, leash: guard + 4, near: def.aggro, self: Math.max(def.range + 1, def.aggro * DEPLOYED_SELF), hold: false };
  }
  const guard = def.ranged ? def.range : HOLD_REACH;
  const spots = def.ranged ? [post] : formationSpots(game, fort);
  // (An archer lets go the moment a raider leaves his range: he shoots from his post, never steps out.)
  return { spots, guard, leash: def.ranged ? guard : guard + HOLD_LEASH, near: -1, self: def.range, hold: true };
}

/** Distance from an enemy to the nearest spot of a zone. */
function zoneDistance(zone, e) {
  let best = Infinity;
  for (const s of zone.spots) best = Math.min(best, Math.hypot(e.x - s.x, e.y - s.y));
  return best;
}

/**
 * May the soldier fight this enemy? `keeping`: one he is fighting already
 * (held to the leash, not the guard). A man holding the fort also answers an
 * enemy striking at him from wherever it stands (a slinger out of reach of
 * the ranks has come to him all the same), and only while it does.
 */
function inZone(zone, u, e, keeping) {
  const d = Math.hypot(e.x - u.x, e.y - u.y);
  if (d <= zone.self) return true;
  if (zone.hold && e.target === u.id && d <= UNIT_TYPES[e.type].range + 0.5) return true;
  const dZone = zoneDistance(zone, e);
  if (dZone > zone.leash) return false;
  return keeping || dZone <= zone.guard || d <= zone.near;
}

/**
 * A soldier's choice of enemy: one inside his fight zone. Raiders already
 * fought by several soldiers count as farther away, so a squad spreads its
 * attacks.
 */
function pickTarget(enemies, u, zone) {
  let best = null;
  let bestScore = Infinity;
  for (const e of enemies) {
    if (u.ignore && u.ignore.includes(e.id)) continue;
    if (!inZone(zone, u, e, false)) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y);
    const score = d + (e.pressure || 0) * 0.8;
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}

/**
 * A wounded soldier resting in his fort's yard heals: full health in
 * CONFIG.HEAL_DAYS from nothing, a little each tick. Only in the yard, so a
 * man standing to, deployed, marching or on his way to the Campus heals
 * nothing until he is back behind the walls.
 */
export function healAtRest(game, u) {
  if (u.hp >= u.maxHp || !inOwnFort(game, u)) return;
  u.hp = Math.min(u.maxHp, u.hp + u.maxHp / (CONFIG.HEAL_DAYS * CONFIG.TICKS_PER_DAY));
}

/**
 * One soldier's tick. `enemies`: every land unit hostile to Rome
 * (hostileToRome); `watch`: what calls a fort's men out of its yard
 * (standsTo).
 */
function updateRoman(game, u, enemies, watch) {
  const def = UNIT_TYPES[u.type];
  const fort = game.buildings.get(u.fort);
  if (!fort) { removeUnit(game, u, 'disbanded'); return; }
  if (u.noPath > 0) u.noPath--;
  if (u.ignore && game.time.totalTicks > u.ignoreUntil) u.ignore = null;
  // On a trip to the Campus (sim/training.js): called back the moment his
  // fort is deployed or its men stand to, untrained if he had not finished.
  if (u.drill && (fort.rally || standsTo(game, fort, watch, false))) endDrill(u);
  const post = postOf(game, u, fort);
  const zone = fightZone(game, def, fort, post);
  let target = u.target ? game.units.get(u.target) : null;
  if (target && (!hostileToRome(target) || !inZone(zone, u, target, true))) target = null;
  if ((game.time.totalTicks + u.id) % 6 === 0 || !target) {
    const pick = pickTarget(enemies, u, zone);
    if (pick !== target) {
      if (target) target.pressure = Math.max(0, (target.pressure || 0) - 1);
      if (pick) pick.pressure = (pick.pressure || 0) + 1;
      if (pick || !target) target = pick;
    }
  }
  u.target = target ? target.id : 0;
  const inside = inOwnFort(game, u);

  if (target) {
    u.state = 'engage';
    const d = Math.hypot(target.x - u.x, target.y - u.y);
    // Nobody fights from the yard: an archer there shooting over the wall was
    // out of every enemy's reach (they do not pick men inside), so he goes out
    // first like the rest.
    if (d <= def.range && !inside) {
      u.moving = false;
      u.path = null;
      if (u.cooldown <= 0) attackUnit(game, u, def, target);
      return;
    }
    if (inside) {
      const gate = fortGate(game, fort);
      if (gate) { leaveFort(u, gate, def.speed); u.state = 'engage'; } else u.moving = false;
      return;
    }
    approach(game, u, target, def.speed);
    if (u.stuck > 20) {
      replan(game, u, target.x, target.y);
      if (!u.path) {
        // No way to get at this raider (other river bank...): ignore him for a while.
        (u.ignore ||= []).push(target.id);
        u.ignoreUntil = game.time.totalTicks + 400;
        target.pressure = Math.max(0, (target.pressure || 0) - 1);
        u.target = 0;
      }
    }
    return;
  }
  // No enemy: on his trip to the Campus, at rest in the yard, or to (or at)
  // his post in the ranks. A man inside goes out by the gate first; with the
  // gate shut he stays in, and one outside stands in the ranks.
  if (u.drill && tripStep(game, u, fort, def)) return;
  const rest = !fort.rally && !standsTo(game, fort, watch, !inside);
  const gate = rest || inside ? fortGate(game, fort) : null;
  if (inside ? rest || !gate : rest && gate) { if (u.pathFor) u.pathFor = 0; goToYard(game, u, fort, gate, def); return; }
  if (inside) { if (u.pathFor) u.pathFor = 0; leaveFort(u, gate, def.speed); return; }
  marchToPost(game, u, post, def);
}

/**
 * One tick of a soldier's trip to the Campus (sim/training.js): out of his
 * fort's yard by the gate, over open land to the academy's road as to any
 * spot (marchTo), and his days of training there (trainAt). A route toward
 * an enemy he fought on the way is dropped first.
 * @returns {boolean} false when the trip is over (trained, or called off:
 *   the gate shut, the academy gone): he goes home as a man at rest does
 */
function tripStep(game, u, fort, def) {
  if (u.pathFor) { u.path = null; u.pathFor = 0; }
  if (inOwnFort(game, u)) {
    const gate = fortGate(game, fort);
    if (!gate) { endDrill(u); return false; }
    leaveFort(u, gate, def.speed);
    u.state = 'drill';
    return true;
  }
  const academy = game.buildings.get(u.drill);
  const spot = drillSpot(game, academy, u);
  if (!spot) { endDrill(u); return false; }
  const d = Math.hypot(spot.x - u.x, spot.y - u.y);
  // There, or as near as the ground lets him (as at a post: marchToPost).
  if (d < 0.15 || (d < 1.2 && (u.stuck > 10 || u.state === 'training'))) {
    u.path = null;
    u.stuck = 0;
    return trainAt(game, u, academy, CONFIG.ACADEMY_TRAIN_DAYS);
  }
  u.state = 'drill';
  marchTo(game, u, spot.x, spot.y, def.speed);
  return true;
}

/**
 * A soldier of an older save still on his way to a distant battle (sim/battle.js
 * now sends troops away at once) marches to the map exit over open land, as
 * to his post, and leaves the province there. One who cannot get there in
 * AWAY_MAX_TICKS (cut off by water, say) is taken to have found another way
 * out. The gate step is a safety net: no such man should be in a yard, but
 * one there must never plan a route from inside the walls.
 */
function marchOut(game, u) {
  const ex = game.map.exit;
  u.state = 'away';
  u.target = 0;
  // Out of his fort's yard by the gate first (no route starts inside a building).
  const gate = inOwnFort(game, u) ? fortGate(game, game.buildings.get(u.fort)) : null;
  if (gate) {
    leaveFort(u, gate, UNIT_TYPES[u.type].speed);
    u.state = 'away';
    if (game.time.totalTicks - (u.awayTick || 0) > AWAY_MAX_TICKS) leaveForBattle(game, u);
    return;
  }
  const d = marchTo(game, u, ex.x + 0.5, ex.y + 0.5, UNIT_TYPES[u.type].speed);
  if (d < 1.2 || game.time.totalTicks - (u.awayTick || 0) > AWAY_MAX_TICKS) leaveForBattle(game, u);
}

/** One raider's tick. `romans`: the soldiers he can get at; `soldiers`: how many the city has at home. */
function updateRaider(game, u, romans, soldiers) {
  const def = UNIT_TYPES[u.type];
  const map = game.map;
  const inv = game.military.active;
  // A gladiator in revolt (sim/revolt.js) is no part of a raid: he fights
  // while the revolt lasts, and then runs like a raider whose band broke.
  const rebel = u.revolt && revoltActive(game);
  if (!rebel && (!inv || inv.id !== u.invasion || inv.fleeing)) {
    // Run for the map edge and vanish there. A warband that came by sea runs
    // back to its landing and boards its ships, while one is still afloat.
    u.state = 'flee';
    const own = inv && inv.id === u.invasion;
    const ships = own && inv.sea && fleeingToShips(game, inv);
    const o = own && (ships || !inv.sea) ? inv.origin : { x: u.x < map.w / 2 ? 0 : map.w - 1, y: u.y };
    moveToward(game, u, o.x + 0.5, o.y + 0.5, def.speed * 1.1);
    const edge = u.x < 1.5 || u.y < 1.5 || u.x > map.w - 1.5 || u.y > map.h - 1.5;
    if (edge || (ships && landingReached(u, inv)) || u.stuck > 60) removeUnit(game, u, 'fled');
    return;
  }
  // Fight soldiers who come close.
  let target = u.target ? game.units.get(u.target) : null;
  if (target && (Math.hypot(target.x - u.x, target.y - u.y) > def.aggro * 1.6 || inOwnFort(game, target))) target = null;
  if ((game.time.totalTicks + u.id) % 6 === 0 || !target) target = nearestHostile(romans, u.x, u.y, def.aggro) || target;
  u.target = target ? target.id : 0;
  if (target) {
    u.state = 'fight';
    const d = Math.hypot(target.x - u.x, target.y - u.y);
    if (d <= def.range) { u.moving = false; if (u.cooldown <= 0) attackUnit(game, u, def, target); return; }
    moveToward(game, u, target.x, target.y, def.speed);
    return;
  }
  // A prefect fighting him: he turns on him (sim/prefectFight.js).
  if (fightPrefect(game, u, def)) return;
  // A missile man of a people who aim at the city's people, in a city with
  // few soldiers: a walker in reach (the original's rule).
  if (def.ranged && volleyAtWalkers(game, u, def, inv, soldiers)) return;
  if (u.prey) u.prey = 0;
  // Otherwise head for his people's targets, or the nearest building, via the flow field.
  const tx = Math.floor(u.x);
  const ty = Math.floor(u.y);
  const here = map.idx(tx, ty);
  const rf = rebel ? null : game.raidField; // (rebels make for the nearest buildings)
  const field = rf && Number.isFinite(rf[here]) ? rf : game.enemyField;
  let best = -1;
  let bestV = field[here];
  let bestKind = null; // 'building' | 'wall' | 'move'
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (!map.inBounds(nx, ny)) continue;
    const j = map.idx(nx, ny);
    const nb = map.building[j] ? game.buildings.get(map.building[j]) : null;
    if (nb && nb.def.kind !== 'village' && !monumentSpent(game, nb)) { // (a spent monument: walked past, sim/monuments.js)
      // Adjacent building: attack it right away (not a native village's: raiders pass those by).
      best = j;
      bestKind = 'building';
      break;
    }
    if (dx !== 0 && dy !== 0) continue; // walk orthogonally, but strike diagonally
    if (field[j] < bestV) { bestV = field[j]; best = j; bestKind = map.wall[j] ? 'wall' : 'move'; }
  }
  if (best < 0) {
    // Nothing reachable to attack from here (cut off by water or walls with
    // no weak spot): wait. militaryDaily() withdraws a warband stuck like this.
    u.state = 'camp';
    u.moving = false;
    return;
  }
  if (bestKind === 'building' || bestKind === 'wall') {
    u.state = 'siege';
    u.moving = false;
    const sdx = (map.xOf(best) - tx) - (map.yOf(best) - ty);
    if (sdx !== 0) u.facing = sdx > 0 ? 1 : -1;
    if (u.cooldown <= 0) {
      u.cooldown = def.cooldown;
      u.strikeTick = game.time.totalTicks;
      const dmg = def.siege * enemyPower(game, u) * (0.75 + game.rng.next() * 0.5);
      if (bestKind === 'wall') damageWall(game, best, dmg, false, !!rebel);
      else {
        const b = game.buildings.get(map.building[best]);
        if (b) damageBuilding(game, b, dmg, { revolt: !!rebel });
      }
    }
    return;
  }
  u.state = 'advance';
  moveToward(game, u, map.xOf(best) + 0.5 + u.ox, map.yOf(best) + 0.5 + u.oy, def.speed);
}

/**
 * A slinger's or javelineer's turn at the city's people: when his people
 * aim at walkers (data/peoples.js missilesAtWalkers) and the city has fewer
 * than WALKER_TARGET_SOLDIERS soldiers at home, he strikes a walker in
 * reach, the nearest, chosen again every few ticks. The missile strikes at
 * once (missiles only know units), as a slinger's at a prefect does.
 * @returns {boolean} true when he spent his turn on a walker
 */
function volleyAtWalkers(game, u, def, inv, soldiers) {
  if (soldiers >= WALKER_TARGET_SOLDIERS || !raidPeople(game, inv).missilesAtWalkers) return false;
  let w = u.prey ? game.walkers.get(u.prey) : null;
  const reach = (p) => canHarm(p) && Math.hypot(p.x + 0.5 - u.x, p.y + 0.5 - u.y) <= def.range;
  if (w && !reach(w)) w = null;
  // Looked for every few ticks only (a scan of every walker), held between.
  if ((game.time.totalTicks + u.id) % 6 === 0) {
    let bestD = def.range;
    for (const p of game.walkers.values()) {
      if (Math.abs(p.x + 0.5 - u.x) > def.range || Math.abs(p.y + 0.5 - u.y) > def.range || !canHarm(p)) continue;
      const d = Math.hypot(p.x + 0.5 - u.x, p.y + 0.5 - u.y);
      if (d <= bestD) { bestD = d; w = p; }
    }
  }
  if (!w) return false;
  u.prey = w.id;
  u.state = 'fight';
  u.moving = false;
  const sdx = (w.x + 0.5 - u.x) - (w.y + 0.5 - u.y);
  if (Math.abs(sdx) > 0.01) u.facing = sdx > 0 ? 1 : -1;
  if (u.cooldown <= 0) {
    u.cooldown = def.cooldown;
    u.strikeTick = game.time.totalTicks;
    game.events.emit('sound', { name: 'arrow' });
    const what = WALKER_TYPES[w.type]?.name.toLowerCase() || 'citizen';
    const x = w.x;
    const y = w.y;
    if (!harmWalker(game, w, rollDamage(game, def, { defense: 0 }, enemyPower(game, u), 0))) return true;
    const st = game.military.stats;
    st.walkersKilled = (st.walkersKilled || 0) + 1;
    if (!inv.walkerNews) {
      inv.walkerNews = true; // (once a raid: the losses show in the Military advisor)
      game.message(`${peopleWords(raidPeople(game, inv)).Many} struck down ${withArticle(what)} in the street. With few soldiers about, their missile men aim at your people.`, 'bad', x, y);
    }
  }
  return true;
}

function updateProjectiles(game) {
  if (!game.projectiles.length) return;
  const keep = [];
  for (const p of game.projectiles) {
    // A raider ship's fire pot at a boat or a building (sim/navy.js).
    if (p.pot) { if (!potHit(game, p)) keep.push(p); continue; }
    const t = game.units.get(p.target);
    if (!t) continue; // target gone: the missile falls harmlessly
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= p.speed || --p.life <= 0) {
      if (d <= 1) hurt(game, t, missileDamage(game, t, p.damage)); // (close order: judged as it lands)
      continue;
    }
    p.vx = (dx / d) * p.speed; // kept for the renderer (arrow direction)
    p.vy = (dy / d) * p.speed;
    p.x += p.vx;
    p.y += p.vy;
    p.z = Math.max(2, p.z * 0.97);
    keep.push(p);
  }
  game.projectiles = keep;
}

function updateTowers(game, enemies) {
  if (!enemies.length) return;
  for (const b of game.buildings.values()) {
    if (b.def.kind !== 'tower' || b.efficiency <= 0) continue;
    if (b.shotTimer > 0) { b.shotTimer--; continue; }
    const cx = b.x + b.size / 2;
    const cy = b.y + b.size / 2;
    const target = nearestHostile(enemies, cx, cy, TOWER_RANGE);
    if (!target) continue;
    b.shotTimer = Math.round(TOWER_COOLDOWN / b.efficiency);
    game.projectiles.push({ x: cx, y: cy, z: 38, target: target.id, damage: TOWER_DAMAGE * (0.8 + game.rng.next() * 0.4), speed: 0.45, kind: 'arrow', life: 60 });
  }
}

/** Per tick: move and fight. Cheap when there is nobody around. */
export function updateMilitary(game) {
  if (game.units.size === 0 && game.projectiles.length === 0) return;
  const romans = [];
  const enemies = []; // side 'enemy' on land: raiders and Caesar's men
  const hostiles = []; // everything on land soldiers and towers fight (hostileToRome)
  const wild = []; // wolves, who move by their own rules (sim/wildlife.js)
  const fleet = []; // liburnians
  const pirates = []; // raider ships
  const villagers = []; // a native village's men (sim/natives.js)
  for (const u of game.units.values()) {
    u.px = u.x; // previous position: the renderer interpolates between ticks
    u.py = u.y;
    if (UNIT_TYPES[u.type].naval) (u.side === 'enemy' ? pirates : fleet).push(u);
    else if (u.side === 'rome') romans.push(u);
    else {
      if (u.side === 'enemy') enemies.push(u);
      else if (u.type === 'wolf') wild.push(u);
      else if (u.type === 'villager') villagers.push(u); // a native village's men (sim/natives.js)
      if (hostileToRome(u)) hostiles.push(u);
    }
  }
  // pressure = how many soldiers are on each foe (pickTarget spreads attacks)
  for (const e of hostiles) e.pressure = 0;
  for (const u of romans) {
    const t = u.target ? game.units.get(u.target) : null;
    if (t) t.pressure++;
  }
  let raiders = false;
  let legionaries = false;
  for (const e of enemies) if (e.legion) legionaries = true; else raiders = true;
  if (raiders) {
    const stale = game.enemyFieldRev !== game.map.revision && game.time.totalTicks - (game.enemyFieldTick || 0) > 20;
    if (!game.enemyField || stale || game.time.totalTicks - (game.enemyFieldTick || 0) > 200) computeField(game);
  }
  if (legionaries) refreshLegionField(game); // Caesar's men walk a field of their own (sim/legion.js)
  // Soldiers on their way out to a distant battle (sim/battle.js) fight no
  // one here, and no one picks a fight with them. (Liburnians sailing out are
  // in `fleet`: sim/navy.js sends them on.)
  const home = romans.some((u) => u.away) ? romans.filter((u) => !u.away) : romans;
  // What calls a fort's men out of its yard this tick (standsTo).
  const watch = { alarm: enemies.length > 0 || pirates.length > 0, foes: hostiles, memo: new Map() };
  for (const u of romans) {
    if (!game.units.has(u.id)) continue;
    if (u.cooldown > 0) u.cooldown--;
    if (u.away) marchOut(game, u);
    else updateRoman(game, u, hostiles, watch);
    if (game.units.has(u.id) && !u.away) healAtRest(game, u);
  }
  // Men in their fort's yard are out of everyone's reach behind its walls
  // (they come out to fight: standsTo); they still count as the city's
  // soldiers (a slinger's choice of walkers, sim/legion.js overrun).
  const seen = home.some((u) => inOwnFort(game, u)) ? home.filter((u) => !inOwnFort(game, u)) : home;
  for (const u of enemies) {
    if (!game.units.has(u.id)) continue;
    if (u.cooldown > 0) u.cooldown--;
    if (u.legion) updateLegionary(game, u, seen);
    else updateRaider(game, u, seen, home.length);
  }
  if (wild.length) updateWolves(game, wild, seen);
  for (const u of villagers) {
    if (!game.units.has(u.id)) continue;
    if (u.cooldown > 0) u.cooldown--;
    updateVillager(game, u, seen);
  }
  if (fleet.length || pirates.length) updateNavy(game, fleet, pirates);
  updateTowers(game, hostiles.filter((e) => game.units.has(e.id) && hostileToRome(e)));
  updateProjectiles(game);
}

// ---------------------------------------------------------------------------
// Invasions
// ---------------------------------------------------------------------------

/**
 * Pick a land tile on the map edge from which raiders can actually walk to
 * the city's homes (not just an outlying farm across a river), preferring
 * edges far from the city center. Falls back to the imperial road entry.
 */
function pickRaidOrigin(game) {
  const map = game.map;
  const field = new Float32Array(map.size);
  fillField(game, field, (id) => !!game.buildings.get(id)?.house);
  let cx = map.w / 2;
  let cy = map.h / 2;
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (const b of game.buildings.values()) if (b.def.kind !== 'village') { sx += b.x; sy += b.y; n++; } // (the city's own: not a native village, sim/natives.js)
  if (n) { cx = sx / n; cy = sy / n; }
  let best = null;
  let bestScore = -Infinity;
  const consider = (x, y) => {
    const i = map.idx(x, y);
    if (!passable(game, 'enemy', i)) return;
    if (!field || !Number.isFinite(field[i])) return; // cut off from the city (far river bank...)
    const score = Math.hypot(x - cx, y - cy) + game.rng.next() * 12;
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  };
  for (let k = 0; k < map.w; k += 2) { consider(k, 0); consider(k, map.h - 1); }
  for (let k = 1; k < map.h - 1; k += 2) { consider(0, k); consider(map.w - 1, k); }
  return best || { x: map.entry.x, y: map.entry.y };
}

/** How many raiders the next warband brings. */
export function raidSize(game) {
  const s = game.military.settings;
  const base = s ? s.base : 5;
  // Mars's Great Sanctuary at work: a fifth fewer raiders, after the difficulty's lever.
  const mars = fanumOf(game, 'mars') ? GIFTS.mars.raidSize : 1;
  const n = Math.round((base + game.city.population / 450 + (game.military.stats.raids || 0)) * game.difficulty.raidSize * mars);
  return Math.max(3, Math.min(40, n));
}

/** Monthly: pay the army, warn about raids, launch them. */
export function militaryMonthly(game) {
  const m = game.military;
  let upkeep = awayUpkeep(game); // men and ships away at a distant battle are paid too (sim/battle.js)
  for (const u of game.units.values()) if (u.side === 'rome') upkeep += UNIT_TYPES[u.type].upkeep;
  if (upkeep > 0) transact(game, 'military', -upkeep);
  m.lastUpkeep = upkeep;
  revoltMonthly(game); // a gladiator revolt's end month (sim/revolt.js)

  if (!m.settings || m.nextRaidMonth === null) {
    // Raids switched off (only a debug flag can, mid-game): nothing is coming.
    m.warned = null;
    m.warnStage = 0;
    return;
  }
  if (m.active) return;
  raidWarning(game, m.nextRaidMonth - game.time.totalMonths);
}

/**
 * The coming raid, `left` months before it strikes: at most one message a
 * month, the latest stage due. A raid dated inside a stage's lead (a short
 * interval, a raid put off, a save from before the stages) skips the stages
 * already past rather than bunching them up:
 *
 *   left <= RUMOUR_MONTHS  traders' word (stage 1)
 *   left <= SCOUT_MONTHS   the scouts' report (stage 2): side, size, land or sea
 *   left <= DOOR_MONTHS    a month away (stage 3)
 *   left <= 0              the raid
 *
 * A city under RAID_MIN_POP hears nothing, and at the scouts' check its raid
 * is put off 6 months; if anything had been said, the warband "drifted away".
 */
function raidWarning(game, left) {
  const m = game.military;
  if (game.city.population < RAID_MIN_POP) {
    // Nothing worth raiding yet: push the date back.
    if (left <= SCOUT_MONTHS) {
      m.nextRaidMonth = game.time.totalMonths + 6;
      if (m.warned || m.warnStage > 0) game.message('Scouts report the warband has drifted away, for now.', 'info');
      m.warned = null;
      m.warnStage = 0;
    }
    return;
  }
  if (!m.warned && left <= SCOUT_MONTHS) scoutRaid(game, left);
  else if (m.warned && left <= 0) launchInvasion(game, m.warned.origin, m.warned.size, { sea: !!m.warned.sea, people: m.warned.people });
  else if (m.warned && left <= DOOR_MONTHS && m.warnStage < 3) raidAtTheDoor(game);
  else if (!m.warned && left <= RUMOUR_MONTHS && m.warnStage < 1) {
    m.warnStage = 1;
    // Nothing is drawn yet (side, size and road are the scouts' to find), so
    // the rumour gives only the time, and who: the province's people are no secret.
    const w = peopleWords(raidPeople(game, null));
    const who = w.generic ? 'a warband' : `the ${w.many} gathering a warband`;
    game.message(`Traders speak of ${who}${w.generic ? ' gathering' : ''} beyond the frontier, about ${monthsAway(left)}. Scouts will learn its strength and its road nearer the time.`, 'warn', undefined, undefined, { empire: 'warband' });
  }
}

/** "6 months away", "a month away" (or "about to strike" when the day has come). */
function monthsAway(n) {
  if (n <= 0) return 'about to strike';
  return n === 1 ? 'a month away' : `${n} months away`;
}

/**
 * Stage 2, the scouts' report: the warband's side and size, and whether it
 * comes by sea, fixed now and kept in `warned` until the raid. About a third
 * of raids come by sea where ships can sail (sim/navy.js): decided here, on a
 * random stream of its own, so a raid by land draws exactly what it always
 * did. A click opens the empire map on the warband, whose card shows the edge
 * or the landing.
 */
function scoutRaid(game, left) {
  const m = game.military;
  const sea = seaRaidPlan(game);
  const people = raidPeople(game, null);
  const many = peopleWords(people).many;
  if (sea) {
    const size = peopleSize(raidSize(game), people);
    const e = game.map.seaEntry;
    const when = left <= 0 ? 'any day now' : `in about ${left === 1 ? 'a month' : `${left} months`}`;
    m.warned = { origin: { x: e.x, y: e.y }, size, dir: screenDirection(game.map, e.x, e.y), sea: true, landing: { x: sea.x, y: sea.y }, people: m.people };
    game.message(`Scouts report about ${size} ${many} taking to their ships, by sea, from the ${m.warned.dir}. They will come ashore near ${sea.x}, ${sea.y} ${when}. Man the shore, and send the fleet if you have one!`, 'warn', sea.x, sea.y, { empire: 'warband', kind: 'scouted' });
  } else {
    const origin = pickRaidOrigin(game);
    m.warned = { origin, size: peopleSize(raidSize(game), people), dir: screenDirection(game.map, origin.x, origin.y), people: m.people };
    game.message(`Scouts report a warband of about ${m.warned.size} ${many} gathering to the ${m.warned.dir}, ${monthsAway(left)}. Train soldiers and man your towers!`, 'warn', origin.x, origin.y, { empire: 'warband', kind: 'scouted' });
  }
  m.warnStage = 2;
  game.events.emit('sound', { name: 'horn' });
}

/**
 * Stage 3, a month before the raid; a click glides to where it will come in.
 * By land: its side again. By sea: the landing is looked for again (the city
 * may have built along that shore since the scouts' report; no random
 * draws) and the report is corrected to it. With none (or the Sea raids
 * switch turned off since) the raid will come over land, from a side drawn
 * only at the launch, so the message cannot name one. `warned.sea` stays as
 * it is: the launch decides, exactly as before these warnings.
 */
function raidAtTheDoor(game) {
  const m = game.military;
  const w = m.warned;
  m.warnStage = 3;
  const many = peopleWords(peopleById(w.people || m.people)).many;
  if (!w.sea) {
    game.message(`The warband of about ${w.size} ${many} is a month away and will come in from the ${w.dir}. Man the walls and towers!`, 'warn', w.origin.x, w.origin.y);
    return;
  }
  const landing = seaLandingNow(game);
  if (!landing) {
    w.noShore = true;
    game.message(`Raider ships are a month off the coast, about ${w.size} ${many}, but they can find no shore to land on. Expect them overland, from a side the scouts cannot yet tell.`, 'warn', undefined, undefined, { empire: 'warband' });
    return;
  }
  const moved = !w.landing || w.landing.x !== landing.x || w.landing.y !== landing.y;
  w.landing = { x: landing.x, y: landing.y };
  delete w.noShore;
  game.message(`Raider ships are a month off the coast: about ${w.size} ${many}, making for the shore near ${landing.x}, ${landing.y}${moved ? ' (not where the scouts first thought)' : ''}. Man the shore and send out the fleet!`, 'warn', landing.x, landing.y);
}

/** Health x attack of one man, the yardstick of a warband's strength. */
function manStrength(type) {
  const d = UNIT_TYPES[type];
  return d.hp * d.attack;
}

/** A people's average strength per man (the generic band: a raider's). */
export function peopleStrength(people) {
  if (!people.mix) return manStrength('raider');
  let sum = 0;
  let w = 0;
  for (const [type, share] of Object.entries(people.mix)) { sum += manStrength(type) * share; w += share; }
  return sum / w;
}

/**
 * Men in a warband of a people, for `size` men of the generic band: as many
 * as make the same strength (health x attack summed over the band). A people
 * of fewer, harder men sends fewer of them; the generic band, `size` itself.
 * At least 2: the generic band's smallest (3 raiders) weighs as much as 2
 * Gauls, not 3.
 */
export function peopleSize(size, people) {
  if (!people.mix) return size;
  return Math.max(2, Math.round((size * peopleStrength(PEOPLES[GENERIC_PEOPLE])) / peopleStrength(people)));
}

/**
 * Stamp a new raid with its people, and with what it makes for: the
 * people's target, or for a people that picks its own prey ('random'), one
 * of the four drawn now (on the game's stream; only such peoples draw).
 */
function stampRaid(game, inv, people) {
  inv.people = Object.hasOwn(PEOPLES, people) ? people : GENERIC_PEOPLE;
  const p = PEOPLES[inv.people];
  inv.target = p.target === 'random' ? RANDOM_TARGETS[game.rng.int(RANDOM_TARGETS.length)] : p.target;
}
const RANDOM_TARGETS = ['food', 'homes', 'troops', 'stores'];

/** Count a raid's warrior by kind (the Military advisor's record). */
function countWarrior(m, type) {
  const w = (m.stats.warriors ||= {});
  w[type] = (w[type] || 0) + 1;
}

/**
 * Spawn a warband now. Returns the invasion record. `sea`: it comes by sea
 * (raider ships from the sea entry, sim/navy.js), if the switch is still on
 * and a landing can still be found; else by land from a map edge (a sea
 * entry is no place to walk in from, so the edge is picked again).
 * `people`: who it is (the scouts' report keeps it), else the province's.
 * With no `size`, a warband of the people as strong as raidSize's generic one.
 */
export function launchInvasion(game, origin, size, { sea = false, people = null } = {}) {
  const m = game.military;
  const map = game.map;
  const folkId = people || m.people || GENERIC_PEOPLE;
  const folk = peopleById(folkId);
  if (sea && m.seaRaids) {
    // (Its crews are rolled in sim/navy.js from the province's people.)
    const inv = launchSeaInvasion(game, Math.max(1, size || peopleSize(raidSize(game), folk)));
    if (inv) {
      stampRaid(game, inv, folkId);
      // sim/navy.js rolled the crews from the province's people: a raid of
      // another (the console's "searaid 12 gauls") rolls them again.
      const own = folkId === (m.people || GENERIC_PEOPLE);
      for (const u of game.units.values()) {
        if (u.invasion !== inv.id || !u.crew) continue;
        if (!own) u.crew = u.crew.map(() => warbandType(game, folk));
        for (const t of u.crew) countWarrior(m, t);
      }
      computeRaidField(game);
      return inv;
    }
  }
  if (!origin || sea) origin = pickRaidOrigin(game);
  size = Math.max(1, size || peopleSize(raidSize(game), folk));
  const inv = { id: m.nextInvasionId++, origin, size, killed: 0, buildingsLost: 0, startDay: game.time.totalDays, fleeing: false, reached: false };
  stampRaid(game, inv, folkId);
  m.active = inv;
  m.warned = null;
  m.warnStage = 0; // (a raid from the console too: the next date is drawn when it ends, its warnings from nothing)
  m.stats.raids++;
  for (let k = 0; k < size; k++) {
    const type = warbandType(game, folk);
    // Scatter around the origin on land.
    let x = origin.x;
    let y = origin.y;
    for (let t = 0; t < 12; t++) {
      const tx = origin.x + game.rng.range(-3, 3);
      const ty = origin.y + game.rng.range(-3, 3);
      if (map.inBounds(tx, ty) && passable(game, 'enemy', map.idx(tx, ty))) { x = tx; y = ty; break; }
    }
    spawnUnit(game, type, x + 0.5, y + 0.5, { invasion: inv.id, state: 'advance' });
    countWarrior(m, type);
  }
  computeField(game);
  game.message(`${peopleWords(folk).Many} are attacking from the ${screenDirection(map, origin.x, origin.y)}! (${size} warriors)`, 'bad', origin.x, origin.y, { kind: 'raid' });
  game.events.emit('sound', { name: 'horn' });
  game.events.emit('invasion', inv);
  return inv;
}

/** Daily: raid progress, retreat and aftermath; buildings slowly repair. */
export function militaryDaily(game) {
  const m = game.military;
  updateDemand(game);
  updateDrill(game); // new ships on their way to the Portus, or training there: called home by a raid (sim/training.js)
  revoltDaily(game); // gladiators setting out during a revolt turn on the city (sim/revolt.js)
  const inv = m.active;
  if (inv) {
    // Alive: raiders ashore, and those still aboard their ships (a raid by
    // sea is not over while its ships carry raiders).
    let alive = 0;
    let ashore = 0;
    let camped = 0;
    for (const u of game.units.values()) {
      if (u.side !== 'enemy' || u.invasion !== inv.id) continue;
      if (UNIT_TYPES[u.type].naval) { alive += (u.crew || []).length; continue; }
      alive++;
      ashore++;
      if (u.state === 'camp') camped++;
    }
    // Everyone left is cut off from the city for a few days: give up.
    inv.campDays = ashore > 0 && camped === alive ? (inv.campDays || 0) + 1 : 0;
    // A raid by sea counts its days from the landing (sim/navy.js).
    const days = inv.sea ? seaRaidDays(game, inv) : game.time.totalDays - inv.startDay;
    const people = raidPeople(game, inv);
    const words = peopleWords(people);
    if (alive === 0) {
      endInvasion(game, inv);
    } else if (!inv.fleeing) {
      // A warband breaks at its people's losses (data/peoples.js `breaks`:
      // the generic band once 70% have fallen, a Gaulish mob sooner).
      if (inv.killed > 0 && alive <= Math.ceil(inv.size * people.breaks)) {
        inv.fleeing = true;
        inv.repelled = true;
        game.message(inv.sea && !inv.landed ? 'The raider ships are turning back! Your fleet has broken them at sea.' : `The ${words.many} are fleeing! Your soldiers have broken the warband.`, 'good');
      } else if (inv.sea && !inv.landed && game.time.totalDays - inv.startDay > CONFIG.SEA_SAIL_MAX_DAYS) {
        inv.fleeing = true; // they never got ashore: no plunder
        game.message('The raider ships found no way ashore and sail away.', 'info');
      } else if (days > RAID_MAX_DAYS || inv.buildingsLost >= RAID_MAX_LOSSES || inv.campDays >= 4) {
        inv.fleeing = true;
        // Only a warband that reached the city carries anything off:
        // up to 15% of the treasury, about 60 Dn per surviving raider.
        const loot = inv.reached ? Math.min(Math.max(0, Math.round(game.city.treasury * 0.15)), alive * 60) : 0;
        if (loot > 0) transact(game, 'plunder', -loot);
        inv.plundered = loot;
        if (loot > 0) game.message(`The ${words.many} withdraw with ${loot} Dn of plunder. Build forts and towers before they return.`, 'bad');
        else game.message(`The ${words.many} give up and withdraw.`, 'info');
      }
    }
  }
  // Damaged buildings are patched up slowly once the fighting stops.
  if (!inv && !m.caesar?.army) {
    for (const b of game.buildings.values()) {
      if (b.hp !== undefined && b.hp < buildingMaxHp(b) && game.time.totalDays - (b.lastRaided || 0) > 5) {
        b.hp = Math.min(buildingMaxHp(b), b.hp + buildingMaxHp(b) * 0.05);
      }
    }
  }
}

function endInvasion(game, inv) {
  const m = game.military;
  const r = game.city.ratings;
  const people = raidPeople(game, inv);
  if (inv.repelled || inv.killed >= inv.size * (1 - people.breaks)) {
    m.stats.repelled++;
    r.peace = Math.min(100, r.peace + 8);
    r.favor = Math.min(100, r.favor + 3);
    game.message(`The warband is gone: ${inv.killed} ${peopleWords(people).many} slain. The province is safe for now.`, 'good');
    game.events.emit('sound', { name: 'fanfare' });
  } else if (inv.buildingsLost >= 5) {
    r.peace = Math.max(0, r.peace - 5);
    r.favor = Math.max(0, r.favor - 3);
  }
  m.active = null;
  const s = m.settings;
  if (s) {
    const k = game.difficulty.raidInterval;
    const [a, b] = s.interval;
    m.nextRaidMonth = game.time.totalMonths + game.rng.range(Math.max(4, Math.round(a * k)), Math.max(5, Math.round(b * k)));
  }
  // The raid's missiles are done with; those at Caesar's men (sim/legion.js),
  // still fighting, and at foes that are no part of a raid (a wolf), fly on.
  game.projectiles = game.projectiles.filter((p) => {
    const t = p.pot ? null : game.units.get(p.target);
    return !!t && (!!t.legion || (t.side !== 'enemy' && hostileToRome(t)));
  });
}

/** Summary for the advisor and HUD. */
export function threatSummary(game) {
  const m = game.military;
  const enemies = enemyCount(game);
  const ships = raiderShipCount(game);
  const legion = legionCount(game); // Caesar's men (sim/legion.js)
  const rebels = m.revolt ? rebelCount(game) : 0; // gladiators in revolt (sim/revolt.js)
  const raiders = enemies - legion - rebels;
  const caesar = legionSummary(game);
  // Caesar's legions on the road, as a second line to whatever else is going on.
  const marching = caesar.state === 'marching' ? `Caesar's legions (${caesar.size} men) arrive in ~${caesar.months} month${caesar.months === 1 ? '' : 's'}` : '';
  if (enemies > 0) {
    const many = m.active ? peopleWords(raidPeople(game)).many : 'raiders';
    const who = [legion ? `${legion} of Caesar's legionaries` : '', raiders ? `${raiders} ${many}` : '', rebels ? `${rebels} gladiator${rebels === 1 ? '' : 's'} in revolt` : ''].filter(Boolean).join(' and ');
    return { level: 'attack', text: `${who} in the province${ships ? ` (${ships} raider ship${ships === 1 ? '' : 's'} offshore)` : ''}${marching ? `. ${marching}` : ''}`, enemies, ships, legion, label: `⚔ ${enemies}` };
  }
  const months = Math.max(0, (m.nextRaidMonth ?? 0) - game.time.totalMonths);
  const inMonths = `${months} month${months === 1 ? '' : 's'}`;
  if (m.warned) {
    // Raider ships that found no shore a month out (raidAtTheDoor) come overland, from a side not known yet.
    const from = m.warned.noShore ? 'overland (their ships found no shore)' : `${m.warned.sea ? 'by sea ' : ''}from the ${m.warned.dir}`;
    return { level: 'warned', text: `About ${m.warned.size} ${peopleWords(peopleById(m.warned.people || m.people)).many} expected ${from} in ~${inMonths}${marching ? `. ${marching}` : ''}`, enemies: 0, sea: !!m.warned.sea, label: '⚠ Raid' };
  }
  if (m.warnStage > 0 && !m.active) {
    // Only the traders' word so far (militaryMonthly): no side or size yet.
    return { level: 'warned', text: `A warband is gathering beyond the frontier, about ${inMonths} away${marching ? `. ${marching}` : ''}`, enemies: 0, rumour: true, label: '⚠ Raid' };
  }
  if (marching) return { level: 'warned', text: marching, enemies: 0, legion: true, label: '⚠ Legions' };
  if (!m.settings) return { level: 'none', text: 'No raids in this province.', enemies: 0 };
  return { level: 'calm', text: 'No known threats.', enemies: 0 };
}

export { TOWER_RANGE, TOWER_COOLDOWN };
