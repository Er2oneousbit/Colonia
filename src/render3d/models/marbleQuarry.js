/**
 * models/marbleQuarry.js
 * ----------------------------------------------------------------------------
 * The marble quarry (Lapicidina) of the 3D look, on a 2 x 2 footprint
 * (8 m), from what is known of how the Romans quarried and dressed
 * stone, not from the 2D sprite:
 *
 *   - Pliny (Natural History 36.2-9 and 36.51) on marble and its quarrying,
 *     Vitruvius (II.7 and X.2) on stone and the hoisting machines.
 *   - The quarries of Luni (Carrara), of Pentelikon and of the Mons
 *     Claudianus: the face worked in benches, a channel cut with the pick
 *     round the block to free it on three sides, a row of wedge holes (in the
 *     Roman way iron wedges, sometimes dry timber ones soaked to swell) along
 *     its foot to split it from the bed, the block lowered or levered onto
 *     the quarry floor, squared with the pick, the point and the claw
 *     chisel, rolled on timbers to the road.
 *   - The shear-legs crane: two timbers lashed at the top, spread at the
 *     foot, a pulley block at the crossing, the rope run down to a windlass
 *     turned by a man at its crank (Vitruvius X.2; Trajan's Column shows
 *     them), the stone lifted by iron tongs (forfices) gripping holes cut in
 *     its sides.
 *
 * So, on 8 m of quarry floor: at the back a hill of weathered limestone
 * under grass (a heightfield of facets, industryKit.js bankField, rounded
 * like the countryside's outcrops), the worked part cut into its left as
 * three sheer steps of fresh white stone, the highest face scored with the
 * saw's kerfs and a row of wedge holes; on the second bench a block half
 * freed, a channel dark behind it, a row of wedges along its top; at the right the shear legs standing over a block hoisted on
 * the tongs, the windlass and its crank between the legs; on the floor two
 * squared blocks on timber rollers with a mason at each, chips and white
 * dust round them; at the right a water trough; at the front-right the
 * store of squared blocks (the stock, a kit for each step).
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the block hoisted on its tongs, the lantern lit, and
 *           (actors, people/) a man at the windlass's crank and two masons
 *           dressing their blocks with mallet and chisel
 *   'shut'  no staff: the block let down onto rollers, the crank hanging,
 *           the lantern cold, nobody
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { TorusGeometry, CircleGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { slab } from './masonry.js';
import { lin } from './rural.js';
import { WINDLASS } from '../people/clips.js';
import { iceMaterial } from '../materials.js';
import { Yard, YARD, bx, colour, pole, stone, lump, blockStack, bankField, smooth01, seg, cyl } from './industryKit.js';

const F = YARD.floorY;

/** The quarry's measures (metres): the tests, the actors and models.js read them. */
export const MARBLE_QUARRY = Object.freeze({
  // The shear legs: their feet (x, z) and where they cross (x, y, z); the roller sits at a man's crank height.
  feet: Object.freeze([Object.freeze([1.2, -1.0]), Object.freeze([2.6, -1.0])]),
  apex: Object.freeze([1.9, 3.3, 0.1]),
  // The two squared blocks on the floor the masons dress: middle x, z, width (x), depth (z), top above the street.
  blocks: Object.freeze([Object.freeze([-2.9, 1.9, 1.3, 0.9]), Object.freeze([-0.7, 1.9, 1.1, 0.9])]),
  top: F + 0.99,
  // The store of squared blocks: middle, a block's size.
  store: Object.freeze({ cx: 2.9, cz: 3.0, w: 0.85, h: 0.42, d: 0.55 }),
  // The trough (middle, x by z).
  trough: Object.freeze({ x: 3.3, z: 0.9, w: 0.6, d: 1.3 }),
  /** The lantern on the post by the windlass (x, y, z). */
  lamp: Object.freeze([3.5, 1.55, -0.55]),
});

const Q = MARBLE_QUARRY;
// The stone's tints: the face a warm off-white, the weathered blocks a little greyer.
const FACE = lin(0xe6d8b6);
const CUT = lin(0xf2e6c8);

