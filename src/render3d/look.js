/**
 * look.js
 * ----------------------------------------------------------------------------
 * The 3D look: how a scene of the 3D models is lit and finished, in one
 * place, so the look lab (src/dev/lab.js) and later the game's WebGL back
 * end make the same picture.
 *
 *   Renderer   linear lighting, sRGB output, ACES filmic tone mapping (the
 *              film-like toe and shoulder most games use: AgX was tried and
 *              left warm stone looking grey-green), soft PCF shadows.
 *   Light      a sun (or moon) with a tight shadow box over the scene; the
 *              sky as image-based light: three's Sky (Preetham's daylight
 *              model, with its clouds) rendered into a PMREM environment,
 *              or a gradient night sky with a moon glow; each mood (MOODS)
 *              sets them, the exposure and the colour grade.
 *   Post       AO (GTAO, rendered first; the materials read it and darken
 *              mostly the sky's light, materials.js), the scene into a 4x
 *              MSAA target, bloom (only what is far brighter than daylight
 *              blooms: flames, the lantern), tone mapping and sRGB, a grade
 *              (contrast, saturation, split toning, vignette, dither), SMAA.
 *   Camera     gameCamera(): the game's own view, an orthographic camera at
 *              the 2D art's angle (render3d/projection.js: 30 degrees down,
 *              turned 45) at a game zoom, in metres (a tile is 4 m), turned
 *              by quarter turns as the view turns.
 *
 * The sun keeps its place on the SCREEN as the view turns (the 2D art is lit
 * from the upper left at every turn; light.js), so a view turn turns the
 * sun with the camera.
 * ----------------------------------------------------------------------------
 */

