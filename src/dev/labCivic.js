/**
 * labCivic.js
 * ----------------------------------------------------------------------------
 * The look lab's Civic monuments scene (Shift+H): the Great Baths and the
 * Caravanserai (render3d/models/thermae.js, mansio.js) at every stage of
 * their sites and finished in each state, labelled, drawn through the
 * game's own entries (models/civicMonuments.js: the look and the store's
 * kit a monument's variant asks for, built by models.js modelFor; the
 * people and the beasts by the game's batch), so what shows here is what
 * the game draws. Each stands on a made-up map of tiles with its site
 * record (b.mon) as the sim keeps it, and a work camp's crew on the sites
 * at work.
 *
 * L: the level of detail. V: the camera close on the next monument (orbit).
 * window.__lab.civic: closeUp(i), items, where(i), triangles(l), setLod(n).
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry, Matrix4 } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { modelFor, partShows, modelMatrix } from '../render3d/models.js';
import { CIVIC_MODELS, CIVIC_TYPES, STEPS } from '../render3d/models/civicMonuments.js';
import { MONUMENT_TYPES } from '../data/monuments.js';
import { BUILDINGS } from '../data/buildings.js';
import { PeopleBatch } from '../render3d/people/batch.js';
import { CONFIG } from '../config.js';

/** Metres a tile; the made-up map's size (tiles). */
const TILE = 4;
const MAP_W = 37;
const MAP_H = 22;
const TPS = CONFIG.TICKS_PER_SECOND;

/** A site at stage s, `f` of its work done; a finished one with its store, water and staff. */
const site = (s, f, extra = {}) => ({ stage: s, f, ...extra });
const done = (extra = {}) => ({ stage: 99, f: 1, store: 200, water: true, staff: 1, ...extra });

