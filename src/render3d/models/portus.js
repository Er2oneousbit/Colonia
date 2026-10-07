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
 * master on the quay, the lanterns lit) and 'shut'; what drill shows is
 * kits of its own (models/fleet.js): the oars in their racks, or, while a
 * new ship's crew trains here, the rowers at the frame pulling with the
 * hortator giving the stroke, marines on the hulk and the corvus dropped
 * onto its deck (buildPortusPart).
 *
 * Metres, the middle at the origin, y up, the water side toward +z (as
 * models/harbour.js says). Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, Vector3, Quaternion } from 'three';
import { boxUV, tintGeometry, tube, revolve, profileOf } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, lantern, lanternPane, TaggedParts } from './masonry.js';
import { leanTo, beam, jar } from './rural.js';
import { figureParts } from './figure.js';
import {
  HARBOUR, harbourMaterials, board, pile, pileFoam, pierFoam, deck, ashlar, bollard, mooringRing, waterSteps, oar, ropeCoil, liburnianHull,
  rower, rowerMaterials, sweep,
} from './harbour.js';

/** The harbour's measures (metres): the tests, the lab and the game read them. */
export const PORTUS = Object.freeze({
  quayTop: 0.5,
  quayZ: -0.7, // the quay's face over the basin
  pier: Object.freeze([-5.92, -4.6]), // the west pier (x0, x1)
  mole: Object.freeze([4.25, 5.95]), // the east mole (x0, x1)
  moleTop: 0.6,
  /** The rowing frame: along x from its stern end (the hortator's) x0 to x1, its middle line at z. */
  frame: Object.freeze({ x0: -4.6, x1: 1.4, z: -3.95, rail: 0.92, half: 0.66, benches: 6 }),
  /** The practice hulk in the basin: its middle (x, z), its keel's depth under the water, its scale. */
  hulk: Object.freeze({ x: -0.25, z: 1.95, keel: -0.3, scale: 0.85 }),
  /** The corvus on the mole: its pole (x, z) and the bridge's pivot height, its length. */
  corvus: Object.freeze({ x: 5.1, z: 1.95, pivot: 1.0, len: 2.75, pole: 3.7 }),
  /** The lanterns (x, y, z): on a post at the quay's east end and at the hortator's platform. */
  lamps: Object.freeze([Object.freeze([3.7, 1.95, -1.05]), Object.freeze([-5.15, 1.8, -2.75])]),
});

const P = PORTUS;

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

/** The rowing frame: two rails on posts, thole pins, benches, a floor; the hortator's platform at its stern end. */
function frame(out, lod, seed) {
  const F = P.frame;
  const L = F.x1 - F.x0;
  out.wood.push(...deck(F.x0 - 0.2, F.x1 + 0.2, F.z - F.half - 0.15, F.z + F.half + 0.15, 0.16, { along: 'x', seed, lod, plank: 0.3, t: 0.05, bearers: 1.0 }).map((g) => g));
  for (const s of [-1, 1]) {
    const z = F.z + s * F.half;
    for (let k = 0; k <= 4; k++) out.wood.push(board(0.12, F.rail, 0.12, { tone: 0.8 }).translate(F.x0 + (L * k) / 4, 0.06, z));
    out.wood.push(board(L + 0.3, 0.1, 0.12, { tone: 0.9 }).translate((F.x0 + F.x1) / 2, F.rail - 0.04, z));
    // A thole pin for each oar, on the rail.
    if (lod < 2) for (let k = 0; k < F.benches; k++) out.wood.push(board(0.04, 0.16, 0.04).translate(benchX(k) - 0.18, F.rail + 0.06, z));
  }
  for (let k = 0; k < F.benches; k++) out.wood.push(board(0.24, 0.06, F.half * 2 - 0.12, { tone: 0.95 }).translate(benchX(k), 0.42, F.z));
  // The hortator's platform at the stern end: a low dais, his block and mallet.
  const hx = F.x0 - 0.7;
  out.wood.push(board(0.9, 0.3, 1.3, { tone: 0.85 }).translate(hx, 0.06, F.z));
  if (lod < 2) {
    out.wood.push(revolve(profileOf([[0, 0], [0.2, 0], [0.22, 0.05], [0.22, 0.4], [0.2, 0.44], [0, 0.44]]), { segments: lod ? 8 : 14, metres: 1 }).translate(hx + 0.15, 0.36, F.z + 0.35));
  }
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
  // The drill master on the quay while it is staffed.
  if (lod === 0) {
    const f = figureParts({ cloth: 0x7a3326, cloth2: 0x8a7a5a }, -1.2, P.quayTop, P.quayZ - 0.6, Math.PI * 0.85);
    for (const g of f) p.add(`master-${g.material.name}`, g.material, [g.g], { when: 'open' });
  }
  return p.build();
}

