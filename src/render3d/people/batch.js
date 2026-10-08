/**
 * people/batch.js
 * ----------------------------------------------------------------------------
 * The people in view, drawn: one InstancedMesh a piece and level of detail
 * (a body, a garment, a head of hair, a prop) across every building that
 * shows it, in one material (material.js), the motion on the GPU.
 *
 * Each frame the model pass (modelPass.js) hands over the casts of the
 * buildings it draws (actors.js cast: their actors packed once) with each
 * building's matrix; the batch keeps a signature of that set and writes the
 * instance buffers again only when it changed (a building came into view or
 * left it, a state changed, the level of detail, the view's turn). A still
 * or panning view writes nothing: the time uniform alone moves everyone.
 *
 * A piece's geometry is built the first time its key and level are wanted
 * (pieces.js), within the model pass's budget a frame: past it, the same
 * piece at another level already built stands in for a frame or two, as the
 * kits do.
 * ----------------------------------------------------------------------------
 */

import { InstancedMesh, InstancedBufferAttribute, DynamicDrawUsage, Matrix4, Group, BufferGeometry } from 'three';
import { buildPiece } from './pieces.js';
import { peopleMaterial, peopleDepthMaterial } from './material.js';

/** First room in a piece's instance buffers (doubled as needed). */
const FIRST_ROOM = 16;
/** Frames a piece is kept unseen before it is freed. */
const KEEP_FRAMES = 900;
/** The per-instance attributes (4 floats each) besides the matrix. */
const ATTRS = ['aActClip', 'aActRoute', 'aActCol0', 'aActCol1', 'aActMisc'];

const _m = new Matrix4();
const _a = new Matrix4();
const F32 = new Float32Array(1);
const U32 = new Uint32Array(F32.buffer);

/** A float's bits folded into a running hash (the set's signature). */
function mix(h, v) {
  F32[0] = v;
  return Math.imul(h ^ U32[0], 0x01000193) >>> 0;
}

export class PeopleBatch {
  /**
   * @param {import('three').Object3D} parent where the meshes go (the model slot, a lab scene)
   */
  constructor(parent) {
    this.group = new Group();
    this.group.name = 'people';
    // (Drawn with the opaque models: sunRig.js renderModels leaves a group of opaque meshes out of the see-through draw.)
    this.group.userData.opaque = true;
    parent.add(this.group);
    this.pieces = new Map(); // `${key}|${lod}` -> { geometry, mesh, n, seen, key, lod, ms }
    this.list = []; // this frame's [cast, matrix, seed]
    this.used = 0;
    this.sig = 0;
    this.lastSig = -1;
    this.frame = 0;
    this.casting = true;
    this.buildUntil = 0;
    this.stats = { people: 0, pieces: 0, draws: 0, triangles: 0, writes: 0, deferred: 0 };
  }

  /** Start a frame at level `lod`; `buildUntil` the time (performance.now()) building must stop by. */
  begin(lod, buildUntil = 0) {
    this.frame++;
    this.lod = lod;
    this.buildUntil = buildUntil;
    this.used = 0;
    this.sig = mix(0x811c9dc5, lod);
  }

  /** A building's cast (actors.js) drawn at `matrix` (its model's, metres to the world); `seed` its own (phases). */
  add(cast, matrix, seed = 0) {
    if (!cast || !cast.actors.length) return;
    let e = this.list[this.used];
    if (!e) {
      e = { cast: null, m: new Matrix4(), seed: 0 };
      this.list[this.used] = e;
    }
    e.cast = cast;
    e.m.copy(matrix);
    e.seed = seed;
    this.used++;
    let h = mix(this.sig, cast.id);
    h = mix(h, seed);
    const el = matrix.elements;
    for (let i = 0; i < 16; i++) h = mix(h, el[i]);
    this.sig = h;
  }

