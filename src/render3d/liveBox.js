/**
 * liveBox.js
 * ----------------------------------------------------------------------------
 * How far the live art (drawn anew every frame: walkers, soldiers, ships,
 * fires, standards, gateways, a building's live details) can reach from its
 * anchor, so the WebGL back end knows how big a cell of its live-art texture
 * each item needs (webglBackend.js). Too small and the art is cut off at the
 * cell's edge; too big only costs texture space.
 *
 * Reaches are world px at zoom 1 from the item's anchor (its feet, a fire's
 * tile, a building's footprint corner): [left, top, right, bottom]. They
 * were measured by drawing every walker type, every unit type (both
 * facings, mid-stride, striking, ringed as selected), standards with their
 * numbers, gateways, fires and races and taking the box of what they paint,
 * then given room to spare:
 *   people [-9, -29, 9, 6], a cart [-31, -19, 31, 6], a merchant ship
 *   [-26, -46, 26, 7], soldiers up to an elephant [-16, -28, 16, 4],
 *   warships [-32, -8, 32, 10] (masts furled), a fire [-29, -38, 29, 15].
 * ----------------------------------------------------------------------------
 */

import { HALF_W, CONFIG } from '../config.js';
import { WALKER_TYPES } from '../data/walkers.js';
import { UNIT_TYPES } from '../data/units.js';
import { heightFor } from '../render/buildingArt.js';
import { K_WALKER, K_FIRE, K_COLUMN, K_EXTRA, K_UNIT, K_PROJ, K_FLAG, K_GATE } from '../render/items.js';

const PERSON = [-24, -38, 24, 9];
const CART = [-38, -30, 38, 9];
const BOAT = [-32, -58, 32, 12];
const SOLDIER = [-24, -38, 24, 9];
const WARSHIP = [-46, -72, 46, 18];
const FIRE = [-33, -44, 33, 19];
const PROJ = [-10, -10, 10, 10];
const RACE = [-22, -24, 22, 6];
/** Device px of room around every box (strokes that do not scale with zoom, rounding to whole px). */
const PAD = 3;

/**
 * The device px box [x0, y0, x1, y1] that item `it` (render/items.js, as
 * Renderer.render() queued it) paints into, at the camera `cam`.
 */
export function liveBox(it, cam) {
  const k = cam.scale;
  const sx = (it.wx - cam.x) * k;
  const sy = (it.wy - cam.y) * k;
  let e = PERSON;
  switch (it.kind) {
    case K_WALKER: {
      e = WALKER_TYPES[it.w.type]?.kind === 'ship' ? BOAT : it.w.type === 'cart' ? CART : PERSON;
      if (it.aim) {
        // A prefect's water thrown at a fire, out to the burning tile.
        e = [Math.min(e[0], it.aim.x - 8), Math.min(e[1], it.aim.y - 24), Math.max(e[2], it.aim.x + 8), Math.max(e[3], it.aim.y + 8)];
      }
      break;
    }
    case K_UNIT:
      e = UNIT_TYPES[it.u.type]?.naval ? WARSHIP : SOLDIER;
      break;
    case K_FIRE:
      e = FIRE;
      break;
    case K_PROJ:
      e = PROJ;
      break;
    case K_FLAG: {
      // The standard, and its number over it at a size that stays readable zoomed out (drawStandardNumber).
      const px = Math.max(7 * k, 9 * cam.dpr);
      const half = it.num ? (0.8 * px * it.num.length) / 2 + 0.3 * px : 0;
      const tx = sx + 4 * k;
      return [Math.min(sx - 20 * k, tx - half) - PAD, Math.min(sy - 44 * k, sy - 29 * k - 1.3 * px) - PAD, Math.max(sx + 28 * k, tx + half) + PAD, sy + 6 * k + PAD];
    }
    case K_GATE: {
      const ax = Math.abs(it.ox) + 18;
      const ay = Math.abs(it.oy);
      e = [-ax, -ay - 66, ax, ay + 14];
      break;
    }
    case K_COLUMN: {
      const r = 3 + it.S;
      e = [-1.4 * r - 4, -52 - r, 1.4 * r + 6, r + 3];
      break;
    }
    case K_EXTRA: {
      if (it.race) { e = RACE; break; }
      // Over its building: inside the sprite's box, with room for flags fluttering out of it.
      const S = it.b.size;
      e = [-S * HALF_W - 24, -heightFor(it.b.type, S) - 24, S * HALF_W + 24, S * CONFIG.TILE_H + 8];
      break;
    }
    default:
      break;
  }
  return [sx + e[0] * k - PAD, sy + e[1] * k - PAD, sx + e[2] * k + PAD, sy + e[3] * k + PAD];
}
