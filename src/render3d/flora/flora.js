/**
 * flora/flora.js
 * ----------------------------------------------------------------------------
 * The 3D countryside's trees and rocks on a map, instanced: what the game's
 * WebGL back end draws (floraPass.js) and the look lab's Woods scene shows
 * (src/dev/labWoods.js), one engine for both.
 *
 * What stands where comes from layout.js (the map's variant layer, the
 * tile's place, its distance to water, the province's climate). A tile
 * has trees while it is forest with no road or building on it, rocks while
 * it is rock with no building (as the 2D renderer draws their sprites).
 *
 *   - Chunks of 32 x 32 tiles hold their tiles' plants and rocks. A change
 *     of the map (its revision) is looked for in its layers (terrain, roads,
 *     buildings), and only the chunks whose tiles changed are laid out
 *     again: a timber yard's clearing or a building placed over a wood shows
 *     at once, the rest of the map untouched.
 *   - A base is a species in one of its shapes (or a rock kind in one of
 *     its shapes). Each base has a kit (kit.js: its parts one per material)
 *     for its look this month at the level of detail in view, built the
 *     first time it is wanted; every part is an InstancedMesh, all of a
 *     base's parts sharing one buffer of instance matrices. A draw call a
 *     part whatever the number of trees.
 *   - The far level is an impostor (impostors.js): every far tree of every
 *     species is one instanced card, one draw call.
 *   - Each frame the caller says which chunks are in view (culling by
 *     chunk), the level of detail, the month, the view's turn and the tiles
 *     to leave out; the buffers are filled again only when one of those
 *     changed (or a chunk did), never otherwise: a still view costs nothing.
 *   - A new look (a month, a level of detail) is prepared behind the old
 *     one, a few kits a frame (`budget` ms), and swapped in whole once
 *     every base has it, as the sprites' looks are (renderer.js lookStep).
 *
 * The world is the view's tiles (x = u, z = v, y up, a tile a unit), as the
 * models' (models.js modelMatrix); the lab puts the slot in a group scaled
 * to metres.
 * ----------------------------------------------------------------------------
 */

import { Group, InstancedMesh, InstancedBufferAttribute, DynamicDrawUsage, Vector3, Color } from 'three';
import { Terrain } from '../../world/map.js';
import { toView } from '../../render/view.js';
import { kitOf, disposeKit } from '../kit.js';
import { SPECIES, lookOf, TREE_VARIANTS } from './species.js';
import { treesOfTile, rocksOfTile } from './layout.js';
import { buildTree } from './treeModel.js';
import { buildRock } from './rockModel.js';
import { ImpostorAtlas, impostorGeometry, CAM_R, CAM_B, UPRIGHT } from './impostors.js';
import { lin } from '../models/rural.js';

/** Tiles a chunk's side. */
export const CHUNK = 32;
/** Metres a tile (models.js TILE_M). */
const TILE_M = 4;
/** A tile at least this wide on the screen (device px) draws the full trees; at least LOD1_PX the middle ones; else the impostors. */
export const FLORA_LOD0_PX = 300;
export const FLORA_LOD1_PX = 110;
/** Frames a kit is kept unseen before it is freed. */
const KEEP_FRAMES = 900;
/** First room in a base's instance buffer (it doubles as needed). */
const FIRST_ROOM = 64;

/** The level of detail of the trees and rocks for a tile `px` device px wide on the screen. */
export function floraLod(px) {
  return px >= FLORA_LOD0_PX ? 0 : px >= FLORA_LOD1_PX ? 1 : 2;
}

/** What tile i of `map` shows: 0 nothing, 1 trees, 2 rocks (as the 2D renderer draws their sprites). */
export function tileFlora(map, i) {
  const t = map.terrain[i];
  if (map.building[i]) return 0;
  if (t === Terrain.TREES) return map.road[i] ? 0 : 1;
  if (t === Terrain.ROCK) return 2;
  return 0;
}

/** A base's key: a species in a shape, or a rock kind in a shape. */
const treeBase = (sp, v) => `t:${sp}:${v}`;
const rockBase = (kind, v) => `r:${kind}:${v}`;

