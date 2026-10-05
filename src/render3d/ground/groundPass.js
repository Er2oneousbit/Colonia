/**
 * ground/groundPass.js
 * ----------------------------------------------------------------------------
 * The 3D ground in the game: the WebGL back end (render3d/webglBackend.js)
 * draws it first each frame, in place of the ground's sprites, then its
 * models and sprite quads over it as before.
 *
 * What is 3D now, and what stays 2D (and why):
 *   - The ground is lit by the 3D look's light: a sun (from the upper left
 *     of the screen at every view turn, as the art's light is), the sky as
 *     image-based light (three's Sky in a PMREM, made once), ACES tone
 *     mapping and sRGB output. Only the ground goes through them: the quads
 *     on top are the art's own bytes, never tone mapped (their shader
 *     writes its colour as it is, whatever the renderer's output settings).
 *   - The time of day moves the sun (high at noon, low and raking at
 *     morning and evening, so the ground's relief shows), and the season,
 *     snow cover, wetness and rain are uniforms that change smoothly.
 *   - The darkness of night and of an overcast sky stays 2D: the renderer
 *     multiplies the whole picture by its light map after the scene
 *     (render/lighting.js), with its warm pools of lamplight. Done twice the
 *     ground would sink into black under sprites tinted once; so the ground
 *     keeps its daylight key at every hour and in every weather: as the sun
 *     sinks or clouds come, a sky light (a hemisphere light) makes up the
 *     light the sun no longer gives, and only the light's direction and
 *     softness change (no hard shadows under cloud or at night).
 *   - Building shadows stay the 2D art's shapes (drawn over the ground as
 *     before), except for buildings with a 3D model (the well), which cast
 *     their real shadow from the sun's shadow map onto the ground (their 2D
 *     shape is then left out).
 *
 * Depth: the ground writes none, as the ground's sprites wrote none. The
 * sprite quads stand up like cutouts on the ground line of their depth
 * (projection.js), and some paint in front of that line (a walker's feet
 * and shadow, the flat footprints of an overlay): the ground's depth would
 * hide those pixels. What the depth did for the sprites' ground (hiding the
 * part of a rising model still under the ground) a clipping plane at the
 * ground does for the models instead (GROUND_CLIP, webglBackend.js).
 *
 * Quality: 'high' (two samples a kind against tiling, puddles, glitter,
 * model shadows, water moving) or 'low' (one sample a kind, no shadow map,
 * still water: for phones). Low keeps its picture: the ground is drawn into
 * a texture only when what it shows changed (the camera, the map, the
 * light, the weather), and each frame copies that texture, so a still view
 * costs a copy. (The ground's shader is most of a frame without a GPU: on
 * SwiftShader about 450 ms a frame on a 1600 x 900 view, against 75 ms for
 * a plain material, so Auto shows the flat sprites there.)
 *
 * Start-up never stalls the game: the texture arrays hold stand-ins at
 * once (groundTextures.js) and are uploaded one a frame, the painted layers
 * (from the browser's cache, or the paint pool's workers) going in a layer
 * at a time as they come, and the ground's shader
 * (a big one: compiled at its first draw it froze a desktop for 2 s on
 * ANGLE's D3D11) is compiled in the background (compileAsync, the
 * KHR_parallel_shader_compile extension) as soon as the back end starts,
 * on a stand-in ground with placeholder textures (the program does not
 * depend on them), so the one frame that still waits on it (ANGLE links
 * the program on the GPU process's own thread: about 0.6 s on that
 * desktop) falls among the start-up's own slow frames. The ground's
 * sprites are drawn until the shader is ready (not the painted layers: the
 * stand-ins do meanwhile). High keeps the sun's shadow map on always (it
 * is only redrawn while a model is in view), so the first well to come into
 * view never asks for another compile.
 * ----------------------------------------------------------------------------
 */

import {
  Scene, Group, DirectionalLight, HemisphereLight, PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace, Vector3,
  MeshBasicMaterial, PCFShadowMap, Plane, WebGLRenderTarget, UnsignedByteType, NoColorSpace, Mesh, PlaneGeometry,
  RawShaderMaterial, GLSL3, OrthographicCamera, NearestFilter,
} from 'three';
import { MOODS, sunDirection, makeSkyParts, skyEnvironment, moodColor } from '../look.js';
import { MONTH_LOOK } from '../../render/weather.js';
import { CONFIG } from '../../config.js';
import { groundTextures } from './groundTextures.js';
import { GameMap } from '../../world/map.js';
import { Ground, groundSnow } from './ground.js';

