/**
 * labSacred.js
 * ----------------------------------------------------------------------------
 * The look lab's Sacred monuments scene (Shift+G): the Great Sanctuaries of
 * the five gods finished (Mercury's on his feast), a sanctuary at each stage
 * of its building and one sacked by raiders; the Pantheon at each of its five
 * stages (one struck by the raid now on) and finished; the Lighthouse at each
 * stage, finished and lit, finished and dark for want of timber, and halted
 * (render3d/models/fanum.js, pantheum.js, pharus.js), labelled.
 *
 * Drawn through the game's own model pass (render3d/modelPass.js: every look
 * and kit a monument's variant asks for, built by models.js modelFor, its
 * people by the people's batch, its cranes' wheels turning by the clock),
 * from stand-in buildings carrying the sim's own fields
 * (models/sacredMonuments.js standIn), on a made-up map of tiles, the
 * lighthouses' front rows out over water. So what shows here is what the
 * game draws.
 *
 * L: the level of detail. V: the camera close on the next monument (orbit).
 * window.__lab.sacred: closeUp(i), items, where(i), triangles(l), setLod(n).
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry } from 'three';
import { material, waterMaterial } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { modelFor, partShows } from '../render3d/models.js';
import { ModelPass } from '../render3d/modelPass.js';
import { standIn } from '../render3d/models/sacredMonuments.js';
import { BUILDINGS } from '../data/buildings.js';

/** Metres a tile; the made-up map's size (tiles). */
const TILE = 4;
const MAP_W = 36;
const MAP_H = 27;
/** The water's edge: map rows from here on are sea (the lighthouses' front rows). */
const SEA_Y = 22;

/**
 * What stands where (map tiles: its top-left), the stand-in's fields, its
 * label. `crew` puts a work camp's crew on the site; `raid` sets it back in
 * the raid now on; `feast` holds its god's festival this month.
 */
