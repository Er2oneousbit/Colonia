/**
 * models/medicus.js
 * ----------------------------------------------------------------------------
 * The physician's of the 3D look: a medicus's consulting room on a 1 x 1
 * footprint (4 m), from the record rather than from the 2D sprite:
 *
 *   - Roman doctors, most of them Greeks, often freedmen, saw the sick in a
 *     taberna medica open to the street, where passers-by could watch (the
 *     Greek iatreion: the Hippocratic "In the Surgery" on its light, its
 *     instruments, its water). The House of the Surgeon at Pompeii gave
 *     some forty instruments of bronze and iron: scalpels, probes, forceps,
 *     hooks, catheters, a vaginal speculum, cupping vessels; others were
 *     found in their case at Rimini, with pots of drugs. Celsus (De
 *     medicina) describes the doctor's work: the pulse taken at the wrist,
 *     wounds dressed, limbs set, eyes salved; remedies compounded of herbs
 *     ground in a mortar and kept in little pots and boxes.
 *   - The physician's sign was Asclepius's: a knotted staff with a serpent
 *     coiled round it (his cult came to Rome from Epidaurus in 291 BC, to
 *     the Tiber island), and the cupping vessel cut on doctors' tombs.
 *
 * So, in 4 m: a room under a gabled roof whose pediment faces the street,
 * its walls washed yellow ochre, a wide opening to the street, MEDICVS on
 * the board over it; inside, the patient sitting on the couch, the doctor
 * standing before him, talking; an assistant grinding a remedy in the
 * mortar on the table, its instruments laid out on a cloth, a brazier of coals for
 * the cautery; a cabinet of pots and instruments, open; a shelf of jars,
 * herbs hung to dry; outside, a woman waiting on the bench with her child,
 * herbs in pots, and the staff of Asclepius on its pillar by the door.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the doctor, his assistant and patients, the cabinet
 *           open, the coals glowing, the lantern lit at night (the people
 *           are actors: medicusActors)
 *   'shut'  no staff: the boards across the front, the cabinet shut, the
 *           brazier cold, nobody
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z,
 * as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin, gableRoof, D } from './rural.js';
import { staff, inscribe } from './castra.js';
import { bush, box } from './learning.js';
import { healthMaterials, lectus, table, potRow, pot, mortar, asclepius, towel, inFrame, coals, wallWindow } from './healing.js';
import { DYES } from '../people/actors.js';
import { SEAT_H, MORTAR } from '../people/clips.js';

/** The physician's measures (metres): the tests, the lab and the game read them. */
export const MEDICUS = Object.freeze({
  half: 2,
  /** The facade's outer face (z), the room's floor. */
  front: 0.25,
  floorY: 0.1,
  /** The opening (x), its lintel's foot. */
  opening: Object.freeze([-1.3, 0.62]),
  lintel: 2.3,
  /** The eaves' height; the roof's pitch. */
  eave: 2.72,
  /** The couch: its middle (x, z), along x; its frame's height (the mattress's top then SEAT_H over the floor). */
  couch: Object.freeze([-0.62, -0.95]),
  couchH: SEAT_H - 0.12,
  /** The mortar on the table (x, z): its mouth MORTAR.height over the floor, where the assistant's pestle works (stir). */
  mortar: Object.freeze([1.2, -0.13]),
  /** The staff of Asclepius's pillar (x, z). */
  sign: Object.freeze([1.5, 1.2]),
  /** The lantern on its bracket by the door (x, y, z), facing the street. */
  lamp: Object.freeze([0.86, 2.02, 0.52]),
});

const M = MEDICUS;
const H = 1.95;
/** The house's sides (x): a little in from the footprint's, so its eaves stay inside it. */
const X = 1.9;
const W = 0.22;

