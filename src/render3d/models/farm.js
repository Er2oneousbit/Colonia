/**
 * models/farm.js
 * ----------------------------------------------------------------------------
 * The farms as the WebGL back end draws them (models.js registers them):
 * what a farm shows, read from the sim, and the kits it is made of.
 *
 * A farm is several kits, each instanced on its own (modelPass.js `more`),
 * so that the things many farms share are drawn once for all of them:
 *
 *   farmstead:c          the farmhouse (farmstead.js), every crop and pig
 *                        farm's; c 'n' worked, 'i' idle
 *   dress:kind:s:c       the kind's yard and field things (farmKinds.js) at
 *                        its step s and condition c
 *   tree:sp:v:look:f     a tree (orchard.js): species, one of two shapes,
 *                        the time of year's look, fruit 0 / 1 / 2; an
 *                        orchard or a grove is nine instances
 *   vine:look:f          a row of vines: a vineyard is six
 *   pig:coat:pose        an animal (livestock.js): a pen's pigs, a
 *   horse:coat:pose      paddock's horses, moving by their matrices
 *
 * What the sim says, and what it shows (farmLook):
 *   - the field's step from its progress, as the 2D art reads it
 *     (buildingArt.js artState: 0 to 4 by fifths): 0 just harvested and
 *     sown, 1 sprouting, 2 growing, 3 ripening (fruit growing on the trees
 *     and vines), 4 ripe (the harvest: sheaves, ladders, full baskets)
 *   - resting for the winter (sim/production.js farmDormant, Insane): the
 *     tools put away, no harvest scene, most pigs in the sty and half the
 *     horses in the stable
 *   - idle (no workers: efficiency 0): doors and shutters shut, weeds, the
 *     cart gone, the stacks slumped, the pond gone green
 *   - the herd (a ranch's breeding mares, sim's b.herd: 2 to 8) is the
 *     horses in the paddock; a pig farm's pigs grow in number with its
 *     step, as the 2D art's do, the young ones piglets
 *   - the month (the seasons shown) gives the trees' and vines' look:
 *     bare in winter, blossom (apple, pear) or young leaf in spring, full
 *     leaf in summer, autumn colours (orchard.js treeLookOf); the olive
 *     stays green; snow and rain are the look's uniforms (materials.js)
 *
 * The keys change only when one of these does (a step is a fifth of a
 * harvest, every few game days), never with the day: a farm's list of kits
 * is kept per building (memo) and rebuilt only when its look changes; the
 * animals' matrices alone are refilled each frame.
 * ----------------------------------------------------------------------------
 */

import { Matrix4, Quaternion, Vector3 } from 'three';
import { buildFarmstead } from './farmstead.js';
import { buildDressing, TREE_SPOTS, VINE_ROWS, PEN, PADDOCK } from './farmKinds.js';
import { buildTree, buildVineRow, treeLookOf } from './orchard.js';
import { buildPig, buildHorse, herdPlaces, penCells, PIG_COATS, HORSE_COATS } from './livestock.js';
import { farmDormant } from '../../sim/production.js';
import { hash2 } from '../texgen.js';

/** Each farm type's kind of dressing (farmKinds.js). */
export const FARM_KIND = Object.freeze({
  farm_wheat: 'wheat', farm_veg: 'vegetables', farm_fruit: 'orchard', farm_olive: 'olive',
  farm_vine: 'vines', farm_flax: 'flax', farm_pig: 'sty', horse_ranch: 'stable',
});
/** The orchard's rows, front to back: apples, pears, figs. */
export const ORCHARD_ROWS = Object.freeze(['apple', 'pear', 'fig']);
/** A new ranch's mares (data/units.js HERD_START): a ghost's. */
const GHOST_HERD = 2;

/** The field's step from its progress (0..100), as the 2D art reads it: 0 to 4 by fifths. */
export function farmStep(progress) {
  return Math.max(0, Math.min(4, Math.floor((progress || 0) / 20)));
}

/** Fruit on the trees and vines at a step: 0 none, 1 growing (ripening), 2 ripe. */
export function fruitOf(step) {
  return step >= 4 ? 2 : step === 3 ? 1 : 0;
}

/** Pigs in the pen: more as the litter grows (as the 2D art's), two in a winter's rest (the rest in the sty). */
export function pigCount(step, cond) {
  return cond === 'r' ? 2 : 2 + step * 2;
}

/** Horses in the paddock: the breeding herd (at least one), half of them in the stable in a winter's rest. */
export function horsesOut(herd, cond) {
  const h = Math.max(1, herd || 0);
  return cond === 'r' ? Math.ceil(h / 2) : h;
}

