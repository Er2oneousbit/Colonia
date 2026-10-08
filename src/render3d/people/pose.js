/**
 * people/pose.js
 * ----------------------------------------------------------------------------
 * A pose of the rig (rig.js) as a clip describes it, solved into every
 * bone's world matrix and its skinning matrix (the world matrix times a
 * translation by minus the joint: every bone rests unrotated).
 *
 * A clip (clips.js) fills a Pose with:
 *   - the root's place and turn (the hips' sway, a walk's bob, sitting down)
 *   - rotations of the spine, neck and head, the clavicles, the wrists and
 *     fingers, the toes (forward kinematics: Euler angles in the parent's
 *     frame, order YXZ)
 *   - targets for the hands and the feet: a two-bone solver (ik2) finds the
 *     elbow and the knee in the plane of a pole (an elbow points back and
 *     out, a knee ahead), so a foot planted stays planted while the hips
 *     move over it, and a hand reaches the patera's place whatever the lean
 *     of the body that carries it
 *   - the prop bones placed outright (the pipes at the lips), else carried
 *     by their hands
 * Targets are given in the actor's own frame (feet on y 0, facing +z) or in
 * the chest's frame (`chest: true`: a hand at the belly moves with the
 * body's breathing and lean).
 *
 * Signs, the model's axes (x the person's left, y up, z ahead): a bone that
 * points down (an arm, a leg) swings forward with a negative x rotation;
 * one that points up (the spine, the neck) leans forward with a positive
 * one; y turns to the left; z bends the spine to the right.
 * ----------------------------------------------------------------------------
 */

import { Matrix4, Quaternion, Vector3, Euler } from 'three';
import { BONES, BONE, BONE_COUNT, BONE_FLOATS, sideBones } from './rig.js';

const _e = new Euler();
const _v = new Vector3();
const _w = new Vector3();
const _q = new Quaternion();
const _m = new Matrix4();
const _n = new Matrix4();

/** The joints at rest as Vector3s, and each bone's offset from its parent's joint. */
const REST = BONES.map((b) => new Vector3(...b.at));
const OFFSET = BONES.map((b, i) => (b.parent < 0 ? REST[i].clone() : REST[i].clone().sub(REST[b.parent])));

/** A rotation matrix from Euler angles (YXZ: the turn, then the pitch, then the roll). */
function euler(rx, ry, rz, out) {
  _e.set(rx, ry, rz, 'YXZ');
  return out.makeRotationFromEuler(_e);
}

export class Pose {
  constructor() {
    this.world = BONES.map(() => new Matrix4());
    this.local = BONES.map(() => [0, 0, 0]);
    this.reset();
  }

  /** Back to rest: no rotation, no targets. */
  reset() {
    for (const r of this.local) r[0] = r[1] = r[2] = 0;
    this.rootAt = [0, 0, 0];
    this.rootRot = [0, 0, 0];
    this.hands = [null, null];
    this.feet = [null, null];
    this.props = [null, null];
    // The direction an elbow points (actor frame), each side; a knee's.
    this.elbowPole = [null, null];
    this.kneePole = [null, null];
    return this;
  }

  /** The root (hips) moved by (x, y, z) from rest and turned (rx lean, ry turn, rz tilt). */
  root(x, y, z, rx = 0, ry = 0, rz = 0) {
    this.rootAt = [x, y, z];
    this.rootRot = [rx, ry, rz];
    return this;
  }

  /** A bone's rotation (by name or index), added to what it has. */
  rot(bone, rx = 0, ry = 0, rz = 0) {
    const r = this.local[typeof bone === 'string' ? BONE[bone] : bone];
    r[0] += rx;
    r[1] += ry;
    r[2] += rz;
    return this;
  }

  /**
   * A hand's wrist at (x, y, z): s +1 the left hand, -1 the right; `chest`
   * for a point in the chest's frame (at rest the actor's), else the actor's.
   * `pole`: where the elbow points (actor frame), default back and out.
   */
  hand(s, x, y, z, { chest = false, pole = null } = {}) {
    this.hands[s > 0 ? 0 : 1] = { at: [x, y, z], chest };
    if (pole) this.elbowPole[s > 0 ? 0 : 1] = pole;
    return this;
  }

  /** A foot's ankle at (x, y, z) in the actor's frame, its sole pitched `pitch` (toes down +), turned `yaw`. */
  foot(s, x, y, z, pitch = 0, yaw = 0, { pole = null } = {}) {
    this.feet[s > 0 ? 0 : 1] = { at: [x, y, z], pitch, yaw };
    if (pole) this.kneePole[s > 0 ? 0 : 1] = pole;
    return this;
  }

