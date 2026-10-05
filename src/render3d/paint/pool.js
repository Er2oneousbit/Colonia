/**
 * paint/pool.js
 * ----------------------------------------------------------------------------
 * Every procedural texture (the look's surfaces, the ground's layers) is
 * painted through one pool of workers, one per spare core, so start-up
 * takes about as long as the slowest texture instead of the sum of them
 * all (the lab's well and ground: about 6 s of arithmetic, now spread over
 * up to 8 cores). And painted only once: loadAll() reads the cache
 * (paint/cache.js) as the pool starts, drops what the cache has, and keeps
 * what it paints.
 *
 * The workers run paint/worker.js, which the build bundles on its own and
 * inlines as a string (__TEX_WORKER__): started from a Blob, nothing to
 * fetch, one file to ship. They are started when a job needs one, each
 * paints one job at a time (so the queue's order holds: the biggest
 * textures first, the slowest finishing no later than it must), sends its
 * maps back as transferred buffers, and is ended after a few idle seconds
 * (a worker holds a copy of the recipes and their scratch fields).
 *
 * Where there are no workers (the unbundled dev server, a page that forbids
 * them, node), or a worker fails to start or dies, the pool goes over to
 * painting on the page, one job a frame: slower and with hitches, but the
 * textures still come.
 * ----------------------------------------------------------------------------
 */

import { paintJob, keepsHeight } from './jobs.js';
import { cacheGetAll, cachePut } from './cache.js';

/* global __TEX_WORKER__ */
/** The worker's code, set by scripts/build.mjs (null when running the sources unbundled). */
const WORKER_CODE = typeof __TEX_WORKER__ === 'string' ? __TEX_WORKER__ : null;

/**
 * How many workers for `cores` logical cores: all but two (the page's own
 * thread and the browser's GPU process keep theirs, so the game stays
 * smooth while they paint), at least one, at most 8 (there are rarely more
 * big textures than that at once, and each worker costs memory).
 */
export function poolSize(cores) {
  const c = Number(cores) > 0 ? Number(cores) : 4;
  return Math.max(1, Math.min(8, Math.floor(c) - 2));
}

/** A job given up because it was no longer wanted (not a failure). */
export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

/** A frame on the page (or a turn of the event loop where there are no frames). */
const nextFrame = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => fn()) : setTimeout(fn, 0));

export class PaintPool {
  /**
   * @param {object} [o]
   * @param {string|null} [o.code]     the worker's code (default the build's)
   * @param {number} [o.size]          workers at most
   * @param {number} [o.idleMs]        end a worker idle this long
   * @param {function} [o.createWorker] makes a worker (tests hand in a fake)
   */
  constructor({ code = WORKER_CODE, size, idleMs = 3000, createWorker = null } = {}) {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
    this.size = size || poolSize(cores);
    this.idleMs = idleMs;
    this.code = code;
    this.url = null;
    this.createWorker = createWorker || (code ? () => this.blobWorker() : null);
    this.workers = []; // { w, entry, timer }
    this.queue = [];
    this.seq = 0;
    this.started = 0; // workers started, ever (stats, tests)
    this.onPage = 0; // jobs painted on the page
    /** No workers to be had: paint on the page. */
    this.broken = !this.createWorker;
    this.paging = false;
    this.disposed = false;
  }

  blobWorker() {
    if (typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL === 'undefined' || !URL.createObjectURL) throw new Error('no workers');
    if (!this.url) this.url = URL.createObjectURL(new Blob([this.code], { type: 'text/javascript' }));
    return new Worker(this.url);
  }

