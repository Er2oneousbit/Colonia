/**
 * sunRig.js
 * ----------------------------------------------------------------------------
 * The light of the WebGL back end's 3D world: one scene that holds the 3D
 * ground (ground/groundPass.js) and the 3D models (modelPass.js), lit alike
 * by the 3D look's light (look.js): a sun from the upper left of the screen
 * at every view turn (as the art's light is), the sky as image-based light
 * (three's Sky in a PMREM, made once), ACES tone mapping and sRGB output.
 * So a well stands on the ground in the same light, and its real shadow
 * falls on the ground from the sun's shadow map (High).
 *
 * The darkness of night and of an overcast sky stays 2D: the renderer
 * multiplies the whole picture by its light map after the scene
 * (render/lighting.js). Done twice the 3D world would sink into black under
 * sprites tinted once; so it keeps its daylight key at every hour and in
 * every weather: as the sun sinks or clouds come, a sky light (a hemisphere
 * light) makes up the light the sun no longer gives, and only the light's
 * direction and softness change (no hard shadows under cloud or at night).
 *
 * The scene's children, in the order three draws them (the back end turns
 * sorting off): the lights, `groundSlot` (the ground, which writes no
 * depth), `modelSlot` (the models, which do; their see-through water after
 * everything opaque), and `ghostSlot` (the build ghost: hidden but in its
 * own draw, renderGhosts(), after the sprites, as the 2D ghost was drawn
 * over everything). renderModels() draws the models alone (the ground
 * drawn from Low's kept picture, or the ground's sprites).
 * ----------------------------------------------------------------------------
 */

import {
  Scene, Group, DirectionalLight, HemisphereLight, PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace, Vector3, PCFShadowMap,
} from 'three';
import { MOODS, sunDirection, makeSkyParts, skyEnvironment, moodColor } from './look.js';

/** Model shadows only when the view is narrower than this (tiles across the shadow's square): far out a well is a few pixels. */
const SHADOW_MAX = 96;

/**
 * The sun's height over the horizon (degrees) at a time of day (render/
 * lighting.js dayTime: sunrise about 0.94, sunset about 0.68), never under
 * a low morning or evening sun: at night the sun has no say (sunLight 0).
 */
export function sunElevation(t) {
  const rise = 0.94;
  const span = 0.74; // to sunset
  const f = ((((t - rise) % 1) + 1) % 1) / span;
  if (f >= 1) return 10;
  return 10 + 42 * Math.sin(Math.PI * f);
}

export class SunRig {
  /** @param {import('three').WebGLRenderer} gl */
  constructor(gl) {
    this.gl = gl;
    this.scene = new Scene();
    const day = MOODS.day;
    this.sunDay = day.sun.intensity;
    this.envDay = day.env;
    this.sun = new DirectionalLight(0xffffff, this.sunDay);
    moodColor(day.sun.color, this.sun.color);
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 2;
    this.sun.shadow.autoUpdate = false;
    this.sun.castShadow = false;
    // Makes up the light the sun no longer gives (see the header).
    this.fill = new HemisphereLight(0xffffff, 0xffffff, 0);
    this.fill.color.setRGB(0.78, 0.86, 1.0);
    this.fill.groundColor.setRGB(0.55, 0.47, 0.38);
    this.groundSlot = new Group();
    this.groundSlot.name = 'ground-slot';
    this.modelSlot = new Group();
    this.modelSlot.name = 'model-slot';
    this.ghostSlot = new Group();
    this.ghostSlot.name = 'ghost-slot';
    this.ghostSlot.visible = false;
    this.scene.add(this.sun, this.sun.target, this.fill, this.groundSlot, this.modelSlot, this.ghostSlot);
    this.env = null;
    this.envDirty = true;
    this.sunDir = new Vector3(0, 1, 0);
    this.sunK = 1;
    this.shadowLive = false;
    // (On from the start: a shader is compiled for the state it is drawn in.)
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = PCFShadowMap;
  }

