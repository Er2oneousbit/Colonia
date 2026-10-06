/**
 * bridgeProfile.js
 * ----------------------------------------------------------------------------
 * How high a bridge's deck stands at each point along it, worked out from
 * the map alone (rendering only, the sim never sees it). The bridge art and
 * the people crossing share these numbers: the renderer draws each bridge
 * tile with the deck heights at its two ends and its middle (bridgeSpec,
 * lowBridgeSpec), and lifts a walker by the same heights read between those
 * three points (renderer.js bridgeSpan), so feet are always on the deck.
 *
 * The ship bridge (Pons) stands BRIDGE_DECK_Z over the water, high enough
 * for a ship's mast to pass under it. At a bank it climbs from the road on
 * a ramp RAMP_TILES long and always as steep, starting in the middle of the
 * road tile on the bank (the "foot", drawn on that road tile by
 * bridgeFootSpec) when that tile is a plain road, else at the water's edge.
 * The ramp starts in the middle of the bank tile so that a road joining it
 * from the side (a bridge ending at a junction) meets it at road level.
 *
 * The low bridge (Pons Sublicius) stands LOW_BRIDGE_DECK_Z over the water
 * and rises to it over the first and last LOW_RAMP_TILES of water, so the
 * people on it no longer hop up at the bank. No boat passes under it, so
 * its ramps on the water cost nothing.
 *
 * Where a run of bridge tiles ends at more water (a road that turned on the
 * water, as the Imperial road may on a river map), the deck runs on at full
 * height there: only a bank brings it down.
 *
 * A junction on a deck is a level landing, and the ramps climb from it at
 * their usual slope, so nobody steps up or down where two ways meet: a road
 * on land beside a run's first or last tile (a shore road along a lake's
 * corner, or the Imperial road leaving its last water tile sideways) holds
 * that tile at road level, and where two ship bridges cross, the crossing
 * tile is level at the lower of their two decks there (one crossing at the
 * other's first water tile pulls the other down to its ramp's height).
 * ----------------------------------------------------------------------------
 */

import { Road, Terrain } from '../world/map.js';
import { BRIDGE_DECK_Z, LOW_BRIDGE_DECK_Z, BRIDGE_FAR_SIDE, BR_PARAPET, BR_DECK, BRIDGE_CROWN, deckAt } from './terrainArt.js';
import { viewDir, toView, fromView } from './view.js';

/** Length of a ship bridge's ramp (tiles): from the middle of the bank's road tile to the far edge of the first water tile. */
export const RAMP_TILES = 1.5;
/** Length of a low bridge's ramp (tiles), from the water's edge. */
export const LOW_RAMP_TILES = 0.5;
/** Longest run scanned each way (bridges span at most 16 tiles; the Imperial road's may be longer). */
const SCAN = 64;

/** Is (x, y) a bridge tile of this kind (low or not)? */
function bridgeOf(map, x, y, low) {
  if (!map.inBounds(x, y)) return false;
  const i = map.idx(x, y);
  return map.road[i] === Road.BRIDGE && !map.bridgeLow[i] === !low;
}

/** Any road on (x, y), a bridge included. */
function roadAt(map, x, y) {
  return map.inBounds(x, y) && map.road[map.idx(x, y)] !== Road.NONE;
}

/**
 * Which way a bridge tile runs on the map: 'u' along x, 'v' along y. A
 * bridge neighbour along one axis only decides it (a road on the bank
 * beside the first tile used to turn its deck across the river); then a
 * road on both sides; then a road on either side along x.
 */
export function bridgeAxis(map, x, y) {
  const low = !!map.bridgeLow[map.idx(x, y)];
  const bx = bridgeOf(map, x - 1, y, low) || bridgeOf(map, x + 1, y, low);
  const by = bridgeOf(map, x, y - 1, low) || bridgeOf(map, x, y + 1, low);
  if (bx !== by) return bx ? 'u' : 'v';
  const rx = roadAt(map, x - 1, y) && roadAt(map, x + 1, y);
  const ry = roadAt(map, x, y - 1) && roadAt(map, x, y + 1);
  if (rx !== ry) return rx ? 'u' : 'v';
  return roadAt(map, x - 1, y) || roadAt(map, x + 1, y) ? 'u' : 'v';
}

