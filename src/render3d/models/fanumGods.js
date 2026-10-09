/**
 * models/fanumGods.js
 * ----------------------------------------------------------------------------
 * Each god's own ground in the Great Sanctuary (models/fanum.js), on the
 * lower terrace's two wings either side of the stair, where the game's
 * camera sees it best, after what the record keeps of each cult:
 *
 *   ceres    a sacred grove (lucus): Ceres's own was a grove of great oaks
 *            no axe might touch (Ovid's Erysichthon, Metamorphoses VIII),
 *            and the cista, the round basket of her mysteries with a snake
 *            coiled on its lid (the cistophori's coins, the Eleusinian
 *            reliefs), on an altar heaped with sheaves, her torches by it.
 *   neptune  a spring and its basins: water led into long marble basins,
 *            bronze dolphins at their corners spouting (dolphins and
 *            hippocamps were Neptune's retinue in Scopas's group, Pliny
 *            XXXVI.26), the god's bronze with his trident standing in the
 *            water.
 *   mercury  a market colonnade: the god of trade's sanctuaries kept
 *            markets (his temple by the Circus Maximus stood among the
 *            merchants); stalls under striped awnings with their goods, the
 *            steelyard, and the caduceus raised on a column between them.
 *   mars     the spoils: trophies of captured arms on their bases, piles of
 *            taken shields and spears (spoils were dedicated to Mars), and
 *            the sacred spears (hastae Martis) in their rack, which were
 *            said to stir before a war.
 *   venus    myrtle, roses and doves: myrtle was hers (the shrine of Venus
 *            Cloacina among its myrtles), roses and the dove her signs;
 *            beds of roses edged with clipped myrtle, a dovecote, doves on
 *            the parapets.
 *
 * Every builder adds to the sanctuary's bins (fanum.js fanumBins), in its
 * frame (metres, y up, +z the street); `grown` (0 to 1) is how far the
 * dedication's stage has brought them (planted, set up).
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import { boxUV, tintGeometry, tube, revolve, profileOf } from '../shapes.js';
import { slab } from './masonry.js';
import { box, lin } from './sacra.js';
import { emblemBins, placeBins, pourBins, wheatSheaf, torch, dolphin, trident, caduceus, petasus, trophy, clipeus, helmet, dove, shell } from './numina.js';
import { bush, cypress, hedge } from './learning.js';
import { gardenTree, rectPool, jet, flowerBed } from './domus.js';
import { FANUM, grow } from './fanum.js';
import { artRng } from '../texgen.js';

const T1 = FANUM.t1;
const Y = T1.y;
/** The wings: x from the stair to the side (each mirrored), z from the middle face to the front edge. */
const WING = Object.freeze({ x0: 2.6, x1: 9.2, z0: 3.1, z1: 6.55 });

/** Multiply a geometry's vertex colours (white if none) by `rgb`. */
function dye(g, rgb) {
  if (!g.attributes.color) return tintGeometry(g, () => rgb);
  const c = g.attributes.color;
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * rgb[0], c.getY(i) * rgb[1], c.getZ(i) * rgb[2]);
  return g;
}

/** Pour emblem bins into the sanctuary's: their wood, iron, straw and cloth into the plain-coloured props. */
function pour(b, out) {
  for (const [k, list] of Object.entries(b)) {
    if (!list.length) continue;
    if (k === 'wood') out.props.push(...list.map((g) => dye(g, lin(0x6b4a2e))));
    else if (k === 'iron') out.props.push(...list.map((g) => dye(g, lin(0x4c4c50))));
    else if (k === 'straw') out.props.push(...list.map((g) => dye(g, lin(0xd8b860))));
    else if (k === 'terracotta') out.clay.push(...list);
    else (out[k] || out.marble).push(...list);
  }
}

/** A plinth of travertine on the wing at (x, z), w x d, h high: its top's y. */
function plinth(out, x, z, w, d, h, seed = 1) {
  out.trav.push(slab(w, h, d, { bevel: 0.02, seed, wobble: 0, tone: 0.03, grime: 0.25 }).translate(x, Y, z));
  return Y + h;
}

