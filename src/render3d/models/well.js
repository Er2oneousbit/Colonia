/**
 * models/well.js
 * ----------------------------------------------------------------------------
 * The public well (Puteus) of the 3D look, built from the archaeology rather
 * than from the 2D sprite: a well as found in the streets of Pompeii,
 * Herculaneum and Ostia, fitted to one game tile (4 m).
 *
 *   - The puteal: the curb round the mouth, of limestone, 0.86 m tall and
 *     1.2 m across, turned with a moulded foot (a torus over a plinth and a
 *     cove), a shaft carved with S-shaped flutes (strigils, as on many
 *     puteals and sarcophagi), an ovolo under a plain lip, and three rope
 *     grooves worn into the lip's inner edge.
 *   - A two-stepped platform of travertine blocks, no two alike, worn and
 *     dirty at their feet.
 *   - A timber frame over the mouth (two posts in iron shoes, a beam, knee
 *     braces, iron straps), a wooden pulley (trochlea) on an iron axle in an
 *     iron fork, and a hemp rope: up from a bronze bucket (situla, rolled
 *     rim, bail handle, one dent), over the pulley, down to a turn round
 *     the right post and a coil lying on the step.
 *   - A stone trough beside it, of four slabs clamped with iron, with water.
 *   - A bronze lantern on an arm from the right post (lit at night).
 *
 * In metres, y up, the tile's middle at the origin on the street's surface
 * (y = 0); the tile spans -2..2 on x and z. The game's models (models.js)
 * are in tiles: scale by 1/4 when this comes into the game.
 *
 * Meshes are merged by material (one draw call each); the bucket and the
 * rope's hanging run are their own meshes so they can sway (wellLife).
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, TorusGeometry, CylinderGeometry, SphereGeometry, PointLight, Vector3 } from 'three';
import { revolve, profileOf, block, tube, merge, tintGeometry, triangles } from '../shapes.js';
import { material, waterMaterial, shallowWaterMaterial } from '../materials.js';
import { artRng, smoothstep } from '../texgen.js';

/** The well's key measures (metres): tests and the lab read them. */
export const WELL = Object.freeze({
  tile: 4,
  lowerHalf: 1.25, // lower step, half its side
  upperHalf: 0.87, // upper step
  stepH: 0.15,
  putealR: 0.605, // the plinth's radius
  putealH: 0.86,
  boreR: 0.385,
  postX: 0.76,
  beamY: 2.42,
  pulleyY: 2.18,
  pulleyR: 0.135, // to the bottom of the groove
  ropeR: 0.011,
  waterY: 0.96, // the water, 20 cm under the lip (1.16 m), kept high so it shows from the game's camera (a real well's lay metres down)
});

const D = (deg) => (deg * Math.PI) / 180;

