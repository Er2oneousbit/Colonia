/**
 * models/wsClothing.js
 * ----------------------------------------------------------------------------
 * The Clothing Maker (Taberna Vestiaria) of the 3D look, on the workshop kit
 * (workshopKit.js), from what is known of the Roman clothiers (vestiarii,
 * sartores) and of the fullers (fullones), not from the sprite:
 *
 *   - the cutting table: a high table at which the cloth is laid and cut
 *     to the pattern of a tunic (two rectangles, joined at the shoulders,
 *     with holes for the neck and sleeves) or a cloak (a rectangle with a
 *     border), with a pair of bronze shears (forfex, the one-piece spring
 *     shears of the Roman world) and a chalk line;
 *   - the tailor sewing: seated on a stool, the piece on the knees, the
 *     needle (acus) of bronze and bone and a hank of thread;
 *   - the finished garments hung on a rail across the back (tunics by the
 *     shoulders, cloaks - sagum and paenula - folded over the rail) and
 *     folded in stacks on a shelf; the colours of the dyers (madder red,
 *     woad blue, weld yellow, undyed and bleached white);
 *   - the fuller's tub (fullonica of Pompeii and Ostia): the cloth trodden
 *     in a tub of water, soda and stale urine to clean and thicken it, then
 *     rinsed, hung and brushed. A shop that made clothing from the bolt had
 *     its own tub for the new cloth;
 *   - the bolts of linen in the yard, stacked on a pallet.
 *
 * Layout: the cutting table at the middle of the shed, the tailor on his
 * stool at the left, the garments' rail along the back wall and the shelf of
 * folded cloth at the right, the fuller's tub in the yard at the right and
 * the bolts of linen stacked in the yard at the left.
 *
 * States: 'open' staffed (lantern lit, boards up, the cutter at the table,
 * the tailor sewing, a man treading cloth in the tub), 'shut' not (boards
 * across the front).
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { TREAD_SPEED } from './worksite.js';
import { linenBolt } from './wsLinen.js';
import { artRng } from '../texgen.js';
import { WsYard, WS, F, WASH, DADO, shed, ground, tub, stool, trestle, plankShelves, seg, lin, colour, bx, cyl } from './workshopKit.js';

/** The clothier's measures (metres): the actors read them. */
export const CLOTHING_MAKER = Object.freeze({
  table: Object.freeze({ x: -0.4, z: -2.0, w: 1.9, d: 0.9, top: 0.92 }),
  tailor: Object.freeze({ x: -2.6, z: -2.4 }),
  tub: Object.freeze({ x: 2.2, z: 1.35, r: 0.7, h: 0.55 }),
  pallet: Object.freeze({ x: -2.5, z: 1.5 }),
  /** The rail of garments along the back wall: x0..x1, height. */
  rail: Object.freeze({ x0: -3.2, x1: 0.6, y: 1.7 }),
  lamp: WS.lamp,
});

const K = CLOTHING_MAKER;
const LINEN = lin(0xefe9d6);
const DYES = [lin(0xb04a38), lin(0x4d6c96), lin(0xc9a33c), lin(0xe2d8bd), lin(0x5b7a4c), lin(0xd9c9a0)];

/** The cutting table with a cloth laid on it, a tunic cut out, the shears and a chalk line; a stool at the tailor's place. */
function table(y, lod) {
  const t = K.table;
  y.add('wood', trestle(t.x, t.z, t.w, t.d, t.top, { lod, k: 0.9 }));
  const tz = F + t.top;
  // The cloth spread on the table, a rectangle with a cut-out pattern in dark chalk.
  y.add('cloth', colour(bx(1.3, 0.012, 0.7, t.x - 0.15, tz, t.z, 1), LINEN));
  if (lod < 2) {
    y.add('cloth', colour(bx(0.5, 0.014, 0.4, t.x - 0.2, tz + 0.012, t.z, 1), LINEN, 0.85));
    y.add('bronze', [bx(0.2, 0.012, 0.05, t.x + 0.65, tz, t.z + 0.15, 1)], 'shut');
    y.add('wood', bx(0.5, 0.01, 0.01, t.x - 0.2, tz + 0.026, t.z + 0.1, 0.5));
  }
  // The tailor's stool and the piece on it.
  const s = K.tailor;
  y.add('wood', stool(s.x, s.z, { top: 0.4, s: 0.3 }));
}