  /** Does the sun cast shadows (the 3D ground at High)? Changing it changes every lit program. */
  setShadows(on) {
    if (this.sun.castShadow === on) return;
    this.sun.castShadow = on;
    if (!on && this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
  }

  /** The sky's light (made once; again after a lost context). */
  ensureEnv() {
    if (!this.envDirty) return;
    if (this.env) this.env.dispose();
    const pmrem = new PMREMGenerator(this.gl);
    const parts = makeSkyParts();
    this.env = skyEnvironment(pmrem, MOODS.day, sunDirection(MOODS.day, 0), parts);
    parts.dispose();
    pmrem.dispose();
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = this.envDay;
    this.envDirty = false;
  }

  /** The sun for renderer `r`'s hour and sky (see the header): its height by the time of day, its strength by the sky's. */
  light(r) {
    const env = r.env || { sun: 1, overcast: 0, rain: 0 };
    const sky = r.sky || { t: 0.3, sun: 1 };
    const elev = sunElevation(sky.t);
    const sunK = Math.max(0, Math.min(1, sky.sun)) * (1 - 0.85 * (env.overcast || 0));
    const mood = { ...MOODS.day, sun: { ...MOODS.day.sun, elev } };
    const dir = sunDirection(mood, 0);
    // The light from straight above at noon on a clear day, kept at every hour: what the sun does not give, the fill does.
    const noon = this.sunDay * Math.sin((52 * Math.PI) / 180);
    const now = this.sunDay * sunK * dir.y;
    this.sun.intensity = this.sunDay * sunK;
    this.fill.intensity = Math.max(0, noon - now) * 0.95;
    this.sunDir = dir;
    this.sunK = sunK;
    return sunK;
  }

  /**
   * Fit the sun's shadow to the part of the ground in view (view tiles
   * u0..u1, v0..v1): shadows only for what can be seen, and none when the
   * view is so wide that a model is a few pixels, or no model is in view.
   * The map is redrawn only while it has something to show, and once more
   * when that ends (cleared); drawn once at the start too (a light with no
   * map yet would shade the ground as all shadow).
   */
  fitShadow(u0, v0, u1, v1, models) {
    if (!this.sun.castShadow) return false;
    const span = Math.max(u1 - u0, v1 - v0);
    const want = models > 0 && span < SHADOW_MAX;
    this.sun.shadow.needsUpdate = want || this.shadowLive || !this.sun.shadow.map;
    this.shadowLive = want;
    // (With nothing to show the models cast nothing into the redraw, so the map is cleared: ModelPass.setCasting.)
    if (!want) return false;
    const cu = (u0 + u1) / 2;
    const cv = (v0 + v1) / 2;
    const r = span * 0.75 + 3;
    const sc = this.sun.shadow.camera;
    sc.left = -r;
    sc.right = r;
    sc.top = r;
    sc.bottom = -r;
    sc.near = 0.5;
    sc.far = 4 * r + 40;
    sc.updateProjectionMatrix();
    const d = this.sunDir;
    this.sun.target.position.set(cu, 0, cv);
    this.sun.position.set(cu + d.x * (2 * r + 20), d.y * (2 * r + 20), cv + d.z * (2 * r + 20));
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
    return true;
  }

  /** Run `fn` with the renderer set up as the 3D world is drawn: ACES and sRGB on the screen. */
  withOutput(fn) {
    const gl = this.gl;
    const tm = gl.toneMapping;
    const cs = gl.outputColorSpace;
    const ex = gl.toneMappingExposure;
    gl.toneMapping = ACESFilmicToneMapping;
    gl.outputColorSpace = SRGBColorSpace;
    gl.toneMappingExposure = 1;
    try {
      return fn();
    } finally {
      gl.toneMapping = tm;
      gl.outputColorSpace = cs;
      gl.toneMappingExposure = ex;
    }
  }

  /** Draw the whole scene (the ground and the models, High) with `camera`. */
  render(camera) {
    this.withOutput(() => this.gl.render(this.scene, camera));
  }

  /** Draw the models alone (the ground hidden: drawn otherwise, or not at all). */
  renderModels(camera) {
    const g = this.groundSlot.visible;
    this.groundSlot.visible = false;
    try {
      this.render(camera);
    } finally {
      this.groundSlot.visible = g;
    }
  }

  /** Draw the build ghost alone, over everything drawn so far (the shadow map is not drawn again). */
  renderGhosts(camera) {
    const g = this.groundSlot.visible;
    const m = this.modelSlot.visible;
    const up = this.sun.shadow.needsUpdate;
    this.groundSlot.visible = false;
    this.modelSlot.visible = false;
    this.ghostSlot.visible = true;
    this.sun.shadow.needsUpdate = false;
    try {
      this.render(camera);
    } finally {
      this.groundSlot.visible = g;
      this.modelSlot.visible = m;
      this.ghostSlot.visible = false;
      this.sun.shadow.needsUpdate = up;
    }
  }

  /** The WebGL context came back: the sky's light was a render target, and the shadow map must be drawn again. */
  restored() {
    this.envDirty = true;
    this.shadowLive = true;
  }

  dispose() {
    if (this.env) this.env.dispose();
    this.env = null;
    this.sun.shadow.dispose();
    this.scene.clear();
  }
}