/** Build the puteal (the turned curb) on y = 0. */
function puteal(seed) {
  const rnd = artRng(seed);
  const P = profileOf([
    [0.598, 0.0],
    [0.605, 0.012],
    [0.605, 0.066],
    { arc: [0.605, 0.101, 0.035, D(-90), D(90)], n: 10 }, // torus
    [0.598, 0.142],
    { arc: [0.592, 0.188, 0.04, D(-90), D(-180)], n: 6 }, // cove into the shaft
    [0.553, 0.21],
    [0.553, 0.24],
    ...Array.from({ length: 15 }, (_, k) => [0.553, 0.25 + (k * 0.38) / 14]), // the fluted shaft
    [0.553, 0.655],
    [0.562, 0.664],
    { arc: [0.562, 0.706, 0.042, D(-90), D(0)], n: 7 }, // ovolo
    [0.604, 0.716],
    [0.604, 0.825],
    { arc: [0.579, 0.828, 0.025, D(0), D(90)], n: 5 }, // rounded outer arris of the lip
    [0.5, 0.857],
    [0.43, 0.86],
    { arc: [0.41, 0.835, 0.025, D(90), D(180)], n: 5 }, // rounded inner arris
    [0.385, 0.78],
    [0.384, 0.6],
    [0.382, 0.3],
    [0.38, -0.3],
    [0.38, -1.0],
    [0.38, -1.8],
  ]);
  const FLUTES = 36;
  const grooves = [0.6 + rnd() * 0.3, 2.3 + rnd() * 0.4, 4.4 + rnd() * 0.3];
  // Small dents on the lip: a few seeded knocks.
  const knocks = Array.from({ length: 7 }, () => ({ th: rnd() * Math.PI * 2, y: 0.78 + rnd() * 0.08, d: 0.003 + rnd() * 0.004 }));
  const angDist = (a, b) => {
    let d = Math.abs(a - b) % (Math.PI * 2);
    return d > Math.PI ? Math.PI * 2 - d : d;
  };
  /** The depth of the flute at (theta, y): 0 outside the band, up to 9 mm in a flute's trough. */
  const flute = (th, y) => {
    const t = (y - 0.25) / 0.38;
    if (t <= 0 || t >= 1) return 0;
    const shift = 0.075 * Math.sin(Math.PI * (t - 0.5)); // the S of a strigil
    const c = 0.5 + 0.5 * Math.cos((th + shift) * FLUTES);
    const mask = Math.pow(Math.sin(Math.PI * t), 0.35);
    return 0.015 * Math.pow(c, 0.8) * mask;
  };
  const geo = revolve(P, {
    segments: 216,
    metres: 0.8,
    deform: (p, th) => {
      const r = Math.hypot(p.x, p.z);
      let dr = 0;
      let dy = 0;
      if (r > 0.54 && p.y > 0.24 && p.y < 0.65) dr -= flute(th, p.y);
      // Rope grooves worn through the inner arris and across the lip top.
      if (p.y > 0.7 && r < 0.52) {
        for (const g of grooves) {
          const s = angDist(th, g) * r;
          const k = Math.exp(-((s / 0.02) ** 2));
          const inner = 1 - smoothstep(0.39, 0.5, r);
          dy -= 0.016 * k * inner * smoothstep(0.7, 0.84, p.y);
          dr += 0.012 * k * inner * smoothstep(0.7, 0.84, p.y);
        }
      }
      // Knocks out of the lip, and the slight irregularity of a hand-finished stone.
      if (p.y > 0.76) for (const kn of knocks) dr -= kn.d * Math.exp(-((angDist(th, kn.th) * r / 0.03) ** 2)) * Math.exp(-(((p.y - kn.y) / 0.02) ** 2)) * (r > 0.5 ? 1 : 0);
      dr += 0.002 * Math.sin(th * 2 + 0.7) + 0.0015 * Math.sin(th * 3 + 2.1);
      const k = (r + dr) / Math.max(r, 1e-6);
      p.x *= k;
      p.z *= k;
      p.y += dy;
    },
    tint: (p, th) => {
      const r = Math.hypot(p.x, p.z);
      let t = 1;
      // Dirt and splash at the foot.
      t *= 0.68 + 0.32 * smoothstep(0.0, 0.24, p.y);
      // The flutes' troughs hold dirt.
      if (r > 0.53 && p.y > 0.24 && p.y < 0.65) t *= 1 - (flute(th, p.y) / 0.015) * 0.3;
      // Down the shaft it gets dark.
      if (r < 0.4 && p.y < 0.82) t *= Math.max(0.03, smoothstep(-1.4, 0.8, p.y)) * 0.9;
      // The lip's top is polished by hands: a touch lighter.
      if (p.y > 0.84 && r > 0.4) t *= 1.06;
      return t;
    },
  });
  return geo;
}

