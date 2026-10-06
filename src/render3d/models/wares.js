/**
 * models/wares.js
 * ----------------------------------------------------------------------------
 * The goods as the 3D look shows them: what a warehouse (Horreum) stacks
 * in its court and what a market (Macellum) lays out on its counters, one
 * look a good, so the eye can tell wine from oil from timber at the game's
 * zoom by shape and colour as well as by heap.
 *
 *   buildLoad(good, lod)     one cart load (100 units) as a warehouse
 *                            stacks it on a square metre of its court:
 *                            amphorae of wine (the slender Dressel 2-4 of
 *                            Italy) or oil (the globular Dressel 20 of
 *                            Baetica), sacks of grain, baskets of fruit,
 *                            olives, grapes, vegetables and fish, a pile of
 *                            logs, iron bars on skids, a marble block, a
 *                            heap of clay, bundles of flax, bolts of linen,
 *                            folded clothes, red-gloss pottery in straw,
 *                            furniture, shields and pila, arrows in crates,
 *                            barrels of salt meat
 *   buildDisplay(good, lod)  a market stall's spot: what is on its counter
 *                            and on the ground before it, in three steps of
 *                            fullness (the meshes tagged fill1, fill2 and
 *                            fill3: a spot two thirds full shows the first
 *                            two), as the Pompeian paintings of the forum's
 *                            market show it: produce in baskets and
 *                            pyramids, a measure (modius) by the sacks,
 *                            joints hanging from the beam, jars standing
 *                            before the counter, cloth hung up and folded
 *
 * A load stands on y = 0 in its square metre (-0.48..0.48); a display's
 * spot is a counter 1.5 m long centred on x = 0, its front toward +z at
 * z = 0.3, its top at DISPLAY.top; the vendor stands behind it (-z).
 * Meshes are merged by material (and fill tag): one draw call each.
 * Levels of detail: 0 close, 1 the round things coarser and the small
 * things fewer, 2 a block or two of the good's colour.
 * ----------------------------------------------------------------------------
 */

import {
  Group, Mesh, CylinderGeometry, IcosahedronGeometry, SphereGeometry, Float32BufferAttribute,
} from 'three';
import { revolve, profileOf, block, merge, tintGeometry, boxUV, tube } from '../shapes.js';
import { material } from '../materials.js';
import { slab } from './masonry.js';
import { artRng, smoothstep } from '../texgen.js';

/** A market counter's spot (metres): its length, depth and the height of its top (the marble slab's). */
export const DISPLAY = Object.freeze({ len: 1.5, depth: 0.6, top: 1.0, front: 0.3 });

/** Every good a warehouse or a market shows (data/goods.js, but horses). */
export const WARE_GOODS = Object.freeze([
  'wheat', 'vegetables', 'fruit', 'meat', 'fish', 'clay', 'timber', 'olives', 'grapes', 'iron', 'marble', 'flax', 'linen',
  'pottery', 'furniture', 'oil', 'wine', 'weapons', 'arrows', 'clothing',
]);

/**
 * Linear RGB of an sRGB hex, for vertex colours (they multiply linear
 * light), by hand: three's Color would depend on whether its colour
 * management is on, which the game switches while building kits.
 */
function srgb(hex) {
  const f = (x) => {
    const v = x / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
}

/** The goods' materials, shared by key (one program: materials.js). */
export function wareMaterials() {
  return {
    terracotta: material('terracotta', { surface: 'terracotta', vertexColors: true, snow: 1 }),
    sigillata: material('sigillata', { surface: 'terracotta', color: 0xf0a080, rough: 0.55, vertexColors: true, snow: 0.8 }),
    wood: material('wood', { surface: 'wood', vertexColors: true, snow: 1 }),
    burlap: material('burlap', { surface: 'wool', color: 0xb99c6c, vertexColors: true, snow: 1 }),
    wicker: material('wicker', { surface: 'rope', color: 0xd9b67a, vertexColors: true, snow: 1 }),
    cloth: material('cloth-dyed', { surface: 'wool', vertexColors: true, snow: 0.7 }),
    iron: material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 }),
    marble: material('marble', { surface: 'marble', vertexColors: true, snow: 1 }),
    bronze: material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }),
    clay: material('raw-clay', { surface: 'earth', color: 0xe0a27a, vertexColors: true, snow: 1 }),
    straw: material('straw', { surface: 'rope', color: 0xf0dc98, vertexColors: true, snow: 1 }),
    produce: material('produce', { color: 0xffffff, roughness: 0.55, vertexColors: true, snow: 0.6 }),
    grain: material('grain', { color: 0xd8b258, roughness: 0.95, vertexColors: true, snow: 0.8 }),
    meat: material('meat', { color: 0xffffff, roughness: 0.45, vertexColors: true, snow: 0.4 }),
    fish: material('fish', { color: 0xffffff, roughness: 0.35, metalness: 0.35, vertexColors: true, snow: 0.4 }),
    paint: material('paint', { color: 0xffffff, roughness: 0.6, vertexColors: true, snow: 0.8 }),
    // The goods from the middle zooms out: plain, coloured by vertex (Bin.group).
    far: material('ware-far', { color: 0xffffff, roughness: 0.75, vertexColors: true, snow: 0.8 }),
  };
}

// ---------------------------------------------------------------------------
// Pieces (each a geometry on y = 0, centred on x and z unless said)
// ---------------------------------------------------------------------------

const seg = (lod, a, b, c) => (lod === 2 ? c : lod ? b : a);
const D = (deg) => (deg * Math.PI) / 180;

/** A colour or a shade for tintGeometry: a number (grey) or a linear RGB from an sRGB hex. */
const hue = (hex, k = 1) => srgb(hex).map((v) => v * k);

