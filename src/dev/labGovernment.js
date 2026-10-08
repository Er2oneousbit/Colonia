/**
 * labGovernment.js
 * ----------------------------------------------------------------------------
 * The look lab's Government scene (6): the senate house and the governor's
 * three residences (render3d/models/curia.js, praetorium.js,
 * praetoriumMaius.js, regia.js) on paved ground between streets, labelled,
 * as the game draws them (models/government.js: the states by the parts'
 * tags, the columns as instanced kits of their own). The front row shows
 * each at work (in session, lived in); behind it the other states: the
 * senate idle and on its guard, the house shut up, the villa idle, the
 * palace on its guard with a mob or an enemy near; behind those the house
 * and the villa on their guard. Their people are the models' actors.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { partShows } from '../render3d/models.js';
import { GOVERNMENT_MODELS, governmentLook } from '../render3d/models/government.js';
import { BUILDINGS } from '../data/buildings.js';
import { curiaActors } from '../render3d/models/curia.js';
import { praetoriumActors } from '../render3d/models/praetorium.js';
import { praetoriumMaiusActors } from '../render3d/models/praetoriumMaius.js';
import { regiaActors } from '../render3d/models/regia.js';
import { labCrowd } from './labPeople.js';

/** Where each building stands (metres), what it shows, its label. */
const ITEMS = [
  { x: -28, z: 12, kind: 'governor_house', state: 'open', name: 'Governor\'s House (Praetorium)', note: 'lived in' },
  { x: -10, z: 12, kind: 'senate', state: 'open', name: 'Senate House (Curia)', note: 'in session' },
  { x: 10, z: 12, kind: 'governor_villa', state: 'open', name: 'Governor\'s Villa (Praetorium Maius)', note: 'lived in' },
  { x: 32, z: 12, kind: 'governor_palace', state: 'open', name: 'Governor\'s Palace (Regia)', note: 'lived in' },
  { x: -28, z: -12, kind: 'governor_house', state: 'shut', name: 'Governor\'s House', note: 'shut up: no servants' },
  { x: -10, z: -12, kind: 'senate', state: 'out', name: 'Senate House', note: 'on guard: a mob coming' },
  { x: 10, z: -12, kind: 'governor_villa', state: 'shut', name: 'Governor\'s Villa', note: 'shut up' },
  { x: 32, z: -12, kind: 'governor_palace', state: 'out', name: 'Governor\'s Palace', note: 'on guard: the enemy near' },
  { x: -28, z: -32, kind: 'governor_house', state: 'out', name: 'Governor\'s House', note: 'on guard: a mob coming' },
  { x: 10, z: -36, kind: 'governor_villa', state: 'out', name: 'Governor\'s Villa', note: 'on guard: the enemy near' },
];

/** Each type's people by state, as the game draws them (the models' actors). */
const ACTORS = { senate: curiaActors, governor_house: praetoriumActors, governor_villa: praetoriumMaiusActors, governor_palace: regiaActors };

