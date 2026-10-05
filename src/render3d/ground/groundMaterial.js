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
 *   2. Anti-tiling (High): each kind is sampled again, larger and turned,
 *      and the two are mixed in patches, and large soft noise changes tone
 *      and dryness across a field, so a big field never shows its repeat.
 *   3. Roads, plazas, rubble, from the road byte of the pixel's own tile:
 *      the road's shape is a distance field (a centre square and an arm to
 *      each linked side, corners rounded), so the road bends and meets as
 *      the 2D art's does, with a worn verge, wheel ruts on a straight run,
 *      and kerbs of limestone along the Imperial road's basalt.
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
 *      the ruts and hollows.
 *
 * The map's own coordinates (tiles, x along the map's x, z along its y)
 * are the mesh's local x and z (ground.js turns the mesh with the view), so
 * the shader reads the type map at the map tile under the pixel whatever
 * the view turn. Textures are sampled with textureGrad and derivatives
 * taken once at the top: the kind loop branches per pixel, and implicit
 * derivatives inside such branches are undefined.
 * ----------------------------------------------------------------------------
 */

import { MeshStandardMaterial, Vector2, Vector3 } from 'three';
import { LOOK } from '../materials.js';
import { GROUND_LAYERS, LAYER } from './groundSurfaces.js';
import { KIND } from './groundMap.js';

/** Per kind (KIND order): how much snow lies, how much the season tints it, how dark rain makes it, puddles. */
const KIND_SNOW = [1.0, 1.0, 0.85, 0.75, 0.6, 0.7, 0.55, 0.95, 0.0];
const KIND_SEASON = [1.0, 1.0, 0.55, 0.8, 0.3, 0.0, 0.0, 0.6, 0.0];
const KIND_SOAK = [0.55, 0.5, 0.8, 0.6, 0.45, 0.9, 1.0, 0.85, 0.0];
const KIND_PUDDLE = [0.25, 0.15, 0.6, 0.3, 0.5, 0.15, 0.2, 0.9, 0.0];
/** Which kind spreads over which where they meet (added to its weight): woods creep out, sand gives way. */
const KIND_BIAS = [0.06, 0.04, 0.03, 0.1, 0.0, -0.02, -0.04, 0.0, 0.0];

const glslFloats = (a) => a.map((v) => v.toFixed(3)).join(', ');