/** An amphora: 'wine' (Dressel 2-4, 1 m), 'oil' (Dressel 20, globular, 0.72 m) or 'jug' (a table jug, 0.26 m). */
function amphora(kind, lod, tone = 1) {
  let P;
  let handles = [];
  if (kind === 'oil') {
    P = [[0, 0], [0.03, 0], [0.045, 0.03], [0.17, 0.09], [0.26, 0.2], [0.29, 0.33], [0.27, 0.46], [0.2, 0.56], [0.085, 0.6], [0.065, 0.66], [0.078, 0.7], [0.06, 0.72], [0, 0.71]];
    handles = [[0.08, 0.66], [0.17, 0.66], [0.2, 0.58]];
  } else if (kind === 'jug') {
    P = [[0, 0], [0.045, 0], [0.05, 0.02], [0.085, 0.09], [0.08, 0.15], [0.045, 0.2], [0.035, 0.23], [0.05, 0.26], [0, 0.255]];
    handles = [[0.04, 0.22], [0.095, 0.2], [0.075, 0.12]];
  } else {
    P = [[0, 0], [0.025, 0], [0.03, 0.04], [0.03, 0.1], [0.07, 0.2], [0.13, 0.35], [0.15, 0.5], [0.145, 0.62], [0.12, 0.72], [0.08, 0.77], [0.055, 0.8], [0.05, 0.95], [0.06, 0.99], [0.045, 1.0], [0, 0.98]];
    handles = [[0.055, 0.92], [0.1, 0.94], [0.11, 0.86], [0.12, 0.74]];
  }
  if (lod === 2) P = P.filter((_, i) => i % 2 === 0 || i === P.length - 1);
  const top = P[P.length - 2][1];
  const body = revolve(profileOf(P), { segments: seg(lod, 12, 7, 4), metres: 0.6, tint: (p) => tone * (0.72 + 0.28 * smoothstep(0, top * 0.35, p.y)) });
  if (lod > 0 || !handles.length) return body;
  const parts = [body];
  for (const s of (kind === 'jug' ? [1] : [-1, 1])) {
    parts.push(tube(handles.map(([x, y]) => [s * x, y, 0]), kind === 'jug' ? 0.008 : 0.014, { radial: 4, segments: 5, around: 0.6 }));
  }
  return merge(parts);
}

/** A sack of grain or of whatever, 0.6 x 0.36 x 0.42, slumped; `tone` its own shade. */
function sack(lod, seed, w = 0.6, h = 0.36, d = 0.42) {
  if (lod === 2) return slab(w, h, d, { bevel: 0.06, seed, wobble: 0, tone: 0.08, grime: 0.1 });
  return block(w, h, d, { bevel: Math.min(h, d) * 0.42, seed, wobble: 0.03, grime: 0.15, seg: lod ? 1 : 2, tone: 0.08, topSag: 0.05 });
}

/** A round wicker basket 0.5 m across, open (its contents sit at y ~ 0.22). */
function basket(lod, r = 0.25, h = 0.26) {
  return revolve(profileOf([
    [0, 0.01], [r * 0.78, 0.0], [r * 0.92, 0.04], [r, h * 0.85], [r * 1.04, h], [r * 0.96, h], [r * 0.9, h * 0.85], [r * 0.82, 0.06], [0, 0.05],
  ]), { segments: seg(lod, 16, 9, 6), metres: 0.06 * 8, tint: (p) => 0.8 + 0.2 * smoothstep(0, h, p.y) });
}

/**
 * A heap of round things (fruit, olives, grapes, cabbages, fish in a
 * basket), r across at y0, as one lumpy dome; `bump` how big each thing
 * is (relative), its colours mixed by `colours` (linear RGB list) per lump.
 */
function heap(lod, r, y0, h, colours, seed, bump = 0.18) {
  const rnd = artRng(seed);
  const g = new SphereGeometry(r, seg(lod, 18, 10, 6), seg(lod, 8, 5, 3), 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  // Lumps: seeded points on the dome; each vertex takes the colour of the nearest.
  const lumps = Array.from({ length: 40 }, () => {
    const a = rnd() * Math.PI * 2;
    const e = Math.asin(rnd());
    return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e), colours[Math.floor(rnd() * colours.length)]];
  });
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / r;
    const y = pos.getY(i) / r;
    const z = pos.getZ(i) / r;
    let best = 9;
    let c = colours[0];
    let second = 9;
    for (const [lx, ly, lz, lc] of lumps) {
      const dd = (x - lx) ** 2 + (y - ly) ** 2 + (z - lz) ** 2;
      if (dd < best) {
        second = best;
        best = dd;
        c = lc;
      } else if (dd < second) second = dd;
    }
    // Round lumps: high in the middle of each, a crease where two meet.
    const k = 1 + bump * (Math.sqrt(second) - Math.sqrt(best)) - bump * 0.3;
    pos.setXYZ(i, x * r * k, y0 + y * h * k, z * r * k);
    const sh = 0.75 + 0.25 * Math.min(1, (Math.sqrt(second) - Math.sqrt(best)) * 3);
    col[i * 3] = c[0] * sh;
    col[i * 3 + 1] = c[1] * sh;
    col[i * 3 + 2] = c[2] * sh;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  boxUV(g);
  return g;
}

/** Little round things one by one (fruit on a counter): `n` balls of radius r about (x, y, z), heaped. */
function balls(lod, n, r, x, y, z, colours, seed, spread = 0.12) {
  const rnd = artRng(seed);
  const out = [];
  for (let k = 0; k < n; k++) {
    const g = new IcosahedronGeometry(r * (0.85 + rnd() * 0.3), lod ? 0 : 1);
    const ring = k < 6 ? 0 : 1;
    const a = rnd() * Math.PI * 2;
    const d = ring ? rnd() * spread * 0.4 : spread * (0.4 + rnd() * 0.6);
    g.translate(x + Math.cos(a) * d, y + r + ring * r * 1.4, z + Math.sin(a) * d);
    const c = colours[Math.floor(rnd() * colours.length)];
    out.push(tintGeometry(boxUV(g), () => c));
  }
  return out;
}

/** A log lying along x, `len` long, radius r: bark dark, its cut ends pale. */
function log(lod, len, r, seed) {
  const rnd = artRng(seed);
  const g = new CylinderGeometry(r * (0.9 + rnd() * 0.1), r, len, seg(lod, 9, 6, 5), 1);
  g.rotateZ(Math.PI / 2);
  boxUV(g, rnd() * 2, rnd() * 2);
  return tintGeometry(g, (x) => (Math.abs(Math.abs(x) - len / 2) < 1e-4 ? 1.15 : 0.45 + rnd() * 0.08));
}

