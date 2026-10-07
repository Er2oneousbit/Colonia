/**
 * lab.js
 * ----------------------------------------------------------------------------
 * The look lab: one building, the public well, in its street, drawn with
 * the 3D look (render3d/look.js, materials.js, models/), to set and judge
 * the bar for the game's 3D art before it goes into the game; and the
 * Ground scene (labGround.js): every kind of the game's 3D ground side by
 * side, drawn by the game's own ground material (render3d/ground/), with
 * its seasons, snow and rain; and the Ground types view (labGallery.js):
 * every kind of ground the game can show on its own labelled card, to be
 * judged one by one; and the Fountain scene (labFountain.js): the street
 * fountain's four looks, from a plain lava lacus to a small nymphaeum,
 * running and dry, on the well's street; and the Farms and Granary scenes
 * (labRural.js): the eight farms on the game's ground, granaries from empty
 * to full.
 *
 * Built into one self-contained page: node scripts/build.mjs --lab --out <file>
 *
 * Views: the game's own camera (orthographic at the 2D art's angle) at 2x
 * (Classic's closest zoom) and twice that (WebGL's 4x), turned by quarter turns (Q / E), or a
 * free orbit (drag, pinch, wheel). Moods: day, golden hour, night, winter.
 * A stats line: frames per second, the frame's draw calls and triangles
 * (every pass: shadows, AO, scene, post), the well's own budget, and how
 * long the first frame and the textures took. The textures are painted on
 * the GPU (render3d/paint/) while the scene's programs compile, and the
 * first frame waits for both.
 *
 * For tests and measurement, window.__lab: ready (a promise), timings
 * (firstFrame, wellReady, groundReady, compiled), setMood(name),
 * setView(name), setTurn(t), orbit(azimuth, elevation, distance), stats(),
 * bench(frames) (ms per frame, waiting for the GPU), wells100(on),
 * setScene('well'|'ground'|'types'|'fountain'|'farms'|'granary'|'market'|'forum'|'warehouse'|'services'|'harbour'|'military'),
 * setSeason(name), setSnow(0..3),
 * setWet(on), aimAt(x, z), cards (the Ground types' cards), setCard(id or
 * index), overview(), fountains (the Fountain scene's), setFountainLod(0..2),
 * fountainTriangles(lod), setCommerceLod(0..2), commerceTriangles(id, lod)
 * (the Market, Forum, Warehouse and Services scenes, labCommerce.js: K, J, X, S), harbour
 * (the Harbour scene, labHarbour.js, D: setLod, items, triangles(type, key, lod)).
 * (the Military scene, labMilitary.js: C, with commerceTriangles('military', lod)
 * giving each of its five buildings' triangles).
 * (the Learning scene, labLearning.js: 7, the school, the library and the
 * academy, with commerceTriangles('learning', lod)).
 * ----------------------------------------------------------------------------
 */

import {
  Vector3, PerspectiveCamera, OrthographicCamera, InstancedMesh, Matrix4, Group, Mesh,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createLook, gameCamera, MOODS } from '../render3d/look.js';
import {
  surfaceTextures, surfacesReady, surfacesCount, LOOK, waterMaterial, iceMaterial, paintSurfaces,
} from '../render3d/materials.js';
import { SURFACES } from '../render3d/surfaces.js';
import { buildWell, wellLife, WELL } from '../render3d/models/well.js';
import { buildStreet } from '../render3d/models/street.js';
import { buildFigure } from '../render3d/models/figure.js';
import { groundTextures } from '../render3d/ground/groundTextures.js';
import { GROUND_LAYERS } from '../render3d/ground/groundSurfaces.js';
import { painterFor } from '../render3d/paint/painter.js';
import { buildGroundScene } from './labGround.js';
import { buildGallery } from './labGallery.js';
import { buildFountainScene } from './labFountain.js';
import { ruralScenes } from './labRural.js';
import { buildWoodsScene } from './labWoods.js';
import { buildCommerceScenes } from './labCommerce.js';
import { buildWallsScene } from './labWalls.js';
import { harbourScenes } from './labHarbour.js';
import { buildMilitaryScene } from './labMilitary.js';
import { buildLearningScene } from './labLearning.js';
import { fountainLife } from '../render3d/models/fountain.js';
import { mapStats } from './texReport.js';

