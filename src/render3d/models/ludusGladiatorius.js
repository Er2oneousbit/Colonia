/**
 * models/ludusGladiatorius.js
 * ----------------------------------------------------------------------------
 * The gladiator school (Ludus Gladiatorius) of the 3D look, on a 3 x 3
 * footprint (12 m), from the excavated schools rather than from the 2D
 * sprite:
 *
 *   - At Pompeii the great colonnaded court behind the theatre became the
 *     gladiators' barracks after 62: rooms on two floors round a sanded
 *     court under a Doric portico, where the excavators found fifteen
 *     bronze helmets, greaves and shoulder guards, and the men's graffiti
 *     on the columns (Celadus the thraex, "the girls' heartthrob").
 *   - Rome's Ludus Magnus beside the Colosseum: cells round a court in which
 *     a little practice arena was built, its seats for a few spectators.
 *   - The training (Vegetius and the inscriptions): a recruit (tiro) struck
 *     at the post (palus) with a wooden sword (rudis); the men were trained
 *     by armatura, each by a trainer of his own kind (doctor murmillonum,
 *     doctor thraecum), and sparred in the pairs the arena matched: the
 *     murmillo (the brimmed helmet with its fin, the big shield, the short
 *     sword) against the thraex (the griffin crest, the little parmula, the
 *     curved sica), the retiarius (net and trident, the galerus on his left
 *     shoulder) against the secutor who chased him. The owner and master of
 *     the troupe (familia) was the lanista.
 *
 * So, in 12 m: ranges of cells along the back and the left under a tiled
 * roof falling into the court (as Vitruvius's courts do), their doors dark
 * behind a portico of stuccoed columns, red below and white above; the
 * lanista's room at the back right, its door wider; under the left portico
 * the racks: helmets on pegs, shields, nets and tridents, greaves; the
 * court of sand with an oval practice ring of timber barriers in its
 * middle; two posts at the front left; a trough; a low wall, a gate to the
 * street with LVDVS over it.
 *
 * States (models.js partShows; training.js trainingState):
 *   'open'  staffed: two pairs sparring in the ring under their trainer,
 *           two men at the posts, one resting on the portico's bench, the
 *           lanista at his accounts (ludusActors: moving)
 *   'out'   staffed, a pair gone to the arena: the retiarius's net and
 *           trident gone from the rack with them, his pair from the ring
 *   'shut'  no staff: the doors and the gate shut, nobody
 * Tags: 'staffed', 'home' (open or shut: the net and trident), 'shut'.
 *
 * Metres, the middle at the origin, y up, the gate toward +z.
 * ----------------------------------------------------------------------------
 */

import { tuscanColumn, slab } from './masonry.js';
import { roofSlope } from './learning.js';
import { inscribe, atPost } from './castra.js';
import { SEAT_H } from '../people/clips.js';
import { DYES } from '../people/actors.js';
import {
  bag, assemble, lamps, enclosure, trough, palus, gladiatorHelmet, parmula, hungNet, trident, greaves, box, staff, lin,
} from './trainingParts.js';
import { scutum } from './tirocinium.js';

/** The school's measures (metres): the tests, the lab and the game read them. */
export const LUDUS_GLADIATORIUS = Object.freeze({
  half: 6,
  /** The ranges: the back wall's face (z), the cells' front (z), the portico's columns (z); the left's in x. */
  back: Object.freeze([-5.95, -4.55, -3.6]),
  left: Object.freeze([-5.95, -4.55, -3.6]),
  eave: 2.35,
  top: 3.25,
  /** The practice ring: its middle (x, z) and half axes. */
  ring: Object.freeze([1.25, 0.85, 3.25, 2.55]),
  /** The posts. */
  pali: Object.freeze([Object.freeze([-3.0, 4.55]), Object.freeze([-0.6, 4.55])]),
  /** The lanista's door (x) in the back range. */
  lanista: 4.6,
  gate: Object.freeze([1.9, 3.3]),
  lamps: Object.freeze([Object.freeze([1.7, 1.56, 5.82]), Object.freeze([3.5, 1.56, 5.82])]),
});

const L = LUDUS_GLADIATORIUS;

