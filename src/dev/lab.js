/**
 * lab.js
 * ----------------------------------------------------------------------------
 * The look lab: one building, the public well, in its street, drawn with
 * the 3D look (render3d/look.js, materials.js, models/), to set and judge
 * the bar for the game's 3D art before it goes into the game; and the
 * Ground scene (labGround.js): every kind of the game's 3D ground side by
 * side, drawn by the game's own ground material (render3d/ground/), with
 * its seasons, snow and rain.
 *
 * Built into one self-contained page: node scripts/build.mjs --lab --out <file>
 *
 * Views: the game's own camera (orthographic at the 2D art's angle) at the
 * game's closest zoom and twice that, turned by quarter turns (Q / E), or a
 * free orbit (drag, pinch, wheel). Moods: day, golden hour, night, winter.
 * A stats line: frames per second, the frame's draw calls and triangles
 * (every pass: shadows, AO, scene, post), the well's own budget, and how
 * long the first frame and the textures took. The scene draws before its
 * textures are painted (render3d/paint/: stand-ins first, then the painted
 * maps from the browser's cache or the paint pool's workers).
 *
 * For tests and measurement, window.__lab: ready (a promise), timings
 * (firstFrame, wellReady, groundReady), clearTextures(), setMood(name),
 * setView(name), setTurn(t), orbit(azimuth, elevation, distance), stats(),
 * bench(frames) (ms per frame, waiting for the GPU), wells100(on),
 * setScene('well'|'ground'), setSeason(name), setSnow(0..3), setWet(on),
 * aimAt(x, z).
 * ----------------------------------------------------------------------------
 */

import {
  Vector3, PerspectiveCamera, OrthographicCamera, InstancedMesh, Matrix4, Group,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createLook, gameCamera, MOODS } from '../render3d/look.js';
import {
  surfaceTextures, surfacesReady, surfacesCount, LOOK, waterMaterial, iceMaterial,
} from '../render3d/materials.js';
import { SURFACES } from '../render3d/surfaces.js';
import { buildWell, wellLife, WELL } from '../render3d/models/well.js';
import { buildStreet } from '../render3d/models/street.js';
import { buildFigure } from '../render3d/models/figure.js';
import { groundTextures, liveGroundArrays } from '../render3d/ground/groundTextures.js';
import { GROUND_LAYERS } from '../render3d/ground/groundSurfaces.js';
import { paintPool } from '../render3d/paint/pool.js';
import { cacheStats, clearCache, pruneCache } from '../render3d/paint/cache.js';
import { buildGroundScene } from './labGround.js';

/** The game's closest zoom (config.js ZOOM_LEVELS' last). */
const GAME_ZOOM = 2;

const VIEWS = {
  wide: { label: 'Mid zoom', zoom: GAME_ZOOM / 2, key: 'M' },
  game1: { label: 'Game zoom', zoom: GAME_ZOOM, key: 'G' },
  game2: { label: 'Zoom x2', zoom: GAME_ZOOM * 2, key: 'Z' },
  orbit: { label: 'Orbit', key: 'O' },
};

/** The Ground scene's seasons: a position along the 2D art's looks (weather.js MONTH_LOOK; ground.js seasonAt). */
const SEASONS = { spring: { label: 'Spring', pos: 1 }, summer: { label: 'Summer', pos: 2 }, autumn: { label: 'Autumn', pos: 3 }, winter: { label: 'Winter', pos: 0 } };
/** Snow levels as the game's console sets them (ui/console.js snow): the weather's cover. */
const SNOW_COVER = [0, 0.28, 0.62, 0.95];

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

