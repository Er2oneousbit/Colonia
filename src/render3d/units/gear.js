/**
 * units/gear.js
 * ----------------------------------------------------------------------------
 * What the fighting men wear, each a piece skinned to the people's rig
 * (people/rig.js) over their body (people/body.js), as the people's garments
 * are (people/garments.js), after the record (Trajan's column and the
 * soldiers' tombstones, the Kalkriese finds, the Gaulish and Iberian
 * warriors' statues and graves, the gladiators' reliefs):
 *
 *   Helmets (on the head bone):
 *     montefortino  the bronze bowl of the Republic's legions: its knob, a
 *                   short neck guard, hinged cheek pieces
 *     crest         a horsehair crest on the knob, falling back (the trim)
 *     plume         a tall white crest of horsehair (Caesar's men)
 *     conical       the eastern archers' tall pointed iron helmet with its
 *                   cheek and neck flaps
 *     celtic        a Gaulish iron cap with its rim and knob
 *     attic         heavy infantry's helmet, browband and cheek pieces, a crest
 *                   on a stilt front to back (the trim)
 *     murmillo      the broad-brimmed gladiator's helmet with its grille visor
 *                   and fish-fin crest; thraex the same with a griffin's crest
 *     pelt          a bear's skin over the head and shoulders (the standard
 *                   bearer's: the mantle's colour)
 *     cap           a soft peaked cap (a hillman's, a Thracian's)
 *   Body:
 *     segmentata    the plate cuirass of the early Empire: hoops round the
 *                   trunk, the shoulder guards over it
 *     squamata      a shirt of bronze scales to the hips, short sleeves
 *     linothorax    a cuirass of layered linen, its shoulder flaps, the
 *                   pteruges hanging from its waist
 *     bracae        trousers (the trim, checked): the northern peoples'
 *     sagum         a cloak on the back, pinned at the right shoulder (the mantle)
 *     hide          an animal's skin over the left shoulder
 *     loin          a gladiator's loincloth and his broad belt
 *     belt          a warrior's leather belt
 *     torc          the gold neck ring of a Gaul of standing
 *     greaves       bronze greaves on both shins; greave on the left only;
 *                   wraps the padded wrappings of a gladiator's thighs
 *     manica        the guard on a gladiator's sword arm
 *     galerus       the retiarius's raised guard on his left shoulder
 *     quiver        an archer's quiver on his back, its arrows' fletching
 *     scabbard      a gladius's on the right hip (`:long` a spatha's on the left)
 *   Hair:
 *     longhair      long hair to the shoulders, combed back (the hair)
 *     moustache     the long Gaulish moustache
 *     knot          the Suebian knot over the right temple
 * ----------------------------------------------------------------------------
 */

import { Mesher, SLOTS, trunkWeights, weights, rigid } from '../people/mesher.js';
import { trunkSection, trunkPoint, limbTube, armRadius, legRadius, headPoint, headAngles, headWeights, HEAD_C } from '../people/body.js';
import { BONE } from '../people/rig.js';

const TAU = Math.PI * 2;
const gauss = (x) => Math.exp(-x * x);
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const fract = (x) => x - Math.floor(x);

/** Rows and columns by level of detail. */
const GR = [{ rows: 14, cols: 24, limb: 8, limbC: 10, head: 10, headC: 22 }, { rows: 6, cols: 12, limb: 4, limbC: 6, head: 5, headC: 10 }, { rows: 3, cols: 7, limb: 2, limbC: 4, head: 3, headC: 6 }];

/** A shell round the trunk from y0 to y1 (rings by trunkPoint), pushed out off(y, phi), its slot and tone by place. */
function shell(m, kind, lod, { y0, y1, rows, off, slot, tone = () => 1, w = null, phi0 = -Math.PI, phi1 = Math.PI }) {
  const R = GR[lod];
  const cols = R.cols;
  const nr = rows ?? R.rows;
  m.grid(nr, cols, (i, j) => {
    const y = y0 + ((y1 - y0) * i) / nr;
    const phi = phi0 + ((phi1 - phi0) * j) / cols;
    let p;
    if (y >= 0.8) p = trunkPoint(y, phi, kind, off(y, phi));
    else {
      // Below the hips: the hips' section, widening a little (a skirt clears a stride).
      const s = trunkSection(0.8, kind);
      const o = off(y, phi) + 0.03 * smooth(0.8, 0.5, y);
      p = [(s.a + o) * Math.sin(phi), y, s.zc + ((Math.cos(phi) > 0 ? s.bf : s.bb) + o) * Math.cos(phi)];
    }
    const c = [0, y, trunkSection(Math.max(0.8, y), kind).zc];
    return { p, c, uv: [phi * 0.2, y], w: w ? w(p, y, phi) : trunkWeights(p[0], p[1], p[2], { legs: y < 0.95 ? 0.6 : 0.2 }), slot: slot(y, phi, i, j), tone: tone(y, phi, i, j) };
  });
}

