/**
 * render3d.test.mjs - headless tests for the WebGL renderer's pure parts (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * WebGL itself is checked by the browser smoke test (?renderer=3d); these
 * cover what decides where things land:
 *   - the 3D camera (render3d/projection.js) puts every point on the device
 *     pixel the 2D camera does, at every zoom, view turn and scroll
 *   - depth: one measure for sprites and models, a model's points nearer
 *     the higher they are, a walker standing in front of a model in front
 *     of it at every height, ground behind whatever stands on it
 *   - the models (the lab's well and the fountain's four looks, at every
 *     level of detail) fit their footprint at every turn, turn as the art
 *     turns, rise out of the ground as a new sprite does; a kit keeps every
 *     triangle; a fountain's state shows the right parts
 *   - the fountain's look from its neighbourhood, and its hysteresis
 *   - the level of detail by the zoom
 *   - the shared sprite placement (render/items.js spriteRect): 1:1 at
 *     whole pixels, stretched strips meeting without gaps
 *   - the live-art boxes hold what the art paints
 *   - the sprite cache tells who listens which sprites it let go of
 *   - the URL flag
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { OrthographicCamera, Vector3, Box3 } from 'three';
import { HALF_W, HALF_H, CONFIG } from '../src/config.js';
import { Camera } from '../src/render/camera.js';
import { SpriteCache } from '../src/render/sprites.js';
import { spriteRect, K_WALKER, K_UNIT, K_FIRE, K_EXTRA } from '../src/render/items.js';
import { aimCamera, groundDepth, standDepth, depthOf, worldPxOf, ART_PX, KAPPA, TILE_LEN } from '../src/render3d/projection.js';
import { MODELS, hasModel, modelMatrix, partShows, fountainState, TILE_M } from '../src/render3d/models.js';
import { kitOf } from '../src/render3d/kit.js';
import { lodFor, LOD0_PX, LOD1_PX, ModelPass } from '../src/render3d/modelPass.js';
import { Group } from 'three';
import { fountainTier, tierOf, TIER_FLOORS, HYSTERESIS } from '../src/render3d/fountainTier.js';
import { triangles } from '../src/render3d/shapes.js';
import { heightFor } from '../src/render/buildingArt.js';
import { liveBox } from '../src/render3d/liveBox.js';
import { parseFlags } from '../src/core/debug.js';

/** A 2D camera over a W x H map at a zoom level, view turn and scroll. */
function cam2d(W, H, zoomIndex, turn, cx, cy, dpr = 1) {
  const cam = new Camera();
  cam.resize(1280, 760, dpr);
  cam.setMapBounds(W, H);
  cam.zoomIndex = zoomIndex;
  cam.setTurn(turn);
  cam.centerOnTile(cx, cy);
  return cam;
}

/** Device px of a 3D point through a three.js camera aimed by aimCamera. */
function devicePx(camera, cam, x, y, z) {
  const p = new Vector3(x, y, z).project(camera);
  return { x: ((p.x + 1) / 2) * cam.viewW, y: ((1 - p.y) / 2) * cam.viewH, z: p.z };
}

test('render3d: the 3D camera puts every point on the device pixel the 2D camera does (zooms, turns, scroll, dpr)', () => {
  const camera = new OrthographicCamera();
  for (const [zi, turn, dpr] of [[0, 0, 1], [2, 1, 1], [4, 2, 2], [1, 3, 2], [3, 0, 1.5]]) {
    const cam = cam2d(160, 120, zi, turn, 70, 40, dpr);
    aimCamera(camera, cam, -60, 400);
    for (const [u, v, zpx] of [[60, 30, 0], [72.5, 41.25, 0], [65, 38, 24], [80, 50, 90], [70, 40, -3]]) {
      const y = zpx * ART_PX;
      const got = devicePx(camera, cam, u, y, v);
      const [X, Y] = worldPxOf(u, y, v);
      const want = cam.toScreen(X, Y);
      assert.ok(Math.abs(got.x - want.x) < 1e-3 && Math.abs(got.y - want.y) < 1e-3, `zoom ${zi} turn ${turn} dpr ${dpr} (${u}, ${v}, ${zpx}px): ${JSON.stringify(got)} vs ${JSON.stringify(want)}`);
      // The art's own projection (draw.js P): X = (u - v) * HALF_W, Y = (u + v) * HALF_H - z.
      assert.ok(Math.abs(X - (u - v) * HALF_W) < 1e-9 && Math.abs(Y - ((u + v) * HALF_H - zpx)) < 1e-9);
    }
  }
});

