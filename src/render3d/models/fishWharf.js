/**
 * models/fishWharf.js
 * ----------------------------------------------------------------------------
 * The Piscatoria (the Fishing Wharf) in the 3D look: designed from the
 * fishermen's landings of the ancient shores that are known, not from the
 * 2D sprite:
 *
 *   - A landing stage of driven piles and planks where the boats lie
 *     alongside to unload, as at the small harbours of Ostia, Cosa and the
 *     Etruscan coast (harbour.js jetty), with bollards of timber for the
 *     boats' lines and a step or two up from the shore.
 *   - Nets dried and mended on the shore: hung from a pole between posts,
 *     cork floats along the head rope and weights along the foot, mended
 *     with a netting needle by a man sitting on the ground or a cask, as
 *     the fishermen of the Sousse and Althiburos mosaics and the Ostia
 *     reliefs do (cf. the netting needles of the Egyptian and Roman finds).
 *   - The catch in wicker baskets on the stage; gutting and salting on a
 *     table beside a tub (the garum and salt-fish trade of the Roman
 *     coasts: the fish gutted at once, as the Pompeian fish-sauce workshops
 *     did, and the rest preserved); and smoked, hung in a small closed hut
 *     whose smoke seeps out through a louvred vent in the ridge.
 *
 * So, in 8 m (the shore row behind, one row out over the water): a timber
 * deck on bents of piles over the water row, a stair of two steps from the
 * shore, bollards along its edge; on it the baskets of the catch (the
 * game's: a kit of its own for as many as the wharf's fish fill, one for
 * twenty-five), a gutting table with its tub and the man at it; on the
 * shore the smoke house on the west, two frames of nets drying on the east
 * with a fisherman mending one, seated. The boat lies afloat in front of
 * the wharf at one of the ends of the front (the game draws it: ships/
 * moorings.js, a hand off the front), which is kept clear.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the lantern lit, the smoke house smoking (a smoke kit
 *           of the temples', models/fishWharf's own `more`); its people are
 *           actors (fishWharfActors): the net mender seated, the man
 *           gutting at the table, a carrier taking the catch to the
 *           smoke house
 *   'shut'  no staff: nobody, the lantern out, no smoke
 *
 * Metres, the middle at the origin, y up, the water side toward +z. Levels
 * of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, TaggedParts } from './masonry.js';
import { gableRoof, D } from './rural.js';
import { DYES } from '../people/actors.js';
import { SEAT_H } from '../people/clips.js';
import { HARBOUR, board, pile, jetty } from './harbour.js';
import { waterMaterials, bins, gableWall, hangingNet, addLanterns } from './watersideKit.js';

const DECK = HARBOUR.deckY;

/** The wharf's measures (metres): the tests, the lab and the game read them. */
export const FISH_WHARF = Object.freeze({
  half: 4,
  shore: 0,
  deck: DECK,
  front: 3.92,
  /** The smoke house: walls' outer faces, eave height, pitch, and its vent's top (where the smoke leaves). */
  hut: Object.freeze({ x0: -3.7, x1: -1.5, z0: -3.62, z1: -1.7, eave: 1.95, pitch: 30, vent: Object.freeze([-2.6, 2.85, -2.66]) }),
  /** The nets' frames: z, x0..x1, the pole's height, the net's drop. */
  frames: Object.freeze([
    Object.freeze({ z: -3.3, x0: 0.4, x1: 3.5, h: 2.0, drop: 1.4 }),
    Object.freeze({ z: -1.9, x0: 0.6, x1: 2.9, h: 1.7, drop: 1.15 }),
  ]),
  /** The gutting table's middle (x, z), its top over the deck, and the tub. */
  table: Object.freeze({ x: -2.5, z: 1.5, top: DECK + 0.86 }),
  tub: Object.freeze([-1.55, 1.2]),
  /** The seat of the man mending a net (x, z): a cask of SEAT_H. */
  seat: Object.freeze([1.9, -0.6]),
  /** The places of the baskets of the catch on the deck [x, y, z], filled in order. */
  baskets: Object.freeze([
    [0.7, DECK, 3.3], [1.4, DECK, 3.3], [2.1, DECK, 3.3], [2.8, DECK, 3.3], [3.5, DECK, 3.3], [1.0, DECK, 2.4], [1.8, DECK, 2.4], [2.6, DECK, 2.4],
  ].map((p) => Object.freeze(p))),
  /** One basket for this much fish (the sim's catch is 100 a boat). */
  perBasket: 25,
  /** The lantern [x, y of its base, z, y of the post's foot]. */
  lamps: Object.freeze([Object.freeze([3.55, DECK + 1.7, 1.2, DECK])]),
});

