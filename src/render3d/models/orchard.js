/**
 * models/orchard.js
 * ----------------------------------------------------------------------------
 * The trees and vines of the 3D farms (farm.js stands them where the 3D
 * ground hoes round them: ground/groundMaterial.js), grown from a seeded
 * skeleton rather than drawn:
 *
 *   apple   (malus) a low, round, spreading crown on three or four scaffold
 *           limbs, as an orchard tree is pruned to be picked from a ladder;
 *           pink-white blossom in spring, red apples late in the year
 *   pear    (pirus) taller and more upright, a narrower crown, glossy dark
 *           leaves, pure white blossom, yellow-green pears
 *   fig     (ficus) low and broad, several smooth grey stems from the
 *           ground, big lobed leaves, purple figs; it leafs late
 *   olive   (olea) the old gnarled trunk, swollen at the foot and split
 *           into twisting stems, an open crown of narrow leaves dark grey-
 *           green above and silver below, evergreen; small olives green,
 *           then black (the trees are older than the farm: they stand full
 *           grown from the first day, as a bought farm's would)
 *
 *   a row of vines trained as Columella describes the vinea jugata: a stake
 *   (palus) at each vine, a pole (jugum) lashed along the stakes at about a
 *   man's chest, the vine's twisted stock up its stake and its canes along
 *   the pole, the leaves a hedge along it, the bunches hanging under it.
 *
 * Looks by the time of year (`look`): 'bare' (winter: the fruit trees and
 * the vines stand bare; the olive keeps its leaves), 'blossom' (spring:
 * apple and pear in flower, the fig and the vine in young leaf), 'leaf'
 * (summer), 'autumn' (yellow, orange and red, thinning). `fruit` 0 none,
 * 1 growing (small and green), 2 ripe.
 *
 * Leaves are small cards in clusters (each a little group of leaves),
 * two-sided by a second face rather than a double-sided material (one
 * program for all), shaded as a volume: each card's normal points out of
 * the crown, so a crown is lit as a whole and darker inside, as foliage is.
 *
 * Metres, the tree's foot at the origin, y up; a vine row along x, centred.
 * ----------------------------------------------------------------------------
 */

import {
  Group, Mesh, BufferGeometry, Float32BufferAttribute, CatmullRomCurve3, Vector3, IcosahedronGeometry, OctahedronGeometry,
} from 'three';
import { merge, tintGeometry, triangles, wrapLength } from '../shapes.js';
import { artRng, smoothstep } from '../texgen.js';
import { ruralMaterials, lin, mixc, paint, beam, blk } from './rural.js';

/** The kinds of tree and how each grows (metres). */
export const TREES = Object.freeze({
  apple: { trunkH: 1.0, trunkR: 0.11, scaffolds: 4, spread: 0.95, limb: 1.25, crownR: 1.15, crownY: 2.05, leafSize: 0.2, leaves: 520, fruitR: 0.048, fruitN: 34, stems: 1 },
  pear: { trunkH: 1.25, trunkR: 0.11, scaffolds: 4, spread: 0.55, limb: 1.45, crownR: 0.95, crownY: 2.55, leafSize: 0.19, leaves: 520, fruitR: 0.042, fruitN: 30, stems: 1, tall: 1.35 },
  fig: { trunkH: 0.45, trunkR: 0.09, scaffolds: 5, spread: 1.05, limb: 1.35, crownR: 1.2, crownY: 1.75, leafSize: 0.3, leaves: 300, fruitR: 0.04, fruitN: 26, stems: 3 },
  olive: { trunkH: 1.05, trunkR: 0.2, scaffolds: 3, spread: 0.8, limb: 1.3, crownR: 1.2, crownY: 2.25, leafSize: 0.16, leaves: 500, fruitR: 0.026, fruitN: 48, stems: 2, gnarled: true },
});