/** A range of cells along x (the back's) from x0 to x1: built facing +z; `side` turns it to the left (facing +x). */
function range(lod, seed, out, x0, x1, { doors, lanista = null }) {
  const [zb, zc, zp] = L.back;
  const t = 0.24;
  const geo = [];
  const push = (key, g) => geo.push([key, g]);
  push('ashlar', box(x1 - x0, 0.25, zp - zb + 0.15, (x0 + x1) / 2, 0, (zb + zp + 0.15) / 2, 0.85));
  // (The back wall stands a little over the roof's top, coped with tiles: the slope's upper edge, its
  // imbrices' open ends, hides behind it.)
  push('plaster', box(x1 - x0, L.top - 0.03, t, (x0 + x1) / 2, 0.25, zb + t / 2, 0.9));
  push('tile', box(x1 - x0, 0.07, t, (x0 + x1) / 2, L.top + 0.22, zb + t / 2, 0.85));
  // The cells' front: wall with doors (dark inside), a little barred window over each.
  const edges = [x0];
  for (const d of doors) edges.push(d - (d === lanista ? 0.6 : 0.42), d + (d === lanista ? 0.6 : 0.42));
  edges.push(x1);
  const doorH = 1.95;
  for (let k = 0; k < edges.length; k += 2) if (edges[k + 1] - edges[k] > 0.02) push('plaster', box(edges[k + 1] - edges[k], L.eave + 0.25, t, (edges[k] + edges[k + 1]) / 2, 0.25, zc, 0.92));
  for (const d of doors) {
    const w = d === lanista ? 1.2 : 0.84;
    push('plaster', box(w, L.eave + 0.5 - doorH, t, d, doorH, zc, 0.92));
    push('dark', box(w, doorH - 0.25, 0.02, d, 0.25, zc - t / 2 + 0.01));
    push('doorShut', box(w - 0.04, doorH - 0.29, 0.05, d, 0.27, zc + t / 2 - 0.03, 0.66));
    if (lod < 2) {
      push('trav', box(w + 0.16, 0.1, t + 0.06, d, doorH, zc, 0.95));
      if (d !== lanista) push('dark', box(0.32, 0.26, 0.02, d, doorH + 0.14, zc + t / 2 + 0.002));
      if (d !== lanista && lod === 0) for (let k = -1; k <= 1; k++) push('iron', staff([d + k * 0.08, doorH + 0.14, zc + t / 2 + 0.01], [d + k * 0.08, doorH + 0.4, zc + t / 2 + 0.01], 0.008, 4));
    }
  }
  // The dado: red to the doors' waist, the wall white above (the Pompeian way).
  for (let k = 0; k < edges.length; k += 2) if (edges[k + 1] - edges[k] > 0.1) push('red', box(edges[k + 1] - edges[k] - 0.04, 0.95, 0.01, (edges[k] + edges[k + 1]) / 2, 0.27, zc + t / 2 + 0.004, 0.7));
  // The lanista's door: its frame painted, a panel of red inside its leaves.
  if (lanista !== null && lod < 2) push('ochre', box(1.5, 0.2, 0.012, lanista, doorH + 0.12, zc + t / 2 + 0.006, 0.9));
  // The portico's floor, its columns, the beam over them.
  push('flags', box(x1 - x0, 0.06, zp - zc + 0.2, (x0 + x1) / 2, 0.03, (zc + zp) / 2 + 0.05, 0.9));
  const n = Math.max(2, Math.round((x1 - x0) / 1.9));
  for (let k = 0; k <= n; k++) {
    const x = x0 + 0.2 + ((x1 - x0 - 0.4) * k) / n;
    for (const g of tuscanColumn(0.12, L.eave - 0.27, lod)) push('stone', g.translate(x, 0.09, zp));
    if (lod < 2) push('red', box(0.27, 0.8, 0.27, x, 0.12, zp, 0.75));
  }
  push('wood', box(x1 - x0, 0.2, 0.26, (x0 + x1) / 2, L.eave - 0.2, zp, 0.7));
  const roof = roofSlope([[x0, L.eave, zp + 0.35], [x1, L.eave, zp + 0.35], [x1, L.top + 0.02, zb + 0.05], [x0, L.top + 0.02, zb + 0.05]], { lod, seed });
  for (const g of roof.tile) push('tile', g);
  for (const g of roof.wood) push('wood', g);
  // Its end walls to the roof's line.
  return geo;
}

