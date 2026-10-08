/**
 * models/portus.js
 * ----------------------------------------------------------------------------
 * The Portus, the fleet's training harbour, in the 3D look: designed from
 * what is told of how Rome trained its crews, not from the 2D sprite:
 *
 *   - Polybius (1.20-21): in 261 BC, while their first war fleet was being
 *     built, the Romans taught the crews to row on dry land, seated on
 *     benches set out in the order of a ship's, the keleustes (the
 *     hortator, who gives the stroke) in their middle, so that they learned
 *     to swing back together and come forward on his word.
 *   - Polybius (1.22): the same fleet carried the corvus, the boarding
 *     bridge: a gangway on a pole at the bow, raised by a rope over a
 *     pulley at its head, dropped onto an enemy's deck, an iron spike under
 *     its end to hold it there, with a knee-high rail along its sides; the
 *     marines crossed it to fight as on land.
 *   - Agrippa's Portus Julius (37 BC), cut between the Lucrine and Avernus
 *     lakes by Puteoli, a sheltered harbour where he trained the crews of
 *     the fleet that beat Sextus Pompeius; its moles and quays are under
 *     the sea at Baia today.
 *
 * So, in 12 m: on the land row the rowing frame, a ship's benches on dry
 * land, two rails on posts with thole pins, six benches for twelve rowers,
 * the hortator's platform at its stern end with his block and mallet, and
 * a lean-to over racks of oars and the crews' water jars; over the water a
 * quay of ashlar along the shore with steps down, a timber pier on piles on
 * the west, a stone mole on the east, and in the basin between them the
 * practice hulk, an old liburnian moored alongside, its oars in its ports;
 * on the mole the corvus, its bridge raised against its pole.
 *
 * States: the building's parts are tagged 'open' (staffed: the drill
 * master on the quay, the lanterns lit) and 'shut'; what drill moves is
 * kits of its own (models/fleet.js, buildPortusPart): the oars in their
 * racks, or, while a new ship's crew trains here, the racks empty and the
 * corvus dropped onto the hulk's deck. The people are actors (people/:
 * portusActors), moving on the GPU: at drill the rowers at the frame pull
 * their oars in step with the hortator beating the stroke, marines spar on
 * the hulk.
 *
 * Metres, the middle at the origin, y up, the water side toward +z (as
 * models/harbour.js says). Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry } from 'three';
import { boxUV, tintGeometry, tube, revolve, profileOf } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, lantern, lanternPane, TaggedParts } from './masonry.js';
import { leanTo, beam, jar } from './rural.js';
import { ROW, BEAT } from '../people/clips.js';
import { DYES } from '../people/actors.js';
import {
  HARBOUR, harbourMaterials, board, pile, pileFoam, pierFoam, deck, ashlar, bollard, mooringRing, waterSteps, oar, ropeCoil, liburnianHull, sweep,
} from './harbour.js';

/** A drill oar's loom where it rides the thole (people/props.js oar): its radius. */
const OAR_R = 0.035;

/** The harbour's measures (metres): the tests, the lab and the game read them. */
export const PORTUS = Object.freeze({
  quayTop: 0.5,
  quayZ: -0.7, // the quay's face over the basin
  pier: Object.freeze([-5.92, -4.6]), // the west pier (x0, x1)
  mole: Object.freeze([4.25, 5.95]), // the east mole (x0, x1)
  moleTop: 0.6,
  /**
   * The rowing frame: along x from its stern end (the hortator's) x0 to x1,
   * its middle line at z, its rails `half` either side; its floor's top
   * `floor`, the rails' top `rail` (a rower's oar rides on it by its thole
   * pin: people/clips.js ROW, a rower's feet on the floor), the benches'
   * tops `seat`; the hortator's dais `dais` high.
   */
  frame: Object.freeze({ x0: -4.6, x1: 1.4, z: -3.95, floor: 0.16, rail: 0.16 + ROW.up - OAR_R, seat: 0.16 + ROW.seat, half: 0.8, benches: 6, dais: 0.36 }),
  /** The practice hulk in the basin: its middle (x, z), its keel's depth under the water, its scale. */
  hulk: Object.freeze({ x: -0.25, z: 1.95, keel: -0.3, scale: 0.85 }),
  /** The corvus on the mole: its pole (x, z) and the bridge's pivot height, its length. */
  corvus: Object.freeze({ x: 5.1, z: 1.95, pivot: 1.0, len: 2.75, pole: 3.7 }),
  /** The lanterns (x, y, z): on a post at the quay's east end and at the hortator's platform. */
  lamps: Object.freeze([Object.freeze([3.7, 1.95, -1.05]), Object.freeze([-5.15, 1.8, -2.75])]),
});

