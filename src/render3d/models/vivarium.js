/**
 * models/vivarium.js
 * ----------------------------------------------------------------------------
 * The menagerie (Vivarium) of the 3D look, on a 3 x 3 footprint (12 m):
 * where the beasts for the shows were kept, from the record rather than
 * from the 2D sprite:
 *
 *   - Procopius names Rome's vivarium by the Praenestine gate, where the
 *     beasts were kept for the games; the venationes brought lions,
 *     leopards ("Africanae"), bears and stranger beasts (Pliny VIII,
 *     Martial's book of the shows), and inscriptions name their keepers
 *     (a bear keeper, ursarius; the custodes of the vivarium).
 *   - Cages (caveae) of timber and iron, and travelling cages on carts:
 *     the Great Hunt mosaic of the villa at Piazza Armerina shows beasts
 *     caught in Africa, crated and carried, a crate on a cart drawn by
 *     oxen, a leopard and an antelope hauled aboard ship.
 *
 * So, in 12 m: three cages along the back, each a stone back wall and
 * sides under a tiled lean-to over its rear half (a shelter from sun and
 * rain), its front of iron bars between a timber sill and lintel, straw on
 * its floor, a stone basin of water: a lion pacing his, a lioness at rest
 * in hers, a leopard pacing the third; the bear's yard along the left, a
 * den of stone at its back and a log, behind bars, the bear ambling and
 * rising on his hind feet to scent the air; the keepers' block with a
 * haunch of meat on it and a cleaver, a heap of hay and straw, a trough;
 * the cart with its cage for the journey to the arena, its door open; a
 * low wall, a gate to the street.
 *
 * States (models.js partShows; training.js trainingState):
 *   'open'  staffed: a keeper carrying meat to the lion's cage and pushing
 *           it through the bars, a keeper with a fork of hay, the bear
 *           keeper watching with his staff (vivariumActors: moving)
 *   'out'   staffed, a beast on its way to the arena: the cart gone with
 *           it, the leopard's cage empty, its gate swung open
 *   'shut'  no staff: nobody to feed them; the beasts lie or stand quiet,
 *           the gate shut
 * Tags: 'staffed', 'home' (open or shut: the cart, the third cage's gate),
 * 'out' (that gate open), 'shut'.
 *
 * Metres, the middle at the origin, y up, the gate toward +z.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { slab } from './masonry.js';
import { roofSlope } from './learning.js';
import { DYES } from '../people/actors.js';
import {
  bag, assemble, lamps, enclosure, trough, hayHeap, barsAlongX, barsAlongZ, box, cyl, staff, lin,
} from './trainingParts.js';

/** The menagerie's measures (metres): the tests, the lab and the game read them. */
export const VIVARIUM = Object.freeze({
  half: 6,
  /** The cages' bars (z), their back wall (z), and each cage's x0, x1. */
  barsZ: -3.2,
  backZ: -5.95,
  cages: Object.freeze([Object.freeze([-5.95, -2.0]), Object.freeze([-2.0, 1.95]), Object.freeze([1.95, 5.95])]),
  /** The bear's yard: x0 (its wall), x1 (its bars), z0, z1. */
  bear: Object.freeze([-5.95, -3.25, -0.6, 3.6]),
  /** Each cage's gate (x0, x1) in its bars. */
  gates: Object.freeze([Object.freeze([-2.9, -2.25]), Object.freeze([1.0, 1.65]), Object.freeze([4.95, 5.6])]),
  /** The keepers' block (x, z). */
  block: Object.freeze([0.4, 1.3]),
  /** The cage cart (its middle, its turn). */
  cart: Object.freeze([4.35, 3.85, Math.PI]),
  gate: Object.freeze([1.4, 2.9]),
  lamps: Object.freeze([Object.freeze([1.2, 1.56, 5.82]), Object.freeze([3.1, 1.56, 5.82])]),
});

const V = VIVARIUM;

