/**
 * models/wsLinen.js
 * ----------------------------------------------------------------------------
 * The Linen Weaver (Textrinum) of the 3D look, on the workshop kit
 * (workshopKit.js), from what is known of the cloth trades of Italy before
 * the Empire, not from the sprite:
 *
 *   - the warp-weighted loom (the loom of the Greek and Italic world, and
 *     of the Romans' own past: the pulled-up rows of loom weights of baked
 *     clay found in the houses and workshops of Latium, Cumae and Pompeii,
 *     and the vase paintings of Penelope): two uprights leaning against the
 *     wall or the roof, a cloth beam across their tops, the warp hung from
 *     it in bunches, each tied to a clay weight; the weaver stands at it,
 *     passing the weft through the shed between the front and the back rank
 *     of threads and beating it upward with a sword-beater (spatha). The
 *     woven cloth hangs from the beam;
 *   - the flax (linum): pulled, retted in water to loosen the fibre, dried,
 *     broken (the stems crushed), scutched and combed on the hackle (a board
 *     of iron spikes) to draw out the long line fibre (Pliny, Natural
 *     History 19.16-18); the long fibre spun on a distaff and spindle
 *     (women's work, the wool-basket and the spindle on every stele);
 *   - the dye vat: woad and madder, weld and murex for linens that were
 *     coloured, in a tub with a stirring stick;
 *   - the bolts: the linen woven in lengths, rolled on a stick, and stacked.
 *
 * Layout: the loom at the back under the shed at the middle, the weaver
 * before it, the dye vat in the yard at the right, the flax in bundles in
 * the yard at the left and a woman spinning by it, the bolts of linen
 * stacked in the right-hand bay of the shed.
 *
 * States: 'open' staffed (lantern lit, boards up, the weaver at the loom,
 * a woman spinning the flax), 'shut' not (boards across the front).
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, TorusGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { artRng } from '../texgen.js';
import { WsYard, WS, F, WASH, DADO, shed, ground, tub, seg, lin, colour, bx, cyl, plankShelves, stool } from './workshopKit.js';

/** The weaver's measures (metres): the actors read them. */
export const LINEN_WEAVER = Object.freeze({
  loom: Object.freeze({ x: -0.9, z: -3.0, w: 1.5, top: 1.9 }),
  /** The dye vat in the yard and the flax area's middle. */
  vat: Object.freeze({ x: 2.3, z: 1.45, r: 0.5, h: 0.65 }),
  flax: Object.freeze({ x: -2.4, z: 1.5 }),
  /** The bolts' bay: x0..x1, z0..z1. */
  bay: Object.freeze({ x0: 1.6, x1: 3.3, z0: -3.3, z1: -1.7 }),
  lamp: WS.lamp,
});

const L = LINEN_WEAVER;
const LINEN = lin(0xefe9d6);
const FLAX = lin(0xc9b36a);

