/**
 * save.test.mjs - headless tests for the save format (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * Covers the packing added in save version 3 (map layers PackBits run-length
 * coded as "pb:<base64>", paths as 16-bit values "u16:<base64>"), that the
 * unpacked forms (plain base64 layers, array paths) still load, that saves
 * from before version 4 (the 20-level housing ladder) are refused with a
 * readable message, and that an Uber (256x256) city saves to a size that
 * fits comfortably in browser storage and loads back intact.
 * The basic city round trip is in sim.test.mjs, military state in
 * military.test.mjs.
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { log } from '../src/core/debug.js';
import { CONFIG } from '../src/config.js';
import { serializeGame, deserializeGame, saveFileName, MIN_SAVE_VERSION, packBits, unpackBits, encodeLayer, decodeLayer, encodeBytes, decodeBytes, encodePath, decodePath } from '../src/core/save.js';
import { MAP_SIZES } from '../src/world/mapgen.js';
import { buildDemoCity } from '../src/dev/demoCity.js';
import { newGame } from './helpers.mjs';

log.setLevel('error');

const LAYERS = ['terrain', 'variant', 'road', 'aqueduct', 'rubble', 'fixedRoad', 'wall'];

/** Deterministic pseudo-random bytes. */
function noise(n, seed = 7) {
  let s = seed >>> 0;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = s >>> 24;
  }
  return out;
}

test('save: PackBits round-trips every kind of data', () => {
  const cases = {
    empty: new Uint8Array(0),
    one: Uint8Array.of(5),
    two: Uint8Array.of(5, 5),
    three: Uint8Array.of(5, 5, 5),
    zeros: new Uint8Array(65536),
    random: noise(70000),
    // Run lengths around the 128-byte limits of both kinds of run.
    runs: Uint8Array.from({ length: 5000 }, (_, i) => Math.floor(i / 127) % 3),
    longRuns: Uint8Array.from({ length: 5000 }, (_, i) => (i < 129 ? 1 : i < 258 ? 2 : i < 390 ? 3 : 4)),
    // Short runs of 2 between literals (not worth a repeat) and exact 128s.
    pairs: Uint8Array.from({ length: 999 }, (_, i) => Math.floor(i / 2) % 7),
    mixed: (() => {
      const a = noise(4096, 3);
      a.fill(9, 1000, 2500);
      a.fill(0, 3000, 3003);
      return a;
    })(),
  };
  for (const [name, src] of Object.entries(cases)) {
    const back = unpackBits(packBits(src), src.length);
    assert.deepEqual(Array.from(back), Array.from(src), name);
  }
  assert.ok(packBits(cases.zeros).length <= 1024, `zeros pack to ${packBits(cases.zeros).length} bytes`);
  assert.ok(packBits(cases.random).length < cases.random.length * 1.01, 'random data grows under 1%');
});

test('save: layers use "pb:" only when it helps, and decode either way', () => {
  const flat = new Uint8Array(4096);
  const rough = noise(4096);
  assert.ok(encodeLayer(flat).startsWith('pb:'));
  assert.ok(!encodeLayer(rough).startsWith('pb:'), 'random data stays plain base64');
  assert.deepEqual(Array.from(decodeLayer(encodeLayer(flat), 4096)), Array.from(flat));
  assert.deepEqual(Array.from(decodeLayer(encodeLayer(rough), 4096)), Array.from(rough));
  // Older saves: plain base64, no prefix.
  assert.deepEqual(Array.from(decodeLayer(encodeBytes(rough), 4096)), Array.from(rough));
});

test('save: corrupt compressed layers fail with a readable error', () => {
  const good = packBits(new Uint8Array(1000));
  assert.throws(() => unpackBits(good.slice(0, good.length - 2), 1000), /Corrupt map layer/, 'truncated');
  assert.throws(() => unpackBits(good, 999), /Corrupt map layer/, 'too long');
  assert.throws(() => unpackBits(good, 1001), /Corrupt map layer/, 'too short');
  assert.throws(() => unpackBits(Uint8Array.of(5, 1, 2), 6), /Corrupt map layer/, 'literal runs past the data');
  assert.throws(() => decodeLayer(42, 10), /not a string/);
});

test('save: paths pack to 16-bit values and come back the same', () => {
  const path = [0, 1, 255, 256, 257, 4096, 65535, 12345];
  const packed = encodePath(path);
  assert.ok(packed.startsWith('u16:'));
  assert.deepEqual(decodePath(packed), path);
  assert.equal(encodePath(null), null);
  assert.equal(decodePath(null), null);
  assert.deepEqual(decodePath(encodePath([])), []);
  // Older saves stored arrays; values that don't fit stay a plain array.
  assert.deepEqual(decodePath([3, 4, 5]), [3, 4, 5]);
  assert.deepEqual(encodePath([1, -1, 70000]), [1, -1, 70000]);
  assert.throws(() => decodePath('garbage'), /Corrupt path/);
});

