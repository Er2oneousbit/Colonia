/**
 * units/pass.js
 * ----------------------------------------------------------------------------
 * The fighting units drawn as 3D figures by the WebGL back end while it draws
 * the buildings as models (the soldiers, the raiders of every people,
 * Caesar's legionaries, rebel gladiators, a village's men, wolves; the ships
 * are their own pass's): one InstancedMesh a piece and level of detail for
 * every unit in view, in the units' material (material.js), in the models'
 * slot: lit by the 3D sun, casting shadows, hidden behind buildings by the
 * depth buffer like any model. As the walkers' pass (walkers/pass.js):
 *
 *   1. The renderer hands over the units in view (canDraw, add): where the
 *      sim puts each this frame, which way it stepped, whom it fights. A unit
 *      whose pieces are not built yet keeps its sprite that frame.
 *   2. motion.js works out each figure's place, facing and clips into one
 *      float texture (a cell a figure): the only upload of a frame.
 *   3. When the set in view changes (one comes in, one dies, a legionary
 *      draws his gladius, the level of detail), the pieces' instance buffers
 *      are written again: which figure each instance belongs to, its colours.
 *   4. The dead: the sim forgets a unit the tick it dies; this pass keeps its
 *      look and place (died()), and draws it falling and lying there for
 *      motion.js CORPSE_S of game time, then sinking away.
 * ----------------------------------------------------------------------------
 */

import { InstancedMesh, InstancedBufferAttribute, DynamicDrawUsage, Group, BufferGeometry, Matrix4, WebGLRenderTarget } from 'three';
import { pack, pick, hash01, TUNICS, SKINS, HAIRS } from '../people/actors.js';
import { buildPiece } from '../people/pieces.js';
import { peopleLodFor } from '../modelPass.js';
import { unitMaterial, unitDepthMaterial, unitFigureTexture, UNIT_FIGURES_ROW, UNIT_FIGURE_FLOATS } from './material.js';
import { buildUnitPiece } from './pieces.js';
import { unitLook, unitLookKey, unitDrawnIn3D } from './look.js';
import { UnitMotion, CORPSE_S, SINK_S } from './motion.js';
import { ThreatGrid } from './threat.js';
import { toView } from '../../render/view.js';
import { HALF_W, HALF_H } from '../../config.js';

const FIRST_ROOM = 32;
const KEEP_FRAMES = 900;
const BUILD_MS = 6;
/** The dead kept at most (the oldest go first). */
const MAX_DEAD = 160;
const ATTRS = ['aActClip', 'aActRoute', 'aActCol0', 'aActCol1', 'aActMisc'];
const TILE = new Matrix4().makeScale(1 / 4, 1 / 4, 1 / 4);

/** A prop's piece key from a look's hand entry: the people's (prop:<name>) or the units' (uprop:<name>). */
function propKey(entry, side) {
  return `${entry}:${side}`;
}

/** A figure packed once for its look: its pieces, colours, scale and kind. */
export function packUnitFigure(f, index) {
  if (f.person) {
    const a = pack({ ...f.person, props: {} }, index);
    const pieces = [...a.pieces, ...f.gear];
    for (const side of ['L', 'R']) if (f.props && f.props[side]) pieces.push(propKey(f.props[side], side));
    return { pieces, col0: a.col0, col1: a.col1, route: new Float32Array([f.scale || 1, 0, 0, 0]), head: a.misc[0] };
  }
  const c = f.colours || {};
  const seed = index * 3.7 + 1;
  const col0 = new Float32Array([c.tunic ?? pick(TUNICS, seed, 1), c.mantle ?? 0x9a7a5a, c.skin ?? pick(SKINS, seed, 3), c.hair ?? pick(HAIRS, seed, 4)]);
  const col1 = new Float32Array([c.trim ?? 0x6a5040, c.leather ?? 0x5a3a24, c.accent ?? 0xb08848, c.metal ?? 0x8a8c90]);
  if (f.quad) return { pieces: [f.quad], col0, col1, route: new Float32Array([f.scale || 1, 0, 0, 3]), head: 1 };
  return { pieces: [f.rigid], col0, col1, route: new Float32Array([f.scale || 1, 0, 0, 1]), head: 1 };
}

