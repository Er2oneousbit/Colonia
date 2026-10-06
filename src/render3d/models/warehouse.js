/**
 * models/warehouse.js
 * ----------------------------------------------------------------------------
 * The warehouse (Horreum) of the 3D look, 3 x 3 tiles (12 m square), from
 * the storehouses of Ostia and Rome rather than from the 2D sprite:
 *
 *   - Ostia's Horrea Epagathiana et Epaphroditiana (about AD 145): a
 *     brick-faced block whose only way in from the street is a monumental
 *     gateway, its door framed by two engaged brick columns carrying an
 *     entablature and a pediment, the owners' names on a marble plaque
 *     over it; behind it a court ringed by storerooms (cellae) opening on
 *     it through arched doorways. Ostia's other horrea (Hortensius's, the
 *     Grandi Horrea) and Rome's commercial horrea (Galbana, Agrippiana)
 *     repeat the plan: rooms round a court, few and high slit windows,
 *     thick walls, one gate that could be locked.
 *   - Here: outer walls of brick (opus testaceum) on a travertine plinth,
 *     brick pilasters at the corners and along the facades, a moulded
 *     brick cornice; the gateway on the front with its columns, pediment
 *     and plaque, its two doors of studded timber; four ranges of rooms
 *     round a paved court, their arched doorways dark, their tiled roofs
 *     sloping into the court (so the court and its goods show over the
 *     walls from the game's camera, and the rain runs to the court's
 *     gutter).
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

import { Group, Mesh, Matrix4, BufferGeometry, Float32BufferAttribute, BoxGeometry } from 'three';
import { revolve, profileOf, merge, tintGeometry, boxUV, triangles, tube } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, tiledRoof, wallWithOpenings, lantern, lanternPane } from './masonry.js';
import { WARE_GOODS } from './wares.js';
import { artRng } from '../texgen.js';

/** The warehouse's key measures (metres): tests and the lab read them. */
export const WAREHOUSE = Object.freeze({
  half: 6,
  face: 5.72, // the outer walls' faces (what stands out of them stays inside the footprint)
  wall: 0.4,
  // The court is wide and the ranges low, one storey (Ostia's rose two or three): from the game's
  // camera, 30 degrees down, a wall hides the ground for 1.7 times its height behind it, and the
  // court and its goods must show at every turn.
  court: 3.75, // the court's half width
  inner: 0.35, // the inner walls' thickness
  wallTop: 2.35,
  innerEave: 1.9,
  gate: Object.freeze({ w: 2.0, h: 1.95 }),
  bay: 2.4, // between the bays' middles
  /** The lantern at the gate (x, y, z): the game's night lights read it. */
  lamp: Object.freeze([1.45, 1.45, 5.92]),
});

/** Loads of 100 units: a warehouse holds 32 (config.js WAREHOUSE_CAPACITY 3200). */
export const LOAD_UNITS = 100;

const D = (deg) => (deg * Math.PI) / 180;

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

/**
 * One side's outer wall (side 0: the front, its face at z = +face), with
 * its openings (the gate on the front, slit windows high up), its plinth,
 * pilasters and cornice. Built for side 0 and turned by the caller.
 */
