/**
 * models/fleet.js
 * ----------------------------------------------------------------------------
 * The fleet's three waterside buildings as the game draws them
 * (render3d/models.js MODELS takes these entries as they are): which look
 * a building shows, from the sim's own fields, read only.
 *
 *   navalia        the dockyard (models/navalia.js): 'open' staffed, 'shut'
 *                  not; the liburnian on its slip by the building's progress
 *                  (hullStep: none, the keel and posts, the shell rising,
 *                  planked to the sheer, finished), and its stock of timber,
 *                  iron and linen as the warehouse's loads, one a hundred
 *   naval_station  the station (models/statio.js): 'open' staffed (the
 *                  beacon lit at night), 'shut' not
 *   portus         the training harbour (models/portus.js): 'open' staffed,
 *                  'shut' not, and its crews at the rowing frame while a new
 *                  ship's crew trains there (portusDrill)
 *
 * A waterside building never turns (sim/construction.js turnRule); it faces
 * its water, `b.waterSide` (0 = -y, 1 = +x, 2 = +y, 3 = -x, sim/berths.js
 * dockBerth), or for a build ghost the side the terrain gives
 * (sim/entities.js waterRowsSide). Its models are built facing +z (side 2
 * at art turn 0) and turned to their side by the matrices of `more`: the
 * building's own kit is empty, and everything it shows (the building, the
 * hull, the stock, the rowers) is a kit drawn in its frame, so one kit
 * serves all four sides.
 * ----------------------------------------------------------------------------
 */

import { Group, Matrix4, Quaternion, Vector3 } from 'three';
import { buildNavalia, buildNavaliaHull, NAVALIA } from './navalia.js';
import { buildStatio, STATIO } from './statio.js';
import { buildPortus, buildPortusPart, PORTUS } from './portus.js';
import { waterRowsSide } from '../../sim/entities.js';

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3), as models.js reads it; the water's margins freeze. */
const frost = (place) => ((place && place.snow) || 0) >= 2;

/** The angle (about y) that turns a model built facing +z to face `side`. */
export const sideAngle = (side) => ((2 - (side & 3)) * Math.PI) / 2;

/**
 * Which side a fleet building faces: its own (set by the sim with its
 * berth), or for a ghost (no id, no waterSide) the side the terrain gives
 * there, or the sprite's default (buildingArt.js artState: 1).
 */
export function waterSideOf(b, ctx) {
  if (Number.isInteger(b.waterSide)) return b.waterSide & 3;
  const map = ctx && ctx.game && ctx.game.map;
  if (map && Number.isInteger(b.x)) {
    const s = waterRowsSide(map, b.x, b.y, b.size || 3);
    if (s >= 0) return s;
  }
  return 1;
}

/**
 * The step of the liburnian on a navalia's slip from the sim's progress
 * (0 to 100 over NAVALIA_BUILD_DAYS): 0 none, 1 keel and posts (under 25),
 * 2 the shell rising with its first frames (under 50), 3 planked to the
 * sheer with frames and benches (under 75), 4 finished. The 2D sprite's
 * two looks split at 50 too (frames, then planked).
 */
export function hullStep(progress) {
  if (!(progress > 0)) return 0;
  return progress < 25 ? 1 : progress < 50 ? 2 : progress < 75 ? 3 : 4;
}

/** Staffed or not. */
export const staffedState = (b) => (b.efficiency > 0 ? 'open' : 'shut');

const _m = new Matrix4();
const _l = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const ONE = new Vector3(1, 1, 1);
const UP = new Vector3(0, 1, 0);

/** The matrix that turns a model to face `side` (16 floats). */
const SIDE_MATS = [0, 1, 2, 3].map((s) => new Matrix4().makeRotationY(sideAngle(s)).toArray(new Float32Array(16)));

/** Matrices of places [x, y, z, yaw] (the model's metres, facing +z) turned to face `side`, packed. */
function placeMats(places, side) {
  const out = new Float32Array(16 * places.length);
  _m.makeRotationY(sideAngle(side));
  places.forEach(([x, y, z, yaw], i) => {
    _p.set(x, y, z);
    _q.setFromAxisAngle(UP, yaw || 0);
    _l.compose(_p, _q, ONE);
    _l.premultiply(_m).toArray(out, i * 16);
  });
  return out;
}

/** The stock places' matrices by side and good (navalia.js NAVALIA.stock), made once. */
const STOCK_MATS = [0, 1, 2, 3].map((s) => Object.fromEntries(Object.entries(NAVALIA.stock).map(([g, places]) => [g, placeMats(places, s)])));

/** How many of a good's places show: one a cart's load (100), as many as there are places. */
export function stockLoads(stock, good) {
  const n = Math.ceil(((stock && stock[good]) || 0) / 100);
  return Math.max(0, Math.min(NAVALIA.stock[good].length, n));
}

/** `more` lists made, by their signature (a few dozen in a city: kept, never rebuilt per frame). */
const MORE = new Map();
function cached(sig, make) {
  let v = MORE.get(sig);
  if (!v) {
    if (MORE.size > 512) MORE.clear();
    v = make();
    MORE.set(sig, v);
  }
  return v;
}

/** A point of a model facing +z ([x, y, z]) turned to face `side`, as [x, y, z]. */
export function turnPoint([x, y, z], side) {
  const a = sideAngle(side);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}

/**
 * Lamps for models.js modelLamps, turned to the building's side: each lamp
 * given facing both ways, so the one the view sees is kept (they hang in
 * the open, on a pillar's face or a post).
 */
