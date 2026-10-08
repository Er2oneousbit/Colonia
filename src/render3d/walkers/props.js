/**
 * walkers/props.js
 * ----------------------------------------------------------------------------
 * What the walkers carry, besides the people's own props (people/props.js):
 * each a piece skinned to a hand's prop bone (its grip at the origin, made in
 * that bone's frame, as the people's are), keyed `wprop:<name>:<L|R>`.
 * From the record where it speaks:
 *
 *   bucket     the vigiles' bucket (hama): wooden staves, iron hoops, a bail
 *   rod        the surveyor's ten-foot rod (decempeda), bronze-shod, marked
 *              in feet, carried on the shoulder (along z)
 *   basket     a wide wicker basket of produce carried on the head on its
 *              cloth pad (the stall's goods in the accent colour)
 *   hipBasket  a deep wicker basket with a handle, carried at the hip
 *   case       a wooden case on a strap (a barber's razors, a physician's
 *              instruments: the medcase is bigger, bronze-cornered)
 *   capsa      a librarian's round book box of leather, roll ends showing
 *   towel      a linen towel folded over the shoulder (a bath attendant)
 *   aryballos  the round oil flask and the strigil on their ring
 *   mask       an actor's mask (persona), held by its edge
 *   placard    a board on a pole, daubed
 *   torch      a pitch torch, its flame
 *   shears     a topiarius's shears
 *   bundle     a cloth bundle tied up, carried on the back
 *   plank      a timber on the shoulder (along z)
 *   staff      a walking staff, held upright
 *   gladius    a gladiator's short sword, held upright
 * ----------------------------------------------------------------------------
 */

import { Mesher, SLOTS, rigid } from '../people/mesher.js';
import { BONE, BONES } from '../people/rig.js';
import { lathe, boxAt } from '../people/props.js';

const TAU = Math.PI * 2;
/** Detail by level: segments round. */
const SEG = [12, 7, 4];

/** A lumpy dome of produce: (cx, y0, cz) its base's middle, radius r, height h, in `slot`. */
function heap(m, c, r, h, lod, slot, bone) {
  const W = rigid(bone);
  const rows = lod === 0 ? 5 : 2;
  const cols = SEG[lod] + 2;
  m.grid(rows, cols, (i, j) => {
    const th = (Math.PI / 2) * (i / rows);
    const ph = (TAU * j) / cols;
    const lump = lod === 0 ? 1 + 0.12 * Math.sin(ph * 5 + i * 2.1) * Math.sin(th * 3 + 0.4) : 1;
    const rr = r * Math.cos(th) * lump;
    const p = [c[0] + Math.cos(ph) * rr, c[1] + h * Math.sin(th) * lump, c[2] + Math.sin(ph) * rr];
    return { p, c: [c[0], c[1] - 0.05, c[2]], uv: [ph * 0.1, th * 0.1], w: W, slot, tone: 0.75 + 0.3 * Math.sin(th) + 0.1 * Math.sin(ph * 7) };
  });
}

/** A ring (torus) about the y axis at height y: radius R, tube r. */
function ring(m, y, R, r, lod, slot, bone, tone = 1) {
  const W = rigid(bone);
  const cols = SEG[lod] + 4;
  const rows = lod === 2 ? 3 : 5;
  m.grid(rows, cols, (i, j) => {
    const a = (TAU * i) / rows;
    const ph = (TAU * j) / cols;
    const rr = R + Math.cos(a) * r;
    return { p: [Math.cos(ph) * rr, y + Math.sin(a) * r, Math.sin(ph) * rr], c: [Math.cos(ph) * R, y, Math.sin(ph) * R], uv: [ph * 0.05, a * 0.02], w: W, slot, tone };
  });
}

/** A wicker basket's tone: courses of weave. */
const weave = (i, t) => 0.8 + 0.2 * Math.sin(t * 160);

