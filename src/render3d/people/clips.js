/**
 * people/clips.js
 * ----------------------------------------------------------------------------
 * The motions of the 3D look's people, made in code and baked once into the
 * rows of a float texture the vertex shader reads (material.js): a row a
 * frame, every bone's skinning matrix in it (pose.js write).
 *
 * A clip is a loop: its pose is a function of the phase t in [0, 1) built
 * from waves of whole cycles a loop (sin 2 pi k t) and keyframes read round
 * the loop (track), so its last frame runs into its first with no seam. The
 * GPU blends two neighbouring frames; per-instance phase and speed (the
 * actors' API: actors.js) keep two people from moving in step.
 *
 * Every standing clip stands on stand(): the weight shifted from one leg to
 * the other (the hips over the standing foot, the other knee easing, the
 * shoulders tilting against the hips: contrapposto), breathing, the head
 * turning to look about and holding there. The feet are planted (pose.js
 * solves the legs), so nothing slides.
 *
 * Variants: a man in the toga carries its folds on his bent left forearm (the
 * toga's weight hung there: statues show the arm so), so the clips a toga
 * wearer plays are baked again with that arm (`<name>@toga`) wherever the
 * clip itself leaves the left arm free.
 *
 * A walk's legs are planted for real: each foot strikes with its heel, rolls
 * flat, lifts its heel and pushes off its toes while its contact point moves
 * back at the walking speed (WALK_SPEED), then swings forward in an arc.
 * Played on a route (the shader moves the actor at the same speed) the feet
 * hold still on the ground.
 * ----------------------------------------------------------------------------
 */

import { Euler, Quaternion, Vector3 } from 'three';
import { Pose } from './pose.js';
import { BONE, BONE_COUNT, BONE_FLOATS } from './rig.js';
import { unitClips } from '../units/clips.js';

const TAU = Math.PI * 2;
/** A wave of k whole cycles a loop. */
const sn = (t, k = 1, ph = 0) => Math.sin(TAU * (k * t + ph));
const cs = (t, k = 1, ph = 0) => Math.cos(TAU * (k * t + ph));
/** A wave that holds at its ends (a glance one way, held, then the other): squarer as `sharp` grows. */
const hold = (t, k = 1, ph = 0, sharp = 2.5) => Math.tanh(sharp * sn(t, k, ph)) / Math.tanh(sharp);
const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
/** Along (0 to 1) for most of a cycle, then smoothly back: a hand along a line and back to its start. */
const saw = (k) => (k < 0.8 ? k / 0.8 : 1 - smooth((k - 0.8) / 0.2));

/**
 * Keyframes round the loop: `keys` [[t, value], ...] (t ascending in [0, 1),
 * value a number or an array), eased in and out between each pair (a pose
 * to pose motion: each key is held for an instant), the last running into
 * the first.
 */
export function track(t, keys) {
  const n = keys.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (keys[k][0] <= t) i = k;
  const a = keys[i];
  const b = keys[(i + 1) % n];
  const t0 = a[0];
  let t1 = b[0];
  let tt = t;
  if (t1 <= t0) t1 += 1;
  if (tt < t0) tt += 1;
  const k = smooth(clamp01((tt - t0) / (t1 - t0)));
  if (Array.isArray(a[1])) return a[1].map((v, j) => lerp(v, b[1][j], k));
  return lerp(a[1], b[1], k);
}

// ---------------------------------------------------------------------------
// What the clips share
// ---------------------------------------------------------------------------

/** The walk's natural speed (metres a second): its stride over its loop. Routes walk at it (scaled). */
export const WALK_STRIDE = 1.25;
export const WALK_DUR = 1.05;
export const WALK_SPEED = WALK_STRIDE / WALK_DUR;

/**
 * The walkers' stride (metres a loop of the stride and the clips like it) and how much lower their hips go
 * for it; a run's stride and the share of its loop each foot is down (the rest is flight). A walker's clip
 * plays at its distance walked over these (walkers/motion.js), so the feet hold the ground.
 */
export const WALKER_STRIDE = 1.6;
export const STRIDE_DROP = 0.065;
export const RUN_STRIDE = 2.0;
export const RUN_STANCE = 0.3;
/** Where the push clip's hands hold a handcart's handles (the right's x is minus this): the cart is built to them. */
export const HANDCART = Object.freeze({ handle: [0.23, 0.93, 0.38] });
/** The height (chest frame) a load carried on the head sits at: the top of the head and a pad. */
export const HEAD_LOAD_Y = 1.725;
/** Where the lead clip's right hand holds the rope (actor frame): the beast's rope is made to reach it. */
export const LEAD_HAND = Object.freeze([-0.24, 0.92, -0.2]);

/**
 * The pump the pump clip works (models/prefecture.js PUMP_BEAM): its beam's
 * pivot `ahead` of the man and `height` over his feet, its arm, its tilt at
 * rest (the near end down).
 */
export const PUMP = Object.freeze({ ahead: 1.0, height: 1.1, arm: 0.62, tilt: 0.12 });

/** A seat's height for the seated clips (a bench, a chair): the actor stands its feet on the floor under it. */
export const SEAT_H = 0.45;

/**
 * The rowing frame the row clips pull at (a model puts its bench and thole
 * here, as the watch house puts its pump at PUMP): the bench's top `seat`
 * over the feet; the thole pin `out` to the oar's side, `up` over the feet,
 * `ahead` of the seat (the rower faces the stern, so the thole is before
 * him); the oar's length from the handle `inboard` to the thole, `oar` in
 * all; the stretcher his feet are braced on, `brace` ahead.
 */
export const ROW = Object.freeze({ seat: 0.34, out: 0.42, up: 0.82, ahead: 0.3, inboard: 0.55, oar: 1.75, brace: 0.56 });

/**
 * The hortator's block (beat): its top `height` over his feet, `ahead` of
 * him and `side` (to his right, -x), where the mallet's head comes down.
 * Its loop is the stroke's: a crew and its hortator played with one phase
 * keep time (actors.js `sync`).
 */
export const BEAT = Object.freeze({ height: 0.92, ahead: 0.48, side: -0.14 });

/**
 * A ship's rowing bench (rowShip, rowShipRight): as ROW, but the thole close
 * over the seat (on the gunwale or an oar box) and a long sweep (props.js
 * sweep, `oar` long, `inboard` of it inside the thole) dipped `dip` (rad,
 * the handle up) through the drive and `lift` through the recovery, so its
 * blade goes deep into the water and comes out clear of it on a hull whose
 * thole stands a little over the waterline (ships/: the hulls put their
 * tholes there).
 */
export const ROW_SHIP = Object.freeze({ seat: 0.38, out: 0.62, up: 0.58, ahead: 0.2, inboard: 0.6, oar: 3.0, brace: 0.55, dip: 0.32, lift: -0.02 });

/** The line a hauler pulls in (haul a line): where his hands reach out to along it, in his frame. */
export const HAUL = Object.freeze({ reach: Object.freeze([0, 0.62, 0.62]) });

/** A windlass's axle (windlass): along x, `ahead` of the man and `height` up, its crank `arm` long, at `x`. */
export const WINDLASS = Object.freeze({ ahead: 0.44, height: 1.0, arm: 0.24, x: 0.18 });

/**
 * A couch (lectus) for the diners (dine): its top `top` over the floor. The
 * actor stands at the couch's front edge where his hips lie, facing the
 * table; he lies along it on his left side, his head to his left (+x), his
 * feet `feet` to his right.
 */
export const DINE = Object.freeze({ top: 0.6, feet: 0.8 });

/**
 * The barber's client (shave): the middle of the seated client's head, in
 * the barber's frame (he faces it from the client's side), and the mortar's
 * mouth a physician grinds at (stir): `ahead`, `height`.
 */
export const SHAVE = Object.freeze({ head: Object.freeze([0.04, 1.2, 0.44]) });
export const MORTAR = Object.freeze({ ahead: 0.36, height: 0.86 });

/** The bow (props.js bow): its string BOW.brace behind the grip at rest, tip to tip (the shoot clip's nock at rest). */
export const BOW = Object.freeze({ brace: 0.11 });

/** The shelf a librarian reaches to (reach): `ahead` of him, `height` up. */
export const SHELF = Object.freeze({ ahead: 0.42, height: 1.55 });

/** Where a hand rests on the body for the toga's folds: the left forearm across the waist (chest frame). */
const TOGA_HAND = [0.12, 1.0, 0.2];

/**
 * A man standing: weight on one leg, then the other (the shift held, then
 * moved), breathing, his head looking about. `o.shift` how much he shifts,
 * `ph` its phase, `breath` breaths a loop, `look` how far he turns his head,
 * `lean` forward.
 */
function stand(P, t, o = {}) {
  const { shift = 1, ph = 0, breath = 3, look = 1, lean = 0, feet = 0.105 } = o;
  const s = hold(t, 1, ph, 1.6) * shift;
  // The hips over the standing leg, its side raised; the shoulders tilted the other way.
  P.root(s * 0.028, -0.014 - 0.006 * Math.abs(s), 0.004 * sn(t, 2, ph), lean * 0.5, 0.05 * s, 0.045 * s);
  P.rot('spine', 0.02 + lean * 0.5 + 0.008 * sn(t, breath, 0.1), -0.03 * s, -0.055 * s);
  P.rot('chest', 0.012 * sn(t, breath), -0.02 * s, -0.02 * s);
  for (const side of [1, -1]) {
    // The free leg (the one the weight is off) a little ahead and out, its heel easing.
    const free = Math.max(0, -side * s);
    P.foot(side, side * (feet + 0.02 * free), 0.085 + 0.008 * free, 0.01 + 0.05 * free, 0.06 * free, side * (0.12 + 0.08 * free));
  }
  // The clavicles rise with a breath.
  P.rot('clavL', 0, 0, 0.012 * sn(t, breath, 0.05));
  P.rot('clavR', 0, 0, -0.012 * sn(t, breath, 0.05));
  // Looking about: a glance held, another, now and then a look down; the neck and head share it.
  const yaw = look * (0.38 * hold(t, 2, ph + 0.13, 2.2) * (0.6 + 0.4 * cs(t, 1, ph)) + 0.08 * sn(t, 5, ph + 0.3));
  const nod = look * (0.05 * sn(t, 3, ph + 0.6) + 0.04);
  P.rot('neck', nod * 0.4, yaw * 0.35, 0.02 * s);
  P.rot('head', nod * 0.6, yaw * 0.65, 0.025 * sn(t, 2, ph + 0.2));
  return s;
}

/** Arms hanging at rest, swaying a little with the body (ph: their own phase), fingers easy. */
function armsDown(P, t, sides = [1, -1], ph = 0) {
  for (const s of sides) {
    const k = s > 0 ? 'L' : 'R';
    P.rot(`arm${k}`, -0.03 + 0.025 * sn(t, 1, ph + (s > 0 ? 0 : 0.3)), 0, s * 0.07);
    P.rot(`fore${k}`, -0.16 - 0.03 * sn(t, 2, ph), s * 0.1, 0);
    P.rot(`hand${k}`, 0, 0, s * 0.04);
    fingers(P, s, 0.35);
  }
}

/** A hand's fingers curled (0 straight, 1 a fist); the thumb is in the hand's own mesh. */
function fingers(P, s, curl) {
  P.rot(s > 0 ? 'fingL' : 'fingR', -0.15 * curl, 0, -s * 1.2 * curl);
}

/** The toga's left arm: the forearm across the waist, the folds over it (chest frame, with the breath). */
function togaArm(P, t) {
  P.hand(1, TOGA_HAND[0], TOGA_HAND[1] + 0.005 * sn(t, 3), TOGA_HAND[2], { chest: true, pole: [0.7, -0.4, -0.5] });
  P.rot('handL', -0.2, 0, -0.35);
  fingers(P, 1, 0.55);
}

/** Seated on a seat SEAT_H high: the hips on it, the thighs over its edge, the feet on the floor. */
function sit(P, t, o = {}) {
  const { ph = 0, lean = 0.06, breath = 3, look = 1, spread = 0.13 } = o;
  P.root(0, SEAT_H + 0.1 - 0.95, -0.03, -0.12, 0.02 * sn(t, 1, ph), 0.01 * sn(t, 1, ph + 0.3));
  P.rot('spine', 0.14 + lean + 0.008 * sn(t, breath, 0.1), 0, 0);
  P.rot('chest', 0.01 + 0.012 * sn(t, breath), 0.02 * sn(t, 1, ph), 0);
  for (const s of [1, -1]) P.foot(s, s * spread, 0.085, 0.43 + 0.02 * s * sn(t, 1, ph + 0.4), 0, s * 0.1, { pole: [s * 0.15, 0.5, 1] });
  const yaw = look * (0.3 * hold(t, 2, ph + 0.21, 2) + 0.06 * sn(t, 5, ph));
  P.rot('neck', 0.05, yaw * 0.35, 0);
  P.rot('head', 0.05 + 0.04 * sn(t, 3, ph + 0.5), yaw * 0.65, 0.02 * sn(t, 2, ph));
}

