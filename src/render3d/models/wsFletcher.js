/**
 * models/wsFletcher.js
 * ----------------------------------------------------------------------------
 * The Fletcher (Officina Sagittaria) of the 3D look, on the workshop kit
 * (workshopKit.js), from what is known of the Roman arrow-makers (sagittarii)
 * and the bowmen of the Republic's auxiliaries (Cretan, Syrian and Numidian
 * archers hired by Rome), not from the sprite:
 *
 *   - the shafts: straight rods of ash, cornel and reed, trimmed and dried
 *     in bundles tied at the waist and stood against a wall so they season
 *     straight; the iron heads (cuspides, three-sided and leaf-shaped) made
 *     by a smith and brought in by the hundred;
 *   - the bench: a low bench at which the fletcher sits, binding the heads
 *     into the shafts' split ends with sinew and thread, gluing the feathers
 *     (three half-vanes cut from a goose's wing) along the foot of the
 *     shaft, and cutting the nock; a pot of glue stands on a brazier, a
 *     drawknife and a small saw lie by;
 *   - the work: the arrows in sheaves bound at the waist and head, standing
 *     in a rack, and the bows hung from pegs by their tips (the composite
 *     bow of the Eastern archers, short and doubly curved; the bowmen of
 *     the Republic's allies carried it);
 *   - a target butt in the yard: a coil of straw bound with withies on a
 *     frame, on which a bow is tried (the Roman army trained its archers at
 *     a post and butt; Vegetius, I.15).
 *
 * Layout: the bench at the back left under the shed, the shaft bundles on
 * the back wall and the feather bundles on pegs, the hung bows and the
 * sheaves of arrows at the right of the shed, the iron heads in a box in
 * the yard, the timber stacked on the left of the yard, the target butt at
 * the left edge of the yard and a tester shooting at it.
 *
 * States: 'open' staffed (lantern lit, boards up, the fletcher seated at his
 * bench binding, an archer trying a bow at the butt), 'shut' not (boards
 * across the front).
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, TorusGeometry } from 'three';
import { boxUV, tintGeometry, tube } from '../shapes.js';
import { artRng } from '../texgen.js';
import { WsYard, WS, F, WASH, DADO, shed, ground, stool, pegBoard, tub, seg, lin, colour, bx, cyl, trestle } from './workshopKit.js';

/** The fletcher's measures (metres): the actors read them. */
export const FLETCHER = Object.freeze({
  bench: Object.freeze({ x: -1.5, z: -2.15, w: 1.5, d: 0.6, top: 0.62 }),
  /** The target butt (its middle on the ground, facing +x) and where the archer stands. */
  butt: Object.freeze({ x: -3.2, z: 1.75 }),
  archer: Object.freeze({ x: 0.1, z: 1.75 }),
  /** The iron heads' box in the yard, and the timber's place, left of it. */
  box: Object.freeze({ x: 2.7, z: 0.9 }),
  lamp: WS.lamp,
});

const FL = FLETCHER;
const ASH = lin(0xd8c08a);
const FEATHER = [lin(0xf2eee6), lin(0xd8d2c4), lin(0x9a8a72)];

/** The low bench with its stool, the glue pot on a brazier, the drawknife, shafts and feathers on it. */
function bench(y, lod) {
  const b = FL.bench;
  y.add('wood', trestle(b.x, b.z, b.w, b.d, b.top, { lod }));
  y.add('wood', stool(b.x + 0.1, b.z - 0.62, { top: 0.45, s: 0.32 }));
  // A little brazier of iron at the bench's end with the glue pot on it.
  const bx0 = b.x - b.w / 2 - 0.4;
  y.add('iron', [bx(0.3, 0.04, 0.3, bx0, F + 0.3, b.z, 0.8), bx(0.3, 0.04, 0.3, bx0, F, b.z, 0.8), ...(lod < 2 ? [bx(0.03, 0.3, 0.03, bx0 - 0.13, F, b.z - 0.13, 0.8), bx(0.03, 0.3, 0.03, bx0 + 0.13, F, b.z + 0.13, 0.8)] : [])]);
  y.add('ember', bx(0.2, 0.03, 0.2, bx0, F + 0.31, b.z, 1), 'open', false);
  y.add('clay', cyl([bx0, F + 0.34, b.z], [bx0, F + 0.46, b.z], 0.1, 0.075, seg(lod, 10, 8, 5)));
  // On the bench: shafts laid together, feathers in a heap, the drawknife and the saw.
  const tz = F + b.top;
  for (let k = 0; k < 6; k++) y.add('wood', cyl([b.x - 0.6, tz + 0.012, b.z - 0.18 + k * 0.045], [b.x + 0.35, tz + 0.012, b.z - 0.18 + k * 0.045], 0.011, 0.011, 4), 'always', false);
  if (lod < 2) {
    y.add('iron', bx(0.22, 0.02, 0.025, b.x + 0.55, tz, b.z + 0.1, 1));
    y.add('wood', [bx(0.04, 0.03, 0.025, b.x + 0.4, tz, b.z + 0.1, 0.75), bx(0.04, 0.03, 0.025, b.x + 0.7, tz, b.z + 0.1, 0.75)]);
    y.add('iron', bx(0.34, 0.07, 0.01, b.x + 0.1, tz, b.z + 0.22, 1.0));
    y.add('cloth', colour(bx(0.16, 0.025, 0.1, b.x - 0.7, tz, b.z + 0.15, 1), FEATHER[0]));
  }
}

