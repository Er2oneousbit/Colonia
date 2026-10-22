/**
 * models/wsCarpenter.js
 * ----------------------------------------------------------------------------
 * The Carpenter (Officina Lignaria) of the 3D look, on the workshop kit
 * (workshopKit.js), from the record of Roman joinery, not from the sprite:
 *
 *   - the workbench of the reliefs and of the finds at Pompeii and
 *     Herculaneum (a thick top on four splayed legs, a stop and a wooden
 *     screw vice at one end, round pegs in holes along the top to hold the
 *     work), at which the carpenter stands, working with mallet and chisel;
 *   - the tools on the wall: the adze (dolabra, the carpenter's first tool,
 *     here the axe-adze), the bow drill (terebra with a bow), the saw (serra,
 *     which cut on the pull in Rome's later times and on the push before),
 *     the square, the plane (runcina, a late Republican import);
 *   - the timber in squared baulks, stacked on sleepers in layers, which the
 *     carpenter dresses with the adze on trestles (Vitruvius II.9 on the
 *     timber, its felling and seasoning);
 *   - the furniture of the age: the stool (sella), the chest (arca), bound
 *     with iron, and the couch (lectus) on turned legs with a headrest.
 *
 * Layout: the bench under the shed at the middle with the tools above it on
 * the wall; the finished furniture in the left bay; the trestles with a
 * baulk on them and the stack of timber in the yard. Shavings lie on the
 * floor round the bench.
 *
 * States: 'open' staffed (lantern lit, boards swung up, a man at the bench
 * with mallet and chisel, another dressing a baulk with an adze, a boy
 * sweeping the shavings), 'shut' not (boards across the front; the mallet
 * and the adze left on the bench).
 * ----------------------------------------------------------------------------
 */

import { TorusGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { artRng } from '../texgen.js';
import { WsYard, WS, F, WASH, DADO, shed, ground, stool, plankShelves, pegBoard, logs, handcart, seg, lin, colour, bx, cyl } from './workshopKit.js';

/** The carpenter's measures (metres): the actors read them. */
export const CARPENTER = Object.freeze({
  bench: Object.freeze({ x: 0.4, z: -2.1, w: 2.1, d: 0.62, top: 0.9 }),
  /** The trestles with the baulk being dressed, in the yard. */
  horses: Object.freeze({ x: -1.4, z: 1.7, len: 2.3 }),
  /** The timber stack's middle and a baulk's section and length (along z). */
  stack: Object.freeze({ x: 2.55, z: 1.7, side: 0.22, len: 2.6 }),
  lamp: WS.lamp,
});

const C = CARPENTER;

/** The bench: the top on four splayed legs, a stretcher, the vice, the pegs and the baulk being worked. */
function bench(y, lod) {
  const b = C.bench;
  const n = seg(lod, 6, 5, 4);
  y.add('wood', bx(b.w, 0.1, b.d, b.x, F + b.top - 0.1, b.z, 0.88));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    y.add('wood', cyl([b.x + sx * (b.w / 2 - 0.2) + sx * 0.06, F, b.z + sz * (b.d / 2 + 0.07)], [b.x + sx * (b.w / 2 - 0.2), F + b.top - 0.1, b.z + sz * (b.d / 2 - 0.1)], 0.055, 0.05, n));
  }
  if (lod < 2) {
    y.add('wood', bx(b.w - 0.5, 0.06, 0.08, b.x, F + 0.22, b.z, 0.8));
    // The wooden screw vice at the left end: a jaw, the screw and its bar.
    y.add('wood', bx(0.09, 0.2, b.d - 0.1, b.x - b.w / 2 + 0.05, F + b.top - 0.2, b.z, 0.78));
    y.add('wood', cyl([b.x - b.w / 2 - 0.2, F + b.top - 0.14, b.z + 0.1], [b.x - b.w / 2 + 0.05, F + b.top - 0.14, b.z + 0.1], 0.035, 0.035, n));
    y.add('wood', cyl([b.x - b.w / 2 - 0.2, F + b.top - 0.14, b.z - 0.05], [b.x - b.w / 2 - 0.2, F + b.top - 0.14, b.z + 0.25], 0.02, 0.02, 4));
    // The pegs standing in their holes along the top (the stop).
    for (let k = 0; k < 4; k++) y.add('wood', cyl([b.x - 0.3 + k * 0.25, F + b.top, b.z - 0.12], [b.x - 0.3 + k * 0.25, F + b.top + 0.11, b.z - 0.12], 0.022, 0.02, 4));
  }
  // The baulk on the bench, squared, held by two pegs; the mallet and chisel left on it when the shop is shut.
  y.add('wood', bx(1.3, 0.13, 0.15, b.x + 0.1, F + b.top, b.z - 0.08, 1.05));
  if (lod < 2) {
    y.add('wood', bx(0.2, 0.07, 0.07, b.x + 0.6, F + b.top + 0.13, b.z - 0.08, 0.7), 'shut');
    y.add('iron', bx(0.2, 0.025, 0.025, b.x + 0.2, F + b.top + 0.13, b.z + 0.08, 1), 'shut');
  }
}

