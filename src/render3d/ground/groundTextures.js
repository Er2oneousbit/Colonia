/**
 * ground/groundTextures.js
 * ----------------------------------------------------------------------------
 * The ground's textures: every layer of groundSurfaces.js in three texture
 * arrays (albedo and height, normal, occlusion/roughness/plants), so the
 * ground shader picks a kind by its layer number in one sampler.
 *
 * Painting them is the slow part of starting the 3D ground (about 1.4 s
 * of arithmetic for 14 layers of 256 px on a desktop CPU), so it never runs
 * on the page's thread in the built game: the build bundles groundWorker.js
 * into a string (__GROUND_WORKER__) and the textures are painted in a worker
 * started from it. Until they arrive the WebGL renderer keeps drawing the
 * ground's sprites. Where there is no worker (the unbundled dev server,
 * a page that forbids workers, node), the layers are painted on the page
 * one per frame instead (a hitch of about a tenth of a second each, never a
 * hang).
 *
 * Memory: 14 layers x 256 x 256 x 4 bytes x 3 arrays, 11 MB, and the GPU's
 * copies with their mipmaps about 15 MB. The bytes are kept: three.js
 * uploads them again after a lost WebGL context.
 * ----------------------------------------------------------------------------
 */

import {
  DataArrayTexture, RGBAFormat, UnsignedByteType, RepeatWrapping, LinearMipmapLinearFilter, LinearFilter,
  SRGBColorSpace, NoColorSpace,
} from 'three';
import { GROUND_LAYERS, GROUND_SIZE, makeGroundLayer } from './groundSurfaces.js';

/* global __GROUND_WORKER__ */
/** The worker's code, set by scripts/build.mjs (null when running the sources unbundled). */
const WORKER_CODE = typeof __GROUND_WORKER__ === 'string' ? __GROUND_WORKER__ : null;

/** Paint the layers: resolves to [{ albedo, normal, orm }] in layer order. `onLayer(i)` reports progress. */
export function paintLayers(size = GROUND_SIZE, onLayer = null) {
  const viaWorker = () => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([WORKER_CODE], { type: 'text/javascript' }));
    let worker;
    try {
      worker = new Worker(url);
    } catch (err) {
      URL.revokeObjectURL(url);
      reject(err);
      return;
    }
    const out = [];
    const end = () => { worker.terminate(); URL.revokeObjectURL(url); };
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.error) { end(); reject(new Error(m.error)); return; }
      if (m.done) { end(); resolve(out); return; }
      out[m.i] = { albedo: m.albedo, normal: m.normal, orm: m.orm };
      if (onLayer) onLayer(m.i);
    };
    worker.onerror = (e) => { end(); reject(new Error(e.message || 'ground worker failed')); };
    worker.postMessage({ size });
  });
  const onPage = async () => {
    const out = [];
    const frame = () => new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));
    for (let i = 0; i < GROUND_LAYERS.length; i++) {
      await frame();
      const m = makeGroundLayer(GROUND_LAYERS[i].name, size);
      out[i] = { albedo: m.albedo, normal: m.normal, orm: m.orm };
      if (onLayer) onLayer(i);
    }
    return out;
  };
  if (WORKER_CODE && typeof Worker === 'function' && typeof Blob === 'function') return viaWorker().catch(() => onPage());
  return onPage();
}

/** One texture array of `layers` (each a Uint8Array of size x size x 4). */
function arrayTexture(layers, size, srgb, anisotropy) {
  const data = new Uint8Array(size * size * 4 * layers.length);
  layers.forEach((l, i) => data.set(l, i * size * size * 4));
  const t = new DataArrayTexture(data, size, size, layers.length);
  t.format = RGBAFormat;
  t.type = UnsignedByteType;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = anisotropy;
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** The three texture arrays from painted layers. */
export function groundArrays(layers, size = GROUND_SIZE, anisotropy = 4) {
  return {
    albedo: arrayTexture(layers.map((l) => l.albedo), size, true, anisotropy),
    normal: arrayTexture(layers.map((l) => l.normal), size, false, anisotropy),
    orm: arrayTexture(layers.map((l) => l.orm), size, false, anisotropy),
    size,
    dispose() {
      this.albedo.dispose();
      this.normal.dispose();
      this.orm.dispose();
    },
  };
}

/** Painted once per page and shared (the lab and the game's back end, a renderer switched off and on). */
let shared = null;

/** The ground's painted layers, painted once: a promise of the layer list. */
export function groundLayers(onLayer = null) {
  if (!shared) shared = paintLayers(GROUND_SIZE, onLayer).catch((err) => { shared = null; throw err; });
  return shared;
}