/** A small altar of marble at (x, z) on y0. */
function smallAltar(out, x, z, y0, lod, seed) {
  out.trav.push(slab(0.9, 0.1, 0.7, { bevel: 0.015, seed, wobble: 0, tone: 0.03, grime: 0.3 }).translate(x, y0, z));
  out.marble.push(slab(0.66, 0.78, 0.48, { bevel: 0.02, seed: seed + 1, wobble: 0, tone: 0.02, grime: 0.15 }).translate(x, y0 + 0.1, z));
  out.marble.push(slab(0.76, 0.08, 0.56, { bevel: 0.02, seed: seed + 2, wobble: 0, tone: 0, grime: 0 }).translate(x, y0 + 0.88, z));
  if (lod < 2) for (const s of [-1, 1]) out.marble.push(tintGeometry(boxUV(new CylinderGeometry(0.07, 0.07, 0.56, lod ? 6 : 10, 1).rotateX(Math.PI / 2).translate(x + s * 0.3, y0 + 1.0, z))));
  return y0 + 0.96;
}

// ---------------------------------------------------------------------------
// Ceres: the grove and the cista
// ---------------------------------------------------------------------------

/** The cista: a round basket of wicker with a lid, a snake coiled on it, on its own (x, y, z), `s` across. */
function cista(out, x, y, z, s, lod) {
  const seg = lod ? 10 : 18;
  out.props.push(dye(revolve(profileOf([[0, 0], [s * 0.5, 0], [s * 0.52, s * 0.08], [s * 0.5, s * 0.62], [0, s * 0.62]]), { segments: seg, metres: 0.3, tint: (p) => 0.75 + 0.25 * (Math.sin(p.y * 70) > 0 ? 1 : 0.8) }).translate(x, y, z), lin(0xb08a50)));
  out.props.push(dye(revolve(profileOf([[0, s * 0.6], [s * 0.55, s * 0.6], [s * 0.55, s * 0.68], [s * 0.3, s * 0.78], [0, s * 0.8]]), { segments: seg, metres: 0.3 }).translate(x, y, z), lin(0x9a7840)));
  if (lod < 2) {
    // The snake: a coil on the lid and its head raised.
    const pts = [];
    for (let k = 0; k <= 22; k++) {
      const a = (k / 22) * Math.PI * 3.4;
      const r = s * (0.36 - k * 0.011);
      pts.push([x + Math.cos(a) * r, y + s * 0.8 + k * 0.004, z + Math.sin(a) * r]);
    }
    pts.push([x + s * 0.05, y + s * 1.05, z + s * 0.05], [x + s * 0.12, y + s * 1.12, z + s * 0.12]);
    out.bronze.push(tube(pts, s * 0.035, { radial: lod ? 4 : 6, segments: lod ? 18 : 40, around: 0.1 }));
  }
}

