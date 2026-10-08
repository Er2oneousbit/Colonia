/**
 * models/campus.js
 * ----------------------------------------------------------------------------
 * The military academy (Campus) of the 3D look: a town's training ground,
 * after the campus martius every Roman town kept for its young men (the
 * iuventus) and the soldiers' own exercise grounds:
 *
 *   - Pompeii's Large Palaestra by the amphitheatre, a sanded field ringed by
 *     porticoes where the town's youth exercised, and on the Via
 *     dell'Abbondanza the hall of the armatura of the iuventus (the Schola
 *     Armaturarum), its walls painted with trophies of arms and its
 *     cupboards for the arms
 *   - Vegetius on the drill: the post (palus) struck with a wicker shield and
 *     a wooden sword, archery at the butts, riding (vaulting onto wooden
 *     horses, then the real thing in a ring), under a drill master
 *     (campidoctor) on his tribunal
 *
 * So, in 12 m: the hall along the back behind a colonnade, painted inside
 * with red panels and trophies, SCHOLA IVVENTVTIS on its architrave; the
 * butts against a turf bank at the back right; the drill master's tribunal
 * of stone with its standard on the left; a row of five posts; a riding
 * ring of rails at the front right; the field sanded and raked into the
 * ranks' lines; a low wall round it, a gate to the street.
 *
 * States (models.js partShows; militaryModels.js academyState):
 *   'out'   men drilling (recruits training there, or soldiers sent from
 *           their forts): five at the posts, two archers at the line, a
 *           trooper holding the horse in the ring (its `more` kit) and a
 *           comrade, the drill master on his feet calling the drill
 *   'open'  staffed, nobody training: the drill master in his chair on his
 *           tribunal
 * (academyActors: the people, moving, people/actors.js.)
 *   'shut'  no staff: the gate shut, nobody
 *
 * Metres, the middle at the origin, y up, the gate toward +z.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, Matrix4, Vector3 } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { TaggedParts, slab, tuscanColumn, lantern, lanternPane } from './masonry.js';
import { gableRoof, railFence, lin, D } from './rural.js';
import { castraMaterials, box, staff, prism, vexillum, inscribe, soldier, atPost, ARMS } from './castra.js';

/** The academy's measures (metres): the tests, the lab and the game read them. */
export const ACADEMY = Object.freeze({
  /** The hall: x0, x1, z0, z1, its eave; its colonnade's line. */
  hall: Object.freeze([-5.55, 0.9, -5.55, -3.75, 2.05, -3.55]),
  /** The tribunal: x0, x1, z0, z1, its height. */
  tribunal: Object.freeze([-5.6, -4.2, -2.5, -1.0, 0.85]),
  /** The posts (pali). */
  pali: Object.freeze([[-4.6, 1.3], [-3.5, 1.3], [-2.4, 1.3], [-4.05, 3.1], [-2.95, 3.1]]),
  /** The riding ring: its middle and radius. */
  ring: Object.freeze([3.15, 3.1, 2.25]),
  /** The butts (x, z), facing the field. */
  butts: Object.freeze([[2.6, -4.45], [4.4, -4.45]]),
  lamps: Object.freeze([Object.freeze([-1.75, 1.55, 5.82]), Object.freeze([0.65, 1.55, 5.82])]),
});

const C = ACADEMY;
const RED = lin(0xa8322b);

/** The horse ridden in the ring while men drill: its matrix in the academy's metres. */
export const RING_HORSE = Object.freeze(new Matrix4().makeRotationY(-Math.PI * 0.3).setPosition(C.ring[0] - 0.4, 0.03, C.ring[1] + 0.2));

