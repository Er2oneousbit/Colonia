/**
 * units/props.js
 * ----------------------------------------------------------------------------
 * The arms of the battlefield, each a piece on a hand's prop bone (people/
 * rig.js propL, propR) made in that bone's frame, its grip at the origin (a
 * blade or a shaft along +y, a shield's face toward +z, its grip behind the
 * boss), as the people's props (people/props.js) are, after the record:
 *
 *   pilum       the legionary's heavy javelin: an ash shaft, the pyramidal
 *               lead weight at its socket, a long soft iron shank, a barbed head
 *   scutum      the legionary's curved oblong shield of the early Empire, its
 *               face the accent with the legion's device in gold (wings and
 *               thunderbolts about the boss), bronze edging, the iron boss
 *   clipeus     the auxiliaries' and the cavalry's flat oval shield
 *   thureos     the Gaul's tall oval shield with its wooden spine and strip
 *               boss, painted (the trim's patterns on the accent)
 *   round       a northern warrior's round board shield, planks, iron boss
 *   caetra      the small round shield of the Iberians and Numidians
 *   aspis       the great round bronze-faced shield of heavy infantry
 *   parmula     a Thracian gladiator's small square shield
 *   spatha      the long sword of the cavalry
 *   longsword   the Gaul's long iron sword, its rounded point
 *   falcata     the Iberian's forward-curved sword
 *   sica        the Thracian gladiator's curved short sword
 *   handaxe     a bearded axe on a short haft
 *   greataxe    a broad axe on a long haft, held in two hands
 *   lance       a horseman's long spear
 *   dory        heavy infantry's long spear with its butt spike
 *   javelin     a light javelin; javelins: three in the left hand's bundle
 *   sling       two cords and the pouch with its stone, hanging from the hand
 *   trident     the retiarius's fork; net his cast net, gathered in the hand
 *   furca       a two-tined wooden fork (a villager's); club a knotted club
 *   signum      a century's standard: the pole hung with phalerae under a
 *               crossbar and its hand, the bearer's grip low on it
 *   aquila      the legion's eagle: gold, wings raised, on a thunderbolt
 *   vexillum    a square flag on a crossbar (its cloth waves:
 *               units/material.js), the trim's colour with a gold fringe
 * ----------------------------------------------------------------------------
 */

import { Mesher, SLOTS, rigid } from '../people/mesher.js';
import { lathe, boxAt } from '../people/props.js';
import { BONE, BONES } from '../people/rig.js';
import { WAVE_BASE, WAVE_SCALE } from './material.js';

const TAU = Math.PI * 2;
const SEG = [10, 6, 4];

/** A flat blade along +y from y0 to y1 (its half width w(u) at u 0..1 along, its thickness t), its edge's shine. */
function blade(m, lod, b, y0, y1, w, { t = 0.006, slot = SLOTS.IRON, curve = () => 0, n } = {}) {
  const W = rigid(b);
  const rows = n || (lod === 0 ? 8 : lod === 1 ? 4 : 2);
  for (const face of [1, -1]) {
    m.grid(rows, 2, (i, j) => {
      const u = i / rows;
      const y = y0 + (y1 - y0) * u;
      const half = w(u);
      const x = (j - 1) * half + curve(u);
      return { p: [x, y, face * t * (j === 1 ? 1 : 0.15)], uv: [x, y], w: W, slot, tone: j === 1 ? 1.15 : 0.9 };
    }, { flip: face < 0 });
  }
}

/** A hilt along +y round the origin: pommel, grip, guard (`guard` its half width), on bone b. */
function hilt(m, lod, b, { guard = 0.035, grip = 0.1, metal = SLOTS.BRONZE, gripSlot = SLOTS.LEATHER } = {}) {
  lathe(m, [0, -0.06, 0], [0, 1, 0], [[0.02, 0], [0.024, 0.015], [0.013, 0.025], [0.014, 0.025 + grip * 0.5], [0.013, 0.02 + grip]], SEG[lod], (i) => (i < 2 ? metal : gripSlot), b);
  boxAt(m, [0, 0.065, 0], guard * 2, 0.018, 0.03, metal, b, 1);
}