export class Flora {
  /**
   * @param {import('three').WebGLRenderer} gl
   * @param {{ slot: import('three').Group, withColour?: (fn) => any }} opts
   *   slot: where the meshes go; withColour: runs a build with three's colour
   *   management on (the game's back end keeps it off: modelPass.js)
   */
  constructor(gl, { slot, withColour = (fn) => fn() } = {}) {
    this.gl = gl;
    this.slot = slot;
    this.withColour = withColour;
    this.group = new Group();
    this.group.name = 'flora';
    slot.add(this.group);
    // The impostors stand facing the camera across the ground: their own group turned to it.
    this.impGroup = new Group();
    this.impGroup.name = 'flora-impostors';
    this.group.add(this.impGroup);
    this.atlas = null;
    this.imp = null; // { mesh, room }
    this.kits = new Map(); // `${base}|${look}|${lod}` -> { kit, seen, ms }
    this.bases = []; // { key, tree, sp | kind, v, total, shown: { look, lod, id } | null, meshes, attr, room, n }
    this.baseIndex = new Map();
    this.map = null;
    // (The lab's specimens: a tile's plants by hand, i -> [plant] or null for the layout's.)
    this.plantsAt = null;
    this.frame = 0;
    this.version = 0;
    this.sig = '';
    this.shadows = false;
    this.facing = 0;
    this.stats = { trees: 0, rocks: 0, impostors: 0, kits: 0, triangles: 0, drawn: 0, built: 0, chunks: 0 };
    this.setFacing(0);
  }

  /** A new map (a new or loaded game): everything laid out again. `ctx`: species.js climateOf. */
  setMap(map, ctx) {
    this.map = map;
    this.ctx = ctx;
    this.cw = Math.ceil(map.w / CHUNK);
    this.ch = Math.ceil(map.h / CHUNK);
    this.chunks = Array.from({ length: this.cw * this.ch }, () => ({ recs: [], dirty: true }));
    this.state = new Uint8Array(map.size).fill(255);
    this.rev = -1;
    for (const b of this.bases) b.total = 0;
    this.sig = '';
    this.sync();
  }

  /** The base of `key`, registered the first time. */
  baseOf(key, tree, name, v) {
    let k = this.baseIndex.get(key);
    if (k !== undefined) return k;
    k = this.bases.length;
    this.bases.push({ key, tree, name, v, total: 0, shown: null, meshes: [], attr: null, room: 0, n: 0 });
    this.baseIndex.set(key, k);
    return k;
  }

  /**
   * Look for changes on the map since the last call (its revision): the
   * tiles whose trees or rocks come or go, and their chunks laid out again.
   * Returns whether anything changed.
   */
  sync() {
    const map = this.map;
    if (!map || map.revision === this.rev) return false;
    this.rev = map.revision;
    const st = this.state;
    let changed = false;
    for (let i = 0; i < map.size; i++) {
      const s = tileFlora(map, i);
      if (s === st[i]) continue;
      st[i] = s;
      const x = i % map.w;
      const y = (i / map.w) | 0;
      this.chunks[Math.floor(y / CHUNK) * this.cw + Math.floor(x / CHUNK)].dirty = true;
      changed = true;
    }
    if (!changed) return false;
    for (let c = 0; c < this.chunks.length; c++) if (this.chunks[c].dirty) this.layChunk(c);
    this.version++;
    return true;
  }

  /** Lay out chunk c's plants and rocks from the map. */
  layChunk(c) {
    const map = this.map;
    const ch = this.chunks[c];
    for (const r of ch.recs) this.bases[r.b].total--;
    ch.recs = [];
    const cx = (c % this.cw) * CHUNK;
    const cy = Math.floor(c / this.cw) * CHUNK;
    for (let y = cy; y < Math.min(map.h, cy + CHUNK); y++) {
      for (let x = cx; x < Math.min(map.w, cx + CHUNK); x++) {
        const i = y * map.w + x;
        const s = this.state[i];
        if (s === 1) {
          for (const p of (this.plantsAt && this.plantsAt(i)) || treesOfTile(map, i, this.ctx)) {
            const b = this.baseOf(treeBase(p.sp, p.v), true, p.sp, p.v);
            ch.recs.push({ b, i, x: x + p.x, z: y + p.z, yaw: p.yaw, s: p.s });
          }
        } else if (s === 2) {
          for (const p of rocksOfTile(map, i, this.ctx)) {
            const b = this.baseOf(rockBase(p.kind, p.v), false, p.kind, p.v);
            ch.recs.push({ b, i, x: x + p.x, z: y + p.z, yaw: p.yaw, s: p.s });
          }
        }
      }
    }
    for (const r of ch.recs) this.bases[r.b].total++;
    ch.dirty = false;
  }

