/**
 * models/fountain.js
 * ----------------------------------------------------------------------------
 * The street fountain (lacus) of the 3D look, in four looks that rise with
 * the neighbourhood (render3d/fountainTier.js chooses one), built from what
 * survives of Roman public fountains rather than from the 2D sprite. All
 * four fit one game tile (4 m) and face +z: the spout, and the pillar or
 * wall it comes from, stand at the back (-z), the tank in front of it.
 *
 *   1. A plain lacus of lava, as most of Pompeii's forty-odd street
 *      fountains are: four thick slabs of the grey Vesuvian stone the
 *      streets are paved with, standing on a bottom slab, held at the top
 *      corners by iron cramps leaded into the stone, a squat pillar at the
 *      back with a projecting spout block and a lead nozzle, the lead pipe
 *      (fistula) that feeds it running up the pillar's back. A notch cut in
 *      the front slab lets the overflow run into the street; the slab's top
 *      is worn into a dip where people leaned to fill their jars. A few
 *      lava flags round it.
 *   2. A limestone lacus on a step of limestone blocks (to stand on when
 *      filling a jar), its pillar moulded at foot and cap, a carved head on
 *      its face (a mask of a water god, beard and hair in locks, as the
 *      Pompeian heads of Mercury, Silenus and Oceanus are), the water
 *      coming out of its mouth through a bronze nozzle.
 *   3. A marble basin cut from one block, moulded at the rim and foot, on a
 *      plinth, with a fluted column behind it carrying a bronze lion's head
 *      spout, in a square of fine marble paving with a travertine kerb.
 *   4. A small nymphaeum, as wealthy towns put up at their crossroads and
 *      rich houses in their gardens: a marble platform of two steps, a back
 *      wall faced in marble with an apsed niche lined in blue glass mosaic
 *      under a shell, flanked by two fluted columns carrying an entablature
 *      and a pediment (an aedicula); a nymph in the niche pours water from
 *      an urn down a marble cascade into a moulded basin; clipped box in
 *      terracotta pots at the front corners.
 *
 * States (meshes tagged in userData.when; setFountainState shows them):
 *   'always'  the stone, the metal, the plants
 *   'full'    the water standing in the tank (flowing or not)
 *   'flow'    running: the stream, the rings and foam where it falls, the
 *             sheet over the lip, the wet stain in the street
 *   'dry'     no water: a puddle of green water on the tank's floor, a pale
 *             lime stain where the overflow used to run
 *   'ice'     icicles on the lip (running water in a hard frost)
 *
 * Levels of detail (`lod`): 0 for the lab and the game's close zooms, 1
 * with the small things left out and the round things coarser, 2 a few
 * hundred triangles for a city seen from far out.
 *
 * In metres, y up, the tile's middle at the origin, the street's surface at
 * y = 0, as models/well.js. Meshes are merged by material.
 * ----------------------------------------------------------------------------
 */

import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  Group, Mesh, CylinderGeometry, SphereGeometry, CircleGeometry, BufferGeometry, Float32BufferAttribute, ConeGeometry,
  IcosahedronGeometry, Vector3,
} from 'three';
import { revolve, profileOf, block, tube, merge, tintGeometry, triangles, frameSweep, boxUV } from '../shapes.js';
import {
  material, waterMaterial, streamMaterial, ringMaterial, stagnantMaterial, iceMaterial,
} from '../materials.js';
import { artRng, smoothstep } from '../texgen.js';
import { buildFigure } from './figure.js';

/** The four looks, poorest first (fountainTier.js numbers them 1 to 4). */
export const FOUNTAIN = Object.freeze({
  tile: 4,
  tiers: 4,
  names: Object.freeze(['Lava lacus', 'Limestone lacus', 'Marble basin', 'Nymphaeum']),
});

/** What shows in each state (see the header). */
export const FOUNTAIN_STATES = Object.freeze({
  flowing: Object.freeze(['always', 'full', 'flow']),
  still: Object.freeze(['always', 'full']),
  dry: Object.freeze(['always', 'dry']),
});

const D = (deg) => (deg * Math.PI) / 180;
/** The nymph's hydria, scaled to her (a real one is about a quarter of a woman's height). */
const JAR = 0.72;
const G = 9.81;

/** Each tier's layout (metres): the tank, the stone it stands on, the spout. */
function layoutOf(tier) {
  switch (tier) {
    case 1: return { x0: -0.85, x1: 0.85, z0: -0.4, z1: 0.62, H: 0.8, T: 0.17, base: 0.065, spoutY: 1.1, reach: 0.27, notch: 0.42, floor: 0.065, stainY: 0.075, spread: 0.6 };
    case 2: return { x0: -0.8, x1: 0.8, z0: -0.38, z1: 0.6, H: 0.76, T: 0.13, base: 0.15, spoutY: 1.12, reach: 0.3, notch: -0.4, floor: 0.15, stainY: 0.16, spread: 0.55 };
    case 3: return { x0: -0.88, x1: 0.88, z0: -0.36, z1: 0.6, H: 0.72, T: 0.11, base: 0.17, spoutY: 1.16, reach: 0.34, notch: 0.45, floor: 0.17, stainY: 0.058, spread: 0.09 };
    default: return { x0: -0.95, x1: 0.95, z0: -1.1, z1: -0.08, H: 0.56, T: 0.12, base: 0.24, spoutY: 1.27, reach: 0.3, notch: 0, floor: 0.24, stainY: 0.25, spread: 0.5 };
  }
}

/** Water stands this far under the tank's rim (it runs out at the notch, a little lower). */
const BRIM = 0.045;

/**
 * A tank of slabs (tiers 1 and 2): a bottom slab, long slabs front and
 * back, end slabs between them; the front slab's top worn into a dip at
 * the spout and cut with the overflow's notch; iron cramps over the
 * corner joints. y from `y0`.
 */
