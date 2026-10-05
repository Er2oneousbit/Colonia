/**
 * ground/groundWorker.js
 * ----------------------------------------------------------------------------
 * A worker that paints the ground's textures (groundSurfaces.js) off the
 * page's thread: about a second and a half of arithmetic on a desktop CPU,
 * which on the main thread would freeze the game as the WebGL renderer
 * starts. scripts/build.mjs bundles this file on its own and hands the
 * code to the game as a string (groundTextures.js starts it from a Blob).
 *
 * Asked { size }, it answers once per layer, in order:
 *   { i, name, metres, albedo, normal, orm } (the buffers transferred)
 * then { done: true }.
 * ----------------------------------------------------------------------------
 */

import { GROUND_LAYERS, makeGroundLayer } from './groundSurfaces.js';

self.onmessage = (e) => {
  const size = e.data && e.data.size;
  try {
    GROUND_LAYERS.forEach((l, i) => {
      const m = makeGroundLayer(l.name, size);
      self.postMessage({ i, name: l.name, metres: l.metres, albedo: m.albedo, normal: m.normal, orm: m.orm }, [m.albedo.buffer, m.normal.buffer, m.orm.buffer]);
    });
    self.postMessage({ done: true });
  } catch (err) {
    self.postMessage({ error: String(err && err.message ? err.message : err) });
  }
};
