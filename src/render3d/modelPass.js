/**
 * modelPass.js
 * ----------------------------------------------------------------------------
 * The WebGL back end's 3D models (models.js): the look lab's well and
 * fountain, with the look's materials, in the 3D world's scene (sunRig.js),
 * so the 3D ground's sun, sky, tone mapping and shadow map light them.
 *
 * Cost. A big city has a hundred wells and as many fountains, and the
 * well alone is 55 thousand triangles. So:
 *   - Instancing: every building that shows a look (a model key: 'well',
 *     'fountain:3', 'fountain:3:ice') at one level of detail shares one kit
 *     (kit.js: the model flattened into a part a material) and each part is
 *     one InstancedMesh: a draw call a part whatever the number of
 *     buildings, the matrices refilled each frame (a few hundred floats).
 *     A part shows only for the buildings whose state shows it (a dry
 *     fountain has no stream: models.js partShows).
 *   - Levels of detail by the zoom (lodFor): the whole view is at one scale
 *     (the camera is orthographic), so one level a frame, from the size of a
 *     tile on the screen. A kit is built the first time its key and level
 *     are wanted (tens of milliseconds) and freed when unused for a while.
 *   - Shadows: the instanced parts cast into the sun's shadow map when the
 *     3D ground is High (sunRig.js fits it to the view, and skips it far out).
 *
 * The fountain's look follows its neighbourhood (fountainTier.js): the tier
 * is kept per building here, render-only state the sim never sees.
 *
 * The build ghost: a building being placed is drawn as its model, see-
 * through and tinted (green where it can go, orange where no road would
 * reach it, as the 2D ghost's tints), its opaque parts only, from the same
 * kits through InstancedMeshes of their own (two materials, one program).
 *
 * Ready. A model draws only once its materials' textures are painted and
 * its programs compiled (in the background: compileAsync, under the light
 * it is drawn in), so the game never stalls on a compile; meanwhile, and
 * after a lost context until all is painted and compiled again, the
 * building's sprite is drawn (the back end's hasModel says no). The light
 * changing (the shadow map on or off: the ground's quality) compiles again.
 *
 * Colours: the game's back end turns three's colour management off (its
 * sprites are plain bytes); the look's materials are written in sRGB and
 * meant to be converted to linear light, so the kits are built with it on
 * for the while (withColourManagement).
 * ----------------------------------------------------------------------------
 */

import { InstancedMesh, Matrix4, DynamicDrawUsage, ColorManagement } from 'three';
import { MODELS, partShows, modelMatrix } from './models.js';
import { kitOf, disposeKit } from './kit.js';
import { LOOK, waterMaterial, surfacesReady, material } from './materials.js';
import { fountainLife } from './models/fountain.js';
import { fountainTier, tierOf } from './fountainTier.js';
import { WaterBits } from '../world/map.js';
import { painterFor } from './paint/painter.js';
import { CONFIG } from '../config.js';

/** A tile at least this wide on the screen (device px) draws the full model; at least LOD1_PX, the middle one; else the far one. */
export const LOD0_PX = 160;
export const LOD1_PX = 72;
/** Frames a kit or a building's remembered tier is kept unseen. */
const KEEP_FRAMES = 600;
/** First room in a part's instance buffer (it doubles as needed). */
const FIRST_ROOM = 8;

/** The level of detail for a camera scale (device px per world px). */
export function lodFor(scale) {
  const tile = CONFIG.TILE_W * scale;
  return tile >= LOD0_PX ? 0 : tile >= LOD1_PX ? 1 : 2;
}

/** Run `fn` with three's colour management on (see the header). */
function withColourManagement(fn) {
  const was = ColorManagement.enabled;
  ColorManagement.enabled = true;
  try {
    return fn();
  } finally {
    ColorManagement.enabled = was;
  }
}

const _m = new Matrix4();

/** A kit's ghost meshes (placeGhost), both tints. */
function ghostMeshes(k) {
  return k.ghosts ? [...k.ghosts.ok, ...k.ghosts.warn].filter(Boolean) : [];
}

/** The ghost's see-through tint: green where it can be built, orange where no road would reach it (renderer.js NO_ROAD_FILL). */
function ghostMaterial(tint) {
  return tint === 'ok'
    ? material('ghost-ok', { color: 0x7ee08a, roughness: 0.7, opacity: 0.62, snow: 0, wet: 0 })
    : material('ghost-warn', { color: 0xffa04a, roughness: 0.7, opacity: 0.62, snow: 0, wet: 0 });
}

export class ModelPass {
  /**
   * @param {import('three').WebGLRenderer} gl
   * @param {import('./sunRig.js').SunRig} rig
   */
  constructor(gl, rig) {
    this.gl = gl;
    this.rig = rig;
    this.slot = rig.modelSlot;
    this.kits = new Map(); // `${key}|${lod}` -> { kit, meshes: [InstancedMesh], seen }
    this.tiers = new Map(); // building id -> { t, seen }
    this.frame = 0;
    this.compiled = false;
    this.warmKey = '';
    this.warming = null;
    this.lost = false;
    this.stats = { kits: 0, triangles: 0, drawn: 0, byType: {} };
  }