/** The roller's axis between the legs at a man's crank height (the tests and the winder read it). */
export function quarryWindlass() {
  const [fa, fb] = Q.feet;
  const [ax, ay, az] = Q.apex;
  const wy = F + WINDLASS.height;
  const t = (wy - F) / (ay - F);
  return { y: wy, z: fa[1] + (az - fa[1]) * t, x0: fa[0] + (ax - fa[0]) * t - 0.1, x1: fb[0] + (ax - fb[0]) * t + 0.1 };
}

/** The quarry's ground: a smooth hash of two coordinates, for the outcrop's lumps. */
const wave = (x, z, k = 1) => Math.sin(x * 1.7 * k + 0.9) * Math.sin(z * 1.3 * k + 2.1) * 0.55 + Math.sin(x * 3.1 * k + z * 2.3 * k) * 0.3;

/** The bank's top at x, before it is cut: the natural back of the hill. */
const hillTop = (x) => 3.45 + 0.32 * Math.sin(x * 0.8 + 1) + 0.12 * Math.sin(x * 2.9);

/**
 * The quarry's height at (x, z): a hill of limestone, rounded at its
 * shoulders and sloping off to the floor in front (the countryside's
 * outcrops), with the worked part cut into it from x = -3.2 to -0.5 in
 * three steps: the top (grass above), a bench 2.5 m up, a bench 1.2 m up,
 * and the floor. Between benches the stone is cut sheer (a 10 cm ramp in
 * the grid, 1.2 m high).
 */
export function quarryHeight(x, z) {
  const edge = smooth01(-3.93, -1.9, x) * smooth01(3.93, 1.9, x);
  const edgeCut = smooth01(-3.93, -3.3, x);
  const back = smooth01(-3.95, -3.2, z);
  const natural = F + (hillTop(x) + 0.4 * wave(x, z, 1.6) - F) * (1 - smooth01(-3.0, -1.3, z)) ;
  const top = Math.min(3.85, hillTop(x));
  const cut = z < -3.1 ? top : z < -3.0 ? top + (2.5 - top) * ((z + 3.1) / 0.1)
    : z < -2.3 ? 2.5 : z < -2.2 ? 2.5 + (1.2 - 2.5) * ((z + 2.3) / 0.1)
      : z < -1.2 ? 1.2 : z < -1.1 ? 1.2 + (F - 1.2) * ((z + 1.2) / 0.1) : F;
  const w = smooth01(-3.3, -3.1, x) * smooth01(-0.3, -0.5, x);
  const h = (natural - F) * edge * (1 - w) + (cut - F) * edgeCut * w;
  return F + Math.min(3.9 - F, Math.max(0, h) * back);
}

/** True where the stone is cut open (the sheer faces and benches of the worked part). */
const isCut = (x, z) => x > -3.3 && x < -0.45 && z > -3.12 && z < -1.08;