/** The loom: two uprights leaning on the wall, the beam, the woven cloth, the warp, the weights, the heddle rod, the beater. */
function loom(y, lod) {
  const m = L.loom;
  const x0 = m.x - m.w / 2;
  const x1 = m.x + m.w / 2;
  const zw = WS.zBack + WS.t + 0.02;
  // The uprights lean back onto the wall at their tops; the cloth beam rests in forks at the top, the warp falls free in front.
  for (const x of [x0, x1]) {
    y.add('wood', cyl([x, F, m.z - 0.05], [x, m.top, zw + 0.12], 0.045, 0.04, seg(lod, 7, 5, 4)));
  }
  y.add('wood', cyl([x0 - 0.1, m.top, zw + 0.12], [x1 + 0.1, m.top, zw + 0.12], 0.05, 0.05, seg(lod, 8, 6, 4)));
  // The woven cloth hanging from the beam (weaving runs downward as the cloth is beaten up in this rig): about a third of the height.
  const cx = m.x;
  const clothTop = m.top - 0.05;
  const clothBot = 1.05;
  y.add('cloth', colour(bx(m.w - 0.05, clothTop - clothBot, 0.035, cx, clothBot, zw + 0.25, 1), LINEN));
  // The warp: threads from the cloth's lower edge down to the weights, in bunches.
  const n = lod === 0 ? 14 : lod === 1 ? 7 : 3;
  const weights = [];
  const threads = [];
  const nw = lod === 0 ? 8 : 4;
  for (let i = 0; i < n; i++) {
    const x = x0 + 0.06 + ((x1 - x0 - 0.12) * i) / (n - 1);
    threads.push(bx(0.008, clothBot - 0.35, 0.008, x, 0.35, zw + 0.26, 1.1));
  }
  y.add('cloth', threads.map((t) => colour(t, LINEN, 0.95)));
  // The weights: baked-clay rings (or pyramids), eight in two ranks.
  if (lod < 2) {
    for (let i = 0; i < nw; i++) {
      const x = x0 + 0.1 + ((x1 - x0 - 0.2) * i) / (nw - 1);
      const g = new TorusGeometry(0.045, 0.022, 4, 8);
      g.rotateY(Math.PI / 2 * ((i % 2) ? 0 : 1));
      g.translate(x, 0.32 - (i % 2) * 0.07, zw + 0.26 + (i % 2) * 0.02);
      weights.push(tintGeometry(boxUV(g), () => 0.85));
    }
    y.add('clay', weights);
  }
  // The heddle rod across the warp and the shed rod, in front of the threads at chest height.
  y.add('wood', cyl([x0 - 0.05, 1.12, zw + 0.38], [x1 + 0.05, 1.12, zw + 0.38], 0.018, 0.018, 5));
  if (lod < 2) y.add('wood', [bx(0.04, 0.08, 0.14, x0 - 0.02, 1.07, zw + 0.32, 0.75), bx(0.04, 0.08, 0.14, x1 + 0.02, 1.07, zw + 0.32, 0.75)]);
  // The sword-beater leaning against the right upright when idle.
  y.add('wood', bx(0.7, 0.02, 0.08, x1 + 0.4, F + 0.02, m.z + 0.5, 0.85), 'shut', false);
}

/** The dye vat with a stick and the colour on its surface; a skein hung over the rim. */
function vat(y, lod) {
  const v = L.vat;
  const t = tub(v.x, v.z, v.r, v.h, lod, { liquid: lin(0x2c4a7a), level: 0.12, hoops: 2 });
  y.add('wood', t.wood);
  y.add('iron', t.iron);
  y.add('produce', t.liquid);
  if (lod < 2) {
    y.add('wood', cyl([v.x + 0.2, F + v.h - 0.05, v.z], [v.x + 0.75, F + 0.2, v.z + 0.55], 0.018, 0.018, 4), 'shut');
    // The dyed yarn drying on a pole between two forked posts beside it.
    for (const s of [-1, 1]) y.add('wood', bx(0.06, 1.4, 0.06, v.x + s * 0.55, F, v.z + 0.95, 0.76));
    y.add('wood', cyl([v.x - 0.6, F + 1.4, v.z + 0.95], [v.x + 0.6, F + 1.4, v.z + 0.95], 0.025, 0.025, 5));
    for (const [dx, c] of [[-0.3, lin(0x2c4a7a)], [0, lin(0x9c3a2e)], [0.3, lin(0xc9a33c)]]) y.add('cloth', colour(bx(0.12, 0.55, 0.05, v.x + dx, F + 0.88, v.z + 0.95, 1), c));
  }
}

