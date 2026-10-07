/**
 * models/statio.js
 * ----------------------------------------------------------------------------
 * The Statio, the naval station, in the 3D look: designed from Rome's fleet
 * stations as they are known, not from the 2D sprite:
 *
 *   - The great fleets kept their ships at Misenum (the classis Misenensis,
 *     its harbour sheltered by moles) and Ravenna (the classis Ravennas);
 *     the provincial fleets had smaller stations along coasts and rivers,
 *     a squadron of liburnians each, with a headquarters (the principia, as
 *     in a fort), stores and the crews' quarters.
 *   - Their harbours were walled in by moles of opus pilarum: piers of
 *     harbour concrete (Vitruvius: lime and the pozzolana of Puteoli, which
 *     sets under water) joined by arches, which let the current through so
 *     the basin did not silt; the Puteoli mole is drawn so on glass flasks
 *     and frescoes, and its piers still stand under the sea.
 *   - At the harbour's mouth a lighthouse: the Pharos of Alexandria's
 *     tiered tower became the type, Ostia's appears on the Torlonia relief
 *     and on coins, Dover's (in the fort of the classis Britannica) still
 *     stands, an octagon of stone and tile courses that stepped in as it
 *     rose, a fire at its top by night.
 *
 * So, in 12 m: the land row raised as a stone terrace (the quay's height)
 * with steps up from the street; on it the principia, its walls stuccoed
 * over a red dado on a travertine socle, a tiled roof, a portico of Tuscan
 * columns facing the water, CLASSIS cut over its door, the squadron's red
 * standard (vexillum) by it; a store shed for spare oars, a mast and sails.
 * Over the water: a quay of ashlar along the shore with mooring rings and
 * steps down, two moles of opus pilarum out to the front, arches through
 * them, bollards along their edges; between them a sheltered basin with
 * the station's boat; on the east mole's end a beacon tower in three
 * tiers of tufa with brick courses, its fire under a small tiled roof. The
 * squadron's liburnians moor past the moles' ends, as the game draws them.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the beacon's fire burning, the door open, the lantern
 *           lit, a sentry at the door and a sailor on the mole
 *   'shut'  no staff: the fire out (cold ash), the door shut, nobody
 *
 * Metres, the middle at the origin, y up, the water side toward +z (as
 * models/harbour.js says). Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { boxUV, tintGeometry, tube, revolve, profileOf } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, tuscanColumn, wallWithOpenings, lantern, lanternPane, inscription, TaggedParts } from './masonry.js';
import { gableRoof, leanTo, doorLeaf, beam, D } from './rural.js';
import { figureParts } from './figure.js';
import {
  HARBOUR, harbourMaterials, board, arcade, ashlar, bollard, mooringRing, waterSteps, pierFoam, oar, ropeCoil, liburnianHull,
} from './harbour.js';

/** The station's measures (metres): the tests, the lab and the game read them. */
export const STATIO = Object.freeze({
  top: 0.8, // the terrace's, the quay's and the moles' top
  quayZ: -0.4, // the quay's face over the basin
  west: Object.freeze([-5.95, -4.2]), // the west mole (x0, x1)
  east: Object.freeze([3.15, 5.95]), // the east mole, wide enough for the beacon
  /** The principia: its walls' outer faces, the portico's columns' line, the door's middle. */
  hq: Object.freeze({ x0: -5.55, x1: 0.35, z0: -5.2, z1: -3.3, eave: 3.4, porchZ: -2.45, door: -2.6 }),
  /** The beacon tower: its middle (x, z) and its tiers [half width, top]. */
  tower: Object.freeze({ x: 4.6, z: 4.45, tiers: Object.freeze([[1.15, 3.1], [0.88, 4.8], [0.68, 5.95]]) }),
  /** The beacon's fire (x, y, z): the night's light map draws its glow while staffed. */
  fire: Object.freeze([4.6, 5.55, 4.45]),
  /** The lantern by the principia's door. */
  lamp: Object.freeze([-1.8, 2.3, -3.12]),
});

