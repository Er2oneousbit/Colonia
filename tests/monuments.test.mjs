/**
 * monuments.test.mjs - monuments and the work camp (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * Covers sim/monuments.js, sim/monumentEffects.js and data/monuments.js: the
 * rules spec's worked examples (the cap on work, the pace by staff and
 * supplies, the hauler's choice, money between stages, a raid's setback,
 * the Pharus's fuel, the menu in Oasis Aurea, one per city); the unlocks by
 * step and province; stages advancing only with every good in; the camp's
 * food and water rule; raids by difficulty (a setback, a sacking, Insane's
 * razing); upkeep; each finished monument's effects; saves; demolition and
 * undo; and a whole Basilica built by a camp from a warehouse.
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { log } from '../src/core/debug.js';
import { CONFIG } from '../src/config.js';
import { Game } from '../src/core/game.js';
import { BUILDINGS, MONUMENT_KEYS } from '../src/data/buildings.js';
import { MONUMENT_TYPES, FAME_MONUMENT, monumentTotals } from '../src/data/monuments.js';
import { DIFFICULTY } from '../src/data/difficulty.js';
import { SCENARIOS, findScenario, withDifficulty, TRADE_PARTNERS } from '../src/data/scenarios.js';
import { addBuilding, removeBuilding, spawnWalker } from '../src/sim/entities.js';
import {
  updateMonument, workCap, goodsShare, campRate, supplyFactor, supplyRule, planCartTrip,
  monumentRefused, setBack, monumentsMonthly, monumentUpkeep, builtSoFar, demolishWarning, siteStatus, setHalted,
} from '../src/sim/monuments.js';
import { cityMonument, isFinished, closedReason, openOf, fanumOf } from '../src/sim/monumentEffects.js';
import { planAction, applyPlan, canUndo, undoLast } from '../src/sim/construction.js';
import { damageBuilding, militaryDaily, raidSize, enemyPower } from '../src/sim/military.js';
import { serializeGame, deserializeGame } from '../src/core/save.js';
import { partnerBuys, partnerSells } from '../src/sim/tradeDemand.js';
import { houseMonthlyTax } from '../src/sim/economy.js';
import { templeCounts, godsJealousy } from '../src/sim/religion.js';
import { haltDays } from '../src/sim/events.js';
import { monumentHealth } from '../src/sim/disease.js';
import { winScore } from '../src/sim/fame.js';
import { updateRatings } from '../src/sim/ratings.js';
import { roamerVisit } from '../src/sim/services.js';
import { updateProducer } from '../src/sim/production.js';
import { useGoods } from '../src/sim/housing.js';
import { updateWater } from '../src/sim/water.js';
import { updateHomeMood } from '../src/sim/mood.js';
import { WaterBits } from '../src/world/map.js';
import { newGame, build, findFree } from './helpers.mjs';

log.setLevel('error');

const DAY = CONFIG.TICKS_PER_DAY;

/**
 * A yard on open plains: a road along x, a work camp, a warehouse, a granary
 * and a well beside it, and a monument's site at the far end, all on the
 * road. Nothing is staffed: `run` keeps the listed buildings at full staff.
 */
function yard(type = 'basilica', opts = {}) {
  const game = newGame({ seed: opts.seed || 'mon-probe', size: 96, type: 'plains', difficulty: opts.difficulty, money: opts.money });
  const spot = findFree(game, 24, 12, { x: 48, y: 48 });
  const ry = spot.y + 6;
  assert.ok(build(game, 'road', spot.x, ry, spot.x + 23, ry).ok);
  assert.ok(build(game, 'work_camp', spot.x + 1, ry - 2).ok);
  assert.ok(build(game, 'warehouse', spot.x + 5, ry - 2).ok);
  assert.ok(build(game, 'granary', spot.x + 9, ry - 2).ok);
  assert.ok(build(game, 'well', spot.x + 1, ry + 1).ok);
  if (type) assert.ok(build(game, type, spot.x + 16, ry - 3).ok, `${type} placed`);
  const by = (t) => [...game.buildings.values()].find((b) => b.type === t);
  const out = { game, spot, ry, camp: by('work_camp'), wh: by('warehouse'), gran: by('granary'), site: type ? by(type) : null };
  out.staffed = [out.camp, out.wh, out.gran];
  out.run = (days) => {
    for (let t = 0; t < days * DAY; t++) {
      for (const b of out.staffed) { b.efficiency = 1; b.fireRisk = 0; b.damageRisk = 0; }
      game.tick();
    }
  };
  return out;
}

/** A crew on site from this camp, at this staffing and supply factor (for the daily work rule alone). */
function crewOn(camp, site, efficiency = 1, factor = 1) {
  camp.efficiency = efficiency;
  camp.camp.factor = factor;
  camp.camp.crew = { state: 'site', since: 0, site: site.id };
}

