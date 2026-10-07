/**
 * labGardens.js
 * ----------------------------------------------------------------------------
 * The look lab's Gardens scene (0): the gardens, the statues, the gardeners'
 * yard and the triumphal arch (render3d/models/hortus.js, signa.js,
 * topiaria.js, fornix.js), laid out on a small map of their own and drawn
 * through the game's own entries (models/decor.js: every look and every
 * `more` kit a building's variant asks for), so what shows here is what the
 * game draws:
 *
 *   - a block of eight gardens side by side (their hedges join, their walks
 *     run through), a row of four left untended, an L of three
 *     (its inside corner closed), and one alone, untended
 *   - the three small statues, the three statues and the two grand ones,
 *     tended in the front row and neglected behind
 *   - the gardeners' yard at work and shut
 *   - an arch across a road along x, and one across a road along y
 *
 * C: the month (the gardens' seasons: winter, spring, the roses in May, the
 * oleanders in July, the vintage); the winter mood (4) or snow 2 and over a
 * hard frost (the basins freeze). L: the level of detail.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry, Matrix4 } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { modelFor, partShows } from '../render3d/models.js';
import { DECOR_MODELS } from '../render3d/models/decor.js';

/** The scene's map: tiles W x H, 4 m each, its middle at the lab's origin. */
const MW = 30;
const MH = 18;
const TILE = 4;
/** A footprint's middle in the lab's metres. */
const mid = (x, y, S) => [(x + S / 2 - MW / 2) * TILE, (y + S / 2 - MH / 2) * TILE];

/** The months C steps through, and what each shows in a garden. */
const MONTHS = [
  [0, 'Ianuarius: winter, the vines bare'],
  [3, 'Aprilis: spring, young leaves'],
  [4, 'Maius: the roses in flower'],
  [6, 'Iulius: the oleanders, green grapes'],
  [9, 'October: the vintage, the vines turning'],
];

/** What stands where: [type, x, y, props, label name, note]. */
const PLAN = [];
const G = (x, y, care = 0) => PLAN.push(['garden', x, y, { careStep: care }]);
// A block of eight tended gardens, a row of four untended, an L of three, one alone untended.
for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) G(x, y);
for (let x = 0; x < 4; x++) G(x, 3, 4);
G(0, 5);
G(1, 5);
G(0, 6);
G(2, 5, 3);
for (const [k, design] of ['herm', 'bust', 'victory'].entries()) {
  PLAN.push(['statue_small', 6 + k, 0, { design }], ['statue_small', 6 + k, 3, { design, careStep: 4 }]);
}
for (const [k, design] of ['augustus', 'togatus', 'general'].entries()) {
  PLAN.push(['statue_medium', 10 + k * 2, 0, { design }], ['statue_medium', 10 + k * 2, 3, { design, careStep: 4 }]);
}
for (const [k, design] of ['equestrian', 'enthroned'].entries()) {
  PLAN.push(['statue_large', 17 + k * 3, 0, { design }], ['statue_large', 17 + k * 3, 4, { design, careStep: 4 }]);
}
PLAN.push(['gardener_yard', 6, 6, { efficiency: 1 }], ['gardener_yard', 8, 6, { efficiency: 0 }]);
PLAN.push(['triumphal_arch', 10, 11, { axis: 0 }], ['triumphal_arch', 25, 11, { axis: 1 }]);
/** The roads: one along x through the first arch's middle row, one along y through the second's middle column. */
const ROADS = [[0, 12, MW - 1, 12], [26, 0, 26, MH - 1]];

const LABELS = [
  [1.5, 0.5, 2.6, 'Gardens (viridaria)', 'Side by side: one garden, the walks run through'],
  [1.5, 3, 2.4, 'Untended', 'Ragged box, weeds, the basin dry'],
  [0, 5, 2.4, 'An L of gardens', 'Its hedge runs round the inside corner'],
  [6, 0, 2.8, 'Herm of Liber', 'Small statue'],
  [7, 0, 2.8, 'Portrait bust', 'GENIO COLONIAE'],
  [8, 0, 2.8, 'Victory on a globe', 'Small statue, gilt bronze'],
  [6, 3, 2.6, 'Small statues, neglected', 'Droppings, a fallen wreath, weeds'],
  [10.5, 0.5, 4.8, 'Augustus (Prima Porta)', 'Marble, the cloak\'s paint'],
  [12.5, 0.5, 4.8, 'Patron in his toga', 'PATRONO COLONIAE'],
  [14.5, 0.5, 4.8, 'General in bronze', 'GERMANICO CAESARI'],
  [12.5, 3.5, 4.6, 'Statues, neglected', 'Lichen, patina, streaks'],
  [18, 1, 6.8, 'Equestrian bronze', 'After Marcus Aurelius, gilded'],
  [21, 1, 6.4, 'Enthroned as king of the gods', 'After the Augustus from Cumae'],
  [19.5, 5, 6.4, 'Grand statues, neglected', 'Green bronze, cold lamps'],
  [6, 6, 2.6, "Gardeners' yard (topiaria)", 'At work'],
  [8, 6, 2.6, "Gardeners' yard", 'Shut'],
  [11, 12, 9.5, 'Triumphal arch (fornix)', 'Across a road along x'],
  [26, 12, 9.5, 'Triumphal arch', 'Across a road along y'],
];

