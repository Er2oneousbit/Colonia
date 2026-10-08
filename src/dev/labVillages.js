/**
 * labVillages.js
 * ----------------------------------------------------------------------------
 * The look lab's Villages scene (Shift+N): the native villages as the game
 * draws them (render3d/models/villages.js: the huts, the meeting places, the
 * plots, their villagers and flocks, through the game's own entries and
 * kits), on the game's own 3D ground (yards under the huts, tilled soil
 * under the plots), labelled. Two rows: a Ligurian village (the missions')
 * and a generic one (the sandbox's) in each of the four states, left to
 * right: calm (calmed by a missionary, at work), trading (a mission post at
 * work: the goods laid out), angry (the men gathered with their spears, the
 * horn, the fire high), at war (attacking: the men away).
 *
 * V steps the month (summer, autumn, winter, spring: the plots' crops, the
 * oak), L the level of detail. window.__lab.villages: where(i) (a village's
 * meeting place, metres), items, setMonth(m), setLod(n), triangles(lod).
 * ----------------------------------------------------------------------------
 */

import { Group, Matrix4, Mesh } from 'three';
import { GameMap, Terrain } from '../world/map.js';
import { Ground } from '../render3d/ground/ground.js';
import { SITE, siteWord } from '../render3d/ground/groundMap.js';
import { BUILDINGS } from '../data/buildings.js';
import { VILLAGE_MODELS, buildPart, villageState } from '../render3d/models/villages.js';
import { PeopleBatch } from '../render3d/people/batch.js';

/** The map: a village a cell of 6 x 6 tiles, four across and two down, a margin round them. */
const CELL = 6;
const COLS = 4;
const ROWS = 2;
const MARGIN = 2;
const W = COLS * CELL + MARGIN * 2;
const H = ROWS * CELL + MARGIN * 2;
const TILE = 4;
/** The map centred on the lab's origin (metres). */
const OX = -(W * TILE) / 2;
const OZ = -(H * TILE) / 2;

/** A village's pieces in its cell (tiles): the meeting place (2 x 2), its huts, its plots. */
const LAYOUT = {
  meeting: [2, 2],
  huts: [[0, 1], [1, 4], [4, 0], [5, 2], [4, 4]],
  plots: [[0, 0], [2, 5]],
};

/** The villages: people and state, in their cells. */
const VILLAGES = [
  ['ligurian', 'calm'], ['ligurian', 'trade'], ['ligurian', 'angry'], ['ligurian', 'war'],
  ['native', 'calm'], ['native', 'trade'], ['native', 'angry'], ['native', 'war'],
];
const NAMES = { ligurian: 'Ligurian village', native: 'Village (sandbox)' };
const NOTES = { calm: 'Calmed: at work, at peace', trade: 'Trading: a mission post at work', angry: 'Angry: the men gathered', war: 'Attacking: the men away' };

/** The months V steps through (0 Ianuarius): early summer, autumn, winter, spring. */
const MONTHS = [5, 8, 0, 3];
const MONTH_NAMES = ['June', 'September', 'January', 'April'];

