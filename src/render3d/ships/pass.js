/**
 * ships/pass.js
 * ----------------------------------------------------------------------------
 * The vessels drawn in 3D by the WebGL back end while it draws the
 * buildings as models: every walker of kind 'ship' (merchant ships, fishing
 * boats) and every unit with `naval` (the liburnians, the raiders' ships),
 * in place of their live sprites. Classic draws the sprites as before, and
 * the sim never sees any of this.
 *
 * Each frame:
 *   1. The back end hands over each vessel's item as the renderer queued it
 *      (take): where it is (its waterline's middle, world px), what it is.
 *      The pass works out its kind and what it is doing (look.js), where it
 *      lies when moored (moorings.js), and moves it (motion.js: its
 *      heading eased round, the sea's heave, pitch and roll, the sail's
 *      trim, the rowers' stroke, the wake). The item's click spot becomes a
 *      line from the stern to the bow, and its lantern's place is left on
 *      the item for the night's light map.
 *   2. The hull, yards, sails and furled sails are the model pass's kits
 *      (hulls.js, models.js MODEL_PARTS 'vessel'), placed with each frame's
 *      matrices through ModelPass.extra (one draw a part for every ship that
 *      shows it): placeKits.
 *   3. The crews are the people system's people (crew.js), carried by one
 *      float texture of the hulls' places and tilts written each frame;
 *      their instances are written only when the set changes.
 *   4. The wakes and bow waves: one mesh of foam on the water, rebuilt
 *      each frame from the ships' trails (a few hundred vertices a ship).
 *   5. A ship lost (a raider rammed, a liburnian sunk, a fishing boat
 *      fired) goes down where it was: settling by the stern, listing, under
 *      in SINK_S seconds, its debris floating a while after.
 * ----------------------------------------------------------------------------
 */

import { Matrix4, Vector3, Quaternion, BufferGeometry, BufferAttribute, Mesh, DynamicDrawUsage, Group, InstancedMesh, ColorManagement } from 'three';
import { kitOf } from '../kit.js';
import { HALF_W, HALF_H } from '../../config.js';
import { TRADE_PARTNERS } from '../../data/scenarios.js';
import { toView, viewDir } from '../../render/view.js';
import { ART_PX } from '../projection.js';
import { material, LOOK } from '../materials.js';
import { peopleLodFor } from '../modelPass.js';
import { DESIGNS, extentOf } from './designs.js';
import { placesOf, buildHull, LANTERNS, buildVesselPart, sailGlow } from './hulls.js';
import { vesselKind, vesselMode, crewOf, lookKeyOf, isVessel } from './look.js';
import { ShipMotion, TILE_M, sinkPose, SINK_S, DEBRIS_S, WAKE_POINTS } from './motion.js';
import { mooringOf } from './moorings.js';
import { CrewBatch, packCrew, shipTexture, SHIPS_ROW, SHIP_FLOATS } from './crew.js';
import { health as drawHealth } from '../../render/shipArt.js';

/** Rome's red stripe on a liburnian's sail; the Punic purple. */
const SAIL_STRIPE = Object.freeze({ liburnian: 0xa8322b, punic: 0x5b1e3c });
/** Most vertices of the wakes' mesh (64 ships' worth). */
const WAKE_VERTS = 64 * (WAKE_POINTS * 36 + 24);

const _m = new Matrix4();
const _h = new Matrix4();
const _r = new Matrix4();
const _t = new Matrix4();
const _s = new Matrix4();
const _q = new Quaternion();
const _v = new Vector3();
const _p = new Vector3();
const _e = new Vector3();

/** Run `fn` with three's colour management on: the look's materials are written in sRGB (modelPass.js withColourManagement). */
function withCM(fn) {
  const was = ColorManagement.enabled;
  ColorManagement.enabled = true;
  try {
    return fn();
  } finally {
    ColorManagement.enabled = was;
  }
}

/** A CSS hex colour ('#3f6fb0') as a number. */
function hexOf(css) {
  return css && /^#[0-9a-f]{6}$/i.test(css) ? parseInt(css.slice(1), 16) : null;
}

/** The people id a raider ship's warriors are (its raid's, else the province's): sim/combat.js raidPeople. */
function peopleOf(game, u) {
  const m = game.military || {};
  if (m.active && m.active.id === u.invasion && m.active.people) return m.active.people;
  return m.people || null;
}

