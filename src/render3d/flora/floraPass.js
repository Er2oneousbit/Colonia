/**
 * flora/floraPass.js
 * ----------------------------------------------------------------------------
 * The WebGL back end's trees and rocks (webglBackend.js): the flora engine
 * (flora.js) on the game's map, in the 3D world's scene and light
 * (sunRig.js: its group sits in the models' slot, so it is drawn with the
 * models' opaque parts, casts into the sun's shadow map and is left out of
 * the ground's own picture), in place of the trees' and rocks' sprites.
 *
 * Each frame:
 *   begin   sync(): a new game or a load lays the map out afresh; a change
 *           of the map (its revision) lays out again the chunks it touched.
 *           Says whether the flora draws this frame (`ready`): only with the
 *           3D ground drawn (with the ground's sprites the 2D world stays
 *           2D), once its textures are painted, every species and rock on
 *           the map has a kit and their programs are compiled. Until then
 *           the renderer draws the sprites, so the game never waits.
 *   present update(): the chunks in view (the 2D camera's rectangle in
 *           world px, each chunk's box raised by the tallest tree), the
 *           level of detail by the size of a tile on the screen (flora.js
 *           floraLod; at Ground Low a step sooner, as the models), this
 *           month's looks, the view's turn; kits built within BUILD_MS.
 *
 * Textures: the sprays', barks' and rocks' (surfacesFlora.js) are asked for
 * when the pass is made, so they are painted with the models' in one go:
 * asked for later they would hold the models back to their sprites while
 * they paint (materials.js surfacesReady is every surface's).
 * ----------------------------------------------------------------------------
 */

import { ColorManagement } from 'three';
import { Flora, floraLod, CHUNK } from './flora.js';
import { climateOf } from './species.js';
import { FLORA_SURFACES } from '../surfacesFlora.js';
import { surfaceTextures, surfacesReady, surfacesFailedCount } from '../materials.js';
import { painterFor } from '../paint/painter.js';
import { toView } from '../../render/view.js';
import { HALF_W, HALF_H, CONFIG } from '../../config.js';
import { SITES, siteIdOf } from '../../data/sites.js';

/** Milliseconds a frame may spend building kits once the flora draws (a look or a level of detail being prepared). */
const BUILD_MS = 6;
/** Before it draws, more: nothing waits on it but the sprites standing in. */
const FIRST_BUILD_MS = 12;
/** World px a chunk's box is raised by (the tallest crown) and widened by (a crown's reach). */
const RISE_PX = 150;
const REACH_PX = 80;
/** Trees cast into the sun's shadow map only with fewer than this many in view (a wide view's shadows are a few pixels and cost a pass over every tree). */
const SHADOW_MAX_TREES = 3500;

/** Run `fn` with three's colour management on (the look's colours are sRGB to convert: modelPass.js). */
function withColour(fn) {
  const was = ColorManagement.enabled;
  ColorManagement.enabled = true;
  try {
    return fn();
  } finally {
    ColorManagement.enabled = was;
  }
}

/** A game's province for the flora: its region, site and map type (species.js climateOf). */
export function provinceOf(game) {
  const site = siteIdOf(game && game.scenario);
  const type = (game && game.scenario && game.scenario.map && game.scenario.map.type) || (game && game.mapInfo && game.mapInfo.type) || '';
  return climateOf({ region: SITES[site] ? SITES[site].region : '', site, type });
}

export class FloraPass {
  /**
   * @param {import('three').WebGLRenderer} gl
   * @param {import('../sunRig.js').SunRig} rig
   */
  constructor(gl, rig) {
    this.gl = gl;
    this.rig = rig;
    this.flora = new Flora(gl, { slot: rig.modelSlot, withColour });
    // (Drawn with the opaque parts; sunRig.js renderModels leaves it out of the see-through draw.)
    this.flora.group.userData.opaque = true;
    this.flora.group.visible = false;
    for (const name of Object.keys(FLORA_SURFACES)) {
      const t = surfaceTextures(name);
      // The sprays without anisotropic filtering: a card seen edge on asked for up to eight times the
      // reads of every layer of a wood, for an edge the alpha cuts anyway.
      if (FLORA_SURFACES[name].alpha) for (const k of ['map', 'normalMap', 'orm']) t[k].anisotropy = 1;
    }
    // The impostors' card and material from the start, so the first compile makes their program too.
    this.flora.prepareImpostors();
    this.map = null;
    this.compiledFor = ''; // the materials and light the programs were compiled for
    this.litFor = -1; // the light (the sun's shadows on or off) they were last compiled under
    this.compiling = null;
    this.lost = false;
    this.ready = false;
    // (The console's `flora off`: the sprites, to compare.)
    this.enabled = true;
    this.drawn = 0;
    this.lod = 1;
  }

