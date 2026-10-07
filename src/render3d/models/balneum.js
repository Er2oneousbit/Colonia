/**
 * models/balneum.js
 * ----------------------------------------------------------------------------
 * The baths of the 3D look: a balneum, a small neighbourhood bath on a 2 x 2
 * footprint (8 m), from the record rather than from the 2D sprite:
 *
 *   - Pompeii's Stabian and Forum baths and the little Sarno and Republican
 *     baths: a palaestra (an exercise court, part sand, with a portico) and
 *     a cold swimming pool (natatio) before the bath block; a round, domed
 *     room (the Stabian frigidarium, once a laconicum, its cone of a dome
 *     open at the top); the caldarium, the hot room, a barrel vault over it
 *     to keep its steam, its window toward the afternoon sun (Vitruvius
 *     5.10: the hot rooms face the winter sunset, the vaults lined, the
 *     laconicum round with an opening at the top).
 *   - The heat came from a furnace (praefurnium) in a service yard behind:
 *     a stoker (fornacator) fed it wood; over it stood the bronze boilers;
 *     its hot air ran under the floors, raised on piles of brick (pilae:
 *     the hypocaust, Vitruvius's suspensurae), and up the walls through box
 *     flue tiles (tubuli) to vents at the eaves, where it smoked.
 *   - The bathers: Seneca (Letters 56) on the noise over a bath, the ball
 *     players counting their throws, the man scraping off oil and sweat
 *     with his strigil, the plunge into the pool; a slave (capsarius)
 *     minding the clothes; Martial on the mixed crowd. Bathing was the
 *     afternoon's: lamps lit them into the evening.
 *
 * So, in 8 m: at the back, the vaulted caldarium in brick with its arched
 * window, the round domed room beside it on its square block, a portico of
 * red-and-white columns along both under a lean-to of tiles, doors into
 * each; behind the caldarium's end, the service yard: the furnace's arched
 * mouth with its coals, the boiler on its base, the firewood, a flue stack,
 * a hole in the wall showing the pilae of the hypocaust; before them the
 * palaestra of sand, ball players, a man with his strigil by a labrum,
 * benches, stone bowling balls, and the raised pool with its bronze spout;
 * a low wall to the street, the gate between piers under BALNEVM, lanterns.
 *
 * States (meshes tagged in userData.when, models.js partShows), from piped
 * water and staff as the 2D sprite and the fountain read them:
 *   'flowing'  water and staff: the bathers, the furnace's coals, smoke at
 *              the flue and the vents, the spout running into the pool, the
 *              doors open, the lanterns lit at night; steam from the dome's
 *              top, the window and the vents in a hard frost ('ice')
 *   'still'    water, no staff: the pool full and still, the furnace cold,
 *              the doors shut, nobody
 *   'dry'      no water: the pool empty, dust and dead leaves on its floor,
 *              the furnace cold, the doors shut
 * In a hard frost ('baths:ice') the pool's water is ice, and nobody is in it.
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z,
 * as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BufferGeometry, Float32BufferAttribute, CylinderGeometry, SphereGeometry, BoxGeometry, Shape, Path, ExtrudeGeometry, Vector3 } from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { material, shallowWaterMaterial, streamMaterial, iceMaterial } from '../materials.js';
import { slab, paving, tuscanColumn, wallWithOpenings, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin, woodpile, ruralMaterials, leanTo } from './rural.js';
import { staff, inscribe, people } from './castra.js';
import { person, roofSlope, box } from './learning.js';
import { healthMaterials, steamMaterial, plume, towel, coals } from './healing.js';

/** The baths' measures (metres): the tests, the lab and the game read them. */
export const BALNEUM = Object.freeze({
  half: 4,
  /** The caldarium: x0..x1, z0..z1 (its walls' outer faces), the vault's springing. */
  caldarium: Object.freeze({ x0: -1.25, x1: 2.85, z0: -3.9, z1: -1.15, spring: 2.45 }),
  /** The round room: its middle (x, z), its square block's top, the dome's foot radius and its top. */
  tholos: Object.freeze({ x: -2.575, z: -2.525, block: 2.3, r: 1.18, top: 3.72 }),
  /** The portico: its columns' line (z), its eave's height, its floor's. */
  portico: Object.freeze({ z: -0.02, eave: 2.12, floor: 0.14 }),
  /** The pool: x0..x1, z0..z1 (its walls' outer faces), its rim's height, its water's. */
  pool: Object.freeze({ x0: 0.35, x1: 3.5, z0: 0.8, z1: 3.2, rim: 0.88, water: 0.8 }),
  /** The furnace's mouth in the caldarium's end wall: its middle (z), width, height. */
  furnace: Object.freeze({ z: -2.25, w: 0.56, h: 0.42 }),
  /** The gate in the street wall (x), its piers' height. */
  gate: Object.freeze([-2.55, -1.45]),
  gateH: 2.25,
  /** The lanterns hung in the gateway from its lintel (x, y, z), facing the street. */
  lamps: Object.freeze([Object.freeze([-2.32, 1.66, 3.82]), Object.freeze([-1.68, 1.66, 3.82])]),
  /** The caldarium's window, high in its end wall (x, y, z), facing +x: lit at night while the baths work. */
  window: Object.freeze([2.87, 3.0, -2.525]),
});

const B = BALNEUM;
const H = 3.93;
const RED = lin(0xa83a26);
/** The street wall's and the side walls' height. */
const LOW = 1.05;
/** The hypocaust's inspection hole in the caldarium's end wall (its middle, z). */
const HYPO = -1.62;

/** Paint the lower part (under y) of a column's geometries red, as Pompeii's stuccoed columns. */
function redBelow(geos, y) {
  for (const g of geos) {
    const c = g.attributes.color;
    const p = g.attributes.position;
    for (let i = 0; i < c.count; i++) if (p.getY(i) < y) c.setXYZ(i, c.getX(i) * RED[0] * 1.6, c.getY(i) * RED[1] * 1.6, c.getZ(i) * RED[2] * 1.6);
  }
  return geos;
}