function outerWall(sideIndex, lod, seed) {
  const W = WAREHOUSE;
  const out = { brick: [], trav: [] };
  const len = 2 * W.face;
  const front = sideIndex === 0;
  const openings = [];
  if (front) openings.push({ x: 0, w: W.gate.w, h: W.gate.h });
  // Slit windows for air, high up where no thief reaches: two each side of the middle (the gate's flanks on the front).
  for (const x of front ? [-3.6, 3.6] : [-3.6, -1.2, 1.2, 3.6]) openings.push({ x, w: 0.22, h: 0.5, y: 1.2 });
  const wall = wallWithOpenings(len, W.wallTop, W.wall, openings, { lod });
  out.brick.push(wall.translate(0, 0, W.face));
  // The plinth: a course of travertine along the foot, outside.
  const rnd = artRng(seed);
  let x = -W.face;
  while (x < W.face - 0.01) {
    const xb = Math.min(W.face, x + 0.8 + rnd() * 0.6);
    const gap = front && xb > -W.gate.w / 2 && x < W.gate.w / 2;
    if (!gap) out.trav.push(slab(xb - x - 0.006, 0.42, 0.1, { bevel: 0.01, seed: seed + x * 13, wobble: 0.002, tone: 0.05, grime: 0.4 }).translate((x + xb) / 2, 0, W.face + 0.04));
    x = gap ? Math.max(xb, W.gate.w / 2) : xb;
  }
  // Pilasters: at the corners and at a third of the way along, brick on travertine bases, travertine capitals.
  for (const px of [-W.face + 0.28, -1.95, 1.95, W.face - 0.28]) {
    if (front && Math.abs(px) < 2) continue;
    out.brick.push(slab(0.52, W.wallTop - 0.62, 0.1, { bevel: 0.006, seed: seed + px * 7, wobble: 0, tone: 0, grime: 0 }).translate(px, 0.42, W.face + 0.05));
    out.trav.push(slab(0.62, 0.2, 0.16, { bevel: 0.01, seed: seed + px * 9, wobble: 0.001, tone: 0.03, grime: 0.2 }).translate(px, 0.42, W.face + 0.08));
    out.trav.push(slab(0.66, 0.14, 0.18, { bevel: 0.01, seed: seed + px * 11, wobble: 0.001, tone: 0.03, grime: 0 }).translate(px, W.wallTop - 0.2, W.face + 0.09));
  }
  // The cornice: two corbelled courses of brick and a travertine coping.
  // (Each side's a hair higher than the last: where two meet over a corner their tops never fight.)
  const lift = sideIndex * 0.003;
  out.brick.push(slab(len + 0.1, 0.12, W.wall + 0.12, { bevel: 0.004, seed: seed + 1, wobble: 0, tone: 0, grime: 0 }).translate(0, W.wallTop - 0.06 + lift, W.face - W.wall / 2 + 0.06));
  out.trav.push(slab(len + 0.2, 0.1, 0.32, { bevel: 0.012, seed: seed + 2, wobble: 0.001, tone: 0.03, grime: 0 }).translate(0, W.wallTop + 0.06 + lift, W.face - 0.08));
  // The window frames: travertine sills and lintels.
  for (const o of openings) {
    if (o.y === undefined) continue;
    out.trav.push(slab(o.w + 0.18, 0.08, 0.14, { bevel: 0.008, seed: seed + o.x * 5, wobble: 0.001, tone: 0.03, grime: 0.2 }).translate(o.x, o.y - 0.08, W.face + 0.03));
    out.trav.push(slab(o.w + 0.22, 0.12, 0.14, { bevel: 0.008, seed: seed + o.x * 3, wobble: 0.001, tone: 0.03, grime: 0 }).translate(o.x, o.y + o.h, W.face + 0.03));
  }
  return out;
}

/** The gateway: engaged columns, entablature, pediment, plaque, threshold, the doors open and shut. */
function gateway(lod, seed) {
  const W = WAREHOUSE;
  const out = { brick: [], trav: [], marble: [], woodOpen: [], woodShut: [], iron: [], ironOpen: [], ironShut: [], bronze: [], pane: [] };
  const z = W.face;
  const gw = W.gate.w;
  const gh = W.gate.h;
  // Engaged brick columns on travertine bases, brick capitals, either side of the door.
  for (const s of [-1, 1]) {
    const x = s * (gw / 2 + 0.42);
    out.trav.push(slab(0.6, 0.42, 0.22, { bevel: 0.012, seed: seed + s, wobble: 0.001, tone: 0.03, grime: 0.4 }).translate(x, 0, z + 0.06));
    const shaft = revolve(profileOf([[0.22, 0.42], [0.24, 0.48], [0.22, 0.54], [0.205, gh + 0.1], [0.24, gh + 0.16], [0.26, gh + 0.3], [0, gh + 0.3]]), { segments: lod === 2 ? 6 : lod ? 10 : 18, metres: 0.96 });
    // (Half a column stands proud of the wall: the back half is inside it.)
    out.brick.push(shaft.translate(x, 0, z - 0.04));
  }
  // The flat lintel over the door (travertine), the entablature over the columns, the pediment.
  const eY = gh + 0.3;
  const ew = gw + 1.5;
  out.trav.push(slab(gw + 0.3, 0.3, 0.12, { bevel: 0.01, seed: seed + 3, wobble: 0.001, tone: 0.03, grime: 0 }).translate(0, gh, z + 0.03));
  out.brick.push(slab(ew, 0.42, 0.42, { bevel: 0.006, seed: seed + 4, wobble: 0, tone: 0, grime: 0 }).translate(0, eY, z + 0.04));
  out.trav.push(slab(ew + 0.2, 0.12, 0.46, { bevel: 0.012, seed: seed + 5, wobble: 0.001, tone: 0.03, grime: 0 }).translate(0, eY + 0.42, z + 0.04));
  // The owners' plaque: white marble set in the entablature's face.
  out.marble.push(slab(1.7, 0.3, 0.03, { bevel: 0.004, seed: seed + 6, wobble: 0, tone: 0, grime: 0 }).translate(0, eY + 0.06, z + 0.26));
  // The pediment: a brick tympanum, travertine raking cornices.
  const pH = 0.95;
  const pw = ew / 2 + 0.1;
  const py = eY + 0.54;
  const tri = new BufferGeometry();
  const zf = z + 0.16;
  const zb = z - 0.1;
  tri.setAttribute('position', new Float32BufferAttribute([
    -pw, py, zf, pw, py, zf, 0, py + pH, zf,
    pw, py, zb, -pw, py, zb, 0, py + pH, zb,
  ], 3));
  tri.computeVertexNormals();
  out.brick.push(tintGeometry(boxUV(tri)));
  for (const s of [-1, 1]) {
    const len = Math.hypot(pw + 0.1, pH);
    const g = slab(len, 0.1, 0.36, { bevel: 0.01, seed: seed + 7 + s, wobble: 0, tone: 0.03, grime: 0 });
    // Built along x from its foot at the corner, then tipped up toward the apex.
    g.translate((-s * len) / 2, 0, 0);
    g.rotateZ(-s * Math.atan2(pH, pw + 0.1));
    out.trav.push(g.translate(s * (pw + 0.1), py - 0.02, z + 0.06));
  }
  // The threshold with its pivot holes, travertine.
  out.trav.push(slab(gw + 0.2, 0.06, W.wall + 0.2, { bevel: 0.01, seed: seed + 9, wobble: 0.001, tone: 0.03, grime: 0.2 }).translate(0, 0, z - W.wall / 2 + 0.05));
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
 * z = +court): a brick wall with arched doorways into the rooms (and the
 * passage from the gate on the front), the dark rooms behind it.
 */
