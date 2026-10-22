/**
 * models/housesPalatia.js
 * ----------------------------------------------------------------------------
 * The two greatest homes, each 4 x 4 tiles (16 m) with four looks (houses.js
 * lists them). The model is the House of the Faun at Pompeii (2nd century BC,
 * the largest private house of the Republic: a whole city block): a street
 * front of shops, two atria side by side (a Tuscan one and a tetrastyle one),
 * the tablinum between them and the garden, a first peristyle round a basin
 * with a bronze statue, a second and larger one behind it. Streets run along
 * +z as every model's does.
 *
 *   Grand Palatium     level 19. The Faun's plan at 16 m. A long plastered
 *                      street front 5 m high of three shops and two doors (the
 *                      great door has HAVE in tesserae on its threshold), two
 *                      atria behind it under their own compluvia (the left one
 *                      Tuscan, the right one with four columns round the
 *                      basin), the tablinum between them and the garden under
 *                      a gable with a terracotta plaque, a floor of mosaic
 *                      seen through its wide opening, the alae at its sides,
 *                      the first peristyle (Tuscan columns of stuccoed tufa,
 *                      a basin with a bronze faun on a base), a cross wall
 *                      with a doorway, the great second peristyle (six
 *                      columns a side, a long pool, figs and cypresses) with
 *                      a two-storey range behind it and a loggia on its upper
 *                      floor. The roofs step from the shops' 5 m to the
 *                      tablinum's 7.4 m and the range's 9.4 m; painted
 *                      plaques and antefixes along every eave.
 *   Imperial Palatium  level 20. The same plan made the colony's finest, the
 *                      governor's own house. From the street: a porch of four
 *                      Ionic columns on a marble platform under a pediment
 *                      with an acroterion group, bronze lampstands, a
 *                      forecourt with a marble fountain and statues on bases
 *                      between low walls, then the two atria (a belvedere
 *                      tower rises over one corner, its top floor an open
 *                      loggia of marble columns under a pyramid roof), the
 *                      tablinum, two peristyles of marble Ionic columns with
 *                      long marble basins, a summer dining pavilion (a roofed
 *                      exedra with three couches) in the great garden, and a
 *                      garden gate on the side street. Ridge 10.9 m.
 *
 * Republican, as the other homes: plastered fronts, no bare brick, no chimney,
 * no Corinthian order, no dome or apse. Marble where it shows (threshold,
 * columns, basins, statues; the Grand Palatium keeps it to its statue
 * pedestals and the loggia), plaster elsewhere, terracotta roofs, bronze for
 * the lampstands and the faun. The marble and the bronze are parts of their
 * own (the kit has neither): from the far level of detail they are plaster.
 * Builders, lamps and people are put together by houses.js.
 * ----------------------------------------------------------------------------
 */

import { Mesh, SphereGeometry } from 'three';
import { merge, boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { cyl } from './castra.js';
import { lin } from './rural.js';
import { DYES } from '../people/actors.js';
import { box, WASH, WOODS, shell, wall, windowTrim, doorLeaf, doorFrame, ridgeRoof, slabBox, fig } from './houseKit.js';
import { boards, counter, band } from './housesTall.js';
import { roofSlope } from './learning.js';
import {
  GrandBag, LOOKS, SIDE, FL, T, MARBLE, COLUMN, WATER, TERRACOTTA, PALE, OAK,
  column, spread, shed, basin, statue, cyp, lawn, plaques, gaps, marbleFrame, fauces,
} from './housesGrand.js';

/** Half the footprint less the eaves' overhang: walls stand at this plane (the footprint is 16 m). */
const W = 7.65;
/** The inside face of the outer walls. */
const OX = W - T;
/** The tablinum's garden face: the front of the first peristyle. */
const ZG = 0.7;
/** The cross wall between the two peristyles: its far face and its near face. */
const ZC = -2.7;
const BRONZE = lin(0x7c6034, 0.85);
const COUCH = lin(0xa04a3c, 0.9);

/** The measures the tests, the lab and the people read (metres). */
export const PALATIA = Object.freeze({
  W,
  floorY: FL,
  /** Grand Palatium: the atria block's back wall, the shop front's height, the range's wall and ridge. */
  grand: Object.freeze({ zt: 2.6, front: 5.0, hall: 5.8, range: 8.0, doorX: -3.1, door2X: 3.1, shopX: Object.freeze([-6.2, 0, 6.2]) }),
  /** Imperial Palatium: the atria block's back wall and front face, the platform of the porch, the tower. */
  imperial: Object.freeze({ zt: 2.4, face: 5.2, front: 5.8, hall: 6.4, porchZ: 6.95, platform: 0.36, tower: 3.1 }),
});

// ---------------------------------------------------------------------------
// The bag: the villas' (a marble part) with a bronze part
// ---------------------------------------------------------------------------

/** The bronze's material: the same options as every other model's, so the program is shared. */
const bronzeMaterial = () => material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 });

/** A villa bag with one more part, 'bronze' (plaster from the far level out). */
class PalBag extends GrandBag {
  add(key, ...g) {
    if (key !== 'bronze') return super.add(key, ...g);
    if (this.lod >= 2) return super.add('plaster', ...g);
    (this.o.bronze ??= []).push(...g.flat(Infinity).filter(Boolean));
    return this;
  }