/** A ship's matrix (the model slot's units: view tiles) from its place (metres), yaw, pitch (bow up +) and roll (to starboard +). */
export function shipMatrix(x, y, z, yaw, pitch, roll, out = new Matrix4()) {
  // R = Ry(yaw) Rx(-pitch) Rz(-roll): the bow (+z) turned to yaw, raised by pitch, the starboard side down by roll.
  _r.makeRotationY(yaw).multiply(_t.makeRotationX(-pitch)).multiply(_s.makeRotationZ(-roll));
  out.makeTranslation(x / TILE_M, y / TILE_M, z / TILE_M).multiply(_r).multiply(_s.makeScale(1 / TILE_M, 1 / TILE_M, 1 / TILE_M));
  return out;
}

/** A point of a ship's own frame (metres) to world px and its height: { wx, wy } as the renderer's walkers are placed. */
function toWorldPx(m, p) {
  _v.set(p[0], p[1], p[2]).applyMatrix4(m);
  return { wx: (_v.x - _v.z) * HALF_W, wy: (_v.x + _v.z) * HALF_H - _v.y / ART_PX };
}

export class ShipPass {
  /** @param {import('three').Object3D} parent the models' slot (or a lab scene) */
  constructor(parent) {
    this.parent = parent;
    this.crew = new CrewBatch(parent);
    this.motion = new ShipMotion();
    this.casts = new Map(); // look key -> packed crew
    this.list = []; // this frame's ships: { id, e, kind, st, m, slot, key, unit }
    this.kits = []; // this frame's kit placements: [key, Matrix4, state]
    this.mats = [];
    this.used = 0;
    this.nKits = 0;
    this.taken = new Set();
    this.prev = new Map(); // id -> the last frame's ship (to see one lost)
    this.wrecks = new Map(); // id -> { kind, x, z, yaw, at (clock), size }
    this.owners = new Map(); // fishing boat id -> its wharf or shipyard id
    this.rows = 0;
    this.tex = null;
    this.ensureRows(1);
    this.turn = null;
    this.frame = 0;
    this.lod = 1;
    this.clock = 0;
    this.stats = { ships: 0, kits: 0, people: 0, crewDraws: 0, wrecks: 0, writes: 0, ms: 0 };
    // The wakes and bow waves: one mesh of foam over the water, see-through.
    const g = new BufferGeometry();
    this.wakePos = new Float32Array(WAKE_VERTS * 3);
    this.wakeNor = new Float32Array(WAKE_VERTS * 3);
    this.wakeUv = new Float32Array(WAKE_VERTS * 2);
    this.wakeCol = new Float32Array(WAKE_VERTS * 4);
    for (let i = 0; i < WAKE_VERTS; i++) this.wakeNor[i * 3 + 1] = 1;
    for (const [name, arr, n] of [['position', this.wakePos, 3], ['normal', this.wakeNor, 3], ['uv', this.wakeUv, 2], ['color', this.wakeCol, 4]]) {
      const a = new BufferAttribute(arr, n);
      a.setUsage(DynamicDrawUsage);
      g.setAttribute(name, a);
    }
    g.setDrawRange(0, 0);
    this.wake = new Mesh(g, withCM(() => material('ship-wake', { color: 0xf4f8f6, roughness: 0.5, opacity: 0.62, snow: 0, wet: 0 })));
    this.wake.name = 'ship-wakes';
    this.wake.frustumCulled = false;
    this.wake.castShadow = false;
    this.wake.receiveShadow = true;
    this.wake.visible = false;
    // (Scaled from metres to the view's tiles, as the kits are.)
    this.wake.scale.setScalar(1 / TILE_M);
    parent.add(this.wake);
    this.nWake = 0;
  }

  /** Room in the ships' texture for `rows` rows. */
  ensureRows(rows) {
    if (rows <= this.rows) return;
    let r = Math.max(1, this.rows);
    while (r < rows) r *= 2;
    if (this.tex) this.tex.dispose();
    this.tex = shipTexture(r);
    this.data = this.tex.image.data;
    this.rows = r;
    this.lastSig = -1;
  }

  /** Can the pass draw (its crews' programs and its kits' new materials compiled)? */
  get compiled() { return this.crew.compiled && this.kitsCompiled; }

