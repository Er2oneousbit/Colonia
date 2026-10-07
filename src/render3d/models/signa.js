/**
 * models/signa.js
 * ----------------------------------------------------------------------------
 * The statues of the 3D look, designed from the Roman statues themselves
 * and the bases that carried them, not from the 2D sprites:
 *
 *   small (1 x 1)  a modest dedication on a patch of paving, one of three:
 *                  a herm of Liber (Bacchus), bearded and wreathed in ivy,
 *                  on its pillar with the shoulder tenons a herm keeps; a
 *                  portrait bust on a moulded pillar cut GENIO COLONIAE (to
 *                  the colony's Genius); a bronze Victory alighting on a
 *                  globe on a column drum, cut VICTORIAE AVG
 *   statue (2 x 2) a life-size and a little over (a statue's honour was
 *                  measured in feet) on an inscribed base over two steps
 *                  in a small paved square, laurels in pots at its corners,
 *                  marble benches either side: the emperor addressing his
 *                  troops in marble, his cloak still showing its paint (the
 *                  Prima Porta Augustus, IMP CAESARI AVGVSTO S P Q R); the
 *                  colony's patron in his toga (PATRONO COLONIAE D D, by
 *                  decree of the town council); a general in bronze
 *                  (GERMANICO CAESARI D D P P: by the council's decree, of
 *                  the public purse)
 *   grand (3 x 3)  the equestrian bronze, gilded, as Marcus Aurelius on
 *                  the Capitol, on its tall base over three steps behind a
 *                  bronze railing, bronze lampstands before it; or the
 *                  emperor enthroned as Jupiter (the seated Augustus from
 *                  Cumae, Claudius from Lanuvium), colossal, sceptre in hand
 *
 * Which of a size's designs stands where is the tile's (decor.js: a hash of
 * its place), so a row of statues is not one statue repeated.
 *
 * Tended or not (`worn`: sim/gardens.js careStep, decor.js decorState).
 * Tended: clean, the marble's paint fresh, the gilding bright, a laurel
 * wreath tied with red ribbons hung on the base. Neglected: the marble
 * greyed and lichened (the `crag` stone's crusts and streaks), the bronze
 * gone to its green patina and the gilding dull, dark streaks run down the
 * base under the bronze, birds' droppings on the heads and shoulders and
 * the cornices, the old wreath fallen brown on the step, weeds in the
 * paving's joints, the lampstands cold.
 *
 * Metres, the footprint's middle at the origin, y up, the front toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, TorusGeometry, SphereGeometry } from 'three';
import { frameSweep, revolve, profileOf, boxUV, tintGeometry, tube } from '../shapes.js';
import { material } from '../materials.js';
import { artRng, smoothstep } from '../texgen.js';
import { slab, paving, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin, weeds } from './rural.js';
import { castraMaterials } from './castra.js';
import { bush } from './learning.js';
import { figure, horse, HORSE, head, victory, carve, textWidth, loft, ellipsoid, member } from './statuary.js';

/** Each size's designs (decor.js picks one by the tile). */
export const SIGNA = Object.freeze({
  small: Object.freeze(['herm', 'bust', 'victory']),
  medium: Object.freeze(['augustus', 'togatus', 'general']),
  large: Object.freeze(['equestrian', 'enthroned']),
});

/** The grand statue's lampstands' flames (x, y, z), lit at night while it is tended (decor.js lamps). */
export const GRAND_LAMPS = Object.freeze([Object.freeze([-2.15, 2.02, 3.55]), Object.freeze([2.15, 2.02, 3.55])]);

/** The statues' materials (the forts' stone and metals, and their weathered selves). */
export function signaMaterials() {
  const c = castraMaterials();
  return {
    marble: c.marble,
    trav: c.trav,
    bronze: c.bronze,
    // Gilt bronze, gold leaf over the casting (the forts' eagle's gilt reads as bronze from afar: brighter here).
    gilt: material('gilt-leaf', { color: 0xe0b45e, metalness: 1, roughness: 0.32, vertexColors: true, snow: 0.5 }),
    letters: c.letters,
    paint: c.paint,
    clay: c.clay,
    // Weathered marble: the lichens and the black streaks of stone left out in the rain (flora's `crag`).
    marbleWorn: material('marble-weathered', { surface: 'crag', color: 0xf2eee4, vertexColors: true, snow: 1, normal: 0.8 }),
    travWorn: material('travertine-weathered', { surface: 'crag', color: 0xe6dcc6, vertexColors: true, snow: 1, normal: 0.9 }),
    // Bronze left to the weather: the green of its patina; gilding gone dull and brown.
    patina: material('bronze-patina', { surface: 'bronze', color: 0x7ec4a4, rough: 1.6, metal: 0.35, vertexColors: true, snow: 0.8 }),
    giltDull: material('gilt-dull', { surface: 'bronze', color: 0xa88a52, rough: 1.4, metal: 0.6, vertexColors: true, snow: 0.6 }),
    // Wreaths, garlands and the potted laurels: the farms' foliage.
    leaf: material('foliage', { roughness: 0.7, snow: 0.85, wet: 0.6 }),
    // The dark of the streaks the rain carries down from a bronze.
    stain: material('stone-stain', { color: 0xffffff, roughness: 0.95, vertexColors: true, snow: 0.6 }),
  };
}

