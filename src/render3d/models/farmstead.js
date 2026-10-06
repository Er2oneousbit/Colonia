/**
 * models/farmstead.js
 * ----------------------------------------------------------------------------
 * The farmhouse every farm of Colonia's 3D look shares (farm.js adds what
 * each kind of farm needs: farmKinds.js), built from what Cato, Varro and
 * Columella say a working farm's core is and from the small farmsteads
 * excavated in Italy (the villae rusticae round Pompeii and Stabiae, the
 * Villa Regina at Boscoreale among them): a plain house of rough stone,
 * not a villa.
 *
 *   - One long house of rubble walls on a footing of bigger stones, dressed
 *     limestone at the corners, the lime wash worn off in patches; a roof
 *     of tegulae and imbrices at a low pitch, a smoke vent on the ridge
 *     over the hearth (the kitchen, culina, is the house's heart: Columella
 *     wants it big and high so the household gathers there).
 *   - Its door to the fields, small windows with board shutters, and in the
 *     gable end over the yard a loft door with a ladder: the loft is the
 *     farm's granary (granarium), dry and airy over the house as the
 *     writers advise, its grain hoisted up from the yard.
 *   - A shrine to the household gods (lararium) by the door: a small
 *     plastered altar under a niche with a little gabled roof, where the
 *     farm's family hung a garland on feast days (Cato asks the bailiff's
 *     wife to).
 *   - A stack of firewood against the gable, two amphorae by the corner.
 *
 * Where it stands: the 3D ground keeps a strip of trodden yard along one
 * edge of every farm (ground/groundSites.js: the art's u 0 to 1, that is
 * x -6 to -2 here), and the house fills its back half (z -5.75 to -1.2);
 * the yard in front of it (z -0.5 to 5.9) is the farm kind's own.
 *
 * Idle (no workers: `idle`): door and shutters shut, no smoke vent's soot,
 * weeds come up round the walls.
 *
 * Metres, the farm's middle (a 3 x 3 footprint, 12 m) at the origin, y up.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { Parts, houseShell, woodpile, jar, ladder, weeds, blk, D } from './rural.js';

/** The farmhouse's place and measures (metres): farm.js and the tests read them. */
export const FARMHOUSE = Object.freeze({
  x0: -5.6, x1: -2.5, z0: -5.6, z1: -1.2, eaveY: 2.55, pitch: D(24),
  /** The yard in front of the house, which each kind of farm fills. */
  yard: Object.freeze({ x0: -5.9, x1: -2.1, z0: -0.5, z1: 5.9 }),
});

/** A lararium: a plastered altar with a niche over it under a little tiled gable, against a wall facing +x. */
function lararium(x, z, lod) {
  const stone = [];
  const tile = [];
  const dark = [];
  const base = blk(lod, 0.3, 0.95, 0.6, { bevel: 0.02, seed: 61, wobble: 0.004, grime: 0.4, seg: 1 });
  base.translate(x + 0.15, 0, z);
  stone.push(base);
  const top = blk(lod, 0.38, 0.06, 0.7, { bevel: 0.015, seed: 62, wobble: 0.003, grime: 0, seg: 1 });
  top.translate(x + 0.17, 0.95, z);
  stone.push(top);
  // The niche: a little box open to +x, its back dark.
  const back = blk(lod, 0.08, 0.5, 0.5, { bevel: 0.01, seed: 63, wobble: 0.002, grime: 0, seg: 1 });
  back.translate(x + 0.04, 1.01, z);
  stone.push(back);
  for (const s of [-1, 1]) {
    const side = blk(lod, 0.26, 0.5, 0.06, { bevel: 0.01, seed: 64 + s, wobble: 0.002, grime: 0, seg: 1 });
    side.translate(x + 0.13, 1.01, z + s * 0.22);
    stone.push(side);
  }
  const inner = new BoxGeometry(0.02, 0.44, 0.38);
  inner.translate(x + 0.09, 1.24, z);
  boxUV(inner);
  dark.push(tintGeometry(inner));
  // Its little roof: two tiles in a gable over the niche.
  for (const s of [-1, 1]) {
    const t = blk(lod, 0.36, 0.03, 0.34, { bevel: 0.008, seed: 66 + s, wobble: 0.002, grime: 0, seg: 1 });
    t.translate(0, 0, s * 0.17);
    t.rotateX(s * D(28));
    t.translate(x + 0.15, 1.53, z);
    tile.push(t);
  }
  return { stone, tile, dark };
}

