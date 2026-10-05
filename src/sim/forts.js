/**
 * forts.js
 * ----------------------------------------------------------------------------
 * A fort's ground: the post in front of it (fortPost), the spots its men
 * stand to on around the post or the rally point (formationSpots, postOf),
 * the yard inside its walls where they rest (yardSpot: FORT_YARD, turned with
 * the fort), the gate they go in and out by (fortGate), and what calls them
 * out of the yard (standsTo, watchOf). The men themselves are moved by
 * sim/military.js updateRoman; sim/training.js asks here whether a fort is
 * at rest before it sends a man to train. Imports sim/unitMove.js (passable)
 * and sim/combat.js (hostileToRome).
 * ----------------------------------------------------------------------------
 */

import { UNIT_TYPES, FORT_CAPACITY, FORT_YARD, FORT_GATEWAY } from '../data/units.js';
import { passable } from './unitMove.js';
import { hostileToRome } from './combat.js';

// When a fort has fewer open tiles around its post than soldiers, extra men
// share tiles using these sub-tile offsets.
const SLOT_OFFSETS = [[0, 0], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26], [-0.26, -0.26]];

// A fort's men rest in its yard, inside its walls, and stand to on its
// ground by it (formationSpots around its post, where they always stood)
// while raiders, Caesar's men or a revolt are in the province, or raider
// ships off its shore: they come out long before a warband crosses the map,
// so they meet it where and as they always did. A wolf or an angry villager
// calls them out only within STAND_TO_REACH tiles of the fort's post, and a
// man already out goes back in only once it is STAND_DOWN_SLACK tiles beyond
// that (a wolf roaming about the line would have him in and out by turns).
const STAND_TO_REACH = 12;
const STAND_DOWN_SLACK = 4;

/** The open tile in front of a fort where its soldiers stand (cached). */
export function fortPost(game, fort) {
  if (fort.post && fort.postRev === game.map.revision) return fort.post;
  const map = game.map;
  const S = fort.size;
  const cands = [];
  for (let d = 0; d < S; d++) {
    cands.push([fort.x + d, fort.y + S], [fort.x + S, fort.y + d], [fort.x + d, fort.y - 1], [fort.x - 1, fort.y + d]);
  }
  let post = { x: fort.x + S / 2, y: fort.y + S + 0.5 };
  for (const [x, y] of cands) {
    if (map.inBounds(x, y) && passable(game, 'rome', map.idx(x, y))) { post = { x: x + 0.5, y: y + 0.5 }; break; }
  }
  fort.post = post;
  fort.postRev = map.revision;
  return post;
}

/** The point a fort's soldiers gather around: its rally point or its parade tile. */
function anchorOf(game, fort) {
  return fort.rally || fortPost(game, fort);
}

/**
 * Standing spots for a fort's soldiers: the open tiles nearest the anchor
 * (breadth-first, so they fill a road or a field naturally instead of
 * poking into buildings). Cached per fort until the map or anchor changes.
 */
export function formationSpots(game, fort) {
  const base = anchorOf(game, fort);
  const key = `${game.map.revision}:${base.x},${base.y}`;
  if (!game.formations) game.formations = new Map(); // fort id -> { key, spots } (derived, not saved)
  const hit = game.formations.get(fort.id);
  if (hit && hit.key === key) return hit.spots;
  const map = game.map;
  const bx = Math.floor(base.x);
  const by = Math.floor(base.y);
  const tiles = [];
  if (map.inBounds(bx, by)) {
    // BFS may cross blocked tiles (a rally point inside a building) but only
    // collects open ones, and never strays more than 5 tiles.
    const start = map.idx(bx, by);
    const seen = new Set([start]);
    const queue = [start];
    for (let q = 0; q < queue.length && tiles.length < FORT_CAPACITY; q++) {
      const i = queue[q];
      if (passable(game, 'rome', i)) tiles.push(i);
      const x = map.xOf(i);
      const y = map.yOf(i);
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!map.inBounds(nx, ny) || Math.abs(nx - bx) > 5 || Math.abs(ny - by) > 5) continue;
        const j = map.idx(nx, ny);
        if (!seen.has(j)) { seen.add(j); queue.push(j); }
      }
    }
  }
  const spots = [];
  for (let s = 0; s < FORT_CAPACITY; s++) {
    if (!tiles.length) { spots.push({ x: base.x, y: base.y }); continue; }
    const i = tiles[s % tiles.length];
    const off = SLOT_OFFSETS[Math.floor(s / tiles.length) % SLOT_OFFSETS.length];
    spots.push({ x: map.xOf(i) + 0.5 + off[0], y: map.yOf(i) + 0.5 + off[1] });
  }
  game.formations.set(fort.id, { key, spots });
  return spots;
}

/**
 * A soldier's spot in his fort's ranks: on its ground by it (around its post),
 * or around its rally point. His fight zone is measured from here (an
 * archer's) or from the whole formation (fightZone), wherever he stands.
 */
export function postOf(game, u, fort) {
  return formationSpots(game, fort)[u.slot % FORT_CAPACITY];
}

// ---------------------------------------------------------------------------
// The fort's yard: where its men rest, inside the walls
// ---------------------------------------------------------------------------

/**
 * A point (u, v) of a fort's unturned art, in tiles of a 3 x 3 fort, as a
 * map point: scaled to the fort's size and turned as the fort stands (the
 * R key's turn, b.turn), as render/turn.js turnUV turns the art itself.
 */
