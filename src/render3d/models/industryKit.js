/**
 * models/industryKit.js
 * ----------------------------------------------------------------------------
 * What the four raw producers' models share (clayPit.js, timberYard.js,
 * ironMine.js, marbleQuarry.js): their materials, a yard that gathers
 * geometry by material and state, and the small shapes they all need
 * (poles and trunks, rock lumps, spoil mounds, a thatched shelter on
 * posts, a stack of blocks, the fullness steps of a stock).
 *
 * Why one kit and four files: the four share a footprint (2 x 2 tiles, 8 m)
 * and a vocabulary (earth, timber, thatch, rock, rope, stock under a
 * shelter or in the open), but each has its own plan and its own tools,
 * and each plan is long enough to deserve a file.
 *
 * Sources for the shapes (see each building's file for its own):
 *   - Pliny the Elder, Natural History 36 and 33 and Vitruvius II and X,
 *     for the working of stone, mines, timber and clay and the machines;
 *   - the reliefs and finds of the Roman trades (the quarrymen of Carrara
 *     and Luni, the miners of Rio Tinto, the sawyers of the Ravenna and
 *     Haterii reliefs).
 *
 * Metres, the tile pair's middle at the origin, y up, the street toward +z
 * (models/well.js). A tile is 4 m, so the footprint is 8 m: x and z within
 * +-4.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, BufferGeometry, CylinderGeometry, CircleGeometry, Float32BufferAttribute, IcosahedronGeometry, Quaternion, Vector3 } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { material, stagnantMaterial } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab, lantern, lanternPane, TaggedParts } from './masonry.js';
import { ruralMaterials } from './rural.js';

/** The yard's measures: half its width (a 2 x 2 footprint is 8 m) and its beaten earth's thickness. */
export const YARD = Object.freeze({ half: 4, floorY: 0.04 });

/** The fullness of a producer's store as a step of 0 to 3: none, a third, two thirds, full (as the market and granary show it). */
export const STOCK_STEPS = 3;

/**
 * A producer's store as a step: 0 when empty, else the share of its cap
 * rounded up to thirds (any stock shows at least a third; the sim makes
 * its goods in lots of CART_CAPACITY, a quarter of the cap).
 */
export function stockStep(amount, cap) {
  const n = Math.max(0, amount || 0);
  if (n <= 0) return 0;
  return Math.max(1, Math.min(STOCK_STEPS, Math.ceil((n / cap) * STOCK_STEPS - 1e-9)));
}

/** The materials of the four, made once and shared by key (materials.js). */
export function yardMaterials() {
  return {
    ...ruralMaterials(),
    // Clay as dug (a yellow-brown that the fired ware is not), the iron ore of the mines, and the marble.
    rawClay: material('pit-clay', { surface: 'earth', color: 0xe8d0a0, vertexColors: true, snow: 1 }),
    ore: material('iron-ore', { surface: 'rubble', color: 0x7a4a34, vertexColors: true, snow: 1 }),
    // The bloom and the tuyere's glow of the iron mine's furnace, lit by themselves.
    ember: material('forge-ember', { color: 0xe8591f, roughness: 0.7, emissive: 0xff5a1a, emissiveIntensity: 0.6, snow: 0 }),
    marble: material('marble', { surface: 'marble', vertexColors: true, snow: 1 }),
    bronze: material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }),
    // Standing water (the clay pit's, the quarry's trough): the puddle's green, frozen to ice by the model's ':ice' look.
    water: stagnantMaterial(),
    // The lanterns: the lit pane (the night's light map) and the cold one.
    lamp: lanternPane(),
    lampOut: material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }),
  };
}

/** Multiply a geometry's vertex colour by rgb (linear) times k: a slab's own tone kept, tinted to a rock or a clay. */
export function colour(g, rgb, k = 1) {
  const c = g.attributes.color;
  if (!c) return tintGeometry(g, () => [rgb[0] * k, rgb[1] * k, rgb[2] * k]);
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * rgb[0] * k, c.getY(i) * rgb[1] * k, c.getZ(i) * rgb[2] * k);
  return g;
}

/** A box w x h x d with its foot at (x, y, z) and UVs in metres, a plain tone of `k`. */
export function bx(w, h, d, x, y, z, k = 1) {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return tintGeometry(boxUV(g), () => k);
}

/** A cut stone (masonry.js slab) of w x h x d with its foot at (x, y, z). */
export function stone(w, h, d, x, y, z, opts = {}) {
  return slab(w, h, d, opts).translate(x, y, z);
}

