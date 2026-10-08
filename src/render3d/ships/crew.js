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
  InstancedMesh, InstancedBufferAttribute, DynamicDrawUsage, Group, BufferGeometry, Matrix4, WebGLRenderTarget,
} from 'three';
import { patchLook, surfaceTextures, cachedMaterial } from '../materials.js';
import { patchPeopleShader } from '../people/material.js';
import { buildPiece } from '../people/pieces.js';
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
  return specs.map((s, i) => ({ a: pack(s, i), stroke: !!s.stroke, warrior: s.warrior ?? -1, at: s.at || [0, 0, 0], ry: s.ry || 0, scale: s.scale ?? 1 }));
}

/** First room in a piece's instance buffers (doubled as needed). */
const FIRST_ROOM = 32;
/** Frames a piece is kept unseen. */
const KEEP_FRAMES = 900;
/** Milliseconds a frame may spend building pieces (one build may overrun). */
const BUILD_MS = 5;
const ATTRS = ['aActClip', 'aActRoute', 'aActCol0', 'aActCol1', 'aActMisc'];
const TILE = new Matrix4().makeScale(1 / TILE_M, 1 / TILE_M, 1 / TILE_M);

/**
 * The crews in view: one InstancedMesh a piece and level of detail across
 * every ship's people, written when the set changes (set()), carried each
 * frame by the ships' texture (the pass writes it).
 */
export class CrewBatch {
  constructor(parent) {
    this.group = new Group();
    this.group.name = 'ship-crews';
    this.group.userData.opaque = true;
    parent.add(this.group);
    this.pieces = new Map(); // `${key}|${lod}` -> { base, geometry, mesh, attrs, room, n, seen, tris, lod }
    this.wanted = new Set();
    this.frame = 0;
    this.lod = 1;
    this.casting = true;
    this.dirty = false;
    this.lastSig = -1;
    this.compiled = false;
    this.stats = { people: 0, draws: 0, triangles: 0, writes: 0, pieces: 0, deferred: 0 };
  }

  /** A piece built at a level, or another level's standing in, or null. */
  pieceAt(key, lod) {
    for (const l of [lod, lod + 1, lod - 1, lod + 2, lod - 2]) {
      if (l < 0 || l > 2) continue;
      const p = this.pieces.get(`${key}|${l}`);
      if (p) return p;
    }
    return null;
  }

  /**
   * This frame's crews: `list` [{ crew (packCrew), slot, phase }] at level
   * `lod`; `sig` the set's signature (written again only when it changes,
   * or a piece wanted was built). Builds what is missing within BUILD_MS.
   */
  set(list, lod, sig) {
    this.frame++;
    if (lod !== this.lod) {
      this.lod = lod;
      this.lastSig = -1;
    }
    // Ask for what is missing at this level; build within the budget.
    for (const e of list) for (const c of e.crew) for (const key of c.a.pieces) if (!this.pieces.has(`${key}|${lod}`)) this.wanted.add(`${key}|${lod}`);
    this.build(performance.now() + BUILD_MS);
    if (sig !== this.lastSig || this.dirty) this.write(list, sig);
    if (this.frame % 120 === 0) {
      for (const [id, p] of this.pieces) if (p.n === 0 && this.frame - p.seen > KEEP_FRAMES) this.drop(id);
    }
  }

  build(until) {
    let first = true;
    for (const id of this.wanted) {
      if (!first && performance.now() > until) {
        this.stats.deferred = this.wanted.size;
        return;
      }
      first = false;
      this.wanted.delete(id);
      if (this.pieces.has(id)) continue;
      const i = id.lastIndexOf('|');
      const key = id.slice(0, i);
      const lod = Number(id.slice(i + 1));
      const base = buildPiece(key, lod);
      const p = this.make(base, FIRST_ROOM);
      Object.assign(p, { key, lod, seen: this.frame, tris: base.index.count / 3 });
      this.pieces.set(id, p);
      this.dirty = true;
    }
    this.stats.deferred = 0;
  }

