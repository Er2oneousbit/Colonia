/**
 * walkers/material.js
 * ----------------------------------------------------------------------------
 * The walkers' material: the people's (people/material.js: the look's light,
 * snow and rain, the clips baked into the bone texture, colours by slot),
 * with the top of its vertex shader in place of the route a building's actor
 * walks, since a walker's place, facing and clips change every frame.
 *
 * Every figure a walker is drawn with (the man, his wife and child behind
 * him, the mule he leads, the horses of a chariot) has a cell of FIGURE_TEXELS
 * texels in one float texture (FIGURES_ROW figures a row), written each frame
 * by the pass (pass.js) and uploaded as the rows it used: the only thing sent
 * to the GPU a frame, however many pieces each figure wears.
 *
 *   texel 0   x, y, z (metres in the view's tiles x TILE_M), facing (rad)
 *   texel 1   the clip playing and its time (s), the clip faded from and its time
 *   texel 2   the fade (1: all the clip playing), metres rolled (a cart's
 *             wheels), the gait (cycles of a beast's legs, 0..1)
 *   texel 3   (spare)
 *
 * A piece's instance names its figure (aActMisc.w); aActRoute holds its own
 * scale (a child's), whether it is rigid (a beast, a cart's wheel: 1) and a
 * beast's gait (0 a walk, 1 a trot) and bob. A rigid piece is not skinned:
 * its vertices name a hinge (aBones.x, walkers/beasts.js):
 *
 *   1      a wheel: turned by the metres rolled over its radius about the
 *          axle at height aWeights.y, z aWeights.z
 *   2..5   a leg's upper part (fore left, fore right, hind left, hind right),
 *          swung by the gait about its hip at (aWeights.y, aWeights.z) by
 *          aWeights.w at most
 *   6..9   the same leg's lower part: bent at the knee (aWeights.y, z) as it
 *          comes forward, and swung with the upper part about the hip
 *          (aBones.y, aBones.z: cm, z less 128)
 *   10     the neck and head: nodding with each step about the withers
 * ----------------------------------------------------------------------------
 */

import { MeshStandardMaterial, MeshDepthMaterial, MeshDistanceMaterial, DataTexture, RGBAFormat, FloatType, NearestFilter, Vector2 } from 'three';
import { patchLook, surfaceTextures, cachedMaterial } from '../materials.js';
import { patchPeopleShader } from '../people/material.js';

/** Figures a row of the figures' texture, and texels a figure. */
export const FIGURES_ROW = 256;
export const FIGURE_TEXELS = 4;
/** Floats a figure takes in the texture. */
export const FIGURE_FLOATS = FIGURE_TEXELS * 4;

/** The figures' texture's uniform (the pass swaps in a taller texture as more figures are wanted). */
const FIGURES = { value: null };

/** The figures' texture for `rows` rows (a new one: the uniform is pointed at it). */
export function figureTexture(rows) {
  const data = new Float32Array(FIGURES_ROW * FIGURE_FLOATS * rows);
  const t = new DataTexture(data, FIGURES_ROW * FIGURE_TEXELS, rows, RGBAFormat, FloatType);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  t.name = 'walker-figures';
  FIGURES.value = t;
  return t;
}

const PARS = /* glsl */ `
uniform highp sampler2D uWalkers;
`;