/** A shield's board: a surface over (u, v) in [-1, 1]^2 inside `inside(u, v)`, bent by `bend(u, v)` (z), its face's slot by `paint(u, v)`. */
function board(m, lod, b, { w, h, inside, bend = () => 0, paint, rows, cols, back = SLOTS.LEATHER, thick = 0.012, z0 = 0.06 }) {
  const W = rigid(b);
  const R = rows || (lod === 0 ? 16 : lod === 1 ? 6 : 3);
  const C = cols || (lod === 0 ? 12 : lod === 1 ? 5 : 3);
  // (A grid over the shield's box, each vertex pulled to the outline where it falls outside: a clean rim.)
  const at = (i, j) => {
    let u = -1 + (2 * j) / C;
    let v = -1 + (2 * i) / R;
    const r = inside(u, v);
    if (r > 1) { u /= r; v /= r; }
    return [u, v];
  };
  for (const face of [1, -1]) {
    m.grid(R, C, (i, j) => {
      const [u, v] = at(i, j);
      const p = [u * w, v * h, z0 + bend(u, v) + (face > 0 ? thick : 0)];
      const edge = inside(-1 + (2 * j) / C, -1 + (2 * i) / R) >= 0.985 || i === 0 || i === R || j === 0 || j === C;
      return { p, uv: [u, v], w: W, slot: face < 0 ? back : edge ? SLOTS.BRONZE : paint(u, v), tone: face > 0 ? 1 : 0.55 };
    }, { flip: face > 0 });
  }
}

/** An iron or bronze boss at (0, 0) of a board, `r` its radius, standing `z0` out. */
function boss(m, lod, b, r, z0, slot = SLOTS.IRON) {
  lathe(m, [0, 0, z0], [0, 0, 1], [[r, 0], [r * 0.9, r * 0.25], [r * 0.5, r * 0.6], [0.001, r * 0.72]], SEG[lod] + 2, slot, b);
}

/** The legion's device on a scutum's face at (u, v) in [-1, 1]: wings either side of the boss, thunderbolts above and below. */
export function legionDevice(u, v) {
  const au = Math.abs(u);
  const av = Math.abs(v);
  // The border band.
  if (au > 0.86 || av > 0.9) return true;
  // The wings: feathered arcs out from the boss.
  if (av < 0.36 && au > 0.18 && au < 0.72) {
    const feather = Math.sin(au * 26) * 0.08;
    if (Math.abs(v - (au - 0.2) * 0.35 * Math.sign(v || 1)) < 0.12 + feather * 0.3) return true;
  }
  // The thunderbolts: a zigzag up and down from the boss, its forks out to the corners.
  if (av > 0.25 && av < 0.82) {
    const zig = 0.09 * Math.sin(av * 22);
    if (Math.abs(u - zig) < 0.045) return true;
    const fork = (av - 0.45) * 0.9;
    if (av > 0.45 && Math.abs(au - fork) < 0.04) return true;
  }
  return false;
}

/** A shield painted with simple bold patterns (barbarian shields): a ring, a cross, a spiral's arms, by `kind`. */
function patterned(u, v, kind) {
  const r = Math.hypot(u, v);
  const a = Math.atan2(v, u);
  if (kind === 1) return Math.abs(r - 0.62) < 0.08 || Math.abs(r - 0.3) < 0.05;
  if (kind === 2) return Math.abs(u) < 0.09 || Math.abs(v) < 0.09;
  if (kind === 3) return Math.sin(a * 3 + r * 7) > 0.55 && r > 0.2;
  return r > 0.86;
}