const S = STATIO;

/** The terrace over the land row and the quay along the shore: ashlar faces, flags on top, steps up from the back. */
function terrace(out, lod, seed) {
  const H = HARBOUR.half - 0.02;
  const top = S.top;
  // The faces: the back (with the steps' gap in the middle), the ends, and the quay's face over the basin.
  const stepX = [-3.8, -1.4];
  out.stone.push(...ashlar(-H, stepX[0], 0, top, -H, -H + 0.45, { seed, lod }));
  out.stone.push(...ashlar(stepX[1], H, 0, top, -H, -H + 0.45, { seed: seed + 1, lod }));
  out.stone.push(...ashlar(-H, -H + 0.45, -0.5, top, -H + 0.45, S.quayZ - 0.45, { seed: seed + 2, lod }));
  out.stone.push(...ashlar(H - 0.45, H, -0.5, top, -H + 0.45, S.quayZ - 0.45, { seed: seed + 3, lod }));
  out.stone.push(...ashlar(S.west[1], S.east[0], -0.5, top, S.quayZ - 0.5, S.quayZ, { seed: seed + 4, lod }));
  // The fill under the flags (unseen but for its top edge at the steps).
  out.stone.push(slab(2 * H - 0.9, top - 0.1, S.quayZ + H - 0.95, { bevel: 0.01, seed: seed + 5, wobble: 0, tone: 0, grime: 0 }).translate(0, 0, (-H + 0.45 + S.quayZ - 0.5) / 2));
  // The steps up from the street, between the back wall's ends.
  const n = 4;
  for (let k = 0; k < n; k++) {
    const y = ((k + 1) * top) / n;
    out.stone.push(slab(stepX[1] - stepX[0], y, 0.3, { bevel: 0.015, seed: seed + 10 + k, wobble: lod ? 0 : 0.003, tone: 0.05, grime: 0.3 }).translate((stepX[0] + stepX[1]) / 2, 0, -H + 0.15 + k * 0.28));
  }
  // The flags over all of it.
  out.flags.push(...paving(-H, H, -H + 0.95, S.quayZ, top, seed + 20, { rowW: 0.62, minL: 0.5, maxL: 1.0, lod }));
  out.flags.push(...paving(-H, stepX[0], -H, -H + 0.95, top, seed + 21, { rowW: 0.5, lod }));
  out.flags.push(...paving(stepX[1], H, -H, -H + 0.95, top, seed + 22, { rowW: 0.5, lod }));
  // Steps down to the water from the quay into the basin, and rings along its face.
  if (lod < 2) {
    for (const g of waterSteps(1.1, top, 4, 0.3, seed + 30, lod)) out.stone.push(g.translate(-1.6, 0, S.quayZ));
    for (const x of [-3.2, 0.4, 2.2]) out.iron.push(mooringRing(x, top - 0.12, S.quayZ, 1, lod));
  }
}

