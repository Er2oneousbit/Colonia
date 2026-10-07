/**
 * models/waterModels.js
 * ----------------------------------------------------------------------------
 * The aqueducts and the reservoir as the game draws them (render3d/
 * models.js MODELS takes these entries as they are).
 *
 *   aqueduct   not a building: each aqueduct tile of the map, handed to the
 *              model pass by the renderer as a stand-in building of type
 *              'aqueduct' (aqueducts/aqueductGame.js aqueductModelPlace)
 *              that carries its piece's kit key (aqueducts/aqueductLayout.js
 *              aqueductPiece) and its water's state ('flowing' or 'dry'),
 *              and in a hard frost its ice. The pieces are models/
 *              aqueduct.js's, instanced like any model: a draw call a part
 *              of each piece in view, whatever the aqueduct's length.
 *   reservoir  the castellum (models/castellum.js) in the province's
 *              stone: 'flowing' while it has water (the sim's hasWater:
 *              beside open water, or fed by a full aqueduct), else 'dry';
 *              its inlets and intakes as `more` kits (aqueductGame.js
 *              reservoirMore), each running or dry with what feeds it.
 * ----------------------------------------------------------------------------
 */

import { buildAqueductPiece } from './aqueduct.js';
import { buildCastellum, buildInlet, buildIntake } from './castellum.js';
import { reservoirMore, aqueductLookOfGame } from '../aqueducts/aqueductGame.js';

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3). */
const frost = (place) => ((place && place.snow) || 0) >= 2;

export const WATER_MODELS = Object.freeze({
  aqueduct: Object.freeze({
    // Every look's stone and the channel's water painted, their programs made before the first draw:
    // a road's arch, a stair into a reservoir (its falls), a junction, each look.
    warm: ['aqueduct:lime:a-a-:road', 'aqueduct:lime:ra--', 'aqueduct:tufa:a-a-', 'aqueduct:brick:aaa-'],
    variant: (b, place) => ({ key: b.key, state: b.state || 'dry', ice: b.ice ?? frost(place) }),
    build: (key, lod) => buildAqueductPiece(key, lod).group,
  }),
  reservoir: Object.freeze({
    // Its looks, its frost (the dry puddle's ice), an inlet with its pour and rings, an intake.
    warm: ['reservoir:lime', 'reservoir:lime:ice', 'reservoir:lime:inlet', 'reservoir:lime:intake', 'reservoir:tufa', 'reservoir:brick'],
    variant(b, place, ctx) {
      const look = aqueductLookOfGame(ctx && ctx.game);
      const ice = frost(place);
      const more = ctx && ctx.game && b.id !== null && b.id !== undefined ? reservoirMore(ctx.game, b, look) : undefined;
      return { key: `reservoir:${look}${ice ? ':ice' : ''}`, state: b.hasWater ? 'flowing' : 'dry', ice, more };
    },
    build(key, lod) {
      const [, look, what] = key.split(':');
      if (what === 'inlet' || what === 'house') return buildInlet({ look, lod, house: what === 'house' }).group;
      if (what === 'intake') return buildIntake({ look, lod }).group;
      return buildCastellum({ look, lod, ice: what === 'ice' }).group;
    },
  }),
});
