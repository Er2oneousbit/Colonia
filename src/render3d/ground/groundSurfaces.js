/**
 * ground/groundSurfaces.js
 * ----------------------------------------------------------------------------
 * The procedural surfaces of the 3D ground: one layer each of the ground
 * shader's texture arrays (groundMaterial.js), painted on the GPU
 * (paint/painter.js; how a recipe is written: paint/recipe.js) as
 * surfaces.js paints the well's stone, but for ground seen from a city
 * builder's height: a tile is 4 m, the closest zoom shows about 45 px a
 * metre, so 256 px textures over 2 to 5 m are sharp enough and cheap.
 *
 * The kinds follow the Mediterranean countryside of the Roman provinces:
 * short grazed pasture, lush meadow with flowers (the fertile land farms
 * need), dry garrigue scrub of cushion shrubs on stony soil, an oak and pine
 * wood's litter and moss, bare limestone, dune sand, a beach's finer sand
 * and shells, a farm's ploughed furrows, the silt and pebbles of a riverbed;
 * and what people laid on it: a gravelled road (via glareata), polygonal
 * basalt paving for a town's streets (as Pompeii's), a forum's travertine
 * flagstones in courses, and the rubble of a fallen building.
 *
 * Every layer has the same size (a texture array's layers must) and packs:
 *   albedo  sRGB colour, ALPHA = height (0..1, normalised over the layer by
 *           the painter), which the shader blends kinds by: where two kinds
 *           meet, the higher one's bumps win, so grass grows over the edge
 *           of a road in tufts, not along a line
 *   normal  tangent-space normal map
 *   orm     R occlusion, G roughness, B how much of the pixel is living
 *           plants (the season's colour tints only those: the soil between
 *           the blades stays brown in every month)
 * ----------------------------------------------------------------------------
 */

import { fbm, ridge, cells } from '../paint/recipe.js';
import { rgb, rgbs, glf } from '../paint/glsl.js';

/** Texture size of every layer (px). */
export const GROUND_SIZE = 256;

/**
 * Grazed pasture: short blades in tufts, the blades streaking every way
 * (three directions of stretched noise), dark gaps between them, the odd
 * patch of bare earth and of clover. Painted green: the season tints it.
 */
