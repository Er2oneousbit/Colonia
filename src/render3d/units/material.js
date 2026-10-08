/**
 * units/material.js
 * ----------------------------------------------------------------------------
 * The units' material: the people's (people/material.js: the look's light,
 * snow and rain, the human clips baked into the bone texture, colours by
 * slot) with the top of its vertex shader in place of a building actor's
 * route, as the walkers' (walkers/material.js), reading a float texture of
 * figures written each frame (units/pass.js), plus:
 *
 *   - the beasts (quadRig.js, quadMesh.js): skinned to their own skeleton
 *     from their own baked clips (uBeastBones, uBeastClips), a wolf, a horse
 *     or an elephant playing its gait by the ground it covers;
 *   - a rider's pitch and roll: a man in the saddle rocks with his horse's
 *     back (its seat's track, quadRig.js riderAt), turned about his hips;
 *   - cloth that waves: a flag's vertices carry how far they are from the
 *     staff in their fourth bone (aBones.w 200 and up, its weight 0: no
 *     bone of the rig is numbered so high), and ripple with the clock.
 *
 *   texel 0   x, y, z (metres in the view's tiles x TILE_M), facing (rad)
 *   texel 1   the clip playing and its time (s), the clip faded from and its time
 *   texel 2   the fade (1: all the clip playing), metres rolled (a wheel's),
 *             the gait's cycle (a hinged beast's), how much it moves
 *   texel 3   a person: pitch and roll (rad) about the hips; a rope: its
 *             length and the rise of its far end (m)
 *
 * aActRoute.w says what a piece is: 0 a person, 1 a hinged rigid piece (a
 * chariot's wheels: walkers/beasts.js), 2 a rope, 3 a skinned beast.
 * ----------------------------------------------------------------------------
 */

import { MeshStandardMaterial, MeshDepthMaterial, MeshDistanceMaterial, DataTexture, RGBAFormat, FloatType, NearestFilter, Vector2, Vector4 } from 'three';
import { patchLook, surfaceTextures, cachedMaterial, LOOK } from '../materials.js';
import { patchPeopleShader } from '../people/material.js';
import { bakeBeasts, QBONE_COUNT } from './quadRig.js';

/** Figures a row of the units' texture, and texels a figure (as the walkers'). */
export const UNIT_FIGURES_ROW = 256;
export const UNIT_FIGURE_TEXELS = 4;
export const UNIT_FIGURE_FLOATS = UNIT_FIGURE_TEXELS * 4;
/** aBones.w at and over this marks a waving vertex (its distance from the staff: (w - WAVE_BASE) / WAVE_SCALE m). */
export const WAVE_BASE = 200;
export const WAVE_SCALE = 50;

/** The units' texture's uniform (the pass swaps in a taller texture as more figures are wanted). */
const FIGURES = { value: null };

/** The figures' texture for `rows` rows (a new one: the uniform points at it). */
export function unitFigureTexture(rows) {
  const data = new Float32Array(UNIT_FIGURES_ROW * UNIT_FIGURE_FLOATS * rows);
  const t = new DataTexture(data, UNIT_FIGURES_ROW * UNIT_FIGURE_TEXELS, rows, RGBAFormat, FloatType);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  t.name = 'unit-figures';
  FIGURES.value = t;
  return t;
}

/** The beasts' baked clips as a texture (QBONE_COUNT x 3 texels a row, a row a frame), and their table. */
let BEASTS = null;
function beastUniforms() {
  if (BEASTS) return BEASTS;
  const b = bakeBeasts();
  const t = new DataTexture(b.data, QBONE_COUNT * 3, b.rows, RGBAFormat, FloatType);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  t.name = 'beast-bones';
  BEASTS = {
    uUnits: FIGURES,
    uBeastBones: { value: t },
    uBeastClips: { value: b.table.map((c) => new Vector4(c.start, c.frames, c.fps, c.stride)) },
  };
  return BEASTS;
}

const PARS = () => /* glsl */ `
uniform highp sampler2D uUnits;
uniform highp sampler2D uBeastBones;
uniform vec4 uBeastClips[ ${bakeBeasts().table.length} ];
mat4 beastBone( float row, float b ) {
  ivec2 c = ivec2( int( b + 0.5 ) * 3, int( row + 0.5 ) );
  vec4 r0 = texelFetch( uBeastBones, c, 0 );
  vec4 r1 = texelFetch( uBeastBones, c + ivec2( 1, 0 ), 0 );
  vec4 r2 = texelFetch( uBeastBones, c + ivec2( 2, 0 ), 0 );
  return mat4( r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0 );
}
mat4 beastFrame( float row ) {
  mat4 m = aWeights.x * beastBone( row, aBones.x );
  if ( aWeights.y > 0.0 ) m += aWeights.y * beastBone( row, aBones.y );
  if ( aWeights.z > 0.0 ) m += aWeights.z * beastBone( row, aBones.z );
  if ( aWeights.w > 0.0 ) m += aWeights.w * beastBone( row, aBones.w );
  return m;
}
mat4 beastSkin( float clip, float time ) {
  vec4 c = uBeastClips[ int( clip + 0.5 ) ];
  float f = mod( time * c.z, c.y );
  float f0 = floor( f );
  float k = f - f0;
  mat4 a = beastFrame( c.x + f0 );
  mat4 b = beastFrame( c.x + mod( f0 + 1.0, c.y ) );
  return a + ( b - a ) * k;
}
`;

