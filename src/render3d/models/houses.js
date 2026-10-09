/**
 * models/houses.js
 * ----------------------------------------------------------------------------
 * The homes the WebGL renderer draws as 3D models (render3d/models.js MODELS
 * takes HOUSE_MODELS as it is): the five levels where a city's homes most
 * often settle. Every other level keeps its 2D sprite.
 *
 *   level 4   Hut              1 x 1   models/housesSmall.js
 *   level 5   Cottage          1 x 1   models/housesSmall.js
 *   level 7   Townhouse        1 x 1   models/housesTall.js
 *   level 10  Apartment House  1 x 1   models/housesTall.js
 *   level 11  Tenement         2 x 2   models/housesTall.js
 *
 * Each has VARIANTS looks, picked by a stable hash of the building's id (the
 * same home looks the same after a reload; a street of the same level is not
 * one pattern), turned to face its access road by the building's turn as
 * every model is. A 2 x 2 block of single-tile homes (four neighbours of one
 * level that joined: sim/housing.js) is drawn as four homes, each with its
 * own look: a plot kit for the block and the four in `more`, so a street
 * still costs a few instanced draws a look.
 *
 * States: 'open' when people live there (the sim's pop above 0): shutters
 * swung back, doors open, a few people at the closest zooms (never from far,
 * so hundreds of homes stay cheap), a lit window here and there at night by
 * hash; 'shut' when empty: everything closed, nobody. The build ghost of the
 * house tool is a vacant lot (pegs and cord on trodden earth), as the lot
 * the tool places.
 * ----------------------------------------------------------------------------
 */

import { Matrix4 } from 'three';
import { cast, hash01, DYES } from '../people/actors.js';
import { Bag, VARIANTS, WOODS } from './houseKit.js';
import { box, cyl } from './castra.js';
import { lin } from './rural.js';
import { buildHut, buildCottage, HUT, COTTAGE, HUT_LAMPS, COTTAGE_LAMPS } from './housesSmall.js';
import { buildTownhouse, buildApartment, buildTenement, TOWNHOUSE, APARTMENT, TENEMENT, townLamps, apartmentLamps, tenementLamps } from './housesTall.js';

/** The housing level (data/housing.js) each model draws, by its kind. */
export const HOUSE_LEVELS = Object.freeze({ hut: 4, cottage: 5, town: 7, apt: 10, ten: 11 });
const KIND_OF = Object.freeze(Object.fromEntries(Object.entries(HOUSE_LEVELS).map(([k, t]) => [t, k])));

/** The four cells of a 2 x 2 block of single-tile homes: their middles (metres) from the block's. */
export const CELLS = Object.freeze([[-2, -2], [2, -2], [-2, 2], [2, 2]]);

/** The look (0 to VARIANTS - 1) a home shows, from its id (a build ghost has none: look 0) and cell. */
export function variantOf(id, level, cell = 0) {
  if (id === null || id === undefined) return 0;
  return Math.min(VARIANTS - 1, Math.floor(hash01(id, level, cell) * VARIANTS));
}

/** Which model kind a building shows, or null (it keeps its sprite). */
export function houseKind(b) {
  if (!b.house) return null;
  const kind = KIND_OF[b.house.tier];
  if (!kind) return null;
  // A tenement is one 2 x 2 home; the lower levels are one tile, or a joined block of four.
  if (kind === 'ten') return b.size === 2 ? kind : null;
  return b.size === 1 || b.size === 2 ? kind : null;
}

// ---------------------------------------------------------------------------
// The lot and the block's plot
// ---------------------------------------------------------------------------

/** A vacant lot: trodden earth, four pegs and a cord round them (the sprite's). */
function buildLot(lod) {
  const bag = new Bag('lot', lod, 777);
  bag.add('earth', box(3.4, 0.03, 3.4, 0, 0, 0, lin(0xa89574, 0.95)));
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]]) bag.add('wood', cyl(0.04, 0.05, 0.6, 5, x, 0, z, lin(WOODS.oak, 0.9)));
  if (lod < 2) {
    bag.add('paint', box(3, 0.012, 0.012, 0, 0.45, -1.5, lin(0xe8e0cc)), box(3, 0.012, 0.012, 0, 0.45, 1.5, lin(0xe8e0cc)), box(0.012, 0.012, 3, -1.5, 0.45, 0, lin(0xe8e0cc)), box(0.012, 0.012, 3, 1.5, 0.45, 0, lin(0xe8e0cc)));
  }
  return bag.build();
}