/** The room: its floor, the walls washed ochre with a red dado, the pediment, the roof. */
function shell(lod, seed, out) {
  const zf = M.front;
  const zi = zf - W;
  const [o0, o1] = M.opening;
  const e = M.eave;
  out.floor.push(box(2 * X - 2 * W, M.floorY, zi + H - W, 0, 0, (zi - H + W) / 2, 0.95));
  out.trav.push(slab(o1 - o0 + 0.1, M.floorY + 0.01, W + 0.1, { bevel: 0.012, seed, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate((o0 + o1) / 2, 0, zf - W / 2 + 0.03));
  if (lod < 2) out.dark.push(box(o1 - o0 - 0.04, 0.004, 0.03, (o0 + o1) / 2, M.floorY + 0.008, zf - 0.07));
  // The facade: the piers either side of the opening, the wall over the lintel; a small barred window in the right pier.
  const [wx0, wx1, wy0, wy1] = [1.08, 1.56, 1.25, 1.85];
  out.ochre.push(box(o0 + X, e, W, (-X + o0) / 2, 0, zf - W / 2, 0.94));
  out.ochre.push(box(wx0 - o1, e, W, (o1 + wx0) / 2, 0, zf - W / 2, 0.94), box(X - wx1, e, W, (wx1 + X) / 2, 0, zf - W / 2, 0.94));
  out.ochre.push(box(wx1 - wx0, wy0, W, (wx0 + wx1) / 2, 0, zf - W / 2, 0.94), box(wx1 - wx0, e - wy1, W, (wx0 + wx1) / 2, wy1, zf - W / 2, 0.94));
  out.dark.push(box(wx1 - wx0, wy1 - wy0, 0.02, (wx0 + wx1) / 2, wy0, zf - W + 0.03));
  if (lod < 2) for (let k = 1; k < 4; k++) out.iron.push(box(0.018, wy1 - wy0, 0.018, wx0 + (k * (wx1 - wx0)) / 4, wy0, zf - 0.08, 0.7));
  out.trav.push(slab(wx1 - wx0 + 0.14, 0.06, W + 0.06, { bevel: 0.008, seed: seed + 4, wobble: 0, tone: 0, grime: 0 }).translate((wx0 + wx1) / 2, wy0 - 0.06, zf - W / 2 + 0.02));
  out.ochre.push(box(o1 - o0, e - M.lintel - 0.18, W, (o0 + o1) / 2, M.lintel + 0.18, zf - W / 2, 0.94));
  // A red dado to a metre along the front.
  for (const [a, b] of [[-X, o0], [o1, X]]) out.red.push(box(b - a - 0.01, 0.92, 0.012, (a + b) / 2, 0, zf + 0.006, 1));
  // The lintel, and the board over it: MEDICVS in red on white.
  out.wood.push(box(o1 - o0 + 0.36, 0.18, W + 0.04, (o0 + o1) / 2, M.lintel, zf - W / 2, 0.75));
  const sy = M.lintel + 0.2;
  const sx = (o0 + o1) / 2;
  out.board.push(box(1.5, 0.28, 0.03, sx, sy, zf + 0.015, lin(0xece4d0)));
  if (lod === 0) out.letters.push(...inscribe('MEDICVS', sy + 0.055, zf + 0.034, 0.17).map((g) => g.translate(sx, 0, 0)));
  else if (lod === 1) out.letters.push(box(1.16, 0.14, 0.006, sx, sy + 0.07, zf + 0.033));
  // The side and back walls, ochre outside; red and white inside.
  for (const s of [-1, 1]) {
    out.ochre.push(box(W, e, zi + H, s * (X - W / 2), 0, (zi - H) / 2, 0.92));
    out.red.push(box(0.012, 0.95, zi + H - 2 * W, s * (X - W - 0.006), M.floorY, (zi - H + W) / 2, 0.92));
  }
  out.ochre.push(box(2 * X - 2 * W, e, W, 0, 0, -H + W / 2, 0.92));
  // Windows to the back lane and the left side: what the far side shows.
  for (const win of [wallWindow(0, -H, Math.PI, { x: -0.6, y: 1.55, lod, seed: seed + 13 }), wallWindow(-X, -1.0, -Math.PI / 2, { y: 1.5, w: 0.36, h: 0.44, lod, seed: seed + 14 })]) {
    out.dark.push(...win.dark);
    out.trav.push(...win.stone);
    out.wood.push(...win.wood);
  }
  out.red.push(box(2 * X - 2 * W, 0.95, 0.012, 0, M.floorY, -H + W + 0.006, 0.92));
  // The roof: a gable, its ridge running back from the street, the pediment over the front.
  const over = 0.42;
  const roof = gableRoof({ x0: -X, x1: X, z0: -H + over + 0.01, z1: zf, eaveY: e, pitch: D(24), along: 'z', lod, seed: seed + 9, over: 0.04, gableOver: over });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // The gables: the front's a pediment, its raking cornice of travertine; the back's plain.
  for (const zz of [zf - W / 2, -H + W / 2]) {
    const g = new BoxGeometry(2 * X, 1, W, 4, 1, 1);
    g.translate(0, 0.5, zz);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? e + (roof.ridgeY - e) * Math.max(0, 1 - Math.abs(p.getX(i)) / X) - 0.04 : e);
    g.computeVertexNormals();
    out.ochre.push(tintGeometry(boxUV(g), () => 0.94));
  }
  if (lod < 2) {
    // The pediment's cornice along its foot, and the tympanum's round window (a clipeus of bronze grille).
    out.trav.push(slab(2 * X + 0.06, 0.08, 0.16, { bevel: 0.01, seed: seed + 12, wobble: 0, tone: 0, grime: 0 }).translate(0, e - 0.02, zf + 0.04));
    const c = new CylinderGeometry(0.17, 0.17, 0.04, lod ? 10 : 20, 1);
    c.rotateX(Math.PI / 2);
    c.translate(0, e + 0.38, zf + 0.01);
    out.bronze.push(tintGeometry(boxUV(c), () => 0.7));
  }
}

/** Outside: the pavement, the bench, the herbs in their pots, the pillar with the staff of Asclepius. */
function front(lod, seed, out) {
  const zf = M.front;
  out.flags.push(...paving(-H, H, zf, H, 0.06, seed, { rowW: 0.5, minL: 0.45, maxL: 0.9, lod }));
  // The bench along the facade right of the door.
  out.ochre.push(box(1.0, 0.4, 0.36, 1.4, 0.06, zf + 0.18, 0.9));
  out.trav.push(slab(1.06, 0.06, 0.42, { bevel: 0.012, seed: seed + 2, wobble: 0.002, tone: 0.04, grime: 0 }).translate(1.4, 0.46, zf + 0.19));
  // The pillar: a little altar-shaped base of travertine, the bronze staff on it.
  const [px, pz] = M.sign;
  out.trav.push(slab(0.38, 0.12, 0.38, { bevel: 0.015, seed: seed + 5, wobble: 0.002, tone: 0.04, grime: 0.4 }).translate(px, 0.06, pz));
  out.trav.push(slab(0.28, 0.72, 0.28, { bevel: 0.012, seed: seed + 6, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(px, 0.18, pz));
  out.trav.push(slab(0.36, 0.08, 0.36, { bevel: 0.012, seed: seed + 7, wobble: 0, tone: 0, grime: 0 }).translate(px, 0.9, pz));
  const a = asclepius(px, 0.98, pz, 1.05, { lod, ry: -0.6 });
  out.wood.push(...a.wood);
  out.snake.push(...a.snake);
  // Herbs in pots along the front (rosemary, rue, sage: a doctor's garden in pots).
  const pots = [[-1.65, 1.55, 0.19], [-1.2, 1.7, 0.16], [-0.78, 1.6, 0.17], [1.1, 1.7, 0.15]];
  pots.forEach(([x, z, r], i) => {
    out.terracotta.push(pot('jar', x, 0.06, z, 0.34, lod, 0.85 + 0.1 * (i % 2)));
    out.soil.push(box(0.2, 0.01, 0.2, x, 0.06 + 0.29, z));
    out.leaf.push(...bush(x, 0.06 + 0.34 + r * 0.7, z, r, { lod: Math.max(1, lod), seed: seed + 20 + i, squash: 1.25 }));
  });
}

/** Inside: the couch, the table of instruments, the cabinet, a shelf of jars, herbs drying, the brazier. */
function inside(lod, seed, out) {
  const y0 = M.floorY;
  const back = -H + W;
  // The couch along the back of the room, a pillow at its left end.
  const [cx, cz] = M.couch;
  // (Low enough to sit on: the mattress's top SEAT_H over the floor, the patient's seat.)
  const c = lectus(cx, cz, Math.PI / 2, { w: 0.72, l: 1.85, h: M.couchH, lod, tick: 0xd8ccb0 });
  out.shelter.push(...c.wood.map((g) => g.translate(0, y0, 0)));
  out.linen.push(...c.cloth.map((g) => g.translate(0, y0, 0)));
  // The table by the right wall: its cloth, the instruments laid on it, a cupping vessel, the mortar.
  // (Its top as high as puts the mortar's mouth where the assistant's pestle works: clips.js MORTAR.)
  const tx = H - W - 0.42;
  const tz = -0.45;
  const top = MORTAR.height - 0.12 - 0.008;
  out.shelter.push(...table(tx, tz, 0.62, 1.1, top).map((g) => g.translate(0, y0, 0)));
  out.linen.push(box(0.5, 0.008, 0.9, tx, y0 + top, tz, 0.95));
  if (lod < 2) {
    // The pestle is the assistant's while he grinds (an actor's prop): the kit's lies in the mortar only while shut.
    const [mo, pestle] = mortar(M.mortar[0], y0 + top + 0.008, M.mortar[1], lod);
    out.stone.push(mo);
    out.pestle.push(pestle);
  }
  if (lod === 0) {
    // Scalpels, probes and forceps of bronze in a row on the cloth, a cupping vessel (cucurbitula) beside them.
    for (let k = 0; k < 7; k++) out.instruments.push(box(0.012, 0.008, 0.13 + (k % 3) * 0.03, tx - 0.17 + k * 0.045, y0 + top + 0.01, tz - 0.12, 0.9));
    const cup = revolve(profileOf([[0, 0], [0.05, 0], [0.065, 0.04], [0.06, 0.09], [0.035, 0.12], [0.02, 0.13], [0, 0.13]]), { segments: 12, metres: 0.2 });
    out.instruments.push(tintGeometry(cup.translate(tx + 0.15, y0 + top + 0.01, tz - 0.32), () => 0.85));
  }
  // The cabinet (armarium) against the back wall right: shelves of pots and an instrument case; its doors open or shut.
  const ax = 0.95;
  const aw = 0.9;
  const ah = 1.7;
  const ad = 0.42;
  out.shelter.push(box(aw, 0.1, ad, ax, y0, back + ad / 2, 0.7));
  for (const s of [-1, 1]) out.shelter.push(box(0.04, ah, ad, ax + s * (aw / 2 - 0.02), y0, back + ad / 2, 0.8));
  out.shelter.push(box(aw + 0.06, 0.06, ad + 0.04, ax, y0 + ah, back + ad / 2 + 0.01, 0.9));
  out.dark.push(box(aw - 0.08, ah - 0.12, 0.01, ax, y0 + 0.1, back + 0.02));
  for (const yy of [0.55, 1.0, 1.4]) {
    out.shelter.push(box(aw - 0.08, 0.025, ad - 0.04, ax, y0 + yy, back + ad / 2 - 0.01, 0.85));
    if (lod === 0) out.terracotta.push(...potRow(ax - aw / 2 + 0.04, ax + aw / 2 - 0.04, y0 + yy + 0.025, back + ad / 2 - 0.02, { seed: seed + yy * 10, lod, s: 0.15 }));
  }
  if (lod < 2) {
    // The instrument case on the lowest shelf: a wooden box with its lid up.
    out.shelter.push(box(0.4, 0.08, 0.22, ax, y0 + 0.12, back + 0.2, 0.55));
  }
  const lw = aw / 2 - 0.01;
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = box(lw, ah - 0.14, 0.025, -s * lw / 2, 0, 0, 0.75);
      leaf.rotateY(open ? s * 1.9 : 0);
      leaf.translate(ax + s * (aw / 2 - 0.005), y0 + 0.1, back + ad + 0.012);
      (open ? out.doorOpen : out.doorShut).push(leaf);
    }
  }
  // A shelf of jars on the left wall, herbs hung to dry from a rod under it.
  const xl = -H + W;
  out.shelter.push(box(0.26, 0.04, 1.3, xl + 0.13, y0 + 1.55, -0.95, 0.8));
  if (lod < 2) {
    if (lod === 0) out.terracotta.push(...potRow(-0.62, 0.62, y0 + 1.59, 0, { seed: seed + 31, lod, s: 0.16 }).map((g) => g.rotateY(Math.PI / 2).translate(xl + 0.13, 0, -0.95)));
    out.shelter.push(box(0.03, 0.03, 1.3, xl + 0.2, y0 + 1.42, -0.95, 0.6));
    if (lod === 0) {
      // (Bundles hung head down from the rod by their stalks: sage, rue, wormwood, drying grey-green and brown.)
      for (let k = 0; k < 5; k++) {
        const z = -1.45 + k * 0.25;
        const g = new CylinderGeometry(0.045, 0.02, 0.2, 6, 1);
        g.translate(xl + 0.2, y0 + 1.22, z);
        out.herbs.push(tintGeometry(boxUV(g), () => [[0.09, 0.1, 0.05], [0.13, 0.1, 0.05], [0.07, 0.09, 0.06]][k % 3]));
        out.shelter.push(box(0.012, 0.1, 0.012, xl + 0.2, y0 + 1.32, z, 0.6));
      }
    }
  }
  // The brazier: a bronze bowl on three legs, coals in it (lit) or ash (cold).
  const [bx, bz] = [-0.15, -0.15];
  const bowl = revolve(profileOf([[0, 0.55], [0.18, 0.56], [0.22, 0.66], [0.23, 0.68], [0.2, 0.68], [0.16, 0.6], [0, 0.6]]), { segments: lod ? 10 : 18, metres: 0.3 });
  out.bronze.push(tintGeometry(bowl.translate(bx, y0, bz), () => 0.7));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    out.bronze.push(staff([bx + Math.cos(a) * 0.17, y0, bz + Math.sin(a) * 0.17], [bx + Math.cos(a) * 0.12, y0 + 0.58, bz + Math.sin(a) * 0.12], 0.014, 4));
  }
  const heap = coals(bx, y0 + 0.6, bz, 0.15, { seed: seed + 51, lod, n: lod ? 8 : 18 });
  out.coalsLit.push(...heap.hot);
  out.coalsCold.push(...heap.hot.map((g) => g.clone()));
  out.dark.push(...heap.dark);
}

