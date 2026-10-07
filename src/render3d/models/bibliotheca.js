/**
 * models/bibliotheca.js
 * ----------------------------------------------------------------------------
 * The library of the 3D look: a public bibliotheca on a 2 x 2 footprint
 * (8 m), from what is known of Roman libraries rather than from the 2D
 * sprite:
 *
 *   - Rome's public libraries began with Asinius Pollio's in the Atrium of
 *     Liberty (39 BC), adorned, Pliny says, with portraits of the authors;
 *     Augustus's on the Palatine and Trajan's either side of his column kept
 *     a Greek room and a Latin one. In the provinces a benefactor built them:
 *     the Library of Celsus at Ephesus, its facade of columns and statues of
 *     the virtues, its rolls in wall niches behind a gallery.
 *   - The rolls (volumina) lay in wooden cupboards (armaria) set into
 *     niches in the walls, a tag (titulus) hanging from each roll's end; the
 *     Villa of the Papyri at Herculaneum kept its rolls on shelves round a
 *     small room with a free-standing case in the middle. Readers took a
 *     roll out into a colonnade or a court to read by daylight; a slave of
 *     the library fetched it, scribes copied.
 *   - Vitruvius: a library should face the east, for the morning light and
 *     so the books do not rot in damp south and west winds. Minerva, the
 *     goddess of wisdom, stood in the main niche (a colossal Athena in
 *     Pergamon's), and the authors' portraits on herms and in medallions.
 *
 * So, in 8 m: the book hall along the back, raised on a podium of
 * travertine with three steps, open to the court through four marble
 * columns under an architrave cut BIBLIOTHECA, its walls of squared
 * limestone, a gable roof with pediments at its ends; inside, cupboards of
 * rolls along its painted back wall and at its ends; in the court, paved in
 * travertine, Minerva on her pedestal before the steps, herms of Homer,
 * Plato, Ennius and Cicero along the low walls, a marble bench for a reader,
 * a scribe at his desk, laurels in pots; a gate of bronze grilles to the
 * street between two piers with lanterns.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the cupboards open, the gates swung back, a reader on
 *           the bench, the scribe at his desk, a library slave bringing
 *           rolls, the lanterns lit at night
 *   'shut'  no staff: the cupboards and the gates shut, nobody
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, SphereGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { material } from '../materials.js';
import { slab, paving, tuscanColumn, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin, gableRoof, D } from './rural.js';
import { staff, inscribe, people } from './castra.js';
import { learningMaterials, person, at, armarium, herm, capsa, bush, box } from './learning.js';

/** The library's measures (metres): the tests, the lab and the game read them. */
export const BIBLIOTHECA = Object.freeze({
  half: 4,
  /** The court's paving. */
  floorY: 0.1,
  /** The hall's podium: its top, its front (the colonnade's line), the foot of its steps. */
  podiumY: 0.5,
  colZ: -1.88,
  stepsZ: -0.98,
  /** The hall's back wall's inner face, its eave, the architrave's foot. */
  backZ: -3.63,
  eave: 3.72,
  archY: 3.34,
  /** Minerva's pedestal (x, z). */
  minerva: Object.freeze([0, -0.45]),
  /** The herms along the low walls: x, z, facing, name. */
  herms: Object.freeze([[-3.3, 0.55, Math.PI / 2, 'HOMERVS'], [-3.3, 2.35, Math.PI / 2, 'ENNIVS'], [3.3, 0.55, -Math.PI / 2, 'PLATO'], [3.3, 2.35, -Math.PI / 2, 'CICERO']]),
  /** The gate's opening in the front wall. */
  gate: Object.freeze([-1.0, 1.0]),
  /** The lanterns on the gate's piers (x, y, z), facing the street. */
  lamps: Object.freeze([Object.freeze([-1.22, 1.36, 3.78]), Object.freeze([1.22, 1.36, 3.78])]),
});

const B = BIBLIOTHECA;
const H = 3.93;
const T = 0.3;

