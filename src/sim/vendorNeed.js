/**
 * vendorNeed.js
 * ----------------------------------------------------------------------------
 * What a home wants from a market: which goods (houseWantsGood), how many
 * kinds of food (foodKindsWanted), which kinds it keeps (keepsKind), how much
 * of a good a visit tops it up to (goodsTargetOf) and, from those, how badly
 * it needs a market's vendor (vendorNeed), his pull at a junction. Data only
 * (the goods, the housing levels, the market's stock), so sim/movement.js can
 * weigh the streets by it and sim/market.js hand the goods over by the same
 * rules without the two importing each other.
 * ----------------------------------------------------------------------------
 */

import { CONFIG } from '../config.js';
import { FOOD_TYPES, HOUSE_GOODS, houseGoodUse } from '../data/goods.js';
import { HOUSE_TIERS, MAX_TIER } from '../data/housing.js';

/** Does a house want this good (needed now or for its next tier)? */
export function houseWantsGood(h, good) {
  if (h.pop <= 0) return false;
  const cur = HOUSE_TIERS[h.tier];
  const next = HOUSE_TIERS[Math.min(MAX_TIER, h.tier + 1)];
  return cur.goods.includes(good) || next.goods.includes(good);
}

/**
 * Food types a home wants in its pantry: as many as its level, or the next
 * one, needs (tents need none, but a Family Tent stocks up for a Lean-to).
 */
export function foodKindsWanted(h) {
  if (h.pop <= 0) return 0;
  return Math.max(HOUSE_TIERS[h.tier].food, HOUSE_TIERS[Math.min(MAX_TIER, h.tier + 1)].food);
}

/** Does a home keep this kind of food (pantryPlan): it has some, and the market can top it up or it still has a month of it? */
export function keepsKind(market, h, f, monthly) {
  return h.food[f] > 0.01 && (market.stock[f] > 0 || h.food[f] >= monthly);
}

/** How much of a good a vendor's visit tops a home up to: three months of it, at its rate of use. */
export function goodsTargetOf(h, g) {
  return Math.max(2, (h.pop / CONFIG.GOODS_PER_HOUSE_PEOPLE) * 3) * houseGoodUse(g);
}

/**
 * How badly a home needs this market's vendor (0..1), for his pull at a
 * junction (sim/movement.js): the larger of the share of its food his visit
 * would top up and the shortfall of its worst-stocked good he would bring.
 * Only what the market has counts: a home short of a food the market is out
 * of gains nothing from a visit, so it should not draw the vendor.
 */
export function vendorNeed(market, h) {
  if (!h || h.pop <= 0) return 0;
  let need = 0;
  // pantryPlan's pick without its arrays: a walker weighs every home within
  // reach of the roads ahead at each junction.
  const kinds = foodKindsWanted(h);
  if (kinds > 0) {
    const monthly = (h.pop * CONFIG.FOOD_PER_PERSON_MONTH) / kinds;
    const target = Math.max(1, monthly * 3);
    let picked = 0;
    let short = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (const f of FOOD_TYPES) {
        if (picked >= kinds) break;
        const keeps = keepsKind(market, h, f, monthly);
        if (pass === 0 ? !keeps : keeps || market.stock[f] <= 0) continue;
        picked++;
        if (market.stock[f] > 0) short += Math.max(0, target - h.food[f]) / target;
      }
    }
    need = short / kinds;
  }
  for (const g of HOUSE_GOODS) {
    if (market.stock[g] <= 0 || !houseWantsGood(h, g)) continue;
    const goodsTarget = goodsTargetOf(h, g);
    need = Math.max(need, Math.max(0, goodsTarget - h.goods[g]) / goodsTarget);
  }
  return need;
}
