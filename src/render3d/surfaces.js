/**
 * surfaces.js
 * ----------------------------------------------------------------------------
 * Recipes for the procedural PBR surfaces of the 3D look, painted on the GPU
 * (paint/painter.js; how a recipe is written: paint/recipe.js), the way a
 * texture artist would paint them, in layers: the base material, its
 * structure (grain, strata, pores, cells), then wear and dirt.
 *
 *   SURFACES[name] = { metres, size, fields, blur, colour, normal, height? }
 *
 * `metres` is how much of the world one repeat of the texture covers:
 * meshes are given UVs in metres (shapes.js), and the material scales them
 * by 1 / metres, so a stone's grain is the same size on a block as on a
 * curb. Colours are written in sRGB (the albedo texture is tagged so) and
 * kept in the range of real materials (no albedo under about 0.03 or over
 * 0.9 linear), or physically based light makes them glow or go dead. Each
 * texture is seeded by a hash of its name.
 * ----------------------------------------------------------------------------
 */

import { fbm, ridge, cells } from './paint/recipe.js';
import { rgb, rgbs, glf } from './paint/glsl.js';
import { RURAL_SURFACES } from './surfacesRural.js';
import { WALL_SURFACES } from './surfacesWalls.js';
import { FLORA_SURFACES } from './surfacesFlora.js';
import { GARDEN_SURFACES } from './surfacesGarden.js';
import { GOV_SURFACES } from './surfacesGov.js';

/**
 * Limestone of the puteal (the well's curb): a fine pale stone with grain,
 * a few pits, faint warm veins and cloudy tone. Smooth-ish where hands and
 * ropes wore it, which the model's vertex colours and roughness add.
 */
const limestone = {
  fields: {
    noise: {
      grain: fbm(24, 4, 1), body: fbm(5, 5, 0), cell: cells(36, 2, 0.9),
      warp: fbm(3, 3, 5), veinN: ridge(3, 4, 6, { warp: { u: ['warp', 0.35], v: ['warp', 0.2] } }),
    },
    glsl: `
      float pit = hash2( int( cell.id ), 3, uSeed ) < 0.05 ? sstep( 0.12, 0.03, cell.f1 ) : 0.0;
      return vec4( body * 0.45 + grain * 0.45 - pit * 0.6, pow( veinN, 14.0 ), 0.0, 0.0 );`,
  },
  blur: [3],
  colour: {
    noise: { tone: fbm(3, 4, 9), coolN: fbm(6, 3, 11), speckN: fbm(64, 2, 13) },
    glsl: `
      float cav = cavity( F.x, B.x, 6.0 );
      col = mix( ${rgb('#d0c09c')}, ${rgb('#b99f78')}, sstep( 0.45, 0.75, tone ) * 0.8 );
      col = mix( col, ${rgb('#dcd3bd')}, sstep( 0.5, 0.25, coolN ) * 0.6 );
      col = mix( col, ${rgb('#a08a66')}, F.y * 0.45 );
      col *= 0.94 + speckN * 0.1;
      col = mix( col, ${rgb('#7a6a50')}, cav * 0.45 );
      orm = vec3( 1.0 - cav * 0.4, 0.62 + speckN * 0.18 + cav * 0.15, 0.0 );`,
  },
  normal: { depth: 0.0035 / 0.8 },
};

/**
 * Travertine of the platform blocks: banded strata along u, the stone's
 * typical open pores stretched along the bedding, warm beige, worn smooth
 * on top (the model darkens and dirties the foot of each block).
 */
const travertine = {
  fields: {
    noise: {
      big: cells(24, 3, 0.95, { sy: 3.2 }), small: cells(48, 4, 0.95, { sy: 3 }),
      strata: fbm(10, 5, 0, { gain: 0.55, sx: 8 }), grain: fbm(40, 3, 1),
    },
    glsl: `
      float p = hash2( int( big.id ), 1, uSeed ) < 0.22 ? sstep( 0.22, 0.06, big.f1 * ( 0.7 + hash2( int( big.id ), 2, uSeed ) * 0.8 ) ) : 0.0;
      float q = hash2( int( small.id ), 5, uSeed ) < 0.18 ? sstep( 0.24, 0.06, small.f1 ) : 0.0;
      float pore = max( p, q * 0.8 );
      return vec4( strata * 0.35 + grain * 0.3 - pore * 0.9, pore, 0.0, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { band: fbm(12, 4, 7, { sx: 10 }), lite: fbm(4, 3, 8), grit: fbm(80, 2, 9) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      float pore = F.y;
      col = mix( ${rgb('#c4ad86')}, ${rgb('#ad9470')}, sstep( 0.4, 0.7, band ) );
      col = mix( col, ${rgb('#d6c8aa')}, sstep( 0.55, 0.8, lite ) * 0.5 );
      col = mix( col, ${rgb('#806b50')}, max( pore * 0.6, cav * 0.35 ) );
      col *= 0.95 + grit * 0.1;
      orm = vec3( 1.0 - max( pore * 0.7, cav * 0.4 ), 0.78 + pore * 0.2, 0.0 );`,
  },
  normal: { depth: 0.006 / 1.0 },
};

