/**
 * people/props.js
 * ----------------------------------------------------------------------------
 * What the 3D look's people hold, each a piece skinned to a hand's prop bone
 * (rig.js propL, propR), made in that bone's own frame (the grip at the
 * origin; a clip places the bone, clips.js) and moved to where the bone rests:
 *
 *   patera    the shallow dish of a libation, with its boss
 *   tibiae    the double pipes, their bells, at the lips by their mouthpieces
 *   tablet    a wax tablet (tabula cerata): the wooden frame, the black wax
 *   stylus    the bronze stylus that writes on it
 *   rollOpen  a book roll held open: the two rolled ends, the sheet between
 *   roll      a book roll closed, with its tag
 *   spear     a spear (hasta): ash shaft, iron head and butt
 *   scutum    the legionary's curved shield: its painted face, bronze rim and boss
 *   broom     a broom of twigs bound to a shaft
 *   purse     a leather purse hanging from the hand
 *   axe       the victimarius's long-handled axe (securis)
 *   fasces    a lictor's rods bound in red thongs round an axe
 *   acerra    the incense box carried by the priest's boy
 *   hammer    a mallet; chisel; coin
 *   beam      the handle of a pump's beam (the hands on its crossbar)
 *   sack      a sack carried on the shoulder
 * ----------------------------------------------------------------------------
 */

import { Mesher, SLOTS, rigid } from './mesher.js';
import { BONE, BONES } from './rig.js';

const TAU = Math.PI * 2;

/** Detail by level: segments round a rod, a dish. */
const SEG = [10, 6, 4];

/**
 * A solid of revolution about an axis: profile [[r, t], ...] along the axis
 * from `a` toward `dir` (unit), `seg` round; slot by profile point.
 */
function lathe(m, a, dir, profile, seg, slot, bone, { tone = () => 1, closed = true } = {}) {
  // Two axes square to dir.
  const up = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u = [dir[1] * up[2] - dir[2] * up[1], dir[2] * up[0] - dir[0] * up[2], dir[0] * up[1] - dir[1] * up[0]];
  const ul = Math.hypot(...u);
  u = u.map((q) => q / ul);
  const v = [dir[1] * u[2] - dir[2] * u[1], dir[2] * u[0] - dir[0] * u[2], dir[0] * u[1] - dir[1] * u[0]];
  const w = rigid(bone);
  const P = closed ? [[0, profile[0][1]], ...profile, [0, profile[profile.length - 1][1]]] : profile;
  m.grid(P.length - 1, seg, (i, j) => {
    const [r, t] = P[i];
    const ph = (TAU * j) / seg;
    const c = [a[0] + dir[0] * t, a[1] + dir[1] * t, a[2] + dir[2] * t];
    const p = [c[0] + (u[0] * Math.cos(ph) + v[0] * Math.sin(ph)) * r, c[1] + (u[1] * Math.cos(ph) + v[1] * Math.sin(ph)) * r, c[2] + (u[2] * Math.cos(ph) + v[2] * Math.sin(ph)) * r];
    const s = typeof slot === 'function' ? slot(i, t) : slot;
    return { p, c, uv: [ph * 0.02, t], w, slot: s, tone: tone(i, t) };
  });
}

/** A box w x h x d about `c` (axis-aligned), on `bone`. */
function boxAt(m, c, w, h, d, slot, bone, tone = 1) {
  const W = rigid(bone);
  const corners = (sx, sy, sz) => [c[0] + (sx * w) / 2, c[1] + (sy * h) / 2, c[2] + (sz * d) / 2];
  const faces = [
    [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]],
    [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]],
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
  ];
  for (const f of faces) {
    const ids = f.map((q) => m.vertex(corners(...q), [q[0] * w + q[2] * d, q[1] * h], W, slot, tone));
    m.tri(ids[0], ids[1], ids[2]);
    m.tri(ids[0], ids[2], ids[3]);
  }
}

const norm = (v) => {
  const l = Math.hypot(...v);
  return v.map((q) => q / l);
};

