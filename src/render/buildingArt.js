/**
 * buildingArt.js
 * ----------------------------------------------------------------------------
 * Procedural art for every building and house tier, built from the simple
 * primitives in draw.js (boxes, roofs, columns, windows). All original.
 *
 * buildingSpec(key, size, variant, state, live) returns a sprite spec for
 * sprites.js. `state` carries art-relevant status: house tier, farm growth
 * stage, reservoir filled, etc. It is part of the cache key.
 *
 * Flags: FLAG_SPECS lists every flag and banner. In the game view (`live`)
 * the sprite keeps only the poles and the renderer draws the cloth every
 * frame so it flutters (liveArt.js); icons and other still pictures get a
 * painted cloth.
 *
 * Painter's order inside each drawing: back (small u+v) first, front last.
 * ----------------------------------------------------------------------------
 */

import { HALF_W, CONFIG } from '../config.js';
import { HOUSE_TIERS } from '../data/housing.js';
import { GOODS } from '../data/goods.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNIT_TYPES } from '../data/units.js';
import { GODS } from '../data/gods.js';
import { P, poly, quad, ground, box, gableRoof, hipRoof, column, colonnade, windows, door, shade, mix, tree, bareTree, cypress, hash01, horse, setRoofSnow, roofSnowAmount, SNOW } from './draw.js';
import { drawTurned, drawTurnedOver, withOrigin, turnUV, unit, decal, TS } from './turn.js';
import { shipyardArt, wharfArt, turner, turnedRect, paint, overWater, pierDeck } from './waterArt.js';
import { navaliaArt, stationArt, portusArt } from './navyArt.js';
import { OVER_WATER_ART } from '../sim/entities.js';
import { monumentLook } from '../sim/monumentEffects.js';
import { hippodromeArt, chariotMakerArt } from './hippodromeArt.js';
import { nativeHutArt, nativeMeetingArt, nativeCropsArt, missionPostArt } from './nativeArt.js';
import { MONUMENT_ART, MONUMENT_HEIGHT, MONUMENT_SHADOW, revolve } from './monumentArt.js';

const TH = CONFIG.TILE_H;

export const COL = Object.freeze({
  cream: '#e8dcc0',
  white: '#f1ece2',
  ochre: '#d6ac6b',
  pink: '#dfb49c',
  mud: '#b8986a',
  wood: '#8a5a33',
  woodDark: '#5e3b20',
  terra: '#b8573a',
  terraDark: '#93432c',
  thatch: '#c9a75b',
  marble: '#f2eee6',
  stone: '#a79f8f',
  stoneDark: '#7f7768',
  paving: '#cfc2a2',
  soil: '#7d5c3b',
  soilLight: '#9a7650',
  grass: '#6f9e46',
  water: '#4a90c8',
  cloth: '#ece2c8',
  gold: '#d6ab3c',
  iron: '#6f7680',
  slate: '#6d7480',
  sand: '#dcc58e',
  // The Republic's building stone and finish (the period 3D models): grey-yellow tufa, white-cream
  // plaster over it, the red dado painted along its foot, sun-dried mudbrick and turf.
  tufa: '#bdae88',
  tufaDark: '#9a8b68',
  plaster: '#ebe0c6',
  dado: '#a4472f',
  mudbrick: '#b38d5c',
  turf: '#6d8a47',
});

/** The care step (sim/gardens.js) from which a garden or statue looks untended: 60% of its bonus or less. */
const NEGLECT_STEP = 2;

/** Extra art height (px above the footprint's top corner) per key. */
const HEIGHT = {
  house: 70, well: 24, fountain: 26, reservoir: 30, barber: 34, clinic: 34, baths: 50, hospital: 50,
  oracle: 56, school: 44, library: 52, academy: 60, theater: 40, amphitheater: 46, colosseum: 70,
  actor_troupe: 44, gladiator_school: 40, menagerie: 40, forum: 46, senate: 84, garden: 30,
  governor_house: 52, governor_villa: 66, governor_palace: 104,
  statue_small: 40, statue_medium: 64, statue_large: 90, triumphal_arch: 82, engineer_post: 44, gardener_yard: 34, prefecture: 40,
  clay_pit: 30, timber_yard: 34, iron_mine: 40, marble_quarry: 40, market: 36, granary: 50, warehouse: 40,
  barracks: 36, fort_legion: 36, fort_archer: 36, fort_cavalry: 36, tower: 66, horse_ranch: 34, dock: 44,
  shipyard: 36, wharf: 30, hippodrome: 46, hippodrome_part: 46, chariot_maker: 34, navalia: 42, naval_station: 58,
  portus: 40, military_academy: 48,
  native_hut: 34, native_meeting: 34, native_crops: 18, mission_post: 44,
  ...MONUMENT_HEIGHT, // the monuments and their work camp (monumentArt.js)
};

/**
 * How far (in tiles) a building's shadow reaches across the ground. The sun
 * is in the upper left (the same light the art is shaded with), so shadows
 * fall to the lower right. Flat things (fields, plazas) cast almost none.
 */
const SHADOW = {
  well: 0.15, fountain: 0.2, reservoir: 0.25, garden: 0.15, plaza: 0, market: 0.3, horse_ranch: 0.25,
  clay_pit: 0.08, iron_mine: 0.45, marble_quarry: 0.35, dock: 0.35, statue_small: 0.35, statue_medium: 0.6,
  statue_large: 0.9, triumphal_arch: 0.9, tower: 1.15, senate: 0.75, colosseum: 0.8, amphitheater: 0.7, theater: 0.55, granary: 0.8,
  warehouse: 0.4, barracks: 0.55, fort_legion: 0.35, fort_archer: 0.35, fort_cavalry: 0.35, engineer_post: 0.45, gardener_yard: 0.3,
  prefecture: 0.4, shipyard: 0.3, wharf: 0.25, hippodrome: 0.35, hippodrome_part: 0.35, chariot_maker: 0.45,
  navalia: 0.4, naval_station: 0.55, portus: 0.3, military_academy: 0.5, governor_house: 0.55, governor_villa: 0.75, governor_palace: 1.0,
  native_crops: 0.05, native_hut: 0.5, native_meeting: 0.4,
  ...MONUMENT_SHADOW,
};
/** Shadow length per house level (tents are low, insulae tall, villas wide but low, palaces tall). */
const HOUSE_SHADOW = [0, 0.18, 0.2, 0.22, 0.26, 0.3, 0.34, 0.45, 0.5, 0.5, 0.65, 0.95, 1.1, 0.5, 0.55, 0.55, 0.6, 0.65, 0.7, 0.85, 0.9];

export function shadowLength(b) {
  if (b.house) return HOUSE_SHADOW[b.house.tier] ?? 0.3;
  if (SHADOW[b.type] !== undefined) return SHADOW[b.type];
  const kind = b.def.kind;
  if (kind === 'farm') return 0.2;
  if (kind === 'decor') return 0.2;
  if (kind === 'workshop') return 0.5;
  return Math.min(1.1, heightFor(b.type, b.size) / 70);
}

export function heightFor(key, size) {
  if (key.startsWith('temple_large_')) return 84;
  if (key.startsWith('temple_')) return 56;
  if (key.startsWith('farm_')) return 34;
  if (key.endsWith('_ws')) return 50;
  return HEIGHT[key] ?? 30 + size * 16;
}

/**
 * Buildings that look the same from every side (round, or square and
 * symmetric): drawn as written whatever their turn, which spares them the
 * recorder and keeps arches drawn on their two front faces in front.
 */
export const SAME_EVERY_WAY = new Set(['well', 'fountain', 'reservoir', 'amphitheater', 'colosseum', 'oracle', 'statue_small', 'native_hut']);

/**
 * Sprite spec for a building.
 * @param {string} key   building type
 * @param {number} S     footprint size
 * @param {number} variant 0..3
 * @param {*} state      extra art state (tier, stage, filled...)
 */
export function buildingSpec(key, S, variant = 0, state = 0, live = false, snow = 0, sick = false, turn = 0) {
  const extra = heightFor(key, S);
  return {
    w: S * CONFIG.TILE_W,
    h: extra + S * TH + 2,
    ax: S * HALF_W,
    ay: extra,
    draw(ctx) {
      const fn = ART[key] || (key.startsWith('temple_') ? templeArt : key.startsWith('farm_') ? farmArt : key.endsWith('_ws') ? workshopArt : genericArt);
      liveFlags = live;
      setRoofSnow(snow);
      try {
        // Turned art (turn.js): the same drawing, turned in its footprint
        // (round and square-symmetric buildings look the same from every side).
        drawTurned(ctx, S, SAME_EVERY_WAY.has(key) ? 0 : turn, (c) => fn(c, S, variant, state, key));
        if (sick) sickSign(ctx, S, extra); // (always at the front corner, whatever the turn)
        if (BUILDINGS[key]?.tended && state === 1) neglectTint(ctx, S, extra);
      } finally {
        liveFlags = false;
        setRoofSnow(0);
      }
    },
  };
}

/**
 * A garden or statue left untended (sim/gardens.js, artState 1): drawn a
 * little dull and dusty all over, as the sick home is drawn pale. Over the
 * finished sprite, so it needs nothing of the turned art.
 */
function neglectTint(ctx, S, extra) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop'; // only what the art drew
  ctx.fillStyle = 'rgba(112,98,64,0.36)';
  ctx.fillRect(-S * HALF_W - 2, -extra - 2, S * CONFIG.TILE_W + 4, extra + S * TH + 6);
  ctx.restore();
}

/**
 * A sick home (sim/disease.js): the whole house drawn a little pale and
 * sallow, and a pale cloth hung on a pole at its front corner, the old sign
 * to keep away from a house with fever in it.
 */
function sickSign(ctx, S, extra) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop'; // tint only what the house drew
  ctx.fillStyle = 'rgba(206,222,150,0.28)';
  ctx.fillRect(-S * HALF_W - 2, -extra - 2, S * CONFIG.TILE_W + 4, extra + S * TH + 6);
  ctx.restore();
  const [x, y] = P(S - 0.12, S - 0.42);
  ctx.fillStyle = COL.woodDark;
  ctx.fillRect(x - 0.6, y - 15, 1.2, 15);
  ctx.fillStyle = '#e9ecd2';
  ctx.beginPath();
  ctx.moveTo(x + 0.6, y - 15);
  ctx.lineTo(x + 7, y - 14);
  ctx.lineTo(x + 6.2, y - 9.5);
  ctx.lineTo(x + 7.4, y - 7.5);
  ctx.lineTo(x + 0.6, y - 8.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,130,70,0.8)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Flags and banners
// ---------------------------------------------------------------------------

/** True while drawing a sprite for the game view: flags get poles only. */
let liveFlags = false;

/**
 * Every flag, by building type. Pole foot at footprint (u, v, z) - or at
 * local pixels (x, y) - pole height h, cloth width w and height ch, color,
 * swallowtail or plain. Functions receive the footprint size S.
 */
const FLAG_SPECS = {
  prefecture: () => [{ u: 0.86, v: 0.3, z: 16, h: 12, w: 6, ch: 5, color: '#c0392b' }],
  forum: () => [{ u: 1.35, v: 1.3, z: 4, h: 12, w: 5.5, ch: 4, color: '#a8322b' }],
  senate: (S) => [{ u: S / 2, v: 0.75, z: 49, h: 14, w: 6.5, ch: 4.5, color: '#6b3fa0' }], // on the ridge's back end
  // on the awning's masts at the rim of the top tier (colosseumArt: crest 33 px over the middle)
  colosseum: (S) => [[-62, 0.79], [0, 0], [62, 0.79]].map(([dx, k]) => ({ x: dx, y: (S * TH) / 2 - 33 - 0.92 * S * 14 * 0.78 * k, h: 12, w: 6.5, ch: 4, color: '#a8322b' })),
  // The governor's banners (GOV.banner): at his gate, on his roof, on every wing of the palace.
  governor_house: (S) => [S * 0.42 - 0.12, S * 0.42 + 1.02].map((u) => ({ u, v: S - 0.32, z: 7, h: 13, w: 5.5, ch: 7, color: GOV.banner })),
  governor_villa: (S) => [1.1, S - 0.3].map((u) => ({ u, v: 0.85, z: 36, h: 14, w: 6.5, ch: 4.5, color: GOV.banner, swallow: true })),
  governor_palace: (S) => [[0.82, 0.45], [S - 0.82, 0.45], [0.82, S - 1.25], [S - 0.82, S - 1.25]].map(([u, v]) => ({ u, v, z: 34, h: 15, w: 7, ch: 4.5, color: GOV.banner, swallow: true })),
  barracks: (S) => [{ u: S - 0.35, v: 0.3, z: 26, h: 14, w: 9.5, ch: 5.2, color: '#a8322b', swallow: true }],
  military_academy: (S) => [{ u: S - 0.42, v: 1.32, z: 5, h: 20, w: 9.5, ch: 5.2, color: '#a8322b', swallow: true }], // on the instructor's tribunal
  fort: (S, key) => [{ u: S * 0.5, v: S * 0.5, z: 0, h: 26, w: 9.5, ch: 5.2, color: UNIT_TYPES[BUILDINGS[key]?.unit]?.color || '#a8322b', swallow: true }],
};

const flagCache = new Map();

/**
 * Flags of a building type: pole TOP in local px, cloth size and style.
 * @returns {Array<{x:number,y:number,h:number,w:number,ch:number,color:string,swallow:boolean}>}
 */
export function flagsFor(key, S, turn = 0) {
  const ck = `${key}:${S}:${turn & 3}`;
  let list = flagCache.get(ck);
  if (list) return list;
  const fn = FLAG_SPECS[key] || (key.startsWith('fort_') ? FLAG_SPECS.fort : null);
  list = (fn ? fn(S, key) : []).map((f) => {
    // A flag placed by footprint (u, v) turns with the building (pixel-placed
    // ones are on round buildings, the same from every side).
    let at = null;
    if (f.u !== undefined) {
      const [u, v] = turnUV(f.u, f.v, S, turn);
      at = { u, v, z: f.z };
    }
    const [x, y] = at ? [(at.u - at.v) * HALF_W, (at.u + at.v) * (TH / 2) - at.z] : [f.x, f.y];
    return { x, y: y - f.h, h: f.h, w: f.w, ch: f.ch, color: f.color, swallow: !!f.swallow, at };
  });
  flagCache.set(ck, list);
  return list;
}

/** Outline of a flag's cloth hanging still from the pole top (x, y). */
function clothPath(ctx, x, y, f) {
  ctx.beginPath();
  ctx.moveTo(x + 0.6, y);
  ctx.lineTo(x + f.w, y);
  if (f.swallow) ctx.lineTo(x + f.w * 0.8, y + f.ch / 2);
  ctx.lineTo(x + f.w, y + f.ch);
  ctx.lineTo(x + 0.6, y + f.ch);
  ctx.closePath();
}

/** Draw a building's flag poles (and, for still pictures, their cloth). */
function flagPoles(ctx, key, S) {
  for (const f of flagsFor(key, S, TS.t)) {
    // (Its own unit when turned: the pole from its foot up, cloth and all.)
    const b = f.at ? [f.at.u, f.at.u, f.at.v, f.at.v, f.at.z, f.at.z + f.h + f.ch] : null;
    unit(b, () => flagPole(ctx, f));
  }
}