/** Place a prop bone at `from` (actor frame) with its own +y toward `to`, turned `roll` about that line. */
function propAlong(P, s, from, to, roll = 0, opts = {}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const l = Math.hypot(dx, dy, dz) || 1;
  // +y toward (dx, dy, dz): YXZ Euler from the direction (yaw about y, then pitch about x).
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.acos(Math.max(-1, Math.min(1, dy / l)));
  if (!roll) {
    P.prop(s, from[0], from[1], from[2], pitch, yaw, 0, opts);
    return;
  }
  // (The roll about the prop's own +y comes first: an Euler's z would tip that axis off the line. The
  // turn, the pitch and the roll composed, then read back as the YXZ Euler the Pose takes.)
  _q1.setFromAxisAngle(_Y, yaw).multiply(_q2.setFromAxisAngle(_X, pitch)).multiply(_q2b.setFromAxisAngle(_Y, roll));
  _eu.setFromQuaternion(_q1, 'YXZ');
  P.prop(s, from[0], from[1], from[2], _eu.x, _eu.y, _eu.z, opts);
}
const _q1 = new Quaternion();
const _q2 = new Quaternion();
const _q2b = new Quaternion();
const _eu = new Euler();
const _X = new Vector3(1, 0, 0);
const _Y = new Vector3(0, 1, 0);

/** A point `d` along a prop placed by propAlong. */
function along(from, to, d) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const l = Math.hypot(dx, dy, dz) || 1;
  return [from[0] + (dx / l) * d, from[1] + (dy / l) * d, from[2] + (dz / l) * d];
}

// ---------------------------------------------------------------------------
// The clips
// ---------------------------------------------------------------------------

/**
 * Each clip: its loop's length in seconds, the frames a second baked, the
 * pose at phase t (`m` the variant: m.toga), and `toga` if a toga wearer
 * plays it (baked again with the folds on his left arm, unless the clip
 * uses that arm itself), `walk` for the clips played moving on a route.
 */
