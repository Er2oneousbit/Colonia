/**
 * models/workshopKit.js
 * ----------------------------------------------------------------------------
 * What the eight workshops share (wsPotter.js, wsCarpenter.js, wsOilPress.js,
 * wsWinery.js, wsWeaponsmith.js, wsFletcher.js, wsLinen.js, wsClothing.js):
 * the Republican workshop itself and the small things every trade needs
 * (tubs, amphorae, baskets, stools, trestle tables, plank shelves).
 *
 * The workshop, as the towns of Latium and Campania had them in about 300 BC
 * (the shops and workshops of the excavated Italic towns, Cosa, Fregellae and
 * the early Pompeii, before the brick-faced houses of the Empire): a long
 * room of rubble walls laid in lime mortar on a footing of tufa blocks
 * (the soft volcanic stone of the Alban hills, quarried by the cart-load),
 * plastered over and limewashed, a band of red ochre along the foot of the
 * wall (the dado, which hides the splash and the dirt), its roof one low
 * pitch of tegulae and imbrices (flat tiles and the half pipes over their
 * joints) leaning on the back wall, the eaves finished with antefixes. It
 * stands open to the street on timber posts on stone bases: the craftsman
 * works at the threshold in the light, and at night the shop is closed with
 * boards (the shop-front shutters of Pompeii). A yard in front takes the
 * kiln, the vats and the stores that need air.
 *
 * Sources: Vitruvius (the walls, the tiles, the aspect of workshops), Cato
 * (De agri cultura) and Varro (De re rustica) for the plant of the farm
 * trades, the shops of Pompeii and Herculaneum and the street of the
 * fullers at Ostia for the fronts, the funerary reliefs of craftsmen
 * (the Haterii, the Vatican's potter and the Louvre's smith) for the tools.
 *
 * Metres, the footprint (2 x 2 tiles, 8 m) at the origin, y up, the street
 * toward +z. The shed fills the back of the plot (z -3.7 to -1.6) and opens
 * to the front, so the camera, which sees the +z and +x sides, looks into
 * it; the yard lies in front of it. Nothing outside +-4 m.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, CircleGeometry, ExtrudeGeometry, Path, Shape } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { artRng } from '../texgen.js';
import { antefixAt } from './masonry.js';
import { beam, post, lin, leanTo, basket, heap, jar, wattleFence, woodpile, cart } from './rural.js';
import { Yard, YARD, bx, colour, stone, cyl } from './industryKit.js';

export const F = YARD.floorY;

/** The shed's measures (metres): the trades place their fittings by them. */
export const WS = Object.freeze({
  x0: -3.7, x1: 3.7, zBack: -3.7, zFront: -1.6,
  /** The walls' thickness, the tufa footing's height, the back wall's top, the eaves (plate) height. */
  t: 0.3, foot: 0.55, back: 3.2, eave: 2.4,
  /** The front posts' x. */
  posts: Object.freeze([-3.55, -1.2, 1.2, 3.55]),
  /** The room inside the walls. */
  in: Object.freeze({ x0: -3.4, x1: 3.4, z0: -3.4, z1: -1.6 }),
  /** The lantern on the front-right post (its base). */
  lamp: Object.freeze([3.34, 1.86, -1.28]),
});

/** The plaster's wash and the dado's red, and the tufa's tone (houseKit.js TUFA). */
export const WASH = Object.freeze({ cream: 0xe7dbbb, ochre: 0xdcc58f, pink: 0xe4c8b0, grey: 0xd8d0bc });
export const DADO = Object.freeze({ red: 0xa6483a, oxblood: 0x8a3a30, ochre: 0xb5703a });
const TUFA = 0xd0bc94;
/** How much lighter the workshops' timber is than the yard kit's (the shed's shade darkens it). */
const WOOD_LIFT = 1.55;

