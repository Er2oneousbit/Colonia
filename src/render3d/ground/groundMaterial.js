/**
 * ground/groundMaterial.js
 * ----------------------------------------------------------------------------
 * The ground's one material: three's physically based MeshStandardMaterial
 * (so the sun, its shadow map, the sky's light, ACES and the rest of the 3D
 * look light it as they light the well), with its surface worked out per
 * pixel from the type map (groundMap.js) and the ground's texture arrays
 * (groundTextures.js) instead of from one texture:
 *
 *   1. Kinds. The four tile middles round the pixel give four kinds and
 *      bilinear weights; the point they are read at is bent by noise, so
 *      the line between two kinds wanders, and each kind's height (its
 *      albedo's alpha) is added to its weight, so at the line the higher
 *      kind's bumps win: grass tufts over sand, scrub cushions over grass,
 *      leaf litter creeping out under the trees. Up to four kinds are
 *      sampled; most pixels have one and sample one.
 *   2. Anti-tiling (High): each organic kind is sampled by hex tiling
 *      (three turned copies blended over a triangle grid), and large soft
 *      noise changes tone and dryness across a field, so a big field never
 *      shows its repeat.
 *   2b. Sites, from the site map (groundMap.js): what people made of the
 *      tile, with a clean edge where it ends: a building's yard, a wall's
 *      footing, a farm's field as its crop grows and ripens, a pen's mud.
 *   3. Roads, plazas, rubble, from the road byte of the pixel's own tile:
 *      the road's shape is a distance field (a centre square and an arm to
 *      each linked side, corners rounded), so the road bends and meets as
 *      the 2D art's does, with a worn verge, and kerbs of limestone along
 *      a street's basalt.
 *   4. Water, from the shore distance read between tile middles: a smooth
 *      coast, the bed seen through clear shallows, the colour deepening to
 *      the open water's (a river green-blue, the sea blue), drifting
 *      ripples reflecting the sky, foam lapping at the edge and a wet band
 *      on the land; shallows freeze under deep snow.
 *   5. Weather and season (uniforms, so they change smoothly, not in the
 *      2D art's steps): the season tints only what is living (the ORM's
 *      blue: blades and leaves, never the soil between them), snow settles
 *      by kind (little on a cleared road, none on water) and by the
 *      surface's bumps, rain darkens what soaks it up and leaves puddles in
 *      the hollows.
 *
 * The map's own coordinates (tiles, x along the map's x, z along its y)
 * are the mesh's local x and z (ground.js turns the mesh with the view), so
 * the shader reads the type map at the map tile under the pixel whatever
 * the view turn. Textures are sampled with textureGrad and derivatives
 * taken once at the top: the kind loop branches per pixel, and implicit
 * derivatives inside such branches are undefined. The value noises are
 * computed in three batches (NOISE_BATCHES) of one loop each, whose bound
 * the compiler cannot see (uGZero), so the noise's code is in the program
 * three times instead of some forty: ANGLE's D3D compiler unrolls a loop
 * whose bound it knows, and the copies were half the shader's compile.
 * ----------------------------------------------------------------------------
 */

import { MeshStandardMaterial, Vector2, Vector3 } from 'three';
import { LOOK } from '../materials.js';
import { GROUND_LAYERS, LAYER } from './groundSurfaces.js';
import { KIND, SITE } from './groundMap.js';

/** Per kind (KIND order): how much snow lies, how much the season tints it, how dark rain makes it, puddles. */
const KIND_SNOW = [1.0, 1.0, 0.85, 0.75, 0.6, 0.7, 0.55, 0.95, 0.0];
const KIND_SEASON = [1.0, 1.0, 0.55, 0.8, 0.3, 0.0, 0.0, 0.6, 0.0];
const KIND_SOAK = [0.55, 0.5, 0.8, 0.6, 0.45, 0.9, 1.0, 0.85, 0.0];
const KIND_PUDDLE = [0.25, 0.15, 0.6, 0.3, 0.5, 0.15, 0.2, 0.9, 0.0];
/** Which kind spreads over which where they meet (added to its weight): woods creep out, sand gives way. */
const KIND_BIAS = [0.06, 0.04, 0.03, 0.1, 0.0, -0.02, -0.04, 0.0, 0.0];
/**
 * What a kind's seasonal marks (its layer's ORM alpha) are: flowers, shown
 * by the season's uGFlowers (the pasture's daisies, the meadow's drifts,
 * the scrub's thyme and cistus in bloom), or fresh fallen leaves, turned
 * russet by uGLeaves (the wood's floor in autumn).
 */