/**
 * A barrel vault's outer shell over x0..x1, its axis along x at (yc, zc),
 * radius r: the upper half of a cylinder, UVs in metres (along x, round the
 * arc), a vertex colour of `k`, darker toward its foot (rain runs down it).
 */
function vault(x0, x1, yc, zc, r, seg, k = 1) {
  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  const idx = [];
  for (let j = 0; j <= seg; j++) {
    const a = (j / seg) * Math.PI;
    const ny = Math.sin(a);
    const nz = Math.cos(a);
    for (const x of [x0, x1]) {
      pos.push(x, yc + r * ny, zc + r * nz);
      nor.push(0, ny, nz);
      uv.push(x, a * r);
      const t = k * (0.82 + 0.18 * ny);
      col.push(t, t, t);
    }
  }
  for (let j = 0; j < seg; j++) {
    const q = j * 2;
    idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

/**
 * The lunette over a vault's end: a half disc of wall, radius r, `t` thick,
 * its face toward +x at x (or -x: `face` -1), its middle at (yc, zc); an
 * arched window through it (w wide, its sill at wy0, its head's springing
 * at wy1) if given. Returns a geometry with UVs in metres.
 */
function lunette(x, yc, zc, r, t, face, seg, win = null) {
  const s = new Shape();
  s.moveTo(-r, 0);
  for (let k = 0; k <= seg; k++) {
    const a = Math.PI - (k / seg) * Math.PI;
    s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  if (win) {
    const p = new Path();
    const { w, y0, y1 } = win;
    p.moveTo(-w / 2, y0);
    p.lineTo(-w / 2, y1);
    for (let k = 1; k <= 8; k++) {
      const a = Math.PI - (k / 8) * Math.PI;
      p.lineTo(Math.cos(a) * (w / 2), y1 + Math.sin(a) * (w / 2));
    }
    p.lineTo(w / 2, y0);
    p.closePath();
    s.holes.push(p);
  }
  const g = new ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: seg });
  // (Its shape's x across the wall (along z), y up; extruded back along -x from its face.)
  g.translate(0, 0, -t);
  g.rotateY(face > 0 ? Math.PI / 2 : -Math.PI / 2);
  g.translate(x, yc, zc);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return tintGeometry(boxUV(g), () => 0.92);
}

/** The caldarium: its brick walls, the vault, the lunettes (the window in the +x one), the furnace mouth, the vents. */
function caldarium(lod, seed, out) {
  const { x0, x1, z0, z1, spring } = B.caldarium;
  const t = 0.32;
  const zc = (z0 + z1) / 2;
  const r = (z1 - z0) / 2;
  const seg = lod === 2 ? 6 : lod ? 12 : 24;
  // The long walls, brick, to the vault's springing (the front one behind the portico: its doors).
  const door = { x: 1.45, w: 1.0, h: 2.05 };
  out.brick.push(box(x1 - x0, spring, t, (x0 + x1) / 2, 0, z0 + t / 2, 0.95));
  for (const [a, b] of [[x0, door.x - door.w / 2], [door.x + door.w / 2, x1]]) out.brick.push(box(b - a, spring, t, (a + b) / 2, 0, z1 - t / 2, 0.95));
  out.brick.push(box(door.w, spring - door.h - B.portico.floor, t, door.x, B.portico.floor + door.h, z1 - t / 2, 0.95));
  out.dark.push(box(door.w, door.h, 0.02, door.x, B.portico.floor, z1 - t + 0.02));
  out.trav.push(slab(door.w + 0.36, 0.14, t + 0.06, { bevel: 0.012, seed: seed + 5, wobble: 0, tone: 0.04, grime: 0 }).translate(door.x, B.portico.floor + door.h, z1 - t / 2));
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = box(door.w / 2 - 0.01, door.h - 0.02, 0.05, -s * (door.w / 4), 0, 0, 0.72);
      leaf.rotateY(open ? -s * 1.6 : 0);
      leaf.translate(door.x + s * door.w / 2, B.portico.floor, z1 - t + 0.05);
      (open ? out.doorOpen : out.doorShut).push(leaf);
    }
  }
  // A cornice of tiles at the springing, along both sides.
  for (const z of [z0, z1]) out.tile.push(box(x1 - x0 + 0.1, 0.07, 0.12, (x0 + x1) / 2, spring - 0.02, z + Math.sign(z - zc) * 0.04, 0.85));
  // The end walls: the -x one against the round room's block; the +x one over the yard, with the
  // furnace's arched mouth and the hypocaust's inspection hole at its foot.
  const F = B.furnace;
  for (const [x, face] of [[x0 + t / 2, -1], [x1 - t / 2, 1]]) {
    const ops = face > 0 ? [{ x: -(F.z - zc), w: F.w, h: F.h, arch: true }, { x: -(HYPO - zc), w: 0.62, h: 0.34 }] : [];
    const g = wallWithOpenings(z1 - z0, spring, t, ops, { lod });
    // (Built along x facing +z: turned so it runs along z facing +x, or -x.)
    g.translate(0, 0, t / 2);
    g.rotateY(face > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(x, 0, zc);
    out.brick.push(g);
  }
  // The vault: its outer shell, rendered over (buildBalneum gives it its two materials, cold and warm).
  out.warmVault.push(vault(x0 - 0.04, x1 + 0.04, spring, zc, r + 0.02, seg, 0.95));
  const win = { w: 0.62, y0: 0.32, y1: 0.78 };
  out.brick.push(lunette(x0, spring, zc, r - 0.02, t, -1, seg));
  out.brick.push(lunette(x1, spring, zc, r - 0.02, t, 1, seg, win));
  // The window: panes of glass (Roman baths were glazed: the Forum baths' panes in bronze frames), a bronze glazing bar.
  const [wx, , wz] = B.window;
  const wy = spring + win.y0;
  const glass = new BoxGeometry(0.03, win.y1 - win.y0 + win.w / 2, win.w);
  glass.translate(wx - 0.18, wy + (win.y1 - win.y0 + win.w / 2) / 2, wz);
  out.glass.push(tintGeometry(boxUV(glass)));
  if (lod < 2) {
    out.bronze.push(box(0.04, 0.03, win.w, wx - 0.16, wy + (win.y1 - win.y0) * 0.55, wz, 0.8), box(0.04, win.y1 - win.y0 + win.w / 2, 0.03, wx - 0.16, wy, wz, 0.8));
    out.trav.push(slab(0.16, 0.05, win.w + 0.14, { bevel: 0.008, seed: seed + 8, wobble: 0, tone: 0, grime: 0 }).translate(x1 + 0.0, wy - 0.05, wz));
  }
  // The furnace's mouth: dark within, its coals (staffed) or ash (cold); a brick apron before it.
  out.dark.push(box(0.02, F.h + F.w / 2, F.w, x1 - t + 0.03, 0, F.z));
  const c = coals(x1 - 0.2, 0.0, F.z, F.w / 2 - 0.06, { seed: seed + 41, lod });
  out.coalsLit.push(...c.hot);
  out.coalsCold.push(...c.hot.map((g) => g.clone()));
  out.charcoal.push(...c.dark);
  out.brick.push(box(0.5, 0.04, F.w + 0.3, x1 + 0.25, 0, F.z, 0.7));
  // Through the inspection hole: the pilae under the floor, stacks of square bricks in the dark.
  out.dark.push(box(0.02, 0.34, 0.62, x1 - t + 0.04, 0, HYPO));
  if (lod < 2) for (const dz of [-0.17, 0.17]) out.brick.push(box(0.18, 0.32, 0.18, x1 - t + 0.2, 0, HYPO + dz, 0.55));
  // The flue tiles' vents at the vault's foot, terracotta pipe ends sooted at their tops.
  if (lod < 2) {
    for (const x of [-0.6, 0.6, 1.8]) {
      for (const z of [z0 + 0.12, z1 - 0.1]) {
        out.vents.push(tintGeometry(boxUV(new CylinderGeometry(0.06, 0.065, 0.32, lod ? 6 : 10, 1, true).translate(x, spring + 0.16, z)), (px, py) => (py > spring + 0.24 ? 0.35 : 0.9)));
        out.dark.push(box(0.1, 0.01, 0.1, x, spring + 0.3, z));
      }
    }
  }
}

