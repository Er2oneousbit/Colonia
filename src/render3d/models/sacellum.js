/**
 * models/sacellum.js
 * ----------------------------------------------------------------------------
 * The mission post of the 3D look (Sacellum Pacis, a shrine of peace) on a
 * 2 x 2 footprint (8 m), from the record rather than the 2D sprite:
 *
 *   - A sacellum was a small sacred place open to the sky, walled about,
 *     with an altar and often a little shrine (aedicula) for the god's
 *     image: Pax, peace, the goddess Augustus gave an altar on the Campus
 *     Martius, shown on his coins with an olive branch and a horn of
 *     plenty; Concordia, harmony, with her dish and horn.
 *   - Rome's dealings with peoples beyond its towns went through envoys:
 *     the fetial priests who made treaties, the herald's staff (caduceus)
 *     that marked a man come in peace, gifts exchanged (wine and oil,
 *     cloth, fine pottery: the amphorae found far beyond the frontiers).
 *     A frontier post was a walled yard with lodgings, a gate shut at
 *     night and a standard at it.
 *
 * So: a yard walled in rubble with a gate under a little tiled roof; at
 * its back the shrine of Pax, her statue between two columns under a
 * pediment, an altar before it; down the left side the envoys' lodging
 * (stuccoed, a red dado, a tiled roof, a bench by its door); the gifts for
 * the villages set out in the yard (amphorae of wine, bales of cloth,
 * pottery: the warehouse's loads, instanced with them), an olive tree (the
 * olive farms', instanced with theirs: models/religion.js), the post's
 * white standard topped with a caduceus by the gate.
 *
 * States (models.js partShows): 'open' staffed (the gate open, the altar's
 * fire lit, the envoy talking with a villager come to trade, a servant
 * with an amphora, the standard flying, the lantern lit at night); 'shut'
 * unstaffed (the gate shut, cold ash, nobody, the standard taken in).
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { slab, paving, TaggedParts, lantern, lanternPane } from './masonry.js';
import { gable, gableTri, rake, wallAlong, doubleDoor, standard, FRESCO, addPeople, togate, servant, threshold } from './domus.js';
import { person } from './learning.js';
import { sacraMaterials, ara, hearthFire, box, D, lin } from './sacra.js';
import { cultStatue, caduceus, placeBins } from './numina.js';
import { castraMaterials } from './castra.js';

/** The mission post's measures (metres). */
export const SACELLUM = Object.freeze({
  half: 4,
  /** The yard's wall: its inner half width, thickness, height; the gate's half width. */
  wall: Object.freeze([3.3, 0.4, 1.85]),
  gate: 0.85,
  /** The shrine's podium (half width, front z, back z, height) and its columns' x. */
  shrine: Object.freeze([0.95, -1.75, -3.28, 0.55]),
  cols: Object.freeze([-0.62, 0.62]),
  /** The altar (x, z). */
  altar: Object.freeze([0, -0.72]),
  /** The lodging: x from, x to, z from, z to; its eave. */
  lodge: Object.freeze([-3.28, -1.42, -1.25, 2.35, 2.45]),
  /** The gate's lantern on its right pier (x, y, z), facing the street. */
  lamp: Object.freeze([1.18, 2.05, 3.84]),
});

const S = SACELLUM;
const [WX, WT, WH] = S.wall;
const OUT = WX + WT;

/** Where the olive tree stands in the yard [x, z]. */
export const SACELLUM_TREE = Object.freeze([1.8, -1.7]);
/** The gifts set out in the yard: [good, x, z, turn] (the warehouse's loads). */
export const SACELLUM_GIFTS = Object.freeze([['wine', 2.45, 0.75, 0], ['clothing', 2.45, 1.95, 0], ['pottery', 1.25, 2.4, D(90)]]);