function fortPoint(fort, u, v) {
  const S = fort.size;
  const a = (u * S) / 3;
  const b = (v * S) / 3;
  switch ((fort.turn || 0) & 3) {
    case 1: return { x: fort.x + S - b, y: fort.y + a };
    case 2: return { x: fort.x + S - a, y: fort.y + S - b };
    case 3: return { x: fort.x + b, y: fort.y + S - a };
    default: return { x: fort.x + a, y: fort.y + b };
  }
}

/** Where a soldier stands at rest: his spot in his fort's yard (FORT_YARD). */
export function yardSpot(fort, slot) {
  const spots = FORT_YARD[fort.def.unit] || FORT_YARD.legionary;
  const [u, v] = spots[slot % spots.length];
  return fortPoint(fort, u, v);
}

/**
 * Where a fort's men go in and out: `out`, the middle of the open tile in
 * front of the gateway in its art (FORT_GATEWAY, turned with the fort), and
 * `door`, the middle of the footprint tile behind it. With that tile built
 * over, the post's tile (fortPost) and the footprint tile beside it; null
 * when that is shut too (the men stay where they are, in or out). Fort
 * footprints stay closed to everyone: a man walks in through here only,
 * and leaves through here before any route is planned (planPath cannot
 * start inside a building). The gateway's tile counts only if it leads
 * somewhere (gateLeadsOut): walled into a pocket it would have kept the
 * whole garrison in. Cached per fort until the map changes (derived, not
 * saved).
 */
export function fortGate(game, fort) {
  const map = game.map;
  const key = `${map.revision}:${fort.x},${fort.y},${fort.turn || 0}`;
  if (!game.fortGates) game.fortGates = new Map(); // fort id -> { key, gate }
  const hit = game.fortGates.get(fort.id);
  if (hit && hit.key === key) return hit.gate;
  const S = fort.size;
  const tile = (p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
  const open = (t) => map.inBounds(t.x, t.y) && passable(game, 'rome', map.idx(t.x, t.y));
  const mid = (t) => ({ x: t.x + 0.5, y: t.y + 0.5 });
  const [gu, gv] = FORT_GATEWAY;
  const out = tile(fortPoint(fort, gu, gv + 1.5 / S));
  const post = tile(fortPost(game, fort));
  let gate = null;
  if (open(out) && gateLeadsOut(game, fort, out, post)) gate = { out: mid(out), door: mid(tile(fortPoint(fort, gu, gv - 1.5 / S))) };
  else if (open(post)) {
    const door = { x: Math.min(fort.x + S - 1, Math.max(fort.x, post.x)), y: Math.min(fort.y + S - 1, Math.max(fort.y, post.y)) };
    gate = { out: mid(post), door: mid(door) };
  }
  game.fortGates.set(fort.id, { key, gate });
  return gate;
}

/**
 * Does the open tile `out` before a fort's gateway lead anywhere: to the
 * fort's post, or to open ground 3 tiles or more from the fort? A small
 * breadth-first search over open tiles, outside the footprint.
 */
function gateLeadsOut(game, fort, out, post) {
  const map = game.map;
  const S = fort.size;
  const far = (x, y) => Math.max(fort.x - x, x - (fort.x + S - 1), fort.y - y, y - (fort.y + S - 1)) >= 3;
  const start = map.idx(out.x, out.y);
  const seen = new Set([start]);
  const queue = [start];
  for (let q = 0; q < queue.length && q < 200; q++) {
    const x = map.xOf(queue[q]);
    const y = map.yOf(queue[q]);
    if ((x === post.x && y === post.y) || far(x, y)) return true;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const j = map.idx(nx, ny);
      if (seen.has(j) || !passable(game, 'rome', j)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  return false;
}

/**
 * Do a fort's men stand to (on its ground by it, around its post) rather than
 * rest in its yard? While raiders, Caesar's men or a revolt are in the
 * province, or raider ships off its shore (`alarm`), and while any other
 * foe (a wolf, an angry villager) is within STAND_TO_REACH of its post; a
 * man already `out` stays out until it is STAND_DOWN_SLACK beyond. `memo`:
 * this tick's nearest foe, per fort.
 */
export function standsTo(game, fort, watch, out) {
  if (watch.alarm) return true;
  let d = watch.memo.get(fort.id);
  if (d === undefined) {
    const p = fortPost(game, fort);
    d = Infinity;
    for (const e of watch.foes) d = Math.min(d, Math.hypot(e.x - p.x, e.y - p.y));
    watch.memo.set(fort.id, d);
  }
  return d <= STAND_TO_REACH + (out ? STAND_DOWN_SLACK : 0);
}

/**
 * What calls the forts' men out of their yards (standsTo), looked up afresh
 * from the units on the map: what updateMilitary builds each tick from its
 * own lists, for the daily rules (sim/training.js startTrips).
 */
export function watchOf(game) {
  let alarm = false;
  const foes = [];
  for (const u of game.units.values()) {
    if (u.side === 'enemy') alarm = true; // (raiders, Caesar's men, gladiators, raider ships)
    if (!UNIT_TYPES[u.type].naval && hostileToRome(u)) foes.push(u);
  }
  return { alarm, foes, memo: new Map() };
}