/** The boards across the opening (shut). */
function boards(out) {
  const [o0, o1] = M.opening;
  const n = 7;
  const w = (o1 - o0) / n;
  for (let k = 0; k < n; k++) out.boardsShut.push(box(w - 0.012, M.lintel - M.floorY - 0.02, 0.045, o0 + (k + 0.5) * w, M.floorY + 0.01, M.front - 0.07, 0.68 + 0.08 * ((k * 37) % 3)));
  out.boardsShut.push(box(o1 - o0 + 0.1, 0.07, 0.05, (o0 + o1) / 2, 1.15, M.front - 0.02, 0.6));
}

/** A towel over the couch's end (staffed: put away while shut). */
function couchTowel(out) {
  const [cx, cz] = M.couch;
  out.linen.push(...towel(cx - 0.8, M.floorY + M.couchH + 0.12, cz, { w: 0.3, drop: 0.25, d: 0.72, ry: Math.PI / 2 }));
}

/**
 * The physician's people while it is open (people/actors.js specs, the
 * room's metres): the patient sitting on the couch's edge, turned to the
 * doctor, who stands before him in his Greek mantle and talks (the two face
 * each other across the street's diagonal, so the game's camera, which
 * looks in from the street's corner, sees both in profile); the assistant
 * standing at the table grinding a remedy in the mortar (stir: the clip's
 * MORTAR is the mortar's mouth, placed to meet it); outside on the bench a
 * mother in her stola and palla, her small son standing at her knee.
 * Nobody while it is shut.
 */