/** The racks under the left portico: helmets and greaves on pegs, shields below, nets and tridents (they go with the retiarius: 'home'). */
function racks(lod, out) {
  const x = L.left[1] + 0.16;
  // A board of pegs along the cells' wall, a rail for the shields at their foot.
  out.wood.push(box(0.05, 0.12, 6.2, x - 0.02, 1.62, -0.25, 0.6), box(0.06, 0.06, 6.2, x + 0.08, 0.55, -0.25, 0.6));
  const kinds = ['murmillo', 'thraex', 'murmillo', 'thraex', 'murmillo', 'thraex', 'murmillo'];
  const plumes = [0x9a2a20, 0xe8e0c8, 0x3f5a85, 0x9a2a20, 0x5a6d3e, 0xe8e0c8, 0x9a2a20];
  const n = lod === 0 ? 7 : lod === 1 ? 4 : 0;
  for (let k = 0; k < n; k++) {
    const z = -3.0 + (k * 5.6) / Math.max(1, n - 1);
    gladiatorHelmet(out, x + 0.16, 1.5, z, Math.PI / 2, kinds[k], lod, plumes[k]);
    if (lod === 0 && k % 2 === 0) greaves(out, x + 0.04, 1.32, z + 0.4, Math.PI / 2, lod);
  }
  if (lod < 2) {
    for (let k = 0; k < (lod === 0 ? 4 : 2); k++) {
      const z = -2.6 + k * 1.5;
      const sc = scutum(lod);
      sc.rotateX(-0.2);
      sc.rotateY(Math.PI / 2);
      sc.translate(x + 0.32, 0.02, z);
      out.paint.push(sc);
      parmula(out, x + 0.14, 0.9, z + 0.72, Math.PI / 2 - 0.1, lod, [0x8a2a20, 0x3f5a85, 0x5a6d3e, 0xc9962e][k]);
    }
    hungNet(out.home, x + 0.06, 1.85, 2.55, Math.PI / 2, lod);
    trident(out.home, x + 0.28, 3.15, x + 0.06, 1.95, 3.2, lod);
    trident(out, x + 0.28, -3.35, x + 0.06, 1.95, -3.3, lod);
    // Wooden swords (rudes) in a tub.
    out.wood.push(box(0.3, 0.4, 0.3, x + 0.4, 0, 0.75, 0.6));
    for (let k = 0; k < (lod === 0 ? 5 : 2); k++) out.wood.push(staff([x + 0.35 + (k % 3) * 0.05, 0.3, 0.7 + (k % 2) * 0.08], [x + 0.3 + (k % 3) * 0.06, 0.95, 0.66 + (k % 2) * 0.12], 0.022, 4));
  }
}

/** The practice ring: an oval of posts and two rails round sand finer than the court's, a gap toward the gate. */
function ring(lod, seed, out) {
  const [cx, cz, ax, az] = L.ring;
  const n = lod === 0 ? 30 : lod === 1 ? 18 : 12;
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * ax, cz + Math.sin(a) * az, a]);
  }
  for (let k = 0; k < n; k++) {
    const [x, z, a] = pts[k];
    const [x2, z2, a2] = pts[k + 1];
    // (A gap toward the front, where the men go in and out.)
    const mid = (a + a2) / 2;
    if (Math.abs(mid - Math.PI * 0.5) < 0.22) continue;
    out.wood.push(box(0.09, 0.95, 0.09, x, 0, z, 0.62));
    for (const y of lod === 2 ? [0.85] : [0.45, 0.85]) out.wood.push(staff([x, y, z], [x2, y, z2], 0.03, 4));
  }
  const g = box(ax * 2 - 0.1, 0.012, az * 2 - 0.1, cx, 0.03, cz, 1);
  const p = g.attributes.position;
  // (The box's corners pulled in to the oval: a sand floor cut to the ring.)
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i) - cx;
    const dz = p.getZ(i) - cz;
    const r = Math.hypot(dx / ax, dz / az);
    if (r > 0.97) {
      p.setX(i, cx + (dx / r) * 0.97);
      p.setZ(i, cz + (dz / r) * 0.97);
    }
  }
  out.sand.push(g);
  void seed;
}

