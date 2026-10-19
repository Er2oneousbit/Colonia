/**
 * figures/figureMaterial.js
 * ----------------------------------------------------------------------------
 * What the walkers' and the units' materials share (walkers/material.js,
 * units/material.js): the float texture a frame's figures are written into,
 * the wool-textured people's material with the figures' vertex shader patched
 * in, and the shadow casters placed the same way. What differs stays in each
 * file: the shader text (the units add skinned beasts, a rider's pitch and a
 * flag's ripple), the texture's size constants and the uniform that points at
 * it. The variant is passed as a function so the units can bake their beast
 * table on first use, as before.
 * ----------------------------------------------------------------------------
 */

import { MeshStandardMaterial, MeshDepthMaterial, MeshDistanceMaterial, DataTexture, RGBAFormat, FloatType, NearestFilter, Vector2 } from 'three';
import { patchLook, surfaceTextures, cachedMaterial } from '../materials.js';
import { patchPeopleShader } from '../people/material.js';

/**
 * A new figures' texture of `rows` rows (`perRow` figures of `texels` texels
 * each), the uniform `holder` pointed at it (the pass swaps in a taller one as
 * more figures are wanted).
 */
export function makeFigureTexture(holder, name, rows, perRow, texels) {
  const data = new Float32Array(perRow * texels * 4 * rows);
  const t = new DataTexture(data, perRow * texels, rows, RGBAFormat, FloatType);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  t.name = name;
  holder.value = t;
  return t;
}

/** The figures' material `name` (the people's, placed by the figures' texture); `variant()` the shader patch. */
export function figureMaterial(name, variant) {
  return cachedMaterial(name, () => {
    const wool = surfaceTextures('wool');
    const m = new MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 1, vertexColors: false,
      map: wool.map, normalMap: wool.normalMap, normalScale: new Vector2(0.8, 0.8), roughnessMap: wool.orm, metalnessMap: wool.orm,
    });
    m.name = name;
    patchLook(m, { snow: 1, wet: 1 });
    const look = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      look(shader, renderer);
      patchPeopleShader(shader, false, variant());
    };
    m.customProgramCacheKey = () => `${name}1`;
    return m;
  });
}

/**
 * The figures' shadow casters (the sun's depth, a lamp's distance), placed
 * alike; `extra(shader)` adds what a variant's depth shader needs besides.
 */
export function figureDepthMaterial(name, kind, variant, extra = null) {
  return cachedMaterial(`${name}-${kind}`, () => {
    const m = kind === 'depth' ? new MeshDepthMaterial() : new MeshDistanceMaterial();
    m.onBeforeCompile = (shader) => {
      patchPeopleShader(shader, true, variant());
      if (extra) extra(shader);
    };
    m.customProgramCacheKey = () => `${name}-${kind}1`;
    return m;
  });
}