const grass = {
  fields: {
    noise: {
      bareN: fbm(8, 4, 1), tuft: fbm(14, 3, 3),
      // Short strokes three ways: along u, along v and along the diagonal.
      bladeA: fbm(110, 2, 4, { sx: 4 }), bladeB: fbm(110, 2, 5, { sx: 4, coord: 'vu' }), bladeC: fbm(80, 2, 6, { sx: 4, coord: 'diag' }),
    },
    glsl: `
      // Bare earth only where the turf has worn through: small, round, rare.
      float bare = sstep( 0.76, 0.88, bareN ) * 0.8;
      return vec4( tuft * 0.45 + max( bladeA, max( bladeB, bladeC ) ) * 0.55 - bare * 0.35, bare, 0.0, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { shade: fbm(9, 3, 5), strawN: fbm(12, 3, 6), clover: fbm(9, 3, 7), daisyC: cells(26, 8, 0.95), daisyN: fbm(5, 2, 9), hue: fbm(4, 3, 10) },
    glsl: `
      float cav = cavity( F.x, B.x, 6.0 );
      float t = clamp( ( F.x - 0.25 ) * 1.5, 0.0, 1.0 );
      col = mix( ${rgb('#3c561c')}, ${rgb('#5d7b2a')}, sstep( 0.1, 0.55, t ) );
      col = mix( col, ${rgb('#84a044')}, sstep( 0.5, 0.95, t ) * 0.6 );
      // Swards of other grasses: bluer fescue, yellower bents, a shade apart tuft by tuft.
      col = mix( col, col * vec3( 0.86, 1.0, 1.08 ), sstep( 0.55, 0.3, hue ) * 0.6 );
      col = mix( col, col * vec3( 1.12, 1.05, 0.8 ), sstep( 0.55, 0.8, hue ) * 0.6 );
      col *= 0.9 + shade * 0.2;
      col = mix( col, ${rgb('#9a9450')}, sstep( 0.64, 0.8, strawN ) * 0.25 );
      col = mix( col, ${rgb('#4d7a2c')}, sstep( 0.72, 0.8, clover ) * 0.35 );
      float b = F.y * ( 1.0 - t * 0.5 );
      col = mix( col, ${rgb('#6f5c40')}, clamp( b * 1.2, 0.0, 0.85 ) );
      col = mix( col, ${rgb('#28311a')}, cav * 0.5 );
      orm = vec3( 1.0 - cav * 0.55, 0.86 + b * 0.08, 1.0 - clamp( b * 1.2, 0.0, 0.85 ) );
      // Daisies and clover heads, a few here and there, many in patches (the shader shows them in their season).
      if ( hash2( int( daisyC.id ), 1, uSeed ) < 0.02 + sstep( 0.6, 0.78, daisyN ) * 0.45 ) {
        float head = sstep( 0.24, 0.12, daisyC.f1 ) * ( 1.0 - b );
        col = mix( col, hash2( int( daisyC.id ), 2, uSeed ) < 0.65 ? ${rgb('#f1eee2')} : ${rgb('#e9d24a')}, head );
        dec = head;
      }`,
  },
  normal: { depth: 0.025 / 2.5 },
};

/**
 * Meadow, the fertile land: taller, softer grass laid over by the wind in
 * swathes, richer and yellower than the pasture, with clumps of clover and
 * flowers (yellow, white, a few purple) in drifts.
 */
const meadow = {
  fields: {
    // Swathes laid one way or another: which way the stems lean, in big soft patches.
    noise: { lay: fbm(3, 2, 8), along: fbm(70, 2, 0, { sx: 3 }), across: fbm(70, 2, 2, { sx: 3, coord: 'vu' }), body: fbm(10, 3, 1) },
    glsl: `
      float stems = mix( along, across, sstep( 0.4, 0.6, lay ) );
      return vec4( stems * 0.5 + body * 0.5, lay, 0.0, 0.0 );`,
  },
  blur: [3],
  colour: {
    noise: { clover: fbm(7, 3, 3), flower: cells(40, 4, 0.95), driftN: fbm(5, 2, 5) },
    glsl: `
      float cav = cavity( F.x, B.x, 4.0 );
      float t = F.x;
      float lay = F.y;
      col = mix( ${rgb('#4c6a20')}, ${rgb('#71892e')}, sstep( 0.3, 0.55, t ) );
      col = mix( col, ${rgb('#9aa443')}, sstep( 0.55, 0.8, t ) * 0.7 );
      // Sheen where the laid stems catch the light.
      col = mix( col, ${rgb('#b3b25c')}, sstep( 0.55, 0.62, lay ) * sstep( 0.62, 0.38, lay ) * 0.25 );
      col = mix( col, ${rgb('#557a2c')}, sstep( 0.65, 0.78, clover ) * 0.45 );
      col = mix( col, ${rgb('#2c3615')}, cav * 0.45 );
      // Flowers: round heads on some cells, many more in the drifts.
      int id = int( flower.id );
      if ( hash2( id, 1, uSeed ) < 0.05 + sstep( 0.5, 0.72, driftN ) * 0.45 ) {
        vec3 heads[6] = ${rgbs(['#f0d23e', '#f2eee0', '#e6bd30', '#a982bd', '#f4f1e4', '#e9a43a'])};
        float head = sstep( 0.3, 0.16, flower.f1 );
        if ( head > 0.0 ) col = mix( col, heads[int( hash2( id, 2, uSeed ) * 6.0 )], head * 0.95 );
        dec = head;
      }
      orm = vec3( 1.0 - cav * 0.45, 0.8, 0.95 );`,
  },
  normal: { depth: 0.035 / 2.5 },
};

/**
 * Garrigue: pale stony soil, dry tussocks of straw-coloured grass and
 * round dark cushions of thyme, rosemary and kermes oak, each with a
 * shadowed rim.
 */
const scrub = {
  fields: {
    noise: {
      bushC: cells(5, 1, 1.0), group: fbm(2, 3, 11), rim: fbm(24, 3, 2), stoneC: cells(30, 3, 0.9),
      tussN: fbm(14, 3, 4), blades: fbm(80, 2, 5, { sx: 3 }), base: fbm(6, 3, 0),
    },
    glsl: `
      // Cushions grow in loose groups: where the group noise is high, more and bigger.
      int id = int( bushC.id );
      float r = ( 0.18 + hash2( id, 1, uSeed ) * 0.3 ) * ( 0.7 + group * 0.6 );
      float bush = hash2( id, 2, uSeed ) < sstep( 0.3, 0.75, group ) * 0.85 ? sstep( r, r * 0.35, bushC.f1 * ( 0.75 + rim * 0.5 ) ) : 0.0;
      float stone = hash2( int( stoneC.id ), 1, uSeed ) < 0.14 ? sstep( 0.42, 0.22, stoneC.f1 ) : 0.0;
      float tuss = sstep( 0.3, 0.6, tussN ) * 0.35 * ( blades * 0.6 + 0.4 );
      return vec4( base * 0.15 + sqrt( bush ) * 0.75 + stone * 0.3 + tuss, bush, stone, 0.0 );`,
  },
  blur: [3],
  colour: {
    noise: { soilN: fbm(5, 3, 6), tussN: fbm(14, 3, 4), blades: fbm(80, 2, 5, { sx: 3 }), bushC: cells(5, 1, 1.0), leafN: fbm(60, 2, 7), bloomC: cells(70, 9, 0.95) },
    glsl: `
      float cav = cavity( F.x, B.x, 4.0 );
      float b = F.y;
      col = mix( ${rgb('#94805e')}, ${rgb('#7f6c50')}, sstep( 0.4, 0.7, soilN ) );
      // Dry grass over most of it, in tussocks (straw on top, still green at the base).
      float tuss = sstep( 0.3, 0.55, tussN );
      col = mix( col, mix( ${rgb('#7c8448')}, ${rgb('#9c9558')}, sstep( 0.35, 0.7, blades ) ), tuss * 0.9 );
      if ( F.z > 0.0 ) col = mix( col, ${rgb('#a59c88')}, F.z * 0.8 );
      if ( b > 0.0 ) {
        vec3 leaf[4] = ${rgbs(['#4a5530', '#56603a', '#5d5a35', '#3f4b2c'])};
        vec3 lc = mix( leaf[int( hash2( int( bushC.id ), 3, uSeed ) * 4.0 )], ${rgb('#76784a')}, leafN * 0.35 );
        // The cushion's lit crown and its shaded skirt.
        lc *= 0.75 + 0.35 * b;
        col = mix( col, lc, sstep( 0.0, 0.25, b ) );
        // Thyme, rosemary and cistus in flower on some cushions (the shader shows them in spring).
        float kindB = hash2( int( bushC.id ), 5, uSeed );
        if ( kindB < 0.45 && hash2( int( bloomC.id ), 1, uSeed ) < 0.5 ) {
          float fl = sstep( 0.3, 0.15, bloomC.f1 ) * sstep( 0.1, 0.4, b );
          col = mix( col, kindB < 0.15 ? ${rgb('#b48cc8')} : kindB < 0.3 ? ${rgb('#e8b4c4')} : ${rgb('#efe9dc')}, fl );
          dec = fl;
        }
      }
      col = mix( col, ${rgb('#4a3c2a')}, cav * 0.55 );
      orm = vec3( 1.0 - cav * 0.6, 0.9 - b * 0.1, max( sstep( 0.0, 0.25, b ), tuss * 0.6 ) );`,
  },
  normal: { depth: 0.08 / 3 },
};

/** A wood's floor: leaf litter of oak and the needles of pine, twigs, cushions of moss, a fern or two. */
const forest = {
  fields: {
    noise: {
      leafC: cells(48, 1, 1.0), leafD: cells(72, 11, 1.0), needleA: fbm(120, 2, 6, { sx: 7 }), needleB: fbm(120, 2, 7, { sx: 7, coord: 'diag' }),
      needleM: fbm(4, 2, 9), twigN: ridge(8, 3, 2, { sx: 0.4 }), twigMask: fbm(5, 2, 3), mossN: fbm(4, 4, 4), mossFine: fbm(40, 2, 8), base: fbm(10, 3, 0),
    },
    glsl: `
      // A leaf a cell: an ellipse lying its own way, curled up a little in its middle; a second,
      // smaller layer under it.
      float a = hash2( int( leafC.id ), 3, uSeed ) * 3.14159;
      vec2 r = vec2( cos( a ), sin( a ) );
      vec2 l = vec2( dot( leafC.d, r ), dot( leafC.d, vec2( -r.y, r.x ) ) ) / vec2( 0.46, 0.28 );
      float leaf = hash2( int( leafC.id ), 4, uSeed ) < 0.85 ? sstep( 1.0, 0.75, length( l ) ) * ( 0.8 + 0.2 * ( 1.0 - length( l ) ) ) : 0.0;
      float b2 = hash2( int( leafD.id ), 3, uSeed ) * 3.14159;
      vec2 r2 = vec2( cos( b2 ), sin( b2 ) );
      vec2 l2 = vec2( dot( leafD.d, r2 ), dot( leafD.d, vec2( -r2.y, r2.x ) ) ) / vec2( 0.44, 0.26 );
      float leaf2 = sstep( 1.0, 0.75, length( l2 ) ) * ( 1.0 - leaf );
      float needles = sstep( 0.64, 0.76, max( needleA, needleB ) ) * sstep( 0.4, 0.65, needleM ) * ( 1.0 - leaf );
      float twig = pow( twigN, 22.0 ) * sstep( 0.5, 0.65, twigMask );
      float moss = sstep( 0.5, 0.64, mossN ) * ( 0.75 + mossFine * 0.5 );
      return vec4( leaf * 0.35 + leaf2 * 0.22 + needles * 0.12 + base * 0.3 + twig * 0.35 + moss * 0.18, leaf + leaf2 * 0.6, moss, max( twig, needles * 0.5 ) );`,
  },
  blur: [2],
  colour: {
    noise: { leafC: cells(48, 1, 1.0), leafD: cells(72, 11, 1.0), mossTone: fbm(30, 2, 5), soilN: fbm(6, 3, 12), dryN: fbm(3, 3, 13) },
    glsl: `
      float cav = cavity( F.x, B.x, 6.0 );
      // Old litter is olive-brown and grey-brown; the last leaves down, tan and ochre.
      vec3 litter[6] = ${rgbs(['#6a5a3c', '#77623f', '#5c4f36', '#836a42', '#6d6145', '#8a7650'])};
      bool top = F.y > 0.7;
      int id = top ? int( leafC.id ) : int( leafD.id );
      col = mix( ${rgb('#57472f')}, ${rgb('#685539')}, soilN );
      vec3 lc = litter[int( hash2( id, 1, uSeed ) * 6.0 )] * ( 0.88 + hash2( id, 2, uSeed ) * 0.25 );
      col = mix( col, top ? lc : lc * 0.88, clamp( F.y, 0.0, 1.0 ) );
      // Drier, paler litter in patches where the canopy opens; darker and damp where it does not.
      col *= mix( 0.86, 1.14, sstep( 0.3, 0.7, dryN ) );
      col = mix( col, ${rgb('#866744')}, F.w * 0.55 );
      col = mix( col, mix( ${rgb('#4e5d2a')}, ${rgb('#66753a')}, mossTone ), clamp( F.z, 0.0, 1.0 ) * 0.85 );
      col = mix( col, ${rgb('#231b13')}, cav * 0.55 );
      orm = vec3( 1.0 - cav * 0.6, 0.86 - F.z * 0.05, clamp( F.z, 0.0, 1.0 ) );
      // The last leaves to fall lie on top (the shader turns them russet in autumn).
      dec = top && hash2( id, 7, uSeed ) < 0.45 ? clamp( F.y, 0.0, 1.0 ) * ( 1.0 - clamp( F.z, 0.0, 1.0 ) ) : 0.0;`,
  },
  normal: { depth: 0.03 / 3 },
};

/** The rock layer's boulders, warped (fields and colour read the same cells). */
const ROCK_CELLS = { wU: fbm(6, 3, 1), wV: fbm(6, 3, 2), rockC: cells(5, 0, 0.8, { warp: { u: ['wU', 0.08, -0.5], v: ['wV', 0.08, -0.5] } }) };

/**
 * Rocky ground: grey limestone breaking through thin soil, as on a karst
 * hillside: rounded boulders and low outcrops, scree and gravel round them,
 * lichen on the stone and tufts of dry grass in the pockets of soil. (On a
 * rock tile the game stands its boulders on this.)
 */
const rock = {
  fields: {
    noise: { ...ROCK_CELLS, rough: fbm(18, 3, 3), screeC: cells(40, 3, 0.9), knobs: fbm(24, 3, 4), base: fbm(6, 3, 5) },
    glsl: `
      // A rounded stone round its point, its outline roughened.
      float r = hash2( int( rockC.id ), 1, uSeed );
      float boulder = 0.0;
      if ( r <= 0.75 ) {
        float R = 0.22 + r * 0.32;
        float x = clamp( 1.0 - rockC.f1 * ( 0.85 + rough * 0.3 ) / R, 0.0, 1.0 );
        boulder = sqrt( x ) * ( 0.6 + r * 0.5 );
      }
      float scree = hash2( int( screeC.id ), 1, uSeed ) < 0.18 ? sstep( 0.42, 0.2, screeC.f1 ) * 0.3 : 0.0;
      return vec4( max( boulder * ( 0.9 + ( knobs - 0.5 ) * 0.25 ), scree ) + base * 0.1, boulder, scree, 0.0 );`,
  },
  blur: [4],
  colour: {
    noise: {
      ...ROCK_CELLS, screeC: cells(40, 3, 0.9), soilN: fbm(5, 3, 6), tuftN: fbm(20, 3, 7), paleN: fbm(10, 4, 8),
      grainN: fbm(60, 2, 9), lichenN: fbm(22, 3, 10),
    },
    glsl: `
      float cav = cavity( F.x, B.x, 3.0 );
      float b = F.y;
      vec3 greys[5] = ${rgbs(['#8e897e', '#827d73', '#99927f', '#7d776d', '#9d9584'])};
      // Between the stones: brown stony soil, tufts of grass in its pockets.
      col = mix( ${rgb('#86735a')}, ${rgb('#74644c')}, sstep( 0.4, 0.7, soilN ) );
      float tuft = sstep( 0.6, 0.7, tuftN ) * ( 1.0 - sstep( 0.0, 0.1, b ) );
      col = mix( col, ${rgb('#66703a')}, tuft * 0.75 );
      if ( F.z > 0.0 ) col = mix( col, greys[int( hash2( int( screeC.id ), 2, uSeed ) * 5.0 )], sstep( 0.0, 0.15, F.z ) * 0.7 );
      if ( b > 0.0 ) {
        int id = int( rockC.id );
        vec3 sc = mix( greys[int( hash2( id, 2, uSeed ) * 5.0 )], ${rgb('#b0a894')}, sstep( 0.5, 0.8, paleN ) * 0.35 );
        sc *= 0.9 + grainN * 0.18;
        float li = sstep( 0.62, 0.7, lichenN ) * sstep( 0.3, 0.7, b );
        sc = mix( sc, hash2( id, 4, uSeed ) < 0.5 ? ${rgb('#b3b08e')} : ${rgb('#b3924f')}, li * 0.5 );
        col = mix( col, sc, sstep( 0.0, 0.1, b ) );
      }
      col = mix( col, ${rgb('#3e3a33')}, cav * 0.65 );
      orm = vec3( 1.0 - cav * 0.7, b > 0.0 ? 0.78 : 0.92, tuft );`,
  },
  normal: { depth: 0.5 / 6 },
};

/** Dune sand: warm, with wind ripples and the odd darker grain. */
const sand = {
  fields: {
    noise: { w: fbm(3, 3, 1), wob: fbm(6, 2, 2), ripMask: fbm(4, 2, 3), base: fbm(5, 3, 0) },
    glsl: `
      float rip = sin( ( uv.y * 22.0 + w * 0.6 * 2.0 + wob * 0.6 ) * 6.283185307179586 );
      return vec4( 0.5 + rip * 0.18 * sstep( 0.25, 0.6, ripMask ) + base * 0.3, 0.0, 0.0, 0.0 );`,
  },
  colour: {
    noise: { tone: fbm(5, 4, 4) },
    glsl: `
      col = mix( ${rgb('#b49c70')}, ${rgb('#c4ae84')}, sstep( 0.35, 0.7, tone ) );
      col = mix( col, ${rgb('#9c8059')}, sstep( 0.45, 0.25, F.x ) * 0.35 );
      col *= 0.95 + hash2( px.x, px.y, uSeed + 5 ) * 0.08;
      orm = vec3( 1.0, 0.92, 0.0 );`,
  },
  normal: { depth: 0.02 / 3 },
};

/** A beach: pale fine sand, broken shells and a few smooth pebbles (the wet band is the shader's). */
const beach = {
  fields: {
    noise: { shellC: cells(50, 1, 0.95), a: fbm(6, 4, 0), b: fbm(40, 2, 2) },
    glsl: `
      float shell = hash2( int( shellC.id ), 1, uSeed ) < 0.08 ? sstep( 0.32, 0.16, shellC.f1 ) : 0.0;
      return vec4( a * 0.5 + b * 0.2 + shell * 0.35, shell, 0.0, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(4, 3, 3), shellC: cells(50, 1, 0.95) },
    glsl: `
      float cav = cavity( F.x, B.x, 6.0 );
      vec3 bits[4] = ${rgbs(['#f0e8d8', '#e3cfb0', '#8f8676', '#c9b9a2'])};
      col = mix( ${rgb('#ae9a74')}, ${rgb('#bba982')}, sstep( 0.35, 0.7, tone ) );
      col *= 0.96 + hash2( px.x, px.y, uSeed + 4 ) * 0.07;
      if ( F.y > 0.0 ) col = mix( col, bits[int( hash2( int( shellC.id ), 2, uSeed ) * 4.0 )], F.y );
      col = mix( col, ${rgb('#9c8a68')}, cav * 0.5 );
      orm = vec3( 1.0 - cav * 0.4, 0.88 - F.y * 0.3, 0.0 );`,
  },
  normal: { depth: 0.015 / 3 },
};