/** The two courses of the platform, as a list of block geometries (positioned). */
function platform(seed) {
  const rnd = artRng(seed);
  const L = WELL.lowerHalf;
  const U = WELL.upperHalf;
  const H = WELL.stepH;
  const W = L - U + 0.06; // the lower ring's width: tucked 6 cm under the upper course
  const gap = 0.007;
  const out = [];
  let n = 0;
  const put = (x0, x1, z0, z1, y, h) => {
    const w = x1 - x0 - gap;
    const d = z1 - z0 - gap;
    const g = block(w, h + (rnd() - 0.5) * 0.008, d, {
      bevel: 0.022 + rnd() * 0.012, seed: seed * 97 + ++n, wobble: 0.006, grime: 0.45, topSag: 0.012, seg: 2, tone: 0.1,
    });
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    out.push(g);
  };
  // Split a run from a to b into pieces of 0.45..0.8 m.
  const split = (a, b) => {
    const cuts = [a];
    let x = a;
    while (b - x > 0.95) {
      x += 0.45 + rnd() * 0.35;
      cuts.push(x);
    }
    cuts.push(b);
    return cuts;
  };
  // Lower course: a pinwheel of four runs round a hidden core.
  const runs = [
    [-L, L - W, L - W, L, 'x'],
    [L - W, L, -L + W, L, 'z'],
    [-L + W, L, -L, -L + W, 'x'],
    [-L, -L + W, -L, L - W, 'z'],
  ];
  for (const [x0, x1, z0, z1, ax] of runs) {
    const cuts = ax === 'x' ? split(x0, x1) : split(z0, z1);
    for (let i = 0; i < cuts.length - 1; i++) {
      if (ax === 'x') put(cuts[i], cuts[i + 1], z0, z1, 0, H);
      else put(x0, x1, cuts[i], cuts[i + 1], 0, H);
    }
  }
  // Upper course: three rows of slabs.
  const rowCuts = [-U, -U + 0.5 + rnd() * 0.2, U - 0.5 - rnd() * 0.2, U];
  for (let r = 0; r < 3; r++) {
    const cuts = split(-U, U);
    for (let i = 0; i < cuts.length - 1; i++) put(cuts[i], cuts[i + 1], rowCuts[r], rowCuts[r + 1], H, H);
  }
  // The hidden core fills the joints' depth with something dark (bedding mortar).
  const core = block(2 * (L - W) + 0.04, H * 2 - 0.01, 2 * (L - W) + 0.04, { bevel: 0.005, wobble: 0, grime: 0.9, seed: 5 });
  return { blocks: out, core };
}

