/**
 * models/housesGrand.js
 * ----------------------------------------------------------------------------
 * The four great homes, each 3 x 3 tiles (12 m) with four looks (houses.js
 * lists them). All four are the atrium house with its peristyle garden
 * behind, as the Latin and Campanian towns kept it by the 2nd century BC
 * (the House of the Faun at Pompeii is the ceiling of taste: a blank street
 * front, shops flanking the door, the atrium, the tablinum and behind it the
 * colonnaded garden). Streets run along +z as every model's does.
 *
 *   Peristyle Villa  level 15. A plastered street front 4.9 m high with a
 *                    porter's door and two shops, the atrium block behind it
 *                    (a roof falling inward to the compluvium, the basin
 *                    below), a tablinum hall behind the atrium with its own
 *                    gable and a terracotta plaque, a side room each side,
 *                    and a full peristyle: a Tuscan colonnade of stuccoed
 *                    tufa round a garden court with a basin, under lean-to
 *                    tiled roofs, with frescoed garden walls. Painted
 *                    terracotta plaques along the eaves. Ridge 7.1 m.
 *   Marble Villa     level 16. The same plan dressed in marble where it
 *                    shows (Colonia's marble goods): a marble doorframe and
 *                    threshold, marble panels in the dado, marble-faced
 *                    columns in the peristyle, a marble basin with a jet, a
 *                    statue on a pedestal in the garden; the rest plaster.
 *   Mansion          level 17. The house grown to its lot's edge: a second
 *                    storey over the street front with a row of four shops
 *                    under it and a timber balcony, a back range of two
 *                    storeys with a loggia over the peristyle, a second
 *                    garden beyond with a long pool and cypresses, and a
 *                    tower-like dining room (the cenatio) at one back
 *                    corner under a pyramid roof. Ridge 8.2 m.
 *   Palatium         level 18. The grandest house a magistrate's family
 *                    keeps in a colony: a columned entrance porch on the
 *                    street (Ionic columns under a pediment), a double-height
 *                    atrium nave with clerestory windows between lower side
 *                    bays, a great peristyle with a long basin and a
 *                    fountain, statues on bases, a garden pavilion at the
 *                    back; the roofs stepped from the nave's 9 m down to the
 *                    garden's 4 m; plaques and antefixes along every eave.
 *
 * Republican, as the other homes: plastered fronts, no bare brick, no
 * chimney (smoke leaves by the roof), no Corinthian order, no dome or apse.
 * The marble is a part of its own (the kit has none): from the far level of
 * detail it is plaster. The shop boards shut by the house's state ('shut'
 * when empty), as in the other homes. Builders, lamps and people are put
 * together by houses.js.
 * ----------------------------------------------------------------------------
 */

