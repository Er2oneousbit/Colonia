/**
 * units/quadRig.js
 * ----------------------------------------------------------------------------
 * The four-legged beasts of the battlefield as skinned figures: the grey
 * wolf, the cavalry horse and the war elephant. One skeleton plan for all
 * three (QBONES: the pelvis, the loins, the thorax, two neck bones, the
 * skull and its jaw, the ears, three tail bones, four bones a leg and three
 * for an elephant's trunk), each species with its own joints at rest
 * (SPECIES), so a pose is a rotation a bone and the clips are baked once a
 * species into a float texture of their own (bakeBeasts), as the people's
 * are (people/clips.js), and the GPU skins them (units/material.js).
 *
 * Why not the walkers' hinged beasts (walkers/beasts.js): a hinge swings a
 * leg as one piece, which serves a mule at a walk but not a gallop, where
 * the back flexes, the shoulders slide and each foot is planted and pushed
 * off the ground. Here every foot has a target (QPose.leg): planted, its
 * ground moves back at the stride's speed; swung, it arcs forward with the
 * lower leg folded; a two-bone solver finds the elbow or the stifle in the
 * leg's own plane, so a foot on the ground holds the ground.
 *
 * Gaits, from the record of animal locomotion (the footfalls' order and
 * each foot's share of the stride on the ground, its "duty"):
 *   walk           four-beat, lateral sequence: hind, fore of the same side,
 *                  then the other side's (an elephant's amble too)
 *   trot           two-beat: the diagonal pairs together
 *   canter         three-beat (a horse at 4 to 6 m/s)
 *   gallop         four-beat transverse (a horse's: the hinds, then the
 *                  fores, a flight between), the back rocking
 *   lope           a wolf's rotary gallop: two flights, the spine folding
 *                  under as the hinds reach forward and stretching out as
 *                  the fores do
 *   stalk          a wolf low to the ground, slow, the head level with the
 *                  back, each paw lifted and set down with care
 * Standing clips: breathing, the weight shifting, the head looking about,
 * the tail swinging; a wolf's bite (crouch, lunge, the jaws snapping); a
 * horse rearing to strike; an elephant tossing its tusks; falling to lie on
 * the side, dead.
 *
 * Metres, feet on y 0, facing +z, the beast's left at +x (as the people).
 * Pure but for three's maths: the tests read it.
 * ----------------------------------------------------------------------------
 */

import { Matrix4, Euler, Vector3 } from 'three';

const TAU = Math.PI * 2;
const sn = (t, k = 1, ph = 0) => Math.sin(TAU * (k * t + ph));
const cs = (t, k = 1, ph = 0) => Math.cos(TAU * (k * t + ph));
const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, k) => a + (b - a) * k;
const wrap1 = (x) => ((x % 1) + 1) % 1;
/** The beasts of the shows (the menagerie's), whose ears and heads move as a wolf's do. */
const PROWLERS = new Set(['lion', 'leopard', 'bear']);

/** Keyframes round a loop (as people/clips.js track): eased pose to pose, the last running into the first. */
export function qtrack(t, keys) {
  const n = keys.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (keys[k][0] <= t) i = k;
  const a = keys[i];
  const b = keys[(i + 1) % n];
  let t1 = b[0];
  let tt = t;
  if (t1 <= a[0]) t1 += 1;
  if (tt < a[0]) tt += 1;
  const k = smooth(clamp01((tt - a[0]) / (t1 - a[0])));
  return lerp(a[1], b[1], k);
}

// ---------------------------------------------------------------------------
// The skeleton
// ---------------------------------------------------------------------------

/** Every beast's bones: [name, parent]. The legs: upper (humerus, femur), lower (radius, tibia), cannon, foot. */
const LIST = [
  ['root', null], ['spine', 'root'], ['chest', 'spine'], ['neck', 'chest'], ['neck2', 'neck'], ['head', 'neck2'], ['jaw', 'head'],
  ['earL', 'head'], ['earR', 'head'], ['tail1', 'root'], ['tail2', 'tail1'], ['tail3', 'tail2'],
  ['upperFL', 'chest'], ['lowerFL', 'upperFL'], ['cannonFL', 'lowerFL'], ['footFL', 'cannonFL'],
  ['upperFR', 'chest'], ['lowerFR', 'upperFR'], ['cannonFR', 'lowerFR'], ['footFR', 'cannonFR'],
  ['upperHL', 'root'], ['lowerHL', 'upperHL'], ['cannonHL', 'lowerHL'], ['footHL', 'cannonHL'],
  ['upperHR', 'root'], ['lowerHR', 'upperHR'], ['cannonHR', 'lowerHR'], ['footHR', 'cannonHR'],
  ['trunk1', 'head'], ['trunk2', 'trunk1'], ['trunk3', 'trunk2'],
];

export const QBONES = Object.freeze(LIST.map(([name, parent]) => Object.freeze({ name, parent: parent ? LIST.findIndex((b) => b[0] === parent) : -1 })));
export const QB = Object.freeze(Object.fromEntries(QBONES.map((b, i) => [b.name, i])));
export const QBONE_COUNT = QBONES.length;
/** Floats a frame of a beast's clip takes: three rows of each bone's 3 x 4 skinning matrix. */
export const QFRAME_FLOATS = QBONE_COUNT * 12;

/** A leg's bones by its index: 0 fore left, 1 fore right, 2 hind left, 3 hind right. */
export const LEG_NAMES = ['FL', 'FR', 'HL', 'HR'];
export const LEGS = Object.freeze(LEG_NAMES.map((k) => Object.freeze([QB[`upper${k}`], QB[`lower${k}`], QB[`cannon${k}`], QB[`foot${k}`]])));

/**
 * Each species' joints at rest (metres): the spine's from the pelvis to the
 * skull, a leg's per side (x the left's; the right's mirrored), the toe's
 * tip beyond the foot's joint, and the tracks the riders follow: `seat` (a
 * horse's saddle, an elephant's neck where the mahout sits) and `deck` (an
 * elephant's tower floor), each on a bone.
 *
 *   wolf       a grey wolf of the Apennines: 0.78 m at the shoulder, 1.2 m
 *              from nose to the root of the tail, deep and narrow in the
 *              chest, long-legged, the tail hanging to the hocks
 *   horse      the small horse of the auxiliary cavalry: 1.42 m at the
 *              withers, a short back, fine legs
 *   elephant   the African forest elephant Carthage fielded: 2.4 m at the
 *              shoulder, the back highest at the shoulders and the hips,
 *              the great ears, the trunk to the ground
 *
 * The beasts of the shows, kept in a town's menagerie (vivarium) and taken
 * to the arena (the venationes: Pliny VIII, Martial's book of the shows):
 *
 *   lion       a Barbary (Atlas) lion: 1.1 m at the shoulder, deep in the
 *              chest, the head carried low; a mane (models), the tufted tail
 *   leopard    the panther of the shows (pardus, the "Africanae"): the
 *              lion's frame at two thirds, longer in the leg for its size
 *   bear       a brown bear of the Alps and the Pyrenees, as the shows took
 *              them: 1.0 m at the shoulder hump, walking on the soles of its
 *              feet. `slant` sets its cannons (the hind foot's sole, the
 *              fore paw's) at rest that far from straight down, so a planted
 *              foot lies flat under the heel; the other species have none.
 */
const LION = {
  root: [0, 0.92, -0.62], spine: [0, 0.95, -0.25], chest: [0, 1.0, 0.25], neck: [0, 1.0, 0.5], neck2: [0, 1.06, 0.64], head: [0, 1.1, 0.74], jaw: [0, 1.0, 0.86],
  ear: [0.1, 1.22, 0.72], tail: [[0, 0.9, -0.84], [0, 0.72, -1.04], [0, 0.48, -1.16]], tailEnd: [0, 0.3, -1.24],
  fore: [[0.13, 0.78, 0.38], [0.14, 0.53, 0.27], [0.13, 0.17, 0.33], [0.13, 0.06, 0.37]], foreToe: 0.1,
  hind: [[0.12, 0.86, -0.64], [0.13, 0.6, -0.48], [0.12, 0.27, -0.73], [0.12, 0.06, -0.67]], hindToe: 0.1,
  trunk: null,
  seat: null, deck: null,
};