/** A helmet's bowl over the head: theta (from the crown) to `edge(phi)`, pushed out `off`, its shape by `bulge`. */
function bowl(m, kind, lod, { edge, off = 0.012, slot = SLOTS.METAL, tone = () => 0.95, bulge = () => 0, rows }) {
  const R = GR[lod];
  const cols = R.headC;
  const nr = rows ?? R.head;
  const { ph } = headAngles(1, cols, 0);
  m.grid(nr, cols, (i, j) => {
    const phi = ph[j];
    const th = 0.02 + (edge(phi) - 0.02) * (i / nr);
    const { p } = headPoint(th, phi, kind, off + bulge(th, phi), 0);
    return { p, c: HEAD_C, uv: [phi * 0.05, th * 0.05], w: rigid('head'), slot: typeof slot === 'function' ? slot(th, phi) : slot, tone: tone(th, phi, i) };
  });
}

/** A brim or flange round a helmet's edge: out by `out(phi)`, down by `drop(phi)`, from phi a to b. */
function brim(m, kind, lod, { edge, out, drop = () => 0, a = -Math.PI, b = Math.PI, off = 0.012, slot = SLOTS.METAL, tone = 0.85 }) {
  const cols = GR[lod].headC;
  m.grid(1, cols, (i, j) => {
    const phi = a + ((b - a) * j) / cols;
    const { p: q } = headPoint(edge(phi), phi, kind, off, 0);
    const dx = q[0] - HEAD_C[0];
    const dz = q[2] - HEAD_C[2];
    const l = Math.hypot(dx, dz) || 1;
    const o = i * out(phi);
    const p = [q[0] + (dx / l) * o, q[1] - i * drop(phi), q[2] + (dz / l) * o];
    return { p, c: [HEAD_C[0], q[1] + 0.05, HEAD_C[2]], uv: [phi, i], w: rigid('head'), slot, tone };
  });
}

/** A small ellipsoid on a bone (a knob, a stud, a knot). */
function blob(m, c, rx, ry, rz, n, w, slot, tone = 1) {
  m.grid(Math.max(2, n >> 1), n, (i, j) => {
    const th = (Math.PI * i) / Math.max(2, n >> 1);
    const ph = (TAU * j) / n;
    return { p: [c[0] + Math.sin(th) * Math.sin(ph) * rx, c[1] + Math.cos(th) * ry, c[2] + Math.sin(th) * Math.cos(ph) * rz], c, uv: [ph, th], w, slot, tone };
  });
}

/** A tube along points (each [x, y, z]) with radius r(i), on weights w(i); slot and tone. */
function tube(m, pts, r, { w, slot, tone = () => 1, seg = 6, flat = 1 }) {
  const n = pts.length;
  m.grid(n - 1, seg, (i, j) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const dl = Math.hypot(...d) || 1;
    const t = d.map((q) => q / dl);
    const ref = Math.abs(t[1]) > 0.8 ? [1, 0, 0] : [0, 1, 0];
    let u = [t[1] * ref[2] - t[2] * ref[1], t[2] * ref[0] - t[0] * ref[2], t[0] * ref[1] - t[1] * ref[0]];
    const ul = Math.hypot(...u) || 1;
    u = u.map((q) => q / ul);
    const v = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
    const ph = (TAU * j) / seg;
    const rr = typeof r === 'function' ? r(i) : r;
    const c = pts[i];
    const p = [c[0] + (u[0] * Math.cos(ph) * flat + v[0] * Math.sin(ph)) * rr, c[1] + (u[1] * Math.cos(ph) * flat + v[1] * Math.sin(ph)) * rr, c[2] + (u[2] * Math.cos(ph) * flat + v[2] * Math.sin(ph)) * rr];
    return { p, c, uv: [ph, i], w: typeof w === 'function' ? w(i) : w, slot: typeof slot === 'function' ? slot(i) : slot, tone: tone(i, ph) };
  });
}

const HEAD_TOP = [HEAD_C[0], HEAD_C[1] + 0.112, HEAD_C[2]];

// ---------------------------------------------------------------------------
// Helmets
// ---------------------------------------------------------------------------

function cheekPieces(m, kind, lod, slot = SLOTS.METAL) {
  if (lod === 2) return;
  for (const s of [1, -1]) {
    const n = lod === 0 ? 4 : 2;
    m.grid(n, n, (i, j) => {
      const v = i / n;
      const u = j / n;
      const phi = s * (1.0 + 0.55 * u);
      const th = 1.32 + 0.62 * v * (1 - 0.3 * u);
      const { p } = headPoint(th, phi, kind, 0.016, 0);
      p[2] += 0.008 * v;
      return { p, c: HEAD_C, uv: [u, v], w: rigid('head'), slot, tone: 0.9 - 0.1 * v };
    });
  }
}

