/**
 * labLearning.js
 * ----------------------------------------------------------------------------
 * The look lab's Learning scene (7): the school, the library and the academy
 * (render3d/models/ludus.js, bibliotheca.js, academia.js), each open (at
 * work: people at their lessons and books) in the front row and shut (no
 * staff) behind, on beaten earth between streets, labelled, as the game draws
 * them (models/education.js: the states by the parts' tags).
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { partShows } from '../render3d/models.js';
import { EDUCATION_MODELS } from '../render3d/models/education.js';
import { LUDUS, schoolActors } from '../render3d/models/ludus.js';
import { libraryActors } from '../render3d/models/bibliotheca.js';
import { academyActors } from '../render3d/models/academia.js';
import { labCrowd } from './labPeople.js';

/** Where each building stands (metres), what it shows, its label. */
const ITEMS = [
  { x: -15, z: 8, kind: 'school', state: 'open', name: 'School (ludus)', note: 'at its lessons' },
  { x: -4, z: 8, kind: 'library', state: 'open', name: 'Library (bibliotheca)', note: 'open, readers at work' },
  { x: 10, z: 8, kind: 'academy', state: 'open', name: 'Academy (academia)', note: 'a master in the exedra, a declamation' },
  { x: -15, z: -8, kind: 'school', state: 'shut', name: 'School', note: 'idle' },
  { x: -4, z: -8, kind: 'library', state: 'shut', name: 'Library', note: 'idle: cupboards shut' },
  { x: 10, z: -8, kind: 'academy', state: 'shut', name: 'Academy', note: 'idle' },
];

const HALF = { school: 4, library: 4, academy: 6 };

/** The lab's one lamp light at night: the open school's lantern. */
const LAMP = [-15 + LUDUS.lamp[0], LUDUS.lamp[1] + 0.11, 8 + LUDUS.lamp[2]];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The school, the library and the academy</h2>
<p><b>The school</b> (<i>ludus litterarius</i>): Rome's elementary schools were seldom buildings of their own. The master rented a
<i>pergula</i> open to the street or taught under a portico of the forum, as in the painting of the forum at Pompeii from the Praedia of
Julia Felix: boys seated with tablets on their knees. The relief from Neumagen shows the master in a high round-backed chair (a
<i>cathedra</i>), boys reading from rolls, a late one with his box of rolls (<i>capsa</i>). Here: a portico on columns stuccoed red and
white, LVDVS on a board under its beam, the master on a dais in his wicker chair under a striped awning, the alphabet on a whitened
board (<i>album</i>), a counting board (<i>abacus</i>), boys on benches round the court.</p>
<p><b>The library</b> (<i>bibliotheca</i>): after Pollio's, Trajan's and the Library of Celsus: rolls with their tags in wooden
cupboards (<i>armaria</i>) along a painted hall raised on a podium behind four marble columns, BIBLIOTHECA on the architrave; Minerva on
her pedestal before the steps; herms of Homer, Ennius, Plato and Cicero; a reader, a scribe at his desk, laurels in pots; a gate of
bronze grilles.</p>
<p><b>The academy</b> (<i>academia</i>): higher learning, rhetoric and philosophy, after the Academy and the Lyceum as Rome took them over
(Cicero's gymnasia at Tusculum): an exedra with a half-round bench (as the <i>schola</i> benches at Pompeii's Herculaneum Gate) where the
master sits among his pupils, two lecture rooms, a covered walk, a garden of gravel walks and clipped box, a sundial's bowl on its column,
a herm of Plato, a platform for declaiming, cypresses; ACADEMIA over the gate.</p>
<h3>Controls</h3>
<ul>
<li>7: this scene. 1 to 4: day, golden hour, night, winter. L: the level of detail. N: snow; T: rain. M, G, Z: the game's zooms; O: orbit;
Q / E: turn the view.</li>
</ul>`;

/** The streets and the ground round the scene. */
function ground(minX, maxX, minZ, maxZ) {
  const g = new Group();
  const w = maxX - minX;
  const d = maxZ - minZ;
  const earth = new PlaneGeometry(w * 3, d * 3, 1, 1).rotateX(-Math.PI / 2);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  // A street along the front of each row (the buildings face it) and down each gap between them.
  const streets = [[minX, 14.2, maxX, 15.8], [minX, -1.8, maxX, -0.2], [-10.3, minZ, -8.7, maxZ], [0.7, minZ, 2.3, maxZ]];
  for (const [x0, z0, x1, z1] of streets) {
    const p = new PlaneGeometry(x1 - x0, z1 - z0, 1, 1).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
    g.add(new Mesh(tintGeometry(boxUV(p)), material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 })));
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

/** Build the scene (the lab.js commerce scenes' shape: id, group, labels, setLod...). */
export function buildLearningScene() {
  const group = new Group();
  group.name = 'learning-scene';
  group.add(ground(-22, 19, -16, 16));
  const holders = ITEMS.map((it) => {
    const h = new Group();
    h.position.set(it.x, 0, it.z);
    group.add(h);
    return { ...it, h };
  });
  let lod = 0;
  /** Free a group's geometries (the look's materials are shared and kept). */
  const free = (g) => g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  // The people, as the game draws them (each model's actors).
  const ACTORS = { school: schoolActors, library: libraryActors, academy: academyActors };
  const crowd = labCrowd(group);
  function build() {
    for (const it of holders) {
      for (const c of it.h.children) free(c);
      it.h.clear();
      const model = EDUCATION_MODELS[it.kind].build(it.kind, lod);
      model.traverse((m) => { if (m.isMesh) m.visible = partShows(m.userData.when, it.state, false); });
      it.h.add(model);
    }
    crowd.fill(lod, holders.map((it) => [ACTORS[it.kind](it.state), it.x, it.z]));
  }
  build();
  const labels = ITEMS.map((it) => ({ name: it.name, note: it.note, x: it.x - HALF[it.kind] + 0.5, z: it.z - HALF[it.kind] + 0.5, y: 4.6 }));
  return {
    id: 'learning',
    title: 'Learning',
    key: '7',
    info: INFO,
    group,
    labels,
    fade: [-2, 0, 26, 32],
    lamp: LAMP,
    shadowBox: 24,
    noAO: [crowd.batch.group],
    get lod() { return lod; },
    setLod(n) {
      if (n === lod) return;
      lod = n;
      build();
    },
    setTurn() {},
    /** Nothing here freezes: no water. */
    setWinter() {},
    /** Triangles of each building at a level of detail (built fresh). */
    triangles(l = lod) {
      const out = {};
      for (const kind of Object.keys(EDUCATION_MODELS)) {
        let n = 0;
        EDUCATION_MODELS[kind].build(kind, l).traverse((o) => { if (o.isMesh) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
        out[kind] = n;
      }
      return out;
    },
  };
}
