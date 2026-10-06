/**
 * surfacesFlora.js
 * ----------------------------------------------------------------------------
 * The textures of the 3D countryside's trees and rocks (flora/), recipes in
 * the same terms as surfaces.js (paint/recipe.js says how one is written),
 * painted on the GPU with the rest.
 *
 * Sprays of foliage. A tree's crown is made of cards (flora/treeModel.js),
 * each showing a spray: a twig with its leaves, painted here leaf by leaf,
 * cut out by the alpha (`alpha: true`: the painter writes the fields' w,
 * the coverage, into the albedo's alpha, and the material cuts the card
 * there). Each texture holds four never-alike sprays (a 2 x 2 atlas; the
 * palm's fronds four side by side), the twig's foot at the bottom middle of
 * its cell. The leaves are painted a pale neutral green-grey with their own
 * light and shade, veins and edges; a card's vertex colour gives the
 * species' and the season's colour, so one texture serves a tree in every
 * season. The shapes, after the leaves themselves:
 *
 *   leaf-ovate     small oval leaves on short stalks (holm oak, laurel,
 *                  myrtle, wild cherry)
 *   leaf-lobed     the oak's leaf: rounded lobes, short stalk, clustered
 *                  toward the shoot's tip
 *   leaf-lance     narrow pointed leaves (willow, olive, almond)
 *   leaf-serrate   the chestnut's long toothed leaves
 *   leaf-palmate   the plane's hand-shaped leaf of five lobes
 *   leaf-deltoid   the poplar's broad-based leaf on its long flat stalk
 *   leaf-needle    the stone pine's paired needles in a brush round the
 *                  shoot
 *   leaf-scale     the cypress's flat sprays of scale leaves, branching
 *   leaf-frond     the date palm's frond: a rachis and its leaflets
 *   leaf-blossom   five-petalled flowers along a twig, a few young leaves
 *                  (self-coloured: the cherry's and almond's blossom)
 *
 * Bark and rock:
 *   bark-plates    the stone pine's: thick plates between deep fissures
 *   bark-mottle    the plane's: smooth, flaking in jigsaw patches of three
 *                  tones
 *   bark-smooth    smooth bark with lenticels in bands (cherry, poplar,
 *                  laurel, myrtle)
 *   crag           weathered limestone: solution pits and runnels, cracks,
 *                  crusts of grey-green, orange and black lichen
 *
 * UVs on a card are its cell's 0..1 (metres 1, so the texture is not
 * scaled); on bark and rock, metres as everywhere.
 * ----------------------------------------------------------------------------
 */

import { fbm, ridge, cells } from './paint/recipe.js';
import { rgb } from './paint/glsl.js';

/** A number as a GLSL float. */
const f = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));

/**
 * The GLSL that finds the pixel's cell of a cols x rows atlas: `c` (0..1 in
 * the cell), `cell` (its index), `cpx` (the cell's size in px).
 */
const CELL = (cols, rows) => `
      vec2 cc = uv * vec2( ${f(cols)}, ${f(rows)} );
      ivec2 ci = ivec2( floor( cc ) );
      vec2 c = fract( cc );
      int cell = ci.y * ${cols} + ci.x;
      float cpx = float( n ) / ${f(Math.max(cols, rows))};
      int sd = uSeed + cell * 101;`;

/**
 * The twig of a spray: a bowed line from its foot (0.5, 0.03) to its tip,
 * with (`sides`) two side twigs forking off it, one to either side, drawn
 * first (under the leaves): its coverage starts the spray's fields.
 */
