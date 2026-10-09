/**
 * models/houseKit.js
 * ----------------------------------------------------------------------------
 * What the five house models share (houses.js: the hut, the cottage, the
 * townhouse, the apartment house and the tenement): the palettes, a bag that
 * gathers geometry by material and state, walls with openings on any of a
 * house's four sides, windows with shutters, balconies, awnings, and roofs
 * (tiled, thatched; gabled or hipped).
 *
 * A house is built in metres on a 4 m tile (a tenement on 8 m), the street
 * toward +z, as every model (models/well.js). Everything on one side of a
 * house is built in that side's own frame (x along the wall, z out of it)
 * and turned to its place by `frame`, so a window is written once and put
 * on any wall.
 *
 * Colour is carried by the vertices (the materials are the plain plaster,
 * brick, tile and wood of the look), so one kit's four variants and every
 * house's wash cost the same programs as one. The states ('open': lived in,
 * 'shut': empty, models.js partShows) change only the shutters, the doors
 * and the people: the geometry that differs is tagged in the bag.
 * ----------------------------------------------------------------------------
 */

import { BufferGeometry, Float32BufferAttribute, CylinderGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { box } from './castra.js';
import { wallWithOpenings, TaggedParts } from './masonry.js';
import { roofSlope, bush } from './learning.js';
import { lin, ruralMaterials, paint } from './rural.js';
import { artRng } from '../texgen.js';

/** How many looks a level has: picked by the building's id (houses.js variantOf). */
export const VARIANTS = 4;

/** Washes of plaster (sRGB): the whites, creams, ochres and reds the walls of Pompeii and Ostia were painted. */
export const WASH = Object.freeze({
  cream: 0xe6d9b8, white: 0xf0eadb, ochre: 0xd6ad62, yellow: 0xe0c078, red: 0xb4573f, pink: 0xd6a28a, grey: 0xcdc4b0, sand: 0xd8c39a, mud: 0xb39a74, lime: 0xe6dfc9,
});
/** Brick of Ostia's insulae: red, yellow-brown and a warm grey-red. */
export const BRICK = Object.freeze({ red: 0xc8745a, yellow: 0xe0bc78, grey: 0xbdae98, dark: 0xa5604a });
/** Woodwork: dark oak, weathered grey, ochre-brown, an olive green of the painted ones. */
export const WOODS = Object.freeze({ oak: 0x6a4a2c, grey: 0x8a7d68, brown: 0x8a5e34, olive: 0x59683f, red: 0x8a4630 });
/** Awnings and cloths: madder, woad, weld, undyed. */
export const CLOTH = Object.freeze({ madder: 0xb04a38, woad: 0x4d6c96, weld: 0xc9a33c, linen: 0xe2d8bd, green: 0x5b7a4c, murex: 0x7a3a5c });

/** The materials the houses share (the look's own, cached by key: no new program). */
export function houseMaterials() {
  const r = ruralMaterials();
  return {
    plaster: material('plaster', { surface: 'plaster', vertexColors: true, snow: 1 }),
    brick: material('brick', { surface: 'brick', vertexColors: true, snow: 1 }),
    stone: material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 }),
    rubble: r.wall,
    tile: r.tile,
    thatch: r.thatch,
    wood: r.wood,
    dark: r.dark,
    paint: material('paint', { color: 0xffffff, roughness: 0.6, vertexColors: true, snow: 0.8 }),
    clay: r.clay,
    leaf: r.leaf,
    earth: r.earth,
    flags: material('fort-flags', { surface: 'limestone', color: 0xb8ab94, vertexColors: true, snow: 0.8 }),
  };
}

/** Each bag key's part: [name, material, tags]. Doors, shutters and wares that depend on the house's state have a key a state. */
const PART = {
  plaster: ['walls', 'plaster'],
  brick: ['brick', 'brick'],
  stone: ['stone', 'stone'],
  rubble: ['rubble', 'rubble'],
  tile: ['roof', 'tile'],
  thatch: ['thatch', 'thatch'],
  // (Woodwork casts no shadow: a shutter's is a hair, and each caster is a second draw.)
  wood: ['wood', 'wood', { cast: false }],
  woodOpen: ['wood', 'wood', { when: 'open', cast: false }],
  woodShut: ['wood', 'wood', { when: 'shut', cast: false }],
  dark: ['inside', 'dark', { cast: false }],
  paint: ['paint', 'paint', { cast: false }],
  clay: ['pots', 'clay', { cast: false }],
  clayOpen: ['pots', 'clay', { when: 'open', cast: false }],
  leaf: ['leaves', 'leaf', { cast: false }],
  earth: ['yard', 'earth', { cast: false }],
  flags: ['flags', 'flags', { cast: false }],
};

