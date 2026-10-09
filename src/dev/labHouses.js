/**
 * labHouses.js
 * ----------------------------------------------------------------------------
 * The look lab's Houses scene (Shift+K): the five homes drawn as 3D models
 * (render3d/models/houses.js: the hut, the cottage, the townhouse, the
 * apartment house and the tenement), every level in each of its four looks
 * lived in, and the first look of each empty (shutters closed, the shop
 * boarded up), labelled, as the game draws them (the kits by partShows, the
 * people the actors each level gives; a 2 x 2 block of four single-tile
 * homes at the right, each with its own look). Rows front to back from the
 * poorest; every home faces the street along its front.
 *
 * L: the level of detail. window.__lab.houses: items, triangles(lod), setLod(n).
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { partShows } from '../render3d/models.js';
import { HOUSE_MODELS, HOUSE_LEVELS, CELLS, houseKeys, peopleOf } from '../render3d/models/houses.js';
import { VARIANTS } from '../render3d/models/houseKit.js';
import { labCrowd } from './labPeople.js';

const LEVELS = [
  { kind: 'hut', name: 'Hut', z: 24, y: 3.4, note: 'rubble and mud brick, thatch, a smoke pot' },
  { kind: 'cottage', name: 'Cottage', z: 16, y: 4, note: 'plastered, tiled, a yard with a fig and a well-head' },
  { kind: 'town', name: 'Townhouse', z: 8, y: 7.2, note: 'a shop below, rooms above, a balcony' },
  { kind: 'apt', name: 'Apartment House', z: 0, y: 10, note: 'three storeys of brick, balconies on corbels' },
  { kind: 'ten', name: 'Tenement', z: -14, y: 13, note: 'an insula round a light court' },
];

/** Every home shown: its kit key, state, place, label. */
const ITEMS = [];
for (const L of LEVELS) {
  const xs = L.kind === 'ten' ? [-18, -8, 2, 12] : [-12, -6, 0, 6];
  for (let v = 0; v < VARIANTS; v++) ITEMS.push({ ...L, v, x: xs[v], state: 'open', label: `${L.name} ${v + 1}` });
  ITEMS.push({ ...L, v: 0, x: L.kind === 'ten' ? 22 : 12, state: 'shut', label: `${L.name}, empty` });
}
/** The block of four single-tile homes: cells' looks. */
const BLOCK = { x: 28, z: 24, vs: [0, 1, 2, 3], kind: 'cottage' };

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The homes</h2>
<p>The five levels where a city's homes most often settle, each in four looks picked by the building's number (a street of the same
level is not one pattern): the <b>hut</b> of rubble or mud brick on a stone footing, thatched or roofed in crude tiles, its smoke pot on
the ridge, a bench and a jar by the door; the <b>cottage</b>, plastered over a red dado with a shuttered window, a tiled roof, a little
walled yard with a fig, a trellis or an arbor and a well-head; the <b>townhouse</b>, a narrow house with a shop (<i>taberna</i>) open
to the street under its wooden boards and a balcony (<i>maenianum</i>) above, as at Herculaneum and Pompeii; the
<b>apartment house</b> in Ostia's brick with stucco string courses, a shop and a stair door, balconies on brick corbels; and the
<b>tenement</b>, an Ostian insula of four storeys round a light court, shops along the street, windows rising in rows.</p>
<p>The first look of each level is shown again empty: shutters closed, the shop boarded up, nobody about. At night a lit window here and
there. A few people (a woman at a door, a shopkeeper at his counter) at the closest zooms only. The block at the right is four single-tile homes joined into
one 2 x 2 plot, each with its own look.</p>
<h3>Controls</h3>
<ul>
<li>Shift+K: this scene. 1 to 4: day, golden hour, night, winter. L: the level of detail. N: snow; T: rain. M, G, Z: the game's zooms; O: orbit;
Q / E: turn the view.</li>
</ul>`;

/** The streets and the ground round the scene. */
function ground() {
  const g = new Group();
  const earth = new PlaneGeometry(240, 200, 1, 1).rotateX(-Math.PI / 2);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  // A street along the front of each row (the homes face +z) at the tiles' edge.
  for (const [z, w, cx] of [[28, 70, 0], [20, 56, -6], [12, 56, -6], [4, 56, -6], [-6, 56, -6]]) {
    const p = new PlaneGeometry(w, 3, 1, 1).rotateX(-Math.PI / 2).translate(cx, 0.004, z);
    g.add(new Mesh(tintGeometry(boxUV(p)), material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 })));
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

/** Build the scene (the lab.js commerce scenes' shape: id, group, labels, setLod...). */
export function buildHousesScene() {
  const group = new Group();
  group.name = 'houses-scene';
  group.add(ground());
  let lod = 0;
  const entry = HOUSE_MODELS.house;
  const holders = ITEMS.map((it) => {
    const h = new Group();
    h.position.set(it.x, 0, it.z);
    group.add(h);
    return { ...it, h };
  });
  const blockHolder = new Group();
  blockHolder.position.set(BLOCK.x, 0, BLOCK.z);
  group.add(blockHolder);
  const free = (g) => g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  const crowd = labCrowd(group);
  /** Add a kit's model to a holder at an offset, its parts shown by the state. */
  function put(holder, key, state, ox = 0, oz = 0) {
    const model = entry.build(key, lod);
    model.position.set(ox, 0, oz);
    model.traverse((m) => { if (m.isMesh) m.visible = partShows(m.userData.when, state, false); });
    holder.add(model);
  }
  function build() {
    for (const it of holders) {
      for (const c of it.h.children) free(c);
      it.h.clear();
      put(it.h, `house:${it.kind}:${it.v}`, it.state);
    }
    for (const c of blockHolder.children) free(c);
    blockHolder.clear();
    put(blockHolder, 'house:plot', 'always');
    BLOCK.vs.forEach((v, i) => put(blockHolder, `house:${BLOCK.kind}:${v}`, 'open', CELLS[i][0], CELLS[i][1]));
    crowd.fill(lod, [
      ...holders.map((it) => [it.state === 'open' ? peopleOf(it.kind, it.v) : [], it.x, it.z]),
      ...BLOCK.vs.map((v, i) => [peopleOf(BLOCK.kind, v), BLOCK.x + CELLS[i][0], BLOCK.z + CELLS[i][1]]),
    ]);
  }
  build();
  const labels = [
    ...ITEMS.map((it) => ({ name: it.label, note: it.state === 'shut' ? 'shutters closed, shop boarded' : it.note, x: it.x - 1.5, z: it.z - 1.5, y: it.y })),
    { name: 'A block of four', note: 'joined homes, each its own look', x: BLOCK.x - 3.5, z: BLOCK.z - 3.5, y: 4.4 },
  ];
  return {
    id: 'houses',
    title: 'Houses',
    key: 'Shift+K',
    info: INFO,
    group,
    labels,
    fade: [-1, 1, 44, 56],
    lamp: [0, 3, 6],
    shadowBox: 40,
    noAO: [crowd.batch.group],
    get lod() { return lod; },
    items: ITEMS,
    setLod(n) {
      if (n === lod) return;
      lod = n;
      build();
    },
    setTurn() {},
    setWinter() {},
    /** Triangles of every kit at a level of detail (built fresh), and a level's per-home total. */
    triangles(l = lod) {
      const out = {};
      for (const key of houseKeys()) {
        let n = 0;
        entry.build(key, l).traverse((o) => { if (o.isMesh) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
        out[key] = n;
      }
      return out;
    },
    levels: HOUSE_LEVELS,
  };
}