const W = FISH_WHARF;

/** How many baskets show for this much fish. */
export function basketCount(fish) {
  const n = Math.ceil(Math.max(0, fish || 0) / W.perBasket);
  return Math.min(W.baskets.length, n);
}

/** The ground: flags on the shore row, a kerb at the shore line, two steps up to the deck, the deck on piles. */
function ground(out, lod, seed) {
  const H = W.half - 0.02;
  out.flags.push(...paving(-H, H, -H, W.shore, 0.06, seed + 1, { rowW: 0.62, minL: 0.5, maxL: 1.0, lod }));
  // The deck: bents of piles, caps, planks, fenders.
  const j = jetty(-H + 0.03, H - 0.03, W.shore + 0.03, W.front, DECK, { seed: seed + 2, lod, bent: 1.5, half: W.half });
  out.wood.push(...j.wood);
  out.foam.push(...j.foam);
  // Two steps up from the shore to the deck, in the middle: a plank step and a stone one.
  out.wood.push(board(1.6, 0.3, 0.42, { tone: 1.15 }).translate(0, 0.06, -0.32));
  if (lod < 2) out.wood.push(board(1.6, 0.04, 0.46, { tone: 1.0 }).translate(0, 0.36, -0.32));
  // Bollards of timber along the deck's front edge: three piles standing proud.
  for (const x of lod === 2 ? [-3.3, 3.3] : [-3.4, 0, 3.4]) out.wood.push(pile(x, W.front - 0.28, DECK + 0.42, { r: 0.09, seed: seed + 10 + x, lod }));
}