const PROPS = {
  bucket(m, lod, b) {
    // Staves from the rim (8 cm under the grip) to the base, hooped; the bail from the grip to the rim.
    lathe(m, [0, -0.09, 0], [0, -1, 0], [[0.115, 0], [0.112, 0.02], [0.106, 0.12], [0.1, 0.24], [0.095, 0.25]], SEG[lod], SLOTS.WOOD, b, { tone: (i) => (i === 1 ? 0.85 : 1) });
    for (const y of lod === 2 ? [-0.12] : [-0.12, -0.3]) ring(m, y, y > -0.2 ? 0.112 : 0.1, 0.005, lod, SLOTS.IRON, b, 0.8);
    if (lod < 2) {
      // The water inside, dark under the rim.
      lathe(m, [0, -0.11, 0], [0, 1, 0], [[0.105, 0], [0, 0.001]], SEG[lod], SLOTS.IRIS, b, { closed: false, tone: () => 1.6 });
      // The bail: an arc of iron over the rim.
      const W = rigid(b);
      const n = lod === 0 ? 8 : 4;
      m.grid(n, 3, (i, j) => {
        const a = Math.PI * (i / n);
        const ph = (TAU * j) / 3;
        const c = [Math.cos(a) * 0.112, -0.09 + Math.sin(a) * 0.09, 0];
        return { p: [c[0] + Math.cos(ph) * 0.004, c[1] + Math.sin(ph) * 0.004, Math.sin(ph + 1) * 0.004], c, uv: [0, 0], w: W, slot: SLOTS.IRON, tone: 0.8 };
      });
    }
  },
  rod(m, lod, b) {
    lathe(m, [0, 0, -1.2], [0, 0, 1], [[0.013, 0], [0.013, 2.96]], Math.max(4, SEG[lod] - 4), (i) => SLOTS.WOOD, b, { tone: () => 0.95 });
    for (const z of [-1.2, 1.76]) lathe(m, [0, 0, z - 0.02], [0, 0, 1], [[0.016, 0], [0.016, 0.04]], Math.max(4, SEG[lod] - 4), SLOTS.BRONZE, b);
    // A dark mark each foot (29.6 cm).
    if (lod === 0) for (let k = 1; k < 10; k++) lathe(m, [0, 0, -1.2 + k * 0.296 - 0.006], [0, 0, 1], [[0.0136, 0], [0.0136, 0.012]], 6, SLOTS.DARK, b, { closed: false });
  },
  basket(m, lod, b) {
    // The pad (a ring of cloth), the basket on it, the goods heaped in it.
    ring(m, 0.012, 0.075, 0.018, lod, SLOTS.TRIM, b);
    lathe(m, [0, 0.025, 0], [0, 1, 0], [[0.15, 0], [0.24, 0.1], [0.27, 0.15], [0.265, 0.16], [0.24, 0.12]], SEG[lod] + 4, SLOTS.ROPE, b, { tone: weave });
    heap(m, [0, 0.13, 0], 0.24, 0.12, lod, SLOTS.ACCENT, b);
  },
  hipBasket(m, lod, b) {
    lathe(m, [0, -0.12, 0], [0, 1, 0], [[0.1, 0], [0.13, 0.08], [0.15, 0.2], [0.145, 0.21], [0.13, 0.19]], SEG[lod] + 2, SLOTS.ROPE, b, { tone: weave });
    heap(m, [0, 0.06, 0], 0.13, 0.08, lod, SLOTS.ACCENT, b);
    if (lod < 2) {
      // The handle over it.
      const W = rigid(b);
      const n = lod === 0 ? 8 : 4;
      m.grid(n, 3, (i, j) => {
        const a = Math.PI * (i / n);
        const ph = (TAU * j) / 3;
        const c = [0, 0.08 + Math.sin(a) * 0.14, Math.cos(a) * 0.145];
        return { p: [Math.cos(ph) * 0.008, c[1] + Math.sin(ph) * 0.008, c[2]], c, uv: [0, 0], w: W, slot: SLOTS.ROPE, tone: 0.7 };
      });
    }
  },
  case(m, lod, b) {
    boxAt(m, [0, -0.15, 0.01], 0.24, 0.15, 0.09, SLOTS.WOOD, b, 0.8);
    boxAt(m, [0, -0.07, 0.01], 0.25, 0.015, 0.1, SLOTS.WOOD, b, 0.65);
    boxAt(m, [0, -0.03, 0.01], 0.03, 0.08, 0.012, SLOTS.LEATHER, b);
  },
  medcase(m, lod, b) {
    boxAt(m, [0, -0.17, 0.01], 0.3, 0.17, 0.1, SLOTS.WOOD, b, 0.7);
    boxAt(m, [0, -0.08, 0.01], 0.31, 0.016, 0.11, SLOTS.BRONZE, b);
    if (lod < 2) for (const x of [-0.15, 0.15]) boxAt(m, [x, -0.17, 0.01], 0.012, 0.17, 0.104, SLOTS.BRONZE, b);
    boxAt(m, [0, -0.035, 0.01], 0.05, 0.07, 0.014, SLOTS.BRONZE, b, 0.9);
  },
  capsa(m, lod, b) {
    lathe(m, [0, -0.06, 0], [0, -1, 0], [[0.1, 0], [0.1, 0.32]], SEG[lod], SLOTS.LEATHER, b, { tone: () => 0.85 });
    lathe(m, [0, -0.05, 0], [0, -1, 0], [[0.106, 0], [0.106, 0.05]], SEG[lod], SLOTS.LEATHER, b, { tone: () => 0.6 });
    // The strap up to the hand, and the rolls' ends in the open top.
    boxAt(m, [0, -0.025, 0], 0.025, 0.05, 0.008, SLOTS.LEATHER, b, 0.5);
    if (lod < 2) for (const [x, z] of [[-0.04, 0], [0.035, 0.03], [0.02, -0.045]]) lathe(m, [x, -0.06, z], [0, 1, 0], [[0.03, 0], [0.03, 0.035]], 6, SLOTS.PAPYRUS, b);
  },
  towel(m, lod, b) {
    // Folded over the shoulder: down the chest before (+z), over the top, down the back.
    const W = rigid(b);
    const n = lod === 0 ? 10 : 4;
    for (const side of [1, -1]) {
      m.grid(n, 1, (i, j) => {
        const u = i / n;
        const a = Math.PI * u;
        const r = 0.11 + 0.012 * side;
        const z = -Math.cos(a) * r + (u < 0.5 ? 0 : 0) ;
        const y = Math.sin(a) * 0.06 - (u < 0.15 || u > 0.85 ? 0 : 0);
        const drop = (k) => Math.max(0, Math.abs(k - 0.5) - 0.32) * 1.6;
        const p = [(j - 0.5) * 0.16, y + 0.02 - drop(u) * 0.8 - 0.012 * (side < 0 ? 1 : 0), z];
        return { p, c: [p[0], -0.05, 0], uv: [p[0], u], w: W, slot: SLOTS.WHITE, tone: side > 0 ? 1 : 0.7 };
      }, { flip: side < 0 });
    }
  },
  aryballos(m, lod, b) {
    ring(m, -0.03, 0.022, 0.004, lod, SLOTS.BRONZE, b);
    lathe(m, [0.0, -0.05, 0.0], [0, -1, 0], [[0.012, 0], [0.012, 0.02], [0.045, 0.045], [0.05, 0.075], [0.035, 0.11], [0.001, 0.12]], SEG[lod], SLOTS.LEATHER, b);
    // The strigil hanging beside it: a curved blade.
    const W = rigid(b);
    const n = lod === 0 ? 8 : 3;
    m.grid(n, 1, (i, j) => {
      const a = 0.3 + 1.6 * (i / n);
      const p = [0.035 + (j - 0.5) * 0.02, -0.04 - Math.sin(a) * 0.12, 0.02 - Math.cos(a) * 0.06];
      return { p, c: [0.035, -0.08, 0.06], uv: [0, 0], w: W, slot: SLOTS.BRONZE, tone: 1 };
    });
  },
  mask(m, lod, b) {
    // The face shell (facing +x, out from the hand), its open mouth and eyes dark, a crown of hair.
    const W = rigid(b);
    const rows = lod === 0 ? 8 : 4;
    const cols = lod === 0 ? 10 : 5;
    m.grid(rows, cols, (i, j) => {
      const th = Math.PI * (0.05 + 0.9 * (i / rows));
      const ph = Math.PI * (j / cols) - Math.PI / 2;
      const p = [0.04 + Math.cos(ph) * Math.sin(th) * 0.075, -0.12 + Math.cos(th) * 0.14, Math.sin(ph) * Math.sin(th) * 0.1];
      return { p, c: [-0.02, -0.12, 0], uv: [ph * 0.1, th * 0.1], w: W, slot: SLOTS.PAPYRUS, tone: 1.15 };
    });
    for (const z of [-0.035, 0.035]) boxAt(m, [0.118, -0.08, z], 0.01, 0.018, 0.03, SLOTS.DARK, b);
    boxAt(m, [0.112, -0.19, 0], 0.012, 0.03, 0.05, SLOTS.DARK, b);
    if (lod < 2) heap(m, [0.02, -0.02, 0], 0.09, 0.06, lod, SLOTS.HAIR, b);
  },
  placard(m, lod, b) {
    lathe(m, [0, -0.3, 0], [0, 1, 0], [[0.015, 0], [0.015, 1.2]], Math.max(4, SEG[lod] - 4), SLOTS.WOOD, b);
    boxAt(m, [0, 0.78, 0.022], 0.52, 0.34, 0.022, SLOTS.WOOD, b, 0.75);
    boxAt(m, [0, 0.78, 0.034], 0.46, 0.28, 0.004, SLOTS.PAPYRUS, b);
    if (lod < 2) {
      // Daubed words: strokes of red-black.
      for (let k = 0; k < 3; k++) boxAt(m, [-0.04 + (k % 2) * 0.05, 0.86 - k * 0.075, 0.037], 0.3 - k * 0.04, 0.03, 0.002, SLOTS.DARK, b);
    }
  },
  torch(m, lod, b) {
    lathe(m, [0, -0.28, 0], [0, 1, 0], [[0.018, 0], [0.02, 0.6]], Math.max(4, SEG[lod] - 4), SLOTS.WOOD, b);
    lathe(m, [0, 0.3, 0], [0, 1, 0], [[0.022, 0], [0.034, 0.03], [0.034, 0.13], [0.026, 0.15]], Math.max(4, SEG[lod] - 2), SLOTS.DARK, b);
    // The flame: a tongue and a smaller one.
    lathe(m, [0, 0.43, 0], [0, 1, 0], [[0.035, 0], [0.045, 0.05], [0.03, 0.14], [0.012, 0.22], [0.001, 0.28]], Math.max(4, SEG[lod] - 2), SLOTS.FLAME, b, { tone: (i) => 1.25 - i * 0.05 });
    if (lod < 2) lathe(m, [0.02, 0.45, 0.01], [0.2, 1, 0.1].map((v) => v / Math.hypot(0.2, 1, 0.1)), [[0.02, 0], [0.015, 0.08], [0.001, 0.15]], 5, SLOTS.FLAME, b, { tone: () => 1.35 });
  },
  shears(m, lod, b) {
    // Handles in the hand, the blades hanging below it.
    for (const s of [1, -1]) {
      boxAt(m, [s * 0.012, -0.03, 0], 0.016, 0.12, 0.02, SLOTS.WOOD, b, 0.8);
      lathe(m, [s * 0.01, -0.09, 0], [s * 0.04, -1, 0].map((v) => v / Math.hypot(0.04, 1)), [[0.012, 0], [0.01, 0.16], [0.001, 0.2]], 4, SLOTS.IRON, b, { tone: () => 1.1 });
    }
  },
  bundle(m, lod, b) {
    // A cloth bundle tied with rope: a soft box, knotted at the top.
    const W = rigid(b);
    const n = lod === 0 ? 8 : 4;
    m.grid(n, n + 4, (i, j) => {
      const th = Math.PI * (i / n);
      const ph = (TAU * j) / (n + 4);
      const sq = (v, e) => Math.sign(v) * Math.abs(v) ** e;
      const lump = lod === 0 ? 1 + 0.06 * Math.sin(ph * 3 + th * 4) : 1;
      const p = [sq(Math.sin(th) * Math.cos(ph), 0.6) * 0.21 * lump, sq(Math.cos(th), 0.6) * 0.19, sq(Math.sin(th) * Math.sin(ph), 0.6) * 0.14 * lump];
      return { p, c: [0, 0, 0], uv: [ph * 0.1, th * 0.1], w: W, slot: SLOTS.MANTLE, tone: 0.75 + 0.25 * Math.cos(ph) };
    });
    lathe(m, [0, -0.2, 0], [0, 1, 0], [[0.15, 0], [0.15, 0.016]], 8, SLOTS.ROPE, b, { closed: false });
    lathe(m, [0, 0.16, 0], [0, 1, 0], [[0.03, 0], [0.05, 0.03], [0.02, 0.07]], 6, SLOTS.MANTLE, b, { tone: () => 0.7 });
  },
  plank(m, lod, b) {
    boxAt(m, [0, 0.03, 0.25], 0.13, 0.1, 2.6, SLOTS.WOOD, b, 0.9);
  },
  staff(m, lod, b) {
    lathe(m, [0, -1.25, 0], [0, 1, 0], [[0.016, 0], [0.018, 1.7], [0.024, 1.76], [0.016, 1.8]], Math.max(4, SEG[lod] - 4), SLOTS.WOOD, b, { tone: (i) => (i > 1 ? 0.8 : 1) });
  },
  gladius(m, lod, b) {
    // The grip in the hand, the guard over it, the blade up (the pommel under the fist).
    lathe(m, [0, -0.06, 0], [0, 1, 0], [[0.03, 0], [0.03, 0.03]], 8, SLOTS.WOOD, b, { tone: () => 0.7 });
    lathe(m, [0, -0.03, 0], [0, 1, 0], [[0.016, 0], [0.016, 0.09]], 6, SLOTS.WOOD, b, { tone: () => 0.8 });
    boxAt(m, [0, 0.07, 0], 0.08, 0.025, 0.035, SLOTS.BRONZE, b);
    boxAt(m, [0, 0.31, 0], 0.052, 0.45, 0.008, SLOTS.IRON, b, 1.15);
    if (lod < 2) lathe(m, [0, 0.535, 0], [0, 1, 0], [[0.024, 0], [0.001, 0.06]], 4, SLOTS.IRON, b, { tone: () => 1.15 });
  },
};

export const WALKER_PROP_NAMES = Object.freeze(Object.keys(PROPS));

/** A walker's prop in the left hand (`side` 'L') or the right ('R') at level `lod`: a Mesher, at the prop bone's rest. */
export function walkerProp(name, side, lod) {
  const make = PROPS[name];
  if (!make) throw new Error(`No walker prop ${name}`);
  const bone = side === 'L' ? 'propL' : 'propR';
  const m = new Mesher();
  make(m, lod, bone);
  const at = BONES[BONE[bone]].at;
  return m.map(([x, y, z]) => [x + at[0], y + at[1], z + at[2]]);
}