/** The kerb along the street side of a block of four homes: a paved strip. */
function buildPlot(lod) {
  const bag = new Bag('plot', lod, 778);
  bag.add('flags', box(7.6, 0.04, 0.3, 0, 0, 3.7, lin(0xb8ab94, 0.9)));
  return bag.build();
}

const BUILDERS = { hut: buildHut, cottage: buildCottage, town: buildTownhouse, apt: buildApartment, ten: buildTenement };

/** Build the model of a kit key ('house:hut:2', 'house:lot', 'house:plot'). */
export function buildHouse(key, lod = 0) {
  const [, kind, v] = key.split(':');
  if (kind === 'lot') return buildLot(lod).group;
  if (kind === 'plot') return buildPlot(lod).group;
  return BUILDERS[kind](Number(v) || 0, lod).group;
}

/** Every kit key a house can show. */
export function houseKeys() {
  const keys = ['house:lot', 'house:plot'];
  for (const kind of Object.keys(BUILDERS)) for (let v = 0; v < VARIANTS; v++) keys.push(`house:${kind}:${v}`);
  return keys;
}

// ---------------------------------------------------------------------------
// People (a few, only at the closest zooms)
// ---------------------------------------------------------------------------

const woman = (dress, extra) => ({ body: 'f', dress: ['tunic:long:stola', dress], hair: 'bun', ...extra });
const man = (extra) => ({ body: 'm', dress: ['tunic:knee'], hair: 'crop', ...extra });

/** Offset an actor list by a cell's (x, z). */
function moved(list, ox, oz) {
  return list.map((a) => ({ ...a, at: [a.at[0] + ox, a.at[1], a.at[2] + oz] }));
}