/** Build the gladiator school: { group, meshes, triangles }; meshes tagged in userData.when. */
export function buildLudusGladiatorius({ lod = 0, seed = 431, ice = false } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bag(['doorOpen', 'doorShut']);
  out.home = bag();
  // The court's sand, raked.
  out.sand.push(box(11.9, 0.025, 11.9, 0, 0, 0, (x, y, z) => 0.88 + 0.12 * Math.cos(x * 1.3 + z * 0.4)));
  // The back range (cells, and the lanista's room at its right end) and the left one, turned to face +x.
  const back = range(lod, seed, out, -5.95, 5.95, { doors: [-4.0, -2.4, -0.8, 0.8, 2.4, L.lanista], lanista: L.lanista });
  for (const [k, g] of back) out[k].push(g);
  const left = range(lod, seed + 7, out, -3.45, 4.25, { doors: [-2.2, -0.4, 1.4, 3.1] });
  for (const [k, g] of left) {
    // (Built along x facing +z, from -3.45 to 4.25; turned a quarter so it runs along z facing +x.)
    g.rotateY(Math.PI / 2);
    g.translate(0, 0, 0.8);
    out[k].push(g);
  }
  racks(lod, out);
  ring(lod, seed + 20, out);
  for (const [x, z] of L.pali) palus(out, x, z, lod);
  trough(out, 5.2, 3.6, 1.6, { alongZ: true, seed: seed + 30 });
  // The bench under the back portico where a man rests between bouts.
  out.wood.push(box(1.8, 0.07, 0.38, -1.6, 0.43, -4.05, 0.75), box(0.08, 0.43, 0.32, -2.4, 0.06, -4.05, 0.6), box(0.08, 0.43, 0.32, -0.8, 0.06, -4.05, 0.6));
  // The lanista's table and stool at his door.
  out.wood.push(box(0.9, 0.05, 0.55, L.lanista, 0.78, -3.95, 0.8), box(0.06, 0.72, 0.06, L.lanista - 0.38, 0.06, -3.95, 0.6), box(0.06, 0.72, 0.06, L.lanista + 0.38, 0.06, -3.95, 0.6));
  out.wood.push(box(0.36, 0.06, 0.32, L.lanista + 0.15, 0.42, -3.4, 0.7), box(0.3, 0.38, 0.26, L.lanista + 0.15, 0.06, -3.4, 0.55));
  if (lod < 2) out.paint.push(box(0.22, 0.015, 0.16, L.lanista - 0.15, 0.83, -3.95, 0.45));
  enclosure(out, { e: 5.95, g0: L.gate[0], g1: L.gate[1], sides: [-3.6, 5.95], seed });
  // LVDVS on a plaque over the gate between its piers.
  out.trav.push(box(L.gate[1] - L.gate[0] + 0.8, 0.3, 0.3, (L.gate[0] + L.gate[1]) / 2, 1.55, 5.75, 0.95));
  if (lod < 2) out.letters.push(...inscribe('LVDVS', 1.6, 5.905, 0.17).map((g) => g.translate((L.gate[0] + L.gate[1]) / 2, 0, 0)));
  const { p, m } = assemble('ludus-gladiatorius', out, lod, { ice });
  p.add('doors', m.wood, out.doorOpen, { when: 'staffed' });
  p.add('doors', m.wood, out.doorShut, { when: 'shut' });
  if (lod < 2) {
    p.add('net', m.rope, out.home.rope, { when: 'home', cast: false });
    p.add('net-weights', m.iron, [...out.home.iron], { when: 'home', cast: false });
    p.add('tridents', m.wood, out.home.wood, { when: 'home', cast: false });
  }
  lamps(p, m, L.lamps, lod);
  // (The gladiators, their trainer and the lanista are actors: ludusActors.)
  return p.build();
}