/** The lamps for models.js modelLamps: the gate's lantern and the altar's fire, facing the street. */
export const SACELLUM_LAMPS = Object.freeze([Object.freeze([...S.lamp, 1]), Object.freeze([S.altar[0], 1.2, S.altar[1], 1])]);

/** The yard's wall round three sides and the front either side of the gate, its coping; the gateway. */
function walls(lod, seed, out) {
  const t = WT;
  const g = S.gate;
  // Rubble in lime, stuccoed on top as a coping.
  out.rubble.push(box(2 * OUT, WH, t, 0, 0, -OUT + t / 2, 0.95));
  for (const s of [-1, 1]) out.rubble.push(box(t, WH, 2 * OUT - 2 * t, s * (OUT - t / 2), 0, 0, 0.95));
  for (const s of [-1, 1]) out.rubble.push(box(OUT - g - 0.55, WH, t, s * (g + 0.55 + OUT) / 2, 0, OUT - t / 2, 0.95));
  const cap = (w, d, x, z) => out.trav.push(slab(w, 0.1, d, { bevel: 0.02, seed: seed + Math.round(x * 7 + z * 3), wobble: 0, tone: 0.03, grime: 0.15 }).translate(x, WH, z));
  cap(2 * OUT + 0.06, t + 0.08, 0, -OUT + t / 2);
  for (const s of [-1, 1]) cap(t + 0.08, 2 * OUT - 2 * t, s * (OUT - t / 2), 0);
  for (const s of [-1, 1]) cap(OUT - g - 0.55, t + 0.08, s * (g + 0.55 + OUT) / 2, OUT - t / 2);
  // The gate's piers of dressed stone, the lintel, a little tiled gable over it to the street.
  const ph = 2.45;
  for (const s of [-1, 1]) out.trav.push(slab(0.55, ph, 0.62, { bevel: 0.02, seed: seed + 30 + s, wobble: 0, tone: 0.03, grime: 0.3 }).translate(s * (g + 0.275), 0, OUT - t / 2));
  out.trav.push(box(2 * g + 1.2, 0.26, 0.62, 0, ph, OUT - t / 2, 0.92));
  const r = gable({ x0: -g - 0.62, x1: g + 0.62, z0: OUT - t / 2 - 0.36, z1: OUT - t / 2 + 0.36, eaveY: ph + 0.26, pitch: D(24), along: 'z', over: 0.12, gableOver: 0.1, lod, seed: seed + 40 });
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  out.stucco.push(gableTri(-g - 0.6, g + 0.6, OUT - t / 2 + 0.38, 0.06, ph + 0.26, r.ridgeY - 0.03));
  // A word of welcome in the threshold's mosaic: PAX.
  out.tesserae.push(...threshold('PAX', 0, 0.03, OUT - t / 2, 2 * g - 0.1, 0.5, lod));
}