/** A hackle on a post and a stool by the flax: the spinner's place. */
function flaxCorner(y, lod) {
  const f = L.flax;
  // The hackle board: a board with rows of iron spikes, on a bench.
  y.add('wood', [bx(0.9, 0.04, 0.45, f.x + 0.75, F + 0.5, f.z + 0.2, 0.82), bx(0.06, 0.5, 0.06, f.x + 0.4, F, f.z + 0.05, 0.75), bx(0.06, 0.5, 0.06, f.x + 1.1, F, f.z + 0.05, 0.75), bx(0.06, 0.5, 0.06, f.x + 0.4, F, f.z + 0.35, 0.75), bx(0.06, 0.5, 0.06, f.x + 1.1, F, f.z + 0.35, 0.75)]);
  if (lod < 2) for (let i = 0; i < 6; i++) y.add('iron', cyl([f.x + 0.45 + i * 0.1, F + 0.54, f.z + 0.25], [f.x + 0.45 + i * 0.1, F + 0.7, f.z + 0.25], 0.006, 0.002, 3));
  y.add('wood', stool(f.x + 2.0, f.z + 0.7, { top: 0.4, s: 0.3 }));
}

/** The bolts' bay: a plank bench with a back board, on which the bolts are stacked. */
function bay(y, lod) {
  const b = L.bay;
  y.add('wood', plankShelves(b.x0, b.x1, b.z0, 0.5, [0.4], { lod }));
  y.add('wood', bx(b.x1 - b.x0, 0.05, 1.4, (b.x0 + b.x1) / 2, F + 0.4, (b.z0 + 1.0 + b.z1) / 2 - 0.1, 0.8));
}

/**
 * The retting trough in the yard: a long timber trough of water in which the
 * pulled flax lies under weights of stone, a week or two, until the stems
 * rot from the fibre (Pliny 19.17 on the water and the weights). Its water
 * freezes in a hard frost.
 */
function rettingTrough(y, lod) {
  const x = -0.4;
  const z = 3.1;
  const w = 2.0;
  const d = 0.75;
  const h = 0.36;
  y.add('wood', [bx(w, 0.04, d, x, F + 0.04, z, 0.78), bx(w, h, 0.06, x, F, z - d / 2 + 0.03, 0.82), bx(w, h, 0.06, x, F, z + d / 2 - 0.03, 0.82), bx(0.06, h, d - 0.12, x - w / 2 + 0.03, F, z, 0.82), bx(0.06, h, d - 0.12, x + w / 2 - 0.03, F, z, 0.82)]);
  y.add('water', bx(w - 0.12, 0.01, d - 0.12, x, F + h - 0.07, z, 1), 'always', false);
  // The flax lying in it, the heads of the bundles out at one end, and the stones on top.
  if (lod < 2) {
    for (let k = 0; k < 3; k++) y.add('thatch', colour(cyl([x - 0.8, F + h - 0.04, z - 0.22 + k * 0.22], [x + 0.75, F + h - 0.04, z - 0.22 + k * 0.22], 0.085, 0.085, 6), FLAX, 0.85));
    for (const dx of [-0.5, 0.2]) y.add('stone', colour(bx(0.26, 0.1, 0.4, x + dx, F + h + 0.0, z, 1), [1, 1, 1], 0.8));
  }
}

