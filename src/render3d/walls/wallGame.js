/**
 * walls/wallGame.js
 * ----------------------------------------------------------------------------
 * The town walls in the game's WebGL renderer: how render/renderer.js hands
 * a wall tile, a gate or a dragged wall's ghost to the model pass
 * (modelPass.js), which instances them as it does buildings, one draw call
 * a part of each piece in view (walls/wallLayout.js picks the piece,
 * models/townWall.js builds it). Render-only: the sim never sees any of it.
 *
 *   wallModelPlace   a wall tile as a model: { b, place } for be.model(),
 *                    b a stand-in building of type 'wall' (models.js
 *                    MODELS.wall) carrying its piece's key, its gate's
 *                    state and the stubs into a watchtower beside it
 *   wallCoverSpec    the sprite kept (not drawn) for clicks, as tall as the
 *                    model: a figure behind the wall is hidden where the
 *                    model hides him (render/renderer.js coverDepthAt)
 *   wallGhosts       a dragged wall's ghost pieces, see-through
 *   gateTorchPoints  where a gate's torches burn, for the night's light map
 *
 * Rising: a wall tile that was not there at the last map change rises out
 * of the ground over half a second, as a new building does (the renderer's
 * `appear`); the layer is compared with its copy at each map revision, so
 * a load or a new game raises nothing.
 *
 * Gates stand open to the townsfolk and are shut while an enemy is on the
 * map within GATE_WATCH tiles (raiders, Caesar's legions, wild beasts, a
 * native warband on the attack: sim/combat.js hostileToRome).
 * ----------------------------------------------------------------------------
 */

import { Matrix4 } from 'three';
import { wallPiece, wallLookOf, stubKey, CANON } from './wallLayout.js';
import { WALL, WALL_TOP } from '../models/townWall.js';
import { ART_PX } from '../projection.js';
import { rotMask } from '../../render/view.js';
import { wallHpOf } from '../../sim/damage.js';
import { hostileToRome } from '../../sim/combat.js';
import { CONFIG, HALF_W } from '../../config.js';
import { box } from '../../render/draw.js';

/** Metres in a game tile (models.js TILE_M: not imported, models.js imports this module's neighbours). */
const TILE_M = 4;
/** Art px a metre up (the 2D art's z). */
const PX_M = 1 / (ART_PX * TILE_M);
/** Seconds a new wall takes to rise, and art px it starts sunk (as a building's sprite: renderer.js). */
const RISE_S = 0.5;
const RISE_PX = 14;
/** Tiles round a gate within which an enemy shuts it. */
export const GATE_WATCH = 14;

/** Per map: the wall layer's copy at the last revision, and when each new tile appeared. */
const TRACK = new WeakMap();

/** Note the map's walls (once a revision): new tiles rise from `time` (the renderer's seconds). */
function track(map, time) {
  let t = TRACK.get(map);
  if (!t) {
    // (A map seen for the first time, a load or a new game: what stands there is not new.)
    TRACK.set(map, (t = { rev: map.revision, walls: map.wall.slice(), appear: new Map() }));
    return t;
  }
  if (t.rev === map.revision) return t;
  t.rev = map.revision;
  const w = map.wall;
  for (let i = 0; i < w.length; i++) {
    if (w[i] && !t.walls[i]) t.appear.set(i, time);
    else if (!w[i]) t.appear.delete(i);
  }
  t.walls.set(w);
  return t;
}

/** Art px tile `i` is sunk at `time` while it rises (0 once up). */
export function wallRise(map, i, time) {
  const t = track(map, time);
  const t0 = t.appear.get(i);
  if (t0 === undefined) return 0;
  const p = (time - t0) / RISE_S;
  if (p >= 1 || p < 0) {
    t.appear.delete(i);
    return 0;
  }
  return (1 - (1 - (1 - p) ** 3)) * RISE_PX;
}