test('render3d: depth is one measure for sprites and models (D = u + v, a little nearer the higher)', () => {
  const camera = new OrthographicCamera();
  const cam = cam2d(100, 100, 2, 0, 50, 50);
  aimCamera(camera, cam, -60, 260);
  // The depth buffer's z is linear in D, the same for two points of the same D.
  const zOf = (u, zpx, v) => devicePx(camera, cam, u, zpx * ART_PX, v).z;
  const zA = zOf(1, 0, 0) - zOf(0, 0, 0);
  for (const [u, zpx, v] of [[40, 0, 50], [55, 30, 35], [47, 96, 52]]) {
    const D = depthOf(u, zpx * ART_PX, v);
    assert.ok(Math.abs(zOf(u, zpx, v) - (zOf(0, 0, 0) + zA * D)) < 1e-5, `(${u}, ${zpx}px, ${v})`);
  }
  assert.ok(zA < 0, 'a bigger D is nearer (a smaller depth)');
  // 48 px of height for one tile of depth with the game's 64 x 32 tiles.
  assert.equal(KAPPA, HALF_H / (HALF_W * HALF_W - HALF_H * HALF_H));
  assert.ok(Math.abs(depthOf(10, 48 * ART_PX, 20) - 31) < 1e-9);
  // A ground point's D is its x + y; an upright cutout's D at its own ground line is its depth.
  assert.equal(groundDepth((12.5 + 7.25) * HALF_H), 19.75);
  assert.equal(standDepth(19.75, 19.75 * HALF_H), 19.75);
  // A cutout's pixel above its ground line is as deep as the point of an upright figure there.
  const [, Y] = worldPxOf(10, 30 * ART_PX, 9.75);
  assert.ok(Math.abs(standDepth(19.75, Y) - depthOf(10, 30 * ART_PX, 9.75)) < 1e-9);
  // TILE_LEN: world px along the screen per 3D unit (half a tile's diagonal across the screen).
  assert.ok(Math.abs(TILE_LEN - Math.hypot(HALF_W, HALF_W)) < 1e-9);
});

test('render3d: a walker in front of a tall model is in front at every height; one behind it is hidden', () => {
  // A 1 x 1 model at view tile (20, 20), 100 px tall: its front edge at u + v = 42.
  const pts = [];
  for (const [u, v] of [[20, 20], [21, 20], [20, 21], [21, 21], [20.5, 20.5]]) for (const zpx of [0, 40, 100]) pts.push([u, v, zpx]);
  // A walker drawn at depth d, his cutout's pixel at the same screen row as each model point.
  const ahead = 42.5; // standing just in front of the front corner
  const behind = 40.4; // just behind the back half
  for (const [u, v, zpx] of pts) {
    const [X, Y] = worldPxOf(u, zpx * ART_PX, v);
    const D = depthOf(u, zpx * ART_PX, v);
    // Only the model's points he could overlap on the screen matter: his feet are at the row of his depth.
    if (Y > ahead * HALF_H) continue;
    assert.ok(standDepth(ahead, Y) > D, `walker in front vs (${u}, ${v}, ${zpx}px): ${standDepth(ahead, Y)} <= ${D}, X ${X}`);
  }
  // Behind: hidden by the model's front and top (the parts nearer than he is).
  const front = depthOf(21, 30 * ART_PX, 21);
  const [, Yf] = worldPxOf(21, 30 * ART_PX, 21);
  assert.ok(standDepth(behind, Yf) < front, 'a walker behind the model is hidden by its front');
  // The ground under the model is behind its foot (the back end biases ground further back still).
  const [, Yfoot] = worldPxOf(21, 0, 21);
  assert.ok(groundDepth(Yfoot) <= depthOf(21, 0, 21) + 1e-9);
});

/** Every look a building can show, as the game asks for them (models.js MODELS[type].build). */
const LOOKS = [['well', 'well'], ['well', 'well:ice'], ...[1, 2, 3, 4].map((t) => ['fountain', `fountain:${t}`]), ['fountain', 'fountain:4:ice']];