test('save: saves from before the 20-level housing ladder are refused with a readable message', () => {
  const game = newGame({ seed: 'old-save' });
  buildDemoCity(game, { level: 1 });
  game.runDays(16);
  const data = JSON.parse(JSON.stringify(serializeGame(game)));
  assert.equal(data.version, CONFIG.SAVE_VERSION);
  assert.equal(MIN_SAVE_VERSION, 4);
  for (const v of [1, 2, 3]) {
    data.version = v;
    assert.throws(() => deserializeGame(data), /older version of Colonia \(save v\d\) and cannot be loaded/, `version ${v}`);
  }
});

test('save: plain base64 layers and array paths still load', () => {
  const game = newGame({ seed: 'old-save' });
  buildDemoCity(game, { level: 1 });
  game.runDays(16 * 2);
  const data = JSON.parse(JSON.stringify(serializeGame(game)));
  assert.equal(data.version, CONFIG.SAVE_VERSION);
  // Rewrite layers and paths the unpacked way (both forms stay readable).
  for (const name of LAYERS) data.map[name] = encodeBytes(decodeLayer(data.map[name], game.map.size));
  for (const w of data.walkers) w.path = decodePath(w.path);
  assert.ok(LAYERS.every((name) => !data.map[name].startsWith('pb:')));
  assert.ok(data.walkers.some((w) => Array.isArray(w.path) && w.path.length > 1), 'some walkers mid-path');
  const copy = deserializeGame(data);
  for (const name of LAYERS) assert.deepEqual(Array.from(copy.map[name]), Array.from(game.map[name]), name);
  assert.equal(copy.buildings.size, game.buildings.size);
  for (const w of game.walkers.values()) assert.deepEqual(copy.walkers.get(w.id).path, w.path ? Array.from(w.path) : null);
  copy.runDays(16);
});

test('save: an Uber city saves small and loads back the same', () => {
  const game = newGame({ size: MAP_SIZES.uber, seed: 'uber-save', money: 90000 });
  assert.equal(game.map.w, 256);
  const res = buildDemoCity(game, { level: 2 });
  assert.ok(res.ok, res.reason);
  game.runDays(16 * 3);
  const text = JSON.stringify(serializeGame(game));
  // Uncompressed, the seven layers alone were about 600 KB of base64.
  assert.ok(text.length < 300 * 1024, `save is ${Math.round(text.length / 1024)} KB`);
  const copy = deserializeGame(JSON.parse(text));
  for (const name of LAYERS) assert.deepEqual(Array.from(copy.map[name]), Array.from(game.map[name]), name);
  assert.equal(copy.buildings.size, game.buildings.size);
  assert.equal(copy.walkers.size, game.walkers.size);
  for (const w of game.walkers.values()) assert.deepEqual(copy.walkers.get(w.id).path, w.path ? Array.from(w.path) : null, `walker ${w.id} path`);
  assert.equal(copy.time.totalTicks, game.time.totalTicks);
  // Saved and loaded, the city carries on exactly as the original does.
  game.runDays(16);
  copy.runDays(16);
  assert.equal(copy.city.population, game.city.population);
  assert.equal(Math.round(copy.city.treasury), Math.round(game.city.treasury));
});

test('save: base64 helpers round-trip large arrays', () => {
  const big = noise(200000, 11); // bigger than the 32 KB chunk used to build the string
  assert.deepEqual(Array.from(decodeBytes(encodeBytes(big))), Array.from(big));
});

test('save files are named after the slot, the city and the year', () => {
  assert.equal(saveFileName({ slot: 'slot1', city: 'Aquae Clarae', year: -279 }), 'colonia-slot1-aquae-clarae-279bc.json');
  assert.equal(saveFileName({ city: 'Aquae Clarae', year: -279 }), 'colonia-aquae-clarae-279bc.json', 'the game being played: no slot');
  assert.equal(saveFileName({ slot: 'quick', city: 'Nova  Roma!', year: 12 }), 'colonia-quick-nova-roma-12ad.json');
  assert.equal(saveFileName({ slot: 'slot2' }), 'colonia-slot2.json', 'a damaged save: just its slot');
  assert.equal(saveFileName({}), 'colonia-colonia.json');
});

test('save: a version 22 save (before events, peoples, wolves, low bridges and native villages) loads with none of them', async () => {
  const { CONFIG } = await import('../src/config.js');
  assert.ok(CONFIG.SAVE_VERSION >= 23);
  const { newGame: fresh } = await import('./helpers.mjs');
  const { serializeGame: ser, deserializeGame: des } = await import('../src/core/save.js');
  const game = fresh({ seed: 'v22' });
  game.runDays(3);
  const data = JSON.parse(JSON.stringify(ser(game)));
  data.version = 22;
  delete data.map.bridgeLow;
  delete data.city.natives;
  delete data.city.events;
  delete data.city.romeWage;
  delete data.wildlife;
  delete data.military.people;
  const back = des(data);
  assert.equal(back.map.hasLowBridge(), false);
  assert.equal(back.city.natives, null);
  assert.ok(back.city.events, 'events state filled in');
  assert.ok(back.city.romeWage > 0, 'Rome pays its base wage');
  assert.deepEqual(back.wildlife.packs, []);
  back.runDays(3); // (and plays on)
});

