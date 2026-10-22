/**
 * models/ironMine.js
 * ----------------------------------------------------------------------------
 * The iron mine (Ferraria) of the 3D look, on a 2 x 2 footprint (8 m),
 * from what is known of Roman mining and early ironworking, not from the
 * 2D sprite:
 *
 *   - Pliny (Natural History 33.70-76 and 34.41-49) on mining: adits driven
 *     into the hill, timbered with props and sets against the fall, shafts
 *     sunk for air and for winding, lamps in the galleries, the ore carried
 *     out in baskets; and on iron, found everywhere, worked in the bloomery.
 *   - The mines of Rio Tinto and Vipasca (Spain), of the Alps and of Elba
 *     (Ilva, which fed Populonia's furnaces in the Etruscans' day): timber
 *     sets, hand picks and mattocks, hammers and wedges of iron, baskets of
 *     esparto and wicker, windlasses over shafts, spoil heaped at the mouth.
 *   - The bloomery furnace: a stack of clay a man's height or a little more,
 *     charged from the top with ore and charcoal, air blown in through a
 *     clay nozzle (tuyere) by a pair of skin bellows worked by hand; the
 *     bloom, a spongy mass of iron and slag, raked out and hammered on a
 *     block to drive out the slag (Etruscan and Roman sites alike: the
 *     slag heaps of Populonia).
 *
 * So, on 8 m of earth: at the back a rounded bank of earth and weathered
 * rock under grass (a heightfield of facets, industryKit.js bankField), cut
 * sheer across its middle for the adit, dark beds of strata along the cut
 * face, the mouth framed in timber sets with a lantern at the right post;
 * a spoil heap spilling down the bank's right flank; in front of the bank the planked way for the barrow with a
 * wheelbarrow and baskets of ore; at the right the shaft's collar with a
 * windlass on forked posts, the rope hanging a basket; at the front-right
 * the small clay bloomery furnace with its skin bellows and a heap of
 * charcoal, and the hammering block for the bloom; at the front-left the
 * ore stack (the stock) on a plank floor.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the lantern lit, the furnace's tuyere glowing and the
 *           bloom on the block, and (actors, people/) a miner at the adit,
 *           a man winding at the windlass and a man hammering the bloom;
 *           the furnace smokes (a kit of the temples' smoke, models.js)
 *   'shut'  no staff: the picks leaning at the adit's post, the lantern
 *           cold, the furnace out, nobody
 * The stock is a kit for each step (iron_mine:stock:1..3).
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { basket, beam, lin } from './rural.js';
import { WINDLASS } from '../people/clips.js';
import { Yard, YARD, bx, colour, pole, stone, lump, mound, bankField, smooth01, seg, cyl } from './industryKit.js';

const F = YARD.floorY;

/** The mine's measures (metres): the tests, the actors and models.js read them. */
export const IRON_MINE = Object.freeze({
  // The adit: its middle x, the half width between the sets' posts, the clear height, the rock face's z.
  adit: Object.freeze({ x: -1.4, half: 0.72, h: 1.75, face: -1.5 }),
  // The windlass: the shaft's middle x and the roller's z; the roller runs cx +- 0.75 at a man's crank height.
  wind: Object.freeze({ cx: 2.45, z: 0.1, half: 0.75 }),
  // The furnace's foot (x, z) and its top (y), where the smoke leaves.
  furnace: Object.freeze({ x: 0.9, z: 2.3, top: 1.44 }),
  // The hammering block (x, z), its top (y above the street) and the bloom on it.
  block: Object.freeze({ x: 2.45, z: 2.55, top: F + 0.97 }),
  // The ore stack's floor: middle and size.
  ore: Object.freeze({ cx: -2.55, cz: 1.85, w: 2.4, d: 2.4 }),
  /** The lantern on its bracket at the adit's right post (x, y, z). */
  lamp: Object.freeze([-0.52, 1.2, -1.28]),
});

const M = IRON_MINE;
const ROCK = lin(0xa39682);

/** The roller's ends and its height, for the winder's crank (people/clips.js WINDLASS). */
export function mineWindlass() {
  const { cx, z, half } = M.wind;
  return { y: F + WINDLASS.height, z, x0: cx - half, x1: cx + half };
}

