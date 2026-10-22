/**
 * industryArt.test.mjs - the Classic sprites of the four raw producers and
 * the eight workshops (render/buildingArt.js), headless (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * They are drawn as the 3D models are designed (render3d/models/clayPit.js and
 * its siblings), and show what the models show:
 *   - the art state: staffed or shut (bit 0) and the stores as steps of 0 to 3
 *   - every state draws, at every turn and under snow, and each change of
 *     state (shut, a fuller store, a second raw material) changes the picture
 *   - what the renderer reads: a placement ghost (no stock, no staff yet) and a
 *     building from before the states are drawn staffed and empty
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildingSpec, artState, industryArtState } from '../src/render/buildingArt.js';
import { recordingContext } from '../src/render/draw.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { CONFIG } from '../src/config.js';

const RAW = { clay_pit: 'clay', timber_yard: 'timber', iron_mine: 'iron', marble_quarry: 'marble' };
const WORKSHOPS = ['pottery_ws', 'furniture_ws', 'oil_ws', 'wine_ws', 'weapons_ws', 'fletcher_ws', 'linen_ws', 'clothing_ws'];

/** A building as artState reads it: staffed or not, holding `stock`. */
const bld = (type, stock = {}, staffed = true) => ({ type, def: BUILDINGS[type], efficiency: staffed ? 1 : 0, stock });

/** What a sprite paints, as one string: every call and every colour set, in order. */
function picture(key, state, snow = 0, turn = 0) {
  const { ctx } = recordingContext();
  const log = [];
  const spy = new Proxy(ctx, {
    get: (t, k) => (typeof t[k] === 'function' ? (...a) => { log.push(`${String(k)}(${a.map((v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : String(v))).join(',')})`); return t[k](...a); } : t[k]),
    set: (t, k, v) => { log.push(`${String(k)}=${v}`); t[k] = v; return true; },
  });
  buildingSpec(key, BUILDINGS[key].size, 0, state, false, snow, false, turn).draw(spy);
  return log.join(';');
}

test('industry art: the state is staffed or shut and the stores in steps of a third (a producer\'s cap 400, a workshop\'s raw 200, its product two lots)', () => {
  for (const [type, good] of Object.entries(RAW)) {
    assert.equal(artState(bld(type)), 0, `${type}: staffed, empty`);
    assert.equal(artState(bld(type, {}, false)), 1, `${type}: shut, empty`);
    const steps = [1, 133, 134, 266, 267, 400].map((n) => artState(bld(type, { [good]: n })) >> 1);
    assert.deepEqual(steps, [1, 1, 2, 2, 3, 3], `${type}: any stock shows, then thirds of ${CONFIG.PRODUCER_MAX_STOCK}`);
    assert.equal(artState(bld(type, { [good]: 400 }, false)), 7, `${type}: full and shut`);
  }
  // A workshop: raw step, second raw step and product step, two bits each after the shut bit.
  assert.equal(artState(bld('pottery_ws', { clay: 200 })), 2 * 3);
  assert.equal(artState(bld('pottery_ws', { pottery: 200 })), 2 * 3 * 16, 'the product against two lots of a hundred');
  assert.equal(artState(bld('pottery_ws', { pottery: 100 })), 2 * 2 * 16);
  assert.equal(artState(bld('fletcher_ws', { timber: 200, iron: 200 })), 2 * (3 + 4 * 3), 'the fletcher has two raw materials');
  assert.equal(artState(bld('pottery_ws', { iron: 200 })), 0, 'goods it does not use do not show');
  assert.equal(artState(bld('weapons_ws', { iron: 70 }, false)), 1 + 2 * 2);
  // A building that is not one of the twelve keeps the art state it had.
  assert.equal(industryArtState(bld('well')), undefined);
});

test('industry art: a ghost or a building without stock is drawn staffed and empty (state 0)', () => {
  for (const type of [...Object.keys(RAW), ...WORKSHOPS]) {
    assert.equal(industryArtState({ type, efficiency: 1 }), 0, type);
    assert.equal(picture(type, 0), picture(type, industryArtState({ type, efficiency: 1, stock: {} })), type);
  }
});

