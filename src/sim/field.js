/**
 * field.js
 * ----------------------------------------------------------------------------
 * Flow fields: one Dijkstra pass from a set of buildings gives every land
 * tile the cost of reaching the nearest of them, so a raider (or one of
 * Caesar's men, or an angry villager) just walks downhill (fillField). The
 * raiders' own fields: game.enemyField toward every building (computeField)
 * and, for a people with a target of its own, game.raidField toward those
 * buildings with the rest breakable (computeRaidField, raidTargets).
 * legionTargets, what Caesar's army makes for, lives here rather than in
 * sim/legion.js because a raid of a people who go for homes shares it, and
 * sim/legion.js walks the field (it imports this module, which may not import
 * it back). Imports sim/monuments.js (a spent monument is no target) and
 * sim/governor.js (the residence): no military module.
 * ----------------------------------------------------------------------------
 */

import { Terrain, Road } from '../world/map.js';
import { MinHeap } from '../world/pathfinding.js';
import { residenceOf } from './governor.js';
import { monumentSpent } from './monuments.js';

const FIELD_WALL_COST = 14; // how much raiders dislike breaking a wall vs walking

/** Dijkstra from every building tile: cost for a raider to reach a building. */
export function computeField(game) {
  const map = game.map;
  let field = game.enemyField;
  if (!field || field.length !== map.size) field = game.enemyField = new Float32Array(map.size);
  fillField(game, field, (id) => {
    const b = game.buildings.get(id);
    return !!b && b.def.kind !== 'village' && !monumentSpent(game, b); // (raiders pass native villages by, and a monument with nothing more to lose)
  });
  game.enemyFieldRev = map.revision;
  game.enemyFieldTick = game.time.totalTicks;
  computeRaidField(game);
}

// How much a raid's field toward its people's targets dislikes breaking
// through a building that is not one (as Caesar's legions' does,
// CONFIG.LEGION_BREAK_COST): enough that the warband walks round a block
// rather than through it, not so much that it never comes in.
const RAID_BREAK_COST = 20;

/**
 * The buildings a raid's people make for first (data/peoples.js `target`),
 * as { key, isTarget } for fillField, or null when the warband simply goes
 * for the nearest building: the generic band, or a target of which nothing
 * stands.
 */
export function raidTargets(game, kind) {
  if (!kind || kind === 'nearest') return null;
  if (kind === 'homes') {
    const t = legionTargets(game); // the residence, else the best homes with people (sim/legion.js)
    return t.what === 'anything' ? null : { key: `homes:${t.key}`, isTarget: t.isTarget };
  }
  const kinds = TARGET_KINDS[kind];
  if (!kinds) return null;
  const named = (b) => !!b && (kinds.has(b.def.kind) || kinds.has(b.type));
  for (const b of game.buildings.values()) if (named(b)) return { key: kind, isTarget: (id) => named(game.buildings.get(id)) };
  return null;
}

/** Building kinds (or types) each target names (data/peoples.js). */
const TARGET_KINDS = {
  food: new Set(['granary', 'warehouse', 'market', 'farm']),
  stores: new Set(['granary', 'warehouse']),
  troops: new Set(['fort', 'barracks', 'military_academy', 'prefecture']),
};

/**
 * The active raid's own field, toward its people's targets with other
 * buildings breakable (null: none, the raiders walk the plain field). A
 * raider standing where this field cannot reach (its targets across water)
 * walks the plain one.
 */
export function computeRaidField(game) {
  const inv = game.military.active;
  const t = inv ? raidTargets(game, inv.target) : null;
  if (!t) { game.raidField = null; return; }
  const map = game.map;
  let field = game.raidField;
  if (!field || field.length !== map.size) field = game.raidField = new Float32Array(map.size);
  fillField(game, field, t.isTarget, RAID_BREAK_COST);
}

/**
 * Raider travel cost from each tile to the nearest building for which
 * isSource(buildingId) is true (0 on those buildings, Infinity if cut off).
 * Other buildings block the way, unless `breakCost` is given: then they can
 * be broken through for that much more (Caesar's legions, sim/legion.js).
 */
export function fillField(game, field, isSource, breakCost = 0, wallsBlock = false) {
  const map = game.map;
  const n = map.size;
  field.fill(Infinity);
  const heap = new MinHeap(4096);
  for (let i = 0; i < n; i++) {
    if (map.building[i] && isSource(map.building[i])) { field[i] = 0; heap.push(0, i); }
  }
  const w = map.w;
  while (heap.length) {
    const i = heap.pop();
    const d = field[i];
    const x = i % w;
    const y = (i / w) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 1 ? 1 : k === 3 ? -1 : 0);
      const ny = y + (k === 0 ? -1 : k === 2 ? 1 : 0);
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.h) continue;
      const j = ny * w + nx;
      // (A native village's pieces are never broken through, by Caesar's men
      // or the villagers themselves: damageBuilding spares them, so a route
      // through one left a legionary bashing at a hut for good.)
      if (map.building[j] && (!breakCost || game.buildings.get(map.building[j])?.def.kind === 'village')) continue;
      const t = map.terrain[j];
      if (t === Terrain.ROCK) continue;
      if (t === Terrain.WATER && map.road[j] !== Road.BRIDGE) continue;
      let c = t === Terrain.TREES ? 1.6 : 1;
      if (map.wall[j]) {
        if (wallsBlock) continue; // (villagers never break walls or gates: sim/natives.js)
        c += FIELD_WALL_COST;
      }
      if (map.building[j]) c += breakCost;
      // Rounded as the field stores it (32-bit floats): compared unrounded,
      // a cost the field cannot hold exactly (a forest's 1.6) kept "beating"
      // its own stored value, and every one of the many equal paths across a
      // big forest pushed the tile again. On a step-10 map's woods the heap
      // grew past the memory there was.
      const nd = Math.fround(d + c);
      if (nd < field[j]) { field[j] = nd; heap.push(nd, j); }
    }
  }
}

/** The best level of home that has people in it (-1: none). */
function bestHomeTier(game) {
  let best = -1;
  for (const b of game.buildings.values()) if (b.house && b.house.pop > 0 && b.house.tier > best) best = b.house.tier;
  return best;
}

/**
 * What the army goes for now: the residence; else the homes of the best
 * level with people in them; else any building. As { key, isTarget }.
 */
export function legionTargets(game) {
  const res = residenceOf(game);
  if (res) return { key: `r${res.id}`, isTarget: (id) => id === res.id, what: 'residence' };
  const tier = bestHomeTier(game);
  if (tier >= 0) {
    return { key: `h${tier}`, isTarget: (id) => { const b = game.buildings.get(id); return !!(b && b.house && b.house.pop > 0 && b.house.tier === tier); }, what: 'homes' };
  }
  return { key: 'any', isTarget: (id) => game.buildings.get(id)?.def.kind !== 'village', what: 'anything' }; // (not a native village: sim/natives.js)
}
