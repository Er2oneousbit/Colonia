/**
 * models/villageKit.js
 * ----------------------------------------------------------------------------
 * How the native villages' builders put things together (tugurium.js, the
 * huts; concilium.js, the meeting place; arvum.js, the plots): the
 * materials, and the shapes of building without a mason, as Iron Age hill
 * villages in Italy were built and as they are excavated:
 *
 *   - thatch: straw or reed laid in courses on a frame of poles, a hand's
 *     span thick and more at the eave, its edge cut ragged; a cone over a
 *     round hut, a ridged cone over an oval one, slopes over a rectangular
 *     one, bound at the top round the smoke's way out (thatchCone,
 *     thatchSlope)
 *   - walls of wattle (hazel or willow rods woven through stakes) daubed
 *     with clay, or a footing of stones laid dry under them, or dry stone to
 *     the eaves on the higher ground (ringWall, wallRun)
 *   - the hearth's fire in a ring of stones, its flames moving with the
 *     look's clock and wind (fireOn: a flickering material, no CPU)
 *
 * Every helper returns plain geometries in metres (y up), UVs in metres and
 * vertex colours, merged one mesh a material (shapes.js merge), as the
 * farms' rural.js does. `lod` 0..2 as everywhere.
 * ----------------------------------------------------------------------------
 */

import { BufferGeometry, Float32BufferAttribute, CylinderGeometry, ConeGeometry } from 'three';
import { boxUV, tintGeometry, wrapLength } from '../shapes.js';
import { material, LOOK_KIND } from '../materials.js';
import { artRng } from '../texgen.js';
import { ruralMaterials, blk, lin } from './rural.js';
import { coals } from './healing.js';
import { sacraMaterials } from './sacra.js';

const TAU = Math.PI * 2;

/** The villages' materials (the countryside's where they are the same things), made once. */
export function villageMaterials() {
  const r = ruralMaterials();
  const s = sacraMaterials();
  return {
    thatch: r.thatch,
    daub: material('daub', { surface: 'daub', vertexColors: true, snow: 0.7 }),
    drystone: material('drystone', { surface: 'drystone', vertexColors: true, snow: 1 }),
    stone: r.stone,
    wood: r.wood,
    bark: r.bark,
    wicker: r.wicker,
    earth: r.earth,
    hide: r.hide,
    clay: r.clay,
    dark: r.dark,
    leaf: r.leaf,
    produce: r.produce,
    rope: r.rope,
    iron: r.iron,
    sack: r.sack,
    bronze: s.bronze,
    embers: s.embers,
    ash: s.ash,
    // The fire's tongues: the altars' glowing colour, and the foliage's flutter (materials.js VERT_SWAY,
    // LOOK_KIND.FOLIAGE): the vertices shiver along their normals with the clock and lean with the wind,
    // so a fire is alive on the GPU with nothing moved on the CPU. (One program with the look's others.)
    flame: material('village-flame', {
      color: 0xffa040, roughness: 1, emissive: 0xff6418, emissiveIntensity: 2.6, snow: 0, wet: 0, sway: 0.09, swayH: 0.6, kind: LOOK_KIND.FOLIAGE,
    }),
  };
}

/**
 * A grid of (rows + 1) x (cols + 1) vertices from f(i, j) -> { p: [x, y, z],
 * uv: [u, v], c (a number or [r, g, b]) }, two triangles a cell, facing
 * along (the way j runs) x (the way i runs): a wall's rows going up and its
 * columns round it to the left face out; `flip` the other way. Normals
 * computed.
 */
