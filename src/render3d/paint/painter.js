/**
 * paint/painter.js
 * ----------------------------------------------------------------------------
 * Paints the procedural textures on the GPU: the look's surfaces (each into
 * its own three render targets: albedo, normal, occlusion/roughness/
 * metalness) and the ground's layers (each into a layer of three array
 * render targets), from the recipes of surfaces.js and
 * ground/groundSurfaces.js (paint/recipe.js says how one is written).
 *
 * A texture is a few full-screen draws (paint/recipe.js: fields, blur,
 * the height's range for a ground layer, albedo, ORM, normal), a fraction
 * of a millisecond each on a desktop GPU: what painting costs is compiling
 * its programs. So there are few: one per set of recipes (the look's
 * surfaces, the ground's layers: a uniform picks the recipe, and the
 * texture's seed and noises are uniforms too) and one for the passes they
 * share. They are compiled in the background (three's compileAsync, the
 * KHR_parallel_shader_compile extension: the page never waits on the GPU
 * process's compiler) and everything queued is painted as soon as they
 * are ready, in one go.
 *
 * The output targets exist from the moment a texture is asked for (the
 * materials are made on them; their pixels are undefined until painted:
 * the lab draws its first frame and the game its 3D ground only once
 * `ready`). They keep their mipmaps (made once a texture's last draw is in)
 * and are painted again after a lost WebGL context.
 *
 * Where a texture's numbers are wanted on the CPU (the street's paving is a
 * mesh displaced by the basalt's low-passed height), they are read back
 * once, asynchronously (a pixel buffer and a fence: the page does not wait
 * for the GPU to finish).
 * ----------------------------------------------------------------------------
 */

import {
  WebGLRenderTarget, WebGLArrayRenderTarget, RawShaderMaterial, GLSL3, Mesh, BufferGeometry, BufferAttribute, Scene,
  OrthographicCamera, FloatType, HalfFloatType, UnsignedByteType, RGBAFormat, NearestFilter, LinearFilter,
  LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, NoColorSpace, DataTexture, Vector4,
} from 'three';
import { recipeShader, packRecipe, UTIL_SHADER } from './recipe.js';
import { MAX_NOISES } from './glsl.js';

const VERTEX = /* glsl */ `
in vec3 position;
void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }
`;

/** How many recipes go into one program (see Painter.program). */
export const RECIPES_A_PROGRAM = 4;

/** One painter per renderer (a WebGL context's targets and programs belong to it). */
const PAINTERS = new WeakMap();

/** The painter of `renderer`, made at its first use. */
export function painterFor(renderer) {
  let p = PAINTERS.get(renderer);
  if (!p) {
    p = new Painter(renderer);
    PAINTERS.set(renderer, p);
  }
  return p;
}

/**
 * The output targets of one texture: a surface's three 2D targets (albedo
 * in sRGB; normal and ORM linear), mipmapped, repeating, `size` px square.
 */
export function surfaceTargets(size, anisotropy = 1) {
  const make = (srgb) => {
    const rt = new WebGLRenderTarget(size, size, {
      type: UnsignedByteType, format: RGBAFormat, colorSpace: srgb ? SRGBColorSpace : NoColorSpace,
      wrapS: RepeatWrapping, wrapT: RepeatWrapping, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter,
      generateMipmaps: true, depthBuffer: false, stencilBuffer: false, anisotropy,
    });
    return rt;
  };
  return { albedo: make(true), normal: make(false), orm: make(false) };
}

/** The same as array targets of `count` layers (the ground's: one sampler picks a layer by its kind). */
export function arrayTargets(size, count, anisotropy = 1) {
  const make = (srgb) => {
    const rt = new WebGLArrayRenderTarget(size, size, count, {
      type: UnsignedByteType, format: RGBAFormat, colorSpace: srgb ? SRGBColorSpace : NoColorSpace,
      wrapS: RepeatWrapping, wrapT: RepeatWrapping, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter,
      generateMipmaps: true, depthBuffer: false, stencilBuffer: false, anisotropy,
    });
    return rt;
  };
  return { albedo: make(true), normal: make(false), orm: make(false) };
}