const TWIG = (reach = 0.9, width = 0.011, sides = true) => `
      float bow = ( hash2( cell, 1, uSeed ) - 0.5 ) * 0.22;
      vec2 tA = vec2( 0.5, 0.03 );
      vec2 tM = vec2( 0.5 + bow * 0.55, 0.03 + ${f(reach)} * 0.5 );
      vec2 tT = vec2( 0.5 + bow, ${f(reach)} );
      // The side twigs: off the main one a third and a half of the way up, one each side.
      float sb = hash2( cell, 2, uSeed ) < 0.5 ? 1.0 : -1.0;
      vec2 d0 = normalize( tM - tA );
      vec2 d1 = normalize( tT - tM );
      float a1 = sb * ( 0.62 + 0.25 * hash2( cell, 3, uSeed ) );
      float a2 = -sb * ( 0.55 + 0.25 * hash2( cell, 4, uSeed ) );
      vec2 s1d = vec2( d0.x * cos( a1 ) - d0.y * sin( a1 ), d0.x * sin( a1 ) + d0.y * cos( a1 ) );
      vec2 s2d = vec2( d1.x * cos( a2 ) - d1.y * sin( a2 ), d1.x * sin( a2 ) + d1.y * cos( a2 ) );
      vec2 s1a = mix( tA, tM, 0.62 );
      vec2 s2a = mix( tM, tT, 0.12 );
      vec2 s1b = s1a + s1d * ${f(reach)} * 0.5;
      vec2 s2b = s2a + s2d * ${f(reach)} * 0.44;
      float twd = 1e9;
      {
        vec2 P0[4] = vec2[4]( tA, tM, s1a, s2a );
        vec2 P1[4] = vec2[4]( tM, tT, s1b, s2b );
        float W0[4] = float[4]( 1.0, 0.75, 0.65, 0.6 );
        for ( int g = 0; g < ${sides ? 4 : 2}; g++ ) {
          vec2 pa = c - P0[g];
          vec2 ba = P1[g] - P0[g];
          float kk = clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 );
          float wd = W0[g] * ( 1.0 - kk * 0.35 );
          twd = min( twd, length( pa - ba * kk ) / ( ${f(width)} * wd ) );
        }
      }
      float twc = clamp( ( 1.0 - twd ) * ${f(width)} * 0.8 * cpx + 0.5, 0.0, 1.0 );
      float h = twc * ( 0.35 + 0.25 * sqrt( max( 0.0, 1.0 - twd * twd ) ) );
      float cover = twc;
      float idv = -1.0;
      float vein = 0.0;`;

/**
 * Where leaf k (with r1 its random) grows, `per` leaves a twig: on the
 * main twig's upper part or a side twig (k % 3, with side twigs), the point
 * `at` and the twig's direction `tdir` there, t (0 foot, 1 tip) along it.
 */
const TWIG_AT = (sides, per) => `
        int j = ${sides ? 'k % 3' : '0'};
        float t = ( float( ${sides ? 'k / 3' : 'k'} ) + 0.5 + ( r1 - 0.5 ) * 0.6 ) / ${f(per)};
        vec2 at;
        vec2 tdir;
        if ( j == 0 ) {
          float tt = ${sides ? '0.42 + 0.58 * t' : '0.1 + 0.88 * t'};
          at = tt < 0.5 ? mix( tA, tM, tt * 2.0 ) : mix( tM, tT, tt * 2.0 - 1.0 );
          tdir = tt < 0.5 ? d0 : d1;
          t = tt;
        } else if ( j == 1 ) {
          at = mix( s1a, s1b, 0.12 + 0.88 * t );
          tdir = s1d;
        } else {
          at = mix( s2a, s2b, 0.12 + 0.88 * t );
          tdir = s2d;
        }`;

/**
 * A spray of flat leaves. `half` is the leaf's half width (in leaf lengths)
 * at s (0 its stalk's end, 1 its tip), a GLSL expression; `len` a leaf's
 * length and `pet` its stalk's, in cell widths; `angle` how far a leaf
 * turns from its twig (radians); `tipward` leaves crowded toward the twigs'
 * tips (the oak's clusters); `serr` teeth along the edge; `lobes` rounded
 * lobes along it.
 */
function leafSpray({ leaves, len, pet, half, angle = 0.8, tipward = 0, serr = 0, lobes = 0, reach = 0.8, sides = true }) {
  const per = sides ? Math.ceil(leaves / 3) : leaves;
  return `${CELL(2, 2)}
      ${TWIG(reach, 0.011, sides)}
      for ( int k = 0; k < ${leaves}; k++ ) {
        float r1 = hash2( k, cell, sd + 3 );
        float r2 = hash2( k, cell, sd + 5 );
        float r3 = hash2( k, cell, sd + 9 );
        ${TWIG_AT(sides, per)}
        ${tipward ? `t = mix( t, 1.0, ${f(tipward)} * 0.55 );` : ''}
        float side = ( ( k / ${sides ? 3 : 1} ) % 2 == 0 ) ? 1.0 : -1.0;
        float ang = side * ${f(angle)} * ( 0.75 + r2 * 0.5 ) * ( 1.0 - t * 0.4 );
        vec2 dir = vec2( tdir.x * cos( ang ) - tdir.y * sin( ang ), tdir.x * sin( ang ) + tdir.y * cos( ang ) );
        vec2 nrm = vec2( dir.y, -dir.x );
        float L = ${f(len)} * ( 0.72 + 0.32 * r3 ) * ( 1.0 - t * 0.3 );
        vec2 q = c - at;
        float sl = dot( q, dir ) / L;
        float s = ( sl - ${f(pet)} ) / ( 1.0 - ${f(pet)} );
        float w = dot( q, nrm ) / L;
        // The stalk: a thin line from the twig to the blade.
        float pd = abs( w ) * L * cpx;
        if ( sl > 0.0 && sl < ${f(pet)} + 0.02 && pd < 1.2 ) {
          float pc = clamp( 1.2 - pd, 0.0, 1.0 );
          h = mix( h, 0.42 + float( k ) * 0.004, pc );
          cover = cover + ( 1.0 - cover ) * pc;
          idv = mix( idv, -1.0, pc );
        }
        if ( s <= 0.0 || s >= 1.0 ) continue;
        float hw = ${half};
        ${serr ? `hw *= 1.0 - ${f(serr)} * sstep( 0.35, 0.65, fract( s * 13.0 ) ) * sstep( 0.05, 0.25, s ) * sstep( 0.98, 0.8, s );` : ''}
        ${lobes ? `hw *= 0.6 + 0.4 * pow( abs( cos( 3.14159 * ${f(lobes)} * s ) ), 0.6 );` : ''}
        float edge = ( hw - abs( w ) ) * L * cpx;
        float cov = clamp( edge + 0.5, 0.0, 1.0 ) * clamp( ( 1.0 - s ) * L * cpx * 2.0, 0.0, 1.0 );
        if ( cov <= 0.0 ) continue;
        float across = abs( w ) / max( hw, 1e-3 );
        // A low dome, the midrib a groove, side veins running toward the tip.
        float mid = exp( -abs( w ) * L * cpx / 0.9 );
        float side_ = sstep( 0.86, 1.0, cos( ( s * 9.0 - across * 1.6 ) * 6.28318 ) ) * ( 1.0 - across ) * sstep( 0.05, 0.2, s );
        float hk = 0.5 + float( k ) * 0.008 + 0.16 * ( 1.0 - across * across ) - 0.07 * mid - 0.025 * side_;
        h = mix( h, hk, cov );
        cover = cover + ( 1.0 - cover ) * cov;
        idv = mix( idv, r1, cov );
        vein = mix( vein, max( mid, side_ * 0.6 ), cov );
      }
      return vec4( h, idv, vein, cover );`;
}

