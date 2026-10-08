/**
 * models/tonstrina.js
 * ----------------------------------------------------------------------------
 * The barber's of the 3D look: a tonstrina on a 1 x 1 footprint (4 m), from
 * what is known of Roman barbers rather than from the 2D sprite:
 *
 *   - The barber (tonsor) kept a taberna, a one-room shop opening onto the
 *     street across its whole width, as the shops of Pompeii and Ostia did:
 *     a travertine sill with a groove for the boards that shut it at night,
 *     brick or tufa piers either side, a wooden lintel, a room behind with a
 *     mezzanine under a roof of tiles. Masonry benches flanked the doors of
 *     many Pompeian shops, and the barber's were where the waiting talked.
 *   - The barber's was the town's place for gossip (Plautus, Horace,
 *     Martial): men sat waiting their turn, idlers came for the news.
 *     Martial (7.61) praises Domitian for clearing the shops off the street,
 *     where a barber had shaved his man in the middle of the crowd, razor
 *     drawn. The client sat on a stool under a cloth (involucrum) while the
 *     barber shaved him with an iron razor (novacula), clipped with shears
 *     (forfex), and trimmed nails; a mirror of polished bronze let the
 *     client see the work; water warmed and a basin, towels.
 *
 * So, in 4 m: the shop open to the street between two piers, TONSOR painted
 * on a whitened board over the lintel, a lean-to roof of tiles sloping down
 * to the street; outside on the pavement the client on his stool, cloaked in
 * linen, the barber at his side shaving him, a basin on its stand with a
 * towel; a man waiting on the bench, another standing to talk; inside, the
 * bronze mirror on the back wall, a shelf of pots and razors, towels on a
 * rail, a bench and a chair; the boards that shut the shop stacked against
 * the wall.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the barber at work and his customers, the stool, basin
 *           and towels out, the shop open, its boards stacked inside, the
 *           lantern lit at night (the people are actors: tonstrinaActors)
 *   'shut'  no staff: the boards across the front, nobody
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z,
 * as models/well.js. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin } from './rural.js';
import { staff, inscribe } from './castra.js';
import { roofSlope, box } from './learning.js';
import { healthMaterials, stool, basinStand, towel, potRow, pot, wallWindow } from './healing.js';
import { DYES } from '../people/actors.js';
import { SEAT_H, SHAVE } from '../people/clips.js';

/** The barber's measures (metres): the tests, the lab and the game read them. */
export const TONSTRINA = Object.freeze({
  half: 2,
  /** The facade's outer face (z), the shop's floor (a step up from the pavement). */
  front: 0.15,
  floorY: 0.1,
  /** The opening between the piers (x), its lintel's foot. */
  opening: Object.freeze([-1.12, 1.12]),
  lintel: 2.38,
  /** The roof: its eave (z, y) over the street and its top over the back wall. */
  eave: Object.freeze([0.55, 3.5]),
  ridge: Object.freeze([-1.97, 4.25]),
  /** The client's stool (x, z), its seat's height over the pavement (the seated clips' SEAT_H). */
  stool: Object.freeze([-0.2, 0.98, SEAT_H]),
  /** The pavement's top: where the people stand. */
  pavement: 0.06,
  /** The lantern on its bracket by the right pier (x, y, z), facing the street. */
  lamp: Object.freeze([1.5, 2.06, 0.42]),
});

const T = TONSTRINA;
const H = 1.95;
const W = 0.22; // the walls' thickness

/** The roof's underside over z (the lean-to's rake). */
function roofY(z) {
  const [ez, ey] = T.eave;
  const [rz, ry] = T.ridge;
  return ey + ((z - ez) * (ry - ey)) / (rz - ez);
}

/** A box from x0..x1, z0..z1 whose top follows the roof's rake, from y0 (a side wall under the lean-to). */
function raked(x0, x1, z0, z1, y0, drop = 0.05) {
  const g = new BoxGeometry(x1 - x0, 1, z1 - z0);
  g.translate((x0 + x1) / 2, 0.5, (z0 + z1) / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? roofY(p.getZ(i)) - drop : y0);
  g.computeVertexNormals();
  return tintGeometry(boxUV(g), () => 0.94);
}

