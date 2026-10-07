/**
 * materials.js
 * ----------------------------------------------------------------------------
 * The material library of the 3D look: physically based materials built on
 * the procedural surfaces (surfaces.js), made once and shared (a cache by
 * name), all carrying one shader patch (LOOK) that the whole picture needs:
 *
 *   - Screen-space ambient occlusion (look.js renders it before the scene)
 *     darkens the light from the sky and the environment, where the eye
 *     expects contact shadows (the foot of the curb, the joints of the
 *     steps), and only a share of the sun's light, which the shadow map
 *     already shades: AO on the sun's light is what makes SSAO look dirty.
 *   - Snow (winter): settles on what faces up, by the world normal of the
 *     shaded surface (so on the tops of bumps first), broken by world-space
 *     noise, thicker in nooks (where the AO is dark), never on overhangs.
 *     Each material says how much sticks to it (`snow`): little on a trodden
 *     street, all of it on a curb's lip. Under it stone is wet and darker.
 *   - The world's edge: the lab shows a small patch, and the ground fades
 *     into the backdrop past a radius instead of ending in a cut edge.
 *   - Sway: grass blades move in the wind (a vertex offset growing with
 *     the height of the vertex in the blade).
 *
 * Uniforms in LOOK.uniforms are shared by every material (one update moves
 * them all); per-material numbers sit in each material's own uniforms
 * (how much snow sticks, how wet it gets, how far it sways), never in
 * defines: every program costs a few hundred milliseconds to make on
 * ANGLE's D3D11 (it is most of a cold start), so materials that differ only
 * in numbers share one. A plain material takes 1 x 1 maps (PLAIN), water
 * and ice the same features: the well's street is three programs (the
 * stone and everything opaque, the water, the instanced grass), plus the
 * flame's.
 *
 * The surfaces' textures are painted on the GPU (paint/painter.js) as soon
 * as the look's renderer exists.
 * ----------------------------------------------------------------------------
 */

import {
  MeshStandardMaterial, MeshPhysicalMaterial, DataTexture, RGBAFormat, UnsignedByteType, SRGBColorSpace, Vector2, Vector4, Color, Texture,
  DoubleSide,
} from 'three';
import { SURFACES, SURFACE_SET, surfaceSize, nameSeed } from './surfaces.js';
import { Field } from './texgen.js';
import { painterFor, surfaceTargets } from './paint/painter.js';

/** A 1 x 1 white texture, the AO input until look.js gives the real one. */
const WHITE = (() => {
  const t = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat, UnsignedByteType);
  t.needsUpdate = true;
  return t;
})();