/** Joint half width of the street's paving, in cell units (about 6 mm): Roman paviors fitted the blocks tight. */
const GROUT = 0.012;

/**
 * Basalt street paving as at Pompeii: big polygonal lava blocks, each a
 * slightly cushioned top with its own tone and tilt, set in dark joints of
 * grit. The tops are polished by feet and wheels (lower roughness), the
 * joints rough and dusty, and the Vesuvian lava's pale leucite specks show.
 * The mesh is displaced by each stone's own level and tilt (`plate`,
 * low-passed: B's y, read back, `height`); the joints are too fine for a
 * mesh a game would draw, and a blurred joint in the mesh makes every stone
 * a pillow, so joints, arrises and chips are left to the normal map (from
 * the height less that low pass: both together, not twice the slope), the
 * occlusion and the colour.
 */
const basalt = {
  fields: {
    noise: {
      warpU: fbm(3, 3, 11), warpV: fbm(3, 3, 12),
      // Warped a little, so the stones come in many sizes and their edges are not ruler-straight.
      stone: cells(9, 0, 1.0, { warp: { u: ['warpU', 0.09, -0.5], v: ['warpV', 0.09, -0.5] } }),
      topN: fbm(22, 3, 2), jointN: fbm(60, 2, 3), chipN: fbm(30, 3, 4),
    },
    glsl: `
      float e = stone.edge;
      int id = int( stone.id );
      float tx = ( hash2( id, 4, uSeed ) - 0.5 ) * 0.25;
      float tz = ( hash2( id, 5, uSeed ) - 0.5 ) * 0.25;
      float level = 0.8 + ( hash2( id, 1, uSeed ) - 0.5 ) * 0.12 + tx * stone.d.x + tz * stone.d.y;
      // A worn, rounded arris: the stone falls into the joint over 2 to 3 cm; chips knocked out of it.
      float bevel = sstep( ${glf(GROUT)}, ${glf(GROUT + 0.035)}, e );
      float top = level + ( topN - 0.5 ) * 0.04;
      float joint = 0.2 + jointN * 0.08;
      float chip = sstep( 0.64, 0.8, chipN ) * ( 1.0 - sstep( ${glf(GROUT + 0.03)}, ${glf(GROUT + 0.14)}, e ) );
      return vec4( mix( joint, top, bevel ) - chip * 0.2, level, stone.id, e );`,
  },
  blur: [4, 2],
  colour: {
    noise: { dustN: fbm(9, 3, 6), mottN: fbm(40, 3, 7), roughN: fbm(50, 2, 9) },
    glsl: `
      float cav = cavity( F.x, B.x, 3.0 );
      int id = int( F.z );
      float e = F.w;
      vec3 tones[5] = ${rgbs(['#45403a', '#4d463d', '#3f3d3a', '#4a4339', '#554c41'])};
      float inJoint = 1.0 - sstep( ${glf(GROUT * 0.5)}, ${glf(GROUT + 0.015)}, e );
      float wear = sstep( ${glf(GROUT + 0.08)}, 0.32, e ) * ( 0.6 + hash2( id, 3, uSeed ) * 0.4 );
      // Stone: mottled, darker and smoother where polished, dusty near the joints.
      col = mix( tones[int( hash2( id, 2, uSeed ) * 5.0 )], ${rgb('#8c8172')}, ( 1.0 - wear ) * 0.18 + dustN * 0.1 );
      col *= 0.88 + mottN * 0.24;
      float sp = hash2( px.x >> 1, px.y >> 1, uSeed + 8 ) < 0.005 ? 0.3 : 0.0;
      col = mix( col, ${rgb('#bdb6a8')}, sp * ( 1.0 - inJoint ) );
      col = mix( col, ${rgb('#2f2a24')}, inJoint );
      col = mix( col, ${rgb('#3a3632')}, cav * 0.5 );
      orm = vec3( 1.0 - max( inJoint * 0.45, cav * 0.6 ), mix( 0.72 - wear * 0.2, 0.95, inJoint ) + ( roughN - 0.5 ) * 0.08, 0.0 );`,
  },
  normal: { depth: 0.018 / 4.8, F: [1, 0, 0, 0], B: [0, -1, 0, 0] },
  height: true,
};

