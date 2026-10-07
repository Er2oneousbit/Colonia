/**
 * walls/wallLayout.js
 * ----------------------------------------------------------------------------
 * Which piece of the 3D town wall (models/townWall.js) stands on a wall
 * tile: pure, read from the map only (tested in node). The sim's wall layer
 * (world/map.js Wall) has two kinds, a wall and a gate across a road; the
 * WebGL back end draws each tile as one of a few pieces, instanced, turned
 * to fit:
 *
 *   shape    by the tile's neighbour mask (other walls, gates and
 *            watchtowers, as the 2D renderer's wallMask): lone, end,
 *            straight, corner, tee, cross; each built once along its
 *            canonical mask (CANON) and turned a quarter turn at a time
 *   tower    'round' beside a gate on the gate's own line (the flanking
 *            towers of a Roman town gate, as Turin's Porta Palatina);
 *            'square' at a corner whose runs go on two tiles each way, at a
 *            junction (tee, cross), and every INTERVAL tiles along a
 *            straight run, never within two tiles of another tower or a
 *            gate (towers on Roman walls stood 30 to 50 m apart)
 *   gate     the gatehouse, its passage along the road (`gateAxis`)
 *   damage   0 sound; 1 cracked (under half its hit points, where the 2D
 *            art draws it battered); 2 breaching (under a quarter)
 *   stubs    a short length of wall from the tile's edge into a Turris
 *            beside it (the watchtower stands back from its footprint's
 *            edge; the 2D art's wall ran into its sprite)
 *
 * Masks: 1 N (y - 1), 2 E (x + 1), 4 S (y + 1), 8 W (x - 1) on the map, as
 * render/renderer.js wallMask; turned into the view by render/view.js
 * rotMask (N becomes E at turn 1). A model's turn T (models.js modelMatrix)
 * takes its +x (E) to +z (S) at T = 1: rotMask(m, T) is the mask a piece
 * built along m shows turned T.
 *
 * The stone follows the province (wallLookOf): what its builders had to
 * hand and how Rome built there.
 * ----------------------------------------------------------------------------
 */

import { Wall } from '../../world/map.js';
import { rotMask } from '../../render/view.js';
import { SITES, siteIdOf } from '../../data/sites.js';

/** The canonical masks the pieces are built along (E = 2 is model +x, S = 4 model +z). */
export const CANON = Object.freeze({ lone: 0, end: 2, straight: 10, corner: 6, tee: 14, cross: 15 });
/** A square tower on a straight run every this many tiles (a tower every 32 m). */
export const INTERVAL = 8;
/** Map steps by mask bit. */
const STEP = Object.freeze({ 1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0] });
const BITS = [1, 2, 4, 8];

/** The shape and the turn of a mask: rotMask(CANON[shape], T) === mask. */
export function shapeOf(mask) {
  for (const [shape, c] of Object.entries(CANON)) {
    for (let T = 0; T < 4; T++) if (rotMask(c, T) === (mask & 15)) return { shape, T };
  }
  // (Every 4-bit mask is one of the six turned: unreachable.)
  throw new Error(`No wall shape for mask ${mask}`);
}

/** Is map tile (x, y) a watchtower's (a Turris building)? */
export function isTurris(map, buildings, x, y) {
  if (!map.inBounds(x, y)) return false;
  const id = map.building[map.idx(x, y)];
  const b = id ? buildings.get(id) : null;
  return !!b && b.def && b.def.kind === 'tower';
}

/** Does map tile (x, y) join a wall: a wall, a gate or a watchtower (render/renderer.js wallMask)? */
export function joins(map, buildings, x, y) {
  if (!map.inBounds(x, y)) return false;
  return map.wall[map.idx(x, y)] !== Wall.NONE || isTurris(map, buildings, x, y);
}

