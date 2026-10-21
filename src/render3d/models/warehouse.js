/**
 * models/warehouse.js
 * ----------------------------------------------------------------------------
 * The warehouse (Horreum) of the 3D look, 3 x 3 tiles (12 m square), as a
 * Republican storehouse of about 300 BC, not the brick horrea of the Empire
 * (fired-brick facing came with the Empire, so none is used here):
 *
 *   - The plan comes from the storehouses of the Mediterranean ports that
 *     Rome traded through: the Hellenistic warehouses of Delos, ranges of
 *     rooms round a paved court; and Rome's own Porticus Aemilia (193 BC),
 *     the great warehouse by the Tiber. Common to them: thick walls, few
 *     high slit windows, one gate that could be locked.
 *   - The walls come from the building habit of Latium and Campania: a
 *     plinth of tufa ashlar (opus quadratum, the soft grey-yellow volcanic
 *     stone of the Servian Wall) with the street walls above of tufa
 *     blocks, paler and smaller, and the court walls of rubble set in
 *     mortar and plastered (the early opus incertum of Pompeii and Cosa),
 *     framed in timber where a store needs it: posts at the corners and
 *     along the walls, a wall plate under the eaves, lintels over the
 *     openings (Vitruvius notes timber as the binder of such walls).
 *   - The gateway: two tufa piers rising above the walls, a stout timber
 *     lintel between them over the gate, a small tiled hood on timber
 *     brackets over the doors, and above it a terracotta plaque painted
 *     with the owners' names, as Etruscan and Latin buildings of the time
 *     were dressed in painted terracotta. Two leaves of studded timber.
 *   - The roofs are timber-trussed (the wall plates and the ends of the
 *     rafters show at the court) under tegulae and imbrices, with terracotta
 *     antefixes along the eaves toward the street (as on the temples of
 *     Satricum and Veii); the four ranges' roofs slope into the court, so
 *     the court and its goods show over the walls from the game's camera
 *     and the rain runs to the court's gutter.
 *   - In the court, eight bays of timber dunnage (the boards goods were
 *     stacked on to keep them off the wet floor), 2 m square, four loads
 *     to a bay: 32 cart loads, the game's 3200 units. What is stored is
 *     not part of this model: warehouseLoads() says which good's load
 *     (models/wares.js buildLoad) stands on which square metre, and the
 *     game draws each good as a kit of its own placed in this model's
 *     frame (render3d/models.js `more`), so the warehouse shows how
 *     full it is and what it holds, load by load.
 *
 * States (meshes tagged in userData.when): 'open' (staffed) the gate's
 * doors stand open; 'shut' they are closed.
 *
 * In metres, y up, the footprint's middle at the origin (-6..6), the gate
 * toward +z, as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, Matrix4, BoxGeometry } from 'three';
import { revolve, profileOf, merge, tintGeometry, boxUV, triangles, tube, D } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, tiledRoof, wallWithOpenings, lantern, lanternPane, inscription, antefixAt } from './masonry.js';
import { WARE_GOODS } from './wares.js';
import { artRng } from '../texgen.js';

/** The warehouse's key measures (metres): tests and the lab read them. */
export const WAREHOUSE = Object.freeze({
  half: 6,
  face: 5.6, // the outer walls' faces (what stands out of them stays inside the footprint)
  wall: 0.4,
  // The court is wide and the ranges low, one storey: from the game's
  // camera, 30 degrees down, a wall hides the ground for 1.7 times its height behind it, and the
  // court and its goods must show at every turn.
  court: 3.75, // the court's half width
  inner: 0.35, // the inner walls' thickness
  wallTop: 2.35,
  innerEave: 1.9,
  plinth: 0.84, // two courses of tufa ashlar
  gate: Object.freeze({ w: 2.0, h: 1.95 }),
  bay: 2.4, // between the bays' middles
  /** The lantern at the gate (x, y, z): the game's night lights read it. */
  lamp: Object.freeze([2.25, 1.45, 5.9]),
});

/** Loads of 100 units: a warehouse holds 32 (config.js WAREHOUSE_CAPACITY 3200). */
export const LOAD_UNITS = 100;