  /** A prop bone placed outright: at (x, y, z) turned (rx, ry, rz), in the actor's frame or the chest's. */
  prop(s, x, y, z, rx = 0, ry = 0, rz = 0, { chest = false } = {}) {
    this.props[s > 0 ? 0 : 1] = { at: [x, y, z], rot: [rx, ry, rz], chest };
    return this;
  }

  /** Solve the pose: every bone's world matrix (this.world). */
  solve() {
    const W = this.world;
    // The root.
    euler(...this.rootRot, _m);
    W[0].copy(_m).setPosition(REST[0].x + this.rootAt[0], REST[0].y + this.rootAt[1], REST[0].z + this.rootAt[2]);
    const fk = (i) => {
      const b = BONES[i];
      euler(...this.local[i], _m);
      _n.makeTranslation(OFFSET[i].x, OFFSET[i].y, OFFSET[i].z);
      W[i].multiplyMatrices(W[b.parent], _n).multiply(_m);
    };
    for (const name of ['spine', 'chest', 'neck', 'head', 'clavL', 'clavR']) fk(BONE[name]);
    // Props placed outright (before the arms: a hand may reach for its prop).
    const propWorld = [null, null];
    for (let k = 0; k < 2; k++) {
      const p = this.props[k];
      if (!p) continue;
      const m = new Matrix4();
      euler(...p.rot, m);
      m.setPosition(p.at[0], p.at[1], p.at[2]);
      if (p.chest) m.premultiply(this.chestFrame());
      propWorld[k] = m;
    }
    for (let k = 0; k < 2; k++) {
      const s = k === 0 ? 1 : -1;
      const B = sideBones(s);
      const h = this.hands[k];
      if (h) {
        // The shoulder where the clavicle carries it, the wrist at its target.
        const A = _v.copy(OFFSET[B.arm]).applyMatrix4(W[B.clav]);
        const T = new Vector3(...h.at);
        if (h.chest) T.applyMatrix4(this.chestFrame());
        const pole = this.elbowPole[k] ? new Vector3(...this.elbowPole[k]) : new Vector3(0.45 * s, -0.25, -0.85);
        // (The pole turns with the body: an elbow out to the side stays out as the chest turns.)
        pole.transformDirection(W[BONE.chest]);
        this.limb(B.arm, B.fore, B.hand, A.clone(), T, pole, ARM_REST[k]);
      } else {
        fk(B.arm);
        fk(B.fore);
      }
      fk(B.hand);
      fk(B.fing);
      if (propWorld[k]) W[B.prop].copy(propWorld[k]);
      else fk(B.prop);
      // The legs: a foot with a target is planted there, its sole as asked; else the leg by its angles.
      const f = this.feet[k];
      if (f) {
        const A = _v.copy(OFFSET[B.thigh]).applyMatrix4(W[0]);
        const T = new Vector3(...f.at);
        const pole = this.kneePole[k] ? new Vector3(...this.kneePole[k]) : new Vector3(0.08 * s, 0, 1);
        pole.applyAxisAngle(UP, this.rootRot[1]);
        this.limb(B.thigh, B.shin, B.foot, A.clone(), T, pole, LEG_REST[k]);
        // The foot's own turn: flat on the ground (or pitched), turned with the root and `yaw`.
        _w.setFromMatrixPosition(W[B.foot]);
        euler(f.pitch, this.rootRot[1] + f.yaw, 0, _m);
        W[B.foot].copy(_m).setPosition(_w);
      } else {
        fk(B.thigh);
        fk(B.shin);
        fk(B.foot);
      }
      fk(B.toe);
    }
    return this;
  }

  /** The chest's frame (its world matrix moved back by its joint at rest): targets that move with the body. */
  chestFrame() {
    return new Matrix4().multiplyMatrices(this.world[BONE.chest], new Matrix4().makeTranslation(-REST[BONE.chest].x, -REST[BONE.chest].y, -REST[BONE.chest].z));
  }

  /**
   * Two bones a -> b -> c (an arm, a leg) from the joint at A (world) so c's
   * joint reaches T, the middle joint bending toward `pole` (a direction);
   * `rest` the limb's rest frame (restFrame). Sets the world matrices of a,
   * b and c's position (c's rotation is b's until set).
   */
  limb(a, b, c, A, T, pole, rest) {
    const W = this.world;
    const l1 = REST[a].distanceTo(REST[b]);
    const l2 = REST[b].distanceTo(REST[c]);
    const sol = ik2(A, T, l1, l2, pole);
    W[a].copy(frameMatrix(sol.d1, sol.hinge, rest.d1, rest.hinge)).setPosition(A);
    W[b].copy(frameMatrix(sol.d2, sol.hinge, rest.d2, rest.hinge)).setPosition(sol.E);
    W[c].copy(W[b]).setPosition(sol.W);
  }