/** A 1 x 1 texture of one colour (RGBA bytes); `srgb` for a colour map. */
function plainTexture(rgba, srgb = false) {
  const t = new DataTexture(new Uint8Array(rgba), 1, 1, RGBAFormat, UnsignedByteType);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * The maps of a material without a surface: white, a flat normal, and
 * occlusion, roughness and metalness of 1 (the material's own numbers
 * stand). With them a plain material has the very maps a painted one has,
 * so both share one program: a program on ANGLE's D3D11 costs a few
 * hundred milliseconds to make, a texture fetch from a 1 x 1 texture
 * nothing.
 */
const PLAIN = {
  map: plainTexture([255, 255, 255, 255], true),
  normalMap: plainTexture([128, 128, 255, 255]),
  orm: plainTexture([255, 255, 255, 255]),
};

/** What every patched material reads: look.js and the lab set these. */
export const LOOK = {
  uniforms: {
    uLookTime: { value: 0 },
    uLookSnow: { value: 0 },
    uLookWet: { value: 0 },
    uLookAO: { value: /** @type {Texture} */ (WHITE) },
    uLookAOOn: { value: 0 },
    uLookRes: { value: new Vector2(1, 1) },
    uLookDirectAO: { value: 0.35 },
    uLookFade: { value: new Vector4(0, 0, 1e4, 1e4 + 1) },
    uLookFadeColor: { value: new Color(0x000000) },
    uLookWind: { value: new Vector2(0.6, 0.3) },
    uLookGrass: { value: new Vector4(1, 1, 1, 0) },
    // Nothing under this height is drawn (world y, metres): the game's models rise out of the
    // ground through it (its 3D ground writes no depth to hide them); the lab keeps it far below.
    uLookClipY: { value: -1e9 },
    // Metres in a unit of the world: 1 in the lab, 4 in the game (a tile), so the snow's and the
    // wet's noise is as fine on a game's well as on the lab's.
    uLookMetres: { value: 1 },
  },
  /** Max anisotropic filtering, set by look.js from the renderer before materials are made. */
  anisotropy: 8,
  /** The renderer the look draws with (look.js sets it): its GPU paints the surfaces. */
  renderer: null,
  /** Texture size factor (surfaces.js surfaceSize): 1; smaller for a quick check. */
  textureScale: 1,
};

const PARS = /* glsl */ `
uniform float uLookTime;
uniform float uLookSnow;
uniform float uLookWet;
uniform sampler2D uLookAO;
uniform float uLookAOOn;
uniform vec2 uLookRes;
uniform float uLookDirectAO;
uniform vec4 uLookFade;
uniform vec3 uLookFadeColor;
uniform vec2 uLookWind;
uniform vec4 uLookGrass;
uniform float uLookSnowMul;
uniform float uLookWetMul;
uniform vec2 uLookSway;
uniform float uLookKind;
uniform float uLookClipY;
uniform float uLookMetres;
uniform float uLookWorldUV;
varying vec3 vLookWPos;
varying vec3 vLookWNormal;
float lookHash( vec3 p ) {
  p = fract( p * 0.3183099 + 0.1 );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}
float lookNoise( vec3 x ) {
  vec3 i = floor( x );
  vec3 f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( mix( lookHash( i ), lookHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( lookHash( i + vec3( 0, 1, 0 ) ), lookHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
    mix( mix( lookHash( i + vec3( 0, 0, 1 ) ), lookHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( lookHash( i + vec3( 0, 1, 1 ) ), lookHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ),
    f.z );
}
`;

const VERT_WORLD = /* glsl */ `
#include <project_vertex>
{
  vec4 lw = vec4( transformed, 1.0 );
  vec3 ln = objectNormal;
  #ifdef USE_INSTANCING
    lw = instanceMatrix * lw;
    ln = mat3( instanceMatrix ) * ln;
  #endif
  lw = modelMatrix * lw;
  vLookWPos = lw.xyz * uLookMetres;
  vLookWNormal = normalize( mat3( modelMatrix ) * ln );
  // A town wall's stone (uLookWorldUV): its texture read at the world's metres on the face's own
  // plane, so a wall of many tiles, each a copy of a few pieces turned every way, is one surface
  // whose stones run on from tile to tile and never repeat with them (models/townWall.js).
  if ( uLookWorldUV > 0.5 ) {
    vec3 an = abs( vLookWNormal );
    vec2 wuv = an.y > max( an.x, an.z ) ? vLookWPos.xz : an.x > an.z ? vLookWPos.zy : vLookWPos.xy;
    #ifdef USE_MAP
      vMapUv = ( mapTransform * vec3( wuv, 1 ) ).xy;
    #endif
    #ifdef USE_NORMALMAP
      vNormalMapUv = ( normalMapTransform * vec3( wuv, 1 ) ).xy;
    #endif
    #ifdef USE_ROUGHNESSMAP
      vRoughnessMapUv = ( roughnessMapTransform * vec3( wuv, 1 ) ).xy;
    #endif
    #ifdef USE_METALNESSMAP
      vMetalnessMapUv = ( metalnessMapTransform * vec3( wuv, 1 ) ).xy;
    #endif
    #ifdef USE_AOMAP
      vAoMapUv = ( aoMapTransform * vec3( wuv, 1 ) ).xy;
    #endif
  }
}
`;

/**
 * Sway in the wind, more the higher up (uLookSway: x metres at the top, y
 * the full height in the mesh's own space; 0 for everything that stands
 * still, which a branch on a uniform skips at no cost, and one program
 * serves all). By the material's kind (uLookKind, LOOK_KIND):
 *   grass    each blade bends, quickly; under snow only the tips show
 *   wood     a tree's trunk and limbs: slower, the whole tree as one, the
 *            wind's way in the world whatever the tree's own turn (its
 *            instance matrix turns it: the offset is turned back into it)
 *   foliage  the same, and each spray flutters on its own, faster
 */
const VERT_SWAY = /* glsl */ `
#include <begin_vertex>
if ( uLookSway.x > 0.0 ) {
  vec4 root = vec4( 0.0, 0.0, 0.0, 1.0 );
  #ifdef USE_INSTANCING
    root = instanceMatrix * root;
  #endif
  root = modelMatrix * root;
  float k = clamp( position.y / uLookSway.y, 0.0, 1.0 );
  k *= k;
  if ( uLookKind < 1.5 ) {
    float ph = uLookTime * 1.7 + root.x * 0.9 + root.z * 0.7;
    float gust = 0.6 + 0.4 * sin( uLookTime * 0.45 + root.x * 0.15 );
    vec2 w = uLookWind * ( sin( ph ) * 0.6 + sin( ph * 2.3 + 1.3 ) * 0.25 ) * gust * k * uLookSway.x;
    transformed.x += w.x;
    transformed.z += w.y;
    // Under snow only the tips show.
    transformed.y = transformed.y * ( 1.0 - 0.4 * uLookSnow ) - 0.12 * uLookSnow * uLookSway.y;
  } else {
    // (root is in the world's units: a tile in the game, a metre in the lab; uLookMetres makes it metres.)
    vec2 rm = root.xz * uLookMetres;
    float ph = uLookTime * 0.9 + rm.x * 0.11 + rm.y * 0.08;
    float gust = 0.55 + 0.45 * sin( uLookTime * 0.31 + rm.x * 0.035 + rm.y * 0.02 );
    vec2 w = uLookWind * ( sin( ph ) * 0.7 + sin( ph * 2.7 + 0.8 ) * 0.2 ) * gust * k * uLookSway.x;
    vec3 wd = vec3( w.x, 0.0, w.y );
    #ifdef USE_INSTANCING
      mat3 im = mat3( instanceMatrix );
      wd = ( wd * im ) / length( im[0] );
    #endif
    transformed += wd;
    if ( uLookKind > 2.5 && uLookKind < 3.5 ) {
      float fl = sin( uLookTime * 5.3 + dot( position, vec3( 7.1, 3.7, 5.3 ) ) ) * 0.5 + sin( uLookTime * 8.9 + dot( position, vec3( 2.3, 6.1, 3.1 ) ) ) * 0.3;
      transformed += objectNormal * fl * 0.035 * gust * sqrt( k );
    }
  }
}
`;

/** The kinds of material uLookKind tells apart (see VERT_SWAY and FRAG_SURFACE). */
export const LOOK_KIND = Object.freeze({ PLAIN: 0, GRASS: 1, WOOD: 2, FOLIAGE: 3, IMPOSTOR: 4 });

const FRAG_SURFACE = /* glsl */ `
if ( vLookWPos.y < uLookClipY ) discard;
float lookAO = 1.0;
if ( uLookAOOn > 0.5 ) lookAO = texture2D( uLookAO, gl_FragCoord.xy / uLookRes ).r;
float lookSnowAmt = 0.0;
#ifdef DOUBLE_SIDED
  // Foliage: a spray seen from behind keeps the crown's outward normal (the card's own is only
  // its plane: a crown is lit as one mass, as foliage is).
  if ( uLookKind > 2.5 && uLookKind < 3.5 ) normal *= faceDirection;
#endif
if ( uLookSway.x > 0.0 && uLookKind < 1.5 ) {
  // Grass in another season (winter's straw): the blade keeps its light and shade, takes the colour.
  float lum = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, uLookGrass.rgb * lum * 2.6, uLookGrass.a );
}
{
  vec3 gn = normalize( vLookWNormal );
  vec3 sn = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
  // An impostor's card faces the camera (flora/impostors.js): its facing is its baked normal's.
  if ( uLookKind > 3.5 ) gn = sn;
  float cover = uLookSnow * uLookSnowMul;
  if ( cover > 0.0 ) {
    float n1 = lookNoise( vLookWPos * 1.7 );
    float n2 = lookNoise( vLookWPos * 9.0 + 3.1 );
    float n3 = lookNoise( vLookWPos * 37.0 );
    // How much a point faces up: the bumps of the surface (normal map) and its shape both count.
    // Snow fills small dips, so the shape's facing counts more than the bumps of the stone.
    float up = mix( gn.y, sn.y, 0.25 ) + ( n1 - 0.5 ) * 0.45 + ( n2 - 0.5 ) * 0.18 + ( 1.0 - lookAO ) * 0.3;
    float lo = mix( 1.15, 0.38, uLookSnow );
    lookSnowAmt = smoothstep( lo, lo + 0.18, up ) * smoothstep( -0.1, 0.25, gn.y );
    // Where little sticks (a trodden street), it lies in patches: trampled and swept between.
    float patchN = lookNoise( vLookWPos * 0.55 ) * 0.6 + lookNoise( vLookWPos * 2.7 + 7.0 ) * 0.4;
    // Trodden patches keep a thin dusting: the stone shows through, never a hole cut in the snow.
    lookSnowAmt *= mix( 0.3, 1.0, smoothstep( 0.9 - uLookSnowMul, 1.3 - uLookSnowMul, patchN + 0.15 ) );
    lookSnowAmt *= clamp( cover * 1.6, 0.0, 1.0 );
    vec3 snowCol = vec3( 0.83, 0.87, 0.93 ) * ( 0.94 + 0.06 * n3 );
    diffuseColor.rgb = mix( diffuseColor.rgb, snowCol, lookSnowAmt );
    roughnessFactor = mix( roughnessFactor, 0.5 + 0.25 * n3, lookSnowAmt );
    metalnessFactor = mix( metalnessFactor, 0.0, lookSnowAmt );
    // Snow fills the small dips: its surface follows the shape, not the stone's grain.
    vec3 vgn = normalize( ( viewMatrix * vec4( gn, 0.0 ) ).xyz );
    normal = normalize( mix( normal, vgn, lookSnowAmt ) );
  }
  // Wet with melt: darker and glossier where no snow lies.
  float wet = uLookWet * uLookWetMul * ( 1.0 - lookSnowAmt );
  diffuseColor.rgb *= 1.0 - wet * 0.22;
  roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.55, wet );
}
#include <emissivemap_fragment>
#if NUM_DIR_LIGHTS > 0
if ( uLookKind > 2.5 && uLookKind < 3.5 ) {
  // Light through the leaves: a crown with the sun behind it glows at its rim, and the sprays
  // turned from the sun are lit through (a thin leaf passes on a little of what falls on it).
  vec3 lookL = directionalLights[ 0 ].direction;
  float lookBack = pow( max( 0.0, -dot( normalize( vViewPosition ), lookL ) ), 3.0 ) * 0.55 + max( 0.0, -dot( normal, lookL ) ) * 0.45;
  totalEmissiveRadiance += diffuseColor.rgb * directionalLights[ 0 ].color * lookBack * 0.16 * ( 1.0 - lookSnowAmt );
}
#endif
`;

const FRAG_AO = /* glsl */ `
{
  float ambientOcclusion = lookAO;
  #ifdef USE_AOMAP
    // Snow fills the joints and pits the occlusion map darkens.
    ambientOcclusion *= mix( ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0, 1.0, lookSnowAmt );
  #endif
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  reflectedLight.directDiffuse *= mix( 1.0, lookAO, uLookDirectAO );
  #if defined( USE_CLEARCOAT )
    clearcoatSpecularIndirect *= ambientOcclusion;
  #endif
  #if defined( USE_SHEEN )
    sheenSpecularIndirect *= ambientOcclusion;
  #endif
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
  #endif
}
`;

const FRAG_FADE = /* glsl */ `
#include <opaque_fragment>
{
  // Square in the world, so a diamond on the screen: the patch reads as a piece of the game map.
  vec2 q = abs( vLookWPos.xz - uLookFade.xy );
  float d = max( q.x, q.y );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, uLookFadeColor, smoothstep( uLookFade.z, uLookFade.w, d ) );
}
`;

/**
 * Give a MeshStandardMaterial (or Physical) the look's shader patch.
 * `snow` is how much snow sticks (0..1), `wet` how much it darkens when wet,
 * `sway` (metres at the tip) bends the vertices with the wind, by their
 * height over `swayH` (a grass blade's own height, a tree's), as `kind`
 * (LOOK_KIND: grass by default when it sways) bends; `worldUV` reads the
 * textures at the world's metres on each face (a town wall's stone).
 */
export function patchLook(mat, { snow = 1, wet = 1, sway = 0, swayH = 1, kind = sway > 0 ? LOOK_KIND.GRASS : LOOK_KIND.PLAIN, worldUV = false } = {}) {
  const own = {
    uLookSnowMul: { value: snow }, uLookWetMul: { value: wet }, uLookSway: { value: new Vector2(sway, swayH) }, uLookKind: { value: kind },
    uLookWorldUV: { value: worldUV ? 1 : 0 },
  };
  mat.userData.look = own;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, LOOK.uniforms, own);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <begin_vertex>', VERT_SWAY)
      .replace('#include <project_vertex>', VERT_WORLD);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <emissivemap_fragment>', FRAG_SURFACE)
      .replace('#include <aomap_fragment>', FRAG_AO)
      .replace('#include <opaque_fragment>', FRAG_FADE);
  };
  // One key for every patched material: what differs between them is in uniforms, and three's own
  // parameters (maps, sides, instancing, lights) still part the programs that must differ.
  mat.customProgramCacheKey = () => 'look2';
  return mat;
}

