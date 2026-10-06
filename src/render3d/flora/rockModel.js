/**
 * flora/rockModel.js
 * ----------------------------------------------------------------------------
 * The rocks of the 3D countryside (species.js ROCKS), in metres, their foot
 * sunk into the ground (never floating: what is under y = 0 is clipped in
 * the game, hidden by the ground in the lab):
 *
 *   outcrop  limestone breaking through the ground in its beds: two to four
 *            courses of blocks, each stepped back from the one under it,
 *            parted by vertical joints, their edges rounded by the weather
 *   boulder  a block broken off a bed: flat faces where it split (cut by a
 *            few planes), its edges worn round
 *   scree    stones fallen from the rock, angular, in a spread at its foot
 *   lava     a dark volcanic boulder (tuff, trachyte, basalt): rounded,
 *            pitted, never bedded
 *
 * Their vertex colours carry the contact shading (darker toward the foot,
 * where the soil and the shadow meet the stone), moss low on the side away
 * from the sun and on ledges, and each stone's own tone; the lichens and
 * the stone's grain are the `crag` texture's (surfacesFlora.js). Levels of
 * detail: 0 the full shape; 1 a third of the faces; 2 the far zooms', a
 * few dozen faces a stone.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { merge, triangles } from '../shapes.js';
import { artRng, smoothstep } from '../texgen.js';
import { lin } from '../models/rural.js';
import { rockMaterial } from './floraMaterials.js';

/** A smooth 3D value noise from a seed (for the stones' shapes on the CPU). */
function noise3(seed) {
  const h = (x, y, z) => {
    let n = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x1b873593) ^ Math.imul(seed | 0, 0x9e3779b1);
    n = Math.imul(n ^ (n >>> 15), 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  return (x, y, z) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const fx = x - xi;
    const fy = y - yi;
    const fz = z - zi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const w = fz * fz * (3 - 2 * fz);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
      w,
    );
  };
}

/**
 * A stone from a ball: `detail` of its icosahedron, stretched to (sx, sy,
 * sz), cut flat by `cuts` planes (where it split from its bed), its edges
 * rounded and its faces made uneven by noise, the bottom flattened and
 * sunk `sink` of its height. Returns an indexed geometry, normals smooth.
 */
function stone({ detail, sx, sy, sz, cuts = 0, rough = 0.08, round = 0.25, sink = 0.2, seed = 1 }) {
  const rnd = artRng(seed);
  const n1 = noise3(seed * 13 + 1);
  const n2 = noise3(seed * 13 + 2);
  let g = new IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const planes = [];
  for (let i = 0; i < cuts; i++) {
    // Mostly the sides and the top: a block's split faces.
    const a = rnd() * Math.PI * 2;
    const e = (rnd() - 0.3) * 1.1;
    const nrm = new Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).normalize();
    planes.push({ n: nrm, d: 0.55 + rnd() * 0.3 });
  }
  const pos = g.attributes.position;
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    // Cut: pull what is past a plane back onto it, softly (a worn edge, not a knife's).
    for (const pl of planes) {
      const over = p.dot(pl.n) - pl.d;
      if (over > -round) {
        const k = over > 0 ? over + round * 0.5 : ((over + round) * (over + round)) / (2 * round);
        p.addScaledVector(pl.n, -k * 0.9);
      }
    }
    // Uneven faces: two scales of noise along the ball's own direction.
    const r = 1 + rough * ((n1(p.x * 1.6 + 5, p.y * 1.6, p.z * 1.6) - 0.5) * 1.6 + (n2(p.x * 4.2, p.y * 4.2 + 3, p.z * 4.2) - 0.5) * 0.6);
    p.multiplyScalar(r);
    p.set(p.x * sx, p.y * sy, p.z * sz);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  // The bottom: flat where it sits, sunk into the soil.
  g.computeBoundingBox();
  const minY = g.boundingBox.min.y;
  const H = g.boundingBox.max.y - minY;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) - minY - sink * H;
    if (y < -0.04) y = -0.04 - (y + 0.04) * 0.15;
    pos.setY(i, y);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Colour, then UVs: contact shade toward the foot, moss on what faces up
 * and away from the sun low down, the stone's tone; UVs in metres projected
 * per face by its own normal (on the stone's faces as cut: a seam between
 * two projections falls between faces), shifted per stone.
 */