/** Classic's closest zoom (config.js ZOOM_LEVELS' last); WebGL's go on to 6x (ZOOM_LEVELS_3D). */
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
<p>The street is Pompeii's: polygonal basalt blocks ending in a row of edge stones, a pavement 30 cm high of cocciopesto (lime with crushed tile)
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
<b>forest floor</b> (leaf litter, twigs, moss), bare <b>limestone</b>, <b>dune sand</b>, a <b>beach</b> by the sea, a farm's field of
<b>wheat</b> (every farm and stage: the Ground types view, Y), and under the water a river's silt or the sea's sand.</p>
<p>What people laid on it: an ordinary road is gravel rammed into the earth (a <i>via glareata</i>, the provinces' common road), with
a worn verge; a town's streets are paved with polygonal basalt between limestone kerbs, as Pompeii's and the Via Appia were (in the game, a road with a building beside it); a
forum's plaza is travertine flagstones in courses; a fallen house leaves rubble of stone, roof tile and ash.</p>
<p>Water deepens from its edge, from the bed seen through clear shallows to a river's green-blue or the sea's blue, with drifting
ripples, the sky in it and foam lapping at the shore. Where two kinds meet, the higher one's bumps win, so the edges wander.</p>
<h3>Controls</h3>
<ul>
<li>W: the well and its street; R: the ground; Y: the ground's types one by one. 1 to 4: day, golden hour, night, winter.</li>
<li>Spring, summer, autumn, winter: the season's colour on what grows. N: snow lying (none to deep). T: rain (wet ground, puddles).</li>
<li>M: the game's middle zoom, G: its closest, Z: twice that, O: orbit. Q / E: turn the view.</li>
</ul>`;

const FOUNTAIN_INFO = `
<button class="close" type="button" aria-label="Close">Close</button>
<h2>The street fountain</h2>
<p>A Roman town's water ran day and night from the aqueduct's castellum through lead pipes to street fountains (<i>lacus</i>) every
few blocks: Pompeii had some forty, placed so that hardly anyone lived more than a short walk from one. In Colonia the fountain takes
the look of its neighbourhood, from the poorest on the left to the richest on the right; the front row runs, the back row is dry.</p>
<ul>
<li><b>Lava lacus</b>: most of Pompeii's are this: four thick slabs of the grey Vesuvian lava the streets are paved with, held at the
top corners by iron cramps leaded in, a squat pillar at the back with the spout, the lead pipe that feeds it running up its back. The
overflow runs out by a notch into the street; the front slab is worn into a dip where people leaned to fill their jars.</li>
<li><b>Limestone lacus</b>: on a step of limestone blocks, the pillar moulded at foot and cap, a carved head of a water god on its face
with the water from its mouth (heads of Mercury, Silenus, Oceanus and others survive on Pompeii's fountains).</li>
<li><b>Marble basin</b>: cut from one block, moulded at rim and foot, a fluted column with a bronze lion's head spout, in fine marble
paving inside a travertine kerb.</li>
<li><b>Nymphaeum</b>: a small fountain house as rich towns and houses built: a niche lined with blue glass mosaic under a shell,
an aedicula of two fluted columns, an entablature and a pediment, a nymph pouring from a hydria into a moulded basin, clipped box in
pots.</li>
</ul>
<p>Running, the stream falls into the tank, rings spread where it lands and a sheet of water runs over the notch and away down the
street. Dry, green water stands on the tank's floor and a pale lime stain marks where the overflow ran. In a hard frost running water
keeps running: icicles grow on the lip and a dry tank's puddle freezes.</p>
<h3>Controls</h3>
<ul>
<li>F: this scene; W: the well; R: the ground; Y: the ground's types. 1 to 4: day, golden hour, night, winter.</li>
<li>L: the fountains' level of detail (0 close, 1 middle, 2 far: what the game draws when zoomed out).</li>
<li>N: snow lying; T: rain. M, G, Z: the game's zooms; O: orbit. Q / E: turn the view.</li>
</ul>`;

const TYPES_INFO = `
<button class="close" type="button" aria-label="Close">Close</button>
<h2>Ground types</h2>
<p>Every kind of ground the game can show, each on its own card with its edges against what it meets in the game, drawn by the
game's own ground material. Buildings, trees, rocks and farmhouses are sprites in the game and are not drawn here: the cards show
the ground they stand on.</p>
<p>Nature's ground: pasture, meadow, scrub, the forest floor, rocky ground, dune sand, a beach on the open sea, a river and its
banks, a pond. What people made: a country road of gravel, a town's basalt street, a plaza's flagstones, a road across every kind of
ground, a bridge's river, building yards, the footing of a wall and an aqueduct, rubble, a burned ruin (and one still burning), a
native village's plots. Farms: wheat, vegetables and flax from ploughed to ripe and resting in winter, an orchard, an olive grove and a
vineyard, a pig pen and a horse paddock, fields left idle and a farm turned a quarter.</p>
<h3>Controls</h3>
<ul>
<li>[ and ]: the card before or after; the list picks one; V: all the cards at once (overview).</li>
<li>Spring, summer, autumn, winter; N: snow lying (none to deep); T: rain. 1 to 4: day, golden hour, night, winter.</li>
<li>M: the game's middle zoom, G: its closest, Z: twice that. Q / E: turn the view.</li>
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
  // The textures are painted on the GPU (render3d/paint/) as soon as its
  // programs are compiled, alongside the scene's; a thin bar along the top
  // fills as they come.
  const t0 = performance.now();
  const timings = { start: t0, firstFrame: 0, wellReady: 0, groundReady: 0 };
  const paintBar = el('div', { class: 'paintbar' });
  app.appendChild(paintBar);

  // ?texscale=0.25: the surfaces painted smaller (a quick check under a software GL: the smoke test).
  const texScale = Number(new URLSearchParams(location.search).get('texscale'));
  if (texScale > 0 && texScale <= 1) LOOK.textureScale = texScale;
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  const look = createLook(canvas, { pixelRatio: pr, shadowBox: 9.5, shadowMap: 4096 });
  timings.lookMade = performance.now();
  const { scene } = look;
  // Every texture asked for at once: the painter compiles once and paints them all in one go.
  const groundTex = groundTextures(look.renderer, LOOK.anisotropy);
  for (const name of Object.keys(SURFACES)) surfaceTextures(name);
  // Their programs compile on the GPU's side while the models are built here.
  paintSurfaces();
  painterFor(look.renderer).start();
  timings.paintAsked = performance.now();

  const well = buildWell();
  scene.add(well.group);
  timings.wellBuilt = performance.now();
  const street = buildStreet();
  timings.streetBuilt = performance.now();
  scene.add(street.group);
  // The torch's light hangs from the scene, not the street: the Ground scene hides the street, and
  // a light that comes and goes changes every material's program (the lights are compiled in).
  scene.attach(street.torch);
  const torchHome = street.torch.position.clone();
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
      // A lamp that is out casts no shadow: its six shadow views a frame are the dearest thing
      // here, and its shadow's code is in every program (the night's are compiled after the
      // first frame: look.warm's variants).
      well.lamp.castShadow = k > 0;
      street.torch.castShadow = k > 0;
      well.paneMat.emissiveIntensity = k * 2.5;
      street.torch.intensity = k * 4 * torchOn();
      torchFlame.visible = k > 0;
    },
  });

  // Water and ice (an unseen copy of the ice, so its program is made with the rest).
  const waters = well.water;
  const iceProxy = new Mesh(waters[0].geometry, iceMaterial());
  iceProxy.visible = false;
  scene.add(iceProxy);
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
  const gs = buildGroundScene(groundTex, 'high');
  const groundGroup = gs.ground.group;
  groundGroup.visible = false;
  scene.add(groundGroup);
  // The Ground types view: every kind on its own card (the same material, so the same program).
  const gal = buildGallery(groundTex, 'high');
  const galGroup = gal.ground.group;
  galGroup.visible = false;
  scene.add(galGroup);
  const grounds = [gs.ground, gal.ground];
  // The Fountain scene: the four looks, running and dry, on the well's street.
  const fs = buildFountainScene();
  fs.group.visible = false;
  scene.add(fs.group);
  // The Farms and Granary scenes (labRural.js), made with the lab's buttons below.
  let rural = null;
  /** The Woods scene (labWoods.js), made with the lab's buttons below. */
  let woods = null;
  /** The Harbour scene (labHarbour.js): the fleet's buildings on the game's water. */
  let harbour = null;
  // The Market, Forum and Warehouse scenes (labCommerce.js), each its own patch of street.
  // (The Walls scene, labWalls.js, takes the same calls.)
  const commerce = { ...buildCommerceScenes(), ...buildWallsScene(), military: buildMilitaryScene(), learning: buildLearningScene() };
  for (const s of Object.values(commerce)) {
    s.group.visible = false;
    scene.add(s.group);
  }
  /** What must not cast AO: the well's water and glass, and the fountains' water and stains (each rebuild). */
  const baseNoAO = [...look.noAO];
  const fountainNoAO = () => {
    look.noAO.length = 0;
    look.noAO.push(...baseNoAO);
    for (const o of fs.fountains) for (const m of o.f.meshes) if (m.material.transparent) look.noAO.push(m);
    for (const s of Object.values(commerce)) s.group.traverse((m) => { if (m.isMesh && m.material.transparent) look.noAO.push(m); });
  };

  const state = { scene: 'well', mood: 'day', view: 'game1', turn: 0, season: 'summer', snow: 0, wet: false, card: 0, overview: false };
  /** The scene last asked for, and the wait for the Ground scene's program (setScene). */
  let wantScene = 'well';
  let sceneWait = null;
  /** The torch lights the street only where the street is shown. */
  // (In the Market, Forum and Warehouse scenes the torch's light moves to one building's lamp: labCommerce.js `lamp`.)
  function torchOn() { return state.scene === 'well' || commerce[state.scene] ? 1 : 0; }
  const target = new Vector3(0, 0.4, 0);
  /** Where the world fades into the backdrop: past the well's 3 x 3 tile patch, or the ground's 24 x 24. */
  function setFade() {
    if (state.scene === 'well') LOOK.uniforms.uLookFade.value.set(0, 0, 7, 10.5);
    else if (state.scene === 'fountain') LOOK.uniforms.uLookFade.value.set(0, 0, 9.5, 12.5);
    else if (state.scene === 'ground') LOOK.uniforms.uLookFade.value.set(-2, -2, 42, 48);
    else if (rural && rural.fade(state.scene)) LOOK.uniforms.uLookFade.value.set(...rural.fade(state.scene));
    else if (woods && state.scene === 'woods') LOOK.uniforms.uLookFade.value.set(...woods.fade);
    else if (harbour && state.scene === 'harbour') LOOK.uniforms.uLookFade.value.set(...harbour.fade);
    else if (commerce[state.scene]) LOOK.uniforms.uLookFade.value.set(...commerce[state.scene].fade);
    else LOOK.uniforms.uLookFade.value.set(0, 0, 1e5, 2e5);
  }
  setFade();

  // UI.
  const hud = el('div', { class: 'hud' }, '<h1>Colonia Look Lab</h1><div class="stats"></div>');
  app.appendChild(hud);
  const statsEl = hud.querySelector('.stats');
  const info = el('div', { class: 'info', role: 'dialog', 'aria-label': 'About this scene' }, INFO);
  app.appendChild(info);
  const fillInfo = () => {
    info.innerHTML = { well: INFO, ground: GROUND_INFO, types: TYPES_INFO, fountain: FOUNTAIN_INFO, ...(rural ? rural.info : {}), ...(woods ? { woods: woods.info } : {}), ...(harbour ? { harbour: harbour.info } : {}) }[state.scene] || commerce[state.scene].info;
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
  const sceneBtns = group([['Well', 'W', () => setScene('well')], ['Fountain', 'F', () => setScene('fountain')], ['Ground', 'R', () => setScene('ground')], ['Ground types', 'Y', () => setScene('types')], ['Farms', 'H', () => setScene('farms')], ['Granary', 'U', () => setScene('granary')], ['Woods', 'P', () => setScene('woods')], ['Harbour', 'D', () => setScene('harbour')],
    ...Object.values(commerce).map((s) => [s.title, s.key, () => setScene(s.id)])]);
  const SCENES = ['well', 'fountain', 'ground', 'types', 'farms', 'granary', 'woods', 'harbour', ...Object.keys(commerce)];
  const moodBtns = group(Object.entries(MOODS).map(([k, m], i) => [m.label, String(i + 1), () => setMood(k)]));
  const viewBtns = group(Object.entries(VIEWS).map(([k, v]) => [v.label, v.key, () => setView(k)]));
  group([['Turn left', 'Q', () => setTurn(state.turn - 1)], ['Turn right', 'E', () => setTurn(state.turn + 1)]]);
  // The Ground scene's own controls: the season, the snow lying, rain.
  const seasonBtns = group(Object.entries(SEASONS).map(([k, v]) => [v.label, '', () => setSeason(k)]));
  const snowBtns = group(SNOW_COVER.map((c, i) => [i ? `Snow ${i}` : 'No snow', i ? '' : 'N', () => setSnow(i)]));
  const wetBtns = group([['Rain', 'T', () => setWet(!state.wet)]]);
  // The Ground types' own: the card before, the list, the card after, all of them.
  const cardBar = el('div', { class: 'group' });
  const prevBtn = el('button', { type: 'button' }, 'Previous<kbd>[</kbd>');
  const pick = el('select', { 'aria-label': 'Ground type' });
  gal.cards.forEach((c, i) => pick.appendChild(el('option', { value: String(i) }, c.name)));
  const nextBtn = el('button', { type: 'button' }, 'Next<kbd>]</kbd>');
  const allBtn = el('button', { type: 'button' }, 'All<kbd>V</kbd>');
  prevBtn.addEventListener('click', () => setCard(state.card - 1));
  nextBtn.addEventListener('click', () => setCard(state.card + 1));
  allBtn.addEventListener('click', () => overview());
  pick.addEventListener('change', () => setCard(Number(pick.value)));
  cardBar.append(prevBtn, pick, nextBtn, allBtn);
  bar.appendChild(cardBar);
  const groundBars = [seasonBtns, snowBtns, wetBtns].map((b) => b[0].parentElement);
  // Labels over the cards, kept on them as the view moves.
  const labels = el('div', { class: 'cardlabels' });
  app.appendChild(labels);
  const labelEls = gal.cards.map((c) => {
    const e = el('div', { class: 'cardlabel' }, `<b>${c.name}</b><span>${c.note}</span>`);
    labels.appendChild(e);
    return e;
  });
  // The fountains' level of detail, and a label over each.
  const lodBtns = group([0, 1, 2].map((n) => [`Detail ${n}`, n ? '' : 'L', () => setFountainLod(n)]));
  const fLabels = el('div', { class: 'cardlabels' });
  app.appendChild(fLabels);
  const fLabelEls = fs.fountains.map((o) => {
    const e = el('div', { class: 'cardlabel' }, `<b>${o.name}</b><span>${o.state === 'dry' ? 'dry' : 'running'}</span>`);
    fLabels.appendChild(e);
    return e;
  });
  // The Farms and Granary scenes (labRural.js), on the game's ground as the Ground scene is, with their own buttons.
  rural = ruralScenes({ scene, look, groundTex, group, el, app, shadowBox: 9.5 });
  grounds.push(...rural.grounds);
  // The Woods scene (labWoods.js): the countryside's trees and rocks, the game's engine on the game's ground.
  woods = buildWoodsScene(look.renderer, groundTex, { el, app, group });
  scene.add(woods.group, woods.ground.group);
  grounds.push(woods.ground);
  harbour = harbourScenes({ scene, look, groundTex, group, el, app });
  grounds.push(...harbour.grounds);
  // The commerce scenes' labels, one over each building.
  const cLabels = el('div', { class: 'cardlabels' });
  app.appendChild(cLabels);
  const cLabelEls = Object.fromEntries(Object.values(commerce).map((s) => [s.id, s.labels.map((l) => {
    const e = el('div', { class: 'cardlabel' }, `<b>${l.name}</b><span>${l.note}</span>`);
    cLabels.appendChild(e);
    return e;
  })]));
  group([['About', 'I', () => info.classList.toggle('open')]]);

  function refreshButtons() {
    SCENES.forEach((k, i) => sceneBtns[i].setAttribute('aria-pressed', String(k === state.scene)));
    const lodNow = commerce[state.scene] ? commerce[state.scene].lod : fs.lod;
    lodBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === lodNow)));
    lodBtns[0].parentElement.style.display = state.scene === 'fountain' || commerce[state.scene] ? '' : 'none';
    fLabels.style.display = state.scene === 'fountain' ? '' : 'none';
    cLabels.style.display = commerce[state.scene] ? '' : 'none';
    for (const [id, els] of Object.entries(cLabelEls)) if (id !== state.scene) for (const e of els) e.style.display = 'none';
    Object.keys(MOODS).forEach((k, i) => moodBtns[i].setAttribute('aria-pressed', String(k === state.mood)));
    Object.keys(VIEWS).forEach((k, i) => viewBtns[i].setAttribute('aria-pressed', String(k === state.view)));
    Object.keys(SEASONS).forEach((k, i) => seasonBtns[i].setAttribute('aria-pressed', String(k === state.season)));
    snowBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.snow)));
    wetBtns[0].setAttribute('aria-pressed', String(state.wet));
    for (const g of groundBars) g.style.display = state.scene === 'well' ? 'none' : '';
    cardBar.style.display = state.scene === 'types' ? '' : 'none';
    labels.style.display = state.scene === 'types' ? '' : 'none';
    pick.value = String(state.card);
    allBtn.setAttribute('aria-pressed', String(state.overview));
  }

  /** The ground's season and weather, and the well's snow with it in the Ground scene. */
  function applyGround() {
    const snow = gs.groundSnow(SNOW_COVER[state.snow]);
    const m = MOODS[state.mood];
    for (const g of grounds) {
      g.setSky({ season: SEASONS[state.season].pos, snow, wet: state.wet ? 1 : 0, rain: state.wet ? 1 : 0, time: LOOK.uniforms.uLookTime.value });
      g.setReflection(m.water, m.waterRefl, m.lamps ? 0 : m.sun.elev < 15 ? 0.6 : 1);
    }
    // In a hard frost the fountains' running water grows icicles, a dry tank's puddle freezes.
    fs.setWinter(!!m.ice || state.snow >= 2);
    // (And the prefecture's pump freezes.)
    for (const s of Object.values(commerce)) s.setWinter(!!m.ice || state.snow >= 2);
    // (A rebuild makes new water meshes: keep them out of the AO, as the fountains' are.)
    fountainNoAO();
    // The farms' trees and vines take the season's look.
    if (rural) rural.season(state.season);
    // (A hard frost freezes the water's margins round the harbour's piles.)
    if (harbour) harbour.setSnow(Math.max(state.snow, m.ice ? 2 : 0));
    if (state.scene !== 'well') {
      LOOK.uniforms.uLookSnow.value = Math.max(m.snow, snow);
      LOOK.uniforms.uLookWet.value = Math.max(m.wet, state.wet ? 1 : 0);
    } else {
      LOOK.uniforms.uLookSnow.value = m.snow;
      LOOK.uniforms.uLookWet.value = m.wet;
    }
  }
  function setScene(name) {
    // (The Ground scene's program is compiled after the well's: wait for it rather than stall on it.
    // The night's too: a mood or a scene asked for meanwhile waits a moment.)
    wantScene = name;
    if (name !== 'well' && !timings.groundCompiled) {
      if (!sceneWait) sceneWait = warm.later.catch(() => {}).then(() => { timings.groundCompiled ||= performance.now(); setScene(wantScene); });
      return;
    }
    state.scene = name;
    const g = name !== 'well';
    street.group.visible = !g || name === 'fountain';
    woman.visible = !g;
    man.visible = !g;
    well.group.visible = name === 'well' || name === 'ground';
    fs.group.visible = name === 'fountain';
    rural.show(name);
    woods.show(name === 'woods');
    harbour.show(name);
    if (name === 'woods') {
      // (A wider square of the sun's shadow: the whole map of woods.)
      const sc = look.sun.shadow.camera;
      sc.left = -66;
      sc.right = 66;
      sc.top = 66;
      sc.bottom = -66;
      sc.far = 200;
      sc.updateProjectionMatrix();
    } else if (commerce[name] && commerce[name].shadowBox) {
      // (A scene wider than the lab's square: the Walls scene's town.)
      const sc = look.sun.shadow.camera;
      const half = commerce[name].shadowBox;
      Object.assign(sc, { left: -half, right: half, top: half, bottom: -half, far: 200 });
      sc.updateProjectionMatrix();
    }
    groundGroup.visible = name === 'ground';
    galGroup.visible = name === 'types';
    for (const s of Object.values(commerce)) s.group.visible = name === s.id;
    if (commerce[name]) street.group.visible = false;
    if (commerce[name]) street.torch.position.set(...commerce[name].lamp);
    else street.torch.position.copy(torchHome);
    if (name === 'types') aimCard();
    else if (target.x > 100 || commerce[name]) target.set(0, 0.4, 0);
    for (const l of look.lamps) l.set(MOODS[state.mood].lamps);
    setFade();
    fillInfo();
    applyGround();
    refreshButtons();
  }
  function setSeason(k) {
    state.season = k;
    woods.season(k);
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

  /** Aim at the card picked (or, in the overview, at the middle of them all, at the middle zoom). */
  function aimCard() {
    if (state.overview) {
      const c = gal.centre({ x: 0, y: 0, w: gal.map.w, h: gal.map.h });
      target.set(c[0], 0.4, c[1]);
    } else {
      const c = gal.centre(gal.cards[state.card]);
      target.set(c[0], 0.4, c[1]);
    }
    aim();
    refreshButtons();
  }
  function setCard(k) {
    const n = gal.cards.length;
    const i = typeof k === 'string' ? gal.cards.findIndex((c) => c.id === k) : k;
    state.card = ((i % n) + n) % n;
    state.overview = false;
    if (state.view === 'wide' || state.view === 'orbit') setView('game1');
    aimCard();
  }
  function overview() {
    setView('wide');
    state.overview = true;
    aimCard();
  }
  /** The fountains at another level of detail (rebuilt; their water kept out of the AO). */
  function setFountainLod(n) {
    if (commerce[state.scene]) commerce[state.scene].setLod(n);
    else fs.setLod(n);
    fountainNoAO();
    refreshButtons();
  }
  fountainNoAO();
  /** Keep each card's label over the middle of its top edge (the overview shows them all). */
  const lp = new Vector3();
  function placeFountainLabels() {
    const cam = state.view === 'orbit' ? persp : ortho;
    // (Names only at the wide zooms: the notes would cover the fountains.)
    fLabels.classList.toggle('compact', state.view !== 'game2' && state.view !== 'orbit');
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    fs.fountains.forEach((o, i) => {
      lp.set(o.x, o.tier === 4 ? 3.0 : 1.6, o.z - 1.2).project(cam);
      const e = fLabelEls[i];
      const on = lp.z < 1 && Math.abs(lp.x) < 1.05 && Math.abs(lp.y) < 1.05;
      e.style.display = on ? '' : 'none';
      if (on) e.style.transform = `translate(${((lp.x + 1) / 2) * w}px, ${((1 - lp.y) / 2) * h}px) translate(-50%, -100%)`;
    });
  }
  /** Each commerce building's label over its back corner, as seen at this turn. */
  function placeCommerceLabels() {
    const s = commerce[state.scene];
    const cam = state.view === 'orbit' ? persp : ortho;
    cLabels.classList.toggle('compact', state.view !== 'game2' && state.view !== 'orbit');
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    s.labels.forEach((l, i) => {
      lp.set(l.x, l.y, l.z).project(cam);
      const e = cLabelEls[s.id][i];
      const on = lp.z < 1 && Math.abs(lp.x) < 1.05 && Math.abs(lp.y) < 1.05;
      e.style.display = on ? '' : 'none';
      if (on) e.style.transform = `translate(${((lp.x + 1) / 2) * w}px, ${((1 - lp.y) / 2) * h}px) translate(-50%, -100%)`;
    });
  }
  function placeLabels() {
    if (state.scene === 'fountain') placeFountainLabels();
    if (commerce[state.scene]) placeCommerceLabels();
    rural.placeLabels(state.view === 'orbit' ? persp : ortho, canvas.clientWidth, canvas.clientHeight, state.view !== 'game2' && state.view !== 'orbit');
    woods.placeLabels(state.view === 'orbit' ? persp : ortho, canvas.clientWidth, canvas.clientHeight, state.view !== 'game2' && state.view !== 'orbit');
    harbour.placeLabels(state.view === 'orbit' ? persp : ortho, canvas.clientWidth, canvas.clientHeight, state.view !== 'game2' && state.view !== 'orbit');
    if (state.scene !== 'types') return;
    // (In the overview the names only: the notes would cover each other.)
    labels.classList.toggle('compact', state.overview);
    const cam = state.view === 'orbit' ? persp : ortho;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    gal.cards.forEach((c, i) => {
      // Over the card's corner highest on the screen (which one depends on the view's turn).
      let best = null;
      for (const [x, z] of gal.corners(c)) {
        lp.set(x, 0, z).project(cam);
        if (!best || lp.y > best.y) best = lp.clone();
      }
      lp.copy(best);
      const e = labelEls[i];
      const on = lp.z < 1 && Math.abs(lp.x) < 1.1 && Math.abs(lp.y) < 1.1;
      e.style.display = on ? '' : 'none';
      if (on) e.style.transform = `translate(${((lp.x + 1) / 2) * w}px, ${((1 - lp.y) / 2) * h}px) translate(-50%, -100%)`;
      e.classList.toggle('on', i === state.card && !state.overview);
    });
  }

  function aim() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (state.view === 'orbit') {
      persp.aspect = w / h;
      persp.updateProjectionMatrix();
    } else {
      // (The Ground types' overview: far enough out to see every card.)
      const zoom = state.scene === 'types' && state.overview ? GAME_ZOOM / 6 : VIEWS[state.view].zoom;
      gameCamera(ortho, { width: w, height: h, zoom, turn: state.turn, target });
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
    // (A zoom asked for leaves the overview, back to the card picked.)
    if (state.overview) {
      state.overview = false;
      if (state.scene === 'types') {
        const c = gal.centre(gal.cards[state.card]);
        target.set(c[0], 0.4, c[1]);
      }
    }
    controls.enabled = name === 'orbit';
    look.setCamera(name === 'orbit' ? persp : ortho);
    aim();
    refreshButtons();
  }
  function setTurn(t) {
    state.turn = ((t % 4) + 4) % 4;
    look.setTurn(state.turn);
    // (The goods take the stalls and bays this turn's camera sees best, as the game's do.)
    for (const s of Object.values(commerce)) s.setTurn(state.turn);
    woods.setTurn(state.turn);
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
    else if (k === 'h') setScene('farms');
    else if (k === 'u') setScene('granary');
    else if (k === 'f') setScene('fountain');
    else if (rural.key(k)) refreshButtons();
    else if (woods.key(k)) refreshButtons();
    else if (harbour.key(k)) refreshButtons();
    else if (k === 'd') setScene('harbour');
    else if (k === 'p') setScene('woods');
    else if (k === 'l' && state.scene === 'fountain') setFountainLod((fs.lod + 1) % 3);
    else if (k === 'l' && commerce[state.scene]) setFountainLod((commerce[state.scene].lod + 1) % 3);
    else if (k === 'k') setScene('market');
    else if (k === 'j') setScene('forum');
    else if (k === 'x') setScene('warehouse');
    else if (k === 's') setScene('services');
    else if (k === 'a') setScene('walls');
    else if (commerce[state.scene] && commerce[state.scene].onKey && commerce[state.scene].onKey(k)) refreshButtons();
    // (After the scene's own keys: in the Walls scene C cycles the stone.)
    else if (k === 'c') setScene('military');
    else if (k === '7') setScene('learning');
    else if (k === 'r') setScene('ground');
    else if (k === 'y') setScene('types');
    else if (k === '[' && state.scene === 'types') setCard(state.card - 1);
    else if (k === ']' && state.scene === 'types') setCard(state.card + 1);
    else if (k === 'v' && state.scene === 'types') overview();
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
      paint: { ...painterFor(look.renderer).stats }, pixelRatio: pr, mood: state.mood, view: state.view, turn: state.turn,
    };
  }
  function showStats() {
    const s = stats();
    const tx = timings.wellReady && timings.groundReady
      ? `textures ${s.textureMs} ms, ground ${s.groundMs} ms (${s.paint.textures} painted on the GPU, ${s.paint.programs} programs)`
      : 'painting textures...';
    statsEl.textContent = `${s.fps.toFixed(0)} fps  cpu ${s.cpuMs.toFixed(1)} ms  frame: ${s.calls} draws, ${(s.triangles / 1000).toFixed(0)}k tris\n`
      + `well: ${wellDraws} meshes, ${(well.triangles / 1000).toFixed(1)}k tris  first frame ${s.firstFrameMs} ms, ${tx}`;
  }

  /** The textures' progress (each frame until all are in): the bar along the top, and when each set was done. */
  const total = Object.keys(SURFACES).length + GROUND_LAYERS.length;
  function paintProgress(now) {
    if (timings.wellReady && timings.groundReady) return;
    if (!timings.wellReady && surfacesReady()) timings.wellReady = now;
    if (!timings.groundReady && groundTex.ready) timings.groundReady = now;
    const painted = surfacesCount() + (groundTex.ready ? GROUND_LAYERS.length : 0);
    paintBar.style.width = `${Math.round((painted / total) * 100)}%`;
    if (timings.wellReady && timings.groundReady) {
      paintBar.classList.add('done');
      if (timings.firstFrame) showStats();
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
    fountainLife(t);
    rural.life(t);
    woods.life(t);
    for (const g of grounds) g.material.userData.ground.uGTime.value = t;
    // Flames flicker: two incommensurate waves and a fast jitter.
    const lit = look.lamps[0].on;
    if (lit) {
      const f = 0.86 + 0.08 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.1 + 1.3) + 0.03 * Math.sin(t * 29.7);
      street.torch.intensity = 4 * lit * f * torchOn();
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
    placeLabels();
    cpu = cpu * 0.9 + (performance.now() - c0) * 0.1;
    if (!timings.firstFrame) {
      timings.firstFrame = performance.now();
      timings.firstFrameMs = timings.firstFrame - c0;
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

  timings.built = performance.now();
  setView('game1');
  resize();
  // Compile every program before the first frame shows, all at once and in the background
  // (KHR_parallel_shader_compile: the page stays alive, ANGLE compiles side by side, and the
  // GPU paints the textures meanwhile), the sky's light included: lit for real (setMood) only
  // once its programs are made, as making it compiles them at the first draw, blocking the page.
  // (The materials' programs do not depend on the textures' pixels.) The Ground scene's own
  // program, the slowest, is not waited for: the well comes first. The first frame waits for
  // the programs and the textures (an unpainted texture is undefined).
  const lampsCast = (on) => {
    well.lamp.castShadow = on;
    street.torch.castShadow = on;
  };
  lampsCast(false);
  const warm = look.warm(ortho, {
    mood: 'day',
    later: [groundGroup, galGroup, fs.group, ...rural.later, ...woods.later, ...harbour.later, ...Object.values(commerce).map((s) => s.group)],
    variants: [() => {
      lampsCast(true);
      return () => lampsCast(look.lamps[0].on > 0);
    }],
  });
  warm.later.then(() => { timings.groundCompiled = performance.now(); });
  const compiled = warm.ready.then(() => {
    setMood('day');
    timings.lit = performance.now();
  });
  const painted = new Promise((resolve) => {
    const check = () => (surfacesReady() && groundTex.ready ? resolve() : requestAnimationFrame(check));
    check();
  });
  timings.compileCall = performance.now();
  painted.then(() => { timings.painted = performance.now(); });
  compiled.then(() => { timings.compiled = performance.now(); });
  const started = Promise.all([compiled, painted]);
  started.then(() => requestAnimationFrame(frame));

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
    ready: started.then(() => true),
    /** When the first frame was drawn and the well's and the ground's textures were all in (performance.now()). */
    timings,
    setMood, setView, setTurn, stats, bench, wells100, setScene, setSeason, setSnow, setWet, ground: gs.ground,
    gallery: gal.ground, cards: gal.cards.map((c) => ({ id: c.id, name: c.name, note: c.note })), setCard, overview,
    /** The Fountain scene's fountains (tier, state, where), its level of detail, and each tier's triangles at one. */
    get fountains() { return fs.fountains.map((o) => ({ tier: o.tier, name: o.name, state: o.state, x: o.x, z: o.z, triangles: o.f.triangles })); },
    setFountainLod,
    fountainTriangles: (l) => fs.triangles(l),
    /** The Market, Forum and Warehouse scenes: a model's triangles at a level of detail (and its goods'). */
    commerceTriangles: (id, l) => commerce[id].triangles(l),
    setCommerceLod: (n) => setFountainLod(n),
    /** The Walls scene (labWalls.js): its pieces, setLook(stone), setLod via setCommerceLod. */
    walls: commerce.walls,
    /** The Farms and Granary scenes (labRural.js): their state, level of detail and triangles. */
    rural: {
      setFarms: (st) => rural.setFarms(st),
      setLod: (n) => rural.setLod(n),
      farmTriangles: (l) => rural.farms.triangles(l),
      granaryTriangles: (l) => rural.gran.triangles(l),
      get farms() { return rural.farms.farms.map((f) => ({ type: f.type, look: f.look, triangles: f.tris })); },
    },
    /** The Woods scene (labWoods.js): its month and level of detail, a species' triangles, the engine's stats and memory. */
    woods: {
      setMonth: (m) => { woods.setMonth(m); refreshButtons(); },
      setLod: (n) => { woods.setLod(n); refreshButtons(); },
      specimenAt: (sp, row = 1) => woods.specimenAt(sp, row).toArray(),
      triangles: (sp, lod, lookName) => woods.triangles(sp, lod, lookName),
      stats: () => ({ ...woods.flora.stats }),
      bytes: () => woods.flora.bytes(),
    },
    /** The Harbour scene (labHarbour.js): its level of detail, its buildings, a look's triangles as the game builds it. */
    harbour: {
      setLod: (n) => harbour.setLod(n),
      get items() { return harbour.scene.items.map((it) => ({ type: it.type, note: it.note, x: it.holder.position.x, z: it.holder.position.z, triangles: it.tris })); },
      triangles: (type, key, l) => harbour.scene.triangles(type, key, l),
    },
    /** Aim the game camera at a point of the ground (metres; the well at 0, 0). */
    aimAt(x, z) { target.set(x, 0.4, z); aim(); },
    /** Every texture's checks (texReport.js), on its bytes read back from the GPU. */
    /** A ground layer's map (albedo, normal or orm) as a PNG data URL, 2 x 2 repeats: to judge a texture and its tiling by eye. */
    layerImage(name, which = 'albedo') {
      const i = GROUND_LAYERS.findIndex((l) => l.name === name);
      const bytes = painterFor(look.renderer).readPixels(groundTex.out[which], i);
      const n = groundTex.size;
      const c = document.createElement('canvas');
      c.width = n * 2;
      c.height = n * 2;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(n, n);
      for (let k = 0; k < n * n; k++) {
        for (let ch = 0; ch < 3; ch++) img.data[k * 4 + ch] = bytes[k * 4 + ch];
        img.data[k * 4 + 3] = 255;
      }
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) ctx.putImageData(img, x * n, y * n);
      return c.toDataURL('image/png');
    },
    /**
     * A surface's map (albedo, normal or orm) as a PNG data URL, once, over a checker where it is
     * cut away (a spray of leaves: surfacesFlora.js), to judge it by eye.
     */
    async surfaceImage(name, which = 'albedo') {
      const t = surfaceTextures(name);
      await t.whenReady;
      const bytes = painterFor(look.renderer).readPixels(t.out[which]);
      const n = t.size;
      const c = document.createElement('canvas');
      c.width = n;
      c.height = n;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(n, n);
      for (let k = 0; k < n * n; k++) {
        const a = which === 'albedo' ? bytes[k * 4 + 3] / 255 : 1;
        const bg = ((k % n) >> 4) % 2 === ((k / n) >> 4) % 2 ? 60 : 90;
        for (let ch = 0; ch < 3; ch++) img.data[k * 4 + ch] = Math.round(bytes[k * 4 + ch] * a + bg * (1 - a));
        img.data[k * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c.toDataURL('image/png');
    },
    textureReport() {
      const painter = painterFor(look.renderer);
      const read = (out, layer) => ({ albedo: painter.readPixels(out.albedo, layer), orm: painter.readPixels(out.orm, layer), normal: painter.readPixels(out.normal, layer) });
      const report = {};
      for (const name of Object.keys(SURFACES)) {
        const t = surfaceTextures(name);
        report[`surface.${name}`] = { size: t.size, ...mapStats(read(t.out), t.size) };
      }
      GROUND_LAYERS.forEach((l, i) => { report[`ground.${l.name}`] = { size: groundTex.size, ...mapStats(read(groundTex.out, i), groundTex.size) }; });
      const h = surfaceTextures('basalt').maps;
      report.pavingHeight = h && h.height ? h.height.data.length : 0;
      return report;
    },
    /** Lose the WebGL context and get it back: resolves once every texture is painted again. */
    async loseContext() {
      const ext = look.renderer.getContext().getExtension('WEBGL_lose_context');
      const painter = painterFor(look.renderer);
      const restored = new Promise((resolve) => canvas.addEventListener('webglcontextrestored', resolve, { once: true }));
      ext.loseContext();
      await new Promise((r) => setTimeout(r, 50));
      ext.restoreContext();
      await restored;
      const before = painter.stats.textures;
      await new Promise((resolve) => {
        const check = () => (painter.idle && painter.stats.textures > before ? resolve() : setTimeout(check, 20));
        check();
      });
      return painter.stats.textures - before;
    },
    orbit(az, el, dist, ty = 0.9, tx = 0, tz = 0) {
      setView('orbit');
      const a = (az * Math.PI) / 180;
      const e = (el * Math.PI) / 180;
      controls.target.set(tx, ty, tz);
      persp.position.set(tx + Math.sin(a) * Math.cos(e) * dist, ty + Math.sin(e) * dist, tz + Math.cos(a) * Math.cos(e) * dist);
      controls.update();
    },
    look,
    /** The look's shared uniforms (to switch the AO off when judging a texture). */
    uniforms: LOOK.uniforms,
  };
}

window.__labStart = main().catch((err) => {
  const msg = document.createElement('pre');
  msg.style.cssText = 'position:fixed;inset:16px;color:#f88;white-space:pre-wrap;font:12px monospace';
  msg.textContent = `The look lab failed to start:\n${err && err.stack ? err.stack : err}`;
  document.body.appendChild(msg);
  throw err;
});