/** A wooden crate w x h x d, its slats shaded in bands, open on top (`lid`: closed). */
function crate(lod, w, h, d, seed, lid = false) {
  const g = lod === 2
    ? slab(w, h, d, { bevel: 0.01, seed, wobble: 0, tone: 0.05, grime: 0.1 })
    : block(w, h, d, { bevel: 0.012, seed, wobble: 0.004, grime: 0.15, seg: 1, tone: 0.08 });
  // Slats: darker lines every 12 cm up its sides.
  return tintGeometry(g, (x, y) => {
    const band = Math.abs(((y / 0.12) % 1) - 0.5) > 0.44 ? 0.55 : 1;
    const t = lid || y < h - 0.01 ? 1 : 0.7;
    return band * t * (0.85 + 0.15 * smoothstep(0, h, y));
  });
}

/** A stack of red-gloss bowls nested (terra sigillata), n high, its foot at y 0. */
function bowlStack(lod, n, r = 0.11) {
  const P = [[0, 0], [r * 0.45, 0]];
  for (let k = 0; k < n; k++) {
    const y = 0.02 + k * 0.035;
    P.push([r * 0.5, y], [r * 0.95, y + 0.03], [r, y + 0.04]);
  }
  P.push([r * 0.85, 0.02 + n * 0.035 + 0.01], [0, 0.02 + n * 0.035]);
  return revolve(profileOf(P), { segments: seg(lod, 14, 8, 5), metres: 0.6 });
}

/** A stack of plates, n high, radius r. */
function plateStack(lod, n, r = 0.14) {
  const P = [[0, 0], [r * 0.6, 0]];
  for (let k = 0; k < n; k++) P.push([r * 0.98, 0.006 + k * 0.016], [r, 0.014 + k * 0.016]);
  P.push([r * 0.7, n * 0.016 + 0.002], [0, n * 0.016]);
  return revolve(profileOf(P), { segments: seg(lod, 16, 9, 5), metres: 0.6 });
}

/** A bundle of long things (flax, pila, arrows) along x: a waisted cylinder, tied. */
function bundle(lod, len, r, tie = 0.6) {
  const P = [];
  const n = lod ? 4 : 8;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const y = -len / 2 + len * t;
    // Splayed at the ends, pinched at the ties.
    const pinch = Math.exp(-(((t - 0.5) / 0.08) ** 2)) * (1 - tie);
    P.push([r * (0.92 + 0.15 * Math.abs(t - 0.5) * 2 - pinch * 0.4), y]);
  }
  const g = revolve(profileOf([[0, -len / 2], ...P, [0, len / 2]]), { segments: seg(lod, 8, 6, 4), metres: 0.06 * 4 });
  g.rotateZ(Math.PI / 2);
  return g;
}

/** A Roman shield (scutum): a curved board 1.05 x 0.65, its face toward +z, a boss; `colour` linear RGB. */
function shield(lod, colour) {
  const g = new CylinderGeometry(0.62, 0.62, 1.05, seg(lod, 8, 5, 3), 1, true, -0.55, 1.1);
  g.translate(0, 0, -0.62 + 0.04);
  boxUV(g);
  return tintGeometry(g, (x, y) => {
    // A pale edge binding and two painted bands: the rest the shield's colour.
    const edge = Math.abs(y) > 0.49 || Math.abs(x) > 0.3 ? 0.55 : 1;
    return colour.map((v) => v * edge);
  });
}

/** A modius (the grain measure): a wooden tub bound with iron bands. */
function modius(lod) {
  return revolve(profileOf([[0, 0], [0.13, 0], [0.13, 0.02], [0.115, 0.26], [0.12, 0.27], [0.105, 0.27], [0.1, 0.03], [0, 0.03]]), {
    segments: seg(lod, 12, 8, 5), metres: 1, tint: (p) => (Math.abs(p.y - 0.06) < 0.02 || Math.abs(p.y - 0.22) < 0.02 ? 0.35 : 0.9),
  });
}

/** A barrel 0.7 m tall: bellied staves, darker hoops. */
function barrel(lod) {
  const P = [[0, 0], [0.2, 0], [0.24, 0.12], [0.26, 0.35], [0.24, 0.58], [0.2, 0.7], [0, 0.7]];
  return revolve(profileOf(P), { segments: seg(lod, 12, 8, 5), metres: 1, tint: (p) => ([0.07, 0.2, 0.5, 0.63].some((y) => Math.abs(p.y - y) < 0.022) ? 0.32 : 0.85) });
}

/** A fish, 0.32 m, lying along x on y 0: a flattened spindle and a tail. */
export function fishPiece(lod, seed, len = 0.32) {
  const rnd = artRng(seed);
  const P = [[0, -len / 2], [0.025, -len * 0.42], [0.045, -len * 0.15], [0.04, len * 0.12], [0.02, len * 0.32], [0.008, len * 0.38], [0.03, len / 2], [0, len / 2]];
  const g = revolve(profileOf(P), { segments: seg(lod, 8, 5, 4), metres: 0.3, tint: (p) => (p.y > len * 0.3 ? 0.6 : 0.9 + rnd() * 0.15) });
  g.scale(1, 1, 0.55);
  g.rotateZ(Math.PI / 2);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0.022, 0);
  return g;
}

/** A joint of meat (a ham or a shoulder): a pear shape with a bone end; hangs from (0, 0, 0) downward if `hang`. */
function joint(lod, seed, hang = false) {
  const rnd = artRng(seed);
  const P = [[0, 0], [0.02, 0.0], [0.02, 0.06], [0.07, 0.12], [0.11, 0.22], [0.12, 0.3], [0.09, 0.37], [0, 0.39]];
  const meatC = hue(0x9e3a30);
  const fatC = hue(0xe6d2b4);
  const g = revolve(profileOf(P), {
    segments: seg(lod, 10, 6, 4), metres: 0.3,
    tint: (p) => (p.y < 0.07 ? fatC : p.y > 0.33 ? fatC.map((v) => v * 0.9) : meatC.map((v) => v * (0.85 + rnd() * 0.25))),
  });
  g.scale(1, 1, 0.8);
  if (hang) {
    g.rotateX(Math.PI);
    return g;
  }
  g.rotateZ(Math.PI / 2);
  g.translate(0, 0.1, 0);
  return g;
}

