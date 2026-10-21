/**
 * models/balneum.js
 * ----------------------------------------------------------------------------
 * The baths of the 3D look: a balneum, a small neighbourhood bath on a 2 x 2
 * footprint (8 m), as a town of Italy had it about 300 BC: not yet the
 * Roman bath with its hypocaust, vaults and glass (those are of the first
 * century BC), but the Greek bathhouse (balaneion) the Greek cities of the
 * south brought, from the record rather than from the 2D sprite:
 *
 *   - The round room, a tholos: the circular bath rooms of the Greek
 *     bathhouses at Gela, Olympia and Eretria of the fifth and fourth
 *     centuries BC, and the oldest phase of Pompeii's Stabian baths. A round
 *     room of tufa under a conical tiled roof, a smoke hole at its apex,
 *     the walls stuccoed; inside, a ring of hip-baths (sitz baths of
 *     terracotta, a bather seated in each with the water to his waist)
 *     against the wall.
 *   - The hot water came from a furnace room behind: bronze boilers set over
 *     the praefurnium's arched mouth on a masonry base, a stoker (fornacator)
 *     feeding it wood; the heat went into the water, and the water was
 *     carried to the tubs. There was no hypocaust (Sergius Orata's, about
 *     100 BC, Pliny the Elder 9.168) and no flue tiles: the rooms were
 *     warmed by braziers of bronze on legs, and the smoke went up a plain
 *     terracotta flue through the roof.
 *   - The warm room beside the tholos: a rectangular room under a timber-
 *     trussed roof of tiles (no vault: the vault in brick and the glazed
 *     window are later Roman work), a high plain window closed by a timber
 *     shutter, the walls stuccoed red below and cream above (the coloured
 *     stucco of the Stabian baths' early rooms).
 *   - Pompeii's early baths and the Greek palaestrae: an exercise court, part
 *     sand, with a portico, and a cold pool before the bath block; the
 *     portico's columns Tuscan, plain (no volutes, no flutes), of tufa under
 *     stucco, red below, on stone bases, carrying a timber lean-to roof of
 *     tiles.
 *   - The bathers: Seneca (Letters 56) on the noise over a bath (a later
 *     bath, but the noise is the same), the ball players counting their
 *     throws, the man scraping off oil and sweat with his strigil (the
 *     Greek one), the plunge into the pool; a slave minding the clothes.
 *     Bathing was the afternoon's: lamps lit them into the evening.
 *
 * So, in 8 m: at the back, the rectangular warm room under its tiled gable
 * with the high shuttered window in its end, the tholos beside it under its
 * cone, a portico of red-and-white columns along both under a lean-to of
 * tiles, the doors in the wall behind it; behind the warm room's end, the
 * furnace yard: the praefurnium on its tufa base with its arched mouth and
 * coals, two bronze boilers over it, the firewood, a terracotta flue through
 * the lean-to's roof; before them the palaestra of sand, bathers talking and
 * resting, one splashing at a labrum, benches, stone bowling balls, and the
 * raised pool with its bronze spout; a low wall to the street, the gate
 * between piers under BALNEVM, lanterns.
 *
 * States (meshes tagged in userData.when, models.js partShows), from piped
 * water and staff as the 2D sprite and the fountain read them:
 *   'flowing'  water and staff: the bathers, the capsarius and the stoker
 *              (actors: balneumActors), the furnace's coals and the brazier's,
 *              smoke at the flue and the tholos's apex, the spout running
 *              into the pool, the doors and the window's shutter open, the
 *              lanterns lit at night; steam from the apex and the window in
 *              a hard frost ('ice')
 *   'still'    water, no staff: the pool full and still, the furnace cold,
 *              the doors and shutter shut, nobody
 *   'dry'      no water: the pool empty, dust and dead leaves on its floor,
 *              the furnace cold, the doors and shutter shut
 * In a hard frost ('baths:ice') the pool's water is ice, and nobody is in it.
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z,
 * as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry, BoxGeometry, Shape, Path, ExtrudeGeometry, Vector3 } from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { material, shallowWaterMaterial, streamMaterial, iceMaterial } from '../materials.js';
import { slab, paving, tuscanColumn, wallWithOpenings, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin, woodpile, ruralMaterials, leanTo } from './rural.js';
import { staff, inscribe } from './castra.js';
import { roofSlope, box } from './learning.js';
import { healthMaterials, steamMaterial, plume, towel, coals } from './healing.js';
import { DYES } from '../people/actors.js';
import { SEAT_H } from '../people/clips.js';

/** The baths' measures (metres): the tests, the lab and the game read them. */
export const BALNEUM = Object.freeze({
  half: 4,
  /** The warm room (the key keeps its old name): x0..x1, z0..z1 (its walls' outer faces), the walls' height (its roof's eave). */
  caldarium: Object.freeze({ x0: -1.25, x1: 2.85, z0: -3.9, z1: -1.15, spring: 2.45 }),
  /** The round room: its middle (x, z), its wall's height, its outer radius, the cone's apex. */
  tholos: Object.freeze({ x: -2.575, z: -2.525, block: 2.4, r: 1.3, top: 3.72 }),
  /** The portico: its columns' line (z), its eave's height, its floor's. */
  portico: Object.freeze({ z: -0.02, eave: 2.12, floor: 0.14 }),
  /** The pool: x0..x1, z0..z1 (its walls' outer faces), its rim's height, its water's. */
  pool: Object.freeze({ x0: 0.35, x1: 3.5, z0: 0.8, z1: 3.2, rim: 0.88, water: 0.8 }),
  /** The praefurnium's mouth in its base against the warm room's end wall: its middle (z), width, height to the arch's springing. */
  furnace: Object.freeze({ z: -2.25, w: 0.5, h: 0.34 }),
  /** The gate in the street wall (x), its piers' height. */
  gate: Object.freeze([-2.55, -1.45]),
  gateH: 2.25,
  /** The lanterns hung in the gateway from its lintel (x, y, z), facing the street. */
  lamps: Object.freeze([Object.freeze([-2.32, 1.66, 3.82]), Object.freeze([-1.68, 1.66, 3.82])]),
  /** The warm room's window, high in its gable end (x, y, z), facing +x: its firelight shows at night while the baths work. */
  window: Object.freeze([2.87, 2.8, -2.525]),
});