  /**
   * Start a frame. `r` the renderer (its game, camera, view turn, the
   * frame's light), `clock` the look's clock (s), `dt` real seconds since
   * the last frame.
   */
  begin(r, clock, dt) {
    this.frame++;
    this.r = r;
    this.game = r.game;
    this.clock = clock;
    this.lod = peopleLodFor(r.camera.scale);
    this.motion.begin(clock, dt);
    this.used = 0;
    this.nKits = 0;
    this.nMats = 0;
    this.kits.length = 0;
    this.taken.clear();
    // The wind the sails fill with: the look's (the trees sway with it), the way the air moves on the view's ground.
    const w = LOOK.uniforms.uLookWind.value;
    this.wind = [w.x, w.y];
    // The sun through the sails (hulls.js sailGlow): by day, as bright as the day is.
    const env = r.env || {};
    sailGlow(Math.max(0, Math.min(1, env.sun ?? 1)) * (1 - 0.6 * (env.overcast || 0)));
    // The view turned: every heading turns with it (a quarter turn takes the map's +x from the view's +u to +v), the wakes start again.
    const vt = r.viewTurn || 0;
    if (this.turn !== null && vt !== this.turn) this.motion.turned(vt - this.turn);
    this.turn = vt;
    if (this.game !== this.lastGame) {
      // A new game or a load: another city's ships and wrecks.
      this.lastGame = this.game;
      this.prev.clear();
      this.wrecks.clear();
      this.owners.clear();
    }
  }

  /**
   * The renderer's item for a vessel (a K_WALKER of kind 'ship' or a naval
   * K_UNIT): drawn in 3D now (true), or left to its sprite (false: not a
   * vessel). A ship under a bridge's deck comes in two pieces: the second
   * is taken with nothing more to do. Marks (`this.marks`: the ring of the
   * selected one, a damaged warship's health bar) are left for the back
   * end to paint as live art, or null.
   */
  take(it) {
    this.marks = null;
    const unit = !!it.u;
    const e = unit ? it.u : it.w;
    if (!e || !isVessel(e)) return false;
    // Its place: the item's waterline middle (world px) back to the view's tiles.
    const vu = (it.wx / HALF_W + it.wy / HALF_H) / 2;
    const vv = (it.wy / HALF_H - it.wx / HALF_W) / 2;
    return this.add(e, unit, vu, vv, it);
  }

