/**
 * labCommerce.js
 * ----------------------------------------------------------------------------
 * The look lab's Market, Forum and Warehouse scenes (render3d/models/
 * market.js, forum.js, warehouse.js): each model in a row of its states on
 * a patch of Pompeian street, labelled, with figures for scale.
 *
 *   Market     empty and shut; a third full; two thirds; full of everything;
 *              food only; goods only
 *   Forum      working (doors open, clerk and coin at the table) and idle
 *   Warehouse  a row from empty to full (a quarter at a time) and a row by
 *              kinds of goods: drink and tableware, building materials,
 *              food, cloth and arms
 *
 * What a market shows for sale and what a warehouse holds are laid out by
 * the game's own rules (marketWares, warehouseLoads), from made-up stock,
 * at the view's turn, so the lab shows what the game would. The goods'
 * kits are built once a look and level of detail and shared by every copy.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, Matrix4, PlaneGeometry } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { buildMarket, marketWares, setMarketState, MARKET_GOODS, buildTholosFish } from '../render3d/models/market.js';
import { buildForum, setForumState } from '../render3d/models/forum.js';
import { buildWarehouse, warehouseLoads, setWarehouseState } from '../render3d/models/warehouse.js';
import { buildLoad, buildDisplay, displayShows, WARE_GOODS } from '../render3d/models/wares.js';
import { buildFigure } from '../render3d/models/figure.js';
import { CONFIG } from '../config.js';

/** A stock record: every good at `f` of its cap (`caps(good)`), or as `amounts` say. */
function stockOf(goods, f, cap) {
  const s = {};
  for (const g of goods) s[g] = Math.round(f * cap(g));
  return s;
}
/**
 * The lab's one lamp light in each scene (the street's torch, moved): the
 * full market's tholos lantern, the working forum's lantern by its door,
 * the full warehouse's at its gate (metres; the buildings as LAYOUT places
 * them, their lamps as the models hang them).
 */
const LAMPS = { market: [-10, 2.05, 5], forum: [-5 + 0.95, 2.62, -0.86], warehouse: [28 + 1.45, 1.55, -7.5 + 5.84] };

const marketCap = (g) => (MARKET_GOODS.indexOf(g) < 4 || g === 'fish' ? CONFIG.MARKET_FOOD_CAP : CONFIG.MARKET_GOODS_CAP);
const ALL_MARKET = [...MARKET_GOODS, 'fish'];
const FOODS = ['wheat', 'vegetables', 'fruit', 'meat', 'fish'];

/** The scenes' layouts: where each building stands, what it holds, its label. */
const LAYOUT = {
  market: {
    title: 'Market',
    key: 'K',
    spacing: 10,
    items: [
      { x: -10, z: -5, name: 'Empty, shut', stock: {}, state: 'shut' },
      { x: 0, z: -5, name: 'A third full', stock: stockOf(ALL_MARKET, 0.3, marketCap) },
      { x: 10, z: -5, name: 'Two thirds', stock: stockOf(ALL_MARKET, 0.6, marketCap) },
      { x: -10, z: 5, name: 'Full', stock: stockOf(ALL_MARKET, 1, marketCap) },
      { x: 0, z: 5, name: 'Food only', stock: stockOf(FOODS, 0.9, marketCap) },
      { x: 10, z: 5, name: 'Goods only', stock: stockOf(['oil', 'wine', 'pottery', 'furniture', 'clothing', 'marble'], 0.9, marketCap) },
    ],
  },
  forum: {
    title: 'Forum',
    key: 'U',
    spacing: 10,
    items: [
      { x: -5, z: 0, name: 'Working', state: 'open' },
      { x: 5, z: 0, name: 'Idle', state: 'shut' },
    ],
  },
  warehouse: {
    title: 'Warehouse',
    key: 'H',
    spacing: 14,
    items: [
      ...[0, 0.25, 0.5, 0.75, 1].map((f, i) => ({
        x: -28 + i * 14, z: -7.5, name: f ? `${Math.round(f * 100)}% full` : 'Empty, shut', state: f ? 'open' : 'shut',
        // Mixed goods, as a trading city's store holds them: the fill split among them.
        stock: mixed(['wine', 'oil', 'pottery', 'timber', 'marble', 'iron', 'clay', 'furniture'], f),
      })),
      { x: -21, z: 7.5, name: 'Drink and tableware', stock: { wine: 1200, oil: 800, pottery: 600, furniture: 600 } },
      { x: -7, z: 7.5, name: 'Building materials', stock: { timber: 800, marble: 800, iron: 800, clay: 800 } },
      { x: 7, z: 7.5, name: 'Food', stock: { wheat: 500, vegetables: 400, fruit: 400, meat: 400, fish: 400, olives: 500, grapes: 500 } },
      { x: 21, z: 7.5, name: 'Cloth and arms', stock: { flax: 700, linen: 700, clothing: 600, weapons: 600, arrows: 600 } },
    ],
  },
};

