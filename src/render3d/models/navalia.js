/**
 * models/navalia.js
 * ----------------------------------------------------------------------------
 * The Navalia, the naval dockyard, in the 3D look: designed from the ship
 * sheds and dockyards that are known, not from the 2D sprite:
 *
 *   - The ship sheds (neosoikoi) of Piraeus's Zea and Mounichia harbours,
 *     dug out from 1885 on and again by the Zea Harbour Project: long narrow
 *     bays, each a slipway sloping down into the sea under a gable roof
 *     carried on rows of stone columns, open at the water's end; ships were
 *     hauled up them stern first and kept dry out of season. At Oiniadai in
 *     Acarnania the sheds' slipways are cut in the rock with a timber track
 *     down their middle.
 *   - The navalia of Rome on the Campus Martius by the Tiber, where the
 *     fleet's ships were built and laid up, and the war fleets' yards at
 *     Misenum and Ravenna.
 *   - Building a hull: on a slipway of cross timbers (sleepers) with two
 *     greased ways down it, the keel on blocks, the hull held upright by
 *     shores; the timber seasoned in stacks, iron for the nails and the
 *     ram's fittings, linen for the sail; a windlass at the slip's head to
 *     haul a ship up and to ease it down.
 *
 * So, in 12 m (the land row behind, its two rows out over the water): an
 * open building slip on the west, on a bed of ashlar over the land and on
 * pile bents over the water, sleepers and two ways running down into the
 * sea, the windlass at its head; the liburnian on it as the yard builds
 * it (its own kit: buildNavaliaHull, on its keel blocks and shores, the
 * shipwrights at work beside it); a narrow staging on piles west of the
 * slip; on the east a ship shed after Zea's, its tiled gable roof on two
 * rows of stone pillars standing on harbour concrete piers in the water,
 * open at the sea's end, a slipway under it, its trusses showing, a spare
 * mast and yard on trestles, oars racked along its side and the gear store
 * at its head; behind the shed and beside the windlass the stock yard,
 * where the game lays the timber, iron and linen it holds (models/fleet.js,
 * the warehouse's loads).
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: a man turning the windlass's crank, the lantern lit
 *   'shut'  no staff: nobody, the crank hanging, the lantern out
 * The people are actors (people/: navaliaActors), moving on the GPU: the
 * winder, a clerk, a carrier, and the shipwrights at a hull on the slip.
 *
 * Metres, the middle at the origin, y up, the water side toward +z (as
 * models/harbour.js says). Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, TorusGeometry } from 'three';
import { boxUV, tintGeometry, tube } from '../shapes.js';
import { material } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab, paving, lantern, lanternPane, TaggedParts } from './masonry.js';
import { gableRoof, beam, D } from './rural.js';
import { WINDLASS } from '../people/clips.js';
import {
  HARBOUR, harbourMaterials, sweep, board, pile, pileFoam, pierFoam, deck, oar, ropeCoil, liburnianHull, hullPoint, LIBURNIAN,
} from './harbour.js';

/** The yard's measures (metres): the tests, the lab and the game read them. */
export const NAVALIA = Object.freeze({
  slipX: 2.85, // the building slip's middle line
  slipHalf: 1.5, // half its sleepers' length
  shedSlipX: -2.5, // the shed's slipway's middle line
  headZ: -5.55, // the slips' head
  headY: 0.82, // the ramp's top there
  slope: 0.069, // its fall a metre (4 degrees, about the 1 in 14 of Zea's slipways)
  endZ: 5.88,
  /**
   * The ship shed. Lower than Zea's (whose roofs stood some 7 m up): from
   * the game's camera, 30 degrees down, a roof hides nearly twice its
   * height of what is behind it, and the hull on the slip beside it must
   * show from every side.
   */
  shed: Object.freeze({ x0: -5.62, x1: 0.62, z0: -3.85, z1: 5.7, eave: 2.25, pitch: 22, pillarX: [-5.35, 0.35], pillarZ: [-1.55, 0.85, 3.25, 5.45] }),
  /** The staging on piles beside the slip (x0, x1). */
  staging: Object.freeze([4.62, 5.92]),
  /** Where the hull's middle lies on the slip (z), its keel this high over the ways. */
  hullZ: 0.85,
  keelBlocks: 0.32,
  /**
   * The windlass at the slip's head: its drum's axis (x, y, z), at a man's
   * crank height over the flags beside the slip (people/clips.js WINDLASS);
   * its axle runs out over the slip's west edge to `crankX`, where the
   * winder turns it.
   */
  windlass: Object.freeze([2.85, 0.06 + WINDLASS.height, -5.0]),
  crankX: 1.2,
  /** The lanterns (x, y, z): on the shed's front pillar by the slip and at the slip's head. */
  lamps: Object.freeze([Object.freeze([0.35, 1.45, 5.76]), Object.freeze([4.62, 1.95, -2.2])]),
  /**
   * The stock yard's places, each a cart's load (1 m square, 100 units:
   * models/wares.js buildLoad) [x, y, z, yaw]: timber beside the windlass
   * and behind the shed, iron behind the shed, linen in the shed's gear
   * store.
   */
  stock: Object.freeze({
    timber: Object.freeze([[5.35, 0.06, -5.35, 0], [5.35, 0.06, -4.2, 0], [-0.45, 0.06, -4.95, Math.PI / 2], [-1.6, 0.06, -4.95, Math.PI / 2], [5.35, 0.06, -3.05, 0], [-2.75, 0.06, -4.95, Math.PI / 2]]),
    iron: Object.freeze([[-3.95, 0.06, -4.95, 0], [-5.1, 0.06, -4.95, 0]]),
    linen: Object.freeze([[-0.85, 0.86, -3.0, Math.PI / 2], [-4.7, 0.86, -3.0, Math.PI / 2]]),
  }),
});