function ceres(out, t, lod, seed) {
  const g = grow(t, 'gods');
  if (g <= 0) return;
  const rnd = artRng(seed);
  // The grove: oaks on both wings, planted from the back as the stage goes on; an old cypress or two.
  const places = [];
  for (const s of [-1, 1]) {
    for (const [x, z, h] of [[3.5, 4.0, 3.2], [5.4, 3.7, 3.6], [7.4, 4.2, 3.3], [8.6, 5.9, 2.9], [4.6, 5.9, 2.8], [6.6, 6.1, 3.0]]) places.push([s * x, z, h]);
  }
  const n = Math.round(places.length * g);
  places.slice(0, n).forEach(([x, z, h], i) => {
    const tr = gardenTree(x, Y, z, h * (0.9 + rnd() * 0.15), lod, seed + 10 + i);
    out.props.push(...tr.wood.map((w) => dye(w, lin(0x5a4430))));
    out.leaf.push(...tr.leaf);
    if (lod === 0) {
      // Spreading oaks, not lollipops: a second, lower crown off to one side.
      out.leaf.push(...bush(x + (rnd() - 0.5) * 0.9, Y + h * 0.5, z + (rnd() - 0.5) * 0.6, h * 0.22, { lod, seed: seed + 40 + i, squash: 0.8 }));
    }
  });
  // The grove's floor: grass and leaf litter under the trees.
  for (const s of [-1, 1]) out.earth.push(box(WING.x1 - WING.x0, 0.03, WING.z1 - WING.z0, s * (WING.x0 + WING.x1) / 2, Y - 0.02, (WING.z0 + WING.z1) / 2, 0.85));
  if (g < 0.5) return;
  // The cista on its altar, on the left wing at the front, sheaves heaped round it, torches either side.
  const ax = -3.3;
  const az = 5.6;
  const top = smallAltar(out, ax, az, Y, lod, seed + 60);
  cista(out, ax, top, az, 0.42, lod);
  if (lod < 2) {
    for (const k of [-1, 1]) pour(placeBins(wheatSheaf(lod, 'straw', 5 + k), ax + k * 0.62, Y, az + 0.18, { s: 0.8, ry: k * 0.5 }), out);
    for (const k of [-1, 1]) {
      out.trav.push(slab(0.2, 0.4, 0.2, { bevel: 0.01, seed: seed + 70 + k, wobble: 0, tone: 0, grime: 0.2 }).translate(ax + k * 1.0, Y, az - 0.35));
      pour(placeBins(torch(lod, 'bronze', 1.4), ax + k * 1.0, Y + 0.4, az - 0.35), out);
    }
  }
  // On the right wing, baskets of first fruits on a second altar.
  const bx = 3.3;
  const btop = smallAltar(out, bx, az, Y, lod, seed + 80);
  if (lod < 2) {
    for (const [dx, c] of [[-0.16, lin(0xc8a040)], [0.16, lin(0xa83a2a)]]) {
      out.props.push(dye(revolve(profileOf([[0, 0], [0.12, 0], [0.16, 0.14], [0, 0.14]]), { segments: lod ? 8 : 12, metres: 0.3 }).translate(bx + dx, btop, az), lin(0xb08a50)));
      out.props.push(dye(new SphereGeometry(0.13, lod ? 6 : 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(bx + dx, btop + 0.12, az), c));
    }
  }
}

// ---------------------------------------------------------------------------
// Neptune: the spring and its basins
// ---------------------------------------------------------------------------

function neptune(out, t, lod, seed) {
  const g = grow(t, 'gods');
  if (g <= 0) return;
  for (const s of [-1, 1]) {
    const x = s * (WING.x0 + WING.x1) / 2;
    const z = (WING.z0 + WING.z1) / 2 + 0.1;
    const w = WING.x1 - WING.x0 - 0.5;
    const d = WING.z1 - WING.z0 - 0.7;
    const p = rectPool(x, z, w, d, Y, 0.5, { dw: 0.1, t: 0.22, lod, seed: seed + s });
    out.marble.push(...p.kerb);
    out.marble.push(...p.floor.map((f) => dye(f, lin(0x5a8a90))));
    if (g < 0.4) continue;
    out.water.push(...p.water);
    // Bronze dolphins at its corners, diving, their mouths spouting into the basin.
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    corners.forEach(([cx, cz], i) => {
      const dx = x + cx * (w / 2 - 0.2);
      const dz = z + cz * (d / 2 - 0.2);
      const ry = Math.atan2(-cz, cx) + Math.PI;
      pour(placeBins(dolphin(lod, 'bronze', 0.55, { dive: 1.2 }), dx, Y + 0.48, dz, { ry, s: 1 }), out);
      if (lod < 2 && g >= 1) {
        // (The jet from its snout, inward, landing in the water.)
        const j = jet(dx - cx * 0.18, Y + 0.62, dz - cz * 0.12, 0.18, p.y, lod, { n: 1, spread: 0.32, r: 0.014 });
        // jet() throws round the nozzle; pointed inward by the spread's angle is close enough at this size.
        out.stream.push(...j.stream);
        out.ring.push(...j.rings);
      }
      void i;
    });
    // The god in bronze in the middle of the water, his trident raised (the left basin), a shell on a pillar (the right).
    if (g >= 0.8) {
      const top = Y + 0.12;
      out.trav.push(slab(0.6, 0.55, 0.6, { bevel: 0.02, seed: seed + 9, wobble: 0, tone: 0, grime: 0.2 }).translate(x, top - 0.12, z));
      if (s < 0) {
        pour(placeBins(trident(lod, 'bronze', 2.1), x + 0.18, top + 0.43, z), out);
        pour(placeBins(dolphin(lod, 'bronze', 0.9, { dive: 0.6 }), x - 0.05, top + 0.75, z, { ry: 0.4 }), out);
      } else {
        pour(placeBins(shell(lod, 'bronze', 0.42), x, top + 0.43, z, { ry: 0 }), out);
      }
    }
  }
  // The spring's mouth: a lion-head spout in the middle face's arch behind each basin, its stream falling in.
  if (g >= 0.4 && lod < 2) {
    for (const s of [-1, 1]) {
      const x = s * (WING.x0 + WING.x1) / 2;
      out.bronze.push(tintGeometry(boxUV(new SphereGeometry(0.14, lod ? 6 : 10, 6).scale(1, 1, 0.6).translate(x, Y + 1.0, FANUM.t2.z1 + 0.05))));
      if (g >= 1) out.stream.push(tube([[x, Y + 0.98, FANUM.t2.z1 + 0.14], [x, Y + 0.75, FANUM.t2.z1 + 0.42], [x, Y + 0.42, FANUM.t2.z1 + 0.6]], 0.03, { radial: 6, segments: 10, around: 0.05 }));
    }
  }
}

// ---------------------------------------------------------------------------
// Mercury: the market colonnade and the caduceus
// ---------------------------------------------------------------------------

/** A stall: a masonry counter with a marble top, an awning on two poles in stripes, goods laid out. */
function stall(out, x, z, ry, lod, seed, goods) {
  const rnd = artRng(seed);
  const c = Math.cos(ry);
  const sn = Math.sin(ry);
  const at = (dx, dz) => [x + dx * c + dz * sn, z - dx * sn + dz * c];
  const put = (g, dx, dy, dz) => {
    const [px, pz] = at(dx, dz);
    return g.rotateY(ry).translate(px, Y + dy, pz);
  };
  out.stucco.push(put(box(1.5, 0.82, 0.55, 0, 0, 0, 0.95), 0, 0, 0));
  out.fresco.push(put(box(1.52, 0.4, 0.012, 0, 0, 0.28, () => lin(0x7a3026, 1.25)), 0, 0, 0));
  out.marble.push(put(box(1.62, 0.06, 0.66, 0, 0, 0, 0.98), 0, 0.82, 0));
  // The awning: two poles at the back, the striped cloth sloping forward over the vendor.
  for (const k of [-1, 1]) out.props.push(dye(put(box(0.06, 2.1, 0.06, 0, 0, 0, 1), k * 0.78, 0, -0.55), lin(0x6b4a2e)));
  if (lod < 2) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const col = i % 2 ? lin(0xece4d0) : goods.stripe;
      const g = box(1.7 / n, 0.025, 1.05, -0.85 + (i + 0.5) * (1.7 / n), 0, 0, () => col);
      g.rotateX(-0.28);
      out.cloth.push(put(g, 0, 2.0, -0.12));
    }
  }
  // The goods on the counter: jars, rolls of cloth, heaps of fruit by the stall's kind.
  if (lod < 2) {
    for (let i = 0; i < 4; i++) {
      const dx = -0.55 + i * 0.36;
      const h = 0.18 + rnd() * 0.12;
      const g = goods.kind === 'jars'
        ? revolve(profileOf([[0, 0], [0.07, 0], [0.1, h * 0.5], [0.05, h], [0, h]]), { segments: lod ? 6 : 10, metres: 0.3 })
        : goods.kind === 'cloth'
          ? box(0.28, 0.12, 0.34, 0, 0, 0)
          : new SphereGeometry(0.12, lod ? 6 : 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      out.props.push(dye(put(tintGeometry(boxUV(g)), dx, 0.88, 0.05), goods.colours[i % goods.colours.length]));
    }
  }
}

