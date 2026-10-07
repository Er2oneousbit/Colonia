/**
 * aqueducts/aqueductLayout.js
 * ----------------------------------------------------------------------------
 * Which piece of the 3D aqueduct (models/aqueduct.js) stands on an aqueduct
 * tile, and where a reservoir (models/castellum.js) takes its water in:
 * pure, read from the map only (tested in node). The sim's aqueduct layer
 * (world/map.js) holds 0 none, 1 dry, 2 carrying water; the WebGL back end
 * draws each tile as one of a few pieces, instanced, turned to fit.
 *
 *   arms     what leaves the tile on each side, by its neighbours (other
 *            aqueducts and reservoirs, as render/renderer.js
 *            aqueductMaskAt): 'a' an arm of arcade to the next tile, 'r'
 *            the channel stepping down into a reservoir, '-' nothing.
 *            Written E, S, W, N along the piece's canonical turn: the
 *            piece is built once that way and turned a quarter at a time
 *            (CANON and shapeOf from walls/wallLayout.js: the same six
 *            shapes, lone, end, straight, corner, tee, cross)
 *   road     the tile is also a road: the arcade carries the channel over
 *            it on one wide arch, its line across the road (the sim lets
 *            a road pass under an aqueduct only straight through, at
 *            right angles: sim/construction.js crossingOk)
 *   state    'flowing' while the channel carries water, else 'dry'
 *
 * Masks: 1 N (y - 1), 2 E (x + 1), 4 S (y + 1), 8 W (x - 1) on the map,
 * turned into the view by render/view.js rotMask; a model's turn T takes
 * its +x (E) to +z (S) at T = 1, so rotMask(m, T) is the mask a piece built
 * along m shows turned T.
 *
 * The stone follows the province, as the town walls' does (walls/
 * wallLayout.js wallLookOf), in the three ways Rome built its arcades:
 * squared tufa and peperino (the Aqua Marcia and the Aqua Claudia over
 * the Campagna), squared limestone (the Pont du Gard, Segovia's granite in
 * the same coursing) and brick-faced concrete (the Aqua Alexandrina, and
 * the brick country of the Po).
 * ----------------------------------------------------------------------------
 */

import { rotMask, viewDir } from '../../render/view.js';
import { CANON, shapeOf } from '../walls/wallLayout.js';

export { CANON };

/** Map steps by mask bit, and the bits in the order arms are written (E, S, W, N). */
const STEP = Object.freeze({ 1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0] });
const BITS = [1, 2, 4, 8];
export const ARM_BITS = Object.freeze([2, 4, 8, 1]);

/** The province's wall stone (walls/wallLayout.js wallLookOf) as an aqueduct's look. */
const LOOK_OF_WALL = Object.freeze({ polygonal: 'lime', ashlar: 'lime', tufa: 'tufa', brick: 'brick' });
export const AQUEDUCT_LOOKS = Object.freeze(['tufa', 'lime', 'brick']);
export function aqueductLookOf(wallLook) {
  return LOOK_OF_WALL[wallLook] || 'lime';
}

/** Is map tile (x, y) a reservoir's (a building of kind 'reservoir')? */
export function isReservoir(map, buildings, x, y) {
  if (!map.inBounds(x, y)) return false;
  const id = map.building[map.idx(x, y)];
  const b = id ? buildings.get(id) : null;
  return !!b && !!b.def && b.def.kind === 'reservoir';
}

/**
 * An aqueduct tile's neighbour mask on the map: the low four bits its
 * connections (aqueducts and reservoirs), the next four those of them that
 * are a reservoir (render/renderer.js aqueductMaskAt reads the same).
 * `extra(x, y)`: more tiles that count as aqueducts (a dragged plan).
 */
export function aqueductMask(map, buildings, x, y, extra = null) {
  let m = 0;
  for (const b of BITS) {
    const [dx, dy] = STEP[b];
    const tx = x + dx;
    const ty = y + dy;
    if (!map.inBounds(tx, ty)) continue;
    if (map.aqueduct[map.idx(tx, ty)] || (extra && extra(tx, ty))) m |= b;
    else if (isReservoir(map, buildings, tx, ty)) m |= b | (b << 4);
  }
  return m;
}

/**
 * The way the aqueduct over road tile (x, y) runs: 'x' or 'y'. Along its
 * neighbours, or (a lone tile over a road) across the road.
 */
export function crossingAxis(map, conn, x, y) {
  if (conn & 10 && !(conn & 5)) return 'x';
  if (conn & 5 && !(conn & 10)) return 'y';
  return map.hasRoad(x, y - 1) || map.hasRoad(x, y + 1) ? 'x' : 'y';
}

/**
 * The piece on aqueduct tile (x, y) of the map seen at view turn `vt`:
 *   { key, T, shape, arms, road, state }
 * `key` names the kit (models.js MODELS.aqueduct builds it), T its turn in
 * the view. `extra(x, y)`: more tiles that count as aqueducts (a dragged
 * plan, for its ghost); `planned`: the tile is not built yet (its state is
 * then dry).
 */