/** One adze: a handle and the iron head across its foot (hung with the head down, the blade toward the wall's face). */
function adze(x, yy, z, lod) {
  return {
    wood: [cyl([x, yy - 0.45, z + 0.04], [x, yy, z + 0.04], 0.017, 0.015, 5)],
    iron: [bx(0.04, 0.05, 0.15, x, yy - 0.5, z + 0.02, 0.9)],
  };
}

/** The wall of tools above the bench: the adze, the bow drill, the saw, the square and the mallet. */
function tools(y, lod) {
  const b = C.bench;
  const zw = WS.zBack + WS.t + 0.02;
  y.add('wood', pegBoard(b.x - 1.0, b.x + 1.0, zw, 1.78, lod));
  const a = adze(b.x - 0.7, 1.85, zw, lod);
  y.add('wood', a.wood);
  y.add('iron', a.iron);
  // The bow drill: the bow (a bent rod, its string) and the shaft with its bit, hung together.
  const bow = [];
  for (let k = 0; k < 6; k++) {
    const t0 = k / 6;
    const t1 = (k + 1) / 6;
    const arc = (t) => [b.x - 0.25 + 0.4 * t, 1.72 + 0.16 * Math.sin(Math.PI * t) - 0.0, zw + 0.06];
    bow.push(cyl(arc(t0), arc(t1), 0.012, 0.012, 4));
  }
  y.add('wood', bow);
  y.add('rope', bx(0.4, 0.008, 0.008, b.x - 0.05, 1.73, zw + 0.06, 0.9));
  y.add('wood', cyl([b.x - 0.05, 1.28, zw + 0.07], [b.x - 0.05, 1.73, zw + 0.07], 0.013, 0.013, 4));
  y.add('iron', cyl([b.x - 0.05, 1.22, zw + 0.07], [b.x - 0.05, 1.3, zw + 0.07], 0.007, 0.007, 4));
  // The saw: a plate with teeth on one edge and a wooden handle.
  y.add('iron', bx(0.62, 0.11, 0.012, b.x + 0.5, 1.52, zw + 0.04, 0.95));
  y.add('wood', bx(0.12, 0.1, 0.03, b.x + 0.87, 1.52, zw + 0.04, 0.75));
  // The square and a mallet.
  y.add('wood', [bx(0.3, 0.025, 0.012, b.x + 0.15, 1.45, zw + 0.04, 0.8), bx(0.025, 0.24, 0.012, b.x + 0.15, 1.21, zw + 0.04, 0.8)]);
  y.add('wood', [cyl([b.x - 0.5, 1.5, zw + 0.06], [b.x - 0.5, 1.75, zw + 0.06], 0.016, 0.016, 5), bx(0.15, 0.1, 0.1, b.x - 0.5, 1.4, zw + 0.06, 0.7)]);
}

/** Shavings: pale curls on the floor round the bench and under the vice, and a few chips. */
function shavings(y, lod) {
  if (lod >= 2) return;
  const b = C.bench;
  const rnd = artRng(77);
  const n = lod === 0 ? 22 : 8;
  const out = [];
  for (let k = 0; k < n; k++) {
    const g = new TorusGeometry(0.035 + rnd() * 0.02, 0.006, 3, 7, 4.4);
    g.rotateX(Math.PI / 2 + (rnd() - 0.5) * 0.6);
    g.rotateY(rnd() * 6.28);
    g.translate(b.x - 0.9 + rnd() * 2.0, F + 0.025, b.z - 0.3 + rnd() * 1.1);
    out.push(tintGeometry(boxUV(g), () => 1.15 + rnd() * 0.2));
  }
  y.add('wood', out, 'always', false);
}