function mercury(out, t, lod, seed) {
  const g = grow(t, 'gods');
  if (g <= 0) return;
  // The stalls along each wing, facing the axis's walk.
  const kinds = [
    { kind: 'jars', stripe: lin(0xa3352b), colours: [lin(0xb0643e), lin(0x9a5232)] },
    { kind: 'cloth', stripe: lin(0x3f5a85), colours: [lin(0x6a2248), lin(0xcfae4c), lin(0x5a6d3e), lin(0xa3352b)] },
    { kind: 'fruit', stripe: lin(0x5a6d3e), colours: [lin(0xc8a040), lin(0xa83a2a), lin(0x7a9a3a)] },
  ];
  const n = Math.max(1, Math.round(3 * g));
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i++) stall(out, s * (3.6 + i * 2.15), 4.1, 0, lod, seed + i * 7 + (s > 0 ? 50 : 0), kinds[(i + (s > 0 ? 1 : 0)) % 3]);
  }
  if (g < 0.5) return;
  // The caduceus on its column on the axis's landing below the stair; the god's winged hat on a pillar.
  for (const s of [-1, 1]) {
    const x = s * 2.15;
    const z = 5.9;
    out.trav.push(slab(0.5, 0.2, 0.5, { bevel: 0.02, seed: seed + 90 + s, wobble: 0, tone: 0, grime: 0.2 }).translate(x, Y, z));
    out.marble.push(tintGeometry(boxUV(new CylinderGeometry(0.13, 0.15, 2.2, lod ? 8 : 14, 1).translate(x, Y + 0.2 + 1.1, z))));
    out.marble.push(slab(0.36, 0.1, 0.36, { bevel: 0.015, seed: seed + 95 + s, wobble: 0, tone: 0, grime: 0 }).translate(x, Y + 2.4, z));
    if (s < 0) pour(placeBins(caduceus(lod, 'gilt', 1.3), x, Y + 2.5, z), out);
    else pour(placeBins(petasus(lod, 'gilt', 0.55), x, Y + 2.5, z, { ry: -0.6 }), out);
  }
  // A steelyard hung from a tripod by the first stall: the god of honest weights.
  if (lod < 2) {
    const x = -2.9;
    const z = 6.2;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      out.props.push(dye(tube([[x + Math.cos(a) * 0.45, Y, z + Math.sin(a) * 0.45], [x, Y + 1.8, z]], 0.03, { radial: 4, segments: 2, around: 0.1 }), lin(0x6b4a2e)));
    }
    out.bronze.push(box(0.9, 0.03, 0.03, x + 0.1, Y + 1.45, z));
    out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.16, 0.12, 0.05, lod ? 8 : 12, 1).translate(x - 0.3, Y + 1.0, z))));
  }
}

