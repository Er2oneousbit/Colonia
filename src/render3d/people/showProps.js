/**
 * people/showProps.js
 * ----------------------------------------------------------------------------
 * What the people of the training buildings of the shows hold and wear,
 * besides the people's (props.js), the walkers' and the units' props: each a
 * piece skinned to the people's rig (a hand's prop bone, or the head), keyed
 * `sprop:<name>:<L|R>` (pieces.js). From the record:
 *
 *   tragic    the tragic actor's mask (persona), worn: a pale face with the
 *             brows drawn up in grief, the mouth a wide dark opening, the
 *             tall peak of hair over the brow (the onkos) and the locks down
 *             the sides; after the masks of the Pompeian wall paintings and
 *             the marble masks of the theatres. The wig takes the actor's
 *             hair colour, the face is the plaster's white
 *   comic     the comic mask of the New Comedy: the slave's ruddy face (the
 *             trim colour), the brows knotted, the mouth a broad grinning
 *             funnel, a short beard, curls; both on the head's bone
 *   rudis     the gladiators' wooden practice sword (Vegetius's double
 *             weight wooden sword for the post; the rudis a freed gladiator
 *             was given): grip, a round pommel, a broad wooden blade along
 *             +y as the people's gladius
 *   virga     the trainer's (doctor's) long rod, held near its middle
 *   meat      a haunch of meat carried on the shoulder (as the sack): the
 *             accent's red, a bone's white end
 *   whip      a driver's or a groom's whip: the handle, the lash hanging
 *
 * A hand's prop is made in its bone's frame (its grip at the origin) and
 * moved to where the bone rests, as props.js; a worn mask is made where the
 * head rests (rig.js: the face's front at about z 0.11 at the eyes' height).
 * ----------------------------------------------------------------------------
 */

import { Mesher, SLOTS, rigid } from './mesher.js';
import { BONE, BONES } from './rig.js';
import { lathe, boxAt } from './props.js';

const TAU = Math.PI * 2;
/** Detail by level: segments round. */
const SEG = [10, 6, 4];

/** An ellipsoid about c (radii rx, ry, rz) on `bone`, in `slot`, `tone` by its point. */
function blob(m, c, rx, ry, rz, lod, slot, bone, tone = () => 1) {
  const W = rigid(bone);
  const rows = lod === 0 ? 6 : lod === 1 ? 4 : 3;
  const cols = SEG[lod] + 2;
  m.grid(rows, cols, (i, j) => {
    const th = (Math.PI * i) / rows;
    const ph = (TAU * j) / cols;
    const p = [c[0] + Math.sin(th) * Math.sin(ph) * rx, c[1] + Math.cos(th) * ry, c[2] + Math.sin(th) * Math.cos(ph) * rz];
    return { p, c, uv: [ph * 0.05, th * 0.05], w: W, slot, tone: tone(p) };
  });
}

/** The face's front at the eyes' height where the head rests (body.js's head: measured from the body piece). */
const FACE = Object.freeze({ y: 1.6, z: 0.112 });

/**
 * A mask's face shell: a half-ellipsoid in front of the face (rx wide, from
 * the chin `y0` to the brow `y1`, `rz` deep), pushed about by `shape(u, v)`
 * (u across -1..1, v up 0..1) returning [dz, tone]; on the head's bone.
 */
function faceShell(m, lod, { rx, y0, y1, rz, slot, shape }) {
  const W = rigid('head');
  const rows = [10, 6, 3][lod];
  const cols = [12, 7, 4][lod];
  const zc = FACE.z - rz + 0.012;
  m.grid(rows, cols, (i, j) => {
    const v = i / rows;
    const a = -Math.PI * 0.55 + (Math.PI * 1.1 * j) / cols;
    const u = Math.sin(a);
    const yy = y0 + (y1 - y0) * v;
    // (Rounded toward the chin and the brow: the face's oval.)
    const e = Math.sqrt(Math.max(0.05, 1 - (2 * v - 1) ** 2 * 0.55));
    const [dz, tone] = shape(u, v);
    const p = [Math.sin(a) * rx * e, yy, zc + Math.cos(a) * rz * e + dz];
    return { p, c: [0, yy, zc - 0.05], uv: [a * 0.1, v * 0.2], w: W, slot, tone };
  });
}