/** A farm's tilled soil: ploughed furrows along u (a field lies square to the map), clods, a few weeds. */
const soil = {
  fields: {
    noise: { wob: fbm(4, 2, 1), clods: fbm(30, 3, 2), weedN: fbm(30, 2, 5), weedMask: fbm(3, 2, 6) },
    glsl: `
      const float FURROWS = 6.0; // per 3 m repeat: one every 50 cm
      float f = 0.5 + 0.5 * cos( ( uv.y + ( wob - 0.5 ) * 0.04 ) * FURROWS * 6.283185307179586 );
      float weed = sstep( 0.72, 0.8, weedN ) * sstep( 0.5, 0.8, weedMask );
      return vec4( pow( max( f, 0.0 ), 0.7 ) * 0.6 + clods * 0.35, weed, 0.0, 0.0 );`,
  },
  blur: [3],
  colour: {
    noise: { pale: fbm(5, 3, 3) },
    glsl: `
      float cav = cavity( F.x, B.x, 4.0 );
      col = mix( ${rgb('#5e4430')}, ${rgb('#7c5f42')}, sstep( 0.3, 0.8, F.x ) );
      col = mix( col, ${rgb('#8f7656')}, sstep( 0.6, 0.8, pale ) * 0.3 );
      col = mix( col, ${rgb('#5c6e2c')}, F.y * 0.8 );
      col = mix( col, ${rgb('#2e2118')}, cav * 0.6 );
      orm = vec3( 1.0 - cav * 0.6, 0.94, F.y );`,
  },
  normal: { depth: 0.07 / 3 },
};

