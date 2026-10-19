/**
 * figures/figurePass.js
 * ----------------------------------------------------------------------------
 * The machinery the four instanced-figure passes share: the walkers
 * (walkers/pass.js), the fighting units (units/pass.js), the ships' crews
 * (ships/crew.js) and the buildings' people (people/batch.js). Each draws
 * people as one InstancedMesh a piece and level of detail, with five
 * per-instance attributes besides the matrix (ATTRS), and each needs the same
 * lifecycle: a piece built the first time it is wanted within a time budget,
 * written into its instance buffers, grown when full, freed after KEEP_FRAMES
 * unseen, its program compiled ahead on a hidden proxy, and all of it rebuilt
 * after a lost context. That lives here once, so a fix (a leak in drop, a
 * context-loss rule) is made once.
 *
 * What stays in each pass: what a piece is (buildBase), which materials
 * (the options), how an instance is filled (write), the set's signature, and
 * the frame's own bookkeeping. The places the four deliberately differ are
 * marked where they are handled: the first room (the people's batch starts
 * smaller), whether the pass casts shadows at all (the crews do not), what a
 * drop forgets (dropped), and BUILD_MS (the crews' budget is a millisecond
 * less: their own constant in ships/crew.js).
 * ----------------------------------------------------------------------------
 */

import { InstancedMesh, InstancedBufferAttribute, DynamicDrawUsage, Group, BufferGeometry, WebGLRenderTarget } from 'three';
import { buildPiece } from '../people/pieces.js';

/** First room in a piece's instance buffers (doubled as needed). */
export const FIRST_ROOM = 32;
/** Frames a piece is kept unseen before it is freed. */
export const KEEP_FRAMES = 900;
/** Milliseconds a frame may spend building pieces (one build may overrun). */
export const BUILD_MS = 6;
/** The per-instance attributes besides the matrix (4 floats each; the people's names: their shader declares them). */
export const ATTRS = ['aActClip', 'aActRoute', 'aActCol0', 'aActCol1', 'aActMisc'];

export class FigurePass {
  /**
   * @param {import('three').Object3D} parent where the meshes go (the models' slot, a lab scene)
   * @param {object} o
   * @param {string} o.name the group's name (the warm-up proxies' name follows it)
   * @param {() => import('three').Material} o.material the pieces' material
   * @param {(kind: string) => import('three').Material} o.depthMaterial the shadow casters' ('depth' or 'distance')
   * @param {boolean} [o.shadows] false: no piece ever casts (the crews)
   * @param {number} [o.firstRoom] room a new piece starts with
   * @param {(rows: number) => import('three').Texture} [o.makeTexture] the figures' texture of `rows` rows, for passes that have one
   */
  constructor(parent, { name, material, depthMaterial, shadows = true, firstRoom = FIRST_ROOM, makeTexture = null }) {
    this.name = name;
    this.materialOf = material;
    this.depthOf = depthMaterial;
    this.shadows = shadows;
    this.firstRoom = firstRoom;
    this.makeTexture = makeTexture;
    this.group = new Group();
    this.group.name = name;
    // (Drawn with the opaque models: sunRig.js renderModels leaves a group of opaque meshes out of the see-through draw.)
    this.group.userData.opaque = true;
    parent.add(this.group);
    this.pieces = new Map(); // `${key}|${lod}` -> { key, lod, base, geometry, mesh, attrs, room, n, seen, ms, tris }
    this.wanted = new Set(); // pieces asked for and not built yet: `${key}|${lod}`
    this.frame = 0;
    this.casting = true;
    this.dirty = false;
    this.lastSig = -1;
    this.compiled = false;
    this.gen = 0; // (bumped when a piece is freed: the looks seen complete look again)
    this.rows = 0;
    this.tex = null;
    this.data = null;
  }

  /** Room in the figures' texture for `rows` rows (a taller texture: the uniform points at it). Only the passes with a texture. */
  ensureRows(rows) {
    if (rows <= this.rows) return;
    let r = Math.max(1, this.rows);
    while (r < rows) r *= 2;
    if (this.tex) this.tex.dispose();
    this.tex = this.makeTexture(r);
    this.data = this.tex.image.data;
    this.rows = r;
  }

  /** The geometry of piece `key` at level `lod` (what a piece is: each pass's own). */
  buildBase(key, lod) {
    return buildPiece(key, lod);
  }

  /** A piece built at a level, or at another level already built (the nearest), or null. */
  pieceAt(key, lod) {
    for (const l of [lod, lod + 1, lod - 1, lod + 2, lod - 2]) {
      if (l < 0 || l > 2) continue;
      const p = this.pieces.get(`${key}|${l}`);
      if (p) return p;
    }
    return null;
  }