  /**
   * Paint a job (paint/jobs.js). Higher `priority` goes first; then the
   * bigger texture; then the older job. Resolves to its maps. `start`
   * false only queues it (several queued, then one pump(): the biggest of
   * them go to the free workers, not the first asked for).
   */
  run(job, priority = 0, start = true) {
    let entry = null;
    const p = new Promise((resolve, reject) => {
      if (this.disposed) {
        reject(new Error('paint pool disposed'));
        return;
      }
      entry = { job, priority, seq: ++this.seq, resolve, reject };
      const before = (a, b) => a.priority > b.priority || (a.priority === b.priority && (a.job.size > b.job.size || (a.job.size === b.job.size && a.seq < b.seq)));
      let i = this.queue.length;
      while (i > 0 && before(entry, this.queue[i - 1])) i--;
      this.queue.splice(i, 0, entry);
      if (start) this.pump();
    });
    /**
     * No longer wanted (the cache had it): dropped from the queue, or its
     * worker ended mid-paint; `restart` false leaves starting the next job
     * to a later pump() (when several are dropped at once).
     */
    p.cancel = (restart = true) => { if (entry) this.cancel(entry, restart); };
    return p;
  }

  cancel(entry, restart = true) {
    const q = this.queue.indexOf(entry);
    if (q >= 0) {
      this.queue.splice(q, 1);
      entry.reject(new CancelledError());
      return;
    }
    const wk = this.workers.find((w) => w.entry === entry);
    if (!wk) return; // (painted already, or painted on the page)
    // A worker cannot be interrupted: end it (a new one starts if there is more to paint).
    this.workers.splice(this.workers.indexOf(wk), 1);
    clearTimeout(wk.timer);
    wk.w.terminate();
    entry.reject(new CancelledError());
    if (restart) this.pump();
  }

  /** Hand queued jobs to idle workers, starting workers up to the pool's size. */
  pump() {
    if (this.disposed) return;
    if (this.broken) {
      this.pumpPage();
      return;
    }
    while (this.queue.length) {
      let wk = this.workers.find((w) => !w.entry);
      if (!wk) {
        if (this.workers.length >= this.size) return;
        wk = this.spawn();
        if (!wk) {
          this.giveUp();
          return;
        }
      }
      const entry = this.queue.shift();
      clearTimeout(wk.timer);
      wk.entry = entry;
      try {
        wk.w.postMessage({ id: entry.seq, job: entry.job });
      } catch {
        this.queue.unshift(entry);
        wk.entry = null;
        this.giveUp();
        return;
      }
    }
  }

  spawn() {
    let w;
    try {
      w = this.createWorker();
    } catch {
      return null;
    }
    const wk = { w, entry: null, timer: 0 };
    w.onmessage = (e) => this.answer(wk, e.data);
    w.onerror = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      this.giveUp();
    };
    w.onmessageerror = () => this.giveUp();
    this.workers.push(wk);
    this.started++;
    return wk;
  }

  answer(wk, msg) {
    const entry = wk.entry;
    if (!entry || !msg || msg.id !== entry.seq) return;
    wk.entry = null;
    if (msg.error) entry.reject(new Error(msg.error));
    else entry.resolve({ albedo: msg.albedo, normal: msg.normal, orm: msg.orm, height: msg.height || null });
    this.pump();
    if (!wk.entry && !this.disposed) wk.timer = setTimeout(() => this.retire(wk), this.idleMs);
  }

  retire(wk) {
    if (wk.entry) return;
    const i = this.workers.indexOf(wk);
    if (i >= 0) this.workers.splice(i, 1);
    wk.w.terminate();
  }

  /**
   * A worker failed to start or died (a page that forbids Blob workers, out
   * of memory): end them all, and paint what they had and what is queued on
   * the page instead.
   */
  giveUp() {
    if (this.broken) return;
    this.broken = true;
    const back = [];
    for (const wk of this.workers) {
      clearTimeout(wk.timer);
      if (wk.entry) back.push(wk.entry);
      try {
        wk.w.terminate();
      } catch {
        // (Already gone.)
      }
    }
    this.workers = [];
    this.queue.unshift(...back.sort((a, b) => a.seq - b.seq));
    this.pumpPage();
  }

  /** Paint the queue on the page, one job a frame. */
  pumpPage() {
    if (this.paging || this.disposed) return;
    this.paging = true;
    const step = () => {
      const entry = this.queue.shift();
      if (!entry || this.disposed) {
        this.paging = false;
        return;
      }
      try {
        entry.resolve(paintJob(entry.job));
      } catch (err) {
        entry.reject(err);
      }
      this.onPage++;
      nextFrame(step);
    };
    nextFrame(step);
  }

  /** How many jobs are waiting or being painted. */
  get busy() {
    return this.queue.length + this.workers.filter((w) => w.entry).length;
  }

  /** End every worker; jobs not yet painted are rejected. */
  dispose() {
    this.disposed = true;
    for (const wk of this.workers) {
      clearTimeout(wk.timer);
      if (wk.entry) wk.entry.reject(new Error('paint pool disposed'));
      wk.w.terminate();
    }
    this.workers = [];
    for (const e of this.queue) e.reject(new Error('paint pool disposed'));
    this.queue = [];
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }
}