  /**
   * Vessel `e` (a walker, or a unit: `unit`) at view tile (vu, vv) this
   * frame (take, or the lab's Ships scene): moved, its kits and crew queued.
   * `it` takes its lantern's place (`lamp`); false if it is no vessel.
   */
  add(e, unit, vu, vv, it = {}) {
    const id = unit ? 1e6 + e.id : e.id;
    if (this.taken.has(id)) return true;
    const game = this.game;
    const people = e.type === 'raider_ship' ? peopleOf(game, e) : null;
    const kind = vesselKind(e, people);
    if (!kind || !DESIGNS[kind]) return false;
    this.taken.add(id);
    const d = DESIGNS[kind];
    const map = game.map;
    const vt = this.turn;
    const moving = !!e.moving;
    const mode = vesselMode(e, moving);
    // Lying at a quay: where (moorings.js), in the view's metres, its bow's heading there.
    const prevSt = this.motion.states.get(id);
    let dir0 = null;
    if (prevSt) {
      // (The bow's way now, back on the map: the nearer way along the quay wins.)
      const [mx, my] = viewDir(Math.sin(prevSt.yaw), Math.cos(prevSt.yaw), (4 - vt) & 3);
      dir0 = [mx, my];
    }
    const moorMap = mooringOf(e, kind, game, e.type === 'fishing_boat' ? this.ownerOf(e) : null, dir0);
    let moor = null;
    if (moorMap) {
      const [mu, mv] = toView(moorMap.x, moorMap.y, vt, map.w, map.h);
      const [du, dv] = viewDir(moorMap.dir[0], moorMap.dir[1], vt);
      moor = { x: mu * TILE_M, z: mv * TILE_M, yaw: Math.atan2(du, dv) };
    }
    let ring = null;
    if (e.type === 'liburnian' && e.state === 'holding') {
      const st = game.buildings.get(e.station);
      if (st && st.rally) {
        const [ru, rv] = toView(st.rally.x, st.rally.y, vt, map.w, map.h);
        ring = [ru * TILE_M, rv * TILE_M];
      }
    }
    const env = this.r.env || {};
    const hurt = unit && e.maxHp ? 1 - e.hp / e.maxHp : 0;
    const wind = this.wind || [0.6, 0.3];
    const st = this.motion.update(id, { x: vu * TILE_M, z: vv * TILE_M }, {
      moving, moor, ring, anchor: mode.mode === 'anchor', size: d.hull.L, wind, rough: Math.min(1, (env.rain || 0) * 0.7),
      sail: mode.sail, row: mode.row && moving, hurt, yaw0: this.headingOf(e, unit),
    });
    // The crew: rowing only while it moves (a warship lying still in a fight rests its oars).
    const m = mode.row && !moving ? { ...mode, row: false } : mode;
    const partner = e.type === 'ship' ? e.partner || '' : '';
    const throwing = e.type === 'raider_ship' && this.r.frameInfo && this.r.frameInfo.tick - (e.strikeTick ?? -1e9) < 8;
    const key = lookKeyOf(kind, m, { partner, people: people || '', throwing });
    let crew = this.casts.get(key);
    if (!crew) {
      crew = packCrew(crewOf(kind, m, { people, throwing }));
      this.casts.set(key, crew);
    }
    const slot = this.used++;
    let rec = this.list[slot];
    if (!rec) rec = this.list[slot] = {};
    Object.assign(rec, { id, e, kind, st, m, slot, key, unit, crew, phase: ((e.id * 0.6180339) % 1) * 9 });
    this.prev.set(id, { e, kind, unit, st });
    // The hull's matrix, its kits, the crew's cell.
    const M = shipMatrix(st.x, st.y, st.z, st.yaw, st.pitch, st.roll, this.mat());
    this.placeShip(kind, d, M, st, m, partner, env, rec);
    this.writeCell(slot, st, unit && e.type === 'raider_ship' ? (e.crew || []).length : 99, 1);
    // The click: a line from the stern to the bow (the renderer's spots; pickWalker and pickShip test it).
    const half = extentOf(d).half;
    const sp = toWorldPx(M, [0, 0.4, -half]);
    const bp = toWorldPx(M, [0, 0.4, half]);
    this.spot(unit, e.id, sp, bp);
    // The lantern at the stern (the night's light map: renderer.js collectLights).
    const la = LANTERNS.get(kind) || this.lanternOf(kind);
    if (la) it.lamp = toWorldPx(M, la);
    // The ring of the selected one, a damaged warship's health.
    this.marks = this.marksFor(it, unit, e, M, d, st);
    return true;
  }

  /** The way a vessel first seen is heading (view yaw): its step on the map, or a unit's last move. */
  headingOf(e, unit) {
    const dx = unit ? e.x - (e.px ?? e.x) : e.tx - e.x;
    const dy = unit ? e.y - (e.py ?? e.y) : e.ty - e.y;
    if (!dx && !dy) return 0;
    const [du, dv] = viewDir(dx, dy, this.turn);
    return Math.atan2(du, dv);
  }

  /** The fishing boat's owner: the wharf it works for, else the shipyard it waits at (found once). */
  ownerOf(w) {
    const game = this.game;
    const known = this.owners.get(w.id);
    const b = known !== undefined ? game.buildings.get(known) : null;
    if (b && (b.boatId === w.id || b.spareId === w.id)) return b;
    for (const c of game.buildings.values()) {
      if (c.boatId === w.id || c.spareId === w.id) {
        this.owners.set(w.id, c.id);
        return c;
      }
    }
    return null;
  }

  /** The lantern's place on a kind (hulls.js records it as it builds a hull: built once at the far level if not yet). */
  lanternOf(kind) {
    if (!LANTERNS.has(kind)) {
      const h = withCM(() => buildHull(kind, 2));
      for (const mesh of h.meshes) mesh.geometry.dispose();
    }
    return LANTERNS.get(kind) || null;
  }

  /** The frame's next matrix for a kit (reused frame to frame). */
  mat() {
    const n = this.nMats++;
    return this.mats[n] || (this.mats[n] = new Matrix4());
  }

  /** One more kit copy this frame. */
  kit(key, m, state = 'always') {
    const k = this.kits[this.nKits] || (this.kits[this.nKits] = [null, null, null]);
    k[0] = key;
    k[1] = m;
    k[2] = state;
    this.nKits++;
  }