/** A mole of opus pilarum from the quay out to the front, its arches through it, flags and bollards on top. */
function mole(out, x0, x1, lod, seed) {
  const top = S.top;
  const z0 = S.quayZ - 0.5;
  const z1 = HARBOUR.half - 0.05;
  const a = arcade(z0, z1, (x0 + x1) / 2, x1 - x0, top, { along: 'z', span: 0.8, pier: 0.75, seed, lod, kerb: false });
  out.tufa.push(...a.tufa);
  out.brick.push(...a.brick);
  // The mole's end over the open water: a cutwater of ashlar.
  out.stone.push(...ashlar(x0, x1, -0.5, top - 0.14, z1 - 0.5, z1, { seed: seed + 3, lod, course: 0.33 }));
  // Its top: travertine kerbs along both edges, flags between.
  out.stone.push(...ashlar(x0 - 0.04, x0 + 0.3, top - 0.14, top, z0 + 0.5, z1 + 0.04, { seed: seed + 5, lod, course: 0.14, min: 0.8, max: 1.3, grime: 0 }));
  out.stone.push(...ashlar(x1 - 0.3, x1 + 0.04, top - 0.14, top, z0 + 0.5, z1 + 0.04, { seed: seed + 6, lod, course: 0.14, min: 0.8, max: 1.3, grime: 0 }));
  out.flags.push(...paving(x0 + 0.3, x1 - 0.3, z0 + 0.5, z1, top - 0.02, seed + 7, { rowW: Math.min(0.6, (x1 - x0 - 0.6) / 2), lod }));
  if (lod < 2) out.foam.push(pierFoam(x0, x1, z0 + 0.5, z1, 0.4, seed + 9, lod));
  // Bollards along the inner edge and at the end; rings on the faces.
  const inner = x0 < 0 ? x1 - 0.32 : x0 + 0.32;
  const outer = x0 < 0 ? x0 + 0.32 : x1 - 0.32;
  for (const z of lod === 2 ? [z1 - 0.4] : [0.9, 3.0, z1 - 0.4]) out.stone.push(bollard(inner, top, z, lod));
  if (lod < 2) {
    out.stone.push(bollard(outer, top, z1 - 0.4, lod));
    for (const z of [1.9, 4.1]) out.iron.push(mooringRing(x0 < 0 ? x1 : x0, top - 0.16, z, x0 < 0 ? 1 : -1, lod, true));
  }
}

/** A stepped square tier of the tower: tufa with brick bonding courses, a moulded cornice of travertine. */
function tier(out, x, z, half, y0, y1, lod, seed, { windows = true, door = false } = {}) {
  const w = half * 2;
  // The wall: tufa between brick courses (opus mixtum), every 0.75 m.
  const band = 0.75;
  let y = y0;
  let k = 0;
  while (y < y1 - 0.05) {
    const yb = Math.min(y1, y + band);
    out.tufa.push(slab(w, yb - y - 0.12, w, { bevel: 0.01, seed: seed + k, wobble: 0, tone: 0.04, grime: k ? 0 : 0.3 }).translate(x, y, z));
    if (yb < y1) out.brick.push(slab(w + 0.02, 0.12, w + 0.02, { bevel: 0.006, seed: seed + 50 + k, wobble: 0, tone: 0.05, grime: 0 }).translate(x, yb - 0.12, z));
    else out.tufa.push(slab(w, 0.12, w, { bevel: 0.006, seed: seed + 60, wobble: 0, tone: 0, grime: 0 }).translate(x, yb - 0.12, z));
    y = yb;
    k++;
  }
  // The cornice.
  out.stone.push(slab(w + 0.24, 0.14, w + 0.24, { bevel: 0.03, seed: seed + 70, wobble: 0, tone: 0.03, grime: 0 }).translate(x, y1, z));
  if (lod === 2) return;
  // Slit windows (dark) on the four faces, a door at the foot facing the mole's root (-z).
  if (windows) {
    const wy = (y0 + y1) / 2;
    for (const [dx, dz, ax] of [[0, 1, 'x'], [0, -1, 'x'], [1, 0, 'z'], [-1, 0, 'z']]) {
      if (door && dz === -1) continue;
      const g = ax === 'x' ? new BoxGeometry(0.14, 0.55, 0.02) : new BoxGeometry(0.02, 0.55, 0.14);
      g.translate(x + dx * (half + 0.006), wy, z + dz * (half + 0.006));
      out.dark.push(tintGeometry(boxUV(g)));
    }
  }
  if (door) {
    const g = new BoxGeometry(0.62, 1.35, 0.02);
    g.translate(x, y0 + 0.68, z - half - 0.006);
    out.dark.push(tintGeometry(boxUV(g)));
    out.stone.push(slab(0.86, 0.14, 0.12, { bevel: 0.01, seed: seed + 80, wobble: 0, tone: 0, grime: 0 }).translate(x, y0 + 1.36, z - half - 0.02));
  }
}