/** The camera scale that asks the people's level `lod` (modelPass.js peopleLodFor). */
const SCALE_OF = [5, 3, 1];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The native villages</h2>
<p>The <b>Ligurians</b> (the missions' villages above Mutina and Luna), hill farmers and herders of the northern Apennines as
Diodorus and Strabo describe them and as their hillforts (<i>castellari</i>) are dug: huts on footings of stone laid dry, their
walls of wattle and daub, thatched; round, oval, and higher up small rectangular huts of dry stone with their thatch held down
by ropes and stones. The meeting place a ring round a great hearth under an old oak, a statue-stele of Lunigiana's kind
(a round head, the brow and nose, arms over the body, a dagger), a lean-to at its back, a fold of dry stone for the goats and
sheep. Their plots terraced behind dry stone walls: spelt, barley, millet, beans.</p>
<p>The <b>sandbox's people</b>: an Iron Age village of Italy, its huts the Latial hut of the Alban urns (oval, posts, a ridged
roof whose timbers cross at its ends, a porch), a round house of the north washed pale, a hipped longhut; a ring of carved
posts round its hearth, a hall of poles, a hurdle fold.</p>
<p>Villagers at home: women grinding on saddle querns and spinning with drop spindles, carrying water, men mending hurdles and
watching the flock, children at play, the elders by the fire, a plot hoed. Roused, the men gather with their spears, the horn
sounds, the fire is built high; attacking, the men are away. Trading, the hides, fleeces, honey, cheese and timber are laid
out for the trader.</p>
<h3>Controls</h3>
<ul>
<li>Shift+N: this scene. V: the month (June, September, January, April). L: the level of detail. 1 to 4: day, golden hour,
night, winter. N: snow; T: rain. M, G, Z: the game's zooms; O: orbit; Q / E: turn the view.</li>
</ul>`;

/** Each village's pieces as the sim makes them (sim/natives.js foundVillages), and the game they live in. */
function villagesOf() {
  return VILLAGES.map(([people, state], k) => {
    const cx = MARGIN + (k % COLS) * CELL;
    const cy = MARGIN + Math.floor(k / COLS) * CELL;
    const mid = 1000000 + k * 100;
    const calm = state === 'calm' || state === 'trade';
    const anger = calm ? 30 : 100;
    const m = { id: mid, type: 'native_meeting', x: cx + LAYOUT.meeting[0], y: cy + LAYOUT.meeting[1], size: 2, village: mid, anger, attackDays: state === 'war' ? 2 : 0 };
    const pieces = [m];
    LAYOUT.huts.forEach(([x, y], i) => pieces.push({ id: mid + 1 + i, type: 'native_hut', x: cx + x, y: cy + y, size: 1, village: mid, anger }));
    LAYOUT.plots.forEach(([x, y], i) => pieces.push({ id: mid + 20 + i, type: 'native_crops', x: cx + x, y: cy + y, size: 1, village: mid }));
    const buildings = new Map(pieces.map((b) => [b.id, b]));
    // A mission post at work for the trading village (the sim's postWorking reads it).
    if (state === 'trade') buildings.set(5 + k, { id: 5 + k, type: 'mission_post', efficiency: 1, accessRoad: 0 });
    const game = { city: { natives: { people } }, buildings, time: { totalTicks: 1 } };
    for (const b of pieces) b.def = BUILDINGS[b.type];
    return { people, state, pieces, game, m, ctx: { game, people, month: MONTHS[0], clock: 0, frame: 1 } };
  });
}

/** The scene's map: grass, the villages' yards and plots in its site map. */
function villageMap(villages) {
  const map = new GameMap(W, H);
  map.terrain.fill(Terrain.GRASS);
  map.revision++;
  const sites = new Uint32Array(W * H);
  const owners = new Int32Array(W * H);
  for (const v of villages) {
    for (const b of v.pieces) {
      for (let ly = 0; ly < b.size; ly++) {
        for (let lx = 0; lx < b.size; lx++) {
          const i = map.idx(b.x + lx, b.y + ly);
          // (As groundSites.js lays them: a plot tilled soil, the rest a trodden yard.)
          sites[i] = b.type === 'native_crops' ? siteWord(SITE.SOIL, 0.6, 0, b.size, lx, ly, 0) : siteWord(SITE.YARD, 0, 0, b.size, lx, ly, 0);
          owners[i] = b.id;
        }
      }
    }
  }
  return { map, sites, owners };
}

export function buildVillagesScene(groundTex) {
  const villages = villagesOf();
  const { map, sites, owners } = villageMap(villages);
  const ground = new Ground(map, groundTex, {
    quality: 'high',
    scale: TILE,
    hooks: { farmAt: () => false, buildingAt: (i) => owners[i] > 0, siteAt: (i) => sites[i], ownerAt: (i) => owners[i] },
  });
  ground.group.position.set(OX, 0, OZ);
  ground.group.updateMatrixWorld(true);
  const group = new Group();
  group.name = 'villages-scene';
  group.add(ground.group);
  const built = new Group();
  group.add(built);
  const people = new PeopleBatch(group);
  let lod = 0;
  let monthAt = 0;
  let frame = 1;
  /** Kits by key at this level, built once (the game's builders). */
  const kits = new Map();
  const kitOf = (key) => {
    let k = kits.get(key);
    if (!k) {
      k = buildPart(key, lod);
      k.updateMatrixWorld(true);
      kits.set(key, k);
    }
    return k;
  };
  /** A copy of a kit's meshes (shared geometry) at matrix `mat`. */
  const place = (key, mat) => {
    const h = new Group();
    h.matrixAutoUpdate = false;
    h.matrix.copy(mat);
    kitOf(key).traverse((mesh) => {
      if (!mesh.isMesh) return;
      const c = new Mesh(mesh.geometry, mesh.material);
      c.castShadow = mesh.castShadow;
      c.receiveShadow = true;
      c.matrixAutoUpdate = false;
      c.matrix.copy(mesh.matrixWorld);
      h.add(c);
    });
    built.add(h);
    return h;
  };
  /** Each piece's place in the lab (its footprint's middle, metres). */
  const centre = (b) => [OX + (b.x + b.size / 2) * TILE, OZ + (b.y + b.size / 2) * TILE];
  /** The beasts' holders, refilled each frame from their kits' matrices (the game's moveFlock). */
  let beasts = [];
  const _b = new Matrix4();
  const _l = new Matrix4();
  function build() {
    built.clear();
    for (const g of kits.values()) g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    kits.clear();
    beasts = [];
    people.begin(lod);
    for (const v of villages) {
      v.ctx.month = MONTHS[monthAt];
      v.ctx.villageMemo = null;
      for (const b of v.pieces) {
        const [x, z] = centre(b);
        const m = new Matrix4().setPosition(x, 0, z);
        const res = VILLAGE_MODELS[b.type].variant(b, { snow: 0 }, v.ctx);
        for (const e of res.more || []) {
          if (e.key.startsWith('pecus:')) {
            // Room for every copy its matrices hold; life() shows the first e.n.
            const n = e.mats.length / 16;
            const hs = [];
            for (let j = 0; j < n; j++) hs.push(place(e.key, m));
            beasts.push({ e, m, hs });
            continue;
          }
          for (let j = 0; j < e.n; j++) place(e.key, _b.multiplyMatrices(m, _l.fromArray(e.mats, j * 16)));
        }
        if (res.actors) people.add(res.actors, m, b.id % 997);
      }
    }
    people.end();
    life(0);
  }
  function life(t) {
    frame++;
    for (const v of villages) {
      v.ctx.clock = t;
      v.ctx.frame = frame;
      // (The variant moves its flocks: the entries' matrices are refilled in place.)
      for (const b of v.pieces) if (b.type !== 'native_crops') VILLAGE_MODELS[b.type].variant(b, { snow: 0 }, v.ctx);
    }
    for (const { e, m, hs } of beasts) {
      hs.forEach((h, j) => {
        h.visible = j < e.n;
        if (j < e.n) h.matrix.multiplyMatrices(m, _l.fromArray(e.mats, j * 16));
      });
    }
  }
  let ready = false;
  const ensure = () => {
    if (!ready) {
      ready = true;
      build();
    }
  };
  const labels = villages.map((v) => {
    const [x, z] = centre(v.m);
    return { name: NAMES[v.people], note: NOTES[v.state], x: x - 3, z: z - 3, y: 7 };
  });
  // (The lab asks for `labels` at once: the scene is built the first time it is shown or warmed.)
  setTimeout(ensure, 0);
  return {
    id: 'villages',
    title: 'Villages',
    key: 'Shift+N',
    info: INFO,
    group,
    ground,
    labels,
    people,
    noAO: [people.group],
    fade: [0, 0, 70, 80],
    // The torch's light by the Ligurian calm village's fire.
    get lamp() { const [x, z] = centre(villages[0].m); return [x, 1.4, z + 1.2]; },
    shadowBox: Math.max(W, H) * TILE * 0.55,
    get lod() { return lod; },
    setLod(n) {
      if (n === lod) return;
      lod = n;
      people.begin(lod);
      if (ready) build();
    },
    life(t) {
      ensure();
      life(t);
    },
    onKey(k) {
      if (k !== 'v') return false;
      monthAt = (monthAt + 1) % MONTHS.length;
      ensure();
      build();
      return true;
    },
    setTurn() {},
    setWinter(on) {
      const want = on ? 2 : monthAt === 2 ? 0 : monthAt;
      if (want !== monthAt) {
        monthAt = want;
        if (ready) build();
      }
    },
    /** A village's meeting place (metres) and what it is. */
    where(i) {
      const v = villages[i];
      if (!v) return null;
      const [x, z] = centre(v.m);
      return { x, z, people: v.people, state: v.state, check: villageState(v.m, v.game) };
    },
    /** A piece of village i (its `n`th hut, or 'meeting', or plot n): metres. */
    piece(i, which = 'meeting', n = 0) {
      const v = villages[i];
      const list = which === 'meeting' ? [v.m] : v.pieces.filter((b) => b.type === (which === 'hut' ? 'native_hut' : 'native_crops'));
      const b = list[n];
      if (!b) return null;
      const [x, z] = centre(b);
      return { x, z, type: b.type };
    },
    items: villages.map((v) => ({ people: v.people, state: v.state })),
    get month() { return MONTH_NAMES[monthAt]; },
    setMonth(i) {
      monthAt = ((i % MONTHS.length) + MONTHS.length) % MONTHS.length;
      ensure();
      build();
    },
    /** Each piece type's triangles at a level of detail as one village of each people draws it. */
    triangles(l = lod) {
      const out = {};
      for (const v of villages.filter((x) => x.state === 'calm')) {
        for (const b of v.pieces) {
          const res = VILLAGE_MODELS[b.type].variant(b, { snow: 0 }, { game: v.game, people: v.people, month: MONTHS[monthAt] });
          let n = 0;
          for (const e of res.more || []) {
            buildPart(e.key, l).traverse((o) => { if (o.isMesh) n += e.n * (o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3); });
          }
          const k = `${v.people} ${b.type}`;
          out[k] = Math.max(out[k] || 0, Math.round(n));
        }
      }
      return out;
    },
    scaleOf: SCALE_OF,
  };
}
