/**
 * units/motion.js
 * ----------------------------------------------------------------------------
 * Where each figure of a fighting unit stands this frame, which way it faces
 * and what it does: render-only state by the unit's id, never the sim's (it
 * reads what the 2D renderer reads: the unit's place between its last tick
 * and this one, the ground it has walked, its state, its foe, the ticks of
 * its last blow and of the last blow it took).
 *
 *   - The unit stands exactly where the sim puts it (interpolated between
 *     ticks as the sprite is), lifted onto a bridge's deck as the sprite is.
 *   - It faces the way it moves, or its foe while it stands to fight, turning
 *     smoothly: over the ground it covers walking, over game time standing,
 *     so at any game speed a turn looks the same and none happens paused.
 *   - Its legs (a horse's, a wolf's) step with the distance it has covered
 *     (an odometer from u.walked), each clip's loop covering its stride: the
 *     feet hold the ground at any speed and stand still while paused. Every
 *     clock here is the game's (ticks), so a paused battle is a still picture.
 *   - A fort's men march in step: each one's phase is eased toward his fort's
 *     (by game time), a few percent a step, so their feet never slide.
 *   - A blow lands on the sim's tick: an attack clip is played at its blow's
 *     phase (clips.js HIT) when the sim strikes, and runs on through its
 *     loop to the next blow one cooldown later. A blow taken jerks him back
 *     (flinch). A legionary under threat throws his pilum once, then draws
 *     his gladius (the look's arms: march, battle).
 *   - A rider sits where his mount's back carries him (quadRig.js riderAt),
 *     rocked with its stride; an elephant's crew on its neck and its tower.
 *   - A unit that dies falls (fall clips, held lying) and lies there for
 *     CORPSE_S of game time, then sinks into the ground (units/pass.js keeps
 *     the dead, the sim having forgotten them).
 * ----------------------------------------------------------------------------
 */

import { CLIPS } from '../people/clips.js';
import { hash01 } from '../people/actors.js';
import { clipIndexOf, clipStride, yawOf, turnToward, TILE_M } from '../walkers/motion.js';
import { viewDir, toView } from '../../render/view.js';
import { ART_PX } from '../projection.js';
import { UNIT_TYPES } from '../../data/units.js';
import { CONFIG } from '../../config.js';
import { BEAST_CLIPS, BEAST_CLIP_INDEX, beastStride, riderAt, SPECIES, FALL_HOLD } from './quadRig.js';
import { HIT, MAN_FALL_HOLD } from './clips.js';

/** Seconds of game time a clip takes to fade into the next. */
export const FADE = 0.25;
/** Metres of walking over which a turn eases; game seconds a standing turn eases over. */
const TURN_M = 0.5;
const TURN_S = 0.18;
/** Game seconds a unit counts as moving after it last moved (a tick's stop is no stop). */
const MOVING_HOLD = 0.3;
/** u.walked wraps at this (sim/entities.js STRIDE_WRAP). */
const WRAP = 100;
/** Frames a unit unseen keeps its state. */
const KEEP_FRAMES = 240;
/** Ticks a blow taken jerks him (flinch). */
export const FLINCH_TICKS = 6;
/** Game seconds a dead man lies before he sinks away, and the sinking's seconds. */
export const CORPSE_S = 40;
export const SINK_S = 3;
/** How far (tiles) a threat must be for a legionary to throw his pilum, and how long (s) his gladius stays out after. */
const VOLLEY = [1.6, 7];
const BATTLE_HOLD = 10;
/** Game seconds the pilum's throw takes (its clip played once over them). */
const THROW_S = 1.4;
/** Ticks a second at 1x: the game's clock in seconds. */
const TPS = CONFIG.TICKS_PER_SECOND;
/** Floats a figure takes in the units' texture (material.js UNIT_FIGURE_FLOATS). */
const FF = 16;

const wrap1 = (x) => ((x % 1) + 1) % 1;
const wrapPi = (a) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;

