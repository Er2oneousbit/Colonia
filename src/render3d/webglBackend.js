/**
 * webglBackend.js
 * ----------------------------------------------------------------------------
 * The WebGL back end (three.js): draws what Renderer.render() collected, the
 * same picture as the Classic back end, and can draw a building as a 3D model
 * (render3d/models.js: the look lab's well and fountain) where it has one. Opt-in (Settings > Renderer, or
 * ?renderer=3d); the Classic 2D canvas stays the default. It takes the calls
 * render/canvasBackend.js describes.
 *
 * How a frame is drawn:
 *   1. Every sprite is a textured quad on the device px that spriteRect()
 *      gives (render/items.js), so it lands where the 2D canvas puts it. A
 *      sprite's canvas is uploaded once as a texture, kept while the sprite
 *      cache keeps the sprite and freed when the cache lets it go
 *      (SpriteCache.onDrop: an old zoom level, last month's look, a snow
 *      level). Flat fills (overlay tints, building shadows) are triangles.
 *   2. What is painted live each frame (walkers, soldiers, ships, fires,
 *      standards, gateways, flags, crowds, stock, overlay columns, glints)
 *      is painted by the very functions the 2D canvas uses, into a cell of
 *      one texture of live art (liveBox.js says how big), uploaded once a
 *      frame and drawn as a quad like a sprite.
 *   3. Models are drawn first, with the depth buffer on (modelPass.js:
 *      instanced, a level of detail by the zoom, in the 3D world's light,
 *      sunRig.js; with the 3D ground at High in the same draw as the ground,
 *      casting their shadows on it). Then the
 *      quads, in the 2D renderer's order (back to front), each tested
 *      against the depth the models wrote but writing none: among
 *      themselves quads keep the painter's order exactly, so with no model
 *      on screen the picture is the 2D one; where a model is, a quad behind
 *      it (by D, projection.js) is hidden and one in front is blended over
 *      it as on the 2D canvas. Ground quads lie on the ground, the others
 *      stand up on the ground line of their depth (projection.js
 *      standDepth): a walker in front of a model's base shows whole and the
 *      model's top does not cut his head off.
 *   0. First of all, the 3D ground (ground/groundPass.js) when it is on
 *      and its textures are painted: one lit mesh per chunk of the map,
 *      tone mapped, in place of the ground's sprites (the renderer asks
 *      `drawsGround` and leaves them out). Settings > Ground: High, Low
 *      (phones; Auto picks it there) or Off (the sprites; Auto's choice
 *      without a GPU).
 *   4. The picture is copied onto the 2D canvas (present), and the renderer
 *      goes on there: particles, clouds, the night (which so darkens models
 *      too), the weather, signs, previews, outlines. So input, picking and
 *      the overlays work as they always did: the 2D canvas is still the one
 *      on the page.
 *
 * Draw calls: quads are batched in the painter's order, up to SLOTS textures
 * a batch (the fragment shader picks the texture by a per-vertex slot), so a
 * new texture only starts a new draw call when the batch has no free slot.
 * An atlas of all sprites would make that one call; not needed yet.
 *
 * A lost WebGL context (the GPU reset, too many contexts) makes `ready`
 * false and the renderer draws with the Classic back end until it is back.
 * ----------------------------------------------------------------------------
 */

import {
  WebGLRenderer, Scene, OrthographicCamera, Mesh, BufferGeometry, BufferAttribute, RawShaderMaterial,
  GLSL3, CanvasTexture, DataTexture, LinearFilter, CustomBlending, OneFactor, OneMinusSrcAlphaFactor,
  LessEqualDepth, Vector3, ColorManagement, LinearSRGBColorSpace, DynamicDrawUsage,
  DoubleSide, Box2, Vector2,
} from 'three';
import { HALF_W, HALF_H, CONFIG } from '../config.js';
import { K_STRIP, spriteRect } from '../render/items.js';
import { makeCanvas } from '../render/sprites.js';
import { hasModel, TILE_M } from './models.js';
import { liveBox } from './liveBox.js';
import { aimCamera, groundDepth, standDepth } from './projection.js';
import { GroundPass } from './ground/groundPass.js';
import { SunRig } from './sunRig.js';
import { ModelPass, lodFor } from './modelPass.js';
import { LOOK, paintSurfaces, resetLook } from './materials.js';
import { tileOfWorld } from '../render/camera.js';
import { GpuTimer } from './gpuTimer.js';
import { PostPass } from './postPass.js';
import { cloudPuffSpec, CLOUD_RGB } from '../render/ambient.js';
import { FLASH_RGB } from '../render/weather.js';
import { drawParticle, particleBox } from '../render/effects.js';
import { drawGulls } from '../render/waterArt.js';
import { AutoScale, startRung, fixedScale } from './renderScale.js';
import { gpuOf, isSoftwareGpu } from '../render/perf.js';