/** The bed under water: grey-olive silt, pebbles, and dark weed in patches. */
const bed = {
  fields: {
    noise: { pebC: cells(30, 1, 0.9), silt: fbm(5, 4, 0) },
    glsl: `
      float peb = hash2( int( pebC.id ), 1, uSeed ) < 0.35 ? sstep( 0.45, 0.2, pebC.f1 ) : 0.0;
      return vec4( silt * 0.5 + peb * 0.5, peb, 0.0, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(4, 3, 2), weed: fbm(6, 3, 3), pebC: cells(30, 1, 0.9) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      vec3 stones[4] = ${rgbs(['#8d8778', '#a59b86', '#6c6a60', '#7d7262'])};
      col = mix( ${rgb('#a39a7a')}, ${rgb('#857d62')}, sstep( 0.3, 0.7, tone ) );
      if ( F.y > 0.0 ) col = mix( col, stones[int( hash2( int( pebC.id ), 2, uSeed ) * 4.0 )], F.y );
      col = mix( col, ${rgb('#3f4a2a')}, sstep( 0.62, 0.75, weed ) * 0.7 );
      col = mix( col, ${rgb('#4a4436')}, cav * 0.5 );
      orm = vec3( 1.0 - cav * 0.5, 0.7, 0.0 );`,
  },
  normal: { depth: 0.04 / 3 },
};

/**
 * Via glareata: a road of rammed gravel, as most of the provinces' roads
 * were: light stones bedded in packed earth, larger ones worked up to the
 * top, finer grit where wheels and feet go.
 */
const gravel = {
  fields: {
    noise: { stoneC: cells(48, 1, 0.95), bedN: fbm(6, 3, 0), grit: fbm(90, 2, 2) },
    glsl: `
      int id = int( stoneC.id );
      float stone = hash2( id, 1, uSeed ) < 0.55 ? sstep( 0.5, 0.2, stoneC.f1 * ( 0.8 + hash2( id, 2, uSeed ) * 0.5 ) ) : 0.0;
      return vec4( stone * 0.6 + bedN * 0.3 + grit * 0.15, stone, 0.0, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(5, 3, 3), stoneC: cells(48, 1, 0.95) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      vec3 stones[5] = ${rgbs(['#c9bda5', '#b7a98f', '#d3c8b0', '#a39784', '#bba78a'])};
      col = mix( ${rgb('#a8946f')}, ${rgb('#bba886')}, sstep( 0.35, 0.7, tone ) );
      if ( F.y > 0.0 ) col = mix( col, stones[int( hash2( int( stoneC.id ), 3, uSeed ) * 5.0 )], sstep( 0.0, 0.5, F.y ) );
      col = mix( col, ${rgb('#6e5e48')}, cav * 0.6 );
      orm = vec3( 1.0 - cav * 0.55, 0.84 - F.y * 0.1, 0.0 );`,
  },
  normal: { depth: 0.03 / 2 },
};

