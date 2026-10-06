/**
 * labGranary.js
 * ----------------------------------------------------------------------------
 * The look lab's Granary scene: a row of granaries (render3d/models/
 * granary.js) on the game's 3D ground, from empty to full, as the game
 * draws them (the building's kit, and a kit of goods for each place its
 * portico fills: granaryStock, granaryParts), and one with no workers,
 * its doors shut. A paved street in front, yards under them.
 *
 * The world is in metres (4 a tile), the map's middle at the origin.
 * ----------------------------------------------------------------------------
 */

import { Group, Matrix4 } from 'three';
import { GameMap, Terrain, Road } from '../world/map.js';
import { Ground } from '../render3d/ground/ground.js';
import { SITE, siteWord } from '../render3d/ground/groundMap.js';
import { granaryStock, granaryParts, buildGranaryPart, buildGranary } from '../render3d/models/granary.js';
import { CONFIG } from '../config.js';
import { triangles } from '../render3d/shapes.js';

const CAP = CONFIG.GRANARY_CAPACITY;

/** The granaries: what each holds (the game's foods), and its label. */
export const GRANARY_SCENE = Object.freeze({
  w: 25,
  h: 16, // (a map is at least 16 tiles each way)
  granaries: Object.freeze([
    { name: 'Empty', note: 'nothing in store', stock: {}, x: 1 },
    { name: 'A quarter', note: '600 wheat', stock: { wheat: 600 }, x: 5 },
    { name: 'Half', note: 'wheat, vegetables, fruit', stock: { wheat: 600, vegetables: 300, fruit: 300 }, x: 9 },
    { name: 'Three quarters', note: 'wheat, fish, meat', stock: { wheat: 1000, fish: 400, meat: 400 }, x: 13 },
    { name: 'Full', note: 'every food', stock: { wheat: 1000, vegetables: 400, fruit: 400, meat: 300, fish: 300 }, x: 17 },
    { name: 'No workers', note: 'doors shut, half full', stock: { wheat: 800, vegetables: 400 }, x: 21, idle: true },
  ]),
});

const ORIGIN_X = -GRANARY_SCENE.w * 2;
const ORIGIN_Z = -GRANARY_SCENE.h * 2;

/** Build the scene on painted ground textures. Returns { group, ground, granaries, setLod, triangles, panes }. */
export function buildGranaryScene(tex, quality = 'high') {
  const { w, h } = GRANARY_SCENE;
  const map = new GameMap(w, h);
  map.terrain.fill(Terrain.GRASS);
  const n = w * h;
  const sites = new Uint32Array(n);
  const owners = new Int32Array(n);
  GRANARY_SCENE.granaries.forEach((g, k) => {
    for (let ly = 0; ly < 3; ly++) for (let lx = 0; lx < 3; lx++) {
      const i = map.idx(g.x + lx, 6 + ly);
      sites[i] = siteWord(SITE.YARD, 0, 0, 3, lx, ly, 0);
      owners[i] = k + 1;
    }
  });
  // The street in front: paved, as a road with buildings beside it is.
  for (let x = 0; x < w; x++) map.road[map.idx(x, 9)] = Road.ROAD;
  map.revision++;
  const ground = new Ground(map, tex, {
    quality,
    scale: 4,
    hooks: { farmAt: () => false, buildingAt: (i) => owners[i] > 0, siteAt: (i) => sites[i], ownerAt: (i) => owners[i] },
  });
  ground.group.position.set(ORIGIN_X, 0, ORIGIN_Z);
  ground.group.updateMatrixWorld(true);

  const group = new Group();
  group.name = 'granary-scene';
  let lod = 0;
  const built = new Map();
  const panes = new Set();
  const kit = (key) => {
    const id = `${key}|${lod}`;
    let g = built.get(id);
    if (!g) {
      g = buildGranaryPart(key, lod);
      built.set(id, g);
      g.traverse((o) => { if (o.isMesh && o.name === 'pane' && o.material.name === 'granary-lantern') panes.add(o.material); });
    }
    return g;
  };
  const granaries = GRANARY_SCENE.granaries.map((g) => {
    const holder = new Group();
    holder.position.set(ORIGIN_X + (g.x + 1.5) * 4, 0, ORIGIN_Z + 7.5 * 4);
    group.add(holder);
    const fill = granaryStock(g.stock, CAP);
    return { ...g, holder, fill, places: fill.reduce((a, f) => a + f.n, 0), tris: 0 };
  });
  const _m = new Matrix4();
  function build() {
    for (const g of granaries) {
      for (const c of [...g.holder.children]) g.holder.remove(c);
      g.tris = 0;
      const main = kit(`granary:${g.idle ? 'i' : 'n'}`).clone();
      g.holder.add(main);
      g.tris += count(main);
      for (const it of granaryParts(g.fill)) {
        for (let j = 0; j < it.n; j++) {
          const c = kit(it.key).clone();
          c.matrixAutoUpdate = false;
          c.matrix.copy(_m.fromArray(it.mats, j * 16));
          g.holder.add(c);
          g.tris += count(c);
        }
      }
    }
  }
  build();
  return {
    group,
    ground,
    granaries,
    /** The lanterns' glass (lab.js lights them at night). */
    panes,
    get lod() { return lod; },
    setLod(l) {
      if (l === lod) return;
      lod = l;
      build();
    },
    /** The granary alone (no goods) at each level of detail, and a full one's goods. */
    triangles(l = lod) {
      return { building: buildGranary({ lod: l }).triangles, full: granaries.find((g) => g.name === 'Full').tris };
    },
  };
}

function count(g) {
  let t = 0;
  g.traverse((o) => { if (o.isMesh) t += triangles(o.geometry); });
  return t;
}
