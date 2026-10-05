/**
 * paint/glsl.js
 * ----------------------------------------------------------------------------
 * The toolbox every procedural texture is painted with, in GLSL (WebGL 2):
 * the GPU paints them (paint/painter.js), a pixel a fragment. Seeded and
 * periodic as the textures need:
 *
 *   hash2(ix, iy, seed)   a 32-bit integer hash of a lattice point, 0..1
 *   gnoise(p, per, seed)  gradient noise periodic over `per` lattice cells
 *   fbm(...)              fractal noise, every octave still tiling
 *   ridge(...)            sharp creases where the noise crosses its middle
 *   voronoi(...)          jittered cells with the true distance to their
 *                         borders (straight joints between cut stones)
 *   sstep(a, b, x)        smoothstep that also runs downhill (a > b), which
 *                         GLSL's own leaves undefined
 *
 * Everything TILES: a texture covers uv in [0, 1) and wraps, so a noise's
 * lattice wraps at a whole number of cells, and a seam never shows on a wall
 * of blocks. The hash is integer arithmetic (uint wraps as JS's Math.imul
 * does), so the same seed gives the same stone on every GPU.
 *
 * The noises a recipe reads are not called from its code one by one: they
 * are listed in a table (paint/recipe.js) and evaluated in one loop here
 * (`paintNoises`), so a program holds the noise's code once however many
 * noises its recipes read. ANGLE on Direct3D compiles a shader's every
 * inlined call: written out call by call, a recipe took three times as long
 * to compile, and compiling is most of what painting costs on a GPU.
 * ----------------------------------------------------------------------------
 */

/** Most noises one stage of a recipe may list. */
export const MAX_NOISES = 16;

/** Noise kinds in the table (paint/recipe.js packs them). */
export const NOISE = Object.freeze({ FBM: 0, RIDGE: 1, CELLS: 2 });

/** Where a noise is read: at (u, v), at (v, u) (stretched the other way), or along the diagonals (wrapping). */
export const COORD = Object.freeze({ UV: 0, VU: 1, DIAG: 2 });