const KIND_FLOWER = [1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
const KIND_LEAF = [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0];

const glslFloats = (a) => a.map((v) => v.toFixed(3)).join(', ');

/**
 * Every value noise the ground shader reads, as p * scale + offset (+ the
 * time times a drift), in three batches: what every pixel reads, what snow
 * reads, what water reads. A batch is one loop (gNoises), so the noise's
 * code is in the program three times instead of some forty: ANGLE's D3D
 * compiler spent half the shader's compile (0.6 s of 1.2 on a desktop) on
 * those copies. A fractal noise (gFbm's three octaves) is three entries.
 */
const NOISE_BATCHES = (() => {
  const one = (s, o = 0, t = [0, 0]) => [[s, typeof o === 'number' ? [o, o] : o, t]];
  // gFbm(p * s + o): octaves at x, x * 2.03 + 7.1, x * 4.11 + 3.3.
  const fbm = (s, o = 0) => [[s, [o, o], [0, 0]], [s * 2.03, [o * 2.03 + 7.1, o * 2.03 + 7.1], [0, 0]], [s * 4.11, [o * 4.11 + 3.3, o * 4.11 + 3.3], [0, 0]]];
  return {
    always: {
      wob0: one(0.9), wob1: one(0.9, 19.7), wob2: one(2.9, 3.0), wob3: one(2.9, 41.0), wob4: one(8.1, 7.0), wob5: one(8.1, 13.0),
      macro: fbm(0.11, 4.0), macro2: one(0.43, 9.0), edge: one(23.0), rubble: one(4.0), coast: fbm(2.2),
      puddle: fbm(1.3, 5.0), drift: fbm(1.1, 31.0), sw0: one(3.0), sw1: one(3.0, 7.0),
    },
    snow: { snow: fbm(2.7), snow11: one(11.0), snow6: one(6.0) },
    water: {
      lap: one(2.0), foam0: one(7.0, 0, [0.12, 0.12]), foam1: one(21.0), ice: one(1.5), iceC: one(5.0),
      glint0: one(70.0, 0, [1.4, -0.9]), glint1: one(43.0, 11.0, [-0.8, 1.1]),
    },
  };
})();

/** The batches as GLSL: the entries' table, their names (as gNz[i], or a weighted sum for a fractal noise), the loop's bounds. */
const NOISE_GLSL = (() => {
  const rows = [];
  const names = {};
  const bounds = {};
  for (const [batch, entries] of Object.entries(NOISE_BATCHES)) {
    const from = rows.length;
    for (const [name, list] of Object.entries(entries)) {
      const i = rows.length;
      rows.push(...list);
      names[name] = list.length === 3 ? `( gNz[${i}] * 0.5 + gNz[${i + 1}] * 0.3 + gNz[${i + 2}] * 0.2 )` : `gNz[${i}]`;
    }
    bounds[batch] = [from, rows.length];
  }
  const f = (v) => v.toFixed(5);
  const table = rows.map(([sc, o, t]) => `vec4( ${f(sc)}, ${f(o[0])}, ${f(o[1])}, 0.0 ), vec4( ${f(t[0])}, ${f(t[1])}, 0.0, 0.0 )`);
  const decl = `const vec4 G_NOISE[${rows.length * 2}] = vec4[${rows.length * 2}]( ${table.join(', ')} );
float gNz[${rows.length}];
// Noises from..to of the table at p (each p * scale + offset + time * drift).
void gNoises( vec2 p, int from, int to ) {
  for ( int i = from; i < to + uGZero; i++ ) {
    vec4 a = G_NOISE[i * 2];
    gNz[i] = gNoise( p * a.x + a.yz + uGTime * G_NOISE[i * 2 + 1].xy );
  }
}`;
  return { names, bounds, decl };
})();
const N = NOISE_GLSL.names;
const B = (b) => `gNoises( p, ${NOISE_GLSL.bounds[b][0]}, ${NOISE_GLSL.bounds[b][1]} );`;

const PARS = /* glsl */ `
uniform highp sampler2D uTypes;
uniform highp sampler2D uSites;
uniform highp sampler2DArray uAlb;
uniform highp sampler2DArray uNrm;
uniform highp sampler2DArray uOrm;
uniform vec2 uMapSize;
uniform float uScale[${GROUND_LAYERS.length}];
uniform float uGTime;
// Always 0: a loop bound the compiler cannot know, so it keeps the loop (see the header).
uniform int uGZero;
uniform float uGSnow;
uniform float uGWet;
uniform float uGRain;
uniform vec3 uGVeg;
uniform float uGVegAmt;
uniform float uGDry;
uniform float uGFlowers;
uniform float uGLeaves;
uniform vec3 uGWaterFresh;
uniform vec3 uGWaterSea;
uniform vec3 uGShallow;
uniform float uGSkyRefl;
uniform float uGSun;
uniform vec3 uGSkyColor;
uniform float uLookAOOn;
uniform sampler2D uLookAO;
uniform vec2 uLookRes;
uniform float uLookDirectAO;
uniform vec4 uLookFade;
uniform vec3 uLookFadeColor;
varying vec2 vGroundPos;
varying vec3 vGroundW;
varying vec3 vGroundTx;
varying vec3 vGroundTz;
varying vec3 vGroundUp;

const float K_SNOW[9] = float[9](${glslFloats(KIND_SNOW)});
const float K_SEASON[9] = float[9](${glslFloats(KIND_SEASON)});
const float K_SOAK[9] = float[9](${glslFloats(KIND_SOAK)});
const float K_PUDDLE[9] = float[9](${glslFloats(KIND_PUDDLE)});
const float K_BIAS[9] = float[9](${glslFloats(KIND_BIAS)});
const float K_FLOWER[9] = float[9](${glslFloats(KIND_FLOWER)});
const float K_LEAF[9] = float[9](${glslFloats(KIND_LEAF)});
const bool K_ANTI[${GROUND_LAYERS.length}] = bool[${GROUND_LAYERS.length}](${GROUND_LAYERS.map((l) => String(!!l.anti)).join(', ')});

float gHash( vec2 p ) {
  vec3 q = fract( vec3( p.xyx ) * 0.1031 );
  q += dot( q, q.yzx + 33.33 );
  return fract( ( q.x + q.y ) * q.z );
}
float gNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( gHash( i ), gHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( gHash( i + vec2( 0.0, 1.0 ) ), gHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
${NOISE_GLSL.decl}
vec4 gType( ivec2 t ) {
  ivec2 s = ivec2( uMapSize ) - 1;
  return texelFetch( uTypes, clamp( t, ivec2( 0 ), s ), 0 ) * 255.0;
}
// The site map's bytes of tile t (groundMap.js siteWord).
vec4 gSite( ivec2 t ) {
  ivec2 s = ivec2( uMapSize ) - 1;
  return texelFetch( uSites, clamp( t, ivec2( 0 ), s ), 0 ) * 255.0;
}
// A point of a building's footprint (map axes, tiles from its corner) in its art's own (u, v): the
// art is drawn at turn 0 and turned by render/turn.js turnUV; this turns back.
vec2 gArt( vec2 m, float S, int t ) {
  if ( t == 1 ) return vec2( m.y, S - m.x );
  if ( t == 2 ) return vec2( S - m.x, S - m.y );
  if ( t == 3 ) return vec2( S - m.y, m.x );
  return m;
}
float gLum( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
#ifdef GROUND_OWN_OUTPUT
// ACES filmic (Stephen Hill's fit of the RRT and ODT, as three.js tone maps)
// and the sRGB curve, done here when the ground is drawn into a texture (the
// Low quality's cached picture), where three applies neither.
vec3 gAces( vec3 c ) {
  const mat3 IN = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
  const mat3 OUT = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
  c = IN * ( c / 0.6 );
  vec3 a = c * ( c + 0.0245786 ) - 0.000090537;
  vec3 b = c * ( 0.983729 * c + 0.4329510 ) + 0.238081;
  return clamp( OUT * ( a / b ), 0.0, 1.0 );
}
vec3 gSrgb( vec3 c ) {
  return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) );
}
#endif

// A layer's sample: albedo (rgb) and height (a), normal (tangent space, xy), ORM (occlusion,
// roughness, plants) and in its alpha the layer's marks (dec: flowers, leaves, ears, embers).
struct GSmp { vec4 alb; vec3 n; vec4 orm; };

vec2 gDx; vec2 gDy;

// One tap of layer L at uv turned by M and moved by o (its derivatives and normal turned with it).
GSmp gTap( float L, vec2 uv, vec2 dx, vec2 dy, mat2 M, vec2 o ) {
  vec2 u = M * uv + o;
  GSmp s;
  s.alb = textureGrad( uAlb, vec3( u, L ), M * dx, M * dy );
  s.n = textureGrad( uNrm, vec3( u, L ), M * dx, M * dy ).xyz * 2.0 - 1.0;
  s.n.xy = s.n.xy * M; // back into the ground's frame
  s.orm = textureGrad( uOrm, vec3( u, L ), M * dx, M * dy );
  return s;
}

// Layer k at point p (tiles, already scaled by s; swp: the point's x and y swapped, as a field
// turned a quarter reads its rows): derivatives follow the point, so mipmaps stay right.
// One of the three hex tiling taps: the texture turned and moved by the hash of grid vertex v.
GSmp gHexTap( float L, vec2 uv, vec2 dx, vec2 dy, vec2 v ) {
  float a = gHash( v + L * 17.31 ) * 6.2831853;
  vec2 o = vec2( gHash( v * 1.7 + 3.1 + L ), gHash( v * 2.3 + 7.7 + L ) ) * 4.0;
  float c = cos( a );
  float sn = sin( a );
  return gTap( L, uv, dx, dy, mat2( c, sn, -sn, c ), o );
}

GSmp gSample( int k, vec2 p, float s, bool swp ) {
  float sc = uScale[ k ];
  vec2 uv = p * sc;
  vec2 dx = ( swp ? gDx.yx : gDx ) * sc * s;
  vec2 dy = ( swp ? gDy.yx : gDy ) * sc * s;
  float L = float( k );
#ifdef GROUND_HIGH
  // Hex tiling (after Mikkelsen's "Practical Real-Time Hex-Tiling"): the
  // plane is cut into a triangle grid about half a repeat across; each
  // corner takes the texture turned and moved its own way, and a pixel
  // blends its triangle's three by how near it is to each, the higher
  // texture winning where they meet. A repeat never lines up, so a field
  // shows no lattice however wide (in the game's view a plain repeat lines
  // up in columns down the screen). Not for patterns laid square to the
  // map: furrows, a field's rows, paving, flagstones.
  if ( K_ANTI[ k ] ) {
    vec2 sk = mat2( 1.0, 0.0, -0.57735027, 1.15470054 ) * uv * 1.9;
    vec2 base = floor( sk );
    vec3 t = vec3( sk - base, 0.0 );
    t.z = 1.0 - t.x - t.y;
    float sg = step( 0.0, -t.z );
    float s2 = 2.0 * sg - 1.0;
    vec3 w = vec3( -t.z * s2, sg - t.y * s2, sg - t.x * s2 );
    GSmp A = gHexTap( L, uv, dx, dy, base + vec2( sg, sg ) );
    GSmp B = gHexTap( L, uv, dx, dy, base + vec2( sg, 1.0 - sg ) );
    GSmp C = gHexTap( L, uv, dx, dy, base + vec2( 1.0 - sg, sg ) );
    vec3 wh = pow( w, vec3( 5.0 ) ) * ( 0.15 + vec3( A.alb.a, B.alb.a, C.alb.a ) );
    wh /= max( wh.x + wh.y + wh.z, 1e-5 );
    GSmp r;
    r.alb = A.alb * wh.x + B.alb * wh.y + C.alb * wh.z;
    r.n = A.n * wh.x + B.n * wh.y + C.n * wh.z;
    r.orm = A.orm * wh.x + B.orm * wh.y + C.orm * wh.z;
    return r;
  }
#endif
  return gTap( L, uv, dx, dy, mat2( 1.0 ), vec2( 0.0 ) );
}

// The road's shape in its tile (q in 0..1): a centre square inset by a from
// the edges, and an arm out to each linked side; rounded corners. < 0 inside.
float gRect( vec2 q, vec2 lo, vec2 hi, float r ) {
  vec2 c = ( lo + hi ) * 0.5;
  vec2 h = ( hi - lo ) * 0.5 - r;
  vec2 d = abs( q - c ) - h;
  return length( max( d, 0.0 ) ) + min( max( d.x, d.y ), 0.0 ) - r;
}
float gSmin( float a, float b, float k ) {
  float h = clamp( 0.5 + 0.5 * ( b - a ) / k, 0.0, 1.0 );
  return mix( b, a, h ) - k * h * ( 1.0 - h );
}
float gRoad( vec2 q, int links, float a ) {
  float r = 0.07;
  float d = gRect( q, vec2( a ), vec2( 1.0 - a ), r );
  if ( ( links & 1 ) != 0 ) d = gSmin( d, gRect( q, vec2( a, -1.0 ), vec2( 1.0 - a, 0.5 ), r ), 0.08 );
  if ( ( links & 2 ) != 0 ) d = gSmin( d, gRect( q, vec2( 0.5, a ), vec2( 2.0, 1.0 - a ), r ), 0.08 );
  if ( ( links & 4 ) != 0 ) d = gSmin( d, gRect( q, vec2( a, 0.5 ), vec2( 1.0 - a, 2.0 ), r ), 0.08 );
  if ( ( links & 8 ) != 0 ) d = gSmin( d, gRect( q, vec2( -1.0, a ), vec2( 0.5, 1.0 - a ), r ), 0.08 );
  return d;
}

// What the surface came to: written by groundSurface(), read by the lighting chunks.
vec3 gAlbedo; float gRough; float gAO; vec3 gN; float gWater; float gSpecBoost; vec3 gGlint; float gPuddle;

void groundSurface() {
  vec2 p = vGroundPos;
  gDx = dFdx( p );
  gDy = dFdy( p );
  float px = length( gDx ) + length( gDy ); // tiles per pixel: details finer than this fade out

  ${B('always')}

  // --- 1. kinds ---------------------------------------------------------
  vec2 wob = ( vec2( ${N.wob0}, ${N.wob1} ) - 0.5 ) * 0.56
           + ( vec2( ${N.wob2}, ${N.wob3} ) - 0.5 ) * 0.3
           + ( vec2( ${N.wob4}, ${N.wob5} ) - 0.5 ) * 0.14;
  vec2 pw = p + wob - 0.5;
  ivec2 i0 = ivec2( floor( pw ) );
  vec2 f = pw - floor( pw );
  vec4 T0 = gType( i0 );
  vec4 T1 = gType( i0 + ivec2( 1, 0 ) );
  vec4 T2 = gType( i0 + ivec2( 0, 1 ) );
  vec4 T3 = gType( i0 + ivec2( 1, 1 ) );
  int k[4];
  float w[4];
  k[0] = int( T0.r + 0.5 ); k[1] = int( T1.r + 0.5 ); k[2] = int( T2.r + 0.5 ); k[3] = int( T3.r + 0.5 );
  w[0] = ( 1.0 - f.x ) * ( 1.0 - f.y ); w[1] = f.x * ( 1.0 - f.y ); w[2] = ( 1.0 - f.x ) * f.y; w[3] = f.x * f.y;
  // Sea beds are sand, river and lake beds silt.
  vec4 TA[4] = vec4[4]( T0, T1, T2, T3 );
  int lay[4];
  for ( int a = 0; a < 4; a++ ) {
    lay[a] = k[a];
    if ( k[a] == ${KIND.BED} && ( int( TA[a].a + 0.5 ) & 3 ) == 2 ) lay[a] = ${LAYER.beach};
  }
  for ( int a = 0; a < 4; a++ ) for ( int b = a + 1; b < 4; b++ ) if ( w[b] > 0.0 && lay[b] == lay[a] ) { w[a] += w[b]; w[b] = 0.0; }

  // --- every texture sample the pixel needs, planned, then taken in one loop ---
  // ANGLE inlines every call of a function: gSample written out at each place
  // that reads a layer was a dozen copies of the hex tiling, and the shader's
  // compile went from 0.8 s to 2.5 s on ANGLE's D3D11. So each place says
  // what it needs (a layer, a point, its scale, turned a quarter or not) in
  // its slot: 0-3 the kinds, 4-5 the site, 6-8 the road (its surface, the
  // kerb's stone, the margin's gravel), 9 rubble; and one loop whose bound
  // the compiler cannot see takes them all (1.3 s). Inside gSample the three
  // hex taps are written out, not looped: arrays indexed by a loop's counter
  // there cost the D3D compiler another 1.8 s.
  ivec2 ti = ivec2( floor( p ) );
  vec4 own = gType( ti );
  vec2 q = p - floor( p );
  vec4 st = gSite( ti );
  int site = int( st.r + 0.5 );
  int sa = int( st.a + 0.5 );
  int turn = sa >> 6;
  bool swp = ( turn & 1 ) == 1;
  // A field's rows and furrows run along the art's u: the map's x, or its y when turned a quarter.
  vec2 pr = swp ? p.yx : p;
  int g = int( own.g + 0.5 );
  int links = g & 15;
  int surf = ( g >> 4 ) & 3;
  bool bridge = ( g & 128 ) != 0;
  // Rubble, read between tile middles like the kinds (so a fallen block's rubble is one heap), and
  // how much of it a fire left, and is burning.
  float rubR = 0.0, rubB = 0.0, rubF = 0.0;
  {
    vec4 TR[4] = vec4[4]( T0, T1, T2, T3 );
    float wr[4] = float[4]( ( 1.0 - f.x ) * ( 1.0 - f.y ), f.x * ( 1.0 - f.y ), ( 1.0 - f.x ) * f.y, f.x * f.y );
    for ( int a = 0; a < 4; a++ ) {
      if ( ( int( TR[a].g + 0.5 ) & 64 ) != 0 ) rubR += wr[a];
      int aa = int( TR[a].a + 0.5 );
      if ( ( aa & 8 ) != 0 ) rubB += wr[a];
      if ( ( aa & 16 ) != 0 ) rubF += wr[a];
    }
  }
  int RQ[10];
  vec2 RP[10];
  float RS[10];
  bool RW[10];
  for ( int i = 0; i < 10; i++ ) { RQ[i] = -1; RP[i] = p; RS[i] = 1.0; RW[i] = false; }
  for ( int a = 0; a < 4; a++ ) if ( w[a] > 0.0 ) RQ[a] = lay[a];
  if ( site == ${SITE.YARD} || site == ${SITE.FOOTING} || site == ${SITE.PADDOCK} ) RQ[4] = ${LAYER.yard};
  else if ( site == ${SITE.PEN} ) { RQ[4] = ${LAYER.mud}; RQ[5] = ${LAYER.yard}; }
  else if ( site != 0 ) {
    // (Trees and vines stand in grass hoed round them: no ploughed soil to read.)
    if ( site != ${SITE.ORCHARD} && site != ${SITE.OLIVE} && site != ${SITE.VINES} ) { RQ[4] = ${LAYER.soil}; RP[4] = pr; RW[4] = swp; }
    if ( site == ${SITE.GRAIN} || site == ${SITE.VEG} || site == ${SITE.FLAX} ) {
      RQ[5] = site == ${SITE.GRAIN} ? ${LAYER.grain} : site == ${SITE.VEG} ? ${LAYER.veg} : ${LAYER.flax};
      RP[5] = pr; RW[5] = swp;
    } else if ( site == ${SITE.ORCHARD} || site == ${SITE.OLIVE} || site == ${SITE.VINES} ) {
      RQ[5] = ${LAYER.yard}; RP[5] = p * 1.3; RS[5] = 1.3;
    }
  }
  if ( surf != 0 && !bridge ) {
    RQ[6] = surf == 1 ? ${LAYER.gravel} : surf == 2 ? ${LAYER.basalt} : ${LAYER.flags};
    if ( surf == 2 ) { RQ[7] = ${LAYER.flags}; RP[7] = p * 2.3; RS[7] = 2.3; RQ[8] = ${LAYER.gravel}; }
  }
  bool ashy = rubB > rubR * 0.5;
  if ( rubR > 0.0 ) RQ[9] = ashy ? ${LAYER.ash} : ${LAYER.rubble};
  GSmp SM[10];
  for ( int i = 0; i < 10 + uGZero; i++ ) {
    if ( RQ[i] < 0 ) { SM[i] = GSmp( vec4( 0.0 ), vec3( 0.0, 0.0, 1.0 ), vec4( 1.0 ) ); continue; }
    SM[i] = gSample( RQ[i], RP[i], RS[i], RW[i] );
  }

  float score[4];
  float best = -1e3;
  for ( int a = 0; a < 4; a++ ) {
    score[a] = -1e3;
    if ( w[a] <= 0.0 ) continue;
    score[a] = w[a] + ( SM[a].alb.a - 0.5 ) * 0.55 + K_BIAS[ k[a] ];
    best = max( best, score[a] );
  }
  vec4 alb = vec4( 0.0 );
  vec3 nrm = vec3( 0.0 );
  vec3 orm = vec3( 0.0 );
  float snowHold = 0.0, season = 0.0, soak = 0.0, puddle = 0.0, wsum = 0.0, decF = 0.0, decL = 0.0;
  for ( int a = 0; a < 4; a++ ) {
    if ( score[a] < -1e2 ) continue;
    float ww = max( score[a] - best + 0.2, 0.0 );
    ww *= ww;
    if ( ww <= 0.0 ) continue;
    alb += SM[a].alb * ww;
    nrm += SM[a].n * ww;
    orm += SM[a].orm.xyz * ww;
    decF += SM[a].orm.a * K_FLOWER[ k[a] ] * ww;
    decL += SM[a].orm.a * K_LEAF[ k[a] ] * ww;
    snowHold += K_SNOW[ k[a] ] * ww;
    season += K_SEASON[ k[a] ] * ww;
    soak += K_SOAK[ k[a] ] * ww;
    puddle += K_PUDDLE[ k[a] ] * ww;
    wsum += ww;
  }
  float iw = 1.0 / max( wsum, 1e-5 );
  alb *= iw; nrm *= iw; orm *= iw; snowHold *= iw; season *= iw; soak *= iw; puddle *= iw; decF *= iw; decL *= iw;
  vec3 col = alb.rgb;
  float h = alb.a;
  float ao = orm.r;
  float rough = orm.g;
  float plants = orm.b * season;

  // Large soft variation across a field: tone, and patches drier or lusher.
  float macro = ${N.macro};
  float macro2 = ${N.macro2};
  col *= 0.88 + 0.24 * macro;
  // The season: living things take its colour (the soil between them keeps its own).
  {
    float l = gLum( col );
    vec3 tinted = l * uGVeg / max( gLum( uGVeg ), 1e-3 );
    float dry = clamp( uGDry + ( macro2 - 0.5 ) * 0.5, 0.0, 1.0 );
    vec3 straw = l * vec3( 1.25, 1.08, 0.62 ) * 1.05;
    vec3 v = mix( col, tinted, uGVegAmt );
    v = mix( v, straw, dry * 0.75 );
    col = mix( col, v, plants );
    // Flowers out of their season are only more of the green round them; fresh leaves on a
    // wood's floor turn russet and gold in autumn, then brown into the litter.
    if ( decF > 0.0 ) col = mix( col, uGVeg * ( 0.1 / max( gLum( uGVeg ), 1e-3 ) ) * mix( 1.0, 0.75 + 0.5 * h, 0.5 ), decF * ( 1.0 - uGFlowers ) );
    if ( decL > 0.0 ) col = mix( col, mix( vec3( 0.42, 0.13, 0.03 ), vec3( 0.55, 0.32, 0.05 ), macro2 ) * ( 0.7 + 0.5 * h ), decL * uGLeaves );
  }

  // How much of the surface's high relief stays clear of snow (a field's ridges, rubble's lumps:
  // under deep snow they still show where they are), and where a fire melts it.
  float poke = 0.0;
  float melt = 0.0;
  // --- 2b. sites: what people made of the tile (groundMap.js SITE) -------
  // From the pixel's own tile, unbent: a field, a yard, a pen is a plot with
  // a clean edge where the site ends (its links say where it carries on into
  // the same building's), the natural ground round it.
  {
    if ( site != 0 ) {
      int sb = int( st.b + 0.5 );
      int sl = sb & 15;
      float growth = st.g / 255.0;
      bool resting = ( sb & 16 ) != 0;
      bool idle = ( sb & 32 ) != 0;
      float SZ = float( ( sb >> 6 ) + 1 );
      // Where the pixel lies in the building's art (render/buildingArt.js draws at turn 0).
      vec2 art = gArt( vec2( float( sa & 7 ), float( ( sa >> 3 ) & 7 ) ) + q, SZ, turn );
      float inset = site == ${SITE.YARD} ? 0.012 : site == ${SITE.FOOTING} ? 0.08 : 0.03;
      vec2 lo = vec2( ( sl & 8 ) != 0 ? -1.0 : inset, ( sl & 1 ) != 0 ? -1.0 : inset );
      vec2 hi = vec2( ( sl & 2 ) != 0 ? 2.0 : 1.0 - inset, ( sl & 4 ) != 0 ? 2.0 : 1.0 - inset );
      float sd = gRect( q, lo, hi, 0.02 );
      float edgeN = ( ${N.edge} - 0.5 );
      // The site's own surface.
      vec3 sc = col;
      float sh = h;
      vec3 sn = nrm;
      float sr = rough;
      float sao = ao;
      float sp = plants;
      float sHold = snowHold, sSoak = soak, sPud = puddle;
      if ( site == ${SITE.YARD} || site == ${SITE.FOOTING} || site == ${SITE.PADDOCK} ) {
        GSmp Y = SM[4];
        // A wall's or an aqueduct's footing and a paddock are trodden ground: the grass worn through in patches.
        float k = site == ${SITE.YARD} ? 1.0 : smoothstep( 0.4, 0.7, ${N.rubble} * 0.6 + ( 1.0 - h ) * 0.5 + ( site == ${SITE.FOOTING} ? 0.12 : -0.12 ) );
        // (A paddock's grass is cropped short and paler: inside the plot only, or its margin steps.)
        vec3 grass = site == ${SITE.PADDOCK} ? mix( col, gLum( col ) * vec3( 1.15, 1.1, 0.75 ) * 1.1, 0.3 ) : col;
        sc = mix( grass, Y.alb.rgb, k );
        sh = mix( h, Y.alb.a, k );
        sn = mix( nrm, Y.n, k );
        sr = mix( rough, Y.orm.g, k );
        sao = mix( ao, Y.orm.r, k );
        sp = mix( plants * 0.6, Y.orm.b, k );
        // (Trodden ground: the snow is walked thin.)
        sHold = mix( snowHold, site == ${SITE.YARD} ? 0.3 : 0.7, k ); sSoak = mix( soak, 0.6, k ); sPud = mix( puddle, 0.55, k );
      } else if ( site == ${SITE.PEN} ) {
        // Inside the fence (the art's u 1 to S - 0.12, v 0.15 to S - 0.12) the pigs have churned it to mud.
        GSmp M = SM[4];
        GSmp Y = SM[5];
        vec2 e = min( art - vec2( 1.0, 0.15 ), vec2( SZ - 0.12 ) - art );
        float inPen = smoothstep( -0.02, 0.06, min( e.x, e.y ) + ( M.alb.a - 0.5 ) * 0.06 );
        sc = mix( Y.alb.rgb, M.alb.rgb, inPen );
        sh = mix( Y.alb.a, M.alb.a, inPen );
        sn = mix( Y.n, M.n, inPen );
        sr = mix( Y.orm.g, M.orm.g, inPen );
        sao = mix( Y.orm.r, M.orm.r, inPen );
        sp = Y.orm.b * ( 1.0 - inPen );
        sHold = 0.6; sSoak = 1.0; sPud = mix( 0.6, 1.0, inPen );
      } else {
        // Fields: ploughed earth, its furrows along the rows.
        GSmp Sl = SM[4];
        vec3 fc = Sl.alb.rgb;
        float fh = Sl.alb.a;
        vec3 fn = Sl.n;
        if ( ( turn & 1 ) == 1 ) fn.xy = fn.yx;
        float fr = Sl.orm.g;
        float fao = Sl.orm.r;
        float fp = 0.0;
        if ( resting ) fc = mix( fc, fc * vec3( 1.12, 1.06, 0.98 ), 0.6 ); // dry and pale in the winter's rest
        if ( site == ${SITE.GRAIN} || site == ${SITE.VEG} || site == ${SITE.FLAX} ) {
          GSmp C = SM[5];
          vec3 cn = C.n;
          if ( ( turn & 1 ) == 1 ) cn.xy = cn.yx;
          // As much of the crop as has grown: the rows' middles first (the layer's height), all of it when grown.
          float g2 = resting ? min( growth, 0.35 ) : growth;
          float thr = 1.0 - g2 * 1.08;
          float cov = smoothstep( thr - 0.05, thr + 0.1, C.alb.a ) * C.orm.b * step( 0.015, g2 );
          vec3 cc = C.alb.rgb;
          // Young shoots are a brighter, yellower green; then the crop's own; then it ripens.
          cc *= mix( vec3( 1.2, 1.18, 0.7 ), vec3( 1.0 ), smoothstep( 0.12, 0.5, g2 ) );
          float cl2 = gLum( cc );
          if ( site == ${SITE.GRAIN} ) {
            // Wheat goes gold, the ears before the blades.
            float ripe = max( smoothstep( 0.62, 0.95, g2 ), smoothstep( 0.45, 0.8, g2 ) * C.orm.a );
            cc = mix( cc, vec3( 0.36, 0.22, 0.055 ) * clamp( cl2 / 0.12, 0.6, 1.25 ), ripe );
          } else if ( site == ${SITE.FLAX} ) {
            // In flower from half grown, sky blue; then the bolls ripen golden brown.
            float bloom = smoothstep( 0.4, 0.5, g2 ) * smoothstep( 0.9, 0.78, g2 );
            vec3 green = cc;
            if ( C.orm.a > 0.0 ) green = mix( cc, vec3( 0.09, 0.14, 0.04 ), C.orm.a );
            cc = mix( green, cc, bloom );
            cc = mix( cc, vec3( 0.25, 0.16, 0.06 ) * clamp( cl2 / 0.12, 0.6, 1.25 ), smoothstep( 0.8, 0.98, g2 ) );
          } else {
            // Vegetables: green to the end; what is ready shows at the last.
            if ( C.orm.a > 0.0 ) cc = mix( cc, cc * 0.0 + vec3( 0.07, 0.12, 0.04 ), C.orm.a * smoothstep( 0.8, 0.7, g2 ) );
          }
          if ( resting ) cc = mix( cc, vec3( 0.22, 0.17, 0.09 ) * clamp( cl2 / 0.12, 0.6, 1.25 ), 0.85 ); // the stubble of the winter
          fc = mix( fc, cc, cov );
          fh = mix( fh, C.alb.a, cov );
          fn = mix( fn, cn, cov );
          fr = mix( fr, C.orm.g, cov );
          fao = mix( fao, C.orm.r, cov );
        } else if ( site == ${SITE.ORCHARD} || site == ${SITE.OLIVE} || site == ${SITE.VINES} ) {
          // Trees and vines stand in grass (the sprite draws them); the earth is worked round each tree
          // and along each row of vines, where the sprite stands them.
          float worked = 0.0;
          if ( site == ${SITE.VINES} ) {
            float rv = ( art.y - 0.3 ) / 0.48;
            float dv = abs( rv - clamp( floor( rv + 0.5 ), 0.0, 5.0 ) ) * 0.48;
            worked = smoothstep( 0.12, 0.08, dv + ( h - 0.5 ) * 0.03 + edgeN * 0.03 ) * step( 0.95, art.x ) * step( art.x, SZ - 0.08 );
          } else {
            vec2 cell = ( art - vec2( 1.2, 0.45 ) ) / vec2( 0.62, 0.95 );
            vec2 nearest = clamp( floor( cell + 0.5 ), vec2( 0.0 ), vec2( 2.0 ) );
            vec2 tree = vec2( 1.2, 0.45 ) + nearest * vec2( 0.62, 0.95 );
            worked = smoothstep( 0.2, 0.15, length( art - tree ) + ( h - 0.5 ) * 0.05 + edgeN * 0.06 + ( ${N.rubble} - 0.5 ) * 0.06 );
          }
          vec3 sward = col;
          if ( site == ${SITE.OLIVE} ) sward = mix( col, gLum( col ) * vec3( 1.3, 1.15, 0.7 ), 0.35 ); // an olive grove's dry grass
          // Hoed, not ploughed: loose dark earth, no furrows.
          GSmp Hd = SM[5];
          vec3 hoed = Hd.alb.rgb * vec3( 0.72, 0.66, 0.6 );
          fc = mix( sward, hoed, worked );
          fh = mix( h, Hd.alb.a * 0.8, worked );
          fn = mix( nrm, Hd.n, worked );
          fr = mix( rough, 0.95, worked );
          fao = mix( ao, Hd.orm.r, worked );
          fp = plants * ( 1.0 - worked );
        }
        // Left idle, a field goes to weeds from its edges and in patches.
        if ( idle && site != ${SITE.ORCHARD} && site != ${SITE.OLIVE} && site != ${SITE.VINES} ) {
          float wd = smoothstep( 0.45, 0.6, ${N.macro2} * 0.6 + ${N.rubble} * 0.4 + ( h - fh ) * 0.4 );
          fc = mix( fc, col, wd );
          fh = mix( fh, h, wd );
          fn = mix( fn, nrm, wd );
          fp = mix( fp, plants, wd );
        }
        sc = fc; sh = fh; sn = fn; sr = fr; sao = fao; sp = fp;
        sHold = 0.95; sSoak = 0.85; sPud = 0.9;
        if ( site != ${SITE.ORCHARD} && site != ${SITE.OLIVE} && site != ${SITE.VINES} ) poke = 0.75; // (times the edge's cover, below)
      }
      // The edge: straight and clean (a yard's a little softer, grass tufts lean over it; a
      // footing's wanders, worn rather than laid out).
      float cover;
      if ( site == ${SITE.FOOTING} ) cover = smoothstep( 0.1, -0.1, sd + edgeN * 0.12 );
      else if ( site == ${SITE.YARD} ) cover = smoothstep( -0.008, 0.008, -sd - edgeN * 0.012 + ( sh - h ) * 0.02 );
      else cover = smoothstep( -0.004, 0.004, -sd );
      // A field's headland: the plough turns there, the crop thins and the earth rises a little.
      if ( site >= ${SITE.SOIL} && site != ${SITE.PEN} && site != ${SITE.PADDOCK} ) {
        float head = smoothstep( -0.05, -0.01, sd );
        sh = mix( sh, sh * 0.6 + 0.4, head * 0.5 );
        sao = mix( sao, sao * 0.85, smoothstep( -0.012, 0.0, sd ) );
      }
      poke *= cover;
      col = mix( col, sc, cover );
      h = mix( h, sh, cover );
      nrm = mix( nrm, sn, cover );
      rough = mix( rough, sr, cover );
      ao = mix( ao, sao, cover );
      plants = mix( plants, sp, cover );
      snowHold = mix( snowHold, sHold, cover );
      soak = mix( soak, sSoak, cover );
      puddle = mix( puddle, sPud, cover );
    }
  }

  // --- 3. roads, plazas, rubble -----------------------------------------
  float wear = 0.0;
  float snowRoad = 1.0;
  if ( surf != 0 && !bridge ) {
    float inset = surf == 3 ? 0.0 : surf == 2 ? 0.04 : 0.12;
    float sd = gRoad( q, surf == 3 ? 15 : links, inset );
    if ( surf == 3 ) sd = gRect( q, vec2( ( links & 8 ) != 0 ? -1.0 : 0.03 , ( links & 1 ) != 0 ? -1.0 : 0.03 ), vec2( ( links & 2 ) != 0 ? 2.0 : 0.97, ( links & 4 ) != 0 ? 2.0 : 0.97 ), 0.04 );
    float edgeN = ( ${N.edge} - 0.5 ) * 0.025;
    // The road's own surface.
    GSmp R = SM[6];
    vec3 rc = R.alb.rgb;
    float rr = R.orm.g;
    float rh = R.alb.a;
    vec3 rn = R.n;
    float rao = R.orm.r;
    if ( surf == 1 ) {
      rc = mix( rc, rc * vec3( 0.86, 0.84, 0.8 ), smoothstep( -0.02, 0.0, sd + 0.04 ) * 0.5 );
    } else if ( surf == 2 ) {
      // Kerbs of pale limestone blocks along the paving, a gravel margin outside them.
      float kerb = smoothstep( -0.07, -0.065, sd ) * smoothstep( -0.015, -0.02, sd );
      float margin = smoothstep( -0.02, -0.015, sd );
      if ( kerb > 0.0 || margin > 0.0 ) {
        GSmp K = SM[7];
        GSmp G = SM[8];
        // Kerb blocks: about half a metre long, joints across the kerb.
        float along = links == 5 || ( links & 10 ) == 0 ? p.y : p.x;
        float joint = smoothstep( 0.0, 0.012, abs( fract( along * 8.0 + gHash( floor( p * 8.0 ) ) * 0.3 ) - 0.5 ) - 0.47 );
        vec3 kc = mix( K.alb.rgb * vec3( 1.02, 1.0, 0.95 ), vec3( 0.25, 0.22, 0.18 ), joint );
        rc = mix( rc, kc, kerb );
        rh = mix( rh, 0.9, kerb );
        rr = mix( rr, 0.8, kerb );
        rn = mix( rn, K.n, kerb );
        rc = mix( rc, G.alb.rgb, margin );
        rh = mix( rh, G.alb.a, margin );
        rn = mix( rn, G.n, margin );
      }
    }
    // Edges: where the ground is higher than the road, its tufts cover the road's edge.
    float cover = smoothstep( -0.012, 0.012, -sd - edgeN + ( rh - h ) * 0.03 );
    if ( surf == 3 ) cover = smoothstep( -0.006, 0.006, -sd - edgeN * 0.3 );
    // A worn verge: trodden, plants thinned, beside the road.
    wear = smoothstep( 0.1, 0.0, sd ) * ( 1.0 - cover );
    col = mix( col, rc, cover );
    h = mix( h, rh, cover );
    rough = mix( rough, rr, cover );
    nrm = mix( nrm, rn, cover );
    ao = mix( ao, rao, cover );
    plants *= 1.0 - cover;
    // Roads and plazas are kept clear (as the 2D art keeps them): snow only in patches, trodden grey.
    snowHold = mix( snowHold, surf == 3 ? 0.22 : 0.16, cover );
    puddle = mix( puddle, surf == 1 ? 0.8 : 0.35, cover );
    soak = mix( soak, surf == 1 ? 0.7 : 0.35, cover );
    snowRoad = 1.0 - cover;
  }
  if ( wear > 0.0 ) {
    float l = gLum( col );
    col = mix( col, mix( vec3( l ), col, 0.6 ) * vec3( 1.08, 1.0, 0.9 ), wear * 0.5 );
    plants *= 1.0 - wear * 0.6;
  }
  // Rubble: read between tile middles like the kinds, so a fallen block's rubble is one heap. A
  // burned building's is ash and charred timber, the ground round it scorched (a wandering edge,
  // as fire leaves it), its embers glowing while it still burns.
  float embers = 0.0;
  {
    float r = rubR;
    float bw = rubB;
    float fw = rubF;
    if ( bw > 0.0 ) {
      float scorch = smoothstep( 0.0, 0.45, bw + ( ${N.rubble} - 0.5 ) * 0.35 + ( h - 0.5 ) * 0.2 );
      col = mix( col, col * vec3( 0.3, 0.28, 0.26 ) + vec3( 0.012, 0.011, 0.01 ), scorch * 0.85 );
      plants *= 1.0 - scorch;
      rough = mix( rough, 0.95, scorch );
    }
    if ( r > 0.0 ) {
      bool ash = ashy;
      GSmp B = SM[9];
      float rm = smoothstep( 0.35, 0.55, r * 0.85 + ( B.alb.a - 0.5 ) * 0.5 + ( ${N.rubble} - 0.5 ) * 0.25 );
      col = mix( col, B.alb.rgb, rm );
      h = mix( h, B.alb.a, rm );
      nrm = mix( nrm, B.n, rm );
      rough = mix( rough, B.orm.g, rm );
      ao = mix( ao, B.orm.r, rm );
      plants *= 1.0 - rm;
      if ( ash && fw > 0.0 ) embers = B.orm.a * rm * smoothstep( 0.2, 0.6, fw );
      poke = max( poke, rm * 0.85 );
    }
    if ( fw > 0.0 ) {
      melt = smoothstep( 0.0, 0.5, fw + ( ${N.rubble} - 0.5 ) * 0.3 );
    }
  }

  // --- 4. water ---------------------------------------------------------
  // The shore distance between the four tile middles round the (unbent) point.
  vec2 ps = p - 0.5;
  ivec2 j0 = ivec2( floor( ps ) );
  vec2 fs = ps - floor( ps );
  vec4 U0 = gType( j0 ), U1 = gType( j0 + ivec2( 1, 0 ) ), U2 = gType( j0 + ivec2( 0, 1 ) ), U3 = gType( j0 + ivec2( 1, 1 ) );
  float d = mix( mix( U0.b, U1.b, fs.x ), mix( U2.b, U3.b, fs.x ), fs.y ) / 16.0 - 8.0;
  float seaW = mix( mix( float( ( int( U0.a + 0.5 ) & 3 ) == 2 ), float( ( int( U1.a + 0.5 ) & 3 ) == 2 ), fs.x ),
                    mix( float( ( int( U2.a + 0.5 ) & 3 ) == 2 ), float( ( int( U3.a + 0.5 ) & 3 ) == 2 ), fs.x ), fs.y );
  float coastN = ( ${N.coast} - 0.5 ) * 0.22;
  float dc = d + coastN;
  gWater = smoothstep( 0.03, -0.03, dc );
  // A wet band on the land, wider on sand.
  float wetBand = smoothstep( 0.3, 0.0, dc ) * ( 1.0 - gWater );
  float snowAmt = 0.0;
  float waterSnow = 0.0;

  // --- 5. snow and rain on the land -------------------------------------
  {
    float cover = uGSnow * snowHold;
    if ( cover > 0.0 ) {
      // Where it lies: first on the bumps and in drifts (noise), then everywhere;
      // thin at first (the ground shows through), then deep.
      ${B('snow')}
      float n = ${N.snow} * 0.55 + ${N.snow11} * 0.15 + h * 0.3;
      float lo = mix( 0.72, -0.15, clamp( uGSnow, 0.0, 1.0 ) );
      snowAmt = smoothstep( lo, lo + 0.2, n ) * clamp( cover * 2.6, 0.0, 1.0 );
      snowAmt *= mix( 1.0, 0.6 + 0.4 * smoothstep( 0.4, 0.7, ${N.snow6} ), 1.0 - snowRoad );
      // Ridges and lumps break through; what burns melts it round itself.
      snowAmt *= 1.0 - poke * smoothstep( 0.55, 0.85, h );
      snowAmt *= 1.0 - melt;
    }
    float wet = max( max( uGWet * soak, wetBand * 0.9 ), melt * uGSnow ) * ( 1.0 - snowAmt ); // (meltwater round a fire in the snow)
    col *= 1.0 - wet * 0.42;
    rough = mix( rough, rough * 0.45, wet );
    // Puddles in hollows after rain: still water over the ground.
    float pd = smoothstep( 0.42, 0.34, h + ( ${N.puddle} - 0.5 ) * 0.9 - uGWet * 0.12 ) * uGWet * uGWet * puddle * ( 1.0 - snowAmt );
#ifdef GROUND_HIGH
    gPuddle = pd;
    if ( pd > 0.01 ) {
      col = mix( col, col * 0.3 + vec3( 0.01, 0.012, 0.014 ), pd );
      rough = mix( rough, 0.04, pd );
      nrm = mix( nrm, vec3( 0.0, 0.0, 1.0 ), pd );
      // Rings where drops fall (only while it rains).
      if ( uGRain > 0.01 ) {
        vec2 cellP = p * 9.0;
        vec2 ci = floor( cellP );
        vec2 cf = cellP - ci - 0.5;
        float ph = fract( uGTime * 0.9 + gHash( ci ) );
        float rk = ( length( cf ) - ph * 0.45 ) * 30.0;
        float ring = exp( -rk * rk ) * ( 1.0 - ph ) * uGRain;
        nrm.xy += normalize( cf + 1e-4 ) * ring * 0.4;
      }
    }
#endif
  }

  // Snow over the land: soft white draped over the ground's bumps (it keeps
  // some of their relief), wind-rippled, a little grey where it is trodden
  // and in the hollows.
  {
    float drift = ${N.drift};
    vec3 sc = vec3( 0.74, 0.78, 0.84 ) * ( 0.9 + 0.1 * h ) * ( 0.94 + 0.08 * drift );
    sc = mix( sc, vec3( 0.52, 0.5, 0.48 ), ( 1.0 - snowRoad ) * 0.45 );
    col = mix( col, sc, snowAmt );
    rough = mix( rough, 0.6, snowAmt );
    vec2 sw = ( vec2( ${N.sw0}, ${N.sw1} ) - 0.5 ) * 0.25 + nrm.xy * 0.45;
    nrm = mix( nrm, vec3( sw, 1.0 ), snowAmt );
    ao = mix( ao, mix( 1.0, ao, 0.5 ), snowAmt );
  }
  plants *= 1.0 - snowAmt;

  // The water itself.
  if ( gWater > 0.0 ) {
    ${B('water')}
    float depth = max( -dc, 0.0 );
    // The bed (the kinds' own colour under water) seen through the water, fading into its colour.
    vec3 deep = mix( uGWaterFresh, uGWaterSea, seaW );
    vec3 bed = col * uGShallow;
    float t = 1.0 - exp( -depth * mix( 2.2, 1.4, seaW ) );
    vec3 wc = mix( bed, deep, t );
    // Ripples: two scales drifting different ways.
    vec2 pr = p * 4.0;
    float sR = uScale[ ${LAYER.ripples} ];
    vec3 n1 = textureGrad( uNrm, vec3( ( pr / 4.0 + vec2( uGTime * 0.012, uGTime * 0.007 ) ) * sR * 1.0, float( ${LAYER.ripples} ) ), gDx * sR, gDy * sR ).xyz * 2.0 - 1.0;
    vec3 n2 = textureGrad( uNrm, vec3( ( pr / 4.0 * 2.7 + vec2( -uGTime * 0.02, uGTime * 0.015 ) ) * sR, float( ${LAYER.ripples} ) ), gDx * sR * 2.7, gDy * sR * 2.7 ).xyz * 2.0 - 1.0;
    vec3 wn = normalize( vec3( ( n1.xy + n2.xy * 0.5 ) * mix( 0.18, 0.32, t ), 1.0 ) );
    // Foam lapping at the edge.
    float lap = sin( uGTime * 1.3 + ${N.lap} * 6.283 ) * 0.04;
    // A thin broken line of foam where the water laps (more on the sea).
    // Surf only where the sea comes in; a river or a pond lies still against its banks.
    float foam = smoothstep( 0.1, 0.01, -dc + lap ) * smoothstep( 0.4, 0.75, ${N.foam0} * 0.7 + ${N.foam1} * 0.3 ) * seaW;
    wc = mix( wc, vec3( 0.7, 0.73, 0.72 ), foam * 0.55 );
    // Ice: under deep snow the margins freeze, snow catching on the ice; the
    // middle stays open, so a frozen river still reads as water to build by.
    float ice = smoothstep( 0.55, 0.85, uGSnow ) * smoothstep( 0.32, 0.12, depth + ( ${N.ice} - 0.5 ) * 0.2 );
    vec3 iceC = mix( vec3( 0.48, 0.56, 0.6 ), vec3( 0.74, 0.78, 0.84 ), smoothstep( 0.45, 0.8, ${N.iceC} ) * uGSnow );
    wc = mix( wc, iceC, ice );
    float wr = mix( mix( 0.09, 0.6, foam ), 0.35, ice );
    wn = normalize( mix( wn, vec3( 0.0, 0.0, 1.0 ), ice * 0.8 ) );
    col = mix( col, wc, gWater );
    rough = mix( rough, wr, gWater );
    nrm = mix( nrm, wn, gWater );
    ao = mix( ao, 1.0, gWater );
    gSpecBoost = gWater * ( 1.0 - ice ) * ( 1.0 - foam );
#ifdef GROUND_HIGH
    // The sun glittering on the ripples: two drifting fields of tiny facets, lit where both are.
    float g1 = ${N.glint0};
    float g2 = ${N.glint1};
    gGlint += vec3( 1.0, 0.96, 0.86 ) * smoothstep( 0.82, 0.97, g1 * g2 ) * uGSun * gSpecBoost * t * 1.6;
#endif
  } else {
    gSpecBoost = 0.0;
  }
  // Puddles mirror the sky as open water does.
  gSpecBoost = max( gSpecBoost, gPuddle * 0.8 );
  // Embers: a dull red glow breathing in the cracks of what still burns (snow and water put out).
  if ( embers > 0.0 ) {
    float breathe = 0.55 + 0.45 * sin( uGTime * 2.3 + h * 17.0 ) * sin( uGTime * 0.9 + p.x * 3.1 + p.y * 2.3 );
    gGlint += vec3( 1.0, 0.28, 0.05 ) * embers * breathe * 2.2 * ( 1.0 - snowAmt ) * ( 1.0 - gWater );
    col *= 1.0 - embers * 0.6;
  }
  // Details finer than a pixel (zoomed far out) would only shimmer: flatten them.
  float far = smoothstep( 0.05, 0.25, px );
  nrm = mix( nrm, vec3( 0.0, 0.0, 1.0 ), far * 0.6 );

  gAlbedo = col;
  gRough = clamp( rough, 0.03, 1.0 );
  gAO = ao;
  gN = normalize( vec3( nrm.x, nrm.z, nrm.y ) ); // tangent (u, v, up) -> local (x, up, z)
}
`;

const VERT_PARS = /* glsl */ `
varying vec2 vGroundPos;
varying vec3 vGroundW;
varying vec3 vGroundTx;
varying vec3 vGroundTz;
varying vec3 vGroundUp;
`;

const VERT_POS = /* glsl */ `
#include <begin_vertex>
vGroundPos = position.xz;
vGroundW = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
// The ground's frame in the world (the view turn turns it): its x, z and up.
vGroundTx = normalize( mat3( modelMatrix ) * vec3( 1.0, 0.0, 0.0 ) );
vGroundTz = normalize( mat3( modelMatrix ) * vec3( 0.0, 0.0, 1.0 ) );
vGroundUp = normalize( mat3( modelMatrix ) * vec3( 0.0, 1.0, 0.0 ) );
`;

const FRAG_MAP = /* glsl */ `
gGlint = vec3( 0.0 );
gPuddle = 0.0;
groundSurface();
diffuseColor.rgb = gAlbedo;
totalEmissiveRadiance += gGlint;
`;

const FRAG_ROUGH = /* glsl */ `
float roughnessFactor = gRough;
`;

const FRAG_METAL = /* glsl */ `
float metalnessFactor = 0.0;
`;

const FRAG_NORMAL = /* glsl */ `
normal = normalize( ( viewMatrix * vec4( normalize( vGroundTx * gN.x + vGroundUp * gN.y + vGroundTz * gN.z ), 0.0 ) ).xyz );
`;

const FRAG_AO = /* glsl */ `
{
  float lookAO = 1.0;
  if ( uLookAOOn > 0.5 ) lookAO = texture2D( uLookAO, gl_FragCoord.xy / uLookRes ).r;
  float occ = gAO * lookAO;
  reflectedLight.indirectDiffuse *= occ;
  reflectedLight.directDiffuse *= mix( 1.0, lookAO, uLookDirectAO );
  float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
  reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, occ, material.roughness );
  // Open water reflects the sky as the ripples tilt it: the sky's colour by
  // Schlick's Fresnel on the rippled normal, in place of the environment's
  // own reflection (which, of a hazy horizon, made the water milky).
  float nv = saturate( dot( normal, geometryViewDir ) );
  vec3 sky = uGSkyColor * uGSkyRefl * ( 0.02 + 0.98 * pow( 1.0 - nv, 5.0 ) ) * 4.0;
  reflectedLight.indirectSpecular = mix( reflectedLight.indirectSpecular, sky, gSpecBoost );
  // The moon's (or a low sun's) sharp highlights on every ripple bloomed into a starfield: open
  // water takes the light's direct gloss by the glitter's strength (uGSun: 0 at night).
  reflectedLight.directSpecular *= mix( 1.0, 0.25 + 0.75 * uGSun, gSpecBoost );
}
`;

const FRAG_FADE = /* glsl */ `
#include <opaque_fragment>
{
  vec2 fq = abs( vGroundW.xz - uLookFade.xy );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, uLookFadeColor, smoothstep( uLookFade.z, uLookFade.w, max( fq.x, fq.y ) ) );
}
#ifdef GROUND_OWN_OUTPUT
gl_FragColor.rgb = gSrgb( gAces( gl_FragColor.rgb ) );
#endif
`;

/**
 * The ground material on texture arrays `tex` (groundTextures.js) and the
 * type map texture `types`. `quality` 'high' or 'low' (low: one sample a
 * kind, no puddles or glitter: for phones). `ownOutput`: tone map and
 * encode sRGB in the shader (drawn into a texture, where three does
 * neither). `sites` the site map texture (groundMap.js). Its uniforms are
 * `mat.userData.ground` (ground.js sets them).
 */
export function groundMaterial(tex, types, quality = 'high', ownOutput = false, sites = types) {
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  mat.name = `ground-${quality}`;
  const u = {
    uTypes: { value: types },
    uSites: { value: sites },
    uAlb: { value: tex.albedo },
    uNrm: { value: tex.normal },
    uOrm: { value: tex.orm },
    uMapSize: { value: new Vector2(types.image.width, types.image.height) },
    uScale: { value: GROUND_LAYERS.map((l) => 4 / l.metres) },
    uGTime: { value: 0 },
    uGZero: { value: 0 },
    uGSnow: { value: 0 },
    uGWet: { value: 0 },
    uGRain: { value: 0 },
    uGVeg: { value: new Vector3(1, 1, 1) },
    uGVegAmt: { value: 0 },
    uGDry: { value: 0 },
    uGFlowers: { value: 1 },
    uGLeaves: { value: 0 },
    uGWaterFresh: { value: new Vector3(0.022, 0.085, 0.085) },
    uGWaterSea: { value: new Vector3(0.012, 0.05, 0.115) },
    uGShallow: { value: new Vector3(0.32, 0.46, 0.44) },
    uGSkyRefl: { value: 0.3 },
    uGSun: { value: 1 },
    uGSkyColor: { value: new Vector3(0.6, 0.75, 1.0) },
  };
  mat.userData.ground = u;
  mat.defines = {};
  if (quality === 'high') mat.defines.GROUND_HIGH = '';
  if (ownOutput) mat.defines.GROUND_OWN_OUTPUT = '';
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, LOOK.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', VERT_POS);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <map_fragment>', FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', FRAG_ROUGH)
      .replace('#include <metalnessmap_fragment>', FRAG_METAL)
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
      .replace('#include <aomap_fragment>', FRAG_AO)
      .replace('#include <opaque_fragment>', FRAG_FADE);
  };
  mat.customProgramCacheKey = () => `ground1-${quality}${ownOutput ? '-own' : ''}`;
  return mat;
}
