/**
 * paint/recipe.js
 * ----------------------------------------------------------------------------
 * How a procedural texture is written down: a recipe is data and a little
 * GLSL, painted on the GPU (paint/painter.js) in stages, as a texture
 * artist would paint it in layers:
 *
 *   fields   the structure, per pixel: the height (x) and up to three more
 *            numbers the colour needs (masks, a stone's id, the distance to
 *            its joint), into a float texture F
 *   blur     a box blur of F's channels (`blur`: a radius in px for each),
 *            into B: the neighbourhood's average, which the cavity reads
 *            (how far a pixel sits below it), or a low-passed height
 *   colour   the albedo (sRGB, mixed as a painter mixes) and occlusion,
 *            roughness and metalness (or, for the ground, plants), per pixel
 *            from F, B and noises of its own; and `dec`, into the ORM's
 *            alpha (0 unless set): for the ground, what only shows in its
 *            season (flowers in a meadow, fresh leaves on a wood's floor)
 *   normal   a tangent-space normal map by Sobel from a mix of F's and B's
 *            channels (the height by default), `depth` deep
 *
 *   recipe = {
 *     fields: { noise: { name: spec, ... }, glsl: 'statements; return vec4(h, ...);' },
 *     blur: [rx, ry, rz, rw],
 *     colour: { noise: { ... }, glsl: 'statements setting col (vec3), orm (vec3), maybe dec (float)' },
 *     normal: { depth, F: [wx, wy, wz, ww], B: [...] },
 *   }
 *
 * A stage's noises are named specs (fbm(), ridge(), cells()), evaluated
 * before its code runs: its code reads them by name, a cells() spec as a
 * Cell (id, f1, edge, d). Seeds are offsets from the texture's own seed (a
 * uniform), so one program paints any number of textures of a recipe, and
 * one program holds many recipes (a uniform picks one): a texture is a set
 * of uniforms, not a program.
 *
 * In a stage's code: uv (the pixel's centre, 0..1), px (its column and
 * row), n (the texture's size), uSeed; in the colour stage F and B (the
 * pixel's fields and their blur). Helpers: paint/glsl.js.
 * ----------------------------------------------------------------------------
 */

import { GLSL_TOOLBOX, GLSL_NOISES, MAX_NOISES, NOISE, COORD } from './glsl.js';

/**
 * Fractal noise: `cells` lattice cells across for the first octave,
 * `octaves`, `seed` (added to the texture's), and options: gain (each
 * octave's share of the last, 0.5), sx (stretch along u: cells along u are
 * cells / sx), coord ('uv', 'vu' or 'diag'), warp ({ u: [name, scale,
 * offset], v: [...] }: the point moved by (that noise + offset) * scale).
 */
export function fbm(cells, octaves, seed, { gain = 0.5, sx = 1, coord = 'uv', warp = null } = {}) {
  return { kind: NOISE.FBM, cells, octaves, seed, gain, stretch: sx, jitter: 0, coord, warp };
}

/** Ridged noise: 1 on the line where fbm crosses its middle, falling away (veins, cracks). */
export function ridge(cells, octaves, seed, opts = {}) {
  return { ...fbm(cells, octaves, seed, opts), kind: NOISE.RIDGE };
}

/**
 * Voronoi cells: `cells` across (and round(cells * sy) down), `seed`, how
 * far each cell's point may stray from its square's middle (`jitter`,
 * 0..1); read as a Cell: id, f1 (distance to its point), edge (to its
 * nearest border), d (the pixel less its point), in cell units.
 */
export function cells(count, seed, jitter, { sy = 1, coord = 'uv', warp = null } = {}) {
  return { kind: NOISE.CELLS, cells: count, octaves: 0, seed, gain: 0, stretch: sy, jitter, coord, warp };
}

const COORDS = { uv: COORD.UV, vu: COORD.VU, diag: COORD.DIAG };

/**
 * A stage's noises as the uniform table paint/glsl.js reads (Float32Arrays
 * of MAX_NOISES vec4s: uNa, uNb, uNc, uNd) and the GLSL that names them.
 */