/** Cloth folded and stacked: n layers of w x d, each its own dye (linear RGB list). */
function foldedStack(lod, n, w, d, dyes, seed) {
  const rnd = artRng(seed);
  const out = [];
  let y = 0;
  for (let k = 0; k < n; k++) {
    const h = 0.05 + rnd() * 0.02;
    const g = lod === 2
      ? slab(w, h, d, { bevel: 0.01, seed: seed + k, wobble: 0, tone: 0, grime: 0 })
      : block(w * (0.95 + rnd() * 0.08), h, d * (0.95 + rnd() * 0.08), { bevel: h * 0.45, seed: seed + k, wobble: 0.01, grime: 0, seg: 1 });
    g.rotateY((rnd() - 0.5) * 0.12);
    g.translate(0, y, 0);
    const c = dyes[(k + seed) % dyes.length];
    out.push(tintGeometry(g, () => c));
    y += h;
  }
  return out;
}

/** A bolt of cloth lying along x: a roll, its end showing the turns as a darker spiral. */
function bolt(lod, len, r, dye) {
  const g = new CylinderGeometry(r, r, len, seg(lod, 12, 7, 5), 1);
  g.rotateZ(Math.PI / 2);
  boxUV(g);
  return tintGeometry(g, (x, y, z) => {
    if (Math.abs(Math.abs(x) - len / 2) < 1e-4) return dye.map((v) => v * (0.7 + 0.3 * Math.abs(Math.sin(Math.hypot(y, z) * 140))));
    return dye;
  });
}

/** A stool: a seat on four turned legs, 0.45 m. */
function stool(lod, seed) {
  const out = [slab(0.38, 0.05, 0.38, { bevel: 0.01, seed, wobble: 0.002, tone: 0.05, grime: 0 }).translate(0, 0.42, 0)];
  for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [0.15, 0.15], [-0.15, 0.15]]) {
    const l = new CylinderGeometry(0.02, 0.025, 0.42, seg(lod, 6, 4, 3));
    l.translate(x, 0.21, z);
    out.push(tintGeometry(boxUV(l), () => 0.8));
  }
  return out;
}

/** A small round three-legged table (a mensa delphica). */
function roundTable(lod, seed) {
  const top = new CylinderGeometry(0.3, 0.3, 0.04, seg(lod, 16, 10, 6));
  top.translate(0, 0.7, 0);
  const out = [tintGeometry(boxUV(top))];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + seed;
    // A leg curving out like an animal's (a straight one at a distance).
    out.push(tube([[Math.cos(a) * 0.15, 0.7, Math.sin(a) * 0.15], [Math.cos(a) * 0.2, 0.35, Math.sin(a) * 0.2], [Math.cos(a) * 0.24, 0.0, Math.sin(a) * 0.24]], 0.022, { radial: lod ? 4 : 6, segments: lod ? 3 : 6, around: 0.3 }));
  }
  return out;
}

/** A chest (arca): a box with a lid, iron bands across it; `w` long. */
function chest(lod, seed, w = 0.7, h = 0.45, d = 0.42) {
  const out = { wood: [], iron: [] };
  out.wood.push(lod === 2 ? slab(w, h, d, { bevel: 0.01, seed, wobble: 0, tone: 0, grime: 0.1 }) : block(w, h, d, { bevel: 0.015, seed, wobble: 0.002, grime: 0.15, seg: 1, tone: 0.05 }));
  if (lod < 2) {
    for (const x of [-w * 0.3, w * 0.3]) out.iron.push(slab(0.04, h + 0.012, d + 0.012, { bevel: 0.003, seed: seed + 3, wobble: 0, tone: 0, grime: 0 }).translate(x, -0.006, 0));
    out.iron.push(slab(0.08, 0.1, 0.02, { bevel: 0.004, seed: seed + 5, wobble: 0, tone: 0, grime: 0 }).translate(0, h - 0.16, d / 2 + 0.005));
  }
  return out;
}

// ---------------------------------------------------------------------------
// A group of meshes by material and fill tag
// ---------------------------------------------------------------------------

/**
 * Each material's own colour (linear RGB), as its textured surface averages
 * out: the far goods (Bin.group at a level of detail past 0) bake it into
 * their vertex colours on one plain material.
 */
const FAR_TONES = {
  terracotta: srgb(0xa85e3e), sigillata: srgb(0xc0603f), wood: srgb(0x7a5a3e), burlap: srgb(0xa8916a), wicker: srgb(0xb48e58),
  cloth: srgb(0xe2dccf), iron: srgb(0x50545a), marble: srgb(0xe6e2da), bronze: srgb(0x8a6a3c), clay: srgb(0xb47450),
  straw: srgb(0xd6c088), produce: [1, 1, 1], grain: srgb(0xd8b258), meat: [1, 1, 1], fish: srgb(0xc8ccce), paint: [1, 1, 1],
};

/** Collects geometries by material key and tag, then makes one mesh of each. */
class Bin {
  constructor(name) {
    this.name = name;
    this.lists = new Map();
  }

  add(mat, geos, when = 'always') {
    const k = `${mat}|${when}`;
    if (!this.lists.has(k)) this.lists.set(k, { mat, when, geos: [] });
    const l = this.lists.get(k).geos;
    for (const g of [].concat(geos)) if (g) l.push(g);
    return this;
  }

  /**
   * The meshes, one a material and tag; with `step` (1 to 3) only what that
   * step of fullness shows, one mesh a material (the game's kits: a draw
   * call a material, not one for each step's share of it).
   */
  group(mats, step = 0, lod = 0) {
    const group = new Group();
    group.name = this.name;
    const meshes = [];
    let lists = [...this.lists.values()];
    if (lod > 0) {
      // From the middle zooms out a jar's grain or a sack's weave is under a pixel: the whole good is
      // one mesh in one plain material, each part's colour baked into its vertices (one draw a good).
      const all = [];
      for (const l of lists) {
        if (step && !displayShows(l.when, step)) continue;
        const base = FAR_TONES[l.mat] || [1, 1, 1];
        for (const g of l.geos) {
          if (!g.attributes.color) tintGeometry(g);
          const c = g.attributes.color;
          for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * base[0], c.getY(i) * base[1], c.getZ(i) * base[2]);
          all.push(g);
        }
      }
      lists = all.length ? [{ mat: 'far', when: 'always', geos: all }] : [];
    } else if (step) {
      const byMat = new Map();
      for (const l of lists) {
        if (!displayShows(l.when, step)) continue;
        if (!byMat.has(l.mat)) byMat.set(l.mat, { mat: l.mat, when: 'always', geos: [] });
        byMat.get(l.mat).geos.push(...l.geos);
      }
      lists = [...byMat.values()];
    }
    for (const { mat, when, geos } of lists) {
      if (!geos.length) continue;
      const m = new Mesh(merge(geos), mats[mat]);
      m.name = `${this.name}-${mat}`;
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.when = when;
      group.add(m);
      meshes.push(m);
    }
    return { group, meshes };
  }
}

