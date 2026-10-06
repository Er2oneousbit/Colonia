// The performance readout's numbers and the GPU's name (render/perf.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PerfMeter, isIntegratedGpu, isSoftwareGpu, perfLines, INTEGRATED_HINT, STAGES } from '../src/render/perf.js';

test('perf: a second of frames gives the fps, the mean interval, the slowest and each stage\'s mean', () => {
  const m = new PerfMeter();
  for (let i = 0; i < 48; i++) m.frame(0.02, 5, { sim: 1, collect: 2, draw: i % 2 ? 1 : 3, overlay: 0.5, ui: 0.5, gpu: null });
  // (Not yet a second: nothing published.)
  assert.equal(m.last.fps, 0);
  m.frame(0.04, 5, { sim: 1, collect: 2, draw: 2, overlay: 0.5, ui: 0.5 });
  const l = m.last;
  assert.equal(l.fps, Math.round(49 / 1));
  assert.ok(Math.abs(l.interval - (48 * 20 + 40) / 49) < 1e-6);
  assert.equal(l.slowest, 40);
  assert.equal(l.collect, 2);
  assert.ok(Math.abs(l.draw - 2) < 1e-9);
  // A stage that never ran (no GPU timer, no copy) is null, not 0.
  assert.equal(l.gpu, null);
  assert.equal(l.copy, null);
  assert.deepEqual(Object.keys(l).filter((k) => STAGES.includes(k)).sort(), [...STAGES].sort());
});

test('perf: the graphics chips in the processor are told apart from cards and software', () => {
  const integrated = [
    'ANGLE (Intel, Intel(R) UHD Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A0) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (AMD, AMD Radeon 780M Graphics (0x000015BF) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Qualcomm, Adreno (TM) X1-85, D3D11)',
  ];
  const cards = [
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU (0x000028E0) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (AMD, AMD Radeon RX 7600 (0x00007480) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    '',
  ];
  for (const n of integrated) assert.equal(isIntegratedGpu(n), true, n);
  assert.equal(isIntegratedGpu('Apple GPU'), true, 'Safari masks every Mac\'s GPU as Apple GPU');
  for (const n of cards) assert.equal(isIntegratedGpu(n), false, n);
  assert.equal(isSoftwareGpu('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'), true);
  assert.equal(isSoftwareGpu(cards[0]), false);
});

test('perf: the readout names the GPU, and with a chip in the processor says how to use the card', () => {
  const m = { fps: 31, interval: 32.2, slowest: 48, frame: 9, sim: 0.3, collect: 3, draw: 2, copy: null, overlay: 1, ui: 0.4, gpu: 25.5 };
  const base = { backend: 'webgl', size: '3200x1800', dpr: 2, scene: '3200x1800 (100%, ground 50%, Auto)', drawCalls: 40, gpuTimer: true, ground: 'low', models: 'ready' };
  const card = perfLines(m, { ...base, gpuName: 'NVIDIA GeForce RTX', integrated: false });
  assert.ok(card[0].startsWith('31 fps'));
  assert.ok(card.some((l) => /gpu 26 ms/.test(l)), card.join('\n'));
  assert.ok(card.some((l) => /3D scene 3200x1800/.test(l)));
  assert.ok(card.some((l) => l === 'GPU: NVIDIA GeForce RTX'));
  assert.ok(!card.includes(INTEGRATED_HINT));
  assert.ok(!card.some((l) => /copy/.test(l)), 'no copy stage when there was none');
  assert.ok(!card.some((l) => /^zoom/.test(l)), 'no zoom line unless told the zoom');
  const zoomed = perfLines(m, { ...base, zoom: '4x', sprites: '61.2 MB drawn at 6 px a world px' });
  assert.ok(zoomed.includes('zoom 4x  sprites 61.2 MB drawn at 6 px a world px'), zoomed.join(' | '));
  const uhd = perfLines(m, { ...base, gpuName: 'Intel(R) UHD Graphics', integrated: true, hint: true });
  assert.ok(uhd.includes(INTEGRATED_HINT));
  assert.match(INTEGRATED_HINT, /High performance/);
  const classic = perfLines({ ...m, gpu: null }, { backend: '2d', size: '1600x900', dpr: 1, gpuName: '' });
  assert.ok(classic.some((l) => /^Classic/.test(l)));
  assert.ok(!classic.some((l) => /^gpu/.test(l)));
});