  /**
   * A ship's kits at hull matrix M: its hull (the lantern lit at night), each
   * mast's yard braced to the wind, its sail filled and let fall as far as
   * it is set (or the sail brailed up along the yard), a merchant's in its
   * partner's colour; a fishing boat's net on the water beside it, a basket
   * of its catch.
   */
  placeShip(kind, d, M, st, m, partner, env, rec) {
    const night = (env.lamps || 0) > 0.25;
    this.kit(`vessel:${kind}:hull`, M, night ? 'open' : 'shut');
    const P = placesOf(kind);
    const stripe = kind === 'corbita' || kind === 'coaster' ? hexOf(TRADE_PARTNERS[partner]?.color) : SAIL_STRIPE[kind] ?? null;
    P.masts.forEach((mast, i) => {
      const Y = this.mat();
      Y.copy(M).multiply(_t.makeTranslation(mast.yard[0], mast.yard[1], mast.yard[2])).multiply(_s.makeRotationY(st.brace * (i ? 0.6 : 1)));
      this.kit(`vessel:${kind}:yard:${i}`, Y);
      if (st.unfurl > 0.05) {
        const S = this.mat();
        // Brailed up toward the yard (the cloth gathered by its brails), its belly by the wind.
        S.copy(Y).multiply(_s.makeScale(1, Math.max(0.06, st.unfurl), st.fill));
        this.kit(`vessel:${kind}:sail:${i}${stripe != null ? `:${stripe.toString(16).padStart(6, '0')}` : ''}`, S);
      }
      if (st.unfurl < 0.45) this.kit(`vessel:${kind}:furl:${i}`, Y);
    });
    if (m.net) {
      // The net cast on the starboard side, floating flat (the sea's tilt not on it), a little off the hull.
      const N = this.mat();
      const off = d.hull.B / 2 + 1.6;
      N.makeTranslation((st.x + Math.cos(st.yaw) * off) / TILE_M, 0, (st.z - Math.sin(st.yaw) * off) / TILE_M).multiply(_s.makeScale(1 / TILE_M, 1 / TILE_M, 1 / TILE_M));
      this.kit('vessel:net', N);
    }
    if (m.catch) {
      const C = this.mat();
      const t = 0.42;
      C.copy(M).multiply(_t.makeTranslation(0.25, P.point(t, 0.3)[1] + 0.02, (t - 0.5) * (d.hull.L - 0.7)));
      this.kit('vessel:catch', C);
    }
    rec.M = M;
  }

  /** Ship `slot`'s cell in the crews' texture: its place, yaw, tilt in the world, stroke clock, warriors aboard, shown. */
  writeCell(slot, st, warriors, shown, down = 0, list = 0, pitch = 0) {
    this.ensureRows(Math.ceil((slot + 1) / SHIPS_ROW));
    const o = slot * SHIP_FLOATS;
    const D = this.data;
    // The tilt as a turn about the world's axes: R Ry(-yaw), R = Ry(yaw) Rx(-pitch) Rz(-roll).
    _r.makeRotationY(st.yaw).multiply(_t.makeRotationX(-(st.pitch + pitch))).multiply(_s.makeRotationZ(-(st.roll + list))).multiply(_t.makeRotationY(-st.yaw));
    const e = _r.elements;
    D[o] = st.x;
    D[o + 1] = st.y - down;
    D[o + 2] = st.z;
    D[o + 3] = st.yaw;
    D[o + 4] = e[0]; D[o + 5] = e[1]; D[o + 6] = e[2]; D[o + 7] = st.stroke;
    D[o + 8] = e[4]; D[o + 9] = e[5]; D[o + 10] = e[6]; D[o + 11] = warriors;
    D[o + 12] = e[8]; D[o + 13] = e[9]; D[o + 14] = e[10]; D[o + 15] = shown;
  }

  /** The renderer's click spot for a vessel: from the stern to the bow (world px). */
  spot(unit, id, sp, bp) {
    const r = this.r;
    const spots = unit ? r.shipSpots : r.walkerSpots;
    if (!spots) return;
    for (const s of spots) {
      if (s.id !== id || (!unit && !s.ship)) continue;
      s.wx = sp.wx;
      s.wy = sp.wy;
      s.reachX = bp.wx - sp.wx;
      s.reachY = bp.wy - sp.wy;
      return;
    }
  }

