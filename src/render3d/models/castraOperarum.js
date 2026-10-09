/**
 * models/castraOperarum.js
 * ----------------------------------------------------------------------------
 * The work camp (Castra Operarum) of the 3D look: the builders' camp of a
 * great work, on a 3 x 3 footprint (12 m), from what is known of Roman
 * building yards and camps rather than from the 2D sprite:
 *
 *   - A great public work was let to a contractor (redemptor), who kept a
 *     yard by the site: sheds where the stone was dressed and the timber
 *     cut, as the marble yards at Ostia's Portus and the masons' workshops
 *     found by Rome's great works show (half-finished capitals and column
 *     drums, chips heaped round the bankers), and stores of what the carts
 *     brought.
 *   - The crews lodged in the camp's tents: the army's leather tents
 *     (papiliones, eight men to one) are known from the goatskin panels
 *     found at Vindolanda and Bar Hill, a ridge on two poles, guyed to
 *     pegs; the legions built roads, aqueducts and walls, and lent their
 *     tents and their engineers to civil works.
 *   - The clerk's office: a timber hut with a table under an awning, the
 *     plans drawn on it (marble plans of buildings survive, Rome's Forma
 *     Urbis among them; working drawings were scratched on walls and
 *     floors, as the full-size elevation of a pediment in front of the
 *     Mausoleum of Augustus), a groma standing by.
 *   - A kitchen fire with a cauldron on a tripod, water in amphorae and a
 *     big jar, the food in sacks and baskets; ox wagons (plaustra, solid
 *     wheels) parked in the yard when not on the road.
 *
 * So, on 12 m square of beaten earth: along the back the long shed open to
 * the yard, the masons' bay (a banker with a block being dressed, ashlar,
 * a drum half fluted, the stone saw) and the carpenters' (a beam on
 * trestles, planks, a sawpit's frame saw); on the left two tents of hide;
 * on the right the parked wagons and, at the front, the clerk's hut with
 * its table of plans and the groma; the kitchen fire, the jars and the
 * stores at the front left; a rail fence round the sides and front, the
 * gate in the middle under a board CASTRA OPERARVM, a brazier on each post.
 *
 * States (models.js partShows tags):
 *   'open'  staffed, the crew at home (resting at the fire, at work in the
 *           sheds): the fire and the braziers lit
 *   'out'   staffed, the crew at the site or on the road: the clerk, the
 *           cook and a carpenter left
 *   'shut'  no staff: nobody, the fire cold, the braziers out
 * and its supply (a key of its own, models/monumentModels.js): short of
 * food, the larder's sacks gone and the kitchen fire out; short of water,
 * the jars empty and one tipped over.
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, ConeGeometry, IcosahedronGeometry } from 'three';
import { boxUV, tintGeometry, tube, revolve, profileOf } from '../shapes.js';
import { material } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab, lantern, lanternPane, inscription, TaggedParts } from './masonry.js';
import { leanTo, beam, lin, railFence, cart, jar, sack, basket } from './rural.js';
import { hearthFire } from './sacra.js';
import { healthMaterials } from './healing.js';
import { MORTAR, SEAT_H } from '../people/clips.js';
import { crewMason, crewCarrier, crewForeman } from './worksite.js';

/** The camp's measures (metres): the tests, the lab and the game read them. */
export const CAMP3D = Object.freeze({
  half: 6,
  floorY: 0.04,
  // The shed along the back: its back wall's outer face, its front posts' line, its roof's top and eave.
  shed: Object.freeze({ x0: -5.8, x1: 5.8, z0: -5.8, z1: -3.0, topY: 3.3, eaveY: 2.55 }),
  // The two tents (their middles; the ridge along z), their length, width and ridge height.
  tents: Object.freeze([Object.freeze([-4.4, -0.7]), Object.freeze([-2.0, -0.7])]),
  tent: Object.freeze({ L: 2.9, W: 2.1, H: 1.85 }),
  // The wagons' places (x, z of the bed's middle), facing +z, their poles on the ground.
  wagons: Object.freeze([Object.freeze([1.1, -1.5]), Object.freeze([2.75, -1.5]), Object.freeze([4.4, -1.5])]),
  // The clerk's hut, its awning and the table of plans before it.
  hut: Object.freeze({ x0: 2.2, x1: 5.5, z0: 1.4, z1: 3.7, topY: 2.6, eaveY: 2.15 }),
  table: Object.freeze([3.6, 4.75]),
  groma: Object.freeze([5.2, 5.2, 1.74]),
  // The kitchen's fire, its cauldron's rim (at the stir clip's MORTAR height), the jars, the stores.
  hearth: Object.freeze([-2.7, 3.2]),
  jars: Object.freeze([-4.9, 4.7]),
  stores: Object.freeze([-0.8, 4.9]),
  // The gate posts in the front fence (x), the braziers on them, the board over them.
  gate: Object.freeze({ x: 1.25, z: 5.72, h: 2.35 }),
  // The masons' banker and the carpenters' trestles (x, z).
  banker: Object.freeze([-3.4, -4.0]),
  trestle: Object.freeze([2.8, -4.1]),
});

const C = CAMP3D;

/** The supply's looks: fed and watered, short of food, short of water, short of both. */
export const CAMP_SUPPLY = Object.freeze(['ok', 'hungry', 'dry', 'both']);

/** The braziers' flames on the gate posts, and the kitchen fire: the lamps of the night (models.js modelLamps). */
export const CAMP_LAMPS = Object.freeze([
  Object.freeze([-C.gate.x, C.gate.h + 0.35, C.gate.z + 0.05, 1]),
  Object.freeze([C.gate.x, C.gate.h + 0.35, C.gate.z + 0.05, 1]),
]);
export const CAMP_HEARTH_LAMP = Object.freeze([C.hearth[0], 0.5, C.hearth[1], 1]);