function flagPole(ctx, f) {
  ctx.fillStyle = COL.woodDark;
  ctx.fillRect(f.x - 0.6, f.y, 1.2, f.h);
  if (f.swallow) {
    ctx.fillStyle = COL.gold;
    ctx.fillRect(f.x - 1.3, f.y - 2.4, 2.6, 2.4); // eagle-ish finial
  }
  if (!liveFlags) {
    ctx.fillStyle = f.color;
    clothPath(ctx, f.x, f.y, f);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Houses
// ---------------------------------------------------------------------------

/**
 * House looks. Homes get 8 variants (the renderer passes id % 8): the low two
 * bits pick colors from these palettes, the third bit (`alt`) swaps in
 * extra details such as shutters, flower boxes, chimneys, jars and fences.
 */
const WALLS = [COL.cream, COL.white, '#e6d2b0', '#efe0c9'];
const WALLS_ALT = ['#ead3bd', '#dccdb4', '#f1e6cf', '#e0c9a2'];
const ROOFS = [COL.terra, COL.terraDark, '#c26a3e', '#a45b44'];
const DOORS = ['#4a3222', '#5a2a1f', '#2f4a5a', '#3d5a3a'];
const SHUTTERS = ['#4f7a52', '#4d6f8f', '#8a5a33', '#7a4f6a'];

/** Wall color for a home variant (0..7). */
const houseWall = (variant) => ((variant >> 2) & 1 ? WALLS_ALT : WALLS)[variant % 4];

/** A clay storage jar (amphora) standing at (u, v). */
function jar(ctx, u, v, color = '#b8683f') {
  const [x, y] = P(u, v);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x - 1, y - 0.5, 3.5, 1);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(x, y - 3, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(x - 0.9, y - 7, 1.8, 1.6);
  ctx.fillStyle = shade(color, 0.25);
  ctx.fillRect(x - 1.2, y - 4.5, 0.8, 2);
}

/** A little wooden fence along the front edges of a plot (from u0/v0 to 1). */
function fence(ctx, u0, v0, color = COL.wood) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.7;
  const a = P(u0, 0.95, 3);
  const b = P(0.95, 0.95, 3);
  const c = P(0.95, v0, 3);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  ctx.fillStyle = shade(color, -0.2);
  for (let k = 0; k <= 4; k++) {
    const [px, py] = P(u0 + ((0.95 - u0) * k) / 4, 0.95);
    ctx.fillRect(px - 0.4, py - 3.6, 0.8, 3.6);
    const [qx, qy] = P(0.95, v0 + ((0.95 - v0) * k) / 4);
    ctx.fillRect(qx - 0.4, qy - 3.6, 0.8, 3.6);
  }
}

/**
 * A home: `tier` is its level (0 = vacant lot). Levels 1-10 are single-tile
 * homes (a 2x2 block of them is drawn as four), 11-12 insulae, 13-18 villas
 * (2x2, then 3x3) and 19-20 palaces (4x4).
 */
function houseArt(ctx, S, variant, tier) {
  const native = tier === 0 ? 1 : HOUSE_TIERS[tier].size;
  if (S > native && native === 1) {
    // A 2x2 block of single-tile homes: four homes, each with its own look.
    for (let s = 0; s <= 2 * (S - 1); s++) {
      for (let i = 0; i < S; i++) {
        const j = s - i;
        if (j < 0 || j >= S) continue;
        // (Drawn in its own square of the footprint, so a turned block turns as one.)
        withOrigin(i, j, () => smallHouse(ctx, (variant + i * 3 + j * 5) % 8, tier));
      }
    }
    return;
  }
  if (native === 1) { smallHouse(ctx, variant, tier); return; }
  if (tier <= 12) { insulaArt(ctx, S, variant, tier === 12); return; }
  if (tier <= 18) { villaArt(ctx, S, variant, tier - 13); return; }
  palaceArt(ctx, S, variant, tier - 19);
}

/** Awning colors for shop fronts. */
const AWNINGS = ['#b8573a', '#5d7fa3', '#a38b3d', '#7a9c5a'];

function smallHouse(ctx, variant, tier) {
  const wall = houseWall(variant);
  const alt = (variant >> 2) & 1; // second look: extra details
  const pal = variant % 4;
  switch (tier) {
    case 0: {
      quad(ctx, 0.12, 0.12, 0.88, 0.88, 0, '#b8a071');
      const stakes = [[0.15, 0.15], [0.85, 0.15], [0.85, 0.85], [0.15, 0.85]];
      ctx.strokeStyle = '#e8e0cc';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      stakes.forEach(([u, v], k) => { const p = P(u, v, 3); if (k === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
      ctx.closePath();
      ctx.stroke();
      for (const [u, v] of stakes) { const [x, y] = P(u, v); ctx.fillStyle = COL.woodDark; ctx.fillRect(x - 0.6, y - 4, 1.2, 4); }
      // sign
      const [sx, sy] = P(0.62, 0.78);
      ctx.fillStyle = COL.woodDark;
      ctx.fillRect(sx - 0.5, sy - 9, 1, 9);
      ctx.fillStyle = '#e9d9a8';
      ctx.fillRect(sx - 4, sy - 12, 8, 4);
      return;
    }
    case 1: {
      // Tent
      quad(ctx, 0.1, 0.1, 0.9, 0.9, 0, '#a7925f');
      const cloth = ['#e9dcc0', '#d9c7a3', '#efe6d2', '#cdb894'][variant % 4];
      gableRoof(ctx, 0.18, 0.22, 0.58, 0.46, 0, 13, cloth, 'u', 0);
      // entrance flap
      poly(ctx, [P(0.76, 0.35), P(0.76, 0.55), P(0.76, 0.45, 9)], '#4b3a28');
      if (variant % 2 === 0) {
        gableRoof(ctx, 0.5, 0.62, 0.3, 0.26, 0, 8, shade(cloth, -0.08), 'v', 0);
      }
      // campfire stones
      const [fx, fy] = P(0.3, 0.8);
      ctx.fillStyle = '#6b5f52';
      ctx.fillRect(fx - 2, fy - 1, 4, 2);
      return;
    }
    case 2: {
      // Family Tent: a big tent, a second one beside it, an awning over the
      // cooking place and a water jar from the well.
      quad(ctx, 0.07, 0.07, 0.93, 0.93, 0, '#a58f5c');
      const cloth = ['#e9dcc0', '#d9c7a3', '#efe6d2', '#cdb894'][variant % 4];
      gableRoof(ctx, 0.12, 0.14, 0.54, 0.46, 0, 14, cloth, 'u', 0);
      poly(ctx, [P(0.66, 0.26), P(0.66, 0.46), P(0.66, 0.36, 9)], '#4b3a28');
      gableRoof(ctx, 0.6, 0.12, 0.3, 0.34, 0, 10, shade(cloth, -0.1), 'v', 0);
      // awning: a sheet on two poles, sloping to the front
      for (const u of [0.2, 0.58]) {
        const [x, y] = P(u, 0.86);
        ctx.fillStyle = COL.woodDark;
        ctx.fillRect(x - 0.5, y - 7, 1, 7);
      }
      poly(ctx, [P(0.18, 0.64, 10), P(0.6, 0.64, 10), P(0.6, 0.88, 7), P(0.18, 0.88, 7)], shade(cloth, alt ? -0.18 : 0.04), shade(cloth, -0.4), 0.5);
      const [fx, fy] = P(0.38, 0.78);
      ctx.fillStyle = '#6b5f52';
      ctx.fillRect(fx - 2, fy - 1, 4, 2);
      ctx.fillStyle = '#3d3630';
      ctx.fillRect(fx - 1.2, fy - 3.2, 2.4, 2.2); // cooking pot
      jar(ctx, 0.84, 0.72, '#8a6a4a');
      return;
    }
    case 3: {
      // Lean-to
      quad(ctx, 0.1, 0.1, 0.9, 0.9, 0, '#a08a5c');
      box(ctx, 0.2, 0.22, 0.58, 0.5, 0, 9, alt ? '#7d5431' : COL.wood);
      // mono-pitch plank roof
      poly(ctx, [P(0.16, 0.18, 12), P(0.82, 0.18, 12), P(0.82, 0.76, 8), P(0.16, 0.76, 8)], alt ? '#8a6a44' : '#9b7446', '#5a3c22', 0.6);
      const sn = roofSnowAmount();
      if (sn > 0) {
        // Snow on the planks, from the high edge down (deeper snow reaches further).
        const f = Math.min(1, 0.2 + 0.95 * sn);
        poly(ctx, [P(0.16, 0.18, 12), P(0.82, 0.18, 12), P(0.82, 0.18 + 0.58 * f, 12 - 4 * f), P(0.16, 0.18 + 0.58 * f, 12 - 4 * f)], SNOW);
      }
      door(ctx, 'left', 0.2, 0.22, 0.78, 0.72, 0, 0.35, '#3d2a1a', 0.14, 6);
      if (alt) {
        fence(ctx, 0.35, 0.3, '#8a6a44');
      } else {
        // wood pile
        const [wx, wy] = P(0.82, 0.84);
        ctx.fillStyle = '#6e4a2a';
        ctx.fillRect(wx - 3, wy - 3, 6, 3);
        ctx.fillStyle = '#8a6040';
        ctx.fillRect(wx - 3, wy - 3, 6, 0.8);
      }
      return;
    }
    case 4: {
      // Hut
      quad(ctx, 0.08, 0.08, 0.92, 0.92, 0, '#a59067');
      box(ctx, 0.18, 0.2, 0.64, 0.6, 0, 10, alt ? '#bfa276' : COL.mud);
      hipRoof(ctx, 0.18, 0.2, 0.64, 0.6, 10, 9, alt ? '#b8954c' : COL.thatch);
      door(ctx, 'left', 0.18, 0.2, 0.82, 0.8, 0, 0.5, DOORS[pal], 0.14, 6);
      if (alt) {
        // a small vegetable patch
        quad(ctx, 0.62, 0.84, 0.9, 0.95, 0, '#6d5638');
        for (let k = 0; k < 3; k++) { const [x, y] = P(0.66 + k * 0.1, 0.9); ctx.fillStyle = '#5f9a48'; ctx.fillRect(x - 1, y - 1.6, 2, 1.6); }
      } else {
        jar(ctx, 0.84, 0.62);
      }
      return;
    }
    case 5: {
      // Cottage
      quad(ctx, 0.06, 0.06, 0.94, 0.94, 0, '#b3a27a');
      box(ctx, 0.16, 0.16, 0.68, 0.66, 0, 12, wall);
      gableRoof(ctx, 0.16, 0.16, 0.68, 0.66, 12, 9, ROOFS[pal], variant % 2 ? 'u' : 'v');
      if (alt) box(ctx, 0.62, 0.3, 0.1, 0.1, 16, 8, COL.stoneDark); // chimney, rising out of the roof
      door(ctx, 'left', 0.16, 0.16, 0.84, 0.82, 0, 0.3, DOORS[pal]);
      windows(ctx, 'right', 0.16, 0.16, 0.84, 0.82, 0, 1, 2, '#4a3a2a', { z: 5, h: 3.5, shutters: alt ? SHUTTERS[pal] : null });
      if (!alt) jar(ctx, 0.9, 0.55, '#c7643e');
      return;
    }
    case 6: {
      // Stone Cottage: dressed stone walls, a tiled roof, a chimney and a
      // walled herb garden (or a fruit tree).
      quad(ctx, 0.05, 0.05, 0.95, 0.95, 0, '#b5a77f');
      const stone = alt ? '#b9ae98' : COL.stone;
      box(ctx, 0.14, 0.14, 0.62, 0.6, 0, 14, stone);
      gableRoof(ctx, 0.14, 0.14, 0.62, 0.6, 14, 9, ROOFS[pal], variant % 2 ? 'v' : 'u');
      box(ctx, 0.56, 0.24, 0.1, 0.1, 18, 9, COL.stoneDark);
      door(ctx, 'left', 0.14, 0.14, 0.76, 0.74, 0, 0.3, DOORS[pal]);
      windows(ctx, 'right', 0.14, 0.14, 0.76, 0.74, 0, 1, 2, '#4a3a2a', { z: 5, h: 4, shutters: SHUTTERS[(pal + alt) % 4] });
      if (alt) {
        box(ctx, 0.8, 0.14, 0.06, 0.72, 0, 3, COL.stoneDark, { plain: true });
        for (let k = 0; k < 3; k++) { const [x, y] = P(0.88, 0.3 + k * 0.2); ctx.fillStyle = '#5f9a48'; ctx.fillRect(x - 1.2, y - 2, 2.4, 2); }
      } else {
        tree(ctx, 0.86, 0.84, 0.42, '#4f8a3c', '#6b4a2a', variant);
      }
      return;
    }
    case 7: {
      // Townhouse
      quad(ctx, 0.05, 0.05, 0.95, 0.95, 0, COL.paving);
      box(ctx, 0.12, 0.12, 0.76, 0.74, 0, 21, wall);
      hipRoof(ctx, 0.12, 0.12, 0.76, 0.74, 21, 9, ROOFS[alt ? (pal + 2) % 4 : 0]);
      windows(ctx, 'left', 0.12, 0.12, 0.88, 0.86, 0, 2, 3, '#4a3a2a', { z: 5, h: 4, gap: 9, flowers: alt === 1 });
      windows(ctx, 'right', 0.12, 0.12, 0.88, 0.86, 0, 2, 2, '#4a3a2a', { z: 5, h: 4, gap: 9, shutters: alt ? null : SHUTTERS[pal] });
      return;
    }
    case 8: {
      // Merchant House: a shop on the ground floor, the family above.
      quad(ctx, 0.04, 0.04, 0.96, 0.96, 0, COL.paving);
      box(ctx, 0.1, 0.1, 0.78, 0.74, 0, 24, wall);
      hipRoof(ctx, 0.1, 0.1, 0.78, 0.74, 24, 9, ROOFS[(pal + 1) % 4]);
      windows(ctx, 'left', 0.1, 0.1, 0.88, 0.84, 0, 1, 3, '#4a3a2a', { z: 14, h: 4, flowers: alt === 0 });
      windows(ctx, 'right', 0.1, 0.1, 0.88, 0.84, 0, 1, 2, '#4a3a2a', { z: 14, h: 4, shutters: alt ? SHUTTERS[pal] : null });
      poly(ctx, [P(0.2, 0.84, 1), P(0.72, 0.84, 1), P(0.72, 0.84, 9), P(0.2, 0.84, 9)], '#3a2c20');
      poly(ctx, [P(0.16, 0.84, 11), P(0.76, 0.84, 11), P(0.76, 0.98, 7.5), P(0.16, 0.98, 7.5)], AWNINGS[pal], shade(AWNINGS[pal], -0.4), 0.5);
      door(ctx, 'right', 0.1, 0.1, 0.88, 0.84, 0, 0.62, DOORS[pal], 0.14, 8);
      jar(ctx, 0.84, 0.93, '#c7643e');
      if (alt) jar(ctx, 0.12, 0.92, '#b8683f');
      return;
    }
    case 9: {
      // Domus: L-shaped house around a tiny courtyard
      quad(ctx, 0.04, 0.04, 0.96, 0.96, 0, COL.paving);
      box(ctx, 0.08, 0.08, 0.84, 0.36, 0, 17, wall);
      gableRoof(ctx, 0.08, 0.08, 0.84, 0.36, 17, 8, ROOFS[pal], 'u');
      if (alt) cypress(ctx, 0.3, 0.72, 0.6);
      else tree(ctx, 0.32, 0.72, 0.55, '#4f8a3c', '#6b4a2a', variant);
      box(ctx, 0.58, 0.44, 0.34, 0.48, 0, 14, shade(wall, -0.04));
      gableRoof(ctx, 0.58, 0.44, 0.34, 0.48, 14, 7, ROOFS[(pal + 1) % 4], 'v');
      windows(ctx, 'right', 0.58, 0.44, 0.92, 0.92, 0, 1, 2, '#4a3a2a', { z: 5, h: 4, shutters: alt ? SHUTTERS[pal] : null, flowers: !alt });
      door(ctx, 'left', 0.58, 0.44, 0.92, 0.92, 0, 0.5, DOORS[pal]);
      if (alt) jar(ctx, 0.5, 0.9, '#b8683f');
      return;
    }
    default: {
      // Apartment House: a narrow three-storey block with a shop below.
      const a = 0.1;
      const b = 0.9;
      const ochre = ['#d6ac6b', '#dcb77e', '#cfa262', '#e0bf88'][pal];
      quad(ctx, 0.03, 0.03, 0.97, 0.97, 0, COL.paving);
      box(ctx, a, a, b - a, b - a, 0, 32, ochre);
      hipRoof(ctx, a, a, b - a, b - a, 32, 7, COL.terra, 0.05);
      windows(ctx, 'left', a, a, b, b, 0, 2, 2, '#3f3126', { z: 13, h: 4.5, gap: 10, shutters: alt ? SHUTTERS[pal] : null });
      windows(ctx, 'right', a, a, b, b, 0, 2, 2, '#3f3126', { z: 13, h: 4.5, gap: 10, flowers: !alt });
      poly(ctx, [P(0.22, b, 2), P(0.62, b, 2), P(0.62, b, 8), P(0.22, b, 8)], '#3a2c20');
      poly(ctx, [P(0.2, b, 10), P(0.64, b, 10), P(0.64, b + 0.12, 7), P(0.2, b + 0.12, 7)], AWNINGS[(pal + 1) % 4]);
      door(ctx, 'right', a, a, b, b, 0, 0.5, DOORS[pal], 0.14, 7);
      if (alt) {
        // a wooden balcony along the right face
        ctx.strokeStyle = COL.woodDark;
        ctx.lineWidth = 0.8;
        const p = P(b + 0.06, a + 0.1, 21);
        const q = P(b + 0.06, b - 0.1, 21);
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      }
    }
  }
}

/** Tenement (4 floors, balconies) and Insula (5 floors, pink, roof garden). */
function insulaArt(ctx, S, variant, grand) {
  const floors = grand ? 5 : 4;
  const colors = grand ? ['#e2b9a1', '#e8c4a8', '#dcae96', '#e9cdb4'] : ['#d6ac6b', '#dcb77e', '#cfa262', '#e0bf88'];
  const wall = colors[variant % 4];
  const h = floors * 10 + 2;
  const a = 0.12;
  const b = S - 0.12;
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, COL.paving);
  box(ctx, a, a, b - a, b - a, 0, h, wall);
  // roof: shallow tiled hip roof
  hipRoof(ctx, a, a, b - a, b - a, h, 7, COL.terra, 0.05);
  const cols = Math.round(S * 3);
  const alt = (variant >> 2) & 1;
  windows(ctx, 'left', a, a, b, b, 0, floors - 1, cols, '#3f3126', { z: 14, h: 4.5, gap: 10, shutters: alt ? SHUTTERS[variant % 4] : null });
  windows(ctx, 'right', a, a, b, b, 0, floors - 1, cols, '#3f3126', { z: 14, h: 4.5, gap: 10, flowers: alt === 0 });
  if (alt) {
    // washing hung out on a line across the right face
    const z = 10 * (floors - 1) + 9;
    const p = P(b + 0.08, a + 0.15, z);
    const q = P(b + 0.08, b - 0.15, z);
    ctx.strokeStyle = '#6b5a48';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    const cloth = ['#f2eee6', '#b8573a', '#5d7fa3', '#e8d7a0'];
    for (let k = 0; k < 4; k++) {
      const t = 0.18 + k * 0.2;
      const x = p[0] + (q[0] - p[0]) * t;
      const y = p[1] + (q[1] - p[1]) * t;
      ctx.fillStyle = cloth[(k + variant) % 4];
      ctx.fillRect(x - 1.2, y, 2.4, 2.6 + (k % 2));
    }
  }
  // ground floor shops with awnings
  for (let k = 0; k < cols; k++) {
    const t0 = (k + 0.15) / cols;
    const t1 = (k + 0.85) / cols;
    const u0 = a + (b - a) * t0;
    const u1 = a + (b - a) * t1;
    poly(ctx, [P(u0, b, 3), P(u1, b, 3), P(u1, b, 8), P(u0, b, 8)], '#3a2c20');
    poly(ctx, [P(u0, b, 10), P(u1, b, 10), P(u1, b + 0.12, 7), P(u0, b + 0.12, 7)], AWNINGS[(k + variant) % 4]);
  }
  // wooden balconies along the right face
  ctx.strokeStyle = COL.woodDark;
  ctx.lineWidth = 0.8;
  for (let f = 1; f < floors - 1; f++) {
    const z = 10 * f + 11;
    const p = P(b + 0.06, a + 0.1, z);
    const q = P(b + 0.06, b - 0.1, z);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  }
  if (grand) {
    // roof garden
    for (let k = 0; k < 3; k++) {
      const [x, y] = P(a + 0.4 + k * 0.35, a + 0.35 + (k % 2) * 0.3, h + 3);
      ctx.fillStyle = k % 2 ? '#4f8a3c' : '#5f9a48';
      ctx.beginPath(); ctx.arc(x, y - 2, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/**
 * Villas around a courtyard with a pool. `grade` 0-1 are the 2x2 Villa and
 * Garden Villa, 2-5 the 3x3 Peristyle Villa, Marble Villa, Mansion and
 * Palatium: marble walls from grade 3, taller halls, more columns, gold
 * accents from grade 4 and a dome on the Palatium.
 */
function villaArt(ctx, S, variant, grade) {
  const small = S < 3;
  const marble = grade >= 3;
  const wall = marble ? COL.marble : houseWall(variant);
  const roof = grade >= 4 ? '#a8513a' : ROOFS[variant % 2 ? 2 : 0];
  const alt = (variant >> 2) & 1;
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#7fa956');
  // garden path
  quad(ctx, S * 0.52, S * 0.52, S * 0.6, S - 0.1, 0, COL.paving);
  // back wing
  const d = small ? 0.7 : 0.85;
  const wingH = small ? (grade >= 1 ? 17 : 14) : grade >= 3 ? 24 : 16;
  box(ctx, 0.12, 0.12, S - 0.24, d, 0, wingH, wall);
  gableRoof(ctx, 0.12, 0.12, S - 0.24, d, wingH, small ? 7 : 9, roof, 'u');
  // side wing
  const sideH = small ? 12 : 16;
  box(ctx, 0.12, 0.12 + d, d, S - 0.45 - d, 0, sideH, shade(wall, -0.03));
  gableRoof(ctx, 0.12, 0.12 + d, d, S - 0.45 - d, sideH, small ? 6 : 8, shade(roof, -0.05), 'v');
  // courtyard pool
  const pool = small ? 0.36 : grade >= 3 ? 0.7 : 0.5;
  const pu = S * 0.62;
  const pv = S * 0.5 + (small ? 0.25 : 0.2);
  quad(ctx, pu - pool / 2, pv - pool / 2, pu + pool / 2, pv + pool / 2, 0, '#e4dccb');
  quad(ctx, pu - pool / 2 + 0.06, pv - pool / 2 + 0.06, pu + pool / 2 - 0.06, pv + pool / 2 - 0.06, 0.5, COL.water);
  // peristyle columns along the courtyard edge
  const cu = 0.12 + d + 0.08;
  const cv = 0.12 + d + 0.05;
  colonnade(ctx, cu, cv, S - 0.15, cv, small ? 3 : grade >= 3 ? 6 : 4, 0, small ? 11 : 14, COL.marble, small ? 1.3 : 1.6);
  if (grade === 1) {
    // Garden Villa: flower beds and a fruit tree in the court
    quad(ctx, S - 0.55, 1.0, S - 0.15, 1.3, 0, '#5d8a3e');
    for (let k = 0; k < 3; k++) { const [x, y] = P(S - 0.5 + k * 0.14, 1.18); ctx.fillStyle = k % 2 ? '#d9534f' : '#f0c24a'; ctx.fillRect(x - 0.8, y - 1.6, 1.6, 1.4); }
    tree(ctx, S - 0.35, S - 0.75, 0.5, '#4f8a3c', '#6b4a2a', variant + 3);
  }
  if (alt) {
    // clipped hedges along the front and a statue in the garden
    box(ctx, 1.05, S - 0.2, S - 1.2, 0.12, 0, 4, '#4f7a3a', { top: '#5f8f46' });
    const [sx, sy] = P(S - 0.5, S - 0.55);
    ctx.fillStyle = COL.stone;
    ctx.fillRect(sx - 2.5, sy - 3, 5, 3);
    ctx.fillStyle = '#ece6d8';
    ctx.fillRect(sx - 1.2, sy - 10, 2.4, 7);
    ctx.beginPath(); ctx.arc(sx, sy - 11, 1.6, 0, Math.PI * 2); ctx.fill();
    cypress(ctx, 1.2, S - 0.35, small ? 0.6 : 0.75);
  } else {
    cypress(ctx, S - 0.3, S - 0.35, small ? 0.65 : 0.8);
    tree(ctx, 1.25, S - 0.3, small ? 0.55 : 0.7, '#4f8a3c', '#6b4a2a', variant);
  }
  if (grade === 4) {
    // Mansion: gilded finials on the gable ends of the hall
    for (const u of [0.1, S - 0.14]) {
      const [x, y] = P(u, 0.12 + d / 2, wingH + 9);
      ctx.fillStyle = COL.gold;
      ctx.fillRect(x - 1, y - 4, 2, 4);
    }
  }
  if (grade >= 5) {
    // Palatium: a dome and golden accents on the main wing
    const [x, y] = P(S * 0.5, 0.55, wingH + 8);
    ctx.fillStyle = '#e9e4d8';
    ctx.beginPath(); ctx.ellipse(x, y, 13, 7, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#d6cfbf';
    ctx.beginPath(); ctx.ellipse(x, y, 13, 3, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = COL.gold;
    ctx.fillRect(x - 1, y - 11, 2, 4);
  }
  if (grade >= 4) colonnade(ctx, 0.2, cv, 0.9, cv, 4, 0, 18, COL.marble, 1.6);
}

/**
 * Palaces (4x4): a domed hall across the back, a long wing on the left, a
 * paved court with colonnades, a fountain pool and statues. `grade` 1 (the
 * Imperial Palatium) adds gilding, a larger dome and a second fountain.
 */
function palaceArt(ctx, S, variant, grade) {
  const alt = (variant >> 2) & 1;
  const wall = COL.marble;
  const roof = grade ? '#9c4a36' : '#a8513a';
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#7fa956');
  quad(ctx, 1.15, 1.25, S - 0.2, S - 0.2, 0, COL.paving);
  // hall across the back
  const hd = 1.0;
  const hallH = grade ? 34 : 30;
  box(ctx, 0.12, 0.12, S - 0.24, hd, 0, hallH, wall);
  gableRoof(ctx, 0.12, 0.12, S - 0.24, hd, hallH, 11, roof, 'u');
  windows(ctx, 'right', 0.12, 0.12, S - 0.12, 0.12 + hd, 0, 2, 2, '#4a3a2a', { z: 8, h: 6, gap: 12 });
  // long wing on the left
  const wingH = grade ? 24 : 22;
  box(ctx, 0.12, 0.12 + hd, 0.9, S - 0.45 - hd, 0, wingH, shade(wall, -0.03));
  gableRoof(ctx, 0.12, 0.12 + hd, 0.9, S - 0.45 - hd, wingH, 9, shade(roof, -0.05), 'v');
  windows(ctx, 'left', 0.12, 0.12 + hd, 1.02, S - 0.33, 0, 1, 2, '#4a3a2a', { z: 8, h: 6 });
  // dome on the hall
  const [x, y] = P(S * 0.52, 0.62, hallH + 10);
  const r = grade ? 18 : 15;
  ctx.fillStyle = '#ece7db';
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#d6cfbf';
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.22, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = COL.gold;
  ctx.fillRect(x - 1.2, y - r * 0.55 - 5, 2.4, 5);
  if (grade) {
    ctx.fillStyle = shade(COL.gold, -0.1);
    ctx.fillRect(x - r, y - 1, r * 2, 1.6); // gilded ring at the dome's foot
  }
  // colonnades facing the court
  colonnade(ctx, 1.2, 1.2, S - 0.2, 1.2, 8, 0, 18, COL.marble, 1.7);
  colonnade(ctx, 1.1, 1.45, 1.1, S - 0.4, 5, 0, 16, COL.marble, 1.6);
  // fountain pool in the court
  const pu = S * 0.62;
  const pv = S * 0.62;
  const pool = grade ? 1.0 : 0.85;
  quad(ctx, pu - pool / 2, pv - pool / 2, pu + pool / 2, pv + pool / 2, 0, '#e4dccb');
  quad(ctx, pu - pool / 2 + 0.07, pv - pool / 2 + 0.07, pu + pool / 2 - 0.07, pv + pool / 2 - 0.07, 0.5, COL.water);
  // garden beds either side of the pool
  for (const [u0, v0, u1, v1] of [[1.45, pv - 0.3, pu - pool / 2 - 0.15, pv + 0.3], [pu - 0.3, 1.5, pu + 0.3, pv - pool / 2 - 0.15]]) {
    quad(ctx, u0, v0, u1, v1, 0, '#5d8a3e');
    for (let k = 0; k < 3; k++) {
      const [bx, by] = P(u0 + ((u1 - u0) * (k + 0.5)) / 3, v0 + ((v1 - v0) * (k + 0.5)) / 3);
      ctx.fillStyle = (k + variant) % 3 ? '#4f7a3a' : '#d9534f';
      ctx.beginPath(); ctx.arc(bx, by - 1.6, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  const [fx, fy] = P(pu, pv, 1);
  ctx.fillStyle = COL.marble;
  ctx.fillRect(fx - 1.5, fy - 7, 3, 7);
  ctx.fillStyle = grade ? COL.gold : '#d6cfbf';
  ctx.fillRect(fx - 3, fy - 8, 6, 1.6);
  // statues on the court corners and cypresses along the front
  for (const [u, v] of [[S - 0.45, 1.55], [1.5, S - 0.45]]) {
    const [sx, sy] = P(u, v);
    ctx.fillStyle = COL.stone;
    ctx.fillRect(sx - 2.5, sy - 3, 5, 3);
    ctx.fillStyle = grade ? COL.gold : '#ece6d8';
    ctx.fillRect(sx - 1.2, sy - 10, 2.4, 7);
    ctx.beginPath(); ctx.arc(sx, sy - 11, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  if (alt) {
    box(ctx, 1.3, S - 0.18, S - 1.5, 0.1, 0, 4, '#4f7a3a', { top: '#5f8f46' });
  } else {
    cypress(ctx, S - 0.3, S - 0.3, 0.85);
    cypress(ctx, 0.35, S - 0.3, 0.8);
  }
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

function wellArt(ctx) {
  quad(ctx, 0.15, 0.15, 0.85, 0.85, 0, COL.paving);
  const [x, y] = P(0.5, 0.5);
  ctx.fillStyle = shade(COL.stone, -0.2);
  ctx.beginPath(); ctx.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COL.stone;
  ctx.fillRect(x - 10, y - 5, 20, 5);
  ctx.beginPath(); ctx.ellipse(x, y - 5, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c4a66';
  ctx.beginPath(); ctx.ellipse(x, y - 5, 7, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  // wooden frame
  ctx.fillStyle = COL.woodDark;
  ctx.fillRect(x - 9, y - 17, 1.6, 12);
  ctx.fillRect(x + 7.4, y - 17, 1.6, 12);
  ctx.fillRect(x - 9, y - 18, 18, 1.6);
  ctx.fillStyle = '#8a6a44';
  ctx.fillRect(x - 1.5, y - 14, 3, 3.5);
}

function fountainArt(ctx, S, v, filled) {
  quad(ctx, 0.08, 0.08, 0.92, 0.92, 0, COL.paving);
  box(ctx, 0.2, 0.2, 0.6, 0.6, 0, 4, COL.stone);
  quad(ctx, 0.26, 0.26, 0.74, 0.74, 4.1, filled ? COL.water : '#8a7d68');
  const [x, y] = P(0.5, 0.5, 4);
  ctx.fillStyle = COL.marble;
  ctx.fillRect(x - 1.5, y - 10, 3, 10);
  ctx.beginPath(); ctx.ellipse(x, y - 10, 4, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  if (filled) {
    ctx.strokeStyle = 'rgba(200,230,255,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - 11); ctx.quadraticCurveTo(x - 5, y - 17, x - 7, y - 3);
    ctx.moveTo(x, y - 11); ctx.quadraticCurveTo(x + 5, y - 17, x + 7, y - 3);
    ctx.stroke();
  }
}

function reservoirArt(ctx, S, v, filled) {
  const h = 12;
  box(ctx, 0.1, 0.1, S - 0.2, S - 0.2, 0, h, COL.stone, { noTop: true });
  // rim
  quad(ctx, 0.1, 0.1, S - 0.1, S - 0.1, h, shade(COL.stone, 0.15));
  quad(ctx, 0.35, 0.35, S - 0.35, S - 0.35, h, filled ? '#3f86c0' : '#8a7a5e');
  if (filled) {
    ctx.strokeStyle = 'rgba(220,240,255,0.6)';
    ctx.lineWidth = 0.8;
    for (let k = 1; k < 4; k++) {
      const p = P(0.6, 0.35 + k * 0.55, h);
      const q = P(S - 0.6, 0.35 + k * 0.55, h);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
  }
  // arches along the visible faces
  ctx.fillStyle = 'rgba(40,32,24,0.55)';
  for (let k = 0; k < 3; k++) {
    const t = 0.5 + k;
    for (const face of ['left', 'right']) {
      const a = face === 'left' ? P(t - 0.25, S - 0.1, 0) : P(S - 0.1, t - 0.25, 0);
      const b2 = face === 'left' ? P(t + 0.25, S - 0.1, 0) : P(S - 0.1, t + 0.25, 0);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(a[0], a[1] - 5);
      ctx.quadraticCurveTo((a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2 - 11, b2[0], b2[1] - 5);
      ctx.lineTo(b2[0], b2[1]);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

function smallShop(ctx, wall, roof, awning, sign) {
  quad(ctx, 0.05, 0.05, 0.95, 0.95, 0, COL.paving);
  box(ctx, 0.14, 0.14, 0.72, 0.62, 0, 15, wall);
  gableRoof(ctx, 0.14, 0.14, 0.72, 0.62, 15, 8, roof, 'u');
  // awning over the door
  poly(ctx, [P(0.3, 0.76, 11), P(0.7, 0.76, 11), P(0.7, 0.92, 7), P(0.3, 0.92, 7)], awning, shade(awning, -0.4), 0.5);
  door(ctx, 'left', 0.14, 0.14, 0.86, 0.76, 0, 0.5, '#3d2a1a', 0.16, 6);
  if (sign) {
    const [x, y] = P(0.86, 0.5, 12);
    ctx.fillStyle = sign;
    ctx.fillRect(x - 1, y - 4, 4, 5);
  }
}

function barberArt(ctx) {
  smallShop(ctx, COL.white, COL.terra, '#c8a24a', '#b8573a');
  // stool + basin in front
  const [x, y] = P(0.25, 0.9);
  ctx.fillStyle = '#9a8a6a';
  ctx.fillRect(x - 2, y - 3, 4, 3);
}

function clinicArt(ctx) {
  smallShop(ctx, COL.cream, COL.terraDark, '#3f8f5a', '#3f8f5a');
  // herb pots
  for (const u of [0.2, 0.8]) {
    const [x, y] = P(u, 0.92);
    ctx.fillStyle = '#9b5a3a';
    ctx.fillRect(x - 2, y - 3, 4, 3);
    ctx.fillStyle = '#4f8a3c';
    ctx.beginPath(); ctx.arc(x, y - 5, 2.6, 0, Math.PI * 2); ctx.fill();
  }
}

/**
 * A cone of tiles on a round room (revolve, so it turns with the building),
 * the snow lying on it from the apex down as far as the depth reaches.
 */
function coneRoof(ctx, u, v, r, z0, h, color = COL.terra) {
  revolve(ctx, u, v, [[r, z0], [0.04, z0 + h]], color, { seg: 20, lines: true });
  if (roofSnowAmount() > 0) {
    const f = Math.min(1, 0.2 + roofSnowAmount() * 0.95);
    revolve(ctx, u, v, [[0.04 + (r - 0.04) * f, z0 + h - h * f], [0.04, z0 + h]], '#e2e9ef', { seg: 20 });
  }
}

/**
 * `filled`: piped water reaches it (the pool lies dry and cracked without).
 * The baths as the 3D model draws them: a Greek bathhouse of about 300 BC.
 * At the back a round room, a tholos of stuccoed tufa under a conical tiled
 * roof, and beside it the warm room under a tiled gable, both red below and
 * cream above; before them a Tuscan portico under a lean-to roof, and in
 * front the open plunge pool in its tufa rim. No dome, no vault.
 */
function bathsArt(ctx, S, v, filled) {
  const [cu, cv, r] = [0.55, 0.56, 0.42];
  quad(ctx, 0.04, 0.04, S - 0.04, S - 0.04, 0, COL.paving);
  // the tholos: a drum red to the shoulder and cream above, its cone of tiles with a flue at the apex
  revolve(ctx, cu, cv, [[r, 0], [r, 6]], COL.dado, { seg: 20 });
  revolve(ctx, cu, cv, [[r, 6], [r, 18]], COL.plaster, { seg: 20 });
  revolve(ctx, cu, cv, [[r + 0.07, 18], [r + 0.07, 19.5]], COL.tufa, { seg: 20 }); // the eave's course of tufa
  coneRoof(ctx, cu, cv, r + 0.1, 19.5, 11);
  revolve(ctx, cu, cv, [[0.07, 30.5], [0.07, 34]], COL.terraDark, { seg: 8 });
  // the warm room beside it, a high plain window under a tiled gable
  plastered(ctx, 1.0, 0.12, 0.85, 0.85, 0, 15, { dado: 5 });
  windows(ctx, 'right', 1.0, 0.12, 1.85, 0.97, 0, 1, 1, '#3a2f28', { z: 9, h: 4, w: 0.16 });
  gableRoof(ctx, 1.0, 0.12, 0.85, 0.85, 15, 8, COL.terra, 'v', 0.05);
  // the portico: plain Tuscan columns under a lean-to of tiles
  leanRoof(ctx, 0.15, 0.97, 1.85, 1.2, 'v0', 13, 10.5);
  colonnade(ctx, 0.25, 1.12, 1.75, 1.12, 5, 0, 9.5, '#dccaa4', 1.3);
  // the cold pool in its tufa rim
  quad(ctx, 0.3, 1.38, 1.7, 1.92, 0, COL.tufa);
  quad(ctx, 0.38, 1.45, 1.62, 1.85, 0.5, filled ? COL.water : '#8a7d68');
  if (!filled) {
    // a dry basin: cracks across its floor
    ctx.strokeStyle = 'rgba(70,58,44,0.6)';
    ctx.lineWidth = 0.6;
    for (const [a, b, c, d] of [[0.6, 1.55, 1.0, 1.75], [1.0, 1.5, 0.9, 1.8], [1.3, 1.6, 1.5, 1.8]]) {
      const [x1, y1] = P(a, b, 0.5);
      const [x2, y2] = P(c, d, 0.5);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }
}

function hospitalArt(ctx, S) {
  quad(ctx, 0.04, 0.04, S - 0.04, S - 0.04, 0, COL.paving);
  box(ctx, 0.12, 0.12, S - 0.24, 0.8, 0, 18, COL.white);
  gableRoof(ctx, 0.12, 0.12, S - 0.24, 0.8, 18, 8, COL.terra, 'u');
  box(ctx, 0.12, 0.92, 0.8, S - 1.04, 0, 16, COL.cream);
  gableRoof(ctx, 0.12, 0.92, 0.8, S - 1.04, 16, 7, COL.terraDark, 'v');
  quad(ctx, 1.1, 1.1, S - 0.2, S - 0.2, 0, '#86ad5e');
  box(ctx, S - 0.9, 1.1, 0.7, S - 1.3, 0, 16, COL.white);
  gableRoof(ctx, S - 0.9, 1.1, 0.7, S - 1.3, 16, 7, COL.terra, 'v');
  windows(ctx, 'left', 0.12, 0.92, 0.92, S - 0.12, 0, 1, 3, '#3f3126', { z: 6 });
  windows(ctx, 'left', S - 0.9, 1.1, S - 0.2, S - 0.2, 0, 1, 2, '#3f3126', { z: 6 });
  tree(ctx, 1.5, 2.2, 0.6, '#4f8a3c');
}

/**
 * Each god's temple looks like its god, so they can be told apart at a
 * glance, in the build menu's small icons too: a roof color of its own, the
 * god's color (GODS[g].color, which its priests wear) and emblem on the
 * pediment, and something of the god's in front.
 */
export const TEMPLE_LOOKS = {
  ceres: { roof: '#c98f3a', wall: '#efe3c4', field: GODS.ceres.color, emblem: 'wheat', front: 'baskets' },
  neptune: { roof: '#3f8f86', wall: '#e2ebe8', field: GODS.neptune.color, emblem: 'trident', front: 'pool' },
  mercury: { roof: '#b4b8c4', wall: '#e8e2d4', field: GODS.mercury.color, emblem: 'caduceus', front: 'herm' },
  mars: { roof: '#7a2a22', wall: '#dcc7b4', field: GODS.mars.color, emblem: 'shield', front: 'trophy' },
  venus: { roof: '#d9909c', wall: '#f5e8e8', field: GODS.venus.color, emblem: 'shell', front: 'roses' },
};

/**
 * Where a temple's altar stands (footprint u, v): front right, the god's
 * piece at the front left. The renderer's live flame (altarFlameOffset) and
 * the night torch (lighting.js) sit on it.
 */
export function templeAltar(S, turn = 0) {
  return turnUV(S - 0.24, S - 0.08, S, turn);
}

function templeArt(ctx, S, variant, state, key) {
  const look = TEMPLE_LOOKS[BUILDINGS[key]?.god] || TEMPLE_LOOKS.ceres;
  if (key.startsWith('temple_large_')) { largeTempleArt(ctx, S, look); return; }
  const top = 19;
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, '#d8cfbb');
  box(ctx, 0.12, 0.12, S - 0.24, S - 0.24, 0, 5, COL.stone);
  // steps at the front
  box(ctx, 0.4, S - 0.2, S - 0.8, 0.14, 0, 3, shade(COL.stone, 0.1));
  // cella
  box(ctx, 0.35, 0.25, S - 0.7, S - 0.95, 5, top, look.wall);
  door(ctx, 'left', 0.35, 0.25, S - 0.35, S - 0.7, 5, 0.5, '#5a4a3a', 0.22, 10);
  // front and side columns
  colonnade(ctx, 0.3, S - 0.3, S - 0.3, S - 0.3, 5, 5, top, COL.marble, 1.7);
  colonnade(ctx, S - 0.3, 0.3, S - 0.3, S - 0.55, 4, 5, top, COL.marble, 1.7);
  // roof with the pediment facing the viewer, in the god's colors
  gableRoof(ctx, 0.25, 0.2, S - 0.5, S - 0.4, 5 + top, 10, look.roof, 'v', 0.05);
  const z = 6 + top;
  decal(0, 1, () => { // the pediment and its emblem, on the front gable
    poly(ctx, [P(0.4, S - 0.2, z), P(S - 0.4, S - 0.2, z), P(S / 2, S - 0.2, z + 7)], look.field, shade(look.field, -0.4), 0.5);
    const [ex, ey] = P(S / 2, S - 0.2, z + 2.4);
    emblem(ctx, look.emblem, ex, ey);
  });
  // the god's piece at the front left, an altar with its fire at the front right
  frontPiece(ctx, look.front, 0.24, S - 0.1);
  altar(ctx, S - 0.24, S - 0.08); // (templeAltar: the live flame's spot)
}

/**
 * A large temple (3x3): the small temple made grand, in the same god's roof,
 * walls, emblem and piece, so the two sizes read as one god's. A walled
 * precinct with cypresses, a tall podium with a flight of steps, columns all
 * along the front and the side, a deeper pediment with the god's emblem and
 * gilded figures on its corners, the god's piece and the altar in front.
 */
function largeTempleArt(ctx, S, look) {
  const pz = 8; // podium
  const top = 27; // columns
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, '#ddd4c0'); // the precinct's paving
  // the precinct wall along the back edges, and its cypresses
  box(ctx, 0.02, 0.02, S - 0.04, 0.1, 0, 4, shade(COL.stone, 0.12), { plain: true });
  box(ctx, 0.02, 0.12, 0.1, S - 0.14, 0, 4, shade(COL.stone, 0.12), { plain: true });
  cypress(ctx, 0.24, 0.24, 0.85);
  cypress(ctx, S - 0.22, 0.24, 0.75);
  cypress(ctx, 0.24, S - 0.22, 0.75);
  // the podium, and its steps down to the front
  box(ctx, 0.45, 0.4, S - 0.85, S - 0.95, 0, pz, COL.stone);
  for (let k = 0; k < 3; k++) box(ctx, 0.8, S - 0.55 + k * 0.13, S - 1.6, 0.13, 0, pz * (3 - k) / 3, shade(COL.stone, 0.06 + k * 0.04), { plain: true });
  // the cella
  box(ctx, 0.75, 0.6, S - 1.45, S - 1.75, pz, top, look.wall);
  door(ctx, 'left', 0.75, 0.6, S - 0.7, S - 1.15, pz, 0.5, '#5a4a3a', 0.3, 15);
  // columns all along the side, then the front
  colonnade(ctx, S - 0.55, 0.55, S - 0.55, S - 1.0, 5, pz, top, COL.marble, 1.9);
  colonnade(ctx, 0.6, S - 0.7, S - 0.55, S - 0.7, 6, pz, top, COL.marble, 1.9);
  // the roof, pediment to the viewer, in the god's colors
  const z = pz + top;
  gableRoof(ctx, 0.5, 0.45, S - 0.95, S - 0.9, z, 14, look.roof, 'v', 0.06);
  const fv = S - 0.45; // the roof's front edge
  const mid = 0.5 + (S - 0.95) / 2;
  decal(0, 1, () => { // the pediment, its gilded band and the emblem, on the front gable
    poly(ctx, [P(0.56, fv, z + 1), P(S - 0.51, fv, z + 1), P(mid, fv, z + 12)], look.field, shade(look.field, -0.4), 0.6);
    ctx.strokeStyle = COL.gold;
    ctx.lineWidth = 1;
    const [b0x, b0y] = P(0.56, fv, z);
    const [b1x, b1y] = P(S - 0.51, fv, z);
    ctx.beginPath(); ctx.moveTo(b0x, b0y); ctx.lineTo(b1x, b1y); ctx.stroke();
    const [ex, ey] = P(mid, fv, z + 4.6);
    emblem(ctx, look.emblem, ex, ey);
    // gilded figures on the pediment's peak and corners
    ctx.fillStyle = COL.gold;
    for (const [u, dz, r] of [[mid, 12, 1.8], [0.56, 1, 1.3], [S - 0.51, 1, 1.3]]) {
      const [x, y] = P(u, fv, z + dz);
      ctx.fillRect(x - r / 2, y - r * 2.2, r, r * 2.2);
      ctx.beginPath(); ctx.arc(x, y - r * 2.6, r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  });
  // the god's piece at the front left, the altar with its fire at the front right
  frontPiece(ctx, look.front, 0.36, S - 0.12);
  altar(ctx, S - 0.24, S - 0.08);
}

/** A small altar with its fire. */
function altar(ctx, u, v) {
  const [x, y] = P(u, v);
  ctx.fillStyle = shade(COL.stone, 0.2);
  ctx.fillRect(x - 3, y - 4, 6, 4);
  ctx.fillStyle = '#e8903a';
  ctx.beginPath(); ctx.arc(x, y - 5.5, 1.8, 0, Math.PI * 2); ctx.fill();
}

/** A god's emblem, about 7 px tall, centered at (x, y). */
function emblem(ctx, kind, x, y) {
  ctx.lineCap = 'round';
  switch (kind) {
    case 'wheat': // Ceres: a sheaf
      ctx.strokeStyle = '#f5df8a';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (const dx of [-1.6, 0, 1.6]) { ctx.moveTo(x, y + 3); ctx.lineTo(x + dx, y - 1.5); }
      ctx.stroke();
      ctx.fillStyle = '#f5df8a';
      for (const dx of [-1.6, 0, 1.6]) { ctx.beginPath(); ctx.ellipse(x + dx, y - 2.4, 0.8, 1.4, 0, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'trident': // Neptune
      ctx.strokeStyle = '#eef3f5';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y + 3.2); ctx.lineTo(x, y - 3.2);
      ctx.moveTo(x - 2, y - 0.8); ctx.lineTo(x + 2, y - 0.8);
      ctx.moveTo(x - 2, y - 0.8); ctx.lineTo(x - 2, y - 2.8);
      ctx.moveTo(x + 2, y - 0.8); ctx.lineTo(x + 2, y - 2.8);
      ctx.stroke();
      break;
    case 'shield': // Mars
      ctx.fillStyle = '#d1a24a';
      ctx.beginPath(); ctx.arc(x, y, 2.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a5a2a';
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
      break;
    case 'caduceus': // Mercury: a winged staff
      ctx.strokeStyle = '#f0d98a';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y + 3.2); ctx.lineTo(x, y - 3);
      ctx.moveTo(x, y - 2.4); ctx.lineTo(x - 2.4, y - 3.4);
      ctx.moveTo(x, y - 2.4); ctx.lineTo(x + 2.4, y - 3.4);
      ctx.moveTo(x - 1.2, y + 2); ctx.quadraticCurveTo(x + 1.6, y + 0.8, x - 1.2, y - 0.4);
      ctx.moveTo(x + 1.2, y + 2); ctx.quadraticCurveTo(x - 1.6, y + 0.8, x + 1.2, y - 0.4);
      ctx.stroke();
      break;
    case 'shell': // Venus: a scallop shell
      ctx.fillStyle = '#fbe3ea';
      ctx.beginPath(); ctx.moveTo(x, y + 2.5); ctx.arc(x, y + 2.5, 3.6, Math.PI * 1.15, Math.PI * 1.85); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c2507a';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) { const a = Math.PI * (1.2 + k * 0.15); ctx.moveTo(x, y + 2.5); ctx.lineTo(x + Math.cos(a) * 3.4, y + 2.5 + Math.sin(a) * 3.4); }
      ctx.stroke();
      break;
    default:
      break;
  }
  ctx.lineCap = 'butt';
}

/** Something of the god's standing in front of the temple, at (u, v). */
function frontPiece(ctx, kind, u, v) {
  const [x, y] = P(u, v);
  switch (kind) {
    case 'baskets': // Ceres: baskets of the harvest
      for (const [dx, dy] of [[-3, 0], [3, 1.5]]) {
        ctx.fillStyle = '#8a6030';
        ctx.fillRect(x + dx - 2.5, y + dy - 4, 5, 4);
        ctx.fillStyle = '#e8c25a';
        ctx.beginPath(); ctx.ellipse(x + dx, y + dy - 4.5, 2.6, 1.3, 0, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'pool': { // Neptune: a basin with a dolphin
      quad(ctx, u - 0.14, v - 0.18, u + 0.16, v + 0.04, 0.5, '#d8d2c2');
      quad(ctx, u - 0.1, v - 0.14, u + 0.12, v, 1, COL.water);
      ctx.strokeStyle = '#7d8a90';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y - 3, 2.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      break;
    }
    case 'trophy': // Mars: arms of the defeated on a post
      ctx.fillStyle = COL.woodDark;
      ctx.fillRect(x - 0.5, y - 14, 1, 14);
      ctx.fillRect(x - 4, y - 11, 8, 1);
      ctx.fillStyle = '#b8903a';
      ctx.beginPath(); ctx.arc(x, y - 14.5, 2, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#a8322b';
      ctx.beginPath(); ctx.ellipse(x, y - 8, 2.4, 3.2, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'herm': // Mercury: a herm (a pillar with a head)
      ctx.fillStyle = COL.stone;
      ctx.fillRect(x - 1.5, y - 10, 3, 10);
      ctx.fillStyle = COL.marble;
      ctx.beginPath(); ctx.arc(x, y - 11.5, 1.8, 0, Math.PI * 2); ctx.fill();
      break;
    case 'roses': // Venus: rose bushes
      for (const [dx, dy] of [[-3, 0], [3, 1.5]]) {
        ctx.fillStyle = '#4f7a3a';
        ctx.beginPath(); ctx.arc(x + dx, y + dy - 2.6, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e06a8a';
        for (const [rx, ry] of [[-1, -3.4], [1.2, -2.6], [0, -1.6]]) { ctx.beginPath(); ctx.arc(x + dx + rx, y + dy + ry, 0.8, 0, Math.PI * 2); ctx.fill(); }
      }
      break;
    default:
      break;
  }
}

function oracleArt(ctx, S) {
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, '#d8cfbb');
  const [cx, cy] = P(S / 2, S / 2);
  // round platform
  ctx.fillStyle = COL.stone;
  ctx.beginPath(); ctx.ellipse(cx, cy, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(COL.stone, 0.15);
  ctx.beginPath(); ctx.ellipse(cx, cy - 4, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
  // ring of columns (back half first)
  const cols = [];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    cols.push([Math.cos(a) * 20, Math.sin(a) * 10]);
  }
  cols.sort((a, b) => a[1] - b[1]);
  for (const [dx, dy] of cols) {
    ctx.fillStyle = dy > 0 ? COL.marble : shade(COL.marble, -0.12);
    ctx.fillRect(cx + dx - 1.6, cy - 4 + dy - 22, 3.2, 22);
  }
  // conical roof
  ctx.fillStyle = COL.terra;
  ctx.beginPath();
  ctx.moveTo(cx - 25, cy - 26);
  ctx.lineTo(cx, cy - 44);
  ctx.lineTo(cx + 25, cy - 26);
  ctx.ellipse(cx, cy - 26, 25, 7, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = COL.gold;
  ctx.fillRect(cx - 1, cy - 48, 2, 5);
}

function schoolArt(ctx, S) {
  quad(ctx, 0.04, 0.04, S - 0.04, S - 0.04, 0, '#b7a377');
  box(ctx, 0.12, 0.12, S - 0.24, 0.9, 0, 16, COL.cream);
  gableRoof(ctx, 0.12, 0.12, S - 0.24, 0.9, 16, 9, COL.slate, 'u');
  windows(ctx, 'left', 0.12, 0.12, S - 0.12, 1.02, 0, 1, 4, '#3f3126', { z: 6 });
  tree(ctx, 0.5, 1.55, 0.7, '#4f8a3c');
  // benches in the yard
  for (const u of [1.1, 1.5]) {
    const [x, y] = P(u, 1.5);
    ctx.fillStyle = COL.wood;
    ctx.fillRect(x - 5, y - 2.5, 10, 2);
  }
}

function libraryArt(ctx, S) {
  quad(ctx, 0.04, 0.04, S - 0.04, S - 0.04, 0, '#d8cfbb');
  box(ctx, 0.12, 0.12, S - 0.24, S - 0.24, 0, 4, COL.stone);
  box(ctx, 0.2, 0.2, S - 0.4, S - 0.75, 4, 22, COL.marble);
  colonnade(ctx, 0.22, S - 0.3, S - 0.22, S - 0.3, 6, 4, 22, COL.marble, 1.5);
  gableRoof(ctx, 0.16, 0.16, S - 0.32, S - 0.36, 26, 8, COL.terraDark, 'u', 0.04);
  // scroll racks visible through the portico
  for (let k = 0; k < 4; k++) {
    const [x, y] = P(0.5 + k * 0.3, S - 0.55, 12);
    ctx.fillStyle = '#e8d9a8';
    ctx.fillRect(x - 2, y - 2, 4, 2);
  }
}

function academyArt(ctx, S) {
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#d8cfbb');
  box(ctx, 0.12, 0.12, S - 0.24, 0.95, 0, 24, COL.marble);
  gableRoof(ctx, 0.12, 0.12, S - 0.24, 0.95, 24, 9, COL.terra, 'u');
  box(ctx, 0.12, 1.07, 0.9, S - 1.2, 0, 20, shade(COL.marble, -0.04));
  gableRoof(ctx, 0.12, 1.07, 0.9, S - 1.2, 20, 8, COL.terraDark, 'v');
  quad(ctx, 1.15, 1.15, S - 0.15, S - 0.15, 0, '#8fb465');
  colonnade(ctx, 1.1, 1.1, S - 0.1, 1.1, 5, 0, 16, COL.marble, 1.5);
  colonnade(ctx, 1.1, 1.3, 1.1, S - 0.15, 4, 0, 16, COL.marble, 1.5);
  cypress(ctx, S - 0.4, S - 0.4, 0.8);
  // statue of a thinker
  const [x, y] = P(1.95, 1.95);
  ctx.fillStyle = COL.stone;
  ctx.fillRect(x - 3, y - 4, 6, 4);
  ctx.fillStyle = '#e9e4d8';
  ctx.fillRect(x - 1.5, y - 12, 3, 8);
  ctx.beginPath(); ctx.arc(x, y - 13, 2, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------------------
// Entertainment
// ---------------------------------------------------------------------------

/** The theater's bowl: its centre (u, v) and each row's radius (tiles), as liveArt.js seats its crowd. */
export const THEATER_BOWL = (S) => [S * 0.45 + 0.12, S * 0.45 + 0.12];
export const THEATER_ROW_R = (k) => (28 - k * 4) / 45.25;

/**
 * Points of a level circle's arc in the footprint (centre u, v, radius r
 * tiles, height z): angles from a0 to a1, the back half by default (on the
 * screen a circle of r tiles is an ellipse 45 r px across and half as tall).
 */
function bowlArc(u, v, r, z, a0 = Math.PI * 0.7, a1 = Math.PI * 1.8, n = 18) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    out.push(P(u + Math.cos(a) * r, v + Math.sin(a) * r, z));
  }
  return out;
}

function theaterArt(ctx, S) {
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, '#cbbf9f');
  // stepped seating: a half bowl at the back, open toward the stage (drawn
  // through footprint points, so it turns with the stage)
  const [cu, cv] = THEATER_BOWL(S);
  for (let k = 0; k < 5; k++) {
    const pts = bowlArc(cu, cv, THEATER_ROW_R(k), 2.5 * k);
    pts.push(P(cu, cv, 2.5 * k));
    poly(ctx, pts, k % 2 ? '#d9cdb0' : '#cbbd9c');
  }
  poly(ctx, bowlArc(cu + 0.03, cv + 0.03, 0.2, 0, 0, Math.PI * 2), '#b8a582'); // the orchestra
  // stage building in front
  box(ctx, 0.35, S - 0.55, S - 0.7, 0.3, 0, 14, COL.cream);
  colonnade(ctx, 0.45, S - 0.22, S - 0.45, S - 0.22, 5, 0, 10, COL.marble, 1.2);
  // banners
  const [bx, by] = P(0.4, S - 0.55, 14);
  ctx.fillStyle = '#b8573a';
  ctx.fillRect(bx - 1, by - 9, 5, 7);
}

function arenaArt(ctx, S, levels, rxF, ryF) {
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, '#cbbf9f');
  const [cx, cy] = P(S / 2, S / 2);
  const rx = S * 28 * rxF;
  const ry = S * 14 * ryF;
  const h = levels * 11;
  // outer wall (back half, then arena, then front half)
  ctx.fillStyle = shade(COL.stone, 0.1);
  ctx.beginPath(); ctx.ellipse(cx, cy - h, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  // seating ring
  ctx.fillStyle = '#c9bb9a';
  ctx.beginPath(); ctx.ellipse(cx, cy - h + 1, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  for (let k = 1; k < 4; k++) {
    ctx.strokeStyle = 'rgba(120,100,70,0.5)';
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.ellipse(cx, cy - h + 1 + k * 2, rx * (0.9 - k * 0.08), ry * (0.9 - k * 0.08), 0, 0, Math.PI * 2); ctx.stroke();
  }
  // sand floor
  ctx.fillStyle = COL.sand;
  ctx.beginPath(); ctx.ellipse(cx, cy - 2, rx * 0.5, ry * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  // front wall with arches
  ctx.fillStyle = COL.stone;
  ctx.beginPath();
  ctx.ellipse(cx, cy - h, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, cy);
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(50,40,30,0.55)';
  const arches = Math.round(10 * S / 3);
  for (let lv = 0; lv < levels; lv++) {
    for (let k = 1; k < arches; k++) {
      const a = Math.PI * (k / arches);
      const ax = cx + Math.cos(a) * rx * 0.98;
      const ay = cy + Math.sin(a) * ry * 0.98 - lv * 11 - 2;
      ctx.beginPath();
      ctx.moveTo(ax - 2, ay);
      ctx.lineTo(ax - 2, ay - 5);
      ctx.arc(ax, ay - 5, 2, Math.PI, 0);
      ctx.lineTo(ax + 2, ay);
      ctx.fill();
    }
  }
}

// An ellipse fits the footprint's diamond only up to about 0.81 of these
// sizes (it touches the diamond's edges on the diagonals at 1 / sqrt 2 of
// its half-axes): at 0.9 and 0.92 the arenas spilled past their square
// (playtest). 0.78 leaves a rim of ground inside it.
function amphitheaterArt(ctx, S) { arenaArt(ctx, S, 2, 0.78, 0.78); }
/**
 * The Great Arena as the 3D model draws it: the earliest amphitheatre, an
 * earth bank round a pit (Pompeii's, about 70 BC), with no arcades. The bank
 * is held outside by a low rubble wall with a row of blind arches at its
 * foot and tufa buttresses; two double staircases climb the outside to the
 * top (two flights meeting at a landing); the top tier is timber seats
 * behind a rail, with the masts of the awning round the rim; the arena's
 * sand lies in the middle, a portal at each end. Drawn about its middle
 * (round, the same from every side), seated in the ring the crowd fills
 * (liveArt.js crowdSeats).
 */
function colosseumArt(ctx, S, variant, state, key) {
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, '#cbbf9f');
  const [cx, cy] = P(S / 2, S / 2);
  const rx = S * 28 * 0.78;
  const ry = S * 14 * 0.78;
  const wallH = 15; // the retaining wall, about 3 m
  const h = 33; // the crest of the bank, where the timber seats begin
  const rubble = '#b3a382';
  const ell = (y, f, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.ellipse(cx, y, rx * f, ry * f, 0, 0, Math.PI * 2); ctx.fill();
  };
  // the wall's coping ledge, then the bank of turfed earth sloping up to its crest
  ell(cy - wallH, 1, COL.tufa);
  ell(cy - wallH, 0.975, '#8f8c58');
  ell(cy - h, 0.93, '#8f8c58');
  // the slope's faint rain-washed streaks, facing the viewer
  ctx.strokeStyle = 'rgba(70,64,34,0.35)';
  ctx.lineWidth = 0.7;
  for (let k = 1; k < 18; k++) {
    const a = (Math.PI * k) / 18;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rx * 0.96, cy - wallH + Math.sin(a) * ry * 0.96);
    ctx.lineTo(cx + Math.cos(a) * rx * 0.93, cy - h + Math.sin(a) * ry * 0.93);
    ctx.stroke();
  }
  // the retaining wall's front: rubble between tufa buttresses, the blind arches at its foot, the portals at the ends
  ctx.fillStyle = rubble;
  ctx.beginPath();
  ctx.ellipse(cx, cy - wallH, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, cy);
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  const bays = Math.round(10 * S / 3);
  for (let k = 1; k < bays; k++) {
    const a = Math.PI * (k / bays);
    const ax = cx + Math.cos(a) * rx * 0.985;
    const ay = cy + Math.sin(a) * ry * 0.985;
    if (k % 3 === 0) {
      // a buttress of tufa the full height of the wall
      ctx.fillStyle = COL.tufa;
      ctx.fillRect(ax - 1.8, ay - wallH, 3.6, wallH);
    } else {
      ctx.fillStyle = 'rgba(50,40,30,0.5)';
      ctx.beginPath();
      ctx.moveTo(ax - 2, ay - 1);
      ctx.lineTo(ax - 2, ay - 5);
      ctx.arc(ax, ay - 5, 2, Math.PI, 0);
      ctx.lineTo(ax + 2, ay - 1);
      ctx.fill();
    }
  }
  for (const sx of [-1, 1]) {
    // a portal at each end of the long axis, between wing walls that step down
    const px = cx + sx * rx * 0.99;
    ctx.fillStyle = COL.tufa;
    ctx.fillRect(px - 6, cy - 12, 12, 12);
    ctx.fillStyle = 'rgba(40,30,22,0.85)';
    ctx.beginPath();
    ctx.moveTo(px - 3.5, cy);
    ctx.lineTo(px - 3.5, cy - 7);
    ctx.arc(px, cy - 7, 3.5, Math.PI, 0);
    ctx.lineTo(px + 3.5, cy);
    ctx.fill();
  }
  // the two double staircases up the outside: two flights meet at a landing on the wall's top, one flight goes on to the crest
  for (const a of [Math.PI * 0.3, Math.PI * 0.7]) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const bx = cx + c * (rx + 5);
    const by = cy + s * (ry + 2.5);
    const lx = cx + c * rx * 0.99;
    const ly = cy - wallH + s * ry * 0.99;
    const tx = cx + c * rx * 0.93;
    const ty = cy - h + s * ry * 0.93;
    const flight = (pts) => {
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.fillStyle = '#cdbf9d'; ctx.fill();
      ctx.strokeStyle = 'rgba(110,96,70,0.7)'; ctx.lineWidth = 0.5; ctx.stroke();
    };
    flight([[bx - 15, by], [bx - 9, by], [lx - 1.5, ly], [lx - 5, ly]]); // the two lower flights
    flight([[bx + 9, by], [bx + 15, by], [lx + 5, ly], [lx + 1.5, ly]]);
    flight([[lx - 4, ly], [lx + 4, ly], [tx + 3, ty], [tx - 3, ty]]); // the upper one
    ctx.strokeStyle = 'rgba(110,96,70,0.6)';
    ctx.lineWidth = 0.5;
    for (let k = 1; k < 6; k++) {
      const t = k / 6;
      const yy = ly + (ty - ly) * t;
      const xx = lx + (tx - lx) * t;
      ctx.beginPath(); ctx.moveTo(xx - 4 + t, yy); ctx.lineTo(xx + 4 - t, yy); ctx.stroke();
    }
  }
  // the top tier: timber seats in rows stepping down toward the sand, under snow white
  const snowy = roofSnowAmount() > 0.3;
  for (let k = 0; k < 5; k++) {
    ctx.fillStyle = snowy ? (k % 2 ? '#dfe6ea' : '#eaeff2') : k % 2 ? '#a58154' : '#b08c5c';
    ctx.beginPath(); ctx.ellipse(cx, cy - h + 1 + k * 2, rx * (0.9 - k * 0.08), ry * (0.9 - k * 0.08), 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(70,48,26,0.55)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  // the sand, its podium wall painted in panels
  ell(cy - 2, 0.5, '#c9b88a');
  ell(cy - 2, 0.46, COL.sand);
  // the rail along the rim's front, and the masts of the awning round it
  ctx.strokeStyle = COL.woodDark;
  ctx.lineWidth = 0.8;
  const masts = 14;
  for (let k = 0; k < masts; k++) {
    const a = (Math.PI * 2 * (k + 0.5)) / masts;
    const mx = cx + Math.cos(a) * rx * 0.92;
    const my = cy - h + Math.sin(a) * ry * 0.92;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, my - 12); ctx.stroke();
  }
  ctx.strokeStyle = '#6e4a28';
  ctx.beginPath(); ctx.ellipse(cx, cy - h - 3, rx * 0.92, ry * 0.92, 0, 0.05, Math.PI - 0.05); ctx.stroke();
  flagPoles(ctx, key, S); // flags on the masts
}

function actorTroupeArt(ctx, S) {
  quad(ctx, 0.04, 0.04, S - 0.04, S - 0.04, 0, COL.paving);
  box(ctx, 0.12, 0.12, S - 0.24, 1.1, 0, 18, '#e3cfa8');
  gableRoof(ctx, 0.12, 0.12, S - 0.24, 1.1, 18, 9, COL.terra, 'u');
  // colorful drapes and masks
  const colors = ['#b8573a', '#d9a13a', '#5d7fa3', '#7a9c5a'];
  for (let k = 0; k < 4; k++) {
    const u = 0.3 + k * 0.4;
    poly(ctx, [P(u, 1.22, 14), P(u + 0.25, 1.22, 14), P(u + 0.25, 1.22, 5), P(u, 1.22, 5)], colors[k]);
  }
  const [x, y] = P(1.2, 1.7);
  ctx.fillStyle = '#f2eee6';
  ctx.beginPath(); ctx.arc(x, y - 6, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.fillRect(x - 2, y - 7, 1.2, 1.2);
  ctx.fillRect(x + 0.8, y - 7, 1.2, 1.2);
}

function gladiatorSchoolArt(ctx, S) {
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, COL.sand);
  box(ctx, 0.1, 0.1, S - 0.2, 0.7, 0, 16, '#cdb994');
  gableRoof(ctx, 0.1, 0.1, S - 0.2, 0.7, 16, 7, COL.terraDark, 'u');
  box(ctx, 0.1, 0.8, 0.7, S - 0.9, 0, 14, '#c4af88');
  gableRoof(ctx, 0.1, 0.8, 0.7, S - 0.9, 14, 6, COL.terra, 'v');
  // training posts
  for (const [u, v] of [[1.4, 1.4], [2.2, 1.6], [1.8, 2.3]]) {
    const [x, y] = P(u, v);
    ctx.fillStyle = COL.woodDark;
    ctx.fillRect(x - 1, y - 10, 2, 10);
    ctx.fillRect(x - 4, y - 8, 8, 1.4);
  }
  // fence
  ctx.strokeStyle = COL.wood;
  ctx.lineWidth = 0.8;
  const p1 = P(0.9, S - 0.1, 4);
  const p2 = P(S - 0.1, S - 0.1, 4);
  const p3 = P(S - 0.1, 0.9, 4);
  ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.stroke();
}

function menagerieArt(ctx, S) {
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#a99a6e');
  box(ctx, 0.1, 0.1, S - 0.2, 0.8, 0, 14, '#c8b48c');
  gableRoof(ctx, 0.1, 0.1, S - 0.2, 0.8, 14, 7, COL.terraDark, 'u');
  // cages with bars
  for (const [u, v] of [[0.3, 1.2], [1.3, 1.2], [0.3, 2.1], [1.3, 2.1]]) {
    box(ctx, u, v, 0.8, 0.7, 0, 10, '#7a6a52', { top: '#8f7d62' });
    ctx.strokeStyle = '#3a3026';
    ctx.lineWidth = 0.8;
    for (let k = 1; k < 6; k++) {
      const p = P(u + (k / 6) * 0.8, v + 0.7, 0);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 10); ctx.stroke();
    }
    const [x, y] = P(u + 0.45, v + 0.4);
    ctx.fillStyle = '#c9923a';
    ctx.beginPath(); ctx.ellipse(x, y - 3, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Government & decor
// ---------------------------------------------------------------------------

function forumArt(ctx, S) {
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, '#ddd4c2');
  quad(ctx, 0.5, 0.5, S - 0.2, S - 0.2, 0.2, '#e8e1d2');
  box(ctx, 0.1, 0.1, S - 0.2, 0.45, 0, 18, COL.marble);
  gableRoof(ctx, 0.1, 0.1, S - 0.2, 0.45, 18, 7, COL.terra, 'u');
  colonnade(ctx, 0.2, 0.62, S - 0.2, 0.62, 5, 0, 15, COL.marble, 1.4);
  colonnade(ctx, 0.3, 0.8, 0.3, S - 0.2, 4, 0, 15, COL.marble, 1.4);
  // speaker's platform with a flag
  box(ctx, 1.1, 1.1, 0.5, 0.4, 0, 4, COL.stone);
  flagPoles(ctx, 'forum', S);
}

/**
 * A wall of plastered tufa in the Republic's first style: a red dado below,
 * cream plaster above (the stucco of Pompeii's oldest houses, and the
 * council halls and bath rooms the 3D models copy). Both parts are one
 * footprint, so a turned drawing keeps them together. o: dado (px, default
 * 30% of the wall), wall (the plaster's colour).
 */
function plastered(ctx, u0, v0, du, dv, z0, h, o = {}) {
  const dado = o.dado ?? Math.min(7, h * 0.3);
  // (no top on the dado: the plaster stands on it, and a top drawn late would show over the plaster)
  box(ctx, u0, v0, du, dv, z0, dado, COL.dado, { plain: true, noTop: true });
  box(ctx, u0, v0, du, dv, z0 + dado, h - dado, o.wall ?? COL.plaster);
}

/**
 * A tiled roof that falls one way (a lean-to): the rectangle u0..u1 x v0..v1
 * rising to height zHigh along its `high` edge ('u0', 'u1', 'v0' or 'v1')
 * and falling to zLow along the opposite one, with rows of tiles and the
 * snow that settles on it. Painted as one polygon, so the turned drawing
 * sorts it like any wall.
 */
function leanRoof(ctx, u0, v0, u1, v1, high, zHigh, zLow, color = COL.terra) {
  const z = (u, v) => {
    // 0 at the high edge, 1 at the low one
    const t = high === 'u0' ? (u - u0) / (u1 - u0) : high === 'u1' ? (u1 - u) / (u1 - u0) : high === 'v0' ? (v - v0) / (v1 - v0) : (v1 - v) / (v1 - v0);
    return zHigh + (zLow - zHigh) * t;
  };
  const corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  poly(ctx, corners.map(([u, v]) => P(u, v, z(u, v))), color, shade(color, -0.5), 0.6);
  // rows of tiles running along the high edge, in a darker tone of the roof
  const rows = 4;
  const along = high === 'u0' || high === 'u1';
  ctx.strokeStyle = shade(color, -0.22);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let k = 1; k < rows; k++) {
    const t = k / rows;
    const a = along ? [high === 'u0' ? u0 + (u1 - u0) * t : u1 - (u1 - u0) * t, v0] : [u0, high === 'v0' ? v0 + (v1 - v0) * t : v1 - (v1 - v0) * t];
    const b = along ? [a[0], v1] : [u1, a[1]];
    const p = P(a[0], a[1], z(a[0], a[1]));
    const q = P(b[0], b[1], z(b[0], b[1]));
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
  if (roofSnowAmount() > 0) {
    // snow from the high edge down, as far as the depth reaches
    const f = Math.min(1, 0.2 + roofSnowAmount() * 0.95);
    const cut = (u, v, t) => {
      // the point at fraction t down from the high edge, on the polygon's side
      const uu = along ? (high === 'u0' ? u0 + (u1 - u0) * t : u1 - (u1 - u0) * t) : u;
      const vv = along ? v : (high === 'v0' ? v0 + (v1 - v0) * t : v1 - (v1 - v0) * t);
      return P(uu, vv, z(uu, vv));
    };
    const hi = along ? [[high === 'u0' ? u0 : u1, v0], [high === 'u0' ? u0 : u1, v1]] : [[u0, high === 'v0' ? v0 : v1], [u1, high === 'v0' ? v0 : v1]];
    poly(ctx, [P(hi[0][0], hi[0][1], zHigh), P(hi[1][0], hi[1][1], zHigh), cut(hi[1][0], hi[1][1], f), cut(hi[0][0], hi[0][1], f)], '#e2e9ef');
  }
}

/**
 * The curia as a colony of about 300 BC built one (the 3D model's design): a
 * low hall of plastered tufa on a tufa podium, red below and cream above,
 * with a porch of four plain Tuscan columns under the hall's one low gable
 * of tiles, a timber architrave in terracotta red, a disc acroterion at the
 * ridge, and steps up to it. No dome, no marble, no brick.
 */
function senateArt(ctx, S) {
  const col = '#dfd1b1'; // the columns' plastered tufa
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, '#d3c8aa');
  // the podium of tufa, its three steps at the front
  box(ctx, 0.35, 0.35, S - 0.7, S - 0.95, 0, 6, COL.tufa);
  box(ctx, 1.1, S - 0.6, S - 2.2, 0.15, 0, 4.2, COL.tufa, { plain: true });
  box(ctx, 1.1, S - 0.45, S - 2.2, 0.15, 0, 2.8, COL.tufa, { plain: true });
  box(ctx, 1.1, S - 0.3, S - 2.2, 0.15, 0, 1.4, COL.tufa, { plain: true });
  // the hall: plastered, no windows (a hall took its light from its door and its roof), bare tufa quoins at the front corners
  plastered(ctx, 0.8, 0.55, S - 1.6, 2.05, 6, 30, { dado: 7 });
  box(ctx, 0.78, 2.5, 0.14, 0.12, 6, 30, COL.tufa, { plain: true });
  box(ctx, S - 0.92, 2.5, 0.14, 0.12, 6, 30, COL.tufa, { plain: true });
  door(ctx, 'left', 0.8, 0.55, S - 0.8, 2.6, 6, 0.5, '#4a3222', 0.3, 17);
  // the porch: four Tuscan columns under a timber architrave painted with terracotta plaques
  colonnade(ctx, 1.1, S - 0.75, S - 1.1, S - 0.75, 4, 6, 25, col, 2.5);
  box(ctx, 0.95, S - 0.88, S - 1.9, 0.26, 31, 5, '#9a4a32', { plain: true });
  // the one low gable over hall and porch, its front a pediment of plaster
  const z = 36;
  const rh = 13;
  gableRoof(ctx, 0.6, 0.4, S - 1.2, S - 1.0, z, rh, COL.terra, 'v', 0.05);
  const d = S - 0.55; // the roof's front edge, v
  poly(ctx, [P(0.6 - 0.05 + 0.1, d, z + 0.6), P(S - 0.6 + 0.05 - 0.1, d, z + 0.6), P(S / 2, d, z + rh - 1.4)], COL.plaster);
  // the disc acroterion at the ridge's front end
  const [ax, ay] = P(S / 2, d - 0.06, z + rh);
  ctx.fillStyle = COL.dado;
  ctx.fillRect(ax - 0.6, ay - 4, 1.2, 4);
  ctx.fillStyle = '#c9744c';
  ctx.beginPath(); ctx.arc(ax, ay - 5.4, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = COL.dado;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  flagPoles(ctx, 'senate', S); // the purple of the council on the ridge's back end
}

// ---------------------------------------------------------------------------
// The governor's residences
// ---------------------------------------------------------------------------

/**
 * The governor's colors: warm plaster for the house, white stucco for the
 * villa, marble for the palace, with deep purple-red banners and gilding,
 * so each reads at a glance as grander than the homes around it.
 */
const GOV = Object.freeze({ plaster: '#e9d3a6', stucco: '#f3ece0', roof: '#a9472f', banner: '#7a2848', door: '#4a2a22', glass: '#3c2f2a' });

/** A small gilded ornament (an acroterion) at a gable's peak. */
function gilt(ctx, u, v, z, s = 1) {
  const [x, y] = P(u, v, z);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(x - 1.2 * s, y - 4 * s, 2.4 * s, 4 * s);
  ctx.beginPath(); ctx.arc(x, y - 4.6 * s, 1.4 * s, 0, Math.PI * 2); ctx.fill();
}

/**
 * A temple-fronted porch on the +v (front-left) face: `n` columns along
 * v = `vf` from u0 to u1, `h` px tall from z0, under a gable whose end
 * faces the viewer (a pediment), crowned with gilt.
 */
function portico(ctx, u0, u1, vb, vf, z0, h, n, roof, r = 1.7) {
  colonnade(ctx, u0 + 0.08, vf - 0.08, u1 - 0.08, vf - 0.08, n, z0, h, COL.marble, r);
  box(ctx, u0, vb, u1 - u0, vf - vb, z0 + h, 3, COL.marble, { plain: true });
  gableRoof(ctx, u0, vb, u1 - u0, vf - vb, z0 + h + 3, 7 + (u1 - u0) * 2, roof, 'v', 0.04);
  gilt(ctx, (u0 + u1) / 2, vf + 0.04, z0 + h + 3 + 7 + (u1 - u0) * 2);
}

/** A gilded figure on a pedestal (statues flanking the palace steps). */
function giltStatue(ctx, u, v, z = 0) {
  const [x, y] = P(u, v, z);
  ctx.fillStyle = COL.stone;
  ctx.fillRect(x - 3, y - 5, 6, 5);
  ctx.fillStyle = shade(COL.stone, 0.15);
  ctx.fillRect(x - 3, y - 5, 2.4, 5);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(x - 1.3, y - 13, 2.6, 8);
  ctx.beginPath(); ctx.arc(x, y - 14.4, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(COL.gold, -0.2);
  ctx.fillRect(x + 1.3, y - 15, 0.8, 9); // a staff
}

/**
 * The Governor's House (3x3): a town house round a court, the hall at the
 * back two storeys high, a wing on the left, a short colonnade on the right,
 * the rain pool in the middle of the court and, in the front wall, a gate
 * with two columns and a pediment under the governor's banners.
 */
function governorHouseArt(ctx, S, variant) {
  const wall = GOV.plaster;
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#7fa956');
  quad(ctx, 0.18, 0.18, S - 0.18, S - 0.18, 0, '#d9ccad'); // the paved court
  // the hall across the back
  box(ctx, 0.2, 0.2, S - 0.4, 0.95, 0, 24, wall);
  windows(ctx, 'right', 0.2, 0.2, S - 0.2, 1.15, 0, 2, 1, GOV.glass, { z: 5, h: 5, gap: 10, shutters: '#6b4a3a' });
  windows(ctx, 'left', 0.2, 0.2, S - 0.2, 1.15, 0, 1, 4, GOV.glass, { z: 14, h: 5 });
  door(ctx, 'left', 0.2, 0.2, S - 0.2, 1.15, 0, 0.62, GOV.door, 0.24, 9);
  gableRoof(ctx, 0.2, 0.2, S - 0.4, 0.95, 24, 9, GOV.roof, 'u');
  // the wing on the left
  box(ctx, 0.2, 1.15, 0.8, S - 1.6, 0, 15, shade(wall, -0.04));
  windows(ctx, 'right', 0.2, 1.15, 1.0, S - 0.45, 0, 1, 2, GOV.glass, { z: 5, h: 5 });
  gableRoof(ctx, 0.2, 1.15, 0.8, S - 1.6, 15, 7, shade(GOV.roof, -0.05), 'v');
  // the rain pool (impluvium), and a bay tree in a pot by it
  const pu = S * 0.6;
  const pv = S * 0.55;
  quad(ctx, pu - 0.32, pv - 0.28, pu + 0.32, pv + 0.28, 0, '#e4dccb');
  quad(ctx, pu - 0.25, pv - 0.21, pu + 0.25, pv + 0.21, 0.5, COL.water);
  jar(ctx, pu + 0.5, pv - 0.35, '#a85a3a');
  // a short colonnade along the right of the court
  colonnade(ctx, S - 0.32, 1.35, S - 0.32, S - 0.75, 3, 0, 13, COL.marble, 1.3);
  box(ctx, S - 0.42, 1.25, 0.2, S - 1.95, 13, 2, COL.marble, { plain: true });
  // the front wall, and the gate in it
  box(ctx, 0.2, S - 0.42, S - 0.4, 0.2, 0, 7, shade(wall, -0.06));
  const g0 = S * 0.42;
  const g1 = S * 0.42 + 0.9;
  door(ctx, 'left', 0.2, S - 0.42, S - 0.2, S - 0.22, 0, (g0 + g1) / 2 / S, GOV.door, 0.36, 9);
  portico(ctx, g0, g1, S - 0.5, S - 0.08, 0, 13, 2, GOV.roof, 1.5);
  if ((variant >> 2) & 1) cypress(ctx, S - 0.2, S - 0.2, 0.65);
  else tree(ctx, S - 0.22, S - 0.25, 0.5, '#4f8a3c', '#6b4a2a', variant);
  cypress(ctx, 0.25, S - 0.2, 0.6);
  flagPoles(ctx, 'governor_house', S);
}

/**
 * The Governor's Villa (4x4): a two-storey house of white stucco with a
 * tower room at its back corner, a pillared porch and pediment on its front,
 * a wing on the left, and before it a walled garden with a long pool, a
 * line of columns and cypresses.
 */
function governorVillaArt(ctx, S, variant) {
  const wall = GOV.stucco;
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#7aa452');
  quad(ctx, 1.2, 1.55, S - 0.2, S - 0.2, 0, '#8db35e'); // the garden
  quad(ctx, S * 0.5 - 0.15, 1.55, S * 0.5 + 0.15, S - 0.05, 0, COL.paving); // its path
  // the tower room at the back corner
  box(ctx, 0.25, 0.25, 0.75, 0.75, 0, 40, shade(wall, -0.03));
  windows(ctx, 'right', 0.25, 0.25, 1.0, 1.0, 0, 1, 1, GOV.glass, { z: 31, h: 5 });
  hipRoof(ctx, 0.25, 0.25, 0.75, 0.75, 40, 10, GOV.roof);
  gilt(ctx, 0.62, 0.62, 50);
  // the house across the back
  box(ctx, 1.0, 0.25, S - 1.25, 1.2, 0, 28, wall);
  windows(ctx, 'right', 1.0, 0.25, S - 0.25, 1.45, 0, 2, 2, GOV.glass, { z: 5, h: 6, gap: 12, shutters: '#4f7a52' });
  windows(ctx, 'left', 1.0, 0.25, S - 0.25, 1.45, 0, 1, 5, GOV.glass, { z: 18, h: 6, shutters: '#4f7a52' });
  gableRoof(ctx, 1.0, 0.25, S - 1.25, 1.2, 28, 10, GOV.roof, 'u');
  // the wing on the left, with a door to the garden
  box(ctx, 0.25, 1.0, 0.85, S - 1.6, 0, 18, shade(wall, -0.05));
  windows(ctx, 'right', 0.25, 1.0, 1.1, S - 0.6, 0, 1, 3, GOV.glass, { z: 6, h: 6 });
  door(ctx, 'left', 0.25, 1.0, 1.1, S - 0.6, 0, 0.5, GOV.door, 0.24, 9);
  gableRoof(ctx, 0.25, 1.0, 0.85, S - 1.6, 18, 8, shade(GOV.roof, -0.05), 'v');
  // the porch on the front of the house
  door(ctx, 'left', 1.0, 0.25, S - 0.25, 1.45, 0, 0.5, GOV.door, 0.3, 11);
  portico(ctx, S * 0.5 - 0.62, S * 0.5 + 0.62, 1.45, 1.95, 0, 20, 4, GOV.roof, 1.6);
  // the long pool, with columns along its far side
  quad(ctx, 1.3, 2.25, S * 0.5 - 0.2, S - 0.4, 0, '#e4dccb');
  quad(ctx, 1.37, 2.32, S * 0.5 - 0.27, S - 0.47, 0.5, COL.water);
  colonnade(ctx, 1.22, 2.15, 1.22, S - 0.4, 4, 0, 12, COL.marble, 1.2);
  // flower beds and a statue on the right of the path
  quad(ctx, S * 0.5 + 0.3, 2.3, S - 0.45, 2.75, 0, '#5d8a3e');
  for (let k = 0; k < 4; k++) {
    const [x, y] = P(S * 0.5 + 0.4 + k * 0.24, 2.52);
    ctx.fillStyle = (k + variant) % 2 ? '#d9534f' : '#f0c24a';
    ctx.beginPath(); ctx.arc(x, y - 1.4, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  giltStatue(ctx, S - 0.75, S - 0.9);
  // cypresses at the front
  cypress(ctx, S - 0.25, S - 0.25, 0.85);
  cypress(ctx, 1.25, S - 0.2, 0.75);
  if ((variant >> 2) & 1) cypress(ctx, S - 0.25, 1.75, 0.8);
  else tree(ctx, S - 0.3, 1.8, 0.65, '#4f8a3c', '#6b4a2a', variant);
  flagPoles(ctx, 'governor_villa', S);
}

/**
 * The Governor's Palace (5x5): marble on a raised platform. A domed hall at
 * the back with a six-columned porch and a gilded pediment, two long wings
 * with colonnades facing the court, a fountain in the court, steps down to
 * the street between gilded statues, banners on every wing.
 */
function governorPalaceArt(ctx, S, variant) {
  const wall = COL.marble;
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#7fa956');
  quad(ctx, 1.2, S - 1.05, S - 1.2, S - 0.05, 0, COL.paving); // the forecourt
  // the platform
  box(ctx, 0.25, 0.25, S - 0.5, S - 1.25, 0, 6, COL.stone);
  quad(ctx, 0.3, 0.3, S - 0.3, S - 1.05, 6, '#e3dccd');
  // the left wing
  box(ctx, 0.35, 0.35, 0.95, S - 1.55, 6, 22, shade(wall, -0.04));
  windows(ctx, 'right', 0.35, 0.35, 1.3, S - 1.2, 6, 1, 4, GOV.glass, { z: 14, h: 6 });
  gableRoof(ctx, 0.35, 0.35, 0.95, S - 1.55, 28, 8, shade(GOV.roof, -0.05), 'v');
  colonnade(ctx, 1.45, 2.0, 1.45, S - 1.35, 4, 6, 18, COL.marble, 1.5);
  // the hall across the back
  box(ctx, 1.3, 0.35, S - 2.6, 1.55, 6, 32, wall);
  windows(ctx, 'left', 1.3, 0.35, S - 1.3, 1.9, 6, 1, 6, GOV.glass, { z: 26, h: 6 });
  gableRoof(ctx, 1.3, 0.35, S - 2.6, 1.55, 38, 9, GOV.roof, 'u');
  // the dome over the hall: a drum, the dome, a gilded lantern
  const [dx, dy] = P(S * 0.5, 1.1, 50);
  ctx.fillStyle = shade(wall, -0.08);
  ctx.fillRect(dx - 22, dy - 8, 44, 10);
  ctx.fillStyle = '#ece7db';
  ctx.beginPath(); ctx.ellipse(dx, dy - 8, 24, 21, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(dx - 8, dy - 16, 7, 11, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#bdb4a3';
  ctx.lineWidth = 0.8;
  for (const k of [-0.5, 0, 0.5]) {
    ctx.beginPath(); ctx.ellipse(dx, dy - 8, 24 * Math.abs(k) + 0.1, 21, 0, Math.PI, 0); ctx.stroke();
  }
  ctx.fillStyle = shade(COL.gold, -0.1);
  ctx.fillRect(dx - 24, dy - 9, 48, 1.8); // gilded ring at the dome's foot
  ctx.fillStyle = COL.gold;
  ctx.fillRect(dx - 2, dy - 35, 4, 7);
  ctx.beginPath(); ctx.arc(dx, dy - 36.5, 2.2, 0, Math.PI * 2); ctx.fill();
  // the great porch before the hall
  portico(ctx, S * 0.5 - 1.05, S * 0.5 + 1.05, 1.9, 2.45, 6, 26, 6, GOV.roof, 1.9);
  // the right wing
  box(ctx, S - 1.3, 0.35, 0.95, S - 1.55, 6, 22, shade(wall, -0.04));
  windows(ctx, 'right', S - 1.3, 0.35, S - 0.35, S - 1.2, 6, 2, 4, GOV.glass, { z: 10, h: 5, gap: 9 });
  windows(ctx, 'left', S - 1.3, 0.35, S - 0.35, S - 1.2, 6, 1, 2, GOV.glass, { z: 14, h: 6 });
  gableRoof(ctx, S - 1.3, 0.35, 0.95, S - 1.55, 28, 8, shade(GOV.roof, -0.05), 'v');
  colonnade(ctx, S - 1.45, 2.0, S - 1.45, S - 1.35, 4, 6, 18, COL.marble, 1.5);
  // the fountain in the court
  const fu = S * 0.5;
  const fv = S - 1.75;
  quad(ctx, fu - 0.45, fv - 0.35, fu + 0.45, fv + 0.35, 6.5, '#e4dccb');
  quad(ctx, fu - 0.37, fv - 0.27, fu + 0.37, fv + 0.27, 7, COL.water);
  const [fx, fy] = P(fu, fv, 7);
  ctx.fillStyle = wall;
  ctx.fillRect(fx - 1.5, fy - 8, 3, 8);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(fx - 3.2, fy - 9, 6.4, 1.6);
  // steps down from the platform, between gilded statues
  box(ctx, S * 0.5 - 1.0, S - 1.0, 2.0, 0.22, 0, 4, shade(COL.stone, 0.12));
  box(ctx, S * 0.5 - 1.1, S - 0.78, 2.2, 0.22, 0, 2, shade(COL.stone, 0.18));
  giltStatue(ctx, S * 0.5 - 1.35, S - 0.75);
  giltStatue(ctx, S * 0.5 + 1.35, S - 0.75);
  // cypresses at the front corners, beds of flowers between them
  for (const [u, v] of [[0.3, S - 0.3], [S - 0.3, S - 0.3], [S - 0.3, S - 1.4]]) cypress(ctx, u, v, 0.9);
  for (let k = 0; k < 5; k++) {
    const [x, y] = P(0.55 + k * 0.12, S - 0.55 + (k % 2) * 0.12);
    ctx.fillStyle = (k + variant) % 3 ? '#4f7a3a' : '#d9534f';
    ctx.beginPath(); ctx.arc(x, y - 1.5, 1.7, 0, Math.PI * 2); ctx.fill();
  }
  flagPoles(ctx, 'governor_palace', S);
}

/**
 * A garden. `state` 1: left untended (sim/gardens.js): the grass dry, the
 * hedge ragged and brown, most flowers gone and weeds come up.
 */
function gardenArt(ctx, S, variant, state) {
  const worn = state === 1;
  quad(ctx, 0.04, 0.04, S - 0.04, S - 0.04, 0, worn ? '#93954f' : '#6e9d44');
  // hedge border
  ctx.strokeStyle = worn ? '#6a6234' : '#3e6b2c';
  ctx.lineWidth = worn ? 1.4 : 2;
  const pts = [P(0.1, 0.1, 1), P(0.9, 0.1, 1), P(0.9, 0.9, 1), P(0.1, 0.9, 1)];
  ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
  // flowers (a few faded ones left untended)
  for (let k = 0; k < (worn ? 3 : 9); k++) {
    const [x, y] = P(0.2 + hash01(variant, k, 51) * 0.6, 0.2 + hash01(variant, k, 52) * 0.6);
    ctx.fillStyle = worn ? ['#b98a6a', '#c9b66a', '#cfc7b4'][k % 3] : ['#e85d5d', '#f4e27a', '#f7f2e4', '#c77dd6'][k % 4];
    ctx.beginPath(); ctx.arc(x, y - 1, 1.3, 0, Math.PI * 2); ctx.fill();
  }
  // weeds
  if (worn) {
    ctx.strokeStyle = '#7a6a3a';
    ctx.lineWidth = 0.7;
    for (let k = 0; k < 6; k++) {
      const [x, y] = P(0.18 + hash01(variant, k, 53) * 0.64, 0.18 + hash01(variant, k, 54) * 0.64);
      ctx.beginPath(); ctx.moveTo(x - 1, y); ctx.lineTo(x - 0.4, y - 2.4); ctx.moveTo(x + 1, y); ctx.lineTo(x + 0.4, y - 2.2); ctx.stroke();
    }
  }
  if (variant % 2) cypress(ctx, 0.5, 0.5, 0.75, worn ? '#4f5a2c' : undefined);
  else tree(ctx, 0.5, 0.5, 0.6, worn ? '#7a8a3c' : '#4f8a3c', '#6b4a2a', variant);
}

/**
 * Statues, by size: a marble citizen in a toga on a moulded pedestal; a
 * bronze warrior with spear and cloak on a stepped plinth among cypresses and
 * flower beds; a bronze horseman on a tall inscribed pedestal in a paved
 * square with a cypress at each corner.
 */
function statueArt(ctx, S, variant, state, key) {
  if (key === 'statue_large') grandStatue(ctx, S);
  else if (key === 'statue_medium') heroStatue(ctx, S);
  else smallStatue(ctx);
}

/** A pedestal: base, shaft, cornice; returns the height of its top. */
function pedestal(ctx, c, half, h, stone) {
  box(ctx, c - half - 0.05, c - half - 0.05, (half + 0.05) * 2, (half + 0.05) * 2, 0, 2.5, shade(stone, -0.12));
  box(ctx, c - half, c - half, half * 2, half * 2, 2.5, h, stone);
  box(ctx, c - half - 0.04, c - half - 0.04, (half + 0.04) * 2, (half + 0.04) * 2, 2.5 + h, 1.6, shade(stone, 0.08));
  return 4.1 + h;
}

/**
 * A standing figure with its feet at (x, y), `k` px per unit (about 18 units
 * tall), lit from the upper left. pose: 'toga' (an orator's raised arm) or
 * 'spear' (a warrior with a spear and a cloak).
 */
function figure(ctx, x, y, k, color, pose) {
  const light = shade(color, 0.22);
  const dark = shade(color, -0.22);
  if (pose === 'spear') {
    // cloak behind, falling from the shoulders
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(x - 2.4 * k, y - 13 * k); ctx.lineTo(x + 2.6 * k, y - 13 * k); ctx.lineTo(x + 3.6 * k, y - 1 * k); ctx.lineTo(x - 3.4 * k, y - 1.5 * k); ctx.closePath(); ctx.fill();
  }
  // legs and robe (a toga falls to the feet; a warrior's tunic stops above the knees)
  ctx.fillStyle = color;
  if (pose === 'toga') {
    ctx.beginPath(); ctx.moveTo(x - 2.7 * k, y); ctx.lineTo(x - 1.9 * k, y - 10 * k); ctx.lineTo(x + 1.9 * k, y - 10 * k); ctx.lineTo(x + 2.9 * k, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 0.5 * k;
    ctx.beginPath(); ctx.moveTo(x - 1.6 * k, y - 9 * k); ctx.lineTo(x + 1.8 * k, y - 1 * k); ctx.moveTo(x - 0.4 * k, y - 9.6 * k); ctx.lineTo(x + 2.4 * k, y - 4 * k); ctx.stroke();
  } else {
    ctx.fillRect(x - 1.5 * k, y - 5 * k, 1.2 * k, 5 * k);
    ctx.fillRect(x + 0.3 * k, y - 5 * k, 1.2 * k, 5 * k);
    ctx.beginPath(); ctx.moveTo(x - 2.2 * k, y - 4.5 * k); ctx.lineTo(x - 1.9 * k, y - 10 * k); ctx.lineTo(x + 1.9 * k, y - 10 * k); ctx.lineTo(x + 2.2 * k, y - 4.5 * k); ctx.closePath(); ctx.fill();
  }
  // torso, lit side
  ctx.fillStyle = color;
  ctx.fillRect(x - 2 * k, y - 14.5 * k, 4 * k, 5 * k);
  ctx.fillStyle = light;
  ctx.fillRect(x - 2 * k, y - 14.5 * k, 1.4 * k, 5 * k);
  // head
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y - 16.4 * k, 1.8 * k, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath(); ctx.arc(x - 0.6 * k, y - 16.9 * k, 0.8 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3 * k;
  ctx.beginPath();
  if (pose === 'toga') {
    // the orator's right arm raised, the left holding a fold of the toga
    ctx.moveTo(x + 1.8 * k, y - 13.6 * k); ctx.lineTo(x + 4.6 * k, y - 16.4 * k);
    ctx.moveTo(x - 1.8 * k, y - 13.4 * k); ctx.lineTo(x - 2.6 * k, y - 10.4 * k);
  } else {
    // spear in the left hand, the right arm on the hip
    ctx.moveTo(x - 1.8 * k, y - 13.6 * k); ctx.lineTo(x - 3.4 * k, y - 11 * k);
    ctx.moveTo(x + 1.8 * k, y - 13.4 * k); ctx.lineTo(x + 2.8 * k, y - 11 * k); ctx.lineTo(x + 1.8 * k, y - 10 * k);
  }
  ctx.stroke();
  if (pose === 'spear') {
    ctx.strokeStyle = shade(color, -0.35);
    ctx.lineWidth = 0.6 * k;
    ctx.beginPath(); ctx.moveTo(x - 3.6 * k, y + 0.5 * k); ctx.lineTo(x - 3.6 * k, y - 22 * k); ctx.stroke();
    ctx.fillStyle = shade(color, 0.3);
    ctx.beginPath(); ctx.moveTo(x - 3.6 * k, y - 24.5 * k); ctx.lineTo(x - 4.4 * k, y - 21.5 * k); ctx.lineTo(x - 2.8 * k, y - 21.5 * k); ctx.fill();
    // a crested helmet
    ctx.fillStyle = '#a8322b';
    ctx.fillRect(x - 0.4 * k, y - 19.6 * k, 0.8 * k, 1.6 * k);
  }
  ctx.lineCap = 'butt';
}

const MARBLE_STATUE = '#ece7dc';
const BRONZE = '#6f8f7c'; // weathered bronze, green with age

function smallStatue(ctx) {
  quad(ctx, 0.08, 0.08, 0.92, 0.92, 0, COL.paving);
  const top = pedestal(ctx, 0.5, 0.16, 7, COL.stone);
  const [x, y] = P(0.5, 0.5, top);
  figure(ctx, x, y, 0.95, MARBLE_STATUE, 'toga');
}

function heroStatue(ctx, S) {
  quad(ctx, 0.04, 0.04, S - 0.04, S - 0.04, 0, COL.paving);
  // flower beds at the front corners, cypresses at the back
  for (const [u, v] of [[0.1, S - 0.5], [S - 0.5, 0.1]]) quad(ctx, u, v, u + 0.4, v + 0.4, 0, '#5d8a3e');
  for (const [u, v] of [[0.3, S - 0.3], [S - 0.3, 0.3]]) {
    const [fx, fy] = P(u, v);
    ctx.fillStyle = '#e0b94a';
    ctx.fillRect(fx - 3, fy - 2, 2, 1.4);
    ctx.fillStyle = '#d9534f';
    ctx.fillRect(fx + 1, fy - 1.4, 2, 1.4);
  }
  cypress(ctx, 0.3, 0.3, 0.75);
  box(ctx, 0.45, 0.45, S - 0.9, S - 0.9, 0, 2.5, shade(COL.stone, -0.06));
  box(ctx, 0.6, 0.6, S - 1.2, S - 1.2, 2.5, 2.5, COL.stone);
  const c = S / 2;
  box(ctx, c - 0.22, c - 0.22, 0.44, 0.44, 5, 12, COL.marble);
  box(ctx, c - 0.26, c - 0.26, 0.52, 0.52, 17, 1.6, shade(COL.marble, -0.06));
  // a bronze plaque on the front face
  poly(ctx, [P(c - 0.12, c + 0.22, 8), P(c + 0.12, c + 0.22, 8), P(c + 0.12, c + 0.22, 13), P(c - 0.12, c + 0.22, 13)], '#8a6d3a');
  const [x, y] = P(c, c, 18.6);
  figure(ctx, x, y, 1.35, BRONZE, 'spear');
  cypress(ctx, S - 0.3, S - 0.3, 0.7);
}

function grandStatue(ctx, S) {
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, COL.paving);
  // a darker band around the square
  quad(ctx, 0.2, 0.2, S - 0.2, S - 0.2, 0.2, shade(COL.paving, -0.08));
  quad(ctx, 0.35, 0.35, S - 0.35, S - 0.35, 0.4, COL.paving);
  cypress(ctx, 0.25, 0.25, 0.85);
  cypress(ctx, S - 0.25, 0.25, 0.85);
  cypress(ctx, 0.25, S - 0.25, 0.85);
  const c = S / 2;
  box(ctx, c - 0.8, c - 0.8, 1.6, 1.6, 0, 3, shade(COL.stone, -0.06));
  box(ctx, c - 0.62, c - 0.62, 1.24, 1.24, 3, 3, COL.stone);
  box(ctx, c - 0.42, c - 0.42, 0.84, 0.84, 6, 20, COL.marble);
  box(ctx, c - 0.48, c - 0.48, 0.96, 0.96, 26, 2, shade(COL.marble, -0.06));
  // the inscription, on the front face
  decal(0, 1, () => {
    ctx.strokeStyle = 'rgba(70,60,50,0.55)';
    ctx.lineWidth = 0.6;
    for (let k = 0; k < 3; k++) {
      const p = P(c - 0.26, c + 0.42, 20 - k * 3.2);
      const q = P(c + 0.26, c + 0.42, 20 - k * 3.2);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
  });
  // the horseman, in bronze
  const [x, y] = P(c, c, 28);
  const s = 1.7;
  horse(ctx, x, y, s, BRONZE, 1, 0.35, shade(BRONZE, -0.3));
  ctx.fillStyle = shade(BRONZE, -0.08);
  ctx.fillRect(x - 1.8 * s, y - 16 * s, 3 * s, 6.4 * s);
  ctx.fillStyle = shade(BRONZE, 0.2);
  ctx.fillRect(x - 1.8 * s, y - 16 * s, 1 * s, 6.4 * s);
  ctx.beginPath(); ctx.arc(x - 0.3 * s, y - 17.4 * s, 1.3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = shade(BRONZE, -0.08);
  ctx.lineWidth = 1.1 * s;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + 0.8 * s, y - 15 * s); ctx.lineTo(x + 3.6 * s, y - 18.4 * s); ctx.stroke();
  ctx.lineCap = 'butt';
  cypress(ctx, S - 0.25, S - 0.25, 0.85);
}

/** The arch's face the road comes out of: the vault's curve, the keystone and the gilded inscription. */
function archFace(ctx, pt, face, axis, H, A, S, marble) {
  const face2 = axis === 0 ? shade(marble, -0.2) : marble; // that face's light (box: right faces are darker)
  const curve = [pt(face, 1.0, H), pt(face, 2.0, H), pt(face, 2.0, H - 12)];
  for (let k = 1; k < 12; k++) {
    const t = k / 12; // across the opening, from its near side back to its far side
    const c = 2.0 - t;
    curve.push(pt(face, c, H - 12 + Math.sin(Math.PI * t) * 9));
  }
  curve.push(pt(face, 1.0, H - 12));
  poly(ctx, curve, face2, shade(marble, -0.45), 0.6);
  // the keystone, and the inscription on the attic in gold
  {
    const [x, y] = pt(face, 1.5, H - 2.5);
    ctx.fillStyle = shade(COL.gold, -0.1);
    ctx.fillRect(x - 1.4, y - 2.5, 2.8, 3);
  }
  ctx.strokeStyle = 'rgba(176,132,42,0.85)';
  ctx.lineWidth = 0.8;
  for (let k = 0; k < 3; k++) {
    const z = H + 3 + A - 4 - k * 4;
    const p = pt(face, 0.55 + k * 0.08, z);
    const q = pt(face, S - 0.55 - k * 0.08, z);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  }
}

/**
 * A triumphal arch (3x3), built across a road (`axis` 0: the road runs along
 * x, 1: along y). Two marble piers with engaged columns stand either side of
 * the road, which runs on under the vault (the middle strip is left
 * unpainted so the road shows through); over them the attic, its
 * inscription in gold on the face the road comes out of, and on top a
 * gilded team of horses with the victor in his chariot.
 */
function triumphalArchArt(ctx, S, variant, axis) {
  const H = 34; // the opening's height (px)
  const A = 15; // the attic
  const a0 = 0.85; // the arch's depth along the road...
  const a1 = S - 0.85;
  const marble = COL.marble;
  const stone = shade(COL.marble, -0.08);
  // Everything is drawn in (along the road, across it) and turned by axis.
  const bx = (p0, p1, c0, c1, z, h, color, o) => (axis === 0 ? box(ctx, p0, c0, p1 - p0, c1 - c0, z, h, color, o) : box(ctx, c0, p0, c1 - c0, p1 - p0, z, h, color, o));
  const pt = (p, c, z) => (axis === 0 ? P(p, c, z) : P(c, p, z));
  const flat = (p0, p1, c0, c1, color) => (axis === 0 ? quad(ctx, p0, c0, p1, c1, 0, color) : quad(ctx, c0, p0, c1, p1, 0, color));
  // paving either side of the road (the road itself shows through)
  flat(0.05, S - 0.05, 0.05, 1.0, COL.paving);
  flat(0.05, S - 0.05, 2.0, S - 0.05, COL.paving);
  // the piers: a plinth, then the marble, the far one first
  for (const [c0, c1] of [[0.15, 1.0], [2.0, S - 0.15]]) {
    bx(a0, a1, c0, c1, 0, 3, shade(COL.stone, -0.05), { plain: true });
    bx(a0 + 0.05, a1 - 0.05, c0 + 0.05, c1, 3, H - 3, marble, { plain: true });
    // two engaged columns on the face the road comes out of
    const p = a1 - 0.02;
    const cs = [c0 + 0.22, c1 - 0.18];
    decal(axis === 0 ? 1 : 0, axis === 0 ? 0 : 1, () => cs.forEach((c) => {
      const [x, y] = pt(p, c, 3);
      ctx.fillStyle = shade(marble, axis === 0 ? -0.12 : 0.04);
      ctx.fillRect(x - 1.6, y - (H - 6), 3.2, H - 6);
      ctx.fillStyle = 'rgba(80,70,60,0.25)';
      ctx.fillRect(x + 0.6, y - (H - 6), 1, H - 6);
      ctx.fillStyle = shade(COL.gold, -0.1);
      ctx.fillRect(x - 2.2, y - (H - 5), 4.4, 1.6); // capital
    }));
  }
  // the entablature, the attic and its cornice, over both piers and the road
  bx(a0, a1, 0.15, S - 0.15, H, 3, stone, { plain: true });
  bx(a0 + 0.05, a1 - 0.05, 0.2, S - 0.2, H + 3, A, marble, { plain: true });
  bx(a0, a1, 0.15, S - 0.15, H + 3 + A, 2.2, stone, { plain: true });
  // the vault: the arch's curve on the face the road comes out of
  const face = a1 - 0.05;
  // (One face, as a whole: turned away, it goes behind the attic.)
  decal(axis === 0 ? 1 : 0, axis === 0 ? 0 : 1, () => archFace(ctx, pt, face, axis, H, A, S, marble));
  // the gilded team on top, facing the way the road runs on
  const top = H + 3 + A + 2.2;
  const dir = axis === 0 ? 1 : -1;
  for (const c of [1.25, 1.75]) {
    const [x, y] = pt(S / 2, c, top);
    horse(ctx, x, y, 1.15, COL.gold, dir, 0.2, shade(COL.gold, -0.35));
  }
  const [cx, cy] = pt(S / 2 - 0.45, 1.5, top);
  ctx.fillStyle = shade(COL.gold, -0.18);
  ctx.fillRect(cx - 3, cy - 5, 6, 5); // the chariot
  ctx.fillStyle = COL.gold;
  ctx.fillRect(cx - 1.1, cy - 13, 2.2, 8); // the victor
  ctx.beginPath(); ctx.arc(cx, cy - 14.3, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3f7a3a';
  ctx.fillRect(cx - 1.6, cy - 16.2, 3.2, 0.9); // his laurel
}

// ---------------------------------------------------------------------------
// Engineering & security
// ---------------------------------------------------------------------------

/**
 * The engineers' yard as the 3D model draws it: a workshop of the fabri
 * in opus craticium (a timber frame filled with rubble and plastered, red
 * at its foot) on a tufa socle under tiles, the shear legs of the hoist
 * beside it, and a stack of sun-dried mudbricks in crossed courses (fired
 * brick is the Empire's).
 */
function engineerArt(ctx) {
  quad(ctx, 0.05, 0.05, 0.95, 0.95, 0, '#bca77f');
  box(ctx, 0.12, 0.12, 0.59, 0.64, 0, 3, COL.tufa, { plain: true });
  plastered(ctx, 0.14, 0.14, 0.55, 0.6, 3, 11, { dado: 4 });
  // the timber frame showing in the plaster of the front wall, and its wall plate
  for (const u of [0.17, 0.29, 0.54, 0.66]) {
    poly(ctx, [P(u - 0.015, 0.74, 7), P(u + 0.015, 0.74, 7), P(u + 0.015, 0.74, 14), P(u - 0.015, 0.74, 14)], COL.woodDark);
  }
  poly(ctx, [P(0.14, 0.74, 12.6), P(0.69, 0.74, 12.6), P(0.69, 0.74, 14), P(0.14, 0.74, 14)], COL.woodDark);
  // Its door on the front (+v) face, the side it turns toward a road: with
  // none, the post turned but never looked as if it faced the street (playtest).
  door(ctx, 'left', 0.14, 0.14, 0.69, 0.74, 3, 0.5, '#4a3222', 0.17, 8);
  gableRoof(ctx, 0.14, 0.14, 0.55, 0.6, 14, 7, COL.terra, 'v');
  // the mudbricks, laid in crossed courses
  for (let k = 0; k < 4; k++) {
    if (k % 2) box(ctx, 0.6, 0.8, 0.14, 0.2, k * 2.2, 2.2, COL.mudbrick, { plain: true, stroke: shade(COL.mudbrick, -0.5) });
    else box(ctx, 0.52, 0.82, 0.3, 0.12, k * 2.2, 2.2, COL.mudbrick, { plain: true, stroke: shade(COL.mudbrick, -0.5) });
  }
  // the shear legs: two timbers lashed at the top, a block hanging from it
  const [x, y] = P(0.82, 0.55);
  ctx.strokeStyle = COL.woodDark;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 4, y); ctx.lineTo(x, y - 26); ctx.lineTo(x + 4, y);
  ctx.moveTo(x, y - 26); ctx.lineTo(x - 12, y - 18);
  ctx.stroke();
  ctx.strokeStyle = '#3a3026';
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(x - 12, y - 18); ctx.lineTo(x - 12, y - 9); ctx.stroke();
  ctx.fillStyle = COL.tufa;
  ctx.fillRect(x - 14, y - 9, 4, 3);
}

/**
 * The gardeners' yard (Topiaria): a gravel yard with a timber tool shed at
 * the back, a clipped hedge along one side, a rake and a hoe leaning on the
 * shed, and potted shrubs along the front waiting to be planted out.
 */
function gardenerYardArt(ctx, S, variant) {
  quad(ctx, 0.05, 0.05, 0.95, 0.95, 0, '#bfae84'); // gravel
  quad(ctx, 0.12, 0.6, 0.66, 0.9, 0.2, '#8a6a44'); // a bed of turned earth for the cuttings
  box(ctx, 0.1, 0.1, 0.5, 0.42, 0, 11, COL.wood);
  gableRoof(ctx, 0.1, 0.1, 0.5, 0.42, 11, 5, COL.terra, 'u');
  door(ctx, 'left', 0.1, 0.1, 0.6, 0.52, 0, 0.55, COL.woodDark, 0.16, 7);
  // a rake and a hoe against the shed's side
  const [x, y] = P(0.63, 0.32);
  ctx.strokeStyle = COL.woodDark;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + 1.6, y - 12);
  ctx.moveTo(x + 3.2, y + 0.6); ctx.lineTo(x + 4.2, y - 10.5);
  ctx.stroke();
  ctx.strokeStyle = COL.iron;
  ctx.beginPath();
  ctx.moveTo(x - 0.4, y - 12); ctx.lineTo(x + 3.6, y - 12); // the rake's head
  ctx.moveTo(x + 4.2, y - 10.5); ctx.lineTo(x + 6, y - 9.6); // the hoe's blade
  ctx.stroke();
  // a clipped hedge along the right edge
  box(ctx, 0.76, 0.12, 0.14, 0.76, 0, 5, '#4f7a34', { plain: true });
  // potted shrubs along the front, and a young cypress
  for (const [u, v] of [[0.22, 0.76], [0.4, 0.8], [0.58, 0.74]]) {
    box(ctx, u - 0.06, v - 0.06, 0.12, 0.12, 0, 2.6, COL.terra, { plain: true });
    const [px, py] = P(u, v, 2.6);
    ctx.fillStyle = (variant + u * 10) % 2 < 1 ? '#5e8f3c' : '#6b9a46';
    ctx.beginPath(); ctx.arc(px, py - 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(px - 0.8, py - 2.8, 1, 0, Math.PI * 2); ctx.fill();
  }
  cypress(ctx, 0.66, 0.62, 0.45);
}

/**
 * The watch house as the 3D model draws it: rubble plastered white over a
 * tufa socle with a red dado, under a tiled gable, its door framed in
 * tufa, a red banner and the pump's water tank (fired brick is Imperial).
 */
function prefectureArt(ctx) {
  quad(ctx, 0.05, 0.05, 0.95, 0.95, 0, COL.paving);
  box(ctx, 0.12, 0.12, 0.76, 0.66, 0, 3, COL.tufa, { plain: true });
  plastered(ctx, 0.14, 0.14, 0.72, 0.62, 3, 13, { dado: 4, wall: '#f1e9d6' });
  gableRoof(ctx, 0.14, 0.14, 0.72, 0.62, 16, 8, COL.terra, 'u');
  // the door and its frame of tufa posts
  for (const u of [0.38, 0.57]) box(ctx, u, 0.76, 0.05, 0.05, 3, 9, COL.tufa, { plain: true });
  door(ctx, 'left', 0.14, 0.14, 0.86, 0.76, 3, 0.5, '#5a3a2a', 0.14, 8);
  // red banner + water barrel
  flagPoles(ctx, 'prefecture', 1);
  const [bx, by] = P(0.3, 0.9);
  ctx.fillStyle = COL.wood;
  ctx.fillRect(bx - 3, by - 6, 6, 6);
  ctx.fillStyle = '#4a90c8';
  ctx.fillRect(bx - 2.4, by - 6.5, 4.8, 1.2);
}

// ---------------------------------------------------------------------------
// Farms & raw materials
// ---------------------------------------------------------------------------

const CROP = {
  farm_wheat: { young: '#7fae4c', ripe: '#e2c15a', kind: 'rows' },
  farm_veg: { young: '#6ea84a', ripe: '#4f9a3a', kind: 'heads', fruit: '#c9503a' },
  farm_fruit: { young: '#5d9a44', ripe: '#4b8a3a', kind: 'trees', fruit: '#d9463a' },
  farm_olive: { young: '#7f9a6a', ripe: '#8a9c78', kind: 'trees', fruit: '#4d5a2a' },
  farm_vine: { young: '#6d9a4a', ripe: '#5a8a3c', kind: 'vines', fruit: '#6b3fa0' },
  farm_pig: { young: '#8a7a55', ripe: '#8a7a55', kind: 'pigs' },
  // Flax: thin green stalks that open sky-blue flowers, so a flax field reads
  // blue from afar (no other crop does).
  farm_flax: { young: '#79a052', ripe: '#6f9548', kind: 'flax', fruit: '#6f8fd8', bloom: '#b9cdf3' },
};

/**
 * Added to a farm's art state when the 3D ground draws its field
 * (render3d/ground/: the ploughed earth, the rows of grain, vegetables and
 * flax as they grow, ripen and rest, the grass and worked earth under trees
 * and vines, the pen's mud, and the snow on them): the sprite then draws
 * only what stands up, the farmhouse, its haystack, the trees, the vines,
 * the pen's fence and its pigs.
 */
export const FARM_BARE = 16;

/** Winter tones for a resting farm: the crop stands (as high as it grew) but dry and dull. */
const WINTER_STRAW = '#a39a6c';
const WINTER_OLIVE = '#6f7358';

function farmArt(ctx, S, variant, stage, key) {
  const bare = stage >= FARM_BARE;
  if (bare) stage -= FARM_BARE;
  // Stages 5..9: the same growth stage, resting for an Insane winter. The crop
  // keeps its height (progress is frozen, not lost) but turns dry and dull:
  // no fruit, bare orchard trees and vines, most pigs in the sty.
  const resting = stage >= 5;
  if (resting) stage -= 5;
  const base = CROP[key] || CROP.farm_wheat;
  const crop = resting
    ? { ...base, young: mix(base.young, WINTER_STRAW, 0.7), ripe: mix(base.ripe, WINTER_STRAW, 0.7), fruit: null }
    : base;
  if (!bare) quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, crop.kind === 'pigs' ? '#9a8a5c' : COL.soil);
  const sn = bare ? 0 : roofSnowAmount();
  if (sn > 0) {
    // Snow lying on the field (the rows and plants still show through).
    ctx.globalAlpha = 0.35 + 0.55 * sn;
    quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, SNOW);
    ctx.globalAlpha = 1;
  }
  const t = stage / 4; // 0..1 growth
  if (bare && (crop.kind === 'rows' || crop.kind === 'heads' || crop.kind === 'flax')) {
    // (The 3D ground draws these crops in its field.)
  } else if (crop.kind === 'rows' || crop.kind === 'heads') {
    for (let r = 0; r < 9; r++) {
      const v = 0.2 + r * ((S - 0.4) / 8);
      const p = P(1.0, v);
      const q = P(S - 0.12, v);
      ctx.strokeStyle = shade(COL.soil, -0.25);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      if (stage === 0) continue;
      const col = stage >= 4 ? crop.ripe : crop.young;
      for (let k = 0; k < 9; k++) {
        const u = 1.05 + k * ((S - 1.2) / 8);
        const [x, y] = P(u, v);
        const h = 1.5 + t * 5;
        ctx.fillStyle = col;
        if (crop.kind === 'rows') ctx.fillRect(x - 1, y - h, 2, h);
        else { ctx.beginPath(); ctx.arc(x, y - 1.5, 1 + t * 1.8, 0, Math.PI * 2); ctx.fill(); }
        if (crop.fruit && crop.kind === 'heads' && stage >= 3 && k % 3 === 0) { ctx.fillStyle = crop.fruit; ctx.fillRect(x - 0.8, y - 3, 1.6, 1.6); }
      }
    }
  } else if (crop.kind === 'trees') {
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 3; k++) {
        const u = 1.2 + k * 0.62;
        const v = 0.45 + r * 0.95;
        const size = 0.35 + t * 0.35;
        if (resting && key !== 'farm_olive') bareTree(ctx, u, v, size, r * 3 + k, 0, WINTER_STRAW); // fruit trees drop their leaves
        else tree(ctx, u, v, size, resting ? WINTER_OLIVE : stage >= 4 ? crop.ripe : crop.young, '#6b4a2a', r * 3 + k); // olives stay green
        if (crop.fruit && stage >= 3) {
          const [x, y] = P(u, v);
          ctx.fillStyle = crop.fruit;
          for (let f = 0; f < 3; f++) ctx.fillRect(x - 3 + f * 3, y - 6 - (f % 2) * 3 - t * 4, 1.5, 1.5);
        }
      }
    }
  } else if (crop.kind === 'vines') {
    for (let r = 0; r < 6; r++) {
      const v = 0.3 + r * ((S - 0.6) / 5);
      const p = P(1.0, v);
      const q = P(S - 0.12, v);
      ctx.strokeStyle = COL.woodDark;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(p[0], p[1] - 5); ctx.lineTo(q[0], q[1] - 5); ctx.stroke();
      if (stage === 0 || resting) continue; // bare canes in winter
      ctx.strokeStyle = crop.young;
      ctx.lineWidth = 1 + t * 2.4;
      ctx.beginPath(); ctx.moveTo(p[0], p[1] - 4); ctx.lineTo(q[0], q[1] - 4); ctx.stroke();
      if (stage >= 3) {
        for (let k = 0; k < 6; k++) {
          const [x, y] = P(1.1 + k * ((S - 1.3) / 5), v);
          ctx.fillStyle = crop.fruit;
          ctx.beginPath(); ctx.arc(x, y - 3, 1.3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  } else if (crop.kind === 'flax') {
    // Close rows of leafy stalks; from the third stage they carry blue
    // flowers (a few paler ones), so the field turns blue as it ripens.
    for (let r = 0; r < 11; r++) {
      const v = 0.16 + r * ((S - 0.32) / 10);
      const p = P(1.0, v);
      const q = P(S - 0.12, v);
      ctx.strokeStyle = shade(COL.soil, -0.2);
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      if (stage === 0) continue;
      const h = 2 + t * 6;
      // The leaves: a green band along the row, as tall as the crop.
      ctx.strokeStyle = crop.young;
      ctx.lineWidth = 1 + t * 2;
      ctx.beginPath(); ctx.moveTo(p[0], p[1] - h * 0.35); ctx.lineTo(q[0], q[1] - h * 0.35); ctx.stroke();
      for (let k = 0; k < 13; k++) {
        const u = 1.04 + (k + (r % 2) * 0.5) * ((S - 1.2) / 13);
        const [x, y] = P(u, v);
        ctx.fillStyle = stage >= 4 ? crop.ripe : crop.young;
        ctx.fillRect(x - 0.5, y - h, 1, h);
        if (!crop.fruit || stage < 2) continue;
        ctx.fillStyle = hash01(variant, r * 13 + k, 71) < 0.18 ? crop.bloom : crop.fruit;
        const fr = 0.9 + t * 0.8;
        ctx.beginPath(); ctx.arc(x, y - h, fr, 0, Math.PI * 2); ctx.fill();
        if (stage >= 3) { ctx.beginPath(); ctx.arc(x + 1.6, y - h + 1.2, fr * 0.8, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  } else if (crop.kind === 'pigs') {
    // fenced pen with pigs; more pigs as the herd grows
    ctx.strokeStyle = COL.wood;
    ctx.lineWidth = 1;
    const c = [P(1.0, 0.15, 4), P(S - 0.12, 0.15, 4), P(S - 0.12, S - 0.12, 4), P(1.0, S - 0.12, 4)];
    ctx.beginPath(); c.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
    const n = resting ? 2 : 2 + stage * 2; // winter: most pigs stay in the sty
    for (let k = 0; k < n; k++) {
      const [x, y] = P(1.3 + hash01(variant, k, 61) * (S - 1.6), 0.4 + hash01(variant, k, 62) * (S - 0.8));
      ctx.fillStyle = '#e8a7a0';
      ctx.beginPath(); ctx.ellipse(x, y - 2, 3.4, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d98f88';
      ctx.beginPath(); ctx.arc(x + 3, y - 2.6, 1.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // farmhouse in the back corner (u 0..1)
  box(ctx, 0.12, 0.15, 0.7, 0.7, 0, 13, COL.cream);
  gableRoof(ctx, 0.12, 0.15, 0.7, 0.7, 13, 7, COL.terra, 'u');
  door(ctx, 'left', 0.12, 0.15, 0.82, 0.85, 0, 0.5);
  // hay stack
  const [hx, hy] = P(0.45, 1.3);
  ctx.fillStyle = COL.thatch;
  ctx.beginPath(); ctx.ellipse(hx, hy - 4, 5, 5, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(hx - 5, hy - 4, 10, 4);
}

// ---------------------------------------------------------------------------
// Industry: the four raw producers and the eight workshops
//
// Each is drawn as the 3D model of the same building is designed (render3d/models/clayPit.js and
// its siblings): the plan is the model's, in the model's metres (the footprint's middle at the
// origin, x and z within +-4, the street toward +z), mapped onto the footprint's tiles by indU
// and indV and onto pixels of height by IND_H. The art state carries what the model shows: bit 0
// is shut (no staff; 0 staffed, which is also the placement ghost's look) and the rest is the
// stores as steps of 0..3 (industryArtState).
// ---------------------------------------------------------------------------

/** Pixels of height per metre, and the model's metres as footprint tiles (a tile is 4 m). */
const IND_H = 7;
const indU = (x) => (x + 4) / 4;
const indV = (z) => (z + 4) / 4;
/** The point at model metres (x across, y up, z toward the street). */
const indPt = (x, y, z) => P(indU(x), indV(z), y * IND_H);

/** A store as a step of 0..3 (none, a third, two thirds, full: any stock shows at least a third), as the models read it. */
function indStep(amount, cap) {
  const n = Math.max(0, amount || 0);
  return n <= 0 ? 0 : Math.max(1, Math.min(3, Math.ceil((n / cap) * 3 - 1e-9)));
}

/** What each producer holds, and each workshop: [raw, second raw, product]. */
const IND_RAW = { clay_pit: 'clay', timber_yard: 'timber', iron_mine: 'iron', marble_quarry: 'marble' };
const IND_WS = {
  pottery_ws: ['clay', null, 'pottery'], furniture_ws: ['timber', null, 'furniture'], oil_ws: ['olives', null, 'oil'],
  wine_ws: ['grapes', null, 'wine'], weapons_ws: ['iron', null, 'weapons'], fletcher_ws: ['timber', 'iron', 'arrows'],
  linen_ws: ['flax', null, 'linen'], clothing_ws: ['linen', null, 'clothing'],
};

/**
 * The art state of a producer or a workshop: bit 0 set when it has no staff (shut up, the lantern
 * cold), then its stores as steps: a producer's one (x2), a workshop's raw, second raw and product
 * (2 bits each, from bit 1). 0 is staffed and empty. Undefined for any other building.
 */
export function industryArtState(b) {
  const shut = b.efficiency > 0 ? 0 : 1;
  const st = b.stock || {};
  if (IND_RAW[b.type]) return shut + 2 * indStep(st[IND_RAW[b.type]], CONFIG.PRODUCER_MAX_STOCK);
  const ws = IND_WS[b.type];
  if (!ws) return undefined;
  const a = indStep(st[ws[0]], CONFIG.WORKSHOP_RAW_CAP);
  const c = ws[1] ? indStep(st[ws[1]], CONFIG.WORKSHOP_RAW_CAP) : 0;
  const o = indStep(st[ws[2]], CONFIG.CART_CAPACITY * 2);
  return shut + 2 * (a + 4 * (c + 4 * o));
}

/** A producer's look from its state: [shut, step]. */
const indRawLook = (state) => [state & 1, state >> 1];
/** A workshop's look: [shut, raw step, second raw step, product step]. */
const indWsLook = (state) => [state & 1, (state >> 1) & 3, (state >> 3) & 3, (state >> 5) & 3];

/** Palette of the yards (beaten earth, dug clay, timber, rock, thatch). */
const IND = Object.freeze({
  earth: '#b9aa88', dust: '#d8cba8', clay: '#c8a46a', clayDry: '#d9bc8a', timber: '#9a6c3e', timberPale: '#c9a36b', bark: '#7a4f2c',
  barkLight: '#9a7044', rock: '#a39682', rockDark: '#7d7262', grass: '#6f8c43', ore: '#7a4a34', oreDark: '#563022', white: '#ece1c6',
  whiteLit: '#f5ecd5', thatch: '#c9a75b', iron: '#6a707a', lampOn: '#ffd98a', lampOff: '#5b4630', tile: '#b8573a', leather: '#8a6a45',
});

/** An axis-aligned box in model metres: x0..x1 across, z0..z1 toward the street, y0..y1 up. Plain (no wall flecks) unless asked. */
function indBox(ctx, x0, x1, z0, z1, y0, y1, color, o = {}) {
  box(ctx, indU(x0), indV(z0), (x1 - x0) / 4, (z1 - z0) / 4, y0 * IND_H, (y1 - y0) * IND_H, color, { plain: true, ...o });
}

/** A square-sectioned post standing at (x, z) from y0 to y1, w metres across. */
function indPost(ctx, x, z, y0, y1, color = COL.woodDark, w = 0.12) {
  indBox(ctx, x - w / 2, x + w / 2, z - w / 2, z + w / 2, y0, y1, color, { stroke: null });
}

/** A flat shape on the level y over the rectangle x0..x1 by z0..z1. */
function indQuad(ctx, x0, x1, z0, z1, y, fill, stroke = null) {
  poly(ctx, [indPt(x0, y, z0), indPt(x1, y, z0), indPt(x1, y, z1), indPt(x0, y, z1)], fill, stroke, 0.5);
}

/** A flat ellipse on the level y, rx and rz metres, as a polygon (so it turns with the building). */
function indDisc(ctx, x, y, z, rx, rz, fill, stroke = null) {
  const pts = [];
  for (let k = 0; k < 18; k++) pts.push(indPt(x + Math.cos((k / 18) * Math.PI * 2) * rx, y, z + Math.sin((k / 18) * Math.PI * 2) * rz));
  poly(ctx, pts, fill, stroke, 0.5);
}

/**
 * Run `fn` (direct canvas calls, which know no bounds of their own) as one unit of a turned drawing,
 * boxed by the model metres x0..x1, z0..z1 and heights y0..y1, so the turn sorts it behind and in
 * front of the walls and boxes as it should. Call P (indPt) inside `fn` only.
 */
function indUnit(x0, x1, z0, z1, y0, y1, fn) {
  if (!TS.rec) return fn();
  const [ua, va] = turnUV(indU(x0) + TS.ou, indV(z0) + TS.ov, TS.S, TS.t);
  const [ub, vb] = turnUV(indU(x1) + TS.ou, indV(z1) + TS.ov, TS.S, TS.t);
  return unit([Math.min(ua, ub), Math.max(ua, ub), Math.min(va, vb), Math.max(va, vb), y0 * IND_H, y1 * IND_H], fn);
}

/** The unit of something standing at (x, z) from y up h metres, r metres each way. */
function indStand(x, y, z, r, h, fn) {
  indUnit(x - r, x + r, z - r, z + r, y, y + h, fn);
}

/** A straight line between two model points ([x, y, z]), for ropes, poles and tool handles. */
function indLine(ctx, a, b, color, w = 0.8) {
  // (A long one is drawn in pieces of a metre or two, so a turn can sort each against what stands round it.)
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.4);
  if (n > 1) {
    for (let k = 0; k < n; k++) {
      indLine(ctx, a.map((v, i) => v + ((b[i] - v) * k) / n), a.map((v, i) => v + ((b[i] - v) * (k + 1)) / n), color, w);
    }
    return;
  }
  indUnit(Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[2], b[2]), Math.min(a[1], b[1]), Math.max(a[1], b[1]) + 0.05, () => {
    const p = indPt(...a);
    const q = indPt(...b);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  });
}

/** A log from a to b ([x, y, z] of its axis), r metres in radius, its cut end (at b) pale. */
function indLog(ctx, a, b, r, bark = IND.bark, cut = IND.timberPale) {
  const w = Math.max(1.4, 2 * r * IND_H);
  indUnit(Math.min(a[0], b[0]) - r, Math.max(a[0], b[0]) + r, Math.min(a[2], b[2]) - r, Math.max(a[2], b[2]) + r, Math.min(a[1], b[1]) - r, Math.max(a[1], b[1]) + r, () => {
    const p = indPt(...a);
    const q = indPt(...b);
    ctx.strokeStyle = shade(bark, -0.3);
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(p[0], p[1] + 0.4); ctx.lineTo(q[0], q[1] + 0.4); ctx.stroke();
    ctx.strokeStyle = bark;
    ctx.lineWidth = w * 0.72;
    ctx.beginPath(); ctx.moveTo(p[0], p[1] - 0.3); ctx.lineTo(q[0], q[1] - 0.3); ctx.stroke();
    ctx.fillStyle = cut;
    ctx.beginPath(); ctx.ellipse(q[0], q[1], Math.max(0.9, w * 0.3), w * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  });
}

/** An upright round vessel (a tub, a vat, a kiln's base, a stump): foot at (x, y, z), r metres wide, h metres tall. */
function indCyl(ctx, x, y, z, r, h, body, top = shade(body, 0.2)) {
  indStand(x, y, z, r, h, () => {
    const [cx, cy] = indPt(x, y, z);
    const rx = r * 11.3;
    const ry = r * 5.65;
    const hh = h * IND_H;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy); ctx.lineTo(cx - rx, cy - hh); ctx.lineTo(cx + rx, cy - hh); ctx.lineTo(cx + rx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.17)'; // the side away from the light
    ctx.beginPath();
    ctx.moveTo(cx + rx * 0.3, cy + ry * 0.95); ctx.lineTo(cx + rx * 0.3, cy - hh); ctx.lineTo(cx + rx, cy - hh); ctx.lineTo(cx + rx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 0.4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = top;
    ctx.beginPath(); ctx.ellipse(cx, cy - hh, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  });
}

/** A heap (spoil, ore, clay, charcoal): a dome r metres across and h metres high at (x, z). */
function indHeap(ctx, x, y, z, r, h, color, lumpColor = shade(color, -0.3), seed = 0) {
  indStand(x, y, z, r, h, () => indHeapRaw(ctx, x, y, z, r, h, color, lumpColor, seed));
}

function indHeapRaw(ctx, x, y, z, r, h, color, lumpColor, seed) {
  const [cx, cy] = indPt(x, y, z);
  const rx = r * 11.3;
  const ry = r * 5.65;
  const hh = h * IND_H;
  ctx.fillStyle = shade(color, -0.2);
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(cx - rx, cy); ctx.ellipse(cx, cy, rx, hh + ry * 0.2, 0, Math.PI, Math.PI * 2); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(color, 0.16); // the lit shoulder
  ctx.beginPath(); ctx.ellipse(cx - rx * 0.25, cy - hh * 0.45, rx * 0.4, hh * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lumpColor;
  const n = Math.round(4 + r * 4);
  for (let k = 0; k < n; k++) {
    const a = hash01(seed, k, 1) * Math.PI * 2;
    const d = Math.sqrt(hash01(seed, k, 2)) * 0.8;
    const lx = cx + Math.cos(a) * rx * d;
    const ly = cy - Math.max(0, hh * (1 - d * d) * 0.7) + Math.sin(a) * ry * d * 0.5;
    ctx.beginPath(); ctx.arc(lx, ly, 0.7 + hash01(seed, k, 3) * 0.7, 0, Math.PI * 2); ctx.fill();
  }
}

/** A man at (x, y, z) in a tunic of that colour, an arm out to `reach` (a point [x, y, z]) when he works. About 10 px tall. */
function indMan(ctx, x, y, z, tunic, reach = null, skin = '#d6ab82') {
  indStand(x, y, z, 0.3, 1.6, () => indManRaw(ctx, x, y, z, tunic, reach, skin));
}

function indManRaw(ctx, x, y, z, tunic, reach, skin) {
  const [px, py] = indPt(x, y, z);
  ctx.fillStyle = '#6a5640';
  ctx.fillRect(px - 1.5, py - 3.2, 1.2, 3.2);
  ctx.fillRect(px + 0.3, py - 3.2, 1.2, 3.2);
  ctx.fillStyle = tunic;
  ctx.fillRect(px - 2, py - 8, 4, 5.2);
  ctx.fillStyle = shade(tunic, -0.22);
  ctx.fillRect(px + 0.8, py - 8, 1.2, 5.2);
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(px, py - 9.6, 1.6, 0, Math.PI * 2); ctx.fill();
  if (reach) {
    const [rx, ry] = indPt(...reach);
    ctx.strokeStyle = skin;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py - 7); ctx.lineTo(rx, ry); ctx.stroke();
  }
}

/** Snow lying on the yard (the roofs have their own), as on the fields. */
function indSnow(ctx, S) {
  const sn = roofSnowAmount();
  if (sn <= 0) return;
  ctx.globalAlpha = 0.3 + 0.5 * sn;
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, SNOW);
  ctx.globalAlpha = 1;
}

/** The yard's beaten earth over the whole footprint. */
function indGround(ctx, S, color) {
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, color);
  indSnow(ctx, S);
}

/** The lantern on a bracket at (x, y, z): lit while staffed. */
function indLamp(ctx, x, y, z, shut) {
  indStand(x, y - 0.1, z, 0.12, 0.6, () => {
    const [px, py] = indPt(x, y, z);
    ctx.fillStyle = COL.woodDark;
    ctx.fillRect(px - 0.8, py - 1.2, 1.6, 1.2);
    ctx.fillStyle = shut ? IND.lampOff : IND.lampOn;
    ctx.fillRect(px - 1.1, py - 3.6, 2.2, 2.6);
  });
}

/** A thatched gable over posts (a shelter's or a shed's roof): x0..x1 by z0..z1 from the eave y0 to the ridge y1, the ridge along `axis`. */
function indThatch(ctx, x0, x1, z0, z1, y0, y1, axis) {
  gableRoof(ctx, indU(x0), indV(z0), (x1 - x0) / 4, (z1 - z0) / 4, y0 * IND_H, (y1 - y0) * IND_H, IND.thatch, axis, 0.07);
}

// --- The clay pit -----------------------------------------------------------

/**
 * The clay pit, as the 3D model draws it: a pit dug in three steps of clay
 * down each side to a floor with water standing in it, a plank ramp with
 * cleats coming down into it; the pug bed in a frame of boards; a shelter
 * on posts under thatch over a pallet where the dug clay is stacked in
 * lumps (the stock); two racks of bricks drying, a hand barrow and baskets
 * of clay. Staffed: the lantern lit, the barrow loaded, diggers in the pit
 * and a man treading the bed. Idle: the mattocks leaning on a post, nobody.
 */
function clayPitArt(ctx, S, variant, state) {
  const [shut, step] = indRawLook(state);
  indGround(ctx, S, '#c3b493');
  // the pit: the floor and its pool, then three steps of clay, each a ring a third of a metre wide
  const t = 0.36;
  const rim = { x0: -3.8, x1: 0.9, z0: -3.8, z1: 0.2 };
  const fl = t * 3;
  indQuad(ctx, rim.x0 + fl, rim.x1 - fl, rim.z0 + fl, rim.z1 - fl, 0, '#6f5234');
  indDisc(ctx, -2.0, 0.1, -2.1, 0.62, 0.42, '#5f8f95', '#3f6a70');
  indDisc(ctx, -2.1, 0.12, -2.2, 0.28, 0.16, '#8ab6b8');
  [0.55, 0.36, 0.18].forEach((top, k) => {
    const o = { x0: rim.x0 + t * k, x1: rim.x1 - t * k, z0: rim.z0 + t * k, z1: rim.z1 - t * k };
    const c = shade(IND.clay, -0.17 * k);
    const st = shade(c, -0.35);
    indBox(ctx, o.x0, o.x1, o.z0, o.z0 + t, 0, top, c, { stroke: st });
    indBox(ctx, o.x0, o.x0 + t, o.z0 + t, o.z1 - t, 0, top, c, { stroke: st });
    indBox(ctx, o.x1 - t, o.x1, o.z0 + t, o.z1 - t, 0, top, c, { stroke: st });
    indBox(ctx, o.x0, o.x1, o.z1 - t, o.z1, 0, top, c, { stroke: st });
  });
  // the ramp of planks with cleats down to the floor, from the front rim
  const yAt = (z) => 0.66 + (z - 0.2) * 0.3;
  const rx = -1.55;
  poly(ctx, [indPt(rx - 0.36, yAt(0.5), 0.5), indPt(rx + 0.36, yAt(0.5), 0.5), indPt(rx + 0.36, yAt(-1.75), -1.75), indPt(rx - 0.36, yAt(-1.75), -1.75)], '#b08850', '#6a4a28', 0.6);
  for (let k = 1; k < 6; k++) {
    const z = -1.75 + k * 0.38;
    indLine(ctx, [rx - 0.34, yAt(z) + 0.03, z], [rx + 0.34, yAt(z) + 0.03, z], '#6e4c2a', 0.7);
  }
  for (const s of [-1, 1]) indLine(ctx, [rx + s * 0.38, yAt(0.5) + 0.06, 0.5], [rx + s * 0.38, yAt(-1.75) + 0.06, -1.75], '#7a5632', 1);
  // the pug bed: a frame of boards with the clay trodden to slurry in it, stakes at the corners
  indBox(ctx, -3.7, -1.7, 1.0, 2.4, 0, 0.17, '#a98250', { stroke: '#5e4226' });
  indQuad(ctx, -3.64, -1.76, 1.06, 2.34, 0.15, '#9b7a4c');
  indQuad(ctx, -3.3, -2.4, 1.3, 1.9, 0.151, '#a8875a');
  for (const [x, z] of [[-3.72, 0.98], [-1.68, 0.98], [-3.72, 2.42], [-1.68, 2.42]]) indPost(ctx, x, z, 0, 0.3, COL.wood, 0.08);
  // the shelter: six posts, the pallet with the stock of clay lumps on it, then the thatch over all
  const s = { x0: 1.65, x1: 3.5, z0: -3.5, z1: -0.8, eave: 1.7, ridge: 2.65 };
  for (const x of [s.x0, s.x1]) for (const z of [s.z0, (s.z0 + s.z1) / 2, s.z1]) indPost(ctx, x, z, 0, s.eave, COL.woodDark, 0.17);
  indBox(ctx, 1.85, 3.25, -3.2, -1.0, 0, 0.14, '#8d6a40', { stroke: null });
  const layers = [[3, 4], [3, 4], [3, 3], [2, 3], [2, 2]].slice(0, [0, 1, 3, 5][step]);
  layers.forEach(([nx, nz], k) => {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const cx = 2.55 + (i - (nx - 1) / 2) * 0.45 + (hash01(k, i, j) - 0.5) * 0.06;
      const cz = -2.1 + (j - (nz - 1) / 2) * 0.52;
      indBox(ctx, cx - 0.21, cx + 0.21, cz - 0.25, cz + 0.25, 0.14 + k * 0.24, 0.14 + (k + 1) * 0.24, shade(IND.clay, -0.1 + hash01(i, j, k) * 0.2), { stroke: shade(IND.clay, -0.4) });
    }
  });
  indThatch(ctx, s.x0, s.x1, s.z0, s.z1, s.eave, s.ridge, 'v');
  indLamp(ctx, 1.79, 1.38, -0.5, shut);
  if (shut) for (const k of [0, 1, 2]) indLine(ctx, [3.0 + k * 0.1, 0, -0.5], [3.38 + k * 0.03, 1.35, -0.76], COL.wood, 0.9); // the mattocks against a post
  // two baskets of clay at the shelter's front
  for (const [x, z, r] of [[1.15, 0.55, 0.27], [1.62, 0.95, 0.24]]) {
    indCyl(ctx, x, 0, z, r, 0.3, '#a8814a', IND.clay);
  }
  // two racks of unfired bricks drying, two shelves each
  for (const [cz, cx] of [[1.55, -0.05], [2.45, 0.3]]) {
    const L = 1.9;
    const D = 0.5;
    for (const sx of [-1, 1]) indPost(ctx, cx + sx * (L / 2 - 0.05), cz - D / 2 + 0.05, 0, 1.05, COL.wood, 0.07);
    for (const sh of [0.38, 0.78]) {
      indBox(ctx, cx - L / 2, cx + L / 2, cz - D / 2, cz + D / 2, sh, sh + 0.05, '#a9824f', { stroke: null });
      for (let k = 0; k < 7; k++) indBox(ctx, cx - L / 2 + 0.12 + k * 0.25, cx - L / 2 + 0.32 + k * 0.25, cz - 0.03, cz + 0.03, sh + 0.05, sh + 0.25, shade(IND.clayDry, hash01(k, sh * 9, 4) * 0.18 - 0.1), { stroke: shade(IND.clayDry, -0.35) });
    }
    for (const sx of [-1, 1]) indPost(ctx, cx + sx * (L / 2 - 0.05), cz + D / 2 - 0.05, 0, 1.05, COL.wood, 0.07);
  }
  // the hand barrow: a board bed on two long handles, loaded while the pit works
  for (const sx of [-1, 1]) indBox(ctx, 2.2 + sx * 0.33 - 0.03, 2.2 + sx * 0.33 + 0.03, 1.4, 3.5, 0.2, 0.26, COL.wood, { stroke: null });
  indBox(ctx, 1.85, 2.55, 1.98, 2.92, 0.26, 0.3, '#a98250', { stroke: null });
  if (!shut) for (const dz of [-0.2, 0.2, 0]) indBox(ctx, 2.0, 2.4, 2.45 + dz - 0.15, 2.45 + dz + 0.15, 0.3, 0.46 + (dz ? 0 : 0.06), shade(IND.clay, dz * 0.4), { stroke: shade(IND.clay, -0.4) });
  if (!shut) {
    indMan(ctx, -0.95, 0.04, -2.0, '#8a7a5a', [-0.7, 0.4, -1.7]);
    indMan(ctx, -0.55, 0.04, -1.4, '#a8977a', [-0.2, 0.5, -1.4]);
    indMan(ctx, -2.7, 0.04, 2.95, '#6e604f', [-2.7, 0.3, 2.4]);
  }
}

// --- The timber yard --------------------------------------------------------

/**
 * The timber yard, as the 3D model draws it: a felling yard with stumps, a
 * limbed trunk, a saw pit (the log on trestles, a sawyer above and one
 * below at the long saw), an ox-sledge and the wheels of a timber cart, a
 * shed of poles under thatch with a bench and a chopping block, and the
 * store: logs between stakes and planks on stickers (the stock).
 * Staffed: the saw in its kerf, the lantern lit, the feller and the two
 * sawyers at work. Idle: the saw leaning on the trestle, nobody.
 */
function timberYardArt(ctx, S, variant, state) {
  const [shut, step] = indRawLook(state);
  indGround(ctx, S, '#d3c5a4');
  // the shed of poles under thatch at the back left: bench, planks, the chopping block with its axes
  const sh = { x0: -3.5, x1: -0.7, z0: -3.4, z1: -1.9, eave: 1.8, ridge: 2.75 };
  indBox(ctx, -3.55, -2.05, -3.22, -2.78, 0, 0.78, '#a9824f', { stroke: null });
  indBox(ctx, -3.6, -2.0, -3.25, -2.75, 0.74, 0.82, '#b9915a');
  for (let k = 0; k < 5; k++) indBox(ctx, -2.05, -0.85, -3.13, -2.67, 0.08 + k * 0.09, 0.13 + k * 0.09, shade('#c9a36b', -0.12 * (k % 3)), { stroke: shade(IND.timber, -0.3) });
  indCyl(ctx, -3.15, 0, -2.35, 0.29, 0.5, IND.bark, IND.timberPale);
  for (const a of [0.5, 2.3, 4.0]) indLine(ctx, [-3.15 + Math.cos(a) * 0.18, 0.55, -2.35 + Math.sin(a) * 0.18], [-3.15 + Math.cos(a) * 0.5, 1.15, -2.35 + Math.sin(a) * 0.5], COL.wood, 0.9);
  for (const x of [sh.x0 + 0.05, (sh.x0 + sh.x1) / 2, sh.x1 - 0.05]) for (const z of [sh.z0 + 0.05, sh.z1 - 0.05]) indPost(ctx, x, z, 0, sh.eave, COL.woodDark, 0.15);
  indThatch(ctx, sh.x0 - 0.1, sh.x1 + 0.1, sh.z0 - 0.1, sh.z1 + 0.1, sh.eave, sh.ridge, 'u');
  indLamp(ctx, -0.55, 1.5, -1.65, shut);
  // the store at the back right: logs between stakes and planks on stickers (the stock)
  for (const x of [0.35, 3.65]) for (const z of [-3.75, -1.71]) indPost(ctx, x, z, 0, 1.0, COL.wood, 0.1);
  const rows = [[5], [5, 4], [5, 4, 3, 2]][Math.max(1, step) - 1];
  if (step > 0) {
    rows.forEach((n, k) => {
      for (let i = 0; i < n; i++) {
        const z = -3.5 + (i + (5 - n) / 2) * 0.385;
        const y = 0.04 + 0.19 + k * 0.385 * 0.866;
        indLog(ctx, [0.4, y, z], [3.5, y, z], 0.19, shade(IND.bark, ((i + k) % 3) * 0.1 - 0.1));
      }
    });
  }
  for (const dx of [-1.2, 0, 1.2]) indBox(ctx, 2.0 + dx - 0.06, 2.0 + dx + 0.06, -1.6, -0.9, 0, 0.1, COL.wood, { stroke: null });
  const courses = [0, 3, 7, 11][step];
  if (courses) {
    indBox(ctx, 0.5, 3.5, -1.55, -0.95, 0.1, 0.1 + courses * 0.09, '#cfae77', { stroke: shade(IND.timber, -0.2) });
    indUnit(0.5, 3.5, -0.95, -0.95, 0.1, 0.1 + courses * 0.09, () => {
      ctx.strokeStyle = 'rgba(110,76,40,0.55)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let c = 1; c < courses; c++) {
        const a = indPt(0.5, 0.1 + c * 0.09, -0.95);
        const b = indPt(3.5, 0.1 + c * 0.09, -0.95);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    });
  }
  // the felled trunk with its branches half trimmed, the cut limbs on the ground
  const cy = 0.04 + 0.27 * 0.95;
  [[0.95, 1], [1.45, -1], [1.95, 1], [2.4, -1], [2.9, 1], [3.3, -1]].forEach(([x, sgn], k) => {
    indLine(ctx, [x, cy + 0.03, -0.4 + sgn * 0.22], [x + 0.08, cy + 0.14, -0.4 + sgn * (0.3 + 0.2 + (k % 3) * 0.1)], IND.bark, 1.2);
  });
  indLog(ctx, [0.35, cy, -0.4], [3.55, cy + 0.04, -0.4], 0.27, IND.bark);
  indLog(ctx, [2.9, 0.1, 0.95], [3.7, 0.13, 1.25], 0.05, IND.barkLight);
  indLog(ctx, [1.0, 0.09, 1.05], [1.7, 0.11, 1.35], 0.045, IND.barkLight);
  // the saw pit: the log high on two trestles, the sawdust under the cut, the saw in its kerf or leaning
  const sz = 2.2;
  indDisc(ctx, -0.8, 0.045, sz, 1.1, 0.7, '#e3d2a2');
  indHeap(ctx, -0.7, 0.04, sz, 0.42, 0.14, '#eddcae', '#d3c08c', 3);
  for (const x of [-2.95, -0.9]) {
    for (const d of [-1, 1]) indLine(ctx, [x, 0.04, sz + d * 0.55], [x, 1.12, sz + d * 0.12], '#8d6a40', 1.5);
    indBox(ctx, x - 0.08, x + 0.08, sz - 0.5, sz + 0.5, 1.02, 1.16, '#a9824f', { stroke: null });
  }
  indLog(ctx, [-3.5, 1.44, sz], [-0.45, 1.44, sz], 0.22, IND.bark);
  indLine(ctx, [-3.3, 1.67, sz], [-0.9, 1.67, sz], '#e8ddc0', 0.6); // the chalk line
  if (shut) {
    indLine(ctx, [-1.25, 0.04, sz + 0.95], [-1.1, 1.7, sz + 0.2], IND.iron, 1.1);
  } else {
    indLine(ctx, [-0.7, 1.06, sz], [-0.7, 2.68, sz], '#bfc4ca', 1.1);
    indLine(ctx, [-0.7, 2.68, sz - 0.2], [-0.7, 2.68, sz + 0.2], COL.wood, 1.2);
    indLine(ctx, [-0.7, 1.0, sz - 0.17], [-0.7, 1.0, sz + 0.17], COL.wood, 1.2);
    indMan(ctx, -1.1, 1.67, sz, '#a8977a', [-0.7, 2.68, sz]);
    indMan(ctx, -0.3, 0.04, sz, '#6e604f', [-0.7, 1.0, sz]);
    indMan(ctx, 1.7, 0.04, 0.5, '#8a7a5a', [1.7, 0.5, -0.1]);
  }
  // three stumps at the yard's edge, the freshest cut pale; the sledge with its load of logs; the cart's wheels
  indCyl(ctx, 3.15, 0.04, 1.1, 0.3, 0.42, '#8a5f38', '#dcc08a');
  for (const sx of [-1, 1]) {
    indBox(ctx, 1.95 + sx * 0.45 - 0.06, 1.95 + sx * 0.45 + 0.06, 1.5, 3.5, 0.04, 0.17, '#8d6a40', { stroke: null });
    indLine(ctx, [1.95 + sx * 0.45, 0.1, 3.45], [1.95 + sx * 0.45, 0.39, 3.62], '#8d6a40', 1.3);
  }
  for (let k = 0; k < 4; k++) indBox(ctx, 1.35, 2.55, 1.75 + k * 0.5, 1.85 + k * 0.5, 0.17, 0.24, '#9b744a', { stroke: null });
  [[-0.17, 0, 0.17], [0.17, 0, 0.17], [0, 0.3, 0.15]].forEach(([dx, dy, r], k) => {
    const y = 0.24 + r + dy;
    indLog(ctx, [1.95 + dx, y, 1.62 - k * 0.08], [1.95 + dx, y + 0.02, 3.3 + k * 0.05], r, shade(IND.bark, k * 0.08));
  });
  indLine(ctx, [1.95, 0.34, 3.4], [1.95, 0.59, 3.85], '#8d6a40', 1.3);
  indCyl(ctx, 3.5, 0.04, 2.2, 0.23, 0.3, '#8a5f38', '#d2b27a');
  indCyl(ctx, 0.65, 0.04, 3.35, 0.21, 0.36, '#8a5f38', '#d2b27a');
  for (const z of [3.32, 3.52]) {
    const pts = [];
    for (let k = 0; k < 20; k++) pts.push(indPt(3.3 + Math.cos((k / 20) * Math.PI * 2) * 0.5, 0.5 + Math.sin((k / 20) * Math.PI * 2) * 0.5, z));
    poly(ctx, pts, '#9a7446', IND.iron, 0.9);
  }
  indPost(ctx, 3.85, 3.7, 0, 1.2, COL.wood, 0.1);
}


// --- The iron mine and the marble quarry ------------------------------------

/** A smooth step from 0 at a to 1 at b. */
function indSmooth(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * A rounded hill of earth and rock under grass at the back of a yard, drawn as a heightfield of
 * facets (as the models draw theirs): x0..x1 across, from its back at zBack to its toe at zToe on
 * the street side, about h metres high. It falls away to the ground at its ends unless `o.left` or
 * `o.right` is false (a cut face or another hill stands there). Each facet is lit by its slope (the
 * sun is upper left): grass, going to earth where it steepens, to bare rock where it is steep.
 * Returns the height function, so boulders can be set on it.
 */
function indHill(ctx, x0, x1, zBack, zToe, h, o = {}) {
  const { left = true, right = true, seed = 0 } = o;
  const wave = (x, z) => Math.sin(x * 1.7 + seed) * Math.sin(z * 1.3 + 2.1) * 0.5 + Math.sin(x * 3.1 + z * 2.3) * 0.25;
  const hAt = (x, z) => {
    const ex = (left ? indSmooth(x0, x0 + 2.6, x) : 1) * (right ? indSmooth(x1, x1 - 2.6, x) : 1);
    const along = indSmooth(zBack - 0.2, zBack + 0.9, z) * (1 - indSmooth(zBack + 0.6, zToe, z));
    return Math.max(0, (h * (0.92 + 0.08 * Math.sin(x * 0.8 + seed)) + wave(x, z) * 0.45) * ex * along);
  };
  const nx = Math.max(3, Math.round((x1 - x0) / 0.42));
  const nz = Math.max(3, Math.round((zToe - zBack) / 0.42));
  const dx = (x1 - x0) / nx;
  const dz = (zToe - zBack) / nz;
  const grass = [111, 140, 67];
  const earth = [139, 122, 88];
  const rock = [150, 140, 122];
  const hex = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
  for (let sum = 0; sum < nx + nz - 1; sum++) {
    for (let i = Math.max(0, sum - nz + 1); i <= Math.min(nx - 1, sum); i++) {
      const j = sum - i;
      const xa = x0 + i * dx;
      const za = zBack + j * dz;
      const hs = [hAt(xa, za), hAt(xa + dx, za), hAt(xa + dx, za + dz), hAt(xa, za + dz)];
      if (Math.max(...hs) < 0.03) continue;
      // the slope of the facet across and toward the street (rising toward +x or +z faces the light)
      const su = (hs[1] + hs[2] - hs[0] - hs[3]) / (2 * dx);
      const sv = (hs[2] + hs[3] - hs[0] - hs[1]) / (2 * dz);
      const steep = Math.hypot(su, sv);
      const m = Math.max(0, Math.min(1, (steep - 0.5) / 1.5));
      const base = steep > 2.1 ? rock : grass.map((g, k) => g + (earth[k] - g) * m * 0.8);
      const lit = Math.max(-0.5, Math.min(0.5, (su + sv) * 0.3 - 0.02));
      const c = base.map((v) => Math.max(0, Math.min(255, v * (1 + lit * 0.45))));
      const col = hex(c);
      poly(ctx, [indPt(xa, hs[0], za), indPt(xa + dx, hs[1], za), indPt(xa + dx, hs[2], za + dz), indPt(xa, hs[3], za + dz)], col, col, 0.5);
    }
  }
  // boulders on the slope
  for (let k = 0; k < 4; k++) {
    const x = x0 + (x1 - x0) * (0.2 + 0.6 * hash01(seed, k, 1));
    const z = zBack + (zToe - zBack) * (0.45 + 0.4 * hash01(seed, k, 2));
    if (hAt(x, z) > 0.15) indHeap(ctx, x, hAt(x, z) * 0.9, z, 0.26, 0.2, IND.rock, shade(IND.rock, -0.25), seed + k);
  }
  return hAt;
}

/**
 * The iron mine, as the 3D model draws it: a bank of earth and weathered
 * rock under grass, cut sheer for the adit, its mouth framed in timber sets
 * with a lantern at the right post; a spoil heap spilling down the right
 * flank; the planked way with a barrow and baskets of ore; a windlass on
 * forked posts over the shaft; a clay bloomery with its skin bellows, a
 * heap of charcoal and the block the bloom is hammered on; the ore on a
 * plank floor (the stock). Staffed: the lantern lit, the furnace glowing
 * (and smoking: the renderer's smoke), the bloom on the block, a miner at
 * the adit, a man at the windlass and one hammering. Idle: picks leaning
 * at the post, the furnace out, nobody.
 */
function ironMineArt(ctx, S, variant, state) {
  const [shut, step] = indRawLook(state);
  indGround(ctx, S, '#a99c82');
  // the bank: the cut part at the left (rock face under a grass cap), the rounded hill to its right
  const aditX = -1.4;
  indBox(ctx, -3.93, 0, -3.9, -1.5, 0, 3.0, IND.rock, { right: IND.rockDark });
  indBox(ctx, -3.98, 0.03, -3.95, -1.44, 3.0, 3.25, '#8a7452', { top: '#7fa04e', right: '#6e5e42', stroke: shade('#8a7452', -0.4) });
  for (const y of [0.5, 1.0, 2.0, 2.35, 2.7]) indLine(ctx, [-3.9, y, -1.5], [-0.1, y + 0.1, -1.5], 'rgba(60,52,42,0.5)', 0.6); // the beds of the strata along the cut face
  indHill(ctx, 0, 3.93, -3.9, -0.7, 2.5, { left: false, seed: 5 });
  // the adit: a dark mouth in the face, its timber sets, the lantern at the right post
  poly(ctx, [indPt(aditX - 0.72, 0, -1.5), indPt(aditX + 0.72, 0, -1.5), indPt(aditX + 0.72, 1.75, -1.5), indPt(aditX - 0.72, 1.75, -1.5)], '#1c1814');
  for (const s of [-1, 1]) indPost(ctx, aditX + s * 0.8, -1.42, 0, 1.95, COL.wood, 0.18);
  indBox(ctx, aditX - 0.95, aditX + 0.95, -1.5, -1.34, 1.78, 2.0, COL.woodDark, { stroke: null });
  indLamp(ctx, -0.52, 1.2, -1.28, shut);
  if (shut) for (const k of [0, 1]) indLine(ctx, [-0.45 + k * 0.1, 0, -1.2], [-0.62 + k * 0.05, 1.35, -1.4], COL.wood, 0.9); // the picks against the post
  // the spoil heap down the right flank of the cut, the planked way out of the adit with a barrow and baskets of ore
  indHeap(ctx, 0.45, 0, -1.0, 0.85, 0.55, '#968a73', '#6e6453', 7);
  indQuad(ctx, aditX - 0.4, aditX + 0.4, -1.5, 0.6, 0.05, '#a07a4a', '#5e4226');
  for (let z = -1.3; z < 0.6; z += 0.3) indLine(ctx, [aditX - 0.4, 0.06, z], [aditX + 0.4, 0.06, z], '#6e4c2a', 0.5);
  indBox(ctx, aditX - 0.25, aditX + 0.25, -0.6, 0.0, 0.25, 0.5, '#8d6a40', { stroke: '#5e4226' });
  indHeap(ctx, aditX, 0.5, -0.3, 0.2, 0.12, IND.ore, IND.oreDark, 2);
  indLine(ctx, [aditX - 0.2, 0.3, 0.0], [aditX - 0.25, 0.4, 0.55], COL.wood, 0.9);
  indLine(ctx, [aditX + 0.2, 0.3, 0.0], [aditX + 0.25, 0.4, 0.55], COL.wood, 0.9);
  for (const [x, z] of [[-0.5, 0.15], [-0.95, 0.75]]) indCyl(ctx, x, 0, z, 0.24, 0.3, '#a8814a', IND.ore);
  // the ore (the stock) on its plank floor at the front left: a heap higher and wider with the store
  indBox(ctx, -3.75, -1.35, 0.65, 3.05, 0, 0.14, '#9a7448', { stroke: shade('#9a7448', -0.35) });
  if (step > 0) indHeap(ctx, -2.55, 0.14, 1.85, [0.8, 1.05, 1.2][step - 1], [0.32, 0.66, 1.0][step - 1], IND.ore, IND.oreDark, 11 + step);
  // the shaft with its windlass on forked posts, the rope hanging a basket
  indDisc(ctx, 2.45, 0.05, 0.1, 0.62, 0.62, '#17130f', '#7d7262');
  indPost(ctx, 1.7, 0.1, 0, 1.25, COL.woodDark, 0.14);
  indLine(ctx, [2.45, 1.04, 0.1], [2.45, 0.45, 0.1], '#5b5040', 0.6);
  indCyl(ctx, 2.45, 0.2, 0.1, 0.16, 0.22, '#a8814a', IND.ore);
  indLine(ctx, [1.7, 1.04, 0.1], [3.2, 1.04, 0.1], COL.wood, 1.7);
  indLine(ctx, [3.2, 1.04, 0.1], [3.32, 0.74, 0.14], COL.woodDark, 1);
  indPost(ctx, 3.2, 0.1, 0, 1.25, COL.woodDark, 0.14);
  // the bloomery: a stack of clay with its tuyere glowing while staffed, bellows of skin, charcoal, the block for the bloom
  indStand(0.9, 0, 2.3, 0.5, 1.44, () => {
  const [fx, fy] = indPt(0.9, 0, 2.3);
  ctx.fillStyle = '#b9946a';
  ctx.beginPath();
  ctx.moveTo(fx - 5.6, fy); ctx.lineTo(fx - 3.4, fy - 10.1); ctx.lineTo(fx + 3.4, fy - 10.1); ctx.lineTo(fx + 5.6, fy);
  ctx.ellipse(fx, fy, 5.6, 2.8, 0, 0, Math.PI);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.moveTo(fx + 1.5, fy + 2.7); ctx.lineTo(fx + 1.5, fy - 10.1); ctx.lineTo(fx + 3.4, fy - 10.1); ctx.lineTo(fx + 5.6, fy); ctx.ellipse(fx, fy, 5.6, 2.8, 0, 0, Math.PI * 0.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d6b78a';
  ctx.beginPath(); ctx.ellipse(fx, fy - 10.1, 3.4, 1.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shut ? '#2a2420' : '#f2742a';
  ctx.beginPath(); ctx.ellipse(fx - 2.4, fy - 1.8, 1.5, 1.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = IND.leather;
  ctx.beginPath(); ctx.moveTo(fx - 12, fy + 1); ctx.lineTo(fx - 6, fy - 2); ctx.lineTo(fx - 5, fy + 1.5); ctx.lineTo(fx - 10, fy + 3.5); ctx.closePath(); ctx.fill();
  });
  indHeap(ctx, 1.75, 0, 2.7, 0.38, 0.26, '#3a342e', '#1f1b18', 9);
  indCyl(ctx, 2.45, 0.04, 2.55, 0.25, 0.93, '#8a6a45', '#6a4a2a');
  if (!shut) {
    indStand(2.45, 0.9, 2.55, 0.3, 0.2, () => {
      const [bx, by] = indPt(2.45, 0.97, 2.55);
      ctx.fillStyle = '#f08a3a';
      ctx.beginPath(); ctx.ellipse(bx, by - 0.4, 2.6, 1.2, 0, 0, Math.PI * 2); ctx.fill();
    });
    indMan(ctx, aditX, 0.04, -0.9, '#7a6a50', [aditX, 1.2, -1.5]);
    indMan(ctx, 3.44, 0.04, 0.54, '#a8977a', [3.2, 1.04, 0.1]);
    indMan(ctx, 2.45, 0.04, 2.09, '#6e604f', [2.45, 1.0, 2.55]);
  }
}

/**
 * The marble quarry, as the 3D model draws it: a hill of limestone under a
 * grass cap, its worked face cut in three benches of fresh white stone (the
 * highest scored with the saw's kerfs and a row of wedge holes, a block
 * half freed on the second bench); the shear legs over a block on its
 * tongs with the windlass between them; two squared blocks on rollers that
 * the masons dress; a water trough; the store of squared blocks (the stock).
 * Staffed: the block hoisted, the lantern lit, a man at the crank and two
 * masons. Idle: the block let down onto rollers, nobody.
 */
function marbleQuarryArt(ctx, S, variant, state) {
  const [shut, step] = indRawLook(state);
  indGround(ctx, S, '#cfc7b4');
  const FRESH = '#ece0c4';
  const LIT = '#f6edd6';
  // the hill: its left shoulder, the worked part in three benches, the right flank
  indHill(ctx, -3.93, -3.2, -3.9, -1.0, 2.7, { right: false, seed: 21 });
  indBox(ctx, -3.2, -0.5, -3.9, -3.1, 0, 3.4, FRESH, { top: '#86a050', right: shade(FRESH, -0.25) });
  indBox(ctx, -3.3, -0.4, -3.95, -3.05, 3.38, 3.6, '#7a8f48', { top: '#86a050', left: '#9a8460', right: '#6e6040', stroke: null });
  indBox(ctx, -3.2, -0.5, -3.1, -2.3, 0, 2.5, FRESH, { top: LIT, right: shade(FRESH, -0.25) });
  indBox(ctx, -3.2, -0.5, -2.3, -1.1, 0, 1.2, FRESH, { top: LIT, right: shade(FRESH, -0.25) });
  // the saw's kerfs down the big face and the wedge holes along its head, a chisel line on each bench's edge
  indUnit(-3.1, -0.8, -3.1, -3.1, 2.6, 3.3, () => {
    ctx.strokeStyle = 'rgba(70,64,52,0.55)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = indPt(-3.0 + k * 0.33, 2.6, -3.1);
      const b = indPt(-3.0 + k * 0.33, 3.3, -3.1);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    for (let k = 0; k < 9; k++) {
      const [px, py] = indPt(-3.1 + k * 0.3, 3.2, -3.1);
      ctx.fillStyle = '#4a463e';
      ctx.fillRect(px - 0.7, py - 0.6, 1.4, 1.2);
      if (k % 3 !== 1) { ctx.fillStyle = IND.iron; ctx.fillRect(px - 0.3, py - 1.6, 0.6, 1.4); }
    }
  });
  // the block half freed on the second bench: a dark channel behind it, wedges along its top
  indQuad(ctx, -2.85, -1.05, -2.3, -2.12, 1.2, '#4a463e');
  indBox(ctx, -2.8, -1.1, -2.09, -1.35, 1.2, 1.95, LIT, { stroke: shade(FRESH, -0.45) });
  for (let k = 0; k < 5; k++) {
    indStand(-2.6 + k * 0.35, 1.95, -1.72, 0.05, 0.25, () => {
      const [px, py] = indPt(-2.6 + k * 0.35, 1.95, -1.72);
      ctx.fillStyle = IND.iron;
      ctx.fillRect(px - 0.4, py - 1, 0.8, 1.6);
    });
  }
  indHill(ctx, -0.5, 3.93, -3.9, -0.8, 2.8, { left: false, seed: 33 });
  // the squared blocks on rollers that the masons dress (the masons stand behind them), chips and dust round them
  const blocks = [[-2.9, 1.9, 1.3, 0.9], [-0.7, 1.9, 1.1, 0.9]];
  for (const [cx, cz, w, d] of blocks) indDisc(ctx, cx, 0.05, cz, w * 0.8, d * 1.1, '#e4ddca');
  if (!shut) {
    indMan(ctx, -2.9, 0.04, 1.15, '#8a7a5a', [-2.9, 0.95, 1.6]);
    indMan(ctx, -0.7, 0.04, 1.15, '#6e604f', [-0.7, 0.95, 1.6]);
  }
  for (const [cx, cz, w, d] of blocks) {
    for (const dx of [-0.35, 0.35]) indBox(ctx, cx + dx * w - 0.06, cx + dx * w + 0.06, cz - d / 2 - 0.08, cz + d / 2 + 0.08, 0.04, 0.17, '#6a4a2a', { stroke: null });
    indBox(ctx, cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, 0.17, 0.99, FRESH, { top: LIT, stroke: shade(FRESH, -0.45) });
  }
  // the shear legs, their feet at the back and their crossing forward, the windlass between them
  const apex = [1.9, 3.3, 0.1];
  indLine(ctx, apex, [1.9, 0.1, -3.0], 'rgba(90,76,56,0.8)', 0.5); // the back stay
  indLine(ctx, [1.2, 0.04, -1.0], apex, COL.woodDark, 1.7);
  indLine(ctx, [1.32, 1.04, -0.66], [2.48, 1.04, -0.66], COL.wood, 1.7);
  indLine(ctx, [2.48, 1.04, -0.66], [2.72, 0.74, -0.62], COL.woodDark, 0.9);
  if (shut) {
    // let down onto its rollers on the floor
    for (const dz of [-0.15, 0.15]) indBox(ctx, 1.4, 2.4, dz + 0.1 - 0.06, dz + 0.1 + 0.06, 0.04, 0.17, '#6a4a2a', { stroke: null });
    indBox(ctx, 1.45, 2.35, -0.35, 0.55, 0.17, 0.6, FRESH, { top: LIT, stroke: shade(FRESH, -0.45) });
  } else {
    indLine(ctx, apex, [1.9, 1.7, 0.1], '#5b5040', 0.6);
    indLine(ctx, [1.5, 1.2, 0.1], [1.9, 1.7, 0.1], IND.iron, 0.7);
    indLine(ctx, [2.3, 1.2, 0.1], [1.9, 1.7, 0.1], IND.iron, 0.7);
    indBox(ctx, 1.45, 2.35, -0.15, 0.35, 0.8, 1.22, FRESH, { top: LIT, stroke: shade(FRESH, -0.45) });
  }
  indLine(ctx, [2.6, 0.04, -1.0], apex, COL.woodDark, 1.7);
  if (!shut) indMan(ctx, 2.72, 0.04, -0.22, '#a8977a', [2.48, 1.04, -0.66]);
  // the trough, the lantern's post, and the store of squared blocks at the front right
  indBox(ctx, 3.0, 3.6, 0.25, 1.55, 0, 0.5, '#9a7448', { top: '#5a90a0', stroke: shade('#9a7448', -0.35) });
  indPost(ctx, 3.5, -0.55, 0, 1.55, COL.woodDark, 0.12);
  indLamp(ctx, 3.5, 1.55, -0.55, shut);
  const layers = [[[2, 1]], [[2, 1], [2, 1]], [[2, 2], [2, 1], [2, 1]]];
  const bearers = step > 0;
  if (bearers) for (const dx of [-0.6, 0.6]) indBox(ctx, 2.9 + dx - 0.06, 2.9 + dx + 0.06, 2.35, 3.65, 0, 0.1, COL.wood, { stroke: null });
  if (step > 0) {
    layers[step - 1].forEach(([nx, nz], k) => {
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const cx = 2.9 + (i - (nx - 1) / 2) * 0.91;
        const cz = 3.0 + (j - (nz - 1) / 2) * 0.61;
        indBox(ctx, cx - 0.425, cx + 0.425, cz - 0.275, cz + 0.275, 0.1 + k * 0.42, 0.52 + k * 0.42, shade(FRESH, -0.04 * ((i + j + k) % 3)), { top: LIT, stroke: shade(FRESH, -0.45) });
      }
    });
  }
}


// --- The workshops ----------------------------------------------------------

const IND_LINEN = '#efe9d6';
const IND_STONE = '#b6ab92';
const IND_WICKER = '#b9976a';
/** The dyes of the clothier and the weaver: woad blue, madder red, saffron, undyed linen and a sea green. */
const IND_DYES = ['#4a6fa5', '#b0413e', '#d9a441', IND_LINEN, '#4f8a7a'];

/** A table or bench: four legs under a thin top, x0..x1 by z0..z1, its top at `top` metres. */
function indTable(ctx, x0, x1, z0, z1, top, color = '#a9824f') {
  for (const x of [x0 + 0.08, x1 - 0.08]) for (const z of [z0 + 0.08, z1 - 0.08]) indPost(ctx, x, z, 0, top - 0.05, shade(color, -0.2), 0.08);
  indBox(ctx, x0, x1, z0, z1, top - 0.06, top, color, { stroke: shade(color, -0.4) });
}

/** A jar or amphora standing at (x, z), the colour of the ware inside, a dark mouth. */
function indJar(ctx, x, z, color, r = 0.17, h = 0.5, y = 0.04) {
  indCyl(ctx, x, y, z, r, h, color, '#4a3022');
}

/** A wicker basket at (x, z) with its heap of fruit or goods. */
function indBasket(ctx, x, z, fill, r = 0.26) {
  indCyl(ctx, x, 0.04, z, r, 0.3, '#a8814a', fill);
  indHeap(ctx, x, 0.34, z, r * 0.85, 0.12, fill, shade(fill, -0.3), Math.round(x * 17 + z * 5));
}

/** A tunic hung by its shoulders at model point (x, y, z). */
function indTunic(ctx, x, y, z, color) {
  indStand(x, y - 0.9, z, 0.2, 0.9, () => {
    const [px, py] = indPt(x, y, z);
    ctx.fillStyle = color;
    ctx.fillRect(px - 2, py, 4, 6);
    ctx.fillRect(px - 3.4, py, 6.8, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(px + 0.8, py + 2, 1.2, 4);
  });
}

/** A flax stook: a sheaf tied at the waist, seed heads on top. */
function indStook(ctx, x, z) {
  indStand(x, 0.04, z, 0.2, 1.3, () => {
    const [px, py] = indPt(x, 0.04, z);
    ctx.fillStyle = '#b9a76a';
    ctx.beginPath();
    ctx.moveTo(px - 3.4, py); ctx.lineTo(px - 1.3, py - 4.5); ctx.lineTo(px - 3, py - 9); ctx.lineTo(px + 3, py - 9); ctx.lineTo(px + 1.3, py - 4.5); ctx.lineTo(px + 3.4, py);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d6c690';
    ctx.fillRect(px - 1.5, py - 8.5, 1.1, 8);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(px - 1.7, py - 5, 3.4, 1);
  });
}

/**
 * The lever press of the oil and wine houses: a stone bed on which the paste in its mats is piled, the
 * long beam held at its butt between two uprights and drawn down at its free end by a windlass and a rope.
 */
function indLeverPress(ctx, pivotX, bedX, endX, z) {
  indBox(ctx, bedX - 0.7, bedX + 0.7, z - 0.45, z + 0.45, 0, 0.2, IND_STONE, { stroke: shade(IND_STONE, -0.35) });
  indBox(ctx, bedX - 0.4, bedX + 0.4, z - 0.3, z + 0.3, 0.2, 0.62, '#b79b66', { stroke: shade('#b79b66', -0.4) });
  for (const dz of [-0.2, 0.2]) indPost(ctx, pivotX, z + dz, 0, 2.2, COL.woodDark, 0.14);
  indLine(ctx, [pivotX, 1.7, z], [endX, 1.25, z], COL.wood, 3);
  indLine(ctx, [endX, 1.25, z], [endX, 0.4, z], '#5b5040', 0.6);
  indPost(ctx, endX, z, 0, 0.5, COL.woodDark, 0.16);
  indLine(ctx, [endX - 0.3, 0.4, z], [endX + 0.3, 0.4, z], COL.wood, 1.6);
}

/** The shed of every workshop, back half: the tufa footing, the back wall with its dado, the left end wall. */
function indShedBack(ctx, t) {
  const wash = t.wash;
  indBox(ctx, -3.7, 3.7, -3.7, -3.4, 0, 0.55, COL.tufa, { stroke: shade(COL.tufa, -0.35) });
  indBox(ctx, -3.7, -3.4, -3.4, -1.6, 0, 0.55, COL.tufa, { stroke: shade(COL.tufa, -0.35) });
  indBox(ctx, 3.4, 3.7, -3.4, -1.6, 0, 0.55, COL.tufa, { stroke: shade(COL.tufa, -0.35) });
  indBox(ctx, -3.7, 3.7, -3.7, -3.44, 0.55, 1.5, t.dado, { noTop: true, stroke: shade(t.dado, -0.3) });
  indBox(ctx, -3.7, 3.7, -3.7, -3.44, 1.5, 3.2, wash, { stroke: shade(wash, -0.35) });
  if (t.window !== null) {
    // a small window in the back wall, a dark opening in its plaster
    poly(ctx, [indPt(t.window - 0.35, 1.25, -3.43), indPt(t.window + 0.35, 1.25, -3.43), indPt(t.window + 0.35, 2.15, -3.43), indPt(t.window - 0.35, 2.15, -3.43)], '#2c241c');
  }
  indSideWall(ctx, -3.4, t, false);
  indBox(ctx, -3.7, -3.4, -1.64, -1.6, 0.55, 2.28, wash, { stroke: null, noTop: true }); // (the wall's end, a sliver, so the left wall reads as thick)
}

/** An end wall of the shed, sloping with the roof: its +u face at x = xf, plastered over its tufa footing with the dado along its foot. */
function indSideWall(ctx, xf, t, outer) {
  const zb = -3.44;
  const zf = -1.6;
  const hb = 3.08;
  const hf = 2.28;
  const foot = 0.55;
  poly(ctx, [indPt(xf, foot, zb), indPt(xf, foot, zf), indPt(xf, hf, zf), indPt(xf, hb, zb)], outer ? shade(t.wash, -0.2) : shade(t.wash, -0.06), shade(t.wash, -0.4), 0.5);
  poly(ctx, [indPt(xf, foot, zb), indPt(xf, foot, zf), indPt(xf, 1.5, zf), indPt(xf, 1.5, zb)], outer ? shade(t.dado, -0.2) : shade(t.dado, -0.05));
  if (outer && t.door !== false) {
    // the door in the right wall, a plank leaf in its arch
    poly(ctx, [indPt(xf, foot, -2.98), indPt(xf, foot, -2.02), indPt(xf, 2.0, -2.02), indPt(xf, 2.2, -2.5), indPt(xf, 2.0, -2.98)], '#3a2a1c');
    poly(ctx, [indPt(xf, foot, -2.9), indPt(xf, foot, -2.1), indPt(xf, 1.9, -2.1), indPt(xf, 1.9, -2.9)], '#7a5a38');
  }
}

/** The shed's front half: the right wall, the boards (when shut), the posts and plate, the tiled pitch with its antefixes, the lantern. */
function indShedFront(ctx, shut, t) {
  indSideWall(ctx, 3.7, t, true);
  indBox(ctx, 3.4, 3.7, -1.64, -1.6, 0.55, 2.28, shade(t.wash, -0.08), { stroke: null, noTop: true });
  const posts = [-3.55, -1.2, 1.2, 3.55];
  if (shut) {
    // the shop front boarded up: planks from the sill to the plate, a bar across
    for (let k = 0; k < 3; k++) {
      const a = posts[k] + 0.1;
      const b = posts[k + 1] - 0.1;
      poly(ctx, [indPt(a, 0.04, -1.62), indPt(b, 0.04, -1.62), indPt(b, 2.2, -1.62), indPt(a, 2.2, -1.62)], '#8a7456', '#5e4b34', 0.5);
      indUnit(a, b, -1.62, -1.62, 0.04, 2.2, () => {
        ctx.strokeStyle = 'rgba(70,52,34,0.6)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let j = 1; j < Math.round((b - a) / 0.3); j++) {
          const p = indPt(a + j * 0.3, 0.04, -1.62);
          const q = indPt(a + j * 0.3, 2.2, -1.62);
          ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
        }
        ctx.stroke();
      });
      indLine(ctx, [a, 1.1, -1.6], [b, 1.1, -1.6], '#4e3a26', 1.2);
    }
  }
  for (const x of posts) indBox(ctx, x - 0.09, x + 0.09, -1.74, -1.58, 0, 2.3, '#a9824f', { stroke: shade('#a9824f', -0.4) });
  indBox(ctx, -3.7, 3.7, -1.76, -1.56, 2.18, 2.4, '#9a7448', { stroke: shade('#9a7448', -0.4) });
  // one low pitch of tiles on the back wall's top, hanging over the ends and the front
  // (One unit boxed above the walls' tops, so a turn paints it after them whichever way it faces.)
  indUnit(-3.95, 3.95, -3.75, -1.35, 3.2, 3.4, () => {
    leanRoof(ctx, indU(-3.95), indV(-3.75), indU(3.95), indV(-1.35), 'v0', 3.2 * IND_H, 2.4 * IND_H, COL.terra);
    // the antefixes along the eave, one to a row of cover tiles
    for (let x = -3.7; x <= 3.71; x += 0.5) {
      const [px, py] = indPt(x, 2.4, -1.35);
      ctx.fillStyle = '#e6c49a';
      ctx.fillRect(px - 0.8, py - 0.4, 1.6, 2);
    }
  });
  indLamp(ctx, 3.34, 1.86, -1.28, shut);
}

/** The wattle fence round the yard: along the left and the street, with the gate's gap; its posts. The right side stays open. */
function indFence(ctx, side) {
  const h = 0.85;
  // (In lengths of a metre or so: a long box, turned, cannot be sorted against everything inside the yard.)
  const rail = (x0, z0, x1, z1) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.0));
    for (let k = 0; k < n; k++) {
      const a = [x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n];
      const b = [x0 + ((x1 - x0) * (k + 1)) / n, z0 + ((z1 - z0) * (k + 1)) / n];
      // (Thick across its run only, so neighbours along it touch without overlapping and sort by where they stand.)
      const padX = x0 === x1 ? 0.04 : 0;
      const padZ = z0 === z1 ? 0.04 : 0;
      indBox(ctx, Math.min(a[0], b[0]) - padX, Math.max(a[0], b[0]) + padX, Math.min(a[1], b[1]) - padZ, Math.max(a[1], b[1]) + padZ, 0.04, h, IND_WICKER, { stroke: shade(IND_WICKER, -0.4) });
    }
  };
  if (side === 'left') rail(-3.85, -1.5, -3.85, 3.8);
  else {
    rail(-3.8, 3.85, -0.95, 3.85);
    rail(0.95, 3.85, 3.85, 3.85);
    for (const x of [-0.95, 0.95]) indPost(ctx, x, 3.85, 0, 1.35, '#a9824f', 0.14);
  }
}

// The eight trades: each draws what stands under the shed and what stands in the yard, from its stores.

/** Pots on three shelves along the back wall. */
function indShelfPots(ctx, x0, x1, z, heights, shelves, count, mk) {
  for (const y of heights) indBox(ctx, x0, x1, z - 0.17, z + 0.17, y - 0.05, y, '#a9824f', { stroke: null });
  let n = 0;
  for (let s = 0; s < shelves; s++) {
    for (let k = 0; k < 6 && n < count; k++, n++) mk(x0 + 0.25 + k * ((x1 - x0 - 0.5) / 5), heights[s], z);
  }
}

function potterInside(ctx, [shut, a, , o]) {
  // the shelves along the back wall: thrown ware drying and the fired ware racked, a shelf more with each step of the stock
  indShelfPots(ctx, 0.1, 3.2, -3.2, [0.42, 0.95, 1.48], o, o * 6, (x, y, z) => indCyl(ctx, x, y, z, 0.13, 0.22, '#c7704a', '#6a3a24'));
  // the kick wheel: a heavy flywheel low on the axle, the wheelhead a hand's breadth above the potter's knees, his stool
  indCyl(ctx, -2.1, 0.04, -2.25, 0.32, 0.1, '#b98a5a');
  indPost(ctx, -2.1, -2.25, 0.1, 0.72, '#7a5632', 0.07);
  indCyl(ctx, -2.1, 0.7, -2.25, 0.2, 0.05, '#c9a77a');
  indBox(ctx, -2.3, -1.9, -1.95, -1.65, 0, 0.35, '#8d6a40', { stroke: null });
  if (!shut) indMan(ctx, -2.1, 0.35, -1.8, '#8a7a5a', [-2.1, 0.75, -2.25]);
}

function potterYard(ctx, [shut, a, , o]) {
  // the wedging table, the trough of wet clay with the lumps (the stock) in it and heaped beside it
  indUnit(-3.15, -1.95, 0.7, 1.3, 0, 1.0, () => {
    indTable(ctx, -3.15, -1.95, 0.7, 1.3, 0.86);
    indBox(ctx, -2.9, -2.4, 0.85, 1.15, 0.86, 1.0, shade(IND.clay, -0.1), { stroke: shade(IND.clay, -0.4) });
  });
  indUnit(-0.9, 0.8, 0.98, 1.52, 0, 0.6, () => {
    indBox(ctx, -0.9, 0.8, 0.98, 1.52, 0, 0.42, '#9a7448', { top: a ? shade(IND.clay, -0.2) : '#7a5a38', stroke: shade('#9a7448', -0.4) });
    for (let k = 0; k < a * 3; k++) {
      const x = -0.7 + (k % 5) * 0.28;
      indBox(ctx, x - 0.1, x + 0.1, 1.2 + (k % 2) * 0.1, 1.38 + (k % 2) * 0.1, 0.42, 0.56, shade(IND.clay, 0.05 * (k % 3)), { stroke: shade(IND.clay, -0.4) });
    }
  });
  indUnit(-0.8, 0.9, 1.7, 1.95, 0, 0.3, () => {
    for (let k = 0; k < a * 2; k++) indBox(ctx, -0.8 + k * 0.32, -0.5 + k * 0.32, 1.7, 1.95, 0, 0.2 + 0.05 * (k % 2), shade(IND.clay, 0.06 * (k % 3)), { stroke: shade(IND.clay, -0.4) });
  });
  // finished pots in rows in the yard
  for (let k = 0; k < o * 3; k++) indCyl(ctx, 0.3 + (k % 6) * 0.38, 0.04, 2.6 + Math.floor(k / 6) * 0.4, 0.13, 0.22, '#c7704a', '#6a3a24');
  // the beehive kiln: a base of clay and brick, the dome plastered over with a vent, the stoke hole to the street
  indUnit(1.35, 3.35, 0.45, 2.45, 0, 1.8, () => {
  indCyl(ctx, 2.35, 0.04, 1.45, 1.0, 0.45, '#a8774e', '#a8774e');
  const [kx, ky] = indPt(2.35, 0.49, 1.45);
  ctx.fillStyle = '#c4986e';
  ctx.beginPath(); ctx.moveTo(kx - 11.3, ky); ctx.ellipse(kx, ky, 11.3, 8.4, 0, Math.PI, Math.PI * 2); ctx.ellipse(kx, ky, 11.3, 5.65, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.moveTo(kx + 2, ky + 5.4); ctx.lineTo(kx + 2, ky - 8); ctx.ellipse(kx, ky, 11.3, 8.4, 0, Math.PI * 1.82, Math.PI * 2); ctx.ellipse(kx, ky, 11.3, 5.65, 0, 0, Math.PI * 0.45); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a8774e';
  ctx.fillRect(kx - 1.6, ky - 9.4, 3.2, 1.6); // the vent's collar
  ctx.fillStyle = shut ? '#8f6a4a' : '#ff8a2a'; // the stoke hole: glowing, or bricked up
  ctx.beginPath(); ctx.moveTo(kx - 10.4, ky + 3.2); ctx.lineTo(kx - 10.4, ky - 0.4); ctx.arc(kx - 8.3, ky - 0.4, 2.1, Math.PI, 0); ctx.lineTo(kx - 6.2, ky + 3.2); ctx.closePath(); ctx.fill();
  });
  if (!shut) indMan(ctx, 0.7, 0.04, 2.0, '#6e604f', [-0.5, 0.6, 1.25]);
}

function carpenterInside(ctx, [shut, a, , o]) {
  // the furniture in the left bay: a stool, then a chest, then a couch with the last step
  if (o >= 1) indBox(ctx, -3.25, -2.8, -3.1, -2.65, 0.04, 0.42, '#a9824f', { stroke: shade('#a9824f', -0.4) });
  if (o >= 2) {
    indBox(ctx, -2.5, -1.9, -3.2, -2.8, 0.04, 0.5, '#8d6a40', { stroke: shade('#8d6a40', -0.4) });
    indBox(ctx, -2.5, -1.9, -3.0, -2.97, 0.2, 0.28, IND.iron, { stroke: null });
  }
  if (o >= 3) {
    indBox(ctx, -3.2, -1.8, -2.5, -2.0, 0.2, 0.45, '#b6563a', { stroke: shade('#b6563a', -0.4) });
    indBox(ctx, -3.2, -3.0, -2.5, -2.0, 0.45, 0.7, '#b6563a', { stroke: shade('#b6563a', -0.4) });
  }
  // the tools on the back wall, the bench with its stop and vice
  for (const [x, y, c] of [[-0.6, 2.0, IND.iron], [0, 1.9, COL.wood], [0.7, 2.0, IND.iron], [1.4, 1.9, COL.wood]]) indLine(ctx, [x, y - 0.35, -3.42], [x, y + 0.35, -3.42], c, 0.9);
  indTable(ctx, -0.65, 1.45, -2.41, -1.79, 0.9);
  indBox(ctx, 1.25, 1.45, -2.45, -1.75, 0.9, 1.0, '#8d6a40', { stroke: null });
  indBox(ctx, 0.1, 0.4, -2.2, -2.0, 0.9, 0.96, '#c9a36b', { stroke: null });
  if (!shut) {
    indMan(ctx, 0.4, 0.04, -1.55, '#a8977a', [0.3, 0.95, -2.1]);
    indMan(ctx, -1.3, 0.04, -1.35, '#6e604f', [-1.4, 0.95, -2.2]);
  } else {
    indLine(ctx, [0.3, 0.9, -2.1], [0.6, 1.0, -2.1], '#8a7456', 1.2); // the mallet left on the bench
  }
}

function carpenterYard(ctx, [shut, a, , o]) {
  // the trestles with the baulk being dressed, shavings on the ground
  indUnit(-2.6, -0.2, 1.3, 2.1, 0, 1.05, () => {
    for (const x of [-2.2, -0.6]) {
      for (const d of [-1, 1]) indLine(ctx, [x, 0.04, 1.7 + d * 0.4], [x, 0.8, 1.7 + d * 0.1], '#8d6a40', 1.4);
      indBox(ctx, x - 0.06, x + 0.06, 1.55, 1.85, 0.74, 0.8, '#a9824f', { stroke: null });
    }
    indBox(ctx, -2.55, -0.25, 1.59, 1.81, 0.8, 1.02, '#c9a36b', { stroke: shade(IND.timber, -0.3) });
  });
  for (const [x, z] of [[0.2, -1.2], [-0.2, -1.55], [0.6, -1.7], [-0.9, 1.4], [-1.9, 1.25]]) indDisc(ctx, x, 0.045, z + (z < 0 ? 0 : 0.5), 0.2, 0.1, '#e6d4a6');
  if (!shut) indMan(ctx, -1.4, 0.04, 2.15, '#8a7a5a', [-1.4, 1.0, 1.75]);
  // the timber (the stock): squared baulks stacked in layers on sleepers, two more layers a step
  indUnit(1.9, 3.2, 0.3, 3.1, 0, 1.6, () => {
    for (const z of [0.7, 2.7]) indBox(ctx, 1.9, 3.2, z - 0.07, z + 0.07, 0, 0.1, COL.wood, { stroke: null });
    for (let k = 0; k < a * 2; k++) indBox(ctx, 2.0, 3.1, 0.4, 3.0, 0.1 + k * 0.22, 0.1 + (k + 1) * 0.22, shade('#c9a36b', -0.1 * (k % 3)), { stroke: shade(IND.timber, -0.35) });
  });
}

function oilInside(ctx, [shut, a, , o]) {
  // the settling vat in the left bay, the lever press at the middle, the amphorae of oil in rows at the front
  indCyl(ctx, -2.65, 0.04, -2.85, 0.42, 0.86, '#a8814a', '#c9a73a');
  indLeverPress(ctx, -1.5, -0.1, 2.1, -2.55);
  const counts = [0, 4, 9, 17][o];
  for (let k = 0; k < counts; k++) indJar(ctx, -3.1 + (k % 10) * 0.42 + (k >= 10 ? 0.2 : 0), k < 10 ? -1.95 : -2.35, '#b8683f', 0.17, 0.5);
  if (!shut) {
    indMan(ctx, 2.5, 0.04, -2.2, '#a8977a', [2.1, 0.8, -2.55]);
    indMan(ctx, -2.65, 0.04, -2.2, '#6e604f', [-2.65, 0.9, -2.85]);
  }
}

function oilYard(ctx, [shut, a, , o]) {
  // the trapetum in the open: the basin, the pillar, the beam with its two millstones and the bars
  indUnit(-3.2, -0.8, 0.65, 3.1, 0, 1.6, () => {
    indCyl(ctx, -2.0, 0.04, 1.55, 0.9, 0.25, IND_STONE, '#5a4a30');
    indPost(ctx, -2.0, 1.55, 0.29, 1.15, COL.woodDark, 0.16);
    indLine(ctx, [-3.1, 0.95, 1.55], [-0.9, 0.95, 1.55], COL.wood, 2.4);
    for (const x of [-2.55, -1.45]) indCyl(ctx, x, 0.29, 1.55, 0.3, 0.42, '#a39a86', '#bdb39c');
    indLine(ctx, [-2.0, 0.95, 1.55], [-2.0, 0.95, 2.6], COL.wood, 1.4);
    if (!shut) indMan(ctx, -2.0, 0.04, 2.75, '#8a7a5a', [-2.0, 0.95, 2.45]);
  });
  // the olives in baskets at the right (green and black fruit), more each step
  for (let k = 0; k < [0, 2, 5, 8][a]; k++) indBasket(ctx, 1.4 + (k % 3) * 0.7, 1.0 + Math.floor(k / 3) * 0.7, k % 2 ? '#3f4a2c' : '#7a8a3c');
}

function wineInside(ctx, [shut, a, , o]) {
  // the press under the shed and the cradle of amphorae of wine at its right-hand end
  indLeverPress(ctx, -2.9, -1.3, 0.4, -2.55);
  indBox(ctx, 2.0, 3.3, -3.3, -1.7, 0.04, 0.12, '#8d6a40', { stroke: null });
  const n = [0, 4, 8, 12][o];
  for (let k = 0; k < n; k++) {
    const layer = Math.floor(k / 4);
    const z = -3.1 + (k % 4) * 0.4;
    indLog(ctx, [2.15, 0.28 + layer * 0.3, z], [3.15, 0.28 + layer * 0.3, z], 0.17, '#b8683f', '#6a3a24');
  }
  if (!shut) indMan(ctx, 0.4, 0.04, -2.1, '#a8977a', [0.4, 0.5, -2.55]);
}

function wineYard(ctx, [shut, a, , o]) {
  // the dolia, set into the earth to their shoulders, and the treading vat with its spout running to the first
  indUnit(-3.6, -0.6, 0.7, 3.2, 0, 1.7, () => {
    for (const [x, z] of [[-3.1, 1.2], [-3.1, 2.15], [-2.5, 2.75]]) indCyl(ctx, x, 0.04, z, 0.42, 0.3, '#b8683f', '#5a3a28');
    indCyl(ctx, -1.55, 0.04, 1.4, 0.85, 0.7, '#cbb88e', '#7b2a3a');
    indLine(ctx, [-2.4, 0.3, 1.4], [-3.0, 0.3, 1.25], '#8d6a40', 1.4);
    if (!shut) {
      indMan(ctx, -1.55, 0.7, 1.4, '#a8977a', [-1.55, 1.5, 1.4]);
      indLine(ctx, [-2.3, 1.5, 1.4], [-0.8, 1.5, 1.4], COL.wood, 1.2);
    }
  });
  // baskets of grapes at the right, dark and green, more each step
  for (let k = 0; k < [0, 3, 6, 10][a]; k++) indBasket(ctx, 1.3 + (k % 4) * 0.62, 0.9 + Math.floor(k / 4) * 0.62, k % 3 ? '#4a2a4e' : '#8aa04a');
}

function weaponsInside(ctx, [shut, a, , o]) {
  // the racks along the left of the shed: shields leaning and swords hung, more each step
  indBox(ctx, -3.35, -1.65, -3.3, -3.15, 0.6, 0.68, '#8d6a40', { stroke: null });
  for (let k = 0; k < o * 2; k++) {
    indStand(-3.2 + k * 0.28, 0.6, -3.15, 0.15, 0.85, () => {
      const [px, py] = indPt(-3.2 + k * 0.28, 0.6, -3.15);
      ctx.fillStyle = k % 2 ? '#9a3a2a' : '#7a3a2a';
      ctx.beginPath(); ctx.ellipse(px, py - 5.6, 2.3, 5.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9a43a';
      ctx.beginPath(); ctx.arc(px, py - 5.6, 0.9, 0, Math.PI * 2); ctx.fill();
    });
  }
  for (let k = 0; k < o * 4; k++) indLine(ctx, [-3.25 + k * 0.14, 1.0, -3.4], [-3.25 + k * 0.14, 1.9, -3.4], k % 2 ? '#c7ccd2' : '#b8bec6', 0.8);
  // the hearth under the flue, the bellows of ox-hide on their boards, the anvil on its stump, the quench trough
  indBox(ctx, 1.65, 3.05, -3.35, -2.35, 0, 0.92, IND_STONE, { stroke: shade(IND_STONE, -0.35) });
  indQuad(ctx, 1.8, 2.9, -3.25, -2.45, 0.93, shut ? '#2a2623' : '#f26a1f');
  indBox(ctx, 1.75, 2.95, -3.42, -2.75, 1.5, 2.2, '#b8a888', { stroke: shade('#b8a888', -0.35) }); // the hood
  poly(ctx, [indPt(0.8, 0.95, -3.0), indPt(1.6, 1.1, -3.0), indPt(1.6, 1.1, -2.7), indPt(0.8, 0.95, -2.7)], IND.leather, '#4a3422', 0.5);
  indLine(ctx, [0.8, 0.95, -2.85], [0.4, 0.8, -2.85], COL.wood, 1.2);
  indCyl(ctx, 0.35, 0.04, -1.95, 0.25, 0.6, IND.bark, IND.timberPale);
  indBox(ctx, 0.1, 0.6, -2.1, -1.8, 0.64, 0.9, '#5a5f68', { top: '#7a8089', stroke: '#2a2d32' });
  indBox(ctx, -1.4, -0.5, -2.2, -1.7, 0, 0.45, IND_STONE, { top: '#4a6a80', stroke: shade(IND_STONE, -0.35) });
  if (!shut) {
    indMan(ctx, 0.35, 0.04, -1.5, '#7a6a50', [0.35, 0.95, -1.95]);
    indMan(ctx, 1.2, 0.04, -2.4, '#a8977a', [1.0, 1.0, -2.85]);
  }
}

function weaponsYard(ctx, [shut, a, , o]) {
  // the bar iron on sleepers (the stock): layers of bars, more each step
  indUnit(0.4, 1.8, 0.8, 1.8, 0, 0.6, () => {
    for (const z of [0.9, 1.7]) indBox(ctx, 0.4, 1.8, z - 0.06, z + 0.06, 0, 0.1, COL.wood, { stroke: null });
    const layers = [0, 1, 2, 4][a];
    for (let k = 0; k < layers; k++) indBox(ctx, 0.4, 1.8, 0.8, 1.8, 0.1 + k * 0.1, 0.18 + k * 0.1, shade(IND.iron, 0.06 * (k % 2)), { stroke: shade(IND.iron, -0.4) });
    // the bars side by side along the top layer
    for (let z = 0.95; layers && z < 1.8; z += 0.17) indLine(ctx, [0.45, 0.1 + layers * 0.1, z], [1.75, 0.1 + layers * 0.1, z], '#9aa2ad', 0.5);
  });
}

/** The hood's flue: through the roof (the smoke leaves its top, the renderer's effect). */
function weaponsOver(ctx) {
  indBox(ctx, 2.15, 2.55, -3.2, -2.8, 2.2, 3.82, '#b8a888', { stroke: shade('#b8a888', -0.35) });
  indBox(ctx, 2.05, 2.65, -3.3, -2.7, 3.7, 3.9, '#9a8b68', { stroke: null });
}

function fletcherInside(ctx, [shut, a, c, o]) {
  // shaft bundles standing against the back wall at the left (the timber), feathers on pegs
  for (let k = 0; k < Math.min(3, a + 1); k++) {
    indLine(ctx, [-3.1 + k * 0.25, 0.04, -3.3], [-3.0 + k * 0.25, 1.6, -3.42], '#d2b27a', 1.6);
    indLine(ctx, [-3.1 + k * 0.25, 1.1, -3.3], [-3.0 + k * 0.25, 1.1, -3.3], '#4a3422', 1.2);
  }
  for (let k = 0; k < 4; k++) indLine(ctx, [-2.2 + k * 0.22, 1.9, -3.42], [-2.2 + k * 0.22, 1.55, -3.42], '#f2eee6', 1.3);
  // the low bench where the heads are bound in, a stool, a pot of glue
  indTable(ctx, -2.25, -0.75, -2.45, -1.85, 0.62);
  indBox(ctx, -2.0, -1.8, -2.25, -2.05, 0.62, 0.8, '#8a6a45', { stroke: null });
  indBox(ctx, -1.5, -1.1, -1.55, -1.25, 0, 0.35, '#8d6a40', { stroke: null });
  // the hung bows and the sheaves of arrows at the right of the shed, more each step of the work
  for (let k = 0; k < o; k++) {
    const x = 1.5 + k * 0.55;
    indUnit(x - 0.3, x + 0.3, -3.42, -3.42, 1.0, 1.9, () => {
      const [px, py] = indPt(x, 1.9, -3.42);
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(px, py + 5, 5.2, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); ctx.stroke();
      ctx.strokeStyle = '#e8ddc0';
      ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(px - 3.9, py + 1.4); ctx.lineTo(px + 3.9, py + 1.4); ctx.stroke();
    });
    indLine(ctx, [x + 0.15, 0.04, -3.0], [x + 0.25, 1.1, -3.1], '#b89a64', 1.4);
    indStand(x + 0.17, 0.2, -3.0, 0.05, 0.2, () => {
      ctx.fillStyle = '#f2eee6';
      const [fx, fy] = indPt(x + 0.17, 0.3, -3.0);
      ctx.fillRect(fx - 1, fy - 2, 2, 2);
    });
  }
  if (!shut) indMan(ctx, -1.55, 0.35, -2.0, '#a8977a', [-1.5, 0.7, -2.15]);
}

function fletcherYard(ctx, [shut, a, c, o]) {
  // timber billets stacked on the left of the yard, the box of iron heads and bars right of it
  indUnit(-2.7, -1.5, 0.5, 1.1, 0, 0.6, () => {
    for (let k = 0; k < [0, 1, 2, 3][a]; k++) indBox(ctx, -2.7, -1.5, 0.5, 1.1, 0.04 + k * 0.14, 0.04 + (k + 1) * 0.14, shade('#c9a36b', -0.08 * (k % 2)), { stroke: shade(IND.timber, -0.35) });
  });
  indUnit(2.4, 3.0, 0.7, 1.1, 0, 0.5, () => {
    indBox(ctx, 2.4, 3.0, 0.7, 1.1, 0.04, 0.32, '#8d6a40', { stroke: shade('#8d6a40', -0.4) });
    if (c) indBox(ctx, 2.46, 2.94, 0.76, 1.04, 0.3, 0.32 + c * 0.05, IND.iron, { stroke: null });
  });
  // the target butt: a coil of straw on a frame, facing the archer, who tries a bow at it
  indUnit(-3.3, -3.0, 0.9, 2.6, 0, 1.6, () => {
    for (const z of [1.05, 2.45]) indPost(ctx, -3.2, z, 0, 1.5, COL.wood, 0.1);
    const ring = (rad, col) => {
      const pts = [];
      for (let k = 0; k < 20; k++) pts.push(indPt(-3.1, 0.8 + Math.sin((k / 20) * Math.PI * 2) * rad, 1.75 + Math.cos((k / 20) * Math.PI * 2) * rad));
      poly(ctx, pts, col);
    };
    ring(0.7, '#cfb46a'); ring(0.5, '#f2eee6'); ring(0.33, '#b0413e'); ring(0.15, '#e8c24a');
  });
  if (!shut) indMan(ctx, 0.1, 0.04, 1.75, '#6e604f', [-0.2, 0.95, 1.55]);
}

function linenInside(ctx, [shut, a, , o]) {
  // the bolts of linen stacked in the bay at the right, three then eight then fourteen
  indBox(ctx, 1.6, 3.3, -3.3, -1.7, 0.04, 0.12, '#8d6a40', { stroke: null });
  const layers = [0, [3], [3, 3, 2], [3, 3, 3, 3, 2]][o] || [];
  for (let k = 0; k < layers.length; k++) {
    for (let i = 0; i < layers[k]; i++) {
      const z = -3.0 + i * 0.5 + (k % 2) * 0.2;
      indLog(ctx, [1.75, 0.3 + k * 0.28, z], [3.15, 0.3 + k * 0.28, z], 0.13, IND_LINEN, '#d6cfb8');
    }
  }
  // the warp-weighted loom: two uprights leaning on the wall, the cloth beam across them, the woven cloth hanging from it
  // and the warp below, each bunch tied to a clay weight; the weaver at it
  const [lx0, lx1] = [-1.65, -0.15];
  for (const x of [lx0, lx1]) indLine(ctx, [x, 0.04, -2.6], [x, 1.9, -3.15], COL.woodDark, 1.5);
  poly(ctx, [indPt(lx0, 1.85, -3.14), indPt(lx1, 1.85, -3.14), indPt(lx1, 1.35, -3.0), indPt(lx0, 1.35, -3.0)], IND_LINEN, '#bfb59a', 0.4);
  indUnit(lx0, lx1, -3.0, -2.72, 0.3, 1.35, () => {
    ctx.strokeStyle = '#f4efe0';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    for (let k = 0; k <= 9; k++) {
      const x = lx0 + 0.08 + k * ((lx1 - lx0 - 0.16) / 9);
      const p = indPt(x, 1.35, -3.0);
      const q = indPt(x, 0.5, -2.74);
      ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
    ctx.fillStyle = '#9a5a36';
    for (let k = 0; k <= 9; k += 2) {
      const [px, py] = indPt(lx0 + 0.08 + k * ((lx1 - lx0 - 0.16) / 9), 0.42, -2.72);
      ctx.beginPath(); ctx.arc(px, py, 1.1, 0, Math.PI * 2); ctx.fill();
    }
  });
  indLine(ctx, [lx0, 1.9, -3.15], [lx1, 1.9, -3.15], COL.wood, 1.8);
  if (!shut) indMan(ctx, -0.9, 0.04, -2.3, '#cfc6ab', [-0.9, 1.1, -2.95]);
}

function linenYard(ctx, [shut, a, , o]) {
  // the dye vat in the yard, woad blue
  indUnit(1.7, 2.9, 0.9, 2.0, 0, 1.4, () => {
    indCyl(ctx, 2.3, 0.04, 1.45, 0.5, 0.65, '#8a6a4a', '#3f5f8f');
    indLine(ctx, [2.3, 0.7, 1.45], [2.7, 1.35, 1.2], COL.wood, 0.9);
  });
  // the flax in stooks at the left (the stock): three, six, ten, and hanks on a rail with the last step
  const spots = [[-3.0, 1.0], [-2.5, 1.2], [-2.0, 1.0], [-3.0, 1.6], [-2.5, 1.8], [-2.0, 1.6], [-3.0, 2.2], [-2.5, 2.4], [-2.0, 2.2], [-1.5, 1.6]];
  for (let k = 0; k < [0, 3, 6, 10][a]; k++) indStook(ctx, ...spots[k]);
  if (a >= 3) {
    indUnit(-1.3, 0.5, 2.8, 3.0, 0, 1.45, () => {
      for (const x of [-1.2, 0.4]) indPost(ctx, x, 2.9, 0, 1.4, COL.wood, 0.08);
      indLine(ctx, [-1.2, 1.35, 2.9], [0.4, 1.35, 2.9], COL.wood, 1.2);
      for (let k = 0; k < 4; k++) indLine(ctx, [-1.0 + k * 0.4, 1.35, 2.9], [-1.0 + k * 0.4, 0.8, 2.9], '#d6c690', 1.6);
    });
  }
  if (!shut) indMan(ctx, -1.2, 0.04, 2.35, '#d9c9a8', [-1.4, 0.7, 2.0]);
}

function clothingInside(ctx, [shut, a, , o]) {
  // the rail of garments along the back wall and the shelf of folded cloth at the right: three, seven, eleven pieces
  indLine(ctx, [-3.2, 1.7, -3.3], [0.6, 1.7, -3.3], COL.wood, 1.2);
  for (let k = 0; k < Math.min(7, [0, 3, 7, 11][o]); k++) indTunic(ctx, -3.0 + k * 0.5, 1.7, -3.3, IND_DYES[k % IND_DYES.length]);
  indBox(ctx, 1.2, 3.2, -3.35, -3.0, 0.9, 0.96, '#a9824f', { stroke: null });
  for (let k = 0; k < Math.max(0, [0, 3, 7, 11][o] - 7); k++) indBox(ctx, 1.4 + k * 0.45, 1.8 + k * 0.45, -3.3, -3.05, 0.96, 1.14, IND_DYES[(k + 1) % IND_DYES.length], { stroke: null });
  // the cutting table with cloth laid on it, the tailor sewing on his stool at the left
  indTable(ctx, -1.35, 0.55, -2.45, -1.55, 0.92);
  indBox(ctx, -1.0, 0.1, -2.3, -1.7, 0.92, 0.95, IND_LINEN, { stroke: null });
  indBox(ctx, -2.85, -2.35, -2.65, -2.15, 0, 0.4, '#8d6a40', { stroke: null });
  if (!shut) {
    indMan(ctx, -2.6, 0.4, -2.4, '#4a6fa5', [-2.5, 0.7, -2.1]);
    indMan(ctx, -0.4, 0.04, -1.25, '#a8977a', [-0.4, 0.95, -2.0]);
  }
}

function clothingYard(ctx, [shut, a, , o]) {
  // the bolts of linen on a pallet at the left (the stock), three, seven, twelve
  indUnit(-3.1, -1.9, 0.9, 2.1, 0, 1.1, () => {
    indBox(ctx, -3.1, -1.9, 0.9, 2.1, 0.04, 0.12, '#8d6a40', { stroke: null });
    const n = [0, 3, 7, 12][a];
    for (let k = 0; k < n; k++) {
      const layer = Math.floor(k / 4);
      const z = 1.1 + (k % 4) * 0.28;
      indLog(ctx, [-3.0, 0.26 + layer * 0.27, z], [-2.0, 0.26 + layer * 0.27, z], 0.12, IND_LINEN, '#d6cfb8');
    }
  });
  // the fuller's tub, the cloth trodden in it
  indUnit(1.5, 2.9, 0.65, 2.05, 0, 1.7, () => {
    indCyl(ctx, 2.2, 0.04, 1.35, 0.7, 0.55, '#9a7a50', '#b9b08a');
    if (!shut) indMan(ctx, 2.2, 0.5, 1.35, '#a8977a', [2.2, 1.0, 1.35]);
  });
}

/** Each trade: its plaster and dado, the window in its back wall, and what it draws under the shed, in the yard and over the roof. */
const IND_TRADES = {
  pottery_ws: { wash: COL.plaster, dado: COL.dado, window: -1.0, ground: '#cbbb98', inside: potterInside, yard: potterYard },
  furniture_ws: { wash: '#e6d09c', dado: '#8a3a30', window: 2.2, ground: '#d2c29c', inside: carpenterInside, yard: carpenterYard },
  oil_ws: { wash: '#e8cdb4', dado: '#b5703a', window: -2.4, ground: '#c8b892', inside: oilInside, yard: oilYard },
  wine_ws: { wash: COL.plaster, dado: '#8a3a30', window: 0.2, ground: '#c4b48c', inside: wineInside, yard: wineYard },
  weapons_ws: { wash: '#d8d0bc', dado: '#8a3a30', window: null, ground: '#b9ac90', inside: weaponsInside, yard: weaponsYard, over: weaponsOver },
  fletcher_ws: { wash: '#e6d09c', dado: COL.dado, window: 2.4, ground: '#c9b98f', inside: fletcherInside, yard: fletcherYard },
  linen_ws: { wash: COL.plaster, dado: '#b5703a', window: -2.3, ground: '#c9bb99', inside: linenInside, yard: linenYard },
  clothing_ws: { wash: '#e8cdb4', dado: COL.dado, window: 2.4, ground: '#cbbb9a', inside: clothingInside, yard: clothingYard },
};

/**
 * The eight workshops, as the 3D models draw them, on one shed: a plastered
 * shed over a tufa footing with a red dado, open to the street under one
 * pitch of tiles with antefixes, a wattle fence round the yard before it,
 * and the trade's fittings under the shed and in the yard (the potter's
 * kick wheel and beehive kiln; the carpenter's bench and trestles; the oil
 * press's trapetum and lever press; the winery's treading vat and dolia;
 * the smith's forge under its hood with bellows and anvil; the fletcher's
 * bench and target butt; the weaver's warp-weighted loom and dye vat; the
 * clothier's cutting table, rail of tunics and fuller's tub). The raw
 * material and the product show in steps (the art state's stores); idle,
 * the shop front is boarded up, the fire out, nobody at work.
 */
function workshopArt(ctx, S, variant, state, key) {
  const t = IND_TRADES[key];
  const look = indWsLook(state);
  indGround(ctx, S, t.ground);
  indFence(ctx, 'left');
  indShedBack(ctx, t);
  // (Everything under the shed is one unit: a turned drawing sorts it against the walls and the roof, and what
  // stands on or against what else in it keeps the order it was drawn in.)
  indUnit(-3.4, 3.4, -3.4, -1.7, 0, 2.4, () => t.inside(ctx, look));
  indShedFront(ctx, look[0], t);
  if (t.over) t.over(ctx, look);
  t.yard(ctx, look);
  indFence(ctx, 'front');
}


// ---------------------------------------------------------------------------
// Storage & markets
// ---------------------------------------------------------------------------

function marketArt(ctx, S) {
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, '#d6cab0');
  const stalls = [[0.2, 0.2], [1.1, 0.2], [0.2, 1.1], [1.1, 1.1]];
  const awnings = ['#b8573a', '#5d7fa3', '#d9a13a', '#7a9c5a'];
  stalls.forEach(([u, v], k) => {
    box(ctx, u, v, 0.7, 0.55, 0, 6, COL.wood, { top: '#a9875c' });
    // poles
    for (const [pu, pv] of [[u + 0.05, v + 0.6], [u + 0.65, v + 0.6]]) {
      const [x, y] = P(pu, pv);
      ctx.fillStyle = COL.woodDark;
      ctx.fillRect(x - 0.5, y - 14, 1, 14);
    }
    // striped awning
    poly(ctx, [P(u - 0.05, v - 0.05, 16), P(u + 0.75, v - 0.05, 16), P(u + 0.75, v + 0.7, 12), P(u - 0.05, v + 0.7, 12)], awnings[k], shade(awnings[k], -0.4), 0.5);
    for (let s = 1; s < 4; s += 2) {
      const a = u - 0.05 + (s / 4) * 0.8;
      poly(ctx, [P(a, v - 0.05, 16), P(a + 0.2, v - 0.05, 16), P(a + 0.2, v + 0.7, 12), P(a, v + 0.7, 12)], '#f2eee6');
    }
    // goods on the counter
    const [x, y] = P(u + 0.35, v + 0.3, 6);
    ctx.fillStyle = ['#e4c35a', '#6aa84f', '#d9534f', '#c7643e'][k];
    ctx.beginPath(); ctx.arc(x, y - 1, 2.2, 0, Math.PI * 2); ctx.fill();
  });
}

function granaryArt(ctx, S) {
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, '#bfae88');
  // raised floor on piers
  box(ctx, 0.15, 0.15, S - 0.3, 1.6, 0, 5, COL.stoneDark);
  box(ctx, 0.2, 0.2, S - 0.4, 1.5, 5, 20, COL.cream);
  gableRoof(ctx, 0.2, 0.2, S - 0.4, 1.5, 25, 12, COL.terra, 'u');
  windows(ctx, 'left', 0.2, 0.2, S - 0.2, 1.7, 5, 1, 6, '#5a4a3a', { z: 16, h: 3, w: 0.1 });
  door(ctx, 'left', 0.2, 0.2, S - 0.2, 1.7, 5, 0.5, '#4a3222', 0.3, 12);
  // ramp
  poly(ctx, [P(1.2, 1.7, 5), P(1.8, 1.7, 5), P(1.8, 2.2, 0), P(1.2, 2.2, 0)], '#a08a5c');
}

/**
 * The Horreum as the 3D model draws it: a Republican storehouse of four
 * low ranges round a court, their roofs of tiles falling into the court so
 * the goods show over the walls. The street walls are tufa (a darker
 * plinth of ashlar, paler blocks above), the court walls rubble plastered
 * with a red dado; the one gate, in the front range, stands between two
 * tufa piers that rise over the wall, with a timber lintel, a small tiled
 * hood over the doors and a terracotta plaque of the owners' names above.
 * No fired brick (that is the Empire's), and no office: the ranges are the
 * store.
 */
function warehouseArt(ctx, S) {
  const w = 0.56; // the ranges' depth: the court is the 3 x 3 grid of bays in what is left
  const hi = 17; // the street walls' height (the roofs rise to it)
  const lo = 12; // the court walls' height (where the roofs end)
  const edge = S - 0.1; // the front wall's outer face (the hood reaches to the footprint's edge)
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, '#b9a987');
  quad(ctx, w, w, S - w, S - w, 0, '#c2b391'); // the court's beaten floor
  // bay markings: the boards the goods stand on
  ctx.strokeStyle = 'rgba(90,70,40,0.35)';
  ctx.lineWidth = 0.7;
  for (const [u0, v0] of WAREHOUSE_BAYS) {
    const pts = [P(u0, v0), P(u0 + 0.6, v0), P(u0 + 0.6, v0 + 0.6), P(u0, v0 + 0.6)];
    ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
  }
  // the back and left ranges: court walls plastered, roofs falling toward the court
  plastered(ctx, 0.04, 0.04, S - 0.08, w - 0.04, 0, lo, { dado: 4 });
  leanRoof(ctx, 0.02, 0.02, S - 0.02, w + 0.04, 'v0', hi, lo - 0.5);
  plastered(ctx, 0.04, w, w - 0.04, S - 2 * w, 0, lo, { dado: 4 });
  leanRoof(ctx, 0.02, w, w + 0.04, S - w, 'u0', hi, lo - 0.5);
  // the right range: its street wall to the +u side, tufa
  box(ctx, S - w, w, w - 0.04, S - 2 * w, 0, 6, COL.tufaDark, { plain: true, noTop: true });
  box(ctx, S - w, w, w - 0.04, S - 2 * w, 6, hi - 6, COL.tufa);
  leanRoof(ctx, S - w - 0.04, w, S - 0.02, S - w, 'u1', hi, lo - 0.5);
  // the front range with its gate between two piers
  const g0 = S / 2 - 0.25;
  const g1 = S / 2 + 0.25;
  const front = (u0, u1) => {
    box(ctx, u0, S - w - 0.04, u1 - u0, edge - (S - w - 0.04), 0, 6, COL.tufaDark, { plain: true, noTop: true });
    box(ctx, u0, S - w - 0.04, u1 - u0, edge - (S - w - 0.04), 6, hi - 6, COL.tufa);
  };
  front(0.04, g0 - 0.15);
  front(g1 + 0.15, S - 0.04);
  leanRoof(ctx, 0.02, S - w - 0.04, S - 0.02, edge, 'v1', hi, lo - 0.5);
  // the piers rise over the wall; the lintel and the gate's leaves between them
  for (const u of [g0 - 0.15, g1]) box(ctx, u, S - w - 0.04, 0.15, edge - (S - w - 0.04), 0, hi + 4, COL.tufa);
  box(ctx, g0, edge - 0.14, g1 - g0, 0.14, 11, 6, COL.wood, { plain: true });
  door(ctx, 'left', g0, S - w - 0.04, g1, edge, 0, 0.5, COL.woodDark, g1 - g0 - 0.04, 11);
  // the small tiled hood on its brackets over the doors, and the plaque above it
  leanRoof(ctx, g0 - 0.05, edge, g1 + 0.05, edge + 0.09, 'v0', 14, 11.5);
  poly(ctx, [P(g0 + 0.04, edge, 17.5), P(g1 - 0.04, edge, 17.5), P(g1 - 0.04, edge, 21.5), P(g0 + 0.04, edge, 21.5)], '#b8573a', '#f1e6c8', 0.8);
}

/** Where goods stacks go in a warehouse court (u0, v0 of each 0.6 tile bay): a 3 x 3 grid less the middle of the front row, the way in from the gate; the far bays fill first. */
export const WAREHOUSE_BAYS = [
  [0.6, 0.6], [1.2, 0.6], [0.6, 1.2], [1.8, 0.6], [1.2, 1.2], [0.6, 1.8], [1.8, 1.2], [1.8, 1.8],
];


/**
 * Draw goods stacks (dynamic, every frame) inside a warehouse sprite's local
 * space; turned with the warehouse, its office drawn again over any stack
 * it stands in front of (turn.js drawTurnedOver).
 */
export function drawWarehouseStock(ctx, stock, turn = 0, snow = 0) {
  return drawTurnedOver(ctx, 3, turn, (c) => overArt(c, snow, () => warehouseArt(c, 3)), (c) => warehouseCrates(c, stock), `warehouse:${snow}`);
}

/** The building's own art drawn again over live details: as in its sprite (snow, bare flag poles). */
function overArt(ctx, snow, fn) {
  liveFlags = true;
  setRoofSnow(snow);
  try { fn(); } finally { liveFlags = false; setRoofSnow(0); }
}

function warehouseCrates(ctx, stock) {
  let bay = 0;
  for (const [good, amount] of Object.entries(stock)) {
    if (amount < 1) continue;
    let crates = Math.ceil(amount / 100);
    while (crates > 0 && bay < WAREHOUSE_BAYS.length) {
      const inBay = Math.min(4, crates);
      crates -= inBay;
      const [u0, v0] = WAREHOUSE_BAYS[bay++];
      const color = GOODS[good]?.color || '#999';
      for (let k = 0; k < inBay; k++) {
        const du = (k % 2) * 0.28;
        const dv = Math.floor(k / 2) * 0.28;
        box(ctx, u0 + 0.04 + du, v0 + 0.04 + dv, 0.24, 0.24, 0, 6, color, { stroke: shade(color, -0.5) });
      }
    }
  }
}

/** Granary fill indicator: grain sacks in front of the building. */
export function drawGranaryStock(ctx, S, fill, turn = 0, snow = 0) {
  return drawTurnedOver(ctx, S, turn, (c) => overArt(c, snow, () => granaryArt(c, S)), (c) => granarySacks(c, S, fill), `granary:${snow}`);
}

function granarySacks(ctx, S, fill) {
  const sacks = Math.round(fill * 10);
  for (let k = 0; k < sacks; k++) {
    const u = 0.35 + (k % 5) * 0.3;
    const v = S - 0.55 + Math.floor(k / 5) * 0.25;
    const [x, y] = P(u, v);
    ctx.fillStyle = '#d9c28a';
    ctx.beginPath(); ctx.ellipse(x, y - 3, 3.4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9a8350';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

function genericArt(ctx, S) {
  quad(ctx, 0.04, 0.04, S - 0.04, S - 0.04, 0, COL.paving);
  box(ctx, 0.15, 0.15, S - 0.3, S - 0.3, 0, 14, COL.cream);
  hipRoof(ctx, 0.15, 0.15, S - 0.3, S - 0.3, 14, 8, COL.terra);
}


// ---------------------------------------------------------------------------
// Military
// ---------------------------------------------------------------------------

/** Small ground tent (a gable roof sitting on the earth). */
function tent(ctx, u, v, color = '#e3d7bb') {
  gableRoof(ctx, u, v, 0.42, 0.34, 0, 8, color, 'u', 0);
}

function barracksArt(ctx, S) {
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#b4a47e'); // packed-earth drill yard
  // long dormitory block along the back
  box(ctx, 0.12, 0.12, S - 0.24, 1.0, 0, 18, '#d9ccb0');
  gableRoof(ctx, 0.12, 0.12, S - 0.24, 1.0, 18, 8, COL.slate, 'u');
  windows(ctx, 'left', 0.12, 0.12, S - 0.12, 1.12, 0, 1, 6, '#3f3126', { z: 8, h: 4 });
  door(ctx, 'left', 0.12, 0.12, S - 0.12, 1.12, 0, 0.5, '#4a3222', 0.24, 10);
  // armory wing along the left side
  box(ctx, 0.12, 1.22, 0.9, S - 1.34, 0, 14, '#cfc1a2');
  gableRoof(ctx, 0.12, 1.22, 0.9, S - 1.34, 14, 7, shade(COL.slate, 0.08), 'v');
  door(ctx, 'right', 0.12, 1.22, 1.02, S - 0.12, 0, 0.5, '#4a3222', 0.24, 9);
  // wooden training posts in the yard
  for (const [u, v] of [[1.5, 1.6], [2.15, 1.6], [1.5, 2.35], [2.15, 2.35]]) {
    const [x, y] = P(u, v);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(x + 2, y, 3, 1.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.woodDark;
    ctx.fillRect(x - 1, y - 11, 2, 11);
  }
  // spear rack
  const [rx, ry] = P(S - 0.22, 1.55);
  ctx.fillStyle = COL.wood;
  ctx.fillRect(rx - 6, ry - 8, 12, 1.4);
  ctx.strokeStyle = '#b8bec6';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let k = 0; k < 4; k++) { ctx.moveTo(rx - 4.5 + k * 3, ry); ctx.lineTo(rx - 4.5 + k * 3, ry - 15); }
  ctx.stroke();
  flagPoles(ctx, 'barracks', S);
}

/**
 * Military Academy: a sanded drill yard with the ranks' lines raked into it,
 * a colonnaded hall along the back, training posts (the pali recruits strike
 * with wooden swords) with a wicker shield hung on one, a rack of practice
 * javelins, and the instructor's stone tribunal flying the standard.
 */
function militaryAcademyArt(ctx, S) {
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#cdb88c'); // the sanded yard
  // the ranks' lines raked in the sand
  ctx.strokeStyle = 'rgba(120,96,60,0.35)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (const v of [1.45, 1.85, 2.25, 2.65]) {
    const [ax, ay] = P(0.25, v);
    const [bx, by] = P(S - 0.9, v);
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  }
  ctx.stroke();
  // the hall along the back, its colonnade facing the yard
  box(ctx, 0.1, 0.1, S - 0.2, 0.62, 0, 17, '#ddd0b2');
  windows(ctx, 'right', 0.1, 0.1, S - 0.1, 0.72, 0, 1, 2, '#3f3126', { z: 8, h: 4 });
  colonnade(ctx, 0.2, 0.98, S - 0.2, 0.98, 7, 0, 17, COL.marble, 1.5);
  gableRoof(ctx, 0.06, 0.06, S - 0.12, 0.98, 17, 9, COL.terra, 'u', 0.04);
  // the instructor's tribunal at the right of the yard, the standard on it
  box(ctx, S - 0.62, 1.12, 0.42, 0.42, 0, 5, shade(COL.stone, 0.08));
  flagPoles(ctx, 'military_academy', S);
  // training posts in rows, a wicker shield hung on the first
  for (const [u, v] of [[0.55, 1.65], [1.05, 1.65], [0.55, 2.3], [1.05, 2.3], [1.55, 2.3]]) {
    const [x, y] = P(u, v);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(x + 2, y, 3, 1.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.woodDark;
    ctx.fillRect(x - 1.1, y - 13, 2.2, 13);
  }
  const [sx, sy] = P(0.55, 1.65, 7);
  ctx.fillStyle = '#b89a5a';
  ctx.beginPath(); ctx.ellipse(sx + 2.2, sy, 2.6, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7a6236';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.ellipse(sx + 2.2, sy, 1.5, 2.4, 0, 0, Math.PI * 2); ctx.stroke();
  // the rack of practice javelins at the front right
  const [rx, ry] = P(S - 0.25, 2.35);
  ctx.fillStyle = COL.wood;
  ctx.fillRect(rx - 6, ry - 8, 12, 1.4);
  ctx.strokeStyle = '#c8b48a';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let k = 0; k < 5; k++) { ctx.moveTo(rx - 5 + k * 2.5, ry); ctx.lineTo(rx - 5 + k * 2.5, ry - 16); }
  ctx.stroke();
}

/**
 * A run of sharpened stakes (a palisade) standing on the plane `along` ('u':
 * the run goes along u at v = c, 'v': along v at u = c) from a0 to a1, from
 * height z0 up h px, their tops cut to uneven heights. Each stake is a
 * polygon of its own, so the outline between them shows and a turned
 * drawing sorts them with the rest.
 */
function stakeRun(ctx, along, c, a0, a1, z0, h) {
  const n = Math.max(2, Math.round((a1 - a0) / 0.09));
  const w = (a1 - a0) / n / 2;
  const at = (a, z) => (along === 'u' ? P(a, c, z) : P(c, a, z));
  for (let k = 0; k < n; k++) {
    const m = a0 + (k * 2 + 1) * w;
    const top = z0 + h - 1 + ((k * 7) % 3) * 1.4;
    poly(ctx, [at(m - w, z0), at(m + w, z0), at(m + w, top), at(m, top + 3), at(m - w, top)], k % 2 ? '#a07f4f' : '#8d6d42', '#4d3820', 0.4);
  }
}

/** A watch platform at a fort's corner: a deck of boards on four posts (no roof), 2 m up. */
function watchPlatform(ctx, u, v) {
  const s = 0.36;
  for (const [pu, pv] of [[u + 0.03, v + 0.03], [u + s - 0.03, v + 0.03], [u + 0.03, v + s - 0.03], [u + s - 0.03, v + s - 0.03]]) {
    column(ctx, pu, pv, 0, 11, COL.wood, 0.8);
  }
  box(ctx, u, v, s, s, 11, 1.4, '#a98a5c', { plain: true });
}

/**
 * A fort as the 3D model draws it: a camp of the Republic of earth and
 * timber, with no stone curtain. A ditch round it, the earth thrown up
 * inside into a turf-faced bank (1.2 m), and on the bank a palisade of
 * sharpened stakes (about 2.5 m above the ground); a watch platform on
 * posts at each corner, and over the gate a timber tower (about 4.85 m)
 * with a deck, a roof of boards and a painted board in its soldiers' colour.
 * Inside tents (legion, archers) or a stable (cavalry). Flies its
 * soldiers' color.
 */
function fortArt(ctx, S, variant, state, key) {
  const unit = BUILDINGS[key]?.unit;
  const color = UNIT_TYPES[unit]?.color || '#a8322b';
  const dirt = '#a99a74';
  const bank = 7; // the bank's height (1.2 m)
  const stakes = 9; // what the stakes add above the bank (to about 2.5 m)
  const g0 = S / 2 - 0.34; // the passage (FORT_GATEWAY's 0.64 tile)
  const g1 = S / 2 + 0.34;
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, dirt);
  // the ditch outside the bank: a dark channel on every side, broken by the causeway at the gate
  const ditch = '#5f5035';
  quad(ctx, 0.02, 0.02, S - 0.02, 0.14, 0, ditch);
  quad(ctx, 0.02, 0.14, 0.14, S - 0.14, 0, ditch);
  quad(ctx, S - 0.14, 0.14, S - 0.02, S - 0.14, 0, ditch);
  quad(ctx, 0.02, S - 0.14, g0 - 0.05, S - 0.02, 0, ditch);
  quad(ctx, g1 + 0.05, S - 0.14, S - 0.02, S - 0.02, 0, ditch);
  // the back and left banks with their stakes, and the platforms on the back corners
  box(ctx, 0.14, 0.14, S - 0.28, 0.26, 0, bank, COL.turf, { plain: true });
  box(ctx, 0.14, 0.4, 0.26, S - 0.8, 0, bank, COL.turf, { plain: true });
  stakeRun(ctx, 'u', 0.2, 0.17, S - 0.17, bank, stakes);
  stakeRun(ctx, 'v', 0.2, 0.17, S - 0.17, bank, stakes);
  watchPlatform(ctx, 0.17, 0.17);
  watchPlatform(ctx, S - 0.53, 0.17);
  watchPlatform(ctx, 0.17, S - 0.53);
  // interior
  if (key === 'fort_cavalry') {
    box(ctx, 0.55, 0.6, 0.5, S - 1.2, 0, 9, COL.wood);
    gableRoof(ctx, 0.55, 0.6, 0.5, S - 1.2, 9, 5, '#7a5a3a', 'v');
    const [hx, hy] = P(1.7, 1.2);
    horse(ctx, hx, hy, 0.9, '#8a5a3c', 1);
    const [gx, gy] = P(2.0, 1.75);
    horse(ctx, gx, gy, 0.9, '#d9d0c0', -1, 0, '#8a7a6a');
  } else {
    for (const [u, v] of [[0.62, 0.62], [1.28, 0.62], [1.94, 0.62], [0.62, 1.3]]) tent(ctx, u, v);
    if (key === 'fort_archer') {
      // straw target on a stand
      const [x, y] = P(2.05, 1.55);
      ctx.fillStyle = COL.woodDark;
      ctx.fillRect(x - 0.6, y - 10, 1.2, 10);
      ctx.fillStyle = '#e1cf8e';
      ctx.beginPath(); ctx.arc(x, y - 11, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c0392b';
      ctx.beginPath(); ctx.arc(x, y - 11, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e1cf8e';
      ctx.beginPath(); ctx.arc(x, y - 11, 1, 0, Math.PI * 2); ctx.fill();
    } else {
      tent(ctx, 1.94, 1.3);
    }
  }
  flagPoles(ctx, key, S); // the fort's standard in its soldiers' color
  // the right and front banks with their stakes (the front's broken at the gate)
  box(ctx, S - 0.4, 0.4, 0.26, S - 0.8, 0, bank, COL.turf, { plain: true });
  box(ctx, 0.14, S - 0.4, g0 - 0.14, 0.26, 0, bank, COL.turf, { plain: true });
  box(ctx, g1, S - 0.4, S - 0.14 - g1, 0.26, 0, bank, COL.turf, { plain: true });
  stakeRun(ctx, 'v', S - 0.2, 0.17, S - 0.17, bank, stakes);
  stakeRun(ctx, 'u', S - 0.2, 0.17, g0, bank, stakes);
  stakeRun(ctx, 'u', S - 0.2, g1, S - 0.17, bank, stakes);
  watchPlatform(ctx, S - 0.53, S - 0.53);
  // the gate tower: four posts, a deck at 2.75 m, a roof of boards, the painted board over the passage
  const tu0 = S / 2 - 0.42;
  const tu1 = S / 2 + 0.42;
  const tv0 = S - 0.42;
  const tv1 = S - 0.16;
  for (const [pu, pv] of [[tu0, tv0], [tu1, tv0], [tu0, tv1], [tu1, tv1]]) column(ctx, pu, pv, 0, 25, COL.woodDark, 1.1);
  box(ctx, tu0 - 0.05, tv0 - 0.04, tu1 - tu0 + 0.1, tv1 - tv0 + 0.08, 15, 1.6, '#a98a5c', { plain: true });
  gableRoof(ctx, tu0 - 0.04, tv0 - 0.06, tu1 - tu0 + 0.08, tv1 - tv0 + 0.12, 25.5, 5, '#7a5a3a', 'v', 0.03);
  const fy = tv1 + 0.02;
  poly(ctx, [P(tu0 + 0.1, fy, 17.4), P(tu1 - 0.1, fy, 17.4), P(tu1 - 0.1, fy, 22.4), P(tu0 + 0.1, fy, 22.4)], '#d9cfa8', '#4d3820', 0.5);
  poly(ctx, [P(tu0 + 0.14, fy, 18.2), P(tu1 - 0.14, fy, 18.2), P(tu1 - 0.14, fy, 19.4), P(tu0 + 0.14, fy, 19.4)], color);
}

/** Stone watchtower with a crenellated top and an archer on watch. */
function towerArt(ctx, S) {
  const stone = '#b9ad92';
  quad(ctx, 0.04, 0.04, S - 0.04, S - 0.04, 0, COL.paving);
  const a = 0.32;
  const w = S - 0.64;
  const h = 44;
  box(ctx, a, a, w, w, 0, h, stone);
  // stone courses
  ctx.strokeStyle = 'rgba(80,70,55,0.35)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let z = 8; z < h; z += 8) {
    const p0 = P(a, a + w, z);
    const p1 = P(a + w, a + w, z);
    const p2 = P(a + w, a, z);
    ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
  }
  ctx.stroke();
  door(ctx, 'left', a, a, a + w, a + w, 0, 0.5, '#4a3222', 0.3, 11);
  windows(ctx, 'left', a, a, a + w, a + w, 0, 2, 1, '#2a241c', { z: 18, h: 7, w: 0.06, gap: 13 });
  windows(ctx, 'right', a, a, a + w, a + w, 0, 2, 1, '#2a241c', { z: 18, h: 7, w: 0.06, gap: 13 });
  // overhanging fighting platform
  const o = 0.1;
  box(ctx, a - o, a - o, w + 2 * o, w + 2 * o, h, 5, shade(stone, 0.06));
  // archer on watch (behind the front merlons)
  const [x, y] = P(a + w / 2, a + w / 2, h + 5);
  ctx.fillStyle = '#3f7a3a';
  ctx.fillRect(x - 2.4, y - 9, 4.8, 7);
  ctx.fillStyle = '#e3b68c';
  ctx.beginPath(); ctx.arc(x, y - 11, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.arc(x + 4, y - 7, 5, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); ctx.stroke();
  // merlons along the two front edges
  const m = 0.16;
  for (let k = 0; k < 4; k++) {
    const t = a - o + (k + 0.5) * ((w + 2 * o) / 4);
    box(ctx, t - m / 2, a + w + o - m, m, m, h + 5, 4, shade(stone, 0.1));
    box(ctx, a + w + o - m, t - m / 2, m, m, h + 5, 4, shade(stone, 0.1));
  }
}

/** Horse ranch: stable, fenced paddock and the breeding herd (state = herd size). */
function ranchArt(ctx, S, variant, herd) {
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#86a85a');
  // trodden earth near the stable
  quad(ctx, 0.1, 0.9, 1.2, S - 0.2, 0, '#9a9a5c');
  // stable in the back corner
  box(ctx, 0.12, 0.12, 1.25, 0.7, 0, 12, COL.wood);
  gableRoof(ctx, 0.12, 0.12, 1.25, 0.7, 12, 7, '#7a5a3a', 'u');
  door(ctx, 'left', 0.12, 0.12, 1.37, 0.82, 0, 0.3, '#3d2a1a', 0.22, 9);
  door(ctx, 'left', 0.12, 0.12, 1.37, 0.82, 0, 0.7, '#3d2a1a', 0.22, 9);
  // hay and water trough
  const [hx, hy] = P(0.35, 1.25);
  ctx.fillStyle = COL.thatch;
  ctx.beginPath(); ctx.ellipse(hx, hy - 4, 5, 5, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(hx - 5, hy - 4, 10, 4);
  box(ctx, 0.9, 1.1, 0.5, 0.14, 0, 3, COL.wood, { top: COL.water });
  // paddock fence
  const f = [[1.5, 0.15], [S - 0.12, 0.15], [S - 0.12, S - 0.12], [0.2, S - 0.12], [0.2, 1.6]];
  ctx.strokeStyle = '#f0e6d0';
  ctx.lineWidth = 0.8;
  for (let k = 1; k < f.length; k++) {
    // (Rail by rail, so a turned ranch can sort each against the stable.)
    ctx.beginPath();
    for (const z of [3, 6]) {
      const a = P(...f[k - 1], z);
      const b = P(...f[k], z);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#d9ceb4';
  for (const [u, v] of f) { const [x, y] = P(u, v); ctx.fillRect(x - 0.6, y - 7, 1.2, 7); }
  // horses, back to front so nearer ones overlap farther ones
  const coats = ['#8a5a3c', '#5a3a26', '#d9d0c0', '#a8744a', '#3b2a20', '#b89a78'];
  const spots = [];
  for (let k = 0; k < Math.max(1, herd); k++) {
    spots.push({ u: 1.45 + hash01(variant, k, 71) * (S - 1.8), v: 0.5 + hash01(variant, k, 72) * (S - 1.0), k });
  }
  spots.sort((p1, p2) => p1.u + p1.v - (p2.u + p2.v));
  for (const s of spots) {
    const [x, y] = P(s.u, s.v);
    horse(ctx, x, y, 0.85, coats[(s.k + variant) % coats.length], hash01(variant, s.k, 73) < 0.5 ? 1 : -1);
  }
}

/**
 * Dock: plank quay with a crane and bollards on the water side, a store
 * shed and cargo on the land side. `side` = which edge faces the water
 * (0 = -v, 1 = +u, 2 = +v, 3 = -u); the layout is designed with water on
 * the +u edge and mirrored/rotated into place.
 */
function dockArt(ctx, S, variant, side = 1) {
  if (side >= OVER_WATER_ART) { dockQuayArt(ctx, S, side - OVER_WATER_ART); return; }
  const T = (u, v) => (side === 1 ? [u, v] : side === 3 ? [S - u, v] : side === 2 ? [v, u] : [v, S - u]);
  const rect = (u0, v0, du, dv) => {
    const a = T(u0, v0);
    const b = T(u0 + du, v0 + dv);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])];
  };
  quad(ctx, 0.02, 0.02, S - 0.02, S - 0.02, 0, '#a07e55');
  // plank seams parallel to the water edge
  ctx.strokeStyle = 'rgba(70,45,25,0.45)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let u = 0.3; u < S; u += 0.3) {
    const p = P(...T(u, 0.04));
    const q = P(...T(u, S - 0.04));
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
  // 3D pieces, drawn back to front by their position on screen
  const items = [];
  const shed = rect(0.15, 0.2, 1.15, S - 0.4);
  items.push({ d: shed[0] + shed[1], draw: () => {
    box(ctx, shed[0], shed[1], shed[2], shed[3], 0, 15, '#d8c9a8');
    gableRoof(ctx, shed[0], shed[1], shed[2], shed[3], 15, 7, COL.terra, shed[2] >= shed[3] ? 'u' : 'v');
  } });
  for (const [cu, cv, color] of [[1.55, 0.45, '#8a5a33'], [1.55, 0.8, '#b8683c'], [1.9, 0.5, '#c9b13a'], [1.5, S - 0.7, '#7b1f3a']]) {
    const r = rect(cu, cv, 0.26, 0.26);
    items.push({ d: r[0] + r[1] + 0.3, draw: () => box(ctx, r[0], r[1], r[2], r[3], 0, 6, color) });
  }
  const [crU, crV] = T(S - 0.45, S * 0.55);
  items.push({ d: crU + crV, draw: () => {
    const [x, y] = P(crU, crV);
    ctx.strokeStyle = COL.woodDark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 4, y); ctx.lineTo(x, y - 28); ctx.lineTo(x + 4, y);
    const tip = P(...T(S + 0.3, S * 0.55), 34);
    ctx.moveTo(x, y - 28); ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ctx.strokeStyle = '#3a3026';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(tip[0], tip[1] + 12); ctx.stroke();
    ctx.fillStyle = '#c9a36b';
    ctx.fillRect(tip[0] - 2.5, tip[1] + 12, 5, 4);
  } });
  for (const bv of [0.4, S / 2, S - 0.4]) {
    const [bu, bvv] = T(S - 0.12, bv);
    items.push({ d: bu + bvv, draw: () => {
      const [x, y] = P(bu, bvv);
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(x - 1.3, y - 5, 2.6, 5);
      ctx.fillStyle = '#6b5640';
      ctx.fillRect(x - 1.8, y - 6, 3.6, 1.4);
    } });
  }
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
}

/** Height (px) of a stone quay's top over the water, and of the shore row's platform beside it. */
const QUAY_Z = 5;

/**
 * The Emporium out over the water: a stone quay on piers over its two rows
 * on the water, the water showing between the piers, with cargo on the
 * paving, bollards and two cranes at its edge reaching out over the
 * berth; on the shore row, raised to the quay's level, the store shed.
 */
function dockQuayArt(ctx, S, side) {
  const T = turner(S, side);
  const Q = (u, v, z = 0) => P(...T(u, v), z);
  const at = (u, v) => { const [a, b] = T(u, v); return a + b; };
  const { shore } = overWater(S);
  // the shore row: a stone platform up to the quay's level
  const land = turnedRect(T, 0.02, 0.02, shore - 0.02, S - 0.04);
  box(ctx, land[0], land[1], land[2], land[3], 0, QUAY_Z, COL.stone, { plain: true });
  pierDeck(ctx, T, shore, S - 0.02, 0.02, S - 0.02, { z: QUAY_Z, thick: 2.4, step: 0.62, pile: 0.2, pileColor: COL.stoneDark, deck: '#b9ad93', seams: 'rgba(90,80,62,0.35)', seamStep: 0.5 });
  const items = [];
  const shed = turnedRect(T, 0.1, 0.22, 0.8, S - 0.44);
  items.push({ d: shed[0] + shed[1], draw: () => {
    box(ctx, shed[0], shed[1], shed[2], shed[3], QUAY_Z, 15, '#d8c9a8');
    gableRoof(ctx, shed[0], shed[1], shed[2], shed[3], QUAY_Z + 15, 7, COL.terra, shed[2] >= shed[3] ? 'u' : 'v');
  } });
  for (const [cu, cv, color] of [[1.25, 0.45, '#8a5a33'], [1.25, 0.8, '#b8683c'], [1.6, 0.5, '#c9b13a'], [1.25, S - 0.7, '#7b1f3a'], [1.6, S - 0.55, '#8a5a33']]) {
    const r = turnedRect(T, cu, cv, 0.26, 0.26);
    items.push({ d: r[0] + r[1] + 0.3, draw: () => box(ctx, r[0], r[1], r[2], r[3], QUAY_Z, 6, color) });
  }
  // two cranes at the quay's edge, their jibs out over the berth
  for (const cv of [0.85, S - 0.85]) {
    items.push({ d: at(S - 0.4, cv), draw: () => {
      const [x, y] = Q(S - 0.4, cv, QUAY_Z);
      ctx.strokeStyle = COL.woodDark;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 4, y); ctx.lineTo(x, y - 28); ctx.lineTo(x + 4, y);
      const tip = Q(S + 0.35, cv, QUAY_Z + 34);
      ctx.moveTo(x, y - 28); ctx.lineTo(tip[0], tip[1]);
      ctx.stroke();
      ctx.strokeStyle = '#3a3026';
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(tip[0], tip[1] + 14); ctx.stroke();
      ctx.fillStyle = '#c9a36b';
      ctx.fillRect(tip[0] - 2.5, tip[1] + 14, 5, 4);
    } });
  }
  for (const bv of [0.3, S / 2, S - 0.3]) {
    items.push({ d: at(S - 0.12, bv), draw: () => {
      const [x, y] = Q(S - 0.12, bv, QUAY_Z);
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(x - 1.3, y - 4, 2.6, 4);
      ctx.fillStyle = '#6b5640';
      ctx.fillRect(x - 1.8, y - 5, 3.6, 1.4);
    } });
  }
  paint(items);
}

const ART = {
  house: houseArt,
  well: wellArt,
  fountain: fountainArt,
  reservoir: reservoirArt,
  barber: barberArt,
  clinic: clinicArt,
  baths: bathsArt,
  hospital: hospitalArt,
  oracle: oracleArt,
  school: schoolArt,
  library: libraryArt,
  academy: academyArt,
  theater: theaterArt,
  amphitheater: amphitheaterArt,
  colosseum: colosseumArt,
  actor_troupe: actorTroupeArt,
  gladiator_school: gladiatorSchoolArt,
  menagerie: menagerieArt,
  forum: forumArt,
  senate: senateArt,
  governor_house: governorHouseArt,
  governor_villa: governorVillaArt,
  governor_palace: governorPalaceArt,
  garden: gardenArt,
  statue_small: statueArt,
  statue_medium: statueArt,
  statue_large: statueArt,
  triumphal_arch: triumphalArchArt,
  engineer_post: engineerArt,
  gardener_yard: gardenerYardArt,
  prefecture: prefectureArt,
  clay_pit: clayPitArt,
  timber_yard: timberYardArt,
  iron_mine: ironMineArt,
  marble_quarry: marbleQuarryArt,
  market: marketArt,
  granary: granaryArt,
  warehouse: warehouseArt,
  barracks: barracksArt,
  fort_legion: fortArt,
  fort_archer: fortArt,
  fort_cavalry: fortArt,
  tower: towerArt,
  horse_ranch: ranchArt,
  dock: dockArt,
  shipyard: shipyardArt,
  wharf: wharfArt,
  navalia: navaliaArt,
  naval_station: stationArt,
  portus: portusArt,
  military_academy: militaryAcademyArt,
  hippodrome: hippodromeArt,
  hippodrome_part: hippodromeArt,
  chariot_maker: chariotMakerArt,
  native_hut: nativeHutArt,
  native_meeting: nativeMeetingArt,
  native_crops: nativeCropsArt,
  mission_post: missionPostArt,
  ...MONUMENT_ART, // every monument at every stage, and the work camp
};

/**
 * Art state that changes the building's look (part of the sprite key).
 * `resting`: a farm resting for the winter (Insane) draws its crop at the
 * height it reached, in dry winter tones, with bare fruit trees and vines
 * and fewer pigs (state 5..9 = growth stage + 5).
 */
export function artState(b, resting = false) {
  const kind = b.def.kind;
  if (b.house) return b.house.tier;
  if (b.herd !== undefined) return b.herd; // horse ranch: one sprite per herd size
  // Waterside buildings: which edge faces the water (see dockArt), and
  // OVER_WATER_ART when they stand out over it (one wholly on land, from an
  // older save, keeps its old look).
  const pier = b.waterRows ? OVER_WATER_ART : 0;
  if (kind === 'dock' || kind === 'station' || kind === 'portus') return (b.waterSide ?? 1) + pier;
  // Navalia: the water's edge, and the liburnian on the slip (0 none, 1 keel and frames, 2 planked).
  if (kind === 'navalia') return (b.waterSide ?? 1) + 4 * (!(b.progress > 0) ? 0 : b.progress < 50 ? 1 : 2) + pier;
  // Shipyard: the water's edge, and the boat on the slip (0 none, 1 ribs, 2 planked; none while its spare waits on the water).
  if (kind === 'shipyard') return (b.waterSide ?? 1) + 4 * (b.spareId || !(b.progress > 0) ? 0 : b.progress < 50 ? 1 : 2) + pier;
  if (kind === 'wharf') return (b.waterSide ?? 1) + 4 * ((b.stock?.fish || 0) > 0 ? 1 : 0) + pier; // baskets of fish on the deck
  if (kind === 'part') return b.section || 0; // a hippodrome's stretch of track
  // A monument: its stage (finished = the number of stages), and the Pharus the side facing its water.
  if (kind === 'monument') return monumentLook(b.mon?.stage || 0, b.waterRows ? b.waterSide ?? 0 : 0);
  if (kind === 'arch') return b.axis || 0; // the way the road runs under it
  // A garden or statue faded to NEGLECT_STEP or past it (sim/gardens.js)
  // looks it: 1, drawn dry or dull. One more sprite a type at most.
  if (b.def.tended) return (b.careStep || 0) >= NEGLECT_STEP ? 1 : 0;
  if (kind === 'farm') return Math.min(4, Math.floor(b.progress / 20)) + (resting ? 5 : 0);
  // Water works and what runs on piped water (the baths) show it: a full
  // pool, or a dry one (the baths were always drawn full, even out of a
  // reservoir's reach, which said they worked when they did not).
  if (kind === 'reservoir' || kind === 'fountain' || b.def.needsPiped) return b.hasWater ? 1 : 0;
  // The raw producers and the workshops: staffed or shut, and what their stores hold (industryArtState).
  const ind = industryArtState(b);
  if (ind !== undefined) return ind;
  return 0;
}