/** The workshops' materials: the yard's, and the plaster, tufa and dyed cloth (the same looks as the houses', the baths' and the market's). */
export function workshopMaterials() {
  return {
    plaster: material('plaster', { surface: 'plaster', vertexColors: true, snow: 1 }),
    tufa: material('tufa', { surface: 'tufa', vertexColors: true, snow: 1 }),
    cloth: material('cloth-dyed', { surface: 'wool', vertexColors: true, snow: 0.7 }),
  };
}

/** A yard with the workshops' materials added. */
export class WsYard extends Yard {
  constructor(name, lod) {
    super(name, lod);
    Object.assign(this.M, workshopMaterials());
  }

  /** Add geometries as Yard.add does; timber is lifted a shade (the wood's texture is dark under the roof's shadow, and a workshop's timber is cut and worn pale). */
  add(key, geos, when = 'always', cast = true) {
    if (key === 'wood') for (const g of [geos].flat(Infinity)) if (g) colour(g, [1, 1, 1], WOOD_LIFT);
    return super.add(key, geos, when, cast);
  }
}

/** Is it a close-up (lod 0) or the near middle (lod 1) or far? */
export const seg = (lod, a, b, c) => (lod === 0 ? a : lod === 1 ? b : c);

// ---------------------------------------------------------------------------
// The shed
// ---------------------------------------------------------------------------

/**
 * A wall that follows the lean-to roof: a polygon from the back (height
 * hBack) to the front (hFront), `t` thick, with holes. Built in (s, y) with
 * s the distance from the wall's front edge toward the back, extruded
 * across its thickness (the wall's outer face at w = t), UVs in metres.
 */
function slopedWall(s0, s1, y0, hBack, hFront, t, holes = []) {
  const sh = new Shape();
  sh.moveTo(s0, y0);
  sh.lineTo(s1, y0);
  sh.lineTo(s1, hBack);
  sh.lineTo(s0, hFront);
  sh.closePath();
  for (const h of holes) {
    const p = new Path();
    const x0 = h.s - h.w / 2;
    const x1 = h.s + h.w / 2;
    p.moveTo(x0, h.y);
    if (h.arch) {
      p.lineTo(x0, h.y + h.h);
      const n = 6;
      for (let k = 1; k <= n; k++) {
        const a = Math.PI - (k / n) * Math.PI;
        p.lineTo(h.s + Math.cos(a) * (h.w / 2), h.y + h.h + Math.sin(a) * (h.w / 2));
      }
      p.lineTo(x1, h.y);
    } else {
      p.lineTo(x0, h.y + h.h);
      p.lineTo(x1, h.y + h.h);
      p.lineTo(x1, h.y);
    }
    p.closePath();
    sh.holes.push(p);
  }
  const g = new ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 6 });
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/** Plaster colour by height: the red dado along the foot, a darker line over it, then the wash. */
function limewash(g, wash, dado, top) {
  const w = lin(wash);
  const d = lin(dado);
  const line = lin(dado, 1.35);
  return tintGeometry(boxUV(g), (x, y, z) => {
    const k = 0.95 + 0.05 * Math.sin(x * 2.1 + z * 1.7 + y * 0.9);
    const dh = WS.foot + 0.95;
    if (y < dh) return [d[0] * k, d[1] * k, d[2] * k];
    if (y < dh + 0.07) return [line[0], line[1], line[2]];
    // The wash weathers toward the foot and under the eaves.
    const m = 0.93 + 0.07 * Math.min(1, (y - dh) / 0.6) - 0.06 * Math.max(0, (y - top + 0.3) / 0.3);
    return [w[0] * m * k, w[1] * m * k, w[2] * m * k];
  });
}

/** Beaten earth over the whole footprint (the clay pit's). */
export function ground(y, tone = 0xcdc0a8) {
  y.add('earth', colour(stone(2 * YARD.half - 0.1, F, 2 * YARD.half - 0.1, 0, 0, 0, { bevel: 0.01, seed: 1, wobble: 0, tone: 0, grime: 0 }), lin(tone)));
}

/**
 * The shed: footing, walls, posts, the tiled lean-to, antefixes, lantern and
 * the shop-front boards. Options:
 *   wash, dado   the plaster's colours (WASH, DADO)
 *   doorZ        the +x wall's door, its middle z (null: none)
 *   window       a window in the back wall: its x (null: none)
 *   seed         varies the stones and tiles
 */
