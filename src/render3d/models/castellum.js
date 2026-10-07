/**
 * models/castellum.js
 * ----------------------------------------------------------------------------
 * The reservoir of the 3D look (Castellum Aquae, 3 x 3 tiles: 12 m), from
 * the distribution tanks Rome built where an aqueduct reached a town, not
 * from the 2D sprite:
 *
 *   - A podium of two steps, paved, and on it an open tank of masonry
 *     walls lined with opus signinum (Vitruvius's lining of lime and
 *     crushed tile, a quarter-round fillet where floor meets wall, as in
 *     the cisterns of Pompeii and the round basin at Nimes), its coping of
 *     dressed stone; a band of sinter where the water stands.
 *   - The castellum divisorium at its back, as the one inside Pompeii's
 *     Porta Vesuvio: a small house of masonry under a tiled gable roof,
 *     straddling the tank's wall. The water leaves the tank through three
 *     outlets in its face, each behind a bronze grille (Vitruvius's three
 *     shares: the basins and fountains, the baths, the houses), and leaves
 *     the house in three lead pipes down its back into the ground, each
 *     with a bronze stopcock; a door for the aquarius on its side, a blank
 *     tablet over the outlets.
 *   - Two water towers (castella secundaria, the brick piers along
 *     Pompeii's streets) at the back corners, each a pier carrying a lead
 *     tank, a lead pipe up one face and down another.
 *   - Overflows on the two sides: a stone spout running into a trough on
 *     the podium, so a full castellum is seen to run over.
 *
 * Where an aqueduct reaches it (aqueducts/aqueductLayout.js
 * reservoirJoins), an inlet is drawn there (a `more` kit): the channel
 * runs in at AQ.inlet (models/aqueduct.js) over a short wall across the
 * podium and over the tank's coping, and pours in; at the house's back it
 * runs into the house instead. Where a side is on open water, an intake: a
 * culvert through the podium behind a bronze grille.
 *
 * States by the parts' tags (models.js partShows): 'full' the tank's water
 * and the troughs', 'flow' the falls (the overflows, an inlet's pour) and
 * the rings where they land, 'dry' the silt and a puddle of what is left on
 * the tank's floor, 'ice' the water's margins frozen in a hard frost (and
 * in the ':ice' look, the dry puddle frozen).
 *
 * Metres, the footprint's middle at the origin, y up, facing +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Shape, Vector2, BufferGeometry, Float32BufferAttribute } from 'three';
import { boxUV, tintGeometry, tube } from '../shapes.js';
import { material, streamMaterial, ringMaterial, stagnantMaterial, iceMaterial } from '../materials.js';
import { artRng, smoothstep } from '../texgen.js';
import { slab, paving, TaggedParts } from './masonry.js';
import { ruralMaterials, gableRoof } from './rural.js';
import { AQ, aqueductMaterials, fall, poolWater } from './aqueduct.js';

/** The castellum's measures (metres): the tests and the lab read them. */
export const RES = Object.freeze({
  half: 6,
  step: Object.freeze([5.9, 0.22]), // the lower step's half width and top
  plat: Object.freeze([5.6, 0.55]), // the podium's half width and top
  tankOut: 4.6,
  tankIn: 4.05,
  floor: 0.35, // the tank's floor (its lining's top)
  wallTop: 1.75,
  coping: 0.15,
  copeOut: 0.06,
  water: 1.55,
  house: Object.freeze({ x: 1.6, z0: -5.4, z1: -3.0, eave: 3.3 }),
  tower: Object.freeze({ at: 5.15, half: 0.45, top: 3.95 }),
  spout: Object.freeze({ z: 2.0, y: 1.44 }),
});
/** The castellum's top: its water towers' tanks. */
export const RES_TOP = RES.tower.top + 0.13 + 0.68;

/** Dirt splashed up the foot: a vertex colour by height. */
const grime = (y) => 0.82 + 0.18 * smoothstep(0.0, 1.2, y);

/** A box from (x0, y0, z0) to (x1, y1, z1), tinted by height (or `f`). */
function box(x0, x1, y0, y1, z0, z1, k = 1, f = null) {
  const g = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  boxUV(g);
  return tintGeometry(g, f || ((x, y) => k * grime(y)));
}

