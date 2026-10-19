/**
 * needsLatin.test.mjs - the home panel's needs and the Population ladder name buildings in Latin (node:test)
 * ----------------------------------------------------------------------------
 * The Names help tab promises that messages and advisors use the Latin
 * name; the need texts read it from data/buildings.js so a rename follows.
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { BUILDINGS } from '../src/data/buildings.js';
import { describeNeed } from '../src/ui/infoPanel.js';
import { tierNeeds } from '../src/ui/advisors.js';
import { HOUSE_TIERS } from '../src/data/housing.js';

test('home needs: education, health, baths, barber and venues use the Latin names', () => {
  const edu = describeNeed({ key: 'edu', need: 3, have: 1 });
  for (const k of ['school', 'library', 'academy']) assert.ok(edu.includes(BUILDINGS[k].name), `${k} in "${edu}"`);
  assert.ok(!/\bschool\b/.test(edu));
  const health = describeNeed({ key: 'health', need: 2, have: 0 });
  assert.ok(health.includes(BUILDINGS.clinic.name) && health.includes(BUILDINGS.hospital.name));
  assert.match(describeNeed({ key: 'barber' }), /Tonstrina \(Barber\)/);
  assert.match(describeNeed({ key: 'baths' }), /Balneae \(Baths\)/);
  const ent = describeNeed({ key: 'ent', need: 20, have: 0 });
  for (const k of ['theater', 'amphitheater', 'colosseum', 'hippodrome']) assert.ok(ent.includes(BUILDINGS[k].name), `${k} in ent text`);
});

test('the Population ladder names the Latin buildings', () => {
  const all = HOUSE_TIERS.map((_, i) => tierNeeds(i)).join(' | ');
  assert.ok(all.includes(BUILDINGS.school.name));
  assert.ok(all.includes(BUILDINGS.academy.name));
  assert.ok(all.includes(`${BUILDINGS.clinic.name}+${BUILDINGS.hospital.name}`));
  assert.ok(!/medicus\+hospital|school\+library/.test(all));
});