import {
  WebGLRenderer, Scene, DirectionalLight, Vector3, Vector2, Color, ACESFilmicToneMapping, SRGBColorSpace, PCFShadowMap,
  PMREMGenerator, WebGLRenderTarget, HalfFloatType, Mesh, SphereGeometry, ShaderMaterial,
  BackSide, CircleGeometry, MeshBasicMaterial, ColorManagement,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { BACK, TILE_LEN } from './projection.js';
import { LOOK } from './materials.js';

/** Metres in a game tile. */
export const TILE_M = 4;

/**
 * The moods. Sun: elevation (degrees), colour, intensity; its direction
 * on the ground `toward` (x, z) is where it stands seen from the game's
 * camera at turn 0: -x is the upper left of the screen, so shadows fall
 * to the lower right as the 2D art's do. Sky: Preetham's parameters, or
 * `night`. bounce, bounceLevel: the ground's light from below (the
 * environment's lower half). env: how strongly the sky lights the scene. fade: the backdrop
 * the world fades into. bloom: [strength, radius, threshold]. grade:
 * contrast, saturation, lift (shadows' tint), gain (highlights' tint),
 * vignette. lamps: the lantern and the torch, 0 off. snow, wet: the
 * materials' winter (materials.js); grass: a tint for the grass (winter's
 * is dry straw). water, waterRefl: the sky as still water shows it (linear
 * rgb) and how strongly (the 3D ground, ground/groundMaterial.js).
 */
export const MOODS = {
  day: {
    label: 'Day',
    sun: { elev: 44, toward: [-1, 0.5], color: '#fff0da', intensity: 4.2 },
    sky: { turbidity: 3.5, rayleigh: 0.7, mie: 0.005, g: 0.8, clouds: 0.3 },
    bounce: '#a08868', bounceLevel: 2.4,
    env: 0.32, exposure: 1.0, fade: '#5e594e',
    bloom: [0.1, 0.5, 6],
    grade: { contrast: 1.0, saturation: 1.0, lift: [0.0, 0.0, 0.0], gain: [1.0, 1.0, 1.0], vignette: 0.3 },
    lamps: 0, snow: 0, wet: 0, ice: false,
    water: [0.5, 0.64, 0.82], waterRefl: 0.3,
  },
  golden: {
    label: 'Golden hour',
    sun: { elev: 11, toward: [-1, 0.25], color: '#ffb36b', intensity: 3.6 },
    sky: { turbidity: 5.5, rayleigh: 2.2, mie: 0.008, g: 0.85, clouds: 0.3 },
    bounce: '#a07450', bounceLevel: 0.6,
    env: 0.25, exposure: 1.05, fade: '#3d3027',
    bloom: [0.14, 0.55, 5],
    grade: { contrast: 1.02, saturation: 1.0, lift: [0.0, 0.0, 0.01], gain: [1.02, 1.0, 0.96], vignette: 0.4 },
    lamps: 0, snow: 0, wet: 0, ice: false,
    water: [0.95, 0.66, 0.42], waterRefl: 0.35,
  },
  night: {
    label: 'Night',
    sun: { elev: 38, toward: [-0.6, -0.8], color: '#b9c6e4', intensity: 0.7 },
    sky: { night: true, zenith: '#080b18', horizon: '#1d2436', moon: '#6f7b98' },
    bounce: '#2a2620', bounceLevel: 0.08,
    // Brighter than a real night: a city at night must still read at a glance.
    env: 1.5, exposure: 1.45, fade: '#06080e',
    bloom: [0.55, 0.6, 1.6],
    grade: { contrast: 1.02, saturation: 0.95, lift: [0.0, 0.003, 0.012], gain: [1.0, 1.0, 1.0], vignette: 0.5 },
    lamps: 1, snow: 0, wet: 0, ice: false,
    water: [0.05, 0.065, 0.11], waterRefl: 0.3,
  },
  winter: {
    label: 'Winter',
    sun: { elev: 24, toward: [-1, 0.45], color: '#fff1e6', intensity: 2.1 },
    sky: { turbidity: 8, rayleigh: 0.7, mie: 0.01, g: 0.75, clouds: 0.8 },
    bounce: '#c8ccd2', bounceLevel: 1.4,
    env: 0.5, exposure: 1.0, fade: '#8e9398',
    bloom: [0.08, 0.5, 6],
    grade: { contrast: 1.0, saturation: 0.9, lift: [0.0, 0.0, 0.008], gain: [0.99, 1.0, 1.02], vignette: 0.3 },
    lamps: 0, snow: 1, wet: 1, ice: true, grass: '#a88f62',
    water: [0.62, 0.66, 0.72], waterRefl: 0.25,
  },
};

/** The colour grade, after tone mapping (in sRGB, as a colourist works). */
const GradeShader = {
  name: 'LookGrade',
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1 },
    saturation: { value: 1 },
    lift: { value: new Vector3() },
    gain: { value: new Vector3(1, 1, 1) },
    vignette: { value: 0 },
    aspect: { value: 1 },
    seed: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float contrast, saturation, vignette, aspect, seed;
    uniform vec3 lift, gain;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D( tDiffuse, vUv );
      vec3 x = c.rgb;
      // A gentle S around mid grey: punch without crushing.
      x = clamp( ( x - 0.5 ) * contrast + 0.5, 0.0, 1.0 );
      float l = dot( x, vec3( 0.2126, 0.7152, 0.0722 ) );
      x = mix( vec3( l ), x, saturation );
      x = x * gain + lift * ( 1.0 - x );
      vec2 d = ( vUv - 0.5 ) * vec2( aspect, 1.0 );
      x *= 1.0 - vignette * smoothstep( 0.2, 1.1, length( d ) );
      // Half a step of noise breaks the banding of a dark gradient (the night sky, the fade).
      float n = fract( sin( dot( gl_FragCoord.xy + seed, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
      x += ( n - 0.5 ) / 255.0;
      gl_FragColor = vec4( x, c.a );
    }`,
};

/** The night sky for the environment: a dark gradient and the moon's glow. */
function nightSky(sky, moonDir) {
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new Color(sky.zenith) },
      horizon: { value: new Color(sky.horizon) },
      moon: { value: new Color(sky.moon) },
      moonDir: { value: moonDir.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize( position ); gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); gl_Position.z = gl_Position.w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith, horizon, moon, moonDir;
      varying vec3 vDir;
      void main() {
        float h = clamp( vDir.y, -1.0, 1.0 );
        vec3 c = mix( horizon, zenith, pow( max( h, 0.0 ), 0.6 ) );
        c = mix( c, horizon * 0.35, smoothstep( 0.0, -0.4, h ) );
        float m = max( dot( normalize( vDir ), moonDir ), 0.0 );
        c += moon * ( pow( m, 24.0 ) * 1.5 + pow( m, 4.0 ) * 0.25 );
        gl_FragColor = vec4( c, 1.0 );
      }`,
  });
  return new Mesh(new SphereGeometry(10, 32, 16), mat);
}

/**
 * A colour from a mood's table (sRGB hex) as linear light, whether or not
 * three's colour management is on (the game's WebGL back end turns it off:
 * its sprites are plain bytes).
 */
export function moodColor(hex, out = new Color()) {
  out.set(hex);
  if (!ColorManagement.enabled) out.convertSRGBToLinear();
  return out;
}