/**
 * The plane's palmate leaves: each round its own middle, five pointed
 * lobes (the radius by the angle from the leaf's axis), veins from the
 * stalk's end to each lobe.
 */
function palmateSpray({ leaves = 9, len = 0.3 } = {}) {
  return `${CELL(2, 2)}
      ${TWIG(0.76)}
      for ( int k = 0; k < ${leaves}; k++ ) {
        float r1 = hash2( k, cell, sd + 3 );
        float r2 = hash2( k, cell, sd + 5 );
        ${TWIG_AT(true, Math.ceil(leaves / 3))}
        float side = ( ( k / 3 ) % 2 == 0 ) ? 1.0 : -1.0;
        float ang = side * ( 0.6 + r2 * 0.5 ) * ( 1.0 - t * 0.4 );
        vec2 dir = vec2( tdir.x * cos( ang ) - tdir.y * sin( ang ), tdir.x * sin( ang ) + tdir.y * cos( ang ) );
        vec2 nrm = vec2( dir.y, -dir.x );
        float L = ${f(len)} * ( 0.75 + 0.3 * r1 ) * ( 1.0 - t * 0.3 );
        vec2 q = c - at;
        float sl = dot( q, dir ) / L;
        float pd = abs( dot( q, nrm ) ) * cpx;
        if ( sl > 0.0 && sl < 0.3 && pd < 1.4 ) {
          float pc = clamp( 1.4 - pd, 0.0, 1.0 );
          h = mix( h, 0.42, pc );
          cover = cover + ( 1.0 - cover ) * pc;
          idv = mix( idv, -1.0, pc );
        }
        // The blade round a point beyond the stalk: five lobes drawn to points, deep sinuses.
        vec2 lc = q - dir * L * 0.6;
        float a = atan( dot( lc, nrm ), dot( lc, dir ) );
        float r = length( lc ) / ( L * 0.5 );
        float R = 0.55 + 0.45 * pow( abs( cos( a * 2.5 ) ), 1.3 );
        R *= 1.0 - 0.07 * sstep( 0.4, 0.6, fract( a * 11.0 ) );
        float cov = clamp( ( R - r ) * L * 0.5 * cpx + 0.5, 0.0, 1.0 );
        if ( cov <= 0.0 ) continue;
        // Veins from the blade's foot toward each lobe.
        vec2 lf = q - dir * L * 0.32;
        float va = atan( dot( lf, nrm ), dot( lf, dir ) );
        float vl = abs( sin( va * 2.5 ) ) * length( lf ) * cpx;
        float v = exp( -vl / 1.1 ) * sstep( 0.0, 0.1, length( lf ) );
        float hk = 0.5 + float( k ) * 0.015 + 0.14 * ( 1.0 - min( 1.0, r / R ) ) - 0.06 * v;
        h = mix( h, hk, cov );
        cover = cover + ( 1.0 - cover ) * cov;
        idv = mix( idv, r1, cov );
        vein = mix( vein, v, cov );
      }
      return vec4( h, idv, vein, cover );`;
}

