/**
 * paint/jobs.js
 * ----------------------------------------------------------------------------
 * One procedural texture to paint, as plain data, so the same job runs in a
 * worker (paint/worker.js) or on the page (paint/pool.js's fallback) and
 * names its entry in the cache (paint/cache.js):
 *
 *   { kind: 'surface', name, size }   a surface of surfaces.js (the look's
 *                                     materials), `size` px square
 *   { kind: 'ground', name, size }    a layer of ground/groundSurfaces.js
 *
 * paintJob() answers with the maps as bare typed arrays, ready to be sent
 * back from a worker as transferable buffers: { albedo, normal, orm }
 * (RGBA bytes) and, for the paving whose mesh is displaced by it,
 * `height` (Float32Array, size x size).
 * ----------------------------------------------------------------------------
 */

import { SURFACES, makeSurfaceAt } from '../surfaces.js';
import { makeGroundLayer } from '../ground/groundSurfaces.js';

/** Paint a job's maps (synchronous: run it where blocking is fine). */
export function paintJob(job) {
  const m = job.kind === 'ground' ? makeGroundLayer(job.name, job.size) : makeSurfaceAt(job.name, job.size);
  return { albedo: m.albedo, normal: m.normal, orm: m.orm, height: m.height ? m.height.data : null };
}

/** The buffers of painted maps, to hand over without copying. */
export function transferables(maps) {
  const list = [maps.albedo.buffer, maps.normal.buffer, maps.orm.buffer];
  if (maps.height) list.push(maps.height.buffer);
  return list;
}

/**
 * Are these maps whole for this job? (A cache entry is checked so before
 * use: a cut-short or foreign entry is painted again, never drawn.)
 */
export function mapsFit(job, maps) {
  if (!maps) return false;
  const px = job.size * job.size;
  const bytes = (a) => a instanceof Uint8Array && a.length === px * 4;
  if (!bytes(maps.albedo) || !bytes(maps.normal) || !bytes(maps.orm)) return false;
  if (!keepsHeight(job)) return true;
  return maps.height instanceof Float32Array && maps.height.length === px;
}

/** Does this job's surface keep its height field (surfaces.js `height`)? */
export function keepsHeight(job) {
  return job.kind === 'surface' && !!(SURFACES[job.name] && SURFACES[job.name].height);
}
