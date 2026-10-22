/**
 * models/clayPit.js
 * ----------------------------------------------------------------------------
 * The clay pit (Cretifodina) of the 3D look, on a 2 x 2 footprint (8 m),
 * from what is known of how the Romans dug and prepared clay for bricks,
 * tiles and pots, not from the 2D sprite:
 *
 *   - Vitruvius (II.3) on bricks: the clay must be white and chalky, or red
 *     and gravelly, dug in spring or autumn and left to weather a season
 *     before it is moulded, then dried two years in the shade. Pliny (Natural
 *     History 35.46-49) on the same, and on clay pits as the potters' and
 *     the brickmakers' first need.
 *   - The Roman potters' and brickmakers' way, from the kilns and yards of
 *     Pompeii, of Ostia and of the Tiber's brickfields: clay dug with the
 *     mattock (ligo, dolabra) in steps down a pit, water standing in the
 *     bottom, carried up in baskets and on hand barrows (feretrum) to a
 *     pug bed where it was trodden and worked wet, then stacked and dried
 *     under a roof on posts, and the bricks set out on racks.
 *
 * So, on 8 m of tilled-up earth: at the back-left the pit, three steps of
 * clay cut down each side to a floor with a pool of water, a plank ramp
 * with cleats coming down into it from the front; at the front-left the pug
 * bed in a frame of boards; at the back-right a shelter on posts under
 * thatch, over a pallet where the dug clay is stacked in lumps (the
 * stock); at the front two drying racks of unfired bricks, a hand barrow
 * and two baskets of clay.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the lantern lit, the barrow loaded, and (actors,
 *           people/) two diggers in the pit with mattocks and a man
 *           working the pug bed
 *   'shut'  no staff: the mattocks leaning on a post, the barrow empty,
 *           the lantern cold, nobody
 * The stock is a kit of its own for each step (clay_pit:stock:1..3), put
 * where the lumps lie by models.js.
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CircleGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { slab } from './masonry.js';
import { basket, beam, lin } from './rural.js';
import { iceMaterial } from '../materials.js';
import { Yard, YARD, bx, colour, pole, stone, blockStack, thatchGable, seg } from './industryKit.js';

const F = YARD.floorY;

/** The pit's and the shelter's measures (metres): the tests and the actors read them. */
export const CLAY_PIT = Object.freeze({
  // The pit's outer rim, its three steps (each `band` wide, their tops), the floor inside the last.
  pit: Object.freeze({ x0: -3.8, x1: 0.9, z0: -3.8, z1: 0.2 }),
  band: 0.36,
  tops: Object.freeze([0.55, 0.36, 0.18]),
  pool: Object.freeze({ x: -2.0, z: -2.1, rx: 0.62, rz: 0.42 }),
  // The pug bed's boards (x0, x1, z0, z1), the shelter's footprint and the pallet under it.
  bed: Object.freeze({ x0: -3.7, x1: -1.7, z0: 1.0, z1: 2.4 }),
  shelter: Object.freeze({ x0: 1.65, x1: 3.5, z0: -3.5, z1: -0.8, eaveY: 1.7, ridgeY: 2.65 }),
  pallet: Object.freeze({ cx: 2.55, cz: -2.1, w: 1.4, d: 2.2 }),
  /** The lantern on its bracket at the shelter's front-left post (x, y, z). */
  lamp: Object.freeze([1.65, 1.38, -0.5]),
});

const P = CLAY_PIT;

/** Fraction of clay's wetness in the pit: lower steps are darker. */
const STEP_TONE = [1.0, 0.82, 0.66];

