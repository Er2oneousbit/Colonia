/**
 * models/concilium.js
 * ----------------------------------------------------------------------------
 * The native village's meeting place of the 3D look (Concilium, 2 x 2: 8 m),
 * from the record rather than the 2D sprite. Where a hill village gathered:
 * a cleared ring round a great hearth, under an old oak, by a sacred stone,
 * with a rough shelter at its back. The Iron Age peoples of Italy and Gaul
 * met in the open under trees held sacred (the oak's grove of the Gauls in
 * Lucan and Pliny, the lucus of the Italic peoples), and Lunigiana, the
 * Ligurians' own country above Luna, is full of its statue-stelae: slabs of
 * sandstone carved with a round head, a brow and nose, arms bent over the
 * body and, on the men's, a dagger across the belly, set up in the open,
 * and still set up in the Iron Age.
 *
 *   ligurian  the ring of stones round the hearth, the old downy oak, a
 *             statue-stele of the Lunigiana kind, a lean-to of poles roofed
 *             with bark slabs and thatch at the back, logs to sit on, and a
 *             fold of dry stone in a corner for the goats and sheep
 *   native    the same ring and oak, a ring of carved posts round it in place
 *             of the stele, the shelter a gabled hall of poles and thatch,
 *             the fold a wattle hurdle
 *
 * The parts that change with the village's state are kits of their own,
 * placed by models/villages.js: the fire (a cooking fire, or the great fire
 * of a village roused), the cauldron on its tripod over it (a calm
 * village's), the spears and shields leaning ready (an angry village's), the
 * goods laid out on hides for the native trader (a trading village's: Strabo
 * has the Ligurians trading hides, flocks and honey down at Genua; their
 * timber was famous for ships), and the oak (the woods' own downy oak, by the
 * month's look).
 *
 * Metres, the footprint's middle at the origin, y up. Levels of detail 0-2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry, IcosahedronGeometry, PlaneGeometry } from 'three';
import { boxUV, tintGeometry, tube, revolve, profileOf } from '../shapes.js';
import { artRng } from '../texgen.js';
import { TaggedParts } from './masonry.js';
import { blk, jar, basket, wattleFence, woodpile, lin, paint, mixc } from './rural.js';
import { villageMaterials, thatchSlope, dryRing, fireOn, gridGeo } from './villageKit.js';
import { MORTAR, SEAT_H } from '../people/clips.js';
import { buildTree } from '../flora/treeModel.js';
import { SPECIES } from '../flora/species.js';

const TAU = Math.PI * 2;

/** The meeting place's measures (metres), its people's places among them (models/villages.js). */
export const CONCILIUM = Object.freeze({
  /** The hearth's middle and its radius; the ring of stones round the clearing. */
  hearth: Object.freeze([0.25, 0.35]),
  fireR: 0.45,
  ring: 2.35,
  /** The oak's trunk [x, z] and its scale. */
  oak: Object.freeze([-2.2, -2.2, 0.5]),
  /** The fold [x0, z0, x1, z1] (its inside, where the flock wanders). */
  fold: Object.freeze([1.55, 1.75, 3.55, 3.6]),
  /** The logs to sit on: [x, z, turn] each (their tops at the clips' SEAT_H). */
  logs: Object.freeze([[-1.45, 0.55, 1.2], [0.4, -1.25, 0.15], [-1.0, 1.75, -0.9]]),
  /** Where the goods lie for the trader (front left). */
  goods: Object.freeze([-2.45, 2.35]),
  /** The stele's (or the posts' first) place. */
  stele: Object.freeze([1.65, -2.75]),
});

const C = CONCILIUM;

/** Lists by material. */
function bins() {
  return {
    stone: [], drystone: [], wood: [], bark: [], thatch: [], wicker: [], hide: [], clay: [], earth: [], dark: [],
    rope: [], iron: [], bronze: [], hot: [], ash: [], flames: [], produce: [], sack: [], leaf: [],
  };
}