const HELMETS = {
  montefortino(m, kind, lod) {
    // A rounded bronze bowl, lower behind; a thickened rim; the knob on top; a little neck guard.
    const edge = (phi) => 1.18 + 0.2 * Math.max(0, -Math.cos(phi)) - 0.05 * Math.max(0, Math.cos(phi));
    bowl(m, kind, lod, { edge, off: 0.014, slot: SLOTS.BRONZE, bulge: (th) => 0.006 * Math.sin(th * 2.4), tone: (th) => 0.85 + 0.15 * Math.cos(th) });
    brim(m, kind, lod, { edge, out: (phi) => 0.012 + 0.03 * Math.max(0, -Math.cos(phi)) ** 2, drop: (phi) => 0.01 + 0.015 * Math.max(0, -Math.cos(phi)), off: 0.014, slot: SLOTS.BRONZE, tone: 0.8 });
    blob(m, [HEAD_TOP[0], HEAD_TOP[1] + 0.022, HEAD_TOP[2] - 0.004], 0.014, 0.022, 0.014, lod === 0 ? 8 : 5, rigid('head'), SLOTS.BRONZE, 1);
    cheekPieces(m, kind, lod, SLOTS.BRONZE);
  },
  crest(m, kind, lod) {
    // Horsehair from the knob: a full fan standing up over the bowl and falling down behind it (the trim's colour).
    const W = rigid('head');
    const n = lod === 0 ? 12 : lod === 1 ? 6 : 3;
    const h = lod === 0 ? 3 : 1;
    for (const face of [1, -1]) {
      m.grid(h, n, (i, j) => {
        const u = j / n;
        const v = i / h;
        // The arc's line from the brow over the top to the nape, the hair standing out from it.
        const a = -0.55 + 2.35 * u;
        const r = 0.125 + 0.1 * v * (1 - 0.35 * u) * Math.sin(Math.PI * Math.min(1, 0.15 + u * 0.95));
        const y = HEAD_C[1] + Math.cos(a) * r * 0.92 + 0.012;
        const z = HEAD_C[2] + Math.sin(a) * r * -0.95;
        const x = face * (0.008 + 0.012 * v) * (1 - 0.5 * u);
        return { p: [x, y, z], c: [-face, y, z], uv: [u, v], w: W, slot: SLOTS.TRIM, tone: 0.72 + 0.2 * v + 0.08 * Math.sin(u * 40 + v * 3) };
      });
    }
  },
  plume(m, kind, lod) {
    // A tall stiff crest of white horsehair across the top, front to back.
    const n = lod === 0 ? 8 : 4;
    const W = rigid('head');
    for (const face of [1, -1]) {
      m.grid(2, n, (i, j) => {
        const u = j / n;
        const z = HEAD_C[2] + 0.07 - 0.16 * u;
        const base = HEAD_TOP[1] + 0.02 - 0.05 * (u - 0.45) ** 2;
        const y = base + i * (0.07 + 0.03 * Math.sin(Math.PI * u));
        return { p: [face * 0.012, y, z], c: [-face, y, z], uv: [u, i], w: W, slot: SLOTS.WHITE, tone: 0.9 + 0.08 * Math.sin(u * 30) };
      });
    }
  },
  conical(m, kind, lod) {
    // A tall cone of iron plates riveted to a browband, a knob at its point; flaps over the cheeks and nape.
    const edge = (phi) => 1.22 + 0.12 * Math.max(0, -Math.cos(phi));
    bowl(m, kind, lod, { edge, off: 0.012, bulge: (th) => 0.06 * Math.max(0, 1 - th / 0.9) ** 1.6, tone: (th, phi) => 0.85 + 0.12 * (lod === 0 ? Math.abs(Math.cos(phi * 2)) : 1) });
    brim(m, kind, lod, { edge, out: () => 0.006, drop: () => 0.02, off: 0.014, slot: SLOTS.BRONZE, tone: 0.9 });
    blob(m, [HEAD_TOP[0], HEAD_TOP[1] + 0.07, HEAD_TOP[2]], 0.009, 0.012, 0.009, 5, rigid('head'), SLOTS.BRONZE);
    cheekPieces(m, kind, lod);
    // The nape's flap.
    brim(m, kind, lod, { edge, a: Math.PI * 0.6, b: Math.PI * 1.4, out: () => 0.018, drop: () => 0.07, off: 0.013, slot: SLOTS.LEATHER, tone: 0.7 });
  },
  celtic(m, kind, lod) {
    const edge = (phi) => 1.12 + 0.1 * Math.max(0, -Math.cos(phi));
    bowl(m, kind, lod, { edge, off: 0.014, slot: SLOTS.IRON, bulge: (th) => 0.008 * Math.sin(th * 2) });
    brim(m, kind, lod, { edge, out: () => 0.022, drop: () => 0.004, off: 0.014, slot: SLOTS.BRONZE, tone: 0.85 });
    blob(m, [HEAD_TOP[0], HEAD_TOP[1] + 0.02, HEAD_TOP[2]], 0.012, 0.018, 0.012, 6, rigid('head'), SLOTS.BRONZE);
    cheekPieces(m, kind, lod, SLOTS.IRON);
  },
  attic(m, kind, lod) {
    // A bronze bowl with a browband peak, the cheek pieces, a neck guard; the crest high on its stilt.
    const edge = (phi) => 1.25 + 0.2 * Math.max(0, -Math.cos(phi)) - 0.12 * Math.max(0, Math.cos(phi)) ** 2;
    bowl(m, kind, lod, { edge, off: 0.014, slot: SLOTS.BRONZE });
    brim(m, kind, lod, { edge, out: (phi) => 0.02 * Math.max(0, Math.cos(phi)) + 0.03 * Math.max(0, -Math.cos(phi)), drop: () => 0.008, off: 0.014, slot: SLOTS.BRONZE, tone: 0.8 });
    cheekPieces(m, kind, lod, SLOTS.BRONZE);
    const W = rigid('head');
    const n = lod === 0 ? 10 : 4;
    for (const face of [1, -1]) {
      m.grid(2, n, (i, j) => {
        const u = j / n;
        const z = HEAD_C[2] + 0.11 - 0.26 * u;
        const y = HEAD_TOP[1] + 0.03 + i * (0.06 + 0.05 * Math.sin(Math.PI * Math.min(1, u * 1.2)));
        return { p: [face * 0.014, y, z - 0.02 * i * u], c: [-face, y, z], uv: [u, i], w: W, slot: SLOTS.TRIM, tone: 0.85 + 0.1 * Math.sin(u * 25) };
      });
    }
  },
  murmillo(m, kind, lod) { gladiatorHelmet(m, kind, lod, 'fin'); },
  thraex(m, kind, lod) { gladiatorHelmet(m, kind, lod, 'griffin'); },
  pelt(m, kind, lod) {
    // A bear's head over the helmet, its skin down the back and over the shoulders, the forepaws knotted on the chest.
    bowl(m, kind, lod, { edge: () => 1.5, off: 0.03, slot: SLOTS.MANTLE, tone: (th, phi) => 0.75 + 0.15 * Math.sin(phi * 9 + th * 11) });
    blob(m, [HEAD_C[0], HEAD_C[1] + 0.07, HEAD_C[2] + 0.11], 0.04, 0.035, 0.05, lod === 0 ? 8 : 5, rigid('head'), SLOTS.MANTLE, 0.7);
    if (lod < 2) for (const s of [1, -1]) blob(m, [s * 0.06, HEAD_C[1] + 0.11, HEAD_C[2] - 0.01], 0.02, 0.02, 0.012, 5, rigid('head'), SLOTS.MANTLE, 0.6);
    shell(m, kind, lod, {
      y0: 1.18, y1: 1.47, rows: lod === 0 ? 5 : 2, phi0: Math.PI * 0.35, phi1: Math.PI * 1.65,
      off: (y, phi) => 0.03 + 0.03 * smooth(1.3, 1.44, y) * Math.abs(Math.sin(phi)),
      slot: () => SLOTS.MANTLE, tone: (y, phi) => 0.72 + 0.12 * Math.sin(phi * 11 + y * 30),
    });
  },
  cap(m, kind, lod) {
    // A soft cap, its peak fallen forward.
    bowl(m, kind, lod, { edge: (phi) => 1.25 + 0.15 * Math.max(0, -Math.cos(phi)), off: 0.016, slot: SLOTS.TRIM, bulge: (th, phi) => 0.05 * Math.max(0, 1 - th / 0.8) * (1 + 0.6 * Math.cos(phi)), tone: (th) => 0.8 + 0.15 * th });
    blob(m, [HEAD_TOP[0], HEAD_TOP[1] + 0.03, HEAD_TOP[2] + 0.06], 0.035, 0.03, 0.04, 6, rigid('head'), SLOTS.TRIM, 0.85);
  },
};