/** The smoke house: plastered walls, a doorway, tiled roof, a louvred vent on the ridge, a woodpile at its side. */
function hut(out, lod, seed) {
  const S = W.hut;
  const xc = (S.x0 + S.x1) / 2;
  const zc = (S.z0 + S.z1) / 2;
  const span = S.z1 - S.z0;
  const h = S.eave;
  const rise = (span / 2) * Math.tan(D(S.pitch));
  // The walls: the back and the two ends whole, the front with the doorway between two jambs and a lintel.
  out.plaster.push(slab(S.x1 - S.x0, h, 0.3, { bevel: 0.01, seed: seed + 1, wobble: 0, tone: 0.03, grime: 0.3 }).translate(xc, 0, S.z0 + 0.15));
  for (const e of [-1, 1]) out.plaster.push(slab(0.3, h, span - 0.3, { bevel: 0.01, seed: seed + 2 + e, wobble: 0, tone: 0.03, grime: 0.3 }).translate(e < 0 ? S.x0 + 0.15 : S.x1 - 0.15, 0, zc + 0.15));
  const doorW = 0.8;
  const doorH = 1.45;
  for (const e of [-1, 1]) {
    const x0 = e < 0 ? S.x0 + 0.3 : xc + doorW / 2;
    const x1 = e < 0 ? xc - doorW / 2 : S.x1 - 0.3;
    out.plaster.push(slab(x1 - x0, h, 0.3, { bevel: 0.01, seed: seed + 5 + e, wobble: 0, tone: 0.03, grime: 0.3 }).translate((x0 + x1) / 2, 0, S.z1 - 0.15));
  }
  out.plaster.push(slab(doorW + 0.02, h - doorH, 0.3, { bevel: 0.01, seed: seed + 8, wobble: 0, tone: 0.03, grime: 0 }).translate(xc, doorH, S.z1 - 0.15));
  out.plaster.push(gableWall(S.x0 + 0.15, zc, span, 0.3, S.eave, rise), gableWall(S.x1 - 0.15, zc, span, 0.3, S.eave, rise));
  // The dark inside seen through the doorway, soot on the lintel.
  out.dark.push(tintGeometry(boxUV(new BoxGeometry(doorW, doorH, 0.04).translate(xc, doorH / 2, S.z1 - 0.28)), () => 1));
  out.wood.push(board(doorW + 0.3, 0.12, 0.34, { tone: 1.00 }).translate(xc, doorH - 0.06, S.z1 - 0.15));
  const roof = gableRoof({ x0: S.x0, x1: S.x1, z0: S.z0, z1: S.z1, eaveY: S.eave, pitch: D(S.pitch), along: 'x', lod, seed: seed + 30, over: 0.2, gableOver: 0.1 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // The vent on the ridge: a little louvred box with its own hipped cap.
  const [vx, vy, vz] = S.vent;
  const ridge = S.eave + rise;
  out.plaster.push(slab(0.55, vy - 0.4 - ridge + 0.15, 0.55, { bevel: 0.01, seed: seed + 40, wobble: 0, tone: 0.03, grime: 0.2 }).translate(vx, ridge - 0.15, vz));
  out.tile.push(slab(0.8, 0.14, 0.8, { bevel: 0.05, seed: seed + 41, wobble: 0, tone: 0.04, grime: 0 }).translate(vx, vy - 0.25, vz));
  if (lod < 2) {
    for (const s of [-1, 1]) out.dark.push(tintGeometry(boxUV(new BoxGeometry(0.4, 0.14, 0.02).translate(vx, vy - 0.55, vz + s * 0.275)), () => 1));
    // The fish racks seen in the doorway: poles across it, split fish hanging.
    for (let k = 0; k < 4; k++) out.fishy.push(tintGeometry(boxUV(new BoxGeometry(0.1, 0.34, 0.04).translate(xc - 0.28 + k * 0.19, 0.95, S.z1 - 0.1)), () => [0.9, 0.62, 0.4]));
    out.wood.push(board(0.9, 0.04, 0.04, { tone: 0.95 }).translate(xc, 1.28, S.z1 - 0.1));
    // The woodpile for the fire: split logs stacked against the east wall.
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4 - r; c++) {
      const g = new CylinderGeometry(0.08, 0.08, 0.7, lod ? 5 : 7);
      g.rotateZ(Math.PI / 2).translate(S.x1 + 0.42, 0.1 + r * 0.15, S.z0 + 0.5 + c * 0.17 + r * 0.08);
      out.wood.push(tintGeometry(boxUV(g), () => 0.75 + 0.1 * ((r + c) % 3)));
    }
  }
}

/** Two frames of nets drying: posts, a pole across, the net hanging from it, floats along the head. */
function frames(out, lod, seed) {
  for (const [i, f] of W.frames.entries()) {
    for (const x of [f.x0 - 0.1, f.x1 + 0.1]) {
      out.wood.push(board(0.12, f.h, 0.12, { tone: 1.07, grime: 0.3 }).translate(x, 0.06, f.z));
      if (lod < 2) out.wood.push(board(0.5, 0.05, 0.05, { tone: 0.95 }).translate(x, 0.06 + f.h * 0.12, f.z - 0.24), board(0.05, 0.05, 0.5, { tone: 0.95 }).translate(x, 0.06 + f.h * 0.12, f.z - 0.0));
    }
    out.wood.push(board(f.x1 - f.x0 + 0.3, 0.07, 0.07, { tone: 1.10 }).translate((f.x0 + f.x1) / 2, 0.06 + f.h - 0.06, f.z));
    const n = hangingNet(f.x0, f.x1, f.z, 0.06 + f.h - 0.08, f.drop, { lod, sag: 0.08 + i * 0.03 });
    out.twine.push(...n.twine);
    out.floats.push(...n.floats);
  }
}

/** The man at the net: a cask to sit on, the net spread from his lap to the ground, a heap beside him. */
function mending(out, lod, seed) {
  const [sx, sz] = W.seat;
  const seg = lod ? 8 : 14;
  const cask = new CylinderGeometry(0.24, 0.26, SEAT_H, seg);
  cask.translate(sx, 0.06 + SEAT_H / 2, sz);
  out.wood.push(tintGeometry(boxUV(cask), () => 0.85));
  if (lod === 2) return;
  for (const y of [0.18, 0.4]) {
    const hoop = new CylinderGeometry(0.265, 0.265, 0.03, seg);
    hoop.translate(sx, 0.06 + y, sz);
    out.iron.push(tintGeometry(boxUV(hoop), () => 0.7));
  }
  // The net spread over his knees and down to the ground before him: lines along and across, sloping.
  const w = 1.0;
  const z0 = sz + 0.16;
  const d = 0.85;
  const y0 = 0.06 + SEAT_H + 0.1;
  const nx = lod ? 4 : 7;
  for (let i = 0; i <= nx; i++) {
    const x = sx - w / 2 + (w * i) / nx;
    const g = new BoxGeometry(0.026, 0.026, Math.hypot(d, y0 - 0.1));
    g.rotateX(Math.atan2(y0 - 0.1, d));
    g.translate(x, (y0 + 0.1) / 2, z0 + d / 2);
    out.twine.push(tintGeometry(boxUV(g), () => 1.1));
  }
  for (let j = 1; j <= (lod ? 3 : 5); j++) {
    const t = j / ((lod ? 3 : 5) + 1);
    out.twine.push(tintGeometry(boxUV(new BoxGeometry(w, 0.024, 0.024).translate(sx, y0 + (0.1 - y0) * t, z0 + d * t)), () => 1.1));
  }
  // A heap of net beside the cask, a wooden float or two on it, a netting needle laid on the cask's lid.
  const heap = new SphereGeometry(0.34, lod ? 6 : 10, lod ? 4 : 6, 0, Math.PI * 2, 0, Math.PI / 2);
  heap.scale(1.2, 0.65, 1).translate(sx - 0.85, 0.06, sz + 0.3);
  out.twine.push(tintGeometry(boxUV(heap), (px, py, pz) => 1.0 + 0.2 * Math.sin(px * 31 + pz * 23)));
  out.floats.push(tintGeometry(boxUV(new BoxGeometry(0.12, 0.06, 0.06).translate(sx - 0.8, 0.28, sz + 0.28)), () => 0.9));
}

/** The gutting table on the deck: its top, legs, a tub of water, the fish laid on it. */
function gutting(out, lod, seed) {
  const T = W.table;
  out.wood.push(board(1.4, 0.07, 0.7, { tone: 1.20 }).translate(T.x, T.top - 0.07, T.z));
  if (lod < 2) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.wood.push(board(0.08, T.top - 0.07 - DECK, 0.08, { tone: 1.05 }).translate(T.x + sx * 0.62, DECK, T.z + sz * 0.27));
    out.wood.push(board(1.2, 0.04, 0.5, { tone: 1.00 }).translate(T.x, DECK + 0.3, T.z));
    // The fish on the board: four silver bodies, tails and heads toward the ends.
    for (let k = 0; k < 4; k++) {
      const g = new SphereGeometry(0.1, 8, 6);
      g.scale(1.6, 0.35, 0.55).rotateY(0.3 * (k - 1.5)).translate(T.x - 0.45 + k * 0.28, T.top + 0.03, T.z - 0.12 + 0.08 * Math.sin(k * 2.1));
      out.fish.push(tintGeometry(boxUV(g), () => [0.62, 0.7, 0.74]));
    }
  }
  // The tub beside it: a cask cut down, water in it, a few fish.
  const [tx, tz] = W.tub;
  const tub = new CylinderGeometry(0.3, 0.26, 0.5, lod ? 8 : 14, 1, true);
  tub.translate(tx, DECK + 0.25, tz);
  out.wood.push(tintGeometry(boxUV(tub), () => 0.85));
  out.wood.push(tintGeometry(boxUV(new CylinderGeometry(0.26, 0.26, 0.04, lod ? 8 : 14).translate(tx, DECK + 0.03, tz)), () => 0.7));
  out.water.push(tintGeometry(boxUV(new CylinderGeometry(0.285, 0.285, 0.02, lod ? 8 : 14).translate(tx, DECK + 0.4, tz)), () => 1));
}