/** The tone of a bark-brown pole or log in the wood material (its own tone is the pale of cut timber). */
export const BARK_LIGHT = 0.72;

/** Segments round a log or post at a level of detail. */
export const seg = (lod, a = 10, b = 6, c = 4) => (lod === 0 ? a : lod === 1 ? b : c);

/** A cylinder from a to b ([x, y, z]), radius rA at a and rB at b; `open` leaves the ends bare. */
export function cyl(a, b, rA, rB, segments, open = false) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  // (CylinderGeometry's top is its first radius: rB at b, rA at a.)
  const g = new CylinderGeometry(rB, rA, len, segments, 1, open);
  g.translate(0, len / 2, 0);
  g.rotateX(Math.acos(Math.max(-1, Math.min(1, dy / len))));
  g.rotateY(Math.atan2(dx, dz));
  g.translate(a[0], a[1], a[2]);
  return g;
}

/** A round pole from a to b, radius r at its foot, a little crooked (a young tree trimmed): bark, darker at its foot. */
export function pole(a, b, r, lod, seed = 1) {
  const g = cyl(a, b, r, r * 0.85, seg(lod, 9, 6, 4), false);
  return tintGeometry(boxUV(g), (x, y) => BARK_LIGHT * (0.75 + 0.25 * Math.min(1, (y - Math.min(a[1], b[1])) / 0.4)) * (0.9 + 0.1 * Math.sin(seed * 3.1)));
}

/** A flat disc at `at` facing `dir`: the cut end of a log, in the wood's pale. */
export function disc(at, dir, r, segments, k = 1) {
  const g = new CircleGeometry(r, segments);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...dir).normalize());
  g.applyQuaternion(q);
  g.translate(at[0], at[1], at[2]);
  return tintGeometry(boxUV(g), () => k);
}

/**
 * A trunk or log from a to b, radius r (a little less at b): { bark, ends }
 * for the bark and the wood materials; the ends are discs just off the cut.
 */
export function trunk(a, b, r, lod, seed = 1) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len, (b[2] - a[2]) / len];
  const s = seg(lod, 12, 8, 5);
  const bark = tintGeometry(boxUV(cyl(a, b, r, r * 0.92, s, true)), () => BARK_LIGHT * (0.8 + 0.2 * Math.sin(seed * 5.3)));
  const ends = [];
  const e = 0.004;
  ends.push(disc([a[0] - u[0] * e, a[1] - u[1] * e, a[2] - u[2] * e], [-u[0], -u[1], -u[2]], r, s, 1.2));
  ends.push(disc([b[0] + u[0] * e, b[1] + u[1] * e, b[2] + u[2] * e], u, r * 0.92, s, 1.2));
  return { bark, ends };
}

/**
 * A rock lump of radius about r, faceted: an icosahedron pushed about by a
 * few waves of its seed, squashed by (sx, sy, sz), foot at y 0.
 */
export function lump(r, seed, { sx = 1, sy = 0.7, sz = 1, detail = 1 } = {}) {
  const g = new IcosahedronGeometry(1, detail);
  const rnd = artRng(seed);
  const a = rnd() * 6.28;
  const b = rnd() * 6.28;
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = r * (1 + 0.22 * Math.sin(3 * x + a) * Math.sin(3 * z + b) + 0.1 * Math.sin(5 * y + 2 * x + a));
    p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  g.computeVertexNormals();
  g.translate(0, r * sy * 0.78, 0);
  return tintGeometry(boxUV(g), (x, y) => 0.85 + 0.15 * Math.min(1, y / (r * sy)));
}

/** A spoil mound of radius R and height h, its outline wavering, on y = 0 at the origin. */
export function mound(R, h, seed, lod) {
  return revolve(profileOf([[0, 0], [R, 0], [R * 0.84, h * 0.3], [R * 0.55, h * 0.72], [R * 0.2, h * 0.95], [0, h]]), {
    segments: seg(lod, 16, 10, 6), metres: 0.8,
    deform: (p, th) => { const k = 1 + 0.1 * Math.sin(th * 3 + seed) + 0.06 * Math.sin(th * 5 + seed * 2); p.x *= k; p.z *= k; },
  });
}

