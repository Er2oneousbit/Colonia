/**
 * models/tradeDock.js
 * ----------------------------------------------------------------------------
 * The Emporium (the Trade Dock) in the 3D look: designed from the harbour
 * works of about 300 BC that are known, not from the 2D sprite:
 *
 *   - The quays of the Greek and Etruscan trading harbours of Italy and
 *     Sicily (Syracuse, Pyrgi, Spina, early Ostia): squared blocks of tufa
 *     in courses on a rubble footing, the face stepped back at the
 *     waterline, mooring stones bored for the hawsers, a kerb of cut stone
 *     along the edge (harbour.js quayMole).
 *   - Timber landing stages beside them, run out over the water on bents of
 *     driven piles where a mole of stone was not worth the cost (jetty).
 *   - The emporion's warehouses, the stoai of Piraeus and Delos: a long
 *     shed of plastered rubble with a tiled roof, open on the quay side so
 *     the goods can be carried in and out, the goods stacked in bays.
 *   - Cranes: the earliest were Greek (the 6th century BC, the temple
 *     builders' lifting machines of Vitruvius X): shear legs, two poles
 *     lashed at the head and spread at the foot, a back stay and a tackle
 *     worked from a windlass on the quay. The treadwheel came later.
 *   - The customs: harbour dues (the portorium) were taken at the quay,
 *     a clerk at a table counting the toll into a purse.
 *
 * So, in 12 m (the shore row behind, two rows out over the water): the
 * whole is a terrace of ashlar one step above the street (T = 0.5 m), with
 * steps up from the back; on the west a mole of tufa runs out to the
 * water, a crane of shear legs and its windlass on it; on the east a
 * timber jetty on piles, bollards along its edge, a gangplank stowed on its
 * deck; the merchant ship lies alongside the whole front, which is kept
 * clear (sim and render/ships: moored a hand off the quay's face, so
 * nothing here stands past the front line). The shed stands on the west of
 * the terrace, open to the quay and the east; the goods the dock holds are
 * the warehouse's loads (models/wares.js), on the quay before the shed and
 * in its bays; a customs table with its standard on the east of the
 * terrace.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the lanterns lit, a crate on the crane's hook; its
 *           people are actors (tradeDockActors): a man at the windlass, two
 *           dockers carrying loads between the quay and the ship's berth,
 *           the customs clerk counting
 *   'shut'  no staff: nobody, the windlass's crank hanging, lanterns out
 *
 * Metres, the middle at the origin, y up, the water side toward +z
 * (models/harbour.js says). Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, TorusGeometry } from 'three';
import { boxUV, tintGeometry, tube } from '../shapes.js';
import { slab, paving, TaggedParts } from './masonry.js';
import { gableRoof, beam, D } from './rural.js';
import { WINDLASS } from '../people/clips.js';
import { DYES } from '../people/actors.js';
import { HARBOUR, board, pierFoam, ashlar, bollard, mooringRing, jetty, quayMole, ropeCoil } from './harbour.js';
import { waterMaterials, bins, gableWall, addLanterns } from './watersideKit.js';

const T = 0.5; // the terrace's, the quay's and the jetty's top

/** The dock's measures (metres): the tests, the lab and the game read them. */
export const TRADE_DOCK = Object.freeze({
  half: 6,
  top: T,
  front: 5.92, // the quay's and the jetty's front edge (the footprint's 6, a hand in)
  mole: Object.freeze([-6, -0.5]), // the stone quay's x range over the water rows
  /** The shed on the terrace's west: walls' outer faces, eave height, pitch. Open to +z and +x. */
  shed: Object.freeze({ x0: -5.7, x1: -1.0, z0: -5.45, z1: -1.4, eave: T + 2.45, pitch: 24 }),
  /** The shear legs: the feet (x, z) and the head (x, y, z); the back stay's bollard. */
  crane: Object.freeze({ feet: Object.freeze([[-1.9, 3.8], [-0.8, 3.8]]), head: Object.freeze([-1.35, T + 4.9, 5.55]), stay: Object.freeze([-1.35, 1.5]) }),
  /** The crane's windlass: the drum's axis (x, y, z), its crank's x (it lies to the winder's left, +x). */
  winch: Object.freeze({ x: -1.45, y: T + WINDLASS.height, z: 2.9, crankX: -2.26 }),
  /** The customs table's middle (x, z) and its top. */
  customs: Object.freeze({ x: 3.4, z: -3.9, top: T + 0.86 }),
  /** The lanterns [x, y of the lantern's base, z, y of the post's foot]. */
  lamps: Object.freeze([Object.freeze([0.55, T + 1.9, -0.9, T]), Object.freeze([4.6, T + 1.6, 5.5, T])]),
  /**
   * The places of the goods in transit, each a cart's load (1 m square,
   * 100 units: models/wares.js buildLoad) [x, y, z, yaw]: on the quay
   * before the shed first (they are seen from the sea), then in its bays.
   */
  loads: Object.freeze([
    [-5.1, T, 0.3, 0], [-3.95, T, 0.3, 0], [-2.8, T, 0.3, 0], [-5.1, T, 1.5, 0], [-3.95, T, 1.5, 0], [-2.8, T, 1.5, 0],
    [-5.1, T, -4.55, 0], [-3.95, T, -4.55, 0], [-2.8, T, -4.55, 0], [-5.1, T, -3.3, 0], [-3.95, T, -3.3, 0], [-2.8, T, -3.3, 0],
  ].map((p) => Object.freeze(p))),
});

