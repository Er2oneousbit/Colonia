/**
 * ships/motion.js
 * ----------------------------------------------------------------------------
 * How a vessel moves on the water, render-only state by id (the sim never
 * sees it, nothing is saved, no randomness: a ship looks the same after a
 * reload). Pure, so the tests can drive it:
 *
 *   - Place: exactly where the sim puts it (view tiles x TILE_M metres),
 *     but for a moored ship drawn at its mooring (`moor`: alongside a
 *     quay, or stern-to a station's front as Roman warships lay), glided
 *     there and back over MOOR_S seconds as it comes in and casts off.
 *   - Heading: toward the way it moves, eased over the metres it covers
 *     (TURN_M: a ship turns in a curve, never on a tile's corner); lying
 *     still, toward its mooring's heading, or (at anchor) its bow
 *     swinging into the wind, over TURN_S seconds; always the short way.
 *   - Speed: from the metres it covered in the frame's time, smoothed.
 *   - The sea: heave, pitch and roll from a few long waves read at its
 *     place and the look's clock, gentler on a big hull, rougher in a
 *     storm; a heel away from the wind under sail; a damaged hull riding
 *     lower and listing (hp).
 *   - The sail: braced round to the wind (the yard turned on the mast, as
 *     a square sail was trimmed by its braces) and filled by the wind from
 *     abaft the beam, flat and shivering when the wind is ahead; brailed
 *     up to the yard over a couple of seconds when it is furled.
 *   - The stroke: the rowers' clock advances with the distance rowed
 *     (STROKE_M a stroke), so oars and rowers keep time with the hull's
 *     way at any game speed and rest when it does.
 *   - Its wake: a trail of points (every WAKE_STEP metres covered).
 *
 * Angles: yaw 0 sails toward +z (the view's v), positive turns toward +x,
 * so the bow points (sin yaw, cos yaw); the wind is the look's uLookWind
 * (the way the air moves, in the same x, z).
 * ----------------------------------------------------------------------------
 */

/** Metres a game tile (models.js TILE_M; here to keep this module free of three). */
export const TILE_M = 4;
/** Metres covered over which a turn eases most of the way (a ship's turning circle). */
export const TURN_M = 3.2;
/** Seconds a ship lying still takes to swing most of the way to its mooring's or the wind's heading. */
export const TURN_S = 2.6;
/** Seconds to glide into its mooring or out of it. */
export const MOOR_S = 2.4;
/** Metres a stroke of the oars carries a ship; the clip's loop (people/clips.js rowShip) is one stroke. */
export const STROKE_M = 5;
/** The fastest stroke (strokes a second), however fast the game runs: past it the rowers keep this beat. */
export const MAX_STROKES = 1.25;
/** The rowing clip's loop (s): rowShip's dur. */
export const STROKE_DUR = 2.4;
/** Metres between the wake's points, and how many are kept. */
export const WAKE_STEP = 0.7;
export const WAKE_POINTS = 18;
/** Seconds a sunk ship takes to go down, and how long its debris floats after. */
export const SINK_S = 7;
export const DEBRIS_S = 14;
/** Frames a vessel's state is kept unseen. */
const KEEP_FRAMES = 300;

const TAU = Math.PI * 2;

/** The short way from angle a toward b by a share k. */
export function turnToward(a, b, k) {
  let d = (((b - a) % TAU) + TAU + Math.PI) % TAU - Math.PI;
  return a + d * k;
}

/** An angle wrapped into (-pi, pi]. */
export function wrapAngle(a) {
  return (((a % TAU) + TAU + Math.PI) % TAU) - Math.PI;
}

/** The yaw that points along (dx, dz). */
export function yawOf(dx, dz) {
  return Math.atan2(dx, dz);
}

/**
 * The sail's trim for a wind (wx, wz: the way the air moves) on a ship
 * heading `yaw`: { brace (rad, the yard turned about the mast, + toward
 * starboard), fill (-1 aback .. 1 full), heel (rad, + to starboard) }.
 * The wind's angle off the stern: 0 dead astern (the sail square and
 * full), pi/2 on the beam (braced round, half full), past ~2.2 rad from
 * ahead (the sail shivering, a little aback).
 */
