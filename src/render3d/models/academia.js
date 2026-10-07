/**
 * models/academia.js
 * ----------------------------------------------------------------------------
 * The academy of the 3D look: a school of rhetoric and philosophy on a
 * 3 x 3 footprint (12 m), from the record rather than the 2D sprite:
 *
 *   - Plato taught in the grove of the hero Academus outside Athens,
 *     Aristotle walking in the Lyceum's covered walk (the peripatos); the
 *     Romans took both over as the place of higher learning: Cicero named
 *     the two gymnasia of his Tusculan villa his Academy and his Lyceum, and
 *     young Romans went on to rhetors and philosophers after the grammarian.
 *   - Teachers held forth from an exedra, a half-round recess with a stone
 *     bench round it where a master sat among his pupils (the gymnasia's and
 *     the palaestrae's exedrae; the half-round bench is the "schola" of the
 *     tombs at Pompeii's Herculaneum Gate, with lion's-paw ends). Pupils of
 *     the rhetor practised declamations, suasoriae and controversiae, from a
 *     platform (Quintilian describes the school's declaiming and its
 *     audience); a sundial stood in every court (the hemispherical bowl of
 *     Berossus, the scaphe, found in fora and palaestrae); a herm of a
 *     philosopher (Plato's portrait is known from Roman herms); cypresses
 *     and clipped box in the walks of a Roman garden.
 *
 * So, in 12 m: at the back the exedra, its half-round bench and painted wall
 * on a step, a cypress at each end; two lecture rooms with tiled gables in
 * the back corners; a covered walk along the left side on red-and-white
 * columns, benches in its shade; a garden court of gravel walks and grass
 * edged in clipped box, the bowl of a sundial on its column where the walks
 * cross, a herm of Plato, a speaker's platform; a long bench along the
 * right wall; the gate a little propylon of two columns and a pediment, the
 * architrave cut ACADEMIA, lanterns on its columns.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the master in the exedra among his pupils, a pupil
 *           declaiming from the platform to two listeners, a reader on the
 *           long bench, two walking in the covered walk, the rooms' and the
 *           gate's doors open, the lanterns lit at night
 *   'shut'  no staff: the doors shut, nobody
 *
 * Metres, the middle at the origin, y up, the gate toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { slab, tuscanColumn, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin, gableRoof, D } from './rural.js';
import { staff, inscribe, people, gravel } from './castra.js';
import { learningMaterials, person, at, herm, capsa, arcSweep, roofSlope, cypress, hedge, box } from './learning.js';

/** The academy's measures (metres): the tests, the lab and the game read them. */
export const ACADEMIA = Object.freeze({
  half: 6,
  /** The exedra: its middle (x, z), its bench's front and back radius, its wall's outer radius and height, the step's height. */
  exedra: Object.freeze({ x: 0, z: -2.95, r0: 2.12, r1: 2.62, r2: 2.92, h: 2.35, step: 0.15 }),
  /** The lecture rooms: their inner side (|x|), front (z), eave. */
  rooms: Object.freeze({ x: 3.25, z: -3.3, eave: 2.7 }),
  /** The covered walk along the left: its columns' line (x), its front end (z), eave and top. */
  stoa: Object.freeze({ x: -4.4, z1: 4.6, eave: 2.35, top: 2.95 }),
  /** The sundial (x, z), the speaker's platform (x, z, w, d, h), the herm (x, z). */
  dial: Object.freeze([0, 1.0]),
  rostra: Object.freeze([2.55, -0.9, 1.3, 1.0, 0.62]),
  herm: Object.freeze([-2.0, -0.35]),
  /** The gate's opening and its columns' x. */
  gate: Object.freeze([-1.05, 1.05]),
  /** The lanterns hung in the gateway from its architrave (x, y, z), facing the street. */
  lamps: Object.freeze([Object.freeze([-0.62, 1.7, 5.83]), Object.freeze([0.62, 1.7, 5.83])]),
});

const A = ACADEMIA;
const H = 5.93;
const RED = lin(0xa83a26);

