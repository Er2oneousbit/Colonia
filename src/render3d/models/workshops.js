/**
 * models/workshops.js
 * ----------------------------------------------------------------------------
 * The eight workshops as the game draws them (industry.js registers them,
 * models.js MODELS takes the entries as they are): which look a building
 * shows, its state and its stores, from the sim's own fields, read only.
 *
 *   pottery_ws    the Potter (models/wsPotter.js)
 *   furniture_ws  the Carpenter (wsCarpenter.js)
 *   oil_ws        the Oil Press (wsOilPress.js)
 *   wine_ws       the Winery (wsWinery.js)
 *   weapons_ws    the Weaponsmith (wsWeaponsmith.js)
 *   fletcher_ws   the Fletcher (wsFletcher.js)
 *   linen_ws      the Linen Weaver (wsLinen.js)
 *   clothing_ws   the Clothing Maker (wsClothing.js)
 *
 * State, as the raw producers have it: 'open' while staffed (efficiency
 * above 0: the lantern lit, the shop front open, its people at work, the
 * fire burning), 'shut' when not (boards across the front, the fire out).
 *
 * Stores: a workshop holds its raw material up to WORKSHOP_RAW_CAP
 * (sim/storage.js rawRoomCap) and stops making when it has two lots of its
 * product (sim/production.js updateWorkshop: CART_CAPACITY * 2), so each is
 * a step of 0 to 3 of its own cap (industryKit.js stockStep: none, a third,
 * two thirds, full), a kit of its own for each step and each store:
 * '<type>:in:<step>' the raw material, '<type>:in2:<step>' a second one (the
 * Fletcher's iron), '<type>:out:<step>' the product. The kits are models.js
 * `more` entries with one matrix, so a store filling rebuilds nothing.
 *
 * A hard frost freezes the standing water of the trades that have some (the
 * Weaponsmith's quench trough, the Linen Weaver's retting trough and the
 * Clothing Maker's fuller's tub): '<type>:ice'.
 *
 * Two of them have a fire that smokes while staffed, as the temples' smoke
 * kit over its top: the Potter's kiln and the Weaponsmith's forge (its stack,
 * through the roof; a thick plume, since a thin one is lost against the
 * meadow behind a building at the back of the plot).
 *
 * Each lights its lantern at night while staffed (models.js modelLamps).
 * ----------------------------------------------------------------------------
 */

import { Matrix4 } from 'three';
import { CONFIG } from '../../config.js';
import { iceMaterial } from '../materials.js';
import { cast } from '../people/actors.js';
import { stockStep, lampPoints } from './industryKit.js';
import { buildPotter, buildPotterStock, potterActors, POTTER } from './wsPotter.js';
import { buildCarpenter, buildCarpenterStock, carpenterActors, CARPENTER } from './wsCarpenter.js';
import { buildOilPress, buildOilPressStock, oilPressActors, OIL_PRESS } from './wsOilPress.js';
import { buildWinery, buildWineryStock, wineryActors, WINERY } from './wsWinery.js';
import { buildWeaponsmith, buildWeaponsmithStock, weaponsmithActors, WEAPONSMITH } from './wsWeaponsmith.js';
import { buildFletcher, buildFletcherStock, fletcherActors, FLETCHER } from './wsFletcher.js';
import { buildLinenWeaver, buildLinenStock, linenWeaverActors, LINEN_WEAVER } from './wsLinen.js';
import { buildClothingMaker, buildClothingStock, clothingMakerActors, CLOTHING_MAKER } from './wsClothing.js';

/** A workshop's state: 'open' staffed, 'shut' not. */
export function workshopState(b) {
  return b.efficiency > 0 ? 'open' : 'shut';
}

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3), as models.js reads it. */
const frost = (place) => ((place && place.snow) || 0) >= 2;

/** The product's cap: a workshop stops at two lots (sim/production.js updateWorkshop). */
export const WORKSHOP_OUT_CAP = CONFIG.CART_CAPACITY * 2;

const IDENTITY = new Float32Array(new Matrix4().elements);

/** A kit and the one matrix it is drawn at, as a models.js `more` entry. */
const part = (key, mats = IDENTITY) => Object.freeze({ key, n: 1, mats, state: 'always' });

/** The smoke of a fire as a temples' smoke kit ('sacra:smoke:thin', or 'thick' where it stands over the meadow, which hides a thin one) over its top. */
const smokeAt = ({ x, y, z, kind = 'thin' }) => part(`sacra:smoke:${kind}`, new Float32Array(new Matrix4().makeTranslation(x, y, z).elements));