/** Joint half width of the ground's paving, in cell units: wide enough to read at 256 px. */
const GROUT = 0.03;

/**
 * Basalt paving of a town's streets (silice stratae): big polygonal lava
 * blocks fitted close, each its own tone and tilt, polished on top, grit in
 * the joints. The well's street (surfaces.js basalt) at a game's scale.
 */
const basalt = {
  fields: {
    noise: {
      wU: fbm(3, 3, 11), wV: fbm(3, 3, 12),
      stone: cells(9, 0, 1.0, { warp: { u: ['wU', 0.09, -0.5], v: ['wV', 0.09, -0.5] } }), topN: fbm(22, 3, 2),
    },
    glsl: `
      float level = 0.8 + ( hash2( int( stone.id ), 1, uSeed ) - 0.5 ) * 0.15;
      float bevel = sstep( ${glf(GROUT)}, ${glf(GROUT + 0.06)}, stone.edge );
      return vec4( mix( 0.15, level + ( topN - 0.5 ) * 0.05, bevel ), stone.id, stone.edge, 0.0 );`,
  },
  blur: [3],
  colour: {
    noise: { dust: fbm(9, 3, 6), mott: fbm(40, 3, 7) },
    glsl: `
      float cav = cavity( F.x, B.x, 3.0 );
      int id = int( F.y );
      float e = F.z;
      vec3 tones[5] = ${rgbs(['#4a453f', '#524b42', '#45423e', '#4e473d', '#5a5146'])};
      float inJoint = 1.0 - sstep( ${glf(GROUT * 0.6)}, ${glf(GROUT + 0.02)}, e );
      float wear = sstep( ${glf(GROUT + 0.08)}, 0.35, e );
      col = mix( tones[int( hash2( id, 2, uSeed ) * 5.0 )], ${rgb('#8c8172')}, ( 1.0 - wear ) * 0.2 + dust * 0.1 );
      col *= 0.88 + mott * 0.24;
      col = mix( col, ${rgb('#2c2722')}, inJoint );
      col = mix( col, ${rgb('#38342f')}, cav * 0.4 );
      orm = vec3( 1.0 - max( inJoint * 0.5, cav * 0.5 ), mix( 0.62 - wear * 0.15, 0.95, inJoint ), 0.0 );`,
  },
  normal: { depth: 0.03 / 4.8 },
};

/** Flagstones' joint half width (relative to the 4 m repeat). */
const JOINT = 0.006;

/**
 * A forum's flagstones: rectangular slabs of travertine laid in courses
 * along u, each course its own width, each slab its own length and tone,
 * with worn corners and dark joints.
 */
const flags = {
  fields: {
    noise: { top: fbm(16, 3, 1) },
    glsl: `
      // Courses: 4 m in 4 courses of 0.8 to 1.2 m (relative widths summing to 1).
      float ws[4] = float[4]( 0.27, 0.22, 0.29, 0.22 );
      float v0 = 0.0;
      int row = 0;
      for ( int k = 0; k < 3; k++ ) {
        if ( uv.y >= v0 + ws[row] ) { v0 += ws[row]; row++; }
      }
      float v1 = v0 + ws[row];
      // Slabs along the course: lengths from 0.25 to 0.45 of the repeat (1 to 1.8 m), wrapping.
      float L[3] = float[3]( 0.3, 0.25, 0.45 );
      float uu = fract( uv.x + hash2( row, 7, uSeed ) );
      float order[3] = float[3]( L[row % 3], L[( row + 1 ) % 3], L[( row + 2 ) % 3] );
      int k = 0;
      float s0 = 0.0;
      for ( int q = 0; q < 2; q++ ) {
        if ( uu >= s0 + order[k] ) { s0 += order[k]; k++; }
      }
      float s1 = k == 2 ? 1.0 : s0 + order[k];
      float e = min( min( uu - s0, s1 - uu ), min( uv.y - v0, v1 - uv.y ) );
      int id = row * 7 + k;
      float lvl = 0.8 + ( hash2( id, 1, uSeed ) - 0.5 ) * 0.08;
      return vec4( mix( 0.2, lvl + ( top - 0.5 ) * 0.04, sstep( ${glf(JOINT)}, ${glf(JOINT + 0.012)}, e ) ), float( id ), e, 0.0 );`,
  },
  blur: [2],
  colour: {
    // Travertine's pores: small dark pits stretched along the bedding.
    noise: { pale: fbm(6, 3, 2), pore: cells(70, 3, 0.95, { sy: 2.5 }) },
    glsl: `
      float cav = cavity( F.x, B.x, 4.0 );
      vec3 tones[6] = ${rgbs(['#b9ab8c', '#c6b898', '#ae9f81', '#bfb091', '#a99a7c', '#b4a385'])};
      float inJoint = 1.0 - sstep( ${glf(JOINT * 0.5)}, ${glf(JOINT + 0.006)}, F.z );
      col = mix( tones[int( hash2( int( F.y ), 2, uSeed ) * 6.0 )], ${rgb('#d2c7b0')}, sstep( 0.6, 0.85, pale ) * 0.3 );
      // Grime along the joints, worn clean in the middle of each slab.
      col = mix( col, col * 0.84, sstep( 0.05, 0.0, F.z ) * 0.6 );
      float p = hash2( int( pore.id ), 1, uSeed ) < 0.15 ? sstep( 0.25, 0.08, pore.f1 ) : 0.0;
      col = mix( col, ${rgb('#8d7c5e')}, p * 0.6 );
      col = mix( col, ${rgb('#5d5243')}, inJoint );
      col = mix( col, ${rgb('#8a7c62')}, cav * 0.5 );
      orm = vec3( 1.0 - max( inJoint * 0.5, cav * 0.4 ), mix( 0.7, 0.95, inJoint ), 0.0 );`,
  },
  normal: { depth: 0.02 / 4 },
};

/**
 * Rubble of a fallen building: broken stone and brick, roof tile shards,
 * lumps of mortar, charred timber and ash.
 */
