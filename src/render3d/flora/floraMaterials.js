/**
 * flora/floraMaterials.js
 * ----------------------------------------------------------------------------
 * The materials of the 3D countryside (flora/), shared by key as the look's
 * others are (materials.js), all with the look's shader patch:
 *
 *   bark     per species: its bark surface (surfacesFlora.js, or the farms'
 *            `bark`), swaying with the tree (LOOK_KIND.WOOD: the sway's
 *            height is the species', so a cypress bends from its foot and a
 *            shrub hardly at all), snow on what faces up, darker when wet
 *   foliage  per species: its spray surface cut out by the alpha (alpha
 *            test, and alpha to coverage where the canvas is multisampled:
 *            soft edges, no sorting), both sides drawn with the crown's
 *            outward normal (LOOK_KIND.FOLIAGE), swaying and fluttering
 *   rock     the limestone of outcrops and boulders (`crag`), and the dark
 *            lava of a volcanic province's boulders
 *
 * The vertex colours carry the species' and the season's colour (the
 * sprays are painted a pale neutral green: one texture for every season)
 * and the crown's own shade.
 * ----------------------------------------------------------------------------
 */

import { MeshStandardMaterial, Color, Vector2, DoubleSide } from 'three';
import { material, surfaceTextures, patchLook, LOOK_KIND } from '../materials.js';
import { SPECIES } from './species.js';

const CACHE = new Map();

/** How far a species sways at its top (metres): the slender cypress most, the shrubs least. */
export function swayOf(sp) {
  const s = SPECIES[sp];
  if (sp === 'cypress') return 0.22;
  if (sp === 'palm') return 0.3;
  return s.size.h < 2.5 ? 0.05 : 0.1 + s.size.h * 0.008;
}

/** A species' bark. */
export function barkMaterial(sp) {
  const s = SPECIES[sp];
  return material(`flora-bark-${sp}`, {
    surface: s.bark.tex, vertexColors: true, snow: 0.55, wet: 1, sway: swayOf(sp), swayH: s.size.h, kind: LOOK_KIND.WOOD, normal: 1.2,
  });
}

/**
 * A species' foliage: its spray (or, `blossom`, the blossom's spray), cut
 * out by its alpha. `tex` names another spray (a marcescent oak's dead
 * leaves are its own; myrtle's flowers the blossom's).
 */
export function foliageMaterial(sp, tex = null, lite = false) {
  const s = SPECIES[sp];
  const name = tex || s.leaf.tex;
  const key = `flora-leaf-${sp}-${name}${lite ? '-lite' : ''}`;
  let m = CACHE.get(key);
  if (m) return m;
  const t = surfaceTextures(name);
  m = new MeshStandardMaterial({
    color: new Color(0xffffff),
    vertexColors: true,
    map: t.map,
    // The middle level (lite) reads the colour alone: a leaf's relief is under a pixel there, and
    // the three other reads were a third of a wood's cost at 2x (measured: 24.6 ms a frame against 20).
    ...(lite ? { roughness: Math.min(1, s.leaf.rough + 0.45) * 0.72 } : {
      normalMap: t.normalMap, normalScale: new Vector2(1, 1), roughnessMap: t.orm, metalnessMap: t.orm, aoMap: t.orm, roughness: Math.min(1, s.leaf.rough + 0.45),
    }),
    metalness: 0,
    side: DoubleSide,
    // A plain cut, not alpha to coverage: on a multisampled canvas that drew every faint texel of
    // every spray into its samples, and a wood's layered sprays cost half again as much (measured,
    // 2x zoom at a pixel ratio of 2: 40 ms a frame against 27).
    alphaTest: 0.42,
  });
  m.name = key;
  // (The middle level's sprays take no shadow either: the crowns' own shade is in their colours, and
  // the shadow map's taps on every layer of a wood were 3 ms a frame at 2x.)
  m.userData.receive = !lite;
  patchLook(m, { snow: 0.8, wet: 0.7, sway: swayOf(sp), swayH: s.size.h, kind: LOOK_KIND.FOLIAGE });
  CACHE.set(key, m);
  return m;
}

/** The rocks' materials: limestone (a warm tint on the desert's maps) and lava. */
export function rockMaterial(kind, warm = false) {
  if (kind === 'lava') return material('flora-lava', { surface: 'lava', vertexColors: true, color: 0xc8beb4, snow: 1, wet: 1, normal: 1.6, rough: 1 });
  return material(warm ? 'flora-crag-warm' : 'flora-crag', { surface: 'crag', vertexColors: true, color: warm ? 0xe6d2b2 : 0xd6d2ca, snow: 1, wet: 1, normal: 1.3 });
}

/** Every flora material made so far (the warm-up compiles them; a reset frees them with the look's). */
export function floraMaterials() {
  return [...CACHE.values()];
}

/** Forget the foliage materials (the look's resetLook frees the textures; these go with them). */
export function resetFloraMaterials() {
  for (const m of CACHE.values()) m.dispose();
  CACHE.clear();
}

export { DoubleSide };