// ---------------------------------------------------------------------------
// Mars: the spoils and the sacred spears
// ---------------------------------------------------------------------------

function mars(out, t, lod, seed) {
  const g = grow(t, 'gods');
  if (g <= 0) return;
  // Trophies of arms on their bases along each wing.
  const n = Math.max(1, Math.round(3 * g));
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const x = s * (3.4 + i * 2.5);
      const z = 4.0 + (i % 2) * 1.4;
      const top = plinth(out, x, z, 0.8, 0.8, 0.5, seed + i * 3 + s);
      pour(placeBins(trophy(lod, 'bronze', 2.0), x, top, z, { ry: s * 0.3 }), out);
    }
  }
  if (g < 0.5) return;
  // Piles of taken shields and spears before the trophies.
  if (lod < 2) {
    const rnd = artRng(seed + 20);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = s * (4.6 + rnd() * 3.6);
        const z = 5.6 + rnd() * 0.8;
        const sh = clipeus(lod, 'bronze', 0.32 + rnd() * 0.08);
        pour(placeBins(sh, x, Y + 0.32, z, { ry: rnd() * 6, rx: -1.2 + rnd() * 0.3 }), out);
      }
      for (let i = 0; i < 3; i++) pour(placeBins(helmet(lod, 'bronze', 0.32), s * (5.2 + i * 1.3), Y + 0.04, 6.3, { ry: rnd() * 6 }), out);
    }
  }
  // The sacred spears in their rack on the right wing, under a little tiled roof.
  const rx = 3.0;
  const rz = 6.0;
  out.trav.push(slab(1.9, 0.18, 0.7, { bevel: 0.02, seed: seed + 40, wobble: 0, tone: 0, grime: 0.2 }).translate(rx + 0.9, Y, rz));
  out.props.push(dye(box(1.8, 0.08, 0.1, rx + 0.9, Y + 1.7, rz - 0.15), lin(0x6b4a2e)));
  for (const k of [-1, 1]) out.props.push(dye(box(0.1, 2.0, 0.1, rx + 0.9 + k * 0.85, Y + 0.18, rz - 0.15), lin(0x6b4a2e)));
  for (let i = 0; i < 6; i++) {
    const x = rx + 0.25 + i * 0.26;
    out.props.push(dye(tube([[x, Y + 0.18, rz + 0.05], [x + 0.02, Y + 2.25, rz - 0.18]], 0.018, { radial: 4, segments: 2, around: 0.1 }), lin(0x7a5a38)));
    out.bronze.push(tintGeometry(boxUV(new CylinderGeometry(0, 0.035, 0.24, lod ? 4 : 6, 1).translate(x + 0.02, Y + 2.37, rz - 0.19))));
  }
}