/** The 2D canvas's background (Renderer.render fills it first). */
const BACKGROUND = 0x2a241c;
/** Ground quads lie this much (D, tiles) behind the ground, so a model's foot is never painted over by the tile under it. */
const GROUND_BIAS = 0.02;
/** Textures one batch (one draw call) can hold; WebGL 2 promises 16 to a fragment shader. */
const MAX_SLOTS = 16;
/** The depth of what lies over the whole scene (particles, cloud shade, birds): in front of everything. */
const FRONT = Infinity;
/** Models draw nothing under this height (metres; a tile is 4): what rises out of the ground is hidden under it (materials.js uLookClipY). */
const MODEL_CLIP = -0.008;

const VERTEX = `
in vec3 position;
in vec2 uv;
in vec4 color;
in float slot;
out vec2 vUv;
out vec4 vColor;
flat out int vSlot;
void main() {
  vUv = uv;
  vColor = color;
  vSlot = int(slot + 0.5);
  gl_Position = vec4(position, 1.0);
}`;

/** The fragment shader for `n` texture slots: premultiplied texels times the item's color and alpha. */
function fragmentShader(n) {
  const pick = [];
  for (let i = 0; i < n; i++) pick.push(`${i ? 'else ' : ''}if (vSlot == ${i}) t = texture(maps[${i}], vUv);`);
  return `
precision highp float;
precision highp int;
uniform sampler2D maps[${n}];
in vec2 vUv;
in vec4 vColor;
flat in int vSlot;
out vec4 outColor;
void main() {
  vec4 t = vec4(0.0);
  ${pick.join('\n  ')}
  outColor = t * vec4(vColor.rgb * vColor.a, vColor.a);
}`;
}

/** A CSS color as straight [r, g, b, a] in 0..1 (cached: overlays and shadows repeat a few). */
const COLORS = new Map();
function rgbaOf(css) {
  let c = COLORS.get(css);
  if (c) return c;
  c = [1, 0, 1, 1];
  const m = /^rgba?\(([^)]*)\)$/.exec(css.trim());
  const hex = /^#([0-9a-f]{6})$/i.exec(css.trim());
  if (m) {
    const p = m[1].split(',').map(Number);
    c = [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1];
  } else if (hex) {
    const n = parseInt(hex[1], 16);
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  }
  if (COLORS.size > 512) COLORS.clear();
  COLORS.set(css, c);
  return c;
}

const WHITE = [1, 1, 1, 1];