/** A pole from a to b ([x, y, z]), radius r. */
function log(a, b, r, lod) {
  return tube([a, b], r, { radial: lod === 0 ? 8 : 5, segments: 1, around: 0.4 });
}

/** A log to sit on at (x, z) turned `ry`, lying on two flat stones so its top is at SEAT_H. */
function seatLog(out, x, z, ry, lod, seed) {
  const r = 0.17;
  const L = 1.25;
  const g = new CylinderGeometry(r, r * 1.05, L, lod === 0 ? 12 : lod === 1 ? 7 : 5, 1);
  g.rotateZ(Math.PI / 2);
  g.translate(0, SEAT_H - r, 0);
  // (Its top worn flat where it is sat on.)
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > SEAT_H - 0.03) p.setY(i, SEAT_H - 0.01);
  g.computeVertexNormals();
  g.rotateY(ry);
  g.translate(x, 0, z);
  out.bark.push(tintGeometry(boxUV(g), (px, py) => (py > SEAT_H - 0.03 ? 1.25 : 0.85)));
  for (const s of [-1, 1]) {
    const st = blk(lod, 0.26, SEAT_H - 2 * r + 0.04, 0.3, { bevel: 0.03, seed: seed + s, wobble: 0.02, grime: 0.4 });
    st.translate(s * 0.42, 0, 0).rotateY(ry).translate(x, 0, z);
    out.stone.push(st);
  }
}

/**
 * A statue-stele of the Lunigiana kind: a slab of sandstone rounded into a
 * head at its top (a U, the neck hollowed under it), the face a brow and nose
 * in one T, arms bent over the body in relief, a dagger across the belly in its
 * sheath; set in a few packing stones. At (x, z) facing `ry`.
 */
function stele(out, x, z, ry, lod) {
  const parts = [];
  const W = 0.46;
  const T = 0.16;
  const H = 1.25;
  // The body: the slab, and the head's round top on a narrower neck.
  parts.push(blk(lod, W, H - 0.38, T, { bevel: 0.03, seed: 71, wobble: 0.01, grime: 0.45 }));
  const neck = blk(lod, W * 0.62, 0.08, T * 0.9, { bevel: 0.015, seed: 72, wobble: 0.004, grime: 0 });
  parts.push(neck.translate(0, H - 0.4, 0));
  const head = new CylinderGeometry(W * 0.44, W * 0.44, T, lod === 0 ? 18 : 10, 1, false, 0, Math.PI);
  head.rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, H - 0.3, 0);
  parts.push(tintGeometry(boxUV(head), () => 0.95));
  parts.push(blk(lod, W * 0.88, 0.1, T, { bevel: 0.02, seed: 73, wobble: 0.004, grime: 0 }).translate(0, H - 0.34, 0));
  if (lod < 2) {
    const f = T / 2 + 0.008;
    // The brow and the nose: a T in relief.
    parts.push(blk(1, 0.22, 0.03, 0.02, { seed: 74 }).translate(0, H - 0.18, f));
    parts.push(blk(1, 0.035, 0.12, 0.02, { seed: 75 }).translate(0, H - 0.3, f));
    // The arms: from the shoulders down the sides and bent in over the chest, the hands meeting.
    for (const s of [-1, 1]) {
      parts.push(blk(1, 0.05, 0.3, 0.02, { seed: 76 + s }).translate(s * (W / 2 - 0.05), H - 0.78, f));
      const fore = blk(1, 0.17, 0.045, 0.02, { seed: 78 + s });
      fore.translate(-0.085, 0, 0).rotateZ(s * 0.25).translate(s * (W / 2 - 0.05) + (s < 0 ? 0.17 : 0), H - 0.8, f);
      parts.push(fore);
    }
    // The dagger across the belly: its sheath's blade, the hilt's crescent pommel.
    const d = blk(1, 0.26, 0.05, 0.022, { seed: 80 });
    d.rotateZ(-0.3).translate(0.02, H - 0.95, f);
    parts.push(d);
    parts.push(tintGeometry(boxUV(new SphereGeometry(0.04, 8, 4).scale(1, 0.6, 0.5).translate(-0.13, H - 0.89, f)), () => 0.9));
  }
  for (const g of parts) {
    g.rotateY(ry);
    g.translate(x, 0, z);
    out.stone.push(g);
  }
  // The packing stones round its foot.
  for (let k = 0; k < (lod === 2 ? 0 : 5); k++) {
    const a = (k / 5) * TAU + 0.4;
    const g = blk(lod, 0.2, 0.12, 0.16, { bevel: 0.03, seed: 90 + k, wobble: 0.02, grime: 0.5 });
    g.rotateY(a).translate(x + Math.sin(a) * 0.32, 0, z + Math.cos(a) * 0.22);
    out.drystone.push(g);
  }
}

