/**
 * labWoods.js
 * ----------------------------------------------------------------------------
 * The look lab's Woods scene (P): the 3D countryside's trees and rocks
 * (render3d/flora/) on the game's own ground, drawn by the very engine the
 * game draws them with (flora.js: instanced, its levels of detail, its
 * impostors), on a made-up map of 32 x 28 tiles:
 *
 *   rows 1 and 3   every species alone on its tile, both its shapes (the
 *                  specimens, labelled)
 *   west           a wood on dry and fresh ground, its edge against a meadow
 *   a river        north to south, its banks wooded (poplar, willow, plane)
 *   east           limestone outcrops, boulders and scree, and the dark lava
 *                  boulders of a volcanic province among them
 *   south          lone trees in the grass
 *
 * Its own controls: the month (each species' look: blossom, autumn, bare),
 * the level of detail (0, 1, 2 the impostors: L); the lab's moods, snow and
 * rain apply. The world is in metres (4 a tile), the map's middle at the
 * origin.
 * ----------------------------------------------------------------------------
 */

import { Group, Vector3 } from 'three';
import { GameMap, Terrain } from '../world/map.js';
import { Ground } from '../render3d/ground/ground.js';
import { Flora } from '../render3d/flora/flora.js';
import { SPECIES, SPECIES_IDS, climateOf, lookOf } from '../render3d/flora/species.js';

export const WOODS = Object.freeze({ w: 32, h: 28 });
/** Where the map's tile (0, 0) corner lies (metres): the map's middle at the origin. */
const OX = -WOODS.w * 2;
const OZ = -WOODS.h * 2;
const MONTHS = ['Ianuarius', 'Februarius', 'Martius', 'Aprilis', 'Maius', 'Iunius', 'Iulius', 'Augustus', 'September', 'October', 'November', 'December'];
/** The lab's seasons as a month. */
const SEASON_MONTH = { winter: 0, spring: 3, summer: 6, autumn: 9 };

export const WOODS_INFO = `
<button class="close" type="button" aria-label="Close">Close</button>
<h2>Woods and rocks</h2>
<p>The trees, shrubs and rocks of Colonia's countryside, as the game's WebGL renderer draws them, chosen from the vegetation of
central and southern Italy and the western provinces as the botanists and the ancient writers (Theophrastus, Pliny, Columella,
Virgil) describe it.</p>
<ul>
<li><b>Italian cypress</b>, the dark flame of the hills and tombs; <b>stone pine</b>, the umbrella of the Tyrrhenian coast;
<b>holm oak</b>, the evergreen oak of the dry woods; the deciduous <b>downy oak</b>, which holds its dead leaves through the winter;
<b>sweet chestnut</b> of the Apennine hills.</li>
<li>By water: the <b>oriental plane</b> with its flaking bark, the <b>white poplar</b> silver beneath, and the <b>white willow</b>
pollarded for withies to tie vines and weave baskets.</li>
<li>The maquis: <b>wild olive</b>, <b>bay laurel</b>, <b>myrtle</b> (white flowers in early summer); in blossom, the <b>wild
cherry</b> in April and the <b>almond</b> on bare wood in February and March; the <b>date palm</b> of the desert's oases.</li>
<li>Rocks: limestone breaking through in its beds, boulders split from them, scree; lichens and moss; dark lava boulders where the
province is volcanic (round Puteoli and Volsinii).</li>
</ul>
<p>Which trees grow where comes from the map: the banks of rivers and lakes take the poplars, willows and planes, dry ground the
pines, holm oaks and wild olives; woods grow in stands of one kind, the cypress here and there among them. Every tree sways in
the wind; the deciduous ones turn in autumn and stand bare in winter; snow lies on the branches.</p>
<h3>Controls</h3>
<ul>
<li>The month: each tree's look. Detail 0, 1, 2 (L): the levels the game draws as you zoom out (2: a picture of each tree on a card).</li>
<li>Spring, summer, autumn, winter; N: snow lying; T: rain. 1 to 4: day, golden hour, night, winter. M, G, Z: zooms; O: orbit.</li>
</ul>`;

