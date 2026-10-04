/**
 * marble.test.mjs - marble beyond the monuments (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * Colonia's own: the grand buildings (the large temples, the Oracle, the
 * governor's palace, the Great Arena, the hippodrome and the two bigger
 * statues) are built of marble taken from the warehouses as they are placed,
 * all or nothing, given back by an undo and never by a demolition; and the
 * top five home levels (the Marble Villa up) need marble as a home good,
 * which market buyers fetch and vendors hand out like pottery. Covered
 * here: the data, placing, refusing, undoing, demolishing and rebuilding,
 * the homes' need, the market, every campaign mission's source of marble,
 * and loading a version 31 save.
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { log } from '../src/core/debug.js';
import { CONFIG } from '../src/config.js';
import { GOODS, HOUSE_GOODS, FOOD_TYPES, houseGoodUse } from '../src/data/goods.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { HOUSE_TIERS } from '../src/data/housing.js';
import { GOD_KEYS } from '../src/data/gods.js';
import { SCENARIOS, TRADE_PARTNERS } from '../src/data/scenarios.js';
import { addBuilding, linkedGroup } from '../src/sim/entities.js';
import { planAction, applyPlan, undoLast, canUndo, rebuildPlan, marbleCost, marbleShort } from '../src/sim/construction.js';
import { warehouseStock } from '../src/sim/storage.js';
import { igniteBuilding } from '../src/sim/risk.js';
import { updateHouse, useGoods, checkTier } from '../src/sim/housing.js';
import { houseWantsGood, vendorSupply, updateMarketBuyer, buyerArrive, buyerUnload } from '../src/sim/market.js';
import { unlockedBuildings, topLevels } from '../src/sim/capacity.js';
import { needReachable } from '../src/ui/problems.js';
import { describeNeed } from '../src/ui/infoPanel.js';
import { serializeGame, deserializeGame, upgradeMarbleV31, MARBLE_GRACE_MONTHS } from '../src/core/save.js';
import { generateMap, mapOptions } from '../src/world/mapgen.js';
import { Terrain, WaterBits } from '../src/world/map.js';
import { newGame, build, findFree } from './helpers.mjs';

log.setLevel('error');

/** The first level that needs marble (the Marble Villa), and the one below it. */
const MARBLE_VILLA = HOUSE_TIERS.findIndex((t) => t.goods.includes('marble'));
const PERISTYLE = MARBLE_VILLA - 1;

/** Marble in loads, by building, as data/buildings.js sets it. */
const WANT = {
  statue_medium: 1, statue_large: 2, oracle: 2, governor_palace: 4, colosseum: 6, hippodrome: 8,
  ...Object.fromEntries(GOD_KEYS.map((g) => [`temple_large_${g}`, 2])),
};

/** A staffed warehouse at a free spot holding `marble` (or a list of goods). */
function warehouseWith(game, marble, from = null) {
  const s = findFree(game, 3, 3, from);
  const wh = addBuilding(game, 'warehouse', s.x, s.y);
  wh.efficiency = 1;
  wh.stock.marble = marble;
  return wh;
}

/** Place a building of `type` at a free spot, held by its middle tile as the player holds it. */
function placeAt(game, type) {
  const S = BUILDINGS[type].size;
  const W = S * (BUILDINGS[type].span || 1);
  const s = findFree(game, W + 2, S + 2);
  const off = Math.floor((S - 1) / 2);
  const plan = planAction(game, type, s.x + 1 + Math.floor((W - 1) / 2), s.y + 1 + off, s.x + 1 + Math.floor((W - 1) / 2), s.y + 1 + off);
  return { plan, res: applyPlan(game, plan), x: s.x + 1, y: s.y + 1 };
}

/** Every service visit, food and good (marble too unless told not to) in a home. */
function serveAll(h, { marble = true } = {}) {
  for (const g of GOD_KEYS) h.religion[g] = 50;
  for (const v in h.ent) h.ent[v] = 99;
  for (const v in h.entBoth) h.entBoth[v] = 99;
  for (const k of ['school', 'library', 'academy', 'barber', 'clinic', 'baths', 'tax']) h[k] = 50;
  for (const f of FOOD_TYPES) h.food[f] = 500;
  for (const g of HOUSE_GOODS) h.goods[g] = 50;
  if (!marble) h.goods.marble = 0;
}

