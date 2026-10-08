/**
 * labHealth.js
 * ----------------------------------------------------------------------------
 * The look lab's Health scene (8): the barber, the physician, the baths and
 * the hospital (render3d/models/tonstrina.js, medicus.js, balneum.js,
 * valetudinarium.js), each at work in the front row and idle behind (the
 * baths both full and still, and dry), on beaten earth between streets,
 * labelled, as the game draws them (models/health.js: the states by the
 * parts' tags; their people the actors each model gives its state). Winter
 * (the mood, or snow 2 and up) is the game's hard frost: the pool freezes,
 * nobody stands in it, and the working baths steam.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { partShows } from '../render3d/models.js';
import { HEALTH_MODELS } from '../render3d/models/health.js';
import { BALNEUM, balneumActors } from '../render3d/models/balneum.js';
import { tonstrinaActors } from '../render3d/models/tonstrina.js';
import { medicusActors } from '../render3d/models/medicus.js';
import { valetudinariumActors } from '../render3d/models/valetudinarium.js';
import { labCrowd } from './labPeople.js';

/** Each kind's people by its state (and the baths' frost). */
const ACTORS = { barber: tonstrinaActors, clinic: medicusActors, baths: balneumActors, hospital: valetudinariumActors };

/** Where each building stands (metres), what it shows, its label. */
const ITEMS = [
  { x: -22, z: 9, kind: 'barber', state: 'open', name: 'Barber (tonstrina)', note: 'a shave and the news' },
  { x: -16, z: 9, kind: 'clinic', state: 'open', name: 'Physician (medicus)', note: 'taking a pulse' },
  { x: -6, z: 9, kind: 'baths', state: 'flowing', name: 'Baths (balneum)', note: 'water and staff: the fire in' },
  { x: 16, z: 9, kind: 'hospital', state: 'open', name: 'Hospital (valetudinarium)', note: 'wards round a garden of herbs' },
  { x: -22, z: -7, kind: 'barber', state: 'shut', name: 'Barber', note: 'idle: boarded up' },
  { x: -16, z: -7, kind: 'clinic', state: 'shut', name: 'Physician', note: 'idle' },
  { x: -6, z: -7, kind: 'baths', state: 'still', name: 'Baths', note: 'water, no staff: cold' },
  { x: 4, z: -7, kind: 'baths', state: 'dry', name: 'Baths', note: 'no piped water: dry' },
  { x: 16, z: -7, kind: 'hospital', state: 'shut', name: 'Hospital', note: 'idle' },
];

const HALF = { barber: 2, clinic: 2, baths: 4, hospital: 6 };