/** A flat rectangle at height y facing up, UVs in metres; `f(x, z)` its tint. */
function flat(x0, x1, z0, z1, y, f = null) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0], 3));
  g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new Float32BufferAttribute([x0, z0, x0, z1, x1, z1, x1, z0], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return tintGeometry(g, f ? (x, yy, z) => f(x, z) : null);
}

/** A flat outline (points [x, z], star-shaped about its middle) at height y facing up, fanned from its middle. */
function flatPoly(pts, y, f = null) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const all = [[cx, cz], ...pts];
  const pos = [];
  for (const [x, z] of all) pos.push(x, y, z);
  // Wound to face up whichever way the outline runs.
  let area = 0;
  for (let k = 0; k < pts.length; k++) {
    const [ax, az] = pts[k];
    const [bx, bz] = pts[(k + 1) % pts.length];
    area += ax * bz - bx * az;
  }
  const idx = [];
  const n = pts.length;
  for (let k = 0; k < n; k++) {
    const a = 1 + k;
    const b = 1 + ((k + 1) % n);
    // (flat()'s rectangle, (x0, z0) (x0, z1) (x1, z1), has a negative sum here and faces up in that order.)
    if (area < 0) idx.push(0, a, b);
    else idx.push(0, b, a);
  }
  pts = all;
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(pts.flat(), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return tintGeometry(g, f ? (x, yy, z) => f(x, z) : null);
}

/** An outline in the x-y plane carried from z0 to z1. */
function extrude(points, z0, z1, k = 1) {
  const s = new Shape(points.map(([x, y]) => new Vector2(x, y)));
  const g = new ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1, steps: 1 });
  g.deleteAttribute('uv');
  g.translate(0, 0, z0);
  g.computeVertexNormals();
  boxUV(g);
  return tintGeometry(g, (x, y) => k * grime(y));
}

/** An arched opening's outline in x-y: from (x0, y0) up to the springing, round, down. */
function archOutline(cx, y0, w, spring, n) {
  const r = w / 2;
  const pts = [[cx - r, y0], [cx + r, y0], [cx + r, spring]];
  for (let k = 1; k < n; k++) {
    const t = (k / n) * Math.PI;
    pts.push([cx + Math.cos(t) * r, spring + Math.sin(t) * r]);
  }
  pts.push([cx - r, spring]);
  return pts;
}

/**
 * Rings spreading on the water where a fall lands at (x, y, z): an annulus
 * with its v along the radius (ringMaterial scrolls it outward) fading at
 * both edges by its colours' alpha.
 */
function rings(x, y, z, inner, outer, lod) {
  const seg = lod ? 14 : 28;
  const n = lod ? 2 : 4;
  const pos = [];
  const uv = [];
  const col = [];
  const idx = [];
  for (let j = 0; j <= n; j++) {
    const r = inner + ((outer - inner) * j) / n;
    const alpha = smoothstep(inner, inner + 0.04, r) * (1 - smoothstep(outer * 0.5, outer, r));
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      pos.push(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
      uv.push((k / seg) * 1.2, r * 2.4);
      col.push(1, 1, 1, alpha);
    }
  }
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < seg; k++) {
      const a = j * (seg + 1) + k;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(pos.map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

/** The castellum's materials: the aqueduct's stones of the look, and its water, lead, bronze, timber and tiles. */
export function castellumMaterials(look, ice = false) {
  const A = aqueductMaterials(look);
  const r = ruralMaterials();
  return {
    ...A,
    pool: poolWater(),
    puddle: ice ? iceMaterial() : stagnantMaterial(),
    deep: material('castellum-deep', { color: 0x2c4a44, roughness: 0.95, snow: 0, wet: 0 }),
    stream: streamMaterial(true),
    ring: ringMaterial(),
    lead: material('lead', { color: 0x6f7173, roughness: 0.55, metalness: 0.7, snow: 0.7 }),
    bronze: material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }),
    tile: r.tile,
    wood: r.wood,
    dark: r.dark,
  };
}

// ------------------------------------------------------------------ the tank