export function medicusActors(state) {
  if (state !== 'open') return [];
  const y0 = M.floorY;
  const [cx, cz] = M.couch;
  // (The couch's mattress is SEAT_H over the floor: the patient's feet on the floor.)
  const px = cx + 0.25;
  const pz = cz + 0.1;
  const pry = -Math.PI / 4;
  const [dx, dz] = inFrame(px, pz, pry, 0.05, 0.92);
  // The assistant faces +x (ry pi/2): his ahead the model's +x, his left its -z; the mortar MORTAR.ahead before him.
  const [mx, mz] = M.mortar;
  const ax = mx - MORTAR.ahead;
  const az = mz - 0.02;
  // The mother's bench by the door: its top SEAT_H over the pavement.
  const [bx, bz, bry] = [1.6, M.front + 0.22, 0.2];
  const [kx, kz] = inFrame(bx, bz, bry, -0.48, 0.5);
  return [
    { body: 'm', dress: ['tunic:knee'], hair: 'curls', clip: 'sit', at: [px, y0, pz], ry: pry, seed: 331, colours: { tunic: DYES.madder } },
    { body: 'm', dress: ['tunic:long', 'pallium'], hair: 'bald', beard: 'full', old: true, clip: 'talk', at: [dx, y0, dz], ry: pry + Math.PI, seed: 332, colours: { tunic: DYES.white, mantle: DYES.woad } },
    { body: 'm', dress: ['tunic:short'], hair: 'crop', clip: 'stir', props: { R: 'pestle' }, at: [ax, y0, az], ry: Math.PI / 2, seed: 333, colours: { tunic: DYES.oatmeal, skin: 0x8c5e40 } },
    { body: 'f', dress: ['tunic:long:stola', 'palla'], hair: 'bun', clip: 'sit', at: [bx, 0.06, bz], ry: bry, seed: 334, colours: { tunic: DYES.saffron, mantle: DYES.oxblood } },
    { body: 'c', dress: ['tunic:knee', 'bulla'], hair: 'curls', clip: 'listen', at: [kx, 0.06, kz], ry: 2.3, seed: 335, colours: { tunic: DYES.white, trim: DYES.white } },
  ];
}

