/**
 * models/tugurium.js
 * ----------------------------------------------------------------------------
 * The native hut of the 3D look (Tugurium, 1 x 1: a tile of 4 m), from the
 * record rather than the 2D sprite. Two peoples, three forms each, so a
 * village of eight huts is not a pattern:
 *
 * The Ligurians (the missions' villages: Mutina's hills, Luna's), hill
 * farmers and herders of the northern Apennines and the Ligurian Alps.
 * Diodorus (V.39) has them on rough, stony land, the women working as hard
 * as the men, living in poor huts; Strabo (IV.6.2) on their flocks, milk and
 * a drink of barley, trading hides, flocks and honey down at Genua. Their
 * hillforts (castellari: Uscio, Zignago, Bergiola) are terraces and footings
 * of stone laid dry, the huts' upper walls of wattle and daub (the burnt daub
 * keeps the rods' prints) under thatch:
 *   round   a ring of dry stone to the knee, wattle and daub over it to the
 *           eaves, a cone of thatch with its smoke hole bound round
 *   oval    the same, longer than wide (the castellari's huts are often oval)
 *   stone   higher up, a small rectangular hut of dry stone to the eaves and
 *           in its gables, thatched steep, the thatch held down against the
 *           mountain wind by ropes weighted with stones
 *
 * The sandbox's generic people: an Iron Age village of Italy of the same
 * kind, varied in roof and wall from the Ligurian:
 *   capanna     the Latial hut the urns of the Alban Hills and the Palatine's
 *               post holes show: oval, a wall of posts, wattle and daub, a
 *               ridged roof of thatch whose ridge timbers cross at each end
 *               (the urns' horns), a porch over the door
 *   roundhouse  a round house of the Celtic north (the Po plain's), its wall
 *               of daub washed pale with lime, its roof steep and low
 *   longhut     a rectangular hut of posts and daub, its thatch hipped
 *
 * A hut stands in its tile's middle with its door toward +z; the game turns
 * the whole hut so its door faces its meeting place (models/villages.js), so
 * every hut keeps within a circle of 2 m round its tile's middle (any turn
 * fits the tile: the tests check). Its yard's things are kits of their own
 * (yardThing), placed by the village's entry in the hut's frame: a saddle
 * quern (QUERN: where the grinder kneels), a woodpile, storage jars and a
 * cooking pot, a rack with a fleece and a hide, a warp-weighted loom, a
 * chopping block, a hurdle, a beehive.
 *
 * Inside, seen through the door: the dark, and the hearth's embers glowing
 * (a hut's fire is never let out). The smoke through the thatch is a kit of
 * its own (models/villages.js). Metres, the tile's middle at the origin, y up.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, PlaneGeometry, SphereGeometry } from 'three';
import { boxUV, tintGeometry, tube } from '../shapes.js';
import { artRng } from '../texgen.js';
import { TaggedParts } from './masonry.js';
import { blk, woodpile, jar, basket, wattleFence, lin, paint } from './rural.js';
import { villageMaterials, thatchCone, thatchCrown, thatchSlope, ringWall, dryRing, fireOn, gridGeo } from './villageKit.js';
import { QUERN } from '../people/clips.js';

/** The hut forms of each people. */
export const HUT_FORMS = Object.freeze({
  ligurian: Object.freeze(['round', 'oval', 'stone']),
  native: Object.freeze(['capanna', 'roundhouse', 'longhut']),
});

/**
 * Each form's measures: its door's middle on the ground (x, z: where the
 * door's lamp glows), the apex where its smoke rises (x, y, z), and the roof's
 * reach on the ground (`eave`: an oval rx x rz about (0, cz), or with `rect`
 * the half sizes of a rectangle, `porch` a second one), which nobody standing
 * in the yard may be under (models/villages.js YARD; the tests check it).
 */
export const HUT = Object.freeze({
  round: { door: [0, 1.2], apex: [0, 3.48, -0.15], eave: { rx: 1.8, rz: 1.8, cz: -0.15 } },
  oval: { door: [0, 1.08], apex: [0, 3.2, -0.08], eave: { rx: 1.93, rz: 1.55, cz: -0.08 } },
  stone: { door: [0, 1.02], apex: [0.85, 2.85, 0], eave: { rect: [1.4, 1.27] } },
  capanna: { door: [0, 1.2], apex: [0.62, 3.05, 0], eave: { rx: 1.91, rz: 1.47, cz: 0, porch: [0.7, 1.77] } },
  roundhouse: { door: [0, 1.5], apex: [0, 3.5, 0], eave: { rx: 1.95, rz: 1.95, cz: 0 } },
  longhut: { door: [0, 1.0], apex: [0.75, 2.75, 0], eave: { rect: [1.53, 1.22] } },
});