const ITEMS = [
  { type: 'fanum_ceres', x: 1, y: 1, o: {}, name: 'Great Sanctuary of Ceres', note: 'Her grove and the cista' },
  { type: 'fanum_neptune', x: 8, y: 1, o: {}, name: 'Great Sanctuary of Neptune', note: 'The spring, its basins and dolphins' },
  { type: 'fanum_mercury', x: 15, y: 1, o: {}, feast: true, name: 'Great Sanctuary of Mercury', note: 'The market colonnade; his feast' },
  { type: 'fanum_mars', x: 22, y: 1, o: {}, name: 'Great Sanctuary of Mars', note: 'The spoils and the sacred spears' },
  { type: 'fanum_venus', x: 29, y: 1, o: {}, name: 'Great Sanctuary of Venus', note: 'Myrtle, roses and doves' },
  { type: 'fanum_ceres', x: 1, y: 8, o: { stage: 0, share: 0.6 }, crew: true, name: 'Sanctuary: foundations', note: 'Stage 1 of 4, the lower block rising' },
  { type: 'fanum_neptune', x: 8, y: 8, o: { stage: 1, share: 0.6 }, crew: true, name: 'Sanctuary: podium and walls', note: 'Stage 2: the arcades on their centering' },
  { type: 'fanum_mercury', x: 15, y: 8, o: { stage: 2, share: 0.4 }, crew: true, name: 'Sanctuary: colonnade and roof', note: 'Stage 3: the columns going up' },
  { type: 'fanum_venus', x: 22, y: 8, o: { stage: 3, share: 0.3 }, crew: true, name: 'Sanctuary: dedication', note: 'Stage 4: gilders and gardeners' },
  { type: 'fanum_mars', x: 29, y: 8, o: { sacked: true }, name: 'Sanctuary sacked', note: 'Raiders brought it down: closed' },
  { type: 'pantheum', x: 0, y: 15, o: { stage: 0, share: 0.7 }, crew: true, name: 'Pantheon: foundations', note: 'The ring of concrete' },
  { type: 'pantheum', x: 6, y: 15, o: { stage: 1, share: 0.6 }, crew: true, name: 'Pantheon: the drum', note: 'Rising, its relieving arches' },
  { type: 'pantheum', x: 12, y: 15, o: { stage: 2, share: 0.6 }, raid: true, name: 'Pantheon: the portico', note: 'Struck by raiders this raid' },
  { type: 'pantheum', x: 18, y: 15, o: { stage: 3, share: 0.55 }, crew: true, name: 'Pantheon: the dome', note: 'Its courses on the centering' },
  { type: 'pantheum', x: 24, y: 15, o: { stage: 4, share: 0.2 }, crew: true, name: 'Pantheon: dedication', note: 'Bronze tiles going on' },
  { type: 'pantheum', x: 30, y: 15, o: {}, name: 'Pantheon (pantheum)', note: 'Hadrian\'s, finished and open' },
  { type: 'pharus', x: 1, y: 21, o: { stage: 0, share: 0.6 }, crew: true, name: 'Lighthouse: the piers', note: 'In their cofferdam of piles' },
  { type: 'pharus', x: 6, y: 21, o: { stage: 1, share: 0.6 }, crew: true, name: 'Lighthouse: square storey', note: 'Its ramp winding up' },
  { type: 'pharus', x: 11, y: 21, o: { stage: 2, share: 0.5, halted: true }, name: 'Lighthouse: halted', note: 'The eight-sided storey; work stopped' },
  { type: 'pharus', x: 16, y: 21, o: { stage: 3, share: 0.7 }, crew: true, name: 'Lighthouse: the lantern', note: 'The first fire soon' },
  { type: 'pharus', x: 21, y: 21, o: {}, name: 'Lighthouse (pharus)', note: 'Lit: fire at night, smoke by day' },
  { type: 'pharus', x: 26, y: 21, o: { store: false }, name: 'Lighthouse, dark', note: 'No timber in its store' },
];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The sacred monuments and the lighthouse</h2>
<p><b>The Great Sanctuary</b> (<i>fanum</i>): the terraced sanctuaries of the late Republic, Fortuna Primigenia at Praeneste,
the sanctuary of Anxur at Terracina, Hercules Victor at Tibur: terraces faced in polygonal and squared limestone, two ramps across the
lowest face, an arcade of arched rooms, arches framed by half-columns under an attic cut with the sanctuary's name, porticoes round
the summit court and the god's own temple at its head, painted and gilded as the god's temples are; each god's ground on the lower
terrace: Ceres's grove and cista, Neptune's spring and bronze dolphins, Mercury's market and caduceus, Mars's spoils and sacred
spears, Venus's myrtle, roses and doves.</p>
<p><b>The Pantheon</b> (<i>pantheum</i>): Hadrian's: sixteen granite columns under a pediment, the block with its second pediment,
the drum of brick-faced concrete with its relieving arches, the stepped rings, the dome in gilt bronze tiles to the oculus, the
forecourt's colonnades.</p>
<p><b>The Lighthouse</b> (<i>pharus</i>): after the Pharos and Ostia's on the coins, the Tower of Hercules and Dover's: a square
storey with its winding ramp, an eight-sided one, the round lantern with the fire before its bronze mirror, on a platform of
arches over the sea.</p>
<h3>Controls</h3>
<ul>
<li>Shift+G: this scene. L: the level of detail. V: close on the next monument (orbit), and back. 1 to 4: day, golden hour,
night, winter. N: snow; T: rain. M, G, Z: the game's zooms; O: orbit; Q / E: turn the view.</li>
</ul>`;

/** The lab's pass: the game's model pass, leaving the look's weather to the lab (the lab sets snow and rain itself). */
class LabPass extends ModelPass {
  life() {}
}

/** The scene's ground: earth over the land, the sea along the lighthouses' front. */
function ground(ox, oz) {
  const g = new Group();
  // (The land from well behind the map to the water's edge; the sea from there out.)
  const z0 = -oz - 40;
  const z1 = SEA_Y * TILE - oz;
  const land = new PlaneGeometry(MAP_W * TILE * 1.6, z1 - z0, 1, 1).rotateX(-Math.PI / 2).translate(MAP_W * TILE / 2 - ox, 0, (z0 + z1) / 2);
  g.add(new Mesh(tintGeometry(boxUV(land)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  const sea = new PlaneGeometry(MAP_W * TILE * 1.6, 14 * TILE, 1, 1).rotateX(-Math.PI / 2).translate(MAP_W * TILE / 2 - ox, -0.02, SEA_Y * TILE + 7 * TILE - oz);
  const water = new Mesh(tintGeometry(boxUV(sea)), waterMaterial());
  g.add(water);
  for (const m of g.children) m.receiveShadow = true;
  return { group: g, water };
}

/** Build the scene (the lab.js commerce scenes' shape: id, group, labels, setLod...). */
export function buildSacredScene() {
  const group = new Group();
  group.name = 'sacred-scene';
  const ox = (MAP_W / 2) * TILE;
  const oz = (MAP_H / 2) * TILE;
  const gr = ground(ox, oz);
  group.add(gr.group);
  // The models in tiles (as the game's world is): the holder scales them back to metres.
  const holder = new Group();
  holder.scale.setScalar(TILE);
  holder.position.set(-ox, 0, -oz);
  group.add(holder);
  const rig = { modelSlot: holder, ghostSlot: new Group(), groundSlot: new Group() };
  const pass = new LabPass(null, rig);
  let lod = 0;
  let frost = false;
  // The made-up game: the monuments, a work camp's crew on each working site, Mercury's feast, a raid on.
  const buildings = new Map();
  const game = {
    buildings,
    city: { gods: { mercury: { festivalsHeld: 1, monthsSinceFestival: 0, angered: false } } },
    time: { totalTicks: 1, totalDays: 40 },
    military: { active: { id: 7 } },
    map: { w: MAP_W, h: MAP_H, desirability: [0], idx: () => 0 },
  };
  const placed = [];
  ITEMS.forEach((it, i) => {
    const id = i + 1;
    const b = standIn(it.type, { id, x: it.x, y: it.y, waterSide: 2, ...it.o });
    if (it.raid) b.mon.setbackRaid = 'raid:7';
    buildings.set(id, b);
    if (it.crew) buildings.set(1000 + id, { id: 1000 + id, type: 'work_camp', def: BUILDINGS.work_camp, camp: { crew: { state: 'site', site: id } } });
    // (A Great Sanctuary not on its feast: its god's months since the last festival are not 0. Only Mercury's is.)
    placed.push({ b, it });
  });
  // The pass draws in the lab's level, the camera far enough for the people's middle level at L1, the full at L0.
  const SCALE = [4, 2, 0.5];
  const frame = (t) => {
    const r = { game, camera: { scale: SCALE[lod] }, time: t, motionOn: true, seasonsOn: true, weather: {} };
    const list = placed.map(({ b }) => ({ b, T: 0, vx: b.x, vy: b.y, rise: 0, snow: frost ? 3 : 0 }));
    pass.update(r, list, lod);
  };
  const life = (t) => frame(t);
  const labels = ITEMS.map((it) => {
    const S = BUILDINGS[it.type].size;
    return { name: it.name, note: it.note, x: (it.x + S / 2) * TILE - ox, z: it.y * TILE - oz + 1, y: it.type === 'pharus' ? 21 : it.type === 'pantheum' ? 12.5 : 14.5 };
  });
  let close = -1;
  const where = (i) => {
    const it = ITEMS[i];
    if (!it) return null;
    const S = BUILDINGS[it.type].size;
    return { x: (it.x + S / 2) * TILE - ox, z: (it.y + S / 2) * TILE - oz };
  };
  return {
    id: 'sacred',
    title: 'Sacred monuments',
    key: 'Shift+G',
    info: INFO,
    group,
    labels,
    fade: [0, 0, 120, 140],
    lamp: [-ox + 23 * TILE, 15, -oz + 22 * TILE],
    shadowBox: 80,
    noAO: [pass.people.group, gr.water],
    people: pass.people,
    pass,
    life,
    get lod() { return lod; },
    setLod(n) { lod = n; },
    onKey(k, api) {
      if (k !== 'v') return false;
      close = close + 1 >= ITEMS.length ? -1 : close + 1;
      if (api) api.closeUp(close, { dist: 34, el: 28, ty: 4, az: 35 });
      return true;
    },
    where,
    get figures() {
      return ITEMS.map((it, i) => ({ name: it.name, ...where(i) }));
    },
    items: ITEMS.map((it) => ({ type: it.type, name: it.name, note: it.note })),
    setTurn() {},
    /** A hard frost: the lighthouses' foam off the frozen margins (the look lays the snow by itself). */
    setWinter(on) { frost = !!on; },
    /** Each monument's triangles at a level of detail as it stands here (its kit and every kit of its `more`). */
    triangles(l = lod) {
      return placed.map(({ b, it }) => {
        const def = modelFor(b.type);
        const vv = def.variant(b, { snow: 0 }, { game, clock: 0 });
        let n = 0;
        const count = (key, state, times) => modelFor(key).build(key, l).traverse((o) => {
          if (o.isMesh && partShows(o.userData.when, state, false)) n += times * (o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3);
        });
        count(vv.key, vv.state, 1);
        for (const e of vv.more || []) count(e.key, e.state || 'always', e.n);
        return { name: it.name, type: b.type, triangles: Math.round(n), people: vv.actors ? (vv.actors.actors || []).length : 0 };
      });
    },
    stats: () => ({ models: { ...pass.stats } }),
  };
}
