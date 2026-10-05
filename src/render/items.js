/**
 * items.js
 * ----------------------------------------------------------------------------
 * What a frame is made of, shared by the renderer (which collects it) and its
 * back ends (which draw it): the kinds of depth-sorted items, and where a
 * cached sprite lands on the screen.
 *
 * Renderer.render() works out WHAT to draw: the visible ground tiles, the
 * objects sorted back to front by depth (the view's x + y of their front
 * point), building strips with their columns of the sprite. A back end only
 * draws it: render/canvasBackend.js on the 2D canvas, render3d/webglBackend.js
 * with WebGL. Both place a sprite through `spriteRect`, so a sprite lands on
 * the same device pixels whichever draws it.
 * ----------------------------------------------------------------------------
 */

/** Item kinds; at equal depth the smaller kind is drawn first. */
export const K_STRIP = 0; // a cached sprite: a building strip, a tree, rocks, a wall, a bridge deck...
export const K_WALKER = 1;
export const K_FIRE = 2;
export const K_COLUMN = 3; // an overlay's info column
export const K_EXTRA = 4; // live details over a building: flags, crowds, stock, spray, races, overlay footprints
export const K_UNIT = 5;
export const K_PROJ = 6;
export const K_FLAG = 7;
export const K_GATE = 8; // the gateway at the map entrance / exit

/** The rectangle spriteRect() fills in (one object, reused: thousands are placed a frame). */
const RECT = { sx: 0, sw: 0, dx: 0, dy: 0, dw: 0, dh: 0, exact: true };

/**
 * Where a cached sprite (sprites.js) with its anchor at world px (wx, wy)
 * lands on the screen: source columns `sx`..`sx + sw` of its canvas (all
 * rows) drawn to device px (dx, dy), `dw` x `dh`. `exact`: drawn 1:1 at whole
 * pixels (a sprite made for this scale); otherwise stretched by scale / s
 * (a zoom still easing, or a sprite borrowed from the other zoom level).
 * `n` > 0 asks for strip `j` of `n` (a vertical slice, see Renderer
 * stripsFor): stretched strips snap their edges to whole pixels so
 * neighbouring strips meet exactly (no hairline seams through buildings).
 * Returns null for an empty strip. The object returned is reused by the
 * next call.
 */
export function spriteRect(spr, wx, wy, cam, j = 0, n = 0) {
  const k = cam.scale;
  const r = RECT;
  if (!n) {
    r.sx = 0;
    r.sw = spr.w;
    if (spr.s === k) {
      r.exact = true;
      r.dx = Math.round((wx - cam.x) * k) - spr.ax;
      r.dy = Math.round((wy - cam.y) * k) - spr.ay;
      r.dw = spr.w;
      r.dh = spr.h;
      return r;
    }
    const f = k / spr.s;
    r.exact = false;
    r.dx = (wx - cam.x) * k - spr.ax * f;
    r.dy = (wy - cam.y) * k - spr.ay * f;
    r.dw = spr.w * f;
    r.dh = spr.h * f;
    return r;
  }
  const sx0 = Math.round((j * spr.w) / n);
  const sx1 = Math.round(((j + 1) * spr.w) / n);
  if (sx1 <= sx0) return null;
  r.sx = sx0;
  r.sw = sx1 - sx0;
  if (spr.s === k) {
    r.exact = true;
    r.dx = Math.round((wx - cam.x) * k) - spr.ax + sx0;
    r.dy = Math.round((wy - cam.y) * k) - spr.ay;
    r.dw = sx1 - sx0;
    r.dh = spr.h;
    return r;
  }
  const f = k / spr.s;
  const X = (wx - cam.x) * k - spr.ax * f;
  const d0 = Math.round(X + sx0 * f);
  const d1 = Math.round(X + sx1 * f);
  if (d1 <= d0) return null;
  r.exact = false;
  r.dx = d0;
  r.dy = Math.round((wy - cam.y) * k - spr.ay * f);
  r.dw = d1 - d0;
  r.dh = Math.round(spr.h * f);
  return r;
}
