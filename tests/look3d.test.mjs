/**
 * look3d.test.mjs - headless tests for the 3D look (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * The look lab (src/dev/lab.js) is judged by eye; these hold what the eye
 * cannot check every time:
 *   - the CPU's noise (the models' shapes) tiles; a read-back height field
 *     samples as the GPU's texture does (the textures themselves are
 *     painted on the GPU: texpaint.test.mjs, and the smoke test's lab)
 *   - turned geometry closes its seam; blocks of a course are not alike
 *   - the new well fits its tile, stands on the street, keeps its budget
 *   - the game camera draws a tile as many px as the 2D art does, and the
 *     sun keeps its place on the screen as the view turns
 *   - the lab builds into one page with nothing to fetch
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Box3, Vector3, OrthographicCamera } from 'three';
import { gnoise, fbm, Field } from '../src/render3d/texgen.js';
import { revolve, profileOf, block } from '../src/render3d/shapes.js';
import { LOOK } from '../src/render3d/materials.js';
import { buildWell, WELL } from '../src/render3d/models/well.js';
import { buildFountain, FOUNTAIN } from '../src/render3d/models/fountain.js';
import { gameCamera, sunDirection, MOODS, TILE_M } from '../src/render3d/look.js';
import { BACK } from '../src/render3d/projection.js';
import { HALF_W, HALF_H } from '../src/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Small textures: the tests check structure, not sharpness, and stay fast.
LOOK.textureScale = 0.125;

test('look3d: the noise tiles across its period; a read-back height samples between pixels and wraps', () => {
  for (const [x, y] of [[0.3, 0.7], [2.9, 0.1], [5.5, 3.25]]) {
    assert.ok(Math.abs(gnoise(x, y, 6, 4, 9) - gnoise(x + 6, y - 4, 6, 4, 9)) < 1e-9);
  }
  for (const [u, v] of [[0.01, 0.5], [0.37, 0.99], [0.8, 0.02]]) {
    assert.ok(Math.abs(fbm(u, v, 5, 4, 3) - fbm(u + 1, v - 1, 5, 4, 3)) < 1e-9, 'fbm repeats every texture');
  }
  // A 4 x 4 height: pixel centres at (x + 0.5) / 4, as on the GPU; halfway between two pixels, their mean.
  const f = Field.wrap(4, new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]));
  assert.equal(f.sample(0.125, 0.125), 0);
  assert.equal(f.sample(0.25, 0.125), 0.5);
  assert.equal(f.sample(0.125, 0.25), 2);
  assert.equal(f.sample(0, 0.125), 1.5, 'wraps: halfway between the last pixel and the first');
});

test('look3d: a revolved shape has no seam; blocks of a course differ', () => {
  const g = revolve(profileOf([[0.5, 0], [0.5, 0.4], { arc: [0.45, 0.4, 0.05, 0, Math.PI / 2], n: 4 }, [0, 0.45]]), { segments: 24 });
  const P = 8;
  const n = g.attributes.normal;
  const p = g.attributes.position;
  for (let i = 0; i < P; i++) {
    const a = i;
    const b = 24 * P + i;
    assert.ok(Math.abs(p.getX(a) - p.getX(b)) < 1e-9 && Math.abs(p.getZ(a) - p.getZ(b)) < 1e-9, 'the last ring is the first');
    assert.ok(Math.abs(n.getX(a) - n.getX(b)) + Math.abs(n.getY(a) - n.getY(b)) + Math.abs(n.getZ(a) - n.getZ(b)) < 1e-6, 'same normal both sides of the seam');
  }
  const b1 = block(0.6, 0.15, 0.4, { seed: 1, wobble: 0.01 });
  const b2 = block(0.6, 0.15, 0.4, { seed: 2, wobble: 0.01 });
  const box = new Box3().setFromBufferAttribute(b1.attributes.position);
  assert.ok(Math.abs(box.min.y) < 0.02, 'a block stands on y = 0');
  let diff = 0;
  for (let i = 0; i < b1.attributes.position.count; i++) diff += Math.abs(b1.attributes.position.getY(i) - b2.attributes.position.getY(i));
  assert.ok(diff > 0.01, 'two seeds make two different stones');
});

test('look3d: the well fits its tile, stands on the street and keeps its budget', () => {
  const well = buildWell();
  well.group.updateMatrixWorld(true);
  const box = new Box3().setFromObject(well.group);
  const half = WELL.tile / 2;
  assert.ok(box.min.x >= -half && box.max.x <= half && box.min.z >= -half && box.max.z <= half, `inside its 4 m tile: ${JSON.stringify(box)}`);
  // The shaft goes down to the water; above ground it stands on the street.
  const above = new Box3();
  for (const m of well.meshes) {
    if (m.name === 'well-water' || m.name === 'puteal') continue;
    above.union(new Box3().setFromObject(m));
  }
  assert.ok(Math.abs(above.min.y) < 0.02, `the platform sits on the street (min y ${above.min.y})`);
  assert.ok(above.max.y > 2.4 && above.max.y < 2.8, 'the frame stands about 2.6 m: a head over a walker');
  const puteal = new Box3().setFromObject(well.group.getObjectByName('puteal'));
  assert.ok(Math.abs(puteal.max.y - (WELL.stepH * 2 + WELL.putealH)) < 0.02, 'the curb is waist high on its steps');
  assert.ok(puteal.max.x > 0.6 && puteal.max.x < 0.7, 'the curb is about 1.2 m across');
  assert.ok(well.triangles < 70000, `triangles ${well.triangles}`);
  assert.ok(well.meshes.length <= 16, `draw calls ${well.meshes.length}`);
});

test('look3d: the fountain\'s four looks fit their tile, rise in finery and keep their budgets at each level of detail', () => {
  const budget = [[16000, 6000, 1500], [16000, 6000, 1500], [32000, 12000, 2500], [48000, 22000, 5000]];
  let last = 0;
  for (let tier = 1; tier <= FOUNTAIN.tiers; tier++) {
    for (let lod = 0; lod < 3; lod++) {
      const f = buildFountain({ tier, lod });
      f.group.updateMatrixWorld(true);
      const box = new Box3().setFromObject(f.group);
      const half = FOUNTAIN.tile / 2;
      assert.ok(box.min.x >= -half && box.max.x <= half && box.min.z >= -half && box.max.z <= half, `tier ${tier} lod ${lod} inside its 4 m tile`);
      assert.ok(f.triangles < budget[tier - 1][lod], `tier ${tier} lod ${lod}: ${f.triangles} triangles`);
      assert.ok(f.meshes.length <= 20, `tier ${tier} lod ${lod}: ${f.meshes.length} draw calls`);
      // The water stands a little under the rim, the spout above it.
      assert.ok(f.spout.y > f.waterY + 0.15, `tier ${tier}: the stream falls into the tank`);
    }
    // Each look is a bigger piece of work than the one before (more stone, more carving).
    const t = buildFountain({ tier, lod: 0 }).triangles;
    assert.ok(t > last, `tier ${tier} is finer than tier ${tier - 1}`);
    last = t;
  }
});

test('look3d: the game camera draws a tile as the 2D art does, and the sun keeps its place on the screen', () => {
  const cam = new OrthographicCamera();
  const W = 1600;
  const H = 900;
  for (const zoom of [2, 4]) {
    gameCamera(cam, { width: W, height: H, zoom, turn: 0 });
    const px = (x, y, z) => {
      const p = new Vector3(x, y, z).project(cam);
      return [((p.x + 1) / 2) * W, ((1 - p.y) / 2) * H];
    };
    const [x0, y0] = px(0, 0, 0);
    const [x1, y1] = px(TILE_M, 0, 0); // one tile along +x (+u)
    const [x2, y2] = px(0, 0, TILE_M); // one tile along +z (+v)
    assert.ok(Math.abs(x1 - x0 - HALF_W * zoom) < 1e-6 && Math.abs(y1 - y0 - HALF_H * zoom) < 1e-6, '+u goes right and down');
    assert.ok(Math.abs(x2 - x0 + HALF_W * zoom) < 1e-6 && Math.abs(y2 - y0 - HALF_H * zoom) < 1e-6, '+v goes left and down');
  }
  // Turning the view turns camera and sun together.
  for (const mood of Object.keys(MOODS)) {
    const d0 = sunDirection(MOODS[mood], 0);
    for (let t = 1; t < 4; t++) {
      gameCamera(cam, { width: W, height: H, zoom: 2, turn: t });
      const back = cam.position.clone().normalize();
      const d = sunDirection(MOODS[mood], t);
      const base = new Vector3(...BACK);
      assert.ok(Math.abs(d.dot(back) - d0.dot(base)) < 1e-9, `${mood} at turn ${t}`);
    }
  }
});

test('look3d: the lab builds into one page with nothing to fetch', () => {
  const out = path.join(os.tmpdir(), `colonia-lab-test-${process.pid}.html`);
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs'), '--lab', '--out', out], { stdio: 'pipe' });
  const html = fs.readFileSync(out, 'utf8');
  fs.unlinkSync(out);
  assert.match(html, /<title>Colonia Look Lab<\/title>/);
  assert.match(html, /<meta name="viewport"/);
  assert.doesNotMatch(html, /<script[^>]+src=/, 'no outside scripts');
  assert.doesNotMatch(html, /<link[^>]+href=/, 'no outside stylesheets or fonts');
  assert.ok(!html.includes('<!--LAB_SCRIPT-->'), 'the bundle went in');
  assert.ok(html.length > 300000 && html.length < 3000000, `size ${html.length}`);
});