const B = BALNEUM;
const H = 3.93;
const RED = lin(0xa83a26);
/** The street wall's and the side walls' height. */
const LOW = 1.05;
/** The warm room's ridge, and its roof's overhang at the eaves and at the free end. */
const RIDGE = 3.32;
const EAVE_OVER = 0.05;
const GABLE_OVER = 0.14;
/** The thickness of the bath block's walls. */
const WALL = 0.32;
/** The two doors in the wall behind the portico: the tholos's and the warm room's (x, width, height). */
const DOORS = Object.freeze([{ x: B.tholos.x, w: 0.9, h: 2.0 }, { x: 1.45, w: 1.0, h: 2.05 }]);
/** The furnace base against the warm room's end wall: its depth out from it, height, length along z; the boilers' radius. */
const BASE = Object.freeze({ d: 0.4, h: 0.82, len: 1.2, boiler: 0.2 });
/** The block's west edge, and the floor under the whole bath block. */
const X0 = -H + 0.03;
const FLOOR = 0.1;

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
 * The gable over the warm room's end: a wall's triangle on the wall's top
 * (its foot at y, `half` either side of zc, the roof's slope over it), `t`
 * thick, its face toward +x at x (or -x: `face` -1); a window hole through it
 * (w wide, its sill and head at wy0, wy1 over the foot) if given. UVs in
 * metres.
 */
function gable(x, y, zc, half, rise, t, face, win = null) {
  const s = new Shape();
  s.moveTo(-half, 0);
  s.lineTo(half, 0);
  s.lineTo(half, 0.07);
  s.lineTo(0, rise);
  s.lineTo(-half, 0.07);
  s.closePath();
  if (win) {
    const p = new Path();
    p.moveTo(-win.w / 2, win.y0);
    p.lineTo(-win.w / 2, win.y1);
    p.lineTo(win.w / 2, win.y1);
    p.lineTo(win.w / 2, win.y0);
    p.closePath();
    s.holes.push(p);
  }
  const g = new ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  // (Its shape's x across the wall (along z), y up; extruded back along -x from its face.)
  g.translate(0, 0, -t);
  g.rotateY(face > 0 ? Math.PI / 2 : -Math.PI / 2);
  g.translate(x, y, zc);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return tintGeometry(boxUV(g), () => 0.92);
}

/** The shutters of the window in the gable end: shut over it, or open against the wall. */
function shutters(x, wy, wz, w, h, out) {
  out.doorShut.push(box(w + 0.06, h + 0.04, 0.04, x + 0.03, wy - 0.02, wz, 0.72));
  for (const s of [-1, 1]) out.doorOpen.push(box(w / 2, h + 0.04, 0.04, x + 0.03, wy - 0.02, wz + s * (w / 2 + 0.16), 0.72));
}

/** A tripod brazier of bronze at (x, z): its legs, the bowl, the coals (lit while the baths work, ash cold). */
function brazier(x, y, z, lod, seed, out) {
  const bowl = revolve(profileOf([[0, 0.5], [0.1, 0.46], [0.2, 0.54], [0.24, 0.6], [0.22, 0.6], [0.0, 0.53]]), { segments: lod ? 10 : 18, metres: 0.3 });
  out.bronze.push(bowl.translate(x, y, z));
  for (let k = 0; k < 3; k++) {
    const a = k * 2.094 + 0.4;
    out.bronze.push(staff([x + Math.cos(a) * 0.1, y + 0.52, z + Math.sin(a) * 0.1], [x + Math.cos(a) * 0.24, y, z + Math.sin(a) * 0.24], 0.016, 5));
  }
  const c = coals(x, y + 0.57, z, 0.15, { seed, lod });
  out.coalsLit.push(...c.hot);
  out.coalsCold.push(...c.hot.map((g) => g.clone()));
  out.charcoal.push(...c.dark);
}

/**
 * The warm room: stuccoed walls (red below, cream above), the floor under
 * the whole block, the end wall with its gable and the high shuttered window
 * (no glass: the timber shutter, and the firelight of the brazier within),
 * the timber-trussed roof of tiles, the brazier by the door. (Its doors are
 * in the front wall: frontWall.)
 */
function warmRoom(lod, seed, out) {
  const { x0, x1, z0, z1, spring } = B.caldarium;
  const t = WALL;
  const zc = (z0 + z1) / 2;
  const r = (z1 - z0) / 2;
  // The floor under the whole block (sheltered: no snow lies on it), and under the portico's end.
  out.floor.push(box(x1 - X0, FLOOR, z1 - z0, (X0 + x1) / 2, 0, zc, 0.9));
  // The back wall, the -x end against the tholos, the +x end under its gable; the stucco's red band on their outsides.
  out.plaster.push(box(x1 - x0, spring, t, (x0 + x1) / 2, 0, z0 + t / 2, 0.95));
  out.plaster.push(box(t, spring, z1 - z0 - 2 * t, x0 + t / 2, 0, zc, 0.95));
  out.plaster.push(box(t, spring, z1 - z0 - 2 * t, x1 - t / 2, 0, zc, 0.95));
  out.red.push(box(x1 - x0, 1.3, 0.012, (x0 + x1) / 2, 0, z0 - 0.006, 1));
  out.red.push(box(0.012, 1.3, z1 - z0, x1 + 0.006, 0, zc, 1));
  // The gable at the free end: a plain high window (0.5 wide) in it, a stone sill, a timber lintel.
  const win = { w: 0.5, y0: 0.16, y1: 0.6 };
  const rise = RIDGE - spring - 0.04;
  out.plaster.push(gable(x1, spring, zc, r, rise, t, 1, win));
  out.plaster.push(gable(x0 + t, spring, zc, r, rise, t, -1));
  const [wx, wy, wz] = B.window;
  const y0 = spring + win.y0;
  out.trav.push(slab(0.14, 0.05, win.w + 0.14, { bevel: 0.008, seed: seed + 8, wobble: 0, tone: 0, grime: 0 }).translate(x1, y0 - 0.05, wz));
  out.wood.push(box(0.12, 0.1, win.w + 0.2, x1 + 0.0, spring + win.y1, wz, 0.7));
  shutters(x1, y0, wz, win.w, win.y1 - win.y0, out);
  // (No glass: the opening shows the room's firelight, a pane of glow set just inside.)
  const glow = new BoxGeometry(0.03, win.y1 - win.y0, win.w);
  glow.translate(wx - 0.22, wy, wz);
  out.glow.push(tintGeometry(boxUV(glow)));
  // The roof: two slopes of tiles on the timber trusses, a ridge of tiles over the ridge beam; the
  // truss's tie beam, the ridge beam and the purlins stand out of the gable's face.
  const ye = spring + 0.07;
  const xa = x0;
  const xb = x1 + GABLE_OVER;
  const za = z1 + EAVE_OVER;
  const zb = z0 - EAVE_OVER;
  for (const q of [
    [[xa, ye, za], [xb, ye, za], [xb, RIDGE, zc], [xa, RIDGE, zc]],
    [[xb, ye, zb], [xa, ye, zb], [xa, RIDGE, zc], [xb, RIDGE, zc]],
  ]) {
    const roof = roofSlope(q, { lod, seed: seed + 9 });
    out.tile.push(...roof.tile);
    out.wood.push(...roof.wood);
  }
  out.tile.push(box(xb - xa + 0.06, 0.1, 0.2, (xa + xb) / 2, RIDGE - 0.07, zc, 0.85));
  out.wood.push(box(xb - xa + 0.1, 0.14, 0.14, (xa + xb) / 2, RIDGE - 0.24, zc, 0.8));
  out.wood.push(box(0.16, 0.18, z1 - z0 + 0.2, x1 + 0.08, spring - 0.2, zc, 0.8));
  if (lod < 2) {
    const d = (r + EAVE_OVER) * 0.5;
    const yp = RIDGE - (d / (r + EAVE_OVER)) * (RIDGE - ye) - 0.14;
    for (const s of [-1, 1]) out.wood.push(box(0.14, 0.12, 0.12, x1 + 0.04, yp, zc + s * d, 0.8));
  }
  // The brazier of bronze on its legs, by the door: its glow shows through the open door.
  if (lod < 2) brazier(DOORS[1].x, FLOOR, -2.05, lod, seed + 31, out);
}

/**
 * The tholos: its round wall of tufa, stuccoed (red to the dado, cream
 * above), a gap for the door, the cone of the roof in tiles with its smoke
 * hole at the apex, the ring of hip-baths in terracotta against the wall.
 */
function tholos(lod, seed, out) {
  const { x, z, block, r, top } = B.tholos;
  const t = 0.3;
  const ri = r - t;
  const seg = lod === 2 ? 10 : lod ? 20 : 36;
  const door = DOORS[0];
  // The wall: an annulus with the door's gap (its sides parallel: the gap's width at both faces), run up.
  const ao = Math.asin(door.w / 2 / r);
  const ai = Math.asin(door.w / 2 / ri);
  const s = new Shape();
  // (A shape's y is the world's -z once it is stood up: rotateX below.)
  const at = (rr, a) => [rr * Math.sin(a), -rr * Math.cos(a)];
  s.moveTo(...at(r, ao));
  for (let k = 1; k <= seg; k++) s.lineTo(...at(r, ao + (k / seg) * (2 * Math.PI - 2 * ao)));
  s.lineTo(...at(ri, 2 * Math.PI - ai));
  for (let k = 1; k <= seg; k++) s.lineTo(...at(ri, 2 * Math.PI - ai - (k / seg) * (2 * Math.PI - 2 * ai)));
  s.closePath();
  const wall = new ExtrudeGeometry(s, { depth: block, bevelEnabled: false });
  wall.rotateX(-Math.PI / 2);
  wall.translate(x, 0, z);
  wall.deleteAttribute('uv');
  wall.computeVertexNormals();
  out.plaster.push(tintGeometry(boxUV(wall), () => 0.93));
  // The dado: a skin of red stucco round the outside to 1.3 m, short of the gap.
  const dado = new CylinderGeometry(r + 0.008, r + 0.008, 1.3, seg, 1, true, ao + 0.01, 2 * Math.PI - 2 * ao - 0.02);
  out.red.push(tintGeometry(boxUV(dado.translate(x, 0.65, z))));
  // The gap's lintel, over the door.
  const zl = z + (Math.sqrt(r * r - (door.w / 2) ** 2) + Math.sqrt(ri * ri - (door.w / 2) ** 2)) / 2;
  out.plaster.push(box(door.w, block - door.h, 0.4, x, door.h, zl, 0.93));
  // The cone: tiles on timber, its eave a hand over the wall, steep (a cone, not a dome), open at its apex: the smoke hole.
  const re = r + 0.12;
  const ye = block - 0.02;
  const ro = 0.17;
  const n = lod === 2 ? 3 : lod ? 5 : 8;
  const prof = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    // (A little concave toward the eave, as a thatched or tiled cone flares.)
    prof.push([re - (re - ro) * u, ye + (top - ye) * (u * 0.9 + 0.1 * u * u)]);
  }
  prof.push([ro + 0.04, top + 0.06], [ro, top + 0.06], [ro - 0.02, top - 0.08]);
  const cone = revolve(profileOf(prof), { segments: seg, metres: 1, tint: (p) => 0.85 + 0.15 * Math.min(1, (p.y - ye) / 1.0) });
  out.cone.push(cone.translate(x, 0, z));
  // The dark of the room under the smoke hole (not the sky through a hollow shell).
  const hole = new CylinderGeometry(ro - 0.02, ro - 0.02, 0.02, lod ? 8 : 16, 1);
  out.dark.push(tintGeometry(boxUV(hole.translate(x, top - 0.1, z))));
  // The hip-baths: terracotta tubs in a ring against the inner wall, each with its seat, the door's side left clear.
  if (lod < 2) {
    const tub = revolve(profileOf([[0, 0], [0.13, 0], [0.19, 0.1], [0.21, 0.34], [0.17, 0.35], [0.15, 0.12], [0, 0.08]]), { segments: lod ? 8 : 14, metres: 0.3 });
    const m = 7;
    for (let k = 0; k < m; k++) {
      const a = 0.95 + (k / (m - 1)) * (2 * Math.PI - 1.9);
      out.vents.push(tub.clone().translate(x + Math.sin(a) * (ri - 0.26), FLOOR, z - Math.cos(a) * (ri - 0.26)));
    }
  }
}