/** The exedra: its step, the half-round bench with lion's-paw ends, the painted wall with its cornice. */
function exedra(lod, seed, out) {
  const { x, z, r0, r1, r2, h, step } = A.exedra;
  const seg = lod === 2 ? 8 : lod ? 16 : 28;
  const a0 = Math.PI / 2;
  const a1 = Math.PI * 1.5;
  const at0 = (g) => g.translate(x, 0, z);
  // The step: a half disc of travertine (with its straight front) a hand over the garden.
  out.trav.push(at0(arcSweep([[r2, 0], [r2, step], [0.001, step], [0.001, 0]], a0, a1, { segments: seg, tint: () => 0.95 })));
  // The bench: its seat with a rounded lip, its riser.
  out.bench.push(at0(arcSweep([[r1, step], [r1, step + 0.45], [r0 - 0.05, step + 0.45], [r0 - 0.07, step + 0.41], [r0, step + 0.38], [r0, step]], a0, a1, { segments: seg, tint: (p) => 0.85 + 0.15 * Math.min(1, (p.y - step) / 0.45) })));
  // Its ends: blocks carved as lions' legs, a paw on the step.
  for (const s of [-1, 1]) {
    const cx = s * ((r0 + r1) / 2);
    out.bench.push(at0(slab(0.22, 0.62, r1 - r0 + 0.06, { bevel: 0.03, seed: seed + s, wobble: 0.003, tone: 0.03, grime: 0.3 }).translate(cx, step, -0.28)));
    if (lod < 2) {
      out.bench.push(at0(slab(0.24, 0.12, 0.2, { bevel: 0.04, seed: seed + 3 + s, wobble: 0.004, tone: 0, grime: 0.3 }).translate(cx, step, -0.1)));
      if (lod === 0) out.bench.push(at0(tintGeometry(boxUV(new CylinderGeometry(0.06, 0.08, 0.1, 8, 1).translate(cx, step + 0.67, -0.28)), () => 0.9)));
    }
  }
  // The wall: plaster, painted inside (a red dado, ochre above, a dark band between), a moulded cornice.
  // (By the profile's point: the doubled points at the bands' edges make them sharp.)
  const ochre = [0.86, 0.66, 0.36];
  const dark = [0.12, 0.09, 0.07];
  const red = [RED[0] * 2.2, RED[1] * 2.2, RED[2] * 2.2];
  const bands = [0.92, 0.92, ochre, ochre, dark, dark, red, red, red];
  const paint = (p, th, i) => bands[i];
  const wall = [[r2, 0], [r2, h], [r1, h], [r1, step + 1.22], [r1, step + 1.22], [r1, step + 1.15], [r1, step + 1.15], [r1, step + 0.45], [r1, step]];
  // (On down to the step behind the bench, so each end's cap, a fan from the outer foot, closes along the bottom.)
  out.plaster.push(at0(arcSweep(wall, a0, a1, { segments: seg, tint: paint })));
  out.trav.push(at0(arcSweep([[r2 + 0.06, h], [r2 + 0.06, h + 0.08], [r2 + 0.02, h + 0.14], [r1 - 0.05, h + 0.14], [r1 - 0.05, h + 0.06], [r1, h]], a0, a1, { segments: seg, tint: () => 0.95 })));
}