/** The trestles with a baulk on them in the yard, an adze left in it when shut. */
function horses(y, lod) {
  const h = C.horses;
  for (const s of [-1, 1]) {
    const x = h.x + s * (h.len / 2 - 0.35);
    y.add('wood', [cyl([x, F, h.z - 0.3], [x, F + 0.38, h.z], 0.045, 0.045, 5), cyl([x, F, h.z + 0.3], [x, F + 0.38, h.z], 0.045, 0.045, 5), bx(0.1, 0.06, 0.62, x, F + 0.36, h.z - 0.31, 0.8)]);
  }
  y.add('wood', bx(h.len, 0.2, 0.22, h.x, F + 0.42, h.z, 1.05));
  // The chips dressed off it, on the ground.
  if (lod < 2) y.add('wood', [bx(0.3, 0.015, 0.12, h.x - 0.3, F, h.z + 0.4, 1.2), bx(0.22, 0.015, 0.1, h.x + 0.5, F, h.z - 0.42, 1.2), bx(0.18, 0.015, 0.1, h.x + 0.1, F, h.z + 0.55, 1.2)], 'always', false);
}

/** The timber stack's sleepers (the baulks are the stock's). */
function sleepers(y) {
  const s = C.stack;
  for (const dz of [-0.9, 0, 0.9]) y.add('wood', bx(1.3, 0.1, 0.12, s.x, F, s.z + dz, 0.7));
}

/** The yard's other things: a heap of offcuts for the fire along the fence and a handcart for the timber. */
function dressing(y, lod) {
  y.add('bark', logs(-3.0, 3.35, 1.5, 0.6, lod, 0, 5));
  const c = handcart(0.5, 3.0, Math.PI / 2, lod, 4);
  y.add('wood', c.wood);
  y.add('iron', c.iron);
}