export function packNoises(noise = {}) {
  const names = Object.keys(noise);
  if (names.length > MAX_NOISES) throw new Error(`Too many noises (${names.length} > ${MAX_NOISES})`);
  const a = new Float32Array(MAX_NOISES * 4);
  const b = new Float32Array(MAX_NOISES * 4);
  const c = new Float32Array(MAX_NOISES * 4).fill(-1);
  const d = new Float32Array(MAX_NOISES * 4);
  const index = (name, at) => {
    const i = names.indexOf(name);
    if (i < 0 || i >= at) throw new Error(`A warp reads "${name}", which is not a noise listed before it`);
    return i;
  };
  const decl = [];
  names.forEach((name, k) => {
    const s = noise[name];
    const j = k * 4;
    if (!(s.coord in COORDS)) throw new Error(`Unknown coord "${s.coord}"`);
    a.set([s.kind, s.cells, s.octaves, s.seed], j);
    b.set([s.gain, s.stretch, s.jitter, COORDS[s.coord]], j);
    c.set([-1, 0, 0, -1], j);
    if (s.warp && s.warp.u) {
      const [src, scale, off = 0] = s.warp.u;
      c.set([index(src, k), scale, off], j);
    }
    if (s.warp && s.warp.v) {
      const [src, scale, off = 0] = s.warp.v;
      c[j + 3] = index(src, k);
      d.set([scale, off], j);
    }
    decl.push(s.kind === NOISE.CELLS ? `Cell ${name} = cellOf( ${k} );` : `float ${name} = nv[${k}].x;`);
  });
  return { a, b, c, d, count: names.length, decl: decl.join('\n  ') };
}

/** The stages of a recipe, packed once (noise tables and the GLSL that names them). */
export function packRecipe(recipe) {
  if (recipe.packed) return recipe.packed;
  const fields = packNoises(recipe.fields.noise);
  const colour = packNoises(recipe.colour.noise);
  const blur = [0, 0, 0, 0].map((z, i) => (recipe.blur && recipe.blur[i]) || 0);
  if (blur.some((r) => r < 0 || r > 8 || r !== Math.round(r))) throw new Error('A blur radius is a whole number of px, 0 to 8');
  const nrm = recipe.normal || {};
  const packed = {
    fields, colour, blur,
    normal: { depth: nrm.depth || 0, F: nrm.F || [1, 0, 0, 0], B: nrm.B || [0, 0, 0, 0] },
  };
  Object.defineProperty(recipe, 'packed', { value: packed, enumerable: false });
  return packed;
}

/**
 * The fragment shader of a program painting `recipes` (an array: the
 * uniform uRecipe is an index into it). uStage: 0 the fields, 1 the albedo
 * (alpha 1; for a ground layer, uGround 1, its height normalised by the
 * range in uRange; for a cut-out, uGround 2, the fields' w), 2 the occlusion, roughness and metalness (or plants),
 * with `dec` in the alpha.
 */
export function recipeShader(recipes) {
  const fns = [];
  const fieldCases = [];
  const colourCases = [];
  recipes.forEach((r, i) => {
    const p = packRecipe(r);
    fns.push(`vec4 fields${i}( vec2 uv, ivec2 px, int n ) {
  ${p.fields.decl}
  ${r.fields.glsl.trim()}
}
void colour${i}( vec2 uv, ivec2 px, int n, vec4 F, vec4 B, inout vec3 col, inout vec3 orm, inout float dec ) {
  ${p.colour.decl}
  ${r.colour.glsl.trim()}
}`);
    fieldCases.push(`    case ${i}: F = fields${i}( uv, px, n ); break;`);
    colourCases.push(`    case ${i}: colour${i}( uv, px, n, F, B, col, orm, dec ); break;`);
  });
  return `${GLSL_TOOLBOX}
${GLSL_NOISES}
uniform int uStage;
uniform int uRecipe;
uniform int uGround;
uniform float uSize;
uniform highp sampler2D uF;
uniform highp sampler2D uB;
uniform highp sampler2D uRange;
out vec4 outColor;

${fns.join('\n\n')}

void main() {
  ivec2 px = ivec2( gl_FragCoord.xy );
  int n = int( uSize );
  vec2 uv = ( vec2( px ) + 0.5 ) / uSize;
  paintNoises( uv );
  if ( uStage == 0 ) {
    vec4 F = vec4( 0.0 );
    switch ( uRecipe ) {
${fieldCases.join('\n')}
      default: break;
    }
    outColor = F;
    return;
  }
  vec4 F = texelFetch( uF, px, 0 );
  vec4 B = texelFetch( uB, px, 0 );
  vec3 col = vec3( 0.5 );
  vec3 orm = vec3( 1.0, 1.0, 0.0 );
  float dec = 0.0;
  switch ( uRecipe ) {
${colourCases.join('\n')}
    default: break;
  }
  if ( uStage == 1 ) {
    float a = 1.0;
    if ( uGround == 1 ) {
      vec2 r = texelFetch( uRange, ivec2( 0 ), 0 ).xy;
      a = r.y > r.x ? clamp( ( F.x - r.x ) / ( r.y - r.x ), 0.0, 1.0 ) : 0.0;
    } else if ( uGround == 2 ) {
      // A cut-out (a spray of leaves): its coverage, the fields' w.
      a = clamp( F.w, 0.0, 1.0 );
    }
    outColor = vec4( srgbToLinear( col ), a );
  } else {
    outColor = vec4( clamp( orm, 0.0, 1.0 ), clamp( dec, 0.0, 1.0 ) );
  }
}
`;
}

