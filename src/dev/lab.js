/**
 * lab.js
 * ----------------------------------------------------------------------------
 * The look lab: one building, the public well, in its street, drawn with
 * the 3D look (render3d/look.js, materials.js, models/), to set and judge
 * the bar for the game's 3D art before it goes into the game.
 *
 * Built into one self-contained page: node scripts/build.mjs --lab --out <file>
 *
 * Views: the game's own camera (orthographic at the 2D art's angle) at the
 * game's closest zoom and twice that, turned by quarter turns (Q / E), or a
 * free orbit (drag, pinch, wheel). Moods: day, golden hour, night, winter.
 * A stats line: frames per second, the frame's draw calls and triangles
 * (every pass: shadows, AO, scene, post) and the well's own budget.
 *
 * For tests and measurement, window.__lab: ready (a promise), setMood(name),
 * setView(name), setTurn(t), orbit(azimuth, elevation, distance), stats(),
 * bench(frames) (ms per frame, waiting for the GPU), wells100(on).
 * ----------------------------------------------------------------------------
 */

import {
  Vector3, PerspectiveCamera, OrthographicCamera, InstancedMesh, Matrix4, Group,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createLook, gameCamera, MOODS } from '../render3d/look.js';
import { surfaceTextures, LOOK, waterMaterial, iceMaterial } from '../render3d/materials.js';
import { SURFACES } from '../render3d/surfaces.js';
import { buildWell, wellLife, WELL } from '../render3d/models/well.js';
import { buildStreet } from '../render3d/models/street.js';
import { buildFigure } from '../render3d/models/figure.js';

/** The game's closest zoom (config.js ZOOM_LEVELS' last). */
const GAME_ZOOM = 2;

const VIEWS = {
  game1: { label: 'Game zoom', zoom: GAME_ZOOM, key: 'G' },
  game2: { label: 'Zoom x2', zoom: GAME_ZOOM * 2, key: 'Z' },
  orbit: { label: 'Orbit', key: 'O' },
};

const INFO = `
<button class="close" type="button" aria-label="Close">Close</button>
<h2>The well and its street</h2>
<p>A street well as found at Pompeii, Herculaneum and Ostia, fitted to one game tile (4 m). The <b>puteal</b>, the curb round the mouth,
is a waist-high limestone drum 1.2 m across with a moulded foot (plinth, torus, cove) and lip (ovolo), its shaft carved with S-shaped
flutes (strigils) as on many puteals and sarcophagi, and rope grooves worn into the lip's inner edge. It stands on two steps of
travertine. A timber frame carries a wooden pulley (<i>trochlea</i>) on an iron axle; the rope runs up from a bronze bucket
(<i>situla</i>: rolled rim, bail handle, a dent) over the pulley to a turn round the post and a coil on the step. Beside it a trough
of four slabs is held by iron cramps, as the basins of Pompeii's street fountains are.</p>
<p>The street is Pompeii's: polygonal basalt blocks with two cart ruts, a pavement 30 cm high of cocciopesto (lime with crushed tile)
set with white tesserae behind a tufa kerb, and a plastered house front with a red dado, a limestone door frame, a timber lintel,
eaves of tegulae and imbrices, and a torch by the door. The figures are 1.7 m tall.</p>
<p>Sources: general knowledge of the excavated sites and of Roman building practice (puteals in the Naples and Ostia collections,
Pompeii's streets and fountains). Everything here is made in code: geometry, textures and light; no outside art.</p>
<h3>How it is drawn</h3>
<ul>
<li>Physically based materials on procedural textures (colour, normal, roughness, occlusion), made at start-up.</li>
<li>Sky light from a physical sky model with warm light bounced from the ground, a sun with soft shadow maps, filmic (ACES) tone mapping.</li>
<li>Screen-space ambient occlusion (GTAO) on the sky's light, bloom on flames, a colour grade, MSAA and SMAA.</li>
<li>Winter: snow settles by the surface's facing, thicker in nooks; the water freezes.</li>
</ul>
<h3>Controls</h3>
<ul>
<li>1 to 4: day, golden hour, night, winter. Q / E: turn the view a quarter.</li>
<li>G: the game's camera at its closest zoom; Z: twice that; O: free orbit (drag, pinch or wheel).</li>
<li>B: 100 wells (instanced), to measure. I: this panel.</li>
</ul>`;

