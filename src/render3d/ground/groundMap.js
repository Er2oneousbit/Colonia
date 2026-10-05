/**
 * ground/groundMap.js
 * ----------------------------------------------------------------------------
 * The 3D ground's type map: what the ground shader (groundMaterial.js) needs
 * to know about each map tile, packed in one RGBA byte quad per tile and
 * uploaded as a texture the size of the map. Pure arithmetic on the map's
 * layers (no DOM, no three.js), so node:test checks it.
 *
 *   R  the kind of ground (KIND): the map's six terrains, plus kinds read
 *      from where a tile lies, which the sim does not tell apart but the eye
 *      does: grass far from any water dries to SCRUB in patches, sand by the
 *      water is BEACH, a farm's footprint is tilled SOIL, and a water tile's
 *      own ground is the BED its water lies on.
 *   G  the road layer: bits 0-3 the road's links (1 N, 2 E, 4 S, 8 W, the
 *      map's directions, as render/renderer.js roadMask), bits 4-5 its
 *      surface (ROAD_SURFACE: a gravelled country road, a town's street
 *      paved in basalt (roadByte), a plaza's flagstones), bit 6 rubble,
 *      bit 7 a bridge (no surface on the ground: the deck is a sprite).
 *   B  the shore: the signed distance (tiles) from the tile's middle to the
 *      water's edge, + on land, - on water, as 128 + 16 d. Read between
 *      tile middles (the shader interpolates), it gives a coast that runs
 *      smoothly round the tiles' corners instead of in steps, the depth of
 *      the water from its edge out, and the wet band on the beach.
 *   A  bits 0-1 the water's kind (WATER_KIND: a river or lake's green-blue,
 *      the open sea's blue), bit 2 a building stands on the tile.
 *
 * The map's tiles never change shape, only what is on them, so the type map
 * is rebuilt where the map changed (GroundMap.update): the layers it reads
 * are kept from the last update and compared, the tiles that changed and
 * their neighbours (a road's links, a scrub patch's distance from water)
 * are packed again, and the chunks they fall in (CHUNK x CHUNK tiles) are
 * reported dirty. The shore distance is worked out again for the whole map
 * only when water itself changed, which the sim never does in a game.
 * ----------------------------------------------------------------------------
 */

import { Terrain, Road } from '../../world/map.js';

/** Kinds of ground, the ground shader's layer of each (groundSurfaces.js GROUND_LAYERS has a texture per kind). */
export const KIND = Object.freeze({
  GRASS: 0,
  MEADOW: 1,
  SCRUB: 2,
  FOREST: 3,
  ROCK: 4,
  SAND: 5,
  BEACH: 6,
  SOIL: 7,
  BED: 8,
});

/** The road layer's surfaces (G bits 4-5). */
export const ROAD_SURFACE = Object.freeze({ NONE: 0, GRAVEL: 1, BASALT: 2, FLAGS: 3 });
export const G_RUBBLE = 64;
export const G_BRIDGE = 128;

/** The water's kinds (A bits 0-1). */
export const WATER_KIND = Object.freeze({ LAND: 0, FRESH: 1, SEA: 2 });
export const A_BUILDING = 4;

/** Tiles along a chunk's side: one mesh each (ground.js), and the unit the type map reports dirty. */
export const CHUNK = 32;
/** The shore distance is kept to this many tiles each way (the byte's range is +-7.9). */
export const SHORE_MAX = 7.9;
/** Grass at least this far (tiles) from water may dry to scrub; nearer, it stays green. */
export const SCRUB_DIST = 6;
/** Sand within this distance of water is beach. */
export const BEACH_DIST = 2.6;
/** Water this deep (tiles from its edge) somewhere makes its body open sea. */
export const SEA_DEPTH = 6;

/** Encode a signed shore distance (tiles) in a byte. */
export function shoreByte(d) {
  const c = Math.max(-SHORE_MAX, Math.min(SHORE_MAX, d));
  return Math.round(128 + c * 16);
}

/** Decode a shore byte to a distance (tiles). */
export function shoreDist(b) {
  return (b - 128) / 16;
}