const K = TRADE_DOCK;

/** The terrace over the shore row: ashlar faces back and ends, steps up in the back, flags on top. */
function terrace(out, lod, seed) {
  const H = K.half - 0.02;
  // The faces: the back (with the steps' gap in the middle) and the two ends down to the shore line.
  const gap = [-0.9, 0.9];
  out.tufa.push(...ashlar(-H, gap[0], 0, T, -H, -H + 0.4, { seed, lod, course: 0.25 }));
  out.tufa.push(...ashlar(gap[1], H, 0, T, -H, -H + 0.4, { seed: seed + 1, lod, course: 0.25 }));
  for (const [x0, x1, k] of [[-H, -H + 0.4, 2], [H - 0.4, H, 3]]) {
    out.tufa.push(...ashlar(x0, x1, 0, T, -H + 0.4, HARBOUR.shore, { seed: seed + k, lod, course: 0.25 }));
  }
  // The fill under the flags, and the flags: the terrace is solid.
  out.stone.push(slab(2 * H - 0.8, T - 0.12, HARBOUR.shore - (-H + 0.4), { bevel: 0.01, seed: seed + 5, wobble: 0, tone: 0, grime: 0 }).translate(0, 0, (-H + 0.4 + HARBOUR.shore) / 2));
  out.flags.push(...paving(-H + 0.4, H - 0.4, -H + 0.4, HARBOUR.shore, 0.12, seed + 6, { rowW: 0.62, lod }).map((g) => g.translate(0, T - 0.12, 0)));
  // Two steps up from the street between the back faces.
  for (let k = 0; k < 2; k++) {
    out.stone.push(slab(gap[1] - gap[0], (T * (k + 1)) / 2, 0.34, { bevel: 0.015, seed: seed + 10 + k, wobble: lod ? 0 : 0.003, tone: 0.05, grime: 0.3 }).translate(0, 0, -H + 0.17 + k * 0.34));
  }
  // The stone quay (a mole of tufa) on the west over the water rows, its kerb of travertine along the top.
  const mole = quayMole(HARBOUR.shore, K.front, (K.mole[0] + K.mole[1]) / 2, K.mole[1] - K.mole[0] - 0.12, T, { along: 'z', seed: seed + 20, lod, kerb: true });
  out.tufa.push(...mole.tufa);
  out.stone.push(...mole.trav);
  if (lod < 2) {
    out.foam.push(pierFoam(K.mole[0], K.mole[1], HARBOUR.shore + 0.1, K.front, 0.4, seed + 21, lod, K.half));
    // Rings on the quay's front face, bollards along its edge.
    for (const x of [-4.6, -2.0]) out.iron.push(mooringRing(x, T - 0.14, K.front, 1, lod));
  }
  for (const x of lod === 2 ? [-3.4] : [-3.4, -0.9]) out.stone.push(bollard(x, T, K.front - 0.38, lod));
}