  /** End the frame: write the instances if the set changed; returns how many people are drawn. */
  end() {
    this.stats.deferred = 0;
    if (this.sig !== this.lastSig || this.dirty) this.write();
    else for (const p of this.pieces.values()) if (p.mesh.count) p.seen = this.frame;
    // Free the pieces nobody drew for a while (another zoom's level).
    if (this.frame % 120 === 0) {
      for (const [id, p] of this.pieces) if (this.frame - p.seen > KEEP_FRAMES) this.drop(id);
    }
    return this.stats.people;
  }

  /** Write every instance of this frame's set. */
  write() {
    this.lastSig = this.sig;
    this.dirty = false;
    for (const p of this.pieces.values()) p.n = 0;
    let people = 0;
    for (let k = 0; k < this.used; k++) {
      const { cast, m, seed } = this.list[k];
      for (const a of cast.actors) {
        people++;
        _a.fromArray(a.local);
        _m.multiplyMatrices(m, _a);
        // Each building its own phases and a speed a little its own, from its seed: two alike never move in step.
        const ph = ((seed * 0.6180339 + a.index * 0.3819660) % 1) * 61;
        const sp = 0.94 + ((seed * 0.7548777 + a.index * 0.5698403) % 1) * 0.12;
        for (const key of a.pieces) {
          const p = this.pieceFor(key, this.lod);
          if (!p) continue;
          const i = p.n;
          if (i >= p.room) this.grow(p, i + 1);
          _m.toArray(p.mesh.instanceMatrix.array, i * 16);
          const at = p.attrs;
          at.aActClip.array.set(a.clip, i * 4);
          at.aActClip.array[i * 4 + 1] += ph;
          at.aActClip.array[i * 4 + 2] *= sp;
          at.aActRoute.array.set(a.route, i * 4);
          at.aActCol0.array.set(a.col0, i * 4);
          at.aActCol1.array.set(a.col1, i * 4);
          at.aActMisc.array.set(a.misc, i * 4);
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
    this.stats.people = people;
    this.stats.pieces = this.pieces.size;
    this.stats.draws = draws;
    this.stats.triangles = tris;
    this.stats.writes = (this.stats.writes || 0) + 1;
  }

  /** A piece at a level, built the first time (within the frame's budget, else another level's). */
  pieceFor(key, lod) {
    const id = `${key}|${lod}`;
    let p = this.pieces.get(id);
    if (p) return p;
    if (this.buildUntil && performance.now() > this.buildUntil) {
      for (const l of [lod + 1, lod - 1, lod + 2, lod - 2]) {
        const o = this.pieces.get(`${key}|${l}`);
        if (o) {
          this.stats.deferred++;
          // (Written again next frame, when there may be time to build this level.)
          this.dirty = true;
          return o;
        }
      }
    }
    const t0 = performance.now();
    const geometry = buildPiece(key, lod);
    p = this.make(geometry, FIRST_ROOM);
    Object.assign(p, { key, lod, seen: this.frame, ms: performance.now() - t0, tris: geometry.index.count / 3 });
    this.pieces.set(id, p);
    return p;
  }

  /** A piece's InstancedMesh over `geometry` with room for `room` copies (its own instance attributes). */
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
    const mesh = new InstancedMesh(g, peopleMaterial(), room);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.customDepthMaterial = peopleDepthMaterial('depth');
    mesh.customDistanceMaterial = peopleDepthMaterial('distance');
    mesh.castShadow = this.casting;
    mesh.receiveShadow = true;
    // (Only the buildings in view are handed over; and the shader moves people about: no culling by bounds.)
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

  /** Cast shadows or not (the sun's shadow map on or off). */
  setCasting(on) {
    this.casting = on;
    for (const p of this.pieces.values()) p.mesh.castShadow = on;
  }

  /** Hide everyone (a frame with no models drawn). */
  hide() {
    for (const p of this.pieces.values()) {
      p.mesh.count = 0;
      p.mesh.visible = false;
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
  }

  dispose() {
    for (const id of [...this.pieces.keys()]) this.drop(id);
    this.group.removeFromParent();
  }
}