const P = PORTUS;

/**
 * Where rower k (0 at the stern end) on side s (+1 the +z rail) sits: his
 * feet's place (x, y, z) and facing, so that his oar's line through its
 * thole (people/clips.js ROW: `out` to the oar's side, `up`, `ahead`) runs
 * along the rail's top against the stern side of his thole pin, as the oar
 * presses forward on the pin through the drive. He faces the stern (-x),
 * the hortator; his left is +z, so the +z side rows with the oar on his
 * left (the row clip), the -z side on his right (rowRight).
 */
export function rowerPlace(k, s) {
  const F = P.frame;
  const pin = tholePin(k, s);
  return { at: [pin[0] - 0.02 - OAR_R + ROW.ahead, F.floor, F.z + s * (F.half - ROW.out)], ry: -Math.PI / 2, clip: s > 0 ? 'row' : 'rowRight' };
}

/** The thole pin of rower k on side s: its foot on the rail's top (x, y, z). */
export function tholePin(k, s) {
  const F = P.frame;
  return [benchX(k) - 0.18, F.rail, F.z + s * F.half];
}

/**
 * The hortator on his dais at the frame's stern end, facing the crews (+x),
 * and his block on its post: its top BEAT.height over his feet, BEAT.ahead
 * before him, BEAT.side to his right (+z here), where his mallet comes down.
 */
const HORT_AT = Object.freeze([-5.55, 0.36, -3.95 - 0.07]);
export const HORTATOR = Object.freeze({ at: HORT_AT, ry: Math.PI / 2, block: Object.freeze([HORT_AT[0] + BEAT.ahead, HORT_AT[1] + BEAT.height, HORT_AT[2] - BEAT.side]) });
const BLOCK = HORTATOR.block;

/** Turn and move a geometry list of the hulk's frame into the basin (its bow to +x). */
function onHulk(g) {
  const h = P.hulk;
  return g.scale(h.scale, h.scale, h.scale).rotateY(Math.PI / 2).translate(h.x, h.keel, h.z);
}

/** The land row: flags round the frame, the step up to the quay. */
function ground(out, lod, seed) {
  const H = HARBOUR.half - 0.02;
  out.flags.push(...paving(-H, H, -H, HARBOUR.shore - 0.25, 0.05, seed, { rowW: 0.62, minL: 0.5, maxL: 1.0, lod }));
}