/** Is the point (x, z) of a hut's frame under its roof (`margin` metres round it counted in)? */
export function underEave(form, x, z, margin = 0) {
  const e = HUT[form].eave;
  if (e.rect) return Math.abs(x) < e.rect[0] + margin && Math.abs(z) < e.rect[1] + margin;
  if (e.porch && Math.abs(x) < e.porch[0] + margin && z < e.porch[1] + margin && z > 0) return true;
  return (x / (e.rx + margin)) ** 2 + ((z - e.cz) / (e.rz + margin)) ** 2 < 1;
}

/** The things of a hut's yard (yardThing). */
export const YARD_THINGS = Object.freeze(['quern', 'woodpile', 'pots', 'rack', 'loom', 'chop', 'hurdle', 'skep']);

/** A list of empty bins by material name. */
function bins() {
  return {
    thatch: [], daub: [], drystone: [], stone: [], wood: [], bark: [], wicker: [], earth: [], hide: [], clay: [],
    dark: [], rope: [], iron: [], hot: [], ash: [], flames: [], sack: [], produce: [],
  };
}

/** A post (a pole of the frame) from y0 to y1 at (x, z), radius r, a little out of true. */
function pole(x, z, y0, y1, r, lod, seed = 1) {
  const g = new CylinderGeometry(r * 0.9, r, y1 - y0, lod === 0 ? 8 : lod === 1 ? 6 : 4, 1);
  g.translate(x, (y0 + y1) / 2, z);
  g.rotateZ(((seed * 0.37) % 1 - 0.5) * 0.03);
  return tintGeometry(boxUV(g), (px, py) => 0.7 + 0.3 * Math.min(1, (py - y0) / 0.6));
}

/** A log or beam from a to b ([x, y, z]), radius r. */
function log(a, b, r, lod) {
  return tube([a, b], r, { radial: lod === 0 ? 7 : 5, segments: 1, around: 0.4 });
}

/**
 * The doorway: two posts, the lintel, a threshold stone, the dark of the
 * inside, a hide hung half across it on its lintel, and the hearth inside
 * glowing (seen through it). At (0, z) facing +z, `w` wide, `h` high.
 */
function doorway(out, z, w, h, lod, seed, { depth = 0.2, posts = true, hide = true } = {}) {
  if (posts) {
    for (const s of [-1, 1]) out.wood.push(blk(lod, 0.11, h + 0.04, 0.12, { bevel: 0.015, seed: seed + s, wobble: 0.01, grime: 0.45 }).translate(s * (w / 2 + 0.05), 0, z));
    out.wood.push(blk(lod, w + 0.36, 0.13, 0.16, { bevel: 0.015, seed: seed + 5, wobble: 0.01, grime: 0.1 }).translate(0, h, z));
  }
  out.drystone.push(blk(lod, w + 0.1, 0.06, 0.36, { bevel: 0.02, seed: seed + 7, wobble: 0.01, grime: 0.2 }).translate(0, -0.02, z + 0.04));
  // The dark inside: the opening's back, set in by the wall's depth.
  const d = new PlaneGeometry(w + 0.02, h, 1, 1).translate(0, h / 2, z - depth);
  out.dark.push(tintGeometry(boxUV(d), () => 0.6));
  if (hide && lod < 2) {
    // A hide hung on the lintel, drawn to one side: bellied, its edge ragged.
    const g = gridGeo(4, 3, (i, j) => {
      const u = j / 3;
      const v = i / 4;
      const x = -w / 2 + 0.04 + u * w * 0.45 * (1 - 0.35 * (1 - v));
      return { p: [x, h - 0.02 - (1 - v) * (h - 0.12), z + 0.075 + 0.03 * Math.sin(Math.PI * u) + 0.02 * (1 - v)], uv: [x, v * h], c: lin(0x6a4a30, 0.9 + 0.1 * v) };
    }, { flip: false });
    out.hide.push(g);
  }
}

/** The hearth inside a hut at (x, z): its embers, a little flame, seen through the door at night and by day. */
function hearthInside(out, x, z, lod, seed) {
  // (Past the full level the door is a few pixels: its fire would be three more draws a hut kit for nothing seen.)
  if (lod > 0) return;
  const f = fireOn(x, 0.02, z, 0.2, { lod: 1, seed, big: 0.55, kerb: true });
  out.stone.push(...f.stone);
  out.hot.push(...f.hot);
  out.ash.push(...f.dark);
  out.flames.push(...f.flames);
}