export class Painter {
  /** @param {import('three').WebGLRenderer} renderer */
  constructor(renderer) {
    this.gl = renderer;
    /** Jobs waiting for their programs. */
    this.queue = [];
    /** Jobs painted (painted again after a lost context). */
    this.painted = [];
    /** Programs by set: { material, sets: [recipes], key }. */
    this.programs = new Map();
    this.compiling = null;
    this.scheduled = false;
    /** How many textures were painted, and how long the GPU's queue took to take them (ms, the page's side). */
    this.stats = { textures: 0, paints: 0, submitMs: 0, compileMs: 0, programs: 0 };
    this.lost = false;
    const caps = renderer.capabilities;
    const ext = renderer.extensions;
    // Float fields where the GPU can render them (every desktop, SwiftShader); half floats, then bytes, elsewhere.
    this.fieldType = ext.has('EXT_color_buffer_float') ? FloatType : ext.has('EXT_color_buffer_half_float') ? HalfFloatType : UnsignedByteType;
    this.webgl2 = caps.isWebGL2 !== false;
    this.dummy = new DataTexture(new Float32Array(4), 1, 1, RGBAFormat, FloatType);
    this.dummy.needsUpdate = true;
    const geo = new BufferGeometry();
    // One triangle over the whole target (no seam down a diagonal).
    geo.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new Mesh(geo, null);
    this.quad.frustumCulled = false;
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.util = this.material(UTIL_SHADER, {
      uMode: { value: 0 }, uSrc: { value: this.dummy }, uSrc2: { value: this.dummy }, uRad: { value: new Vector4() },
      uBlock: { value: 1 }, uWF: { value: new Vector4(1, 0, 0, 0) }, uWB: { value: new Vector4() }, uK: { value: 1 },
    }, 'paint-util');
    this.scratch = new Map();
    const canvas = renderer.domElement;
    if (canvas && canvas.addEventListener) {
      canvas.addEventListener('webglcontextlost', () => { this.lost = true; }, false);
      // (three listens first and has its new context up by now.)
      canvas.addEventListener('webglcontextrestored', () => this.restored(), false);
    }
  }

  material(fragmentShader, uniforms, name) {
    const m = new RawShaderMaterial({
      glslVersion: GLSL3, vertexShader: VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false,
    });
    m.name = name;
    return m;
  }

  /**
   * The program painting recipe `index` of a set: the set's recipes go
   * RECIPES_A_PROGRAM to a program (uRecipe picks one), made at the first
   * ask with all of its recipes. Measured on ANGLE's D3D11, compiling the 28
   * recipes side by side: 0.77 s as two programs, 0.43 s as eight, 0.75 s
   * as 28 (each program has a cost of its own, and one program compiles on
   * one thread however many recipes it holds).
   */
  program(set, index = 0) {
    const chunk = Math.floor(index / RECIPES_A_PROGRAM);
    const key = `${set.key}:${chunk}`;
    let p = this.programs.get(key);
    if (p) return p;
    const u = {
      uStage: { value: 0 }, uRecipe: { value: 0 }, uGround: { value: 0 }, uSize: { value: 1 }, uSeed: { value: 0 },
      uF: { value: this.dummy }, uB: { value: this.dummy }, uRange: { value: this.dummy },
      uNa: { value: new Float32Array(MAX_NOISES * 4) }, uNb: { value: new Float32Array(MAX_NOISES * 4) },
      uNc: { value: new Float32Array(MAX_NOISES * 4) }, uNd: { value: new Float32Array(MAX_NOISES * 4) },
      uNCount: { value: 0 },
    };
    const recipes = set.recipes.slice(chunk * RECIPES_A_PROGRAM, (chunk + 1) * RECIPES_A_PROGRAM);
    p = { key, material: this.material(recipeShader(recipes), u, `paint-${key}`), ready: false };
    this.programs.set(key, p);
    this.stats.programs = this.programs.size + 1;
    return p;
  }

  /**
   * Paint a texture. job: { set: { key, recipes }, index (the recipe in the
   * set), seed, size, out: surfaceTargets() or arrayTargets(), layer (an
   * array's), ground (alpha = the height, normalised), readHeight (resolve
   * with B's y channel as a Float32Array, size x size) }. Resolves when
   * painted (and read back).
   */
  paint(job) {
    return new Promise((resolve, reject) => {
      job.resolve = resolve;
      job.reject = reject;
      this.queue.push(job);
      this.program(job.set, job.index);
      this.schedule();
    });
  }

  /** Are all the textures asked for painted? */
  get idle() { return !this.queue.length && !this.compiling; }

  schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    // (After the caller has queued the rest of its textures: one compile, one go.)
    queueMicrotask(() => {
      this.scheduled = false;
      this.run();
    });
  }

  /**
   * Start compiling now, not at the end of the caller's task: a page that
   * asks for its textures and then builds its models for a while lets the
   * GPU's side compile meanwhile.
   */
  start() {
    this.run();
  }

  /** Compile what the queue needs (in the background), then paint it all. */
  run() {
    if (!this.queue.length || this.compiling || this.lost) return;
    const want = [this.util, ...[...this.programs.values()].filter((p) => !p.ready).map((p) => p.material)];
    const t0 = performance.now();
    const scene = new Scene();
    for (const m of want) {
      const mesh = new Mesh(this.quad.geometry, m);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
    const gl = this.gl;
    const job = (gl.compileAsync ? gl.compileAsync(scene, this.camera) : Promise.resolve(gl.compile(scene, this.camera)))
      .catch(() => {})
      .then(() => {
        if (this.compiling !== job) return;
        this.compiling = null;
        this.stats.compileMs += performance.now() - t0;
        for (const p of this.programs.values()) p.ready = true;
        this.flush();
      });
    this.compiling = job;
  }

  /** Paint everything queued, now (the programs are compiled). */
  flush() {
    if (this.lost) return;
    const jobs = this.queue;
    this.queue = [];
    if (!jobs.length) return;
    const gl = this.gl;
    const t0 = performance.now();
    const keep = {
      target: gl.getRenderTarget(), face: gl.getActiveCubeFace(), level: gl.getActiveMipmapLevel(),
      autoClear: gl.autoClear, clipping: gl.clippingPlanes, local: gl.localClippingEnabled,
    };
    gl.autoClear = false;
    gl.clippingPlanes = [];
    gl.localClippingEnabled = false;
    // An array target's mipmaps are made once, at the last layer drawn into it (not at every layer).
    const last = new Map();
    for (const j of jobs) for (const rt of Object.values(j.out)) last.set(rt, j);
    for (const rt of last.keys()) {
      rt.texture.generateMipmaps = true;
      gl.initRenderTarget(rt);
    }
    const reads = [];
    try {
      for (const j of jobs) {
        for (const rt of Object.values(j.out)) if (rt.isWebGLArrayRenderTarget) rt.texture.generateMipmaps = last.get(rt) === j;
        const read = this.paintOne(j);
        if (read) reads.push([j, read]);
        else j.resolve(j);
        if (!this.painted.includes(j)) this.painted.push(j);
        this.stats.textures++;
      }
    } catch (err) {
      for (const j of jobs) j.reject(err);
      throw err;
    } finally {
      for (const rt of last.keys()) rt.texture.generateMipmaps = true;
      gl.setRenderTarget(keep.target, keep.face, keep.level);
      gl.autoClear = keep.autoClear;
      gl.clippingPlanes = keep.clipping;
      gl.localClippingEnabled = keep.local;
      this.dropScratch();
    }
    this.stats.paints++;
    this.stats.submitMs += performance.now() - t0;
    for (const [j, read] of reads) {
      read.then((h) => {
        j.height = h;
        j.resolve(j);
      }, j.reject);
    }
  }

  /** Float scratch targets of a size (fields, a blur's half way, the blur; the range's two steps). */
  scratchOf(n) {
    let s = this.scratch.get(n);
    if (s) return s;
    const rt = (w) => new WebGLRenderTarget(w, w, {
      type: this.fieldType, format: RGBAFormat, minFilter: NearestFilter, magFilter: NearestFilter,
      generateMipmaps: false, depthBuffer: false, stencilBuffer: false,
    });
    const block = Math.max(1, Math.min(16, n >> 4));
    s = { F: rt(n), T: rt(n), B: rt(n), block, R16: rt(Math.max(1, Math.ceil(n / block))), R1: rt(1) };
    this.scratch.set(n, s);
    return s;
  }

  dropScratch() {
    for (const s of this.scratch.values()) for (const k of ['F', 'T', 'B', 'R16', 'R1']) s[k].dispose();
    this.scratch.clear();
  }

  draw(material, target, layer = 0) {
    this.quad.material = material;
    this.gl.setRenderTarget(target, layer);
    this.gl.render(this.quad, this.camera);
  }

  /** The passes of one texture (paint/recipe.js); returns the height's read-back promise, if it wants one. */
  paintOne(job) {
    const n = job.size;
    const p = this.program(job.set, job.index);
    const r = job.set.recipes[job.index];
    const pk = packRecipe(r);
    const s = this.scratchOf(n);
    const u = p.material.uniforms;
    const util = this.util.uniforms;
    const table = (t) => {
      u.uNa.value = t.a;
      u.uNb.value = t.b;
      u.uNc.value = t.c;
      u.uNd.value = t.d;
      u.uNCount.value = t.count;
    };
    // Fields (nothing bound that is drawn into: WebGL refuses a feedback loop).
    table(pk.fields);
    u.uRecipe.value = job.index % RECIPES_A_PROGRAM;
    u.uSeed.value = job.seed | 0;
    u.uSize.value = n;
    u.uStage.value = 0;
    u.uF.value = this.dummy;
    u.uB.value = this.dummy;
    u.uRange.value = this.dummy;
    u.uGround.value = job.ground ? 1 : 0;
    this.draw(p.material, s.F);
    // The blur (separable, wrapping), or B is F.
    let B = s.F;
    if (pk.blur.some((x) => x > 0)) {
      util.uRad.value.set(...pk.blur);
      util.uMode.value = 0;
      util.uSrc.value = s.F.texture;
      util.uSrc2.value = this.dummy;
      this.draw(this.util, s.T);
      util.uMode.value = 1;
      util.uSrc.value = s.T.texture;
      this.draw(this.util, s.B);
      B = s.B;
    }
    // A ground layer's height range (its alpha is the height, normalised as the shader blends by it).
    if (job.ground) {
      util.uMode.value = 2;
      util.uSrc.value = s.F.texture;
      util.uSrc2.value = this.dummy;
      util.uBlock.value = s.block;
      this.draw(this.util, s.R16);
      util.uMode.value = 3;
      util.uSrc.value = s.R16.texture;
      util.uBlock.value = s.R16.width;
      this.draw(this.util, s.R1);
    }
    // Albedo, then occlusion/roughness/metalness.
    table(pk.colour);
    u.uF.value = s.F.texture;
    u.uB.value = B.texture;
    u.uRange.value = job.ground ? s.R1.texture : this.dummy;
    const layer = job.layer || 0;
    u.uStage.value = 1;
    this.draw(p.material, job.out.albedo, layer);
    u.uStage.value = 2;
    this.draw(p.material, job.out.orm, layer);
    // The normal map.
    util.uMode.value = 4;
    util.uSrc.value = s.F.texture;
    util.uSrc2.value = B.texture;
    util.uWF.value.set(...pk.normal.F);
    util.uWB.value.set(...pk.normal.B);
    util.uK.value = pk.normal.depth * n;
    this.draw(this.util, job.out.normal, layer);
    util.uSrc.value = this.dummy;
    util.uSrc2.value = this.dummy;
    u.uF.value = this.dummy;
    u.uB.value = this.dummy;
    u.uRange.value = this.dummy;
    if (!job.readHeight || job.height) return null;
    // B's y (the low-passed height), read back without waiting on the GPU.
    const buf = new Float32Array(n * n * 4);
    const read = this.fieldType === FloatType
      ? this.gl.readRenderTargetPixelsAsync(B, 0, 0, n, n, buf)
      : Promise.reject(new Error('the GPU cannot read float targets back'));
    return read.then(() => {
      const h = new Float32Array(n * n);
      for (let i = 0; i < n * n; i++) h[i] = buf[i * 4 + 1];
      return h;
    });
  }

  /** Targets freed by their owner: never painted (again). Their jobs settle as they are (unpainted). */
  forget(out) {
    const gone = (j) => j.out === out;
    for (const j of this.queue.filter(gone)) j.resolve(j);
    this.queue = this.queue.filter((j) => !gone(j));
    this.painted = this.painted.filter((j) => !gone(j));
  }

  /** The context came back: its targets are blank and its programs gone; compile and paint everything again. */
  restored() {
    this.lost = false;
    this.compiling = null;
    for (const p of this.programs.values()) p.ready = false;
    const again = this.painted.filter((j) => !this.queue.includes(j));
    for (const j of again) {
      j.resolve = () => {};
      j.reject = () => {};
      this.queue.push(j);
    }
    if (this.onRestore) this.onRestore();
    this.schedule();
  }

  dispose() {
    this.dropScratch();
    for (const p of this.programs.values()) p.material.dispose();
    this.util.dispose();
    this.quad.geometry.dispose();
    this.dummy.dispose();
    this.programs.clear();
    this.queue = [];
    this.painted = [];
    PAINTERS.delete(this.gl);
  }
}