/** Textures of each surface, made once. */
const TEXTURES = new Map();

/** Surfaces asked for since the last went to the painter (all go together: one compile, one go). */
let asked = [];

/**
 * The three textures of a surface: { map, normalMap, orm, metres, size,
 * maps, ready, whenReady }. Returned at once, at their final size: render
 * targets the GPU paints (paint/painter.js) as soon as its programs are
 * compiled, a fraction of a second after the look's renderer starts; until
 * then their pixels are undefined, so the lab draws its first frame only
 * once they are all in (surfacesReady). `maps` (with the height field, as
 * a Field, for the paving) is null until then; `whenReady` resolves to it.
 * `copy` names a second set painted alike (the well's water drifts its own
 * ripples, which a texture's own offset moves: it cannot share the ice's).
 */
export function surfaceTextures(name, copy = '') {
  const key = copy ? `${name}#${copy}` : name;
  let t = TEXTURES.get(key);
  if (t) return t;
  const size = surfaceSize(name, LOOK.textureScale);
  const metres = SURFACES[name].metres;
  const out = surfaceTargets(size, LOOK.anisotropy);
  t = {
    map: out.albedo.texture,
    normalMap: out.normal.texture,
    orm: out.orm.texture,
    out,
    name,
    metres,
    size,
    maps: null,
    ready: false,
  };
  t.whenReady = new Promise((resolve) => { t.resolveReady = resolve; });
  // UVs are in metres: one repeat of the texture covers `metres`.
  for (const k of ['map', 'normalMap', 'orm']) t[k].repeat.set(1 / metres, 1 / metres);
  // (Kept for the page, as the materials made on them are.)
  TEXTURES.set(key, t);
  asked.push(t);
  if (asked.length === 1) queueMicrotask(paintSurfaces);
  return t;
}