/** The podium (two steps, paved) and the tank's walls, lining, coping and floor. */
function tank(P, M, lod, seed) {
  const [sH, sY] = RES.step;
  const [pH, pY] = RES.plat;
  const o = RES.tankOut;
  const i = RES.tankIn;
  P.add('foot', M.foot, box(-sH, sH, 0, sY, -sH, sH, 0.9));
  // The podium's body under its paving; at the full detail its top is flags.
  const top = lod === 0 ? pY - 0.05 : pY;
  // (A ring round the tank: its top stood over the tank's floor and showed through the water as a pavement.)
  P.add('foot', M.foot, [
    box(-pH, pH, sY, top, o, pH, 0.95), box(-pH, pH, sY, top, -pH, -o, 0.95),
    box(o, pH, sY, top, -o, o, 0.95), box(-pH, -o, sY, top, -o, o, 0.95),
  ]);
  if (lod === 0) {
    const skip = (x, z) => Math.abs(x) < o - 0.02 && Math.abs(z) < o - 0.02;
    P.add('paving', M.dressed, paving(-pH, pH, -pH, pH, 0.05, seed + 3, { skip, rowW: 0.7, minL: 0.6, maxL: 1.2, lod }).map((g) => g.translate(0, top, 0)));
  }
  // The walls, from under the floor to the coping.
  const walls = [
    box(-o, o, RES.floor - 0.15, RES.wallTop, i, o), box(-o, o, RES.floor - 0.15, RES.wallTop, -o, -i),
    box(i, o, RES.floor - 0.15, RES.wallTop, -i, i), box(-o, -i, RES.floor - 0.15, RES.wallTop, -i, i),
  ];
  P.add('body', M.body, walls);
  const c0 = i - 0.03;
  const c1 = o + RES.copeOut;
  const cy = [RES.wallTop, RES.wallTop + RES.coping];
  P.add('dressed', M.dressed, [
    box(-c1, c1, cy[0], cy[1], c0, c1), box(-c1, c1, cy[0], cy[1], -c1, -c0),
    box(c0, c1, cy[0], cy[1], -c0, c0), box(-c1, -c0, cy[0], cy[1], -c0, c0),
  ]);
  // The lining: the floor, the walls' inner faces (a band of sinter where the water stands), the fillets.
  const t = 0.04;
  const band = [RES.water - 0.08, RES.water + 0.05];
  const lining = [box(-i, i, RES.floor - 0.12, RES.floor, -i, i, 1, () => 0.92)];
  const skins = (y0, y1, k) => [
    box(-i, i, y0, y1, i - t, i, 1, () => k), box(-i, i, y0, y1, -i, -i + t, 1, () => k),
    box(i - t, i, y0, y1, -i + t, i - t, 1, () => k), box(-i, -i + t, y0, y1, -i + t, i - t, 1, () => k),
  ];
  if (lod < 2) lining.push(...skins(RES.floor, band[0], 0.95), ...skins(band[0], band[1], 1.22), ...skins(band[1], RES.wallTop, 1.02));
  else lining.push(...skins(RES.floor, RES.wallTop, 1));
  if (lod === 0) {
    // The quarter-round fillet (pulvinus) where the floor meets the walls: a wedge along each.
    for (let s = 0; s < 4; s++) {
      const g = extrude([[0, 0], [0.14, 0], [0, 0.14]], -i + t, i - t, 1);
      g.translate(-i + t, RES.floor, 0);
      g.rotateY((-s * Math.PI) / 2);
      lining.push(g);
    }
  }
  P.add('lining', M.lining, lining);
}