/** A clip's index: a person's in the people's table, a beast's in the beasts'. */
export function figureClip(name, beast) {
  if (beast) {
    const i = BEAST_CLIP_INDEX[name];
    if (i === undefined) throw new Error(`No beast clip ${name}`);
    return i;
  }
  return clipIndexOf(name, false);
}

/** A clip's loop (s) and its metres a loop (0 standing). */
export function clipLoop(name, beast) {
  if (beast) return { dur: BEAST_CLIPS[name].dur, stride: beastStride(name) };
  return { dur: CLIPS[name].dur, stride: clipStride(name) };
}

/**
 * The phase of an attack clip whose blow lands at `hit`, `since` ticks after
 * the sim's blow, `cooldown` ticks between blows: the blow at the strike, the
 * loop round to the next one a cooldown on.
 */
export function attackPhase(hit, since, cooldown) {
  return wrap1(hit + since / Math.max(1, cooldown));
}

/**
 * What the unit's own figure does now: { clip, mode } (mode 'walk' played by
 * the ground covered, 'attack' by the blow's tick, 'flinch' by the blow taken,
 * 'clock' by game time). `c` the figure's clips; `s` the unit's state here.
 */
export function chooseClip(u, c, s, env) {
  const def = UNIT_TYPES[u.type];
  const since = env.tick - u.strikeTick;
  const striking = u.strikeTick > -50 && since >= 0 && since < def.cooldown * 1.25;
  const hurt = env.tick - u.hitTick;
  if (s.volley !== null && c.attack === 'fight') return { clip: 'throw', mode: 'volley' };
  if (env.moving) {
    if (c.move === 'mounted' || c.move === 'drive' || c.move === 'guard') return { clip: c.move, mode: 'clock' };
    const fleeing = u.state === 'flee' || u.state === 'away' || u.state === 'nativeHome' || u.state === 'home';
    if (fleeing) return { clip: c.run === 'charge' ? 'run' : c.run, mode: 'walk' };
    return { clip: env.charging ? c.run : c.move, mode: 'walk' };
  }
  if (striking) return { clip: c.attack, mode: 'attack', since, cooldown: def.cooldown };
  if (hurt >= 0 && hurt < FLINCH_TICKS && u.hitTick > -50 && c.flinch && c.move !== 'mounted' && c.move !== 'drive') return { clip: c.flinch, mode: 'flinch', since: hurt };
  if (env.threat) return { clip: c.ready, mode: 'clock' };
  return { clip: c.stand, mode: 'clock' };
}

/** A beast's clip now: its gait by its pace (fast charging, hunting, fleeing), its attack, a wolf at rest lying. */
export function chooseBeastClip(u, c, env) {
  const def = UNIT_TYPES[u.type];
  const since = env.tick - u.strikeTick;
  if (env.moving) {
    const fast = env.charging || u.state === 'hunt' || u.state === 'flee' || u.state === 'engage';
    return { clip: fast ? c.fast : c.slow, mode: 'walk' };
  }
  if (u.strikeTick > -50 && since >= 0 && since < def.cooldown * 1.25) return { clip: c.attack, mode: 'attack', since, cooldown: def.cooldown };
  if (c.rest && u.state === 'rest') return { clip: c.rest, mode: 'clock' };
  if (c.stalk && u.state === 'hunt') return { clip: c.stand, mode: 'clock' };
  return { clip: c.stand, mode: 'clock' };
}

export class UnitMotion {
  constructor() {
    this.states = new Map();
    this.frame = 0;
    this.clock = 0;
    this.lastClock = 0;
    this.dc = 0;
    this.tick = 0;
    this.places = [];
  }

  /** A new frame: `tick` the game's ticks (with the frame's share of the next), so `clock` its seconds. */
  begin(tick) {
    this.frame++;
    this.tick = tick;
    this.clock = tick / TPS;
    // (Game seconds since the last frame: none while paused; a jump (a load) counts as none.)
    const d = this.clock - this.lastClock;
    this.dc = d > 0 && d < 1 ? d : 0;
    this.lastClock = this.clock;
  }