/** A carved post of the generic people's ring: a trunk squared at its foot, rings cut near the top, a round head. */
function carvedPost(out, x, z, h, lod, seed) {
  const r = 0.11;
  const seg = lod === 0 ? 10 : lod === 1 ? 7 : 5;
  const P = profileOf([[r * 1.1, 0], [r, h * 0.7], [r * 1.25, h * 0.72], [r * 1.25, h * 0.76], [r * 0.9, h * 0.78], [r * 0.9, h * 0.84], [r * 1.2, h * 0.86], [r * 1.2, h * 0.9], [r * 0.7, h * 0.92], { arc: [0, h * 0.92 + r * 0.9, r * 0.95, -Math.PI / 2, Math.PI / 2], n: lod ? 3 : 6 }]);
  const g = revolve(P, { segments: seg, metres: 0.6, tint: (p) => 0.7 + 0.3 * Math.min(1, p.y / 0.5) });
  g.rotateY(seed);
  out.wood.push(g.translate(x, 0, z));
  if (lod === 0) {
    // Eyes cut in the head, facing the fire.
    for (const s of [-1, 1]) out.dark.push(tintGeometry(boxUV(new SphereGeometry(0.022, 6, 4).translate(x + s * 0.045, h * 0.92 + r * 0.95, z)), () => 0.3));
  }
}

/** The Ligurian shelter: a lean-to of poles along the back, its roof of bark slabs under thatch sloping to the front. */
function leanTo(out, lod, seed) {
  const x0 = 0.15;
  const x1 = 3.7;
  const zb = -3.65;
  const zf = -2.45;
  const yb = 2.05;
  const yf = 1.5;
  const posts = lod === 2 ? [x0 + 0.1, x1 - 0.1] : [x0 + 0.1, (x0 + x1) / 2, x1 - 0.1];
  for (const x of posts) {
    out.wood.push(log([x, 0, zb + 0.08], [x, yb, zb + 0.08], 0.075, lod));
    out.wood.push(log([x, 0, zf], [x, yf, zf], 0.07, lod));
    out.wood.push(log([x, yb, zb], [x, yf - 0.05, zf + 0.25], 0.05, lod));
  }
  out.wood.push(log([x0, yb, zb + 0.08], [x1, yb, zb + 0.08], 0.06, lod));
  out.wood.push(log([x0, yf, zf], [x1, yf, zf], 0.06, lod));
  out.thatch.push(...thatchSlope({ x0: x0 - 0.15, x1: x1 + 0.15, zEave: zf + 0.42, zRidge: zb - 0.12, eaveY: yf - 0.08, ridgeY: yb + 0.12, thick: 0.16, lod, seed, tone: 0.78 }));
  // The back closed with hurdles against the wind.
  const f = wattleFence([[x0, zb], [x1, zb]], { h: 1.6, seed: seed + 4, lod });
  out.wicker.push(...f.wicker);
  // Under it: firewood stacked, a few jars.
  out.bark.push(...woodpile(1.4, 0.7, seed + 5, lod).map((g) => g.translate(2.3, 0, -3.15)));
  if (lod < 2) for (const [x, s] of [[0.7, 0.42], [1.05, 0.36]]) out.clay.push(jar({ lod, seed: Math.round(x * 10) }).scale(s, s, s).translate(x, 0, -3.2));
}

