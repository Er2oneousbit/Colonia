/**
 * coverArt.js
 * ----------------------------------------------------------------------------
 * Two cheap stand-ins for a building's full sprite.
 *
 * modelCoverSpec: what a building drawn as a 3D model keeps for clicks and
 * for where a sign stands (renderer.js collectBuilding). It is never drawn.
 * Its shape is the model's: the footprint, as high as the model is (measured
 * from the built kit, render3d/modelPass.js coverPx). The 2D art is another
 * building: a fort's rampart is 17 px high as a model and 36 as art, and a
 * soldier behind the low one was unclickable where the art said he was hidden.
 *
 * flatSprite: a plain footprint, the sprite to draw for a frame or two when
 * the sprite budget is spent and the cache has nothing to borrow (SpriteCache
 * `standIn`): after a fall back from WebGL to the 2D view every visible
 * building needs a sprite at once. It sharpens as the real sprites are made.
 * ----------------------------------------------------------------------------
 */

import { CONFIG, HALF_W, HALF_H } from '../config.js';
import { makeCanvas } from './sprites.js';
import { box } from './draw.js';

const TH = CONFIG.TILE_H;
/** Cover heights are rounded up to this many px, so one cover serves a whole range of models. */
const STEP = 4;

/** A cover's height: rounded up to STEP, and at least a step (a flat model still takes a click). */
export function modelCoverH(px) {
  return Math.max(STEP, Math.ceil(px / STEP) * STEP);
}

/** The cache key of a model's cover: its footprint (tiles) and its height (px, as modelCoverPx gives). */
export function modelCoverKey(S, px) {
  return `mcov:${S}:${modelCoverH(px)}`;
}

/**
 * A box over an S x S footprint, `px` high. A box looks the same from every
 * side, so the view's turn is not part of the key.
 */
export function modelCoverSpec(S, px) {
  const H = modelCoverH(px);
  return {
    w: S * CONFIG.TILE_W,
    h: H + S * TH + 2,
    ax: S * HALF_W,
    ay: H,
    draw(ctx) {
      box(ctx, 0, 0, S, S, 0, H, '#808080', { plain: true });
    },
  };
}

/**
 * A flat footprint for a building's spec (its width, height and anchor tell
 * the size and where the footprint is: the diamond at the bottom). One
 * canvas per size, kept in `store` (the renderer's), at one world px a pixel.
 */
export function flatSprite(store, spec) {
  const w = Math.max(1, Math.round(spec.w));
  const h = Math.max(1, Math.ceil(spec.h));
  const id = `${w}x${h}@${spec.ax},${spec.ay}`;
  let spr = store.get(id);
  if (spr) return spr;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const S = w / CONFIG.TILE_W;
  const cx = spec.ax;
  const top = spec.ay;
  ctx.fillStyle = '#a89f8f';
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx + S * HALF_W, top + S * HALF_H);
  ctx.lineTo(cx, top + S * TH);
  ctx.lineTo(cx - S * HALF_W, top + S * HALF_H);
  ctx.closePath();
  ctx.fill();
  spr = { canvas, ax: Math.round(spec.ax), ay: Math.round(spec.ay), w, h, s: 1 };
  store.set(id, spr);
  return spr;
}