/** Keys that share another's material at every level of detail (see Bag.add). */
const MERGED = { stone: 'plaster', clay: 'tile', dark: 'plaster', paint: 'plaster', flags: 'plaster', earth: 'plaster' };
/**
 * From the middle level of detail out (a tile under 160 device px wide) the woodwork, the paint, the yard and
 * the rubble are plaster too, their colour in the vertices, and far out (under 72 px) the brick: a draw is
 * paid for by every look in view whatever it shows, so a kit is two to four draws there, not eight. The
 * shutters swung back and the doors open are all that is kept of the state; what shuts them (the shop's
 * boards, closed leaves) shows close up only.
 */
const FLAT = { wood: 'plaster', woodOpen: 'plaster', rubble: 'plaster' };
const DARK = [0.011, 0.009, 0.008];

/** A house's geometry gathered by part, built to a level of detail. */
export class Bag {
  constructor(name, lod, seed) {
    this.name = name;
    this.lod = lod;
    this.seed = seed;
    this.rnd = artRng(seed);
    this.o = {};
  }

  /**
   * Add geometries (arrays nest) to a part. Trim in stone and plaster, pots and tiles, and the dark of a
   * window and plain colour share a material each (their colour is in the vertices): a draw fewer a kit,
   * and a kit is a draw a part for every home of its look in view.
   */
  add(key, ...g) {
    if (!PART[key]) throw new Error(`houses: no part ${key}`);
    const list = g.flat(Infinity).filter(Boolean);
    if (key === 'dark') for (const x of list) tintGeometry(x, () => DARK);
    let to = MERGED[key] || key;
    if (this.lod >= 1) {
      if (key === 'woodShut') return this;
      to = FLAT[to] || to;
      if (this.lod === 2 && to === 'brick') to = 'plaster';
    }
    (this.o[to] ??= []).push(...list);
    return this;
  }

  /** The model: { group, meshes, triangles }. */
  build() {
    // Close up the woodwork that shows in both states goes into each state's own part, so a kit draws one wood
    // mesh for the homes in its commoner state, not two (the swung leaves and the rest).
    if (this.o.wood) {
      const base = this.o.wood;
      delete this.o.wood;
      this.o.woodOpen = [...(this.o.woodOpen || []), ...base];
      this.o.woodShut = [...(this.o.woodShut || []), ...base.map((g) => g.clone())];
    }
    const m = houseMaterials();
    const p = new TaggedParts(this.name);
    for (const [key, list] of Object.entries(this.o)) {
      const [name, mat, tags] = PART[key];
      p.add(name, m[mat], list, tags);
    }
    return p.build();
  }
}

// ---------------------------------------------------------------------------
// The four sides
// ---------------------------------------------------------------------------

/** Each side's turn about y, and the world point its frame's origin is at, from (centre along it, plane distance). */
const SIDES = {
  '+z': [0, (c, P) => [c, P]],
  '-z': [Math.PI, (c, P) => [c, -P]],
  '+x': [Math.PI / 2, (c, P) => [P, c]],
  '-x': [-Math.PI / 2, (c, P) => [-P, c]],
};

/**
 * A function that turns a geometry built in a side's frame (x along the
 * wall, y up, z out of it) to that side of the house: `plane` the distance
 * of the wall's outer face from the middle, `centre` where along the side
 * the frame's origin is.
 */
export function frame(side, plane, centre = 0) {
  const [ry, at] = SIDES[side];
  const [ox, oz] = at(centre, plane);
  return (g) => {
    g.rotateY(ry);
    g.translate(ox, 0, oz);
    return g;
  };
}

/** A flat quad in a frame's x-y plane at depth z facing out, from (x0, y0) to (x1, y1), painted `rgb`. */
export function flat(x0, y0, x1, y1, z, rgb) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  boxUV(g);
  return tintGeometry(g, () => rgb);
}

/**
 * A wall on a side with openings cut through it, painted `c` (linear rgb)
 * and darkened by `k`: `w` wide, centred at `centre`, from y0 up h, t thick
 * (inwards from `plane`). Each opening { x, y (up from y0), w, h, arch }.
 * Far out the wall is a solid box and its openings painted on it. Returns
 * the frame's put function for the trimmings.
 */