export const CLIPS = Object.freeze({
  idle: {
    dur: 12, fps: 12, toga: true,
    pose(P, t, m) {
      stand(P, t);
      armsDown(P, t, m.toga ? [-1] : [1, -1]);
      if (m.toga) togaArm(P, t);
    },
  },
  // Listening: the hands clasped before him, nodding now and then.
  listen: {
    dur: 9, fps: 12, toga: true,
    pose(P, t, m) {
      stand(P, t, { shift: 0.6, ph: 0.3, look: 0.4 });
      P.rot('head', 0.1 * Math.max(0, sn(t, 4, 0.1)) ** 3, 0, 0);
      // (The wrists apart, the fingers of the right over the back of the left: hands clasped, not crossed.)
      if (!m.toga) P.hand(1, 0.07, 0.93, 0.12, { chest: true, pole: [0.6, -0.3, -0.6] });
      P.hand(-1, -0.055, 0.95, 0.13, { chest: true, pole: [-0.6, -0.3, -0.6] });
      fingers(P, -1, 0.6);
      if (m.toga) togaArm(P, t);
      else fingers(P, 1, 0.6);
    },
  },
  // Talking: the right hand making its points, the left now and then; the chest turning to his hearer.
  talk: {
    dur: 8, fps: 15, toga: true,
    pose(P, t, m) {
      stand(P, t, { shift: 0.7, ph: 0.55, look: 0.35 });
      const r = track(t, [[0, [-0.2, 1.08, 0.24]], [0.12, [-0.24, 1.2, 0.3]], [0.22, [-0.18, 1.12, 0.32]], [0.36, [-0.26, 1.24, 0.28]], [0.5, [-0.2, 1.0, 0.18]],
        [0.62, [-0.28, 1.18, 0.3]], [0.74, [-0.16, 1.16, 0.34]], [0.88, [-0.24, 1.06, 0.22]]]);
      P.hand(-1, ...r, { chest: true, pole: [-0.7, -0.5, -0.4] });
      P.rot('handR', 0.3, 0.2 * sn(t, 4), -0.5 + 0.2 * sn(t, 3));
      fingers(P, -1, 0.2);
      if (m.toga) togaArm(P, t);
      else {
        const l = track(t, [[0, [0.2, 0.92, 0.1]], [0.3, [0.2, 0.92, 0.1]], [0.42, [0.22, 1.08, 0.26]], [0.56, [0.2, 0.92, 0.1]]]);
        P.hand(1, ...l, { chest: true });
        fingers(P, 1, 0.3);
      }
      P.rot('chest', 0, 0.08 * sn(t, 2, 0.1), 0);
      P.rot('head', 0.06 * sn(t, 6), 0.1 * sn(t, 2, 0.2), 0.04 * sn(t, 3));
    },
  },
  // A walk on the spot (the route moves him): heel, roll, toe; arms swinging against the legs.
  walk: {
    dur: WALK_DUR, fps: 40, toga: true, walk: true,
    pose(P, t, m) {
      walkLegs(P, t);
      walkArms(P, t, m.toga ? [-1] : [1, -1]);
      if (m.toga) togaArm(P, t);
    },
  },
  // Carrying a load on the left shoulder (a sack, an amphora), the left hand steadying it.
  carry: {
    dur: WALK_DUR * 1.1, fps: 40, walk: true, stride: WALK_STRIDE * 0.92,
    pose(P, t) {
      walkLegs(P, t, 0.92);
      walkArms(P, t, [-1]);
      P.rot('spine', 0, 0, 0.05);
      P.prop(1, 0.11, 1.5, -0.03, 0, 0.1, 0.25, { chest: true });
      P.hand(1, 0.2, 1.53, 0.1, { chest: true, pole: [0.8, -0.6, 0] });
      P.rot('handL', 0, 0, 0.6);
      fingers(P, 1, 0.6);
      P.rot('head', 0, 0, -0.08);
    },
  },
  // Sitting at rest, hands on the thighs.
  sit: {
    dur: 12, fps: 12, toga: true,
    pose(P, t, m) {
      sit(P, t, { ph: 0.4 });
      P.hand(-1, -0.13, 0.62, 0.3 + 0.01 * sn(t, 1), { pole: [-0.5, -0.4, -0.6] });
      P.rot('handR', 0.9, 0, -0.2);
      fingers(P, -1, 0.3);
      if (m.toga) togaArm(P, t);
      else {
        P.hand(1, 0.13, 0.62, 0.3, { pole: [0.5, -0.4, -0.6] });
        P.rot('handL', 0.9, 0, 0.2);
        fingers(P, 1, 0.3);
      }
    },
  },
  // Writing on a wax tablet on the lap: the stylus in the right hand, short strokes, a pause to think.
  write: {
    dur: 7, fps: 20,
    pose(P, t) {
      sit(P, t, { ph: 0.1, lean: 0.2, look: 0.15 });
      P.rot('neck', 0.28, 0, 0);
      P.rot('head', 0.22, 0, 0);
      // The tablet on the left thigh, tipped toward him; the left hand at its edge.
      P.prop(1, 0.05, 0.64, 0.3, -0.35, 0.15, 0);
      P.hand(1, 0.15, 0.66, 0.3, { pole: [0.6, -0.4, -0.5] });
      P.rot('handL', 0.6, 0, 0.5);
      fingers(P, 1, 0.5);
      // Strokes: a line written, the hand moved on, a pause looking up.
      const writing = track(t, [[0, 1], [0.55, 1], [0.62, 0], [0.82, 0], [0.9, 1]]);
      // Along the line, then back to the start of the next (a loop of five lines: no jump at the seam).
      const x = -0.02 + 0.08 * saw((t * 5) % 1) * writing;
      const scratch = 0.008 * sn(t, 70) * writing;
      P.hand(-1, x, 0.71 + scratch, 0.31 + 0.012 * sn(t, 35) * writing, { pole: [-0.5, -0.5, -0.5] });
      P.rot('handR', 0.5, 0.3, -0.4);
      fingers(P, -1, 0.75);
      P.rot('head', -0.25 * (1 - writing), 0.1 * (1 - writing), 0);
    },
  },
  // Reading a roll held open in both hands, the eyes running along its lines.
  read: {
    dur: 10, fps: 12,
    pose(P, t) {
      sit(P, t, { ph: 0.7, lean: 0.1, look: 0.1 });
      const y = 0.93 + 0.01 * sn(t, 1);
      P.prop(-1, 0, y, 0.3, -0.55, 0, 0);
      P.hand(1, 0.145, y - 0.02, 0.29, { pole: [0.6, -0.6, -0.4] });
      P.hand(-1, -0.145, y - 0.02, 0.29, { pole: [-0.6, -0.6, -0.4] });
      P.rot('handL', 0.4, 0, 0.9);
      P.rot('handR', 0.4, 0, -0.9);
      fingers(P, 1, 0.7);
      fingers(P, -1, 0.7);
      P.rot('neck', 0.18, 0, 0);
      // Along a line and back to the next, now and then a look up from it.
      const up = track(t, [[0, 0], [0.7, 0], [0.76, 1], [0.86, 1], [0.92, 0]]);
      P.rot('head', 0.2 - 0.3 * up, 0.12 * (saw((t * 8) % 1) - 0.5) * (1 - up), 0);
    },
  },
  // Declaiming, standing: the right arm raised to the crowd (the orator's gesture of the statues), turning to each side.
  orate: {
    dur: 8, fps: 15, toga: true,
    pose(P, t, m) {
      stand(P, t, { shift: 0.5, ph: 0.2, look: 0.2 });
      const r = track(t, [[0, [-0.26, 1.5, 0.36]], [0.2, [-0.3, 1.55, 0.3]], [0.32, [-0.34, 1.25, 0.24]], [0.5, [-0.22, 1.48, 0.4]], [0.7, [-0.32, 1.58, 0.26]], [0.84, [-0.28, 1.3, 0.3]]]);
      P.hand(-1, ...r, { chest: true, pole: [-0.8, -0.5, -0.2] });
      P.rot('handR', 0.6, 0, -0.3);
      fingers(P, -1, 0.15);
      if (m.toga) togaArm(P, t);
      else armsDown(P, t, [1]);
      const turn = 0.25 * hold(t, 1, 0.1, 1.5);
      P.rot('chest', 0, turn * 0.5, 0);
      P.rot('head', -0.05, turn * 0.6, 0);
    },
  },
  // A master seated in his chair, teaching: the right hand raised, making his point.
  teach: {
    dur: 8, fps: 15, toga: true,
    pose(P, t, m) {
      sit(P, t, { ph: 0.15, lean: 0, look: 0.3 });
      const r = track(t, [[0, [-0.22, 1.35, 0.3]], [0.25, [-0.26, 1.48, 0.26]], [0.4, [-0.2, 1.2, 0.32]], [0.6, [-0.26, 1.45, 0.3]], [0.8, [-0.18, 1.1, 0.28]]]);
      P.hand(-1, ...r, { chest: true, pole: [-0.8, -0.5, -0.2] });
      P.rot('handR', 0.5, 0, -0.4);
      fingers(P, -1, 0.2);
      if (m.toga) togaArm(P, t);
      else {
        P.hand(1, 0.13, 0.62, 0.3, { pole: [0.5, -0.4, -0.6] });
        P.rot('handL', 0.9, 0, 0.2);
        fingers(P, 1, 0.3);
      }
    },
  },
  // Praying in the old way (orans): both arms raised to the sides, palms up and out, the head lifted.
  pray: {
    dur: 10, fps: 12,
    pose(P, t) {
      stand(P, t, { shift: 0.35, ph: 0.8, look: 0.05 });
      const lift = 0.04 * sn(t, 2, 0.1);
      for (const s of [1, -1]) {
        P.hand(s, s * 0.36, 1.42 + lift, 0.16, { chest: true, pole: [s * 0.7, -0.7, 0.1] });
        P.rot(s > 0 ? 'handL' : 'handR', -0.4, 0, s * 1.2);
        fingers(P, s, 0.1);
      }
      P.rot('neck', -0.12, 0, 0);
      P.rot('head', -0.1 + 0.03 * sn(t, 2), 0.04 * sn(t, 1), 0);
    },
  },
  // Sacrificing at the altar: the patera in the right hand, held out over the fire and tipped, raised to the god, brought back.
  sacrifice: {
    dur: 9, fps: 15, toga: true,
    pose(P, t, m) {
      stand(P, t, { shift: 0.4, ph: 0.45, look: 0.1, lean: 0.03 });
      // The dish's place and tilt through the rite (actor frame: the altar's fire about 0.6 ahead, 1.0 up).
      const at = track(t, [[0, [-0.12, 1.12, 0.3]], [0.16, [-0.1, 1.1, 0.44]], [0.3, [-0.1, 1.08, 0.46]], [0.42, [-0.12, 1.12, 0.32]], [0.58, [-0.16, 1.5, 0.34]], [0.72, [-0.16, 1.5, 0.34]], [0.86, [-0.12, 1.14, 0.3]]]);
      const tip = track(t, [[0, 0], [0.18, 0], [0.24, 0.9], [0.32, 0.9], [0.4, 0]]);
      P.prop(-1, at[0], at[1], at[2], 0, 0, -tip * 0.9);
      P.hand(-1, at[0] - 0.07, at[1] - 0.02, at[2] - 0.02, { pole: [-0.6, -0.6, -0.3] });
      P.rot('handR', 0.2, 0, -0.9 - tip * 0.6);
      fingers(P, -1, 0.5);
      if (m.toga) togaArm(P, t);
      else armsDown(P, t, [1]);
      // He follows the dish with his eyes.
      P.rot('neck', 0.12, 0, 0);
      P.rot('head', 0.1 - 0.25 * track(t, [[0, 0], [0.5, 0], [0.6, 1], [0.72, 1], [0.84, 0]]), -0.1, 0);
    },
  },
  // Playing the double pipes (tibiae): their mouthpieces at the lips, the fingers on the holes, swaying to the tune.
  flute: {
    dur: 6, fps: 20,
    pose(P, t) {
      stand(P, t, { shift: 0.4, ph: 0.6, look: 0 });
      P.rot('spine', 0.03 * sn(t, 3), 0.03 * sn(t, 1.5 * 2), 0.03 * sn(t, 3, 0.25));
      // The pipes from the lips (chest frame: the head held still on the chest), forward and down, apart.
      P.prop(-1, 0, 1.536, 0.1, 0.95 + 0.04 * sn(t, 3), 0, 0, { chest: true });
      for (const s of [1, -1]) {
        const a = 0.16 * s;
        // A point along each pipe (the pipes part at 2 x 0.16 rad): where the fingers stop the holes.
        const d = 0.24;
        const pitch = 0.95 + 0.04 * sn(t, 3);
        P.hand(s, Math.sin(a) * d, 1.536 - Math.sin(pitch) * Math.cos(a) * d - 0.02, 0.1 + Math.cos(pitch) * Math.cos(a) * d, { chest: true, pole: [s * 0.8, -0.5, -0.2] });
        P.rot(s > 0 ? 'handL' : 'handR', 0.2, 0, s * 0.5);
        fingers(P, s, 0.45 + 0.15 * sn(t, 24, s > 0 ? 0 : 0.3));
      }
      P.rot('neck', 0, 0, 0);
    },
  },
  // Working a pump's beam (the watch house's force pump): both hands on its handle, the back bending into each stroke.
  pump: {
    dur: 2.2, fps: 30,
    pose(P, t) {
      const down = 0.5 - 0.5 * cs(t, 1);
      P.root(0, -0.03 - 0.06 * down, -0.02 - 0.03 * down, 0.05 + 0.15 * down, 0, 0);
      P.rot('spine', 0.08 + 0.18 * down, 0, 0);
      P.rot('chest', 0.06 * down, 0, 0);
      for (const s of [1, -1]) P.foot(s, s * 0.14, 0.085, s > 0 ? 0.08 : -0.08, 0, s * 0.2);
      // The beam rocks about its pivot (PUMP, ahead of him), its near end down a stroke and up again; the
      // prop is the beam from its near handle (people/props.js beam), the hands on the handle.
      const ang = PUMP.tilt - 0.2 + 0.4 * down;
      const hy = PUMP.height - Math.sin(ang) * PUMP.arm;
      const hz = PUMP.ahead - Math.cos(ang) * PUMP.arm;
      P.prop(-1, 0, hy, hz, -ang, 0, 0);
      for (const s of [1, -1]) {
        P.hand(s, s * 0.11, hy + 0.03, hz - 0.01, { pole: [s * 0.6, -0.7, -0.3] });
        P.rot(s > 0 ? 'handL' : 'handR', 0.8, 0, s * 0.5);
        fingers(P, s, 0.9);
      }
      P.rot('neck', -0.1 - 0.1 * down, 0, 0);
      P.rot('head', -0.05, 0, 0);
    },
  },
  // A hammer on a chisel at a block before him (a mason, a smith).
  hammer: {
    dur: 1.4, fps: 30,
    pose(P, t) {
      stand(P, t, { shift: 0.2, ph: 0.1, look: 0, lean: 0.1 });
      P.rot('neck', 0.25, 0, 0);
      P.rot('head', 0.2, 0, 0);
      // The chisel held to the stone.
      P.prop(1, 0.04, 0.98, 0.42, 0.5, 0, 0);
      P.hand(1, 0.06, 1.01, 0.4, { pole: [0.6, -0.6, -0.4] });
      P.rot('handL', 0.6, 0, 0.4);
      fingers(P, 1, 0.8);
      // The hammer: raised slowly, brought down fast.
      const up = track(t, [[0, 0], [0.12, 0], [0.62, 1], [0.78, 1]]);
      // The mallet's grip; its head (+x of the grip) comes down on the chisel's top.
      const hp = [-0.17 - 0.04 * up, 1.07 + 0.22 * up, 0.4 - 0.08 * up];
      P.prop(-1, hp[0], hp[1], hp[2], 0, 0, 1.3 * up);
      P.hand(-1, hp[0], hp[1] - 0.005, hp[2] - 0.02, { pole: [-0.8, -0.5, -0.3] });
      P.rot('handR', 0.2, 0, -0.2 - 0.6 * up);
      fingers(P, -1, 0.9);
    },
  },
  // Sweeping with a broom of twigs: both hands on the shaft, side to side, a step now and then.
  sweep: {
    dur: 3.2, fps: 20,
    pose(P, t) {
      stand(P, t, { shift: 0.5, ph: 0.4, look: 0.1, lean: 0.2 });
      const sw = sn(t, 2);
      // The broom across his right side: the left hand at its top, the right lower down, its head swept before him.
      const head = [-0.22 + 0.3 * sw, 0.04, 0.52];
      const top = [0.0 + 0.05 * sw, 1.04, 0.24];
      propAlong(P, -1, top, head, 0);
      P.hand(1, ...along(top, head, 0.04), { pole: [0.7, -0.6, -0.3] });
      P.hand(-1, ...along(top, head, 0.2), { pole: [-0.7, -0.6, -0.3] });
      fingers(P, 1, 0.9);
      fingers(P, -1, 0.9);
      P.rot('chest', 0, -0.15 * sw, 0);
      P.rot('neck', 0.2, 0.1 * sw, 0);
    },
  },
  // Counting coin at a table before him (0.9 high): from the heap to the stacks, one by one.
  count: {
    dur: 5, fps: 20,
    pose(P, t) {
      stand(P, t, { shift: 0.3, ph: 0.9, look: 0.05, lean: 0.2 });
      P.rot('neck', 0.3, 0, 0);
      P.rot('head', 0.22, 0, 0);
      const k = (t * 5) % 1;
      const x = lerp(-0.14, 0.04, smooth(clamp01((k - 0.15) / 0.4))) - lerp(0, 0.18, smooth(clamp01((k - 0.7) / 0.3)));
      const lift = 0.04 * Math.sin(Math.PI * clamp01((k - 0.15) / 0.4));
      // (A counting table's top about 0.86 high, the coin on it.)
      P.hand(-1, x, 0.92 + lift, 0.33, { pole: [-0.6, -0.6, -0.4] });
      P.rot('handR', 0.9, 0, -0.2);
      fingers(P, -1, 0.6);
      P.hand(1, 0.16, 0.9, 0.32, { pole: [0.6, -0.6, -0.4] });
      P.rot('handL', 0.9, 0, 0.3);
      fingers(P, 1, 0.4);
    },
  },
  // Paying: the purse held out, coins counted into a hand, drawn back.
  give: {
    dur: 6, fps: 15,
    pose(P, t) {
      stand(P, t, { shift: 0.4, ph: 0.15, look: 0.15, lean: 0.04 });
      const out = track(t, [[0, 0], [0.25, 0], [0.4, 1], [0.7, 1], [0.85, 0]]);
      P.hand(-1, -0.14, 1.0 + 0.05 * out, 0.22 + 0.22 * out, { pole: [-0.6, -0.6, -0.4] });
      P.rot('handR', 0.8 + 0.4 * out, 0, -0.4);
      fingers(P, -1, 0.7);
      P.hand(1, 0.08, 1.0, 0.24 + 0.08 * out, { pole: [0.6, -0.6, -0.4] });
      P.rot('handL', 0.6, 0, 0.6);
      fingers(P, 1, 0.3);
      P.rot('neck', 0.15 * out, 0, 0);
    },
  },
  // A boy reciting from his tablet held up before him, looking from it to his master.
  recite: {
    dur: 7, fps: 15,
    pose(P, t) {
      stand(P, t, { shift: 0.5, ph: 0.35, look: 0.1 });
      P.prop(1, 0.0, 1.08, 0.28, -1.0, 0, 0, { chest: true });
      P.hand(1, 0.11, 1.06, 0.27, { chest: true, pole: [0.6, -0.6, -0.4] });
      P.hand(-1, -0.11, 1.06, 0.27, { chest: true, pole: [-0.6, -0.6, -0.4] });
      P.rot('handL', 0.6, 0, 0.8);
      P.rot('handR', 0.6, 0, -0.8);
      fingers(P, 1, 0.6);
      fingers(P, -1, 0.6);
      const up = track(t, [[0, 0], [0.4, 0], [0.48, 1], [0.66, 1], [0.74, 0]]);
      P.rot('neck', 0.2 - 0.15 * up, 0, 0);
      P.rot('head', 0.2 - 0.3 * up + 0.04 * sn(t, 9), 0, 0);
    },
  },
  // Holding something before him in both hands (the incense box, a roll, a garland).
  hold: {
    dur: 10, fps: 12,
    pose(P, t) {
      stand(P, t, { shift: 0.6, ph: 0.5, look: 0.6 });
      P.prop(-1, 0, 0.98, 0.22, 0, 0, 0, { chest: true });
      P.hand(1, 0.09, 0.97, 0.21, { chest: true, pole: [0.6, -0.6, -0.4] });
      P.hand(-1, -0.09, 0.97, 0.21, { chest: true, pole: [-0.6, -0.6, -0.4] });
      P.rot('handL', 0.6, 0, 1.1);
      P.rot('handR', 0.6, 0, -1.1);
      fingers(P, 1, 0.6);
      fingers(P, -1, 0.6);
    },
  },
  // Something on the left shoulder standing (a lictor's fasces, an axe): the left hand at its foot.
  shoulder: {
    dur: 11, fps: 12,
    pose(P, t) {
      stand(P, t, { shift: 0.8, ph: 0.65 });
      armsDown(P, t, [-1]);
      P.prop(1, 0.17, 1.06, 0.2, -0.42, 0, -0.1, { chest: true });
      P.hand(1, 0.17, 1.05, 0.2, { chest: true, pole: [0.7, -0.6, -0.2] });
      P.rot('handL', 0.4, 0, 0.9);
      fingers(P, 1, 0.9);
    },
  },
  // Cheering at a festival: arms up and waving, a bounce; no two alike (each its own phase and speed).
  cheer: {
    dur: 4, fps: 20,
    pose(P, t) {
      const b = Math.abs(sn(t, 4));
      P.root(0.01 * sn(t, 2), -0.03 + 0.025 * b, 0, 0, 0.06 * sn(t, 1), 0);
      P.rot('spine', -0.03, 0, 0.03 * sn(t, 2));
      for (const s of [1, -1]) {
        P.foot(s, s * 0.12, 0.085 + 0.02 * b * (s > 0 ? 1 : 0.5), 0.02, 0.15 * b, s * 0.15);
        const up = s > 0 ? 0.5 + 0.5 * sn(t, 2) : 0.5 + 0.5 * sn(t, 2, 0.35);
        P.hand(s, s * (0.22 + 0.06 * sn(t, 4, s > 0 ? 0 : 0.25)), 1.45 + 0.4 * up, 0.12, { chest: true, pole: [s * 0.8, -0.4, -0.2] });
        P.rot(s > 0 ? 'handL' : 'handR', -0.3, 0, s * (0.6 + 0.5 * sn(t, 8)));
        fingers(P, s, 0.2);
      }
      P.rot('neck', -0.15, 0.2 * sn(t, 1, 0.2), 0);
      P.rot('head', -0.1, 0.1 * sn(t, 2), 0);
    },
  },
  // On guard with a spear: its butt on the ground at his right, his shield at his left, looking about.
  guard: {
    dur: 14, fps: 12,
    pose(P, t) {
      stand(P, t, { shift: 0.9, ph: 0.05, look: 1.3 });
      P.prop(-1, -0.27, 1.12, 0.12, 0, 0, 0);
      P.hand(-1, -0.27, 1.1, 0.1, { pole: [-0.6, -0.7, -0.3] });
      P.rot('handR', 0, 0, -1.4);
      fingers(P, -1, 0.95);
      P.prop(1, 0.27, 0.86, 0.06, 0, 0.35, 0);
      P.hand(1, 0.25, 0.84, 0.04, { pole: [0.7, -0.6, -0.3] });
      P.rot('handL', 0, 0, 1.2);
      fingers(P, 1, 0.9);
    },
  },

  // --- The walkers' clips (render3d/walkers/). The city's walkers cover 3.2 m a second at 1x, past a
  // stroll's pace, so they stride out: WALKER_STRIDE a loop on hips held STRIDE_DROP lower (the feet must
  // stay within the legs' reach), the arms swinging wider. Each is played by the distance walked
  // (walkers/motion.js), so the feet hold the ground at any game speed and stand still while paused.

  // Striding through the streets, the arms swinging.
  stride: {
    dur: 0.8, fps: 30, toga: true, walk: true, stride: WALKER_STRIDE,
    pose(P, t, m) {
      strideLegs(P, t, 0.03);
      walkArms(P, t, m.toga ? [-1] : [1, -1], 1.35);
      if (m.toga) togaArm(P, t);
    },
  },
  // Running (a prefect to a fire): a flight between the strides, low hips, leaning in, the arms bent and pumping.
  run: {
    dur: 0.62, fps: 40, walk: true, stride: RUN_STRIDE,
    pose(P, t) {
      runLegs(P, t);
      for (const s of [1, -1]) {
        const k = s > 0 ? 'L' : 'R';
        const sw = sn(t, 1, s > 0 ? 0.75 : 0.25);
        P.rot(`arm${k}`, -0.6 * sw - 0.12, 0, s * 0.14);
        P.rot(`fore${k}`, -1.3 - 0.25 * sw, s * 0.15, 0);
        P.rot(`hand${k}`, 0, 0, s * 0.1);
        fingers(P, s, 0.85);
      }
      P.rot('neck', -0.1, 0, 0);
    },
  },
  // Pushing a handcart: both hands on its handles (HANDCART.handle), leaning into it.
  push: {
    dur: 0.8, fps: 30, walk: true, stride: WALKER_STRIDE,
    pose(P, t) {
      strideLegs(P, t, 0.16);
      const [hx, hy, hz] = HANDCART.handle;
      for (const s of [1, -1]) {
        P.hand(s, s * hx, hy, hz, { pole: [s * 0.55, -0.7, -0.45] });
        P.rot(s > 0 ? 'handL' : 'handR', 0.3, 0, s * 0.35);
        fingers(P, s, 0.95);
      }
      P.rot('neck', -0.14, 0, 0);
      P.rot('head', -0.06, 0, 0);
    },
  },
  // A basket carried on the head (a market woman's) on its pad, steadied at the rim by the left hand.
  headCarry: {
    dur: 0.8, fps: 30, walk: true, stride: WALKER_STRIDE,
    pose(P, t) {
      strideLegs(P, t, 0);
      walkArms(P, t, [-1], 1.2);
      // (The head held level and still under its load: the walk's own nod taken back.)
      P.rot('neck', -0.02, 0.05 * sn(t, 1, 0.25), 0);
      P.rot('head', -0.02 - 0.015 * sn(t, 2, 0.4), 0.03 * sn(t, 1, 0.25), 0);
      P.prop(1, 0, HEAD_LOAD_Y, 0.005, 0, 0, 0, { chest: true });
      P.hand(1, 0.17, HEAD_LOAD_Y + 0.02, 0.02, { chest: true, pole: [0.9, 0.25, -0.2] });
      P.rot('handL', 0, 0, 1.3);
      fingers(P, 1, 0.5);
    },
  },
  // A basket on the left hip in the crook of the arm (a buyer back from the market), leaning from its weight.
  hipCarry: {
    dur: 0.8, fps: 30, walk: true, stride: WALKER_STRIDE,
    pose(P, t) {
      strideLegs(P, t, 0);
      walkArms(P, t, [-1], 1.2);
      P.rot('spine', 0, 0, -0.06);
      P.prop(1, 0.27, 0.98, 0.05, 0, 0, -0.18, { chest: true });
      P.hand(1, 0.21, 0.96, 0.19, { chest: true, pole: [0.8, -0.3, -0.45] });
      P.rot('handL', 0.5, 0, 0.8);
      fingers(P, 1, 0.75);
    },
  },
  // A bundle on the back, its strap held at the left shoulder (newcomers, the leaving, the homeless), bent under it.
  bundle: {
    dur: 0.8, fps: 30, walk: true, stride: WALKER_STRIDE,
    pose(P, t) {
      strideLegs(P, t, 0.07);
      walkArms(P, t, [-1], 1.15);
      P.prop(1, 0, 1.2, -0.17, 0.12, 0, 0, { chest: true });
      P.hand(1, 0.1, 1.26, 0.14, { chest: true, pole: [0.5, -0.85, 0.1] });
      P.rot('handL', 0.4, 0, 0.9);
      fingers(P, 1, 0.95);
    },
  },
  // Leading an animal on a rope: the right hand a little behind him at LEAD_HAND, the left arm swinging.
  lead: {
    dur: 0.8, fps: 30, walk: true, stride: WALKER_STRIDE,
    pose(P, t) {
      strideLegs(P, t, 0.04);
      walkArms(P, t, [1], 1.2);
      P.hand(-1, LEAD_HAND[0], LEAD_HAND[1] + 0.015 * sn(t, 2), LEAD_HAND[2] + 0.02 * sn(t, 1, 0.25), { pole: [-0.5, -0.3, -0.8] });
      P.rot('handR', -0.3, 0, -0.4);
      fingers(P, -1, 0.95);
      // A look back at the beast now and then.
      P.rot('head', 0, -0.25 * Math.max(0, hold(t, 1, 0.2, 3)), 0);
    },
  },
  // A recruit marching: the spear upright in his right hand, the shield on his left arm, the arms held, not swung.
  march: {
    dur: 0.8, fps: 30, walk: true, stride: WALKER_STRIDE,
    pose(P, t) {
      strideLegs(P, t, 0);
      P.prop(-1, -0.25, 1.3, 0.16, 0.12, 0, 0);
      P.hand(-1, -0.24, 1.26, 0.13, { pole: [-0.6, -0.7, -0.3] });
      P.rot('handR', 0, 0, -1.4);
      fingers(P, -1, 0.95);
      P.prop(1, 0.31, 0.92, 0.02, 0, 1.25, 0, { chest: true });
      P.hand(1, 0.27, 0.9, 0.02, { chest: true, pole: [0.8, -0.5, -0.3] });
      P.rot('handL', 0, 0, 1.2);
      fingers(P, 1, 0.9);
    },
  },
  // Walking with something held up high in the right hand (a rioter's torch, a protester's placard), shaking it.
  brandish: {
    dur: 0.8, fps: 30, walk: true, stride: WALKER_STRIDE,
    pose(P, t) {
      strideLegs(P, t, 0.02);
      walkArms(P, t, [1], 1.2);
      const at = [-0.2, 1.62 + 0.06 * sn(t, 2), 0.14 + 0.04 * sn(t, 2, 0.25)];
      P.prop(-1, ...at, 0.1 * sn(t, 2, 0.1), 0, -0.12, { chest: true });
      P.hand(-1, at[0], at[1] - 0.06, at[2] - 0.02, { chest: true, pole: [-0.9, -0.15, -0.3] });
      fingers(P, -1, 0.95);
    },
  },
  // A load on the left shoulder at the walkers' stride (a measuring rod, a towel, a thief's sack, a plank).
  haul: {
    dur: 0.8, fps: 30, walk: true, stride: WALKER_STRIDE,
    pose(P, t) {
      strideLegs(P, t, 0.02);
      walkArms(P, t, [-1], 1.2);
      P.rot('spine', 0, 0, 0.05);
      P.prop(1, 0.11, 1.5, -0.03, 0, 0.1, 0.25, { chest: true });
      P.hand(1, 0.2, 1.53, 0.1, { chest: true, pole: [0.8, -0.6, 0] });
      P.rot('handL', 0, 0, 0.6);
      fingers(P, 1, 0.6);
      P.rot('head', 0, 0, -0.08);
    },
  },
  // Throwing water from a bucket at a fire before him: swung back, then up and forward and emptied, brought back.
  douse: {
    dur: 1.6, fps: 20,
    pose(P, t) {
      stand(P, t, { shift: 0.3, ph: 0.7, look: 0, lean: 0.05 });
      const k = track(t, [[0, 0], [0.28, -1], [0.48, 1], [0.6, 1], [0.84, 0]]);
      const rest = [0, 0.9, 0.32];
      const at = k < 0 ? lerp3(rest, [0, 0.95, 0.15], -k) : lerp3(rest, [0, 1.28, 0.42], k);
      P.prop(-1, at[0], at[1], at[2], -1.7 * Math.max(0, k), 0, 0);
      for (const s of [1, -1]) {
        P.hand(s, at[0] + s * 0.08, at[1] + 0.05, at[2] - 0.02, { pole: [s * 0.6, -0.6, -0.4] });
        P.rot(s > 0 ? 'handL' : 'handR', 0.4, 0, s * 0.6);
        fingers(P, s, 0.9);
      }
      P.rot('spine', 0.12 * k, 0, 0);
      P.rot('neck', 0.1, 0, 0);
    },
  },
  // Protesting in the street: the placard (or a torch) raised and shaken, the left fist too, shouting.
  protest: {
    dur: 2.4, fps: 15,
    pose(P, t) {
      stand(P, t, { shift: 0.8, ph: 0.2, look: 0.5 });
      const up = 0.5 + 0.5 * sn(t, 3);
      const at = [-0.16, 1.6 + 0.16 * up, 0.17];
      P.prop(-1, ...at, 0.12 * sn(t, 3, 0.2), 0, 0.1 * sn(t, 3), { chest: true });
      P.hand(-1, at[0], at[1] - 0.06, at[2] - 0.02, { chest: true, pole: [-0.9, -0.2, -0.3] });
      fingers(P, -1, 0.95);
      P.hand(1, 0.2, 1.28 + 0.16 * (0.5 + 0.5 * sn(t, 3, 0.5)), 0.24, { chest: true, pole: [0.8, -0.5, -0.3] });
      fingers(P, 1, 1);
      P.rot('neck', -0.12, 0, 0);
      P.rot('head', -0.1 + 0.06 * sn(t, 6), 0, 0);
    },
  },
  // Driving a racing chariot: braced on its floor, knees bent, leaning in, the reins in both hands, swaying with the car.
  drive: {
    dur: 2, fps: 12,
    pose(P, t) {
      P.root(0.02 * sn(t, 1), -0.09 + 0.02 * sn(t, 4), 0, 0.2, 0.04 * sn(t, 1, 0.3), 0.03 * sn(t, 1));
      P.rot('spine', 0.1, 0, 0.02 * sn(t, 2));
      for (const s of [1, -1]) P.foot(s, s * 0.15, 0.085, s > 0 ? 0.14 : -0.1, 0, s * 0.25);
      for (const s of [1, -1]) {
        P.hand(s, s * 0.11, 1.08 + 0.03 * sn(t, 4, s > 0 ? 0 : 0.2), 0.46, { pole: [s * 0.6, -0.6, -0.4] });
        P.rot(s > 0 ? 'handL' : 'handR', 0.3, 0, s * 0.5);
        fingers(P, s, 1);
      }
      P.rot('neck', -0.16, 0, 0);
      P.rot('head', -0.04, 0.08 * sn(t, 1, 0.1), 0);
    },
  },
  // Rowing at a frame (ROW), the oar out on his left: the catch, the drive leaning back, the blade out and
  // feathered, the recovery swinging forward. Its loop is the hortator's stroke (beat).
  row: { dur: 2.4, fps: 15, pose(P, t) { rowPose(P, t, 1); } },
  // The same with the oar out on his right (the frame's other side).
  rowRight: { dur: 2.4, fps: 15, pose(P, t) { rowPose(P, t, -1); } },
  // The hortator beating the stroke with his mallet on his block (BEAT), on the catch.
  beat: {
    dur: 2.4, fps: 15,
    pose(P, t) {
      stand(P, t, { shift: 0.3, ph: 0.2, look: 0.25, lean: 0.06 });
      // The mallet (props.js hammer: its head 0.22 along the grip's +x) raised slowly, brought down on the catch.
      const lift = track(t, [[0, 0], [0.07, 0], [0.18, 0.22], [0.5, 0.3], [0.82, 1.2], [0.92, 1.3]]);
      const g = [BEAT.side - 0.1 * lift, BEAT.height + 0.05 + 0.3 * lift, BEAT.ahead - 0.22 - 0.12 * lift];
      P.prop(-1, g[0], g[1], g[2], 0, -Math.PI / 2, lift);
      P.hand(-1, g[0], g[1] - 0.01, g[2] - 0.02, { pole: [-0.8, -0.4, -0.4] });
      P.rot('handR', 0, 0, -0.3 - 0.3 * lift);
      fingers(P, -1, 0.95);
      // The left hand on his hip, the head nodding the beat.
      P.hand(1, 0.25, 0.98, 0.02, { pole: [1, 0, -0.3] });
      P.rot('handL', 0, 0, 0.6);
      fingers(P, 1, 0.5);
      P.rot('spine', 0.06 * (1 - lift), -0.08, 0);
      P.rot('head', 0.08 * Math.max(0, cs(t, 1)) ** 4, 0, 0);
    },
  },
  // Drill at the post (palus), as Vegetius has the recruits do it: the shield up, a thrust of the
  // sword from behind it, back to guard, a punch with the shield's boss, the weight on the bent knees.
  drill: {
    dur: 2.4, fps: 20,
    pose(P, t) {
      const thrust = track(t, [[0, 0], [0.12, 0], [0.22, 1], [0.32, 1], [0.46, 0]]);
      const punch = track(t, [[0, 0], [0.58, 0], [0.66, 1], [0.72, 1], [0.86, 0]]);
      const bob = 0.012 * sn(t, 2);
      P.root(0.01, -0.07 + bob, 0.03 * thrust, 0.12 + 0.1 * thrust, -0.3 + 0.12 * thrust - 0.08 * punch, 0);
      P.rot('spine', 0.06 + 0.06 * thrust, 0.06 * thrust - 0.08 * punch, 0);
      P.rot('chest', 0.02, 0.12 * thrust - 0.06 * punch, 0);
      // The left foot forward, the right back, turned out: a fighting stance.
      P.foot(1, 0.1, 0.085, 0.24, 0, 0.2, { pole: [0.2, 0, 1] });
      P.foot(-1, -0.16, 0.085, -0.2, 0, -0.45, { pole: [-0.3, 0, 1] });
      // The shield before him (props.js scutum: its face +z, the grip behind the boss), turned to cover his right.
      const sh = [0.12 + 0.02 * punch, 1.0 + 0.04 * punch, 0.3 + 0.16 * punch];
      P.prop(1, sh[0], sh[1], sh[2], 0, -0.4 + 0.1 * punch, 0);
      P.hand(1, sh[0], sh[1] - 0.01, sh[2] - 0.03, { pole: [0.9, -0.4, -0.2] });
      P.rot('handL', 0, 0, 1.3);
      fingers(P, 1, 0.95);
      // The sword: low at the hip, point forward; thrust out past the shield's edge.
      const grip = [lerp(-0.2, -0.1, thrust), lerp(1.0, 1.1, thrust), lerp(0.16, 0.58, thrust)];
      const tip = [grip[0] + lerp(0.12, 0.02, thrust), grip[1] + lerp(0.12, 0.03, thrust), grip[2] + 0.5];
      propAlong(P, -1, grip, tip, -Math.PI / 2);
      P.hand(-1, grip[0], grip[1], grip[2] - 0.02, { pole: [-0.7, -0.6, -0.3] });
      P.rot('handR', 0, 0, -1.2);
      fingers(P, -1, 0.95);
      // The eyes on the post over the shield's rim.
      P.rot('neck', 0.05, 0.25 - 0.1 * thrust, 0);
      P.rot('head', -0.05, 0.2 - 0.05 * thrust, 0);
    },
  },
  // A barber shaving a seated client (SHAVE: his head before the barber): the left hand holding the head,
  // short strokes of the razor down the cheek, the blade wiped on the cloth over his forearm.
  shave: {
    dur: 4, fps: 12,
    pose(P, t) {
      stand(P, t, { shift: 0.4, ph: 0.7, look: 0, lean: 0.14 });
      const [hx, hy, hz] = SHAVE.head;
      P.hand(1, hx + 0.08, hy + 0.04, hz + 0.06, { pole: [0.9, 0.1, -0.4] });
      P.rot('handL', 0.4, 0, -0.5);
      fingers(P, 1, 0.3);
      // Three strokes, each down the cheek and off it, then a wipe toward the left arm.
      const wipe = track(t, [[0, 0], [0.72, 0], [0.8, 1], [0.9, 1], [0.97, 0]]);
      const k = (t * 4) % 1;
      const down = k < 0.6 ? smooth(k / 0.6) : 1 - smooth((k - 0.6) / 0.4);
      const off = k < 0.6 ? 0 : Math.sin(Math.PI * (k - 0.6) / 0.4);
      const stroke = [hx - 0.06 - 0.03 * off, hy + 0.02 - 0.09 * down, hz - 0.08 - 0.03 * off];
      const at = stroke.map((v, i) => lerp(v, [0.08, 1.06, 0.22][i], wipe));
      P.prop(-1, at[0], at[1], at[2], 0.3, 0, -0.9);
      P.hand(-1, at[0] - 0.01, at[1] - 0.04, at[2] - 0.01, { pole: [-0.8, -0.5, -0.3] });
      P.rot('handR', 0.3, 0, -0.7);
      fingers(P, -1, 0.7);
      P.rot('neck', 0.3, 0.05, 0);
      P.rot('head', 0.25, 0.05, 0);
    },
  },
  // The barber's client: seated, his head tipped back for the razor, still but for his breath.
  shaved: {
    dur: 10, fps: 4,
    pose(P, t) {
      sit(P, t, { ph: 0.3, lean: -0.08, look: 0 });
      P.rot('neck', -0.22, 0, 0);
      P.rot('head', -0.25, 0.04 * sn(t, 1), 0);
      for (const s of [1, -1]) {
        P.hand(s, s * 0.14, 0.62, 0.3, { pole: [s * 0.5, -0.4, -0.6] });
        P.rot(s > 0 ? 'handL' : 'handR', 0.9, 0, s * 0.2);
        fingers(P, s, 0.5);
      }
    },
  },
  // Grinding a remedy at a mortar on a table (MORTAR): the pestle round and round, the other hand on the rim.
  stir: {
    dur: 3, fps: 12,
    pose(P, t) {
      stand(P, t, { shift: 0.3, ph: 0.55, look: 0.1, lean: 0.18 });
      const a = TAU * 2 * t;
      const { ahead, height } = MORTAR;
      const head = [-0.02 + 0.025 * Math.cos(a), height - 0.06, ahead + 0.025 * Math.sin(a)];
      const grip = [-0.04 + 0.05 * Math.cos(a), height + 0.09, ahead - 0.04 + 0.05 * Math.sin(a)];
      // (The pestle's head is -y of its bone: aim the bone's +y away from the head.)
      propAlong(P, -1, grip, [2 * grip[0] - head[0], 2 * grip[1] - head[1], 2 * grip[2] - head[2]]);
      P.hand(-1, grip[0], grip[1] + 0.01, grip[2], { pole: [-0.8, -0.4, -0.4] });
      P.rot('handR', 0, 0, -1.3);
      fingers(P, -1, 0.9);
      P.hand(1, 0.1, height + 0.02, ahead - 0.02, { pole: [0.7, -0.6, -0.3] });
      P.rot('handL', 0.4, 0, 0.9);
      fingers(P, 1, 0.6);
      P.rot('chest', 0, 0.04 * Math.cos(a), 0);
      P.rot('neck', 0.3, 0, 0);
      P.rot('head', 0.2, 0, 0);
    },
  },
  // Dining reclined on a couch (DINE) on the left elbow, as the Romans did: the cup in the left hand,
  // the right reaching to the table and back, a drink now and then, the head turned to talk.
  dine: {
    dur: 10, fps: 6,
    pose(P, t) {
      const top = DINE.top;
      // (The hips on their left side on the couch, the trunk propped up on the elbow.)
      P.root(0, top + 0.13 - 0.95, -0.28, 0, 0, -1.38);
      P.rot('spine', 0.04, 0, 0.5 + 0.01 * sn(t, 3));
      P.rot('chest', 0.0, 0.1 * sn(t, 1, 0.2), 0.38 + 0.01 * sn(t, 3));
      // The legs along the couch to his right, the upper one drawn up.
      P.foot(1, -DINE.feet, top + 0.07, -0.3, 0.4, 0.4, { pole: [0, 0, 1] });
      P.foot(-1, -DINE.feet + 0.14, top + 0.16, -0.1, 0.4, 0.4, { pole: [0, 0.3, 1] });
      // The left forearm up from the elbow on its cushion, the cup in hand; to the lips at 0.62.
      const drink = track(t, [[0, 0], [0.56, 0], [0.64, 1], [0.74, 1], [0.82, 0]]);
      const cup = [lerp(0.4, 0.4, drink), lerp(top + 0.4, top + 0.6, drink), lerp(0.08, 0.06, drink)];
      P.prop(1, cup[0], cup[1], cup[2], 0, 0, -0.9 * drink);
      P.hand(1, cup[0] + 0.02, cup[1] - 0.04, cup[2] - 0.02, { pole: [0.2, -1, 0.1] });
      P.rot('handL', 0, 0, 0.9);
      fingers(P, 1, 0.75);
      // The right hand: on his hip, out to the table (before the couch), back with a morsel to his mouth.
      const reach = track(t, [[0, 0], [0.12, 0], [0.24, 1], [0.32, 1], [0.42, 0.5], [0.46, 0.5], [0.52, 0]]);
      const eat = track(t, [[0, 0], [0.38, 0], [0.43, 1], [0.47, 1], [0.53, 0]]);
      const rest = [0.06, top + 0.38, 0.08];
      const table = [0.2, top + 0.12, 0.55];
      const mouth = [0.38, top + 0.58, 0.14];
      const h = rest.map((v, i) => lerp(lerp(v, table[i], reach), mouth[i], eat));
      P.hand(-1, ...h, { pole: [-0.3, -0.6, -0.6] });
      P.rot('handR', 0.5, 0, -0.5);
      fingers(P, -1, 0.5);
      // The head held level over the slanting trunk, turning to a neighbour and to the table.
      P.rot('neck', 0.05, 0.2 * hold(t, 1, 0.1, 2), -0.38);
      P.rot('head', 0.05 + 0.15 * reach, 0.25 * hold(t, 1, 0.1, 2), -0.22);
    },
  },
  // A sentry's walk on his round (a route): the spear upright at his right, the shield on his left arm.
  patrol: {
    dur: WALK_DUR, fps: 30, walk: true,
    pose(P, t) {
      walkLegs(P, t);
      const sw = 0.02 * sn(t, 1, 0.25);
      P.prop(-1, -0.27, 1.12 + 0.01 * sn(t, 2), 0.1 + sw, 0.06, 0, 0);
      P.hand(-1, -0.27, 1.1 + 0.01 * sn(t, 2), 0.08 + sw, { pole: [-0.6, -0.7, -0.3] });
      P.rot('handR', 0, 0, -1.4);
      fingers(P, -1, 0.95);
      P.prop(1, 0.28, 0.9, 0.05, 0, 0.4, 0);
      P.hand(1, 0.26, 0.88, 0.03, { pole: [0.7, -0.6, -0.3] });
      P.rot('handL', 0, 0, 1.2);
      fingers(P, 1, 0.9);
    },
  },
  // An archer shooting (the composite bow on his left hand, the arrow on the string, propR): nock, draw to
  // the jaw, hold, loose, the hand back to the quiver at his hip and up with the next. He shoots along +z.
  shoot: {
    dur: 5, fps: 14,
    pose(P, t) {
      // (Turned side on: the left shoulder to the mark, the feet across the line.)
      const draw = track(t, [[0, 0], [0.06, 0], [0.32, 1], [0.54, 1], [0.545, 0], [0.98, 0]]);
      const quiver = track(t, [[0, 0], [0.6, 0], [0.7, 1], [0.78, 1], [0.9, 0]]);
      const bowUp = track(t, [[0, 1], [0.6, 1], [0.68, 0.25], [0.86, 0.25], [0.95, 1]]);
      P.root(0, -0.015, 0, 0.02, -1.25, 0.01 * sn(t, 1));
      P.rot('spine', 0.02, 0.06 * draw, -0.03);
      P.rot('chest', 0, 0.1 * draw, 0);
      P.foot(1, 0.02, 0.085, 0.17, 0, -1.0);
      P.foot(-1, -0.04, 0.085, -0.2, 0, -1.2);
      // The bow arm out to the mark at the shoulder's height (lowered while the next arrow comes).
      const bow = [0.06, lerp(1.0, 1.38, bowUp), lerp(0.35, 0.62, bowUp)];
      P.prop(1, bow[0], bow[1], bow[2], -0.3 * (1 - bowUp), 0, 0.12);
      P.hand(1, bow[0] + 0.01, bow[1] - 0.02, bow[2] - 0.01, { pole: [0.3, -1, 0] });
      P.rot('handL', 0, 0, 1.2);
      fingers(P, 1, 0.95);
      // The string's nock (propR): at rest on the bow, drawn to the jaw; the arrow on it till it is loosed.
      // (The string at rest in the bow's own frame, BOW.brace behind the grip, turned with the bow's tilt.)
      const tilt = -0.3 * (1 - bowUp);
      const rest = [bow[0], bow[1] + BOW.brace * Math.sin(tilt), bow[2] - BOW.brace * Math.cos(tilt)];
      const anchor = [0.0, 1.47, 0.05];
      const nock = rest.map((v, i) => lerp(v, anchor[i], draw));
      const shown = t < 0.545 ? 1 : t > 0.93 ? 1 : 0.001;
      P.prop(-1, nock[0], nock[1], nock[2], -0.3 * (1 - bowUp), 0, 0, { scale: shown });
      // The drawing hand: on the nock, then back past the ear, down to the quiver, up to the string.
      const ear = [-0.04, 1.52, -0.08];
      const hip = [-0.22, 0.98, -0.12];
      let h = nock;
      if (t >= 0.545 && t < 0.6) h = anchor.map((v, i) => lerp(v, ear[i], smooth((t - 0.545) / 0.055)));
      else if (t >= 0.6 && t < 0.74) h = ear.map((v, i) => lerp(v, hip[i], quiver));
      else if (t >= 0.74) h = nock.map((v, i) => lerp(v, hip[i], quiver));
      P.hand(-1, h[0], h[1] - 0.02, h[2] - 0.03, { pole: [-1, 0.25, -0.2] });
      P.rot('handR', 0.2, 0, -0.6);
      fingers(P, -1, 0.65);
      // The head turned to the mark down the arrow.
      P.rot('neck', 0.02, 0.55, 0);
      P.rot('head', 0.04, 0.6, 0.06 * draw);
    },
  },
  // Turning a windlass (WINDLASS) by its crank, both hands on the handle, the body rocking into each turn.
  windlass: {
    dur: 3, fps: 15,
    pose(P, t) {
      const a = TAU * 2 * t;
      const { ahead, height, arm, x } = WINDLASS;
      const hz = ahead + arm * Math.sin(a);
      const hy = height + arm * Math.cos(a);
      const push = Math.sin(a);
      const low = 0.5 - 0.5 * Math.cos(a);
      P.root(0, -0.03 - 0.07 * low, 0.07 * push + 0.04 * low, 0.1 + 0.14 * push + 0.2 * low, 0, 0);
      P.rot('spine', 0.06 + 0.08 * push + 0.15 * low, 0, 0);
      P.foot(1, 0.13, 0.085, 0.16, 0, 0.15);
      P.foot(-1, -0.14, 0.085, -0.14, 0, -0.25);
      // The crank's arm along the bone's +y: turned about the axle (x) by the angle.
      P.prop(-1, x, height, ahead, a, 0, 0);
      for (const s of [1, -1]) {
        P.hand(s, s > 0 ? x - 0.1 : x - 0.3, hy + 0.01, hz - 0.03, { pole: [s * 0.6, -0.7, -0.3] });
        P.rot(s > 0 ? 'handL' : 'handR', 0.3, 0, s * 1.3);
        fingers(P, s, 0.95);
      }
      P.rot('neck', 0.15, 0, 0);
      P.rot('head', 0.1, 0, 0);
    },
  },
  // A gardener clipping a hedge before him with spring shears, along it and back, the other hand on top.
  prune: {
    dur: 4, fps: 10,
    pose(P, t) {
      stand(P, t, { shift: 0.4, ph: 0.25, look: 0.05, lean: 0.12 });
      const along = 0.16 * sn(t, 1);
      const snip = 0.5 + 0.5 * sn(t, 8);
      const grip = [-0.08 + along, 1.0 + 0.06 * sn(t, 2, 0.2), 0.42];
      propAlong(P, -1, grip, [grip[0] - 0.05, grip[1] + 0.03, grip[2] + 0.5], 0.2 * snip);
      P.hand(-1, grip[0], grip[1] - 0.01, grip[2] - 0.02, { pole: [-0.8, -0.5, -0.3] });
      P.rot('handR', 0.2 * snip, 0, -1.2);
      fingers(P, -1, 0.7 + 0.25 * snip);
      P.hand(1, 0.16 + along * 0.6, 1.06, 0.4, { pole: [0.7, -0.6, -0.3] });
      P.rot('handL', 0.9, 0, 0.3);
      fingers(P, 1, 0.3);
      P.rot('chest', 0, 0.2 * along, 0);
      P.rot('neck', 0.25, along, 0);
    },
  },
  // A librarian at his cupboard (SHELF): a roll taken down from the shelf, its tag read, put back.
  reach: {
    dur: 8, fps: 8,
    pose(P, t) {
      stand(P, t, { shift: 0.6, ph: 0.85, look: 0.15 });
      armsDown(P, t, [1]);
      const up = track(t, [[0, 0.3], [0.1, 1], [0.24, 1], [0.36, 0], [0.7, 0], [0.82, 1], [0.92, 1]]);
      const shelf = [-0.06, SHELF.height - 0.05, SHELF.ahead];
      const look = [-0.08, 1.2, 0.3];
      const h = look.map((v, i) => lerp(v, shelf[i], up));
      P.prop(-1, h[0] + 0.01, h[1] + 0.02, h[2] + 0.02, 0, 0, 0);
      P.hand(-1, h[0], h[1], h[2], { pole: [-0.8, -0.4, -0.4] });
      P.rot('handR', 0.3, 0, -1.1);
      fingers(P, -1, 0.85);
      P.rot('neck', 0.15 - 0.45 * up, 0, 0);
      P.rot('head', 0.2 - 0.25 * up, -0.05, 0);
    },
  },
  // Lying abed on his back (a patient, a sleeper): the actor's place is the mattress's top under the middle
  // of his length, his head toward -z (behind the facing) raised on a pillow, his face up. He breathes,
  // turns his head on the pillow now and then, and lifts a hand to his brow and back (a fever).
  lie: {
    dur: 12, fps: 3,
    pose(P, t) {
      // (The hips' joint 0.1 over the mattress, a hand toward the head from the middle; laid back a quarter turn.)
      P.root(0, 0.1 - 0.95, -0.1, -Math.PI / 2 + 0.006 * sn(t, 4), 0, 0);
      P.rot('chest', 0.012 * sn(t, 4), 0, 0);
      for (const s of [1, -1]) {
        const k = s > 0 ? 'L' : 'R';
        // The legs straight and a little apart, the feet fallen outward, toes down.
        P.rot(`thigh${k}`, -0.06, 0, s * 0.05);
        P.rot(`shin${k}`, 0.1, 0, 0);
        P.rot(`foot${k}`, 0.85, s * 0.3, 0);
      }
      // The head on the pillow (raised by the neck's bend), turning to one side and the other, held.
      const yaw = 0.45 * hold(t, 1, 0.15, 2);
      P.rot('neck', 0.38, yaw * 0.3, 0);
      P.rot('head', 0.12, yaw * 0.7, 0);
      // The hands on the cover over his chest; the right up to his brow and back.
      const brow = track(t, [[0, 0], [0.55, 0], [0.63, 1], [0.78, 1], [0.86, 0]]);
      P.hand(1, 0.15, 0.33, -0.2, { pole: [0.6, -0.8, 0] });
      const rest = [-0.13, 0.33, -0.28];
      const up = [-0.05, 0.3, -0.66];
      P.hand(-1, ...rest.map((v, i) => lerp(v, up[i], brow)), { pole: [-0.7, -0.6, 0] });
      P.rot('handL', 0, 0, 0.3);
      P.rot('handR', 0.4 * brow, 0, -0.3);
      fingers(P, 1, 0.4);
      fingers(P, -1, 0.4);
    },
  },

  // --- The fighting men's clips (render3d/units/clips.js), made with these helpers, appended last.
  ...unitClips({ sn, cs, hold, smooth, lerp, lerp3, clamp01, track, stand, armsDown, fingers, propAlong, along, walkLegs, walkArms, strideLegs, runLegs, WALKER_STRIDE, RUN_STRIDE }),

  // The ships' rowers (ships/: the liburnian's and the raiders' benches, a fishing boat's oars): rowing at a
  // ship's bench (ROW_SHIP), the sweep out on his left, and on his right. Their loop is the ship's stroke,
  // its clock the ship's own (the distance it rows), so every bench pulls together.
  rowShip: { dur: 2.4, fps: 15, pose(P, t) { rowShipPose(P, t, 1); } },
  rowShipRight: { dur: 2.4, fps: 15, pose(P, t) { rowShipPose(P, t, -1); } },
  // Hauling a line hand over hand (HAUL): a fisherman's net over the side, a sailor's sheet.
  haulLine: { dur: 2.4, fps: 15, pose(P, t) { haulPose(P, t); } },

  // --- The native villages' work at home (models/villages.js), after the record of Iron Age Italy's
  // hill villages: the saddle quern, the drop spindle and its clay whorl, the hoe of the hill plots.

  // Grinding grain on a saddle quern (QUERN): kneeling behind it, sitting back on her heels between strokes,
  // both hands on the upper stone, pushed away along the lower stone with her weight behind it and drawn back.
  grind: {
    dur: 2.6, fps: 24,
    pose(P, t) { grindPose(P, t); },
  },
  // Spinning with a drop spindle: the distaff of combed wool in the crook of the left arm, the right hand
  // drawing out the fibre and giving the spindle a twirl now and then; the spindle turns on its thread.
  spin: {
    dur: 6, fps: 15,
    pose(P, t) { spinPose(P, t); },
  },
  // Hoeing a plot: the blade raised, brought down into the soil ahead, drawn back toward the feet, a step
  // of the weight between strokes.
  hoe: {
    dur: 1.8, fps: 24,
    pose(P, t) { hoePose(P, t); },
  },
  // Sounding a war horn: raised to the lips in both hands, the bell lifted high through a long blast,
  // lowered, a breath taken, raised again.
  horn: {
    dur: 5, fps: 20,
    pose(P, t) { hornPose(P, t); },
  },
  // Walking with a water jar on the head, the left hand steadying it (on a route: from the spring and back).
  jarCarry: {
    dur: WALK_DUR, fps: 40, walk: true,
    pose(P, t) {
      walkLegs(P, t);
      walkArms(P, t, [-1]);
      jarOnHead(P, t);
    },
  },
  // Standing with the jar on the head (a route's pauses), looking about.
  jarStand: {
    dur: 10, fps: 12,
    pose(P, t) {
      stand(P, t, { shift: 0.7, ph: 0.3, look: 0.5 });
      armsDown(P, t, [-1]);
      jarOnHead(P, t);
    },
  },
  // Squatting on the heels (a child at play with pebbles in the dust, a woman feeding a fire): the right
  // hand picking up and setting down, the left on the knee.
  play: {
    dur: 6, fps: 12,
    pose(P, t) { playPose(P, t); },
  },
  // Seated and talking (the elders round the fire): the hands making their points over the knees.
  sitTalk: {
    dur: 8, fps: 12,
    pose(P, t) {
      sit(P, t, { ph: 0.35, lean: 0.14, look: 0.5 });
      const r = track(t, [[0, [-0.16, 0.86, 0.3]], [0.15, [-0.2, 0.98, 0.36]], [0.3, [-0.14, 0.9, 0.32]], [0.46, [-0.22, 1.02, 0.34]], [0.6, [-0.15, 0.8, 0.28]], [0.8, [-0.18, 0.84, 0.3]]]);
      P.hand(-1, ...r, { chest: true, pole: [-0.7, -0.5, -0.4] });
      P.rot('handR', 0.3, 0.2 * sn(t, 3), -0.5 + 0.2 * sn(t, 2));
      fingers(P, -1, 0.25);
      P.hand(1, 0.15, 0.72, 0.3, { chest: true, pole: [0.6, -0.4, -0.5] });
      P.rot('handL', 0.6, 0, 0.6);
      fingers(P, 1, 0.5);
      P.rot('head', 0.05 * sn(t, 5), 0.12 * sn(t, 2, 0.15), 0.03 * sn(t, 3));
    },
  },
  // Leaning on a staff planted before him (a herdsman watching his flock): both hands on its top, the weight
  // shifting, looking about.
  lean: {
    dur: 12, fps: 12,
    pose(P, t) {
      stand(P, t, { shift: 0.9, ph: 0.6, look: 1.2, lean: 0.06 });
      const top = [-0.04, 1.16, 0.34];
      const foot = [-0.1, 0.0, 0.5];
      propAlong(P, -1, top, [2 * top[0] - foot[0], 2 * top[1] - foot[1], 2 * top[2] - foot[2]]);
      P.hand(-1, top[0] - 0.01, top[1] + 0.02, top[2] - 0.03, { pole: [-0.7, -0.6, -0.2] });
      P.hand(1, top[0] + 0.07, top[1] + 0.07, top[2] - 0.04, { pole: [0.7, -0.6, -0.2] });
      P.rot('handR', 0.3, 0, -1.2);
      P.rot('handL', 0.3, 0, 1.2);
      fingers(P, -1, 0.95);
      fingers(P, 1, 0.8);
    },
  },
});

