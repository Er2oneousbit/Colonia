/**
 * ground/ground.js
 * ----------------------------------------------------------------------------
 * The 3D ground of a map: flat, as the game's map is, cut into chunks of
 * CHUNK x CHUNK tiles, one mesh each (a single quad: the ground is flat and
 * its detail is all in the shader, groundMaterial.js), all sharing one
 * material and one type map texture (groundMap.js) a texel a tile.
 *
 * The meshes lie in the MAP's coordinates (x along the map's x, z along its
 * y, a unit a tile), in a group that setTurn() turns and moves into the
 * view's (render/view.js toView), so a view turn moves one matrix and the
 * shader still reads the map tile under each pixel. `scale` makes a unit
 * something else (the look lab works in metres: 4).
 *
 * update() repacks what changed on the map (the type map compares the
 * layers it read last time) and uploads the type map again: 4 bytes a
 * tile, 256 KB for the largest map, so a whole upload costs less than
 * tracking ranges would. Then it repacks the tiles whose look changes
 * between the map's revisions (`live`: a farm's crop growing, a fire
 * burning out) and uploads the site map (or the type map) only if a byte
 * changed: a field crosses one of its 64 steps of growth about once a
 * game day (groundSites.js GROWTH_STEPS). The caller says how often it
 * wants them (`live`): Low redraws its kept picture for each change. Nothing else is made or freed as the map changes: roads, plazas,
 * rubble, yards and fields are bytes in those two textures.
 *
 * setSky() takes the time of year and the weather as numbers that move
 * smoothly (the season's position along the 2D art's looks, the snow cover
 * 0..1, the wetness 0..1), not the 2D art's steps.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry, DataTexture, RGBAFormat, UnsignedByteType, NearestFilter, NoColorSpace, Vector3 } from 'three';
import { GroundMap, CHUNK } from './groundMap.js';
import { groundMaterial } from './groundMaterial.js';

/**
 * The season's colour for living ground (linear rgb) at each of the 2D
 * art's four looks (weather.js LOOKS: 0 winter, 1 spring, 2 summer, 3
 * autumn), how much of it they take, and how dry (straw) they go. Summer in
 * the Mediterranean is the dry season: the pasture browns at the tips,
 * while the meadows by water stay green (the shader's dryness follows
 * patches). `flowers`: how many of the meadow's, the pasture's and the
 * scrub's flowers are out (the spring's flush, a few in summer, none in
 * winter); `leaves`: fresh fallen leaves on a wood's floor turned russet
 * (autumn).
 */
export const SEASON_LOOKS = Object.freeze([
  { veg: [0.36, 0.42, 0.2], amt: 0.55, dry: 0.3, flowers: 0, leaves: 0.15 }, // winter: dull olive, some straw
  { veg: [0.26, 0.55, 0.12], amt: 0.45, dry: 0.0, flowers: 1, leaves: 0 }, // spring: fresh, bright, in flower
  { veg: [0.32, 0.48, 0.14], amt: 0.25, dry: 0.18, flowers: 0.35, leaves: 0 }, // summer: deep green going to straw in patches
  { veg: [0.45, 0.42, 0.16], amt: 0.5, dry: 0.3, flowers: 0.1, leaves: 1 }, // autumn: olive and ochre, the leaves down
]);

const lerp = (a, b, t) => a + (b - a) * t;

/** The season's numbers at a position along the looks (0..4, wrapping: weather.js MONTH_LOOK). */
export function seasonAt(pos) {
  const p = ((pos % 4) + 4) % 4;
  const i = Math.floor(p);
  const f = p - i;
  const a = SEASON_LOOKS[i];
  const b = SEASON_LOOKS[(i + 1) % 4];
  return {
    veg: a.veg.map((c, k) => lerp(c, b.veg[k], f)), amt: lerp(a.amt, b.amt, f), dry: lerp(a.dry, b.dry, f),
    flowers: lerp(a.flowers, b.flowers, f), leaves: lerp(a.leaves, b.leaves, f),
  };
}

/**
 * The snow lying on the 3D ground for the weather's cover (0..1): the same
 * cover the 2D art steps through in SNOW_STEPS, shown as it builds. Nothing
 * below a thin dusting, so the ground is bare while the sprites are.
 */
export function groundSnow(cover) {
  const c = Math.max(0, Math.min(1, cover));
  return c < 0.06 ? 0 : Math.min(1, (c - 0.06) / 0.8);
}