/** The pit's three steps and the floor, the pool, the ramp. */
function pit(y, lod) {
  const { x0, x1, z0, z1 } = P.pit;
  const t = P.band;
  const clay = [];
  P.tops.forEach((top, k) => {
    const i0 = t * k;
    const o = { x0: x0 + i0, x1: x1 - i0, z0: z0 + i0, z1: z1 - i0 };
    const h = top - F;
    const w = o.x1 - o.x0;
    const opts = { bevel: 0.07, seed: 11 + k * 5, wobble: 0.015, tone: 0.1, grime: 0.25 };
    // Four boxes round: the back and front across the whole width, the two sides between them.
    clay.push(colour(stone(w, h, t, (o.x0 + o.x1) / 2, F, o.z0 + t / 2, opts), [1, 1, 1], STEP_TONE[k]));
    clay.push(colour(stone(w, h, t, (o.x0 + o.x1) / 2, F, o.z1 - t / 2, { ...opts, seed: opts.seed + 1 }), [1, 1, 1], STEP_TONE[k]));
    const d = o.z1 - o.z0 - 2 * t;
    clay.push(colour(stone(t, h, d, o.x0 + t / 2, F, (o.z0 + o.z1) / 2, { ...opts, seed: opts.seed + 2 }), [1, 1, 1], STEP_TONE[k]));
    clay.push(colour(stone(t, h, d, o.x1 - t / 2, F, (o.z0 + o.z1) / 2, { ...opts, seed: opts.seed + 3 }), [1, 1, 1], STEP_TONE[k]));
  });
  y.add('rawClay', clay);
  // The floor, wet and dark.
  const fl = t * 3;
  y.add('rawClay', colour(slab(x1 - x0 - 2 * fl, 0.02, z1 - z0 - 2 * fl, { bevel: 0.005, seed: 3, wobble: 0, tone: 0.1, grime: 0 }), [1, 1, 1], 0.5).translate((x0 + x1) / 2, F - 0.01, (z0 + z1) / 2));
  // The pool: a flat disc of standing water in the bottom, its edge on the floor.
  const w = new CircleGeometry(1, seg(lod, 22, 14, 8));
  w.rotateX(-Math.PI / 2);
  w.scale(P.pool.rx, 1, P.pool.rz);
  w.translate(P.pool.x, F + 0.03, P.pool.z);
  y.add('water', tintGeometry(boxUV(w), () => 1), 'always', false);
}

/** The ramp of planks down into the pit with its side rails and cleats, from the front rim to the floor. */
function ramp(y, lod) {
  const x = -1.55;
  const w = 0.72;
  const zTop = 0.5;
  const zBot = -1.75;
  const slope = 0.3;
  const yAt = (z) => 0.66 + (z - 0.2) * slope;
  const len = Math.hypot(zTop - zBot, yAt(zTop) - yAt(zBot));
  const ang = Math.atan2(yAt(zTop) - yAt(zBot), zTop - zBot);
  const mid = [x, (yAt(zTop) + yAt(zBot)) / 2, (zTop + zBot) / 2];
  const board = new BoxGeometry(w, 0.07, len);
  board.rotateX(-ang);
  board.translate(...mid);
  y.add('wood', tintGeometry(boxUV(board), () => 0.85));
  if (lod >= 2) return;
  // Rails along both edges and cleats every third of a metre, so a basket carrier's foot holds.
  for (const s of [-1, 1]) {
    const r = new BoxGeometry(0.06, 0.07, len);
    r.rotateX(-ang);
    r.translate(x + s * (w / 2 + 0.03), mid[1] + 0.06, mid[2]);
    y.add('wood', tintGeometry(boxUV(r), () => 0.7));
  }
  const n = lod === 0 ? Math.floor(len / 0.34) : 3;
  for (let k = 1; k < n; k++) {
    const z = zBot + (len / n) * k * Math.cos(ang);
    y.add('wood', bx(w - 0.04, 0.035, 0.06, x, yAt(z) + 0.035, z, 0.65));
  }
  // The head rests on two stumps outside the rim; the foot on a flat stone on the floor.
  for (const s of [-1, 1]) y.add('wood', bx(0.12, yAt(zTop) - 0.06 - F, 0.12, x + s * 0.3, F, zTop - 0.1, 0.75));
  y.add('stone', stone(0.5, 0.06, 0.4, x, F, zBot + 0.05, { bevel: 0.01, seed: 4, wobble: 0.004, tone: 0.1, grime: 0.4 }));
}

/** The pug bed: a frame of boards and the wet clay in it, worked by the man's mattock. */
function pugBed(y, lod) {
  const { x0, x1, z0, z1 } = P.bed;
  const w = x1 - x0;
  const d = z1 - z0;
  const t = 0.05;
  const h = 0.17;
  y.add('wood', [bx(w, h, t, (x0 + x1) / 2, F, z0 + t / 2, 0.8), bx(w, h, t, (x0 + x1) / 2, F, z1 - t / 2, 0.8), bx(t, h, d - 2 * t, x0 + t / 2, F, (z0 + z1) / 2, 0.8), bx(t, h, d - 2 * t, x1 - t / 2, F, (z0 + z1) / 2, 0.8)]);
  // The clay trodden wet to a slurry, its surface a hand's breadth under the rim.
  y.add('rawClay', colour(slab(w - 2 * t, 0.1, d - 2 * t, { bevel: 0.03, seed: 6, wobble: 0.01, tone: 0.1, grime: 0 }), [1, 1, 1], 0.62).translate((x0 + x1) / 2, F, (z0 + z1) / 2));
  if (lod >= 2) return;
  // Stakes at the corners, and a plank across for the man to stand on to tread, laid by.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) y.add('wood', bx(0.07, 0.3, 0.07, (sx < 0 ? x0 : x1) - sx * 0.02, F, (sz < 0 ? z0 : z1) - sz * 0.02, 0.8));
  y.add('wood', bx(0.9, 0.04, 0.26, x1 + 0.6, F, z0 + 0.4, 0.8));
}