const L = (hex, k = 1) => lin(hex, k);

/** Geometry lists by material key, gathered while a statue is built. */
function bins() {
  const keys = ['trav', 'marble', 'bronze', 'gilt', 'letters', 'paint', 'clay', 'leaf', 'stain', 'lamp'];
  return Object.fromEntries(keys.map((k) => [k, []]));
}

/** A square of travertine paving `half` metres each way, `h` thick. */
function square(half, h, lod, seed, out, skip = null) {
  out.trav.push(...paving(-half, half, -half, half, h, seed, { rowW: 0.62, minL: 0.55, maxL: 1.05, lod, tone: 0.07, grime: 0.2, skip }));
}

/** Steps: rectangles [w, d] from the foot up, each `h` high, from y0. Returns the top. */
function steps(list, h, y0, lod, seed, out, key = 'trav') {
  let y = y0;
  list.forEach(([w, d], k) => {
    out[key].push(slab(w, h, d, { bevel: lod ? 0.01 : 0.02, seed: seed + k, wobble: lod ? 0 : 0.003, tone: 0.03, grime: 0.25 }).translate(0, y, 0));
    y += h;
  });
  return y;
}

/**
 * An inscribed base: a moulded foot, the die, a moulded cornice; its
 * `lines` cut on the front (+z) in capitals `letter` high, painted red
 * (or, `gilt`, set in gilt bronze letters). From y0; returns the top.
 */
function base(w, d, hDie, y0, lod, seed, out, { lines = [], letter = 0.1, gilt = false, key = 'marble' } = {}) {
  const hx = w / 2;
  const hz = d / 2;
  const m = Math.min(hx, hz);
  const tint = (p) => 0.8 + 0.2 * smoothstep(y0, y0 + 0.25, p.y);
  if (lod < 2) {
    // The foot: a plinth, a torus, a cavetto up to the die.
    out[key].push(frameSweep(profileOf([[0.1, 0], [0.1, 0.1], [0.075, 0.1], { arc: [0.075, 0.135, 0.035, -Math.PI / 2, Math.PI / 2], n: lod ? 2 : 4 }, [0.03, 0.17], [0.0, 0.21], [-m, 0.21]]), hx, hz, { tint }).translate(0, y0, 0));
  } else {
    out[key].push(slab(w + 0.2, 0.21, d + 0.2, { bevel: 0.01, seed, wobble: 0, tone: 0, grime: 0.3 }).translate(0, y0, 0));
  }
  const yd = y0 + 0.21;
  out[key].push(slab(w, hDie, d, { bevel: 0.008, seed: seed + 1, wobble: 0, tone: 0.02, grime: 0.12 }).translate(0, yd, 0));
  const yc = yd + hDie;
  if (lod < 2) {
    // The cornice: a cyma reversa out to the corona, its drip, a fillet on top.
    out[key].push(frameSweep(profileOf([[0, 0], [0.012, 0.02], { arc: [0.04, 0.035, 0.03, Math.PI, Math.PI / 2], n: lod ? 2 : 4 }, [0.11, 0.07], [0.11, 0.15], [0.09, 0.15], [0.09, 0.18], [-m, 0.18]]), hx, hz).translate(0, yc, 0));
  } else {
    out[key].push(slab(w + 0.22, 0.18, d + 0.22, { bevel: 0.01, seed: seed + 2, wobble: 0, tone: 0, grime: 0 }).translate(0, yc, 0));
  }
  if (lines.length && lod < 2) {
    // The inscription's panel: a raised frame on the die's face, the lines within it.
    const fw = w - 0.2;
    const fh = Math.min(hDie - 0.24, lines.length * letter * 1.6 + letter * 0.8);
    const fy = yd + (hDie - fh) / 2 + 0.04;
    const fz = hz + 0.008;
    for (const [bw, bh, bx, by] of [[fw, 0.03, 0, fy], [fw, 0.03, 0, fy + fh - 0.03], [0.03, fh, -fw / 2 + 0.015, fy], [0.03, fh, fw / 2 - 0.015, fy]]) {
      out[key].push(tintGeometry(boxUV(new BoxGeometry(bw, bh, 0.016).translate(bx, by + bh / 2, fz))));
    }
    if (lod === 0) {
      lines.forEach((t, i) => {
        const hh = Math.min(letter, (fw - 0.12) / Math.max(1, textWidth(t, 1)));
        const y = fy + fh - 0.06 - (i + 1) * hh * 1.55 + hh * 0.3;
        out[gilt ? 'gilt' : 'letters'].push(...carve(t, y, hz + (gilt ? 0.006 : 0.002), hh, { depth: gilt ? 0.012 : 0.006 }));
      });
    } else {
      out.letters.push(tintGeometry(boxUV(new BoxGeometry(fw * 0.7, Math.min(fh * 0.6, lines.length * letter * 1.2), 0.004).translate(0, fy + fh * 0.2, hz + 0.003))));
    }
  }
  return yc + 0.18;
}