/** The scene's map. */
function woodsMap() {
  const { w, h } = WOODS;
  const map = new GameMap(w, h);
  map.terrain.fill(Terrain.GRASS);
  const set = (x, y, t) => { if (map.inBounds(x, y)) map.terrain[map.idx(x, y)] = t; };
  // The specimens' rows on meadow.
  for (let y = 0; y <= 4; y++) for (let x = 0; x < w; x++) set(x, y, Terrain.MEADOW);
  SPECIES_IDS.forEach((sp, k) => { set(1 + 2 * k, 1, Terrain.TREES); set(1 + 2 * k, 3, Terrain.TREES); });
  // The wood, its edge against a meadow.
  for (let y = 7; y <= 17; y++) for (let x = 0; x <= 11; x++) set(x, y, Terrain.TREES);
  for (let y = 18; y <= 20; y++) for (let x = 0; x <= 12; x++) set(x, y, Terrain.MEADOW);
  // The river and its wooded banks.
  for (let y = 6; y < h; y++) for (const x of [16, 17]) set(x, y, Terrain.WATER);
  for (let y = 9; y <= 15; y++) for (const x of [13, 14, 15, 18, 19, 20]) set(x, y, Terrain.TREES);
  // Rocks east of the river.
  for (let y = 8; y <= 14; y++) for (let x = 23; x <= 30; x++) set(x, y, Terrain.ROCK);
  // Lone trees in the grass.
  for (const [x, y] of [[3, 23], [7, 25], [11, 22], [22, 20], [26, 24], [29, 18]]) set(x, y, Terrain.TREES);
  map.computeWaterDistance();
  map.revision++;
  return map;
}

/**
 * Make the scene on painted ground textures `tex`, with the lab's renderer
 * `gl`. Returns its pieces for lab.js.
 */