/** The quay along the shore, the stone mole on the east, the timber pier on the west. */
function harbourWorks(out, lod, seed) {
  const top = P.quayTop;
  const [px0, px1] = P.pier;
  const [mx0, mx1] = P.mole;
  // The quay: ashlar from the shore to its face, flags on top, a step up from the land, steps down to the water.
  out.stone.push(...ashlar(px1, mx0, -0.5, top - 0.06, P.quayZ - 0.45, P.quayZ, { seed, lod, course: 0.36 }));
  out.stone.push(slab(mx0 - px1, top - 0.06, P.quayZ - HARBOUR.shore - 0.45, { bevel: 0.01, seed: seed + 1, wobble: 0, tone: 0, grime: 0.2 }).translate((px1 + mx0) / 2, 0, (HARBOUR.shore + P.quayZ - 0.45) / 2));
  out.flags.push(...paving(px0, mx0, HARBOUR.shore, P.quayZ, top, seed + 2, { rowW: 0.56, lod }));
  out.stone.push(...ashlar(-HARBOUR.half + 0.02, HARBOUR.half - 0.02, 0, 0.25, HARBOUR.shore - 0.28, HARBOUR.shore, { seed: seed + 3, lod, course: 0.25, min: 0.8, max: 1.3 }));
  if (lod < 2) {
    for (const g of waterSteps(1.0, top, 3, 0.3, seed + 4, lod)) out.stone.push(g.translate(1.6, 0, P.quayZ));
    for (const x of [-2.2, -0.2, 3.0]) out.iron.push(mooringRing(x, top - 0.1, P.quayZ, 1, lod));
  }
  // The mole: solid ashlar, kerbs along its top, flags, bollards along its inner edge.
  const mt = P.moleTop;
  const z0 = HARBOUR.shore;
  const z1 = HARBOUR.half - 0.05;
  out.stone.push(...ashlar(mx0, mx1, -0.5, mt - 0.12, z0, z1, { seed: seed + 10, lod, course: 0.37 }));
  out.flags.push(...paving(mx0, mx1, z0, z1, mt, seed + 11, { rowW: 0.57, lod }));
  if (lod < 2) out.foam.push(pierFoam(mx0, mx1, P.quayZ, z1, 0.4, seed + 12, lod));
  for (const z of lod === 2 ? [z1 - 0.4] : [0.2, 3.8, z1 - 0.4]) out.stone.push(bollard(mx0 + 0.3, mt, z, lod));
  if (lod < 2) for (const z of [-0.2, 4.6]) out.iron.push(mooringRing(mx0, mt - 0.14, z, -1, lod, true));
  // The pier: a deck on piles, a rail of posts along its outer edge, a ladder down at its end.
  const dy = HARBOUR.deckY - 0.08;
  out.wood.push(...deck(px0, px1, HARBOUR.shore, HARBOUR.half - 0.05, dy, { along: 'x', seed: seed + 20, lod, plank: 0.24, bearers: 1.6 }));
  for (let z = HARBOUR.shore + 0.4, k = 0; z < HARBOUR.half; z += 1.6, k++) {
    for (const x of [px0 + 0.12, px1 - 0.12]) {
      out.wood.push(pile(x, z, dy - 0.22, { r: 0.1, seed: seed + 30 + k * 5 + x, lod }));
      if (lod < 2) out.foam.push(pileFoam(x, z, 0.1, 0.3, seed + k + x, lod));
    }
    // Mooring posts along the inner edge, standing proud of the deck.
    if (lod < 2 && k % 2 === 0) out.wood.push(pile(px1 - 0.12, z + 0.8, dy + 0.5, { r: 0.08, seed: seed + 60 + k, lod }));
  }
  if (lod < 2) {
    for (const s of [-1, 1]) out.wood.push(board(0.05, dy + 0.3, 0.05).translate(px0 + 0.65 + s * 0.2, -0.3, HARBOUR.half - 0.07));
    for (let k = 0; k < 3; k++) out.wood.push(board(0.42, 0.04, 0.04).translate(px0 + 0.65, 0.06 + k * 0.17, HARBOUR.half - 0.07));
  }
}

