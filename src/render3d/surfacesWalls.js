/**
 * surfacesWalls.js
 * ----------------------------------------------------------------------------
 * The town walls' masonry for the 3D look (models/townWall.js, turris.js),
 * recipes in the same terms as surfaces.js (paint/recipe.js says how one is
 * written), kept apart so the town's surfaces read as one list. surfaces.js
 * adds them to SURFACES.
 *
 *   polygonal   polygonal limestone masonry as at Cosa, Alatri and Norba:
 *               big many-sided blocks fitted dry, joint to joint, their
 *               faces left a little rough and cushioned, grey-white with
 *               lichen and rain streaks
 *   ashlar      tufa in squared courses (opus quadratum) as the Servian
 *               Wall: blocks about two Roman feet high, a course of
 *               stretchers over a course of headers, the soft stone worn
 *               round at the arrises, pitted, with black scoria specks
 *   ashlarLime  the same coursing in a hard pale limestone (Paestum's
 *               walls, the provinces' colonies): crisper arrises
 *
 * The walls take their UVs from the world (materials.js `worldUV`): a wall
 * of many tiles is one surface, and a repeat that is no multiple of a tile
 * (6 m, 4.8 m) never lines up with the tiles, so no tile's stones repeat on
 * the next. v runs up the wall.
 * ----------------------------------------------------------------------------
 */

import { fbm, cells } from './paint/recipe.js';
import { rgb, rgbs } from './paint/glsl.js';

/**
 * Polygonal masonry: Voronoi cells are convex polygons with straight sides,
 * which is what the builders of Cosa's and Alatri's walls cut: each block
 * dressed to fit the ones already set, joints tight enough to take no
 * mortar. Big blocks (five across a 6 m repeat) with, between them, some
 * places filled by smaller ones (a field of cells twice as fine, used
 * inside about two big cells in five), as the walls have them: the big
 * stones set first, the gaps packed with smaller polygons. Each face
 * cushioned and tipped by its own seed, the arrises rounded by weather,
 * chips knocked out of them; the joints hairline, dark only in their depth.
 */