// ---------------------------------------------------------------------------
// Venus: myrtle, roses and doves
// ---------------------------------------------------------------------------

function venus(out, t, lod, seed) {
  const g = grow(t, 'gods');
  if (g <= 0) return;
  for (const s of [-1, 1]) {
    // Two beds a wing, edged with clipped myrtle, full of roses.
    for (const [a, b] of [[WING.x0 + 0.2, 5.4], [5.9, WING.x1 - 0.1]]) {
      const x0 = s > 0 ? a : -b;
      const x1 = s > 0 ? b : -a;
      const z0 = WING.z0 + 0.25;
      const z1 = WING.z1 - 0.3;
      out.earth.push(box(x1 - x0, 0.05, z1 - z0, (x0 + x1) / 2, Y - 0.02, (z0 + z1) / 2, 0.7));
      if (g < 0.3) continue;
      for (const geo of [
        ...hedge(x0, x1, z1 - 0.26, z1, 0.5, { lod, seed: seed + 1 }),
        ...hedge(x0, x1, z0, z0 + 0.26, 0.5, { lod, seed: seed + 2 }),
        ...hedge(x0, x0 + 0.26, z0 + 0.26, z1 - 0.26, 0.5, { lod, seed: seed + 3 }),
        ...hedge(x1 - 0.26, x1, z0 + 0.26, z1 - 0.26, 0.5, { lod, seed: seed + 4 }),
      ]) out.leaf.push(geo.translate(0, Y, 0));
      if (g < 0.6) continue;
      // Rose bushes in the bed, their flowers in Rosa gallica's reds and pinks.
      const rnd = artRng(seed + Math.round(x0 * 10));
      const nb = lod ? 4 : 7;
      for (let k = 0; k < nb; k++) {
        const bx = x0 + 0.5 + rnd() * (x1 - x0 - 1.0);
        const bz = z0 + 0.5 + rnd() * (z1 - z0 - 1.0);
        out.leaf.push(...bush(bx, Y + 0.35, bz, 0.32, { lod, seed: seed + 30 + k, squash: 0.9 }));
        if (lod < 2) {
          for (let f = 0; f < (lod ? 4 : 9); f++) {
            const fa = rnd() * Math.PI * 2;
            const fy = rnd() * 0.3;
            const c = [lin(0xc8343a), lin(0xd06a8a), lin(0xe8b0b8), lin(0xa02040)][f % 4];
            out.flowers.push(tintGeometry(boxUV(new SphereGeometry(0.055, lod ? 4 : 6, 3).scale(1, 0.75, 1).translate(bx + Math.cos(fa) * 0.3, Y + 0.45 + fy, bz + Math.sin(fa) * 0.3)), () => c));
          }
        }
      }
      out.flowers.push(...flowerBed(x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 0.3, Y, seed + 70, lod, 14));
    }
  }
  if (g < 0.5) return;
  // The dovecote on the left wing's front: a round tower of stucco, its nest holes, a cone of tiles; doves about.
  const dx = -5.6;
  const dz = 6.25;
  const seg = lod === 2 ? 8 : lod ? 12 : 20;
  out.stucco.push(revolve(profileOf([[0, 0], [0.36, 0], [0.34, 1.9], [0, 1.9]]), { segments: seg, metres: 1 }).translate(dx, Y, dz));
  out.clay.push(revolve(profileOf([[0, 1.9], [0.48, 1.9], [0, 2.45]]), { segments: seg, metres: 0.6 }).translate(dx, Y, dz));
  if (lod < 2) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3;
      out.dark.push(box(0.1, 0.1, 0.02, dx + Math.sin(a) * 0.35, Y + 1.25 + (k % 2) * 0.28, dz + Math.cos(a) * 0.35).rotateY(0));
    }
  }
  const rnd = artRng(seed + 90);
  const doves = lod === 2 ? 2 : lod ? 5 : 9;
  for (let k = 0; k < doves; k++) {
    const onRoof = k < 3;
    const x = onRoof ? dx + Math.cos(k * 2.1) * 0.3 : (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * 6);
    const z = onRoof ? dz + Math.sin(k * 2.1) * 0.3 : FANUM.t1.z1 - 0.15;
    const y = onRoof ? Y + 2.0 + (k === 0 ? 0.35 : 0) : Y + 0.63;
    pour(placeBins(dove(lod, 'marble', 0.24), x, y, z, { ry: rnd() * 6 }), out);
  }
  // Venus's shell over a little fountain basin on the right wing's front.
  out.marble.push(slab(1.1, 0.4, 0.6, { bevel: 0.02, seed: seed + 95, wobble: 0, tone: 0, grime: 0.1 }).translate(5.6, Y, 6.25));
  pour(placeBins(shell(lod, 'gilt', 0.4), 5.6, Y + 0.4, 6.15), out);
  out.water.push(box(0.95, 0.01, 0.45, 5.6, Y + 0.33, 6.25));
}

