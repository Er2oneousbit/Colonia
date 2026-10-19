/**
 * walkers/pass.js
 * ----------------------------------------------------------------------------
 * The walkers drawn as 3D people (and their beasts and carts) by the WebGL
 * back end while it draws the buildings as models: the people's pieces
 * (people/pieces.js, and the walkers' own: props.js, beasts.js), one
 * InstancedMesh a piece and level of detail for every walker in view, in the
 * walkers' material (material.js), in the models' slot: lit by the 3D sun,
 * casting shadows, hidden behind buildings by the depth buffer like any model.
 *
 * Each frame:
 *   1. The renderer hands over the walkers in view (add): where walkerWorld
 *      puts each, what it carries, its state. A walker whose pieces are not
 *      built yet keeps its sprite that frame (canDraw), never a gap.
 *   2. motion.js works out each figure's place, facing and clips into one
 *      float texture (a cell a figure): the only upload of a frame, the rows
 *      it used. Nothing else is sent while the same walkers stay in view.
 *   3. When the set of walkers in view changes (one comes in or leaves, a
 *      look changes: a cart loaded, the level of detail), the pieces'
 *      instance buffers are written again: which figure each instance
 *      belongs to, its colours, its scale.
 *   4. The goods on carts and wagons are the warehouse's loads
 *      (models/wares.js buildLoad), placed through the model pass's own kits
 *      (ModelPass.place: one draw a part with the warehouses' loads).
 * A piece is built the first time it is wanted, within BUILD_MS a frame
 * (one build a frame may overrun), and freed after KEEP_FRAMES unseen.
 * ----------------------------------------------------------------------------
 */

import { Matrix4 } from 'three';
import { buildPiece } from '../people/pieces.js';
import { FigurePass, KEEP_FRAMES, BUILD_MS } from '../figures/figurePass.js';
import { pack, pick, hash01, TUNICS, SKINS, HAIRS } from '../people/actors.js';
import { peopleLodFor } from '../modelPass.js';
import { walkerMaterial, walkerDepthMaterial, figureTexture, FIGURES_ROW, FIGURE_FLOATS } from './material.js';
import { walkerProp } from './props.js';
import { rigidMesher, isRigidKey } from './beasts.js';
import { walkerLook, lookKey, drawnIn3D } from './look.js';
import { WalkerMotion, TILE_M } from './motion.js';
import { WARE_GOODS } from '../models/wares.js';

/** The geometry of a walker's piece: the people's, a walker's prop, a beast, a vehicle, a rope. */
export function buildWalkerPiece(key, lod) {
  const l = Math.max(0, Math.min(2, lod | 0));
  if (key.startsWith('wprop:')) {
    const [, name, side] = key.split(':');
    return walkerProp(name, side, l).build();
  }
  if (isRigidKey(key)) return rigidMesher(key, l).build();
  return buildPiece(key, l);
}

/** A figure packed once for its look: its pieces, colours, head and instance data. */
export function packFigure(f, index) {
  if (f.person) {
    const a = pack({ ...f.person, props: f.person.props || {} }, index);
    const pieces = [...a.pieces];
    for (const side of ['L', 'R']) if (f.wprops && f.wprops[side]) pieces.push(`wprop:${f.wprops[side]}:${side}`);
    return { pieces, col0: a.col0, col1: a.col1, route: new Float32Array([a.scale, 0, 0, 0]), head: a.misc[0] };
  }
  // A beast, a vehicle, a rope: its colours where given, else plain.
  const c = f.colours || {};
  const seed = index * 3.7 + 1;
  const col0 = new Float32Array([c.tunic ?? pick(TUNICS, seed, 1), c.mantle ?? 0x9a7a5a, c.skin ?? pick(SKINS, seed, 3), c.hair ?? pick(HAIRS, seed, 4)]);
  const col1 = new Float32Array([c.trim ?? 0x6a5040, c.leather ?? 0x5a3a24, c.accent ?? 0xb08848, c.metal ?? 0x8a8c90]);
  const kind = f.rope ? 2 : 1;
  return { pieces: [f.rigid], col0, col1, route: new Float32Array([1, f.bob || 0, f.swing || 0, kind]), head: 1 };
}

const _m = new Matrix4();
const _r = new Matrix4();
const _s = new Matrix4();
const TILE = new Matrix4().makeScale(1 / TILE_M, 1 / TILE_M, 1 / TILE_M);