// ---------------------------------------------------------------------------
// The Ligurian huts
// ---------------------------------------------------------------------------

/** Round: a footing of dry stone, wattle and daub over it, a cone of thatch. */
function ligRound(out, lod, seed, tone) {
  const cz = -0.15;
  const R = 1.28;
  const door = 0.78;
  out.drystone.push(...dryRing({ rx: R, rz: R, cz, h: 0.55, t: 0.34, door, lod, seed }).stone);
  const w = ringWall({ rx: R - 0.05, rz: R - 0.05, cz, y0: 0.5, y1: 1.5, t: 0.15, door, lod, seed: seed + 1, bulge: 0.015 });
  out.daub.push(...w.outer, ...w.top);
  out.dark.push(...w.inner);
  const dz = cz + Math.sqrt(R * R - (door / 2) ** 2);
  doorway(out, dz, door, 1.42, lod, seed + 10, { depth: 0.36 });
  out.thatch.push(...thatchCone({ rx: 1.76, rz: 1.76, cz, eaveY: 1.36, apexY: 3.42, thick: 0.26, lod, seed: seed + 2, tone }));
  const c = thatchCrown(0, 3.3, cz, 0.17, 0.2, lod, tone);
  out.thatch.push(...c.thatch);
  out.dark.push(...c.dark);
  hearthInside(out, 0.1, cz - 0.1, lod, seed + 20);
}

/** Oval: as the round hut, longer across (x) than deep. */
function ligOval(out, lod, seed, tone) {
  const cz = -0.08;
  const rx = 1.5;
  const rz = 1.1;
  const door = 0.76;
  out.drystone.push(...dryRing({ rx, rz, cz, h: 0.5, t: 0.34, door, lod, seed }).stone);
  const w = ringWall({ rx: rx - 0.05, rz: rz - 0.05, cz, y0: 0.45, y1: 1.42, t: 0.15, door, lod, seed: seed + 1, bulge: 0.015 });
  out.daub.push(...w.outer, ...w.top);
  out.dark.push(...w.inner);
  doorway(out, cz + rz - 0.02, door, 1.36, lod, seed + 10, { depth: 0.34 });
  out.thatch.push(...thatchCone({ rx: 1.88, rz: 1.5, cz, eaveY: 1.3, apexY: 3.18, thick: 0.25, ridge: 0.38, lod, seed: seed + 2, tone }));
  // The ridge's binding: a roll of straw along it, its ends bound.
  out.thatch.push(log([-0.46, 3.16, cz], [0.46, 3.16, cz], 0.13, lod));
  out.dark.push(...thatchCrown(0, 3.12, cz, 0.12, 0.14, lod, tone).dark);
  hearthInside(out, -0.2, cz - 0.05, lod, seed + 20);
}

/**
 * Stone: a rectangular hut of dry stone to the eaves (2.6 x 2.0 m outside),
 * its gables in dry stone to the ridge, the thatch steep on two slopes and
 * held down by ropes over the ridge, each end weighted with a stone.
 */