/** A smooth lumpiness of two coordinates, for the hill's swell. */
const wave = (x, z, k = 1) => Math.sin(x * 1.7 * k + 0.9) * Math.sin(z * 1.3 * k + 2.1) * 0.55 + Math.sin(x * 3.1 * k + z * 2.3 * k) * 0.3;

/**
 * The bank's height at (x, z): a hill of earth and rock, rounded at the
 * back and shoulders and sloping off to the street in front, cut sheer
 * across the middle for the adit (x from -2.8 to 0, the face at z = -1.55,
 * a 10 cm ramp in the grid).
 */
export function mineHeight(x, z) {
  const edge = smooth01(-3.93, -1.9, x) * smooth01(3.93, 1.9, x);
  const edgeCut = smooth01(-3.93, -3.3, x);
  const back = smooth01(-3.95, -3.2, z);
  const top = 2.75 + 0.45 * Math.sin(x * 0.8 + 0.5) + 0.2 * Math.sin(x * 2.1 + z * 1.3);
  const natural = F + (top + 0.4 * wave(x, z, 1.6) - F) * (1 - smooth01(-2.9, -1.3, z));
  const cut = z < -1.6 ? top : z < -1.5 ? top + (F - top) * ((z + 1.6) / 0.1) : F;
  const w = smooth01(-3.0, -2.7, x) * smooth01(0.2, -0.1, x);
  const h = (natural - F) * edge * (1 - w) + (cut - F) * edgeCut * w;
  return F + Math.min(3.6 - F, Math.max(0, h) * back);
}

/** The rock bank: a rounded outcrop of earth and weathered stone under grass, the adit cut into it, framed in timber. */
function bank(y, lod) {
  const a = M.adit;
  const nx = lod === 0 ? 40 : lod === 1 ? 20 : 10;
  const nz = lod === 0 ? 30 : lod === 1 ? 15 : 8;
  const GRASS = lin(0x72873f);
  const EARTH = lin(0x8d7656);
  const dirt = bankField({
    x0: -3.93, x1: 3.93, z0: -3.9, z1: -0.9, nx, nz, hAt: mineHeight,
    tint(kind, x, yy, z, ny) {
      const n = 0.86 + 0.14 * wave(x * 2, z * 2);
      if (kind === 'cap') {
        const m = Math.min(1, smooth01(0.6, 0.9, 1 - ny) + 0.35 * (wave(x, z, 2) + 0.5));
        return [(GRASS[0] + (EARTH[0] - GRASS[0]) * m) * n, (GRASS[1] + (EARTH[1] - GRASS[1]) * m) * n, (GRASS[2] + (EARTH[2] - GRASS[2]) * m) * n];
      }
      // Steep: weathered rock, banded in beds, browner and darker toward the foot where earth washes down.
      const b = 0.9 + 0.1 * Math.sin(yy * 7 + x * 0.4);
      const k = n * b * (0.6 + 0.4 * smooth01(0, 2, yy));
      return [ROCK[0] * k, ROCK[1] * k, ROCK[2] * k];
    },
  });
  y.add('leaf', dirt.cap);
  y.add('stone', dirt.rock);
  const xl = a.x - a.half;
  const xr = a.x + a.half;
  // The dark of the adit: the mouth painted on the face (a hole in a heightfield is not to be had), a floor in.
  y.add('dark', [bx(a.half * 2, a.h, 0.05, a.x, F, a.face + 0.0, 1), bx(a.half * 2, 0.02, 0.5, a.x, F, a.face + 0.25, 1)]);
  // The strata round the adit: dark beds cut across the sheer face, broken where the mouth is.
  if (lod < 2) {
    const beds = lod === 0 ? [0.5, 1.0, 2.0, 2.35, 2.7] : [1.0, 2.2];
    for (const yy of beds) {
      const top = mineHeight(a.x, -1.7);
      if (yy > top - 0.15) continue;
      // The face is a ramp from z = -1.6 (at the top) to -1.5 (at the foot): the bed sits on it.
      const z = -1.6 + 0.1 * ((top - yy) / (top - F));
      const spans = yy < a.h + 0.1 ? [[-2.75, xl - 0.2], [xr + 0.2, -0.1]] : [[-2.75, -0.1]];
      for (const [x0, x1] of spans) y.add('stone', colour(bx(x1 - x0, 0.035, 0.03, (x0 + x1) / 2, yy, z - 0.005, 1), [1, 1, 1], 0.4));
    }
  }
  // The sets: two posts and a cap at the mouth, a heavy lintel above, props wedged at the feet.
  const sz = a.face + 0.06;
  y.add('wood', [bx(0.18, a.h, 0.18, xl, F, sz, 0.8), bx(0.18, a.h, 0.18, xr, F, sz, 0.8), bx(a.half * 2 + 0.34, 0.2, 0.2, a.x, F + a.h, sz, 0.75)]);
  y.add('wood', bx(a.half * 2 + 0.7, 0.22, 0.26, a.x, F + a.h + 0.2, a.face + 0.1, 0.7));
  if (lod < 2) {
    for (const s of [-1, 1]) y.add('wood', pole([a.x + s * (a.half + 0.55), F, a.face + 0.4], [a.x + s * a.half, F + a.h - 0.1, a.face + 0.1], 0.05, lod, s));
    // The planked way out of the adit and its rails.
    for (let k = 0; k < (lod === 0 ? 7 : 3); k++) y.add('wood', bx(1.0, 0.03, 0.24, a.x, F, a.face + 0.25 + k * (lod === 0 ? 0.28 : 0.65), 0.7 + (k % 3) * 0.08));
    for (const s of [-1, 1]) y.add('wood', bx(0.08, 0.05, 2.2, a.x + s * 0.3, F + 0.03, a.face + 1.15, 0.55));
    // Rocks broken off the bank, and loose at its foot.
    [[-3.4, -1.9, 0.38], [-3.1, -1.4, 0.24], [0.5, -1.7, 0.3], [3.5, -1.3, 0.3]].forEach(([x, z, r], k) => {
      y.add('stone', colour(lump(r, 5 + k, { sy: 0.7, sx: 1.15 }), ROCK, 0.85 + 0.07 * (k % 3)).translate(x, Math.max(F + r * 0.1, mineHeight(x, z) - r * 0.15), z));
    });
  }
  // The lantern, on a bracket of timber from the right post.
  const [lx, ly, lz] = M.lamp;
  y.add('wood', bx(0.3, 0.04, 0.24, lx, ly - 0.04, lz, 0.8));
  y.lantern(lx, ly, lz);
}