/** A gladiator of armatura `kind` (the units' gear: units/look.js's), with practice arms. */
function gladiator(kind, at, ry, seed, clip, extra = {}) {
  const colours = { tunic: DYES.white, trim: [DYES.madder, DYES.woad, 0xd9b65a][seed % 3], accent: [DYES.madder, 0x3f5a85, 0x5a6d3e][seed % 3], metal: 0xb4b8be, leather: 0x6a4428, skin: [0xc8956c, 0xa87452, 0x8c5e40, 0xdcb08c, 0x75492f][seed % 5] };
  const base = { body: 'm', hair: 'crop', at, ry, seed, clip, colours, ...extra };
  if (kind === 'murmillo') return { ...base, gear: ['loin', 'murmillo', 'manica', 'greaves:left'], props: { L: 'scutum', R: 'sprop:rudis' } };
  if (kind === 'thraex') return { ...base, gear: ['loin', 'thraex', 'manica', 'wraps', 'greaves:high'], props: { L: 'uprop:parmula', R: 'sprop:rudis' } };
  if (kind === 'retiarius') return { ...base, gear: ['loin', 'galerus', 'manica'], props: { L: 'uprop:net', R: 'uprop:trident' } };
  // A recruit at the post: bareheaded, the shield and the wooden sword.
  return { ...base, gear: ['loin'], props: { L: 'scutum', R: 'sprop:rudis' } };
}

/**
 * The school's people (people/actors.js specs, its metres). Staffed: in the
 * ring a murmillo and a thraex trading blows (each a half loop behind the
 * other, so one strikes as the other guards) and, while the school is not
 * sending a pair out, a retiarius thrusting his trident at the secutor who
 * presses him; their trainer at the ring's edge with his rod, calling the
 * strokes; two recruits striking at the posts; a man resting on the bench;
 * the lanista at his table with his tablets. Nobody when it is shut.
 */
export function ludusActors(state) {
  if (state === 'shut') return [];
  const [cx, cz] = L.ring;
  const list = [];
  const fight = 1.45;
  list.push(gladiator('murmillo', [cx - 1.6, 0.03, cz - 0.55], Math.PI / 2, 81, 'fight', { sync: true, phase: 0 }));
  list.push(gladiator('thraex', [cx - 1.6 + fight, 0.03, cz - 0.55], -Math.PI / 2, 82, 'hew', { sync: true, phase: 0.6 }));
  if (state === 'open') {
    list.push(gladiator('retiarius', [cx + 0.55, 0.03, cz + 1.05], Math.PI / 2 + 0.2, 83, 'thrust', { sync: true, phase: 0.3 }));
    list.push(gladiator('murmillo', [cx + 0.55 + 1.6, 0.03, cz + 1.05 - 0.32], -Math.PI / 2 + 0.2, 84, 'shieldWall', { sync: true }));
  }
  // The trainer (doctor) at the ring's edge.
  list.push({ body: 'm', dress: ['tunic:knee', 'caligae'], hair: 'crop', beard: 'short', old: true, props: { R: 'sprop:virga' }, clip: 'orate', at: [cx + 0.2, 0.03, cz - 2.0], ry: 0.25, seed: 85, colours: { tunic: DYES.madder } });
  // The recruits at the posts, each striking from in front of his post (castra.js atPost: the point lands on it).
  L.pali.forEach(([px, pz], i) => {
    // (Facing -x, side on to the view: from the camera's side the post would hide him, from the far side his back.)
    const ry = -Math.PI / 2;
    const [x, z] = atPost(px, pz, ry);
    list.push(gladiator('tiro', [x, 0.03, z], ry, 86 + i, 'drill'));
  });
  // A man resting on the bench under the portico, his helmet off.
  list.push({ ...gladiator('tiro', [-1.4, 0.5 - SEAT_H, -4.05], 0, 88, 'sit'), props: {} });
  // The lanista at his accounts.
  list.push({ body: 'm', dress: ['tunic:knee', 'pallium'], hair: 'crop', beard: 'short', old: true, props: { L: 'tablet', R: 'stylus' }, clip: 'write', at: [L.lanista + 0.15, 0.48 - SEAT_H, -3.4], ry: Math.PI, seed: 89, colours: { tunic: DYES.white, mantle: DYES.walnut } });
  return list;
}