/** Push a figure's parts (statuary.js figure) at scale s, its foot at (x, y, z), turned ry, into the bins by material. */
function place(parts, s, x, y, z, ry, into) {
  const c = Math.cos(ry);
  const sn = Math.sin(ry);
  for (const [k, list] of Object.entries(parts)) {
    for (const g of list) {
      g.scale(s, s, s);
      if (ry) g.rotateY(ry);
      g.translate(x, y, z);
      into(k, g);
    }
  }
  return { c, sn };
}

/**
 * A laurel wreath tied with red ribbons, hung on a base's face at (x, y, z)
 * (fresh), or lying brown and fallen on a step (`fallen`). Into `out`.
 */
function wreath(x, y, z, r, lod, out, { fallen = false, side = false } = {}) {
  if (side) {
    // On the +x face (the inscription keeps the front): built on a +z face at the origin, turned a quarter.
    const tmp = bins();
    wreath(0, 0, 0, r, lod, tmp);
    for (const [k, list] of Object.entries(tmp)) for (const g of list) out[k].push(g.rotateY(Math.PI / 2).translate(x, y, z));
    return;
  }
  if (lod === 2) return;
  const n = lod ? 10 : 22;
  const ring = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const leaf = new SphereGeometry(r * 0.22, 5, 3);
    leaf.scale(1, 0.4, 2);
    leaf.rotateZ(a + 0.5);
    leaf.translate(Math.cos(a) * r, Math.sin(a) * r, 0);
    ring.push(leaf);
  }
  const col = fallen ? L(0x6e5a36) : L(0x3e6a2c);
  for (const g of ring) {
    if (fallen) {
      g.rotateX(-Math.PI / 2);
      g.translate(x, y + 0.02, z);
    } else g.translate(x, y, z + 0.03);
    out.leaf.push(tintGeometry(boxUV(g), () => col));
  }
  // The ribbons (taeniae) hanging from it, red.
  if (!fallen) {
    for (const s of [-1, 1]) {
      out.paint.push(tintGeometry(boxUV(new BoxGeometry(0.035, r * 2.2, 0.006).rotateZ(s * 0.18).translate(x + s * r * 0.35, y - r * 1.9, z + 0.025)), () => L(0x9a1e1a)));
    }
  }
}

/** Birds' droppings: white splashes over the points given ([x, y, z]), a few each. */
function droppings(points, seed, out) {
  const rnd = artRng(seed);
  for (const [x, y, z, n = 4, spread = 0.12] of points) {
    for (let k = 0; k < n; k++) {
      const g = new SphereGeometry(0.02 + rnd() * 0.025, 5, 3);
      g.scale(1, 0.25, 1 + rnd());
      g.rotateY(rnd() * 6);
      g.translate(x + (rnd() - 0.5) * spread, y, z + (rnd() - 0.5) * spread);
      out.paint.push(tintGeometry(boxUV(g), () => L(0xe8e6dc)));
    }
  }
}

/**
 * Dark streaks down a face from where a bronze or a cornice drips: `face`
 * 'z' (the +z face at `at`) or 'x' (the +x face), between heights y0 and
 * y1, across [a0, a1]. Thin sheets just proud of the face.
 */
function streaks(face, at, a0, a1, y0, y1, seed, out, n = 7) {
  const rnd = artRng(seed);
  for (let k = 0; k < n; k++) {
    const a = a0 + (a1 - a0) * rnd();
    const len = (y1 - y0) * (0.35 + rnd() * 0.65);
    const w = 0.025 + rnd() * 0.05;
    const g = new BoxGeometry(face === 'z' ? w : 0.003, len, face === 'z' ? 0.003 : w);
    g.translate(face === 'z' ? a : at + 0.002, y1 - len / 2, face === 'z' ? at + 0.002 : a);
    const dark = rnd() < 0.5 ? L(0x34483c) : L(0x2a2a26);
    out.stain.push(tintGeometry(boxUV(g), (px, py) => {
      // Darkest at the top where it starts, fading as it runs down.
      const t = smoothstep(y1 - len, y1, py);
      return [dark[0] + (1 - t) * 0.45, dark[1] + (1 - t) * 0.42, dark[2] + (1 - t) * 0.38];
    }));
  }
}