/** What stands where (map tiles: its top-left), its record, its label. */
const ITEMS = [
  { type: 'thermae', x: 1, y: 1, rec: site(0, 0.6), name: 'Great Baths: foundations', note: 'Stage 1: the footings and the hypocaust\'s pilae' },
  { type: 'thermae', x: 7, y: 1, rec: site(1, 0.55), name: 'Great Baths: walls', note: 'Stage 2: the walls and the drum rising' },
  { type: 'thermae', x: 13, y: 1, rec: site(2, 0.4), name: 'Great Baths: vaults', note: 'Stage 3: the vaults on their centering' },
  { type: 'thermae', x: 19, y: 1, rec: site(3, 0.55), name: 'Great Baths: palaestra', note: 'Stage 4: the colonnades and the vestibules' },
  { type: 'thermae', x: 25, y: 1, rec: site(2, 0.7, { halted: true }), name: 'Great Baths: halted', note: 'No crew, the cranes still' },
  { type: 'thermae', x: 31, y: 1, rec: done(), name: 'Thermae (Great Baths)', note: 'Working: heated, piped, staffed' },
  { type: 'thermae', x: 1, y: 8, rec: done({ store: 0 }), name: 'Great Baths: cold', note: 'No timber: the furnaces dark' },
  { type: 'thermae', x: 7, y: 8, rec: done({ water: false }), name: 'Great Baths: dry', note: 'No piped water' },
  { type: 'thermae', x: 13, y: 8, rec: done({ staff: 0.3 }), name: 'Great Baths: unstaffed', note: 'Too few hands: shut' },
  { type: 'thermae', x: 19, y: 8, rec: done({ sacked: true }), name: 'Great Baths: sacked', note: 'Raiders\' work' },
  { type: 'mansio_magna', x: 25, y: 8, rec: site(0, 0.6), name: 'Caravanserai: courtyard', note: 'Stage 1: footings, the court paved' },
  { type: 'mansio_magna', x: 31, y: 8, rec: site(1, 0.55), name: 'Caravanserai: colonnade', note: 'Stage 2: the colonnade and the stables' },
  { type: 'mansio_magna', x: 1, y: 15, rec: site(2, 0.6), name: 'Caravanserai: the inn', note: 'Stage 3: the upper storey and the roofs' },
  { type: 'mansio_magna', x: 7, y: 15, rec: site(1, 0.8, { halted: true }), name: 'Caravanserai: halted', note: 'No crew' },
  { type: 'mansio_magna', x: 13, y: 15, rec: done(), name: 'Mansio Magna (Caravanserai)', note: 'Staffed and fed' },
  { type: 'mansio_magna', x: 19, y: 15, rec: done({ store: 0 }), name: 'Caravanserai: no food', note: 'Staffed, its larder empty' },
  { type: 'mansio_magna', x: 25, y: 15, rec: done({ staff: 0.3 }), name: 'Caravanserai: unstaffed', note: 'Too few hands: the gate shut' },
  { type: 'mansio_magna', x: 31, y: 15, rec: done({ sacked: true }), name: 'Caravanserai: sacked', note: 'Raiders\' work' },
];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The civic monuments</h2>
<p><b>The Great Baths</b> (<i>thermae</i>): the imperial baths in miniature, after Caracalla's and Diocletian's and Pompeii's
Stabian and Forum baths: the natatio open to the sky before the frigidarium's façade of columns and statues, the cold hall under
three groin vaults lit by thermal windows, the tepidarium, the domed caldarium bulging out at the back with its tall windows; the
palaestrae either side with their colonnades; the furnaces, the woodstore and the cistern in the service yards behind.</p>
<p><b>The Caravanserai</b> (<i>mansio magna</i>): a great road station after the mansiones of the Roman roads and the caravan inns
of the eastern provinces: two storeys of rooms round a court, the colonnade and the gallery over it, the gatehouse big enough for a
wagon, the stables, the stores and the tavern, the well and the trough, the bath's little dome at the back corner.</p>
<h3>Controls</h3>
<ul>
<li>Shift+H: this scene. L: the level of detail. V: close on the next monument (orbit), and back. 1 to 4: day, golden hour,
night, winter. N: snow; T: rain. M, G, Z: the game's zooms; O: orbit; Q / E: turn the view.</li>
</ul>`;

/** The scene's ground: earth, and a paved street along the front of each row. */
function ground(ox, oz) {
  const g = new Group();
  const earth = new PlaneGeometry(MAP_W * TILE * 1.6, MAP_H * TILE * 1.6, 1, 1).rotateX(-Math.PI / 2).translate(MAP_W * TILE / 2 - ox, 0, MAP_H * TILE / 2 - oz);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  for (const z of [6.5, 13.5, 20.5]) {
    const p = new PlaneGeometry(MAP_W * TILE, 2.4, 1, 1).rotateX(-Math.PI / 2).translate(MAP_W * TILE / 2 - ox, 0.004, z * TILE - oz);
    g.add(new Mesh(tintGeometry(boxUV(p)), material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 })));
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

/** A building of the made-up game from an item: its site record as the sim keeps it. */
function makeBuilding(it, id) {
  const def = BUILDINGS[it.type];
  const t = MONUMENT_TYPES[def.mon];
  const r = it.rec;
  const stage = Math.min(t.stages.length, r.stage);
  const work = stage < t.stages.length ? t.stages[stage].work * r.f : 0;
  const mon = { stage, work, got: {}, way: {}, paid: true, halted: !!r.halted, store: r.store || 0, sacked: !!r.sacked, wasOpen: false };
  return { id, type: it.type, x: it.x, y: it.y, size: def.size, turn: 0, def, mon, efficiency: r.staff ?? 0, hasWater: r.water !== false };
}

/** Build the scene (the lab.js commerce scenes' shape: id, group, labels, setLod...). */
export function buildCivicScene() {
  const group = new Group();
  group.name = 'civic-scene';
  const ox = (MAP_W / 2) * TILE;
  const oz = (MAP_H / 2) * TILE;
  group.add(ground(ox, oz));
  const holder = new Group();
  holder.scale.setScalar(TILE);
  holder.position.set(-ox, 0, -oz);
  group.add(holder);
  const built = new Group();
  holder.add(built);
  const people = new PeopleBatch(holder);
  let lod = 0;
  let frost = false;
  // The made-up game: the monuments, a work camp's crew on each site not halted, the clock.
  const buildings = new Map();
  const game = { buildings, city: { population: 4000 }, time: { totalTicks: 0 }, map: { w: MAP_W, h: MAP_H } };
  const placedList = [];
  let id = 1;
  for (const it of ITEMS) {
    if (!CIVIC_MODELS[it.type]) continue;
    const b = makeBuilding(it, id++);
    buildings.set(b.id, b);
    placedList.push({ b, it });
    if (b.mon.stage < MONUMENT_TYPES[b.def.mon].stages.length && !b.mon.halted) {
      const camp = { id: id++, type: 'work_camp', def: BUILDINGS.work_camp, camp: { crew: { state: 'site', site: b.id, since: 0 } } };
      buildings.set(camp.id, camp);
    }
  }
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
  const matOf = (b) => modelMatrix(b.x, b.y, b.size, b.turn || 0, 0);
  const _l = new Matrix4();
  function build() {
    built.clear();
    for (const g of kits.values()) g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    kits.clear();
    people.begin(lod);
    for (const { b } of placedList) {
      const v = CIVIC_MODELS[b.type].variant(b, { snow: frost ? 3 : 0 }, { game });
      const m = matOf(b);
      place(v.key, m, v.state);
      for (const e of v.more || []) for (let j = 0; j < e.n; j++) place(e.key, m.clone().multiply(_l.fromArray(e.mats, j * 16)), e.state || 'always');
      if (v.actors) people.add(v.actors, m, b.id);
    }
    people.end();
  }
  let ready = false;
  const ensure = () => {
    if (!ready) {
      ready = true;
      build();
    }
  };
  const life = (t) => {
    ensure();
    game.time.totalTicks = Math.floor(t * TPS);
  };
  const labels = ITEMS.map((it) => ({ name: it.name, note: it.note, x: (it.x + 2.5) * TILE - ox, z: it.y * TILE - oz + 1, y: 9 }));
  let close = -1;
  return {
    id: 'civic',
    title: 'Civic monuments',
    key: 'Shift+H',
    info: INFO,
    group,
    labels,
    fade: [0, 0, 110, 130],
    lamp: [-ox + 34 * TILE, 1.6, -oz + 6 * TILE],
    shadowBox: 90,
    noAO: [people.group],
    people,
    life,
    get lod() { return lod; },
    setLod(n) {
      if (n === lod) return;
      lod = n;
      if (ready) build();
    },
    onKey(k, api) {
      if (k !== 'v') return false;
      close = close + 1 >= ITEMS.length ? -1 : close + 1;
      if (api) api.closeUp(close, { dist: 30, el: 32, ty: 2, az: 35 });
      return true;
    },
    /** Each monument's middle (metres: the lab's ground), for a close-up. */
    where(i) {
      const it = ITEMS[i];
      if (!it) return null;
      return { x: (it.x + 2.5) * TILE - ox, z: (it.y + 2.5) * TILE - oz };
    },
    get figures() {
      return ITEMS.map((it, i) => ({ name: it.name, ...this.where(i) }));
    },
    items: ITEMS.map((it) => ({ type: it.type, name: it.name, note: it.note })),
    setTurn() {},
    /** A hard frost: the pools and the trough frozen, steam over the working baths. */
    setWinter(on) {
      if (frost === !!on) return;
      frost = !!on;
      if (ready) build();
    },
    /** Each type's triangles at a level of detail, finished and at work (its kit and its store's), and its heaviest site's. */
    triangles(l = lod) {
      const out = {};
      const count = (key, state) => {
        let n = 0;
        modelFor(key).build(key, l).traverse((o) => {
          if (o.isMesh && partShows(o.userData.when, state, false)) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
        });
        return n;
      };
      for (const type of CIVIC_TYPES) {
        const b = makeBuilding({ type, x: 0, y: 0, rec: done() }, 1);
        const v = CIVIC_MODELS[type].variant(b, { snow: 0 }, { game });
        let n = count(v.key, v.state);
        for (const e of v.more || []) n += count(e.key, 'always') * e.n;
        let site = 0;
        const stages = MONUMENT_TYPES[BUILDINGS[type].mon].stages.length;
        for (let s = 0; s < stages; s++) site = Math.max(site, count(`${type}:s${s}:${STEPS - 1}`, 'always'));
        out[type] = { model: Math.round(n), site: Math.round(site) };
      }
      return out;
    },
    stats: () => ({ people: { ...people.stats } }),
  };
}