/**
 * A ship's rower's stroke (ROW_SHIP), the oar on side `so` (+1 his left):
 * rowPose's stroke at a ship's bench, the thole close over the seat and the
 * long sweep steeply down into the water through the drive (the handle at
 * his chest), the handle pressed down to the knees at the finish so the
 * blade comes out and rides clear over the water through the recovery.
 */
function rowShipPose(P, t, so) {
  const a = track(t, [[0, 0.5], [0.08, 0.46], [0.42, -0.4], [0.5, -0.42], [0.62, -0.28], [0.92, 0.5], [0.97, 0.51]]);
  const q = track(t, [[0, ROW_SHIP.dip], [0.42, ROW_SHIP.dip], [0.5, ROW_SHIP.lift], [0.9, ROW_SHIP.lift], [0.97, ROW_SHIP.dip]]);
  const feather = track(t, [[0, 0], [0.44, 0], [0.52, 1], [0.88, 1], [0.95, 0]]);
  const lean = track(t, [[0, 0.4], [0.08, 0.36], [0.42, -0.25], [0.5, -0.22], [0.62, -0.05], [0.92, 0.4]]);
  P.root(0, ROW_SHIP.seat + 0.1 - 0.95, -0.03, lean * 0.55, 0, 0);
  P.rot('spine', 0.04 + lean * 0.35, 0, 0);
  P.rot('chest', lean * 0.15, -so * 0.07, 0);
  for (const s of [1, -1]) P.foot(s, s * 0.13, 0.11, ROW_SHIP.brace, -0.35, s * 0.1, { pole: [s * 0.1, 1, 0.6] });
  const thole = [so * ROW_SHIP.out, ROW_SHIP.up, ROW_SHIP.ahead];
  const L = ROW_SHIP.inboard;
  const handle = [thole[0] - so * L * Math.cos(a) * Math.cos(q), thole[1] + L * Math.sin(q), thole[2] + L * Math.sin(a) * Math.cos(q)];
  propAlong(P, -1, handle, thole, so * (Math.PI / 2) * (1 - feather));
  const inner = along(handle, thole, 0.04);
  const outer = along(handle, thole, 0.26);
  const hi = so > 0 ? -1 : 1;
  P.hand(hi, inner[0], inner[1] - 0.02, inner[2] - 0.03, { pole: [hi * 0.7, -0.6, -0.3] });
  P.hand(-hi, outer[0], outer[1] - 0.02, outer[2] - 0.03, { pole: [-hi * 0.7, -0.6, -0.3] });
  for (const s of [1, -1]) {
    P.rot(s > 0 ? 'handL' : 'handR', 0, 0, s * 1.3);
    fingers(P, s, 0.95);
  }
  P.rot('neck', -0.1 * lean, 0, 0);
  P.rot('head', -0.15 * lean, 0, 0);
}