  /** Build the pieces asked for, within the budget (the first one whatever it costs). */
  build(until) {
    if (!this.wanted.size) return;
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
      const t = performance.now();
      const base = this.buildBase(key, lod);
      const p = this.make(base, this.firstRoom);
      Object.assign(p, { key, lod, seen: this.frame, ms: performance.now() - t, tris: base.index.count / 3 });
      this.pieces.set(id, p);
      // (A new level of a piece in use: written again to swap it in.)
      this.dirty = true;
    }
    this.stats.deferred = 0;
  }

  /** Instance `i` of piece `p` for figure `f` (a packed figure) in the figures' texture's cell `fi`: the walkers' and the units' way. */
  writeFigure(p, i, f, fi) {
    const at = p.attrs;
    at.aActClip.array.fill(0, i * 4, i * 4 + 4);
    at.aActRoute.array.set(f.route, i * 4);
    at.aActCol0.array.set(f.col0, i * 4);
    at.aActCol1.array.set(f.col1, i * 4);
    const mi = i * 4;
    at.aActMisc.array[mi] = f.head;
    at.aActMisc.array[mi + 1] = 0;
    at.aActMisc.array[mi + 2] = 0;
    at.aActMisc.array[mi + 3] = fi;
  }

  /** Does piece `p` cast shadows: not the crews', and not the far level's (a few pixels of shadow, half the draws). */
  castOf(p) {
    return this.shadows && this.casting && p.lod < 2;
  }

  /**
   * After the instances are written: each piece's mesh shows its count (hidden
   * at none), is marked seen, and the buffers' used range is sent again.
   * Returns { draws, tris } for the pass's stats.
   */
  flush() {
    let draws = 0;
    let tris = 0;
    for (const p of this.pieces.values()) {
      const n = p.n;
      p.mesh.count = n;
      p.mesh.visible = n > 0;
      if (!n) continue;
      p.seen = this.frame;
      p.mesh.castShadow = this.castOf(p);
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
    return { draws, tris };
  }

  /** A piece's InstancedMesh over `base` with room for `room` copies (its own instance attributes). */
  make(base, room) {
    // (A geometry of the piece's own attributes and the instances': growing makes a new one round the same piece.)
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
    const mesh = new InstancedMesh(g, this.materialOf(), room);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.customDepthMaterial = this.depthOf('depth');
    mesh.customDistanceMaterial = this.depthOf('distance');
    mesh.castShadow = this.shadows && this.casting;
    mesh.receiveShadow = true;
    // (The shader places everyone: no culling by the piece's own bounds.)
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    this.group.add(mesh);
    return { base, geometry: g, mesh, attrs, room, n: 0 };
  }

  /** More room in piece `p` (a new mesh in its place, the instances written so far copied). */
  grow(p, n) {
    let room = p.room;
    while (room < n) room *= 2;
    const q = this.make(p.base, room);
    q.mesh.instanceMatrix.array.set(p.mesh.instanceMatrix.array.subarray(0, p.n * 16));
    for (const name of ATTRS) q.attrs[name].array.set(p.attrs[name].array.subarray(0, p.n * 4));
    this.group.remove(p.mesh);
    p.mesh.dispose();
    // (The old wrapper freed: its instance buffers with it. The piece's own buffers, shared with the new
    // wrapper, go too and are sent again at its first draw: a few kilobytes, and growing is rare.)
    p.geometry.dispose();
    p.mesh = q.mesh;
    p.geometry = q.geometry;
    p.attrs = q.attrs;
    p.room = room;
  }

  /** Cast shadows or not (the sun's shadow map on or off; kept, though a pass with no shadows casts none). */
  setCasting(on) {
    this.casting = on;
    for (const p of this.pieces.values()) p.mesh.castShadow = this.castOf(p) && p.n > 0;
  }

  /** Nobody drawn this frame: every piece hidden (a pass then zeroes its own counts). */
  hide() {
    for (const p of this.pieces.values()) {
      p.mesh.count = 0;
      p.mesh.visible = false;
      p.n = 0;
    }
    this.lastSig = -1;
  }

  /** Free piece `id`: its mesh, geometry and base. */
  drop(id) {
    const p = this.pieces.get(id);
    if (!p) return;
    this.group.remove(p.mesh);
    p.mesh.dispose();
    p.geometry.dispose();
    p.base.dispose();
    this.pieces.delete(id);
    this.dropped();
  }

  /** What a freed piece invalidates: the set is written again, the looks seen complete look again (the people's batch keeps its own cache instead). */
  dropped() {
    this.dirty = true;
    this.gen++;
  }

  /**
   * Compile the programs before the first figure is drawn (a hidden proxy
   * each, the shadow caster's under a render target as the shadow pass draws
   * it): a promise. `gl` the renderer, `camera`, `scene` the light's scene,
   * `withOutput` the rig's (its tone mapping and colour space are part of a program).
   */
  warm(gl, camera, scene, withOutput) {
    if (this.warming) return this.warming;
    // (A compile started before a lost context must not count as this one.)
    const gen = this.warmGen = (this.warmGen || 0) + 1;
    const g = buildPiece('body:m', 2);
    this.proxyBase = g;
    this.proxies = [this.materialOf(), this.depthOf('depth')].map((mat) => {
      const p = this.make(g, 1);
      p.mesh.material = mat;
      p.mesh.castShadow = false;
      p.mesh.name = `${this.name}-warm`;
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

  /** The context was lost: compile again when it is back. */
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
    if (this.tex) this.tex.dispose();
    this.group.removeFromParent();
  }
}