/** `f` of a warehouse's 3200 split evenly among `goods`, in whole loads where it can be. */
function mixed(goods, f) {
  const total = Math.round(f * CONFIG.WAREHOUSE_CAPACITY);
  const s = {};
  let left = total;
  goods.forEach((g, i) => {
    const share = i === goods.length - 1 ? left : Math.round(total / goods.length / 100) * 100;
    s[g] = Math.max(0, Math.min(left, share));
    left -= s[g];
  });
  return s;
}

/** The street and the ground round a scene: basalt streets between the buildings, beaten earth beyond. */
function ground(w, d, streets) {
  const g = new Group();
  const earth = new PlaneGeometry(w * 3, d * 3, 1, 1).rotateX(-Math.PI / 2);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  for (const [x0, z0, x1, z1] of streets) {
    const p = new PlaneGeometry(x1 - x0, z1 - z0, 1, 1).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
    const m = new Mesh(tintGeometry(boxUV(p)), material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 }));
    m.receiveShadow = true;
    g.add(m);
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

const CONTROLS = `<h3>Controls</h3>
<ul>
<li>K: the market; U: the forum; H: the warehouse; W: the well; F: the fountains. 1 to 4: day, golden hour, night, winter.</li>
<li>L: the level of detail (0 close, 1 middle, 2 far: what the game draws as it zooms out).</li>
<li>N: snow lying; T: rain. M, G, Z: the game's zooms; O: orbit. Q / E: turn the view (the goods move to the stalls and bays the camera sees best, as in the game).</li>
</ul>`;

/** Each scene's About panel. */
const INFO = {
  market: `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The market (macellum)</h2>
<p>A Roman town bought its meat, fish and produce at the <i>macellum</i>: a court ringed by stalls with, in its middle, a round
pavilion (<i>tholos</i>) over water. Pompeii's stands by its forum, a twelve-sided tholos in its court where fish scales were found in
the drain; Puteoli's has a ring of sixteen columns; at Leptis Magna two tholoi carry marble counters between their columns, and a
table of standard measures stands by them. Here, in 8 m: eight Tuscan columns on a stepped octagon under a tiled cone, a marble basin
of water, fish on four marble counters; round the court eight stalls, masonry counters painted as Pompeii's were (a dark socle, a red
dado) with marble tops, under striped awnings on a timber frame; a way in on every side; in a corner the <i>mensa ponderaria</i>, the
limestone table of measures.</p>
<p>What is for sale is what the market holds: grain in open sacks with the <i>modius</i>, baskets of vegetables and fruit, joints
hanging from the beam, jars of oil and wine, red-gloss tableware, furniture, cloth folded and hung up, marble; each in three steps of
fullness, laid out as the painting of the forum's market from the Praedia of Julia Felix shows. Unstaffed, the awnings are rolled up.</p>
${CONTROLS}`,
  forum: `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The forum (tax office)</h2>
<p>In Colonia the forum is where the households are registered and the taxes taken in. Here, in 8 m, a town's office as they stood
round a forum: a podium of travertine with two steps; the office (a <i>statio</i> of the collectors, a <i>tabularium</i> for the rolls)
stuccoed as Pompeii's public buildings were, its three doorways framed in travertine; a portico of four Tuscan columns under an
architrave with an inscription (its letters cut and painted red; no words); in the court the counting table (<i>mensa</i>) with piles of
bronze and silver coin, a purse, a tablet and a balance, as the relief of the rent payment from Neumagen shows; the iron-bound
strongbox (<i>arca</i>); a tribunal with its folding curule chair; an honorary statue on its base.</p>
<p>Working: the doors open, a clerk at the table, a citizen paying, the strongbox open on its coin. Idle: the doors shut, the table
bare, the strongbox locked.</p>
${CONTROLS}`,
  warehouse: `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The warehouse (horreum)</h2>
<p>Ostia's <i>horrea</i> kept the goods that came up the Tiber: brick-faced blocks with one gate onto the street, rooms (<i>cellae</i>)
round a court, high slit windows. The Horrea Epagathiana's gate has two engaged brick columns, a pediment and the owners' names on a
marble plaque. Here, in 12 m: brick walls on a travertine plinth, pilasters and a moulded cornice, that gateway with its studded doors
(open while the warehouse is staffed), arched doorways into dark rooms, tiled roofs sloping into the court.</p>
<p>The court is the store you see: eight bays of timber dunnage, four cart loads (100 units each) to a bay, 32 in all, the game's
3,200. Every load is the good it is: slender wine amphorae and round oil jars, sacks of grain, baskets of produce, logs, iron bars, a
marble block, clay, bundles of flax, bolts of linen, folded clothes, red-gloss ware in straw, furniture, shields and pila, arrows. The
bays the camera sees best fill first, so how full a warehouse is shows at a glance.</p>
${CONTROLS}`,
};

