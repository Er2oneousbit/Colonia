/**
 * perfHotpaths.test.mjs - the sim's cached hot paths (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * Three caches that exist only for speed and must never change a result: a
 * building's cached `def` (kept out of saves), the fort formation and gate
 * caches (rebuilt when the map revision or the fort changes), and the
 * criminal scan that updateCriminals skips when the streets are calm.
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { log } from '../src/core/debug.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { Building, spawnWalker, killWalker } from '../src/sim/entities.js';
import { serializeGame, deserializeGame } from '../src/core/save.js';
import { formationSpots, fortGate } from '../src/sim/forts.js';
import { updateCriminals } from '../src/sim/crime.js';
import { buildDemoCity } from '../src/dev/demoCity.js';
import { newGame } from './helpers.mjs';

log.setLevel('error');

test('a building has its def without it being saved or copied', () => {
  const b = new Building(1, 'house', 3, 3);
  assert.equal(b.def, BUILDINGS.house);
  assert.ok(!Object.keys(b).includes('def'), 'not enumerable');
  assert.ok(!('def' in { ...b }), 'a spread copy (serializeGame) leaves it out');
  const game = newGame();
  buildDemoCity(game);
  const data = JSON.parse(JSON.stringify(serializeGame(game)));
  assert.ok(data.buildings.length > 10);
  assert.ok(data.buildings.every((raw) => !('def' in raw)), 'no def in a saved building');
  const back = deserializeGame(data);
  for (const raw of data.buildings) assert.equal(back.buildings.get(raw.id).def, BUILDINGS[raw.type], 'def restored on load');
});

function fortGame() {
  const game = newGame({ type: 'plains' });
  const fort = new Building(900, 'fort_legion', 20, 20);
  game.buildings.set(fort.id, fort);
  return { game, fort };
}

test('fort formation and gate caches hold until the map revision, rally point or fort changes', () => {
  const { game, fort } = fortGame();
  const spots = formationSpots(game, fort);
  assert.equal(formationSpots(game, fort), spots, 'same revision and anchor: the cached list');
  const gate = fortGate(game, fort);
  assert.equal(fortGate(game, fort), gate);
  game.map.touch();
  assert.notEqual(formationSpots(game, fort), spots, 'a map edit rebuilds the spots');
  assert.notEqual(fortGate(game, fort), gate, 'a map edit rebuilds the gate');
  const again = formationSpots(game, fort);
  fort.rally = { x: fort.x + 6.5, y: fort.y + 6.5 };
  assert.notEqual(formationSpots(game, fort), again, 'a new rally point rebuilds the spots');
  const g2 = fortGate(game, fort);
  fort.turn = ((fort.turn || 0) + 1) % 4;
  assert.notEqual(fortGate(game, fort), g2, 'turning the fort rebuilds the gate');
});

test('updateCriminals skips calm streets, still sends hunters home, and counts spawns and kills', () => {
  const game = newGame({ type: 'plains' });
  const idx = game.map.idx(10, 10);
  assert.equal(game.criminalWalkers, 0);
  const t = spawnWalker(game, 'thief', idx, null, { state: 'steal', hp: 5 });
  assert.equal(game.criminalWalkers, 1);
  const p = spawnWalker(game, 'prefect', game.map.idx(30, 30), null, {});
  p.state = 'hunt';
  p.huntTarget = t.id;
  game.huntersOut = true;
  killWalker(game, t);
  assert.equal(game.criminalWalkers, 0);
  updateCriminals(game);
  assert.equal(p.huntTarget, 0, 'the hunter was called off though no criminal is left');
  assert.equal(game.huntersOut, false);
  const before = JSON.stringify([...game.walkers.values()]);
  updateCriminals(game);
  assert.equal(JSON.stringify([...game.walkers.values()]), before, 'calm streets: nothing touched');
  killWalker(game, t); // already gone: the count must not go negative
  assert.equal(game.criminalWalkers, 0);
});
