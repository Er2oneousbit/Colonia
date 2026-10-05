/**
 * labGround.js
 * ----------------------------------------------------------------------------
 * The look lab's Ground scene: a 24 x 24 tile patch of a made-up map that
 * holds every kind of the 3D ground side by side (render3d/ground/), drawn
 * by the very material the game's WebGL back end uses, under the lab's
 * light (render3d/look.js):
 *
 *   rows 0-5      the open sea, deepening to the map's edge
 *   rows 6-7      its beach
 *   row 9         a paved road, basalt as a town's streets are (the game
 *                 paves a road with a building beside it; this one is
 *                 the Imperial road's fixed kind), across to the river
 *   x 14          a gravelled road south from it, a branch west at row 17
 *   west of it    bands of forest floor, pasture, meadow, and the well on
 *                 grass at the middle (tile 12, 12); south of the branch
 *                 rocks, dry scrub, a wheat field nearly ripe, dune sand
 *   east of it    a forum's flagstones, rubble of a fallen house, meadow
 *   x 18-20       a river from the sea to the map's far edge, a bend in it
 *   beyond        a limestone outcrop, the river's meadows, sand
 *
 * The world is in metres (a tile is 4 m) with tile (12, 12)'s middle at the
 * origin, where the well stands.
 * ----------------------------------------------------------------------------
 */

import { GameMap, Terrain, Road } from '../world/map.js';
import { Ground, groundSnow } from '../render3d/ground/ground.js';
import { KIND, WATER_KIND, SITE, siteWord } from '../render3d/ground/groundMap.js';

export const GROUND_N = 24;
/** Where the map's tile (0, 0) corner lies (metres): tile (12, 12)'s middle at the origin. */
export const GROUND_ORIGIN = -12.5 * 4;

/** The river's west bank at row y. */
const riverX = (y) => 18 + Math.round(Math.sin(y * 0.45) * 1.2);

/** The patch as a game map, and which tiles the lab says are scrub, farm soil, open sea. */
export function labGroundMap() {
  const N = GROUND_N;
  const map = new GameMap(N, N);
  const scrub = new Uint8Array(N * N);
  const farm = new Uint8Array(N * N);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < N && y < N) map.terrain[map.idx(x, y)] = t; };
  map.terrain.fill(Terrain.GRASS);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = map.idx(x, y);
      if (y <= 5) { set(x, y, Terrain.WATER); continue; }
      const rx = riverX(y);
      if (x >= rx && x < rx + 2) { set(x, y, Terrain.WATER); continue; }
      if (y <= 7) { set(x, y, Terrain.SAND); continue; }
      if (x >= rx + 2) {
        // Beyond the river.
        if (y >= 9 && y <= 12 && x >= rx + 3) set(x, y, Terrain.ROCK);
        else if (y >= 19) set(x, y, Terrain.SAND);
        else set(x, y, Terrain.MEADOW);
        continue;
      }
      if (y < 10) continue; // grass by the beach and along the Imperial road
      const south = y >= 18;
      if (x <= 3) set(x, y, south ? Terrain.ROCK : Terrain.TREES);
      else if (x <= 7) { if (south) scrub[i] = 1; }
      else if (x <= 10) { if (south) farm[i] = 1; else set(x, y, Terrain.MEADOW); }
      else if (x <= 13) { if (south) set(x, y, Terrain.SAND); }
      else if (x >= 15 && y >= 20) set(x, y, Terrain.MEADOW);
    }
  }
  const road = (x, y, kind = Road.ROAD, fixed = 0) => {
    const i = map.idx(x, y);
    if (map.terrain[i] === Terrain.WATER) return;
    map.road[i] = kind;
    map.fixedRoad[i] = fixed;
    if (map.terrain[i] === Terrain.TREES || map.terrain[i] === Terrain.ROCK) map.terrain[i] = Terrain.GRASS;
  };
  for (let x = 0; x < riverX(9); x++) road(x, 9, Road.ROAD, 1);
  for (let y = 10; y < N; y++) road(14, y);
  for (let x = 4; x < 14; x++) road(x, 17);
  for (let y = 13; y <= 15; y++) for (let x = 15; x <= 17; x++) road(x, y, Road.PLAZA);
  for (const [x, y] of [[15, 18], [16, 18], [15, 19], [16, 19], [17, 19]]) map.rubble[map.idx(x, y)] = 1;
  map.revision++;
  return { map, scrub, farm };
}

/**
 * Make the Ground scene's ground on painted textures `tex`
 * (groundTextures.js groundTextures). Returns { ground, setSky }.
 */
export function buildGroundScene(tex, quality = 'high') {
  const { map, scrub, farm } = labGroundMap();
  // The farm: a wheat field three tiles wide, nearly ripe (its plot's place in a 3 x 3 footprint).
  const fx = (i) => map.xOf(i) - 8;
  const fy = (i) => (map.yOf(i) - 18) % 3;
  const ground = new Ground(map, tex, {
    quality,
    scale: 4,
    hooks: {
      farmAt: (i) => !!farm[i],
      buildingAt: (i) => !!farm[i],
      siteAt: (i) => (farm[i] ? siteWord(SITE.GRAIN, 0.75, 0, 3, fx(i), fy(i), 0) : 0),
      ownerAt: (i) => (farm[i] ? 1 + Math.floor((map.yOf(i) - 18) / 3) : 0),
    },
    kindHook: (i, k) => (scrub[i] && k === KIND.GRASS ? KIND.SCRUB : k),
    // The patch's sea is too small to be deep: it is the open sea all the same.
    waterHook: (i, w) => (w && map.yOf(i) <= 6 ? WATER_KIND.SEA : w),
  });
  ground.group.position.set(GROUND_ORIGIN, 0, GROUND_ORIGIN);
  ground.group.updateMatrixWorld(true);
  return { ground, map, groundSnow };
}