/** Build the Linen Weaver: { group, meshes, triangles }. */
export function buildLinenWeaver({ lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const y = new WsYard('linen_ws', lod);
  ground(y);
  shed(y, lod, { wash: WASH.cream, dado: DADO.ochre, window: -2.3, seed: 361 });
  loom(y, lod);
  vat(y, lod);
  flaxCorner(y, lod);
  bay(y, lod);
  rettingTrough(y, lod);
  return y.build();
}

/** A bolt of linen: a roll on a stick, axis along x from (x0, y, z), length len, radius r. */
export function linenBolt(x0, yy, z, len, r, lod, tone = 1) {
  const g = new CylinderGeometry(r, r, len, seg(lod, 12, 8, 5), 1);
  g.rotateZ(Math.PI / 2);
  g.translate(x0 + len / 2, yy + r, z);
  return colour(boxUV(g), LINEN, tone);
}

/** A stook of flax: a bundle standing on its butts, tied at the waist, the seed-heads fanning out at the top. */
function stook(x, z, lod, k) {
  const out = { flax: [], rope: [] };
  const g = new CylinderGeometry(0.1, 0.16, 0.85, seg(lod, 9, 6, 4), 1);
  g.translate(x, F + 0.42, z);
  out.flax.push(colour(boxUV(g), FLAX, 0.9 + 0.05 * (k % 3)));
  if (lod < 2) {
    const top = new CylinderGeometry(0.15, 0.1, 0.18, seg(lod, 9, 6, 4), 1);
    top.translate(x, F + 0.9, z);
    out.flax.push(colour(boxUV(top), FLAX, 1.05));
    const t = new TorusGeometry(0.115, 0.01, 3, 8);
    t.rotateX(Math.PI / 2);
    t.translate(x, F + 0.46, z);
    out.rope.push(tintGeometry(boxUV(t), () => 0.9));
  }
  return out;
}

/**
 * The stock. `in` is flax: stooks in the yard (3, 6, 10) and, in the last
 * step, hanks hung on a rail; `out` is bolts of linen stacked in the bay
 * (3, 8, 14).
 */
export function buildLinenStock(kind, step, { lod = 0 } = {}) {
  const y = new WsYard(`linen_ws_${kind}`, lod);
  if (kind === 'in') {
    const f = L.flax;
    const spots = [[0, 0], [0.4, 0.12], [0.2, 0.5], [0.8, 0.55], [0.55, 0.95], [0.05, 0.98], [-0.35, 0.5], [-0.4, 0.05], [0.9, 0.05], [-0.1, 1.4]];
    const count = [0, 3, 6, 10][step];
    const flax = [];
    const rope = [];
    for (let k = 0; k < count; k++) {
      const s = stook(f.x + spots[k][0] - 0.4, f.z + spots[k][1], lod, k);
      flax.push(...s.flax);
      rope.push(...s.rope);
    }
    y.add('thatch', flax);
    y.add('rope', rope);
  } else {
    const b = L.bay;
    const rnd = artRng(31);
    // Rolls laid along x in three ranks across z, stacked in layers: the first layer is 3 wide, then 3, then 2 on top.
    const counts = [0, 3, 8, 14][step];
    const bolts = [];
    let made = 0;
    const layers = [[3, 0.4 + 0.05], [3, 0.4 + 0.05 + 0.22], [3, 0.4 + 0.05 + 0.44], [3, 0.4 + 0.05 + 0.66]];
    for (const [nz, yy] of layers) {
      for (let i = 0; i < nz && made < counts; i++) {
        for (let j = 0; j < 2 && made < counts; j++, made++) bolts.push(linenBolt(b.x0 + 0.1 + (j + (yy > 0.7 ? 0.25 : 0)) * 0.7, F + yy, b.z0 + 0.55 + i * 0.38, 0.65, 0.1, lod, 0.92 + rnd() * 0.12));
      }
    }
    y.add('cloth', bolts.filter((_, i) => lod < 2 || i % 2 === 0));
  }
  return y.build();
}

/**
 * The people: the weaver standing at the loom passing the weft, a woman
 * spinning the flax. Nobody when shut.
 */
export function linenWeaverActors(state) {
  if (state !== 'open') return [];
  const m = L.loom;
  const f = L.flax;
  return [
    { body: 'f', dress: ['tunic:long'], hair: 'bun', clip: 'prune', at: [m.x, F, m.z + 0.42], ry: Math.PI, seed: 461, colours: { tunic: 0xd8cdb4 } },
    { body: 'f', dress: ['tunic:long', 'palla'], hair: 'bun', clip: 'spin', props: { L: 'distaff', R: 'spindle' }, at: [f.x + 1.4, F, f.z + 1.45], ry: Math.PI * 0.85, seed: 462, colours: { tunic: 0xb9a37a, mantle: 0x8a6a4a } },
  ];
}