function ligStone(out, lod, seed, tone) {
  const X = 1.3;
  const Z = 0.98;
  const t = 0.4;
  const H = 1.3;
  const ridge = 2.72;
  const door = 0.72;
  const dh = 1.18;
  const rnd = artRng(seed);
  const wall = (x0, x1, z0, z1, y0 = 0, y1 = H) => out.drystone.push(boxUV(blk(1, x1 - x0, y1 - y0, z1 - z0, { bevel: 0.02, seed: seed + Math.round(x0 * 9 + z0 * 7), wobble: 0.012, grime: 0.3 }).translate((x0 + x1) / 2, y0, (z0 + z1) / 2)));
  wall(-X, X, -Z, -Z + t);
  wall(-X, -X + t, -Z + t, Z - t);
  wall(X - t, X, -Z + t, Z - t);
  wall(-X, -door / 2, Z - t, Z);
  wall(door / 2, X, Z - t, Z);
  wall(-door / 2, door / 2, Z - t, Z, dh + 0.12, H);
  // The gables: dry stone in steps up to the ridge (each course shorter), at both ends.
  const courses = lod === 2 ? 2 : 5;
  for (const s of [-1, 1]) {
    for (let k = 0; k < courses; k++) {
      const y0 = H + ((ridge - 0.2 - H) * k) / courses;
      const y1 = H + ((ridge - 0.2 - H) * (k + 1)) / courses;
      const half = (Z + 0.02) * (1 - (k + 0.5) / courses);
      wall(s > 0 ? X - t : -X, s > 0 ? X : -X + t, -half, half, y0, y1);
    }
  }
  // Corner stones, bigger, bonding the walls (the full level).
  if (lod === 0) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      for (let k = 0; k < 3; k++) {
        const g = blk(0, 0.46 + rnd() * 0.1, 0.24 + rnd() * 0.06, 0.3, { bevel: 0.03, seed: seed + 40 + k * 4 + sx + sz * 2, wobble: 0.02, grime: 0.3 });
        g.translate(sx * (X - 0.2), k * 0.44, sz * (Z - 0.13));
        out.drystone.push(boxUV(g));
      }
    }
  }
  // The inside's dark behind the door, a lintel of timber over it.
  doorway(out, Z - 0.02, door, dh, lod, seed + 10, { depth: 0.42, posts: false });
  out.wood.push(blk(lod, door + 0.5, 0.14, t + 0.04, { bevel: 0.015, seed: seed + 11, wobble: 0.01, grime: 0.15 }).translate(0, dh, Z - t / 2));
  // The thatch: front and back slopes over the walls' tops to the ridge, a roll of straw along it.
  for (const s of [-1, 1]) out.thatch.push(...thatchSlope({ x0: -X - 0.08, x1: X + 0.08, zEave: s * (Z + 0.26), zRidge: 0, eaveY: H - 0.05, ridgeY: ridge, thick: 0.22, lod, seed: seed + 2 + s, tone }));
  out.thatch.push(log([-X - 0.05, ridge + 0.04, 0], [X + 0.05, ridge + 0.04, 0], 0.11, lod));
  // The ropes over the ridge, and their stones hanging at the eaves.
  if (lod < 2) {
    const n = lod === 0 ? 4 : 2;
    for (let k = 0; k < n; k++) {
      const x = -X + 0.35 + ((2 * X - 0.7) * k) / (n - 1);
      for (const s of [-1, 1]) {
        const a = [x, ridge + 0.13, 0];
        const b = [x, H + 0.12, s * (Z + 0.22)];
        const c = [x, H - 0.2, s * (Z + 0.32)];
        out.rope.push(tube([a, [x, (a[1] + b[1]) / 2 + 0.06, s * (Z + 0.04) / 2 * 1.06], b, c], 0.012, { radial: 4, segments: 6, around: 0.06 }));
        out.drystone.push(boxUV(blk(1, 0.22, 0.2, 0.18, { bevel: 0.03, seed: seed + 60 + k * 2 + s, wobble: 0.02, grime: 0.1 }).translate(x, H - 0.4, s * (Z + 0.34))));
      }
    }
  }
  hearthInside(out, 0.3, -0.2, lod, seed + 20);
}

// ---------------------------------------------------------------------------
// The generic (sandbox) people's huts
// ---------------------------------------------------------------------------

/**
 * Capanna: the Latial hut of the urns. An oval of posts with wattle and daub
 * between them, a ridged roof of thatch, the ridge's timbers crossing in a V
 * over each end (the urns' horns), a porch of two posts over the door.
 */
function capanna(out, lod, seed, tone) {
  const rx = 1.45;
  const rz = 1.05;
  const H = 1.2;
  const door = 0.74;
  const w = ringWall({ rx, rz, y0: 0, y1: H, t: 0.14, door, lod, seed, tone: (a, y) => 0.78 + 0.22 * Math.min(1, y / 0.35) });
  out.daub.push(...w.outer, ...w.top);
  out.dark.push(...w.inner);
  // The posts of the frame showing through the daub's face.
  const posts = lod === 2 ? 0 : 10;
  for (let k = 0; k < posts; k++) {
    const a = 0.55 + ((2 * Math.PI - 1.1) * k) / (posts - 1);
    out.wood.push(pole(Math.sin(a) * (rx + 0.01), Math.cos(a) * (rz + 0.01), 0, H + 0.05, 0.065, lod, k));
  }
  doorway(out, rz - 0.02, door, 1.18, lod, seed + 10, { depth: 0.3 });
  // The roof: an oval narrowing to a ridge along x.
  const ridgeY = 3.0;
  out.thatch.push(...thatchCone({ rx: 1.86, rz: 1.42, eaveY: 1.12, apexY: ridgeY, thick: 0.24, ridge: 0.58, lod, seed: seed + 2, tone, hole: 0.05 }));
  out.wood.push(log([-0.7, ridgeY + 0.05, 0], [0.7, ridgeY + 0.05, 0], 0.07, lod));
  // The horns: at each end of the ridge two timbers crossing, their ends up and out.
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) out.wood.push(log([s * 0.48, ridgeY - 0.18, t * 0.22], [s * 0.74, ridgeY + 0.42, -t * 0.2], 0.04, lod));
    // The smoke's way out under the horns: a dark triangle in the ridge's end.
    const g = gridGeo(1, 1, (i, j) => ({ p: [s * (0.62 - i * 0.04), ridgeY - 0.28 + i * 0.26, (j - 0.5) * 0.3 * (1 - i)], uv: [j, i], c: 0.4 }), { flip: s > 0 });
    out.dark.push(g);
  }
  // The porch: two posts before the door and a small slope of thatch from the wall out over them.
  const pz = rz + 0.58;
  if (lod < 2) for (const s of [-1, 1]) out.wood.push(pole(s * 0.5, pz, 0, 1.42, 0.06, lod, 20 + s));
  out.wood.push(log([-0.62, 1.42, pz], [0.62, 1.42, pz], 0.055, lod));
  out.thatch.push(...thatchSlope({ x0: -0.68, x1: 0.68, zEave: pz + 0.12, zRidge: rz - 0.25, eaveY: 1.4, ridgeY: 1.78, thick: 0.14, lod, seed: seed + 8, tone }));
  hearthInside(out, 0.25, -0.1, lod, seed + 20);
}