export function wall(bag, side, plane, centre, { w, y0 = 0, h, t = 0.3, open = [], c, k = 1, key = 'plaster', dark = [0.01, 0.009, 0.008] }) {
  const put = frame(side, plane, centre);
  // The brick texture is dark: its colour is lifted so a wall reads as Ostia's warm brick under the sun, not as a shadow
  // (far out the brick is plaster, which needs no lift).
  if (key === 'brick' && bag.lod < 2) k *= 1.3;
  // (Openings are cut through only close up, where a tile is 160 device px or more wide: from the middle level out their depth is
  // under a pixel, and a wall with sixty holes costs thirty milliseconds to build.)
  if (bag.lod < 1) {
    bag.add(key, put(paint(wallWithOpenings(w, h, t, open, { lod: bag.lod, y0 }), c, () => k)));
    // The dark room behind the openings, a thin box just inside the wall.
    if (open.length) bag.add('dark', put(box(w, h, 0.02, 0, y0, -t + 0.012)));
  } else {
    bag.add(key, put(paint(box(w, h, t, 0, y0, -t / 2, 1), c, () => k)));
    for (const o of open) bag.add('dark', put(flat(o.x - o.w / 2, y0 + o.y, o.x + o.w / 2, y0 + o.y + o.h, 0.006, dark)));
  }
  return put;
}

// ---------------------------------------------------------------------------
// Windows, doors and what hangs on a wall
// ---------------------------------------------------------------------------

/**
 * Trim for one opening on a wall (in the side's frame; the opening itself is
 * cut by `wall`): a stone sill and lintel, and shutters. `shutters` is
 * 'open' (swung back flat against the wall while lived in, closed when
 * empty), 'closed' (always), or null (a bare window with a bar across it).
 * `o`: { x, y (absolute), w, h }; `col`: the shutters' linear colour.
 */
export function windowTrim(bag, put, o, { shutters = 'open', col = lin(WOODS.oak), sill = true, lod = bag.lod } = {}) {
  if (lod === 2) return;
  const { x, y, w, h } = o;
  // (The sill and the lintel only close up: at the middle level a window is its shutters.)
  if (sill && lod === 0) bag.add('stone', put(box(w + 0.16, 0.06, 0.15, x, y - 0.06, 0.07, 0.95)));
  if (lod === 0) bag.add('wood', put(box(w + 0.12, 0.09, 0.1, x, y + h, 0.04, lin(WOODS.oak, 0.8))));
  const leaf = (px) => box(w / 2 - 0.01, h, 0.035, px, y, 0.03, col);
  if (shutters === 'closed') {
    if (lod === 0) bag.add('wood', put(leaf(x - w / 4)), put(leaf(x + w / 4)));
    else bag.add('wood', put(box(w - 0.02, h, 0.035, x, y, 0.03, col)));
  } else if (shutters === 'open') {
    // Lived in: swung back flat against the wall either side. Empty: shut across the window.
    for (const s of [-1, 1]) {
      bag.add('woodOpen', put(leaf(x + s * (w * 0.75 + 0.02))));
      bag.add('woodShut', put(leaf(x + s * (w / 4))));
    }
  } else if (lod === 0) {
    bag.add('wood', put(box(w, 0.035, 0.035, x, y + h * 0.5, 0.01, lin(WOODS.oak, 0.7))));
  }
}

/** A door leaf closing an opening at x, from y, `w` x `h`, painted `col`, with a studded plank look from two bands. */
export function doorLeaf(bag, put, { x, y = 0, w, h, col = lin(WOODS.oak), open = false }) {
  if (bag.lod === 2) {
    bag.add('paint', put(flat(x - w / 2, y, x + w / 2, y + h, 0.012, col)));
    return;
  }
  // Shut (or empty): the leaf across the opening. Lived in: swung inward to one side, the dark showing.
  bag.add(open ? 'woodShut' : 'wood', put(box(w - 0.02, h - 0.02, 0.05, x, y, -0.02, col)));
  if (open) {
    bag.add('woodOpen', put(box(0.05, h - 0.02, w * 0.5, x - w / 2 + 0.03, y, -0.3, col)));
    if (bag.lod === 0) bag.add('wood', put(box(w * 0.85, 0.05, 0.05, x, y + h * 0.35, 0.002, lin(WOODS.oak, 0.6))));
  } else if (bag.lod === 0) {
    for (const f of [0.28, 0.7]) bag.add('wood', put(box(w - 0.04, 0.06, 0.02, x, y + h * f, 0.012, lin(WOODS.oak, 0.6))));
  }
}

