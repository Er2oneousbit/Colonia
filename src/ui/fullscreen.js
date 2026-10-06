/**
 * fullscreen.js
 * ----------------------------------------------------------------------------
 * The whole page fullscreen (the Fullscreen API): when a game starts
 * (Settings > Fullscreen when a game starts, on by default: App.startGame),
 * and from the top bar's button or the game menu.
 *
 * Browsers allow it only inside a click or key press (a "user activation"),
 * so it is asked for in the handler of Begin, Continue or Load, never when
 * a game starts by itself (a URL flag, a test). Where the page may not go
 * fullscreen (an embedding frame without allowfullscreen, as a claude.ai
 * artifact can be, or a browser without the API) nothing happens and
 * nothing is said: the button is hidden.
 *
 * Esc: the browser takes the first Esc in fullscreen to leave it, and the
 * player meant only that. Browsers mostly keep that Esc from the page; one
 * that hands it on after leaving would also open the game menu, so
 * an Esc just after leaving fullscreen (ESC_GRACE_MS) does nothing in the
 * game (escapeLeavesFullscreen); the next Esc works as ever. An Esc while
 * still fullscreen is the game's: where the browser does not leave on it
 * (a key sent by a test, a kiosk), swallowing it would leave no Esc at all.
 * ----------------------------------------------------------------------------
 */

/** An Esc this soon after leaving fullscreen was the one that left it. */
export const ESC_GRACE_MS = 400;

/** The element in fullscreen now (null if none), in any browser's spelling. */
export function fullscreenElement(doc = globalThis.document) {
  if (!doc) return null;
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

/** May this page go fullscreen (the API is there, and no frame around it forbids it)? */
export function fullscreenAvailable(doc = globalThis.document) {
  if (!doc || !doc.documentElement) return false;
  const el = doc.documentElement;
  const can = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  const enabled = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? true;
  return can && enabled !== false;
}

/**
 * Ask for the whole page fullscreen. Returns true when it was asked (the
 * browser may still refuse: its promise's rejection is swallowed, quietly).
 */
export function requestFullscreen(doc = globalThis.document) {
  if (!fullscreenAvailable(doc) || fullscreenElement(doc)) return false;
  const el = doc.documentElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Leave fullscreen (nothing if not in it). */
export function exitFullscreen(doc = globalThis.document) {
  if (!fullscreenElement(doc)) return false;
  try {
    const p = doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Was an Esc pressed now the browser's own, the one that left fullscreen?
 * True within ESC_GRACE_MS of having left it (`leftAt`, performance.now();
 * 0 if never), not while still in it (see the header).
 */
export function escapeLeavesFullscreen(inFullscreen, leftAt, now) {
  return !inFullscreen && leftAt > 0 && now - leftAt < ESC_GRACE_MS;
}
