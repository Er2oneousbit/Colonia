/**
 * monuments.js
 * ----------------------------------------------------------------------------
 * The monuments' machinery: a construction site built stage by stage from
 * goods, the work camp (Castra Operarum) whose ox carts bring them from the
 * warehouses and whose crew builds, and a finished monument's upkeep and
 * store. What a finished monument changes in the city is asked of
 * sim/monumentEffects.js by each system; the numbers are data/monuments.js.
 *
 * A site (b.mon, a building of kind 'monument'):
 *   stage    the stage being built (0-based); stages.length = finished
 *   work     camp-days of work done on it
 *   got      { good: units } delivered for it
 *   way      { good: units } on their way in the camp's carts (reserved the
 *            moment a cart sets out: sim/entities.js releaseReservation)
 *   paid     its money is paid (the first stage's with the placing cost;
 *            the next ones when the stage before is done, if the treasury
 *            holds it, else the site waits; the carts already haul for it)
 *   halted   the player stopped it: no new trips, the crew goes home
 *   store    a finished Pharus's, Thermae's or Mansio Magna's own goods
 *   sacked   a finished monument raiders brought to 0 hit points: closed
 *            until it is patched back to full (sim/military.js militaryDaily)
 *
 * The stage's work is capped by what has arrived: work done may not pass
 *   stage work x min over its goods of (delivered / needed),
 * and the stage is finished when every good is in and the work reaches the
 * stage's. A day's work is the sum, over at most CAMP.perSite camps whose
 * crew is on the site, of its staffing (at most 1) x its supply factor (1
 * fed and watered, 0.5 short of one, 0 short of both).
 *
 * A work camp (b.camp): larder (food), water and fed (today's), factor (its
 * supply factor), crew { state: 'home' | 'out' | 'site' | 'back', since,
 * site }. Its walkers: up to 3 carts (by staffing, as the Emporium's dock
 * workers), its food buyer, and its crew's one walker while on the road.
 *
 * A cart, `campFetch` to a warehouse with a claim on its goods, then
 * `campHaul` to the site with its load; if the site is gone it takes the
 * load to storage (nothing is lost on the road); a burned camp's loaded
 * cart still delivers it.
 *
 * Deterministic: no random draws at all.
 * ----------------------------------------------------------------------------
 */

import { CONFIG } from '../config.js';
import { BUILDINGS, MONUMENT_KEYS, fullName } from '../data/buildings.js';
import { FOOD_TYPES } from '../data/goods.js';
import { TRADE_PARTNERS } from '../data/scenarios.js';
import { GODS } from '../data/gods.js';
import {
  MONUMENT_TYPES, CAMP, CAMP_RULES, CAMP_GRACE_DAYS, RAID_WORK_LOSS, RAID_GOODS_LOSS,
  DONE_FAVOR, DONE_MOOD, OPEN_STAFF, THERMAE_REACH, stageGoods,
} from '../data/monuments.js';
import { WaterBits, Terrain } from '../world/map.js';
import { spawnWalker, killWalker, releaseReservation, footprintTiles } from './entities.js';
import { followPath, goHome } from './movement.js';
import { transact } from './economy.js';
import { takeGoods, findDeliveryFit, isStorage } from './storage.js';
import { logGoods } from './goodsLedger.js';
import { cityMonument, monumentType, isFinished, isSite, closedReason, monumentHp } from './monumentEffects.js';

export { cityMonument, isFinished, isSite } from './monumentEffects.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export { newSiteState, newCampState } from './monumentEffects.js';

/** The stage row a site is building, or null once finished. */
export function stageOf(b) {
  const t = monumentType(b);
  return t && b.mon && b.mon.stage < t.stages.length ? t.stages[b.mon.stage] : null;
}

/** Units of `good` the stage under way still lacks, counting loads on their way. */
export function stillNeeded(b, good) {
  const st = stageOf(b);
  if (!st || !st.goods[good]) return 0;
  return Math.max(0, st.goods[good] - (b.mon.got[good] || 0) - (b.mon.way[good] || 0));
}

/** The share of the stage's goods delivered, the least of its goods (0..1): the cap on its work. */
export function goodsShare(b) {
  const st = stageOf(b);
  if (!st) return 1;
  let share = 1;
  for (const [g, need] of Object.entries(st.goods)) share = Math.min(share, Math.min(1, (b.mon.got[g] || 0) / need));
  return share;
}

/** The most work the stage under way may have now (its work x goodsShare). */
export function workCap(b) {
  const st = stageOf(b);
  return st ? st.work * goodsShare(b) : 0;
}

/** Is every good of the stage under way delivered? */
export function goodsComplete(b) {
  const st = stageOf(b);
  return !!st && Object.entries(st.goods).every(([g, need]) => (b.mon.got[g] || 0) >= need);
}

/** Units delivered to the stage under way, all goods. */
function unitsIn(b) {
  return Object.values(b.mon.got).reduce((a, n) => a + n, 0);
}

/**
 * What a demolition would throw away: the stages finished and the units of
 * goods built in (the finished stages' and the stage under way's).
 */
export function builtSoFar(b) {
  const t = monumentType(b);
  if (!t || !b.mon) return { stages: 0, units: 0 };
  const done = Math.min(b.mon.stage, t.stages.length);
  let units = 0;
  for (let k = 0; k < done; k++) units += Object.values(t.stages[k].goods).reduce((a, n) => a + n, 0);
  if (done < t.stages.length) units += unitsIn(b);
  return { stages: done, units };
}

/** Has anything happened at a site since it was placed (goods in or coming, work done, a stage finished)? Undo is refused then. */
export function siteStarted(b) {
  if (!b.mon) return false;
  return b.mon.stage > 0 || b.mon.work > 0 || unitsIn(b) > 0 || Object.values(b.mon.way).some((n) => n > 0);
}

// ---------------------------------------------------------------------------
// Unlocks and placement
// ---------------------------------------------------------------------------