/** The rowing frame: two rails on posts, thole pins, benches with their stretchers, a floor; the hortator's platform at its stern end. */
function frame(out, lod, seed) {
  const F = P.frame;
  const L = F.x1 - F.x0;
  out.wood.push(...deck(F.x0 - 0.2, F.x1 + 0.2, F.z - F.half - 0.15, F.z + F.half + 0.15, F.floor, { along: 'x', seed, lod, plank: 0.3, t: 0.05, bearers: 1.0 }).map((g) => g));
  for (const s of [-1, 1]) {
    const z = F.z + s * F.half;
    for (let k = 0; k <= 4; k++) out.wood.push(board(0.12, F.rail - 0.1 - 0.06, 0.12, { tone: 0.8 }).translate(F.x0 + (L * k) / 4, 0.06, z));
    out.wood.push(board(L + 0.3, 0.1, 0.12, { tone: 0.9 }).translate((F.x0 + F.x1) / 2, F.rail - 0.1, z));
    // A thole pin for each oar, on the rail (the oar against its stern side: rowerPlace).
    if (lod < 2) for (let k = 0; k < F.benches; k++) out.wood.push(board(0.04, 0.16, 0.04).translate(...tholePin(k, s)));
  }
  for (let k = 0; k < F.benches; k++) {
    // The bench under the rowers' hips (a hand aft of their feet's place), on two legs; the stretcher
    // their feet are braced on (people/clips.js ROW.brace), across the floor before them.
    const hip = rowerPlace(k, 1).at[0] + 0.03;
    out.wood.push(board(0.26, 0.06, F.half * 2 - 0.12, { tone: 0.95 }).translate(hip, F.seat - 0.06, F.z));
    if (lod < 2) for (const s of [-1, 1]) out.wood.push(board(0.2, F.seat - 0.06 - F.floor, 0.07, { tone: 0.8 }).translate(hip, F.floor, F.z + s * (F.half - 0.2)));
    const brace = rowerPlace(k, 1).at[0] - ROW.brace - 0.2;
    if (lod < 2) {
      const st = board(0.05, 0.16, F.half * 2 - 0.2, { tone: 0.85 });
      // (Leaning back toward the rower, as a boat's stretcher does.)
      st.rotateZ(-0.35).translate(brace, F.floor, F.z);
      out.wood.push(st);
    }
  }
  // The hortator's platform at the stern end: a low dais, his block on a post where his mallet comes down.
  const hx = F.x0 - 0.7;
  out.wood.push(board(0.9, F.dais - 0.06, 1.3, { tone: 0.85 }).translate(hx, 0.06, F.z));
  const [bx, by, bz] = BLOCK;
  out.wood.push(revolve(profileOf([[0, 0], [0.09, 0], [0.07, 0.04], [0.06, 0.1], [0.06, by - F.dais - 0.2], [0.075, by - F.dais - 0.17], [0.075, by - F.dais - 0.16], [0, by - F.dais - 0.16]]), { segments: lod ? 6 : 10, metres: 1 }).translate(bx, F.dais, bz));
  out.wood.push(revolve(profileOf([[0, 0], [0.16, 0], [0.17, 0.02], [0.17, 0.14], [0.16, 0.16], [0, 0.16]]), { segments: lod === 2 ? 6 : lod ? 8 : 14, metres: 1, tint: (q) => (q.y > 0.15 ? 0.7 : 0.9) }).translate(bx, by - 0.16, bz));
}

/** Where bench k stands along the frame. */
function benchX(k) {
  const F = P.frame;
  return F.x0 + 0.55 + k * ((F.x1 - F.x0 - 0.9) / (F.benches - 1));
}

/** The lean-to on the east of the land row: its back wall, posts, roof; the crews' water jars. */
function shelter(out, lod, seed) {
  const x0 = 2.0;
  const x1 = 5.8;
  const z0 = -5.75;
  const z1 = -3.4;
  out.stone.push(...ashlar(x0, x1, 0.05, 2.25, z0, z0 + 0.3, { seed, lod, course: 0.45 }));
  for (const x of [x0 + 0.12, x1 - 0.12]) out.wood.push(board(0.15, 1.95, 0.15, { tone: 0.8 }).translate(x, 0.05, z1));
  out.wood.push(board(x1 - x0, 0.15, 0.17, { tone: 0.75 }).translate((x0 + x1) / 2, 1.95, z1));
  const roof = leanTo({ L: x1 - x0 + 0.3, span: z1 - z0 - 0.3, topY: 2.5, eaveY: 2.1, lod, seed: seed + 5, over: 0.3 });
  for (const g of [...roof.tile, ...roof.wood]) g.translate((x0 + x1) / 2, 0, z0 + 0.3);
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // The racks' frames against the wall (the oars on them are a kit of their own: buildPortusPart 'rack').
  for (const x of [x0 + 0.5, x0 + 2.2, x1 - 0.4]) out.wood.push(board(0.08, 1.7, 0.4, { tone: 0.75 }).translate(x, 0.05, z0 + 0.5));
  if (lod < 2) {
    for (let k = 0; k < (lod ? 2 : 4); k++) out.clay.push(jar({ amphora: true, lod, seed: seed + k }).scale(0.9, 0.9, 0.9).rotateZ(k % 2 ? 0.08 : -0.06).translate(x1 - 0.45 - (k % 2) * 0.32, 0.05, z1 - 0.3 - Math.floor(k / 2) * 0.32));
    out.rope.push(...ropeCoil(x0 + 0.7, 0.05, z1 - 0.4, 0.3, 4, lod));
  }
}

