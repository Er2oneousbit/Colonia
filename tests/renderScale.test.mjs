// The render scale's Auto (render3d/renderScale.js): steps down when frames run long on the GPU,
// up only with room to spare, never flickering between two steps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoScale, LADDER, startRung, fixedScale, WINDOW_MS, SETTLE_MS, WAIT_MS, BOUNCE_MS } from '../src/render3d/renderScale.js';

/** Run `ms` of frames every `interval` ms, the page busy `page` ms of each and the GPU `gpu`; returns the steps taken. */
function run(a, t0, ms, interval, page, gpu = null, untilStep = false) {
  const steps = [];
  let t = t0;
  while (t < t0 + ms) {
    t += interval;
    if (a.frame(interval, page, gpu, t)) {
      steps.push({ t, rung: a.rung });
      if (untilStep) break;
    }
  }
  return { t, steps };
}

test('render scale: the ladder goes down from the full scene and ground, the ground first', () => {
  assert.deepEqual(LADDER[0], { scene: 1, ground: 1 });
  for (let i = 1; i < LADDER.length; i++) {
    assert.ok(LADDER[i].scene <= LADDER[i - 1].scene && LADDER[i].ground <= LADDER[i - 1].ground, `step ${i}`);
    assert.ok(LADDER[i].ground <= LADDER[i].scene);
  }
  assert.equal(LADDER[1].scene, 1, 'the ground is lowered before the scene');
  assert.deepEqual(fixedScale('0.75'), { scene: 0.75, ground: 0.75 });
  assert.equal(fixedScale('auto'), null);
});

test('render scale: Auto starts at the top on a card, the ground at CSS pixels on a chip in the processor, low with no GPU', () => {
  assert.equal(startRung('card', 2), 0);
  const uhd = LADDER[startRung('integrated', 2)];
  assert.equal(uhd.scene, 1);
  assert.equal(uhd.ground, 0.5);
  assert.ok(startRung('integrated', 1) >= 1);
  assert.ok(LADDER[startRung('software', 2)].scene <= 0.5);
});

test('render scale: slow frames on the GPU step down, a step at a time with time to settle between', () => {
  const a = new AutoScale(0);
  a.reset(0);
  const { t, steps } = run(a, 0, 4000, 40, 4, 35);
  assert.ok(steps.length >= 1, 'stepped down');
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i].t - steps[i - 1].t >= SETTLE_MS + WINDOW_MS - 50, 'one step a settle and a window');
  assert.equal(steps[0].rung, 1);
  // Still slow: on down to the bottom, then `exhausted`.
  run(a, t, 60000, 40, 4, 35);
  assert.equal(a.rung, LADDER.length - 1);
  assert.equal(a.exhausted, true);
});

test('render scale: slow frames that are the page\'s own work do not lower the resolution', () => {
  const a = new AutoScale(0);
  a.reset(0);
  const { steps } = run(a, 0, 20000, 40, 36, 5);
  assert.equal(steps.length, 0);
  assert.equal(a.rung, 0);
});

test('render scale: fast frames step back up only after a wait, and a bounce makes the wait longer', () => {
  const a = new AutoScale(0);
  a.reset(0);
  // Slow: one step down.
  let { t } = run(a, 0, 2600, 40, 4, 30);
  assert.equal(a.rung, 1);
  const down = a.lastDown;
  // Fast at once: no step up before WAIT_MS has passed since the step down.
  const r1 = run(a, t, WAIT_MS - 1000, 16.7, 4, 6);
  assert.equal(r1.steps.length, 0);
  const r2 = run(a, r1.t, 6000, 16.7, 4, 6, true);
  assert.equal(r2.steps.length, 1);
  assert.equal(a.rung, 0);
  assert.ok(r2.steps[0].t - down >= WAIT_MS);
  // Slow again right after the step up: down, and the next try waits twice as long.
  const r3 = run(a, r2.t, BOUNCE_MS - 1000, 40, 4, 30);
  assert.equal(a.rung, 1);
  assert.equal(a.wait, WAIT_MS * 2);
  t = r3.t;
  const r4 = run(a, t, WAIT_MS * 2 - 1500, 16.7, 4, 6);
  assert.equal(r4.steps.length, 0, 'no step up within the longer wait');
});

test('render scale: a browser holding the page to 30 frames a second with the GPU idle is not slow, and is let back up', () => {
  const a = new AutoScale(0);
  a.reset(0);
  assert.equal(run(a, 0, 60000, 33.3, 3, 4).steps.length, 0, 'not lowered for a capped rate');
  // Lowered once (by a real slow spell), it comes back up at the capped rate, the GPU mostly idle.
  const b = new AutoScale(0);
  b.reset(0);
  const { t } = run(b, 0, 2600, 40, 4, 30);
  assert.equal(b.rung, 1);
  run(b, t, 30000, 33.3, 3, 4);
  assert.equal(b.rung, 0);
});

test('render scale: a GPU so slow that every frame is a "hiccup" still steps down', () => {
  const a = new AutoScale(0);
  a.reset(0);
  const { steps } = run(a, 0, 10000, 200, 5, null);
  assert.ok(steps.length >= 1, JSON.stringify(steps));
});

test('render scale: a frame rate between fast and slow holds the step (no flicker), and so do too few frames', () => {
  const a = new AutoScale(2);
  a.reset(0);
  const { steps } = run(a, 0, 60000, 19, 4, 9);
  assert.equal(steps.length, 0);
  // A hidden tab: a frame a second, nothing judged.
  const b = new AutoScale(2);
  b.reset(0);
  assert.equal(run(b, 0, 30000, 1000, 1, 50).steps.length, 0);
});

test('render scale: the GPU\'s time keeps Auto from stepping up where the next step would not fit', () => {
  const a = new AutoScale(2);
  a.reset(0);
  // At the screen's rate, but the GPU busy 9 ms at a quarter of the ground's pixels: more would not fit.
  const { steps } = run(a, 0, 60000, 16.7, 3, 9);
  assert.equal(steps.length, 0);
  const b = new AutoScale(2);
  b.reset(0);
  assert.ok(run(b, 0, 60000, 16.7, 3, 2).steps.length >= 1);
});
