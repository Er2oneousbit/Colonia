/**
 * surfacesNative.js
 * ----------------------------------------------------------------------------
 * The surfaces of the native villages (models/tugurium.js, concilium.js,
 * arvum.js), recipes in the same terms as surfaces.js (paint/recipe.js says
 * how one is written). surfaces.js adds them to SURFACES.
 *
 *   daub      clay daubed by hand over wattle: the earth of the place mixed
 *             with straw and dung, pressed on in handfuls and smoothed with
 *             wet palms (the sweeps show), drying into a net of fine cracks;
 *             straw ends in it, a darker band low down where the rain
 *             splashes. The burnt daub found in Iron Age hut floors keeps
 *             the prints of the wattle and of the fingers that pressed it.
 *   drystone  stones of the hillside laid without mortar, as the Ligurian
 *             castellari's terraces, hut footings and folds still stand:
 *             rough slabs and blocks of grey limestone and brown sandstone,
 *             their faces split, not dressed, deep dark gaps between them
 *             where small stones are wedged, lichen and moss on the old
 *             ones.
 *
 * UVs are in metres (shapes.js), v up a wall.
 * ----------------------------------------------------------------------------
 */

import { fbm, ridge, cells } from './paint/recipe.js';
import { rgb, rgbs } from './paint/glsl.js';

/**
 * Daub: a lumpy clay skin (handfuls, palm sweeps along u), a net of shrinkage
 * cracks (ridged noise, thin), straw ends (fine streaks across), the earth's
 * own tone in clouds; darker and wetter near the foot.
 */
const daub = {
  fields: {
    noise: {
      lump: fbm(6, 3, 31), sweep: fbm(5, 3, 32, { sx: 3.0 }), crack: ridge(9, 3, 33), fine: fbm(60, 2, 34),
      straw: fbm(90, 2, 35, { sx: 0.08, coord: 'diag' }),
    },
    glsl: `
      // Cracks: where the ridged noise peaks, a thin dark line.
      float c = sstep( 0.86, 0.97, crack );
      float h = 0.5 + ( lump - 0.5 ) * 0.5 + ( sweep - 0.5 ) * 0.25 + fine * 0.05 - c * 0.35;
      float s = sstep( 0.7, 0.82, straw );
      return vec4( h + s * 0.04, c, s, lump );`,
  },
  blur: [3],
  colour: {
    noise: { tone: fbm(3, 3, 36), damp: fbm(8, 3, 37, { sx: 0.4 }) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      // The clay: a warm ochre-brown, paler where it dried in the sun, a grey-brown cloud here and there.
      col = mix( ${rgb('#9a7a55')}, ${rgb('#b4946a')}, sstep( 0.3, 0.75, tone ) );
      col = mix( col, ${rgb('#857565')}, sstep( 0.62, 0.8, F.w ) * 0.3 );
      // Straw ends pressed into it.
      col = mix( col, ${rgb('#c9b07a')}, F.z * 0.55 );
      // The cracks and the hollows.
      col = mix( col, ${rgb('#3e2f22')}, max( F.y * 0.7, cav * 0.55 ) );
      // Splash and damp low on the wall (v up it from the ground: the bottom 40 cm of a repeat).
      float low = sstep( 0.4, 0.0, uv.y ) * ( 0.45 + damp * 0.4 );
      col = mix( col, ${rgb('#5c4834')}, low * 0.5 );
      orm = vec3( 1.0 - max( F.y * 0.6, cav * 0.45 ), 0.93, 0.0 );`,
  },
  normal: { depth: 0.01 / 1.2 },
};

/**
 * Dry stone: rough stones of the hillside in courses that wander, each its own
 * split face (no dressing), gaps between them dark and deep (no mortar), small
 * stones wedged in the gaps, lichen and moss.
 */
const drystone = {
  fields: {
    noise: {
      warpU: fbm(3, 3, 41), warpV: fbm(5, 3, 42),
      stone: cells(7, 40, 0.9, { sy: 2.2, warp: { u: ['warpU', 0.07, -0.5], v: ['warpV', 0.05, -0.5] } }),
      chip: cells(26, 43, 0.9), split: fbm(14, 3, 44), grain: fbm(45, 2, 45),
    },
    glsl: `
      // A stone's face bulges, split and pitted; the gap between stones is deep (no mortar fills it),
      // small chips wedged in it here and there.
      float face = 0.62 + ( split - 0.5 ) * 0.35 + grain * 0.06 - dot( stone.d, stone.d ) * 0.5;
      float edge = sstep( 0.015, 0.09, stone.edge );
      float wedge = sstep( 0.05, 0.12, chip.edge ) * sstep( 0.7, 0.8, hash2( int( chip.id ), 3, uSeed ) );
      float h = mix( 0.05 + wedge * 0.35, face, edge );
      return vec4( h, edge, stone.id, wedge );`,
  },
  blur: [3],
  colour: {
    noise: { lichenN: fbm(9, 3, 46), mossN: fbm(6, 3, 47), dirt: fbm(4, 3, 48) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      vec3 stones[6] = ${rgbs(['#8e8a80', '#a29c8e', '#7c766c', '#9a8a70', '#b2aa98', '#857a68'])};
      vec3 s = stones[int( hash2( int( F.z ), 2, uSeed ) * 6.0 )];
      s *= 0.84 + hash2( int( F.z ), 5, uSeed ) * 0.26;
      // The gaps: shadow and earth.
      col = mix( ${rgb('#2a2620')}, s, F.y );
      col = mix( col, s * 0.92, F.w );
      // Lichen in pale grey-green crusts and orange spots on the old faces; moss low and in the gaps.
      col = mix( col, ${rgb('#b9bba0')}, sstep( 0.66, 0.78, lichenN ) * F.y * 0.55 );
      col = mix( col, ${rgb('#c08a3a')}, sstep( 0.86, 0.9, lichenN ) * F.y * 0.35 );
      col = mix( col, ${rgb('#4f5a2c')}, sstep( 0.6, 0.85, mossN ) * ( 1.0 - F.y * 0.6 ) * 0.5 );
      col = mix( col, ${rgb('#5a4c3a')}, sstep( 0.55, 0.85, dirt ) * 0.18 );
      col = mix( col, ${rgb('#1e1a16')}, cav * 0.6 );
      orm = vec3( 1.0 - max( ( 1.0 - F.y ) * 0.7, cav * 0.5 ), 0.92, 0.0 );`,
  },
  normal: { depth: 0.03 / 1.6 },
};

/** The villages' surfaces, in surfaces.js's form (metres a repeat, texture size, recipe). */
export const NATIVE_SURFACES = Object.freeze({
  daub: { metres: 1.2, size: 512, ...daub },
  drystone: { metres: 1.6, size: 512, ...drystone },
});
