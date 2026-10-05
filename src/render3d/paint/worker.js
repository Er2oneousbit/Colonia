/**
 * paint/worker.js
 * ----------------------------------------------------------------------------
 * A worker of the paint pool (paint/pool.js): paints one texture at a time
 * off the page's thread. scripts/build.mjs bundles this file on its own and
 * hands the code to the page as a string (__TEX_WORKER__), which the pool
 * starts as Blob workers, one per spare core.
 *
 * Asked { id, job } (paint/jobs.js), it answers
 *   { id, albedo, normal, orm, height }   the buffers transferred, not copied
 * or { id, error } when the recipe threw.
 * ----------------------------------------------------------------------------
 */

import { paintJob, transferables } from './jobs.js';

self.onmessage = (e) => {
  const { id, job } = e.data || {};
  try {
    const maps = paintJob(job);
    self.postMessage({ id, ...maps }, transferables(maps));
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