/** The timber frame: posts, beam, braces; and its iron: shoes, straps, the pulley's fork and axle. */
function frame(seed) {
  const rnd = artRng(seed);
  const wood = [];
  const iron = [];
  const X = WELL.postX;
  const base = WELL.stepH * 2;
  const S = 0.15;
  const top = WELL.beamY;
  for (const s of [-1, 1]) {
    const post = block(S, top - base + 0.02, S, { bevel: 0.018, seed: seed + (s > 0 ? 1 : 2), wobble: 0.004, grime: 0.3 });
    post.rotateY((rnd() - 0.5) * 0.04);
    post.translate(s * X, base, 0);
    wood.push(post);
    // Iron shoe at the foot, and a strap where the post meets the beam.
    const shoe = block(S + 0.024, 0.13, S + 0.024, { bevel: 0.006, seed: seed + 10 + s, wobble: 0.001, grime: 0.4 });
    shoe.translate(s * X, base, 0);
    iron.push(shoe);
    const strap = block(S + 0.014, 0.045, S + 0.014, { bevel: 0.004, seed: seed + 20 + s, wobble: 0.001, grime: 0 });
    strap.translate(s * X, top - 0.12, 0);
    iron.push(strap);
    // Knee brace: from the post 0.45 m below the beam to the beam 0.45 m in.
    const brace = block(0.085, 0.62, 0.085, { bevel: 0.012, seed: seed + 30 + s, wobble: 0.003, grime: 0 });
    brace.translate(0, -0.31, 0);
    brace.rotateZ(s * D(45));
    brace.translate(s * (X - S / 2 - 0.22), top - 0.22, 0);
    wood.push(brace);
  }
  // The beam, laid along x with the grain along it: built upright, then turned.
  const beam = block(0.16, 2 * X + 0.36, 0.17, { bevel: 0.02, seed: seed + 40, wobble: 0.004, grime: 0 });
  beam.translate(0, -(2 * X + 0.36) / 2, 0);
  beam.rotateZ(D(90));
  beam.translate(0, top + 0.08, 0);
  wood.push(beam);
  // The pulley's fork: two straps down from the beam either side of the sheave, a plate over the beam.
  for (const s of [-1, 1]) {
    const f = block(0.05, top - WELL.pulleyY + 0.03, 0.012, { bevel: 0.003, seed: seed + 50 + s, wobble: 0.0005, grime: 0 });
    f.translate(0, WELL.pulleyY - 0.03, s * 0.042);
    iron.push(f);
  }
  const plate = block(0.06, 0.012, 0.2, { bevel: 0.003, seed: seed + 60, wobble: 0.0005, grime: 0 });
  plate.translate(0, top + 0.16, 0);
  iron.push(plate);
  const axle = new CylinderGeometry(0.012, 0.012, 0.11, 12);
  axle.rotateX(D(90));
  axle.translate(0, WELL.pulleyY, 0);
  iron.push(tintGeometry(axle));
  // Nail heads on the straps.
  for (const s of [-1, 1]) {
    for (const zz of [-1, 1]) {
      const nail = new SphereGeometry(0.009, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      nail.rotateX(zz * D(90));
      nail.translate(s * X, top - 0.12, zz * (S / 2 + 0.007));
      iron.push(tintGeometry(nail));
    }
  }
  return { wood, iron };
}

/** The pulley's sheave: a grooved wooden wheel on the z axis. */
function sheave() {
  const R = WELL.pulleyR;
  // Profile in (radius, axial): the wheel's face, its rims, the groove the rope runs in.
  const P = profileOf([
    [0.016, -0.03],
    [0.13, -0.03],
    { arc: [R + 0.012, -0.022, 0.008, D(-90), D(0)], n: 3 },
    [R + 0.02, -0.018],
    { arc: [R + 0.02, 0, 0.016, D(-90), D(-270)], n: 10 }, // the groove (concave)
    [R + 0.02, 0.018],
    { arc: [R + 0.012, 0.022, 0.008, D(0), D(90)], n: 3 },
    [0.13, 0.03],
    [0.016, 0.03],
  ]);
  const g = revolve(P, { segments: 40, metres: 1, tint: (p) => 1 - 0.25 * smoothstep(0.14, 0.11, Math.hypot(p.x, p.z)) });
  g.rotateX(D(90));
  g.translate(0, WELL.pulleyY, 0);
  return g;
}

/** The bronze bucket (situla), its bottom at y 0, with its bail up over it. */
function bucket() {
  const P = profileOf([
    [0.0, 0.0],
    [0.082, 0.0],
    { arc: [0.082, 0.022, 0.022, D(-90), D(-20)], n: 4 },
    [0.118, 0.09],
    [0.134, 0.16],
    [0.139, 0.2],
    [0.133, 0.235],
    [0.128, 0.258],
    [0.136, 0.275],
    { arc: [0.142, 0.283, 0.008, D(-60), D(200)], n: 9 }, // the rolled rim
    [0.131, 0.274],
    [0.124, 0.256],
    [0.13, 0.205],
    [0.126, 0.16],
    [0.11, 0.09],
    [0.08, 0.012],
    [0.0, 0.008],
  ]);
  const dentTh = 1.1;
  const geo = revolve(P, {
    segments: 48,
    metres: 0.3,
    deform: (p, th) => {
      let d = Math.abs(th - dentTh);
      d = Math.min(d, Math.PI * 2 - d);
      const k = 0.013 * Math.exp(-((d / 0.32) ** 2)) * Math.exp(-(((p.y - 0.12) / 0.05) ** 2));
      const r = Math.hypot(p.x, p.z);
      if (r > 1e-4) {
        p.x *= (r - k) / r;
        p.z *= (r - k) / r;
      }
    },
    tint: (p) => (Math.hypot(p.x, p.z) < 0.125 && p.y > 0.01 ? 0.55 : 1),
  });
  // Lugs at the rim and the bail between them.
  const parts = [geo];
  for (const s of [-1, 1]) {
    const lug = new TorusGeometry(0.014, 0.004, 6, 14);
    lug.translate(s * 0.146, 0.29, 0);
    parts.push(tintGeometry(lug));
  }
  const bail = [];
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI - (k / 12) * Math.PI;
    bail.push([Math.cos(a) * 0.146, 0.3 + Math.sin(a) * 0.13, 0]);
  }
  parts.push(tube(bail, 0.0045, { radial: 6, around: 0.3 }));
  return merge(parts);
}