const N = NAVALIA;

/** The ramp's top (the sleepers' top) at z, for both slips. */
export function slipY(z) {
  return N.headY - (z - N.headZ) * N.slope;
}

/** The slope's angle (radians), the hull's tilt on it. */
const TILT = Math.atan(N.slope);

/**
 * A slipway down into the water along z at x = xc: over the land a bed of
 * ashlar under the sleepers, over the water pile bents with cap beams and
 * stringers; sleepers across all of it, two greased ways down its middle.
 * `z0` its head. Pushes into out.{stone, wood, ways, foam}.
 */
function slipway(out, xc, half, z0, lod, seed) {
  const rnd = artRng(seed);
  const shore = HARBOUR.shore;
  const end = N.endZ;
  // The bed over the land: blocks whose tops follow the ramp under the sleepers.
  const seg = lod === 2 ? shore - z0 : 1.0;
  for (let z = z0 - 0.15; z < shore - 0.01; z += seg) {
    const zb = Math.min(shore, z + seg);
    const g = new BoxGeometry(half * 2 + 0.18, 1, zb - z - 0.01, 1, 1, 1);
    g.translate(xc, 0.5, (z + zb) / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.5) p.setY(i, slipY(p.getZ(i)) - 0.11);
    g.computeVertexNormals();
    boxUV(g, rnd() * 3, rnd() * 3);
    const k = 0.9 + rnd() * 0.15;
    out.stone.push(tintGeometry(g, (x, y) => k * (0.75 + 0.25 * Math.min(1, y / 0.3))));
  }
  // Over the water: bents of three piles every 1.6 m, a cap beam across each, stringers down the run.
  const xs = [xc - half + 0.2, xc, xc + half - 0.2];
  for (let z = shore + 0.6, k = 0; z < end; z += 1.6, k++) {
    const top = slipY(z) - 0.11 - 0.14 - 0.16;
    if (top < -0.05) break;
    for (const x of xs) {
      out.wood.push(pile(x, z, top, { r: 0.1, seed: seed + k * 7 + x, lod }));
      if (lod < 2) out.foam.push(pileFoam(x, z, 0.1, 0.32, seed + k * 3 + x, lod));
    }
    out.wood.push(board(half * 2 - 0.1, 0.16, 0.16, { tone: 0.7 }).translate(xc, top, z));
  }
  for (const x of xs) {
    out.wood.push(sweep([[x, slipY(shore - 0.1) - 0.11 - 0.07, shore - 0.1], [x, slipY(end) - 0.11 - 0.07, end]], 0.14, 0.14, { side: [1, 0, 0], tint: () => 0.68 }));
  }
  // The sleepers, across the whole run.
  const every = lod === 2 ? 1.2 : lod ? 0.6 : 0.42;
  for (let z = z0 + 0.12; z < end - 0.05; z += every) {
    const g = board(half * 2, 0.11, 0.18, { tone: 0.72 + rnd() * 0.2 });
    g.rotateX(TILT);
    out.wood.push(g.translate(xc, slipY(z) - 0.11, z));
  }
  // The two ways, greased dark, down its middle.
  for (const s of [-1, 1]) {
    out.ways.push(sweep([[xc + s * 0.42, slipY(z0) + 0.05, z0], [xc + s * 0.42, slipY(end) + 0.05, end]], 0.16, 0.1, { side: [1, 0, 0], tint: () => 0.55 }));
  }
}

