/**
 * units/pieces.js
 * ----------------------------------------------------------------------------
 * Every piece a unit's figures are made of, by key, built at a level of
 * detail into a geometry the units' material draws:
 *
 *   uprop:<name>:<L|R>      an arm on a hand's prop bone (units/props.js)
 *   ugear:<name>[:opt...]   a helmet, a cuirass, trousers, hair (units/gear.js)
 *   quad:<species>[:opt]    a beast on its own skeleton (units/quadMesh.js)
 *   anything else           the walkers' and the people's pieces (a body, a
 *                           tunic, a gladius, a chariot's car: walkers/pass.js)
 * ----------------------------------------------------------------------------
 */

import { buildWalkerPiece } from '../walkers/pass.js';
import { unitProp } from './props.js';
import { unitGear } from './gear.js';
import { quadMesher, isQuadKey } from './quadMesh.js';

/** The geometry of a unit's piece by its key at `lod` (0 the closest). */
export function buildUnitPiece(key, lod) {
  const l = Math.max(0, Math.min(2, lod | 0));
  if (key.startsWith('uprop:')) {
    const [, name, side] = key.split(':');
    return unitProp(name, side || 'R', l).build();
  }
  if (key.startsWith('ugear:')) {
    const [, name, ...opts] = key.split(':');
    return unitGear(name, 'm', l, new Set(opts)).build();
  }
  if (isQuadKey(key)) return quadMesher(key, l).build();
  return buildWalkerPiece(key, l);
}