const PROPS = {
  pilum(m, lod, b) {
    // The shaft below the grip and above it, the lead weight, the iron shank and the barbed head.
    lathe(m, [0, -0.85, 0], [0, 1, 0], [[0.012, 0], [0.016, 0.05], [0.017, 1.3]], SEG[lod], SLOTS.WOOD, b, { tone: () => 0.95 });
    lathe(m, [0, 0.4, 0], [0, 1, 0], [[0.022, 0], [0.026, 0.04], [0.022, 0.1], [0.008, 0.12]], SEG[lod], SLOTS.IRON, b, { tone: () => 0.75 });
    lathe(m, [0, 0.52, 0], [0, 1, 0], [[0.006, 0], [0.006, 0.6]], Math.max(4, SEG[lod] - 4), SLOTS.IRON, b);
    lathe(m, [0, 1.12, 0], [0, 1, 0], [[0.006, 0], [0.012, 0.015], [0.001, 0.07]], 4, SLOTS.IRON, b, { tone: () => 1.15 });
  },
  scutum(m, lod, b) {
    // Curved round the bearer (the board on a cylinder of 0.5 m), 0.66 wide, 1.06 tall, its corners rounded.
    const w = 0.33;
    const h = 0.53;
    const R = 0.5;
    board(m, lod, b, {
      w, h,
      inside: (u, v) => {
        const k = 0.82;
        const du = Math.max(0, Math.abs(u) - k) / (1 - k);
        const dv = Math.max(0, Math.abs(v) - 0.88) / 0.12;
        return Math.max(Math.abs(u), Math.abs(v), Math.hypot(du, dv) > 1 ? 1 + (Math.hypot(du, dv) - 1) * (1 - k) : 0);
      },
      bend: (u) => -(R - Math.sqrt(R * R - (u * w) ** 2)),
      paint: (u, v) => (lod < 2 && legionDevice(u, v) ? SLOTS.GOLD : SLOTS.ACCENT),
      rows: lod === 0 ? 24 : lod === 1 ? 8 : 3, cols: lod === 0 ? 16 : lod === 1 ? 6 : 3,
    });
    // (The board bends away from the bearer at its sides: flip the curve's sign.)
    boss(m, lod, b, 0.08, 0.075);
    if (lod < 2) {
      // The spine (spina) above and below the boss.
      boxAt(m, [0, 0.29, 0.078], 0.03, 0.42, 0.012, SLOTS.BRONZE, b, 0.9);
      boxAt(m, [0, -0.29, 0.078], 0.03, 0.42, 0.012, SLOTS.BRONZE, b, 0.9);
    }
  },
  clipeus(m, lod, b) {
    board(m, lod, b, {
      w: 0.32, h: 0.5,
      inside: (u, v) => Math.hypot(u, v),
      bend: (u, v) => -0.04 * (u * u + v * v),
      paint: (u, v) => {
        const r = Math.hypot(u, v);
        if (lod === 2) return SLOTS.ACCENT;
        return (r > 0.8 && r < 0.88) || (Math.abs(u) < 0.05 && r > 0.25 && r < 0.75) ? SLOTS.TRIM : SLOTS.ACCENT;
      },
    });
    boss(m, lod, b, 0.075, 0.07, SLOTS.BRONZE);
  },
  thureos(m, lod, b) {
    board(m, lod, b, {
      w: 0.29, h: 0.56,
      inside: (u, v) => Math.hypot(u, v * 0.98),
      bend: (u) => -0.05 * u * u,
      paint: (u, v) => (lod < 2 && patterned(u * 1.1, v * 0.7, 1 + (Math.abs(Math.round(v * 3)) % 2)) ? SLOTS.TRIM : SLOTS.ACCENT),
    });
    if (lod < 2) {
      // The wooden spine, its strip boss of iron over the grip.
      boxAt(m, [0, 0, 0.08], 0.04, 1.02, 0.02, SLOTS.WOOD, b, 0.85);
      boxAt(m, [0, 0, 0.092], 0.13, 0.11, 0.025, SLOTS.IRON, b, 0.9);
    } else boxAt(m, [0, 0, 0.08], 0.1, 0.1, 0.03, SLOTS.IRON, b, 0.9);
  },
  round(m, lod, b) {
    board(m, lod, b, {
      w: 0.4, h: 0.4,
      inside: (u, v) => Math.hypot(u, v),
      bend: (u, v) => -0.03 * (u * u + v * v),
      // (Planks: the field's tone by board; the pattern in the trim.)
      paint: (u, v) => (lod < 2 && patterned(u, v, 1 + (Math.floor((u + 1) * 2.7) % 3)) ? SLOTS.TRIM : SLOTS.ACCENT),
    });
    boss(m, lod, b, 0.085, 0.07);
  },
  caetra(m, lod, b) {
    board(m, lod, b, {
      w: 0.22, h: 0.22,
      inside: (u, v) => Math.hypot(u, v),
      bend: (u, v) => -0.05 * (u * u + v * v),
      paint: (u, v) => (lod < 2 && Math.abs(Math.hypot(u, v) - 0.55) < 0.12 ? SLOTS.BRONZE : SLOTS.LEATHER),
      back: SLOTS.WOOD,
    });
    boss(m, lod, b, 0.06, 0.06, SLOTS.BRONZE);
  },
  aspis(m, lod, b) {
    // A deep bronze dish, its wide flat rim; a device painted on its face.
    board(m, lod, b, {
      w: 0.45, h: 0.45,
      inside: (u, v) => Math.hypot(u, v),
      bend: (u, v) => {
        const r = Math.hypot(u, v);
        return r > 0.82 ? -0.07 : -0.07 * (r / 0.82) ** 2 + 0.07 * (1 - (r / 0.82) ** 2) * 0;
      },
      paint: (u, v) => (lod < 2 && patterned(u, v, 3) ? SLOTS.TRIM : SLOTS.BRONZE),
      back: SLOTS.WOOD,
    });
  },
  parmula(m, lod, b) {
    board(m, lod, b, {
      w: 0.2, h: 0.24,
      inside: (u, v) => Math.max(Math.abs(u), Math.abs(v)),
      bend: (u) => 0.03 * u * u,
      paint: (u, v) => (Math.abs(u) > 0.8 || Math.abs(v) > 0.82 ? SLOTS.TRIM : SLOTS.ACCENT),
    });
    boss(m, lod, b, 0.045, 0.07, SLOTS.BRONZE);
  },
  spatha(m, lod, b) {
    hilt(m, lod, b, { guard: 0.04, grip: 0.11 });
    blade(m, lod, b, 0.07, 0.82, (u) => 0.022 * (u > 0.92 ? 1 - (u - 0.92) / 0.08 : 1));
  },
  longsword(m, lod, b) {
    hilt(m, lod, b, { guard: 0.035, grip: 0.12, metal: SLOTS.IRON });
    blade(m, lod, b, 0.07, 0.88, (u) => 0.024 * (u > 0.94 ? 1 - ((u - 0.94) / 0.06) ** 2 * 0.9 : 1));
  },
  falcata(m, lod, b) {
    hilt(m, lod, b, { guard: 0.025, grip: 0.1, metal: SLOTS.IRON });
    // Forward-curved: narrow at the hilt, swelling toward the point, the edge on the inside of the curve.
    blade(m, lod, b, 0.07, 0.58, (u) => 0.018 + 0.02 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (u > 0.9 ? (1 - u) / 0.1 : 1), { curve: (u) => -0.06 * Math.sin(Math.PI * u * 0.9) });
  },
  sica(m, lod, b) {
    hilt(m, lod, b, { guard: 0.025, grip: 0.09 });
    blade(m, lod, b, 0.07, 0.42, (u) => 0.016 * (1 - 0.7 * u), { curve: (u) => 0.12 * u * u });
  },
  handaxe(m, lod, b) {
    lathe(m, [0, -0.12, 0], [0, 1, 0], [[0.016, 0], [0.017, 0.62]], SEG[lod], SLOTS.WOOD, b);
    // The bearded head: its edge drooping below the haft.
    const W = rigid(b);
    for (const face of [1, -1]) {
      m.grid(2, 3, (i, j) => {
        const x = -0.01 + (0.16 * j) / 3;
        const top = 0.5 + 0.02 * (j / 3);
        const bot = 0.42 - 0.08 * (j / 3) ** 2;
        const y = bot + (top - bot) * (i / 2);
        return { p: [face * 0.008 * (1 - j / 3), y, -x], uv: [x, y], w: W, slot: SLOTS.IRON, tone: j === 3 ? 1.2 : 0.9 };
      }, { flip: face < 0 });
    }
    lathe(m, [0, 0.42, 0], [0, 1, 0], [[0.024, 0], [0.024, 0.09]], 6, SLOTS.IRON, b, { tone: () => 0.8 });
  },
  greataxe(m, lod, b) {
    lathe(m, [0, -0.05, 0], [0, 1, 0], [[0.018, 0], [0.02, 1.15]], SEG[lod], SLOTS.WOOD, b);
    const W = rigid(b);
    for (const face of [1, -1]) {
      m.grid(2, 4, (i, j) => {
        const x = (0.18 * j) / 4;
        const top = 1.1 + 0.05 * (j / 4) ** 1.5;
        const bot = 1.0 - 0.06 * (j / 4) ** 1.5;
        const y = bot + (top - bot) * (i / 2);
        return { p: [face * 0.01 * (1 - j / 4), y, -0.02 - x], uv: [x, y], w: W, slot: SLOTS.IRON, tone: j === 4 ? 1.2 : 0.9 };
      }, { flip: face < 0 });
    }
    lathe(m, [0, 0.98, 0], [0, 1, 0], [[0.028, 0], [0.028, 0.13]], 6, SLOTS.IRON, b, { tone: () => 0.8 });
  },
  lance(m, lod, b) {
    lathe(m, [0, -1.0, 0], [0, 1, 0], [[0.01, 0], [0.015, 0.06], [0.016, 2.4]], SEG[lod], (i) => (i < 1 ? SLOTS.IRON : SLOTS.WOOD), b);
    lathe(m, [0, 1.4, 0], [0, 1, 0], [[0.014, 0], [0.026, 0.08], [0.02, 0.2], [0.001, 0.3]], Math.max(4, SEG[lod] - 2), SLOTS.IRON, b, { tone: () => 1.1 });
  },
  dory(m, lod, b) {
    lathe(m, [0, -1.0, 0], [0, 1, 0], [[0.008, 0], [0.018, 0.2], [0.018, 0.25], [0.017, 2.2]], SEG[lod], (i) => (i < 2 ? SLOTS.BRONZE : SLOTS.WOOD), b);
    lathe(m, [0, 1.2, 0], [0, 1, 0], [[0.014, 0], [0.03, 0.1], [0.022, 0.24], [0.001, 0.34]], Math.max(4, SEG[lod] - 2), SLOTS.IRON, b, { tone: () => 1.1 });
  },
  javelin(m, lod, b) {
    lathe(m, [0, -0.5, 0], [0, 1, 0], [[0.008, 0], [0.01, 1.1]], Math.max(4, SEG[lod] - 4), SLOTS.WOOD, b);
    lathe(m, [0, 0.6, 0], [0, 1, 0], [[0.01, 0], [0.016, 0.04], [0.001, 0.14]], 4, SLOTS.IRON, b);
  },
  javelins(m, lod, b) {
    for (const [x, z, a] of [[-0.02, 0, -0.05], [0.015, 0.01, 0.03], [0, -0.02, 0.08]]) {
      lathe(m, [x, -0.55, z], [Math.sin(a), Math.cos(a), 0], [[0.008, 0], [0.009, 1.15]], 4, SLOTS.WOOD, b);
      lathe(m, [x + Math.sin(a) * 1.15, -0.55 + Math.cos(a) * 1.15, z], [Math.sin(a), Math.cos(a), 0], [[0.009, 0], [0.014, 0.04], [0.001, 0.13]], 4, SLOTS.IRON, b);
    }
  },
  sling(m, lod, b) {
    // Two cords from the fist down -y, the pouch between their ends, its stone.
    for (const x of [-0.006, 0.006]) lathe(m, [x, 0, 0], [0, -1, 0], [[0.0025, 0], [0.0025, 0.55]], 3, SLOTS.ROPE, b);
    lathe(m, [0, -0.55, 0], [0, -1, 0], [[0.012, 0], [0.03, 0.03], [0.03, 0.06], [0.012, 0.09]], 6, SLOTS.LEATHER, b);
  },
  trident(m, lod, b) {
    lathe(m, [0, -0.8, 0], [0, 1, 0], [[0.014, 0], [0.016, 1.75]], SEG[lod], SLOTS.WOOD, b);
    boxAt(m, [0, 0.96, 0], 0.16, 0.025, 0.02, SLOTS.IRON, b, 0.9);
    for (const x of [-0.07, 0, 0.07]) lathe(m, [x, 0.96, 0], [0, 1, 0], [[0.008, 0], [0.007, 0.2], [0.001, 0.26]], 4, SLOTS.IRON, b, { tone: () => 1.1 });
  },
  net(m, lod, b) {
    // The cast net gathered in the hand, hanging in folds.
    const n = lod === 0 ? 10 : 5;
    const W = rigid(b);
    m.grid(n, n, (i, j) => {
      const v = i / n;
      const a = (TAU * j) / n;
      const r = 0.02 + 0.12 * v + 0.02 * Math.sin(a * 5 + v * 7);
      return { p: [Math.cos(a) * r, -0.6 * v, Math.sin(a) * r * 0.7 + 0.04], c: [0, -0.6 * v, 0.04], uv: [a, v], w: W, slot: SLOTS.ROPE, tone: 0.75 + 0.2 * Math.sin(a * 9 + v * 13) };
    });
  },
  furca(m, lod, b) {
    lathe(m, [0, -0.7, 0], [0, 1, 0], [[0.016, 0], [0.018, 1.45]], SEG[lod], SLOTS.WOOD, b, { tone: () => 0.85 });
    for (const x of [-0.05, 0.05]) lathe(m, [x * 0.3, 0.72, 0], [x, 1, 0], [[0.013, 0], [0.011, 0.3], [0.004, 0.36]], 5, SLOTS.WOOD, b, { tone: () => 0.8 });
  },
  club(m, lod, b) {
    lathe(m, [0, -0.1, 0], [0, 1, 0], [[0.02, 0], [0.025, 0.3], [0.045, 0.6], [0.05, 0.7], [0.02, 0.76]], SEG[lod], SLOTS.WOOD, b, { tone: (i) => (i > 2 ? 0.7 : 0.9) });
  },
  signum(m, lod, b) {
    // The pole from below the grip, the discs (phalerae) on a board down its front, a crossbar with tassels,
    // a wreath and the open hand (manus) at the top.
    lathe(m, [0, -1.0, 0], [0, 1, 0], [[0.02, 0], [0.018, 2.9]], SEG[lod], (i) => (i < 1 ? SLOTS.IRON : SLOTS.WOOD), b);
    for (let k = 0; k < (lod === 2 ? 3 : 6); k++) {
      const y = 0.55 + k * (lod === 2 ? 0.36 : 0.18);
      lathe(m, [0, y, 0.025], [0, 0, 1], [[0.07, 0], [0.065, 0.015], [0.03, 0.025], [0.001, 0.028]], SEG[lod] + 2, SLOTS.GOLD, b);
    }
    boxAt(m, [0, 1.72, 0], 0.4, 0.025, 0.025, SLOTS.GOLD, b, 0.9);
    if (lod < 2) for (const x of [-0.18, 0.18]) lathe(m, [x, 1.71, 0], [0, -1, 0], [[0.006, 0], [0.006, 0.18], [0.02, 0.22], [0.001, 0.26]], 4, SLOTS.TRIM, b);
    lathe(m, [0, 1.82, 0], [0, 0, 1], [[0.09, -0.01], [0.09, 0.01]], SEG[lod] + 4, SLOTS.LEAF, b, { closed: false });
    boxAt(m, [0, 1.98, 0], 0.07, 0.14, 0.02, SLOTS.GOLD, b, 1);
  },
  aquila(m, lod, b) {
    lathe(m, [0, -1.0, 0], [0, 1, 0], [[0.022, 0], [0.02, 2.75]], SEG[lod], (i) => (i < 1 ? SLOTS.IRON : SLOTS.WOOD), b);
    // The thunderbolt the eagle grips, the body, the head turned, the wings raised high.
    boxAt(m, [0, 1.76, 0], 0.3, 0.035, 0.05, SLOTS.GOLD, b, 0.85);
    const W = rigid(b);
    const body = [0, 1.86, 0.02];
    m.grid(lod === 0 ? 6 : 3, lod === 0 ? 8 : 5, (i, j) => {
      const th = (Math.PI * i) / (lod === 0 ? 6 : 3);
      const ph = (TAU * j) / (lod === 0 ? 8 : 5);
      const p = [body[0] + Math.sin(th) * Math.sin(ph) * 0.05, body[1] + Math.cos(th) * 0.09, body[2] + Math.sin(th) * Math.cos(ph) * 0.06];
      return { p, c: body, uv: [ph, th], w: W, slot: SLOTS.GOLD, tone: 1 };
    });
    lathe(m, [0, 1.96, 0.03], [0, 0.4, 1], [[0.03, 0], [0.025, 0.05], [0.001, 0.09]], 5, SLOTS.GOLD, b);
    for (const s of [1, -1]) {
      m.grid(lod === 0 ? 4 : 2, lod === 0 ? 3 : 1, (i, j) => {
        const u = i / (lod === 0 ? 4 : 2);
        const v = j / (lod === 0 ? 3 : 1);
        const x = s * (0.04 + 0.2 * u);
        const y = 1.88 + 0.22 * u + 0.08 * u * u - 0.12 * v * (1 - 0.6 * u);
        return { p: [x, y, 0.0 - 0.03 * u], c: [x, y, 1], uv: [u, v], w: W, slot: SLOTS.GOLD, tone: 0.9 + 0.15 * v };
      }, { flip: s < 0 });
      m.grid(lod === 0 ? 4 : 2, lod === 0 ? 3 : 1, (i, j) => {
        const u = i / (lod === 0 ? 4 : 2);
        const v = j / (lod === 0 ? 3 : 1);
        const x = s * (0.04 + 0.2 * u);
        const y = 1.88 + 0.22 * u + 0.08 * u * u - 0.12 * v * (1 - 0.6 * u);
        return { p: [x, y, -0.006 - 0.03 * u], c: [x, y, -1], uv: [u, v], w: W, slot: SLOTS.GOLD, tone: 0.75 };
      }, { flip: s > 0 });
    }
  },
  vexillum(m, lod, b) {
    lathe(m, [0, -1.0, 0], [0, 1, 0], [[0.02, 0], [0.018, 2.75]], SEG[lod], (i) => (i < 1 ? SLOTS.IRON : SLOTS.WOOD), b);
    boxAt(m, [0, 1.68, 0], 0.62, 0.025, 0.025, SLOTS.WOOD, b, 0.8);
    lathe(m, [0, 1.75, 0], [0, 1, 0], [[0.03, 0], [0.02, 0.06], [0.001, 0.14]], 5, SLOTS.GOLD, b);
    // The cloth hanging from the crossbar, waving (its vertices' distance from the bar in aBones.w).
    const rows = lod === 0 ? 8 : lod === 1 ? 4 : 2;
    const cols = lod === 0 ? 8 : lod === 1 ? 4 : 2;
    const at = BONES[BONE[b]].at;
    void at;
    for (const face of [1, -1]) {
      m.grid(rows, cols, (i, j) => {
        const v = i / rows;
        const x = -0.29 + (0.58 * j) / cols;
        const y = 1.665 - 0.58 * v;
        const wv = Math.round(WAVE_BASE + Math.min(55, v * 0.58 * WAVE_SCALE));
        const W = rigid(b);
        const fringe = v > 0.9;
        return { p: [x, y, face * 0.004], uv: [x, y], w: { b: [W.b[0], W.b[1], W.b[2], wv], w: W.w }, slot: fringe ? SLOTS.GOLD : SLOTS.TRIM, tone: face > 0 ? 1 : 0.8 };
      }, { flip: face < 0 });
    }
  },
};

export const UNIT_PROP_NAMES = Object.freeze(Object.keys(PROPS));

/** An arm on the left hand (`side` 'L') or the right ('R') at `lod`: a Mesher at the prop bone's rest. */
export function unitProp(name, side, lod) {
  const make = PROPS[name];
  if (!make) throw new Error(`No unit prop ${name}`);
  const bone = side === 'L' ? 'propL' : 'propR';
  const m = new Mesher();
  make(m, lod, bone);
  const at = BONES[BONE[bone]].at;
  return m.map(([x, y, z]) => [x + at[0], y + at[1], z + at[2]]);
}