/** Spoil tipped from the adit and spilling down the bank's right flank: a heap at the foot and lumps strewn up the slope. */
function spoil(y, lod) {
  y.add('stone', colour(mound(1.15, 0.8, 3, lod), lin(0x8a7a66)).translate(2.35, F, -1.75));
  if (lod < 2) {
    const n = lod === 0 ? 11 : 5;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      // A tongue from high on the slope down to the heap, widening as it falls.
      const x = 1.6 + t * 1.0 + Math.sin(k * 2.3) * (0.1 + t * 0.4);
      const z = -2.5 + t * 1.2 + Math.cos(k * 1.7) * 0.15;
      y.add('ore', colour(lump(0.13 + (k % 3) * 0.04, 40 + k, { sy: 0.8 }), [1, 1, 1], 0.85 + (k % 3) * 0.1).translate(x, Math.max(F + 0.03, mineHeight(x, z) - 0.02), z));
    }
  }
}

/** The shaft's collar, the forked posts, the roller with its rope wound, the rope and the basket hanging. */
function windlass(y, lod) {
  const { cx, z } = M.wind;
  const w = mineWindlass();
  // The collar: a frame of timbers round the hole (the hole a dark floor a little below its rim).
  y.add('wood', [bx(0.1, 0.24, 0.8, cx - 0.45, F, z, 0.75), bx(0.1, 0.24, 0.8, cx + 0.45, F, z, 0.75), bx(0.8, 0.24, 0.1, cx, F, z - 0.35, 0.7), bx(0.8, 0.24, 0.1, cx, F, z + 0.35, 0.7)]);
  y.add('dark', bx(0.8, 0.12, 0.6, cx, F, z, 1));
  // Forked posts on both sides of the collar, braced back to the ground.
  const rr = 0.07;
  for (const s of [-1, 1]) {
    const x = cx + s * 0.55;
    y.add('wood', pole([x, F, z], [x, w.y + 0.12, z], 0.07, lod, s + 4));
    if (lod < 2) {
      y.add('wood', pole([x, F, z - 0.8], [x, w.y, z - 0.03], 0.045, lod, s));
      y.add('wood', bx(0.06, 0.06, 0.28, x, w.y + 0.1, z, 0.8));
    }
  }
  // The roller through the forks, the drum of rope wound on it, and the crank on its right end at rest.
  y.add('wood', tintGeometry(boxUV(cyl([w.x0, w.y, z], [w.x1, w.y, z], rr, rr, seg(lod, 12, 8, 5))), () => 0.9));
  y.add('rope', tintGeometry(boxUV(cyl([cx - 0.15, w.y, z], [cx + 0.15, w.y, z], 0.1, 0.1, seg(lod, 12, 8, 5))), () => 0.9));
  if (lod < 2) {
    y.add('iron', tintGeometry(boxUV(cyl([w.x1, w.y, z], [w.x1 + 0.06, w.y, z], 0.03, 0.03, 8)), () => 0.8), 'always');
    y.add('wood', [bx(0.04, WINDLASS.arm + 0.04, 0.05, w.x1 + 0.03, w.y - WINDLASS.arm - 0.02, z, 0.85), bx(0.34, 0.04, 0.04, w.x1 + 0.2, w.y - WINDLASS.arm - 0.02, z, 0.75)], 'shut');
  }
  // The rope from the drum down to a basket of ore hanging a little over the hole.
  y.add('rope', tintGeometry(boxUV(cyl([cx, w.y, z], [cx, F + 0.42, z], 0.014, 0.014, 5)), () => 0.9));
  if (lod < 2) {
    const b = basket(0.22, 0.26, 1, lod);
    y.add('wicker', b.wicker.translate(cx, F + 0.2, z));
    if (b.fill) y.add('ore', colour(b.fill, [1, 1, 1], 0.85).translate(cx, F + 0.2, z));
  }
}