/** The colours (sRGB) of each tree's leaves by look, blossom, fruit growing and ripe. */
const COLOURS = {
  apple: { leaf: [0x4f7d33, 0x5e8a3a, 0x46702e], autumn: [0xc8932e, 0xb9652b, 0xd6b04a, 0x8f8a3a], blossom: [0xf4e9ec, 0xf0d2dc, 0xe6a9bf], young: 0x95b84e, fruit: [0x9fb24a, 0xb8322a, 0xc9542c, 0xa62a24] },
  pear: { leaf: [0x3c6a2c, 0x467a33, 0x355f27], autumn: [0xa8402a, 0xc96a2e, 0xd2a648, 0x7a3a24], blossom: [0xf6f4ec, 0xefeee4, 0xe8e6da], young: 0x8fb04a, fruit: [0x8fa848, 0xc9b84a, 0xb9a43c, 0xd0be5a] },
  fig: { leaf: [0x5a8a3c, 0x67953f, 0x4f7e36], autumn: [0xc9b245, 0xb59a3a, 0x9a8f3a], blossom: [0x9cc055, 0x8fb84e], young: 0x9cc055, fruit: [0x7f9a4a, 0x4b2a44, 0x5a3050, 0x3e2238] },
  olive: { leaf: [0x56653f, 0x66724b, 0x4c5a39], under: [0xa4ab92, 0x97a088], autumn: [0x56653f, 0x66724b], blossom: [0x56653f, 0x66724b], young: 0x6f7e52, fruit: [0x6f8a3a, 0x2b2030, 0x3a2838, 0x4a3a2c] },
};

const V = (a) => new Vector3(a[0], a[1], a[2]);

/**
 * A branch: a tube along a smooth curve through `pts`, its radius tapering
 * from r0 to r1, `bump(t, a)` a relative change of radius (an olive's
 * gnarled stock); UVs in metres along it, a whole number of bark repeats
 * round it.
 */
export function limb(pts, r0, r1, { radial = 7, segs = 0, bump = null, twist = 0 } = {}) {
  const curve = new CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : V(p))), false, 'catmullrom', 0.5);
  const len = curve.getLength();
  const n = segs || Math.max(2, Math.ceil(len / 0.25));
  const frames = curve.computeFrenetFrames(n, false);
  const around = wrapLength(2 * Math.PI * r0, 0.8);
  const pos = [];
  const nor = [];
  const uv = [];
  const P = new Vector3();
  const d = new Vector3();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    curve.getPointAt(t, P);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = r0 + (r1 - r0) * Math.pow(t, 0.85);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2 + twist * t;
      d.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      const rr = r * (1 + (bump ? bump(t, a) : 0));
      pos.push(P.x + d.x * rr, P.y + d.y * rr, P.z + d.z * rr);
      nor.push(d.x, d.y, d.z);
      uv.push((j / radial) * around, t * len);
    }
  }
  const idx = [];
  const W = radial + 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * W + j;
      idx.push(a, a + 1, a + W, a + 1, a + W + 1, a + W);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return tintGeometry(g, (x, y) => 0.7 + 0.3 * smoothstep(0, 0.6, y));
}

/**
 * Leaf cards as one geometry, two-sided by a second face: `cards` is a
 * list of { p: [x, y, z], n: [nx, ny, nz] (the crown's normal there), s
 * (size), c: [r, g, b] (linear), a (turn), tilt }. Each card is a leaf-
 * shaped diamond folded along its midrib.
 */