const PARS = /* glsl */ `
uniform highp sampler2D uTypes;
uniform highp sampler2DArray uAlb;
uniform highp sampler2DArray uNrm;
uniform highp sampler2DArray uOrm;
uniform vec2 uMapSize;
uniform float uScale[${GROUND_LAYERS.length}];
uniform float uGTime;
uniform float uGSnow;
uniform float uGWet;
uniform float uGRain;
uniform vec3 uGVeg;
uniform float uGVegAmt;
uniform float uGDry;
uniform float uGFlowers;
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
float gFbm( vec2 p ) {
  return gNoise( p ) * 0.5 + gNoise( p * 2.03 + 7.1 ) * 0.3 + gNoise( p * 4.11 + 3.3 ) * 0.2;
}
vec4 gType( ivec2 t ) {
  ivec2 s = ivec2( uMapSize ) - 1;
  return texelFetch( uTypes, clamp( t, ivec2( 0 ), s ), 0 ) * 255.0;
}
float gLum( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }

// A layer's sample: albedo (rgb) and height (a), normal (tangent space, xy), ORM (occlusion, roughness, plants).
struct GSmp { vec4 alb; vec3 n; vec3 orm; };

vec2 gDx; vec2 gDy;

GSmp gSample( int k, vec2 p ) {
  float sc = uScale[ k ];
  vec2 uv = p * sc;
  vec2 dx = gDx * sc;
  vec2 dy = gDy * sc;
  float L = float( k );
  GSmp s;
  s.alb = textureGrad( uAlb, vec3( uv, L ), dx, dy );
  s.n = textureGrad( uNrm, vec3( uv, L ), dx, dy ).xyz * 2.0 - 1.0;
  s.orm = textureGrad( uOrm, vec3( uv, L ), dx, dy ).xyz;
#ifdef GROUND_HIGH
  // A second copy, 1.6 times larger and turned, mixed in by patches: the
  // repeat of one texture never lines up over a field. (Not for patterns
  // laid square to the map: furrows, paving, flagstones.)
  if ( !K_ANTI[ k ] ) return s;
  const mat2 R = mat2( 0.8, 0.6, -0.6, 0.8 );
  vec2 uv2 = R * uv * 0.62 + vec2( 0.37, 0.71 ) * L;
  vec4 a2 = textureGrad( uAlb, vec3( uv2, L ), R * dx * 0.62, R * dy * 0.62 );
  vec3 n2 = textureGrad( uNrm, vec3( uv2, L ), R * dx * 0.62, R * dy * 0.62 ).xyz * 2.0 - 1.0;
  n2.xy = n2.xy * R; // back into the first copy's frame
  float m = smoothstep( 0.3, 0.7, gNoise( p * 0.37 + L * 5.3 ) );
  s.alb = mix( s.alb, a2, m );
  s.n = mix( s.n, n2, m );
#endif
  return s;
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

  // --- 1. kinds ---------------------------------------------------------
  vec2 wob = ( vec2( gNoise( p * 0.9 ), gNoise( p * 0.9 + 19.7 ) ) - 0.5 ) * 0.62
           + ( vec2( gNoise( p * 2.9 + 3.0 ), gNoise( p * 2.9 + 41.0 ) ) - 0.5 ) * 0.22
           + ( vec2( gNoise( p * 8.1 + 7.0 ), gNoise( p * 8.1 + 13.0 ) ) - 0.5 ) * 0.07;
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
  GSmp S[4];
  float score[4];
  float best = -1e3;
  for ( int a = 0; a < 4; a++ ) {
    score[a] = -1e3;
    if ( w[a] <= 0.0 ) continue;
    S[a] = gSample( lay[a], p );
    score[a] = w[a] + ( S[a].alb.a - 0.5 ) * 0.55 + K_BIAS[ k[a] ];
    best = max( best, score[a] );
  }
  vec4 alb = vec4( 0.0 );
  vec3 nrm = vec3( 0.0 );
  vec3 orm = vec3( 0.0 );
  float snowHold = 0.0, season = 0.0, soak = 0.0, puddle = 0.0, wsum = 0.0;
  for ( int a = 0; a < 4; a++ ) {
    if ( score[a] < -1e2 ) continue;
    float ww = max( score[a] - best + 0.2, 0.0 );
    ww *= ww;
    if ( ww <= 0.0 ) continue;
    alb += S[a].alb * ww;
    nrm += S[a].n * ww;
    orm += S[a].orm * ww;
    snowHold += K_SNOW[ k[a] ] * ww;
    season += K_SEASON[ k[a] ] * ww;
    soak += K_SOAK[ k[a] ] * ww;
    puddle += K_PUDDLE[ k[a] ] * ww;
    wsum += ww;
  }
  float iw = 1.0 / max( wsum, 1e-5 );
  alb *= iw; nrm *= iw; orm *= iw; snowHold *= iw; season *= iw; soak *= iw; puddle *= iw;
  vec3 col = alb.rgb;
  float h = alb.a;
  float ao = orm.r;
  float rough = orm.g;
  float plants = orm.b * season;

  // Large soft variation across a field: tone, and patches drier or lusher.
  float macro = gFbm( p * 0.11 + 4.0 );
  float macro2 = gNoise( p * 0.43 + 9.0 );
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
  }

  // --- 3. roads, plazas, rubble -----------------------------------------
  ivec2 ti = ivec2( floor( p ) );
  vec4 own = gType( ti );
  int g = int( own.g + 0.5 );
  int links = g & 15;
  int surf = ( g >> 4 ) & 3;
  bool bridge = ( g & 128 ) != 0;
  vec2 q = p - floor( p );
  float wear = 0.0;
  float snowRoad = 1.0;
  if ( surf != 0 && !bridge ) {
    float inset = surf == 3 ? 0.0 : surf == 2 ? 0.04 : 0.12;
    float sd = gRoad( q, surf == 3 ? 15 : links, inset );
    if ( surf == 3 ) sd = gRect( q, vec2( ( links & 8 ) != 0 ? -1.0 : 0.03 , ( links & 1 ) != 0 ? -1.0 : 0.03 ), vec2( ( links & 2 ) != 0 ? 2.0 : 0.97, ( links & 4 ) != 0 ? 2.0 : 0.97 ), 0.04 );
    float edgeN = ( gNoise( p * 23.0 ) - 0.5 ) * 0.025;
    // The road's own surface.
    int rl = surf == 1 ? ${LAYER.gravel} : surf == 2 ? ${LAYER.basalt} : ${LAYER.flags};
    GSmp R = gSample( rl, p );
    vec3 rc = R.alb.rgb;
    float rr = R.orm.g;
    float rh = R.alb.a;
    vec3 rn = R.n;
    float rao = R.orm.r;
    if ( surf == 1 ) {
      // Wheel ruts on a straight run, worn into the gravel; a crown of finer grit between.
      if ( links == 5 || links == 10 ) {
        float acr = links == 5 ? q.x : q.y;
        float wobR = ( gNoise( p * 3.1 ) - 0.5 ) * 0.03;
        float rut = 0.0;
        for ( int s = -1; s <= 1; s += 2 ) rut = max( rut, exp( -pow( ( acr - 0.5 - float( s ) * 0.17 + wobR ) / 0.035, 2.0 ) ) );
        rc *= 1.0 - 0.22 * rut;
        rh -= rut * 0.4;
        rr *= 1.0 - 0.15 * rut;
      }
      rc = mix( rc, rc * vec3( 0.86, 0.84, 0.8 ), smoothstep( -0.02, 0.0, sd + 0.04 ) * 0.5 );
    } else if ( surf == 2 ) {
      // Kerbs of pale limestone blocks along the paving, a gravel margin outside them.
      float kerb = smoothstep( -0.07, -0.065, sd ) * smoothstep( -0.015, -0.02, sd );
      float margin = smoothstep( -0.02, -0.015, sd );
      if ( kerb > 0.0 || margin > 0.0 ) {
        GSmp K = gSample( ${LAYER.flags}, p * 2.3 );
        GSmp G = gSample( ${LAYER.gravel}, p );
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
  // Rubble: read between tile middles like the kinds, so a fallen block's rubble is one heap.
  {
    float r = 0.0;
    vec4 TR[4] = vec4[4]( T0, T1, T2, T3 );
    float wr[4] = float[4]( ( 1.0 - f.x ) * ( 1.0 - f.y ), f.x * ( 1.0 - f.y ), ( 1.0 - f.x ) * f.y, f.x * f.y );
    for ( int a = 0; a < 4; a++ ) if ( ( int( TR[a].g + 0.5 ) & 64 ) != 0 ) r += wr[a];
    if ( r > 0.0 ) {
      GSmp B = gSample( ${LAYER.rubble}, p );
      float rm = smoothstep( 0.35, 0.55, r * 0.85 + ( B.alb.a - 0.5 ) * 0.5 + ( gNoise( p * 4.0 ) - 0.5 ) * 0.25 );
      col = mix( col, B.alb.rgb, rm );
      h = mix( h, B.alb.a, rm );
      nrm = mix( nrm, B.n, rm );
      rough = mix( rough, B.orm.g, rm );
      ao = mix( ao, B.orm.r, rm );
      plants *= 1.0 - rm;
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
  float coastN = ( gFbm( p * 2.2 ) - 0.5 ) * 0.22;
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
      float n = gFbm( p * 2.7 ) * 0.55 + gNoise( p * 11.0 ) * 0.15 + h * 0.3;
      float lo = mix( 0.72, -0.15, clamp( uGSnow, 0.0, 1.0 ) );
      snowAmt = smoothstep( lo, lo + 0.2, n ) * clamp( cover * 2.6, 0.0, 1.0 );
      snowAmt *= mix( 1.0, 0.6 + 0.4 * smoothstep( 0.4, 0.7, gNoise( p * 6.0 ) ), 1.0 - snowRoad );
    }
    float wet = max( uGWet * soak, wetBand * 0.9 ) * ( 1.0 - snowAmt );
    col *= 1.0 - wet * 0.42;
    rough = mix( rough, rough * 0.45, wet );
    // Puddles in hollows and ruts after rain: still water over the ground.
    float pd = smoothstep( 0.42, 0.34, h + ( gFbm( p * 1.3 + 5.0 ) - 0.5 ) * 0.9 - uGWet * 0.12 ) * uGWet * uGWet * puddle * ( 1.0 - snowAmt );
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
        float ring = exp( -pow( ( length( cf ) - ph * 0.45 ) * 30.0, 2.0 ) ) * ( 1.0 - ph ) * uGRain;
        nrm.xy += normalize( cf + 1e-4 ) * ring * 0.4;
      }
    }
#endif
  }

  // Snow over the land: soft white draped over the ground's bumps (it keeps
  // some of their relief), wind-rippled, a little grey where it is trodden
  // and in the hollows.
  {
    float drift = gFbm( p * 1.1 + 31.0 );
    vec3 sc = vec3( 0.74, 0.78, 0.84 ) * ( 0.9 + 0.1 * h ) * ( 0.94 + 0.08 * drift );
    sc = mix( sc, vec3( 0.52, 0.5, 0.48 ), ( 1.0 - snowRoad ) * 0.45 );
    col = mix( col, sc, snowAmt );
    rough = mix( rough, 0.6, snowAmt );
    vec2 sw = ( vec2( gNoise( p * 3.0 ), gNoise( p * 3.0 + 7.0 ) ) - 0.5 ) * 0.25 + nrm.xy * 0.45;
    nrm = mix( nrm, vec3( sw, 1.0 ), snowAmt );
    ao = mix( ao, mix( 1.0, ao, 0.5 ), snowAmt );
  }
  plants *= 1.0 - snowAmt;

  // The water itself.
  if ( gWater > 0.0 ) {
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
    float lap = sin( uGTime * 1.3 + gNoise( p * 2.0 ) * 6.283 ) * 0.04;
    // A thin broken line of foam where the water laps (more on the sea).
    float foam = smoothstep( 0.07, 0.015, -dc + lap ) * smoothstep( 0.45, 0.7, gNoise( p * 7.0 + uGTime * 0.12 ) * 0.7 + gNoise( p * 21.0 ) * 0.3 + seaW * 0.15 );
    wc = mix( wc, vec3( 0.75, 0.78, 0.76 ), foam * 0.7 );
    // Ice: under deep snow the margins freeze, snow catching on the ice; the
    // middle stays open, so a frozen river still reads as water to build by.
    float ice = smoothstep( 0.55, 0.85, uGSnow ) * smoothstep( 0.32, 0.12, depth + ( gNoise( p * 1.5 ) - 0.5 ) * 0.2 );
    vec3 iceC = mix( vec3( 0.48, 0.56, 0.6 ), vec3( 0.74, 0.78, 0.84 ), smoothstep( 0.45, 0.8, gNoise( p * 5.0 ) ) * uGSnow );
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
    float g1 = gNoise( p * 70.0 + vec2( uGTime * 1.4, -uGTime * 0.9 ) );
    float g2 = gNoise( p * 43.0 + vec2( -uGTime * 0.8, uGTime * 1.1 ) + 11.0 );
    gGlint = vec3( 1.0, 0.96, 0.86 ) * smoothstep( 0.82, 0.97, g1 * g2 ) * uGSun * gSpecBoost * t * 1.6;
#endif
  } else {
    gSpecBoost = 0.0;
  }
  // Puddles mirror the sky as open water does.
  gSpecBoost = max( gSpecBoost, gPuddle * 0.8 );
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
}
`;