/** Grey-yellow tufa of the kerb stones: soft, porous, with black scoria specks. */
const tufa = {
  fields: {
    noise: { sco: cells(30, 1, 0.9), a: fbm(8, 5, 0), b: fbm(48, 3, 2) },
    glsl: `
      float sc = hash2( int( sco.id ), 1, uSeed ) < 0.18 ? sstep( 0.28, 0.12, sco.f1 ) : 0.0;
      return vec4( a * 0.5 + b * 0.4 - sc * 0.3, sc, 0.0, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(4, 4, 4) },
    glsl: `
      float cav = cavity( F.x, B.x, 6.0 );
      col = mix( ${rgb('#b0a283')}, ${rgb('#9b8f74')}, sstep( 0.35, 0.7, tone ) );
      col = mix( col, ${rgb('#3a3631')}, F.y * 0.8 );
      col = mix( col, ${rgb('#5d5446')}, cav * 0.6 );
      orm = vec3( 1.0 - cav * 0.5, 0.88, 0.0 );`,
  },
  normal: { depth: 0.006 / 1.0 },
};

/**
 * Cocciopesto of the raised pavement: lime mortar reddened with crushed
 * tile, rows of small white limestone tesserae set into it (as in front of
 * Pompeian houses), hairline cracks and worn patches.
 */
const cocciopesto = {
  fields: {
    noise: { crackN: ridge(3, 4, 5), crackMask: fbm(3, 2, 6), mortar: fbm(10, 4, 0), agg: cells(90, 3, 0.9) },
    glsl: `
      // Tesserae: a row every 14 cm, every other row offset by half, an eighth of them lost.
      const float ROWS = 14.0;
      int row = int( floor( uv.y * ROWS ) );
      float off = float( row % 2 ) * 0.5;
      int c = int( floor( uv.x * ROWS + off ) );
      float tess = 0.0;
      if ( hash2( c, row, uSeed ) >= 0.12 ) {
        float cu = ( float( c ) + 0.5 - off ) / ROWS + ( hash2( c, row, uSeed + 1 ) - 0.5 ) * 0.006;
        float cv = ( float( row ) + 0.5 ) / ROWS + ( hash2( c, row, uSeed + 2 ) - 0.5 ) * 0.006;
        float du = abs( uv.x - cu );
        du = min( du, 1.0 - du );
        float dv = abs( uv.y - cv );
        const float S = 0.0045; // half a tessera: about 1 cm square
        tess = sstep( S + 0.0015, S, max( du, dv ) );
      }
      float crack = pow( crackN, 30.0 ) * sstep( 0.45, 0.6, crackMask );
      float a = hash2( int( agg.id ), 1, uSeed ) < 0.3 ? sstep( 0.4, 0.2, agg.f1 ) * 0.25 : 0.0;
      return vec4( mortar * 0.4 + a + tess * 0.15 - crack * 0.5, tess, crack, 0.0 );`,
  },
  blur: [3],
  colour: {
    noise: { paleN: fbm(5, 4, 7), agg: cells(90, 3, 0.9) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      col = mix( ${rgb('#8a5644')}, ${rgb('#a07a62')}, sstep( 0.45, 0.75, paleN ) * 0.7 );
      if ( hash2( int( agg.id ), 2, uSeed ) < 0.25 ) col = mix( col, ${rgb('#7a3e30')}, sstep( 0.42, 0.25, agg.f1 ) * 0.7 );
      col = mix( col, ${rgb('#e2ddd0')}, F.y * 0.9 );
      col = mix( col, ${rgb('#4e3a30')}, max( cav * 0.6, F.z * 0.7 ) );
      orm = vec3( 1.0 - cav * 0.5, 0.82 - F.y * 0.2, 0.0 );`,
  },
  normal: { depth: 0.004 / 2.0 },
};

/**
 * The plastered house wall, 4 m wide and 4 m tall (it repeats along the
 * wall, not up it: v is the height, 0 at the street). A black socle, a
 * Pompeian red dado to 1.3 m, a dark band, then ochre-cream plaster; rain
 * streaks, rising damp at the foot, and patches where the plaster fell off
 * to show the opus incertum (rubble in mortar) behind it.
 */