/** A square stone pillar from y0 to y1 at (x, z): a plinth, the shaft, a capital block. */
function pillar(out, x, z, y0, y1, seed, lod) {
  out.stone.push(slab(0.6, 0.18, 0.6, { bevel: 0.02, seed, wobble: 0.004, tone: 0.05, grime: 0.3 }).translate(x, y0, z));
  out.stone.push(slab(0.44, y1 - y0 - 0.42, 0.44, { bevel: 0.02, seed: seed + 1, wobble: 0.003, tone: 0.06, grime: 0.15 }).translate(x, y0 + 0.18, z));
  out.stone.push(slab(0.6, 0.24, 0.6, { bevel: lod ? 0.02 : 0.04, seed: seed + 2, wobble: 0.003, tone: 0.04, grime: 0 }).translate(x, y1 - 0.24, z));
}

/** The ship shed: pillars on their piers, the beams, trusses and roof, the back wall, the slip and what is stored in it. */
function shed(out, lod, seed) {
  const S = N.shed;
  const rnd = artRng(seed);
  const top = S.eave - 0.3; // the pillars' capitals' top; the beams on them
  for (const x of S.pillarX) {
    S.pillarZ.forEach((z, k) => {
      // Over the water: a pier of harbour concrete faced in tufa from the bed to above the tide, the pillar on it.
      const footY = 0.4;
      const pier = slab(0.82, footY + 0.5, 0.82, { bevel: 0.02, seed: seed + k * 5 + x, wobble: 0.006, tone: 0.06, grime: 0 }).translate(x, -0.5, z);
      out.tufa.push(tintGeometry(pier, (px, py) => (py < 0.08 ? 0.5 : py < 0.35 ? 0.68 : 0.95)));
      if (lod < 2) out.foam.push(pierFoam(x - 0.41, x + 0.41, z - 0.41, z + 0.41, 0.35, seed + k + x, lod));
      pillar(out, x, z, footY, top, seed + 20 + k * 3 + x, lod);
    });
    // The antae at the back wall's ends: pillars standing on the land.
    pillar(out, x, S.z0 + 0.3, 0, top, seed + 60 + x, lod);
  }
  // The beams along the pillars' tops, the length of the shed.
  for (const x of S.pillarX) out.wood.push(board(0.32, 0.3, S.z1 - S.z0 + 0.1, { tone: 0.75 }).translate(x, top, (S.z0 + S.z1) / 2));
  // The roof: a tiled gable along the shed, its eaves over the beams.
  const roof = gableRoof({ x0: S.x0, x1: S.x1, z0: S.z0, z1: S.z1, eaveY: S.eave, pitch: D(S.pitch), along: 'z', lod, seed: seed + 90, over: 0.3, gableOver: 0.18 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // The trusses at the pillars and the open end: a tie beam, two rafters, a king post and two struts.
  const cx = (S.x0 + S.x1) / 2;
  const ridge = roof.ridgeY - 0.12;
  const tieY = S.eave - 0.02;
  const trussZ = lod === 2 ? [S.z1 - 0.12] : [...S.pillarZ.slice(0, -1), S.z1 - 0.12];
  for (const z of trussZ) {
    out.wood.push(board(S.x1 - S.x0 - 0.1, 0.2, 0.18, { tone: 0.7 }).translate(cx, tieY - 0.2, z));
    if (lod === 2) continue;
    out.wood.push(beam([S.x0 + 0.1, tieY, z], [cx, ridge, z], 0.16, seed + z, lod), beam([S.x1 - 0.1, tieY, z], [cx, ridge, z], 0.16, seed + z + 1, lod));
    out.wood.push(board(0.16, ridge - tieY + 0.05, 0.16, { tone: 0.7 }).translate(cx, tieY - 0.05, z));
    if (lod === 0) {
      for (const s of [-1, 1]) out.wood.push(beam([cx, tieY + 0.2, z], [cx + s * 1.55, tieY + (ridge - tieY) * 0.48, z], 0.1, seed + z + 2 + s, lod));
    }
  }
  // The back wall: limestone ashlar in courses to the eaves, the gable over it in brick.
  const wz = S.z0 + 0.2;
  const courses = lod === 2 ? 1 : 5;
  for (let c = 0; c < courses; c++) {
    const y0 = (c * S.eave) / courses;
    const h = S.eave / courses;
    let x = S.x0;
    const off = c % 2 ? 0.45 : 0;
    while (x < S.x1 - 0.02) {
      const xb = Math.min(S.x1, x + (lod === 2 ? 99 : 0.9 + rnd() * 0.5 - (x === S.x0 ? off : 0)));
      out.stone.push(slab(xb - x - 0.01, h - 0.012, 0.4, { bevel: lod ? 0.01 : 0.018, seed: seed + 100 + c * 17 + x * 3, wobble: lod ? 0 : 0.004, tone: 0.07, grime: c ? 0 : 0.4 }).translate((x + xb) / 2, y0, wz));
      x = xb;
    }
  }
  const span = S.x1 - S.x0;
  const rise = (span / 2) * Math.tan(D(S.pitch));
  const gable = new BoxGeometry(0.36, rise, span, 1, 1, 2);
  const gp = gable.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const t = gp.getY(i) > 0;
    gp.setY(i, t ? rise * (1 - Math.abs(gp.getZ(i)) / (span / 2)) : 0);
  }
  gable.computeVertexNormals();
  gable.rotateY(Math.PI / 2).translate(cx, S.eave, wz);
  out.brick.push(tintGeometry(boxUV(gable)));
  // The shed's own slipway under the roof, and its gear store at the head: a flat floor of flags.
  slipway(out, N.shedSlipX, 1.5, S.z0 + 1.55, lod, seed + 300);
  out.stone.push(...paving(S.x0 + 0.5, S.x1 - 0.5, S.z0 + 0.4, S.z0 + 1.6, 0.86, seed + 7, { rowW: 0.6, lod }));
  // (The flags' bed down to the ground.)
  out.stone.push(slab(S.x1 - S.x0 - 1.0, 0.8, 1.2, { bevel: 0.01, seed: seed + 8, wobble: 0, tone: 0, grime: 0.4 }).translate(cx, 0, S.z0 + 1.0));
  if (lod === 2) return;
  // A spare mast and yard on trestles over the slip, oars racked along the west pillars.
  for (const z of [-1.2, 2.6]) {
    for (const s of [-1, 1]) out.wood.push(beam([N.shedSlipX + s * 0.45, slipY(z), z], [N.shedSlipX + s * 0.12, slipY(z) + 0.95, z], 0.07, seed + z + s, lod));
    out.wood.push(board(0.7, 0.07, 0.1).translate(N.shedSlipX, slipY(z) + 0.93, z));
  }
  out.wood.push(sweep([[N.shedSlipX + 0.12, slipY(-1.2) + 1.06, -2.0], [N.shedSlipX + 0.12, slipY(2.6) + 1.06, 4.2]], 0.16, 0.16, { side: [1, 0, 0], taper: 0.7 }));
  out.wood.push(sweep([[N.shedSlipX - 0.18, slipY(-1.2) + 1.04, -1.6], [N.shedSlipX - 0.18, slipY(2.6) + 1.04, 3.6]], 0.1, 0.1, { side: [1, 0, 0], taper: 0.6 }));
  // Oars racked on pegs along the inside of the outer pillars: three tiers of a bank's oars, the
  // blades alternately fore and aft, between each pair of pillars.
  const rackX = S.pillarX[0] + 0.32;
  const tiers = lod ? 2 : 3;
  for (let b = 0; b < S.pillarZ.length - 1; b++) {
    const z0 = S.pillarZ[b] + 0.26;
    for (let t = 0; t < tiers; t++) {
      const y = 1.25 + t * 0.2;
      for (let k = 0; k < (lod ? 2 : 4); k++) {
        const flip = (k + t) % 2;
        for (const g of oar(1.9, lod)) {
          if (flip) g.rotateY(Math.PI).translate(0, 0, 1.9);
          out.oars.push(g.translate(rackX + k * 0.075, y + 0.035, z0));
        }
      }
      if (lod === 0) for (const z of [z0 + 0.25, z0 + 1.65]) out.iron.push(tintGeometry(boxUV(new BoxGeometry(0.34, 0.025, 0.025).translate(rackX + 0.1, y, z)), () => 0.8));
    }
  }
  out.rope.push(...ropeCoil(S.x1 - 1.2, 0.86, S.z0 + 0.9, 0.32, 4, lod), ...ropeCoil(S.x0 + 2.2, 0.86, S.z0 + 0.95, 0.26, 3, lod));
}

/** The windlass at the building slip's head: standards, the drum with its rope, its axle out to a crank, spare bars. */
function windlass(out, lod, seed) {
  const [x, y, z] = N.windlass;
  for (const s of [-1, 1]) {
    out.wood.push(board(0.2, 0.16, 1.1, { tone: 0.7 }).translate(x + s * 0.75, slipY(z) - 0.02, z));
    out.wood.push(board(0.18, y + 0.32 - slipY(z), 0.18, { tone: 0.85 }).translate(x + s * 0.75, slipY(z) + 0.12, z));
    if (lod < 2) {
      out.wood.push(beam([x + s * 0.75, slipY(z) + 0.14, z - 0.48], [x + s * 0.75, y - 0.05, z - 0.05], 0.09, seed + s, lod));
      out.wood.push(beam([x + s * 0.75, slipY(z) + 0.14, z + 0.48], [x + s * 0.75, y - 0.05, z + 0.05], 0.09, seed + s + 4, lod));
    }
  }
  const seg = lod === 0 ? 16 : lod ? 10 : 6;
  const drum = new CylinderGeometry(0.17, 0.17, 1.32, seg);
  drum.rotateZ(Math.PI / 2).translate(x, y, z);
  out.wood.push(tintGeometry(boxUV(drum), () => 0.8));
  // Its axle out to the west over the slip's edge, on a post of its own, to the crank at its end.
  const cx = N.crankX;
  const axle = new CylinderGeometry(0.06, 0.06, x - 0.66 - cx, lod ? 6 : 10);
  axle.rotateZ(Math.PI / 2).translate((x - 0.66 + cx) / 2, y, z);
  out.wood.push(tintGeometry(boxUV(axle), () => 0.75));
  out.wood.push(board(0.16, y + 0.12 - slipY(z), 0.16, { tone: 0.85 }).translate(cx + 0.24, slipY(z), z));
  // The crank at rest while nobody turns it: its iron boss, the arm hanging, the handle toward the flags.
  const hub = new CylinderGeometry(0.03, 0.03, 0.06, lod ? 6 : 10);
  hub.rotateZ(Math.PI / 2).translate(cx - 0.03, y, z);
  out.crankIron.push(tintGeometry(boxUV(hub), () => 0.8));
  out.crank.push(board(0.04, WINDLASS.arm + 0.06, 0.05, { tone: 0.85 }).translate(cx - 0.03, y - WINDLASS.arm - 0.03, z));
  const handle = new CylinderGeometry(0.022, 0.022, 0.4, lod ? 5 : 8);
  handle.rotateZ(Math.PI / 2).translate(cx - 0.03 - 0.2, y - WINDLASS.arm, z);
  out.crank.push(tintGeometry(boxUV(handle), () => 0.72));
  if (lod < 2) {
    // The hawser wound round the drum's middle.
    for (let k = 0; k < 7; k++) {
      const g = new TorusGeometry(0.2, 0.03, lod ? 4 : 6, seg);
      g.rotateY(Math.PI / 2).translate(x - 0.2 + k * 0.065, y, z);
      out.rope.push(tintGeometry(boxUV(g), () => 0.85));
    }
    for (const s of [-1, 1]) {
      const band = new TorusGeometry(0.175, 0.015, 4, seg);
      band.rotateY(Math.PI / 2).translate(x + s * 0.6, y, z);
      out.iron.push(tintGeometry(boxUV(band), () => 0.8));
    }
  }
  // The bars (handspikes) for a heavy haul, laid down by the drum while the crank does.
  for (const s of [-1, 1]) out.bars.push(board(0.07, 0.07, 1.6).translate(x + s * 0.3, slipY(z + 0.7) + 0.0, z + 0.75));
}

/** The staging beside the slip: a narrow deck on piles over the water, a ladder down at its end. */
function staging(out, lod, seed) {
  const [x0, x1] = N.staging;
  const shore = HARBOUR.shore;
  const y = HARBOUR.deckY;
  out.wood.push(...deck(x0, x1, shore, N.endZ - 0.05, y, { along: 'x', seed, lod, plank: 0.24, bearers: 1.55 }));
  for (let z = shore + 0.45, k = 0; z < N.endZ; z += 1.55, k++) {
    for (const x of [x0 + 0.12, x1 - 0.12]) {
      out.wood.push(pile(x, z, y - 0.22, { r: 0.1, seed: seed + k * 5 + x, lod }));
      if (lod < 2) out.foam.push(pileFoam(x, z, 0.1, 0.3, seed + k + x, lod));
    }
  }
  if (lod < 2) {
    // A ladder down to the water at the end, for a boat.
    for (const s of [-1, 1]) out.wood.push(board(0.05, y + 0.3, 0.05).translate(x1 - 0.65 + s * 0.2, -0.3, N.endZ - 0.02));
    for (let k = 0; k < 3; k++) out.wood.push(board(0.42, 0.04, 0.04).translate(x1 - 0.65, 0.08 + k * 0.22, N.endZ - 0.02));
    // A bollard of timber at the end for the boats' lines.
    out.wood.push(pile(x0 + 0.3, N.endZ - 0.3, y + 0.45, { r: 0.09, seed: seed + 77, lod }));
  }
}

/** The stock yard's ground: limestone flags over the land row, round the slip's bed. */
function yard(out, lod, seed) {
  const H = HARBOUR.half - 0.02;
  const shore = HARBOUR.shore;
  const opts = { rowW: 0.62, minL: 0.5, maxL: 1.0, lod };
  const S = N.shed;
  const a = N.slipX - N.slipHalf - 0.12;
  const b = N.slipX + N.slipHalf + 0.12;
  // Behind the shed; between the shed and the slip; beside the slip.
  out.flags.push(...paving(-H, S.x1, -H, S.z0, 0.06, seed + 1, opts));
  out.flags.push(...paving(S.x1, a, -H, shore, 0.06, seed + 2, opts));
  out.flags.push(...paving(b, H, -H, shore, 0.06, seed + 3, opts));
  // The quay's edge at the shore line, where the land ends over the water: a row of stone, a step down.
  if (lod < 2) {
    for (const [x0, x1] of [[S.x1 - 0.1, a], [b, H]]) {
      out.stone.push(slab(x1 - x0, 0.5, 0.3, { bevel: 0.02, seed: seed + x0, wobble: 0.003, tone: 0.05, grime: 0.5 }).translate((x0 + x1) / 2, -0.4, shore - 0.12));
    }
  }
  if (lod === 2) return;
  // A sawing trestle with a plank and a frame saw by the timber behind the shed.
  const tx = -3.6;
  const tz = -4.15;
  for (const s of [-1, 1]) {
    out.wood.push(beam([tx + s * 0.5, 0.06, tz - 0.25], [tx + s * 0.5, 0.75, tz], 0.06, seed + 30 + s, lod), beam([tx + s * 0.5, 0.06, tz + 0.25], [tx + s * 0.5, 0.75, tz], 0.06, seed + 32 + s, lod));
  }
  out.wood.push(board(1.6, 0.08, 0.3, { tone: 1.05 }).translate(tx - 0.1, 0.76, tz));
  if (lod === 0) {
    out.wood.push(board(0.04, 0.5, 0.04).translate(tx + 0.3, 0.84, tz + 0.05), board(0.04, 0.5, 0.04).translate(tx + 0.85, 0.84, tz + 0.05), board(0.6, 0.04, 0.04).translate(tx + 0.58, 1.3, tz + 0.05));
    out.iron.push(tintGeometry(boxUV(new BoxGeometry(0.56, 0.06, 0.006).translate(tx + 0.58, 0.88, tz + 0.05))));
  }
}

/** Build the Navalia's building (no hull, no stock: those are kits of their own): { group, meshes, triangles }. */
export function buildNavalia({ lod = 0, seed = 61, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = { flags: [], stone: [], tufa: [], brick: [], wood: [], ways: [], tile: [], iron: [], rope: [], oars: [], foam: [], bars: [], crank: [], crankIron: [] };
  yard(out, lod, seed);
  slipway(out, N.slipX, N.slipHalf, N.headZ, lod, seed + 100);
  shed(out, lod, seed + 400);
  windlass(out, lod, seed + 600);
  staging(out, lod, seed + 700);
  const m = harbourMaterials();
  const p = new TaggedParts('navalia');
  p.add('flags', m.stone, out.flags);
  p.add('stone', m.trav, out.stone);
  p.add('piers', m.tufa, out.tufa);
  p.add('gable', m.brick, out.brick);
  p.add('timber', m.wood, out.wood);
  p.add('ways', material('greased-ways', { surface: 'wood', color: 0x6a5a48, vertexColors: true, snow: 1 }), out.ways);
  p.add('roof', m.tile, out.tile);
  p.add('timber', m.wood, out.oars);
  if (lod < 2) {
    p.add('iron', m.iron, out.iron);
    p.add('rope', m.rope, out.rope);
  }
  // (Where the water laps the piles and piers; gone in a hard frost, when the margins freeze.)
  if (!ice) p.add('foam', m.foam, out.foam, { cast: false });
  p.add('bars', m.wood, out.bars);
  // The windlass's crank at rest while the yard is idle (at work the winder turns his own: navaliaActors).
  p.add('crank', m.wood, out.crank, { when: 'shut' });
  if (lod < 2) p.add('crank-iron', m.iron, out.crankIron, { when: 'shut' });
  // The lanterns: on the shed's front pillar and on a post at the slip's head.
  if (lod < 2) {
    const panes = [];
    const bronze = [];
    for (const [lx, ly, lz] of N.lamps) {
      const l = lantern(lx, ly, lz, lod);
      bronze.push(...l.bronze);
      panes.push(l.pane);
    }
    // (The slip's lantern on a post of its own; the shed's on an iron bracket out of its pillar.)
    const [px, , pz] = N.lamps[1];
    const py = N.lamps[1][1];
    p.add('timber', m.wood, [board(0.14, py + 0.5, 0.14).translate(px + 0.4, 0.06, pz), board(0.5, 0.07, 0.07).translate(px + 0.2, py + 0.42, pz)]);
    const [sx, sy, sz] = N.lamps[0];
    bronze.push(tube([[sx, sy + 0.42, sz - 0.33], [sx, sy + 0.45, sz - 0.05], [sx, sy + 0.36, sz]], 0.014, { radial: 4, segments: 4, around: 0.3 }));
    bronze.push(tube([[px, py + 0.42, pz], [px, py + 0.3, pz]], 0.012, { radial: 4, segments: 2, around: 0.3 }));
    p.add('lantern', m.bronze, bronze);
    p.add('lamp', lanternPane(), panes, { when: 'open', cast: false });
    p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), panes.map((g) => g.clone()), { when: 'shut', cast: false });
  }
  // (The yard's men are actors: navaliaActors.)
  return p.build();
}