  /** How many plants and rocks the map holds (every chunk). */
  counts() {
    let trees = 0;
    let rocks = 0;
    for (const b of this.bases) {
      if (b.tree) trees += b.total;
      else rocks += b.total;
    }
    return { trees, rocks };
  }

  /** The impostors face the camera: turned by `a` about the vertical (the lab turns its camera; the game's never turns). */
  setFacing(a) {
    this.facing = a;
    this.impGroup.rotation.set(0, a, 0);
    this.impGroup.updateMatrixWorld(true);
    const c = Math.cos(a);
    const s = Math.sin(a);
    // The card's axes in the world: along the screen and toward the camera across the ground, turned.
    const turn = (v) => new Vector3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
    this.axR = turn(CAM_R);
    this.axB = turn(new Vector3(CAM_B.x, 0, CAM_B.z).normalize());
    this.sig = '';
  }

  /** The kit of a base's look at a level of detail (built now if `build`; null if not built and not to be). */
  kitFor(base, look, lod, build) {
    const id = `${base.key}|${look}|${lod}`;
    let k = this.kits.get(id);
    if (k || !build) return k || null;
    const t0 = performance.now();
    const kit = this.withColour(() => {
      const built = base.tree
        ? buildTree({ species: base.name, variant: base.v, look, lod })
        : buildRock({ kind: base.name, variant: base.v, lod, warm: !!(this.ctx && this.ctx.desert) });
      const out = kitOf(built.group);
      built.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      return out;
    });
    k = { kit, seen: this.frame, id, ms: performance.now() - t0 };
    this.kits.set(id, k);
    this.stats.built++;
    return k;
  }

  /** The look a base shows in `month` (rocks have one). */
  lookOf(base, month) {
    return base.tree ? lookOf(base.name, month) : 'any';
  }

  /** The level a base's kit is built at for a frame's level `lod` (a tree's far level is its impostor, baked from level 1). */
  kitLod(base, lod) {
    return base.tree ? Math.min(1, lod) : lod;
  }