/** The outcrop: weathered stone and a grass cap, the worked part cut into it as clean benches of fresh stone. */
function face(y, lod) {
  const nx = lod === 0 ? 40 : lod === 1 ? 20 : 10;
  const nz = lod === 0 ? 30 : lod === 1 ? 15 : 8;
  const GRASS = lin(0x6f8a45);
  const EARTH = lin(0x9a8460);
  const ROCK = lin(0xcbc1a8);
  const bank = bankField({
    x0: -3.93, x1: 3.93, z0: -3.9, z1: -0.9, nx, nz, hAt: quarryHeight,
    freshAt: (x, z) => isCut(x, z),
    tint(kind, x, yy, z, ny) {
      const n = 0.88 + 0.12 * wave(x * 2, z * 2);
      if (kind === 'cap') {
        const m = smooth01(0.6, 0.85, 1 - ny) + 0.3 * (wave(x, z, 2) + 0.5);
        const c = [GRASS[0] + (EARTH[0] - GRASS[0]) * Math.min(1, m), GRASS[1] + (EARTH[1] - GRASS[1]) * Math.min(1, m), GRASS[2] + (EARTH[2] - GRASS[2]) * Math.min(1, m)];
        return [c[0] * n, c[1] * n, c[2] * n];
      }
      if (kind === 'fresh') {
        // Beds: bands of slightly different white up the face, the foot dusted.
        const b = 0.92 + 0.08 * Math.sin(yy * 9 + x * 0.3);
        return [CUT[0] * b * n, CUT[1] * b * n, CUT[2] * b * n];
      }
      const k = n * (0.75 + 0.25 * smooth01(0, 2.5, yy));
      return [ROCK[0] * k, ROCK[1] * k, ROCK[2] * k];
    },
  });
  y.add('leaf', bank.cap);
  y.add('stone', bank.rock);
  y.add('marble', bank.fresh);
  // Boulders and scree broken off the hill at its foot and on its flanks.
  if (lod < 2) {
    [[-3.3, -1.5, 0.4], [3.4, -1.6, 0.45], [3.0, -1.1, 0.28], [-3.45, -2.6, 0.32], [0.7, -1.4, 0.3], [1.0, -1.2, 0.2]].forEach(([x, z, r], k) => {
      y.add('stone', colour(lump(r, 12 + k, { sy: 0.7, sx: 1.2 }), ROCK, 0.8 + 0.08 * (k % 3)).translate(x, Math.max(F + r * 0.1, quarryHeight(x, z) - r * 0.15), z));
    });
  }
  if (lod >= 2) return;
  // The big face (the sheer step from the top to the first bench, z = -3.05, 1.2 m of fresh stone): the
  // saw's vertical kerfs side by side, a row of wedge holes at the head of a lift with iron wedges in some.
  const zf = -3.04;
  const top = (x) => Math.min(3.85, hillTop(x));
  const dark = (g) => colour(g, [1, 1, 1], 0.4);
  for (let k = 0; k < (lod === 0 ? 8 : 3); k++) {
    const x = -3.0 + k * 0.33;
    y.add('marble', dark(bx(0.03, top(x) - 2.5 - 0.15, 0.04, x, 2.55, zf + 0.04, 1)));
  }
  if (lod === 0) {
    for (let k = 0; k < 9; k++) {
      const x = -3.1 + k * 0.3;
      y.add('dark', bx(0.07, 0.07, 0.05, x, top(x) - 0.28, zf + 0.04, 1));
      if (k % 3 !== 1) y.add('iron', bx(0.04, 0.12, 0.04, x, top(x) - 0.2, zf + 0.05, 0.9));
    }
    // The faces below it, a chisel-cut line of drill marks along each bench's edge.
    for (const zz of [-2.24, -1.14]) for (let k = 0; k < 8; k++) y.add('dark', bx(0.05, 0.04, 0.04, -3.0 + k * 0.33, zz === -2.24 ? 1.2 + 1.2 - 0.1 : 1.1, zz + 0.04, 1));
  }
  // The block half freed on the second bench (y 1.2, z -2.2 to -1.2): cut free at the back by a dark channel
  // and at the left end by a groove, still on its bed in front; a row of wedges along its top.
  const bz = -1.72;
  const bt = 1.2;
  y.add('marble', colour(slab(1.7, 0.75, 0.74, { bevel: 0.03, seed: 23, wobble: 0.01, tone: 0.05, grime: 0.15 }), CUT, 0.97).translate(-1.95, bt, bz));
  y.add('dark', [bx(1.9, 0.78, 0.12, -1.95, bt, bz - 0.45, 1), bx(0.1, 0.7, 0.74, -2.88, bt, bz, 1)]);
  for (let k = 0; k < 5; k++) {
    const x = -2.5 + k * 0.28;
    y.add('dark', bx(0.07, 0.02, 0.05, x, bt + 0.75, bz - 0.15, 1));
    if (k < 3) y.add('iron', bx(0.05, 0.1, 0.035, x, bt + 0.75, bz - 0.15, 0.9));
  }
  y.add('iron', bx(0.04, 0.04, 1.1, -1.6, bt + 0.75, bz + 0.15, 0.85));
}