/** A home of `level` (its own footprint) on ground of desirability `des`, with fountain water and a hospital in reach. */
function home(game, level, des) {
  const S = HOUSE_TIERS[level].size;
  const s = findFree(game, S, S);
  const b = addBuilding(game, 'house', s.x, s.y, S);
  b.house.tier = level;
  b.house.pop = HOUSE_TIERS[level].people;
  for (let dy = 0; dy < S; dy++) {
    for (let dx = 0; dx < S; dx++) {
      const i = game.map.idx(s.x + dx, s.y + dy);
      game.map.desirability[i] = des;
      game.map.water[i] = WaterBits.FOUNTAIN | WaterBits.WELL | WaterBits.HOSPITAL;
    }
  }
  return b;
}

// ---------------------------------------------------------------------------
// The data
// ---------------------------------------------------------------------------

test('data: each grand building takes its loads of marble; nothing else does', () => {
  for (const [type, loads] of Object.entries(WANT)) assert.equal(BUILDINGS[type].marble, loads * CONFIG.CART_CAPACITY, type);
  for (const [type, def] of Object.entries(BUILDINGS)) if (!WANT[type]) assert.ok(!def.marble, `${type} needs no marble`);
  // Not the small statue, the Senate, the governor's house or villa, nor a monument (its stages take marble).
  for (const k of ['statue_small', 'senate', 'governor_house', 'governor_villa', 'hippodrome_part']) assert.equal(BUILDINGS[k].marble, undefined, k);
  assert.equal(GOODS.marble.kind, 'raw', 'still a raw material: a quarry cuts it and warehouses keep it');
});

test('data: marble is a home good from the Marble Villa up, used at half the rate', () => {
  assert.equal(HOUSE_TIERS[MARBLE_VILLA].name, 'Marble Villa');
  HOUSE_TIERS.forEach((t, i) => assert.equal(t.goods.includes('marble'), i >= MARBLE_VILLA, `${t.name}`));
  for (let i = MARBLE_VILLA; i < HOUSE_TIERS.length; i++) assert.ok(HOUSE_TIERS[i].patrician, 'only patrician homes need it');
  assert.equal(HOUSE_GOODS.at(-1), 'marble', 'last, so loops over the older goods keep their order');
  assert.equal(houseGoodUse('marble'), 0.5);
  assert.equal(houseGoodUse('pottery'), 1);
});

// ---------------------------------------------------------------------------
// Building in marble
// ---------------------------------------------------------------------------

test('placing: refused while the warehouses hold too little, saying how much; nothing is taken or paid', () => {
  const game = newGame({ seed: 'marble-short' });
  const wh = warehouseWith(game, 150);
  const money = game.city.treasury;
  assert.equal(marbleShort(game, 'temple_large_ceres'), 'Needs 200 marble in the warehouses, 150 stored');
  const { plan, res } = placeAt(game, 'temple_large_ceres');
  assert.equal(plan.count, 0);
  assert.equal(plan.reason, 'Needs 200 marble in the warehouses, 150 stored');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'Needs 200 marble in the warehouses, 150 stored');
  assert.equal(wh.stock.marble, 150, 'nothing taken');
  assert.equal(game.city.treasury, money, 'nothing paid');
  assert.ok(![...game.buildings.values()].some((b) => b.type === 'temple_large_ceres'));
  // Buildings without marble do not care.
  assert.equal(marbleShort(game, 'temple_ceres'), null);
  assert.equal(marbleShort(game, 'statue_small'), null);
});

