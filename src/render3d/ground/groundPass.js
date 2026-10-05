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
 * model shadows) or 'low' (one sample a kind, no shadow map: for software
 * GL, which the CI's smoke test runs on, and phones).
 * ----------------------------------------------------------------------------
 */

import {
  Scene, Group, DirectionalLight, HemisphereLight, PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace, Vector3,
  MeshBasicMaterial, PCFShadowMap, Plane,
} from 'three';
import { MOODS, sunDirection, makeSkyParts, skyEnvironment, moodColor } from '../look.js';
import { MONTH_LOOK } from '../../render/weather.js';
import { CONFIG } from '../../config.js';
import { groundLayers, groundArrays } from './groundTextures.js';
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
    this.shadowsLive = false;
    const t0 = performance.now();
    groundLayers()
      .then((layers) => {
        this.layers = layers;
        this.loadMs = performance.now() - t0;
      })
      .catch(() => { this.failed = true; });
  }

  /** Can the ground be drawn this frame (its textures painted and a map set)? */
  get ready() { return !!this.layers && !this.failed; }

  /** Draw at another quality: the material is remade (the textures are kept). */
  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this.dropGround();
  }

  dropGround() {
    if (this.ground) {
      this.root.remove(this.ground.group);
      this.ground.dispose();
    }
    this.ground = null;
    this.map = null;
  }

  /** The WebGL context came back: the sky's light was a render target, make it again. */
  restored() {
    this.envDirty = true;
  }

  /**
   * Bring the ground up to date for a frame of renderer `r`: its map (a new
   * game makes a new ground), what changed on it, the view turn, the time
   * of year and the weather, the light.
   */
  sync(r) {
    if (!this.ready) return false;
    const game = r.game;
    if (!this.tex) {
      const aniso = Math.min(8, this.gl.capabilities.getMaxAnisotropy());
      this.tex = groundArrays(this.layers, undefined, aniso);
    }
    if (this.map !== game.map) {
      this.dropGround();
      const map = game.map;
      const farmAt = (i) => {
        const id = map.building[i];
        if (!id) return false;
        const b = game.buildings.get(id);
        return !!b && b.def.kind === 'farm';
      };
      this.ground = new Ground(map, this.tex, { quality: this.quality, farmAt, buildingAt: (i) => map.building[i] !== 0 });
      // (No depth: see the header.)
      this.ground.material.depthWrite = false;
      this.ground.material.depthTest = false;
      this.root.add(this.ground.group);
      this.map = map;
    }
    const g = this.ground;
    g.update();
    g.setTurn(r.viewTurn);
    this.light(r);
    return true;
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
      time: r.motionOn ? r.time : 0,
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
    if (this.envDirty) {
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
  }

  /**
   * Shadow casters for this frame's models: a copy of each placed model,
   * drawn into the sun's shadow map only (a material that writes nothing).
   * `placed` lists { key, holder } of the back end's models.
   */
  syncCasters(placed) {
    for (const c of this.casters.values()) c.used = 0;
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
    const span = Math.max(u1 - u0, v1 - v0);
    const want = this.quality === 'high' && models > 0 && span < SHADOW_MAX;
    if (want !== this.sun.castShadow) {
      this.sun.castShadow = want;
      this.gl.shadowMap.enabled = true;
      this.gl.shadowMap.type = PCFShadowMap;
    }
    if (!want) return;
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

  /** Draw the ground with `camera` (the back end's): tone mapped and in sRGB, which only it is. */
  render(camera) {
    const gl = this.gl;
    const tm = gl.toneMapping;
    const cs = gl.outputColorSpace;
    const ex = gl.toneMappingExposure;
    gl.toneMapping = ACESFilmicToneMapping;
    gl.outputColorSpace = SRGBColorSpace;
    gl.toneMappingExposure = 1;
    try {
      gl.render(this.scene, camera);
    } finally {
      gl.toneMapping = tm;
      gl.outputColorSpace = cs;
      gl.toneMappingExposure = ex;
    }
  }

  dispose() {
    this.dropGround();
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