/** The hall: podium and steps, walls, the painted inside, the cupboards, the colonnade, the architrave and the roof. */
function hall(lod, seed, out) {
  const { podiumY: py, colZ, stepsZ, backZ, eave, archY } = B;
  // The podium: travertine, its front a little proud of the colonnade; three steps down to the court.
  out.trav.push(slab(2 * H, py, colZ + 0.42 + H, { bevel: 0.02, seed, wobble: 0, tone: 0, grime: 0.35 }).translate(0, 0, (colZ + 0.42 - H) / 2));
  const steps = 3;
  for (let k = 0; k < steps; k++) {
    const z0 = colZ + 0.42 + (k * (stepsZ - colZ - 0.42)) / steps;
    const z1 = stepsZ;
    const h = (py * (steps - k)) / (steps + 1);
    out.trav.push(slab(4.6, h, z1 - z0, { bevel: 0.015, seed: seed + 3 + k, wobble: 0.002, tone: 0.03, grime: 0.3 }).translate(0, 0, (z0 + z1) / 2));
  }
  // The hall's floor: marble slabs.
  out.floor.push(...paving(-H + T, H - T, backZ, colZ + 0.1, 0.02, seed + 9, { rowW: 0.62, minL: 0.5, maxL: 0.9, lod, tone: 0.08, grime: 0.05 }).map((g) => g.translate(0, py, 0)));
  // The walls: squared limestone outside, up to the eave; the gables over the ends.
  const wallH = eave - py;
  out.ashlar.push(box(2 * H, wallH, T, 0, py, -H + T / 2, (x, y) => 0.8 + 0.2 * Math.min(1, y / 1.5)));
  for (const s of [-1, 1]) {
    out.ashlar.push(box(T, wallH, colZ + 0.2 - backZ, s * (H - T / 2), py, (colZ + 0.2 + backZ) / 2, (x, y) => 0.8 + 0.2 * Math.min(1, y / 1.5)));
  }
  // The roof: a tiled gable along the hall, its ridge over the middle, the eaves over the back wall and the colonnade.
  const z0 = -H + 0.22;
  const z1 = colZ - 0.02;
  const roof = gableRoof({ x0: -H, x1: H, z0, z1, eaveY: eave + 0.02, pitch: D(22), along: 'x', lod, seed: seed + 20, over: 0.2, gableOver: 0.0 });
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  for (const s of [-1, 1]) {
    // The pediment at each end: a triangle of stone over the end wall, a moulded cornice along its foot.
    const zm = (z0 + z1) / 2;
    const half = (z1 - z0) / 2;
    const g = new BoxGeometry(T, 1, z1 - z0 + 0.4, 1, 1, 2);
    g.translate(s * (H - T / 2), 0.5, zm);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? eave + (roof.ridgeY - eave) * Math.max(0, 1 - Math.abs(p.getZ(i) - zm) / (half + 0.2)) : eave);
    g.computeVertexNormals();
    out.ashlar.push(tintGeometry(boxUV(g), () => 0.95));
    if (lod < 2) out.marble.push(box(T + 0.06, 0.1, z1 - z0 + 0.4, s * (H - T / 2), eave - 0.1, zm, 0.95));
  }
  // Inside: the back wall and the ends painted, a dark red dado, ochre above under a white frieze.
  const zi = backZ + 0.006;
  out.red.push(box(2 * H - 2 * T, 0.75, 0.012, 0, py, zi, 0.8));
  out.ochre.push(box(2 * H - 2 * T, archY - py - 0.75 - 0.25, 0.012, 0, py + 0.75, zi, 1));
  for (const s of [-1, 1]) {
    const xi = s * (H - T - 0.006);
    out.red.push(box(0.012, 0.75, colZ - backZ, xi, py, (colZ + backZ) / 2, 0.8));
    out.ochre.push(box(0.012, archY - py - 1.0, colZ - backZ, xi, py + 0.75, (colZ + backZ) / 2, 1));
  }
  if (lod < 2) out.paint.push(box(2 * H - 2 * T, 0.04, 0.014, 0, py + 0.75, zi + 0.002, lin(0x2a1e18)));
  // The cupboards of rolls: five along the back wall, one at each end.
  // (The outer two narrower and in from the corners, clear of the end ones and their doors.)
  const cupboards = [[-2.6, 0.8], [-1.35, 1.1], [0, 1.0], [1.35, 1.1], [2.6, 0.8]];
  const hc = 1.72;
  const dc = 0.44;
  const add = (a, m) => {
    for (const [k, list] of Object.entries(a)) for (const g of list) out[`arm_${k}`].push(g.applyMatrix4(m));
  };
  cupboards.forEach(([x, w], i) => {
    add(armarium(w, hc, dc, { shelves: 3, lod, seed: seed + 40 + i, rollsAt: lod ? 1 : 0 }), new Matrix4().makeTranslation(x, py, backZ));
  });
  for (const s of [-1, 1]) {
    const m = new Matrix4().makeRotationY(-s * Math.PI / 2).setPosition(s * (H - T), py, (colZ + backZ) / 2 + 0.25);
    add(armarium(0.9, hc, dc, { shelves: 3, lod, seed: seed + 50 + s, rollsAt: lod ? 1 : 0 }), m);
  }
  // The colonnade: four marble columns and an anta on each end wall, the architrave over them.
  const colH = archY - py;
  for (const x of [-2.35, -0.8, 0.8, 2.35]) for (const g of tuscanColumn(0.17, colH, lod)) out.marble.push(g.translate(x, py, colZ));
  for (const s of [-1, 1]) out.marble.push(box(0.12, colH, 0.36, s * (H - T - 0.06), py, colZ + 0.05, 0.92));
  out.marble.push(slab(2 * H, eave - archY, 0.4, { bevel: 0.012, seed: seed + 60, wobble: 0, tone: 0, grime: 0 }).translate(0, archY, colZ + 0.02));
  if (lod < 2) out.marble.push(box(2 * H, 0.06, 0.48, 0, eave - 0.06, colZ + 0.02, 0.96));
  // BIBLIOTHECA, cut in the architrave's face and painted red.
  if (lod === 0) out.letters.push(...inscribe('BIBLIOTHECA', archY + 0.1, colZ + 0.225, 0.19));
  else if (lod === 1) out.letters.push(box(2.0, 0.17, 0.006, 0, archY + 0.11, colZ + 0.224));
}