export class WebGLBackend {
  /**
   * @param {import('../render/renderer.js').Renderer} r
   * Throws when WebGL is not available (the caller keeps the Classic back end).
   */
  constructor(r) {
    this.r = r;
    this.kind = 'webgl';
    // Its canvas is on the page, under the renderer's 2D overlay (Renderer.mountLayers): its
    // picture is never copied. `sceneScale` is the share of the view's device px it is drawn at.
    this.composes = true;
    this.sceneScale = 1;
    this.canvas = makeCanvas(r.camera.viewW, r.camera.viewH);
    // Colors are the art's bytes: no conversion to or from linear light anywhere.
    ColorManagement.enabled = false;
    // Multisampling smooths the models' edges, and costs a GPU in the processor (or none) dearly
    // for the whole picture: 2.3 times the frame under SwiftShader at a pixel ratio of 2. Only on
    // a graphics card, then (decided before the context, which keeps it for good).
    this.gpuClass = gpuClass(probeGpu());
    // (A laptop with two GPUs: the browser may still pick the one in the processor; the
    // performance readout names it and says how to change that.)
    this.gl = new WebGLRenderer({ canvas: this.canvas, antialias: this.gpuClass === 'card', alpha: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    const gl = this.gl;
    gl.outputColorSpace = LinearSRGBColorSpace;
    gl.autoClear = false;
    gl.sortObjects = false; // the quads' order is the painter's
    gl.setPixelRatio(1);
    gl.setClearColor(BACKGROUND, 1);
    gl.info.autoReset = false; // (both renders of a frame are counted: stats.drawCalls)
    this.lost = false;
    // The graphics chip it draws with (the performance readout names it), and the GPU's own time a frame.
    this.gpu = gpuOf(gl.getContext());
    this.gpuClass = gpuClass(this.gpu);
    this.timer = new GpuTimer(gl.getContext());
    // The render scale (setRenderScale): Auto's state, or null for a fixed share.
    this.auto = null;
    this.scaleChoice = '1';
    this.groundShare = 1; // the ground's share of the view's device px (the render scale's)
    this.autoLowered = false; // Auto took the ground from High to Low (frames too slow even at the lowest scale)
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.timer.reset();
      this.models.lose();
    }, false);
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      // (A restored context's extensions are new objects: the timer asks again.)
      this.timer = new GpuTimer(gl.getContext());
      this.rig.restored();
      this.postPass.restored();
      this.models.restored();
      if (this.groundPass) this.groundPass.restored();
    }, false);
    // The look's materials (render3d/materials.js) paint their textures on this GPU; smaller on a
    // software GL (no GPU: SwiftShader on the CI), where painting them full size is slow.
    LOOK.renderer = gl;
    LOOK.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    LOOK.textureScale = softwareGL(gl) ? 0.25 : 1;
    LOOK.uniforms.uLookClipY.value = MODEL_CLIP;
    LOOK.uniforms.uLookMetres.value = TILE_M;
    paintSurfaces();
    // The 3D world's scene and light (the ground and the models share them), and the models.
    this.rig = new SunRig(gl);
    this.models = new ModelPass(gl, this.rig);
    // The night and the flash over the scene (postPass.js), and the cloud shade's soft disc.
    this.postPass = new PostPass(gl);
    this.puffTex = null;
    this.layers = null; // this frame's (post)
    // The 3D ground (setGround): null while it is off.
    this.groundPass = null;
    this.groundMode = 'off';
    this.drawsGround = false;
    this.modelShadows = false;

    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.zA = 0;
    this.zB = 0;
    this.placed = []; // this frame's models: { b, T, state, snow, vx, vy, rise }
    this.ghosts = []; // this frame's build ghosts drawn as models: { type, x, y, size, T, vx, vy, ok, snow }

    // Quads: one mesh, its groups drawn in order, each group a batch of up to `slots` textures.
    this.slots = Math.max(1, Math.min(MAX_SLOTS, gl.capabilities.maxTextures || 16));
    this.frag = fragmentShader(this.slots);
    this.quadScene = new Scene();
    this.cap = 0;
    this.grow(1 << 14);
    this.materials = [];
    this.mesh = new Mesh(this.geometry, this.materials);
    this.mesh.frustumCulled = false;
    this.quadScene.add(this.mesh);
    this.white = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    this.white.needsUpdate = true;

    // Sprite textures, one per cached sprite, freed with it.
    this.textures = new Map(); // sprite -> CanvasTexture
    r.sprites.onDrop = (spr) => this.dropSprite(spr);

    // The live art of a frame: cells in one texture (ATLAS stands for it in a batch until it is uploaded).
    this.atlas = makeCanvas(1, 1);
    this.actx = this.atlas.getContext('2d');
    this.atlasTex = null;
    this.atlasSrc = null; // the same canvas as a source for uploading part of it (never drawn)
    this.region = new Box2(new Vector2(), new Vector2());
    this.atlasUsed = 0; // rows painted last frame (cleared before this frame's)
    this.lives = []; // this frame's: { draw, x, y, w, h, cx, cy }
    this.atlasVerts = []; // first vertex of each live quad (its uv is in px until the atlas size is known)
    this.frame = 0;
  }

  /** Can it draw? Not while its WebGL context is lost. */
  get ready() { return !this.lost; }

  /**
   * The 3D ground: 'high', 'low', 'off' (the ground's sprites, as before),
   * or 'auto' (low on a software GL or a touch screen, else high). Off frees
   * its textures; the painted layers stay in memory for the next time.
   */
  setGround(mode = 'auto') {
    this.groundAuto = mode === 'auto';
    const q = mode === 'auto' ? autoGround(this.gl, this.gpuClass) : mode;
    this.groundMode = q;
    if (q === 'off') {
      if (this.groundPass) this.groundPass.dispose();
      this.groundPass = null;
      return q;
    }
    if (!this.groundPass) this.groundPass = new GroundPass(this.gl, q, this.rig);
    else this.groundPass.setQuality(q);
    this.groundPass.setScale(this.groundShare / this.sceneScale);
    return q;
  }

  /**
   * Settings > Render scale (renderScale.js): 'auto', or a share of the
   * view's device px ('1', '0.75', '0.5') for the 3D scene and its ground.
   * Auto starts where this GPU suggests and adapts to the frame time.
   */
  setRenderScale(choice = 'auto') {
    const c = String(choice);
    this.scaleChoice = c;
    const fixed = fixedScale(c);
    if (fixed) {
      this.auto = null;
      this.applyScale(fixed);
      return;
    }
    this.auto = new AutoScale(startRung(this.gpuClass, this.r.camera.dpr));
    this.auto.reset(performance.now());
    this.applyScale(this.auto.step);
  }

  /** Draw the scene at `scene` of the view's device px, its ground at `ground` (both per axis). */
  applyScale({ scene, ground }) {
    this.sceneScale = scene;
    this.groundShare = Math.min(ground, scene);
    if (this.groundPass) this.groundPass.setScale(this.groundShare / scene);
  }

  /**
   * After each frame (App.frame): `interval` ms since the last frame,
   * `pageMs` the page's work for it. Auto steps the scale (renderScale.js);
   * at its lowest step and still slow, an Auto ground at High goes to Low
   * once (and stays there until the ground is chosen again).
   */
  tune(interval, pageMs, now = performance.now()) {
    const a = this.auto;
    if (!a || this.lost) return;
    if (a.frame(interval, pageMs, this.timer.ms, now)) this.applyScale(a.step);
    if (a.exhausted && this.groundAuto && this.groundMode === 'high' && !this.autoLowered) {
      this.autoLowered = true;
      this.setGround('low');
      this.groundAuto = true;
      a.exhausted = false;
      a.slowAtBottom = 0;
    }
  }

  /** Is a building type drawn as a 3D model now (it has one, and its textures and programs are ready)? */
  hasModel(type) { return hasModel(type) && this.models.ready; }

  /** Room for `n` vertices (a new geometry: three.js keeps a buffer's size once uploaded). */
  grow(n) {
    let cap = this.cap || 1024;
    while (cap < n) cap *= 2;
    if (cap === this.cap) return;
    const old = this.geometry;
    const keep = this.n || 0;
    const g = new BufferGeometry();
    const attr = (name, size) => {
      const a = new BufferAttribute(new Float32Array(cap * size), size);
      a.setUsage(DynamicDrawUsage);
      if (old) a.array.set(old.getAttribute(name).array.subarray(0, keep * size));
      g.setAttribute(name, a);
      return a.array;
    };
    this.pos = attr('position', 3);
    this.uv = attr('uv', 2);
    this.col = attr('color', 4);
    this.slot = attr('slot', 1);
    this.cap = cap;
    this.geometry = g;
    if (this.mesh) this.mesh.geometry = g;
    if (old) old.dispose();
  }

  // --------------------------------------------------------------- a frame

  begin() {
    const r = this.r;
    const cam = r.camera;
    this.frame++;
    // (Every frame: a restored context comes back with three.js's default black.)
    this.gl.setClearColor(BACKGROUND, 1);
    // Drawn at the render scale's share of the view's device px; the page stretches it to the view
    // (Renderer.sizeLayers). Everything here is placed in the view's device px all the same.
    const w = Math.max(1, Math.round(cam.viewW * this.sceneScale));
    const h = Math.max(1, Math.round(cam.viewH * this.sceneScale));
    if (this.canvas.width !== w || this.canvas.height !== h) this.gl.setSize(w, h, false);
    this.sceneSize = `${w}x${h}`;
    this.postFrom = -1;
    this.layers = null;
    const map = r.game.map;
    // Depths from behind the map's back corner to past its front, with room for tall art.
    aimCamera(this.camera, cam, -60, map.w + map.h + 60);
    // D -> the depth buffer's z, straight from the camera (two points of known D: 0 and 1).
    const p0 = new Vector3(0, 0, 0).project(this.camera);
    const p1 = new Vector3(1, 0, 0).project(this.camera);
    this.zB = p0.z;
    this.zA = p1.z - p0.z;
    this.k = cam.scale;
    this.camY = cam.y;
    this.sx = 2 / cam.viewW;
    this.sy = 2 / cam.viewH;
    this.n = 0;
    this.batches = [];
    this.batchStart = 0;
    this.batchTex = [];
    this.slotOf = new Map();
    this.lives.length = 0;
    this.atlasVerts.length = 0;
    this.shelfX = 0;
    this.shelfY = 0;
    this.shelfH = 0;
    this.maxTex = this.gl.capabilities.maxTextureSize || 4096;
    this.atlasW = Math.min(this.maxTex, Math.max(1024, 2 ** Math.ceil(Math.log2(cam.viewW + 2))));
    this.dropped = 0;
    this.placed.length = 0;
    this.ghosts.length = 0;
    // The 3D world's light for this hour and sky (the ground's and the models').
    this.rig.ensureEnv();
    this.rig.light(r);
    // The renderer leaves the ground's sprites out while this draws the ground.
    this.drawsGround = !!this.groundPass && this.groundPass.sync(r, this.camera);
    this.modelShadows = this.drawsGround && this.groundPass.quality === 'high';
    // The models' programs, compiled in the background for the light they are drawn in.
    this.models.warm(this.camera, this.rig.sun.castShadow);
    // (Never waiting silently: a GPU that will not ready them is told to the console and the readout.)
    this.models.watch();
  }

  /** The slot of texture `tex` in the batch being filled (a new batch when it is full). */
  slotFor(tex) {
    let s = this.slotOf.get(tex);
    if (s !== undefined) return s;
    if (this.batchTex.length >= this.slots) this.closeBatch();
    s = this.batchTex.length;
    this.batchTex.push(tex);
    this.slotOf.set(tex, s);
    return s;
  }

  closeBatch() {
    if (this.n > this.batchStart) this.batches.push({ start: this.batchStart, count: this.n - this.batchStart, tex: this.batchTex });
    this.batchStart = this.n;
    this.batchTex = [];
    this.slotOf = new Map();
  }

  /** The texture of a cached sprite (uploaded the first time it is drawn). */
  texOf(spr) {
    let t = this.textures.get(spr);
    if (!t) {
      // (Premultiplied: the canvas's own pixels, blended as drawImage blends them.)
      t = liveTexture(spr.canvas);
      this.textures.set(spr, t);
    }
    return t;
  }

  /** The sprite cache let a sprite go: free its texture. */
  dropSprite(spr) {
    const t = spr && this.textures.get(spr);
    if (!t) return;
    t.dispose();
    this.textures.delete(spr);
  }

  /** One vertex: device px (x, y), depth D (FRONT: before everything), texture coordinates, straight color and alpha, slot. */
  vert(x, y, D, u, v, c, a, s) {
    const i = this.n++;
    const p = this.pos;
    p[i * 3] = x * this.sx - 1;
    p[i * 3 + 1] = 1 - y * this.sy;
    p[i * 3 + 2] = D === FRONT ? -1 : this.zA * D + this.zB;
    this.uv[i * 2] = u;
    this.uv[i * 2 + 1] = v;
    const q = this.col;
    q[i * 4] = c[0];
    q[i * 4 + 1] = c[1];
    q[i * 4 + 2] = c[2];
    q[i * 4 + 3] = c[3] * a;
    this.slot[i] = s;
  }

  /** D at device px row y: on the ground (d < 0) or standing on the ground line of depth d. */
  depthAt(y, d) {
    if (d === FRONT) return FRONT;
    const Y = this.camY + y / this.k;
    return d < 0 ? groundDepth(Y) - GROUND_BIAS : standDepth(d, Y);
  }

  /** A textured rectangle (device px), texture coordinates u0..u1, v0..v1. */
  rect(tex, x0, y0, x1, y1, u0, v0, u1, v1, d, c = WHITE, a = 1) {
    if (this.n + 6 > this.cap) this.grow(this.n + 6);
    const s = this.slotFor(tex);
    const dt = this.depthAt(y0, d);
    const db = this.depthAt(y1, d);
    this.vert(x0, y0, dt, u0, v0, c, a, s);
    this.vert(x1, y0, dt, u1, v0, c, a, s);
    this.vert(x0, y1, db, u0, v1, c, a, s);
    this.vert(x1, y0, dt, u1, v0, c, a, s);
    this.vert(x1, y1, db, u1, v1, c, a, s);
    this.vert(x0, y1, db, u0, v1, c, a, s);
  }

  /** A cached sprite (or strip j of n of it) anchored at world px (wx, wy). `d` < 0: on the ground. */
  sprite(spr, wx, wy, d, j = 0, n = 0, alpha = 1) {
    const q = spriteRect(spr, wx, wy, this.r.camera, j, n);
    if (!q) return;
    this.rect(this.texOf(spr), q.dx, q.dy, q.dx + q.dw, q.dy + q.dh, q.sx / spr.w, 0, (q.sx + q.sw) / spr.w, 1, d, WHITE, alpha);
  }

  /** A polygon (device px), star-shaped from its last point, in a CSS color. */
  poly(pts, css, d) {
    const c = rgbaOf(css);
    const m = pts.length;
    if (this.n + 3 * (m - 2) > this.cap) this.grow(this.n + 3 * (m - 2));
    const s = this.slotFor(this.white);
    const o = pts[m - 1];
    const Do = this.depthAt(o[1], d);
    for (let q = 0; q + 2 < m; q++) {
      const a = pts[q];
      const b = pts[q + 1];
      this.vert(o[0], o[1], Do, 0.5, 0.5, c, 1, s);
      this.vert(a[0], a[1], this.depthAt(a[1], d), 0.5, 0.5, c, 1, s);
      this.vert(b[0], b[1], this.depthAt(b[1], d), 0.5, 0.5, c, 1, s);
    }
  }

  /**
   * Something painted live this frame, `draw(ctx)` in screen device px
   * inside `box`: a cell of the live-art texture is kept for it and it is
   * painted there in present(); its quad goes in the painter's order now.
   */
  live(draw, box, d) {
    const cam = this.r.camera;
    const x0 = Math.max(0, Math.floor(box[0]));
    const y0 = Math.max(0, Math.floor(box[1]));
    const x1 = Math.min(cam.viewW, Math.ceil(box[2]));
    const y1 = Math.min(cam.viewH, Math.ceil(box[3]));
    const w = Math.min(x1 - x0, this.atlasW);
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    // Shelf packing: cells side by side in rows, a new row when one is full (a 1 px gap between cells).
    if (this.shelfX + w > this.atlasW) {
      this.shelfY += this.shelfH + 1;
      this.shelfX = 0;
      this.shelfH = 0;
    }
    if (this.shelfY + h > this.maxTex) { this.dropped++; return; } // (the texture cannot grow so far: left out this frame)
    const cx = this.shelfX;
    const cy = this.shelfY;
    this.shelfX += w + 1;
    this.shelfH = Math.max(this.shelfH, h);
    this.lives.push({ draw, x: x0, y: y0, w, h, cx, cy });
    this.atlasVerts.push(this.n);
    this.rect(ATLAS, x0, y0, x0 + w, y1, cx, cy, cx + w, cy + h, d);
  }

  ground(spr, wx, wy) { this.sprite(spr, wx, wy, -1); }

  groundFill(wx, wy, color) {
    const cam = this.r.camera;
    const k = cam.scale;
    const x = (wx - cam.x) * k;
    const y = (wy - cam.y) * k;
    // (The four corners of Renderer.fillDiamond's tile, from the top round.)
    this.poly([[x, y], [x + HALF_W * k, y + HALF_H * k], [x, y + CONFIG.TILE_H * k], [x - HALF_W * k, y + HALF_H * k]], color, -1);
  }

  groundLive(draw, box) { this.live(draw, box, -1); }

  fill(pts, color) { this.poly(pts, color, -1); }

  model(b, place) {
    this.placed.push({ b, ...place });
  }

  /** The build ghost of a type drawn as a model (Renderer.placeGhostModels): drawn as that model, see-through and tinted. */
  ghostModel(g) {
    this.ghosts.push(g);
  }

  items(items) {
    const r = this.r;
    const cam = r.camera;
    for (const it of items) {
      if (it.kind === K_STRIP) {
        this.sprite(it.spr, it.wx, it.wy, it.d, it.full ? 0 : it.j, it.full ? 0 : it.n, it.alpha || 1);
      } else {
        this.live((ctx) => r.drawLive(ctx, it), liveBox(it, cam), it.d);
      }
    }
  }

  /**
   * What lies over the scene and under the night (Renderer.render): the
   * particles, the gulls over the fishing grounds and the birds, painted as
   * live art like a walker; the cloud shade's puffs as quads of one soft
   * disc; then (present) the night and the lightning's flash (postPass.js).
   * All after the build ghost, in front of everything, in the 2D canvas's
   * order: particles, gulls, clouds, birds.
   */
  post(layers) {
    const r = this.r;
    const cam = r.camera;
    this.closeBatch();
    this.postFrom = this.batches.length;
    this.layers = layers;
    for (const p of layers.particles) this.live((ctx) => drawParticle(ctx, p, cam), particleBox(p, cam), FRONT);
    for (const g of layers.gulls) this.live((ctx) => drawGulls(ctx, g.sx, g.sy, g.k, g.t, g.seed), g.box, FRONT);
    if (layers.puffs.length) {
      const tex = this.puffTexture();
      const rgb = CLOUD_RGB.split(',').map((v) => Number(v) / 255);
      for (const p of layers.puffs) {
        const h = p.r * (tex.image.height / tex.image.width);
        this.rect(tex, p.sx - p.r, p.sy - h, p.sx + p.r, p.sy + h, 0, 0, 1, 1, FRONT, [rgb[0], rgb[1], rgb[2], p.alpha], 1);
      }
    }
    for (const f of layers.flocks) this.live((ctx) => r.ambient.drawFlock(ctx, f, cam, r.time), r.ambient.flockBox(f, cam), FRONT);
  }

  /** The cloud shade's puff (ambient.js cloudPuffSpec), white, as a texture (made once). */
  puffTexture() {
    if (this.puffTex) return this.puffTex;
    const spec = cloudPuffSpec(512);
    const c = makeCanvas(spec.w, spec.h);
    spec.draw(c.getContext('2d'));
    this.puffTex = liveTexture(c);
    return this.puffTex;
  }

  // --------------------------------------------------------------- drawing

  /**
   * Paint the frame's live art into its texture. The canvas only grows (a
   * new texture then, uploaded whole); otherwise only the rows used this
   * frame are uploaded (copyTextureToTexture from the canvas, through a
   * texture that is never drawn): uploading a 2048 px wide canvas whole
   * every frame was most of a frame's cost under SwiftShader.
   */
  paintLive() {
    const used = this.lives.length ? this.shelfY + this.shelfH : 0;
    const W = this.atlasW;
    const a = this.atlas;
    let fresh = false;
    if (a.width !== W || a.height < used || !this.atlasTex) {
      let H = 256;
      while (H < used) H *= 2;
      a.width = W;
      a.height = H;
      if (this.atlasTex) this.atlasTex.dispose();
      this.atlasTex = liveTexture(a);
      this.atlasSrc = liveTexture(a);
      this.atlasUsed = 0;
      fresh = true;
    }
    const ctx = this.actx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, Math.max(used, this.atlasUsed));
    this.atlasUsed = used;
    const r = this.r;
    const origin = r.liveOrigin;
    try {
      for (const L of this.lives) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(L.cx, L.cy, L.w, L.h);
        ctx.clip();
        ctx.setTransform(1, 0, 0, 1, L.cx - L.x, L.cy - L.y);
        origin[0] = L.cx - L.x;
        origin[1] = L.cy - L.y;
        try {
          L.draw(ctx);
        } finally {
          ctx.restore();
        }
      }
    } finally {
      // (Back to the 2D canvas's own even if art threw: the Classic back end may draw the next frame.)
      origin[0] = 0;
      origin[1] = 0;
    }
    if (used && !fresh) this.gl.copyTextureToTexture(this.atlasSrc, this.atlasTex, this.region.set(this.region.min.set(0, 0), this.region.max.set(W, used)));
    // The live quads' texture coordinates were in px: now the size is known.
    const uv = this.uv;
    for (const v0 of this.atlasVerts) {
      for (let i = v0; i < v0 + 6; i++) {
        uv[i * 2] /= W;
        uv[i * 2 + 1] /= a.height;
      }
    }
  }

  present() {
    const r = this.r;
    // (The GPU's time from here: the live art's upload is GPU work too.)
    this.timer.poll();
    this.timer.begin();
    this.closeBatch();
    this.paintLive();
    // Batches -> the mesh's groups, each with its textures (unused slots hold white).
    const g = this.geometry;
    g.clearGroups();
    this.batches.forEach((b, i) => {
      let m = this.materials[i];
      if (!m) {
        m = new RawShaderMaterial({
          glslVersion: GLSL3,
          vertexShader: VERTEX,
          fragmentShader: this.frag,
          uniforms: { maps: { value: new Array(this.slots).fill(this.white) } },
          transparent: true,
          side: DoubleSide, // (quads are wound as the screen's rows run, which WebGL calls the back)
          forceSinglePass: true, // (or three.js draws a transparent two-sided batch twice, back faces then front)
          depthTest: true,
          depthWrite: false,
          depthFunc: LessEqualDepth,
          blending: CustomBlending,
          blendSrc: OneFactor,
          blendDst: OneMinusSrcAlphaFactor,
          blendSrcAlpha: OneFactor,
          blendDstAlpha: OneMinusSrcAlphaFactor,
        });
        this.materials[i] = m;
      }
      const maps = m.uniforms.maps.value;
      for (let s = 0; s < this.slots; s++) {
        const t = b.tex[s];
        maps[s] = t === ATLAS ? this.atlasTex : t || this.white;
      }
      g.addGroup(b.start, b.count, i);
    });
    g.setDrawRange(0, this.n);
    for (const name of ['position', 'uv', 'color', 'slot']) {
      const a = g.getAttribute(name);
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.n * a.itemSize);
      a.needsUpdate = true;
    }
    // The scene's groups and those over it (post): the build ghost is drawn between them.
    const split = this.postFrom >= 0 ? g.groups.findIndex((gr) => gr.materialIndex >= this.postFrom) : -1;
    const sceneGroups = split >= 0 ? g.groups.slice(0, split) : g.groups.slice();
    const postGroups = split >= 0 ? g.groups.slice(split) : [];
    const gl = this.gl;
    gl.info.reset();
    gl.clear(true, true, true);
    const cam = r.camera;
    // This frame's models, instanced, at the level of detail of this zoom (modelPass.js).
    // (Low takes the simpler model a zoom step sooner: it is the quality picked for speed.)
    const built = this.models.update(r, this.placed, lodFor(this.groundMode === 'low' ? cam.scale / 2 : cam.scale), this.ghosts);
    const models = built;
    if (this.drawsGround || models || this.ghosts.length) {
      const vw = cam.viewW / cam.scale;
      const vh = cam.viewH / cam.scale;
      const c = [tileOfWorld(cam.x, cam.y), tileOfWorld(cam.x + vw, cam.y), tileOfWorld(cam.x, cam.y + vh), tileOfWorld(cam.x + vw, cam.y + vh)];
      // The sun's shadow over the view (High), the models casting into it, or left out while it is
      // cleared. (Fitted even while the ground is still loading: a lit program samples the map, and
      // one never drawn is no texture at all.)
      const shadows = this.rig.fitShadow(Math.min(...c.map((q) => q.x)), Math.min(...c.map((q) => q.y)), Math.max(...c.map((q) => q.x)), Math.max(...c.map((q) => q.y)), models);
      this.models.setCasting(shadows);
    }
    if (this.drawsGround) {
      const gp = this.groundPass;
      // The models' opaque parts (with the sun's shadow map, High), the ground's picture copied in
      // behind them (drawn at its own scale: groundPass.js), then their water over it.
      if (models) this.rig.renderModels(this.camera, 'opaque');
      gp.render(this.camera, `${cam.x},${cam.y},${cam.scale},${cam.viewW},${cam.viewH},${cam.turn}`);
      if (models && this.rig.hasSeeThrough()) this.rig.renderModels(this.camera, 'see-through');
    } else if (models) {
      this.rig.renderModels(this.camera);
    }
    g.groups = sceneGroups;
    gl.render(this.quadScene, this.camera);
    // The build ghost over the sprites, as the 2D ghost is drawn (sunRig.js renderGhosts).
    if (this.ghosts.length) this.rig.renderGhosts(this.camera);
    if (postGroups.length) {
      g.groups = postGroups;
      gl.render(this.quadScene, this.camera);
    }
    g.groups = sceneGroups.concat(postGroups);
    // The night, then the lightning's flash, over all of it (the 2D canvas's steps, on the GPU).
    const L = this.layers;
    if (L && L.night) this.postPass.night(L.night.tint, L.night.lights, cam.viewW, cam.viewH, this.sceneScale);
    if (L && L.flash > 0) this.postPass.flash(FLASH_RGB.split(',').map((v) => Number(v) / 255), L.flash, cam.viewW, cam.viewH);
    this.timer.end();
    // (Nothing is copied: this canvas is on the page, the renderer's 2D layers over it.)
    const st = r.stats;
    st.gpuMs = this.timer.ms;
    st.sceneScale = this.sceneScale;
    st.models = built;
    // (By type, their triangles, the level of detail: the smoke test and the console read them.)
    st.modelPass = this.models.stats;
    st.drawCalls = gl.info.render.calls;
    st.textures = this.textures.size;
    st.live = this.lives.length;
    st.liveDropped = this.dropped;
    st.liveTexture = `${this.atlas.width}x${this.atlas.height}`;
    st.ground = this.groundPass ? (this.drawsGround ? this.groundMode : this.groundPass.failed ? 'failed' : 'loading') : 'off';
    // (When the ground's layers were painted on the GPU, from its pass's start.)
    st.groundMs = this.groundPass ? Math.round(this.groundPass.loadMs) : 0;
    st.groundTexReady = this.groundPass ? this.groundPass.texturesReady : false;
    st.groundRedraws = this.groundPass ? this.groundPass.redraws : 0;
    st.groundCompileMs = this.groundPass ? Math.round(this.groundPass.compileMs) : 0;
    st.groundSteps = this.groundPass ? this.groundPass.steps : null;
  }

  /** Free everything on the GPU (the player went back to the Classic renderer). */
  dispose() {
    if (this.r.sprites.onDrop) this.r.sprites.onDrop = null;
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    if (this.atlasTex) this.atlasTex.dispose();
    this.white.dispose();
    if (this.puffTex) this.puffTex.dispose();
    this.postPass.dispose();
    for (const m of this.materials) m.dispose();
    this.geometry.dispose();
    this.models.dispose();
    if (this.groundPass) this.groundPass.dispose();
    this.groundPass = null;
    this.rig.dispose();
    // The look's textures were painted on this renderer: a new one paints its own.
    resetLook();
    if (LOOK.renderer === this.gl) LOOK.renderer = null;
    this.gl.dispose();
    this.gl.forceContextLoss();
  }
}

