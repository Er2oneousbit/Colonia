/**
 * flora/impostors.js
 * ----------------------------------------------------------------------------
 * The trees' far form: an impostor, a picture of the tree rendered from its
 * model on the GPU and drawn as one card. The game's camera never changes
 * its angle (orthographic, 30 degrees down, the view turned by moving the
 * map, not the camera), so a tree seen from it is always seen the same way:
 * one picture each, taken from the camera's own direction, stands for the
 * model exactly, but for the tree's own turn (two shapes a species, and
 * their sizes, keep a forest from repeating).
 *
 * Baked into an atlas (cells of CELL px, a cell a species' shape and look):
 * its colour, as the model's materials give it before light (its texture
 * times its vertex colours: the crown's own shade is in them), cut out by
 * the sprays' alpha; and its normal, so the sun and the sky still light it
 * (a normal map in the card's own space: x along the screen, y up, z toward
 * the camera). The card stands upright (as the sprites stand: a vertical
 * cutout on the tree's foot), facing the camera across the ground, its
 * height stretched by 1 / cos 30 so it covers on the screen exactly what
 * the model does; so it is hidden by what stands in front of it and hides
 * what is behind as the sprites are and do.
 *
 * Every impostor in view is one instanced card (one draw call for all the
 * far trees of every species): its cell rides on the instance (`aCell`).
 * Baked again when a season changes the trees' look; nothing is read back.
 * ----------------------------------------------------------------------------
 */

import {
  WebGLRenderTarget, Scene, Mesh, OrthographicCamera, ShaderMaterial, Vector3, Vector4, Matrix3, Color, MeshStandardMaterial,
  RGBAFormat, UnsignedByteType, SRGBColorSpace, NoColorSpace, LinearMipmapLinearFilter, LinearFilter, ClampToEdgeWrapping,
  ObjectSpaceNormalMap, Vector2, PlaneGeometry, InstancedBufferAttribute, DoubleSide,
} from 'three';
import { patchLook, LOOK_KIND, LOOK } from '../materials.js';

/** A cell's size (px) and the atlas's (cells across, down). */
export const CELL = 160;
export const ATLAS_COLS = 12;
export const ATLAS_ROWS = 3;

/** The game camera's axes in the world (projection.js): across the screen, up it, back toward the viewer. */
const SIN = 0.5;
const COS = Math.sqrt(1 - SIN * SIN);
export const CAM_R = new Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
export const CAM_B = new Vector3(COS * Math.SQRT1_2, SIN, COS * Math.SQRT1_2);
export const CAM_U = new Vector3().crossVectors(CAM_B, CAM_R).normalize();
/** The card's height in the world for a height on the screen: it stands upright, the camera looks down 30 degrees. */
export const UPRIGHT = 1 / COS;

const BAKE_VERT = /* glsl */ `
attribute vec3 color;
uniform mat3 uvTransform;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vNormalW;
varying float vY;
void main() {
  vUv = ( uvTransform * vec3( uv, 1.0 ) ).xy;
  vColor = color;
  vNormalW = normal;
  vY = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

const BAKE_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec3 tint;
uniform float alphaTest;
uniform int mode;
uniform vec3 axR;
uniform vec3 axY;
uniform vec3 axB;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vNormalW;
varying float vY;
void main() {
  // (What is under the ground is not drawn in the game: not in the picture either.)
  if ( vY < 0.0 ) discard;
  vec4 t = texture2D( map, vUv );
  if ( t.a < alphaTest ) discard;
  if ( mode == 0 ) {
    gl_FragColor = vec4( t.rgb * vColor * tint, 1.0 );
  } else {
    vec3 n = normalize( vNormalW );
    // In the card's own axes (along the screen, up, toward the camera across the ground).
    vec3 c = vec3( dot( n, axR ), dot( n, axY ), dot( n, axB ) );
    gl_FragColor = vec4( normalize( c ) * 0.5 + 0.5, 1.0 );
  }
}`;