/** A thatched gable roof over x0..x1 by z0..z1 from eaveY at the long walls to ridgeY, hanging `over` past them. Returns { thatch, wood }. */
export function thatchGable({ x0, x1, z0, z1, eaveY, ridgeY, over = 0.3, along = 'x', lod = 0, seed = 1 }) {
  // Built with its ridge along x (length L, span S about the origin), then turned if the ridge runs along z.
  const L = along === 'x' ? x1 - x0 : z1 - z0;
  const S = along === 'x' ? z1 - z0 : x1 - x0;
  const half = S / 2 + over;
  const rise = (ridgeY - eaveY) * (half / (S / 2));
  const ang = Math.atan2(rise, half);
  const len = Math.hypot(half, rise);
  const thatch = [];
  const wood = [];
  for (const s of [-1, 1]) {
    const g = new BoxGeometry(L + 0.5, 0.22, len, lod === 2 ? 1 : 3, 1, 1);
    // A ragged eave: the lower edge's thatch cut unevenly.
    const rnd = artRng(seed + s * 7);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getZ(i) * s > 0) p.setY(i, p.getY(i) - rnd() * 0.05);
    }
    g.computeVertexNormals();
    g.translate(0, 0.11, s * len / 2 * 1);
    // The slope runs down toward its own side: s * z positive end is the eave.
    g.rotateX(s * ang);
    g.translate(0, ridgeY - 0.12, 0);
    thatch.push(tintGeometry(boxUV(g), (x, y) => 0.88 + 0.12 * Math.sin(x * 1.7 + s)));
    // The rafters' underside seen from below: a plain board under the thatch.
    if (lod < 2) {
      const u = new BoxGeometry(L + 0.2, 0.04, len - 0.1);
      u.translate(0, -0.03, s * len / 2);
      u.rotateX(s * ang);
      u.translate(0, ridgeY - 0.12, 0);
      wood.push(tintGeometry(boxUV(u), () => 0.55));
    }
  }
  // The ridge: a roll of thatch bound down.
  const ridge = new CylinderGeometry(0.15, 0.17, L + 0.5, seg(lod, 8, 6, 4), 1);
  ridge.rotateZ(Math.PI / 2);
  ridge.translate(0, ridgeY + 0.02, 0);
  thatch.push(tintGeometry(boxUV(ridge), () => 0.78));
  const turn = (g) => {
    if (along === 'z') g.rotateY(-Math.PI / 2);
    return g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  };
  return { thatch: thatch.map(turn), wood: wood.map(turn) };
}

/**
 * A pile of squared blocks in layers on y = y0, laid by `layers`: each
 * [nx, nz] a layer's blocks in x and z, centred, smaller layers on larger.
 * Blocks are w x h x d with a gap; returns slabs (masonry.js), a layer a
 * course. At lod 2, one slab a layer.
 */
export function blockStack(cx, cz, y0, layers, { w, h, d, gap = 0.03, seed = 1, lod = 0, tone = 0.06, grime = 0.2, bevel = 0.02, shift = 0.04 } = {}) {
  const out = [];
  const rnd = artRng(seed);
  layers.forEach(([nx, nz], k) => {
    const y = y0 + k * (h + 0.004);
    // Every other course turned a little, as stones are stacked: offset half a block.
    const ox = k % 2 ? shift : -shift;
    if (lod === 2) {
      out.push(slab(nx * (w + gap) - gap, h, nz * (d + gap) - gap, { bevel: 0.015, seed: seed + k, wobble: 0.004, tone, grime }).translate(cx + ox, y, cz));
      return;
    }
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const g = slab(w, h, d, { bevel, seed: seed + k * 31 + i * 5 + j, wobble: 0.006, tone, grime });
        g.rotateY((rnd() - 0.5) * 0.06);
        out.push(g.translate(cx + ox + (i - (nx - 1) / 2) * (w + gap), y, cz + (j - (nz - 1) / 2) * (d + gap)));
      }
    }
  });
  return out;
}

/**
 * A yard's geometry gathered by material and state, built as TaggedParts
 * meshes (masonry.js; userData.when 'open' staffed, 'shut' not, else
 * always). `add(material, geos, when, cast)` names each mesh by its
 * material's key in yardMaterials(); a lantern is added with `lantern`.
 */
export class Yard {
  constructor(name, lod) {
    this.lod = lod;
    this.M = yardMaterials();
    this.p = new TaggedParts(name);
  }

  /** Add geometries (nested lists, nulls skipped) in material `key`, shown in `when`. */
  add(key, geos, when = 'always', cast = true) {
    if (!this.M[key]) throw new Error(`yard: no material ${key}`);
    this.p.add(key, this.M[key], geos, { when, cast });
    return this;
  }