/** A box w x h x d, its foot at (x, y, z), UVs in metres, a vertex tone k. */
function box(w, h, d, x, y, z, k = 1) {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return tintGeometry(boxUV(g), () => k);
}

/** A cylinder (radii rt, rb, height h) standing on (x, y, z). */
function cyl(rt, rb, h, seg, x, y, z, k = 1) {
  const g = new CylinderGeometry(rt, rb, h, seg, 1);
  g.translate(x, y + h / 2, z);
  return tintGeometry(boxUV(g), () => k);
}

/** A wall of vertical planks from (x0, z0) to (x1, z1), h tall, its boards' tones alternating. */
function planks(x0, z0, x1, z1, h, lod, seed, out) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const yaw = Math.atan2(z1 - z0, x1 - x0);
  const n = lod === 0 ? Math.round(len / 0.26) : 1;
  const rnd = artRng(seed);
  for (let i = 0; i < n; i++) {
    const w = len / n;
    const hh = h - (lod === 0 ? rnd() * 0.06 : 0);
    const g = new BoxGeometry(w - (lod === 0 ? 0.01 : 0), hh, 0.05);
    g.translate(-len / 2 + w * (i + 0.5), hh / 2, 0);
    g.rotateY(-yaw);
    g.translate((x0 + x1) / 2, C.floorY, (z0 + z1) / 2);
    out.push(tintGeometry(boxUV(g), (x, y) => (0.72 + 0.16 * ((i * 0.618) % 1)) * (0.8 + 0.2 * Math.min(1, y / 0.5))));
  }
}

/** The long shed along the back: plank walls, the posts, the tiled lean-to, the two bays' fittings. */
function shed(lod, seed, out) {
  const { x0, x1, z0, z1, topY, eaveY } = C.shed;
  planks(x0, z0 + 0.03, x1, z0 + 0.03, topY - 0.05, lod, seed, out.boards);
  planks(x0 + 0.03, z0, x0 + 0.03, z1, (topY + eaveY) / 2 - 0.15, lod, seed + 1, out.boards);
  planks(x1 - 0.03, z0, x1 - 0.03, z1, (topY + eaveY) / 2 - 0.15, lod, seed + 2, out.boards);
  // The partition between the bays, half its depth.
  planks(0, z0, 0, z0 + 1.5, topY - 0.3, lod, seed + 3, out.boards);
  // The posts on stone pads along the open front, the beam over them.
  for (const x of [x0 + 0.1, -2.9, 0, 2.9, x1 - 0.1]) {
    out.wood.push(box(0.18, eaveY - 0.18 - C.floorY, 0.18, x, C.floorY, z1 - 0.1, 0.8));
    out.stone.push(slab(0.32, 0.1, 0.32, { bevel: 0.01, seed: seed + x * 7, wobble: 0.004, tone: 0.06, grime: 0.4 }).translate(x, 0, z1 - 0.1));
  }
  out.wood.push(slab(x1 - x0 + 0.1, 0.2, 0.2, { bevel: 0.01, seed: seed + 5, wobble: 0.002, tone: 0.06, grime: 0 }).translate(0, eaveY - 0.2, z1 - 0.1));
  const roof = leanTo({ L: x1 - x0 + 0.3, span: z1 - z0, topY, eaveY, lod, seed: seed + 6, over: 0.35 });
  for (const g of roof.tile) out.tile.push(g.translate(0, 0, z0));
  for (const g of roof.wood) out.wood.push(g.translate(0, 0, z0));
  // The floor under it: earth darkened by shade, chips and sawdust.
  out.shade.push(box(x1 - x0 - 0.1, 0.008, z1 - z0 - 0.1, 0, C.floorY, (z0 + z1) / 2, 0.55));
}