/** A wall tile's neighbour mask on the map. `extra(x, y)`: more tiles that count (a dragged wall's plan). */
export function wallMask(map, buildings, x, y, extra = null) {
  let m = 0;
  for (const b of BITS) {
    const [dx, dy] = STEP[b];
    if (joins(map, buildings, x + dx, y + dy) || (extra && extra(x + dx, y + dy))) m |= b;
  }
  return m;
}

/**
 * The way a gate's wall runs on the map: 'x' (along x, its road along y)
 * or 'y'. By its road first (a gate is a wall across a road), then by the
 * walls beside it; the 2D art's choice for a gate standing alone.
 */
export function gateAxis(map, buildings, x, y) {
  const ns = map.hasRoad(x, y - 1) || map.hasRoad(x, y + 1);
  const ew = map.hasRoad(x - 1, y) || map.hasRoad(x + 1, y);
  if (ns && !ew) return 'x';
  if (ew && !ns) return 'y';
  const m = wallMask(map, buildings, x, y);
  if (m & 10 && !(m & 5)) return 'x';
  if (m & 5 && !(m & 10)) return 'y';
  return ns ? 'x' : 'y';
}

const isGate = (map, x, y) => map.inBounds(x, y) && map.wall[map.idx(x, y)] === Wall.GATE;

/** Is wall tile (x, y) beside a gate on that gate's own line (a flanking tower's place)? */
export function flanksGate(map, buildings, x, y) {
  for (const b of BITS) {
    const [dx, dy] = STEP[b];
    if (!isGate(map, x + dx, y + dy)) continue;
    if (gateAxis(map, buildings, x + dx, y + dy) === (dx ? 'x' : 'y')) return true;
  }
  return false;
}

/** Do `n` tiles in a row from (x, y) toward bit `b` all join a wall? */
function runs(map, buildings, x, y, b, n) {
  const [dx, dy] = STEP[b];
  for (let k = 1; k <= n; k++) if (!joins(map, buildings, x + dx * k, y + dy * k)) return false;
  return true;
}

/** Is there a gate, a watchtower or a corner within `n` tiles of (x, y) along its straight run (axis 'x' or 'y')? */
function nearStrongPoint(map, buildings, x, y, axis, n) {
  for (let k = -n; k <= n; k++) {
    if (!k) continue;
    const tx = axis === 'x' ? x + k : x;
    const ty = axis === 'y' ? y + k : y;
    if (!map.inBounds(tx, ty)) continue;
    if (isGate(map, tx, ty) || isTurris(map, buildings, tx, ty)) return true;
    if (map.wall[map.idx(tx, ty)] === Wall.WALL) {
      const m = wallMask(map, buildings, tx, ty);
      if (m !== 10 && m !== 5) return true;
    }
  }
  return false;
}

/**
 * The tower a wall tile (not a gate) carries, from its map mask: 'round',
 * 'square' or null (see the header).
 */
export function towerOf(map, buildings, x, y, mask) {
  if (flanksGate(map, buildings, x, y)) return 'round';
  const bits = BITS.filter((b) => mask & b);
  if (bits.length >= 3) return 'square';
  if (bits.length === 2 && mask !== 10 && mask !== 5) {
    // A corner whose runs go on: a diagonal dragged as a staircase of corners gets none.
    return bits.every((b) => runs(map, buildings, x, y, b, 2)) ? 'square' : null;
  }
  if (mask === 10 || mask === 5) {
    const axis = mask === 10 ? 'x' : 'y';
    const c = axis === 'x' ? x : y;
    if (((c % INTERVAL) + INTERVAL) % INTERVAL !== INTERVAL / 2) return null;
    return nearStrongPoint(map, buildings, x, y, axis, 2) ? null : 'square';
  }
  return null;
}

/** A wall's or gate's damage (0 sound, 1 cracked under half its hit points, 2 breaching under a quarter). */
export function damageLevel(hp, max) {
  if (!max || hp >= max * 0.5) return 0;
  return hp >= max * 0.25 ? 1 : 2;
}