export const GLSL_TOOLBOX = /* glsl */ `
precision highp float;
precision highp int;

// a mod n for any int a (GLSL's own % is undefined for a negative a).
int wrapi( int a, int n ) {
  if ( a < 0 ) a += n * ( 1 + ( -a ) / n );
  return a - ( a / n ) * n;
}
ivec2 wrap2( ivec2 a, int n ) { return ivec2( wrapi( a.x, n ), wrapi( a.y, n ) ); }

uint hashMix( int ix, int iy, int seed ) {
  return ( uint( ix ) * 0x27d4eb2du ) ^ ( uint( iy ) * 0x165667b1u ) ^ ( uint( seed ) * 0x9e3779b1u );
}
// A lattice point's hash as 0..1 (24 bits: a float holds them exactly, so it never rounds up to 1).
float hash2( int ix, int iy, int seed ) {
  uint h = hashMix( ix, iy, seed );
  h = ( h ^ ( h >> 15u ) ) * 0x85ebca6bu;
  h = ( h ^ ( h >> 13u ) ) * 0xc2b2ae35u;
  h ^= h >> 16u;
  return float( h >> 8u ) * ( 1.0 / 16777216.0 );
}
// One of 256 unit gradients, picked by the hash's top byte.
vec2 gradAt( int ix, int iy, int seed ) {
  uint h = hashMix( ix, iy, seed );
  h = ( h ^ ( h >> 15u ) ) * 0x85ebca6bu;
  float a = ( float( ( h ^ ( h >> 13u ) ) >> 24u ) + 0.5 ) * ( 6.283185307179586 / 256.0 );
  return vec2( cos( a ), sin( a ) );
}
// Gradient noise periodic over per.x x per.y cells, about -0.7..0.7. (Gradient, not
// value noise: value noise shows its square lattice as blocky blobs.)
float gnoise( vec2 p, ivec2 per, int seed ) {
  vec2 i = floor( p );
  vec2 f = p - i;
  int x0 = wrapi( int( i.x ), per.x );
  int y0 = wrapi( int( i.y ), per.y );
  int x1 = x0 + 1 == per.x ? 0 : x0 + 1;
  int y1 = y0 + 1 == per.y ? 0 : y0 + 1;
  vec2 u = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 );
  float g00 = dot( gradAt( x0, y0, seed ), f );
  float g10 = dot( gradAt( x1, y0, seed ), f - vec2( 1.0, 0.0 ) );
  float g01 = dot( gradAt( x0, y1, seed ), f - vec2( 0.0, 1.0 ) );
  float g11 = dot( gradAt( x1, y1, seed ), f - vec2( 1.0, 1.0 ) );
  return mix( mix( g00, g10, u.x ), mix( g01, g11, u.x ), u.y );
}
// Fractal noise at uv: cells lattice cells for the first octave, each octave twice as many (so every
// octave tiles); sx stretches it along u (cells along u become cells / sx). About 0..1, centred on 0.5.
float fbm( vec2 uv, int cells, int octaves, int seed, float gain, float sx ) {
  float sum = 0.0;
  float amp = 1.0;
  float norm = 0.0;
  ivec2 c = ivec2( max( 1, int( floor( float( cells ) / sx + 0.5 ) ) ), cells );
  for ( int o = 0; o < octaves; o++ ) {
    sum += amp * gnoise( uv * vec2( c ), c, seed + o * 1013 );
    norm += amp;
    amp *= gain;
    c *= 2;
  }
  return 0.5 + ( sum / norm ) * 0.9;
}
// Voronoi cells periodic over the texture, cells x round(cells * sy), jittered: x the cell's id, y the
// distance to its point, z the distance to its nearest border, w unused; d the pixel less the point.
vec4 voronoi( vec2 uv, int cells, int seed, float jitter, float sy, out vec2 d ) {
  int cy = max( 1, int( floor( float( cells ) * sy + 0.5 ) ) );
  vec2 p = uv * vec2( float( cells ), float( cy ) );
  ivec2 pi = ivec2( floor( p ) );
  float best = 1e9;
  vec2 b = vec2( 0.0 );
  ivec2 bg = ivec2( 0 );
  float bid = 0.0;
  for ( int j = -1; j <= 1; j++ ) {
    for ( int i = -1; i <= 1; i++ ) {
      ivec2 g = pi + ivec2( i, j );
      int gx = wrapi( g.x, cells );
      int gy = wrapi( g.y, cy );
      vec2 f = vec2( g ) + 0.5 + ( vec2( hash2( gx, gy, seed ), hash2( gx, gy, seed + 7 ) ) - 0.5 ) * jitter;
      vec2 q = f - p;
      float dd = dot( q, q );
      if ( dd < best ) { best = dd; b = f; bg = g; bid = float( gy * cells + gx ); }
    }
  }
  // Every neighbour of the winning cell may share a border with it: the nearest bisector.
  float edge = 1e9;
  for ( int j = -2; j <= 2; j++ ) {
    for ( int i = -2; i <= 2; i++ ) {
      if ( i == 0 && j == 0 ) continue;
      ivec2 g = bg + ivec2( i, j );
      int gx = wrapi( g.x, cells );
      int gy = wrapi( g.y, cy );
      vec2 f = vec2( g ) + 0.5 + ( vec2( hash2( gx, gy, seed ), hash2( gx, gy, seed + 7 ) ) - 0.5 ) * jitter;
      vec2 k = f - b;
      float len = length( k );
      if ( len < 1e-6 ) continue;
      edge = min( edge, dot( ( f + b ) * 0.5 - p, k ) / len );
    }
  }
  d = p - b;
  return vec4( bid, sqrt( best ), edge, 0.0 );
}
float sstep( float a, float b, float x ) {
  float t = clamp( ( x - a ) / ( b - a ), 0.0, 1.0 );
  return t * t * ( 3.0 - 2.0 * t );
}
// How far a pixel sits below its neighbourhood's average: pits and joints gather dirt.
float cavity( float h, float avg, float scale ) { return clamp( ( avg - h ) * scale, 0.0, 1.0 ); }
// Colours are painted in sRGB (as a painter mixes); the target stores sRGB and wants linear light.
vec3 srgbToLinear( vec3 c ) {
  c = clamp( c, 0.0, 1.0 );
  return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( 0.04045, c ) );
}
`;