/** A home's people in its own metres, by kind and look (state 'open' only). */
export function peopleOf(kind, v) {
  const s = 400 + v * 7;
  switch (kind) {
    case 'hut': {
      const dx = HUT.doorX[v];
      const list = [v % 2 ? woman('palla', { clip: 'sweep', props: { R: 'broom' }, at: [dx - 0.1, 0.03, HUT.z1 + 0.55], ry: 0.5, seed: s, colours: { tunic: DYES.undyed } })
        : woman('palla', { clip: 'spin', at: [dx + 0.1, 0.03, HUT.z1 + 0.6], ry: 0.2, seed: s, colours: { tunic: DYES.oatmeal } })];
      if (v === 0) list.push(man({ clip: 'sit', at: [dx < 0 ? 0.7 : -0.7, 0.03, HUT.z1 + 0.22], ry: 0.3, seed: s + 1, colours: { tunic: DYES.brownWool } }));
      else list.push({ body: 'c', dress: ['tunic:short'], hair: 'crop', clip: 'idle', at: [dx > 0 ? -1.0 : 1.0, 0.03, HUT.z1 + 0.9], ry: -0.6, seed: s + 2, scale: 0.78 });
      return list;
    }
    case 'cottage': {
      const dx = COTTAGE.doorX[v];
      return [
        woman('palla', { clip: 'sweep', props: { R: 'broom' }, at: [dx - 0.2, 0.03, COTTAGE.z1 + 0.55], ry: 0.4, seed: s, colours: { tunic: DYES.saffron } }),
        { body: 'c', dress: ['tunic:short'], hair: 'curls', clip: 'idle', at: [dx > 0 ? -0.9 : 0.9, 0.03, COTTAGE.z1 + 1.0], ry: 0.5, seed: s + 3, scale: 0.78 },
      ];
    }
    case 'town': {
      const sg = [1, -1, 1, -1][v];
      const mx = TOWNHOUSE.mouth.x * sg;
      const list = [
        man({ clip: 'count', props: { R: 'coin' }, at: [mx, TOWNHOUSE.floorY, TOWNHOUSE.counterZ - 0.33], ry: 0, seed: s, colours: { tunic: DYES.madder } }),
        woman('palla', { clip: 'talk', at: [mx + 0.5, 0, TOWNHOUSE.z1 + 0.55], ry: Math.PI + 0.4, seed: s + 1, colours: { tunic: DYES.oatmeal, mantle: DYES.woad } }),
      ];
      if (v === 0 || v === 2) list.push(woman('palla', { clip: 'idle', at: [mx - 0.5, TOWNHOUSE.lower + 0.07, TOWNHOUSE.z1 + 0.22], ry: 0.2, seed: s + 2, colours: { tunic: DYES.white } }));
      return list;
    }
    case 'apt': {
      const sg = [1, -1, 1, -1][v];
      const mx = APARTMENT.mouth.x * sg;
      const list = [
        man({ clip: 'count', props: { R: 'coin' }, at: [mx, APARTMENT.floorY, APARTMENT.counterZ - 0.33], ry: 0, seed: s, colours: { tunic: DYES.ochre } }),
        woman('palla', { clip: 'talk', at: [mx + 0.6, 0, APARTMENT.z1 + 0.4], ry: Math.PI + 0.3, seed: s + 1, colours: { tunic: DYES.sky, mantle: DYES.oatmeal } }),
      ];
      // On the balcony, where there is one: floor 2 (balcony 2) or floor 3 (3).
      const f = [2, 3, 2, 0][v];
      if (f) list.push(woman('palla', { clip: 'idle', at: [0.9, f === 2 ? APARTMENT.floors[0] + 0.07 : APARTMENT.floors[0] + APARTMENT.floors[1] + 0.07, APARTMENT.z1 + 0.2], ry: 0.2, seed: s + 2, colours: { tunic: DYES.rose } }));
      return list;
    }
    default: {
      const sg = [1, -1, 1, -1][v];
      const [a, b, c] = TENEMENT.shops.map(([x]) => x * sg);
      const H = TENEMENT.half;
      return [
        man({ clip: 'count', props: { R: 'coin' }, at: [a, TENEMENT.floorY, TENEMENT.counterZ - 0.33 - 0.0], ry: 0, seed: s, colours: { tunic: DYES.walnut } }),
        man({ clip: 'count', props: { R: 'coin' }, at: [c, TENEMENT.floorY, TENEMENT.counterZ - 0.33], ry: 0, seed: s + 1, colours: { tunic: DYES.green } }),
        woman('palla', { clip: 'talk', at: [b + 0.4, 0, H + 0.3], ry: Math.PI + 0.3, seed: s + 2, colours: { tunic: DYES.oatmeal, mantle: DYES.madder } }),
        woman('palla', { clip: 'idle', at: [-1.2 * sg, TENEMENT.floors[0] + 0.07, H + 0.17], ry: 0.2, seed: s + 3, colours: { tunic: DYES.white } }),
      ];
    }
  }
}

/**
 * The cast of a home or a block, by kind, looks and which of its people are about (a bit each: the id's
 * hash picks a different few for each home, at least one), packed once.
 */
