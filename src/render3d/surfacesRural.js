/**
 * surfacesRural.js
 * ----------------------------------------------------------------------------
 * The countryside's surfaces for the 3D look (the farms and the granary,
 * models/farm*.js and models/granary.js), recipes in the same terms as
 * surfaces.js (paint/recipe.js says how one is written), kept apart so the
 * town's surfaces read as one list. surfaces.js adds them to SURFACES.
 *
 *   thatch   straw laid in courses down a roof or a stack
 *   rubble   a farm wall of rough stones in lime mortar (opus incertum),
 *            the lime wash over it worn off in patches
 *   bark     an old fruit tree's or an olive's bark: furrows and plates
 *   wicker   willow rods woven over stakes: baskets, a wattle fence
 *
 * UVs are in metres (shapes.js), so `metres` is how much of the world one
 * repeat covers, and v runs up a wall or down a roof's slope.
 * ----------------------------------------------------------------------------
 */

import { fbm, ridge, cells } from './paint/recipe.js';
import { rgb, rgbs } from './paint/glsl.js';

/**
 * Thatch: long straws laid down the slope (v), tied in courses that show as
 * steps every 30 cm or so, the cut ends darker; weathered grey on top of the
 * gold, darker and greener (moss) in patches.
 */
const thatch = {
  fields: {
    noise: {
      straw: fbm(70, 3, 0, { sx: 0.06 }), clump: fbm(9, 3, 1, { sx: 0.3 }), wobble: fbm(4, 2, 2),
    },
    glsl: `
      // Courses: each a step whose lower edge is the straws' cut ends.
      float c = fract( uv.y * 3.3 + ( wobble - 0.5 ) * 0.25 );
      float course = sstep( 0.0, 0.85, c );
      return vec4( straw * 0.45 + clump * 0.25 + course * 0.35, course, straw, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { greyN: fbm(5, 4, 4), mossN: fbm(7, 3, 5), fib: fbm(140, 2, 6, { sx: 0.05 }) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      col = mix( ${rgb('#b69a5c')}, ${rgb('#8e7b55')}, sstep( 0.35, 0.75, greyN ) );
      col *= 0.82 + F.z * 0.3 + fib * 0.08;
      // The cut ends at each course's foot are darker.
      col = mix( col, ${rgb('#5e4c33')}, sstep( 0.25, 0.0, F.y ) * 0.55 );
      col = mix( col, ${rgb('#5d6440')}, sstep( 0.68, 0.82, mossN ) * 0.45 );
      col = mix( col, ${rgb('#3c3226')}, cav * 0.6 );
      orm = vec3( 1.0 - cav * 0.5, 0.92, 0.0 );`,
  },
  normal: { depth: 0.012 / 1.0 },
};

/**
 * Rubble masonry (opus incertum) as farm walls were built: rough stones of
 * the fields, a grey limestone, a yellow tufa, a few brown, set in lime
 * mortar with wide joints; over it a lime wash that has flaked away in
 * patches, thicker low on the wall where it was renewed.
 */
const rubble = {
  fields: {
    noise: {
      warpU: fbm(4, 3, 7), warpV: fbm(4, 3, 8),
      stone: cells(11, 0, 1.0, { sy: 1, warp: { u: ['warpU', 0.05, -0.5], v: ['warpV', 0.05, -0.5] } }),
      bump: fbm(30, 3, 1), washN: fbm(7, 5, 2), chip: fbm(50, 2, 3),
    },
    glsl: `
      int id = int( stone.id );
      float face = 0.55 + ( hash2( id, 1, uSeed ) - 0.5 ) * 0.2 + ( bump - 0.5 ) * 0.25 - dot( stone.d, stone.d ) * 0.35;
      float joint = sstep( 0.025, 0.1, stone.edge );
      float h = mix( 0.12 + chip * 0.08, face, joint );
      // The lime wash: a thin flat skin over stone and joint alike, where it holds.
      float wash = sstep( 0.36, 0.42, washN + ( 0.5 - uv.y ) * 0.08 );
      return vec4( mix( h, 0.62 + bump * 0.04, wash * 0.6 ), joint, stone.id, wash );`,
  },
  blur: [3],
  colour: {
    noise: { tone: fbm(3, 3, 9), dirt: fbm(10, 3, 10, { sx: 0.2 }) },
    glsl: `
      float cav = cavity( F.x, B.x, 4.0 );
      vec3 stones[5] = ${rgbs(['#9a8c74', '#b09c78', '#a68c62', '#8a7a64', '#bcac8c'])};
      vec3 s = stones[int( hash2( int( F.z ), 2, uSeed ) * 5.0 )];
      s *= 0.88 + hash2( int( F.z ), 3, uSeed ) * 0.2;
      vec3 mortar = mix( ${rgb('#b2a790')}, ${rgb('#958a74')}, tone );
      col = mix( mortar, s, F.y );
      // The wash: chalky cream, greyed by rain.
      vec3 wash = mix( ${rgb('#e2d6bc')}, ${rgb('#c8b898')}, sstep( 0.4, 0.75, tone ) );
      // A thin wash over all of it, the stone's grain showing through, thicker where it was renewed.
      col = mix( col, wash, 0.35 + F.w * 0.45 );
      // Streaks down the wall and dirt splashed up from the yard.
      col = mix( col, ${rgb('#6f6554')}, sstep( 0.6, 0.85, dirt ) * 0.25 );
      col = mix( col, ${rgb('#4c4234')}, cav * 0.55 );
      orm = vec3( 1.0 - cav * 0.6, 0.9, 0.0 );`,
  },
  normal: { depth: 0.02 / 2.0 },
};

