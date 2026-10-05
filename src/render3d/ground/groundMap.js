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
 *      the open sea's blue), bit 2 a building stands on the tile, bit 3 the
 *      rubble is a burned building's (ash and charred timber, the ground
 *      round it scorched), bit 4 it is still burning (embers glow).
 *
 * A second texture of the same size, the SITE map (`detail`), says what
 * people made of a tile that is not a road: a building's yard of trodden
 * earth, a farm's field (its crop and how far it has grown, resting in
 * winter, left idle), a pig pen's mud, the footing of a wall or an
 * aqueduct. One RGBA byte quad a tile (siteWord):
 *
 *   R  the site (SITE)
 *   G  how far its crop has grown, 0..255 (a field's)
 *   B  bits 0-3 which of its four sides (N E S W) carry on into the same
 *      site (the same building's, the same kind): an edge is drawn only
 *      where the site ends, so a field is one clean plot with a margin
 *      round it, not a quilt of tiles; bit 4 resting for the winter; bit 5
 *      idle (no one works it: weeds come up); bits 6-7 the site's size - 1
 *   A  bits 0-2 and 3-5 the tile's place (u, v) in its building's
 *      footprint, bits 6-7 the building's turn: the shader finds where the
 *      sprite's trees and vines stand, and which way a field's rows run
 *
 * The sim keeps none of this: it is read from the buildings (groundSites.js)
 * and drawn under the sprites, which in the 3D ground's view leave a farm's
 * field to it (render/buildingArt.js farmArt, `bare`).
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
/** A burned building's rubble (A bit 3), and still burning (bit 4): burnAt's bits, shifted. */
export const A_BURNT = 8;
export const A_BURNING = 16;
/** burnAt(i)'s answer: the rubble is a fire's, and the fire is still burning. */
export const BURN = Object.freeze({ NONE: 0, BURNT: 1, BURNING: 2 });

/**
 * What people made of a tile (the site map's R). A field's kind is its crop:
 * the shader draws grain, vegetables and flax itself (the farm's sprite then
 * draws only its house), and under the sprite's orchard trees and vines the
 * ground they grow in.
 */
export const SITE = Object.freeze({
  NONE: 0,
  YARD: 1, // a building's ground: trodden earth (a farm's farmhouse yard too)
  FOOTING: 2, // under a wall or an aqueduct: earth and stone chips, the grass worn
  SOIL: 3, // ploughed earth, nothing sown that shows (a native village's plot)
  GRAIN: 4, // wheat
  VEG: 5, // vegetables in rows
  FLAX: 6, // flax, blue in flower
  ORCHARD: 7, // fruit trees in grass, the earth worked round each
  OLIVE: 8, // olives: the same, drier, paler
  VINES: 9, // vine rows, worked earth under each, grass between
  PEN: 10, // a pig pen: trampled mud, straw, wallows
  PADDOCK: 11, // horses' paddock: grazed short and trodden
});
/** Site map B: resting for the winter, idle (no workers). */
export const S_RESTING = 16;
export const S_IDLE = 32;

/**
 * A site word (siteAt's answer, before the links GroundMap adds): `site`,
 * `growth` 0..1, `flags` (S_RESTING, S_IDLE), the footprint `size` (1..4
 * kept), the tile's place (`u`, `v`) in it, and the building's `turn`.
 */
export function siteWord(site, growth = 0, flags = 0, size = 1, u = 0, v = 0, turn = 0) {
  if (!site) return 0;
  const g = Math.max(0, Math.min(255, Math.round(growth * 255)));
  const b = (flags & (S_RESTING | S_IDLE)) | ((Math.max(1, Math.min(4, size)) - 1) << 6);
  const a = (Math.min(7, u) & 7) | ((Math.min(7, v) & 7) << 3) | ((turn & 3) << 6);
  return (site | (g << 8) | (b << 16) | (a << 24)) >>> 0;
}

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

/**
 * The kind of ground of a land or water tile (see the header): what nature
 * made of it. (What people made, a farm's field, a yard, is the site map's:
 * the natural kind stays under it and shows at its margins.)
 */
export function kindOf(terrain, x, y, shoreD) {
  if (terrain === Terrain.WATER) return KIND.BED;
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

/** No hooks: a map with nothing on it (the tests', and the stand-in the shader compiles on). */
const NO = () => 0;

/**
 * The type map and the site map of a map and its buildings, kept up to
 * date as the map changes. `hooks` say what stands on tile i (ground.js
 * asks the game, groundSites.js; the lab gives its own):
 *   farmAt(i)      a farm stands there (a road beside it stays a country road)
 *   buildingAt(i)  a building stands there
 *   siteAt(i)      its site word (siteWord), 0 for none
 *   ownerAt(i)     whose site it is (a building's id): sides link only to the same owner's
 *   burnAt(i)      BURN bits: the rubble is a fire's, and still burning
 * A farm's growth and a fire change without the map's revision: refresh()
 * repacks the tiles they lie on (`live`), cheaply, every frame.
 */
export class GroundMap {
  constructor(map) {
    this.map = map;
    this.w = map.w;
    this.h = map.h;
    const n = map.w * map.h;
    this.data = new Uint8Array(n * 4);
    this.detail = new Uint8Array(n * 4);
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

  /** The hooks with every one there (missing ones: nothing stands anywhere). */
  static hooks(h = {}) {
    return { farmAt: h.farmAt || NO, buildingAt: h.buildingAt || NO, siteAt: h.siteAt || NO, ownerAt: h.ownerAt || NO, burnAt: h.burnAt || NO };
  }

  /**
   * The site word of tile i with its links: the sides whose neighbour is
   * the same site of the same owner. Yards and footings link whoever's they
   * are: a town's trodden ground runs on from one building to the next, a
   * field ends at its own farm's edge.
   */
  siteOf(i, x, y, hk) {
    const word = hk.siteAt(i);
    if (!word) return 0;
    const site = word & 255;
    const owner = hk.ownerAt(i);
    const { w, h } = this;
    const shared = site === SITE.YARD || site === SITE.FOOTING;
    const same = (j) => (hk.siteAt(j) & 255) === site && (shared || hk.ownerAt(j) === owner);
    const links = (y > 0 && same(i - w) ? 1 : 0) | (x < w - 1 && same(i + 1) ? 2 : 0) | (y < h - 1 && same(i + w) ? 4 : 0) | (x > 0 && same(i - 1) ? 8 : 0);
    return (word | (links << 16)) >>> 0;
  }

  /** A's bits for a fire: burnt rubble (changes with the map's revision) and burning (without it). */
  burnBits(i, hk) {
    const b = hk.burnAt(i);
    return (b & BURN.BURNT ? A_BURNT : 0) | (b & BURN.BURNING ? A_BURNING : 0);
  }

  /** Pack tile (x, y): both maps. */
  pack(x, y, hk) {
    const map = this.map;
    const i = y * this.w + x;
    const d = this.shore[i];
    const o = i * 4;
    const kind = kindOf(map.terrain[i], x, y, d);
    const water = this.water[i];
    this.data[o] = this.kindHook ? this.kindHook(i, kind) : kind;
    this.data[o + 1] = roadByte(map, x, y, (j) => hk.buildingAt(j) && !hk.farmAt(j));
    this.data[o + 2] = shoreByte(d);
    this.data[o + 3] = (this.waterHook ? this.waterHook(i, water) : water) | (hk.buildingAt(i) ? A_BUILDING : 0) | this.burnBits(i, hk);
    this.putSite(o, this.siteOf(i, x, y, hk));
  }

  putSite(o, word) {
    this.detail[o] = word & 255;
    this.detail[o + 1] = (word >>> 8) & 255;
    this.detail[o + 2] = (word >>> 16) & 255;
    this.detail[o + 3] = (word >>> 24) & 255;
  }

  /**
   * Bring the maps up to date with the map's layers and what stands on it.
   * Returns true when anything changed. `hooks`: see the class's header.
   */
  update(hooks = {}) {
    const hk = GroundMap.hooks(hooks);
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
      wall: map.wall,
      aqueduct: map.aqueduct,
    };
    const first = !this.seen;
    let waterChanged = first;
    const changed = new Uint8Array(n);
    let any = first;
    // What stands on each tile, read once: a farm, a building, its site, whose it is, a fire's rubble.
    const farm = new Uint8Array(n);
    const bld = new Uint8Array(n);
    const owner = new Int32Array(n);
    const site = new Uint8Array(n);
    const burnt = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      farm[i] = hk.farmAt(i) ? 1 : 0;
      bld[i] = hk.buildingAt(i) ? 1 : 0;
      owner[i] = hk.ownerAt(i) | 0;
      site[i] = hk.siteAt(i) & 255;
      burnt[i] = hk.burnAt(i) & BURN.BURNT;
    }
    if (!first) {
      const s = this.seen;
      for (let i = 0; i < n; i++) {
        if (now.terrain[i] !== s.terrain[i] || now.road[i] !== s.road[i] || now.rubble[i] !== s.rubble[i] || now.fixed[i] !== s.fixed[i]
          || now.wall[i] !== s.wall[i] || now.aqueduct[i] !== s.aqueduct[i]
          || farm[i] !== s.farm[i] || bld[i] !== s.bld[i] || owner[i] !== s.owner[i] || site[i] !== s.site[i] || burnt[i] !== s.burnt[i]) {
          changed[i] = 1;
          any = true;
          if ((now.terrain[i] === Terrain.WATER) !== (s.terrain[i] === Terrain.WATER)) waterChanged = true;
        }
      }
    }
    if (any) {
      if (waterChanged) {
        this.shore = shoreField(map);
        this.water = waterKinds(map, this.shore);
      }
      const dirtyChunks = new Set();
      const repack = (x, y) => {
        this.pack(x, y, hk);
        dirtyChunks.add(Math.floor(y / CHUNK) * this.chunksX + Math.floor(x / CHUNK));
      };
      if (waterChanged) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) repack(x, y);
      } else {
        // A changed tile, and its four neighbours (their road links and site links point at it).
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
      this.dirty = [...dirtyChunks].sort((a, b) => a - b);
    }
    // Keep what was read, to compare with next time.
    this.seen = {
      terrain: now.terrain.slice(),
      road: now.road.slice(),
      rubble: now.rubble.slice(),
      fixed: now.fixed.slice(),
      wall: now.wall.slice(),
      aqueduct: now.aqueduct.slice(),
      farm,
      bld,
      owner,
      site,
      burnt,
    };
    return any;
  }

  /**
   * Repack what changes between the map's revisions on the tiles `live`
   * (a farm's growth, resting and idling; a fire burning or gone out):
   * their site word and burn bits. The links stay (what a site is and
   * whose never changes between revisions). Returns { types, sites }:
   * which of the two maps changed (each is uploaded again only then).
   */
  refresh(live, hooks = {}) {
    const hk = GroundMap.hooks(hooks);
    const n = this.w * this.h;
    let types = false;
    let sites = false;
    if (!this.seen) return { types, sites };
    for (const i of live) {
      if (!(i >= 0 && i < n)) continue;
      const o = i * 4;
      const a = (this.data[o + 3] & ~(A_BURNT | A_BURNING)) | this.burnBits(i, hk);
      if (a !== this.data[o + 3]) {
        this.data[o + 3] = a;
        types = true;
      }
      const word = hk.siteAt(i);
      const next = word ? (word | ((this.detail[o + 2] & 15) << 16)) >>> 0 : 0;
      if ((next & 255) !== this.detail[o] || ((next >>> 8) & 255) !== this.detail[o + 1] || ((next >>> 16) & 255) !== this.detail[o + 2] || (next >>> 24) !== this.detail[o + 3]) {
        this.putSite(o, next);
        sites = true;
      }
    }
    return { types, sites };
  }
}