test('placing: takes the marble from the warehouses with the money, Get warehouses last, and logs it used', () => {
  const game = newGame({ seed: 'marble-take' });
  const a = warehouseWith(game, 150);
  const b = warehouseWith(game, 300, { x: game.map.w - 6, y: game.map.h - 6 });
  b.orders.marble = 'get'; // kept there by the player: drawn on last
  const money = game.city.treasury;
  const { plan, res } = placeAt(game, 'temple_large_mars');
  assert.equal(plan.marble, 200, 'the plan shows its marble');
  assert.ok(res.ok, JSON.stringify(res));
  assert.equal(res.marble, 200);
  assert.equal(game.city.treasury, money - plan.cost, 'its denarii');
  assert.equal(a.stock.marble, 0, 'the plain warehouse first');
  assert.equal(b.stock.marble, 250, 'the rest from the Get warehouse');
  assert.equal(warehouseStock(game, 'marble'), 250);
  assert.equal(game.city.goodsFlow.marble.used, 200, 'the goods book counts it used');
  const op = game.lastUndo.ops.find((o) => o.op === 'building');
  assert.deepEqual(op.marble, [{ id: a.id, n: 150 }, { id: b.id, n: 50 }]);
});

test('undo: gives the marble back to the warehouses it came from, with the money', () => {
  const game = newGame({ seed: 'marble-undo' });
  const a = warehouseWith(game, 100);
  const b = warehouseWith(game, 400, { x: game.map.w - 6, y: game.map.h - 6 });
  const money = game.city.treasury;
  const { res } = placeAt(game, 'statue_large');
  assert.ok(res.ok);
  assert.deepEqual([a.stock.marble, b.stock.marble], [0, 300]);
  b.stock.marble -= 100; // a market buyer took some meanwhile
  const back = undoLast(game);
  assert.ok(back.ok);
  assert.equal(back.marble, 200);
  assert.equal(back.refund, BUILDINGS.statue_large.cost);
  assert.deepEqual([a.stock.marble, b.stock.marble], [100, 300], 'each its own share');
  assert.equal(game.city.treasury, money);
  assert.equal(game.city.goodsFlow.marble.used, 0, 'no longer counted used');
});

test('undo: a warehouse gone since goes to another; with none left the undo waits, saying why', () => {
  const game = newGame({ seed: 'marble-undo-gone' });
  const a = warehouseWith(game, 200);
  const { res } = placeAt(game, 'oracle');
  assert.ok(res.ok);
  const b = warehouseWith(game, 0, { x: game.map.w - 6, y: game.map.h - 6 });
  game.buildings.delete(a.id); // (as if demolished: the undo entry stays)
  assert.ok(canUndo(game));
  assert.ok(undoLast(game).ok);
  assert.equal(b.stock.marble, 200, 'put back in the warehouse that stands');
  // No warehouse at all: nowhere to put it.
  const g2 = newGame({ seed: 'marble-undo-none' });
  const w2 = warehouseWith(g2, 200);
  assert.ok(placeAt(g2, 'oracle').res.ok);
  g2.buildings.delete(w2.id);
  assert.equal(canUndo(g2), false);
  assert.match(undoLast(g2).reason, /No warehouse stands to take its marble back/);
});

test('the hippodrome: its 800 marble taken once for its three sections, and given back once', () => {
  const game = newGame({ size: 96, seed: 'marble-hippodrome' });
  const wh = warehouseWith(game, 1000);
  const { res, x, y } = placeAt(game, 'hippodrome');
  assert.ok(res.ok, JSON.stringify(res));
  assert.equal(res.marble, 800);
  assert.equal(wh.stock.marble, 200);
  const main = game.buildings.get(game.map.building[game.map.idx(x, y)]);
  assert.equal(linkedGroup(game, main).length, 3);
  assert.equal(undoLast(game).marble, 800);
  assert.equal(wh.stock.marble, 1000);
});