/** A species' joints scaled by k (a smaller cat on the lion's frame). */
function scaledSpecies(S, k) {
  const sc = (p) => p.map((v) => v * k);
  return {
    ...Object.fromEntries(['root', 'spine', 'chest', 'neck', 'neck2', 'head', 'jaw', 'ear', 'tailEnd'].map((n) => [n, sc(S[n])])),
    tail: S.tail.map(sc), fore: S.fore.map(sc), hind: S.hind.map(sc), foreToe: S.foreToe * k, hindToe: S.hindToe * k,
    trunk: null, seat: null, deck: null,
  };
}

export const SPECIES = Object.freeze({
  wolf: {
    root: [0, 0.66, -0.34], spine: [0, 0.7, -0.12], chest: [0, 0.73, 0.16], neck: [0, 0.73, 0.33], neck2: [0, 0.8, 0.45], head: [0, 0.86, 0.55], jaw: [0, 0.8, 0.6],
    ear: [0.045, 0.93, 0.555], tail: [[0, 0.67, -0.49], [0, 0.6, -0.62], [0, 0.49, -0.74]], tailEnd: [0, 0.36, -0.83],
    fore: [[0.085, 0.53, 0.27], [0.095, 0.35, 0.19], [0.085, 0.13, 0.24], [0.085, 0.05, 0.25]], foreToe: 0.075,
    hind: [[0.08, 0.62, -0.36], [0.09, 0.43, -0.27], [0.085, 0.2, -0.41], [0.085, 0.05, -0.385]], hindToe: 0.07,
    trunk: null,
    seat: null, deck: null,
  },
  horse: {
    root: [0, 1.1, -0.52], spine: [0, 1.18, -0.18], chest: [0, 1.24, 0.3], neck: [0, 1.3, 0.56], neck2: [0, 1.52, 0.78], head: [0, 1.68, 0.92], jaw: [0, 1.52, 1.0],
    ear: [0.055, 1.79, 0.9], tail: [[0, 1.2, -0.76], [0, 1.08, -0.86], [0, 0.86, -0.92]], tailEnd: [0, 0.55, -0.95],
    fore: [[0.15, 0.98, 0.44], [0.16, 0.76, 0.3], [0.145, 0.47, 0.38], [0.145, 0.16, 0.4]], foreToe: 0.1,
    hind: [[0.145, 1.06, -0.54], [0.16, 0.8, -0.37], [0.145, 0.53, -0.64], [0.145, 0.15, -0.6]], hindToe: 0.1,
    trunk: null,
    seat: { bone: 'spine', at: [0, 1.38, -0.02] }, deck: null,
  },
  elephant: {
    root: [0, 2.0, -0.85], spine: [0, 2.22, -0.25], chest: [0, 2.3, 0.45], neck: [0, 2.25, 0.88], neck2: [0, 2.24, 1.02], head: [0, 2.3, 1.18], jaw: [0, 1.78, 1.42],
    ear: [0.36, 2.36, 1.12], tail: [[0, 2.02, -1.3], [0, 1.75, -1.4], [0, 1.4, -1.44]], tailEnd: [0, 1.05, -1.45],
    fore: [[0.42, 1.78, 0.55], [0.44, 1.24, 0.4], [0.43, 0.44, 0.52], [0.43, 0.12, 0.53]], foreToe: 0.16,
    hind: [[0.4, 1.82, -0.86], [0.42, 1.2, -0.66], [0.42, 0.5, -0.88], [0.42, 0.12, -0.84]], hindToe: 0.14,
    trunk: [[0, 2.0, 1.72], [0, 1.45, 1.84], [0, 0.9, 1.86]], trunkEnd: [0, 0.38, 1.8],
    seat: { bone: 'neck2', at: [0, 2.6, 1.0] }, deck: { bone: 'spine', at: [0, 2.47, -0.3] },
  },
  lion: LION,
  leopard: scaledSpecies(LION, 0.64),
  bear: {
    root: [0, 0.84, -0.58], spine: [0, 0.92, -0.2], chest: [0, 0.98, 0.3], neck: [0, 0.92, 0.52], neck2: [0, 0.93, 0.64], head: [0, 0.96, 0.74], jaw: [0, 0.88, 0.92],
    ear: [0.11, 1.08, 0.75], tail: [[0, 0.86, -0.76], [0, 0.82, -0.8], [0, 0.77, -0.83]], tailEnd: [0, 0.73, -0.85],
    fore: [[0.18, 0.82, 0.38], [0.2, 0.5, 0.28], [0.19, 0.16, 0.36], [0.19, 0.05, 0.46]], foreToe: 0.1,
    hind: [[0.17, 0.82, -0.6], [0.18, 0.48, -0.42], [0.17, 0.12, -0.62], [0.17, 0.04, -0.44]], hindToe: 0.1,
    slant: [0.74, 1.15],
    trunk: null,
    seat: null, deck: null,
  },
  // The villages' flocks (models/villages.js): the small beasts of the Iron Age hills. A goat some 70 cm at the
  // withers, lean and leggy, its tail held up; a sheep a little lower and deeper in the body, its long tail hanging.
  goat: {
    root: [0, 0.62, -0.3], spine: [0, 0.66, -0.1], chest: [0, 0.69, 0.15], neck: [0, 0.72, 0.28], neck2: [0, 0.84, 0.38], head: [0, 0.94, 0.45], jaw: [0, 0.86, 0.52],
    ear: [0.04, 0.95, 0.44], tail: [[0, 0.68, -0.42], [0, 0.72, -0.46], [0, 0.76, -0.49]], tailEnd: [0, 0.79, -0.5],
    fore: [[0.075, 0.58, 0.19], [0.08, 0.44, 0.13], [0.075, 0.25, 0.17], [0.075, 0.075, 0.18]], foreToe: 0.05,
    hind: [[0.075, 0.6, -0.32], [0.08, 0.44, -0.22], [0.075, 0.27, -0.35], [0.075, 0.075, -0.33]], hindToe: 0.05,
    trunk: null,
    seat: null, deck: null,
  },
  sheep: {
    root: [0, 0.55, -0.32], spine: [0, 0.59, -0.1], chest: [0, 0.61, 0.15], neck: [0, 0.62, 0.29], neck2: [0, 0.69, 0.39], head: [0, 0.75, 0.47], jaw: [0, 0.69, 0.53],
    ear: [0.05, 0.76, 0.45], tail: [[0, 0.56, -0.45], [0, 0.46, -0.48], [0, 0.34, -0.49]], tailEnd: [0, 0.22, -0.49],
    fore: [[0.08, 0.5, 0.19], [0.085, 0.37, 0.14], [0.08, 0.21, 0.17], [0.08, 0.065, 0.18]], foreToe: 0.045,
    hind: [[0.08, 0.52, -0.34], [0.085, 0.37, -0.25], [0.08, 0.22, -0.37], [0.08, 0.065, -0.35]], hindToe: 0.045,
    trunk: null,
    seat: null, deck: null,
  },
});

/** Each species' joints at rest, indexed by bone ([x, y, z]); unused bones (a wolf's trunk) sit on the head. */
export function restJoints(species) {
  const S = SPECIES[species];
  const J = new Array(QBONE_COUNT);
  J[QB.root] = S.root; J[QB.spine] = S.spine; J[QB.chest] = S.chest; J[QB.neck] = S.neck; J[QB.neck2] = S.neck2; J[QB.head] = S.head; J[QB.jaw] = S.jaw;
  J[QB.earL] = S.ear; J[QB.earR] = [-S.ear[0], S.ear[1], S.ear[2]];
  J[QB.tail1] = S.tail[0]; J[QB.tail2] = S.tail[1]; J[QB.tail3] = S.tail[2];
  for (let l = 0; l < 4; l++) {
    const src = l < 2 ? S.fore : S.hind;
    const s = l % 2 === 0 ? 1 : -1;
    LEGS[l].forEach((b, k) => { J[b] = [s * src[k][0], src[k][1], src[k][2]]; });
  }
  const tr = S.trunk || [S.head, S.head, S.head];
  J[QB.trunk1] = tr[0]; J[QB.trunk2] = tr[1]; J[QB.trunk3] = tr[2];
  return J.map((p) => Object.freeze(p.slice()));
}