/** The bays' middles: a 3 x 3 grid of the court, less the middle of the front row (the way in from the gate). */
export const BAYS = Object.freeze([-1, 0, 1].flatMap((j) => [-1, 0, 1].map((i) => [i * WAREHOUSE.bay, j * WAREHOUSE.bay])).filter(([x, z]) => !(x === 0 && z > 0)));

/** Every load's square metre: four a bay, in bay order. */
const SLOTS = BAYS.flatMap(([bx, bz]) => [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].map(([dx, dz]) => [bx + dx, bz + dz]));

/** Each slot's matrix: its square metre, turned a seeded quarter (no two stacks of a good look the same way). */
const SLOT_MATS = SLOTS.map(([x, z], i) => new Matrix4().makeRotationY(((i * 7 + 3) % 4) * (Math.PI / 2)).setPosition(x, 0.11, z));

/**
 * The slots in the order they fill at art turn T: bay by bay, the bays
 * farthest from the camera first (the court's front corner is the one its
 * walls hide), and in each bay its far square metres first. The game turns
 * a model by -T quarter turns (models.js modelMatrix), the camera looks from
 * +x +z.
 */
export function slotOrder(T) {
  const th = (-(T & 3) * Math.PI) / 2;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const depth = ([x, z]) => x * c + z * s + (-x * s + z * c);
  const bays = BAYS.map((p, i) => i).sort((a, b) => depth(BAYS[a]) - depth(BAYS[b]) || a - b);
  return bays.map((bi) => [0, 1, 2, 3].map((k) => bi * 4 + k).sort((a, b) => depth(SLOTS[a]) - depth(SLOTS[b]) || a - b));
}
const ORDERS = [0, 1, 2, 3].map(slotOrder);

/** What a building with no stock (a ghost) holds. */
const NONE = Object.freeze([]);

/** The cache of each warehouse's loads (by its stock: freed with it). */
const CACHE = new WeakMap();

/** How many loads a stock of `amount` units shows: one for every 100 or part of it. */
export function loadsOf(amount) {
  return amount > 0 ? Math.ceil(amount / LOAD_UNITS - 1e-9) : 0;
}

/**
 * What a warehouse shows of what it holds: one load for every 100 units
 * of a good or part of it, the goods in WARE_GOODS' order, their loads one
 * after another in the slots the camera sees best first (slotOrder: a
 * quarter full is the two far bays, packed). Rounding every good up can
 * ask for more than the 32 slots (twenty goods of 160 units are 3,200
 * units but 40 loads): then every good keeps at least one load and the
 * biggest give up theirs, so nothing it holds goes unseen. Returns
 * [{ key, state, at }] (at: a Matrix4 in the model's metres), the same
 * array while nothing changed.
 */
export function warehouseLoads(stock, T = 0) {
  if (!stock) return NONE;
  let sig = String(T & 3);
  for (const g of WARE_GOODS) sig += `,${loadsOf(stock[g] || 0)}`;
  const was = CACHE.get(stock);
  if (was && was.sig === sig) return was.list;
  const list = [];
  const slots = ORDERS[T & 3].flat();
  const counts = fitLoads(WARE_GOODS.map((g) => loadsOf(stock[g] || 0)), slots.length);
  let s = 0;
  WARE_GOODS.forEach((good, i) => {
    for (let n = counts[i]; n > 0; n--) list.push({ key: `warehouse:load:${good}`, state: 1, at: SLOT_MATS[slots[s++]] });
  });
  CACHE.set(stock, { sig, list });
  return list;
}

/**
 * Loads a good (`want`) cut down to `room` in all when they are more: the
 * biggest give one up at a time, none below one (more goods than room:
 * the last goods go unseen, as few as can be).
 */
export function fitLoads(want, room) {
  const n = want.slice();
  let total = n.reduce((a, b) => a + b, 0);
  while (total > room) {
    let big = -1;
    for (let i = 0; i < n.length; i++) if (n[i] > 1 && (big < 0 || n[i] > n[big])) big = i;
    if (big < 0) {
      // Every good down to one load and still too many: the last ones go.
      for (let i = n.length - 1; i >= 0 && total > room; i--) if (n[i]) { n[i] = 0; total--; }
      break;
    }
    n[big]--;
    total--;
  }
  return n;
}