/** Minerva on her pedestal: a marble statue, helmeted, her spear in her right hand, her shield at her left. */
function minerva(lod, seed, out) {
  const [mx, mz] = B.minerva;
  const y0 = B.floorY;
  // The pedestal: a plinth, the die cut MINERVAE, a moulded cap.
  out.marble.push(slab(0.92, 0.16, 0.8, { bevel: 0.02, seed, wobble: 0, tone: 0, grime: 0.3 }).translate(mx, y0, mz));
  out.marble.push(slab(0.72, 0.62, 0.6, { bevel: 0.01, seed: seed + 1, wobble: 0, tone: 0, grime: 0.1 }).translate(mx, y0 + 0.16, mz));
  out.marble.push(slab(0.88, 0.12, 0.76, { bevel: 0.02, seed: seed + 2, wobble: 0, tone: 0, grime: 0 }).translate(mx, y0 + 0.78, mz));
  if (lod === 0) out.letters.push(...inscribe('MINERVAE', y0 + 0.44, mz + 0.303, 0.075).map((g) => g.translate(mx, 0, 0)));
  const top = y0 + 0.9;
  if (lod === 2) {
    // Far out: a figure's mass, a cylinder in her stola.
    out.statue.push(tintGeometry(boxUV(new CylinderGeometry(0.16, 0.24, 1.75, 8, 1).translate(mx, top + 0.875, mz))));
    return;
  }
  // The goddess: the town's people's figure in marble (person: its cloth, skin and hair all marble), in a long robe.
  const marble = { cloth: 'statue', skin: 'statue', hair: 'statue', leather: 'statue' };
  const s = 1.12;
  for (const p of person(marble, { cloth: 0xf4f0e8, cloth2: 0xe8e2d6, skin: 0xf6f2ec, hair: 0xece6dc, long: true, arms: 'spear' }, mx, top, mz, 0, s)) out.statue.push(p.g);
  // Her helmet pushed back over her hair, its crest; the spear; the shield resting at her side.
  const place = new Matrix4().compose(new Vector3(mx, top, mz), new Quaternion(), new Vector3(s, s, s));
  const local = [];
  // A Corinthian helmet pushed up off the face, as Athena wears hers: a dome over the head, its visor up at the brow.
  const helm = new SphereGeometry(0.118, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
  helm.scale(0.95, 0.9, 1.12);
  helm.rotateX(-0.25);
  helm.translate(0, 1.66, -0.02);
  local.push(tintGeometry(boxUV(helm), () => 0.95));
  const visor = new BoxGeometry(0.17, 0.05, 0.08);
  visor.rotateX(-0.5);
  visor.translate(0, 1.72, 0.1);
  local.push(tintGeometry(boxUV(visor), () => 0.93));
  // The crest: a ridge of horsehair carved in marble, arching from the brow over to the nape.
  const crest = [];
  for (let k = 0; k <= 8; k++) {
    const a = -0.35 + (k / 8) * 2.6;
    crest.push([0, 1.7 + Math.sin(a) * 0.14 + 0.03, -0.02 + Math.cos(a) * 0.16]);
  }
  local.push(tube(crest, 0.032, { radial: 6, segments: 16, around: 0.2 }));
  local.push(staff([0.31, 0.0, 0.08], [0.31, 2.2, 0.08], 0.018, 6));
  const tip = new CylinderGeometry(0, 0.035, 0.18, 6, 1).translate(0.31, 2.29, 0.08);
  local.push(tintGeometry(boxUV(tip)));
  const shield = revolve(profileOf([[0, 0.0], [0.36, 0.0], [0.38, 0.03], [0.33, 0.06], [0.18, 0.09], [0, 0.1]]), { segments: lod ? 12 : 22, metres: 0.5 });
  shield.rotateZ(Math.PI / 2);
  shield.rotateY(-0.35);
  shield.translate(-0.44, 0.56, 0.12);
  local.push(shield);
  for (const g of local) out.statue.push(g.applyMatrix4(place));
}

/** The court: paving, low walls, the gate and its piers, the herms, a bench, the scribe's desk, laurels in pots. */
function court(lod, seed, out) {
  const y0 = B.floorY;
  out.trav.push(...paving(-H + 0.24, H - 0.24, B.colZ + 0.42, H - 0.24, y0, seed, { rowW: 0.7, minL: 0.6, maxL: 1.1, lod, tone: 0.06, grime: 0.12 }));
  const t = 0.24;
  const w = 0.92;
  for (const s of [-1, 1]) {
    const x = s * (H - t / 2);
    out.ashlar.push(box(t, w, H - B.colZ - 0.2, x, 0, (B.colZ + 0.2 + H) / 2, 0.88));
    out.marble.push(box(t + 0.06, 0.06, H - B.colZ - 0.2, x, w, (B.colZ + 0.2 + H) / 2, 0.95));
  }
  const [g0, g1] = B.gate;
  for (const [a, b] of [[-H, g0 - 0.15], [g1 + 0.15, H]]) {
    out.ashlar.push(box(b - a, w, t, (a + b) / 2, 0, H - t / 2, 0.88));
    out.marble.push(box(b - a, 0.06, t + 0.06, (a + b) / 2, w, H - t / 2 - 0.03, 0.95));
  }
  // The gate's piers, a step up through it, the bronze grilles (cancelli) shut across it or swung back.
  for (const s of [-1, 1]) {
    const x = s * (g1 + 0.15);
    out.trav.push(slab(0.32, 1.26, 0.32, { bevel: 0.015, seed: seed + 5 + s, wobble: 0.002, tone: 0.05, grime: 0.35 }).translate(x, 0, H - 0.16));
    out.marble.push(slab(0.4, 0.09, 0.4, { bevel: 0.012, seed: seed + 7 + s, wobble: 0, tone: 0, grime: 0 }).translate(x, 1.26, H - 0.16));
  }
  out.trav.push(slab(g1 - g0, y0, t, { bevel: 0.01, seed: seed + 9, wobble: 0, tone: 0.03, grime: 0.3 }).translate(0, 0, H - t / 2));
  const leaf = g1 - 0.02;
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const bars = [box(leaf, 0.04, 0.03, -s * leaf / 2, 0.12, 0, 1), box(leaf, 0.04, 0.03, -s * leaf / 2, 1.0, 0, 1), box(0.04, 0.92, 0.03, -s * 0.02, 0.12, 0, 1), box(0.04, 0.92, 0.03, -s * (leaf - 0.02), 0.12, 0, 1)];
      const n = lod === 0 ? 7 : lod === 1 ? 3 : 0;
      for (let k = 1; k <= n; k++) bars.push(box(0.016, 0.88, 0.016, -s * (k * leaf) / (n + 1), 0.14, 0, 0.9));
      if (lod === 0) bars.push(box(leaf, 0.025, 0.02, -s * leaf / 2, 0.58, 0, 1));
      for (const g of bars) {
        g.rotateY(open ? -s * 1.6 : 0);
        g.translate(s * g1, y0, H - t / 2);
        (open ? out.gateOpen : out.gateShut).push(g);
      }
    }
  }
  // The herms of the authors along the side walls, facing into the court.
  for (const [x, z, ry, name] of B.herms) {
    const h = herm(x, y0, z, ry, { h: 1.7, lod, name });
    out.marble.push(...h.stone);
    out.letters.push(...h.letters);
  }
  // A marble reading bench left of the steps, its legs carved as blocks.
  const [bx, bz] = [-2.0, 0.15];
  out.marble.push(slab(1.5, 0.07, 0.42, { bevel: 0.01, seed: seed + 11, wobble: 0, tone: 0, grime: 0 }).translate(bx, y0 + 0.38, bz));
  for (const s of [-1, 1]) out.marble.push(slab(0.14, 0.38, 0.38, { bevel: 0.012, seed: seed + 12 + s, wobble: 0.002, tone: 0.03, grime: 0.25 }).translate(bx + s * 0.6, y0, bz));
  // The scribe's desk and stool at the right; on the desk an inkwell, a roll, a stack of tablets.
  const [dx, dz] = [1.95, 0.75];
  out.wood.push(box(0.72, 0.04, 0.46, dx, y0 + 0.7, dz, 0.85));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) out.wood.push(box(0.05, 0.7, 0.05, dx + sx * 0.31, y0, dz + sz * 0.18, 0.7));
  out.wood.push(box(0.36, 0.04, 0.32, dx + 0.62, y0 + 0.48, dz, 0.8));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) out.wood.push(box(0.04, 0.48, 0.04, dx + 0.62 + sx * 0.14, y0, dz + sz * 0.12, 0.7));
  if (lod < 2) {
    out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.03, 0.035, 0.06, 8, 1).translate(dx - 0.22, y0 + 0.77, dz - 0.12))));
    for (let k = 0; k < 3; k++) out.wood.push(box(0.18, 0.012, 0.13, dx - 0.18, y0 + 0.74 + k * 0.013, dz + 0.1, 0.8 - k * 0.1));
  }
  // Laurels in terracotta pots either side of the steps: the poets' tree.
  for (const s of [-1, 1]) {
    const px = s * 2.75;
    const pz = -0.62;
    const pot = revolve(profileOf([[0, 0], [0.16, 0], [0.24, 0.12], [0.26, 0.42], [0.29, 0.46], [0.27, 0.5], [0.22, 0.48], [0, 0.48]]), { segments: lod === 2 ? 6 : lod ? 10 : 18, metres: 0.4 });
    out.clay.push(pot.translate(px, y0, pz));
    out.leaf.push(...bush(px, y0 + 1.35, pz, 0.45, { lod, seed: seed + 21 + s }));
    out.wood.push(staff([px, y0 + 0.45, pz], [px, y0 + 1.0, pz], 0.03, 5));
  }
}