export class WalkerPass extends FigurePass {
  /**
   * @param {import('three').Object3D} parent where the meshes go (the models' slot, a lab scene)
   */
  constructor(parent) {
    super(parent, { name: 'walkers', material: walkerMaterial, depthMaterial: walkerDepthMaterial, makeTexture: figureTexture });
    this.looks = new Map(); // walker id -> { key, look, packed }
    this.motion = new WalkerMotion();
    this.list = []; // this frame's walkers: { w, at, entry }
    this.used = 0;
    this.ensureRows(1);
    this.lod = 1;
    this.loads = []; // this frame's goods on carts: [key, Matrix4]
    this.loadMats = [];
    this.stats = { walkers: 0, figures: 0, people: 0, draws: 0, triangles: 0, writes: 0, deferred: 0, pieces: 0, loads: 0, ms: 0 };
  }

  /** The look of walker `w` (made again when what it depends on changes) and its figures packed. */
  entryOf(w, ctx) {
    const key = lookKey(w, ctx);
    let e = this.looks.get(w.id);
    if (e && e.key === key) {
      e.w = w;
      return e;
    }
    const look = walkerLook(w, ctx);
    const packed = look.figures.map((f, i) => packFigure(f, w.id * 4 + i));
    e = { key, look, packed, h: hashStr(key), w, built: -1, gen: -1 };
    this.looks.set(w.id, e);
    return e;
  }

  /**
   * Can walker `w` be drawn in 3D this frame (its type is, and every piece of
   * its look is built at some level)? If not, its pieces are asked for and it
   * keeps its sprite this frame. `ctx` as look.js walkerLook.
   */
  canDraw(w, ctx) {
    if (!drawnIn3D(w.type)) return false;
    const e = this.entryOf(w, ctx);
    // (Kept for add(), which follows for the same walker.)
    this.asked = e;
    // (All its pieces seen built at this level, and none freed since: no need to look again.)
    if (e.built === this.lod && e.gen === this.gen) return true;
    let all = true;
    let here = true;
    for (const f of e.packed) {
      for (const key of f.pieces) {
        if (this.pieces.has(`${key}|${this.lod}`)) continue;
        here = false;
        // (Asked at this frame's level; another level stands in meanwhile, if there is one.)
        this.wanted.add(`${key}|${this.lod}`);
        if (!this.pieceAt(key, this.lod)) all = false;
      }
    }
    if (here) {
      e.built = this.lod;
      e.gen = this.gen;
    }
    return all;
  }

  /** Start a frame: the camera's scale (device px per world px), the look's clock and the real seconds since the last. */
  begin(scale, time, dt) {
    this.frame++;
    this.lod = peopleLodFor(scale);
    this.used = 0;
    this.motion.begin(time, dt);
  }

  /** Walker `w` drawn this frame; `at` as WalkerMotion.place (copied); `ctx` as canDraw (asked first). */
  add(w, at, ctx) {
    let it = this.list[this.used];
    if (!it) {
      it = { w: null, at: { fx: 0, fy: 0, lift: 0, stride: 0, vt: 0, W: 0, H: 0, aim: null }, e: null };
      this.list[this.used] = it;
    }
    it.w = w;
    Object.assign(it.at, at);
    it.e = this.asked && this.asked.w === w ? this.asked : this.entryOf(w, ctx);
    this.used++;
  }