/** How full a warehouse is (0 to 1) by what it shows: loads standing over the 32 it has room for. */
export function shownFill(stock) {
  return warehouseLoads(stock, 0).length / SLOTS.length;
}

/** The warehouse's state from the sim: open (staffed) or shut. */
export function warehouseState(b) {
  return b.efficiency > 0 ? 'open' : 'shut';
}

/** Does a part tagged `when` show in `state` ('open', 'shut'; a load's number)? */
export function warehouseShows(when, state) {
  if (!when || when === 'always') return true;
  return when === state;
}


// ---------------------------------------------------------------------------
// The building
// ---------------------------------------------------------------------------

/** Stacked courses of tufa ashlar (opus quadratum) from y0 to y1, centred on (cx, cz), each a little narrower than the one below. */
function ashlar(cx, cz, w, d, y0, y1, seed, lod) {
  const out = [];
  const n = Math.max(1, Math.round((y1 - y0) / 0.42));
  const ch = (y1 - y0) / n;
  for (let c = 0; c < n; c++) {
    const shrink = lod === 2 ? 0 : (c % 2) * 0.05;
    out.push(slab(w - shrink, ch - 0.008, d - shrink, { bevel: 0.012, seed: seed + c * 7, wobble: 0.002, tone: 0.05, grime: c ? 0.05 : 0.3 }).translate(cx, y0 + c * ch, cz));
  }
  return out;
}

/** A geometry's vertex colours scaled by `k` (clamped to white). */
function lighten(g, k) {
  const c = g.attributes.color;
  for (let i = 0; i < c.array.length; i++) c.array[i] = Math.min(1, c.array[i] * k);
  return g;
}

/**
 * One side's outer wall (side 0: the front, its face at z = +face), with
 * its openings (the gate on the front, slit windows high up), its tufa
 * plinth, timber posts and wall plate, the tile edge and its antefixes.
 * Built for side 0 and turned by the caller.
 */
