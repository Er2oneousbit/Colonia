/**
 * ground/groundPass.js
 * ----------------------------------------------------------------------------
 * The 3D ground in the game: the WebGL back end (render3d/webglBackend.js)
 * draws it first each frame, in place of the ground's sprites, then its
 * models and sprite quads over it as before.
 *
 * What is 3D now, and what stays 2D (and why):
 *   - The ground is lit by the 3D world's light (render3d/sunRig.js: the
 *     sun, the sky's light, ACES and sRGB, in one scene with the models).
 *     The quads on top are the art's own bytes, never tone mapped (their
 *     shader writes its colour as it is, whatever the renderer's output).
 *   - The time of day moves the sun (high at noon, low and raking at
 *     morning and evening, so the ground's relief shows), and the season,
 *     snow cover, wetness and rain are uniforms that change smoothly. The
 *     night's darkness stays 2D (sunRig.js says why).
 *   - Building shadows stay the 2D art's shapes (drawn over the ground as
 *     before), except for buildings with a 3D model (the well, the
 *     fountain), which cast their real shadow from the sun's shadow map onto
 *     the ground (their 2D shape is then left out): the map is drawn with
 *     the models' opaque parts, just before the ground.
 *
 * Depth: the ground writes none, as the ground's sprites wrote none. The
 * sprite quads stand up like cutouts on the ground line of their depth
 * (projection.js), and some paint in front of that line (a walker's feet
 * and shadow, the flat footprints of an overlay): the ground's depth would
 * hide those pixels. What the depth did for the sprites' ground (hiding the
 * part of a rising model still under the ground) the models' own shader
 * does instead: nothing under the ground is drawn (materials.js uLookClipY).
 *
 * Quality: 'high' (two samples a kind against tiling, puddles, glitter,
 * model shadows, water moving) or 'low' (one sample a kind, no shadow map,
 * still water). Either way the ground alone is drawn into a texture (the
 * shader tone maps and encodes sRGB itself: GROUND_OWN_OUTPUT), at `scale`
 * of the WebGL canvas's pixels, and copied onto the canvas behind the
 * models (the copy goes only where no model wrote its depth): the ground's
 * shader is most of the GPU's work, so the render scale's Auto draws it at
 * a lower resolution first, where it shows least (a soft surface under
 * sharp sprites and models). High draws it every frame (its water moves),
 * after the models' opaque parts, whose shadows it takes from the sun's
 * shadow map drawn with them. Low keeps its picture: it is drawn again
 * only when what it shows changed (the camera, the map, the light, the
 * weather), so a still view costs a copy. (The ground's shader is most of a frame without a GPU: on
 * SwiftShader about 450 ms a frame on a 1600 x 900 view, against 75 ms for
 * a plain material, so Auto shows the flat sprites there.)
 *
 * Start-up never stalls the game: the texture arrays are painted on the
 * GPU (groundTextures.js, paint/painter.js: their programs compiled in the
 * background, the 20 layers then sent in one go, about 12 ms of the page's
 * time), and the ground's shader (a big one: compiled at its first draw it
 * froze a desktop for 2 s on ANGLE's D3D11) is compiled in the background
 * too (compileAsync, the KHR_parallel_shader_compile extension) as soon as
 * the back end starts, on a stand-in ground on the same arrays (the program
 * does not depend on their pixels). The ground's sprites are drawn until
 * both are ready. High keeps the sun's shadow map on always (it is only
 * redrawn while a model is in view), so the first well to come into view
 * never asks for another compile.
 * ----------------------------------------------------------------------------
 */

import {
  Scene, Group, Vector3, WebGLRenderTarget, UnsignedByteType, NoColorSpace, Mesh, PlaneGeometry,
  RawShaderMaterial, GLSL3, OrthographicCamera, NearestFilter, LinearFilter, LessEqualDepth,
} from 'three';
import { MONTH_LOOK } from '../../render/weather.js';
import { CONFIG } from '../../config.js';
import { groundTextures } from './groundTextures.js';
import { GameMap } from '../../world/map.js';
import { Ground, groundSnow } from './ground.js';
import { gameSiteHooks } from './groundSites.js';
import { SunRig } from '../sunRig.js';

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

/**
 * Low's ground is drawn at most at this share of the WebGL canvas's pixels
 * (each axis): panning redraws it every frame, and at a pixel ratio of 2
 * its full size cost a desktop GPU 17 ms a frame against about 10 here.
 */
export const LOW_SCALE = 0.75;

