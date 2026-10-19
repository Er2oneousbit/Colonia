/**
 * ships/crew.js
 * ----------------------------------------------------------------------------
 * The crews of the ships, drawn as people of the people system (people/:
 * the same pieces, clips, colours and shader), riding their hulls: each
 * vessel in view has a cell of SHIP_TEXELS texels in one float texture,
 * written each frame by the pass (pass.js), that the crew's vertex shader
 * reads to carry its people with the hull as it heaves, pitches, rolls and
 * turns:
 *
 *   texel 0   the hull's place (metres in the view's tiles x TILE_M), its yaw
 *   texel 1   the hull's tilt (pitch and roll, as a turn about the world's
 *             axes: column 0), the rowers' stroke clock (s of the clip)
 *   texel 2   column 1; how many warriors it still carries
 *   texel 3   column 2; 1 drawn, 0 hidden (a ship going down)
 *
 * An instance's attributes (the people's names, which its shader declares):
 *   aActClip   the clip, its phase (s), its speed, 1 if it runs on the
 *              ship's stroke clock (a rower, the hortator) else 0 (the
 *              look's clock)
 *   aActRoute  where it stands on the deck (the ship's frame: metres, the
 *              bow +z, the water at y = 0) and its facing there
 *   aActCol0/1 its colours (actors.js)
 *   aActMisc   its head's scale, its own scale, which warrior it is (-1:
 *              not one; shown while the ship carries more than that), the
 *              ship's cell
 * So a crew's instances are written only when the set of ships in view, or
 * what one of them does (rowing or resting, its warriors), changes; the
 * texture is the only thing sent to the GPU a frame.
 * ----------------------------------------------------------------------------
 */

import {
  MeshStandardMaterial, MeshDepthMaterial, MeshDistanceMaterial, DataTexture, RGBAFormat, FloatType, NearestFilter, Vector2,
  Matrix4,
} from 'three';
import { patchLook, surfaceTextures, cachedMaterial } from '../materials.js';
import { patchPeopleShader } from '../people/material.js';
import { FigurePass, KEEP_FRAMES } from '../figures/figurePass.js';
import { pack } from '../people/actors.js';
import { TILE_M } from './motion.js';

/** Ships a row of the texture, texels a ship, floats a ship. */
export const SHIPS_ROW = 128;
export const SHIP_TEXELS = 4;
export const SHIP_FLOATS = SHIP_TEXELS * 4;

const SHIPS = { value: null };

/** The ships' texture for `rows` rows (a new one: the uniform is pointed at it). */
export function shipTexture(rows) {
  const data = new Float32Array(SHIPS_ROW * SHIP_FLOATS * rows);
  const t = new DataTexture(data, SHIPS_ROW * SHIP_TEXELS, rows, RGBAFormat, FloatType);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  t.name = 'ship-crews';
  SHIPS.value = t;
  return t;
}

const PARS = /* glsl */ `
uniform highp sampler2D uShips;
`;

const MAIN = /* glsl */ `
void main() {
  float pYaw = 0.0;
  float pAdv = 0.0;
  mat4 pSkin;
  vec3 sPos = vec3( 0.0 );
  mat3 sTilt = mat3( 1.0 );
  float sYaw = 0.0;
  float sKeep = 1.0;
  {
    int si = int( aActMisc.w + 0.5 );
    ivec2 sc = ivec2( ( si % ${SHIPS_ROW} ) * ${SHIP_TEXELS}, si / ${SHIPS_ROW} );
    vec4 s0 = texelFetch( uShips, sc, 0 );
    vec4 s1 = texelFetch( uShips, sc + ivec2( 1, 0 ), 0 );
    vec4 s2 = texelFetch( uShips, sc + ivec2( 2, 0 ), 0 );
    vec4 s3 = texelFetch( uShips, sc + ivec2( 3, 0 ), 0 );
    sPos = s0.xyz;
    sYaw = s0.w;
    sTilt = mat3( s1.xyz, s2.xyz, s3.xyz );
    // (A warrior shows while the ship still carries more than his number; everyone while it floats.)
    sKeep = s3.w * ( aActMisc.z < 0.0 ? 1.0 : step( aActMisc.z + 0.5, s2.w ) );
    float tm = aActClip.w > 0.5 ? s1.w * aActClip.z + aActClip.y : uLookTime * aActClip.z + aActClip.y;
    pSkin = peopleSkin( aActClip.x, tm );
    pYaw = sYaw + aActRoute.w;
  }
`;

