/**
 * labHarbour.js
 * ----------------------------------------------------------------------------
 * The look lab's Harbour scene (D in the lab): the fleet's three waterside
 * buildings (render3d/models/navalia.js, statio.js, portus.js) on the
 * game's own 3D ground and water, out over the water as the game places
 * them, in their states, labelled:
 *
 *   north shore (facing +z, the camera at turn 0)
 *     the Navalia: idle with an empty slip; the keel laid; the shell
 *     rising; planked to the sheer; the ship finished, its stock in
 *   south shore (facing -z: turn the view to see their fronts)
 *     the Statio, staffed and idle; the Portus idle, staffed, and with a
 *     new ship's crew at drill
 *
 * Each is drawn as the game draws it: models.js MODELS' variant from a
 * building record (its water side, staff, progress, stock, and for the
 * Portus a training ship), its kits built by the same `build` and placed by
 * the same matrices of `more`. A strait of open sea between the shores, a
 * paved street behind each row.
 *
 * The world is in metres (4 a tile), the map's middle at the origin.
 * ----------------------------------------------------------------------------
 */

import { Group, Matrix4, Vector3 } from 'three';
import { GameMap, Terrain, Road } from '../world/map.js';
import { Ground } from '../render3d/ground/ground.js';
import { SITE, siteWord, WATER_KIND } from '../render3d/ground/groundMap.js';
import { MODELS, partShows } from '../render3d/models.js';
import { kitOf } from '../render3d/kit.js';
import { triangles } from '../render3d/shapes.js';

export const HARBOUR_INFO = `
<button class="close" type="button" aria-label="Close">Close</button>
<h2>The fleet's harbour</h2>
<p>Rome kept provincial fleets of light warships, <i>liburnians</i> (two banks of oars, a bronze ram), in stations along the
coasts and rivers, after the great fleets at Misenum and Ravenna. Here the three buildings the game gives them, each 12 m, its
back row on the shore and its two front rows out over the water, as the game places them.</p>
<p><b>The Navalia</b> (naval dockyard), after the ship sheds of Piraeus's Zea harbour and of Oiniadai, and Rome's own navalia by
the Tiber: an open building slip of sleepers and greased ways running down into the sea, on ashlar over the land and pile bents over
the water, the windlass at its head; beside it a ship shed, its tiled roof on two rows of stone pillars standing on concrete piers in
the water, open at the sea's end, a spare mast and yard on trestles, oars racked, the gear store at its head; behind, the stock
yard of timber, iron and linen. The liburnian on the slip is built shell first, as Greek and Roman hulls were: the keel and posts on
their blocks, the strakes rising, the frames fitted inside, then the wales, the oar box, the bronze ram after the one found off
Athlit, the eye on the bow and the paint.</p>
<h3>Controls</h3>
<ul>
<li>Detail 0, 1, 2 (L). Spring to winter; N: snow lying; T: rain. 1 to 4: day, golden hour, night, winter.</li>
<li>M, G, Z: the game's zooms; O: orbit. Q / E: turn the view (the south shore's fronts face the other way). D: this scene.</li>
</ul>`;

/** The half size of the sun's shadow box over the scene (metres). */
const SHADOW_BOX = 46;

/**
 * The scene and its controls in the lab (lab.js), through one object as
 * the countryside's (labRural.js): { scene, look, groundTex, group, el, app }.
 */
