/**
 * people/material.js
 * ----------------------------------------------------------------------------
 * The one material every person of the 3D look is drawn in, and its shadow
 * casters': the look's own (materials.js patchLook: snow settles on heads
 * and shoulders by their posed normals, rain darkens the wool, the sun's
 * shadow map, the look's clip under the ground), with:
 *
 *   - Skinning on the GPU. The clips (clips.js) are baked once into a float
 *     texture, a row a frame and three texels a bone (its 3 x 4 matrix).
 *     A vertex reads its four bones in the two frames either side of its
 *     instance's time and blends them; the time is the look's clock (one
 *     uniform for the whole city) times the instance's speed plus its phase.
 *     Nothing moves on the CPU from frame to frame.
 *   - Routes. An instance may walk a line in its building (a priest from the
 *     doors to the altar): out, a pause there in its own clip, a turn, back,
 *     a pause, a turn, all worked out from the time in the vertex shader,
 *     the clips cross-faded where one gives way to the next, the walk played
 *     at the route's speed so the feet hold the ground.
 *   - Colours by slot. A vertex carries a slot (mesher.js SLOTS: skin, hair,
 *     tunic, mantle, trim, leather, metal, the eyes, the lips...); the slot
 *     says which of its instance's eight colours it takes (packed 24-bit
 *     sRGB in two attributes) or a fixed one, how rough and metallic it is,
 *     how much the wool's woven texture shows (none on skin), how much snow
 *     and rain it takes. One program, one draw a piece and level for the
 *     whole city, a crowd of many colours.
 *   - A child's head: what the head's bone carries is scaled about the
 *     neck by the instance's head scale (a child is drawn at three quarters
 *     with a head nearer a grown man's).
 *
 * Instance attributes (actors.js packs them):
 *   aActClip   clip index, phase (s), speed, the route's pause clips (b + 64 a)
 *   aActRoute  length (m, 0 for none), speed (m/s), pause at its end, at its start (s)
 *   aActCol0   tunic, mantle, skin, hair    (24-bit sRGB each)
 *   aActCol1   trim, leather, accent, metal
 *   aActMisc   head scale, the facing at a route's end and at its start (rad, the actor's frame), -
 * ----------------------------------------------------------------------------
 */

import {
  MeshStandardMaterial, MeshDepthMaterial, MeshDistanceMaterial, DataTexture, RGBAFormat, FloatType, NearestFilter, Color, Vector2, Vector4, ShaderChunk,
} from 'three';
import { LOOK, patchLook, surfaceTextures, cachedMaterial } from '../materials.js';
import { bakeClips, CLIP_NAMES, CLIP_INDEX, WALK_SPEED } from './clips.js';
import { BONE, BONE_COUNT, BONES } from './rig.js';
import { SLOTS, SLOT_COUNT } from './mesher.js';

/** The clips' frames as a texture: BONE_COUNT x 3 texels a row, a row a frame. */
let BONES_TEX = null;
export function boneTexture() {
  if (BONES_TEX) return BONES_TEX;
  const b = bakeClips();
  const t = new DataTexture(b.data, BONE_COUNT * 3, b.rows, RGBAFormat, FloatType);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  t.name = 'people-bones';
  BONES_TEX = t;
  return t;
}

/** sRGB hex to linear [r, g, b]. */
function linear(hex) {
  const c = new Color().setHex(hex);
  // (three's Color.setHex converts from sRGB to linear when colour management is on; do it by hand to be sure.)
  const f = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return [f(((hex >> 16) & 255) / 255), f(((hex >> 8) & 255) / 255), f((hex & 255) / 255), c];
}

/** The tints of slots that take an instance's colour and shade it (the lips, the nails: the skin's, redder or paler). */
const TINTS = { LIPS: [0.8, 0.5, 0.47], NAIL: [1.12, 1.02, 0.98], BROW: [0.8, 0.8, 0.8] };