test('a save keeps the desirability the running game had, and whether it was due a new pass', () => {
  // Found reviewing v0.11.0: the game works desirability out only when the
  // map changes, a load did a fresh pass, and the two could differ.
  const game = newGame({ seed: 'des-save' });
  assert.ok(buildDemoCity(game, { level: 2 }).ok);
  game.runDays(40);
  game.dirty.des = false;
  game.map.desirability[game.map.idx(5, 5)] = 77; // as the running game has it, whatever a fresh pass would say
  const copy = deserializeGame(JSON.parse(JSON.stringify(serializeGame(game))));
  assert.deepEqual(Array.from(copy.map.desirability), Array.from(game.map.desirability));
  assert.equal(copy.dirty.des, false);
  // An older save without the layer gets the fresh pass, as before.
  const old = JSON.parse(JSON.stringify(serializeGame(game)));
  delete old.desirability;
  assert.notEqual(deserializeGame(old).map.desirability[game.map.idx(5, 5)], 77);
});

test('save: missiles in flight survive a save, and a save from before v34 loads with none', () => {
  const game = newGame({ seed: 'arrows' });
  const arrow = { x: 12.5, y: 9, z: 38, target: 7, damage: 11, speed: 0.45, kind: 'arrow', life: 60 };
  game.projectiles.push({ ...arrow });
  const data = JSON.parse(JSON.stringify(serializeGame(game)));
  assert.deepEqual(data.projectiles, [arrow]);
  const back = deserializeGame(data);
  assert.deepEqual(back.projectiles, [arrow]);
  assert.notEqual(back.projectiles[0], data.projectiles[0], 'a copy, not the save\'s own record');
  const old = { ...data, version: 33 };
  delete old.projectiles;
  assert.deepEqual(deserializeGame(old).projectiles, []);
  const junk = { ...data, projectiles: [null, 'x', { x: 1 }, arrow] };
  assert.deepEqual(deserializeGame(junk).projectiles, [arrow], 'a hand-edited file keeps only whole records');
});

/** The saved state without the wall-clock stamp, as one string to compare. */
function stateText(game) {
  const d = serializeGame(game);
  delete d.meta.savedAt;
  return JSON.stringify(d);
}

test('save: derived caches stay out of the file (v35)', () => {
  const game = newGame();
  assert.ok(buildDemoCity(game, { level: 2 }).ok);
  game.runDays(16 * 6);
  assert.ok([...game.buildings.values()].some((b) => b.house && b.house.levels), 'the run left a cache to strip');
  for (const b of serializeGame(game).buildings) {
    assert.equal(b.post, undefined, 'fort post');
    assert.equal(b.postRev, undefined, 'fort postRev');
    if (b.house) { assert.equal(b.house.levels, undefined, 'house levels'); assert.equal(b.house.blocked, null, 'house blocked'); }
  }
});

test('save: a game saved mid-run plays on exactly as the unsaved one', () => {
  const game = newGame({ seed: 'roundtrip-hash' });
  assert.ok(buildDemoCity(game, { level: 2 }).ok);
  game.runDays(16 * 8 + 5);
  const copy = deserializeGame(JSON.parse(JSON.stringify(serializeGame(game))));
  assert.equal(stateText(copy), stateText(game), 'the same the moment it loads');
  for (let i = 0; i < 500; i++) { game.tick(); copy.tick(); }
  assert.equal(stateText(copy), stateText(game), 'the same 500 ticks on');
});

test('save: a home missing keys and a store missing a good load with defaults and tick clean', () => {
  const game = newGame();
  assert.ok(buildDemoCity(game, { level: 2 }).ok);
  game.runDays(16 * 2);
  const data = JSON.parse(JSON.stringify(serializeGame(game)));
  const home = data.buildings.find((b) => b.house && b.house.pop > 0);
  const market = data.buildings.find((b) => b.type === 'market');
  assert.ok(home && market);
  delete home.house.ent.theater;
  delete home.house.ent.colosseum;
  delete home.house.religion;
  delete home.house.goods.pottery;
  const good = Object.keys(market.stock)[0];
  delete market.stock[good];
  delete market.incoming[good];
  const copy = deserializeGame(data);
  const h = copy.buildings.get(home.id).house;
  assert.equal(h.ent.theater, 0);
  assert.equal(h.ent.colosseum, 0);
  assert.equal(typeof h.religion, 'object');
  assert.equal(h.goods.pottery, 0);
  assert.equal(copy.buildings.get(market.id).stock[good], 0);
  assert.equal(copy.buildings.get(market.id).incoming[good], 0);
  copy.runDays(16 * 2);
  for (const b of copy.buildings.values()) {
    if (b.house) for (const k of ['theater', 'amphitheater', 'colosseum', 'hippodrome']) assert.ok(Number.isFinite(b.house.ent[k]), `ent.${k}`);
    for (const v of Object.values(b.stock || {})) assert.ok(Number.isFinite(v), `stock of ${b.type}`);
  }
  assert.ok(Number.isFinite(copy.city.treasury));
});