import { Mesh, CylinderGeometry, SphereGeometry } from 'three';
import { merge, boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { cyl } from './castra.js';
import { lin } from './rural.js';
import { roofSlope, cypress, bush, hedge } from './learning.js';
import { DYES } from '../people/actors.js';
import {
  Bag, box, WASH, WOODS, shell, windowTrim, doorLeaf, doorFrame, balcony, ridgeRoof, slabBox, fig,
} from './houseKit.js';
import { boards, counter, band } from './housesTall.js';
import { atriumRoof } from './housesStone.js';

/** Half the footprint less the eaves' overhang: walls stand at this plane (the footprint is 12 m). */
const W = 5.65;
/** Ground level inside: the floor slabs' top. */
const FL = 0.06;
/** The wall thickness the kit's shell uses here. */
const T = 0.3;
const MARBLE = lin(0xeeeae0);
const COLUMN = lin(0xe6dcc0);
const WATER = lin(0x4d7a8a, 0.9);
const TERRACOTTA = lin(0xb8683f, 0.95);
const PALE = lin(0xe9ddbd);
const OAK = lin(WOODS.oak);

/** The measures the tests, the lab and the people read (metres). */
export const GRAND = Object.freeze({
  W, floorY: FL,
  /** Peristyle Villa and Marble Villa: the atrium block's back wall, the tablinum's, the heights. */
  villa: Object.freeze({ zb: 2.2, hall: 0.6, front: 4.9, hallWall: 5.4, hallRise: 1.5, door: Object.freeze({ w: 1.2, h: 2.4 }), shopX: 3.7 }),
  mansion: Object.freeze({ zb: 2.2, hall: 0.6, front: 7.0, back: 6.4, door: Object.freeze({ w: 1.2, h: 2.4 }), shopX: Object.freeze([2.3, 4.3]) }),
  palatium: Object.freeze({ face: 3.7, nave: 7.2, naveRise: 1.7, bay: 5.2, porchZ: 5.2 }),
});

/** The four looks every level shares: the plaster's wash, the dado, the shutters, what grows in the garden. */
const LOOKS = [
  { wall: WASH.cream, dado: WASH.red, shut: WOODS.olive, flora: 'fig' },
  { wall: WASH.ochre, dado: WASH.red, shut: WOODS.oak, flora: 'cypress' },
  { wall: WASH.white, dado: WASH.mud, shut: WOODS.brown, flora: 'arbor' },
  { wall: WASH.pink, dado: WASH.red, shut: WOODS.olive, flora: 'laurel' },
];
/** The side a look puts its tower, statue and shops' variety on. */
const SIDE = [1, -1, -1, 1];

// ---------------------------------------------------------------------------
// The bag: the kit's, with a marble part of its own
// ---------------------------------------------------------------------------

/** The marble's material: the same options as every other model's, so the program is shared. */
const marbleMaterial = () => material('marble', { surface: 'marble', vertexColors: true, snow: 1 });

/** A kit bag with one more part, 'marble' (plaster from the far level out, where its colour alone is left). */
class GrandBag extends Bag {
  add(key, ...g) {
    if (key !== 'marble') return super.add(key, ...g);
    if (this.lod >= 2) return super.add('plaster', ...g);
    (this.o.marble ??= []).push(...g.flat(Infinity).filter(Boolean));
    return this;
  }

  build() {
    const marble = this.o.marble;
    delete this.o.marble;
    const out = super.build();
    if (marble && marble.length) {
      const geo = marble.length === 1 ? marble[0] : merge(marble);
      if (marble.length > 1) for (const g of marble) g.dispose();
      const m = new Mesh(geo, marbleMaterial());
      m.name = 'marble';
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.when = 'always';
      out.group.add(m);
      out.meshes.push(m);
      out.triangles += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Parts: columns, sheds, basins, statues, trees
// ---------------------------------------------------------------------------

/** A Tuscan column: plinth, tapering shaft, echinus, abacus; or (ionic) a cushion capital with two volutes. */
function column(bag, x, z, h, r, c, key = 'plaster', { ionic = false, y0 = FL } = {}) {
  const lod = bag.lod;
  if (lod === 2) {
    bag.add(key, cyl(r * 0.9, r, h, 5, x, y0, z, c));
    return;
  }
  const seg = lod ? 8 : 14;
  const cap = ionic ? 0.3 : 0.22;
  bag.add(key, box(r * 2.7, 0.14, r * 2.7, x, y0, z, c));
  bag.add(key, cyl(r * 0.86, r, h - 0.14 - cap, seg, x, y0 + 0.14, z, c));
  if (ionic) {
    // A cushion across the front, a volute at each end (a disc on its side), an abacus.
    bag.add(key, box(r * 3.1, 0.12, r * 2.0, x, y0 + h - cap, z, c));
    if (lod === 0) {
      for (const s of [-1, 1]) {
        const g = new CylinderGeometry(r * 0.5, r * 0.5, r * 1.9, 10, 1);
        g.rotateX(Math.PI / 2);
        g.translate(x + s * r * 1.35, y0 + h - cap + 0.12, z);
        bag.add(key, tintGeometry(boxUV(g), () => c));
      }
    } else for (const s of [-1, 1]) bag.add(key, box(r * 0.8, r * 0.8, r * 1.9, x + s * r * 1.35, y0 + h - cap + 0.04, z, c));
    bag.add(key, box(r * 3.3, 0.08, r * 2.4, x, y0 + h - 0.08, z, c));
  } else {
    bag.add(key, cyl(r * 1.25, r * 0.9, 0.12, seg, x, y0 + h - cap, z, c));
    bag.add(key, box(r * 2.7, 0.1, r * 2.7, x, y0 + h - 0.1, z, c));
  }
}

/** n evenly spaced values from a to b, both included. */
const spread = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

/** A lean-to roof: eave at coordinate e (across) and the top edge at t, along a0..a1; `side` is the direction the eave faces. */
function shed(bag, side, { a0, a1, e, t, yE, yT, over = 0.12 }) {
  const slope = (yT - yE) / Math.abs(t - e);
  const eo = e + Math.sign(e - t) * over;
  const yo = yE - slope * over;
  const quads = {
    '+z': [[a0, yo, eo], [a1, yo, eo], [a1, yT, t], [a0, yT, t]],
    '-z': [[a1, yo, eo], [a0, yo, eo], [a0, yT, t], [a1, yT, t]],
    '+x': [[eo, yo, a1], [eo, yo, a0], [t, yT, a0], [t, yT, a1]],
    '-x': [[eo, yo, a0], [eo, yo, a1], [t, yT, a1], [t, yT, a0]],
  };
  const r = roofSlope(quads[side], { lod: bag.lod, seed: bag.seed + 61 + side.charCodeAt(0) + (side[1] === 'x' ? 7 : 0) });
  bag.add('tile', r.tile);
  bag.add('wood', r.wood);
}

/**
 * A peristyle: a rectangle of columns (cx0..cx1 by cz0..cz1) with an architrave on them, and the lean-to roofs
 * between it and the walls round it. `back` false leaves the back row open (a garden beyond); `nx`, `nz` the columns
 * along each way.
 */
function peristyle(bag, P) {
  const { cx0, cx1, cz0, cz1, colH, nx, nz, key, c, wallX, hallZ, topY, back = true, front = true, shortSide = 0, sideBack = cz0, r = 0.25, ionic = false } = P;
  const xs = spread(cx0, cx1, nx);
  const zs = spread(cz0, cz1, nz);
  const rows = back ? [cz0, cz1] : [cz1, cz0];
  for (const z of rows) for (const x of xs) column(bag, x, z, colH, r, c, key, { ionic });
  for (const z of zs.slice(1, -1)) for (const x of [cx0, cx1]) column(bag, x, z, colH, r, c, key, { ionic });
  // The architrave and a frieze over it, all round.
  const aH = 0.34;
  const t = r * 2.1;
  const mx = (cx0 + cx1) / 2;
  const mz = (cz0 + cz1) / 2;
  bag.add(key, box(cx1 - cx0 + t, aH, t, mx, colH, cz1, c), box(cx1 - cx0 + t, aH, t, mx, colH, cz0, c));
  bag.add(key, box(t, aH, cz1 - cz0, cx0, colH, mz, c), box(t, aH, cz1 - cz0, cx1, colH, mz, c));
  if (bag.lod === 0) {
    // (A dentil course under the eaves: small blocks along the front architrave.)
    for (const x of spread(cx0 + 0.2, cx1 - 0.2, Math.round((cx1 - cx0) / 0.32))) bag.add(key, box(0.14, 0.1, 0.06, x, colH + aH, cz1 - t / 2 - 0.02, c));
  }
  const yE = colH + aH + 0.02;
  if (front) shed(bag, '-z', { a0: -wallX, a1: wallX, e: cz1 - t / 2, t: hallZ, yE, yT: topY });
  shed(bag, '+x', { a0: shortSide === -1 ? cz0 : sideBack, a1: cz1, e: cx0 + t / 2, t: -wallX, yE, yT: topY });
  shed(bag, '-x', { a0: shortSide === 1 ? cz0 : sideBack, a1: cz1, e: cx1 - t / 2, t: wallX, yE, yT: topY });
  if (back) shed(bag, '+z', { a0: -wallX, a1: wallX, e: cz0 + t / 2, t: -(W - T), yE, yT: topY });
}

/** A basin on the ground with its water; marble or stone; a jet in its middle when asked. */
function basin(bag, x, z, w, d, { marble = false, jet = false, h = 0.5 } = {}) {
  const key = marble ? 'marble' : 'stone';
  const rim = marble ? MARBLE : lin(0xcfc8b6, 0.92);
  const t = 0.16;
  bag.add(key, box(w, h, t, x, FL, z + d / 2 - t / 2, rim), box(w, h, t, x, FL, z - d / 2 + t / 2, rim));
  bag.add(key, box(t, h, d - 2 * t, x - w / 2 + t / 2, FL, z, rim), box(t, h, d - 2 * t, x + w / 2 - t / 2, FL, z, rim));
  bag.add('paint', box(w - 2 * t, 0.02, d - 2 * t, x, FL + h - 0.12, z, WATER));
  if (jet && bag.lod < 2) {
    bag.add(key, cyl(0.14, 0.22, 0.75, 10, x, FL, z, rim));
    bag.add('paint', cyl(0.04, 0.09, 0.8, 6, x, FL + 0.6, z, lin(0xd4e8ee, 0.95)));
  }
}

/** A marble statue on a base: a draped figure, a head, an arm; `h` to the head's top. */
function statue(bag, x, z, { h = 1.8, ry = 0, base = 0.8 } = {}) {
  if (bag.lod === 2) {
    bag.add('marble', box(0.6, base + h, 0.6, x, FL, z, MARBLE));
    return;
  }
  bag.add('marble', box(0.7, base, 0.7, x, FL, z, MARBLE), box(0.8, 0.08, 0.8, x, FL + base, z, MARBLE), box(0.76, 0.08, 0.76, x, FL, z, MARBLE));
  const y = FL + base + 0.08;
  const body = h - 0.3;
  bag.add('marble', cyl(0.17, 0.25, body * 0.62, 9, x, y, z, MARBLE));
  bag.add('marble', cyl(0.2, 0.15, body * 0.38, 9, x, y + body * 0.62, z, MARBLE));
  const head = new SphereGeometry(0.11, 8, 6);
  head.translate(x, y + body + 0.1, z);
  bag.add('marble', tintGeometry(boxUV(head), () => MARBLE));
  // An arm held out, turned with the figure.
  const a = box(0.34, 0.1, 0.1, 0.17, y + body * 0.82, 0, MARBLE);
  a.rotateY(ry);
  a.translate(x, 0, z);
  bag.add('marble', a);
}

/** A cypress in the garden (its trunk with the wood, its foliage with the leaves). */
function cyp(bag, x, z, h, seed) {
  const c = cypress(x, z, h, { lod: bag.lod, seed: bag.seed + seed });
  bag.add('leaf', c.leaf);
  bag.add('wood', c.wood);
}

/** A flat bed of lawn (low) over x0..x1, z0..z1. */
function lawn(bag, x0, x1, z0, z1) {
  bag.add('leaf', box(x1 - x0, 0.1, z1 - z0, (x0 + x1) / 2, FL, (z0 + z1) / 2, [0.05, 0.11, 0.03]));
}

/** A row of painted terracotta plaques along a wall's eave, in the wall's frame at height y. */
function plaques(bag, put, x0, x1, y, step) {
  if (bag.lod > 1) return;
  const n = Math.max(2, Math.round((x1 - x0) / step));
  for (let k = 0; k < n; k++) {
    const x = x0 + ((k + 0.5) * (x1 - x0)) / n;
    bag.add('clay', put(box(0.36, 0.34, 0.07, x, y, 0.03, TERRACOTTA)));
    if (bag.lod === 0) bag.add('paint', put(box(0.24, 0.22, 0.02, x, y + 0.06, 0.075, PALE)));
  }
}

/** The runs of x0..x1 not covered by the (lo, hi) holes. */
function gaps(x0, x1, holes) {
  const out = [];
  let at = x0;
  for (const [a, b] of [...holes].sort((p, q) => p[0] - q[0])) {
    if (a > at) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (x1 > at) out.push([at, x1]);
  return out;
}

/** A marble doorframe: two jambs, a lintel and a threshold step. */
function marbleFrame(bag, put, { x, w, h }) {
  if (bag.lod === 2) return;
  for (const s of [-1, 1]) bag.add('marble', put(box(0.2, h + 0.1, 0.2, x + s * (w / 2 + 0.08), 0, 0.07, MARBLE)));
  bag.add('marble', put(box(w + 0.6, 0.2, 0.22, x, h, 0.07, MARBLE)));
  bag.add('marble', put(box(w + 0.5, 0.1, 0.3, x, 0, 0.15, MARBLE)));
}

/** The studded door of the fauces: a leaf swung in when lived in, with its nail heads shut. */
function fauces(bag, put, x, w, h, marble) {
  if (marble) marbleFrame(bag, put, { x, w, h });
  else doorFrame(bag, put, { x, w, h });
  doorLeaf(bag, put, { x, w, h, col: lin(WOODS.oak), open: true });
  if (bag.lod === 0) {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) bag.add('woodShut', put(box(0.05, 0.05, 0.02, x - w * 0.28 + c * w * 0.28, 0.3 + r * h * 0.22, 0.014, lin(0x2a2420))));
    if (!marble) bag.add('rubble', put(box(w + 0.3, 0.1, 0.32, x, 0, 0.16, lin(0xcfc8b6, 0.9))));
  }
}

/** The garden's walls painted with panels (Pompeian second style, in a few red and yellow fields). */
function frescoes(bag, wash, y, hgt) {
  if (bag.lod > 1) return;
  const z = -W + T + 0.008;
  const fields = [lin(WASH.red, 0.95), lin(WASH.yellow, 0.95), lin(WASH.red, 0.95)];
  const n = fields.length;
  const w = 2 * (W - T) - 0.6;
  for (let k = 0; k < n; k++) {
    const x = -w / 2 + ((k + 0.5) * w) / n;
    bag.add('paint', box(w / n - 0.3, hgt, 0.012, x, y, z, fields[k]));
    if (bag.lod === 0) bag.add('paint', box(w / n - 0.7, hgt - 0.4, 0.014, x, y + 0.2, z + 0.004, wash.map((v) => v * 0.97)));
  }
}

// ---------------------------------------------------------------------------
// The villas (15, 16)
// ---------------------------------------------------------------------------

const VILLA_NAMES = { 15: 'villa', 16: 'villamarble', 17: 'mansion', 18: 'palatium' };

/** The street front, the atrium block behind it (both villas). Returns the front's put. */
function villaFront(bag, L, marble) {
  const { zb, front: H, door, shopX } = GRAND.villa;
  const lod = bag.lod;
  const wash = lin(L.wall);
  const col = lin(L.shut);
  const shopW = 1.6;
  const shopH = 2.2;
  const openings = [{ x: 0, y: 0, w: door.w, h: door.h }];
  for (const s of [-1, 1]) openings.push({ x: s * shopX, y: 0, w: shopW, h: shopH }, { x: s * shopX, y: 3.3, w: 0.6, h: 0.7 });
  const puts = shell(bag, {
    x0: -W, x1: W, z0: zb, z1: W, h: H, t: T, c: wash, k: 0.97,
    openings: { '+z': openings, '+x': [{ x: 0, y: 3.2, w: 0.4, h: 0.7 }], '-x': [{ x: 0, y: 3.2, w: 0.4, h: 0.7 }] },
  });
  const fr = puts['+z'];
  // The atrium's floor, seen through the compluvium, and the pavement before the door.
  slabBox(bag, 'flags', -W, W, zb + 0.3, W + 0.3, FL, lin(0xa89c86, 0.9));
  fauces(bag, fr, 0, door.w, door.h, marble);
  for (const s of [-1, 1]) {
    const x = s * shopX;
    doorFrame(bag, fr, { x, w: shopW, h: shopH });
    boards(bag, fr, x, shopW, shopH);
    counter(bag, fr, x, shopW, -0.12, s < 0 ? 'amph' : 'bread', FL);
    windowTrim(bag, fr, { x, y: 3.3, w: 0.6, h: 0.7 }, { shutters: 'closed', col, sill: false });
  }
  for (const side of ['+x', '-x']) windowTrim(bag, puts[side], { x: 0, y: 3.2, w: 0.4, h: 0.7 }, { shutters: 'closed', col, sill: false });
  // The dado: red plaster, or in the marble villa panels of marble between the openings.
  const holes = [[-door.w / 2 - 0.2, door.w / 2 + 0.2], ...[-1, 1].map((s) => [s * shopX - shopW / 2 - 0.1, s * shopX + shopW / 2 + 0.1])];
  if (lod < 2) {
    for (const [a, b] of gaps(-W + 0.1, W - 0.1, holes)) {
      if (!marble) bag.add('plaster', fr(box(b - a, 1.0, 0.014, (a + b) / 2, 0.06, 0.007, lin(L.dado))));
      else {
        const n = Math.max(1, Math.floor((b - a) / 0.95));
        for (let k = 0; k < n; k++) {
          const w = (b - a) / n;
          bag.add('marble', fr(box(w - 0.1, 1.0, 0.04, a + (k + 0.5) * w, 0.08, 0.02, MARBLE)));
          if (lod === 0) bag.add('paint', fr(box(w - 0.3, 0.8, 0.012, a + (k + 0.5) * w, 0.18, 0.043, lin(0xb9b2a4))));
        }
        bag.add('marble', fr(box(b - a, 0.08, 0.06, (a + b) / 2, 1.08, 0.03, MARBLE)));
      }
    }
  }
  band(bag, fr, 0, 2 * W + 0.1, H - 0.16);
  plaques(bag, fr, -W + 0.4, W - 0.4, H - 0.62, 1.15);
  // The atrium's roof; the basin below it gets a marble rim in the marble villa.
  const zc = 3.9;
  atriumRoof(bag, { x0: -W, x1: W, z0: zb, z1: W, eaveY: H, zc, hx: 1.3, hz: 0.75, drop: 0.8 });
  if (marble && lod < 2) {
    const rimMarble = (w, d) => [box(w, 0.2, 0.1, 0, FL, zc + d / 2, MARBLE), box(w, 0.2, 0.1, 0, FL, zc - d / 2, MARBLE), box(0.1, 0.2, d, -w / 2, FL, zc, MARBLE), box(0.1, 0.2, d, w / 2, FL, zc, MARBLE)];
    bag.add('marble', rimMarble(1.34, 1.12));
  }
  return puts;
}

/** The tablinum, the two side rooms and the garden's walls behind the atrium block. */
function villaBack(bag, L, marble) {
  const { zb, hall, hallWall, hallRise } = GRAND.villa;
  const wash = lin(L.wall);
  const col = lin(L.shut);
  const lod = bag.lod;
  const HX = 3.1;
  const fill = wash.map((c) => c * 0.96);
  // The tablinum: a tall hall open to the garden between two columns, with its own gable.
  const hp = shell(bag, {
    x0: -HX, x1: HX, z0: hall, z1: zb + 0.2, h: hallWall, t: T, c: wash, k: 0.97, skip: ['+z'],
    openings: { '-z': [{ x: 0, y: 0, w: 3.0, h: 3.4 }, { x: 0, y: 4.2, w: 0.7, h: 0.8 }], '+x': [{ x: 0, y: 4.2, w: 0.5, h: 0.8 }], '-x': [{ x: 0, y: 4.2, w: 0.5, h: 0.8 }] },
  });
  const hb = hp['-z'];
  if (marble) marbleFrame(bag, hb, { x: 0, w: 3.0, h: 3.4 });
  else doorFrame(bag, hb, { x: 0, w: 3.0, h: 3.4 });
  windowTrim(bag, hb, { x: 0, y: 4.2, w: 0.7, h: 0.8 }, { shutters: 'closed', col, sill: false });
  for (const s of [-1, 1]) column(bag, s * 1.3, hall - 0.3, 3.4, 0.18, marble ? MARBLE : COLUMN, marble ? 'marble' : 'plaster');
  const roof = ridgeRoof(bag, { x0: -HX, x1: HX, z0: hall, z1: zb + 0.2, eaveY: hallWall, rise: hallRise, along: 'z', over: 0.22, gableOver: 0.12, fill });
  if (lod < 2) {
    // The painted terracotta plaque at the gable's apex, a pale field in a dark frame.
    bag.add('clay', hb(box(0.55, 0.45, 0.06, 0, hallWall + 0.42, 0.13, TERRACOTTA)));
    bag.add('paint', hb(box(0.4, 0.3, 0.02, 0, hallWall + 0.5, 0.165, PALE)));
  }
  // The two side rooms (alae and cubicula), low, with a gable end each.
  for (const s of [-1, 1]) {
    const [x0, x1] = s > 0 ? [HX, W] : [-W, -HX];
    const wp = shell(bag, {
      x0, x1, z0: hall, z1: zb + 0.2, h: 4.1, t: T, c: wash, k: 0.97, skip: ['+z', s > 0 ? '-x' : '+x'],
      openings: { '-z': [{ x: 0, y: 0, w: 0.95, h: 2.3 }], [s > 0 ? '+x' : '-x']: [{ x: 0, y: 1.6, w: 0.6, h: 0.9 }] },
    });
    doorFrame(bag, wp['-z'], { x: 0, w: 0.95, h: 2.3 });
    doorLeaf(bag, wp['-z'], { x: 0, w: 0.95, h: 2.3, col: lin(WOODS.oak, 0.9), open: true });
    windowTrim(bag, wp[s > 0 ? '+x' : '-x'], { x: 0, y: 1.6, w: 0.6, h: 0.9 }, { shutters: 'open', col });
    ridgeRoof(bag, { x0, x1, z0: hall, z1: zb + 0.2, eaveY: 4.1, rise: 0.85, along: 'x', over: 0.2, gableOver: 0.1, fill });
  }
  // The garden's walls: back and sides, painted inside.
  const g = shell(bag, { x0: -W, x1: W, z0: -W, z1: hall, h: 4.4, t: T, c: wash, k: 0.97, skip: ['+z'] });
  frescoes(bag, wash, 1.2, 2.0);
  if (lod < 2) {
    band(bag, g['-z'], 0, 2 * W + 0.1, 4.2);
    plaques(bag, g['-z'], -W + 0.6, W - 0.6, 3.75, 1.4);
    plaques(bag, g['+x'], -3.2, 3.2, 3.75, 1.4);
  }
  return roof;
}

/** The villas' garden: floor, the colonnade, the basin, the beds and what grows (by look). */
function villaGarden(bag, L, v, marble) {
  const lod = bag.lod;
  const c = marble ? MARBLE : COLUMN;
  const key = marble ? 'marble' : 'plaster';
  const ox = W - T;
  slabBox(bag, 'earth', -ox, ox, -ox, 0.7, FL, lin(0xb4a584, 0.95));
  peristyle(bag, { cx0: -3.9, cx1: 3.9, cz0: -4.0, cz1: -0.9, colH: 3.0, nx: 5, nz: 3, key, c, wallX: ox, hallZ: GRAND.villa.hall, topY: 4.1 });
  // The path and the beds: a gravel walk down the middle, a bed each side of it with a clipped hedge round.
  slabBox(bag, 'flags', -1.5, 1.5, -3.75, -0.9, FL + 0.01, lin(0xc3b79b, 0.9));
  for (const s of [-1, 1]) {
    lawn(bag, s > 0 ? 1.6 : -3.6, s > 0 ? 3.6 : -1.6, -3.7, -1.2);
    if (lod < 2) bag.add('leaf', hedge(s > 0 ? 1.6 : -3.6, s > 0 ? 3.6 : -1.6, -3.75, -3.55, 0.5, { lod, seed: bag.seed + 71 + s }));
  }
  basin(bag, 0, -2.45, 1.8, 1.0, { marble, jet: marble });
  if (marble) statue(bag, 0, -3.35, { h: 1.7, ry: 0.4 });
  const fl = L.flora;
  if (fl === 'fig') {
    for (const s of [-1, 1]) fig(bag, s * 2.6, -2.45, 0.95, bag.seed + s);
  } else if (fl === 'cypress') {
    for (const s of [-1, 1]) for (const z of [-3.2, -1.7]) cyp(bag, s * 2.6, z, 3.3, 5 + s * 3 + z);
  } else if (fl === 'arbor') {
    // A vine arbor across the walk at the back: posts, a beam, rafters and leaves.
    for (const s of [-1, 1]) bag.add('wood', box(0.1, 2.3, 0.1, s * 1.5, FL, -3.55, OAK));
    bag.add('wood', box(3.2, 0.1, 0.12, 0, FL + 2.3, -3.55, OAK));
    if (lod < 2) bag.add('leaf', box(3.1, 0.18, 0.5, 0, FL + 2.38, -3.55, [0.05, 0.12, 0.03]));
    if (lod === 0) for (let k = 0; k < 4; k++) bag.add('wood', box(0.05, 0.05, 0.8, -1.35 + k * 0.9, FL + 2.32, -3.55, OAK));
  } else if (lod < 2) {
    // Laurels in pots at the colonnade's foot and a bench.
    for (const s of [-1, 1]) for (const z of [-3.5, -1.4]) {
      bag.add('clay', cyl(0.2, 0.15, 0.4, 8, s * 3.1, FL, z, lin(0xb08850)));
      bag.add('leaf', bush(s * 3.1, FL + 0.8, z, 0.34, { lod, seed: bag.seed + 90 + z }));
    }
    bag.add('stone', box(1.4, 0.07, 0.4, 0, FL + 0.42, -3.9, 0.9), box(0.12, 0.42, 0.34, -0.55, FL, -3.9, 0.9), box(0.12, 0.42, 0.34, 0.55, FL, -3.9, 0.9));
  }
  void v;
}

/** The Peristyle Villa (15) and the Marble Villa (16), its look `v`, at a level of detail. */
function buildVilla(tier, v, lod) {
  const L = LOOKS[v & 3];
  const marble = tier === 16;
  const bag = new GrandBag(`${VILLA_NAMES[tier]}${v}`, lod, 2100 + tier * 50 + v * 13);
  villaFront(bag, L, marble);
  villaBack(bag, L, marble);
  villaGarden(bag, L, v, marble);
  return bag.build();
}

// ---------------------------------------------------------------------------
// The Mansion (17)
// ---------------------------------------------------------------------------

/** The mansion: shops under a second storey, a two-storey back range with a loggia, two gardens, a tower. */
function buildMansion(v, lod) {
  const L = LOOKS[v & 3];
  const M = GRAND.mansion;
  const bag = new GrandBag(`mansion${v}`, lod, 2400 + v * 17);
  const wash = lin(L.wall);
  const col = lin(L.shut);
  const fill = wash.map((c) => c * 0.96);
  const side = SIDE[v & 3];
  const ox = W - T;
  const colH = 3.0;
  const loggiaY = colH + 0.34;
  // The street front: four shops and the door below, windows and a balcony above.
  const gx = M.shopX;
  const lower = [{ x: 0, y: 0, w: M.door.w, h: M.door.h }];
  for (const s of [-1, 1]) for (const x of gx) lower.push({ x: s * x, y: 0, w: 1.5, h: 2.2 });
  const upper = [-1, 1].flatMap((s) => [1.2, 2.8, 4.4].map((x) => ({ x: s * x, y: 0.55, w: 0.7, h: 1.25 })));
  slabBox(bag, 'flags', -W, W, M.zb + 0.3, W + 0.3, FL, lin(0xa89c86, 0.9));
  const lp = shell(bag, { x0: -W, x1: W, z0: M.zb, z1: W, h: 3.8, t: T, c: wash, k: 0.97, openings: { '+z': lower, '+x': [{ x: 0, y: 1.6, w: 0.5, h: 0.8 }], '-x': [{ x: 0, y: 1.6, w: 0.5, h: 0.8 }] } });
  const up = shell(bag, { x0: -W, x1: W, z0: M.zb, z1: W, y0: 3.8, h: 3.2, t: T, c: wash, k: 0.97, openings: { '+z': upper, '+x': [{ x: 0, y: 0.7, w: 0.5, h: 0.9 }], '-x': [{ x: 0, y: 0.7, w: 0.5, h: 0.9 }], '-z': [{ x: -2.0, y: 0.7, w: 0.6, h: 0.9 }, { x: 2.0, y: 0.7, w: 0.6, h: 0.9 }] } });
  const fr = lp['+z'];
  fauces(bag, fr, 0, M.door.w, M.door.h, true);
  const kinds = ['amph', 'bread', 'cloth', 'fruit'];
  [-1, 1].forEach((s, i) => gx.forEach((x, j) => {
    doorFrame(bag, fr, { x: s * x, w: 1.5, h: 2.2 });
    boards(bag, fr, s * x, 1.5, 2.2);
    counter(bag, fr, s * x, 1.5, -0.12, kinds[(i * 2 + j) & 3], FL);
  }));
  for (const w of upper) windowTrim(bag, up['+z'], { x: w.x, y: 3.8 + w.y, w: w.w, h: w.h }, { shutters: 'open', col });
  balcony(bag, up['+z'], { x: 0, w: 10.4, d: 0.3, y: 3.8, rail: 0.9, corbels: true, col: OAK });
  if (lod < 2) {
    const holes = [[-M.door.w / 2 - 0.2, M.door.w / 2 + 0.2], ...[-1, 1].flatMap((s) => gx.map((x) => [s * x - 0.85, s * x + 0.85]))];
    for (const [a, b] of gaps(-W + 0.1, W - 0.1, holes)) bag.add('plaster', fr(box(b - a, 1.0, 0.014, (a + b) / 2, 0.06, 0.007, lin(L.dado))));
    band(bag, fr, 0, 2 * W + 0.1, 3.74);
    band(bag, fr, 0, 2 * W + 0.1, 6.84);
    plaques(bag, up['+z'], -W + 0.4, W - 0.4, 6.4, 1.15);
  }
  atriumRoof(bag, { x0: -W, x1: W, z0: M.zb, z1: W, eaveY: 7.0, zc: 3.9, hx: 1.4, hz: 0.75, drop: 0.9 });
  // The back range: two storeys, the ground floor open to the peristyle, the upper floor looking onto a loggia.
  const bp = shell(bag, {
    x0: -W, x1: W, z0: M.hall, z1: M.zb + 0.2, h: 6.9, t: T, c: wash, k: 0.97, skip: ['+z'],
    openings: { '-z': [{ x: 0, y: 0, w: 3.0, h: 3.0 }, { x: -3.9, y: 0, w: 0.95, h: 2.3 }, { x: 3.9, y: 0, w: 0.95, h: 2.3 }, ...[-4.4, -2.2, 0, 2.2, 4.4].map((x) => ({ x, y: 3.9, w: 0.7, h: 1.4 }))], '+x': [{ x: 0, y: 4.3, w: 0.5, h: 0.9 }], '-x': [{ x: 0, y: 4.3, w: 0.5, h: 0.9 }] },
  });
  const bb = bp['-z'];
  doorFrame(bag, bb, { x: 0, w: 3.0, h: 3.0 });
  for (const x of [-3.9, 3.9]) {
    doorFrame(bag, bb, { x, w: 0.95, h: 2.3 });
    doorLeaf(bag, bb, { x, w: 0.95, h: 2.3, col: lin(WOODS.oak, 0.9), open: true });
  }
  for (const x of [-4.4, -2.2, 0, 2.2, 4.4]) windowTrim(bag, bb, { x, y: 3.9, w: 0.7, h: 1.4 }, { shutters: 'open', col, sill: false });
  for (const side2 of ['+x', '-x']) windowTrim(bag, bp[side2], { x: 0, y: 4.3, w: 0.5, h: 0.9 }, { shutters: 'closed', col, sill: false });
  // The loggia: a deck over the colonnade's front row, columns on the columns, a rail, and a roof sloping up to the range.
  const cx1 = -0.9;
  const lx = 3.9;
  slabBox(bag, 'plaster', -lx - 0.3, lx + 0.3, cx1 - 0.3, M.hall, 0.2, lin(WASH.lime, 0.95), loggiaY);
  const loggiaCols = spread(-lx, lx, 5);
  for (const x of loggiaCols) column(bag, x, cx1, 2.7, 0.2, MARBLE, 'marble', { y0: loggiaY + 0.2 });
  if (lod < 2) bag.add('wood', box(2 * lx + 0.4, 0.9, 0.06, 0, loggiaY + 0.2, cx1 + 0.18, OAK));
  bag.add('plaster', box(2 * lx + 0.55, 0.3, 0.42, 0, loggiaY + 2.9, cx1, lin(WASH.lime, 0.95)));
  ridgeRoof(bag, { x0: -W, x1: W, z0: cx1 - 0.3, z1: M.zb + 0.2, eaveY: loggiaY + 3.2, rise: 1.25, along: 'x', over: 0.2, gableOver: 0.1, fill });
  // The peristyle (front and sides roofed, the back row open onto the second garden) and the garden walls.
  slabBox(bag, 'earth', -ox, ox, -ox, 0.7, FL, lin(0xb4a584, 0.95));
  const gw = shell(bag, { x0: -W, x1: W, z0: -W, z1: M.hall, h: 4.4, t: T, c: wash, k: 0.97, skip: ['+z'] });
  peristyle(bag, { cx0: -3.9, cx1: 3.9, cz0: -2.5, cz1: cx1, colH, nx: 5, nz: 2, key: 'marble', c: MARBLE, wallX: ox, hallZ: M.hall, topY: 4.1, back: false, front: false, sideBack: -3.5, shortSide: side });
  if (lod < 2) {
    band(bag, gw['-z'], 0, 2 * W + 0.1, 4.2);
    plaques(bag, gw['+x'], -3.0, 2.0, 3.75, 1.4);
  }
  // The first court: a small basin; the second garden: a long pool and cypresses.
  basin(bag, 0, -1.7, 1.4, 0.8, { marble: true, jet: true });
  slabBox(bag, 'flags', -3.4, 3.4, -2.3, -1.0, FL + 0.01, lin(0xc3b79b, 0.9));
  const pool = -side * 0.9;
  basin(bag, pool, -4.1, 6.0, 0.9, { marble: true, h: 0.4 });
  lawn(bag, -ox + 0.2, ox - 0.2, -ox + 0.1, -3.0);
  for (const x of spread(-4.6, 4.6, 6)) if (Math.abs(x - side * 4.1) > 1.9) cyp(bag, x, -4.95, 3.6, 11 + x * 3);
  for (const s of [-1, 1]) cyp(bag, s * 2.9, -2.35, 3.2, 40 + s);
  statue(bag, -side * 3.7, -3.0, { h: 1.6, ry: 1.2 });
  // The tower: the dining room (cenatio) in a back corner, three windows on the garden's faces, a pyramid roof.
  const tx0 = side > 0 ? W - 3.0 : -W;
  const tx1 = side > 0 ? W : -W + 3.0;
  const tw = shell(bag, {
    x0: tx0, x1: tx1, z0: -W, z1: -W + 3.0, h: M.back, t: T, c: wash, k: 0.97,
    openings: { '+z': [-0.8, 0, 0.8].map((x) => ({ x, y: 3.2, w: 0.55, h: 1.5 })).concat([{ x: 0, y: 0, w: 0.95, h: 2.2 }]), [side > 0 ? '-x' : '+x']: [{ x: 0, y: 3.2, w: 0.7, h: 1.5 }], '-z': [{ x: 0, y: 3.2, w: 0.7, h: 1.5 }] },
  });
  for (const x of [-0.8, 0, 0.8]) windowTrim(bag, tw['+z'], { x, y: 3.2, w: 0.55, h: 1.5 }, { shutters: 'open', col });
  doorFrame(bag, tw['+z'], { x: 0, w: 0.95, h: 2.2 });
  doorLeaf(bag, tw['+z'], { x: 0, w: 0.95, h: 2.2, col: lin(WOODS.oak, 0.9), open: true });
  band(bag, tw['+z'], 0, 3.1, 2.7);
  band(bag, tw['+z'], 0, 3.1, M.back - 0.16);
  ridgeRoof(bag, { x0: tx0, x1: tx1, z0: -W, z1: -W + 3.0, eaveY: M.back, rise: 1.7, along: 'x', hip: true, over: 0.2, gableOver: 0.1, fill });
  if (lod < 2) plaques(bag, tw['+z'], -1.2, 1.2, M.back - 0.6, 0.8);
  return bag.build();
}

// ---------------------------------------------------------------------------
// The Palatium (18)
// ---------------------------------------------------------------------------

/** The palatium: a columned porch, a double-height nave between lower bays, a great peristyle and a pavilion. */
function buildPalatium(v, lod) {
  const L = LOOKS[v & 3];
  const P = GRAND.palatium;
  const bag = new GrandBag(`palatium${v}`, lod, 2700 + v * 19);
  const wash = lin(L.wall);
  const col = lin(L.shut);
  const fill = wash.map((c) => c * 0.96);
  const side = SIDE[v & 3];
  const ox = W - T;
  const NX = 3.3;
  const z0 = 0.8;
  const zf = P.face;
  // The forecourt and the porch's steps.
  slabBox(bag, 'flags', -W, W, zf, W + 0.33, FL, lin(0xa89c86, 0.9));
  // The nave: tall walls with clerestory windows, a big door, a ridge roof along z.
  const nave = shell(bag, {
    x0: -NX, x1: NX, z0, z1: zf, h: P.nave, t: T, c: wash, k: 0.97,
    openings: {
      '+z': [{ x: 0, y: 0, w: 1.7, h: 3.4 }, ...[-1.9, 0, 1.9].map((x) => ({ x, y: 5.2, w: 0.8, h: 1.3 }))],
      '+x': [{ x: 0, y: 5.6, w: 0.6, h: 1.0 }], '-x': [{ x: 0, y: 5.6, w: 0.6, h: 1.0 }],
      '-z': [{ x: 0, y: 0, w: 3.0, h: 3.7 }, ...[-1.9, 1.9].map((x) => ({ x, y: 5.2, w: 0.8, h: 1.3 }))],
    },
  });
  const nf = nave['+z'];
  const nb = nave['-z'];
  doorFrame(bag, nf, { x: 0, w: 1.7, h: 3.4 });
  doorLeaf(bag, nf, { x: 0, w: 1.7, h: 3.4, col: lin(WOODS.oak), open: true });
  marbleFrame(bag, nf, { x: 0, w: 1.7, h: 3.4 });
  for (const x of [-1.9, 0, 1.9]) windowTrim(bag, nf, { x, y: 5.2, w: 0.8, h: 1.3 }, { shutters: 'open', col, sill: false });
  for (const x of [-1.9, 1.9]) windowTrim(bag, nb, { x, y: 5.2, w: 0.8, h: 1.3 }, { shutters: 'open', col, sill: false });
  for (const s2 of ['+x', '-x']) windowTrim(bag, nave[s2], { x: 0, y: 5.6, w: 0.6, h: 1.0 }, { shutters: 'closed', col, sill: false });
  marbleFrame(bag, nb, { x: 0, w: 3.0, h: 3.7 });
  band(bag, nf, 0, 2 * NX + 0.1, P.nave - 0.18);
  plaques(bag, nf, -NX + 0.4, NX - 0.4, P.nave - 0.66, 1.0);
  ridgeRoof(bag, { x0: -NX, x1: NX, z0, z1: zf, eaveY: P.nave, rise: P.naveRise, along: 'z', over: 0.25, gableOver: 0.12, fill });
  if (lod < 2) {
    bag.add('clay', nf(box(0.6, 0.5, 0.06, 0, P.nave + 0.55, 0.13, TERRACOTTA)));
    bag.add('paint', nf(box(0.44, 0.34, 0.02, 0, P.nave + 0.63, 0.165, PALE)));
  }
  // The atrium's floor and the two columns that stand in the nave's back opening.
  slabBox(bag, 'flags', -NX + 0.3, NX - 0.3, z0, zf, FL, lin(0xa89c86, 0.9));
  // The bays each side: lower, a window each, a lean-to roof against the nave.
  for (const s of [-1, 1]) {
    const [x0, x1] = s > 0 ? [NX, W] : [-W, -NX];
    const bp = shell(bag, {
      x0, x1, z0, z1: zf, h: P.bay, t: T, c: wash, k: 0.97, skip: [s > 0 ? '-x' : '+x'],
      openings: { '+z': [{ x: 0, y: 0.95, w: 0.9, h: 1.6 }, { x: 0, y: 3.5, w: 0.7, h: 0.9 }], [s > 0 ? '+x' : '-x']: [{ x: 0, y: 1.2, w: 0.7, h: 1.2 }] },
    });
    windowTrim(bag, bp['+z'], { x: 0, y: 0.95, w: 0.9, h: 1.6 }, { shutters: 'open', col });
    windowTrim(bag, bp['+z'], { x: 0, y: 3.5, w: 0.7, h: 0.9 }, { shutters: 'closed', col, sill: false });
    windowTrim(bag, bp[s > 0 ? '+x' : '-x'], { x: 0, y: 1.2, w: 0.7, h: 1.2 }, { shutters: 'open', col });
    band(bag, bp['+z'], 0, x1 - x0 + 0.1, P.bay - 0.16);
    plaques(bag, bp['+z'], -(x1 - x0) / 2 + 0.3, (x1 - x0) / 2 - 0.3, P.bay - 0.6, 0.9);
    shed(bag, s > 0 ? '+x' : '-x', { a0: z0 - 0.1, a1: zf + 0.15, e: s > 0 ? x1 : x0, t: s > 0 ? NX : -NX, yE: P.bay - 0.05, yT: P.bay + 0.95, over: 0.15 });
  }
  // The porch: marble steps, four Ionic columns, an entablature with a frieze of plaques, a pediment.
  const pc = P.porchZ;
  const colH = 4.4;
  const floor = 0.36;
  slabBox(bag, 'marble', -3.3, 3.3, zf, 5.55, floor, MARBLE);
  slabBox(bag, 'marble', -3.5, 3.5, 5.55, 5.95, 0.12, MARBLE);
  slabBox(bag, 'marble', -3.4, 3.4, 5.55, 5.78, 0.24, MARBLE);
  for (const x of spread(-2.7, 2.7, 4)) column(bag, x, pc, colH, 0.3, MARBLE, 'marble', { ionic: true, y0: floor });
  const eY = floor + colH;
  bag.add('marble', box(6.5, 0.4, 0.7, 0, eY, pc, MARBLE));
  if (lod < 2) {
    bag.add('marble', box(6.7, 0.1, 0.8, 0, eY + 0.4, pc, MARBLE));
    for (const x of spread(-3.0, 3.0, 11)) bag.add('clay', box(0.3, 0.26, 0.05, x, eY + 0.07, pc + 0.37, TERRACOTTA));
  }
  ridgeRoof(bag, { x0: -3.25, x1: 3.25, z0: zf, z1: pc + 0.45, eaveY: eY + 0.5, rise: 1.05, along: 'z', over: 0.2, gableOver: 0.12, fill: MARBLE.map((c) => c * 0.9) });
  if (lod < 2) {
    bag.add('clay', box(0.5, 0.42, 0.06, 0, eY + 1.15, pc + 0.55, TERRACOTTA));
    bag.add('paint', box(0.36, 0.28, 0.02, 0, eY + 1.22, pc + 0.585, PALE));
  }
  // The forecourt: statues on bases, cypresses and a bench each side of the steps.
  for (const s of [-1, 1]) {
    statue(bag, s * 4.55, 5.0, { h: 1.7, ry: s });
    if (lod < 2) cyp(bag, s * 4.9, 4.2, 3.4, 20 + s);
  }
  // The great peristyle behind the nave, its columns taller, the back row open to the pavilion's garden.
  slabBox(bag, 'earth', -ox, ox, -ox, z0, FL, lin(0xb4a584, 0.95));
  const gw = shell(bag, { x0: -W, x1: W, z0: -W, z1: z0, h: 4.6, t: T, c: wash, k: 0.97, skip: ['+z'] });
  peristyle(bag, { cx0: -4.3, cx1: 4.3, cz0: -3.6, cz1: -0.6, colH: 3.2, nx: 5, nz: 3, key: 'marble', c: MARBLE, wallX: ox, hallZ: z0, topY: 4.3, back: false, sideBack: -4.4, r: 0.27, ionic: true });
  frescoes(bag, wash, 1.3, 2.2);
  if (lod < 2) {
    band(bag, gw['-z'], 0, 2 * W + 0.1, 4.4);
    plaques(bag, gw['-z'], -W + 0.6, W - 0.6, 3.9, 1.1);
    plaques(bag, gw['+x'], -4.0, 3.0, 3.9, 1.1);
  }
  // The long basin with its fountain, the statues on bases at the beds' corners.
  slabBox(bag, 'flags', -4.0, 4.0, -3.4, -0.9, FL + 0.01, lin(0xc3b79b, 0.9));
  basin(bag, 0, -2.1, 6.4, 1.0, { marble: true, jet: true });
  if (lod < 2) for (const x of [-2.4, 2.4]) bag.add('paint', cyl(0.03, 0.06, 0.55, 5, x, FL + 0.4, -2.1, lin(0xd4e8ee, 0.95)));
  for (const s of [-1, 1]) for (const z of [-1.3, -2.9]) statue(bag, s * 3.4, z, { h: 1.5, ry: s + z });
  lawn(bag, -ox + 0.2, ox - 0.2, -ox + 0.1, -3.7);
  // The pavilion at the back: a podium, four columns, a hipped roof.
  const pz0 = -W + 0.3;
  const pz1 = -3.95;
  slabBox(bag, 'marble', -1.6, 1.6, pz0, pz1, 0.3, MARBLE);
  for (const x of [-1.2, 1.2]) for (const z of [pz0 + 0.35, pz1 - 0.35]) column(bag, x, z, 2.7, 0.17, MARBLE, 'marble', { y0: 0.3 });
  bag.add('marble', box(3.2, 0.26, pz1 - pz0, 0, 3.0, (pz0 + pz1) / 2, MARBLE));
  ridgeRoof(bag, { x0: -1.5, x1: 1.5, z0: pz0, z1: pz1, eaveY: 3.26, rise: 0.95, along: 'x', hip: true, over: 0.2, gableOver: 0.1, fill });
  if (lod < 2) cyp(bag, side * 4.7, -4.7, 3.6, 33);
  if (lod < 2) cyp(bag, -side * 4.7, -4.7, 3.6, 34);
  if (L.flora === 'laurel' && lod < 2) for (const x of [-3.0, 3.0]) bag.add('leaf', bush(x, FL + 0.8, -4.9, 0.4, { lod, seed: bag.seed + 80 }));
  return bag.build();
}

/** The builders houses.js adds to its table, by kind. */
export const GRAND_BUILDERS = Object.freeze({
  villa: (v, lod) => buildVilla(15, v, lod),
  vmarble: (v, lod) => buildVilla(16, v, lod),
  mansion: buildMansion,
  palatium: buildPalatium,
});

/** The housing level each of these draws. */
export const GRAND_LEVELS = Object.freeze({ villa: 15, vmarble: 16, mansion: 17, palatium: 18 });

// ---------------------------------------------------------------------------
// People and lamps
// ---------------------------------------------------------------------------

const woman = (dress, extra) => ({ body: 'f', dress: ['tunic:long:stola', dress], hair: 'bun', ...extra });
const man = (extra) => ({ body: 'm', dress: ['tunic:knee'], hair: 'crop', ...extra });
const child = (extra) => ({ body: 'c', dress: ['tunic:short'], hair: 'curls', scale: 0.78, ...extra });

/**
 * The people of a great home in its own metres (state 'open' only): the porter at the door, the lady and a
 * child in the garden, a servant sweeping, the master in conversation.
 */
export function grandPeople(kind, v) {
  const s = 800 + v * 7 + GRAND_LEVELS[kind] * 31;
  const side = SIDE[v & 3];
  if (kind === 'palatium') {
    return [
      man({ clip: 'idle', at: [side * 1.7, 0.36, 5.0], ry: 0.3 * side, seed: s, colours: { tunic: DYES.white } }),
      woman('palla', { clip: 'talk', at: [-side * 1.0, FL, -1.6], ry: Math.PI / 2 * side, seed: s + 1, colours: { tunic: DYES.oatmeal, mantle: DYES.madder } }),
      man({ clip: 'talk', at: [-side * 2.0, FL, -1.6], ry: -Math.PI / 2 * side, seed: s + 2, colours: { tunic: DYES.white, mantle: DYES.murex } }),
      child({ clip: 'idle', at: [side * 1.3, FL, -0.95], ry: 0.5, seed: s + 3 }),
      woman('palla', { clip: 'sweep', props: { R: 'broom' }, at: [3.0 * side, FL, -3.0], ry: 0.5, seed: s + 4, colours: { tunic: DYES.undyed } }),
    ];
  }
  const out = [man({ clip: 'idle', at: [side * 1.0, 0.03, W + 0.25], ry: 0.3 * side, seed: s, colours: { tunic: DYES.walnut } })];
  if (kind === 'mansion') {
    out.push(
      woman('palla', { clip: 'talk', at: [-side * 0.9, FL, -1.55], ry: Math.PI / 2 * side, seed: s + 1, colours: { tunic: DYES.oatmeal, mantle: DYES.woad } }),
      child({ clip: 'idle', at: [side * 1.5, FL, -1.6], ry: -0.6, seed: s + 2 }),
      woman('palla', { clip: 'sweep', props: { R: 'broom' }, at: [-3.0 * side, FL, -1.2], ry: 0.4, seed: s + 3, colours: { tunic: DYES.undyed } }),
      man({ clip: 'talk', at: [-side * 1.8, FL, -1.55], ry: -Math.PI / 2 * side, seed: s + 4, colours: { tunic: DYES.white } }),
    );
    return out;
  }
  out.push(
    woman('palla', { clip: 'talk', at: [1.5, FL, -2.0], ry: -1.2, seed: s + 1, colours: { tunic: DYES.oatmeal, mantle: DYES.madder } }),
    man({ clip: 'talk', at: [2.5, FL, -2.0], ry: 1.2, seed: s + 2, colours: { tunic: DYES.white } }),
    child({ clip: 'idle', at: [-1.5, FL, -2.7], ry: 0.5, seed: s + 3 }),
    woman('palla', { clip: 'sweep', props: { R: 'broom' }, at: [-3.2, FL, -1.5], ry: 0.4, seed: s + 4, colours: { tunic: DYES.undyed } }),
  );
  return out;
}

/** The windows a great home may light by look: [x, y, z, s] each, on the front. */
export function grandLamps(kind, v) {
  void v;
  if (kind === 'palatium') return [[0, 1.4, GRAND.palatium.face + 0.05, 1], [0, 5.8, GRAND.palatium.face + 0.05, 1], [-GRAND.W + 1.2, 1.7, GRAND.palatium.face + 0.05, 1], [GRAND.W - 1.2, 1.7, GRAND.palatium.face + 0.05, 1]];
  if (kind === 'mansion') return [[0, 1.3, W + 0.05, 1], [-2.3, 1.0, W + 0.05, 1], [4.3, 1.0, W + 0.05, 1], [-1.2, 4.7, W + 0.05, 1], [2.8, 4.7, W + 0.05, 1]];
  return [[0, 1.3, W + 0.05, 1], [-GRAND.villa.shopX, 1.0, W + 0.05, 1], [GRAND.villa.shopX, 1.0, W + 0.05, 1], [GRAND.villa.shopX, 3.65, W + 0.05, 1]];
}
