/**
 * models/livestock.js
 * ----------------------------------------------------------------------------
 * The farms' animals (farm.js puts them in the pig farm's pen and the horse
 * ranch's paddock): simple, but alive.
 *
 *   pig    the Roman pig was a long-legged, bristly, mostly dark beast, as
 *          the reliefs and Varro's and Columella's advice show (they ask
 *          for a sow long in the flank, broad, deep-bodied); here in three
 *          coats: black, russet and a sandy grey. Two poses: standing,
 *          and rooting with its snout in the mud.
 *   horse  a small Roman horse, about 1.4 m at the withers: barrel, a neck
 *          and head, legs, mane and tail; six coats (bay, chestnut, grey,
 *          black, dun, dark bay). Two poses: head up, and grazing.
 *
 * Each animal at each pose and level of detail is one geometry in one
 * material (`hide`, its coat in its vertex colours), so the game draws
 * every pig of a coat and pose on screen in one call. They move by their
 * instance matrices (herdPlaces): each wanders a small loop of its own in
 * the pen, stops to root or graze, walks on.
 *
 * Metres, standing on y = 0, facing +z, the body's middle over the origin.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, CylinderGeometry, ConeGeometry } from 'three';
import { revolve, profileOf, merge, triangles, boxUV } from '../shapes.js';
import { smoothstep, artRng } from '../texgen.js';
import { ruralMaterials, lin, mixc, paint } from './rural.js';
import { limb } from './orchard.js';

/** The coats (sRGB): body, darker parts (legs, mane, tail, snout). */
export const PIG_COATS = Object.freeze([
  { body: 0x35302d, dark: 0x221e1c, snout: 0x6a4f48 },
  { body: 0x8a5634, dark: 0x5e3a24, snout: 0xb07a68 },
  { body: 0xb49a82, dark: 0x7c6555, snout: 0xc89a8c },
]);
export const HORSE_COATS = Object.freeze([
  { body: 0x7a4626, dark: 0x1f1714, mane: 0x1f1714 }, // bay
  { body: 0x95562c, dark: 0x6e3d20, mane: 0xb07a4a }, // chestnut
  { body: 0xb9b4aa, dark: 0x6d6a64, mane: 0xd8d4cc }, // grey
  { body: 0x2c2522, dark: 0x1b1716, mane: 0x1b1716 }, // black
  { body: 0xb08a58, dark: 0x3a2c22, mane: 0x3a2c22 }, // dun
  { body: 0x4c2e1c, dark: 0x1d1612, mane: 0x1d1612 }, // dark bay
]);

/** Bend the vertices beyond z0 (toward +z) down about the point (y0, z0) by `angle`, eased in over `ease` m. */
function bendDown(g, y0, z0, angle, ease = 0.18) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    if (z <= z0) continue;
    const a = angle * smoothstep(z0, z0 + ease, z);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const y = p.getY(i) - y0;
    const dz = z - z0;
    p.setY(i, y0 + y * c - dz * s);
    p.setZ(i, z0 + y * s + dz * c);
    if (n) {
      const ny = n.getY(i);
      const nz = n.getZ(i);
      n.setY(i, ny * c - nz * s);
      n.setZ(i, ny * s + nz * c);
    }
  }
  return g;
}

/** A pig, coat 0..2, pose 'stand' or 'root'. Returns { group, meshes, triangles }. */
export function buildPig({ coat = 0, pose = 'stand', lod = 0 } = {}) {
  const C = PIG_COATS[coat % PIG_COATS.length];
  const body = lin(C.body);
  const dark = lin(C.dark);
  const snout = lin(C.snout);
  const seg = lod === 0 ? 14 : lod === 1 ? 8 : 5;
  const legH = 0.3;
  // The body and head turned about their long axis, rump (0) to snout (1.15).
  const P = profileOf(lod === 2
    ? [[0, 0], [0.2, 0.06], [0.24, 0.4], [0.2, 0.8], [0.13, 0.98], [0.07, 1.12], [0, 1.15]]
    : [[0, 0], [0.11, 0.015], [0.19, 0.07], [0.235, 0.2], [0.245, 0.45], [0.235, 0.66], [0.205, 0.79], [0.165, 0.87], [0.145, 0.95], [0.11, 1.03], [0.078, 1.09], [0.072, 1.135], [0, 1.15]]);
  const g = revolve(P, { segments: seg, metres: 1 });
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, -0.58);
  // Deep, not wide; the back straight, the belly hanging a little.
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i);
    const z = pos.getZ(i);
    if (y < 0) y *= 1.12;
    pos.setX(i, pos.getX(i) * 0.86);
    pos.setY(i, y * 1.06 + legH + 0.22 - 0.03 * smoothstep(0.2, 0.6, z));
  }
  g.computeVertexNormals();
  const parts = [paint(g, body)];
  // Colour: the snout's disc, darker under the belly.
  const cg = parts[0].attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let c = body;
    if (z > 0.53) c = mixc(body, snout, smoothstep(0.5, 0.56, z));
    const k = 0.72 + 0.28 * smoothstep(legH + 0.05, legH + 0.42, y);
    cg.setXYZ(i, c[0] * k, c[1] * k, c[2] * k);
  }
  // Ears: flaps forward over the eyes.
  if (lod < 2) {
    for (const s of [-1, 1]) {
      const e = new ConeGeometry(0.06, 0.13, lod ? 3 : 5, 1);
      e.scale(1, 1, 0.35);
      e.rotateX(1.0);
      e.rotateZ(s * 0.5);
      e.translate(s * 0.075, legH + 0.36, 0.33);
      parts.push(paint(e, mixc(body, dark, 0.3)));
    }
  }
  const head = merge(parts);
  if (pose === 'root') bendDown(head, legH + 0.22, 0.2, 0.62, 0.2);
  const all = [head];
  // Legs.
  const lr = lod === 2 ? 3 : 6;
  for (const [x, z] of [[-0.11, 0.3], [0.11, 0.3], [-0.11, -0.36], [0.11, -0.36]]) {
    const l = new CylinderGeometry(0.045, 0.035, legH + 0.08, lr, 1);
    l.translate(x, (legH + 0.08) / 2, z);
    boxUV(l);
    all.push(paint(l, dark, (xx, y) => 0.7 + 0.3 * smoothstep(0, legH, y)));
  }
  // The tail's curl.
  if (lod === 0) all.push(paint(limb([[0, legH + 0.36, -0.58], [0.03, legH + 0.4, -0.64], [-0.02, legH + 0.33, -0.66], [0.01, legH + 0.3, -0.62]], 0.014, 0.008, { radial: 3, segs: 5 }), dark));
  return finish([merge(all)]);
}

