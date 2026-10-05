/**
 * texpaint.test.mjs - how the procedural textures are painted (node:test)
 * ----------------------------------------------------------------------------
 * Run:  npm test
 *
 * The textures are painted on the GPU (render3d/paint/): their pixels are
 * checked in a browser (the smoke test's look lab: every texture in the
 * range of a real material, the ground's layers tiling with their height in
 * the alpha, all painted again after a lost context). Here, headless:
 *   - every recipe packs: its noises fit the table, a warp reads a noise
 *     listed before it, blurs are whole px; the GLSL names them
 *   - the painter: four recipes a program (eight for the 28, and one for
 *     the passes they share), a texture's passes in order, never reading
 *     what a pass draws into (WebGL refuses a feedback loop), an array's
 *     mipmaps made once at its last layer, forgotten targets left alone, a
 *     restored context painted again
 *   - the materials: textures at their final size, sRGB albedo, mipmaps; one
 *     program key; plain materials with the maps painted ones have; water
 *     and ice with the same features
 *   - the checks the browser runs on the bytes (texReport.js)
 * ----------------------------------------------------------------------------
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SRGBColorSpace, LinearMipmapLinearFilter, RepeatWrapping, UnsignedByteType, FloatType, MeshPhysicalMaterial,
} from 'three';

import { SURFACES, SURFACE_SET, surfaceSize, nameSeed } from '../src/render3d/surfaces.js';
import { GROUND_LAYERS, GROUND_SET, GROUND_SIZE } from '../src/render3d/ground/groundSurfaces.js';
import { packRecipe, recipeShader, packNoises, fbm, cells } from '../src/render3d/paint/recipe.js';
import { MAX_NOISES, glf, rgb } from '../src/render3d/paint/glsl.js';
import { Painter, RECIPES_A_PROGRAM, surfaceTargets, arrayTargets } from '../src/render3d/paint/painter.js';
import { LOOK, material, surfaceTextures, waterMaterial, iceMaterial, shallowWaterMaterial } from '../src/render3d/materials.js';
import { mapStats, seamless } from '../src/dev/texReport.js';

const ALL = [...Object.entries(SURFACES), ...GROUND_LAYERS.map((l) => [l.name, l])];

test('recipes: every texture\'s noises fit the table, warps read noises listed before them, blurs are whole px', () => {
  for (const [name, r] of ALL) {
    const p = packRecipe(r);
    assert.ok(p.fields.count <= MAX_NOISES && p.colour.count <= MAX_NOISES, name);
    assert.equal(p.blur.length, 4, name);
    assert.ok(p.normal.depth > 0, `${name}: a normal map's depth`);
    assert.match(r.fields.glsl, /return vec4/, `${name}: the fields stage returns its four numbers`);
    assert.match(r.colour.glsl, /col\b/, name);
    assert.match(r.colour.glsl, /orm\b/, name);
  }
  assert.throws(() => packNoises({ a: fbm(3, 3, 0, { warp: { u: ['b', 0.1] } }), b: fbm(3, 3, 1) }), /listed before/);
  assert.throws(() => packNoises(Object.fromEntries(Array.from({ length: MAX_NOISES + 1 }, (z, i) => [`n${i}`, fbm(2, 1, i)]))), /Too many/);
  // A warped cell layout packs its warp's entry, scale and offset.
  const t = packNoises({ wu: fbm(3, 3, 1), wv: fbm(3, 3, 2), c: cells(9, 0, 1, { warp: { u: ['wu', 0.09, -0.5], v: ['wv', 0.09, -0.5] } }) });
  assert.deepEqual([...t.c.slice(8, 12)].map((x) => +x.toFixed(4)), [0, 0.09, -0.5, 1]);
  assert.deepEqual([...t.d.slice(8, 10)].map((x) => +x.toFixed(4)), [0.09, -0.5]);
  assert.match(t.decl, /Cell c = cellOf\( 2 \);/);
});

test('recipes: a program\'s GLSL holds each of its recipes and names their noises', () => {
  const src = recipeShader(GROUND_LAYERS.slice(0, 4));
  for (let i = 0; i < 4; i++) {
    assert.match(src, new RegExp(`vec4 fields${i}\\(`));
    assert.match(src, new RegExp(`case ${i}: colour${i}\\(`));
  }
  assert.ok(!/fields4\(/.test(src));
  assert.match(src, /float bareN = nv\[0\]\.x;/, 'the grass\'s first noise by its name');
  assert.equal(glf(1), '1.0');
  assert.equal(glf(0.25), '0.25');
  assert.equal(rgb('#ff8000'), 'vec3(1.000000, 0.501961, 0.000000)');
  // Seeds: a hash of the name, 32-bit.
  assert.equal(nameSeed('basalt'), nameSeed('basalt'));
  assert.ok(Number.isInteger(nameSeed('limestone')) && Math.abs(nameSeed('limestone')) < 2 ** 31);
});

/** A renderer that records what the painter draws (no WebGL in node). */
function fakeRenderer() {
  const draws = [];
  let target = null;
  let layer = 0;
  const listeners = {};
  const r = {
    draws,
    capabilities: { isWebGL2: true },
    extensions: { has: (e) => e === 'EXT_color_buffer_float' },
    domElement: { addEventListener: (k, fn) => { listeners[k] = fn; } },
    fire: (k) => listeners[k] && listeners[k](),
    autoClear: true,
    clippingPlanes: [],
    localClippingEnabled: false,
    compiled: 0,
    compileAsync: async () => { r.compiled++; },
    getRenderTarget: () => target,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    initRenderTarget: () => {},
    setRenderTarget: (t, l = 0) => { target = t; layer = l; },
    render: (mesh) => {
      const m = mesh.material;
      const u = m.uniforms;
      const bound = ['uF', 'uB', 'uRange', 'uSrc', 'uSrc2'].filter((k) => u[k]).map((k) => u[k].value);
      draws.push({
        target, layer, program: m.name, stage: u.uStage ? u.uStage.value : null, mode: u.uMode ? u.uMode.value : null,
        bound, mips: target && target.texture.generateMipmaps,
      });
    },
    readRenderTargetPixelsAsync: async (rt, x, y, w, h, buf) => { buf.fill(0.5); return buf; },
  };
  return r;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

test('painter: four recipes a program, the 28 in eight and one for the passes they share', async () => {
  const r = fakeRenderer();
  const p = new Painter(r);
  const jobs = [];
  for (const name of SURFACE_SET.names) {
    jobs.push(p.paint({ set: SURFACE_SET, index: SURFACE_SET.names.indexOf(name), seed: nameSeed(name), size: 32, out: surfaceTargets(32) }));
  }
  const out = arrayTargets(16, GROUND_LAYERS.length);
  GROUND_LAYERS.forEach((l, i) => jobs.push(p.paint({ set: GROUND_SET, index: i, seed: nameSeed(l.name), size: 16, out, layer: i, ground: true })));
  await Promise.all(jobs);
  assert.equal(RECIPES_A_PROGRAM, 4);
  assert.equal(p.programs.size, 8);
  assert.equal(p.stats.programs, 9);
  assert.equal(r.compiled, 1, 'compiled once, all together');
  assert.equal(p.stats.paints, 1, 'painted in one go');
  assert.equal(p.stats.textures, 28);
  assert.equal(new Set(r.draws.map((d) => d.program)).size, 9);
  // The renderer is left as it was found.
  assert.equal(r.getRenderTarget(), null);
  assert.equal(r.autoClear, true);
});

test('painter: a texture\'s passes in order, never reading what a pass draws into', async () => {
  const r = fakeRenderer();
  const p = new Painter(r);
  const out = surfaceTargets(32);
  const basalt = SURFACE_SET.names.indexOf('basalt');
  const job = await p.paint({ set: SURFACE_SET, index: basalt, seed: 1, size: 32, out, readHeight: true });
  const seq = r.draws.map((d) => (d.mode !== null ? `util${d.mode}` : `stage${d.stage}`));
  assert.deepEqual(seq, ['stage0', 'util0', 'util1', 'stage1', 'stage2', 'util4']);
  assert.equal(r.draws[3].target, out.albedo);
  assert.equal(r.draws[4].target, out.orm);
  assert.equal(r.draws[5].target, out.normal);
  for (const d of r.draws) assert.ok(!d.bound.includes(d.target.texture), `${d.program} reads what it draws into`);
  assert.equal(job.height.length, 32 * 32, 'the paving\'s height, read back');
  assert.ok(Math.abs(job.height[7] - 0.5) < 1e-6);
  // A ground layer adds its height's range; a recipe with no blur reads its fields as their blur.
  const r2 = fakeRenderer();
  const p2 = new Painter(r2);
  const arr = arrayTargets(32, GROUND_LAYERS.length);
  await p2.paint({ set: GROUND_SET, index: GROUND_SET.names.indexOf('sand'), seed: 2, size: 32, out: arr, layer: 5, ground: true });
  assert.deepEqual(r2.draws.map((d) => (d.mode !== null ? `util${d.mode}` : `stage${d.stage}`)), ['stage0', 'util2', 'util3', 'stage1', 'stage2', 'util4']);
  assert.ok(r2.draws.slice(3).every((d) => d.layer === 5), 'into its own layer');
  for (const d of r2.draws) assert.ok(!d.bound.includes(d.target.texture), `${d.program} reads what it draws into`);
  assert.equal(r2.draws[0].target.texture.type, FloatType, 'fields in float');
});

test('painter: an array\'s mipmaps are made once, at its last layer; forgotten targets are left alone; a restored context is painted again', async () => {
  const r = fakeRenderer();
  const p = new Painter(r);
  const out = arrayTargets(16, 3);
  const all = [0, 1, 2].map((i) => p.paint({ set: GROUND_SET, index: i, seed: i, size: 16, out, layer: i, ground: true }));
  await Promise.all(all);
  const into = r.draws.filter((d) => d.target === out.albedo);
  assert.deepEqual(into.map((d) => d.mips), [false, false, true]);
  assert.equal(out.albedo.texture.generateMipmaps, true);
  // A restored context: everything painted again.
  r.draws.length = 0;
  r.fire('webglcontextlost');
  r.fire('webglcontextrestored');
  await settle();
  await settle();
  assert.equal(r.draws.filter((d) => d.target === out.albedo).length, 3);
  // Forgotten: not painted after the next loss.
  p.forget(out);
  r.draws.length = 0;
  r.fire('webglcontextlost');
  r.fire('webglcontextrestored');
  await settle();
  await settle();
  assert.equal(r.draws.length, 0);
});

test('materials: a surface\'s textures are render targets at their final size: sRGB albedo, mipmaps, repeating every `metres`', () => {
  for (const name of Object.keys(SURFACES)) {
    const t = surfaceTextures(name);
    const size = surfaceSize(name, LOOK.textureScale);
    assert.equal(t.size, size);
    for (const k of ['albedo', 'normal', 'orm']) {
      const rt = t.out[k];
      assert.equal(rt.width, size);
      assert.equal(rt.texture.type, UnsignedByteType);
      assert.equal(rt.texture.minFilter, LinearMipmapLinearFilter);
      assert.equal(rt.texture.generateMipmaps, true);
      assert.equal(rt.texture.wrapS, RepeatWrapping);
      assert.equal(rt.depthBuffer, false);
    }
    assert.equal(t.map.colorSpace, SRGBColorSpace);
    assert.notEqual(t.normalMap.colorSpace, SRGBColorSpace);
    assert.ok(Math.abs(t.map.repeat.x - 1 / SURFACES[name].metres) < 1e-12);
  }
  // The well's water drifts its own copy of the ripples.
  assert.notEqual(surfaceTextures('ripples', 'water').normalMap, surfaceTextures('ripples').normalMap);
  const g = arrayTargets(GROUND_SIZE, GROUND_LAYERS.length);
  assert.equal(g.albedo.depth, GROUND_LAYERS.length);
  assert.equal(g.albedo.texture.colorSpace, SRGBColorSpace);
});

test('materials: one program key for every patched material; plain ones have the painted ones\' maps; water and ice the same features', () => {
  const stone = material('t-stone', { surface: 'tufa' });
  const plain = material('t-plain', { color: 0x333333, roughness: 0.6 });
  const grass = material('t-grass', { sway: 0.05, swayH: 1 });
  for (const m of [stone, plain, grass, waterMaterial(), iceMaterial()]) assert.equal(m.customProgramCacheKey(), 'look2');
  for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) assert.ok(plain[k] && stone[k], k);
  assert.equal(plain.vertexColors, stone.vertexColors);
  assert.equal(plain.side, stone.side);
  assert.deepEqual([...grass.userData.look.uLookSway.value.toArray()], [0.05, 1]);
  assert.deepEqual([...stone.userData.look.uLookSway.value.toArray()], [0, 1], 'no sway: a uniform, not a define');
  assert.ok(!stone.defines || !Object.keys(stone.defines).some((d) => /SWAY/.test(d)));
  // Water, the shallows and ice: physical, see-through, clear-coated (one program's features).
  const feats = (m) => [m instanceof MeshPhysicalMaterial, m.transparent, m.clearcoat > 0, !!m.normalMap, !!m.map, m.side];
  assert.deepEqual(feats(waterMaterial()), feats(iceMaterial()));
  assert.deepEqual(feats(shallowWaterMaterial()), feats(iceMaterial()));
  assert.ok(waterMaterial().clearcoat < 1e-3, 'the water\'s coat is too faint to see');
});

test('texture checks: the means, the alpha\'s span, a seam found where one is', () => {
  const n = 8;
  const fill = (f) => {
    const a = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) a.set(f(x, y), (y * n + x) * 4);
    return a;
  };
  const smooth = fill((x, y) => [100 + 10 * Math.round(4 * Math.sin((x / n) * 6.283)), 90, 80, 255 * ((x + y) % 2)]);
  const s = mapStats({ albedo: smooth, orm: fill(() => [255, 128, 0, 255]), normal: fill(() => [128, 128, 255, 255]) }, n);
  assert.ok(Math.abs(s.rough - 128 / 255) < 1e-9);
  assert.equal(s.flat, 255);
  assert.deepEqual(s.alpha, [0, 255]);
  assert.ok(s.lum > 0.08 && s.lum < 0.15);
  assert.equal(seamless(fill((x) => [x * 10, 0, 0, 255]), n), false, 'a ramp breaks at the wrap');
  assert.equal(seamless(fill((x) => [Math.abs(x - 4) * 10, 0, 0, 255]), n), true, 'a tent wraps');
});