  /**
   * At the frame's start: the map's changes, and whether the flora draws
   * this frame (with the 3D ground drawn, `ground`).
   */
  sync(r, ground) {
    const game = r.game;
    if (!game || !game.map) return (this.ready = false);
    if (game.map !== this.map) {
      this.map = game.map;
      this.flora.setMap(game.map, provinceOf(game));
    } else {
      this.flora.sync();
    }
    const painted = surfacesReady() && !surfacesFailedCount() && painterFor(this.gl).idle;
    this.painted = painted;
    // (Once compiled under this light, a material made later (a blossom's) shares a program already
    // made: it is compiled in the background, the flora goes on drawing.)
    this.ready = this.enabled && ground && !this.lost && painted && this.flora.complete && this.litFor === (this.rig.sun.castShadow ? 1 : 0);
    return this.ready;
  }

  /** What the programs depend on: the materials made so far and the sun's shadows. */
  programKey() {
    return `${[...this.flora.materials()].map((m) => m.id).join(',')}|${this.rig.sun.castShadow ? 1 : 0}`;
  }

  /**
   * Compile the flora's programs in the background (as the models', in the
   * rig's light and output) when its materials or the light changed.
   */
  warm(camera) {
    if (this.compiling || this.lost) return;
    const key = this.programKey();
    if (key === this.compiledFor || !this.flora.materials().size) return;
    const g = this.flora.group;
    const job = this.rig.withOutput(() => this.gl.compileAsync(g, camera, this.rig.scene));
    this.compiling = job;
    const done = () => {
      if (this.compiling !== job) return;
      this.compiling = null;
      this.compiledFor = key;
      this.litFor = Number(key.slice(-1));
    };
    job.then(done, done);
  }

  /** The chunks in view: each chunk's box in world px (at the view's turn), raised by the tallest crown, against the camera's rectangle. */
  chunksInView(cam, turn) {
    const map = this.map;
    const f = this.flora;
    const x0 = cam.x - REACH_PX;
    const y0 = cam.y - REACH_PX;
    const x1 = cam.x + cam.viewW / cam.scale + REACH_PX;
    const y1 = cam.y + cam.viewH / cam.scale + RISE_PX;
    const out = [];
    for (let cy = 0; cy < f.ch; cy++) {
      for (let cx = 0; cx < f.cw; cx++) {
        let a = Infinity;
        let b = -Infinity;
        let c = Infinity;
        let d = -Infinity;
        for (const [mx, my] of [[cx * CHUNK, cy * CHUNK], [Math.min(map.w, (cx + 1) * CHUNK), cy * CHUNK], [cx * CHUNK, Math.min(map.h, (cy + 1) * CHUNK)], [Math.min(map.w, (cx + 1) * CHUNK), Math.min(map.h, (cy + 1) * CHUNK)]]) {
          const [u, v] = toView(mx, my, turn, map.w, map.h);
          const X = (u - v) * HALF_W;
          const Y = (u + v) * HALF_H;
          a = Math.min(a, X);
          b = Math.max(b, X);
          c = Math.min(c, Y);
          d = Math.max(d, Y);
        }
        // (A chunk's trees rise above its box: they show when its top edge is under the view's bottom by their height.)
        if (b < x0 || a > x1 || d < y0 || c > y1) continue;
        out.push(cy * f.cw + cx);
      }
    }
    return out;
  }

  /**
   * Draw this frame's flora (`draw`: the renderer left its sprites out) or,
   * while it does not draw, go on preparing it (kits, programs). Returns
   * how many trees and rocks are drawn.
   */
  update(r, camera, draw, groundMode) {
    const f = this.flora;
    if (!this.map) return 0;
    const cam = r.camera;
    const scale = groundMode === 'low' ? cam.scale / 2 : cam.scale;
    this.lod = floraLod(CONFIG.TILE_W * scale);
    const month = r.seasonsOn === false || !r.game.time ? null : r.game.time.month;
    const turn = cam.turn & 3;
    const chunks = this.chunksInView(cam, turn);
    f.group.visible = draw;
    const rect = { x0: cam.x, y0: cam.y, x1: cam.x + cam.viewW / cam.scale, y1: cam.y + cam.viewH / cam.scale };
    this.drawn = f.update({ chunks, rect, lod: this.lod, month, turn, hidden: null, budget: draw ? BUILD_MS : FIRST_BUILD_MS, shadows: false, bake: !!this.painted && !this.lost });
    this.warm(camera);
    return draw ? this.drawn : 0;
  }

  /** Cast into the sun's shadow map (it is drawn this frame: sunRig.js fitShadow), near enough and few enough. */
  setCasting(on) {
    const f = this.flora;
    const cast = on && this.lod <= 1 && f.stats.drawn < SHADOW_MAX_TREES;
    for (const b of f.bases) for (const im of b.meshes) im.castShadow = cast && im.userData.part.cast;
    return cast;
  }

  /** The stats for the readout and the console. */
  get stats() {
    const s = this.flora.stats;
    const mem = this.flora.bytes();
    return { ...s, ready: this.ready, lod: this.lod, geometryMB: +(mem.geometry / 1048576).toFixed(1), atlasMB: +(mem.atlas / 1048576).toFixed(1) };
  }

  /** The WebGL context was lost, or came back: compile again, bake the impostors again. */
  lose() {
    this.lost = true;
  }

  restored() {
    this.lost = false;
    this.compiledFor = '';
    this.litFor = -1;
    this.compiling = null;
    this.flora.restored();
    this.flora.prepareImpostors();
  }

  dispose() {
    this.flora.dispose();
  }
}