/** Place a geometry: turned `ry` about y, then moved. */
const at = (g, x, y, z, ry = 0) => {
  if (ry) g.rotateY(ry);
  return g.translate(x, y, z);
};

// Colours (linear RGB) of things coloured by vertex.
const C = {
  apple: hue(0xb83a26), apple2: hue(0xd8902e), pome: hue(0x9a2a28), fig: hue(0x5a3a52),
  cabbage: hue(0x6f9a3e), cabbage2: hue(0x8db35a), leek: hue(0xb8c98a), onion: hue(0xc79a5a), turnip: hue(0xd8c8b8),
  olive: hue(0x3f4426), olive2: hue(0x55582e), grape: hue(0x4a2850), grape2: hue(0x6a3a6a), fish: hue(0xb6bec2),
  red: hue(0xa8382c), blue: hue(0x3f5f8f), ochre: hue(0xc7952f), green: hue(0x55753a), white: hue(0xe8e2d2), linen: hue(0xe4dccb), purple: hue(0x6a2f5a),
  shieldRed: hue(0x8e2a20), shaft: hue(0xa8865a), fletch: hue(0xd8d0c0),
};

// ---------------------------------------------------------------------------
// Warehouse loads: one cart (100 units) on a square metre
// ---------------------------------------------------------------------------

