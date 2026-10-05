/**
 * ground/groundTextures.js
 * ----------------------------------------------------------------------------
 * The ground's textures: every layer of groundSurfaces.js in three texture
 * arrays (albedo and height, normal, occlusion/roughness/plants), so the
 * ground shader picks a kind by its layer number in one sampler.
 *
 * The arrays are render targets the GPU paints (paint/painter.js), a layer
 * a recipe, all 14 in one go as soon as the painter's programs are
 * compiled: a few milliseconds of GPU time on a desktop, so the ground
 * waits for them (its sprites draw meanwhile) instead of drawing stand-ins.
 * Their mipmaps are made once the last layer is in, and the painter paints
 * them again after a lost WebGL context.
 *
 * Memory: 14 layers x 256 x 256 x 4 bytes x 3 arrays, about 15 MB on the
 * GPU with their mipmaps, and nothing in the page.
 * ----------------------------------------------------------------------------
 */

import { DataArrayTexture, RGBAFormat, UnsignedByteType, LinearFilter, SRGBColorSpace } from 'three';
import { GROUND_LAYERS, GROUND_SIZE, GROUND_SET } from './groundSurfaces.js';
import { nameSeed } from '../surfaces.js';
import { arrayTargets, painterFor } from '../paint/painter.js';

/** The arrays of each renderer (its GPU paints them), made at the first ask. */
const BY_RENDERER = new WeakMap();

/**
 * The ground's arrays for `renderer`: { albedo, normal, orm (textures),
 * size, count, ready, ms (from the ask until painted), whenReady,
 * dispose() }. Returned at once; painted in the background.
 */
export function groundTextures(renderer, anisotropy = 4) {
  let g = BY_RENDERER.get(renderer);
  if (g) return g;
  const t0 = performance.now();
  const count = GROUND_LAYERS.length;
  const out = arrayTargets(GROUND_SIZE, count, anisotropy);
  g = {
    albedo: out.albedo.texture,
    normal: out.normal.texture,
    orm: out.orm.texture,
    out,
    size: GROUND_SIZE,
    count,
    ready: false,
    ms: 0,
    dispose() {
      // (Not painted again after a lost context, nor painted at all if still waiting.)
      painter.forget(out);
      for (const rt of Object.values(out)) rt.dispose();
      if (BY_RENDERER.get(renderer) === g) BY_RENDERER.delete(renderer);
    },
  };
  const painter = painterFor(renderer);
  g.whenReady = Promise.all(GROUND_LAYERS.map((l, i) => painter.paint({
    set: GROUND_SET, index: i, seed: nameSeed(l.name), size: GROUND_SIZE, out, layer: i, ground: true,
  }))).then(() => {
    g.ready = !painter.lost && !painter.painting(out);
    g.ms = performance.now() - t0;
    return g;
  });
  // A lost context blanks the arrays: not ready again until the painter has painted them anew.
  const unlisten = painter.listen((what) => {
    if (what === 'lost') g.ready = false;
    else if (what === 'painted' && !g.ready && !painter.painting(out) && g.painted) g.ready = true;
  });
  g.whenReady.then(() => { g.painted = true; });
  const free = g.dispose;
  g.dispose = () => {
    unlisten();
    free();
  };
  BY_RENDERER.set(renderer, g);
  return g;
}

/**
 * Blank arrays of the same kind (the ground's program does not depend on
 * the pixels): the tests' ground, and anything that must make a ground
 * before a renderer is at hand.
 */
export function blankGroundArrays(size = 4, count = GROUND_LAYERS.length) {
  const make = (srgb) => {
    const t = new DataArrayTexture(new Uint8Array(size * size * 4 * count), size, size, count);
    t.format = RGBAFormat;
    t.type = UnsignedByteType;
    t.minFilter = LinearFilter;
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  const tex = { albedo: make(true), normal: make(false), orm: make(false), size, count, ready: true };
  tex.dispose = () => {
    tex.albedo.dispose();
    tex.normal.dispose();
    tex.orm.dispose();
  };
  return tex;
}