  /** Can models draw now (painted and compiled, the context there)? */
  get ready() {
    return this.compiled && !this.lost && surfacesReady() && painterFor(this.gl).idle;
  }

  /**
   * The tier a fountain shows (fountainTier.js), kept per building so its
   * look changes only past a band's edge; a ghost's (no id) straight from
   * its band.
   */
  fountainTier(b) {
    const map = this.game && this.game.map;
    const d = map ? map.desirability[map.idx(b.x, b.y)] : 0;
    if (b.id === null || b.id === undefined) return tierOf(d);
    const was = this.tiers.get(b.id);
    const t = fountainTier(d, was ? was.t : null);
    if (was) {
      was.t = t;
      was.seen = this.frame;
    } else {
      this.tiers.set(b.id, { t, seen: this.frame });
    }
    return t;
  }

  /** The kit of a look at a level of detail, built the first time (its InstancedMeshes in the scene, hidden). */
  kitFor(key, lod) {
    const id = `${key}|${lod}`;
    let k = this.kits.get(id);
    if (k) return k;
    const type = key.split(':')[0];
    const kit = withColourManagement(() => {
      const group = MODELS[type].build(key, lod);
      const out = kitOf(group);
      // (The built model's own geometries: the kit has its own copies.)
      group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      return out;
    });
    const meshes = kit.parts.map((p) => this.instanced(p, FIRST_ROOM));
    k = { kit, meshes, seen: this.frame, id };
    this.kits.set(id, k);
    return k;
  }

  /** An InstancedMesh of a part with room for `room` copies, in the models' slot. */
  instanced(part, room) {
    const im = new InstancedMesh(part.geometry, part.material, room);
    im.instanceMatrix.setUsage(DynamicDrawUsage);
    im.castShadow = part.cast;
    im.receiveShadow = true;
    // (The renderer hands over only buildings in view: nothing to cull.)
    im.frustumCulled = false;
    im.count = 0;
    im.visible = false;
    im.userData.part = part;
    im.userData.n = 0;
    this.slot.add(im);
    return im;
  }

