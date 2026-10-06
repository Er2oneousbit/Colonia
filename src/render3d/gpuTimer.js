/**
 * gpuTimer.js
 * ----------------------------------------------------------------------------
 * The GPU's own time for the WebGL back end's frame, from a timer query
 * (EXT_disjoint_timer_query_webgl2), for the performance readout and the
 * render scale's Auto (webglBackend.js). The page's clock only sees how
 * long the GL calls take to hand over; the GPU works on them afterwards,
 * so a frame can cost the page 3 ms and the GPU 30.
 *
 * A query's answer comes a frame or more later: a few queries go round,
 * and each frame reads those that are ready. A "disjoint" frame (the GPU
 * changed clock or was reset) is thrown away. Without the extension (some
 * browsers withhold it) `ms` stays null.
 * ----------------------------------------------------------------------------
 */

/** Queries in flight at most (the oldest unanswered is waited for, never two begun at once). */
const RING = 4;

export class GpuTimer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.ext = null;
    try {
      this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    } catch {
      this.ext = null;
    }
    this.free = [];
    this.waiting = []; // queries ended, not yet answered (oldest first)
    this.open = null;
    /** The last answer (ms), null until one comes (or with no extension). */
    this.ms = null;
    /** When it came (performance.now()). */
    this.at = 0;
  }

  get available() { return !!this.ext; }

  /** Start timing this frame's GL work (nothing when a query is open or all are in flight). */
  begin() {
    const { gl, ext } = this;
    if (!ext || this.open || this.waiting.length >= RING) return;
    const q = this.free.pop() || gl.createQuery();
    if (!q) return;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    this.open = q;
  }

  end() {
    const { gl, ext } = this;
    if (!this.open) return;
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    this.waiting.push(this.open);
    this.open = null;
  }

  /** Read the answers that are in (call once a frame, before begin). */
  poll() {
    const { gl, ext } = this;
    if (!ext) return this.ms;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (this.waiting.length) {
      const q = this.waiting[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      this.waiting.shift();
      this.free.push(q);
      if (!disjoint) {
        this.ms = ns / 1e6;
        this.at = performance.now();
      }
    }
    return this.ms;
  }

  /** The context was lost: its queries are gone. */
  reset() {
    this.free = [];
    this.waiting = [];
    this.open = null;
    this.ms = null;
  }
}