/** A terracotta pot with a clipped laurel ball, its foot at (x, y, z). */
function pottedLaurel(x, y, z, lod, seed, out) {
  const seg = lod === 2 ? 6 : lod ? 10 : 16;
  out.clay.push(revolve(profileOf([[0, 0], [0.17, 0], [0.24, 0.1], [0.28, 0.42], [0.31, 0.46], [0.29, 0.51], [0.24, 0.49], [0, 0.49]]), { segments: seg, metres: 0.4 }).translate(x, y, z));
  out.leaf.push(...bush(x, y + 1.08, z, 0.42, { lod, seed }));
  out.paint.push(tintGeometry(boxUV(new CylinderGeometry(0.03, 0.035, 0.45, 5, 1).translate(x, y + 0.65, z)), () => L(0x4a3a2a)));
}

/** A marble bench with its ends carved as lions' legs: its middle at (x, y, z), along x, `len` long. */
function bench(x, y, z, len, ry, lod, seed, out) {
  const parts = [slab(len, 0.08, 0.46, { bevel: 0.012, seed, wobble: 0, tone: 0, grime: 0 }).translate(0, 0.4, 0)];
  for (const s of [-1, 1]) {
    parts.push(slab(0.12, 0.4, 0.42, { bevel: 0.015, seed: seed + s + 3, wobble: 0.002, tone: 0.02, grime: 0.3 }).translate(s * (len / 2 - 0.12), 0, 0));
    if (lod === 0) parts.push(ellipsoid(0.07, 1, 0.6, 1.2, s * (len / 2 - 0.12), 0.04, 0.17, 7, 5));
  }
  for (const g of parts) out.marble.push(g.rotateY(ry).translate(x, y, z));
}

/** Weeds come up in the paving's joints and against the base. */
function weedsIn(half, lod, seed, out, n = 14) {
  if (lod === 2) return;
  out.leaf.push(...weeds(lod ? Math.ceil(n / 2) : n, -half, half, -half, half, seed, Math.max(1, lod)).map((g) => g.translate(0, 0.02, 0)));
}

// ---------------------------------------------------------------------------
// The small statue (1 x 1)
// ---------------------------------------------------------------------------