/** Two racks of unfired bricks drying, two shelves each, on four posts. */
function racks(y, lod) {
  const rnd = [0.93, 1.02, 0.97, 1.06, 0.9, 1.0, 0.95];
  for (const [cz, shift] of [[1.55, 0], [2.45, 0.35]]) {
    const cx = -0.05 + shift;
    const L = 1.9;
    const D = 0.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) y.add('wood', bx(0.06, 1.05, 0.06, cx + sx * (L / 2 - 0.05), F, cz + sz * (D / 2 - 0.05), 0.8));
    for (const sh of [0.38, 0.78]) {
      y.add('wood', bx(L, 0.04, D, cx, F + sh, cz, 0.85));
      if (lod >= 2) {
        y.add('rawClay', bx(L - 0.2, 0.07, D - 0.14, cx, F + sh + 0.04, cz, 1.05));
        continue;
      }
      // Bricks (lateres) set on edge to dry, a hand apart: a long run of thin slabs, a few missing.
      for (let k = 0; k < 7; k++) {
        if (lod === 1 && k % 2) continue;
        y.add('rawClay', colour(slab(0.2, 0.2, 0.06, { bevel: 0.01, seed: 20 + k + sh * 9, wobble: 0.004, tone: 0.1, grime: 0 }), [1, 1, 1], rnd[k]).translate(cx - L / 2 + 0.2 + k * 0.25, F + sh + 0.04, cz));
      }
    }
  }
}

/** A hand barrow (feretrum): a board bed on two long handles, four short legs, loaded with lumps while the pit works. */
function barrow(y, lod) {
  const cx = 2.2;
  const cz = 2.45;
  const lift = F + 0.26;
  for (const s of [-1, 1]) y.add('wood', bx(0.06, 0.06, 2.1, cx + s * 0.33, lift - 0.06, cz, 0.8));
  y.add('wood', bx(0.7, 0.04, 0.95, cx, lift, cz, 0.85));
  if (lod < 2) {
    for (const s of [-1, 1]) for (const e of [-1, 1]) y.add('wood', bx(0.06, 0.2, 0.06, cx + s * 0.33, F, cz + e * 0.35, 0.75));
    for (const e of [-1, 1]) y.add('wood', bx(0.7, 0.14, 0.04, cx, lift + 0.04, cz + e * 0.46, 0.75));
  }
  // Its load, only while the pit is at work (the pit's carriers have just set it down).
  const load = [[0, 0, 0.4], [0.02, -0.2, 0.38], [-0.02, 0.2, 0.36]].map(([dx, dz, w], k) => colour(slab(w, 0.18, 0.34, { bevel: 0.03, seed: 31 + k, wobble: 0.01, tone: 0.12, grime: 0.1 }), [1, 1, 1], 1).translate(cx + dx, lift + 0.04, cz + dz));
  y.add('rawClay', load, 'open');
}

/** Two baskets of clay at the shelter's front. */
function baskets(y, lod) {
  if (lod >= 2) return;
  for (const [x, z, r] of [[1.15, 0.55, 0.27], [1.62, 0.95, 0.24]]) {
    const b = basket(r, 0.3, 1, lod);
    y.add('wicker', b.wicker.translate(x, F, z));
    if (b.fill) y.add('rawClay', colour(b.fill, [1, 1, 1], 0.9).translate(x, F, z));
  }
}