/** The water and what the dry tank keeps: the pool, its ice margins, the silt and a puddle. */
function tankStates(P, M, lod, seed) {
  const i = RES.tankIn;
  const z0 = RES.house.z1;
  P.add('pool', M.pool, flat(-i, i, z0, i, RES.water), { when: 'full', cast: false });
  // Under it the depth: the floor dark and green with the water's weight, lighter toward the walls where
  // it shoals (the pool's own glass is clear enough that the bare floor read as a swimming bath).
  const deep = [];
  const cells = lod === 2 ? 1 : 6;
  for (let a = 0; a < cells; a++) {
    for (let b = 0; b < cells; b++) {
      const x0 = -i + (2 * i * a) / cells;
      const x1 = -i + (2 * i * (a + 1)) / cells;
      const za = z0 + ((i - z0) * b) / cells;
      const zb = z0 + ((i - z0) * (b + 1)) / cells;
      deep.push(flat(x0, x1, za, zb, RES.floor + 0.006, (x, z) => {
        const edge = Math.min(i - Math.abs(x), i - z, z - z0);
        return 0.55 + 0.45 * (1 - smoothstep(0, 1.6, edge));
      }));
    }
  }
  P.add('deep', M.deep, deep, { when: 'full', cast: false });
  // Ice creeping in from the walls, ragged at its edge.
  const rnd = artRng(seed + 21);
  const ice = [];
  const n = lod === 0 ? 14 : 6;
  const y = RES.water + 0.004;
  const edge = (a, b, w) => {
    // A strip from a to b ([x, z]), w wide inward, its inner edge ragged.
    const [ax, az] = a;
    const [bx, bz] = b;
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      pts.push([ax + (bx - ax) * f, az + (bz - az) * f]);
    }
    const inner = pts.map(([x, z], k) => {
      const ww = w * (0.55 + 0.6 * rnd()) * (k === 0 || k === n ? 0.6 : 1);
      return [x + nx * ww, z + nz * ww];
    });
    for (let k = 0; k < n; k++) ice.push(flatPoly([pts[k], pts[k + 1], inner[k + 1], inner[k]], y));
  };
  // (Round the tank's four walls and the house's face, inward: corners go anticlockwise seen from above.)
  edge([-i, i], [i, i], 0.42);
  edge([i, i], [i, z0], 0.42);
  edge([i, z0], [RES.house.x, z0], 0.36);
  edge([-RES.house.x, z0], [-i, z0], 0.36);
  edge([-i, z0], [-i, i], 0.42);
  P.add('ice', M.ice, ice, { when: 'ice', cast: false });
  // Dry: silt over the floor in drifts, a puddle in its low corner.
  const silt = [];
  const drifts = lod === 2 ? 2 : 6;
  for (let k = 0; k < drifts; k++) {
    const cx = -i + 0.6 + rnd() * (2 * i - 1.2);
    const cz = z0 + 0.6 + rnd() * (i - z0 - 1.2);
    const r = 0.6 + rnd() * 1.1;
    const pts = [];
    const m = lod === 2 ? 6 : 12;
    for (let j = 0; j < m; j++) {
      const a = (j / m) * Math.PI * 2;
      const rr = r * (0.7 + 0.5 * rnd());
      pts.push([Math.max(-i, Math.min(i, cx + Math.cos(a) * rr)), Math.max(z0, Math.min(i, cz + Math.sin(a) * rr * 0.7))]);
    }
    silt.push(flatPoly(pts, RES.floor + 0.004 + k * 0.001, (x, z) => 0.75 + 0.3 * Math.abs(Math.sin(x * 3.1 + z * 2.3))));
  }
  P.add('silt', M.silt, silt, { when: 'dry', cast: false });
  const pts = [];
  for (let j = 0; j < (lod === 2 ? 7 : 16); j++) {
    const a = (j / (lod === 2 ? 7 : 16)) * Math.PI * 2;
    const rr = 1 + 0.25 * Math.sin(a * 3 + 1.1);
    pts.push([-i + 1.5 + Math.cos(a) * 1.1 * rr, i - 1.3 + Math.sin(a) * 0.8 * rr]);
  }
  P.add('puddle', M.puddle, flatPoly(pts, RES.floor + 0.012), { when: 'dry', cast: false });
}

// ------------------------------------------------------------------ the house