export class UnitPass {
  /** @param {import('three').Object3D} parent where the meshes go (the models' slot, a lab scene) */
  constructor(parent) {
    this.group = new Group();
    this.group.name = 'units';
    this.group.userData.opaque = true;
    parent.add(this.group);
    this.pieces = new Map();
    this.looks = new Map(); // unit id -> { key, look, packed, h, built, gen }
    this.wanted = new Set();
    this.motion = new UnitMotion();
    this.threats = new ThreatGrid();
    this.list = [];
    this.used = 0;
    this.rows = 0;
    this.tex = null;
    this.data = null;
    this.ensureRows(1);
    this.lastSig = -1;
    this.lod = 1;
    this.frame = 0;
    this.casting = true;
    this.compiled = false;
    this.gen = 0;
    this.dead = []; // unit ids lying dead, oldest first
    this.view = null;
    this.stats = { units: 0, figures: 0, dead: 0, draws: 0, triangles: 0, writes: 0, deferred: 0, pieces: 0, ms: 0 };
  }

  ensureRows(rows) {
    if (rows <= this.rows) return;
    let r = Math.max(1, this.rows);
    while (r < rows) r *= 2;
    if (this.tex) this.tex.dispose();
    this.tex = unitFigureTexture(r);
    this.data = this.tex.image.data;
    this.rows = r;
  }

  /**
   * Start a frame: `scale` the camera's (device px a world px), `tick` the
   * game's ticks with the frame's share of the next (the units' clock: still
   * while paused), `units` every unit (the threats are found among them),
   * `view` { vt, W, H, x0, x1, y0, y1 } (the view's turn, the map's size, the
   * world px in view: the dead are drawn only there).
   */
  begin(scale, tick, units, view) {
    this.frame++;
    this.lod = peopleLodFor(scale);
    this.used = 0;
    this.motion.begin(tick);
    this.threats.build(units);
    this.view = view;
  }

  /** The look of unit `u` now (made again when what it depends on changes), its figures packed. */
  entryOf(u, ctx) {
    const key = unitLookKey(u, ctx);
    let e = this.looks.get(u.id);
    if (e && e.key === key) return e;
    const look = unitLook(u, ctx);
    const packed = look.figures.map((f, i) => packUnitFigure(f, u.id * 6 + i));
    const fresh = { key, look, packed, h: hashStr(key), built: -1, gen: -1 };
    // (A new look whose pieces are not built keeps the old one meanwhile: a legionary never flickers to his sprite.)
    if (e && !this.ready(fresh)) {
      this.ask(fresh);
      return e;
    }
    this.looks.set(u.id, fresh);
    return fresh;
  }

  pieceAt(key, lod) {
    for (const l of [lod, lod + 1, lod - 1, lod + 2, lod - 2]) {
      if (l < 0 || l > 2) continue;
      const p = this.pieces.get(`${key}|${l}`);
      if (p) return p;
    }
    return null;
  }

  /** Every piece of entry e built at some level? */
  ready(e) {
    for (const f of e.packed) for (const key of f.pieces) if (!this.pieceAt(key, this.lod)) return false;
    return true;
  }

  /** Ask for every piece of entry e at this frame's level. */
  ask(e) {
    for (const f of e.packed) for (const key of f.pieces) if (!this.pieces.has(`${key}|${this.lod}`)) this.wanted.add(`${key}|${this.lod}`);
  }