/** The small statue: `design` one of SIGNA.small. Returns { group, meshes, triangles }. */
export function buildSmallStatue({ design = 'herm', worn = false, lod = 0, seed = 11 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bins();
  const h0 = 0.07;
  square(1.3, h0, lod, seed, out);
  let fallenAt = [0, h0, 1.0];
  const drops = [];
  if (design === 'herm') {
    // A herm of Liber on a low plinth: the shaft tapering to its foot, the tenons at its shoulders, the head bearded, ivy in its hair.
    const y = steps([[0.74, 0.62]], 0.16, h0, lod, seed + 5, out, 'marble');
    const shaft = 1.24;
    const g = new BoxGeometry(0.34, shaft, 0.28, 1, 1, 1);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) if (P.getY(i) < 0) P.setXYZ(i, P.getX(i) * 0.76, P.getY(i), P.getZ(i) * 0.8);
    g.computeVertexNormals();
    g.translate(0, y + shaft / 2, 0);
    out.marble.push(tintGeometry(boxUV(g), (px, py) => 0.82 + 0.18 * smoothstep(y, y + 0.9, py)));
    for (const s of [-1, 1]) out.marble.push(slab(0.08, 0.1, 0.12, { bevel: 0.008, seed: seed + s, wobble: 0, tone: 0, grime: 0 }).translate(s * 0.21, y + shaft - 0.2, 0));
    // The upper chest under the head, the beard falling on it.
    out.marble.push(loft([[y + shaft - 0.02, 0, 0, 0.17, 0.14], [y + shaft + 0.08, 0, 0, 0.18, 0.13], [y + shaft + 0.16, 0, 0, 0.1, 0.08]], { seg: lod === 2 ? 6 : lod ? 10 : 18 }));
    const hd = head(0, y + shaft + 0.36, 0.01, 0, { lod, beard: true, wreath: true, scale: 1.12 });
    out.marble.push(...hd.skin, ...hd.hair, ...hd.wreath);
    if (lod === 0) out.letters.push(...carve('LIBERO', y + shaft - 0.42, 0.115, 0.055));
    drops.push([0, y + shaft + 0.5, 0.0, 4, 0.12], [0.2, y + shaft - 0.1, 0, 2, 0.05], [0, y, 0.33, 3, 0.4]);
    if (worn) streaks('z', 0.135, -0.1, 0.1, y + 0.2, y + shaft - 0.1, seed, out, 4);
  } else if (design === 'bust') {
    // A portrait bust on a moulded pillar.
    const top = base(0.5, 0.46, 1.08, h0, lod, seed + 7, out, { lines: ['GENIO', 'COLONIAE'], letter: 0.06 });
    // The bust's foot: a turned socle, then the chest in its toga's folds, the head.
    out.marble.push(revolve(profileOf([[0, 0], [0.13, 0], [0.13, 0.03], [0.09, 0.06], [0.06, 0.12], [0.1, 0.16], [0, 0.16]]), { segments: lod === 2 ? 6 : lod ? 10 : 18, metres: 0.3 }).translate(0, top, 0));
    const cy = top + 0.16;
    out.marble.push(loft([[cy, 0, 0, 0.2, 0.11], [cy + 0.12, 0, 0.0, 0.23, 0.12], [cy + 0.24, 0, -0.005, 0.22, 0.11], [cy + 0.3, 0, -0.01, 0.12, 0.07], [cy + 0.32, 0, -0.005, 0.06, 0.055]], {
      seg: lod === 2 ? 8 : lod ? 12 : 22,
      deform: (p, th, t) => { if (lod < 2) p.z += 0.012 * Math.sin(th * 7 + p.y * 30) * Math.max(0, Math.cos(th)); },
      tint: (q) => 0.82 + 0.18 * smoothstep(cy, cy + 0.3, q.y),
    }));
    if (lod < 2) out.marble.push(tube([[-0.19, cy + 0.26, 0.03], [-0.05, cy + 0.15, 0.115], [0.12, cy + 0.06, 0.1]], 0.03, { radial: 6, segments: lod ? 6 : 12 }));
    const hd = head(0, cy + 0.32 + 0.17, 0.01, -0.15, { lod, scale: 1.05 });
    out.marble.push(...hd.skin, ...hd.hair);
    drops.push([0, cy + 0.62, 0.0, 3, 0.1], [0.15, cy + 0.27, 0, 3, 0.1], [0, top - 0.02, 0.3, 3, 0.3]);
    if (worn) streaks('z', 0.231, -0.18, 0.18, h0 + 0.3, top - 0.2, seed, out, 5);
    fallenAt = [0.45, h0, 0.75];
  } else {
    // A bronze Victory on a globe, on a column drum.
    const seg = lod === 2 ? 8 : lod ? 12 : 24;
    out.marble.push(...[slab(0.66, 0.14, 0.66, { bevel: 0.015, seed, wobble: 0, tone: 0, grime: 0.3 }).translate(0, h0, 0)]);
    const y0 = h0 + 0.14;
    out.marble.push(revolve(profileOf([[0, 0], [0.28, 0], [0.28, 0.05], { arc: [0.27, 0.09, 0.04, -Math.PI / 2, Math.PI / 2], n: lod ? 2 : 4 }, [0.23, 0.14], [0.22, 0.17], [0.215, 1.08], [0.24, 1.12], { arc: [0.25, 1.16, 0.04, -Math.PI / 2, Math.PI / 2], n: lod ? 2 : 4 }, [0.28, 1.22], [0.28, 1.26], [0, 1.26]]), {
      segments: seg, metres: 0.5, tint: (p) => 0.8 + 0.2 * smoothstep(y0, y0 + 0.5, p.y),
    }).translate(0, y0, 0));
    const top = y0 + 1.26;
    const metal = worn ? 'bronze' : 'gilt';
    out[metal].push(ellipsoid(0.16, 1, 1, 1, 0, top + 0.16, 0, lod === 2 ? 8 : 14, lod === 2 ? 6 : 10));
    for (const g of victory(lod, { scale: 0.92 })) out[metal].push(g.translate(0, top + 0.31, 0));
    if (lod === 0) {
      out.bronze.push(...[new TorusGeometry(0.162, 0.008, 4, 24)].map((g) => tintGeometry(boxUV(g.rotateX(Math.PI / 2).translate(0, top + 0.16, 0)))));
      out.letters.push(...carve('VICTORIAE·AVG', y0 + 0.88, 0, 0.05).map((g) => {
        // Round the drum's face: each stroke pushed out to its curve.
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i);
          const a = x / 0.218;
          p.setXYZ(i, Math.sin(a) * (0.218 + (p.getZ(i))), p.getY(i), Math.cos(a) * (0.218 + p.getZ(i)));
        }
        g.computeVertexNormals();
        return g;
      }));
    }
    drops.push([0, top + 1.0, -0.05, 2, 0.1], [0, top + 0.02, 0.2, 3, 0.1], [0, h0 + 0.14, 0.28, 3, 0.2]);
    if (worn) {
      // (On a drum, the streaks run round its front.)
      streaks('z', 0.217, -0.12, 0.12, y0 + 0.4, top - 0.1, seed, out, 4);
    }
    fallenAt = [0.38, h0, 0.55];
  }
  if (worn) {
    droppings(drops, seed + 9, out);
    wreath(fallenAt[0], fallenAt[1], fallenAt[2], 0.13, lod, out, { fallen: true });
    weedsIn(1.25, lod, seed + 3, out, 10);
  } else if (design !== 'victory') {
    if (design === 'herm') wreath(0, h0 + 0.16 + 0.5, 0.11, 0.1, lod, out);
    else wreath(0.25, h0 + 0.21 + 0.62, 0, 0.1, lod, out, { side: true });
  } else {
    wreath(0, h0 + 0.14 + 0.62, 0.22, 0.1, lod, out);
  }
  return finish(`statue_small:${design}`, out, worn, lod);
}