/** The castellum divisorium over the tank's back wall: its walls, roof, outlets, tablet, door and pipes. */
function house(P, M, lod, seed) {
  const { x: hx, z0, z1, eave } = RES.house;
  P.add('body', M.body, box(-hx, hx, RES.floor - 0.15, eave, z0, z1));
  const dressed = [];
  const dark = [];
  const bronze = [];
  // Its gable ends: the pediments over the eaves, front and back.
  const pitch = (22 * Math.PI) / 180;
  const ridge = eave + hx * Math.tan(pitch);
  for (const z of [z1, z0]) {
    const g = extrude([[-hx, eave], [hx, eave], [0, ridge]], -0.2, 0.2);
    g.translate(0, 0, z + (z === z1 ? -0.2 : 0.2));
    P.add('body', M.body, g);
  }
  const roof = gableRoof({ x0: -hx, x1: hx, z0, z1, eaveY: eave, along: 'z', lod, seed: seed + 5, over: 0.3, gableOver: 0.18 });
  P.add('roof', M.tile, roof.tile);
  P.add('timber', M.wood, roof.wood);
  if (lod < 2) {
    // The cornice under the eaves, and quoins at its corners.
    dressed.push(box(-hx - 0.07, hx + 0.07, eave - 0.14, eave, z0 - 0.07, z1 + 0.07));
    for (const sx of [-1, 1]) {
      for (const z of [z0, z1]) {
        const x0 = sx > 0 ? hx - 0.22 : -hx - 0.02;
        const zz = z === z1 ? [z1 - 0.22, z1 + 0.02] : [z0 - 0.02, z0 + 0.22];
        dressed.push(box(x0, x0 + 0.24, RES.wallTop, eave - 0.14, zz[0], zz[1]));
      }
    }
  }
  // The three outlets in its face toward the tank, at the water line, behind bronze grilles.
  const n = lod === 0 ? 10 : 6;
  for (const x of [-0.85, 0, 0.85]) {
    const w = 0.44;
    const sill = RES.water - 0.32;
    const spring = RES.water + 0.08;
    const g = extrude(archOutline(x, sill, w, spring, n), z1 - 0.02, z1 + 0.012);
    dark.push(g);
    if (lod < 2) {
      // The ring of voussoirs round it, one block for each segment.
      const ring = [];
      const rr = w / 2;
      for (let k = 0; k < (lod === 0 ? 5 : 3); k++) {
        const a0 = (k / (lod === 0 ? 5 : 3)) * Math.PI;
        const a1 = ((k + 1) / (lod === 0 ? 5 : 3)) * Math.PI;
        const pts = [[Math.cos(a0) * rr, Math.sin(a0) * rr], [Math.cos(a0) * (rr + 0.14), Math.sin(a0) * (rr + 0.14)], [Math.cos(a1) * (rr + 0.14), Math.sin(a1) * (rr + 0.14)], [Math.cos(a1) * rr, Math.sin(a1) * rr]];
        ring.push(extrude(pts.map(([px, py]) => [px + x, py + spring]), z1 - 0.01, z1 + 0.04));
      }
      dressed.push(...ring);
      // The grille: bronze bars across the opening.
      for (let b = -2; b <= 2; b++) {
        const bar = new CylinderGeometry(0.012, 0.012, spring + rr * 0.8 - sill, 5, 1);
        bar.translate(x + b * 0.075, (sill + spring + rr * 0.8) / 2, z1 + 0.03);
        bronze.push(tintGeometry(boxUV(bar)));
      }
      bronze.push(box(x - w / 2, x + w / 2, spring - 0.02, spring + 0.01, z1 + 0.015, z1 + 0.045, 1, () => 1));
    }
  }
  // The blank tablet over the outlets, framed.
  if (lod < 2) {
    const ty = [2.3, 2.9];
    dressed.push(box(-0.8, 0.8, ty[0], ty[1], z1, z1 + 0.04));
    for (const [a, b, c, d] of [[-0.86, 0.86, ty[0] - 0.06, ty[0]], [-0.86, 0.86, ty[1], ty[1] + 0.06], [-0.86, -0.8, ty[0], ty[1]], [0.8, 0.86, ty[0], ty[1]]]) dressed.push(box(a, b, c, d, z1, z1 + 0.07));
  }
  // The aquarius's door on its +x side, over the podium behind the tank.
  const dz = [-5.28, -4.72];
  dark.push(box(hx - 0.02, hx + 0.01, RES.plat[1], RES.plat[1] + 1.8, dz[0], dz[1]));
  P.add('door', M.wood, box(hx - 0.01, hx + 0.03, RES.plat[1] + 0.02, RES.plat[1] + 1.76, dz[0] + 0.04, dz[1] - 0.04, 1, (x, y, z) => 0.75 + 0.15 * Math.abs(Math.sin(z * 40))));
  if (lod < 2) {
    dressed.push(box(hx, hx + 0.06, RES.plat[1] + 1.8, RES.plat[1] + 1.95, dz[0] - 0.12, dz[1] + 0.12));
    for (const z of dz) dressed.push(box(hx, hx + 0.05, RES.plat[1], RES.plat[1] + 1.8, z - (z === dz[0] ? 0.1 : 0), z + (z === dz[1] ? 0.1 : 0)));
  }
  P.add('dressed', M.dressed, dressed);
  P.add('dark', M.dark, dark, { cast: false });
  // The three lead pipes out of its back, down to the podium and into the ground, each with a stopcock.
  const lead = [];
  for (const x of [-0.75, 0, 0.75]) {
    const r = 0.065;
    const pts = [[x, 1.05, z0 + 0.05], [x, 1.05, z0 - 0.12], [x, RES.plat[1] + r + 0.02, z0 - 0.2], [x, RES.plat[1] + r, -RES.plat[0] + 0.15], [x, RES.plat[1] - 0.05, -RES.plat[0] - 0.08], [x, -0.1, -RES.plat[0] - 0.12]];
    if (lod === 2) {
      lead.push(box(x - r, x + r, RES.plat[1], RES.plat[1] + 2 * r, -RES.plat[0] - 0.1, z0, 1, () => 1));
      continue;
    }
    lead.push(tintGeometry(tube(pts.map(([a, b, c]) => [a, b, c]), r, { radial: lod === 0 ? 10 : 6, segments: lod === 0 ? 24 : 12, tension: 0.2 })));
    // The stopcock (epitonium): a bronze barrel on the run, its key on top.
    const cock = new CylinderGeometry(r * 1.6, r * 1.6, 0.18, lod === 0 ? 12 : 8, 1);
    cock.rotateX(Math.PI / 2);
    cock.translate(x, RES.plat[1] + r, z0 - 0.5);
    bronze.push(tintGeometry(boxUV(cock)));
    if (lod === 0) bronze.push(box(x - 0.015, x + 0.015, RES.plat[1] + r * 2.4, RES.plat[1] + r * 2.4 + 0.1, z0 - 0.52, z0 - 0.48, 1, () => 1), box(x - 0.08, x + 0.08, RES.plat[1] + r * 2.4 + 0.1, RES.plat[1] + r * 2.4 + 0.13, z0 - 0.52, z0 - 0.48, 1, () => 1));
  }
  P.add('lead', M.lead, lead);
  P.add('bronze', M.bronze, bronze);
}