/** A lecture room in a back corner (s -1 the left, 1 the right): plaster walls, a door to the court, a tiled gable. */
function room(s, lod, seed, out) {
  const { x: xi, z: zf, eave } = A.rooms;
  const t = 0.26;
  const x0 = s < 0 ? -H : xi;
  const x1 = s < 0 ? -xi : H;
  const cx = (x0 + x1) / 2;
  const z0 = -H;
  const W = x1 - x0;
  // The walls: plaster on a travertine socle; the front with its door.
  out.trav.push(slab(W + 0.04, 0.3, zf - z0 + 0.04, { bevel: 0.015, seed, wobble: 0, tone: 0, grime: 0.35 }).translate(cx, 0, (z0 + zf) / 2));
  out.plaster.push(box(W, eave - 0.3, t, cx, 0.3, z0 + t / 2, 0.92));
  for (const xx of [x0 + t / 2, x1 - t / 2]) out.plaster.push(box(t, eave - 0.3, zf - z0 - 2 * t, xx, 0.3, (z0 + zf) / 2, 0.92));
  const dw = 1.0;
  const dh = 1.95;
  for (const [a, b] of [[x0, cx - dw / 2], [cx + dw / 2, x1]]) out.plaster.push(box(b - a, eave - 0.3, t, (a + b) / 2, 0.3, zf - t / 2, 0.92));
  out.plaster.push(box(dw, eave - 0.3 - dh, t, cx, 0.3 + dh, zf - t / 2, 0.92));
  out.dark.push(box(dw, dh, 0.02, cx, 0.3, zf - t + 0.02));
  // The dado either side of the door.
  for (const [a, b] of [[x0 + 0.01, cx - dw / 2 - 0.12], [cx + dw / 2 + 0.12, x1 - 0.01]]) out.red.push(box(b - a, 0.7, 0.012, (a + b) / 2, 0.3, zf + 0.006, 0.9));
  // The door's frame and its two leaves, open (swung in against the jambs) or shut.
  for (const k of [-1, 1]) out.trav.push(slab(0.12, dh + 0.02, t + 0.06, { bevel: 0.01, seed: seed + 3 + k, wobble: 0.002, tone: 0.04, grime: 0.25 }).translate(cx + k * (dw / 2 + 0.06), 0.3, zf - t / 2));
  out.trav.push(slab(dw + 0.4, 0.16, t + 0.08, { bevel: 0.012, seed: seed + 6, wobble: 0, tone: 0.04, grime: 0 }).translate(cx, 0.3 + dh, zf - t / 2));
  for (const k of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = box(dw / 2 - 0.01, dh - 0.02, 0.04, -k * (dw / 4), 0, 0, 0.75);
      leaf.rotateY(open ? -k * 1.65 : 0);
      leaf.translate(cx + k * dw / 2, 0.3, zf - t + 0.04);
      (open ? out.doorOpen : out.doorShut).push(leaf);
    }
  }
  // A step down to the garden.
  out.trav.push(slab(dw + 0.5, 0.15, 0.32, { bevel: 0.015, seed: seed + 8, wobble: 0.003, tone: 0.05, grime: 0.3 }).translate(cx, 0, zf + 0.18));
  // The roof: a tiled gable, its ridge running back from the court, its pediment toward the court.
  const roof = gableRoof({ x0: x0 + (s < 0 ? 0.2 : 0), x1: x1 - (s > 0 ? 0.2 : 0), z0: z0 + 0.2, z1: zf, eaveY: eave, pitch: D(22), along: 'z', lod, seed: seed + 9, over: 0.2, gableOver: 0.14 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  for (const zz of [zf - t / 2, z0 + t / 2]) {
    // (Under the roof's own span, inset 0.2 on the outer side: its apex under the ridge.)
    const half = (W - 0.2) / 2;
    const mid = cx + (s < 0 ? 0.1 : -0.1);
    const g = new BoxGeometry(2 * half - 0.02, 1, t, 2, 1, 1);
    g.translate(mid, 0.5, zz);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? eave + (roof.ridgeY - eave) * Math.max(0, 1 - Math.abs(p.getX(i) - mid) / half) : eave);
    g.computeVertexNormals();
    out.plaster.push(tintGeometry(boxUV(g), () => 0.92));
  }
}