const polygonal = {
  fields: {
    noise: {
      warpU: fbm(3, 3, 21), warpV: fbm(3, 3, 22),
      big: cells(5, 0, 1.0, { warp: { u: ['warpU', 0.08, -0.5], v: ['warpV', 0.08, -0.5] } }),
      small: cells(11, 1, 1.0, { warp: { u: ['warpU', 0.12, -0.5], v: ['warpV', 0.12, -0.5] } }),
      bump: fbm(18, 4, 1), chip: fbm(40, 3, 2), pits: cells(60, 3, 0.9),
    },
    glsl: `
      // Metres a cell unit (a 6 m repeat): the joint's width the same in both fields.
      bool packed = hash2( int( big.id ), 9, uSeed ) < 0.4;
      float e = packed ? min( small.edge * ${6 / 11}, big.edge * 1.2 ) : big.edge * 1.2;
      int id = packed ? int( small.id ) + 4096 : int( big.id );
      vec2 d = packed ? small.d * 0.8 : big.d;
      float tx = ( hash2( id, 4, uSeed ) - 0.5 ) * 0.3;
      float tz = ( hash2( id, 5, uSeed ) - 0.5 ) * 0.3;
      // A cushioned face: proud in its middle, falling toward its joints, tipped a little.
      float face = 0.62 + ( hash2( id, 1, uSeed ) - 0.5 ) * 0.12 + tx * d.x + tz * d.y - dot( d, d ) * 0.22;
      face += ( bump - 0.5 ) * 0.16;
      float pit = hash2( int( pits.id ), 2, uSeed ) < 0.12 ? sstep( 0.3, 0.1, pits.f1 ) * 0.08 : 0.0;
      // Tight joints (a centimetre): the stone rounds into them over a few more; chips at the arrises.
      float arris = sstep( 0.006, 0.045, e );
      float chipped = sstep( 0.62, 0.78, chip ) * ( 1.0 - sstep( 0.02, 0.1, e ) );
      float h = mix( 0.3, face - pit, arris ) - chipped * 0.14;
      return vec4( h, arris, float( id ), chipped );`,
  },
  blur: [4],
  colour: {
    noise: { tone: fbm(3, 4, 6), lichen: fbm(9, 4, 7), lichen2: fbm(26, 3, 8), streak: fbm(4, 3, 9, { sx: 0.08 }), grit: fbm(90, 2, 10) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      int id = int( F.z );
      vec3 stones[6] = ${rgbs(['#a99f8a', '#b8ab90', '#9c9686', '#b5a280', '#a8a090', '#bfb299'])};
      vec3 s = stones[int( hash2( id, 2, uSeed ) * 6.0 )];
      s *= 0.84 + hash2( id, 3, uSeed ) * 0.24;
      s = mix( s, ${rgb('#9c968a')}, sstep( 0.45, 0.8, tone ) * 0.35 );
      s *= 0.94 + grit * 0.1;
      // Fresh stone where a chip came off, paler.
      s = mix( s, ${rgb('#d8d0bc')}, F.w * 0.5 );
      // Grey-green and orange lichens (Xanthoria) in patches, rain streaks running down.
      s = mix( s, ${rgb('#8f9480')}, sstep( 0.6, 0.78, lichen ) * 0.45 );
      s = mix( s, ${rgb('#c08a3e')}, sstep( 0.74, 0.86, lichen2 ) * sstep( 0.4, 0.6, lichen ) * 0.35 );
      s = mix( s, ${rgb('#6e685c')}, sstep( 0.58, 0.82, streak ) * 0.3 );
      // The joint: a shadowed hairline, a little earth in it; the stone darkens toward it as it rounds.
      col = mix( ${rgb('#5c5446')}, s, sstep( 0.0, 0.7, F.y ) );
      col = mix( col, col * 0.62, cav * 0.6 );
      orm = vec3( 1.0 - max( ( 1.0 - F.y ) * 0.5, cav * 0.5 ), 0.84 + ( 1.0 - F.y ) * 0.1, 0.0 );`,
  },
  normal: { depth: 0.03 / 6.0 },
};

/**
 * Squared masonry in courses (opus quadratum): COURSES courses a repeat, a
 * course of stretchers (long blocks, 3 to 4 a repeat, their lengths
 * wandering) over a course of headers (the blocks' ends, about square),
 * dry-jointed. `soft` wears the arrises round and pits the face (tufa);
 * colours by the stone.
 */
function ashlarRecipe({ soft, stones, joint, lichenCol, specks }) {
  return {
    fields: {
      noise: { bump: fbm(20, 4, 1), chip: fbm(36, 3, 2), pits: cells(70, 3, 0.9), wear: fbm(5, 3, 3) },
      glsl: `
        const float COURSES = 8.0;
        int course = int( floor( uv.y * COURSES ) );
        float fv = fract( uv.y * COURSES );
        // Stretchers on even courses, headers on odd ones (the Servian Wall's bond).
        bool header = ( course & 1 ) == 1;
        // (Not "n": that is the texture's size, paint/recipe.js.)
        float per = header ? 8.0 : 4.0;
        float off = hash2( course, 7, uSeed );
        float x = uv.x * per + off;
        int i = int( floor( x ) );
        int k = ( ( i % int( per ) ) + int( per ) ) % int( per );
        float fu = fract( x );
        int id = course * 16 + k;
        // Distance to the block's edge, in metres-ish (a course is 0.6 m, a block 0.6 to 1.2 m).
        float du = min( fu, 1.0 - fu ) * ( header ? 0.6 : 1.2 );
        float dv = min( fv, 1.0 - fv ) * 0.6;
        float e = min( du, dv );
        float round_ = ${soft ? '0.045' : '0.018'};
        float arris = sstep( 0.004, round_, e );
        float face = 0.6 + ( hash2( id, 1, uSeed ) - 0.5 ) * 0.1 + ( bump - 0.5 ) * ${soft ? '0.14' : '0.08'};
        // A face a little proud in its middle, more on worn tufa.
        face -= ( ( fu - 0.5 ) * ( fu - 0.5 ) + ( fv - 0.5 ) * ( fv - 0.5 ) ) * ${soft ? '0.18' : '0.08'};
        float pit = hash2( int( pits.id ), 2, uSeed ) < ${soft ? '0.22' : '0.06'} ? sstep( 0.32, 0.08, pits.f1 ) * 0.1 : 0.0;
        float chipped = sstep( 0.64, 0.8, chip ) * ( 1.0 - sstep( 0.01, 0.08, e ) );
        float h = mix( 0.2, face - pit, arris ) - chipped * 0.15 - wear * ${soft ? '0.05' : '0.02'};
        return vec4( h, arris, float( id ), chipped );`,
    },
    blur: [3],
    colour: {
      noise: { tone: fbm(3, 4, 6), lichen: fbm(8, 4, 7), streak: fbm(4, 3, 9, { sx: 0.08 }), grit: fbm(90, 2, 10), speck: cells(120, 12, 0.9) },
      glsl: `
        float cav = cavity( F.x, B.x, 5.0 );
        int id = int( F.z );
        vec3 stones[4] = ${rgbs(stones)};
        vec3 s = stones[int( hash2( id, 2, uSeed ) * 4.0 )];
        s *= 0.92 + hash2( id, 3, uSeed ) * 0.14;
        s = mix( s, s * 0.82, sstep( 0.5, 0.8, tone ) * 0.5 );
        s *= 0.94 + grit * 0.1;
        ${specks ? `s = mix( s, ${rgb('#2c2824')}, hash2( int( speck.id ), 5, uSeed ) < 0.25 ? sstep( 0.22, 0.12, speck.f1 ) * 0.8 : 0.0 );` : ''}
        s = mix( s, s * 1.12, F.w * 0.5 );
        s = mix( s, ${rgb(lichenCol)}, sstep( 0.62, 0.8, lichen ) * 0.4 );
        s = mix( s, s * 0.7, sstep( 0.58, 0.82, streak ) * 0.35 );
        col = mix( ${rgb(joint)}, s, F.y );
        col = mix( col, col * 0.6, cav * 0.6 );
        orm = vec3( 1.0 - max( ( 1.0 - F.y ) * 0.55, cav * 0.55 ), ${soft ? '0.92' : '0.8'} + ( 1.0 - F.y ) * 0.06, 0.0 );`,
    },
    normal: { depth: (soft ? 0.024 : 0.016) / 4.8 },
  };
}

/** The walls' surfaces, in surfaces.js's form (metres a repeat, texture size, recipe). */
export const WALL_SURFACES = Object.freeze({
  polygonal: { metres: 6.0, size: 1024, ...polygonal },
  ashlar: {
    metres: 4.8,
    size: 1024,
    ...ashlarRecipe({ soft: true, stones: ['#b9a77e', '#a89a78', '#c2ad80', '#9e937a'], joint: '#4b4232', lichenCol: '#8c8f74', specks: true }),
  },
  ashlarLime: {
    metres: 4.8,
    size: 1024,
    ...ashlarRecipe({ soft: false, stones: ['#c2b59a', '#b7a98f', '#cbbd9f', '#aea28a'], joint: '#5a5242', lichenCol: '#9a9a84', specks: false }),
  },
});