/** A map the entries' variants read (the gardens' neighbours): the layers and the buildings they look at. */
function labGame() {
  const n = MW * MH;
  const map = {
    w: MW, h: MH, size: n,
    building: new Uint16Array(n),
    road: new Uint8Array(n),
    inBounds: (x, y) => x >= 0 && y >= 0 && x < MW && y < MH,
    idx: (x, y) => y * MW + x,
    hasRoad(x, y) { return this.inBounds(x, y) && this.road[this.idx(x, y)] !== 0; },
  };
  for (const [x0, y0, x1, y1] of ROADS) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) map.road[map.idx(x, y)] = 1;
  const buildings = new Map();
  PLAN.forEach(([type, x, y, props], i) => {
    const id = i + 1;
    const S = DECOR_SIZE[type];
    const b = { id, type, x, y, size: S, turn: 0, careStep: 0, efficiency: 1, ...props };
    buildings.set(id, b);
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) map.building[map.idx(x + dx, y + dy)] = id;
  });
  return { map, buildings, time: { month: 4 } };
}

const DECOR_SIZE = { garden: 1, statue_small: 1, statue_medium: 2, statue_large: 3, gardener_yard: 1, triumphal_arch: 3 };

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>Gardens, statues and the triumphal arch</h2>
<p><b>The gardens</b> (<i>viridaria</i>) after the peristyle gardens of Pompeii as Wilhelmina Jashemski excavated them, root cavities
and all: beds edged with clipped box, gravel walks, roses (Pliny's twelve-petalled Campanian rose), oleander, myrtle, laurel,
acanthus and Madonna lilies; a vine on a pergola, its posts hung with <i>oscilla</i> (marble discs that turned in the wind); at the
middle a marble basin on its foot (<i>labrum</i>), a sundial, a pool with a bronze boy, or a laurel. Each plot is one of four, turned
by its tile, so a row of gardens is not a pattern; gardens side by side lose the hedges between them and become one garden.
Untended (the gardeners' care, Colonia's own rule) the box grows ragged and brown, weeds come up in the walks, the basin is dry.</p>
<p><b>The statues</b> after the statues themselves: the Augustus of Prima Porta in marble with his cloak's paint, a patron of the
colony in his toga, a general in bronze; the gilded Marcus Aurelius on his horse; an emperor enthroned as the king of the gods, after the seated
Augustus from Cumae. Small ones: a herm of Liber, a portrait bust, a Victory on a globe. Their bases are cut as the honorific bases
were, in Roman capitals (S P Q R; D D, by decree of the council; P P, at public cost). Neglected: lichen and black streaks on the
marble, the bronze gone green, droppings, the wreath fallen.</p>
<p><b>The gardeners' yard</b> (<i>topiaria</i>): the gardeners' shed, pots of seedlings (the Romans raised them in pierced pots,
<i>ollae perforatae</i>, as found along Pompeii's garden walls), the hoe, the rake, the pruning knife, a watering jar, the compost;
a gardener clipping a box into shape while it is staffed.</p>
<p><b>The triumphal arch</b> (<i>fornix</i>) after the Arch of Titus: one bay on piers faced with engaged columns, Victories in the
spandrels, reliefs of the triumph inside the passage under a coffered vault, the attic cut SENATVS POPVLVSQVE ROMANVS in gilt
bronze letters, and on top the bronze chariot of the triumph drawn by four horses. The road runs on under it.</p>
<h3>Controls</h3>
<ul>
<li>0: this scene. C: the month. L: the level of detail. 1 to 4: day, golden hour, night, winter. N: snow; T: rain.
M, G, Z: the game's zooms; O: orbit; Q / E: turn the view.</li>
</ul>`;

/** The ground: beaten earth, the roads in basalt. */
function ground() {
  const g = new Group();
  const earth = new PlaneGeometry(MW * TILE * 1.8, MH * TILE * 2.4, 1, 1).rotateX(-Math.PI / 2);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  const basalt = material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 });
  for (const [x0, y0, x1, y1] of ROADS) {
    const [ax, az] = mid(x0, y0, 1);
    const [bx, bz] = mid(x1, y1, 1);
    const w = x0 === x1 ? TILE * 0.78 : bx - ax + TILE;
    const d = y0 === y1 ? TILE * 0.78 : bz - az + TILE;
    const p = new PlaneGeometry(w, d, 1, 1).rotateX(-Math.PI / 2).translate((ax + bx) / 2, 0.004, (az + bz) / 2);
    g.add(new Mesh(tintGeometry(boxUV(p)), basalt));
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

/** The Gardens scene, in the commerce scenes' terms (labCommerce.js): { gardens: scene }. */
export function buildGardensScene() {
  const group = new Group();
  group.name = 'gardens-scene';
  group.add(ground());
  const built = new Group();
  group.add(built);
  const game = labGame();
  let lod = 0;
  let monthAt = 2;
  let frost = false;
  const kits = new Map();
  const kitOf = (key) => {
    const k = `${key}|${lod}`;
    if (!kits.has(k)) {
      const g = modelFor(key).build(key, lod);
      g.updateMatrixWorld(true);
      kits.set(k, g);
    }
    return kits.get(k);
  };
  /** A copy of a look's meshes (shared geometry) at matrix `mat`, the parts its state shows. */
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
  const shown = [];
  const ctx = { game, month: 4 };
  const _l = new Matrix4();
  function build() {
    built.clear();
    for (const g of kits.values()) g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    kits.clear();
    shown.length = 0;
    ctx.month = MONTHS[monthAt][0];
    game.time.month = ctx.month;
    for (const b of game.buildings.values()) {
      const def = DECOR_MODELS[b.type];
      if (!def) continue;
      const v = def.variant(b, { snow: frost ? 3 : 0, state: 0 }, ctx);
      // (The game picks a statue's design by its tile; here each is shown by name.)
      if (b.design) v.key = v.key.replace(/^([a-z_]+):[a-z]+:/, `$1:${b.design}:`);
      const [cx, cz] = mid(b.x, b.y, b.size);
      const m = new Matrix4().makeRotationY((-(b.turn & 3) * Math.PI) / 2).setPosition(cx, 0, cz);
      place(v.key, m, v.state);
      for (const it of v.more || []) {
        for (let j = 0; j < it.n; j++) place(it.key, m.clone().multiply(_l.fromArray(it.mats, j * 16)), it.state || 'always');
      }
      shown.push({ type: b.type, key: v.key, more: (v.more || []).map((it) => `${it.key} x${it.n}`) });
    }
  }
  /** Built once the scene is first shown (it is the lab's biggest). */
  let ready = false;
  const ensure = () => {
    if (!ready) {
      ready = true;
      build();
    }
  };
  const labels = LABELS.map(([x, y, hgt, name, note]) => {
    const [lx, lz] = mid(x, y, 1);
    return { name, note, x: lx, y: hgt, z: lz };
  });
  const scene = {
    id: 'gardens',
    title: 'Gardens',
    key: '0',
    info: INFO,
    group,
    labels,
    fade: [0, 0, MW * TILE * 0.62, MW * TILE * 0.62 + 10],
    // The lamp's light by the grand statue's lampstands.
    lamp: [mid(17, 0, 3)[0] - 2.15, 2.3, mid(17, 0, 3)[1] + 3.6],
    shadowBox: 64,
    get lod() { return lod; },
    get month() { return MONTHS[monthAt][0]; },
    shown,
    setLod(n) {
      if (n === lod) return;
      lod = n;
      if (ready) build();
    },
    setMonth(i) {
      monthAt = ((i % MONTHS.length) + MONTHS.length) % MONTHS.length;
      if (ready) build();
    },
    /** C: the next month. */
    onKey(k) {
      if (k !== 'c') return false;
      this.setMonth(monthAt + 1);
      return true;
    },
    setTurn() {},
    /** A hard frost: winter in the gardens, their basins frozen. */
    setWinter(on) {
      ensure();
      if (!!on === frost) return;
      frost = !!on;
      if (frost) monthAt = 0;
      build();
    },
    /** Each look's triangles at a level of detail (built fresh). */
    triangles(l = lod) {
      const out = {};
      for (const s of shown) {
        for (const key of [s.key, ...s.more.map((m) => m.split(' x')[0])]) {
          if (out[key] !== undefined) continue;
          let n = 0;
          modelFor(key).build(key, l).traverse((o) => { if (o.isMesh) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
          out[key] = n;
        }
      }
      return out;
    },
  };
  return { gardens: scene };
}

export { MW, MH, TILE, mid };
