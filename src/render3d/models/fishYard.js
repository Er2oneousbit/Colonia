/**
 * models/fishYard.js
 * ----------------------------------------------------------------------------
 * The Fabrica Navalis (the Shipyard, which builds the fishing boats) in the
 * 3D look: designed from the small boatyards of the ancient shores that
 * are known, not from the 2D sprite:
 *
 *   - Boatbuilding as the wrecks and the texts show it: shell first, the
 *     keel laid on blocks with the stem and sternpost raised and braced,
 *     the strakes edge-joined by mortise and tenon, the frames fitted into
 *     the shell after (the Kyrenia ship and the Ma'agan Mikhael boat; the
 *     Galilee boat of the first century carries the same method down to a
 *     small open fishing craft), the hull pitched below and painted above.
 *   - A boat hauled up and down a slip of cross timbers with greased ways,
 *     by a windlass at the head (the slips of the Piraeus sheds, here a
 *     fisherman's, a quarter the size of the Navalia's: navalia.js).
 *   - A frame of posts and beams over the building slip, from which the
 *     planks are hoisted and held: the shipwright's tackle (Vitruvius X).
 *   - The shipwright's kit on the reliefs of Ostia and Isola Sacra: the
 *     adze, the mallet and the chisel, the frame saw; a pitch kettle on a
 *     tripod over a fire (the boat's seams are payed with pitch and wax).
 *   - Oars and a mast seasoning on trestles under the sun, timber stacked
 *     to dry.
 *
 * So, in 8 m (the shore row behind, one row out over the water): on the west
 * a building slip of ashlar bed and bents of piles, sleepers and two greased
 * ways running down into the sea, the frame over it and the windlass at its
 * head; the fishing boat on it as the sim builds it, in four stages (this
 * file's buildFishHull: the keel and posts, the frames and the first
 * strakes, planked, finished and painted); on the east the timber yard
 * (the loads the yard holds are the warehouse's loads, models/fishYard
 * stock), a tar kettle over a hearth, and a deck on piles over the water
 * with a mast and oars on trestles and the bollards for the boat's lines.
 * The finished boat lies afloat in front of the yard (the game draws it:
 * ships/moorings.js, a hand off the yard's front), which is kept clear.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the lantern lit, the kettle's fire burning; its people
 *           are actors (fishYardActors): the man at the windlass, a
 *           labourer carrying a sack from the timber to the deck, the man
 *           stirring the kettle, and at a hull on the slip the shipwright
 *   'shut'  no staff: nobody, the crank hanging, the fire cold ash
 *
 * Metres, the middle at the origin, y up, the water side toward +z. Levels
 * of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import { boxUV, tintGeometry, tube } from '../shapes.js';
import { material } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab, paving, TaggedParts } from './masonry.js';
import { beam } from './rural.js';
import { WINDLASS } from '../people/clips.js';
import { DYES } from '../people/actors.js';
import { DESIGNS, hullAt } from '../ships/designs.js';
import { HARBOUR, board, pile, pileFoam, jetty, sweep, gridSurface, mirrored } from './harbour.js';
import { waterMaterials, bins, addLanterns } from './watersideKit.js';

/** The yard's measures (metres): the tests, the lab and the game read them. */
export const FISH_YARD = Object.freeze({
  half: 4,
  shore: 0, // the shore line: the land row behind it, the water row before it
  slipX: -1.9, // the building slip's middle line
  slipHalf: 1.15, // half its sleepers' length
  headZ: -3.3, // its head
  headY: 0.75, // the ramp's top there
  slope: 0.085, // its fall a metre (a little steeper than the Navalia's: the boat is light)
  endZ: 3.92,
  hullZ: -0.2, // where the boat's middle lies on the slip (z)
  keelBlocks: 0.26,
  /** The frame over the slip: posts at x in `xs` and z in `zs`, its beams at `h`. */
  frame: Object.freeze({ xs: Object.freeze([-3.4, -0.4]), zs: Object.freeze([-1.8, -0.2]), h: 3.1 }),
  /** The windlass at the slip's head (axis x, y, z) and its crank's x (to the west, the winder's right; the drum lies to his left, +x). */
  windlass: Object.freeze([-1.9, 0.06 + WINDLASS.height, -3.1]),
  crankX: -3.18,
  /** The timber the yard holds, each place a cart's load (1 m square, 100 timber: models/wares.js buildLoad) [x, y, z, yaw]. */
  stock: Object.freeze([Object.freeze([0.95, 0.06, -3.25, 0]), Object.freeze([2.1, 0.06, -3.25, 0])]),
  /** The pitch kettle: the hearth's middle (x, z) and the kettle's rim over the ground. */
  kettle: Object.freeze({ x: 1.7, z: -1.0, rim: 0.86 }),
  /** The deck on piles over the water on the east (x0, x1) and its top. */
  deck: Object.freeze({ x0: 0.5, x1: 3.9, y: HARBOUR.deckY }),
  /** The lantern [x, y of its base, z, y of the post's foot]. */
  lamps: Object.freeze([Object.freeze([0.35, 1.75, -1.9, 0.06])]),
});