const rubble = {
  fields: {
    noise: { lumpC: cells(14, 1, 1.0), fineC: cells(46, 2, 1.0), base: fbm(8, 3, 0) },
    glsl: `
      float r = hash2( int( lumpC.id ), 1, uSeed );
      float lump = r < 0.75 ? sstep( 0.0, 0.12, lumpC.edge ) * ( 0.5 + r * 0.6 ) : 0.0;
      float fine = hash2( int( fineC.id ), 1, uSeed ) < 0.5 ? sstep( 0.0, 0.08, fineC.edge ) : 0.0;
      return vec4( lump * 0.7 + fine * 0.25 + base * 0.2, lump, fine, 0.0 );`,
  },
  blur: [3],
  colour: {
    noise: { tone: fbm(5, 3, 3), soot: fbm(4, 3, 4), lumpC: cells(14, 1, 1.0) },
    glsl: `
      float cav = cavity( F.x, B.x, 3.0 );
      vec3 bits[8] = ${rgbs(['#a59c8c', '#8c8373', '#94604a', '#b2a690', '#7a6f60', '#5a4c40', '#9a8a74', '#857a6a'])};
      col = mix( ${rgb('#6f655a')}, ${rgb('#504840')}, sstep( 0.4, 0.7, tone ) );
      if ( F.y > 0.0 ) col = mix( col, bits[int( hash2( int( lumpC.id ), 2, uSeed ) * 8.0 )], sstep( 0.0, 0.4, F.y ) );
      else if ( F.z > 0.0 ) col = mix( col, bits[int( hash2( ( px.y * n + px.x ) >> 9, 3, uSeed ) * 4.0 )], F.z * 0.6 );
      // Soot and ash in drifts.
      col = mix( col, ${rgb('#2a2522')}, sstep( 0.6, 0.75, soot ) * 0.55 );
      col = mix( col, ${rgb('#2c2622')}, cav * 0.7 );
      orm = vec3( 1.0 - cav * 0.7, 0.9, 0.0 );`,
  },
  normal: { depth: 0.12 / 3 },
};

/** Ripples for water: only the normal map matters (two scales of swell). */
const ripples = {
  fields: {
    noise: { swell: fbm(3, 5, 0, { gain: 0.55 }), chop: fbm(11, 3, 1) },
    glsl: 'return vec4( swell * 0.65 + chop * 0.35, 0.0, 0.0, 0.0 );',
  },
  colour: { glsl: 'col = vec3( 0.5 ); orm = vec3( 1.0, 0.05, 0.0 );' },
  normal: { depth: 0.06 },
};

/**
 * A yard: the trodden earth round a building and under it (what shows of
 * it between the sprites, and a farm's farmhouse yard): packed, pale where
 * feet go most, grit and small stones worked up, dry cracks, a weed in a
 * corner.
 */
const yard = {
  fields: {
    noise: { base: fbm(5, 4, 0), grit: fbm(70, 2, 1), pebC: cells(34, 2, 0.9), worn: fbm(3, 3, 3), crackN: ridge(7, 3, 4) },
    glsl: `
      float peb = hash2( int( pebC.id ), 1, uSeed ) < 0.2 ? sstep( 0.42, 0.18, pebC.f1 ) : 0.0;
      float crack = pow( crackN, 16.0 ) * sstep( 0.5, 0.7, worn );
      return vec4( base * 0.35 + grit * 0.12 + peb * 0.4 - crack * 0.2, peb, worn, crack );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(4, 3, 5), weedN: fbm(24, 3, 6), weedMask: fbm(3, 2, 7), pebC: cells(34, 2, 0.9) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      vec3 stones[4] = ${rgbs(['#b5aa94', '#a39882', '#c3b8a0', '#8e8575'])};
      col = mix( ${rgb('#866f52')}, ${rgb('#9e8765')}, sstep( 0.3, 0.75, tone ) );
      // Trodden smooth and paler where feet go most.
      float trod = sstep( 0.55, 0.8, F.z );
      col = mix( col, ${rgb('#a8916f')}, trod * 0.45 );
      if ( F.y > 0.0 ) col = mix( col, stones[int( hash2( int( pebC.id ), 2, uSeed ) * 4.0 )], sstep( 0.0, 0.4, F.y ) );
      float weed = sstep( 0.72, 0.8, weedN ) * sstep( 0.6, 0.78, weedMask ) * ( 1.0 - trod );
      col = mix( col, ${rgb('#5b6a30')}, weed * 0.85 );
      col = mix( col, ${rgb('#4a3b2a')}, max( cav * 0.5, F.w * 0.55 ) );
      orm = vec3( 1.0 - cav * 0.5, 0.9 - trod * 0.14, weed );`,
  },
  normal: { depth: 0.02 / 3 },
};

/**
 * A pig pen: trampled wet earth, hoof prints, wallows standing low and
 * dark, straw scattered from the sty.
 */