/**
 * Hand the surfaces asked for to the painter of the look's renderer
 * (look.js calls it once the renderer is made; until then they wait).
 */
export function paintSurfaces() {
  const r = LOOK.renderer;
  if (!r || !asked.length) return;
  const ts = asked;
  asked = [];
  const painter = painterFor(r);
  for (const t of ts) {
    painter.paint({
      set: SURFACE_SET, index: SURFACE_SET.names.indexOf(t.name), seed: nameSeed(t.name), size: t.size, out: t.out,
      readHeight: !!SURFACES[t.name].height, alpha: !!SURFACES[t.name].alpha,
    }).then((job) => {
      t.maps = { size: t.size, metres: t.metres, height: job.height ? Field.wrap(t.size, job.height) : null };
      t.ready = true;
      t.resolveReady(t.maps);
    }, (err) => {
      console.warn(`Texture ${t.name} could not be painted:`, err);
      t.ready = true;
      // (The models read it: a surface left unpainted would draw as garbage, so they give way to the sprites.)
      t.failed = true;
      failedCount++;
      t.resolveReady(null);
    });
  }
}

/** How many surfaces could not be painted (cheap: the models ask every frame). */
let failedCount = 0;
export function surfacesFailedCount() {
  return failedCount;
}

/** The surfaces that could not be painted on this GPU (their names). */
export function surfacesFailed() {
  const out = [];
  for (const t of TEXTURES.values()) if (t.failed) out.push(t.name);
  return out;
}

