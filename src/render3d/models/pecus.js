/**
 * models/pecus.js
 * ----------------------------------------------------------------------------
 * The villages' flocks (models/villages.js puts them in the meeting place's
 * fold and by the huts): sheep and goats, as the hill peoples of Liguria kept
 * them. Strabo has the Ligurians living "mostly on their flocks", on milk
 * and a drink of barley; the bones from the castellari are mostly sheep and
 * goat, small beasts: a sheep of the Iron Age stood some 55 to 65 cm at the
 * shoulder, long-tailed, its fleece of mixed shades (the white fleece bred
 * for later), a goat a little taller and leaner, horned, bearded.
 *
 *   sheep  a deep barrel under a lumpy fleece, a narrow bare face, ears out
 *          to the side, thin legs, a long tail hanging; four fleeces (cream,
 *          grey-brown, dark brown, black)
 *   goat   lean and leggy, the back straight, horns sweeping back, a beard,
 *          a short tail held up; four coats (tawny, black, white, pied)
 *
 * Two poses each, head up and grazing, as the farms' pigs and horses
 * (livestock.js): each animal at each pose and level is one geometry in one
 * material (`hide`, its coat in its vertex colours), so every beast of a
 * coat and pose on screen is one draw, and they move by their instance
 * matrices (livestock.js herdPlaces).
 *
 * Metres, standing on y = 0, facing +z, the body's middle over the origin.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, ConeGeometry } from 'three';
import { revolve, profileOf, merge, triangles } from '../shapes.js';
import { smoothstep } from '../texgen.js';
import { ruralMaterials, lin, mixc, paint } from './rural.js';
import { limb } from './orchard.js';

/** The fleeces and coats (sRGB): body, face and legs, a darker shade. */
export const SHEEP_COATS = Object.freeze([
  { body: 0xd9cdb2, face: 0x9a8a74, dark: 0x6e6252 },
  { body: 0x9a8a72, face: 0x5e5244, dark: 0x4a4036 },
  { body: 0x6a5240, face: 0x3e3024, dark: 0x2e241c },
  { body: 0x3a332e, face: 0x2a2420, dark: 0x1c1816 },
]);
export const GOAT_COATS = Object.freeze([
  { body: 0x9a6a3e, face: 0x6e4a2c, dark: 0x2e2218, pied: null },
  { body: 0x2e2824, face: 0x24201c, dark: 0x181412, pied: null },
  { body: 0xd8d0c0, face: 0xc8beac, dark: 0x8a8070, pied: null },
  { body: 0xd2c8b6, face: 0x2a2420, dark: 0x2a2420, pied: 0x2a2420 },
]);

/** A cheap repeatable noise in [-1, 1] from a point (the fleece's lumps). */
function lumps(x, y, z, f = 9) {
  return Math.sin(x * f + 1.3) * Math.sin(y * f * 1.3 + 0.4) * Math.sin(z * f * 0.9 + 2.1);
}

/** A trunk turned about z (rump at z0, chest at z1) from a profile, squashed to `wide` across. */
function barrel(prof, z0, seg, wide, y0) {
  const g = revolve(profileOf(prof), { segments: seg, metres: 1 });
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * wide, p.getY(i) + y0, p.getZ(i));
  return g;
}

/** Four legs from the body down to the hooves at the given [x, z] places, `top` high, darker below. */
function legs(places, top, r0, r1, rgb, hoof, radial, segs) {
  return places.map(([x, z, back]) => {
    // A hind leg's hock bends back, a foreleg's knee a little forward.
    const mid = back ? [x, top * 0.45, z - 0.05] : [x, top * 0.5, z + 0.015];
    const l = limb([[x, top, z], mid, [x, 0, z + (back ? 0.01 : 0)]], r0, r1, { radial, segs });
    const p = l.attributes.position;
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = y < 0.05 ? hoof : mixc(mixc(rgb, hoof, 0.5), rgb, smoothstep(0.08, top * 0.7, y));
      c[i * 3] = k[0];
      c[i * 3 + 1] = k[1];
      c[i * 3 + 2] = k[2];
    }
    paint(l, [1, 1, 1]);
    l.attributes.color.array.set(c);
    return l;
  });
}