/** The practice hulk: an old liburnian moored in the basin, its oars shipped, lines to the pier and the quay. */
function hulk(out, lod, seed) {
  const h = liburnianHull(4, { lod, seed });
  for (const [k, list] of Object.entries(h)) for (const g of list) out[`hulk_${k}`] = (out[`hulk_${k}`] || []).concat(onHulk(g));
  if (lod === 2) return;
  // Its mooring lines: from the bow and the stern to a post on the pier and a ring on the quay.
  const hx = P.hulk.x;
  const hz = P.hulk.z;
  out.rope.push(tube([[hx - 3.4, 0.55, hz], [hx - 3.9, 0.35, hz + 0.4], [P.pier[1] - 0.12, 0.85, hz + 0.8]], 0.02, { radial: 4, segments: 8, around: 0.06 }));
  out.rope.push(tube([[hx + 3.1, 0.5, hz - 0.3], [hx + 3.2, 0.3, hz - 1.4], [3.0, P.quayTop - 0.15, P.quayZ + 0.03]], 0.02, { radial: 4, segments: 8, around: 0.06 }));
}

/** The corvus's pole, its stay and the pulley at its head (the bridge itself is a kit: up or down). */
function corvusPole(out, lod, seed) {
  const C = P.corvus;
  const y0 = P.moleTop;
  out.wood.push(board(0.22, C.pole, 0.22, { tone: 0.85 }).translate(C.x, y0, C.z));
  out.stone.push(slab(0.6, 0.18, 0.6, { bevel: 0.02, seed, wobble: 0, tone: 0, grime: 0.3 }).translate(C.x, y0, C.z));
  if (lod < 2) {
    for (const s of [-1, 1]) out.wood.push(beam([C.x + 0.55, y0, C.z + s * 0.75], [C.x + 0.05, y0 + 1.2, C.z + s * 0.08], 0.09, seed + s, lod));
    const pulley = new CylinderGeometry(0.13, 0.13, 0.08, lod ? 8 : 14);
    pulley.rotateX(Math.PI / 2).translate(C.x - 0.16, y0 + C.pole - 0.12, C.z);
    out.wood.push(tintGeometry(boxUV(pulley), () => 0.7));
    out.iron.push(tintGeometry(boxUV(new BoxGeometry(0.3, 0.04, 0.12).translate(C.x - 0.1, y0 + C.pole - 0.12, C.z)), () => 0.8));
  }
}

/** Build the Portus (the parts drill moves are kits of their own: buildPortusPart): { group, meshes, triangles }. */
export function buildPortus({ lod = 0, seed = 83, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = { flags: [], stone: [], wood: [], tile: [], iron: [], rope: [], clay: [], foam: [] };
  ground(out, lod, seed);
  harbourWorks(out, lod, seed + 100);
  frame(out, lod, seed + 300);
  shelter(out, lod, seed + 400);
  hulk(out, lod, seed + 500);
  corvusPole(out, lod, seed + 600);
  const m = harbourMaterials();
  const p = new TaggedParts('portus');
  p.add('flags', m.stone, out.flags);
  p.add('stone', m.trav, out.stone);
  p.add('timber', m.wood, out.wood);
  p.add('roof', m.tile, out.tile);
  for (const k of ['wood', 'paint', 'gilt', 'bronze', 'white', 'black']) {
    const list = out[`hulk_${k}`];
    if (list && list.length) p.add(k === 'wood' ? 'timber' : `hulk-${k}`, m[k], list);
  }
  if (lod < 2) {
    p.add('iron', m.iron, out.iron);
    p.add('rope', m.rope, out.rope);
    p.add('jars', material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 0.8 }), out.clay);
  }
  if (!ice) p.add('foam', m.foam, out.foam, { cast: false });
  // The lanterns: on a post at the quay's east end, and at the hortator's dais.
  if (lod < 2) {
    const panes = [];
    const bronze = [];
    const posts = [];
    for (const [lx, ly, lz] of P.lamps) {
      const l = lantern(lx, ly, lz, lod);
      bronze.push(...l.bronze, tube([[lx + 0.32, ly + 0.42, lz], [lx, ly + 0.42, lz], [lx, ly + 0.3, lz]], 0.012, { radial: 4, segments: 3, around: 0.3 }));
      panes.push(l.pane);
      const base = lz > HARBOUR.shore ? P.quayTop : 0.05;
      posts.push(board(0.12, ly + 0.5 - base, 0.12).translate(lx + 0.38, base, lz));
    }
    p.add('timber', m.wood, posts);
    p.add('lantern', m.bronze, bronze);
    p.add('lamp', lanternPane(), panes, { when: 'open', cast: false });
    p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), panes.map((g) => g.clone()), { when: 'shut', cast: false });
  }
  // (The drill master, and the crews at drill, are actors: portusActors.)
  return p.build();
}