/**
 * May a ship bridge's ramp start on this bank tile? A plain road on land
 * with nothing else drawn on it: a gate, an aqueduct over the road, a
 * roadblock or a building there keeps its own look, and the ramp then
 * starts at the water's edge instead.
 */
export function footOk(map, x, y) {
  if (!map.inBounds(x, y)) return false;
  const i = map.idx(x, y);
  const r = map.road[i];
  return (r === Road.ROAD || r === Road.PLAZA) && map.terrain[i] !== Terrain.WATER &&
    !map.building[i] && !map.wall[i] && !map.aqueduct[i] && !map.roadblock[i];
}

/** A road on land at (x, y). */
function landRoad(map, x, y) {
  return roadAt(map, x, y) && map.terrain[map.idx(x, y)] !== Terrain.WATER;
}

/**
 * How a run ends at (x, y), the tile past its last tile along it: 'foot'
 * (its ramp starts in the middle of that bank tile), 'bank' (at the
 * water's edge), or 'open' (more water: no ramp).
 */
function endKind(map, x, y, low) {
  if (!map.inBounds(x, y) || map.terrain[map.idx(x, y)] === Terrain.WATER) return 'open';
  return !low && footOk(map, x, y) ? 'foot' : 'bank';
}

/** A road on land beside the bridge tile (x, y), across a run along (dx, dy): a way off the deck sideways. */
function sideRoad(map, x, y, dx, dy) {
  return landRoad(map, x + dy, y + dx) || landRoad(map, x - dy, y - dx);
}

/**
 * The run of bridge tiles of one kind through (x, y) along `axis` (it may
 * pass over a crossing tile drawn along the other axis), and the places
 * along it where its deck is held down: `holds`, each a stretch [from, to]
 * of the axis (map tile units, a point when from === to) at height h. The
 * deck anywhere is the lowest it can be climbing from them at the ramp's
 * slope (deckFrom). A bank holds the deck at road level where its ramp
 * starts; a run's end tile with a road on land beside it is a landing at
 * road level. Crossings are left to bridgeProfile (they need two runs).
 */
function runOf(map, x, y, axis, low) {
  const [dx, dy] = axis === 'u' ? [1, 0] : [0, 1];
  let back = 0;
  while (back < SCAN && bridgeOf(map, x - dx * (back + 1), y - dy * (back + 1), low)) back++;
  let ahead = 0;
  while (ahead < SCAN && bridgeOf(map, x + dx * (ahead + 1), y + dy * (ahead + 1), low)) ahead++;
  const c = axis === 'u' ? x : y; // this tile's place along the axis
  const a0 = c - back; // the run's first and last tiles
  const a1 = c + ahead;
  const holds = [];
  // Each end: [its tile, the tile past it, where a foot's ramp starts, the water's edge].
  for (const [k, s, foot, edge] of [[back, -1, a0 - 0.5, a0], [ahead, 1, a1 + 1.5, a1 + 1]]) {
    const ex = x + dx * k * s;
    const ey = y + dy * k * s;
    if (sideRoad(map, ex, ey, dx, dy)) {
      // A way off sideways at the end tile: the deck is level with it there.
      const e = axis === 'u' ? ex : ey;
      holds.push({ from: e, to: e + 1, h: 0 });
      continue;
    }
    const kind = endKind(map, ex + dx * s, ey + dy * s, low);
    if (kind !== 'open') holds.push({ from: kind === 'foot' ? foot : edge, to: kind === 'foot' ? foot : edge, h: 0 });
  }
  return { dx, dy, c, a0, a1, back, ahead, Z: low ? LOW_BRIDGE_DECK_Z : BRIDGE_DECK_Z, slope: low ? LOW_BRIDGE_DECK_Z / LOW_RAMP_TILES : BRIDGE_DECK_Z / RAMP_TILES, holds };
}

/** The deck's height at place p along a run (unrounded): its full height, or lower climbing from a hold. */
function deckFrom(run, p) {
  let h = run.Z;
  for (const o of run.holds) {
    const off = p < o.from ? o.from - p : p > o.to ? p - o.to : 0;
    h = Math.min(h, o.h + run.slope * off);
  }
  return h;
}

