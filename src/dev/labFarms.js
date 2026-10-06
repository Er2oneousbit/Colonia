/**
 * labFarms.js
 * ----------------------------------------------------------------------------
 * The look lab's Farms scene: the eight kinds of farm side by side on the
 * game's own 3D ground (render3d/ground/: each farm's field under it, by its
 * crop and growth), each built from the very kits the game draws
 * (render3d/models/farm.js farmParts: the farmhouse, the kind's yard,
 * the trees, the vines, the animals), with buttons for the field's step,
 * the farms' condition (worked, resting for the winter, idle), a ranch's
 * herd and the level of detail; the lab's own season, snow, rain and moods.
 *
 * Laid out on a made-up map of 17 x 16 tiles: two rows of four farms with a
 * tile of pasture between them and round them; a gravel road along the
 * front. The world is in metres (4 a tile), the map's middle at the origin.
 * ----------------------------------------------------------------------------
 */

import { Group, Matrix4 } from 'three';
import { GameMap, Terrain, Road } from '../world/map.js';
import { Ground } from '../render3d/ground/ground.js';
import { SITE, S_RESTING, S_IDLE, siteWord } from '../render3d/ground/groundMap.js';
import { FIELD_OF, GROWTH_STEPS } from '../render3d/ground/groundSites.js';
import { farmLook, farmKey, farmParts, moveAnimals, buildFarmPart } from '../render3d/models/farm.js';
import { triangles } from '../render3d/shapes.js';

/** The farms, as the player knows them, where they stand (tile of the footprint's corner). */
export const FARM_SCENE = Object.freeze({
  w: 17,
  h: 16, // (a map is at least 16 tiles each way)
  farms: Object.freeze([
    { type: 'farm_wheat', name: 'Wheat farm', x: 1, y: 4 },
    { type: 'farm_veg', name: 'Vegetable farm', x: 5, y: 4 },
    { type: 'farm_fruit', name: 'Orchard', x: 9, y: 4 },
    { type: 'farm_olive', name: 'Olive grove', x: 13, y: 4 },
    { type: 'farm_vine', name: 'Vineyard', x: 1, y: 8 },
    { type: 'farm_flax', name: 'Flax field', x: 5, y: 8 },
    { type: 'farm_pig', name: 'Pig farm', x: 9, y: 8 },
    { type: 'horse_ranch', name: 'Horse ranch', x: 13, y: 8 },
  ]),
  /** The field's steps as the buttons name them, and a progress in each (sim's b.progress). */
  steps: Object.freeze([['Sown', 8], ['Sprouting', 28], ['Growing', 48], ['Ripening', 68], ['Ripe', 92]]),
  /** The lab's seasons (lab.js SEASONS) as a month of the game's (0 = Ianuarius). */
  months: Object.freeze({ winter: 0, spring: 3, summer: 6, autumn: 9 }),
});

/** The metres of a map tile's corner. */
const ORIGIN_X = -FARM_SCENE.w * 2;
const ORIGIN_Z = -FARM_SCENE.h * 2;

/** The scene's map: pasture with meadow under the farms, a road along the front. */
function farmMap() {
  const { w, h } = FARM_SCENE;
  const map = new GameMap(w, h);
  map.terrain.fill(Terrain.GRASS);
  for (const f of FARM_SCENE.farms) for (let y = f.y - 1; y <= f.y + 3; y++) for (let x = f.x - 1; x <= f.x + 3; x++) if (map.inBounds(x, y)) map.terrain[map.idx(x, y)] = Terrain.MEADOW;
  for (let x = 0; x < w; x++) map.road[map.idx(x, 12)] = Road.ROAD;
  map.revision++;
  return map;
}

/**
 * Build the scene on painted ground textures `tex` (groundTextures.js).
 * Returns { group, ground, farms, set(state), setLod(n), life(t), triangles(lod), state }.
 */
