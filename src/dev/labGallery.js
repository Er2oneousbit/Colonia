/**
 * labGallery.js
 * ----------------------------------------------------------------------------
 * The look lab's Ground types view: every kind of ground the game can show,
 * each on its own labelled card, laid out on one made-up map and drawn by
 * the game's own ground material (render3d/ground/), so each can be judged
 * close up through the moods, seasons, snow and rain. A card holds one
 * kind and its edges with what it meets in the game: pasture, meadow,
 * scrub, the forest floor, rocky ground, dune sand, a beach on the open
 * sea, a river and its banks, a pond; roads (a country road's gravel, a
 * town's basalt street, a plaza, a road across every kind of ground, a
 * bridge); building yards; a wall's and an aqueduct's footing; every farm's
 * field at each step of its year (ploughed, sprouting, growing, ripe,
 * resting for the winter, left idle, turned a quarter); a pig pen and a
 * horse paddock; rubble; a burned ruin and one still burning; a native
 * village's plots.
 *
 * The sprites (buildings, trees, rocks, farmhouses) are not in the lab: the
 * cards show the ground they stand on.
 *
 * The map is in tiles; the lab works in metres (4 a tile), the map's tile
 * (0, 0) corner at GALLERY_ORIGIN.
 * ----------------------------------------------------------------------------
 */

import { GameMap, Terrain, Road } from '../world/map.js';
import { Ground } from '../render3d/ground/ground.js';
import { KIND, WATER_KIND, SITE, BURN, S_RESTING, S_IDLE, siteWord } from '../render3d/ground/groundMap.js';

/** Tiles of grass between cards. */
const GUTTER = 3;
/** The gallery map's width (cards are laid in rows across it). */
const ROW_W = 72;

/**
 * The cards: a name (as the player reads it), a note, a size in tiles, and
 * how it is laid out (`lay(c)`, c the card's painter: see paintCard).
 */
const STAGES = [['ploughed', 0], ['sprouting', 0.12], ['growing', 0.45], ['ripening', 0.75], ['ripe', 1]];
const farmRow = (site, extra = []) => ({
  w: (STAGES.length + extra.length) * 4 - 1,
  h: 3,
  lay(c) {
    STAGES.forEach(([, g], k) => c.farm(k * 4, 0, site, g));
    extra.forEach(([, g, flags, turn], k) => c.farm((STAGES.length + k) * 4, 0, site, g, flags, turn));
  },
  parts: [...STAGES.map((s) => s[0]), ...extra.map((e) => e[0])],
});