/** The lowest the deck of `run` stands over the tile at place t (it is straight between half tiles). */
function lowestOver(run, t) {
  return Math.min(deckFrom(run, t), deckFrom(run, t + 0.5), deckFrom(run, t + 1));
}

/**
 * Where a run crosses another ship bridge (or low bridge, each with its
 * own kind): a tile of it with a neighbour across it that runs the other
 * way (a bridge alongside, running the same way, is no crossing). Each is
 * held level at the lower of the two decks over it, so both meet there.
 */
function crossings(map, run, x, y, axis, low) {
  const other = axis === 'u' ? 'v' : 'u';
  const out = [];
  for (let t = run.a0; t <= run.a1; t++) {
    const tx = axis === 'u' ? t : x;
    const ty = axis === 'u' ? y : t;
    const across = [[tx + run.dy, ty + run.dx], [tx - run.dy, ty - run.dx]];
    if (!across.some(([nx, ny]) => bridgeOf(map, nx, ny, low) && bridgeAxis(map, nx, ny) === other)) continue;
    const cross = runOf(map, tx, ty, other, low);
    out.push({ from: t, to: t + 1, h: Math.min(lowestOver(run, t), lowestOver(cross, cross.c)) });
  }
  return out;
}

/**
 * The deck heights of the bridge tile (x, y) along `axis` (its own unless
 * a caller reads a crossing tile along the other run), in px at zoom 1, at
 * its near edge, middle and far edge (map order: lower x or y first),
 * rounded to whole px so the sprite's key stays short and the walkers
 * stand on exactly what is drawn. `ends`: whether the run ends just before
 * / after this tile (its first or last tile).
 */
function profileAlong(map, x, y, axis, low) {
  const run = runOf(map, x, y, axis, low);
  const held = crossings(map, run, x, y, axis, low);
  const at = (p) => {
    let h = deckFrom(run, p);
    for (const o of held) h = Math.min(h, o.h + run.slope * (p < o.from ? o.from - p : p > o.to ? p - o.to : 0));
    return Math.round(Math.max(0, h));
  };
  const c = run.c;
  return { axis, low, h: [at(c), at(c + 0.5), at(c + 1)], ends: [run.back === 0, run.ahead === 0] };
}

/**
 * The deck heights of the bridge tile (x, y) along its axis (profileAlong).
 * null when it is no bridge.
 * @returns {{axis:'u'|'v', low:boolean, h:number[], ends:boolean[]}|null}
 */
export function bridgeProfile(map, x, y) {
  if (!map.inBounds(x, y) || map.road[map.idx(x, y)] !== Road.BRIDGE) return null;
  return profileAlong(map, x, y, bridgeAxis(map, x, y), !!map.bridgeLow[map.idx(x, y)]);
}

export { deckAt }; // (the art's own reading of the heights, so a walker stands on what is drawn)

/**
 * How a bridge tile is drawn at view turn `turn`: its axis in the view, the
 * deck's heights in the view's order along it (the map's order reversed
 * when the turn runs that axis from the front of the view to the back),
 * and whether it is the run's first tile in the view (it draws its own
 * near support). `open`: on a level ship bridge tile, the sides a way joins
 * it from (1 the far side in the view, 2 the near side), where its parapet
 * is left out (terrainArt.js bridgeSpec): a road on land beside a landing
 * at road level, or a bridge crossing it. null when it is no bridge.
 * @returns {{axis:'u'|'v', low:boolean, h:number[], abut:boolean, open:number}|null}
 */