/** The beacon tower: three tiers, the lantern room's piers and arches, its pyramid of tiles, the fire. */
function tower(out, lod, seed) {
  const { x, z, tiers } = S.tower;
  let y0 = S.top;
  tiers.forEach(([half, top], i) => {
    if (i < 2) tier(out, x, z, half, y0, top, lod, seed + i * 100, { door: i === 0 });
    y0 = top + 0.14;
  });
  // The lantern room: four corner piers, open between them under arches, the fire in its middle.
  const [half, top] = tiers[2];
  const base = tiers[1][1] + 0.14;
  const h = top - base;
  if (lod === 2) {
    out.tufa.push(slab(half * 2, h, half * 2, { bevel: 0.01, seed, wobble: 0, tone: 0, grime: 0 }).translate(x, base, z));
  } else {
    for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const wall = wallWithOpenings(half * 2, h, 0.2, [{ x: 0, w: half * 1.1, h: h * 0.45, y: 0, arch: true }], { lod });
      boxUV(wall);
      tintGeometry(wall, () => 0.95);
      // Built in x-y facing +z (its back at -0.2): turned to face its side, its face on the tier's.
      wall.rotateY(sx ? (sx > 0 ? Math.PI / 2 : -Math.PI / 2) : sz > 0 ? 0 : Math.PI);
      wall.translate(x + sx * half, base, z + sz * half);
      out.tufa.push(wall);
    }
  }
  out.stone.push(slab(half * 2 + 0.2, 0.12, half * 2 + 0.2, { bevel: 0.02, seed: seed + 7, wobble: 0, tone: 0, grime: 0 }).translate(x, top, z));
  // The pyramid of tiles over it, a bronze finial.
  const r = half + 0.16;
  const apexY = top + 0.12 + r * 0.95;
  const p0 = top + 0.12;
  const pos = [];
  const corners = [[-r, -r], [r, -r], [r, r], [-r, r]];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k];
    const [bx, bz] = corners[(k + 1) % 4];
    pos.push(x + bx, p0, z + bz, x + ax, p0, z + az, x, apexY, z);
  }
  const pyr = new BufferGeometry();
  pyr.setAttribute('position', new Float32BufferAttribute(pos, 3));
  pyr.computeVertexNormals();
  out.tile.push(tintGeometry(boxUV(pyr), (px, py) => 0.85 + 0.15 * ((py - p0) / (apexY - p0))));
  if (lod < 2) {
    for (const [cx, cz] of corners) out.tile.push(tube([[x + cx * 1.02, p0 + 0.02, z + cz * 1.02], [x, apexY + 0.03, z]], 0.045, { radial: lod ? 4 : 6, segments: 2, around: 0.3 }));
    out.bronze.push(revolve(profileOf([[0, 0], [0.06, 0], [0.09, 0.08], [0.07, 0.2], [0.02, 0.3], [0, 0.32]]), { segments: lod ? 6 : 10, metres: 0.3 }).translate(x, apexY, z));
  }
  // The fire: an iron basket on a stone hearth; burning coals while the station is staffed, cold ash when not.
  const [fx, fy, fz] = S.fire;
  out.stone.push(slab(0.7, 0.16, 0.7, { bevel: 0.02, seed: seed + 9, wobble: 0, tone: 0, grime: 0.2 }).translate(fx, base, fz));
  if (lod < 2) {
    const basket = revolve(profileOf([[0.05, 0], [0.3, 0.22], [0.36, 0.42], [0.33, 0.42], [0.27, 0.24], [0, 0.05]]), { segments: lod ? 8 : 14, metres: 0.4 });
    out.iron.push(basket.translate(fx, base + 0.16, fz));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      out.iron.push(tube([[fx + Math.cos(a) * 0.3, base + 0.16, fz + Math.sin(a) * 0.3], [fx + Math.cos(a) * 0.12, base + 0.34, fz + Math.sin(a) * 0.12]], 0.018, { radial: 4, segments: 2, around: 0.2 }));
    }
  }
  const coals = revolve(profileOf([[0, 0], [0.31, 0], [0.24, 0.12], [0.1, 0.2], [0, 0.22]]), { segments: lod ? 8 : 14, metres: 0.4 });
  coals.translate(fx, base + 0.52, fz);
  out.embers.push(coals);
  out.ash.push(coals.clone().scale(1, 0.5, 1).translate(0, -0.03, 0));
}