/** The farmhouse as a Group (Parts.build): `idle` a farm with no workers. */
export function buildFarmstead({ lod = 0, idle = false, seed = 3 } = {}) {
  const F = FARMHOUSE;
  const parts = new Parts();
  const mid = (F.z0 + F.z1) / 2;
  const midX = (F.x0 + F.x1) / 2;
  const shut = idle;
  const shell = houseShell({
    x0: F.x0, x1: F.x1, z0: F.z0, z1: F.z1, eaveY: F.eaveY, pitch: F.pitch, along: 'z', lod, seed,
    doors: [{ side: '+x', at: -2.35 - mid, w: 0.95, h: 1.85, shut }],
    windows: [
      { side: '+x', at: -4.65 - mid, w: 0.45, h: 0.5, y: 1.45, shut },
      { side: '+z', at: -4.55 - midX, w: 0.5, h: 0.5, y: 1.3, shut },
      // The loft's door, high in the gable end over the yard.
      { side: '+z', at: -3.3 - midX, w: 0.62, h: 0.62, y: 1.7, shut },
      { side: '-x', at: -3.6 - mid, w: 0.4, h: 0.4, y: 1.6, shut },
    ],
  });
  parts.addAll(shell);
  // The smoke vent on the ridge over the hearth: a terracotta pot, sooted.
  if (lod < 2) {
    const vent = revolve(profileOf([[0, 0], [0.13, 0], [0.12, 0.18], [0.09, 0.3], [0.1, 0.33], [0.07, 0.33], [0.06, 0.2], [0, 0.2]]), { segments: lod ? 8 : 14, metres: 0.6, tint: (p) => (p.y > 0.2 ? (idle ? 0.8 : 0.45) : 0.85) });
    vent.translate(midX, shell.ridgeY + 0.06, F.z0 + 1.4);
    parts.add('clay', vent);
  }
  // The ladder up to the loft door.
  if (lod < 2 && !idle) {
    // (Its foot in the yard, its top against the wall under the door.)
    const l = ladder(2.25, 0.3, 71, lod);
    l.translate(-3.3, 0, F.z1 + 0.68);
    parts.add('wood', l);
  }
  // The lararium by the door.
  const lar = lararium(F.x1, -3.55, lod);
  parts.add('stone', lar.stone).add('clay', lar.tile).add('dark', lar.dark);
  // Firewood against the gable's corner, two amphorae at the other.
  const wp = woodpile(0.8, 0.7, 72, lod);
  for (const g of wp) g.translate(-5.25, 0, F.z1 + 0.35);
  parts.add('bark', wp);
  for (const [k, x, z, lean] of [[0, -2.72, F.z1 + 0.24, -0.06], [1, -3.0, F.z1 + 0.22, -0.05]]) {
    const a = jar({ amphora: true, lod, seed: 80 + k });
    a.translate(0, 0.08, 0);
    a.rotateX(lean);
    a.rotateZ(lean * 0.6);
    a.translate(x, 0, z);
    parts.add('clay', a);
  }
  if (idle) {
    parts.add('leaf', weeds(lod === 2 ? 6 : 16, F.x0 - 0.1, F.x1 + 0.35, F.z0 + 0.2, F.z1 + 0.9, 91, lod));
  }
  return parts.build(idle ? 'farmstead-idle' : 'farmstead');
}