/**
 * Hauling a line hand over hand (HAUL): braced, leaning over it, each hand in
 * turn reaching out and down along the line to `reach`, gripping and pulling
 * it in to the chest, the body rocking back with each pull. A fisherman
 * hauling his net over the side, a sailor sweating up a sheet.
 */
function haulPose(P, t) {
  stand(P, t, { shift: 0.2, ph: 0.4, look: 0.15, lean: 0.22, feet: 0.16 });
  // Two pulls a loop, one a hand.
  const rock = 0.5 + 0.5 * cs(t, 2);
  P.rot('spine', 0.16 + 0.12 * rock, 0, 0);
  P.rot('chest', 0.05 * rock, 0, 0);
  for (const s of [1, -1]) {
    const ph = s > 0 ? 0 : 0.5;
    // Out along the line, then gripping and in: a saw of the hand between `reach` and the chest.
    const k = saw(((t + ph) % 1));
    const out = [s * 0.06, HAUL.reach[1], HAUL.reach[2]];
    const chest = [s * 0.12, 1.08, 0.24];
    P.hand(s, lerp(out[0], chest[0], k), lerp(out[1], chest[1], k), lerp(out[2], chest[2], k), { pole: [s * 0.8, -0.5, -0.3] });
    P.rot(s > 0 ? 'handL' : 'handR', 0.3, 0, s * 0.8);
    fingers(P, s, 0.5 + 0.45 * k);
  }
  P.rot('neck', 0.18, 0, 0);
  P.rot('head', 0.12, 0, 0);
}

