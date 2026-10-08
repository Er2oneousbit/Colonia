/**
 * units/threat.js
 * ----------------------------------------------------------------------------
 * Who is near a foe this frame, for the units' looks (render-only): a
 * legionary forms the line and draws his gladius when raiders come near, a
 * warrior breaks into a run at the last few paces. The sim keeps no such
 * flag (a soldier at his post simply stands), so the renderer works it out
 * from where everyone stands: the land units sorted once a frame into cells
 * of CELL tiles, each unit's nearest foe found among its own and the
 * neighbouring cells. Rome's soldiers and the city's foes are each other's
 * foes (sim/combat.js hostileToRome: raiders and Caesar's men, wolves, a
 * village's men while it attacks); nobody else is anyone's.
 * ----------------------------------------------------------------------------
 */

import { UNIT_TYPES } from '../../data/units.js';

/** Tiles a cell of the grid (a foe further than this from every cell searched is no threat). */
export const CELL = 8;

/** Which side a unit fights on for this: 0 Rome, 1 Rome's foes, -1 neither (a native at peace, a ship). */
export function sideOf(u) {
  const def = UNIT_TYPES[u.type];
  if (!def || def.naval) return -1;
  if (u.side === 'rome') return 0;
  if (u.side === 'enemy' || u.side === 'wild') return 1;
  if (u.side === 'native') return u.attacking ? 1 : -1;
  return -1;
}

export class ThreatGrid {
  constructor() {
    this.cells = new Map(); // cell key -> [[x, y, side], ...]
    this.pool = [];
  }

  /** Sort the land units into their cells (once a frame). */
  build(units) {
    for (const list of this.cells.values()) {
      list.length = 0;
      this.pool.push(list);
    }
    this.cells.clear();
    for (const u of units) {
      const side = sideOf(u);
      if (side < 0) continue;
      const k = key(Math.floor(u.x / CELL), Math.floor(u.y / CELL));
      let list = this.cells.get(k);
      if (!list) {
        list = this.pool.pop() || [];
        this.cells.set(k, list);
      }
      list.push(u.x, u.y, side);
    }
  }

  /** The distance (tiles) from unit `u` to its nearest foe within a cell's reach, or Infinity. */
  nearest(u) {
    const side = sideOf(u);
    if (side < 0) return Infinity;
    const cx = Math.floor(u.x / CELL);
    const cy = Math.floor(u.y / CELL);
    let best = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = this.cells.get(key(cx + dx, cy + dy));
        if (!list) continue;
        for (let i = 0; i < list.length; i += 3) {
          if (list[i + 2] === side) continue;
          const d = Math.hypot(list[i] - u.x, list[i + 1] - u.y);
          if (d < best) best = d;
        }
      }
    }
    return best;
  }
}

function key(cx, cy) {
  return cx * 65536 + cy;
}