/** The timber jetty on the east over the water rows, the berth's other half: piles, caps, planks, fenders, bollards. */
function stage(out, lod, seed) {
  const x0 = K.mole[1];
  const j = jetty(x0 - 0.04, K.half - 0.04, HARBOUR.shore, K.front, T, { seed, lod, half: K.half });
  out.wood.push(...j.wood);
  out.foam.push(...j.foam);
  out.stone.push(bollard(3.4, T, K.front - 0.4, lod));
  if (lod < 2) {
    out.stone.push(bollard(0.9, T, K.front - 0.4, lod));
    // The gangplank stowed along the jetty's east edge, a few cleats across it for a foothold, a coil of the hawser beside it.
    out.wood.push(board(0.55, 0.08, 3.4, { tone: 1.35 }).translate(5.2, T, 3.0));
    for (let k = 0; k < 6; k++) out.wood.push(board(0.55, 0.04, 0.06, { tone: 0.85 }).translate(5.2, T + 0.08, 1.5 + k * 0.6));
    out.rope.push(...ropeCoil(4.5, T, 4.7, 0.3, 4, lod));
  }
}

/** The shed: plastered back and west walls, posts and beams on the open sides, the tiled roof, trusses, partitions between the bays. */
function shed(out, lod, seed) {
  const S = K.shed;
  const xc = (S.x0 + S.x1) / 2;
  const zc = (S.z0 + S.z1) / 2;
  const span = S.z1 - S.z0;
  const h = S.eave - T;
  const rise = (span / 2) * Math.tan(D(S.pitch));
  // The back wall and the west end, with its gable; the east end open under its gable.
  out.plaster.push(slab(S.x1 - S.x0, h, 0.3, { bevel: 0.01, seed: seed + 1, wobble: 0, tone: 0.03, grime: 0.25 }).translate(xc, T, S.z0 + 0.15));
  out.plaster.push(slab(0.3, h, span - 0.3, { bevel: 0.01, seed: seed + 2, wobble: 0, tone: 0.03, grime: 0.25 }).translate(S.x0 + 0.15, T, zc + 0.15));
  out.plaster.push(gableWall(S.x0 + 0.15, zc, span, 0.3, S.eave, rise));
  out.plaster.push(gableWall(S.x1 - 0.15, zc, span, 0.3, S.eave, rise));
  // Posts on the open sides (the front row, the east end's) and the beams they carry.
  const px = [S.x0 + 0.2, (S.x0 + S.x1) / 2 - 0.15, S.x1 - 0.2];
  for (const x of px) out.wood.push(board(0.24, h - 0.1, 0.24, { tone: 1.05, grime: 0.2 }).translate(x, T, S.z1 - 0.2));
  out.wood.push(board(0.24, h - 0.1, 0.24, { tone: 1.05 }).translate(S.x1 - 0.2, T, zc));
  out.wood.push(board(0.24, h - 0.1, 0.24, { tone: 1.05 }).translate(S.x1 - 0.2, T, S.z0 + 0.3));
  out.wood.push(board(S.x1 - S.x0, 0.24, 0.26, { tone: 0.97 }).translate(xc, S.eave - 0.24, S.z1 - 0.2));
  out.wood.push(board(0.26, 0.24, span, { tone: 0.97 }).translate(S.x1 - 0.2, S.eave - 0.24, zc));
  // The roof.
  const roof = gableRoof({ x0: S.x0, x1: S.x1, z0: S.z0, z1: S.z1, eaveY: S.eave, pitch: D(S.pitch), along: 'x', lod, seed: seed + 30, over: 0.25, gableOver: 0.16 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  if (lod < 2) {
    // Tie beams across the shed at the posts, a king post and two struts on the open side's.
    for (const x of [px[1], px[2]]) {
      out.wood.push(board(0.2, 0.2, span, { tone: 0.95 }).translate(x, S.eave - 0.44, zc));
      out.wood.push(board(0.16, rise * 0.78, 0.16, { tone: 0.95 }).translate(x, S.eave - 0.24, zc));
      if (lod === 0) for (const s of [-1, 1]) out.wood.push(beam([x, S.eave - 0.24, zc + s * 1.55], [x, S.eave - 0.24 + rise * 0.5, zc + s * 0.15], 0.1, seed + x * 3 + s, lod));
    }
    // Low partitions between the bays of goods.
    for (const x of [-4.525, -3.375]) {
      out.wood.push(board(0.07, 1.0, 2.3, { tone: 1.10 }).translate(x, T, -4.0));
      out.wood.push(board(0.1, 1.15, 0.1, { tone: 1.05 }).translate(x, T, -2.8));
    }
  }
}

/** The crane: shear legs on their footings, the lashing at the head, the tackle, the back stay and the windlass. */
function crane(out, lod, seed) {
  const C = K.crane;
  const head = C.head;
  for (const [x, z] of C.feet) {
    out.stone.push(slab(0.5, 0.16, 0.5, { bevel: 0.02, seed: seed + x * 7, wobble: 0.003, tone: 0.05, grime: 0.3 }).translate(x, T, z));
    out.wood.push(beam([x, T + 0.12, z], head, 0.19, seed + z + x, lod));
  }
  // The legs are lashed at the head: turns of rope, and a bronze-strapped sheave block between them.
  if (lod < 2) {
    for (let k = 0; k < 3; k++) {
      const g = new TorusGeometry(0.17, 0.035, 4, lod ? 8 : 12);
      g.rotateX(Math.PI / 2).translate(head[0], head[1] - 0.18 - k * 0.07, head[2] - 0.2 - k * 0.02);
      out.rope.push(tintGeometry(boxUV(g), () => 0.85));
    }
  }
  // The fall: from the head down to the block, the hook below it; the back stay to its bollard.
  const bx = head[0];
  const bz = head[2] - 0.05;
  const blockY = T + 2.1;
  out.rope.push(tube([[head[0], head[1] - 0.2, head[2] - 0.12], [bx, (head[1] + blockY) / 2, bz - 0.02], [bx, blockY + 0.18, bz]], 0.028, { radial: 4, segments: lod ? 4 : 10, around: 0.1 }));
  out.rope.push(tube([[head[0], head[1] - 0.15, head[2] - 0.25], [head[0], (head[1] + T) / 2 + 1.2, (head[2] + C.stay[1]) / 2], [C.stay[0], T + 0.3, C.stay[1]]], 0.03, { radial: 4, segments: lod ? 5 : 14, around: 0.1 }));
  out.stone.push(bollard(C.stay[0], T, C.stay[1], lod));
  if (lod === 2) return;
  out.iron.push(tintGeometry(boxUV(new BoxGeometry(0.16, 0.26, 0.1).translate(bx, blockY + 0.05, bz)), () => 0.8));
  out.iron.push(tube([[bx, blockY - 0.08, bz], [bx, blockY - 0.2, bz], [bx + 0.05, blockY - 0.32, bz], [bx + 0.1, blockY - 0.42, bz]], 0.02, { radial: 4, segments: 6, around: 0.1 }));
  // The windlass between its standards, as the Navalia's: drum, hawser turns, bands, bars laid by it.
  const W = K.winch;
  for (const s of [-1, 1]) {
    out.wood.push(board(0.2, W.y + 0.32 - T, 0.2, { tone: 1.10 }).translate(W.x + s * 0.62, T, W.z));
    out.wood.push(beam([W.x + s * 0.62, T + 0.14, W.z - 0.48], [W.x + s * 0.62, W.y - 0.05, W.z - 0.05], 0.09, seed + s, lod));
    out.wood.push(beam([W.x + s * 0.62, T + 0.14, W.z + 0.48], [W.x + s * 0.62, W.y - 0.05, W.z + 0.05], 0.09, seed + s + 4, lod));
    out.wood.push(board(0.2, 0.14, 1.1, { tone: 0.95 }).translate(W.x + s * 0.62, T, W.z));
  }
  const seg = lod ? 10 : 16;
  const drum = new CylinderGeometry(0.17, 0.17, 1.04, seg);
  drum.rotateZ(Math.PI / 2).translate(W.x, W.y, W.z);
  out.wood.push(tintGeometry(boxUV(drum), () => 0.8));
  // The axle out to the west to the crank (a post of its own under it).
  const ax0 = W.crankX;
  const ax1 = W.x - 0.52;
  const axle = new CylinderGeometry(0.06, 0.06, ax1 - ax0, lod ? 6 : 10);
  axle.rotateZ(Math.PI / 2).translate((ax0 + ax1) / 2, W.y, W.z);
  out.wood.push(tintGeometry(boxUV(axle), () => 0.75));
  out.wood.push(board(0.16, W.y + 0.12 - T, 0.16, { tone: 1.10 }).translate(ax0 + 0.24, T, W.z));
  for (let k = 0; k < 5; k++) {
    const g = new TorusGeometry(0.2, 0.03, lod ? 4 : 6, seg);
    g.rotateY(Math.PI / 2).translate(W.x - 0.14 + k * 0.07, W.y, W.z);
    out.rope.push(tintGeometry(boxUV(g), () => 0.85));
  }
  // The hawser from the drum up to the head.
  out.rope.push(tube([[W.x, W.y + 0.2, W.z + 0.1], [(W.x + head[0]) / 2, (W.y + head[1]) / 2 - 0.4, (W.z + head[2]) / 2], [head[0], head[1] - 0.3, head[2] - 0.3]], 0.03, { radial: 4, segments: 12, around: 0.1 }));
  // The crank at rest while nobody turns it: its iron boss, the arm hanging, the handle.
  const hub = new CylinderGeometry(0.03, 0.03, 0.06, lod ? 6 : 10);
  hub.rotateZ(Math.PI / 2).translate(ax0 - 0.03, W.y, W.z);
  out.crankIron.push(tintGeometry(boxUV(hub), () => 0.8));
  out.crank.push(board(0.04, WINDLASS.arm + 0.06, 0.05, { tone: 1.10 }).translate(ax0 - 0.03, W.y - WINDLASS.arm - 0.03, W.z));
  const handle = new CylinderGeometry(0.022, 0.022, 0.4, lod ? 5 : 8);
  handle.rotateZ(Math.PI / 2).translate(ax0 - 0.03 - 0.2, W.y - WINDLASS.arm, W.z);
  out.crank.push(tintGeometry(boxUV(handle), () => 0.72));
  // The crate on the hook while the dock works.
  out.crate.push(board(0.5, 0.4, 0.4, { tone: 1.3 }).translate(bx + 0.1, blockY - 0.85, bz));
  for (const s of [-1, 1]) out.crate.push(tube([[bx + 0.1 + s * 0.22, blockY - 0.45, bz], [bx + 0.1, blockY - 0.4, bz], [bx + 0.08, blockY - 0.4, bz]], 0.012, { radial: 3, segments: 3, around: 0.1 }));
}

/** The customs table: its trestle top, its legs, a purse of the dues, a box for the tablets; its standard on a pole beside it. */
function customs(out, lod, seed) {
  const { x, z, top } = K.customs;
  out.wood.push(board(1.7, 0.07, 0.8, { tone: 1.20 }).translate(x, top - 0.07, z));
  if (lod < 2) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.wood.push(board(0.08, top - 0.07 - T, 0.08, { tone: 1.05 }).translate(x + sx * 0.76, T, z + sz * 0.32));
    // A strongbox on the table's far end and a stack of tablets.
    out.wood.push(board(0.4, 0.22, 0.28, { tone: 0.95 }).translate(x - 0.5, top, z - 0.1));
    out.iron.push(tintGeometry(boxUV(new BoxGeometry(0.42, 0.03, 0.3).translate(x - 0.5, top + 0.11, z - 0.1)), () => 0.8));
    out.wood.push(board(0.26, 0.05, 0.2, { tone: 1.0 }).translate(x + 0.45, top, z - 0.15));
    // The standard: a pole with a crossbar and a cloth hanging from it (the harbour's colour, the harbour master's).
    const px = x + 1.45;
    out.wood.push(board(0.07, 2.6, 0.07, { tone: 1.05 }).translate(px, T, z - 0.3), board(0.8, 0.05, 0.05, { tone: 1.05 }).translate(px, T + 2.3, z - 0.3));
    out.cloth.push(tintGeometry(boxUV(new BoxGeometry(0.62, 0.8, 0.02).translate(px, T + 1.5, z - 0.3)), (cx, cy) => [0.8, 0.3 + 0.12 * (cy - T - 1.1), 0.22]));
    // Crates stacked behind it.
    out.wood.push(board(0.7, 0.5, 0.6, { tone: 1.10 }).translate(x + 1.1, T, z - 1.3), board(0.6, 0.45, 0.55, { tone: 1.03 }).translate(x + 1.15, T + 0.5, z - 1.3));
  }
}

/** Build the dock's building (no goods: those are the warehouse's loads): { group, meshes, triangles }. */
export function buildTradeDock({ lod = 0, seed = 83, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bins('flags', 'stone', 'tufa', 'plaster', 'tile', 'wood', 'iron', 'rope', 'foam', 'crank', 'crankIron', 'crate', 'cloth');
  terrace(out, lod, seed);
  stage(out, lod, seed + 100);
  shed(out, lod, seed + 200);
  crane(out, lod, seed + 300);
  customs(out, lod, seed + 400);
  const m = waterMaterials();
  const p = new TaggedParts('trade-dock');
  p.add('flags', m.stone, out.flags);
  p.add('stone', m.trav, out.stone);
  p.add('quay', m.tufa, out.tufa);
  p.add('walls', m.plaster, out.plaster);
  p.add('roof', m.tile, out.tile);
  p.add('timber', m.wood, out.wood);
  if (lod < 2) {
    p.add('iron', m.iron, out.iron);
    p.add('rope', m.rope, out.rope);
    p.add('standard', m.cloth, out.cloth);
  }
  // (Where the water laps the piles and the quay's foot; gone in a hard frost, when the margins freeze.)
  if (!ice) p.add('foam', m.foam, out.foam, { cast: false });
  // The crane's windlass: the crank hangs while the dock is idle (at work the winder turns his own: tradeDockActors);
  // the crate swings on the hook while it works.
  p.add('crank', m.wood, out.crank, { when: 'shut' });
  if (lod < 2) {
    p.add('crank-iron', m.iron, out.crankIron, { when: 'shut' });
    p.add('crate', m.wood, out.crate, { when: 'open' });
  }
  addLanterns(p, m, K.lamps, lod);
  // (The dockers, the winder and the clerk are actors: tradeDockActors.)
  return p.build();
}

/**
 * The dock's people (people/actors.js specs, its metres facing +z;
 * models/waterside.js turns them to the water) while it is staffed: the
 * winder at the crane's crank, two dockers carrying sacks between the
 * quay before the shed and the ship's side (one goes out, one comes back),
 * the customs clerk counting the dues into his purse. Nobody when idle.
 */
export function tradeDockActors(state) {
  if (state !== 'open') return [];
  const W = K.winch;
  const tunic = (seed, tone) => ({ body: 'm', dress: ['tunic:short'], hair: seed % 2 ? 'curls' : 'crop', seed, colours: { tunic: tone } });
  const walk = { speed: 0.75, pauseEnd: 2.5, pauseStart: 2.5, clipEnd: 'shoulder', clipStart: 'shoulder' };
  return [
    // Facing the water, the crank's axle WINDLASS.ahead before him and up, the axle running off to his left.
    { ...tunic(811, 0x8a6a4a), clip: 'windlass', props: { R: 'crank' }, at: [W.crankX - WINDLASS.x - 0.06, W.y - WINDLASS.height, W.z - WINDLASS.ahead], ry: 0 },
    { ...tunic(812, 0x7a6a5a), clip: 'carry', props: { L: 'sack' }, at: [0.9, T, -0.4], ry: 0, route: { length: 5.4, ...walk } },
    { ...tunic(813, DYES.fawn), clip: 'carry', props: { L: 'sack' }, at: [2.4, T, 4.9], ry: Math.PI, route: { length: 4.9, ...walk } },
    { body: 'm', dress: ['tunic:knee', 'paenula'], hair: 'crop', beard: 'short', clip: 'count', props: { R: 'coin' }, at: [K.customs.x, T, K.customs.z + 0.5], ry: Math.PI, seed: 814, colours: { tunic: 0xa89070, mantle: 0x6a5240 } },
  ];
}

