/**
 * perf.js
 * ----------------------------------------------------------------------------
 * The performance readout (F3, the console's `perf`, Settings > Show
 * performance readout): frames a second and where a frame's milliseconds go,
 * so a player on a slow machine can see what is slow and which graphics
 * card the browser draws with.
 *
 * Stages of a frame, each a mean over the last second (ms):
 *   sim      the simulation's ticks (app.js)
 *   collect  working out what to draw: the ground's tiles, the sorted
 *            objects, the sprites made this frame (Renderer.render up to the
 *            back end's present)
 *   draw     the back end's own drawing: for WebGL the page's side of the
 *            GL calls (filling buffers, painting live art, uploads)
 *   copy     WebGL only: putting its picture on the page (none since the
 *            WebGL canvas is on the page itself; kept to compare builds)
 *   overlay  what the renderer paints on the 2D canvas after the scene:
 *            particles, clouds, the night, weather, signs, previews
 *   ui       the HUD, panels and advisors
 *   gpu      WebGL only: the GPU's own time for the frame, from a timer
 *            query (EXT_disjoint_timer_query_webgl2) where the browser has
 *            one, a frame or two late
 * and the interval between frames as the browser shows them (its mean and
 * its slowest in the last second), which is what the player feels: a frame
 * can be cheap for the page and still slow on the screen when the GPU or
 * the compositor is the bottleneck.
 *
 * Pure apart from performance.now(): tested in node (tests/perf.test.mjs).
 * ----------------------------------------------------------------------------
 */

export const STAGES = Object.freeze(['sim', 'collect', 'draw', 'copy', 'overlay', 'ui', 'gpu']);

/** Seconds a mean is taken over. */
const WINDOW = 1;

export class PerfMeter {
  constructor() {
    this.sums = Object.fromEntries(STAGES.map((s) => [s, 0]));
    this.counts = Object.fromEntries(STAGES.map((s) => [s, 0]));
    this.frames = 0;
    this.time = 0;
    this.slowest = 0;
    this.intervals = 0;
    /** The last second's means: { fps, interval, slowest, frame, sim, collect, ... } (ms). */
    this.last = { fps: 0, interval: 0, slowest: 0, frame: 0, ...Object.fromEntries(STAGES.map((s) => [s, null])) };
    this.frameSum = 0;
  }

  /**
   * One frame: `dt` seconds since the last one, `frameMs` the page's whole
   * work for it, `stages` { sim, collect, ... } in ms (a stage left out, or
   * null, did not run this frame and is not averaged).
   */
  frame(dt, frameMs, stages) {
    this.frames++;
    this.time += dt;
    this.intervals += dt * 1000;
    this.slowest = Math.max(this.slowest, dt * 1000);
    this.frameSum += frameMs;
    for (const s of STAGES) {
      const v = stages[s];
      if (v === undefined || v === null || !Number.isFinite(v)) continue;
      this.sums[s] += v;
      this.counts[s]++;
    }
    if (this.time >= WINDOW) this.roll();
  }

  /** Close a window: its means become `last`. */
  roll() {
    const n = Math.max(1, this.frames);
    const out = {
      fps: Math.round(this.frames / this.time),
      interval: this.intervals / n,
      slowest: this.slowest,
      frame: this.frameSum / n,
    };
    for (const s of STAGES) out[s] = this.counts[s] ? this.sums[s] / this.counts[s] : null;
    this.last = out;
    for (const s of STAGES) {
      this.sums[s] = 0;
      this.counts[s] = 0;
    }
    this.frames = 0;
    this.time = 0;
    this.slowest = 0;
    this.intervals = 0;
    this.frameSum = 0;
  }
}

/**
 * Does a WebGL renderer string name a graphics chip built into the
 * processor (sharing its memory, much slower than a graphics card)? Intel's
 * (UHD, Iris, HD Graphics; not its Arc A-series cards), AMD's Radeon
 * "Graphics" with no RX model (the Ryzen chips' Vega and 600M/700M/800M),
 * Qualcomm's Adreno and ARM's Mali (laptops on ARM). A laptop with such a
 * chip often has a graphics card too, which the browser may not be using.
 */
export function isIntegratedGpu(name) {
  const s = String(name || '');
  // (Safari says "Apple GPU" on every Mac, an Intel one's built-in graphics too: start light, Auto climbs.)
  if (/apple/i.test(s)) return true;
  if (/intel/i.test(s)) return !/Arc\S*\s*(\(TM\)\s*)?A\d/i.test(s);
  if (/radeon/i.test(s)) return /graphics/i.test(s) && !/\bRX\b|\bPro\b|FirePro|Instinct/i.test(s);
  return /adreno|mali|powervr/i.test(s);
}

/** Does it name a GPU drawn in software (no graphics hardware at all)? */
export function isSoftwareGpu(name) {
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(name || ''));
}

/**
 * The graphics chip a WebGL context draws with: its renderer string (the
 * unmasked one where the browser gives it, WEBGL_debug_renderer_info), and
 * whether that is a chip in the processor or software.
 */
export function gpuOf(gl) {
  let name = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  } catch {
    // (A lost context: no name.)
  }
  return { name, integrated: isIntegratedGpu(name), software: isSoftwareGpu(name), hint: isIntegratedGpu(name) && /intel|amd|radeon/i.test(name) };
}

/** The hint shown under an integrated GPU's name. */
export const INTEGRATED_HINT = 'This is the graphics chip in the processor. If this computer also has a graphics card, let the browser use it: Windows Settings > System > Display > Graphics, pick the browser, High performance, then restart the browser.';

/** The readout's lines (`info` is what the app and renderer know besides the times). */
export function perfLines(m, info) {
  const f = (v) => (v === null || v === undefined ? '-' : v < 10 ? v.toFixed(1) : String(Math.round(v)));
  const lines = [
    `${m.fps} fps  frame every ${f(m.interval)} ms (slowest ${f(m.slowest)})`,
    `page ${f(m.frame)} ms: sim ${f(m.sim)}  collect ${f(m.collect)}  draw ${f(m.draw)}${m.copy !== null ? `  copy ${f(m.copy)}` : ''}  overlay ${f(m.overlay)}  ui ${f(m.ui)}`,
  ];
  if (info.backend === 'webgl') lines.push(`gpu ${m.gpu === null ? (info.gpuTimer ? '...' : 'n/a') : `${f(m.gpu)} ms`}  draw calls ${info.drawCalls ?? '-'}`);
  lines.push(`${info.backend === 'webgl' ? 'WebGL' : 'Classic'}  ${info.size}  pixel ratio ${info.dpr}${info.scene ? `  3D scene ${info.scene}` : ''}`);
  if (info.ground) lines.push(`ground ${info.ground}  models ${info.models || '-'}`);
  if (info.gpuName) lines.push(`GPU: ${info.gpuName}`);
  if (info.hint) lines.push(INTEGRATED_HINT);
  return lines;
}