/** Roundhouse: a round house of the north, its daub washed pale, the thatch steep and low over it. */
function roundhouse(out, lod, seed, tone) {
  const R = 1.42;
  const door = 0.82;
  const H = 1.05;
  const w = ringWall({ rx: R, rz: R, y0: 0, y1: H + 0.1, t: 0.15, door, lod, seed, tone: (a, y) => 1.35 - 0.45 * Math.max(0, 1 - y / 0.3) });
  out.daub.push(...w.outer, ...w.top);
  out.dark.push(...w.inner);
  doorway(out, Math.sqrt(R * R - (door / 2) ** 2), door, 1.0, lod, seed + 10, { depth: 0.3 });
  out.thatch.push(...thatchCone({ rx: 1.9, rz: 1.9, eaveY: 0.98, apexY: 3.58, thick: 0.28, lod, seed: seed + 2, tone }));
  const c = thatchCrown(0, 3.42, 0, 0.16, 0.22, lod, tone);
  out.thatch.push(...c.thatch);
  out.dark.push(...c.dark);
  // The door's porch: the eave cut back over it and a timber frame (the thatch's own edge carried on it).
  out.wood.push(log([-0.55, 1.08, 1.62], [0.55, 1.08, 1.62], 0.05, lod));
  if (lod < 2) for (const s of [-1, 1]) out.wood.push(pole(s * 0.55, 1.62, 0, 1.1, 0.055, lod, 30 + s));
  hearthInside(out, 0, 0, lod, seed + 20);
}

/** Longhut: rectangular, of posts and daub, hipped thatch with a smoke hole under each end of the ridge. */
function longhut(out, lod, seed, tone) {
  const X = 1.3;
  const Z = 0.95;
  const H = 1.15;
  const door = 0.74;
  const dh = 1.12;
  const run = (x0, x1, z0, z1, y0 = 0, y1 = H) => out.daub.push(boxUV(blk(1, x1 - x0, y1 - y0, z1 - z0, { bevel: 0.02, seed: seed + Math.round(x0 * 9 + z0 * 7), wobble: 0.008, grime: 0.35 }).translate((x0 + x1) / 2, y0, (z0 + z1) / 2)));
  const t = 0.16;
  run(-X, X, -Z, -Z + t);
  run(-X, -X + t, -Z + t, Z - t);
  run(X - t, X, -Z + t, Z - t);
  run(-X, -door / 2, Z - t, Z);
  run(door / 2, X, Z - t, Z);
  run(-door / 2, door / 2, Z - t, Z, dh, H);
  // The posts at the corners and along the long sides.
  if (lod < 2) {
    for (const [x, z] of [[-X, -Z], [X, -Z], [-X, Z], [X, Z], [-0.45, Z], [0.45, Z], [0, -Z]]) out.wood.push(pole(x, z, 0, H + 0.04, 0.075, lod, x * 3 + z));
  }
  doorway(out, Z, door, dh, lod, seed + 10, { depth: 0.18, posts: false });
  const eave = H - 0.02;
  const ridgeY = 2.7;
  const ridgeX = 0.62;
  for (const s of [-1, 1]) out.thatch.push(...thatchSlope({ x0: -X - 0.2, x1: X + 0.2, zEave: s * (Z + 0.24), zRidge: 0, eaveY: eave, ridgeY, thick: 0.22, lod, seed: seed + 2 + s, tone, hip: X + 0.2 - ridgeX }));
  for (const s of [-1, 1]) {
    const g = thatchSlope({ x0: -Z - 0.24, x1: Z + 0.24, zEave: X + 0.2, zRidge: ridgeX, eaveY: eave, ridgeY, thick: 0.22, lod, seed: seed + 5 + s, tone, hip: Z + 0.24 });
    for (const q of g) out.thatch.push(q.rotateY(s * Math.PI / 2));
    // The smoke hole under the ridge's end.
    const d = gridGeo(1, 1, (i, j) => ({ p: [s * (ridgeX + 0.08 + i * 0.02), ridgeY - 0.26 + i * 0.2, (j - 0.5) * 0.24 * (1 - i)], uv: [j, i], c: 0.4 }), { flip: s > 0 });
    out.dark.push(d);
  }
  out.thatch.push(log([-ridgeX - 0.04, ridgeY + 0.02, 0], [ridgeX + 0.04, ridgeY + 0.02, 0], 0.1, lod));
  hearthInside(out, 0.4, -0.15, lod, seed + 20);
}