const F = FISH_YARD;

/** The ramp's top at z (the sleepers' top) for the building slip. */
export function fishSlipY(z) {
  return F.headY - (z - F.headZ) * F.slope;
}
const TILT = Math.atan(F.slope);
const BOAT = DESIGNS.fishing;

/**
 * The step of the boat on the slip from the sim's progress (0 to 100 over
 * SHIPYARD_BOAT_DAYS): the same split as the Navalia's liburnian and the
 * sprite's two looks, 50 (models/fleet.js hullStep): 0 none (a spare
 * boat is waiting afloat: the yard builds nothing), 1 the keel and posts
 * (under 25), 2 the frames and the lower strakes (under 50), 3 planked to
 * the sheer (under 75), 4 finished and painted.
 */
export function fishHullStep(b) {
  const p = b.progress;
  if (b.spareId || !(p > 0)) return 0;
  return p < 25 ? 1 : p < 50 ? 2 : p < 75 ? 3 : 4;
}

/**
 * The building slip: over the land an ashlar bed under the sleepers, over
 * the water bents of piles (the part that stands above the sea), sleepers
 * across it all and the two ways, greased and dark, down its middle.
 */
function slipway(out, lod, seed) {
  const rnd = artRng(seed);
  const { slipX: xc, slipHalf: half, headZ: z0, endZ: end, shore } = F;
  const seg = lod === 2 ? shore - z0 : 1.0;
  for (let z = z0 - 0.15; z < shore - 0.01; z += seg) {
    const zb = Math.min(shore, z + seg);
    const g = new BoxGeometry(half * 2 + 0.18, 1, zb - z - 0.01, 1, 1, 1);
    g.translate(xc, 0.5, (z + zb) / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.5) p.setY(i, fishSlipY(p.getZ(i)) - 0.11);
    g.computeVertexNormals();
    boxUV(g, rnd() * 3, rnd() * 3);
    const k = 0.9 + rnd() * 0.15;
    out.stone.push(tintGeometry(g, (x, y) => k * (0.75 + 0.25 * Math.min(1, y / 0.3))));
  }
  // Over the water: bents of three piles every 1.5 m (where the ramp still stands over the sea), a cap beam across each.
  const xs = [xc - half + 0.2, xc, xc + half - 0.2];
  for (let z = shore + 0.5, k = 0; z < end; z += 1.5, k++) {
    const top = fishSlipY(z) - 0.11 - 0.14 - 0.16;
    if (top < 0.03) continue;
    for (const x of xs) {
      out.wood.push(pile(x, z, top, { r: 0.1, seed: seed + k * 7 + x, lod }));
      if (lod < 2) out.foam.push(pileFoam(x, z, 0.1, 0.32, seed + k * 3 + x, lod, F.half));
    }
    out.wood.push(board(half * 2 - 0.1, 0.16, 0.16, { tone: 0.95 }).translate(xc, top, z));
  }
  for (const x of xs) {
    out.wood.push(sweep([[x, fishSlipY(shore - 0.1) - 0.11 - 0.07, shore - 0.1], [x, fishSlipY(end) - 0.11 - 0.07, end]], 0.14, 0.14, { side: [1, 0, 0], tint: () => 0.68 }));
  }
  // The sleepers across the whole run, the ways down the middle.
  const every = lod === 2 ? 1.2 : lod ? 0.6 : 0.42;
  for (let z = z0 + 0.12; z < end - 0.05; z += every) {
    const g = board(half * 2, 0.11, 0.18, { tone: 0.97 + rnd() * 0.2 });
    g.rotateX(TILT);
    out.wood.push(g.translate(xc, fishSlipY(z) - 0.11, z));
  }
  for (const s of [-1, 1]) {
    out.ways.push(sweep([[xc + s * 0.4, fishSlipY(z0) + 0.05, z0], [xc + s * 0.4, fishSlipY(end) + 0.05, end]], 0.15, 0.1, { side: [1, 0, 0], tint: () => 0.55 }));
  }
}