/** The bloomery: a clay stack on a stone footing, its tuyere and bellows, the charcoal heap and the block the bloom is hammered on. */
function furnace(y, lod) {
  const { x, z, top } = M.furnace;
  const s = seg(lod, 22, 14, 8);
  y.add('stone', colour(revolve(profileOf([[0, 0], [0.82, 0], [0.8, 0.14], [0.72, 0.17], [0, 0.17]]), { segments: s, metres: 0.6 }), ROCK, 0.9).translate(x, F, z));
  const stack = revolve(profileOf([[0, 0.14], [0.62, 0.14], [0.58, 0.3], [0.5, 0.9], [0.36, 1.32], [0.3, top - F - 0.04], [0.2, top - F], [0.16, top - F - 0.1], [0, top - F - 0.2]]), {
    segments: s, metres: 0.6,
    deform: (p, th) => { const k = 1 + 0.025 * Math.sin(th * 5) + 0.02 * Math.sin(th * 3 + 1 + p.y * 3); p.x *= k; p.z *= k; },
  });
  y.add('clay', colour(stack.translate(x, F, z), [0.78, 0.6, 0.52]));
  // A band of hoop (a withy) round its waist, to hold the clay from cracking.
  if (lod < 2) y.add('rope', tintGeometry(boxUV(revolve(profileOf([[0.5, 0.78], [0.54, 0.8], [0.54, 0.86], [0.5, 0.88]]), { segments: s, metres: 0.3 }).translate(x, F, z)), () => 0.85));
  // The tuyere: a clay nozzle through the front wall at the foot, the bellows' two skin bags behind it (toward the street).
  const nz = z + 0.52;
  y.add('clay', tintGeometry(boxUV(cyl([x, F + 0.34, nz + 0.4], [x, F + 0.34, nz - 0.1], 0.05, 0.065, 8)), () => 0.7));
  if (lod < 2) {
    for (const s2 of [-1, 1]) {
      const bag = cyl([x + s2 * 0.2, F + 0.38, nz + 0.8], [x + s2 * 0.04, F + 0.34, nz + 0.4], 0.2, 0.04, seg(lod, 10, 7, 5));
      y.add('hide', tintGeometry(boxUV(bag), () => lin(0xb08c5c)));
      // The board the bag's mouth is worked by, and the handle sticking up.
      y.add('wood', bx(0.34, 0.03, 0.4, x + s2 * 0.2, F + 0.22, nz + 0.8, 0.8));
      y.add('wood', bx(0.04, 0.4, 0.04, x + s2 * 0.2, F + 0.28, nz + 0.95, 0.75));
    }
  }
  // The glow of the nozzle, the bloom on the block and the charcoal lumps at the top, only while the fire is lit.
  y.add('ember', tintGeometry(boxUV(cyl([x, F + 0.34, nz - 0.1], [x, F + 0.34, nz - 0.12], 0.05, 0.05, 8)), () => 1), 'open', false);
  y.add('ember', lump(0.18, 5, { sy: 0.6, sx: 1.2 }).translate(M.block.x, M.block.top, M.block.z), 'open', false);
  y.add('ember', bx(0.28, 0.02, 0.28, x, top - 0.03, z, 1), 'open', false);
  // The charcoal heap beside it, black, and a few tongs and a rake leaning on the furnace.
  y.add('dark', mound(0.55, 0.34, 8, lod).translate(x - 1.3, F, z + 0.3));
  if (lod < 2) {
    y.add('wood', pole([x + 0.8, F, z - 0.15], [x + 0.62, 1.4, z - 0.1], 0.02, lod, 2));
    y.add('iron', bx(0.28, 0.05, 0.04, x + 0.6, 1.36, z - 0.1, 0.9));
  }
  // The block: a squared trunk, a stump of oak, its top where the hammer comes down.
  const b = M.block;
  y.add('wood', bx(0.5, b.top - F, 0.42, b.x, F, b.z, 0.72));
  if (lod < 2) y.add('iron', bx(0.4, 0.03, 0.3, b.x, b.top, b.z, 0.65));
  // Tongs and a pair of lumps of slag by the block.
  if (lod < 2) {
    y.add('iron', bx(0.35, 0.03, 0.05, b.x + 0.55, F, b.z + 0.1, 0.9));
    y.add('stone', colour(lump(0.12, 12, { sy: 0.7 }), lin(0x333030)).translate(b.x + 0.6, F, b.z - 0.3));
    y.add('stone', colour(lump(0.09, 13, { sy: 0.7 }), lin(0x3a3532)).translate(b.x - 0.6, F, b.z - 0.2));
  }
}