/** The masons' bay: the banker with its block, ashlar, a drum half fluted, a capital roughed out, chips. */
function masonsBay(lod, seed, out) {
  const [bx, bz] = C.banker;
  const y0 = C.floorY;
  // The banker: a slab on two stone legs, the block on it at a mason's chisel height (people/clips.js hammer).
  for (const s of [-1, 1]) out.tufa.push(slab(0.3, 0.5, 0.6, { bevel: 0.015, seed: seed + s, wobble: 0.006, tone: 0.06, grime: 0.4 }).translate(bx + s * 0.45, y0, bz));
  out.tufa.push(slab(1.3, 0.12, 0.7, { bevel: 0.015, seed: seed + 3, wobble: 0.004, tone: 0.05, grime: 0.3 }).translate(bx, y0 + 0.5, bz));
  out.marble.push(slab(0.75, 0.32, 0.5, { bevel: 0.012, seed: seed + 4, wobble: 0.004, tone: 0.04, grime: 0.05 }).translate(bx, y0 + 0.62, bz));
  // Ashlar stacked against the back wall; a column drum half fluted; a capital roughed out.
  for (let k = 0; k < (lod === 2 ? 2 : 4); k++) out.marble.push(slab(0.9, 0.42, 0.55, { bevel: 0.015, seed: seed + 10 + k, wobble: 0.006, tone: 0.05, grime: 0.15 }).translate(-5.0 + (k % 2) * 0.95, y0 + Math.floor(k / 2) * 0.42, -5.3));
  const flutes = lod === 0 ? 20 : 0;
  const drum = revolve(profileOf([[0, 0], [0.4, 0], [0.4, 0.62], [0, 0.62]]), {
    segments: lod === 0 ? 40 : lod === 1 ? 16 : 10, metres: 1,
    deform: flutes ? (p, th) => { if (p.y > 0.3) { const k = 1 - 0.035 * Math.max(0, Math.cos(th * flutes)) ** 4; p.x *= k; p.z *= k; } } : null,
  });
  out.marble.push(drum.translate(-1.6, y0, -5.0));
  if (lod < 2) {
    // A Corinthian capital roughed out: a bell under its square abacus, the leaves not yet cut.
    out.marble.push(revolve(profileOf([[0, 0], [0.3, 0], [0.32, 0.12], [0.4, 0.42], [0, 0.42]]), { segments: lod ? 10 : 20, metres: 1 }).translate(-1.4, y0, -3.9));
    out.marble.push(box(0.92, 0.12, 0.92, -1.4, y0 + 0.42, -3.9, 0.95));
  }
  // The stone saw: a toothless blade in a frame, fed sand and water, across a block on the floor.
  out.marble.push(slab(1.1, 0.5, 0.6, { bevel: 0.01, seed: seed + 20, wobble: 0.004, tone: 0.05, grime: 0.1 }).translate(-4.6, y0, -3.7));
  if (lod < 2) {
    out.wood.push(box(1.5, 0.05, 0.05, -4.6, y0 + 0.95, -3.7, 0.8));
    for (const s of [-1, 1]) out.wood.push(box(0.05, 0.6, 0.05, -4.6 + s * 0.72, y0 + 0.4, -3.7, 0.8));
    out.iron.push(box(1.4, 0.06, 0.006, -4.6, y0 + 0.47, -3.7, 0.7));
  }
  // Chips heaped round the banker.
  if (lod === 0) {
    const rnd = artRng(seed + 30);
    for (let k = 0; k < 40; k++) {
      const g = new IcosahedronGeometry(0.02 + rnd() * 0.03, 0);
      g.scale(1, 0.4, 1);
      const a = rnd() * Math.PI * 2;
      const r = 0.5 + rnd() * 0.7;
      g.translate(bx + Math.cos(a) * r, y0 + 0.01, bz + Math.sin(a) * r * 0.6);
      out.chips.push(tintGeometry(boxUV(g), () => 0.85 + rnd() * 0.2));
    }
  }
}

/** The carpenters' bay: a beam on trestles being mortised, planks against the wall, a bench, a frame saw. */
function carpentersBay(lod, seed, out) {
  const [tx, tz] = C.trestle;
  const y0 = C.floorY;
  for (const s of [-1, 1]) {
    // A trestle: a bar on splayed legs.
    out.wood.push(box(0.12, 0.12, 0.7, tx + s * 1.1, y0 + 0.62, tz, 0.78));
    if (lod < 2) for (const d of [-1, 1]) out.wood.push(beam([tx + s * 1.1, y0, tz + d * 0.38], [tx + s * 1.1, y0 + 0.64, tz + d * 0.15], 0.06, seed + s + d, lod));
    else out.wood.push(box(0.08, 0.62, 0.5, tx + s * 1.1, y0, tz, 0.75));
  }
  out.timber.push(slab(3.2, 0.24, 0.26, { bevel: 0.012, seed: seed + 3, wobble: 0.003, tone: 0.08, grime: 0 }).translate(tx, y0 + 0.74, tz));
  // Planks leaning on the back wall and a stack of them.
  if (lod < 2) for (let k = 0; k < 6; k++) out.timber.push(box(0.26, 2.3, 0.04, 1.2 + k * 0.3, 0, 0, 0.75 + 0.1 * (k % 2)).rotateX(-0.18).translate(0, y0, -5.55));
  for (let k = 0; k < (lod === 2 ? 1 : 5); k++) out.timber.push(box(2.6, 0.05, 0.28, 4.4, y0 + 0.1 + k * 0.05, -5.0 + (k % 2) * 0.05, 0.8 + 0.08 * (k % 2)));
  out.wood.push(box(0.12, 0.1, 0.6, 3.5, y0, -5.0, 0.7), box(0.12, 0.1, 0.6, 5.3, y0, -5.0, 0.7));
  // The bench along the partition, a frame saw and an adze on it.
  out.wood.push(slab(1.6, 0.08, 0.5, { bevel: 0.01, seed: seed + 8, wobble: 0.002, tone: 0.06, grime: 0 }).translate(0.95, y0 + 0.78, -4.9));
  for (const [x, z] of [[0.3, -5.1], [1.6, -5.1], [0.3, -4.7], [1.6, -4.7]]) out.wood.push(box(0.07, 0.78, 0.07, x, y0, z, 0.8));
  if (lod < 2) {
    out.wood.push(box(0.7, 0.03, 0.03, 0.9, y0 + 0.86, -4.75), box(0.03, 0.03, 0.3, 0.57, y0 + 0.86, -4.9), box(0.03, 0.03, 0.3, 1.23, y0 + 0.86, -4.9));
    out.iron.push(box(0.68, 0.006, 0.035, 0.9, y0 + 0.87, -5.03));
  }
  // Sawdust and shavings under the beam.
  if (lod === 0) out.sawdust.push(box(2.4, 0.01, 1.0, tx, y0, tz, 0.95));
}