export function harbourScenes(lab) {
  const { scene, look, groundTex, group, el, app } = lab;
  const s = buildHarbourScene(groundTex, 'high');
  s.group.visible = false;
  s.ground.group.visible = false;
  scene.add(s.group, s.ground.group);
  const lodBtns = group([0, 1, 2].map((n) => [`Detail ${n}`, '', () => setLod(n)]));
  const bar = lodBtns[0].parentElement;
  const labels = el('div', { class: 'cardlabels' });
  app.appendChild(labels);
  const tags = s.items.map((it) => {
    const e = el('div', { class: 'cardlabel' }, `<b>${it.name}</b><span>${it.note}</span>`);
    labels.appendChild(e);
    return { it, e };
  });
  let on = false;
  function setLod(n) {
    s.setLod(n);
    refresh();
  }
  function refresh() {
    bar.style.display = on ? '' : 'none';
    labels.style.display = on ? '' : 'none';
    lodBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === s.lod)));
  }
  const lp = new Vector3();
  return {
    scene: s,
    info: HARBOUR_INFO,
    later: [s.group, s.ground.group],
    grounds: [s.ground],
    /** Show the scene or not, its light fitted to it. */
    show(name) {
      on = name === 'harbour';
      s.group.visible = s.ground.group.visible = on;
      if (on) {
        const sc = look.sun.shadow.camera;
        sc.left = -SHADOW_BOX;
        sc.right = SHADOW_BOX;
        sc.top = SHADOW_BOX;
        sc.bottom = -SHADOW_BOX;
        sc.far = 160;
        sc.updateProjectionMatrix();
      }
      refresh();
    },
    fade: [0, 0, 48, 54],
    setSnow(n) { s.setSnow(n); },
    /** A key the scene takes ('l' the level of detail); true if taken. */
    key(k) {
      if (!on || k !== 'l') return false;
      setLod((s.lod + 1) % 3);
      return true;
    },
    placeLabels(cam, w, h, compact) {
      labels.classList.toggle('compact', compact);
      for (const { it, e } of tags) {
        if (!on) { e.style.display = 'none'; continue; }
        lp.copy(s.labelAt(it)).project(cam);
        const vis = lp.z < 1 && Math.abs(lp.x) < 1.05 && Math.abs(lp.y) < 1.05;
        e.style.display = vis ? '' : 'none';
        if (vis) e.style.transform = `translate(${((lp.x + 1) / 2) * w}px, ${((1 - lp.y) / 2) * h}px) translate(-50%, -100%)`;
      }
    },
    refresh,
  };
}

/** The map: a strait (rows 6 to 13) between two shores, a street behind each row of buildings. */
export const HARBOUR_SCENE = Object.freeze({
  w: 22,
  h: 20,
  water: [6, 13],
  buildings: Object.freeze([
    // North shore: footprint rows 5 (land), 6 and 7 (water), facing +y (side 2).
    { type: 'navalia', name: 'Navalia', note: 'idle, the slip empty', x: 1, y: 5, side: 2, b: { efficiency: 0, progress: 0, stock: {} } },
    { type: 'navalia', name: 'Navalia', note: 'the keel laid', x: 5, y: 5, side: 2, b: { efficiency: 1, progress: 12, stock: { timber: 300, iron: 100, linen: 100 } } },
    { type: 'navalia', name: 'Navalia', note: 'the shell rising', x: 9, y: 5, side: 2, b: { efficiency: 1, progress: 38, stock: { timber: 600, iron: 200, linen: 100 } } },
    { type: 'navalia', name: 'Navalia', note: 'planked to the sheer', x: 13, y: 5, side: 2, b: { efficiency: 1, progress: 62, stock: { timber: 900, iron: 200, linen: 200 } } },
    { type: 'navalia', name: 'Navalia', note: 'finished, stocked for more', x: 17, y: 5, side: 2, b: { efficiency: 1, progress: 92, stock: { timber: 1200, iron: 400, linen: 400 } } },
    // South shore: footprint rows 12 and 13 (water), 14 (land), facing -y (side 0).
    { type: 'naval_station', name: 'Statio', note: 'staffed, the beacon lit', x: 2, y: 12, side: 0, b: { efficiency: 1 } },
    { type: 'naval_station', name: 'Statio', note: 'idle', x: 6, y: 12, side: 0, b: { efficiency: 0 } },
  ]),
});

const ORIGIN_X = -HARBOUR_SCENE.w * 2;
const ORIGIN_Z = -HARBOUR_SCENE.h * 2;

/** The scene's map: grass, the strait, a street behind each row; and its ground. */
function harbourMap() {
  const { w, h, water } = HARBOUR_SCENE;
  const map = new GameMap(w, h);
  map.terrain.fill(Terrain.GRASS);
  for (let y = water[0]; y <= water[1]; y++) for (let x = 0; x < w; x++) map.terrain[map.idx(x, y)] = Terrain.WATER;
  for (let x = 0; x < w; x++) {
    map.road[map.idx(x, water[0] - 2)] = Road.ROAD;
    map.road[map.idx(x, water[1] + 2)] = Road.ROAD;
  }
  map.revision++;
  return map;
}