/**
 * The stone pine's shoot: needles in pairs all along it, angled forward
 * and out, a brush of them at its tip; two shorter shoots off its foot.
 */
function needleSpray({ pairs = 22 } = {}) {
  return `${CELL(2, 2)}
      ${TWIG(0.7, 0.014)}
      for ( int k = 0; k < ${pairs + 8}; k++ ) {
        float r1 = hash2( k, cell, sd + 3 );
        float r2 = hash2( k, cell, sd + 5 );
        bool tip = k >= ${pairs};
        ${TWIG_AT(true, Math.ceil(pairs / 3))}
        if ( tip ) { at = tT; tdir = d1; t = 1.0; }
        for ( int jj = 0; jj < 2; jj++ ) {
          float side = ( ( k + jj ) % 2 == 0 ) ? 1.0 : -1.0;
          float ang = tip ? ( float( k - ${pairs} ) - 3.5 ) * 0.17 + ( r2 - 0.5 ) * 0.2 + float( jj ) * 0.08 : side * ( 0.4 + r2 * 0.6 + float( jj ) * 0.12 );
          vec2 dir = vec2( tdir.x * cos( ang ) - tdir.y * sin( ang ), tdir.x * sin( ang ) + tdir.y * cos( ang ) );
          float NL = ( tip ? 0.28 : 0.3 ) * ( 0.8 + 0.3 * hash2( k * 2 + jj, cell, sd + 11 ) ) * ( j == 0 ? 1.0 : 0.8 );
          // (Needles curve a little: their tips bend toward the shoot's.)
          vec2 q = c - at;
          float sl = clamp( dot( q, dir ) / NL, 0.0, 1.0 );
          vec2 p = dir * NL * sl + vec2( dir.y, -dir.x ) * side * sl * sl * NL * 0.12;
          float d = length( q - p ) * cpx;
          float wpx = mix( 1.4, 0.7, sl ) * cpx / 160.0;
          float cov = clamp( wpx - d + 0.5, 0.0, 1.0 ) * step( 0.0, dot( q, dir ) ) * step( dot( q, dir ), NL * 1.02 );
          if ( cov <= 0.0 ) continue;
          float hk = 0.5 + 0.2 * sqrt( max( 0.0, 1.0 - d * d / ( wpx * wpx + 1e-3 ) ) ) + sl * 0.12 + r2 * 0.05;
          if ( hk < h && cover > 0.6 ) cov *= 0.4;
          h = mix( h, hk, cov );
          cover = cover + ( 1.0 - cover ) * cov;
          idv = mix( idv, r1, cov );
          vein = mix( vein, sl, cov );
        }
      }
      return vec4( h, idv, vein, cover );`;
}

/**
 * The cypress's flat sprays: a main axis, side shoots alternating, each
 * with its own branchlets, every shoot a thick beaded cord of scale leaves
 * pressed close, so a spray reads as a dense flat frond.
 */
function scaleSpray() {
  return `${CELL(2, 2)}
      float h = 0.0;
      float cover = 0.0;
      float idv = 0.0;
      float vein = 0.0;
      float bow = ( hash2( cell, 1, uSeed ) - 0.5 ) * 0.12;
      vec2 A = vec2( 0.5, 0.03 );
      vec2 T = vec2( 0.5 + bow, 0.95 );
      for ( int k = 0; k < 53; k++ ) {
        // k 0 the axis; 1..12 the side shoots; the rest their branchlets (four a side shoot, 13..52).
        vec2 p0;
        vec2 p1;
        float wd;
        float lev;
        if ( k == 0 ) { p0 = A; p1 = T; wd = 0.03; lev = 0.0; }
        else if ( k <= 12 ) {
          float t = 0.1 + 0.85 * ( float( k ) - 0.5 ) / 12.0;
          float side = ( k % 2 == 0 ) ? 1.0 : -1.0;
          p0 = mix( A, T, t );
          float ang = side * ( 0.68 + 0.2 * hash2( k, cell, sd ) );
          vec2 dir = vec2( sin( ang ), cos( ang ) );
          p1 = p0 + dir * 0.4 * ( 1.0 - t * 0.6 );
          wd = 0.024;
          lev = 1.0;
        } else {
          int m = ( k - 13 ) / 4 + 1;
          int jj = ( k - 13 ) % 4;
          float t = 0.1 + 0.85 * ( float( m ) - 0.5 ) / 12.0;
          float side = ( m % 2 == 0 ) ? 1.0 : -1.0;
          vec2 b0 = mix( A, T, t );
          float ang = side * ( 0.68 + 0.2 * hash2( m, cell, sd ) );
          vec2 dir = vec2( sin( ang ), cos( ang ) );
          float BL = 0.4 * ( 1.0 - t * 0.6 );
          float u = 0.22 + 0.19 * float( jj );
          p0 = b0 + dir * BL * u;
          float sj = ( jj % 2 == 0 ) ? 1.0 : -1.0;
          float a2 = ang + sj * 0.7;
          p1 = p0 + vec2( sin( a2 ), cos( a2 ) ) * BL * 0.48 * ( 1.0 - u * 0.45 );
          wd = 0.019;
          lev = 2.0;
        }
        vec2 ba = p1 - p0;
        float bl = length( ba );
        float kk = clamp( dot( c - p0, ba ) / ( bl * bl ), 0.0, 1.0 );
        float d = length( c - p0 - ba * kk );
        float w = wd * ( 1.0 - kk * 0.4 );
        // Beads: the scale leaves in pairs along the cord.
        float bead = 0.5 + 0.5 * cos( kk * bl / ( w * 1.25 ) * 6.28318 );
        w *= 0.84 + 0.16 * bead;
        float cov = clamp( ( w - d ) * cpx + 0.5, 0.0, 1.0 );
        if ( cov <= 0.0 ) continue;
        float hk = 0.45 + lev * 0.08 + 0.2 * sqrt( max( 0.0, 1.0 - d * d / ( w * w ) ) ) + bead * 0.06;
        if ( hk < h ) cov *= 0.3;
        h = mix( h, hk, cov );
        cover = cover + ( 1.0 - cover ) * cov;
        idv = mix( idv, hash2( k, cell, sd + 7 ), cov );
        vein = mix( vein, bead, cov );
      }
      return vec4( h, idv, vein, cover );`;
}