function slabTank(L, y0, seed, lod) {
  const { x0, x1, z0, z1, H, T, notch } = L;
  const FT = 0.13;
  const stone = [];
  const iron = [];
  const seg = lod ? 1 : 2;
  // (Lava is hard to dress: its slabs are rougher, their arrises rounder, than limestone's.)
  const rough = L.T > 0.15;
  const opts = (s, extra = {}) => ({ bevel: rough ? 0.03 : 0.02, seed: seed + s, wobble: rough ? 0.011 : 0.005, grime: 0.45, seg, tone: 0.06, ...extra });
  const put = (g, x, z) => {
    g.translate(x, y0, z);
    stone.push(g);
    return g;
  };
  put(block(x1 - x0 + 0.04, FT, z1 - z0 + 0.04, opts(1, { grime: 0.6 })), (x0 + x1) / 2, (z0 + z1) / 2);
  const wallH = H - FT;
  const back = block(x1 - x0, wallH, T, opts(2));
  back.translate(0, FT, 0);
  put(back, (x0 + x1) / 2, z0 + T / 2);
  // The front slab, the notch the overflow runs out by cut down into it (a slab either side, the
  // channel's floor between, as the stone reads: a square cut, worn round at its edges).
  const nw = 0.11;
  const cut = BRIM - 0.008;
  const fl = block(notch - nw / 2 - x0, wallH, T, opts(3));
  fl.translate(0, FT, 0);
  put(fl, (x0 + notch - nw / 2) / 2, z1 - T / 2);
  const fr = block(x1 - notch - nw / 2, wallH, T, opts(6));
  fr.translate(0, FT, 0);
  put(fr, (x1 + notch + nw / 2) / 2, z1 - T / 2);
  const fc = block(nw + 0.012, wallH - cut, T - 0.004, opts(7, { bevel: 0.012 }));
  fc.translate(0, FT, 0);
  put(fc, notch, z1 - T / 2);
  for (const [s, x] of [[4, x0 + T / 2], [5, x1 - T / 2]]) {
    const end = block(T, wallH, z1 - z0 - 2 * T - 0.006, opts(s));
    end.translate(0, FT, 0);
    put(end, x, (z0 + z1) / 2);
  }
  if (lod < 2) {
    // Iron cramps across the four corner joints, leaded into the tops.
    for (const z of [z0 + T / 2, z1 - T / 2]) {
      for (const x of [x0 + T / 2, x1 - T / 2]) {
        const c = block(0.035, 0.012, 0.15, { bevel: 0.003, seed: seed + 9, wobble: 0.0005, grime: 0, seg: 1 });
        c.translate(x, y0 + H - 0.005, z + (z < 0 ? 0.035 : -0.035));
        iron.push(c);
      }
    }
  }
  return { stone, iron, floorY: y0 + FT };
}

/**
 * A basin cut from one block (tier 3, and tier 4's): moulded at the rim
 * (an ovolo under a flat lip) and at the foot (a plinth and a torus),
 * hollowed to `T` walls; the floor inside. Swept round the rectangle, so
 * the mouldings meet in mitres at the corners.
 */
function mouldedBasin(L, y0, lod, { foot = true } = {}) {
  const { x0, x1, z0, z1, H, T, notch } = L;
  const hx = (x1 - x0) / 2;
  const hz = (z1 - z0) / 2;
  const n = lod ? 3 : 7;
  const outside = [
    [0.04, 0], [0.05, 0.01], [0.05, 0.06],
    ...(foot ? [{ arc: [0.03, 0.09, 0.03, D(-90), D(90)], n }, [0.0, 0.13], [0.0, 0.14]] : [[0.0, 0.07]]),
    [-0.004, H - 0.12],
    { arc: [0.0, H - 0.1, 0.02, D(-90), D(0)], n }, // a small fillet
    { arc: [0.02, H - 0.06, 0.04, D(-90), D(0)], n }, // the ovolo
    [0.06, H - 0.02], { arc: [0.05, H - 0.01, 0.01, D(0), D(90)], n: Math.max(2, n - 3) },
    [-T + 0.01, H], { arc: [-T + 0.01, H - 0.01, 0.01, D(90), D(180)], n: 2 },
    [-T, H - 0.03], [-T, 0.16],
    [-T + 0.03, 0.13], [-Math.min(hx, hz) + 0.001, 0.13],
  ];
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const g = frameSweep(profileOf(outside), hx, hz, {
    steps: lod === 0 ? 28 : lod === 1 ? 10 : 1,
    deform: (p) => {
      // The overflow's notch through the front of the rim.
      if (notch !== null && p.z > hz - T - 0.02 && p.y > H - 0.07) {
        const f = Math.exp(-(((p.x + cx - notch) / 0.07) ** 4));
        p.y -= (BRIM - 0.008) * f * smoothstep(H - 0.07, H - 0.01, p.y);
      }
    },
    tint: (p) => {
      let t = 0.72 + 0.28 * smoothstep(0.0, 0.25, p.y); // grime at the foot
      if (Math.abs(p.x) < hx - T - 0.005 && Math.abs(p.z) < hz - T - 0.005) t *= 0.78; // the inside: stained by the water
      return t;
    },
  });
  g.translate(cx, y0, cz);
  return { stone: [g], floorY: y0 + 0.13 };
}

/** A copy of a geometry with its faces turned inside out (seen from within: a niche). */
function insideOut(g) {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = t;
  }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

/**
 * A head in relief, facing +z, its face's middle at the origin: a
 * flattened half sphere shaped by soft bumps and hollows (brow, eyes, nose,
 * cheeks, an open mouth for the pipe), with locks of hair and beard round
 * it, or a lion's mane. `r` its radius; `kind` 'mask' or 'lion'.
 */
function reliefHead(r, kind, lod, seed) {
  const rnd = artRng(seed);
  const w = lod ? 16 : 40;
  const h = lod ? 12 : 30;
  // (phi 0 to pi: the half facing +z.)
  const g = new SphereGeometry(r, w, h, 0, Math.PI, 0, Math.PI);
  // Bumps: [x, y, depth, size] in units of r, along +z.
  const lion = kind === 'lion';
  const bumps = lion ? [
    [0, 0.3, 0.12, 0.35], // brow
    [-0.3, 0.15, -0.18, 0.13], [0.3, 0.15, -0.18, 0.13], // eyes
    [0, -0.12, 0.42, 0.32], // the muzzle
    [0, 0.0, 0.18, 0.12], // the nose's bridge
    [-0.2, -0.2, 0.16, 0.18], [0.2, -0.2, 0.16, 0.18], // whisker pads
    [0, -0.42, -0.4, 0.16], // the open mouth
  ] : [
    [0, 0.32, 0.14, 0.3], // brow
    [-0.27, 0.13, -0.2, 0.12], [0.27, 0.13, -0.2, 0.12], // eyes
    [0, 0.06, 0.24, 0.1], [0, -0.06, 0.3, 0.11], // the nose
    [-0.32, -0.1, 0.12, 0.2], [0.32, -0.1, 0.12, 0.2], // cheeks
    [0, -0.32, -0.32, 0.13], // the open mouth
    [0, -0.6, 0.1, 0.35], // the beard's mass
  ];
  // Locks of hair and beard (or a mane) round the face: a ring of bumps.
  const locks = [];
  const nl = lion ? 16 : 13;
  for (let k = 0; k < nl; k++) {
    const a = (k / nl) * Math.PI * 2 + rnd() * 0.2;
    const rr = lion ? 0.82 : 0.78;
    locks.push([Math.cos(a) * rr, Math.sin(a) * rr * 1.05, (lion ? 0.22 : 0.15) * (0.8 + rnd() * 0.4), lion ? 0.2 : 0.16]);
  }
  const all = lod ? bumps : bumps.concat(locks);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / r;
    const y = pos.getY(i) / r;
    let z = pos.getZ(i) / r;
    let dz = 0;
    for (const [bx, by, d, s] of all) dz += d * Math.exp(-((((x - bx) ** 2) + ((y - by) ** 2)) / (s * s)));
    // Flattened into a relief, the bumps standing off it.
    z = Math.max(0, z) * (lion ? 0.7 : 0.62) + Math.max(0, z) ** 0.5 * dz * 1.7;
    pos.setXYZ(i, x * r, y * r * 1.1, z * r);
    // Dirt in the hollows (eyes, mouth), lighter on what stands out.
    const t = Math.max(0.45, Math.min(1.1, 0.85 + dz * 0.8));
    col[i * 3] = t;
    col[i * 3 + 1] = t;
    col[i * 3 + 2] = t;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  boxUV(g);
  return g;
}