function finish(g, { tone = 1, moss = 0.5, seed = 1, base = [1, 1, 1] }) {
  const rnd = artRng(seed * 31 + 7);
  const n = noise3(seed * 5 + 3);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const mossC = lin(0x6f7c48, 1.4);
  g.computeBoundingBox();
  const H = Math.max(0.2, g.boundingBox.max.y);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = nor.getY(i);
    // Darker toward the ground (soil, splash, the shadow under an overhang).
    const contact = 0.5 + 0.5 * smoothstep(-0.02, Math.min(0.5, H * 0.45), y);
    const under = ny < -0.2 ? 0.75 : 1;
    // Moss on ledges and low on the shaded side (+z+x is the side away from the game's sun).
    const shade = smoothstep(-0.2, 0.8, (nor.getX(i) + nor.getZ(i)) * 0.7);
    const m = moss * smoothstep(0.45, 0.7, n(x * 1.3, y * 1.3, z * 1.3)) * Math.max(smoothstep(0.55, 0.95, ny) * 0.8, shade * (1 - smoothstep(0, H * 0.7, y)));
    const t = tone * (0.92 + n(x * 0.6 + 9, y * 0.6, z * 0.6) * 0.16) * contact * under;
    for (let c = 0; c < 3; c++) col[i * 3 + c] = (base[c] * (1 - m) + mossC[c] * m) * t;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  const flat = g.toNonIndexed();
  const fp = flat.attributes.position;
  const uv = new Float32Array(fp.count * 2);
  const ou = rnd() * 3;
  const ov = rnd() * 3;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let i = 0; i < fp.count; i += 3) {
    a.fromBufferAttribute(fp, i);
    b.fromBufferAttribute(fp, i + 1);
    c.fromBufferAttribute(fp, i + 2);
    const fn = b.clone().sub(a).cross(c.clone().sub(a));
    const ax = Math.abs(fn.x);
    const ay = Math.abs(fn.y);
    const az = Math.abs(fn.z);
    for (let k = 0; k < 3; k++) {
      const x = fp.getX(i + k);
      const y = fp.getY(i + k);
      const z = fp.getZ(i + k);
      let u;
      let v;
      // (v up the rock's sides: the texture's runnels run down its faces.)
      if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
      uv[(i + k) * 2] = u + ou;
      uv[(i + k) * 2 + 1] = v + ov;
    }
  }
  flat.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return flat;
}

/** Ball detail by level of detail for a stone of `size` metres. */
const detailOf = (lod, size) => (lod === 0 ? (size > 1 ? 4 : size > 0.4 ? 3 : 1) : lod === 1 ? (size > 1 ? 2 : 1) : size > 1 ? 1 : 0);

/** A bedded limestone outcrop: courses of jointed blocks, each stepped back. */
function outcrop(rnd, seed, lod) {
  const parts = [];
  const beds = 2 + Math.floor(rnd() * 2);
  let w = 3.0 + rnd() * 0.6;
  let d = 2.6 + rnd() * 0.5;
  let y = -0.25;
  let cx = 0;
  let cz = 0;
  const dip = (rnd() - 0.5) * 0.18;
  for (let b = 0; b < beds; b++) {
    const th = 0.42 + rnd() * 0.3;
    // Joints part the bed into blocks along its length.
    const blocks = 1 + Math.floor(rnd() * 2.6);
    const axisX = rnd() < 0.5;
    for (let k = 0; k < blocks; k++) {
      const share = 1 / blocks;
      const along = (k + 0.5) * share - 0.5;
      const bw = (axisX ? w : d) * share * (0.86 + rnd() * 0.1);
      const bd = (axisX ? d : w) * (0.86 + rnd() * 0.14);
      const s = stone({
        detail: detailOf(lod, Math.max(bw, bd)), sx: (axisX ? bw : bd) * 0.5, sy: th * 0.62, sz: (axisX ? bd : bw) * 0.5,
        cuts: lod === 2 ? 3 : 5, rough: 0.06, round: 0.22, sink: 0, seed: seed * 17 + b * 5 + k,
      });
      s.rotateZ(dip);
      s.translate(cx + (axisX ? along * w : 0) + (rnd() - 0.5) * 0.1, y, cz + (axisX ? 0 : along * d) + (rnd() - 0.5) * 0.1);
      parts.push(finish(s, { tone: 0.9 + rnd() * 0.16, moss: 0.55, seed: seed * 17 + b * 5 + k }));
    }
    y += th * 0.92;
    // The next bed stepped back to one side, smaller.
    cx += (rnd() - 0.5) * w * 0.25;
    cz += (rnd() - 0.5) * d * 0.25;
    w *= 0.62 + rnd() * 0.12;
    d *= 0.62 + rnd() * 0.12;
  }
  return parts;
}

