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
 * kits through InstancedMeshes of their own (two materials, one program),
 * in the rig's ghost slot: drawn after the sprites, over everything, as the
 * 2D ghost is.
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
import { LOOK, waterMaterial, surfacesReady, surfacesFailed, surfacesFailedCount, surfacesCount, surfacesAsked, material } from './materials.js';
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
/**
 * Seconds the models may take to get ready before the console hears why
 * not (a slow GPU compiles for seconds; one that never finishes is a bug
 * to see, not a sprite to leave standing silently), and before a compile
 * that never says it is done is taken as done: three then finishes it at
 * the first draw, a stall once rather than sprites for good.
 */
const SLOW_S = 20;
const COMPILE_GIVE_UP_S = 30;
/** Tries at compiling that may throw before the models give way to the sprites for good. */
const WARM_TRIES = 3;

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
  return withColourManagement(() => (tint === 'ok'
    ? material('ghost-ok', { color: 0x7ee08a, roughness: 0.7, opacity: 0.62, snow: 0, wet: 0 })
    : material('ghost-warn', { color: 0xffa04a, roughness: 0.7, opacity: 0.62, snow: 0, wet: 0 })));
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
    // Why models cannot draw on this GPU (a program that does not link, textures that could not
    // be painted): null while all is well. The sprites draw instead, for good.
    this.failed = null;
    this.warmTries = 0;
    this.retryAt = 0;
    this.warmStart = 0; // when the compile now running started (performance.now())
    this.since = performance.now(); // when the models last started getting ready
    this.slowSaid = false;
  }

  /** Can models draw now (painted and compiled, the context there)? */
  get ready() {
    // (A texture that could not be painted counts as done for surfacesReady: never draw on it.)
    return !this.failed && this.compiled && !this.lost && surfacesReady() && !surfacesFailedCount() && painterFor(this.gl).idle;
  }

  /** Models cannot draw on this GPU: say why once, and leave the buildings to their sprites. */
  fail(why) {
    if (this.failed) return;
    this.failed = why;
    console.error(`3D models: ${why}. The buildings keep their sprites.`);
  }

  /**
   * What the models are waiting for, in words (the performance readout and
   * the console): 'ready', 'failed: ...', or what is not done yet and for
   * how long.
   */
  status() {
    if (this.failed) return `failed: ${this.failed}`;
    if (this.lost) return 'waiting: the WebGL context is lost';
    if (this.ready) return 'ready';
    const s = Math.round((performance.now() - this.since) / 100) / 10;
    if (!surfacesReady()) return `waiting ${s} s: textures painted ${surfacesCount()} of ${surfacesAsked()}`;
    if (!painterFor(this.gl).idle) return `waiting ${s} s: the texture painter is busy`;
    if (!this.compiled) return `waiting ${s} s: compiling the programs${this.warming ? '' : ' (not started)'}`;
    return `waiting ${s} s`;
  }

  /**
   * Called each frame by the back end: textures that could not be painted
   * fail the models; a wait past SLOW_S is told to the console once (with
   * what it waits for); a compile that never reports done is taken as done
   * after COMPILE_GIVE_UP_S.
   */
  watch() {
    if (this.failed || this.lost) return;
    if (surfacesFailedCount()) {
      this.fail(`the textures ${surfacesFailed().join(', ')} could not be painted on this GPU`);
      return;
    }
    if (this.ready) return;
    const now = performance.now();
    if (!this.slowSaid && now - this.since > SLOW_S * 1000) {
      this.slowSaid = true;
      console.error(`3D models: still not ready after ${SLOW_S} s (${this.status()}); the buildings show their sprites meanwhile.`);
    }
    if (this.warming && now - this.warmStart > COMPILE_GIVE_UP_S * 1000) {
      console.error(`3D models: their programs never reported compiled after ${COMPILE_GIVE_UP_S} s; drawing them anyway.`);
      this.warming = null;
      this.compiled = true;
    }
  }

  /**
   * After the compile: did every model program link? A program the GPU's
   * compiler refused draws nothing (three says so at its first use), which
   * would leave a hole where the building stands: so the sprites instead.
   */
  checkLinked() {
    const ctx = this.gl.getContext();
    if (ctx.isContextLost()) return true;
    const props = this.gl.properties;
    const seen = new Set();
    let bad = null;
    this.rig.modelSlot.traverse((o) => {
      if (bad || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (seen.has(m)) continue;
        seen.add(m);
        const prog = props.get(m).currentProgram;
        if (!prog || !prog.program) continue;
        if (ctx.getProgramParameter(prog.program, ctx.LINK_STATUS)) continue;
        bad = `the program of material ${m.name || m.type} did not link (${(ctx.getProgramInfoLog(prog.program) || '').trim().slice(0, 300)})`;
        return;
      }
    });
    if (bad) this.fail(bad);
    return !bad;
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

  /** An InstancedMesh of a part with room for `room` copies, in `slot` (the models', or the ghosts'). */
  instanced(part, room, slot = this.slot) {
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
    slot.add(im);
    return im;
  }

  /**
   * A bigger buffer for `old` (room for `n`): a new InstancedMesh in the old
   * one's place among its slot's children. The order matters: three's
   * sorting is off, so see-through parts draw in that order (the water
   * under the rings and foam, kit.js).
   */
  bigger(old, n) {
    let room = old.instanceMatrix.count;
    while (room < n) room *= 2;
    const slot = old.parent;
    const at = slot.children.indexOf(old);
    const im = this.instanced(old.userData.part, room, slot);
    im.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, old.userData.n * 16));
    im.userData.n = old.userData.n;
    slot.remove(old);
    old.dispose();
    slot.children.splice(slot.children.indexOf(im), 1);
    slot.children.splice(at, 0, im);
    return im;
  }

  /** Make room for `n` copies in mesh `i` of kit `k` (a bigger buffer: a new InstancedMesh). */
  grow(k, i, n) {
    const im = this.bigger(k.meshes[i], n);
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
    // A new game or a load: its buildings' ids start again, the tiers remembered are another city's.
    if (this.game && r.game && r.game.map !== this.game.map) this.tiers.clear();
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
        im = this.instanced({ ...part, material: ghostMaterial(tint), cast: false }, 2, this.rig.ghostSlot);
        list[p] = im;
      }
      const n = im.userData.n;
      // (A drag of fountains along a street.)
      if (n >= im.instanceMatrix.count) list[p] = im = this.bigger(im, n + 1);
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
      im.parent.remove(im);
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
    if (key === this.warmKey || this.failed) return;
    // (A try that threw waits a little before the next.)
    if (performance.now() < this.retryAt) return;
    this.warmKey = key;
    this.compiled = false;
    this.warming = null;
    this.warmStart = performance.now();
    // (A new light, the ground's quality changed: the wait for this compile starts now.)
    this.since = this.warmStart;
    this.slowSaid = false;
    let job;
    try {
      // (Every material of every look: a frost's ice is the water's program, so the frozen looks need nothing more.)
      const looks = ['well', 'fountain:1', 'fountain:2', 'fountain:3', 'fountain:4'];
      for (const look of looks) this.kitFor(look, 1);
      // The ghosts' tints (the see-through program the stains use, but their own materials).
      ghostMaterial('ok');
      ghostMaterial('warn');
      const rig = this.rig;
      // The models' slot alone, in the rig's light (three compiles hidden objects too: the target
      // scene's lights and sky, without the ground's own shader), under the very output state it is
      // drawn in (tone mapping and sRGB are part of a program).
      job = rig.withOutput(() => this.gl.compileAsync(rig.modelSlot, camera, rig.scene));
    } catch (err) {
      // This threw once and the models waited for good, a sprite where each stood and nothing
      // said: now it is said, tried again, and given up after a few tries.
      this.warmKey = '';
      this.warmTries++;
      this.retryAt = performance.now() + 2000;
      console.error('3D models: compiling their programs failed:', err);
      if (this.warmTries >= WARM_TRIES) this.fail(`compiling their programs failed (${err && err.message})`);
      return;
    }
    const done = () => {
      if (this.warming !== job) return; // (the light changed again meanwhile)
      this.warming = null;
      if (this.checkLinked()) this.compiled = true;
    };
    this.warming = job;
    job.then(done, done);
  }

  /** The WebGL context was lost, or came back: compile again (the painter paints again on its own). */
  lose() { this.lost = true; }

  restored() {
    this.lost = false;
    this.warmKey = '';
    this.since = performance.now();
    this.slowSaid = false;
  }

  dispose() {
    for (const id of [...this.kits.keys()]) this.dropKit(id);
    this.tiers.clear();
  }
}
