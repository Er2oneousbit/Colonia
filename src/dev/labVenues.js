/**
 * labVenues.js
 * ----------------------------------------------------------------------------
 * The look lab's Venues scene (Shift+E): the theatre, the amphitheatre, the
 * Great Arena and the hippodrome (render3d/models/theatrum.js,
 * amphitheatrum.js, arena.js, circus.js), each with a show on and idle,
 * labelled, drawn through the game's own entries (models/venues.js: every
 * look and every crowd kit a venue's variant asks for, built by models.js
 * modelFor; the people by the game's batch; the gladiators, the hunt and the
 * race by the game's units pass, models/venueShow.js), so what shows here is
 * what the game draws. The venues stand on a made-up map of tiles, as the
 * game places them, so the show's figures are placed by the game's own rules.
 *
 * L: the level of detail. V: the camera close on the next venue (orbit).
 * window.__lab.venues: closeUp(i), items, where(i), triangles(l), setLod(n).
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry, Matrix4, InstancedMesh, DynamicDrawUsage } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { modelFor, partShows, modelMatrix } from '../render3d/models.js';
import { VENUE_MODELS, VENUE_TYPES } from '../render3d/models/venues.js';
import { venueShowList } from '../render3d/models/venueShow.js';
import { BUILDINGS } from '../data/buildings.js';
import { PeopleBatch } from '../render3d/people/batch.js';
import { UnitPass } from '../render3d/units/pass.js';
import { CONFIG } from '../config.js';

/** Metres a tile; the made-up map's size (tiles). */
const TILE = 4;
const MAP_W = 36;
const MAP_H = 30;
const TPS = CONFIG.TICKS_PER_SECOND;

/** Every show booked, and none. */
const ALL = Object.freeze({ theater: 20, amphitheater: 20, colosseum: 20, hippodrome: 20 });
const NONE = Object.freeze({ theater: 0, amphitheater: 0, colosseum: 0, hippodrome: 0 });