function outerWall(sideIndex, lod, seed) {
  const W = WAREHOUSE;
  const out = { tufa: [], timber: [], tiles: [], plaster: [] };
  const len = 2 * W.face;
  const front = sideIndex === 0;
  const openings = [];
  if (front) openings.push({ x: 0, w: W.gate.w, h: W.gate.h });
  // Slit windows for air, high up where no thief reaches: two each side of the middle (the gate's flanks on the front).
  for (const x of front ? [-3.6, 3.6] : [-3.6, -1.2, 1.2, 3.6]) openings.push({ x, w: 0.22, h: 0.5, y: 1.25 });
  const wall = wallWithOpenings(len, W.wallTop, W.wall, openings, { lod });
  // The wall above the plinth is plastered as the homes are (the surface's red dado shows as a band over
  // the plinth): bare tufa stays at the plinth, the quoins and the gate's piers, where the stone would
  // show. Bare blue-grey tufa all over read as a bunker (v0.30.9).
  out.plaster.push(lighten(wall, 4).translate(0, 0, W.face)); // (the blocks' grey vertex tint would dull the plaster: whitened)
  // The plinth: two courses of tufa blocks along the foot, outside, the joints of the upper one broken over the lower.
  const rnd = artRng(seed);
  for (let c = 0; c < 2; c++) {
    let x = -W.face + (c ? 0.5 : 0);
    while (x < W.face - 0.01) {
      const step = lod === 2 ? 2.4 : 0.8 + rnd() * 0.6;
      const xb = Math.min(W.face, x + step);
      const gap = front && xb > -W.gate.w / 2 && x < W.gate.w / 2;
      if (!gap) out.tufa.push(slab(xb - x - 0.006, 0.42, 0.12, { bevel: 0.01, seed: seed + x * 13 + c, wobble: 0.002, tone: 0.05, grime: c ? 0.1 : 0.4 }).translate((x + xb) / 2, c * 0.42, W.face + 0.05));
      x = gap ? Math.max(xb, W.gate.w / 2) : xb;
    }
  }
  const lift = sideIndex * 0.003;
  // Timber posts standing on the plinth: one at the corner (the four sides turn it to every corner) and a stud
  // along each side wall between the windows, which the plaster is held by.
  const postH = W.wallTop - 0.2 - W.plinth;
  out.timber.push(slab(0.27, postH, 0.27, { bevel: 0.012, seed: seed + 3, wobble: 0.002, tone: 0.1, grime: 0.2 }).translate(W.face - 0.11, W.plinth, W.face - 0.11));
  if (lod < 2 && !front) {
    for (const px of [-2.4, 0, 2.4]) out.timber.push(slab(0.2, postH, 0.12, { bevel: 0.01, seed: seed + px * 5, wobble: 0.002, tone: 0.1, grime: 0.2 }).translate(px, W.plinth, W.face + 0.03));
  }
  // The wall plate under the eaves, standing out of the face on the rafters' ends.
  out.timber.push(slab(len, 0.16, 0.3, { bevel: 0.01, seed: seed + 1, wobble: 0.002, tone: 0.1, grime: 0 }).translate(0, W.wallTop - 0.28 + lift, W.face - 0.02));
  // The tile edge on the wall's top and the antefixes along it, facing the street.
  out.tiles.push(slab(len, 0.1, 0.34, { bevel: 0.01, seed: seed + 2, wobble: 0.002, tone: 0.06, grime: 0 }).translate(0, W.wallTop - 0.12 + lift, W.face - 0.04));
  if (lod < 2) {
    const ar = artRng(seed + 5);
    const step = lod ? 1.6 : 0.8;
    for (let x = -W.face + 0.5; x < W.face - 0.3; x += step) {
      // (Not by the gate's tufa piers.)
      if (front && Math.abs(x) < 2.2) continue;
      out.tiles.push(antefixAt([x, W.wallTop - 0.02 + lift, W.face + 0.03], [0, 0, 1], ar));
    }
  }
  // The windows: a timber lintel over each slit, and a shutter, shut on every other one and hanging open on the rest.
  let k = 0;
  for (const o of openings) {
    if (o.y === undefined) continue;
    out.timber.push(slab(o.w + 0.3, 0.1, 0.16, { bevel: 0.008, seed: seed + o.x * 3, wobble: 0.001, tone: 0.1, grime: 0 }).translate(o.x, o.y + o.h, W.face + 0.04));
    if (lod === 2) continue;
    if (k++ % 2) {
      out.timber.push(slab(o.w + 0.06, o.h + 0.04, 0.03, { bevel: 0.004, seed: seed + o.x * 7, wobble: 0.001, tone: 0.12, grime: 0.1 }).translate(o.x, o.y - 0.02, W.face + 0.03));
    } else {
      const leaf = slab(o.w, o.h, 0.03, { bevel: 0.004, seed: seed + o.x * 9, wobble: 0.001, tone: 0.12, grime: 0.1 }).translate(o.w / 2, 0, 0);
      leaf.rotateY(-1.25);
      out.timber.push(leaf.translate(o.x - o.w / 2, o.y, W.face + 0.03));
    }
  }
  return out;
}