const REST = Object.fromEntries(Object.keys(SPECIES).map((k) => [k, restJoints(k)]));

// ---------------------------------------------------------------------------
// A pose
// ---------------------------------------------------------------------------

const _e = new Euler();
const _m = new Matrix4();
const _n = new Matrix4();
const _v = new Vector3();

/** The angle of (y, z) in the leg's plane: a rotation about x adds to it. */
const angYZ = (y, z) => Math.atan2(z, y);

/**
 * Where a circle about (ay, az) of radius ra meets one about (dy, dz) of
 * radius rd: of the two points, the one nearer `near`; if they do not meet,
 * the point of the second nearest the first's centre.
 */
function circleMeet(ay, az, ra, dy, dz, rd, near) {
  const ey = ay - dy;
  const ez = az - dz;
  const d = Math.hypot(ey, ez) || 1e-6;
  const uy = ey / d;
  const uz = ez / d;
  if (d > ra + rd || d < Math.abs(ra - rd)) return [dy + uy * rd, dz + uz * rd];
  const x = (rd * rd - ra * ra + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, rd * rd - x * x));
  const p1 = [dy + uy * x - uz * h, dz + uz * x + uy * h];
  const p2 = [dy + uy * x + uz * h, dz + uz * x - uy * h];
  const d1 = Math.hypot(p1[0] - near[0], p1[1] - near[1]);
  const d2 = Math.hypot(p2[0] - near[0], p2[1] - near[1]);
  return d1 <= d2 ? p1 : p2;
}

/**
 * A beast's pose: the root's place and turn, FK rotations a bone (Euler YXZ
 * in the parent's frame, as the people's), and each leg either by its
 * rotations or by a target for its foot's joint (the fetlock, the paw's
 * knuckle) in the beast's own frame, the cannon's slant and the foot's pitch:
 * the elbow (fore) or the stifle (hind) found by a two-bone solver in the
 * leg's plane. Signs: a leg pointing down swings forward with a negative x
 * rotation; the spine pitches nose-down with a positive one.
 */
export class QPose {
  constructor(species) {
    this.species = species;
    this.J = REST[species];
    // (A plantigrade's cannons at rest off straight down: SPECIES.bear.slant. None for the others.)
    this.slant = SPECIES[species].slant || [0, 0];
    this.world = QBONES.map(() => new Matrix4());
    this.local = QBONES.map(() => [0, 0, 0]);
    this.reset();
  }

  reset() {
    for (const r of this.local) r[0] = r[1] = r[2] = 0;
    this.rootAt = [0, 0, 0];
    this.rootRot = [0, 0, 0];
    this.targets = [null, null, null, null];
    return this;
  }

  root(x, y, z, rx = 0, ry = 0, rz = 0) {
    this.rootAt = [x, y, z];
    this.rootRot = [rx, ry, rz];
    return this;
  }

  rot(bone, rx = 0, ry = 0, rz = 0) {
    const r = this.local[typeof bone === 'string' ? QB[bone] : bone];
    r[0] += rx; r[1] += ry; r[2] += rz;
    return this;
  }

  /**
   * Leg `l`'s foot joint at (y, z) of the beast's frame (its x stays the
   * leg's own), the cannon slanted `cannon` rad from straight down (+ its
   * lower end forward), the foot pitched `pitch` (+ the toes down).
   */
  leg(l, y, z, cannon = 0, pitch = 0) {
    this.targets[l] = { y, z, cannon, pitch };
    return this;
  }