/** A sheep, coat 0..3, pose 'stand' or 'graze'. Returns { group, meshes, triangles }. */
export function buildSheep({ coat = 0, pose = 'stand', lod = 0 } = {}) {
  const C = SHEEP_COATS[coat % SHEEP_COATS.length];
  const body = lin(C.body);
  const face = lin(C.face);
  const dark = lin(C.dark);
  const seg = lod === 0 ? 14 : lod === 1 ? 8 : 5;
  const radial = lod === 0 ? 6 : lod === 1 ? 4 : 3;
  const legTop = 0.36;
  // The fleece's barrel, rump (z -0.46) to the breast (z 0.42): deep and round, the wool's lumps.
  const prof = lod === 2
    ? [[0, 0], [0.18, 0.08], [0.22, 0.45], [0.18, 0.8], [0, 0.88]]
    : [[0, 0], [0.12, 0.02], [0.19, 0.08], [0.225, 0.22], [0.235, 0.45], [0.225, 0.64], [0.19, 0.78], [0.12, 0.86], [0, 0.88]];
  const g = barrel(prof, -0.46, seg, 0.92, legTop + 0.19);
  const p = g.attributes.position;
  if (lod === 0) {
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const k = 1 + 0.06 * lumps(x, y, z, 26) + 0.04 * lumps(x, y, z, 11);
      p.setXYZ(i, x * k, legTop + 0.19 + (y - legTop - 0.19) * k, z);
    }
  }
  g.computeVertexNormals();
  paint(g, body, (x, y) => 0.74 + 0.26 * smoothstep(legTop, legTop + 0.36, y));
  const parts = [g];
  // Neck and head: the head up and forward, or down to the grass.
  const graze = pose === 'graze';
  const neck0 = [0, legTop + 0.3, 0.32];
  const poll = graze ? [0, 0.2, 0.62] : [0, legTop + 0.42, 0.52];
  const muzzle = graze ? [0, 0.04, 0.72] : [0, legTop + 0.32, 0.72];
  parts.push(paint(limb([neck0, [(neck0[0] + poll[0]) / 2, (neck0[1] + poll[1]) / 2 + 0.03, (neck0[2] + poll[2]) / 2], poll], 0.12, 0.08, { radial: radial + 1, segs: lod === 2 ? 1 : 3 }), body, () => 0.95));
  parts.push(paint(limb([poll, muzzle], 0.065, 0.035, { radial, segs: lod === 2 ? 1 : 2 }), face));
  if (lod < 2) {
    // The ears out to the side, a little drooping.
    for (const s of [-1, 1]) {
      const e = new ConeGeometry(0.025, 0.11, 3, 1);
      e.rotateZ(s * (Math.PI / 2 + 0.35));
      e.translate(poll[0] + s * 0.08, poll[1] - 0.01, poll[2] - 0.01);
      parts.push(paint(e, face));
    }
    // The long tail hanging.
    parts.push(paint(limb([[0, legTop + 0.3, -0.46], [0, legTop + 0.1, -0.5], [0, legTop - 0.12, -0.49]], 0.045, 0.03, { radial: 4, segs: 3 }), body, () => 0.85));
  }
  parts.push(...legs([[-0.09, 0.27], [0.09, 0.27], [-0.09, -0.3, 1], [0.09, -0.3, 1]], legTop + 0.06, 0.03, 0.017, face, dark, Math.max(3, radial - 2), lod === 2 ? 1 : 3));
  return finish([merge(parts)]);
}