// ---------------------------------------------------------------------------
// The statue (2 x 2)
// ---------------------------------------------------------------------------

const MEDIUM_TEXT = {
  augustus: ['IMP·CAESARI', 'AVGVSTO', 'S·P·Q·R'],
  togatus: ['PATRONO', 'COLONIAE', 'D·D'],
  general: ['GERMANICO', 'CAESARI', 'D·D·P·P'],
};

/** The statue: `design` one of SIGNA.medium. */
export function buildStatue({ design = 'augustus', worn = false, lod = 0, seed = 23 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bins();
  const h0 = 0.08;
  square(3.86, h0, lod, seed, out);
  const y1 = steps([[3.3, 3.0], [2.7, 2.4]], 0.16, h0, lod, seed + 2, out);
  const top = base(1.36, 1.1, 1.3, y1, lod, seed + 4, out, { lines: MEDIUM_TEXT[design], letter: 0.1 });
  // The statue's own plinth, then the figure, a little over life size.
  const bronze = design === 'general';
  out.marble.push(slab(0.86, 0.08, 0.74, { bevel: 0.01, seed: seed + 6, wobble: 0, tone: 0, grime: 0.1 }).translate(0, top, 0));
  const s = 1.2;
  const f = figure(design === 'togatus' ? 'toga' : 'cuirass', { lod, seed, wreath: design === 'augustus' });
  const marbleKey = 'marble';
  place(f, s, 0, top + 0.08, 0, 0, (k, g) => {
    if (bronze) out[k === 'wreath' ? 'gilt' : 'bronze'].push(g);
    else if (k === 'cloth' && design === 'augustus' && !worn) {
      // The cloak's paint, faded: Augustus's paludamentum in red.
      const c = g.attributes.color;
      for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * 0.95, c.getY(i) * 0.55, c.getZ(i) * 0.5);
      out[marbleKey].push(g);
    } else out[marbleKey].push(g);
  });
  // A support by the standing leg (marble needs one; a bronze stands on its own): a palm stump.
  if (!bronze && lod < 2) out.marble.push(member([[0.19, top + 0.08, -0.13], [0.2, top + 0.3, -0.14], [0.19, top + 0.55, -0.13]], 0.085, 0.06, { radial: 12, segs: 4, bulge: 0.15, at: 0.1 }));
  // Laurels in pots at the corners, benches either side facing in.
  for (const [x, z] of [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]]) pottedLaurel(x, h0, z, lod, seed + x * 3 + z, out);
  for (const sx of [-1, 1]) bench(sx * 2.6, h0, 0.2, 1.6, Math.PI / 2, lod, seed + 30 + sx, out);
  if (worn) {
    droppings([[0, top + 0.08 + 1.72 * s, 0.02, 5, 0.12], [0.22 * s, top + 0.08 + 1.5 * s, 0, 3, 0.1], [-0.22 * s, top + 0.08 + 1.5 * s, 0, 3, 0.1], [0, top, 0.4, 5, 0.9], [0, y1 - 0.16, 1.15, 4, 1.2], [2.6, h0 + 0.48, 0.2, 3, 0.4]], seed + 9, out);
    streaks('z', 0.551, -0.55, 0.55, y1 + 0.25, top - 0.2, seed + 1, out, bronze ? 9 : 5);
    streaks('x', 0.68, -0.4, 0.4, y1 + 0.25, top - 0.2, seed + 2, out, bronze ? 6 : 3);
    wreath(0.9, y1 - 0.16, 1.25, 0.16, lod, out, { fallen: true });
    weedsIn(3.7, lod, seed + 3, out, 22);
  } else {
    wreath(0.68, y1 + 0.21 + 0.66, 0, 0.15, lod, out, { side: true });
  }
  return finish(`statue_medium:${design}`, out, worn, lod);
}