/** The cages along the back: stone walls, the lean-to over their rear halves, the bars, straw, basins. */
function cages(lod, seed, out) {
  const zb = V.backZ;
  const zf = V.barsZ;
  const h = 2.3;
  const t = 0.3;
  out.ashlar.push(box(11.9, 2.75, t, 0, 0, zb + t / 2, 0.85));
  for (const x of [-5.95 + t / 2, -2.0, 1.95, 5.95 - t / 2]) out.ashlar.push(box(t, h + 0.25, zf - zb, x, 0, (zb + zf) / 2, 0.88));
  // The lean-to over the rear half of every cage.
  const roof = roofSlope([[-6.0, 2.3, -4.8], [6.0, 2.3, -4.8], [6.0, 2.82, zb - 0.05], [-6.0, 2.82, zb - 0.05]], { lod, seed });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // (The beam carrying the roof's eave over the open cage: on the side walls.)
  out.wood.push(box(11.9, 0.16, 0.18, 0, 2.14, -4.85, 0.65));
  V.cages.forEach(([x0, x1], i) => {
    const a = x0 + (i === 0 ? t : t / 2);
    const b = x1 - (i === 2 ? t : t / 2);
    // The timber sill and lintel, the bars between, its gate (the third's opens while its leopard is out).
    out.wood.push(box(b - a, 0.18, 0.2, (a + b) / 2, 0, zf, 0.6), box(b - a, 0.2, 0.22, (a + b) / 2, h, zf, 0.6));
    const [g0, g1] = V.gates[i];
    barsAlongX(out, a + 0.08, g0 - 0.05, 0.18, h, zf, 0.2, 0.018, lod);
    barsAlongX(out, g1 + 0.05, b - 0.08, 0.18, h, zf, 0.2, 0.018, lod);
    const gate = { iron: [] };
    barsAlongX(gate, g0, g1, 0.2, h - 0.05, zf, 0.2, 0.018, lod);
    if (i === 2) out.homeIron.push(...gate.iron);
    else out.iron.push(...gate.iron);
    out.wood.push(box(0.12, h, 0.14, g0 - 0.06, 0.18, zf, 0.55), box(0.12, h, 0.14, g1 + 0.06, 0.18, zf, 0.55));
    // Straw on a floor of sand, a stone basin of water at the side.
    out.straw.push(box(b - a, 0.04, zf - zb - t, (a + b) / 2, 0, (zb + t + zf) / 2, (gx, gy, gz) => 0.75 + 0.25 * Math.sin(gx * 13 + gz * 7)));
    trough(out, b - 0.42, zf - 0.55, 0.6, { w: 0.5, h: 0.32, alongZ: true, seed: seed + i });
  });
  // The leopard's gate swung open into the yard while it is out.
  const open = { iron: [] };
  const [g0, g1] = V.gates[2];
  barsAlongZ(open, zf, zf + (g1 - g0), 0.2, 2.25, g0, 0.2, 0.018, lod);
  out.outIron.push(...open.iron);
}

/** The bear's yard along the left: its wall, the bars along its side to the court and its front, a den of stone, a log. */
function bearYard(lod, seed, out) {
  const [x0, x1, z0, z1] = V.bear;
  const t = 0.3;
  const h = 2.3;
  out.ashlar.push(box(t, 2.6, z1 - z0, x0 + t / 2, 0, (z0 + z1) / 2, 0.85));
  out.wood.push(box(0.2, 0.18, z1 - z0, x1, 0, (z0 + z1) / 2, 0.6), box(0.22, 0.2, z1 - z0, x1, h, (z0 + z1) / 2, 0.6));
  barsAlongZ(out, z0 + 0.1, z1 - 0.1, 0.18, h, x1, 0.2, 0.019, lod);
  out.wood.push(box(x1 - x0, 0.18, 0.2, (x0 + x1) / 2, 0, z1, 0.6), box(x1 - x0, 0.2, 0.22, (x0 + x1) / 2, h, z1, 0.6));
  barsAlongX(out, x0 + t, x1 - 0.1, 0.18, h, z1, 0.2, 0.019, lod);
  // Its back toward the cages: a stone wall to half its height, bars over it.
  out.ashlar.push(box(x1 - x0, 1.0, 0.3, (x0 + x1) / 2, 0, z0, 0.85));
  out.wood.push(box(x1 - x0, 0.2, 0.22, (x0 + x1) / 2, h, z0, 0.6));
  barsAlongX(out, x0 + t, x1 - 0.1, 1.0, h, z0, 0.2, 0.019, lod);
  for (const z of [z0, z1]) out.wood.push(box(0.2, h + 0.2, 0.2, x1, 0, z, 0.5));
  // The yard's floor of trodden earth, the den at its back: a vault of rough stone with its dark mouth.
  out.gravel.push(box(x1 - x0 - t, 0.03, z1 - z0, (x0 + t + x1) / 2, 0.01, (z0 + z1) / 2, 0.7));
  out.ashlar.push(slab(1.5, 1.2, 1.3, { bevel: 0.08, seed: seed + 3, wobble: 0.05, tilt: 0.1, tone: 0.06, grime: 0.5 }).translate(x0 + t + 0.75, 0, z0 + 0.8));
  out.dark.push(box(0.04, 0.75, 0.7, x0 + t + 1.51, 0.02, z0 + 0.8));
  // A log to claw, a basin.
  const log = new CylinderGeometry(0.17, 0.2, 1.7, lod === 0 ? 10 : 6, 1);
  log.rotateZ(Math.PI / 2);
  log.rotateY(0.6);
  log.translate(x0 + 0.95, 0.18, z1 - 0.65);
  out.wood.push(tintGeometry(boxUV(log), (gx, gy) => 0.45 + 0.15 * Math.sin(gx * 30 + gy * 10)));
  trough(out, x0 + 0.75, z0 + 2.2, 0.7, { w: 0.5, h: 0.3, seed: seed + 9 });
}