const plaster = {
  fields: {
    noise: { lossN: fbm(3, 5, 1), skin: fbm(30, 3, 4), stone: cells(22, 2, 0.95), grit: fbm(40, 2, 3) },
    glsl: `
      float y = uv.y * 4.0;
      float t = lossN + sstep( 1.2, 0.1, y ) * 0.12 - sstep( 2.0, 3.0, y ) * 0.05;
      float loss = sstep( 0.73, 0.745, t );
      float plasterH = 0.75 + skin * 0.05;
      float rubble = 0.15 + sstep( 0.02, 0.12, stone.edge ) * 0.25 + grit * 0.08;
      return vec4( loss > 0.0 ? mix( plasterH, rubble, loss ) : plasterH, loss, 0.0, 0.0 );`,
  },
  blur: [3],
  colour: {
    noise: {
      wobN: fbm(12, 2, 5), dadoN: fbm(6, 4, 6), creamN: fbm(5, 4, 7), fadeN: fbm(3, 3, 8),
      // Streaks run down the wall: stretched along v.
      streakN: fbm(40, 3, 9, { sx: 0.06, coord: 'vu' }), tideN: fbm(8, 3, 10), stone: cells(22, 2, 0.95),
    },
    glsl: `
      float cav = cavity( F.x, B.x, 4.0 );
      float loss = F.y;
      float y = uv.y * 4.0;
      // The painted zones, with brushy edges.
      float wob = ( wobN - 0.5 ) * 0.02;
      if ( y < 0.28 + wob ) col = ${rgb('#2c2623')};
      else if ( y < 1.3 + wob ) col = mix( ${rgb('#8d3426')}, ${rgb('#a4473a')}, dadoN * 0.6 );
      else if ( y < 1.36 + wob ) col = ${rgb('#3a2a22')};
      else col = mix( ${rgb('#d6c29c')}, ${rgb('#c7a26d')}, sstep( 0.35, 0.75, creamN ) * 0.6 );
      // Faded by sun: a soft wash of chalky pale over everything painted.
      col = mix( col, ${rgb('#e3d8c6')}, 0.08 + fadeN * 0.12 );
      // Rain streaks run down from the top.
      col = mix( col, ${rgb('#8b7f6c')}, sstep( 0.55, 0.8, streakN ) * sstep( 1.2, 3.8, y ) * 0.25 );
      // Rubble where the plaster is gone.
      if ( loss > 0.0 ) {
        vec3 rub[5] = ${rgbs(['#6d655b', '#5a4c3e', '#86765c', '#4a4744', '#7a5f45'])};
        vec3 r = rub[int( hash2( int( stone.id ), 1, uSeed ) * 5.0 )];
        vec3 rc = mix( r, ${rgb('#6f675a')}, 1.0 - sstep( 0.02, 0.07, stone.edge ) );
        col = mix( col, rc, loss );
      }
      // Rising damp: darker and greener at the foot, with an irregular tide line.
      col = mix( col, ${rgb('#4f4a3c')}, sstep( 0.45 + tideN * 0.35, 0.0, y ) * 0.55 );
      // The broken edge of the plaster casts a dark rim into the hole.
      float rim = loss > 0.0 && loss < 1.0 ? 1.0 - abs( loss - 0.5 ) * 2.0 : 0.0;
      col = mix( col, ${rgb('#2e2924')}, max( cav * 0.7, rim * 0.6 ) );
      orm = vec3( 1.0 - max( cav * 0.6, rim * 0.5 ), 0.86 + loss * 0.08, 0.0 );`,
  },
  normal: { depth: 0.02 / 4 },
};