export function bridgeLook(map, x, y, turn = 0) {
  const p = bridgeProfile(map, x, y);
  if (!p) return null;
  const [sx, sy] = viewDir(p.axis === 'u' ? 1 : 0, p.axis === 'u' ? 0 : 1, turn);
  const flip = sx + sy < 0;
  let open = 0;
  if (!p.low && p.h[0] === p.h[1] && p.h[1] === p.h[2]) {
    // The map's step across the tile, and which side of the view it lands on.
    const [cx, cy] = p.axis === 'u' ? [0, 1] : [1, 0];
    const [vx, vy] = viewDir(cx, cy, turn);
    const ahead = (sx ? vy : vx) > 0 ? 2 : 1; // the side (x + cx, y + cy) is on
    const other = p.axis === 'u' ? 'v' : 'u';
    for (const [s, side] of [[1, ahead], [-1, 3 - ahead]]) {
      const nx = x + cx * s;
      const ny = y + cy * s;
      if ((p.h[1] === 0 && landRoad(map, nx, ny)) || (bridgeOf(map, nx, ny, false) && bridgeAxis(map, nx, ny) === other)) open |= side;
    }
  }
  return { axis: sx ? 'u' : 'v', low: p.low, h: flip ? [p.h[2], p.h[1], p.h[0]] : p.h, abut: p.ends[flip ? 1 : 0], open };
}

/**
 * How a ramp's foot (one of bridgeFeet) is drawn at view turn `turn`: the
 * view axis it climbs along, and +1 when it climbs toward the front of the
 * view (+t), -1 toward the back.
 * @returns {{axis:'u'|'v', sign:number}}
 */