const GODS_GROUND = { ceres, neptune, mercury, mars, venus };

/** The god's own ground for fanum.js buildFanum's `extra`: adds to `out` at timeline `t`. */
export function godGround(god) {
  const fn = GODS_GROUND[god];
  return (out, t, lod) => fn(out, t, lod, 1500 + god.length * 31);
}

/** Torches and lampstands on the middle terrace by the stair (lit with the temple): their flames' places [x, y, z]. */
export const STAIR_LAMPS = Object.freeze([-1, 1].map((s) => Object.freeze([s * (FANUM.stairW + 0.55), FANUM.t2.y + 1.72, FANUM.t3.z1 + 1.95])));

/** The lampstands themselves and the honorary statues on the middle terrace, once the statues' time comes. */
export function middleTerrace(out, t, lod) {
  if (grow(t, 'statues') <= 0) return;
  const y0 = FANUM.t2.y;
  for (const [x, , z] of STAIR_LAMPS) {
    out.bronze.push(revolve(profileOf([[0, 0], [0.16, 0], [0.17, 0.04], [0.08, 0.1], [0.04, 0.18], [0.03, 0.24], [0.026, 1.55], [0.05, 1.6], [0.035, 1.63], [0.14, 1.68], [0.15, 1.72], [0, 1.71]]), { segments: lod === 2 ? 5 : lod ? 8 : 12, metres: 0.4 }).translate(x, y0, z));
  }
  // Statues of benefactors on their bases either side, facing the stair.
  if (lod < 2) {
    for (const s of [-1, 1]) {
      const x = s * 5.2;
      const z = 0.6;
      out.trav.push(slab(0.8, 0.12, 0.8, { bevel: 0.015, seed: 3 + s, wobble: 0, tone: 0, grime: 0.3 }).translate(x, y0, z));
      out.marble.push(slab(0.66, 0.85, 0.66, { bevel: 0.01, seed: 4 + s, wobble: 0, tone: 0, grime: 0.1 }).translate(x, y0 + 0.12, z));
      out.marble.push(slab(0.76, 0.09, 0.76, { bevel: 0.015, seed: 5 + s, wobble: 0, tone: 0, grime: 0 }).translate(x, y0 + 0.97, z));
      const body = revolve(profileOf([[0.22, 0], [0.23, 0.1], [0.2, 0.7], [0.17, 1.05], [0.21, 1.28], [0.22, 1.42], [0.16, 1.52], [0.05, 1.57], [0, 1.57]]), { segments: lod ? 8 : 12, metres: 0.5 });
      body.scale(1, 1, 0.75).translate(x, y0 + 1.06, z);
      out.marble.push(body);
      out.marble.push(tintGeometry(boxUV(new SphereGeometry(0.11, lod ? 7 : 10, 6).scale(0.92, 1.12, 1).translate(x, y0 + 1.06 + 1.7, z))));
    }
  }
  void TorusGeometry;
  void cypress;
  void emblemBins;
  void pourBins;
}