/** A texture of a canvas painted as the 2D canvas paints: premultiplied, top row first, no mipmaps. */
function liveTexture(canvas) {
  const t = new CanvasTexture(canvas);
  t.flipY = false;
  t.premultiplyAlpha = true;
  t.generateMipmaps = false;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  return t;
}

/**
 * The 3D ground's quality on this device when the player leaves it to the
 * game: off (the flat sprites) on a software GL (no GPU: SwiftShader,
 * llvmpipe, as on the CI), low on touch screens (phones and tablets), high
 * elsewhere.
 */
function autoGround(renderer, cls = 'card') {
  // Without a GPU the ground's shader is a slideshow (groundPass.js): the flat sprites then.
  if (cls === 'software' || softwareGL(renderer)) return 'off';
  // A GPU in the processor (a laptop's Intel UHD ran High at 100% and sluggish): Low, which keeps
  // its picture while the view is still. The render scale's Auto also draws it smaller there.
  if (cls === 'integrated') return 'low';
  try {
    if (window.matchMedia('(pointer: coarse)').matches) return 'low';
  } catch {
    // No media queries.
  }
  return 'high';
}

/** 'card', 'integrated' (a GPU in the processor) or 'software' (none), from gpuOf(). */
function gpuClass(gpu) {
  if (gpu.software) return 'software';
  if (gpu.integrated) return 'integrated';
  return 'card';
}

/** The GPU the browser will draw with, asked of a throwaway context (before the real one's options are chosen). */
function probeGpu() {
  try {
    if (typeof document === 'undefined') return { name: '', integrated: false, software: false };
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2', { powerPreference: 'high-performance' });
    if (!g) return { name: '', integrated: false, software: false };
    const out = gpuOf(g);
    g.getExtension('WEBGL_lose_context')?.loseContext();
    return out;
  } catch {
    return { name: '', integrated: false, software: false };
  }
}

/** Does this renderer draw without a GPU (SwiftShader, llvmpipe: the CI)? False when it cannot tell. */
function softwareGL(renderer) {
  return isSoftwareGpu(gpuOf(renderer.getContext()).name);
}

/** Stands for the live-art texture in a batch: it is only made, or remade bigger, once the frame's art is all in. */
const ATLAS = { isAtlas: true };