export function aqueductPiece(map, buildings, x, y, vt, look, extra = null, planned = false) {
  const i = map.idx(x, y);
  const m = aqueductMask(map, buildings, x, y, extra);
  const conn = m & 15;
  const res = (m >> 4) & 15;
  // (A road beside a reservoir never runs under an aqueduct: sim/construction.js besideReservoir. One
  // that turns or branches over a road, from a save before crossingOk, keeps its junction piece: an arch
  // along one axis would leave the other arm's channel in the air.)
  const road = map.road[i] !== 0 && !res && !((conn & 10) && (conn & 5));
  let shape;
  let T;
  if (road) {
    // The road's arch: the straight piece (built along model x), its line across the road.
    shape = 'straight';
    const alongU = (crossingAxis(map, conn, x, y) === 'x') === ((vt & 1) === 0);
    T = alongU ? 0 : 1;
  } else {
    ({ shape, T } = shapeOf(rotMask(conn, vt)));
  }
  // Canonical: the view's mask turned back by the piece's own turn.
  const back = (4 - T) & 3;
  const cConn = rotMask(rotMask(conn, vt), back);
  const cRes = rotMask(rotMask(res, vt), back);
  const arms = ARM_BITS.map((b) => (cRes & b ? 'r' : cConn & b ? 'a' : '-')).join('');
  const state = !planned && map.aqueduct[i] === 2 ? 'flowing' : 'dry';
  return { key: `aqueduct:${look}:${arms}${road ? ':road' : ''}`, T, shape, arms, road, state };
}

/** Parse an aqueduct kit's key: { look, arms, road } (arms E, S, W, N). */
export function parseAqueductKey(key) {
  const [, look, arms, road] = key.split(':');
  return { look, arms, road: road === 'road' };
}

/**
 * Where a reservoir joins what feeds it, in its model's own frame
 * (models/castellum.js, built facing +z, its middle at the origin): for
 * each tile beside its footprint that is an aqueduct, { side, k, kind:
 * 'aqueduct', state }, and for its sides on natural water one { side, k,
 * kind: 'water' } (an intake). `side` 0..3 is the model's +x, +z, -x, -z
 * face, `k` -1, 0 or 1 the tile along it (model metres k * 4 across the
 * face: +z on the +x face, as models/castellum.js inletMatrix turns them).
 * The model turns with the building's own turn only (its view turn is
 * the view's, render/turn.js artTurn), so its joins do not move with the
 * view. `isWater(x, y)` says whether a map tile is open water.
 */
export function reservoirJoins(map, b, isWater) {
  const S = b.size || 3;
  const half = (S - 1) / 2;
  const out = [];
  const water = new Map();
  const back = (4 - (b.turn || 0)) & 3;
  for (let s = 0; s < 4; s++) {
    for (let d = 0; d < S; d++) {
      // Map side s: N, E, S, W rows of the ring round the footprint.
      const [tx, ty] = [[b.x + d, b.y - 1], [b.x + S, b.y + d], [b.x + d, b.y + S], [b.x - 1, b.y + d]][s];
      if (!map.inBounds(tx, ty)) continue;
      // The tile's middle from the footprint's, in tiles, turned into the model's frame.
      const [lx, lz] = viewDir(tx - b.x - half, ty - b.y - half, back);
      const { side, k } = sideOf(lx, lz, S);
      const a = map.aqueduct[map.idx(tx, ty)];
      if (a) out.push({ side, k, kind: 'aqueduct', state: a === 2 ? 'flowing' : 'dry' });
      else if (isWater(tx, ty)) {
        // One intake a side: the water tile nearest the face's middle.
        const was = water.get(side);
        if (!was || Math.abs(k) < Math.abs(was.k)) water.set(side, { side, k, kind: 'water' });
      }
    }
  }
  return out.concat([...water.values()]);
}

/**
 * The face and place along it of a tile beside a footprint of S tiles, from
 * its middle's offset (lx, lz) in tiles in the model's frame: the +x face
 * (side 0) has the tiles at k = lz; +z (1) k = -lx; -x (2) k = -lz; -z (3)
 * k = lx: each face's k runs the way a quarter turn of the +x face's does.
 */
export function sideOf(lx, lz, S = 3) {
  const edge = (S + 1) / 2;
  // (+ 0: never a -0, which strict equality's object compare tells from 0.)
  if (Math.abs(lx - edge) < 1e-6) return { side: 0, k: Math.round(lz) + 0 };
  if (Math.abs(lz - edge) < 1e-6) return { side: 1, k: Math.round(-lx) + 0 };
  if (Math.abs(lx + edge) < 1e-6) return { side: 2, k: Math.round(-lz) + 0 };
  return { side: 3, k: Math.round(lx) + 0 };
}
