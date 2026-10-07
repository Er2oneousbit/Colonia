/**
 * surfacesGov.js
 * ----------------------------------------------------------------------------
 * The surfaces of the senate house and the governor's residences
 * (models/curia.js, praetorium.js, praetoriumMaius.js, regia.js), recipes in
 * the same terms as surfaces.js (paint/recipe.js says how one is written).
 * surfaces.js adds them to SURFACES.
 *
 *   stucco   fine lime stucco, well kept: Vitruvius's (VII.3) coats of
 *            lime and sand finished with marble dust and polished, white
 *            enough to pass for marble; a soft cloud of tone, the trowel's
 *            sweeps, faint streaks where the rain runs down. The street's
 *            plaster (surfaces.js plaster) is a poor house's, painted and
 *            flaking; a governor's is kept up. Under fresco colours (the
 *            vertices' tints) it is the painted wall's ground.
 *
 * UVs are in metres (shapes.js), v up a wall.
 * ----------------------------------------------------------------------------
 */

import { fbm } from './paint/recipe.js';
import { rgb } from './paint/glsl.js';

const stucco = {
  fields: {
    noise: { cloud: fbm(3, 4, 21), grit: fbm(70, 2, 22), trowel: fbm(9, 3, 23, { sx: 0.35 }) },
    glsl: `
      return vec4( 0.5 + grit * 0.035 + trowel * 0.03, cloud, trowel, 0.0 );`,
  },
  blur: [2],
  colour: {
    noise: { tone: fbm(5, 3, 24), streakN: fbm(40, 3, 25, { sx: 0.06, coord: 'vu' }) },
    glsl: `
      float cav = cavity( F.x, B.x, 6.0 );
      col = mix( ${rgb('#e8e2d6')}, ${rgb('#d9d0c0')}, sstep( 0.35, 0.8, F.y ) * 0.55 );
      col = mix( col, ${rgb('#efebe2')}, sstep( 0.6, 0.85, tone ) * 0.3 );
      col = mix( col, ${rgb('#cbc1ae')}, sstep( 0.62, 0.86, streakN ) * 0.14 );
      col = mix( col, ${rgb('#a89f90')}, cav * 0.3 );
      orm = vec3( 1.0 - cav * 0.25, 0.62 + F.z * 0.1, 0.0 );`,
  },
  normal: { depth: 0.0008 / 0.5 },
};

export const GOV_SURFACES = Object.freeze({
  stucco: { metres: 2.0, size: 512, ...stucco },
});