/** The oars in their racks under the lean-to (while no crew is at drill). */
function rackOars(lod) {
  const out = [];
  const tiers = lod === 2 ? 1 : lod ? 2 : 4;
  const n = lod === 2 ? 2 : lod ? 4 : 8;
  for (let t = 0; t < tiers; t++) {
    for (let k = 0; k < n; k++) {
      for (const g of oar(3.2, lod)) out.push(g.rotateY(Math.PI / 2).translate(2.2, 0.45 + t * 0.32, -5.28 + k * 0.06 + (t % 2) * 0.025));
    }
  }
  return out;
}

/**
 * The corvus's bridge: a gangway with a knee-high rail each side and the
 * iron spike under its end, hinged at the pole's foot, raised against the
 * pole (`down` false) or dropped onto the hulk's deck; the rope from the
 * pulley at the pole's head to its end.
 */
function corvusBridge(down, lod) {
  const C = P.corvus;
  const wood = [];
  const iron = [];
  const rope = [];
  const y0 = P.moleTop + C.pivot - 0.6;
  // Down: across onto the hulk's deck; up: tipped up at 70 degrees against the pole.
  const ang = down ? CORVUS_DOWN : 1.2;
  const dir = [-Math.cos(ang), Math.sin(ang), 0];
  const end = [C.x - 0.15 + dir[0] * C.len, y0 + dir[1] * C.len, C.z];
  const a = [C.x - 0.15, y0, C.z];
  for (const s of [-1, 1]) wood.push(sweep([[a[0], a[1], C.z + s * 0.55], [end[0], end[1], C.z + s * 0.55]], 0.12, 0.1, { side: [0, 0, 1] }));
  // The boards across.
  const n = lod === 2 ? 3 : lod ? 6 : 12;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const g = board(C.len / n - 0.02, 0.04, 1.2, { tone: 0.85 + (k % 3) * 0.06 });
    g.rotateZ(-ang).translate(a[0] + dir[0] * C.len * t, a[1] + dir[1] * C.len * t + 0.04, C.z);
    wood.push(g);
  }
  if (lod < 2) {
    // The rails along its sides, knee high, on posts.
    for (const s of [-1, 1]) {
      for (let k = 0; k <= 3; k++) {
        const t = k / 3;
        const px = a[0] + dir[0] * C.len * t;
        const py = a[1] + dir[1] * C.len * t;
        wood.push(beam([px, py, C.z + s * 0.55], [px - Math.sin(ang) * 0.55, py + Math.cos(ang) * 0.55, C.z + s * 0.55], 0.05, 7 + k, lod));
      }
      wood.push(sweep([[a[0] - Math.sin(ang) * 0.55, a[1] + Math.cos(ang) * 0.55, C.z + s * 0.55], [end[0] - Math.sin(ang) * 0.55, end[1] + Math.cos(ang) * 0.55, C.z + s * 0.55]], 0.05, 0.05, { side: [0, 0, 1] }));
    }
    // The spike under its end: an iron beak.
    const spike = new CylinderGeometry(0.0, 0.07, 0.5, 6);
    spike.translate(0, -0.25, 0).rotateZ(-ang).translate(end[0] + 0.05, end[1], C.z);
    iron.push(tintGeometry(boxUV(spike), () => 0.8));
    rope.push(tube([[C.x - 0.16, P.moleTop + C.pole - 0.25, C.z], [end[0] + 0.1, end[1] + 0.1, C.z]], 0.018, { radial: 4, segments: 4, around: 0.06 }));
  }
  return { wood, iron, rope };
}

/**
 * The Portus's people (people/actors.js specs, its metres facing +z;
 * models/fleet.js turns them to the water): staffed ('open') the drill
 * master walking the quay; while a new ship's crew trains here (`drill`),
 * also twelve rowers at the frame pulling their oars (props.js oar) to the
 * hortator's stroke, all in step with him (`sync`) but each a little early
 * or late, as a crew learning it is; the hortator on his dais beating it
 * with his mallet on the block; two marines sparring with sword and shield
 * on the hulk's deck (Vegetius's drill at the post, against each other)
 * and one standing guard on the dropped corvus. Nobody when unstaffed.
 */