const PROPS = {
  rudis(m, lod, b) {
    // The grip and a ball pommel in the fist, a short guard, a broad blade of wood along +y, its end rounded.
    lathe(m, [0, -0.07, 0], [0, 1, 0], [[0.026, 0], [0.03, 0.02], [0.016, 0.035], [0.017, 0.1], [0.04, 0.105], [0.04, 0.125], [0.008, 0.13]], SEG[lod], SLOTS.WOOD, b, { tone: (i) => (i < 2 ? 0.7 : i > 3 ? 0.85 : 0.6) });
    boxAt(m, [0, 0.38, 0], 0.062, 0.5, 0.024, SLOTS.WOOD, b, 0.95);
    if (lod < 2) lathe(m, [0, 0.62, 0], [0, 1, 0], [[0.031, 0], [0.022, 0.03], [0.001, 0.045]], 6, SLOTS.WOOD, b, { tone: () => 0.95 });
  },
  virga(m, lod, b) {
    lathe(m, [0, -0.55, 0], [0, 1, 0], [[0.011, 0], [0.012, 0.6], [0.01, 1.25], [0.007, 1.3]], Math.max(4, SEG[lod] - 4), SLOTS.WOOD, b, { tone: (i) => (i > 1 ? 0.8 : 0.65) });
  },
  meat(m, lod, b) {
    // A haunch along z as the sack lies (clips.js carry): the thick of the thigh, tapering to the shank and its bone.
    const W = rigid(b);
    const n = lod === 0 ? 9 : 5;
    m.grid(n, n + 2, (i, j) => {
      const th = (Math.PI * i) / n;
      const ph = (TAU * j) / (n + 2);
      const z = Math.cos(th) * 0.26;
      const k = 1 - 0.55 * Math.max(0, -z / 0.26);
      const lump = lod === 0 ? 1 + 0.08 * Math.sin(ph * 3 + th * 4) : 1;
      const p = [Math.sin(th) * Math.sin(ph) * 0.12 * k * lump, 0.06 + Math.sin(th) * Math.cos(ph) * 0.1 * k * lump, z + 0.04];
      // The meat's red, the fat paler toward the top.
      return { p, c: [0, 0.06, p[2]], uv: [ph * 0.1, th * 0.1], w: W, slot: SLOTS.ACCENT, tone: 0.75 + 0.3 * Math.max(0, Math.cos(ph)) };
    });
    lathe(m, [0, 0.06, -0.2], [0, 0, -1], [[0.022, 0], [0.02, 0.1], [0.032, 0.12], [0.02, 0.14]], Math.max(4, SEG[lod] - 4), SLOTS.WHITE, b, { tone: () => 0.95 });
  },
  whip(m, lod, b) {
    lathe(m, [0, -0.1, 0], [0, 1, 0], [[0.013, 0], [0.012, 0.42], [0.007, 0.48]], Math.max(4, SEG[lod] - 4), SLOTS.WOOD, b, { tone: () => 0.6 });
    if (lod < 2) {
      // The lash: from the stock's tip, arching forward and hanging.
      const W = rigid(b);
      const pts = [[0, 0.38, 0], [0, 0.44, 0.12], [0, 0.32, 0.3], [0, 0.08, 0.36], [0, -0.12, 0.3]];
      m.grid(pts.length - 1, 3, (i, j) => {
        const a = (TAU * j) / 3;
        const q = pts[i];
        return { p: [q[0] + Math.cos(a) * 0.005, q[1] + Math.sin(a) * 0.005, q[2]], c: q, uv: [a, i], w: W, slot: SLOTS.LEATHER, tone: 0.7 };
      });
    }
  },
  tragic(m, lod) {
    const W = 'head';
    // The face: pale, the cheeks hollow, the mouth's opening sunk; the brows drawn up toward the middle.
    faceShell(m, lod, {
      rx: 0.088, y0: 1.47, y1: 1.715, rz: 0.075, slot: SLOTS.WHITE,
      shape: (u, v) => [0.012 * Math.exp(-((v - 0.55) ** 2) / 0.01) * Math.exp(-(u * u) / 0.02) - 0.006 * Math.exp(-((v - 0.4) ** 2) / 0.01) * (u * u), 0.95 + 0.05 * v],
    });
    const zf = FACE.z + 0.014;
    if (lod < 2) {
      // The eyes' holes and the gaping mouth.
      for (const s of [1, -1]) blob(m, [s * 0.034, 1.605, zf], 0.016, 0.011, 0.006, lod, SLOTS.DARK, W);
      blob(m, [0, 1.515, zf - 0.004], 0.026, 0.022, 0.008, lod, SLOTS.DARK, W);
      // The brows: raised to the middle (grief).
      for (const s of [1, -1]) blob(m, [s * 0.034, 1.645, zf - 0.002], 0.024, 0.005, 0.005, lod, SLOTS.HAIR, W);
    }
    // The onkos: a tall peak of hair over the brow; the locks falling either side and behind to the neck.
    blob(m, [0, 1.79, 0.04], 0.095, 0.11, 0.085, lod, SLOTS.HAIR, W, (p) => 0.8 + 0.2 * Math.sin(p[0] * 90 + p[1] * 40));
    for (const s of [1, -1]) blob(m, [s * 0.085, 1.56, -0.01], 0.035, 0.13, 0.06, lod, SLOTS.HAIR, W, (p) => 0.75 + 0.2 * Math.sin(p[1] * 120));
    blob(m, [0, 1.6, -0.07], 0.1, 0.13, 0.06, lod, SLOTS.HAIR, W, () => 0.8);
  },
  comic(m, lod) {
    const W = 'head';
    // The slave's mask: the brows knotted, the eyes goggling, the cheeks puffed round the grinning funnel of a mouth.
    faceShell(m, lod, {
      rx: 0.092, y0: 1.475, y1: 1.7, rz: 0.08, slot: SLOTS.TRIM,
      shape: (u, v) => [0.014 * Math.exp(-((v - 0.32) ** 2) / 0.012) * Math.exp(-((Math.abs(u) - 0.55) ** 2) / 0.05) + 0.012 * Math.exp(-((v - 0.55) ** 2) / 0.008) * Math.exp(-(u * u) / 0.02), 0.85 + 0.12 * v],
    });
    const zf = FACE.z + 0.018;
    if (lod < 2) {
      for (const s of [1, -1]) {
        blob(m, [s * 0.036, 1.605, zf], 0.017, 0.017, 0.008, lod, SLOTS.WHITE, W);
        blob(m, [s * 0.036, 1.605, zf + 0.006], 0.008, 0.009, 0.004, lod, SLOTS.DARK, W);
        blob(m, [s * 0.03, 1.64, zf - 0.003], 0.026, 0.007, 0.006, lod, SLOTS.HAIR, W);
      }
      // The mouth: a broad dark grin with a lip round it.
      blob(m, [0, 1.52, zf + 0.004], 0.045, 0.02, 0.012, lod, SLOTS.DARK, W);
    }
    // A short curled beard under the chin, curls over the brow and round the back.
    blob(m, [0, 1.48, 0.07], 0.07, 0.04, 0.05, lod, SLOTS.HAIR, W, (p) => 0.7 + 0.25 * Math.sin(p[0] * 120) * Math.sin(p[1] * 100));
    blob(m, [0, 1.71, 0.0], 0.1, 0.06, 0.11, lod, SLOTS.HAIR, W, (p) => 0.7 + 0.25 * Math.sin(p[0] * 110 + p[2] * 90));
    blob(m, [0, 1.6, -0.07], 0.095, 0.1, 0.05, lod, SLOTS.HAIR, W, () => 0.75);
  },
};

/** Worn on the head, not held: made where the head rests. */
const WORN = new Set(['tragic', 'comic']);

export const SHOW_PROP_NAMES = Object.freeze(Object.keys(PROPS));

/** A show prop in the left hand (`side` 'L') or the right ('R'), or worn, at level `lod`: a Mesher. */
export function showProp(name, side, lod) {
  const make = PROPS[name];
  if (!make) throw new Error(`No show prop ${name}`);
  const m = new Mesher();
  if (WORN.has(name)) {
    make(m, lod);
    return m;
  }
  const bone = side === 'L' ? 'propL' : 'propR';
  make(m, lod, bone);
  const at = BONES[BONE[bone]].at;
  return m.map(([x, y, z]) => [x + at[0], y + at[1], z + at[2]]);
}