export function shed(y, lod, { wash = WASH.cream, dado = DADO.red, doorZ = -2.5, window = null, seed = 1 } = {}) {
  const { x0, x1, zBack, zFront, t, foot, back, eave } = WS;
  const span = zFront - zBack;
  const pitch = Math.atan2(back - eave, span);
  // The footing of tufa under the back and end walls.
  const tufa = (w, d, x, z, k) => colour(stone(w, foot, d, x, 0, z, { bevel: 0.025, seed: seed + k, wobble: 0.01, tone: 0.1, grime: 0.3 }), lin(TUFA));
  y.add('tufa', [
    tufa(x1 - x0, t, 0, zBack + t / 2, 1),
    tufa(t, span - t, x0 + t / 2, (zBack + t + zFront) / 2, 2),
    tufa(t, span - t, x1 - t / 2, (zBack + t + zFront) / 2, 3),
  ]);
  // The back wall (plastered, its dado), with a window if asked.
  const wallT = 0.26;
  const open = window === null ? [] : [{ x: window, w: 0.7, h: 0.9, y: 1.25 }];
  const backWall = new ExtrudeGeometry(rectShape(x1 - x0 - 2 * t, back - foot - 0.1, open), { depth: wallT, bevelEnabled: false, curveSegments: 6 });
  backWall.deleteAttribute('uv');
  backWall.computeVertexNormals();
  backWall.translate(0, foot, zBack + 0.02);
  y.add('plaster', limewash(backWall, wash, dado, back));
  // The end walls, sloping with the roof; the right one (the camera's) has the door.
  const sFront = -zFront; // (s runs from the front edge toward the back: s = -z)
  const sBack = -zBack;
  const doorS = doorZ === null ? [] : [{ s: -doorZ, w: 0.95, y: foot, h: 1.65, arch: true }];
  const rightWall = slopedWall(sFront, sBack - t, foot, back - 0.12, eave - 0.12, wallT, doorS);
  rightWall.rotateY(Math.PI / 2);
  // (rotateY(pi/2): local x -> world -z, local w -> world +x.)
  rightWall.translate(x1 - t + 0.02, 0, 0);
  y.add('plaster', limewash(rightWall, wash, dado, back));
  const lw = leftWallGeometry(wallT, foot, back - 0.12, eave - 0.12);
  lw.translate(x0 + 0.02, 0, 0);
  y.add('plaster', limewash(lw, wash, dado, back));
  if (doorZ !== null) {
    // The door: a plank leaf in its arch, ajar a hand's width, and a threshold stone.
    y.add('wood', bx(0.06, 1.6, 0.46, x1 - 0.2, foot, doorZ - 0.2, 0.7));
    y.add('stone', stone(0.5, 0.1, 1.15, x1 - 0.1, 0, doorZ, { bevel: 0.02, seed: seed + 4, wobble: 0.004, tone: 0.1, grime: 0.4 }));
  }
  // The posts on their stone bases, and the plate on them (a beam across the front).
  const wood = [];
  const base = [];
  WS.posts.forEach((x, k) => {
    const p = post(x, zFront - 0.06, eave - 0.08, { r: 0.085, seed: seed + 10 + k, lod });
    wood.push(...p.wood);
    base.push(...p.stone);
  });
  y.add('wood', wood);
  y.add('stone', base);
  y.add('wood', beam([x0 + 0.1, eave - 0.14, zFront - 0.06], [x1 - 0.1, eave - 0.14, zFront - 0.06], 0.17, seed + 20, lod));
  if (lod < 2) {
    // Braces from each post to the plate.
    for (const x of [-1.2, 1.2]) for (const s of [-1, 1]) y.add('wood', beam([x, eave - 0.62, zFront - 0.06], [x + s * 0.5, eave - 0.14, zFront - 0.06], 0.07, seed + 30 + x, lod));
  }
  // The roof: one pitch of tiles on the back wall's top, hanging a hand over each end and a forearm over the front.
  const over = 0.25;
  const roof = leanTo({ L: x1 - x0 + 0.5, span, topY: back, eaveY: eave, lod, seed: seed + 40, over });
  for (const g of roof.tile) g.translate(0, 0, zBack);
  for (const g of roof.wood) g.translate(0, 0, zBack);
  y.add('tile', roof.tile);
  y.add('wood', roof.wood);
  if (lod === 0) {
    // Antefixes along the eave, one to every imbrex row (the rows are 0.5 m apart).
    const rnd = artRng(seed + 50);
    const eaveY = back + 0.02 - (span + over) * Math.tan(pitch);
    const down = [0, -Math.sin(pitch), Math.cos(pitch)];
    const fixes = [];
    for (let x = x0 - 0.2; x <= x1 + 0.21; x += 0.5) fixes.push(antefixAt([x, eaveY + 0.02, zFront + over], down, rnd));
    y.add('tile', fixes);
  }
  // The lantern on a bracket at the front-right post.
  const [lx, ly, lz] = WS.lamp;
  y.add('wood', bx(0.26, 0.04, 0.4, lx - 0.1, ly - 0.04, lz - 0.2, 0.8));
  y.add('wood', bx(0.04, 0.5, 0.04, lx - 0.2, ly - 0.38, lz + 0.14, 0.8));
  y.lantern(lx, ly, lz + 0.02);
  shopFront(y, lod);
  fence(y, lod, seed);
}

