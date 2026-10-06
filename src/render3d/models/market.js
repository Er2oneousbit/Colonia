/**
 * models/market.js
 * ----------------------------------------------------------------------------
 * The market (Macellum) of the 3D look, 2 x 2 tiles (8 m square), from the
 * Roman provisions market as it survives rather than from the 2D sprite:
 *
 *   - Pompeii's macellum on the forum (a court ringed by shops, a tholos
 *     over a water basin in its middle, where fish scales were found in the
 *     drain), Puteoli's (the "Serapeum": a round tholos of columns in a
 *     colonnaded court) and Leptis Magna's (two tholoi whose columns carry
 *     marble counters between them, and a table of standard measures):
 *     here one small tholos in the middle, eight Tuscan columns on an
 *     octagonal podium of two steps under a conical tiled roof, a marble
 *     basin (labrum) of water in it and four marble counters between its
 *     columns where the fish is laid out.
 *   - Round the court, on every side, two stalls either side of a way in:
 *     masonry counters (painted plaster, a black socle and a red dado as
 *     Pompeii's counters were, a marble top) under striped awnings stretched
 *     from a timber frame, a low wall behind the vendor; corner piers of
 *     ashlar carry the frame. The goods are laid out as the painting of the
 *     forum's market in the Praedia of Julia Felix shows them: on the
 *     counters, before them on the ground, hung from the beam.
 *   - In the corners: a mensa ponderaria (a limestone table of standard
 *     measures, its round cavities for the modius and its parts, as at
 *     Pompeii's forum), a stack of spare jars, crates, a bench.
 *
 * States: 'open' (staffed) shows the awnings stretched; 'shut' rolls them
 * up on their beams (meshes tagged in userData.when). What is for sale is
 * not part of this model: marketWares() says which good's display
 * (models/wares.js buildDisplay, and the fish here: buildTholosFish) stands
 * at which stall and how full, the game draws each as a kit of its own,
 * placed in this model's frame (render3d/models.js `extras`).
 *
 * In metres, y up, the footprint's middle at the origin (-4..4), as
 * models/well.js. Levels of detail 0 to 2 as the fountain's.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, Matrix4, CylinderGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { revolve, profileOf, block, merge, tintGeometry, boxUV, triangles } from '../shapes.js';
import { material, waterMaterial } from '../materials.js';
import { slab, paving, tuscanColumn, tiledRoof, tube, lantern, lanternPane } from './masonry.js';
import { buildDisplay, displayStep, displayShows, wareMaterials, DISPLAY, fishPiece } from './wares.js';
import { artRng, smoothstep } from '../texgen.js';
import { CONFIG } from '../../config.js';

/** The market's key measures (metres): tests and the lab read them. */
export const MARKET = Object.freeze({
  half: 4,
  stall: 2.75, // a counter's middle, from the market's middle
  backWall: 3.82,
  podium: 1.35, // the tholos's lower step (its octagon's inner radius)
  colR: 1.0,
  roofTop: 3.6,
});

/** The goods a market's stalls show, in the order they take the stalls (fish has the tholos). */
export const MARKET_GOODS = Object.freeze(['wheat', 'vegetables', 'fruit', 'meat', 'oil', 'wine', 'pottery', 'furniture', 'clothing', 'marble']);

/** Each stall: its side (0 to 3, a quarter turn each) and its place along the side. */
export const MARKET_STALLS = Object.freeze([0, 1, 2, 3].flatMap((side) => [-1.6, 1.6].map((x) => Object.freeze({ side, x }))));

/** The awnings' stripes, a pair of colours (sRGB) a stall. */
const AWNINGS = [[0xb5452f, 0xeee6d6], [0x3f6390, 0xeee6d6], [0xc9902e, 0xf2ead8], [0x5f7f3e, 0xeee6d6], [0x8d3a52, 0xefe5d4], [0xb5452f, 0xd9a13a], [0x3f6390, 0xd9c9a4], [0xa4572e, 0xf0e4cc]];