/** The date palm's frond: a rachis up the cell's middle, leaflets each side angled toward the tip. */
function frondSpray({ leaflets = 30 } = {}) {
  return `${CELL(4, 1)}
      float h = 0.0;
      float cover = 0.0;
      float idv = -1.0;
      float vein = 0.0;
      // Measured in the frond's length (a cell is a quarter as wide as it is long): q.x * 0.25.
      float fpx = float( n );
      float rd = abs( c.x - 0.5 ) * 0.25 * fpx;
      float rw = mix( 2.4, 0.9, c.y ) * fpx / 512.0;
      float rc = clamp( rw - rd + 0.5, 0.0, 1.0 ) * step( c.y, 0.985 );
      h = rc * 0.6;
      cover = rc;
      for ( int k = 0; k < ${leaflets * 2}; k++ ) {
        float r1 = hash2( k, cell, sd + 3 );
        float side = ( k % 2 == 0 ) ? 1.0 : -1.0;
        float t = 0.05 + 0.92 * ( float( k / 2 ) + r1 * 0.5 ) / ${f(leaflets)};
        float ang = 0.62 + ( r1 - 0.5 ) * 0.22;
        vec2 dir = vec2( side * sin( ang ), cos( ang ) );
        vec2 q = vec2( ( c.x - 0.5 ) * 0.25, c.y - t );
        float L = 0.16 * sin( 3.14159 * ( 0.12 + t * 0.86 ) ) + 0.035;
        float s = dot( q, dir ) / L;
        float w = dot( q, vec2( dir.y, -dir.x ) ) / L;
        if ( s <= 0.0 || s >= 1.0 ) continue;
        float hw = 0.075 * pow( sin( 3.14159 * pow( s, 0.6 ) ), 0.8 );
        float cov = clamp( ( hw - abs( w ) ) * L * fpx + 0.5, 0.0, 1.0 );
        if ( cov <= 0.0 ) continue;
        float hk = 0.5 + 0.12 * ( 1.0 - abs( w ) / hw ) - 0.05 * exp( -abs( w ) * L * fpx / 0.7 );
        h = mix( h, hk, cov );
        cover = cover + ( 1.0 - cover ) * cov;
        idv = mix( idv, r1, cov );
        vein = mix( vein, s, cov );
      }
      return vec4( h, idv, vein, cover );`;
}

/**
 * Blossom: five-petalled flowers along a twig (the cherry's in clusters on
 * short spurs, the almond's singly), a few young leaves toward the tip.
 * F.y: 2 + the flower's middle (the stamens), 1..2 a petal, 0..1 a leaf.
 */