/**
 * The stone a province's walls are built of: what the land gave and how
 * Rome built there.
 *   polygonal   Etruria, Latium, Picenum, Samnium, Liguria, Apulia,
 *               Bruttium: the limestone hills, walled in polygonal blocks
 *               (Cosa, Alatri, Norba, Circeii)
 *   tufa        the volcanic country (Puteoli, Volsinii, Campania): squared
 *               tufa as the Servian Wall and Pompeii's first walls
 *   ashlar      Lucania (Paestum's walls) and the provinces (Hispania,
 *               Narbonensis, the desert frontier): squared limestone
 *   brick       the Po plain (Gallia Cisalpina), which has no building
 *               stone: brick on a stone footing, as Turin's walls and its
 *               Porta Palatina
 */
export function wallLookOf(game) {
  const site = siteIdOf(game && game.scenario);
  const region = SITES[site] ? SITES[site].region : '';
  const type = (game && game.scenario && game.scenario.map && game.scenario.map.type) || (game && game.mapInfo && game.mapInfo.type) || '';
  if (type === 'desert') return 'ashlar';
  if (site === 'puteoli' || site === 'volsinii' || region === 'Campania') return 'tufa';
  if (region === 'Gallia Cisalpina') return 'brick';
  if (region === 'Lucania' || region === 'Hispania' || region === 'Gallia Narbonensis') return 'ashlar';
  return 'polygonal';
}

/** The looks there are (each a set of pieces: models/townWall.js WALL_LOOKS). */
export const WALL_LOOK_NAMES = Object.freeze(['polygonal', 'tufa', 'ashlar', 'brick']);

/**
 * The piece on wall tile (x, y) of the map seen at view turn `vt`:
 *   { key, T, gate, shape, tower, damage, stubs }
 * `key` names the kit (models.js MODELS.wall builds it), T its turn in the
 * view, `stubs` the view directions (mask bits) of watchtowers it runs
 * into. `hp` { hp, max } its hit points (sim/damage.js wallHpOf);
 * `extra(x, y)` more tiles that count as walls (a dragged wall's plan, for
 * its ghost) and `gate` whether the tile is a gate when it is not yet one.
 */
export function wallPiece(map, buildings, x, y, vt, look, hp = null, extra = null, gate = null) {
  const isG = gate ?? (map.wall[map.idx(x, y)] === Wall.GATE);
  const damage = hp ? damageLevel(hp.hp, hp.max) : 0;
  const mask = wallMask(map, buildings, x, y, extra);
  const stubs = [];
  for (const b of BITS) {
    const [dx, dy] = STEP[b];
    if ((mask & b) && isTurris(map, buildings, x + dx, y + dy)) stubs.push(rotMask(b, vt));
  }
  if (isG) {
    const axis = gateAxis(map, buildings, x, y);
    // The canonical gate's wall runs along model x: turn it a quarter where its wall runs along the view's v.
    const along = (axis === 'x') !== ((vt & 1) === 1) ? 0 : 1;
    return { key: `wall:${look}:gate:${damage}`, T: along, gate: true, shape: 'gate', tower: null, damage, stubs: [] };
  }
  const { shape, T } = shapeOf(rotMask(mask, vt));
  const tower = towerOf(map, buildings, x, y, mask);
  return { key: `wall:${look}:${shape}${tower ? `+${tower}` : ''}:${damage}`, T, gate: false, shape, tower, damage, stubs };
}

/** The kit of a stub of wall into a watchtower (built along model +x, past the tile's edge). */
export function stubKey(look) {
  return `wall:${look}:stub:0`;
}

/** Parse a wall kit's key: { look, shape, tower, damage }. */
export function parseWallKey(key) {
  const [, look, piece, damage] = key.split(':');
  const [shape, tower = null] = piece.split('+');
  return { look, shape, tower, damage: Number(damage) || 0 };
}