const D = (deg) => (deg * Math.PI) / 180;
const lin = (hex) => {
  const f = (x) => {
    const v = x / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
};

/** A matrix: turned `a` about y, then moved to (x, y, z). */
function placeAt(x, y, z, a) {
  return new Matrix4().makeRotationY(a).setPosition(x, y, z);
}

/** Where stall `i`'s display stands (its spot's frame, wares.js: the counter's front toward the court). */
export function stallMatrix(i) {
  const { side, x } = MARKET_STALLS[i];
  // On side 0 the stalls run along x at z = +stall, the counter facing -z (the court): turned half round.
  const m = placeAt(x, 0, MARKET.stall, Math.PI);
  return new Matrix4().makeRotationY((side * Math.PI) / 2).multiply(m);
}

const STALL_MATS = MARKET_STALLS.map((_, i) => stallMatrix(i));

/**
 * The stalls in the order they are seen at art turn T: the farthest from
 * the camera first (their counters face it, over the court), the nearest
 * last (under their awnings, their backs to it). The game turns a model by
 * -T quarter turns (models.js modelMatrix) and the camera looks from +x +z.
 */
export function stallOrder(T) {
  const th = (-(T & 3) * Math.PI) / 2;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const depth = (i) => {
    const e = STALL_MATS[i].elements;
    const x = e[12];
    const z = e[14];
    return x * c + z * s + (-x * s + z * c);
  };
  return MARKET_STALLS.map((_, i) => i).sort((a, b) => depth(a) - depth(b) || a - b);
}
const ORDERS = [0, 1, 2, 3].map(stallOrder);

/** The cache of each market's wares (by building: freed with it). */
const CACHE = new WeakMap();

/**
 * What a market shows for sale: for each good it holds, its display at a
 * stall (the most visible stalls first, in MARKET_GOODS' order) and its
 * step of fullness (wares.js displayStep: the market's caps per kind), and
 * the fish on the tholos's counters. Returns [{ key, state, at }] (at: a
 * Matrix4 in the model's metres, null for the model's own frame), the same
 * array while nothing changed.
 */
export function marketWares(stock, T = 0) {
  if (!stock) return [];
  let sig = T & 3;
  for (let i = 0; i < MARKET_GOODS.length; i++) sig = sig * 4 + displayStep(stock[MARKET_GOODS[i]], i < 4 ? CONFIG.MARKET_FOOD_CAP : CONFIG.MARKET_GOODS_CAP);
  sig = sig * 4 + displayStep(stock.fish, CONFIG.MARKET_FOOD_CAP);
  const was = CACHE.get(stock);
  if (was && was.sig === sig) return was.list;
  const list = [];
  const order = ORDERS[T & 3];
  let n = 0;
  for (let i = 0; i < MARKET_GOODS.length && n < order.length; i++) {
    const good = MARKET_GOODS[i];
    const step = displayStep(stock[good], i < 4 ? CONFIG.MARKET_FOOD_CAP : CONFIG.MARKET_GOODS_CAP);
    if (!step) continue;
    // (A kit a good and step: one draw a material, whichever step.)
    list.push({ key: `market:ware:${good}:${step}`, state: step, at: STALL_MATS[order[n++]] });
  }
  const fish = displayStep(stock.fish, CONFIG.MARKET_FOOD_CAP);
  if (fish) list.push({ key: `market:fish:${fish}`, state: fish, at: null });
  CACHE.set(stock, { sig, list });
  return list;
}

/** The market's state from the sim: open (staffed) or shut. */
export function marketState(b) {
  return b.efficiency > 0 ? 'open' : 'shut';
}

/** Does a part tagged `when` show in `state` ('open', 'shut', or a display's step)? */
export function marketShows(when, state) {
  if (typeof state === 'number') return displayShows(when, state);
  if (!when || when === 'always') return true;
  return when === state;
}

// ---------------------------------------------------------------------------
// The building
// ---------------------------------------------------------------------------

/** A striped awning from the back beam (y0 at z0) to the front beam (y1 at z1), x0..x1, sagging. */
function awning(x0, x1, z0, y0, z1, y1, colours, lod) {
  const stripe = 0.3;
  const n = Math.max(1, Math.round((x1 - x0) / stripe));
  const rows = lod === 2 ? 1 : lod ? 3 : 5;
  const pos = [];
  const col = [];
  const c0 = lin(colours[0]);
  const c1 = lin(colours[1]);
  for (let k = 0; k < n; k++) {
    const xa = x0 + ((x1 - x0) * k) / n;
    const xb = x0 + ((x1 - x0) * (k + 1)) / n;
    const c = lod === 2 ? c0.map((v, i) => (v + c1[i]) / 2) : k % 2 ? c1 : c0;
    for (let r = 0; r < rows; r++) {
      const t0 = r / rows;
      const t1 = (r + 1) / rows;
      // The cloth sags between its beams, more in the middle of its width.
      const y = (t, x) => y0 + (y1 - y0) * t - 0.1 * Math.sin(Math.PI * t) * (0.6 + 0.4 * Math.sin((Math.PI * (x - x0)) / (x1 - x0)));
      const z = (t) => z0 + (z1 - z0) * t;
      const p = [[xa, y(t0, xa), z(t0)], [xb, y(t0, xb), z(t0)], [xb, y(t1, xb), z(t1)], [xa, y(t1, xa), z(t1)]];
      // Up-facing: wound so the normal points up.
      pos.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]);
      for (let v = 0; v < 6; v++) col.push(...c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  boxUV(g);
  // The scalloped hem along the front edge: a short valance hanging from the front beam.
  if (lod < 2) {
    const hem = [];
    const hc = [];
    const h = 0.16;
    for (let k = 0; k < n; k++) {
      const xa = x0 + ((x1 - x0) * k) / n;
      const xb = x0 + ((x1 - x0) * (k + 1)) / n;
      const c = k % 2 ? c1 : c0;
      const zz = z1 + 0.005;
      // Each stripe ends in a point (the hem's scallops).
      hem.push(xa, y1, zz, xb, y1, zz, xb, y1 - h * 0.7, zz, xa, y1, zz, xb, y1 - h * 0.7, zz, (xa + xb) / 2, y1 - h, zz, xa, y1, zz, (xa + xb) / 2, y1 - h, zz, xa, y1 - h * 0.7, zz);
      for (let v = 0; v < 9; v++) hc.push(...c);
    }
    const hg = new BufferGeometry();
    hg.setAttribute('position', new Float32BufferAttribute(hem, 3));
    hg.setAttribute('color', new Float32BufferAttribute(hc, 3));
    hg.computeVertexNormals();
    boxUV(hg);
    return [g, hg];
  }
  return [g];
}

/** An awning rolled up on its back beam (the stall shut): a striped roll. */
function rolledAwning(x0, x1, y, z, colours, lod) {
  const g = new CylinderGeometry(0.1, 0.1, x1 - x0, lod ? 6 : 10, lod === 2 ? 1 : lod ? 6 : 12, lod === 2);
  g.rotateZ(Math.PI / 2);
  g.translate((x0 + x1) / 2, y, z);
  boxUV(g);
  const c0 = lin(colours[0]);
  const c1 = lin(colours[1]);
  return tintGeometry(g, (x) => (Math.floor((x - x0) / 0.3) % 2 ? c1 : c0));
}

/** One side of the court (side 0: along x at z +): the low wall, the counters, the frame, the awnings. */
function side(sideIndex, lod, seed) {
  const out = { plaster: [], marble: [], wood: [], cloth: [], clothShut: [], stone: [] };
  const zc = MARKET.stall;
  // The low wall behind the vendors, broken by the way in.
  for (const [xa, xb] of [[-3.54, -0.62], [0.62, 3.54]]) {
    const w = slab(xb - xa, 0.95, 0.24, { bevel: 0.01, seed: seed + xa * 10, wobble: 0, tone: 0, grime: 0.25 });
    boxUV(w);
    out.plaster.push(w.translate((xa + xb) / 2, 0, MARKET.backWall + 0.02));
  }
  // The way in: two small ashlar piers with a lintel stone.
  for (const s of [-1, 1]) {
    for (let c = 0; c < 4; c++) out.stone.push(slab(0.3, 0.6, 0.28, { bevel: 0.012, seed: seed + 40 + c * 3 + s, wobble: 0.003, tone: 0.06, grime: c ? 0 : 0.3 }).translate(s * 0.78, c * 0.6, MARKET.backWall + 0.02));
  }
  out.stone.push(slab(1.9, 0.3, 0.28, { bevel: 0.015, seed: seed + 49, wobble: 0.002, tone: 0.04, grime: 0 }).translate(0, 2.4, MARKET.backWall + 0.02));
  // The counters: plaster body, marble top overhanging toward the court.
  for (const x of [-1.6, 1.6]) {
    const body = slab(DISPLAY.len, DISPLAY.top - 0.05, 0.5, { bevel: 0.01, seed: seed + x * 7, wobble: 0.002, tone: 0, grime: 0.2 });
    // (UVs from the ground up, so the plaster's socle and dado sit at the counter's foot.)
    out.plaster.push(boxUV(body).translate(x, 0, zc));
    out.marble.push(slab(DISPLAY.len + 0.06, 0.05, DISPLAY.depth + 0.02, { bevel: 0.008, seed: seed + x * 9, wobble: 0.001, tone: 0.03, grime: 0 }).translate(x, DISPLAY.top - 0.05, zc - 0.03));
  }
  // The frame: posts on the wall and behind the counters, beams, rafters.
  const zb = MARKET.backWall;
  // The front beam over the counter's back edge: the awning shades the vendor and leaves the counter top
  // to the sky, so the camera (30 degrees down) sees what is on it from the court and over the low wall.
  const zf = zc + DISPLAY.depth / 2 + 0.03;
  const yb = 2.6;
  const yf = 2.25;
  // (Timber as chamfered slabs: 18 triangles a piece, sixty-four pieces.)
  const post = (x, z, h) => out.wood.push(slab(0.1, h, 0.1, { bevel: 0.012, seed: seed + x * 13 + z, wobble: 0.003, tone: 0.08, grime: 0.3 }).translate(x, 0, z));
  for (const x of [-2.5, -0.7, 0.7, 2.5]) {
    post(x, zf, yf);
    post(x, zb + 0.02, yb);
  }
  const beam = (x0, x1, y, z) => out.wood.push(slab(x1 - x0, 0.1, 0.1, { bevel: 0.012, seed: seed + y * 31 + z, wobble: 0.003, tone: 0.05, grime: 0 }).translate((x0 + x1) / 2, y - 0.05, z));
  for (const [x0, x1] of [[-2.6, -0.6], [0.6, 2.6]]) {
    beam(x0, x1, yf + 0.04, zf);
    beam(x0, x1, yb + 0.04, zb + 0.02);
  }
  // Rafters from the back beam to the front one, at the posts.
  if (lod < 2) {
    for (const x of [-2.5, -0.7, 0.7, 2.5]) {
      const len = Math.hypot(zb - zf, yb - yf);
      const g = slab(0.07, len + 0.2, 0.07, { bevel: 0.01, seed: seed + x * 3, wobble: 0.002, tone: 0.05, grime: 0 });
      g.translate(0, -(len + 0.2) / 2, 0);
      g.rotateX(Math.PI / 2 - Math.atan2(yb - yf, zb - zf));
      out.wood.push(g.translate(x, (yb + yf) / 2 + 0.1, (zb + zf) / 2));
    }
  }
  // The awnings (open) and the rolls (shut), one pair of colours a stall.
  [[-2.55, -0.65], [0.65, 2.55]].forEach(([x0, x1], k) => {
    const colours = AWNINGS[(sideIndex * 2 + k) % AWNINGS.length];
    out.cloth.push(...awning(x0, x1, zb + 0.02, yb + 0.1, zf, yf + 0.1, colours, lod));
    out.clothShut.push(rolledAwning(x0, x1, yb + 0.2, zb - 0.05, colours, lod));
  });
  return out;
}

/** The tholos: podium, columns, entablature, roof, the labrum and the fish counters. */
function tholos(lod, seed) {
  const out = { trav: [], stone: [], marble: [], tiles: [], bronze: [], water: [], pane: [] };
  const oct = { segments: 8, metres: 1 };
  // (A revolved octagon has a corner at +z; turned 22.5 degrees its faces meet the court's sides square.)
  const turn = (g) => g.rotateY(D(22.5));
  out.trav.push(turn(revolve(profileOf([[1.35, 0], [1.35, 0.15], [1.17, 0.15], [1.17, 0.3], [0, 0.3]]), { ...oct, tint: (p) => 0.75 + 0.25 * smoothstep(0, 0.2, p.y) })));
  const top = 0.3;
  const colH = 2.0;
  const cr = MARKET.colR;
  for (let k = 0; k < 8; k++) {
    const a = D(22.5 + k * 45);
    const x = Math.sin(a) * cr;
    const z = Math.cos(a) * cr;
    for (const g of tuscanColumn(0.095, colH, lod)) out.stone.push(g.translate(x, top, z));
  }
  // The entablature: an octagonal ring, a plain architrave and a moulded cornice.
  const eY = top + colH;
  out.stone.push(turn(revolve(profileOf([
    [0.86, eY], [1.1, eY], [1.1, eY + 0.2], [1.16, eY + 0.22], [1.2, eY + 0.3], [0.86, eY + 0.3], [0.86, eY],
  ]), { ...oct, metres: 0.8 })));
  // The roof: an eight-sided cone of tiles, ribs of imbrices down its hips, a bronze pine cone on top.
  const rY = eY + 0.3;
  const apex = MARKET.roofTop;
  const R = 1.32;
  const corner = (k, r, y) => {
    const a = D(22.5 + k * 45);
    return [Math.sin(a) * r, y, Math.cos(a) * r];
  };
  for (let k = 0; k < 8; k++) {
    // Each face a tiled slope: eave from corner k to k+1, up to the apex (a tiny top edge).
    const q = tiledRoof([corner(k + 1, R, rY - 0.05), corner(k, R, rY - 0.05), corner(k, 0.05, apex), corner(k + 1, 0.05, apex)], { pitch: 0.17, lod, seed: seed + k, antefix: lod === 0, imbrexR: 0.034 });
    out.tiles.push(...q.tiles);
    if (lod < 2) out.tiles.push(tube([corner(k, R + 0.02, rY - 0.03), corner(k, 0.06, apex + 0.04)], 0.055, { radial: lod ? 4 : 6, segments: 2, around: 0.6 }));
  }
  const cone = revolve(profileOf([[0, apex - 0.02], [0.08, apex + 0.02], [0.07, apex + 0.16], [0.03, apex + 0.26], [0, apex + 0.3]]), { segments: lod ? 6 : 10, metres: 0.3 });
  out.bronze.push(cone);
  // A lantern hung on a chain from the roof's middle over the basin (lit at night).
  if (lod < 2) {
    const l = lantern(0, 1.95, 0, lod);
    out.bronze.push(...l.bronze, tube([[0, 2.25, 0], [0, eY + 0.3, 0]], 0.008, { radial: 4, segments: 2, around: 0.3 }));
    out.pane.push(l.pane);
  }
  // The labrum: a marble basin on a fluted foot, water in it.
  const labrum = revolve(profileOf([
    [0, top], [0.2, top], [0.2, top + 0.05], [0.1, top + 0.12], [0.08, top + 0.62], [0.14, top + 0.66], [0.4, top + 0.78], [0.44, top + 0.86], [0.42, top + 0.88], [0.36, top + 0.82], [0, top + 0.76],
  ]), { segments: lod === 2 ? 8 : lod ? 14 : 28, metres: 1.6, tint: (p) => (Math.hypot(p.x, p.z) < 0.37 && p.y > top + 0.7 ? 0.7 : 0.85 + 0.15 * smoothstep(top, top + 0.5, p.y)) });
  out.marble.push(labrum);
  const water = new CylinderGeometry(0.36, 0.36, 0.002, lod ? 12 : 24);
  water.translate(0, top + 0.83, 0);
  out.water.push(tintGeometry(water));
  // The fish counters: marble slabs between alternate columns, on masonry feet.
  if (lod < 2) {
    for (let k = 0; k < 4; k++) {
      const a = D(45 + k * 90);
      const g = slab(0.62, 0.05, 0.32, { bevel: 0.008, seed: seed + 60 + k, wobble: 0.001, tone: 0.02, grime: 0 });
      g.translate(0, 0.85, 0);
      for (const fx of [-0.24, 0.24]) out.marble.push(slab(0.06, 0.85, 0.24, { bevel: 0.006, seed: seed + 70 + k, wobble: 0, tone: 0, grime: 0.2 }).translate(fx, 0, 0).rotateY(a).translate(Math.sin(a) * 0.84, top, Math.cos(a) * 0.84));
      out.marble.push(g.rotateY(a).translate(Math.sin(a) * 0.84, top, Math.cos(a) * 0.84));
    }
  }
  return out;
}

/**
 * The fish on the tholos's counters, three rows a counter, one step of
 * fullness a row (tagged fill1 to fill3); with `step`, that step's rows as
 * one mesh (the game's kits).
 */
export function buildTholosFish(lod = 0, step = 0) {
  const mats = wareMaterials();
  const group = new Group();
  group.name = 'tholos-fish';
  const meshes = [];
  // (From far out the tholos has no fish counters: no fish either, or they would float.)
  if (lod === 2) return { group, meshes };
  const rows = [[], [], []];
  const rnd = artRng(5);
  for (let k = 0; k < 4; k++) {
    const a = D(45 + k * 90);
    for (let r = 0; r < 3; r++) {
      for (let f = 0; f < (lod === 2 ? 1 : 2); f++) {
        const g = fishPiece(lod, 30 + k * 7 + r * 3 + f, 0.26);
        g.rotateY((rnd() - 0.5) * 0.4);
        g.translate(-0.13 + f * 0.27, 0.3 + 0.9, -0.09 + r * 0.09);
        rows[r].push(g.rotateY(a).translate(Math.sin(a) * 0.84, 0, Math.cos(a) * 0.84));
      }
    }
  }
  const sets = step ? [rows.slice(0, step).flat()] : rows;
  sets.forEach((list, r) => {
    const m = new Mesh(merge(list), mats.fish);
    m.name = `fish-${r + 1}`;
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.when = step ? 'always' : `fill${r + 1}`;
    group.add(m);
    meshes.push(m);
  });
  return { group, meshes };
}

/** The corners' furniture: the measures table, spare jars, crates, a bench. */
function corners(lod, seed) {
  const out = { lime: [], terracotta: [], wood: [], stone: [], plaster: [] };
  const c = 3.3;
  // Stuccoed corner piers where two sides' walls meet, a stone cap on each.
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    out.plaster.push(boxUV(slab(0.44, 2.7, 0.44, { bevel: 0.01, seed: seed + sx * 5 + sz * 11, wobble: 0.002, tone: 0, grime: 0.3 })).translate(sx * 3.74, 0, sz * 3.74));
    out.stone.push(slab(0.54, 0.1, 0.54, { bevel: 0.015, seed: seed + 90 + sx + sz, wobble: 0.002, tone: 0.03, grime: 0 }).translate(sx * 3.72, 2.7, sz * 3.72));
  }
  // The mensa ponderaria: a limestone table with round cavities of standard volumes.
  const mx = c - 0.05;
  const mz = -c + 0.25;
  out.lime.push(slab(0.95, 0.12, 0.5, { bevel: 0.015, seed: seed + 1 }).translate(mx - 0.25, 0.85, mz + 0.3));
  for (const fx of [-0.6, 0.1]) out.lime.push(slab(0.12, 0.85, 0.36, { bevel: 0.01, seed: seed + 2 + fx }).translate(mx + fx, 0, mz + 0.3));
  if (lod < 2) {
    [[0.13, -0.6], [0.1, -0.33], [0.08, -0.12], [0.06, 0.05]].forEach(([r, x]) => {
      // Each cavity a dark round hollow in the slab's top.
      const g = revolve(profileOf([[r + 0.015, 0], [r, -0.002], [r * 0.85, -0.05], [0, -0.06]]), { segments: lod ? 8 : 16, metres: 0.8, tint: (p) => (p.y < -0.004 ? 0.25 : 0.9) });
      out.lime.push(g.translate(mx - 0.1 + x, 0.97 + 0.004, mz + 0.3));
    });
  }
  // Spare jars stacked in the corner opposite, a bench along a wall, crates.
  if (lod < 2) {
    const jar = revolve(profileOf([[0, 0], [0.03, 0], [0.13, 0.2], [0.15, 0.45], [0.12, 0.62], [0.06, 0.68], [0.05, 0.8], [0, 0.79]]), { segments: lod ? 7 : 12, metres: 0.6, tint: (p) => 0.75 + 0.25 * smoothstep(0, 0.3, p.y) });
    for (const [x, z, t] of [[-3.0, 2.85, 0.1], [-2.75, 3.1, -0.15], [-3.15, 3.15, 0.2]]) out.terracotta.push(jar.clone().rotateX(t).translate(x, 0, z));
    out.wood.push(slab(1.2, 0.08, 0.32, { bevel: 0.01, seed: seed + 7 }).translate(-3.05, 0.42, -2.55).rotateY(0));
    for (const x of [-3.5, -2.6]) out.wood.push(slab(0.08, 0.42, 0.28, { bevel: 0.01, seed: seed + 8 + x }).translate(x + 0.45, 0, -2.55));
    for (const [x, z, h] of [[3.0, 3.0, 0.45], [2.75, 2.7, 0.35]]) out.wood.push(block(0.5, h, 0.42, { bevel: 0.01, seed: seed + x * 3 + z, wobble: 0.004, grime: 0.2, seg: 1, tone: 0.08 }).translate(x, 0, z));
  }
  return out;
}

/** Build the market: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildMarket({ lod = 0, seed = 41 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const group = new Group();
  group.name = 'market';
  const meshes = [];
  const add = (geos, mat, name, when = 'always', cast = true) => {
    const list = geos.filter(Boolean);
    if (!list.length) return null;
    const m = new Mesh(merge(list), mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    m.userData.when = when;
    group.add(m);
    meshes.push(m);
    return m;
  };
  const H = MARKET.half;
  // The court's paving: travertine flags, left out under the tholos and the stalls' counters.
  const pave = paving(-H + 0.02, H - 0.02, -H + 0.02, H - 0.02, 0.05, seed, {
    rowW: 0.62, minL: 0.55, maxL: 1.05, lod, skip: (x, z) => Math.hypot(x, z) < 1.2,
  });
  const parts = { plaster: [], marble: [], wood: [], cloth: [], clothShut: [], stone: [], trav: [...pave], tiles: [], bronze: [], water: [], lime: [], terracotta: [], pane: [] };
  for (let s = 0; s < 4; s++) {
    const o = side(s, lod, seed + 100 * (s + 1));
    const turn = (g) => g.rotateY((s * Math.PI) / 2);
    for (const k of Object.keys(o)) for (const g of o[k]) parts[k].push(turn(g));
  }
  const th = tholos(lod, seed + 7);
  for (const k of Object.keys(th)) parts[k].push(...th[k]);
  const co = corners(lod, seed + 9);
  for (const k of Object.keys(co)) parts[k].push(...co[k]);
  add(parts.trav, material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 }), 'paving', 'always', false);
  // (The counters and low walls: plaster painted as Pompeii's counters are, v from the ground so the dado sits at their foot.)
  add(parts.plaster, material('plaster', { surface: 'plaster', vertexColors: true, snow: 1 }), 'counters');
  add(parts.marble, material('marble', { surface: 'marble', vertexColors: true, snow: 1 }), 'marble');
  add(parts.stone, material('limestone', { surface: 'limestone', vertexColors: true, snow: 1 }), 'stone');
  add(parts.lime, material('limestone', { surface: 'limestone', vertexColors: true, snow: 1 }), 'measures');
  add(parts.wood, material('wood', { surface: 'wood', vertexColors: true, snow: 1 }), 'frame');
  add(parts.tiles, material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 1 }), 'roof');
  add(parts.terracotta, material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 1 }), 'jars');
  add(parts.bronze, material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }), 'finial');
  add(parts.cloth, material('cloth-dyed', { surface: 'wool', vertexColors: true, snow: 0.7 }), 'awnings', 'open');
  add(parts.clothShut, material('cloth-dyed', { surface: 'wool', vertexColors: true, snow: 0.7 }), 'awnings-rolled', 'shut');
  add(parts.water, waterMaterial(), 'water', 'always', false);
  add(parts.pane, lanternPane(), 'lamp', 'always', false);
  let tris = 0;
  for (const m of meshes) tris += triangles(m.geometry);
  return { group, meshes, triangles: tris };
}

/** Show a state on a built market (the lab): 'open' or 'shut'. */
export function setMarketState(m, state) {
  for (const mesh of m.meshes) mesh.visible = marketShows(mesh.userData.when, state);
}

export { buildDisplay };
