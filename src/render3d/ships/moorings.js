/**
 * ships/moorings.js
 * ----------------------------------------------------------------------------
 * Where a moored vessel lies, render-only (pure: the tests call it), in the
 * map's tiles: the sim keeps a moored ship on its berth's tile (a dock's,
 * a wharf's, a station's spots), and the 3D look lays it at its quay there:
 *
 *   alongside   a merchant ship at its Emporium, a fishing boat at its
 *               wharf (or, new, at its shipyard), a liburnian training at
 *               the Portus: parallel to the building's front, its side
 *               MOOR_GAP off it, centred on its berth along the front,
 *               its bow the way it came in (the nearer of the two ways)
 *   stern-to    a liburnian at its station, as Roman warships lay at
 *               their stations (and Mediterranean ships still do): its
 *               stern MOOR_GAP off the front, bow out, the squadron's four
 *               side by side along the front by their berth numbers
 *
 * Returns { x, y } (map tiles, continuous, as a unit's) and `dir` [dx, dy]
 * (the bow's way on the map), or null when it has no quay to lie at.
 * ----------------------------------------------------------------------------
 */

import { DESIGNS, extentOf } from './designs.js';
import { STATION_CAPACITY } from '../../data/units.js';

/** Metres between a moored hull and its quay's face. */
export const MOOR_GAP = 0.3;
/** Metres between the middles of a squadron's ships lying stern-to. */
export const STERN_TO_STEP = 2.9;
/** Metres a tile (models.js TILE_M). */
const TILE_M = 4;

/** The outward normal of a building's water side (sim/berths.js: 0 = -y, 1 = +x, 2 = +y, 3 = -x). */
export const SIDE_NORMAL = Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]]);

/** The building's front edge: its line on the map along the side facing the water, and the middle of it. */
export function frontOf(b) {
  const side = b.waterSide ?? 2;
  const n = SIDE_NORMAL[side];
  const S = b.size;
  // The edge's coordinate across (x for sides 1 and 3, y for 0 and 2) and the middle along it.
  const across = n[0] ? (n[0] > 0 ? b.x + S : b.x) : (n[1] > 0 ? b.y + S : b.y);
  const mid = n[0] ? b.y + S / 2 : b.x + S / 2;
  return { n, across, mid, half: S / 2, alongX: !n[0] };
}

/** A point `out` tiles off the front and `along` tiles from its middle (along its edge). */
function offFront(f, out, along) {
  return f.alongX ? { x: f.mid + along, y: f.across + f.n[1] * out } : { x: f.across + f.n[0] * out, y: f.mid + along };
}

/**
 * Alongside building `b`'s front: centred along the front on tile `berth`
 * (map index; else the front's middle), its side MOOR_GAP off the face.
 * `dir0` the bow's way as it came in (the nearer way along the front wins).
 */
export function alongside(b, kind, map, berth = -1, dir0 = null) {
  const f = frontOf(b);
  const { beam } = extentOf(DESIGNS[kind]);
  const out = (beam + MOOR_GAP) / TILE_M;
  let along = 0;
  if (berth >= 0) {
    const c = f.alongX ? map.xOf(berth) + 0.5 : map.yOf(berth) + 0.5;
    // (Kept on the front: a hull longer than the berth's tile may not reach past the building's ends.)
    const { half } = extentOf(DESIGNS[kind]);
    const room = Math.max(0, f.half - half / TILE_M);
    along = Math.max(-room, Math.min(room, c - f.mid));
  }
  const p = offFront(f, out, along);
  const t = f.alongX ? [1, 0] : [0, 1];
  let dir = t;
  if (dir0 && dir0[0] * t[0] + dir0[1] * t[1] < 0) dir = [-t[0], -t[1]];
  return { x: p.x, y: p.y, dir };
}

/** Stern-to at a station's front, its berth number `slot` placing it along the front, the bow out. */
export function sternTo(b, kind, slot = 0) {
  const f = frontOf(b);
  const { half } = extentOf(DESIGNS[kind]);
  const out = (half + MOOR_GAP) / TILE_M;
  const k = ((slot % STATION_CAPACITY) + STATION_CAPACITY) % STATION_CAPACITY;
  const along = ((k - (STATION_CAPACITY - 1) / 2) * STERN_TO_STEP) / TILE_M;
  const p = offFront(f, out, along);
  return { x: p.x, y: p.y, dir: f.n.slice() };
}

/**
 * Where vessel `e` (a walker or a unit, drawn as design `kind`) lies moored,
 * or null. `owner` the building it belongs to when it is a fishing boat
 * (its wharf, or its shipyard while spare: the pass finds it).
 */
export function mooringOf(e, kind, game, owner = null, dir0 = null) {
  const map = game.map;
  if (e.type === 'ship' && e.state === 'docked') {
    const b = game.buildings.get(e.target);
    return b && b.waterSide !== undefined ? alongside(b, kind, map, b.berth ?? -1, dir0) : null;
  }
  if (e.type === 'fishing_boat' && (e.state === 'moored' || e.state === 'spare')) {
    if (!owner || owner.waterSide === undefined) return null;
    return alongside(owner, kind, map, owner.mooring ?? -1, dir0);
  }
  if (e.type === 'liburnian') {
    if (e.state === 'berthed') {
      const st = game.buildings.get(e.station);
      return st && st.waterSide !== undefined && !st.rally ? sternTo(st, kind, e.slot || 0) : null;
    }
    if (e.state === 'training') {
      const p = game.buildings.get(e.drill);
      return p && p.waterSide !== undefined ? alongside(p, kind, map, p.berth ?? -1, dir0) : null;
    }
  }
  return null;
}