/** The shared uniforms of every people material (the clips' table and the slots'), made once. */
let SHARED = null;
function shared() {
  if (SHARED) return SHARED;
  const b = bakeClips();
  const clips = b.table.map((c) => new Vector4(c.start, c.frames, c.fps, c.stride));
  const A = [];
  const B = [];
  const C = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    A.push(new Vector4(0.8, 0, 0, 0));
    B.push(new Vector4(1, 0, 1, -1));
    C.push(0);
  }
  for (const [name, s] of Object.entries(SLOTS)) {
    A[s.i].set(s.rough, s.metal, s.tex, s.snow);
    if (s.col < 0) {
      const [r, g, bb] = linear(s.rgb);
      B[s.i].set(r, g, bb, -1);
    } else {
      const t = TINTS[name] || [1, 1, 1];
      B[s.i].set(t[0], t[1], t[2], s.col);
    }
    C[s.i] = s.wet;
  }
  const H = BONES[BONE.head].at;
  SHARED = {
    uPeopleBones: { value: boneTexture() },
    uPeopleClips: { value: clips },
    uPeopleSlotA: { value: A },
    uPeopleSlotB: { value: B },
    uPeopleSlotC: { value: C },
    uPeopleHead: { value: new Vector4(H[0], H[1] - 0.01, H[2], BONE.head) },
    uPeopleWalk: { value: WALK_SPEED },
    uPeopleIdle: { value: CLIP_INDEX.idle },
  };
  return SHARED;
}

const VERT_PARS = () => /* glsl */ `
#define PEOPLE_CLIPS ${CLIP_NAMES.length}
uniform highp sampler2D uPeopleBones;
uniform vec4 uPeopleClips[ PEOPLE_CLIPS ];
uniform vec4 uPeopleSlotA[ ${SLOT_COUNT} ];
uniform vec4 uPeopleSlotB[ ${SLOT_COUNT} ];
uniform float uPeopleSlotC[ ${SLOT_COUNT} ];
uniform vec4 uPeopleHead;
uniform float uPeopleWalk;
attribute vec4 aBones;
attribute vec4 aWeights;
attribute vec2 aMat;
attribute vec4 aActClip;
attribute vec4 aActRoute;
attribute vec4 aActCol0;
attribute vec4 aActCol1;
attribute vec4 aActMisc;
#ifndef PEOPLE_DEPTH
varying vec3 vPeopleCol;
varying vec4 vPeopleMat;
varying float vPeopleWet;
#endif
mat4 peopleBone( float row, float b ) {
  ivec2 c = ivec2( int( b + 0.5 ) * 3, int( row + 0.5 ) );
  vec4 r0 = texelFetch( uPeopleBones, c, 0 );
  vec4 r1 = texelFetch( uPeopleBones, c + ivec2( 1, 0 ), 0 );
  vec4 r2 = texelFetch( uPeopleBones, c + ivec2( 2, 0 ), 0 );
  return mat4( r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0 );
}
mat4 peopleFrame( float row ) {
  mat4 m = aWeights.x * peopleBone( row, aBones.x );
  if ( aWeights.y > 0.0 ) m += aWeights.y * peopleBone( row, aBones.y );
  if ( aWeights.z > 0.0 ) m += aWeights.z * peopleBone( row, aBones.z );
  if ( aWeights.w > 0.0 ) m += aWeights.w * peopleBone( row, aBones.w );
  return m;
}
// A clip's skinning matrix at a time (s): two frames blended, the loop's last running into its first.
mat4 peopleSkin( float clip, float time ) {
  vec4 c = uPeopleClips[ int( clip + 0.5 ) ];
  float f = mod( time * c.z, c.y );
  float f0 = floor( f );
  float k = f - f0;
  mat4 a = peopleFrame( c.x + f0 );
  mat4 b = peopleFrame( c.x + mod( f0 + 1.0, c.y ) );
  return a + ( b - a ) * k;
}
float peopleChannel( int i ) {
  return i == 0 ? aActCol0.x : i == 1 ? aActCol0.y : i == 2 ? aActCol0.z : i == 3 ? aActCol0.w
    : i == 4 ? aActCol1.x : i == 5 ? aActCol1.y : i == 6 ? aActCol1.z : aActCol1.w;
}
vec3 peopleUnpack( float v ) {
  vec3 c = vec3( floor( v / 65536.0 ), mod( floor( v / 256.0 ), 256.0 ), mod( v, 256.0 ) ) / 255.0;
  return pow( c, vec3( 2.2 ) );
}
`;

/**
 * The skinning and the route, at the top of main(): pSkin (the blended
 * skinning matrix), pYaw and pAdv (the route's turn and how far along it).
 */