const mud = {
  fields: {
    noise: {
      base: fbm(4, 4, 0), clods: fbm(26, 3, 1), hoofC: cells(20, 2, 0.8), wallow: fbm(3, 3, 3),
      strawA: fbm(48, 2, 4, { sx: 6 }), strawB: fbm(48, 2, 5, { sx: 6, coord: 'diag' }), strawM: fbm(4, 2, 6),
    },
    glsl: `
      int id = int( hoofC.id );
      // A cloven print: two small pits side by side, turned any way.
      float hoof = 0.0;
      if ( hash2( id, 1, uSeed ) < 0.6 ) {
        float a = hash2( id, 2, uSeed ) * 6.283185307179586;
        vec2 r = vec2( cos( a ), sin( a ) );
        vec2 l = vec2( dot( hoofC.d, r ), dot( hoofC.d, vec2( -r.y, r.x ) ) );
        l.y *= 0.7;
        hoof = max( sstep( 0.13, 0.06, length( l - vec2( 0.09, 0.0 ) ) ), sstep( 0.13, 0.06, length( l + vec2( 0.09, 0.0 ) ) ) );
      }
      float wal = sstep( 0.6, 0.76, wallow );
      float straw = sstep( 0.8, 0.88, max( strawA, strawB ) ) * sstep( 0.45, 0.6, strawM ) * ( 1.0 - wal );
      return vec4( base * 0.35 + clods * 0.3 - hoof * 0.22 - wal * 0.3 + straw * 0.25, wal, straw, hoof );`,
  },
  blur: [3],
  colour: {
    noise: { tone: fbm(5, 3, 7), sheen: fbm(30, 2, 8) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      col = mix( ${rgb('#4e3b29')}, ${rgb('#6a5238')}, sstep( 0.3, 0.75, tone ) );
      // Drying crust on the high clods, dark wet earth in the wallows.
      col = mix( col, ${rgb('#7e6649')}, sstep( 0.6, 0.85, F.x ) * 0.5 );
      col = mix( col, ${rgb('#2c2219')}, F.y * 0.85 );
      col = mix( col, ${rgb('#b39a5a')}, F.z );
      col = mix( col, ${rgb('#2a1f16')}, max( cav * 0.6, F.w * 0.5 ) );
      orm = vec3( 1.0 - cav * 0.5, mix( 0.85, 0.25 + sheen * 0.15, F.y ), 0.0 );`,
  },
  normal: { depth: 0.035 / 3 },
};

/**
 * Wheat in its drill rows (along u, ten to the 2 m repeat): seen from above
 * the ears and blades lean every way, a little more with the wind, dark
 * between the rows. Painted at its full green: the shader shows as much of
 * it as has grown (its height: the rows' middles come up first) and turns
 * it gold as it ripens, the ears (`dec`) first.
 */
const grain = {
  fields: {
    noise: {
      wob: fbm(4, 2, 1), earA: fbm(80, 2, 2, { sx: 4, coord: 'diag' }), earB: fbm(80, 2, 3, { sx: 3 }), earC: fbm(70, 2, 4, { sx: 4, coord: 'vu' }),
      lay: fbm(3, 3, 5), body: fbm(14, 3, 6),
    },
    glsl: `
      const float ROWS = 10.0;
      float row = 0.5 + 0.5 * cos( ( uv.y + ( wob - 0.5 ) * 0.03 ) * ROWS * 6.283185307179586 );
      float ear = max( earA, mix( earB, earC, sstep( 0.4, 0.6, lay ) ) );
      float ears = sstep( 0.6, 0.75, ear );
      return vec4( pow( row, 1.3 ) * 0.5 + body * 0.2 + ear * 0.3, ears, row, lay );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(6, 3, 7), fleck: fbm(50, 2, 8) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      col = mix( ${rgb('#4d6a26')}, ${rgb('#6c8a34')}, sstep( 0.3, 0.75, tone ) );
      col = mix( col, ${rgb('#8ea24c')}, F.y * 0.7 );
      // The leaves catch the light where the wind lays them over.
      col = mix( col, ${rgb('#9cae5c')}, sstep( 0.55, 0.62, F.w ) * sstep( 0.68, 0.6, F.w ) * 0.3 );
      col *= 0.92 + fleck * 0.16;
      col = mix( col, ${rgb('#23300f')}, cav * 0.6 );
      orm = vec3( 1.0 - cav * 0.6, 0.82, 1.0 );
      dec = F.y;`,
  },
  normal: { depth: 0.03 / 2 },
};

/**
 * Vegetables in rows (along u, four to the 2 m repeat): heads of cabbage,
 * lettuce, chard and turnips, each row its own, each head its own shade and
 * leafy relief, the earth between the rows. `dec`: what shows when they are
 * ready (a turnip's purple shoulder, chard's red stems).
 */
const veg = {
  fields: {
    noise: { leafN: fbm(40, 3, 1), wob: fbm(5, 2, 2), vein: ridge(30, 2, 3) },
    glsl: `
      const float ROWS = 4.0;
      const float ALONG = 6.0;
      float rv = uv.y * ROWS;
      float r = floor( rv );
      float fv = rv - r - 0.5;
      float ru = uv.x * ALONG + hash2( int( r ), 5, uSeed ) * 0.5;
      float k = floor( ru );
      float fu = ru - k - 0.5;
      int id = int( r ) * 64 + int( wrapi( int( k ), int( ALONG ) ) );
      // A head: a leafy dome, its size and place a little its own.
      vec2 c = vec2( ( hash2( id, 1, uSeed ) - 0.5 ) * 0.25, ( hash2( id, 2, uSeed ) - 0.5 ) * 0.12 );
      float R = 0.3 + hash2( id, 3, uSeed ) * 0.1;
      vec2 d = vec2( fu * ( ROWS / ALONG ), fv ) - c;
      // Leafy, not round: the outline frills with the leaves.
      float ang = atan( d.y, d.x );
      float dd = length( d ) / ( R * ( 0.86 + 0.14 * sin( ang * 7.0 + hash2( id, 6, uSeed ) * 6.28 ) + ( leafN - 0.5 ) * 0.2 ) );
      float head = dd < 1.0 ? sqrt( 1.0 - dd * dd ) : 0.0;
      float leaf = head > 0.0 ? head * ( 0.75 + leafN * 0.3 ) + vein * 0.06 : 0.0;
      return vec4( leaf * 0.85 + wob * 0.1, head, float( id ), r );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(8, 3, 4), fleck: fbm(60, 2, 5) },
    glsl: `
      float cav = cavity( F.x, B.x, 6.0 );
      int id = int( F.z );
      int row = int( F.w );
      // Each row its own crop: cabbage (blue-green), lettuce (fresh green), chard (dark, red-stemmed), turnip (mid green).
      vec3 kinds[4] = ${rgbs(['#6a8268', '#7d964a', '#3f5e2b', '#587c38'])};
      int kind = int( hash2( row, 9, uSeed ) * 4.0 );
      vec3 c = mix( kinds[kind], ${rgb('#5f7d3e')}, 0.35 ) * ( 0.88 + hash2( id, 4, uSeed ) * 0.2 ) * ( 0.92 + tone * 0.12 );
      c *= 0.85 + fleck * 0.2;
      // The heart of a head is paler, its outer leaves darker.
      c = mix( c * 0.75, c * 1.12, sstep( 0.2, 0.9, F.y ) );
      col = F.y > 0.0 ? c : ${rgb('#5a4330')};
      col = mix( col, ${rgb('#1f2a12')}, cav * 0.55 );
      orm = vec3( 1.0 - cav * 0.6, 0.72, F.y > 0.0 ? 1.0 : 0.0 );
      // Ready: a turnip's purple shoulder at the heart, chard's red ribs.
      float ready = ( kind == 3 ? sstep( 0.75, 0.9, F.y ) : 0.0 ) + ( kind == 2 ? sstep( 0.45, 0.5, F.y ) * sstep( 0.55, 0.5, F.y ) : 0.0 );
      if ( ready > 0.0 ) col = mix( col, kind == 3 ? ${rgb('#8a4a78')} : ${rgb('#a8343a')}, ready * 0.9 );
      dec = ready;`,
  },
  normal: { depth: 0.05 / 2 },
};

/**
 * Flax: close rows of fine stalks (along u, sixteen to the 2 m repeat),
 * thick with sky-blue flowers in bloom (`dec`: the shader shows them only
 * while the crop flowers, then the seed bolls go golden brown).
 */