export const CARDS = [
  { id: 'pasture', name: 'Pasture', note: 'grass far and near water', w: 6, h: 6, lay(c) { c.fill(0, 0, 6, 6, Terrain.GRASS); } },
  { id: 'meadow', name: 'Meadow', note: 'fertile land, its edge with pasture', w: 6, h: 6, lay(c) { c.fill(2, 0, 4, 6, Terrain.MEADOW); } },
  { id: 'scrub', name: 'Scrub', note: 'dry grass far from water, its edge with pasture', w: 6, h: 6, lay(c) { c.fill(2, 0, 4, 6, Terrain.GRASS, KIND.SCRUB); } },
  { id: 'forest', name: 'Forest floor', note: 'under the trees, its edge with meadow', w: 6, h: 6, lay(c) { c.fill(0, 0, 4, 6, Terrain.TREES); c.fill(4, 0, 2, 6, Terrain.MEADOW); } },
  { id: 'rock', name: 'Rocky ground', note: 'under the rocks, its edge with pasture', w: 6, h: 6, lay(c) { c.fill(1, 1, 4, 4, Terrain.ROCK); } },
  { id: 'sand', name: 'Dune sand', note: 'its edges with scrub and pasture', w: 6, h: 6, lay(c) { c.fill(0, 0, 4, 6, Terrain.SAND); c.fill(4, 0, 2, 3, Terrain.GRASS, KIND.SCRUB); } },
  { id: 'beach', name: 'Beach and open sea', note: 'sand by the sea, the surf', w: 8, h: 7, lay(c) { c.fill(0, 0, 8, 2, Terrain.GRASS); c.fill(0, 2, 8, 2, Terrain.SAND); c.fill(0, 4, 8, 3, Terrain.WATER, null, WATER_KIND.SEA); c.tile(3, 3, Terrain.WATER, null, WATER_KIND.SEA); } },
  {
    id: 'river', name: 'River and banks', note: 'pasture, meadow, a sandy bank', w: 8, h: 7,
    lay(c) {
      c.fill(0, 0, 8, 7, Terrain.MEADOW);
      c.fill(0, 0, 3, 7, Terrain.GRASS);
      for (let y = 0; y < 7; y++) for (let x = 0; x < 2; x++) c.tile(3 + x + (y > 3 ? 1 : 0), y, Terrain.WATER);
      c.tile(6, 5, Terrain.SAND); c.tile(6, 6, Terrain.SAND); c.tile(7, 6, Terrain.SAND);
    },
  },
  { id: 'pond', name: 'Pond', note: 'still fresh water in meadow', w: 6, h: 6, lay(c) { c.fill(0, 0, 6, 6, Terrain.MEADOW); c.fill(2, 2, 2, 2, Terrain.WATER); c.tile(3, 1, Terrain.WATER); c.tile(1, 3, Terrain.WATER); } },
  {
    id: 'gravel', name: 'Country road', note: 'gravel: a bend, a junction, an end', w: 8, h: 6,
    lay(c) { for (let x = 0; x < 8; x++) c.road(x, 2); for (let y = 3; y < 6; y++) c.road(5, y); c.road(1, 1); c.road(1, 0); c.road(2, 0); },
  },
  {
    id: 'street', name: 'Town street', note: 'basalt between kerbs, beside building yards', w: 8, h: 6,
    lay(c) {
      for (let x = 0; x < 8; x++) c.road(x, 3);
      for (let y = 0; y < 3; y++) c.road(4, y);
      c.yard(0, 1, 2); c.yard(2, 1, 2); c.yard(5, 0, 3); c.yard(1, 4, 2); c.yard(5, 4, 2);
    },
  },
  {
    id: 'plaza', name: 'Plaza', note: 'flagstones, joining a street', w: 7, h: 6,
    lay(c) { for (let x = 0; x < 7; x++) c.road(x, 1, Road.ROAD, 1); for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) c.road(x, y, Road.PLAZA); },
  },
  {
    id: 'roadedge', name: 'Road across every ground', note: 'pasture, meadow, forest, sand, rock, scrub, beach', w: 14, h: 5,
    lay(c) {
      const bands = [[Terrain.GRASS], [Terrain.MEADOW], [Terrain.TREES], [Terrain.SAND], [Terrain.ROCK], [Terrain.GRASS, KIND.SCRUB]];
      bands.forEach(([t, k], i) => c.fill(i * 2, 0, 2, 5, t, k));
      c.fill(12, 0, 2, 2, Terrain.SAND); c.fill(12, 3, 2, 2, Terrain.WATER); c.fill(12, 2, 2, 1, Terrain.SAND);
      for (let x = 0; x < 14; x++) c.road(x, 2, Road.ROAD, x >= 7 ? 1 : 0);
    },
  },
  {
    id: 'bridge', name: 'Bridge', note: 'the river under it (the deck is a sprite)', w: 8, h: 6,
    lay(c) { c.fill(3, 0, 2, 6, Terrain.WATER); for (let x = 0; x < 8; x++) c.road(x, 3, x === 3 || x === 4 ? Road.BRIDGE : Road.ROAD); },
  },
  {
    id: 'yards', name: 'Building yards', note: 'trodden earth under and between buildings', w: 9, h: 6,
    lay(c) {
      for (let y = 0; y < 6; y++) c.road(4, y);
      c.yard(0, 0, 1); c.yard(1, 0, 1); c.yard(0, 1, 2); c.yard(2, 1, 2); c.yard(0, 3, 3); c.yard(5, 0, 3); c.yard(5, 3, 2); c.yard(7, 3, 1);
    },
  },
  {
    id: 'footing', name: 'Wall and aqueduct', note: 'the ground along them', w: 9, h: 6,
    lay(c) { c.fill(0, 3, 9, 3, Terrain.MEADOW); for (let x = 0; x < 9; x++) c.footing(x, 1); for (let y = 2; y < 6; y++) c.footing(5, y); c.road(2, 4); c.road(2, 3); },
  },
  { id: 'wheat', name: 'Wheat fields', note: 'ploughed, sprouting, growing, ripening, ripe; resting in winter', ...farmRow(SITE.GRAIN, [['resting', 0.6, S_RESTING]]) },
  { id: 'veg', name: 'Vegetable fields', note: 'ploughed, sprouting, growing, ready; resting in winter', ...farmRow(SITE.VEG, [['resting', 0.5, S_RESTING]]) },
  { id: 'flax', name: 'Flax fields', note: 'ploughed, sprouting, growing, in flower, ripe; resting', ...farmRow(SITE.FLAX, [['in flower', 0.6], ['resting', 0.5, S_RESTING]]) },
  {
    id: 'trees', name: 'Orchard, olive grove, vineyard', note: 'the worked earth where the sprites stand trees and vines', w: 15, h: 3,
    lay(c) { c.farm(0, 0, SITE.ORCHARD, 0.6); c.farm(4, 0, SITE.OLIVE, 0.6); c.farm(8, 0, SITE.VINES, 0.6); c.farm(12, 0, SITE.VINES, 0.6, S_RESTING); },
  },
  {
    id: 'animals', name: 'Pig pen and horse paddock', note: 'mud and straw; grazed, trodden grass', w: 7, h: 3,
    lay(c) { c.farm(0, 0, SITE.PEN, 0.5); c.farm(4, 0, SITE.PADDOCK, 0, 0, 0, true); },
  },
  {
    id: 'idle', name: 'Idle and turned fields', note: 'no workers: weeds; a farm turned a quarter', w: 11, h: 3,
    lay(c) { c.farm(0, 0, SITE.GRAIN, 0.3, S_IDLE); c.farm(4, 0, SITE.VEG, 0.0, S_IDLE); c.farm(8, 0, SITE.GRAIN, 0.75, 0, 1); },
  },
  {
    id: 'rubble', name: 'Rubble', note: 'a collapsed building, beside a street', w: 7, h: 6,
    lay(c) { for (let x = 0; x < 7; x++) c.road(x, 4, Road.ROAD, 1); c.rubble(1, 1, 3); c.rubble(5, 2, 2); },
  },
  {
    id: 'burnt', name: 'Burned ruin', note: 'ash and charred beams, the ground scorched; the right one still burning', w: 8, h: 5,
    lay(c) { c.rubble(0, 1, 3, BURN.BURNT); c.rubble(5, 1, 2, BURN.BURNT | BURN.BURNING); },
  },
  {
    id: 'native', name: 'Native village', note: 'its plots and the trodden ground of its huts', w: 7, h: 5,
    lay(c) { c.fill(0, 0, 7, 5, Terrain.MEADOW); c.plot(0, 1); c.plot(1, 1); c.plot(0, 2); c.yard(3, 1, 1); c.yard(4, 2, 1); c.yard(3, 3, 1); c.yard(5, 0, 1); },
  },
];