/** Models are cut off here (a building rising out of the ground shows nothing under it). */
export const GROUND_CLIP = Object.freeze([new Plane(new Vector3(0, 1, 0), 0)]);
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

/**
 * The season's position along the 2D art's looks (weather.js MONTH_LOOK:
 * 0 winter, 1 spring, 2 summer, 3 autumn), moving through the month day by
 * day instead of in the art's monthly steps. null month: seasons off.
 */
export function seasonPos(month, dayFrac = 0) {
  if (month === null || month === undefined) return 2;
  const m = ((month % 12) + 12) % 12;
  const a = MONTH_LOOK[m];
  let b = MONTH_LOOK[(m + 1) % 12];
  if (b < a - 2) b += 4; // autumn (3.5) on into winter (0 = 4)
  return (a + (b - a) * dayFrac) % 4;
}

export class GroundPass {
  /** @param {import('three').WebGLRenderer} gl */
  constructor(gl, quality = 'high') {
    this.gl = gl;
    this.quality = quality;
    this.tex = null;
    this.ground = null;
    this.map = null;
    this.failed = false;
    this.loadMs = 0;
    this.scene = new Scene();
    this.root = new Group();
    this.scene.add(this.root);
    const day = MOODS.day;
    this.sunDay = day.sun.intensity;
    this.envDay = day.env;
    this.sun = new DirectionalLight(0xffffff, this.sunDay);
    moodColor(day.sun.color, this.sun.color);
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 2;
    this.scene.add(this.sun, this.sun.target);
    // Makes up the light the sun no longer gives (see the header).
    this.fill = new HemisphereLight(0xffffff, 0xffffff, 0);
    this.fill.color.setRGB(0.78, 0.86, 1.0);
    this.fill.groundColor.setRGB(0.55, 0.47, 0.38);
    this.scene.add(this.fill);
    this.env = null;
    this.envDirty = true;
    this.casters = new Map(); // model pool key -> { template, proxies: [] }
    this.hidden = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false });
    this.hidden.name = 'shadow-only';
    // Low's kept picture (see the header): its texture, what it showed, and the copy's quad.
    this.cache = null;
    this.cacheKey = '';
    this.cacheDirty = true;
    this.stateKey = '';
    this.blit = null;
    this.redraws = 0; // pictures drawn into the cache (stats, tests)
    this.compiled = false;
    this.compileMs = 0;
    this.sun.castShadow = quality === 'high';
    this.sun.shadow.autoUpdate = false;
    this.shadowLive = false;
    // (On from the start: the shader is compiled for the state it is drawn in.
    // The models' lights cast no shadow, so their shaders do not change.)
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = PCFShadowMap;
    // A ground shader that does not compile on this GPU: the ground's sprites come back (ready
    // false), rather than a map drawn as the bare background. (three reports it at its first use.)
    const report = gl.debug.onShaderError;
    this.shaderErrorWas = report;
    gl.debug.onShaderError = (ctx, program, vs, fs) => {
      if (/groundSurface/.test(ctx.getShaderSource(fs) || '')) {
        this.failed = true;
        console.warn('3D ground: its shader failed on this GPU; the flat ground is drawn instead.');
      }
      if (report) report(ctx, program, vs, fs);
      else console.error('THREE.WebGLProgram: shader error', ctx.getProgramInfoLog(program));
    };
    this.steps = []; // [what, ms] of the start-up steps (stats, measuring)
    // The layers, painted on this GPU in the background (paint/painter.js),
    // compiled alongside the ground's own shader; the ground's sprites draw
    // until both are ready.
    this.t0 = performance.now();
    this.tex = groundTextures(gl, Math.min(8, gl.capabilities.getMaxAnisotropy()));
    this.tex.whenReady.then(() => {
      // (At least 1: already painted, a renderer switched off and on.)
      this.loadMs = Math.max(1, performance.now() - this.t0);
      this.cacheDirty = true;
    });
  }

  /** Can the ground be drawn (its shader did not fail)? */
  get ready() { return !this.failed; }

  /** Are all the layers painted? */
  get texturesReady() { return !!this.tex && this.tex.ready; }

  /** Draw at another quality: the material is remade (the textures are kept) and compiled again in the background. */
  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this.sun.castShadow = q === 'high';
    this.dropGround();
    this.warmed = false;
    this.warming = null;
    this.compiled = false;
    this.compiling = null;
    // What the other quality used: Low's kept picture, High's shadow map.
    if (q !== 'low') this.dropCache();
    if (q !== 'high' && this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
  }

  /** Free Low's kept picture and its copy. */
  dropCache() {
    if (this.cache) this.cache.dispose();
    this.cache = null;
    if (this.blit) {
      this.blit.mesh.geometry.dispose();
      this.blit.material.dispose();
      this.blit = null;
    }
    this.cacheDirty = true;
  }

  dropGround() {
    if (this.ground) {
      this.root.remove(this.ground.group);
      this.ground.dispose();
    }
    this.ground = null;
    this.map = null;
    // (A new map's ground has the same shader, already compiled: no need to compile again.)
    this.cacheDirty = true;
  }

  /** The WebGL context came back: the sky's light was a render target, make it again. */
  restored() {
    this.envDirty = true;
    this.cacheDirty = true;
    // Everything on the GPU is gone: compile in the background again (the painter paints the
    // layers again on its own), and draw the shadow map at once (a map with no texture reads
    // as all shadow).
    this.warmed = false;
    this.warming = null;
    this.compiled = false;
    this.compiling = null;
    this.shadowLive = true;
  }

  /**
   * Bring the ground up to date for a frame of renderer `r`: its map (a new
   * game makes a new ground), what changed on it, the view turn, the time
   * of year and the weather, the light.
   */
  sync(r, camera) {
    this.ensureEnv();
    if (!this.warmed && !this.warming) this.warmUp(camera);
    if (!this.ready) return false;
    const game = r.game;
    if (this.map !== game.map) {
      this.dropGround();
      const map = game.map;
      const farmAt = (i) => {
        const id = map.building[i];
        if (!id) return false;
        const b = game.buildings.get(id);
        return !!b && b.def.kind === 'farm';
      };
      this.ground = new Ground(map, this.tex, { quality: this.quality, farmAt, buildingAt: (i) => map.building[i] !== 0, ownOutput: this.quality === 'low' });
      // (No depth: see the header.)
      this.ground.material.depthWrite = false;
      this.ground.material.depthTest = false;
      this.root.add(this.ground.group);
      this.map = map;
    }
    const g = this.ground;
    if (g.update()) this.cacheDirty = true;
    g.setTurn(r.viewTurn);
    this.light(r);
    if (!this.compiled) {
      // Compiled in the background; the sprites stand in meanwhile. (After
      // the warm-up, and for a new map's ground, three finds the program
      // made already.)
      if (!this.compiling && this.warmed) {
        const t0 = performance.now();
        const done = () => {
          if (this.compiling !== job) return; // (dropped meanwhile)
          this.compiled = true;
          this.compiling = null;
          this.compileMs = performance.now() - t0;
        };
        // Under the very state it is drawn in (render(): tone mapping, output), or three compiles another program at the first draw.
        const job = this.withOutput(() => this.gl.compileAsync(this.scene, camera)).then(done, done);
        this.compiling = job;
        this.steps.push(['compile call', Math.round(performance.now() - t0)]);
      }
      return false;
    }
    // (The layers are painted in the background: the sprites draw until they are in.)
    return this.tex.ready;
  }

  /** The time of year, the weather and the light (see the header: the night's darkness is the 2D tint's). */
  light(r) {
    const game = r.game;
    const env = r.env || { sun: 1, overcast: 0, rain: 0 };
    const w = r.weather;
    const seasons = r.seasonsOn;
    const weatherOn = r.weatherOn;
    const time = game.time;
    const dayFrac = (time.day + time.tick / CONFIG.TICKS_PER_DAY) / CONFIG.DAYS_PER_MONTH;
    this.ground.setSky({
      season: seasonPos(seasons ? time.month : null, dayFrac),
      snow: weatherOn && seasons ? groundSnow(w.cover) : 0,
      wet: weatherOn ? w.wet || 0 : 0,
      rain: weatherOn ? env.rain : 0,
      // (Low keeps its picture: its water stands still.)
      time: r.motionOn && this.quality !== 'low' ? r.time : 0,
    });
    // The sun: its height by the time of day, its strength by the sky's.
    const sky = r.sky;
    const elev = sunElevation(sky.t);
    const sunK = Math.max(0, Math.min(1, sky.sun)) * (1 - 0.85 * (env.overcast || 0));
    const mood = { ...MOODS.day, sun: { ...MOODS.day.sun, elev } };
    const dir = sunDirection(mood, 0);
    // The light the ground gets from straight above at noon on a clear day,
    // kept at every hour: what the sun does not give, the fill does.
    const noon = this.sunDay * Math.sin((52 * Math.PI) / 180);
    const now = this.sunDay * sunK * dir.y;
    this.sun.intensity = this.sunDay * sunK;
    this.fill.intensity = Math.max(0, noon - now) * 0.95;
    this.sunDir = dir;
    this.ground.setReflection([0.5, 0.64, 0.82], 0.3, sunK);
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

  /**
   * Compile the ground's shader now, on a stand-in: a small empty map on
   * the layers' arrays (painted or not: the program does not depend on
   * their pixels), in the very scene (lights, sky, shadow) and output state
   * it will be drawn in (see the header).
   */
  warmUp(camera) {
    const t0 = performance.now();
    const stand = new Ground(new GameMap(16, 16), this.tex, { quality: this.quality, ownOutput: this.quality === 'low' });
    stand.material.depthWrite = false;
    stand.material.depthTest = false;
    this.root.add(stand.group);
    const quality = this.quality;
    const done = () => {
      this.root.remove(stand.group);
      stand.dispose();
      // (A quality changed or the context was lost meanwhile: the next frame warms that up.)
      if (this.warming !== job) return;
      this.warming = null;
      if (quality === this.quality) this.warmed = true;
      this.steps.push(['warm-up', Math.round(performance.now() - t0)]);
    };
    const job = this.withOutput(() => this.gl.compileAsync(this.scene, camera)).then(done, done);
    this.warming = job;
  }

  /**
   * Shadow casters for this frame's models: a copy of each placed model,
   * drawn into the sun's shadow map only (a material that writes nothing).
   * `placed` lists { key, holder } of the back end's models.
   */
  syncCasters(placed) {
    for (const c of this.casters.values()) c.used = 0;
    if (!this.sun.castShadow) placed = []; // (Low: no shadow map, no copies drawn)
    for (const p of placed) {
      let c = this.casters.get(p.key);
      if (!c) {
        c = { proxies: [], used: 0 };
        this.casters.set(p.key, c);
      }
      let proxy = c.proxies[c.used];
      if (!proxy) {
        proxy = p.holder.clone();
        proxy.traverse((o) => {
          if (!o.isMesh) return;
          o.material = this.hidden;
          o.castShadow = true;
        });
        this.scene.add(proxy);
        c.proxies.push(proxy);
      }
      c.used++;
      proxy.visible = true;
      proxy.position.copy(p.holder.position);
      proxy.rotation.copy(p.holder.rotation);
    }
    for (const c of this.casters.values()) for (let i = c.used; i < c.proxies.length; i++) c.proxies[i].visible = false;
  }

  /** The back end freed a model's look: forget its copies (they share its geometry, freed with it). */
  dropCaster(key) {
    const c = this.casters.get(key);
    if (!c) return;
    for (const p of c.proxies) this.scene.remove(p);
    this.casters.delete(key);
  }

  /**
   * Fit the sun's shadow to the part of the ground in view (view tiles
   * u0..u1, v0..v1): shadows only for what can be seen, and none when the
   * view is so wide that a model is a few pixels.
   */
  fitShadow(u0, v0, u1, v1, models) {
    if (!this.sun.castShadow) return;
    const span = Math.max(u1 - u0, v1 - v0);
    const want = models > 0 && span < SHADOW_MAX;
    // The map is redrawn only while it has something to show, and once more when that ends (cleared).
    // (Drawn once at the start too: a light with no map yet would shade the ground as all shadow.)
    this.sun.shadow.needsUpdate = want || this.shadowLive || !this.sun.shadow.map;
    this.shadowLive = want;
    if (!want) {
      for (const c of this.casters.values()) for (const p of c.proxies) p.visible = false;
      return;
    }
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
    const d = this.sunDir || new Vector3(0, 1, 0);
    this.sun.target.position.set(cu, 0, cv);
    this.sun.position.set(cu + d.x * (2 * r + 20), d.y * (2 * r + 20), cv + d.z * (2 * r + 20));
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
  }

  /**
   * Draw the ground with `camera` (the back end's): tone mapped and in
   * sRGB, which only it is. Low: from its kept picture, drawn again only
   * when `view` (the 2D camera's place, scale and turn) or what the ground
   * shows changed.
   */
  render(camera, view = '') {
    if (this.quality === 'low') {
      this.renderCached(camera, view);
      return;
    }
    this.withOutput(() => this.gl.render(this.scene, camera));
  }

  /**
   * Run `fn` with the renderer set up as the ground is drawn: ACES and sRGB
   * on the screen (High). Low draws into its own texture, where three
   * applies neither (the shader does: GROUND_OWN_OUTPUT), so it changes
   * nothing.
   */
  withOutput(fn) {
    if (this.quality === 'low') return fn();
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

  /** What the ground shows, rounded so that a change too small to see redraws nothing. */
  groundState() {
    const u = this.ground.material.userData.ground;
    const q = (v, k = 100) => Math.round(v * k);
    return [
      this.ground.turn, q(u.uGSnow.value), q(u.uGWet.value, 50), q(u.uGVegAmt.value), q(u.uGDry.value), q(u.uGVeg.value.x, 400), q(u.uGVeg.value.y, 400),
      q(this.sun.intensity, 50), q(this.fill.intensity, 50), q(this.sunDir ? this.sunDir.y : 1),
    ].join(',');
  }

  renderCached(camera, view) {
    const gl = this.gl;
    const size = gl.getDrawingBufferSize(new Vector3());
    const w = Math.max(1, size.x);
    const h = Math.max(1, size.y);
    if (!this.cache || this.cache.width !== w || this.cache.height !== h) {
      if (this.cache) this.cache.dispose();
      // Linear 8-bit: the shader writes its sRGB bytes itself (GROUND_OWN_OUTPUT).
      this.cache = new WebGLRenderTarget(w, h, { type: UnsignedByteType, colorSpace: NoColorSpace, depthBuffer: false, minFilter: NearestFilter, magFilter: NearestFilter });
      this.cacheDirty = true;
    }
    const key = `${view}|${this.groundState()}`;
    if (this.cacheDirty || key !== this.cacheKey) {
      const prev = gl.getRenderTarget();
      const ac = gl.autoClear;
      gl.setRenderTarget(this.cache);
      gl.setClearColor(0x2a241c, 1);
      gl.clear(true, false, false);
      gl.autoClear = false;
      const t0 = this.redraws ? 0 : performance.now();
      gl.render(this.scene, camera);
      if (!this.redraws) this.steps.push(['first draw', Math.round(performance.now() - t0)]);
      gl.autoClear = ac;
      gl.setRenderTarget(prev);
      this.cacheKey = key;
      this.cacheDirty = false;
      this.redraws++;
    }
    if (!this.blit) this.blit = makeBlit();
    this.blit.material.uniforms.map.value = this.cache.texture;
    gl.render(this.blit.scene, this.blit.camera);
  }

  dispose() {
    this.dropGround();
    this.dropCache();
    this.gl.debug.onShaderError = this.shaderErrorWas;
    if (this.tex) this.tex.dispose();
    this.tex = null;
    if (this.env) this.env.dispose();
    this.env = null;
    this.hidden.dispose();
    for (const c of this.casters.values()) for (const p of c.proxies) this.scene.remove(p);
    this.casters.clear();
    this.sun.shadow.dispose();
  }
}

/** A quad over the whole picture that copies a texture's bytes as they are (Low's kept picture). */
function makeBlit() {
  const material = new RawShaderMaterial({
    glslVersion: GLSL3,
    uniforms: { map: { value: null } },
    vertexShader: `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`,
    fragmentShader: `
precision highp float;
uniform sampler2D map;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = texture(map, vUv); }`,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new Scene();
  scene.add(mesh);
  return { scene, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), mesh, material };
}