const VERT_MAIN = /* glsl */ `
void main() {
  float pYaw = 0.0;
  float pAdv = 0.0;
  mat4 pSkin;
  {
    float speed = aActClip.z;
    if ( aActRoute.x <= 0.0 ) {
      pSkin = peopleSkin( aActClip.x, uLookTime * speed + aActClip.y );
    } else {
      // A route: out, a pause, a turn, back, a pause, a turn (TURN s each), round and round.
      const float TURN = 0.9;
      const float FADE = 0.35;
      float L = aActRoute.x;
      float v = aActRoute.y;
      float tw = L / v;
      float pb = aActRoute.z;
      float pa = aActRoute.w;
      float C = 2.0 * tw + pa + pb + 2.0 * TURN;
      float t = mod( uLookTime * speed + aActClip.y, C );
      float clipB = mod( aActClip.w, 64.0 );
      float clipA = floor( aActClip.w / 64.0 );
      float walk = aActClip.x;
      float rate = v / uPeopleWalk;
      float tc = uLookTime * speed + aActClip.y;
      float cur = walk;
      float curT = t * rate;
      float prev = walk;
      float prevT = t * rate;
      float since = 1e3;
      if ( t < tw ) {
        pAdv = v * t;
        prev = walk; since = 1e3;
      } else if ( t < tw + pb ) {
        // At the end: turned to what it does there (an altar beside the way), then that clip.
        float k = min( 1.0, ( t - tw ) / FADE );
        pAdv = L;
        pYaw = aActMisc.y * k * k * ( 3.0 - 2.0 * k );
        cur = clipB; curT = tc;
        prev = walk; prevT = tw * rate; since = t - tw;
      } else if ( t < tw + pb + TURN ) {
        float k = ( t - tw - pb ) / TURN;
        pAdv = L;
        pYaw = mix( aActMisc.y, 3.14159265, k * k * ( 3.0 - 2.0 * k ) );
        cur = walk; curT = t * rate * 0.6;
        prev = clipB; prevT = tc; since = t - tw - pb;
      } else if ( t < 2.0 * tw + pb + TURN ) {
        float s = t - tw - pb - TURN;
        pAdv = L - v * s;
        pYaw = 3.14159265;
      } else if ( t < 2.0 * tw + pb + TURN + pa ) {
        float k = min( 1.0, ( t - 2.0 * tw - pb - TURN ) / FADE );
        pYaw = mix( 3.14159265, aActMisc.z, k * k * ( 3.0 - 2.0 * k ) );
        cur = clipA; curT = tc;
        prev = walk; prevT = t * rate; since = t - 2.0 * tw - pb - TURN;
      } else {
        float k = ( t - 2.0 * tw - pb - TURN - pa ) / TURN;
        pYaw = mix( aActMisc.z, 6.2831853, k * k * ( 3.0 - 2.0 * k ) );
        cur = walk; curT = t * rate * 0.6;
        prev = clipA; prevT = tc; since = t - 2.0 * tw - pb - TURN - pa;
      }
      pSkin = peopleSkin( cur, curT );
      if ( since < FADE ) {
        float k = since / FADE;
        pSkin = peopleSkin( prev, prevT ) + ( pSkin - peopleSkin( prev, prevT ) ) * ( k * k * ( 3.0 - 2.0 * k ) );
      }
    }
  }
`;

/** The rest position, a child's head scaled about the neck; the slot's colour and material for the fragment. */
const VERT_BEGIN = /* glsl */ `
vec3 pRest = position;
{
  float hw = ( abs( aBones.x - uPeopleHead.w ) < 0.5 ? aWeights.x : 0.0 ) + ( abs( aBones.y - uPeopleHead.w ) < 0.5 ? aWeights.y : 0.0 )
    + ( abs( aBones.z - uPeopleHead.w ) < 0.5 ? aWeights.z : 0.0 ) + ( abs( aBones.w - uPeopleHead.w ) < 0.5 ? aWeights.w : 0.0 );
  pRest = mix( pRest, uPeopleHead.xyz + ( pRest - uPeopleHead.xyz ) * aActMisc.x, hw );
}
vec3 transformed = ( pSkin * vec4( pRest, 1.0 ) ).xyz;
{
  float c = cos( pYaw );
  float s = sin( pYaw );
  transformed = vec3( c * transformed.x + s * transformed.z, transformed.y, -s * transformed.x + c * transformed.z + pAdv );
}
`;

const VERT_NORMAL = /* glsl */ `
vec3 objectNormal = normalize( mat3( pSkin ) * normal );
{
  float c = cos( pYaw );
  float s = sin( pYaw );
  objectNormal = vec3( c * objectNormal.x + s * objectNormal.z, objectNormal.y, -s * objectNormal.x + c * objectNormal.z );
}
#ifdef USE_TANGENT
  vec3 objectTangent = vec3( tangent.xyz );
#endif
{
  int si = int( aMat.x + 0.5 );
  vec4 sb = uPeopleSlotB[ si ];
  vec3 col = sb.w < 0.0 ? sb.rgb : peopleUnpack( peopleChannel( int( sb.w + 0.5 ) ) ) * sb.rgb;
  vPeopleCol = col * aMat.y;
  vPeopleMat = uPeopleSlotA[ si ];
  vPeopleWet = uPeopleSlotC[ si ];
}
`;