const GROUND_INFO = `
<button class="close" type="button" aria-label="Close">Close</button>
<h2>The ground</h2>
<p>Every kind of ground on the game's maps, side by side on a patch of 24 by 24 tiles, drawn by the same material as the game's
WebGL renderer: <b>pasture</b> (short grazed grass, bare earth between), <b>meadow</b> (the fertile land farms need: lush, combed by
the wind, with flowers), <b>scrub</b> (the garrigue of dry grass far from water: pale stony soil and cushions of thyme and kermes oak),
<b>forest floor</b> (leaf litter, twigs, moss), bare <b>limestone</b>, <b>dune sand</b>, a <b>beach</b> by the sea, a farm's ploughed
<b>soil</b>, and under the water a river's silt or the sea's sand.</p>
<p>What people laid on it: an ordinary road is gravel rammed into the earth (a <i>via glareata</i>, the provinces' common road), with
wheel ruts on a straight run; a town's streets are paved with polygonal basalt between limestone kerbs, as Pompeii's and the Via Appia were (in the game, a road with a building beside it); a
forum's plaza is travertine flagstones in courses; a fallen house leaves rubble of stone, roof tile and ash.</p>
<p>Water deepens from its edge, from the bed seen through clear shallows to a river's green-blue or the sea's blue, with drifting
ripples, the sky in it and foam lapping at the shore. Where two kinds meet, the higher one's bumps win, so the edges wander.</p>
<h3>Controls</h3>
<ul>
<li>W: the well and its street; R: the ground. 1 to 4: day, golden hour, night, winter.</li>
<li>Spring, summer, autumn, winter: the season's colour on what grows. N: snow lying (none to deep). T: rain (wet ground, puddles).</li>
<li>M: the game's middle zoom, G: its closest, Z: twice that, O: orbit. Q / E: turn the view.</li>
</ul>`;

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
  const loading = el('div', { class: 'loading' }, '<div class="msg">Lighting the street...</div>');
  app.appendChild(loading);
  if (!document.createElement('canvas').getContext('webgl2')) {
    loading.querySelector('.msg').textContent = 'This page needs WebGL 2, which this browser does not offer.';
    return;
  }
  // The scene draws at once: every material on its stand-in (its average
  // colour), the painted textures going in as they come, from the browser's
  // cache or the paint pool's workers (render3d/paint/). A thin bar along
  // the top fills as they come.
  const t0 = performance.now();
  const timings = { start: t0, firstFrame: 0, wellReady: 0, groundReady: 0 };
  const paintBar = el('div', { class: 'paintbar' });
  app.appendChild(paintBar);

  const pr = Math.min(window.devicePixelRatio || 1, 2);
  const look = createLook(canvas, { pixelRatio: pr, shadowBox: 9.5, shadowMap: 4096 });
  const { scene } = look;
  // The ground's layers start first (the well's surfaces are asked for as its meshes are made).
  const groundSrc = groundTextures();
  for (const name of Object.keys(SURFACES)) surfaceTextures(name);

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
    for (const w of waters) {
      w.userData.liquid ??= w.material; // each its own water (the trough's is shallow and clear)
      w.material = ice ? iceMaterial() : w.userData.liquid;
    }
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

  // The Ground scene: every kind of the game's 3D ground on one patch.
  const tex = liveGroundArrays(groundSrc, LOOK.anisotropy);
  // On the GPU now (stand-ins and what has come), so each layer that comes later uploads alone.
  for (let k = 0; k < 3; k++) tex.upload(look.renderer, k);
  // A lost context lost them: whole again (three listens first, so its new context is up by now).
  canvas.addEventListener('webglcontextrestored', () => {
    tex.lost();
    for (let k = 0; k < 3; k++) tex.upload(look.renderer, k);
  });
  const gs = buildGroundScene(tex, 'high');
  const groundGroup = gs.ground.group;
  groundGroup.visible = false;
  scene.add(groundGroup);

  const state = { scene: 'well', mood: 'day', view: 'game1', turn: 0, season: 'summer', snow: 0, wet: false };
  const target = new Vector3(0, 0.4, 0);
  /** Where the world fades into the backdrop: past the well's 3 x 3 tile patch, or the ground's 24 x 24. */
  function setFade() {
    if (state.scene === 'well') LOOK.uniforms.uLookFade.value.set(0, 0, 7, 10.5);
    else LOOK.uniforms.uLookFade.value.set(-2, -2, 42, 48);
  }
  setFade();

  // UI.
  const hud = el('div', { class: 'hud' }, '<h1>Colonia Look Lab</h1><div class="stats"></div>');
  app.appendChild(hud);
  const statsEl = hud.querySelector('.stats');
  const info = el('div', { class: 'info', role: 'dialog', 'aria-label': 'About this scene' }, INFO);
  app.appendChild(info);
  const fillInfo = () => {
    info.innerHTML = state.scene === 'well' ? INFO : GROUND_INFO;
    info.querySelector('.close').addEventListener('click', () => info.classList.remove('open'));
  };
  fillInfo();
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
  const sceneBtns = group([['Well', 'W', () => setScene('well')], ['Ground', 'R', () => setScene('ground')]]);
  const moodBtns = group(Object.entries(MOODS).map(([k, m], i) => [m.label, String(i + 1), () => setMood(k)]));
  const viewBtns = group(Object.entries(VIEWS).map(([k, v]) => [v.label, v.key, () => setView(k)]));
  group([['Turn left', 'Q', () => setTurn(state.turn - 1)], ['Turn right', 'E', () => setTurn(state.turn + 1)]]);
  // The Ground scene's own controls: the season, the snow lying, rain.
  const seasonBtns = group(Object.entries(SEASONS).map(([k, v]) => [v.label, '', () => setSeason(k)]));
  const snowBtns = group(SNOW_COVER.map((c, i) => [i ? `Snow ${i}` : 'No snow', i ? '' : 'N', () => setSnow(i)]));
  const wetBtns = group([['Rain', 'T', () => setWet(!state.wet)]]);
  const groundBars = [seasonBtns, snowBtns, wetBtns].map((b) => b[0].parentElement);
  group([['About', 'I', () => info.classList.toggle('open')]]);

  function refreshButtons() {
    ['well', 'ground'].forEach((k, i) => sceneBtns[i].setAttribute('aria-pressed', String(k === state.scene)));
    Object.keys(MOODS).forEach((k, i) => moodBtns[i].setAttribute('aria-pressed', String(k === state.mood)));
    Object.keys(VIEWS).forEach((k, i) => viewBtns[i].setAttribute('aria-pressed', String(k === state.view)));
    Object.keys(SEASONS).forEach((k, i) => seasonBtns[i].setAttribute('aria-pressed', String(k === state.season)));
    snowBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.snow)));
    wetBtns[0].setAttribute('aria-pressed', String(state.wet));
    for (const g of groundBars) g.style.display = state.scene === 'ground' ? '' : 'none';
  }

  /** The ground's season and weather, and the well's snow with it in the Ground scene. */
  function applyGround() {
    const snow = gs.groundSnow(SNOW_COVER[state.snow]);
    gs.ground.setSky({ season: SEASONS[state.season].pos, snow, wet: state.wet ? 1 : 0, rain: state.wet ? 1 : 0, time: LOOK.uniforms.uLookTime.value });
    const m = MOODS[state.mood];
    gs.ground.setReflection(m.water, m.waterRefl, m.lamps ? 0 : m.sun.elev < 15 ? 0.6 : 1);
    if (state.scene === 'ground') {
      LOOK.uniforms.uLookSnow.value = Math.max(m.snow, snow);
      LOOK.uniforms.uLookWet.value = Math.max(m.wet, state.wet ? 1 : 0);
    } else {
      LOOK.uniforms.uLookSnow.value = m.snow;
      LOOK.uniforms.uLookWet.value = m.wet;
    }
  }
  function setScene(name) {
    state.scene = name;
    const g = name === 'ground';
    street.group.visible = !g;
    woman.visible = !g;
    man.visible = !g;
    groundGroup.visible = g;
    setFade();
    fillInfo();
    applyGround();
    refreshButtons();
  }
  function setSeason(k) {
    state.season = k;
    applyGround();
    refreshButtons();
  }
  function setSnow(i) {
    state.snow = i;
    applyGround();
    refreshButtons();
  }
  function setWet(on) {
    state.wet = on;
    applyGround();
    refreshButtons();
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
    // Into winter, the ground takes the winter's season and snow (they can be changed after).
    if (name === 'winter' && state.mood !== 'winter') {
      state.season = 'winter';
      state.snow = 3;
      state.wet = false;
    } else if (name !== 'winter' && state.mood === 'winter') {
      state.season = 'summer';
      state.snow = 0;
    }
    state.mood = name;
    look.setMood(name);
    setIce(MOODS[name].ice);
    applyGround();
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
    else if (k === 'm') setView('wide');
    else if (k === 'w') setScene('well');
    else if (k === 'r') setScene('ground');
    else if (k === 'n') setSnow((state.snow + 1) % SNOW_COVER.length);
    else if (k === 't') setWet(!state.wet);
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
  const since = (t) => (t ? Math.round(t - t0) : 0);
  function stats() {
    const r = look.renderer.info.render;
    return {
      fps, cpuMs: cpu, calls: r.calls, triangles: r.triangles, wellTriangles: well.triangles, wellDraws,
      streetTriangles: street.triangles, textureMs: since(timings.wellReady), groundMs: since(timings.groundReady), firstFrameMs: since(timings.firstFrame),
      cache: { ...cacheStats }, workers: paintPool().started, pixelRatio: pr, mood: state.mood, view: state.view, turn: state.turn,
    };
  }
  function showStats() {
    const s = stats();
    const tx = timings.wellReady && timings.groundReady
      ? `textures ${s.textureMs} ms, ground ${s.groundMs} ms (${s.cache.hits ? `${s.cache.hits} from the cache, ` : ''}${s.workers} workers)`
      : 'painting textures...';
    statsEl.textContent = `${s.fps.toFixed(0)} fps  cpu ${s.cpuMs.toFixed(1)} ms  frame: ${s.calls} draws, ${(s.triangles / 1000).toFixed(0)}k tris\n`
      + `well: ${wellDraws} meshes, ${(well.triangles / 1000).toFixed(1)}k tris  first frame ${s.firstFrameMs} ms, ${tx}`;
  }

  /** The textures' progress (each frame until all are in): the bar along the top, and when each set was done. */
  const total = Object.keys(SURFACES).length + GROUND_LAYERS.length;
  function paintProgress(now) {
    if (timings.wellReady && timings.groundReady) return;
    if (!timings.wellReady && surfacesReady()) timings.wellReady = now;
    if (!timings.groundReady && groundSrc.done) timings.groundReady = now;
    const painted = surfacesCount() + groundSrc.count;
    paintBar.style.width = `${Math.round((painted / total) * 100)}%`;
    if (timings.wellReady && timings.groundReady) {
      paintBar.classList.add('done');
      if (timings.firstFrame) showStats();
      // Textures kept by an older build: free their space now that this one's are in.
      pruneCache();
      return;
    }
    requestAnimationFrame(paintProgress);
  }
  // (From now, not from the first frame: the textures may all be in before the shaders are compiled.)
  requestAnimationFrame(paintProgress);

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
    gs.ground.material.userData.ground.uGTime.value = t;
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
    if (!timings.firstFrame) {
      timings.firstFrame = performance.now();
      loading.classList.add('done');
    }
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
  // Compile every program before the first frame shows (no hitch on the first mood change), in
  // the background where the browser can (KHR_parallel_shader_compile), so the page stays alive
  // and the workers' textures keep coming meanwhile. (The materials' programs do not depend on
  // the textures' pixels: the painted ones go into the same textures, nothing compiles again.)
  const compiled = look.renderer.compileAsync(scene, ortho).catch(() => look.renderer.compile(scene, ortho));
  compiled.then(() => {
    timings.compiled = performance.now();
    requestAnimationFrame(frame);
  });

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
    ready: compiled.then(() => true),
    /** When the first frame was drawn and the well's and the ground's textures were all in (performance.now()). */
    timings,
    /** Forget the textures kept in the browser (the next load paints them again). */
    clearTextures: clearCache,
    setMood, setView, setTurn, stats, bench, wells100, setScene, setSeason, setSnow, setWet, ground: gs.ground,
    /** Aim the game camera at a point of the ground (metres; the well at 0, 0). */
    aimAt(x, z) { target.set(x, 0.4, z); aim(); },
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