/** A painted trophy on a panel at (x, y) of a wall facing +z at z: a cuirass, a shield, crossed spears, in paint. */
function trophy(x, y, z, out) {
  const gold = lin(0xc8a050);
  const dark = lin(0x3a2418);
  out.paint.push(tintGeometry(box(0.035, 0.85, 0.004, x - 0.15, y - 0.4, z, 1), () => dark));
  const s1 = box(0.035, 0.85, 0.004, x, y - 0.4, z, 1);
  s1.rotateZ(0);
  out.paint.push(tintGeometry(s1, () => dark));
  const sp = (a) => {
    const g = box(0.025, 0.95, 0.004, 0, -0.475, 0, 1);
    g.rotateZ(a);
    g.translate(x, y + 0.05, z + 0.002);
    return tintGeometry(g, () => dark);
  };
  out.paint.push(sp(0.55), sp(-0.55));
  const sh = new CylinderGeometry(0.17, 0.17, 0.004, 14, 1);
  sh.rotateX(Math.PI / 2);
  sh.translate(x, y - 0.15, z + 0.004);
  out.paint.push(tintGeometry(boxUV(sh), () => gold));
  out.paint.push(tintGeometry(box(0.2, 0.26, 0.004, x, y + 0.02, z + 0.003, 1), () => lin(0x8a6a3a)));
}

