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

import { merge, triangles } from './shapes.js';

/** Flatten a built model into its parts: { parts: [{ geometry, material, when, cast }], triangles }. */
export function kitOf(group) {
  group.updateMatrixWorld(true);
  const byKey = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const colour = g.attributes.color ? g.attributes.color.itemSize : 0;
    const when = o.userData.when || 'always';
    const key = `${o.material.uuid}|${when}|${o.castShadow ? 1 : 0}|${colour}`;
    let p = byKey.get(key);
    if (!p) {
      p = { material: o.material, when, cast: o.castShadow, list: [] };
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
    parts.push({ geometry, material: p.material, when: p.when, cast: p.cast });
  }
  // Opaque parts first (three draws them first anyway); among the see-through, in the model's own order.
  parts.sort((a, b) => (a.material.transparent ? 1 : 0) - (b.material.transparent ? 1 : 0));
  return { parts, triangles: tris };
}

/** Free a kit's geometries (its materials are the look's, shared and kept). */
export function disposeKit(kit) {
  for (const p of kit.parts) p.geometry.dispose();
}
