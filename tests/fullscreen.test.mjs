// Fullscreen on starting a game (ui/fullscreen.js): asked quietly, never where forbidden, and the
// Esc that left it does nothing else.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fullscreenAvailable, requestFullscreen, exitFullscreen, escapeLeavesFullscreen, ESC_GRACE_MS } from '../src/ui/fullscreen.js';
import { parseFlags } from '../src/core/debug.js';

/** A document with the Fullscreen API: `refuse` rejects the request (no user gesture), `enabled` false as in a frame without allowfullscreen. */
function fakeDoc({ refuse = false, enabled = true, api = true } = {}) {
  const doc = { fullscreenElement: null, fullscreenEnabled: enabled, asks: 0, exits: 0 };
  doc.documentElement = api ? {
    requestFullscreen(opts) {
      doc.asks++;
      doc.opts = opts;
      if (refuse) return Promise.reject(new TypeError('Permissions check failed'));
      doc.fullscreenElement = doc.documentElement;
      return Promise.resolve();
    },
  } : {};
  doc.exitFullscreen = () => { doc.exits++; doc.fullscreenElement = null; return Promise.resolve(); };
  return doc;
}

test('fullscreen: the whole page is asked for, once, and a refusal is swallowed', async () => {
  const d = fakeDoc();
  assert.equal(fullscreenAvailable(d), true);
  assert.equal(requestFullscreen(d), true);
  assert.equal(d.asks, 1);
  assert.equal(d.opts.navigationUI, 'hide');
  // Already fullscreen: nothing more.
  assert.equal(requestFullscreen(d), false);
  assert.equal(exitFullscreen(d), true);
  assert.equal(d.fullscreenElement, null);
  const r = fakeDoc({ refuse: true });
  let unhandled = 0;
  const on = () => { unhandled++; };
  process.on('unhandledRejection', on);
  try {
    assert.equal(requestFullscreen(r), true);
    await new Promise((ok) => setTimeout(ok, 10));
  } finally {
    process.off('unhandledRejection', on);
  }
  assert.equal(unhandled, 0, 'a refused request makes no noise');
});

test('fullscreen: where a frame forbids it, or the API is missing, nothing is asked and no button shows', () => {
  const framed = fakeDoc({ enabled: false });
  assert.equal(fullscreenAvailable(framed), false);
  assert.equal(requestFullscreen(framed), false);
  assert.equal(framed.asks, 0);
  assert.equal(fullscreenAvailable(fakeDoc({ api: false })), false);
  assert.equal(fullscreenAvailable(undefined), false);
});

test('fullscreen: an Esc just after leaving it was the browser\'s; one later, or while still in it, is the game\'s', () => {
  assert.equal(escapeLeavesFullscreen(false, 1000, 1000 + ESC_GRACE_MS - 10), true);
  assert.equal(escapeLeavesFullscreen(false, 1000, 1000 + ESC_GRACE_MS + 10), false);
  assert.equal(escapeLeavesFullscreen(false, 0, 50), false, 'never left fullscreen');
  assert.equal(escapeLeavesFullscreen(true, 1000, 1010), false, 'still in it: the game\'s Esc');
});

test('fullscreen: the URL can turn it off (fullscreen=0), and pick the render scale', () => {
  assert.equal(parseFlags('?fullscreen=0').fullscreen, false);
  assert.equal(parseFlags('?fullscreen=1').fullscreen, true);
  assert.equal(parseFlags('').fullscreen, null);
  assert.equal(parseFlags('?scale=0.5').scale, '0.5');
  assert.equal(parseFlags('?scale=2').scale, null);
});