/** Bundles of seasoning shafts standing on the back wall (the stock's timber is the same, bigger), a peg board of feathers over. */
function wall(y, lod) {
  const zw = WS.zBack + WS.t + 0.02;
  y.add('wood', pegBoard(-0.4, 1.6, zw, 1.6, lod));
  // Hanks of feathers hung from the pegs by their quills.
  if (lod < 2) {
    const rnd = artRng(21);
    for (let k = 0; k < 5; k++) {
      const x = -0.3 + k * 0.4;
      for (let f = 0; f < 5; f++) {
        const c = FEATHER[(k + f) % 3];
        y.add('cloth', colour(bx(0.022, 0.2 + rnd() * 0.05, 0.01, x + (f - 2) * 0.02, 1.34, zw + 0.1 + f * 0.004, 1), c));
      }
    }
  }
}

/** A bundle of rods standing on y0, leaning on the wall: n rods of height h round (x, z), tied at the waist. */
function bundle(x, z, n, h, r, lod, tone = 1, y0 = F) {
  const rods = [];
  const rope = [];
  const rnd = artRng(Math.round(x * 17 + z * 31));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283;
    const rr = i === 0 ? 0 : 0.045;
    const g = cyl([x + Math.cos(a) * rr * 1.2, y0, z + Math.sin(a) * rr * 1.2], [x + Math.cos(a) * rr * 0.6, y0 + h * (0.97 + rnd() * 0.04), z + Math.sin(a) * rr * 0.6], r, r * 0.9, 4);
    rods.push(tintGeometry(boxUV(g), () => tone * (0.92 + rnd() * 0.16)));
  }
  if (lod < 2) {
    for (const hh of [0.32, 0.75]) {
      const t = new TorusGeometry(0.058, 0.007, 3, 8);
      t.rotateX(Math.PI / 2);
      t.translate(x, y0 + h * hh, z);
      rope.push(tintGeometry(boxUV(t), () => 0.9));
    }
  }
  return { rods, rope };
}

/** The target butt: a coil of straw on a frame of two posts, with a painted centre and some arrows in it. */
function butt(y, lod) {
  const b = FL.butt;
  const n = seg(lod, 22, 12, 8);
  for (const s of [-1, 1]) y.add('wood', bx(0.09, 1.5, 0.09, b.x, F, b.z + s * 0.5, 0.75));
  y.add('wood', bx(0.08, 0.08, 1.2, b.x, F + 1.45, b.z, 0.75));
  y.add('wood', cyl([b.x + 0.1, F, b.z - 0.5], [b.x, F + 0.7, b.z - 0.15], 0.04, 0.04, 4));
  y.add('wood', cyl([b.x + 0.1, F, b.z + 0.5], [b.x, F + 0.7, b.z + 0.15], 0.04, 0.04, 4));
  const disc = new CylinderGeometry(0.52, 0.52, 0.2, n, 1);
  disc.rotateZ(Math.PI / 2);
  disc.translate(b.x + 0.12, F + 1.0, b.z);
  y.add('thatch', tintGeometry(boxUV(disc), () => 0.95));
  if (lod < 2) {
    const ring = new CylinderGeometry(0.2, 0.2, 0.02, n, 1);
    ring.rotateZ(Math.PI / 2);
    ring.translate(b.x + 0.231, F + 1.0, b.z);
    y.add('cloth', tintGeometry(boxUV(ring), () => lin(0xa63a2a)));
    // A few arrows in the straw.
    for (const [dy, dz] of [[0.05, 0.04], [-0.12, 0.18], [0.2, -0.22]]) y.add('wood', cyl([b.x + 0.22, F + 1.0 + dy, b.z + dz], [b.x + 0.62, F + 1.05 + dy, b.z + dz + 0.03], 0.008, 0.008, 4));
  }
}