/** The ground: flags round the slip's bed, behind its head, and over the east strip. */
function yard(out, lod, seed) {
  const H = F.half - 0.02;
  const a = F.slipX - F.slipHalf - 0.12;
  const b = F.slipX + F.slipHalf + 0.12;
  const opts = { rowW: 0.62, minL: 0.5, maxL: 1.0, lod };
  out.flags.push(...paving(-H, H, -H, F.headZ - 0.15, 0.06, seed + 1, opts));
  out.flags.push(...paving(-H, a, F.headZ - 0.15, F.shore, 0.06, seed + 2, opts));
  out.flags.push(...paving(b, H, F.headZ - 0.15, F.shore, 0.06, seed + 3, opts));
  if (lod < 2) {
    // The shore's edge east of the slip: a kerb of stone where the land ends over the water.
    out.stone.push(slab(F.deck.x0 - b, 0.5, 0.26, { bevel: 0.02, seed: seed + 9, wobble: 0.003, tone: 0.05, grime: 0.5 }).translate((F.deck.x0 + b) / 2, -0.4, F.shore - 0.1));
  }
}

/** The frame over the slip: four posts, beams across and along, braces, planks laid on it to season, the block and tackle. */
function frame(out, lod, seed) {
  const { xs, zs, h } = F.frame;
  for (const x of xs) {
    for (const z of zs) {
      out.wood.push(board(0.2, h, 0.2, { tone: 1.07, grime: 0.2 }).translate(x, 0.06, z));
      out.stone.push(slab(0.4, 0.1, 0.4, { bevel: 0.02, seed: seed + x * 5 + z, wobble: 0.003, tone: 0.05, grime: 0.3 }).translate(x, 0, z));
    }
  }
  const cx = (xs[0] + xs[1]) / 2;
  const cz = (zs[0] + zs[1]) / 2;
  for (const z of zs) out.wood.push(board(xs[1] - xs[0] + 0.3, 0.2, 0.2, { tone: 0.97 }).translate(cx, h - 0.1, z));
  for (const x of xs) out.wood.push(board(0.2, 0.2, zs[1] - zs[0] + 0.3, { tone: 0.97 }).translate(x, h - 0.3, cz));
  if (lod === 2) return;
  // Braces from the posts up into the beams.
  for (const x of xs) {
    const s = x < cx ? 1 : -1;
    for (const z of zs) out.wood.push(beam([x, 2.35, z], [x + s * 0.55, h - 0.05, z], 0.1, seed + x + z, lod));
  }
  // Planks laid across the top beams to season, and the tackle: a block hung from the middle of the front beam.
  for (let k = 0; k < 3; k++) out.wood.push(board(xs[1] - xs[0] + 0.5, 0.06, 0.28, { tone: 1.20 - k * 0.06 }).translate(cx, h + 0.0 + k * 0.06, zs[1] - 0.4 - k * 0.0));
  const bx = cx;
  const bz = zs[1];
  out.rope.push(tube([[bx, h - 0.2, bz], [bx + 0.02, h - 0.55, bz], [bx, h - 0.9, bz]], 0.025, { radial: 4, segments: 6, around: 0.1 }));
  out.iron.push(tintGeometry(boxUV(new BoxGeometry(0.14, 0.22, 0.09).translate(bx, h - 1.0, bz)), () => 0.8));
  out.iron.push(tube([[bx, h - 1.1, bz], [bx, h - 1.25, bz], [bx + 0.06, h - 1.36, bz]], 0.018, { radial: 4, segments: 5, around: 0.1 }));
}