/** A goat, coat 0..3, pose 'stand' or 'graze'. Returns { group, meshes, triangles }. */
export function buildGoat({ coat = 0, pose = 'stand', lod = 0 } = {}) {
  const C = GOAT_COATS[coat % GOAT_COATS.length];
  const body = lin(C.body);
  const face = lin(C.face);
  const dark = lin(C.dark);
  const pied = C.pied === null ? null : lin(C.pied);
  const seg = lod === 0 ? 14 : lod === 1 ? 8 : 5;
  const radial = lod === 0 ? 6 : lod === 1 ? 4 : 3;
  const legTop = 0.44;
  const prof = lod === 2
    ? [[0, 0], [0.13, 0.08], [0.17, 0.45], [0.14, 0.8], [0, 0.86]]
    : [[0, 0], [0.09, 0.02], [0.145, 0.09], [0.17, 0.25], [0.175, 0.45], [0.17, 0.62], [0.15, 0.76], [0.1, 0.84], [0, 0.86]];
  const g = barrel(prof, -0.44, seg, 0.82, legTop + 0.15);
  g.computeVertexNormals();
  // A pied coat: black fore- and hindquarters, white in the middle (as the old Alpine goats), else the coat.
  paint(g, body, (x, y) => 0.78 + 0.22 * smoothstep(legTop, legTop + 0.3, y));
  if (pied) {
    const p = g.attributes.position;
    const c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      const k = smoothstep(0.18, 0.28, Math.abs(z + 0.02) + 0.04 * Math.sin(p.getY(i) * 30));
      const v = mixc(body, pied, k);
      c.setXYZ(i, v[0], v[1], v[2]);
    }
  }
  const parts = [g];
  const graze = pose === 'graze';
  const neck0 = [0, legTop + 0.24, 0.3];
  const poll = graze ? [0, 0.24, 0.66] : [0, legTop + 0.52, 0.48];
  const muzzle = graze ? [0, 0.05, 0.74] : [0, legTop + 0.38, 0.66];
  const neckC = pied || body;
  parts.push(paint(limb([neck0, [(neck0[0] + poll[0]) / 2, (neck0[1] + poll[1]) / 2 + 0.02, (neck0[2] + poll[2]) / 2], poll], 0.085, 0.06, { radial: radial + 1, segs: lod === 2 ? 1 : 3 }), neckC));
  parts.push(paint(limb([poll, muzzle], 0.055, 0.03, { radial, segs: lod === 2 ? 1 : 2 }), face));
  if (lod < 2) {
    // The horns, sweeping up and back from the poll; the ears; the beard under the chin; the tail up.
    const up = graze ? [0, 0.12, -0.1] : [0, 0.08, -0.14];
    for (const s of [-1, 1]) {
      const a = [poll[0] + s * 0.03, poll[1] + 0.03, poll[2] - 0.01];
      parts.push(paint(limb([a, [a[0] + s * 0.03, a[1] + up[1] + 0.04, a[2] + up[2] * 0.6], [a[0] + s * 0.06, a[1] + up[1] + 0.02, a[2] + up[2] * 1.4]], 0.016, 0.004, { radial: 4, segs: lod ? 2 : 4 }), lin(0x6e6250)));
      const e = new ConeGeometry(0.022, 0.1, 3, 1);
      e.rotateZ(s * (Math.PI / 2 + 0.6));
      e.translate(poll[0] + s * 0.07, poll[1] - 0.03, poll[2] - 0.02);
      parts.push(paint(e, face));
    }
    const chin = [muzzle[0], muzzle[1] - 0.03, muzzle[2] - 0.05];
    parts.push(paint(limb([chin, [chin[0], chin[1] - 0.07, chin[2] - 0.01]], 0.018, 0.004, { radial: 3, segs: 1 }), dark));
    parts.push(paint(limb([[0, legTop + 0.24, -0.43], [0, legTop + 0.33, -0.46]], 0.025, 0.01, { radial: 3, segs: 1 }), body));
  }
  parts.push(...legs([[-0.07, 0.27], [0.07, 0.27], [-0.07, -0.29, 1], [0.07, -0.29, 1]], legTop + 0.05, 0.026, 0.014, pied ? dark : face, dark, Math.max(3, radial - 2), lod === 2 ? 1 : 3));
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

/** A beast of the flock by its kit key's words: 'sheep' or 'goat', a coat, a pose. */
export function buildBeast(kind, coat, pose, lod) {
  return (kind === 'goat' ? buildGoat : buildSheep)({ coat, pose, lod });
}