  /** Make room for `n` copies in mesh `i` of kit `k` (a bigger buffer: a new InstancedMesh). */
  grow(k, i, n) {
    const old = k.meshes[i];
    let room = old.instanceMatrix.count;
    while (room < n) room *= 2;
    const im = this.instanced(old.userData.part, room);
    im.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, old.userData.n * 16));
    im.userData.n = old.userData.n;
    this.slot.remove(old);
    old.dispose();
    k.meshes[i] = im;
    return im;
  }

  /**
   * This frame's models: `placed` from the renderer ({ b, T, state, snow,
   * vx, vy, rise }), drawn at level `lod`. Fills every part's instances;
   * returns how many buildings are drawn as models.
   */
  update(r, placed, lod, ghosts = []) {
    this.frame++;
    this.game = r.game;
    this.life(r);
    for (const k of this.kits.values()) for (const im of k.meshes.concat(ghostMeshes(k))) im.userData.n = 0;
    const byType = {};
    // (The shadow map is cleared rather than drawn when no model wants it: sunRig.js fitShadow.)
    for (const m of placed) {
      const def = MODELS[m.b.type];
      const v = def.variant(m.b, m, this);
      const k = this.kitFor(v.key, lod);
      k.seen = this.frame;
      modelMatrix(m.vx, m.vy, m.b.size, m.T, m.rise || 0, _m);
      for (let i = 0; i < k.meshes.length; i++) {
        let im = k.meshes[i];
        if (!partShows(im.userData.part.when, v.state, v.ice)) continue;
        const n = im.userData.n;
        if (n >= im.instanceMatrix.count) im = this.grow(k, i, n + 1);
        _m.toArray(im.instanceMatrix.array, n * 16);
        im.userData.n = n + 1;
      }
      byType[m.b.type] = (byType[m.b.type] || 0) + 1;
    }
    for (const g of ghosts) this.placeGhost(g, lod);
    let tris = 0;
    for (const [id, k] of this.kits) {
      for (const im of k.meshes.concat(ghostMeshes(k))) {
        const n = im.userData.n;
        im.count = n;
        im.visible = n > 0;
        if (n) {
          const a = im.instanceMatrix;
          a.clearUpdateRanges();
          a.addUpdateRange(0, n * 16);
          a.needsUpdate = true;
          tris += n * (im.geometry.index ? im.geometry.index.count : im.geometry.attributes.position.count) / 3;
        }
      }
      // A look nobody has drawn for a while (another zoom's level, last winter's ice): free it.
      if (this.frame - k.seen > KEEP_FRAMES) this.dropKit(id);
    }
    if (this.frame % KEEP_FRAMES === 0) {
      for (const [id, e] of this.tiers) if (this.frame - e.seen > KEEP_FRAMES) this.tiers.delete(id);
    }
    this.stats = { kits: this.kits.size, triangles: Math.round(tris), drawn: placed.length, byType, lod };
    return placed.length;
  }

  /**
   * A ghost (the renderer's placeGhostModels: { type, x, y, size, T, vx, vy,
   * ok, snow }): the model as it would stand there, see-through and tinted.
   */
  placeGhost(g, lod) {
    const map = this.game.map;
    const i = map.idx(g.x, g.y);
    // As built there: a fountain runs where the reservoirs' pipes reach, and takes the look of its band.
    const b = { id: null, type: g.type, x: g.x, y: g.y, size: g.size, hasWater: (map.water[i] & WaterBits.PIPED) !== 0, efficiency: 1 };
    const v = MODELS[g.type].variant(b, { snow: g.snow }, this);
    const k = this.kitFor(v.key, lod);
    k.seen = this.frame;
    const tint = g.ok ? 'ok' : 'warn';
    k.ghosts ??= { ok: [], warn: [] };
    const list = k.ghosts[tint];
    modelMatrix(g.vx, g.vy, g.size, g.T, 0, _m);
    k.kit.parts.forEach((part, p) => {
      if (part.material.transparent || !partShows(part.when, v.state, v.ice)) return;
      let im = list[p];
      if (!im) {
        im = this.instanced({ ...part, material: ghostMaterial(tint), cast: false }, 2);
        list[p] = im;
      }
      let n = im.userData.n;
      if (n >= im.instanceMatrix.count) {
        // (Grown in place of the old: a drag of fountains along a street.)
        const bigger = this.instanced(im.userData.part, im.instanceMatrix.count * 2);
        bigger.instanceMatrix.array.set(im.instanceMatrix.array.subarray(0, n * 16));
        bigger.userData.n = n;
        this.slot.remove(im);
        im.dispose();
        list[p] = bigger;
        im = bigger;
        n = im.userData.n;
      }
      _m.toArray(im.instanceMatrix.array, n * 16);
      im.userData.n = n + 1;
    });
  }

  /** Hide the casters from the shadow map while it is cleared (sunRig.js: nothing in it to show). */
  setCasting(on) {
    for (const k of this.kits.values()) for (const im of k.meshes) im.castShadow = on && im.userData.part.cast;
  }

  /** The look's shared uniforms and moving water for this frame (the weather, the season, the time). */
  life(r) {
    const u = LOOK.uniforms;
    const w = r.weather || {};
    const on = r.weatherOn;
    // (Snow lies on the stone as on the 3D ground: ground/ground.js groundSnow of the weather's cover.)
    const cover = on && r.seasonsOn ? Math.max(0, Math.min(1, w.cover || 0)) : 0;
    u.uLookSnow.value = cover < 0.06 ? 0 : Math.min(1, (cover - 0.06) / 0.8);
    u.uLookWet.value = on ? w.wet || 0 : 0;
    const t = r.motionOn ? r.time || 0 : 0;
    u.uLookTime.value = t;
    waterMaterial().normalMap.offset.set(t * 0.012, t * 0.007);
    fountainLife(t);
  }

  dropKit(id) {
    const k = this.kits.get(id);
    if (!k) return;
    for (const im of k.meshes.concat(ghostMeshes(k))) {
      this.slot.remove(im);
      im.dispose();
    }
    disposeKit(k.kit);
    this.kits.delete(id);
  }

  /**
   * Compile the models' programs in the background for the light they are
   * drawn in (`shadows`: the sun's shadow map on), on a mid-detail kit of
   * every look (the materials are the same at every level). Called each
   * frame; does something only when the light changed or after a lost
   * context.
   */
  warm(camera, shadows) {
    const key = shadows ? 'shadow' : 'plain';
    if (key === this.warmKey) return;
    this.warmKey = key;
    this.compiled = false;
    // (Every material of every look: a frost's ice is the water's program, so the frozen looks need nothing more.)
    const looks = ['well', 'fountain:1', 'fountain:2', 'fountain:3', 'fountain:4'];
    const shown = [];
    for (const look of looks) {
      for (const im of this.kitFor(look, 1).meshes) {
        shown.push([im, im.count, im.visible]);
        im.count = 1;
        im.visible = true;
      }
    }
    const rig = this.rig;
    const g = rig.groundSlot.visible;
    rig.groundSlot.visible = false;
    let job;
    try {
      // (Under the very output state it is drawn in: tone mapping and sRGB are part of a program.)
      job = rig.withOutput(() => this.gl.compileAsync(rig.scene, camera));
    } finally {
      rig.groundSlot.visible = g;
      for (const [im, n, v] of shown) {
        im.count = n;
        im.visible = v;
      }
    }
    const done = () => {
      if (this.warming !== job) return; // (the light changed again meanwhile)
      this.warming = null;
      this.compiled = true;
    };
    this.warming = job;
    job.then(done, done);
  }

  /** The WebGL context was lost, or came back: compile again (the painter paints again on its own). */
  lose() { this.lost = true; }

  restored() {
    this.lost = false;
    this.warmKey = '';
  }

  dispose() {
    for (const id of [...this.kits.keys()]) this.dropKit(id);
    this.tiers.clear();
  }
}