/**
 * The noise table: up to MAX_NOISES noises a stage of a recipe reads,
 * evaluated in one loop into nv[] (fbm, ridge: x the value; cells: x id,
 * y f1, z edge) and nd[] (cells: the pixel less its cell's point). Entry k:
 *   uNa[k]  kind, cells, octaves, seed offset (added to uSeed)
 *   uNb[k]  gain, stretch (fbm: sx along u; cells: sy along v), jitter, coord (COORD)
 *   uNc[k]  warp: u's source entry (-1 none), scale, offset; v's source entry
 *   uNd[k]  warp: v's scale, offset
 * A warp moves the point by (source + offset) * scale, from entries before it.
 */
export const GLSL_NOISES = /* glsl */ `
uniform vec4 uNa[${MAX_NOISES}];
uniform vec4 uNb[${MAX_NOISES}];
uniform vec4 uNc[${MAX_NOISES}];
uniform vec4 uNd[${MAX_NOISES}];
uniform int uNCount;
uniform int uSeed;
vec4 nv[${MAX_NOISES}];
vec2 nd[${MAX_NOISES}];
struct Cell { float id; float f1; float edge; vec2 d; };
Cell cellOf( int k ) { return Cell( nv[k].x, nv[k].y, nv[k].z, nd[k] ); }
void paintNoises( vec2 uv ) {
  for ( int k = 0; k < ${MAX_NOISES}; k++ ) {
    if ( k >= uNCount ) break;
    vec4 a = uNa[k];
    vec4 b = uNb[k];
    vec4 c = uNc[k];
    vec2 p = uv;
    int mode = int( b.w );
    if ( mode == ${1} ) p = uv.yx;
    else if ( mode == ${2} ) p = vec2( fract( uv.x + uv.y ), fract( uv.y - uv.x + 1.0 ) );
    if ( c.x >= 0.0 ) p.x += ( nv[int( c.x )].x + c.z ) * c.y;
    if ( c.w >= 0.0 ) p.y += ( nv[int( c.w )].x + uNd[k].y ) * uNd[k].x;
    int kind = int( a.x );
    int seed = uSeed + int( a.w );
    if ( kind == ${2} ) {
      vec2 d;
      nv[k] = voronoi( p, int( a.y ), seed, b.z, b.y, d );
      nd[k] = d;
    } else {
      float n = fbm( p, int( a.y ), int( a.z ), seed, b.x, b.y );
      if ( kind == ${1} ) n = 1.0 - min( 1.0, abs( n - 0.5 ) * 2.0 );
      nv[k] = vec4( n, 0.0, 0.0, 0.0 );
      nd[k] = vec2( 0.0 );
    }
  }
}
`;

/** A number as a GLSL float literal (a whole number needs its point: 1 is an int to GLSL). */
export function glf(x) {
  const s = String(x);
  return /[.eE]/.test(s) ? s : `${s}.0`;
}

/** A colour (sRGB hex) as a GLSL vec3 of 0..1 sRGB components, for a recipe's code. */
export function rgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  const f = (x) => (x / 255).toFixed(6);
  return `vec3(${f((v >> 16) & 255)}, ${f((v >> 8) & 255)}, ${f(v & 255)})`;
}

/** A list of colours as a GLSL array constructor: `vec3[n](...)`. */
export function rgbs(list) {
  return `vec3[${list.length}](${list.map(rgb).join(', ')})`;
}
