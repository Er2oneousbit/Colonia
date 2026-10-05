/**
 * ground/groundTextures.js
 * ----------------------------------------------------------------------------
 * The ground's textures: every layer of groundSurfaces.js in three texture
 * arrays (albedo and height, normal, occlusion/roughness/plants), so the
 * ground shader picks a kind by its layer number in one sampler.
 *
 * The arrays exist from the start, at their final size, every layer
 * holding its stand-in (paint/standIns.js: the layer's average colour,
 * height and roughness on a flat normal), so the ground can be drawn at
 * once. The painted layers come from the cache or the paint pool's workers
 * (paint/pool.js: about 1 s of arithmetic for the 14 layers on one core,
 * spread over all of them) and are copied into the same bytes as each one
 * comes; a texture array already on the GPU then uploads only that layer
 * (liveGroundArrays). Nothing is recompiled, nothing waits.
 *
 * Memory: 14 layers x 256 x 256 x 4 bytes x 3 arrays, 11 MB, packed once
 * and shared by every texture made from them (the lab's and the game's);
 * the GPU's copies with their mipmaps about 15 MB. The bytes are kept:
 * three.js uploads them again after a lost WebGL context.
 * ----------------------------------------------------------------------------
 */

import {
  DataArrayTexture, RGBAFormat, UnsignedByteType, RepeatWrapping, LinearMipmapLinearFilter, LinearFilter,
  SRGBColorSpace, NoColorSpace,
} from 'three';
import { GROUND_LAYERS, GROUND_SIZE } from './groundSurfaces.js';
import { loadAll } from '../paint/pool.js';
import { standIn, fillPixels } from '../paint/standIns.js';

const MAPS = ['albedo', 'normal', 'orm'];

/** Painted layers ([{ albedo, normal, orm }]) packed into one array of bytes per map, the layers one after another. */
export function packLayers(layers, size = GROUND_SIZE) {
  const pack = (k) => {
    const data = new Uint8Array(size * size * 4 * layers.length);
    layers.forEach((l, i) => data.set(l[k], i * size * size * 4));
    return data;
  };
  return { albedo: pack('albedo'), normal: pack('normal'), orm: pack('orm'), size, count: layers.length };
}

/** Packed bytes (as packLayers) holding every layer's stand-in. */
export function packStandIns(size = GROUND_SIZE) {
  const count = GROUND_LAYERS.length;
  const px = size * size;
  const out = { size, count };
  for (const k of MAPS) out[k] = new Uint8Array(px * 4 * count);
  GROUND_LAYERS.forEach((l, i) => {
    const s = standIn('ground', l.name);
    for (const k of MAPS) fillPixels(out[k], s[k], px, i * px);
  });
  return out;
}

/** Copy one painted layer into packed bytes. */
export function setLayer(packed, i, maps) {
  const n = packed.size * packed.size * 4;
  for (const k of MAPS) packed[k].set(maps[k], i * n);
}

/** One texture array on packed bytes (shared, not copied). */
function arrayTexture(data, size, count, srgb, anisotropy) {
  const t = new DataArrayTexture(data, size, size, count);
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

/** The three texture arrays on packed layers (packLayers). */
export function groundArrays(packed, anisotropy = 4) {
  const { size, count } = packed;
  return {
    albedo: arrayTexture(packed.albedo, size, count, true, anisotropy),
    normal: arrayTexture(packed.normal, size, count, false, anisotropy),
    orm: arrayTexture(packed.orm, size, count, false, anisotropy),
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

/**
 * The ground's layers, made once per page: { packed (stand-ins at once,
 * the painted layers copied in as they come), arrived[i], count, done,
 * ms, cached (layers read from the cache), listen(fn(i)) -> unlisten,
 * whenDone (a promise) }.
 */
export function groundTextures() {
  if (shared) return shared;
  const t0 = performance.now();
  const listeners = new Set();
  const src = {
    packed: packStandIns(),
    arrived: new Array(GROUND_LAYERS.length).fill(false),
    count: 0,
    done: false,
    ms: 0,
    cached: 0,
    listen(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const jobs = GROUND_LAYERS.map((l) => ({ kind: 'ground', name: l.name, size: GROUND_SIZE }));
  src.whenDone = loadAll(jobs, (i, maps, cached) => {
    setLayer(src.packed, i, maps);
    src.arrived[i] = true;
    src.count++;
    if (cached) src.cached++;
    for (const fn of listeners) fn(i);
  }).then(() => {
    // (A layer that could not be painted keeps its stand-in: the ground is still drawn.)
    src.done = true;
    src.ms = performance.now() - t0;
    return src;
  });
  shared = src;
  return src;
}

/**
 * Texture arrays on the shared layers that follow them as they are painted
 * (groundArrays, plus `upload(renderer, k)`, `lost()`): a layer that comes
 * after an array went to the GPU is uploaded alone (three's layer updates);
 * one that comes before rides with the array's first, whole upload. Only
 * an array known to be on the GPU may be given layer updates: three's
 * first upload of an array with layer updates pending would send only
 * those layers, and leave the rest of the array blank.
 */
export function liveGroundArrays(src, anisotropy = 4) {
  const tex = groundArrays(src.packed, anisotropy);
  const arrays = [tex.albedo, tex.normal, tex.orm];
  const onGpu = [false, false, false];
  tex.onLayer = null;
  /** Upload array k now (three's initTexture), whole. */
  tex.upload = (renderer, k) => {
    arrays[k].clearLayerUpdates();
    renderer.initTexture(arrays[k]);
    onGpu[k] = true;
  };
  /** The WebGL context was lost: the next upload of each array must be whole. */
  tex.lost = () => {
    for (const a of arrays) a.clearLayerUpdates();
    onGpu.fill(false);
  };
  const off = src.listen((i) => {
    arrays.forEach((a, k) => {
      if (onGpu[k]) a.addLayerUpdate(i);
      a.needsUpdate = true;
    });
    if (tex.onLayer) tex.onLayer(i);
  });
  const free = tex.dispose;
  tex.dispose = function dispose() {
    off();
    free.call(this);
  };
  return tex;
}