let shared = null;
/** The page's one pool (made at the first texture asked for). */
export function paintPool() {
  if (!shared) shared = new PaintPool();
  return shared;
}

/**
 * Load the maps of `jobs`: from the cache where they are kept, painted in
 * the pool where not (and kept for next time). `onMaps(i, maps, cached)` is
 * called once for each as it comes, in any order; `onError(i, err)` if one
 * could not be painted. Resolves when all have come or failed.
 *
 * The cache and the pool race: every job goes to the pool at once (all
 * together, so the biggest start first) while the cache is read, and a job
 * the cache has is then dropped from the queue, or its worker ended. A
 * first visit so never waits on the cache (creating the database took over
 * a second on a desktop, painting the ground's layers a quarter of that),
 * and a second visit loses only what the workers began before the cache
 * answered.
 */
export function loadAll(jobs, onMaps, { pool = paintPool(), priority = 0, onError = null } = {}) {
  const n = jobs.length;
  return new Promise((resolve) => {
    if (!n) {
      resolve();
      return;
    }
    const done = new Array(n).fill(false);
    /** What the cache said: null not yet, true it has the job, false it has not. */
    const kept = new Array(n).fill(null);
    /** Painted before the cache answered: kept once it says it had none. */
    const unsaved = new Array(n).fill(null);
    /** Failed before the cache answered: the cache may still have it. */
    const failedEarly = new Array(n).fill(null);
    let left = n;
    const report = (i, err) => {
      if (onError) onError(i, err);
      else console.warn(`Texture ${jobs[i].name} could not be painted:`, err);
    };
    const settle = (i) => {
      done[i] = true;
      if (--left === 0) resolve();
    };
    const deliver = (i, maps, cached) => {
      if (done[i]) return;
      try {
        onMaps(i, maps, cached);
      } catch (err) {
        report(i, err);
      }
      settle(i);
    };
    const fail = (i, err) => {
      if (done[i]) return;
      report(i, err);
      settle(i);
    };
    const paint = (job, i) => {
      const run = pool.run(job, priority, false);
      run.then((maps) => {
        if (keepsHeight(job) && !maps.height) throw new Error(`${job.name}: no height`);
        if (kept[i] === false) cachePut(job, maps);
        else if (kept[i] === null) unsaved[i] = maps;
        deliver(i, maps, false);
      }).catch((err) => {
        if (err instanceof CancelledError) return; // (the cache had it)
        if (kept[i] === null) failedEarly[i] = err;
        else fail(i, err);
      });
      return run;
    };
    // (Painting on the page holds the page up a whole texture at a time: there, ask the cache first.)
    const race = !pool.broken;
    const runs = race ? jobs.map(paint) : [];
    pool.pump();
    cacheGetAll(jobs).then((found) => {
      found.forEach((hit, i) => {
        kept[i] = !!hit;
        if (hit) {
          // Dropped without starting the next job: the rest of the hits are dropped too before anything restarts.
          if (race) runs[i].cancel(false);
          deliver(i, hit, true);
          return;
        }
        if (!race) paint(jobs[i], i);
        if (unsaved[i]) cachePut(jobs[i], unsaved[i]);
        unsaved[i] = null;
        if (failedEarly[i]) fail(i, failedEarly[i]);
      });
      pool.pump();
    });
  });
}
