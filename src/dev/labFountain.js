/**
 * labFountain.js
 * ----------------------------------------------------------------------------
 * The look lab's Fountain scene: the street fountain's four looks
 * (render3d/models/fountain.js) side by side on the well's street, the
 * poorest on the left, running in the front row and dry behind, each
 * with a label; two figures for scale. The lab shows it through its moods,
 * seasons, snow and rain; `setLod` swaps every fountain for its simpler
 * versions (the game's far zooms), to judge them.
 * ----------------------------------------------------------------------------
 */

import { Group } from 'three';
import { buildFountain, setFountainState, FOUNTAIN } from '../render3d/models/fountain.js';
import { iceMaterial, stagnantMaterial } from '../render3d/materials.js';
import { buildFigure } from '../render3d/models/figure.js';

/** Where the fountains stand (metres): four across, two rows (dry behind, running in front). */
export const FOUNTAIN_SCENE = Object.freeze({
  xs: Object.freeze([-6.3, -2.1, 2.1, 6.3]),
  rows: Object.freeze([{ z: -2.15, state: 'dry' }, { z: 2.05, state: 'flowing' }]),
});

/** Build the scene's group: { group, fountains: [{ f, tier, state, x, z }], setLod, setWinter, triangles(lod) }. */
export function buildFountainScene() {
  const group = new Group();
  group.name = 'fountain-scene';
  const fountains = [];
  let lod = 0;
  let ice = false;
  const holders = [];
  for (const row of FOUNTAIN_SCENE.rows) {
    FOUNTAIN_SCENE.xs.forEach((x, i) => {
      const h = new Group();
      h.position.set(x, 0, row.z);
      group.add(h);
      holders.push({ h, tier: i + 1, state: row.state, x, z: row.z });
    });
  }
  // A man by the plain lacus with a jar, a woman at the marble basin: people for scale.
  const man = buildFigure({ cloth: 0xb9a888, reach: 0.5 });
  man.position.set(FOUNTAIN_SCENE.xs[0] + 1.25, 0.07, FOUNTAIN_SCENE.rows[1].z + 1.0);
  man.rotation.y = -Math.PI * 0.72;
  group.add(man);
  const woman = buildFigure({ cloth: 0x6f5a8a, cloth2: 0xc2a46a, long: true, skin: 0xb08664, hair: 0x221812 });
  woman.position.set(FOUNTAIN_SCENE.xs[2] - 1.15, 0.05, FOUNTAIN_SCENE.rows[1].z + 1.1);
  woman.rotation.y = Math.PI * 0.75;
  group.add(woman);

  /** Build (or rebuild at another level of detail) every fountain. */
  function build() {
    for (const o of fountains) {
      o.holder.remove(o.f.group);
      for (const m of o.f.meshes) m.geometry.dispose();
    }
    fountains.length = 0;
    for (const o of holders) {
      const f = buildFountain({ tier: o.tier, lod });
      o.h.add(f.group);
      fountains.push({ f, holder: o.h, tier: o.tier, state: o.state, x: o.x, z: o.z, name: FOUNTAIN.names[o.tier - 1] });
    }
    apply();
  }
  /** Each fountain's state; in a hard frost the running ones grow icicles and the dry ones' puddles freeze. */
  function apply() {
    for (const o of fountains) {
      setFountainState(o.f, o.state, ice);
      for (const m of o.f.meshes) if (m.name === 'puddle') m.material = ice ? iceMaterial() : stagnantMaterial();
    }
  }
  build();
  return {
    group,
    fountains,
    figures: [man, woman],
    get lod() { return lod; },
    setLod(n) {
      if (n === lod) return;
      lod = n;
      build();
    },
    setWinter(on) {
      ice = !!on;
      apply();
    },
    /** Triangles of each tier at a level of detail (built fresh: the lab's report). */
    triangles(l = lod) {
      return [1, 2, 3, 4].map((t) => buildFountain({ tier: t, lod: l }).triangles);
    },
  };
}