function lampsAt(points, side) {
  const out = [];
  for (const p of points) {
    const [x, y, z] = turnPoint(p, side);
    out.push(Object.freeze([x, y + 0.11, z, 1]), Object.freeze([x, y + 0.11, z, -1]));
  }
  return Object.freeze(out);
}
const NAVALIA_LAMPS = [0, 1, 2, 3].map((s) => lampsAt(NAVALIA.lamps, s));
const STATIO_LAMPS = [0, 1, 2, 3].map((s) => lampsAt([STATIO.fire], s));
const PORTUS_LAMPS = [0, 1, 2, 3].map((s) => lampsAt(PORTUS.lamps, s));

export const FLEET_MODELS = Object.freeze({
  navalia: Object.freeze({
    warm: ['navalia', 'navalia:hull:4'],
    lamps: (b) => (b.efficiency > 0 ? NAVALIA_LAMPS[waterSideOf(b, null)] : []),
    variant(b, place, ctx) {
      const side = waterSideOf(b, ctx);
      const state = staffedState(b);
      const step = hullStep(b.progress);
      const ice = frost(place);
      const t = stockLoads(b.stock, 'timber');
      const i = stockLoads(b.stock, 'iron');
      const l = stockLoads(b.stock, 'linen');
      const more = cached(`navalia|${side}|${state}|${step}|${ice ? 1 : 0}|${t}|${i}|${l}`, () => {
        const list = [{ key: ice ? 'navalia:ice' : 'navalia', n: 1, mats: SIDE_MATS[side], state }];
        if (step) list.push({ key: `navalia:hull:${step}`, n: 1, mats: SIDE_MATS[side], state });
        const S = STOCK_MATS[side];
        if (t) list.push({ key: 'warehouse:load:timber', n: t, mats: S.timber.subarray(0, t * 16), state: 'always' });
        if (i) list.push({ key: 'warehouse:load:iron', n: i, mats: S.iron.subarray(0, i * 16), state: 'always' });
        if (l) list.push({ key: 'warehouse:load:linen', n: l, mats: S.linen.subarray(0, l * 16), state: 'always' });
        return list;
      });
      // (The building's own kit is empty: everything is in `more`, turned to its water.)
      return { key: 'navalia:none', state, ice: false, more };
    },
    build(key, lod) {
      const [, kind, arg] = key.split(':');
      if (kind === 'none') return new Group();
      if (kind === 'hull') return buildNavaliaHull(Number(arg) || 1, { lod }).group;
      return buildNavalia({ lod, ice: kind === 'ice' }).group;
    },
  }),
  naval_station: Object.freeze({
    warm: ['naval_station'],
    // The beacon's fire, lit while the station is staffed: high on its tower, seen from every side.
    lamps: (b) => (b.efficiency > 0 ? STATIO_LAMPS[waterSideOf(b, null)] : []),
    variant(b, place, ctx) {
      const side = waterSideOf(b, ctx);
      const state = staffedState(b);
      const ice = frost(place);
      const more = cached(`statio|${side}|${state}|${ice ? 1 : 0}`, () => [{ key: ice ? 'naval_station:ice' : 'naval_station', n: 1, mats: SIDE_MATS[side], state }]);
      return { key: 'naval_station:none', state, ice: false, more };
    },
    build(key, lod) {
      const kind = key.split(':')[1];
      if (kind === 'none') return new Group();
      return buildStatio({ lod, ice: kind === 'ice' }).group;
    },
  }),
  portus: Object.freeze({
    warm: ['portus', 'portus:drill', 'portus:corvus:up'],
    lamps: (b) => (b.efficiency > 0 ? PORTUS_LAMPS[waterSideOf(b, null)] : []),
    variant(b, place, ctx) {
      const side = waterSideOf(b, ctx);
      const state = staffedState(b);
      const ice = frost(place);
      const drill = portusDrill(b, ctx && ctx.game);
      const more = cached(`portus|${side}|${state}|${ice ? 1 : 0}|${drill ? 1 : 0}`, () => {
        const mats = SIDE_MATS[side];
        return [
          { key: ice ? 'portus:ice' : 'portus', n: 1, mats, state },
          // At drill the oars are at the frame and the corvus is down on the hulk; else racked and raised.
          drill ? { key: 'portus:drill', n: 1, mats, state: 'always' } : { key: 'portus:rack', n: 1, mats, state: 'always' },
          { key: drill ? 'portus:corvus:down' : 'portus:corvus:up', n: 1, mats, state: 'always' },
        ];
      });
      return { key: 'portus:none', state, ice: false, more };
    },
    build(key, lod) {
      const kind = key.split(':').slice(1).join(':');
      if (kind === 'none') return new Group();
      if (kind === '' || kind === 'ice') return buildPortus({ lod, ice: kind === 'ice' }).group;
      return buildPortusPart(kind, { lod }).group;
    },
  }),
});

/**
 * Is a new ship's crew at drill at this Portus? A liburnian moored at its
 * berth training (sim/training.js trainAt: state 'training', `drill` the
 * school's id), while the Portus is fully staffed and reached by road, so
 * the days count (as sim/training.js trainsNow, read without its berth
 * lookup, which caches on the building). A ghost has no id and no ships.
 */
export function portusDrill(b, game) {
  if (b.id === null || b.id === undefined || !game || !game.units) return false;
  if (!(b.efficiency >= 1) || b.accessRoad < 0) return false;
  for (const u of game.units.values()) if (u.drill === b.id && u.state === 'training') return true;
  return false;
}