/** The scenario's partners of a route kind ('land' or 'sea'). */
function partnersBy(game, kind) {
  return (game.scenario.partners || []).filter((id) => TRADE_PARTNERS[id] && (TRADE_PARTNERS[id].route === 'sea' ? 'sea' : 'land') === kind);
}

/**
 * Is this monument (or the work camp) offered here? A rule of the map rather
 * than a list in each mission: from campaign step 6 (the Pantheum from 8)
 * and in the sandbox; a Fanum only where its god's temples are; the Pharus
 * where a sea partner trades and ships can sail in; the Mansio Magna where
 * two land partners trade. The work camp wherever a monument is offered.
 */
export function monumentAllowed(game, key) {
  if (key === 'work_camp') return MONUMENT_KEYS.some((k) => monumentAllowed(game, k));
  const def = BUILDINGS[key];
  const t = def && def.kind === 'monument' ? MONUMENT_TYPES[def.mon] : null;
  if (!t) return false;
  const s = game.scenario;
  const step = s.step || 0;
  if (step) {
    if (step < t.fromStep && !game.flags.unlockall) return false; // (the debug flag opens every building, these too)
  } else if (s.unlocks !== 'all' && !game.flags.unlockall) {
    return false; // (a custom scenario with a list of its own)
  }
  if (def.deity && !game.isUnlocked(`temple_${def.deity}`)) return false;
  if (t.needs === 'sea') return partnersBy(game, 'sea').length > 0 && !!game.map.seaEntry;
  if (t.needs === 'land2') return partnersBy(game, 'land').length >= 2;
  return true;
}

/** The building that makes a good, and the land it needs (null: any). */
const MAKERS = {
  clay: ['clay_pit', Terrain.WATER],
  timber: ['timber_yard', Terrain.TREES],
  marble: ['marble_quarry', Terrain.ROCK],
  iron: ['iron_mine', Terrain.ROCK],
  wine: ['wine_ws', null],
  oil: ['oil_ws', null],
  furniture: ['furniture_ws', null],
  pottery: ['pottery_ws', null],
  linen: ['linen_ws', null],
  grapes: ['farm_vine', Terrain.MEADOW],
  olives: ['farm_olive', Terrain.MEADOW],
  flax: ['farm_flax', Terrain.MEADOW],
};

/** Does the map have any tile of this terrain? */
function mapHas(game, terrain) {
  const t = game.map.terrain;
  for (let i = 0; i < t.length; i++) if (t[i] === terrain) return true;
  return false;
}

/**
 * Can the city get this good at all: made here (its building unlocked, its
 * land on the map, its raw material obtainable in turn), or bought from a
 * partner (a sea partner only where ships can come in)?
 */
export function goodObtainable(game, good, seen = new Set()) {
  if (seen.has(good)) return false;
  seen.add(good);
  for (const id of game.scenario.partners || []) {
    const p = TRADE_PARTNERS[id];
    if (p && p.sells[good] > 0 && (p.route !== 'sea' || game.map.seaEntry)) return true;
  }
  const m = MAKERS[good];
  if (!m || !game.isUnlocked(m[0])) return false;
  if (m[1] !== null && !mapHas(game, m[1])) return false;
  const recipe = BUILDINGS[m[0]].recipe;
  return !recipe || Object.keys(recipe).every((g) => goodObtainable(game, g, seen));
}

/**
 * Why a monument of `type` may not be placed in this city at all, or null:
 * the city already raises one, or some good its stages need can be neither
 * made nor bought here.
 */
export function monumentRefused(game, type) {
  const def = BUILDINGS[type];
  if (!def || def.kind !== 'monument') return null;
  const have = cityMonument(game);
  if (have) return `Your city raises one monument: the ${have.def.name}.`;
  for (const g of stageGoods(def.mon)) {
    if (!goodObtainable(game, g)) return `No ${g} can be made or bought in this province, and its stages need it.`;
  }
  return null;
}

/** Warnings for a monument being placed: no work camp yet. */
export function monumentWarnings(game, type) {
  if (BUILDINGS[type]?.kind !== 'monument') return [];
  for (const b of game.buildings.values()) if (b.def.kind === 'work_camp') return [];
  return ['Build a Castra Operarum (Work Camp) to raise it'];
}

/** The plan's warning when clearing a monument: what would be lost. */
export function demolishWarning(b) {
  if (!b || b.def.kind !== 'monument') return null;
  const { stages, units } = builtSoFar(b);
  if (isFinished(b)) return `The ${b.def.name} is finished: it will be lost, with everything built into it, and nothing is refunded.`;
  return `${stages} stage${stages === 1 ? '' : 's'} and ${units.toLocaleString('en-US')} units of goods built into the ${b.def.name} will be lost; nothing is refunded. Loads on the road go back to storage.`;
}

// ---------------------------------------------------------------------------
// The site, daily
// ---------------------------------------------------------------------------

/** The camps whose crew is on this site today, at most CAMP.perSite (lowest ids first). */
export function campsOnSite(game, site) {
  const out = [];
  for (const b of game.buildings.values()) {
    if (b.def.kind !== 'work_camp' || !b.camp) continue;
    if (b.camp.crew.state === 'site' && b.camp.crew.site === site.id) out.push(b);
  }
  out.sort((a, b) => a.id - b.id);
  return out.slice(0, CAMP.perSite);
}

/** A camp's work a day on a site: staffing (at most 1) x its supply factor. */
export function campRate(camp) {
  return Math.min(1, camp.efficiency || 0) * (camp.camp ? camp.camp.factor : 0);
}

