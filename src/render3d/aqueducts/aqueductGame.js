/**
 * aqueducts/aqueductGame.js
 * ----------------------------------------------------------------------------
 * The aqueducts and reservoirs in the game's WebGL renderer: how
 * render/renderer.js hands an aqueduct tile or a dragged aqueduct's ghost
 * to the model pass (modelPass.js) as a stand-in building, as the town
 * walls are (walls/wallGame.js), and which inlets and intakes a reservoir
 * shows. Render-only: the sim never sees any of it.
 *
 *   aqueductModelPlace   an aqueduct tile as a model: { b, place } for
 *                        be.model(), b a stand-in building of type
 *                        'aqueduct' (models.js MODELS.aqueduct) carrying its
 *                        piece's key and its water's state
 *   aqueductGhosts       a dragged aqueduct's ghost pieces, see-through
 *   reservoirMore        a reservoir's inlets and intakes, as `more` kits
 *
 * Rising: a tile that was not there at the last map change rises out of
 * the ground over half a second, as a new building does; the layer is
 * compared with its copy at each map revision, so a load or a new game
 * raises nothing. (A tile whose water comes or goes is no new tile: the
 * layer's 1 and 2 are both "there".)
 *
 * Clicks: as before, an aqueduct tile is picked by its footprint and keeps
 * no cover sprite (the 2D aqueduct never hid a walker from a click either),
 * so a walker under or behind an arch is clicked as he always was.
 * ----------------------------------------------------------------------------
 */

import { Matrix4 } from 'three';
import { aqueductPiece, aqueductLookOf, reservoirJoins } from './aqueductLayout.js';
import { lookOfGame } from '../walls/wallGame.js';
import { Terrain } from '../../world/map.js';

/** Seconds a new aqueduct takes to rise, and art px it starts sunk (as a building's sprite: renderer.js). */
const RISE_S = 0.5;
const RISE_PX = 14;

/** Per map: the aqueduct layer's copy (there or not) at the last revision, and when each new tile appeared. */
const TRACK = new WeakMap();

/**
 * Note the map's aqueducts (once a revision): new tiles rise from `time`
 * (the renderer's seconds). The renderer calls it every frame, with either
 * back end, so the first aqueduct of a game rises and one built under
 * Classic is not new when the WebGL renderer comes back.
 */
export function noteAqueducts(map, time) {
  let t = TRACK.get(map);
  if (!t) {
    // (A map seen for the first time, a load or a new game: what stands there is not new.)
    const there = new Uint8Array(map.aqueduct.length);
    for (let i = 0; i < there.length; i++) there[i] = map.aqueduct[i] ? 1 : 0;
    TRACK.set(map, (t = { rev: map.revision, there, appear: new Map() }));
    return t;
  }
  if (t.rev === map.revision) return t;
  t.rev = map.revision;
  const a = map.aqueduct;
  for (let i = 0; i < a.length; i++) {
    const on = a[i] ? 1 : 0;
    if (on && !t.there[i]) t.appear.set(i, time);
    else if (!on) t.appear.delete(i);
    t.there[i] = on;
  }
  return t;
}

/** Art px aqueduct tile `i` is sunk at `time` while it rises (0 once up). */
export function aqueductRise(map, i, time) {
  const t = noteAqueducts(map, time);
  const t0 = t.appear.get(i);
  if (t0 === undefined) return 0;
  const p = (time - t0) / RISE_S;
  if (p >= 1 || p < 0) {
    t.appear.delete(i);
    return 0;
  }
  return (1 - (1 - (1 - p) ** 3)) * RISE_PX;
}

/** The look (stone) of a game's aqueducts and reservoirs: the province's, as its walls'. */
export function aqueductLookOfGame(game) {
  return aqueductLookOf(game ? lookOfGame(game) : 'polygonal');
}

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3). */
const frost = (snow) => (snow || 0) >= 2;

/**
 * Aqueduct tile `i` at map (x, y), view tile (vx, vy), as a model for the
 * back end: { b, place, piece }. `r` is the renderer (its game, view turn,
 * clock and snow).
 */