/** A ridge tent of goatskin panels on two poles, guyed to pegs, its front flap tied back; in its own frame (ridge along z). */
function tent(lod, seed, out) {
  const { L, W, H } = C.tent;
  const wall = 0.35;
  // The two roof slopes and the low side walls, as one strip each side: panels in the tones of the hides.
  for (const s of [-1, 1]) {
    const len = Math.hypot(W / 2, H - wall);
    const g = new BoxGeometry(0.05, len, L, 1, 1, lod === 0 ? 10 : 2);
    g.translate(0, len / 2, 0);
    g.rotateZ(s * Math.atan2(W / 2, H - wall));
    g.translate(s * W / 2, wall, 0);
    // (Its goatskin panels a shade apart, a darker seam where they are sewn, grimed toward the ground.)
    out.hide.push(tintGeometry(boxUV(g), (x, y, z) => {
      const u = ((z + L / 2) / (L / 6)) % 1;
      const panel = Math.floor((z + L / 2) / (L / 6)) % 2 ? 0.9 : 1.0;
      return panel * (u < 0.04 || u > 0.96 ? 0.62 : 1) - 0.12 * Math.max(0, 1 - y / 0.6);
    }));
    out.hide.push(box(0.02, wall, L, s * W / 2, 0, 0, 0.72));
  }
  // The back gable closed; the front's two flaps tied back to the sides, the dark of the inside between.
  const gable = (z, flap) => {
    if (flap) {
      // The doorway's dark: a triangle inside, a little back.
      out.dark.push(box(W * 0.4, H * 0.6, 0.02, 0, 0, z - Math.sign(z) * 0.3, 1));
      // The front's flaps rolled back and tied either side of the doorway.
      for (const s of [-1, 1]) out.hide.push(cyl(0.07, 0.09, H * 0.62, lod ? 5 : 8, s * (W / 2 - 0.3), 0, z, 0.8));
      return;
    }
    const g = new BoxGeometry(W, H, 0.02);
    g.translate(0, H / 2, z);
    // (Cut to the gable's shape: the box's top corners pulled in to the ridge.)
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > H * 0.5) p.setX(i, 0);
    g.computeVertexNormals();
    out.hide.push(tintGeometry(boxUV(g), () => 0.74));
  };
  gable(-L / 2, false);
  gable(L / 2, true);
  // The poles at each end and the ridge pole; guy ropes to pegs fore and aft.
  for (const z of [-L / 2 - 0.05, L / 2 + 0.05]) out.wood.push(cyl(0.035, 0.035, H + 0.15, lod ? 5 : 8, 0, 0, z, 0.8));
  out.wood.push(beam([0, H + 0.02, -L / 2 - 0.05], [0, H + 0.02, L / 2 + 0.05], 0.05, seed, lod));
  if (lod < 2) {
    for (const z of [-1, 1]) {
      const peg = [0, 0.05, z * (L / 2 + 0.9)];
      out.rope.push(tube([[0, H + 0.1, z * (L / 2 + 0.05)], peg], 0.008, { radial: 3, segments: 1, around: 0.05 }));
      out.wood.push(box(0.04, 0.18, 0.04, peg[0], 0, peg[2], 0.7));
    }
    for (const s of [-1, 1]) for (const z of [-0.9, 0.9]) {
      const peg = [s * (W / 2 + 0.42), 0.05, z];
      out.rope.push(tube([[s * W / 2, wall + 0.1, z], peg], 0.007, { radial: 3, segments: 1, around: 0.05 }));
      out.wood.push(box(0.04, 0.15, 0.04, peg[0], 0, peg[2], 0.7));
    }
  }
}