/** The box of iron heads in the yard (the stock's iron stands in it). */
function headsBox(y, lod) {
  const b = FL.box;
  y.add('wood', [bx(0.9, 0.34, 0.05, b.x, F, b.z - 0.3, 0.8), bx(0.9, 0.34, 0.05, b.x, F, b.z + 0.3, 0.8), bx(0.05, 0.34, 0.6, b.x - 0.45, F, b.z, 0.8), bx(0.05, 0.34, 0.6, b.x + 0.45, F, b.z, 0.8), bx(0.85, 0.03, 0.6, b.x, F, b.z, 0.7)]);
}

/** The yard's other things: straw bales for the butts stacked by the fence, a water butt, a rack of practice bows. */
function dressing(y, lod) {
  const bales = [[-1.7, 3.3, 0], [-1.0, 3.3, 0], [-1.35, 3.3, 0.36]];
  for (const [x, z, h] of bales) y.add('thatch', tintGeometry(boxUV(new BoxGeometry(0.62, 0.34, 0.42).translate(x, F + 0.17 + h, z)), () => 0.95));
  const t = tub(3.1, 3.1, 0.3, 0.55, lod, { liquid: [0.35, 0.42, 0.38], level: 0.1 });
  y.add('wood', t.wood);
  y.add('iron', t.iron);
  y.add('produce', t.liquid);
}

/** Build the Fletcher: { group, meshes, triangles }. */
export function buildFletcher({ lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const y = new WsYard('fletcher_ws', lod);
  ground(y);
  shed(y, lod, { wash: WASH.ochre, dado: DADO.red, window: 2.4, seed: 351 });
  bench(y, lod);
  wall(y, lod);
  butt(y, lod);
  headsBox(y, lod);
  dressing(y, lod);
  return y.build();
}

/** One arrow lying along +y from (x, y0, z): shaft, iron head and three feathers. */
function arrow(x, y0, z, len, lod, k) {
  const wood = [cyl([x, y0, z], [x, y0 + len, z], 0.007, 0.007, 3)];
  const iron = [cyl([x, y0 + len, z], [x, y0 + len + 0.06, z], 0.012, 0.001, 4)];
  const cloth = lod === 0 ? [colour(bx(0.02, 0.1, 0.004, x, y0 + 0.02, z, 1), FEATHER[k % 3]), colour(bx(0.004, 0.1, 0.02, x, y0 + 0.02, z, 1), FEATHER[(k + 1) % 3])] : [];
  return { wood, iron, cloth };
}

/** A sheaf of n arrows, bound at the waist, standing at (x, z). */
function sheaf(x, z, n, lod, y0 = F, k = 0) {
  const out = { wood: [], iron: [], cloth: [], rope: [] };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283;
    const r = i === 0 ? 0 : 0.045;
    const g = arrow(x + Math.cos(a) * r, y0, z + Math.sin(a) * r, 0.78, lod, k + i);
    out.wood.push(...g.wood);
    out.iron.push(...g.iron);
    out.cloth.push(...g.cloth);
  }
  if (lod < 2) {
    const t = new TorusGeometry(0.05, 0.007, 3, 8);
    t.rotateX(Math.PI / 2);
    t.translate(x, y0 + 0.4, z);
    out.rope.push(tintGeometry(boxUV(t), () => 0.9));
  }
  return out;
}

/** A composite bow hung by its tip on a peg at (x, y, z): the doubly curved stave and its string. */
function bow(x, yTop, z, lod) {
  const pts = [];
  const n = lod === 0 ? 7 : 4;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // The recurved profile: tips bent forward, the grip bowed back.
    pts.push([x + 0.045 * Math.sin(t * Math.PI * 2) - 0.0, yTop - t * 0.62, z + 0.05 * Math.sin(Math.PI * t) - 0.02 * Math.sin(Math.PI * 2 * t)]);
  }
  const stave = tube(pts, 0.014, { radial: lod === 0 ? 5 : 3, around: 0.06 });
  const string = cyl([x, yTop, z + 0.0], [x, yTop - 0.62, z + 0.0], 0.003, 0.003, 3);
  return { stave, string };
}