/** The shop's shell: the piers, the lintel and the wall over it, the side and back walls, the floor, the sill, the roof. */
function shell(lod, seed, out) {
  const zf = T.front;
  const [o0, o1] = T.opening;
  const zi = zf - W; // the facade's inner face
  // The floor of the shop, a step up; the sill across its mouth, grooved for the boards.
  out.floor.push(box(2 * H - 2 * W, T.floorY, zi + H - W, 0, 0, (zi - H + W) / 2, 0.95));
  out.trav.push(slab(o1 - o0 + 0.1, T.floorY + 0.01, W + 0.1, { bevel: 0.012, seed, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(0, 0, zf - W / 2 + 0.03));
  if (lod < 2) out.dark.push(box(o1 - o0 - 0.04, 0.004, 0.03, 0, T.floorY + 0.008, zf - 0.07));
  // The piers: tufa blocks banded with brick (opus vittatum), here plaster over rubble, quoins of travertine.
  for (const [a, b] of [[-H, o0], [o1, H]]) {
    out.plaster.push(box(b - a, roofY(zf) - 0.04, W, (a + b) / 2, 0, zf - W / 2, 0.93));
    // A dado of red to a metre on the pier's face, as on the shops of the Via dell'Abbondanza.
    out.red.push(box(b - a - 0.02, 0.95, 0.012, (a + b) / 2, 0, zf + 0.006, 1));
  }
  for (const x of [o0 - 0.08, o1 + 0.08]) {
    for (let k = 0; k < (lod === 2 ? 1 : 5); k++) {
      const h = lod === 2 ? T.lintel : T.lintel / 5;
      out.trav.push(slab(0.18, h - 0.01, W + 0.03, { bevel: 0.01, seed: seed + k * 3 + x * 7, wobble: lod ? 0 : 0.003, tone: 0.06, grime: k ? 0 : 0.3 }).translate(x, k * h, zf - W / 2));
    }
  }
  // The lintel, a squared beam, and the wall over it up to the roof.
  out.wood.push(box(o1 - o0 + 0.5, 0.2, W + 0.04, 0, T.lintel, zf - W / 2, 0.75));
  out.plaster.push(box(o1 - o0, roofY(zf) - T.lintel - 0.24, W, 0, T.lintel + 0.2, zf - W / 2, 0.95));
  // The sign: a whitened board on the wall over the lintel, TONSOR in red.
  const sy = T.lintel + 0.32;
  out.board.push(box(1.3, 0.34, 0.03, 0, sy, zf + 0.015, lin(0xece4d0)));
  if (lod < 2) out.wood.push(box(1.36, 0.035, 0.05, 0, sy - 0.02, zf + 0.02, 0.6), box(1.36, 0.035, 0.05, 0, sy + 0.33, zf + 0.02, 0.6));
  if (lod === 0) out.letters.push(...inscribe('TONSOR', sy + 0.07, zf + 0.034, 0.2));
  else if (lod === 1) out.letters.push(box(1.0, 0.16, 0.006, 0, sy + 0.09, zf + 0.033));
  // The side walls under the rake, a window high in the right one (the mezzanine's), the back wall.
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -H : H - W;
    const win = s > 0 && lod < 2;
    if (!win) out.plaster.push(raked(x0, x0 + W, -H, zf - W, 0));
    else {
      // (The window's opening cut through: the wall in three pieces round it.)
      const [wz0, wz1, wy0, wy1] = [-1.05, -0.45, 2.75, 3.3];
      out.plaster.push(raked(x0, x0 + W, -H, wz0, 0), raked(x0, x0 + W, wz1, zf - W, 0));
      out.plaster.push(box(W, wy0, wz1 - wz0, x0 + W / 2, 0, (wz0 + wz1) / 2, 0.94));
      out.plaster.push(raked(x0, x0 + W, wz0, wz1, wy1));
      out.dark.push(box(0.02, wy1 - wy0, wz1 - wz0, x0 + 0.03, wy0, (wz0 + wz1) / 2));
      out.trav.push(slab(0.08, 0.06, wz1 - wz0 + 0.12, { bevel: 0.008, seed: seed + 9, wobble: 0, tone: 0, grime: 0 }).translate(H - 0.005, wy0 - 0.06, (wz0 + wz1) / 2));
      // Its shutter, swung back against the wall, and a pot of basil on the sill.
      out.wood.push(box(0.03, wy1 - wy0 - 0.04, 0.3, H + 0.015, wy0 + 0.02, wz1 + 0.17, 0.7));
      out.terracotta.push(pot('jar', H - 0.02, wy0, (wz0 + wz1) / 2 - 0.12, 0.13, lod, 0.9));
    }
    // The red dado inside each side wall.
    out.red.push(box(0.012, 1.0, zi + H - 2 * W, s * (H - W - 0.006), T.floorY, (zi - H + W) / 2, 0.9));
  }
  out.plaster.push(box(2 * H - 2 * W, roofY(-H + W / 2) - 0.04, W, 0, 0, -H + W / 2, 0.93));
  // The mezzanine's window to the back lane, and one low on the left wall: what the far side shows.
  for (const win of [wallWindow(0, -H, Math.PI, { x: 0.5, y: 2.85, lod, seed: seed + 13 }), wallWindow(-H, -0.9, -Math.PI / 2, { y: 1.5, w: 0.36, h: 0.4, lod, seed: seed + 14 })]) {
    out.dark.push(...win.dark);
    out.trav.push(...win.stone);
    out.wood.push(...win.wood);
  }
  // Inside the back wall: red below, a yellow ochre panel above, a dark band between (the Third Style's plain shop walls).
  out.red.push(box(2 * H - 2 * W - 0.02, 1.0, 0.012, 0, T.floorY, -H + W + 0.006, 1));
  out.ochre.push(box(2 * H - 2 * W - 0.02, 1.25, 0.012, 0, T.floorY + 1.06, -H + W + 0.006, 1));
  if (lod < 2) out.paint.push(box(2 * H - 2 * W - 0.02, 0.06, 0.014, 0, T.floorY + 1.0, -H + W + 0.007, lin(0x2a1e18)));
  // The roof: one slope of tiles from the eave over the pavement up over the back wall.
  const [ez, ey] = T.eave;
  const [rz, ry] = T.ridge;
  const roof = roofSlope([[-H - 0.04, ey, ez], [H + 0.04, ey, ez], [H + 0.04, ry, rz], [-H - 0.04, ry, rz]], { lod, seed: seed + 11 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // The joists' ends of the mezzanine floor, out through the facade under the eave.
  if (lod === 0) for (let k = 0; k < 6; k++) out.wood.push(box(0.1, 0.12, 0.3, -1.6 + k * 0.64, roofY(zf) - 0.34, zf + 0.12, 0.65));
}

/** The pavement before the shop and the benches either side of its mouth. */
function street(lod, seed, out) {
  const zf = T.front;
  out.flags.push(...paving(-H, H, zf, H, 0.06, seed, { rowW: 0.5, minL: 0.45, maxL: 0.9, lod }));
  // The benches: masonry, plastered, a slab of travertine for a seat.
  for (const s of [-1, 1]) {
    const x = s * 1.52;
    out.plaster.push(box(0.7, 0.4, 0.38, x, 0.06, zf + 0.19, 0.9));
    out.red.push(box(0.7, 0.34, 0.012, x, 0.06, zf + 0.386, 0.95));
    out.trav.push(slab(0.76, 0.06, 0.44, { bevel: 0.012, seed: seed + s, wobble: 0.002, tone: 0.04, grime: 0 }).translate(x, 0.46, zf + 0.2));
  }
}

/** Inside: the mirror, the shelf of pots and razors, the towels on their rail, a bench and a chair. */
function inside(lod, seed, out) {
  const back = -H + W;
  const y0 = T.floorY;
  // The mirror: a disc of polished bronze in a wooden frame on the back wall, where a client could see himself.
  const seg = lod ? 12 : 28;
  const disc = new CylinderGeometry(0.21, 0.21, 0.02, seg, 1);
  disc.rotateX(Math.PI / 2);
  disc.translate(0.55, y0 + 1.52, back + 0.04);
  out.gilt.push(tintGeometry(boxUV(disc)));
  const rim = new CylinderGeometry(0.25, 0.25, 0.03, seg, 1);
  rim.rotateX(Math.PI / 2);
  rim.translate(0.55, y0 + 1.52, back + 0.025);
  out.shelter.push(tintGeometry(boxUV(rim), () => 0.55));
  // The shelf, on two brackets, with pots of ointment and depilatory, a razor case, combs.
  out.shelter.push(box(1.3, 0.04, 0.26, -0.75, y0 + 1.2, back + 0.13, 0.8));
  if (lod < 2) {
    for (const x of [-1.3, -0.2]) out.shelter.push(box(0.04, 0.16, 0.22, x, y0 + 1.04, back + 0.11, 0.6));
    out.terracotta.push(...potRow(-1.36, -0.5, y0 + 1.24, back + 0.13, { seed: seed + 3, lod, s: 0.15 }));
    // The razors' box, open: their iron blades in a row.
    out.shelter.push(box(0.26, 0.05, 0.14, -0.32, y0 + 1.24, back + 0.12, 0.6));
    if (lod === 0) for (let k = 0; k < 4; k++) out.iron.push(box(0.03, 0.012, 0.11, -0.41 + k * 0.06, y0 + 1.29, back + 0.12, 0.9));
  }
  // The towels' rail on the left wall, towels hung over it.
  const xl = -H + W;
  out.shelter.push(box(0.04, 0.04, 1.1, xl + 0.1, y0 + 1.35, -0.75, 0.7));
  if (lod < 2) for (const z of [-1.1, -0.72, -0.36]) out.linen.push(...towel(xl + 0.1, y0 + 1.37, z, { w: 0.3, drop: 0.42, ry: Math.PI / 2, tone: z === -0.72 ? 0.85 : 1 }));
  // A bench along the right wall for the waiting, a chair by the mirror.
  out.shelter.push(box(0.36, 0.05, 1.1, H - W - 0.2, y0 + 0.4, -1.0, 0.82));
  for (const z of [-1.45, -0.55]) out.shelter.push(box(0.3, 0.4, 0.05, H - W - 0.2, y0, z, 0.66));
  if (lod < 2) {
    out.shelter.push(box(0.42, 0.04, 0.42, 0.55, y0 + 0.44, back + 0.75, 0.82));
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) out.shelter.push(box(0.04, 0.44, 0.04, 0.55 + dx, y0, back + 0.75 + dz, 0.6));
    out.shelter.push(box(0.42, 0.5, 0.04, 0.55, y0 + 0.48, back + 0.55, 0.75));
  }
}

/** The boards that shut the shop: across its mouth in their groove (shut), or stacked against the left wall inside (open). */
function boards(lod, out) {
  const [o0, o1] = T.opening;
  const n = 8;
  const w = (o1 - o0) / n;
  for (let k = 0; k < n; k++) {
    const x = o0 + (k + 0.5) * w;
    out.boardsShut.push(box(w - 0.012, T.lintel - T.floorY - 0.02, 0.045, x, T.floorY + 0.01, T.front - 0.07, 0.68 + 0.08 * ((k * 37) % 3)));
  }
  if (lod < 2) {
    // A bar across them, its iron staple in the pier.
    out.boardsShut.push(box(o1 - o0 + 0.1, 0.07, 0.05, 0, 1.2, T.front - 0.02, 0.6));
  }
  // Stacked: leaning on the inside of the left pier, two deep.
  for (let k = 0; k < (lod === 2 ? 1 : 4); k++) {
    const g = box(w - 0.012, T.lintel - T.floorY - 0.1, 0.045, 0, 0, 0, 0.7);
    g.rotateX(-0.12);
    g.translate(-1.55 + (k % 2) * 0.04, T.floorY, T.front - W - 0.12 - Math.floor(k / 2) * 0.06 - (k % 2) * 0.02);
    out.boardsOpen.push(g);
  }
}

/** The work outside (staffed): the client's stool, the basin on its stand with a towel, a jug, the cloth over the client. */
function work(lod, out) {
  const [sx, sz, sh] = T.stool;
  const seat = T.pavement + sh;
  out.workWood.push(...stool(sx, sz, seat, lod));
  const b = basinStand(0.62, 1.0, { h: 0.84, r: 0.2, lod });
  out.workBronze.push(...b.stand, ...b.bowl);
  if (b.water) out.workWater.push(b.water);
  if (lod < 2) {
    out.workLinen.push(...towel(0.62, 0.86, 0.79, { w: 0.24, drop: 0.3, d: 0.03 }));
    out.workClay.push(pot('amph', 0.98, 0.06, 1.25, 0.34, lod, 0.95));
  }
  // The cloth over the client (tonstrinaActors: he sits still under it): a linen cape from his neck to
  // below his knees, turned about him and drawn forward over his lap (its open hem faces the ground,
  // which the camera never sees from below). At every level, as the client is.
  const g = revolve(profileOf([[0.4, -0.1], [0.38, 0.1], [0.32, 0.34], [0.25, 0.5], [0.2, 0.58], [0.12, 0.64], [0.07, 0.66]]), {
    segments: lod === 2 ? 8 : lod ? 12 : 20,
    metres: 0.3,
    deform: (q) => {
      // (Its front pulled forward over the knees, more toward the hem.)
      if (q.z > 0) q.z *= 1 + 0.9 * Math.max(0, 0.45 - q.y);
    },
    tint: (q) => 0.82 + 0.18 * Math.min(1, (q.y + 0.1) / 0.6),
  });
  out.workCloth.push(g.translate(sx, seat, sz + 0.04));
}

/** The client's head's middle in his own frame as the shaved clip holds it (1.2 up, a hand behind his feet's place). */
export const CLIENT_HEAD = Object.freeze([0, SHAVE.head[1], -0.105]);

/**
 * The barber's people while it is open (people/actors.js specs, the shop's
 * metres): the client on his stool under the cloth, his head tipped back
 * (shaved); the barber at his right side shaving him, his left hand on the
 * client's head, the razor down the near cheek (shave: the clip's SHAVE.head
 * is the client's head in the barber's frame, so the two are placed to
 * meet); a man waiting his turn on the bench by the door; another on the
 * pavement in his pallium, talking (the barber's was the town's news).
 * Nobody while it is shut.
 */
export function tonstrinaActors(state) {
  if (state !== 'open') return [];
  const [sx, sz] = T.stool;
  const y = T.pavement;
  // The client faces the street (+z), his hips over the stool's middle (the seated clips put them 0.03 behind the feet's place).
  const client = [sx, y, sz + 0.03];
  const head = [client[0] + CLIENT_HEAD[0], y + CLIENT_HEAD[1], client[2] + CLIENT_HEAD[2]];
  // The barber faces +x (ry pi/2): his ahead is the model's +x, his left its -z; the head is SHAVE.head in his frame.
  const [hx, , hz] = SHAVE.head;
  const barber = [head[0] - hz, y, head[2] + hx];
  return [
    { body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'shaved', at: client, ry: 0, seed: 301, colours: { tunic: DYES.walnut } },
    { body: 'm', dress: ['tunic:short'], hair: 'crop', beard: 'short', clip: 'shave', props: { R: 'razor' }, at: barber, ry: Math.PI / 2, seed: 302, colours: { tunic: DYES.undyed } },
    // (The bench's top is SEAT_H over the pavement: the seated clips' feet on it.)
    { body: 'm', dress: ['tunic:knee'], hair: 'curls', beard: 'full', clip: 'sit', at: [-1.55, y, T.front + 0.22], ry: 0.25, seed: 303, colours: { tunic: DYES.green } },
    { body: 'm', dress: ['tunic:knee', 'pallium'], hair: 'crop', clip: 'talk', at: [1.4, y, 1.5], ry: -1.9, seed: 304, colours: { tunic: DYES.ochre, mantle: DYES.oatmeal } },
  ];
}

/** Build the barber's: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildTonstrina({ lod = 0, seed = 311 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['flags', 'floor', 'shelter', 'trav', 'plaster', 'red', 'ochre', 'paint', 'tile', 'wood', 'dark', 'board', 'letters', 'gilt', 'iron', 'linen', 'terracotta',
    'boardsOpen', 'boardsShut', 'workWood', 'workBronze', 'workWater', 'workLinen', 'workClay', 'workCloth'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  shell(lod, seed, out);
  street(lod, seed + 20, out);
  inside(lod, seed + 40, out);
  boards(lod, out);
  work(lod, out);
  const m = healthMaterials();
  if (lod === 2) {
    // (Far out the small things inside are under a pixel: into the parts there are anyway.)
    out.wood.push(...out.shelter.splice(0));
    out.letters = out.iron = out.gilt = out.terracotta = [];
  }
  const p = new TaggedParts('tonstrina');
  const small = { cast: false };
  p.add('pavement', m.flags, out.flags, small);
  p.add('floor', m.shelteredFloor, out.floor, small);
  p.add('stone', m.trav, out.trav);
  p.add('walls', m.plaster, out.plaster);
  p.add('dado', m.red, out.red, small);
  p.add('panels', material('stucco-ochre', { surface: 'plaster', color: 0xd8b070, vertexColors: true, snow: 1 }), out.ochre, small);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  p.add('sheltered-wood', m.shelteredWood, out.shelter);
  p.add('paint', m.paint, [...out.paint, ...out.board], small);
  p.add('letters', m.letters, out.letters, small);
  p.add('inside', m.dark, out.dark, small);
  p.add('mirror', m.gilt, out.gilt, small);
  p.add('iron', m.iron, out.iron, small);
  p.add('towels', m.linen, out.linen, small);
  p.add('pots', m.clay, out.terracotta, small);
  p.add('boards', m.wood, out.boardsShut, { when: 'shut' });
  p.add('boards', m.shelteredWood, out.boardsOpen, { when: 'open', cast: false });
  p.add('stool', m.wood, out.workWood, { when: 'open' });
  p.add('basin', m.bronze, out.workBronze, { when: 'open' });
  p.add('basin-water', m.paint, out.workWater.map((g) => tintGeometry(g, () => lin(0x6f8f8a))), { when: 'open', cast: false });
  p.add('work-towels', m.linen, out.workLinen, { when: 'open', cast: false });
  p.add('jug', m.clay, out.workClay, { when: 'open', cast: false });
  p.add('cloth', m.linen, out.workCloth, { when: 'open', cast: false });
  if (lod < 2) {
    const [lx, ly, lz] = T.lamp;
    const l = lantern(lx, ly, lz, lod);
    // (Hung from an iron bracket out of the pier.)
    p.add('lantern', m.bronze, [...l.bronze, staff([lx, ly + 0.3, lz], [lx, ly + 0.42, lz], 0.01, 4), staff([lx, ly + 0.42, lz], [lx, ly + 0.42, T.front], 0.012, 4)], small);
    p.add('lamp', lanternPane(), [l.pane], { when: 'open', cast: false });
    p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
  }
  // (The people are actors: tonstrinaActors.)
  return p.build();
}