/** Weathered oak: grain running along v (the length of a post or plank), annual rings bent by knots, open checks along the grain, sun-greyed. */
const wood = {
  fields: {
    noise: {
      bend: fbm(4, 3, 0, { sx: 0.15 }), checkN: ridge(6, 3, 3, { sx: 0.08 }), checkMask: fbm(3, 2, 4),
      grainN: fbm(60, 3, 1, { sx: 0.1 }),
    },
    glsl: `
      float ring = sin( ( uv.x * 26.0 + bend * 3.5 ) * 6.283185307179586 ) * 0.5 + 0.5;
      float check = pow( checkN, 40.0 ) * sstep( 0.45, 0.65, checkMask );
      return vec4( ring * 0.25 + grainN * 0.35 - check * 0.8, ring, check, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { greyN: fbm(5, 3, 6), fibN: fbm(120, 2, 7, { sx: 0.05 }) },
    glsl: `
      float cav = cavity( F.x, B.x, 6.0 );
      vec3 dark = ${rgb('#3a2e24')};
      col = mix( ${rgb('#5e4836')}, ${rgb('#7f705f')}, 0.15 + greyN * 0.45 );
      float late = sstep( 0.6, 0.95, F.y );
      col = mix( col, dark, late * 0.3 );
      col = mix( col, dark, max( F.z * 0.9, cav * 0.5 ) );
      col *= 0.92 + fibN * 0.16;
      orm = vec3( 1.0 - max( F.z * 0.7, cav * 0.4 ), 0.82 + late * 0.08, 0.0 );`,
  },
  normal: { depth: 0.004 / 1.0 },
};

/**
 * Bronze of the bucket: warm metal where handled, verdigris (non-metal,
 * rough, blue-green) in blotches and dark brown oxide, faint hammer
 * dimples from beating the sheet.
 */
const bronze = {
  fields: {
    noise: { dimple: cells(18, 0, 0.9), fine: fbm(40, 2, 1) },
    glsl: 'return vec4( 1.0 - dimple.f1 * dimple.f1 * 0.6 + fine * 0.1, 0.0, 0.0, 0.0 );',
  },
  colour: {
    noise: { patN: fbm(6, 5, 2), oxN: fbm(5, 4, 3), verdN: fbm(20, 2, 4) },
    glsl: `
      // Old bronze is mostly a dark warm brown; verdigris only in small soft spots.
      float pat = sstep( 0.66, 0.78, patN ) * 0.6;
      float ox = 0.55 + 0.35 * sstep( 0.3, 0.7, oxN );
      col = mix( ${rgb('#a77b4f')}, ${rgb('#3e2c1f')}, ox * 0.75 );
      col = mix( col, mix( ${rgb('#5d8a77')}, ${rgb('#7a9c86')}, verdN ), pat );
      orm = vec3( 1.0 - pat * 0.15, mix( 0.38 + ox * 0.2, 0.85, pat ), ( 1.0 - pat ) * ( 1.0 - ox * 0.5 ) );`,
  },
  normal: { depth: 0.0008 / 0.3 },
};

/** Wrought iron: dark, hammered, with rust blooming in patches. */
const iron = {
  fields: {
    noise: { a: fbm(14, 4, 0), b: fbm(60, 2, 1) },
    glsl: 'return vec4( a * 0.6 + b * 0.3, 0.0, 0.0, 0.0 );',
  },
  colour: {
    noise: { rustN: fbm(6, 5, 2), tone: fbm(30, 2, 3) },
    glsl: `
      float r = sstep( 0.55, 0.75, rustN ) * 0.8;
      col = mix( ${rgb('#46433f')}, mix( ${rgb('#4e3426')}, ${rgb('#6a4430')}, tone ), r );
      orm = vec3( 1.0, mix( 0.55, 0.92, r ), ( 1.0 - r ) * 0.8 );`,
  },
  normal: { depth: 0.0015 / 0.25 },
};

/** Beaten earth: trodden brown soil with gravel, faint dry cracks and darker damp hollows. */
const earth = {
  fields: {
    noise: { pebC: cells(70, 1, 0.95), crackMask: fbm(4, 2, 3), crackC: cells(9, 2, 0.8), ground: fbm(6, 5, 0) },
    glsl: `
      int id = int( pebC.id );
      float peb = hash2( id, 1, uSeed ) < 0.28 ? sstep( 0.42, 0.18, pebC.f1 * ( 0.7 + hash2( id, 2, uSeed ) * 0.6 ) ) : 0.0;
      float crack = sstep( 0.03, 0.0, crackC.edge ) * sstep( 0.5, 0.65, crackMask );
      return vec4( ground * 0.5 + peb * 0.45 - crack * 0.3, peb, crack, 0.0 );`,
  },
  blur: [3],
  colour: {
    noise: { dryN: fbm(4, 4, 4), dampN: fbm(3, 3, 5), pebC: cells(70, 1, 0.95) },
    glsl: `
      float cav = cavity( F.x, B.x, 4.0 );
      vec3 stones[4] = ${rgbs(['#8d8577', '#a39079', '#6b655c', '#b0a38c'])};
      col = mix( ${rgb('#7a6142')}, ${rgb('#98805a')}, sstep( 0.4, 0.7, dryN ) );
      col = mix( col, ${rgb('#5a4630')}, sstep( 0.55, 0.75, dampN ) * 0.5 );
      if ( F.y > 0.0 ) col = mix( col, stones[int( hash2( int( pebC.id ), 3, uSeed ) * 4.0 )], F.y );
      col = mix( col, ${rgb('#3e3027')}, max( cav * 0.6, F.z * 0.5 ) );
      orm = vec3( 1.0 - cav * 0.6, 0.93 - F.y * 0.15, 0.0 );`,
  },
  normal: { depth: 0.01 / 2 },
};

/** Hemp rope: three twisted strands (u along the rope, v around it) and loose fibres. */
const rope = {
  fields: {
    noise: { fibre: fbm(40, 2, 0, { sx: 4 }) },
    glsl: `
      float s = max( 0.0, 0.5 + 0.5 * cos( ( uv.y * 3.0 + uv.x * 4.0 ) * 6.283185307179586 ) );
      return vec4( pow( s, 0.6 ) * 0.8 + fibre * 0.2, 0.0, 0.0, 0.0 );`,
  },
  colour: {
    glsl: `
      col = mix( ${rgb('#7d6847')}, ${rgb('#a48d64')}, F.x );
      orm = vec3( 0.6 + F.x * 0.4, 0.95, 0.0 );`,
  },
  normal: { depth: 0.4 },
};

/** Wool: a coarse tabby weave, undyed (the material's colour dyes it). */
const wool = {
  fields: {
    noise: { fuzz: fbm(30, 2, 0) },
    glsl: `
      const float T = 48.0;
      float a = sin( uv.x * T * 6.283185307179586 );
      float b = sin( uv.y * T * 6.283185307179586 );
      float over = int( floor( uv.x * T * 2.0 ) + floor( uv.y * T * 2.0 ) ) % 2 == 1 ? a : b;
      return vec4( 0.5 + over * 0.3 + fuzz * 0.3, 0.0, 0.0, 0.0 );`,
  },
  colour: {
    glsl: `
      col = ${rgb('#e6dccb')} * ( 0.85 + F.x * 0.2 );
      orm = vec3( 0.8 + F.x * 0.2, 0.95, 0.0 );`,
  },
  normal: { depth: 0.004 },
};

/** Ripples for water: only a normal map matters (the water's colour is the sky it reflects and the dark below). */
const ripples = {
  fields: {
    noise: { swell: fbm(4, 5, 0, { gain: 0.55 }), chop: fbm(14, 3, 1) },
    glsl: 'return vec4( swell * 0.7 + chop * 0.3, 0.0, 0.0, 0.0 );',
  },
  colour: { glsl: 'col = vec3( 1.0 ); orm = vec3( 1.0, 0.05, 0.0 );' },
  normal: { depth: 0.03 },
};

/** Terracotta (roof tiles, amphorae): fired clay, orange to brown in patches, soot and lichen in the hollows. */
const terracotta = {
  fields: {
    noise: { a: fbm(10, 4, 0), b: fbm(50, 2, 1) },
    glsl: 'return vec4( a * 0.5 + b * 0.3, 0.0, 0.0, 0.0 );',
  },
  blur: [3],
  colour: {
    noise: { tone: fbm(4, 4, 2), paleN: fbm(6, 3, 3), lichenN: fbm(12, 3, 4) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      col = mix( ${rgb('#b4653f')}, ${rgb('#93533a')}, sstep( 0.35, 0.7, tone ) );
      col = mix( col, ${rgb('#c98a62')}, sstep( 0.6, 0.8, paleN ) * 0.3 );
      col = mix( col, ${rgb('#8f8f6a')}, sstep( 0.72, 0.8, lichenN ) * 0.35 );
      col = mix( col, ${rgb('#4a3a30')}, cav * 0.6 );
      orm = vec3( 1.0 - cav * 0.5, 0.8, 0.0 );`,
  },
  normal: { depth: 0.003 / 0.6 },
};