const FORMS = { round: ligRound, oval: ligOval, stone: ligStone, capanna, roundhouse, longhut };

/** Into parts by material: { group, meshes, triangles }. */
function partsOf(name, out) {
  const m = villageMaterials();
  const p = new TaggedParts(name);
  const small = { cast: false };
  p.add('thatch', m.thatch, out.thatch);
  p.add('daub', m.daub, out.daub);
  p.add('drystone', m.drystone, out.drystone);
  p.add('stone', m.stone, out.stone);
  p.add('wood', m.wood, out.wood);
  p.add('bark', m.bark, out.bark);
  p.add('wicker', m.wicker, out.wicker);
  p.add('hide', m.hide, out.hide);
  p.add('clay', m.clay, out.clay);
  p.add('sack', m.sack, out.sack);
  p.add('produce', m.produce, out.produce, small);
  p.add('rope', m.rope, out.rope, small);
  p.add('iron', m.iron, out.iron, small);
  p.add('earth', m.earth, out.earth, small);
  p.add('inside', m.dark, out.dark, small);
  p.add('embers', m.embers, out.hot, small);
  p.add('coals', m.ash, out.ash, small);
  p.add('flames', m.flame, out.flames, small);
  return p.build();
}

/**
 * Build a hut: `form` one of HUT_FORMS', `age` 0 new thatch (golden) or 1
 * old (greyed, darker). Returns { group, meshes, triangles }.
 */
export function buildHut(form, { lod = 0, age = 0, seed = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bins();
  const s = 700 + Object.keys(FORMS).indexOf(form) * 50 + seed;
  FORMS[form](out, lod, s, age ? 0.72 : 1.0);
  return partsOf(`tugurium-${form}`, out);
}

// ---------------------------------------------------------------------------
// The yard's things
// ---------------------------------------------------------------------------

/**
 * A saddle quern as the grinder kneels at it (clips.js QUERN), its frame her
 * knees' place facing +z: the lower stone long and dished, propped on stones
 * so its top is at QUERN.height, the flour's bowl at its far end, a basket
 * of grain at her side, a fleece under her knees.
 */
function quern(out, lod) {
  const { ahead, height } = QUERN;
  const L = 0.56;
  for (const z of [ahead - 0.18, ahead + 0.18]) out.stone.push(blk(lod, 0.3, height - 0.1, 0.16, { bevel: 0.03, seed: Math.round(z * 10), wobble: 0.02, grime: 0.4 }).translate(0, 0, z));
  // The lower stone: a slab worn hollow along its length, its top at the clip's height.
  const g = gridGeo(lod === 0 ? 6 : 2, lod === 0 ? 4 : 1, (i, j) => {
    const u = i / (lod === 0 ? 6 : 2);
    const v = j / (lod === 0 ? 4 : 1);
    const dip = 0.025 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u);
    return { p: [-0.17 + 0.34 * v, height - dip, ahead - L / 2 + L * u], uv: [v * 0.34, u * L], c: 0.9 - dip * 4 };
  }, { flip: true });
  out.stone.push(g);
  out.stone.push(blk(lod, 0.36, 0.11, L + 0.02, { bevel: 0.03, seed: 3, wobble: 0.015, grime: 0.2 }).translate(0, height - 0.115, ahead));
  if (lod < 2) {
    // The bowl for the meal at its far end, the basket of grain at her right, the fleece under her knees.
    const bowl = basket(0.12, 0.08, 0.8, lod);
    out.clay.push(bowl.wicker.clone().translate(0, 0, ahead + L / 2 + 0.12));
    if (bowl.fill) out.produce.push(paint(bowl.fill.translate(0, 0, ahead + L / 2 + 0.12), lin(0xe2d6b8)));
    const b = basket(0.17, 0.2, 0.9, lod);
    out.wicker.push(b.wicker.translate(-0.42, 0, 0.18));
    if (b.fill) out.produce.push(paint(b.fill.translate(-0.42, 0, 0.18), lin(0xb89a5a)));
    const fleece = gridGeo(3, 3, (i, j) => ({ p: [-0.22 + 0.44 * (j / 3), 0.015 + 0.02 * Math.sin(Math.PI * i / 3) * Math.sin(Math.PI * j / 3), -0.4 + 0.6 * (i / 3)], uv: [j / 3, i / 3], c: lin(0xd2c4a6, 0.9) }), { flip: true });
    out.hide.push(fleece);
  }
}

