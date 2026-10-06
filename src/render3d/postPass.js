/**
 * postPass.js
 * ----------------------------------------------------------------------------
 * The night over the WebGL back end's scene, and the lightning's flash: what
 * render/lighting.js NightLights.apply() and the weather's flash do on the
 * 2D canvas, done on the GPU in the same steps, so the WebGL picture never
 * has to be copied onto the 2D canvas to be darkened there.
 *
 *   1. The light map, at half the view's resolution as on the 2D canvas
 *      (less at a lower render scale): cleared to the sky's tint, the pools
 *      of light added ('lighter': one, one).
 *   2. The scene multiplied by it ('multiply' of an opaque picture: the
 *      destination times the source), stretched to the view as drawImage
 *      stretches it (bilinear).
 *   3. The glows of windows, torches and fires added on top.
 *   4. The flash: a colour added over everything.
 * Quads are in the view's device px, so they land where the 2D canvas puts
 * them whatever size the WebGL canvas is drawn at. The glow sprites are
 * NightLights' own canvases, uploaded once.
 * ----------------------------------------------------------------------------
 */

import {
  Scene, Mesh, BufferGeometry, BufferAttribute, RawShaderMaterial, GLSL3, CustomBlending, OneFactor, ZeroFactor,
  DstColorFactor, DoubleSide, CanvasTexture, DataTexture, LinearFilter, WebGLRenderTarget, OrthographicCamera, DynamicDrawUsage, Color,
} from 'three';