/** The clerk's hut, its awning, the table of plans, his stool, the groma, the chest. */
function office(lod, seed, out) {
  const { x0, x1, z0, z1, topY, eaveY } = C.hut;
  planks(x0, z0, x1, z0, topY - 0.05, lod, seed, out.boards);
  planks(x0, z0, x0, z1, eaveY - 0.05, lod, seed + 1, out.boards);
  planks(x1, z0, x1, z1, eaveY - 0.05, lod, seed + 2, out.boards);
  // The front with its door (open: the dark inside) toward the table.
  planks(x0, z1, (x0 + x1) / 2 - 0.45, z1, eaveY - 0.05, lod, seed + 3, out.boards);
  planks((x0 + x1) / 2 + 0.45, z1, x1, z1, eaveY - 0.05, lod, seed + 4, out.boards);
  out.boards.push(box(0.9, 0.35, 0.05, (x0 + x1) / 2, 1.85, z1, 0.75));
  out.dark.push(box(0.9, 1.8, 0.02, (x0 + x1) / 2, C.floorY, z1 - 0.06, 1));
  // A roof sloping to the front, and the awning of linen on two poles over the table.
  const roof = leanTo({ L: x1 - x0 + 0.3, span: z1 - z0, topY, eaveY, lod, seed: seed + 5, over: 0.3 });
  for (const g of roof.tile) out.tile.push(g.translate((x0 + x1) / 2, 0, z0));
  for (const g of roof.wood) out.wood.push(g.translate((x0 + x1) / 2, 0, z0));
  const aw = new BoxGeometry(2.6, 0.02, 1.9, lod === 0 ? 8 : 1, 1, 4);
  const ap = aw.attributes.position;
  for (let i = 0; i < ap.count; i++) ap.setY(i, ap.getY(i) - 0.12 * Math.sin(((ap.getX(i) / 2.6) + 0.5) * Math.PI) * ((ap.getZ(i) / 1.9) + 0.5));
  aw.computeVertexNormals();
  aw.rotateX(0.2);
  aw.translate(C.table[0], 2.0, z1 + 0.95);
  out.linen.push(tintGeometry(boxUV(aw), (x) => (Math.floor((x + 10) / 0.33) % 2 ? 0.92 : 0.78)));
  for (const s of [-1, 1]) out.wood.push(cyl(0.035, 0.04, 1.85, lod ? 5 : 8, C.table[0] + s * 1.25, 0, z1 + 1.85, 0.8));
  // The table: a board on trestles, the plan spread on it, held flat by stones; a stool.
  const [tx, tz] = C.table;
  out.wood.push(slab(1.5, 0.05, 0.85, { bevel: 0.006, seed: seed + 9, wobble: 0.002, tone: 0.06, grime: 0 }).translate(tx, 0.72, tz));
  for (const s of [-1, 1]) out.wood.push(box(0.08, 0.72, 0.7, tx + s * 0.6, 0, tz, 0.72));
  out.papyrus.push(box(1.0, 0.006, 0.66, tx - 0.05, 0.77, tz, 0.95));
  if (lod === 0) {
    // The plan: a basilica's outline, its nave's columns, the apse, in ink.
    const ink = (w, d, x, z) => out.ink.push(box(w, 0.002, d, tx - 0.05 + x, 0.776, tz + z, 1));
    ink(0.8, 0.008, 0, -0.22); ink(0.8, 0.008, 0, 0.22); ink(0.008, 0.44, -0.4, 0); ink(0.008, 0.44, 0.4, 0);
    for (let k = 0; k < 6; k++) for (const z of [-0.1, 0.1]) ink(0.018, 0.018, -0.28 + k * 0.11, z);
    ink(0.12, 0.008, 0, -0.3);
    for (const [x, z] of [[-0.47, -0.3], [0.37, 0.3]]) out.stone.push(slab(0.07, 0.04, 0.06, { bevel: 0.006, seed: seed + x * 9, wobble: 0.004, tone: 0.1, grime: 0 }).translate(tx + x, 0.776, tz + z));
  }
  out.wood.push(box(0.4, 0.05, 0.36, tx, SEAT_H - 0.05, tz - 0.62, 0.78));
  for (const [dx, dz] of [[-0.15, -0.13], [0.15, -0.13], [-0.15, 0.13], [0.15, 0.13]]) out.wood.push(box(0.05, SEAT_H - 0.05, 0.05, tx + dx, 0, tz - 0.62 + dz, 0.75));
  // The chest (arca) by the door, iron-bound.
  out.wood.push(slab(0.8, 0.5, 0.45, { bevel: 0.01, seed: seed + 12, wobble: 0.002, tone: 0.05, grime: 0.1 }).translate(x1 - 0.55, 0, z1 + 0.35));
  if (lod < 2) for (const dx of [-0.3, 0.3]) out.iron.push(box(0.04, 0.51, 0.46, x1 - 0.55 + dx, 0, z1 + 0.35, 0.7));
  // The groma, as the engineer's post's: the staff, the bracket, the cross, four plumb lines.
  const [gx, gz, h] = C.groma;
  out.wood.push(cyl(0.018, 0.022, h, lod ? 5 : 8, gx, 0, gz, 1));
  out.bronze.push(box(0.26, 0.025, 0.025, gx - 0.12, h - 0.02, gz));
  for (const a of [0.3, 0.3 + Math.PI / 2]) {
    const dx = Math.cos(a) * 0.44;
    const dz = Math.sin(a) * 0.44;
    out.wood.push(beam([gx - 0.24 - dx, h + 0.02, gz - dz], [gx - 0.24 + dx, h + 0.02, gz + dz], 0.03, seed + a, lod));
    if (lod < 2) for (const s of [-1, 1]) {
      const e = [gx - 0.24 + s * dx, h + 0.02, gz + s * dz];
      out.rope.push(tube([e, [e[0], e[1] - 0.48, e[2]]], 0.005, { radial: 3, segments: 1, around: 0.05 }));
      out.bronze.push(revolve(profileOf([[0, 0], [0.022, 0.026], [0.03, 0.058], [0.012, 0.085], [0, 0.09]]), { segments: lod ? 5 : 8, metres: 0.1 }).translate(e[0], e[1] - 0.57, e[2]));
    }
  }
}

/** The kitchen: a ring of stones round the fire, the tripod and cauldron, log seats, firewood; returns the fire's parts. */
function kitchen(lod, seed, out, lit) {
  const [hx, hz] = C.hearth;
  const ring = lod === 0 ? 10 : 6;
  for (let k = 0; k < ring; k++) {
    const a = (k / ring) * Math.PI * 2;
    out.stone.push(slab(0.2, 0.12, 0.16, { bevel: 0.02, seed: seed + k, wobble: 0.01, tone: 0.1, grime: 0.5 }).rotateY(-a).translate(hx + Math.cos(a) * 0.42, 0, hz + Math.sin(a) * 0.42));
  }
  // The tripod over it, the cauldron's rim at the stir clip's height (the cook stirs it: MORTAR).
  const rim = MORTAR.height;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    out.iron.push(tube([[hx + Math.cos(a) * 0.55, 0.0, hz + Math.sin(a) * 0.55], [hx, rim + 0.35, hz]], 0.014, { radial: lod ? 3 : 5, segments: 1, around: 0.05 }));
  }
  if (lod < 2) out.iron.push(tube([[hx, rim + 0.35, hz], [hx, rim + 0.05, hz]], 0.006, { radial: 3, segments: 1, around: 0.05 }));
  const pot = revolve(profileOf([[0, 0], [0.12, 0.01], [0.22, 0.1], [0.24, 0.22], [0.21, 0.3], [0.22, 0.32], [0.19, 0.32], [0.17, 0.3], [0, 0.29]]), { segments: lod === 0 ? 18 : 10, metres: 0.6 });
  out.bronze.push(pot.translate(hx, rim - 0.32, hz));
  // The fire under it: coals, the flames (lit), ash.
  const f = hearthFire([hx, 0.02, hz], 0.26, { lod, seed: seed + 5, big: 0.9 });
  out.embers.push(...f.hot);
  out.char.push(...f.dark);
  if (lit) out.flames.push(...f.flames);
  out.ash.push(...f.ash);
  // Three log seats round it (their tops at SEAT_H: a seated actor's feet SEAT_H under them).
  for (const [k, a] of [[0, 2.6], [1, 3.6], [2, 4.9]].map(([i, a]) => [i, a])) {
    const x = hx + Math.cos(a) * 1.15;
    const z = hz + Math.sin(a) * 1.15;
    const g = new CylinderGeometry(0.17, 0.18, 1.1, lod ? 7 : 12, 1);
    g.rotateZ(Math.PI / 2).rotateY(-a + Math.PI / 2).translate(x, SEAT_H - 0.17, z);
    out.bark.push(tintGeometry(boxUV(g), () => 0.85 + 0.1 * k));
  }
  // Firewood stacked beside, split logs.
  const rnd = artRng(seed + 20);
  for (let k = 0; k < (lod === 2 ? 3 : 12); k++) {
    const g = new CylinderGeometry(0.07, 0.07, 0.9, lod ? 5 : 7, 1);
    g.rotateX(Math.PI / 2).translate(-4.9 + (k % 4) * 0.16, 0.08 + Math.floor(k / 4) * 0.13, 3.0 + rnd() * 0.08);
    out.bark.push(tintGeometry(boxUV(g), () => 0.75 + rnd() * 0.25));
  }
}