const MAIN = /* glsl */ `
void main() {
  float pYaw = 0.0;
  float pAdv = 0.0;
  mat4 pSkin = mat4( 1.0 );
  vec3 pWalk = vec3( 0.0 );
  {
    int fi = int( aActMisc.w + 0.5 );
    ivec2 fc = ivec2( ( fi % ${FIGURES_ROW} ) * ${FIGURE_TEXELS}, fi / ${FIGURES_ROW} );
    vec4 f0 = texelFetch( uWalkers, fc, 0 );
    vec4 f1 = texelFetch( uWalkers, fc + ivec2( 1, 0 ), 0 );
    vec4 f2 = texelFetch( uWalkers, fc + ivec2( 2, 0 ), 0 );
    pWalk = f0.xyz;
    pYaw = f0.w;
    if ( aActRoute.w < 0.5 ) {
      // A person: the clip playing, faded in over the one before.
      pSkin = peopleSkin( f1.x, f1.y );
      if ( f2.x < 0.999 ) {
        mat4 q = peopleSkin( f1.z, f1.w );
        pSkin = q + ( pSkin - q ) * f2.x;
      }
    } else {
      int h = int( aBones.x + 0.5 );
      if ( h > 0 ) {
        float a = 0.0;
        vec2 pv = aWeights.yz;
        mat4 outer = mat4( 1.0 );
        if ( h == 1 ) {
          a = f2.y / max( 0.05, aWeights.y );
        } else if ( h == 10 ) {
          a = aWeights.w * sin( 12.5663706 * f2.z );
        } else {
          // The legs' phases: a walk's four-beat (fore left, fore right, hind left, hind right), a trot's diagonals.
          int leg = ( h - 2 ) % 4;
          float ph = f2.z + ( aActRoute.z > 0.5
            ? ( leg == 0 || leg == 3 ? 0.0 : 0.5 )
            : ( leg == 0 ? 0.0 : leg == 1 ? 0.5 : leg == 2 ? 0.75 : 0.25 ) );
          float swing = -sin( 6.2831853 * ph );
          if ( h < 6 ) {
            a = aWeights.w * swing;
          } else {
            // The knee folds as the leg comes forward; the whole leg swings about the hip.
            a = aWeights.w * max( 0.0, -cos( 6.2831853 * ph ) );
            float b = 0.32 * swing;
            vec2 hp = vec2( aBones.y, aBones.z - 128.0 ) / 100.0;
            float cb = cos( b );
            float sb = sin( b );
            outer = mat4( 1.0, 0.0, 0.0, 0.0, 0.0, cb, sb, 0.0, 0.0, -sb, cb, 0.0,
              0.0, hp.x - cb * hp.x + sb * hp.y, hp.y - sb * hp.x - cb * hp.y, 1.0 );
          }
        }
        float c = cos( a );
        float s = sin( a );
        // A turn by a about the x axis through (0, pv.x, pv.y).
        pSkin = outer * mat4( 1.0, 0.0, 0.0, 0.0, 0.0, c, s, 0.0, 0.0, -s, c, 0.0,
          0.0, pv.x - c * pv.x + s * pv.y, pv.y - s * pv.x - c * pv.y, 1.0 );
      }
      // A beast's back rises and falls with each step.
      pWalk.y += aActRoute.y * ( 0.5 - 0.5 * cos( 12.5663706 * f2.z ) );
    }
  }
`;

/** After the rest pose is placed and turned: the figure's own scale, and its place. */
const BEGIN = /* glsl */ `
transformed = transformed * aActRoute.x + pWalk;
`;

const VARIANT = Object.freeze({ uniforms: { uWalkers: FIGURES }, pars: PARS, main: MAIN, begin: BEGIN });

/** The walkers' material (the people's, placed by the figures' texture). */
export function walkerMaterial() {
  return cachedMaterial('walkers', () => {
    const wool = surfaceTextures('wool');
    const m = new MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 1, vertexColors: false,
      map: wool.map, normalMap: wool.normalMap, normalScale: new Vector2(0.8, 0.8), roughnessMap: wool.orm, metalnessMap: wool.orm,
    });
    m.name = 'walkers';
    patchLook(m, { snow: 1, wet: 1 });
    const look = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      look(shader, renderer);
      patchPeopleShader(shader, false, VARIANT);
    };
    m.customProgramCacheKey = () => 'walkers1';
    return m;
  });
}

/** The walkers' shadow casters: the sun's depth and a lamp's distance, placed alike. */
export function walkerDepthMaterial(kind = 'depth') {
  return cachedMaterial(`walkers-${kind}`, () => {
    const m = kind === 'depth' ? new MeshDepthMaterial() : new MeshDistanceMaterial();
    m.onBeforeCompile = (shader) => patchPeopleShader(shader, true, VARIANT);
    m.customProgramCacheKey = () => `walkers-${kind}1`;
    return m;
  });
}