export function gridGeo(rows, cols, f, { flip = false } = {}) {
  const pos = [];
  const uv = [];
  const col = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= cols; j++) {
      const v = f(i, j);
      pos.push(...v.p);
      uv.push(...v.uv);
      const c = v.c ?? 1;
      if (Array.isArray(c)) col.push(...c);
      else col.push(c, c, c);
    }
  }
  const idx = [];
  const W = cols + 1;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * W + j;
      const b = a + W;
      if (flip) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A point round an oval (rx along x, rz along z) at angle a (0 toward +z,
 * a quarter toward +x), with a straight ridge of half length `ridge` along x
 * drawn into it (a stadium: an oval hut's roof narrowing to a ridge).
 */
export function ovalAt(a, rx, rz, ridge = 0) {
  const s = Math.sin(a);
  return [s * rx + Math.sign(s) * ridge * Math.min(1, Math.abs(s) * 4), Math.cos(a) * rz];
}

/**
 * A thatched roof over a round or oval hut: a shell `thick` deep from the
 * eave (an oval rx x rz at eaveY, centred on cz) up to the apex at apexY,
 * narrowing to a ridge 2 x `ridge` long if given; the eave's cut edge ragged
 * and drooping a little, the straw bulging out between the poles under it
 * (a slight belly: real thatch is not a cone's straight line), the underside
 * dark. Returns thatch geometries (UVs: u round in metres, v down the slope),
 * coloured by `tone` (new straw gold, old greyed) and darker low on the
 * eaves where it weathers.
 */
export function thatchCone({ rx, rz, cz = 0, eaveY, apexY, thick = 0.22, ridge = 0, lod = 0, seed = 1, tone = 1, hole = 0.1 }) {
  const rnd = artRng(seed);
  const n = lod === 0 ? 40 : lod === 1 ? 20 : 10;
  const rows = lod === 0 ? 7 : lod === 1 ? 4 : 2;
  // The eave's ragged edge, a smooth wave of a few frequencies round it.
  const rag = [];
  for (let k = 0; k < 3; k++) rag.push([2 + Math.floor(rnd() * 5) + k * 4, rnd() * TAU, (0.02 + rnd() * 0.02) / (k + 1)]);
  const edge = (a) => rag.reduce((s, [f, ph, amp]) => s + amp * Math.sin(f * a + ph), 0);
  const slant = Math.hypot(Math.max(rx, rz), apexY - eaveY);
  const around = wrapLength(TAU * Math.max(rx, rz), 1.0);
  const at = (a, t, out) => {
    // t 0 the eave, 1 the apex; a belly of the straw a little below the middle.
    const k = 1 - t;
    const belly = 1 + 0.06 * Math.sin(Math.PI * t) * (lod < 2 ? 1 : 0);
    const e = lod < 2 ? edge(a) * k : 0;
    // (A ridged roof: the oval less the ridge's half length closes in, the ridge stays.)
    const ox = rx - ridge;
    const [x, z] = ovalAt(a, (ox + e) * Math.max(hole / Math.max(ox, 0.01), k) * belly, (rz + e) * Math.max(hole / Math.max(rz, 0.01), k) * belly, ridge);
    out[0] = x;
    out[1] = eaveY + (apexY - eaveY) * t - (lod < 2 ? Math.max(0, e) * 0.6 * k * k : 0);
    out[2] = z + cz;
    return out;
  };
  const tmp = [0, 0, 0];
  const outer = gridGeo(rows, n, (i, j) => {
    const a = (j / n) * TAU;
    const t = i / rows;
    const p = at(a, t, tmp).slice();
    const weather = 0.82 + 0.18 * t;
    return { p, uv: [(j / n) * around, (1 - t) * slant], c: tone * weather };
  });
  // The eave's cut face: straight down from the outer edge `thick` deep, then the underside back in
  // toward the wall, dark (straw seen end-on, in shadow).
  const band = gridGeo(2, n, (i, j) => {
    const a = (j / n) * TAU;
    const p = at(a, 0, tmp).slice();
    const r = Math.hypot(p[0], p[2] - cz) || 1;
    const inn = i === 2 ? Math.max(0, 1 - (thick * 1.6) / r) : 1;
    return { p: [p[0] * inn, p[1] - (i === 0 ? 0 : thick), (p[2] - cz) * inn + cz], uv: [(j / n) * around, -i * thick], c: tone * (i === 0 ? 0.6 : 0.32) };
  }, { flip: true });
  return [outer, band];
}

/**
 * The top of a thatched roof bound round the smoke's way out: a short
 * collar of straw tied with withies at (x, y, z), r across, h high, and the
 * dark mouth of the hole. Returns { thatch, dark }.
 */
export function thatchCrown(x, y, z, r, h, lod = 0, tone = 1) {
  const seg = lod === 0 ? 12 : lod === 1 ? 8 : 5;
  const c = new CylinderGeometry(r * 0.75, r, h, seg, 1, true);
  c.translate(x, y + h / 2, z);
  boxUV(c);
  const dark = new CylinderGeometry(r * 0.6, r * 0.6, 0.02, seg, 1);
  dark.translate(x, y + h - 0.01, z);
  return { thatch: [tintGeometry(c, () => tone * 0.7)], dark: [tintGeometry(boxUV(dark), () => 0.3)] };
}

/**
 * A thick thatched slope: the eave's edge from (x0, x1) at z = zEave, eaveY,
 * up to the ridge at z = zRidge, ridgeY (z may run either way), `thick`
 * deep, its eave ragged. Returns thatch geometries.
 */
export function thatchSlope({ x0, x1, zEave, zRidge, eaveY, ridgeY, thick = 0.22, lod = 0, seed = 1, tone = 1, hip = 0 }) {
  const rnd = artRng(seed);
  const n = lod === 0 ? 14 : lod === 1 ? 7 : 2;
  const rows = lod === 0 ? 5 : lod === 1 ? 3 : 1;
  const ph = rnd() * TAU;
  const slant = Math.hypot(zRidge - zEave, ridgeY - eaveY);
  const sgn = Math.sign(zRidge - zEave) || 1;
  const outer = gridGeo(rows, n, (i, j) => {
    const t = i / rows;
    const u = j / n;
    // A hip draws the slope's ends in toward the ridge.
    const xa = x0 + hip * t;
    const xb = x1 - hip * t;
    const x = xa + (xb - xa) * u;
    const rag = lod < 2 ? (0.03 * Math.sin(u * 17 + ph) + 0.02 * Math.sin(u * 41 + ph * 2)) * (1 - t) : 0;
    const z = zEave + (zRidge - zEave) * t - sgn * rag;
    const y = eaveY + (ridgeY - eaveY) * t + 0.05 * Math.sin(Math.PI * t) - Math.max(0, rag) * 0.5;
    return { p: [x, y, z], uv: [x, (1 - t) * slant], c: tone * (0.82 + 0.18 * t) };
  }, { flip: sgn > 0 });
  const band = gridGeo(1, n, (i, j) => {
    const u = j / n;
    const x = x0 + (x1 - x0) * u;
    const rag = lod < 2 ? 0.03 * Math.sin(u * 17 + ph) + 0.02 * Math.sin(u * 41 + ph * 2) : 0;
    return { p: [x, eaveY - Math.max(0, rag) * 0.5 - i * thick, zEave - sgn * rag + sgn * i * thick * 0.5], uv: [x, -i * thick], c: tone * 0.45 };
  }, { flip: sgn < 0 });
  return [outer, band];
}

/**
 * A wall round an oval (rx x rz, centred on cz) from y0 to y1, `t` thick,
 * with a doorway `door` wide toward +z (none if 0): its outer face, its inner
 * face (for the dark material: the inside of a hut is seen only through its
 * door) and the doorway's jambs. Returns { outer, inner, top }: geometries,
 * UVs round in metres and up.
 */
export function ringWall({ rx, rz, cz = 0, y0, y1, t = 0.15, door = 0, lod = 0, seed = 1, bulge = 0, tone = () => 1 }) {
  const rnd = artRng(seed);
  const n = lod === 0 ? 36 : lod === 1 ? 18 : 10;
  const rows = lod === 0 ? 3 : 1;
  // The doorway's half angle at the outer face.
  const half = door > 0 ? Math.asin(Math.min(0.95, door / 2 / rz)) : 0;
  const a0 = half;
  const a1 = TAU - half;
  const around = wrapLength(TAU * Math.max(rx, rz), 1.2);
  const ph = rnd() * TAU;
  const wob = (a, y) => (lod === 0 ? 0.012 * Math.sin(a * 7 + ph) + 0.008 * Math.sin(a * 13 + y * 9 + ph) : 0);
  const face = (k, inner) => gridGeo(rows, n, (i, j) => {
    const a = a0 + ((a1 - a0) * j) / n;
    const y = y0 + ((y1 - y0) * i) / rows;
    const b = 1 + bulge * Math.sin(Math.PI * (i / rows));
    const off = inner ? -t : wob(a, y);
    const [x, z] = ovalAt(a, (rx + off) * b, (rz + off) * b);
    return { p: [x, y, z + cz], uv: [(a / TAU) * around, y], c: inner ? 0.5 : tone(a, y) };
  }, { flip: inner });
  const outer = face(0, false);
  const inner = face(1, true);
  const top = gridGeo(1, n, (i, j) => {
    const a = a0 + ((a1 - a0) * j) / n;
    const [x, z] = ovalAt(a, rx - i * t, rz - i * t);
    return { p: [x, y1, z + cz], uv: [(a / TAU) * around, i * t], c: 0.9 };
  });
  const jambs = [];
  if (door > 0) {
    for (const a of [a0, a1]) {
      const [xo, zo] = ovalAt(a, rx, rz);
      const [xi, zi] = ovalAt(a, rx - t, rz - t);
      jambs.push(gridGeo(1, 1, (i, j) => ({ p: [j ? xi : xo, y0 + (y1 - y0) * i, (j ? zi : zo) + cz], uv: [j * t, y0 + (y1 - y0) * i], c: 0.8 }), { flip: a < Math.PI }));
    }
  }
  return { outer: [outer, ...jambs], inner: [inner], top: [top] };
}

/**
 * A ring of stones laid dry (a hut's footing, a hearth's kerb, the meeting
 * place's ring): the wall as a band of the dry stone surface, and at the
 * full level its top course of separate rough stones. Returns { stone }.
 */
export function dryRing({ rx, rz, cz = 0, h, t = 0.32, door = 0, lod = 0, seed = 1, caps = true }) {
  const w = ringWall({ rx, rz, cz, y0: 0, y1: h, t, door, lod: Math.min(lod, 1), seed, bulge: 0.04, tone: (a, y) => 0.8 + 0.2 * Math.min(1, y / 0.3) });
  const out = [...w.outer, ...w.top];
  if (caps && lod === 0) {
    const rnd = artRng(seed + 5);
    const half = door > 0 ? Math.asin(Math.min(0.95, door / 2 / rz)) : 0;
    const per = Math.max(rx, rz) * TAU;
    const n = Math.round(per / 0.34);
    for (let k = 0; k < n; k++) {
      const a = half + ((TAU - 2 * half) * (k + 0.5)) / n;
      const [x, z] = ovalAt(a, rx - t / 2, rz - t / 2);
      const g = blk(1, 0.3 + rnd() * 0.08, 0.1 + rnd() * 0.05, t * 0.9, { seed: seed + k, wobble: 0.02, grime: 0.2 });
      g.rotateZ((rnd() - 0.5) * 0.12);
      g.rotateY(a + Math.PI / 2);
      g.translate(x, h - 0.04, z + cz);
      out.push(g);
    }
  }
  return { stone: out };
}

/**
 * A fire on a hearth at (x, y, z), `r` across: a kerb of stones round it, the
 * coals (`hot` glowing, `dark` charcoal), the flames' tongues (`big` scales
 * them: a cooking fire, or the great fire of an angry village), the logs
 * burning across it. Returns { stone, hot, dark, flames, bark }.
 */
export function fireOn(x, y, z, r, { lod = 0, seed = 1, big = 1, kerb = true } = {}) {
  const rnd = artRng(seed);
  const out = { stone: [], hot: [], dark: [], flames: [], bark: [] };
  if (kerb) {
    const n = lod === 2 ? 6 : Math.max(7, Math.round((TAU * r) / 0.16));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + rnd() * 0.2;
      const s = 0.1 + rnd() * 0.05;
      const g = blk(lod === 0 ? 0 : 1, s * 1.3, s * 0.8, s, { bevel: 0.03, seed: seed + k, wobble: 0.02, grime: 0.5 });
      g.rotateY(a);
      g.translate(x + Math.sin(a) * (r + 0.06), y, z + Math.cos(a) * (r + 0.06));
      out.stone.push(tintGeometry(g, (px, py) => 0.5 + 0.5 * Math.min(1, (py - y) / 0.1)));
    }
  }
  const c = coals(x, y, z, r * 0.8, { seed, lod, n: lod ? 8 : Math.round(16 * big) + 6 });
  out.hot.push(...c.hot);
  out.dark.push(...c.dark);
  // The logs across the fire, charred at their ends in it.
  const logs = lod === 2 ? 2 : big > 1.4 ? 6 : 4;
  for (let k = 0; k < logs; k++) {
    const a = (k / logs) * Math.PI + rnd() * 0.4;
    const L = r * 1.6 + rnd() * 0.15;
    const g = new CylinderGeometry(0.045, 0.05, L, lod ? 5 : 7, 1);
    g.rotateZ(Math.PI / 2 - 0.25);
    g.rotateY(a);
    g.translate(x, y + 0.08 + 0.04 * (k % 2), z);
    out.bark.push(tintGeometry(boxUV(g), (px, py, pz) => (Math.hypot(px - x, pz - z) < r * 0.4 ? 0.25 : 0.85)));
  }
  // The tongues: clustered, of mixed heights, leaning out from the middle; the flicker is the material's.
  const tongues = lod === 2 ? 3 : lod === 1 ? 6 : 11;
  for (let k = 0; k < tongues; k++) {
    const a = rnd() * TAU;
    const d = Math.sqrt(rnd()) * r * 0.55;
    const H = (0.22 + rnd() * 0.3) * big * (1 - d / (r * 1.2));
    const rr = (0.05 + rnd() * 0.04) * Math.sqrt(big);
    const seg = lod ? 5 : 7;
    const f = new ConeGeometry(rr, H, seg, lod ? 2 : 5, true);
    const P = f.attributes.position;
    const ph = rnd() * TAU;
    for (let i = 0; i < P.count; i++) {
      const tt = P.getY(i) / H + 0.5;
      const swell = 1 + 0.4 * Math.sin(Math.PI * Math.min(1, tt * 1.4));
      P.setXYZ(i, P.getX(i) * swell + Math.sin(tt * 5 + ph) * 0.03 * tt, P.getY(i), P.getZ(i) * swell + Math.cos(tt * 4 + ph) * 0.025 * tt);
    }
    f.computeVertexNormals();
    f.rotateZ(Math.sin(a) * d * 1.5);
    f.rotateX(-Math.cos(a) * d * 1.5);
    f.translate(x + Math.sin(a) * d, y + 0.05 + H / 2, z + Math.cos(a) * d);
    out.flames.push(tintGeometry(boxUV(f), (px, py) => 1 - 0.5 * Math.min(1, (py - y) / (H + 0.05))));
  }
  return out;
}

/** A linear colour as vertex colour, for things that ARE their colour (a fleece, a hide). */
export { lin };