/** The keepers' things: the block with its haunch and cleaver, hay and straw, a trough by the cages, a barrow. */
function keepers(lod, seed, out) {
  const [bx, bz] = V.block;
  out.wood.push(cyl(0.34, 0.38, 0.72, lod === 0 ? 12 : 7, bx, 0, bz, 0.55));
  out.paint.push(tintGeometry(box(0.42, 0.14, 0.24, bx - 0.04, 0.72, bz, 1), (gx, gy) => (gy > 0.82 ? lin(0xd8b8a0) : lin(0x8a2a20))));
  if (lod < 2) {
    out.iron.push(box(0.03, 0.12, 0.2, bx + 0.18, 0.78, bz + 0.05, 0.9));
    out.wood.push(box(0.03, 0.03, 0.14, bx + 0.18, 0.79, bz + 0.21, 0.6));
    // A basket of meat beside it.
    out.straw.push(cyl(0.26, 0.22, 0.34, lod === 0 ? 10 : 6, bx + 0.6, 0, bz - 0.35, 0.8));
    out.paint.push(tintGeometry(box(0.36, 0.08, 0.3, bx + 0.6, 0.3, bz - 0.35), () => lin(0x7a2a20)));
  }
  hayHeap(out, 4.95, -0.55, 0.85, 0.75, { lod, seed });
  hayHeap(out, 5.3, 0.65, 0.55, 0.5, { lod, seed: seed + 1 });
  trough(out, 4.3, -2.35, 1.4, { seed: seed + 4 });
  if (lod < 2) {
    // A hand barrow of straw by the hay.
    out.wood.push(staff([2.8, 0.35, -0.2], [2.8, 0.3, 1.2], 0.025, 4), staff([3.15, 0.35, -0.2], [3.15, 0.3, 1.2], 0.025, 4), box(0.5, 0.06, 0.8, 2.98, 0.32, 0.5, 0.7));
    out.straw.push(box(0.42, 0.14, 0.7, 2.98, 0.38, 0.5, 0.9));
  }
}

/**
 * The cart with its cage for the journey to the arena (the Great Hunt
 * mosaic's): four solid wheels, a bed of planks, a box of timber posts and
 * iron bars under a roof of boards, its door open at the back; its pole
 * resting on a trestle (the oxen are yoked when it goes). Built along +z,
 * turned onto its place.
 */
