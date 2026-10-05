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
 * them all); per-material numbers sit in each material's own uniforms.
 * ----------------------------------------------------------------------------
 */

import {
  MeshStandardMaterial, MeshPhysicalMaterial, DataTexture, RGBAFormat, UnsignedByteType, Vector2, Vector4, Color, Texture, DoubleSide,
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
  vLookWPos = lw.xyz;
  vLookWNormal = normalize( mat3( modelMatrix ) * ln );
}
`;

/** Grass: bends with the wind, more the higher up the blade (LOOK_SWAY_H metres is a blade's full height in its own space). */
const VERT_SWAY = /* glsl */ `
#include <begin_vertex>
#ifdef LOOK_SWAY
{
  vec4 root = vec4( 0.0, 0.0, 0.0, 1.0 );
  #ifdef USE_INSTANCING
    root = instanceMatrix * root;
  #endif
  root = modelMatrix * root;
  float k = clamp( position.y / LOOK_SWAY_H, 0.0, 1.0 );
  k *= k;
  float ph = uLookTime * 1.7 + root.x * 0.9 + root.z * 0.7;
  float gust = 0.6 + 0.4 * sin( uLookTime * 0.45 + root.x * 0.15 );
  vec2 w = uLookWind * ( sin( ph ) * 0.6 + sin( ph * 2.3 + 1.3 ) * 0.25 ) * gust * k * LOOK_SWAY;
  transformed.x += w.x;
  transformed.z += w.y;
  // Under snow only the tips show.
  transformed.y = transformed.y * ( 1.0 - 0.4 * uLookSnow ) - 0.12 * uLookSnow * LOOK_SWAY_H;
}
#endif
`;

const FRAG_SURFACE = /* glsl */ `
float lookAO = 1.0;
if ( uLookAOOn > 0.5 ) lookAO = texture2D( uLookAO, gl_FragCoord.xy / uLookRes ).r;
float lookSnowAmt = 0.0;
#ifdef LOOK_SWAY
  // Grass in another season (winter's straw): the blade keeps its light and shade, takes the colour.
  {
    float lum = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, uLookGrass.rgb * lum * 2.6, uLookGrass.a );
  }
#endif
{
  vec3 gn = normalize( vLookWNormal );
  vec3 sn = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
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
 * height over `swayH` (a grass blade's own height).
 */
export function patchLook(mat, { snow = 1, wet = 1, sway = 0, swayH = 1 } = {}) {
  const own = { uLookSnowMul: { value: snow }, uLookWetMul: { value: wet } };
  mat.userData.look = own;
  if (sway) {
    mat.defines = { ...(mat.defines || {}), LOOK_SWAY: sway.toFixed(4), LOOK_SWAY_H: swayH.toFixed(4) };
  }
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
  mat.customProgramCacheKey = () => `look1${sway ? 's' : ''}`;
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
      readHeight: !!SURFACES[t.name].height,
    }).then((job) => {
      t.maps = { size: t.size, metres: t.metres, height: job.height ? Field.wrap(t.size, job.height) : null };
      t.ready = true;
      t.resolveReady(t.maps);
    }, (err) => {
      console.warn(`Texture ${t.name} could not be painted:`, err);
      t.ready = true;
      t.resolveReady(null);
    });
  }
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
 *   vertexColors  the mesh's colours darken it (grime, baked occlusion)
 */
export function material(key, opts = {}) {
  let m = CACHE.get(key);
  if (m) return m;
  const {
    surface = null, color = 0xffffff, rough = 1, metal = 0, normal = 1, snow = 1, wet = 1, vertexColors = false,
    physical = false, side, sway = 0, swayH = 1, emissive, emissiveIntensity, roughness, metalness,
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
    p.roughness = roughness ?? 0.8;
    p.metalness = metalness ?? 0;
  }
  if (side !== undefined) p.side = side;
  if (emissive !== undefined) {
    p.emissive = new Color(emissive);
    p.emissiveIntensity = emissiveIntensity ?? 1;
  }
  m = physical ? new MeshPhysicalMaterial(p) : new MeshStandardMaterial(p);
  m.name = key;
  patchLook(m, { snow, wet, sway, swayH });
  CACHE.set(key, m);
  return m;
}

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
  });
  m.name = 'shallow-water';
  patchLook(m, { snow: 0, wet: 0 });
  CACHE.set('shallowWater', m);
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
  });
  m.name = 'ice';
  patchLook(m, { snow: 0.45, wet: 0 });
  CACHE.set('ice', m);
  return m;
}

/** Every material made so far (the lab lists them, look.js frees them). */
export function allMaterials() {
  return [...CACHE.values()];
}

export { DoubleSide };