export function buildFarmsScene(tex, quality = 'high') {
  const map = farmMap();
  const n = map.w * map.h;
  const sites = new Uint32Array(n);
  const owners = new Int32Array(n);
  const farmTiles = [];
  const state = { step: 4, cond: 'n', season: 'summer', herd: 6, lod: 0 };
  /** Each farm's site words for the state (groundSites.js buildingSite, as the game lays them). */
  function laySites() {
    FARM_SCENE.farms.forEach((f, k) => {
      const progress = FARM_SCENE.steps[state.step][1];
      const growth = Math.floor((progress / 100) * GROWTH_STEPS) / (GROWTH_STEPS - 1);
      const flags = (state.cond === 'r' ? S_RESTING : 0) | (state.cond === 'i' ? S_IDLE : 0);
      for (let ly = 0; ly < 3; ly++) {
        for (let lx = 0; lx < 3; lx++) {
          const i = map.idx(f.x + lx, f.y + ly);
          let word;
          if (f.type === 'horse_ranch') word = siteWord(SITE.PADDOCK, 0, 0, 3, lx, ly, 0);
          else if (lx < 1) word = siteWord(SITE.YARD, 0, 0, 3, lx, ly, 0);
          else word = siteWord(FIELD_OF[f.type] || SITE.SOIL, growth, flags, 3, lx, ly, 0);
          sites[i] = word;
          owners[i] = k + 1;
        }
      }
    });
  }
  laySites();
  for (let i = 0; i < n; i++) if (owners[i]) farmTiles.push(i);
  const ground = new Ground(map, tex, {
    quality,
    scale: 4,
    hooks: {
      farmAt: (i) => owners[i] > 0,
      buildingAt: (i) => owners[i] > 0,
      siteAt: (i) => sites[i],
      ownerAt: (i) => owners[i],
      live: () => farmTiles,
    },
  });
  ground.group.position.set(ORIGIN_X, 0, ORIGIN_Z);
  ground.group.updateMatrixWorld(true);

  const group = new Group();
  group.name = 'farms-scene';
  const farms = FARM_SCENE.farms.map((f) => {
    const holder = new Group();
    holder.position.set(ORIGIN_X + (f.x + 1.5) * 4, 0, ORIGIN_Z + (f.y + 1.5) * 4);
    group.add(holder);
    return { ...f, holder, kits: [], animals: null, look: null, tris: 0 };
  });
  /** Built kits, shared by the farms that show them (as the game's are): key|lod -> Group. */
  const built = new Map();
  const kitOf = (key) => {
    const id = `${key}|${state.lod}`;
    let g = built.get(id);
    if (!g) {
      g = buildFarmPart(key, state.lod);
      built.set(id, g);
    }
    return g;
  };
  /** A copy of a kit's meshes at a matrix (the meshes share the kit's geometry). */
  const place = (holder, key, m) => {
    const src = kitOf(key);
    const c = src.clone();
    c.matrixAutoUpdate = false;
    c.matrix.copy(m);
    holder.add(c);
    return c;
  };
  const _m = new Matrix4();

  /** Build every farm again for the state (and free the kits no farm shows now). */
  function rebuild() {
    laySites();
    ground.update(true);
    const month = FARM_SCENE.months[state.season];
    for (const f of farms) {
      for (const c of [...f.holder.children]) f.holder.remove(c);
      const b = { id: null, type: f.type, progress: FARM_SCENE.steps[state.step][1], efficiency: state.cond === 'i' ? 0 : 1, herd: state.herd };
      f.look = farmLook(b, { resting: state.cond === 'r', month });
      const parts = farmParts(f.look, 1 + FARM_SCENE.farms.indexOf(FARM_SCENE.farms.find((x) => x.type === f.type)));
      f.tris = 0;
      const main = place(f.holder, farmKey(f.look), _m.identity());
      f.tris += groupTriangles(main);
      f.static = [];
      for (const it of parts.more) {
        if (parts.animals && parts.animals.slots.includes(it)) continue;
        for (let j = 0; j < it.n; j++) {
          _m.fromArray(it.mats, j * 16);
          f.tris += groupTriangles(place(f.holder, it.key, _m));
        }
      }
      // The animals: one copy of each animal in each pose, shown by where it is in its day.
      f.animals = parts.animals;
      f.herd = [];
      if (f.animals) {
        const a = f.animals;
        for (let i = 0; i < a.n; i++) {
          const poses = a.which[i].map((e) => {
            const c = place(f.holder, e.key, _m.identity());
            c.visible = false;
            return c;
          });
          f.herd.push(poses);
          f.tris += groupTriangles(poses[0]);
        }
        moveFarm(f, 0);
      }
    }
    // Kits no farm shows any more (another step, season, level of detail): freed.
    const used = new Set();
    for (const f of farms) f.holder.traverse((o) => { if (o.isMesh) used.add(o.geometry); });
    for (const [id, g] of built) {
      let any = false;
      g.traverse((o) => { if (o.isMesh && used.has(o.geometry)) any = true; });
      if (!any) {
        g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
        built.delete(id);
      }
    }
  }

  /** Set each animal's copy to where it is at time t (farm.js moveAnimals, read back from its slots). */
  function moveFarm(f, t) {
    const a = f.animals;
    if (!a) return;
    moveAnimals(a, t);
    // (moveAnimals filled each slot in animal order: walk them again to find each animal's matrix.)
    const at = new Map(a.slots.map((e) => [e, 0]));
    for (let i = 0; i < a.n; i++) {
      const o = a.places[i];
      const e = a.which[i][o.pose];
      const j = at.get(e);
      at.set(e, j + 1);
      f.herd[i].forEach((c, p) => {
        c.visible = p === o.pose;
        if (p === o.pose) c.matrix.fromArray(e.mats, j * 16);
      });
    }
  }

  rebuild();
  return {
    group,
    ground,
    farms,
    state,
    /** Change the state ({ step, cond, season, herd }) and build again. */
    set(next) {
      let changed = false;
      for (const k of ['step', 'cond', 'season', 'herd']) {
        if (next[k] !== undefined && next[k] !== state[k]) {
          state[k] = next[k];
          changed = true;
        }
      }
      if (changed) rebuild();
    },
    setLod(l) {
      if (l === state.lod) return;
      state.lod = l;
      rebuild();
    },
    /** The animals at time t (seconds). */
    life(t) {
      for (const f of farms) moveFarm(f, t);
    },
    /** Each farm's triangles at a level of detail (built fresh: the lab's report). */
    triangles(lod = state.lod) {
      const was = state.lod;
      state.lod = lod;
      rebuild();
      const out = farms.map((f) => ({ type: f.type, triangles: f.tris }));
      state.lod = was;
      rebuild();
      return out;
    },
  };
}

function groupTriangles(g) {
  let t = 0;
  g.traverse((o) => { if (o.isMesh) t += triangles(o.geometry); });
  return t;
}