/** Daily, on the building's tick: a site pays, builds and moves on; a finished monument runs. */
export function updateMonument(game, b) {
  if (!b.mon) return;
  if (isFinished(b)) { updateFinished(game, b); return; }
  const st = stageOf(b);
  const m = b.mon;
  if (!m.paid && !m.halted) { // (a halted site pays nothing until it goes on, review)
    if (game.cheats.freeBuild || game.city.treasury >= st.money) {
      if (st.money > 0) transact(game, 'construction', -st.money);
      m.paid = true;
    }
  }
  if (m.paid && !m.halted) {
    let rate = 0;
    for (const c of campsOnSite(game, b)) rate += campRate(c);
    m.work = Math.min(workCap(b), m.work + rate);
  }
  if (m.paid && goodsComplete(b) && m.work >= st.work - 1e-9) advanceStage(game, b);
}

/** The stage is built: on to the next (its money due), or the monument is finished. */
function advanceStage(game, b) {
  const t = monumentType(b);
  const m = b.mon;
  const done = t.stages[m.stage];
  m.stage++;
  m.work = 0;
  m.got = {};
  m.way = {};
  game.markDirty('des');
  game.map.touch(); // (the art moves on a stage)
  if (m.stage >= t.stages.length) { finish(game, b); return; }
  m.paid = false;
  const next = t.stages[m.stage];
  game.message(`The ${b.def.name}: ${done.name} (${done.en}) is finished. Next, stage ${m.stage + 1} of ${t.stages.length}: ${next.name} (${next.en}), ${next.money.toLocaleString('en-US')} Dn.`, 'good', b.x, b.y);
  game.events.emit('sound', { name: 'build' });
}

/** Every stage is built: Rome hears of it, the people rejoice, and it starts to need its staff. */
function finish(game, b) {
  const c = game.city;
  const m = b.mon;
  m.paid = true;
  m.store = 0;
  b.hp = monumentHp(b);
  c.ratings.favor = Math.min(100, c.ratings.favor + DONE_FAVOR);
  c.festivalBoost = (c.festivalBoost || 0) + DONE_MOOD; // fades by a fifth a month, as a festival's lift (sim/population.js)
  game.message(`The ${fullName(b.def)} is finished! Rome hears of it (favor +${DONE_FAVOR}) and the people celebrate. Staff it to put it to work.`, 'good', b.x, b.y);
  game.events.emit('sound', { name: 'festival' });
  game.events.emit('monumentFinished', b);
  // Any camp crew on it goes home: there is nothing left to build.
  for (const camp of game.buildings.values()) {
    if (camp.camp && camp.camp.crew.site === b.id && camp.camp.crew.state === 'site') sendCrewBack(game, camp, b);
  }
}