// ---------------------------------------------------------------------------
// The grand statue (3 x 3)
// ---------------------------------------------------------------------------

/** A bronze railing round a rectangle (cancelli): posts with knobs, two rails. */
function railing(hx, hz, y, h, lod, out, key) {
  if (lod === 2) return;
  const posts = [];
  const step = lod ? 0.9 : 0.45;
  const side = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      posts.push([ax + (bx - ax) * t, az + (bz - az) * t]);
    }
    for (const ry of [0.35, h - 0.05]) {
      const g = new BoxGeometry(Math.abs(bx - ax) + 0.04, 0.035, Math.abs(bz - az) + 0.04);
      g.translate((ax + bx) / 2, y + ry, (az + bz) / 2);
      out[key].push(tintGeometry(boxUV(g)));
    }
  };
  side(-hx, hz, hx, hz);
  side(hx, hz, hx, -hz);
  side(hx, -hz, -hx, -hz);
  side(-hx, -hz, -hx, hz);
  for (const [x, z] of posts) {
    out[key].push(tintGeometry(boxUV(new CylinderGeometry(0.018, 0.022, h, 5, 1).translate(x, y + h / 2, z))));
    if (lod === 0) out[key].push(ellipsoid(0.035, 1, 1.3, 1, x, y + h + 0.03, z, 6, 4));
  }
}

/** A bronze lampstand (candelabrum): a three-legged foot, a fluted shaft, a bowl; its flame lit while tended. */
function candelabrum(x, y, z, lod, lit, out, key) {
  const seg = lod === 2 ? 5 : lod ? 8 : 14;
  out[key].push(revolve(profileOf([[0, 0], [0.2, 0], [0.22, 0.04], [0.12, 0.12], [0.07, 0.22], [0.045, 0.3], [0.04, 1.5], [0.06, 1.56], [0.05, 1.62], [0.17, 1.74], [0.18, 1.8], [0, 1.78]]), { segments: seg, metres: 0.4 }).translate(x, y, z));
  if (lod < 2) {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      out[key].push(member([[x + Math.cos(a) * 0.08, y + 0.14, z + Math.sin(a) * 0.08], [x + Math.cos(a) * 0.2, y + 0.07, z + Math.sin(a) * 0.2], [x + Math.cos(a) * 0.26, y, z + Math.sin(a) * 0.26]], 0.025, 0.02, { radial: 5, segs: 3 }));
    }
  }
  if (lit) {
    const fl = new CylinderGeometry(0.0, 0.12, 0.26, lod ? 6 : 10, 1);
    fl.translate(x, y + 1.9, z);
    out.lamp.push(tintGeometry(boxUV(fl)));
  }
}