/** The shear legs with their lashing, pulley, stays, windlass, and the block hoisted on its tongs (open) or let down (shut). */
function crane(y, lod) {
  const [fa, fb] = Q.feet;
  const [ax, ay, az] = Q.apex;
  const A = [ax, ay, az];
  for (const [k, f] of [fa, fb].entries()) {
    const d = [ax - f[0], ay - F, az - f[1]];
    const len = Math.hypot(...d);
    const end = [ax + (d[0] / len) * 0.25, ay + (d[1] / len) * 0.25, az + (d[2] / len) * 0.25];
    y.add('wood', pole([f[0], F, f[1]], end, 0.09, lod, k + 3));
    y.add('stone', stone(0.34, 0.06, 0.34, f[0], F, f[1], { bevel: 0.012, seed: 30 + k, wobble: 0.006, tone: 0.08, grime: 0.4 }));
  }
  if (lod < 2) {
    for (let k = 0; k < (lod ? 2 : 4); k++) {
      const c = new TorusGeometry(0.12, 0.02, lod ? 4 : 6, lod ? 10 : 16);
      c.rotateY(Math.PI / 2);
      c.rotateZ(0.2 * (k - 1.5));
      c.translate(ax, ay - 0.04 + k * 0.035, az);
      y.add('rope', tintGeometry(boxUV(c), () => 0.85));
    }
  }
  // The pulley under the crossing, and the back stay to a stake on the landing.
  const py = ay - 0.38;
  y.add('rope', tintGeometry(boxUV(cyl([ax, ay - 0.04, az], [ax, py + 0.13, az], 0.016, 0.016, 5)), () => 0.9));
  for (const s of [-1, 1]) y.add('wood', bx(0.035, 0.24, 0.2, ax + s * 0.04, py - 0.12, az, 0.8));
  if (lod < 2) {
    const stake = [ax, quarryHeight(ax, -2.1) - 0.2, -2.1];
    y.add('rope', tintGeometry(boxUV(cyl(A, [stake[0], stake[1] + 0.3, stake[2]], 0.011, 0.011, 4)), () => 0.9));
    y.add('wood', bx(0.06, 0.4, 0.06, stake[0], stake[1] - 0.05, stake[2], 0.8));
  }
  // The windlass between the legs: the roller, the drum with the rope wound, the crank hanging at rest.
  const w = quarryWindlass();
  y.add('wood', tintGeometry(boxUV(cyl([w.x0, w.y, w.z], [w.x1, w.y, w.z], 0.06, 0.06, seg(lod, 12, 8, 5))), () => 0.9));
  y.add('rope', tintGeometry(boxUV(cyl([ax - 0.15, w.y, w.z], [ax + 0.15, w.y, w.z], 0.085, 0.085, seg(lod, 12, 8, 5))), () => 0.9));
  if (lod < 2) {
    y.add('iron', tintGeometry(boxUV(cyl([w.x1, w.y, w.z], [w.x1 + 0.06, w.y, w.z], 0.03, 0.03, 8)), () => 0.8));
    y.add('wood', [bx(0.04, WINDLASS.arm + 0.04, 0.05, w.x1 + 0.03, w.y - WINDLASS.arm - 0.02, w.z, 0.85), bx(0.38, 0.04, 0.04, w.x1 + 0.2, w.y - WINDLASS.arm - 0.02, w.z, 0.75)], 'shut');
  }
  // The block: hoisted by the tongs, or on two rollers on the floor.
  const bw = 0.68;
  const bh = 0.44;
  const bd = 0.5;
  for (const [state, by] of [['open', 1.3], ['shut', F + 0.13]]) {
    y.add('marble', colour(slab(bw, bh, bd, { bevel: 0.025, seed: 27, wobble: 0.008, tone: 0.05, grime: 0.15 }), CUT, 0.97).translate(ax, by, az), state);
    const topY = by + bh;
    if (lod < 2) {
      for (const s of [-1, 1]) y.add('iron', tintGeometry(boxUV(cyl([ax, topY + 0.4, az], [ax + s * (bw / 2 + 0.03), topY - 0.14, az], 0.014, 0.014, 4)), () => 0.9), state);
    }
    y.add('rope', tintGeometry(boxUV(cyl([ax, w.y + 0.08, w.z], [ax, py - 0.02, az - 0.075], 0.012, 0.012, 4)), () => 0.9), state);
    y.add('rope', tintGeometry(boxUV(cyl([ax, py, az + 0.075], [ax, topY + 0.42, az + 0.005], 0.012, 0.012, 4)), () => 0.9), state);
    if (state === 'shut') {
      for (const dz of [-0.14, 0.14]) y.add('wood', tintGeometry(boxUV(cyl([ax - bw / 2 - 0.1, F + 0.06, az + dz], [ax + bw / 2 + 0.1, F + 0.06, az + dz], 0.06, 0.06, seg(lod, 10, 6, 4))), () => 0.8), 'shut');
    }
  }
}