test('demolishing gives no marble back; rebuilding from the rubble pays it again', () => {
  const game = newGame({ seed: 'marble-rebuild' });
  const wh = warehouseWith(game, 700);
  const { res } = placeAt(game, 'statue_medium');
  assert.ok(res.ok);
  const statue = [...game.buildings.values()].find((b) => b.type === 'statue_medium');
  game.lastUndo = null;
  // Demolished: the marble is gone with it.
  applyPlan(game, planAction(game, 'clear', statue.x, statue.y, statue.x, statue.y));
  assert.equal(wh.stock.marble, 600);
  // A temple burns: its rubble rebuilds it for its marble again.
  const { res: t } = placeAt(game, 'temple_large_venus');
  assert.ok(t.ok);
  assert.equal(wh.stock.marble, 400);
  const temple = [...game.buildings.values()].find((b) => b.type === 'temple_large_venus');
  const at = game.map.idx(temple.x, temple.y);
  igniteBuilding(game, temple);
  game.fires.clear();
  wh.stock.marble = 150;
  const short = rebuildPlan(game, at);
  assert.equal(short.count, 0);
  assert.equal(short.reason, 'Needs 200 marble in the warehouses, 150 stored');
  wh.stock.marble = 400;
  const plan = rebuildPlan(game, at);
  assert.equal(plan.marble, 200);
  assert.ok(applyPlan(game, plan).ok);
  assert.equal(wh.stock.marble, 200);
});

test('free build (the console) and the demo cities\' stand-in waive the marble', () => {
  const game = newGame({ seed: 'marble-free' });
  assert.equal(marbleCost(game, 'colosseum'), 600);
  game.cheats.freeBuild = true;
  assert.equal(marbleCost(game, 'colosseum'), 0);
  assert.equal(marbleShort(game, 'colosseum'), null);
  game.cheats.freeBuild = false;
  game.cheats.freeMarble = true;
  assert.equal(marbleShort(game, 'statue_medium'), null);
  const { res } = placeAt(game, 'statue_medium');
  assert.ok(res.ok);
  assert.equal(res.marble, undefined, 'none taken');
});

test('residence: the palace needs its marble; the house and the villa none', () => {
  const game = newGame({ size: 96, seed: 'marble-palace' });
  for (const k of ['governor_house', 'governor_villa']) assert.equal(marbleCost(game, k), 0, k);
  assert.equal(marbleShort(game, 'governor_palace'), 'Needs 400 marble in the warehouses, 0 stored');
  const wh = warehouseWith(game, 400);
  const { res } = placeAt(game, 'governor_palace');
  assert.ok(res.ok, JSON.stringify(res));
  assert.equal(wh.stock.marble, 0);
});

// ---------------------------------------------------------------------------
// Homes
// ---------------------------------------------------------------------------

test('a Marble Villa without marble has a bad day and falls back; with it, it stays', () => {
  const game = newGame({ size: 96, seed: 'marble-villa' });
  const b = home(game, MARBLE_VILLA, HOUSE_TIERS[MARBLE_VILLA].down + 3);
  game.city.wineSources = 2;
  serveAll(b.house, { marble: false });
  updateHouse(game, b);
  assert.ok(b.house.blocked.some((m) => m.key === 'goods' && m.good === 'marble'), JSON.stringify(b.house.blocked));
  assert.equal(b.house.devolveDays, 1, 'a bad day');
  // With marble it keeps its level.
  const c = home(game, MARBLE_VILLA, HOUSE_TIERS[MARBLE_VILLA].down + 3);
  for (let d = 0; d < 5; d++) { serveAll(c.house); updateHouse(game, c); }
  assert.equal(c.house.devolveDays, 0);
  // checkTier says the same, and a Peristyle Villa never needs it.
  const lv = { des: 99, water: 2, food: 4, religion: 5, ent: 99, edu: 3, barber: 1, baths: 1, health: 2, goods: ['pottery', 'furniture', 'oil', 'clothing', 'wine'], wine: 2 };
  assert.ok(checkTier(PERISTYLE, lv, 'stay').ok);
  assert.deepEqual(checkTier(MARBLE_VILLA, lv, 'enter').missing.map((m) => m.good), ['marble']);
  assert.ok(checkTier(MARBLE_VILLA, { ...lv, goods: [...lv.goods, 'marble'] }, 'enter').ok);
  // The panel says where it comes from.
  assert.match(describeNeed({ key: 'goods', good: 'marble' }), /cut by a Lapicidina beside rocks, or imported/);
});