/** The material a model's part is baked with (its texture and colour, in either pass). */
function bakeMaterial(src) {
  const map = src.map || null;
  if (map) map.updateMatrix();
  return new ShaderMaterial({
    vertexShader: BAKE_VERT,
    fragmentShader: BAKE_FRAG,
    uniforms: {
      map: { value: map },
      uvTransform: { value: map ? map.matrix.clone() : new Matrix3() },
      tint: { value: new Color(src.color || 0xffffff) },
      alphaTest: { value: src.alphaTest || 0 },
      mode: { value: 0 },
      axR: { value: CAM_R.clone() },
      axY: { value: new Vector3(0, 1, 0) },
      axB: { value: new Vector3(CAM_B.x, 0, CAM_B.z).normalize() },
    },
    side: DoubleSide,
  });
}

export class ImpostorAtlas {
  /** @param {import('three').WebGLRenderer} gl */
  constructor(gl) {
    this.gl = gl;
    const W = CELL * ATLAS_COLS;
    const H = CELL * ATLAS_ROWS;
    const make = (srgb) => new WebGLRenderTarget(W, H, {
      type: UnsignedByteType, format: RGBAFormat, colorSpace: srgb ? SRGBColorSpace : NoColorSpace,
      wrapS: ClampToEdgeWrapping, wrapT: ClampToEdgeWrapping, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter,
      generateMipmaps: true, depthBuffer: true, stencilBuffer: false,
    });
    this.albedo = make(true);
    this.normal = make(false);
    this.cells = new Map(); // bake key -> { i, uv: Vector4, r0, r1, u0, u1 } (metres on the screen's axes)
    this.next = 0;
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.material = null;
  }

  /** Bytes on the GPU (both atlases with their mipmaps). */
  get bytes() {
    return Math.round(CELL * ATLAS_COLS * CELL * ATLAS_ROWS * 4 * 2 * 4 / 3);
  }

  /** Is there room for another cell? */
  get full() { return this.next >= ATLAS_COLS * ATLAS_ROWS && !this.free?.length; }