/** A rectangle (centred on x, from y 0 up h) with holes, as a Shape. */
function rectShape(w, h, holes) {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.closePath();
  for (const o of holes) {
    const p = new Path();
    p.moveTo(o.x - o.w / 2, o.y);
    p.lineTo(o.x - o.w / 2, o.y + o.h);
    p.lineTo(o.x + o.w / 2, o.y + o.h);
    p.lineTo(o.x + o.w / 2, o.y);
    p.closePath();
    s.holes.push(p);
  }
  return s;
}

/** The left end wall: a plain sloping wall from the back (z = zBack + t) to the front, its outer face -x. */
function leftWallGeometry(wallT, y0, hBack, hFront) {
  const { zBack, zFront, t } = WS;
  // Shape x = z (back at the low x); rotateY(-pi/2): local x -> world z, local w -> world -x.
  const sh = new Shape();
  sh.moveTo(zBack + t, y0);
  sh.lineTo(zFront, y0);
  sh.lineTo(zFront, hFront);
  sh.lineTo(zBack + t, hBack);
  sh.closePath();
  const g = new ExtrudeGeometry(sh, { depth: wallT, bevelEnabled: false });
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  g.rotateY(-Math.PI / 2);
  g.translate(wallT, 0, 0);
  return g;
}

/**
 * The yard's fence: wattle hurdles (stakes with withies woven between: the
 * cheap fence Varro and Columella describe) along the left side and the
 * street, with a gate's gap in the street side, closing the yard the way a
 * Roman workshop's forecourt was closed; the right side stays open to the
 * camera. Two gateposts stand at the gap.
 */
function fence(y, lod, seed) {
  const gate = 0.95;
  const a = wattleFence([[-3.85, WS.zFront + 0.1], [-3.85, 3.85], [-gate, 3.85]], { h: 0.85, seed: seed + 60, lod });
  const b = wattleFence([[gate, 3.85], [3.85, 3.85]], { h: 0.85, seed: seed + 61, lod });
  // (Lifted a finger's breadth: the hurdles' feet are set in the ground and would show under it.)
  const up = (g) => g.translate(0, 0.015, 0);
  y.add('wicker', [...a.wicker, ...b.wicker].map((g) => colour(up(g), [1, 1, 1], 1.5)));
  y.add('wood', [...a.wood, ...b.wood].map(up));
  for (const x of [-gate, gate]) y.add('wood', bx(0.14, 1.35, 0.14, x, F, 3.85, 0.78));
}

