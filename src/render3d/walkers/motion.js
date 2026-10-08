/**
 * walkers/motion.js
 * ----------------------------------------------------------------------------
 * Where each figure of a walker stands this frame, which way it faces and
 * what it is doing: render-only state kept by the walker's id, never the
 * sim's (it reads what the 2D renderer reads: the walker's tiles, progress,
 * distance walked, facing and state).
 *
 *   - The walker himself stands exactly where renderer.js walkerWorld puts
 *     him (lifted onto a bridge's deck as the sprite is).
 *   - He faces his way of travel, turning smoothly at a corner (eased over
 *     the distance he walks, so at any game speed the turn takes the same
 *     ground, and none while paused), or his last step's way standing; a
 *     prefect at a fire faces the fire.
 *   - His legs step with the distance he has walked (an odometer of his
 *     own, from w.walked), so the feet hold the ground at every game speed
 *     and stand still while the game is paused; a clip's loop covers its
 *     stride (clips.js), a child's shorter by its scale.
 *   - Stopping, starting or changing what he does fades from one clip into
 *     the next (FADE s); standing clips play on the look's clock.
 *   - Who walks behind him (his family, his mules, the ox and the wagon)
 *     follows the way he came: his path is kept as a trail of points, and
 *     each follower stands that far back along it, facing along it, so they
 *     turn the corner where he did, not across it. What he pushes or drives
 *     goes before him in his own frame.
 *   - Each walker and each follower has its own phase (from its id), so a
 *     crowd never steps in time.
 * ----------------------------------------------------------------------------
 */

import { CLIPS, CLIP_INDEX, WALK_STRIDE } from '../people/clips.js';
import { hash01 } from '../people/actors.js';
import { viewDir, toView } from '../../render/view.js';
import { ART_PX } from '../projection.js';

/** Metres a game tile (models.js TILE_M; here to keep this module free of three). */
export const TILE_M = 4;
/** Seconds a clip takes to fade into the next. */
export const FADE = 0.3;
/** Metres of walking over which a turn at a corner eases (about a third of it done in TURN_M). */
export const TURN_M = 0.42;
/** Seconds a standing turn eases over (a prefect turning to a fire). */
const TURN_S = 0.14;
/** Metres of trail kept behind a walker (his followers stand up to 9 m back). */
const TRAIL_M = 14;
/** A new trail point every this many metres. */
const TRAIL_STEP = 0.12;
/** Seconds a walker counts as moving after he last moved: a tick's stop on a tile does not stop his legs. */
const MOVING_HOLD = 0.25;
/** w.walked wraps at this (sim/walkers.js STRIDE_WRAP). */
const WRAP = 100;
/** Frames a walker unseen keeps its state (back in view within them, he carries on as he was). */
const KEEP_FRAMES = 240;

