/**
 * models/sacredRuin.js
 * ----------------------------------------------------------------------------
 * What raiders leave at the sacred monuments and the lighthouse: heaps of
 * broken stone (the shared site's rubble, models/worksite.js), toppled
 * scaffolds on a site, and once columns stand, their drums fallen across
 * the paving where the columns the monument's look leaves out were knocked
 * down; scorched timbers. A kit of its own, drawn over the monument while
 * the sim says it is struck (a site set back this raid) or sacked (a
 * finished one, until it is repaired).
 *
 * Metres, each monument's own frame (fanum.js, pantheum.js, pharus.js).
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { TaggedParts } from './masonry.js';
import { siteParts } from './worksite.js';
import { sacraMaterials, box } from './sacra.js';
import { FANUM, FANUM_TEMPLE, TEMPLE_AT } from './fanum.js';
import { PANTHEUM } from './pantheum.js';
import { PHARUS } from './pharus.js';

/** Where the rubble lies, by monument: [x, y, z, w, d] (y the ground it lies on). */
const HEAPS = {
  fanum: [[-6.2, 0, 8.8, 2.0, 1.2], [5.4, 0, 9.0, 1.8, 1.0], [-5.0, FANUM.t1.y, 4.2, 1.6, 1.3], [6.6, FANUM.t1.y, 5.6, 1.4, 1.0], [-7.2, FANUM.t3.y, -4.0, 1.4, 1.6], [3.5, FANUM.t3.y, -2.6, 1.6, 0.9]],
  pantheum: [[-7.6, 0, 7.6, 1.8, 1.2], [6.9, 0, 8.6, 1.6, 1.0], [-3.2, PANTHEUM.floorY, 6.2, 1.2, 0.9], [7.4, 0, 1.4, 1.4, 1.6], [-7.0, 0, -6.4, 1.6, 1.4]],
  pharus: [[-3.0, PHARUS.top, 3.8, 1.6, 1.0], [2.9, PHARUS.top, 4.6, 1.3, 1.0], [3.6, PHARUS.top, -2.9, 1.4, 1.0]],
};

/** Fallen column drums: [x, y, z, ry, r, n drums] once the monument's columns stand (t past `from`). */
const DRUMS = {
  fanum: { from: 2.4, list: [[-1.1, FANUM.t3.y + 0.18, TEMPLE_AT[2] + FANUM_TEMPLE.steps[1] + 0.9, 0.3, 0.18, 4], [-7.4, FANUM.t3.y + 0.15, -5.4, 1.4, 0.15, 3], [7.8, FANUM.t3.y + 0.15, -7.0, 1.1, 0.15, 3]] },
  pantheum: { from: 2.6, list: [[-1.6, 0.2, 9.1, 0.15, 0.2, 4], [3.6, 0.2, 9.0, -0.25, 0.2, 3], [-5.8, 0.18, 3.8, 1.3, 0.16, 3]] },
  pharus: { from: 3.6, list: [[-1.6, PHARUS.top + 0.12, 5.0, 0.4, 0.12, 2]] },
};

/** The rubble kit of monument `kind` at timeline `t`: { group }. */
export function buildRuin(kind, t, lod = 0) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const p = new TaggedParts(`ruin-${kind}`);
  // The heaps, each on its own ground's level (the shared site's rubble lies on y 0: lifted).
  for (const [x, y, z, w, d] of HEAPS[kind]) {
    for (const e of siteParts({ rubble: [{ x, z, ry: (x * 0.7) % 3, w, d }] }, lod)) p.add(e.name, e.material, [e.g.translate(0, y, 0)], { cast: e.cast });
  }
  const m = sacraMaterials();
  const D = DRUMS[kind];
  if (t >= D.from) {
    const drums = [];
    for (const [x, y, z, ry, r, n] of D.list) {
      for (let k = 0; k < n; k++) {
        const g = new CylinderGeometry(r, r, r * 2.1, lod === 2 ? 6 : lod ? 10 : 16, 1);
        g.rotateZ(Math.PI / 2);
        g.translate((k - (n - 1) / 2) * r * 2.3, 0, (k % 2) * 0.08);
        g.rotateY(ry);
        g.translate(x, y, z);
        drums.push(tintGeometry(boxUV(g), () => 0.8 + (k % 3) * 0.06));
      }
    }
    p.add('drums', m.marble, drums);
  }
  // Scorched timbers: beams fallen black where the fire took the roofs.
  if (lod < 2) {
    const burnt = HEAPS[kind].slice(0, 3).map(([x, y, z], i) => box(1.6, 0.14, 0.16, x + 0.4, y + 0.3, z + 0.3 - i * 0.1, 0.25).rotateY(0));
    p.add('burnt', m.ash, burnt, { cast: false });
  }
  return p.build();
}
