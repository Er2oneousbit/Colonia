/**
 * labPeople.js
 * ----------------------------------------------------------------------------
 * The look lab's People scene (the minus key): the 3D look's people
 * (render3d/people/), drawn by the game's own batch (people/batch.js: one
 * instanced, skinned mesh a piece, the motion on the GPU), labelled:
 *
 *   - the front row: every body and garment (a citizen in his tunic, a
 *     senator and a magistrate in the toga, a priest with his head veiled,
 *     a matron in her stola and palla, her veil, a boy with his bulla, a
 *     girl, an old philosopher in his pallium, a slave, a soldier in mail
 *     with his spear and shield, the victimarius, a lictor, a traveller in
 *     his paenula)
 *   - the rows behind: every clip, one person playing it (the walkers on
 *     their routes), seated ones on benches
 *
 * L: the level of detail. V: the camera close on the next figure (orbit),
 * then back to the game's view. window.__lab.people: closeUp(i), figures,
 * stats(), setLod(n).
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry, BoxGeometry, Matrix4 } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { PeopleBatch } from '../render3d/people/batch.js';
import { cast } from '../render3d/people/actors.js';
import { SEAT_H } from '../render3d/people/clips.js';
import { DYES } from '../render3d/people/actors.js';

/** The front row: bodies and dress. [name, note, spec]. */
const DRESS = [
  ['Citizen', 'tunic to the knee, belted; short crop', { body: 'm', dress: ['tunic:knee'], hair: 'crop', clip: 'idle', colours: { tunic: DYES.oatmeal } }],
  ['Senator', 'toga over the tunic with the broad stripe (latus clavus)', { body: 'm', dress: ['tunic:knee:broad', 'toga'], hair: 'crop', clip: 'idle', colours: { tunic: DYES.white, mantle: DYES.candida, trim: DYES.purple } }],
  ['Magistrate', 'toga praetexta, its purple border', { body: 'm', dress: ['tunic:knee', 'toga'], hair: 'crop', clip: 'orate', old: true, colours: { tunic: DYES.white, mantle: DYES.candida, accent: DYES.murex } }],
  ['Priest', 'capite velato, the patera', { body: 'm', dress: ['tunic:long', 'toga:velato'], hair: 'bald', props: { R: 'patera' }, clip: 'sacrifice', old: true, colours: { tunic: DYES.white, mantle: DYES.candida, trim: DYES.candida } }],
  ['Matron', 'stola with its instita, palla over it', { body: 'f', dress: ['tunic:long:stola', 'palla'], hair: 'bun', clip: 'idle', colours: { tunic: DYES.saffron, mantle: DYES.woad, trim: DYES.oxblood } }],
  ['Veiled', 'the palla over her head', { body: 'f', dress: ['tunic:long:stola', 'palla:veil'], hair: 'bun', clip: 'pray', colours: { tunic: DYES.white, mantle: DYES.madder, trim: DYES.white } }],
  ['Boy', 'a freeborn boy: his bulla', { body: 'c', dress: ['tunic:knee', 'bulla'], hair: 'curls', clip: 'idle', colours: { tunic: DYES.white, trim: DYES.white } }],
  ['Girl', 'tunic to the ankles', { body: 'c', dress: ['tunic:long'], hair: 'bun', clip: 'listen', colours: { tunic: DYES.rose } }],
  ['Philosopher', 'the pallium, the beard', { body: 'm', dress: ['tunic:knee', 'pallium'], hair: 'bald', beard: 'full', clip: 'talk', old: true, colours: { tunic: DYES.oatmeal, mantle: DYES.fawn } }],
  ['Slave', 'a short tunic of undyed wool', { body: 'm', dress: ['tunic:short'], hair: 'curls', clip: 'sweep', props: { R: 'broom' }, colours: { tunic: DYES.fawn } }],
  ['Soldier', 'lorica hamata, caligae, helmet, spear and shield', { body: 'm', dress: ['tunic:knee', 'lorica', 'caligae', 'helmet'], hair: 'crop', props: { R: 'spear', L: 'scutum' }, clip: 'guard', colours: { tunic: DYES.madder, accent: DYES.madder, metal: 0x8a8c90 } }],
  ['Victimarius', 'the limus, bare above it; his axe', { body: 'm', dress: ['limus'], hair: 'crop', props: { L: 'axe' }, clip: 'shoulder', colours: { tunic: DYES.white, trim: DYES.purple } }],
  ['Lictor', 'the fasces on his shoulder', { body: 'm', dress: ['tunic:knee'], hair: 'crop', props: { L: 'fasces' }, clip: 'shoulder', colours: { tunic: DYES.madder, accent: DYES.madder } }],
  ['Traveller', 'the paenula, its hood down', { body: 'm', dress: ['tunic:knee', 'paenula'], hair: 'crop', clip: 'listen', colours: { tunic: DYES.oatmeal, mantle: DYES.walnut } }],
];