/** The generic people's shelter: a gabled hall of poles at the back, open at the front, thatched. */
function poleHall(out, lod, seed) {
  const x0 = 0.25;
  const x1 = 3.6;
  const z0 = -3.6;
  const z1 = -2.35;
  const eave = 1.55;
  const ridge = 2.55;
  const zr = (z0 + z1) / 2;
  const xs = lod === 2 ? [x0, x1] : [x0, (x0 + x1) / 2, x1];
  for (const x of xs) for (const z of [z0, z1]) out.wood.push(log([x, 0, z], [x, eave, z], 0.075, lod));
  for (const z of [z0, z1]) out.wood.push(log([x0 - 0.1, eave, z], [x1 + 0.1, eave, z], 0.06, lod));
  out.wood.push(log([x0 - 0.1, ridge, zr], [x1 + 0.1, ridge, zr], 0.06, lod));
  for (const x of xs) for (const z of [z0, z1]) out.wood.push(log([x, eave, z], [x, ridge, zr], 0.045, lod));
  for (const s of [-1, 1]) out.thatch.push(...thatchSlope({ x0: x0 - 0.22, x1: x1 + 0.22, zEave: s > 0 ? z1 + 0.28 : z0 - 0.1, zRidge: zr, eaveY: eave - 0.06, ridgeY: ridge + 0.1, thick: 0.18, lod, seed: seed + s, tone: 0.85 }));
  // The back wall of hurdles, the firewood, a bench.
  const f = wattleFence([[x0, z0], [x1, z0]], { h: 1.45, seed: seed + 4, lod });
  out.wicker.push(...f.wicker);
  out.bark.push(...woodpile(1.2, 0.6, seed + 5, lod).map((g) => g.translate(2.6, 0, -3.25)));
}

/** The fold: dry stone (the Ligurians') or hurdles (the generic people's), its gate a hurdle across the gap. */
function fold(out, people, lod, seed) {
  const [x0, z0, x1, z1] = C.fold;
  const gap = 0.7;
  const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  if (people === 'ligurian') {
    const h = 0.75;
    const t = 0.32;
    const wall = (ax, az, bx, bz) => {
      const L = Math.hypot(bx - ax, bz - az);
      const g = blk(1, L + t, h, t, { bevel: 0.04, seed: seed + Math.round(ax * 5 + az * 3), wobble: 0.03, grime: 0.35 });
      g.rotateY(Math.atan2(bx - ax, bz - az) + Math.PI / 2);
      g.translate((ax + bx) / 2, 0, (az + bz) / 2);
      out.drystone.push(boxUV(g));
    };
    wall(x0 - t / 2, z0 - t / 2, x1 + t / 2, z0 - t / 2);
    wall(x1 + t / 2, z0 - t / 2, x1 + t / 2, z1 + t / 2);
    wall(x0 - t / 2, z1 + t / 2, x1 + t / 2, z1 + t / 2);
    // The west side with its gate's gap toward the clearing.
    wall(x0 - t / 2, z0 - t / 2, x0 - t / 2, z0 + 0.25);
    wall(x0 - t / 2, z0 + 0.25 + gap, x0 - t / 2, z1 + t / 2);
    // Capstones along the top (the full level).
    if (lod === 0) {
      const rnd = artRng(seed + 9);
      // (Each side with the way out from the fold: the capstones sit on the wall's middle line.)
      for (const [[ax, az], [bx, bz], [ox, oz]] of [[corners[0], corners[1], [0, -t / 2]], [corners[1], corners[2], [t / 2, 0]], [corners[2], corners[3], [0, t / 2]]]) {
        const L = Math.hypot(bx - ax, bz - az);
        const n = Math.round(L / 0.36);
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n;
          const g = blk(1, 0.32 + rnd() * 0.06, 0.1 + rnd() * 0.04, t * 0.9, { seed: seed + 20 + k, wobble: 0.02, grime: 0.15 });
          g.rotateZ((rnd() - 0.5) * 0.15).rotateY(Math.atan2(bx - ax, bz - az) + Math.PI / 2);
          g.translate(ax + (bx - ax) * u + ox, h - 0.04, az + (bz - az) * u + oz);
          out.drystone.push(g);
        }
      }
    }
  } else {
    const f = wattleFence([[x0 - 0.05, z0 + 0.25], [x0 - 0.05, z0 - 0.05], [x1 + 0.05, z0 - 0.05], [x1 + 0.05, z1 + 0.05], [x0 - 0.05, z1 + 0.05], [x0 - 0.05, z0 + 0.25 + gap]], { h: 0.95, seed, lod });
    out.wicker.push(...f.wicker);
    out.wood.push(...f.wood);
  }
  // The gate: a hurdle leaning open against the wall beside the gap.
  const g = wattleFence([[x0 - 0.45, z0 + 0.15], [x0 - 0.62, z0 + 0.85]], { h: 0.85, seed: seed + 3, lod });
  out.wicker.push(...g.wicker);
  // Straw and dung inside: a dark trodden floor.
  const floor = new PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
  out.earth.push(tintGeometry(boxUV(floor), () => [0.55, 0.48, 0.38]));
  // A water trough of a hollowed log.
  if (lod < 2) {
    const tr = new CylinderGeometry(0.16, 0.16, 0.9, lod === 0 ? 10 : 6, 1, false, Math.PI / 2, Math.PI);
    tr.rotateZ(Math.PI / 2).rotateX(Math.PI).translate(x1 - 0.3, 0.16, z0 + 1.0).rotateY(0);
    out.bark.push(tintGeometry(boxUV(tr), () => 0.8));
  }
}