/** Lay the cards out in rows across the map: each card's tile rectangle (c.x, c.y). */
function layout() {
  let x = GUTTER;
  let y = GUTTER;
  let rowH = 0;
  const placed = [];
  for (const card of CARDS) {
    if (x + card.w + GUTTER > ROW_W) {
      x = GUTTER;
      y += rowH + GUTTER;
      rowH = 0;
    }
    placed.push({ ...card, x, y });
    x += card.w + GUTTER;
    rowH = Math.max(rowH, card.h);
  }
  return { cards: placed, w: ROW_W, h: y + rowH + GUTTER };
}

/** The gallery's map, and what the hooks say stands on each tile. */
export function galleryMap() {
  const { cards, w, h } = layout();
  const map = new GameMap(w, h);
  map.terrain.fill(Terrain.GRASS);
  const n = w * h;
  const kinds = new Int16Array(n).fill(-1);
  const waters = new Int8Array(n).fill(-1);
  const sites = new Uint32Array(n);
  const owners = new Int32Array(n);
  const burns = new Uint8Array(n);
  let owner = 1;
  for (const card of cards) {
    const at = (x, y) => (x >= 0 && y >= 0 && x < card.w && y < card.h ? map.idx(card.x + x, card.y + y) : -1);
    const c = {
      tile(x, y, t, kind = null, water = null) {
        const i = at(x, y);
        if (i < 0) return;
        map.terrain[i] = t;
        if (kind !== null && kind !== undefined) kinds[i] = kind;
        if (water !== null && water !== undefined) waters[i] = water;
      },
      fill(x0, y0, fw, fh, t, kind, water) { for (let y = y0; y < y0 + fh; y++) for (let x = x0; x < x0 + fw; x++) c.tile(x, y, t, kind, water); },
      road(x, y, kind = Road.ROAD, fixed = 0) {
        const i = at(x, y);
        if (i < 0) return;
        map.road[i] = kind;
        map.fixedRoad[i] = fixed;
      },
      site(x, y, word, who) {
        const i = at(x, y);
        if (i < 0) return;
        sites[i] = word;
        owners[i] = who;
      },
      yard(x0, y0, S) {
        const who = owner++;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) c.site(x0 + x, y0 + y, siteWord(SITE.YARD, 0, 0, S, x, y, 0), who);
      },
      plot(x, y) { c.site(x, y, siteWord(SITE.SOIL, 0.6, 0, 1, 0, 0, 0), owner++); },
      footing(x, y) { c.site(x, y, siteWord(SITE.FOOTING), -1); },
      // A 3 x 3 farm as groundSites.js makes it: the farmhouse's yard on the art's u 0..1, the field on the rest.
      farm(x0, y0, site, growth, flags = 0, turn = 0, whole = false) {
        const who = owner++;
        for (let ly = 0; ly < 3; ly++) {
          for (let lx = 0; lx < 3; lx++) {
            const u = [lx, ly, 2 - lx, 2 - ly][turn & 3]; // which column of the art (turned back) the tile is
            const s = !whole && u < 1 ? SITE.YARD : site;
            c.site(x0 + lx, y0 + ly, siteWord(s, growth, flags, 3, lx, ly, turn), who);
          }
        }
      },
      rubble(x0, y0, S, burn = 0) {
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            const i = at(x0 + x, y0 + y);
            if (i < 0) continue;
            map.rubble[i] = 1;
            burns[i] = burn;
          }
        }
      },
    };
    card.lay(c);
  }
  map.revision++;
  const hooks = {
    farmAt: (i) => (sites[i] & 255) >= SITE.SOIL,
    buildingAt: (i) => owners[i] > 0,
    siteAt: (i) => sites[i],
    ownerAt: (i) => owners[i],
    burnAt: (i) => burns[i],
    live: () => [],
  };
  return {
    map, cards, hooks,
    // (The gallery's grass is all far from water, where the game dries some to scrub: only the cards say where scrub is.)
    kindHook: (i, k) => (kinds[i] >= 0 ? kinds[i] : k === KIND.SCRUB ? KIND.GRASS : k),
    waterHook: (i, wk) => (wk && waters[i] >= 0 ? waters[i] : wk),
  };
}

/** Where the gallery map's tile (0, 0) corner lies (metres): beside the Ground scene, far enough not to meet it. */
export const GALLERY_ORIGIN = [200, 0];

/** The gallery's ground on painted textures `tex` (groundTextures.js). */
export function buildGallery(tex, quality = 'high') {
  const g = galleryMap();
  const ground = new Ground(g.map, tex, { quality, scale: 4, hooks: g.hooks, kindHook: g.kindHook, waterHook: g.waterHook });
  ground.group.position.set(GALLERY_ORIGIN[0], 0, GALLERY_ORIGIN[1]);
  ground.group.updateMatrixWorld(true);
  /** A card's middle, and its four corners, in the lab's metres. */
  const centre = (card) => [GALLERY_ORIGIN[0] + (card.x + card.w / 2) * 4, GALLERY_ORIGIN[1] + (card.y + card.h / 2) * 4];
  const corners = (card) => [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => [GALLERY_ORIGIN[0] + (card.x + a * card.w) * 4, GALLERY_ORIGIN[1] + (card.y + b * card.h) * 4]);
  return { ground, map: g.map, cards: g.cards, centre, corners };
}