/** A jamb and lintel in stone round a door or a shop's mouth: x, w, h. */
export function doorFrame(bag, put, { x, w, h, y = 0 }) {
  if (bag.lod === 2) return;
  for (const s of [-1, 1]) bag.add('stone', put(box(0.14, h + 0.1, 0.16, x + s * (w / 2 + 0.05), y, 0.06, 0.95)));
  bag.add('stone', put(box(w + 0.4, 0.14, 0.16, x, y + h, 0.06, 0.95)));
}

/**
 * A balcony (maenianum) of timber on a side: a floor of planks on joists
 * (or brick corbels), a railing of posts and a rail, `w` wide, `d` out from
 * the wall, floor at y. `corbels` brick brackets under it instead of joists.
 */
export function balcony(bag, put, { x, w, d = 0.5, y, rail = 0.95, corbels = false, col = lin(WOODS.oak) }) {
  const lod = bag.lod;
  bag.add('wood', put(box(w, 0.07, d, x, y, d / 2, col)));
  if (lod === 2) {
    bag.add('wood', put(box(w, rail, 0.04, x, y + 0.07, d - 0.02, col)));
    return;
  }
  const n = Math.max(2, Math.round(w / 0.55));
  for (let k = 0; k <= n; k++) {
    const px = x - w / 2 + 0.03 + ((w - 0.06) * k) / n;
    bag.add('wood', put(box(0.05, rail, 0.05, px, y + 0.07, d - 0.04, col)));
    if (k < n && lod === 0) bag.add('wood', put(box((w - 0.06) / n - 0.05, 0.03, 0.025, px + (w - 0.06) / n / 2, y + 0.07 + rail * 0.4, d - 0.04, col)));
  }
  bag.add('wood', put(box(w, 0.06, 0.09, x, y + 0.07 + rail, d - 0.06, col)));
  const m = Math.max(2, Math.round(w / 0.9));
  for (let k = 0; k < m; k++) {
    const px = x - w / 2 + (w * (k + 0.5)) / m;
    if (corbels) bag.add('brick', put(box(0.2, 0.12, d * 0.9, px, y - 0.12, d * 0.45, lin(BRICK.red, 0.85))), put(box(0.2, 0.1, d * 0.5, px, y - 0.22, d * 0.25, lin(BRICK.red, 0.8))));
    else bag.add('wood', put(box(0.1, 0.13, d + 0.1, px, y - 0.13, d / 2 - 0.1, lin(WOODS.oak, 0.85))));
  }
}

/** A striped cloth awning over a shop front, sloping out and down from y, `w` wide, `d` out. */
export function awning(bag, put, { x, w, y, d = 0.8, drop = 0.35, cols }) {
  const strips = bag.lod === 2 ? 1 : Math.max(2, Math.round(w / 0.35));
  for (let k = 0; k < strips; k++) {
    const x0 = x - w / 2 + (w * k) / strips;
    const x1 = x - w / 2 + (w * (k + 1)) / strips;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([x0, y, 0.02, x1, y, 0.02, x1, y - drop, d, x0, y - drop, d], 3));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
    // (Seen from above and below: the top face tinted, a second copy under it facing down.)
    boxUV(g);
    const under = g.clone();
    under.setIndex([0, 1, 2, 0, 2, 3]);
    under.computeVertexNormals();
    const c = cols[k % cols.length];
    bag.add('paint', put(tintGeometry(g, () => c)), put(tintGeometry(under, () => [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7])));
  }
  if (bag.lod < 2) for (const s of [-1, 1]) bag.add('wood', put(box(0.04, 0.04, d, x + s * (w / 2 - 0.02), y - drop, d / 2, lin(WOODS.oak, 0.7))));
}

// ---------------------------------------------------------------------------
// Roofs
// ---------------------------------------------------------------------------

/** A triangle with its face toward `out`. */
export function tri(p0, p1, p2, out, c) {
  const g = new BufferGeometry();
  const make = (a, b, d) => {
    g.setAttribute('position', new Float32BufferAttribute([...a, ...b, ...d], 3));
    g.computeVertexNormals();
  };
  make(p0, p1, p2);
  const n = g.attributes.normal;
  if (n.getX(0) * out[0] + n.getY(0) * out[1] + n.getZ(0) * out[2] < 0) make(p0, p2, p1);
  boxUV(g);
  return tintGeometry(g, () => c);
}