/**
 * Lava stone of a plain street fountain's slabs (Pompeii's oldest lacus are
 * of the grey Vesuvian lava the streets are paved with, cut in big slabs):
 * dark grey, close grained, small gas bubbles (vesicles) open on the
 * sawn faces, a few pale leucite specks, and dull: no polish but where
 * hands and jars wore it, which the model's vertex colours add.
 */
const lava = {
  fields: {
    noise: { ves: cells(70, 1, 0.95), ves2: cells(150, 2, 0.95), body: fbm(6, 5, 0), grain: fbm(40, 3, 3) },
    glsl: `
      float v1 = hash2( int( ves.id ), 1, uSeed ) < 0.05 ? sstep( 0.24, 0.1, ves.f1 * ( 0.7 + hash2( int( ves.id ), 2, uSeed ) * 0.7 ) ) : 0.0;
      float v2 = hash2( int( ves2.id ), 3, uSeed ) < 0.07 ? sstep( 0.26, 0.12, ves2.f1 ) : 0.0;
      float hole = max( v1, v2 * 0.8 );
      return vec4( body * 0.4 + grain * 0.3 - hole * 0.8, hole, 0.0, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(4, 4, 5), mott: fbm(24, 3, 6) },
    glsl: `
      float cav = cavity( F.x, B.x, 5.0 );
      col = mix( ${rgb('#66625b')}, ${rgb('#57534d')}, sstep( 0.35, 0.7, tone ) );
      col *= 0.9 + mott * 0.2;
      float sp = hash2( px.x >> 1, px.y >> 1, uSeed + 4 ) < 0.004 ? 0.45 : 0.0;
      col = mix( col, ${rgb('#c6c0b2')}, sp );
      col = mix( col, ${rgb('#2e2b27')}, max( F.y * 0.75, cav * 0.45 ) );
      orm = vec3( 1.0 - max( F.y * 0.5, cav * 0.5 ), 0.78 + mott * 0.12 + F.y * 0.1, 0.0 );`,
  },
  normal: { depth: 0.005 / 1.0 },
};

/**
 * White marble of the finer fountains (Luna's, the Carrara quarries the
 * Romans opened): a warm white with a crystalline sparkle in the
 * roughness, soft grey veins that wander and branch, faint cloudy tone.
 * Smooth (honed, not glossy): Roman marble basins were rubbed with sand
 * and pumice, then worn by use.
 */
const marble = {
  fields: {
    noise: {
      warp: fbm(2, 4, 3), cloud: fbm(3, 5, 1), xtal: cells(110, 4, 0.9),
      vein: ridge(2, 5, 7, { warp: { u: ['warp', 0.6], v: ['warp', 0.35] } }),
      vein2: ridge(5, 4, 9, { warp: { u: ['warp', 0.3], v: ['warp', 0.5] } }),
    },
    glsl: `
      float v = pow( vein, 14.0 ) * 0.8 + pow( vein2, 24.0 ) * 0.4;
      return vec4( cloud * 0.25 - v * 0.05, v, hash2( int( xtal.id ), 1, uSeed ), cloud );`,
  },
  blur: [3],
  colour: {
    noise: { tone: fbm(3, 4, 11) },
    glsl: `
      float cav = cavity( F.x, B.x, 8.0 );
      col = mix( ${rgb('#ece8e0')}, ${rgb('#ddd7cc')}, sstep( 0.4, 0.75, F.w ) * 0.7 );
      col = mix( col, ${rgb('#f4f1ea')}, sstep( 0.55, 0.35, tone ) * 0.4 );
      col = mix( col, ${rgb('#9c9a96')}, min( 1.0, F.y ) * 0.4 );
      col = mix( col, ${rgb('#9a9286')}, cav * 0.4 );
      orm = vec3( 1.0 - cav * 0.3, 0.3 + F.z * 0.12 + F.y * 0.08, 0.0 );`,
  },
  normal: { depth: 0.0012 / 0.9 },
};

/**
 * Brick facing (opus testaceum) as on Ostia's horrea and the commercial
 * buildings of Rome: thin fired bricks, 4 to 4.5 cm thick, laid in courses
 * with mortar beds nearly as thick (about 2 cm), the bricks of every
 * length (they were cut from big square tiles), red to ochre to a few
 * overfired browns, their faces a little proud of the weathered grey lime
 * mortar. 16 courses and four bricks a course to a repeat, so it tiles.
 */
const brick = {
  fields: {
    noise: { face: fbm(30, 3, 0), chip: fbm(12, 3, 2), wear: fbm(4, 3, 4) },
    glsl: `
      const float COURSES = 16.0;
      const float BED = 0.32; // the mortar bed's share of a course
      int course = int( floor( uv.y * COURSES ) );
      float fv = fract( uv.y * COURSES );
      // Each course's bricks start at its own offset; a brick's length wanders by its hash.
      float off = hash2( course, 7, uSeed );
      float x = uv.x * 4.0 + off;
      int i = int( floor( x ) );
      float fu = fract( x );
      int id = ( ( i % 4 ) + 4 ) % 4;
      // The joint between two bricks of a course: about 1 cm, wandering.
      float cut = 0.05 + hash2( course, id, uSeed + 3 ) * 0.04;
      float bed = sstep( BED - 0.03, BED + 0.03, fv ) * sstep( 1.0, 0.96, fv );
      float head = sstep( 0.0, cut, fu ) * sstep( 1.0, 1.0 - cut * 0.4, fu );
      float b = bed * head;
      // A brick's face: its own slight tilt and chips at its arrises.
      float tilt = ( hash2( course, id, uSeed + 5 ) - 0.5 ) * 0.25 * ( fu - 0.5 );
      float h = b * ( 0.75 + face * 0.12 + tilt - sstep( 0.55, 0.8, chip ) * 0.18 * ( 1.0 - head * bed ) ) + ( 1.0 - b ) * ( 0.25 + wear * 0.15 );
      return vec4( h, 1.0 - b, hash2( course, id, uSeed + 9 ), 0.0 );`,
  },
  blur: [3],
  colour: {
    noise: { tone: fbm(3, 4, 6), grit: fbm(70, 2, 8), soot: fbm(5, 3, 10) },
    glsl: `
      float cav = cavity( F.x, B.x, 6.0 );
      float t = F.z;
      // Mostly red to orange, some ochre-yellow, a few dark overfired ones.
      vec3 bc = mix( ${rgb('#a8573a')}, ${rgb('#c2794c')}, sstep( 0.2, 0.7, t ) );
      if ( t > 0.8 ) bc = mix( bc, ${rgb('#c99a62')}, sstep( 0.8, 0.9, t ) );
      if ( t < 0.08 ) bc = ${rgb('#6e3f2c')};
      bc *= 0.9 + grit * 0.18;
      vec3 mc = mix( ${rgb('#b5ad9c')}, ${rgb('#9a9283')}, sstep( 0.4, 0.7, tone ) ) * ( 0.92 + grit * 0.14 );
      col = mix( bc, mc, sstep( 0.3, 0.7, F.y ) );
      col = mix( col, ${rgb('#5a4a3e')}, cav * 0.45 + sstep( 0.6, 0.85, soot ) * 0.12 );
      orm = vec3( 1.0 - cav * 0.5 - F.y * 0.15, 0.82 + F.y * 0.1, 0.0 );`,
  },
  normal: { depth: 0.007 / 0.96 },
};

/**
 * Every surface: how much of the world one repeat covers (metres), the
 * texture size, and its recipe; `height`: the paving's mesh is displaced by
 * its low-passed height, read back from the GPU.
 */
export const SURFACES = Object.freeze({
  limestone: { metres: 0.8, size: 512, ...limestone },
  travertine: { metres: 1.0, size: 512, ...travertine },
  basalt: { metres: 4.8, size: 1024, ...basalt },
  tufa: { metres: 1.0, size: 256, ...tufa },
  cocciopesto: { metres: 2.0, size: 512, ...cocciopesto },
  plaster: { metres: 4.0, size: 1024, ...plaster },
  wood: { metres: 1.0, size: 512, ...wood },
  bronze: { metres: 0.3, size: 256, ...bronze },
  iron: { metres: 0.25, size: 128, ...iron },
  earth: { metres: 2.0, size: 512, ...earth },
  rope: { metres: 0.06, size: 64, ...rope },
  wool: { metres: 0.12, size: 128, ...wool },
  ripples: { metres: 1.2, size: 256, ...ripples },
  terracotta: { metres: 0.6, size: 256, ...terracotta },
  lava: { metres: 1.0, size: 512, ...lava },
  marble: { metres: 1.6, size: 512, ...marble },
  // The warehouse's brick facing.
  brick: { metres: 0.96, size: 512, ...brick },
  // The farms' and the granary's (surfacesRural.js).
  ...RURAL_SURFACES,
  // The town walls' masonry (surfacesWalls.js).
  ...WALL_SURFACES,
  // The countryside's trees and rocks (surfacesFlora.js): sprays of leaves cut out by their alpha, barks, limestone.
  ...FLORA_SURFACES,
  // The gardens' clipped box (surfacesGarden.js).
  ...GARDEN_SURFACES,
  // The senate house's and the residences' stucco (surfacesGov.js).
  ...GOV_SURFACES,
});

/** The surfaces as one set of recipes (one program paints them all: paint/painter.js). */
export const SURFACE_SET = Object.freeze({ key: 'surfaces', recipes: Object.values(SURFACES), names: Object.keys(SURFACES) });

/**
 * A surface's texture size at `scale` (smaller for a quick check: the
 * pattern is the same, only less sharp), never under 32 px.
 */
export function surfaceSize(name, scale = 1) {
  const s = SURFACES[name];
  if (!s) throw new Error(`Unknown surface: ${name}`);
  return Math.max(32, Math.round(s.size * scale));
}

/** The seed a texture is painted with: a hash of its name (32-bit, as JS's integer arithmetic). */
export function nameSeed(name) {
  let k = 0;
  for (let i = 0; i < name.length; i++) k = (k * 31 + name.charCodeAt(i)) | 0;
  return k;
}