/** The shrine of Pax: a podium, three steps, two columns, a pediment, her statue inside, the altar before it. */
function shrine(lod, seed, out) {
  const [hw, fz, bz, ph] = S.shrine;
  out.trav.push(slab(2 * hw, ph, fz - bz, { bevel: 0.02, seed, wobble: 0, tone: 0.03, grime: 0.3 }).translate(0, 0, (fz + bz) / 2));
  for (let k = 0; k < 3; k++) out.trav.push(slab(1.1, (ph / 3) * (k + 1), 0.22, { bevel: 0.012, seed: seed + k, wobble: 0, tone: 0.03, grime: 0.3 }).translate(0, 0, fz + 0.11 + (2 - k) * 0.2));
  // The cella: a back wall and two short sides, stuccoed; the front open between the columns.
  const top = ph + 1.75;
  const cz0 = bz + 0.04;
  const cz1 = fz - 0.55;
  out.stucco.push(box(2 * hw - 0.1, top - ph, 0.18, 0, ph, cz0 + 0.09, 0.95));
  for (const s of [-1, 1]) out.stucco.push(box(0.18, top - ph, cz1 - cz0, s * (hw - 0.14), ph, (cz0 + cz1) / 2, 0.95));
  if (lod < 2) {
    out.fresco.push(box(2 * hw - 0.46, top - ph - 0.6, 0.01, 0, ph + 0.5, cz0 + 0.185, () => FRESCO.blue));
    out.fresco.push(box(2 * hw - 0.46, 0.5, 0.01, 0, ph, cz0 + 0.185, () => FRESCO.black));
  }
  // The entablature and the gable roof, the pediment to the front.
  const ez1 = fz - 0.12;
  out.marble.push(box(2 * hw - 0.02, 0.28, ez1 - cz0, 0, top, (ez1 + cz0) / 2, 0.95));
  const r = gable({ x0: -hw, x1: hw, z0: cz0 - 0.02, z1: ez1, eaveY: top + 0.28, pitch: D(20), along: 'z', over: 0.14, gableOver: 0.12, lod, seed: seed + 20 });
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  out.stucco.push(gableTri(-hw + 0.04, hw - 0.04, ez1 - 0.02, 0.1, top + 0.28, r.ridgeY - 0.05));
  for (const s of [-1, 1]) out.marble.push(rake(s * (hw + 0.1), top + 0.24, 0, r.ridgeY + 0.05, ez1 + 0.06, 0.2, 0.12));
  // The statue of Pax on her base; a wreath of olive at the gable's top.
  out.marble.push(slab(0.6, 0.35, 0.45, { bevel: 0.01, seed: seed + 30, wobble: 0, tone: 0, grime: 0 }).translate(0, ph, cz0 + 0.5));
  if (lod < 2) {
    const st = cultStatue('pax', lod === 0 ? 0 : 2);
    const k = 0.72;
    for (const g of st.stone) out.marble.push(g.scale(k, k, k).translate(0, ph + 0.35, cz0 + 0.5));
    for (const g of st.gear) out.gilt.push(g.scale(k, k, k).translate(0, ph + 0.35, cz0 + 0.5));
    for (const g of Object.values(caduceus(lod, 'gilt', 0.55)).flat()) out.gilt.push(g.translate(0, r.ridgeY + 0.04, ez1 + 0.04));
  }
  // The altar before it.
  const [ax, az] = S.altar;
  const a = ara(ax, az, { w: 0.72, d: 0.52, h: 0.78, lod, seed: seed + 40 });
  out.trav.push(...a.stone);
  out.marble.push(...a.marble);
  return { hearth: a.hearth, top: top - ph };
}