/** The rows of clips: [name, note, spec]; `seat` puts a bench under a sitter. */
const ACTS = [
  ['idle', 'standing: weight shifts, breath, looking about', { clip: 'idle' }],
  ['listen', 'hands clasped, nodding', { clip: 'listen' }],
  ['talk', 'making his points', { clip: 'talk', ry: -0.6 }],
  ['talk (toga)', 'the folds on his left arm', { clip: 'talk', dress: ['tunic:knee', 'toga'], ry: 0.6, colours: { mantle: DYES.candida } }],
  ['walk', 'a route, back and forth', { clip: 'walk', route: { length: 3.2, pauseEnd: 2, pauseStart: 2 }, ry: 0 }],
  ['carry', 'a sack on the shoulder', { clip: 'carry', props: { L: 'sack' }, route: { length: 3.2, pauseEnd: 1.5, pauseStart: 1.5, clipEnd: 'shoulder' } }],
  ['sit', 'at rest', { clip: 'sit', seat: true }],
  ['write', 'stylus on a wax tablet', { clip: 'write', seat: true, props: { L: 'tablet', R: 'stylus' } }],
  ['read', 'a roll held open', { clip: 'read', seat: true, props: { R: 'rollOpen' } }],
  ['teach', 'a master in his chair', { clip: 'teach', seat: true, beard: 'full', hair: 'bald', old: true, dress: ['tunic:knee', 'pallium'] }],
  ['orate', 'the orator\'s raised arm', { clip: 'orate', dress: ['tunic:knee', 'toga'], colours: { mantle: DYES.candida } }],
  ['pray', 'orans: hands raised', { clip: 'pray' }],
  ['sacrifice', 'pouring from the patera', { clip: 'sacrifice', props: { R: 'patera' }, dress: ['tunic:long', 'toga:velato'], colours: { mantle: DYES.candida } }],
  ['flute', 'the double pipes (tibiae)', { clip: 'flute', props: { R: 'tibiae' }, dress: ['tunic:long'], colours: { tunic: DYES.white } }],
  ['pump', 'a pump\'s beam', { clip: 'pump', props: { R: 'beam' } }],
  ['hammer', 'mallet and chisel', { clip: 'hammer', props: { R: 'hammer', L: 'chisel' } }],
  ['sweep', 'a broom of twigs', { clip: 'sweep', props: { R: 'broom' }, dress: ['tunic:short'] }],
  ['count', 'coin at a table', { clip: 'count', props: { R: 'coin' } }],
  ['give', 'paying from his purse', { clip: 'give', props: { R: 'purse' } }],
  ['recite', 'a boy and his tablet', { clip: 'recite', body: 'c', props: { L: 'tablet' }, dress: ['tunic:knee', 'bulla'] }],
  ['hold', 'the incense box (acerra)', { clip: 'hold', body: 'c', props: { R: 'acerra' }, dress: ['tunic:knee'], colours: { tunic: DYES.white } }],
  ['shoulder', 'the fasces', { clip: 'shoulder', props: { L: 'fasces' } }],
  ['cheer', 'a festival', { clip: 'cheer', dress: ['tunic:knee', 'wreath'] }],
  ['guard', 'spear and shield', { clip: 'guard', props: { R: 'spear', L: 'scutum' }, dress: ['tunic:knee', 'lorica', 'caligae', 'helmet'], colours: { tunic: DYES.madder, accent: DYES.madder } }],
];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The people</h2>
<p>One skinned body of 25 bones, made in code, in a man's, a woman's and a child's shape; a face carved on its head (the brow, the
eyes in their sockets, the nose with its wings, the lips, the chin, the ears); hands with a thumb and the fingers grouped; feet in sandals.
Garments are pieces of their own swapped per person: the tunic with its clavi and belt, the toga with its balteus, sinus and umbo (drawn over
the head for a sacrifice), the stola and palla, the Greek pallium, the paenula, a soldier's mail, caligae and helmet, the victimarius's limus,
a child's bulla, a festival's wreath; heads of hair (a crop, curls, a woman's parted bun, an old man's fringe) and beards.</p>
<p>The clips are made in code and baked into a texture the GPU reads: a pose is a function of time built from whole waves, so every loop
runs into its start; the feet are planted by a solver, the walk strikes with its heel and pushes off its toes. Every instance has its own
phase and speed, so no two move in step. All the people of a piece and level of detail are one instanced draw.</p>
<h3>Controls</h3>
<ul>
<li>Minus: this scene. L: the level of detail. V: close on the next figure (orbit), and back. 1 to 4: day, golden hour, night, winter.
N: snow; T: rain. M, G, Z: the game's zooms; O: orbit; Q / E: turn the view.</li>
</ul>`;

/** Spacing (metres) and where the rows stand. */
const DX = 1.5;
const ROW_DRESS = 4;
const ROWS_ACT = [0, -4.5];

export function buildPeopleScene() {
  const group = new Group();
  group.name = 'people-scene';
  // The ground: paving, a street.
  const W = Math.max(DRESS.length, ACTS.length / 2) * DX + 6;
  const g = new PlaneGeometry(W * 2.5, 30, 1, 1).rotateX(-Math.PI / 2);
  const floor = new Mesh(tintGeometry(boxUV(g)), material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 }));
  floor.receiveShadow = true;
  group.add(floor);
  const batch = new PeopleBatch(group);
  const figures = [];
  const specs = [];
  const benches = [];
  DRESS.forEach(([name, note, spec], i) => {
    const x = (i - (DRESS.length - 1) / 2) * DX;
    specs.push({ seed: 100 + i, ...spec, at: [x, 0, ROW_DRESS], ry: spec.ry ?? 0 });
    figures.push({ name, note, x, z: ROW_DRESS, y: 2.1 });
  });
  const half = Math.ceil(ACTS.length / 2);
  ACTS.forEach(([name, note, spec], i) => {
    const row = i < half ? 0 : 1;
    const k = row ? i - half : i;
    const x = (k - (half - 1) / 2) * DX * 1.2;
    const z = ROWS_ACT[row];
    const s = { seed: 200 + i, body: 'm', dress: ['tunic:knee'], hair: 'crop', ...spec, at: [x, 0, z], ry: spec.ry ?? 0 };
    // (A route walks toward the camera's side and back, from a little behind the row.)
    if (s.route) s.at = [x, 0, z - 1.6];
    specs.push(s);
    figures.push({ name, note, x, z, y: 2.0 });
    if (spec.seat) benches.push([x, z]);
  });
  // The benches under the sitters: their seats SEAT_H high, set under the hips.
  const wood = material('wood', { surface: 'wood', vertexColors: true, snow: 1 });
  for (const [x, z] of benches) {
    const b = new BoxGeometry(0.55, 0.06, 0.4).translate(x, SEAT_H - 0.03, z - 0.02);
    const legs = [[-0.22, -0.15], [0.22, -0.15], [-0.22, 0.13], [0.22, 0.13]].map(([dx, dz]) => tintGeometry(boxUV(new BoxGeometry(0.05, SEAT_H - 0.06, 0.05).translate(x + dx, (SEAT_H - 0.06) / 2, z + dz - 0.02)), () => 0.7));
    for (const geo of [tintGeometry(boxUV(b)), ...legs]) {
      const mesh = new Mesh(geo, wood);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  const people = cast(specs);
  let lod = 0;
  const I = new Matrix4();
  const fill = () => {
    batch.begin(lod);
    batch.add(people, I, 0);
    batch.end();
  };
  fill();
  const labels = figures.map((f) => ({ name: f.name, note: f.note, x: f.x, z: f.z, y: f.y }));
  let close = -1;
  return {
    id: 'people',
    title: 'People',
    key: '-',
    info: INFO,
    group,
    labels,
    batch,
    noAO: [batch.group],
    figures,
    fade: [0, 0, 26, 32],
    lamp: [0, 2.2, 2],
    shadowBox: 24,
    get lod() { return lod; },
    setLod(n) {
      if (n === lod) return;
      lod = n;
      fill();
    },
    /** V: the next figure close up (the lab's orbit), then back. */
    onKey(k, api) {
      if (k !== 'v') return false;
      close = close + 1 >= figures.length ? -1 : close + 1;
      if (api) api.closeUp(close);
      return true;
    },
    get close() { return close; },
    setTurn() {},
    setWinter() {},
    /** Each piece's triangles at a level (the batch's built pieces). */
    stats: () => ({ ...batch.stats }),
    triangles(l = lod) {
      const out = {};
      for (const p of batch.pieces.values()) if (p.lod === l) out[p.key] = p.tris;
      return out;
    },
  };
}