  /**
   * The pose's skinning matrices into `out` at `offset`: three rows of each
   * bone's 3 x 4 matrix (BONE_FLOATS a bone).
   */
  write(out, offset = 0) {
    for (let i = 0; i < BONE_COUNT; i++) {
      // world x translate(-rest): the rotation stays, the translation becomes t - R rest.
      const e = this.world[i].elements;
      const r = REST[i];
      const tx = e[12] - (e[0] * r.x + e[4] * r.y + e[8] * r.z);
      const ty = e[13] - (e[1] * r.x + e[5] * r.y + e[9] * r.z);
      const tz = e[14] - (e[2] * r.x + e[6] * r.y + e[10] * r.z);
      const o = offset + i * BONE_FLOATS;
      out[o] = e[0]; out[o + 1] = e[4]; out[o + 2] = e[8]; out[o + 3] = tx;
      out[o + 4] = e[1]; out[o + 5] = e[5]; out[o + 6] = e[9]; out[o + 7] = ty;
      out[o + 8] = e[2]; out[o + 9] = e[6]; out[o + 10] = e[10]; out[o + 11] = tz;
    }
    return out;
  }

  /** A bone's joint where the pose puts it (world, metres). */
  jointOf(bone) {
    const i = typeof bone === 'string' ? BONE[bone] : bone;
    return new Vector3().setFromMatrixPosition(this.world[i]);
  }
}

const UP = new Vector3(0, 1, 0);

/**
 * Solve two bones of lengths l1, l2 from A to reach T, bending toward pole:
 * { E (the middle joint), W (the end, at T when it reaches), d1, d2 (each
 * bone's direction), hinge (the bend's axis) }.
 */
export function ik2(A, T, l1, l2, pole) {
  const AT = T.clone().sub(A);
  let d = AT.length();
  const u = d > 1e-6 ? AT.divideScalar(d) : new Vector3(0, -1, 0);
  d = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  const v = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u)));
  if (v.lengthSq() < 1e-8) v.set(0, 0, 1).sub(u.clone().multiplyScalar(u.z));
  v.normalize();
  const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const E = A.clone().addScaledVector(u, l1 * ca).addScaledVector(v, l1 * sa);
  const Wp = A.clone().addScaledVector(u, d);
  const d1 = E.clone().sub(A).normalize();
  const d2 = Wp.clone().sub(E).normalize();
  const hinge = new Vector3().crossVectors(u, v).normalize();
  return { E, W: Wp, d1, d2, hinge };
}

/** The rotation taking (dir0, hinge0) to (dir, hinge): two orthonormal frames built alike. */
function frameMatrix(dir, hinge, dir0, hinge0) {
  const f = (d, h) => {
    const x = d.clone().normalize();
    const y = h.clone().sub(x.clone().multiplyScalar(h.dot(x))).normalize();
    const z = new Vector3().crossVectors(x, y);
    return new Matrix4().makeBasis(x, y, z);
  };
  const to = f(dir, hinge);
  const from = f(dir0, hinge0);
  return to.multiply(from.transpose());
}

/** A limb's frame at rest: its bones' directions and its hinge, from the joints and the way it bends. */
function restFrame(a, b, c, pole) {
  const A = REST[a];
  const B = REST[b];
  const C = REST[c];
  const u = C.clone().sub(A).normalize();
  const p = new Vector3(...pole);
  const v = p.sub(u.clone().multiplyScalar(p.dot(u))).normalize();
  return { d1: B.clone().sub(A).normalize(), d2: C.clone().sub(B).normalize(), hinge: new Vector3().crossVectors(u, v).normalize() };
}

// An elbow bends with the forearm coming forward (it points back); a knee with the shin going back
// (it points ahead). Each side its own rest frame, built the same way, so the twist of both matches.
const ARM_REST = [restFrame(BONE.armL, BONE.foreL, BONE.handL, [0, 0, -1]), restFrame(BONE.armR, BONE.foreR, BONE.handR, [0, 0, -1])];
const LEG_REST = [restFrame(BONE.thighL, BONE.shinL, BONE.footL, [0, 0, 1]), restFrame(BONE.thighR, BONE.shinR, BONE.footR, [0, 0, 1])];

/** The rest joints (Vector3s), for the builders and tests. */
export function restJoint(i) {
  return REST[i].clone();
}

export { REST };
