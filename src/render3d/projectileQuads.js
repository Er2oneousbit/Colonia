/**
 * projectileQuads.js
 *
 * The geometry of a projectile in flight as textured quads, so the WebGL
 * back end can draw it from a few small shared textures instead of
 * painting a Canvas2D cell into the live atlas every frame (the same move
 * v0.30.5 made for particles). The shapes and sizes mirror
 * militaryArt.drawProjectile, which stays the Classic drawing.
 *
 * Pure functions of the projectile and the camera scale: no GL here, so a
 * test can check the corners.
 */

/** The arrow texture: 44 x 8 px, 5 px per unit of k (see TAIL, HEAD and HALF_WIDTH). */
export const SHAFT_W = 44;
export const SHAFT_H = 8;

// In units of k (Classic's scale): the shaft runs 4 ahead of the centre to
// 4 behind it, the 1.6 square fletching is centred on the tail end (so the
// quad reaches 4.8 behind), and the line is 0.9 thick.
const TAIL = 4.8;
const HEAD = 4;
const HALF_WIDTH = 0.8;

/**
 * The arrow's quad: four corners [x, y] in device px, in the order
 * (u 0, v 0), (u 1, v 0), (u 0, v 1), (u 1, v 1) of the shaft texture,
 * centred on (sx, sy) and turned to the screen direction of (vx, vy) in
 * view tiles.
 */
export function arrowCorners(sx, sy, k, vx, vy) {
  const dx = vx - vy;
  const dy = (vx + vy) * 0.5;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * HALF_WIDTH * k;
  const ny = ux * HALF_WIDTH * k;
  const tx = sx - ux * TAIL * k;
  const ty = sy - uy * TAIL * k;
  const hx = sx + ux * HEAD * k;
  const hy = sy + uy * HEAD * k;
  return [
    [tx - nx, ty - ny],
    [hx - nx, hy - ny],
    [tx + nx, ty + ny],
    [hx + nx, hy + ny],
  ];
}

/** The fire pot's flame and pot as axis-aligned ellipses { cx, cy, rx, ry } (the flame is drawn first, under the pot). */
export function firePotEllipses(sx, sy, k, vx, vy) {
  return {
    flame: { cx: sx - (vx - vy) * 6 * k, cy: sy - 1.5 * k, rx: 1.4 * k, ry: 2.4 * k },
    pot: { cx: sx, cy: sy, rx: 1.6 * k, ry: 1.6 * k },
  };
}

/** The sling stone as a disc. */
export function stoneEllipse(sx, sy, k) {
  return { cx: sx, cy: sy, rx: 1.3 * k, ry: 1.3 * k };
}

/** Paint the arrow (dark line, pale fletching at the tail) into a SHAFT_W x SHAFT_H context. */
export function paintShaft(ctx) {
  const unit = SHAFT_H / 1.6;
  ctx.clearRect(0, 0, SHAFT_W, SHAFT_H);
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(SHAFT_H / 2, (SHAFT_H - 0.9 * unit) / 2, SHAFT_W - SHAFT_H / 2, 0.9 * unit);
  ctx.fillStyle = '#f2eee6';
  ctx.fillRect(0, 0, 1.6 * unit, SHAFT_H);
}