/**
 * The entry of one workshop.
 *   type          its building type
 *   good, good2   the raw materials it holds (good2: a second one, or null)
 *   made          the good it makes
 *   build, stock  (opts) -> { group }; (kind, step, opts) -> { group }
 *   actors        (state) -> actor specs
 *   lamp          [x, y, z] of its lantern's base
 *   smoke         { x, y, z, kind } over its fire's top, or null
 *   ice           has standing water that freezes
 */
function workshop({ type, good, good2 = null, made, build, stock, actors, lamp, smoke = null, ice = false }) {
  const casts = {};
  const castOf = (state) => (casts[state] ??= cast(actors(state)));
  const smokeKit = smoke ? smokeAt(smoke) : null;
  const mores = {};
  // The `more` of each combination of steps (in, in2, out) and smoking, made once.
  const moreOf = (a, c, o, smoking) => {
    const k = ((a * 4 + c) * 4 + o) * 2 + (smoking ? 1 : 0);
    return (mores[k] ??= Object.freeze([
      ...(a ? [part(`${type}:in:${a}`)] : []),
      ...(c ? [part(`${type}:in2:${c}`)] : []),
      ...(o ? [part(`${type}:out:${o}`)] : []),
      ...(smoking && smokeKit ? [smokeKit] : []),
    ]));
  };
  const lamps = lampPoints(lamp);
  return Object.freeze({
    warm: [type, `${type}:in:3`, `${type}:out:3`, ...(good2 ? [`${type}:in2:3`] : []), ...(smokeKit ? [smokeKit.key] : [])],
    lamps: (b) => (b.efficiency > 0 ? lamps : []),
    variant(b, place) {
      const state = workshopState(b);
      // (A ghost has no id and no stock: the workshop as it will stand, staffed and empty, its people not drawn.)
      const ghost = b.id === null || b.id === undefined;
      const st = b.stock || {};
      const a = ghost ? 0 : stockStep(st[good], CONFIG.WORKSHOP_RAW_CAP);
      const c = ghost || !good2 ? 0 : stockStep(st[good2], CONFIG.WORKSHOP_RAW_CAP);
      const o = ghost ? 0 : stockStep(st[made], WORKSHOP_OUT_CAP);
      const key = ice && frost(place) ? `${type}:ice` : type;
      return { key, state, ice: false, actors: castOf(state), more: moreOf(a, c, o, !ghost && state === 'open') };
    },
    build(key, lod) {
      const [, what, step] = key.split(':');
      if (what === 'in' || what === 'in2' || what === 'out') return stock(what, Number(step), { lod }).group;
      const m = build({ lod });
      if (what === 'ice') for (const mesh of m.meshes) if (mesh.name === 'water') mesh.material = iceMaterial();
      return m.group;
    },
  });
}

export const WORKSHOP_MODELS = Object.freeze({
  pottery_ws: workshop({ type: 'pottery_ws', good: 'clay', made: 'pottery', build: buildPotter, stock: buildPotterStock, actors: potterActors, lamp: POTTER.lamp, smoke: POTTER.smoke }),
  furniture_ws: workshop({ type: 'furniture_ws', good: 'timber', made: 'furniture', build: buildCarpenter, stock: buildCarpenterStock, actors: carpenterActors, lamp: CARPENTER.lamp }),
  oil_ws: workshop({ type: 'oil_ws', good: 'olives', made: 'oil', build: buildOilPress, stock: buildOilPressStock, actors: oilPressActors, lamp: OIL_PRESS.lamp }),
  wine_ws: workshop({ type: 'wine_ws', good: 'grapes', made: 'wine', build: buildWinery, stock: buildWineryStock, actors: wineryActors, lamp: WINERY.lamp }),
  weapons_ws: workshop({ type: 'weapons_ws', good: 'iron', made: 'weapons', build: buildWeaponsmith, stock: buildWeaponsmithStock, actors: weaponsmithActors, lamp: WEAPONSMITH.lamp, smoke: WEAPONSMITH.smoke, ice: true }),
  fletcher_ws: workshop({ type: 'fletcher_ws', good: 'timber', good2: 'iron', made: 'arrows', build: buildFletcher, stock: buildFletcherStock, actors: fletcherActors, lamp: FLETCHER.lamp }),
  linen_ws: workshop({ type: 'linen_ws', good: 'flax', made: 'linen', build: buildLinenWeaver, stock: buildLinenStock, actors: linenWeaverActors, lamp: LINEN_WEAVER.lamp, ice: true }),
  clothing_ws: workshop({ type: 'clothing_ws', good: 'linen', made: 'clothing', build: buildClothingMaker, stock: buildClothingStock, actors: clothingMakerActors, lamp: CLOTHING_MAKER.lamp, ice: true }),
});
