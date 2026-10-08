/**
 * people/rig.js
 * ----------------------------------------------------------------------------
 * The skeleton every person of the 3D look shares: 25 bones of a man 1.70 m
 * tall standing at rest (arms hanging a little away from the body, palms to
 * the thighs), in metres, his feet on y = 0, facing +z, his left hand at +x
 * (the person's own left: +z ahead and +y up make -x his right).
 *
 * Why one skeleton for everyone: the clips (clips.js) are baked once for it
 * into the GPU's bone texture, and every body, garment, head of hair and
 * prop (build.js) is skinned to it. A woman is the same bones (her own body
 * and clothes), a child the same at about three quarters (the instance's
 * scale) with a bigger head (the shader scales what the head bone carries).
 *
 * Every bone's rest rotation is the identity: a bone's local frame is the
 * model's own axes at its joint, so a pose is a rotation per bone about its
 * joint, and its skinning matrix is its world matrix times a translation by
 * minus its joint (no inverse bind matrices to keep).
 *
 * The two prop bones (propL, propR) sit at the grip of each hand: what a
 * hand holds (a roll, a spear, the pipes of a flute) is skinned to its prop
 * bone, which a clip may also place outright (the flute at the lips) and
 * reach for with the hands.
 * ----------------------------------------------------------------------------
 */

/** [name, parent name or null, joint at rest [x, y, z]]; the right side mirrors the left in x. */
const LIST = [
  ['root', null, [0, 0.95, 0]],
  ['spine', 'root', [0, 1.06, -0.005]],
  ['chest', 'spine', [0, 1.22, -0.012]],
  ['neck', 'chest', [0, 1.435, -0.018]],
  ['head', 'neck', [0, 1.52, -0.004]],
  ['clavL', 'chest', [0.025, 1.385, -0.005]],
  ['armL', 'clavL', [0.172, 1.385, -0.025]],
  ['foreL', 'armL', [0.198, 1.11, -0.045]],
  ['handL', 'foreL', [0.214, 0.862, -0.012]],
  ['fingL', 'handL', [0.218, 0.778, 0.0]],
  ['propL', 'handL', [0.205, 0.808, 0.024]],
  ['clavR', 'chest', [-0.025, 1.385, -0.005]],
  ['armR', 'clavR', [-0.172, 1.385, -0.025]],
  ['foreR', 'armR', [-0.198, 1.11, -0.045]],
  ['handR', 'foreR', [-0.214, 0.862, -0.012]],
  ['fingR', 'handR', [-0.218, 0.778, 0.0]],
  ['propR', 'handR', [-0.205, 0.808, 0.024]],
  ['thighL', 'root', [0.088, 0.915, 0.005]],
  ['shinL', 'thighL', [0.094, 0.5, 0.012]],
  ['footL', 'shinL', [0.098, 0.085, -0.012]],
  ['toeL', 'footL', [0.1, 0.018, 0.135]],
  ['thighR', 'root', [-0.088, 0.915, 0.005]],
  ['shinR', 'thighR', [-0.094, 0.5, 0.012]],
  ['footR', 'shinR', [-0.098, 0.085, -0.012]],
  ['toeR', 'footR', [-0.1, 0.018, 0.135]],
];

/** The bones: { name, parent (index or -1), at: [x, y, z] (the joint at rest) }. */
export const BONES = Object.freeze(LIST.map(([name, parent, at]) => Object.freeze({
  name,
  parent: parent === null ? -1 : LIST.findIndex((b) => b[0] === parent),
  at: Object.freeze(at.slice()),
})));

/** A bone's index by its name. */
export const BONE = Object.freeze(Object.fromEntries(BONES.map((b, i) => [b.name, i])));

export const BONE_COUNT = BONES.length;

/** Floats a bone takes in a frame of the bone texture: three rows of its 3 x 4 skinning matrix. */
export const BONE_FLOATS = 12;

/** A side's bones: s = +1 the left (at +x), -1 the right. */
export function sideBones(s) {
  const k = s > 0 ? 'L' : 'R';
  return {
    clav: BONE[`clav${k}`], arm: BONE[`arm${k}`], fore: BONE[`fore${k}`], hand: BONE[`hand${k}`], fing: BONE[`fing${k}`], prop: BONE[`prop${k}`],
    thigh: BONE[`thigh${k}`], shin: BONE[`shin${k}`], foot: BONE[`foot${k}`], toe: BONE[`toe${k}`],
  };
}

/** The distance between two bones' joints at rest (a limb's length). */
export function boneLength(a, b) {
  const p = BONES[a].at;
  const q = BONES[b].at;
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** Is bone `i` the head's or under it (what a child's bigger head scales)? */
export function isHeadBone(i) {
  return i === BONE.head;
}