/** Build the wharf's building (no baskets: a kit of their own): { group, meshes, triangles }. */
export function buildFishWharf({ lod = 0, seed = 107, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bins('flags', 'wood', 'plaster', 'tile', 'dark', 'iron', 'foam', 'twine', 'floats', 'fish', 'water', 'fishy');
  ground(out, lod, seed);
  hut(out, lod, seed + 100);
  frames(out, lod, seed + 200);
  mending(out, lod, seed + 300);
  gutting(out, lod, seed + 400);
  const m = waterMaterials();
  const p = new TaggedParts('fish-wharf');
  p.add('flags', m.stone, out.flags);
  p.add('timber', m.wood, out.wood);
  p.add('walls', m.plaster, out.plaster);
  p.add('roof', m.tile, out.tile);
  p.add('inside', m.dark, out.dark, { cast: false });
  p.add('nets', m.net, out.twine, { cast: false });
  p.add('floats', m.wood, out.floats, { cast: false });
  if (lod < 2) {
    p.add('iron', m.iron, out.iron);
    p.add('fish', material('fish', { color: 0xffffff, roughness: 0.42, metalness: 0.2, vertexColors: true, snow: 0.4 }), out.fish);
    p.add('smoked', m.rope, out.fishy);
    p.add('water', m.tar, out.water, { cast: false });
  }
  if (!ice) p.add('foam', m.foam, out.foam, { cast: false });
  addLanterns(p, m, W.lamps, lod);
  // (The fishermen are actors: fishWharfActors.)
  return p.build();
}

/**
 * The wharf's people (people/actors.js specs, its metres facing +z;
 * models/waterside.js turns them to the water) while it is staffed: a
 * fisherman seated on his cask mending a net, the man gutting at the
 * table, and one carrying a basket of the catch from the stage's foot to
 * the smoke house and back. Nobody when idle.
 */
export function fishWharfActors(state) {
  if (state !== 'open') return [];
  const tunic = (seed, tone) => ({ body: 'm', dress: ['tunic:short'], hair: seed % 2 ? 'curls' : 'crop', seed, colours: { tunic: tone } });
  const [sx, sz] = W.seat;
  const T = W.table;
  return [
    { ...tunic(851, DYES.oatmeal), clip: 'sit', at: [sx, 0.06, sz], ry: 0 },
    { ...tunic(852, DYES.woad), clip: 'count', props: { R: 'razor' }, at: [T.x, DECK, T.z + 0.5], ry: Math.PI },
    { ...tunic(853, 0x7a6a5a), clip: 'carry', props: { L: 'sack' }, at: [-2.75, 0.06, -1.15], ry: Math.PI / 2,
      route: { length: 2.2, speed: 0.75, pauseEnd: 2.5, pauseStart: 2.5, clipEnd: 'shoulder', clipStart: 'shoulder' } },
  ];
}