  /**
   * Can unit `u` be drawn in 3D this frame? `ctx` { people: the raid's people
   * id }. Works out its threat and its arms (motion.js armsOf), its look, and
   * asks for any piece not built (it keeps its sprite until they are).
   */
  canDraw(u, ctx, foe) {
    if (!unitDrawnIn3D(u.type)) return false;
    const dist = this.threats.nearest(u);
    const since = this.motion.tick - u.strikeTick;
    const env = { threat: dist < 8, threatDist: dist, striking: since >= 0 && since < 30, moving: !!u.moving };
    const c = this.ctx || (this.ctx = {});
    c.people = ctx.people || '';
    c.arms = this.motion.armsOf(u, env);
    const e = this.entryOf(u, c);
    this.asked = { u, e, dist, foe };
    if (e.built === this.lod && e.gen === this.gen) return true;
    let all = true;
    let here = true;
    for (const f of e.packed) {
      for (const key of f.pieces) {
        if (this.pieces.has(`${key}|${this.lod}`)) continue;
        here = false;
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

  /** Unit `u` drawn this frame (after canDraw for it); `at` as UnitMotion.place (copied). */
  add(u, at) {
    let it = this.list[this.used];
    if (!it) {
      it = { u: null, at: { fx: 0, fy: 0, lift: 0, stride: 0, vt: 0, W: 0, H: 0, dx: 0, dy: 0, foe: null, threat: false, threatDist: 99, charging: false }, e: null, dead: false };
      this.list[this.used] = it;
    }
    const a = this.asked && this.asked.u === u ? this.asked : null;
    it.u = u;
    it.dead = false;
    Object.assign(it.at, at);
    const dist = a ? a.dist : this.threats.nearest(u);
    it.at.threat = dist < 8;
    it.at.threatDist = dist;
    const foeNear = at.foe ? Math.hypot(at.foe[0], at.foe[1]) : 99;
    it.at.charging = !!u.moving && (foeNear < 5 || dist < 3.5);
    it.e = a ? a.e : this.entryOf(u, { people: '' });
    this.used++;
  }

  /**
   * A unit died at (x, y) (map tiles; sim/units.js's 'unitDied'): the one of
   * that type last drawn there is kept, falling and lying dead.
   */
  died({ x, y, type }) {
    let best = null;
    let bestD = 0.8;
    for (const [id, s] of this.motion.states) {
      if (s.dead !== null || s.type !== type || this.frame - s.seen > 3) continue;
      const d = Math.hypot(s.fx - x, s.fy - y);
      if (d < bestD) { bestD = d; best = id; }
    }
    if (best === null || !this.looks.has(best)) return false;
    const s = this.motion.states.get(best);
    s.dead = this.motion.clock;
    s.fx = x;
    s.fy = y;
    this.dead.push(best);
    while (this.dead.length > MAX_DEAD) this.forget(this.dead.shift());
    return true;
  }

  forget(id) {
    this.motion.states.delete(id);
    this.looks.delete(id);
  }

  /** The dead in view this frame, as items (the ones sunk away forgotten). */
  gatherDead() {
    const v = this.view;
    if (!v) return;
    const clock = this.motion.clock;
    for (let i = 0; i < this.dead.length; i++) {
      const id = this.dead[i];
      const s = this.motion.states.get(id);
      const e = this.looks.get(id);
      if (!s || !e || clock - s.dead > CORPSE_S + SINK_S || clock < s.dead - 1) {
        this.forget(id);
        this.dead.splice(i--, 1);
        continue;
      }
      s.seen = this.motion.frame;
      const [vu, vv] = toView(s.fx, s.fy, v.vt, v.W, v.H);
      const wx = (vu - vv) * HALF_W;
      const wy = (vu + vv) * HALF_H;
      if (wx < v.x0 - 40 || wx > v.x1 + 40 || wy < v.y0 - 40 || wy > v.y1 + 60) continue;
      let it = this.list[this.used];
      if (!it) {
        it = { u: null, at: { fx: 0, fy: 0, lift: 0, stride: 0, vt: 0, W: 0, H: 0, dx: 0, dy: 0, foe: null, threat: false, threatDist: 99, charging: false }, e: null, dead: false };
        this.list[this.used] = it;
      }
      it.u = { id: -id - 1 };
      it.dead = s;
      it.e = e;
      it.at.vt = v.vt; it.at.W = v.W; it.at.H = v.H;
      this.used++;
    }
  }

  /** End the frame: build what was asked, write the instances if the set changed, place every figure. */
  end() {
    const t0 = performance.now();
    this.gatherDead();
    this.build(t0 + BUILD_MS);
    let sig = 0x811c9dc5 ^ this.lod;
    let figures = 0;
    for (let k = 0; k < this.used; k++) {
      const it = this.list[k];
      sig = Math.imul(sig ^ it.u.id, 0x01000193) >>> 0;
      sig = Math.imul(sig ^ it.e.h, 0x01000193) >>> 0;
      figures += it.e.packed.length;
    }
    this.ensureRows(Math.ceil(figures / UNIT_FIGURES_ROW) || 1);
    if (sig !== this.lastSig || this.dirty) this.write(sig);
    const data = this.data;
    let base = 0;
    let dead = 0;
    for (let k = 0; k < this.used; k++) {
      const it = this.list[k];
      if (it.dead) {
        this.motion.placeDead(it.dead, it.e.look, it.at, data, base);
        dead++;
      } else this.motion.place(it.u, it.e.look, it.at, data, base);
      base += it.e.packed.length;
    }
    this.motion.end();
    const tex = this.tex;
    const rows = Math.ceil(base / UNIT_FIGURES_ROW);
    tex.clearUpdateRanges();
    for (let r = 0; r < rows; r++) tex.addUpdateRange(r * UNIT_FIGURES_ROW * UNIT_FIGURE_FLOATS, Math.min(UNIT_FIGURES_ROW, base - r * UNIT_FIGURES_ROW) * UNIT_FIGURE_FLOATS);
    if (rows) tex.needsUpdate = true;
    if (this.frame % 120 === 0) {
      for (const [id, p] of this.pieces) if (p.n === 0 && this.frame - p.seen > KEEP_FRAMES) this.drop(id);
      for (const id of this.looks.keys()) if (!this.motion.states.has(id)) this.looks.delete(id);
    }
    this.stats.units = this.used - dead;
    this.stats.dead = dead;
    this.stats.figures = base;
    this.stats.ms = performance.now() - t0;
    return this.used;
  }

  /** How far (tiles) unit `u`'s figures reach ahead of its place (a horse's head, a chariot's ponies). */
  reachOf(u) {
    const e = this.looks.get(u.id);
    return e ? (e.look.reach || 0) / 4 : 0;
  }

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
      const base = buildUnitPiece(key, lod);
      const p = this.make(base, FIRST_ROOM);
      Object.assign(p, { key, lod, seen: this.frame, ms: performance.now() - t, tris: base.index.count / 3 });
      this.pieces.set(id, p);
      this.dirty = true;
    }
    this.stats.deferred = 0;
  }

  write(sig) {
    this.dirty = false;
    for (const p of this.pieces.values()) p.n = 0;
    let fi = 0;
    for (let k = 0; k < this.used; k++) {
      const it = this.list[k];
      for (const f of it.e.packed) {
        for (const key of f.pieces) {
          const p = this.pieces.get(`${key}|${this.lod}`) || this.pieceAt(key, this.lod);
          if (!p || p.lod !== this.lod) this.dirty = true;
          if (!p) continue;
          const i = p.n;
          if (i >= p.room) this.grow(p, i + 1);
          TILE.toArray(p.mesh.instanceMatrix.array, i * 16);
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
          p.n = i + 1;
        }
        fi++;
      }
    }
    this.lastSig = sig;
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
    Object.assign(this.stats, { draws, triangles: tris, pieces: this.pieces.size, writes: this.stats.writes + 1 });
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
    const mesh = new InstancedMesh(g, unitMaterial(), room);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.customDepthMaterial = unitDepthMaterial('depth');
    mesh.customDistanceMaterial = unitDepthMaterial('distance');
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

  /** Nobody drawn this frame. */
  hide() {
    this.used = 0;
    for (const p of this.pieces.values()) {
      p.mesh.count = 0;
      p.mesh.visible = false;
      p.n = 0;
    }
    this.lastSig = -1;
    this.stats.units = 0;
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
    this.gen++;
  }

  /** Compile the units' programs before the first is drawn (as the walkers': walkers/pass.js warm). */
  warm(gl, camera, scene, withOutput) {
    if (this.warming) return this.warming;
    const gen = this.warmGen = (this.warmGen || 0) + 1;
    const g = buildPiece('body:m', 2);
    this.proxyBase = g;
    this.proxies = [unitMaterial(), unitDepthMaterial('depth')].map((mat) => {
      const p = this.make(g, 1);
      p.mesh.material = mat;
      p.mesh.castShadow = false;
      p.mesh.name = 'units-warm';
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
    if (this.tex) this.tex.dispose();
    this.group.removeFromParent();
  }
}

function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export { hash01 };