  /**
   * End the frame: build what was asked, place every figure (the texture),
   * write the instances if the set changed, and gather the cart loads for
   * the model pass (placeLoads). Returns how many walkers are drawn.
   */
  end() {
    const t0 = performance.now();
    this.build(t0 + BUILD_MS);
    // The set's signature: who, in what look, at what level.
    let sig = 0x811c9dc5 ^ this.lod;
    let figures = 0;
    for (let k = 0; k < this.used; k++) {
      const it = this.list[k];
      sig = Math.imul(sig ^ it.w.id, 0x01000193) >>> 0;
      sig = Math.imul(sig ^ it.e.h, 0x01000193) >>> 0;
      figures += it.e.packed.length;
    }
    this.ensureRows(Math.ceil(figures / FIGURES_ROW) || 1);
    if (sig !== this.lastSig || this.dirty) this.write(sig);
    // Every figure's place and clips into the texture; the loads on the carts.
    const data = this.data;
    let base = 0;
    this.loads.length = 0;
    let nl = 0;
    for (let k = 0; k < this.used; k++) {
      const it = this.list[k];
      this.motion.place(it.w, it.e.look, it.at, data, base);
      for (const ld of it.e.look.loads) {
        if (!WARE_GOODS.includes(ld.good)) continue;
        const p = this.motion.places[ld.on];
        if (!p) continue;
        for (let j = 0; j < ld.n && j < ld.at.length; j++) {
          const m = this.loadMats[nl] || (this.loadMats[nl] = new Matrix4());
          const a = ld.at[j];
          // (Each heap turned a little its own way, as loads are thrown on.)
          m.makeTranslation(p.x, p.y, p.z).multiply(_r.makeRotationY(p.yaw)).multiply(_s.makeTranslation(a[0], a[1], a[2]))
            .multiply(_r.makeRotationY((hash01(it.w.id, j) - 0.5) * 0.3)).multiply(_s.makeScale(ld.scale, ld.scale, ld.scale));
          m.premultiply(TILE);
          this.loads.push([`warehouse:load:${ld.good}`, m]);
          nl++;
        }
      }
      base += it.e.packed.length;
    }
    this.motion.end();
    // Upload the rows used (each row its own range: three uploads a range a row).
    const tex = this.tex;
    const rows = Math.ceil(base / FIGURES_ROW);
    tex.clearUpdateRanges();
    for (let r = 0; r < rows; r++) tex.addUpdateRange(r * FIGURES_ROW * FIGURE_FLOATS, Math.min(FIGURES_ROW, base - r * FIGURES_ROW) * FIGURE_FLOATS);
    if (rows) tex.needsUpdate = true;
    if (this.frame % 120 === 0) {
      // (A piece drawn now is in use however long since the set was last written: a still view writes nothing.)
      for (const [id, p] of this.pieces) if (p.n === 0 && this.frame - p.seen > KEEP_FRAMES) this.drop(id);
      for (const id of this.looks.keys()) if (!this.motion.states.has(id)) this.looks.delete(id);
    }
    this.stats.walkers = this.used;
    this.stats.figures = base;
    this.stats.loads = nl;
    this.stats.ms = performance.now() - t0;
    return this.used;
  }

  /** How far (tiles) what goes with walker `w` reaches along his facing: + a cart ahead, - a family or a team behind. */
  reachOf(w) {
    const e = this.looks.get(w.id);
    return e ? (e.look.reach || 0) / TILE_M : 0;
  }

  /** The cart loads gathered at end(), placed through the model pass's kits (called by ModelPass.update). */
  placeLoads(mp, lod) {
    for (const [key, m] of this.loads) mp.place(mp.kitFor(key, lod), m, 'always', false);
  }

  /** What a walker's piece is: the people's, a walker's prop, a beast, a vehicle, a rope. */
  buildBase(key, lod) {
    return buildWalkerPiece(key, lod);
  }

  /** Write every instance of this frame's set (`sig` its signature). */
  write(sig) {
    this.dirty = false;
    for (const p of this.pieces.values()) p.n = 0;
    let fi = 0;
    let people = 0;
    for (let k = 0; k < this.used; k++) {
      const it = this.list[k];
      for (const f of it.e.packed) {
        for (const key of f.pieces) {
          const p = this.pieces.get(`${key}|${this.lod}`) || this.pieceAt(key, this.lod);
          // (Not built at this level: written again once it is.)
          if (!p || p.lod !== this.lod) this.dirty = true;
          if (!p) continue;
          const i = p.n;
          if (i >= p.room) this.grow(p, i + 1);
          TILE.toArray(p.mesh.instanceMatrix.array, i * 16);
          this.writeFigure(p, i, f, fi);
          p.n = i + 1;
        }
        if (f.route[3] === 0) people++;
        fi++;
      }
    }
    this.lastSig = sig;
    const { draws, tris } = this.flush();
    Object.assign(this.stats, { people, draws, triangles: tris, pieces: this.pieces.size, writes: this.stats.writes + 1 });
  }

  /** Nobody drawn this frame (the walkers' sprites drawn instead, or none in view). */
  hide() {
    super.hide();
    this.used = 0;
    this.loads.length = 0;
    this.stats.walkers = 0;
  }
}

/** A string's FNV hash (a look's key in the set's signature). */
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