/** A horse, coat 0..5, pose 'stand' or 'graze'. Returns { group, meshes, triangles }. */
export function buildHorse({ coat = 0, pose = 'stand', lod = 0 } = {}) {
  const C = HORSE_COATS[coat % HORSE_COATS.length];
  const body = lin(C.body);
  const dark = lin(C.dark);
  const mane = lin(C.mane);
  const seg = lod === 0 ? 16 : lod === 1 ? 9 : 5;
  const radial = lod === 0 ? 8 : lod === 1 ? 5 : 3;
  const parts = [];
  // The barrel, from the buttocks (z -0.8) to the chest (z 0.75).
  const P = profileOf(lod === 2
    ? [[0, 0], [0.26, 0.12], [0.33, 0.6], [0.3, 1.3], [0.18, 1.55], [0, 1.58]]
    : [[0, 0], [0.16, 0.03], [0.27, 0.14], [0.32, 0.36], [0.34, 0.7], [0.335, 1.05], [0.31, 1.3], [0.25, 1.48], [0.14, 1.56], [0, 1.58]]);
  const barrel = revolve(P, { segments: seg, metres: 1 });
  barrel.rotateX(Math.PI / 2);
  barrel.translate(0, 0, -0.82);
  const bp = barrel.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i);
    const z = bp.getZ(i);
    bp.setX(i, bp.getX(i) * 0.78);
    // Deep in the chest, the croup a little higher than the back.
    bp.setY(i, y * (1.12 + 0.08 * smoothstep(0, 0.7, z)) + 1.08 + 0.04 * smoothstep(-0.2, -0.75, z));
  }
  barrel.computeVertexNormals();
  parts.push(paint(barrel, body, (x, y) => 0.78 + 0.22 * smoothstep(0.75, 1.35, y)));
  // Neck and head: up and forward, or down to the grass.
  const graze = pose === 'graze';
  const withers = [0, 1.32, 0.55];
  const poll = graze ? [0, 0.62, 1.12] : [0, 1.78, 0.98];
  const muzzle = graze ? [0, 0.06, 1.28] : [0, 1.38, 1.36];
  const midNeck = graze ? [0, 1.0, 0.92] : [0, 1.62, 0.8];
  parts.push(paint(limb([withers, midNeck, poll], 0.2, 0.11, { radial, segs: lod === 2 ? 2 : 5 }), body));
  const mid = [(poll[0] + muzzle[0]) / 2, (poll[1] + muzzle[1]) / 2 + (graze ? 0 : 0.02), (poll[2] + muzzle[2]) / 2 + (graze ? 0.03 : 0)];
  parts.push(paint(limb([poll, mid, muzzle], 0.105, 0.065, { radial, segs: lod === 2 ? 1 : 3 }), body, (x, y, z) => {
    const d = Math.hypot(x - muzzle[0], y - muzzle[1], z - muzzle[2]);
    return 0.45 + 0.55 * smoothstep(0.05, 0.2, d);
  }));
  // The mane along the top of the neck, the ears.
  if (lod < 2) {
    const up = graze ? [0, 0.06, -0.06] : [0, 0.09, -0.05];
    parts.push(paint(limb([[withers[0], withers[1] + 0.13, withers[2] - 0.05], [midNeck[0], midNeck[1] + up[1] + 0.06, midNeck[2] + up[2]], [poll[0], poll[1] + 0.08, poll[2] - 0.02]], 0.05, 0.035, { radial: Math.max(3, radial - 3), segs: 4 }), mane));
    for (const s of [-1, 1]) {
      const e = new ConeGeometry(0.03, 0.12, lod ? 3 : 4, 1);
      e.translate(0, 0.06, 0);
      e.rotateX(graze ? 1.6 : -0.2);
      e.translate(s * 0.05, poll[1] + (graze ? 0.0 : 0.08), poll[2] + (graze ? 0.08 : 0));
      parts.push(paint(e, mixc(body, dark, 0.4)));
    }
  }
  // Legs: forearm to hoof, a slight bend at the knee; the hooves dark.
  for (const [x, z, front] of [[-0.15, 0.48, 1], [0.15, 0.48, 1], [-0.15, -0.58, 0], [0.15, -0.58, 0]]) {
    const knee = front ? [x, 0.5, z + 0.02] : [x, 0.55, z - 0.06];
    const l = limb([[x, 1.05, z], knee, [x, 0.0, z + (front ? 0.02 : 0.0)]], 0.085, 0.04, { radial: Math.max(3, radial - 2), segs: lod === 2 ? 1 : 4 });
    parts.push(paint(l, body, null));
    // Dark points (bay and dun), the hoof.
    const lc = l.attributes.color;
    const lp = l.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const y = lp.getY(i);
      const c = y < 0.07 ? lin(0x2a221c) : mixc(dark, body, smoothstep(0.35, 0.75, y));
      lc.setXYZ(i, c[0], c[1], c[2]);
    }
  }
  // The tail.
  parts.push(paint(limb([[0, 1.42, -0.84], [0, 1.2, -0.98], [0, 0.72, -0.98]], lod ? 0.07 : 0.06, 0.035, { radial: Math.max(3, radial - 3), segs: lod === 2 ? 1 : 4 }), mane));
  return finish([merge(parts)]);
}

