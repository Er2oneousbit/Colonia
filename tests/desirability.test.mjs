/**
 * desirability.test.mjs - the kept ground layer of sim/desirability.js and the
 * earthquake's batched road pass (core/game.js holdMapEdits).
 *
 * The ground layer (waterfront, trees, plazas, rubble) is kept between passes
 * and redone only when terrain, rubble, road or waterDist differ. These tests
 * change those layers through each path that writes them and check the
 * result is what a fresh full pass gives.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { log } from '../src/core/debug.js';
import { Terrain, Road } from '../src/world/map.js';
import { updateDesirability, forgetDesirabilityBase } from '../src/sim/desirability.js';
import { undoLast } from '../src/sim/construction.js';
import { collapseBuilding } from '../src/sim/risk.js';
import { startQuake } from '../src/sim/events.js';
import { buildDemoCity } from '../src/dev/demoCity.js';
import { newGame, build } from './helpers.mjs';

log.setLevel('error');

function town(seed = 'des-cache') {
  const game = newGame({ seed, size: 64 });
  assert.ok(buildDemoCity(game, { level: 1 }).ok);
  game.runDays(3);
  return game;
}

/** The kept pass's result must equal a fresh full pass over the same map. */
function agrees(game, what) {
  updateDesirability(game);
  const kept = Int16Array.from(game.map.desirability);
  forgetDesirabilityBase(game.map);
  updateDesirability(game);
  assert.deepEqual(Array.from(game.map.desirability), Array.from(kept), what);
}

/** Some open grass tile that is not on a road or under a building. */
function openTile(game, skip = 0) {
  const { map } = game;
  let n = 0;
  for (let i = 0; i < map.size; i++) {
    if (map.terrain[i] === Terrain.GRASS && !map.road[i] && !map.building[i] && !map.rubble[i] && n++ >= skip) return i;
  }
  throw new Error('no open tile');
}

test('desirability: an unchanged map gives the same layer twice', () => {
  const game = town();
  agrees(game, 'first pass against a fresh one');
  agrees(game, 'second pass, from the kept layer');
});

test('desirability: trees, rock and rubble written straight to the map are seen', () => {
  const game = town();
  const { map } = game;
  agrees(game, 'primed');
  map.terrain[openTile(game)] = Terrain.TREES;
  agrees(game, 'a tree appears');
  map.terrain[openTile(game, 3)] = Terrain.ROCK;
  agrees(game, 'rock');
  map.rubble[openTile(game, 5)] = 1;
  agrees(game, 'rubble');
  map.rubble.fill(0);
  agrees(game, 'rubble gone');
});

test('desirability: the shore bonus follows waterDist when water appears', () => {
  const game = town();
  const { map } = game;
  agrees(game, 'primed');
  map.terrain[openTile(game)] = Terrain.WATER;
  map.computeWaterDistance();
  agrees(game, 'a pond');
});

test('desirability: a plaza built, undone and cleared through the construction paths', () => {
  const game = town();
  const { map } = game;
  agrees(game, 'primed');
  let road = -1;
  for (let i = 0; i < map.size && road < 0; i++) if (map.road[i] === Road.ROAD && !map.fixedRoad[i] && !map.building[i]) road = i;
  assert.ok(road >= 0, 'a road to pave');
  const x = road % map.w;
  const y = (road / map.w) | 0;
  const r = build(game, 'plaza', x, y);
  assert.ok(r.ok !== false && map.road[road] === Road.PLAZA, 'paved');
  agrees(game, 'plaza built');
  assert.ok(undoLast(game).ok, 'undone');
  agrees(game, 'plaza undone');
  // Rubble cleared by the clear tool, and trees cut by it.
  const t = openTile(game);
  map.rubble[t] = 1;
  map.terrain[openTile(game, 2)] = Terrain.TREES;
  agrees(game, 'rubble and a tree');
  build(game, 'clear', 0, 0, map.w - 1, map.h - 1);
  agrees(game, 'cleared');
});

test('desirability: a building that collapses leaves rubble that counts', () => {
  const game = town();
  agrees(game, 'primed');
  const b = [...game.buildings.values()].find((x) => !x.house && x.def.kind !== 'monument');
  assert.ok(b);
  collapseBuilding(game, b, 'decay');
  agrees(game, 'collapsed');
});

test('desirability: an earthquake that rocks the ground and tears roads agrees at its end and each day', () => {
  const game = town('des-quake');
  agrees(game, 'primed');
  assert.ok(startQuake(game, 'medium'));
  let days = 0;
  while (game.city.events.quake && days++ < 60) {
    game.runDays(1);
    agrees(game, `quake day ${days}`);
  }
});

test('quake batching: after the strikes the road networks and access roads equal a pass from scratch, and the batch is closed', () => {
  const game = town('batch-quake');
  assert.ok(startQuake(game, 'large'));
  let days = 0;
  while (game.city.events.quake && days++ < 60) game.runDays(1);
  assert.equal(game.mapEditsHeld, false, 'no batch left open');
  assert.equal(game.mapEditsPending, false, 'nothing waiting');
  const net = Uint32Array.from(game.map.roadNet);
  const access = [...game.buildings.values()].map((b) => b.accessRoad);
  game.processRoadChanges();
  assert.deepEqual(Array.from(game.map.roadNet), Array.from(net), 'road networks');
  assert.deepEqual([...game.buildings.values()].map((b) => b.accessRoad), access, 'access roads');
});

test('quake batching: edits made while a batch is open wait for one pass, a flush runs it', () => {
  const game = town('batch-hold');
  let passes = 0;
  const real = game.processRoadChanges.bind(game);
  game.processRoadChanges = () => { passes++; real(); };
  game.holdMapEdits();
  game.onMapEdited();
  game.onMapEdited();
  game.onMapEdited();
  assert.equal(passes, 0, 'held');
  game.releaseMapEdits();
  assert.equal(passes, 1, 'one pass for three edits');
  game.flushMapEdits();
  assert.equal(passes, 1, 'nothing left to do');
  game.onMapEdited();
  assert.equal(passes, 2, 'outside a batch it is immediate again');
});
