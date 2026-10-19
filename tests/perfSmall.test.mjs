/**
 * perfSmall.test.mjs - the small per-frame savings keep their results (node:test)
 * ----------------------------------------------------------------------------
 *   - the minimap redraws its 40,000 tiles only when something it shows changed
 *   - the walker view test (walkerMayShow) never rules out a walker the exact
 *     placement (walkerWorld + bridgeSpan) would draw in view
 *   - canvasRect reads the page once until told the canvas may have moved
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Minimap, shownSignature } from '../src/render/minimap.js';
import { walkerMayShow, walkerWorld, bridgeSpan } from '../src/render/renderer.js';
import { canvasRect, dropCanvasRect } from '../src/ui/canvasRect.js';
import { GameMap, Terrain, Road } from '../src/world/map.js';
import { newGame, build, findFree } from './helpers.mjs';
import { RNG } from '../src/core/rng.js';

test('minimap: the picture is rebuilt on a change (map edit, fire, house tier, turn), not on a quiet timer', () => {
  const ctx = () => new Proxy({}, {
    get: (o, k) => (k === 'createImageData' ? (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) : () => {}),
    set: () => true,
  });
  const had = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx() }) };
  try {
    const game = newGame({ seed: 'minimap-gate' });
    const cam = { turn: 0, viewRect: () => ({ x: 0, y: 0, w: 100, h: 100 }) };
    const mm = new Minimap({ width: 200, height: 100, getContext: () => ctx() });
    let t = 1000;
    const draw = (ms = 100) => { t += ms; mm.draw(game, cam, t); return mm.rebuilds; };
    assert.equal(draw(), 1, 'the first draw builds it');
    for (let i = 0; i < 40; i++) draw(100); // 4 s of quiet frames
    assert.equal(mm.rebuilds, 1, 'nothing changed: no rebuild');
    // A house changing tier (no map edit at all) shows within the signature check.
    const spot = findFree(game, 2, 2);
    build(game, 'house', spot.x, spot.y);
    const rev = game.map.revision;
    draw(10);
    assert.equal(mm.rebuilds, 2, 'a map edit rebuilds at once');
    assert.equal(game.map.revision, rev);
    const house = [...game.buildings.values()].find((b) => b.house);
    const before = shownSignature(game);
    house.house.tier = house.house.tier === 3 ? 4 : 3;
    assert.notEqual(shownSignature(game), before, 'the tier is in the signature');
    draw(600);
    assert.equal(mm.rebuilds, 3, 'a tier change shows by the next check');
    game.fires.set(game.map.idx(spot.x + 5, spot.y), 1);
    draw(600);
    assert.equal(mm.rebuilds, 4, 'a fire shows by the next check');
    cam.turn = 1;
    draw(10);
    assert.equal(mm.rebuilds, 5, 'turning the view rebuilds at once');
    draw(10500);
    assert.equal(mm.rebuilds, 6, 'the slow refresh still comes');
  } finally {
    globalThis.document = had;
  }
});

test('render: walkerMayShow never rules out a walker the exact placement would draw (bridges, every turn)', () => {
  const W = 40;
  const rng = new RNG('walker-bound');
  const next = () => rng.next();
  const maps = [];
  for (const low of [false, true]) {
    for (const axis of ['u', 'v']) {
      const map = new GameMap(W, W);
      map.terrain.fill(Terrain.GRASS);
      const pt = (k, j) => (axis === 'u' ? [k, j] : [j, k]);
      for (let k = 10; k < 16; k++) for (let j = 0; j < W; j++) map.terrain[map.idx(...pt(k, j))] = Terrain.WATER;
      for (let k = 9; k <= 16; k++) {
        const i = map.idx(...pt(k, 20));
        const bank = k === 9 || k === 16;
        map.road[i] = bank ? Road.ROAD : Road.BRIDGE;
        if (!bank && low) map.bridgeLow[i] = 1;
      }
      maps.push(map);
    }
  }
  let included = 0;
  let excluded = 0;
  for (let n = 0; n < 40000; n++) {
    const map = maps[n % maps.length];
    const x = Math.floor(next() * W);
    const y = Math.floor(next() * W);
    const dir = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(next() * 5)];
    const tx = Math.max(0, Math.min(W - 1, x + dir[0]));
    const ty = Math.max(0, Math.min(W - 1, y + dir[1]));
    const w = { x, y, tx, ty, moving: next() < 0.8, progress: next(), speed: 0.1 + next() * 0.4, kind: next() < 0.2 ? 'ship' : 'walker' };
    const turn = Math.floor(next() * 4);
    const alpha = next();
    // A view box a few tiles across, around a random spot near the bridge.
    const cx = (next() - 0.5) * W * 64;
    const cy = next() * W * 32;
    const bw = 20 + next() * 1400;
    const bh = 20 + next() * 800;
    const [x0, x1, y0, y1] = [cx - bw / 2, cx + bw / 2, cy - bh / 2, cy + bh / 2];
    const { fx, fy, wx, wy: ground } = walkerWorld(w, alpha, turn, W, W);
    const wy = ground - bridgeSpan(map, fx, fy, w.kind === 'ship', turn).lift;
    const exact = wx >= x0 && wx <= x1 && wy >= y0 && wy <= y1;
    const cheap = walkerMayShow(w, turn, W, W, x0, x1, y0, y1);
    if (exact) {
      included++;
      assert.ok(cheap, `walker ${JSON.stringify(w)} turn ${turn}: drawn, so the cheap test must keep it`);
    } else if (!cheap) excluded++;
  }
  assert.ok(included > 500 && excluded > 2000, `the property saw both sides (${included} in, ${excluded} cut early)`);
});

test('canvasRect: read once, again after a drop', () => {
  let reads = 0;
  const canvas = { getBoundingClientRect: () => ({ left: ++reads, top: 0, width: 10, height: 10 }) };
  assert.equal(canvasRect(canvas).left, 1);
  assert.equal(canvasRect(canvas).left, 1);
  assert.equal(reads, 1);
  dropCanvasRect(canvas);
  assert.equal(canvasRect(canvas).left, 2);
});