/** The hall: walls, the painted back wall, the colonnade, the architrave's inscription, the roof. */
function hall(lod, seed, out) {
  const [x0, x1, z0, z1, eave, cz] = C.hall;
  const cx = (x0 + x1) / 2;
  const t = 0.24;
  out.flags.push(box(x1 - x0 + 0.06, 0.25, z1 - z0 + 0.5, cx, 0, (z0 + z1 + 0.42) / 2, 0.8));
  out.plaster.push(box(x1 - x0, eave - 0.25, t, cx, 0.25, z0 + t / 2, 0.9));
  for (const x of [x0 + t / 2, x1 - t / 2]) out.plaster.push(box(t, eave - 0.25, z1 - z0, x, 0.25, (z0 + z1) / 2, 0.9));
  // Inside the back wall: a dark socle, red panels framed in white, a trophy painted on each.
  const zi = z0 + t + 0.004;
  out.dark.push(box(x1 - x0 - 2 * t, 0.4, 0.01, cx, 0.25, zi, 0.6));
  const n = 4;
  const pw = (x1 - x0 - 2 * t) / n;
  for (let k = 0; k < n; k++) {
    const px = x0 + t + (k + 0.5) * pw;
    out.red.push(box(pw - 0.2, 1.05, 0.01, px, 0.75, zi + 0.002, 0.95));
    if (lod < 2) trophy(px, 1.45, zi + 0.012, out);
  }
  // A bench along it; the cupboards for the arms at the ends.
  out.wood.push(box(x1 - x0 - 1.6, 0.06, 0.32, cx, 0.45, zi + 0.3, 0.75));
  if (lod < 2) for (const x of [x0 + t + 0.4, x1 - t - 0.4]) out.wood.push(box(0.6, 1.5, 0.4, x, 0.25, zi + 0.22, 0.62));
  // The colonnade: six Tuscan columns, the architrave, the inscription.
  const colH = eave - 0.25 - 0.18;
  const cols = 6;
  for (let k = 0; k < cols; k++) {
    const x = x0 + 0.35 + (k * (x1 - x0 - 0.7)) / (cols - 1);
    for (const g of tuscanColumn(0.12, colH, lod)) out.stone.push(g.translate(x, 0.25, cz));
  }
  out.stone.push(slab(x1 - x0, 0.2, 0.32, { bevel: 0.012, seed: seed + 3, wobble: 0, tone: 0, grime: 0 }).translate(cx, eave - 0.18, cz));
  if (lod === 0) out.letters.push(...inscribe('SCHOLA·IVVENTVTIS', eave - 0.14, cz + 0.165, 0.12));
  else if (lod === 1) out.letters.push(box(2.6, 0.1, 0.006, cx, eave - 0.13, cz + 0.164));
  // The roof: a tiled gable along x over the hall and its colonnade.
  const roof = gableRoof({ x0, x1, z0, z1: cz + 0.18, eaveY: eave + 0.02, pitch: D(22), along: 'x', lod, seed: seed + 5, over: 0.22, gableOver: 0.0 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  for (const x of [x0 + 0.05, x1 - 0.05]) {
    const zm = (z0 + cz + 0.18) / 2;
    const g = box(0.1, 1, cz + 0.18 - z0 - 0.02, x, 0, zm, 0.88);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? eave + (roof.ridgeY - eave) * (1 - Math.abs(p.getZ(i) - zm) / ((cz + 0.18 - z0) / 2)) : eave);
    g.computeVertexNormals();
    out.plaster.push(g);
  }
}

/** The butts against their turf bank at the back right. */
function butts(lod, out) {
  out.turf.push(prism(1.55, 5.75, [[-5.8, 0], [-5.05, 0], [-5.25, 1.15], [-5.7, 1.15]], (x, y) => 0.78 + 0.22 * Math.min(1, y / 1.1)));
  for (const [x, z] of C.butts) {
    const r = 0.42;
    const disc = new CylinderGeometry(r, r, 0.24, lod === 0 ? 20 : lod === 1 ? 12 : 8, 1);
    disc.rotateX(Math.PI / 2);
    disc.translate(x, 0.92, z);
    out.straw.push(tintGeometry(boxUV(disc), () => 0.95));
    if (lod < 2) {
      [[0.34, 0x9a2a1e], [0.22, 0xe8dcc0], [0.11, 0x9a2a1e]].forEach(([rr, hex], i) => {
        const d = new CylinderGeometry(rr, rr, 0.005, lod === 0 ? 20 : 12, 1);
        d.rotateX(Math.PI / 2);
        d.translate(x, 0.92, z + 0.122 + i * 0.002);
        out.paint.push(tintGeometry(boxUV(d), () => lin(hex)));
      });
    }
    for (const s of [-1, 1]) out.wood.push(staff([x + s * 0.32, 0, z + 0.1], [x + s * 0.15, 1.1, z - 0.08], 0.03, 4));
  }
  // The shooting line: two short stakes and a cord between them.
  for (const x of [2.0, 5.0]) out.wood.push(box(0.06, 0.4, 0.06, x, 0, 0.0, 0.8));
  if (lod < 2) out.rope.push(staff([2.0, 0.35, 0], [5.0, 0.35, 0], 0.008, 3));
}

/** The drill master's tribunal: a stone podium, steps up its side, his folding chair, the standard. */
function tribunal(lod, seed, out, std) {
  const [x0, x1, z0, z1, h] = C.tribunal;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  out.ashlar.push(slab(x1 - x0, h, z1 - z0, { bevel: 0.02, seed, wobble: 0, tone: 0, grime: 0.35 }).translate(cx, 0, cz));
  out.stone.push(slab(x1 - x0 + 0.1, 0.08, z1 - z0 + 0.1, { bevel: 0.015, seed: seed + 1, wobble: 0, tone: 0, grime: 0 }).translate(cx, h, cz));
  for (let k = 0; k < 3; k++) out.stone.push(slab(0.32, (h * (3 - k)) / 3, 0.9, { bevel: 0.012, seed: seed + 3 + k, wobble: 0.002, tone: 0.04, grime: 0.3 }).translate(x1 + 0.16 + k * 0.3, 0, cz));
  // The folding chair (sella castrensis): crossed legs, a leather seat.
  if (lod < 2) {
    const sx = cx - 0.25;
    const sy = h + 0.08;
    for (const s of [-1, 1]) {
      out.bronze.push(staff([sx - 0.18, sy, cz + s * 0.18], [sx + 0.18, sy + 0.42, cz + s * 0.18], 0.015, 4));
      out.bronze.push(staff([sx + 0.18, sy, cz + s * 0.18], [sx - 0.18, sy + 0.42, cz + s * 0.18], 0.015, 4));
    }
    out.paint.push(tintGeometry(box(0.38, 0.03, 0.4, sx, sy + 0.42, cz, 1), () => lin(0x6a4428)));
  }
  vexillum(x0 + 0.3, z0 + 0.3, 2.1, lod, std, RED);
  // A rack of practice javelins against it.
  if (lod < 2) {
    const rz = z1 + 0.35;
    out.wood.push(box(1.0, 0.06, 0.06, cx, 0.9, rz, 0.8));
    for (const s of [-1, 1]) out.wood.push(box(0.06, 0.95, 0.06, cx + s * 0.48, 0, rz, 0.8));
    for (let k = 0; k < (lod ? 3 : 6); k++) out.wood.push(staff([cx - 0.38 + k * 0.15, 0, rz + 0.08], [cx - 0.36 + k * 0.15, 1.7, rz - 0.04], 0.012, 4));
  }
}

/** A post (palus) with sword cuts. */
function palus(x, z, lod, out) {
  out.wood.push(box(0.2, 1.8, 0.2, x, 0, z, (gx, gy) => 0.62 + 0.3 * Math.min(1, gy / 1.2)));
  if (lod === 0) for (let k = 0; k < 4; k++) out.dark.push(box(0.12, 0.012, 0.005, x, 0.85 + k * 0.2, z + 0.102));
}

/** The low wall round the field (front and sides; the hall and the bank close the back), the gate's piers. */
function enclosure(lod, seed, out) {
  const h = 0.85;
  const t = 0.24;
  const e = 5.85;
  const g0 = -1.55;
  const g1 = 0.45;
  const runs = [['x', -e, g0, e - t / 2], ['x', g1, e, e - t / 2], ['z', -3.5, e, -e + t / 2], ['z', -4.75, e, e - t / 2]];
  for (const [ax, a, b, at] of runs) {
    out.plaster.push(ax === 'x' ? box(b - a, h, t, (a + b) / 2, 0, at, 0.85) : box(t, h, b - a, at, 0, (a + b) / 2, 0.85));
    out.tile.push(ax === 'x' ? box(b - a, 0.06, t + 0.08, (a + b) / 2, h, at, 0.9) : box(t + 0.08, 0.06, b - a, at, h, (a + b) / 2, 0.9));
  }
  for (const x of [g0 - 0.2, g1 + 0.2]) {
    out.ashlar.push(box(0.4, 1.4, 0.4, x, 0, e - 0.2, 0.9));
    out.stone.push(slab(0.5, 0.1, 0.5, { bevel: 0.015, seed: seed + x, wobble: 0, tone: 0, grime: 0 }).translate(x, 1.4, e - 0.2));
  }
  const gw = g1 - g0;
  for (const s of [-1, 1]) {
    const hx = s < 0 ? g0 : g1;
    out.doorShut.push(box(gw / 2 - 0.02, 1.0, 0.05, hx - s * (gw / 4), 0.03, e - 0.22, 0.72));
    out.doorOpen.push(box(0.05, 1.0, gw / 2 - 0.02, hx - s * 0.03, 0.03, e - 0.22 - gw / 4, 0.72));
  }
}

/** Build the military academy: { group, meshes, triangles }; meshes tagged in userData.when. */
export function buildAcademy({ lod = 0, seed = 191 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['gravel', 'flags', 'ashlar', 'stone', 'tile', 'wood', 'plaster', 'red', 'dark', 'bronze', 'paint', 'letters', 'turf', 'straw', 'rope', 'sand', 'doorOpen', 'doorShut'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  const std = { wood: [], gilt: [], silver: [], cloth: [], iron: [], bronze: [], rope: [] };
  // The field: sand, raked into the ranks' lines.
  out.gravel.push(box(11.7, 0.03, 11.7, 0, 0, 0, (x, y, z) => 0.86 + 0.14 * Math.cos(x * 0.8) * Math.cos(z * 0.7)));
  if (lod < 2) for (const z of [-2.7, -1.9, -1.1, -0.3]) out.gravel.push(box(4.6, 0.006, 0.035, -1.65, 0.03, z, 0.68));
  hall(lod, seed, out);
  butts(lod, out);
  tribunal(lod, seed + 20, out, std);
  for (const [x, z] of C.pali) palus(x, z, lod, out);
  // A wicker shield hung on the first post, wooden swords leaning on the second.
  if (lod < 2) {
    const [px, pz] = C.pali[0];
    const w = new CylinderGeometry(0.3, 0.3, 0.04, lod ? 10 : 18, 1);
    w.rotateX(Math.PI / 2);
    w.scale(1, 1.4, 1);
    w.translate(px, 1.1, pz + 0.13);
    out.paint.push(tintGeometry(boxUV(w), () => lin(0xb8995a)));
    const [qx, qz] = C.pali[1];
    for (const k of [0, 1]) out.wood.push(staff([qx + 0.15 + k * 0.08, 0.03, qz + 0.3], [qx + 0.06 + k * 0.04, 0.75, qz + 0.11], 0.022, 4));
  }
  // The riding ring: rails on posts round it, a gap toward the field; its sand finer.
  const [rx, rz, rr] = C.ring;
  const pts = [];
  const n = lod === 0 ? 14 : lod === 1 ? 10 : 8;
  for (let k = 0; k <= n; k++) {
    const a = D(200) + (k / n) * D(320);
    pts.push([rx + Math.cos(a) * rr, rz + Math.sin(a) * rr]);
  }
  out.wood.push(...railFence(pts, { h: 1.05, rails: [0.5, 0.95], seed: seed + 30, lod, every: 1.0 }));
  const sand = new CylinderGeometry(rr - 0.05, rr - 0.05, 0.035, lod === 0 ? 32 : 16, 1);
  sand.translate(rx, 0.017, rz);
  out.sand.push(tintGeometry(boxUV(sand), () => 0.95));
  enclosure(lod, seed + 40, out);
  const m = castraMaterials();
  if (lod === 2) out.bronze = out.letters = out.rope = [];
  const p = new TaggedParts('campus');
  p.add('yard', m.gravel, out.gravel, { cast: false });
  p.add('ring-sand', material('ring-sand', { surface: 'earth', color: 0xe8d4a8, vertexColors: true, snow: 1 }), out.sand, { cast: false });
  p.add('ashlar', m.ashlar, out.ashlar);
  p.add('stone', m.stone, out.stone);
  p.add('flags', m.flags, out.flags, { cast: false });
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, [...out.wood, ...std.wood]);
  p.add('walls', m.plaster, out.plaster);
  p.add('panels', m.red, out.red, { cast: false });
  p.add('inside', m.dark, out.dark, { cast: false });
  p.add('bronze', m.bronze, out.bronze, { cast: false });
  p.add('paint', m.paint, out.paint, { cast: false });
  p.add('letters', m.letters, out.letters, { cast: false });
  p.add('bank', m.turf, out.turf);
  p.add('straw', m.straw, out.straw);
  p.add('rope', m.rope, out.rope, { cast: false });
  p.add('cloth', m.cloth, std.cloth, { cast: lod === 0 });
  p.add('iron', m.iron, lod < 2 ? std.iron : [], { cast: false });
  p.add('doors', m.wood, out.doorOpen, { when: 'staffed' });
  p.add('doors', m.wood, out.doorShut, { when: 'shut' });
  if (lod < 2) {
    for (const [lx, ly, lz] of C.lamps) {
      const l = lantern(lx, ly, lz, lod);
      p.add('bronze', m.bronze, l.bronze);
      p.add('lamp', lanternPane(), [l.pane], { when: 'staffed', cast: false });
      p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
    }
  }
  // (The drill master and the men drilling are actors: academyActors.)
  return p.build();
}

/** The folding chair on the tribunal (tribunal): its seat's middle (x, z) and the tribunal's top, where its feet stand. */
const CHAIR = Object.freeze([(C.tribunal[0] + C.tribunal[1]) / 2 - 0.25, (C.tribunal[2] + C.tribunal[3]) / 2, C.tribunal[4] + 0.08]);

/**
 * The academy's people (people/actors.js specs, its metres). Staffed, the
 * drill master (campidoctor, a legionary in his mail) on his tribunal: at
 * ease in his folding chair while nobody trains ('open'); on his feet
 * calling the drill while men train ('out'). Then five men at the five
 * posts, each facing his post at the drill's reach and striking at it with
 * the wooden sword from behind the wicker shield (each at his own pace:
 * not in step), the front row from the field's side, the back row from the
 * gate's; two archers behind the line loosing at the butts; a trooper at
 * the head of the horse in the ring (its `more` kit), holding it, and a
 * comrade talking to him. Nobody when it is shut.
 */
export function academyActors(state) {
  if (state === 'shut') return [];
  const [cx, cz, top] = CHAIR;
  const list = [];
  if (state === 'open') list.push(soldier('legion', { clip: 'sit', props: {}, at: [cx + 0.03, top, cz], ry: Math.PI / 2, seed: 51 }));
  else list.push(soldier('legion', { clip: 'orate', props: {}, at: [cx + 0.6, top, cz + 0.15], ry: Math.PI / 2 - 0.25, seed: 51 }));
  if (state !== 'out') return list;
  // The drill: the front row's posts (z 1.3) from the field (-z), the back row's (z 3.1) from the gate (+z).
  const tunics = [ARMS.legion.tunic, 0xcfc3a8, ARMS.archer.tunic, 0xcfc3a8, ARMS.legion.tunic];
  C.pali.forEach(([px, pz], i) => {
    const ry = pz < 2 ? 0 : Math.PI;
    const [x, z] = atPost(px, pz, ry);
    list.push({ body: 'm', dress: ['tunic:knee', 'caligae'], hair: 'crop', clip: 'drill', props: { R: 'gladius', L: 'scutum' }, at: [x, 0.03, z], ry, seed: 52 + i, colours: { tunic: tunics[i], accent: 0xb8995a } });
  });
  // The archers behind the line (z 0), each loosing at his butt.
  C.butts.forEach(([bx, bz], i) => {
    const at = [bx + 0.1 * (i ? -1 : 1), 0.03, 0.3];
    list.push(soldier('archer', { clip: 'shoot', props: { L: 'bow', R: 'arrow' }, at, ry: Math.atan2(bx - at[0], bz - at[2]), seed: 58 + i }));
  });
  // The trooper at the ring horse's head (RING_HORSE: it faces its own +z), holding it; a comrade beside him.
  const hp = new Vector3().setFromMatrixPosition(RING_HORSE);
  const fwd = new Vector3(0, 0, 1).transformDirection(RING_HORSE);
  const side = new Vector3(fwd.z, 0, -fwd.x);
  const head = hp.clone().addScaledVector(fwd, 1.35).addScaledVector(side, 0.35);
  const face = Math.atan2(hp.x - head.x, hp.z - head.z);
  const trooper = (extra) => ({ ...soldier('cavalry', extra), dress: ['tunic:knee', 'caligae', 'helmet'], props: {} });
  list.push(trooper({ clip: 'hold', at: [head.x, 0.03, head.z], ry: face, seed: 60 }));
  const mate = head.clone().addScaledVector(side, -0.75).addScaledVector(fwd, 0.45);
  list.push(trooper({ clip: 'talk', at: [mate.x, 0.03, mate.z], ry: Math.atan2(head.x - mate.x, head.z - mate.z), seed: 61 }));
  return list;
}