/** The rope: the hanging run (bail to pulley) and the rest (over the pulley, to the post, the coil). */
function ropes(bucketTop) {
  const rr = WELL.pulleyR + WELL.ropeR + 0.004;
  const cy = WELL.pulleyY;
  const hang = tube([[-rr, bucketTop, 0], [-rr, (bucketTop + cy) / 2, 0], [-rr, cy, 0]], WELL.ropeR, { radial: 8 });
  const pts = [];
  // Over the pulley.
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI - (k / 10) * Math.PI;
    pts.push([Math.cos(a) * rr, cy + Math.sin(a) * rr, 0]);
  }
  // Down the right side, then across to the post.
  const X = WELL.postX;
  pts.push([rr + 0.004, cy - 0.35, 0.0], [rr + 0.03, 1.62, 0.01], [X - 0.18, 1.36, 0.04]);
  // Two turns round the post (a rounded square, 8.8 cm from its middle), going down.
  const half = 0.075 + WELL.ropeR + 0.002;
  for (let k = 0; k <= 32; k++) {
    const a = Math.PI + (k / 16) * Math.PI;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const sx = Math.sign(c) * Math.pow(Math.abs(c), 0.35) * half * 1.02;
    const sz = Math.sign(s) * Math.pow(Math.abs(s), 0.35) * half * 1.02;
    pts.push([X + sx, 1.3 - k * 0.0028, sz]);
  }
  // The tail falls to the step and lies in a loose coil.
  const base = WELL.stepH * 2 + WELL.ropeR;
  pts.push([X - 0.1, 1.05, 0.12], [X - 0.12, 0.7, 0.26], [X - 0.08, 0.42, 0.36], [X - 0.02, base + 0.01, 0.42]);
  const cx = X - 0.1;
  const cz = 0.5;
  for (let k = 1; k <= 22; k++) {
    const a = -1.2 + (k / 22) * Math.PI * 2 * 1.6;
    const rad = 0.12 - k * 0.0018;
    pts.push([cx + Math.cos(a) * rad, base + (k > 12 ? WELL.ropeR * 1.6 : 0), cz + Math.sin(a) * rad]);
  }
  const rest = tube(pts, WELL.ropeR, { radial: 8, tension: 0.5 });
  return { hang, rest };
}

/** The trough on the -x side: four slabs on a base slab, iron cramps, water. */
function trough(seed) {
  const parts = [];
  const iron = [];
  const x0 = -1.96;
  const x1 = -1.34;
  const z0 = -0.72;
  const z1 = 0.72;
  const T = 0.09;
  const H = 0.52;
  const cx = (x0 + x1) / 2;
  const add = (g, x, y, z) => {
    g.translate(x, y, z);
    parts.push(g);
  };
  add(block(x1 - x0, 0.12, z1 - z0, { bevel: 0.02, seed: seed + 1, wobble: 0.004, grime: 0.4 }), cx, 0, 0);
  add(block(T, H - 0.12, z1 - z0, { bevel: 0.018, seed: seed + 2, wobble: 0.004, grime: 0.3 }), x0 + T / 2, 0.12, 0);
  add(block(T, H - 0.12, z1 - z0, { bevel: 0.018, seed: seed + 3, wobble: 0.004, grime: 0.3 }), x1 - T / 2, 0.12, 0);
  add(block(x1 - x0 - 2 * T - 0.006, H - 0.12, T, { bevel: 0.016, seed: seed + 4, wobble: 0.003, grime: 0.3 }), cx, 0.12, z0 + T / 2);
  add(block(x1 - x0 - 2 * T - 0.006, H - 0.12, T, { bevel: 0.016, seed: seed + 5, wobble: 0.003, grime: 0.3 }), cx, 0.12, z1 - T / 2);
  // Iron cramps across the joints at the top corners, leaded in.
  for (const z of [z0 + T / 2, z1 - T / 2]) {
    for (const x of [x0 + T / 2, x1 - T / 2]) {
      const c = block(0.035, 0.012, 0.13, { bevel: 0.003, seed: seed + 9, wobble: 0.0005, grime: 0 });
      c.translate(x, H - 0.004, z + (z < 0 ? 0.03 : -0.03));
      iron.push(c);
    }
  }
  const water = new CylinderGeometry(1, 1, 0.001, 4, 1);
  // A plain quad would do; a 4-sided cylinder turned 45 degrees is a box face with UVs we scale below.
  water.rotateY(D(45));
  water.scale((x1 - x0 - 2 * T) / Math.SQRT2, 1, (z1 - z0 - 2 * T) / Math.SQRT2);
  water.translate(cx, H - 0.045, 0); // filled near the brim, so it reads as a full trough from above
  return { stone: parts, iron, water: tintGeometry(water) };
}