  /** The marks over a vessel drawn in 3D: the ring round the selected one's waterline, a damaged warship's health bar ({ draw, box } in device px), or null. */
  marksFor(it, unit, e, M, d, st) {
    const r = this.r;
    const info = r.frameInfo || {};
    const selFort = info.selFort || 0;
    const ringed = unit ? (selFort !== 0 && (e.fort === selFort || e.station === selFort)) || e.id === r.selectedUnit : e.id === r.selectedWalker;
    const hurt = unit && e.hp < e.maxHp;
    if (!ringed && !hurt) return null;
    const cam = r.camera;
    const k = cam.scale;
    const { half, beam } = extentOf(d);
    const pts = [];
    if (ringed) {
      for (let i = 0; i <= 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const p = toWorldPx(M, [Math.cos(a) * (beam + 0.5), 0.02, Math.sin(a) * (half + 0.5)]);
        pts.push([(p.wx - cam.x) * k, (p.wy - cam.y) * k]);
      }
    }
    let bar = null;
    if (hurt) {
      const top = toWorldPx(M, [0, (d.masts[0] ? d.masts[0].h : 2) + 1.4, 0]);
      bar = [(top.wx - cam.x) * k, (top.wy - cam.y) * k];
    }
    const K = k * 1.3;
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (bar) { x0 = Math.min(x0, bar[0] - 12 * K); x1 = Math.max(x1, bar[0] + 12 * K); y0 = Math.min(y0, bar[1] - 4 * K); y1 = Math.max(y1, bar[1] + 4 * K); }
    const tick = info.tick || 0;
    return {
      box: [x0 - 4, y0 - 4, x1 + 4, y1 + 4],
      draw: (ctx) => {
        if (pts.length) {
          ctx.strokeStyle = 'rgba(255,230,120,0.95)';
          ctx.lineWidth = Math.max(1.5, 1.6 * k);
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
        if (bar) drawHealth(ctx, e, bar[0], bar[1], K, tick);
      },
    };
  }

  /**
   * End the frame: ships lost since the last one start going down, the
   * wrecks and their debris are placed, the crews' set is written if it
   * changed, the texture's rows used are sent, the wakes rebuilt. Returns
   * how many vessels are drawn.
   */
  end() {
    const t0 = performance.now();
    const game = this.game;
    // Lost since the last frame (not merely out of view): a warship sunk, a fishing boat fired.
    for (const [id, rec] of this.prev) {
      if (this.taken.has(id)) continue;
      this.prev.delete(id);
      const e = rec.e;
      const gone = rec.unit ? !game.units.has(e.id) : !game.walkers.has(e.id);
      const sunk = gone && (rec.unit ? e.hp <= 0 : e.type === 'fishing_boat');
      if (sunk && rec.st) this.wrecks.set(id, { kind: rec.kind, x: rec.st.x, z: rec.st.z, yaw: rec.st.yaw, at: this.clock, st: { ...rec.st, wake: [] } });
    }
    for (const [id, w] of this.wrecks) {
      const age = this.clock - w.at;
      if (age > DEBRIS_S || age < -1) {
        this.wrecks.delete(id);
        continue;
      }
      const d = DESIGNS[w.kind];
      const p = sinkPose(age, d.hull.L);
      if (p.shows) {
        const M = shipMatrix(w.x, w.st.y - p.down, w.z, w.yaw, w.st.pitch + p.pitch, w.st.roll + p.list, this.mat());
        this.kit(`vessel:${w.kind}:hull`, M, 'shut');
        // The mast and its furled sail going down with it.
        placesOf(w.kind).masts.forEach((mast, i) => {
          const Y = this.mat();
          Y.copy(M).multiply(_t.makeTranslation(mast.yard[0], mast.yard[1], mast.yard[2]));
          this.kit(`vessel:${w.kind}:yard:${i}`, Y);
          this.kit(`vessel:${w.kind}:furl:${i}`, Y);
        });
      }
      if (age > 1.2) {
        const D = this.mat();
        const bob = 0.03 * Math.sin(this.clock * 1.3 + id);
        D.makeTranslation(w.x / TILE_M, bob / TILE_M, w.z / TILE_M).multiply(_s.makeRotationY(w.yaw + age * 0.02)).multiply(_t.makeScale(1 / TILE_M, 1 / TILE_M, 1 / TILE_M));
        this.kit('vessel:debris', D);
      }
    }
    // The crews: written when the set changed (who, in what look, in which cell, at what level).
    let sig = 0x811c9dc5 ^ this.lod;
    for (let k = 0; k < this.used; k++) {
      const rec = this.list[k];
      sig = Math.imul(sig ^ (rec.id | 0), 0x01000193) >>> 0;
      sig = Math.imul(sig ^ hashStr(rec.key), 0x01000193) >>> 0;
    }
    this.crew.set(this.list.slice(0, this.used), this.lod, sig);
    const tex = this.tex;
    const rows = Math.ceil(this.used / SHIPS_ROW);
    tex.clearUpdateRanges();
    for (let r = 0; r < rows; r++) tex.addUpdateRange(r * SHIPS_ROW * SHIP_FLOATS, Math.min(SHIPS_ROW, this.used - r * SHIPS_ROW) * SHIP_FLOATS);
    if (rows) tex.needsUpdate = true;
    this.buildWakes();
    this.motion.end();
    const cs = this.crew.stats;
    Object.assign(this.stats, { ships: this.used, kits: this.nKits, people: cs.people, crewDraws: cs.draws, crewTriangles: cs.triangles, wrecks: this.wrecks.size, writes: cs.writes, deferred: cs.deferred, ms: performance.now() - t0 });
    return this.used + this.wrecks.size;
  }

  /** The kits gathered this frame, placed through the model pass's own (ModelPass.extra: one draw a part for all of them). */
  placeKits(mp, lod) {
    for (let i = 0; i < this.nKits; i++) {
      const [key, m, state] = this.kits[i];
      mp.place(mp.kitFor(key, lod), m, state, false);
    }
  }

  /**
   * The wakes: for each ship under way a ribbon of foam along its trail,
   * widening and fading behind it (bright at its two edges, thin in the
   * middle: the waves a hull throws off), and a bow wave curling back from
   * its stem, all as strong as it is fast.
   */
  buildWakes() {
    const P = this.wakePos;
    const U = this.wakeUv;
    const C = this.wakeCol;
    let n = 0;
    const vert = (x, z, a) => {
      if (n >= WAKE_VERTS) return;
      P[n * 3] = x;
      P[n * 3 + 1] = 0.02;
      P[n * 3 + 2] = z;
      U[n * 2] = x * 0.5;
      U[n * 2 + 1] = z * 0.5;
      C[n * 4] = 1;
      C[n * 4 + 1] = 1;
      C[n * 4 + 2] = 1;
      C[n * 4 + 3] = Math.max(0, Math.min(1, a));
      n++;
    };
    const quad = (a, b, c, e) => {
      vert(...a); vert(...b); vert(...c);
      vert(...a); vert(...c); vert(...e);
    };
    for (let k = 0; k < this.used; k++) {
      const rec = this.list[k];
      const st = rec.st;
      const d = DESIGNS[rec.kind];
      const v = Math.min(1, st.speed / 2.2);
      if (v < 0.04 || st.moored) continue;
      const { half, beam } = extentOf(d);
      const fx = Math.sin(st.yaw);
      const fz = Math.cos(st.yaw);
      // The trail from the stern back: points every WAKE_STEP covered (motion.js), the stern first.
      const pts = [{ x: st.x - fx * half * 0.85, z: st.z - fz * half * 0.85, dist: 0 }];
      for (const w of st.wake) {
        const dd = Math.hypot(w.x - st.x, w.z - st.z);
        if (dd < half * 0.9) continue;
        pts.push({ x: w.x, z: w.z, dist: dd - half * 0.85 });
      }
      if (pts.length < 2) continue;
      const len = pts[pts.length - 1].dist || 1;
      let prev = null;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = pts[Math.min(pts.length - 1, i + 1)];
        const o = pts[Math.max(0, i - 1)];
        let tx = (o.x - q.x);
        let tz = (o.z - q.z);
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl;
        tz /= tl;
        // Across: the trail's side (square to it on the water).
        const sx = tz;
        const sz = -tx;
        const f = p.dist / Math.max(len, 6);
        // The two arms of the wake spreading from the quarters, and the churned water straight behind, which
        // settles sooner; each a thin bright line fading out to both sides.
        const w = beam * 0.5 + p.dist * 0.26;
        const arm = 0.8 * v * (1 - f) ** 1.4;
        const mid = 0.55 * v * Math.max(0, 1 - f * 1.8) ** 1.2;
        const lw = 0.22 + p.dist * 0.03;
        const cw = beam * 0.35 + p.dist * 0.05;
        const row = [
          [-w - lw, 0], [-w, arm], [-w + lw, 0],
          [-cw, 0], [0, mid], [cw, 0],
          [w - lw, 0], [w, arm], [w + lw, 0],
        ].map(([off, al]) => [p.x + sx * off, p.z + sz * off, al]);
        if (prev) for (const j of [0, 1, 3, 4, 6, 7]) quad(prev[j], row[j], row[j + 1], prev[j + 1]);
        prev = row;
      }
      // The bow wave: from the stem curling out and back along both sides.
      const bx = st.x + fx * (half - 0.1);
      const bz = st.z + fz * (half - 0.1);
      const sx = fz;
      const sz = -fx;
      const a = 0.7 * v;
      for (const s of [1, -1]) {
        const m1 = [st.x + fx * half * 0.45 + s * sx * (beam + 0.15), st.z + fz * half * 0.45 + s * sz * (beam + 0.15), a * 0.7];
        const o1 = [st.x + fx * half * 0.3 + s * sx * (beam + 0.4 * v + 0.25), st.z + fz * half * 0.3 + s * sz * (beam + 0.4 * v + 0.25), 0];
        const m2 = [st.x - fx * half * 0.1 + s * sx * (beam + 0.05), st.z - fz * half * 0.1 + s * sz * (beam + 0.05), a * 0.35];
        const o2 = [st.x - fx * half * 0.2 + s * sx * (beam + 0.6 * v + 0.4), st.z - fz * half * 0.2 + s * sz * (beam + 0.6 * v + 0.4), 0];
        const tip = [bx, bz, a];
        const tipO = [bx + fx * 0.3 + s * sx * 0.25, bz + fz * 0.3 + s * sz * 0.25, 0];
        quad(tip, m1, o1, tipO);
        quad(m1, m2, o2, o1);
      }
    }
    const g = this.wake.geometry;
    g.setDrawRange(0, n);
    for (const name of ['position', 'uv', 'color']) {
      const a = g.getAttribute(name);
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
    if (n && !this.nWakeNorm) {
      const a = g.getAttribute('normal');
      a.needsUpdate = true;
      this.nWakeNorm = true;
    }
    this.wake.visible = n > 0;
    this.nWake = n;
  }

  /** Nothing drawn this frame (the sprites instead). */
  hide() {
    this.used = 0;
    this.nKits = 0;
    this.crew.hide();
    this.wake.visible = false;
    this.prev.clear();
  }

  setCasting(on) { this.crew.setCasting(on); }

  /**
   * Compile the crews' programs (crew.js) and the kits' own materials (the
   * painted wood, the sailcloth and hide seen from both sides, the wakes'
   * foam) as the model pass draws them (instanced), in the background, so
   * the first ship never stalls the game on a compile: a promise.
   */
  warm(gl, camera, scene, withOutput) {
    if (this.warming) return this.warming;
    const gen = this.warmGen = (this.warmGen || 0) + 1;
    this.proxyGroup = new Group();
    // (The look's materials are written in sRGB, built with colour management on: as the model pass builds its kits.)
    withCM(() => {
      for (const key of ['vessel:corbita:hull', 'vessel:corbita:sail:0:3f6fb0', 'vessel:gaulish:sail:0']) {
        const kit = kitOf(buildVesselPart(key, 2));
        for (const part of kit.parts) {
          const im = new InstancedMesh(part.geometry, part.material, 1);
          im.castShadow = part.cast;
          im.receiveShadow = true;
          this.proxyGroup.add(im);
        }
      }
    });
    const a = this.crew.warm(gl, camera, scene, withOutput);
    const b = withOutput(() => gl.compileAsync(this.proxyGroup, camera, scene));
    const c = withOutput(() => gl.compileAsync(this.wake, camera, scene));
    const done = () => {
      if (gen !== this.warmGen) return;
      this.kitsCompiled = true;
      for (const o of this.proxyGroup.children) o.geometry.dispose();
      this.proxyGroup = null;
    };
    this.warming = Promise.all([a, b, c]).then(done, done);
    return this.warming;
  }

  restored() {
    this.crew.restored();
    this.kitsCompiled = false;
    this.warmGen = (this.warmGen || 0) + 1;
    this.warming = null;
  }

  dispose() {
    this.crew.dispose();
    if (this.tex) this.tex.dispose();
    this.wake.geometry.dispose();
    this.wake.removeFromParent();
  }
}

/** A string's FNV hash. */
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