export class GroundPass {
  /**
   * @param {import('three').WebGLRenderer} gl
   * @param {string} quality 'high' or 'low'
   * @param {SunRig} [rig] the 3D world's light and scene (the back end's; one of its own without)
   */
  constructor(gl, quality = 'high', rig = null) {
    this.gl = gl;
    this.quality = quality;
    this.tex = null;
    this.ground = null;
    this.map = null;
    this.failed = false;
    this.loadMs = 0;
    this.ownRig = !rig;
    this.rig = rig || new SunRig(gl);
    this.scene = this.rig.scene;
    this.sun = this.rig.sun;
    this.fill = this.rig.fill;
    this.root = new Group();
    this.rig.groundSlot.add(this.root);
    // Low's kept picture (see the header): its texture, what it showed, and the copy's quad.
    this.cache = null;
    this.cacheKey = '';
    this.cacheDirty = true;
    this.stateKey = '';
    this.blit = null;
    this.redraws = 0; // pictures drawn into the cache (stats, tests)
    this.scale = 1; // the share of the WebGL canvas's pixels the ground is drawn at (setScale)
    this.liveAt = -Infinity; // when the live tiles were last read (sync)
    this.compiled = false;
    this.compileMs = 0;
    this.rig.setShadows(quality === 'high');
    // A ground shader that does not compile on this GPU: the ground's sprites come back (ready
    // false), rather than a map drawn as the bare background. (three reports it at its first use.)
    const report = gl.debug.onShaderError;
    this.shaderErrorWas = report;
    gl.debug.onShaderError = (ctx, program, vs, fs) => {
      // (The ground's own shader, or a program painting its layers: either way its sprites stay.)
      if (/groundSurface|paintNoises/.test(ctx.getShaderSource(fs) || '')) {
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
    }, (err) => {
      // (Layers the GPU could not paint: the flat ground for good, said once, rather than "loading" for ever.)
      this.failed = true;
      console.error('3D ground: its textures could not be painted on this GPU; the flat ground is drawn instead.', err);
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
    this.dropGround();
    this.warmed = false;
    this.warming = null;
    this.compiled = false;
    this.compiling = null;
    // What the other quality used: Low's kept picture, High's shadow map.
    if (q !== 'low') this.dropCache();
    this.rig.setShadows(q === 'high');
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

  /** The WebGL context came back: everything on the GPU is gone. */
  restored() {
    this.cacheDirty = true;
    // Compile in the background again (the painter paints the layers again on its own; the
    // back end has the rig make the sky's light and the shadow map again).
    this.warmed = false;
    this.warming = null;
    this.compiled = false;
    this.compiling = null;
  }

  /**
   * Bring the ground up to date for a frame of renderer `r`: its map (a new
   * game makes a new ground), what changed on it, the view turn, the time
   * of year and the weather, the light.
   */
  sync(r, camera) {
    this.rig.ensureEnv();
    if (!this.warmed && !this.warming) this.warmUp(camera);
    if (!this.ready) return false;
    const game = r.game;
    if (this.map !== game.map) {
      this.dropGround();
      const map = game.map;
      // (What the buildings and fires make of the ground: groundSites.js.)
      this.ground = new Ground(map, this.tex, { quality: this.quality, hooks: gameSiteHooks(game), ownOutput: true });
      // (No depth: see the header.)
      this.ground.material.depthWrite = false;
      this.ground.material.depthTest = false;
      this.root.add(this.ground.group);
      this.map = map;
    }
    const g = this.ground;
    // What changes between the map's revisions (a field growing, a fire going out) is read again
    // at most four times a second, and once a second at Low: each change there redraws its kept
    // picture, and twenty farms at a fast speed would otherwise redraw it nearly every frame.
    const now = performance.now();
    const live = now - this.liveAt >= (this.quality === 'low' ? 1000 : 250);
    if (live) this.liveAt = now;
    if (g.update(live)) this.cacheDirty = true;
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
        const job = this.withOutput(() => this.gl.compileAsync(this.root, camera, this.scene)).then(done, done);
        this.compiling = job;
        this.steps.push(['compile call', Math.round(performance.now() - t0)]);
      }
      return false;
    }
    // (The layers are painted in the background: the sprites draw until they are in.)
    return this.tex.ready;
  }

  /** The time of year and the weather (the sun is the rig's: sunRig.js light()). */
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
    this.ground.setReflection([0.5, 0.64, 0.82], 0.3, this.rig.light(r));
  }

  /**
   * Compile the ground's shader now, on a stand-in: a small empty map on
   * the layers' arrays (painted or not: the program does not depend on
   * their pixels), in the very scene (lights, sky, shadow) and output state
   * it will be drawn in (see the header).
   */
  warmUp(camera) {
    const t0 = performance.now();
    const stand = new Ground(new GameMap(16, 16), this.tex, { quality: this.quality, ownOutput: true });
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
    // (The ground alone, in the rig's light: three compiles what is hidden too, so not the scene.)
    const job = this.withOutput(() => this.gl.compileAsync(this.root, camera, this.scene)).then(done, done);
    this.warming = job;
  }