/** The envoys' lodging down the yard's left side: stuccoed walls on a red dado, a door to the yard, a tiled roof. */
function lodge(lod, seed, out) {
  const [x0, x1, z0, z1, eave] = S.lodge;
  const t = 0.3;
  const door = { a: 0.0, b: 0.9, lo: 0, hi: 1.95 };
  const win = { a: 1.45, b: 1.95, lo: 1.2, hi: 1.8 };
  // The yard-side wall (along z at x1) with the door and a window; the others plain (the back is the yard's wall).
  out.stucco.push(...wallAlong('z', z0, z1, x1 - t / 2, t, 0, eave, [door, win].map((o) => ({ ...o, a: z0 + o.a + 0.6, b: z0 + o.b + 0.6 })), 0.97));
  for (const z of [z0 + t / 2, z1 - t / 2]) out.stucco.push(box(x1 - x0 - t, eave, t, (x0 + x1 - t) / 2, 0, z, 0.96));
  // The dado: a band of red along the yard's face, under the stucco's white.
  if (lod < 2) {
    for (const [a, b] of [[z0, z0 + door.a + 0.6], [z0 + door.b + 0.6, z1]]) out.paint.push(box(0.01, 0.75, b - a, x1 + 0.005, 0.04, (a + b) / 2, () => FRESCO.dado));
    out.dark.push(box(0.04, door.hi - 0.02, door.b - door.a, x1 - t + 0.02, 0, z0 + 0.6 + (door.a + door.b) / 2));
    out.dark.push(box(0.04, win.hi - win.lo, win.b - win.a, x1 - t + 0.02, win.lo, z0 + 0.6 + (win.a + win.b) / 2));
  }
  // The roof: a gable along z, its gables to the front and back.
  const r = gable({ x0: x0 - 0.02, x1: x1 + 0.04, z0, z1, eaveY: eave, pitch: D(22), along: 'z', over: 0.22, gableOver: 0.18, lod, seed: seed + 10 });
  out.tile.push(...r.tile);
  out.wood.push(...r.wood);
  for (const [z, n] of [[z1, 1], [z0, -1]]) {
    const g = gableTri(x0 + 0.02, x1 - 0.02, n > 0 ? z : z + t, t, eave, r.ridgeY - 0.04);
    out.stucco.push(g);
  }
  // A bench by the door, a water jar.
  out.wood.push(box(0.36, 0.06, 1.1, x1 + 0.3, 0.42, z0 + 2.1, 0.75));
  for (const dz of [-0.45, 0.45]) out.wood.push(box(0.3, 0.42, 0.06, x1 + 0.3, 0, z0 + 2.1 + dz, 0.6));
  if (lod < 2) out.clay.push(...[[x1 + 0.35, z0 + 0.35]].map(([x, z]) => tintGeometry(boxUV(new CylinderGeometry(0.16, 0.12, 0.5, lod ? 8 : 14, 1).translate(x, 0.25, z)), () => 0.85)));
  // Its doors (open while the post is kept).
  return { door: [x1 - t / 2, z0 + 0.6 + (door.a + door.b) / 2, door.b - door.a, door.hi] };
}

/** The envoy and a villager come to trade at the gate, a servant with an amphora (close up only). */
function envoys(mats) {
  const list = [];
  list.push(...togate(mats, 0.35, 0.03, 1.55, 2.6, { arms: 'orate', hair: 0x3a2a1c }));
  // A man of the villages: a cloak over a tunic, trousers, his hair and beard long and fair.
  list.push(...person(mats, { cloth: 0x6a6a3a, cloth2: 0x8a3a24, long: false, skin: 0xc49272, hair: 0xa06a3a, beard: true, arms: 'hold' }, -0.25, 0.03, 2.25, 2.6 + Math.PI));
  list.push(...servant(mats, 1.65, 0.03, 1.3, -0.9, { arms: 'hold' }));
  return list;
}