/** Storage jars by the wall and the cooking pot on its three stones over a dead fire. */
function pots(out, lod) {
  for (const [x, z, s] of [[-0.18, -0.1, 0.42], [0.18, -0.14, 0.36], [-0.02, 0.18, 0.3]]) out.clay.push(jar({ lod, seed: Math.round(x * 50) }).scale(s, s, s).translate(x, 0, z));
  if (lod < 2) {
    const cx = 0.42;
    const cz = 0.25;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      out.stone.push(blk(lod, 0.12, 0.1, 0.1, { bevel: 0.02, seed: 20 + k, wobble: 0.015, grime: 0.5 }).translate(cx + Math.sin(a) * 0.14, 0, cz + Math.cos(a) * 0.14));
    }
    const pot = jar({ lod, seed: 9 }).scale(0.26, 0.2, 0.26).translate(cx, 0.08, cz);
    out.clay.push(tintGeometry(pot, (x, y) => (y < 0.16 ? 0.35 : 0.8)));
    out.ash.push(tintGeometry(new SphereGeometry(0.16, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.15, 1).translate(cx, 0, cz), () => 0.6));
  }
}

/** A drying rack: two forked posts and a pole, a fleece and a hide over it. */
function rack(out, lod) {
  for (const s of [-1, 1]) out.wood.push(pole(s * 0.62, 0, 0, 1.25, 0.04, lod, s));
  out.wood.push(log([-0.68, 1.22, 0], [0.68, 1.22, 0], 0.03, lod));
  // Draped over the pole: hanging down both sides, bellied, its edges uneven.
  const drape = (x0, x1, c, drop, seed) => gridGeo(lod === 0 ? 6 : 2, lod === 0 ? 4 : 1, (i, j) => {
    const v = i / (lod === 0 ? 6 : 2);
    const u = j / (lod === 0 ? 4 : 1);
    const side = v < 0.5 ? -1 : 1;
    const k = Math.abs(v - 0.5) * 2;
    const y = 1.23 - k * drop + 0.04 * Math.sin(u * 9 + seed) * k;
    return { p: [x0 + (x1 - x0) * u, y, side * (0.03 + 0.06 * Math.sin(Math.PI * k * 0.8))], uv: [u, v], c: [c[0] * (0.85 + 0.15 * (1 - k)), c[1] * (0.85 + 0.15 * (1 - k)), c[2] * (0.85 + 0.15 * (1 - k))] };
  });
  const a = drape(-0.6, -0.05, lin(0xdcd0b4), 0.55, 1);
  const b = drape(0.02, 0.58, lin(0x7a5434), 0.7, 2);
  out.hide.push(a, b);
  // (Both faces: the sheet is seen from front and back.)
  out.hide.push(flipped(a), flipped(b));
}

/** A copy of a geometry facing the other way (its triangles wound back, its normals turned). */
function flipped(g) {
  const c = g.clone();
  const idx = c.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = t;
  }
  const n = c.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return c;
}

/**
 * A warp-weighted loom against the wall, as the loom weights of every Iron Age
 * hut floor show it: two uprights leaning back, the cloth beam at the top with
 * the woven cloth hanging from it, the warp threads below, and the row of clay
 * weights that hold them taut.
 */