  /** Run `fn` with the models' slot hidden (Low's picture of the ground alone). */
  withoutModels(fn) {
    const slot = this.rig.modelSlot;
    const was = slot.visible;
    slot.visible = false;
    try {
      return fn();
    } finally {
      slot.visible = was;
    }
  }

  /**
   * Draw the ground with `camera` (the back end's), tone mapped and in sRGB,
   * behind what is drawn already (the models' opaque parts: the copy fills
   * only what no model covers). High draws its picture every frame, Low only
   * when `view` (the 2D camera's place, scale and turn) or what the ground
   * shows changed (see the header).
   */
  render(camera, view = '') {
    this.renderCached(camera, view, this.quality !== 'low');
  }

  /**
   * The share of the WebGL canvas's pixels the ground is drawn at (0.25 to
   * 1; the render scale's Auto, webglBackend.js). A new size draws again.
   */
  setScale(s) {
    const v = Math.max(0.25, Math.min(1, s || 1));
    if (v === this.scale) return;
    this.scale = v;
    this.cacheDirty = true;
  }

  /**
   * Run `fn` with the renderer set up as the ground is drawn. It is always
   * drawn into its own texture now, where three applies neither tone
   * mapping nor sRGB (the shader does both: GROUND_OWN_OUTPUT), so this
   * changes nothing: the compile runs under the very state the draw does.
   */
  withOutput(fn) {
    return fn();
  }

  /** What the ground shows, rounded so that a change too small to see redraws nothing. */
  groundState() {
    const u = this.ground.material.userData.ground;
    const q = (v, k = 100) => Math.round(v * k);
    return [
      this.ground.turn, q(u.uGSnow.value), q(u.uGWet.value, 50), q(u.uGVegAmt.value), q(u.uGDry.value), q(u.uGVeg.value.x, 400), q(u.uGVeg.value.y, 400),
      q(u.uGFlowers.value, 50), q(u.uGLeaves.value, 50),
      q(this.sun.intensity, 50), q(this.fill.intensity, 50), q(this.rig.sunDir.y),
    ].join(',');
  }

  renderCached(camera, view, always = false) {
    const gl = this.gl;
    const size = gl.getDrawingBufferSize(new Vector3());
    // (Low is the quality picked for speed: its ground at most LOW_SCALE of the canvas's pixels.)
    const k = this.quality === 'low' ? Math.min(this.scale, LOW_SCALE) : this.scale;
    const w = Math.max(1, Math.round(size.x * k));
    const h = Math.max(1, Math.round(size.y * k));
    if (!this.cache || this.cache.width !== w || this.cache.height !== h) {
      if (this.cache) this.cache.dispose();
      // Linear 8-bit: the shader writes its sRGB bytes itself (GROUND_OWN_OUTPUT). Copied pixel
      // for pixel, or stretched smoothly when drawn smaller.
      const filter = w === size.x && h === size.y ? NearestFilter : LinearFilter;
      this.cache = new WebGLRenderTarget(w, h, { type: UnsignedByteType, colorSpace: NoColorSpace, depthBuffer: false, minFilter: filter, magFilter: filter });
      this.cacheDirty = true;
    }
    const key = `${view}|${this.groundState()}`;
    if (always || this.cacheDirty || key !== this.cacheKey) {
      const prev = gl.getRenderTarget();
      const ac = gl.autoClear;
      gl.setRenderTarget(this.cache);
      gl.setClearColor(0x2a241c, 1);
      gl.clear(true, false, false);
      gl.autoClear = false;
      const t0 = this.redraws ? 0 : performance.now();
      this.withoutModels(() => gl.render(this.scene, camera));
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
    this.rig.groundSlot.remove(this.root);
    // (The rig is the back end's: it lights the models too. Its shadow map goes with Low or Off.)
    if (this.ownRig) this.rig.dispose();
    else this.rig.setShadows(false);
  }
}

/**
 * A quad over the whole picture that copies the ground's texture as it is,
 * at the far plane with the depth test on: where a model wrote its depth
 * the copy does not go, so the ground lands behind the models drawn first.
 */
function makeBlit() {
  const material = new RawShaderMaterial({
    glslVersion: GLSL3,
    uniforms: { map: { value: null } },
    vertexShader: `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`,
    fragmentShader: `
precision highp float;
uniform sampler2D map;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = texture(map, vUv); }`,
    depthTest: true,
    depthFunc: LessEqualDepth,
    depthWrite: false,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new Scene();
  scene.add(mesh);
  return { scene, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), mesh, material };
}