  /**
   * Bake `kit` (kit.js: a model's parts, metres) as `key`, into its own cell
   * (a key baked before keeps its cell). Returns the cell.
   */
  bake(key, kit) {
    let cell = this.cells.get(key);
    if (!cell) {
      const i = this.free && this.free.length ? this.free.pop() : this.next++;
      if (i >= ATLAS_COLS * ATLAS_ROWS) return null;
      cell = { i };
      this.cells.set(key, cell);
    }
    // The model's extent on the screen's axes (above the ground only).
    let r0 = Infinity;
    let r1 = -Infinity;
    let u0 = Infinity;
    let u1 = -Infinity;
    const p = new Vector3();
    for (const part of kit.parts) {
      const pos = part.geometry.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        p.fromBufferAttribute(pos, j);
        if (p.y < 0) p.y = 0;
        const r = p.dot(CAM_R);
        const u = p.dot(CAM_U);
        if (r < r0) r0 = r;
        if (r > r1) r1 = r;
        if (u < u0) u0 = u;
        if (u > u1) u1 = u;
      }
    }
    // Square, centred on the model across, its foot on the cell's bottom: a margin of a few px round it.
    const side = Math.max(r1 - r0, u1 - u0) * 1.04;
    const rc = (r0 + r1) / 2;
    r0 = rc - side / 2;
    r1 = rc + side / 2;
    u0 -= side * 0.02;
    u1 = u0 + side;
    Object.assign(cell, { r0, r1, u0, u1 });
    const cx = cell.i % ATLAS_COLS;
    const cy = Math.floor(cell.i / ATLAS_COLS);
    cell.uv = new Vector4(cx / ATLAS_COLS, cy / ATLAS_ROWS, 1 / ATLAS_COLS, 1 / ATLAS_ROWS);
    // The camera: from the game camera's direction, framing the square.
    const cam = this.camera;
    const far = 60;
    cam.position.copy(CAM_B).multiplyScalar(far);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.left = r0;
    cam.right = r1;
    cam.bottom = u0;
    cam.top = u1;
    cam.near = 1;
    cam.far = far * 2;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    const meshes = kit.parts.map((part) => {
      const m = new Mesh(part.geometry, bakeMaterial(part.material));
      this.scene.add(m);
      return m;
    });
    const gl = this.gl;
    const prevRT = gl.getRenderTarget();
    const prevClear = gl.getClearColor(new Color());
    const prevAlpha = gl.getClearAlpha();
    const prevAuto = gl.autoClear;
    const prevTM = gl.toneMapping;
    gl.autoClear = false;
    gl.toneMapping = 0;
    try {
      for (const [mode, rt] of [[0, this.albedo], [1, this.normal]]) {
        for (const m of meshes) m.material.uniforms.mode.value = mode;
        gl.setRenderTarget(rt);
        rt.viewport.set(cx * CELL, cy * CELL, CELL, CELL);
        rt.scissor.set(cx * CELL, cy * CELL, CELL, CELL);
        rt.scissorTest = true;
        gl.setRenderTarget(rt);
        // Cleared to the tree's own mean colour (the albedo) or a normal toward the camera, at no
        // cover: the mipmaps blend toward these at the cut's edge, never toward black.
        if (mode === 0) gl.setClearColor(kit.mean || new Color(0.12, 0.16, 0.08), 0);
        else gl.setClearColor(new Color(0.5, 0.5, 1.0), 0);
        gl.clear(true, true, false);
        gl.render(this.scene, cam);
        rt.scissorTest = false;
        rt.viewport.set(0, 0, rt.width, rt.height);
        rt.scissor.set(0, 0, rt.width, rt.height);
      }
    } finally {
      gl.setRenderTarget(prevRT);
      gl.setClearColor(prevClear, prevAlpha);
      gl.autoClear = prevAuto;
      gl.toneMapping = prevTM;
      for (const m of meshes) {
        this.scene.remove(m);
        m.material.dispose();
      }
    }
    return cell;
  }

  /** Let a cell go (a look no longer shown): another bake may take it. */
  drop(key) {
    const c = this.cells.get(key);
    if (!c) return;
    this.cells.delete(key);
    (this.free ??= []).push(c.i);
  }

  /**
   * The impostors' material: the atlas's colour and normal (in the card's
   * axes), cut out, lit as everything is, snow settling by the baked
   * normal (materials.js LOOK_KIND.IMPOSTOR), wet with the rain; the cell
   * from the instance (`aCell`).
   */
  materialOf() {
    if (this.material) return this.material;
    const m = new MeshStandardMaterial({
      color: 0xffffff,
      map: this.albedo.texture,
      normalMap: this.normal.texture,
      normalMapType: ObjectSpaceNormalMap,
      normalScale: new Vector2(1, 1),
      roughness: 0.75,
      metalness: 0,
      alphaTest: 0.32,
      alphaToCoverage: true,
    });
    m.name = 'flora-impostor';
    patchLook(m, { snow: 0.8, wet: 0.6, kind: LOOK_KIND.IMPOSTOR });
    const look = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      look(sh, r);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aCell;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
  vMapUv = aCell.xy + uv * aCell.zw;
  vNormalMapUv = vMapUv;`);
      // (An impostor's card reaches under the ground in front of its foot: never clipped there.)
      sh.fragmentShader = sh.fragmentShader.replace('if ( vLookWPos.y < uLookClipY ) discard;', '');
    };
    // (Its own program: its shader differs from the others' by more than three's parameters.)
    m.customProgramCacheKey = () => 'look2-impostor';
    this.material = m;
    return m;
  }

  dispose() {
    this.albedo.dispose();
    this.normal.dispose();
    if (this.material) this.material.dispose();
    this.material = null;
    this.cells.clear();
  }
}

/** The impostor's card: a unit square in x and y (its foot's middle at x 0.5, y 0), facing +z. */
export function impostorGeometry(room) {
  const g = new PlaneGeometry(1, 1);
  g.translate(0.5, 0.5, 0);
  g.setAttribute('aCell', new InstancedBufferAttribute(new Float32Array(room * 4), 4));
  return g;
}

export { LOOK };