const UP = new Vector3(0, 0, 1);

/** An oar lying from point a (its loom's end) out through b, `len` long: wood geometries. */
function oarAlong(a, b, len, lod) {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  const q = new Quaternion().setFromUnitVectors(UP, d);
  return oar(len, lod).map((g) => g.applyQuaternion(q).translate(a[0], a[1], a[2]));
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
  const ang = down ? -0.13 : 1.2;
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
 * The crews at drill: twelve rowers at the frame pulling their oars, the
 * hortator on his dais beating the stroke, two marines on the hulk's deck
 * and one on the dropped corvus. People only close up (lod 0); farther out
 * the oars out over the frame show the drill.
 */
function drill(lod) {
  const F = P.frame;
  const wood = [];
  const people = [];
  for (let k = 0; k < F.benches; k++) {
    const x = benchX(k);
    for (const s of [-1, 1]) {
      // The stroke: the benches a little out of time, as a crew learning it is.
      const pull = 0.55 + 0.2 * Math.sin(k * 1.7 + (s > 0 ? 0.4 : 0));
      const thole = [x - 0.18, F.rail + 0.06, F.z + s * F.half];
      const hand = [x - 0.62 + pull * 0.3, 0.86, F.z + s * 0.18];
      const blade = [thole[0] + (thole[0] - hand[0]) * 2.2, 0.4, thole[2] + s * 1.05];
      wood.push(...oarAlong(hand, blade, Math.hypot(blade[0] - hand[0], blade[1] - hand[1], blade[2] - hand[2]) + 0.25, lod));
      if (lod === 0) {
        const r = rower(pull, k * 2 + (s > 0 ? 1 : 0), lod);
        const turn = (g) => g.rotateY(Math.PI / 2).translate(x, 0.0, F.z + s * 0.24);
        const cloth = [0x9a6a44, 0x7a6a5a, 0xb09070, 0x6a5040][(k + (s > 0 ? 1 : 0)) % 4];
        people.push({ cloth, geos: { cloth: r.cloth.map(turn), skin: r.skin.map(turn), hair: r.hair.map(turn) } });
      }
    }
  }
  return { wood, people };
}

/**
 * A kit of the Portus's own by its key (models/fleet.js `more`):
 *   'rack'          the oars in their racks
 *   'drill'         the crews at drill (rowers, hortator, marines)
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
  } else if (kind === 'drill') {
    const d = drill(lod);
    p.add('oars', m.wood, d.wood);
    for (const { cloth, geos } of d.people) {
      const mats = rowerMaterials(cloth);
      for (const k of ['cloth', 'skin', 'hair']) p.add(`rowers-${mats[k].name}`, mats[k], geos[k], { cast: lod === 0 });
    }
    if (lod === 0) {
      const F = P.frame;
      // The hortator on his dais, his mallet raised over the block.
      for (const f of figureParts({ cloth: 0x7a3326, reach: 1 }, F.x0 - 0.75, 0.36, F.z - 0.1, Math.PI / 2)) p.add(`hortator-${f.material.name}`, f.material, [f.g]);
      // Marines on the hulk's deck and one crossing the corvus, shields up.
      const H = P.hulk;
      for (const [x, z, ry] of [[H.x + 1.8, H.z + 0.1, -Math.PI / 2], [H.x + 0.6, H.z - 0.2, Math.PI / 2 + 0.3]]) {
        for (const f of figureParts({ cloth: 0x8a3a2c, reach: 0.6 }, x, 0.42, z, ry)) p.add(`marine-${f.material.name}`, f.material, [f.g]);
      }
      const C = P.corvus;
      for (const f of figureParts({ cloth: 0x8a3a2c, reach: 0.4 }, C.x - 1.4, P.moleTop + C.pivot - 0.6 + 0.2, C.z, -Math.PI / 2)) p.add(`boarder-${f.material.name}`, f.material, [f.g]);
    }
  }
  return p.build();
}