test('homes use marble at half the rate of pottery', () => {
  const game = newGame({ size: 96, seed: 'marble-use' });
  const b = home(game, MARBLE_VILLA, 60);
  b.house.goods.pottery = 50;
  b.house.goods.marble = 50;
  useGoods(game, b);
  const pottery = 50 - b.house.goods.pottery;
  const marble = 50 - b.house.goods.marble;
  assert.ok(Math.abs(pottery - HOUSE_TIERS[MARBLE_VILLA].people / CONFIG.GOODS_PER_HOUSE_PEOPLE / 2) < 1e-9);
  assert.ok(Math.abs(marble - pottery / 2) < 1e-9, `${marble} vs ${pottery}`);
  // A Peristyle Villa holds what it is given for the next level, but uses none.
  const p = home(game, PERISTYLE, 60);
  p.house.goods.marble = 10;
  useGoods(game, p);
  assert.equal(p.house.goods.marble, 10);
});

test('markets: buyers fetch marble for the homes that want it, only while a warehouse holds some; vendors sell it to them alone', () => {
  const game = newGame({ size: 96, seed: 'marble-market' });
  const s = findFree(game, 8, 4);
  assert.ok(build(game, 'road', s.x, s.y + 3, s.x + 7, s.y + 3).ok);
  const market = addBuilding(game, 'market', s.x, s.y + 1);
  const wh = addBuilding(game, 'warehouse', s.x + 3, s.y);
  game.processRoadChanges();
  market.efficiency = 1;
  wh.efficiency = 1;
  for (const f of FOOD_TYPES) market.stock[f] = CONFIG.MARKET_FOOD_CAP; // food is not short
  game.city.goodsDemand = { marble: 1 };
  const buyer = () => market.walkers.map((id) => game.walkers.get(id)).find((w) => w && w.type === 'buyer');
  updateMarketBuyer(game, market);
  assert.equal(buyer(), undefined, 'no marble anywhere: no buyer goes for it');
  wh.stock.marble = 400;
  market.buyerCooldown = 0;
  updateMarketBuyer(game, market);
  const w = buyer();
  assert.ok(w && w.want === 'marble', 'a buyer goes for the marble');
  buyerArrive(game, w);
  buyerUnload(game, w);
  assert.equal(market.stock.marble, CONFIG.CART_CAPACITY, 'a load of marble at the market');
  // Who wants it: a Peristyle Villa (for the next level) and up; not a Garden Villa.
  const mk = (tier) => { const h = addBuilding(game, 'house', 1, 1, 1).house; h.tier = tier; h.pop = 20; return h; };
  assert.ok(houseWantsGood(mk(PERISTYLE), 'marble'));
  assert.ok(houseWantsGood(mk(HOUSE_TIERS.length - 1), 'marble'));
  assert.ok(!houseWantsGood(mk(PERISTYLE - 1), 'marble'));
  const villa = home(game, MARBLE_VILLA, 60);
  const garden = home(game, PERISTYLE - 1, 60);
  vendorSupply(game, market, villa);
  vendorSupply(game, market, garden);
  // Three months of it at its rate: half the pottery a vendor would leave.
  const target = Math.max(2, (villa.house.pop / CONFIG.GOODS_PER_HOUSE_PEOPLE) * 3) * 0.5;
  assert.ok(Math.abs(villa.house.goods.marble - target) < 1e-9, `${villa.house.goods.marble} vs ${target}`);
  assert.equal(garden.house.goods.marble, 0, 'the Garden Villa got none');
});

// ---------------------------------------------------------------------------
// The campaign: marble wherever it is needed
// ---------------------------------------------------------------------------

/** Can a 2x2 quarry stand somewhere on this map (land, next to rock)? */
function quarrySpot(map) {
  for (let y = 0; y < map.h - 1; y++) {
    for (let x = 0; x < map.w - 1; x++) {
      let land = true;
      for (let dy = 0; dy < 2 && land; dy++) for (let dx = 0; dx < 2; dx++) { const t = map.terrain[map.idx(x + dx, y + dy)]; if (t === Terrain.WATER || t === Terrain.ROCK) { land = false; break; } }
      if (land && map.isNearTerrain(x, y, 2, Terrain.ROCK, 1)) return true;
    }
  }
  return false;
}