/**
 * Kneeling at a saddle quern (QUERN): the knees on the ground under the hips,
 * the shins lying back, the feet's tops flat behind; the hips rise and the
 * body leans out over the quern as the upper stone is pushed away (with her
 * weight: the push is the slow, hard part), then sink back on the heels as it
 * is drawn back. Two strokes a loop.
 */
function grindPose(P, t) {
  const k = track(t, [[0, 0], [0.32, 1], [0.44, 1], [0.5, 0], [0.82, 1], [0.94, 1]]);
  const { ahead, height, travel } = QUERN;
  P.root(0, -0.43 + 0.09 * k, -0.06 + 0.12 * k, 0.5 + 0.22 * k, 0, 0);
  P.rot('spine', 0.26 + 0.1 * k, 0, 0);
  P.rot('chest', 0.1 + 0.04 * k + 0.01 * sn(t, 2), 0, 0);
  for (const s of [1, -1]) P.foot(s, s * 0.12, 0.11, -0.4, 2.15, s * 0.08, { pole: [s * 0.1, -0.2, 1] });
  // The upper stone along the lower one, under the hands (the stone lies across, along x).
  const z = ahead - travel / 2 + travel * k;
  const y = height + 0.004;
  P.prop(-1, 0, y, z, 0, 0, 0);
  for (const s of [1, -1]) {
    P.hand(s, s * 0.11, y + 0.07, z - 0.03, { pole: [s * 0.7, 0.1, -0.7] });
    P.rot(s > 0 ? 'handL' : 'handR', 0.5, 0, s * 1.35);
    fingers(P, s, 0.35);
  }
  P.rot('neck', 0.22, 0, 0);
  P.rot('head', 0.2 - 0.06 * k, 0.06 * sn(t, 1, 0.3), 0);
}