const FRAG_FADE = /* glsl */ `
#include <opaque_fragment>
{
  vec2 fq = abs( vGroundW.xz - uLookFade.xy );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, uLookFadeColor, smoothstep( uLookFade.z, uLookFade.w, max( fq.x, fq.y ) ) );
}
`;

/**
 * The ground material on texture arrays `tex` (groundTextures.js) and the
 * type map texture `types`. `quality` 'high' or 'low' (low: one sample a
 * kind, no puddles: for software GL and small GPUs). Its uniforms are
 * `mat.userData.ground` (ground.js sets them each frame).
 */
export function groundMaterial(tex, types, quality = 'high') {
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  mat.name = `ground-${quality}`;
  const u = {
    uTypes: { value: types },
    uAlb: { value: tex.albedo },
    uNrm: { value: tex.normal },
    uOrm: { value: tex.orm },
    uMapSize: { value: new Vector2(types.image.width, types.image.height) },
    uScale: { value: GROUND_LAYERS.map((l) => 4 / l.metres) },
    uGTime: { value: 0 },
    uGSnow: { value: 0 },
    uGWet: { value: 0 },
    uGRain: { value: 0 },
    uGVeg: { value: new Vector3(1, 1, 1) },
    uGVegAmt: { value: 0 },
    uGDry: { value: 0 },
    uGFlowers: { value: 1 },
    uGWaterFresh: { value: new Vector3(0.022, 0.085, 0.085) },
    uGWaterSea: { value: new Vector3(0.012, 0.05, 0.115) },
    uGShallow: { value: new Vector3(0.32, 0.46, 0.44) },
    uGSkyRefl: { value: 0.3 },
    uGSun: { value: 1 },
    uGSkyColor: { value: new Vector3(0.6, 0.75, 1.0) },
  };
  mat.userData.ground = u;
  if (quality === 'high') mat.defines = { GROUND_HIGH: '' };
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
  mat.customProgramCacheKey = () => `ground1-${quality}`;
  return mat;
}