/** A small bronze lantern on an iron arm from the right post; its glass glows when lit. */
function lantern() {
  const X = WELL.postX;
  const bronze = [];
  const iron = [];
  const arm = block(0.3, 0.02, 0.02, { bevel: 0.004, seed: 71, wobble: 0.0005, grime: 0 });
  arm.translate(X + 0.075 + 0.15, 1.98, 0);
  iron.push(arm);
  const hook = new TorusGeometry(0.02, 0.0035, 6, 12, Math.PI * 1.5);
  hook.translate(X + 0.36, 1.96, 0);
  iron.push(tintGeometry(hook));
  const lx = X + 0.36;
  const ly = 1.7;
  // A base and a domed cap, open between them where the horn panes are, held by four rods.
  const base = revolve(profileOf([
    [0.0, 0.0], [0.07, 0.0], [0.075, 0.02], [0.075, 0.04], [0.06, 0.048], [0.0, 0.048],
  ]), { segments: 24, metres: 0.3 });
  const cap = revolve(profileOf([
    [0.0, 0.165], [0.06, 0.165], [0.075, 0.172], [0.08, 0.19], [0.05, 0.25], [0.02, 0.27], [0.015, 0.29], [0.0, 0.3],
  ]), { segments: 24, metres: 0.3 });
  for (const g of [base, cap]) {
    g.translate(lx, ly, 0);
    bronze.push(g);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const rod = new CylinderGeometry(0.005, 0.005, 0.125, 6);
    rod.translate(lx + Math.cos(a) * 0.071, ly + 0.107, Math.sin(a) * 0.071);
    bronze.push(tintGeometry(rod));
  }
  const ring = new TorusGeometry(0.018, 0.003, 6, 12);
  ring.translate(lx, ly + 0.31, 0);
  bronze.push(tintGeometry(ring));
  // The panes (thin horn) between base and cap, as one cylinder that glows when lit.
  const pane = new CylinderGeometry(0.066, 0.066, 0.122, 20, 1, true);
  pane.translate(lx, ly + 0.107, 0);
  return { bronze, iron, pane: tintGeometry(pane), light: new Vector3(lx, ly + 0.1, 0) };
}