test('campaign: every mission that unlocks a building of marble, or homes that would need it, has a source', () => {
  for (const s of SCENARIOS) {
    if (!s.map) continue;
    const keys = unlockedBuildings(s);
    const buildings = [...keys].filter((k) => BUILDINGS[k].marble);
    // The levels its homes could reach with marble to hand: those it unlocks the need for.
    const top = topLevels({ ...s, standIns: ['marble'] }).top;
    if (!buildings.length && top < MARBLE_VILLA) continue;
    const sellers = s.partners.filter((id) => TRADE_PARTNERS[id].sells.marble);
    const quarry = keys.has('marble_quarry') && quarrySpot(generateMap(mapOptions(s.map)).map);
    assert.ok(quarry || sellers.length > 0, `${s.id}: ${buildings.join(', ') || HOUSE_TIERS[top].name} but no quarry by rock and no partner selling marble`);
    // And the homes can then reach every level they could before marble was needed.
    assert.equal(topLevels(s).top, top, `${s.id}: its top home`);
  }
});

test('campaign: a mission whose map has rock offers the quarry from the third mission on; the advisors know marble can be had', () => {
  for (const id of ['c3', 'c3m', 'c4', 'c4p']) assert.ok(unlockedBuildings(SCENARIOS.find((s) => s.id === id)).has('marble_quarry'), id);
  assert.ok(!unlockedBuildings(SCENARIOS.find((s) => s.id === 'c2')).has('marble_quarry'));
  // needReachable: marble from a quarry needs rock on the map.
  const game = newGame({ seed: 'marble-reach' });
  const m = { key: 'goods', good: 'marble', need: 1 };
  assert.equal(needReachable(game, m), game.map.terrain.includes(Terrain.ROCK) || game.scenario.partners.some((p) => TRADE_PARTNERS[p].sells.marble));
});

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

test('save: a version 31 city loads with marble at 0 in homes and markets, and grace stock in its grandest homes', () => {
  const game = newGame({ size: 96, seed: 'marble-save' });
  const s = findFree(game, 3, 3);
  const market = addBuilding(game, 'market', s.x, s.y);
  const villa = home(game, MARBLE_VILLA, 60);
  const peristyle = home(game, PERISTYLE, 60);
  const garden = home(game, PERISTYLE - 1, 60);
  const data = JSON.parse(JSON.stringify(serializeGame(game)));
  for (const b of data.buildings) {
    if (b.house) delete b.house.goods.marble;
    if (b.type === 'market') { delete b.stock.marble; delete b.incoming.marble; }
  }
  data.version = 31;
  const again = deserializeGame(data);
  assert.equal(again.buildings.get(market.id).stock.marble, 0);
  assert.equal(again.buildings.get(market.id).incoming.marble, 0);
  const month = (lvl) => (HOUSE_TIERS[lvl].people / CONFIG.GOODS_PER_HOUSE_PEOPLE) * 0.5;
  assert.equal(MARBLE_GRACE_MONTHS, 6);
  assert.ok(Math.abs(again.buildings.get(villa.id).house.goods.marble - month(MARBLE_VILLA) * MARBLE_GRACE_MONTHS) < 1e-9);
  assert.ok(Math.abs(again.buildings.get(peristyle.id).house.goods.marble - month(PERISTYLE) * MARBLE_GRACE_MONTHS) < 1e-9, 'the level below too');
  assert.equal(again.buildings.get(garden.id).house.goods.marble, 0, 'below that, none');
  again.runDays(20); // and it plays
  assert.ok(Number.isFinite(again.buildings.get(villa.id).house.goods.marble));
  // The upgrade leaves a version 32 city alone.
  const fresh = deserializeGame(JSON.parse(JSON.stringify(serializeGame(game))));
  const before = JSON.stringify([...fresh.buildings.values()].map((b) => (b.house ? b.house.goods : b.stock || null)));
  upgradeMarbleV31(fresh);
  assert.equal(JSON.stringify([...fresh.buildings.values()].map((b) => (b.house ? b.house.goods : b.stock || null))), before);
  assert.equal(CONFIG.SAVE_VERSION, 32);
});