/**
 * The points of a stream falling from (x, y, z), leaving at `speed` (m/s)
 * along `dir` (a unit vector in x, z, tilted down by `drop` radians),
 * until it reaches height `yEnd`: the parabola thrown water draws.
 */
function streamPath(x, y, z, dir, speed, drop, yEnd, n = 10) {
  const vh = speed * Math.cos(drop);
  const vy = -speed * Math.sin(drop);
  // y(t) = y + vy t - g t^2 / 2 = yEnd
  const t1 = (vy + Math.sqrt(vy * vy + 2 * G * (y - yEnd))) / G;
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * t1;
    pts.push([x + dir[0] * vh * t, y + vy * t - 0.5 * G * t * t, z + dir[1] * vh * t]);
  }
  return pts;
}

/**
 * A stream along `pts`, thinning as it falls (r0 at the spout to r1),
 * with UVs along it in metres (the stream material scrolls them).
 */
function streamTube(pts, r0, r1, lod) {
  const g = tube(pts, 1, { radial: lod ? 6 : 10, segments: lod ? 8 : 20, around: 0.05, tension: 0.5 });
  // tube() made it with radius 1 about its curve: pull each ring in to the radius it has there.
  const pos = g.attributes.position;
  const radial = (lod ? 6 : 10) + 1;
  const rings = pos.count / radial;
  const c = new Vector3();
  for (let k = 0; k < rings; k++) {
    const t = k / (rings - 1);
    const r = r0 + (r1 - r0) * t;
    // The ring's centre: the mean of its points.
    c.set(0, 0, 0);
    for (let j = 0; j < radial; j++) c.add(new Vector3(pos.getX(k * radial + j), pos.getY(k * radial + j), pos.getZ(k * radial + j)));
    c.multiplyScalar(1 / radial);
    for (let j = 0; j < radial; j++) {
      const i = k * radial + j;
      // Running water is never a clean tube: it pinches and bulges along its length and round it.
      const a = (j / (radial - 1)) * Math.PI * 2;
      const w = r * (1 + 0.1 * Math.sin(t * 23 + a * 2) + 0.06 * Math.sin(t * 41 + a * 3 + 1.7));
      pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * w, c.y + (pos.getY(i) - c.y) * w, c.z + (pos.getZ(i) - c.z) * w);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** A flat ring on the water round (x, z), inner to outer radius, its v running outward (ringMaterial scrolls it). */
function ripples(x, y, z, inner, outer, lod) {
  const seg = lod ? 16 : 40;
  const rings = lod ? 2 : 5;
  const pos = [];
  const uv = [];
  const idx = [];
  const col = [];
  for (let j = 0; j <= rings; j++) {
    const r = inner + ((outer - inner) * j) / rings;
    // Fading out at both edges (the colour's alpha), so the rings melt into the still water round them.
    const alpha = smoothstep(inner, inner + 0.04, r) * (1 - smoothstep(outer * 0.45, outer, r));
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      pos.push(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
      uv.push((k / seg) * 1.2, r * 2.4);
      col.push(1, 1, 1, alpha);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let k = 0; k < seg; k++) {
      const a = j * (seg + 1) + k;
      const b = a + seg + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 4));
  g.computeVertexNormals();
  return g;
}

/**
 * A flat blob (a stain, foam) of radius about r round (x, z) at height y,
 * wavy edged, stretched by (sx, sz); `fade`: its colour's alpha falls to
 * nothing at the rim (a soft edge; the material must allow vertex alpha).
 */
function blob(x, y, z, r, seed, { sx = 1, sz = 1, seg = 18, wav = 0.25, fade = false } = {}) {
  const rnd = artRng(seed);
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const pos = [x, y, z];
  const idx = [];
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    const rr = r * (1 + wav * (0.5 * Math.sin(a * 2 + ph[0]) + 0.3 * Math.sin(a * 3 + ph[1]) + 0.2 * Math.sin(a * 5 + ph[2])));
    pos.push(x + Math.cos(a) * rr * sx, y, z + Math.sin(a) * rr * sz);
    if (k > 0) idx.push(0, k + 1, k);
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  boxUV(g);
  if (!fade) return tintGeometry(g);
  const col = [1, 1, 1, 1];
  for (let k = 0; k <= seg; k++) col.push(1, 1, 1, 0);
  g.setAttribute('color', new Float32BufferAttribute(col, 4));
  return g;
}

/**
 * The flowing sheet over the notch: from the water's surface over the
 * notch's floor and down the front of the tank to the street, then
 * spreading as a film. UVs along the flow (the stream material scrolls
 * them down). `lip` the notch's floor, `face` the front face's z.
 */
function sheet(x, yWater, lip, zIn, face, w, foot, spread, lod, off = 0) {
  face += off;
  const path = [
    [zIn - 0.02, yWater + 0.002, w * 0.8],
    [zIn + 0.02, lip + 0.006, w * 0.9],
    [face + 0.004, lip + 0.002, w],
    [face + 0.012, lip - 0.05, w * 1.05],
    [face + 0.008, (lip + foot) * 0.5, w * 1.1],
    [face + 0.006, foot + 0.035, w * 1.2],
    [face + Math.min(0.04, spread * 0.5), foot + 0.007, w * 1.6],
    [face + spread * 0.5, foot + 0.005, w * 2.4],
    [face + spread, foot + 0.005, w * 2.2],
  ];
  const steps = lod ? 1 : 3;
  const pos = [];
  const uv = [];
  const idx = [];
  let along = 0;
  let prev = null;
  const rows = [];
  for (let i = 0; i < path.length - 1; i++) {
    for (let s = 0; s < steps; s++) rows.push(path[i].map((v, k) => v + ((path[i + 1][k] - v) * s) / steps));
  }
  rows.push(path[path.length - 1]);
  for (const [z, y, ww] of rows) {
    if (prev) along += Math.hypot(z - prev[0], y - prev[1]);
    prev = [z, y];
    for (const s of [-1, 1]) {
      pos.push(x + s * ww / 2, y, z);
      uv.push(along, (s + 1) * 0.5 * ww);
    }
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return tintGeometry(g);
}

/** Icicles hanging from a lip along x (x0..x1) at height y, face z: thin cones of seeded lengths. */
function icicles(x0, x1, y, z, seed, n = 7) {
  const rnd = artRng(seed);
  const out = [];
  for (let k = 0; k < n; k++) {
    const len = 0.04 + rnd() * 0.1;
    const c = new ConeGeometry(0.006 + rnd() * 0.006, len, 5, 1);
    c.rotateX(Math.PI);
    c.translate(x0 + ((x1 - x0) * (k + 0.5)) / n + (rnd() - 0.5) * 0.02, y - len / 2, z + rnd() * 0.01);
    boxUV(c);
    out.push(tintGeometry(c));
  }
  return out;
}

/** Flagstones over a rectangle (x0..x1, z0..z1), h thick, in rows of seeded lengths; `skip(x, z)` leaves a flag out. */
function flags(x0, x1, z0, z1, h, seed, { rowW = 0.5, minL = 0.4, maxL = 0.8, skip = null, bevel = 0.015, lod = 0, tone = 0.12, grime = 0.35 } = {}) {
  if (lod === 2) {
    // From far out a paving is one slab.
    const g = block(x1 - x0, h, z1 - z0, { bevel: Math.min(bevel, 0.02), seed, wobble: 0, grime, seg: 1 });
    return [g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2)];
  }
  const rnd = artRng(seed);
  const out = [];
  const gap = 0.008;
  let n = 0;
  for (let z = z0; z < z1 - 0.05; z += rowW) {
    const zb = Math.min(z1, z + rowW);
    let x = x0;
    while (x < x1 - 0.05) {
      let xb = Math.min(x1, x + minL + rnd() * (maxL - minL));
      if (x1 - xb < minL * 0.5) xb = x1;
      const cx = (x + xb) / 2;
      const cz = (z + zb) / 2;
      if (!skip || !skip(cx, cz)) {
        const g = block(xb - x - gap, h + (rnd() - 0.5) * 0.006, zb - z - gap, {
          bevel, seed: seed * 31 + ++n, wobble: 0.004, grime, topSag: 0.008, seg: lod ? 1 : 2, tone,
        });
        g.translate(cx, 0, cz);
        out.push(g);
      }
      x = xb;
    }
  }
  return out;
}

/** A turned column shaft, fluted (lod 0), from y 0 to h, radius r at the foot tapering to 0.88 r. */
function fluted(r, h, lod, flutes = 20) {
  const P = profileOf([[r, 0], ...Array.from({ length: lod ? 3 : 10 }, (_, k) => [r * (1 - 0.12 * ((k + 1) / (lod ? 3 : 10)) ** 1.5), (h * (k + 1)) / (lod ? 3 : 10)])]);
  return revolve(P, {
    segments: lod ? 16 : flutes * 4,
    metres: 1.6,
    deform: lod ? null : (p, th) => {
      const t = p.y / h;
      if (t < 0.04 || t > 0.97) return;
      const c = Math.max(0, Math.cos(th * flutes));
      const k = 1 - (0.06 * Math.pow(c, 0.6)) * smoothstep(0.04, 0.08, t) * smoothstep(0.97, 0.93, t);
      p.x *= k;
      p.z *= k;
    },
    tint: (p) => 0.85 + 0.15 * smoothstep(0, 0.4, p.y),
  });
}

/** A Tuscan base (plinth, torus) and capital (echinus, abacus) for a shaft of radius r. */
function baseAndCapital(r, h, lod) {
  const n = lod ? 3 : 6;
  const base = revolve(profileOf([
    [0, 0], [r * 1.42, 0], [r * 1.42, r * 0.32],
    { arc: [r * 1.2, r * 0.5, r * 0.22, D(-60), D(90)], n }, [r, r * 0.72], [0, r * 0.72],
  ]), { segments: lod ? 16 : 40, metres: 1.6 });
  const cap = revolve(profileOf([
    [0, h - r * 0.6], [r * 0.9, h - r * 0.6], [r * 0.95, h - r * 0.5],
    { arc: [r * 0.95, h - r * 0.2, r * 0.3, D(-90), D(0)], n }, [r * 1.35, h - r * 0.15], [r * 1.35, h], [0, h],
  ]), { segments: lod ? 4 : 4, metres: 1.6 });
  // (The abacus is square: four segments, turned to the walls.)
  cap.rotateY(Math.PI / 4);
  return [base, cap];
}

/** A clipped box shrub in a terracotta pot, standing on (x, y, z). */
function pottedBox(x, y, z, seed, lod) {
  const pot = revolve(profileOf([
    [0, 0], [0.13, 0], [0.12, 0.02], [0.19, 0.3], [0.205, 0.32], [0.205, 0.35], [0.18, 0.35], [0.17, 0.3], [0, 0.3],
  ]), { segments: lod ? 12 : 28, metres: 0.6, tint: (p) => 0.75 + 0.25 * smoothstep(0, 0.2, p.y) });
  pot.translate(x, y, z);
  const rnd = artRng(seed);
  // (Welded, so the clipped ball is shaded smooth, not in facets.)
  const ico = new IcosahedronGeometry(0.3, lod ? 4 : 14);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const leaf = mergeVertices(ico, 1e-5);
  const pos = leaf.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let i = 0; i < pos.count; i++) {
    const v = new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const n = v.clone().normalize();
    // Clipped round but not perfect: lumpy at two scales.
    const leafy = Math.sin(n.x * 61 + n.y * 13) * Math.sin(n.z * 57 + n.y * 29) * Math.sin(n.y * 47 + n.x * 17);
    const k = 1 + 0.07 * Math.sin(n.x * 7 + ph[0]) * Math.sin(n.y * 6 + ph[1]) + 0.05 * Math.sin(n.z * 15 + n.x * 11 + ph[2]) + 0.025 * leafy;
    v.multiplyScalar(k);
    v.y *= 0.92;
    pos.setXYZ(i, v.x, v.y, v.z);
    // Dark inside and underneath, fresh on top.
    const t = (0.55 + 0.45 * smoothstep(-0.25, 0.3, v.y)) * (0.8 + 0.2 * leafy) * (0.9 + 0.1 * Math.sin(n.x * 23 + n.z * 19));
    col[i * 3] = t;
    col[i * 3 + 1] = t;
    col[i * 3 + 2] = t;
  }
  leaf.setAttribute('color', new Float32BufferAttribute(col, 3));
  leaf.computeVertexNormals();
  boxUV(leaf);
  leaf.translate(x, y + 0.56, z);
  const soil = new CylinderGeometry(0.18, 0.18, 0.01, lod ? 8 : 16);
  soil.translate(x, y + 0.33, z);
  return { pot, leaf, soil: tintGeometry(soil) };
}

/** A hydria (water jar), mouth up, its foot at the origin: turned, about 0.32 m tall. */
function hydria(lod) {
  return revolve(profileOf([
    [0, 0], [0.055, 0], [0.06, 0.015], [0.1, 0.08], [0.12, 0.15], [0.115, 0.2], [0.08, 0.25], [0.04, 0.27],
    [0.035, 0.3], [0.05, 0.32], [0.045, 0.325], [0.03, 0.31], [0, 0.31],
  ]), { segments: lod ? 10 : 24, metres: 0.6 });
}

/**
 * Build a fountain: `tier` 1..4, `lod` 0..2. Returns { group, meshes,
 * triangles, spout (where the water leaves), parts (by name) }; each mesh
 * says in userData.when which state shows it (setFountainState).
 */
export function buildFountain({ tier = 1, lod = 0, seed = 21 } = {}) {
  tier = Math.max(1, Math.min(4, tier | 0));
  lod = Math.max(0, Math.min(2, lod | 0));
  const L = layoutOf(tier);
  const group = new Group();
  group.name = `fountain-${tier}`;
  const meshes = [];
  const add = (geos, mat, name, when = 'always', cast = true) => {
    const list = (Array.isArray(geos) ? geos : [geos]).filter(Boolean);
    if (!list.length) return null;
    const m = new Mesh(list.length === 1 && list[0].attributes.color ? list[0] : merge(list), mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    m.userData.when = when;
    group.add(m);
    meshes.push(m);
    return m;
  };

  const lava = material('lava', { surface: 'lava', vertexColors: true, snow: 1 });
  const lime = material('limestone', { surface: 'limestone', vertexColors: true, snow: 1 });
  const trav = material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 });
  const marble = material('marble', { surface: 'marble', vertexColors: true, snow: 1 });
  const ironM = material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 });
  const bronze = material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 });
  const lead = material('lead', { color: 0x6f7173, roughness: 0.55, metalness: 0.7, snow: 0.7 });
  const stoneMat = tier === 1 ? lava : tier === 2 ? lime : marble;
  const stone = [];
  const metal = [];
  const bronzes = [];
  const extra = { trav: [], lime: [], terracotta: [], leaf: [], soil: [], mosaic: [], leads: [], stucco: [] };
  const base = L.base;
  const top = base + L.H; // the tank's rim
  const waterY = top - BRIM;
  let tank;
  let jarFoot = null;
  let jarMouth = null;

  // ---- what it stands on, the tank, the pillar ---------------------------------------
  if (tier === 1) {
    // A few lava flags under and round it, more in front where people stand.
    stone.push(...flags(-1.15, 1.15, -0.85, 1.35, base, seed + 1, { rowW: 0.55, lod, minL: 0.5, maxL: 0.9, skip: lod === 2 ? null : (x, z) => (x < -0.8 && z > 0.9) || (x > 0.75 && z < -0.5) }));
    tank = slabTank(L, base, seed + 2, lod);
    stone.push(...tank.stone);
    metal.push(...tank.iron);
    // The pillar: a squat block behind the back slab, a cap slab on it.
    const pz = L.z0 - 0.16;
    stone.push(block(0.42, 1.12, 0.3, { bevel: 0.025, seed: seed + 3, wobble: 0.006, grime: 0.5, seg: lod ? 1 : 2 }).translate(0, base, pz));
    stone.push(block(0.5, 0.09, 0.38, { bevel: 0.025, seed: seed + 4, wobble: 0.004, grime: 0, seg: lod ? 1 : 2 }).translate(0, base + 1.12, pz));
    // The spout: a block standing out of the pillar's face, the lead nozzle in it.
    stone.push(block(0.16, 0.14, 0.12, { bevel: 0.02, seed: seed + 5, wobble: 0.003, grime: 0, seg: 1 }).translate(0, L.spoutY - 0.08, L.z0 + 0.04));
    const noz = new CylinderGeometry(0.02, 0.022, 0.12, lod ? 8 : 14);
    noz.rotateX(D(90));
    noz.translate(0, L.spoutY, L.z0 + 0.12);
    extra.leads.push(boxUV(tintGeometry(noz)));
  } else if (tier === 2) {
    // A step of limestone blocks round the tank, wider in front.
    stone.push(...flags(-1.25, 1.25, -0.8, 1.2, base, seed + 1, { rowW: 0.5, lod, minL: 0.55, maxL: 0.95, bevel: 0.025, tone: 0.08 }));
    tank = slabTank(L, base, seed + 2, lod);
    stone.push(...tank.stone);
    metal.push(...tank.iron);
    // The pillar, moulded at foot and cap.
    const pz = L.z0 - 0.17;
    const n = lod ? 2 : 5;
    const pillar = frameSweep(profileOf([
      [0.05, 0], [0.05, 0.08], { arc: [0.03, 0.1, 0.02, D(-90), D(90)], n }, [0.0, 0.14], [0.0, 1.06],
      { arc: [0.02, 1.08, 0.02, D(-90), D(0)], n }, [0.045, 1.1], [0.045, 1.16], [0.03, 1.18], [-0.15, 1.18],
    ]), 0.19, 0.15, { tint: (p) => 0.7 + 0.3 * smoothstep(0, 0.35, p.y) });
    pillar.translate(0, base, pz);
    stone.push(pillar);
    // The head on the pillar's face, the water out of its mouth.
    const head = reliefHead(0.115, 'mask', lod, seed + 7);
    head.translate(0, L.spoutY + 0.04, L.z0 - 0.02 + 0.003);
    if (lod < 2) stone.push(head);
    const noz = new CylinderGeometry(0.016, 0.019, 0.1, lod ? 8 : 14);
    noz.rotateX(D(90));
    noz.translate(0, L.spoutY, L.z0 + 0.05);
    bronzes.push(boxUV(tintGeometry(noz)));
  } else if (tier === 3) {
    // Fine paving: marble flags in courses inside a travertine kerb.
    const k = 0.16;
    const paveH = 0.05;
    extra.trav.push(...[
      [-1.6, 1.6, -1.45, -1.45 + k], [-1.6, 1.6, 1.45 - k, 1.45], [-1.6, -1.6 + k, -1.45 + k, 1.45 - k], [1.6 - k, 1.6, -1.45 + k, 1.45 - k],
    ].map(([x0, x1, z0, z1], i) => block(x1 - x0 - 0.008, paveH + 0.03, z1 - z0 - 0.008, { bevel: 0.02, seed: seed + 40 + i, wobble: 0.003, grime: 0.4, seg: lod ? 1 : 2 }).translate((x0 + x1) / 2, 0, (z0 + z1) / 2)));
    stone.push(...flags(-1.6 + k, 1.6 - k, -1.45 + k, 1.45 - k, paveH, seed + 1, { rowW: 0.42, lod, minL: 0.5, maxL: 0.8, bevel: 0.01, tone: 0.05, grime: 0.15 }));
    // The plinth under the basin, and the basin.
    stone.push(block(L.x1 - L.x0 + 0.22, base - paveH, L.z1 - L.z0 + 0.22, { bevel: 0.02, seed: seed + 3, wobble: 0.002, grime: 0.3, seg: lod ? 1 : 2 }).translate(0, paveH, (L.z0 + L.z1) / 2));
    tank = mouldedBasin(L, base, lod);
    stone.push(...tank.stone);
    // The fluted column behind the basin, a bronze lion's head on it.
    const r = 0.16;
    const cz = L.z0 - r - 0.02;
    const colH = 1.42;
    const shaft = fluted(r, colH - r * 1.3, lod);
    shaft.translate(0, base + r * 0.72, cz);
    stone.push(shaft);
    for (const g of baseAndCapital(r, colH, lod)) stone.push(g.translate(0, base, cz));
    const lion = reliefHead(0.1, 'lion', lod, seed + 8);
    lion.translate(0, L.spoutY + 0.03, cz + r * 0.86);
    if (lod < 2) bronzes.push(lion);
    const noz = new CylinderGeometry(0.014, 0.017, 0.16, lod ? 8 : 14);
    noz.rotateX(D(90));
    noz.translate(0, L.spoutY, cz + r + 0.06);
    bronzes.push(boxUV(tintGeometry(noz)));
  } else {
    // ---- the nymphaeum ----
    const s1 = 0.12;
    // The nymph's hydria: held at her right shoulder, tipped forward, pouring (its mouth is where the water leaves).
    // (Her raised left hand, figure.js `reach`, holds it: the hand at about (0.11, 0.69, 0.13) of her base.)
    const axis = new Vector3(0, Math.cos(D(112)), Math.sin(D(112)));
    const hand = new Vector3(0.114, 0.98 + 0.08 + 0.69, -1.18 - 0.12 + 0.13);
    jarFoot = hand.clone().addScaledVector(axis, -0.1).add(new Vector3(0, 0.05, 0));
    jarMouth = jarFoot.clone().addScaledVector(axis, 0.31 * JAR);
    stone.push(...flags(-1.8, 1.8, -1.7, 1.6, s1, seed + 1, { rowW: 0.55, lod, minL: 0.6, maxL: 1.0, bevel: 0.015, tone: 0.05, grime: 0.25 }));
    stone.push(...flags(-1.55, 1.55, -1.6, 1.3, s1, seed + 2, { rowW: 0.5, lod, minL: 0.6, maxL: 1.0, bevel: 0.015, tone: 0.05, grime: 0.15 }).map((g) => g.translate(0, s1, 0)));
    // The back wall, faced in marble, with an apsed niche in its middle.
    const wz0 = -1.6;
    const wz1 = -1.18;
    const wallTop = 2.55;
    const nicheR = 0.36;
    const sill = 0.98;
    const spring = sill + 0.74;
    const wall = (x0, x1, y0, y1, s) => block(x1 - x0, y1 - y0, wz1 - wz0, { bevel: 0.012, seed: seed + s, wobble: 0.002, grime: 0.25, seg: 1, tone: 0.04 }).translate((x0 + x1) / 2, y0, (wz0 + wz1) / 2);
    // (The wall is stuccoed and painted Pompeian red, as garden nymphaea were: the marble stands out against it.)
    extra.stucco.push(wall(-1.35, -nicheR, base, wallTop, 50), wall(nicheR, 1.35, base, wallTop, 51));
    extra.stucco.push(wall(-nicheR, nicheR, base, sill, 52), wall(-nicheR, nicheR, spring + nicheR + 0.02, wallTop, 53));
    // A marble coping along the wall's top.
    stone.push(block(2.78, 0.07, wz1 - wz0 + 0.08, { bevel: 0.015, seed: seed + 54, wobble: 0.002, grime: 0, seg: 1 }).translate(0, wallTop, (wz0 + wz1) / 2));
    // The niche: a half cylinder and a half dome, inside out, lined with blue glass mosaic; a shell in the dome.
    const ns = lod ? 10 : 28;
    const apse = new CylinderGeometry(nicheR, nicheR, spring - sill, ns, 1, true, -Math.PI / 2, Math.PI);
    apse.rotateY(Math.PI);
    apse.translate(0, (sill + spring) / 2, wz1);
    const dome = new SphereGeometry(nicheR, ns, lod ? 4 : 10, 0, Math.PI, 0, Math.PI / 2);
    dome.rotateY(Math.PI);
    dome.translate(0, spring, wz1);
    for (const g of [apse, dome]) insideOut(g);
    boxUV(apse);
    boxUV(dome);
    // Mosaic speckle and the shell's ribs as light and dark in the vertex colour.
    tintGeometry(apse, (x, y) => 0.8 + 0.2 * Math.sin(x * 90) * Math.sin(y * 80));
    tintGeometry(dome, (x, y, z) => {
      const a = Math.atan2(y - spring, x);
      return 0.75 + 0.35 * Math.abs(Math.cos(a * 7)) * smoothstep(spring, spring + 0.1, y);
    });
    extra.mosaic.push(apse, dome);
    // The niche's frame: a marble arch moulding.
    if (lod < 2) {
      const arch = tube(Array.from({ length: 13 }, (_, k) => {
        const a = Math.PI - (k / 12) * Math.PI;
        return [Math.cos(a) * (nicheR + 0.035), spring + Math.sin(a) * (nicheR + 0.035), wz1 + 0.02];
      }), 0.03, { radial: lod ? 5 : 8, around: 0.2 });
      stone.push(arch);
      // The sill projects as a shelf over the basin.
      stone.push(block(nicheR * 2 + 0.16, 0.06, 0.24, { bevel: 0.012, seed: seed + 55, wobble: 0.001, grime: 0.1, seg: 1 }).translate(0, sill - 0.04, wz1 + 0.06));
    }
    // Columns either side of the niche, standing forward of the wall, on pedestals.
    const r = 0.1;
    const cxs = [-0.98, 0.98];
    const cz = wz1 + 0.2;
    const ped = 0.42;
    const colH = 1.78;
    for (const [i, x] of cxs.entries()) {
      stone.push(block(0.3, ped - base, 0.3, { bevel: 0.012, seed: seed + 60 + i, wobble: 0.001, grime: 0.3, seg: 1 }).translate(x, base, cz));
      const shaft = fluted(r, colH - r * 1.3, lod, 16);
      shaft.translate(x, ped + r * 0.72, cz);
      stone.push(shaft);
      for (const g of baseAndCapital(r, colH, lod)) stone.push(g.translate(x, ped, cz));
    }
    // The entablature over the columns, and the pediment.
    const eTop = ped + colH;
    const ent = frameSweep(profileOf([
      [0, 0], [0, 0.16], [0.02, 0.17], { arc: [0.02, 0.2, 0.03, D(-90), D(0)], n: lod ? 2 : 5 }, [0.06, 0.23], [0.06, 0.26], [-0.2, 0.26],
    ]), 1.22, 0.16);
    ent.translate(0, eTop, cz - 0.04);
    stone.push(ent);
    const pedH = 0.32;
    const tri = new BufferGeometry();
    const hw = 1.26;
    const z0 = cz - 0.18;
    const z1 = cz + 0.17;
    const y0 = eTop + 0.26;
    tri.setAttribute('position', new Float32BufferAttribute([
      -hw, y0, z1, hw, y0, z1, 0, y0 + pedH, z1, // front
      hw, y0, z0, -hw, y0, z0, 0, y0 + pedH, z0, // back
      -hw, y0, z0, -hw, y0, z1, 0, y0 + pedH, z1, -hw, y0, z0, 0, y0 + pedH, z1, 0, y0 + pedH, z0, // left slope
      hw, y0, z1, hw, y0, z0, 0, y0 + pedH, z0, hw, y0, z1, 0, y0 + pedH, z0, 0, y0 + pedH, z1, // right slope
    ], 3));
    tri.computeVertexNormals();
    boxUV(tri);
    stone.push(tintGeometry(tri));
    // A disc (a clipeus) in the pediment's field.
    if (lod < 2) {
      const disc = new CylinderGeometry(0.08, 0.08, 0.03, lod ? 10 : 24);
      disc.rotateX(D(90));
      disc.translate(0, y0 + pedH * 0.4, z1 + 0.012);
      bronzes.push(boxUV(tintGeometry(disc)));
    }
    // The basin in front of the wall: moulded, no foot (it stands on the platform).
    tank = mouldedBasin(L, base, lod, { foot: true });
    stone.push(...tank.stone);
    // The spandrels: the wall's face between the niche's arch and the block over it.
    {
      const n = lod ? 6 : 16;
      const sp = [];
      const yTop = spring + nicheR + 0.02;
      for (let k = 0; k < n; k++) {
        const a0 = Math.PI - (k / n) * Math.PI;
        const a1 = Math.PI - ((k + 1) / n) * Math.PI;
        const [xa, ya] = [Math.cos(a0) * nicheR, spring + Math.sin(a0) * nicheR];
        const [xb, yb] = [Math.cos(a1) * nicheR, spring + Math.sin(a1) * nicheR];
        sp.push(xa, ya, wz1, xb, yb, wz1, xb, yTop, wz1, xa, ya, wz1, xb, yTop, wz1, xa, yTop, wz1);
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(sp, 3));
      g.computeVertexNormals();
      boxUV(g);
      extra.stucco.push(tintGeometry(g));
    }
    // The nymph on a low plinth in the niche, a hydria on her shoulder pouring.
    if (lod < 2) {
      stone.push(block(0.36, 0.08, 0.26, { bevel: 0.01, seed: seed + 80, wobble: 0.001, grime: 0.1, seg: 1 }).translate(0, sill, wz1 - 0.12));
      const fig = buildFigure({ long: true, reach: 0.6 });
      const scale = 0.52;
      fig.scale.setScalar(scale);
      fig.position.set(0, sill + 0.08, wz1 - 0.12);
      fig.updateMatrixWorld(true);
      fig.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
        stone.push(g);
      });
      const jar = hydria(lod);
      jar.scale(JAR, JAR, JAR);
      jar.rotateX(D(112));
      jar.translate(jarFoot.x, jarFoot.y, jarFoot.z);
      stone.push(jar);
    }
    // Clipped box in pots at the front corners of the upper step.
    for (const [i, x] of [[0, -1.3], [1, 1.3]]) {
      const b = pottedBox(x, base, 0.95, seed + 90 + i, lod);
      extra.terracotta.push(b.pot);
      extra.leaf.push(b.leaf);
      extra.soil.push(b.soil);
    }
  }

  // ---- the water ----------------------------------------------------------------------
  const ix0 = L.x0 + L.T;
  const ix1 = L.x1 - L.T;
  const iz0 = L.z0 + L.T;
  const iz1 = L.z1 - L.T;
  const surface = new BufferGeometry();
  surface.setAttribute('position', new Float32BufferAttribute([ix0, waterY, iz1, ix1, waterY, iz1, ix1, waterY, iz0, ix0, waterY, iz0], 3));
  surface.setIndex([0, 1, 2, 0, 2, 3]);
  surface.computeVertexNormals();
  boxUV(surface);
  add(tintGeometry(surface), waterMaterial(), 'water', 'full', false);
  // Where the spout's water lands: the stream, then rings and foam.
  let pts;
  if (tier === 4) {
    // From the hydria's mouth.
    pts = streamPath(jarMouth.x, jarMouth.y, jarMouth.z, [0, 1], 0.6, D(25), waterY, lod ? 6 : 12);
  } else {
    const zMouth = tier === 3 ? L.z0 - 0.02 + 0.14 : tier === 2 ? L.z0 + 0.1 : L.z0 + 0.18;
    pts = streamPath(0, L.spoutY, zMouth, [0, 1], 0.95 + L.reach, D(8), waterY, lod ? 6 : 12);
  }
  const land = pts[pts.length - 1];
  add(streamTube(pts, tier === 4 ? 0.018 : 0.017, 0.012, lod), streamMaterial(), 'stream', 'flow', false);
  if (lod < 2) {
    add(ripples(land[0], waterY + 0.002, land[2], 0.012, 0.3, lod), ringMaterial(), 'rings', 'flow', false);
    add(blob(land[0], waterY + 0.004, land[2], 0.07, seed + 11, { seg: 12, wav: 0.4, fade: true }), material('foam', { color: 0xf2f4f2, roughness: 0.6, opacity: 0.8, snow: 0, wet: 0 }), 'foam', 'flow', false);
  }
  // Over the lip at the notch and away down the street.
  const face = L.z1;
  add(sheet(L.notch, waterY, top - BRIM + 0.008, iz1, face, 0.07, L.floor, L.spread, lod, 0.004), streamMaterial(true), 'sheet', 'flow', false);
  // The stone it runs over, darkened and glossy with wet, a little wider than the water.
  const wetMat = material('wet-stain', { color: 0x1a1612, roughness: 0.2, opacity: 0.5, snow: 0, wet: 0 });
  add(sheet(L.notch, waterY, top - BRIM + 0.008, iz1, face, 0.12, L.floor, L.spread, lod, 0.001), wetMat, 'wet-face', 'flow', false);
  if (lod < 2) {
    add(blob(L.notch, L.stainY, face + 0.12 + L.spread * 0.6, 0.32, seed + 12, { sx: 0.8, sz: 1.3, wav: 0.35, fade: true }), wetMat, 'wet', 'flow', false);
  }
  // Dry: green water left on the tank's floor, a pale lime stain where the overflow ran.
  add(blob((ix0 + ix1) / 2 + 0.1, tank.floorY + 0.012, (iz0 + iz1) / 2, Math.min(ix1 - ix0, iz1 - iz0) * 0.32, seed + 13, { sx: 1.4, sz: 0.9, wav: 0.3 }), stagnantMaterial(), 'puddle', 'dry', false);
  if (lod < 2) {
    const lime = material('lime-stain', { color: 0xe8e2d0, roughness: 0.9, opacity: 0.4, snow: 0, wet: 0 });
    add([
      blob(L.notch, L.stainY, face + 0.1 + L.spread * 0.5, 0.25, seed + 14, { sx: 0.7, sz: 1.1, wav: 0.4, fade: true }),
      // A streak down the front face under the notch.
      (() => {
        const g = new BufferGeometry();
        const x = L.notch;
        const y1 = top - BRIM;
        g.setAttribute('position', new Float32BufferAttribute([x - 0.05, y1, face + 0.004, x + 0.05, y1, face + 0.004, x + 0.09, L.floor + 0.01, face + 0.004, x - 0.08, L.floor + 0.01, face + 0.004], 3));
        g.setIndex([0, 2, 1, 0, 3, 2]);
        g.computeVertexNormals();
        boxUV(g);
        // (Strongest under the lip, fading toward the foot; RGBA as the stain's other parts.)
        g.setAttribute('color', new Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.25, 1, 1, 1, 0.25], 4));
        return g;
      })(),
    ], lime, 'lime', 'dry', false);
  }
  // Running water in a hard frost: icicles on the lip under the notch.
  if (lod < 2) add(icicles(L.notch - 0.06, L.notch + 0.06, top - BRIM, face + 0.006, seed + 15, 6), iceMaterial(), 'icicles', 'ice', false);

  // ---- merged by material -------------------------------------------------------------
  add(stone, stoneMat, 'stone');
  add(metal, ironM, 'iron');
  add(bronzes, bronze, 'bronze');
  add(extra.leads, lead, 'lead');
  add(extra.trav, trav, 'kerb');
  add(extra.lime, lime, 'limestone');
  add(extra.stucco, material('stucco-red', { surface: 'plaster', color: 0xc0644a, vertexColors: true, snow: 1 }), 'stucco');
  add(extra.mosaic, material('mosaic', { color: 0x2a5d8f, roughness: 0.25, metalness: 0, snow: 0.2 }), 'mosaic');
  add(extra.terracotta, material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 1 }), 'pots');
  add(extra.leaf, material('box-leaves', { color: 0x3c5a2a, roughness: 0.85, snow: 0.9 }), 'box');
  add(extra.soil, material('pot-soil', { color: 0x2c2118, roughness: 1, snow: 0.8 }), 'soil', 'always', false);
  // The lead pipe that feeds it (tiers 1 to 3), up the back of the pillar from under the street.
  if (tier < 4 && lod < 2) {
    const pz = tier === 3 ? L.z0 - 0.34 : L.z0 - (tier === 1 ? 0.33 : 0.34);
    const pipe = tube([[0.12, -0.05, pz - 0.05], [0.12, 0.05, pz - 0.035], [0.12, 0.6, pz - 0.03], [0.1, 0.9, pz + 0.01]], 0.035, { radial: lod ? 6 : 10, around: 0.22 });
    add(pipe, lead, 'pipe');
  }

  let tris = 0;
  for (const m of meshes) tris += triangles(m.geometry);
  const spout = new Vector3(pts[0][0], pts[0][1], pts[0][2]);
  return { group, meshes, triangles: tris, spout, tier, lod, waterY, layout: L };
}

/**
 * Show what a state shows (FOUNTAIN_STATES: 'flowing', 'still' or 'dry'),
 * and the icicles when it runs in a hard frost (`ice`).
 */
export function setFountainState(f, state = 'flowing', ice = false) {
  const show = FOUNTAIN_STATES[state] || FOUNTAIN_STATES.flowing;
  for (const m of f.meshes) {
    const w = m.userData.when;
    m.visible = w === 'ice' ? ice && state === 'flowing' : show.includes(w);
  }
}

/**
 * The fountains' life (visual only, every fountain at once: the materials
 * are shared): the stream and the sheet run, the rings spread.
 */
export function fountainLife(t) {
  const s = streamMaterial();
  // Along the stream: about 1.5 m/s at the texture's 1.2 m repeat.
  s.normalMap.offset.set(-t * 1.3, t * 0.05);
  const r = ringMaterial();
  r.normalMap.offset.set(t * 0.01, -t * 0.22);
}