/** The gateway: tufa piers, timber lintel, the hood, the plaque, threshold, the doors open and shut. */
function gateway(lod, seed) {
  const W = WAREHOUSE;
  const out = { tufa: [], timber: [], tiles: [], cream: [], letters: [], woodOpen: [], woodShut: [], iron: [], ironOpen: [], ironShut: [], bronze: [], pane: [] };
  const z = W.face;
  const gw = W.gate.w;
  const gh = W.gate.h;
  const top = 2.95;
  const pz = z - 0.05; // the piers' middle: they stand 0.1 proud of the wall (and half inside it)
  const front = pz + 0.15;
  // Two piers of ashlar either side of the door, rising above the wall's top, and the attic between them over the lintel.
  for (const s of [-1, 1]) out.tufa.push(...ashlar(s * (gw / 2 + 0.37), pz, 0.74, 0.3, 0, top, seed + s, lod));
  out.tufa.push(...ashlar(0, pz, gw + 0.02, 0.3, gh + 0.18, top, seed + 11, lod));
  out.tufa.push(slab(gw + 1.7, 0.1, 0.4, { bevel: 0.014, seed: seed + 12, wobble: 0.001, tone: 0.04, grime: 0 }).translate(0, top, pz));
  // The timber lintel across the door, its ends bedded in the piers.
  out.timber.push(slab(gw + 0.5, 0.2, 0.3, { bevel: 0.012, seed: seed + 3, wobble: 0.002, tone: 0.1, grime: 0.1 }).translate(0, gh - 0.02, pz + 0.01));
  // The hood over the doors: a pent of tiles on two timber brackets, from the attic's face out over the lintel.
  const hy = gh + 0.45;
  const hd = 0.26;
  const hw = gw / 2;
  const q = [[-hw, hy - 0.2, front + hd], [hw, hy - 0.2, front + hd], [hw, hy, front], [-hw, hy, front]];
  out.tiles.push(...tiledRoof(q, { pitch: 0.28, lod, seed: seed + 5, imbrexR: 0.04 }).tiles);
  for (const s of [-1, 1]) {
    const bx = s * 0.78;
    out.timber.push(slab(0.1, 0.1, hd - 0.02, { bevel: 0.008, seed: seed + 30 + s, wobble: 0.001, tone: 0.1, grime: 0 }).translate(bx, hy - 0.32, front + (hd - 0.02) / 2));
    if (lod < 2) out.timber.push(tube([[bx, gh + 0.2, front + 0.01], [bx, hy - 0.22, front + hd - 0.03]], 0.035, { radial: 4, segments: 1, around: 0.3 }));
  }
  // The owners' plaque: painted terracotta set in the attic's face, their names in red.
  const py = gh + 0.7;
  out.cream.push(slab(gw - 0.04, 0.32, 0.04, { bevel: 0.006, seed: seed + 6, wobble: 0, tone: 0.03, grime: 0 }).translate(0, py, front));
  if (lod === 0) out.letters.push(...inscription('HORREA·CAELI', py + 0.08, front + 0.026, 0.16));
  // The threshold, a sill of tufa.
  out.tufa.push(slab(gw + 0.2, 0.06, W.wall + 0.2, { bevel: 0.01, seed: seed + 9, wobble: 0.001, tone: 0.05, grime: 0.2 }).translate(0, 0, z - W.wall / 2 + 0.05));
  // The doors: two leaves of planks with iron straps and studs; open, swung in against the passage's walls.
  const lw = gw / 2 - 0.01;
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const wood = [];
      const iron = [];
      wood.push(slab(lw, gh - 0.04, 0.08, { bevel: 0.006, seed: seed + 20 + s, wobble: 0.001, tone: 0.06, grime: 0.3 }).translate(lw / 2, 0, 0));
      if (lod < 2) {
        // Vertical planks shaded apart; three iron straps across.
        for (let k = 1; k < 4; k++) wood.push(slab(0.012, gh - 0.1, 0.005, { bevel: 0.001, seed: seed + k, wobble: 0, tone: 0, grime: 0 }).translate((lw * k) / 4, 0.03, 0.042));
        for (const y of [0.35, gh / 2, gh - 0.45]) iron.push(slab(lw - 0.04, 0.07, 0.012, { bevel: 0.002, seed: seed + y * 10, wobble: 0, tone: 0, grime: 0 }).translate(lw / 2, y, 0.046));
      }
      if (lod === 0) {
        // Studs in rows (the doors of a store were studded against the axe).
        for (const y of [0.2, 0.6, 1.0, 1.4, 1.75]) for (let k = 0; k < 4; k++) iron.push(slab(0.045, 0.045, 0.02, { bevel: 0.006, seed: seed + y * 7 + k, wobble: 0, tone: 0, grime: 0 }).translate(lw * (0.12 + k * 0.25), y - 0.02, 0.05));
      }
      const turn = (g) => {
        if (s > 0) g.translate(-lw, 0, 0);
        g.rotateY(open ? -s * D(95) : 0);
        return g.translate(s * gw / 2, 0.06, z - 0.12);
      };
      (open ? out.woodOpen : out.woodShut).push(...wood.map(turn));
      (open ? out.ironOpen : out.ironShut).push(...iron.map(turn));
    }
  }
  // The lantern on its bracket by the gate.
  if (lod < 2) {
    const [lx, ly, lz] = W.lamp;
    out.iron.push(tube([[lx, ly + 0.45, z + 0.02], [lx, ly + 0.45, lz - 0.02], [lx, ly + 0.38, lz - 0.06]], 0.012, { radial: 4, segments: 4, around: 0.3 }));
    const l = lantern(lx, ly, lz - 0.08, lod);
    out.bronze.push(...l.bronze);
    out.pane.push(l.pane);
  }
  return out;
}