/** The people (only close up): a reader on the bench, the scribe at his desk, a library slave bringing rolls in a capsa. */
function readers(mats) {
  const y0 = B.floorY;
  const list = [];
  const things = { paper: [], leather: [], strap: [] };
  // The reader, a roll open before him.
  const [rx, rz, rry] = [-2.05, 0.16, 0];
  list.push(...person(mats, { cloth: 0xe8e0cc, cloth2: 0xf0ead8, hair: 0x3a2a1a, long: true, sit: 0.45, arms: 'read', lean: 0.12 }, rx, y0, rz, rry));
  const [ox, oz] = at(rx, rz, rry, 0, 0.32);
  for (const s of [-1, 1]) things.paper.push(tintGeometry(boxUV(new CylinderGeometry(0.024, 0.024, 0.24, 6, 1).translate(ox + s * 0.17, y0 + 0.87, oz)), () => [0.78, 0.66, 0.46]));
  const sheet = new BoxGeometry(0.34, 0.2, 0.004);
  sheet.rotateX(-0.5);
  sheet.translate(ox, y0 + 0.87, oz);
  things.paper.push(tintGeometry(boxUV(sheet), () => [0.88, 0.78, 0.58]));
  // The scribe on his stool, copying at the desk (he faces it: -x).
  const [dx, dz] = [1.95, 0.75];
  list.push(...person(mats, { cloth: 0x9a8a6a, hair: 0x2e2119, skin: 0x9a6c4c, sit: 0.52, arms: 'write', lean: 0.22 }, dx + 0.62, y0, dz, -Math.PI / 2));
  const sh = new BoxGeometry(0.3, 0.004, 0.22);
  sh.translate(dx + 0.05, y0 + 0.745, dz);
  things.paper.push(tintGeometry(boxUV(sh), () => [0.88, 0.78, 0.58]));
  things.paper.push(tintGeometry(boxUV(new CylinderGeometry(0.03, 0.03, 0.24, 6, 1).rotateX(Math.PI / 2).translate(dx - 0.13, y0 + 0.77, dz)), () => [0.78, 0.66, 0.46]));
  // The library's slave bringing rolls for the reader, a capsa at his feet.
  list.push(...person(mats, { cloth: 0x7a6a52, hair: 0x1e1812, skin: 0x8a5e40, arms: 'hold' }, -0.95, y0, 0.9, -Math.PI * 0.72));
  const [hx, hz] = at(-0.95, 0.9, -Math.PI * 0.72, 0, 0.27);
  for (let k = 0; k < 3; k++) things.paper.push(tintGeometry(boxUV(new CylinderGeometry(0.03, 0.03, 0.3, 6, 1).rotateZ(Math.PI / 2).rotateY(-Math.PI * 0.72 + Math.PI / 2).translate(hx, y0 + 1.12 + k * 0.05, hz)), () => [0.8, 0.68, 0.48]));
  const c = capsa(-0.6, y0, 1.25, { open: true, seed: 3 });
  for (const k of ['leather', 'paper', 'strap']) things[k].push(...c[k]);
  return { list, things };
}