/**
 * What a farm shows (see the header): { kind, step, cond, tree, fruit,
 * pigs, horses }. `resting` from the sim (farmDormant), `month` the game's
 * (null with the seasons off).
 */
export function farmLook(b, { resting = false, month = null } = {}) {
  const kind = FARM_KIND[b.type];
  const step = farmStep(b.progress);
  const idle = !(b.efficiency > 0);
  const cond = idle ? 'i' : resting ? 'r' : 'n';
  const out = { kind, step, cond, tree: treeLookOf(month), fruit: cond === 'r' ? 0 : fruitOf(step), pigs: 0, horses: 0 };
  if (kind === 'sty') out.pigs = pigCount(step, cond);
  if (kind === 'stable') out.horses = horsesOut(b.herd ?? GHOST_HERD, cond);
  return out;
}

/** The step a kind's dressing shows (a few kinds look the same at several steps: fewer kits). */
export function dressStep(kind, step) {
  switch (kind) {
    case 'wheat': return step;
    case 'vegetables': return step < 3 ? 0 : step;
    case 'orchard': return step === 0 || step === 4 ? step : 1;
    case 'flax': return step <= 1 ? step : step === 4 ? 4 : 2;
    case 'olive': case 'vines': return step === 4 ? 4 : 0;
    default: return 0;
  }
}

