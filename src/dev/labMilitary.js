/**
 * labMilitary.js
 * ----------------------------------------------------------------------------
 * The look lab's Military scene (C): the three forts, the barracks and the
 * military academy (render3d/models/castra*.js, tirocinium.js, campus.js),
 * each in a row of its states on a patch of beaten earth between streets,
 * labelled, as the game draws them (militaryModels.js: the states by the
 * parts' tags, the stock and the horses as `more` kits).
 *
 *   Forts      manned (the men at rest in the yard), deployed (the
 *              standards gone out with them), empty (the gate shut)
 *   Barracks   training a recruit with its racks full; half stocked; idle
 *   Academy    men drilling; staffed and quiet; idle
 *
 * The game draws its soldiers itself, over the model, at the yard's spots
 * (data/units.js FORT_YARD): the lab stands figures there in their colours
 * (and the troopers on horses), so the yard can be judged with its men in it
 * from every side. The buildings' own people (the forts' watch on the
 * walks, the troopers at the stalls, the clerk, the recruit at the post, the
 * academy's drill) are the game's actors (militaryActors), moving.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, Matrix4, PlaneGeometry } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { buildFigure } from '../render3d/models/figure.js';
import { buildHorse } from '../render3d/models/livestock.js';
import { partShows, modelFor } from '../render3d/models.js';
import { MILITARY_MODELS, militaryMore, militaryActors } from '../render3d/models/militaryModels.js';
import { CAVALRY_FORT } from '../render3d/models/castraEquitum.js';
import { FORT_YARD, UNIT_TYPES } from '../data/units.js';
import { labCrowd } from './labPeople.js';

/** Where each building stands (metres), what it shows, its label. */
const ITEMS = [
  { x: -30, z: -15, kind: 'fort_legion', state: 'open', men: 8, name: 'Legion fort', note: 'manned' },
  { x: -15, z: -15, kind: 'fort_legion', state: 'out', men: 0, name: 'Legion fort', note: 'deployed: the standards out' },
  { x: 0, z: -15, kind: 'fort_legion', state: 'shut', men: 0, name: 'Legion fort', note: 'empty' },
  { x: 15, z: -15, kind: 'fort_archer', state: 'open', men: 8, name: 'Archer fort', note: 'manned' },
  { x: 30, z: -15, kind: 'fort_archer', state: 'out', men: 0, name: 'Archer fort', note: 'deployed' },
  { x: -30, z: 0, kind: 'fort_cavalry', state: 'open', men: 8, name: 'Cavalry fort', note: 'manned: eight troopers' },
  { x: -15, z: 0, kind: 'fort_cavalry', state: 'out', men: 3, name: 'Cavalry fort', note: 'deployed, three troopers' },
  { x: 0, z: 0, kind: 'barracks', state: 'out', stock: { weapons: 400, arrows: 400, horses: 400 }, name: 'Barracks', note: 'training a recruit, full' },
  { x: 15, z: 0, kind: 'barracks', state: 'open', stock: { weapons: 150, arrows: 100, horses: 200 }, name: 'Barracks', note: 'staffed, part stocked' },
  { x: 30, z: 0, kind: 'barracks', state: 'shut', stock: {}, name: 'Barracks', note: 'idle, empty' },
  { x: -15, z: 15, kind: 'military_academy', state: 'out', name: 'Military academy', note: 'men drilling' },
  { x: 0, z: 15, kind: 'military_academy', state: 'open', name: 'Military academy', note: 'staffed' },
  { x: 15, z: 15, kind: 'military_academy', state: 'shut', name: 'Military academy', note: 'idle' },
];