/**
 * The court's side of each range (side 0: the front range's, its face at
 * z = +court): a plastered wall with timber-lintelled doorways into the
 * rooms (and the passage from the gate on the front), the wall plate and
 * the rafters' ends over it, the dark rooms behind.
 */
function innerSide(sideIndex, lod, seed) {
  const W = WAREHOUSE;
  const out = { plaster: [], tufa: [], timber: [], dark: [] };
  const front = sideIndex === 0;
  const len = 2 * (W.court + W.inner);
  const door = 1.1;
  const openings = front
    ? [{ x: 0, w: W.gate.w, h: W.gate.h - 0.3 }]
    : [{ x: -1.5, w: 1.3, h: door }, { x: 1.5, w: 1.3, h: door }];
  // (Its face toward the court at z = court: the wall is built from z = 0 back, so turned half round.)
  const wall = wallWithOpenings(len, W.innerEave, W.inner, openings, { lod });
  wall.rotateY(Math.PI);
  out.plaster.push(wall.translate(0, 0, W.court));
  // Tufa thresholds in the doorways, a timber lintel over each (and jamb posts on the rooms' doors).
  for (const o of openings) {
    out.tufa.push(slab(o.w + 0.1, 0.05, W.inner + 0.1, { bevel: 0.008, seed: seed + o.x * 5, wobble: 0.001, tone: 0.05, grime: 0.2 }).translate(o.x, 0, W.court + W.inner / 2));
    out.timber.push(slab(o.w + 0.36, 0.14, W.inner + 0.08, { bevel: 0.008, seed: seed + o.x * 3, wobble: 0.001, tone: 0.1, grime: 0 }).translate(o.x, o.h, W.court + W.inner / 2));
    if (lod < 2 && !front) for (const s of [-1, 1]) out.timber.push(slab(0.13, o.h, 0.13, { bevel: 0.008, seed: seed + o.x + s, wobble: 0.001, tone: 0.1, grime: 0.2 }).translate(o.x + s * (o.w / 2 + 0.065), 0, W.court + 0.05));
  }
  // The wall plate along the wall's top, and the rafters' ends reaching over the court under the tiles' edge.
  const lift = sideIndex * 0.003;
  out.timber.push(slab(2 * W.court - 0.1, 0.14, 0.22, { bevel: 0.008, seed: seed + 4, wobble: 0.001, tone: 0.1, grime: 0 }).translate(0, W.innerEave - 0.14 + lift, W.court));
  if (lod < 2) {
    for (let x = -3.3; x < 3.31; x += 0.55) out.timber.push(slab(0.08, 0.09, 0.28, { bevel: 0.006, seed: seed + x * 11, wobble: 0.001, tone: 0.1, grime: 0 }).translate(x, W.innerEave - 0.12 + lift, W.court - 0.1));
  }
  // The rooms behind: a dark box seen from inside (the range from the inner wall to the outer).
  const z0 = W.court + W.inner;
  const z1 = W.face - W.wall;
  const box = new BoxGeometry(2 * (W.face - W.wall) - 0.02, W.innerEave - 0.05, z1 - z0 - 0.02);
  const idx = box.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const k = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = k;
  }
  box.translate(0, (W.innerEave - 0.05) / 2 + 0.01, (z0 + z1) / 2);
  box.computeVertexNormals();
  if (front) {
    // The passage from the gate to the court is open: its walls lined in tufa, the rooms either side dark.
    for (const s of [-1, 1]) {
      const pw = slab(0.3, W.gate.h, z1 - z0 + 0.02, { bevel: 0.004, seed: seed + s, wobble: 0, tone: 0.04, grime: 0.3 });
      out.tufa.push(pw.translate(s * (W.gate.w / 2 + 0.15), 0, (z0 + z1) / 2));
    }
    // Paving through the passage.
    out.tufa.push(...paving(-W.gate.w / 2, W.gate.w / 2, z0 - 0.02, z1 + 0.02, 0.05, seed + 9, { rowW: 0.55, minL: 0.5, maxL: 0.9, lod }));
    for (const s of [-1, 1]) {
      const half = new BoxGeometry(W.face - W.wall - W.gate.w / 2 - 0.3, W.innerEave - 0.05, z1 - z0 - 0.02);
      const ix = half.index.array;
      for (let i = 0; i < ix.length; i += 3) {
        const k = ix[i + 1];
        ix[i + 1] = ix[i + 2];
        ix[i + 2] = k;
      }
      half.translate(s * ((W.face - W.wall + W.gate.w / 2 + 0.3) / 2), (W.innerEave - 0.05) / 2 + 0.01, (z0 + z1) / 2);
      half.computeVertexNormals();
      out.dark.push(tintGeometry(boxUV(half)));
    }
  } else {
    out.dark.push(tintGeometry(boxUV(box)));
  }
  return out;
}