/** A gladiator's helmet: broad brim, a grille over the face, its crest (a fin, or a griffin's head curving forward). */
function gladiatorHelmet(m, kind, lod, crest) {
  const edge = () => 1.62;
  // (The bowl closed round the whole head, the visor its front.)
  bowl(m, kind, lod, { edge, off: 0.018, slot: (th, phi) => (Math.cos(phi) > 0.55 && th > 1.1 && th < 1.6 ? SLOTS.DARK : SLOTS.METAL), tone: (th, phi, i) => (Math.cos(phi) > 0.55 && th > 1.1 && th < 1.6 ? 0.4 : 0.92) });
  // The brim, wide all round.
  const flat = (phi) => 1.08 + 0.06 * Math.max(0, -Math.cos(phi));
  brim(m, kind, lod, { edge: flat, out: () => 0.055, drop: () => 0.01, off: 0.02, slot: SLOTS.METAL, tone: 0.85 });
  if (lod < 2) {
    // The grille: bars across the visor.
    for (let k = 0; k < 4; k++) {
      const th = 1.15 + k * 0.13;
      const pts = [];
      for (let q = 0; q <= 6; q++) pts.push(headPoint(th, -0.9 + (1.8 * q) / 6, kind, 0.024, 0).p);
      tube(m, pts, 0.0035, { w: rigid('head'), slot: SLOTS.METAL, seg: 3 });
    }
  }
  const W = rigid('head');
  const n = lod === 0 ? 10 : 4;
  if (crest === 'fin') {
    for (const face of [1, -1]) {
      m.grid(2, n, (i, j) => {
        const u = j / n;
        const z = HEAD_C[2] + 0.1 - 0.24 * u;
        const y = HEAD_TOP[1] + 0.02 + i * (0.05 + 0.07 * Math.sin(Math.PI * u) * (1 - 0.3 * u));
        return { p: [face * 0.01, y, z], c: [-face, y, z], uv: [u, i], w: W, slot: SLOTS.METAL, tone: 0.9 };
      });
    }
  } else {
    // The griffin's neck rising and curving forward over the brow, its head and beak.
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      pts.push([0, HEAD_TOP[1] + 0.02 + 0.13 * Math.sin(Math.PI * 0.8 * u), HEAD_C[2] - 0.08 + 0.2 * u]);
    }
    tube(m, pts, (i) => 0.022 - 0.008 * (i / n), { w: W, slot: SLOTS.METAL, seg: lod === 0 ? 6 : 4, flat: 0.5 });
    blob(m, [0, HEAD_TOP[1] + 0.1, HEAD_C[2] + 0.14], 0.016, 0.02, 0.03, 5, W, SLOTS.METAL);
  }
}