test('industry art: every producer and workshop draws in every state, at every turn, under snow', () => {
  for (const type of [...Object.keys(RAW), ...WORKSHOPS]) {
    const goods = [BUILDINGS[type].produces, BUILDINGS[type].consumes, ...Object.keys(BUILDINGS[type].recipe || {})].filter(Boolean);
    const full = Object.fromEntries(goods.map((g) => [g, 400]));
    for (const staffed of [true, false]) {
      for (const stock of [{}, Object.fromEntries(goods.map((g) => [g, 100])), full]) {
        const state = artState(bld(type, stock, staffed));
        for (let turn = 0; turn < 4; turn++) for (const snow of [0, 2]) {
          const { ctx } = recordingContext();
          assert.doesNotThrow(() => buildingSpec(type, BUILDINGS[type].size, 0, state, false, snow, false, turn).draw(ctx), `${type} state ${state} turn ${turn} snow ${snow}`);
        }
      }
    }
  }
});

test('industry art: idle differs from staffed, and each step of a store from the one before', () => {
  for (const [type, good] of Object.entries(RAW)) {
    const looks = [0, 1, 2, 3].map((n) => picture(type, artState(bld(type, n ? { [good]: n * 133 } : {}))));
    assert.equal(new Set(looks).size, 4, `${type}: four steps of the store look different`);
    assert.notEqual(picture(type, 1), looks[0], `${type}: shut is not staffed`);
    assert.notEqual(picture(type, 7), picture(type, 6), `${type}: shut and full, and staffed and full, differ`);
  }
  for (const type of WORKSHOPS) {
    const [raw, raw2, made] = [BUILDINGS[type].consumes || Object.keys(BUILDINGS[type].recipe)[0], Object.keys(BUILDINGS[type].recipe || {})[1], BUILDINGS[type].produces];
    const base = picture(type, 0);
    assert.notEqual(picture(type, 1), base, `${type}: shut is not staffed`);
    const looks = (good, cap) => [1, 2, 3].map((n) => picture(type, artState(bld(type, { [good]: Math.floor((n * cap) / 3) }))));
    for (const [good, cap, what] of [[raw, CONFIG.WORKSHOP_RAW_CAP, 'raw material'], [made, CONFIG.CART_CAPACITY * 2, 'product'], ...(raw2 ? [[raw2, CONFIG.WORKSHOP_RAW_CAP, 'second raw material']] : [])]) {
      const l = looks(good, cap);
      assert.equal(new Set([base, ...l]).size, 4, `${type}: the ${what} (${good}) shows in each of its three steps`);
    }
  }
});

test('industry art: the fires are out while shut (the kiln mouth bricked up, the forge cold, the furnace dark, the lantern cold)', () => {
  // The colours that mean fire in each sprite.
  const fire = { pottery_ws: '#ff8a2a', weapons_ws: '#f26a1f', iron_mine: '#f2742a' };
  for (const [type, colour] of Object.entries(fire)) {
    assert.ok(picture(type, 0).includes(colour), `${type}: glows while staffed`);
    assert.ok(!picture(type, 1).includes(colour), `${type}: no fire while shut`);
  }
  for (const type of [...Object.keys(RAW), ...WORKSHOPS]) {
    assert.ok(picture(type, 0).includes('#ffd98a'), `${type}: the lantern is lit while staffed`);
    assert.ok(!picture(type, 1).includes('#ffd98a'), `${type}: and cold while shut`);
  }
});

test('industry art: the shop front is boarded up while a workshop is shut, open while it is staffed', () => {
  for (const type of WORKSHOPS) {
    assert.ok(picture(type, 1).includes('#8a7456'), `${type}: boards across the front`);
    assert.ok(!picture(type, 0).includes('#8a7456'), `${type}: open to the street`);
  }
});