/** The roof: four tiled slopes from the outer walls' tops down to the court, meeting in valleys at its corners. */
function roof(lod, seed) {
  const W = WAREHOUSE;
  const out = [];
  const o = W.face - 0.1; // the top edge, on the outer walls
  const i = W.court - 0.12; // the eave, a little over the court
  const yTop = W.wallTop + 0.08;
  const yE = W.innerEave + 0.02;
  for (let s = 0; s < 4; s++) {
    // Side 0's slope (the front range), turned to each side: the eave's ends, then the top's.
    const q = [[i, yE, i], [-i, yE, i], [-o, yTop, o], [o, yTop, o]];
    const t = tiledRoof(q, { pitch: 0.4, lod, seed: seed + s });
    for (const g of t.tiles) out.push(g.rotateY((s * Math.PI) / 2));
  }
  return out;
}

/** Build the warehouse: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildWarehouse({ lod = 0, seed = 81 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const W = WAREHOUSE;
  const group = new Group();
  group.name = 'warehouse';
  const meshes = [];
  const add = (geos, mat, name, when = 'always', cast = true) => {
    const list = geos.filter(Boolean);
    if (!list.length) return null;
    const m = new Mesh(merge(list), mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    m.userData.when = when;
    group.add(m);
    meshes.push(m);
    return m;
  };
  const parts = { plaster: [], tufa: [], timber: [], cream: [], letters: [], dark: [], wood: [], woodOpen: [], woodShut: [], iron: [], ironOpen: [], ironShut: [], bronze: [], tiles: [], pane: [] };
  const put = (o, turn = 0) => {
    for (const k of Object.keys(o)) for (const g of o[k]) parts[k].push(turn ? g.rotateY(turn) : g);
  };
  for (let s = 0; s < 4; s++) {
    put(outerWall(s, lod, seed + s * 50), (s * Math.PI) / 2);
    put(innerSide(s, lod, seed + 300 + s * 50), (s * Math.PI) / 2);
  }
  put(gateway(lod, seed + 7));
  parts.tiles.push(...roof(lod, seed + 9));
  // The court: tufa flags, a gutter round them under the eaves.
  const c = W.court;
  parts.tufa.push(...paving(-c, c, -c, c, 0.05, seed + 11, { rowW: 0.75, minL: 0.7, maxL: 1.3, lod, tone: 0.06, grime: 0.1 }));
  if (lod < 2) {
    for (let s = 0; s < 4; s++) {
      const g = slab(2 * c - 0.2, 0.06, 0.18, { bevel: 0.01, seed: seed + 20 + s, wobble: 0.002, tone: 0.03, grime: 0.5 });
      parts.tufa.push(tintGeometry(g, (x, y) => (y > 0.05 ? 0.6 : 0.8)).translate(0, 0, c - 0.12).rotateY((s * Math.PI) / 2));
    }
  }
  // The bays' dunnage: boards across two bearers, under every bay.
  const rnd = artRng(seed + 13);
  for (const [bx, bz] of BAYS) {
    if (lod === 2) {
      parts.wood.push(slab(2.15, 0.11, 2.15, { bevel: 0.01, seed: seed + bx * 3 + bz, wobble: 0, tone: 0.05, grime: 0 }).translate(bx, 0.0, bz));
      continue;
    }
    const turned = rnd() < 0.5;
    for (const b of [-0.85, 0, 0.85]) {
      const g = slab(0.1, 0.06, 2.15, { bevel: 0.008, seed: seed + bx * 7 + bz * 3 + b, wobble: 0.002, tone: 0.08, grime: 0.3 });
      if (turned) g.rotateY(Math.PI / 2);
      parts.wood.push(g.translate(bx + (turned ? 0 : b), 0.0, bz + (turned ? b : 0)));
    }
    for (let k = 0; k < 7; k++) {
      const g = slab(2.15, 0.05, 0.27, { bevel: 0.006, seed: seed + bx * 11 + bz * 5 + k, wobble: 0.003, tone: 0.1, grime: 0.05 });
      if (turned) g.rotateY(Math.PI / 2);
      const off = -0.93 + k * 0.31;
      parts.wood.push(g.translate(bx + (turned ? off : 0), 0.06, bz + (turned ? 0 : off)));
    }
  }
  // A steelyard (statera) hung under the gate passage's ceiling to weigh what comes in.
  if (lod === 0) {
    const sz = W.court + 1.1;
    parts.iron.push(tube([[-0.5, 1.62, sz], [0.5, 1.68, sz]], 0.012, { radial: 4, segments: 2, around: 0.3 }));
    parts.iron.push(tube([[0.0, 1.65, sz], [0.0, W.gate.h, sz]], 0.006, { radial: 3, segments: 1, around: 0.3 }));
    parts.bronze.push(revolve(profileOf([[0, 0], [0.05, 0.02], [0.06, 0.08], [0.03, 0.12], [0, 0.13]]), { segments: 8, metres: 0.3 }).translate(0.42, 1.4, sz));
  }
  add(parts.plaster, material('plaster', { surface: 'plaster', vertexColors: true, snow: 1 }), 'walls');
  add(parts.tufa, material('tufa', { surface: 'tufa', vertexColors: true, snow: 1 }), 'stone');
  add(parts.timber, material('wood', { surface: 'wood', vertexColors: true, snow: 1 }), 'timber');
  add(parts.cream, material('slip-cream', { surface: 'plaster', color: 0xe6d9b8, vertexColors: true, snow: 0.6 }), 'plaque');
  add(parts.letters, material('inscription-red', { color: 0x6a1e14, roughness: 0.8, snow: 0.3 }), 'letters', 'always', false);
  add(parts.tiles, material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 1 }), 'roof');
  add(parts.dark, material('room-dark', { color: 0x0e0b09, roughness: 1, snow: 0, wet: 0 }), 'rooms', 'always', false);
  add(parts.wood, material('wood', { surface: 'wood', vertexColors: true, snow: 1 }), 'dunnage');
  // (Paler oak than the posts, so the iron straps and studs read on the leaves.)
  add(parts.woodOpen, material('door-oak', { surface: 'wood', color: 0xc9a673, vertexColors: true, snow: 1 }), 'doors-open', 'open');
  add(parts.woodShut, material('door-oak', { surface: 'wood', color: 0xc9a673, vertexColors: true, snow: 1 }), 'doors-shut', 'shut');
  add(parts.iron, material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }), 'iron');
  add(parts.ironOpen, material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }), 'straps-open', 'open');
  add(parts.ironShut, material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }), 'straps-shut', 'shut');
  add(parts.bronze, material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }), 'bronze');
  add(parts.pane, lanternPane(), 'lamp', 'always', false);
  let tris = 0;
  for (const m of meshes) tris += triangles(m.geometry);
  return { group, meshes, triangles: tris };
}

/** Show a state on a built warehouse (the lab): 'open' or 'shut'. */
export function setWarehouseState(w, state) {
  for (const m of w.meshes) m.visible = warehouseShows(m.userData.when, state);
}

/** The slots' matrices and their count (the lab and tests). */
export const SLOT_COUNT = SLOTS.length;
export function slotMatrix(i) {
  return SLOT_MATS[i];
}
