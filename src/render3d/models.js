/**
 * models.js
 * ----------------------------------------------------------------------------
 * Buildings drawn as 3D models by the WebGL back end (webglBackend.js,
 * modelPass.js) in place of their sprites: the look lab's models
 * (render3d/models/), with the look's materials, lit by the 3D world's sun
 * and sky (sunRig.js). A building type without a model keeps its sprite, so
 * models come one at a time.
 *
 *   MODELS[type] = {
 *     variant(b, place, ctx) -> { key, state, ice }
 *         which look a building shows now: `key` names a model to build
 *         (one per key and level of detail, shared by every building that
 *         shows it), `state` which of its parts show (partShows), `ice`
 *         a hard frost; `place` is what the renderer passed (the art's
 *         turn, state and snow level), `ctx` the model pass (the fountain's
 *         tier, kept per building)
 *     build(key, lod) -> THREE.Group, in metres (models/well.js says how)
 *     warm      the looks to build and compile before the first draw
 *               (enough to make every program and ask for every texture
 *               its looks will want: one asked for later would put the
 *               models back to sprites until it is painted)
 *     lamps(b)  optional: its lamps at night (modelLamps)
 *     fits(b)   optional: false keeps this building's sprite (a fleet
 *               building of an older save, wholly on land: models/fleet.js)
 *   }
 * and variant() may add `more`: [{ key, n, mats, state }], more kits
 * drawn in the building's frame (n matrices in its metres), each with its
 * own state: a farm's trees, a granary's sacks, a warehouse's loads, a
 * market's wares (modelPass.js).
 *
 * A model is made in metres, facing +z, the tile's middle at its origin
 * and the street at y = 0; a game tile is 4 m (TILE_M). modelMatrix() stands
 * it on its footprint in the back end's world (the view's tiles: x = u,
 * z = v, y up, projection.js), turned with the building's turn and the
 * view's as render/turn.js turns art ((u, v) -> (S - v, u) a quarter turn:
 * minus a quarter about three's y), and sunk while it rises out of the
 * ground as a new building's sprite does.
 * ----------------------------------------------------------------------------
 */

import { Matrix4, Quaternion, Vector3 } from 'three';
import { buildWell } from './models/well.js';
import { buildFountain } from './models/fountain.js';
import { WATER_MODELS } from './models/waterModels.js';
import { iceMaterial, stagnantMaterial } from './materials.js';
import { ART_PX } from './projection.js';
import { COMMERCE_MODELS } from './models/commerce.js';
import { SERVICE_MODELS } from './models/services.js';
import { WALL_MODELS } from './models/wallModels.js';
import { FLEET_MODELS } from './models/fleet.js';
import { MILITARY_MODELS } from './models/militaryModels.js';
import { EDUCATION_MODELS } from './models/education.js';
import { farmModel, FARM_KIND, FARM_PARTS } from './models/farm.js';
import { granaryModel, buildGranaryPart } from './models/granary.js';
import { CONFIG } from '../config.js';

/** Metres in a game tile. */
export const TILE_M = 4;

/**
 * Does a part tagged `when` (models/fountain.js: always, full, flow, dry,
 * ice; the staffed buildings' open and shut; the prefecture's staffed, home
 * and out) show in `state` ('flowing', 'still', 'dry'; 'open', 'shut',
 * 'out'; 'always' for a model with one look), `ice` in a hard frost?
 */
export function partShows(when, state, ice) {
  switch (when) {
    case undefined: case 'always': return true;
    case 'full': return state === 'flowing' || state === 'still';
    case 'flow': return state === 'flowing';
    case 'dry': return state === 'dry';
    case 'ice': return ice && state === 'flowing';
    // The market's, the forum's and the warehouse's (models/commerce.js): staffed, or not.
    case 'open': return state === 'open';
    case 'shut': return state === 'shut';
    // The prefecture's (models/services.js): its crew out at a fire ('out') is staffed too, and only
    // then is its kit gone from the racks ('home': at home, staffed or not).
    case 'staffed': return state === 'open' || state === 'out';
    case 'home': return state === 'open' || state === 'shut';
    case 'out': return state === 'out';
    default: return false;
  }
}

/** The fountain's state from the sim (as its sprite shows it, buildingArt.js artState and its spray): running, full and still, or dry. */
export function fountainState(b) {
  if (!b.hasWater) return 'dry';
  return b.efficiency > 0 ? 'flowing' : 'still';
}

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3). */
const frost = (place) => (place.snow || 0) >= 2;