// ---------------------------------------------------------------------------
// The body's
// ---------------------------------------------------------------------------

/** The shoulders' guards: curved plates over each shoulder, overlapping down the upper arm. */
function shoulderPlates(m, kind, lod, n) {
  for (const s of [1, -1]) {
    const k = s > 0 ? 'L' : 'R';
    for (let q = 0; q < n; q++) {
      const R = GR[lod];
      m.grid(1, R.limbC, (i, j) => {
        const a = -Math.PI * 0.55 + (Math.PI * 1.1 * j) / R.limbC;
        const r = 0.085 + 0.008 * q;
        const y = 1.44 - q * 0.045 - i * 0.05;
        const x = s * (0.14 + q * 0.025);
        const p = [x + s * Math.sin(a + Math.PI / 2) * r * 0.25 * 0, y + Math.cos(a) * 0.01, -0.01 + Math.sin(a) * r];
        p[0] = x + s * (Math.cos(a) * r * 0.7);
        return { p, c: [s * 0.1, y - 0.06, -0.01], uv: [a, i], w: weights([[`clav${k}`, 0.5], [`arm${k}`, 0.3 + 0.1 * q], ['chest', 0.3 - 0.05 * q]]), slot: SLOTS.METAL, tone: 0.95 - 0.2 * i };
      });
    }
  }
}