/**
 * The front wall of the bath block, behind the portico: stuccoed, red to the dado, with the tholos's
 * door and the warm room's, each with its lintel, its leaves (open while the baths work, shut else).
 */
function frontWall(lod, seed, out) {
  const { x1, z1, spring } = B.caldarium;
  const t = WALL;
  const zc = z1 - t / 2;
  let a = X0;
  DOORS.forEach((d, i) => {
    const b = d.x - d.w / 2;
    out.plaster.push(box(b - a, spring, t, (a + b) / 2, 0, zc, 0.93));
    out.red.push(box(b - a, 1.3, 0.012, (a + b) / 2, 0, z1 + 0.006, 1));
    a = d.x + d.w / 2;
    out.plaster.push(box(d.w, spring - d.h - B.portico.floor, t, d.x, B.portico.floor + d.h, zc, 0.93));
    out.dark.push(box(d.w, d.h, 0.02, d.x, B.portico.floor, z1 - t + 0.02));
    out.trav.push(slab(d.w + 0.34, 0.14, t + 0.06, { bevel: 0.012, seed: seed + 3 + i, wobble: 0, tone: 0.04, grime: 0 }).translate(d.x, B.portico.floor + d.h, zc));
    for (const s of [-1, 1]) {
      for (const open of [false, true]) {
        const leaf = box(d.w / 2 - 0.01, d.h - 0.02, 0.05, -s * (d.w / 4), 0, 0, 0.72);
        leaf.rotateY(open ? -s * 1.6 : 0);
        leaf.translate(d.x + s * d.w / 2, B.portico.floor, z1 - t + 0.05);
        (open ? out.doorOpen : out.doorShut).push(leaf);
      }
    }
  });
  out.plaster.push(box(x1 - a, spring, t, (a + x1) / 2, 0, zc, 0.93));
  out.red.push(box(x1 - a, 1.3, 0.012, (a + x1) / 2, 0, z1 + 0.006, 1));
}