/** The two squared blocks the masons dress, on timber rollers, with chips and dust round them. */
function floorBlocks(y, lod) {
  Q.blocks.forEach(([cx, cz, w, d], k) => {
    const h = Q.top - F - 0.12;
    y.add('marble', colour(slab(w, h, d, { bevel: 0.025, seed: 40 + k, wobble: 0.008, tone: 0.06, grime: 0.12 }), CUT, 0.96 - k * 0.04).translate(cx, F + 0.12, cz));
    for (const dz of [-0.26, 0.26]) y.add('wood', tintGeometry(boxUV(cyl([cx - w / 2 - 0.15, F + 0.06, cz + dz], [cx + w / 2 + 0.15, F + 0.06, cz + dz], 0.06, 0.06, seg(lod, 10, 6, 4))), () => 0.8));
    // The claw chisel's marks along the top's edge, a line struck with a chalked cord, a mallet laid by.
    if (lod < 2) {
      y.add('dark', bx(w - 0.2, 0.004, 0.012, cx, Q.top + 0.001, cz - d / 2 + 0.2, 1));
      y.add('wood', [bx(0.14, 0.12, 0.12, cx + w / 2 - 0.25, Q.top, cz + 0.1, 0.8), bx(0.26, 0.03, 0.03, cx + w / 2 - 0.1, Q.top + 0.04, cz + 0.1, 0.75)]);
    }
  });
  // White chips of the dressing and a drift of stone dust over the floor about the blocks.
  if (lod === 0) {
    for (let k = 0; k < 34; k++) {
      const a = k * 2.399;
      const r = 0.5 + (k % 7) * 0.26;
      const x = Math.max(-3.85, Math.min(3.85, -1.8 + Math.cos(a) * r * 1.5));
      const z = Math.max(-0.6, Math.min(3.85, 1.9 + Math.sin(a) * r * 0.8));
      y.add('marble', colour(lump(0.035 + (k % 3) * 0.015, 90 + k, { sy: 0.4, detail: 0 }), CUT, 0.9).translate(x, F, z), 'always', false);
    }
  }
  const dust = new CircleGeometry(1, seg(lod, 20, 12, 6));
  dust.rotateX(-Math.PI / 2);
  dust.scale(2.0, 1, 1.3);
  dust.translate(-1.8, F + 0.004, 1.9);
  y.add('marble', colour(tintGeometry(boxUV(dust)), lin(0xf0e6cc), 0.95), 'always', false);
}