const CASTS = new Map();
function castOf(kind, vs, mask) {
  const id = `${kind}:${vs.join('')}:${mask}`;
  let c = CASTS.get(id);
  if (!c) {
    const all = vs.length === 1 ? peopleOf(kind, vs[0]) : vs.flatMap((v, i) => moved(peopleOf(kind, v), CELLS[i][0], CELLS[i][1]));
    c = cast(all.filter((_, i) => (mask >> i) & 1));
    CASTS.set(id, c);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Lamps: a lit window here and there at night, by hash
// ---------------------------------------------------------------------------

/** The windows a home may light, by kind and look: [x, y, z, s] each (models.js modelLamps). */
function windowsOf(kind, v) {
  switch (kind) {
    case 'hut': return [HUT_LAMPS[v]];
    case 'cottage': return [COTTAGE_LAMPS[v]];
    case 'town': return townLamps(v);
    case 'apt': return apartmentLamps(v);
    default: return tenementLamps(v);
  }
}

/** The lit ones of a home or block: each window by the hash of the building's id, its place and its number. */
function lampsOf(b, kind) {
  const out = [];
  const block = b.size === 2 && kind !== 'ten';
  const homes = block ? 4 : 1;
  for (let i = 0; i < homes; i++) {
    const v = variantOf(b.id, HOUSE_LEVELS[kind], block ? i : 0);
    const [ox, oz] = block ? CELLS[i] : [0, 0];
    windowsOf(kind, v).forEach((w, n) => {
      if (hash01(b.id, i, n, 71) > (kind === 'ten' ? 0.22 : 0.42)) return;
      out.push([w[0] + ox, w[1], w[2] + oz, w[3] ?? 1]);
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The models.js entry
// ---------------------------------------------------------------------------

const _m = new Matrix4();
/** The matrix arrays of a block's four cells, one per cell. */
const CELL_MATS = CELLS.map(([x, z]) => new Float32Array(_m.makeTranslation(x, 0, z).toArray()));

/** Looks built by (kind, variants, state): `more` lists are made once and shared (the pass only reads them). */
const LOOKS = new Map();

/** The look of a building: its kit key, state, `more` and (near) its people. */
function lookOf(b, near) {
  // A build ghost has no home (the house tool places a vacant lot): its look is the lot.
  const kind = b.house ? houseKind(b) : null;
  if (!kind) return { key: 'house:lot', state: 'always', ice: false };
  const state = b.house.pop > 0 ? 'open' : 'shut';
  const level = HOUSE_LEVELS[kind];
  const block = b.size === 2 && kind !== 'ten';
  const vs = block ? CELLS.map((_, i) => variantOf(b.id, level, i)) : [variantOf(b.id, level)];
  const id = `${kind}:${vs.join('')}:${state}`;
  let look = LOOKS.get(id);
  if (!look) {
    if (block) {
      // One kit a look, its homes' matrices gathered (four cells, up to four looks).
      const more = [];
      const byLook = new Map();
      vs.forEach((v, i) => {
        const key = `house:${kind}:${v}`;
        let e = byLook.get(key);
        if (!e) byLook.set(key, (e = { key, cells: [], state }));
        e.cells.push(i);
      });
      for (const e of byLook.values()) {
        const mats = new Float32Array(16 * e.cells.length);
        e.cells.forEach((c, j) => mats.set(CELL_MATS[c], j * 16));
        more.push({ key: e.key, n: e.cells.length, mats, state });
      }
      look = { key: 'house:plot', state: 'always', ice: false, more };
    } else look = { key: `house:${kind}:${vs[0]}`, state, ice: false };
    look.cast = state === 'open' ? { kind, vs, n: vs.reduce((s, v) => s + peopleOf(kind, v).length, 0) } : null;
    LOOKS.set(id, look);
  }
  // Its people, only where the camera is close (the people's levels 0 and 1: modelPass.js peopleLodFor).
  if (near && look.cast) {
    // (Not everybody is out at once: about half of each home's people, a different few by its id.)
    const n = look.cast.n;
    const mask = 1 + Math.floor(hash01(b.id, 3, 91) * ((1 << n) - 1));
    return { ...look, actors: castOf(look.cast.kind, look.cast.vs, mask) };
  }
  return look;
}

export const HOUSE_MODELS = Object.freeze({
  house: Object.freeze({
    // (One of each level: they share their programs; the lot for the ghost.)
    warm: ['house:lot', 'house:plot', 'house:hut:0', 'house:cottage:0', 'house:town:0', 'house:apt:0', 'house:ten:0'],
    fits: (b) => !!houseKind(b),
    variant: (b, place, ctx) => lookOf(b, !!(ctx && ctx.peopleOn && ctx.people && ctx.people.lod <= 1)),
    build: (key, lod) => buildHouse(key, lod),
    lamps: (b) => {
      if (!b.house || !(b.house.pop > 0)) return [];
      const kind = houseKind(b);
      return kind ? lampsOf(b, kind) : [];
    },
  }),
});