const BODY = {
  segmentata(m, kind, lod) {
    // Girth hoops from the waist to the chest, each overlapping the one under it; a dark seam between them.
    shell(m, kind, lod, {
      y0: 0.94, y1: 1.42, rows: lod === 0 ? 24 : lod === 1 ? 8 : 3,
      off: (y) => 0.034 + 0.006 * fract((y - 0.94) / 0.06),
      slot: () => SLOTS.METAL,
      tone: (y) => (lod === 2 ? 0.85 : 0.55 + 0.45 * smooth(0, 0.25, fract((y - 0.94) / 0.06))),
    });
    shoulderPlates(m, kind, lod, lod === 0 ? 4 : lod === 1 ? 2 : 1);
  },
  squamata(m, kind, lod) {
    shell(m, kind, lod, {
      y0: 0.76, y1: 1.44, off: (y) => 0.022 + (y > 1.43 ? 0.01 : 0),
      slot: () => SLOTS.METAL,
      // Rows of scales, each row's scales offset half a scale from the last's: shaded at their lower edges.
      tone: (y, phi) => (lod === 2 ? 0.8 : 0.6 + 0.35 * (1 - fract((y - 0.76) / 0.035 + 0.5 * Math.abs(Math.sin(phi * 9 + Math.floor((y - 0.76) / 0.035) * 1.57))) ** 1.5)),
    });
    for (const s of [1, -1]) {
      const k = s > 0 ? 'L' : 'R';
      limbTube(m, [BONE[`arm${k}`], BONE[`fore${k}`], BONE[`hand${k}`]], { r: (u) => armRadius(u, kind) + 0.022, u0: -0.2, u1: 0.4, rows: GR[lod].limb >> 1 || 1, cols: GR[lod].limbC, side: s, slot: SLOTS.METAL, tone: (u) => 0.7 + 0.2 * fract(u * 6) });
    }
  },
  linothorax(m, kind, lod) {
    shell(m, kind, lod, {
      y0: 0.9, y1: 1.44, off: (y) => 0.024 + (y > 1.42 ? 0.01 : 0),
      slot: (y) => (y < 0.97 ? SLOTS.TRIM : SLOTS.WHITE), tone: (y, phi) => 0.9 + 0.06 * Math.cos(phi),
    });
    // The shoulder flaps tied down on the chest.
    for (const s of [1, -1]) {
      m.grid(lod === 0 ? 4 : 1, 2, (i, j) => {
        const v = i / (lod === 0 ? 4 : 1);
        const x = s * (0.07 + 0.06 * j);
        const y = 1.47 - 0.17 * v;
        const z = trunkPoint(y, s * 0.4 * j + (1 - j) * s * 0.2, kind, 0.04)[2] + 0.004;
        return { p: [x, y, v < 0.3 ? z - 0.08 * (0.3 - v) : z], c: [x, y, -0.2], uv: [j, v], w: trunkWeights(x, y, z), slot: SLOTS.WHITE, tone: 0.85 };
      });
    }
    // The pteruges: strips round the hips.
    if (lod < 2) {
      const n = lod === 0 ? 16 : 8;
      for (let q = 0; q < n; q++) {
        const phi = -Math.PI + (TAU * (q + 0.5)) / n;
        m.grid(2, 1, (i, j) => {
          const y = 0.94 - 0.2 * (i / 2);
          const a = phi + (j - 0.5) * (TAU / n) * 0.8;
          const p = trunkPoint(Math.max(0.8, y), a, kind, 0.03 + 0.02 * (i / 2));
          p[1] = y;
          return { p, c: [0, y, 0], uv: [a, y], w: weights([['root', 0.6], [Math.sin(phi) > 0 ? 'thighL' : 'thighR', 0.4 * (i / 2)]]), slot: q % 2 ? SLOTS.TRIM : SLOTS.WHITE, tone: 0.85 };
        });
      }
    }
  },
  bracae(m, kind, lod) {
    // The seat over the hips, the legs to the ankles; checked by a pattern of tones.
    const check = (a, b) => (lod === 2 ? 0.85 : 0.72 + 0.28 * ((Math.floor(a * 9) + Math.floor(b * 9)) % 2));
    shell(m, kind, lod, { y0: 0.78, y1: 1.02, rows: lod === 0 ? 4 : 2, off: () => 0.012, slot: () => SLOTS.TRIM, tone: (y, phi) => check(phi, y * 3) });
    for (const s of [1, -1]) {
      const k = s > 0 ? 'L' : 'R';
      limbTube(m, [BONE[`thigh${k}`], BONE[`shin${k}`], BONE[`foot${k}`]], {
        r: (u) => legRadius(u, kind) + 0.014 + 0.006 * smooth(1.2, 1.9, u), u0: -0.12, u1: 1.92, rows: GR[lod].limb + 2, cols: GR[lod].limbC, side: s, slot: SLOTS.TRIM,
        extra: (u) => (u < 0.15 ? { k: smooth(0.15, -0.1, u) * 0.5, list: [['root', 1]] } : null),
        tone: (u, phi) => check(phi / 2, u),
      });
    }
  },
  sagum(m, kind, lod) {
    // A cloak hung from the shoulders down the back to the knees, gathered at the right shoulder.
    const R = GR[lod];
    const rows = R.rows;
    const cols = Math.max(4, R.cols >> 1);
    m.grid(rows, cols, (i, j) => {
      const v = i / rows;
      const u = j / cols;
      const phi = Math.PI * (0.45 + 1.1 * u);
      const y = 1.46 - 0.95 * v;
      const fold = lod === 2 ? 0 : 0.012 * Math.sin(u * 22 + v * 3) * smooth(0, 0.4, v);
      let p;
      if (y >= 0.8) p = trunkPoint(y, phi, kind, 0.04 + 0.04 * smooth(1.1, 0.8, y) + fold + 0.03 * smooth(1.35, 1.46, y) * Math.abs(Math.sin(phi)));
      else {
        const s = trunkSection(0.8, kind);
        const o = 0.08 + 0.06 * smooth(0.8, 0.5, y) + fold;
        p = [(s.a + o) * Math.sin(phi), y, s.zc + (s.bb + o) * Math.cos(phi)];
      }
      return { p, c: [0, y, 0.1], uv: [u, y], w: trunkWeights(p[0], Math.max(p[1], 1.0), p[2], { legs: 0.2 }), slot: SLOTS.MANTLE, tone: 0.82 + 5 * fold };
    });
    // The brooch at the right shoulder.
    if (lod < 2) blob(m, trunkPoint(1.42, -1.2, kind, 0.05), 0.018, 0.018, 0.01, 6, weights([['chest', 1]]), SLOTS.BRONZE);
  },
  hide(m, kind, lod) {
    // An animal's skin over the left shoulder and down the back, its legs hanging.
    shell(m, kind, lod, {
      y0: 1.0, y1: 1.46, rows: lod === 0 ? 6 : 2, phi0: -0.2, phi1: Math.PI * 1.25,
      off: (y, phi) => 0.03 + 0.02 * smooth(1.3, 1.45, y) * Math.max(0, Math.sin(phi)) + 0.006 * Math.sin(phi * 7 + y * 20),
      slot: () => SLOTS.MANTLE, tone: (y, phi) => 0.65 + 0.3 * Math.abs(Math.sin(phi * 4 + y * 13) * Math.sin(phi * 7 - y * 9)),
    });
  },
  loin(m, kind, lod) {
    shell(m, kind, lod, { y0: 0.76, y1: 1.0, rows: lod === 0 ? 4 : 2, off: (y, phi) => 0.01 + 0.02 * smooth(0.9, 0.76, y) * Math.max(0, Math.cos(phi)), slot: () => SLOTS.WHITE, tone: (y, phi) => 0.85 + 0.08 * Math.sin(phi * 8) });
    shell(m, kind, lod, { y0: 0.96, y1: 1.08, rows: 1, off: () => 0.022, slot: () => SLOTS.LEATHER, tone: (y, phi) => (lod === 0 && Math.sin(phi * 14) > 0.8 ? 1.4 : 0.8) });
  },
  belt(m, kind, lod) {
    shell(m, kind, lod, { y0: 0.98, y1: 1.02, rows: 1, off: () => 0.03, slot: () => SLOTS.LEATHER, tone: () => 0.75 });
  },
  torc(m, kind, lod) {
    const n = lod === 0 ? 16 : 8;
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const phi = -Math.PI * 0.85 + (Math.PI * 1.7 * k) / n;
      pts.push(trunkPoint(1.44, phi, kind, 0.02));
    }
    tube(m, pts, 0.008, { w: weights([['chest', 0.5], ['neck', 0.5]]), slot: SLOTS.GOLD, seg: 5 });
    for (const end of [pts[0], pts[n]]) blob(m, end, 0.013, 0.013, 0.013, 5, weights([['chest', 0.5], ['neck', 0.5]]), SLOTS.GOLD);
  },
  greaves(m, kind, lod, opts) {
    const sides = opts.has('left') ? [1] : [1, -1];
    for (const s of sides) {
      const k = s > 0 ? 'L' : 'R';
      limbTube(m, [BONE[`thigh${k}`], BONE[`shin${k}`], BONE[`foot${k}`]], {
        r: (u) => legRadius(u, kind) + 0.014, u0: opts.has('high') ? 0.85 : 1.08, u1: 1.88, rows: GR[lod].limb, cols: GR[lod].limbC, side: s, slot: SLOTS.BRONZE,
        tone: (u, phi) => 0.75 + 0.25 * Math.max(0, Math.cos(phi)),
      });
    }
  },
  wraps(m, kind, lod) {
    for (const s of [1, -1]) {
      const k = s > 0 ? 'L' : 'R';
      limbTube(m, [BONE[`thigh${k}`], BONE[`shin${k}`], BONE[`foot${k}`]], {
        r: (u) => legRadius(u, kind) + 0.012, u0: 0.05, u1: 0.95, rows: GR[lod].limb, cols: GR[lod].limbC, side: s, slot: SLOTS.WHITE,
        tone: (u) => 0.7 + 0.25 * fract(u * 7),
      });
    }
  },
  manica(m, kind, lod) {
    limbTube(m, [BONE.armR, BONE.foreR, BONE.handR], {
      r: (u) => armRadius(u, kind) + 0.014, u0: -0.1, u1: 1.95, rows: GR[lod].limb + 2, cols: GR[lod].limbC, side: -1, slot: SLOTS.METAL,
      tone: (u) => (lod === 2 ? 0.85 : 0.55 + 0.4 * smooth(0, 0.3, fract(u * 6))),
    });
  },
  galerus(m, kind, lod) {
    // A raised plate on the left shoulder, standing up beside the head.
    const n = lod === 0 ? 5 : 2;
    m.grid(n, n, (i, j) => {
      const v = i / n;
      const u = j / n;
      const p = [0.16 + 0.04 * u, 1.38 + 0.26 * v, -0.08 + 0.18 * u];
      return { p, c: [-1, p[1], p[2]], uv: [u, v], w: weights([['clavL', 0.6], ['chest', 0.4]]), slot: SLOTS.METAL, tone: 0.9 };
    });
  },
  quiver(m, kind, lod) {
    // Slung on his back, its mouth over the right shoulder; the fletchings standing out of it.
    const base = [0.06, 1.0, -0.17];
    const top = [-0.1, 1.52, -0.16];
    const W = weights([['chest', 0.8], ['spine', 0.2]]);
    tube(m, [base, [(base[0] + top[0]) / 2, (base[1] + top[1]) / 2, (base[2] + top[2]) / 2 - 0.01], top], 0.045, { w: W, slot: SLOTS.LEATHER, seg: lod === 0 ? 8 : 5, tone: (i) => 0.75 + 0.1 * i });
    if (lod < 2) for (let k = 0; k < 5; k++) blob(m, [top[0] + (k - 2) * 0.012, top[1] + 0.07, top[2] + ((k % 2) - 0.5) * 0.02], 0.008, 0.05, 0.008, 4, W, SLOTS.WHITE, 0.9);
  },
  scabbard(m, kind, lod, opts) {
    const long = opts.has('long');
    const s = long ? 1 : -1;
    const top = [s * 0.19, 1.0, 0.03];
    const bot = [s * 0.21, long ? 0.3 : 0.55, long ? -0.12 : -0.05];
    const W = weights([['root', 0.8], ['spine', 0.2]]);
    tube(m, [top, [(top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2, (top[2] + bot[2]) / 2], bot], 0.038, { w: W, slot: (i) => (i === 0 ? SLOTS.BRONZE : SLOTS.LEATHER), seg: lod === 0 ? 6 : 4, flat: 0.45 });
    blob(m, [top[0], top[1] + 0.05, top[2]], 0.018, 0.04, 0.018, 5, W, SLOTS.BRONZE);
  },
};

