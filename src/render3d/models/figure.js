/**
 * models/figure.js
 * ----------------------------------------------------------------------------
 * A simple human figure, 1.7 m, for scale in the look lab: a turned tunic
 * (or a long stola), limbs as capsules, a head with a hair cap, sandals.
 * A mannequin, not a character: it is there so the eye can measure the
 * well against a person, and to show how cloth and skin take the light.
 * (The buildings' people are actors, render3d/people/; figureParts is
 * left for a statue, the forum's.)
 *
 * Metres, standing on y = 0, facing +z.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, CapsuleGeometry, SphereGeometry, Vector3, Quaternion } from 'three';
import { revolve, profileOf, merge, tintGeometry, boxUV, block } from '../shapes.js';
import { material } from '../materials.js';

/** A capsule from a to b (Vector3s), radius r. */
function limb(a, b, r) {
  const len = a.distanceTo(b);
  const g = new CapsuleGeometry(r, Math.max(0.001, len), 4, 10);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  boxUV(g);
  return tintGeometry(g);
}

/**
 * A figure. `cloth` and `cloth2` are colours (tunic, mantle); `long` gives
 * an ankle-length stola; `reach` raises the right arm forward (to the
 * rope), 0..1; `seed` is not used yet (all figures are the one body).
 */
export function buildFigure({ cloth = 0xc9bca2, cloth2 = null, long = false, reach = 0, skin = 0xa87a58, hair = 0x2e2119 } = {}) {
  const g = new Group();
  const hem = long ? 0.06 : 0.5;
  // The garment, turned: a slight flare at the hem, the belt's pinch, the chest, the shoulders.
  const body = revolve(profileOf([
    [0.0, hem - 0.01], [0.2, hem], [0.205, hem + 0.02], [0.185, 0.8], [0.15, 0.98], [0.142, 1.0], [0.15, 1.02],
    [0.165, 1.15], [0.17, 1.28], [0.19, 1.36], [0.16, 1.42], [0.07, 1.46], [0.05, 1.47], [0.0, 1.47],
  ]), { segments: 28, metres: 0.12, tint: (p) => (p.y < 1.02 && p.y > 0.97 ? 0.6 : 0.85 + 0.15 * Math.min(1, (p.y - hem) / 0.3)) });
  // Flatten front to back: a body is not round.
  body.scale(1, 1, 0.68);
  const cl = material(`cloth-${cloth.toString(16)}`, { surface: 'wool', color: cloth, vertexColors: true, snow: 0.15 });
  const sk = material(`skin-${skin.toString(16)}`, { color: skin, roughness: 0.55, snow: 0, wet: 0 });
  const hr = material(`hair-${hair.toString(16)}`, { color: hair, roughness: 0.7, snow: 0.2 });
  const dark = material('leather', { color: 0x3b2a1e, roughness: 0.65, snow: 0.2 });
  const parts = { cloth: [body], skin: [], hair: [], leather: [] };
  // Legs (bare below the hem), feet in sandals.
  for (const s of [-1, 1]) {
    const hip = new Vector3(s * 0.085, 0.86, 0);
    const ankle = new Vector3(s * 0.095, 0.08, 0.0);
    parts.skin.push(limb(hip, ankle, 0.052));
    const foot = block(0.085, 0.05, 0.24, { bevel: 0.02, seed: 3, wobble: 0, grime: 0 });
    foot.translate(s * 0.095, 0, 0.05);
    parts.leather.push(foot);
  }
  // Arms: sleeve to the elbow in cloth, forearm and hand in skin.
  for (const s of [-1, 1]) {
    const sh = new Vector3(s * 0.2, 1.36, 0);
    const up = s > 0 && reach > 0;
    const el = up ? new Vector3(s * 0.24, 1.22, 0.2 * reach) : new Vector3(s * 0.24, 1.1, 0.02);
    const wr = up ? new Vector3(s * 0.22, 1.32, 0.42 * reach) : new Vector3(s * 0.25, 0.86, 0.06);
    parts.cloth.push(limb(sh, el, 0.055));
    parts.skin.push(limb(el, wr, 0.038));
    const hand = new SphereGeometry(0.045, 10, 8);
    hand.scale(0.8, 1.2, 0.6);
    const hp = wr.clone().add(wr.clone().sub(el).normalize().multiplyScalar(0.05));
    hand.translate(hp.x, hp.y, hp.z);
    boxUV(hand);
    parts.skin.push(tintGeometry(hand));
  }
  // Neck and head.
  parts.skin.push(limb(new Vector3(0, 1.43, 0), new Vector3(0, 1.52, 0.01), 0.045));
  const head = new SphereGeometry(0.1, 20, 16);
  head.scale(0.92, 1.12, 1.02);
  head.translate(0, 1.6, 0.012);
  boxUV(head);
  parts.skin.push(tintGeometry(head));
  const cap = new SphereGeometry(0.106, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  cap.scale(0.94, 1.1, 1.05);
  cap.rotateX(-0.35);
  cap.translate(0, 1.615, -0.006);
  boxUV(cap);
  parts.hair.push(tintGeometry(cap));
  // A mantle over the shoulders.
  if (cloth2 !== null) {
    const palla = revolve(profileOf([[0.0, 1.0], [0.21, 1.0], [0.215, 1.05], [0.2, 1.3], [0.17, 1.4], [0.08, 1.46], [0.0, 1.47]]), { segments: 24, metres: 0.12 });
    palla.scale(1.04, 1, 0.74);
    const pm = material(`cloth-${cloth2.toString(16)}`, { surface: 'wool', color: cloth2, vertexColors: true, snow: 0.15 });
    const mm = new Mesh(merge([palla]), pm);
    mm.castShadow = mm.receiveShadow = true;
    g.add(mm);
  }
  for (const [k, mat] of [['cloth', cl], ['skin', sk], ['hair', hr], ['leather', dark]]) {
    const m = new Mesh(merge(parts[k]), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = k;
    g.add(m);
  }
  return g;
}

/**
 * A figure's meshes as geometry lists by material, placed (x, y, z), turned
 * `ry`, at `scale`: for a model that merges its people into its own parts
 * (the forum's clerk, the watch house's vigiles, the builders).
 */
export function figureParts(opts, x, y, z, ry, scale = 1) {
  const f = buildFigure(opts);
  f.scale.setScalar(scale);
  f.rotation.y = ry;
  f.position.set(x, y, z);
  f.updateMatrixWorld(true);
  const parts = [];
  f.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    parts.push({ g, material: o.material });
  });
  f.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  return parts;
}