/** After the rest pose is turned (pYaw: the ship's and his own): his scale, his place on the deck, the hull's tilt and place. */
const BEGIN = /* glsl */ `
{
  float sc = cos( sYaw );
  float ss = sin( sYaw );
  vec3 L = aActRoute.xyz;
  vec3 Lw = vec3( sc * L.x + ss * L.z, L.y, -ss * L.x + sc * L.z );
  transformed = sPos + sTilt * ( transformed * aActMisc.y + Lw ) * sKeep;
}
`;

const VARIANT = Object.freeze({ uniforms: { uShips: SHIPS }, pars: PARS, main: MAIN, begin: BEGIN });

/** The crews' material (the people's, carried by the ships' texture). */
export function crewMaterial() {
  return cachedMaterial('ship-crews', () => {
    const wool = surfaceTextures('wool');
    const m = new MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 1, vertexColors: false,
      map: wool.map, normalMap: wool.normalMap, normalScale: new Vector2(0.8, 0.8), roughnessMap: wool.orm, metalnessMap: wool.orm,
    });
    m.name = 'ship-crews';
    patchLook(m, { snow: 1, wet: 1 });
    const look = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      look(shader, renderer);
      patchPeopleShader(shader, false, VARIANT);
      // Little snow lies on a crew at sea: the spray washes it off the oars and men shake it off (on a ship's
      // sweeps it read as a row of white planks).
      const at = 'float cover = uLookSnow * uLookSnowMul * vPeopleMat.w;';
      if (!shader.fragmentShader.includes(at)) throw new Error("ship crews: the snow line of the people's shader not found");
      shader.fragmentShader = shader.fragmentShader.replace(at, 'float cover = uLookSnow * uLookSnowMul * vPeopleMat.w * 0.2;');
    };
    m.customProgramCacheKey = () => 'ship-crews1';
    return m;
  });
}

/** The crews' shadow casters: the sun's depth and a lamp's distance, carried alike. */
export function crewDepthMaterial(kind = 'depth') {
  return cachedMaterial(`ship-crews-${kind}`, () => {
    const m = kind === 'depth' ? new MeshDepthMaterial() : new MeshDistanceMaterial();
    m.onBeforeCompile = (shader) => patchPeopleShader(shader, true, VARIANT);
    m.customProgramCacheKey = () => `ship-crews-${kind}1`;
    return m;
  });
}

/** A crew packed once: its actors (actors.js pack) with their stroke and warrior flags. */
export function packCrew(specs) {
  return specs.map((s, i) => {
    const a = pack(s, i);
    return { a, pieces: a.pieces, stroke: !!s.stroke, warrior: s.warrior ?? -1, at: s.at || [0, 0, 0], ry: s.ry || 0, scale: s.scale ?? 1 };
  });
}

/**
 * The pieces a crew leaves off far out (the town's people at their far
 * level: a tile under 150 device px, a man some thirty pixels tall): a
 * beard, a helmet, boots, a spear, a bow, an arrow, a tablet, a sack or a
 * mallet is a pixel or two there, and each would be a draw of its own. The
 * body, the tunic and the mail, the hair, the shields and the sweeps (which
 * show) stay.
 */
export const FAR_SKIPS = Object.freeze(['beard:', 'helmet:', 'caligae:', 'prop:spear', 'prop:bow', 'prop:arrow', 'prop:tablet', 'prop:sack', 'prop:hammer']);

/** What a crew leaves off half way out (its own level the far one, the town's people's the middle). */
export const MID_SKIPS = Object.freeze(['beard:', 'caligae:', 'prop:tablet', 'prop:sack', 'prop:hammer']);

/**
 * The pieces of crewman `c` drawn: all of them, or far out (`far`) less
 * FAR_SKIPS, every head of hair cropped (curls and a crop are the same few
 * pixels there, and one piece is one draw for every crew).
 */
export function piecesAt(c, far) {
  // (Boots never: a crewman's feet are on a deck or in his hull, and they are a draw of their own.)
  if (!far) return c.nearPieces || (c.nearPieces = c.pieces.filter((k) => !k.startsWith('caligae:')));
  // (Half way out, `far` 1: the beard, the tablet, the sack and the mallet left off; the helmets and arms that
  // tell a marine and a warrior stay.)
  if (far === 1) return c.midPieces || (c.midPieces = c.pieces.filter((k) => !MID_SKIPS.some((s) => k.startsWith(s))));
  return c.farPieces || (c.farPieces = c.pieces.filter((k) => !FAR_SKIPS.some((s) => k.startsWith(s))).map((k) => (k.startsWith('hair:') ? `hair:crop:${k.split(':')[2]}` : k)));
}