/** How many surfaces were asked for so far. */
export function surfacesAsked() {
  return TEXTURES.size;
}

/** How many surfaces are painted. */
export function surfacesCount() {
  let n = 0;
  for (const t of TEXTURES.values()) if (t.ready) n++;
  return n;
}

/** Are all the surfaces asked for so far painted (and the paving's height read back)? */
export function surfacesReady() {
  if (asked.length) return false;
  for (const t of TEXTURES.values()) if (!t.ready) return false;
  return true;
}

/** Materials made so far, by key. */
const CACHE = new Map();

/**
 * A material on a procedural surface, shared by key:
 *   surface   a SURFACES name (or null for a plain colour)
 *   color     a tint multiplied into the albedo (dyed wool, darker stone)
 *   rough     roughness multiplier; metal: metalness multiplier
 *   normal    normal map strength
 *   snow/wet  see patchLook
 *   vertexColors  the mesh's colours darken it (grime, baked occlusion); on
 *             by default, so a mesh needs its colours (merge() and
 *             tintGeometry() give them): one program for every material
 * A material without a surface takes the plain maps (PLAIN), so it shares
 * the painted ones' program.
 */
export function material(key, opts = {}) {
  let m = CACHE.get(key);
  if (m) return m;
  const {
    surface = null, color = 0xffffff, rough = 1, metal = 0, normal = 1, snow = 1, wet = 1, vertexColors = true,
    physical = false, side, sway = 0, swayH = 1, kind, emissive, emissiveIntensity, roughness, metalness, opacity, worldUV = false,
  } = opts;
  const p = { color: new Color(color), vertexColors };
  if (surface) {
    const t = surfaceTextures(surface);
    p.map = t.map;
    p.normalMap = t.normalMap;
    p.normalScale = new Vector2(normal, normal);
    p.roughnessMap = t.orm;
    p.metalnessMap = t.orm;
    p.aoMap = t.orm;
    p.roughness = rough;
    p.metalness = metal || (surface === 'bronze' || surface === 'iron' ? 1 : 0);
  } else {
    Object.assign(p, { map: PLAIN.map, normalMap: PLAIN.normalMap, roughnessMap: PLAIN.orm, metalnessMap: PLAIN.orm, aoMap: PLAIN.orm });
    p.roughness = roughness ?? 0.8;
    p.metalness = metalness ?? 0;
  }
  if (side !== undefined) p.side = side;
  if (emissive !== undefined) {
    p.emissive = new Color(emissive);
    p.emissiveIntensity = emissiveIntensity ?? 1;
  }
  // See-through (a stain on the stone, foam): blended over what is behind, writing no depth.
  if (opacity !== undefined) {
    p.transparent = true;
    p.opacity = opacity;
    p.depthWrite = false;
  }
  m = physical ? new MeshPhysicalMaterial(p) : new MeshStandardMaterial(p);
  m.name = key;
  patchLook(m, { snow, wet, sway, swayH, worldUV, ...(kind === undefined ? {} : { kind }) });
  CACHE.set(key, m);
  return m;
}