/** The map's four directions (N E S W) as tile steps (sim/movement.js). */
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** The facing (rad: 0 toward +z, the view's +v; pi/2 toward +x) of a step (du, dv) in the view's tiles. */
export function yawOf(du, dv) {
  return Math.atan2(du, dv);
}

/** Turn `a` toward `b` by share k, the short way round. */
export function turnToward(a, b, k) {
  let d = b - a;
  d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  return a + d * k;
}

/** A clip's index by name, its toga variant for a toga wearer where it has one. */
export function clipIndexOf(name, toga) {
  if (toga && CLIPS[name] && CLIPS[name].toga) return CLIP_INDEX[`${name}@toga`];
  const i = CLIP_INDEX[name];
  if (i === undefined) throw new Error(`No clip ${name}`);
  return i;
}

/** Metres a loop of a walking clip covers (its stride), 0 for a standing one. */
export function clipStride(name) {
  const c = CLIPS[name];
  if (!c || !c.walk) return 0;
  return c.stride || WALK_STRIDE;
}

/**
 * The clip a walker's own figure plays now: running to a fire, throwing
 * water at it, treating the sick, else its look's walking or standing clip.
 */
export function leaderClip(w, fig, moving) {
  if (moving) {
    if (w.type === 'prefect' && (w.state === 'toFire' || w.state === 'hunt')) return 'run';
    return fig.move;
  }
  if (w.type === 'prefect' && w.state === 'extinguish') return 'douse';
  if (w.type === 'physician' && w.state === 'treat') return 'talk';
  return fig.stand;
}

/** A point `s` metres along the trail (extended straight back past its oldest point). */
function trailAt(trail, s, out) {
  const n = trail.length;
  if (n === 1 || s >= trail[n - 1].o) {
    const p = trail[n - 1];
    out[0] = p.x; out[1] = p.y; out[2] = p.z;
    return out;
  }
  let i = n - 1;
  while (i > 0 && trail[i - 1].o > s) i--;
  const a = trail[Math.max(0, i - 1)];
  const b = trail[Math.max(1, i)];
  const span = b.o - a.o || 1e-6;
  const k = (s - a.o) / span;
  out[0] = a.x + (b.x - a.x) * k;
  out[1] = a.y + (b.y - a.y) * k;
  out[2] = a.z + (b.z - a.z) * k;
  return out;
}

const _p = [0, 0, 0];
const _q = [0, 0, 0];
const _r = [0, 0, 0];

/** Floats a figure takes in the figures' texture (material.js FIGURE_FLOATS). */
const FF = 16;

export class WalkerMotion {
  constructor() {
    this.states = new Map(); // walker id -> its state (see begin of place)
    this.frame = 0;
  }

  /** A new frame: `time` the look's clock (s), `dt` the real seconds since the last. */
  begin(time, dt) {
    this.frame++;
    this.time = time;
    this.dt = Math.max(0, Math.min(0.25, dt || 0));
    // A clock of real seconds for the fades and the moving flag's hold: the look's clock stands at 0
    // with reduced motion, and a fade timed by it would never end.
    this.clock = (this.clock || 0) + this.dt;
  }

  /** Forget the walkers not seen for a while. */
  end() {
    if (this.frame % 60) return;
    for (const [id, s] of this.states) if (this.frame - s.seen > KEEP_FRAMES) this.states.delete(id);
  }

  /** The walker's state, made at first sight (his trail laid straight back along his facing). */
  stateOf(w, look, x, y, z, yaw, stride) {
    let s = this.states.get(w.id);
    if (!s || s.key !== look.key) {
      const old = s;
      s = {
        key: look.key, seen: this.frame, yaw: old ? old.yaw : yaw, odo: old ? old.odo : 0, lastStride: stride, movedAt: -1e9,
        trail: old ? old.trail : [{ x: x - Math.sin(yaw) * TRAIL_M, y, z: z - Math.cos(yaw) * TRAIL_M, o: -TRAIL_M }, { x, y, z, o: 0 }],
        figs: look.figures.map(() => ({ clip: -1, t: 0, prev: -1, prevT: 0, fadeAt: -1e9, yaw, mv: 0 })),
        ph: hash01(w.id, 77),
      };
      if (old) s.movedAt = old.movedAt;
      this.states.set(w.id, s);
    }
    s.seen = this.frame;
    return s;
  }

  /**
   * Place walker `w`'s figures (its look: look.js) this frame into `out` from
   * figure `base` (FF floats each: material.js's texels). `at`: { fx, fy
   * (map tiles, renderer.js walkerWorld), lift (world px: a bridge's deck),
   * stride (tiles walked, interpolated), vt, W, H, aim ([du, dv] view tiles
   * to a fire he puts out, or null) }. Returns the walker's own place
   * { x, y, z, yaw } in metres (for the loads and the click's reach).
   */
  place(w, look, at, out, base) {
    const [vu, vv] = toView(at.fx, at.fy, at.vt, at.W, at.H);
    const x = vu * TILE_M;
    const z = vv * TILE_M;
    const y = at.lift * ART_PX * TILE_M;
    // The way he walks (view tiles), or faced standing.
    let target;
    const [du, dv] = viewDir(w.tx - w.x, w.ty - w.y, at.vt);
    if (w.moving && (du || dv)) target = yawOf(du, dv);
    else if (at.aim && (at.aim[0] || at.aim[1])) target = yawOf(at.aim[0], at.aim[1]);
    else if (w.lastDir >= 0) {
      const [lu, lv] = viewDir(DX[w.lastDir], DY[w.lastDir], at.vt);
      target = yawOf(lu, lv);
    }
    const s = this.stateOf(w, look, x, y, z, target ?? 0, at.stride);
    // The odometer: the distance walked since the last frame (w.walked wraps; a jump is a new walker's).
    let d = (((at.stride - s.lastStride) % WRAP) + WRAP) % WRAP;
    if (d > 3) d = 0;
    s.lastStride = at.stride;
    const step = d * TILE_M;
    s.odo += step;
    if (w.moving && step > 0) s.movedAt = this.clock;
    // (Held a moment: a stop of a tick on a tile is not a stop.)
    const moving = w.moving || this.clock - s.movedAt < MOVING_HOLD;
    if (target !== undefined) {
      // Walking, the turn by the ground covered (none while paused); standing, by time (a prefect to his fire).
      const k = step > 0 ? 1 - Math.exp(-step / TURN_M) : w.moving ? 0 : 1 - Math.exp(-this.dt / TURN_S);
      s.yaw = turnToward(s.yaw, target, k);
    }
    // His trail: a point every TRAIL_STEP walked, the oldest dropped. Put somewhere far from where he
    // was without walking there (a load, the lab's clock moved), his followers line up behind him again.
    const tr = s.trail;
    let last = tr[tr.length - 1];
    if (Math.hypot(x - last.x, z - last.z) > step + TRAIL_STEP + 1) {
      if (target !== undefined) s.yaw = target;
      tr.length = 0;
      tr.push({ x: x - Math.sin(s.yaw) * TRAIL_M, y, z: z - Math.cos(s.yaw) * TRAIL_M, o: s.odo - TRAIL_M }, { x, y, z, o: s.odo });
      for (const f of s.figs) f.yaw = s.yaw;
      last = tr[1];
    }
    if (s.odo - last.o >= TRAIL_STEP) {
      tr.push({ x, y, z, o: s.odo });
      while (tr.length > 2 && tr[1].o < s.odo - TRAIL_M) tr.shift();
    } else if (s.odo === last.o) {
      // (Standing: the trail's head is where he is, a bridge's lift and all.)
      last.x = x; last.y = y; last.z = z;
    }
    const lead = { x, y, z, yaw: s.yaw };
    const F = look.figures;
    const places = this.places || (this.places = []);
    for (let k = 0; k < F.length; k++) {
      const f = F[k];
      const st = s.figs[k];
      const pl = f.place;
      let fx = x;
      let fy = y;
      let fz = z;
      let fyaw = s.yaw;
      let odo = s.odo;
      if (pl.at === 'ahead') {
        const c = Math.cos(s.yaw);
        const sn = Math.sin(s.yaw);
        fx = x + c * pl.x + sn * pl.z;
        fz = z - sn * pl.x + c * pl.z;
        fy = y + pl.y;
      } else if (pl.at === 'trail') {
        odo = s.odo - pl.gap;
        trailAt(tr, odo, _p);
        trailAt(tr, odo + 0.45, _q);
        trailAt(tr, odo - 0.45, _r);
        const ddx = _q[0] - _r[0];
        const ddz = _q[2] - _r[2];
        if (ddx * ddx + ddz * ddz > 0.04) st.yaw = turnToward(st.yaw, Math.atan2(ddx, ddz), 0.5);
        fyaw = st.yaw;
        fx = _p[0] + Math.cos(fyaw) * (pl.side || 0);
        fz = _p[2] - Math.sin(fyaw) * (pl.side || 0);
        fy = _p[1];
      }
      // (The places reused frame to frame: no object a figure a frame.)
      const pk = places[k] || (places[k] = { x: 0, y: 0, z: 0, yaw: 0, odo: 0 });
      pk.x = fx; pk.y = fy; pk.z = fz; pk.yaw = fyaw; pk.odo = odo;
    }
    // Facing another figure (a wagon its ox: its pole on the yoke), then the ropes between figures.
    for (let k = 0; k < F.length; k++) {
      const pl = F[k].place;
      if (pl.at === 'trail' && pl.aim !== undefined) {
        const p = places[k];
        const q = places[pl.aim];
        if (Math.hypot(q.x - p.x, q.z - p.z) > 0.2) p.yaw = Math.atan2(q.x - p.x, q.z - p.z);
        s.figs[k].yaw = p.yaw;
      }
    }
    for (let k = 0; k < F.length; k++) {
      const f = F[k];
      const st = s.figs[k];
      const p = places[k];
      const o = (base + k) * FF;
      const ph = (s.ph + k * 0.381966) % 1;
      if (f.place.at === 'rope') {
        const [ia, pa] = f.place.from;
        const [ib, pb] = f.place.to;
        const A = localToWorld(places[ia], pa, _p);
        const B = localToWorld(places[ib], pb, _q);
        out[o] = A[0]; out[o + 1] = A[1]; out[o + 2] = A[2];
        out[o + 3] = Math.atan2(B[0] - A[0], B[2] - A[2]);
        for (let i = 4; i < 12; i++) out[o + i] = 0;
        out[o + 8] = 1;
        out[o + 12] = Math.hypot(B[0] - A[0], B[2] - A[2]);
        out[o + 13] = B[1] - A[1];
        out[o + 14] = 0; out[o + 15] = 0;
        continue;
      }
      out[o] = p.x; out[o + 1] = p.y + (f.lift || 0); out[o + 2] = p.z; out[o + 3] = p.yaw;
      // How much it moves (a beast's legs come to rest standing): eased.
      st.mv += ((moving ? 1 : 0) - st.mv) * (1 - Math.exp(-this.dt / 0.2));
      if (f.person) {
        const name = k === 0 ? leaderClip(w, f, moving) : moving ? f.move : f.stand;
        const clip = clipIndexOf(name, f.toga);
        const def = CLIPS[name];
        const stride = clipStride(name) * (f.scale || 1);
        // Walking: by the distance covered; standing: by the look's clock. Each figure its own phase.
        const t = stride > 0 ? (((p.odo / stride + ph) % 1) + 1) % 1 * def.dur : (this.time + ph * def.dur * 7) % def.dur;
        if (clip !== st.clip) {
          if (st.clip >= 0) {
            st.prev = st.clip;
            st.prevT = st.t;
            st.fadeAt = this.clock;
          }
          st.clip = clip;
        }
        st.t = t;
        const u = Math.min(1, Math.max(0, (this.clock - st.fadeAt) / FADE));
        const fade = st.prev < 0 ? 1 : u * u * (3 - 2 * u);
        out[o + 4] = clip; out[o + 5] = t; out[o + 6] = st.prev < 0 ? clip : st.prev; out[o + 7] = st.prevT;
        out[o + 8] = fade; out[o + 9] = 0; out[o + 10] = 0; out[o + 11] = st.mv;
      } else {
        out[o + 4] = 0; out[o + 5] = 0; out[o + 6] = 0; out[o + 7] = 0;
        out[o + 8] = 1;
        // A wheel's metres rolled; a beast's legs' cycle, its own phase.
        out[o + 9] = p.odo;
        out[o + 10] = f.stride ? ((((p.odo / f.stride + ph) % 1) + 1) % 1) : 0;
        out[o + 11] = st.mv;
      }
      out[o + 12] = 0; out[o + 13] = 0; out[o + 14] = 0; out[o + 15] = 0;
    }
    return lead;
  }
}

/** A point of a figure's own frame (metres) in the world's, the figure at `p` facing p.yaw. */
export function localToWorld(p, local, out = [0, 0, 0]) {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  out[0] = p.x + c * local[0] + s * local[2];
  out[1] = p.y + local[1];
  out[2] = p.z - s * local[0] + c * local[2];
  return out;
}