function finish(geos) {
  const m = ruralMaterials();
  const group = new Group();
  const meshes = geos.map((g) => {
    const mesh = new Mesh(g, m.hide);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  });
  let tris = 0;
  for (const mesh of meshes) tris += triangles(mesh.geometry);
  return { group, meshes, triangles: tris };
}

/**
 * Where each animal of a herd is at time `t` (seconds): each wanders a
 * small loop of its own inside its cell of the pen ([x0, z0, x1, z1]),
 * walking for a while, then stopping to root or graze (pose 1) with its
 * head down, facing where it last walked. `out` gets { x, z, yaw, pose,
 * scale } for each of `n` animals (seeded by `seed`); `cells` is the pen
 * split into n cells (penCells).
 */
export function herdPlaces(n, cells, seed, t, out, { pace = 0.32, still = 0.55, young = 0 } = {}) {
  const rnd = artRng(seed);
  for (let i = 0; i < n; i++) {
    const [x0, z0, x1, z1] = cells[i % cells.length];
    const cx = (x0 + x1) / 2 + (rnd() - 0.5) * (x1 - x0) * 0.2;
    const cz = (z0 + z1) / 2 + (rnd() - 0.5) * (z1 - z0) * 0.2;
    const ax = Math.max(0.05, (x1 - x0) / 2 - 0.45);
    const az = Math.max(0.05, (z1 - z0) / 2 - 0.45);
    const ph = rnd() * 6.283;
    const rate = 0.045 + rnd() * 0.03; // cycles of walking and stopping a second
    const cyc = t * rate + rnd();
    const k = Math.floor(cyc);
    const f = cyc - k;
    // The path's parameter moves only while walking (the last part of each cycle).
    const walk = smoothstep(still, 1, f);
    const q = (k + walk) * pace + ph;
    const dir = rnd() < 0.5 ? 1 : -1;
    const x = cx + ax * Math.cos(q * dir);
    const z = cz + az * Math.sin(q * dir * 2) * 0.9;
    // Facing along the path (its derivative at q).
    const dx = -ax * Math.sin(q * dir) * dir;
    const dz = az * Math.cos(q * dir * 2) * 1.8 * dir;
    const o = out[i] || (out[i] = {});
    o.x = x;
    o.z = z;
    o.yaw = Math.atan2(dx, dz);
    o.pose = f < still - 0.05 ? 1 : 0;
    o.scale = i < young ? 0.62 : 1;
  }
  return out;
}

/** Split a pen [x0, z0, x1, z1] into at least n cells of a grid, longer side first. */
export function penCells(pen, n) {
  const [x0, z0, x1, z1] = pen;
  const w = x1 - x0;
  const d = z1 - z0;
  let cols = Math.max(1, Math.round(Math.sqrt((n * w) / d)));
  let rows = Math.ceil(n / cols);
  while (cols * rows < n) rows++;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cells.push([x0 + (c * w) / cols, z0 + (r * d) / rows, x0 + ((c + 1) * w) / cols, z0 + ((r + 1) * d) / rows]);
  }
  // Interleaved, so a small herd spreads over the pen rather than filling one corner.
  const order = [];
  for (let s = 0; s < 2; s++) for (let i = s; i < cells.length; i += 2) order.push(cells[i]);
  return order;
}