function blossomSpray({ flowers = 18 } = {}) {
  return `${CELL(2, 2)}
      ${TWIG(0.86, 0.013)}
      for ( int k = 0; k < ${flowers + 6}; k++ ) {
        float r1 = hash2( k, cell, sd + 3 );
        float r2 = hash2( k, cell, sd + 5 );
        bool leaf = k >= ${flowers};
        ${TWIG_AT(true, Math.ceil(flowers / 3))}
        // (The young leaves at the twigs' tips.)
        if ( leaf ) { t = 0.85 + 0.12 * r1; at = j == 0 ? mix( tM, tT, 0.9 ) : j == 1 ? mix( s1a, s1b, 0.95 ) : mix( s2a, s2b, 0.95 ); }
        float side = ( k % 2 == 0 ) ? 1.0 : -1.0;
        if ( leaf ) {
          float ang = side * ( 0.5 + r2 * 0.4 );
          vec2 dir = vec2( tdir.x * cos( ang ) - tdir.y * sin( ang ), tdir.x * sin( ang ) + tdir.y * cos( ang ) );
          float L = 0.16 + 0.05 * r1;
          vec2 q = c - at;
          float s = dot( q, dir ) / L;
          float w = dot( q, vec2( dir.y, -dir.x ) ) / L;
          if ( s <= 0.0 || s >= 1.0 ) continue;
          float hw = 0.2 * pow( sin( 3.14159 * s ), 1.0 );
          float cov = clamp( ( hw - abs( w ) ) * L * cpx + 0.5, 0.0, 1.0 );
          if ( cov <= 0.0 ) continue;
          h = mix( h, 0.5 + 0.1 * ( 1.0 - abs( w ) / hw ), cov );
          cover = cover + ( 1.0 - cover ) * cov;
          idv = mix( idv, r1 * 0.9, cov );
          vein = mix( vein, 0.0, cov );
          continue;
        }
        // A flower on a short stalk off the twig.
        float ang = side * ( 0.9 + r2 * 0.7 );
        vec2 dir = vec2( tdir.x * cos( ang ) - tdir.y * sin( ang ), tdir.x * sin( ang ) + tdir.y * cos( ang ) );
        float R = 0.062 + 0.022 * r2;
        vec2 fc = at + dir * ( R * 0.9 + 0.02 );
        vec2 lc = c - fc;
        float a = atan( lc.y, lc.x ) + r1 * 6.28;
        float r = length( lc ) / R;
        float P = 0.58 + 0.42 * pow( abs( cos( a * 2.5 ) ), 0.45 );
        float cov = clamp( ( P - r ) * R * cpx + 0.5, 0.0, 1.0 );
        if ( cov <= 0.0 ) continue;
        float cup = 1.0 - r / P;
        float mid = sstep( 0.3, 0.12, r );
        float hk = 0.55 + float( k ) * 0.01 + 0.1 * sqrt( max( 0.0, cup ) ) + mid * 0.05;
        h = mix( h, hk, cov );
        cover = cover + ( 1.0 - cover ) * cov;
        idv = mix( idv, 1.0 + min( 0.99, r / P ) + mid, cov );
        vein = mix( vein, abs( sin( a * 2.5 ) ) * r, cov );
      }
      return vec4( h, idv, vein, cover );`;
}

/**
 * The colour of a spray of leaves: a pale neutral green-grey with each
 * leaf a little lighter or darker (F.y), the veins paler, the edges and
 * where one leaf lies over another darker; the twig and stalks brown.
 * The background (cut away) holds the leaves' average, so the mipmaps do
 * not bleed a dark fringe round the leaves.
 */
const LEAF_COLOUR = {
  noise: { tone: fbm(6, 3, 21) },
  glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      vec3 leafc = ${rgb('#d4dac8')} * ( 0.86 + 0.24 * F.y + ( tone - 0.5 ) * 0.1 );
      leafc = mix( leafc, ${rgb('#eef0e2')}, F.z * 0.55 );
      vec3 twigc = ${rgb('#8a7a64')};
      col = F.y < -0.5 ? twigc : leafc;
      col = mix( ${rgb('#c8ceba')}, col, sstep( 0.02, 0.4, F.w ) );
      col = mix( col, col * 0.55, cav * 0.8 );
      orm = vec3( 1.0 - cav * 0.6, 0.78 - F.z * 0.08, 0.0 );`,
};

/** The blossom's own colours: white petals flushed pink at the base, yellow stamens, young green leaves. */
const BLOSSOM_COLOUR = {
  noise: { tone: fbm(6, 3, 23) },
  glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      vec3 petal = mix( ${rgb('#fbf7f2')}, ${rgb('#f0d2dc')}, sstep( 1.55, 1.15, F.y ) * 0.7 );
      petal = mix( petal, ${rgb('#e8c060')}, sstep( 2.2, 2.6, F.y ) );
      vec3 leafc = mix( ${rgb('#8fb04e')}, ${rgb('#a8c460')}, F.y );
      col = F.y < -0.5 ? ${rgb('#6a5040')} : F.y >= 1.0 ? petal : leafc;
      col = mix( ${rgb('#e6e2d8')}, col, sstep( 0.02, 0.4, F.w ) );
      col = mix( col, col * 0.6, cav * 0.7 );
      orm = vec3( 1.0 - cav * 0.5, 0.7, 0.0 );`,
};