// ------------------------------------------------------------------ the towers, the overflows

/** A water tower (castellum secundarium) at the back corner (sx, -1): a pier with a lead tank on it and pipes. */
function waterTower(P, M, sx, lod) {
  const { at, half, top } = RES.tower;
  const x = sx * at;
  const z = -at;
  P.add('body', M.body, box(x - half, x + half, RES.plat[1] - 0.05, top, z - half, z + half));
  const dressed = [box(x - half - 0.06, x + half + 0.06, top, top + 0.13, z - half - 0.06, z + half + 0.06)];
  if (lod < 2) {
    for (const y of [1.55, 2.75]) dressed.push(box(x - half - 0.02, x + half + 0.02, y, y + 0.12, z - half - 0.02, z + half + 0.02));
    dressed.push(box(x - half - 0.08, x + half + 0.08, RES.plat[1] - 0.05, RES.plat[1] + 0.22, z - half - 0.08, z + half + 0.08, 0.9));
  }
  P.add('dressed', M.dressed, dressed);
  // The lead tank: four sides and a floor, open to the sky (water in it while the castellum is full).
  const t0 = top + 0.13;
  const t1 = t0 + 0.6;
  const h = 0.4;
  const w = 0.04;
  const lead = lod === 2
    ? [box(x - h, x + h, t0, t1, z - h, z + h, 1, () => 1)]
    : [
      box(x - h, x + h, t0, t1, z + h - w, z + h, 1, () => 1), box(x - h, x + h, t0, t1, z - h, z - h + w, 1, () => 1),
      box(x + h - w, x + h, t0, t1, z - h + w, z + h - w, 1, () => 1), box(x - h, x - h + w, t0, t1, z - h + w, z + h - w, 1, () => 1),
      box(x - h, x + h, t0, t0 + 0.05, z - h, z + h, 1, () => 1),
      // The rolled rim round its top.
      box(x - h - 0.02, x + h + 0.02, t1 - 0.03, t1 + 0.01, z - h - 0.02, z + h + 0.02, 1, () => 0.9),
    ];
  // The pipes in their grooves: up its outer face from the ground, down its inner face to the town.
  const r = 0.055;
  for (const [px, pz, y0] of [[x + sx * (half + r), z, -0.05], [x, z + half + r, RES.plat[1] - 0.05]]) {
    const p = new CylinderGeometry(r, r, t0 + 0.25 - y0, lod === 0 ? 10 : 6, 1);
    p.translate(px, (t0 + 0.25 + y0) / 2, pz);
    lead.push(tintGeometry(boxUV(p), () => 0.95));
  }
  P.add('lead', M.lead, lead);
  if (lod < 2) P.add('tower-water', M.pool, flat(x - h + w, x + h - w, z - h + w, z + h - w, t1 - 0.08), { when: 'full', cast: false });
}