/** Build the library: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildLibrary({ lod = 0, seed = 241 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const keys = ['trav', 'ashlar', 'marble', 'floor', 'tile', 'wood', 'red', 'ochre', 'paint', 'letters', 'statue', 'bronze', 'clay', 'leaf', 'gateOpen', 'gateShut',
    'arm_wood', 'arm_doorOpen', 'arm_doorShut', 'arm_paper', 'arm_tags', 'arm_dark'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  hall(lod, seed, out);
  minerva(lod, seed + 100, out);
  court(lod, seed + 200, out);
  const m = learningMaterials();
  const p = new TaggedParts('library');
  const small = { cast: false };
  if (lod === 2) out.letters = out.bronze = [];
  p.add('stone', m.trav, out.trav);
  p.add('ashlar', material('library-ashlar', { surface: 'ashlarLime', vertexColors: true, snow: 1 }), out.ashlar);
  p.add('marble', m.marble, [...out.marble, ...out.statue]);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, out.wood);
  // Under the hall's roof: its floor and the cupboards take no snow.
  p.add('hall-floor', m.shelteredMarble, out.floor, small);
  p.add('cupboards', m.shelteredWood, out.arm_wood);
  p.add('dado', m.red, out.red, small);
  p.add('walls', material('stucco-ochre', { surface: 'plaster', color: 0xd8b070, vertexColors: true, snow: 1 }), out.ochre, small);
  p.add('paint', m.paint, [...out.paint, ...out.arm_tags], small);
  p.add('letters', m.letters, out.letters, small);
  p.add('bronze', m.bronze, out.bronze, small);
  p.add('pots', m.clay, out.clay);
  p.add('laurel', m.leaf, out.leaf);
  p.add('inside', m.dark, out.arm_dark, small);
  // The rolls on the shelves, behind their doors.
  p.add('rolls', m.papyrus, out.arm_paper, small);
  p.add('cupboard-doors', m.shelteredWood, out.arm_doorOpen, { when: 'open' });
  p.add('cupboard-doors', m.shelteredWood, out.arm_doorShut, { when: 'shut' });
  p.add('gates', m.bronze, out.gateOpen, { when: 'open', cast: lod === 0 });
  p.add('gates', m.bronze, out.gateShut, { when: 'shut', cast: lod === 0 });
  if (lod < 2) {
    for (const [lx, ly, lz] of B.lamps) {
      const l = lantern(lx, ly, lz, lod);
      p.add('lantern', m.bronze, l.bronze, small);
      p.add('lamp', lanternPane(), [l.pane], { when: 'open', cast: false });
      p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
    }
  }
  if (lod === 0) {
    const { list, things } = readers(m);
    people(p, m, 'readers', list, 'open');
    p.add('held-rolls', m.papyrus, things.paper, { when: 'open', cast: false });
    p.add('capsa', m.leather, [...things.leather, ...things.strap], { when: 'open', cast: false });
  }
  return p.build();
}
