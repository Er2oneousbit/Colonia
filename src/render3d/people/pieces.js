/**
 * people/pieces.js
 * ----------------------------------------------------------------------------
 * Every piece a person is put together from, by key, built at a level of
 * detail into a skinned geometry (mesher.js): a body, a garment, a head of
 * hair or a beard, a prop in one hand. Each piece is instanced on its own
 * across the city (batch.js: one draw a piece and level), so a person is a
 * few draws' instances, and a new combination of dress costs nothing.
 *
 *   body:<m|f|c>
 *   tunic:<kind>:<short|knee|long>[:broad][:stola]
 *   toga:<kind>[:velato]     pallium:<kind>     palla:<kind>[:veil]
 *   paenula:<kind>           lorica:<kind>      limus:<kind>
 *   caligae:<kind>  helmet:<kind>  bulla:<kind>  wreath:<kind>
 *   hair:<crop|curls|bun|bald>:<kind>      beard:<full|short>:<kind>
 *   prop:<name>:<L|R>
 * ----------------------------------------------------------------------------
 */

import { buildBody } from './body.js';
import { tunic, toga, palla, paenula, lorica, limus, caligae, helmet, bulla, wreath } from './garments.js';
import { hair, beard } from './hair.js';
import { prop } from './props.js';

/** The Mesher of a piece by its key at level `lod`. */
export function pieceMesher(key, lod) {
  const [what, a, b, ...rest] = key.split(':');
  const opts = new Set([b, ...rest].filter(Boolean));
  switch (what) {
    case 'body': return buildBody(a, lod);
    case 'tunic': return tunic(a, lod, {
      len: b || 'knee', clavi: opts.has('broad') ? 'broad' : 'narrow', instita: opts.has('stola'),
      belt: a === 'f' || opts.has('stola') ? 1.2 : null, sleeves: opts.has('stola') ? 0.95 : 0.5,
    });
    case 'toga': return toga(a, lod, { velato: opts.has('velato') });
    case 'pallium': return toga(a, lod, { pallium: true });
    case 'palla': return palla(a, lod, { veil: opts.has('veil') });
    case 'paenula': return paenula(a, lod);
    case 'lorica': return lorica(a, lod);
    case 'limus': return limus(a, lod);
    case 'caligae': return caligae(a, lod);
    case 'helmet': return helmet(a, lod);
    case 'bulla': return bulla(a, lod);
    case 'wreath': return wreath(a, lod);
    case 'hair': return hair(a, b || 'm', lod);
    case 'beard': return beard(a, b || 'm', lod);
    case 'prop': return prop(a, b || 'R', lod);
    default: throw new Error(`No people piece ${key}`);
  }
}

/** The geometry of a piece at a level (built fresh: batch.js keeps what it builds). */
export function buildPiece(key, lod) {
  return pieceMesher(key, Math.max(0, Math.min(2, lod | 0))).build();
}