/** The portico along the front of both: its floor, columns, beam and lean-to roof; benches, pegs and clothes. */
function portico(lod, seed, out) {
  const { z: cz, eave, floor } = B.portico;
  const zb = B.caldarium.z1;
  const x0 = X0;
  const x1 = B.caldarium.x1;
  out.floor.push(box(x1 - x0, floor, cz + 0.2 - zb, (x0 + x1) / 2, 0, (zb + cz + 0.2) / 2, 0.95));
  out.trav.push(slab(x1 - x0, floor + 0.01, 0.36, { bevel: 0.012, seed, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate((x0 + x1) / 2, 0, cz + 0.05));
  // Tuscan columns of tufa under stucco (plain capitals), red to the dado, on stone bases.
  const colH = eave - 0.22 - floor;
  const n = lod === 2 ? 4 : 6;
  for (let k = 0; k < n; k++) {
    const x = x0 + 0.35 + (k * (x1 - x0 - 0.7)) / (n - 1);
    for (const g of redBelow(tuscanColumn(0.12, colH, lod), 0.8)) out.plaster.push(g.translate(x, floor, cz));
  }
  // The timber architrave and the lean-to of tiles up to the wall.
  out.wood.push(box(x1 - x0, 0.22, 0.2, (x0 + x1) / 2, eave - 0.22, cz, 0.85));
  const top = B.caldarium.spring + 0.02;
  const roof = roofSlope([[x0, eave, cz + 0.32], [x1, eave, cz + 0.32], [x1, top, zb], [x0, top, zb]], { lod, seed: seed + 9 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // The end of the portico by the yard: a wall closing it.
  out.plaster.push(box(0.24, eave, cz + 0.2 - zb, x1, 0, (zb + cz + 0.2) / 2, 0.92));
  // Benches along the walls (sheltered), pegs over them for the bathers' clothes. (Their tops SEAT_H
  // over the floor: a sitter's feet on it.)
  const legs = SEAT_H - 0.06;
  for (const [a, b] of [[-1.9, -0.95], [-0.7, 0.85], [2.05, 2.6]]) {
    out.shelter.push(slab(b - a, 0.06, 0.4, { bevel: 0.01, seed: seed + a * 7, wobble: 0, tone: 0.03, grime: 0 }).translate((a + b) / 2, floor + legs, zb + 0.24));
    for (const x of [a + 0.12, b - 0.12]) out.shelter.push(box(0.1, legs, 0.34, x, floor, zb + 0.22, 0.75));
  }
  if (lod < 2) {
    out.shelter.push(box(1.6, 0.05, 0.05, 0.05, floor + 1.55, zb + 0.04, 0.6));
    for (let k = 0; k < 6; k++) out.shelter.push(box(0.025, 0.025, 0.12, -0.6 + k * 0.26, floor + 1.5, zb + 0.08, 0.5));
  }
}

/**
 * The furnace yard behind the warm room's end: the praefurnium (a tufa base
 * with the arched mouth, its coals in it), two bronze boilers over it with
 * lead pipes into the wall, the terracotta flue between them through the
 * lean-to's roof, the firewood, the chopping block.
 */
function yard(lod, seed, out) {
  const xw = B.caldarium.x1;
  const z0 = B.caldarium.z0;
  const z1 = B.caldarium.z1;
  const F = B.furnace;
  out.earth.push(box(H - xw, 0.03, z1 - z0, (xw + H) / 2, 0, (z0 + z1) / 2, 0.85));
  // The lean-to over the boilers, its eave on two posts.
  const span = 0.98;
  const zl = F.z - 0.15;
  const lt = leanTo({ L: 1.8, span, topY: 2.25, eaveY: 1.78, lod, seed: seed + 3, over: 0.0 });
  for (const g of [...lt.tile, ...lt.wood]) {
    g.rotateY(Math.PI / 2);
    g.translate(xw, 0, zl);
  }
  out.tile.push(...lt.tile);
  out.wood.push(...lt.wood);
  for (const z of [zl - 0.85, zl + 0.85]) out.wood.push(box(0.12, 1.78, 0.12, xw + span - 0.08, 0, z, 0.7));
  out.wood.push(box(0.12, 0.12, 1.8, xw + span - 0.08, 1.7, zl, 0.7));
  // The praefurnium: a tufa base against the wall with the arched mouth through it, its dark at the back, the coals (lit while the fire is in, ash cold) in it.
  const base = wallWithOpenings(BASE.len, BASE.h, BASE.d, [{ x: 0, w: F.w, h: F.h, arch: true }], { lod });
  base.translate(0, 0, BASE.d / 2);
  base.rotateY(Math.PI / 2);
  base.translate(xw, 0, F.z);
  out.tufa.push(base);
  out.dark.push(box(0.02, F.h + F.w / 2, F.w, xw + 0.03, 0, F.z));
  const c = coals(xw + 0.24, 0.0, F.z, F.w / 2 - 0.06, { seed: seed + 41, lod });
  out.coalsLit.push(...c.hot);
  out.coalsCold.push(...c.hot.map((g) => g.clone()));
  out.charcoal.push(...c.dark);
  out.tufa.push(slab(0.5, 0.04, F.w + 0.3, { bevel: 0.01, seed: seed + 5, wobble: 0, tone: 0.04, grime: 0.5 }).translate(xw + BASE.d + 0.25, 0, F.z));
  // The boilers: bronze drums with domed lids on the base over the fire, a lead pipe from each into the wall.
  const seg = lod === 2 ? 8 : lod ? 12 : 20;
  const k = BASE.boiler / 0.31;
  const bx = xw + BASE.d / 2;
  for (const dz of [-0.3, 0.3]) {
    const boiler = revolve(profileOf([[0, 0], [0.29, 0], [0.31, 0.04], [0.31, 0.62], [0.33, 0.66], [0.26, 0.74], [0.12, 0.8], [0.04, 0.82], [0.05, 0.88], [0, 0.88]].map(([a, b]) => [a * k, b * k])), { segments: seg, metres: 0.3, tint: (p) => 0.55 + 0.45 * Math.min(1, p.y / 0.5) });
    out.bronze.push(boiler.translate(bx, BASE.h, F.z + dz));
    if (lod < 2) out.lead.push(tube([[bx - 0.12, BASE.h + 0.5, F.z + dz], [xw + 0.04, BASE.h + 0.55, F.z + dz]], 0.03, { radial: 6, segments: 4 }));
  }
  // The flue: a plain terracotta pipe on the base between the boilers, up through the lean-to's roof, a cap on it.
  const fx = xw + 0.12;
  out.vents.push(tintGeometry(boxUV(new CylinderGeometry(0.075, 0.08, 2.3, lod ? 6 : 10, 1, true).translate(fx, BASE.h + 1.15, F.z)), (px, py) => (py > 3.0 ? 0.4 : 0.9)));
  out.vents.push(tintGeometry(boxUV(new CylinderGeometry(0.0, 0.12, 0.1, lod ? 6 : 10, 1).translate(fx, 3.17, F.z)), () => 0.9));
  // The firewood stacked by the base, the chopping block with its axe at the back.
  out.logs.push(...woodpile(0.7, 0.5, seed + 11, lod).map((g) => g.translate(xw + 0.68, 0, -1.43)));
  if (lod < 2) {
    out.logs.push(tintGeometry(boxUV(new CylinderGeometry(0.2, 0.22, 0.4, lod ? 7 : 12, 1).translate(xw + 0.65, 0, -3.55).translate(0, 0.2, 0)), () => 0.9));
    if (lod === 0) {
      out.wood.push(staff([xw + 0.65, 0.42, -3.55], [xw + 0.85, 0.9, -3.45], 0.016, 5));
      out.iron.push(box(0.04, 0.12, 0.16, xw + 0.66, 0.38, -3.57, 0.8));
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

/** The clothes left on the pegs while the baths work. */
function clothes() {
  return [
    ...towel(-0.34, B.portico.floor + 1.5, B.caldarium.z1 + 0.1, { w: 0.24, drop: 0.5, d: 0.02, tone: 0.9 }),
    ...towel(0.18, B.portico.floor + 1.5, B.caldarium.z1 + 0.1, { w: 0.24, drop: 0.55, d: 0.02, tone: 0.7 }),
  ];
}

/**
 * The baths' people while they work ('flowing'; nobody while still or dry),
 * in their own metres (people/actors.js specs). Bathers in a loincloth
 * (limus) or a short tunic: one standing in the pool to his waist (not in a
 * hard frost, `ice`: then the pool is ice), one sitting on its back rim, his
 * feet in the water; two talking on the palaestra and one resting on its
 * bench (Seneca's noise over a bath); one splashing his face from the
 * labrum (his hand in its water: the stir clip's circling hand, no pestle);
 * under the portico the capsarius minding the clothes on the bench, and a
 * bather walking along it to the warm room's door and back; in the yard the
 * stoker raking the ash from the furnace's mouth (sweep).
 */
export function balneumActors(state, ice = false) {
  if (state !== 'flowing') return [];
  const sand = 0.03;
  const P = B.portico;
  const C = B.caldarium;
  const bare = (c) => ({ body: 'm', dress: ['limus'], colours: { tunic: DYES.white, trim: DYES.white, ...c } });
  const list = [];
  if (!ice) list.push({ ...bare({ skin: 0xa87452 }), hair: 'crop', clip: 'idle', at: [2.75, 0.04, 2.3], ry: 0.7, seed: 351 });
  // (The rim's top SEAT_H over his feet, in the water.)
  list.push({ ...bare({ skin: 0xb88560 }), hair: 'curls', clip: 'sit', at: [1.15, B.pool.rim + 0.02 - SEAT_H, B.pool.z0 + 0.14], ry: 0, seed: 352 });
  list.push({ ...bare({ skin: 0xbf8b62 }), hair: 'crop', beard: 'short', clip: 'talk', at: [-2.8, sand, 1.5], ry: 0.85, seed: 353 });
  list.push({ body: 'm', dress: ['tunic:short'], hair: 'crop', clip: 'listen', at: [-2.05, sand, 2.25], ry: -2.3, seed: 354, colours: { tunic: DYES.white } });
  // (The palaestra's bench by the left wall, its top SEAT_H over the sand: his hips over it, facing the court.)
  list.push({ ...bare({ skin: 0x9a6a4a }), hair: 'curls', clip: 'sit', at: [-H + 0.48 + 0.03, sand, 2.75], ry: Math.PI / 2, seed: 355 });
  // At the labrum: the basin's rim MORTAR.height over the sand, his hand circling in its water.
  list.push({ ...bare({ skin: 0xc8956c }), hair: 'crop', clip: 'stir', at: [-0.62, sand, 0.4], ry: 0, seed: 356 });
  // Under the portico: the capsarius on the bench (its top SEAT_H over the floor), and a bather going in.
  list.push({ body: 'm', dress: ['tunic:short'], hair: 'curls', clip: 'sit', at: [-1.45, P.floor, C.z1 + 0.27], ry: 0, seed: 357, colours: { tunic: DYES.fawn, skin: 0x8c5e40 } });
  list.push({
    body: 'm', dress: ['tunic:short'], hair: 'crop', clip: 'walk', at: [-0.4, P.floor, -0.46], ry: Math.PI / 2, seed: 358, colours: { tunic: DYES.white },
    // (Along the portico between the benches' fronts and the columns, to the door, turned to it, and back.)
    route: { length: 1.85, speed: 0.75, pauseEnd: 4, pauseStart: 5, clipEnd: 'idle', clipStart: 'listen', faceEnd: Math.PI, faceStart: -Math.PI / 2 },
  });
  // The stoker at the furnace's mouth, raking the ash, his broom's head at the mouth.
  list.push({ body: 'm', dress: ['tunic:short'], hair: 'crop', clip: 'sweep', props: { R: 'broom' }, at: [C.x1 + BASE.d + 0.38, sand, B.furnace.z], ry: -Math.PI / 2, seed: 359, colours: { tunic: DYES.brownWool, skin: 0x75492f } });
  return list;
}

/** Build the baths: { group, meshes, triangles }; meshes tagged in userData.when ('full', 'flow', 'dry', 'cold', 'ice'). */
export function buildBalneum({ lod = 0, seed = 351, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['earth', 'sand', 'flags', 'floor', 'shelter', 'trav', 'stone', 'plaster', 'red', 'tile', 'wood', 'dark', 'letters', 'marble', 'bronze', 'lead', 'iron',
    'logs', 'blue', 'vents', 'glow', 'tufa', 'cone', 'water', 'ice', 'stain', 'leaves', 'stream', 'labrumWater', 'doorOpen', 'doorShut', 'coalsLit', 'coalsCold', 'charcoal'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  warmRoom(lod, seed, out);
  frontWall(lod, seed + 10, out);
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
    out.letters = out.lead = out.iron = out.leaves = out.red = out.labrumWater = out.stream = out.coalsLit = out.coalsCold = out.charcoal = out.glow = [];
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
  p.add('tufa', material('tufa-block', { surface: 'limestone', color: 0xb59c78, vertexColors: true, snow: 1 }), out.tufa);
  // The tholos's cone of tiles: snow lies on it while the baths are cold; while the fire is in, the
  // heat of the room melts it (a copy that holds little).
  const cone = { surface: 'terracotta', vertexColors: true };
  p.add('cone', material('tholos-tile', { ...cone, snow: 1 }), out.cone, { when: 'cold' });
  p.add('cone', material('tholos-tile-warm', { ...cone, snow: 0.12 }), out.cone.map((g) => g.clone()), { when: 'flow' });
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
  // The warm room's window (no glass): the firelight of the brazier within, while the fire is in (the lanterns' horn, which the night lights); shut behind its shutter else.
  p.add('window', lanternPane(), out.glow, { when: 'flow', cast: false });
  p.add('window', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), out.glow.map((g) => g.clone()), { when: 'cold', cast: false });
  if (lod < 2) {
    for (const [lx, ly, lz] of B.lamps) {
      const l = lantern(lx, ly, lz, lod);
      p.add('lantern', m.bronze, [...l.bronze, staff([lx, ly + 0.3, lz], [lx, B.gateH, lz], 0.01, 4)], small);
      p.add('lamp', lanternPane(), [l.pane], { when: 'flow', cast: false });
      p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'cold', cast: false });
    }
  }
  // Smoke from the flue and a thin one from the tholos's smoke hole while the fire is in; in a hard
  // frost, steam from the apex, the window and the flue. (At every level: the program must be compiled with the rest.)
  const smoke = [lin(0x8a8580), lin(0x77716a)];
  const T = B.tholos;
  const C = B.caldarium;
  const fx = C.x1 + 0.12;
  const rows = lod === 2 ? 3 : lod ? 5 : 8;
  p.add('smoke', steamMaterial(), [
    plume(fx, 3.2, B.furnace.z, { h: 1.6, r: 0.15, n: 3, seed: 1, rows, rgb: smoke[1], alpha: 1, lean: [-0.45, 0.2] }),
    ...(lod < 2 ? [plume(T.x, T.top + 0.04, T.z, { h: 0.9, r: 0.1, n: 2, seed: 2, rows, rgb: smoke[0], alpha: 0.6, lean: [0.2, 0.15] })] : []),
  ], { when: 'flow', cast: false });
  p.add('steam', steamMaterial(), [
    plume(T.x, T.top + 0.04, T.z, { h: 1.35, r: 0.2, n: 3, seed: 5, rows, alpha: 1, lean: [0.3, 0.25] }),
    plume(B.window[0] - 0.05, B.window[1] + 0.2, B.window[2], { h: 0.9, r: 0.15, n: 3, seed: 6, rows, alpha: 0.9, lean: [-0.35, 0.2] }),
    ...(lod < 2 ? [plume(fx, 3.2, B.furnace.z, { h: 1.0, r: 0.1, seed: 7, rows, alpha: 0.9, lean: [-0.2, 0.3] })] : []),
  ], { when: 'ice', cast: false });
  // (The people are actors: balneumActors.)
  if (lod < 2) p.add('clothes', m.linen, clothes(), { when: 'flow', cast: false });
  return p.build();
}