/**
 * The meeting place's own kit: the ring of stones round the clearing, the
 * hearth's kerb, the logs to sit on, the shelter, the fold, the stele (or the
 * carved posts), the war horn hung on the shelter's post.
 */
export function buildConcilium(people, { lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bins();
  const seed = people === 'ligurian' ? 1200 : 1300;
  // The clearing's edge: low stones laid in a ring (broken where the paths come in).
  if (lod < 2) {
    const rnd = artRng(seed);
    const n = lod === 0 ? 34 : 18;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      if (Math.abs(Math.sin(a * 2 + 0.6)) > 0.93) continue;
      const g = blk(lod, 0.26 + rnd() * 0.12, 0.12 + rnd() * 0.06, 0.2, { bevel: 0.03, seed: seed + k, wobble: 0.02, grime: 0.4 });
      g.rotateY(a + Math.PI / 2).translate(Math.sin(a) * C.ring + C.hearth[0] * 0.3, -0.02, Math.cos(a) * C.ring + C.hearth[1] * 0.3);
      out.drystone.push(g);
    }
  }
  // The hearth's kerb (its fire is a kit of its own: fireKit).
  const [hx, hz] = C.hearth;
  const kerb = dryRing({ rx: C.fireR + 0.18, rz: C.fireR + 0.18, h: 0.16, t: 0.2, lod: Math.max(1, lod), seed: seed + 3, caps: false });
  out.drystone.push(...kerb.stone.map((g) => g.translate(hx, 0, hz)));
  out.ash.push(tintGeometry(boxUV(new CylinderGeometry(C.fireR, C.fireR, 0.03, lod ? 10 : 18, 1).translate(hx, 0.01, hz)), () => 0.5));
  C.logs.forEach(([x, z, ry], k) => seatLog(out, x, z, ry, lod, seed + 30 + k * 3));
  if (people === 'ligurian') {
    leanTo(out, lod, seed + 50);
    stele(out, C.stele[0], C.stele[1], -0.35, lod);
  } else {
    poleHall(out, lod, seed + 50);
    // The ring of carved posts round the clearing's back half.
    const posts = [[-3.1, -0.9], [-2.75, 1.1], [-0.85, -3.0], [1.35, 3.2], [3.2, 0.6], [-1.35, 3.1]];
    posts.forEach(([x, z], k) => carvedPost(out, x, z, 1.7 + (k % 3) * 0.18, lod, k * 1.3));
  }
  fold(out, people, lod, seed + 70);
  // The war horn hung on the shelter's front post by its strap (taken down when the village is roused).
  return partsOf(`concilium-${people}`, out);
}