/** Build the three scenes. */
export function buildCommerceScenes() {
  const scenes = {};
  for (const [id, L] of Object.entries(LAYOUT)) scenes[id] = makeScene(id, L);
  return scenes;
}

function makeScene(id, L) {
  const group = new Group();
  group.name = `${id}-scene`;
  const xs = L.items.map((i) => i.x);
  const zs = L.items.map((i) => i.z);
  const half = L.spacing / 2;
  const minX = Math.min(...xs) - half;
  const maxX = Math.max(...xs) + half;
  const minZ = Math.min(...zs) - half;
  const maxZ = Math.max(...zs) + half;
  // Streets: a ring round the patch and one between the rows (the buildings' fronts face it).
  const size = id === 'warehouse' ? 12 : 8;
  const streets = [[minX - 2.5, maxZ, maxX + 2.5, maxZ + 2.5], [minX - 2.5, minZ - 2.5, maxX + 2.5, minZ], [minX - 2.5, minZ, minX, maxZ], [maxX, minZ, maxX + 2.5, maxZ]];
  const rowZ = [...new Set(zs)].sort((a, b) => a - b);
  for (let i = 0; i < rowZ.length - 1; i++) streets.push([minX, rowZ[i] + size / 2, maxX, rowZ[i + 1] - size / 2]);
  group.add(ground(maxX - minX, maxZ - minZ, streets));
  const holders = L.items.map((it) => {
    const h = new Group();
    h.position.set(it.x, 0, it.z);
    group.add(h);
    return { ...it, h };
  });
  // Figures for scale: by the first market's stalls, at the forum's table, at a warehouse's gate.
  const figs = new Group();
  group.add(figs);
  const fig = (opts, x, z, ry) => {
    const f = buildFigure(opts);
    f.position.set(x, id === 'forum' ? 0 : 0.05, z);
    f.rotation.y = ry;
    figs.add(f);
  };
  if (id === 'market') {
    fig({ cloth: 0x9a6a44, reach: 0.4 }, 1.4, 5 + 1.3, Math.PI * 0.9);
    fig({ cloth: 0x6f5a8a, cloth2: 0xc2a46a, long: true, skin: 0xb08664, hair: 0x221812 }, -9.0, 5 + 0.2, -Math.PI * 0.5);
  } else if (id === 'warehouse') {
    fig({ cloth: 0xb9a888 }, -13.6, -7.5 + 6.6, 0.3);
    fig({ cloth: 0x8a4434, reach: 0.6 }, -12.2, -7.5 + 6.8, -0.6);
  } else {
    fig({ cloth: 0x6f5a8a, cloth2: 0xc2a46a, long: true, skin: 0xb08664, hair: 0x221812 }, 6.5, 4.6, Math.PI);
  }

  let lod = 0;
  let turn = 0;
  const kits = new Map(); // `${key}|${lod}` -> { group, meshes } built once, shared by the copies
  const kitOf = (key) => {
    const k = `${key}|${lod}`;
    if (!kits.has(k)) {
      const [, kind, good] = key.split(':');
      kits.set(k, kind === 'ware' ? buildDisplay(good, lod) : kind === 'fish' ? buildTholosFish(lod) : buildLoad(good, lod));
    }
    return kits.get(k);
  };
  const built = [];
  function build() {
    for (const b of built) {
      b.h.remove(b.model.group);
      b.h.remove(b.extras);
      for (const m of b.model.meshes) m.geometry.dispose();
    }
    built.length = 0;
    for (const [, k] of kits) for (const m of k.meshes) m.geometry.dispose();
    kits.clear();
    for (const it of holders) {
      const model = id === 'market' ? buildMarket({ lod }) : id === 'forum' ? buildForum({ lod }) : buildWarehouse({ lod });
      const state = it.state || 'open';
      (id === 'market' ? setMarketState : id === 'forum' ? setForumState : setWarehouseState)(model, state);
      it.h.add(model.group);
      const extras = new Group();
      it.h.add(extras);
      built.push({ h: it.h, model, extras, it });
    }
    placeWares();
  }
  /** The goods at the view's turn (the most visible stalls and bays filled first). */
  function placeWares() {
    for (const b of built) {
      b.extras.clear();
      const stock = b.it.stock;
      if (!stock) continue;
      // (A fresh record each time: the game's lists are cached by the stock record and its turn.)
      const list = id === 'market' ? marketWares({ ...stock }, turn) : warehouseLoads({ ...stock }, turn);
      for (const e of list) {
        const kit = kitOf(e.key);
        const holder = new Group();
        holder.matrixAutoUpdate = false;
        holder.matrix.copy(e.at || new Matrix4());
        for (const m of kit.meshes) {
          if (!displayShows(m.userData.when, e.state)) continue;
          const c = new Mesh(m.geometry, m.material);
          c.castShadow = true;
          c.receiveShadow = true;
          holder.add(c);
        }
        b.extras.add(holder);
      }
    }
  }
  build();

  const labels = L.items.map((it) => ({ name: it.name, note: L.title, x: it.x, z: it.z, y: id === 'warehouse' ? 5.4 : 4.8, back: L.spacing * 0.42 }));
  const w = maxX - minX;
  const d = maxZ - minZ;
  return {
    id,
    title: L.title,
    key: L.key,
    info: INFO[id],
    group,
    labels,
    /** Where the world fades into the backdrop: past the scene's patch. */
    fade: [0, 0, Math.max(w, d) / 2 + 4, Math.max(w, d) / 2 + 9],
    /** Where the lab's one lamp light hangs at night: a lantern of one of the buildings (its light, its shadows). */
    lamp: LAMPS[id],
    get lod() { return lod; },
    setLod(n) {
      if (n === lod) return;
      lod = n;
      build();
    },
    setTurn(t) {
      if (t === turn) return;
      turn = t;
      placeWares();
    },
    /** Triangles of one model at a level of detail (built fresh) and of a full set of its goods. */
    triangles(l = lod) {
      const count = (g) => {
        let n = 0;
        g.traverse((o) => { if (o.isMesh) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; });
        return n;
      };
      const model = id === 'market' ? buildMarket({ lod: l }) : id === 'forum' ? buildForum({ lod: l }) : buildWarehouse({ lod: l });
      const out = { model: model.triangles };
      if (id === 'market') {
        out.wares = ALL_MARKET.map((g) => (g === 'fish' ? count(buildTholosFish(l).group) : count(buildDisplay(g, l).group))).reduce((a, b) => a + b, 0);
      } else if (id === 'warehouse') {
        out.perLoad = Object.fromEntries(WARE_GOODS.map((g) => [g, count(buildLoad(g, l).group)]));
        out.fullOfWine = model.triangles + 32 * out.perLoad.wine;
      }
      return out;
    },
  };
}