export class Ground {
  /**
   * @param {object} map        a GameMap (or anything with its layers, the lab's)
   * @param {object} tex        groundTextures.js groundTextures() (or blankGroundArrays())
   * @param {object} [opts]     { quality: 'high'|'low', scale: units per tile,
   *                            hooks: what stands where (groundMap.js GroundMap; groundSites.js
   *                            for a game), and live(): the tiles to refresh each update,
   *                            kindHook, waterHook (groundMap.js: the lab's own layout),
   *                            ownOutput (groundMaterial.js: drawn into a texture) }
   */
  constructor(map, tex, { quality = 'high', scale = 1, hooks = {}, kindHook = null, waterHook = null, ownOutput = false } = {}) {
    this.map = map;
    this.tex = tex;
    this.quality = quality;
    this.scale = scale;
    this.hooks = hooks;
    this.types = new GroundMap(map);
    this.types.kindHook = kindHook;
    this.types.waterHook = waterHook;
    const texOf = (data) => {
      const t = new DataTexture(data, map.w, map.h, RGBAFormat, UnsignedByteType);
      t.magFilter = NearestFilter;
      t.minFilter = NearestFilter;
      t.generateMipmaps = false;
      t.colorSpace = NoColorSpace;
      t.flipY = false;
      return t;
    };
    this.typeTex = texOf(this.types.data);
    this.siteTex = texOf(this.types.detail);
    this.material = groundMaterial(tex, this.typeTex, quality, ownOutput, this.siteTex);
    this.group = new Group();
    this.group.name = 'ground';
    this.inner = new Group(); // in map tiles; the outer group turns and scales it
    this.group.add(this.inner);
    this.meshes = [];
    for (let cy = 0; cy < this.types.chunksY; cy++) {
      for (let cx = 0; cx < this.types.chunksX; cx++) {
        const x0 = cx * CHUNK;
        const y0 = cy * CHUNK;
        const w = Math.min(CHUNK, map.w - x0);
        const h = Math.min(CHUNK, map.h - y0);
        const g = new PlaneGeometry(w, h, 1, 1);
        g.rotateX(-Math.PI / 2);
        g.translate(x0 + w / 2, 0, y0 + h / 2);
        const m = new Mesh(g, this.material);
        m.name = `ground-${cx}-${cy}`;
        m.receiveShadow = true;
        m.castShadow = false;
        this.inner.add(m);
        this.meshes.push(m);
      }
    }
    this.turn = -1;
    this.update();
    this.setTurn(0);
  }

  /**
   * Repack what changed on the map, and (`live`) on its live tiles; true
   * when either map was uploaded again.
   */
  update(live = true) {
    const h = this.hooks;
    if (h.prepare) h.prepare();
    let types = false;
    let sites = false;
    if (this.types.update(h)) types = sites = true;
    if (live && h.live) {
      const r = this.types.refresh(h.live(), h);
      types ||= r.types;
      sites ||= r.sites;
    }
    if (types) this.typeTex.needsUpdate = true;
    if (sites) this.siteTex.needsUpdate = true;
    return types || sites;
  }

  /**
   * Turn the ground with the view: map point (x, y) to the view's
   * render/view.js toView(x, y, t, W, H). A quarter turn is minus a quarter
   * about three's y (as models.js standModel turns a building).
   */
  setTurn(t) {
    t &= 3;
    if (t === this.turn) return;
    this.turn = t;
    const { w: W, h: H } = this.map;
    const off = [[0, 0], [H, 0], [W, H], [0, W]][t];
    this.inner.rotation.set(0, (-t * Math.PI) / 2, 0);
    this.inner.position.set(off[0], 0, off[1]);
    this.group.scale.setScalar(this.scale);
    this.group.updateMatrixWorld(true);
  }

  /**
   * The time of year and the weather: `season` the position along the
   * looks (0..4), `snow` the cover 0..1 (groundSnow), `wet` 0..1, `rain`
   * 0..1 (drops on the puddles), `time` seconds (water and rings).
   */
  setSky({ season = 2, snow = 0, wet = 0, rain = 0, time = 0 } = {}) {
    const u = this.material.userData.ground;
    const s = seasonAt(season);
    u.uGVeg.value.set(s.veg[0], s.veg[1], s.veg[2]);
    u.uGVegAmt.value = s.amt;
    u.uGDry.value = s.dry;
    u.uGFlowers.value = s.flowers;
    u.uGLeaves.value = s.leaves;
    u.uGSnow.value = snow;
    u.uGWet.value = wet;
    u.uGRain.value = rain;
    u.uGTime.value = time;
  }

  /** The sky's colour in open water (linear rgb), how strongly it shows, and the sun's glitter on it (0..1). */
  setReflection(color, strength, sun = 1) {
    const u = this.material.userData.ground;
    if (color instanceof Vector3) u.uGSkyColor.value.copy(color);
    else u.uGSkyColor.value.set(color[0], color[1], color[2]);
    u.uGSkyRefl.value = strength;
    u.uGSun.value = sun;
  }

  dispose() {
    for (const m of this.meshes) m.geometry.dispose();
    this.material.dispose();
    this.typeTex.dispose();
    this.siteTex.dispose();
    this.meshes = [];
    this.group.clear();
  }
}