/** A wheelbarrow with a load of ore, two baskets of ore, the picks leaning at the adit when no one is at work. */
function tools(y, lod) {
  const a = M.adit;
  // The barrow standing on the planked way, load toward the street.
  const bx0 = a.x + 0.05;
  const bz0 = 0.55;
  y.add('wood', [bx(0.52, 0.06, 0.62, bx0, F + 0.3, bz0 - 0.1, 0.8), bx(0.5, 0.2, 0.04, bx0, F + 0.3, bz0 - 0.41, 0.72), bx(0.04, 0.2, 0.62, bx0 - 0.25, F + 0.3, bz0 - 0.1, 0.72), bx(0.04, 0.2, 0.62, bx0 + 0.25, F + 0.3, bz0 - 0.1, 0.72)]);
  for (const s of [-1, 1]) y.add('wood', bx(0.045, 0.045, 1.2, bx0 + s * 0.24, F + 0.28, bz0 + 0.3, 0.75));
  if (lod < 2) {
    const wheel = cyl([bx0 - 0.04, F + 0.2, bz0 - 0.52], [bx0 + 0.04, F + 0.2, bz0 - 0.52], 0.2, 0.2, seg(lod, 14, 10, 6));
    y.add('wood', tintGeometry(boxUV(wheel), () => 0.8));
    for (let k = 0; k < 4; k++) y.add('ore', colour(lump(0.12 + (k % 2) * 0.03, 70 + k, { sy: 0.8 }), [1, 1, 1], 0.9 + 0.05 * k).translate(bx0 + (k % 2 ? 0.1 : -0.1), F + 0.33, bz0 - 0.1 + (k < 2 ? -0.15 : 0.12)));
  } else {
    y.add('ore', bx(0.4, 0.15, 0.4, bx0, F + 0.33, bz0 - 0.1, 0.9));
  }
  if (lod < 2) {
    for (const [x, z, r] of [[-2.65, -0.85, 0.26], [-3.05, -0.4, 0.22]]) {
      const b = basket(r, 0.3, 1, lod);
      y.add('wicker', b.wicker.translate(x, F, z));
      if (b.fill) y.add('ore', colour(b.fill, [1, 1, 1], 0.85).translate(x, F, z));
    }
    // Picks leaning on the adit's right post and on the left, only while no one is at work with them.
    for (const [k, dx] of [[0, 0.62], [1, 0.82]]) {
      const base = [a.x + a.half + dx, F, a.face + 0.5];
      const tip = [a.x + a.half + 0.12 + dx * 0.1, 1.15, a.face + 0.12];
      y.add('wood', beam(base, tip, 0.04, k, lod), 'shut');
      y.add('iron', bx(0.36, 0.05, 0.05, tip[0], tip[1] - 0.04, tip[2], 0.9), 'shut');
    }
  }
}

