/**
 * surfacesGarden.js
 * ----------------------------------------------------------------------------
 * The gardens' surfaces for the 3D look (models/hortus.js), recipes in the
 * same terms as surfaces.js (paint/recipe.js says how one is written), kept
 * apart so the town's surfaces read as one list. surfaces.js adds them to
 * SURFACES.
 *
 *   boxleaf   clipped box (Buxus sempervirens), the hedge of the Roman
 *             garden (Pliny's letters: box cut into borders and figures):
 *             a dense skin of small oval leaves, two layers deep, the
 *             gaps between them dark, new growth paler in patches
 *
 * The tone of a hedge (its season, a neglected hedge's brown) is in its
 * vertex colours; the texture is the leaves' own green and their relief.
 * ----------------------------------------------------------------------------
 */

import { fbm, cells } from './paint/recipe.js';
import { rgb } from './paint/glsl.js';

const boxleaf = {
  fields: {
    noise: {
      warp: fbm(5, 2, 4),
      leafA: cells(30, 0, 0.95, { sy: 1.5, warp: { u: ['warp', 0.04, -0.5] } }),
      leafB: cells(30, 7, 0.95, { sy: 1.5, warp: { v: ['warp', 0.04, -0.5] } }),
      clump: fbm(5, 3, 2), fine: fbm(80, 2, 3),
    },
    glsl: `
      // Two layers of small leaves, the upper over the lower where it covers; each a low dome.
      float a = sstep( 0.48, 0.12, leafA.f1 );
      float b = sstep( 0.48, 0.12, leafB.f1 ) * 0.85;
      float cover = max( a, b );
      float id = a >= b ? leafA.id : leafB.id + 977.0;
      float h = cover * 0.55 + clump * 0.4 + fine * 0.05;
      return vec4( h, cover, id, clump );`,
  },
  blur: [3],
  colour: {
    noise: { tone: fbm(4, 3, 9) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      vec3 c = mix( ${rgb('#2c4720')}, ${rgb('#4a6a2a')}, hash2( int( F.z ), 1, uSeed ) );
      // New growth: paler, yellower, in patches over the clipped face.
      c = mix( c, ${rgb('#7a9a3c')}, sstep( 0.62, 0.9, F.w ) * 0.45 );
      c = mix( c, ${rgb('#3a5226')}, sstep( 0.3, 0.7, tone ) * 0.3 );
      // The gaps between the leaves go dark: the hedge's depth.
      col = mix( c * ( 0.75 + 0.25 * F.y ), ${rgb('#101a0c')}, max( cav * 0.6, ( 1.0 - F.y ) * 0.65 ) );
      orm = vec3( 1.0 - max( cav * 0.6, ( 1.0 - F.y ) * 0.45 ), 0.5 + ( 1.0 - F.y ) * 0.4, 0.0 );`,
  },
  normal: { depth: 0.012 / 0.5 },
};

/** The garden surfaces, in surfaces.js's form (metres a repeat, texture size, recipe). */
export const GARDEN_SURFACES = Object.freeze({
  boxleaf: { metres: 0.5, size: 512, ...boxleaf },
});