/** The lab's one lamp light at night: the working baths' gate lanterns. */
const LAMP = [-6 + (BALNEUM.lamps[0][0] + BALNEUM.lamps[1][0]) / 2, BALNEUM.lamps[0][1] + 0.11, 9 + BALNEUM.lamps[0][2]];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The barber, the physician, the baths and the hospital</h2>
<p><b>The barber</b> (<i>tonstrina</i>): a shop open to the street across its width, as the tabernae of Pompeii and Ostia, a groove in
its sill for the boards that shut it, benches either side where men waited and talked (the barber's was the town's news: Plautus,
Horace, Martial, who thanks Domitian for clearing barbers off the street). The client on a stool under a linen cloth, the barber shaving
him with an iron razor; a basin and towels; inside, a mirror of polished bronze, pots and razors, TONSOR over the door.</p>
<p><b>The physician</b> (<i>medicus</i>): a consulting room open to the street, as the Greek iatreion and the doctors' tabernae; the
instruments of the House of the Surgeon at Pompeii (scalpels, probes, forceps, cupping vessels) on a cloth, remedies ground in a mortar
and kept in pots (Celsus), a brazier for the cautery. The doctor talks with a patient while his assistant grinds a remedy; outside, the staff of Asclepius with its
serpent, herbs in pots, MEDICVS over the door.</p>
<p><b>The baths</b> (<i>balneum</i>): a neighbourhood bath after Pompeii's Stabian, Forum and Sarno baths and Vitruvius 5.10: a
vaulted caldarium in brick with its window to the afternoon sun, a round room under a cone of a dome open at the top, a portico, a
palaestra where bathers talk, rest and splash at the labrum (Seneca's Letter 56), a cold pool with a bronze spout; behind, the furnace
(praefurnium), its stoker and firewood, the boiler, a flue, the pilae of the hypocaust through a hole in the wall. With piped water and
staff the fire is in and smoke rises; with water and no staff the pool lies still and the doors are shut; without water the pool is
dry. In a hard frost the pool freezes and the working baths steam.</p>
<p><b>The hospital</b> (<i>valetudinarium</i>): the plan of the army's hospitals (Inchtuthil, Novaesium, Vetera): small wards round a
court, each off a corridor that runs round it, a bed seen through each door; at the back the taller hall where the surgeon works; the
court a garden of medicinal herbs (seeds of fenugreek, henbane, centaury and plantain were found at Neuss), a well-head, a couch in
the sun, the altar of Asclepius and Hygieia; VALETVDINARIVM over the gate.</p>
<h3>Controls</h3>
<ul>
<li>8: this scene. 1 to 4: day, golden hour, night, winter. L: the level of detail. N: snow; T: rain. M, G, Z: the game's zooms; O: orbit;
Q / E: turn the view.</li>
</ul>`;

/** The streets and the ground round the scene. */
function ground(minX, maxX, minZ, maxZ) {
  const g = new Group();
  const w = maxX - minX;
  const d = maxZ - minZ;
  const earth = new PlaneGeometry(w * 3, d * 3, 1, 1).rotateX(-Math.PI / 2);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  // A street along the front of each row (the buildings face it) and down the gaps between them.
  const streets = [[minX, 15.2, maxX, 16.8], [minX, -0.8, maxX, 0.8], [-19.8, minZ, -18.2, maxZ], [-13.6, minZ, -10.4, maxZ], [9.6, minZ, 10.4, maxZ]];
  for (const [x0, z0, x1, z1] of streets) {
    const p = new PlaneGeometry(x1 - x0, z1 - z0, 1, 1).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
    g.add(new Mesh(tintGeometry(boxUV(p)), material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 })));
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

/** Build the scene (the lab.js commerce scenes' shape: id, group, labels, setLod...). */
export function buildHealthScene() {
  const group = new Group();
  group.name = 'health-scene';
  group.add(ground(-26, 24, -14, 16));
  const holders = ITEMS.map((it) => {
    const h = new Group();
    h.position.set(it.x, 0, it.z);
    group.add(h);
    return { ...it, h };
  });
  let lod = 0;
  let frost = false;
  /** Free a group's geometries (the look's materials are shared and kept). */
  const free = (g) => g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  // The people, as the game draws them (each model's *Actors: models/health.js), by each building's state.
  const crowd = labCrowd(group);
  function build() {
    for (const it of holders) {
      for (const c of it.h.children) free(c);
      it.h.clear();
      const key = it.kind === 'baths' && frost ? 'baths:ice' : it.kind;
      const model = HEALTH_MODELS[it.kind].build(key, lod);
      const ice = it.kind === 'baths' && frost;
      model.traverse((m) => { if (m.isMesh) m.visible = partShows(m.userData.when, it.state, ice); });
      it.h.add(model);
    }
    crowd.fill(lod, holders.map((it) => [ACTORS[it.kind](it.state, it.kind === 'baths' && frost), it.x, it.z]));
  }
  build();
  const labels = ITEMS.map((it) => ({ name: it.name, note: it.note, x: it.x - HALF[it.kind] + 0.5, z: it.z - HALF[it.kind] + 0.5, y: 4.8 }));
  return {
    id: 'health',
    title: 'Health',
    key: '8',
    info: INFO,
    group,
    labels,
    fade: [-1, 1, 30, 38],
    lamp: LAMP,
    shadowBox: 28,
    noAO: [crowd.batch.group],
    get lod() { return lod; },
    setLod(n) {
      if (n === lod) return;
      lod = n;
      build();
    },
    setTurn() {},
    /** A hard frost: the pool's ice, the working baths' steam. */
    setWinter(on) {
      if (!!on === frost) return;
      frost = !!on;
      build();
    },
    /** Triangles of each building at a level of detail (built fresh). */
    triangles(l = lod) {
      const out = {};
      for (const kind of Object.keys(HEALTH_MODELS)) {
        let n = 0;
        HEALTH_MODELS[kind].build(kind, l).traverse((o) => { if (o.isMesh) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
        out[kind] = n;
      }
      return out;
    },
  };
}