/** The grand statue: `design` one of SIGNA.large. */
export function buildGrandStatue({ design = 'equestrian', worn = false, lod = 0, seed = 37 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bins();
  const h0 = 0.08;
  square(5.86, h0, lod, seed, out);
  const metal = worn ? 'bronze' : 'gilt';
  let top;
  if (design === 'equestrian') {
    const y1 = steps([[3.6, 5.2], [3.0, 4.6], [2.4, 4.0]], 0.15, h0, lod, seed + 2, out);
    top = base(1.8, 3.2, 1.72, y1, lod, seed + 4, out, { lines: ['IMP·CAES·M·AVRELIO', 'ANTONINO·AVG', 'S·P·Q·R'], letter: 0.13, gilt: true });
    railing(1.38, 2.18, y1 - 0.15, 0.9, lod, out, 'bronze');
    const s = 1.32;
    const hz = horse({ lod, pose: 'step' });
    for (const g of hz.body) out[metal].push(g.scale(s, s, s).translate(0, top, -0.05));
    for (const g of hz.cloth) out[metal].push(g.scale(s, s, s).translate(0, top, -0.05));
    const rider = figure('rider', { lod, seed, beard: true });
    const [sx, sy, sz] = HORSE.seat;
    place(rider, s, sx * s, top + sy * s, sz * s - 0.05, 0, (k, g) => out[metal].push(g));
    if (worn) {
      droppings([[0, top + (sy + 0.9) * s, 0.02, 5, 0.14], [0.25, top + (sy + 0.62) * s, 0.1, 3, 0.1], [0, top + 2.1 * s, 1.0 * s, 3, 0.12], [0, top + 1.6 * s, -0.8 * s, 4, 0.3], [0, top, 1.3, 6, 1.4]], seed + 9, out);
      streaks('z', 1.601, -0.8, 0.8, y1 + 0.3, top - 0.2, seed + 1, out, 10);
      streaks('x', 0.901, -1.4, 1.4, y1 + 0.3, top - 0.2, seed + 2, out, 10);
    }
  } else {
    const y1 = steps([[4.4, 4.6], [3.8, 4.0], [3.2, 3.4]], 0.15, h0, lod, seed + 2, out);
    top = base(2.3, 2.5, 1.5, y1, lod, seed + 4, out, { lines: ['DIVO·AVGVSTO', 'PATRI·PATRIAE', 'S·P·Q·R'], letter: 0.15, gilt: !worn });
    railing(1.8, 1.9, y1 - 0.15, 0.9, lod, out, 'bronze');
    const s = 1.85;
    // The throne: a seat block with arms, a high back, lions' feet; the footstool.
    const tz = -0.3;
    const parts = [
      slab(0.74, 0.46, 0.62, { bevel: 0.015, seed, wobble: 0, tone: 0, grime: 0.15 }).translate(0, 0, tz - 0.02),
      slab(0.74, 0.92, 0.12, { bevel: 0.015, seed: seed + 1, wobble: 0, tone: 0, grime: 0.1 }).translate(0, 0.46, tz - 0.27),
      slab(0.6, 0.1, 0.38, { bevel: 0.015, seed: seed + 2, wobble: 0, tone: 0, grime: 0.1 }).translate(0, 0, 0.42),
    ];
    for (const sx of [-1, 1]) {
      parts.push(slab(0.08, 0.3, 0.52, { bevel: 0.012, seed: seed + 3 + sx, wobble: 0, tone: 0, grime: 0 }).translate(sx * 0.37, 0.46, tz + 0.02));
      if (lod < 2) parts.push(ellipsoid(0.08, 0.8, 1.4, 1, sx * 0.37, 0.36, tz + 0.28, 8, 6));
    }
    for (const g of parts) out.marble.push(g.scale(s, s, s).translate(0, top, 0));
    const f = figure('seated', { lod, seed, beard: true, wreath: true });
    place(f, s, 0, top + 0.46 * s, tz * s + 0.05, 0, (k, g) => {
      if (k === 'wreath') out[metal].push(g);
      else if (k === 'gear') out[metal].push(g);
      else out.marble.push(g);
    });
    if (worn) {
      droppings([[0, top + 1.42 * s, tz * s + 0.08, 5, 0.18], [0.4, top + 1.2 * s, tz * s, 4, 0.12], [-0.4, top + 1.15 * s, tz * s, 4, 0.12], [0, top + 0.6 * s, 0.5 * s, 4, 0.4], [0, top, 1.1, 6, 1.6]], seed + 9, out);
      streaks('z', 1.251, -1.0, 1.0, y1 + 0.3, top - 0.2, seed + 1, out, 7);
      streaks('x', 1.151, -1.1, 1.1, y1 + 0.3, top - 0.2, seed + 2, out, 6);
    }
  }
  // The lampstands either side before the base.
  for (const [lx, , lz] of GRAND_LAMPS) candelabrum(lx, h0, lz, lod, !worn, out, 'bronze');
  for (const [x, z] of [[-5.1, -5.1], [5.1, -5.1], [-5.1, 5.1], [5.1, 5.1]]) pottedLaurel(x, h0, z, lod, seed + x * 7 + z, out);
  if (worn) {
    wreath(1.2, h0 + 0.15, 2.9, 0.22, lod, out, { fallen: true });
    weedsIn(5.6, lod, seed + 3, out, 30);
  } else {
    wreath(design === 'equestrian' ? 0.9 : 1.15, h0 + 0.45 + 0.21 + 0.9, 0, 0.22, lod, out, { side: true });
  }
  return finish(`statue_large:${design}`, out, worn, lod);
}

// ---------------------------------------------------------------------------

/** The bins as a model: tended or worn materials, small things casting no shadow far out. */
function finish(name, out, worn, lod) {
  const m = signaMaterials();
  const p = new TaggedParts(name);
  const small = { cast: lod === 0 };
  if (lod === 2) out.letters = [];
  p.add('paving', worn ? m.travWorn : m.trav, out.trav);
  p.add('marble', worn ? m.marbleWorn : m.marble, out.marble);
  p.add('bronze', worn ? m.patina : m.bronze, out.bronze);
  p.add('gilt', worn ? m.giltDull : m.gilt, out.gilt);
  p.add('letters', m.letters, out.letters, { cast: false });
  p.add('paint', m.paint, out.paint, small);
  p.add('pots', m.clay, out.clay);
  p.add('leaf', m.leaf, out.leaf);
  p.add('stains', m.stain, out.stain, { cast: false });
  p.add('lamp', lanternPane(), out.lamp, { cast: false });
  return p.build();
}

export { lantern };