  build() {
    const bronze = this.o.bronze;
    delete this.o.bronze;
    const out = super.build();
    if (bronze && bronze.length) {
      const geo = bronze.length === 1 ? bronze[0] : merge(bronze);
      if (bronze.length > 1) for (const g of bronze) g.dispose();
      const m = new Mesh(geo, bronzeMaterial());
      m.name = 'bronze';
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
// Parts
// ---------------------------------------------------------------------------

/** A flat stroke on the ground from (x0, z0) to (x1, z1), w wide, at height y: a line of tesserae. */
function stroke(x0, z0, x1, z1, w, y, c, h = 0.012) {
  const len = Math.hypot(x1 - x0, z1 - z0) + w;
  const g = box(len, h, w, 0, y, 0, c);
  g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  return g;
}

/** Each letter of HAVE as strokes on a unit cell (u across, v down), top first. */
const LETTERS = {
  H: [[0, 0, 0, 1], [1, 0, 1, 1], [0, 0.5, 1, 0.5]],
  A: [[0, 1, 0.5, 0], [0.5, 0, 1, 1], [0.22, 0.68, 0.78, 0.68]],
  V: [[0, 0, 0.5, 1], [0.5, 1, 1, 0]],
  E: [[0, 0, 0, 1], [0, 0, 1, 0], [0, 0.5, 0.8, 0.5], [0, 1, 1, 1]],
};

/**
 * The threshold of the great door: a marble sill with HAVE ("welcome") in dark tesserae, read from the street. In the
 * wall's frame (x along it, z out of it); `y` the sill's top.
 */
function haveThreshold(bag, put, x, y) {
  bag.add('marble', put(box(1.7, 0.04, 0.32, x, y - 0.04, 0.16, MARBLE)));
  if (bag.lod > 0) return;
  const ink = lin(0x2c2a36, 0.9);
  const cw = 0.15;
  const ch = 0.21;
  const gap = 0.07;
  const x0 = x - (4 * cw + 3 * gap) / 2;
  'HAVE'.split('').forEach((ch0, i) => {
    for (const [a, b, c, d] of LETTERS[ch0]) bag.add('paint', put(stroke(x0 + i * (cw + gap) + a * cw, 0.05 + b * ch, x0 + i * (cw + gap) + c * cw, 0.05 + d * ch, 0.032, y, ink)));
  });
}

/**
 * A mosaic floor over x0..x1, z0..z1 (top at FL): a pale ground, a dark and a terracotta border, a field of
 * squares, a roundel in the middle. The middle level of detail keeps the ground and the border.
 */
function mosaic(bag, x0, x1, z0, z1) {
  if (bag.lod > 1) return;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const pale = lin(0xe3d8b8, 0.92);
  const dark = lin(0x2f3140, 0.9);
  const red = lin(0xb0553a, 0.9);
  bag.add('paint', box(x1 - x0, 0.012, z1 - z0, cx, FL, cz, pale));
  const b = 0.16;
  const rim = (inset, c) => {
    const a0 = x0 + inset;
    const a1 = x1 - inset;
    const c0 = z0 + inset;
    const c1 = z1 - inset;
    bag.add('paint',
      box(a1 - a0, 0.016, b, cx, FL, c0 + b / 2, c), box(a1 - a0, 0.016, b, cx, FL, c1 - b / 2, c),
      box(b, 0.016, c1 - c0 - 2 * b, a0 + b / 2, FL, cz, c), box(b, 0.016, c1 - c0 - 2 * b, a1 - b / 2, FL, cz, c));
  };
  rim(0.06, dark);
  rim(0.3, red);
  if (bag.lod > 0) return;
  const ix0 = x0 + 0.5;
  const ix1 = x1 - 0.5;
  const iz0 = z0 + 0.5;
  const iz1 = z1 - 0.5;
  const nx = Math.max(2, Math.round((ix1 - ix0) / 0.32));
  const nz = Math.max(1, Math.round((iz1 - iz0) / 0.32));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if ((i + j) % 2) continue;
      if (Math.abs(ix0 + ((i + 0.5) * (ix1 - ix0)) / nx - cx) < 0.5) continue;
      bag.add('paint', box((ix1 - ix0) / nx - 0.04, 0.014, (iz1 - iz0) / nz - 0.04, ix0 + ((i + 0.5) * (ix1 - ix0)) / nx, FL, iz0 + ((j + 0.5) * (iz1 - iz0)) / nz, dark));
    }
  }
  bag.add('paint', cyl(0.4, 0.4, 0.016, 14, cx, FL, cz, red), cyl(0.28, 0.28, 0.02, 14, cx, FL, cz, pale), cyl(0.14, 0.14, 0.024, 12, cx, FL, cz, dark));
}

/** A bronze statue (the dancing faun) on a stone base: legs, torso, a raised arm, a head; `ry` turns it. */
function bronzeFaun(bag, x, z, ry = 0) {
  const base = 0.75;
  if (bag.lod === 2) {
    bag.add('plaster', box(0.55, base + 1.2, 0.55, x, FL, z, lin(0xcfc8b6, 0.92)));
    return;
  }
  const stone = lin(0xcfc8b6, 0.92);
  bag.add('stone', box(0.62, base, 0.62, x, FL, z, stone), box(0.74, 0.08, 0.74, x, FL + base, z, stone), box(0.7, 0.1, 0.7, x, FL, z, stone));
  const y = FL + base + 0.08;
  bag.add('bronze', cyl(0.07, 0.09, 0.62, 7, x - 0.08, y, z, BRONZE), cyl(0.07, 0.09, 0.62, 7, x + 0.1, y, z + 0.06, BRONZE));
  bag.add('bronze', cyl(0.15, 0.1, 0.52, 8, x, y + 0.58, z, BRONZE));
  const head = new SphereGeometry(0.1, 8, 6);
  head.translate(x, y + 1.24, z);
  bag.add('bronze', tintGeometry(boxUV(head), () => BRONZE));
  const arm = box(0.07, 0.5, 0.07, 0, 0, 0, BRONZE);
  arm.rotateZ(-0.7);
  arm.rotateY(ry);
  arm.translate(x, y + 0.95, z);
  bag.add('bronze', arm);
  const arm2 = box(0.07, 0.4, 0.07, 0, 0, 0, BRONZE);
  arm2.rotateZ(0.9);
  arm2.rotateY(ry);
  arm2.translate(x, y + 0.9, z);
  bag.add('bronze', arm2);
}

/** A bronze lampstand: a tripod foot, a slender stem, a bowl for the oil. */
function lampstand(bag, x, z) {
  if (bag.lod === 2) {
    bag.add('plaster', box(0.1, 1.9, 0.1, x, FL, z, BRONZE));
    return;
  }
  bag.add('bronze', cyl(0.16, 0.22, 0.12, 8, x, FL, z, BRONZE), cyl(0.035, 0.05, 1.7, 6, x, FL + 0.1, z, BRONZE));
  bag.add('bronze', cyl(0.2, 0.08, 0.16, 8, x, FL + 1.78, z, BRONZE));
  if (bag.lod === 0) bag.add('paint', cyl(0.045, 0.06, 0.14, 5, x, FL + 1.92, z, lin(0xf2cf8a, 1)));
}

/** A round marble fountain: a rim, the water, a stem with a bowl and a jet. */
function fountain(bag, x, z, r) {
  const seg = bag.lod ? 10 : 18;
  bag.add('marble', cyl(r, r + 0.06, 0.46, seg, x, FL, z, MARBLE));
  bag.add('paint', cyl(r - 0.12, r - 0.12, 0.02, seg, x, FL + 0.38, z, WATER));
  if (bag.lod > 1) return;
  bag.add('marble', cyl(0.09, 0.14, 0.9, 8, x, FL + 0.4, z, MARBLE), cyl(0.32, 0.12, 0.14, 12, x, FL + 1.16, z, MARBLE));
  bag.add('paint', cyl(0.025, 0.07, 0.5, 5, x, FL + 1.3, z, lin(0xd4e8ee, 0.95)));
}

/** A marble couch (a bed of the dining room): a frame, a cushion and a raised head; `along` 'x' or 'z'. */
function couch(bag, x, z, along) {
  if (bag.lod === 2) return;
  const [w, d] = along === 'x' ? [1.9, 0.62] : [0.62, 1.9];
  bag.add('wood', box(w, 0.28, d, x, 0.3 + FL, z, OAK));
  bag.add('paint', box(w - 0.08, 0.14, d - 0.08, x, 0.58 + FL, z, COUCH));
  if (bag.lod === 0) bag.add('paint', along === 'x' ? box(0.2, 0.2, d - 0.1, x + 0.85, 0.7 + FL, z, COUCH) : box(w - 0.1, 0.2, 0.2, x, 0.7 + FL, z + 0.85, COUCH));
}

/** A painted terracotta antefix row and painted fields on a wall in its frame: Pompeian second style, red and yellow. */
function fields(bag, put, x0, x1, y, hgt, wash) {
  if (bag.lod > 1) return;
  const f = [lin(WASH.red, 0.95), lin(WASH.yellow, 0.95), lin(WASH.red, 0.95), lin(WASH.yellow, 0.95)];
  const n = Math.max(2, Math.round((x1 - x0) / 2.4));
  for (let k = 0; k < n; k++) {
    const x = x0 + ((k + 0.5) * (x1 - x0)) / n;
    bag.add('paint', put(box((x1 - x0) / n - 0.3, hgt, 0.012, x, y, 0.008, f[k % f.length])));
    if (bag.lod === 0) bag.add('paint', put(box((x1 - x0) / n - 0.7, hgt - 0.4, 0.014, x, y + 0.2, 0.012, wash.map((c) => c * 0.97))));
  }
}

// ---------------------------------------------------------------------------
// The atria and the peristyles
// ---------------------------------------------------------------------------

/**
 * An atrium's roof: four slopes falling in to the compluvium (the opening, hx by hz round (cx, zc)), the timbers round
 * it, the basin below it and, in the tetrastyle one, four columns at its corners. The walls x0..x1, z0..z1 reach eaveY.
 */
function atrium(bag, A) {
  const { cx, x0, x1, z0, z1, zc, hx, hz, drop, tetra = false, marble = false } = A;
  const over = 0.1;
  // (The tiles ride 0.3 m above the wall tops, as atriumRoof's do, so the walls' flat tops do not show as a rim.)
  const eaveY = A.eaveY + 0.3;
  const yr = eaveY - drop;
  const xa = x0 - over;
  const xb = x1 + over;
  const Zf = z1 + over;
  const Zb = z0 - over;
  const yeF = eaveY - (drop / (z1 - (zc + hz))) * over;
  const yeB = eaveY - (drop / (zc - hz - z0)) * over;
  const yeL = eaveY - (drop / (cx - hx - x0)) * over;
  const yeR = eaveY - (drop / (x1 - (cx + hx))) * over;
  const slopes = [
    [[xa, yeF, Zf], [xb, yeF, Zf], [cx + hx, yr, zc + hz], [cx - hx, yr, zc + hz]],
    [[xb, yeB, Zb], [xa, yeB, Zb], [cx - hx, yr, zc - hz], [cx + hx, yr, zc - hz]],
    [[xa, yeL, Zb], [xa, yeL, Zf], [cx - hx, yr, zc + hz], [cx - hx, yr, zc - hz]],
    [[xb, yeR, Zf], [xb, yeR, Zb], [cx + hx, yr, zc - hz], [cx + hx, yr, zc + hz]],
  ];
  slopes.forEach((q, i) => {
    const r = roofSlope(q, { lod: bag.lod, seed: bag.seed + 41 + i + Math.round(cx * 3) });
    bag.add('tile', r.tile);
    bag.add('wood', r.wood);
  });
  const lod = bag.lod;
  if (lod < 2) {
    const beam = lin(WOODS.oak, 0.75);
    bag.add('wood', box(2 * hx + 0.16, 0.12, 0.12, cx, yr - 0.03, zc + hz, beam), box(2 * hx + 0.16, 0.12, 0.12, cx, yr - 0.03, zc - hz, beam));
    bag.add('wood', box(0.12, 0.12, 2 * hz, cx - hx, yr - 0.03, zc, beam), box(0.12, 0.12, 2 * hz, cx + hx, yr - 0.03, zc, beam));
  }
  // The impluvium, and in the tetrastyle atrium the four columns that carry the beams round the opening.
  basin(bag, cx, zc, 2 * hx - 0.5, 2 * hz - 0.35, { marble, h: 0.3 });
  if (tetra && lod < 2) for (const sx of [-1, 1]) for (const sz of [-1, 1]) column(bag, cx + sx * (hx - 0.12), zc + sz * (hz - 0.12), yr - FL - 0.12, 0.17, marble ? MARBLE : COLUMN, marble ? 'marble' : 'plaster');
}

/**
 * A peristyle: a rectangle of columns (cx0..cx1 by cz0..cz1) under an architrave, and the lean-to roofs between it and
 * the walls round it. The front row's roof falls to `frontZ`; the back row's to `backZ` (none when null: the caller
 * roofs the back). `hole` leaves the back row's columns, architrave and roof out where |x| is under it (a pavilion
 * stands there).
 */
function colonnade(bag, P) {
  const { cx0, cx1, cz0, cz1, colH, nx, nz, key, c, wallX, frontZ, backZ = null, topY, r = 0.24, ionic = false, hole = 0 } = P;
  const xs = spread(cx0, cx1, nx);
  for (const x of xs) column(bag, x, cz1, colH, r, c, key, { ionic });
  for (const x of xs) if (Math.abs(x) >= hole) column(bag, x, cz0, colH, r, c, key, { ionic });
  for (const z of spread(cz0, cz1, nz).slice(1, -1)) for (const x of [cx0, cx1]) column(bag, x, z, colH, r, c, key, { ionic });
  const aH = 0.34;
  const t = r * 2.1;
  const mz = (cz0 + cz1) / 2;
  const beam = (a, b, z) => bag.add(key, box(b - a, aH, t, (a + b) / 2, colH, z, c));
  beam(cx0 - t / 2, cx1 + t / 2, cz1);
  if (hole) {
    const edge = xs.filter((x) => Math.abs(x) >= hole);
    const left = edge.filter((x) => x < 0);
    const right = edge.filter((x) => x > 0);
    beam(cx0 - t / 2, left[left.length - 1] + t / 2, cz0);
    beam(right[0] - t / 2, cx1 + t / 2, cz0);
  } else beam(cx0 - t / 2, cx1 + t / 2, cz0);
  bag.add(key, box(t, aH, cz1 - cz0, cx0, colH, mz, c), box(t, aH, cz1 - cz0, cx1, colH, mz, c));
  if (bag.lod === 0) {
    for (const x of spread(cx0 + 0.2, cx1 - 0.2, Math.round((cx1 - cx0) / 0.32))) bag.add(key, box(0.14, 0.1, 0.06, x, colH + aH, cz1 - t / 2 - 0.02, c));
  }
  const yE = colH + aH + 0.02;
  shed(bag, '-z', { a0: -wallX, a1: wallX, e: cz1 - t / 2, t: frontZ, yE, yT: topY });
  shed(bag, '+x', { a0: cz0, a1: cz1, e: cx0 + t / 2, t: -wallX, yE, yT: topY });
  shed(bag, '-x', { a0: cz0, a1: cz1, e: cx1 - t / 2, t: wallX, yE, yT: topY });
  if (backZ !== null) {
    if (hole) {
      shed(bag, '+z', { a0: -wallX, a1: -hole - 0.4, e: cz0 + t / 2, t: backZ, yE, yT: topY });
      shed(bag, '+z', { a0: hole + 0.4, a1: wallX, e: cz0 + t / 2, t: backZ, yE, yT: topY });
    } else shed(bag, '+z', { a0: -wallX, a1: wallX, e: cz0 + t / 2, t: backZ, yE, yT: topY });
  }
}

// ---------------------------------------------------------------------------
// The rear, shared by both: tablinum and alae, the first peristyle, the cross wall, the walls of the great garden
// ---------------------------------------------------------------------------

/**
 * The tablinum (wide open to the garden, under its own gable with a plaque, the mosaic seen in it), the two alae at its
 * sides, and the first peristyle with its basin and bronze faun. `zt` is the atria block's back wall.
 */
function rear(bag, L, v, { zt, hall, marble, gardenH }) {
  const lod = bag.lod;
  const wash = lin(L.wall);
  const col = lin(L.shut);
  const fill = wash.map((c) => c * 0.96);
  const HX = 3.0;
  const key = marble ? 'marble' : 'plaster';
  const cc = marble ? MARBLE : COLUMN;
  // The tablinum and its mosaic floor.
  slabBox(bag, 'flags', -W, W, ZG, zt + 0.3, FL, lin(0xa89c86, 0.9));
  const hp = shell(bag, {
    x0: -HX, x1: HX, z0: ZG, z1: zt + 0.2, h: hall, t: T, c: wash, k: 0.97, skip: ['+z'],
    openings: { '-z': [{ x: 0, y: 0, w: 3.6, h: 3.7 }, { x: 0, y: 4.5, w: 0.8, h: 0.9 }], '+x': [{ x: 0, y: 4.5, w: 0.5, h: 0.9 }], '-x': [{ x: 0, y: 4.5, w: 0.5, h: 0.9 }] },
  });
  const hb = hp['-z'];
  if (marble) marbleFrame(bag, hb, { x: 0, w: 3.6, h: 3.7 });
  else doorFrame(bag, hb, { x: 0, w: 3.6, h: 3.7 });
  windowTrim(bag, hb, { x: 0, y: 4.5, w: 0.8, h: 0.9 }, { shutters: 'closed', col, sill: false });
  for (const s of ['+x', '-x']) windowTrim(bag, hp[s], { x: 0, y: 4.5, w: 0.5, h: 0.9 }, { shutters: 'closed', col, sill: false });
  mosaic(bag, -HX + 0.5, HX - 0.5, ZG + 0.35, zt - 0.3);
  ridgeRoof(bag, { x0: -HX, x1: HX, z0: ZG, z1: zt + 0.2, eaveY: hall, rise: 1.7, along: 'z', over: 0.22, gableOver: 0.12, fill });
  if (lod < 2) {
    bag.add('clay', hb(box(0.6, 0.5, 0.06, 0, hall + 0.5, 0.13, TERRACOTTA)));
    bag.add('paint', hb(box(0.44, 0.34, 0.02, 0, hall + 0.58, 0.165, PALE)));
  }
  // The alae: low side rooms with a gable end each.
  for (const s of [-1, 1]) {
    const [x0, x1] = s > 0 ? [HX, W] : [-W, -HX];
    const wp = shell(bag, {
      x0, x1, z0: ZG, z1: zt + 0.2, h: 4.2, t: T, c: wash, k: 0.97, skip: ['+z', s > 0 ? '-x' : '+x'],
      openings: { '-z': [{ x: 0, y: 0, w: 1.0, h: 2.4 }], [s > 0 ? '+x' : '-x']: [{ x: 0, y: 1.6, w: 0.6, h: 0.9 }] },
    });
    doorFrame(bag, wp['-z'], { x: 0, w: 1.0, h: 2.4 });
    doorLeaf(bag, wp['-z'], { x: 0, w: 1.0, h: 2.4, col: lin(WOODS.oak, 0.9), open: true });
    windowTrim(bag, wp[s > 0 ? '+x' : '-x'], { x: 0, y: 1.6, w: 0.6, h: 0.9 }, { shutters: 'open', col });
    ridgeRoof(bag, { x0, x1, z0: ZG, z1: zt + 0.2, eaveY: 4.2, rise: 0.9, along: 'x', over: 0.2, gableOver: 0.1, fill });
  }
  // The first peristyle's walls: the sides and the cross wall, which has a doorway to the great garden.
  const g1 = shell(bag, {
    x0: -W, x1: W, z0: ZC, z1: ZG, h: gardenH, t: T, c: wash, k: 0.97, skip: ['+z'],
    openings: { '-z': [{ x: 0, y: 0, w: 2.7, h: 3.5 }] },
  });
  if (marble) marbleFrame(bag, g1['-z'], { x: 0, w: 2.7, h: 3.5 });
  else doorFrame(bag, g1['-z'], { x: 0, w: 2.7, h: 3.5 });
  if (lod < 2) {
    band(bag, g1['-z'], 0, 2 * W + 0.1, gardenH - 0.2);
    plaques(bag, g1['-z'], -W + 0.7, W - 0.7, gardenH - 0.7, 1.3);
    plaques(bag, g1['+x'], -1.0, 1.0, gardenH - 0.7, 1.3);
    fields(bag, g1['-z'], -W + 0.6, -1.9, 1.3, 1.9, wash);
    fields(bag, g1['-z'], 1.9, W - 0.6, 1.3, 1.9, wash);
  }
  slabBox(bag, 'earth', -OX, OX, ZC + T, ZG, FL, lin(0xb4a584, 0.95));
  colonnade(bag, {
    cx0: -4.5, cx1: 4.5, cz0: -2.05, cz1: 0.25, colH: marble ? 3.2 : 3.0, nx: 4, nz: 2, key, c: cc, wallX: OX, frontZ: ZG, backZ: ZC + T, topY: marble ? 4.2 : 4.0, r: marble ? 0.26 : 0.24, ionic: marble,
  });
  slabBox(bag, 'flags', -3.4, 3.4, -1.9, 0.2, FL + 0.01, lin(0xc3b79b, 0.9));
  void v;
}

// ---------------------------------------------------------------------------
// The Grand Palatium (19)
// ---------------------------------------------------------------------------

/** The Grand Palatium, its look `v`, at a level of detail. */
function buildGrandPalatium(v, lod) {
  const L = LOOKS[v & 3];
  const G = PALATIA.grand;
  const bag = new PalBag(`grandpal${v}`, lod, 3100 + v * 23);
  const wash = lin(L.wall);
  const col = lin(L.shut);
  const fill = wash.map((c) => c * 0.96);
  const H = G.front;
  const zt = G.zt;
  // The street front: three shops, the great door, the lesser door, windows above them all.
  const shopW = 1.5;
  const shopH = 2.2;
  const doorW = 1.5;
  const doorH = 2.8;
  const door2W = 1.1;
  const door2H = 2.4;
  const upperX = [-6.2, -3.1, 0, 3.1, 6.2];
  const openings = [
    { x: G.doorX, y: 0, w: doorW, h: doorH }, { x: G.door2X, y: 0, w: door2W, h: door2H },
    ...G.shopX.map((x) => ({ x, y: 0, w: shopW, h: shopH })),
    ...upperX.map((x) => ({ x, y: 3.4, w: 0.65, h: 0.8 })),
  ];
  const puts = shell(bag, {
    x0: -W, x1: W, z0: zt, z1: W, h: H, t: T, c: wash, k: 0.97,
    openings: { '+z': openings, '+x': [{ x: 0, y: 3.3, w: 0.45, h: 0.8 }], '-x': [{ x: 0, y: 3.3, w: 0.45, h: 0.8 }] },
  });
  const fr = puts['+z'];
  slabBox(bag, 'flags', -W, W, zt + 0.3, W + 0.3, FL, lin(0xa89c86, 0.9));
  fauces(bag, fr, G.doorX, doorW, doorH, false);
  haveThreshold(bag, fr, G.doorX, 0.1);
  fauces(bag, fr, G.door2X, door2W, door2H, false);
  const wares = ['amph', 'bread', 'fruit'];
  G.shopX.forEach((x, i) => {
    doorFrame(bag, fr, { x, w: shopW, h: shopH });
    boards(bag, fr, x, shopW, shopH);
    counter(bag, fr, x, shopW, -0.12, wares[(i + v) % 3], FL);
  });
  for (const x of upperX) windowTrim(bag, fr, { x, y: 3.4, w: 0.65, h: 0.8 }, { shutters: 'closed', col, sill: false });
  for (const s of ['+x', '-x']) windowTrim(bag, puts[s], { x: 0, y: 3.3, w: 0.45, h: 0.8 }, { shutters: 'closed', col, sill: false });
  if (lod < 2) {
    const holes = [[G.doorX - doorW / 2 - 0.2, G.doorX + doorW / 2 + 0.2], [G.door2X - door2W / 2 - 0.2, G.door2X + door2W / 2 + 0.2], ...G.shopX.map((x) => [x - shopW / 2 - 0.1, x + shopW / 2 + 0.1])];
    for (const [a, b] of gaps(-W + 0.1, W - 0.1, holes)) bag.add('plaster', fr(box(b - a, 1.0, 0.014, (a + b) / 2, 0.06, 0.007, lin(L.dado))));
    band(bag, fr, 0, 2 * W + 0.1, H - 0.16);
    plaques(bag, fr, -W + 0.4, W - 0.4, H - 0.62, 1.15);
  }
  // The two atria under their own compluvia: Tuscan on the left, tetrastyle on the right.
  atrium(bag, { cx: -W / 2, x0: -W, x1: -0.02, z0: zt, z1: W, eaveY: H, zc: 5.1, hx: 1.5, hz: 0.8, drop: 0.9 });
  atrium(bag, { cx: W / 2, x0: 0.02, x1: W, z0: zt, z1: W, eaveY: H, zc: 5.1, hx: 1.6, hz: 0.85, drop: 0.9, tetra: true });
  // The tablinum, the alae and the first peristyle.
  rear(bag, L, v, { zt, hall: G.hall, marble: false, gardenH: 4.4 });
  // The great garden: its walls, floor, colonnade and what grows.
  const gw = shell(bag, { x0: -W, x1: W, z0: -6.5, z1: ZC, h: 4.4, t: T, c: wash, k: 0.97, skip: ['+z', '-z'] });
  if (lod < 2) plaques(bag, gw['+x'], -1.2, 1.2, 3.8, 1.3);
  slabBox(bag, 'earth', -OX, OX, -6.5, ZC, FL, lin(0xb4a584, 0.95));
  const colH = 3.4;
  const rowBack = -5.8;
  colonnade(bag, { cx0: -6.3, cx1: 6.3, cz0: rowBack, cz1: -3.4, colH, nx: 6, nz: 3, key: 'plaster', c: COLUMN, wallX: OX, frontZ: ZC + T, topY: 4.2, r: 0.25 });
  // The range behind it: two storeys, a loggia on the upper floor over the colonnade's back row.
  const R = G.range;
  const rp = shell(bag, {
    x0: -W, x1: W, z0: -W, z1: -6.5, h: R, t: T, c: wash, k: 0.97,
    openings: {
      '+z': [{ x: 0, y: 0, w: 2.8, h: 3.2 }, { x: -4.4, y: 0, w: 1.0, h: 2.4 }, { x: 4.4, y: 0, w: 1.0, h: 2.4 }, ...[-5.4, -2.7, 0, 2.7, 5.4].map((x) => ({ x, y: 4.4, w: 0.85, h: 1.7 }))],
      '-z': [-5, -2.5, 0, 2.5, 5].map((x) => ({ x, y: 4.4, w: 0.7, h: 1.3 })),
      '+x': [{ x: 0, y: 4.4, w: 0.5, h: 1.0 }], '-x': [{ x: 0, y: 4.4, w: 0.5, h: 1.0 }],
    },
  });
  const rb = rp['+z'];
  doorFrame(bag, rb, { x: 0, w: 2.8, h: 3.2 });
  for (const x of [-4.4, 4.4]) {
    doorFrame(bag, rb, { x, w: 1.0, h: 2.4 });
    doorLeaf(bag, rb, { x, w: 1.0, h: 2.4, col: lin(WOODS.oak, 0.9), open: true });
  }
  for (const x of [-5.4, -2.7, 0, 2.7, 5.4]) windowTrim(bag, rb, { x, y: 4.4, w: 0.85, h: 1.7 }, { shutters: 'open', col, sill: false });
  for (const x of [-5, -2.5, 0, 2.5, 5]) windowTrim(bag, rp['-z'], { x, y: 4.4, w: 0.7, h: 1.3 }, { shutters: 'closed', col, sill: false });
  for (const s of ['+x', '-x']) windowTrim(bag, rp[s], { x: 0, y: 4.4, w: 0.5, h: 1.0 }, { shutters: 'closed', col, sill: false });
  const loggiaY = colH + 0.34;
  const lx = 5.2;
  slabBox(bag, 'plaster', -lx - 0.3, lx + 0.3, -6.5, rowBack + 0.4, 0.2, lin(WASH.lime, 0.95), loggiaY);
  for (const x of spread(-lx, lx, 5)) column(bag, x, rowBack, 3.0, 0.2, MARBLE, 'marble', { y0: loggiaY + 0.2 });
  if (lod < 2) bag.add('wood', box(2 * lx + 0.4, 0.9, 0.06, 0, loggiaY + 0.2, rowBack + 0.2, OAK));
  bag.add('plaster', box(2 * lx + 0.55, 0.3, 0.42, 0, loggiaY + 3.2, rowBack, lin(WASH.lime, 0.95)));
  shed(bag, '+z', { a0: -lx - 0.3, a1: lx + 0.3, e: rowBack + 0.35, t: -6.5, yE: loggiaY + 3.55, yT: R - 0.2 });
  if (lod < 2) {
    band(bag, rb, 0, 2 * W + 0.1, loggiaY - 0.1);
    band(bag, rb, 0, 2 * W + 0.1, R - 0.16);
    plaques(bag, rb, -W + 0.4, -lx - 0.6, R - 0.62, 1.1);
    plaques(bag, rb, lx + 0.6, W - 0.4, R - 0.62, 1.1);
  }
  ridgeRoof(bag, { x0: -W, x1: W, z0: -W, z1: -6.5, eaveY: R, rise: 1.2, along: 'x', over: 0.25, gableOver: 0.12, fill });
  // The great garden's pool, beds, figs and cypresses; the look picks what is planted.
  basin(bag, 0, -4.6, 6.2, 0.9, { marble: false, h: 0.42 });
  lawn(bag, -OX + 0.3, OX - 0.3, -6.4, -3.5);
  const fl = L.flora;
  if (fl === 'fig') {
    for (const s of [-1, 1]) for (const x of [3.2, 5.3]) fig(bag, s * x, -4.6, 0.95, bag.seed + s * x);
    for (const s of [-1, 1]) cyp(bag, s * 4.2, -6.2, 3.4, 20 + s);
  } else if (fl === 'cypress') {
    for (const x of spread(-5.6, 5.6, 6)) if (Math.abs(x) > 1.0) cyp(bag, x, -6.15, 3.4, 20 + x * 2);
    for (const s of [-1, 1]) fig(bag, s * 4.4, -4.6, 0.9, bag.seed + s);
  } else if (fl === 'arbor') {
    for (const s of [-1, 1]) for (const x of [2.8, 5.0]) fig(bag, s * x, -4.6, 0.9, bag.seed + s * x);
    for (const s of [-1, 1]) cyp(bag, s * 6.0, -3.7, 3.2, 40 + s);
  } else {
    for (const s of [-1, 1]) {
      fig(bag, s * 3.4, -4.6, 0.95, bag.seed + s);
      cyp(bag, s * 5.4, -4.6, 3.3, 60 + s);
    }
  }
  // The first court's faun, in the middle of its basin.
  basin(bag, 0, -0.95, 1.8, 1.0, {});
  bronzeFaun(bag, 0, -0.95, 0.4);
  return bag.build();
}

// ---------------------------------------------------------------------------
// The Imperial Palatium (20)
// ---------------------------------------------------------------------------

/** The belvedere: a square tower on the block's corner, windows below, an open loggia of marble columns, a pyramid roof. */
function belvedere(bag, L, tx0, tx1, z0, z1, side) {
  const lod = bag.lod;
  const wash = lin(L.wall);
  const col = lin(L.shut);
  const fill = wash.map((c) => c * 0.96);
  const base = 6.6;
  const outer = side > 0 ? '+x' : '-x';
  const tp = shell(bag, {
    x0: tx0, x1: tx1, z0, z1, h: base, t: T, c: wash, k: 0.97, skip: [side > 0 ? '-x' : '+x'],
    openings: {
      '+z': [{ x: 0, y: 1.7, w: 0.6, h: 1.0 }, { x: 0, y: 4.2, w: 0.75, h: 1.4 }],
      '-z': [{ x: 0, y: 4.2, w: 0.75, h: 1.4 }],
      [outer]: [{ x: 0, y: 1.7, w: 0.6, h: 1.0 }, { x: 0, y: 4.2, w: 0.75, h: 1.4 }],
    },
  });
  windowTrim(bag, tp['+z'], { x: 0, y: 1.7, w: 0.6, h: 1.0 }, { shutters: 'open', col });
  windowTrim(bag, tp['+z'], { x: 0, y: 4.2, w: 0.75, h: 1.4 }, { shutters: 'closed', col, sill: false });
  windowTrim(bag, tp['-z'], { x: 0, y: 4.2, w: 0.75, h: 1.4 }, { shutters: 'closed', col, sill: false });
  windowTrim(bag, tp[outer], { x: 0, y: 1.7, w: 0.6, h: 1.0 }, { shutters: 'open', col });
  windowTrim(bag, tp[outer], { x: 0, y: 4.2, w: 0.75, h: 1.4 }, { shutters: 'closed', col, sill: false });
  if (lod < 2) {
    band(bag, tp['+z'], 0, tx1 - tx0 + 0.1, 3.2);
    band(bag, tp['+z'], 0, tx1 - tx0 + 0.1, base - 0.16);
  }
  // The open loggia: a marble floor, columns round it, a beam, the pyramid roof.
  const fx0 = tx0 - 0.05;
  const fx1 = tx1 + 0.05;
  const fz0 = z0 - 0.05;
  const fz1 = z1 + 0.05;
  slabBox(bag, 'marble', fx0, fx1, fz0, fz1, 0.2, MARBLE, base);
  const cxs = spread(tx0 + 0.3, tx1 - 0.3, 3);
  const czs = spread(z0 + 0.3, z1 - 0.3, 3);
  const y0 = base + 0.2;
  const ch = 2.3;
  for (const x of cxs) for (const z of [czs[0], czs[2]]) column(bag, x, z, ch, 0.15, MARBLE, 'marble', { ionic: true, y0 });
  for (const z of [czs[1]]) for (const x of [cxs[0], cxs[2]]) column(bag, x, z, ch, 0.15, MARBLE, 'marble', { ionic: true, y0 });
  bag.add('marble', box(fx1 - fx0, 0.3, fz1 - fz0, (fx0 + fx1) / 2, y0 + ch, (fz0 + fz1) / 2, MARBLE));
  if (lod < 2) {
    // A low balustrade between the columns and a lamp in the middle of the floor.
    for (const z of [czs[0], czs[2]]) bag.add('marble', box(tx1 - tx0 - 0.6, 0.12, 0.1, (tx0 + tx1) / 2, y0 + 0.75, z, MARBLE));
    for (const x of [cxs[0], cxs[2]]) bag.add('marble', box(0.1, 0.12, z1 - z0 - 0.6, x, y0 + 0.75, (z0 + z1) / 2, MARBLE));
  }
  const top = y0 + ch + 0.3;
  ridgeRoof(bag, { x0: fx0, x1: fx1, z0: fz0, z1: fz1, eaveY: top, rise: 1.25, along: 'x', hip: true, over: 0.2, gableOver: 0.1, fill });
  if (lod < 2) {
    bag.add('bronze', cyl(0.05, 0.09, 0.3, 6, (tx0 + tx1) / 2, top + 1.1, (z0 + z1) / 2, BRONZE));
    bag.add('bronze', sphere(0.09, (tx0 + tx1) / 2, top + 1.42, (z0 + z1) / 2));
  }
}

/** A small bronze ball (a finial). */
function sphere(r, x, y, z) {
  const g = new SphereGeometry(r, 6, 5);
  g.translate(x, y, z);
  return tintGeometry(boxUV(g), () => BRONZE);
}

/** The pediment's acroterion group: a plinth with three small figures, and a block at each foot of the gable. */
function acroteria(bag, x, y, z) {
  bag.add('marble', box(0.8, 0.3, 0.5, x, y, z, MARBLE));
  if (bag.lod > 1) return;
  for (const dx of [-0.25, 0, 0.25]) {
    const h = dx === 0 ? 0.8 : 0.6;
    bag.add('marble', cyl(0.07, 0.1, h, 6, x + dx, y + 0.3, z, MARBLE));
    const g = new SphereGeometry(0.07, 6, 5);
    g.translate(x + dx, y + 0.3 + h + 0.05, z);
    bag.add('marble', tintGeometry(boxUV(g), () => MARBLE));
  }
}

/** The Imperial Palatium, its look `v`, at a level of detail. */
function buildImperialPalatium(v, lod) {
  const L = LOOKS[v & 3];
  const I = PALATIA.imperial;
  const bag = new PalBag(`imperial${v}`, lod, 3500 + v * 29);
  const wash = lin(L.wall);
  const col = lin(L.shut);
  const fill = wash.map((c) => c * 0.96);
  const side = SIDE[v & 3];
  const { zt, face: zf, front: H } = I;
  // The street: pavement, the two low walls either side of the porch, the side walls of the forecourt.
  slabBox(bag, 'flags', -W, W, zf - 0.1, W + 0.3, FL, lin(0xa89c86, 0.9));
  for (const s of [-1, 1]) {
    const cx = s * ((W + 3.1) / 2);
    const sc = wall(bag, '+z', W, cx, { w: W - 3.1, h: 3.4, t: T, c: wash, k: 0.97 });
    bag.add('marble', sc(box(W - 3.1 + 0.1, 0.12, 0.42, 0, 3.4, -0.1, MARBLE)));
    const sw = wall(bag, s > 0 ? '+x' : '-x', W, (zf + W - T) / 2, { w: W - T - zf, h: 3.2, t: T, c: wash, k: 0.97 });
    bag.add('marble', sw(box(W - T - zf + 0.1, 0.12, 0.42, 0, 3.2, -0.1, MARBLE)));
    if (lod < 2) {
      plaques(bag, sc, -(W - 3.1) / 2 + 0.4, (W - 3.1) / 2 - 0.4, 2.8, 1.1);
      band(bag, sc, 0, W - 3.1, 3.0);
    }
  }
  // The porch: a marble platform and steps, four Ionic columns, an entablature, a pediment with its acroteria.
  const pc = I.porchZ;
  const colH = 4.2;
  const fl = I.platform;
  slabBox(bag, 'marble', -3.3, 3.3, 6.5, 7.4, fl, MARBLE);
  slabBox(bag, 'marble', -3.5, 3.5, 7.4, 7.95, 0.12, MARBLE);
  slabBox(bag, 'marble', -3.4, 3.4, 7.4, 7.7, 0.24, MARBLE);
  for (const x of spread(-2.5, 2.5, 4)) column(bag, x, pc, colH, 0.28, MARBLE, 'marble', { ionic: true, y0: fl });
  const eY = fl + colH;
  bag.add('marble', box(6.6, 0.42, 0.74, 0, eY, pc, MARBLE));
  if (lod < 2) {
    bag.add('marble', box(6.8, 0.1, 0.84, 0, eY + 0.42, pc, MARBLE));
    for (const x of spread(-3.0, 3.0, 11)) bag.add('clay', box(0.3, 0.26, 0.05, x, eY + 0.08, pc + 0.38, TERRACOTTA));
  }
  ridgeRoof(bag, { x0: -3.3, x1: 3.3, z0: 6.2, z1: pc + 0.45, eaveY: eY + 0.52, rise: 1.1, along: 'z', over: 0.2, gableOver: 0.12, fill: MARBLE.map((c) => c * 0.9) });
  if (lod < 2) {
    bag.add('clay', box(0.5, 0.42, 0.06, 0, eY + 1.2, pc + 0.55, TERRACOTTA));
    bag.add('paint', box(0.36, 0.28, 0.02, 0, eY + 1.27, pc + 0.585, PALE));
  }
  acroteria(bag, 0, eY + 0.52 + 1.1 + 0.2, pc - 0.3);
  for (const s of [-1, 1]) bag.add('marble', box(0.34, 0.34, 0.34, s * 3.35, eY + 0.52, pc - 0.1, MARBLE));
  for (const s of [-1, 1]) lampstand(bag, s * 3.9, 7.75);
  // The forecourt: a fountain on the axis, statues on bases, cypresses.
  slabBox(bag, 'flags', -OX, OX, zf, 6.5, FL + 0.01, lin(0xc3b79b, 0.9));
  fountain(bag, 0, 5.85, 0.62);
  for (const s of [-1, 1]) {
    statue(bag, s * 2.5, 5.95, { h: 1.7, ry: s });
    statue(bag, s * 5.2, 6.0, { h: 1.6, ry: s + 1 });
    if (lod < 2) cyp(bag, s * 6.7, 5.7, 3.4, 20 + s);
  }
  // The atria block: the tower at one corner, the two atria in the rest.
  const tw = I.tower;
  const [tx0, tx1] = side > 0 ? [W - tw, W] : [-W, -W + tw];
  const [bx0, bx1] = side > 0 ? [-W, W - tw] : [-W + tw, W];
  const mid = (bx0 + bx1) / 2;
  const doorXs = [(bx0 + mid) / 2, (mid + bx1) / 2];
  const openings = [...doorXs.map((x) => ({ x, y: 0, w: 1.5, h: 3.2 })), ...doorXs.map((x) => ({ x, y: 4.0, w: 0.8, h: 1.1 }))];
  const bp = shell(bag, {
    x0: bx0, x1: bx1, z0: zt, z1: zf, h: H, t: T, c: wash, k: 0.97, skip: [side > 0 ? '+x' : '-x'],
    openings: { '+z': openings, [side > 0 ? '-x' : '+x']: [{ x: 0, y: 3.9, w: 0.5, h: 1.0 }] },
  });
  slabBox(bag, 'flags', bx0, bx1, zt + 0.3, zf + 0.2, FL, lin(0xa89c86, 0.9));
  const bf = bp['+z'];
  doorXs.forEach((x) => {
    marbleFrame(bag, bf, { x, w: 1.5, h: 3.2 });
    doorLeaf(bag, bf, { x, w: 1.5, h: 3.2, col: lin(WOODS.oak), open: true });
    windowTrim(bag, bf, { x, y: 4.0, w: 0.8, h: 1.1 }, { shutters: 'open', col, sill: false });
  });
  windowTrim(bag, bp[side > 0 ? '-x' : '+x'], { x: 0, y: 3.9, w: 0.5, h: 1.0 }, { shutters: 'closed', col, sill: false });
  if (lod < 2) {
    band(bag, bf, 0, bx1 - bx0 + 0.1, H - 0.18);
    plaques(bag, bf, -(bx1 - bx0) / 2 + 0.4, (bx1 - bx0) / 2 - 0.4, H - 0.66, 1.1);
  }
  const zc = (zt + zf) / 2;
  atrium(bag, { cx: doorXs[0], x0: bx0, x1: mid - 0.02, z0: zt, z1: zf, eaveY: H, zc, hx: 1.3, hz: 0.55, drop: 0.7, marble: true });
  atrium(bag, { cx: doorXs[1], x0: mid + 0.02, x1: bx1, z0: zt, z1: zf, eaveY: H, zc, hx: 1.3, hz: 0.55, drop: 0.7, tetra: true, marble: true });
  belvedere(bag, L, tx0, tx1, zt, zf, side);
  // The tablinum, the alae, the first peristyle: marble.
  rear(bag, L, v, { zt, hall: I.hall, marble: true, gardenH: 4.8 });
  basin(bag, 0, -0.95, 4.6, 0.9, { marble: true, jet: false, h: 0.36 });
  for (const s of [-1, 1]) statue(bag, s * 5.3, -1.0, { h: 1.5, ry: s });
  // The great garden: sides, back wall, a marble colonnade round it, the pavilion in its middle, the gate.
  const gate = [{ x: 0, y: 0, w: 1.6, h: 2.9 }];
  const gw = shell(bag, {
    x0: -W, x1: W, z0: -W, z1: ZC, h: 4.8, t: T, c: wash, k: 0.97, skip: ['+z'],
    openings: { '+x': gate },
  });
  slabBox(bag, 'earth', -OX, OX, -OX, ZC, FL, lin(0xb4a584, 0.95));
  const gp = gw['+x'];
  marbleFrame(bag, gp, { x: 0, w: 1.6, h: 2.9 });
  doorLeaf(bag, gp, { x: 0, w: 1.6, h: 2.9, col: lin(WOODS.oak), open: true });
  if (lod < 2) {
    for (const s of [-1, 1]) bag.add('marble', gp(box(0.34, 3.35, 0.34, s * 1.1, 0, 0.12, MARBLE)));
    bag.add('marble', gp(box(2.3, 0.14, 0.34, 0, 3.35, 0.12, MARBLE)));
    band(bag, gw['-z'], 0, 2 * W + 0.1, 4.6);
    plaques(bag, gw['-z'], -W + 0.7, W - 0.7, 4.0, 1.2);
    plaques(bag, gw['-x'], -2.0, 2.0, 4.0, 1.2);
    fields(bag, gw['-z'], -W + 0.6, -2.9, 1.4, 2.0, wash);
    fields(bag, gw['-z'], 2.9, W - 0.6, 1.4, 2.0, wash);
  }
  colonnade(bag, {
    cx0: -6.3, cx1: 6.3, cz0: -6.55, cz1: -3.5, colH: 3.5, nx: 6, nz: 3, key: 'marble', c: MARBLE, wallX: OX, frontZ: ZC + T, backZ: -(W - T), topY: 4.6, r: 0.26, ionic: true, hole: 2.0,
  });
  slabBox(bag, 'flags', -2.4, 2.4, -6.4, -3.6, FL + 0.01, lin(0xc3b79b, 0.9));
  // Two long basins, a lawn each side, planting by the look.
  for (const s of [-1, 1]) {
    basin(bag, s * 4.3, -5.0, 2.8, 0.8, { marble: true, h: 0.36 });
    lawn(bag, s > 0 ? 3.2 : -OX + 0.4, s > 0 ? OX - 0.4 : -3.2, -6.3, -3.7);
  }
  const fl2 = L.flora;
  for (const s of [-1, 1]) {
    if (fl2 === 'fig' || fl2 === 'arbor') fig(bag, s * 5.8, -4.3, 0.9, bag.seed + s);
    else cyp(bag, s * 5.8, -4.3, 3.3, 30 + s);
    cyp(bag, s * 3.3, -6.2, 3.4, 33 + s);
  }
  // The summer pavilion: a podium, a roofed exedra open to the garden between two columns, three couches and a table.
  slabBox(bag, 'marble', -2.6, 2.6, -7.35, -5.6, 0.3, MARBLE);
  for (const s of [-1, 1]) column(bag, s * 2.3, -5.9, 3.3, 0.2, MARBLE, 'marble', { ionic: true, y0: 0.3 });
  bag.add('marble', box(5.0, 0.3, 0.5, 0, 3.6, -5.9, MARBLE));
  ridgeRoof(bag, { x0: -2.6, x1: 2.6, z0: -7.45, z1: -5.6, eaveY: 3.9, rise: 1.25, along: 'z', over: 0.25, gableOver: 0.12, fill });
  if (lod < 2) {
    for (const s of [-1, 1]) bag.add('plaster', box(0.2, 2.4, 1.6, s * 2.5, 0.3, -6.6, wash));
    bag.add('clay', box(0.5, 0.4, 0.06, 0, 3.9 + 1.0, -5.55, TERRACOTTA));
  }
  couch(bag, -1.5, -6.55, 'z');
  couch(bag, 1.5, -6.55, 'z');
  couch(bag, 0, -7.0, 'x');
  if (lod < 2) bag.add('marble', cyl(0.4, 0.3, 0.45, 10, 0, 0.3, -6.45, MARBLE));
  return bag.build();
}

/** The builders houses.js adds to its table, by kind. */
export const PALATIA_BUILDERS = Object.freeze({
  grandpal: buildGrandPalatium,
  imperial: buildImperialPalatium,
});

/** The housing level each of these draws. */
export const PALATIA_LEVELS = Object.freeze({ grandpal: 19, imperial: 20 });

// ---------------------------------------------------------------------------
// People and lamps
// ---------------------------------------------------------------------------

const woman = (dress, extra) => ({ body: 'f', dress: ['tunic:long:stola', dress], hair: 'bun', ...extra });
const man = (extra) => ({ body: 'm', dress: ['tunic:knee'], hair: 'crop', ...extra });
const child = (extra) => ({ body: 'c', dress: ['tunic:short'], hair: 'curls', scale: 0.78, ...extra });

/**
 * The people of a palatium in its own metres (state 'open' only): the porter at the door, a client waiting to be
 * received, the lady and the master in conversation in the garden, a child, a servant sweeping.
 */
export function palatiaPeople(kind, v) {
  const s = 1200 + v * 7 + PALATIA_LEVELS[kind] * 31;
  const side = SIDE[v & 3];
  if (kind === 'imperial') {
    return [
      man({ clip: 'idle', at: [-1.7, PALATIA.imperial.platform, 7.05], ry: 0.2 * side, seed: s, colours: { tunic: DYES.walnut } }),
      man({ clip: 'idle', at: [side * 1.9, 0.12, 7.78], ry: Math.PI - 0.3, seed: s + 1, colours: { tunic: DYES.white, mantle: DYES.oatmeal } }),
      woman('palla', { clip: 'talk', at: [-side * 1.2, FL, -1.55], ry: Math.PI / 2 * side, seed: s + 2, colours: { tunic: DYES.oatmeal, mantle: DYES.madder } }),
      man({ clip: 'talk', at: [-side * 2.3, FL, -1.55], ry: -Math.PI / 2 * side, seed: s + 3, colours: { tunic: DYES.white, mantle: DYES.murex } }),
      child({ clip: 'idle', at: [side * 1.3, FL, 5.1], ry: 0.5, seed: s + 4 }),
      woman('palla', { clip: 'sweep', props: { R: 'broom' }, at: [-3.0 * side, FL, -4.1], ry: 0.5, seed: s + 5, colours: { tunic: DYES.undyed } }),
    ];
  }
  return [
    man({ clip: 'idle', at: [PALATIA.grand.doorX + 1.15, FL, W + 0.22], ry: 0.2 * side, seed: s, colours: { tunic: DYES.walnut } }),
    man({ clip: 'idle', at: [PALATIA.grand.doorX - 1.2, FL, W + 0.26], ry: Math.PI - 0.4, seed: s + 1, colours: { tunic: DYES.white, mantle: DYES.oatmeal } }),
    woman('palla', { clip: 'talk', at: [-side * 1.3, FL, -1.5], ry: Math.PI / 2 * side, seed: s + 2, colours: { tunic: DYES.oatmeal, mantle: DYES.madder } }),
    man({ clip: 'talk', at: [-side * 2.4, FL, -1.5], ry: -Math.PI / 2 * side, seed: s + 3, colours: { tunic: DYES.white, mantle: DYES.woad } }),
    child({ clip: 'idle', at: [side * 2.0, FL, -3.1], ry: 0.5, seed: s + 4 }),
    woman('palla', { clip: 'sweep', props: { R: 'broom' }, at: [-3.2 * side, FL, -4.6], ry: 0.4, seed: s + 5, colours: { tunic: DYES.undyed } }),
  ];
}

/** The windows a palatium may light by look: [x, y, z, s] each, on the front. */
export function palatiaLamps(kind, v) {
  if (kind === 'imperial') {
    const I = PALATIA.imperial;
    const side = SIDE[v & 3];
    const tw = I.tower;
    const [bx0, bx1] = side > 0 ? [-W, W - tw] : [-W + tw, W];
    const mid = (bx0 + bx1) / 2;
    const xs = [(bx0 + mid) / 2, (mid + bx1) / 2];
    return [[xs[0], 1.6, I.face + 0.05, 1], [xs[1], 1.6, I.face + 0.05, 1], [xs[0], 4.5, I.face + 0.05, 1], [(side > 0 ? W - tw / 2 : -W + tw / 2), 2.2, I.face + 0.05, 1]];
  }
  const G = PALATIA.grand;
  return [[G.doorX, 1.5, W + 0.05, 1], [G.door2X, 1.4, W + 0.05, 1], [G.shopX[0], 1.0, W + 0.05, 1], [G.shopX[2], 1.0, W + 0.05, 1], [0, 3.8, W + 0.05, 1]];
}