  end() {
    if (this.frame % 60) return;
    for (const [id, s] of this.states) if (this.frame - s.seen > KEEP_FRAMES && !s.dead) this.states.delete(id);
  }

  /** The unit's state, made at first sight. */
  stateOf(u, look, yaw, stride) {
    let s = this.states.get(u.id);
    if (!s) {
      s = {
        seen: this.frame, yaw, odo: 0, lastStride: stride, movedAt: -1e9, figs: [], ph: hash01(u.id, 77), key: '',
        volley: null, threwAt: -1e9, battleUntil: -1e9, arms: 'march', dead: null, fx: 0, fy: 0, lift: 0, type: u.type,
      };
      this.states.set(u.id, s);
    }
    if (s.key !== look.key) {
      s.key = look.key;
      const old = s.figs;
      s.figs = look.figures.map((f, k) => old[k] && old[k].kind === kindOf(f) ? old[k] : { kind: kindOf(f), clip: -1, t: 0, prev: -1, prevT: 0, fadeAt: -1e9, mv: 0, yaw, lock: 0 });
    }
    s.seen = this.frame;
    return s;
  }

  /**
   * The arms a legionary carries now (the look's `arms`): the pilum on the
   * march; under threat he throws it (a volley: its clip once) and fights
   * with the gladius until BATTLE_HOLD seconds pass with no threat.
   */
  armsOf(u, env) {
    const s = this.states.get(u.id);
    if (!s) return 'march';
    if (u.type !== 'legionary' && u.type !== 'imperial') return 'march';
    const t = this.clock;
    const engaged = env.threat || (env.striking ?? false);
    if (s.volley !== null) {
      // (The throw's let go at its HIT; a moment after, the gladius is out.)
      if (t - s.volley > THROW_S * (HIT.throw + 0.2)) {
        s.volley = null;
        s.threwAt = t;
        s.arms = 'battle';
        s.battleUntil = t + BATTLE_HOLD;
      }
      return 'march';
    }
    if (s.arms === 'march' && engaged) {
      const d = env.threatDist ?? 99;
      if (!env.moving && d >= VOLLEY[0] && d <= VOLLEY[1] && t - s.threwAt > 30) {
        s.volley = t;
        return 'march';
      }
      if (d < VOLLEY[0] || env.striking) {
        s.arms = 'battle';
        s.battleUntil = t + BATTLE_HOLD;
      }
    } else if (s.arms === 'battle') {
      if (engaged) s.battleUntil = t + BATTLE_HOLD;
      else if (t > s.battleUntil) s.arms = 'march';
    }
    return s.arms;
  }

  /**
   * Place unit `u`'s figures (its look) into `out` from figure `base`. `at`:
   * { fx, fy (map tiles), lift (world px), stride (tiles walked), vt, W, H,
   *   dx, dy (its step this tick, map tiles), foe ([dx, dy] map tiles to
   *   whom it fights, or null), threat, threatDist (tiles), charging }.
   * Returns the unit's place { x, y, z, yaw } (metres).
   */
  place(u, look, at, out, base) {
    const [vu, vv] = toView(at.fx, at.fy, at.vt, at.W, at.H);
    const x = vu * TILE_M;
    const z = vv * TILE_M;
    const y = at.lift * ART_PX * TILE_M;
    let target;
    if (at.dx || at.dy) {
      const [du, dv] = viewDir(at.dx, at.dy, at.vt);
      if (du || dv) target = yawOf(du, dv);
    }
    const moving = u.moving && target !== undefined;
    if (!moving && at.foe && (at.foe[0] || at.foe[1])) {
      const [du, dv] = viewDir(at.foe[0], at.foe[1], at.vt);
      target = yawOf(du, dv);
    }
    const s = this.stateOf(u, look, target ?? 0, at.stride);
    s.fx = at.fx; s.fy = at.fy; s.lift = at.lift; s.vt = at.vt;
    // The odometer (u.walked wraps; a jump is a teleport, not a stride).
    let d = (((at.stride - s.lastStride) % WRAP) + WRAP) % WRAP;
    if (d > 3) d = 0;
    s.lastStride = at.stride;
    const step = d * TILE_M;
    s.odo += step;
    if (step > 0) s.movedAt = this.clock;
    const isMoving = moving || (u.moving && this.clock - s.movedAt < MOVING_HOLD);
    if (target !== undefined) {
      const k = step > 0 ? 1 - Math.exp(-step / TURN_M) : 1 - Math.exp(-this.dc / TURN_S);
      s.yaw = turnToward(s.yaw, target, k);
    }
    s.yaw = wrapPi(s.yaw);
    const env = { tick: this.tick, moving: isMoving, threat: !!at.threat, threatDist: at.threatDist, charging: !!at.charging };
    this.writeFigures(u, look, s, { x, y, z, yaw: s.yaw }, env, out, base);
    return { x, y, z, yaw: s.yaw };
  }