  /**
   * Prepare and draw this frame's flora. `o`: { chunks (indices in view, or
   * null for all), lod (0..2), month (or null), turn, hidden (a Set of map
   * tiles to leave out, or null), budget (ms for building kits; Infinity
   * builds all at once), shadows (cast into the sun's shadow map) }.
   * Returns how many are drawn.
   */
  update(o) {
    this.frame++;
    if (!this.map) return 0;
    const { lod = 1, month = null, turn = 0, hidden = null, budget = 8, shadows = false } = o;
    const until = performance.now() + budget;
    // 1. The kits this frame wants: every base on the map, at this month's look and this level.
    let missing = 0;
    let swap = true;
    for (const base of this.bases) {
      if (!base.total) continue;
      const look = this.lookOf(base, month);
      const kl = this.kitLod(base, lod);
      let k = this.kitFor(base, look, kl, false);
      // (Nothing shown yet: nothing to draw meanwhile, so it is built whatever the budget.)
      if (!k && (!base.shown || performance.now() < until)) k = this.kitFor(base, look, kl, true);
      if (!k) {
        missing++;
        swap = false;
      }
    }
    // 2. Swapped in whole: every base takes the wanted kit once all are built.
    if (swap) {
      for (const base of this.bases) {
        if (!base.total) continue;
        const look = this.lookOf(base, month);
        const kl = this.kitLod(base, lod);
        const id = `${base.key}|${look}|${kl}`;
        if (!base.shown || base.shown.id !== id) this.show(base, this.kits.get(id), look, kl);
      }
    }
    // 3. The impostors, far out: baked from level 1 (each base's look), all or none.
    let impostors = false;
    if (lod === 2) impostors = this.bakeImpostors(month, until);
    // 4. The instances, filled again only when something they depend on changed.
    const chunks = o.chunks || this.chunks.map((_, c) => c);
    const hidKey = hidden && hidden.size ? [...hidden].join(',') : '';
    const sig = `${chunks.join(',')}|${turn}|${lod}|${impostors}|${this.version}|${hidKey}|${this.bases.map((b) => (b.shown ? b.shown.id : '')).join(';')}`;
    if (sig !== this.sig) {
      this.sig = sig;
      this.fill(chunks, turn, hidden, impostors);
    }
    // 5. Shadows (near the view only: the caller says), kits seen, the old ones freed.
    let tris = 0;
    let drawn = 0;
    for (const base of this.bases) {
      if (!base.shown) continue;
      const k = this.kits.get(base.shown.id);
      if (k) k.seen = this.frame;
      for (const im of base.meshes) {
        im.castShadow = shadows && im.userData.part.cast;
        if (im.count) tris += im.count * triCount(im.geometry);
      }
      drawn += base.n;
    }
    if (this.imp) {
      this.imp.mesh.castShadow = false;
      drawn += this.imp.mesh.count;
      tris += this.imp.mesh.count * 2;
    }
    // (A season's impostors are kept by their bake; the kits for the next level of detail are built when asked.)
    if (this.frame % 60 === 0) {
      for (const [id, k] of this.kits) {
        if (this.frame - k.seen > KEEP_FRAMES && !this.bases.some((b) => b.shown && b.shown.id === id)) {
          disposeKit(k.kit);
          this.kits.delete(id);
        }
      }
    }
    this.stats = { ...this.stats, ...this.counts(), kits: this.kits.size, triangles: Math.round(tris), drawn, missing, lod, impostors, chunks: chunks.length };
    this.missing = missing;
    return drawn;
  }

  /** Show base `base` as kit `k` (its look and level): its meshes made again on the kit's parts, sharing one buffer. */
  show(base, k, look, lod) {
    for (const im of base.meshes) {
      im.parent.remove(im);
      im.dispose();
    }
    base.meshes = [];
    base.shown = { look, lod, id: k.id };
    const room = Math.max(FIRST_ROOM, base.room || 0);
    base.attr = new InstancedBufferAttribute(new Float32Array(room * 16), 16);
    base.attr.setUsage(DynamicDrawUsage);
    base.room = room;
    for (const part of k.kit.parts) {
      const im = new InstancedMesh(part.geometry, part.material, room);
      im.instanceMatrix = base.attr;
      im.frustumCulled = false; // (culled by chunk: flora.update's caller)
      im.receiveShadow = true;
      im.castShadow = false;
      im.count = 0;
      im.visible = false;
      im.userData.part = part;
      this.group.add(im);
      base.meshes.push(im);
    }
    this.sig = '';
  }

  /** Room for `n` instances of a base (its meshes made again on a bigger buffer). */
  grow(base, n) {
    let room = base.room;
    while (room < n) room *= 2;
    const k = this.kits.get(base.shown.id);
    const old = base.attr;
    base.room = room;
    this.show(base, k, base.shown.look, base.shown.lod);
    base.attr.array.set(old.array.subarray(0, base.n * 16));
  }

  /**
   * Bake every tree base's impostor for its look this month (from its level
   * 1 kit, built if need be within the budget). True when all are baked.
   */
  bakeImpostors(month, until) {
    if (!this.atlas) this.atlas = new ImpostorAtlas(this.gl);
    let all = true;
    for (const base of this.bases) {
      if (!base.tree || !base.total) continue;
      const look = this.lookOf(base, month);
      const key = `${base.key}|${look}`;
      if (this.atlas.cells.has(key)) {
        base.cell = this.atlas.cells.get(key);
        continue;
      }
      if (performance.now() > until) {
        all = false;
        continue;
      }
      const k = this.kitFor(base, look, 1, true);
      k.seen = this.frame;
      // (The tree's mean colour clears its cell: its mipmaps fade toward it, not toward black.)
      k.kit.mean = meanColour(base.name, look);
      // An atlas full of last season's looks: let the looks no base shows go.
      if (this.atlas.full) this.freeCells(month);
      const cell = this.atlas.bake(key, k.kit);
      if (!cell) {
        all = false;
        continue;
      }
      base.cell = cell;
      this.sig = '';
    }
    // Every base must have its cell for this look.
    for (const base of this.bases) {
      if (!base.tree || !base.total) continue;
      if (!this.atlas.cells.has(`${base.key}|${this.lookOf(base, month)}`)) all = false;
    }
    return all;
  }