/**
 * The stock. `in` is the timber (bundles of seasoned shafts leaning on the
 * wall at the left, a stack of billets in the yard); `in2` the iron (bars
 * and heads in the box); `out` the work (sheaves of arrows and hung bows).
 */
export function buildFletcherStock(kind, step, { lod = 0 } = {}) {
  const y = new WsYard(`fletcher_ws_${kind}`, lod);
  const zw = WS.zBack + WS.t + 0.02;
  if (kind === 'in') {
    const spots = [[-3.1, zw + 0.12], [-2.7, zw + 0.12], [-2.3, zw + 0.12], [-3.0, zw + 0.45], [-2.55, zw + 0.45]];
    const n = [0, 2, 4, 5][step];
    const rods = [];
    const rope = [];
    for (let k = 0; k < n; k++) {
      const b = bundle(spots[k][0], spots[k][1], 7, 1.75, 0.014, lod, 1);
      rods.push(...b.rods);
      rope.push(...b.rope);
    }
    y.add('wood', rods);
    y.add('rope', rope);
    // The billets in the yard: split lengths of ash piled on sleepers.
    if (step >= 2) {
      const layers = step === 2 ? 1 : 3;
      for (let l = 0; l < layers; l++) for (let i = 0; i < 4 - l; i++) y.add('wood', bx(0.08, 0.08, 1.3, -2.9 + (i - (3 - l) / 2) * 0.1 + 0.15, F + 0.06 + l * 0.085, 3.0, 1.0 + 0.05 * i));
      y.add('wood', [bx(0.1, 0.06, 0.12, -2.9, F, 2.55, 0.7), bx(0.1, 0.06, 0.12, -2.9, F, 3.45, 0.7)]);
    }
  } else if (kind === 'in2') {
    const b = FL.box;
    const bars = [0, 4, 8, 14][step];
    const iron = [];
    const rnd = artRng(17);
    for (let k = 0; k < bars; k++) {
      iron.push(bx(0.72, 0.035, 0.035, b.x + (rnd() - 0.5) * 0.06, F + 0.05 + Math.floor(k / 4) * 0.037, b.z - 0.2 + (k % 4) * 0.13, 0.85 + rnd() * 0.25));
    }
    y.add('iron', iron);
    // Heads in a small basket on top at the last step.
    if (step === 3 && lod < 2) for (let k = 0; k < 6; k++) y.add('iron', cyl([b.x - 0.25 + k * 0.1, F + 0.31, b.z + 0.18], [b.x - 0.25 + k * 0.1, F + 0.4, b.z + 0.18], 0.012, 0.001, 4));
  } else {
    const nSheaf = [0, 1, 3, 5][step];
    const nBow = [0, 2, 4, 6][step];
    const parts = { wood: [], iron: [], cloth: [], rope: [] };
    for (let k = 0; k < nSheaf; k++) {
      const sh = sheaf(1.8 + k * 0.28, zw + 0.2, 7, lod, F, k);
      for (const key of Object.keys(parts)) parts[key].push(...sh[key]);
    }
    const pegs = [];
    const staves = [];
    const strings = [];
    for (let k = 0; k < nBow; k++) {
      const x = 1.75 + k * 0.29;
      pegs.push(bx(0.025, 0.025, 0.1, x, 1.86, zw + 0.06, 0.8));
      const bw = bow(x, 1.85, zw + 0.1, lod);
      staves.push(bw.stave);
      strings.push(bw.string);
    }
    y.add('wood', [...parts.wood, ...pegs, ...staves]);
    y.add('iron', parts.iron);
    y.add('cloth', parts.cloth);
    y.add('rope', [...parts.rope, ...strings]);
  }
  return y.build();
}

/**
 * The people: the fletcher seated at the bench, an archer trying a bow at
 * the butt. Nobody when shut.
 */
export function fletcherActors(state) {
  if (state !== 'open') return [];
  const b = FL.bench;
  const a = FL.archer;
  const t = FL.butt;
  const tunic = { body: 'm', dress: ['tunic:short'], hair: 'crop' };
  return [
    { ...tunic, beard: 'short', clip: 'sit', at: [b.x + 0.1, F, b.z - 0.62], ry: 0, seed: 451, colours: { tunic: 0xb9a37a } },
    { ...tunic, hair: 'curls', clip: 'shoot', props: { L: 'bow', R: 'arrow' }, at: [a.x, F, a.z], ry: Math.atan2(t.x - a.x, t.z - a.z), seed: 452, colours: { tunic: 0x8a7a5a } },
  ];
}