export function trimFor(yaw, wx, wz) {
  const l = Math.hypot(wx, wz) || 1;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  // The air's way in the ship's frame: along (ahead, starboard).
  const ahead = (wx * fx + wz * fz) / l;
  const side = (wx * fz - wz * fx) / l;
  // The angle off the stern (0: the air moves the way the ship goes).
  const off = Math.atan2(side, ahead);
  const a = Math.abs(off);
  const brace = Math.max(-0.75, Math.min(0.75, off * 0.55));
  let fill;
  if (a < 2.0) fill = 0.35 + 0.65 * Math.cos(a * 0.75) ** 2;
  else fill = -0.15 + 0.3 * (Math.PI - a);
  const heel = side * 0.06 * Math.max(0, fill);
  return { brace, fill: Math.max(-0.2, Math.min(1, fill)), heel };
}

/**
 * The sea's motion of a hull at (x, z) metres at time t (s): { heave (m),
 * pitch (rad, + bow up), roll (rad, + to starboard) }. `size` its length
 * (a long hull moves less), `rough` 0 (calm) to 1 (a storm).
 */
export function seaMotion(x, z, t, size, rough = 0, phase = 0) {
  const k = 4.5 / Math.max(3, size);
  const amp = 1 + rough * 1.6;
  const p1 = t * 0.83 + x * 0.21 + z * 0.13 + phase;
  const p2 = t * 1.31 - x * 0.09 + z * 0.24 + phase * 1.7;
  const p3 = t * 0.47 + x * 0.05 - z * 0.07 + phase * 0.6;
  const heave = (0.035 * Math.sin(p1) + 0.018 * Math.sin(p2) + 0.012 * Math.sin(p3)) * amp * Math.min(1.3, k);
  const pitch = (0.012 * Math.sin(p1 + 1.1) + 0.007 * Math.sin(p2 + 0.4)) * amp * k;
  const roll = (0.02 * Math.sin(p2 + 2.0) + 0.012 * Math.sin(p3 + 0.7) + 0.006 * Math.sin(p1 * 1.7)) * amp * k;
  return { heave, pitch, roll };
}

/** A hash in [0, 1) of an id (a vessel's own phase of the sea). */
function phaseOf(id) {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * TAU;
}

export class ShipMotion {
  constructor() {
    this.states = new Map(); // id -> state
    this.frame = 0;
    this.clock = 0;
    this.dt = 0;
  }

  /** Start a frame: the look's clock (s) and the real seconds since the last frame. */
  begin(clock, dt) {
    this.frame++;
    this.clock = clock;
    this.dt = Math.max(0, Math.min(0.25, dt));
  }