/** The lab's one lamp light at night: the manned legion fort's gate. */
const LAMP = [-30 + 1.08, 1.73, -15 + 5.62];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The forts, the barracks and the military academy</h2>
<p>Rome's frontier forts keep the plan of a camp in miniature: Polybius and the treatise on camps under Hyginus's name lay a camp out
round two streets crossing before the headquarters, and the forts of Hadrian's Wall (Housesteads, Chesters), the Saalburg and
Vindolanda keep it: a rampart round a "playing card", a tower at each corner and towers at each gate, the headquarters
(<i>principia</i>) facing the main gate with the shrine of the standards in its middle, barrack blocks of eight-man rooms
(<i>contubernia</i>), ovens and water tanks along the rampart. Here each is shrunk onto 12 m, low where the men stand: the game draws its
soldiers at rest in the yard, and from the game's camera a wall hides ground 1.7 times its height behind it.</p>
<p><b>The legion fort</b>: a curtain of dressed sandstone with a crenellated parapet over a walk carried by an earth bank, square corner
towers roofed with tiles, the gate's arch between two towers, LEG II AVG over it (the Second Legion, the Wall's builders); the
headquarters with its portico, and before it the eagle (<i>aquila</i>), the signa with their silvered discs, the red vexillum and the
emperor's portrait. Deployed, the standards are out with the men. <b>The archer fort</b> (an auxiliary cohort of archers, as the Hamian
archers at Carvoran): a turf rampart with a timber breastwork, timber towers on posts, leather tents, straw butts. <b>The cavalry
fort</b> (an <i>ala</i>): a stable-barrack where men and horses lived under one roof (Wallsend, South Shields), hay, a trough, the
four-horned saddles, and the cavalry's dragon (<i>draco</i>), the windsock standard Arrian describes.</p>
<p><b>The barracks</b> (<i>tirocinium</i>): where a recruit was examined, sworn and armed: the armoury's racks fill with the sets of arms,
the arrows and the horses it holds; staffed, a recruit strikes at the post (<i>palus</i>) with wicker shield and wooden sword as Vegetius
describes. <b>The military academy</b> (<i>campus</i>): the training ground of a town's youth (the <i>iuventus</i>, whose hall at Pompeii
was painted with trophies of arms), posts, an archery range, a riding ring, the instructor's tribunal.</p>
<h3>Controls</h3>
<ul>
<li>C: this scene. 1 to 4: day, golden hour, night, winter. L: the level of detail. N: snow; T: rain. M, G, Z: the game's zooms; O: orbit;
Q / E: turn the view.</li>
</ul>`;

/** The street and the ground round the scene. */
function ground(minX, maxX, minZ, maxZ) {
  const g = new Group();
  const w = maxX - minX;
  const d = maxZ - minZ;
  const earth = new PlaneGeometry(w * 3, d * 3, 1, 1).rotateX(-Math.PI / 2);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  const streets = [];
  // A street along the front of each row (the buildings' gates face it), and down each gap between columns.
  for (const z of [-15, 0, 15]) streets.push([minX, z + 6.2, maxX, z + 7.8]);
  for (const x of [-37.5, -22.5, -7.5, 7.5, 22.5, 37.5]) streets.push([x - 0.8, minZ, x + 0.8, maxZ]);
  for (const [x0, z0, x1, z1] of streets) {
    const p = new PlaneGeometry(x1 - x0, z1 - z0, 1, 1).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
    g.add(new Mesh(tintGeometry(boxUV(p)), material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 })));
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

/** Stand-ins for the game's soldiers at rest: figures at the yard's spots, troopers on horses. */
function garrison(item) {
  const g = new Group();
  const unit = { fort_legion: 'legionary', fort_archer: 'archer', fort_cavalry: 'cavalry' }[item.kind];
  const spots = FORT_YARD[unit];
  const cloth = Number.parseInt(UNIT_TYPES[unit].color.slice(1), 16);
  for (let k = 0; k < item.men; k++) {
    const [u, v] = spots[k % spots.length];
    const x = (u - 1.5) * 4;
    const z = (v - 1.5) * 4;
    const ry = (k * 1.7) % (Math.PI * 2);
    if (unit === 'cavalry') {
      const h = buildHorse({ coat: k % 6, pose: 'stand', lod: 1 }).group;
      h.position.set(x, 0.03, z);
      h.rotation.y = ry;
      g.add(h);
      const f = buildFigure({ cloth });
      f.position.set(x, 0.62, z);
      f.rotation.y = ry;
      f.scale.setScalar(0.92);
      g.add(f);
    } else {
      const f = buildFigure({ cloth });
      f.position.set(x, 0.03, z);
      f.rotation.y = ry;
      g.add(f);
    }
  }
  return g;
}

/** Build the scene (the lab.js commerce scenes' shape: id, group, labels, setLod...). */
export function buildMilitaryScene() {
  const group = new Group();
  group.name = 'military-scene';
  group.add(ground(-38.5, 38.5, -22.5, 22.5));
  const holders = ITEMS.map((it) => {
    const h = new Group();
    h.position.set(it.x, 0, it.z);
    group.add(h);
    return { ...it, h };
  }).filter((it) => MILITARY_MODELS[it.kind]);
  for (const it of holders) {
    if (it.men && it.state === 'open') {
      const men = garrison(it);
      men.position.copy(it.h.position);
      group.add(men);
    }
  }
  let lod = 0;
  let ice = false;
  const kits = new Map();
  const kitOf = (key) => {
    const id = `${key}|${lod}`;
    if (!kits.has(id)) kits.set(id, modelFor(key).build(key, lod));
    return kits.get(id);
  };
  const _m = new Matrix4();
  /** Free a group's geometries (the look's materials are shared and kept). */
  const free = (g) => g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  // The people of each building in its state, as the game draws them (militaryModels.js
  // militaryActors: the forts' watch, the cavalry's troopers by the horses in the stalls, the clerk,
  // the recruit, the drill).
  const crowd = labCrowd(group);
  const horsesOf = (it) => (it.kind === 'fort_cavalry' && it.state === 'open' ? Math.min(CAVALRY_FORT.stalls, it.men || 0) : 0);
  function build() {
    // (The buildings' own groups, then the kits their copies share.)
    for (const it of holders) {
      for (const c of it.h.children) if (!c.userData.copy) free(c);
      it.h.clear();
    }
    for (const k of kits.values()) free(k);
    kits.clear();
    for (const it of holders) {
      const key = ice ? `${it.kind}:ice` : it.kind;
      const model = MILITARY_MODELS[it.kind].build(key, lod);
      model.traverse((m) => { if (m.isMesh) m.visible = partShows(m.userData.when, it.state, false); });
      it.h.add(model);
      for (const e of militaryMore(it.kind, it)) {
        const k = kitOf(e.key);
        for (let j = 0; j < e.n; j++) {
          const c = k.clone();
          c.userData.copy = true;
          c.matrixAutoUpdate = false;
          c.matrix.copy(_m.fromArray(e.mats, j * 16));
          c.traverse((m) => { if (m.isMesh) m.visible = partShows(m.userData.when, e.state || 'always', false); });
          it.h.add(c);
        }
      }
    }
    crowd.fill(lod, holders.map((it) => [militaryActors(it.kind, { state: it.state, horses: horsesOf(it) }), it.x, it.z]));
  }
  build();
  const labels = ITEMS.map((it) => ({ name: it.name, note: it.note, x: it.x - 5.5, z: it.z - 5.5, y: 3.6 }));
  return {
    id: 'military',
    title: 'Military',
    key: 'C',
    info: INFO,
    group,
    labels,
    fade: [0, 0, 44, 52],
    lamp: LAMP,
    noAO: [crowd.batch.group],
    get lod() { return lod; },
    setLod(n) {
      if (n === lod) return;
      lod = n;
      build();
    },
    setTurn() {},
    /** A hard frost: the forts' tanks freeze (rebuilt). */
    setWinter(on) {
      if (!!on === ice) return;
      ice = !!on;
      build();
    },
    /** Triangles of each kind of building at a level of detail (built fresh). */
    triangles(l = lod) {
      const out = {};
      for (const kind of Object.keys(MILITARY_MODELS)) {
        let n = 0;
        MILITARY_MODELS[kind].build(kind, l).traverse((o) => { if (o.isMesh) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
        out[kind] = n;
      }
      return out;
    },
  };
}