  /** Free the impostor cells of looks no base wants this month. */
  freeCells(month) {
    const want = new Set(this.bases.filter((b) => b.tree && b.total).map((b) => `${b.key}|${this.lookOf(b, month)}`));
    for (const key of [...this.atlas.cells.keys()]) if (!want.has(key)) this.atlas.drop(key);
  }

  /** Fill every base's instances (and the impostors') from the chunks in view. */
  fill(chunks, turn, hidden, impostors) {
    const map = this.map;
    const W = map.w;
    const H = map.h;
    const qa = (-(turn & 3) * Math.PI) / 2;
    for (const base of this.bases) base.n = 0;
    let impN = 0;
    const imp = impostors ? this.impostorMesh() : null;
    const R = this.axR;
    const B = this.axB;
    for (const c of chunks) {
      const ch = this.chunks[c];
      if (!ch) continue;
      for (const r of ch.recs) {
        if (hidden && hidden.has(r.i)) continue;
        const base = this.bases[r.b];
        if (!base.shown) continue;
        const [vx, vz] = toView(r.x, r.z, turn, W, H);
        const k = r.s / TILE_M;
        if (imp && base.tree && base.cell) {
          if (impN >= this.imp.room) this.growImpostors(impN + 1, impN);
          const cell = base.cell;
          const a = this.imp.mesh.instanceMatrix.array;
          const o = impN * 16;
          // In the impostors' group: x along the screen, z toward the camera, y up.
          const lx = vx * R.x + vz * R.z;
          const lz = vx * B.x + vz * B.z;
          a.fill(0, o, o + 16);
          a[o] = (cell.r1 - cell.r0) * k;
          a[o + 5] = (cell.u1 - cell.u0) * UPRIGHT * k;
          a[o + 10] = 1;
          a[o + 12] = lx + cell.r0 * k;
          a[o + 13] = cell.u0 * UPRIGHT * k;
          a[o + 14] = lz;
          a[o + 15] = 1;
          this.imp.cells.array.set([cell.uv.x, cell.uv.y, cell.uv.z, cell.uv.w], impN * 4);
          impN++;
          continue;
        }
        if (base.n >= base.room) this.grow(base, base.n + 1);
        const a = base.attr.array;
        const o = base.n * 16;
        const yaw = r.yaw + qa;
        const cs = Math.cos(yaw) * k;
        const sn = Math.sin(yaw) * k;
        a[o] = cs; a[o + 1] = 0; a[o + 2] = -sn; a[o + 3] = 0;
        a[o + 4] = 0; a[o + 5] = k; a[o + 6] = 0; a[o + 7] = 0;
        a[o + 8] = sn; a[o + 9] = 0; a[o + 10] = cs; a[o + 11] = 0;
        a[o + 12] = vx; a[o + 13] = 0; a[o + 14] = vz; a[o + 15] = 1;
        base.n++;
      }
    }
    for (const base of this.bases) {
      const n = base.n;
      for (const im of base.meshes) {
        im.count = n;
        im.visible = n > 0;
      }
      if (n && base.attr) {
        base.attr.clearUpdateRanges();
        base.attr.addUpdateRange(0, n * 16);
        base.attr.needsUpdate = true;
      }
    }
    if (this.imp) {
      const m = this.imp.mesh;
      m.count = impN;
      m.visible = impN > 0;
      if (impN) {
        m.instanceMatrix.clearUpdateRanges();
        m.instanceMatrix.addUpdateRange(0, impN * 16);
        m.instanceMatrix.needsUpdate = true;
        this.imp.cells.clearUpdateRanges();
        this.imp.cells.addUpdateRange(0, impN * 4);
        this.imp.cells.needsUpdate = true;
      }
    }
  }