/** A boulder broken from a bed: flat split faces, worn edges. */
function boulder(rnd, seed, lod) {
  const s = 1.2 + rnd() * 0.5;
  const g = stone({
    detail: detailOf(lod, s), sx: s * (0.5 + rnd() * 0.15), sy: s * (0.34 + rnd() * 0.12), sz: s * (0.42 + rnd() * 0.12),
    cuts: lod === 2 ? 3 : 4 + Math.floor(rnd() * 3), rough: 0.07, round: 0.2, sink: 0.22, seed,
  });
  return [finish(g, { tone: 0.88 + rnd() * 0.2, moss: 0.5, seed })];
}

/** Scree: angular stones fallen in a spread round the tile's middle. */
function scree(rnd, seed, lod) {
  const n = lod === 0 ? 22 : lod === 1 ? 12 : 6;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const s = 0.16 + Math.pow(rnd(), 2) * 0.42;
    const a = rnd() * Math.PI * 2;
    const r = 0.6 + rnd() * 1.1;
    const g = stone({ detail: lod === 0 ? 1 : 0, sx: s * 0.6, sy: s * 0.4, sz: s * 0.5, cuts: lod === 2 ? 0 : 3, rough: 0.1, round: 0.08, sink: 0.25, seed: seed * 53 + i });
    g.rotateY(rnd() * 6.28);
    g.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
    parts.push(finish(g, { tone: 0.85 + rnd() * 0.25, moss: 0.25, seed: seed * 53 + i }));
  }
  return parts;
}

/** A dark volcanic boulder: rounded, pitted, a little flattened. */
function lavaBoulder(rnd, seed, lod) {
  const s = 1.1 + rnd() * 0.6;
  const g = stone({
    detail: detailOf(lod, s), sx: s * 0.5, sy: s * (0.36 + rnd() * 0.1), sz: s * (0.44 + rnd() * 0.1),
    cuts: lod === 2 ? 0 : 2, rough: 0.12, round: 0.4, sink: 0.25, seed,
  });
  return [finish(g, { tone: 0.95 + rnd() * 0.1, moss: 0.3, seed, base: [0.85, 0.82, 0.8] })];
}

const BUILDERS = { outcrop, boulder, scree, lava: lavaBoulder };

/**
 * Build a rock of `kind` (species.js ROCKS), shape `variant`, at `lod`.
 * `warm`: the desert's yellower limestone. Returns { group, meshes, triangles }.
 */
export function buildRock({ kind = 'boulder', variant = 0, lod = 0, warm = false } = {}) {
  const seed = 101 + variant * 7 + kind.length * 1009;
  const rnd = artRng(seed);
  const parts = BUILDERS[kind](rnd, seed, lod);
  const group = new Group();
  group.name = `rock-${kind}-${variant}-${lod}`;
  const g = merge(parts);
  const mesh = new Mesh(g, rockMaterial(kind, warm));
  mesh.name = kind;
  mesh.castShadow = kind !== 'scree' || lod === 0;
  mesh.receiveShadow = true;
  group.add(mesh);
  return { group, meshes: [mesh], triangles: triangles(g) };
}

/** A geometry made of parts already finished (for tests: the stones' bounds). */
export function rockBounds(kind, variant = 0) {
  const r = buildRock({ kind, variant, lod: 1 });
  r.meshes[0].geometry.computeBoundingBox();
  return r.meshes[0].geometry.boundingBox;
}