/** The water: three amphorae in a rack and a big jar (`dry`: empty, one lying on its side); the larder's sacks and baskets (`fed`). */
function stores(lod, seed, out, { dry, fed }) {
  const [jx, jz] = C.jars;
  out.wood.push(box(1.3, 0.08, 0.36, jx + 0.35, 0.42, jz, 0.75));
  for (const s of [-1, 1]) out.wood.push(box(0.08, 0.42, 0.36, jx + 0.35 + s * 0.6, 0, jz, 0.72));
  for (let k = 0; k < 3; k++) {
    const a = jar({ amphora: true, lod, seed: seed + k });
    if (dry && k === 1) {
      a.rotateZ(Math.PI / 2 - 0.1).translate(jx + 0.6, 0.15, jz + 0.65);
    } else a.translate(jx - 0.05 + k * 0.4, 0.5, jz);
    out.clay.push(a);
  }
  const d = jar({ lod, seed: seed + 9 });
  d.scale(0.7, 0.7, 0.7).translate(jx + 0.1, 0, jz - 0.75);
  out.clay.push(d);
  // Water in the big jar's mouth while there is water.
  if (!dry) out.water.push(cyl(0.16, 0.16, 0.01, lod ? 8 : 14, jx + 0.1, 0.7, jz - 0.75, 1));
  if (!fed) return;
  const [sx, sz] = C.stores;
  for (let k = 0; k < (lod === 2 ? 2 : 4); k++) out.sack.push(sack(0.42, 0.62, seed + k, lod).translate(sx + (k % 2) * 0.48, 0, sz + Math.floor(k / 2) * 0.45 - 0.2));
  if (lod < 2) {
    // Baskets of onions and of grain beside the sacks.
    for (const [k, rgb] of [[0, lin(0xc89a5a)], [1, lin(0xd8c070)]]) {
      const b = basket(0.24, 0.28, 1, lod);
      out.wicker.push(b.wicker.translate(sx + 1.05 + k * 0.5, 0, sz - 0.1 + k * 0.3));
      if (b.fill) out.produce.push(tintGeometry(b.fill.translate(sx + 1.05 + k * 0.5, 0, sz - 0.1 + k * 0.3), () => rgb));
    }
  }
}

/** The fence round the sides and front, the gate posts, the board over the gate, the braziers. */
function fence(lod, seed, out, lit) {
  const H = C.half - 0.15;
  const { x: gx, z: gz, h } = C.gate;
  for (const g of railFence([[-H, C.shed.z1 + 0.2], [-H, H], [-gx - 0.15, H]], { h: 1.1, seed, lod, every: 2.2 })) out.wood.push(g);
  for (const g of railFence([[gx + 0.15, H], [H, H], [H, C.shed.z1 + 0.2]], { h: 1.1, seed: seed + 3, lod, every: 2.2 })) out.wood.push(g);
  for (const s of [-1, 1]) out.wood.push(box(0.2, h, 0.2, s * gx, 0, gz, 0.75));
  // The board over the gate: CASTRA OPERARVM painted in red on whitewash.
  const by = h - 0.4;
  out.paint.push(slab(2.6, 0.28, 0.05, { bevel: 0.006, seed: seed + 9, wobble: 0, tone: 0.02, grime: 0 }).translate(0, by, gz + 0.13));
  if (lod === 0) out.letters.push(...inscription('CASTRA·OPERARVM', by + 0.07, gz + 0.16, 0.13));
  else if (lod === 1) out.letters.push(box(2.2, 0.12, 0.006, 0, by + 0.08, gz + 0.158, 1));
  // A brazier on each post: an iron bowl of coals, burning while the camp is staffed.
  for (const s of [-1, 1]) {
    const x = s * gx;
    const bowl = revolve(profileOf([[0, 0], [0.08, 0], [0.2, 0.1], [0.22, 0.16], [0, 0.12]]), { segments: lod === 0 ? 14 : 8, metres: 0.4 });
    out.iron.push(bowl.translate(x, h, gz));
    const f = hearthFire([x, h + 0.1, gz], 0.15, { lod, seed: seed + 20 + s, big: 0.6 });
    out.embers.push(...f.hot);
    out.char.push(...f.dark);
    if (lit) out.braziers.push(...f.flames);
  }
}

/** A plain sheet of geometries by material for the camp. */
function bins() {
  return {
    earth: [], shade: [], boards: [], wood: [], timber: [], tile: [], stone: [], tufa: [], marble: [], chips: [], iron: [], bronze: [],
    rope: [], hide: [], dark: [], linen: [], papyrus: [], ink: [], paint: [], letters: [], bark: [], clay: [], water: [], sack: [], wicker: [],
    embers: [], char: [], flames: [], braziers: [], ash: [], sawdust: [], produce: [],
  };
}

