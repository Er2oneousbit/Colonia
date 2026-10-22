/**
 * kit.js
 * ----------------------------------------------------------------------------
 * A model as the game draws it: the lab builds a model as a Group of meshes
 * (some in groups of their own, so they can sway); the game draws many
 * copies of it with instancing (modelPass.js), one draw call a part. A kit
 * is the model flattened into such parts: every mesh's geometry with its
 * place in the model baked in, merged with the others that share its
 * material, its state tag (userData.when: models.js partShows), whether it
 * casts a shadow, and its vertex colours' size (RGB or RGBA: they cannot be
 * merged together).
 * ----------------------------------------------------------------------------
 */

import { ColorManagement } from 'three';
import { merge, triangles } from './shapes.js';

/**
 * Run `fn` with three's colour management on: the look's colours and
 * materials are written in sRGB and must be converted while a kit or a
 * pass builds them (modelPass.js header). The setting is put back after,
 * for the WebGL backend runs with it off.
 */
export function withColourManagement(fn) {
  const was = ColorManagement.enabled;
  ColorManagement.enabled = true;
  try {
    return fn();
  } finally {
    ColorManagement.enabled = was;
  }
}

/** Flatten a built model into its parts: { parts: [{ geometry, material, when, cast, cover }], triangles }. */
export function kitOf(group) {
  group.updateMatrixWorld(true);
  const byKey = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const colour = g.attributes.color ? g.attributes.color.itemSize : 0;
    const when = o.userData.when || 'always';
    const cover = o.userData.cover !== false;
    const key = `${o.material.uuid}|${when}|${o.castShadow ? 1 : 0}|${colour}|${cover ? 1 : 0}`;
    let p = byKey.get(key);
    if (!p) {
      p = { material: o.material, when, cast: o.castShadow, cover, list: [] };
      byKey.set(key, p);
    }
    p.list.push(g);
  });
  const parts = [];
  let tris = 0;
  for (const p of byKey.values()) {
    const geometry = p.list.length === 1 ? p.list[0] : merge(p.list);
    if (p.list.length > 1) for (const g of p.list) g.dispose();
    geometry.computeBoundingSphere();
    tris += triangles(geometry);
    parts.push({ geometry, material: p.material, when: p.when, cast: p.cast, cover: p.cover });
  }
  // Opaque parts first (three draws them first anyway); among the see-through, in the model's own order.
  parts.sort((a, b) => (a.material.transparent ? 1 : 0) - (b.material.transparent ? 1 : 0));
  return { parts, triangles: tris };
}

/** Free a kit's geometries (its materials are the look's, shared and kept). */
export function disposeKit(kit) {
  for (const p of kit.parts) p.geometry.dispose();
}