/** A slab of thatch over a quad (the tile roof's corner order), `thick` deep, its top a little uneven. */
function thatchSlope(quad, thick, rnd, lod) {
  const [e0, e1, t1, t0] = quad;
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const nu = lod === 2 ? 1 : 4;
  const nv = lod === 2 ? 1 : 3;
  const pos = [];
  const idx = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const p = lerp(lerp(e0, e1, i / nu), lerp(t0, t1, i / nu), j / nv);
      const edge = i === 0 || j === 0 || i === nu || j === nv;
      pos.push(p[0], p[1] + (edge || lod === 2 ? 0 : (rnd() - 0.5) * 0.07), p[2]);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      idx.push(a, a + 1, a + nu + 2, a, a + nu + 2, a + nu + 1);
    }
  }
  const top = new BufferGeometry();
  top.setAttribute('position', new Float32BufferAttribute(pos, 3));
  top.setIndex(idx);
  top.computeVertexNormals();
  if (top.attributes.normal.getY(0) < 0) { top.setIndex(idx.map((v, i) => idx[i - (i % 3 === 1 ? -1 : i % 3 === 2 ? 1 : 0)])); top.computeVertexNormals(); }
  boxUV(top);
  const out = [tintGeometry(top, (x, y, z) => 0.8 + 0.2 * Math.sin(x * 3.1 + z * 2.3))];
  // The skirt: the eave's thick edge and the two sides, down `thick`.
  const sides = [[e0, e1], [e1, t1], [t0, e0]];
  for (const [a, b] of sides) {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([...a, ...b, b[0], b[1] - thick, b[2], a[0], a[1] - thick, a[2]], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    const mid = lerp(lerp(e0, e1, 0.5), lerp(t0, t1, 0.5), 0.5);
    const c = [(a[0] + b[0]) / 2 - mid[0], 0, (a[2] + b[2]) / 2 - mid[2]];
    const n = g.attributes.normal;
    if (n.getX(0) * c[0] + n.getZ(0) * c[2] < 0) { g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals(); }
    boxUV(g);
    out.push(tintGeometry(g, () => 0.62));
  }
  return out;
}

/** A cylinder lying along the ridge (along x or z) from a to b at (y, across). */
function ridgeRoll(along, a, b, y, mid, r, lod) {
  const g = new CylinderGeometry(r, r, b - a, lod ? 6 : 10, 1);
  g.rotateZ(Math.PI / 2); // along x
  g.translate((a + b) / 2, y, 0);
  if (along === 'z') { g.rotateY(Math.PI / 2); g.translate(mid, 0, 0); } else g.translate(0, 0, mid);
  boxUV(g);
  return tintGeometry(g, () => 0.85);
}

/**
 * A roof over the rectangle x0..x1, z0..z1 (the walls' outer faces): ridge
 * along `along`, eaves at eaveY, `rise` up to the ridge, running `over` past
 * the walls. `hip` slopes the ends too; else the ends are gables (filled
 * with plaster of colour `fill`, `gableOver` past the walls). `kind`
 * 'tile' or 'thatch'. Returns { ridgeY }.
 */
