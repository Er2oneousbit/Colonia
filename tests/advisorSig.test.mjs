/**
 * advisorSig.test.mjs - the Advisors window's change signatures (ui/advisorSig.js)
 * and the info panel's shared garrison counts (ui/infoPanel.js), DOM-free.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { log } from '../src/core/debug.js';
import { garrisonCounts } from '../src/sim/military.js';
import { tabSignature, SLOW_REFRESH } from '../src/ui/advisorSig.js';
import { ADVISOR_TABS } from '../src/ui/advisors.js';
import { buildingStatus } from '../src/ui/infoPanel.js';
import { newGame, build, findFree } from './helpers.mjs';

log.setLevel('error');

test('every Advisors tab has a signature that is stable while nothing changes', () => {
  const g = newGame();
  for (const [key] of ADVISOR_TABS) assert.equal(tabSignature(key, g), tabSignature(key, g), key);
});

test('a shown field changes its Advisors tab signature, an unshown one does not', () => {
  const g = newGame();
  const c = g.city;
  const before = { labor: tabSignature('labor', g), finance: tabSignature('finance', g), population: tabSignature('population', g), messages: tabSignature('messages', g), trade: tabSignature('trade', g) };
  c.wage += 1;
  assert.notEqual(tabSignature('labor', g), before.labor, 'wage is on Labor');
  assert.equal(tabSignature('population', g), before.population, 'wage is not on Population');
  c.taxRate += 1;
  assert.notEqual(tabSignature('finance', g), before.finance, 'tax rate is on Finance');
  c.population += 5;
  assert.notEqual(tabSignature('population', g), before.population, 'population is on Population');
  g.messages.unshift({ date: 'Jan 1', text: 'hello', level: 'info' });
  assert.notEqual(tabSignature('messages', g), before.messages, 'a new message');
  const first = Object.keys(c.trade.routes)[0];
  assert.ok(first, 'the sandbox has trade partners');
  c.trade.routes[first].open = !c.trade.routes[first].open;
  assert.notEqual(tabSignature('trade', g), before.trade, 'a route opened');
  assert.ok(SLOW_REFRESH > 1.5, 'the fallback is slower than the poll');
});

test('buildingStatus with shared garrison counts answers as without', () => {
  const g = newGame();
  const spot = findFree(g, 3, 3);
  assert.ok(spot);
  build(g, 'fort_legion', spot.x, spot.y);
  const fort = [...g.buildings.values()].find((b) => b.def.kind === 'fort');
  assert.ok(fort, 'a fort stands');
  assert.deepEqual(buildingStatus(g, fort, garrisonCounts(g)), buildingStatus(g, fort));
});