/** A heap of firewood or kindling of length L at (x, z), turned ry, as a woodpile (rural.js). */
export function logs(x, z, L, h, lod, ry = 0, seed = 1) {
  return woodpile(L, h, seed, lod).map((g) => g.rotateY(ry).translate(x, F, z));
}

/** A hand cart standing at (x, z), turned ry (rural.js cart: the pole toward +z), scaled down to a handcart's size. Returns { wood, iron }. */
export function handcart(x, z, ry, lod, seed = 1, k = 0.7) {
  const c = cart(lod, seed);
  const place = (g) => g.scale(k, k, k).rotateY(ry).translate(x, F, z);
  return { wood: c.wood.map(place), iron: c.iron.map(place) };
}

/**
 * The shop front: open when staffed (nothing across the bays: the boards
 * are stowed out of sight, and the camera looks in); shut, the boards across
 * the bays (the shutters of the Pompeian shops, each a run of planks slid
 * into a groove in the sill).
 */
function shopFront(y, lod) {
  const { zFront, eave, posts } = WS;
  const bays = [[posts[0], posts[1]], [posts[1], posts[2]], [posts[2], posts[3]]];
  for (const [a, b] of bays) {
    const w = b - a - 0.2;
    const cx = (a + b) / 2;
    // Shut: planks from the sill to under the plate.
    // (Planks weathered grey-brown: as plaster's light ground with the colour in the vertices, the dark timber texture read as slate.)
    y.add('plaster', colour(bx(w, eave - 0.3, 0.05, cx, F, zFront - 0.02, 1), lin(0x8a7456)), 'shut', false);
    if (lod < 2) {
      for (let k = 1; k < Math.round(w / 0.3); k++) y.add('plaster', colour(bx(0.02, eave - 0.3, 0.06, a + 0.1 + k * 0.3, F, zFront - 0.015, 1), lin(0x5e4b34)), 'shut', false);
    }
  }
}

// ---------------------------------------------------------------------------
// Small things every trade needs
// ---------------------------------------------------------------------------

/**
 * An open wooden tub (a vat, a trough, a fuller's tub): r across at the
 * rim, h high, hooped; with `liquid` ([r, g, b] linear) a surface a hand
 * under the rim. Returns { wood, iron, liquid } geometries at (x, z) on y0.
 */
export function tub(x, z, r, h, lod, { y0 = F, liquid = null, level = 0.1, hoops = 2 } = {}) {
  const n = seg(lod, 22, 12, 7);
  const w = 0.045;
  const wall = revolve(profileOf([[r * 0.9, 0], [r, h], [r + 0.025, h], [r + 0.025, h + 0.02], [r - w, h + 0.02], [r - w - 0.005, 0.08], [0, 0.08]]), {
    segments: n, metres: 0.6, tint: (p) => (Math.hypot(p.x, p.z) < r - w && p.y < h ? 0.62 : 0.88 + 0.12 * Math.min(1, p.y / h)),
  });
  wall.translate(x, y0, z);
  const out = { wood: [wall], iron: [], liquid: [] };
  if (lod < 2) {
    for (let k = 0; k < hoops; k++) {
      const hy = h * (hoops === 1 ? 0.5 : 0.2 + (0.55 * k) / (hoops - 1));
      const rr = r * 0.9 + (r - r * 0.9) * (hy / h) + 0.028;
      const hp = new CylinderGeometry(rr, rr, 0.03, n, 1, true);
      hp.translate(x, y0 + hy, z);
      out.iron.push(tintGeometry(boxUV(hp), () => 0.9));
    }
  }
  if (liquid) {
    const d = new CircleGeometry(r - w - 0.01, n);
    d.rotateX(-Math.PI / 2);
    d.translate(x, y0 + h - level, z);
    out.liquid.push(tintGeometry(boxUV(d), () => liquid));
  }
  return out;
}