/** The fire on the hearth: 'small' a cooking fire under the cauldron, 'great' the fire of a village roused. */
export function buildFire(size, { lod = 0 } = {}) {
  const out = bins();
  const [hx, hz] = C.hearth;
  const f = fireOn(hx, 0.02, hz, size === 'great' ? C.fireR : C.fireR * 0.75, { lod, seed: size === 'great' ? 41 : 42, big: size === 'great' ? 2.6 : 1.1, kerb: false });
  out.hot.push(...f.hot);
  out.ash.push(...f.dark);
  out.flames.push(...f.flames);
  out.bark.push(...f.bark);
  return partsOf(`concilium-fire-${size}`, out);
}

/**
 * The cauldron on its tripod over the fire (a calm village's meal cooking):
 * three poles lashed at the top, a chain, a bronze cauldron its rim at the
 * stir clip's height (MORTAR) where the cook stands.
 */
export function buildCauldron({ lod = 0 } = {}) {
  const out = bins();
  const [hx, hz] = C.hearth;
  const top = 2.0;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + 0.5;
    out.wood.push(log([hx + Math.sin(a) * 0.95, 0, hz + Math.cos(a) * 0.95], [hx + Math.sin(a) * 0.06, top + 0.12, hz + Math.cos(a) * 0.06], 0.035, lod));
  }
  const rim = MORTAR.height;
  const r = 0.27;
  out.iron.push(log([hx, top, hz], [hx, rim + 0.2, hz], 0.008, lod));
  for (const s of [-1, 1]) out.iron.push(log([hx, rim + 0.2, hz], [hx + s * r * 0.95, rim, hz], 0.006, lod));
  const seg = lod === 0 ? 20 : lod === 1 ? 12 : 7;
  const pot = revolve(profileOf([[0, rim - 0.3], [r * 0.6, rim - 0.29], [r * 0.95, rim - 0.18], [r, rim - 0.06], [r * 0.92, rim], [r * 0.98, rim + 0.02], [r * 0.9, rim + 0.01], [r * 0.85, rim - 0.04]]), { segments: seg, metres: 0.5, tint: (p) => (p.y < rim - 0.15 ? 0.35 : 0.9) });
  out.bronze.push(pot.translate(hx, 0, hz));
  // The broth's surface.
  out.produce.push(paint(new CylinderGeometry(r * 0.84, r * 0.84, 0.01, seg, 1).translate(hx, rim - 0.06, hz), lin(0x6a4a2a)));
  return partsOf('concilium-cauldron', out);
}

