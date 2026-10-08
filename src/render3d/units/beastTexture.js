/**
 * units/beastTexture.js
 * ----------------------------------------------------------------------------
 * The beasts' baked clips (quadRig.js bakeBeasts) as a float texture and its
 * table of clips, made once and shared: the units' material skins the
 * battlefield's beasts from it (units/material.js), the people's material
 * the beasts of the buildings (people/material.js: the menagerie's lion,
 * the stable's horses). One copy on the GPU; its own module so neither
 * material imports the other.
 * ----------------------------------------------------------------------------
 */

import { DataTexture, RGBAFormat, FloatType, NearestFilter, Vector4 } from 'three';
import { bakeBeasts, QBONE_COUNT } from './quadRig.js';

let SHARED = null;

/** { uBeastBones, uBeastClips }: the texture (QBONE_COUNT x 3 texels a row, a row a frame) and the clips' table. */
export function beastBones() {
  if (SHARED) return SHARED;
  const b = bakeBeasts();
  const t = new DataTexture(b.data, QBONE_COUNT * 3, b.rows, RGBAFormat, FloatType);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  t.name = 'beast-bones';
  SHARED = {
    uBeastBones: { value: t },
    uBeastClips: { value: b.table.map((c) => new Vector4(c.start, c.frames, c.fps, c.stride)) },
  };
  return SHARED;
}