/** A hash of a tile (0..1), for patches that are the art's choice, not the sim's (render only: never the sim's RNG). */
export function tileHash(x, y, seed = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise over tiles, about `cells` tiles a blob (0..1): where scrub dries out in patches. */
export function patchNoise(x, y, cells, seed) {
  const fx = x / cells;
  const fy = y / cells;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = tileHash(ix, iy, seed);
  const b = tileHash(ix + 1, iy, seed);
  const c = tileHash(ix, iy + 1, seed);
  const d = tileHash(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Offsets within SHORE_MAX + 1 tiles, nearest first: the shore search stops at the first tile of the other side. */
const OFFSETS = (() => {
  const r = Math.ceil(SHORE_MAX + 1);
  const out = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx || dy) out.push([dx, dy, Math.hypot(dx, dy)]);
  out.sort((a, b) => a[2] - b[2]);
  return out;
})();

/**
 * Signed distance (tiles) from each tile's middle to the water's edge:
 * the distance to the nearest tile middle of the other side, less half a
 * tile (so two neighbours across a straight shore read +0.5 and -0.5, and
 * the edge, half way, reads 0). Past the map's edge counts as land, as
 * map.js's terrainAt says rock. Capped at SHORE_MAX.
 */
export function shoreField(map) {
  const { w, h } = map;
  const out = new Float32Array(w * h);
  const isWater = (x, y) => x >= 0 && y >= 0 && x < w && y < h && map.terrain[y * w + x] === Terrain.WATER;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wet = isWater(x, y);
      let d = SHORE_MAX + 0.5;
      for (const [dx, dy, len] of OFFSETS) {
        if (len - 0.5 >= d) break;
        const tx = x + dx;
        const ty = y + dy;
        // Off the map is land for water (a sea runs on past the edge, but a
        // shore must not appear there) and the same as the tile for land.
        const inside = tx >= 0 && ty >= 0 && tx < w && ty < h;
        if (!inside) continue;
        if (isWater(tx, ty) !== wet) { d = len; break; }
      }
      out[y * w + x] = Math.min(SHORE_MAX, d - 0.5) * (wet ? -1 : 1);
    }
  }
  return out;
}

/**
 * Each body of water's kind: open sea where it is SEA_DEPTH deep somewhere
 * (a coast's sea), fresh water otherwise (a river, a lake, a pond). Returns
 * a byte per tile (WATER_KIND), LAND on land.
 */
export function waterKinds(map, shore) {
  const { w, h } = map;
  const out = new Uint8Array(w * h);
  const body = new Int32Array(w * h).fill(-1);
  const stack = [];
  let id = 0;
  for (let s = 0; s < w * h; s++) {
    if (map.terrain[s] !== Terrain.WATER || body[s] >= 0) continue;
    const tiles = [];
    let deep = 0;
    body[s] = id;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop();
      tiles.push(i);
      deep = Math.max(deep, -shore[i]);
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
        const j = ty * w + tx;
        if (body[j] < 0 && map.terrain[j] === Terrain.WATER) {
          body[j] = id;
          stack.push(j);
        }
      }
    }
    const kind = deep >= SEA_DEPTH ? WATER_KIND.SEA : WATER_KIND.FRESH;
    for (const i of tiles) out[i] = kind;
    id++;
  }
  return out;
}

/** The kind of ground of a land or water tile (see the header). */
export function kindOf(terrain, x, y, shoreD, farm) {
  if (terrain === Terrain.WATER) return KIND.BED;
  if (farm) return KIND.SOIL;
  switch (terrain) {
    case Terrain.MEADOW: return KIND.MEADOW;
    case Terrain.TREES: return KIND.FOREST;
    case Terrain.ROCK: return KIND.ROCK;
    case Terrain.SAND: return shoreD <= BEACH_DIST ? KIND.BEACH : KIND.SAND;
    default:
      // Dry patches far from water: blobs of about eight tiles, a third of the far grass.
      if (shoreD >= SCRUB_DIST && patchNoise(x, y, 7, 911) * 0.75 + patchNoise(x, y, 3, 912) * 0.25 > 0.6) return KIND.SCRUB;
      return KIND.GRASS;
  }
}

/**
 * The road byte (G) of a tile: links, surface, rubble, bridge. A street in
 * town is paved in basalt, as Roman towns paved theirs: a road with a
 * building on one of its four sides (not a farm: a lane between fields
 * stays a country road), or the Imperial road's fixed ends (map.fixedRoad);
 * any other road is gravel (a via glareata), so a town paves itself as it
 * grows along its roads. `town(i)`: does tile i hold a building that makes
 * a street of a road beside it.
 */
export function roadByte(map, x, y, town = () => false) {
  const i = y * map.w + x;
  const road = map.road[i];
  let g = map.rubble[i] ? G_RUBBLE : 0;
  if (road === Road.NONE) return g;
  if (road === Road.BRIDGE) return g | G_BRIDGE;
  const has = (tx, ty) => map.hasRoad(tx, ty);
  const links = (has(x, y - 1) ? 1 : 0) | (has(x + 1, y) ? 2 : 0) | (has(x, y + 1) ? 4 : 0) | (has(x - 1, y) ? 8 : 0);
  const w = map.w;
  const street = map.fixedRoad[i] || (y > 0 && town(i - w)) || (x < w - 1 && town(i + 1)) || (y < map.h - 1 && town(i + w)) || (x > 0 && town(i - 1));
  const surface = road === Road.PLAZA ? ROAD_SURFACE.FLAGS : street ? ROAD_SURFACE.BASALT : ROAD_SURFACE.GRAVEL;
  return g | links | (surface << 4);
}