/** A spray recipe from its fields' code, its colour and the depth of its relief. */
const spray = (glsl, colour = LEAF_COLOUR, depth = 0.012) => ({
  alpha: true,
  fields: { noise: {}, glsl },
  blur: [2],
  colour,
  normal: { depth },
});

/**
 * Pine bark: thick plates, longer than wide, parted by deep fissures, each
 * plate scaled in thin flakes; the fissures dark, the plates' faces paler
 * where the outer flakes have fallen.
 */
const barkPlates = {
  fields: {
    noise: {
      warpU: fbm(4, 2, 1), warpV: fbm(4, 2, 2),
      plate: cells(6, 3, 0.95, { sy: 2.6, warp: { u: ['warpU', 0.08, -0.5], v: ['warpV', 0.08, -0.5] } }),
      flake: fbm(28, 3, 4, { sx: 0.5 }), fine: fbm(60, 2, 5),
    },
    glsl: `
      float fis = sstep( 0.0, 0.07, plate.edge );
      float face = 0.55 + ( hash2( int( plate.id ), 1, uSeed ) - 0.5 ) * 0.2 - dot( plate.d, plate.d ) * 0.25;
      float h = mix( 0.05 + fine * 0.05, face + flake * 0.18, fis );
      return vec4( h, fis, plate.id, flake );`,
  },
  blur: [3],
  colour: {
    noise: { tone: fbm(3, 3, 7), peel: fbm(12, 3, 8) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      vec3 face = mix( ${rgb('#9a8a7a')}, ${rgb('#c49a7a')}, sstep( 0.45, 0.75, peel ) );
      face *= 0.88 + hash2( int( F.z ), 2, uSeed ) * 0.2;
      col = mix( ${rgb('#3a2c24')}, face, F.y );
      col = mix( col, col * 0.5, cav * 0.7 );
      orm = vec3( 1.0 - max( ( 1.0 - F.y ) * 0.6, cav * 0.5 ), 0.92, 0.0 );`,
  },
  normal: { depth: 0.018 / 0.8 },
};

/** Plane bark: smooth, flaking off in jigsaw patches of cream, olive-grey and khaki, a slight step at each patch's edge. */
const barkMottle = {
  fields: {
    noise: {
      warpU: fbm(5, 3, 1), warpV: fbm(5, 3, 2),
      pch: cells(5, 3, 1.0, { sy: 1.6, warp: { u: ['warpU', 0.18, -0.5], v: ['warpV', 0.18, -0.5] } }),
      grain: fbm(40, 2, 4),
    },
    glsl: `
      float k = hash2( int( pch.id ), 1, uSeed );
      float step_ = sstep( 0.0, 0.03, pch.edge );
      return vec4( k * 0.06 * step_ + grain * 0.04, k, step_, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(4, 3, 9) },
    glsl: `
      float cav = cavity( F.x, B.x, 8.0 );
      vec3 a = ${rgb('#ddd6bc')};
      vec3 b = ${rgb('#a4a488')};
      vec3 c3 = ${rgb('#8a7c5c')};
      col = F.y < 0.4 ? a : F.y < 0.75 ? b : c3;
      col *= 0.92 + tone * 0.14;
      col = mix( col, ${rgb('#5a5244')}, ( 1.0 - F.z ) * 0.5 + cav * 0.3 );
      orm = vec3( 1.0 - cav * 0.4, 0.8, 0.0 );`,
  },
  normal: { depth: 0.006 / 0.8 },
};

/** Smooth bark: a fine skin with horizontal lenticels in bands, faint rings, a little lichen. */
const barkSmooth = {
  fields: {
    noise: { len: cells(18, 1, 0.9, { sy: 2.2 }), skin: fbm(12, 3, 2), ring: fbm(3, 2, 3, { sx: 6 }) },
    glsl: `
      // A lenticel: a short dash across the stem (u runs round it).
      vec2 d = len.d * vec2( 0.45, 2.2 );
      float lent = hash2( int( len.id ), 1, uSeed ) < 0.55 ? sstep( 0.16, 0.08, length( d ) ) : 0.0;
      return vec4( skin * 0.2 - lent * 0.35 + ring * 0.08, lent, ring, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(5, 3, 7), lichen: fbm(9, 3, 8) },
    glsl: `
      float cav = cavity( F.x, B.x, 6.0 );
      col = mix( ${rgb('#b8ae9e')}, ${rgb('#9c9282')}, sstep( 0.3, 0.7, tone ) );
      col = mix( col, ${rgb('#5a4a3c')}, F.y * 0.8 );
      col = mix( col, ${rgb('#a8ae90')}, sstep( 0.74, 0.86, lichen ) * 0.4 );
      col = mix( col, col * 0.6, cav * 0.5 );
      orm = vec3( 1.0 - cav * 0.4, 0.75, 0.0 );`,
  },
  normal: { depth: 0.005 / 0.8 },
};

/**
 * Weathered limestone (an outcrop, a boulder): pale grey, pitted and
 * fluted where rain dissolved it (karren, along v: down the face), cracked,
 * crusted with lichens: grey-green crustose, the orange of Xanthoria in
 * spots, black where water runs.
 */
const crag = {
  fields: {
    noise: {
      body: fbm(4, 5, 0), grain: fbm(30, 3, 1), flute: ridge(10, 2, 2, { sx: 0.12 }),
      pit: cells(26, 3, 0.9), crack: ridge(3, 3, 4), warp: fbm(3, 2, 5),
    },
    glsl: `
      float p = hash2( int( pit.id ), 1, uSeed ) < 0.3 ? sstep( 0.3, 0.05, pit.f1 ) : 0.0;
      float cr = pow( crack, 28.0 );
      float h = body * 0.5 + grain * 0.15 - pow( flute, 6.0 ) * 0.06 - p * 0.25 - cr * 0.3;
      return vec4( h, cr, p, flute );`,
  },
  blur: [4],
  colour: {
    noise: { tone: fbm(3, 4, 9), lichA: fbm(8, 4, 10), lichB: fbm(14, 3, 11), streak: fbm(5, 3, 12, { sx: 0.15 }), speck: fbm(70, 2, 13) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      col = mix( ${rgb('#c4beb0')}, ${rgb('#a8a294')}, sstep( 0.35, 0.75, tone ) );
      col *= 0.93 + speck * 0.12;
      // Black streaks where water runs down from the top.
      col = mix( col, ${rgb('#4c4a44')}, sstep( 0.66, 0.84, streak ) * 0.45 );
      // Lichen crusts: grey-green patches, orange spots.
      col = mix( col, ${rgb('#9aa286')}, sstep( 0.58, 0.66, lichA ) * 0.75 );
      col = mix( col, ${rgb('#c98a3c')}, sstep( 0.78, 0.82, lichB ) * 0.8 );
      col = mix( col, ${rgb('#4a463e')}, max( F.y * 0.6, cav * 0.45 ) );
      orm = vec3( 1.0 - max( F.y * 0.6, cav * 0.5 ), 0.85 - sstep( 0.58, 0.66, lichA ) * 0.05, 0.0 );`,
  },
  normal: { depth: 0.03 / 2.0 },
};

/** The countryside's flora and rock surfaces, in surfaces.js's form (metres a repeat, texture size, recipe). */
export const FLORA_SURFACES = Object.freeze({
  'leaf-ovate': { metres: 1, size: 512, ...spray(leafSpray({ leaves: 24, len: 0.2, pet: 0.1, half: '0.3 * pow( sin( 3.14159 * pow( s, 0.72 ) ), 0.85 )', angle: 0.85 })) },
  'leaf-lobed': { metres: 1, size: 512, ...spray(leafSpray({ leaves: 15, len: 0.28, pet: 0.06, half: '0.36 * pow( sin( 3.14159 * pow( s, 0.85 ) ), 0.75 )', angle: 0.9, tipward: 0.7, lobes: 4.5 })) },
  'leaf-lance': { metres: 1, size: 512, ...spray(leafSpray({ leaves: 27, len: 0.27, pet: 0.05, half: '0.12 * pow( sin( 3.14159 * s ), 1.1 )', angle: 0.55 })) },
  'leaf-serrate': { metres: 1, size: 256, ...spray(leafSpray({ leaves: 12, len: 0.34, pet: 0.06, half: '0.17 * pow( sin( 3.14159 * pow( s, 0.9 ) ), 0.9 )', angle: 0.75, serr: 0.16, tipward: 0.3 })) },
  'leaf-palmate': { metres: 1, size: 512, ...spray(palmateSpray()) },
  'leaf-deltoid': { metres: 1, size: 256, ...spray(leafSpray({ leaves: 15, len: 0.22, pet: 0.32, half: '0.48 * min( 1.0, s * 4.0 ) * pow( 1.0 - s, 0.85 )', angle: 0.95 })) },
  'leaf-needle': { metres: 1, size: 512, ...spray(needleSpray(), LEAF_COLOUR, 0.008) },
  'leaf-scale': { metres: 1, size: 512, ...spray(scaleSpray(), LEAF_COLOUR, 0.01) },
  'leaf-frond': { metres: 1, size: 512, ...spray(frondSpray()) },
  'leaf-blossom': { metres: 1, size: 256, ...spray(blossomSpray(), BLOSSOM_COLOUR) },
  'bark-plates': { metres: 1.2, size: 256, ...barkPlates },
  'bark-mottle': { metres: 1.6, size: 256, ...barkMottle },
  'bark-smooth': { metres: 0.8, size: 256, ...barkSmooth },
  crag: { metres: 2.4, size: 512, ...crag },
});