function innerSide(sideIndex, lod, seed) {
  const W = WAREHOUSE;
  const out = { brick: [], trav: [], dark: [] };
  const front = sideIndex === 0;
  const len = 2 * (W.court + W.inner);
  const openings = front
    ? [{ x: 0, w: W.gate.w, h: W.gate.h - 0.3 }]
    : [{ x: -1.5, w: 1.3, h: 1.0, arch: true }, { x: 1.5, w: 1.3, h: 1.0, arch: true }];
  // (Its face toward the court at z = court: the wall is built from z = 0 back, so turned half round.)
  const wall = wallWithOpenings(len, W.innerEave, W.inner, openings, { lod });
  wall.rotateY(Math.PI);
  out.brick.push(wall.translate(0, 0, W.court));
  // Travertine thresholds in the doorways.
  for (const o of openings) out.trav.push(slab(o.w + 0.1, 0.05, W.inner + 0.1, { bevel: 0.008, seed: seed + o.x * 5, wobble: 0.001, tone: 0.03, grime: 0.2 }).translate(o.x, 0, W.court + W.inner / 2));
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
    // The passage from the gate to the court is open: its walls lined in brick, the rooms either side dark.
    for (const s of [-1, 1]) {
      const pw = slab(0.3, W.gate.h, z1 - z0 + 0.02, { bevel: 0.004, seed: seed + s, wobble: 0, tone: 0, grime: 0.3 });
      out.brick.push(pw.translate(s * (W.gate.w / 2 + 0.15), 0, (z0 + z1) / 2));
    }
    // Paving through the passage.
    out.trav.push(...paving(-W.gate.w / 2, W.gate.w / 2, z0 - 0.02, z1 + 0.02, 0.05, seed + 9, { rowW: 0.55, minL: 0.5, maxL: 0.9, lod }));
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
  const parts = { brick: [], trav: [], marble: [], dark: [], wood: [], woodOpen: [], woodShut: [], iron: [], ironOpen: [], ironShut: [], bronze: [], tiles: [], pane: [] };
  const put = (o, turn = 0) => {
    for (const k of Object.keys(o)) for (const g of o[k]) parts[k].push(turn ? g.rotateY(turn) : g);
  };
  for (let s = 0; s < 4; s++) {
    put(outerWall(s, lod, seed + s * 50), (s * Math.PI) / 2);
    put(innerSide(s, lod, seed + 300 + s * 50), (s * Math.PI) / 2);
  }
  put(gateway(lod, seed + 7));
  parts.tiles.push(...roof(lod, seed + 9));
  // The court: travertine flags, a gutter round them under the eaves.
  const c = W.court;
  parts.trav.push(...paving(-c, c, -c, c, 0.05, seed + 11, { rowW: 0.75, minL: 0.7, maxL: 1.3, lod, tone: 0.06, grime: 0.1 }));
  if (lod < 2) {
    for (let s = 0; s < 4; s++) {
      const g = slab(2 * c - 0.2, 0.06, 0.18, { bevel: 0.01, seed: seed + 20 + s, wobble: 0.002, tone: 0.03, grime: 0.5 });
      parts.trav.push(tintGeometry(g, (x, y) => (y > 0.05 ? 0.6 : 0.8)).translate(0, 0, c - 0.12).rotateY((s * Math.PI) / 2));
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
  add(parts.brick, material('brick', { surface: 'brick', vertexColors: true, snow: 1 }), 'brick');
  add(parts.trav, material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 }), 'stone');
  add(parts.marble, material('marble', { surface: 'marble', vertexColors: true, snow: 1 }), 'plaque');
  add(parts.tiles, material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 1 }), 'roof');
  add(parts.dark, material('room-dark', { color: 0x0e0b09, roughness: 1, snow: 0, wet: 0 }), 'rooms', 'always', false);
  add(parts.wood, material('wood', { surface: 'wood', vertexColors: true, snow: 1 }), 'dunnage');
  add(parts.woodOpen, material('wood', { surface: 'wood', vertexColors: true, snow: 1 }), 'doors-open', 'open');
  add(parts.woodShut, material('wood', { surface: 'wood', vertexColors: true, snow: 1 }), 'doors-shut', 'shut');
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