  /**
   * Move vessel `id` this frame. `at` { x, z } metres where the sim puts it,
   * `moving` (the sim says it is under way), `moor` null or { x, z, yaw }
   * its mooring (metres, the bow's heading there), `anchor` (lying still at
   * sea: swing to the wind), `size` its length, `wind` [wx, wz], `rough`,
   * `sail` its sail set, `row` its rowers pulling, `hurt` 0..1 (lost of its
   * hull's strength), `ring` [cx, cz] or null: a squadron holding the
   * water lies bows out round its rally point. Returns its state:
   * { x, y, z, yaw, pitch, roll, speed, stroke, brace, fill, unfurl, wake, moored }.
   */
  update(id, at, o) {
    let s = this.states.get(id);
    const dt = this.dt;
    if (!s) {
      s = {
        x: at.x, z: at.z, simX: at.x, simZ: at.z, yaw: o.yaw0 ?? 0, speed: 0, stroke: 0, moor: o.moor && !o.moving ? 1 : 0,
        unfurl: o.sail ? 1 : 0, fill: 0, brace: 0, wake: [], odo: 0, phase: phaseOf(id), seen: this.frame, y: 0, pitch: 0, roll: 0, heel: 0, moored: false,
      };
      if (o.moor && !o.moving) s.yaw = o.moor.yaw;
      this.states.set(id, s);
    }
    s.seen = this.frame;
    // The sim's step this frame (metres); a jump (a load, the view turned) is a new start.
    if (!Number.isFinite(s.simX)) {
      s.simX = at.x;
      s.simZ = at.z;
    }
    const dx = at.x - s.simX;
    const dz = at.z - s.simZ;
    let step = Math.hypot(dx, dz);
    if (step > 6) {
      step = 0;
      s.wake.length = 0;
      if (o.moor && !o.moving) s.yaw = o.moor.yaw;
    }
    s.simX = at.x;
    s.simZ = at.z;
    // Speed (m/s), smoothed over a quarter second or so.
    if (dt > 0) s.speed += ((step / dt) - s.speed) * Math.min(1, dt * 4);
    // Heading: toward the way it moves, eased by the metres covered.
    if (step > 1e-4 && o.moving !== false) {
      s.yaw = turnToward(s.yaw, yawOf(dx, dz), 1 - Math.exp(-step / TURN_M));
    } else if (dt > 0) {
      let want = null;
      if (o.moor) want = o.moor.yaw;
      else if (o.ring) {
        const rx = at.x - o.ring[0];
        const rz = at.z - o.ring[1];
        if (Math.hypot(rx, rz) > 0.5) want = yawOf(rx, rz);
      } else if (o.anchor && o.wind) want = yawOf(-o.wind[0], -o.wind[1]);
      if (want !== null) s.yaw = turnToward(s.yaw, want, 1 - Math.exp(-dt / TURN_S));
    }
    s.yaw = wrapAngle(s.yaw);
    // Its mooring: glided in while it lies at it, out as it casts off.
    const toward = o.moor && !o.moving ? 1 : 0;
    s.moor += Math.sign(toward - s.moor) * Math.min(Math.abs(toward - s.moor), dt / MOOR_S);
    const k = s.moor * s.moor * (3 - 2 * s.moor);
    s.moored = s.moor > 0.999;
    if (o.moor && k > 0) {
      s.x = at.x + (o.moor.x - at.x) * k;
      s.z = at.z + (o.moor.z - at.z) * k;
    } else {
      s.x = at.x;
      s.z = at.z;
    }
    // The rowers' clock: a stroke for every STROKE_M rowed, no faster than MAX_STROKES.
    if (o.row) s.stroke += Math.min(step / STROKE_M, MAX_STROKES * dt) * STROKE_DUR;
    // The sail: braced and filled by the wind, brailed up or let fall.
    const trim = o.wind ? trimFor(s.yaw, o.wind[0], o.wind[1]) : { brace: 0, fill: 0.6, heel: 0 };
    const ease = 1 - Math.exp(-dt * 1.6);
    s.brace += (trim.brace - s.brace) * ease;
    // (A gust: the cloth breathes a little.)
    const gust = 0.92 + 0.08 * Math.sin(this.clock * 0.9 + s.phase);
    s.fill += (trim.fill * gust - s.fill) * ease;
    const furl = o.sail ? 1 : 0;
    s.unfurl += Math.sign(furl - s.unfurl) * Math.min(Math.abs(furl - s.unfurl), dt * 0.6);
    // The sea, the heel under sail, a hurt hull lower and listing.
    const sea = seaMotion(s.x, s.z, this.clock, o.size || 6, o.rough || 0, s.phase);
    s.heel += (trim.heel * s.unfurl - s.heel) * ease;
    const hurt = Math.max(0, Math.min(1, o.hurt || 0));
    s.y = sea.heave - hurt * 0.12;
    s.pitch = sea.pitch * (s.moored ? 0.5 : 1) - Math.min(0.03, s.speed * 0.004);
    s.roll = sea.roll * (s.moored ? 0.5 : 1) + s.heel + hurt * 0.07 * (s.phase > Math.PI ? 1 : -1);
    // The wake: a point every WAKE_STEP covered, the newest first.
    s.odo += step;
    if (step > 0 && (!s.wake.length || s.odo - s.wake[0].o >= WAKE_STEP)) {
      s.wake.unshift({ x: s.x, z: s.z, o: s.odo, t: this.clock });
      if (s.wake.length > WAKE_POINTS) s.wake.length = WAKE_POINTS;
    }
    return s;
  }

  /**
   * The view turned by `dq` quarter turns: every heading turns with it (a
   * quarter turn takes the map's +x from the view's +u to its +v: the yaw
   * less a quarter), the wakes start again, the next place is no jump.
   */
  turned(dq) {
    for (const s of this.states.values()) {
      s.yaw = wrapAngle(s.yaw - (dq * Math.PI) / 2);
      s.wake.length = 0;
      s.simX = NaN;
    }
  }

  /** Forget the vessels not seen for a while. */
  end() {
    if (this.frame % 60 !== 0) return;
    for (const [id, s] of this.states) if (this.frame - s.seen > KEEP_FRAMES) this.states.delete(id);
  }
}

/**
 * A sinking ship at `age` seconds after it was lost: how far it has gone
 * down (m), its list and its bow's rise (rad), and whether it still shows.
 * It settles by the stern, lists over and goes under in SINK_S seconds.
 */
export function sinkPose(age, size = 6) {
  const k = Math.max(0, Math.min(1, age / SINK_S));
  const e = k * k;
  return { down: e * (1.4 + size * 0.12), list: 0.5 * Math.min(1, k * 1.6), pitch: 0.16 * Math.sin(Math.min(1, k * 1.3) * Math.PI * 0.5), shows: k < 1 };
}
