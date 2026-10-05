/**
 * demand.js
 * ----------------------------------------------------------------------------
 * What the army and the fleet still need delivered: the forts' weapons,
 * arrows and horses through the barracks (militaryNeed, barracksHasRoom) and
 * the stations' timber, iron and linen through the navalia (navalNeed,
 * navaliaHasRoom). The carts (sim/storage.js, sim/production.js,
 * sim/trade.js) ask here to put the barracks and the navalia before the
 * workshops and warehouses. Reads only game.military.demand and navalDemand,
 * worked out daily by sim/military.js updateDemand and sim/navy.js
 * updateNavalDemand, and the buildings' stock: no imports at all, so the
 * goods code never loads the military code.
 * ----------------------------------------------------------------------------
 */

/**
 * Units of a military input that should still go to barracks: what the forts
 * need minus what barracks already hold or have on the way. 0 = send goods to
 * warehouses instead (so the barracks never hoards export weapons).
 */
export function militaryNeed(game, good) {
  const want = game.military?.demand?.[good] || 0;
  if (want <= 0) return 0;
  let held = 0;
  for (const b of game.buildings.values()) {
    if (b.def.kind === 'barracks') held += (b.stock[good] || 0) + (b.incoming[good] || 0);
  }
  return Math.max(0, want - held);
}

/** Can this barracks take `amount` more of a good right now? */
export function barracksHasRoom(b, good, amount) {
  return b.def.kind === 'barracks' && b.efficiency > 0 && b.stock[good] !== undefined
    && b.stock[good] + b.incoming[good] + amount <= b.def.inputCap;
}

/**
 * Units of a good that should still go to a navalia: what the fleet needs
 * minus what the navalia hold or have on the way. 0: deliver it elsewhere
 * (workshops and warehouses), as the barracks' goods do.
 */
export function navalNeed(game, good) {
  const want = game.military?.navalDemand?.[good] || 0;
  if (want <= 0) return 0;
  let held = 0;
  for (const b of game.buildings.values()) {
    if (b.def.kind === 'navalia') held += (b.stock[good] || 0) + (b.incoming[good] || 0);
  }
  return Math.max(0, want - held);
}

/** Can this navalia take `amount` more of a good right now (a staffed station on its water has an empty berth)? */
export function navaliaHasRoom(b, good, amount) {
  return b.def.kind === 'navalia' && b.efficiency > 0 && b.fleetNeeds !== false && b.stock[good] !== undefined
    && b.stock[good] + b.incoming[good] + amount <= b.def.inputCap;
}