/** Build one load of `good` (see the header). Returns { group, meshes }. */
export function buildLoad(good, lod = 0) {
  const mats = wareMaterials();
  const b = new Bin(`load-${good}`);
  const s = 11 + WARE_GOODS.indexOf(good) * 7;
  const far = lod === 2;
  switch (good) {
    case 'wine':
    case 'oil': {
      const kind = good;
      // Wine: two rows of three slender jars, standing, tipped together; oil: four round ones, two lying on top.
      if (kind === 'wine') {
        const rnd = artRng(s);
        for (let i = 0; i < (far ? 3 : 6); i++) {
          const x = far ? (i - 1) * 0.3 : -0.3 + (i % 3) * 0.3;
          const z = far ? 0 : i < 3 ? -0.17 : 0.17;
          const g = amphora('wine', lod, 0.9 + rnd() * 0.2);
          g.rotateX((z < 0 ? 1 : -1) * 0.08);
          g.rotateZ((rnd() - 0.5) * 0.06);
          b.add('terracotta', at(g, x, 0, z, rnd() * 6));
        }
        if (!far) {
          // A third jar lying across the tops of each row (stacked as a ship's cargo is).
          for (const z of [-0.12, 0.12]) {
            const g = amphora('wine', lod, 0.95);
            g.translate(0, -0.5, 0);
            g.rotateZ(Math.PI / 2);
            b.add('terracotta', at(g, 0.02, 1.05, z));
          }
        }
      } else {
        for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) b.add('terracotta', at(amphora('oil', lod, 0.95), x, 0, z, x * 7 + z * 3));
        if (!far) {
          for (const z of [-0.14, 0.16]) {
            const g = amphora('oil', lod, 1.0);
            g.translate(0, -0.33, 0);
            g.rotateZ(Math.PI / 2);
            b.add('terracotta', at(g, 0, 0.98, z));
          }
        }
      }
      break;
    }
    case 'wheat':
    case 'flax': {
      if (good === 'wheat') {
        // Sacks: three, then two on them, then one.
        const spots = [[-0.28, 0.18, 0, 0], [0.28, 0.18, 0, 0], [0, -0.22, 0, 0], [-0.15, 0.0, 0.32, 1], [0.17, 0.02, 0.32, 1], [0.0, 0.0, 0.62, 2]];
        spots.forEach(([x, z, y, l], i) => { if (!far || l === 0) b.add('burlap', at(sack(lod, s + i), x, y, z, (i * 1.7) % 3 - 0.3 * l)); });
      } else {
        // Flax: bundles of stalks in a criss-cross stack.
        for (let l = 0; l < (far ? 1 : 3); l++) {
          for (let k = 0; k < 4 - l; k++) {
            const g = bundle(lod, 0.9, 0.09);
            if (l % 2) g.rotateY(Math.PI / 2);
            const off = (k - (3 - l) / 2) * 0.2;
            b.add('straw', at(g, l % 2 ? off : 0, 0.09 + l * 0.16, l % 2 ? 0 : off));
          }
        }
      }
      break;
    }
    case 'vegetables':
    case 'fruit':
    case 'olives':
    case 'grapes':
    case 'fish': {
      const colours = {
        vegetables: [C.cabbage, C.cabbage2, C.leek, C.onion], fruit: [C.apple, C.apple2, C.pome], olives: [C.olive, C.olive2], grapes: [C.grape, C.grape2], fish: [C.fish],
      }[good];
      const bump = { vegetables: 0.25, fruit: 0.16, olives: 0.08, grapes: 0.1, fish: 0.12 }[good];
      // Four baskets, heaped, and one more on top (or crates for fish packed in salt).
      const spots = far ? [[0, 0, 0]] : [[-0.24, -0.24, 0], [0.24, -0.24, 0], [-0.24, 0.24, 0], [0.24, 0.24, 0], [0, 0, 0.3]];
      spots.forEach(([x, z, y], i) => {
        b.add('wicker', at(basket(lod, far ? 0.45 : 0.23, 0.26), x, y, z));
        b.add(good === 'fish' ? 'fish' : 'produce', at(heap(lod, far ? 0.42 : 0.21, 0.2, far ? 0.18 : 0.12, colours, s + i, bump), x, y, z));
      });
      break;
    }
    case 'meat': {
      for (const [x, z] of far ? [[0, 0]] : [[-0.22, -0.2], [0.22, -0.2], [0, 0.22]]) b.add('wood', at(barrel(lod), x, 0, z));
      if (!far) for (const [x, z, r] of [[-0.2, 0.25, 0.4], [0.24, 0.3, -0.3]]) b.add('meat', at(joint(lod, s + x * 10), x, 0, z, r));
      break;
    }
    case 'clay': {
      // A heap of dug clay, a few cut lumps on it.
      const g = revolve(profileOf([[0, 0.45], [0.2, 0.42], [0.36, 0.3], [0.46, 0.12], [0.48, 0], [0, 0]].reverse()), {
        segments: seg(lod, 14, 8, 5), metres: 2,
        deform: (p, th) => {
          const k = 1 + 0.08 * Math.sin(th * 3 + 1) + 0.05 * Math.sin(th * 7);
          p.x *= k;
          p.z *= k;
        },
      });
      b.add('clay', g);
      if (!far) for (let i = 0; i < 4; i++) b.add('clay', at(slab(0.22, 0.12, 0.16, { bevel: 0.03, seed: s + i, wobble: 0.01 }), -0.2 + i * 0.13, 0.3 - i * 0.05, (i % 2 ? 0.15 : -0.12), i));
      break;
    }
    case 'timber': {
      // Logs: four, three, then two, on two cross sticks.
      const rows = far ? [4] : [4, 3, 2];
      let y = far ? 0 : 0.06;
      if (!far) for (const x of [-0.32, 0.32]) b.add('wood', at(slab(0.08, 0.06, 0.95, { bevel: 0.01, seed: s + x }), x, 0, 0));
      rows.forEach((n, l) => {
        for (let k = 0; k < n; k++) b.add('wood', at(log(lod, 0.95, 0.11, s + l * 9 + k), 0, y + 0.11, (k - (n - 1) / 2) * 0.22));
        y += 0.19;
      });
      break;
    }
    case 'iron': {
      // Iron bars (each a smith's day of a bloom forged out), in crossed layers on skids.
      if (!far) for (const x of [-0.3, 0.3]) b.add('wood', at(slab(0.08, 0.07, 0.9, { bevel: 0.01, seed: s + x }), x, 0, 0));
      for (let l = 0; l < (far ? 1 : 5); l++) {
        for (let k = 0; k < 6; k++) {
          const g = slab(0.8, 0.06, 0.09, { bevel: 0.01, seed: s + l * 13 + k, wobble: 0.004, tone: 0.1, grime: 0 });
          if (l % 2) g.rotateY(Math.PI / 2);
          const off = (k - 2.5) * 0.14;
          b.add('iron', at(g, l % 2 ? off : 0, (far ? 0 : 0.07) + l * 0.062, l % 2 ? 0 : off));
        }
      }
      break;
    }
    case 'marble': {
      if (!far) for (const x of [-0.3, 0.3]) b.add('wood', at(slab(0.1, 0.08, 0.9, { bevel: 0.01, seed: s + x }), x, 0, 0));
      b.add('marble', at(slab(0.9, 0.6, 0.7, { bevel: 0.02, seed: s, wobble: 0.01, tone: 0.03, grime: 0.05 }), 0, far ? 0 : 0.08, -0.08, 0.05));
      if (!far) b.add('marble', at(slab(0.5, 0.18, 0.4, { bevel: 0.015, seed: s + 1, wobble: 0.008 }), 0.1, 0.68, -0.05, -0.2));
      break;
    }
    case 'linen': {
      // Bolts of linen in a stack, tied with cord.
      for (let l = 0; l < (far ? 1 : 3); l++) {
        for (let k = 0; k < 4 - l; k++) b.add('cloth', at(bolt(lod, 0.85, 0.1, C.linen), 0, 0.1 + l * 0.17, (k - (3 - l) / 2) * 0.21));
      }
      break;
    }
    case 'clothing': {
      // Folded tunics and cloaks in three stacks of dyes, on a board.
      if (!far) b.add('wood', slab(0.95, 0.05, 0.9, { bevel: 0.01, seed: s }));
      const dyes = [C.red, C.blue, C.ochre, C.white, C.green, C.purple];
      [[-0.24, -0.2], [0.24, -0.2], [0, 0.22]].slice(0, far ? 1 : 3).forEach(([x, z], i) => {
        for (const g of foldedStack(lod, far ? 3 : 7, 0.44, 0.36, dyes, s + i * 5)) b.add('cloth', at(g, x, far ? 0 : 0.05, z, i * 0.4));
      });
      break;
    }
    case 'pottery': {
      // A crate packed with straw, red-gloss bowls and plates stacked in it and on it, jugs beside.
      b.add('wood', crate(lod, 0.9, 0.32, 0.6, s));
      if (!far) {
        b.add('straw', at(slab(0.84, 0.06, 0.54, { bevel: 0.03, seed: s + 1, wobble: 0.02 }), 0, 0.27, 0));
        for (const [x, z] of [[-0.28, -0.12], [0, -0.12], [0.28, -0.12], [-0.14, 0.14], [0.14, 0.14]]) b.add('sigillata', at(bowlStack(lod, 5), x, 0.3, z));
        for (const [x, z] of [[-0.25, 0.42], [0.25, 0.42]]) b.add('sigillata', at(plateStack(lod, 8), x, 0, z));
        b.add('terracotta', at(amphora('jug', lod, 1.0), 0.0, 0, 0.42));
      }
      break;
    }
    case 'furniture': {
      // A couch's frame (lectus), a stool on it, a chest, a round table.
      const wood = [];
      wood.push(slab(0.9, 0.08, 0.42, { bevel: 0.015, seed: s }).translate(0, 0.32, -0.22));
      if (!far) {
        for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, -0.04], [0.4, -0.04]]) {
          const l = new CylinderGeometry(0.03, 0.022, 0.32, seg(lod, 6, 4, 3));
          l.translate(x, 0.16, z);
          wood.push(tintGeometry(boxUV(l), () => 0.75));
        }
        wood.push(slab(0.08, 0.35, 0.42, { bevel: 0.015, seed: s + 1 }).translate(-0.42, 0.4, -0.22));
        for (const g of stool(lod, s + 2)) wood.push(g.translate(0.15, 0.4, -0.22));
        const c = chest(lod, s + 3, 0.6, 0.38, 0.36);
        for (const g of c.wood) wood.push(g.translate(-0.15, 0, 0.25));
        b.add('iron', c.iron.map((g) => g.translate(-0.15, 0, 0.25)));
        for (const g of roundTable(lod, s)) wood.push(g.translate(0.3, 0, 0.3));
      } else {
        wood.push(slab(0.6, 0.38, 0.36, { bevel: 0.01, seed: s + 3 }).translate(-0.15, 0, 0.25));
      }
      b.add('wood', wood);
      break;
    }
    case 'weapons': {
      // Shields leaning on a crate of swords, a bundle of pila across it.
      b.add('wood', crate(lod, 0.8, 0.4, 0.4, s, true).translate(0, 0, -0.25));
      const n = far ? 1 : 4;
      for (let k = 0; k < n; k++) {
        const g = shield(lod, C.shieldRed);
        g.rotateX(-0.25);
        b.add('paint', at(g, -0.24 + k * 0.16, 0.52, 0.2 + k * 0.03, 0.05 * k));
        if (!far) {
          const boss = new SphereGeometry(0.07, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
          boss.rotateX(Math.PI / 2 - 0.25);
          b.add('bronze', at(boss, -0.24 + k * 0.16, 0.5, 0.25 + k * 0.03 + 0.04));
        }
      }
      if (!far) {
        const p = bundle(lod, 1.6, 0.05, 0.3);
        p.rotateY(0.6);
        b.add('wood', at(p, 0, 0.47, -0.25));
      }
      break;
    }
    case 'arrows': {
      // Crates of arrows, bundles standing in them, fletching up.
      for (const [x, z] of far ? [[0, 0]] : [[-0.22, -0.2], [0.22, -0.2], [0, 0.25]]) {
        b.add('wood', crate(lod, 0.4, 0.3, 0.32, s + x * 10).translate(x, 0, z));
        if (far) continue;
        for (const [dx, dz] of [[-0.08, -0.06], [0.08, -0.06], [0, 0.07]]) {
          const g = bundle(lod, 0.7, 0.05, 0.4);
          g.rotateZ(Math.PI / 2);
          b.add('paint', at(tintGeometry(g, (gx, gy) => (gy > 0.25 ? C.fletch : C.shaft)), x + dx, 0.38, z + dz));
        }
      }
      break;
    }
    default:
      b.add('wood', crate(lod, 0.8, 0.5, 0.8, s));
  }
  return b.group(mats, 0, lod);
}

