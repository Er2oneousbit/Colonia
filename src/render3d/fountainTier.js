/**
 * fountainTier.js
 * ----------------------------------------------------------------------------
 * Which of the street fountain's four looks (models/fountain.js) a fountain
 * shows in the 3D look: the finer the neighbourhood, the finer the
 * fountain, as Caesar III drew a plainer fountain in poor quarters and finer
 * ones in rich ones. A render rule only: the sim does not know of it.
 *
 * The neighbourhood is the desirability at the fountain's own tile (world/
 * map.js, which a fountain's own value does not reach: what its neighbours
 * give it). The bands follow the homes that live there (data/housing.js):
 *
 *   tier 1  lava lacus        below 8     tents to cottages (squalor)
 *   tier 2  limestone lacus   8 to 19     townhouses, merchants' houses
 *   tier 3  marble basin      20 to 36    the domus to the insula
 *   tier 4  nymphaeum         37 and up   villas and palaces
 *
 * A look changes only when the tier changes, and with a margin (HYSTERESIS)
 * past the band's edge: a quarter whose desirability wavers about 20 (a
 * garden's care going up and down, a house evolving next door) keeps its
 * fountain's look instead of swapping it back and forth.
 * ----------------------------------------------------------------------------
 */

/** The lowest desirability of tiers 2, 3 and 4. */
export const TIER_FLOORS = Object.freeze([8, 20, 37]);
/** How far past a band's edge desirability must go before the look changes. */
export const HYSTERESIS = 3;

/** The tier (1..4) for desirability `d`, with no history. */
export function tierOf(d) {
  let t = 1;
  for (const f of TIER_FLOORS) if (d >= f) t++;
  return t;
}

/**
 * The tier for desirability `d` given the tier shown now (`prev`, 1..4, or
 * null for a fountain not seen before): it moves only once `d` is
 * HYSTERESIS past the edge of the band it would move into.
 */
export function fountainTier(d, prev = null) {
  const raw = tierOf(d);
  if (!prev || raw === prev) return raw;
  if (raw > prev) {
    // Up: the new band's floor, plus the margin.
    return tierOf(d - HYSTERESIS) > prev ? tierOf(d - HYSTERESIS) : prev;
  }
  // Down: below the old band's floor by the margin.
  return tierOf(d + HYSTERESIS) < prev ? tierOf(d + HYSTERESIS) : prev;
}
