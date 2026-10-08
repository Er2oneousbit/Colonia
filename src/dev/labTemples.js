/**
 * labTemples.js
 * ----------------------------------------------------------------------------
 * The look lab's Temples scene (5): the five small temples, the five grand
 * temples, the oracle and the mission post (render3d/models/aedes.js,
 * templum.js, tholus.js, sacellum.js, the gods' own in numina.js), on paved
 * ground between streets, labelled, drawn through the game's own entries
 * (models/religion.js: every look and every `more` kit a building's
 * variant asks for, built by models.js modelFor), so what shows here is
 * what the game draws.
 *
 * The front row: the small temples in the states the game gives them
 * (at work, a festival, the god angered, unstaffed), the oracle, the
 * mission post; behind, the grand temples likewise. V steps every temple
 * through one state at a time and back to the mix. L: the level of detail.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry, Matrix4 } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { modelFor, partShows } from '../render3d/models.js';
import { RELIGION_MODELS, RELIGION_TYPES } from '../render3d/models/religion.js';
import { BUILDINGS } from '../data/buildings.js';

/** What stands where (metres: its footprint's middle), in which state, its label. */
const ITEMS = [
  { x: -30, z: 9.5, type: 'temple_ceres', state: 'open', name: 'Temple of Ceres (aedes)', note: 'Tuscan; at work' },
  { x: -20, z: 9.5, type: 'temple_neptune', state: 'out', name: 'Temple of Neptune', note: 'Ionic; a festival' },
  { x: -10, z: 9.5, type: 'temple_mercury', state: 'open', name: 'Temple of Mercury', note: 'Corinthian; at work' },
  { x: 0, z: 9.5, type: 'temple_mars', state: 'open', angry: true, name: 'Temple of Mars', note: 'Corinthian; Mars angered' },
  { x: 10, z: 9.5, type: 'temple_venus', state: 'shut', name: 'Temple of Venus', note: 'Corinthian; unstaffed' },
  { x: 20, z: 9.5, type: 'oracle', state: 'open', name: 'Oracle (oraculum)', note: 'A tholos over a spring' },
  { x: 30, z: 9.5, type: 'mission_post', state: 'open', name: 'Mission Post (Sacellum Pacis)', note: 'Envoys at the gate' },
  { x: -28, z: -7, type: 'temple_large_ceres', state: 'out', name: 'Grand Temple of Ceres (templum)', note: 'A festival' },
  { x: -14, z: -7, type: 'temple_large_neptune', state: 'open', name: 'Grand Temple of Neptune', note: 'At work' },
  { x: 0, z: -7, type: 'temple_large_mercury', state: 'open', name: 'Grand Temple of Mercury', note: 'At work' },
  { x: 14, z: -7, type: 'temple_large_mars', state: 'out', name: 'Grand Temple of Mars', note: 'A festival' },
  { x: 28, z: -7, type: 'temple_large_venus', state: 'open', angry: true, name: 'Grand Temple of Venus', note: 'Venus angered' },
];