/**
 * Spinning with a drop spindle: the distaff held up in the left hand against
 * the shoulder, the right hand drawing fibre down from its wool and up again,
 * the spindle hanging from her fingers on its thread and turning (twelve turns
 * a loop: a whole number, so the loop has no seam).
 */
function spinPose(P, t) {
  stand(P, t, { shift: 0.6, ph: 0.2, look: 0.25 });
  // The distaff: its foot in the left hand at the waist, its head of wool over the left shoulder.
  const dFoot = [0.15, 1.0, 0.2];
  const dHead = [0.34, 1.6, 0.16];
  propAlong(P, 1, dFoot, dHead, 0, { chest: true });
  P.hand(1, dFoot[0] + 0.01, dFoot[1] + 0.02, dFoot[2], { chest: true, pole: [0.8, -0.5, -0.2] });
  P.rot('handL', 0.4, 0, 1.0);
  fingers(P, 1, 0.9);
  // The right hand: up to the wool, drawing the fibre down (slowly), a flick of the spindle at the bottom.
  const d = track(t, [[0, 0], [0.12, 0], [0.55, 1], [0.66, 1], [0.8, 0.4]]);
  const hand = [lerp(0.04, -0.12, d), lerp(1.42, 1.08, d), lerp(0.24, 0.3, d)];
  P.hand(-1, ...hand, { chest: true, pole: [-0.8, -0.5, -0.3] });
  P.rot('handR', 0.2, 0, -0.9);
  fingers(P, -1, 0.7);
  // The spindle hangs from the fingers (the prop's grip is its thread's top), turning about its thread.
  const turn = TAU * 12 * t;
  P.prop(-1, hand[0] - 0.01, hand[1] - 0.08, hand[2] + 0.02, 0, turn, 0, { chest: true });
  P.rot('neck', 0.18, 0, 0);
  P.rot('head', 0.12 - 0.08 * d, -0.08, 0);
}

/**
 * Hoeing: the left foot ahead, bent over the plot; the hoe's blade raised
 * before him, brought down to bite the soil ahead, drawn back toward the feet
 * and lifted, the hips rocking with each stroke.
 */
function hoePose(P, t) {
  const k = track(t, [[0, 0], [0.3, 1], [0.42, 1.35], [0.48, 1.35], [0.8, 0.4]]);
  // k: 0 the blade at the end of its draw, near the feet; 1 raised; 1.35 bitten in, far out.
  const raise = Math.max(0, Math.min(1, k)) * (k > 1 ? 1 - (k - 1) / 0.35 : 1);
  const out = k <= 1 ? lerp(0.42, 0.6, k) : lerp(0.6, 0.86, (k - 1) / 0.35);
  P.root(0.01 * sn(t, 1), -0.07 + 0.03 * raise, -0.04, 0.26 - 0.12 * raise, 0.05, 0);
  P.rot('spine', 0.22 - 0.1 * raise, 0, 0);
  P.rot('chest', 0.08 - 0.06 * raise, -0.05, 0);
  P.foot(1, 0.13, 0.085, 0.2, 0, 0.12, { pole: [0.1, 0, 1] });
  P.foot(-1, -0.14, 0.085, -0.18, 0, -0.25, { pole: [-0.1, 0, 1] });
  const blade = [0.02, 0.02 + 0.85 * raise, out];
  const top = [0.02, 0.92 + 0.32 * raise, 0.12 + 0.05 * raise];
  propAlong(P, -1, top, blade, 0);
  P.hand(1, ...along(top, blade, 0.02), { pole: [0.7, -0.6, -0.3] });
  P.hand(-1, ...along(top, blade, 0.42), { pole: [-0.7, -0.6, -0.3] });
  P.rot('handL', 0.3, 0, 1.3);
  P.rot('handR', 0.3, 0, -1.3);
  fingers(P, 1, 0.95);
  fingers(P, -1, 0.95);
  P.rot('neck', 0.25 - 0.1 * raise, 0, 0);
  P.rot('head', 0.22, 0, 0);
}

/**
 * The war horn: lifted in both hands to the lips, its bell raised high through
 * the blast (the chest swelling, the body leaning back a little), lowered to
 * the chest for a breath, then raised again.
 */
function hornPose(P, t) {
  stand(P, t, { shift: 0.4, ph: 0.15, look: 0, feet: 0.13 });
  const up = track(t, [[0, 0], [0.12, 1], [0.62, 1], [0.74, 0], [0.95, 0]]);
  const blast = up * (0.6 + 0.4 * sn(t, 6) ** 2);
  P.rot('spine', -0.08 * up, 0, 0);
  P.rot('chest', -0.06 * blast, 0, 0);
  P.rot('neck', -0.12 * up, 0, 0);
  P.rot('head', -0.25 * up, 0, 0);
  // The mouthpiece at the lips (chest frame), or at the chest between blasts; the bell up and ahead.
  const mouth = [0, lerp(1.2, 1.565, up), lerp(0.24, 0.13, up)];
  const bell = [0, mouth[1] + lerp(0.3, 0.5, up), mouth[2] + lerp(0.5, 0.36, up)];
  propAlong(P, -1, mouth, bell, Math.PI, { chest: true });
  P.hand(-1, ...along(mouth, bell, 0.12), { chest: true, pole: [-0.8, -0.5, -0.2] });
  P.hand(1, ...along(mouth, bell, 0.34), { chest: true, pole: [0.8, -0.5, -0.2] });
  P.rot('handR', 0.3, 0, -1.2);
  P.rot('handL', 0.3, 0, 1.2);
  fingers(P, -1, 0.9);
  fingers(P, 1, 0.9);
}

/** A jar on the head (the left hand at its belly, the head held level under it). */
function jarOnHead(P, t) {
  P.rot('neck', -0.03, 0, 0);
  P.rot('head', -0.03 + 0.01 * sn(t, 2), 0, 0);
  P.prop(1, 0, HEAD_LOAD_Y + 0.01, 0, 0, 0, 0, { chest: true });
  P.hand(1, 0.15, HEAD_LOAD_Y + 0.13, 0.02, { chest: true, pole: [0.9, 0.2, -0.2] });
  P.rot('handL', 0, 0, 1.4);
  fingers(P, 1, 0.45);
}

/**
 * Squatting on the heels, knees wide, leaning over the ground before the feet:
 * the right hand reaching out, picking up a pebble, setting it down elsewhere;
 * the left forearm on the knee; looking at what the hand does, now and then up.
 */
function playPose(P, t) {
  const sway = 0.02 * sn(t, 1);
  P.root(sway, -0.58, -0.08, 0.62, 0.1 * sn(t, 1, 0.2), 0);
  P.rot('spine', 0.32, 0, 0);
  P.rot('chest', 0.14, 0, 0);
  for (const s of [1, -1]) P.foot(s, s * 0.17, 0.085, 0.02, 0, s * 0.35, { pole: [s * 0.6, 0.2, 1] });
  // The right hand from one place on the ground to another and back.
  const a = track(t, [[0, 0], [0.2, 0], [0.4, 1], [0.6, 1], [0.8, 0]]);
  const lift = Math.sin(Math.PI * a) * 0.12;
  P.hand(-1, lerp(-0.18, 0.06, a), 0.1 + lift, lerp(0.5, 0.56, a), { pole: [-0.8, 0.2, -0.3] });
  P.rot('handR', 0.8, 0, -0.6);
  fingers(P, -1, 0.6 + 0.3 * Math.abs(sn(t, 2)));
  P.hand(1, 0.2, 0.45, 0.3, { pole: [0.8, -0.3, -0.3] });
  P.rot('handL', 0.5, 0, 0.5);
  fingers(P, 1, 0.6);
  const up = Math.max(0, hold(t, 1, 0.65, 3));
  P.rot('neck', 0.3 - 0.25 * up, 0, 0);
  P.rot('head', 0.25 - 0.3 * up, 0.15 * sn(t, 1, 0.1), 0);
}

/**
 * A rower's stroke (ROW), the oar on side `so` (+1 his left). The oar turns
 * about its thole: forward (a > 0) at the catch, back at the finish; dipped
 * (q > 0: the handle up, the blade down) through the drive, lifted and
 * feathered (turned flat) for the recovery.
 */
