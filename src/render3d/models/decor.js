/**
 * models/decor.js
 * ----------------------------------------------------------------------------
 * The gardens, the statues, the gardeners' yard and the triumphal arch as
 * the game draws them (render3d/models.js MODELS takes these entries as
 * they are): which look a building shows, from the sim's own fields, read
 * only.
 *
 *   garden          the viridarium (models/hortus.js): a plot of its own
 *                   design (of four, turned four ways, by its tile), in
 *                   the month's season, tended or run wild; its box
 *                   hedges as `more` kits, left out on a side where
 *                   another garden adjoins, so gardens side by side are
 *                   one garden with walks running through
 *   statue_small    the small statue, statue, grand statue (models/
 *   statue_medium   signa.js): a design of the size's by the tile, tended
 *   statue_large    or weathered; the grand statue's lampstands lit at
 *                   night while it is tended
 *   gardener_yard   the topiaria (models/topiaria.js): open while staffed
 *                   (a gardener at work, the shed open, its lantern lit),
 *                   shut without
 *   triumphal_arch  the fornix (models/fornix.js) across its road: built
 *                   with the road along its own x, turned a quarter when
 *                   the road runs along the map's y (the building's
 *                   `axis`, sim/construction.js checkArch)
 *
 * Tended or not: a garden or statue is drawn neglected from the care step
 * (sim/gardens.js careStep) at which its sprite is (render/buildingArt.js
 * artState: NEGLECT_STEP, 60% of its bonus or less), so the two renderers
 * agree; a build ghost shows it tended.
 * ----------------------------------------------------------------------------
 */

import { Matrix4, Group } from 'three';
import { buildSmallStatue, buildStatue, buildGrandStatue, SIGNA, GRAND_LAMPS } from './signa.js';
import { buildYard, TOPIARIA } from './topiaria.js';
import { buildArch } from './fornix.js';
import { buildPlot, buildHedge, buildHedgeStub, buildHedgePost, buildGardenWarm, DESIGNS, gardenSeason, HEDGE_END } from './hortus.js';

/** The care step (sim/gardens.js) from which a garden or a statue is drawn neglected: as its sprite (buildingArt.js). */
export const NEGLECT_STEP = 2;

/** A garden's or a statue's state: 'tended', or 'worn' from NEGLECT_STEP on. */
export function decorState(b) {
  return (b.careStep || 0) >= NEGLECT_STEP ? 'worn' : 'tended';
}