function loom(out, lod) {
  const lean = 0.2;
  const H = 1.7;
  for (const s of [-1, 1]) out.wood.push(log([s * 0.62, 0, 0.3], [s * 0.62, H, 0.3 - lean], 0.035, lod));
  out.wood.push(log([-0.7, H - 0.08, 0.3 - lean + 0.02], [0.7, H - 0.08, 0.3 - lean + 0.02], 0.04, lod));
  const yc = 0.95;
  const cloth = gridGeo(1, 1, (i, j) => {
    const y = yc + (H - 0.12 - yc) * i;
    return { p: [-0.55 + 1.1 * j, y, 0.3 - lean * (y / H) + 0.025], uv: [j * 1.1, y], c: lin(i ? 0xc8b48a : 0xbca478) };
  });
  out.sack.push(cloth, flipped(cloth));
  if (lod < 2) {
    // Warp threads in bunches to the weights; a coloured band woven in the cloth.
    const n = lod === 0 ? 14 : 6;
    for (let k = 0; k < n; k++) {
      const x = -0.52 + (1.04 * k) / (n - 1);
      const top = [x, yc, 0.3 - lean * (yc / H) + 0.028];
      const wy = 0.38 + (k % 2) * 0.05;
      out.rope.push(tube([top, [x, wy, 0.3 - lean * (wy / H) + 0.06 + (k % 2) * 0.05]], 0.004, { radial: 3, segments: 1, around: 0.06 }));
      out.clay.push(tintGeometry(boxUV(new CylinderGeometry(0.02, 0.035, 0.09, 4, 1).translate(x, wy - 0.06, 0.3 - lean * (wy / H) + 0.06 + (k % 2) * 0.05)), () => 0.7));
    }
    out.produce.push(paint(new PlaneGeometry(1.1, 0.06).translate(0, yc + 0.18, 0.3 - lean * ((yc + 0.18) / H) + 0.03), lin(0x3f5a85)));
  }
}

/** A chopping block, the axe in it, the chips round it. */
function chop(out, lod) {
  const g = new CylinderGeometry(0.2, 0.22, 0.45, lod === 0 ? 10 : 6, 1).translate(0, 0.225, 0);
  out.bark.push(tintGeometry(boxUV(g), (x, y) => (y > 0.44 ? 1.4 : 0.85)));
  out.wood.push(log([0.02, 0.42, -0.02], [0.32, 0.86, 0.1], 0.016, lod));
  out.iron.push(blk(lod, 0.03, 0.12, 0.14, { bevel: 0.005, seed: 2, wobble: 0, grime: 0 }).translate(0, 0.38, 0));
  out.bark.push(...woodpile(0.5, 0.2, 7, Math.max(1, lod)).map((q) => q.translate(0.45, 0, -0.1)));
}

/** A wattle hurdle panel leaning against its stakes (the one being mended). */
function hurdle(out, lod) {
  const f = wattleFence([[-0.75, 0], [0.75, 0]], { h: 0.95, seed: 33, lod });
  out.wicker.push(...f.wicker);
  out.wood.push(...f.wood);
}

/** A beehive of plaited straw (a skep) on a stand of stones: the Ligurians' honey went down to Genua. */
function skep(out, lod) {
  out.stone.push(blk(lod, 0.5, 0.3, 0.4, { bevel: 0.03, seed: 5, wobble: 0.02, grime: 0.3 }));
  const seg = lod === 0 ? 14 : 8;
  for (const x of [-0.12, 0.13]) {
    const g = new SphereGeometry(0.17, seg, lod === 0 ? 8 : 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.3, 1).translate(x, 0.3, 0);
    out.thatch.push(tintGeometry(boxUV(g), (px, py) => 0.75 + 0.25 * Math.sin(py * 60) ** 2));
    out.dark.push(tintGeometry(boxUV(new PlaneGeometry(0.05, 0.03).translate(x, 0.33, 0.17)), () => 0.3));
  }
}

/**
 * A thing made smaller than its maker builds it (a yard's corner is small, and
 * a tall thing must stay under a hut's eave): built into its own bins, scaled
 * about its origin.
 */
function smaller(make, k) {
  return (out, lod) => {
    const own = bins();
    make(own, lod);
    for (const [name, list] of Object.entries(own)) for (const g of list) out[name].push(g.scale(k, k, k));
  };
}

const THINGS = {
  quern, pots, chop, hurdle, skep,
  rack: smaller(rack, 0.74),
  loom: smaller(loom, 0.72),
  woodpile: (out, lod) => out.bark.push(...woodpile(0.9, 0.5, 3, lod)),
};

/** Build a yard thing (YARD_THINGS) at the origin, facing +z. Returns { group, meshes, triangles }. */
export function yardThing(name, { lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = bins();
  THINGS[name](out, lod);
  return partsOf(`yard-${name}`, out);
}

/** How far a yard thing reaches from its origin (m, its footprint's radius): the tests and the layout keep it in the hut's circle. */
export const YARD_REACH = Object.freeze({ quern: 0.95, woodpile: 0.6, pots: 0.75, rack: 0.75, loom: 0.75, chop: 0.62, hurdle: 0.8, skep: 0.36 });