/** One transport amphora, 0.85 of the farm's (0.85 m), standing at (x, z) on y0, leaning (lx, lz) radians. */
export function amphora(x, z, { y0 = F, lod = 0, seed = 1, lx = 0, lz = 0, s = 0.85, tone = 1 } = {}) {
  const g = jar({ amphora: true, lod, seed });
  g.scale(s, s, s);
  g.rotateX(lx);
  g.rotateZ(lz);
  g.translate(x, y0, z);
  return tone === 1 ? g : colour(g, [1, 1, 1], tone);
}

/** A basket (rural.js) of a heap of small things at (x, z) on y0: { wicker, fill, produce } geometries. */
export function basketOf(x, z, colours, { r = 0.25, h = 0.3, y0 = F, lod = 0, seed = 1, n = 16, rr = 0.035 } = {}) {
  const b = basket(r, h, 1, lod);
  const out = { wicker: [b.wicker.translate(x, y0, z)], produce: [] };
  const hp = heap(lod === 2 ? 3 : n, r * 0.8, h * 0.8, rr, colours, seed, lod);
  if (hp) out.produce.push(hp.translate(x, y0, z));
  return out;
}

/** A four-legged stool, seat `top` high, a seat `s` square, at (x, z). */
export function stool(x, z, { top = 0.45, s = 0.34, k = 0.8, y0 = F } = {}) {
  const out = [bx(s, 0.045, s, x, y0 + top - 0.045, z, k)];
  for (const a of [-1, 1]) for (const b of [-1, 1]) out.push(bx(0.045, top - 0.045, 0.045, x + a * (s / 2 - 0.05), y0, z + b * (s / 2 - 0.05), k * 0.9));
  return out;
}

/**
 * A trestle table: a top w x d at height `top` on two splayed A-frames
 * (a pair of legs and a stretcher), centred at (x, z).
 */
export function trestle(x, z, w, d, top, { lod = 0, k = 0.85, y0 = F, thick = 0.05 } = {}) {
  const out = [bx(w, thick, d, x, y0 + top - thick, z, k)];
  for (const s of [-1, 1]) {
    const cx = x + s * (w / 2 - 0.2);
    for (const e of [-1, 1]) out.push(cyl([cx, y0, z + e * (d / 2 + 0.06)], [cx, y0 + top - thick, z + e * (d / 2 - 0.1)], 0.035, 0.03, seg(lod, 6, 5, 4)));
    if (lod < 2) out.push(bx(0.04, 0.04, d, cx, y0 + top * 0.35, z, k * 0.9));
  }
  return out;
}

/** A plank shelf: boards at the given heights, x0..x1 long and `d` deep at z (back edge), on end posts. */
export function plankShelves(x0, x1, z, d, heights, { y0 = F, lod = 0, k = 0.82 } = {}) {
  const out = [];
  for (const h of heights) out.push(bx(x1 - x0, 0.04, d, (x0 + x1) / 2, y0 + h, z + d / 2, k));
  const top = Math.max(...heights) + 0.12;
  const n = Math.max(2, Math.round((x1 - x0) / 1.4) + 1);
  for (let i = 0; i < n; i++) {
    const x = x0 + 0.03 + ((x1 - x0 - 0.06) * i) / (n - 1);
    out.push(bx(0.06, top, 0.06, x, y0, z + d - 0.04, k * 0.85));
    if (lod < 2) out.push(bx(0.05, top, 0.05, x, y0, z + 0.03, k * 0.8));
  }
  return out;
}

/** A hook line: pegs along a board on the wall (x0..x1 at z, height y), for hung tools. */
export function pegBoard(x0, x1, z, yy, lod, k = 0.75) {
  const out = [bx(x1 - x0, 0.14, 0.04, (x0 + x1) / 2, yy, z, k)];
  if (lod < 2) {
    const n = Math.max(2, Math.round((x1 - x0) / 0.38));
    for (let i = 0; i < n; i++) out.push(bx(0.025, 0.025, 0.12, x0 + 0.14 + ((x1 - x0 - 0.28) * i) / Math.max(1, n - 1), yy + 0.05, z + 0.07, k * 0.9));
  }
  return out;
}

/** Merge a list of geometries (for a piece repeated). */
export { lin, colour, stone, bx, cyl };