/** The camp's materials (the look's, shared by key with the other models'). */
export function campMaterials() {
  const h = healthMaterials();
  return {
    earth: material('beaten-earth', { surface: 'earth', vertexColors: true, snow: 1 }),
    wood: material('wood', { surface: 'wood', vertexColors: true, snow: 1 }),
    bark: material('bark', { surface: 'bark', vertexColors: true, snow: 0.6 }),
    tile: material('roof-tile', { surface: 'terracotta', vertexColors: true, snow: 1 }),
    clay: material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 0.8 }),
    stone: material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 }),
    tufa: material('tufa', { surface: 'tufa', vertexColors: true, snow: 1 }),
    marble: material('marble', { surface: 'marble', vertexColors: true, snow: 1 }),
    iron: material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }),
    bronze: material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }),
    rope: material('rope', { surface: 'rope', vertexColors: true, snow: 0.6, normal: 1 }),
    // Goatskin tents, tanned and greased: the hides' tones in the vertices.
    hide: material('tent-hide', { surface: 'wool', color: 0xc49a6a, rough: 0.9, vertexColors: true, snow: 1 }),
    linen: material('awning-linen', { surface: 'wool', color: 0xe8dcc4, vertexColors: true, snow: 1 }),
    dark: material('interior', { color: 0x2a231c, roughness: 0.95, snow: 0, wet: 0 }),
    papyrus: material('papyrus', { color: 0xffffff, roughness: 0.85, vertexColors: true, snow: 0 }),
    ink: material('plan-ink', { color: 0x2a2018, roughness: 0.9, snow: 0 }),
    paint: material('paint', { color: 0xffffff, roughness: 0.6, vertexColors: true, snow: 0.8 }),
    letters: material('inscription-red', { color: 0x6a1e14, roughness: 0.8, snow: 0.3 }),
    sack: material('sacking', { surface: 'wool', vertexColors: true, color: 0xc2a477, snow: 0.8 }),
    wicker: material('wicker', { surface: 'wicker', vertexColors: true, snow: 0.8 }),
    water: material('jar-water', { color: 0x1c2a30, roughness: 0.15, snow: 0 }),
    embers: h.embers,
    char: material('charcoal', { color: 0x1a1612, roughness: 0.95, snow: 0.5 }),
    flame: material('altar-flame', { color: 0xff9a40, roughness: 1, emissive: 0xff5e14, emissiveIntensity: 2.4, snow: 0, wet: 0 }),
    ash: material('cold-ash', { color: 0x4a4440, roughness: 0.95, snow: 1 }),
    sawdust: material('sawdust', { surface: 'earth', color: 0xd8c08e, vertexColors: true, snow: 1 }),
    lime: material('slaked-lime', { color: 0xe9e5da, roughness: 0.95, vertexColors: true, snow: 0.6 }),
    produce: material('produce', { roughness: 0.42, snow: 0.35, wet: 0.4 }),
  };
}

/**
 * Build the work camp: { group, meshes, triangles }; its meshes tagged in
 * userData.when ('staffed': the fires burning, 'shut': the cold ash).
 * `supply`: 'ok', 'hungry' (no food: no sacks, the kitchen fire out),
 * 'dry' (no water: the jars empty, one tipped over) or 'both'.
 */
export function buildWorkCamp({ lod = 0, seed = 41, supply = 'ok' } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const fed = supply === 'ok' || supply === 'dry';
  const dry = supply === 'dry' || supply === 'both';
  const out = bins();
  const H = C.half - 0.02;
  out.earth.push(slab(2 * H, C.floorY, 2 * H, { bevel: 0.015, seed: seed + 1, wobble: 0, tone: 0, grime: 0 }));
  shed(lod, seed + 10, out);
  masonsBay(lod, seed + 30, out);
  carpentersBay(lod, seed + 50, out);
  for (const [k, [x, z]] of C.tents.entries()) {
    const t = bins();
    tent(lod, seed + 70 + k, t);
    for (const key of Object.keys(t)) for (const g of t[key]) out[key].push(g.rotateY(k ? 0.04 : -0.03).translate(x, C.floorY, z));
  }
  office(lod, seed + 90, out);
  kitchen(lod, seed + 110, out, fed);
  stores(lod, seed + 130, out, { dry, fed });
  fence(lod, seed + 150, out, true);
  // A lime pit beside the masons' bay, and a stack of bricks on a pallet by the wagons.
  out.wood.push(box(1.2, 0.2, 0.05, -0.9, 0, -1.9, 0.72), box(1.2, 0.2, 0.05, -0.9, 0, -1.1, 0.72), box(0.05, 0.2, 0.8, -1.48, 0, -1.5, 0.72), box(0.05, 0.2, 0.8, -0.32, 0, -1.5, 0.72));
  out.lime = [box(1.1, 0.01, 0.74, -0.9, 0.15, -1.5, 0.95)];
  // Far out the small things are a pixel or two, and each material is one more draw for every camp in view: left out.
  if (lod === 2) out.rope = out.ink = out.letters = out.chips = out.sawdust = out.bronze = [];
  const m = campMaterials();
  const p = new TaggedParts('castra-operarum');
  p.add('yard', m.earth, out.earth);
  p.add('shade', m.earth, out.shade, { cast: false });
  p.add('boards', m.wood, [...out.boards, ...out.wood, ...out.timber]);
  p.add('roof', m.tile, out.tile);
  p.add('stone', m.stone, out.stone);
  p.add('tufa', m.tufa, out.tufa);
  p.add('marble', m.marble, [...out.marble, ...out.chips]);
  p.add('iron', m.iron, out.iron);
  p.add('bronze', m.bronze, out.bronze);
  p.add('rope', m.rope, out.rope);
  p.add('hide', m.hide, out.hide);
  p.add('dark', m.dark, out.dark, { cast: false });
  p.add('linen', m.linen, out.linen);
  p.add('papyrus', m.papyrus, out.papyrus, { cast: false });
  p.add('ink', m.ink, out.ink, { cast: false });
  p.add('sign', m.paint, out.paint);
  p.add('letters', m.letters, out.letters, { cast: false });
  p.add('logs', m.bark, out.bark);
  p.add('jars', m.clay, out.clay);
  p.add('water', m.water, out.water, { cast: false });
  p.add('sacks', m.sack, out.sack);
  p.add('baskets', m.wicker, out.wicker);
  p.add('produce', m.produce, out.produce, { cast: false });
  p.add('char', m.char, out.char, { cast: false });
  p.add('sawdust', m.sawdust, out.sawdust, { cast: false });
  p.add('lime', m.lime, out.lime, { cast: false });
  // The fires: the kitchen's coals and flames and the braziers' while staffed, the ash when not.
  p.add('embers', m.embers, out.embers, { when: 'staffed', cast: false });
  p.add('flames', m.flame, [...out.flames, ...out.braziers], { when: 'staffed', cast: false });
  p.add('ash', m.ash, out.ash, { when: 'shut', cast: false });
  // The paint of the gate's board: whitewash (its colour in the vertices).
  for (const g of out.paint) tintGeometry(g, () => lin(0xece4d0));
  // The clerk's lantern by his door: lit while staffed.
  if (lod < 2) {
    const l = lantern(C.hut.x0 + 0.5, 1.75, C.hut.z1 + 0.1, lod);
    p.add('bronze', m.bronze, l.bronze);
    p.add('lamp', lanternPane(), [l.pane], { when: 'staffed', cast: false });
    p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
  }
  return p.build();
}