/** A tunic hung by its shoulders at (x, yTop): the body and two short sleeves. */
function tunic(x, yTop, z, colourRgb, lod, tone = 1) {
  const parts = [colour(bx(0.5, 0.88, 0.05, x, yTop - 0.88, z, 1), colourRgb, tone)];
  if (lod < 2) {
    parts.push(colour(bx(0.28, 0.24, 0.045, x - 0.38, yTop - 0.24, z, 1), colourRgb, tone * 0.95));
    parts.push(colour(bx(0.28, 0.24, 0.045, x + 0.38, yTop - 0.24, z, 1), colourRgb, tone * 0.95));
  }
  return parts;
}

/** A cloak folded over the rail: a wide piece hanging both sides, a border band at its hem. */
function cloak(x, yTop, z, colourRgb, lod) {
  const parts = [colour(bx(0.7, 0.9, 0.06, x, yTop - 0.9, z, 1), colourRgb), colour(bx(0.74, 0.1, 0.075, x, yTop - 0.9, z, 1), colourRgb, 0.6)];
  if (lod < 2) parts.push(colour(bx(0.72, 0.04, 0.12, x, yTop - 0.04, z, 1), colourRgb, 0.9));
  return parts;
}

/** The rail along the back wall on two wall brackets, and the shelf of folded cloth at the right of the shed. */
function rail(y, lod) {
  const r = K.rail;
  const zw = WS.zBack + WS.t + 0.02;
  y.add('wood', cyl([r.x0, r.y, zw + 0.3], [r.x1, r.y, zw + 0.3], 0.03, 0.03, seg(lod, 7, 5, 4)));
  for (const x of [r.x0 + 0.1, (r.x0 + r.x1) / 2, r.x1 - 0.1]) y.add('wood', bx(0.05, 0.05, 0.3, x, r.y - 0.025, zw, 0.78));
  y.add('wood', plankShelves(1.5, 3.3, zw, 0.5, [0.45, 0.95], { lod }));
}

/** The fuller's tub with its dirty water, a trampling board across and a rinsing line of poles. */
function fullersTub(y, lod) {
  const t = K.tub;
  const w = tub(t.x, t.z, t.r, t.h, lod, { hoops: 2 });
  y.add('wood', w.wood);
  y.add('iron', w.iron);
  // The water in the tub (a cloudy grey; it freezes in a hard frost).
  const d = bx(2 * (t.r - 0.06), 0.01, 2 * (t.r - 0.06), t.x, F + t.h - 0.12, t.z, 1);
  y.add('water', d, 'always', false);
  // The rinsing poles hung with cloth, behind the tub.
  if (lod < 2) {
    for (const s of [-1, 1]) y.add('wood', bx(0.06, 1.5, 0.06, t.x + s * 0.8, F, t.z + 1.05, 0.76));
    y.add('wood', cyl([t.x - 0.8, F + 1.5, t.z + 1.05], [t.x + 0.8, F + 1.5, t.z + 1.05], 0.025, 0.025, 5));
    y.add('cloth', colour(bx(0.5, 0.7, 0.04, t.x - 0.25, F + 0.8, t.z + 1.05, 1), LINEN, 0.9));
    y.add('cloth', colour(bx(0.4, 0.6, 0.04, t.x + 0.35, F + 0.9, t.z + 1.05, 1), DYES[1], 0.9));
  }
}

/** A pallet under the stacked bolts. */
function pallet(y) {
  const p = K.pallet;
  for (const dx of [-0.55, 0, 0.55]) y.add('wood', bx(0.1, 0.08, 1.2, p.x + dx, F, p.z, 0.7));
  y.add('wood', bx(1.5, 0.04, 1.2, p.x, F + 0.08, p.z, 0.82));
}

/**
 * The finishing yard: the fuller's wicker cage (viminea cavea) over which
 * a cloth is spread to be whitened with burning sulphur (Pliny 35.57 and
 * the fullonicae's frescoes), and a frame on which a washed cloth is
 * stretched to dry.
 */
function finishing(y, lod) {
  const cx = -0.5;
  const cz = 2.7;
  const cage = new CylinderGeometry(0.06, 0.5, 1.1, seg(lod, 14, 8, 6), 1, true);
  cage.translate(cx, F + 0.55, cz);
  y.add('wicker', tintGeometry(boxUV(cage), () => 1));
  y.add('wood', cyl([cx, F, cz], [cx, F + 1.25, cz], 0.025, 0.02, 4));
  if (lod < 2) y.add('cloth', colour(new CylinderGeometry(0.05, 0.52, 0.5, 12, 1, true).translate(cx, F + 0.5, cz), LINEN, 0.9));
  // The stretching frame: two posts and two rails, a cloth laced in it.
  const fx = 0.9;
  const fz = 2.95;
  for (const s of [-1, 1]) y.add('wood', bx(0.07, 1.3, 0.07, fx + s * 0.6, F, fz, 0.76));
  y.add('wood', [bx(1.2, 0.05, 0.05, fx, F + 1.2, fz, 0.8), bx(1.2, 0.05, 0.05, fx, F + 0.3, fz, 0.8)]);
  y.add('cloth', colour(bx(1.1, 0.85, 0.02, fx, F + 0.33, fz, 1), DYES[0], 0.9));
}