/** The round room: its square block, plastered, the terrace on it, the drum and the cone of the dome, its door. */
function tholos(lod, seed, out) {
  const { x, z, block, r, top } = B.tholos;
  const x0 = -H + 0.03;
  const x1 = B.caldarium.x0;
  const z0 = B.caldarium.z0;
  const z1 = B.caldarium.z1;
  const t = 0.3;
  const seg = lod === 2 ? 10 : lod ? 20 : 40;
  const door = { x, w: 0.9, h: 2.0 };
  // The block's walls: back, the -x side, the front with its door (the +x side is the caldarium's end wall).
  out.plaster.push(box(x1 - x0, block, t, (x0 + x1) / 2, 0, z0 + t / 2, 0.93));
  out.plaster.push(box(t, block, z1 - z0 - 2 * t, x0 + t / 2, 0, (z0 + z1) / 2, 0.93));
  for (const [a, b] of [[x0, door.x - door.w / 2], [door.x + door.w / 2, x1]]) out.plaster.push(box(b - a, block, t, (a + b) / 2, 0, z1 - t / 2, 0.93));
  out.plaster.push(box(door.w, block - door.h - B.portico.floor, t, door.x, B.portico.floor + door.h, z1 - t / 2, 0.93));
  out.dark.push(box(door.w, door.h, 0.02, door.x, B.portico.floor, z1 - t + 0.02));
  out.trav.push(slab(door.w + 0.32, 0.14, t + 0.06, { bevel: 0.012, seed: seed + 3, wobble: 0, tone: 0.04, grime: 0 }).translate(door.x, B.portico.floor + door.h, z1 - t / 2));
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = box(door.w / 2 - 0.01, door.h - 0.02, 0.05, -s * (door.w / 4), 0, 0, 0.72);
      leaf.rotateY(open ? -s * 1.6 : 0);
      leaf.translate(door.x + s * door.w / 2, B.portico.floor, z1 - t + 0.05);
      (open ? out.doorOpen : out.doorShut).push(leaf);
    }
  }
  // A red socle round its outside where the camera sees it (the back and the -x side).
  out.red.push(box(x1 - x0, 0.7, 0.012, (x0 + x1) / 2, 0, z0 - 0.006, 1));
  out.red.push(box(0.012, 0.7, z1 - z0, x0 - 0.006, 0, (z0 + z1) / 2, 1));
  // The terrace over the block: signinum, a coping round its edge.
  out.signinum.push(box(x1 - x0, 0.08, z1 - z0, (x0 + x1) / 2, block, (z0 + z1) / 2, 0.9));
  for (const [w, d, cx, cz] of [[x1 - x0, 0.12, (x0 + x1) / 2, z0 + 0.06], [x1 - x0, 0.12, (x0 + x1) / 2, z1 - 0.06], [0.12, z1 - z0, x0 + 0.06, (z0 + z1) / 2]]) {
    out.trav.push(slab(w, 0.1, d, { bevel: 0.01, seed: seed + cx * 3 + cz, wobble: 0, tone: 0.03, grime: 0.2 }).translate(cx, block + 0.06, cz));
  }
  // The drum and the dome: brick below, the cone rendered over, open at its top (the opening that let the steam out).
  const yd = block + 0.08;
  const drum = revolve(profileOf([[r, yd], [r, yd + 0.32], [r + 0.06, yd + 0.34], [r + 0.06, yd + 0.4], [r - 0.02, yd + 0.4]]), { segments: seg, metres: 1, tint: () => 0.92 });
  out.brick.push(drum.translate(x, 0, z));
  const ro = 0.2;
  const prof = [];
  const n = lod === 2 ? 3 : lod ? 6 : 10;
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    // (A cone, a little full: the Stabian frigidarium's conical dome, not a hemisphere.)
    prof.push([r - 0.02 - (r - 0.02 - ro) * u, yd + 0.4 + (top - yd - 0.4) * (u * 0.82 + 0.18 * Math.sin(u * Math.PI / 2))]);
  }
  prof.push([ro + 0.04, top + 0.06], [ro, top + 0.06], [ro - 0.02, top - 0.08]);
  const dome = revolve(prof, { segments: seg, metres: 1, tint: (p) => 0.8 + 0.2 * Math.min(1, (p.y - yd) / 1.0) });
  out.warmVault.push(dome.translate(x, 0, z));
  // The dark of the room under the opening (not the sky through a hollow shell).
  const hole = new CylinderGeometry(ro - 0.02, ro - 0.02, 0.02, lod ? 8 : 16, 1);
  out.dark.push(tintGeometry(boxUV(hole.translate(x, top - 0.1, z))));
}