/** A parked ox wagon (rural.js cart: solid wheels, its pole on the ground), a kit of its own, instanced. */
export function buildCampWagon(lod) {
  const c = cart(lod, 7);
  const p = new TaggedParts('camp-wagon');
  const m = campMaterials();
  p.add('wagon', m.wood, c.wood);
  if (c.iron.length) p.add('wagon-iron', m.iron, c.iron);
  return p.build();
}

/**
 * The camp's people by state (people/actors.js specs, its metres): at home
 * ('open') the crew rests and works: three at the fire on its logs, the
 * cook stirring the cauldron (none without food), a mason at the banker,
 * a carpenter at the beam, the clerk at his plans, a man bringing water
 * from the jars (none without water), one carrying a plank to the shed;
 * with the crew out at the site ('out') the clerk, the cook and the
 * carpenter stay; nobody unstaffed.
 */
export function campActors(state, supply = 'ok') {
  if (state !== 'open' && state !== 'out') return [];
  const fed = supply === 'ok' || supply === 'dry';
  const dry = supply === 'dry' || supply === 'both';
  const y0 = C.floorY;
  const [hx, hz] = C.hearth;
  const [tx, tz] = C.table;
  const [bx, bz] = C.banker;
  const [trx, trz] = C.trestle;
  const list = [
    // The clerk on his stool at the table, writing up the day's loads.
    { body: 'm', dress: ['tunic:knee'], hair: 'crop', beard: 'short', clip: 'write', props: { R: 'stylus', L: 'tablet' }, at: [tx, y0, tz - 0.62], ry: 0, seed: 501, old: true, colours: { tunic: 0xd8cdb4 } },
    // The carpenter cutting a mortise in the beam on the trestles (his chisel on its top).
    { ...crewMason([trx - 0.3, y0, trz + 0.13 + 0.42], Math.PI, 503), hair: 'curls' },
  ];
  if (fed) list.push({ body: 'm', dress: ['tunic:short'], hair: 'crop', clip: 'stir', props: { R: 'pestle' }, at: [hx, y0, hz - MORTAR.ahead], ry: 0, seed: 502, colours: { tunic: 0xbfae8e } });
  if (state === 'out') return list;
  // At home: the mason at the banker, men at the fire, one with water, one with a plank.
  list.push(crewMason([bx, y0, bz + 0.25 + 0.42], Math.PI, 504));
  const seats = [[0, 2.6], [1, 3.6], [2, 4.9]];
  for (const [k, a] of seats) {
    const x = hx + Math.cos(a) * 1.15;
    const z = hz + Math.sin(a) * 1.15;
    // Seated on the log, facing the fire: feet SEAT_H under its top, a little toward the fire.
    const ry = Math.atan2(hx - x, hz - z);
    list.push({ body: 'm', dress: ['tunic:short'], hair: k === 1 ? 'curls' : 'crop', beard: k === 2 ? 'full' : null, clip: k === 1 ? 'sitTalk' : 'sit', at: [x + Math.sin(ry) * 0.18, y0, z + Math.cos(ry) * 0.18], ry, seed: 510 + k });
  }
  if (!dry) list.push({ body: 'm', dress: ['tunic:short'], hair: 'crop', clip: 'jarCarry', props: { L: 'jar' }, at: [C.jars[0] + 0.6, y0, C.jars[1] - 0.2], ry: Math.atan2(hx + 0.9 - C.jars[0] - 0.6, hz - C.jars[1] + 0.2), seed: 520, route: { length: 2.0, speed: 0.9, pauseEnd: 2, pauseStart: 3, clipEnd: 'jarStand', clipStart: 'jarStand' } });
  list.push(crewCarrier([0.6, y0, 1.6], Math.PI, 3.5, 521, 'plank'));
  list.push(crewForeman([-0.6, y0, 0.2], Math.PI * 0.8, 522));
  return list;
}