/** A small hash of a tile (and a salt), for the designs and turns that vary from tile to tile. */
export function tileHash(x, y, salt = 0) {
  let h = Math.imul((x | 0) + 0x9e37, 0x85ebca6b) ^ Math.imul((y | 0) + 0x7f4a + salt * 0x3c6e, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/** The design a statue at its tile shows (of its size's list). */
export function statueDesign(b) {
  const list = SIGNA[{ statue_small: 'small', statue_medium: 'medium', statue_large: 'large' }[b.type]];
  return list[tileHash(b.x, b.y, 3) % list.length];
}

/** Lamps for models.js modelLamps: [x, y, z] in the model's metres, given facing both ways (in the open). */
const openLamps = (list) => Object.freeze(list.flatMap(([x, y, z]) => [Object.freeze([x, y, z, 1]), Object.freeze([x, y, z, -1])]));
const GRAND_LIT = openLamps(GRAND_LAMPS);

/** A statue's entry: its design by the tile, tended or worn. */
function statue(type, build) {
  return Object.freeze({
    warm: [`${type}:${SIGNA[{ statue_small: 'small', statue_medium: 'medium', statue_large: 'large' }[type]][0]}:tended`],
    variant: (b) => ({ key: `${type}:${statueDesign(b)}:${decorState(b)}`, state: 'always', ice: false }),
    build(key, lod) {
      const [, design, state] = key.split(':');
      return build({ design, worn: state === 'worn', lod }).group;
    },
    ...(type === 'statue_large' ? { lamps: (b) => (decorState(b) === 'tended' ? GRAND_LIT : []) } : {}),
  });
}

// ---------------------------------------------------------------------------
// The garden
// ---------------------------------------------------------------------------

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3) freezes a basin's water. */
const frost = (place) => (place && place.snow) >= 2;

/** The sides of a plot in its own frame: +z, +x, -z, -x, and the turn that takes the +z side's kit to each. */
const SIDE_TURN = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const SIDE_DIR = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** A direction (x, z) of a building's own frame on the map, with its turn (render/turn.js: a quarter takes +x to +y). */
function onMap([dx, dz], turn) {
  let x = dx;
  let y = dz;
  for (let k = 0; k < (turn & 3); k++) [x, y] = [-y, x];
  return [x, y];
}

/**
 * Which sides of a garden another garden adjoins, in its own frame: a mask
 * of SIDE_DIR's bits (1 +z, 2 +x, 4 -z, 8 -x). Read from the map (`game`:
 * its building layer and buildings); 0 without one (a ghost's has one too).
 */
export function gardenMask(b, game) {
  if (!game || !game.map || !game.buildings) return 0;
  const { map } = game;
  let mask = 0;
  SIDE_DIR.forEach((d, i) => {
    const [mx, my] = onMap(d, b.turn || 0);
    const x = b.x + mx;
    const y = b.y + my;
    if (!map.inBounds(x, y)) return;
    const id = map.building[map.idx(x, y)];
    const n = id ? game.buildings.get(id) : null;
    if (n && n !== b && n.type === 'garden') mask |= 1 << i;
  });
  return mask;
}

/** The hedge of a plot with neighbours `mask`: matrices (its own metres) of its runs, its stubs into the next garden, its corner posts. */
export function hedgeLayout(mask) {
  const has = (i) => (mask & (1 << (i & 3))) !== 0;
  const runs = [];
  const stubs = [];
  const posts = [];
  const mid = (2 + HEDGE_END) / 2;
  for (let i = 0; i < 4; i++) {
    if (has(i)) continue;
    const turn = new Matrix4().makeRotationY(SIDE_TURN[i]);
    runs.push(turn);
    // Each end of the run: the next garden along it carries the hedge on (a stub to the tile's edge), else a post.
    // (The run's local +x end points to the side after it in SIDE_TURN's turning, -x to the one before.)
    for (const [e, j] of [[1, i + 1], [-1, i + 3]]) {
      if (has(j)) stubs.push(turn.clone().multiply(new Matrix4().makeTranslation(e * mid, 0, 0)));
    }
    // The corner between this side and the next, when that side has its hedge too.
    if (!has(i + 1)) posts.push(turn);
  }
  const pack = (list) => {
    const a = new Float32Array(list.length * 16);
    list.forEach((m, k) => m.toArray(a, k * 16));
    return a;
  };
  return { runs: pack(runs), stubs: pack(stubs), posts: pack(posts), n: [runs.length, stubs.length, posts.length] };
}

/** The design and quarter turn of a garden's plot, by its tile. */
export function gardenPlot(b) {
  const h = tileHash(b.x, b.y, 1);
  return { design: DESIGNS[h % DESIGNS.length], rot: (h >>> 8) & 3 };
}

const ROT = [0, 1, 2, 3].map((r) => new Matrix4().makeRotationY((r * Math.PI) / 2).toArray(new Float32Array(16)));
/** `more` lists kept by what they show: a few dozen in a city. */
const GARDEN_MORE = new Map();

function gardenMore(b, place, ctx) {
  const state = decorState(b);
  const plain = b.id === null || b.id === undefined;
  const { design, rot } = gardenPlot(b);
  const season = gardenSeason(ctx ? ctx.month : null);
  const ice = state === 'tended' && frost(place) && (design === 'labrum' || design === 'pool');
  const mask = plain ? 0 : gardenMask(b, ctx && ctx.game);
  const sig = `${design}:${season}:${state}${ice ? ':ice' : ''}${plain ? ':plain' : ''}|${rot}|${mask}`;
  let more = GARDEN_MORE.get(sig);
  if (!more) {
    const h = hedgeLayout(mask);
    more = [{ key: `garden:plot:${design}:${season}:${state}${ice ? ':ice' : ''}${plain ? ':plain' : ''}`, n: 1, mats: ROT[rot] }];
    if (h.n[0]) more.push({ key: `garden:hedge:${state}`, n: h.n[0], mats: h.runs });
    if (h.n[1]) more.push({ key: `garden:stub:${state}`, n: h.n[1], mats: h.stubs });
    if (h.n[2]) more.push({ key: `garden:post:${state}`, n: h.n[2], mats: h.posts });
    if (GARDEN_MORE.size > 2000) GARDEN_MORE.clear();
    GARDEN_MORE.set(sig, more);
  }
  return more;
}

const GARDEN = Object.freeze({
  // (Every program a garden draws with: the plot's materials, the hedge's, each spray's full and lite.)
  warm: ['garden:warm', 'garden:plot:labrum:bloom:tended', 'garden:hedge:tended'],
  // The garden's own look is empty: its plot and hedges are its `more` kits.
  variant: (b, place, ctx) => ({ key: 'garden:none', state: 'always', ice: false, more: gardenMore(b, place, ctx) }),
  build(key, lod) {
    const [, what, a, b, c, d] = key.split(':');
    const worn = (w) => w === 'worn';
    switch (what) {
      case 'none': return new Group();
      case 'warm': return buildGardenWarm().group;
      case 'plot': return buildPlot({ design: a, season: b, worn: worn(c), ice: d === 'ice', plain: d === 'plain' || key.endsWith(':plain'), lod }).group;
      case 'hedge': return buildHedge({ worn: worn(a), lod }).group;
      case 'stub': return buildHedgeStub({ worn: worn(a), lod }).group;
      case 'post': return buildHedgePost({ worn: worn(a), lod }).group;
      default: throw new Error(`No garden look ${key}`);
    }
  },
});

// ---------------------------------------------------------------------------
// The gardeners' yard and the triumphal arch
// ---------------------------------------------------------------------------

/** The yard's state: 'open' while staffed, 'shut' with no staff. */
export function yardState(b) {
  return b.efficiency > 0 ? 'open' : 'shut';
}

const YARD_LIT = Object.freeze([Object.freeze([TOPIARIA.lamp[0], TOPIARIA.lamp[1] + 0.11, TOPIARIA.lamp[2], 1])]);

const YARD = Object.freeze({
  warm: ['gardener_yard'],
  variant: (b) => ({ key: 'gardener_yard', state: yardState(b), ice: false }),
  lamps: (b) => (b.efficiency > 0 ? YARD_LIT : []),
  build: (key, lod) => buildYard({ lod }).group,
});

/**
 * The way an arch's road runs on the map: its `axis` (0 along x, 1 along
 * y: sim/construction.js checkArch). A build ghost has none yet: read off
 * the road under its middle row or column, as checkArch reads it.
 */
export function archAxis(b, game) {
  if (b.axis === 0 || b.axis === 1) return b.axis;
  const map = game && game.map;
  if (!map) return 0;
  const S = b.size || 3;
  const mid = Math.floor(S / 2);
  let alongX = true;
  for (let d = 0; d < S; d++) if (!map.hasRoad(b.x + d, b.y + mid)) alongX = false;
  if (alongX) return 0;
  let alongY = true;
  for (let d = 0; d < S; d++) if (!map.hasRoad(b.x + mid, b.y + d)) alongY = false;
  return alongY ? 1 : 0;
}

/**
 * The arch's look: built with its road along its own x; the model is turned
 * with the building's turn (modelMatrix), so its road lies along the map's
 * x when the axis and the turn agree (both even or both odd), else it is
 * the look turned a quarter ('triumphal_arch:1').
 */
export function archKey(b, game) {
  return `triumphal_arch:${(archAxis(b, game) ^ ((b.turn || 0) & 1)) & 1}`;
}

const ARCH = Object.freeze({
  warm: ['triumphal_arch:0'],
  variant: (b, place, ctx) => ({ key: archKey(b, ctx && ctx.game), state: 'always', ice: false }),
  build(key, lod) {
    const g = buildArch({ lod }).group;
    // A quarter turn (+x to +z, as modelMatrix turns): the road along z.
    if (key.endsWith(':1')) {
      g.rotation.y = -Math.PI / 2;
      g.updateMatrixWorld(true);
    }
    return g;
  },
});

export const DECOR_MODELS = Object.freeze({
  garden: GARDEN,
  gardener_yard: YARD,
  triumphal_arch: ARCH,
  statue_small: statue('statue_small', buildSmallStatue),
  statue_medium: statue('statue_medium', buildStatue),
  statue_large: statue('statue_large', buildGrandStatue),
});

export { Matrix4 };