const flax = {
  fields: {
    noise: { wob: fbm(4, 2, 1), stalkA: fbm(110, 2, 2, { sx: 5 }), stalkB: fbm(110, 2, 3, { sx: 5, coord: 'diag' }), flowerC: cells(64, 4, 0.95), body: fbm(10, 3, 5) },
    glsl: `
      const float ROWS = 16.0;
      float row = 0.5 + 0.5 * cos( ( uv.y + ( wob - 0.5 ) * 0.02 ) * ROWS * 6.283185307179586 );
      float stalk = max( stalkA, stalkB );
      float fl = hash2( int( flowerC.id ), 1, uSeed ) < 0.32 ? sstep( 0.3, 0.17, flowerC.f1 ) : 0.0;
      return vec4( row * 0.45 + stalk * 0.3 + body * 0.15 + fl * 0.2, fl, row, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(6, 3, 6), flowerC: cells(64, 4, 0.95) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      col = mix( ${rgb('#557a33')}, ${rgb('#77984a')}, sstep( 0.3, 0.75, tone ) );
      col = mix( col, ${rgb('#8aa65a')}, sstep( 0.6, 0.8, F.x ) * 0.4 );
      if ( F.y > 0.0 ) col = mix( col, hash2( int( flowerC.id ), 3, uSeed ) < 0.2 ? ${rgb('#b9cdf3')} : ${rgb('#6f8fd8')}, F.y );
      col = mix( col, ${rgb('#1e2a12')}, cav * 0.55 );
      orm = vec3( 1.0 - cav * 0.6, 0.8, 1.0 );
      dec = F.y;`,
  },
  normal: { depth: 0.025 / 2 },
};

/**
 * What a fire leaves: charred beams fallen across one another, their
 * charcoal checked in squares, grey and white ash in drifts, roof tiles
 * gone dark, blackened stones. `dec`: the cracks and hollows that still
 * glow while it burns (the shader's embers).
 */
const ash = {
  fields: {
    noise: {
      beamC: cells(5, 1, 0.9), checkC: cells(70, 2, 0.6), lumpC: cells(16, 3, 1.0), drift: fbm(4, 3, 4), base: fbm(9, 3, 5), emberN: fbm(20, 3, 6),
    },
    glsl: `
      // A beam a cell, lying any way: a long narrow box round its point.
      int bid = int( beamC.id );
      float a = hash2( bid, 1, uSeed ) * 3.14159;
      vec2 r = vec2( cos( a ), sin( a ) );
      vec2 l = vec2( dot( beamC.d, r ), dot( beamC.d, vec2( -r.y, r.x ) ) );
      float len = 0.35 + hash2( bid, 2, uSeed ) * 0.3;
      float wid = 0.05 + hash2( bid, 3, uSeed ) * 0.04;
      float beam = hash2( bid, 4, uSeed ) < 0.75 ? sstep( wid, wid * 0.6, abs( l.y ) ) * sstep( len, len - 0.05, abs( l.x ) ) : 0.0;
      float check = sstep( 0.0, 0.08, checkC.edge );
      float lump = hash2( int( lumpC.id ), 1, uSeed ) < 0.45 ? sstep( 0.0, 0.1, lumpC.edge ) * 0.7 : 0.0;
      float ashD = sstep( 0.45, 0.7, drift );
      float h = max( beam * ( 0.75 + check * 0.15 ), lump ) + base * 0.15 + ashD * 0.12;
      return vec4( h, beam * check, lump, ashD );`,
  },
  blur: [3],
  colour: {
    noise: { tone: fbm(5, 3, 7), emberN: fbm(20, 3, 6), lumpC: cells(16, 3, 1.0) },
    glsl: `
      float cav = cavity( F.x, B.x, 4.0 );
      vec3 bits[5] = ${rgbs(['#5a524a', '#6d3a2a', '#4a4440', '#7a7064', '#3a3430'])};
      col = mix( ${rgb('#3a3531')}, ${rgb('#57514a')}, sstep( 0.3, 0.7, tone ) );
      // Ash: pale grey and white where it lies thick.
      col = mix( col, mix( ${rgb('#7c776f')}, ${rgb('#a29d94')}, tone ), F.w * 0.55 );
      if ( F.z > 0.0 ) col = mix( col, bits[int( hash2( int( lumpC.id ), 2, uSeed ) * 5.0 )] * 0.75, sstep( 0.0, 0.3, F.z ) );
      // Charcoal: black, its checks a little grey.
      float charcoal = sstep( 0.0, 0.2, F.y );
      col = mix( col, ${rgb('#1a1715')}, charcoal * 0.9 );
      col = mix( col, ${rgb('#141110')}, cav * 0.7 );
      orm = vec3( 1.0 - cav * 0.7, 0.95, 0.0 );
      // Embers: deep in the cracks and under the beams.
      dec = sstep( 0.55, 0.75, emberN ) * max( cav * 1.5, charcoal * ( 1.0 - F.y * 0.5 ) );`,
  },
  normal: { depth: 0.1 / 3 },
};

/**
 * The layers of the ground's texture arrays, in order (a layer's index is
 * its kind's number for the first nine, groundMap.js KIND), how many
 * metres one repeat covers, and whether the shader may mix in a turned copy
 * against tiling (`anti`): not for a pattern laid square to the map, the
 * furrows, the paving's joints and the flagstones' courses, a field's rows.
 */
export const GROUND_LAYERS = Object.freeze([
  { name: 'grass', metres: 2.5, anti: true, ...grass },
  { name: 'meadow', metres: 2.5, anti: true, ...meadow },
  { name: 'scrub', metres: 3.5, anti: true, ...scrub },
  { name: 'forest', metres: 3, anti: true, ...forest },
  { name: 'rock', metres: 6, anti: true, ...rock },
  { name: 'sand', metres: 3, anti: true, ...sand },
  { name: 'beach', metres: 3, anti: true, ...beach },
  { name: 'soil', metres: 3, anti: false, ...soil },
  { name: 'bed', metres: 3, anti: true, ...bed },
  { name: 'gravel', metres: 2, anti: true, ...gravel },
  { name: 'basalt', metres: 4.8, anti: false, ...basalt },
  { name: 'flags', metres: 4, anti: false, ...flags },
  { name: 'rubble', metres: 3, anti: true, ...rubble },
  { name: 'ripples', metres: 6, anti: false, ...ripples },
  // What people made of the ground that is not a road (groundMap.js SITE).
  { name: 'yard', metres: 3, anti: true, ...yard },
  { name: 'mud', metres: 3, anti: true, ...mud },
  { name: 'grain', metres: 2, anti: false, ...grain },
  { name: 'veg', metres: 2, anti: false, ...veg },
  { name: 'flax', metres: 2, anti: false, ...flax },
  { name: 'ash', metres: 3, anti: true, ...ash },
]);

/** Layer index by name. */
export const LAYER = Object.freeze(Object.fromEntries(GROUND_LAYERS.map((l, i) => [l.name, i])));

/** The layers as one set of recipes (one program paints them all: paint/painter.js). */
export const GROUND_SET = Object.freeze({ key: 'ground', recipes: GROUND_LAYERS, names: GROUND_LAYERS.map((l) => l.name) });