/** Build the Clothing Maker: { group, meshes, triangles }. */
export function buildClothingMaker({ lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const y = new WsYard('clothing_ws', lod);
  ground(y);
  shed(y, lod, { wash: WASH.pink, dado: DADO.red, window: 2.4, seed: 371 });
  table(y, lod);
  rail(y, lod);
  fullersTub(y, lod);
  pallet(y);
  finishing(y, lod);
  return y.build();
}

/**
 * The stock. `in` is bolts of linen stacked on the pallet in the yard (3,
 * 7, 12), `out` the garments (hung on the rail and folded on the shelf:
 * 3, 7, 11 pieces).
 */
export function buildClothingStock(kind, step, { lod = 0 } = {}) {
  const y = new WsYard(`clothing_ws_${kind}`, lod);
  const rnd = artRng(41);
  if (kind === 'in') {
    const p = K.pallet;
    const counts = [0, 3, 7, 12][step];
    const bolts = [];
    let made = 0;
    for (let layer = 0; layer < 4 && made < counts; layer++) {
      for (let i = 0; i < 3 && made < counts; i++, made++) bolts.push(linenBolt(p.x - 0.35, F + 0.12 + layer * 0.2, p.z + (i - 1) * 0.36, 0.7, 0.1, lod, 0.92 + rnd() * 0.12));
    }
    y.add('cloth', bolts.filter((_, i) => lod < 2 || i % 2 === 0));
  } else {
    const r = K.rail;
    const zw = WS.zBack + WS.t + 0.02;
    const n = [0, 3, 7, 11][step];
    const cloth = [];
    // Along the rail: tunics and cloaks alternating, a hand's breadth apart; the surplus folded on the shelf.
    const onRail = Math.min(n, 7);
    for (let k = 0; k < onRail; k++) {
      const x = r.x0 + 0.45 + k * 0.52;
      const c = DYES[(k * 5) % DYES.length];
      cloth.push(...(k % 3 === 2 ? cloak(x, r.y, zw + 0.3 + 0.04 * (k % 2), c, lod) : tunic(x, r.y, zw + 0.3 + 0.04 * (k % 2), c, lod)));
    }
    const folded = n - onRail;
    for (let k = 0; k < folded; k++) {
      const shelf = k % 2 ? 0.95 : 0.45;
      const stackH = Math.floor(k / 2);
      cloth.push(colour(bx(0.5, 0.06, 0.4, 1.85 + (k % 2 ? 0.05 : 0.55) + (stackH % 2) * 0.6, F + shelf + 0.04 + 0.0 + (stackH > 1 ? 0.07 : 0), zw + 0.25, 1), DYES[(k * 3 + 1) % DYES.length]));
    }
    y.add('cloth', cloth);
  }
  return y.build();
}

/**
 * The people: the cutter at the table with shears, the tailor sewing on his
 * stool, a man treading the cloth in the fuller's tub. Nobody when shut.
 */
export function clothingMakerActors(state) {
  if (state !== 'open') return [];
  const t = K.table;
  const s = K.tailor;
  const u = K.tub;
  const tunicSpec = { body: 'm', dress: ['tunic:knee'], hair: 'crop' };
  return [
    { ...tunicSpec, hair: 'curls', clip: 'prune', props: { R: 'shears' }, at: [t.x - 0.1, F, t.z + 0.9], ry: Math.PI, seed: 471, colours: { tunic: 0xe2d8bd } },
    { ...tunicSpec, hair: 'bald', beard: 'short', clip: 'sit', at: [s.x, F, s.z], ry: 0.4, seed: 472, colours: { tunic: 0xb04a38 } },
    { body: 'm', dress: ['tunic:short'], hair: 'curls', clip: 'tread', at: [u.x, F + 0.1, u.z], ry: Math.PI, speed: TREAD_SPEED * 0.6, seed: 473, colours: { tunic: 0x8a7a5a } },
  ];
}