/** Build the mission post: { group, meshes, triangles }, its meshes tagged in userData.when ('open', 'shut'). */
export function buildSacellum({ lod = 0, seed = 901 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['rubble', 'trav', 'stucco', 'marble', 'tile', 'wood', 'paint', 'fresco', 'dark', 'gilt', 'clay', 'tesserae', 'ground', 'bronze', 'pane'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  walls(lod, seed, out);
  const sh = shrine(lod, seed + 100, out);
  const lg = lodge(lod, seed + 200, out);
  // The yard: beaten earth, flags on the path from the gate to the altar.
  const H = WX;
  out.ground.push(box(2 * H, 0.03, 2 * H, 0, 0, 0, 0.9));
  out.trav.push(...paving(-0.65, 0.65, S.altar[1] + 0.45, OUT - WT, 0.05, seed + 300, { rowW: 0.65, minL: 0.5, maxL: 0.9, lod, tone: 0.08, grime: 0.25 }));
  // Outside the wall, the verge to the street: a strip of paving before the gate.
  out.trav.push(...paving(-S.gate - 0.6, S.gate + 0.6, OUT, S.half - 0.05, 0.04, seed + 310, { rowW: 0.6, minL: 0.5, maxL: 0.9, lod, tone: 0.08, grime: 0.25 }));
  // The lantern on the gate's pier.
  if (lod < 2) {
    const l = lantern(...S.lamp, lod);
    out.bronze.push(...l.bronze);
    out.pane.push(l.pane);
  }
  const m = sacraMaterials();
  const c = castraMaterials();
  const p = new TaggedParts('sacellum');
  const small = { cast: false };
  p.add('walls', c.core, out.rubble);
  p.add('stone', m.trav, out.trav);
  p.add('stucco', m.stucco, out.stucco);
  p.add('marble', m.marble, out.marble);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  p.add('paint', m.painted, out.paint, small);
  if (out.fresco.length) p.add('fresco', m.fresco, out.fresco, small);
  p.add('inside', m.dark, out.dark, small);
  p.add('gilt', m.gilt, out.gilt);
  p.add('pots', m.clay, out.clay, small);
  p.add('threshold', m.tesserae, out.tesserae, small);
  p.add('yard', c.earth, out.ground, small);
  p.add('bronze', m.bronze, out.bronze, small);
  // The gate's leaves and the lodging's door: open while the post is kept, shut when it is not.
  const gz = OUT - WT / 2;
  const gOpen = doubleDoor(0, gz, 2 * S.gate, 2.4, 0.03, { open: true, lod });
  const gShut = doubleDoor(0, gz, 2 * S.gate, 2.4, 0.03, { open: false, lod });
  p.add('gate', m.wood, gOpen.wood, { when: 'open' });
  p.add('gate', m.wood, gShut.wood, { when: 'shut' });
  p.add('gate-iron', m.bronze, [...gOpen.bronze].filter(Boolean), { when: 'open', cast: false });
  p.add('gate-iron', m.bronze, [...gShut.bronze].filter(Boolean), { when: 'shut', cast: false });
  const [dx, dz, dw, dh] = lg.door;
  const dOpen = doubleDoor(0, 0, dw, dh, 0, { open: true, lod, studs: false }).wood.map((g) => g.rotateY(Math.PI / 2).translate(dx, 0, dz));
  const dShut = doubleDoor(0, 0, dw, dh, 0, { open: false, lod, studs: false }).wood.map((g) => g.rotateY(Math.PI / 2).translate(dx, 0, dz));
  p.add('doors', m.wood, dOpen, { when: 'open' });
  p.add('doors', m.wood, dShut, { when: 'shut' });
  // The altar's fire: lit while the post is kept.
  const fire = hearthFire(sh.hearth, 0.13, { lod, seed: seed + 400, big: 0.8 });
  p.add('coals', m.ash, fire.dark, small);
  p.add('fire', m.embers, fire.hot, { when: 'open', cast: false });
  p.add('flames', m.flame, fire.flames, { when: 'open', cast: false });
  p.add('ash', m.ash, fire.ash, { when: 'shut', cast: false });
  // The lantern's pane: lit while kept, dark when not.
  if (out.pane.length) {
    p.add('lamp', lanternPane(), out.pane, { when: 'open', cast: false });
    p.add('lamp', m.lampOut, out.pane.map((g) => g.clone()), { when: 'shut', cast: false });
  }
  // The post's standard by the gate: white, a gilt caduceus on its pole (flown while it is kept).
  const sd = standard(1.35, 2.85, 0.03, 3.0, lod, { w: 0.62, hc: 0.68, colour: lin(0xece6d6) });
  p.add('standard-pole', m.wood, sd.wood, { when: 'open' });
  p.add('standard', m.gilt, [...sd.gilt, ...Object.values(placeBins(caduceus(lod, 'gilt', 0.4), 1.35, 3.08, 2.85)).flat()], { when: 'open' });
  p.add('standard-cloth', m.cloth, sd.cloth, { when: 'open', cast: lod === 0 });
  p.add('standard-pole', m.wood, [box(0.05, 3.0, 0.05, 1.35, 0.03, 2.85, 0.7)], { when: 'shut' });
  if (lod === 0) addPeople(p, m, 'envoys', envoys(m), 'open');
  return p.build();
}