export function footLook(f, turn = 0) {
  const [sx, sy] = viewDir(f.dx, f.dy, turn);
  return { axis: sx ? 'u' : 'v', sign: sx + sy > 0 ? 1 : -1 };
}

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * The ramp feet on a bank tile: for each ship bridge whose ramp starts on
 * it, the map step from this tile to the bridge and the deck's height at
 * their shared edge (the foot climbs to it from the tile's middle). Empty
 * on any other tile.
 * @returns {{dx:number, dy:number, h:number}[]}
 */
export function bridgeFeet(map, x, y) {
  const out = [];
  if (!footOk(map, x, y)) return out;
  for (const [dx, dy] of STEPS) {
    const bx = x + dx;
    const by = y + dy;
    if (!bridgeOf(map, bx, by, false)) continue;
    // Only a bridge that runs this way ends here (one alongside does not),
    // a crossing tile drawn along the other way included: its run goes on.
    const axis = dx ? 'u' : 'v';
    if (bridgeAxis(map, bx, by) !== axis && !bridgeOf(map, bx + dx, by + dy, false)) continue;
    const p = profileAlong(map, bx, by, axis, false);
    const h = dx + dy > 0 ? p.h[0] : p.h[2];
    if (h > 0) out.push({ dx, dy, h });
  }
  return out;
}

/**
 * How far up (px at zoom 1) a walker at map point (fx, fy) stands: on a
 * bridge tile the deck under it, on a foot tile the ramp, else 0.
 * `feet`: the tile's bridgeFeet when the caller has them already.
 */
export function deckLift(map, fx, fy, feet = null) {
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  const p = bridgeProfile(map, tx, ty);
  if (p) return deckAt(p.h, p.axis === 'u' ? fx - tx : fy - ty);
  let lift = 0;
  for (const f of feet || bridgeFeet(map, tx, ty)) {
    // How far from the tile's middle toward the bridge (0 at the middle, 0.5 at the edge).
    const toward = f.dx ? (fx - tx - 0.5) * f.dx : (fy - ty - 0.5) * f.dy;
    lift = Math.max(lift, f.h * Math.max(0, Math.min(1, toward * 2)));
  }
  return lift;
}

/** Above any ship's rigging (px over its waterline at zoom 1: a merchantman's pennant reaches 46, a liburnian's mast 41): a cut this high cuts nothing. */
const MAST_ROOM = 48;
/** How far a ship goes under a deck (tiles) while its mast is struck, and comes out while it is raised again. */
const STRIKE = 0.2;
/** How high a ship's hull stands over its waterline (px at zoom 1): above it are its sail and mast. */
const HULL_TOP = 18;

/**
 * How a ship at map point (fx, fy) under a ship bridge's deck is drawn at
 * view turn `turn`: null when it is not under a deck (its middle not yet
 * past the far side), else one or two pieces, each a region (world px at
 * zoom 1, a polygon) it is drawn inside, and `front`: drawn after the deck
 * (renderer.js) rather than before it.
 *
 * A merchantman's mast clears the deck under the middle of a tile only by
 * the deck's width (terrainArt.js BRIDGE_DECK_Z); over a ramp it would
 * stick up through the bridge. So under the deck the ship is cut where the
 * deck over it is (its height at the ship, across the bridge's width), as
 * if its mast were struck to pass, and never above the bridge's far
 * parapet along its length (the decks and ramp feet either side included,
 * road level past them). The strike takes the first fifth of a tile under
 * the deck (the cut comes down from over the masthead), so the mast sinks
 * behind the far parapet as the ship goes under instead of vanishing at
 * once (review: the masthead vanished the moment it passed the far edge).
 *
 * Once its middle is past the near face the ship comes out in front of the
 * bridge: its sail, mast and the part of its hull in front of the face's
 * plane are drawn after the deck, the mast raised again over the next fifth
 * of a tile (the cut going back up), and the rest of its hull, still under
 * the deck, before it as before. (Drawn whole under the deck until it left
 * the tile, it came out all at once at the tile's edge.)
 * @returns {{front:boolean, region:{x:number, y:number}[]}[]|null}
 */
export function mastClip(map, fx, fy, turn = 0) {
  const look = bridgeLook(map, Math.floor(fx), Math.floor(fy), turn);
  if (!look || look.low) return null;
  const [ux, uy] = toView(fx, fy, turn, map.w, map.h);
  const vx = Math.floor(ux);
  const vy = Math.floor(uy);
  const side = BRIDGE_FAR_SIDE;
  const near = 1 - side;
  const across = look.axis === 'u' ? uy - vy : ux - vx; // 0 at the bridge's back edge, 1 at its front
  if (across < side) return null;
  // How much of the cut is lifted clear of the mast: all of it at either face, none a fifth of a tile in.
  const raise = across >= near ? Math.min(1, (across - near) / STRIKE) : Math.max(0, 1 - (across - side) / STRIKE);
  const deck = deckLift(map, fx, fy);
  const over = deck + BR_PARAPET; // the deck over the ship
  // Under the deck the cut is lifted clear as the mast is struck; out in
  // front it starts at the crown of the arch (as much as showed through
  // it) and goes up as the mast is raised.
  const shift = across < near ? -MAST_ROOM * raise : (over - Math.max(0, Math.min(BRIDGE_CROWN, deck - BR_DECK))) * (1 - raise) - MAST_ROOM * raise;
  const x0 = (ux - uy) * 32; // the ship's screen column (world x)
  const pts = [];
  for (let x = x0 - 96; x <= x0 + 96; x += 8) {
    const q = x / 32;
    // The far parapet's top at this column (along the bridge at s = side) ...
    const [pu, pv] = look.axis === 'u' ? [q + vy + side, vy + side] : [vx + side, vx + side - q];
    const [mx, my] = fromView(pu, pv, turn, map.w, map.h);
    const parapet = (pu + pv) * 16 - deckLift(map, mx, my) - BR_PARAPET;
    // ... and the deck over the ship, across the bridge from it at this column.
    const plane = (look.axis === 'u' ? 2 * ux - q : 2 * uy + q) * 16 - over;
    pts.push({ x, y: Math.max(parapet, plane) + shift });
  }
  const ground = (ux + uy) * 16;
  const bottom = ground + 32; // (under the hull and its wake)
  const left = pts[0].x;
  const right = pts[pts.length - 1].x;
  if (across < near) return [{ front: false, region: [...pts, { x: right, y: bottom }, { x: left, y: bottom }] }];
  // Past the near face. The face's plane cuts the hull at screen column xf;
  // the hull beyond it (to the right when the bridge runs along u in the
  // view, else to the left) is still under the deck.
  const back = look.axis === 'u' ? 1 : -1;
  const xf = x0 + back * (across - near) * 32;
  const hull = ground - HULL_TOP;
  const end = back > 0 ? right : left;
  const behind = [{ x: xf, y: hull }, { x: end, y: hull }, { x: end, y: bottom }, { x: xf, y: bottom }];
  const front = back > 0
    ? [...pts, { x: right, y: hull }, { x: xf, y: hull }, { x: xf, y: bottom }, { x: left, y: bottom }]
    : [...pts, { x: right, y: bottom }, { x: xf, y: bottom }, { x: xf, y: hull }, { x: left, y: hull }];
  return [{ front: false, region: behind }, { front: true, region: front }];
}