/** The covered walk along the left: its back wall painted, columns red below and white above, a lean-to of tiles, benches. */
function stoa(lod, seed, out) {
  const { x: cx, z1, eave, top } = A.stoa;
  const t = 0.26;
  const z0 = A.rooms.z;
  // Its floor a step up, edged in travertine; the back wall.
  out.floor.push(box(cx + H - t, 0.12, z1 - z0, (-H + t + cx) / 2, 0, (z0 + z1) / 2, 0.95));
  out.trav.push(slab(0.34, 0.14, z1 - z0, { bevel: 0.012, seed, wobble: 0, tone: 0.03, grime: 0.3 }).translate(cx, 0, (z0 + z1) / 2));
  // (On to the front wall: the corner past the walk's end closed too.)
  out.plaster.push(box(t, top, H - z0, -H + t / 2, 0, (z0 + H) / 2, 0.92));
  out.red.push(box(0.012, 0.85, z1 - z0, -H + t + 0.006, 0.12, (z0 + z1) / 2, 0.9));
  out.ochre.push(box(0.012, top - 1.3, z1 - z0, -H + t + 0.006, 0.97, (z0 + z1) / 2, 1));
  if (lod < 2) out.paint.push(box(0.014, 0.05, z1 - z0, -H + t + 0.007, 0.95, (z0 + z1) / 2, lin(0x2a1e18)));
  // The front end: a wall closing the walk by the gate.
  out.plaster.push(box(cx + H, top - 0.2, t, (-H + cx) / 2, 0, z1 + t / 2, 0.92));
  // The columns, the beam, the roof.
  const colH = eave - 0.24 - 0.12;
  const n = lod === 2 ? 4 : 5;
  for (let k = 0; k < n; k++) {
    const z = z0 + 0.7 + (k * (z1 - z0 - 1.2)) / (n - 1);
    for (const g of tuscanColumn(0.12, colH, lod)) {
      const c = g.attributes.color;
      const p = g.attributes.position;
      for (let i = 0; i < c.count; i++) if (p.getY(i) < 0.8) c.setXYZ(i, c.getX(i) * RED[0] * 1.6, c.getY(i) * RED[1] * 1.6, c.getZ(i) * RED[2] * 1.6);
      out.plaster.push(g.translate(cx, 0.12, z));
    }
  }
  out.wood.push(box(0.22, 0.24, z1 - z0 + 0.2, cx, eave - 0.24, (z0 + z1) / 2, 0.85));
  const roof = roofSlope([[cx + 0.3, eave, z1 + 0.25], [cx + 0.3, eave, z0], [-H, top + 0.05, z0], [-H, top + 0.05, z1 + 0.25]], { lod, seed: seed + 5 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // Benches along the wall in its shade.
  for (const z of [-1.6, 1.6]) {
    out.shelter.push(slab(0.4, 0.06, 1.6, { bevel: 0.01, seed: seed + z, wobble: 0, tone: 0.03, grime: 0 }).translate(-H + t + 0.25, 0.5, z));
    for (const k of [-1, 1]) out.shelter.push(slab(0.36, 0.38, 0.14, { bevel: 0.01, seed: seed + z + k, wobble: 0.002, tone: 0.03, grime: 0.3 }).translate(-H + t + 0.25, 0.12, z + k * 0.62));
  }
}

/** The garden: gravel walks, grass, clipped box, the sundial, the herm, the platform, cypresses, the right wall's bench. */
function garden(lod, seed, out) {
  const xl = A.stoa.x + 0.17;
  const xr = H - 0.24;
  const zb = A.rooms.z;
  const zf = H - 0.24;
  // Gravel over the whole court; grass beds on it, their edges in clipped box.
  gravel(xl, xr, zb, zf, out);
  // (Three beds: the fourth quarter, behind the platform, is gravel where the listeners stand.)
  // (The front beds end short of the gate's leaves, swung back into the court.)
  const beds = [[xl + 0.55, -0.7, A.exedra.z + 0.35, 0.35], [xl + 0.55, -0.7, 1.65, zf - 1.25], [0.7, xr - 0.9, 1.65, zf - 1.25]];
  // (And the corner before the covered walk's end.)
  gravel(-H + 0.24, xl, A.stoa.z1 + 0.26, zf, out);
  beds.forEach(([x0, x1, z0, z1], i) => {
    // (The turf's earth tinted toward a watered green: a garden's grass, not the ramparts' turves.)
    out.turf.push(box(x1 - x0, 0.05, z1 - z0, (x0 + x1) / 2, 0.02, (z0 + z1) / 2, (x, y, z) => {
      const k = 0.85 + 0.15 * Math.cos(x * 2.1 + z * 1.7);
      return [0.55 * k, 0.95 * k, 0.42 * k];
    }));
    if (lod < 2) {
      const e = 0.14;
      out.leaf.push(...hedge(x0, x1, z0, z0 + e * 2, 0.32, { lod, seed: seed + i * 4 }), ...hedge(x0, x1, z1 - e * 2, z1, 0.32, { lod, seed: seed + i * 4 + 1 }));
      out.leaf.push(...hedge(x0, x0 + e * 2, z0 + e * 2, z1 - e * 2, 0.32, { lod, seed: seed + i * 4 + 2 }), ...hedge(x1 - e * 2, x1, z0 + e * 2, z1 - e * 2, 0.32, { lod, seed: seed + i * 4 + 3 }));
    }
  });
  // The cypresses at the exedra's ends.
  for (const s of [-1, 1]) {
    const c = cypress(s * 3.62, A.exedra.z + 0.2, 4.6, { lod, seed: seed + 10 + s });
    out.leaf.push(...c.leaf);
    out.wood.push(...c.wood);
  }
  // The sundial: a stone bowl (the scaphe) on a column where the walks cross, its gnomon and hour lines.
  const [dx, dz] = A.dial;
  for (const g of tuscanColumn(0.11, 1.0, lod)) out.trav.push(g.translate(dx, 0.03, dz));
  const bowl = revolve(profileOf([[0, 1.02], [0.2, 1.03], [0.27, 1.12], [0.29, 1.28], [0.27, 1.3], [0.23, 1.29], [0.17, 1.2], [0.08, 1.15], [0, 1.14]]), { segments: lod === 2 ? 8 : lod ? 14 : 24, metres: 0.6 });
  out.trav.push(bowl.translate(dx, 0.03, dz));
  if (lod < 2) {
    out.bronze.push(staff([dx, 1.17, dz - 0.18], [dx, 1.27, dz + 0.02], 0.008, 4));
    if (lod === 0) {
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI * (0.1 + 0.08 * k);
        const g = new BoxGeometry(0.006, 0.004, 0.09);
        g.translate(0, 0, 0.14);
        g.rotateX(0.75);
        g.rotateY(a + Math.PI / 2);
        g.translate(dx, 1.205, dz);
        out.paint.push(tintGeometry(boxUV(g), () => lin(0x3a2a20)));
      }
    }
  }
  // The herm of Plato by the walk.
  const [hx, hz] = A.herm;
  const hm = herm(hx, 0.03, hz, Math.PI * 0.2, { h: 1.75, lod, name: 'PLATO' });
  out.marble.push(...hm.stone);
  out.letters.push(...hm.letters);
  // The speaker's platform: a block of travertine with two steps at its side.
  const [rx, rz, rw, rd, rh] = A.rostra;
  out.trav.push(slab(rw, rh, rd, { bevel: 0.02, seed: seed + 20, wobble: 0.002, tone: 0.03, grime: 0.35 }).translate(rx, 0.03, rz));
  out.marble.push(slab(rw + 0.08, 0.06, rd + 0.08, { bevel: 0.012, seed: seed + 21, wobble: 0, tone: 0, grime: 0 }).translate(rx, 0.03 + rh, rz));
  for (let k = 0; k < 2; k++) out.trav.push(slab(0.32, (rh * (2 - k)) / 3, 0.7, { bevel: 0.012, seed: seed + 22 + k, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(rx + rw / 2 + 0.16 + k * 0.3, 0.03, rz));
  // The long bench along the right wall, the wall itself low, coped in tiles.
  out.trav.push(slab(0.42, 0.06, 4.0, { bevel: 0.01, seed: seed + 30, wobble: 0, tone: 0.03, grime: 0 }).translate(H - 0.55, 0.42, 2.6));
  for (const z of [0.9, 2.6, 4.3]) out.trav.push(slab(0.36, 0.42, 0.14, { bevel: 0.01, seed: seed + 31 + z, wobble: 0.002, tone: 0.03, grime: 0.3 }).translate(H - 0.55, 0, z));
  const w = 0.92;
  const t = 0.24;
  out.plaster.push(box(t, w, zf - zb, H - t / 2, 0, (zb + zf) / 2, 0.9));
  out.tile.push(box(t + 0.06, 0.06, zf - zb, H - t / 2 - 0.03, w, (zb + zf) / 2, 0.92));
}

/** The front wall and the gate: a propylon of two columns, an architrave cut ACADEMIA, a pediment, two doors. */
function gate(lod, seed, out) {
  const [g0, g1] = A.gate;
  const t = 0.24;
  const w = 0.92;
  const zc = H - t / 2;
  for (const [a, b] of [[-H, g0 - 0.2], [g1 + 0.2, H]]) {
    out.plaster.push(box(b - a, w, t, (a + b) / 2, 0, zc, 0.9));
    out.tile.push(box(b - a, 0.06, t + 0.06, (a + b) / 2, w, zc - 0.03, 0.92));
  }
  // The columns on their plinths, the architrave, the pediment of plastered brick with a stone cornice
  // (a hand inside the wall's line, so the plinths stay on the footprint).
  const colH = 2.12;
  const zp = zc - 0.1;
  for (const x of [g0 - 0.2, g1 + 0.2]) for (const g of tuscanColumn(0.14, colH, lod)) out.marble.push(g.translate(x, 0, zp));
  const aw = g1 - g0 + 0.9;
  out.marble.push(slab(aw, 0.3, 0.36, { bevel: 0.012, seed, wobble: 0, tone: 0, grime: 0 }).translate(0, colH, zp));
  if (lod === 0) out.letters.push(...inscribe('ACADEMIA', colH + 0.08, zp + 0.185, 0.15));
  else if (lod === 1) out.letters.push(box(1.2, 0.14, 0.006, 0, colH + 0.09, zp + 0.184));
  const ped = new BoxGeometry(aw, 1, 0.3, 2, 1, 1);
  ped.translate(0, 0.5, zp);
  const p = ped.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, colH + 0.3 + (p.getY(i) > 0.5 ? 0.5 * Math.max(0, 1 - Math.abs(p.getX(i)) / (aw / 2)) : 0));
  ped.computeVertexNormals();
  out.marble.push(tintGeometry(boxUV(ped), () => 0.9));
  if (lod < 2) {
    // Its raking cornice: two stone beams up to the apex.
    for (const s of [-1, 1]) out.marble.push(staff([s * (aw / 2 + 0.04), colH + 0.32, zp], [0, colH + 0.84, zp], 0.07, 4));
  }
  // The doors: two leaves, swung in against the wall or shut across.
  const leafW = (g1 - g0) / 2;
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = box(leafW - 0.02, 1.85, 0.05, -s * leafW / 2, 0, 0, 0.72);
      leaf.rotateY(open ? -s * 1.5 : 0);
      leaf.translate(s * g1, 0.02, zc - 0.15);
      (open ? out.doorOpen : out.doorShut).push(leaf);
    }
  }
  out.trav.push(slab(g1 - g0 + 0.2, 0.06, t + 0.1, { bevel: 0.01, seed: seed + 3, wobble: 0, tone: 0.03, grime: 0.3 }).translate(0, 0, zc));
}