/**
 * The yard's people (people/actors.js specs, its metres facing +z;
 * models/fleet.js turns them to the water) while it is staffed: the winder
 * at the windlass's crank on the flags by the slip (his own crank: props.js
 * crank, WINDLASS), a clerk with his tablet tallying the iron behind the
 * shed, a man carrying a sack out along the staging to the boats; with a
 * hull on the slip (`hull`), two shipwrights driving the pegs of its
 * planking with mallet and chisel, one either side. Nobody when idle.
 */
export function navaliaActors(state, hull = false) {
  if (state !== 'open') return [];
  const [, wy, wz] = N.windlass;
  const tunic = (seed, tone) => ({ body: 'm', dress: ['tunic:short'], hair: seed % 2 ? 'curls' : 'crop', seed, colours: { tunic: tone } });
  const list = [
    // Facing the water (+z), the crank's axle WINDLASS.ahead before him and up, the axle running off to his left.
    { ...tunic(611, 0x8a6a4a), clip: 'windlass', props: { R: 'crank' }, at: [N.crankX - WINDLASS.x - 0.06, wy - WINDLASS.height, wz - WINDLASS.ahead], ry: 0 },
    { body: 'm', dress: ['tunic:knee', 'paenula'], hair: 'crop', beard: 'short', clip: 'hold', props: { R: 'tablet' }, at: [-4.95, 0.06, -4.2], ry: Math.PI, seed: 612, colours: { tunic: 0xa89070, mantle: 0x6a5240 } },
    { ...tunic(613, 0x7a6a5a), clip: 'carry', props: { L: 'sack' }, at: [(N.staging[0] + N.staging[1]) / 2, HARBOUR.deckY, HARBOUR.shore + 0.4], ry: 0,
      route: { length: 5.0, speed: 0.75, pauseEnd: 2.5, pauseStart: 2.5, clipEnd: 'shoulder', clipStart: 'shoulder' } },
  ];
  if (hull) {
    for (const [s, z, seed, tone] of [[1, 1.4, 614, 0x7a5a3a], [-1, -0.9, 615, 0x5f5a50]]) {
      list.push({ ...tunic(seed, tone), clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [N.slipX + s * (N.slipHalf - 0.25), slipY(z), z], ry: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
  }
  return list;
}

/** Where the hull sits: its keel's bottom amidships (x, y, z) over the building slip, and its tilt. */
export function hullPlace() {
  return { x: N.slipX, y: slipY(N.hullZ) + N.keelBlocks, z: N.hullZ, tilt: TILT };
}

/** A point of the hull's own frame ([x, y, z]) on the slip (the model's metres). */
function onSlip(p) {
  const h = hullPlace();
  const c = Math.cos(h.tilt);
  const s = Math.sin(h.tilt);
  return [h.x + p[0], h.y + p[1] * c - p[2] * s, h.z + p[1] * s + p[2] * c];
}

/**
 * The liburnian on the slip at a step of its building (1 to 4: models/
 * harbour.js liburnianHull), with what holds it there: the keel blocks,
 * the shores along its sides, the braces of the posts while the shell is
 * low, the windlass's hawser to its stern. The model's metres.
 */
export function buildNavaliaHull(step, { lod = 0, seed = 7 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const m = harbourMaterials();
  const p = new TaggedParts('navalia-hull');
  const h = liburnianHull(step, { lod, seed });
  const place = (g) => {
    const hp = hullPlace();
    g.rotateX(hp.tilt);
    return g.translate(hp.x, hp.y, hp.z);
  };
  for (const [k, list] of Object.entries(h)) {
    if (!list.length) continue;
    p.add(`hull-${k}`, m[k], list.map(place));
  }
  const wood = [];
  // The keel blocks: short timbers stacked crosswise from the sleepers to the keel, every 1.1 m.
  const { L } = LIBURNIAN;
  for (let z = -L / 2 + 0.9; z < L / 2 - 0.6; z += 1.1) {
    const t = z / (L - 0.7) + 0.5;
    const keel = onSlip([0, hullPoint(t, 0)[1] - 0.17, hullPoint(t, 0)[2]]);
    const base = slipY(keel[2]);
    const hgt = keel[1] - base;
    const n = Math.max(1, Math.round(hgt / 0.13));
    for (let k = 0; k < n; k++) {
      const b = k % 2 ? board(0.24, hgt / n - 0.005, 0.5, { tone: 0.75 + (k % 3) * 0.08 }) : board(0.5, hgt / n - 0.005, 0.24, { tone: 0.75 + (k % 3) * 0.08 });
      wood.push(b.translate(N.slipX, base + (k * hgt) / n, keel[2]));
    }
  }
  // Shores along both sides, from the sleepers' ends to the turn of the bilge.
  const shoreF = step === 1 ? 0.2 : 0.45;
  for (const t of lod === 2 ? [0.3, 0.7] : [0.22, 0.4, 0.58, 0.76]) {
    for (const s of [-1, 1]) {
      const q = hullPoint(t, shoreF);
      const at = onSlip([s * (q[0] + 0.05), q[1], q[2]]);
      const foot = [N.slipX + s * (N.slipHalf - 0.12), slipY(at[2]), at[2]];
      wood.push(beam(foot, at, 0.09, seed + t * 10 + s, lod));
    }
  }
  // While the shell is low, raking braces hold the stem and the sternpost up.
  if (step <= 2) {
    const bow = onSlip(hullPoint(0.985, 1));
    const stern = onSlip(hullPoint(0.015, 1));
    wood.push(beam([N.slipX, slipY(bow[2] + 1.0), bow[2] + 1.0], [N.slipX, bow[1] + 0.1, bow[2] + 0.1], 0.08, seed + 41, lod));
    wood.push(beam([N.slipX, slipY(stern[2] - 1.1), stern[2] - 1.1], [N.slipX, stern[1] + 0.5, stern[2] - 0.15], 0.08, seed + 42, lod));
  }
  p.add('cradle', m.wood, wood);
  // The windlass's hawser down the slip to the sternpost's foot.
  if (lod < 2) {
    const [wx, wy, wz] = N.windlass;
    const st = onSlip([0, 0.55, hullPoint(0.015, 0)[2] - 0.05]);
    const mid = [(wx + st[0]) / 2, Math.min(wy, st[1]) - 0.05, (wz + st[2]) / 2];
    p.add('hawser', m.rope, [tube([[wx, wy - 0.2, wz + 0.05], mid, st], 0.025, { radial: lod ? 4 : 6, segments: lod ? 6 : 14, around: 0.06 })]);
  }
  // (The shipwrights at work beside it are actors: navaliaActors.)
  return p.build();
}