  /** The impostors' instanced card (made the first time). */
  impostorMesh() {
    if (this.imp) return this.imp;
    this.makeImpostors(FIRST_ROOM * 8);
    return this.imp;
  }

  makeImpostors(room) {
    const g = impostorGeometry(room);
    const mesh = new InstancedMesh(g, this.atlas.materialOf(), room);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    g.attributes.aCell.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.count = 0;
    mesh.visible = false;
    this.impGroup.add(mesh);
    this.imp = { mesh, room, cells: g.attributes.aCell };
  }

  growImpostors(n, keep) {
    const old = this.imp;
    let room = old.room;
    while (room < n) room *= 2;
    this.impGroup.remove(old.mesh);
    const oldM = old.mesh.instanceMatrix.array;
    const oldC = old.cells.array;
    old.mesh.geometry.dispose();
    old.mesh.dispose();
    this.imp = null;
    this.makeImpostors(room);
    this.imp.mesh.instanceMatrix.array.set(oldM.subarray(0, Math.min(oldM.length, keep * 16)));
    this.imp.cells.array.set(oldC.subarray(0, Math.min(oldC.length, keep * 4)));
  }

  /** Every material the flora draws with now (to compile them before they draw: floraPass.js). */
  materials() {
    const out = new Set();
    for (const k of this.kits.values()) for (const p of k.kit.parts) out.add(p.material);
    if (this.atlas && this.atlas.material) out.add(this.atlas.material);
    return out;
  }

  /** Is every base on the map shown (some look, some level)? */
  get complete() {
    return this.bases.every((b) => !b.total || b.shown);
  }

  /** GPU memory of the kits' geometry and the impostor atlas (bytes, roughly). */
  bytes() {
    let n = 0;
    for (const k of this.kits.values()) {
      for (const p of k.kit.parts) {
        for (const a of Object.values(p.geometry.attributes)) n += a.array.byteLength;
        if (p.geometry.index) n += p.geometry.index.array.byteLength;
      }
    }
    for (const b of this.bases) if (b.attr) n += b.attr.array.byteLength;
    if (this.imp) n += this.imp.mesh.instanceMatrix.array.byteLength + this.imp.cells.array.byteLength;
    return { geometry: n, atlas: this.atlas ? this.atlas.bytes : 0 };
  }

  /** The WebGL context came back: the impostors must be baked again (their pictures were on the GPU). */
  restored() {
    if (this.atlas) {
      this.atlas.dispose();
      this.atlas = null;
    }
    if (this.imp) {
      this.impGroup.remove(this.imp.mesh);
      this.imp.mesh.geometry.dispose();
      this.imp.mesh.dispose();
      this.imp = null;
    }
    for (const b of this.bases) b.cell = null;
    this.sig = '';
  }

  dispose() {
    for (const b of this.bases) {
      for (const im of b.meshes) {
        im.parent.remove(im);
        im.dispose();
      }
      b.meshes = [];
      b.shown = null;
    }
    for (const k of this.kits.values()) disposeKit(k.kit);
    this.kits.clear();
    this.restored();
    this.slot.remove(this.group);
  }
}

/** Triangles a geometry draws. */
function triCount(g) {
  return (g.index ? g.index.count : g.attributes.position.count) / 3;
}

/** A tree's mean colour in a look (linear), for its impostor cell's background. */
function meanColour(sp, look) {
  const c = SPECIES[sp].colours;
  const list = look === 'autumn' ? c.autumn || c.leaf : look === 'spring' ? c.spring || c.leaf : look === 'bare' ? [SPECIES[sp].bark.tint] : c.leaf;
  const out = [0, 0, 0];
  for (const hex of list) {
    const v = lin(hex);
    for (let q = 0; q < 3; q++) out[q] += v[q] / list.length;
  }
  return new Color(out[0], out[1], out[2]);
}

export { TREE_VARIANTS };
