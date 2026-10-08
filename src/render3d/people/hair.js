/**
 * people/hair.js
 * ----------------------------------------------------------------------------
 * Heads of hair and beards for the 3D look's people, after Roman portraits:
 *
 *   crop    the short crop of the Augustan citizen, combed forward, its
 *           locks laid like commas over the forehead
 *   curls   a full head of short curls (a Greek, a boy, a freedman)
 *   bun     a woman's: parted in the middle, drawn back over the ears to a
 *           knot at the nape (the simple style of the Ara Pacis's women)
 *   bald    an old man's: the crown bare, a fringe round the back and sides
 *   beard   full (a philosopher's, an old priest's) or short
 *
 * Each is a shell over the head's own surface (body.js headPoint, the face
 * not carved) pushed out by its thickness, lumpy where locks or curls are,
 * thinning to nothing at its edge so it meets the scalp, all on the head's
 * bone. A child's is the man's or the woman's (the shader scales the head).
 * ----------------------------------------------------------------------------
 */

import { Mesher, SLOTS, rigid, smooth, weights } from './mesher.js';
import { headPoint, headWeights, HEAD_C, TAU, gauss } from './body.js';

const RES = [{ rows: 16, cols: 32 }, { rows: 6, cols: 12 }, { rows: 3, cols: 6 }];

/** The hairline: how far down from the crown (theta) the hair comes at angle phi round the head. */
function hairline(style, phi, lod) {
  const front = Math.cos(phi);
  const side = Math.abs(Math.sin(phi));
  // The forehead's line, round the temples, down over the ears' tops, low at the nape.
  let th = 1.02 + 0.5 * (1 - front) * 0.5 + 0.38 * smooth(0.3, -0.6, front);
  // Over the ears a bay (they show), behind them down to the nape.
  th -= 0.18 * gauss((Math.abs(phi) - 1.55) / 0.25);
  if (style === 'crop' && lod === 0) th += 0.06 * Math.max(0, front) ** 2 * Math.abs(Math.sin(phi * 9)) ** 0.7;
  if (style === 'bun') th += 0.12 * side + 0.08 * Math.max(0, -front);
  return th;
}

/** A head of hair (`style`: crop, curls, bun, bald) on body `kind`. */
export function hair(style, kind, lod) {
  const R = RES[lod];
  const m = new Mesher();
  const rows = R.rows;
  const cols = R.cols;
  const thick = { crop: 0.007, curls: 0.013, bun: 0.009, bald: 0.006 }[style];
  m.grid(rows, cols, (i, j) => {
    const phi = -Math.PI + (TAU * j) / cols;
    const edge = hairline(style, phi, lod);
    const th0 = style === 'bald' ? Math.min(edge - 0.05, 1.25 + 0.25 * Math.max(0, Math.cos(phi))) : 0.0;
    const v = i / rows;
    const th = th0 + (edge - th0) * v;
    // Thinner to the edge, so it meets the scalp.
    let off = thick * (1 - smooth(0.75, 1, v) * 0.85);
    if (lod < 2) {
      if (style === 'curls') off += 0.006 * Math.abs(Math.sin(phi * 9 + th * 11) * Math.sin(th * 13 - phi * 5));
      if (style === 'crop') off += 0.0025 * Math.sin(phi * 14 + th * 6) * (1 - v * 0.5);
      // The middle parting: the hair falls away either side of it.
      if (style === 'bun') off -= 0.006 * gauss(phi / 0.05) * smooth(1.2, 0.3, th);
    }
    if (style === 'bald' && i === 0) off *= 0.3;
    const { p } = headPoint(Math.max(0.001, th), phi, kind, off + 0.001, 0);
    // Darker at the roots by the edge and in the lumps' hollows.
    const tone = 0.8 + 0.2 * (1 - v) + (style === 'curls' ? 0.2 * (off / thick - 1) : 0);
    return { p, c: HEAD_C, uv: [phi * 0.03, th * 0.03], w: headWeights(p[1]), slot: SLOTS.HAIR, tone };
  });
  if (style === 'bun') {
    // The knot at the nape.
    const c = [HEAD_C[0], HEAD_C[1] - 0.03, HEAD_C[2] - 0.098];
    const n = lod === 0 ? 10 : lod === 1 ? 5 : 3;
    m.grid(n, n + 2, (i, j) => {
      const th = (Math.PI * i) / n;
      const phi = (TAU * j) / (n + 2);
      const r = 0.034 * (1 + (lod === 0 ? 0.12 * Math.sin(phi * 3 + th * 4) : 0));
      const p = [c[0] + Math.sin(th) * Math.sin(phi) * r * 1.25, c[1] + Math.cos(th) * r * 0.95, c[2] + Math.sin(th) * Math.cos(phi) * r * 0.8];
      return { p, c, uv: [phi * 0.03, th * 0.03], w: rigid('head'), slot: SLOTS.HAIR, tone: 0.8 + 0.15 * Math.cos(th) };
    });
  }
  return m;
}

/** A beard (`full` or `short`) over the jaw, the chin and the cheeks, and the moustache. */
export function beard(style, kind, lod) {
  const R = RES[lod];
  const m = new Mesher();
  const rows = Math.max(2, Math.round(R.rows * 0.6));
  const cols = Math.max(4, Math.round(R.cols * 0.6));
  const full = style === 'full';
  m.grid(rows, cols, (i, j) => {
    // Round the face from ear to ear, from the cheeks down under the chin.
    const phi = -1.75 + (3.5 * j) / cols;
    const v = i / rows;
    // Its top edge: from the sideburns by the ears down the cheeks to under the lower lip.
    const th0 = 2.3 - 0.68 * smooth(0.25, 1.35, Math.abs(phi));
    const th = th0 + (Math.PI - 0.3 - th0) * v;
    const side = Math.abs(phi);
    // (Not over the lips: the beard parts round the mouth.)
    let off = (full ? 0.014 : 0.006) * (1 - smooth(1.3, 1.75, side) * 0.8) * smooth(0, 0.15, v);
    if (lod < 2) off += (full ? 0.005 : 0.002) * Math.abs(Math.sin(phi * 9 + v * 13));
    // The chin's beard falls lower and fuller.
    const { p } = headPoint(th, phi, kind, off, 1);
    if (full) p[1] -= 0.018 * gauss(phi / 0.6) * smooth(0.4, 1, v);
    const mouth = Math.hypot(p[0] / 0.024, (p[1] - (HEAD_C[1] - 0.058)) / 0.011) < 1;
    return { p: mouth ? headPoint(th, phi, kind, 0.0005, 1).p : p, c: HEAD_C, uv: [phi * 0.03, th * 0.03], w: headWeights(p[1]), slot: SLOTS.HAIR, tone: 0.75 + 0.25 * Math.cos(phi) };
  });
  if (lod < 2) {
    // The moustache over the upper lip.
    m.grid(2, 8, (i, j) => {
      const x = -0.026 + (0.052 * j) / 8;
      const y = HEAD_C[1] - 0.049 + 0.005 * i - 0.006 * Math.abs(x) / 0.026;
      const { p } = headPoint(Math.acos(Math.max(-1, Math.min(1, (y - HEAD_C[1]) / 0.112))), Math.atan2(x, 0.09), kind, 0.0035 + 0.002 * (1 - i), 1);
      return { p, c: HEAD_C, uv: [0, 0], w: rigid('head'), slot: SLOTS.HAIR, tone: 0.8 };
    });
  }
  return m;
}