/**
 * The passes every recipe shares, in one program (uMode): 0 and 1 the box
 * blur along x and y (uRad: a radius per channel, wrapping), 2 and 3 the
 * range of the height (min, max) a block at a time (2 reads F's x, 3 an
 * earlier range's x and y), 4 the normal map by Sobel.
 */
export const UTIL_SHADER = `${GLSL_TOOLBOX}
uniform int uMode;
uniform highp sampler2D uSrc;
uniform highp sampler2D uSrc2;
uniform ivec4 uRad;
uniform int uBlock;
uniform vec4 uWF;
uniform vec4 uWB;
uniform float uK;
out vec4 outColor;

float nsrc( ivec2 q, int n ) {
  q = wrap2( q, n );
  return dot( texelFetch( uSrc, q, 0 ), uWF ) + dot( texelFetch( uSrc2, q, 0 ), uWB );
}

void main() {
  ivec2 px = ivec2( gl_FragCoord.xy );
  int n = textureSize( uSrc, 0 ).x;
  if ( uMode <= 1 ) {
    ivec2 dir = uMode == 0 ? ivec2( 1, 0 ) : ivec2( 0, 1 );
    int R = max( max( uRad.x, uRad.y ), max( uRad.z, uRad.w ) );
    vec4 s = vec4( 0.0 );
    for ( int k = -R; k <= R; k++ ) {
      vec4 v = texelFetch( uSrc, wrap2( px + dir * k, n ), 0 );
      s += v * vec4( lessThanEqual( ivec4( abs( k ) ), uRad ) );
    }
    outColor = s / vec4( uRad * 2 + 1 );
  } else if ( uMode <= 3 ) {
    float lo = 1e30;
    float hi = -1e30;
    for ( int j = 0; j < uBlock; j++ ) {
      for ( int i = 0; i < uBlock; i++ ) {
        vec4 v = texelFetch( uSrc, px * uBlock + ivec2( i, j ), 0 );
        lo = min( lo, v.x );
        hi = max( hi, uMode == 2 ? v.x : v.y );
      }
    }
    outColor = vec4( lo, hi, 0.0, 1.0 );
  } else {
    // Sobel: smoother than a plain difference, so a 1 px pore is not a spike. Green points to +v.
    float tl = nsrc( px + ivec2( -1, -1 ), n );
    float t = nsrc( px + ivec2( 0, -1 ), n );
    float tr = nsrc( px + ivec2( 1, -1 ), n );
    float l = nsrc( px + ivec2( -1, 0 ), n );
    float r = nsrc( px + ivec2( 1, 0 ), n );
    float bl = nsrc( px + ivec2( -1, 1 ), n );
    float b = nsrc( px + ivec2( 0, 1 ), n );
    float br = nsrc( px + ivec2( 1, 1 ), n );
    float dx = ( tr + 2.0 * r + br - tl - 2.0 * l - bl ) / 8.0;
    float dy = ( bl + 2.0 * b + br - tl - 2.0 * t - tr ) / 8.0;
    vec3 nn = normalize( vec3( -dx * uK, -dy * uK, 1.0 ) );
    outColor = vec4( nn * 0.5 + 0.5, 1.0 );
  }
}
`;