function cageCart(lod, seed, out) {
  const [cx, cz, ry] = V.cart;
  const part = { wood: [], iron: [] };
  const R = 0.38;
  for (const [x, z] of [[-0.68, -0.75], [0.68, -0.75], [-0.68, 0.75], [0.68, 0.75]]) {
    const w = new CylinderGeometry(R, R, 0.1, lod === 0 ? 16 : 8, 1);
    w.rotateZ(Math.PI / 2);
    w.translate(x, R, z);
    part.wood.push(tintGeometry(boxUV(w), (px, py, pz) => 0.6 + 0.2 * Math.abs(Math.cos(Math.atan2(py - R, pz - z) * 3))));
    if (lod < 2) {
      const tyre = new CylinderGeometry(R + 0.01, R + 0.01, 0.08, lod === 0 ? 16 : 8, 1, true);
      tyre.rotateZ(Math.PI / 2);
      tyre.translate(x, R, z);
      part.iron.push(tintGeometry(boxUV(tyre)));
    }
  }
  part.wood.push(box(1.3, 0.1, 2.2, 0, R + 0.1, 0, 0.75));
  // The cage: corner posts, a floor and roof of boards, bars on its sides and front, the door open at its back.
  const y0 = R + 0.2;
  const ch = 1.25;
  for (const [x, z] of [[-0.6, -1.0], [0.6, -1.0], [-0.6, 1.0], [0.6, 1.0]]) part.wood.push(box(0.1, ch, 0.1, x, y0, z, 0.55));
  part.wood.push(box(1.3, 0.08, 2.15, 0, y0 + ch, 0, 0.7));
  const bars = { iron: [] };
  barsAlongZ(bars, -0.95, 0.95, y0, y0 + ch, 0.6, 0.13, 0.014, lod);
  barsAlongZ(bars, -0.95, 0.95, y0, y0 + ch, -0.6, 0.13, 0.014, lod);
  barsAlongX(bars, -0.55, 0.55, y0, y0 + ch, 1.0, 0.13, 0.014, lod);
  part.iron.push(...bars.iron);
  const door = { iron: [] };
  barsAlongZ(door, -1.0, -0.0, y0, y0 + ch - 0.05, 0.6, 0.13, 0.014, lod);
  for (const g of door.iron) part.iron.push(g.rotateY(-0.2).translate(0.1, 0, -1.0 + 0.02));
  if (lod < 2) {
    // Straw in it; the pole on its trestle.
    part.wood.push(staff([0, R + 0.08, 1.05], [0, 0.55, 2.6], 0.045, 5), box(0.5, 0.5, 0.1, 0, 0, 2.5, 0.6));
  }
  for (const g of part.wood) out.cartWood.push(g.rotateY(ry).translate(cx, 0, cz));
  for (const g of part.iron) out.cartIron.push(g.rotateY(ry).translate(cx, 0, cz));
  out.cartStraw.push(box(1.1, 0.06, 1.9, 0, y0, 0, 0.85).rotateY(ry).translate(cx, 0, cz));
}

