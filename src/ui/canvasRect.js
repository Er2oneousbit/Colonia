/**
 * canvasRect.js
 * ----------------------------------------------------------------------------
 * The game canvas's box on the page, read once and kept. getBoundingClientRect
 * forces a layout, and the pointer code asked for it on every move and the
 * tooltip on every frame. The box only changes with the window, the browser
 * zoom, fullscreen or a scroll, so those (and a ResizeObserver on the canvas,
 * where there is one) drop the copy and the next read takes a fresh one.
 * ----------------------------------------------------------------------------
 */

const kept = new WeakMap();

/** The canvas's rect (do not change it). */
export function canvasRect(canvas) {
  let r = kept.get(canvas);
  if (!r) {
    r = canvas.getBoundingClientRect();
    kept.set(canvas, r);
  }
  return r;
}

/** Forget the rect: it is read again at the next canvasRect. */
export function dropCanvasRect(canvas) {
  kept.delete(canvas);
}

/** Drop the rect whenever the page could have moved the canvas. */
export function watchCanvasRect(canvas) {
  const drop = () => dropCanvasRect(canvas);
  window.addEventListener('resize', drop);
  window.addEventListener('scroll', drop, true);
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, drop);
  if (typeof ResizeObserver === 'function') new ResizeObserver(drop).observe(canvas);
}