/** The people (only close up): the master and his pupils in the exedra, a declaimer and his listeners, a reader, two walking. */
function scholars(mats) {
  const list = [];
  const things = { paper: [], leather: [], strap: [] };
  const { x, z, r0, r1, step } = A.exedra;
  const rs = (r0 + r1) / 2 - 0.08;
  const onBench = (a) => [x + rs * Math.sin(a), z + rs * Math.cos(a), Math.atan2(-Math.sin(a), -Math.cos(a))];
  // The master at the back of the exedra, his hand raised; three pupils on the bench either side of him.
  {
    const [mx, mz, ry] = onBench(Math.PI);
    list.push(...person(mats, { cloth: 0xe0d8c4, cloth2: 0x5a4a6a, hair: 0x8a8680, beard: true, long: true, sit: 0.45, arms: 'teach', lean: 0.05 }, mx, step, mz, ry));
  }
  const pupils = [[Math.PI * 0.72, 0x9a4a3a, 'read'], [Math.PI * 1.25, 0xc9bca2, 'chin'], [Math.PI * 1.4, 0x5a6a7a, 'lap']];
  pupils.forEach(([a, cloth, arms], i) => {
    const [px, pz, ry] = onBench(a);
    list.push(...person(mats, { cloth, cloth2: i === 0 ? 0xd8d0bc : null, hair: [0x2e2119, 0x4a3020, 0x1e1812][i], skin: [0xa87a58, 0xb88a64, 0x9a6c4c][i], sit: 0.45, arms, lean: 0.12 }, px, step, pz, ry));
    if (arms === 'read') {
      const [ox, oz] = at(px, pz, ry, 0, 0.32);
      const sheet = new BoxGeometry(0.34, 0.2, 0.004);
      sheet.rotateX(-0.5);
      sheet.rotateY(ry);
      sheet.translate(ox, step + 0.87, oz);
      things.paper.push(tintGeometry(boxUV(sheet), () => [0.88, 0.78, 0.58]));
    }
  });
  const c = capsa(x + 1.1, step, z - 1.6, { open: true, seed: 9 });
  for (const k of ['leather', 'paper', 'strap']) things[k].push(...c[k]);
  // A pupil declaiming from the platform, two listening below it.
  const [rx, rz, , , rh] = A.rostra;
  list.push(...person(mats, { cloth: 0xe8e0cc, cloth2: 0xf0e8d6, hair: 0x2e2119, long: true, arms: 'orate' }, rx, 0.03 + rh + 0.06, rz, -Math.PI / 2 - 0.25));
  list.push(...person(mats, { cloth: 0x7a5a8a, hair: 0x3a2a1a, arms: 'hold' }, rx - 1.45, 0.03, rz + 0.35, Math.PI / 2 + 0.2));
  list.push(...person(mats, { cloth: 0xb0884a, cloth2: 0xd8d0bc, hair: 0x2e2119, long: true }, rx - 1.35, 0.03, rz - 0.55, Math.PI / 2 - 0.3));
  // A reader on the long bench by the right wall.
  list.push(...person(mats, { cloth: 0x6a7a5a, hair: 0x4a3020, sit: 0.48, arms: 'read', lean: 0.15 }, H - 0.58, 0.0, 3.3, -Math.PI / 2));
  {
    const [ox, oz] = at(H - 0.58, 3.3, -Math.PI / 2, 0, 0.32);
    const sheet = new BoxGeometry(0.34, 0.2, 0.004);
    sheet.rotateX(-0.5);
    sheet.rotateY(-Math.PI / 2);
    sheet.translate(ox, 0.9, oz);
    things.paper.push(tintGeometry(boxUV(sheet), () => [0.88, 0.78, 0.58]));
  }
  // Two walking and talking in the covered walk.
  list.push(...person(mats, { cloth: 0xd8d0bc, cloth2: 0x8a3a2a, hair: 0x6a625a, beard: true, long: true, arms: 'reach' }, -4.95, 0.12, 0.6, Math.PI * 0.95));
  list.push(...person(mats, { cloth: 0xc9bca2, hair: 0x2e2119, arms: 'hold' }, -5.15, 0.12, -0.3, Math.PI * 0.05));
  return { list, things };
}