export function portusActors(state, drill = false) {
  if (state !== 'open') return [];
  const list = [
    { body: 'm', dress: ['tunic:knee', 'lorica', 'caligae'], hair: 'crop', clip: 'walk', at: [-3.6, P.quayTop, P.quayZ - 0.6], ry: Math.PI / 2, seed: 831, colours: { tunic: DYES.madder, metal: 0x8a8c90 },
      route: { length: 4.4, speed: 0.6, pauseEnd: 6, pauseStart: 6, clipEnd: 'idle', clipStart: 'idle', faceEnd: Math.PI, faceStart: Math.PI } },
  ];
  if (!drill) return list;
  const F = P.frame;
  for (let k = 0; k < F.benches; k++) {
    for (const s of [-1, 1]) {
      const r = rowerPlace(k, s);
      const i = k * 2 + (s > 0 ? 1 : 0);
      // (Each a few hundredths of a stroke early or late: a crew learning to keep time.)
      const phase = 0.1 * (((i * 0.618) % 1) - 0.5);
      list.push({ body: 'm', dress: ['tunic:short'], hair: i % 3 ? 'crop' : 'curls', clip: r.clip, props: { R: 'oar' }, at: r.at, ry: r.ry, sync: true, phase, seed: 840 + i,
        colours: { tunic: [DYES.undyed, DYES.fawn, DYES.oatmeal, DYES.brownWool, DYES.sky][i % 5] } });
    }
  }
  list.push({ body: 'm', dress: ['tunic:knee'], hair: 'bald', beard: 'short', old: true, clip: 'beat', props: { R: 'hammer' }, at: HORTATOR.at, ry: HORTATOR.ry, sync: true, phase: 0, seed: 860, colours: { tunic: DYES.madder } });
  // The marines: two sparring along the hulk's deck, one on the corvus.
  const H = P.hulk;
  const marine = { body: 'm', dress: ['tunic:knee', 'lorica', 'caligae', 'helmet'], hair: 'crop', clip: 'drill', props: { R: 'gladius', L: 'scutum' }, colours: { tunic: DYES.madder, accent: DYES.madder, metal: 0x8a8c90 } };
  list.push({ ...marine, at: [H.x - 0.35, HULK_DECK, H.z], ry: Math.PI / 2, seed: 861 });
  list.push({ ...marine, at: [H.x + 1.25, HULK_DECK, H.z], ry: -Math.PI / 2, seed: 862, phase: 1.1 });
  const C = P.corvus;
  const t = 0.45;
  const ang = CORVUS_DOWN;
  list.push({ ...marine, clip: 'guard', props: { R: 'spear', L: 'scutum' }, at: [C.x - 0.15 - Math.cos(ang) * C.len * t, P.moleTop + C.pivot - 0.6 + Math.sin(ang) * C.len * t + 0.08, C.z], ry: -Math.PI / 2, seed: 863 });
  return list;
}

/** The hulk's deck over the water (its sheer at the hulk's scale, harbour.js LIBURNIAN): where the marines stand. */
const HULK_DECK = 0.42;
/** The corvus's tilt when dropped onto the hulk (radians, down toward it). */
const CORVUS_DOWN = -0.13;

/**
 * A kit of the Portus's own by its key (models/fleet.js `more`):
 *   'rack'          the oars in their racks (gone while a crew drills:
 *                   their oars are at the frame, in the rowers' hands)
 *   'corvus:up'     the corvus raised against its pole
 *   'corvus:down'   the corvus dropped onto the hulk
 * Returns { group, meshes, triangles }.
 */
export function buildPortusPart(kind, { lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const m = harbourMaterials();
  const p = new TaggedParts(`portus-${kind}`);
  if (kind === 'rack') {
    p.add('oars', m.wood, rackOars(lod));
  } else if (kind === 'corvus:up' || kind === 'corvus:down') {
    const c = corvusBridge(kind === 'corvus:down', lod);
    p.add('corvus', m.wood, c.wood);
    if (lod < 2) {
      p.add('spike', m.iron, c.iron);
      p.add('rope', m.rope, c.rope);
    }
  }
  return p.build();
}