/** What stands where (map tiles: its top-left), with a show or idle, its label. */
const ITEMS = [
  { type: 'theater', x: 2, y: 2, shows: ALL, name: 'Theatre (theatrum)', note: 'A play: masked actors, the piper, the awning spread' },
  { type: 'theater', x: 6, y: 2, shows: NONE, name: 'Theatre', note: 'Staffed, nothing booked' },
  { type: 'amphitheater', x: 11, y: 1, shows: ALL, name: 'Amphitheatre (amphitheatrum)', note: 'Gladiators, and a play' },
  { type: 'amphitheater', x: 16, y: 1, shows: NONE, name: 'Amphitheatre', note: 'Staffed, nothing booked' },
  { type: 'colosseum', x: 21, y: 0, shows: ALL, name: 'Great Arena (arena)', note: 'Two bouts and a lion hunt' },
  { type: 'colosseum', x: 28, y: 0, shows: NONE, name: 'Great Arena', note: 'Staffed, nothing booked' },
  { type: 'hippodrome', x: 2, y: 9, shows: ALL, name: 'Hippodrome (circus)', note: 'Races: the four factions' },
  { type: 'hippodrome', x: 2, y: 17, shows: NONE, name: 'Hippodrome', note: 'Staffed, nothing booked' },
];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The venues</h2>
<p><b>The theatre</b> (<i>theatrum</i>): after Pompeii's two theatres and Vitruvius: a half circle of stone seats round the
orchestra, the decurions' chairs on its broad step, the stage on its niched front, the scaenae frons in two orders of coloured
marble round the royal door and the guests' doors, statues above, the tribunals over the passages, the velarium on its masts.</p>
<p><b>The amphitheatre</b> (<i>amphitheatrum</i>): after Pompeii's, the oldest that stands (70 BC): earth banks held by a wall of
blind arches, the double stairs outside up to the top, the sand inside its podium wall, the two gates at the ends of its long
axis (the procession's and the dead's).</p>
<p><b>The Great Arena</b> (<i>arena</i>): the Flavian amphitheatre in miniature: three storeys of arches framed by engaged columns,
Tuscan, Ionic and Corinthian, the attic with its pilasters, windows, bronze shields and the masts of the velarium; inside the
podium with its marble balustrade and the governor's box, the tiers divided by walkways, the sand with the trapdoors of the
lifts.</p>
<p><b>The hippodrome</b> (<i>circus</i>): after the Circus Maximus: the long track round the spina, the obelisk at its middle, the
seven eggs and the seven dolphins that counted the laps, the turning posts at each end, the starting gates at the straight end,
the stands down both sides and round the curved end, the triumphal gate in it.</p>
<h3>Controls</h3>
<ul>
<li>Shift+E: this scene. L: the level of detail. V: close on the next venue (orbit), and back. 1 to 4: day, golden hour,
night, winter. N: snow; T: rain. M, G, Z: the game's zooms; O: orbit; Q / E: turn the view.</li>
</ul>`;

/** The scene's ground: earth, and a paved street along the front of each row. */
function ground(ox, oz) {
  const g = new Group();
  const earth = new PlaneGeometry(MAP_W * TILE * 1.6, MAP_H * TILE * 1.6, 1, 1).rotateX(-Math.PI / 2).translate(MAP_W * TILE / 2 - ox, 0, MAP_H * TILE / 2 - oz);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  for (const z of [5.5, 8.5, 16.5, 24.5]) {
    const p = new PlaneGeometry(MAP_W * TILE, 2.4, 1, 1).rotateX(-Math.PI / 2).translate(MAP_W * TILE / 2 - ox, 0.004, z * TILE - oz);
    g.add(new Mesh(tintGeometry(boxUV(p)), material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 })));
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

/** Build the scene (the lab.js commerce scenes' shape: id, group, labels, setLod...). */
export function buildVenuesScene() {
  const group = new Group();
  group.name = 'venues-scene';
  const ox = (MAP_W / 2) * TILE;
  const oz = (MAP_H / 2) * TILE;
  group.add(ground(ox, oz));
  // The models in tiles (as the game's world is), on the made-up map: the holder scales them back to metres.
  const holder = new Group();
  holder.scale.setScalar(TILE);
  holder.position.set(-ox, 0, -oz);
  group.add(holder);
  const built = new Group();
  holder.add(built);
  const people = new PeopleBatch(holder);
  const units = new UnitPass(holder);
  let lod = 0;
  let frost = false;
  // The made-up game: the venues as buildings (a hippodrome's sections linked to it), its clock.
  const buildings = new Map();
  const game = { buildings, city: { population: 2600 }, time: { totalTicks: 0 }, map: { w: MAP_W, h: MAP_H } };
  let id = 1;
  const placed = [];
  for (const it of ITEMS) {
    if (!VENUE_MODELS[it.type]) continue;
    const def = BUILDINGS[it.type];
    const b = { id: id++, type: it.type, x: it.x, y: it.y, size: def.size, turn: 0, efficiency: 1, shows: { ...it.shows }, def };
    buildings.set(b.id, b);
    placed.push({ b, it });
    if (def.span > 1) {
      b.parts = [];
      for (let k = 1; k < def.span; k++) {
        const p = { id: id++, type: `${it.type}_part`, x: it.x + k * def.size, y: it.y, size: def.size, turn: 0, efficiency: 0, shows: null, main: b.id, section: k, def: BUILDINGS[`${it.type}_part`] };
        buildings.set(p.id, p);
        b.parts.push(p.id);
        placed.push({ b: p, it });
      }
    }
  }
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
  /** The crowd: an InstancedMesh a kit's mesh, refilled when the crowd's mood changes. */
  const crowd = new Map(); // key -> [{ im, mesh }]
  const crowdOf = (key) => {
    let list = crowd.get(key);
    if (!list) {
      list = [];
      kitOf(key).traverse((mesh) => {
        if (!mesh.isMesh) return;
        const im = new InstancedMesh(mesh.geometry, mesh.material, 64);
        im.instanceMatrix.setUsage(DynamicDrawUsage);
        im.castShadow = mesh.castShadow;
        im.receiveShadow = true;
        im.frustumCulled = false;
        im.count = 0;
        built.add(im);
        list.push({ im, local: mesh.matrixWorld.clone() });
      });
      crowd.set(key, list);
    }
    return list;
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
  const matOf = (b) => modelMatrix(b.x, b.y, b.size, b.turn || 0, 0);
  const _l = new Matrix4();
  const _m = new Matrix4();
  let lastMood = '';
  function fillCrowd(ctx) {
    const sig = placed.map(({ b }) => {
      const v = VENUE_MODELS[b.type].variant(b, { snow: frost ? 3 : 0 }, ctx);
      return (v.more || []).map((e) => e.key).join(',');
    }).join('|') + lod;
    if (sig === lastMood) return;
    lastMood = sig;
    for (const list of crowd.values()) for (const e of list) e.im.count = 0;
    for (const { b } of placed) {
      const v = VENUE_MODELS[b.type].variant(b, { snow: frost ? 3 : 0 }, ctx);
      const m = matOf(b);
      for (const e of v.more || []) {
        if (!e.key.startsWith('crowd:')) continue;
        for (const c of crowdOf(e.key)) {
          for (let j = 0; j < e.n; j++) {
            if (c.im.count >= c.im.instanceMatrix.count) continue;
            _m.multiplyMatrices(m, _l.fromArray(e.mats, j * 16)).multiply(c.local);
            c.im.setMatrixAt(c.im.count++, _m);
          }
          c.im.instanceMatrix.needsUpdate = true;
        }
      }
    }
  }
  function build() {
    built.clear();
    for (const g of kits.values()) g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    kits.clear();
    crowd.clear();
    lastMood = '';
    // (The crowds' buffers big enough for the busiest kit: a few hundred groups.)
    people.begin(lod);
    for (const { b } of placed) {
      const v = VENUE_MODELS[b.type].variant(b, { snow: frost ? 3 : 0 }, { game });
      const m = matOf(b);
      place(v.key, m, v.state);
      for (const e of v.more || []) {
        if (e.key.startsWith('crowd:')) continue;
        for (let j = 0; j < e.n; j++) place(e.key, m.clone().multiply(_l.fromArray(e.mats, j * 16)), e.state || 'always');
      }
      if (v.actors) people.add(v.actors, m, b.id);
    }
    people.end();
    // Room for every crowd kit's copies at once.
    for (const { b } of placed) {
      const v = VENUE_MODELS[b.type].variant(b, { snow: 0 }, { game });
      for (const e of v.more || []) if (e.key.startsWith('crowd:')) for (const c of crowdOf(e.key)) if (c.im.instanceMatrix.count < 640) {
        const im = new InstancedMesh(c.im.geometry, c.im.material, 640);
        im.instanceMatrix.setUsage(DynamicDrawUsage);
        im.castShadow = c.im.castShadow;
        im.receiveShadow = true;
        im.frustumCulled = false;
        im.count = 0;
        built.remove(c.im);
        built.add(im);
        c.im = im;
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
  /** The units' frame: each venue's show figures (the game's list: models/venueShows.js), the game's clock. */
  const view = { vt: 0, W: MAP_W, H: MAP_H, x0: -1e6, x1: 1e6, y0: -1e6, y1: 1e6 };
  const SCALE_OF = [5, 3, 1];
  const life = (t) => {
    ensure();
    const tick = t * TPS;
    game.time.totalTicks = Math.floor(tick);
    const ctx = { game, tick };
    fillCrowd(ctx);
    units.begin(SCALE_OF[lod], tick, [], view);
    for (const { b } of placed) {
      if (b.main) continue;
      for (const f of venueShowList(b, game, tick)) {
        if (!units.canDraw(f.u, { people: '' }, f.at.foe)) continue;
        units.add(f.u, { ...f.at, vt: 0, W: MAP_W, H: MAP_H, lift: 0 });
      }
    }
    units.end();
  };
  const labels = ITEMS.map((it) => {
    const def = BUILDINGS[it.type];
    const w = def.size * (def.span || 1);
    return { name: it.name, note: it.note, x: (it.x + w / 2) * TILE - ox, z: it.y * TILE - oz + 1, y: it.type === 'colosseum' ? 6 : 4.5 };
  });
  let close = -1;
  return {
    id: 'venues',
    title: 'Venues',
    key: 'Shift+E',
    info: INFO,
    group,
    labels,
    fade: [0, 0, 110, 130],
    lamp: [-ox + 4 * TILE, 1.6, -oz + 3 * TILE],
    shadowBox: 80,
    noAO: [people.group, units.group],
    people,
    units,
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
      if (api) api.closeUp(close, { dist: 18, el: 32, ty: 1.2, az: 35 });
      return true;
    },
    /** Each venue's middle (metres: the lab's ground), for a close-up. */
    where(i) {
      const it = ITEMS[i];
      if (!it) return null;
      const def = BUILDINGS[it.type];
      return { x: (it.x + (def.size * (def.span || 1)) / 2) * TILE - ox, z: (it.y + def.size / 2) * TILE - oz };
    },
    get figures() {
      return ITEMS.map((it, i) => ({ name: it.name, ...this.where(i) }));
    },
    items: ITEMS.map((it) => ({ type: it.type, name: it.name, note: it.note })),
    setTurn() {},
    /** A hard frost (no water here: rebuilt only for the snow's sake, which the look lays by itself). */
    setWinter(on) {
      frost = !!on;
      ensure();
    },
    /** Each type's triangles at a level of detail as it stands with a show on (its kit and its crowd). */
    triangles(l = lod) {
      const out = {};
      for (const type of VENUE_TYPES) {
        const def = BUILDINGS[type];
        const b = { id: 1, type, x: 0, y: 0, size: def.size, efficiency: 1, shows: { ...ALL } };
        const v = VENUE_MODELS[type].variant(b, { snow: 0 }, { game });
        let n = 0;
        const count = (key, state, times) => {
          modelFor(key).build(key, l).traverse((o) => {
            if (o.isMesh && partShows(o.userData.when, state, false)) n += times * (o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3);
          });
        };
        count(v.key, v.state, 1);
        const crowdTris = { n: 0 };
        for (const e of v.more || []) {
          const before = n;
          count(e.key, e.state || 'always', e.n);
          if (e.key.startsWith('crowd:')) crowdTris.n += n - before;
        }
        out[type] = { model: Math.round(n - crowdTris.n), crowd: Math.round(crowdTris.n) };
      }
      return out;
    },
    stats: () => ({ people: { ...people.stats }, units: { ...units.stats } }),
  };
}