/** The windlass at the slip's head: standards, the drum with its hawser turns, the axle out to the crank, spare bars. */
function windlass(out, lod, seed) {
  const [x, y, z] = F.windlass;
  const base = fishSlipY(z);
  for (const s of [-1, 1]) {
    out.wood.push(board(0.2, 0.16, 1.0, { tone: 0.95 }).translate(x + s * 0.7, base - 0.02, z));
    out.wood.push(board(0.18, y + 0.32 - base, 0.18, { tone: 1.10 }).translate(x + s * 0.7, base + 0.12, z));
    if (lod < 2) {
      out.wood.push(beam([x + s * 0.7, base + 0.14, z - 0.44], [x + s * 0.7, y - 0.05, z - 0.05], 0.09, seed + s, lod));
      out.wood.push(beam([x + s * 0.7, base + 0.14, z + 0.44], [x + s * 0.7, y - 0.05, z + 0.05], 0.09, seed + s + 4, lod));
    }
  }
  const seg = lod === 0 ? 14 : lod ? 9 : 6;
  const drum = new CylinderGeometry(0.16, 0.16, 1.2, seg);
  drum.rotateZ(Math.PI / 2).translate(x, y, z);
  out.wood.push(tintGeometry(boxUV(drum), () => 0.8));
  // The axle out to the west, over the slip's edge, on a post of its own, to the crank.
  const cx = F.crankX;
  const ax1 = x - 0.62;
  const axle = new CylinderGeometry(0.055, 0.055, ax1 - cx, lod ? 6 : 10);
  axle.rotateZ(Math.PI / 2).translate((ax1 + cx) / 2, y, z);
  out.wood.push(tintGeometry(boxUV(axle), () => 0.75));
  out.wood.push(board(0.16, y + 0.12, 0.16, { tone: 1.10 }).translate(cx + 0.24, 0.06, z));
  // The crank at rest while nobody turns it.
  const hub = new CylinderGeometry(0.03, 0.03, 0.06, lod ? 6 : 10);
  hub.rotateZ(Math.PI / 2).translate(cx - 0.03, y, z);
  out.crankIron.push(tintGeometry(boxUV(hub), () => 0.8));
  out.crank.push(board(0.04, WINDLASS.arm + 0.06, 0.05, { tone: 1.10 }).translate(cx - 0.03, y - WINDLASS.arm - 0.03, z));
  const handle = new CylinderGeometry(0.022, 0.022, 0.4, lod ? 5 : 8);
  handle.rotateZ(Math.PI / 2).translate(cx - 0.03 - 0.2, y, z);
  handle.translate(0, -WINDLASS.arm, 0);
  out.crank.push(tintGeometry(boxUV(handle), () => 0.72));
  if (lod < 2) {
    for (let k = 0; k < 6; k++) {
      const g = new TorusGeometry(0.19, 0.03, lod ? 4 : 6, seg);
      g.rotateY(Math.PI / 2).translate(x - 0.2 + k * 0.07, y, z);
      out.rope.push(tintGeometry(boxUV(g), () => 0.85));
    }
    // Bars (handspikes) laid down by the drum.
    for (const s of [-1, 1]) out.wood.push(board(0.07, 0.07, 1.4, { tone: 1.05 }).translate(x + s * 0.3, fishSlipY(z + 0.6), z + 0.65));
  }
}

