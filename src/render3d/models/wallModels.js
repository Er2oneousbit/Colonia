/**
 * models/wallModels.js
 * ----------------------------------------------------------------------------
 * The town walls, their gates and towers, and the watchtower as the game
 * draws them (render3d/models.js MODELS takes these entries as they are).
 *
 *   wall    not a building: each wall or gate tile of the map, handed to
 *           the model pass by the renderer as a stand-in building of type
 *           'wall' (walls/wallGame.js wallModelPlace) that carries its
 *           piece's kit key (walls/wallLayout.js wallPiece), its gate's
 *           state ('open', or 'shut' with an enemy near) and the stubs of
 *           wall into a watchtower beside it (`more`). The pieces are
 *           models/townWall.js's, instanced like any model: a draw call a
 *           part of each piece in view, whatever the length of the wall.
 *   tower   the watchtower (Turris, models/turris.js) in the province's
 *           stone: 'open' manned (staffed: its archers on the gallery, the
 *           door open), else 'shut'; its torches burn at night while it is
 *           manned (models.js modelLamps). Its crew are actors (turris.js
 *           turrisActors), cast once a state.
 * ----------------------------------------------------------------------------
 */

import { buildWallPiece } from './townWall.js';
import { buildTurris, TURRIS, turrisActors } from './turris.js';
import { lookOfGame } from '../walls/wallGame.js';
import { cast } from '../people/actors.js';

/** The watchtower's crew by state (turris.js turrisActors), packed once. */
const TURRIS_CASTS = Object.freeze({ open: cast(turrisActors('open')), shut: cast(turrisActors('shut')) });

/** The watchtower's torches (models.js modelLamps): front and back, [x, y, z, facing along z]. */
const TURRIS_LAMPS = Object.freeze([
  Object.freeze([TURRIS.torch[0], TURRIS.torch[1] + 0.3, TURRIS.torch[2] + 0.1, 1]),
  Object.freeze([TURRIS.torch[0], TURRIS.torch[1] + 0.3, -TURRIS.torch[2] - 0.1, -1]),
]);

export const WALL_MODELS = Object.freeze({
  wall: Object.freeze({
    // Every look's stone painted and its programs made before the first draw: a gate cracked (its
    // doors, iron, torches, a crack and rubble), a corner tower (its roof), the other stones' walls.
    warm: ['wall:polygonal:gate:1', 'wall:polygonal:corner+square:0', 'wall:tufa:straight:0', 'wall:ashlar:straight:0', 'wall:brick:straight:0'],
    variant: (b) => ({ key: b.key, state: b.state || 'always', ice: false, more: b.more }),
    build: (key, lod) => buildWallPiece(key, lod).group,
  }),
  tower: Object.freeze({
    warm: ['tower:polygonal'],
    variant(b, place, ctx) {
      const state = b.efficiency > 0 ? 'open' : 'shut';
      return { key: `tower:${ctx && ctx.game ? lookOfGame(ctx.game) : 'polygonal'}`, state, ice: false, actors: TURRIS_CASTS[state] };
    },
    lamps: (b) => (b.efficiency > 0 ? TURRIS_LAMPS : []),
    build: (key, lod) => buildTurris({ look: key.split(':')[1] || 'polygonal', lod }).group,
  }),
});