/** Bark: deep furrows up the trunk (v along it) between scaly plates, grey-brown, lichen in places. */
const bark = {
  fields: {
    noise: {
      furrow: ridge(7, 3, 0, { sx: 0.25, coord: 'vu' }), plate: cells(14, 1, 0.9, { sy: 2.5 }), fine: fbm(40, 2, 2),
    },
    glsl: `
      float f = pow( furrow, 3.0 );
      float p = sstep( 0.02, 0.12, plate.edge );
      return vec4( 0.25 + p * 0.35 - f * 0.4 + fine * 0.15, f, plate.id, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(4, 3, 4), lichen: fbm(9, 3, 5) },
    glsl: `
      float cav = cavity( F.x, B.x, 6.0 );
      col = mix( ${rgb('#6b5f50')}, ${rgb('#857a6a')}, sstep( 0.3, 0.7, tone ) );
      col *= 0.9 + hash2( int( F.z ), 4, uSeed ) * 0.18;
      col = mix( col, ${rgb('#9aa07e')}, sstep( 0.72, 0.85, lichen ) * 0.5 );
      col = mix( col, ${rgb('#2c241d')}, max( F.y * 0.7, cav * 0.6 ) );
      orm = vec3( 1.0 - max( F.y * 0.6, cav * 0.5 ), 0.95, 0.0 );`,
  },
  normal: { depth: 0.012 / 0.8 },
};

/**
 * Wicker: willow rods (weavers) running along u, over and under upright
 * stakes every 5 cm, each rod a rounded band; the rods vary in tone, and
 * age greys them.
 */
const wicker = {
  fields: {
    noise: { jit: fbm(16, 2, 0) },
    glsl: `
      const float RODS = 40.0;  // weavers up a repeat (1 cm each at 0.4 m)
      const float STAKES = 8.0; // stakes along a repeat
      float r = uv.y * RODS;
      float row = floor( r );
      float across = fract( r );
      float s = uv.x * STAKES + mod( row, 2.0 ) * 0.5;
      // The weaver bulges out between stakes and dips behind each one.
      float over = 0.5 + 0.5 * cos( fract( s ) * 6.283185307179586 );
      float round_ = sin( across * 3.141592653589793 );
      return vec4( round_ * ( 0.55 + over * 0.45 ) + jit * 0.05, round_, row, over );`,
  },
  blur: [1],
  colour: {
    noise: { greyN: fbm(5, 3, 3) },
    glsl: `
      float cav = cavity( F.x, B.x, 4.0 );
      float tone = hash2( int( F.z ), 7, uSeed );
      col = mix( ${rgb('#c09a62')}, ${rgb('#9c7a50')}, tone );
      col = mix( col, ${rgb('#8b836f')}, sstep( 0.45, 0.8, greyN ) * 0.5 );
      col *= 0.82 + F.y * 0.25;
      col = mix( col, ${rgb('#3a2e22')}, cav * 0.5 );
      orm = vec3( 1.0 - cav * 0.6, 0.85, 0.0 );`,
  },
  normal: { depth: 0.006 / 0.4 },
};

/** The rural surfaces, in surfaces.js's form (metres a repeat, texture size, recipe). */
export const RURAL_SURFACES = Object.freeze({
  thatch: { metres: 1.0, size: 512, ...thatch },
  rubble: { metres: 2.0, size: 512, ...rubble },
  bark: { metres: 0.8, size: 256, ...bark },
  wicker: { metres: 0.4, size: 256, ...wicker },
});