/** Build the academy: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildAcademia({ lod = 0, seed = 271 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['gravel', 'turf', 'leaf', 'trav', 'shelter', 'bench', 'plaster', 'red', 'ochre', 'paint', 'floor', 'tile', 'wood', 'marble', 'letters', 'bronze', 'dark', 'doorOpen', 'doorShut'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  garden(lod, seed, out);
  exedra(lod, seed + 40, out);
  room(-1, lod, seed + 60, out);
  room(1, lod, seed + 80, out);
  stoa(lod, seed + 100, out);
  gate(lod, seed + 120, out);
  const m = learningMaterials();
  if (lod === 2) {
    out.letters = out.bronze = [];
    // (Far out the snow on a bench is under a pixel: no part of its own, one draw call fewer.)
    out.trav.push(...out.shelter.splice(0));
  }
  const p = new TaggedParts('academia');
  const small = { cast: false };
  p.add('walks', m.gravel, out.gravel, small);
  p.add('grass', m.turf, out.turf, small);
  p.add('evergreens', m.leaf, out.leaf);
  p.add('stone', m.trav, [...out.trav, ...out.bench]);
  p.add('sheltered-stone', m.shelteredStone, out.shelter);
  p.add('walls', m.plaster, out.plaster);
  p.add('dado', m.red, out.red, small);
  p.add('panels', material('stucco-ochre', { surface: 'plaster', color: 0xd8b070, vertexColors: true, snow: 1 }), out.ochre, small);
  p.add('paint', m.paint, out.paint, small);
  p.add('floor', m.shelteredFloor, out.floor, small);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  p.add('marble', m.marble, out.marble);
  p.add('letters', m.letters, out.letters, small);
  p.add('bronze', m.bronze, out.bronze, small);
  p.add('inside', m.dark, out.dark, small);
  p.add('doors', m.wood, out.doorOpen, { when: 'open' });
  p.add('doors', m.wood, out.doorShut, { when: 'shut' });
  if (lod < 2) {
    for (const [lx, ly, lz] of A.lamps) {
      const l = lantern(lx, ly, lz, lod);
      // (Hung on a rod from the architrave over the gateway.)
      p.add('lantern', m.bronze, [...l.bronze, staff([lx, ly + 0.3, lz], [lx, 2.13, lz], 0.01, 4)], small);
      p.add('lamp', lanternPane(), [l.pane], { when: 'open', cast: false });
      p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
    }
  }
  if (lod === 0) {
    const { list, things } = scholars(m);
    people(p, m, 'scholars', list, 'open');
    p.add('held-rolls', m.papyrus, things.paper, { when: 'open', cast: false });
    p.add('capsa', m.leather, [...things.leather, ...things.strap], { when: 'open', cast: false });
  }
  return p.build();
}