export function leafCards(cards, { long = 1.6 } = {}) {
  const pos = [];
  const nor = [];
  const col = [];
  const uv = [];
  const idx = [];
  const ux = new Vector3();
  const uy = new Vector3();
  const nn = new Vector3();
  const up = new Vector3(0, 1, 0);
  for (const cd of cards) {
    nn.set(cd.n[0], cd.n[1], cd.n[2]).normalize();
    // The card's own plane: a random direction across it, turned by `a`, tilted toward the normal.
    ux.set(Math.cos(cd.a), (cd.tilt || 0), Math.sin(cd.a)).normalize();
    uy.crossVectors(ux, up).normalize();
    if (uy.lengthSq() < 1e-6) uy.set(0, 0, 1);
    uy.lerp(nn, 0.35).normalize();
    const s = cd.s;
    const [px, py, pz] = cd.p;
    // Tip, two sides, stalk; the sides a little raised (the fold).
    const pts = [
      [px + ux.x * s * long * 0.5, py + ux.y * s * long * 0.5, pz + ux.z * s * long * 0.5],
      [px + uy.x * s * 0.5 + nn.x * s * 0.08, py + uy.y * s * 0.5 + nn.y * s * 0.08, pz + uy.z * s * 0.5 + nn.z * s * 0.08],
      [px - ux.x * s * long * 0.5, py - ux.y * s * long * 0.5, pz - ux.z * s * long * 0.5],
      [px - uy.x * s * 0.5 + nn.x * s * 0.08, py - uy.y * s * 0.5 + nn.y * s * 0.08, pz - uy.z * s * 0.5 + nn.z * s * 0.08],
    ];
    for (let side = 0; side < 2; side++) {
      const base = pos.length / 3;
      for (let k = 0; k < 4; k++) {
        pos.push(...pts[k]);
        nor.push(nn.x, nn.y, nn.z);
        // Each face a slightly different shade: the leaves' two sides (an olive's silver under it).
        const c = side ? cd.c2 || cd.c : cd.c;
        const tip = k === 0 ? 1.06 : k === 2 ? 0.9 : 1;
        col.push(c[0] * tip, c[1] * tip, c[2] * tip);
        uv.push(k === 1 ? 1 : k === 3 ? 0 : 0.5, k === 0 ? 1 : k === 2 ? 0 : 0.5);
      }
      if (side === 0) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * Small round things (fruit, olives, grapes) as one geometry of low-poly
 * balls: `items` [{ p, r, c, sy }] (sy stretches it: a pear).
 */
export function balls(items, detail = 0) {
  if (!items.length) return null;
  // (detail -1: an octahedron of 8 triangles, for berries and olives a few pixels across.)
  const proto = detail < 0 ? new OctahedronGeometry(1, 0) : new IcosahedronGeometry(1, detail);
  const pp = proto.attributes.position;
  const pos = [];
  const nor = [];
  const col = [];
  const uv = [];
  const idx = [];
  for (const it of items) {
    const base = pos.length / 3;
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i);
      const y = pp.getY(i);
      const z = pp.getZ(i);
      const sy = it.sy || 1;
      // A pear's neck: narrower at the top.
      const k = sy > 1 ? 1 - 0.3 * smoothstep(-0.2, 1, y) : 1;
      pos.push(it.p[0] + x * it.r * k, it.p[1] + y * it.r * sy, it.p[2] + z * it.r * k);
      nor.push(x, y, z);
      const sh = 0.78 + 0.22 * (y * 0.5 + 0.5);
      col.push(it.c[0] * sh, it.c[1] * sh, it.c[2] * sh);
      uv.push(x * 0.5 + 0.5, y * 0.5 + 0.5);
    }
    for (let i = 0; i < pp.count; i++) idx.push(base + i);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  proto.dispose();
  return g;
}

/**
 * How far a crown may reach from its trunk (metres): an orchard's trees are
 * 2.5 m apart across the rows and stand 1.8 m in from the farm's edge, so
 * a crown pruned to this stays in its own farm.
 */
export const CROWN_REACH = 1.65;

/** Pull a point (x, y, z) in to `max` metres from the trunk's axis, keeping its height. */
function reach(p, max) {
  const d = Math.hypot(p[0], p[2]);
  if (d > max) {
    p[0] *= max / d;
    p[2] *= max / d;
  }
  return p;
}

/** The skeleton of a tree: its limbs (as point lists and radii) and the clusters where its leaves grow. */
function skeleton(sp, rnd) {
  const limbs = [];
  const clusters = [];
  const tall = sp.tall || 1;
  const top = [0, sp.trunkH, 0];
  // Several stems (a fig's, an olive's split stock) or one trunk.
  const stems = [];
  for (let s = 0; s < sp.stems; s++) {
    const a = (s / sp.stems) * Math.PI * 2 + rnd() * 0.8;
    const lean = sp.stems > 1 ? 0.18 + rnd() * 0.12 : 0.04 + rnd() * 0.05;
    const h = sp.trunkH * (0.85 + rnd() * 0.3);
    const tip = [Math.cos(a) * lean * h * 1.4, h, Math.sin(a) * lean * h * 1.4];
    const mid = [tip[0] * 0.45 + (rnd() - 0.5) * 0.08, h * 0.5, tip[2] * 0.45 + (rnd() - 0.5) * 0.08];
    stems.push({ pts: [[0, 0, 0], mid, tip], r0: sp.trunkR * (sp.stems > 1 ? 0.75 : 1), r1: sp.trunkR * 0.7, a });
  }
  for (const st of stems) limbs.push({ ...st, level: 0 });
  // Scaffold limbs from the stems' tops, spread round, each with side branches and a cluster at every end.
  const n = sp.scaffolds;
  for (let i = 0; i < n; i++) {
    const st = stems[i % stems.length];
    const from = st.pts[2];
    const az = (i / n) * Math.PI * 2 + rnd() * 0.6;
    const el = sp.spread * (0.8 + rnd() * 0.4); // from upright
    const L = sp.limb * (0.8 + rnd() * 0.35);
    const dir = [Math.sin(el) * Math.cos(az), Math.cos(el) * tall, Math.sin(el) * Math.sin(az)];
    const end = reach([from[0] + dir[0] * L, from[1] + dir[1] * L, from[2] + dir[2] * L], CROWN_REACH - 0.45);
    // Limbs bow upward toward the light at their ends.
    const mid = [from[0] + dir[0] * L * 0.5, from[1] + dir[1] * L * 0.45 + 0.05, from[2] + dir[2] * L * 0.5];
    limbs.push({ pts: [from, mid, end], r0: sp.trunkR * 0.62, r1: sp.trunkR * 0.18, level: 1 });
    clusters.push({ p: end, r: 0.42 + rnd() * 0.1 });
    for (const t of [0.45, 0.75]) {
      const b = [from[0] + (end[0] - from[0]) * t, from[1] + (end[1] - from[1]) * t, from[2] + (end[2] - from[2]) * t];
      const az2 = az + (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.5);
      const L2 = L * (0.45 + rnd() * 0.2);
      const e2 = reach([b[0] + Math.cos(az2) * L2 * 0.8, b[1] + L2 * (0.45 + rnd() * 0.3) * tall, b[2] + Math.sin(az2) * L2 * 0.8], CROWN_REACH - 0.4);
      limbs.push({ pts: [b, [(b[0] + e2[0]) / 2, (b[1] + e2[1]) / 2 + 0.04, (b[2] + e2[2]) / 2], e2], r0: sp.trunkR * 0.3, r1: sp.trunkR * 0.1, level: 2 });
      clusters.push({ p: e2, r: 0.34 + rnd() * 0.1 });
    }
  }
  // A cluster over the middle fills the crown's top.
  clusters.push({ p: [0, sp.crownY + sp.crownR * 0.25, 0], r: sp.crownR * 0.45 });
  return { limbs, clusters, top };
}

/**
 * Build a tree. Returns { group, meshes, triangles }: bark, leaves and
 * fruit, one mesh each (the farm's kit merges each with its kind across
 * the trees of a look).
 */
export function buildTree({ species = 'apple', look = 'leaf', fruit = 0, lod = 0, seed = 1 } = {}) {
  const sp = TREES[species];
  const cols = COLOURS[species];
  const rnd = artRng(seed * 7919 + species.length);
  const m = ruralMaterials();
  const group = new Group();
  group.name = `tree-${species}`;
  const meshes = [];
  const add = (g, mat, name) => {
    if (!g) return;
    const mesh = new Mesh(g, mat);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    meshes.push(mesh);
  };
  const sk = skeleton(sp, rnd);
  const evergreen = species === 'olive';
  const bare = look === 'bare' && !evergreen;
  // The stock and limbs.
  const wood = [];
  const radial = lod === 0 ? 8 : lod === 1 ? 5 : 4;
  for (const l of sk.limbs) {
    if (lod === 2 && l.level > 1) continue;
    if (lod === 1 && l.level > 2) continue;
    let bump = null;
    if (sp.gnarled && l.level === 0) {
      // An old olive: swollen at the foot, ridged and twisted all the way up.
      const ph = rnd() * 6.28;
      bump = (t, a) => 0.55 * (1 - smoothstep(0, 0.3, t)) + 0.22 * Math.sin(a * 3 + ph + t * 5) + 0.1 * Math.sin(a * 7 + t * 11);
    }
    wood.push(limb(l.pts, l.r0, l.r1, { radial: l.level ? Math.max(4, radial - 2) : radial, segs: lod === 2 ? 2 : 0, bump, twist: sp.gnarled ? 1.4 : 0 }));
  }
  // Bare trees show their twigs: the crown's outline in winter.
  if (bare && lod < 2) {
    for (const c of sk.clusters) {
      const n = lod === 0 ? 6 : 3;
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2;
        const L = c.r * (0.7 + rnd() * 0.6);
        const e = [c.p[0] + Math.cos(a) * L * 0.8, c.p[1] + L * (0.3 + rnd() * 0.5), c.p[2] + Math.sin(a) * L * 0.8];
        wood.push(limb([c.p, [(c.p[0] + e[0]) / 2, (c.p[1] + e[1]) / 2 + 0.03, (c.p[2] + e[2]) / 2], e], 0.018, 0.006, { radial: 3, segs: 2 }));
      }
    }
  }
  add(merge(wood), m.bark, 'bark');
  if (bare) return finish();
  // The leaves (or the blossom): cards in each cluster, shaded as one crown.
  const centre = [0, sp.crownY, 0];
  const R = sp.crownR;
  const scale = lod === 0 ? 1 : lod === 1 ? 2.5 : 0;
  if (lod === 2) {
    // Far out: the crown as a few lumps, coloured as the leaves would be.
    const parts = [];
    const base = look === 'autumn' ? cols.autumn : look === 'blossom' ? cols.blossom : cols.leaf;
    // (The scaffolds' ends and the top: four or five lumps of 20 triangles.)
    for (const c of sk.clusters.filter((_, i, a) => i % 3 === 0 || i === a.length - 1)) {
      const r = c.r * 1.6;
      const g = new IcosahedronGeometry(r, 0);
      const at = reach([...c.p], CROWN_REACH - r);
      g.translate(at[0], at[1], at[2]);
      const col = lin(base[Math.floor(rnd() * base.length)]);
      parts.push(paint(g, col, (x, y, z) => 0.55 + 0.45 * smoothstep(centre[1] - R, centre[1] + R, y)));
    }
    add(merge(parts), m.leaf, 'leaves');
    return finish();
  }
  const cards = [];
  const long = species === 'olive' ? 2.4 : species === 'fig' ? 1.1 : 1.6;
  // (A card reaches this far past its middle: kept inside the crown's reach.)
  const margin = sp.leafSize * scale * 1.25 * long * 0.5;
  const total = Math.round(sp.leaves * (look === 'autumn' && !evergreen ? 0.7 : look === 'blossom' && species !== 'fig' && !evergreen ? 0.85 : 1) / (scale * scale));
  const per = Math.max(3, Math.round(total / sk.clusters.length));
  const pick = (list) => lin(list[Math.floor(rnd() * list.length)]);
  for (const c of sk.clusters) {
    for (let k = 0; k < per; k++) {
      // Spread through the cluster, more of them near its surface.
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const rr = c.r * (0.45 + 0.55 * Math.cbrt(rnd()));
      const s2 = Math.sqrt(1 - u * u);
      const p = reach([c.p[0] + Math.cos(th) * s2 * rr, c.p[1] + u * rr * 0.8, c.p[2] + Math.sin(th) * s2 * rr], CROWN_REACH - margin);
      const n = [p[0] - centre[0], (p[1] - centre[1]) * 0.8 + 0.4 * R, p[2] - centre[2]];
      const dist = Math.hypot(p[0] - centre[0], (p[1] - centre[1]) * 1.2, p[2] - centre[2]) / R;
      // Inside the crown it is darker (the leaves shade each other); the top catches the sky.
      const shade = (0.5 + 0.5 * smoothstep(0.2, 1.0, dist)) * (0.9 + 0.2 * smoothstep(centre[1] - R, centre[1] + R, p[1]));
      let c1;
      let c2 = null;
      if (look === 'blossom' && species !== 'fig' && !evergreen) c1 = rnd() < 0.7 ? pick(cols.blossom) : lin(cols.young);
      else if (look === 'blossom') c1 = lin(cols.young);
      else if (look === 'autumn' && !evergreen) c1 = pick(cols.autumn);
      else c1 = pick(cols.leaf);
      if (evergreen) c2 = pick(cols.under);
      const sz = sp.leafSize * scale * (0.75 + rnd() * 0.5) * (look === 'blossom' && species !== 'fig' ? 0.8 : 1);
      cards.push({ p, n, s: sz, a: rnd() * Math.PI * 2, tilt: (rnd() - 0.5) * 1.2, c: c1.map((v) => v * shade), c2: c2 ? c2.map((v) => v * shade) : null });
    }
  }
  add(leafCards(cards, { long }), m.leaf, 'leaves');
  // Fruit, hanging at the crown's surface.
  if (fruit > 0 && look !== 'blossom') {
    const n = Math.round(sp.fruitN * (lod === 0 ? 1 : 0.5) * (fruit === 1 ? 0.8 : 1));
    const items = [];
    const fc = cols.fruit;
    for (let k = 0; k < n; k++) {
      const c = sk.clusters[Math.floor(rnd() * sk.clusters.length)];
      const u = rnd() * 1.4 - 0.9; // more of them low in the cluster
      const th = rnd() * Math.PI * 2;
      const s2 = Math.sqrt(Math.max(0, 1 - u * u));
      const rr = c.r * (0.8 + rnd() * 0.25);
      const p = reach([c.p[0] + Math.cos(th) * s2 * rr, c.p[1] + u * rr - 0.04, c.p[2] + Math.sin(th) * s2 * rr], CROWN_REACH - 0.05);
      const ripe = fruit === 2;
      const col = ripe ? lin(fc[1 + Math.floor(rnd() * 3)]) : mixc(lin(fc[0]), lin(fc[1]), rnd() * 0.25);
      const r = sp.fruitR * (ripe ? 1 : 0.75) * (lod === 0 ? 1 : 1.3);
      items.push({ p, r, c: col, sy: species === 'pear' ? 1.45 : species === 'fig' ? 1.2 : 1 });
    }
    add(balls(items, species === 'olive' ? -1 : 0), m.produce, 'fruit');
  }
  return finish();

  function finish() {
    let tris = 0;
    for (const mesh of meshes) tris += triangles(mesh.geometry);
    return { group, meshes, triangles: tris };
  }
}

/** The stakes along a vine row: every STAKE m. */
export const VINE = Object.freeze({ stake: 1.3, poleY: 1.15, stakeH: 1.55 });

/**
 * A row of vines on stakes and a pole (vinea jugata), `L` long along x,
 * centred. Returns { group, meshes, triangles }.
 */
export function buildVineRow({ L = 7.6, look = 'leaf', fruit = 0, lod = 0, seed = 1 } = {}) {
  const rnd = artRng(seed * 104729);
  const m = ruralMaterials();
  const group = new Group();
  group.name = 'vine-row';
  const meshes = [];
  const add = (g, mat, name) => {
    if (!g) return;
    const mesh = new Mesh(g, mat);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    meshes.push(mesh);
  };
  const n = Math.max(2, Math.round(L / VINE.stake));
  const xs = Array.from({ length: n + 1 }, (_, k) => -L / 2 + (k * L) / n);
  const wood = [];
  const bark = [];
  const Y = VINE.poleY;
  for (const [k, x] of xs.entries()) {
    const s = blk(lod, 0.055, VINE.stakeH, 0.055, { bevel: 0.008, seed: seed * 31 + k, wobble: 0.004, grime: 0.4, seg: 1 });
    s.rotateZ((rnd() - 0.5) * 0.06);
    s.translate(x, 0, 0);
    wood.push(s);
  }
  // The pole lashed along the stakes.
  wood.push(beam([-L / 2 - 0.05, Y, 0.04], [L / 2 + 0.05, Y + (rnd() - 0.5) * 0.04, 0.04], lod === 2 ? 0.05 : 0.045, seed + 3, lod));
  // The vines' stocks: one beside each stake but the last, twisting up to the pole; the canes along it.
  if (lod < 2) {
    for (const [k, x] of xs.entries()) {
      if (k === xs.length - 1) continue;
      const vx = x + 0.12;
      const ph = rnd() * 6.28;
      bark.push(limb([[vx, 0, -0.05], [vx + 0.06 * Math.sin(ph), 0.45, -0.07], [vx - 0.04, 0.85, -0.03], [vx + 0.05, Y - 0.04, 0.0]], 0.035, 0.022, { radial: lod ? 4 : 6, bump: (t, a) => 0.15 * Math.sin(a * 3 + t * 9 + ph) }));
      // The canes: one each way along the pole (winter's pruned spurs are short).
      const cl = look === 'bare' ? 0.25 : L / n * 0.55;
      for (const dir of [-1, 1]) {
        bark.push(limb([[vx + 0.05, Y - 0.02, 0], [vx + 0.05 + dir * cl * 0.5, Y + 0.05, 0.03 * dir], [vx + 0.05 + dir * cl, Y + 0.02, 0.0]], 0.014, 0.008, { radial: 3, segs: 3 }));
      }
    }
  }
  add(merge(wood), m.wood, 'stakes');
  if (bark.length) add(merge(bark), m.bark, 'stocks');
  if (look === 'bare') return finish();
  // The leaves: a hedge along the pole, thin in spring, thinning in autumn.
  const cols = look === 'autumn' ? [0xc9a23a, 0xb8542c, 0x9a3a2c, 0x8d8a38] : look === 'blossom' ? [0x9cc456, 0x8cb84c] : [0x4f8236, 0x5c8f3c, 0x467432];
  const dens = look === 'blossom' ? 0.35 : look === 'autumn' ? 0.75 : 1;
  if (lod === 2) {
    const g = blk(1, L, 0.5 * dens + 0.15, 0.55, { seed, grime: 0 });
    g.translate(0, Y - 0.1, 0);
    add(paint(g, lin(cols[0]), (x, y) => 0.6 + 0.4 * smoothstep(Y - 0.1, Y + 0.5, y)), m.leaf, 'leaves');
    return finish();
  }
  const scale = lod === 0 ? 1 : 2;
  const count = Math.round((L * 46 * dens) / (scale * scale));
  const cards = [];
  for (let k = 0; k < count; k++) {
    const x = -L / 2 + rnd() * L;
    const y = Y - 0.25 + Math.pow(rnd(), 0.8) * (0.75 * dens + 0.15);
    const z = (rnd() - 0.5) * 0.7 * (0.6 + 0.4 * smoothstep(Y - 0.3, Y + 0.3, y));
    const shade = 0.55 + 0.45 * smoothstep(0, 0.32, Math.abs(z)) * (0.8 + 0.2 * smoothstep(Y, Y + 0.6, y));
    const c = lin(cols[Math.floor(rnd() * cols.length)]).map((v) => v * shade);
    cards.push({ p: [x, y, z], n: [0, 0.6 + (y - Y) * 0.8, z * 2.2], s: 0.19 * scale * (0.8 + rnd() * 0.4), a: rnd() * 6.28, tilt: (rnd() - 0.5) * 1.4, c });
  }
  add(leafCards(cards, { long: 1.05 }), m.leaf, 'leaves');
  // The bunches, hanging under the pole on both sides of the row.
  if (fruit > 0 && look !== 'blossom') {
    const items = [];
    const nb = Math.round(L / (lod === 0 ? 0.42 : 0.7));
    for (let b = 0; b < nb; b++) {
      const bx = -L / 2 + (b + 0.5) * (L / nb) + (rnd() - 0.5) * 0.15;
      const bz = (rnd() < 0.5 ? -1 : 1) * (0.2 + rnd() * 0.12);
      const ripe = fruit === 2;
      const purple = rnd() < 0.8;
      const base = ripe ? (purple ? lin(0x3c2147) : lin(0xb7b45a)) : lin(0x8fa64a);
      const len = (ripe ? 0.2 : 0.14) * (lod === 0 ? 1 : 1.25);
      const per = lod === 0 ? 8 : 2;
      for (let g = 0; g < per; g++) {
        const t = g / per;
        const rr = (1 - t) * len * 0.32;
        const a = rnd() * 6.28;
        items.push({ p: [bx + Math.cos(a) * rr, Y - 0.12 - t * len, bz + Math.sin(a) * rr], r: (lod === 0 ? 0.03 : 0.05) * (ripe ? 1 : 0.8), c: base.map((v) => v * (0.8 + rnd() * 0.3)) });
      }
    }
    add(balls(items, -1), m.produce, 'grapes');
  }
  return finish();

  function finish() {
    let tris = 0;
    for (const mesh of meshes) tris += triangles(mesh.geometry);
    return { group, meshes, triangles: tris };
  }
}

/** The tree look for a month (0 = Ianuarius), or null for the seasons off: summer's. */
export function treeLookOf(month) {
  if (month === null || month === undefined) return 'leaf';
  const m = ((Math.round(month) % 12) + 12) % 12;
  if (m === 11 || m <= 1) return 'bare';
  if (m <= 3) return 'blossom';
  if (m <= 8) return 'leaf';
  return 'autumn';
}