/** The stock yard's other furniture: the kettle on its hearth, the trestles with a mast and oars on the deck, the lantern's ground. */
function stores(out, lod, seed) {
  const K = F.kettle;
  // The hearth: a ring of stones with the fire's bed (embers when staffed, ash when not).
  const ring = new TorusGeometry(0.34, 0.1, lod ? 4 : 6, lod ? 8 : 14);
  ring.rotateX(Math.PI / 2).translate(K.x, 0.1, K.z);
  out.stone.push(tintGeometry(boxUV(ring), () => 0.8));
  const bed = new CylinderGeometry(0.3, 0.3, 0.04, lod ? 8 : 14);
  bed.translate(K.x, 0.08, K.z);
  out.bed.push(tintGeometry(boxUV(bed), () => 1));
  // The kettle: an iron bowl on three legs meeting over the fire, the tar in it dark.
  const bowl = new SphereGeometry(0.26, lod ? 8 : 14, lod ? 4 : 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  bowl.scale(1, 0.75, 1).translate(K.x, K.rim - 0.02, K.z);
  out.iron.push(tintGeometry(boxUV(bowl), () => 0.7));
  const tar = new CylinderGeometry(0.255, 0.255, 0.02, lod ? 8 : 14);
  tar.translate(K.x, K.rim - 0.04, K.z);
  out.tar.push(tintGeometry(boxUV(tar), () => 1));
  if (lod < 2) {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      out.iron.push(tube([[K.x + Math.cos(a) * 0.4, 0.07, K.z + Math.sin(a) * 0.4], [K.x + Math.cos(a) * 0.25, K.rim - 0.2, K.z + Math.sin(a) * 0.25]], 0.017, { radial: 4, segments: 3, around: 0.1 }));
    }
  }
  // The deck on piles over the water, east of the slip: planks, bents, fenders, the bollard piles.
  const D2 = F.deck;
  const j = jetty(D2.x0, D2.x1, F.shore + 0.03, F.endZ, D2.y, { seed: seed + 3, lod, bent: 1.5, half: F.half });
  out.wood.push(...j.wood);
  out.foam.push(...j.foam);
  out.wood.push(pile(D2.x0 + 0.35, F.endZ - 0.3, D2.y + 0.4, { r: 0.09, seed: seed + 77, lod }), pile(D2.x1 - 0.3, F.endZ - 0.3, D2.y + 0.4, { r: 0.09, seed: seed + 78, lod }));
  if (lod === 2) return;
  // A mast and two oars seasoning on trestles on the deck, out of the damp.
  const tx = 3.1;
  for (const z of [1.0, 3.0]) {
    for (const s of [-1, 1]) out.wood.push(beam([tx + s * 0.34, D2.y, z - 0.18], [tx + s * 0.06, D2.y + 0.5, z], 0.06, seed + z + s, lod), beam([tx + s * 0.34, D2.y, z + 0.18], [tx + s * 0.06, D2.y + 0.5, z], 0.06, seed + z + s + 5, lod));
  }
  out.wood.push(sweep([[tx, D2.y + 0.58, 0.55], [tx, D2.y + 0.58, 3.65]], 0.13, 0.13, { side: [1, 0, 0], taper: 0.55 }));
  for (const [dx, len] of [[-0.3, 2.9], [-0.46, 2.7]]) {
    out.wood.push(sweep([[tx + dx, D2.y + 0.55, 0.6], [tx + dx, D2.y + 0.55, 0.6 + len]], 0.06, 0.06, { side: [1, 0, 0], taper: 0.7 }));
    out.wood.push(board(0.14, 0.02, 0.5, { tone: 1.15 }).translate(tx + dx, D2.y + 0.53, 0.6 + len - 0.1));
  }
}