/** Each prop's maker: (m, lod, bone) in the bone's frame, its grip at the origin. */
const PROPS = {
  patera(m, lod, b) {
    lathe(m, [0, -0.012, 0], [0, 1, 0], [[0.03, 0], [0.072, 0.012], [0.078, 0.02], [0.07, 0.022], [0.03, 0.008], [0.014, 0.014]], SEG[lod] * 2, SLOTS.BRONZE, b, { tone: (i) => (i > 3 ? 0.75 : 1) });
  },
  tibiae(m, lod, b) {
    for (const s of [1, -1]) {
      const d = norm([Math.sin(0.16 * s), 0, Math.cos(0.16 * s)]);
      lathe(m, [0, 0, 0], d, [[0.006, 0], [0.008, 0.03], [0.007, 0.05], [0.009, 0.4], [0.016, 0.46], [0.022, 0.5]], SEG[lod], (i) => (i < 3 ? SLOTS.BRONZE : SLOTS.WOOD), b, { tone: (i) => (i === 4 ? 0.8 : 1) });
    }
  },
  tablet(m, lod, b) {
    boxAt(m, [0, 0, 0], 0.2, 0.012, 0.14, SLOTS.WOOD, b, 0.9);
    boxAt(m, [0, 0.0065, 0], 0.17, 0.002, 0.11, SLOTS.WAX, b);
  },
  stylus(m, lod, b) {
    lathe(m, [0, 0.02, 0.01], norm([0, -1, 0.35]), [[0.003, 0], [0.003, 0.11], [0.0005, 0.13]], 4, SLOTS.BRONZE, b);
  },
  rollOpen(m, lod, b) {
    for (const s of [1, -1]) lathe(m, [s * 0.14, -0.11, 0], [0, 1, 0], [[0.022, 0], [0.022, 0.22]], SEG[lod], SLOTS.PAPYRUS, b, { tone: () => 0.85 });
    // The sheet between: both faces.
    const W = rigid(b);
    const n = lod === 0 ? 8 : 2;
    for (const face of [1, -1]) {
      m.grid(1, n, (i, j) => {
        const x = -0.14 + (0.28 * j) / n;
        const z = 0.004 * face - 0.015 * Math.sin((Math.PI * j) / n) + 0.01;
        return { p: [x, -0.1 + 0.2 * i, z], uv: [x, i], w: W, slot: SLOTS.PAPYRUS, tone: face > 0 ? 1 : 0.85 };
      }, { flip: face < 0 });
    }
  },
  roll(m, lod, b) {
    lathe(m, [0, 0, -0.12], [0, 0, 1], [[0.028, 0], [0.028, 0.26]], SEG[lod], SLOTS.PAPYRUS, b, { tone: () => 0.9 });
  },
  spear(m, lod, b) {
    lathe(m, [0, -1.12, 0], [0, 1, 0], [[0.01, 0], [0.014, 0.08], [0.016, 0.1], [0.015, 2.0], [0.012, 2.02]], SEG[lod], (i) => (i < 2 ? SLOTS.IRON : SLOTS.WOOD), b, { closed: false });
    // The head: a leaf of iron.
    lathe(m, [0, 0.9, 0], [0, 1, 0], [[0.012, 0], [0.024, 0.09], [0.018, 0.2], [0.001, 0.28]], Math.max(4, SEG[lod] - 2), SLOTS.IRON, b, { tone: () => 1.1 });
  },
  scutum(m, lod, b) {
    const W = rigid(b);
    const rows = lod === 0 ? 8 : 3;
    const cols = lod === 0 ? 8 : 3;
    const R = 0.55;
    // The board curved round the bearer (its face toward +z), the grip behind its boss.
    for (const face of [1, -1]) {
      m.grid(rows, cols, (i, j) => {
        const y = -0.5 + i / rows;
        const a = (-0.62 + (1.24 * j) / cols) * 0.58;
        const r = R + (face > 0 ? 0.012 : 0);
        const p = [Math.sin(a) * r, y, Math.cos(a) * r - R + 0.06];
        const rim = i === 0 || i === rows || j === 0 || j === cols;
        const band = lod === 0 && (Math.abs(y - 0.2) < 0.03 || Math.abs(y + 0.2) < 0.03);
        return { p, uv: [a, y], w: W, slot: face < 0 ? SLOTS.LEATHER : rim ? SLOTS.BRONZE : band ? SLOTS.GOLD : SLOTS.ACCENT, tone: face > 0 ? 1 : 0.6 };
      }, { flip: face > 0 });
    }
    lathe(m, [0, 0, 0.07], [0, 0, 1], [[0.07, 0], [0.06, 0.02], [0.03, 0.04], [0.001, 0.045]], SEG[lod], SLOTS.BRONZE, b);
  },
  broom(m, lod, b) {
    lathe(m, [0, -0.05, 0], [0, 1, 0], [[0.014, 0], [0.014, 0.95]], SEG[lod], SLOTS.WOOD, b);
    lathe(m, [0, 0.88, 0], [0, 1, 0], [[0.02, 0], [0.03, 0.06], [0.07, 0.2], [0.075, 0.24], [0.02, 0.25]], SEG[lod], (i) => (i < 2 ? SLOTS.ROPE : SLOTS.WOOD), b, { tone: (i) => (i > 1 ? 0.75 : 1) });
  },
  purse(m, lod, b) {
    lathe(m, [0, -0.01, 0.0], [0, -1, 0], [[0.008, 0], [0.025, 0.02], [0.04, 0.06], [0.035, 0.09], [0.001, 0.1]], SEG[lod], SLOTS.LEATHER, b);
  },
  axe(m, lod, b) {
    lathe(m, [0, -0.1, 0], [0, 1, 0], [[0.016, 0], [0.016, 0.85]], SEG[lod], SLOTS.WOOD, b);
    boxAt(m, [0, 0.7, -0.07], 0.02, 0.16, 0.14, SLOTS.IRON, b, 1.05);
  },
  fasces(m, lod, b) {
    const n = lod === 0 ? 6 : 3;
    for (let k = 0; k < n; k++) {
      const a = (TAU * k) / n;
      lathe(m, [Math.cos(a) * 0.024, -0.12, Math.sin(a) * 0.024], [0, 1, 0], [[0.011, 0], [0.011, 0.95]], Math.max(4, SEG[lod] - 4), SLOTS.WOOD, b, { tone: () => 0.8 + 0.2 * Math.cos(a) });
    }
    for (const y of [0.1, 0.4, 0.7]) lathe(m, [0, y, 0], [0, 1, 0], [[0.04, 0], [0.04, 0.025]], SEG[lod], SLOTS.ACCENT, b);
    boxAt(m, [0, 0.86, -0.06], 0.012, 0.12, 0.13, SLOTS.IRON, b, 1.05);
  },
  acerra(m, lod, b) {
    boxAt(m, [0, 0.02, 0], 0.17, 0.085, 0.11, SLOTS.WOOD, b, 0.85);
    boxAt(m, [0, 0.068, 0], 0.18, 0.014, 0.12, SLOTS.BRONZE, b);
  },
  hammer(m, lod, b) {
    lathe(m, [-0.04, 0, 0], [1, 0, 0], [[0.012, 0], [0.012, 0.26]], SEG[lod], SLOTS.WOOD, b);
    lathe(m, [0.22, -0.05, 0], [0, 1, 0], [[0.03, 0], [0.032, 0.1]], SEG[lod], SLOTS.WOOD, b, { tone: () => 0.75 });
  },
  chisel(m, lod, b) {
    lathe(m, [0, -0.09, 0], [0, 1, 0], [[0.001, 0], [0.007, 0.02], [0.007, 0.14], [0.011, 0.15], [0.011, 0.2]], Math.max(4, SEG[lod] - 4), (i) => (i < 4 ? SLOTS.IRON : SLOTS.WOOD), b);
  },
  coin(m, lod, b) {
    lathe(m, [0, -0.02, 0.01], [1, 0, 0], [[0.011, 0], [0.011, 0.003]], 8, SLOTS.GOLD, b);
  },
  beam(m, lod, b) {
    // The crossbar the hands hold, and the beam from it to its pivot (+z).
    lathe(m, [-0.2, 0, 0], [1, 0, 0], [[0.018, 0], [0.018, 0.4]], SEG[lod], SLOTS.WOOD, b);
    lathe(m, [0, 0, 0], [0, 0, 1], [[0.03, 0], [0.034, 0.44]], Math.max(4, SEG[lod] - 2), SLOTS.WOOD, b, { tone: () => 0.85 });
  },
  sack(m, lod, b) {
    const n = lod === 0 ? 10 : 5;
    const W = rigid(b);
    m.grid(n, n + 2, (i, j) => {
      const th = (Math.PI * i) / n;
      const ph = (TAU * j) / (n + 2);
      const lump = lod === 0 ? 1 + 0.1 * Math.sin(ph * 3 + th * 5) : 1;
      const p = [Math.sin(th) * Math.sin(ph) * 0.13 * lump, 0.05 + Math.sin(th) * Math.cos(ph) * 0.09 * lump, Math.cos(th) * 0.28];
      return { p, c: [0, 0.05, p[2]], uv: [ph * 0.1, th * 0.1], w: W, slot: SLOTS.ROPE, tone: 0.8 + 0.2 * Math.cos(ph) };
    });
  },
};

export const PROP_NAMES = Object.freeze(Object.keys(PROPS));

/** A prop on the left hand (`side` 'L') or the right ('R'), at level `lod`: a Mesher, at the prop bone's rest. */
export function prop(name, side, lod) {
  const make = PROPS[name];
  if (!make) throw new Error(`No prop ${name}`);
  const bone = side === 'L' ? 'propL' : 'propR';
  const m = new Mesher();
  make(m, lod, bone);
  const at = BONES[BONE[bone]].at;
  return m.map(([x, y, z]) => [x + at[0], y + at[1], z + at[2]]);
}