// ---------------------------------------------------------------------------
// Market displays: a stall's spot, in three steps of fullness
// ---------------------------------------------------------------------------

/** Build the display of `good` at a market stall (see the header); with `step`, only what that step shows, merged by material. Returns { group, meshes }. */
export function buildDisplay(good, lod = 0, step = 0) {
  const mats = wareMaterials();
  const b = new Bin(`display-${good}`);
  const s = 101 + WARE_GOODS.indexOf(good) * 11;
  const T = DISPLAY.top;
  const F = DISPLAY.front;
  const far = lod === 2;
  const f = (n) => `fill${n}`;
  /** Baskets on the counter, heaped with `colours`, one more each step (1, 2, 3 baskets). */
  const baskets = (colours, bump, mat = 'produce', single = 0) => {
    [[-0.45, 0.02, 1], [0.0, 0.04, 2], [0.45, 0.0, 3]].forEach(([x, z, step], i) => {
      b.add('wicker', at(basket(lod, 0.22, 0.18), x, T, z), f(step));
      if (far) b.add(mat, at(heap(lod, 0.21, 0.12, 0.11, colours, s + i, bump), x, T, z), f(step));
      else if (single) b.add(mat, balls(lod, 11, single, x, T + 0.1, z, colours, s + i, 0.14), f(step));
      else b.add(mat, at(heap(lod, 0.21, 0.12, 0.11, colours, s + i, bump), x, T, z), f(step));
    });
    // Big baskets heaped on the ground before the counter: the stock behind the display, for the court (and the camera) to see.
    [[-0.35, 2], [0.32, 3]].forEach(([x, step], i) => {
      b.add('wicker', at(basket(lod, 0.28, 0.34), x, 0, DISPLAY.front + 0.36), f(step));
      b.add(mat, at(heap(lod, 0.27, 0.28, 0.16, colours, s + 7 + i, bump), x, 0, DISPLAY.front + 0.36), f(step));
    });
  };
  switch (good) {
    case 'wheat': {
      // Open sacks before the counter, rolled down to show the grain; the modius on the counter.
      b.add('wood', at(modius(lod), -0.4, T, 0.0), f(1));
      [[-0.45, 1], [0.05, 2], [0.5, 3]].forEach(([x, step], i) => {
        const g = basket(lod, 0.24, 0.42);
        b.add('burlap', at(g, x, 0, F + 0.3), f(step));
        b.add('grain', at(heap(lod, 0.22, 0.38, 0.08, [[1, 1, 1]], s + i, 0.02), x, 0, F + 0.3), f(step));
      });
      if (!far) b.add('grain', at(heap(lod, 0.28, 0, 0.1, [[1, 1, 1]], s + 7, 0.02), 0.25, T, 0.0), f(3));
      break;
    }
    case 'vegetables':
      baskets([C.cabbage, C.cabbage2, C.leek, C.onion, C.turnip], 0.3, 'produce', lod ? 0 : 0.06);
      break;
    case 'fruit':
      baskets([C.apple, C.apple2, C.pome, C.fig], 0.18, 'produce', lod ? 0 : 0.045);
      if (!far) b.add('produce', balls(lod, 10, 0.045, 0.2, T, 0.2, [C.apple, C.apple2], s + 9, 0.1), f(3));
      break;
    case 'fish': {
      // Fish laid side by side on the counter, in rows.
      const rnd = artRng(s);
      for (let row = 0; row < 3; row++) {
        for (let k = 0; k < (far ? 1 : 4); k++) {
          const g = fishPiece(lod, s + row * 7 + k);
          b.add('fish', at(g, -0.45 + k * 0.3 + (rnd() - 0.5) * 0.04, T, -0.15 + row * 0.15, (rnd() - 0.5) * 0.3), f(row + 1));
        }
      }
      break;
    }
    case 'meat': {
      // A chopping block with a joint on it; joints hanging from the beam over the counter.
      b.add('wood', at(slab(0.4, 0.12, 0.3, { bevel: 0.02, seed: s }), 0.3, T, 0.0), f(1));
      b.add('meat', at(joint(lod, s + 1), 0.3, T + 0.12, 0.0, 0.4), f(1));
      const hooks = far ? [[0, 2]] : [[-0.55, 1], [-0.3, 2], [-0.05, 2], [0.25, 3], [0.5, 3]];
      for (const [x, step] of hooks) {
        b.add('meat', at(joint(lod, s + x * 30, true), x, 1.72, -0.3), f(step));
        if (!far) b.add('iron', at(tintGeometry(boxUV(new CylinderGeometry(0.006, 0.006, 0.22, 4))), x, 1.98, -0.3), f(step));
      }
      if (!far) b.add('wood', at(slab(1.4, 0.06, 0.06, { bevel: 0.01, seed: s + 3 }), 0, 2.1, -0.3), f(1));
      break;
    }
    case 'oil':
    case 'wine': {
      // Jars standing before the counter, a stand of jugs and cups on it.
      const jars = far ? [[-0.3, 1], [0.3, 2]] : [[-0.55, 1], [-0.2, 2], [0.15, 2], [0.5, 3]];
      for (const [x, step] of jars) {
        const g = good === 'wine' ? amphora('wine', lod) : amphora('oil', lod);
        if (good === 'wine') g.rotateX(-0.22);
        b.add('terracotta', at(g, x, 0, F + (good === 'wine' ? 0.18 : 0.28), x), f(step));
      }
      if (!far) {
        [[-0.4, 1], [-0.15, 1], [0.1, 2], [0.35, 3], [0.55, 3]].forEach(([x, step]) => b.add('terracotta', at(amphora('jug', lod, good === 'oil' ? 1.05 : 0.85), x, T, 0.0), f(step)));
      }
      break;
    }
    case 'pottery': {
      // Red-gloss bowls and plates stacked on the counter, jugs, big pots on the ground.
      [[-0.5, 0.05, 1], [-0.25, -0.08, 1], [0.0, 0.05, 2], [0.25, -0.08, 2], [0.5, 0.05, 3]].forEach(([x, z, step], i) => {
        b.add('sigillata', at(i % 2 ? plateStack(lod, 10) : bowlStack(lod, 6), x, T, z), f(step));
      });
      if (!far) {
        for (const [x, step] of [[-0.4, 2], [0.2, 3]]) b.add('terracotta', at(amphora('jug', lod), x + 0.1, T, 0.15), f(step));
        for (const [x, step] of [[-0.35, 1], [0.35, 3]]) {
          const pot = revolve(profileOf([[0, 0], [0.1, 0], [0.18, 0.12], [0.19, 0.22], [0.15, 0.3], [0.16, 0.33], [0.13, 0.33], [0.12, 0.3], [0, 0.29]]), { segments: seg(lod, 14, 8, 5), metres: 0.6 });
          b.add('terracotta', at(pot, x, 0, F + 0.3), f(step));
        }
      }
      break;
    }
    case 'furniture': {
      // A stool and a little table before the counter, a chest beside, a couch frame behind.
      for (const g of stool(lod, s)) b.add('wood', at(g, -0.45, 0, F + 0.35), f(1));
      for (const g of roundTable(lod, s)) b.add('wood', at(g, 0.1, 0, F + 0.4), f(2));
      const c = chest(lod, s + 1, 0.55, 0.36, 0.34);
      b.add('wood', c.wood.map((g) => at(g, 0.55, 0, F + 0.3)), f(3));
      b.add('iron', c.iron.map((g) => at(g, 0.55, 0, F + 0.3)), f(3));
      if (!far) for (const g of stool(lod, s + 4)) b.add('wood', at(g, -0.2, T, 0), f(3));
      break;
    }
    case 'clothing': {
      // Folded garments on the counter; tunics and a cloak hung from the beam above (as in the painting of the forum's market).
      const dyes = [C.red, C.blue, C.ochre, C.white, C.purple, C.green];
      [[-0.45, 1], [0.0, 2], [0.45, 3]].forEach(([x, step], i) => b.add('cloth', foldedStack(lod, far ? 2 : 5, 0.36, 0.3, dyes, s + i * 3).map((g) => at(g, x, T, 0)), f(step)));
      if (!far) {
        [[-0.4, 2, C.red], [0.05, 3, C.blue], [0.45, 3, C.ochre]].forEach(([x, step, c]) => {
          const g = new CylinderGeometry(0.2, 0.26, 0.7, 7, 1, true);
          g.scale(1, 1, 0.12);
          b.add('cloth', at(tintGeometry(boxUV(g), () => c), x, 1.62, -0.3), f(step));
        });
        b.add('wood', at(slab(1.4, 0.05, 0.05, { bevel: 0.01, seed: s + 9 }), 0, 2.1, -0.3), f(2));
      }
      break;
    }
    case 'marble': {
      // Marble for the finest homes: veneer slabs leaning on the counter, a mortar, a small basin.
      [[-0.45, 1], [-0.25, 2], [-0.05, 3]].forEach(([x, step], i) => {
        const g = slab(0.5, 0.8, 0.04, { bevel: 0.005, seed: s + i, wobble: 0.002, tone: 0.04, grime: 0 });
        g.rotateX(-0.2);
        b.add('marble', at(g, x, 0, F + 0.12), f(step));
      });
      const mortar = revolve(profileOf([[0, 0], [0.12, 0], [0.16, 0.06], [0.17, 0.14], [0.13, 0.14], [0.1, 0.06], [0, 0.05]]), { segments: seg(lod, 14, 8, 5), metres: 1.6 });
      b.add('marble', at(mortar, 0.3, T, 0), f(1));
      if (!far) b.add('marble', at(slab(0.45, 0.25, 0.35, { bevel: 0.02, seed: s + 7 }), 0.4, 0, F + 0.3), f(2));
      break;
    }
    default:
      baskets([C.apple], 0.2);
  }
  return b.group(mats, step, lod);
}

/** The step of fullness (0 to 3) a market shows for `amount` of a good it can hold `cap` of. */
export function displayStep(amount, cap) {
  if (!(amount > 0)) return 0;
  const r = amount / cap;
  return r <= 1 / 3 ? 1 : r <= 2 / 3 ? 2 : 3;
}

/** Does a display's part tagged `when` show at step `step` (0 to 3)? */
export function displayShows(when, step) {
  if (!when || when === 'always') return true;
  if (when.startsWith('fill')) return step >= Number(when.slice(4));
  return false;
}