/** The village roused: spears leaning against the shelter, shields by them, a fire-hardened stake rack. */
export function buildArms(people, { lod = 0 } = {}) {
  const out = bins();
  const n = lod === 2 ? 4 : 9;
  const rnd = artRng(55);
  const x0 = people === 'ligurian' ? 0.6 : 0.7;
  for (let k = 0; k < n; k++) {
    const x = x0 + k * 0.32 + (rnd() - 0.5) * 0.08;
    const foot = [x, 0, -1.5 + (rnd() - 0.5) * 0.1];
    const tip = [x + (rnd() - 0.5) * 0.25, 1.42 + rnd() * 0.06, -2.4];
    out.wood.push(log(foot, tip, 0.016, lod));
    if (lod < 2) {
      const dx = tip[0] - foot[0];
      const dy = tip[1] - foot[1];
      const dz = tip[2] - foot[2];
      const L = Math.hypot(dx, dy, dz);
      out.iron.push(log(tip, [tip[0] + (dx / L) * 0.25, tip[1] + (dy / L) * 0.25, tip[2] + (dz / L) * 0.25], 0.022, lod));
    }
  }
  // The shields: small and round (the Ligurians'), or long and oval, leaning on the posts.
  const shields = lod === 2 ? 2 : 4;
  for (let k = 0; k < shields; k++) {
    const x = x0 + 0.2 + k * 0.75;
    const seg = lod === 0 ? 18 : 10;
    const ligur = people === 'ligurian';
    const g = new CylinderGeometry(ligur ? 0.3 : 0.28, ligur ? 0.3 : 0.28, 0.03, seg, 1);
    g.rotateX(Math.PI / 2 - 0.22);
    if (!ligur) g.scale(1, 1.75, 1);
    g.translate(x, ligur ? 0.32 : 0.5, -1.62);
    const col = [lin(0x7a5434), lin(0x6a4a30), lin(0x8a6a3a), lin(0x5a4430)][k % 4];
    out.hide.push(paint(boxUV(g), col, (px, py) => 0.85 + 0.15 * Math.sin(py * 20)));
    out.bronze.push(tintGeometry(boxUV(new SphereGeometry(0.06, 8, 4, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2 - 0.22).translate(x, ligur ? 0.32 : 0.5, -1.6)), () => 0.9));
  }
  return partsOf(`concilium-arms-${people}`, out);
}

/**
 * The goods laid out on hides for the native trader: stacked hides, rolled
 * fleeces, jars of honey sealed with wax, rounds of cheese on a board, a
 * bundle of planks of the mountains' timber, a basket of chestnuts.
 */
export function buildGoods({ lod = 0 } = {}) {
  const out = bins();
  const [gx, gz] = C.goods;
  const rnd = artRng(66);
  // The hide spread on the ground under it all.
  const spread = gridGeo(2, 2, (i, j) => ({ p: [gx - 0.75 + 1.5 * (j / 2) + (i === 1 ? 0 : (rnd() - 0.5) * 0.1), 0.02, gz - 0.6 + 1.2 * (i / 2)], uv: [j, i], c: lin(0x8a6040) }), { flip: true });
  out.hide.push(spread);
  // A stack of hides, folded.
  for (let k = 0; k < (lod === 2 ? 2 : 5); k++) {
    const g = blk(lod, 0.62 - k * 0.02, 0.05, 0.42, { bevel: 0.02, seed: 70 + k, wobble: 0.015, grime: 0 });
    g.rotateY((rnd() - 0.5) * 0.2).translate(gx - 0.35, 0.03 + k * 0.05, gz - 0.25);
    out.hide.push(paint(g, mixc(lin(0x7a5232), lin(0x9a7048), (k % 3) / 2)));
  }
  // Fleeces rolled and tied.
  for (let k = 0; k < (lod === 2 ? 1 : 3); k++) {
    const g = new CylinderGeometry(0.13, 0.13, 0.42, lod === 0 ? 10 : 6, 1);
    g.rotateZ(Math.PI / 2).translate(gx + 0.35, 0.15 + (k === 2 ? 0.24 : 0), gz - 0.32 + (k === 2 ? 0.13 : k * 0.27));
    out.hide.push(paint(boxUV(g), lin([0xdcd0b4, 0xb8a888, 0x6a5240][k])));
  }
  // Honey: jars with their mouths sealed.
  if (lod < 2) {
    for (const [dx, dz] of [[-0.45, 0.3], [-0.22, 0.38], [-0.33, 0.12]]) out.clay.push(jar({ lod, seed: 3 }).scale(0.24, 0.24, 0.24).translate(gx + dx, 0.02, gz + dz));
    // Cheeses on a board.
    out.wood.push(blk(lod, 0.5, 0.04, 0.3, { bevel: 0.01, seed: 77, wobble: 0, grime: 0.1 }).translate(gx + 0.25, 0.02, gz + 0.3));
    for (const [dx, dz] of [[0.12, 0.25], [0.32, 0.3], [0.22, 0.36]]) out.produce.push(paint(new CylinderGeometry(0.08, 0.085, 0.07, lod === 0 ? 12 : 7, 1).translate(gx + dx, 0.095, gz + dz), lin(0xe8dcb0)));
    const b = basket(0.17, 0.18, 1, lod);
    out.wicker.push(b.wicker.translate(gx + 0.62, 0.02, gz + 0.35));
    if (b.fill) out.produce.push(paint(b.fill.translate(gx + 0.62, 0.02, gz + 0.35), lin(0x5a3220)));
  }
  // A bundle of planks of mountain fir and oak, tied.
  const planks = lod === 2 ? 1 : 4;
  for (let k = 0; k < planks; k++) out.wood.push(blk(lod, 0.22, 0.05, 1.5, { bevel: 0.008, seed: 80 + k, wobble: 0.004, grime: 0.1 }).rotateY(0.35).translate(gx + 0.92 - k * 0.02, 0.02 + k * 0.05, gz - 0.55 + k * 0.03));
  return partsOf('concilium-goods', out);
}