/** A clear coat too faint to see, which gives the water the ice's features (one program for both). */
const ICE_SHARE = 1e-4;

/** The water of the trough and the well: dark, glassy, reflecting the sky, its ripples drifting (look.js moves them). */
export function waterMaterial() {
  let m = CACHE.get('water');
  if (m) return m;
  // Its own copy of the ripples, whose offset drifts (look.js moves it).
  const nm = surfaceTextures('ripples', 'water').normalMap;
  m = new MeshPhysicalMaterial({
    color: new Color('#1d5560'), // deep green-blue: a near-black read as a hole, not water
    roughness: 0.03,
    metalness: 0,
    ior: 1.333,
    normalMap: nm,
    normalScale: new Vector2(0.4, 0.4),
    transparent: true,
    opacity: 0.93,
    // (The faintest clear coat: the ice has one, and the same features make one program of both.)
    clearcoat: ICE_SHARE,
    clearcoatRoughness: 0.03,
  });
  m.name = 'water';
  patchLook(m, { snow: 0, wet: 0 });
  CACHE.set('water', m);
  return m;
}

/**
 * Shallow, clear water (the trough's): a green-blue tint over the stone
 * below, which shows through. The well's own water is deep and dark
 * (waterMaterial); this shares its ripples' normal map, so one offset
 * moves both.
 */
export function shallowWaterMaterial() {
  let m = CACHE.get('shallowWater');
  if (m) return m;
  const deep = waterMaterial();
  m = new MeshPhysicalMaterial({
    color: new Color('#4f8a86'),
    roughness: 0.04,
    metalness: 0,
    ior: 1.333,
    normalMap: deep.normalMap,
    normalScale: new Vector2(0.3, 0.3),
    transparent: true,
    opacity: 0.62,
    clearcoat: ICE_SHARE,
    clearcoatRoughness: 0.04,
  });
  m.name = 'shallow-water';
  patchLook(m, { snow: 0, wet: 0 });
  CACHE.set('shallowWater', m);
  return m;
}