const VERTEX = `
in vec2 position;
in vec2 uv;
in vec4 color;
out vec2 vUv;
out vec4 vColor;
void main() {
  vUv = uv;
  vColor = color;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

/** Premultiplied texels times the quad's colour and alpha (as webglBackend.js's quads). */
const FRAGMENT = `
precision highp float;
uniform sampler2D map;
in vec2 vUv;
in vec4 vColor;
out vec4 outColor;
void main() {
  outColor = texture(map, vUv) * vec4(vColor.rgb * vColor.a, vColor.a);
}`;

/** A material for one way of blending (the 2D canvas's composite operations). */
function material(src, dst, srcA, dstA) {
  return new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { map: { value: null } },
    depthTest: false,
    depthWrite: false,
    transparent: true,
    side: DoubleSide, // (wound as the screen's rows run, which WebGL calls the back)
    forceSinglePass: true,
    blending: CustomBlending,
    blendSrc: src,
    blendDst: dst,
    blendSrcAlpha: srcA,
    blendDstAlpha: dstA,
  });
}

/** Quads of one texture, filled per draw: positions in clip space, uv, straight colour and alpha. */
class Quads {
  constructor() {
    this.cap = 0;
    this.n = 0;
    this.geometry = null;
    this.mesh = new Mesh(new BufferGeometry(), null);
    this.mesh.frustumCulled = false;
    this.scene = new Scene();
    this.scene.add(this.mesh);
    this.grow(64);
  }

  grow(quads) {
    if (quads <= this.cap) return;
    let cap = this.cap || 64;
    while (cap < quads) cap *= 2;
    const g = new BufferGeometry();
    const attr = (name, size) => {
      const a = new BufferAttribute(new Float32Array(cap * 6 * size), size);
      a.setUsage(DynamicDrawUsage);
      g.setAttribute(name, a);
      return a.array;
    };
    this.pos = attr('position', 2);
    this.uv = attr('uv', 2);
    this.col = attr('color', 4);
    if (this.geometry) this.geometry.dispose();
    this.geometry = g;
    this.mesh.geometry = g;
    this.cap = cap;
  }

  begin() { this.n = 0; }

  /**
   * A rectangle (x0, y0)-(x1, y1) in a space `W` x `H` (top row first),
   * texture coordinates u0..u1 across, v0 at its top, v1 at its bottom.
   */
  add(x0, y0, x1, y1, W, H, u0, v0, u1, v1, c, a) {
    if (this.n + 1 > this.cap) this.grow(this.n + 1);
    const X0 = (2 * x0) / W - 1;
    const X1 = (2 * x1) / W - 1;
    const Y0 = 1 - (2 * y0) / H;
    const Y1 = 1 - (2 * y1) / H;
    const corners = [[X0, Y0, u0, v0], [X1, Y0, u1, v0], [X0, Y1, u0, v1], [X1, Y0, u1, v0], [X1, Y1, u1, v1], [X0, Y1, u0, v1]];
    let i = this.n * 6;
    for (const [x, y, u, v] of corners) {
      this.pos[i * 2] = x;
      this.pos[i * 2 + 1] = y;
      this.uv[i * 2] = u;
      this.uv[i * 2 + 1] = v;
      this.col[i * 4] = c[0];
      this.col[i * 4 + 1] = c[1];
      this.col[i * 4 + 2] = c[2];
      this.col[i * 4 + 3] = a;
      i++;
    }
    this.n++;
  }

  /** Draw what was added with `mat` and texture `map` (nothing when empty). */
  draw(gl, mat, map, camera) {
    if (!this.n) return;
    const g = this.geometry;
    for (const name of ['position', 'uv', 'color']) {
      const a = g.getAttribute(name);
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.n * 6 * a.itemSize);
      a.needsUpdate = true;
    }
    g.setDrawRange(0, this.n * 6);
    mat.uniforms.map.value = map;
    this.mesh.material = mat;
    gl.render(this.scene, camera);
  }

  dispose() {
    this.geometry.dispose();
  }
}

const WHITE = [1, 1, 1];

export class PostPass {
  /** @param {import('three').WebGLRenderer} gl */
  constructor(gl) {
    this.gl = gl;
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quads = new Quads();
    this.add = material(OneFactor, OneFactor, OneFactor, OneFactor); // 'lighter'
    this.multiply = material(DstColorFactor, ZeroFactor, ZeroFactor, OneFactor);
    this.white = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    this.white.needsUpdate = true;
    this.sprites = null; // NightLights' glow canvases as textures
    this.rt = null;
    this.clear = new Color();
  }

  /** NightLights' glow sprites as textures (made once; premultiplied as the 2D canvas draws them). */
  texturesOf(lights) {
    const spr = lights.ensureSprites();
    if (this.sprites && this.sprites.src === spr) return this.sprites;
    if (this.sprites) for (const k of ['pool', 'firePool', 'glow', 'fireGlow']) this.sprites[k].dispose();
    const tex = (c) => {
      const t = new CanvasTexture(c);
      t.flipY = false;
      t.premultiplyAlpha = true;
      t.generateMipmaps = false;
      t.minFilter = LinearFilter;
      t.magFilter = LinearFilter;
      return t;
    };
    this.sprites = { src: spr, pool: tex(spr.pool), firePool: tex(spr.firePool), glow: tex(spr.glow), fireGlow: tex(spr.fireGlow) };
    return this.sprites;
  }

  /**
   * The night over what is drawn so far: `tint` [r, g, b] (0..255), the
   * frame's `lights` (NightLights: pools and glows in device px), a view of
   * W x H device px drawn into a canvas `scale` of that size.
   */
  night(tint, lights, W, H, scale) {
    const gl = this.gl;
    const tex = this.texturesOf(lights);
    // The light map's space: half the view's device px, as NightLights.apply's canvas.
    const mw = Math.max(1, Math.ceil(W / 2));
    const mh = Math.max(1, Math.ceil(H / 2));
    const rw = Math.max(1, Math.round(mw * Math.min(1, scale)));
    const rh = Math.max(1, Math.round(mh * Math.min(1, scale)));
    if (!this.rt || this.rt.width !== rw || this.rt.height !== rh) {
      if (this.rt) this.rt.dispose();
      this.rt = new WebGLRenderTarget(rw, rh, { depthBuffer: false, stencilBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false });
    }
    const was = gl.getRenderTarget();
    const keepClear = gl.getClearColor(new Color());
    const keepAlpha = gl.getClearAlpha();
    gl.setRenderTarget(this.rt);
    gl.setClearColor(this.clear.setRGB(tint[0] / 255, tint[1] / 255, tint[2] / 255), 1);
    gl.clear(true, false, false);
    // Pools of light, added (the 2D canvas: drawImage at half scale, 'lighter', globalAlpha a).
    const q = this.quads;
    const MW = mw * 2;
    const MH = mh * 2;
    for (const fire of [false, true]) {
      q.begin();
      for (let i = 0; i < lights.nPools; i++) {
        const [x, y, rx, ry, a, f] = lights.pools[i];
        if (a <= 0.01 || !!f !== fire) continue;
        q.add(x - rx, y - ry, x + rx, y + ry, MW, MH, 0, 0, 1, 1, WHITE, Math.min(1, a));
      }
      q.draw(gl, this.add, fire ? tex.firePool : tex.pool, this.camera);
    }
    gl.setRenderTarget(was);
    gl.setClearColor(keepClear, keepAlpha);
    // The scene times the light map, stretched over (0, 0)-(2 mw, 2 mh) of the view.
    q.begin();
    q.add(0, 0, MW, MH, W, H, 0, 1, 1, 0, WHITE, 1);
    q.draw(gl, this.multiply, this.rt.texture, this.camera);
    // Glows, added.
    for (const fire of [false, true]) {
      q.begin();
      for (let i = 0; i < lights.nGlows; i++) {
        const [x, y, r, a, f] = lights.glows[i];
        if (a <= 0.01 || !!f !== fire) continue;
        q.add(x - r, y - r, x + r, y + r, W, H, 0, 0, 1, 1, WHITE, Math.min(1, a));
      }
      q.draw(gl, this.add, fire ? tex.fireGlow : tex.glow, this.camera);
    }
  }

  /** The lightning's flash: colour `rgb` (0..1) at alpha `a` added over the whole view. */
  flash(rgb, a, W, H) {
    const q = this.quads;
    q.begin();
    q.add(0, 0, W, H, W, H, 0, 0, 1, 1, rgb, a);
    q.draw(this.gl, this.add, this.white, this.camera);
  }

  /** The context was lost: render targets and textures are made again when next used. */
  restored() {
    if (this.rt) this.rt.dispose();
    this.rt = null;
  }

  dispose() {
    this.quads.dispose();
    this.add.dispose();
    this.multiply.dispose();
    this.white.dispose();
    if (this.sprites) for (const k of ['pool', 'firePool', 'glow', 'fireGlow']) this.sprites[k].dispose();
    if (this.rt) this.rt.dispose();
  }
}