function rowPose(P, t, so) {
  const a = track(t, [[0, 0.55], [0.08, 0.5], [0.42, -0.42], [0.5, -0.45], [0.62, -0.3], [0.92, 0.55], [0.97, 0.56]]);
  const q = track(t, [[0, 0.15], [0.42, 0.15], [0.5, -0.05], [0.9, -0.05], [0.97, 0.15]]);
  const feather = track(t, [[0, 0], [0.44, 0], [0.52, 1], [0.88, 1], [0.95, 0]]);
  const lean = track(t, [[0, 0.42], [0.08, 0.38], [0.42, -0.22], [0.5, -0.2], [0.62, -0.05], [0.92, 0.42]]);
  P.root(0, ROW.seat + 0.1 - 0.95, -0.03, lean * 0.55, 0, 0);
  P.rot('spine', 0.04 + lean * 0.35, 0, 0);
  P.rot('chest', lean * 0.15, -so * 0.06, 0);
  for (const s of [1, -1]) P.foot(s, s * 0.13, 0.11, ROW.brace, -0.35, s * 0.1, { pole: [s * 0.1, 1, 0.6] });
  const thole = [so * ROW.out, ROW.up, ROW.ahead];
  const L = ROW.inboard;
  const handle = [thole[0] - so * L * Math.cos(a) * Math.cos(q), thole[1] + L * Math.sin(q), thole[2] + L * Math.sin(a) * Math.cos(q)];
  // The oar from its handle out through the thole, feathered (turned about itself) on the recovery.
  propAlong(P, -1, handle, thole, so * (Math.PI / 2) * (1 - feather));
  // The inner hand at the handle's end, the outer toward the thole.
  const inner = along(handle, thole, 0.04);
  const outer = along(handle, thole, 0.24);
  const hi = so > 0 ? -1 : 1;
  P.hand(hi, inner[0], inner[1] - 0.02, inner[2] - 0.03, { pole: [hi * 0.7, -0.6, -0.3] });
  P.hand(-hi, outer[0], outer[1] - 0.02, outer[2] - 0.03, { pole: [-hi * 0.7, -0.6, -0.3] });
  for (const s of [1, -1]) {
    P.rot(s > 0 ? 'handL' : 'handR', 0, 0, s * 1.3);
    fingers(P, s, 0.95);
  }
  P.rot('neck', -0.1 * lean, 0, 0);
  P.rot('head', -0.15 * lean, 0, 0);
}

/** The walkers' legs: the walk at WALKER_STRIDE on hips STRIDE_DROP lower, leaning `lean` in. */
function strideLegs(P, t, lean = 0) {
  walkLegs(P, t, WALKER_STRIDE / WALK_STRIDE, STRIDE_DROP, lean);
}

/** A point `k` (0..1) of the way from a to b. */
function lerp3(a, b, k) {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}

/**
 * A run's legs (RUN_STRIDE a loop): each foot down RUN_STANCE of the loop, a flight between, the hips lowest at
 * each mid-stance (twice a loop) and leaning in; the swinging foot's heel kicked up behind.
 */
function runLegs(P, t) {
  const bob = -0.1 + 0.045 * (0.5 - 0.5 * cs(t, 2, -RUN_STANCE));
  P.root(0.012 * sn(t, 1, 0.25), bob, 0, 0.16, -0.08 * sn(t, 1, 0.25), -0.03 * sn(t, 1, 0.25));
  P.rot('spine', 0.06, 0.07 * sn(t, 1, 0.25), 0.02 * sn(t, 1, 0.25));
  P.rot('chest', 0.01 * sn(t, 2, 0.3), 0.06 * sn(t, 1, 0.25), 0);
  P.rot('neck', 0, -0.07 * sn(t, 1, 0.25), 0);
  P.rot('head', 0.02 * sn(t, 2, 0.4), -0.04 * sn(t, 1, 0.25), 0);
  for (const s of [1, -1]) {
    const f = runFoot((t + (s > 0 ? 0 : 0.5)) % 1, RUN_STRIDE);
    P.foot(s, s * 0.09, f.y, f.z, f.pitch, s * 0.05);
  }
}

/**
 * A running foot at phase p of its own cycle (0 as it lands): stance (RUN_STANCE of the loop) on the flat of the
 * foot under the hips, its ground moving back at S a loop, then rolled onto the ball; the swing kicks the heel up
 * behind and brings the foot forward to land again.
 */
export function runFoot(p, S) {
  const ST = RUN_STANCE;
  const fromBall = (z, th) => ({ y: 0.018 + 0.067 * Math.cos(th) + 0.147 * Math.sin(th), z: z - 0.147 * Math.cos(th) + 0.067 * Math.sin(th), pitch: th });
  const OFF = 0.85;
  if (p < ST) {
    const g = S * (ST / 2 - p);
    const k = p / ST;
    if (k < 0.55) return { y: 0.085, z: g, pitch: 0 };
    return fromBall(g + 0.147, OFF * smooth((k - 0.55) / 0.45));
  }
  const a = fromBall(S * (ST / 2 - ST) + 0.147, OFF);
  const u = (p - ST) / (1 - ST);
  const kz = smooth(u);
  return {
    y: lerp(a.y, 0.085, smooth(u)) + 0.32 * Math.sin(Math.PI * Math.min(1, u * 1.25)) * (1 - 0.5 * u),
    z: lerp(a.z, S * ST / 2, kz) - 0.12 * Math.sin(Math.PI * u),
    pitch: lerp(OFF, 0, smooth(Math.min(1, u * 1.3))),
  };
}

/**
 * The walk's legs: each foot planted while its contact point moves back at the stride's speed, then swung ahead.
 * `drop` lowers the hips (a longer stride needs it: the feet must stay within the legs' reach), `lean` leans
 * the body forward (a man pushing, hurrying).
 */
function walkLegs(P, t, stride = 1, drop = 0, lean = 0) {
  const S = WALK_STRIDE * stride;
  // Highest at mid-stance, lowest as both feet are down; the hips over the standing foot, turned with the leg ahead.
  const bob = -0.044 + 0.026 * (0.5 - 0.5 * cs(t, 2)) - drop;
  P.root(0.02 * sn(t, 1, 0.25), bob, 0, 0.04 + lean, -0.07 * sn(t, 1, 0.25), -0.035 * sn(t, 1, 0.25));
  P.rot('spine', 0.03, 0.05 * sn(t, 1, 0.25), 0.025 * sn(t, 1, 0.25));
  P.rot('chest', 0.012 * sn(t, 2, 0.3), 0.05 * sn(t, 1, 0.25), 0);
  P.rot('neck', 0.02, -0.05 * sn(t, 1, 0.25), 0);
  P.rot('head', 0.02 + 0.015 * sn(t, 2, 0.4), -0.03 * sn(t, 1, 0.25), 0);
  for (const s of [1, -1]) {
    const p = (t + (s > 0 ? 0 : 0.5)) % 1;
    const f = footAt(p, S);
    P.foot(s, s * 0.1, f.y, f.z, f.pitch, s * 0.06);
  }
}

/** The arms of a walk: each swinging against its leg, the elbow bending as it comes forward. */
function walkArms(P, t, sides, amp = 1) {
  for (const s of sides) {
    const k = s > 0 ? 'L' : 'R';
    // The left arm forward as the right leg is.
    const sw = sn(t, 1, s > 0 ? 0.75 : 0.25);
    P.rot(`arm${k}`, (-0.28 * sw - 0.02) * amp, 0, s * 0.08);
    P.rot(`fore${k}`, (-0.22 - 0.2 * Math.max(0, sw)) * (amp > 1 ? 1 + (amp - 1) * 0.6 : 1), s * 0.1, 0);
    P.rot(`hand${k}`, 0, 0, s * 0.05);
    fingers(P, s, 0.4);
  }
}

/**
 * A walking foot at phase p of its own cycle (0 its heel striking): its
 * ankle's height and place along z (actor frame) and its pitch (toes down +).
 * Stance (60% of the loop): the heel, then the sole, then the ball on the
 * ground, the contact point moving back at S a loop; swing: an arc forward
 * to the next heel strike.
 */
export function footAt(p, S) {
  const ST = 0.6;
  const H0 = 0.25 * (S / WALK_STRIDE);
  // Ankle offsets from the heel and from the ball at rest (rig.js: ankle 0.085 up, heel 0.05 behind, ball 0.147 ahead).
  const fromHeel = (z, th) => ({ y: 0.085 * Math.cos(th) - 0.05 * Math.sin(th), z: z + 0.085 * Math.sin(th) + 0.05 * Math.cos(th), pitch: th });
  const fromBall = (z, th) => ({ y: 0.018 + 0.067 * Math.cos(th) + 0.147 * Math.sin(th), z: z - 0.147 * Math.cos(th) + 0.067 * Math.sin(th), pitch: th });
  const STRIKE = -0.25;
  const OFF = 0.75;
  if (p < ST) {
    // The ground under the foot moves back at the stride's speed.
    const heelZ = H0 - S * p;
    if (p < 0.08) return fromHeel(heelZ, STRIKE * (1 - smooth(p / 0.08)));
    if (p < 0.42) return fromHeel(heelZ, 0);
    // The ball, where the sole flat put it, moving back with the ground.
    const ballZ = H0 - S * p + 0.05 + 0.147;
    return fromBall(ballZ, OFF * smooth((p - 0.42) / (ST - 0.42)));
  }
  // The swing: from the toe-off to the next strike.
  const a = fromBall(H0 - S * ST + 0.05 + 0.147, OFF);
  const b = fromHeel(H0 - S, STRIKE);
  // (The next strike is a loop later: its heel at H0 again, the actor having moved S.)
  b.z += S;
  const u = (p - ST) / (1 - ST);
  const k = smooth(u);
  return {
    y: lerp(a.y, b.y, k) + 0.075 * Math.sin(Math.PI * u) * (1 - 0.3 * u),
    z: lerp(a.z, b.z, k),
    // The toes come up fast after the push, then the heel leads into the strike.
    pitch: lerp(OFF, STRIKE, smooth(Math.min(1, u * 1.6))),
  };
}

/**
 * The saddle quern the grind clip works (models/villages.js puts its stones
 * here): the top of its lower stone `height` over the kneeler's knees' ground,
 * its middle `ahead` of her, the upper stone moving `travel` along it.
 */
export const QUERN = Object.freeze({ ahead: 0.5, height: 0.26, travel: 0.2 });

// ---------------------------------------------------------------------------
// Baking
// ---------------------------------------------------------------------------

/** Every clip baked: its name and variant (`name` or `name@toga`). */
export const CLIP_NAMES = Object.freeze(Object.entries(CLIPS).flatMap(([n, c]) => (c.toga ? [n, `${n}@toga`] : [n])));

/** A clip's index in the bone texture's table (the shader's uPeopleClips), by name. */
export const CLIP_INDEX = Object.freeze(Object.fromEntries(CLIP_NAMES.map((n, i) => [n, i])));

/** Floats a frame takes: every bone's 3 x 4 matrix. */
export const FRAME_FLOATS = BONE_COUNT * BONE_FLOATS;

/** A clip's definition and variant from its name. */
export function clipDef(name) {
  const [base, mod] = name.split('@');
  const def = CLIPS[base];
  if (!def) throw new Error(`No clip ${name}`);
  return { def, mods: { toga: mod === 'toga' } };
}

/** A clip's frames to bake (its loop at its rate, at least 8). */
export function clipFrames(name) {
  const { def } = clipDef(name);
  return Math.max(8, Math.round(def.dur * def.fps));
}

/** The pose of clip `name` at phase t (0..1): a solved Pose (the tests, the lab's checks). */
export function poseAt(name, t, pose = new Pose()) {
  const { def, mods } = clipDef(name);
  pose.reset();
  def.pose(pose, ((t % 1) + 1) % 1, mods);
  return pose.solve();
}

let BAKED = null;

/**
 * Every clip baked once: { data (Float32Array, a row of FRAME_FLOATS a
 * frame), rows, table: [{ name, start, frames, fps, dur }] }. A row is frame
 * f of its clip at phase f / frames; the shader blends a frame with the next
 * and wraps to the clip's start (the loop's end is its beginning).
 */
export function bakeClips() {
  if (BAKED) return BAKED;
  const table = [];
  let rows = 0;
  for (const name of CLIP_NAMES) {
    const frames = clipFrames(name);
    const { def } = clipDef(name);
    table.push(Object.freeze({ name, start: rows, frames, fps: frames / def.dur, dur: def.dur, walk: !!def.walk, stride: def.stride || (def.walk ? WALK_STRIDE : 0) }));
    rows += frames;
  }
  const data = new Float32Array(rows * FRAME_FLOATS);
  const pose = new Pose();
  for (const c of table) {
    for (let f = 0; f < c.frames; f++) poseAt(c.name, f / c.frames, pose).write(data, (c.start + f) * FRAME_FLOATS);
  }
  BAKED = Object.freeze({ data, rows, table: Object.freeze(table) });
  return BAKED;
}

export { BONE };