/** Wait for the next animation frame (lets the loading bar paint between surfaces). */
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

function el(tag, attrs = {}, html = '') {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
}

async function main() {
  const app = document.getElementById('app');
  const canvas = el('canvas', { id: 'view' });
  app.appendChild(canvas);
  const loading = el('div', { class: 'loading' }, '<div class="msg">Making the stone, the wood and the bronze...</div><div class="track"><div class="fill"></div></div>');
  app.appendChild(loading);
  if (!document.createElement('canvas').getContext('webgl2')) {
    loading.querySelector('.msg').textContent = 'This page needs WebGL 2, which this browser does not offer.';
    return;
  }

  // A phone makes its textures at half size: a quarter of the start-up time.
  try {
    if (window.matchMedia('(pointer: coarse)').matches) LOOK.textureScale = 0.5;
  } catch {
    // No media queries: keep full size.
  }
  // Textures first, one surface a frame, so the bar moves.
  const names = Object.keys(SURFACES);
  const fill = loading.querySelector('.fill');
  const t0 = performance.now();
  for (let i = 0; i < names.length; i++) {
    surfaceTextures(names[i]);
    fill.style.width = `${Math.round(((i + 1) / names.length) * 100)}%`;
    await nextFrame();
  }
  const texMs = performance.now() - t0;

  const pr = Math.min(window.devicePixelRatio || 1, 2);
  const look = createLook(canvas, { pixelRatio: pr, shadowBox: 9.5, shadowMap: 4096 });
  const { scene } = look;

  const well = buildWell();
  scene.add(well.group);
  const street = buildStreet();
  scene.add(street.group);
  // Two figures for scale: a man at the well reaching for the rope, a woman by the door.
  const man = buildFigure({ cloth: 0xc4b596, reach: 0.9 });
  man.position.set(-0.95, WELL.stepH * 2, 0.95);
  man.rotation.y = Math.PI * 0.78;
  scene.add(man);
  const woman = buildFigure({ cloth: 0x8a4434, cloth2: 0xb08a4e, long: true, skin: 0xb08664, hair: 0x221812 });
  woman.position.set(3.7, 0.3, -5.25);
  woman.rotation.y = -0.5;
  scene.add(woman);

  // Lamps: lit at night, flickering.
  const torchFlame = street.flame;
  look.noAO.push(torchFlame, ...well.water, well.pane);
  look.lamps.push({
    on: 0,
    set(k) {
      this.on = k;
      well.lamp.intensity = k * 2.2;
      // A lamp that is out casts no shadow: its six shadow views a frame are the dearest thing here.
      well.lamp.castShadow = k > 0;
      street.torch.castShadow = k > 0;
      well.paneMat.emissiveIntensity = k * 2.5;
      street.torch.intensity = k * 4;
      torchFlame.visible = k > 0;
    },
  });

  // Water and ice.
  const waters = well.water;
  const setIce = (ice) => {
    for (const w of waters) w.material = ice ? iceMaterial() : waterMaterial();
  };

  // Cameras.
  const ortho = new OrthographicCamera();
  const persp = new PerspectiveCamera(32, 1, 0.1, 200);
  persp.position.set(6.5, 4.2, 7.5);
  const controls = new OrbitControls(persp, canvas);
  controls.target.set(0, 0.9, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 1.2;
  controls.maxDistance = 40;
  controls.enabled = false;

  const state = { mood: 'day', view: 'game1', turn: 0 };
  // The world fades out past the 3 x 3 tile patch (6 m from the middle) into the backdrop.
  LOOK.uniforms.uLookFade.value.set(0, 0, 7, 10.5);
  const target = new Vector3(0, 0.4, 0);

  // UI.
  const hud = el('div', { class: 'hud' }, '<h1>Colonia Look Lab</h1><div class="stats"></div>');
  app.appendChild(hud);
  const statsEl = hud.querySelector('.stats');
  const info = el('div', { class: 'info', role: 'dialog', 'aria-label': 'About the well' }, INFO);
  app.appendChild(info);
  info.querySelector('.close').addEventListener('click', () => info.classList.remove('open'));
  const bar = el('div', { class: 'bar' });
  app.appendChild(bar);
  const group = (items) => {
    const g = el('div', { class: 'group' });
    bar.appendChild(g);
    return items.map(([label, key, fn]) => {
      const b = el('button', { type: 'button' }, `${label}${key ? `<kbd>${key}</kbd>` : ''}`);
      b.addEventListener('click', fn);
      g.appendChild(b);
      return b;
    });
  };
  const moodBtns = group(Object.entries(MOODS).map(([k, m], i) => [m.label, String(i + 1), () => setMood(k)]));
  const viewBtns = group(Object.entries(VIEWS).map(([k, v]) => [v.label, v.key, () => setView(k)]));
  group([['Turn left', 'Q', () => setTurn(state.turn - 1)], ['Turn right', 'E', () => setTurn(state.turn + 1)]]);
  group([['About', 'I', () => info.classList.toggle('open')]]);

  function refreshButtons() {
    Object.keys(MOODS).forEach((k, i) => moodBtns[i].setAttribute('aria-pressed', String(k === state.mood)));
    Object.keys(VIEWS).forEach((k, i) => viewBtns[i].setAttribute('aria-pressed', String(k === state.view)));
  }

  function aim() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (state.view === 'orbit') {
      persp.aspect = w / h;
      persp.updateProjectionMatrix();
    } else {
      gameCamera(ortho, { width: w, height: h, zoom: VIEWS[state.view].zoom, turn: state.turn, target });
    }
  }

  function setMood(name) {
    state.mood = name;
    look.setMood(name);
    setIce(MOODS[name].ice);
    refreshButtons();
  }
  function setView(name) {
    state.view = name;
    controls.enabled = name === 'orbit';
    look.setCamera(name === 'orbit' ? persp : ortho);
    aim();
    refreshButtons();
  }
  function setTurn(t) {
    state.turn = ((t % 4) + 4) % 4;
    look.setTurn(state.turn);
    aim();
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    look.resize(w, h);
    aim();
  }
  window.addEventListener('resize', resize);

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const moods = Object.keys(MOODS);
    if (k >= '1' && k <= String(moods.length)) setMood(moods[Number(k) - 1]);
    else if (k === 'q') setTurn(state.turn - 1);
    else if (k === 'e') setTurn(state.turn + 1);
    else if (k === 'g') setView('game1');
    else if (k === 'z') setView('game2');
    else if (k === 'o') setView('orbit');
    else if (k === 'i') info.classList.toggle('open');
    else if (k === 'b') wells100(!copies.visible);
  });

  // 100 wells, instanced: one InstancedMesh per mesh of the well, on a 10 x 10 grid of tiles north of the street.
  const copies = new Group();
  copies.visible = false;
  scene.add(copies);
  let copiesBuilt = false;
  function wells100(on) {
    if (on && !copiesBuilt) {
      copiesBuilt = true;
      well.group.updateMatrixWorld(true);
      const off = new Matrix4();
      const m = new Matrix4();
      for (const mesh of well.meshes) {
        const im = new InstancedMesh(mesh.geometry, mesh.material, 100);
        for (let i = 0; i < 100; i++) {
          off.makeTranslation(-18 + (i % 10) * 4, 0, -10 - Math.floor(i / 10) * 4);
          m.multiplyMatrices(off, mesh.matrixWorld);
          im.setMatrixAt(i, m);
        }
        im.castShadow = mesh.castShadow;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        copies.add(im);
      }
    }
    copies.visible = !!on;
  }

  // Stats.
  const wellDraws = well.meshes.length;
  let frames = 0;
  let acc = 0;
  let cpu = 0;
  let fps = 0;
  function stats() {
    const r = look.renderer.info.render;
    return {
      fps, cpuMs: cpu, calls: r.calls, triangles: r.triangles, wellTriangles: well.triangles, wellDraws,
      streetTriangles: street.triangles, textureMs: Math.round(texMs), pixelRatio: pr, mood: state.mood, view: state.view, turn: state.turn,
    };
  }
  function showStats() {
    const s = stats();
    statsEl.textContent = `${s.fps.toFixed(0)} fps  cpu ${s.cpuMs.toFixed(1)} ms  frame: ${s.calls} draws, ${(s.triangles / 1000).toFixed(0)}k tris\n`
      + `well: ${wellDraws} meshes, ${(well.triangles / 1000).toFixed(1)}k tris  textures ${s.textureMs} ms`;
  }

  // The loop.
  let last = performance.now();
  const clockStart = last;
  function life(now) {
    const t = (now - clockStart) / 1000;
    LOOK.uniforms.uLookTime.value = t;
    // The water's ripples drift; the bucket and rope swing a little.
    const wm = waterMaterial();
    wm.normalMap.offset.set(t * 0.012, t * 0.007);
    wellLife(well, t);
    // Flames flicker: two incommensurate waves and a fast jitter.
    const lit = look.lamps[0].on;
    if (lit) {
      const f = 0.86 + 0.08 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.1 + 1.3) + 0.03 * Math.sin(t * 29.7);
      street.torch.intensity = 4 * lit * f;
      well.lamp.intensity = 2.2 * lit * (0.95 + 0.05 * Math.sin(t * 9.1));
      torchFlame.scale.set(1 + 0.08 * Math.sin(t * 11), f * 1.05, 1 + 0.08 * Math.cos(t * 9));
    }
    if (controls.enabled) controls.update();
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    life(now);
    const c0 = performance.now();
    look.render(dt);
    cpu = cpu * 0.9 + (performance.now() - c0) * 0.1;
    frames++;
    acc += dt;
    if (acc >= 0.5) {
      fps = frames / acc;
      frames = 0;
      acc = 0;
      showStats();
    }
    requestAnimationFrame(frame);
  }

  setView('game1');
  setMood('day');
  resize();
  loading.classList.add('done');
  // Compile every program before the first frame shows (no hitch on the first mood change).
  look.renderer.compile(scene, ortho);
  requestAnimationFrame(frame);

  /** Draw `n` frames back to back, waiting for the GPU after each: the true cost of a frame. */
  function bench(n = 60) {
    const gl = look.renderer.getContext();
    const px = new Uint8Array(4);
    look.render(0);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t = performance.now();
    for (let i = 0; i < n; i++) {
      life(performance.now());
      look.render(0);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    return (performance.now() - t) / n;
  }

  window.__lab = {
    ready: Promise.resolve(true),
    setMood, setView, setTurn, stats, bench, wells100,
    orbit(az, el, dist, ty = 0.9, tx = 0, tz = 0) {
      setView('orbit');
      const a = (az * Math.PI) / 180;
      const e = (el * Math.PI) / 180;
      controls.target.set(tx, ty, tz);
      persp.position.set(tx + Math.sin(a) * Math.cos(e) * dist, ty + Math.sin(e) * dist, tz + Math.cos(a) * Math.cos(e) * dist);
      controls.update();
    },
    look,
  };
}

window.__labStart = main().catch((err) => {
  const msg = document.createElement('pre');
  msg.style.cssText = 'position:fixed;inset:16px;color:#f88;white-space:pre-wrap;font:12px monospace';
  msg.textContent = `The look lab failed to start:\n${err && err.stack ? err.stack : err}`;
  document.body.appendChild(msg);
  throw err;
});