  write(list, sig) {
    this.dirty = false;
    this.lastSig = sig;
    for (const p of this.pieces.values()) p.n = 0;
    let people = 0;
    for (const e of list) {
      for (const c of e.crew) {
        const ps = c.a.pieces.map((key) => this.pieces.get(`${key}|${this.lod}`) || this.pieceAt(key, this.lod));
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
    let draws = 0;
    let tris = 0;
    for (const p of this.pieces.values()) {
      const n = p.n;
      p.mesh.count = n;
      p.mesh.visible = n > 0;
      if (!n) continue;
      p.seen = this.frame;
      p.mesh.castShadow = this.casting && p.lod < 2;
      draws++;
      tris += n * p.tris;
      const im = p.mesh.instanceMatrix;
      im.clearUpdateRanges();
      im.addUpdateRange(0, n * 16);
      im.needsUpdate = true;
      for (const name of ATTRS) {
        const a = p.attrs[name];
        a.clearUpdateRanges();
        a.addUpdateRange(0, n * 4);
        a.needsUpdate = true;
      }
    }
    Object.assign(this.stats, { people, draws, triangles: tris, pieces: this.pieces.size, writes: this.stats.writes + 1 });
  }

  make(base, room) {
    const g = new BufferGeometry();
    for (const [name, a] of Object.entries(base.attributes)) g.setAttribute(name, a);
    g.setIndex(base.index);
    g.boundingSphere = base.boundingSphere;
    const attrs = {};
    for (const name of ATTRS) {
      const a = new InstancedBufferAttribute(new Float32Array(room * 4), 4);
      a.setUsage(DynamicDrawUsage);
      g.setAttribute(name, a);
      attrs[name] = a;
    }
    const mesh = new InstancedMesh(g, crewMaterial(), room);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.customDepthMaterial = crewDepthMaterial('depth');
    mesh.customDistanceMaterial = crewDepthMaterial('distance');
    mesh.castShadow = this.casting;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    this.group.add(mesh);
    return { base, geometry: g, mesh, attrs, room, n: 0 };
  }

  grow(p, n) {
    let room = p.room;
    while (room < n) room *= 2;
    const q = this.make(p.base, room);
    q.mesh.instanceMatrix.array.set(p.mesh.instanceMatrix.array.subarray(0, p.n * 16));
    for (const name of ATTRS) q.attrs[name].array.set(p.attrs[name].array.subarray(0, p.n * 4));
    this.group.remove(p.mesh);
    p.mesh.dispose();
    p.geometry.dispose();
    p.mesh = q.mesh;
    p.geometry = q.geometry;
    p.attrs = q.attrs;
    p.room = room;
  }

  setCasting(on) {
    this.casting = on;
    for (const p of this.pieces.values()) p.mesh.castShadow = on && p.lod < 2 && p.n > 0;
  }

  hide() {
    for (const p of this.pieces.values()) {
      p.mesh.count = 0;
      p.mesh.visible = false;
      p.n = 0;
    }
    this.lastSig = -1;
    this.stats.people = 0;
  }

  drop(id) {
    const p = this.pieces.get(id);
    if (!p) return;
    this.group.remove(p.mesh);
    p.mesh.dispose();
    p.geometry.dispose();
    p.base.dispose();
    this.pieces.delete(id);
    this.dirty = true;
  }

  /** Compile the crews' programs in the background (a hidden proxy each; the shadow caster's under a render target): a promise. */
  warm(gl, camera, scene, withOutput) {
    if (this.warming) return this.warming;
    const gen = this.warmGen = (this.warmGen || 0) + 1;
    const g = buildPiece('body:m', 2);
    this.proxyBase = g;
    this.proxies = [crewMaterial(), crewDepthMaterial('depth')].map((mat) => {
      const p = this.make(g, 1);
      p.mesh.material = mat;
      p.mesh.castShadow = false;
      p.mesh.name = 'ship-crews-warm';
      return p.mesh;
    });
    const [colour, depth] = this.proxies;
    depth.removeFromParent();
    this.depthScene = new Group();
    this.depthScene.add(depth);
    this.target = new WebGLRenderTarget(1, 1);
    const a = withOutput(() => gl.compileAsync(colour, camera, scene));
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(this.target);
    let b;
    try {
      b = gl.compileAsync(this.depthScene, camera, scene);
    } finally {
      gl.setRenderTarget(prev);
    }
    const done = () => { if (gen === this.warmGen) this.compiled = true; };
    this.warming = Promise.all([a, b]).then(done, done);
    return this.warming;
  }

  restored() {
    this.compiled = false;
    this.warmGen = (this.warmGen || 0) + 1;
    this.warming = null;
    this.disposeProxies();
  }

  disposeProxies() {
    for (const m of this.proxies || []) {
      m.removeFromParent();
      m.dispose();
      m.geometry.dispose();
    }
    this.proxies = null;
    if (this.proxyBase) this.proxyBase.dispose();
    this.proxyBase = null;
    if (this.target) this.target.dispose();
    this.target = null;
  }

  dispose() {
    for (const id of [...this.pieces.keys()]) this.drop(id);
    this.disposeProxies();
    this.group.removeFromParent();
  }
}