export function aqueductModelPlace(r, x, y, i, vx, vy) {
  const game = r.game;
  const map = game.map;
  const piece = aqueductPiece(map, game.buildings, x, y, r.viewTurn, aqueductLookOfGame(game));
  const snow = r.pal ? r.pal.snow : 0;
  // (Ids apart from the walls' stand-ins, -1 - i: the pass keys nothing by them, but a stand-in is a building to it.)
  const b = { id: -1 - map.size - i, type: 'aqueduct', size: 1, x, y, key: piece.key, state: piece.state, ice: frost(snow) };
  const place = { T: piece.T, state: 0, snow, vx, vy, rise: aqueductRise(map, i, r.time || 0) };
  return { b, place, piece };
}

/**
 * A dragged aqueduct's ghost: the plan's tiles that would be built, each as
 * the piece it would be with the plan's other tiles standing (`ghostModel`
 * descriptors with their look worked out: modelPass.js placeGhost).
 */
export function aqueductGhosts(r, plan) {
  const game = r.game;
  const map = game.map;
  const look = aqueductLookOfGame(game);
  const planned = new Set();
  for (const it of plan.items) if (it.ok && !it.exists) planned.add(map.idx(it.x, it.y));
  const extra = (x, y) => map.inBounds(x, y) && planned.has(map.idx(x, y));
  const out = [];
  for (const it of plan.items) {
    if (!it.ok || it.exists) continue;
    const piece = aqueductPiece(map, game.buildings, it.x, it.y, r.viewTurn, look, extra, true);
    const foot = r.footAt(it.x, it.y, 1);
    out.push({
      type: 'aqueduct', x: it.x, y: it.y, size: 1, T: piece.T, vx: foot.vx, vy: foot.vy, ok: true, snow: r.pal ? r.pal.snow : 0,
      variant: { key: piece.key, state: 'dry', ice: false },
    });
  }
  return out;
}

/** Is map tile (x, y) open water (a reservoir beside it fills: sim/water.js)? */
const waterAt = (map) => (x, y) => map.inBounds(x, y) && map.terrain[map.idx(x, y)] === Terrain.WATER;

/** The matrix of an inlet or intake built on the +x face's middle, moved to face `side` (0..3: +x, +z, -x, -z) and tile k along it. */
export function inletMatrix(side, k, out = new Matrix4()) {
  out.makeRotationY((-side * Math.PI) / 2);
  return out.multiply(new Matrix4().makeTranslation(0, 0, k * 4));
}

/**
 * The kit a join shows (models/castellum.js): an intake on open water; at
 * the middle of the back face the inlet into the house; else an inlet, its
 * pour turned in toward the face's middle off it ('inlet1', 'inlet-1').
 */
export function inletKind(j) {
  if (j.kind === 'water') return 'intake';
  if (j.side === 3 && j.k === 0) return 'house';
  return j.k ? `inlet${j.k}` : 'inlet';
}

/** Per building: its `more` list and the signature it was made for (joins change only with the map). */
const MORE = new WeakMap();

/**
 * A reservoir's inlets (where aqueducts reach it) and intakes (its sides on
 * open water), as `more` kits in its own metres (models/castellum.js): one
 * entry a kit and state, its matrices for every place it stands. The
 * aqueduct at the middle of the back face runs into the castellum's house.
 */
export function reservoirMore(game, b, look) {
  const map = game && game.map;
  if (!map || !map.aqueduct) return undefined;
  const joins = reservoirJoins(map, b, waterAt(map));
  // (What the list shows: the joins, their water, and the reservoir's own for its intakes.)
  const sig = `${look}|${b.hasWater ? 1 : 0}|${joins.map((j) => `${j.side}${j.k}${j.kind[0]}${j.state ? j.state[0] : ''}`).join(',')}`;
  const m = MORE.get(b);
  if (m && m.sig === sig) return m.list;
  const groups = new Map();
  for (const j of joins) {
    const what = inletKind(j);
    const state = j.kind === 'water' ? (b.hasWater ? 'flowing' : 'dry') : j.state;
    const key = `reservoir:${look}:${what}`;
    const gk = `${key}|${state}`;
    let g = groups.get(gk);
    if (!g) groups.set(gk, (g = { key, state, places: [] }));
    g.places.push(inletMatrix(j.side, j.k));
  }
  const list = [...groups.values()].map((g) => {
    const mats = new Float32Array(16 * g.places.length);
    g.places.forEach((mm, k) => mm.toArray(mats, k * 16));
    return { key: g.key, n: g.places.length, mats, state: g.state };
  });
  MORE.set(b, { sig, list });
  return list;
}