/** The main kit's key: the farmhouse (the ranch's is its stable dressing). */
export function farmKey(look) {
  if (look.kind === 'stable') return `dress:stable:0:${look.cond}`;
  return `farmstead:${look.cond === 'i' ? 'i' : 'n'}`;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const UP = new Vector3(0, 1, 0);
const IDENTITY = new Float32Array(new Matrix4().elements);

/** Write a stand-up matrix (at x, z, turned `yaw` about y, scaled `s`) into `arr` at slot `i`. */
function put(arr, i, x, z, yaw, s = 1) {
  _p.set(x, 0, z);
  _q.setFromAxisAngle(UP, yaw);
  _s.setScalar(s);
  _m.compose(_p, _q, _s).toArray(arr, i * 16);
}

/**
 * The kits a farm is made of besides its main one, as modelPass.js reads
 * them: [{ key, mats (Float32Array of 4 x 4 matrices, the farm's own
 * metres), n }]; `animals` (null for none) the herd's slots to refill each
 * frame (moveAnimals). `id` seeds each farm's trees' turn and size, so no
 * two farms' trees stand alike.
 */
export function farmParts(look, id = 0) {
  const more = [{ key: `dress:${look.kind}:${dressStep(look.kind, look.step)}:${look.cond}`, mats: IDENTITY, n: 1 }];
  if (look.kind === 'stable') more.shift();
  const seed = (id | 0) + 1;
  if (look.kind === 'orchard' || look.kind === 'olive') {
    const byKey = new Map();
    TREE_SPOTS.forEach(([x, z], i) => {
      const sp = look.kind === 'olive' ? 'olive' : ORCHARD_ROWS[Math.floor(i / 3)];
      const key = `tree:${sp}:${(i + seed) % 2}:${look.tree}:${look.fruit}`;
      let e = byKey.get(key);
      if (!e) {
        e = { key, mats: new Float32Array(16 * 9), n: 0 };
        byKey.set(key, e);
        more.push(e);
      }
      const yaw = hash2(i, seed, 11) * Math.PI * 2;
      // (No bigger than built: a crown stays CROWN_REACH from its trunk, inside the farm.)
      const s = 0.88 + hash2(i, seed, 12) * 0.12;
      put(e.mats, e.n++, x + (hash2(i, seed, 13) - 0.5) * 0.1, z + (hash2(i, seed, 14) - 0.5) * 0.1, yaw, s);
    });
  }
  if (look.kind === 'vines') {
    const e = { key: `vine:${look.tree}:${look.fruit}`, mats: new Float32Array(16 * VINE_ROWS.zs.length), n: 0 };
    const cx = (VINE_ROWS.x0 + VINE_ROWS.x1) / 2;
    VINE_ROWS.zs.forEach((z) => put(e.mats, e.n++, cx, z, 0, 1));
    more.push(e);
  }
  let animals = null;
  if (look.pigs || look.horses) {
    const pig = look.kind === 'sty';
    const n = pig ? look.pigs : look.horses;
    const coats = pig ? PIG_COATS.length : HORSE_COATS.length;
    const poses = pig ? ['stand', 'root'] : ['stand', 'graze'];
    const slots = new Map();
    const which = [];
    for (let i = 0; i < n; i++) {
      const coat = Math.floor(hash2(i, seed, 21) * coats);
      which.push(poses.map((pose) => {
        const key = `${pig ? 'pig' : 'horse'}:${coat}:${pose}`;
        let e = slots.get(key);
        if (!e) {
          e = { key, mats: new Float32Array(16 * n), n: 0 };
          slots.set(key, e);
          more.push(e);
        }
        return e;
      }));
    }
    const cells = pig ? penCells(PEN.roam, Math.max(n, 6)) : [...penCells(PADDOCK.right, 6), ...penCells(PADDOCK.left, 2)];
    animals = { n, which, cells, slots: [...slots.values()], seed: seed * 7 + 3, places: [], young: pig && look.step <= 2 ? n - 2 : 0, pig };
  }
  return { more, animals };
}

/** Move a farm's animals to where they are at time `t` (seconds): refill their slots' matrices. */
export function moveAnimals(a, t) {
  for (const e of a.slots) e.n = 0;
  herdPlaces(a.n, a.cells, a.seed, t, a.places, a.pig ? { pace: 0.3, still: 0.5, young: a.young } : { pace: 0.18, still: 0.7 });
  for (let i = 0; i < a.n; i++) {
    const o = a.places[i];
    const e = a.which[i][o.pose];
    put(e.mats, e.n++, o.x, o.z, o.yaw, o.scale);
  }
}

/** Build any of a farm's kits by its key (see the header). Returns a THREE.Group. */
export function buildFarmPart(key, lod) {
  const k = key.split(':');
  switch (k[0]) {
    case 'farmstead': return buildFarmstead({ lod, idle: k[1] === 'i' }).group;
    case 'dress': return buildDressing(k[1], { lod, step: Number(k[2]), cond: k[3] }).group;
    case 'tree': return buildTree({ species: k[1], seed: 1 + Number(k[2]), look: k[3], fruit: Number(k[4]), lod }).group;
    case 'vine': return buildVineRow({ look: k[1], fruit: Number(k[2]), lod, seed: 3 }).group;
    case 'pig': return buildPig({ coat: Number(k[1]), pose: k[2], lod }).group;
    case 'horse': return buildHorse({ coat: Number(k[1]), pose: k[2], lod }).group;
    default: throw new Error(`Unknown farm part: ${key}`);
  }
}

/** The kit builders by a key's first word (models.js MODEL_PARTS). */
export const FARM_PARTS = Object.freeze(Object.fromEntries(['farmstead', 'dress', 'tree', 'vine', 'pig', 'horse'].map((w) => [w, Object.freeze({ build: buildFarmPart })])));

/** How long a farm's kept look is remembered unseen (frames), as the model pass keeps a kit. */
const KEEP = 600;

/**
 * A farm type's entry for models.js MODELS: its variant (the look from
 * the sim, the kits it is made of, kept per building) and its builder.
 */
export function farmModel(type) {
  return Object.freeze({
    // (Its field is the 3D ground's: with the ground's sprites, the farm keeps its sprite.)
    needsGround: true,
    // Programs to compile before the first farm draws (every material of a farm is in these).
    warm: type === 'farm_wheat' ? ['farmstead:n', 'dress:wheat:0:n', 'dress:flax:0:i', 'tree:apple:0:leaf:2', 'pig:0:stand'] : [],
    variant(b, place, ctx) {
      const resting = ctx && ctx.game && b.def ? farmDormant(ctx.game, b) : false;
      const look = farmLook(b, { resting, month: ctx ? ctx.month : null });
      const key = farmKey(look);
      if (!ctx || b.id === null || b.id === undefined) {
        // A ghost, or a look asked for outside the game: made fresh, the animals standing.
        const fp = farmParts(look, 0);
        if (fp.animals) moveAnimals(fp.animals, 0);
        return { key, state: 'always', ice: false, more: fp.more };
      }
      const memo = (ctx.farmMemo ??= new Map());
      const sig = `${b.type}|${look.step}|${look.cond}|${look.tree}|${look.fruit}|${look.pigs}|${look.horses}`;
      let e = memo.get(b.id);
      if (!e || e.sig !== sig) {
        e = { sig, ...farmParts(look, b.id) };
        memo.set(b.id, e);
      }
      e.seen = ctx.frame;
      if (e.animals) moveAnimals(e.animals, ctx.clock || 0);
      // (Forget farms long unseen: demolished, or another city's.)
      if (ctx.frame % KEEP === 0 && memo.pruned !== ctx.frame) {
        memo.pruned = ctx.frame;
        for (const [id, m] of memo) if (ctx.frame - m.seen > KEEP) memo.delete(id);
      }
      return { key, state: 'always', ice: false, more: e.more };
    },
    build: buildFarmPart,
  });
}