/** The well as a Group, with handles to its moving parts and its lights. */
export function buildWell({ seed = 7 } = {}) {
  const group = new Group();
  group.name = 'well';
  const meshes = [];
  const add = (geo, mat, name, parent = group) => {
    const m = new Mesh(geo, mat);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    meshes.push(m);
    return m;
  };
  const stoneMat = material('limestone', { surface: 'limestone', vertexColors: true, snow: 1 });
  const travMat = material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 });
  const woodMat = material('wood', { surface: 'wood', vertexColors: true, snow: 1 });
  const ironMat = material('iron', { surface: 'iron', vertexColors: true, snow: 0.7 });
  const ropeMat = material('rope', { surface: 'rope', vertexColors: true, snow: 0.6, normal: 1 });
  const bronzeMat = material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 });
  const troughMat = material('limestone-trough', { surface: 'limestone', vertexColors: true, color: 0xd9d2c4, snow: 1 });
  const paneMat = material('lantern-pane', { color: 0xc89a5a, roughness: 0.45, emissive: 0xffb25c, emissiveIntensity: 0, snow: 0 });

  const pt = puteal(seed);
  pt.translate(0, WELL.stepH * 2, 0);
  const { blocks, core } = platform(seed + 1);
  const fr = frame(seed + 2);
  const tr = trough(seed + 3);
  const ln = lantern();
  add(merge([pt]), stoneMat, 'puteal');
  add(merge([...blocks, core]), travMat, 'platform');
  add(merge([...fr.wood, sheave()]), woodMat, 'frame');
  add(merge([...fr.iron, ...tr.iron, ...ln.iron]), ironMat, 'iron');
  add(merge(tr.stone), troughMat, 'trough');
  const tw = add(tr.water, shallowWaterMaterial(), 'trough-water');
  tw.castShadow = false;
  const lb = add(merge(ln.bronze), bronzeMat, 'lantern');
  lb.castShadow = false;
  const pane = add(ln.pane, paneMat, 'lantern-pane');
  pane.castShadow = false;
  // The water in the shaft (WELL.waterY).
  const wellWater = new CylinderGeometry(WELL.boreR, WELL.boreR, 0.001, 32);
  wellWater.translate(0, WELL.waterY, 0);
  const ww = add(tintGeometry(wellWater), waterMaterial(), 'well-water');
  ww.castShadow = false;

  // The hanging run of rope and the bucket swing together about the point
  // where the rope leaves the pulley.
  const rr = WELL.pulleyR + WELL.ropeR + 0.004;
  const pivot = new Group();
  pivot.name = 'bucket-pivot';
  pivot.position.set(-rr, WELL.pulleyY, 0);
  group.add(pivot);
  const bucketBottom = 1.24;
  const bk = bucket();
  bk.translate(0, bucketBottom - WELL.pulleyY, 0);
  const bucketMesh = add(bk, bronzeMat, 'bucket', pivot);
  bucketMesh.position.x = 0;
  const bucketTop = bucketBottom + 0.43;
  const rp = ropes(bucketTop);
  rp.hang.translate(rr, -WELL.pulleyY, 0);
  add(rp.hang, ropeMat, 'rope-hang', pivot);
  add(rp.rest, ropeMat, 'rope');
  const bw = new CylinderGeometry(0.122, 0.122, 0.001, 24);
  bw.translate(0, bucketBottom - WELL.pulleyY + 0.235, 0);
  const bucketWater = add(tintGeometry(bw), waterMaterial(), 'bucket-water', pivot);
  bucketWater.castShadow = false;

  const lamp = new PointLight(0xffa04a, 0, 9, 2);
  lamp.position.copy(ln.light);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.002;
  lamp.shadow.normalBias = 0.02;
  lamp.shadow.radius = 4;
  lamp.shadow.camera.near = 0.05;
  lamp.shadow.camera.far = 9;
  lamp.name = 'well-lantern';
  group.add(lamp);

  let tris = 0;
  for (const m of meshes) tris += triangles(m.geometry);
  return { group, pivot, bucket: bucketMesh, lamp, pane, paneMat, meshes, triangles: tris, water: [tw, ww, bucketWater] };
}

/**
 * The well's life (visual only): the bucket and its rope swing a little
 * about the pulley, as in a breeze, two slow pendulums out of step.
 */
export function wellLife(well, t) {
  well.pivot.rotation.z = 0.035 * Math.sin(t * 1.9) + 0.012 * Math.sin(t * 0.73 + 1);
  well.pivot.rotation.x = 0.025 * Math.sin(t * 1.6 + 0.6);
  well.bucket.rotation.y = 0.08 * Math.sin(t * 0.5);
}