/** Halt or resume a site (its panel's button). */
export function setHalted(game, b, halted) {
  if (!b || !b.mon || isFinished(b)) return false;
  b.mon.halted = !!halted;
  if (halted) {
    for (const camp of game.buildings.values()) {
      if (camp.camp && camp.camp.crew.site === b.id && camp.camp.crew.state === 'site') sendCrewBack(game, camp, b);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// A finished monument, daily
// ---------------------------------------------------------------------------

/** Units a day a store's good is used. */
function usePerDay(store) {
  return store.perYear / (CONFIG.DAYS_PER_MONTH * 12);
}

function updateFinished(game, b) {
  const t = monumentType(b);
  const m = b.mon;
  // Patched back to full after a sacking (sim/military.js militaryDaily): open again.
  if (m.sacked && b.hp >= monumentHp(b)) {
    m.sacked = false;
    game.message(`The ${b.def.name} is repaired and open again.`, 'good', b.x, b.y);
  }
  if (t.store) {
    // It burns (eats) its good only while it would work: staffed and standing.
    if (!m.sacked && b.efficiency >= OPEN_STAFF && m.store > 0) {
      m.store -= Math.min(m.store, usePerDay(t.store)); // (booked in the goods book when its cart brought it)
      if (m.store < 1e-6) m.store = 0;
    }
    if (b.efficiency > 0 && m.store < t.store.cap / 2) sendStoreCart(game, b, t.store);
  }
  const open = closedReason(b) === null;
  if (open && b.def.mon === 'thermae') bathsAround(game, b);
  if (open !== !!m.wasOpen) {
    m.wasOpen = open;
    game.markDirty('des'); // (Venus's gardens and statues; nothing else reads it daily)
    if (!open && t.store && !(m.store > 0) && !m.sacked && b.efficiency >= OPEN_STAFF) {
      game.message(storeEmptyText(b), 'warn', b.x, b.y);
    }
  }
}

/**
 * The Thermae at work: every home within THERMAE_REACH tiles of it (as the
 * crow flies, like a fountain's reach) has the baths, as if a Balneae's
 * attendant had just passed. Daily, so a home in reach never runs out.
 */
function bathsAround(game, b) {
  const r = THERMAE_REACH;
  for (const hb of game.buildings.values()) {
    const h = hb.house;
    if (!h || h.pop <= 0) continue;
    const dx = Math.max(0, b.x - (hb.x + hb.size - 1), hb.x - (b.x + b.size - 1));
    const dy = Math.max(0, b.y - (hb.y + hb.size - 1), hb.y - (b.y + b.size - 1));
    if (Math.max(dx, dy) <= r) h.baths = Math.max(h.baths, CONFIG.ACCESS_DAYS);
  }
}

/** The panel's and the message's words for an empty store. */
export function storeEmptyText(b) {
  if (b.def.mon === 'pharus') return 'The lantern is dark: no timber. The Pharus works again once its cart brings some from a warehouse.';
  if (b.def.mon === 'thermae') return 'The furnaces are cold: no timber. The Thermae open again once its cart brings some from a warehouse.';
  return `No food for the caravans: the ${b.def.name} is closed until its cart brings some from a granary.`;
}

/** Is this one of the building's own walkers on the road with this state? */
function walkerOut(game, b, test) {
  for (const id of b.walkers) {
    const w = game.walkers.get(id);
    if (w && test(w)) return w;
  }
  return null;
}

/**
 * A finished monument's own cart, once its store is under half: to the
 * nearest staffed warehouse (timber) or granary (food) on its roads holding
 * a load, for 100 or 200 (whole loads its store has room for). One at a time.
 */
function sendStoreCart(game, b, store) {
  if (b.accessRoad < 0 || walkerOut(game, b, (w) => w.state === 'monSupply' || w.type === 'cart')) return;
  const room = store.cap - b.mon.store;
  if (room < CONFIG.CART_CAPACITY) return;
  const food = store.good === 'food';
  const found = game.pf.findNearest(b.accessRoad, (id) => {
    const s = game.buildings.get(id);
    if (!s || s.efficiency <= 0 || s.def.kind !== (food ? 'granary' : 'warehouse')) return false;
    return (food ? foodHeld(s) : s.stock[store.good] || 0) >= CONFIG.CART_CAPACITY;
  }, 80);
  if (!found) return;
  // Whole loads: 100 or 200, as its store has room for.
  const amount = Math.floor(Math.min(room, 2 * CONFIG.CART_CAPACITY) / CONFIG.CART_CAPACITY) * CONFIG.CART_CAPACITY;
  const w = spawnWalker(game, 'cart', b.accessRoad, b, { target: found.id, state: 'monSupply', want: store.good, speed: CONFIG.CART_SPEED, amount });
  if (w) followPath(game, w, found.path);
}

/** Food of every kind in a granary. */
function foodHeld(s) {
  let n = 0;
  for (const f of FOOD_TYPES) n += s.stock[f] || 0;
  return n;
}

/**
 * Take up to `amount` of food from a granary, the food it holds most of
 * first (ties in FOOD_TYPES order). @returns {{n:number, good:string|null}}
 * units taken and the main food (for the cart's art)
 */
function takeFood(s, amount) {
  let left = amount;
  let main = null;
  while (left > 0) {
    let best = null;
    for (const f of FOOD_TYPES) if ((s.stock[f] || 0) > 0 && (best === null || s.stock[f] > s.stock[best])) best = f;
    if (best === null) break;
    if (!main) main = best;
    left -= takeGoods(s, best, left);
  }
  return { n: amount - left, good: main };
}

// ---------------------------------------------------------------------------
// The work camp, daily
// ---------------------------------------------------------------------------

/** Does a well's or a working fountain's water reach one of the camp's tiles? */
export function campHasWater(game, b) {
  const { map } = game;
  for (const i of footprintTiles(map, b.x, b.y, b.size)) if (map.water[i] & (WaterBits.WELL | WaterBits.FOUNTAIN)) return true;
  return false;
}

/** The camp rule the site it serves follows (CAMP_RULES; every monument now: halfPace). */
function campRule(site) {
  return monumentType(site)?.campRule || CAMP_RULES.halfPace;
}

/**
 * A camp's supply factor: 1 fed and watered, 0.5 short of one, 0 short of
 * both. Under 'stopAfterMonth' (Nova Roma's palace, later) the half pace
 * lasts CAMP_GRACE_DAYS from the day it went short, then it stops.
 */
export function supplyFactor(game, camp, site) {
  const c = camp.camp;
  const days = c.shortSince >= 0 ? game.time.totalDays - c.shortSince : 0;
  return supplyRule(site ? campRule(site) : CAMP_RULES.halfPace, c.water, c.fed, days);
}

/**
 * The rule itself: a camp's factor with or without water and food, `days`
 * since it went short of either, under a CAMP_RULES rule.
 */
export function supplyRule(rule, water, fed, days) {
  const short = (water ? 0 : 1) + (fed ? 0 : 1);
  if (short === 0) return 1;
  if (rule === CAMP_RULES.stopAfterMonth) return days >= CAMP_GRACE_DAYS ? 0 : 0.5;
  return short === 1 ? 0.5 : 0;
}

/** Ox carts a camp fields at its staffing: 3 at 75% or more, 2 at 50%, 1 with any (the Emporium's rule). */
export function campCarts(camp) {
  const e = camp.efficiency;
  return e >= 0.75 ? 3 : e >= 0.5 ? 2 : e > 0 ? 1 : 0;
}

/** The site this camp works for: the city's monument under construction, on its roads, or null. */
export function siteFor(game, camp) {
  const site = cityMonument(game);
  if (!site || !isSite(site) || camp.accessRoad < 0 || site.accessRoad < 0) return null;
  const net = game.map.roadNet;
  return net[camp.accessRoad] && net[camp.accessRoad] === net[site.accessRoad] ? site : null;
}

/** Daily, on the camp's tick: water, food, the supply factor, the crew and the carts. */
export function updateWorkCamp(game, b) {
  const c = b.camp;
  if (!c) return;
  const site = siteFor(game, b);
  // Eat: CAMP.eatsPerMonth at full staff, in proportion below.
  if (c.larder > 0 && b.efficiency > 0) c.larder = Math.max(0, c.larder - (CAMP.eatsPerMonth / CONFIG.DAYS_PER_MONTH) * Math.min(1, b.efficiency));
  c.water = campHasWater(game, b);
  c.fed = c.larder > 0;
  if (c.water && c.fed) c.shortSince = -1;
  else if (c.shortSince < 0) c.shortSince = game.time.totalDays;
  c.factor = b.efficiency > 0 ? supplyFactor(game, b, site) : 0;
  // Told once each time it goes short while it has a site to build, a month
  // on (a new camp's buyer may be on its first trip to the granary meanwhile).
  if (site && b.efficiency > 0 && (!c.water || !c.fed)) {
    if (!c.warned && game.time.totalDays - c.shortSince >= CONFIG.DAYS_PER_MONTH) {
      c.warned = true;
      const what = !c.water && !c.fed ? 'no food and no water: work has stopped' : `no ${c.water ? 'food' : 'water'}: it works at half pace`;
      game.message(`The Castra Operarum (Work Camp) has ${what}. ${c.water ? 'Keep a granary on its roads stocked.' : 'A well or a fountain must reach it.'}`, 'warn', b.x, b.y);
    }
  } else if (c.water && c.fed) c.warned = false;
  if (b.efficiency > 0 && c.larder < CAMP.larderLow) sendFoodBuyer(game, b);
  updateCrew(game, b, site);
  dispatchCarts(game, b, site);
}

/** The camp's buyer: to the nearest staffed granary on its roads with food, for CAMP.foodLoad. */
function sendFoodBuyer(game, b) {
  if (b.accessRoad < 0 || walkerOut(game, b, (w) => w.state === 'campFood')) return;
  const found = game.pf.findNearest(b.accessRoad, (id) => {
    const s = game.buildings.get(id);
    return !!s && s.def.kind === 'granary' && s.efficiency > 0 && foodHeld(s) >= 1;
  }, 80);
  if (!found) return;
  const w = spawnWalker(game, 'buyer', b.accessRoad, b, { target: found.id, state: 'campFood' });
  if (w) followPath(game, w, found.path);
}

// ---------------------------------------------------------------------------
// The crew
// ---------------------------------------------------------------------------

/** The camp's crew walker on the road, if any. */
function crewWalker(game, camp) {
  return walkerOut(game, camp, (w) => w.type === 'builders');
}

/** The crew leaves the site and walks home (or is home at once with no road to walk). */
function sendCrewBack(game, camp, site) {
  const c = camp.camp;
  c.crew = { state: 'back', since: game.time.totalDays, site: 0 };
  const start = site && site.accessRoad >= 0 && game.map.road[site.accessRoad] ? site.accessRoad : -1;
  const w = start >= 0 ? spawnWalker(game, 'builders', start, camp, { state: 'return' }) : null;
  if (!w || !goHome(game, w)) c.crew = { state: 'home', since: game.time.totalDays, site: 0 };
}

/**
 * The crew's day: at home it sets out for a site with work to do after a
 * day's rest; on site it works CAMP.shift days, then walks home. A crew
 * whose walker was lost on the road (a road torn up) is home again; one
 * on a site that is gone, halted or finished comes home.
 */
function updateCrew(game, camp, site) {
  const c = camp.camp;
  const crew = c.crew;
  const day = game.time.totalDays;
  if ((crew.state === 'out' || crew.state === 'back') && !crewWalker(game, camp)) {
    c.crew = { state: 'home', since: day, site: 0 };
    return;
  }
  if (crew.state === 'site') {
    const at = game.buildings.get(crew.site);
    if (!at || !isSite(at) || at.mon.halted) { sendCrewBack(game, camp, at); return; }
    if (day - crew.since >= CAMP.shift) sendCrewBack(game, camp, at);
    return;
  }
  if (crew.state !== 'home' || day - crew.since < CAMP.rest) return;
  if (!site || site.mon.halted || !site.mon.paid || camp.efficiency <= 0 || c.factor <= 0) return;
  if (!(workCap(site) > site.mon.work + 1e-9)) return; // nothing to build until more goods come
  const path = game.pf.roadPath(camp.accessRoad, site.accessRoad);
  if (!path) return;
  const w = spawnWalker(game, 'builders', camp.accessRoad, camp, { target: site.id, state: 'crewOut' });
  if (!w) return;
  c.crew = { state: 'out', since: day, site: site.id };
  followPath(game, w, path);
}

/** The crew reached the site: its walker goes in, and its shift starts. */
export function crewArrive(game, w) {
  const camp = game.buildings.get(w.origin);
  const site = game.buildings.get(w.target);
  if (!camp || !camp.camp) { killWalker(game, w); return; }
  if (!site || !isSite(site) || site.mon.halted) {
    camp.camp.crew = { state: 'back', since: game.time.totalDays, site: 0 };
    w.state = 'return';
    if (!goHome(game, w)) camp.camp.crew = { state: 'home', since: game.time.totalDays, site: 0 };
    return;
  }
  killWalker(game, w);
  camp.camp.crew = { state: 'site', since: game.time.totalDays, site: site.id };
}

// ---------------------------------------------------------------------------
// The carts
// ---------------------------------------------------------------------------

/**
 * Units of each good the camps' carts have claimed at each warehouse and not
 * yet picked up: Map(warehouse id -> { good: units }). Read off the walkers.
 */
export function campClaims(game) {
  const out = new Map();
  for (const w of game.walkers.values()) {
    const c = w.campClaim;
    if (!c || w.dead || c.picked) continue;
    let o = out.get(c.wh);
    if (!o) out.set(c.wh, (o = {}));
    o[c.good] = (o[c.good] || 0) + c.amount;
  }
  return out;
}

/** The camp's carts on the road (loaded or not). */
function cartsOutOf(game, camp) {
  let n = 0;
  for (const id of camp.walkers) {
    const w = game.walkers.get(id);
    if (w && w.type === 'cart') n++;
  }
  return n;
}

/**
 * Every staffed warehouse on the road network of `from` holding `good` for
 * the camps, with its road distance: { b, dist, path, spare } nearest first
 * (one search). `spare` is its stock less the camps' claims on it.
 */
function warehousesWith(game, from, claims) {
  const out = [];
  const { map, buildings, pf } = game;
  const { w, h, building } = map;
  const seen = new Set();
  pf.bfsRoad(from, (i) => {
    const x = i % w;
    const y = (i / w) | 0;
    for (const n of [y > 0 ? i - w : -1, x < w - 1 ? i + 1 : -1, y < h - 1 ? i + w : -1, x > 0 ? i - 1 : -1]) {
      if (n < 0) continue;
      const id = building[n];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const b = buildings.get(id);
      if (b && b.def.kind === 'warehouse' && b.efficiency > 0) out.push({ b, dist: pf.reachedDist(i), goal: i });
    }
    return false;
  });
  for (const e of out) e.claimed = claims.get(e.b.id) || {};
  return out;
}

/**
 * A free cart's next trip, or null: the good the site is shortest of
 * (the lowest (delivered + on the way) / needed among the stage's goods,
 * ties in the stage table's order) that some staffed warehouse on the
 * camp's roads holds at least CAMP.minStock of (less the camps' claims);
 * from the nearest such warehouse by road, fuller ones preferred (each load
 * held counts as 4 tiles of road, as a Get cart weighs them), one set to
 * Get that good last; up to CAMP.load, no more than it holds or the site
 * still needs. Worked example: marble 800 of 1,600 and timber 200 of 800
 * delivered or coming: timber (0.25) before marble (0.5).
 */
export function planCartTrip(game, camp, site, stores = null) {
  const st = stageOf(site);
  if (!st) return null;
  stores = stores || warehousesWith(game, camp.accessRoad, campClaims(game));
  const goods = Object.keys(st.goods)
    .map((g, k) => ({ g, k, share: ((site.mon.got[g] || 0) + (site.mon.way[g] || 0)) / st.goods[g] }))
    .filter((e) => e.share < 1)
    .sort((a, b) => a.share - b.share || a.k - b.k);
  for (const { g } of goods) {
    const need = stillNeeded(site, g);
    if (need <= 0) continue;
    let best = null;
    let bestScore = Infinity;
    for (const e of stores) {
      const spare = (e.b.stock[g] || 0) - (e.claimed[g] || 0);
      if (spare < CAMP.minStock) continue;
      const getting = e.b.orders?.[g] === 'get' ? 1e6 : 0;
      const score = getting + e.dist - (4 * spare) / CONFIG.CART_CAPACITY;
      if (score < bestScore - 1e-9) { bestScore = score; best = { ...e, spare }; }
    }
    if (!best) continue;
    const amount = Math.floor(Math.min(CAMP.load, best.spare, need));
    if (amount <= 0) continue;
    return { good: g, wh: best.b, goal: best.goal, amount };
  }
  return null;
}

/**
 * Free carts take their next trips until the camp's number by staffing is
 * out: none while the camp has stopped (no staff, or neither food nor
 * water) or its site is halted; every other day at half pace.
 */
function dispatchCarts(game, camp, site) {
  if (!site || site.mon.halted || camp.efficiency <= 0 || camp.accessRoad < 0) return;
  const c = camp.camp;
  if (c.factor <= 0) return;
  if (c.factor < 1 && (game.time.totalDays + camp.id) % 2 !== 0) return; // half pace: the carts set out every other day
  const most = campCarts(camp);
  let stores = null;
  while (cartsOutOf(game, camp) < most) {
    stores = stores || warehousesWith(game, camp.accessRoad, campClaims(game));
    const plan = planCartTrip(game, camp, site, stores);
    if (!plan) break;
    const path = game.pf.roadPath(camp.accessRoad, plan.goal);
    if (!path) break;
    const w = spawnWalker(game, 'cart', camp.accessRoad, camp, { speed: CONFIG.CART_SPEED, state: 'campFetch', target: plan.wh.id });
    if (!w) break; // the city is at its walker limit
    w.campClaim = { wh: plan.wh.id, good: plan.good, amount: plan.amount, site: site.id, stage: site.mon.stage, picked: false };
    w.reserve = { id: site.id, good: plan.good, amount: plan.amount, mon: true };
    site.mon.way[plan.good] = (site.mon.way[plan.good] || 0) + plan.amount;
    // This trip's claim counts against the warehouse for the next cart.
    const e = stores.find((s) => s.b.id === plan.wh.id);
    if (e) e.claimed = { ...e.claimed, [plan.good]: (e.claimed[plan.good] || 0) + plan.amount };
    followPath(game, w, path);
  }
}

/**
 * A cart reached the warehouse it is fetching from: it loads what is there
 * (up to its claim), cuts its reservation at the site to that, and drives
 * on to the site. Nothing there, or the site gone: home empty.
 */
export function campFetchArrive(game, w) {
  const c = w.campClaim;
  const wh = game.buildings.get(w.target);
  const site = c ? game.buildings.get(c.site) : null;
  let got = 0;
  if (c && wh && isStorage(wh) && site && isSite(site) && site.mon.stage === c.stage) {
    got = takeGoods(wh, c.good, Math.min(c.amount, wh.stock[c.good] || 0));
  }
  if (got <= 0) {
    releaseReservation(game, w);
    w.campClaim = null;
    goHome(game, w);
    return;
  }
  // The reservation shrinks to what it carries.
  if (got < c.amount && w.reserve) {
    site.mon.way[c.good] = Math.max(0, (site.mon.way[c.good] || 0) - (c.amount - got));
    w.reserve.amount = got;
  }
  c.amount = got;
  c.picked = true;
  w.cargo = { good: c.good, amount: got };
  const here = game.map.idx(w.x, w.y);
  const path = game.map.road[here] && site.accessRoad >= 0 ? game.pf.roadPath(here, site.accessRoad) : null;
  if (!path) { cartToStorage(game, w); return; }
  w.state = 'campHaul';
  w.target = site.id;
  followPath(game, w, path);
}

/**
 * A loaded cart reached the site: the load is built in (booked in the goods
 * book as used), and it goes home. A site gone (demolished, razed, or its
 * stage moved on without this good) sends the load back to storage.
 */
export function campHaulArrive(game, w) {
  const c = w.campClaim;
  const site = game.buildings.get(w.target);
  releaseReservation(game, w);
  if (!c || !w.cargo || !site || !isSite(site) || site.mon.stage !== c.stage) { cartToStorage(game, w); return; }
  const st = stageOf(site);
  const room = Math.max(0, (st.goods[c.good] || 0) - (site.mon.got[c.good] || 0));
  const n = Math.min(room, w.cargo.amount);
  if (n > 0) {
    site.mon.got[c.good] = (site.mon.got[c.good] || 0) + n;
    logGoods(game, c.good, 'used', n);
    logGoods(game, c.good, 'built', n); // (the Production advisor's "built into the monument" line)
    w.cargo.amount -= n;
  }
  w.campClaim = null;
  if (w.cargo.amount > 0) { cartToStorage(game, w); return; }
  w.cargo = null;
  goHome(game, w);
}

/**
 * A camp cart with a load it cannot hand over takes it to wherever any cart
 * would take it (a workshop that uses it, else a warehouse with room): the
 * goods are not lost on the road. With nowhere to take it, it goes home
 * and the load with it is lost (as a demolished building's carts' are).
 */
export function cartToStorage(game, w) {
  // Its claim on the site first: overwritten by the storage one below, it
  // stayed counted as on its way for good, and the stage could never finish
  // (a road cut while the cart was out, review).
  releaseReservation(game, w);
  w.campClaim = null;
  const here = game.map.idx(w.x, w.y);
  const t = w.cargo && w.cargo.amount > 0 && game.map.road[here] ? findDeliveryFit(game, here, w.cargo.good, w.cargo.amount) : null;
  if (t) {
    const b = game.buildings.get(t.id);
    if (b.incoming && b.incoming[w.cargo.good] !== undefined) b.incoming[w.cargo.good] += t.amount;
    w.reserve = { id: t.id, good: w.cargo.good, amount: t.amount };
    w.target = t.id;
    w.state = 'deliver';
    followPath(game, w, t.path);
    return;
  }
  w.cargo = null;
  goHome(game, w);
}

/** A camp's food buyer at the granary: it takes up to CAMP.foodLoad and goes home. */
export function campFoodArrive(game, w) {
  const s = game.buildings.get(w.target);
  const camp = game.buildings.get(w.origin);
  if (s && camp && camp.camp && s.def.kind === 'granary') {
    const want = Math.min(CAMP.foodLoad, CAMP.larder - camp.camp.larder);
    const got = takeFood(s, want);
    if (got.n > 0) w.cargo = { good: got.good, amount: got.n };
  }
  goHome(game, w);
}

/** A monument's own cart at the store: up to its load of timber (or food), and home. */
export function monSupplyArrive(game, w) {
  const s = game.buildings.get(w.target);
  const b = game.buildings.get(w.origin);
  if (s && b && b.mon && isStorage(s)) {
    if (w.want === 'food') {
      if (s.def.kind === 'granary') {
        const got = takeFood(s, w.amount || 0);
        if (got.n > 0) w.cargo = { good: got.good, amount: got.n };
      }
    } else {
      const n = takeGoods(s, w.want, w.amount || 0);
      if (n > 0) w.cargo = { good: w.want, amount: n };
    }
  }
  goHome(game, w);
}

/**
 * One of a camp's or a monument's walkers is home (sim/walkers.js
 * returnHome): the buyer's food goes in the larder, the store cart's load
 * in the monument's store (booked as used), the crew rests; then it is gone.
 */
export function monumentWalkerHome(game, w, home) {
  if (w.type === 'builders' && home.camp) home.camp.crew = { state: 'home', since: game.time.totalDays, site: 0 };
  if (w.cargo && w.cargo.amount > 0) {
    if (w.state === 'return' && home.camp && FOOD_TYPES.includes(w.cargo.good)) {
      home.camp.larder = Math.min(CAMP.larder, home.camp.larder + w.cargo.amount);
      logGoods(game, w.cargo.good, 'used', w.cargo.amount);
    } else if (home.mon && monumentType(home)?.store) {
      const store = monumentType(home).store;
      home.mon.store = Math.min(store.cap, home.mon.store + w.cargo.amount);
      logGoods(game, w.cargo.good, 'used', w.cargo.amount);
    }
  }
  w.cargo = null;
  killWalker(game, w);
}

// ---------------------------------------------------------------------------
// Upkeep, monthly
// ---------------------------------------------------------------------------

/** A finished monument's upkeep this month at the city's difficulty (Dn), or 0. */
export function monumentUpkeep(game, b = cityMonument(game)) {
  if (!b || !isFinished(b)) return 0;
  return Math.round(monumentType(b).upkeep * (game.difficulty.monumentUpkeep ?? 1));
}

/** Monthly, with the wages: a finished monument's upkeep (it may run the treasury into debt, as wages do). */
export function monumentsMonthly(game) {
  const n = monumentUpkeep(game);
  if (n > 0) transact(game, 'monuments', -n);
  // A site whose stage has waited a whole month for a good no warehouse on
  // its camps' roads holds is told about, once a month at most (the panel
  // and the Problems overlay say it all along).
  const b = cityMonument(game);
  if (!b || !isSite(b) || b.mon.halted) return;
  const short = /^No \w+ in any warehouse/.test(siteStatus(game, b).text);
  if (short && b.mon.short) game.message(`The ${b.def.name}: ${siteStatus(game, b).text}`, 'warn', b.x, b.y);
  b.mon.short = short;
}

// ---------------------------------------------------------------------------
// Raids
// ---------------------------------------------------------------------------

/**
 * A monument at 0 hit points (sim/military.js damageBuilding). On Insane
 * (difficulty monumentRaze) it is razed like any building: the caller goes
 * on to bring it down, and returns false here. Elsewhere it never falls:
 *   - a site is set back: the stage under way loses RAID_WORK_LOSS of its
 *     work and RAID_GOODS_LOSS of each good delivered (whole units, rounded
 *     down: smashed and carried off), its hit points refill, finished stages
 *     stand; once a raid (raidKey), and raiders then walk on past it;
 *   - a finished monument is sacked: closed until it is patched back to full.
 * @returns {boolean} true when handled here (nothing falls)
 */
export function monumentStruck(game, b) {
  if (game.difficulty.monumentRaze) return false;
  const m = b.mon;
  // One setback a raid: struck on and on, a site lost about four fifths of
  // its stage's goods in one raid, not the quarter decided (review).
  if (!isFinished(b) && m.setbackRaid === raidKey(game)) { b.hp = 0; return true; }
  if (isFinished(b)) {
    b.hp = 0;
    if (m.sacked) return true;
    m.sacked = true;
    game.enemyFieldTick = -Infinity; // raiders make for something else at once (monumentSpent)
    game.markDirty('des');
    game.message(`The ${b.def.name} has been sacked! It is closed until it is repaired, which starts once the fighting stops.`, 'bad', b.x, b.y);
    return true;
  }
  setBack(b);
  m.setbackRaid = raidKey(game);
  game.enemyFieldTick = -Infinity; // raiders make for something else at once (monumentSpent)
  b.hp = monumentHp(b);
  const st = stageOf(b);
  game.message(`Raiders have struck the ${b.def.name}'s site: half the work on ${st.name} (${st.en}) is undone and a quarter of its goods are lost. The stages finished before it stand.`, 'bad', b.x, b.y);
  return true;
}

/**
 * Which raid is striking now, for one setback a raid: the warband's id while
 * one is in the province, else a 30-day window (angry villagers, Caesar's
 * legion and the like strike outside a raid).
 */
export function raidKey(game) {
  const inv = game.military.active;
  return inv ? `raid:${inv.id}` : `days:${Math.floor(game.time.totalDays / 30)}`;
}

/**
 * Has a monument nothing more to lose to this raid (outside Insane)? A
 * finished one sacked, or a site already set back by it: raiders walk on
 * past it rather than stand there striking (military.js), and its repairs
 * wait for the fighting to stop either way.
 */
export function monumentSpent(game, b) {
  if (!b.mon || game.difficulty.monumentRaze) return false;
  return isFinished(b) ? !!b.mon.sacked : b.mon.setbackRaid === raidKey(game);
}

/** The raid's setback on a site's stage under way (worked example: 60 work, marble 1,000: 30 and 750). */
export function setBack(b) {
  const m = b.mon;
  m.work = m.work * (1 - RAID_WORK_LOSS);
  for (const g of Object.keys(m.got)) m.got[g] = m.got[g] - Math.floor(m.got[g] * RAID_GOODS_LOSS);
}

/** The words for a monument's state in the panels: the first thing holding a site up, or a finished one's. */
export function siteStatus(game, b) {
  const t = monumentType(b);
  const m = b.mon;
  if (isFinished(b)) {
    const why = closedReason(b);
    if (!why) return { level: 'good', text: 'Open: its effects are in force.' };
    if (why === 'sacked') return { level: 'bad', text: 'Sacked by raiders: closed until it is repaired (once the fighting stops).' };
    if (why === 'staff') return { level: 'bad', text: `Too few hands: the ${b.def.name} is closed (it needs ${Math.ceil(b.def.workers * OPEN_STAFF)} of its ${b.def.workers} workers).` };
    if (why === 'store') return { level: 'bad', text: storeEmptyText(b) };
    if (why === 'water') return { level: 'bad', text: 'No piped water: the Thermae need a full reservoir\'s piped area.' };
    return { level: 'warn', text: why };
  }
  const st = stageOf(b);
  const camps = [...game.buildings.values()].filter((x) => x.def.kind === 'work_camp');
  const serving = camps.filter((x) => siteFor(game, x) === b);
  if (m.halted) return { level: 'warn', text: 'Halted: no carts set out and the crews stay home. Resume to go on.' };
  if (!camps.length) return { level: 'bad', text: 'No Castra Operarum (Work Camp): build one, on the same roads, to raise it.' };
  if (!serving.length) return { level: 'bad', text: 'No Castra Operarum (Work Camp) on the same roads as the site.' };
  if (serving.every((x) => x.efficiency <= 0)) return { level: 'bad', text: 'The work camp has no workers.' };
  if (serving.every((x) => x.efficiency <= 0 || x.camp.factor <= 0)) return { level: 'bad', text: 'The work camp has no food and no water: work has stopped.' };
  if (!m.paid) return { level: 'warn', text: `Waiting for ${st.money.toLocaleString('en-US')} Dn to start this stage (the carts already haul its goods).` };
  // A good still to come that no warehouse on the camps' roads holds.
  const wanted = Object.keys(st.goods).filter((g) => stillNeeded(b, g) > 0 && !(m.way[g] > 0));
  if (wanted.length) {
    // One search a camp, whatever the number of goods (the Problems overlay asks often).
    const claims = campClaims(game);
    const stores = serving.flatMap((camp) => warehousesWith(game, camp.accessRoad, claims));
    const lacking = wanted.find((g) => !stores.some((e) => (e.b.stock[g] || 0) - (e.claimed[g] || 0) >= CAMP.minStock));
    if (lacking) return { level: 'warn', text: `No ${lacking} in any warehouse on the camp's roads: make or buy ${lacking} and store it there.` };
  }
  if (m.work >= workCap(b) - 1e-9 && !goodsComplete(b)) {
    const short = Object.keys(st.goods).find((g) => (m.got[g] || 0) < st.goods[g] && ((m.got[g] || 0) / st.goods[g]) <= goodsShare(b) + 1e-9);
    return { level: 'warn', text: `Builders are waiting for ${short || 'goods'}.` };
  }
  const half = serving.find((x) => x.efficiency > 0 && x.camp.factor > 0 && x.camp.factor < 1);
  if (half) return { level: 'warn', text: `The camp has no ${half.camp.water ? 'food' : 'water'}: working at half pace.` };
  return { level: 'good', text: `Building stage ${m.stage + 1} of ${t.stages.length}.` };
}

/** "Mars" for a Fanum's god (panels). */
export function deityName(b) {
  return b.def.deity ? GODS[b.def.deity]?.name || b.def.deity : null;
}
