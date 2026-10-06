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
 *     shows(when, state, ice)  optional: which parts a state shows, for a
 *               model whose tags partShows does not know
 *     lights(S) optional: its lamps at night, [u, v, z px] in its
 *               footprint (render/lighting.js lightsFromTorches)
 *   }
 * and variant() may add `extras`: [{ key, state, at }], more kits drawn in
 * the building's frame (at: a Matrix4 in its metres, or null), each with
 * its own state: a warehouse's loads, a market's wares
 * (models/commerce.js).
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
import { iceMaterial, stagnantMaterial } from './materials.js';
import { ART_PX } from './projection.js';
import { COMMERCE_MODELS } from './models/commerce.js';

/** Metres in a game tile. */
export const TILE_M = 4;

/**
 * Does a part tagged `when` (models/fountain.js: always, full, flow, dry,
 * ice) show in `state` ('flowing', 'still', 'dry'; 'always' for a model
 * with one look), `ice` in a hard frost?
 */
export function partShows(when, state, ice) {
  switch (when) {
    case undefined: case 'always': return true;
    case 'full': return state === 'flowing' || state === 'still';
    case 'flow': return state === 'flowing';
    case 'dry': return state === 'dry';
    case 'ice': return ice && state === 'flowing';
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
    // One look; in a hard frost the water in the shaft, the trough and the bucket is ice.
    variant: (b, place) => ({ key: frost(place) ? 'well:ice' : 'well', state: 'always', ice: false }),
    // (A frost's ice is the water's program: the frozen looks need nothing more.)
    warm: ['well'],
    build(key, lod) {
      const w = buildWell({ lod });
      if (key.endsWith(':ice')) for (const m of w.water) m.material = iceMaterial();
      return w.group;
    },
  }),
  fountain: Object.freeze({
    // Its look from its neighbourhood (fountainTier.js, kept per building by the pass); in a hard
    // frost a running one grows icicles and a dry one's puddle freezes.
    variant: (b, place, ctx) => {
      const ice = frost(place);
      return { key: `fountain:${ctx.fountainTier(b)}${ice ? ':ice' : ''}`, state: fountainState(b), ice };
    },
    warm: ['fountain:1', 'fountain:2', 'fountain:3', 'fountain:4'],
    build(key, lod) {
      const [, tier, ice] = key.split(':');
      const f = buildFountain({ tier: Number(tier), lod });
      for (const m of f.meshes) if (m.name === 'puddle') m.material = ice ? iceMaterial() : stagnantMaterial();
      return f.group;
    },
  }),
  // The market, the forum and the warehouse (models/commerce.js says how).
  ...COMMERCE_MODELS,
});

/** Does a building type have a 3D model? */
export function hasModel(type) {
  return Object.prototype.hasOwnProperty.call(MODELS, type);
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
 * under the ground is not drawn, materials.js uLookClipY). A model is
 * built at its true size, S x 4 m across (the market's 8, the warehouse's
 * 12): a metre is a quarter of a tile whatever the footprint. (It was
 * S / 4, right only for the one-tile well and fountain: a 3 x 3 model
 * stood three times too big.)
 */
export function modelMatrix(vx, vy, S, T, rise = 0, out = new Matrix4()) {
  _p.set(vx + S / 2, -rise * ART_PX, vy + S / 2);
  _q.setFromAxisAngle(UP, (-(T & 3) * Math.PI) / 2);
  _s.setScalar(1 / TILE_M);
  return out.compose(_p, _q, _s);
}