/** Build the physician's: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildMedicus({ lod = 0, seed = 331 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['flags', 'floor', 'shelter', 'trav', 'stone', 'ochre', 'red', 'paint', 'tile', 'wood', 'dark', 'board', 'letters', 'iron', 'bronze', 'snake',
    'linen', 'terracotta', 'soil', 'leaf', 'herbs', 'instruments', 'doorOpen', 'doorShut', 'boardsShut', 'coalsLit', 'coalsCold', 'pestle'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  shell(lod, seed, out);
  front(lod, seed + 20, out);
  inside(lod, seed + 40, out);
  boards(out);
  const m = healthMaterials();
  if (lod === 2) {
    out.wood.push(...out.shelter.splice(0));
    // (The big pots by the door stay, with their herbs: the shelves' small ones are left out already.)
    out.letters = out.iron = out.instruments = out.stone = out.soil = [];
    out.bronze.push(...out.snake.splice(0));
  }
  const p = new TaggedParts('medicus');
  const small = { cast: false };
  p.add('pavement', m.flags, out.flags, small);
  p.add('floor', m.shelteredFloor, out.floor, small);
  p.add('stone', m.trav, [...out.trav, ...out.stone]);
  p.add('walls', material('stucco-ochre', { surface: 'plaster', color: 0xd8b070, vertexColors: true, snow: 1 }), out.ochre);
  p.add('dado', m.red, out.red, small);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  p.add('sheltered-wood', m.shelteredWood, out.shelter);
  p.add('paint', m.paint, [...out.paint, ...out.board], small);
  p.add('letters', m.letters, out.letters, small);
  p.add('inside', m.dark, out.dark, small);
  p.add('iron', m.iron, out.iron, small);
  p.add('bronze', m.bronze, out.bronze, small);
  // (The serpent of gilt bronze, bright on its dark staff.)
  p.add('serpent', m.gilt, out.snake, small);
  p.add('instruments', m.gilt, out.instruments, small);
  p.add('linen', m.linen, out.linen, small);
  p.add('pots', m.clay, out.terracotta, small);
  p.add('soil', m.soil, out.soil, small);
  p.add('herbs', m.leaf, [...out.leaf, ...out.herbs], small);
  p.add('cabinet-doors', m.shelteredWood, out.doorOpen, { when: 'open', cast: false });
  p.add('cabinet-doors', m.shelteredWood, out.doorShut, { when: 'shut', cast: false });
  p.add('boards', m.wood, out.boardsShut, { when: 'shut' });
  p.add('coals', m.embers, out.coalsLit, { when: 'open', cast: false });
  p.add('coals', m.ash, out.coalsCold, { when: 'shut', cast: false });
  if (lod < 2) {
    const [lx, ly, lz] = M.lamp;
    const l = lantern(lx, ly, lz, lod);
    p.add('lantern', m.bronze, [...l.bronze, staff([lx, ly + 0.3, lz], [lx, ly + 0.42, lz], 0.01, 4), staff([lx, ly + 0.42, lz], [lx, ly + 0.42, M.front], 0.012, 4)], small);
    p.add('lamp', lanternPane(), [l.pane], { when: 'open', cast: false });
    p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
  }
  // The pestle in the mortar while nobody grinds; the towel on the couch while it is open. (The people are actors: medicusActors.)
  p.add('pestle', m.trav, out.pestle, { when: 'shut', cast: false });
  if (lod < 2) {
    const towels = { linen: [] };
    couchTowel(towels);
    p.add('dressings', m.linen, towels.linen, { when: 'open', cast: false });
  }
  return p.build();
}