/** The overflow on the +x side (sx 1) or -x (sx -1): a stone spout running into a trough on the podium. */
function overflow(P, M, sx, lod) {
  const z = sx * RES.spout.z;
  const o = RES.tankOut;
  const y = RES.spout.y;
  const parts = [];
  const g = (x0, x1, y0, y1, z0, z1, k = 1) => box(sx > 0 ? x0 : -x1, sx > 0 ? x1 : -x0, y0, y1, z0, z1, k);
  // The spout: a block standing out of the wall, its channel cut along its top.
  parts.push(g(o - 0.02, o + 0.36, y - 0.12, y - 0.02, z - 0.13, z + 0.13), g(o - 0.02, o + 0.36, y - 0.02, y + 0.06, z - 0.13, z - 0.06), g(o - 0.02, o + 0.36, y - 0.02, y + 0.06, z + 0.06, z + 0.13));
  // The trough on the podium: a floor and four sides.
  const tx = [o + 0.42, RES.plat[0] - 0.06];
  const tz = [z - 0.42, z + 0.42];
  const ty = [RES.plat[1], RES.plat[1] + 0.34];
  parts.push(g(tx[0], tx[1], ty[0], ty[0] + 0.06, tz[0], tz[1]));
  parts.push(g(tx[0], tx[1], ty[0], ty[1], tz[0], tz[0] + 0.07), g(tx[0], tx[1], ty[0], ty[1], tz[1] - 0.07, tz[1]));
  parts.push(g(tx[0], tx[0] + 0.07, ty[0], ty[1], tz[0] + 0.07, tz[1] - 0.07), g(tx[1] - 0.07, tx[1], ty[0], ty[1], tz[0] + 0.07, tz[1] - 0.07));
  P.add('dressed', M.dressed, parts);
  const wx = sx > 0 ? [tx[0] + 0.07, tx[1] - 0.07] : [-tx[1] + 0.07, -tx[0] - 0.07];
  P.add('trough', M.pool, flat(wx[0], wx[1], tz[0] + 0.07, tz[1] - 0.07, ty[1] - 0.05), { when: 'full', cast: false });
  // The fall from the spout's lip into the trough.
  const f = fall(o + 0.36, y, ty[1] - 0.05, 0.05, lod);
  f.translate(0, 0, z);
  if (sx < 0) f.rotateY(Math.PI);
  P.add('fall', M.stream, f, { when: 'flow', cast: false });
  if (lod < 2) {
    const ringZ = sx > 0 ? z : -z;
    const rg = rings(o + 0.48, ty[1] - 0.045, ringZ, 0.03, 0.26, lod);
    if (sx < 0) rg.rotateY(Math.PI);
    P.add('rings', M.ring, rg, { when: 'flow', cast: false });
  }
}

/**
 * The castellum: { group, meshes, triangles }. `look` the province's stone
 * (aqueducts/aqueductLayout.js AQUEDUCT_LOOKS), `ice` its frosty look.
 */
export function buildCastellum({ look = 'lime', lod = 0, ice = false, seed = 31 } = {}) {
  const M = castellumMaterials(look, ice);
  const P = new TaggedParts(`castellum:${look}`);
  tank(P, M, lod, seed);
  tankStates(P, M, lod, seed);
  house(P, M, lod, seed);
  waterTower(P, M, 1, lod);
  waterTower(P, M, -1, lod);
  overflow(P, M, 1, lod);
  overflow(P, M, -1, lod);
  return P.build();
}

// ------------------------------------------------------------------ inlets and intakes

/**
 * An aqueduct's inlet on the +x face at the middle tile (models.js turns
 * and moves it to its face and tile): the channel at AQ.inlet on a wall
 * from the footprint's edge across the podium to the tank, over its coping
 * and pouring in ('pour'), or (`house`) running into the castellum's house
 * through its back wall. Its water shows while that aqueduct runs.
 */