export function ridgeRoof(bag, { x0, x1, z0, z1, eaveY, rise, along = 'x', over = 0.28, gableOver = 0.12, hip = false, kind = 'tile', fill = [0.8, 0.75, 0.65], tileTone = 1 }) {
  const alongX = along === 'x';
  const [A0, A1, B0, B1] = alongX ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
  const P = alongX ? (a, y, b) => [a, y, b] : (a, y, b) => [b, y, a];
  const hw = (B1 - B0) / 2;
  const bm = (B0 + B1) / 2;
  const slope = rise / hw;
  const ye = eaveY - over * slope;
  const yr = eaveY + rise;
  const quads = [];
  const lod = bag.lod;
  if (hip) {
    const aL = A0 - over;
    const aR = A1 + over;
    const am = (A0 + A1) / 2;
    const rl = Math.min(A0 + hw, am);
    const rr = Math.max(A1 - hw, am);
    for (const s of [1, -1]) quads.push([P(aL, ye, bm + s * (hw + over)), P(aR, ye, bm + s * (hw + over)), P(rr, yr, bm), P(rl, yr, bm)]);
    quads.push([P(aL, ye, bm - (hw + over)), P(aL, ye, bm + (hw + over)), P(rl, yr, bm), P(rl, yr, bm)]);
    quads.push([P(aR, ye, bm + (hw + over)), P(aR, ye, bm - (hw + over)), P(rr, yr, bm), P(rr, yr, bm)]);
    quads.ridge = [rl, rr];
  } else {
    const aL = A0 - gableOver;
    const aR = A1 + gableOver;
    for (const s of [1, -1]) quads.push([P(aL, ye, bm + s * (hw + over)), P(aR, ye, bm + s * (hw + over)), P(aR, yr, bm), P(aL, yr, bm)]);
    quads.ridge = [aL, aR];
    for (const [a, sgn] of [[A0, -1], [A1, 1]]) {
      const out = alongX ? [sgn, 0, 0] : [0, 0, sgn];
      bag.add('plaster', tri(P(a, eaveY - 0.05, bm - hw), P(a, eaveY - 0.05, bm + hw), P(a, yr, bm), out, fill));
    }
  }
  quads.forEach((q, i) => {
    if (kind === 'thatch') bag.add('thatch', thatchSlope(q, 0.22, bag.rnd, lod));
    else {
      const r = roofSlope(q, { lod, seed: bag.seed + 31 + i });
      bag.add('tile', tileTone === 1 ? r.tile : r.tile.map((g) => paint(g, [tileTone, tileTone, tileTone])));
      bag.add('wood', r.wood);
    }
  });
  const [ra, rb] = quads.ridge;
  if (rb - ra > 0.05) {
    bag.add(kind === 'thatch' ? 'thatch' : 'clay', ridgeRoll(along, ra, rb, yr + 0.01, bm, kind === 'thatch' ? 0.17 : 0.1, lod));
  }
  return { ridgeY: yr };
}

/** A lean-to roof: one slope from a high edge (z = zHigh, y = yHigh) down to the low one, over x0..x1. */
export function pentRoof(bag, { x0, x1, zHigh, zLow, yHigh, yLow, over = 0.25, kind = 'tile' }) {
  const dz = zLow - zHigh;
  const s = (yLow - yHigh) / dz;
  const zl = zLow + Math.sign(dz) * over;
  const yl = yLow + s * Math.sign(dz) * over;
  const q = [[x0 - over, yl, zl], [x1 + over, yl, zl], [x1 + over, yHigh, zHigh], [x0 - over, yHigh, zHigh]];
  if (kind === 'thatch') bag.add('thatch', thatchSlope(q, 0.2, bag.rnd, bag.lod));
  else {
    const r = roofSlope(q, { lod: bag.lod, seed: bag.seed + 77 });
    bag.add('tile', r.tile);
    bag.add('wood', r.wood);
  }
}

/** A fig or a pomegranate in a yard: a short trunk and a crown of foliage; `r` the crown's radius. */
export function fig(bag, x, z, r, seed) {
  const lod = bag.lod;
  const trunk = new CylinderGeometry(r * 0.09, r * 0.14, r * 1.1, lod ? 5 : 7, 1);
  trunk.translate(x, r * 0.55, z);
  boxUV(trunk);
  bag.add('wood', tintGeometry(trunk, () => lin(0x5a4632, 0.8)));
  bag.add('leaf', bush(x, r * 1.55, z, r, { lod, seed }));
}

/**
 * The four walls of a house over x0..x1, z0..z1 (outer faces): the front and
 * back across the whole width, the sides between them, each `t` thick, from
 * y0 up h, painted `c` times k. `openings` by side ('+z', '-z', '+x', '-x'),
 * each in that side's own frame (x along the wall from its middle, turned
 * as `frame` turns it: the back's and the right side's x run the other way
 * from the world's). Returns each side's put function for trimmings.
 */
export function shell(bag, { x0, x1, z0, z1, y0 = 0, h, t = 0.28, c, k = 1, key = 'plaster', openings = {}, skip = [] }) {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const put = {};
  const side = (s, plane, centre, w) => {
    if (!skip.includes(s)) put[s] = wall(bag, s, plane, centre, { w, y0, h, t, open: openings[s] || [], c, k, key });
  };
  side('+z', z1, cx, x1 - x0);
  side('-z', -z0, cx, x1 - x0);
  side('+x', x1, cz, z1 - z0 - 2 * t);
  side('-x', -x0, cz, z1 - z0 - 2 * t);
  return put;
}

/** A low wall or a bank of earth, a box x0..x1, z0..z1 from y0 up h, in colour c. */
export function slabBox(bag, key, x0, x1, z0, z1, h, c, y0 = 0) {
  bag.add(key, box(x1 - x0, h, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, c));
}