/** Build the Carpenter: { group, meshes, triangles }. */
export function buildCarpenter({ lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const y = new WsYard('furniture_ws', lod);
  ground(y);
  shed(y, lod, { wash: WASH.ochre, dado: DADO.oxblood, window: 2.2, seed: 311 });
  // The furniture's bay needs its shelf for the small things.
  y.add('wood', plankShelves(-3.3, -1.0, WS.zBack + WS.t + 0.02, 0.4, [1.1], { lod }));
  bench(y, lod);
  tools(y, lod);
  shavings(y, lod);
  horses(y, lod);
  sleepers(y);
  dressing(y, lod);
  return y.build();
}

/** A stool of the age: a square seat on four turned legs. */
function seat(x, z, lod, k = 1) {
  return stool(x, z, { top: 0.44, s: 0.36, k });
}

/** A chest: a box of boards with a lid slightly domed, iron bands and a hasp. Returns { wood, iron }. */
function chest(x, z, y0, w = 0.78, lod = 0, ry = 0) {
  const wood = [bx(w, 0.42, 0.46, 0, 0, 0, 0.92), bx(w + 0.04, 0.07, 0.5, 0, 0.42, 0, 1.0)];
  const iron = [];
  if (lod < 2) for (const s of [-1, 1]) iron.push(bx(0.05, 0.5, 0.52, s * (w / 2 - 0.12), -0.0, 0, 0.9));
  if (lod < 1) iron.push(bx(0.06, 0.1, 0.03, 0, 0.32, 0.245, 1));
  const place = (g) => g.rotateY(ry).translate(x, y0, z);
  return { wood: wood.map(place), iron: iron.map(place) };
}

/** A couch (lectus): a frame on four turned legs, a mattress, a bolster at the head. Returns { wood, cloth }. */
function couch(x, z, lod) {
  const wood = [];
  const L = 1.85;
  const W = 0.78;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wood.push(cyl([x + sx * (L / 2 - 0.08), F, z + sz * (W / 2 - 0.08)], [x + sx * (L / 2 - 0.08), F + 0.4, z + sz * (W / 2 - 0.08)], 0.045, 0.035, seg(lod, 8, 6, 4)));
  wood.push(bx(L, 0.07, W, x, F + 0.4, z, 0.9));
  // The headboard at the left, rising to a curve.
  wood.push(bx(0.06, 0.34, W, x - L / 2 + 0.03, F + 0.47, z, 0.88));
  const cloth = [colour(bx(L - 0.2, 0.09, W - 0.08, x + 0.05, F + 0.47, z, 1), lin(0x9a3b2c)), colour(bx(0.28, 0.14, W - 0.1, x - L / 2 + 0.3, F + 0.56, z, 1), lin(0xe2d8bd))];
  return { wood, cloth };
}

/**
 * The stock. `in` is the timber (squared baulks stacked in layers on
 * sleepers: a third a layer), `out` the furniture (stools, chests and a
 * couch in the left bay, more each step).
 */
export function buildCarpenterStock(kind, step, { lod = 0 } = {}) {
  const y = new WsYard(`furniture_ws_${kind}`, lod);
  if (kind === 'in') {
    const s = C.stack;
    // Layers of 4, 3 and 2 baulks laid along z, each smaller layer on the one below, centred.
    const layers = [4, 3, 2].slice(0, step === 1 ? 1 : step === 2 ? 2 : 3);
    const rnd = artRng(5);
    layers.forEach((n, k) => {
      if (lod === 2) {
        // (From far out one block of the layer.)
        y.add('wood', bx(n * (s.side + 0.03), s.side, s.len - (k === 2 ? 0.3 : 0), s.x, F + 0.1 + k * (s.side + 0.01), s.z, 1.05));
        return;
      }
      for (let i = 0; i < n; i++) {
        const tone = 0.95 + rnd() * 0.25;
        const g = bx(s.side, s.side, s.len - (k === 2 ? 0.3 : 0) - rnd() * 0.1, s.x + (i - (n - 1) / 2) * (s.side + 0.03), F + 0.1 + k * (s.side + 0.01), s.z, tone);
        y.add('wood', g);
      }
    });
    if (step === 1 && lod < 2) y.add('wood', bx(s.side, s.side, 2.1, s.x - 1.0, F, s.z - 0.1, 1.0));
  } else {
    const wood = [];
    const iron = [];
    const cloth = [];
    const stools = [[-3.0, -1.55], [-2.55, -1.5], [-2.1, -1.55], [-1.65, -1.5], [-3.0, -1.1], [-2.5, -1.1]];
    const nStool = [0, 2, 4, 6][step];
    for (let k = 0; k < nStool; k++) wood.push(seat(stools[k][0], stools[k][1], lod, 0.82 + 0.06 * (k % 3)));
    const chests = [[-3.0, -3.05, 0, 0.8], [-2.1, -3.05, 0, 0.74], [-1.2, -3.05, 0, 0.7], [-3.0, -3.05, 0.5, 0.7]];
    const nChest = [0, 1, 2, 4][step];
    for (let k = 0; k < nChest; k++) {
      const c = chest(chests[k][0], chests[k][1], F + chests[k][2], chests[k][3], lod);
      wood.push(...c.wood);
      iron.push(...c.iron);
    }
    if (step >= 2) {
      const c = couch(-2.0, -2.2, lod);
      wood.push(...c.wood);
      cloth.push(...c.cloth);
    }
    y.add('wood', wood);
    y.add('iron', iron);
    y.add('cloth', cloth);
  }
  return y.build();
}

/**
 * The people: a man at the bench with mallet and chisel, a man dressing the
 * baulk on the trestles with an adze, a boy sweeping the shavings. Nobody
 * when shut.
 */
export function carpenterActors(state) {
  if (state !== 'open') return [];
  const b = C.bench;
  const h = C.horses;
  const tunic = { body: 'm', dress: ['tunic:short'], hair: 'crop' };
  return [
    { ...tunic, clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [b.x + 0.1, F, b.z + 0.45], ry: Math.PI, seed: 411, colours: { tunic: 0xa8977a } },
    { ...tunic, hair: 'curls', clip: 'hoe', props: { R: 'hoe' }, at: [h.x - 0.3, F, h.z + 0.95], ry: Math.PI, seed: 412, colours: { tunic: 0x8a7a5a } },
    { body: 'c', scale: 0.78, dress: ['tunic:short'], hair: 'crop', clip: 'sweep', props: { R: 'broom' }, at: [b.x - 1.6, F, b.z + 0.9], ry: Math.PI / 2, seed: 413, colours: { tunic: 0xbfae8e } },
  ];
}