/** What the sky's light is rendered from: three's Sky and a disc of ground under it. */
export function makeSkyParts() {
  const scene = new Scene();
  const sky = new Sky();
  sky.scale.setScalar(50);
  scene.add(sky);
  // The ground under the sky: light bounced off sunlit earth and stone comes
  // back warm from below. Without it the scene is lit by a blue dome alone,
  // and every warm stone turns grey-green in the shade.
  const ground = new Mesh(new CircleGeometry(40, 32), new MeshBasicMaterial({ color: 0x000000 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  scene.add(ground);
  return {
    scene, sky, ground,
    dispose() {
      sky.geometry.dispose();
      sky.material.dispose();
      ground.geometry.dispose();
      ground.material.dispose();
    },
  };
}

/**
 * The sky of a mood as image-based light: a PMREM render target (dispose it
 * when done) from `parts` (makeSkyParts), the sun or moon toward `dir`.
 */
export function skyEnvironment(pmrem, mood, dir, parts) {
  const m = mood;
  moodColor(m.bounce, parts.ground.material.color).multiplyScalar(m.bounceLevel);
  if (m.sky.night) {
    const ns = new Scene();
    const night = nightSky(m.sky, dir);
    ns.add(night);
    ns.add(parts.ground);
    const rt = pmrem.fromScene(ns, 0, 0.1, 100);
    night.geometry.dispose();
    night.material.dispose();
    parts.scene.add(parts.ground);
    return rt;
  }
  const u = parts.sky.material.uniforms;
  u.turbidity.value = m.sky.turbidity;
  u.rayleigh.value = m.sky.rayleigh;
  u.mieCoefficient.value = m.sky.mie;
  u.mieDirectionalG.value = m.sky.g;
  u.cloudCoverage.value = m.sky.clouds;
  u.showSunDisc.value = 0;
  u.sunPosition.value.copy(dir);
  parts.scene.add(parts.ground);
  return pmrem.fromScene(parts.scene, 0, 0.1, 100);
}

/** The direction toward the sun for a mood at a view turn (quarter turns). */
export function sunDirection(mood, turn = 0) {
  const s = mood.sun;
  const e = (s.elev * Math.PI) / 180;
  const [tx, tz] = s.toward;
  const l = Math.hypot(tx, tz);
  const a = (-turn * Math.PI) / 2;
  const hx = (tx / l) * Math.cos(a) - (tz / l) * Math.sin(a);
  const hz = (tx / l) * Math.sin(a) + (tz / l) * Math.cos(a);
  return new Vector3(hx * Math.cos(e), Math.sin(e), hz * Math.cos(e));
}

/**
 * Aim an OrthographicCamera as the game's view at a zoom (the game's zoom
 * levels, render/camera.js; 2 is its closest), for a viewport of
 * width x height CSS px, centred on `target`, turned `turn` quarter turns.
 * A tile (4 m) spans TILE_LEN * zoom CSS px along the screen, as a sprite.
 */
export function gameCamera(camera, { width, height, zoom, turn = 0, target = new Vector3() }) {
  const pxPerM = (TILE_LEN * zoom) / TILE_M;
  const hw = width / 2 / pxPerM;
  const hh = height / 2 / pxPerM;
  const a = (-turn * Math.PI) / 2;
  const bx = BACK[0] * Math.cos(a) - BACK[2] * Math.sin(a);
  const bz = BACK[0] * Math.sin(a) + BACK[2] * Math.cos(a);
  const dist = 60;
  camera.position.set(target.x + bx * dist, target.y + BACK[1] * dist, target.z + bz * dist);
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  camera.left = -hw;
  camera.right = hw;
  camera.top = hh;
  camera.bottom = -hh;
  camera.near = 1;
  camera.far = 140;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Make the look: a renderer on `canvas`, a scene with the sun and the
 * sky's light, and the post chain. `shadowBox` is the half size (metres)
 * of the square the sun's shadow map covers, centred on `focus`.
 */
export function createLook(canvas, { pixelRatio = 1, shadowBox = 9, shadowMap = 4096, focus = new Vector3() } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.info.autoReset = false;
  LOOK.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new Scene();
  const sun = new DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMap, shadowMap);
  const sc = sun.shadow.camera;
  sc.left = -shadowBox;
  sc.right = shadowBox;
  sc.top = shadowBox;
  sc.bottom = -shadowBox;
  sc.near = 1;
  sc.far = 80;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.012;
  sun.shadow.radius = 3;
  sun.target.position.copy(focus);
  scene.add(sun, sun.target);

  const pmrem = new PMREMGenerator(renderer);
  const skyParts = makeSkyParts();
  let envRT = null;

  const look = {
    renderer, scene, sun, mood: null, turn: 0, camera: null, composer: null, passes: null,
    /** Objects hidden from the AO pass (transparent or glowing things that would cast AO). */
    noAO: [],
    /** Things lit at night (lamps): { light, intensity, flame?, pane? } set by the page. */
    lamps: [],
    size: new Vector2(1, 1),
  };

  /** Light the scene for a mood at the current view turn. */
  look.setMood = (name) => {
    const m = MOODS[name];
    look.mood = name;
    const dir = sunDirection(m, look.turn);
    sun.color.set(m.sun.color);
    sun.intensity = m.sun.intensity;
    sun.position.copy(focus).addScaledVector(dir, 40);
    sun.target.position.copy(focus);
    // The sky as light.
    if (envRT) envRT.dispose();
    envRT = skyEnvironment(pmrem, m, dir, skyParts);
    scene.environment = envRT.texture;
    scene.environmentIntensity = m.env;
    scene.background = new Color(m.fade);
    LOOK.uniforms.uLookFadeColor.value.set(m.fade);
    // The backdrop and the world's fade are one colour through the same tone mapping, so they meet unseen.
    renderer.toneMappingExposure = m.exposure;
    LOOK.uniforms.uLookSnow.value = m.snow;
    LOOK.uniforms.uLookWet.value = m.wet;
    if (m.grass) LOOK.uniforms.uLookGrass.value.set(...new Color(m.grass).toArray(), 1);
    else LOOK.uniforms.uLookGrass.value.set(1, 1, 1, 0);
    for (const l of look.lamps) l.set(m.lamps);
    if (look.passes) applyPost(look.passes, m);
  };

  /** Turn the view (quarter turns); the sun turns with it. */
  look.setTurn = (t) => {
    look.turn = ((t % 4) + 4) % 4;
    if (look.mood) look.setMood(look.mood);
  };

  /** Use a camera: builds the post chain for it (GTAO is made for one camera type). */
  look.setCamera = (camera) => {
    if (look.camera === camera && look.composer) return;
    look.camera = camera;
    if (look.composer) disposePost(look);
    buildPost(look);
    look.resize(look.size.x, look.size.y);
    if (look.mood) applyPost(look.passes, MOODS[look.mood]);
  };

  /** Size in CSS px. */
  look.resize = (w, h) => {
    look.size.set(w, h);
    renderer.setSize(w, h, false);
    if (look.composer) look.composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    LOOK.uniforms.uLookRes.value.set(Math.round(w * pr), Math.round(h * pr));
    if (look.passes) look.passes.grade.uniforms.aspect.value = w / h;
  };

  /** Draw a frame. */
  look.render = (dt = 0) => {
    renderer.info.reset();
    look.composer.render(dt);
  };

  look.dispose = () => {
    disposePost(look);
    if (envRT) envRT.dispose();
    skyParts.dispose();
    pmrem.dispose();
    renderer.dispose();
  };
  return look;
}

function buildPost(look) {
  const { renderer, scene, camera } = look;
  const w = Math.max(1, look.size.x);
  const h = Math.max(1, look.size.y);
  const target = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const gtao = new GTAOPass(scene, camera, w, h);
  gtao.output = GTAOPass.OUTPUT.Off;
  gtao.needsSwap = false;
  gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.15, samples: 16, distanceFallOff: 1 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  // Glowing and see-through things must not throw AO onto what is behind them.
  const render = gtao.render.bind(gtao);
  gtao.render = (...args) => {
    const hidden = look.noAO.filter((o) => o.visible);
    for (const o of hidden) o.visible = false;
    render(...args);
    for (const o of hidden) o.visible = true;
  };
  composer.addPass(gtao);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(w / 2, h / 2), 0.2, 0.5, 4);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  const smaa = new SMAAPass();
  composer.addPass(smaa);
  LOOK.uniforms.uLookAO.value = gtao.pdRenderTarget.texture;
  LOOK.uniforms.uLookAOOn.value = 1;
  look.composer = composer;
  look.passes = { gtao, bloom, grade, smaa };
}

function applyPost(p, m) {
  [p.bloom.strength, p.bloom.radius, p.bloom.threshold] = m.bloom;
  const g = p.grade.uniforms;
  g.contrast.value = m.grade.contrast;
  g.saturation.value = m.grade.saturation;
  g.lift.value.set(...m.grade.lift);
  g.gain.value.set(...m.grade.gain);
  g.vignette.value = m.grade.vignette;
}

function disposePost(look) {
  if (!look.composer) return;
  for (const p of look.composer.passes) if (p.dispose) p.dispose();
  look.composer.renderTarget1.dispose();
  look.composer.renderTarget2.dispose();
  look.composer = null;
  look.passes = null;
}