const MAIN = /* glsl */ `
void main() {
  float pYaw = 0.0;
  float pAdv = 0.0;
  mat4 pSkin = mat4( 1.0 );
  vec3 pWalk = vec3( 0.0 );
  {
    int fi = int( aActMisc.w + 0.5 );
    ivec2 fc = ivec2( ( fi % ${UNIT_FIGURES_ROW} ) * ${UNIT_FIGURE_TEXELS}, fi / ${UNIT_FIGURES_ROW} );
    vec4 f0 = texelFetch( uUnits, fc, 0 );
    vec4 f1 = texelFetch( uUnits, fc + ivec2( 1, 0 ), 0 );
    vec4 f2 = texelFetch( uUnits, fc + ivec2( 2, 0 ), 0 );
    vec4 f3 = texelFetch( uUnits, fc + ivec2( 3, 0 ), 0 );
    pWalk = f0.xyz;
    pYaw = f0.w;
    float kind = aActRoute.w;
    if ( kind < 0.5 ) {
      // A person: the clip playing, faded in over the one before.
      pSkin = peopleSkin( f1.x, f1.y );
      if ( f2.x < 0.999 ) {
        mat4 q = peopleSkin( f1.z, f1.w );
        pSkin = q + ( pSkin - q ) * f2.x;
      }
      // A rider rocked with his mount's back: pitched (and rolled) about his hips.
      if ( abs( f3.x ) + abs( f3.y ) > 1e-4 ) {
        float cp = cos( f3.x );
        float sp = sin( f3.x );
        float cr = cos( f3.y );
        float sr = sin( f3.y );
        mat4 rx = mat4( 1.0, 0.0, 0.0, 0.0, 0.0, cp, sp, 0.0, 0.0, -sp, cp, 0.0, 0.0, 0.0, 0.0, 1.0 );
        mat4 rz = mat4( cr, sr, 0.0, 0.0, -sr, cr, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0 );
        mat4 to = mat4( 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.95, 0.0, 1.0 );
        mat4 from = mat4( 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, -0.95, 0.0, 1.0 );
        pSkin = to * rz * rx * from * pSkin;
      }
    } else if ( kind > 2.5 ) {
      // A beast on its own skeleton.
      pSkin = beastSkin( f1.x, f1.y );
      if ( f2.x < 0.999 ) {
        mat4 q = beastSkin( f1.z, f1.w );
        pSkin = q + ( pSkin - q ) * f2.x;
      }
    } else if ( kind > 1.5 ) {
      // A rope: its metre stretched to the length asked, its far end raised or lowered.
      pSkin = mat4( 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, f3.y, f3.x, 0.0, 0.0, 0.0, 0.0, 1.0 );
    } else {
      // A hinged rigid piece (a chariot): a wheel turned by the metres rolled.
      int h = int( aBones.x + 0.5 );
      if ( h == 1 ) {
        float a = f2.y / max( 0.05, aWeights.y );
        float c = cos( a );
        float s = sin( a );
        vec2 pv = aWeights.yz;
        pSkin = mat4( 1.0, 0.0, 0.0, 0.0, 0.0, c, s, 0.0, 0.0, -s, c, 0.0,
          0.0, pv.x - c * pv.x + s * pv.y, pv.y - s * pv.x - c * pv.y, 1.0 );
      }
    }
  }
`;

/** After the rest pose is placed and turned: a flag's ripple, the figure's own scale, and its place. */
const BEGIN = /* glsl */ `
if ( aBones.w > ${WAVE_BASE - 0.5}.0 && aActRoute.w < 0.5 ) {
  // A flag's cloth: a travelling wave out from its staff, growing with the distance, along the cloth's normal.
  float d = ( aBones.w - ${WAVE_BASE}.0 ) / ${WAVE_SCALE}.0;
  vec3 n = normalize( mat3( pSkin ) * normal );
  n = vec3( cos( pYaw ) * n.x + sin( pYaw ) * n.z, n.y, -sin( pYaw ) * n.x + cos( pYaw ) * n.z );
  float ph = uLookTime * 5.5 - d * 9.0 + ( pWalk.x + pWalk.z ) * 0.37;
  transformed += n * d * ( 0.06 * sin( ph ) + 0.025 * sin( ph * 2.3 + 1.0 ) );
}
transformed = transformed * aActRoute.x + pWalk;
`;

const VARIANT = { uniforms: null, pars: '', main: MAIN, begin: BEGIN };

/** The variant handed to the people's patch (made once: the beasts' table is baked on first use). */
function variant() {
  if (!VARIANT.uniforms) {
    VARIANT.uniforms = beastUniforms();
    VARIANT.pars = PARS();
  }
  return VARIANT;
}

/** The units' material (the people's, placed by the units' texture, the beasts skinned their own way). */
export function unitMaterial() {
  return cachedMaterial('units', () => {
    const wool = surfaceTextures('wool');
    const m = new MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 1, vertexColors: false,
      map: wool.map, normalMap: wool.normalMap, normalScale: new Vector2(0.8, 0.8), roughnessMap: wool.orm, metalnessMap: wool.orm,
    });
    m.name = 'units';
    patchLook(m, { snow: 1, wet: 1 });
    const look = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      look(shader, renderer);
      patchPeopleShader(shader, false, variant());
    };
    m.customProgramCacheKey = () => 'units1';
    return m;
  });
}

/** The units' shadow casters: the sun's depth and a lamp's distance, placed alike. */
export function unitDepthMaterial(kind = 'depth') {
  return cachedMaterial(`units-${kind}`, () => {
    const m = kind === 'depth' ? new MeshDepthMaterial() : new MeshDistanceMaterial();
    m.onBeforeCompile = (shader) => {
      patchPeopleShader(shader, true, variant());
      // (The flag's ripple reads the normal and the clock: a depth shader declares neither until asked.)
      shader.uniforms.uLookTime = LOOK.uniforms.uLookTime;
    };
    m.customProgramCacheKey = () => `units-${kind}1`;
    return m;
  });
}