// ---------------------------------------------------------------------------
// Hair
// ---------------------------------------------------------------------------

const HAIR = {
  longhair(m, kind, lod) {
    // Over the head from the brow, then falling down the back of the neck to the shoulders.
    const R = GR[lod];
    const cols = R.headC;
    const rows = R.head + 2;
    m.grid(rows, cols, (i, j) => {
      const phi = -Math.PI + (TAU * j) / cols;
      const front = Math.cos(phi);
      // The hairline: the brow in front, over the ears, low behind.
      const edge = 1.0 + 0.55 * (1 - front) * 0.5 + 0.5 * smooth(0.3, -0.7, front);
      const v = i / rows;
      const th = Math.max(0.01, edge * Math.min(1, v * 1.15));
      const lock = lod === 0 ? 0.004 * Math.sin(phi * 13 + th * 5) : 0;
      let { p } = headPoint(th, phi, kind, 0.012 + lock, 0);
      // Past the head, behind and at the sides, it falls on down.
      const fall = smooth(0.8, 1, v) * smooth(0.4, -0.3, front);
      if (fall > 0) p = [p[0] * (1 + 0.2 * fall), p[1] - 0.18 * fall, p[2] - 0.03 * fall];
      const w = fall > 0.3 ? weights([['head', 0.4], ['neck', 0.4], ['chest', 0.2]]) : headWeights(Math.max(p[1], 1.52));
      return { p, c: [HEAD_C[0], p[1], HEAD_C[2] - 0.02], uv: [phi * 0.03, th * 0.03], w, slot: SLOTS.HAIR, tone: 0.8 + 0.2 * (1 - v) + (lod === 0 ? 0.08 * Math.sin(phi * 21) : 0) };
    });
  },
  moustache(m, kind, lod) {
    for (const s of [1, -1]) {
      const pts = [];
      // Over the upper lip from the middle out to the mouth's corner, then drooping past it to the jaw.
      for (let k = 0; k <= 4; k++) {
        const u = k / 4;
        const { p } = headPoint(2.12 + 0.3 * u * u, s * (0.06 + 0.32 * u), kind, 0.004, 1);
        pts.push(p);
      }
      tube(m, pts, (i) => 0.0055 - 0.001 * i, { w: rigid('head'), slot: SLOTS.HAIR, seg: lod === 0 ? 5 : 3, tone: () => 0.8, flat: 0.6 });
    }
  },
  knot(m, kind, lod) {
    // Combed back and over to the right, knotted over the temple.
    HAIR.longhair(m, kind, Math.min(2, lod + 1));
    blob(m, headPoint(0.9, -1.2, kind, 0.04, 0).p, 0.03, 0.028, 0.034, lod === 0 ? 8 : 5, rigid('head'), SLOTS.HAIR, 0.85);
  },
};

const ALL = { ...HELMETS, ...BODY, ...HAIR };
export const UNIT_GEAR_NAMES = Object.freeze(Object.keys(ALL));

/** A piece of gear by its name, for body `kind`, at `lod`, with options (`long` a scabbard, `left` one greave, `high`). */
export function unitGear(name, kind, lod, opts = new Set()) {
  const make = ALL[name];
  if (!make) throw new Error(`No unit gear ${name}`);
  const m = new Mesher();
  make(m, kind, Math.max(0, Math.min(2, lod | 0)), opts);
  return m;
}