export function buildInlet({ look = 'lime', lod = 0, house: intoHouse = false } = {}) {
  const M = castellumMaterials(look);
  const P = new TaggedParts(`castellum-inlet:${look}`);
  const H = RES.half;
  const o = AQ.hw;
  const i = AQ.ch;
  const f = AQ.inlet;
  const bed = AQ.floor - AQ.course[0];
  const wallH = AQ.wallTop - AQ.floor;
  // Where the channel ends: over the tank's water, or at the house's back wall.
  const end = intoHouse ? -RES.house.z0 : RES.tankIn - 0.12;
  const wallEnd = intoHouse ? end : RES.tankIn + 0.05;
  const bodyEnd = intoHouse ? end : RES.tankOut;
  P.add('body', M.body, [box(bodyEnd, H, 0, f - bed, -o, o)]);
  const body = [];
  const lining = [];
  const coping = [];
  for (const sz of [1, -1]) {
    const [z0, z1] = sz > 0 ? [i + AQ.liner, o] : [-o, -i - AQ.liner];
    body.push(box(wallEnd, H, f - bed, f + wallH, z0, z1));
    lining.push(box(wallEnd, H, f - bed, f + wallH, sz > 0 ? i : -i - AQ.liner, sz > 0 ? i + AQ.liner : -i, 1, () => 1.05));
    coping.push(box(wallEnd, H, f + wallH, f + wallH + AQ.coping, sz > 0 ? i : -o - AQ.copeOut, sz > 0 ? o + AQ.copeOut : -i));
  }
  // Its floor, on to the lip over the tank (a bed over the coping where the wall is not).
  lining.push(box(end, H, f - bed, f, -i, i, 1, () => 0.9));
  if (!intoHouse) lining.push(box(end, RES.tankOut, RES.wallTop + RES.coping, f - bed, -i - 0.06, i + 0.06, 1, () => 0.9));
  P.add('body', M.body, body);
  P.add('lining', M.lining, lining);
  P.add('dressed', M.dressed, coping);
  if (lod < 2 && !intoHouse) {
    // The sluice: two grooved posts and a bronze gate drawn up between them.
    P.add('dressed', M.dressed, [box(RES.tankOut + 0.1, RES.tankOut + 0.22, f + wallH, f + wallH + 0.55, -o, -i + 0.02), box(RES.tankOut + 0.1, RES.tankOut + 0.22, f + wallH, f + wallH + 0.55, i - 0.02, o), box(RES.tankOut + 0.06, RES.tankOut + 0.26, f + wallH + 0.55, f + wallH + 0.68, -o - 0.04, o + 0.04)]);
    P.add('bronze', M.bronze, box(RES.tankOut + 0.14, RES.tankOut + 0.18, f + wallH - 0.05, f + wallH + 0.5, -i, i, 1, () => 0.9));
  }
  // The water along it, and its pour into the tank with the rings where it lands.
  P.add('water', M.water, flat(end, H, -i, i, f + 0.1), { when: 'full', cast: false });
  P.add('silt', M.silt, flat(end, H, -i, i, f + 0.004), { when: 'dry', cast: false });
  if (!intoHouse) {
    const g = fall(-end, f + 0.1, RES.water + 0.002, i - 0.03, lod);
    g.rotateY(Math.PI);
    P.add('pour', M.stream, g, { when: 'flow', cast: false });
    if (lod < 2) P.add('rings', M.ring, rings(end - 0.16, RES.water + 0.004, 0, 0.05, 0.6, lod), { when: 'flow', cast: false });
  }
  return P.build();
}

/** An intake from open water on the +x face's middle: a culvert mouth through the podium behind a bronze grille. */
export function buildIntake({ look = 'lime', lod = 0 } = {}) {
  const M = castellumMaterials(look);
  const P = new TaggedParts(`castellum-intake:${look}`);
  const x = RES.plat[0];
  const w = 0.72;
  const top = RES.plat[1] - 0.04;
  // The mouth: dark under a stone lintel, its sill the water's.
  P.add('dark', M.dark, box(x - 0.02, x + 0.31, 0.02, top - 0.08, -w / 2, w / 2), { cast: false });
  P.add('dressed', M.dressed, [box(x - 0.02, x + 0.34, top - 0.08, top + 0.04, -w / 2 - 0.12, w / 2 + 0.12), box(x + 0.3, RES.half, 0, 0.08, -w / 2 - 0.12, w / 2 + 0.12)]);
  if (lod < 2) {
    const bars = [];
    for (let b = -3; b <= 3; b++) bars.push(box(x + 0.31, x + 0.34, 0.06, top - 0.08, b * 0.1 - 0.012, b * 0.1 + 0.012, 1, () => 1));
    P.add('bronze', M.bronze, bars);
  }
  P.add('water', M.pool, flat(x + 0.3, RES.half, -w / 2, w / 2, 0.11), { when: 'full', cast: false });
  return P.build();
}