/** The enemies' tiles, once a game tick (gates read them). */
const HOSTILE = new WeakMap();
function hostileTiles(game) {
  const tick = game.time ? game.time.totalTicks : 0;
  let h = HOSTILE.get(game);
  if (h && h.tick === tick) return h.list;
  const list = [];
  if (game.units) for (const u of game.units.values()) if (u && !u.dead && hostileToRome(u)) list.push([u.x, u.y]);
  HOSTILE.set(game, (h = { tick, list }));
  return list;
}

/** Is the gate at (x, y) shut (an enemy within GATE_WATCH tiles)? */
export function gateShut(game, x, y) {
  const r2 = GATE_WATCH * GATE_WATCH;
  for (const [ux, uy] of hostileTiles(game)) if ((ux - x) ** 2 + (uy - y) ** 2 <= r2) return true;
  return false;
}

/** The look (stone) of a game's walls, kept per game. */
const LOOKS = new WeakMap();
export function lookOfGame(game) {
  let l = LOOKS.get(game);
  if (!l) LOOKS.set(game, (l = wallLookOf(game)));
  return l;
}

const _r = new Matrix4();

/** The `more` of a piece with stubs into watchtowers: each stub turned from the piece's own turn to its way. */
function stubsMore(look, piece) {
  if (!piece.stubs.length) return undefined;
  const mats = new Float32Array(16 * piece.stubs.length);
  piece.stubs.forEach((bit, k) => {
    let R = 0;
    while (rotMask(2, R) !== bit) R++;
    // (The piece is turned T; the stub, built along +x, R: so R - T within it, as models.js turns.)
    _r.makeRotationY((-((R - piece.T) & 3) * Math.PI) / 2).toArray(mats, k * 16);
  });
  return [{ key: stubKey(look), n: piece.stubs.length, mats }];
}

/**
 * Wall tile `i` at map (x, y), view tile (vx, vy), as a model for the back
 * end: { b, place, piece }. `r` is the renderer (its game, view turn,
 * clock and snow).
 */
export function wallModelPlace(r, x, y, i, vx, vy) {
  const game = r.game;
  const map = game.map;
  const look = lookOfGame(game);
  const piece = wallPiece(map, game.buildings, x, y, r.viewTurn, look, wallHpOf(game, i));
  const state = piece.gate ? (gateShut(game, x, y) ? 'shut' : 'open') : 'always';
  const b = { id: -1 - i, type: 'wall', size: 1, x, y, key: piece.key, state, more: stubsMore(look, piece) };
  const place = { T: piece.T, state: 0, snow: r.pal ? r.pal.snow : 0, vx, vy, rise: wallRise(map, i, r.time || 0) };
  return { b, place, piece };
}

/**
 * A dragged wall's ghost: the plan's tiles that would be built, each as the
 * piece it would be with the plan's other tiles standing (`ghostModel`
 * descriptors with their look already worked out: modelPass.js placeGhost).
 */
export function wallGhosts(r, plan) {
  const game = r.game;
  const map = game.map;
  const look = lookOfGame(game);
  const planned = new Set();
  for (const it of plan.items) if (it.ok && !it.exists) planned.add(map.idx(it.x, it.y));
  const extra = (x, y) => map.inBounds(x, y) && planned.has(map.idx(x, y));
  const out = [];
  for (const it of plan.items) {
    if (!it.ok || it.exists) continue;
    const piece = wallPiece(map, game.buildings, it.x, it.y, r.viewTurn, look, null, extra, !!it.gate);
    const foot = r.footAt(it.x, it.y, 1);
    out.push({
      type: 'wall', x: it.x, y: it.y, size: 1, T: piece.T, vx: foot.vx, vy: foot.vy, ok: true, snow: r.pal ? r.pal.snow : 0,
      variant: { key: piece.key, state: 'open', ice: false, more: stubsMore(look, piece) },
    });
  }
  return out;
}

/**
 * The sprite a wall piece keeps for clicks (never drawn): boxes as tall as
 * the model's, so a figure the model hides is hidden to a click too. Keyed
 * by the piece's shape and turn in the view, its tower and whether a gate.
 */