test('render3d: every model fits its tile at every turn and level of detail, standing on the ground', () => {
  assert.ok(hasModel('well') && hasModel('fountain'));
  assert.ok(hasModel('house') && !hasModel('villa_of_nobody') && !hasModel('toString'), 'only types with a model (the houses have one, for the levels models/houses.js draws)');
  const S = 1;
  for (const [type, key] of LOOKS) {
    for (let lod = 0; lod < 3; lod++) {
      const g = MODELS[type].build(key, lod);
      g.updateMatrixWorld(true);
      const local = new Box3().setFromObject(g);
      for (let T = 0; T < 4; T++) {
        const m = modelMatrix(30, 12, S, T, 0);
        const b = local.clone().applyMatrix4(m);
        const e = 1e-6;
        assert.ok(b.min.x >= 30 - e && b.max.x <= 30 + S + e && b.min.z >= 12 - e && b.max.z <= 12 + S + e, `${key} lod ${lod} turn ${T}: ${JSON.stringify(b)}`);
        // (Only a pipe or a shaft goes under the street, which the game does not draw.)
        assert.ok(b.min.y > -0.5 && b.max.y < 0.75, `${key} lod ${lod}: from ${b.min.y} to ${b.max.y} tiles high`);
      }
    }
  }
});

test('render3d: a model turns as the art turns (u, v) -> (S - v, u) per quarter turn, and rises out of the ground', () => {
  // A point of the model 0.8 m toward +x and 1.2 m toward -z of its middle: (0.7, 0.2) of its tile at turn 0.
  const p0 = [0.8, 0, -1.2];
  const S = 1;
  const turnUV = (u, v, t) => [[u, v], [S - v, u], [S - u, S - v], [v, S - u]][t];
  for (let T = 0; T < 4; T++) {
    const p = new Vector3(...p0).applyMatrix4(modelMatrix(0, 0, S, T));
    const [u, v] = turnUV(0.5 + p0[0] / TILE_M, 0.5 + p0[2] / TILE_M, T);
    assert.ok(Math.abs(p.x - u) < 1e-9 && Math.abs(p.z - v) < 1e-9, `turn ${T}: (${p.x}, ${p.z}) vs (${u}, ${v})`);
  }
  // Rising out of the ground as a new sprite does (drawn `rise` px lower on the screen): it starts sunk.
  const top = new Vector3(0, 2, 0);
  const [, Y0] = worldPxOf(...new Vector3().copy(top).applyMatrix4(modelMatrix(30, 12, 1, 0, 0)).toArray());
  const [, Y1] = worldPxOf(...new Vector3().copy(top).applyMatrix4(modelMatrix(30, 12, 1, 0, 14)).toArray());
  assert.ok(Math.abs(Y1 - (Y0 + 14)) < 1e-9, `14 px lower on the screen: ${Y1 - Y0}`);
});

test('render3d: a kit keeps every triangle of its model, one part a material, RGB and RGBA colours apart', () => {
  for (const [type, key] of LOOKS.slice(0, 6)) {
    const g = MODELS[type].build(key, 1);
    let tris = 0;
    g.traverse((o) => { if (o.isMesh) tris += triangles(o.geometry); });
    const kit = kitOf(g);
    assert.equal(kit.triangles, tris, key);
    const seen = new Set();
    for (const p of kit.parts) {
      const k = `${p.material.uuid}|${p.when}|${p.cast}|${p.geometry.attributes.color.itemSize}`;
      assert.ok(!seen.has(k), `${key}: one part per material and state`);
      seen.add(k);
    }
    // See-through parts after the opaque (three draws them so anyway; the order within is the model's).
    const firstClear = kit.parts.findIndex((p) => p.material.transparent);
    assert.ok(firstClear < 0 || kit.parts.slice(firstClear).every((p) => p.material.transparent), key);
  }
});

test('render3d: a fountain shows its stream only running, its puddle only dry, icicles only running in a frost', () => {
  assert.equal(fountainState({ hasWater: true, efficiency: 0.5 }), 'flowing');
  assert.equal(fountainState({ hasWater: true, efficiency: 0 }), 'still');
  assert.equal(fountainState({ hasWater: false, efficiency: 1 }), 'dry');
  const show = (when, state, ice = false) => partShows(when, state, ice);
  for (const st of ['flowing', 'still', 'dry']) assert.ok(show('always', st));
  assert.ok(show('flow', 'flowing') && !show('flow', 'still') && !show('flow', 'dry'));
  assert.ok(show('full', 'flowing') && show('full', 'still') && !show('full', 'dry'));
  assert.ok(show('dry', 'dry') && !show('dry', 'flowing'));
  assert.ok(show('ice', 'flowing', true) && !show('ice', 'flowing', false) && !show('ice', 'dry', true));
  // The model's own parts carry those tags: a stream that runs, a puddle that stays.
  const g = MODELS.fountain.build('fountain:2', 0);
  const tags = new Set();
  g.traverse((o) => { if (o.isMesh) tags.add(`${o.name}:${o.userData.when}`); });
  for (const t of ['stream:flow', 'water:full', 'puddle:dry', 'icicles:ice', 'stone:always']) assert.ok(tags.has(t), t);
});