/** The water trough with its pail: planks and a pool, cool water kept to wet the saw and the cut. */
function trough(y, lod) {
  const t = Q.trough;
  y.add('wood', [bx(t.w, 0.04, t.d, t.x, F + 0.18, t.z, 0.75), bx(0.05, 0.3, t.d, t.x - t.w / 2 + 0.025, F + 0.2, t.z, 0.8), bx(0.05, 0.3, t.d, t.x + t.w / 2 - 0.025, F + 0.2, t.z, 0.8), bx(t.w, 0.3, 0.05, t.x, F + 0.2, t.z - t.d / 2 + 0.025, 0.78), bx(t.w, 0.3, 0.05, t.x, F + 0.2, t.z + t.d / 2 - 0.025, 0.78)]);
  for (const dz of [-0.45, 0.45]) y.add('wood', bx(0.5, 0.18, 0.08, t.x, F, t.z + dz, 0.7));
  y.add('water', bx(t.w - 0.12, 0.01, t.d - 0.12, t.x, F + 0.41, t.z, 1), 'always', false);
  if (lod < 2) {
    const pail = cyl([t.x - 0.8, F, t.z + 0.4], [t.x - 0.8, F + 0.28, t.z + 0.4], 0.12, 0.15, seg(lod, 10, 7, 5));
    y.add('wood', tintGeometry(boxUV(pail), () => 0.8));
  }
}

/** A post with the lantern's bracket, by the windlass. */
function lamp(y, lod) {
  const [lx, ly, lz] = Q.lamp;
  y.add('wood', pole([lx, F, lz], [lx, ly - 0.05, lz], 0.05, lod, 9));
  y.add('wood', bx(0.28, 0.04, 0.24, lx, ly - 0.08, lz, 0.8));
  y.lantern(lx, ly - 0.04, lz);
}

/** The timber bearers the store of blocks lies on (always there, with or without blocks). */
function bearers(y) {
  const s = Q.store;
  for (const dz of [-0.5, 0.5]) y.add('wood', bx(1.9, 0.1, 0.14, s.cx, F, s.cz + dz * 0.8, 0.72));
}

/** Build the quarry: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildMarbleQuarry({ lod = 0, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const y = new Yard('marble_quarry', lod);
  // The floor: beaten, whitened with the dust of the work.
  y.add('earth', colour(slab(2 * YARD.half - 0.1, F, 2 * YARD.half - 0.1, { bevel: 0.01, seed: 4, wobble: 0, tone: 0, grime: 0 }), lin(0xcfc6b0)));
  face(y, lod);
  crane(y, lod);
  floorBlocks(y, lod);
  trough(y, lod);
  lamp(y, lod);
  bearers(y);
  const m = y.build();
  if (ice) for (const mesh of m.meshes) if (mesh.name === 'water') mesh.material = iceMaterial();
  return m;
}

/** The store at step 1 to 3 (a third, two thirds, full): squared blocks laid in courses on their bearers, 2, 4 then 8. */
export function buildQuarryStock(step, { lod = 0 } = {}) {
  const y = new Yard('marble_quarry_stock', lod);
  const s = Q.store;
  const layers = [[[2, 1]], [[2, 1], [2, 1]], [[2, 2], [2, 1], [2, 1]]][Math.max(1, Math.min(3, step)) - 1];
  y.add('marble', blockStack(s.cx, s.cz, F + 0.1, layers, { w: s.w, h: s.h, d: s.d, gap: 0.06, seed: 80, lod, tone: 0.05, grime: 0.12, bevel: 0.025, shift: 0.05 }).map((g) => colour(g, CUT, 0.96)));
  return y.build();
}

/**
 * The quarry's people while it is staffed (people/actors.js specs, its
 * metres): a man turning the windlass by its crank (the roller's right end:
 * his own crank, the kit's put away), two masons dressing their blocks
 * with mallet and chisel. Nobody when it is idle.
 */
export function marbleQuarryActors(state) {
  if (state !== 'open') return [];
  const w = quarryWindlass();
  const tunic = { body: 'm', dress: ['tunic:short'], hair: 'crop' };
  return [
    { ...tunic, hair: 'curls', clip: 'windlass', props: { R: 'crank' }, at: [w.x1 + WINDLASS.x + 0.06, F, w.z + WINDLASS.ahead], ry: Math.PI, seed: 331, colours: { tunic: 0xa8977a } },
    ...Q.blocks.map(([cx, cz, , d], k) => ({ ...tunic, hair: k ? 'bald' : 'crop', clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [cx, F, cz - d / 2 - 0.3], ry: 0, seed: 332 + k, colours: { tunic: k ? 0x6e604f : 0x8a7a5a } })),
  ];
}