/**
 * The sacred oak (the woods' downy oak, flora/treeModel.js, in the month's
 * `look`) at its place, or, at the far level, a few masses of leaf on a trunk
 * (the woods draw theirs as impostors there).
 */
export function buildOak(look, { lod = 0, variant = 1 } = {}) {
  const [x, z, k] = C.oak;
  if (lod < 2) {
    const t = buildTree({ species: 'oak', variant, look, lod });
    for (const m of t.meshes) {
      m.geometry.scale(k, k, k);
      m.geometry.translate(x, 0, z);
    }
    return t.group;
  }
  const out = bins();
  out.bark.push(tintGeometry(boxUV(new CylinderGeometry(0.16, 0.26, 2.4, 6, 1).translate(x, 1.2, z)), () => 0.7));
  const s = SPECIES.oak;
  const bare = look === 'bare' || look === 'dead';
  if (!bare) {
    const col = lin((s.colours[look] || s.colours.leaf)[0]);
    const rnd = artRng(5);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.3;
      const g = new IcosahedronGeometry(1.0 + rnd() * 0.3, 1);
      g.scale(1, 0.75, 1).translate(x + Math.sin(a) * 0.75 * k, 3.4 * k + rnd() * 0.5, z + Math.cos(a) * 0.75 * k);
      out.leaf.push(paint(boxUV(g), col, (px, py) => 0.7 + 0.3 * Math.min(1, (py - 2.5) / 1.6)));
    }
  }
  return partsOf('concilium-oak-far', out).group;
}

/** Into parts by material: { group, meshes, triangles }. */
function partsOf(name, out) {
  const m = villageMaterials();
  const p = new TaggedParts(name);
  const small = { cast: false };
  p.add('stone', m.stone, out.stone);
  p.add('drystone', m.drystone, out.drystone);
  p.add('wood', m.wood, out.wood);
  p.add('bark', m.bark, out.bark);
  p.add('thatch', m.thatch, out.thatch);
  p.add('wicker', m.wicker, out.wicker);
  p.add('hide', m.hide, out.hide);
  p.add('clay', m.clay, out.clay);
  p.add('earth', m.earth, out.earth, small);
  p.add('inside', m.dark, out.dark, small);
  p.add('rope', m.rope, out.rope, small);
  p.add('iron', m.iron, out.iron, small);
  p.add('bronze', m.bronze, out.bronze);
  p.add('produce', m.produce, out.produce, small);
  p.add('sack', m.sack, out.sack);
  p.add('leaf', m.leaf, out.leaf);
  p.add('embers', m.embers, out.hot, small);
  p.add('coals', m.ash, out.ash, small);
  p.add('flames', m.flame, out.flames, small);
  return p.build();
}