/** The states V steps every temple through (null: each its own, as listed). */
const OVERRIDES = [null, { state: 'open' }, { state: 'out' }, { state: 'open', angry: true }, { state: 'shut' }];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The temples, the oracle and the mission post</h2>
<p><b>The small temple</b> (<i>aedes</i>): a Roman podium temple in small, after the Temple of Portunus by the Tiber, the Maison Carree
at Nimes and the Temple of Hercules at Cori: a high podium with steps up the front only, a porch of four columns and one either side behind
them, the cella with its bronze doors, the frieze painted and cut with the dedication in gilt letters (CERERI, NEPTVNO, MERCVRIO,
MARTI VLTORI, VENERI GENETRICI), the pediment's sculpture on a painted ground, the acroteria; the altar in front of the steps, where the
rite was done, in the god's sight through the open doors.</p>
<p><b>Each god</b>: Ceres in the Tuscan way of her Aventine temple (terracotta palmettes, a gilt sheaf between torches, sheaves at the
altar, a plough); Neptune Ionic in sea blue (a trident between dolphins, a running wave on the frieze, bronze dolphins, an anchor given by
a ship's crew); Mercury Corinthian in green and gold (the caduceus between roosters, winged hats, a herm at the corner); Mars as Augustus's
Mars Ultor, crimson (a trophy of arms, a crested helmet on the gable, shields of the spoils on the walls, a bronze trophy by the steps);
Venus as Caesar's Venus Genetrix, pale blue and rose (a shell between doves, myrtles and roses).</p>
<p><b>The grand temple</b> (<i>templum</i>): after Mars Ultor in the Forum of Augustus and Apollo's temple at Pompeii: marble, six columns
across the front and four down each side, the back a solid wall; a big altar in a court ringed by porticoes, the precinct's wall closing
it. <b>The oracle</b>: a tholos (Athena Pronaia below Delphi, the round temple on the cliff at Tivoli) of ten Corinthian columns on three steps, garlands and
ox skulls on its frieze, the cleft in the rock breathing vapour over its spring, the tripod over the omphalos inside, Apollo's laurel,
bronze tripods burning. <b>The mission post</b>: a sacellum of Pax, her statue between two columns, the envoys' lodging, gifts of wine,
cloth and pottery for the villages, an olive, the white standard with the herald's caduceus.</p>
<p>States: at work (the doors open, the altar's fire, the priest with his head veiled and his boy); a festival this month (garlands,
the crowd in wreaths, the flute player, the victim, a big fire); the god angered (the smoke over the altar black); unstaffed (the doors
shut, cold ash).</p>
<h3>Controls</h3>
<ul>
<li>5: this scene. V: every temple in one state, then the mix again. 1 to 4: day, golden hour, night, winter. L: the level of detail.
N: snow; T: rain. M, G, Z: the game's zooms; O: orbit; Q / E: turn the view.</li>
</ul>`;

/** The streets and the paved ground round the scene. */
function ground(minX, maxX, minZ, maxZ) {
  const g = new Group();
  const w = maxX - minX;
  const d = maxZ - minZ;
  const earth = new PlaneGeometry(w * 3, d * 3, 1, 1).rotateX(-Math.PI / 2);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  const streets = [[minX, 13.6, maxX, 16.4], [minX, 0.1, maxX, 5.4]];
  for (const [x0, z0, x1, z1] of streets) {
    const p = new PlaneGeometry(x1 - x0, z1 - z0, 1, 1).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
    g.add(new Mesh(tintGeometry(boxUV(p)), material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 })));
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

/** Build the scene (the lab.js commerce scenes' shape: id, group, labels, setLod...). */
export function buildTemplesScene() {
  const group = new Group();
  group.name = 'temples-scene';
  group.add(ground(-40, 40, -20, 18));
  const built = new Group();
  group.add(built);
  let lod = 0;
  let frost = false;
  let override = 0;
  /** Kits by key at this level, built once (the game's builders). */
  const kits = new Map();
  const kitOf = (key) => {
    let k = kits.get(key);
    if (!k) {
      k = modelFor(key).build(key, lod);
      k.updateMatrixWorld(true);
      kits.set(key, k);
    }
    return k;
  };
  /** A copy of a kit's meshes (shared geometry) at matrix `mat`, the parts its state shows. */
  const place = (key, mat, state) => {
    const h = new Group();
    h.matrixAutoUpdate = false;
    h.matrix.copy(mat);
    kitOf(key).traverse((mesh) => {
      if (!mesh.isMesh || !partShows(mesh.userData.when, state, false)) return;
      const c = new Mesh(mesh.geometry, mesh.material);
      c.castShadow = mesh.castShadow;
      c.receiveShadow = true;
      c.matrixAutoUpdate = false;
      c.matrix.copy(mesh.matrixWorld);
      h.add(c);
    });
    built.add(h);
  };
  const _l = new Matrix4();
  function build() {
    built.clear();
    for (const g of kits.values()) g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    kits.clear();
    const o = OVERRIDES[override];
    for (const it of ITEMS) {
      const state = o && it.type.startsWith('temple_') ? o.state : it.state;
      const angry = o && it.type.startsWith('temple_') ? !!o.angry : !!it.angry;
      const god = BUILDINGS[it.type].god;
      const game = { city: { gods: god ? { [god]: { festivalsHeld: state === 'out' ? 1 : 0, monthsSinceFestival: 0, angered: angry } } : {} } };
      const b = { id: 1, type: it.type, x: 0, y: 0, size: BUILDINGS[it.type].size, efficiency: state === 'shut' ? 0 : 1 };
      const v = RELIGION_MODELS[it.type].variant(b, { snow: frost ? 3 : 0 }, { game });
      const m = new Matrix4().setPosition(it.x, 0, it.z);
      place(v.key, m, v.state);
      for (const e of v.more || []) {
        for (let j = 0; j < e.n; j++) place(e.key, m.clone().multiply(_l.fromArray(e.mats, j * 16)), e.state || 'always');
      }
    }
  }
  let ready = false;
  const ensure = () => {
    if (!ready) {
      ready = true;
      build();
    }
  };
  const labels = ITEMS.map((it) => {
    const h = BUILDINGS[it.type].size * 2;
    return { name: it.name, note: it.note, x: it.x - h + 0.5, z: it.z - h + 0.5, y: it.type.startsWith('temple_large') ? 11 : 8 };
  });
  return {
    id: 'temples',
    title: 'Temples',
    key: '5',
    info: INFO,
    group,
    labels,
    fade: [0, 0, 50, 58],
    // The torch's light by the Temple of Mercury's altar.
    lamp: [-10, 1.6, 9.5 + 3.22],
    shadowBox: 46,
    get lod() { return lod; },
    setLod(n) {
      if (n === lod) return;
      lod = n;
      if (ready) build();
    },
    /** V: every temple in one state, then the mix again. */
    onKey(k) {
      if (k !== 'v') return false;
      override = (override + 1) % OVERRIDES.length;
      ensure();
      build();
      return true;
    },
    setTurn() {},
    /** A hard frost: the oracle's spring freezes (rebuilt). */
    setWinter(on) {
      const was = frost;
      frost = !!on;
      if (!ready) ensure();
      else if (was !== frost) build();
    },
    /** Each type's triangles at a level of detail as it stands at work (its own kit and its `more`, built fresh). */
    triangles(l = lod) {
      const out = {};
      for (const type of RELIGION_TYPES) {
        const b = { id: 1, type, x: 0, y: 0, size: BUILDINGS[type].size, efficiency: 1 };
        const v = RELIGION_MODELS[type].variant(b, { snow: 0 }, { game: null });
        let n = 0;
        const count = (key, state, times) => {
          modelFor(key).build(key, l).traverse((o) => {
            if (o.isMesh && partShows(o.userData.when, state, false)) n += times * (o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3);
          });
        };
        count(v.key, v.state, 1);
        for (const e of v.more || []) count(e.key, e.state || 'always', e.n);
        out[type] = Math.round(n);
      }
      return out;
    },
  };
}