const HALF = (kind) => BUILDINGS[kind].size * 2;

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The senate house and the governor's residences</h2>
<p><b>The senate house</b> (<i>curia</i>): after the Curia Julia in the Forum Romanum (a tall brick hall, its front stuccoed and scored to
look like marble, three windows high under the gable, bronze doors, steps up; Octavian's coins show a Victory on a globe at the top of
its gable) and the town curiae of the provinces, as Sabratha's on its podium behind a portico. Here a porch of six Corinthian columns cut
CVRIA, a tablet S·P·Q·R over the bronze doors, the gilt Victory on the gable, honorary statues at the foot of the steps. In session the
doors stand open, senators in the toga with the broad purple stripe come up the steps, a magistrate's lictors wait with the fasces.</p>
<p><b>The governor's residences</b>: a provincial governor lived in the <i>praetorium</i> of his capital (Herod's palace on the
promontory at Caesarea, where Pilate lived; the praetorium at Cologne by the Rhine; the great palace at Fishbourne). <b>The house</b> is
the Pompeian atrium house, as the Houses of the Faun and of the Vettii: a door on the street with HAVE in the threshold, the atrium with
its roof falling inward to the impluvium, the peristyle garden behind, painted walls, the guard at the door. <b>The villa</b> adds a
great peristyle with a fountain and statues and a dining room (<i>triclinium</i>) looking onto the garden. <b>The palace</b> stands on a
platform round two courts, a hall with a gilded ridge and a porch of gilt Corinthian capitals, two fountains, statues, and the governor's
standard at its gate.</p>
<h3>Controls</h3>
<ul>
<li>6: this scene. 1 to 4: day, golden hour, night, winter. L: the level of detail. N: snow; T: rain. M, G, Z: the game's zooms; O: orbit;
Q / E: turn the view.</li>
</ul>`;

/** The streets and the paved ground round the scene. */
function ground(minX, maxX, minZ, maxZ) {
  const g = new Group();
  const w = maxX - minX;
  const d = maxZ - minZ;
  const earth = new PlaneGeometry(w * 3, d * 3, 1, 1).rotateX(-Math.PI / 2);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  // A street along the front of each row and down each gap between the buildings.
  const streets = [[minX, 22.2, maxX, 24.8], [minX, -1.8, maxX, 1.8], [minX, -24, maxX, -21.5], [-21, minZ, -19, maxZ], [-0.9, minZ, 0.9, maxZ], [19.6, minZ, 21.6, maxZ]];
  for (const [x0, z0, x1, z1] of streets) {
    const p = new PlaneGeometry(x1 - x0, z1 - z0, 1, 1).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
    g.add(new Mesh(tintGeometry(boxUV(p)), material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 })));
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

/** Build the scene (the lab.js commerce scenes' shape: id, group, labels, setLod...). */
export function buildGovernmentScene() {
  const group = new Group();
  group.name = 'government-scene';
  group.add(ground(-36, 44, -46, 26));
  const holders = ITEMS.filter((it) => GOVERNMENT_MODELS[it.kind]).map((it) => {
    const h = new Group();
    h.position.set(it.x, 0, it.z);
    group.add(h);
    return { ...it, h };
  });
  let lod = 0;
  let ice = false;
  /** Free a group's geometries (the look's materials are shared and kept). */
  const free = (g) => g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  // The people, as the game draws them (each model's actors: curia.js curiaActors, praetorium.js ...).
  const crowd = labCrowd(group);
  function build() {
    for (const it of holders) {
      for (const c of it.h.children) free(c);
      it.h.clear();
      it.h.add(governmentLook(it.kind, lod, { ice, shows: (when) => partShows(when, it.state, false) }));
    }
    crowd.fill(lod, holders.map((it) => [ACTORS[it.kind](it.state), it.x, it.z]));
  }
  build();
  const labels = holders.map((it) => ({ name: it.name, note: it.note, x: it.x - HALF(it.kind) + 0.5, z: it.z - HALF(it.kind) + 0.5, y: 7 }));
  const lampItem = holders.find((it) => it.kind === 'senate') || holders[0];
  return {
    id: 'government',
    title: 'Government',
    key: '6',
    info: INFO,
    group,
    labels,
    fade: [4, 0, 50, 58],
    lamp: [lampItem.x + 2.1, 3.05, lampItem.z + 1.25],
    shadowBox: 46,
    noAO: [crowd.batch.group],
    get lod() { return lod; },
    setLod(n) {
      if (n === lod) return;
      lod = n;
      build();
    },
    setTurn() {},
    /** A hard frost: the residences' pools freeze and their fountains stop (rebuilt). */
    setWinter(on) {
      if (!!on === ice) return;
      ice = !!on;
      build();
    },
    /** Triangles of each building's look at a level of detail as it stands at work (built fresh). */
    triangles(l = lod) {
      const out = {};
      for (const kind of Object.keys(GOVERNMENT_MODELS)) {
        let n = 0;
        governmentLook(kind, l, { shows: (when) => partShows(when, 'open', false) }).traverse((o) => {
          if (o.isMesh && o.visible) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
        });
        out[kind] = n;
      }
      return out;
    },
  };
}