test('render3d: a fountain looks as fine as its neighbourhood, and only changes its look past a margin', () => {
  // The bands: below 8, 8 to 19, 20 to 36, 37 and up.
  assert.deepEqual([-40, 0, 7, 8, 19, 20, 36, 37, 100].map(tierOf), [1, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual(TIER_FLOORS, [8, 20, 37]);
  // A fountain seen for the first time takes its band.
  assert.equal(fountainTier(25, null), 3);
  // Up: past the band's floor by the margin, not before.
  assert.equal(fountainTier(20, 2), 2);
  assert.equal(fountainTier(20 + HYSTERESIS - 1, 2), 2);
  assert.equal(fountainTier(20 + HYSTERESIS, 2), 3);
  // Down: below its own floor by the margin.
  assert.equal(fountainTier(19, 3), 3);
  assert.equal(fountainTier(20 - HYSTERESIS, 3), 3);
  assert.equal(fountainTier(20 - HYSTERESIS - 1, 3), 2);
  // A big jump goes straight to where it lands.
  assert.equal(fountainTier(60, 1), 4);
  assert.equal(fountainTier(-10, 4), 1);
  // Wavering about an edge never flickers: from either side it holds its look.
  for (const start of [2, 3]) {
    let t = start;
    for (const d of [18, 21, 19, 22, 20, 18, 22, 19]) {
      t = fountainTier(d, t);
      assert.equal(t, start, `held at ${start} through ${d}`);
    }
  }
});

test('render3d: instanced parts keep their draw order as they grow, and a new city forgets the fountains\' tiers', () => {
  const rig = { modelSlot: new Group(), ghostSlot: new Group(), groundSlot: new Group() };
  const mp = new ModelPass(null, rig);
  const k = mp.kitFor('fountain:1', 1);
  const order = () => rig.modelSlot.children.map((im) => im.userData.part);
  const before = order();
  // (Three's sorting is off: the water must stay under the rings and foam, kit.js.)
  const i = k.meshes.findIndex((im) => im.userData.part.when === 'full');
  mp.grow(k, i, 50);
  assert.deepEqual(order(), before, 'the grown part keeps its place');
  assert.ok(k.meshes[i].instanceMatrix.count >= 50);
  // Tiers are kept by building id: a new map (a new game, a load) starts afresh.
  const map = (d) => ({ desirability: [d], idx: () => 0 });
  const r = (m) => ({ game: { map: m }, weather: {}, time: 0 });
  mp.update(r(map(45)), [], 1);
  assert.equal(mp.fountainTier({ id: 7, x: 0, y: 0 }), 4);
  mp.update(r(map(30)), [], 1);
  assert.equal(mp.fountainTier({ id: 7, x: 0, y: 0 }), 3, 'not the old city\'s nymphaeum');
  mp.dispose();
});

test('render3d: the level of detail follows the size of a tile on the screen', () => {
  // Device px per world px: the game's zoom times the device's pixel ratio.
  assert.equal(lodFor(LOD0_PX / CONFIG.TILE_W), 0);
  assert.equal(lodFor((LOD0_PX - 1) / CONFIG.TILE_W), 1);
  assert.equal(lodFor(LOD1_PX / CONFIG.TILE_W), 1);
  assert.equal(lodFor((LOD1_PX - 1) / CONFIG.TILE_W), 2);
  // The game's closest zoom on a high-density screen shows the full models; its farthest on a plain one the simplest.
  assert.equal(lodFor(2 * 2), 0);
  assert.equal(lodFor(0.5), 2);
  let last = 0;
  for (let k = 4; k > 0.2; k -= 0.05) {
    assert.ok(lodFor(k) >= last, 'never finer zoomed out');
    last = lodFor(k);
  }
  // Each level is lighter than the one before it.
  for (const [type, key] of LOOKS) {
    const t = [0, 1, 2].map((l) => kitOf(MODELS[type].build(key, l)).triangles);
    assert.ok(t[0] > t[1] && t[1] > t[2], `${key}: ${t}`);
  }
});

test('render3d: sprites land on whole pixels 1:1, and stretched strips meet without gaps or overlaps', () => {
  const cam = { x: -123.37, y: 45.81, scale: 1.5 };
  const spr = { w: 193, h: 160, ax: 96, ay: 112, s: 1.5 };
  const full = { ...spriteRect(spr, 300.25, 140.5, cam) };
  assert.ok(full.exact && Number.isInteger(full.dx) && Number.isInteger(full.dy) && full.dw === spr.w && full.dh === spr.h);
  // The strips of an exact sprite tile its width.
  let x = full.dx;
  for (let j = 0; j < 6; j++) {
    const r = { ...spriteRect(spr, 300.25, 140.5, cam, j, 6) };
    assert.equal(r.dx, x, `strip ${j} starts where the last ended`);
    assert.equal(r.dw, r.sw);
    x += r.dw;
  }
  assert.equal(x, full.dx + spr.w);
  // Stretched (a zoom still easing): whole-pixel strips that meet exactly.
  const ease = { ...cam, scale: 1.73 };
  let end = null;
  for (let j = 0; j < 6; j++) {
    const r = spriteRect(spr, 300.25, 140.5, ease, j, 6);
    if (!r) continue;
    assert.ok(!r.exact && Number.isInteger(r.dx) && Number.isInteger(r.dw));
    if (end !== null) assert.equal(r.dx, end, `stretched strip ${j} meets the last`);
    end = r.dx + r.dw;
  }
});

test('render3d: live-art boxes hold what the art paints (measured reaches, at any zoom)', () => {
  // Reaches measured by drawing the art at zoom 1 (liveBox.js header): a box must hold them.
  const measured = [
    [{ kind: K_WALKER, w: { type: 'cart' } }, [-31, -19, 31, 6]],
    [{ kind: K_WALKER, w: { type: 'ship' } }, [-26, -46, 26, 7]],
    [{ kind: K_WALKER, w: { type: 'protester' } }, [-9, -29, 9, 6]],
    [{ kind: K_WALKER, w: { type: 'caravan' } }, [-17, -19, 17, 6]],
    [{ kind: K_UNIT, u: { type: 'elephant' } }, [-16, -28, 16, 4]],
    [{ kind: K_UNIT, u: { type: 'liburnian' } }, [-32, -8, 32, 10]],
    [{ kind: K_FIRE }, [-29, -38, 29, 15]],
    [{ kind: K_EXTRA, race: {} }, [-17, -18, 17, 2]],
  ];
  for (const k of [0.5, 1, 3]) {
    const cam = { x: 100, y: 200, scale: k, dpr: 1 };
    for (const [it, e] of measured) {
      const item = { ...it, wx: 400, wy: 500 };
      const b = liveBox(item, cam);
      const sx = (400 - 100) * k;
      const sy = (500 - 200) * k;
      assert.ok(b[0] <= sx + e[0] * k && b[1] <= sy + e[1] * k && b[2] >= sx + e[2] * k && b[3] >= sy + e[3] * k, `${JSON.stringify(it)} at zoom ${k}: ${b}`);
    }
  }
  // A building's live details stay within its sprite's box (with room for flags).
  const b = { type: 'senate', size: 4 };
  const box = liveBox({ kind: K_EXTRA, b, wx: 0, wy: 0, flags: [] }, { x: 0, y: 0, scale: 1, dpr: 1 });
  assert.ok(box[1] <= -heightFor('senate', 4) && box[0] <= -4 * HALF_W && box[2] >= 4 * HALF_W && box[3] >= 4 * CONFIG.TILE_H);
});

test('render3d: the sprite cache tells onDrop of every sprite it lets go (zoom levels, looks, a cleared cache)', () => {
  const realDoc = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) }) };
  try {
    const c = new SpriteCache();
    const dropped = [];
    c.onDrop = (spr) => dropped.push(spr);
    const spec = () => ({ w: 4, h: 4, ax: 2, ay: 2, draw() {} });
    c.beginFrame(1);
    const a = c.get('g1~spring', spec);
    const b = c.get('g2~spring', spec);
    c.get('k1', spec);
    c.invalidateWhere((key) => key.endsWith('~spring'));
    assert.deepEqual(dropped, [a, b]);
    c.beginFrame(2);
    const x = c.get('k1', spec);
    c.beginFrame(3); // a third zoom level: the emptier of the other two goes
    assert.equal(dropped.length, 3);
    c.invalidate('k');
    assert.ok(dropped.includes(x));
    c.get('z', spec);
    const n = dropped.length;
    c.clear();
    assert.equal(dropped.length, n + 1);
  } finally {
    globalThis.document = realDoc;
  }
});

test('render3d: ?renderer=3d asks for WebGL, ?renderer=2d for Classic, nothing for what Settings say', () => {
  assert.equal(parseFlags({ renderer: '3d' }).renderer, 'webgl');
  assert.equal(parseFlags({ renderer: 'webgl' }).renderer, 'webgl');
  assert.equal(parseFlags({ renderer: '2d' }).renderer, 'classic');
  assert.equal(parseFlags({ renderer: 'vulkan' }).renderer, null);
  assert.equal(parseFlags({}).renderer, null);
});