  /** A lantern standing on (x, y, z): lit while staffed ('open'), cold otherwise ('shut'). Not at lod 2. */
  lantern(x, y, z) {
    if (this.lod >= 2) return this;
    const l = lantern(x, y, z, this.lod);
    this.add('bronze', l.bronze);
    this.p.add('lamp', this.M.lamp, [l.pane], { when: 'open', cast: false });
    this.p.add('lamp', this.M.lampOut, [l.pane.clone()], { when: 'shut', cast: false });
    return this;
  }

  /** The model: { group, meshes, triangles }. */
  build() {
    return this.p.build();
  }
}

/** A lamp's entry for models.js modelLamps: its glow at (x, y + 0.11, z), seen from either front or side (the tholos's way: one of the two shows at each view turn). */
export function lampPoints([x, y, z]) {
  return Object.freeze([Object.freeze([x, y + 0.11, z, 1]), Object.freeze([x, y + 0.11, z, -1])]);
}

/**
 * A bank of rock and earth as a heightfield: a grid over x0..x1 by z0..z1
 * (`nx` by `nz` cells) whose height at a point is `hAt(x, z)`, in flat
 * facets like the countryside's rocks (flora/rockModel.js). Each facet goes
 * to one of three meshes by its slope and place:
 *   cap    gentle ground (a normal's y over 0.5): grass and earth
 *   rock   steep ground: weathered stone
 *   fresh  what `freshAt(x, z, ny)` says: stone cut open lately
 * Facets lying on the ground (every corner within 2 cm of the street's
 * level) are left out, so the bank meets the yard without a seam. The
 * colour of each facet's corners is `tint(kind, x, y, z, ny)` (linear
 * [r, g, b]). Returns { cap, rock, fresh } as lists of geometries.
 */
export function bankField({ x0, x1, z0, z1, nx, nz, hAt, freshAt = null, tint }) {
  const pos = { cap: [], rock: [], fresh: [] };
  const col = { cap: [], rock: [], fresh: [] };
  const nor = { cap: [], rock: [], fresh: [] };
  const X = (i) => x0 + ((x1 - x0) * i) / nx;
  const Z = (j) => z0 + ((z1 - z0) * j) / nz;
  const H = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) H.push(hAt(X(i), Z(j)));
  const h = (i, j) => H[j * (nx + 1) + i];
  const tri = (a, b, c) => {
    if (Math.max(a[1], b[1], c[1]) < YARD.floorY + 0.02) return;
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let fx = uy * vz - uz * vy;
    let fy = uz * vx - ux * vz;
    let fz = ux * vy - uy * vx;
    const l = Math.hypot(fx, fy, fz) || 1;
    fx /= l;
    fy /= l;
    fz /= l;
    // (Wound the other way: keep the normal up, and the triangle's order with it.)
    if (fy < 0) { fx = -fx; fy = -fy; fz = -fz; [b, c] = [c, b]; }
    const cx = (a[0] + b[0] + c[0]) / 3;
    const cz = (a[2] + b[2] + c[2]) / 3;
    const kind = freshAt && freshAt(cx, cz, fy) ? 'fresh' : fy > 0.5 ? 'cap' : 'rock';
    for (const p of [a, b, c]) {
      pos[kind].push(p[0], p[1], p[2]);
      nor[kind].push(fx, fy, fz);
      const t = tint(kind, p[0], p[1], p[2], fy);
      col[kind].push(t[0], t[1], t[2]);
    }
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const p00 = [X(i), h(i, j), Z(j)];
      const p10 = [X(i + 1), h(i + 1, j), Z(j)];
      const p01 = [X(i), h(i, j + 1), Z(j + 1)];
      const p11 = [X(i + 1), h(i + 1, j + 1), Z(j + 1)];
      if ((i + j) % 2) { tri(p00, p01, p10); tri(p10, p01, p11); } else { tri(p00, p01, p11); tri(p00, p11, p10); }
    }
  }
  const out = { cap: [], rock: [], fresh: [] };
  for (const k of Object.keys(out)) {
    if (!pos[k].length) continue;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos[k], 3));
    g.setAttribute('normal', new Float32BufferAttribute(nor[k], 3));
    g.setAttribute('color', new Float32BufferAttribute(col[k], 3));
    boxUV(g);
    out[k].push(g);
  }
  return out;
}

/** A smooth 0 to 1 step of t between a and b. */
export function smooth01(a, b, t) {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
}
