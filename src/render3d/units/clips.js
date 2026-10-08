/**
 * units/clips.js
 * ----------------------------------------------------------------------------
 * The fighting men's clips, appended to the people's (people/clips.js CLIPS
 * spreads unitClips(helpers) at its end, so every clip before them keeps its
 * index): made with the people's own helpers (stand, the walk's and the
 * run's legs, the props placed along a line), handed in so this module does
 * not import clips.js (which imports it).
 *
 * Moving (played by the ground covered, units/motion.js):
 *   charge        running in with the weapon up and the shield before him
 *   bowMarch      an archer on the march, his bow low in his left hand
 *   shoulderArms  a weapon on the right shoulder (a two-handed axe)
 * Standing:
 *   shieldWall    the line: crouched behind the shield, the weapon levelled
 *                 at the waist (a sword's point, a spear's head) past its edge
 *   fight         sword and shield: a thrust from behind the shield, back to
 *                 guard, a punch of the boss (the legionary's way, Vegetius)
 *   hew           a long sword or an axe: raised behind the head, a cut down
 *                 across, the shield up after it
 *   chop          a two-handed axe brought down from over the shoulder
 *   thrust        a spear overhand from behind a shield
 *   throw         a javelin hurled, the next taken from the left hand's bundle
 *   sling         the sling whirled over the head twice and the stone let go
 *   mounted       in the saddle, the reins in the left hand, a lance upright
 *   rideStrike    from the saddle, a thrust down at a man on foot
 *   fall          struck, staggering back, down on his back and lying there
 *                 (played held at FALL_HOLD: units/motion.js)
 *   flinch        a blow taken: the shoulders back, the shield up
 * Each attack clip lands its blow (or lets go its missile) at its `hit`
 * phase: units/motion.js times it so that phase falls on the tick the sim
 * strikes, whatever the game's speed.
 * ----------------------------------------------------------------------------
 */

/** Where in its loop each clip's blow lands, or its missile is let go (units/motion.js). */
export const HIT = Object.freeze({ fight: 0.3, hew: 0.3, chop: 0.32, thrust: 0.3, throw: 0.34, sling: 0.42, rideStrike: 0.32, shoot: 0.545 });
/** The fall's phase at which the fallen man is held, lying (units/motion.js). */
export const MAN_FALL_HOLD = 0.5;
/** How high a rider's hips sit over his own feet' rest (the seat's height a mount's seat track gives). */
export const SEAT_DROP = 0.0;

/**
 * The clips, from the people's helpers `h` (people/clips.js): { sn, cs,
 * hold, smooth, lerp, lerp3, clamp01, track, stand, armsDown, fingers,
 * propAlong, along, walkLegs, walkArms, strideLegs, runLegs, WALKER_STRIDE,
 * RUN_STRIDE }.
 */