  solve() {
    const J = this.J;
    const W = this.world;
    _e.set(this.rootRot[0], this.rootRot[1], this.rootRot[2], 'YXZ');
    W[0].makeRotationFromEuler(_e).setPosition(J[0][0] + this.rootAt[0], J[0][1] + this.rootAt[1], J[0][2] + this.rootAt[2]);
    const fk = (i) => {
      const p = QBONES[i].parent;
      _e.set(this.local[i][0], this.local[i][1], this.local[i][2], 'YXZ');
      _m.makeRotationFromEuler(_e);
      _n.makeTranslation(J[i][0] - J[p][0], J[i][1] - J[p][1], J[i][2] - J[p][2]);
      W[i].multiplyMatrices(W[p], _n).multiply(_m);
    };
    for (const n of ['spine', 'chest', 'neck', 'neck2', 'head', 'jaw', 'earL', 'earR', 'tail1', 'tail2', 'tail3', 'trunk1', 'trunk2', 'trunk3']) fk(QB[n]);
    for (let l = 0; l < 4; l++) {
      const [a, b, c, d] = LEGS[l];
      const t = this.targets[l];
      if (!t) {
        fk(a); fk(b); fk(c); fk(d);
        continue;
      }
      // The leg's top where its parent (the thorax, the pelvis) carries it.
      const p = QBONES[a].parent;
      _v.set(J[a][0] - J[p][0], J[a][1] - J[p][1], J[a][2] - J[p][2]).applyMatrix4(W[p]);
      const A = [_v.x, _v.y, _v.z];
      const l1 = Math.hypot(J[b][1] - J[a][1], J[b][2] - J[a][2]);
      const l2 = Math.hypot(J[c][1] - J[b][1], J[c][2] - J[b][2]);
      const l3 = Math.hypot(J[d][1] - J[c][1], J[d][2] - J[c][2]);
      if (l < 2) {
        // The shoulder blade swings about its top over the withers: the shoulder joint goes forward with
        // a leg reaching forward and back with one pushing back (most of a forelimb's reach in a stride).
        const lean = Math.atan2(t.z - A[2], A[1] - t.y);
        const s = Math.max(-0.6, Math.min(0.6, lean * 0.8));
        const r = (A[1] - t.y) * 0.45;
        A[1] += r * (1 - Math.cos(s)) * -1;
        A[2] += r * Math.sin(s);
      }
      // The foot's joint, kept within the leg's reach (a foot left behind lifts off the ground, rolled onto its toe).
      const D = [t.y, t.z];
      const reach = l1 + l2 + l3 - 1e-3;
      const ad = Math.hypot(D[0] - A[1], D[1] - A[2]);
      if (ad > reach) {
        D[0] = A[1] + ((D[0] - A[1]) * reach) / ad;
        D[1] = A[2] + ((D[1] - A[2]) * reach) / ad;
      }
      // The cannon's top: up its slant from the foot's joint, or tipped toward the leg's top when the two
      // bones above cannot reach it otherwise (the heel lifting as the stride ends).
      const cannon = t.cannon + this.slant[l < 2 ? 0 : 1];
      let C = [D[0] + Math.cos(cannon) * l3, D[1] - Math.sin(cannon) * l3];
      const L2 = l1 + l2 - 1e-3;
      if (Math.hypot(C[0] - A[1], C[1] - A[2]) > L2) C = circleMeet(A[1], A[2], L2, D[0], D[1], l3, C);
      // The two-bone solve in the leg's plane: the elbow behind the line (fore), the stifle before it (hind).
      let dy = C[0] - A[1];
      let dz = C[1] - A[2];
      let dist = Math.hypot(dy, dz) || 1e-6;
      const uy = dy / dist;
      const uz = dz / dist;
      dist = Math.min(Math.max(dist, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
      const along = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
      const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
      const bend = l < 2 ? -1 : 1;
      // (The perpendicular in the plane, pointed the way the joint bends: -z for an elbow, +z a stifle.)
      let py = -uz;
      let pz = uy;
      if (pz * bend < 0) { py = -py; pz = -pz; }
      const B = [A[1] + uy * along + py * h, A[2] + uz * along + pz * h];
      const Cr = [A[1] + uy * dist, A[2] + uz * dist];
      const set = (bone, child, from, to) => {
        const rest = angYZ(J[child][1] - J[bone][1], J[child][2] - J[bone][2]);
        const now = angYZ(to[0] - from[0], to[1] - from[1]);
        W[bone].makeRotationX(now - rest);
        // (x stays the leg's own at rest, moved as the top is: the parent's roll carries the whole leg.)
        W[bone].setPosition(A[0] + J[bone][0] - J[a][0], from[0], from[1]);
      };
      set(a, b, [A[1], A[2]], B);
      set(b, c, B, Cr);
      set(c, d, Cr, D);
      // (A foot lifted off its mark rolls onto its toe.)
      const lifted = Math.max(0, D[0] - t.y);
      W[d].makeRotationX(t.pitch + Math.min(1.2, lifted * 12)).setPosition(A[0] + J[d][0] - J[a][0], D[0], D[1]);
    }
    return this;
  }

  /** The pose's skinning matrices (world x translate(-rest)), 12 floats a bone, into `out` at `offset`. */
  write(out, offset = 0) {
    const J = this.J;
    for (let i = 0; i < QBONE_COUNT; i++) {
      const e = this.world[i].elements;
      const r = J[i];
      const o = offset + i * 12;
      out[o] = e[0]; out[o + 1] = e[4]; out[o + 2] = e[8]; out[o + 3] = e[12] - (e[0] * r[0] + e[4] * r[1] + e[8] * r[2]);
      out[o + 4] = e[1]; out[o + 5] = e[5]; out[o + 6] = e[9]; out[o + 7] = e[13] - (e[1] * r[0] + e[5] * r[1] + e[9] * r[2]);
      out[o + 8] = e[2]; out[o + 9] = e[6]; out[o + 10] = e[10]; out[o + 11] = e[14] - (e[2] * r[0] + e[6] * r[1] + e[10] * r[2]);
    }
    return out;
  }

  /** A point given at rest on bone `bone` where the pose carries it. */
  carry(bone, at) {
    const i = typeof bone === 'string' ? QB[bone] : bone;
    const r = this.J[i];
    return new Vector3(at[0] - r[0], at[1] - r[1], at[2] - r[2]).applyMatrix4(this.world[i]);
  }

  /** A bone's joint where the pose puts it. */
  jointOf(bone) {
    const i = typeof bone === 'string' ? QB[bone] : bone;
    return new Vector3().setFromMatrixPosition(this.world[i]);
  }
}

// ---------------------------------------------------------------------------
// Gaits
// ---------------------------------------------------------------------------

/**
 * A gait: its stride (metres a loop), each leg's phase (0 its foot set
 * down; legs in LEGS order: FL, FR, HL, HR), the share of the loop a foot is
 * down (duty), how high a foot lifts, how far the lower leg folds as it
 * swings (fore, hind: the cannon's slant, rad), the body's bob and pitch.
 */
export const GAITS = Object.freeze({
  // (A foot's ground while it is down, stride x duty, is held within what its leg reaches: about 0.5 m a
  // wolf's, 0.9 m a horse's, 1.3 m an elephant's, whose straight legs swing like a pendulum's.)
  'wolf:walk': { stride: 0.9, phase: [0.25, 0.75, 0, 0.5], duty: 0.6, lift: 0.07, fold: [-0.9, 0.7], bob: 0.012 },
  'wolf:trot': { stride: 1.6, phase: [0, 0.5, 0.5, 0], duty: 0.28, lift: 0.1, fold: [-1.2, 0.95], bob: 0.02 },
  'wolf:lope': { stride: 1.75, phase: [0.42, 0.52, 0, 0.1], duty: 0.24, bias: [-0.08, -0.02], lift: 0.12, fold: [-1.5, 1.2], bob: 0.03, flex: 0.12 },
  'wolf:stalk': { stride: 0.6, phase: [0.25, 0.75, 0, 0.5], duty: 0.7, lift: 0.06, fold: [-1.0, 0.8], bob: 0.006, low: 0.13 },
  'horse:walk': { stride: 1.6, phase: [0.25, 0.75, 0, 0.5], duty: 0.58, lift: 0.1, fold: [-1.0, 0.8], bob: 0.02 },
  'horse:canter': { stride: 2.9, phase: [0.3, 0.55, 0, 0.3], duty: 0.26, bias: [-0.03, 0], lift: 0.16, fold: [-1.5, 1.1], bob: 0.05, flex: 0.06 },
  'horse:gallop': { stride: 3.4, phase: [0.38, 0.5, 0, 0.12], duty: 0.22, bias: [-0.04, 0], lift: 0.18, fold: [-1.6, 1.2], bob: 0.06, flex: 0.08 },
  'elephant:walk': { stride: 2.0, phase: [0.25, 0.75, 0, 0.5], duty: 0.62, lift: 0.14, fold: [-0.35, 0.3], bob: 0.03, low: 0.08 },
  // A team exercised round a stable's yard (models/factio.js): the trot's diagonal pairs, a moment of flight between.
  'horse:trot': { stride: 2.5, phase: [0, 0.5, 0.5, 0], duty: 0.4, lift: 0.15, fold: [-1.35, 1.05], bob: 0.035 },
  // The big cats pace their cages (models/vivarium.js): a long low walk, the head carried under the line of the back.
  'lion:walk': { stride: 1.3, phase: [0.25, 0.75, 0, 0.5], duty: 0.62, lift: 0.075, fold: [-1.0, 0.8], bob: 0.014 },
  'leopard:walk': { stride: 0.95, phase: [0.25, 0.75, 0, 0.5], duty: 0.62, lift: 0.06, fold: [-1.0, 0.8], bob: 0.01 },
  // A bear's amble: short steps, the feet set down flat, the weight rolling from side to side.
  'bear:walk': { stride: 1.05, phase: [0.25, 0.75, 0, 0.5], duty: 0.66, lift: 0.075, fold: [-0.55, 0.45], bob: 0.018 },
  // The villages' goats and sheep (models/villages.js): a short-stepping walk about the fold.
  'goat:walk': { stride: 0.72, phase: [0.25, 0.75, 0, 0.5], duty: 0.6, lift: 0.055, fold: [-0.95, 0.75], bob: 0.01 },
  'sheep:walk': { stride: 0.62, phase: [0.25, 0.75, 0, 0.5], duty: 0.62, lift: 0.045, fold: [-0.9, 0.7], bob: 0.01 },
});

/**
 * A leg's foot on gait `G` at loop phase t: planted (its ground moving back
 * at the stride's speed), then swung forward in an arc with the lower leg
 * folded. Returns { y, z (from the foot's rest), cannon, pitch, down }.
 */
export function gaitFoot(G, l, t) {
  const p = wrap1(t - G.phase[l]);
  const D = G.duty;
  const S = G.stride;
  const fore = l < 2;
  // (A gait's stance may sit back of the leg's rest: a galloper's fore feet land nearer under it.)
  const bias = G.bias ? G.bias[fore ? 0 : 1] : 0;
  if (p < D) {
    const s = p / D;
    // Back at the stride's speed: S a loop, so S x D while down. Rolled onto the toe as it leaves.
    const roll = smooth(clamp01((s - 0.75) / 0.25));
    return { y: 0, z: S * D * (0.5 - s) + bias, cannon: (fore ? -0.12 : 0.1) * roll, pitch: 0.35 * roll, down: 1 };
  }
  const u = (p - D) / (1 - D);
  const k = smooth(u);
  const fold = fore ? G.fold[0] : G.fold[1];
  return {
    y: G.lift * Math.sin(Math.PI * u) * (fore ? 1 : 0.85),
    z: S * D * (-0.5 + k) + bias + 0.04 * S * Math.sin(Math.PI * u) * (fore ? 1 : -0.5),
    cannon: fold * Math.sin(Math.PI * Math.min(1, u * 1.15)),
    pitch: (fore ? 0.9 : 0.6) * Math.sin(Math.PI * u) * (1 - u * 0.5),
    down: 0,
  };
}

/** Put every leg of pose P on gait G at phase t (the hips and the shoulders lowered by `low`). */
function walkLegs(P, G, t, low = 0) {
  const J = P.J;
  for (let l = 0; l < 4; l++) {
    const f = gaitFoot(G, l, t);
    const rest = J[LEGS[l][3]];
    P.leg(l, rest[1] + f.y, rest[2] + f.z, f.cannon, f.pitch);
  }
  return low;
}

// ---------------------------------------------------------------------------
// The clips
// ---------------------------------------------------------------------------

/** How many feet are down at phase t (the tests: a gallop has its flights, a walk never). */
export function feetDown(gait, t) {
  const G = GAITS[gait];
  let n = 0;
  for (let l = 0; l < 4; l++) n += gaitFoot(G, l, t).down;
  return n;
}

/** A standing beast's idle: breathing, the weight shifting, the head looking about, the tail swinging. */
function standIdle(P, t, o = {}) {
  const { look = 1, tail = 1, sp = 'wolf' } = o;
  const shift = Math.tanh(2 * sn(t, 1, 0.1)) * 0.012;
  P.root(shift, 0.004 * sn(t, 4), 0, 0.006 * sn(t, 4), 0, shift * 0.8);
  P.rot('chest', -0.01 * sn(t, 4), 0, 0);
  const yaw = look * 0.35 * Math.tanh(2.2 * sn(t, 2, 0.2)) * (0.6 + 0.4 * cs(t, 1));
  P.rot('neck', 0.04 * sn(t, 3, 0.4), yaw * 0.4, 0);
  P.rot('neck2', 0.03 * sn(t, 3, 0.5), yaw * 0.3, 0);
  P.rot('head', 0.05 * sn(t, 3, 0.6) + 0.03, yaw * 0.3, 0.04 * sn(t, 2));
  if (sp === 'wolf' || PROWLERS.has(sp)) {
    // The ears turning to sounds, flicked back now and then.
    P.rot('earL', 0, 0.2 * Math.tanh(3 * sn(t, 3, 0.1)), 0);
    P.rot('earR', 0, -0.2 * Math.tanh(3 * sn(t, 3, 0.35)), 0);
  } else if (sp === 'horse') {
    P.rot('earL', 0.1 * sn(t, 2, 0.3), 0.3 * Math.tanh(3 * sn(t, 3, 0.1)), 0);
    P.rot('earR', 0.1 * sn(t, 2, 0.6), -0.3 * Math.tanh(3 * sn(t, 3, 0.35)), 0);
  } else {
    // An elephant fans its ears and swings its trunk.
    P.rot('earL', 0, 0.35 + 0.3 * sn(t, 4), 0);
    P.rot('earR', 0, -0.35 - 0.3 * sn(t, 4, 0.2), 0);
    P.rot('trunk1', 0.1 + 0.08 * sn(t, 2), 0.12 * sn(t, 1), 0);
    P.rot('trunk2', 0.12 + 0.1 * sn(t, 2, 0.15), 0.15 * sn(t, 1, 0.1), 0);
    P.rot('trunk3', 0.2 + 0.15 * sn(t, 2, 0.3), 0.2 * sn(t, 1, 0.2), 0);
  }
  P.rot('tail1', 0.05, tail * 0.25 * sn(t, 2), 0);
  P.rot('tail2', 0.05, tail * 0.25 * sn(t, 2, 0.1), 0);
  P.rot('tail3', 0, tail * 0.25 * sn(t, 2, 0.2), 0);
  // The feet planted under it, one hind eased now and then.
  const J = P.J;
  for (let l = 0; l < 4; l++) {
    const r = J[LEGS[l][3]];
    const ease = l === 2 ? Math.max(0, shift) * 2 : l === 3 ? Math.max(0, -shift) * 2 : 0;
    P.leg(l, r[1] + ease * 0.6, r[2], ease * 4, ease * 6);
  }
}

/** The body over a moving gait: the bob (twice a loop for a trot or a walk, once for a gallop), the pitch, the spine's fold. */
function gaitBody(P, G, t, sp, o = {}) {
  const once = G.flex !== undefined;
  const bob = once ? G.bob * (0.5 + 0.5 * cs(t, 1, -0.12)) : G.bob * (0.5 + 0.5 * cs(t, 2));
  const pitch = once ? 0.07 * sn(t, 1, 0.1) : 0.012 * sn(t, 2, 0.1);
  const low = G.low || 0;
  P.root(0, bob - low, 0, pitch + (o.lean || 0), 0, 0.012 * sn(t, 1));
  if (once) {
    // The back folds (the hinds reaching under) and stretches (the fores reaching out), once a loop.
    const flex = G.flex * sn(t, 1, -0.05);
    P.rot('spine', -flex, 0, 0);
    P.rot('chest', -flex * 0.8, 0, 0);
  }
  // The head and neck balance the stride: nodding against the pitch (a horse's most at the walk and the gallop).
  const nod = sp === 'horse' ? (once ? 0.12 * sn(t, 1, 0.35) : 0.06 * sn(t, 2, 0.2)) : sp === 'wolf' || PROWLERS.has(sp) ? (once ? 0.08 * sn(t, 1, 0.3) : 0.02 * sn(t, 2)) : 0.03 * sn(t, 2);
  P.rot('neck', -pitch * 0.6 + nod + (o.neck || 0), 0, 0);
  P.rot('neck2', nod * 0.6, 0, 0);
  P.rot('head', -nod * 0.5 + (o.head || 0), 0, 0);
  P.rot('tail1', o.tail ?? 0, 0.06 * sn(t, 1), 0);
  P.rot('tail2', (o.tail ?? 0) * 0.5 + 0.1 * sn(t, 1, 0.2) * (once ? 1 : 0.3), 0.08 * sn(t, 1, 0.1), 0);
  P.rot('tail3', 0.1 * sn(t, 1, 0.35) * (once ? 1 : 0.3), 0.1 * sn(t, 1, 0.2), 0);
  if (sp === 'wolf') {
    // The ears laid back at speed, pricked at a walk.
    const back = once ? -0.5 : -0.15;
    P.rot('earL', back, 0, 0);
    P.rot('earR', back, 0, 0);
  } else if (sp === 'elephant') {
    P.rot('earL', 0, 0.3 + 0.15 * sn(t, 2), 0);
    P.rot('earR', 0, -0.3 - 0.15 * sn(t, 2, 0.2), 0);
    P.rot('trunk1', 0.12, 0.08 * sn(t, 1), 0);
    P.rot('trunk2', 0.14 + 0.08 * sn(t, 2), 0.1 * sn(t, 1, 0.15), 0);
    P.rot('trunk3', 0.22 + 0.12 * sn(t, 2, 0.2), 0.15 * sn(t, 1, 0.3), 0);
  }
  walkLegs(P, G, t);
}

/** Lying dead on the left side (the fall's end): the legs loose, the head down. */
function deadPose(P, sp, k) {
  const J = P.J;
  // The pelvis's joint down to a body's half width over the ground, rolled onto the side.
  const half = sp === 'elephant' ? 0.75 : sp === 'horse' ? 0.36 : 0.16;
  // (It sinks first, the legs giving, then rolls over onto its side.)
  const roll = smooth(clamp01((k - 0.25) / 0.75));
  P.root(0, lerp(0, half - J[QB.root][1] + 0.02, smooth(k)), 0, 0.1 * Math.sin(Math.PI * k), 0, lerp(0, Math.PI / 2 - 0.12, roll));
  P.rot('neck', lerp(0, -0.3, k), 0, lerp(0, -0.25, k));
  P.rot('head', lerp(0, 0.2, k), 0, lerp(0, -0.25, k));
  P.rot('jaw', lerp(0, 0.18, k), 0, 0);
  P.rot('tail1', lerp(0, -0.2, k), 0, 0);
  P.rot('tail2', lerp(0, 0.3, k), 0, 0);
  for (let l = 0; l < 4; l++) {
    const [a, b, c] = LEGS[l];
    const fore = l < 2;
    // Splayed and bent a little, the upper legs further out.
    P.rot(a, lerp(0, fore ? -0.5 : 0.3, k), 0, lerp(0, (l % 2 === 0 ? 0.25 : -0.1), k));
    P.rot(b, lerp(0, fore ? 0.4 : -0.5, k), 0, 0);
    P.rot(c, lerp(0, fore ? -0.6 : 0.45, k), 0, 0);
  }
}

/**
 * Each species' clips: { dur, fps, gait (its GAITS key: played by the
 * distance covered), pose(P, t) }. A clip is a loop (whole waves and qtrack
 * keys round it), so its end runs into its start; `fall` collapses in its
 * first half and is played held at FALL_HOLD (units/motion.js), its second
 * half bringing it back to its feet only so the loop closes.
 */
export const FALL_HOLD = 0.45;

function fallPose(P, t, sp) {
  // Struck, a stagger, the legs give, down on the side by FALL_HOLD; held, then (unseen) back up.
  // (The legs by their rotations throughout: over half a second nobody sees a hoof leave the ground.)
  const k = qtrack(t, [[0, 0], [0.08, 0.05], [0.32, 0.85], [0.42, 1], [0.9, 1], [0.97, 0]]);
  deadPose(P, sp, k);
}

/**
 * A big cat's clips (`sp` lion or leopard: one frame, two sizes): standing
 * with the tail's tip flicking; the pacing walk (the head low, the shoulder
 * blades rolling over the back); lying as a sphinx, the head up, breathing,
 * the tail's tip curling; the roar (the head raised, the jaws wide, the
 * flanks heaving), each from what a caged cat does all day.
 */
function catClips(sp) {
  return {
    [`${sp}:stand`]: {
      dur: 8, fps: 10,
      pose(P, t) {
        standIdle(P, t, { sp, look: 0.8, tail: 0.6 });
        // The tail hangs in its curve, the tip flicking (a cat's tail is never still).
        P.rot('tail1', 0.25, 0, 0);
        P.rot('tail2', 0.15, 0.25 * sn(t, 3, 0.2), 0);
        P.rot('tail3', -0.35 + 0.15 * sn(t, 4), 0.45 * sn(t, 3, 0.35), 0);
        P.rot('neck', 0.08, 0, 0);
      },
    },
    [`${sp}:walk`]: {
      dur: 1.25, fps: 30, gait: `${sp}:walk`,
      pose(P, t) {
        gaitBody(P, GAITS[`${sp}:walk`], t, sp, { neck: 0.22, head: -0.06, tail: 0.25 });
        // The shoulder blades roll over the back with each fore step; the tail's low curve swings.
        P.rot('chest', 0, 0.04 * sn(t, 1, 0.25), 0.03 * sn(t, 1, 0.25));
        P.rot('tail2', 0.1, 0.12 * sn(t, 1, 0.3), 0);
        P.rot('tail3', -0.3, 0.2 * sn(t, 1, 0.45), 0);
      },
    },
    [`${sp}:lie`]: { dur: 10, fps: 6, pose(P, t) { catLie(P, t); } },
    [`${sp}:roar`]: {
      dur: 6, fps: 20,
      pose(P, t) {
        const roar = qtrack(t, [[0, 0], [0.22, 0], [0.3, 1], [0.48, 0.9], [0.58, 0]]);
        standIdle(P, t, { sp, look: 0.2, tail: 0.4 });
        // Weight back a little, the chest lifted, the head thrown up, the jaws wide; the flanks heave.
        P.root(0, 0.01 * roar, -0.03 * roar, -0.06 * roar, 0, 0);
        P.rot('chest', -0.05 * roar + 0.02 * sn(t * 6, 1) * roar, 0, 0);
        P.rot('neck', -0.25 * roar, 0, 0);
        P.rot('neck2', -0.15 * roar, 0, 0);
        P.rot('head', -0.2 * roar, 0, 0);
        P.rot('jaw', 0.62 * roar, 0, 0);
        P.rot('earL', -0.35 * roar, 0, 0);
        P.rot('earR', -0.35 * roar, 0, 0);
        P.rot('tail1', 0.25, 0, 0);
        P.rot('tail3', -0.3 + 0.4 * roar, 0.3 * sn(t, 2), 0);
      },
    },
  };
}

/**
 * Lying as a sphinx: the body down on the belly, the hinds folded under to
 * one side, the forelegs out before the chest, the head up and turning,
 * breathing; the tail along the ground, its tip curling now and then.
 */
function catLie(P, t) {
  const J = P.J;
  // (The pelvis's joint down to the body's half depth over the ground: 0.3 of the frame's height.)
  const h = J[QB.chest][1];
  P.root(0.04 * h, 0.4 * h - J[QB.root][1] + 0.004 * h * sn(t, 3), 0.03 * h, -0.04, 0, 0.12);
  P.rot('spine', 0, 0, 0.04);
  P.rot('chest', -0.1 + 0.012 * sn(t, 3), 0, 0);
  P.rot('neck', -0.3, 0.35 * Math.tanh(2 * sn(t, 1, 0.2)), 0);
  P.rot('neck2', 0.05, 0, 0);
  P.rot('head', 0.28 + 0.04 * sn(t, 2), 0.2 * Math.tanh(2 * sn(t, 1, 0.2)), 0);
  P.rot('jaw', 0.03 + 0.03 * Math.max(0, sn(t, 1, 0.7)), 0, 0);
  P.rot('earL', -0.1 + 0.15 * Math.tanh(3 * sn(t, 2, 0.1)), 0, 0);
  P.rot('earR', -0.1 + 0.15 * Math.tanh(3 * sn(t, 2, 0.4)), 0, 0);
  // The tail laid out to the side along the ground, the tip lifting and curling.
  P.rot('tail1', 0.9, 0.7, 0);
  P.rot('tail2', 0.25, 0.4, 0);
  P.rot('tail3', -0.2 - 0.25 * Math.max(0, sn(t, 2, 0.3)), 0.3 + 0.3 * sn(t, 2, 0.3), 0);
  // The forepaws flat on the ground before the chest, the forearms along it (their feet by targets).
  for (const l of [0, 1]) {
    const r = J[LEGS[l][3]];
    P.leg(l, r[1], r[2] + 0.55 * h + (l ? 0.04 * h : 0), 1.25, -0.1);
  }
  for (const l of [2, 3]) {
    const [a, b, c, d] = LEGS[l];
    P.rot(a, -1.25, 0, l === 2 ? 0.4 : 0.15);
    P.rot(b, 2.05, 0, 0);
    P.rot(c, -1.5, 0, 0);
    P.rot(d, 1.4, 0, 0);
  }
}

/** A bear standing: the head low and swinging, scenting; the weight rocking from fore foot to fore foot. */
function bearStand(P, t) {
  standIdle(P, t, { sp: 'bear', look: 0.7, tail: 0.1 });
  P.rot('neck', 0.18 + 0.06 * sn(t, 2, 0.1), 0, 0);
  P.rot('head', -0.05 + 0.08 * Math.max(0, sn(t, 3, 0.4)), 0.15 * sn(t, 1, 0.3), 0);
  P.rot('chest', 0, 0, 0.03 * sn(t, 2, 0.15));
}

/**
 * A bear rising: up onto its hind feet about the hips (planted, flat), the
 * forepaws hanging before the chest, the head levelled to scent the air
 * and turning; held; down onto all fours again. On all fours the fore feet
 * stand by their targets; risen, the forelegs hang by their rotations.
 */
function bearRise(P, t) {
  const k = qtrack(t, [[0, 0], [0.2, 0], [0.38, 1], [0.72, 1], [0.88, 0]]);
  bearStand(P, t);
  const J = P.J;
  P.root(0, 0.14 * k, -0.06 * k, -1.18 * k, 0.12 * k * sn(t, 1, 0.2), 0);
  P.rot('spine', -0.12 * k, 0, 0);
  P.rot('chest', -0.06 * k, 0, 0);
  P.rot('neck', 0.85 * k, 0.25 * k * sn(t, 2, 0.1), 0);
  P.rot('head', 0.3 * k - 0.12 * k * Math.max(0, sn(t, 4)), 0, 0);
  if (k > 0.02) {
    P.targets[0] = null;
    P.targets[1] = null;
    for (const l of [0, 1]) {
      const [a, b, c, d] = LEGS[l];
      P.rot(a, 0.95 * k, 0, (l === 0 ? 0.12 : -0.12) * k);
      P.rot(b, -0.9 * k, 0, 0);
      P.rot(c, 0.5 * k, 0, 0);
      P.rot(d, 0.6 * k, 0, 0);
    }
  }
  for (const l of [2, 3]) {
    const r = J[LEGS[l][3]];
    P.leg(l, r[1], r[2] + 0.04 * k, 0, 0);
  }
}

export const BEAST_CLIPS = Object.freeze({
  // --- The wolf ------------------------------------------------------------
  'wolf:stand': { dur: 8, fps: 10, pose(P, t) { standIdle(P, t, { sp: 'wolf' }); } },
  'wolf:walk': { dur: 1.1, fps: 30, gait: 'wolf:walk', pose(P, t) { gaitBody(P, GAITS['wolf:walk'], t, 'wolf', { tail: -0.1 }); } },
  'wolf:trot': { dur: 0.62, fps: 40, gait: 'wolf:trot', pose(P, t) { gaitBody(P, GAITS['wolf:trot'], t, 'wolf', { neck: 0.25, head: -0.1, tail: 0.1 }); } },
  'wolf:lope': { dur: 0.45, fps: 48, gait: 'wolf:lope', pose(P, t) { gaitBody(P, GAITS['wolf:lope'], t, 'wolf', { neck: 0.3, head: -0.2, tail: -0.25 }); } },
  // The stalk: the body low, the head level with the back, stiff-legged and slow; the tail straight out.
  'wolf:stalk': { dur: 1.6, fps: 24, gait: 'wolf:stalk', pose(P, t) { gaitBody(P, GAITS['wolf:stalk'], t, 'wolf', { neck: 0.5, head: -0.35, tail: -0.35, lean: 0.04 }); } },
  // The bite: a crouch, the lunge (the jaws open), the snap at 0.35, back; the hackles and tail up.
  'wolf:bite': {
    dur: 1.2, fps: 30,
    pose(P, t) {
      const lunge = qtrack(t, [[0, 0], [0.12, -0.35], [0.3, 1], [0.4, 0.85], [0.7, 0]]);
      const open = qtrack(t, [[0, 0.1], [0.2, 0.15], [0.29, 0.75], [0.35, 0], [0.42, 0.4], [0.5, 0], [0.75, 0.25]]);
      standIdle(P, t, { look: 0, tail: 0.3, sp: 'wolf' });
      P.targets = [null, null, null, null];
      P.root(0, -0.06 - 0.05 * Math.max(0, -lunge), 0.13 * lunge, 0.12 + 0.08 * lunge, 0, 0);
      P.rot('neck', 0.3 + 0.2 * lunge, 0.1 * sn(t, 1), 0);
      P.rot('neck2', 0.1, 0, 0);
      P.rot('head', -0.2 - 0.15 * lunge, 0, 0.1 * sn(t, 2));
      P.rot('jaw', 0.5 * open, 0, 0);
      P.rot('earL', -0.4, 0, 0);
      P.rot('earR', -0.4, 0, 0);
      P.rot('tail1', -0.25, 0, 0);
      const J = P.J;
      for (let l = 0; l < 4; l++) {
        const r = J[LEGS[l][3]];
        // The hinds braced back, the fores planted forward.
        const dz = l < 2 ? 0.06 + 0.06 * Math.max(0, lunge) : -0.08;
        P.leg(l, r[1], r[2] + dz, l < 2 ? 0.15 : 0.3, 0);
      }
    },
  },
  // Lying at rest (the pack at its spot): the hinds tucked under, the fores out before it, the head up, breathing.
  'wolf:lie': {
    dur: 9, fps: 6,
    pose(P, t) {
      const J = P.J;
      const down = 0.22 - J[QB.root][1] + 0.08;
      P.root(0.04, down + 0.004 * sn(t, 3), 0.02, -0.05, 0, 0.12);
      P.rot('spine', 0, 0, 0.05);
      P.rot('chest', -0.12 + 0.01 * sn(t, 3), 0, 0);
      P.rot('neck', -0.3, 0.3 * Math.tanh(2 * sn(t, 1, 0.2)), 0);
      P.rot('head', 0.3 + 0.05 * sn(t, 2), 0.2 * Math.tanh(2 * sn(t, 1, 0.2)), 0);
      P.rot('earL', -0.1 + 0.15 * Math.tanh(3 * sn(t, 2, 0.1)), 0, 0);
      P.rot('earR', -0.1 + 0.15 * Math.tanh(3 * sn(t, 2, 0.4)), 0, 0);
      P.rot('tail1', 0.6, 0.6, 0);
      P.rot('tail2', 0.5, 0.6, 0);
      P.rot('tail3', 0.3, 0.4, 0);
      for (const l of [0, 1]) {
        const [a, b, c, d] = LEGS[l];
        P.rot(a, -0.9, 0, 0);
        P.rot(b, -0.6, 0, 0);
        P.rot(c, 0.1, 0, 0);
        P.rot(d, 1.2, 0, 0);
      }
      for (const l of [2, 3]) {
        const [a, b, c, d] = LEGS[l];
        P.rot(a, -1.2, 0, (l === 2 ? 0.35 : 0.15));
        P.rot(b, 2.0, 0, 0);
        P.rot(c, -1.5, 0, 0);
        P.rot(d, 1.4, 0, 0);
      }
    },
  },
  'wolf:fall': { dur: 2.4, fps: 20, pose(P, t) { fallPose(P, t, 'wolf'); } },
  // --- The horse -----------------------------------------------------------
  'horse:stand': { dur: 10, fps: 8, pose(P, t) { standIdle(P, t, { sp: 'horse', look: 0.6, tail: 0.7 }); } },
  'horse:walk': { dur: 1.2, fps: 30, gait: 'horse:walk', pose(P, t) { gaitBody(P, GAITS['horse:walk'], t, 'horse'); } },
  'horse:canter': { dur: 0.62, fps: 40, gait: 'horse:canter', pose(P, t) { gaitBody(P, GAITS['horse:canter'], t, 'horse', { neck: 0.1, tail: -0.25 }); } },
  'horse:gallop': { dur: 0.48, fps: 48, gait: 'horse:gallop', pose(P, t) { gaitBody(P, GAITS['horse:gallop'], t, 'horse', { neck: 0.2, head: 0.1, tail: -0.45 }); } },
  // Fighting: rearing half up and striking out with the fores, down again, a stamp.
  'horse:fight': {
    dur: 2.5, fps: 20,
    pose(P, t) {
      const rear = qtrack(t, [[0, 0], [0.15, 0.55], [0.32, 0.6], [0.5, 0], [0.62, 0.08], [0.72, 0]]);
      standIdle(P, t, { sp: 'horse', look: 0.2, tail: 1 });
      P.targets[0] = null;
      P.targets[1] = null;
      const J = P.J;
      // The weight back on the hinds, the forehand up about them.
      P.root(0, 0.05 * rear, -0.05 * rear, -0.55 * rear, 0, 0);
      P.rot('neck', 0.3 * rear, 0, 0);
      P.rot('head', 0.2 * rear, 0, 0);
      for (const l of [0, 1]) {
        const [a, b, c] = LEGS[l];
        const strike = sn(t * 3, 1, l * 0.5) * rear;
        P.rot(a, -0.6 * rear - 0.3 * strike, 0, 0);
        P.rot(b, 1.3 * rear + 0.3 * strike, 0, 0);
        P.rot(c, -0.4 * rear, 0, 0);
        if (rear < 0.05) {
          const r = J[LEGS[l][3]];
          P.leg(l, r[1], r[2]);
        }
      }
      for (const l of [2, 3]) {
        const r = J[LEGS[l][3]];
        P.leg(l, r[1], r[2] + 0.12 * rear, 0.2 * rear, 0);
      }
    },
  },
  'horse:fall': { dur: 2.6, fps: 20, pose(P, t) { fallPose(P, t, 'horse'); } },
  // --- The elephant --------------------------------------------------------
  'elephant:stand': { dur: 9, fps: 8, pose(P, t) { standIdle(P, t, { sp: 'elephant', look: 0.4, tail: 0.6 }); } },
  'elephant:walk': { dur: 1.4, fps: 24, gait: 'elephant:walk', pose(P, t) { gaitBody(P, GAITS['elephant:walk'], t, 'elephant'); } },
  // Fighting: the head lowered, the tusks swept up and across, the trunk curled out of the way, a stamp.
  'elephant:fight': {
    dur: 2.5, fps: 16,
    pose(P, t) {
      const toss = qtrack(t, [[0, 0], [0.2, -0.6], [0.36, 1], [0.48, 0.6], [0.75, 0]]);
      standIdle(P, t, { sp: 'elephant', look: 0, tail: 1 });
      P.rot('neck', -0.15 * toss, 0.2 * toss, 0);
      P.rot('head', 0.25 * Math.max(0, -toss) - 0.2 * Math.max(0, toss), 0.15 * toss, 0);
      P.rot('trunk1', -0.5 * Math.max(0, toss), 0, 0);
      P.rot('trunk2', 0.6 * Math.max(0, toss), 0, 0);
      P.rot('trunk3', 0.8 * Math.max(0, toss), 0, 0);
      P.rot('earL', 0, 0.8, 0);
      P.rot('earR', 0, -0.8, 0);
      const J = P.J;
      const stamp = qtrack(t, [[0, 0], [0.55, 0], [0.65, 1], [0.75, 0]]);
      const r = J[LEGS[0][3]];
      P.leg(0, r[1] + 0.25 * stamp, r[2] + 0.1 * stamp, -0.4 * stamp, 0.3 * stamp);
    },
  },
  'elephant:fall': { dur: 3, fps: 16, pose(P, t) { fallPose(P, t, 'elephant'); } },
  // --- Appended: the stable's team and the menagerie's beasts (every older clip keeps its index) ---------
  'horse:trot': { dur: 0.72, fps: 40, gait: 'horse:trot', pose(P, t) { gaitBody(P, GAITS['horse:trot'], t, 'horse', { neck: 0.06, tail: -0.2 }); } },
  ...catClips('lion'),
  ...catClips('leopard'),
  'bear:stand': { dur: 9, fps: 8, pose(P, t) { bearStand(P, t); } },
  'bear:walk': {
    dur: 1.25, fps: 30, gait: 'bear:walk',
    pose(P, t) {
      gaitBody(P, GAITS['bear:walk'], t, 'bear', { neck: 0.12, head: 0.05, tail: 0 });
      // The weight rolling over each fore foot as it is planted, the head swinging low from side to side.
      P.rot('spine', 0, 0, 0.035 * sn(t, 1, 0.2));
      P.rot('chest', 0, 0.05 * sn(t, 1, 0.15), 0.04 * sn(t, 1, 0.25));
      P.rot('neck', 0, 0.1 * sn(t, 1, 0.1), 0);
    },
  },
  // Up on the hind feet to look and scent the air, held, and down again.
  'bear:rise': { dur: 7, fps: 20, pose(P, t) { bearRise(P, t); } },
  // --- Appended: the villages' flocks (models/villages.js) ---------------------------------------------
  ...flockClips('goat', { tail: -0.6 }),
  ...flockClips('sheep', { tail: 0.15 }),
});

/**
 * A goat's or a sheep's clips: standing and looking about (the horse's idle,
 * small), walking, and grazing: the neck down to the grass, the jaw working,
 * the head lifted now and then to look round, a step forward between bites.
 * `tail` its carriage (a goat's up, a sheep's hanging).
 */
function flockClips(sp, { tail = 0 } = {}) {
  return {
    [`${sp}:stand`]: { dur: 8, fps: 10, pose(P, t) { standIdle(P, t, { sp: 'horse', look: 0.8, tail: 0.5 }); P.rot('tail1', tail, 0, 0); } },
    [`${sp}:walk`]: { dur: 0.9, fps: 30, gait: `${sp}:walk`, pose(P, t) { gaitBody(P, GAITS[`${sp}:walk`], t, sp, { neck: 0.05, tail }); } },
    [`${sp}:graze`]: {
      dur: 7, fps: 12,
      pose(P, t) {
        standIdle(P, t, { sp: 'horse', look: 0.15, tail: 0.6 });
        // Down to the grass, the head up for a look round about once a loop.
        const up = qtrack(t, [[0, 0], [0.55, 0], [0.62, 1], [0.78, 1], [0.86, 0]]);
        const down = 1 - up;
        P.rot('neck', 1.15 * down, 0.15 * up * sn(t, 2), 0);
        P.rot('neck2', 0.35 * down, 0, 0);
        P.rot('head', 0.35 * down - 0.1 * up, 0.1 * sn(t, 3) * down, 0);
        P.rot('jaw', 0.09 * down * Math.abs(sn(t, 14)), 0, 0);
        P.rot('tail1', tail, 0, 0);
        // A step forward with a fore foot between bites (once a loop: the foot back by the loop's end).
        const step = qtrack(t, [[0, 0], [0.3, 0], [0.38, 1], [0.48, 1], [0.55, 0]]);
        const r = P.J[LEGS[0][3]];
        P.leg(0, r[1] + 0.04 * Math.sin(Math.PI * step), r[2] + 0.06 * step, -0.4 * Math.sin(Math.PI * step), 0.3 * Math.sin(Math.PI * step));
      },
    },
  };
}

export const BEAST_CLIP_NAMES = Object.freeze(Object.keys(BEAST_CLIPS));
export const BEAST_CLIP_INDEX = Object.freeze(Object.fromEntries(BEAST_CLIP_NAMES.map((n, i) => [n, i])));

/** A beast clip's metres a loop (its gait's stride), 0 for a standing one. */
export function beastStride(name) {
  const c = BEAST_CLIPS[name];
  return c && c.gait ? GAITS[c.gait].stride : 0;
}

/** The pose of beast clip `name` at phase t. */
export function beastPoseAt(name, t, pose = null) {
  const sp = name.split(':')[0];
  const P = pose && pose.species === sp ? pose : new QPose(sp);
  P.reset();
  BEAST_CLIPS[name].pose(P, wrap1(t));
  return P.solve();
}

/** Frames a beast clip bakes (its loop at its rate, at least 8). */
export function beastFrames(name) {
  const c = BEAST_CLIPS[name];
  return Math.max(8, Math.round(c.dur * c.fps));
}

let BAKED = null;

/**
 * Every beast clip baked once: { data (a row of QFRAME_FLOATS a frame), rows,
 * table [{ name, start, frames, fps, dur, stride }], seat, deck }: `seat` and
 * `deck` per clip a Float32Array of 3 a frame (the rider's place's rise and
 * reach from rest, metres, and its pitch, rad), for the figures that ride
 * (units/motion.js puts a rider there, rocked with the stride).
 */
export function bakeBeasts() {
  if (BAKED) return BAKED;
  const table = [];
  let rows = 0;
  for (const name of BEAST_CLIP_NAMES) {
    const frames = beastFrames(name);
    const c = BEAST_CLIPS[name];
    table.push(Object.freeze({ name, start: rows, frames, fps: frames / c.dur, dur: c.dur, stride: beastStride(name) }));
    rows += frames;
  }
  const data = new Float32Array(rows * QFRAME_FLOATS);
  const seat = {};
  const deck = {};
  const poses = {};
  for (const c of table) {
    const sp = c.name.split(':')[0];
    const P = poses[sp] || (poses[sp] = new QPose(sp));
    const S = SPECIES[sp];
    const track = (spec) => (spec ? new Float32Array(c.frames * 3) : null);
    seat[c.name] = track(S.seat);
    deck[c.name] = track(S.deck);
    for (let f = 0; f < c.frames; f++) {
      beastPoseAt(c.name, f / c.frames, P).write(data, (c.start + f) * QFRAME_FLOATS);
      for (const [spec, out] of [[S.seat, seat[c.name]], [S.deck, deck[c.name]]]) {
        if (!spec) continue;
        const at = P.carry(spec.bone, spec.at);
        // (The pitch: how far the bone's own +z has tipped from level, nose down +.)
        const e = P.world[QB[spec.bone]].elements;
        out[f * 3] = at.y - spec.at[1];
        out[f * 3 + 1] = at.z - spec.at[2];
        out[f * 3 + 2] = Math.atan2(-e[9], e[10]);
      }
    }
  }
  BAKED = Object.freeze({ data, rows, table: Object.freeze(table), seat, deck });
  return BAKED;
}

/**
 * Where a rider sits on beast clip `name` at time `time` (s): { y, z, pitch }
 * from the seat's rest (`which` 'seat' or 'deck'), read from the bake as the
 * GPU reads the pose (two frames blended), so the rider moves with the back.
 */
export function riderAt(name, time, which = 'seat', out = { y: 0, z: 0, pitch: 0 }) {
  const B = bakeBeasts();
  const tr = (which === 'deck' ? B.deck : B.seat)[name];
  if (!tr) { out.y = 0; out.z = 0; out.pitch = 0; return out; }
  const c = B.table[BEAST_CLIP_INDEX[name]];
  const f = (((time * c.fps) % c.frames) + c.frames) % c.frames;
  const f0 = Math.floor(f);
  const k = f - f0;
  const f1 = (f0 + 1) % c.frames;
  out.y = lerp(tr[f0 * 3], tr[f1 * 3], k);
  out.z = lerp(tr[f0 * 3 + 1], tr[f1 * 3 + 1], k);
  out.pitch = lerp(tr[f0 * 3 + 2], tr[f1 * 3 + 2], k);
  return out;
}