/** Build the yard's building (no boat, no timber: those are kits of their own): { group, meshes, triangles }. */
export function buildFishYard({ lod = 0, seed = 97, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bins('flags', 'stone', 'wood', 'ways', 'iron', 'rope', 'foam', 'crank', 'crankIron', 'bed', 'tar');
  yard(out, lod, seed);
  slipway(out, lod, seed + 100);
  frame(out, lod, seed + 200);
  windlass(out, lod, seed + 300);
  stores(out, lod, seed + 400);
  const m = waterMaterials();
  const p = new TaggedParts('fish-yard');
  p.add('flags', m.stone, out.flags);
  p.add('stone', m.trav, out.stone);
  p.add('timber', m.wood, out.wood);
  p.add('ways', material('greased-ways', { surface: 'wood', color: 0x6a5a48, vertexColors: true, snow: 1 }), out.ways);
  p.add('tar', m.tar, out.tar, { cast: false });
  if (lod < 2) {
    p.add('iron', m.iron, out.iron);
    p.add('rope', m.rope, out.rope);
  }
  if (!ice) p.add('foam', m.foam, out.foam, { cast: false });
  p.add('crank', m.wood, out.crank, { when: 'shut' });
  if (lod < 2) p.add('crank-iron', m.iron, out.crankIron, { when: 'shut' });
  // The hearth under the kettle: embers while the yard works (with the smoke kit over the kettle), cold ash when it does not.
  p.add('fire', m.ember, out.bed, { when: 'open', cast: false });
  p.add('ash', material('cold-ash', { color: 0x4a4440, roughness: 0.95, snow: 1 }), out.bed.map((g) => g.clone()), { when: 'shut' });
  addLanterns(p, m, F.lamps, lod);
  // (The yard's men are actors: fishYardActors.)
  return p.build();
}

// ---------------------------------------------------------------------------
// The boat on the slip
// ---------------------------------------------------------------------------

/** A point of the boat's own frame ([x, y, z]) on the slip (the model's metres). */
function onSlip(p) {
  const y0 = fishSlipY(F.hullZ) + F.keelBlocks;
  const c = Math.cos(TILT);
  const s = Math.sin(TILT);
  return [F.slipX + p[0], y0 + p[1] * c - p[2] * s, F.hullZ + p[1] * s + p[2] * c];
}

/** The inward normal of the boat's section at (t, f), in x-y (starboard side). */
function inwardAt(t, f) {
  const a = hullAt(BOAT, t, Math.max(0, f - 0.01));
  const b = hullAt(BOAT, t, Math.min(1, f + 0.01));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  return [-dy / l, dx / l];
}

/**
 * The fishing boat on the slip at a step of its building (fishHullStep):
 *   1  the keel laid on its blocks, stem and sternpost raised and shored,
 *      the garboard strake fastened to it
 *   2  the shell to about half its height, the frames fitted inside it
 *   3  planked to the sheer, the thwarts across
 *   4  finished: the upper strakes painted blue (as the boat afloat is),
 *      pitched below, the gunwale's cap on
 * and what holds it there (keel blocks, shores, braces) and the windlass's
 * hawser to the sternpost. The model's metres, as the yard's.
 */
export function buildFishHull(step, { lod = 0, seed = 11 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const m = waterMaterials();
  const p = new TaggedParts('fish-hull');
  const out = bins('wood', 'blue', 'cradle', 'rope');
  const rnd = artRng(seed);
  const NT = lod === 0 ? 24 : lod === 1 ? 12 : 6;
  const strakes = lod === 0 ? 8 : lod === 1 ? 5 : 3;
  const laid = step === 1 ? 1 : step === 2 ? Math.ceil(strakes * 0.5) : strakes;
  const finished = step >= 4;
  const T0 = 0.015;
  const T1 = 0.985;
  const ts = [];
  for (let i = 0; i <= NT; i++) ts.push(T0 + ((T1 - T0) * i) / NT);
  const place = (g) => g;
  for (let s = 0; s < laid; s++) {
    const f0 = s / strakes;
    const f1 = (s + 1) / strakes;
    const tone = 0.82 + rnd() * 0.24;
    const fs = lod === 0 ? [f0, f0 + 0.08 / strakes, f1 - 0.08 / strakes, f1] : [f0, f1];
    const rows = ts.map((t) => fs.map((f) => hullAt(BOAT, t, f)));
    const g = gridSurface(rows, (i, j) => {
      const seam = lod === 0 && (j === 0 || j === fs.length - 1) ? 0.64 : 1;
      // Once finished, pitched dark up to the waterline's strake.
      if (finished && f1 <= 0.36) return 0.2 * seam;
      return tone * seam;
    }, true);
    (finished && f0 >= 0.72 ? out.blue : out.wood).push(place(g), place(mirrored(g)));
    if (lod < 2) {
      const inner = ts.map((t) => fs.map((f) => {
        const q = hullAt(BOAT, t, f);
        const [nx, ny] = inwardAt(t, f);
        return [q[0] + nx * 0.035, q[1] + ny * 0.035, q[2]];
      }));
      const gi = gridSurface(inner, () => 0.5 * tone);
      out.wood.push(gi, mirrored(gi));
    }
  }
  // The top edge of the highest strake laid.
  if (lod < 2 && laid > 0) {
    const f = laid / strakes;
    const rows = ts.map((t) => {
      const q = hullAt(BOAT, t, f);
      const [nx, ny] = inwardAt(t, f);
      return [q, [q[0] + nx * 0.035, q[1] + ny * 0.035, q[2]]];
    });
    const g = gridSurface(rows, () => 0.75, true);
    out.wood.push(g, mirrored(g));
  }
  // The keel, the stem and the sternpost: the stem from the forefoot up along the bow's line past the sheer.
  const keel = [];
  for (let i = 0; i <= 12; i++) {
    const t = 0.03 + (0.94 * i) / 12;
    const q = hullAt(BOAT, t, 0);
    keel.push([0, q[1] - 0.05, q[2]]);
  }
  out.wood.push(sweep(keel, 0.1, 0.12, { side: [1, 0, 0] }));
  for (const [t, dz] of [[T1, 0.1], [T0, -0.08]]) {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const q = hullAt(BOAT, t, k / 6);
      pts.push([0, q[1] - (k ? 0 : 0.03), q[2] + (k / 6) * dz * 0.5]);
    }
    const top = hullAt(BOAT, t, 1);
    pts.push([0, top[1] + 0.16, top[2] + dz]);
    out.wood.push(sweep(pts, 0.09, 0.12, { side: [1, 0, 0], taper: 0.8 }));
  }
  // Frames inside the shell (step 2 on), a floor timber across the keel at each.
  if (step >= 2 && lod < 2) {
    const top = step === 2 ? (laid - 1) / strakes : 0.98;
    const L = BOAT.hull.L - 0.7;
    const every = lod ? 0.9 : 0.5;
    for (let z = -L / 2 + 0.55; z < L / 2 - 0.4; z += every) {
      const t = z / L + 0.5;
      const pts = [];
      const n = lod ? 4 : 7;
      for (let k = 0; k <= n; k++) {
        const f = 0.04 + ((top - 0.04) * k) / n;
        const q = hullAt(BOAT, t, f);
        const [nx, ny] = inwardAt(t, f);
        pts.push([q[0] + nx * 0.08, q[1] + ny * 0.08, q[2]]);
      }
      const g = sweep(pts, 0.06, 0.07, { side: [0, 0, 1] });
      out.wood.push(g, mirrored(g));
      out.wood.push(board(Math.max(0.2, hullAt(BOAT, t, 0.5)[0] * 1.5), 0.07, 0.06, { tone: 1.05 }).translate(0, pts[0][1] - 0.02, z));
    }
  }
  // The thwarts across, and the keelson over the frames (step 3 on).
  if (step >= 3 && lod < 2) {
    for (const t of [0.3, 0.5, 0.72]) {
      const q = hullAt(BOAT, t, 0.82);
      out.wood.push(board(q[0] * 2 - 0.04, 0.045, 0.2, { tone: 1.20 }).translate(0, q[1] - 0.04, q[2]));
    }
  }
  // The gunwale's cap along the sheer, painted (step 4).
  if (finished) {
    const cap = [];
    for (let i = 0; i <= (lod === 2 ? 6 : 16); i++) {
      const t = 0.03 + (0.94 * i) / (lod === 2 ? 6 : 16);
      const q = hullAt(BOAT, t, 1);
      cap.push([q[0] - 0.01, q[1] + 0.03, q[2]]);
    }
    const g = sweep(cap, 0.08, 0.06, { side: [1, 0, 0] });
    out.blue.push(g, mirrored(g));
  }
  // What holds the boat on the slip: keel blocks, shores along both sides, braces at the posts while the shell is low.
  const bl = [];
  const L = BOAT.hull.L - 0.7;
  for (let z = -L / 2 + 0.4; z < L / 2 - 0.2; z += 0.9) {
    const t = z / L + 0.5;
    const q = hullAt(BOAT, t, 0);
    const keelPt = onSlip([0, q[1] - 0.12, q[2]]);
    const base = fishSlipY(keelPt[2]);
    const hgt = keelPt[1] - base;
    if (hgt < 0.06) continue;
    const n = Math.max(1, Math.round(hgt / 0.13));
    for (let k = 0; k < n; k++) {
      const b = k % 2 ? board(0.2, hgt / n - 0.005, 0.44, { tone: 1.00 + (k % 3) * 0.08 }) : board(0.44, hgt / n - 0.005, 0.2, { tone: 1.00 + (k % 3) * 0.08 });
      bl.push(b.translate(F.slipX, base + (k * hgt) / n, keelPt[2]));
    }
  }
  const shoreF = step === 1 ? 0.15 : 0.4;
  for (const t of lod === 2 ? [0.4] : [0.28, 0.5, 0.72]) {
    for (const s of [-1, 1]) {
      const q = hullAt(BOAT, t, shoreF);
      const at = onSlip([s * (q[0] + 0.04), q[1], q[2]]);
      const foot = [F.slipX + s * (F.slipHalf - 0.1), fishSlipY(at[2]), at[2]];
      bl.push(beam(foot, at, 0.08, seed + t * 10 + s, lod));
    }
  }
  if (step <= 2) {
    const bow = onSlip(hullAt(BOAT, T1, 1));
    const stern = onSlip(hullAt(BOAT, T0, 1));
    bl.push(beam([F.slipX, fishSlipY(bow[2] + 0.9), bow[2] + 0.9], [F.slipX, bow[1] + 0.05, bow[2] + 0.08], 0.07, seed + 41, lod));
    bl.push(beam([F.slipX, fishSlipY(stern[2] - 0.9), stern[2] - 0.9], [F.slipX, stern[1] + 0.05, stern[2] - 0.08], 0.07, seed + 42, lod));
  }
  out.cradle.push(...bl);
  // The windlass's hawser from the drum to the sternpost's foot.
  if (lod < 2) {
    const [wx, wy, wz] = F.windlass;
    const st = onSlip([0, 0.4, hullAt(BOAT, T0, 0)[2] - 0.05]);
    const mid = [(wx + st[0]) / 2, Math.min(wy, st[1]) - 0.05, (wz + st[2]) / 2];
    out.rope.push(tube([[wx, wy - 0.2, wz + 0.05], mid, st], 0.022, { radial: lod ? 4 : 6, segments: lod ? 5 : 12, around: 0.06 }));
  }
  const putOnSlip = (g) => {
    g.rotateX(TILT);
    return g.translate(F.slipX, fishSlipY(F.hullZ) + F.keelBlocks, F.hullZ);
  };
  p.add('hull-planks', m.wood, out.wood.map(putOnSlip));
  if (out.blue.length) p.add('hull-paint', m.blue, out.blue.map(putOnSlip));
  p.add('cradle', m.wood, out.cradle);
  if (out.rope.length) p.add('hawser', m.rope, out.rope);
  return p.build();
}

/**
 * The yard's people (people/actors.js specs, its metres facing +z;
 * models/waterside.js turns them to the water) while it is staffed: the
 * winder at the windlass's crank on the flags beside the slip, a labourer
 * carrying a sack from the timber out to the deck, the man stirring the
 * pitch kettle; with a boat on the slip (`hull`) the shipwright at its side
 * working it with his adze. Nobody when idle.
 */
export function fishYardActors(state, hull = false) {
  if (state !== 'open') return [];
  const [, wy, wz] = F.windlass;
  const tunic = (seed, tone) => ({ body: 'm', dress: ['tunic:short'], hair: seed % 2 ? 'curls' : 'crop', seed, colours: { tunic: tone } });
  const list = [
    { ...tunic(831, 0x8a6a4a), clip: 'windlass', props: { R: 'crank' }, at: [F.crankX - WINDLASS.x - 0.06, wy - WINDLASS.height, wz - WINDLASS.ahead], ry: 0 },
    { ...tunic(832, 0x7a6a5a), clip: 'carry', props: { L: 'sack' }, at: [0.75, 0.06, -2.25], ry: Math.PI / 2,
      route: { length: 2.8, speed: 0.75, pauseEnd: 2.5, pauseStart: 2.5, clipEnd: 'shoulder', clipStart: 'shoulder' } },
    // At the kettle, stirring: the pot's rim at MORTAR.height before him, so he stands at its far side.
    { ...tunic(833, DYES.fawn), clip: 'stir', props: { R: 'pestle' }, at: [F.kettle.x, 0.06, F.kettle.z + 0.36], ry: Math.PI },
  ];
  if (hull) {
    list.push({ ...tunic(834, 0x5f5a50), clip: 'hammer', props: { R: 'axe' }, at: [F.frame.xs[1] - 0.2, fishSlipY(-1.0), -1.0], ry: -Math.PI / 2 });
  }
  return list;
}