export function buildWoodsScene(gl, tex, { el, app, group: buttons }) {
  const map = woodsMap();
  const ground = new Ground(map, tex, { quality: 'high', scale: 4 });
  ground.group.position.set(OX, 0, OZ);
  ground.group.updateMatrixWorld(true);
  const group = new Group();
  group.name = 'woods-scene';
  // The flora's world is tiles: a holder scaled to metres, its origin at the map's corner.
  const holder = new Group();
  holder.position.set(OX, 0, OZ);
  holder.scale.setScalar(4);
  group.add(holder);
  const flora = new Flora(gl, { slot: holder });
  // The specimens: a species alone on its tile, its first shape in row 1, its second in row 3.
  flora.plantsAt = (i) => {
    const x = i % map.w;
    const y = (i / map.w) | 0;
    if ((y !== 1 && y !== 3) || x % 2 !== 1) return null;
    const sp = SPECIES_IDS[(x - 1) / 2];
    return sp ? [{ sp, v: y === 1 ? 0 : 1, x: 0.5, z: 0.5, yaw: 0.6 + x, s: 1 }] : null;
  };
  // A Tyrrhenian province with some volcanic rock (as Puteoli's): every rock kind shows.
  flora.setMap(map, { ...climateOf({ region: 'Campania', site: 'puteoli' }), volcanic: 0.35 });
  const state = { month: 6, lod: 1, turn: 0 };

  // Controls: the month, the level of detail.
  const monthBar = el('div', { class: 'group' });
  const pick = el('select', { 'aria-label': 'Month' });
  MONTHS.forEach((m, i) => pick.appendChild(el('option', { value: String(i) }, m)));
  pick.addEventListener('change', () => setMonth(Number(pick.value)));
  monthBar.appendChild(pick);
  const lodBtns = buttons([0, 1, 2].map((n) => [`Detail ${n}`, n ? '' : 'L', () => setLod(n)]));
  lodBtns[0].parentElement.before(monthBar);
  const bars = [monthBar, lodBtns[0].parentElement];

  // Labels: each specimen's name, and the scene's parts.
  const labels = el('div', { class: 'cardlabels' });
  app.appendChild(labels);
  const tags = [];
  const at = (x, y, hgt) => new Vector3(OX + (x + 0.5) * 4, hgt, OZ + (y + 0.5) * 4);
  SPECIES_IDS.forEach((sp, k) => {
    const s = SPECIES[sp];
    tags.push({ at: at(1 + 2 * k, 1, s.size.h * 0.8 + 1.2), el: el('div', { class: 'cardlabel' }, `<b>${s.name}</b><span>${s.latin}</span>`), sp });
  });
  for (const [name, note, x, y, hgt] of [
    ['A wood', 'dry and fresh ground: holm oak, pine, oaks, chestnut', 5, 9, 8],
    ['Its edge', 'against a meadow', 5, 17, 7],
    ['Riverbank', 'poplar, willow, plane by the water', 14, 10, 9],
    ['Rocks', 'limestone outcrops, boulders, scree; dark lava boulders', 26, 9, 4],
    ['Lone trees', 'in the grass', 11, 22, 6],
  ]) tags.push({ at: at(x, y, hgt), el: el('div', { class: 'cardlabel' }, `<b>${name}</b><span>${note}</span>`) });
  for (const t of tags) labels.appendChild(t.el);
  let on = false;

  function refresh() {
    for (const b of bars) b.style.display = on ? '' : 'none';
    labels.style.display = on ? '' : 'none';
    pick.value = String(state.month);
    lodBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.lod)));
    for (const t of tags) if (t.sp) t.el.querySelector('span').textContent = `${SPECIES[t.sp].latin}: ${lookOf(t.sp, state.month)}`;
  }
  function setMonth(m) {
    state.month = ((m % 12) + 12) % 12;
    refresh();
  }
  function setLod(n) {
    state.lod = n;
    refresh();
  }
  refresh();
  const lp = new Vector3();
  const api = {
    id: 'woods', title: 'Woods',
    group, ground, flora, map, state, info: WOODS_INFO,
    fade: [0, 0, 62, 70],
    /** What compiles after the first frame (the lab's warm-up `later`). */
    later: [group, ground.group],
    show(yes) {
      on = yes;
      group.visible = yes;
      ground.group.visible = yes;
      refresh();
    },
    get on() { return on; },
    season(name) {
      if (SEASON_MONTH[name] !== undefined) setMonth(SEASON_MONTH[name]);
    },
    setMonth,
    setLod,
    setTurn(t) {
      state.turn = t;
      // The impostors face the lab's turned camera (look.js gameCamera turns it by a quarter a turn).
      flora.setFacing((t * Math.PI) / 2);
    },
    /** A key of the scene's ('l' the level of detail; '[' and ']' the month); true if taken. */
    key(k) {
      if (!on) return false;
      if (k === 'l') setLod((state.lod + 1) % 3);
      else if (k === '[' || k === ']') setMonth(state.month + (k === ']' ? 1 : -1));
      else return false;
      return true;
    },
    /** Each frame, before drawing: the flora at its month and level, everything built at once. */
    life() {
      if (!on) return;
      flora.sync();
      flora.update({ chunks: null, lod: state.lod, month: state.month, turn: 0, hidden: null, budget: Infinity, shadows: true });
    },
    placeLabels(cam, w, h, compact) {
      labels.classList.toggle('compact', compact);
      for (const t of tags) {
        if (!on) { t.el.style.display = 'none'; continue; }
        lp.copy(t.at).project(cam);
        const vis = lp.z < 1 && Math.abs(lp.x) < 1.05 && Math.abs(lp.y) < 1.05;
        t.el.style.display = vis ? '' : 'none';
        if (vis) t.el.style.transform = `translate(${((lp.x + 1) / 2) * w}px, ${((1 - lp.y) / 2) * h}px) translate(-50%, -100%)`;
      }
    },
    /** Where a specimen stands (metres), to aim at it. */
    specimenAt(sp, row = 1) {
      const k = SPECIES_IDS.indexOf(sp);
      return at(1 + 2 * k, row, 0);
    },
    /** Triangles of a species' kit at a level and look (the lab's report). */
    triangles(sp, lod, look = 'leaf') {
      const b = flora.bases.find((x) => x.tree && x.name === sp && x.v === 0);
      if (!b) return 0;
      const k = flora.kitFor(b, look, lod, true);
      return k.kit.triangles;
    },
  };
  group.visible = false;
  ground.group.visible = false;
  return api;
}