/** The principia: socle, stuccoed walls over a red dado, the door, windows, the roof, the portico and its plaque. */
function principia(out, lod, seed) {
  const Q = S.hq;
  const top = S.top;
  const W = Q.x1 - Q.x0;
  const cx = (Q.x0 + Q.x1) / 2;
  const cz = (Q.z0 + Q.z1) / 2;
  const t = 0.34;
  const socle = top + 0.3;
  // The socle of travertine round the house.
  out.stone.push(...ashlar(Q.x0 - 0.04, Q.x1 + 0.04, top, socle, Q.z0 - 0.04, Q.z1 + 0.04, { seed, lod, course: 0.3, grime: 0.2 }));
  // The walls: the front with its door and two windows, the others plain; stucco over a red dado.
  const front = wallWithOpenings(W, Q.eave - socle, t, [
    { x: Q.door - cx, w: 1.0, h: 1.95 },
    { x: Q.x0 + 0.85 - cx, y: 1.2, w: 0.5, h: 0.6 },
    { x: Q.x1 - 0.85 - cx, y: 1.2, w: 0.5, h: 0.6 },
  ], { lod, y0: socle });
  boxUV(front, cx, 0);
  out.plaster.push(tintGeometry(front).translate(cx, 0, Q.z1));
  out.plaster.push(tintGeometry(boxUV(slab(W, Q.eave - socle, t, { bevel: 0.004, seed, wobble: 0, tone: 0, grime: 0.1 }))).translate(cx, socle, Q.z0 + t / 2));
  for (const sx of [-1, 1]) {
    const x = sx < 0 ? Q.x0 + t / 2 : Q.x1 - t / 2;
    out.plaster.push(tintGeometry(boxUV(slab(t, Q.eave - socle, Q.z1 - Q.z0 - 2 * t + 0.002, { bevel: 0.004, seed: seed + sx, wobble: 0, tone: 0, grime: 0.1 }))).translate(x, socle, cz));
    // The gable's triangle under the roof's end.
    const span = Q.z1 - Q.z0;
    const rise = (span / 2) * Math.tan(D(23));
    const g = new BoxGeometry(t, rise, span, 1, 1, 2);
    const gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) gp.setY(i, gp.getY(i) > 0 ? rise * (1 - Math.abs(gp.getZ(i)) / (span / 2)) : 0);
    g.computeVertexNormals();
    out.plaster.push(tintGeometry(boxUV(g.translate(x, Q.eave, cz))));
  }
  // The red dado along the front and the ends (a band a hand proud of the stucco).
  if (lod < 2) {
    const dh = 0.85;
    for (const [x0, x1] of [[Q.x0, Q.door - 0.62], [Q.door + 0.62, Q.x1]]) out.red.push(tintGeometry(boxUV(new BoxGeometry(x1 - x0, dh, 0.02).translate((x0 + x1) / 2, socle + dh / 2, Q.z1 + 0.01))));
    for (const x of [Q.x0 - 0.01, Q.x1 + 0.01]) out.red.push(tintGeometry(boxUV(new BoxGeometry(0.02, dh, Q.z1 - Q.z0).translate(x, socle + dh / 2, cz))));
  }
  // The dark inside behind the door and windows.
  const room = new BoxGeometry(W - 2 * t - 0.02, Q.eave - socle - 0.1, Q.z1 - Q.z0 - 2 * t - 0.02);
  const idx = room.index.array;
  for (let i = 0; i < idx.length; i += 3) { const k = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = k; }
  room.translate(cx, socle + (Q.eave - socle - 0.1) / 2, cz);
  room.computeVertexNormals();
  out.dark.push(tintGeometry(boxUV(room)));
  // The door's travertine frame and its two leaves, open or shut.
  const zf = Q.z1;
  for (const s of [-1, 1]) out.stone.push(slab(0.14, 1.95, t + 0.06, { bevel: 0.01, seed: seed + 40 + s, wobble: 0.002, tone: 0.04, grime: 0.2 }).translate(Q.door + s * 0.57, socle, zf - t / 2 + 0.03));
  out.stone.push(slab(1.4, 0.2, t + 0.08, { bevel: 0.012, seed: seed + 43, wobble: 0.002, tone: 0.04, grime: 0 }).translate(Q.door, socle + 1.95, zf - t / 2 + 0.04));
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = doorLeaf(0.49, 1.92, seed + 50 + s, lod);
      leaf.translate(-s * 0.25, 0, 0);
      leaf.rotateY(open ? -s * D(98) : 0);
      leaf.translate(Q.door + s * 0.5, socle + 0.015, zf - t + 0.07);
      (open ? out.doorOpen : out.doorShut).push(leaf);
    }
  }
  // Window sills and heads.
  if (lod < 2) {
    for (const wx of [Q.x0 + 0.85, Q.x1 - 0.85]) {
      out.stone.push(slab(0.66, 0.06, t + 0.08, { bevel: 0.008, seed: seed + wx, wobble: 0.002, tone: 0.03, grime: 0.1 }).translate(wx, socle + 1.14, zf - t / 2 + 0.04));
      for (const bx of [-0.12, 0, 0.12]) out.iron.push(tintGeometry(boxUV(new CylinderGeometry(0.011, 0.011, 0.6, 5).translate(wx + bx, socle + 1.5, zf - 0.09))));
    }
  }
  // The roof: a tiled gable along the front.
  const roof = gableRoof({ x0: Q.x0, x1: Q.x1, z0: Q.z0, z1: Q.z1, eaveY: Q.eave, pitch: D(23), along: 'x', lod, seed: seed + 90, over: 0.25, gableOver: 0.2 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // The portico before it: four Tuscan columns on the terrace under a lean-to of tiles.
  const colH = 1.85;
  const cols = [Q.x0 + 0.45, Q.x0 + 2.05, Q.door + 1.25, Q.x1 - 0.45];
  for (const x of cols) out.stone.push(...tuscanColumn(0.15, colH, lod).map((g) => g.translate(x, top, Q.porchZ)));
  out.wood.push(board(W + 0.1, 0.32, 0.24, { tone: 0.8 }).translate(cx, top + colH, Q.porchZ));
  // The plaque on the architrave over the door: CLASSIS, the fleet, cut and painted red.
  const plY = top + colH + 0.03;
  const pz = Q.porchZ + 0.12;
  out.marble.push(slab(1.2, 0.26, 0.035, { bevel: 0.006, seed: seed + 60, wobble: 0, tone: 0, grime: 0.05 }).translate(Q.door, plY, pz + 0.012));
  if (lod === 0) out.letters.push(...inscription('CLASSIS', plY + 0.055, pz + 0.031, 0.15).map((g) => g.translate(Q.door, 0, 0)));
  else if (lod === 1) out.letters.push(tintGeometry(boxUV(new BoxGeometry(0.85, 0.12, 0.006).translate(Q.door, plY + 0.13, pz + 0.03))));
  const porch = leanTo({ L: W + 0.3, span: Q.z1 - Q.porchZ + 0.15, topY: Q.eave - 0.25, eaveY: top + colH + 0.32, lod, seed: seed + 95, over: 0.3 });
  for (const g of [...porch.tile, ...porch.wood]) g.translate(cx, 0, Q.z1);
  out.tile.push(...porch.tile);
  out.wood.push(...porch.wood);
}

/** The store shed on the east of the terrace: a lean-to on posts over racks of oars, a spare mast and sails. */
function store(out, lod, seed) {
  const top = S.top;
  const x0 = 1.05;
  const x1 = 5.75;
  const z0 = -5.45;
  const z1 = -3.65;
  // Its back wall of ashlar, the posts along the front, the roof.
  out.stone.push(...ashlar(x0, x1, top, top + 2.3, z0, z0 + 0.32, { seed, lod, course: 0.46 }));
  for (const x of [x0 + 0.12, (x0 + x1) / 2, x1 - 0.12]) out.wood.push(board(0.16, 2.0, 0.16, { tone: 0.8 }).translate(x, top, z1 - 0.1));
  out.wood.push(board(x1 - x0, 0.16, 0.18, { tone: 0.75 }).translate((x0 + x1) / 2, top + 1.98, z1 - 0.1));
  const roof = leanTo({ L: x1 - x0 + 0.3, span: z1 - z0 - 0.2, topY: top + 2.55, eaveY: top + 2.12, lod, seed: seed + 5, over: 0.3 });
  for (const g of [...roof.tile, ...roof.wood]) g.translate((x0 + x1) / 2, 0, z0 + 0.32);
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  if (lod === 2) return;
  // Oars on racks against the back wall, in tiers; a mast on trestles; bolts of sail linen; coils of rope.
  for (let t = 0; t < (lod ? 2 : 3); t++) {
    for (let k = 0; k < (lod ? 3 : 6); k++) {
      for (const g of oar(3.2, lod)) out.wood.push(g.rotateY(Math.PI / 2).translate(x0 + 0.5, top + 0.75 + t * 0.32, z0 + 0.45 + k * 0.07 + (t % 2) * 0.03));
    }
    if (lod === 0) for (const x of [x0 + 0.9, x0 + 3.0]) out.iron.push(tintGeometry(boxUV(new BoxGeometry(0.03, 0.03, 0.55).translate(x, top + 0.73 + t * 0.32, z0 + 0.55)), () => 0.8));
  }
  out.linen.push(...[0, 1, 2].map((k) => board(0.5, 0.28, 0.9, { tone: 0.95 - k * 0.04 }).translate(x1 - 0.55, top + k * 0.28, z1 - 0.75)));
  out.rope.push(...ropeCoil(x0 + 0.6, top, z1 - 0.55, 0.32, 4, lod));
}

/** The station's boat, a light tender moored in the basin: a liburnian's shell at a fifth of its size, without a ram. */
function tender(lod) {
  const h = liburnianHull(3, { lod: Math.min(2, lod + 1), seed: 9 });
  const out = [];
  for (const g of [...h.wood, ...h.paint]) {
    g.scale(0.44, 0.44, 0.44).rotateY(Math.PI / 2).translate(-1.1, -0.12, 2.6);
    out.push(g);
  }
  return out;
}

/** Build the naval station: { group, meshes, triangles }. */
export function buildStatio({ lod = 0, seed = 71, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = {
    flags: [], stone: [], tufa: [], brick: [], tile: [], wood: [], plaster: [], red: [], dark: [], iron: [], bronze: [], marble: [], letters: [],
    rope: [], linen: [], foam: [], embers: [], ash: [], doorOpen: [], doorShut: [],
  };
  terrace(out, lod, seed);
  mole(out, ...S.west, lod, seed + 100);
  mole(out, ...S.east, lod, seed + 200);
  tower(out, lod, seed + 300);
  principia(out, lod, seed + 500);
  store(out, lod, seed + 700);
  out.wood.push(...tender(lod));
  // The squadron's standard by the door: a pole, its crossbar, the red cloth with its fringe.
  const vx = S.hq.x1 + 0.35;
  const vz = S.hq.porchZ + 0.1;
  out.wood.push(board(0.07, 2.9, 0.07, { tone: 0.8 }).translate(vx, S.top, vz), board(0.7, 0.05, 0.05).translate(vx, S.top + 2.6, vz));
  out.stone.push(slab(0.36, 0.2, 0.36, { bevel: 0.02, seed: seed + 11, wobble: 0, tone: 0, grime: 0.2 }).translate(vx, S.top, vz));
  const red = harbourMaterials();
  const p = new TaggedParts('statio');
  const m = red;
  p.add('flags', m.stone, out.flags);
  p.add('stone', m.trav, out.stone);
  p.add('piers', m.tufa, out.tufa);
  p.add('brick', m.brick, out.brick);
  p.add('roof', m.tile, out.tile);
  p.add('timber', m.wood, out.wood);
  p.add('walls', m.plaster, out.plaster);
  p.add('dado', m.red, out.red);
  p.add('inside', m.dark, out.dark, { cast: false });
  p.add('plaque', material('marble', { surface: 'marble', vertexColors: true, snow: 1 }), out.marble);
  p.add('letters', material('inscription-red', { color: 0x6a1e14, roughness: 0.8, snow: 0.3 }), out.letters, { cast: false });
  p.add('vexillum', material('vexillum-red', { surface: 'wool', color: 0xa02a22, vertexColors: true, snow: 0.6 }), vexillum(vx, S.top + 2.6, vz, lod));
  if (lod < 2) {
    p.add('iron', m.iron, out.iron);
    p.add('bronze', m.bronze, out.bronze);
    p.add('rope', m.rope, out.rope);
    p.add('linen', m.linen, out.linen);
  }
  if (!ice) p.add('foam', m.foam, out.foam, { cast: false });
  p.add('doors', m.wood, out.doorOpen, { when: 'open' });
  p.add('doors', m.wood, out.doorShut, { when: 'shut' });
  p.add('fire', m.ember, out.embers, { when: 'open', cast: false });
  p.add('ash', material('cold-ash', { color: 0x4a4440, roughness: 0.95, snow: 1 }), out.ash, { when: 'shut' });
  // The lantern by the door.
  if (lod < 2) {
    const [lx, ly, lz] = S.lamp;
    const l = lantern(lx, ly, lz, lod);
    p.add('bronze', m.bronze, [...l.bronze, tube([[lx, ly + 0.42, S.hq.z1 + 0.01], [lx, ly + 0.42, lz - 0.08], [lx, ly + 0.36, lz]], 0.012, { radial: 4, segments: 4, around: 0.3 })]);
    p.add('lamp', lanternPane(), [l.pane], { when: 'open', cast: false });
    p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
  }
  // A sentry at the door and a sailor (a classiarius) on the west mole by a bollard.
  if (lod === 0) {
    const sentry = figureParts({ cloth: 0x7a3326, cloth2: 0x5a4a3a }, S.hq.door + 0.95, S.top, S.hq.porchZ + 0.55, 0.2);
    for (const f of sentry) p.add(`sentry-${f.material.name}`, f.material, [f.g], { when: 'open' });
    const sailor = figureParts({ cloth: 0x4a5a6a, reach: 0.7 }, S.west[1] - 0.75, S.top, 3.6, Math.PI / 2 + 0.3);
    for (const f of sailor) p.add(`sailor-${f.material.name}`, f.material, [f.g], { when: 'open' });
  }
  return p.build();
}

/** The vexillum: a square of red cloth hanging from its crossbar, a little waved, a fringe at its foot. */
function vexillum(x, y, z, lod) {
  const n = lod ? 3 : 8;
  const pos = [];
  const idx = [];
  const w = 0.6;
  const h = 0.62;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const v = j / n;
      pos.push(x - w / 2 + u * w, y - 0.03 - v * h, z + 0.04 * Math.sin(u * Math.PI * 2 + v) * v);
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
    }
  }
  const front = new BufferGeometry();
  front.setIndex(idx);
  front.setAttribute('position', new Float32BufferAttribute(pos, 3));
  front.computeVertexNormals();
  // Its back: the same cloth a hair behind, wound the other way (a face each way, each lit as it faces).
  const back = front.clone();
  back.translate(0, 0, -0.004);
  const bi = back.index.array;
  for (let i = 0; i < bi.length; i += 3) { const k = bi[i + 1]; bi[i + 1] = bi[i + 2]; bi[i + 2] = k; }
  back.computeVertexNormals();
  const tint = (px, py) => (py < y - h + 0.04 ? 0.7 : 1);
  return [tintGeometry(boxUV(front), tint), tintGeometry(boxUV(back), tint)];
}
