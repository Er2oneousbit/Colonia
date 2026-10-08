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

import { Pose } from './pose.js';
import { BONE, BONE_COUNT, BONE_FLOATS } from './rig.js';

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

/** A seat's height for the seated clips (a bench, a chair): the actor stands its feet on the floor under it. */
export const SEAT_H = 0.45;

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
  P.prop(s, from[0], from[1], from[2], pitch, yaw, roll, opts);
}

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
      if (!m.toga) P.hand(1, 0.035, 0.93, 0.13, { chest: true, pole: [0.6, -0.3, -0.6] });
      P.hand(-1, -0.025, 0.95, 0.14, { chest: true, pole: [-0.6, -0.3, -0.6] });
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
      P.prop(-1, 0, 1.548, 0.1, 0.95 + 0.04 * sn(t, 3), 0, 0, { chest: true });
      for (const s of [1, -1]) {
        const a = 0.16 * s;
        // A point along each pipe (the pipes part at 2 x 0.16 rad): where the fingers stop the holes.
        const d = 0.24;
        const pitch = 0.95 + 0.04 * sn(t, 3);
        P.hand(s, Math.sin(a) * d, 1.548 - Math.sin(pitch) * Math.cos(a) * d - 0.02, 0.1 + Math.cos(pitch) * Math.cos(a) * d, { chest: true, pole: [s * 0.8, -0.5, -0.2] });
        P.rot(s > 0 ? 'handL' : 'handR', 0.2, 0, s * 0.5);
        fingers(P, s, 0.45 + 0.15 * sn(t, 24, s > 0 ? 0 : 0.3));
      }
      P.rot('neck', 0, 0, 0);
    },
  },
  // Working a pump's beam (a force pump, a windlass): both hands on the handle, the back bending into each stroke.
  pump: {
    dur: 2.2, fps: 30,
    pose(P, t) {
      const down = 0.5 - 0.5 * cs(t, 1);
      P.root(0, -0.03 - 0.06 * down, -0.02 - 0.03 * down, 0.05 + 0.15 * down, 0, 0);
      P.rot('spine', 0.08 + 0.18 * down, 0, 0);
      P.rot('chest', 0.06 * down, 0, 0);
      for (const s of [1, -1]) P.foot(s, s * 0.14, 0.085, s > 0 ? 0.08 : -0.08, 0, s * 0.2);
      // The beam's handle swings about its pivot (actor frame), the hands on it.
      const ang = 0.35 - 0.7 * down;
      const piv = [0, 0.95, 0.75];
      const arm = 0.42;
      const hx = piv[1] + Math.sin(ang) * arm;
      const hz = piv[2] - Math.cos(ang) * arm;
      P.prop(-1, 0, hx, hz, ang, 0, 0);
      for (const s of [1, -1]) {
        P.hand(s, s * 0.11, hx + 0.01, hz - 0.03, { pole: [s * 0.6, -0.7, -0.3] });
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
      stand(P, t, { shift: 0.3, ph: 0.9, look: 0.05, lean: 0.12 });
      P.rot('neck', 0.3, 0, 0);
      P.rot('head', 0.22, 0, 0);
      const k = (t * 5) % 1;
      const x = lerp(-0.14, 0.04, smooth(clamp01((k - 0.15) / 0.4))) - lerp(0, 0.18, smooth(clamp01((k - 0.7) / 0.3)));
      const lift = 0.04 * Math.sin(Math.PI * clamp01((k - 0.15) / 0.4));
      P.hand(-1, x, 0.99 + lift, 0.34, { pole: [-0.6, -0.6, -0.4] });
      P.rot('handR', 0.9, 0, -0.2);
      fingers(P, -1, 0.6);
      P.hand(1, 0.16, 0.97, 0.34, { pole: [0.6, -0.6, -0.4] });
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
});

/** The walk's legs: each foot planted while its contact point moves back at the stride's speed, then swung ahead. */
function walkLegs(P, t, stride = 1) {
  const S = WALK_STRIDE * stride;
  // Highest at mid-stance, lowest as both feet are down; the hips over the standing foot, turned with the leg ahead.
  const bob = -0.044 + 0.026 * (0.5 - 0.5 * cs(t, 2));
  P.root(0.02 * sn(t, 1, 0.25), bob, 0, 0.04, -0.07 * sn(t, 1, 0.25), -0.035 * sn(t, 1, 0.25));
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
function walkArms(P, t, sides) {
  for (const s of sides) {
    const k = s > 0 ? 'L' : 'R';
    // The left arm forward as the right leg is.
    const sw = sn(t, 1, s > 0 ? 0.75 : 0.25);
    P.rot(`arm${k}`, -0.28 * sw - 0.02, 0, s * 0.08);
    P.rot(`fore${k}`, -0.22 - 0.2 * Math.max(0, sw), s * 0.1, 0);
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