/**
 * Running water (a fountain's stream from its spout, the sheet over the
 * lip): clear, bright where it catches the sky, its own copy of the
 * ripples scrolled fast along the flow (fountainLife moves it; meshes give
 * it UVs along the flow in metres). `sheet`: the thinner film running over
 * stone, more see-through.
 */
export function streamMaterial(sheet = false) {
  const key = sheet ? 'stream-sheet' : 'stream';
  let m = CACHE.get(key);
  if (m) return m;
  const nm = surfaceTextures('ripples', 'stream').normalMap;
  m = new MeshPhysicalMaterial({
    color: new Color(sheet ? '#7fa6a3' : '#a8cac8'),
    roughness: 0.04,
    metalness: 0,
    ior: 1.333,
    normalMap: nm,
    normalScale: sheet ? new Vector2(0.8, 0.8) : new Vector2(1.4, 1.4),
    transparent: true,
    opacity: sheet ? 0.3 : 0.5,
    clearcoat: ICE_SHARE,
    clearcoatRoughness: 0.04,
  });
  m.name = key;
  patchLook(m, { snow: 0, wet: 0 });
  CACHE.set(key, m);
  return m;
}

/**
 * The rings round the point where a stream falls into still water: the
 * water's own colour and gloss, with its own copy of the ripples scrolled
 * outward (meshes give it UVs with v along the radius).
 */
export function ringMaterial() {
  let m = CACHE.get('ring');
  if (m) return m;
  const nm = surfaceTextures('ripples', 'ring').normalMap;
  m = new MeshPhysicalMaterial({
    color: new Color('#1d5560'),
    roughness: 0.03,
    metalness: 0,
    ior: 1.333,
    normalMap: nm,
    normalScale: new Vector2(1.2, 1.2),
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    // (The rings fade out at their edges by their vertex colours' alpha.)
    vertexColors: true,
    clearcoat: ICE_SHARE,
    clearcoatRoughness: 0.03,
  });
  m.name = 'ring';
  patchLook(m, { snow: 0, wet: 0 });
  CACHE.set('ring', m);
  return m;
}

/** Stagnant water left in a dry tank: murky green-brown, still, a little scum dulling it. */
export function stagnantMaterial() {
  let m = CACHE.get('stagnant');
  if (m) return m;
  const deep = waterMaterial();
  m = new MeshPhysicalMaterial({
    color: new Color('#3d4a2f'),
    roughness: 0.16,
    metalness: 0,
    ior: 1.333,
    normalMap: deep.normalMap,
    normalScale: new Vector2(0.12, 0.12),
    transparent: true,
    opacity: 0.88,
    clearcoat: ICE_SHARE,
    clearcoatRoughness: 0.16,
  });
  m.name = 'stagnant';
  patchLook(m, { snow: 0.3, wet: 0 });
  CACHE.set('stagnant', m);
  return m;
}

/** Ice for winter: the water frozen, pale and dull, snow catching on it. */
export function iceMaterial() {
  let m = CACHE.get('ice');
  if (m) return m;
  const t = surfaceTextures('ripples');
  m = new MeshPhysicalMaterial({
    color: new Color('#7d8f96'),
    roughness: 0.35,
    metalness: 0,
    ior: 1.31,
    normalMap: t.normalMap,
    normalScale: new Vector2(0.08, 0.08),
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
    // Drawn with the water (transparent, but wholly opaque): the same features, one program.
    transparent: true,
    opacity: 1,
  });
  m.name = 'ice';
  patchLook(m, { snow: 0.45, wet: 0 });
  CACHE.set('ice', m);
  return m;
}

/**
 * Forget every texture and material made so far, freeing them: the game's
 * WebGL back end calls it when it is shut down, as its textures were
 * painted on its renderer (a new renderer paints its own).
 */
export function resetLook() {
  for (const t of TEXTURES.values()) for (const k of ['albedo', 'normal', 'orm']) t.out[k].dispose();
  for (const m of CACHE.values()) m.dispose();
  TEXTURES.clear();
  CACHE.clear();
  asked = [];
  failedCount = 0;
}

/** Every material made so far (the lab lists them, look.js frees them). */
export function allMaterials() {
  return [...CACHE.values()];
}

export { DoubleSide };