export function wallCoverKey(piece) {
  return `wcov:${piece.shape}:${piece.T}:${piece.tower || '-'}`;
}

export function wallCoverSpec(piece) {
  const hw = WALL.hw / TILE_M;
  const top = (piece.gate ? W_GATE_TOP : piece.tower === 'square' ? W.square.top + W.square.roof : piece.tower === 'round' ? W.round.top + W.round.roof : WALL_TOP) * PX_M;
  const H = Math.ceil(top) + 2;
  const mask = piece.gate ? (piece.T & 1 ? 5 : 10) : rotMask(CANON[piece.shape], piece.T);
  return {
    w: CONFIG.TILE_W,
    h: CONFIG.TILE_H + H,
    ax: HALF_W,
    ay: H,
    draw(ctx) {
      const c = '#808080';
      const wallH = WALL_TOP * PX_M;
      if (piece.gate) {
        const d = W.gate.depth / TILE_M;
        if (piece.T & 1) box(ctx, 0.5 - d, 0, 2 * d, 1, 0, top, c);
        else box(ctx, 0, 0.5 - d, 1, 2 * d, 0, top, c);
        return;
      }
      // Back arms first (N, W), the middle, then the front ones (E, S): the painter's order.
      if (mask & 1) box(ctx, 0.5 - hw, 0, 2 * hw, 0.5, 0, wallH, c);
      if (mask & 8) box(ctx, 0, 0.5 - hw, 0.5, 2 * hw, 0, wallH, c);
      if (piece.tower === 'square') {
        const t = W.square.half / TILE_M;
        box(ctx, 0.5 - t, 0.5 - t, 2 * t, 2 * t, 0, top, c);
      } else if (piece.tower === 'round') {
        const t = (W.round.r * 0.92) / TILE_M;
        box(ctx, 0.5 - t, 0.5 - t, 2 * t, 2 * t, 0, top, c);
      } else {
        box(ctx, 0.5 - hw, 0.5 - hw, 2 * hw, 2 * hw, 0, wallH, c);
      }
      if (mask & 2) box(ctx, 0.5, 0.5 - hw, 0.5, 2 * hw, 0, wallH, c);
      if (mask & 4) box(ctx, 0.5 - hw, 0.5, 2 * hw, 0.5, 0, wallH, c);
    },
  };
}
const W = WALL;
/** A gatehouse's top (its merlons). */
const W_GATE_TOP = WALL.gate.top + (WALL.breast - WALL.walk) + WALL.merlonH + WALL.cap;

/**
 * A gate's torches as the night's light map wants them: [u, v, z] (view
 * tiles and art px up) for the two on the face the view sees, or none if
 * the model is not drawn. The canonical gate (models/townWall.js) has
 * them at (+-x, y, +-z) on its two faces.
 */
export function gateTorchPoints(r, x, y) {
  const map = r.game.map;
  const piece = wallPiece(map, r.game.buildings, x, y, r.viewTurn, 'polygonal');
  const [tx, ty] = WALL.gate.torch;
  const z = WALL.gate.depth + 0.3;
  const foot = r.footAt(x, y, 1);
  const out = [];
  // The face toward the camera: +z at turn 0 (the camera looks from +u +v), +x... turned by T.
  const T = piece.T & 3;
  for (const sx of [-1, 1]) {
    // The face toward +v at T 0 is the model's +z; at T 1 the model's +z is the view's -u, so its -z face looks to +u.
    const sz = T === 0 ? 1 : -1;
    const [mx, mz] = [sx * tx, sz * z];
    // Model metres to view tiles, turned as models.js modelMatrix turns (T: +x to +z).
    const [u, v] = T === 0 ? [mx, mz] : [-mz, mx];
    out.push([foot.vx + 0.5 + u / TILE_M, foot.vy + 0.5 + v / TILE_M, (ty + 0.3) * PX_M]);
  }
  return out;
}