/** The shelter: six posts, the plates and ties, the thatch, the pallet the lumps lie on, the lantern's bracket. */
function shelter(y, lod) {
  const s = P.shelter;
  const posts = [];
  for (const x of [s.x0, s.x1]) for (const z of [s.z0, (s.z0 + s.z1) / 2, s.z1]) posts.push(pole([x, F, z], [x, s.eaveY, z], 0.085, lod, x * 7 + z));
  y.add('wood', posts);
  // Plates along both sides on the posts, and a tie across each end.
  for (const x of [s.x0, s.x1]) y.add('wood', beam([x, s.eaveY - 0.02, s.z0 - 0.1], [x, s.eaveY - 0.02, s.z1 + 0.1], 0.14, x, lod));
  if (lod < 2) for (const z of [s.z0, s.z1]) y.add('wood', beam([s.x0 - 0.1, s.eaveY - 0.16, z], [s.x1 + 0.1, s.eaveY - 0.16, z], 0.1, z + 3, lod));
  const roof = thatchGable({ x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, eaveY: s.eaveY, ridgeY: s.ridgeY, over: 0.24, along: 'z', lod, seed: 41 });
  y.add('thatch', roof.thatch);
  y.add('wood', roof.wood);
  // The pallet: three bearers and boards over them, so the clay lies off the wet ground.
  const p = P.pallet;
  for (const dx of [-0.55, 0, 0.55]) y.add('wood', bx(0.1, 0.1, p.d, p.cx + dx, F, p.cz, 0.75));
  y.add('wood', bx(p.w, 0.04, p.d, p.cx, F + 0.1, p.cz, 0.85));
  // The lantern on a bracket at the front-left post, and the mattocks leaning there while the pit is idle.
  const [lx, ly, lz] = P.lamp;
  y.add('wood', bx(0.3, 0.04, 0.26, lx + 0.1, ly - 0.04, lz - 0.02, 0.8));
  y.lantern(lx + 0.14, ly, lz);
  if (lod < 2) {
    for (const [k, dx] of [[0, 0.1], [1, 0.3], [2, 0.5]]) {
      const base = [s.x1 - 0.5 + dx * 0.5, F, s.z1 + 0.3];
      const tip = [s.x1 - 0.12 + dx * 0.15, 1.35, s.z1 + 0.04];
      y.add('wood', pole(base, tip, 0.02, lod, k), 'shut');
      y.add('iron', bx(0.16, 0.05, 0.035, tip[0], tip[1] - 0.02, tip[2], 0.9), 'shut');
    }
  }
}

/** A few lumps and clods strewn about the pit's rim and the pug bed (the dug clay spilt), and a puddle of slop. */
function litter(y, lod) {
  if (lod >= 1) return;
  const clods = [[-0.9, 0.5], [-3.0, 3.1], [0.4, 2.9], [1.9, 3.2], [-3.9 + 0.2, 0.8], [0.6, -0.4]];
  clods.forEach(([x, z], k) => y.add('rawClay', colour(slab(0.16 + (k % 3) * 0.04, 0.09, 0.14, { bevel: 0.02, seed: 50 + k, wobble: 0.01, tone: 0.15, grime: 0 }), [1, 1, 1], 0.9).translate(x, F, z)));
}

/** Build the clay pit: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildClayPit({ lod = 0, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const y = new Yard('clay_pit', lod);
  // The yard: beaten earth over the whole footprint, a little yellower under the clay's dust.
  y.add('earth', colour(slab(2 * YARD.half - 0.1, F, 2 * YARD.half - 0.1, { bevel: 0.01, seed: 1, wobble: 0, tone: 0, grime: 0 }), lin(0xcdc0a8)));
  pit(y, lod);
  ramp(y, lod);
  pugBed(y, lod);
  racks(y, lod);
  barrow(y, lod);
  baskets(y, lod);
  shelter(y, lod);
  litter(y, lod);
  const m = y.build();
  if (ice) for (const mesh of m.meshes) if (mesh.name === 'water') mesh.material = iceMaterial();
  return m;
}

/**
 * The stock at step 1 to 3 (a third, two thirds, full): lumps of dug clay
 * stacked in layers on the shelter's pallet, each layer smaller than the one
 * under it.
 */
export function buildClayStock(step, { lod = 0 } = {}) {
  const y = new Yard('clay_pit_stock', lod);
  const p = P.pallet;
  const layers = [[3, 4], [3, 4], [3, 3], [2, 3], [2, 2]].slice(0, [0, 1, 3, 5][Math.max(0, Math.min(3, step))]);
  const lumps = blockStack(p.cx, p.cz, F + 0.14, layers, { w: 0.42, h: 0.2, d: 0.5, gap: 0.03, seed: 61, lod, tone: 0.14, grime: 0.05, bevel: 0.05, shift: 0.05 });
  y.add('rawClay', lumps);
  return y.build();
}

/**
 * The pit's people while it is staffed (people/actors.js specs, its metres):
 * two diggers on the pit floor driving mattocks into its walls, a man
 * working the clay in the pug bed with his. Nobody when it is idle.
 */
export function clayPitActors(state) {
  if (state !== 'open') return [];
  const tunic = { body: 'm', dress: ['tunic:short'], hair: 'crop', clip: 'hoe', props: { R: 'hoe' } };
  const b = P.bed;
  return [
    { ...tunic, at: [-0.95, F, -2.0], ry: Math.PI, seed: 301, colours: { tunic: 0x8a7a5a } },
    { ...tunic, hair: 'curls', at: [-0.5, F, -1.4], ry: -Math.PI / 2, seed: 302, colours: { tunic: 0xa8977a } },
    { ...tunic, hair: 'bald', at: [(b.x0 + b.x1) / 2, F, b.z1 + 0.55], ry: Math.PI, seed: 303, colours: { tunic: 0x6e604f } },
  ];
}