export function unitClips(h) {
  const { sn, cs, smooth, lerp, lerp3, track, stand, fingers, propAlong, along, walkArms, strideLegs, runLegs, WALKER_STRIDE, RUN_STRIDE } = h;

  /** The fighting stance: knees bent, the left foot forward, turned a little side on; the weight rocking. */
  const stance = (P, t, { low = 0.08, turn = -0.25, lean = 0.12, step = 0 } = {}) => {
    P.root(0.01, -low + 0.01 * sn(t, 2), 0.04 * step, lean + 0.08 * step, turn, 0);
    P.rot('spine', 0.05 + 0.04 * step, -turn * 0.4, 0);
    P.rot('chest', 0.01 * sn(t, 3), -turn * 0.3, 0);
    P.foot(1, 0.11, 0.085, 0.24 + 0.08 * step, 0, 0.15 + turn, { pole: [0.25, 0, 1] });
    P.foot(-1, -0.15, 0.085, -0.2, 0, -0.35 + turn, { pole: [-0.3, 0, 1] });
    P.rot('neck', 0.04, -turn * 0.7, 0);
    P.rot('head', -0.04, -turn * 0.5 + 0.06 * sn(t, 1, 0.3), 0);
  };
  /** The shield before him on the left arm (its face +z), pushed out by `punch`, raised by `up`. */
  const shieldUp = (P, punch = 0, up = 0, x = 0.1) => {
    const sh = [x + 0.02 * punch, 1.02 + 0.04 * punch + 0.22 * up, 0.32 + 0.15 * punch + 0.04 * up];
    P.prop(1, sh[0], sh[1], sh[2], -0.25 * up, -0.35 + 0.1 * punch, 0);
    P.hand(1, sh[0], sh[1] - 0.01, sh[2] - 0.03, { pole: [0.9, -0.4, -0.2] });
    P.rot('handL', 0, 0, 1.3);
    fingers(P, 1, 0.95);
  };
  /** The right hand's weapon from its grip toward a point, the fist round it. */
  const weapon = (P, grip, tip, roll = -Math.PI / 2) => {
    propAlong(P, -1, grip, tip, roll);
    P.hand(-1, grip[0], grip[1], grip[2] - 0.02, { pole: [-0.7, -0.6, -0.3] });
    P.rot('handR', 0, 0, -1.2);
    fingers(P, -1, 0.95);
  };

  return {
    // --- Moving ------------------------------------------------------------
    // Running in to strike: the run's legs, the weapon held up and back over the shoulder, the shield before him.
    charge: {
      dur: 0.62, fps: 40, walk: true, stride: RUN_STRIDE,
      pose(P, t) {
        runLegs(P, t);
        const bob = 0.02 * sn(t, 2);
        P.prop(1, 0.14, 1.08 + bob, 0.3, -0.15, -0.3, 0);
        P.hand(1, 0.14, 1.07 + bob, 0.27, { pole: [0.9, -0.4, -0.2] });
        P.rot('handL', 0, 0, 1.3);
        fingers(P, 1, 0.95);
        const grip = [-0.24, 1.42 + bob, 0.02];
        weapon(P, grip, [grip[0] - 0.06, grip[1] + 0.35, grip[2] + 0.3]);
        P.rot('neck', -0.08, 0, 0);
      },
    },
    // An archer marching: the bow low in his left hand along his side, the right arm swinging (the arrow, on
    // the right hand's prop, hidden till he shoots).
    bowMarch: {
      dur: 0.8, fps: 30, walk: true, stride: WALKER_STRIDE,
      pose(P, t) {
        strideLegs(P, t, 0.02);
        walkArms(P, t, [-1], 1.2);
        const sw = 0.03 * sn(t, 1, 0.75);
        P.prop(1, 0.27, 0.95, 0.12 + sw, 0.35, 0, 0.1);
        P.hand(1, 0.27, 0.93, 0.1 + sw, { pole: [0.7, -0.6, -0.4] });
        P.rot('handL', 0, 0, 1.2);
        fingers(P, 1, 0.95);
        P.prop(-1, -0.2, 0.9, 0, 0, 0, 0, { scale: 0.001 });
      },
    },
    // A long weapon over the right shoulder, its head behind, the right hand at the haft before it; the left arm swinging.
    shoulderArms: {
      dur: 0.8, fps: 30, walk: true, stride: WALKER_STRIDE,
      pose(P, t) {
        strideLegs(P, t, 0.03);
        walkArms(P, t, [1], 1.2);
        const grip = [-0.18, 1.3 + 0.01 * sn(t, 2), 0.2];
        propAlong(P, -1, grip, [-0.2, 1.75, -0.35], -Math.PI / 2, { chest: true });
        P.hand(-1, grip[0], grip[1] - 0.02, grip[2] - 0.02, { chest: true, pole: [-0.8, -0.6, 0] });
        P.rot('handR', 0, 0, -1.2);
        fingers(P, -1, 0.95);
      },
    },
    // --- Standing ----------------------------------------------------------
    // The line held: crouched behind the shield, its rim under the eyes, the weapon levelled past its edge.
    shieldWall: {
      dur: 6, fps: 12,
      pose(P, t) {
        stance(P, t, { low: 0.1, turn: -0.15, lean: 0.15 });
        shieldUp(P, 0.1 * Math.max(0, sn(t, 2)), 0.05, 0.08);
        const grip = [-0.17, 1.02 + 0.01 * sn(t, 3), 0.2];
        weapon(P, grip, [grip[0] + 0.05, grip[1] + 0.06, grip[2] + 0.5]);
        P.rot('neck', 0.08, 0.15 * Math.tanh(2 * sn(t, 1, 0.2)), 0);
      },
    },
    // Sword and shield: guard, the thrust past the shield's edge (its point lands at 0.3), back, the boss punched out.
    fight: {
      dur: 2.5, fps: 24,
      pose(P, t) {
        const thrust = track(t, [[0, 0], [0.18, -0.15], [0.3, 1], [0.38, 1], [0.5, 0]]);
        const punch = track(t, [[0, 0], [0.6, 0], [0.68, 1], [0.74, 1], [0.86, 0]]);
        stance(P, t, { low: 0.09, turn: -0.3 + 0.12 * thrust, lean: 0.12, step: Math.max(0, thrust) });
        shieldUp(P, punch, 0.05 * (1 - punch));
        const grip = [lerp(-0.2, -0.08, Math.max(0, thrust)), lerp(1.0, 1.12, Math.max(0, thrust)), lerp(0.14, 0.62, thrust)];
        weapon(P, grip, [grip[0] + lerp(0.1, 0.02, Math.max(0, thrust)), grip[1] + lerp(0.12, 0.02, Math.max(0, thrust)), grip[2] + 0.5]);
      },
    },
    // An overhand cut: the blade raised behind the head, brought down across before him (landing at 0.3), up again behind the shield.
    hew: {
      dur: 2.5, fps: 24,
      pose(P, t) {
        const raise = track(t, [[0, 0], [0.16, 1], [0.24, 1], [0.32, -1], [0.42, -1], [0.6, 0]]);
        const guard = track(t, [[0, 0], [0.45, 0], [0.55, 1], [0.75, 1], [0.9, 0]]);
        stance(P, t, { low: 0.1, turn: -0.35 + 0.25 * Math.max(0, -raise), lean: 0.1 + 0.1 * Math.max(0, -raise), step: Math.max(0, -raise) });
        shieldUp(P, 0, 0.4 * guard + 0.1, 0.12);
        // The sword hand: over the right shoulder (raise 1), down before the left knee (raise -1), at guard (0).
        const up = [-0.22, 1.72, -0.05];
        const mid = [-0.2, 1.15, 0.25];
        const down = [0.02, 0.92, 0.5];
        const g = raise >= 0 ? lerp3(mid, up, raise) : lerp3(mid, down, -raise);
        const tipUp = [g[0] - 0.05, g[1] + 0.15, g[2] - 0.6];
        const tipMid = [g[0] + 0.1, g[1] + 0.45, g[2] + 0.3];
        const tipDown = [g[0] + 0.3, g[1] - 0.25, g[2] + 0.45];
        const tip = raise >= 0 ? lerp3(tipMid, tipUp, raise) : lerp3(tipMid, tipDown, -raise);
        weapon(P, g, tip, 0);
      },
    },
    // A two-handed axe: back over the right shoulder, down before him (landing at 0.32), dragged up again.
    chop: {
      dur: 2.6, fps: 24,
      pose(P, t) {
        const raise = track(t, [[0, 0], [0.18, 1], [0.24, 1], [0.32, -1], [0.44, -1], [0.7, 0]]);
        stance(P, t, { low: 0.12 + 0.06 * Math.max(0, -raise), turn: -0.2, lean: 0.08 + 0.25 * Math.max(0, -raise), step: Math.max(0, -raise) });
        const up = [-0.12, 1.6, -0.12];
        const mid = [-0.06, 1.1, 0.25];
        const down = [0.0, 0.85, 0.45];
        const g = raise >= 0 ? lerp3(mid, up, raise) : lerp3(mid, down, -raise);
        const headUp = [g[0] - 0.05, g[1] + 0.35, g[2] - 0.75];
        const headMid = [g[0] + 0.02, g[1] + 0.85, g[2] + 0.3];
        const headDown = [g[0] + 0.02, g[1] - 0.3, g[2] + 0.8];
        const head = raise >= 0 ? lerp3(headMid, headUp, raise) : lerp3(headMid, headDown, -raise);
        propAlong(P, -1, g, head, -Math.PI / 2);
        P.hand(-1, g[0], g[1], g[2] - 0.02, { pole: [-0.7, -0.6, -0.3] });
        P.rot('handR', 0, 0, -1.2);
        fingers(P, -1, 0.95);
        // The left hand higher up the haft.
        const l = along(g, head, 0.32);
        P.hand(1, l[0], l[1], l[2] - 0.02, { pole: [0.7, -0.6, -0.3] });
        P.rot('handL', 0, 0, 1.2);
        fingers(P, 1, 0.95);
      },
    },
    // A spear thrust overhand from behind the shield (its head lands at 0.3), drawn back, held up again.
    thrust: {
      dur: 2.5, fps: 24,
      pose(P, t) {
        const k = track(t, [[0, 0], [0.18, -0.4], [0.3, 1], [0.38, 1], [0.55, 0]]);
        stance(P, t, { low: 0.08, turn: -0.3 + 0.1 * Math.max(0, k), lean: 0.1 + 0.08 * Math.max(0, k), step: Math.max(0, k) });
        shieldUp(P, 0, 0.1, 0.1);
        const grip = [-0.2, 1.48 + 0.04 * k, lerp(0.1, 0.62, (k + 0.4) / 1.4)];
        // (Overhand: the point forward and down, the butt up behind.)
        P.prop(-1, grip[0], grip[1], grip[2], Math.PI / 2 + 0.18, 0.04, 0);
        P.hand(-1, grip[0], grip[1] + 0.02, grip[2], { pole: [-0.7, 0.4, -0.6] });
        P.rot('handR', 0, 0, -1.4);
        fingers(P, -1, 0.95);
      },
    },
    // A javelin thrown: drawn back, the step and the cast (let go at 0.34, gone), the next from the left hand's bundle.
    throw: {
      dur: 2.2, fps: 24,
      pose(P, t) {
        const draw = track(t, [[0, 0], [0.12, 0], [0.26, 1], [0.32, 1], [0.36, -1], [0.46, -0.6], [0.62, 0]]);
        const fetch = track(t, [[0, 0], [0.55, 0], [0.66, 1], [0.74, 1], [0.86, 0]]);
        stance(P, t, { low: 0.06, turn: -0.5 + 0.5 * Math.max(0, -draw), lean: -0.05 * Math.max(0, draw) + 0.18 * Math.max(0, -draw), step: Math.max(0, -draw) });
        // The bundle in the left hand, held out before him for balance.
        P.prop(1, 0.2, 1.05, 0.25, 0.3, 0, 0.15);
        P.hand(1, 0.2, 1.04, 0.23, { pole: [0.8, -0.5, -0.3] });
        P.rot('handL', 0, 0, 1.2);
        fingers(P, 1, 0.95);
        const back = [-0.3, 1.58, -0.32];
        const rest = [-0.24, 1.48, 0.0];
        const out = [-0.05, 1.42, 0.6];
        const at = draw >= 0 ? lerp3(rest, back, draw) : lerp3(rest, out, -draw);
        const g = lerp3(at, [0.12, 1.1, 0.24], fetch);
        const shown = t < 0.35 || t > 0.66 ? 1 : 0.001;
        // (Held over the shoulder, its point ahead and a little up.)
        propAlong(P, -1, g, [g[0] + 0.05, g[1] + 0.12, g[2] + 0.6], 0, { scale: shown });
        P.hand(-1, g[0], g[1], g[2] - 0.02, { pole: [-0.6, -0.5, -0.6] });
        P.rot('handR', 0, 0, -1.3);
        fingers(P, -1, 0.95 - 0.5 * Math.max(0, -draw));
      },
    },
    // The sling: the stone's pouch whirled over the head, twice round, then swung forward and let go (0.42).
    sling: {
      dur: 2.4, fps: 30,
      pose(P, t) {
        stance(P, t, { low: 0.05, turn: -0.4, lean: 0.05 });
        // (Two turns to the cast, a third, slowing, as the hand comes down to load: whole turns round the loop.)
        const whirl = t < 0.42 ? (t / 0.42) * 2 : 2 + smooth((t - 0.42) / 0.58);
        const reload = track(t, [[0, 0], [0.55, 0], [0.7, 1], [0.85, 1], [0.95, 0]]);
        const a = Math.PI * 2 * whirl;
        // The hand circling over the head; the sling's cords (along the prop bone's -y) swung round it.
        const hand = lerp3([-0.18 + 0.06 * Math.cos(a), 1.78, 0.04 + 0.06 * Math.sin(a)], [0.05, 1.05, 0.3], reload);
        const out = [Math.cos(a), 0.25, Math.sin(a)];
        propAlong(P, -1, hand, [hand[0] - out[0] * (1 - reload), hand[1] - out[1] - reload, hand[2] - out[2] * (1 - reload)], 0);
        P.hand(-1, hand[0], hand[1] - 0.02, hand[2], { pole: [-0.8, 0.3, -0.3] });
        P.rot('handR', 0, 0, -1.1);
        fingers(P, -1, 0.95);
        P.prop(1, 0.16, 1.0, 0.18, 0, 0.2, 0);
        P.hand(1, 0.16, 0.98, 0.16, { pole: [0.8, -0.5, -0.3] });
        P.rot('handL', 0, 0, 1.2);
        fingers(P, 1, 0.8);
        P.rot('neck', 0, 0.3, 0);
        P.rot('head', -0.08, 0.25, 0);
      },
    },
    // In the saddle: astride (the knees gripping the barrel, the feet hanging), the reins in the left hand, the lance upright.
    mounted: {
      dur: 6, fps: 10,
      pose(P, t) {
        P.root(0, -0.02 + 0.006 * sn(t, 3), 0, -0.04, 0.03 * sn(t, 1), 0);
        P.rot('spine', 0.04 + 0.01 * sn(t, 3), 0, 0);
        for (const s of [1, -1]) P.foot(s, s * 0.3, 0.38, 0.12, 0.25, s * 0.2, { pole: [s * 0.6, 0.1, 1] });
        P.hand(1, 0.08, 1.12 + 0.01 * sn(t, 3), 0.32, { pole: [0.6, -0.6, -0.4] });
        P.rot('handL', 0.3, 0, 0.6);
        fingers(P, 1, 0.95);
        // (The shield hung on the left forearm, its face out to the left; the hand on the reins.)
        P.prop(1, 0.27, 1.12, 0.1, 0, 1.35, 0.1);
        P.prop(-1, -0.26, 1.18, 0.14, 0.1, 0, 0);
        P.hand(-1, -0.26, 1.16, 0.12, { pole: [-0.6, -0.7, -0.3] });
        P.rot('handR', 0, 0, -1.4);
        fingers(P, -1, 0.95);
        const yaw = 0.35 * Math.tanh(2 * sn(t, 2, 0.15));
        P.rot('neck', 0.02, yaw * 0.4, 0);
        P.rot('head', 0.02, yaw * 0.6, 0);
      },
    },
    // From the saddle at a man on foot: the lance drawn up and thrust down past the horse's shoulder (landing at 0.32).
    rideStrike: {
      dur: 2.2, fps: 24,
      pose(P, t) {
        const k = track(t, [[0, 0], [0.18, -0.5], [0.32, 1], [0.4, 1], [0.6, 0]]);
        P.root(0, -0.02, 0, -0.04 + 0.12 * Math.max(0, k), -0.35 * Math.max(0, k), 0.05 * Math.max(0, k));
        P.rot('spine', 0.05 + 0.1 * Math.max(0, k), -0.15 * k, -0.1 * Math.max(0, k));
        for (const s of [1, -1]) P.foot(s, s * 0.3, 0.38, 0.12, 0.25, s * 0.2, { pole: [s * 0.6, 0.1, 1] });
        P.hand(1, 0.08, 1.12, 0.32, { pole: [0.6, -0.6, -0.4] });
        P.rot('handL', 0.3, 0, 0.6);
        fingers(P, 1, 0.95);
        P.prop(1, 0.27, 1.12, 0.1, 0, 1.35 - 0.3 * Math.max(0, k), 0.1);
        const grip = [-0.3 - 0.05 * Math.max(0, k), 1.45 - 0.2 * Math.max(0, k), lerp(0.0, 0.55, (k + 0.5) / 1.5)];
        P.prop(-1, grip[0], grip[1], grip[2], Math.PI / 2 + 0.45, 0.1, 0);
        P.hand(-1, grip[0], grip[1] + 0.02, grip[2], { pole: [-0.8, 0.3, -0.5] });
        P.rot('handR', 0, 0, -1.4);
        fingers(P, -1, 0.95);
        P.rot('neck', 0.15 * Math.max(0, k), -0.2 * k, 0);
      },
    },
    // Struck down: a stagger back, the knees go, onto his back by 0.45 and lying there (held: the rest of the loop,
    // getting up, is only its way back to its start); what he held falls beside him.
    fall: {
      dur: 2.4, fps: 24,
      pose(P, t) {
        const k = track(t, [[0, 0], [0.06, 0.05], [0.22, 0.45], [0.42, 1], [0.92, 1], [0.98, 0]]);
        const fold = Math.sin(Math.PI * Math.min(1, k * 1.1));
        const lie = smooth(Math.max(0, (k - 0.35) / 0.65));
        // Down and back: the hips to a hand over the ground, the body laid back a quarter turn.
        P.root(0.02 * k, lerp(0, 0.11 - 0.95, smooth(k)), -0.25 * k, lerp(0, -Math.PI / 2 + 0.06, smooth(k)) + 0.2 * fold, 0.15 * k, 0.12 * k);
        P.rot('spine', -0.1 * fold, 0, 0.05 * k);
        P.rot('neck', 0.25 * lie + 0.2 * fold, 0.4 * lie, 0);
        P.rot('head', 0.1 * lie, 0.3 * lie, 0.1 * lie);
        for (const s of [1, -1]) {
          const kk = s > 0 ? 'L' : 'R';
          // The feet slip out before him as he goes back (the knees bending, then straightening), and lie
          // on their heels, the toes fallen outward; his left knee stays up a little.
          const fz = lerp(0.02, s > 0 ? 0.48 : 0.62, smooth(k));
          const fy = 0.085 + 0.05 * fold + (s > 0 ? 0.02 : 0) * lie;
          P.foot(s, s * lerp(0.1, 0.17, k), fy, fz, -0.9 * lie, s * 0.45 * lie, { pole: [s * 0.2, 0.6 + 0.4 * lie, 1] });
          // The arms flung out, then lying loose.
          P.rot(`arm${kk}`, -0.4 * fold - 0.3 * lie, 0, s * (0.4 * fold + 0.9 * lie));
          P.rot(`fore${kk}`, -0.5 * fold - 0.3 * lie, 0, 0);
          fingers(P, s, 0.3);
        }
        // What he held: from the hands to the ground beside him.
        const fell = smooth(Math.min(1, k * 1.3));
        P.prop(1, lerp(0.25, 0.55, fell), lerp(1.0, 0.03, fell), lerp(0.25, 0.2, fell), lerp(0, -Math.PI / 2, fell), lerp(-0.3, 0.4, fell), 0);
        P.prop(-1, lerp(-0.25, -0.6, fell), lerp(1.0, 0.025, fell), lerp(0.15, 0.5, fell), lerp(0, Math.PI / 2, fell), lerp(0, 0.8, fell), lerp(0, 0.2, fell));
      },
    },
    // A blow taken: the body jerked back and turned from it, the shield up, a step back.
    flinch: {
      dur: 1.2, fps: 24,
      pose(P, t) {
        // (Played once from its start over FLINCH_S: units/motion.js.)
        const k = track(t, [[0, 0], [0.1, 1], [0.35, 0.6], [0.8, 0]]);
        stance(P, t, { low: 0.08 + 0.04 * k, turn: -0.3 - 0.25 * k, lean: 0.1 - 0.35 * k });
        shieldUp(P, 0, 0.5 * k + 0.05, 0.12);
        const grip = [-0.22, 1.0 + 0.15 * k, 0.12];
        weapon(P, grip, [grip[0] + 0.1, grip[1] + 0.3, grip[2] + 0.4]);
        P.rot('neck', -0.2 * k, 0.3 * k, 0);
        P.rot('head', -0.15 * k, 0.2 * k, 0.1 * k);
      },
    },
  };
}