/** The portico along the front of both: its floor, columns, beam and lean-to roof; benches, pegs and clothes. */
function portico(lod, seed, out) {
  const { z: cz, eave, floor } = B.portico;
  const zb = B.caldarium.z1;
  const x0 = -H + 0.03;
  const x1 = B.caldarium.x1;
  out.floor.push(box(x1 - x0, floor, cz + 0.2 - zb, (x0 + x1) / 2, 0, (zb + cz + 0.2) / 2, 0.95));
  out.trav.push(slab(x1 - x0, floor + 0.01, 0.36, { bevel: 0.012, seed, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate((x0 + x1) / 2, 0, cz + 0.05));
  const colH = eave - 0.22 - floor;
  const n = lod === 2 ? 4 : 6;
  for (let k = 0; k < n; k++) {
    const x = x0 + 0.35 + (k * (x1 - x0 - 0.7)) / (n - 1);
    for (const g of redBelow(tuscanColumn(0.12, colH, lod), 0.8)) out.plaster.push(g.translate(x, floor, cz));
  }
  out.wood.push(box(x1 - x0, 0.22, 0.2, (x0 + x1) / 2, eave - 0.22, cz, 0.85));
  const top = B.caldarium.spring + 0.02;
  const roof = roofSlope([[x0, eave, cz + 0.32], [x1, eave, cz + 0.32], [x1, top, zb], [x0, top, zb]], { lod, seed: seed + 9 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // The end of the portico by the yard: a wall closing it.
  out.plaster.push(box(0.24, eave, cz + 0.2 - zb, x1 - 0.12 + 0.12, 0, (zb + cz + 0.2) / 2, 0.92));
  // Benches along the walls (sheltered), pegs over them for the bathers' clothes.
  for (const [a, b] of [[-1.9, -0.95], [-0.7, 0.85], [2.05, 2.6]]) {
    out.shelter.push(slab(b - a, 0.06, 0.4, { bevel: 0.01, seed: seed + a * 7, wobble: 0, tone: 0.03, grime: 0 }).translate((a + b) / 2, floor + 0.42, zb + 0.24));
    for (const x of [a + 0.12, b - 0.12]) out.shelter.push(box(0.1, 0.42, 0.34, x, floor, zb + 0.22, 0.75));
  }
  if (lod < 2) {
    out.shelter.push(box(1.6, 0.05, 0.05, 0.05, floor + 1.55, zb + 0.04, 0.6));
    for (let k = 0; k < 6; k++) out.shelter.push(box(0.025, 0.025, 0.12, -0.6 + k * 0.26, floor + 1.5, zb + 0.08, 0.5));
  }
}

/** The service yard behind the caldarium's end: the lean-to, the boiler, the firewood, the flue stack, its walls. */
function yard(lod, seed, out) {
  const xw = B.caldarium.x1;
  const z0 = B.caldarium.z0;
  const z1 = B.caldarium.z1;
  out.earth.push(box(H - xw, 0.03, z1 - z0, (xw + H) / 2, 0, (z0 + z1) / 2, 0.85));
  // The lean-to over the boiler, its eave on two posts.
  const span = 0.98;
  const lt = leanTo({ L: 1.6, span, topY: 2.25, eaveY: 1.78, lod, seed: seed + 3, over: 0.0 });
  for (const g of [...lt.tile, ...lt.wood]) {
    g.rotateY(Math.PI / 2);
    g.translate(xw, 0, z0 + 0.82);
  }
  out.tile.push(...lt.tile);
  out.wood.push(...lt.wood);
  for (const z of [z0 + 0.12, z0 + 1.5]) out.wood.push(box(0.12, 1.78, 0.12, xw + span - 0.08, 0, z, 0.7));
  out.wood.push(box(0.12, 0.12, 1.6, xw + span - 0.08, 1.7, z0 + 0.82, 0.7));
  // The boiler: a bronze drum with a domed lid on a brick base, a lead pipe from it into the wall.
  const [bx, bz] = [xw + 0.5, z0 + 0.62];
  out.brick.push(box(0.72, 0.62, 0.72, bx, 0, bz, 0.8));
  const seg = lod === 2 ? 8 : lod ? 12 : 22;
  const boiler = revolve(profileOf([[0, 0], [0.29, 0], [0.31, 0.04], [0.31, 0.62], [0.33, 0.66], [0.26, 0.74], [0.12, 0.8], [0.04, 0.82], [0.05, 0.88], [0, 0.88]]), { segments: seg, metres: 0.3, tint: (p) => 0.55 + 0.45 * Math.min(1, p.y / 0.7) });
  out.bronze.push(boiler.translate(bx, 0.62, bz));
  if (lod < 2) out.lead.push(tube([[bx - 0.25, 1.05, bz], [bx - 0.42, 1.1, bz + 0.05], [xw + 0.02, 1.12, bz + 0.1]], 0.035, { radial: 6, segments: 8 }));
  // The flue stack against the wall in the back corner, capped; its smoke when the fire is in.
  out.brick.push(box(0.36, 3.1, 0.36, xw + 0.2, 0, z0 + 0.2, 0.85));
  out.trav.push(slab(0.46, 0.08, 0.46, { bevel: 0.01, seed: seed + 7, wobble: 0, tone: 0, grime: 0.5 }).translate(xw + 0.2, 3.1, z0 + 0.2));
  out.dark.push(box(0.2, 0.01, 0.2, xw + 0.2, 3.19, z0 + 0.2));
  // The firewood stacked toward the court, the chopping block with its axe by the stoker's place.
  // (The yard is open to the alley at the side, where the wood came in by cart.)
  out.logs.push(...woodpile(0.75, 0.55, seed + 11, lod).map((g) => g.translate(xw + 0.62, 0, -1.5)));
  if (lod < 2) {
    out.logs.push(tintGeometry(boxUV(new CylinderGeometry(0.2, 0.22, 0.4, lod ? 7 : 12, 1).translate(xw + 0.8, 0, -1.92).translate(0, 0.2, 0)), () => 0.9));
    if (lod === 0) {
      out.wood.push(staff([xw + 0.8, 0.42, -1.92], [xw + 1.0, 0.9, -1.82], 0.016, 5));
      out.iron.push(box(0.04, 0.12, 0.16, xw + 0.81, 0.38, -1.94, 0.8));
    }
  }
}

/** The court: the sand of the palaestra, paths of flags, the street wall with its gate, the side walls, benches, balls. */
function court(lod, seed, out) {
  const zc = B.portico.z + 0.2;
  const { x0: px0, z1: pz1 } = B.pool;
  // The sand, and the flags round the pool and along the way from the gate.
  out.sand.push(box(px0 + H - 0.3, 0.03, H - zc - 0.25, (-H + 0.25 + px0 - 0.05) / 2, 0, (zc + H - 0.25) / 2, (x, y, z) => 0.9 + 0.1 * Math.cos(x * 1.7) * Math.cos(z * 1.3)));
  out.flags.push(...paving(px0 - 0.05, H - 0.25, zc, H - 0.25, 0.05, seed, { rowW: 0.55, minL: 0.5, maxL: 0.95, lod, skip: (x, z) => x > B.pool.x0 + 0.1 && x < B.pool.x1 - 0.1 && z > B.pool.z0 + 0.1 && z < pz1 - 0.1 }));
  out.flags.push(...paving(B.gate[0] + 0.05, B.gate[1] - 0.05, 2.0, H - 0.25, 0.05, seed + 3, { rowW: 0.5, minL: 0.45, maxL: 0.8, lod }));
  // The street wall, low, with the gate between its piers; the side walls.
  const [g0, g1] = B.gate;
  for (const [a, b] of [[-H, g0 - 0.2], [g1 + 0.2, H]]) {
    out.plaster.push(box(b - a, LOW, 0.24, (a + b) / 2, 0, H - 0.12, 0.9));
    out.tile.push(box(b - a, 0.06, 0.32, (a + b) / 2, LOW, H - 0.12, 0.9));
    out.red.push(box(b - a, 0.6, 0.012, (a + b) / 2, 0, H + 0.0 - 0.006 + 0.001, 1));
  }
  for (const x of [-H + 0.12, H - 0.12]) {
    const za = x < 0 ? zc : B.caldarium.z1;
    out.plaster.push(box(0.24, LOW, H - 0.24 - za, x, 0, (za + H - 0.24) / 2, 0.9));
    out.tile.push(box(0.32, 0.06, H - 0.24 - za, x, LOW, (za + H - 0.24) / 2, 0.9));
  }
  // The gate's piers and lintel, BALNEVM cut in it and filled red.
  const gh = B.gateH;
  for (const x of [g0 - 0.2, g1 + 0.2]) out.trav.push(slab(0.4, gh, 0.4, { bevel: 0.015, seed: seed + x * 9, wobble: 0.002, tone: 0.05, grime: 0.35 }).translate(x, 0, H - 0.2));
  out.trav.push(slab(g1 - g0 + 0.9, 0.36, 0.44, { bevel: 0.015, seed: seed + 13, wobble: 0.002, tone: 0.04, grime: 0 }).translate((g0 + g1) / 2, gh, H - 0.22));
  if (lod === 0) out.letters.push(...inscribe('BALNEVM', gh + 0.08, H, 0.2).map((g) => g.translate((g0 + g1) / 2, 0, 0)));
  else if (lod === 1) out.letters.push(box(1.4, 0.18, 0.006, (g0 + g1) / 2, gh + 0.09, H - 0.0));
  // Benches along the left wall; the bowling balls in their row by it (the Stabian palaestra's).
  for (const z of [1.2, 2.7]) {
    out.trav.push(slab(0.4, 0.06, 1.0, { bevel: 0.01, seed: seed + z * 5, wobble: 0, tone: 0.03, grime: 0 }).translate(-H + 0.48, 0.42, z));
    for (const k of [-1, 1]) out.trav.push(slab(0.32, 0.42, 0.12, { bevel: 0.01, seed: seed + z * 5 + k, wobble: 0.002, tone: 0.03, grime: 0.3 }).translate(-H + 0.48, 0, z + k * 0.38));
  }
  if (lod < 2) {
    for (let k = 0; k < 4; k++) {
      const s = new SphereGeometry(0.1 + k * 0.012, lod ? 8 : 14, lod ? 6 : 10);
      s.translate(-H + 0.5 + k * 0.3, 0.1 + k * 0.012 + 0.03, 3.4);
      out.stone.push(tintGeometry(boxUV(s), () => 0.8 + k * 0.04));
    }
  }
  // The labrum: a round basin of marble on a foot, cold water to splash by the pool's steps.
  const lb = revolve(profileOf([[0, 0], [0.22, 0], [0.22, 0.06], [0.12, 0.12], [0.1, 0.6], [0.16, 0.68], [0.5, 0.78], [0.56, 0.86], [0.54, 0.88], [0.46, 0.84], [0.0, 0.76]]), { segments: lod === 2 ? 10 : lod ? 18 : 32, metres: 0.6 });
  out.marble.push(tintGeometry(lb.translate(-0.62, 0.03, 1.15), (px, py) => 0.85 + 0.15 * Math.min(1, py / 0.8)));
  out.labrumWater.push(tintGeometry(boxUV(new CylinderGeometry(0.46, 0.46, 0.01, lod ? 12 : 24, 1).translate(-0.62, 0.86, 1.15))));
}

/** The pool: raised walls plastered white, a marble rim, the blue floor and sides, steps; its water, ice or dry floor; the spout. */
function pool(lod, seed, ice, out) {
  const { x0, x1, z0, z1, rim, water } = B.pool;
  const t = 0.22;
  // The walls (the camera sees their outer faces), the rim of marble slabs round the top.
  for (const s of [-1, 1]) {
    out.plaster.push(box(x1 - x0, rim - 0.06, t, (x0 + x1) / 2, 0, s < 0 ? z0 + t / 2 : z1 - t / 2, 0.93));
    out.plaster.push(box(t, rim - 0.06, z1 - z0 - 2 * t, s < 0 ? x0 + t / 2 : x1 - t / 2, 0, (z0 + z1) / 2, 0.93));
    out.marble.push(slab(x1 - x0 + 0.06, 0.08, t + 0.08, { bevel: 0.012, seed: seed + s, wobble: 0.002, tone: 0.03, grime: 0 }).translate((x0 + x1) / 2, rim - 0.06, s < 0 ? z0 + t / 2 : z1 - t / 2));
    out.marble.push(slab(t + 0.08, 0.08, z1 - z0 - 2 * t, { bevel: 0.012, seed: seed + 3 + s, wobble: 0.002, tone: 0.03, grime: 0 }).translate(s < 0 ? x0 + t / 2 : x1 - t / 2, rim - 0.06, (z0 + z1) / 2));
  }
  // Inside: the floor and the walls' inner faces painted blue (the colour the water takes).
  const ix0 = x0 + t;
  const ix1 = x1 - t;
  const iz0 = z0 + t;
  const iz1 = z1 - t;
  out.blue.push(box(ix1 - ix0, 0.04, iz1 - iz0, (ix0 + ix1) / 2, 0, (iz0 + iz1) / 2, (x, y, z) => 0.8 + 0.2 * Math.cos(x * 2.1) * Math.cos(z * 1.7)));
  for (const s of [-1, 1]) {
    out.blue.push(box(ix1 - ix0, rim - 0.1, 0.01, (ix0 + ix1) / 2, 0.04, s < 0 ? iz0 + 0.005 : iz1 - 0.005, 0.85));
    out.blue.push(box(0.01, rim - 0.1, iz1 - iz0, s < 0 ? ix0 + 0.005 : ix1 - 0.005, 0.04, (iz0 + iz1) / 2, 0.85));
  }
  // Steps: up its outside at the palaestra's end, down its inside.
  for (let k = 0; k < 3; k++) {
    const h = ((k + 1) * (rim - 0.06)) / 3;
    out.marble.push(slab(0.3, h, 0.9, { bevel: 0.012, seed: seed + 10 + k, wobble: 0.002, tone: 0.03, grime: 0.3 }).translate(x0 - 0.15 - (2 - k) * 0.3 + 0.3, 0, 2.05));
    out.marble.push(slab(0.3, h, 0.9, { bevel: 0.012, seed: seed + 20 + k, wobble: 0.002, tone: 0.03, grime: 0.2 }).translate(ix0 + 0.15 + (2 - k) * 0.3, 0.04, 2.05));
  }
  // The water, its surface over the whole inside; frozen in a hard frost. Dry: dust and leaves on the floor, a stain at the old waterline.
  const surf = box(ix1 - ix0, 0.01, iz1 - iz0, (ix0 + ix1) / 2, water - 0.01, (iz0 + iz1) / 2);
  (ice ? out.ice : out.water).push(surf);
  const rnd = (k) => ((Math.sin(k * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1;
  for (let k = 0; k < (lod === 2 ? 0 : lod ? 10 : 34); k++) {
    const l = new BoxGeometry(0.07, 0.006, 0.04);
    l.rotateY(rnd(k) * 6);
    l.translate(ix0 + 0.1 + rnd(k + 50) * (ix1 - ix0 - 0.2), 0.045, iz0 + 0.1 + rnd(k + 90) * (iz1 - iz0 - 0.2));
    out.leaves.push(tintGeometry(boxUV(l), () => (k % 3 ? [0.32, 0.2, 0.08] : [0.22, 0.17, 0.08])));
  }
  out.stain.push(box(ix1 - ix0 - 0.04, 0.5, 0.008, (ix0 + ix1) / 2, 0.06, iz0 + 0.012), box(0.008, 0.5, iz1 - iz0 - 0.04, ix1 - 0.012, 0.06, (iz0 + iz1) / 2));
  // The spout: a bronze lion's mouth on a little pillar at the back wall, the water from it while the baths work.
  const sx = 2.05;
  out.trav.push(slab(0.3, 1.28, 0.26, { bevel: 0.012, seed: seed + 30, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(sx, 0, z0 - 0.02));
  const head = new SphereGeometry(0.1, lod ? 8 : 14, lod ? 6 : 10);
  head.scale(1, 0.9, 0.8);
  head.translate(sx, 1.05, z0 + 0.12);
  out.bronze.push(tintGeometry(boxUV(head), () => 0.75));
  out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.03, 0.035, 0.14, 8, 1).rotateX(Math.PI / 2).translate(sx, 1.02, z0 + 0.22))));
  if (!ice) {
    const pts = [new Vector3(sx, 1.0, z0 + 0.29), new Vector3(sx, 0.97, z0 + 0.36), new Vector3(sx, 0.9, z0 + 0.42), new Vector3(sx, water + 0.0, z0 + 0.48)];
    out.stream.push(tube(pts, 0.028, { radial: lod ? 6 : 10, segments: lod ? 6 : 14, around: 0.2 }));
  }
}

/** The people (only close up): the bathers, the ball players, the man with his strigil, the capsarius, the stoker. */
function folk(mats, ice) {
  const list = [];
  const things = { leather: [], bronze: [], wood: [], linen: [] };
  const towelled = { cloth: 0xe8e0d0, hair: 0x2e2119 };
  const { z0: pz0 } = B.pool;
  if (!ice) {
    // A bather standing in the pool to his waist, wiping his face.
    list.push(...person(mats, { cloth: 0xa87a58, hair: 0x2e2119, skin: 0xa87a58, arms: [[-0.26, 0.92, 0.18], [0.12, 1.5, 0.2]] }, 2.75, 0.04, 2.3, 0.7));
  }
  // One sitting on the pool's back rim, his feet over the water, facing the street.
  list.push(...person(mats, { ...towelled, skin: 0xb88a64, sit: 0.66, arms: 'lap', lean: 0.12 }, 1.15, B.pool.rim - 0.66 + 0.02, pz0 + 0.11, 0));
  // Two at ball (trigon, pila), the ball between them; a man scraping his arm with a strigil by the labrum.
  list.push(...person(mats, { cloth: 0xe0d6c0, hair: 0x4a3020, skin: 0xb08060, arms: 'reach' }, -3.0, 0.03, 1.55, 0.85));
  list.push(...person(mats, { cloth: 0xd8cdb4, hair: 0x1e1812, skin: 0x9a6c4c, arms: [[-0.3, 1.3, 0.2], [0.3, 1.32, 0.22]] }, -1.55, 0.03, 2.75, -2.25));
  const ball = new SphereGeometry(0.08, 12, 8);
  ball.translate(-2.3, 1.75, 2.15);
  things.leather.push(tintGeometry(boxUV(ball), () => 0.9));
  list.push(...person(mats, { ...towelled, skin: 0xa87a58, arms: [[-0.16, 1.06, 0.26], [0.16, 1.14, 0.3]] }, -0.15, 0.03, 1.75, -Math.PI / 2 - 0.4));
  things.bronze.push(tube([[-0.38, 1.16, 1.62], [-0.44, 1.12, 1.56], [-0.48, 1.04, 1.58]], 0.012, { radial: 5, segments: 6 }));
  // Under the portico, the capsarius minding the clothes on the bench; a bather in his towel going in.
  list.push(...person(mats, { cloth: 0x8a7a62, hair: 0x1e1812, skin: 0x8a5e40, sit: 0.48, arms: 'lap', lean: 0.1 }, -1.45, B.portico.floor, B.caldarium.z1 + 0.25, 0));
  list.push(...person(mats, { ...towelled, cloth2: 0xece6d8, skin: 0xb88a64, arms: 'hold' }, 0.3, B.portico.floor, -0.75, Math.PI - 0.3));
  // The stoker at the furnace's mouth with a log.
  const F = B.furnace;
  const xs = B.caldarium.x1 + 0.62;
  list.push(...person(mats, { cloth: 0x6a5a48, hair: 0x2e2119, skin: 0x8a5e40, arms: [[-0.2, 0.86, 0.36], [0.2, 0.86, 0.36]] }, xs, 0.03, F.z - 0.08, -Math.PI / 2));
  const log = new CylinderGeometry(0.06, 0.06, 0.6, 7, 1);
  log.rotateZ(Math.PI / 2);
  log.rotateY(Math.PI / 2);
  log.translate(xs - 0.38, 0.86, F.z - 0.08);
  things.wood.push(tintGeometry(boxUV(log), () => 0.8));
  // The clothes left on the pegs, and a towel over the bench.
  things.linen.push(...towel(-0.34, B.portico.floor + 1.5, B.caldarium.z1 + 0.1, { w: 0.24, drop: 0.5, d: 0.02, tone: 0.9 }));
  things.linen.push(...towel(0.18, B.portico.floor + 1.5, B.caldarium.z1 + 0.1, { w: 0.24, drop: 0.55, d: 0.02, tone: 0.7 }));
  return { list, things };
}

/** Build the baths: { group, meshes, triangles }; meshes tagged in userData.when ('full', 'flow', 'dry', 'cold', 'ice'). */
export function buildBalneum({ lod = 0, seed = 351, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['earth', 'sand', 'flags', 'floor', 'shelter', 'trav', 'stone', 'plaster', 'red', 'brick', 'signinum', 'tile', 'wood', 'dark', 'letters', 'marble', 'bronze', 'lead', 'iron',
    'logs', 'blue', 'vents', 'glass', 'water', 'ice', 'stain', 'leaves', 'stream', 'labrumWater', 'doorOpen', 'doorShut', 'coalsLit', 'coalsCold', 'charcoal', 'warmVault'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  caldarium(lod, seed, out);
  tholos(lod, seed + 20, out);
  portico(lod, seed + 40, out);
  yard(lod, seed + 60, out);
  court(lod, seed + 80, out);
  pool(lod, seed + 100, ice, out);
  const m = healthMaterials();
  if (lod === 2) {
    // Far out, small things are under a pixel and each part one more draw for every bath in view:
    // into the parts there are anyway, or left out.
    out.trav.push(...out.shelter.splice(0));
    out.flags.push(...out.floor.splice(0));
    out.wood.push(...out.logs.splice(0));
    out.letters = out.lead = out.iron = out.leaves = out.red = out.labrumWater = out.stream = out.coalsLit = out.coalsCold = out.charcoal = out.glass = [];
    out.stone.length = 0;
  }
  const p = new TaggedParts('balneum');
  const small = { cast: false };
  p.add('yard', m.earth, out.earth, small);
  p.add('sand', material('ring-sand', { surface: 'earth', color: 0xe8d4a8, vertexColors: true, snow: 1 }), out.sand, small);
  p.add('flags', m.flags, out.flags, small);
  p.add('floor', m.shelteredFloor, out.floor, small);
  p.add('stone', m.trav, [...out.trav, ...out.stone]);
  p.add('sheltered-stone', m.shelteredStone, out.shelter);
  p.add('walls', m.plaster, out.plaster);
  p.add('dado', m.red, out.red, small);
  p.add('brick', m.brick, out.brick);
  p.add('terrace', m.signinum, out.signinum);
  // The vaults and the dome rendered in lime, warm grey-pink: snow lies on them while the
  // baths are cold; while the fire is in, the heat under them melts it (a copy that holds little).
  const render = { surface: 'limestone', color: 0xe6c8b6, vertexColors: true };
  p.add('vaults', material('vault-render', { ...render, snow: 1 }), out.warmVault, { when: 'cold' });
  p.add('vaults', material('vault-render-warm', { ...render, snow: 0.12 }), out.warmVault.map((g) => g.clone()), { when: 'flow' });
  p.add('roof', m.tile, [...out.tile, ...out.vents]);
  p.add('wood', m.wood, out.wood);
  p.add('inside', m.dark, out.dark, small);
  p.add('letters', m.letters, out.letters, small);
  p.add('marble', m.marble, out.marble);
  p.add('bronze', m.bronze, [...out.bronze, ...out.lead], small);
  p.add('iron', m.iron, out.iron, small);
  p.add('firewood', ruralMaterials().bark, out.logs);
  // The pool's painted inside (plaster tinted the blue of its water), its water or ice; the leaves of a dry one.
  p.add('pool-paint', material('pool-blue', { surface: 'plaster', color: 0x7aa8b8, vertexColors: true, snow: 0.6 }), out.blue, small);
  if (ice) p.add('pool-water', iceMaterial(), out.ice, { when: 'full', cast: false });
  else p.add('pool-water', shallowWaterMaterial(), out.water, { when: 'full', cast: false });
  // (The labrum's water freezes with the pool's: the frost's look.)
  p.add('labrum-water', ice ? iceMaterial() : shallowWaterMaterial(), out.labrumWater, { when: 'full', cast: false });
  p.add('leaves', m.soil, out.leaves, { when: 'dry', cast: false });
  p.add('stain', m.stain, out.stain, { when: 'dry', cast: false });
  p.add('stream', streamMaterial(), out.stream, { when: 'flow', cast: false });
  p.add('doors', m.wood, out.doorOpen, { when: 'flow' });
  p.add('doors', m.wood, out.doorShut, { when: 'cold' });
  p.add('coals', m.embers, out.coalsLit, { when: 'flow', cast: false });
  p.add('coals', m.ash, out.coalsCold, { when: 'cold', cast: false });
  p.add('charcoal', m.dark, out.charcoal, small);
  // The caldarium's window: lit from within while the fire is in (the lanterns' horn, which the night lights).
  p.add('window', lanternPane(), out.glass, { when: 'flow', cast: false });
  p.add('window', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), out.glass.map((g) => g.clone()), { when: 'cold', cast: false });
  if (lod < 2) {
    for (const [lx, ly, lz] of B.lamps) {
      const l = lantern(lx, ly, lz, lod);
      p.add('lantern', m.bronze, [...l.bronze, staff([lx, ly + 0.3, lz], [lx, B.gateH, lz], 0.01, 4)], small);
      p.add('lamp', lanternPane(), [l.pane], { when: 'flow', cast: false });
      p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'cold', cast: false });
    }
  }
  // Smoke from the flue stack and two of the vents while the fire is in; in a hard frost, steam from
  // the dome's top, the window and the vents. (At every level: the program must be compiled with the rest.)
  const smoke = [lin(0x8a8580), lin(0x77716a)];
  const T = B.tholos;
  const C = B.caldarium;
  const rows = lod === 2 ? 3 : lod ? 5 : 8;
  p.add('smoke', steamMaterial(), [
    plume(C.x1 + 0.2, 3.2, C.z0 + 0.2, { h: 1.6, r: 0.15, n: 3, seed: 1, rows, rgb: smoke[1], alpha: 1, lean: [-0.45, 0.2] }),
    ...(lod < 2 ? [-0.6, 1.8].map((x, i) => plume(x, C.spring + 0.32, C.z1 - 0.1, { h: 0.9, r: 0.07, seed: 2 + i, rows, rgb: smoke[0], alpha: 0.7, lean: [-0.25, 0.15] })) : []),
  ], { when: 'flow', cast: false });
  p.add('steam', steamMaterial(), [
    plume(T.x, T.top + 0.04, T.z, { h: 1.35, r: 0.2, n: 3, seed: 5, rows, alpha: 1, lean: [0.3, 0.25] }),
    plume(B.window[0] - 0.05, B.window[1] + 0.2, B.window[2], { h: 0.9, r: 0.15, n: 3, seed: 6, rows, alpha: 0.9, lean: [-0.35, 0.2] }),
    ...(lod < 2 ? [-0.6, 0.6, 1.8].map((x, i) => plume(x, C.spring + 0.32, C.z0 + 0.12, { h: 1.0, r: 0.08, seed: 7 + i, rows, alpha: 0.9, lean: [-0.2, 0.3] })) : []),
  ], { when: 'ice', cast: false });
  if (lod === 0) {
    const { list, things } = folk(m, ice);
    people(p, m, 'bathers', list, 'flow');
    p.add('ball', m.leather, things.leather, { when: 'flow', cast: false });
    p.add('strigil', m.bronze, things.bronze, { when: 'flow', cast: false });
    p.add('log', m.wood, things.wood, { when: 'flow', cast: false });
    p.add('clothes', m.linen, things.linen, { when: 'flow', cast: false });
  }
  return p.build();
}