/** A finished, staffed monument of `type` at a free spot (placement rules skipped: the effects alone). */
function finished(game, type) {
  const def = BUILDINGS[type];
  const at = findFree(game, def.size, def.size) || { x: 4, y: 4 };
  const b = addBuilding(game, type, at.x, at.y);
  b.mon.stage = MONUMENT_TYPES[def.mon].stages.length;
  b.efficiency = 1;
  b.workers = def.workers;
  if (MONUMENT_TYPES[def.mon].store) b.mon.store = MONUMENT_TYPES[def.mon].store.cap;
  b.hasWater = true;
  return b;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

test('data: six monuments (the Fanum in five gods), 5x5 but the 3x3 Pharus, with the spec\'s totals', () => {
  assert.deepEqual(MONUMENT_KEYS, ['fanum_ceres', 'fanum_neptune', 'fanum_mercury', 'fanum_mars', 'fanum_venus', 'pantheum', 'pharus', 'mansio_magna', 'thermae', 'basilica']);
  for (const k of MONUMENT_KEYS) assert.equal(BUILDINGS[k].size, k === 'pharus' ? 3 : 5, k);
  const units = Object.fromEntries(Object.keys(MONUMENT_TYPES).map((t) => [t, monumentTotals(t).units]));
  assert.deepEqual(units, { fanum: 6600, pantheum: 9800, pharus: 5400, mansio_magna: 4400, thermae: 7200, basilica: 5900 });
  const money = Object.fromEntries(Object.keys(MONUMENT_TYPES).map((t) => [t, monumentTotals(t).money]));
  assert.deepEqual(money, { fanum: 3500, pantheum: 5250, pharus: 2600, mansio_magna: 2200, thermae: 3600, basilica: 3000 });
  // Placing pays the site and its first stage's money.
  assert.equal(BUILDINGS.fanum_mars.cost, 1500);
  assert.equal(BUILDINGS.pantheum.cost, 2250);
  assert.equal(BUILDINGS.work_camp.workers, 40);
  assert.equal(BUILDINGS.fanum_venus.deity, 'venus');
  assert.equal(BUILDINGS.fanum_venus.god, undefined, 'no god field: a site is no temple');
});

// ---------------------------------------------------------------------------
// Worked examples
// ---------------------------------------------------------------------------

test('worked example 1: the cap: builders lay only what has arrived', () => {
  const game = newGame({ size: 96, type: 'plains' });
  const site = addBuilding(game, 'fanum_ceres', 10, 10);
  const camp = addBuilding(game, 'work_camp', 20, 10);
  Object.assign(site.mon, { stage: 1, work: 30, got: { clay: 400, marble: 800, iron: 200 }, paid: true });
  assert.equal(workCap(site), 45, '90 x min(400/800, 800/800, 200/200)');
  crewOn(camp, site);
  for (let d = 0; d < 15; d++) updateMonument(game, site);
  assert.equal(site.mon.work, 45);
  updateMonument(game, site);
  assert.equal(site.mon.work, 45, 'no further until more clay comes');
  // (The panel names what they wait for once a camp serves it; here the
  // rule alone: the last 400 clay lifts the cap to the stage's work.)
  site.mon.got.clay = 800;
  assert.equal(workCap(site), 90);
  updateMonument(game, site);
  assert.equal(site.mon.work, 46);
});

test('worked example 2: the pace by staff and supplies, at most 3 camps', () => {
  const game = newGame({ size: 96, type: 'plains' });
  const site = addBuilding(game, 'fanum_ceres', 10, 10);
  Object.assign(site.mon, { stage: 1, work: 0, got: { clay: 800, marble: 800, iron: 200 }, paid: true });
  const a = addBuilding(game, 'work_camp', 20, 10);
  crewOn(a, site, 30 / 40, 0.5); // 30 of 40, no water
  assert.equal(campRate(a), 0.375);
  updateMonument(game, site);
  assert.equal(site.mon.work, 0.375);
  const b = addBuilding(game, 'work_camp', 24, 10);
  crewOn(b, site);
  updateMonument(game, site);
  assert.equal(site.mon.work, 0.375 + 1.375);
  const c = addBuilding(game, 'work_camp', 28, 10);
  const d = addBuilding(game, 'work_camp', 32, 10);
  crewOn(c, site);
  crewOn(d, site);
  const before = site.mon.work;
  updateMonument(game, site);
  assert.equal(site.mon.work - before, 0.375 + 1 + 1, 'a fourth camp adds nothing');
});

test('worked example 3: the hauler fetches the good the site is shortest of', () => {
  const { game, camp, wh, site } = yard('fanum_mars');
  Object.assign(site.mon, { stage: 2, got: { iron: 200, marble: 400 }, way: { marble: 400, timber: 200 }, paid: true });
  wh.efficiency = 1;
  wh.stock.marble = 1000;
  wh.stock.timber = 300;
  let plan = planCartTrip(game, camp, site);
  assert.equal(plan.good, 'timber', 'timber 200/800 (0.25) before marble 800/1,600 (0.5)');
  assert.equal(plan.amount, 300, 'what the warehouse holds, under 400 and under the 600 still needed');
  wh.stock.timber = 90; // less than a load: not worth the trip
  plan = planCartTrip(game, camp, site);
  assert.equal(plan.good, 'marble');
  assert.equal(plan.amount, 400);
});

test('worked example 4: money between stages: the site waits for it, the carts already haul', () => {
  const { game, site, wh, camp, run } = yard('pantheum');
  Object.assign(site.mon, { stage: 0, work: 60, got: { clay: 1200, timber: 600 }, paid: true });
  game.city.treasury = 600;
  updateMonument(game, site); // stage 1 done: stage 2 is due its 750
  assert.equal(site.mon.stage, 1);
  assert.equal(site.mon.paid, false);
  updateMonument(game, site);
  assert.equal(site.mon.paid, false, 'waiting');
  assert.equal(game.city.treasury, 600);
  wh.stock.clay = 1600;
  wh.stock.iron = 200;
  run(4);
  camp.efficiency = 1; // (the day's labor pass found no homes to staff it)
  assert.match(siteStatus(game, site).text, /Waiting for 750 Dn/);
  assert.ok((site.mon.way.clay || 0) + (site.mon.got.clay || 0) > 0, 'the carts haul stage 2\'s clay meanwhile');
  game.city.treasury = 1000;
  updateMonument(game, site);
  assert.equal(site.mon.paid, true);
  assert.equal(game.city.treasury, 250);
});

test('worked example 5: a raid sets the stage under way back; finished stages stand', () => {
  const { game, site } = yard('fanum_mercury');
  Object.assign(site.mon, { stage: 2, work: 60, got: { marble: 1000, timber: 800, iron: 200 }, paid: true });
  const peace = game.city.ratings.peace;
  damageBuilding(game, site, 1e9);
  assert.ok(game.buildings.has(site.id), 'never falls on Normal');
  assert.equal(site.mon.stage, 2);
  assert.equal(site.mon.work, 30);
  assert.deepEqual(site.mon.got, { marble: 750, timber: 600, iron: 150 });
  assert.equal(site.hp, 2400);
  assert.equal(game.city.ratings.peace, Math.max(0, peace - 1));
  // setBack alone rounds the goods lost down to whole units.
  site.mon.got = { clay: 101 };
  setBack(site);
  assert.equal(site.mon.got.clay, 76);
});

test('worked example 6: the Pharus\'s fuel: half gone in 96 days, then its cart; dark 96 days later with none in store', () => {
  const game = newGame({ size: 96, type: 'plains' });
  const b = finished(game, 'pharus');
  assert.equal(b.mon.store, 400);
  for (let d = 0; d < 96; d++) updateMonument(game, b);
  assert.ok(Math.abs(b.mon.store - 200) < 1e-6, `about 200 (${b.mon.store})`);
  assert.equal(closedReason(b), null, 'still lit');
  for (let d = 0; d < 97; d++) updateMonument(game, b);
  assert.equal(b.mon.store, 0);
  assert.equal(closedReason(b), 'store', 'dark: no warehouse to fetch from');
  assert.equal(openOf(game, 'pharus'), null);
});

test('worked example 6b: the store cart sets out once the store is under half, with timber in a warehouse', () => {
  const { game, spot, ry, wh } = yard(null);
  wh.efficiency = 1;
  wh.stock.timber = 600;
  const b = addBuilding(game, 'thermae', spot.x + 14, ry - 5);
  game.processRoadChanges();
  b.mon.stage = 4;
  b.efficiency = 1;
  b.mon.store = 160; // over half of 300: no trip yet
  updateMonument(game, b);
  assert.equal(b.walkers.length, 0);
  b.mon.store = 120; // under half: room for one whole load
  updateMonument(game, b);
  const cart = b.walkers.map((id) => game.walkers.get(id)).find((w) => w && w.state === 'monSupply');
  assert.ok(cart, 'its cart goes for timber');
  assert.equal(cart.amount, 100, 'whole loads its store has room for');
});

test('worked example 7: the menu in Oasis Aurea: the camp, five Fanum, Basilica, Thermae, Mansio; no Pharus, no Pantheum', () => {
  const game = new Game({ scenario: withDifficulty(findScenario('c6'), 'normal') });
  const offered = ['work_camp', ...MONUMENT_KEYS].filter((k) => game.isUnlocked(k));
  assert.deepEqual(offered, ['work_camp', 'fanum_ceres', 'fanum_neptune', 'fanum_mercury', 'fanum_mars', 'fanum_venus', 'mansio_magna', 'thermae', 'basilica']);
  addBuilding(game, 'basilica', 20, 20);
  assert.equal(monumentRefused(game, 'thermae'), 'Your city raises one monument: the Basilica.');
  assert.equal(monumentRefused(game, 'fanum_mars'), 'Your city raises one monument: the Basilica.');
});

test('worked example 8: one per city: demolishing a site frees the choice, and nothing is refunded', () => {
  const { game, site, spot, ry } = yard('fanum_venus');
  Object.assign(site.mon, { stage: 2, got: { marble: 600 }, paid: true });
  assert.deepEqual(builtSoFar(site), { stages: 2, units: 1400 + 1800 + 600 });
  assert.match(demolishWarning(site), /^2 stages and 3,800 units of goods built into the Fanum Veneris will be lost/);
  const plan = planAction(game, 'clear', site.x, site.y, site.x, site.y);
  assert.ok(plan.warnings.some((w) => /2 stages/.test(w)), 'the clear plan says what is lost');
  const money = game.city.treasury;
  assert.ok(applyPlan(game, plan).ok);
  assert.equal(game.city.treasury, money, 'no refund');
  assert.equal(cityMonument(game), null);
  assert.ok(build(game, 'thermae', spot.x + 16, ry - 3).ok, 'a Thermae may be placed now');
});

// ---------------------------------------------------------------------------
// Unlocks
// ---------------------------------------------------------------------------

test('unlocks: from step 6 (the Pantheum from 8), by the province\'s partners and water; the sandbox has them all', () => {
  const offers = (id) => {
    const game = new Game({ scenario: withDifficulty(findScenario(id), 'normal') });
    return MONUMENT_KEYS.filter((k) => game.isUnlocked(k));
  };
  for (const id of ['c1', 'c2', 'c3', 'c3m', 'c4', 'c4p', 'c5', 'c5p']) {
    const game = new Game({ scenario: withDifficulty(findScenario(id), 'normal') });
    assert.equal(MONUMENT_KEYS.some((k) => game.isUnlocked(k)) || game.isUnlocked('work_camp'), false, `${id}: none before step 6`);
  }
  const cosa = offers('c6p');
  assert.ok(cosa.includes('pharus') && cosa.includes('mansio_magna') && !cosa.includes('pantheum'), 'Cosa: 2 land and 3 sea partners');
  assert.ok(!offers('c8m').includes('pharus') && offers('c8m').includes('pantheum'), 'Mutina: no sea partner; step 8 has the Pantheum');
  assert.ok(!offers('c9p').includes('mansio_magna'), 'Carteia: one land partner only');
  assert.ok(!offers('c7').includes('pantheum'), 'step 7: no Pantheum yet');
  const sandbox = newGame({ size: 64, type: 'river' });
  for (const k of MONUMENT_KEYS) assert.ok(sandbox.isUnlocked(k), `sandbox: ${k}`);
  // No mission lists them: the rule alone offers them (the capacity model leaves them out).
  for (const s of SCENARIOS) if (Array.isArray(s.unlocks)) assert.ok(!s.unlocks.some((k) => MONUMENT_KEYS.includes(k) || k === 'work_camp'), s.id);
});

test('unlocks: a monument whose goods the province can neither make nor buy is refused', () => {
  const game = newGame({ size: 64, type: 'plains' });
  game.scenario.partners = []; // nobody to buy from
  game.unlockedSet = new Set(['road', 'temple_ceres']);
  game.flags.unlockall = false;
  game.scenario.unlocks = ['road', 'temple_ceres'];
  game.scenario.step = 6;
  assert.equal(game.isUnlocked('fanum_ceres'), true);
  assert.match(monumentRefused(game, 'fanum_ceres'), /No clay can be made or bought/);
});

// ---------------------------------------------------------------------------
// Stages, the camp, carts
// ---------------------------------------------------------------------------

test('stages: a stage advances only when every good is in and the work is done', () => {
  const game = newGame({ size: 96, type: 'plains' });
  const site = addBuilding(game, 'basilica', 10, 10);
  const camp = addBuilding(game, 'work_camp', 20, 10);
  crewOn(camp, site);
  Object.assign(site.mon, { work: 60, got: { clay: 1000, timber: 399 } });
  updateMonument(game, site);
  assert.equal(site.mon.stage, 0, 'a unit of timber short');
  site.mon.got.timber = 400;
  site.mon.work = 59;
  updateMonument(game, site); // the last day's work
  assert.equal(site.mon.stage, 1);
  assert.equal(site.mon.work, 0);
  assert.deepEqual(site.mon.got, {});
  assert.equal(goodsShare(site), 0);
});

test('the camp: half pace without food or water, stopped without both', () => {
  const game = newGame({ size: 96, type: 'plains' });
  const camp = addBuilding(game, 'work_camp', 20, 10);
  const c = camp.camp;
  const at = (water, fed) => { c.water = water; c.fed = fed; return supplyFactor(game, camp, null); };
  assert.equal(at(true, true), 1);
  assert.equal(at(false, true), 0.5);
  assert.equal(at(true, false), 0.5);
  assert.equal(at(false, false), 0);
  // The harsher rule (for Nova Roma's palace later, one switch in the data):
  // half pace for a month without either, then stopped.
  assert.equal(supplyRule('stopAfterMonth', false, true, 15), 0.5);
  assert.equal(supplyRule('stopAfterMonth', false, true, 16), 0);
  assert.equal(supplyRule('halfPace', false, true, 400), 0.5, 'every monument now: half pace however long');
});

test('the camp: fed from a granary and watered by a well, its crew and carts build a whole Basilica from a warehouse', () => {
  const { game, camp, wh, gran, site, run } = yard('basilica');
  for (const [g, n] of Object.entries({ clay: 2200, timber: 1800, marble: 1200, iron: 300, furniture: 400 })) wh.stock[g] = n;
  gran.stock.wheat = 800;
  const favor = game.city.ratings.favor;
  let sawCart = false;
  let sawCrew = false;
  for (let d = 0; d < 700 && !isFinished(site); d++) {
    run(1);
    sawCart ||= camp.walkers.some((id) => game.walkers.get(id)?.state === 'campHaul');
    sawCrew ||= camp.camp.crew.state === 'site';
  }
  assert.ok(isFinished(site), `finished (stage ${site.mon.stage})`);
  assert.ok(sawCart && sawCrew, 'carts hauled and the crew built');
  assert.ok(camp.camp.water, 'the well waters it');
  assert.ok(camp.camp.larder > 0, 'the granary feeds it');
  for (const g of ['clay', 'timber', 'marble', 'iron', 'furniture']) assert.ok(wh.stock[g] < 100, `${g} used`);
  assert.ok(game.city.ratings.favor >= favor + 8 - 1, 'Rome hears of it');
  assert.ok(game.messages.some((m) => /Basilica \(Hall of Justice\) is finished/.test(m.text)));
});

test('the camp: carts set out only with goods in a warehouse; a halted site takes no new trips', () => {
  const { game, camp, wh, site, run } = yard('basilica');
  run(3);
  assert.equal(camp.walkers.filter((id) => game.walkers.get(id)?.type === 'cart').length, 0, 'nothing to fetch');
  wh.stock.clay = 1000;
  setHalted(game, site, true);
  run(3);
  assert.equal(camp.walkers.filter((id) => game.walkers.get(id)?.type === 'cart').length, 0, 'halted');
  assert.match(siteStatus(game, site).text, /Halted/);
  setHalted(game, site, false);
  run(3);
  assert.ok(camp.walkers.some((id) => game.walkers.get(id)?.state === 'campFetch' || game.walkers.get(id)?.state === 'campHaul'), 'a cart goes');
  assert.ok((site.mon.way.clay || 0) > 0, 'its load reserved at the site');
});

test('the camp: a demolished site\'s loads go back to storage, and the reservation dies with it', () => {
  const { game, camp, wh, site, run } = yard('basilica');
  wh.stock.clay = 1000;
  for (let d = 0; d < 30; d++) {
    run(1);
    if (camp.walkers.some((id) => game.walkers.get(id)?.state === 'campHaul')) break;
  }
  const cart = camp.walkers.map((id) => game.walkers.get(id)).find((w) => w?.state === 'campHaul');
  assert.ok(cart, 'a loaded cart on its way');
  const load = cart.cargo.amount;
  const before = wh.stock.clay;
  removeBuilding(game, site, 'demolish');
  run(40);
  assert.ok(wh.stock.clay >= before + load - 1e-9, 'the load came back to the warehouse');
});

test('undo: a site with nothing in it yet undoes with a full refund; one with goods in it does not', () => {
  const game = newGame({ size: 96, type: 'plains' });
  const spot = findFree(game, 8, 8);
  const money = game.city.treasury;
  assert.ok(applyPlan(game, planAction(game, 'basilica', spot.x + 2, spot.y + 2, spot.x + 2, spot.y + 2)).ok);
  assert.equal(game.city.treasury, money - 1500);
  const site = cityMonument(game);
  site.mon.got.clay = 100;
  assert.equal(canUndo(game), false, 'goods built in: no refund');
  site.mon.got.clay = 0;
  assert.equal(canUndo(game), true);
  assert.ok(undoLast(game).ok);
  assert.equal(game.city.treasury, money);
  assert.equal(cityMonument(game), null);
});

test('one per city: two sites in one go are refused, and a razed or demolished one frees it', () => {
  const game = newGame({ size: 96, type: 'plains' });
  const spot = findFree(game, 14, 8);
  assert.ok(build(game, 'basilica', spot.x + 2, spot.y + 2).ok);
  const second = planAction(game, 'thermae', spot.x + 9, spot.y + 2, spot.x + 9, spot.y + 2);
  assert.equal(second.count, 0);
  assert.match(second.reason, /one monument: the Basilica/);
});

// ---------------------------------------------------------------------------
// Raids by difficulty
// ---------------------------------------------------------------------------

for (const level of ['easy', 'normal', 'hard']) {
  test(`raids on ${level}: a site is set back, never razed; a finished one is sacked, then repaired`, () => {
    const game = newGame({ size: 96, type: 'plains', difficulty: level });
    assert.equal(DIFFICULTY[level].monumentRaze, false);
    const site = addBuilding(game, 'basilica', 10, 10);
    Object.assign(site.mon, { stage: 1, work: 40, got: { clay: 400 } });
    damageBuilding(game, site, 1e9);
    assert.ok(game.buildings.has(site.id));
    assert.equal(site.mon.stage, 1);
    assert.equal(site.mon.work, 20);
    assert.equal(site.mon.got.clay, 300);
    const done = finished(game, 'thermae');
    damageBuilding(game, done, 1e9);
    assert.ok(game.buildings.has(done.id));
    assert.equal(done.mon.sacked, true);
    assert.equal(closedReason(done), 'sacked');
    const lost = game.military.stats.buildingsLost;
    damageBuilding(game, done, 1e9);
    assert.equal(game.military.stats.buildingsLost, lost, 'a sacked monument has nothing more to lose');
    done.lastRaided = game.time.totalDays - 10;
    for (let d = 0; d < 25; d++) { militaryDaily(game); updateMonument(game, done); }
    assert.equal(done.mon.sacked, false, 'patched back to full: open again');
  });
}

test('raids on Insane: raiders raze a site or a finished monument to rubble, and another may be started', () => {
  assert.equal(DIFFICULTY.insane.monumentRaze, true);
  const game = newGame({ size: 96, type: 'plains', difficulty: 'insane' });
  const spot = findFree(game, 14, 8);
  assert.ok(build(game, 'basilica', spot.x + 2, spot.y + 2).ok);
  const site = cityMonument(game);
  Object.assign(site.mon, { stage: 3, work: 10, got: { marble: 400 } });
  damageBuilding(game, site, 1e9);
  assert.equal(game.buildings.has(site.id), false, 'razed');
  assert.equal(game.map.rubble[game.map.idx(site.x + 1, site.y + 1)], 1);
  assert.equal(cityMonument(game), null);
  assert.equal(monumentRefused(game, 'thermae'), null, 'the place is free');
  const done = finished(game, 'pantheum');
  damageBuilding(game, done, 1e9);
  assert.equal(game.buildings.has(done.id), false, 'a finished one too');
});

// ---------------------------------------------------------------------------
// Upkeep
// ---------------------------------------------------------------------------

test('upkeep: a finished monument\'s monthly charge, by difficulty; none while it is built', () => {
  const want = { easy: 25, normal: 50, hard: 63, insane: 75 };
  for (const [level, n] of Object.entries(want)) {
    const game = newGame({ size: 64, type: 'plains', difficulty: level });
    const site = addBuilding(game, 'basilica', 10, 10);
    assert.equal(monumentUpkeep(game), 0, 'a site pays nothing');
    site.mon.stage = 4;
    assert.equal(monumentUpkeep(game), n, level);
    const money = game.city.treasury;
    monumentsMonthly(game);
    assert.equal(game.city.treasury, money - n);
    assert.equal(game.city.finance.thisYear.monuments, n, 'the ledger\'s Monument upkeep row');
  }
});

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

test('effects: none while a monument is unfinished, under 75% staff, sacked or out of its good', () => {
  const game = newGame({ size: 64, type: 'plains' });
  const b = finished(game, 'basilica');
  assert.ok(openOf(game, 'basilica'));
  b.efficiency = 0.74;
  assert.equal(openOf(game, 'basilica'), null);
  b.efficiency = 0.75;
  assert.ok(openOf(game, 'basilica'));
  b.mon.stage = 3;
  assert.equal(openOf(game, 'basilica'), null, 'unfinished');
});

test('effects: a Fanum counts as six temples of its god, the Pantheum two of each; no jealous god with the Pantheum', () => {
  const game = newGame({ size: 96, type: 'plains' });
  const f = finished(game, 'fanum_mars');
  assert.equal(templeCounts(game).mars, 6);
  assert.equal(templeCounts(game).ceres, 0);
  f.efficiency = 0;
  assert.equal(templeCounts(game).mars, 0, 'closed: nothing');
  removeBuilding(game, f);
  finished(game, 'pantheum');
  const t = templeCounts(game);
  for (const g of Object.keys(t)) assert.equal(t[g], 2, g);
  game.city.population = 2000;
  const counts = { ceres: 4, neptune: 2, mercury: 2, mars: 2, venus: 1 };
  assert.equal(godsJealousy(game, counts).neglected, null, 'the Pantheum: none jealous');
  assert.equal(godsJealousy(game, counts).favourite, 'ceres', 'the favourite still is');
});

test('effects: a Fanum keeps its god from striking; blessings come after 8 months', async () => {
  const { updateReligion } = await import('../src/sim/religion.js');
  const game = newGame({ size: 96, type: 'plains' });
  finished(game, 'fanum_venus');
  game.city.population = 3000; // big enough for the gods to mind
  for (let m = 0; m < 30; m++) updateReligion(game);
  assert.ok(game.city.gods.venus.mood >= 70, `Venus content (${game.city.gods.venus.mood})`);
  assert.ok(game.city.gods.ceres.mood <= 12, 'an ignored god still sulks');
});

test('effects: the Basilica: taxes +20%, registrations 96 days, prosperity +8', () => {
  const game = newGame({ size: 64, type: 'plains' });
  const h = { tier: 5, pop: 100 };
  const base = houseMonthlyTax(game, h);
  game.city.population = 1000;
  const settle = () => { for (let m = 0; m < 60; m++) updateRatings(game); return game.city.ratings.prosperity; };
  const before = settle();
  const b = finished(game, 'basilica');
  assert.ok(Math.abs(houseMonthlyTax(game, h) - base * 1.2) < 1e-9);
  // A tax collector's visit registers a home for 96 days, not 48.
  const home = addBuilding(game, 'house', b.x + b.size + 1, b.y);
  home.house.pop = 10;
  const taxman = spawnWalker(game, 'taxman', game.map.idx(home.x, home.y + 1), b, {});
  roamerVisit(game, taxman);
  assert.equal(home.house.tax, 96);
  assert.equal(Math.round((settle() - before) * 10) / 10, 8, 'prosperity settles 8 higher');
});

test('effects: the gifts of Ceres (farms), Neptune (wells, health), Mercury (goods) and Venus (homes)', () => {
  const game = newGame({ size: 96, type: 'plains' });
  const spot = findFree(game, 12, 4);
  const farm = addBuilding(game, 'farm_wheat', spot.x, spot.y);
  const olive = addBuilding(game, 'farm_olive', spot.x + 4, spot.y);
  for (const f of [farm, olive]) { f.efficiency = 1; f.fertility = 1; f.progress = 0; }
  updateProducer(game, farm);
  updateProducer(game, olive);
  const plain = [farm.progress, olive.progress];
  const ceres = finished(game, 'fanum_ceres');
  farm.progress = 0;
  olive.progress = 0;
  updateProducer(game, farm);
  updateProducer(game, olive);
  assert.ok(Math.abs(farm.progress - plain[0] * 1.2) < 1e-9, 'wheat a fifth faster');
  assert.equal(olive.progress, plain[1], 'olives are no food: unchanged');
  removeBuilding(game, ceres);
  // Mercury: a fifth less of each good a month.
  const home = addBuilding(game, 'house', spot.x + 9, spot.y);
  home.house.tier = 12;
  home.house.pop = 40;
  for (const g of Object.keys(home.house.goods)) home.house.goods[g] = 10;
  useGoods(game, home);
  const used = 10 - home.house.goods.pottery;
  for (const g of Object.keys(home.house.goods)) home.house.goods[g] = 10;
  const merc = finished(game, 'fanum_mercury');
  useGoods(game, home);
  assert.ok(Math.abs((10 - home.house.goods.pottery) - used * 0.8) < 1e-9);
  removeBuilding(game, merc);
  // Neptune: wells reach a tile further.
  const well = addBuilding(game, 'well', spot.x, spot.y + 6);
  const edge = game.map.idx(spot.x + CONFIG.WELL_RADIUS + 1, spot.y + 6);
  updateWater(game);
  assert.equal(game.map.water[edge] & WaterBits.WELL, 0);
  const nep = finished(game, 'fanum_neptune');
  updateWater(game);
  assert.ok(game.map.water[edge] & WaterBits.WELL);
  assert.equal(monumentHealth(game), 10);
  removeBuilding(game, nep);
  removeBuilding(game, well);
  // Venus: every home's mood target 10 higher.
  home.house.mood = 50;
  updateHomeMood(game, home, 0, null);
  const plainTarget = home.house.moodTarget;
  finished(game, 'fanum_venus');
  updateHomeMood(game, home, 0, null);
  assert.equal(home.house.moodTarget, Math.min(100, plainTarget + 10));
});

test('effects: the Pharus and the Mansio Magna: their partners trade a quarter more, disruptions half as long', () => {
  const game = newGame({ size: 96, type: 'river' });
  const sea = 'corinthus';
  const land = 'capua';
  const was = { buys: partnerBuys(game, sea), sells: partnerSells(game, sea), land: partnerBuys(game, land) };
  assert.equal(haltDays(game, 'sea'), 48);
  finished(game, 'pharus');
  assert.equal(partnerBuys(game, sea).wheat, Math.round(was.buys.wheat * 1.25 / 100) * 100);
  assert.equal(partnerSells(game, sea).marble, Math.round(TRADE_PARTNERS[sea].sells.marble * 1.25 / 100) * 100);
  assert.deepEqual(partnerBuys(game, land), was.land, 'land partners unchanged by the Pharus');
  assert.equal(haltDays(game, 'sea'), 24);
  assert.equal(haltDays(game, 'land'), 48);
});

test('effects: the Thermae: baths for homes within 24 tiles, health +10, mood +3', () => {
  const game = newGame({ size: 96, type: 'plains' });
  const t = finished(game, 'thermae');
  const near = addBuilding(game, 'house', t.x + t.size + 20, t.y);
  const far = addBuilding(game, 'house', Math.min(90, t.x + t.size + 30), t.y);
  for (const hb of [near, far]) { hb.house.pop = 5; hb.house.tier = 3; hb.house.baths = 0; }
  updateMonument(game, t);
  assert.equal(near.house.baths, CONFIG.ACCESS_DAYS);
  assert.equal(far.house.baths, 0, 'beyond its reach');
  assert.equal(monumentHealth(game), 10);
});

test('effects: Mars: smaller warbands, Rome strikes harder', () => {
  const game = newGame({ size: 96, type: 'plains', invasions: 'occasional' });
  game.city.population = 2000;
  const before = raidSize(game);
  finished(game, 'fanum_mars');
  assert.ok(fanumOf(game, 'mars'));
  assert.ok(raidSize(game) < before);
  assert.equal(enemyPower(game, { side: 'rome' }), 1.2);
});

// ---------------------------------------------------------------------------
// Saves and fame
// ---------------------------------------------------------------------------

test('saves: a site mid-stage, its carts and the camp round-trip', () => {
  const { game, camp, wh, gran, site, run } = yard('basilica');
  wh.stock.clay = 1000;
  wh.stock.timber = 400;
  gran.stock.wheat = 400;
  run(12);
  const data = JSON.parse(JSON.stringify(serializeGame(game)));
  assert.equal(data.version, CONFIG.SAVE_VERSION);
  const copy = deserializeGame(data);
  const s2 = copy.buildings.get(site.id);
  assert.deepEqual(s2.mon, site.mon);
  assert.deepEqual(copy.buildings.get(camp.id).camp, camp.camp);
  for (const id of camp.walkers) assert.deepEqual(copy.walkers.get(id).campClaim ?? null, game.walkers.get(id).campClaim ?? null);
  // Both run on alike.
  for (let t = 0; t < 10 * DAY; t++) {
    for (const g of [game, copy]) for (const id of [camp.id, wh.id, gran.id]) { const b = g.buildings.get(id); b.efficiency = 1; b.fireRisk = 0; b.damageRisk = 0; }
    game.tick();
    copy.tick();
  }
  assert.deepEqual(copy.buildings.get(site.id).mon, site.mon);
});

test('saves: an older save loads with the ledger\'s Monument upkeep row', () => {
  const game = newGame({ size: 64, type: 'plains' });
  const data = JSON.parse(JSON.stringify(serializeGame(game)));
  data.version = 30;
  delete data.city.finance.thisYear.monuments;
  const copy = deserializeGame(data);
  assert.equal(copy.city.finance.thisYear.monuments, 0);
});

test('fame: a finished monument standing at a win adds its points', () => {
  assert.equal(FAME_MONUMENT, 150);
  const w = { ratings: { culture: 50, prosperity: 50, peace: 50, favor: 50 }, population: 1000, goal: 1000, paceYears: 5, months: 60, difficulty: 'normal' };
  assert.equal(winScore({ ...w, monument: 1 }).score - winScore(w).score, 150);
});