/** Build the iron mine: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildIronMine({ lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const y = new Yard('iron_mine', lod);
  // The ground: grey spoil-dusted earth over the whole footprint.
  y.add('earth', colour(stone(2 * YARD.half - 0.1, F, 2 * YARD.half - 0.1, 0, 0, 0, { bevel: 0.01, seed: 3, wobble: 0, tone: 0, grime: 0 }), lin(0xaaa090)));
  bank(y, lod);
  spoil(y, lod);
  windlass(y, lod);
  furnace(y, lod);
  tools(y, lod);
  // The ore stack's floor: a plank platform over bearers, where the stock is heaped.
  const o = M.ore;
  for (const dx of [-0.8, 0, 0.8]) y.add('wood', bx(0.12, 0.1, o.d, o.cx + dx, F, o.cz, 0.7));
  y.add('wood', bx(o.w, 0.04, o.d, o.cx, F + 0.1, o.cz, 0.82));
  return y.build();
}

/** The ore stack at step 1 to 3: a heap of rust-brown lumps on the plank floor, higher and wider with the store. */
export function buildOreStock(step, { lod = 0 } = {}) {
  const y = new Yard('iron_mine_stock', lod);
  const o = M.ore;
  const k = Math.max(1, Math.min(3, step));
  const R = [0.8, 1.05, 1.2][k - 1];
  const h = [0.32, 0.66, 1.0][k - 1];
  const base = F + 0.14;
  y.add('ore', colour(mound(R, h, 15 + k, lod), [1, 1, 1], 0.85).translate(o.cx, base, o.cz));
  const n = lod === 2 ? 0 : [8, 18, 30][k - 1] / (lod === 1 ? 2 : 1);
  for (let i = 0; i < n; i++) {
    const a = i * 2.399 + k;
    const d = Math.sqrt((i + 0.5) / n) * R * 0.92;
    const hy = h * (1 - (d / R) ** 2) * 0.88;
    y.add('ore', colour(lump(0.12 + (i % 4) * 0.025, 90 + i + k * 40, { sy: 0.8 }), [1, 1, 1], 0.75 + (i % 5) * 0.1).translate(o.cx + Math.cos(a) * d, base + hy, o.cz + Math.sin(a) * d));
  }
  return y.build();
}

/**
 * The mine's people while it is staffed (people/actors.js specs, its
 * metres): a miner picking at the adit's face, a man winding the windlass
 * by its crank (the roller's right end: his own crank, the kit's put away),
 * a man hammering the bloom on the block. Nobody when it is idle.
 */
export function ironMineActors(state) {
  if (state !== 'open') return [];
  const a = M.adit;
  const w = mineWindlass();
  const tunic = { body: 'm', dress: ['tunic:short'], hair: 'crop' };
  return [
    { ...tunic, clip: 'hoe', props: { R: 'hoe' }, at: [a.x, F, a.face + 0.7], ry: Math.PI, seed: 321, colours: { tunic: 0x7a6a50 } },
    // Facing -z, the crank's axle WINDLASS.ahead before him and the roller to his left, as the builders' yard.
    { ...tunic, hair: 'curls', clip: 'windlass', props: { R: 'crank' }, at: [w.x1 + WINDLASS.x + 0.06, F, w.z + WINDLASS.ahead], ry: Math.PI, seed: 322, colours: { tunic: 0xa8977a } },
    { ...tunic, hair: 'bald', clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [M.block.x, F, M.block.z - 0.46], ry: 0, seed: 323, colours: { tunic: 0x6e604f } },
  ];
}