const FRAG_PARS = /* glsl */ `
varying vec3 vPeopleCol;
varying vec4 vPeopleMat;
varying float vPeopleWet;
`;

const FRAG_MAP = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  diffuseColor.rgb *= mix( vec3( 1.0 ), sampledDiffuseColor.rgb, vPeopleMat.z );
#endif
diffuseColor.rgb *= vPeopleCol;
`;

const FRAG_ROUGH = /* glsl */ `
float roughnessFactor = vPeopleMat.x;
#ifdef USE_ROUGHNESSMAP
  roughnessFactor *= mix( 1.0, texture2D( roughnessMap, vRoughnessMapUv ).g, vPeopleMat.z );
#endif
`;

const FRAG_METAL = /* glsl */ `
float metalnessFactor = vPeopleMat.y;
`;

/** Replace `what` in `text`, loudly if it is not there (a newer three, or the look's patch changed). */
function swap(text, what, by, where) {
  if (!text.includes(what)) throw new Error(`people material: "${what.trim().slice(0, 50)}" not found in the ${where} shader`);
  return text.replace(what, by);
}

/** Patch a shader (already through patchLook for the colour one) for the people: `depth` for a shadow caster's. */
export function patchPeopleShader(shader, depth) {
  Object.assign(shader.uniforms, shared(), depth ? { uLookTime: LOOK.uniforms.uLookTime } : {});
  let v = shader.vertexShader;
  v = swap(v, '#include <common>', `#include <common>\n${depth ? '#define PEOPLE_DEPTH\nuniform float uLookTime;\n' : ''}${VERT_PARS()}`, 'vertex');
  v = swap(v, 'void main() {', VERT_MAIN, 'vertex');
  v = swap(v, '#include <begin_vertex>', VERT_BEGIN, 'vertex');
  if (!depth) v = swap(v, '#include <beginnormal_vertex>', VERT_NORMAL, 'vertex');
  shader.vertexShader = v;
  if (!depth) {
    let f = shader.fragmentShader;
    f = swap(f, '#include <common>', `#include <common>\n${FRAG_PARS}`, 'fragment');
    f = swap(f, '#include <map_fragment>', FRAG_MAP, 'fragment');
    f = swap(f, '#include <roughnessmap_fragment>', FRAG_ROUGH, 'fragment');
    f = swap(f, '#include <metalnessmap_fragment>', FRAG_METAL, 'fragment');
    // (The normal map's chunk is still an include here: its text, with the slot's share of the weave.)
    f = swap(f, '#include <normal_fragment_maps>', swap(ShaderChunk.normal_fragment_maps, 'mapN.xy *= normalScale;', 'mapN.xy *= normalScale * vPeopleMat.z;', 'normal map'), 'fragment');
    // The look's snow and wet (materials.js FRAG_SURFACE) by the slot: none on a face, all on a mantle.
    f = swap(f, 'float cover = uLookSnow * uLookSnowMul;', 'float cover = uLookSnow * uLookSnowMul * vPeopleMat.w;', 'fragment');
    f = swap(f, 'float wet = uLookWet * uLookWetMul * ( 1.0 - lookSnowAmt );', 'float wet = uLookWet * uLookWetMul * vPeopleWet * ( 1.0 - lookSnowAmt );', 'fragment');
    shader.fragmentShader = f;
  }
}

/** The people's material: the look's (wool's texture for the cloth), skinned and coloured by slot. */
export function peopleMaterial() {
  return cachedMaterial('people', () => {
    const wool = surfaceTextures('wool');
    const m = new MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 1, vertexColors: false,
      map: wool.map, normalMap: wool.normalMap, normalScale: new Vector2(0.8, 0.8), roughnessMap: wool.orm, metalnessMap: wool.orm,
    });
    m.name = 'people';
    patchLook(m, { snow: 1, wet: 1 });
    const look = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      look(shader, renderer);
      patchPeopleShader(shader, false);
    };
    m.customProgramCacheKey = () => 'people1';
    return m;
  });
}

/** The people's shadow casters: the sun's depth (and a lamp's distance, the lab's torch), skinned alike. */
export function peopleDepthMaterial(kind = 'depth') {
  return cachedMaterial(`people-${kind}`, () => {
    const m = kind === 'depth' ? new MeshDepthMaterial() : new MeshDistanceMaterial();
    m.onBeforeCompile = (shader) => patchPeopleShader(shader, true);
    m.customProgramCacheKey = () => `people-${kind}1`;
    return m;
  });
}

export { CLIP_INDEX };