/**
 * The type map of a map and its buildings, kept up to date as the map
 * changes. `farmAt(i)` says whether tile i lies under a farm (ground.js asks
 * the game's buildings; the lab gives its own).
 */
export class GroundMap {
  constructor(map) {
    this.map = map;
    this.w = map.w;
    this.h = map.h;
    const n = map.w * map.h;
    this.data = new Uint8Array(n * 4);
    this.shore = null;
    this.water = null;
    // The layers read last time (null: nothing packed yet).
    this.seen = null;
    this.chunksX = Math.ceil(map.w / CHUNK);
    this.chunksY = Math.ceil(map.h / CHUNK);
    /** Chunks repacked by the last update (indices cy * chunksX + cx), for tests and stats. */
    this.dirty = [];
    this.revision = -1;
    // The look lab lays out every kind side by side, some of which the game
    // only finds by distance (scrub, the open sea): it may say so itself.
    this.kindHook = null; // (i, kind) => kind
    this.waterHook = null; // (i, waterKind) => waterKind
  }

  /** Pack tile (x, y). */
  pack(x, y, farmAt, buildingAt) {
    const map = this.map;
    const i = y * this.w + x;
    const d = this.shore[i];
    const o = i * 4;
    const kind = kindOf(map.terrain[i], x, y, d, farmAt(i));
    const water = this.water[i];
    this.data[o] = this.kindHook ? this.kindHook(i, kind) : kind;
    this.data[o + 1] = roadByte(map, x, y, (j) => buildingAt(j) && !farmAt(j));
    this.data[o + 2] = shoreByte(d);
    this.data[o + 3] = (this.waterHook ? this.waterHook(i, water) : water) | (buildingAt(i) ? A_BUILDING : 0);
  }

  /**
   * Bring the type map up to date. Returns true when anything changed.
   * `farmAt(i)` and `buildingAt(i)` describe what stands on tile i.
   */
  update(farmAt = () => false, buildingAt = () => false) {
    const map = this.map;
    const { w, h } = this;
    const n = w * h;
    this.dirty = [];
    if (this.revision === map.revision && this.seen) return false;
    this.revision = map.revision;
    const now = {
      terrain: map.terrain,
      road: map.road,
      rubble: map.rubble,
      fixed: map.fixedRoad,
    };
    const first = !this.seen;
    let waterChanged = first;
    const changed = new Uint8Array(n);
    let any = first;
    if (!first) {
      const s = this.seen;
      for (let i = 0; i < n; i++) {
        const farm = farmAt(i) ? 1 : 0;
        const bld = buildingAt(i) ? 1 : 0;
        if (now.terrain[i] !== s.terrain[i] || now.road[i] !== s.road[i] || now.rubble[i] !== s.rubble[i] || now.fixed[i] !== s.fixed[i] || farm !== s.farm[i] || bld !== s.bld[i]) {
          changed[i] = 1;
          any = true;
          if ((now.terrain[i] === Terrain.WATER) !== (s.terrain[i] === Terrain.WATER)) waterChanged = true;
        }
      }
    }
    if (!any) return false;
    if (waterChanged) {
      this.shore = shoreField(map);
      this.water = waterKinds(map, this.shore);
    }
    const dirtyChunks = new Set();
    const repack = (x, y) => {
      this.pack(x, y, farmAt, buildingAt);
      dirtyChunks.add(Math.floor(y / CHUNK) * this.chunksX + Math.floor(x / CHUNK));
    };
    if (waterChanged) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) repack(x, y);
    } else {
      // A changed tile, and its four neighbours (their road links point at it).
      const done = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        if (!changed[i]) continue;
        const x = i % w;
        const y = (i / w) | 0;
        for (const [dx, dy] of [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const tx = x + dx;
          const ty = y + dy;
          if (tx < 0 || ty < 0 || tx >= w || ty >= h || done[ty * w + tx]) continue;
          done[ty * w + tx] = 1;
          repack(tx, ty);
        }
      }
    }
    // Keep what was read, to compare with next time.
    const farm = new Uint8Array(n);
    const bld = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      farm[i] = farmAt(i) ? 1 : 0;
      bld[i] = buildingAt(i) ? 1 : 0;
    }
    this.seen = {
      terrain: now.terrain.slice(),
      road: now.road.slice(),
      rubble: now.rubble.slice(),
      fixed: now.fixed.slice(),
      farm,
      bld,
    };
    this.dirty = [...dirtyChunks].sort((a, b) => a - b);
    return true;
  }
}
