/**
 * renderScale.js
 * ----------------------------------------------------------------------------
 * How many pixels the WebGL back end draws its 3D scene with (Settings >
 * Render scale): a share of the view's device pixels for the whole scene,
 * and a share for the 3D ground under it. The HUD, the menus, the text and
 * the 2D overlay (signs, previews, outlines) are never touched: they are
 * not drawn by WebGL.
 *
 * A fixed choice (100%, 75%, 50%) draws the scene and its ground at that
 * share. Auto steps along LADDER as frames run long or have room to spare:
 * first the ground, whose shader is most of the GPU's work and which shows
 * least (a soft surface under sharp sprites), then the whole scene. It
 * starts where the GPU suggests (startRung: a graphics chip in the
 * processor starts with the ground at about the page's CSS pixels; no GPU at
 * all, a quarter of the pixels).
 *
 * The rules, so it never flickers between two steps (AutoScale):
 *   - It decides once a window of WINDOW_MS, from the frames in it: their
 *     mean interval (frames slower than SPIKE_MS are hiccups, a sprite being
 *     made or the tab coming back, and left out), the page's own time for
 *     them, and the GPU's (a timer query; null where the browser has none).
 *   - Down one step when a window is slow (under about 50 frames a second)
 *     and the page itself is not what takes the time (the GPU or the
 *     compositor is): fewer pixels would not help a page busy with the sim.
 *   - Up one step only after UP_WINDOWS fast windows in a row (at the
 *     screen's own rate, and the GPU's time, where known, small enough for
 *     the next step's pixels), and not before `wait` has passed since the
 *     last step down. A step up that is followed by a step down within
 *     BOUNCE_MS doubles `wait` (up to WAIT_MAX_MS): a scale it cannot keep
 *     is tried less and less often.
 *   - After a step it waits SETTLE_MS (the new size's first frames redraw
 *     everything) before judging again.
 * Pure: tested in node (tests/renderScale.test.mjs).
 * ----------------------------------------------------------------------------
 */

/** Auto's steps, best first: the scene's and the ground's share of the view's device px (each axis). */
export const LADDER = Object.freeze([
  Object.freeze({ scene: 1, ground: 1 }),
  Object.freeze({ scene: 1, ground: 0.75 }),
  Object.freeze({ scene: 1, ground: 0.5 }),
  Object.freeze({ scene: 0.75, ground: 0.5 }),
  Object.freeze({ scene: 0.75, ground: 0.375 }),
  Object.freeze({ scene: 0.5, ground: 0.375 }),
  Object.freeze({ scene: 0.5, ground: 0.25 }),
]);

/** The Settings choices: 'auto', or a share of the device pixels. */
export const SCALE_CHOICES = Object.freeze(['auto', '1', '0.75', '0.5']);

export const WINDOW_MS = 1000;
export const SPIKE_MS = 120;
/** A window slower than this (ms a frame) is slow. */
export const SLOW_MS = 21;
/** A window at most this is fast (a 60 Hz screen's frames, with a little room). */
export const FAST_MS = 17.6;
/** The GPU's time a frame (ms) that the next step's pixels may cost at most to step up. */
export const GPU_ROOM_MS = 11;
export const UP_WINDOWS = 4;
export const SETTLE_MS = 1500;
export const WAIT_MS = 6000;
export const WAIT_MAX_MS = 120000;
export const BOUNCE_MS = 4000;

/**
 * The step Auto starts at: a GPU in the processor ('integrated') with the
 * ground at about one pixel per CSS pixel (at a pixel ratio of 2, half the
 * device's), software ('software') at the scene's half; a graphics card at
 * the top.
 */
export function startRung(gpu, dpr = 1) {
  if (gpu === 'software') return LADDER.length - 2;
  if (gpu === 'integrated') {
    const want = Math.min(1, 1 / Math.max(1, dpr));
    let i = 0;
    while (i < LADDER.length - 1 && LADDER[i].ground > want + 1e-6) i++;
    return Math.max(i, 1);
  }
  return 0;
}

/** The scene's and ground's shares for a Settings choice ('auto' gives null: AutoScale decides). */
export function fixedScale(choice) {
  const v = Number(choice);
  if (!(v > 0 && v <= 1)) return null;
  return { scene: v, ground: v };
}

export class AutoScale {
  /** @param {number} rung the step to start at (startRung) */
  constructor(rung = 0) {
    this.rung = Math.max(0, Math.min(LADDER.length - 1, rung));
    this.reset(0);
    this.wait = WAIT_MS;
    this.lastDown = -Infinity;
    this.lastUp = -Infinity;
    this.fastRun = 0;
    /** True once the lowest step is still slow (the back end may then lower the ground's quality). */
    this.exhausted = false;
    this.slowAtBottom = 0;
  }

  get step() { return LADDER[this.rung]; }

  reset(now) {
    this.start = now;
    this.n = 0;
    this.sum = 0;
    this.page = 0;
    this.gpuSum = 0;
    this.gpuN = 0;
    this.settleUntil = now + SETTLE_MS;
  }

  /**
   * One frame: `interval` ms since the last, `pageMs` the page's own work
   * for it, `gpuMs` the GPU's (null if unknown), at time `now` (ms).
   * Returns true when the step changed.
   */
  frame(interval, pageMs, gpuMs, now) {
    if (now < this.settleUntil) {
      this.start = now;
      return false;
    }
    if (interval > 0 && interval < SPIKE_MS) {
      this.n++;
      this.sum += interval;
      this.page += pageMs || 0;
      if (gpuMs !== null && gpuMs !== undefined && Number.isFinite(gpuMs)) {
        this.gpuSum += gpuMs;
        this.gpuN++;
      }
    }
    if (now - this.start < WINDOW_MS) return false;
    const n = this.n;
    const mean = n ? this.sum / n : 0;
    const page = n ? this.page / n : 0;
    const gpu = this.gpuN ? this.gpuSum / this.gpuN : null;
    this.reset(now);
    this.settleUntil = now; // (no settling between windows)
    if (n < 10) return false; // (too few frames to judge: a hidden tab, a long stall)
    return this.judge(mean, page, gpu, now);
  }

  judge(mean, page, gpu, now) {
    const slow = mean > SLOW_MS && page < mean * 0.75;
    if (slow) {
      this.fastRun = 0;
      if (this.rung >= LADDER.length - 1) {
        if (++this.slowAtBottom >= 3) this.exhausted = true;
        return false;
      }
      if (now - this.lastUp < BOUNCE_MS) this.wait = Math.min(WAIT_MAX_MS, this.wait * 2);
      this.rung++;
      this.lastDown = now;
      this.settleUntil = now + SETTLE_MS;
      return true;
    }
    this.slowAtBottom = 0;
    const fast = mean <= FAST_MS;
    this.fastRun = fast ? this.fastRun + 1 : 0;
    if (!fast || this.rung === 0 || this.fastRun < UP_WINDOWS || now - this.lastDown < this.wait) return false;
    if (gpu !== null) {
      // The next step's cost by its pixels: the ground's share squared is most of it.
      const a = LADDER[this.rung];
      const b = LADDER[this.rung - 1];
      const grow = (b.ground * b.ground + 0.3 * b.scene * b.scene) / (a.ground * a.ground + 0.3 * a.scene * a.scene);
      if (gpu * grow > GPU_ROOM_MS) return false;
    }
    this.rung--;
    this.lastUp = now;
    this.fastRun = 0;
    this.settleUntil = now + SETTLE_MS;
    return true;
  }
}