/** Build the scene on painted ground textures. */
export function buildHarbourScene(tex, quality = 'high') {
  const map = harbourMap();
  const n = map.w * map.h;
  const sites = new Uint32Array(n);
  const owners = new Int32Array(n);
  HARBOUR_SCENE.buildings.forEach((s, k) => {
    for (let ly = 0; ly < 3; ly++) for (let lx = 0; lx < 3; lx++) {
      const i = map.idx(s.x + lx, s.y + ly);
      if (map.terrain[i] === Terrain.WATER) continue;
      sites[i] = siteWord(SITE.YARD, 0, 0, 3, lx, ly, 0);
      owners[i] = k + 1;
    }
  });
  const ground = new Ground(map, tex, {
    quality,
    scale: 4,
    hooks: { farmAt: () => false, buildingAt: (i) => owners[i] > 0, siteAt: (i) => sites[i], ownerAt: (i) => owners[i] },
    // (The strait is narrow for the open sea's rule, but it is the sea.)
    waterHook: (i, wk) => (wk ? WATER_KIND.SEA : wk),
  });
  ground.group.position.set(ORIGIN_X, 0, ORIGIN_Z);
  ground.group.updateMatrixWorld(true);

  const group = new Group();
  group.name = 'harbour-scene';
  let lod = 0;
  let snow = 0;
  const kits = new Map();
  const kitGroup = (key) => {
    const id = `${key}|${lod}`;
    let k = kits.get(id);
    if (!k) {
      k = MODELS[key.split(':')[0]].build(key, lod);
      kits.set(id, k);
    }
    return k;
  };
  const game = { map, units: new Map() };
  const items = HARBOUR_SCENE.buildings.map((s, k) => {
    const holder = new Group();
    // The footprint's middle, in metres.
    holder.position.set(ORIGIN_X + (s.x + 1.5) * 4, 0, ORIGIN_Z + (s.y + 1.5) * 4);
    group.add(holder);
    return { ...s, holder, id: 100 + k, tris: 0 };
  });
  const _m = new Matrix4();
  function build() {
    for (const it of items) {
      it.holder.clear();
      it.tris = 0;
      const b = { id: it.id, type: it.type, x: it.x, y: it.y, size: 3, waterSide: it.side, waterRows: 2, ...it.b };
      const v = MODELS[it.type].variant(b, { snow, T: 0 }, { game, frame: 0 });
      const all = [{ key: v.key, n: 1, mats: new Matrix4().toArray(), state: v.state }, ...(v.more || [])];
      for (const e of all) {
        const kit = kitGroup(e.key);
        for (let j = 0; j < e.n; j++) {
          const c = kit.clone();
          c.matrixAutoUpdate = false;
          c.matrix.copy(_m.fromArray(e.mats, j * 16));
          c.traverse((o) => {
            if (!o.isMesh) return;
            o.visible = partShows(o.userData.when, e.state || 'always', false);
            if (o.visible) it.tris += triangles(o.geometry);
          });
          it.holder.add(c);
        }
      }
    }
  }
  build();
  return {
    group,
    ground,
    items,
    get lod() { return lod; },
    setLod(l) {
      if (l === lod) return;
      lod = l;
      build();
    },
    /** The snow level (0..3): a hard frost (2, 3) freezes the water's margins, and the foam round the piles goes. */
    setSnow(s) {
      const was = snow >= 2;
      snow = s;
      if (was !== snow >= 2) build();
    },
    /** A building's kits at a level of detail as the game builds them: triangles of each look. */
    triangles(type, key, l = lod) {
      return kitOf(MODELS[type].build(key, l)).triangles;
    },
    /** Where each building's label hangs (metres). */
    labelAt(it) {
      return new Vector3(it.holder.position.x, 6.5, it.holder.position.z);
    },
  };
}