  /** Every figure of the look placed from the unit's place `p` (the dead's too: `env.dead` the seconds since the fall). */
  writeFigures(u, look, s, p, env, out, base) {
    const F = look.figures;
    const places = this.places;
    const c = Math.cos(p.yaw);
    const sn = Math.sin(p.yaw);
    // Mounts and cars first (riders sit on them), then the rest.
    const order = this.order || (this.order = []);
    order.length = 0;
    for (let k = 0; k < F.length; k++) if (F[k].mount < 0) order.push(k);
    for (let k = 0; k < F.length; k++) if (F[k].mount >= 0) order.push(k);
    for (const k of order) {
      const f = F[k];
      const st = s.figs[k];
      const o = (base + k) * FF;
      const pk = places[k] || (places[k] = { x: 0, y: 0, z: 0, yaw: 0, clip: '', time: 0 });
      let fx;
      let fy;
      let fz;
      let pitch = 0;
      let roll = 0;
      if (f.mount >= 0 && !env.dead) {
        // On a beast's back: its seat (or its tower's deck) where its clip carries it.
        const m = places[f.mount];
        const mf = F[f.mount];
        const S = SPECIES[mf.species];
        const spot = (f.seat === 'deck' ? S.deck : S.seat) || { at: [0, 1.3, 0] };
        const r = riderAt(m.clip, m.time, f.seat === 'deck' ? 'deck' : 'seat', this._r || (this._r = { y: 0, z: 0, pitch: 0 }));
        const sc = mf.scale || 1;
        const lz = (spot.at[2] + r.z) * sc;
        const ly = (spot.at[1] + r.y) * sc - (f.seat === 'deck' ? 0 : 0.95);
        const cm = Math.cos(m.yaw);
        const sm = Math.sin(m.yaw);
        fx = m.x + sm * lz;
        fz = m.z + cm * lz;
        fy = m.y + ly;
        pitch = f.seat === 'deck' ? r.pitch * 0.5 : r.pitch;
        pk.yaw = m.yaw;
      } else {
        const [ax, ay, az] = f.at;
        const dx = env.dead && f.mount >= 0 ? (k % 2 ? 0.9 : -0.9) : ax;
        fx = p.x + c * dx + sn * az;
        fz = p.z - sn * dx + c * az;
        fy = p.y + (env.dead && f.mount >= 0 ? 0 : ay);
        pk.yaw = p.yaw + (env.dead && f.mount >= 0 ? (k % 2 ? 0.8 : -0.6) : 0);
      }
      if (env.dead) fy -= env.sink;
      pk.x = fx; pk.y = fy; pk.z = fz;
      out[o] = fx; out[o + 1] = fy; out[o + 2] = fz; out[o + 3] = pk.yaw;
      out[o + 12] = pitch; out[o + 13] = roll; out[o + 14] = 0; out[o + 15] = 0;
      if (f.rigid) {
        // A car: its wheels turned by the ground covered.
        out[o + 4] = 0; out[o + 5] = 0; out[o + 6] = 0; out[o + 7] = 0;
        out[o + 8] = 1; out[o + 9] = s.odo; out[o + 10] = 0; out[o + 11] = 1;
        continue;
      }
      const beast = !!f.quad;
      let ch;
      if (env.dead) ch = { clip: f.clips.fall, mode: 'fall' };
      else if (beast) ch = chooseBeastClip(u, f.clips, env);
      else if (k === 0 || f.mount < 0) ch = chooseClip(u, f.clips, s, env);
      else ch = chooseClip(u, f.clips, s, { ...env, moving: false });
      // (A rider's beast does what he does: a horse rears as its rider strikes.)
      const name = ch.clip;
      const { dur, stride } = clipLoop(name, beast);
      const ph = wrap1(s.ph + k * 0.381966);
      let t;
      if (ch.mode === 'walk' && stride > 0) {
        // In step: a Roman's walk eased toward his fort's common phase.
        let phase = s.odo / stride + st.lock;
        if (u.side === 'rome' && u.fort && !beast) {
          const common = (this.tick * UNIT_TYPES[u.type].speed * TILE_M) / stride + hash01(u.fort, 3);
          const err = wrapPi((common - phase) * 2 * Math.PI) / (2 * Math.PI);
          st.lock += Math.max(-0.3 * this.dc, Math.min(0.3 * this.dc, err));
          phase = s.odo / stride + st.lock;
        } else phase += ph;
        t = wrap1(phase) * dur;
      } else if (ch.mode === 'attack') {
        t = attackPhase(beast ? 0.35 : HIT[name] ?? 0.3, ch.since, ch.cooldown) * dur;
      } else if (ch.mode === 'flinch') {
        t = Math.min(0.85, ch.since / FLINCH_TICKS * 0.8) * dur;
      } else if (ch.mode === 'volley') {
        t = Math.min(0.99, (this.clock - s.volley) / THROW_S) * dur;
      } else if (ch.mode === 'fall') {
        const hold = beast ? FALL_HOLD : MAN_FALL_HOLD;
        // (Played once from its start, then held lying: its time from the death.)
        t = Math.min(hold, env.dead / dur) * dur;
      } else {
        t = (this.clock + ph * dur * 7) % dur;
      }
      const clip = figureClip(name, beast);
      if (clip !== st.clip) {
        if (st.clip >= 0) {
          st.prev = st.clip;
          st.prevT = st.t;
          st.fadeAt = this.clock;
        }
        st.clip = clip;
      }
      st.t = t;
      pk.clip = name;
      pk.time = t;
      // (A fade measured in game time: paused, it holds; a load's jump ends it.)
      const u2 = Math.min(1, Math.max(0, (this.clock - st.fadeAt) / FADE));
      const fade = st.prev < 0 ? 1 : u2 * u2 * (3 - 2 * u2);
      st.mv += ((env.moving ? 1 : 0) - st.mv) * (1 - Math.exp(-this.dc / 0.2));
      out[o + 4] = clip; out[o + 5] = t; out[o + 6] = st.prev < 0 ? clip : st.prev; out[o + 7] = st.prevT;
      out[o + 8] = fade; out[o + 9] = 0; out[o + 10] = 0; out[o + 11] = st.mv;
    }
  }

  /** Place a dead unit's figures, `dead` game seconds after it fell. */
  placeDead(s, look, at, out, base) {
    const [vu, vv] = toView(s.fx, s.fy, at.vt, at.W, at.H);
    const p = { x: vu * TILE_M, y: s.lift * ART_PX * TILE_M, z: vv * TILE_M, yaw: s.yaw };
    const dead = this.clock - s.dead;
    const sink = dead > CORPSE_S ? Math.min(1, (dead - CORPSE_S) / SINK_S) * 0.9 : 0;
    const env = { tick: this.tick, moving: false, dead: Math.max(1e-3, dead), sink };
    this.writeFigures({ id: -1, type: s.type, side: 'dead', strikeTick: -99, hitTick: -99, state: 'dead' }, look, s, p, env, out, base);
  }
}

/** A figure's kind: a person, a beast, a car. */
function kindOf(f) {
  return f.quad ? 'beast' : f.rigid ? 'rigid' : 'person';
}