export const MODELS = Object.freeze({
  well: Object.freeze({
    warm: ['well'],
    // One look; in a hard frost the water in the shaft, the trough and the bucket is ice.
    variant: (b, place) => ({ key: frost(place) ? 'well:ice' : 'well', state: 'always', ice: false }),
    build(key, lod) {
      const w = buildWell({ lod });
      if (key.endsWith(':ice')) for (const m of w.water) m.material = iceMaterial();
      return w.group;
    },
  }),
  // The farms (models/farm.js: a farmhouse, the kind's yard, trees, vines and animals, each instanced on its own).
  ...Object.fromEntries(Object.keys(FARM_KIND).map((type) => [type, farmModel(type)])),
  // The granary (models/granary.js), its portico holding as much as the granary does.
  granary: granaryModel(CONFIG.GRANARY_CAPACITY),
  fountain: Object.freeze({
    // Its look from its neighbourhood (fountainTier.js, kept per building by the pass); in a hard
    // frost a running one grows icicles and a dry one's puddle freezes.
    warm: ['fountain:1', 'fountain:2', 'fountain:3', 'fountain:4'],
    variant: (b, place, ctx) => {
      const ice = frost(place);
      return { key: `fountain:${ctx.fountainTier(b)}${ice ? ':ice' : ''}`, state: fountainState(b), ice };
    },
    build(key, lod) {
      const [, tier, ice] = key.split(':');
      const f = buildFountain({ tier: Number(tier), lod });
      for (const m of f.meshes) if (m.name === 'puddle') m.material = ice ? iceMaterial() : stagnantMaterial();
      return f.group;
    },
  }),
  // The aqueducts' tiles and the reservoir (models/waterModels.js says how).
  ...WATER_MODELS,
  // The market, the forum and the warehouse (models/commerce.js says how).
  ...COMMERCE_MODELS,
  // The prefecture and the engineer's post (models/services.js says how).
  ...SERVICE_MODELS,
  // The town walls' tiles and gates, and the watchtower (models/wallModels.js says how).
  ...WALL_MODELS,
  // The fleet's waterside buildings: the Navalia, the Statio and the Portus (models/fleet.js says how).
  ...FLEET_MODELS,
  // The forts, the barracks and the military academy (models/militaryModels.js says how).
  ...MILITARY_MODELS,
  // The school, the library and the academy (models/education.js says how).
  ...EDUCATION_MODELS,
});

/**
 * Kits that are parts of a building's look, not buildings (models.js
 * MODELS' `more`: a farm's trees and animals, a granary's goods), by their
 * key's first word: modelPass.js builds them as it builds a look.
 */
export const MODEL_PARTS = Object.freeze({
  ...FARM_PARTS,
  gstock: Object.freeze({ build: buildGranaryPart }),
});

/** The builder of a kit's key: a building type's (MODELS) or a part's (MODEL_PARTS). */
export function modelFor(key) {
  const w = key.split(':')[0];
  return Object.prototype.hasOwnProperty.call(MODELS, w) ? MODELS[w] : MODEL_PARTS[w];
}

/** Does a building type have a 3D model? */
export function hasModel(type) {
  return Object.prototype.hasOwnProperty.call(MODELS, type);
}

/**
 * A model's own lamps at night, as points [u, v, z] of its footprint at
 * art turn T (tiles, and art px up), for the night's light map
 * (render/renderer.js collectLights): the granary's lanterns. Empty for
 * most. A lamp is [x, y, z, s, sx] in the model's metres, (sx, s) the way
 * it faces in x and z (sx 0 if not given, s +1 or -1 along z; a fleet
 * building's lamp turned to its water may face along x: sx +1 or -1, s 0);
 * one on a side facing away from the view is left out,
 * since the light map has no depth and its glow would show through the
 * building.
 */
export function modelLamps(b, T) {
  const def = MODELS[b.type];
  if (!def || !def.lamps) return [];
  const S = b.size;
  const t = T & 3;
  const out = [];
  for (const [x, y, z, s = 1, sx = 0] of def.lamps(b)) {
    // Its facing (sx, s) in (u, v) turned as the art turns: the view sees the sides facing +u or +v.
    // (A lamp facing along x, sx, is a fleet building's turned to its water: models/fleet.js.)
    const face = [[sx, s], [-s, sx], [-sx, -s], [s, -sx]][t];
    if (face[0] + face[1] <= 0) continue;
    // Metres from the middle to the art's (u, v) at turn 0, then turned as render/turn.js turns art.
    const u = S / 2 + x / TILE_M;
    const v = S / 2 + z / TILE_M;
    const uv = [[u, v], [S - v, u], [S - u, S - v], [v, S - u]][t];
    out.push([uv[0], uv[1], y / ART_PX / TILE_M]);
  }
  return out;
}

const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const UP = new Vector3(0, 1, 0);

/**
 * The matrix that stands a model (metres, its middle at the origin) on an
 * S x S footprint whose corner nearest the top of the screen is view tile
 * (vx, vy), turned T quarter turns, sunk `rise` px of art (a new building
 * rising out of the ground, as its sprite is drawn `rise` px lower: what is
 * under the ground is not drawn, materials.js uLookClipY).
 */
export function modelMatrix(vx, vy, S, T, rise = 0, out = new Matrix4()) {
  _p.set(vx + S / 2, -rise * ART_PX, vy + S / 2);
  _q.setFromAxisAngle(UP, (-(T & 3) * Math.PI) / 2);
  // (A model is in metres over its whole footprint: a 3 x 3 farm or warehouse spans 12 m, a market 8, a well 4.)
  _s.setScalar(1 / TILE_M);
  return out.compose(_p, _q, _s);
}