/** Build the menagerie: { group, meshes, triangles }; meshes tagged in userData.when. */
export function buildVivarium({ lod = 0, seed = 461, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bag(['doorOpen', 'doorShut', 'homeIron', 'outIron', 'cartWood', 'cartIron', 'cartStraw']);
  out.gravel.push(box(11.9, 0.025, 11.9, 0, 0, 0, (x, y, z) => 0.82 + 0.14 * Math.cos(x * 0.9) * Math.cos(z * 0.7)));
  cages(lod, seed, out);
  bearYard(lod, seed + 10, out);
  keepers(lod, seed + 20, out);
  cageCart(lod, seed + 30, out);
  // (The right side's wall from the cages to the street; the left closed by the bear's yard and its wall as far as it goes.)
  enclosure(out, { e: 5.95, g0: V.gate[0], g1: V.gate[1], sides: { l: [V.barsZ, 5.95], r: [V.barsZ, 5.95] }, seed });
  const { p, m } = assemble('vivarium', out, lod, { ice });
  p.add('doors', m.wood, out.doorOpen, { when: 'staffed' });
  p.add('doors', m.wood, out.doorShut, { when: 'shut' });
  p.add('cage-gate', m.iron, out.homeIron, { when: 'home', cast: false });
  p.add('cage-gate', m.iron, out.outIron, { when: 'out', cast: false });
  p.add('cart', m.wood, out.cartWood, { when: 'home' });
  p.add('cart-iron', m.iron, lod < 2 ? out.cartIron : [], { when: 'home', cast: false });
  p.add('cart-straw', m.straw, out.cartStraw, { when: 'home', cast: false });
  lamps(p, m, V.lamps, lod);
  // (The beasts and the keepers are actors: vivariumActors.)
  return p.build();
}

/** The beasts' coats: a lion's tawny and his dark mane, a lioness's, a leopard's gold, a brown bear's. */
const COATS = Object.freeze({
  lion: { mantle: 0xc0904e, skin: 0xc0904e, hair: 0x7a5228, trim: 0xe6d0a8, leather: 0x8a5a4a, accent: 0xc8962e },
  lioness: { mantle: 0xc89a5a, skin: 0xc89a5a, hair: 0x3a2412, trim: 0xe8d4ae, leather: 0x8a5a4a, accent: 0xc8962e },
  leopard: { mantle: 0xd0a050, skin: 0xd0a050, hair: 0x1a120a, trim: 0xece0c4, leather: 0x6a4a3a, accent: 0xb8c24a },
  bear: { mantle: 0x6a4a30, skin: 0x6a4a30, hair: 0x3a2818, trim: 0x9a7a58, leather: 0x1a1410, accent: 0x2a1a10 },
});

/**
 * The menagerie's beasts and keepers (people/actors.js specs, its metres:
 * a beast's `beast` its piece). Always: the lion pacing his cage along its
 * bars, stopping at the end to roar (while kept and fed: lying when nobody
 * is there), the lioness at rest, the leopard pacing (gone while 'out'),
 * the bear ambling along his bars and rising at their end. Staffed: a
 * keeper carrying a haunch from the block to the lion's bars and pushing it
 * through; a keeper with a fork of hay; the bear keeper with his staff;
 * with a beast out, only the meat carrier and the bear keeper.
 */
export function vivariumActors(state) {
  const zf = V.barsZ;
  const list = [];
  const kept = state !== 'shut';
  const [l0, l1] = V.cages[0];
  if (kept) {
    list.push({ beast: 'quad:lion', clip: 'lion:walk', at: [l0 + 0.95, 0.05, zf - 0.95], ry: Math.PI / 2, seed: 91, colours: COATS.lion, route: { length: l1 - l0 - 1.9, speed: 0.85, pauseEnd: 6, pauseStart: 4, clipEnd: 'lion:roar', clipStart: 'lion:stand', faceEnd: 0.25, faceStart: -0.4 } });
  } else {
    list.push({ beast: 'quad:lion', clip: 'lion:lie', at: [(l0 + l1) / 2, 0.05, zf - 1.5], ry: 0.5, seed: 91, colours: COATS.lion });
  }
  const [m0, m1] = V.cages[1];
  list.push({ beast: 'quad:lion:maneless', scale: 0.9, clip: 'lion:lie', at: [(m0 + m1) / 2 - 0.3, 0.05, zf - 1.35], ry: -0.6, seed: 92, colours: COATS.lioness });
  if (state !== 'out') {
    const [r0, r1] = V.cages[2];
    if (kept) list.push({ beast: 'quad:leopard', clip: 'leopard:walk', at: [r1 - 0.8, 0.05, zf - 0.8], ry: -Math.PI / 2, seed: 93, colours: COATS.leopard, route: { length: r1 - r0 - 1.6, speed: 0.7, pauseEnd: 3, pauseStart: 5, clipEnd: 'leopard:stand', clipStart: 'leopard:stand', faceEnd: 0.3, faceStart: 0.2 } });
    else list.push({ beast: 'quad:leopard', clip: 'leopard:lie', at: [(r0 + r1) / 2, 0.05, zf - 1.3], ry: -0.3, seed: 93, colours: COATS.leopard });
  }
  const [bx0, bx1, bz0, bz1] = V.bear;
  list.push({ beast: 'quad:bear', clip: kept ? 'bear:walk' : 'bear:stand', at: [bx1 - 0.7, 0.03, bz0 + 1.2], ry: 0, seed: 94, colours: COATS.bear, ...(kept ? { route: { length: 1.9, speed: 0.5, pauseEnd: 7, pauseStart: 5, clipEnd: 'bear:rise', clipStart: 'bear:stand', faceEnd: 0.6, faceStart: Math.PI - 0.5 } } : {}) });
  if (!kept) return list;
  // The meat carrier: from the block to the lion's bars and back.
  const [bx, bz] = V.block;
  const from = [bx - 0.5, bz - 0.3];
  const to = [(l0 + l1) / 2 + 0.4, zf + 0.55];
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  list.push({
    body: 'm', dress: ['tunic:short'], hair: 'crop', beard: 'short', clip: 'carry', props: { L: 'sprop:meat' }, at: [from[0], 0.03, from[1]], ry: Math.atan2(dx, dz), seed: 95,
    colours: { tunic: DYES.brownWool, accent: 0x8a2a20, skin: 0x9a6a4a },
    route: { length: Math.hypot(dx, dz), speed: 0.8, pauseEnd: 4, pauseStart: 4, clipEnd: 'give', clipStart: 'idle', faceEnd: Math.PI, faceStart: Math.atan2(bx - from[0], bz - from[1]) },
  });
  list.push({ body: 'm', dress: ['tunic:short'], hair: 'curls', clip: 'guard', props: { R: 'wprop:staff' }, at: [bx1 + 0.75, 0.03, (bz0 + bz1) / 2 + 0.6], ry: -Math.PI / 2 + 0.2, seed: 96, colours: { tunic: DYES.fawn } });
  if (state === 'open') list.push({ body: 'm', dress: ['tunic:short'], hair: 'crop', clip: 'shoulder', props: { L: 'uprop:furca' }, at: [4.15, 0.03, 0.2], ry: 2.0, seed: 97, colours: { tunic: DYES.oatmeal } });
  return list;
}