/** Milliseconds a frame may spend building pieces (one build may overrun): a millisecond under the walkers' and the units', the crews being the lighter set. */
const CREW_BUILD_MS = 5;
const TILE = new Matrix4().makeScale(1 / TILE_M, 1 / TILE_M, 1 / TILE_M);

/**
 * The crews in view: one InstancedMesh a piece and level of detail across
 * every ship's people, written when the set changes (set()), carried each
 * frame by the ships' texture (the pass writes it).
 */
export class CrewBatch extends FigurePass {
  constructor(parent) {
    // (No shadows from the crews: on a deck they fall on the hull and its people, and drawing them twice
    // cost what the sprites cost: measured.)
    super(parent, { name: 'ship-crews', material: crewMaterial, depthMaterial: crewDepthMaterial, shadows: false });
    this.lod = 1;
    this.stats = { people: 0, draws: 0, triangles: 0, writes: 0, pieces: 0, deferred: 0 };
  }

  /**
   * This frame's crews: `list` [{ crew (packCrew), slot, phase }] at level
   * `lod` (`far` 2: leaving FAR_SKIPS off, 1: MID_SKIPS); `sig` the set's signature (written again only when it changes,
   * or a piece wanted was built). Builds what is missing within BUILD_MS.
   */
  set(list, lod, sig, far = lod === 2 ? 2 : 0) {
    this.frame++;
    if (lod !== this.lod || far !== this.far) {
      this.lod = lod;
      this.far = far;
      this.lastSig = -1;
    }
    // Ask for what is missing at each actor's level (only when the set changed: a still set has all it wants);
    // build within the budget.
    if (sig !== this.lastSig || this.dirty) {
      for (const e of list) {
        for (const c of e.crew) for (const key of piecesAt(c, this.far)) if (!this.pieces.has(`${key}|${lod}`)) this.wanted.add(`${key}|${lod}`);
      }
    }
    this.build(performance.now() + CREW_BUILD_MS);
    if (sig !== this.lastSig || this.dirty) this.write(list, sig);
    if (this.frame % 120 === 0) {
      for (const [id, p] of this.pieces) if (p.n === 0 && this.frame - p.seen > KEEP_FRAMES) this.drop(id);
    }
  }

  write(list, sig) {
    this.dirty = false;
    this.lastSig = sig;
    for (const p of this.pieces.values()) p.n = 0;
    let people = 0;
    for (const e of list) {
      for (const c of e.crew) {
        const ps = piecesAt(c, this.far).map((key) => this.pieces.get(`${key}|${this.lod}`) || this.pieceAt(key, this.lod));
        if (ps.some((p) => !p)) {
          this.dirty = true;
          continue;
        }
        if (ps.some((p) => p.lod !== this.lod)) this.dirty = true;
        people++;
        for (const p of ps) {
          const i = p.n;
          if (i >= p.room) this.grow(p, i + 1);
          TILE.toArray(p.mesh.instanceMatrix.array, i * 16);
          const A = p.attrs;
          const o = i * 4;
          A.aActClip.array[o] = c.a.clip[0];
          // (Each ship's people their own phase, but its rowers in time with its stroke.)
          A.aActClip.array[o + 1] = c.a.clip[1] + (c.stroke ? 0 : e.phase);
          A.aActClip.array[o + 2] = c.a.clip[2];
          A.aActClip.array[o + 3] = c.stroke ? 1 : 0;
          A.aActRoute.array[o] = c.at[0];
          A.aActRoute.array[o + 1] = c.at[1];
          A.aActRoute.array[o + 2] = c.at[2];
          A.aActRoute.array[o + 3] = c.ry;
          A.aActCol0.array.set(c.a.col0, o);
          A.aActCol1.array.set(c.a.col1, o);
          A.aActMisc.array[o] = c.a.misc[0];
          A.aActMisc.array[o + 1] = c.a.scale;
          A.aActMisc.array[o + 2] = c.warrior;
          A.aActMisc.array[o + 3] = e.slot;
          p.n = i + 1;
        }
      }
    }
    const { draws, tris } = this.flush();
    Object.assign(this.stats, { people, draws, triangles: tris, pieces: this.pieces.size, writes: this.stats.writes + 1 });
  }

  hide() {
    super.hide();
    this.stats.people = 0;
  }
}
