/**
 * labShips.js
 * ----------------------------------------------------------------------------
 * The look lab's Ships scene (Shift+B): every vessel of the game as the WebGL
 * renderer draws it in 3D (render3d/ships/: the game's own pass, designs,
 * crews, motion and kits), on the game's own 3D water, labelled:
 *
 *   the far lane     under sail: the corbita (Alexandria's grain, its
 *                    sail striped in the partner's colour), the coaster
 *                    (Massilia's), a fishing boat out to the grounds, the
 *                    Venetic ship of the Gauls
 *   the middle lane  rowing: a liburnian on passage (rowing, its sail set),
 *                    the Ligurians' lembos and the Carthaginians' galley
 *   the near lane    a liburnian rowing to fight (its sail furled, its
 *                    marines' bows drawn), a fishing boat at work (the
 *                    net out, one casting, one hauling), one home with its
 *                    catch, a corbita turning in a circle under sail, a
 *                    lembos at anchor
 *   the quay         a corbita and a coaster moored alongside, a fishing
 *                    boat at its wharf, three liburnians lying stern-to at
 *                    their Statio (the game's model)
 *
 * Every ship goes by the game's motion (motion.js): the lanes run on a
 * loop, so their wakes and bow waves form; the rowers pull to each ship's
 * own stroke. L: the level of detail. V: close on the next ship (orbit).
 * window.__lab.ships: closeUp(i), where(i), stats(), setLod(n), ships.
 * ----------------------------------------------------------------------------
 */

import { Group, Matrix4, InstancedMesh, DynamicDrawUsage, Mesh } from 'three';
import { GameMap, Terrain, Road } from '../world/map.js';
import { Ground } from '../render3d/ground/ground.js';
import { SITE, siteWord, WATER_KIND } from '../render3d/ground/groundMap.js';
import { MODELS, partShows, modelFor } from '../render3d/models.js';
import { kitOf } from '../render3d/kit.js';
import { triangles } from '../render3d/shapes.js';
import { ShipPass } from '../render3d/ships/pass.js';
import { DESIGNS } from '../render3d/ships/designs.js';
import { harbourMaterials } from '../render3d/models/harbour.js';
import { slab } from '../render3d/models/masonry.js';

/** The map: open water to row 15, the shore from 16, a road behind it. */
const W = 30;
const H = 22;
const SHORE = 16;
const TILE = 4;
/** The scene's middle: the map centred on the lab's origin (metres). */
const OX = -W * 2;
const OZ = -H * 2;

/** The camera scale (device px a world px) that asks the people's level `lod` (modelPass.js peopleLodFor). */
const SCALE_OF = [5, 3, 1];

/**
 * The ships: [label, note, entity fields, how it moves]. Moves: { lane: y,
 * x0, speed (m/s) } along +x round a loop of the lane; { circle: [x, y], r }
 * round a circle; { still: [x, y] }; { moored } at its quay's record.
 */
const SHIPS = [
  ['Corbita', 'merchantman of Alexandria, under sail', { kind: 'ship', type: 'ship', partner: 'alexandria', state: 'toDock' }, { lane: 2.6, x0: 1, speed: 1.9 }],
  ['Coaster', 'Massilia\'s coasting trader', { kind: 'ship', type: 'ship', partner: 'massilia', state: 'toDock' }, { lane: 2.6, x0: 9, speed: 1.9 }],
  ['Fishing boat', 'out to the grounds', { kind: 'ship', type: 'fishing_boat', state: 'toGround' }, { lane: 2.6, x0: 15, speed: 1.6 }],
  ['Venetic ship', 'the Gauls\' raider', { type: 'raider_ship', state: 'sail', people: 'gauls' }, { lane: 2.6, x0: 21, speed: 2.4 }],
  ['Liburnian', 'on passage: rowing, the sail set', { type: 'liburnian', state: 'sail' }, { lane: 6.2, x0: 1, speed: 3.6 }],
  ['Lembos', 'the Ligurian pirates\' galley', { type: 'raider_ship', state: 'sail', people: 'ligurians_coast' }, { lane: 6.2, x0: 10, speed: 2.9 }],
  ['Punic galley', 'Carthage\'s raider', { type: 'raider_ship', state: 'sail', people: 'carthaginians' }, { lane: 6.2, x0: 19, speed: 2.9 }],
  ['Liburnian', 'to fight: the sail furled, bows drawn', { type: 'liburnian', state: 'engage' }, { lane: 9.8, x0: 1, speed: 3.6 }],
  ['Fishing boat', 'at work: the net out', { kind: 'ship', type: 'fishing_boat', state: 'fishing' }, { still: [16, 12.8] }],
  ['Fishing boat', 'home with the catch', { kind: 'ship', type: 'fishing_boat', state: 'homeWithCatch' }, { lane: 9.8, x0: 17, speed: 1.6 }],
  ['Corbita', 'turning under sail (Corinth)', { kind: 'ship', type: 'ship', partner: 'corinthus', state: 'toDock' }, { circle: [25, 12.4], r: 1.9, speed: 1.7 }],
  ['Lembos', 'at anchor offshore', { type: 'raider_ship', state: 'offshore', people: 'barbarians' }, { still: [28.3, 13.2] }],
  ['Corbita', 'moored at its quay', { kind: 'ship', type: 'ship', partner: 'carthago', state: 'docked', target: 901 }, { moored: [3.5, 16] }],
  ['Coaster', 'moored', { kind: 'ship', type: 'ship', partner: 'cirta', state: 'docked', target: 902 }, { moored: [8.5, 16] }],
  ['Fishing boat', 'at its wharf', { kind: 'ship', type: 'fishing_boat', state: 'moored' }, { moored: [12.5, 16], owner: 903 }],
  ['Liburnian', 'berthed stern-to at its Statio', { type: 'liburnian', state: 'berthed', station: 904, slot: 0 }, { moored: [21.5, 14] }],
  ['Liburnian', 'berthed', { type: 'liburnian', state: 'berthed', station: 904, slot: 1 }, { moored: [21.5, 14] }],
  ['Liburnian', 'berthed', { type: 'liburnian', state: 'berthed', station: 904, slot: 2 }, { moored: [21.5, 14] }],
];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The ships</h2>
<p>Every vessel of the game as the WebGL renderer draws it, from the record rather than the 2D sprites. The <b>corbita</b>, the Roman
merchantman of the Torlonia relief and the Madrague de Giens wreck: a round deep hull, the sternpost curling into a swan's neck over
the master's cabin, a square mainsail and the small artemon raked over the bow, a steering oar on each quarter, amphorae in the hold.
The <b>coaster</b>, a small trader of the same build. The <b>liburnian</b>, the fleet's light bireme as the Navalia builds it, its
rowers pulling together to the hortator's mallet, marines on its fighting deck. The raiders' craft by their people: the
<b>lembos</b> of the Illyrian and Ligurian pirates, the black <b>Punic galley</b> with its ram and horse's head, the high-ended oak
<b>Venetic ship</b> of the Gauls with its sail of hides. The <b>fishing boat</b>, open, with its net.</p>
<p>Sails fill with the look's wind and are braced round to it; they are brailed up to the yard at a quay, at anchor and to fight.
Hulls heave, pitch and roll with the sea, throw a bow wave and a wake; a moored ship lies alongside its quay or, a warship, stern-to
its station.</p>
<h3>Controls</h3>
<ul>
<li>Shift+B: this scene. L: the level of detail. V: close on the next ship (orbit), and back. 1 to 4: day, golden hour, night,
winter. M, G, Z: the game's zooms; O: orbit; Q / E: turn the view.</li>
</ul>`;

/** The scene's map: open water, the shore, a road behind it. */
function shipsMap() {
  const map = new GameMap(W, H);
  map.terrain.fill(Terrain.WATER);
  for (let y = SHORE; y < H; y++) for (let x = 0; x < W; x++) map.terrain[map.idx(x, y)] = Terrain.GRASS;
  for (let x = 0; x < W; x++) map.road[map.idx(x, SHORE + 2)] = Road.ROAD;
  map.revision++;
  return map;
}

export function buildShipsScene(groundTex, look) {
  const map = shipsMap();
  const n = map.w * map.h;
  const sites = new Uint32Array(n);
  const owners = new Int32Array(n);
  // The quay's yard along the shore.
  for (let x = 0; x < W; x++) {
    const i = map.idx(x, SHORE);
    sites[i] = siteWord(SITE.YARD, 0, 0, 1, 0, 0, 0);
    owners[i] = 1;
  }
  const ground = new Ground(map, groundTex, {
    quality: 'high',
    scale: TILE,
    hooks: { farmAt: () => false, buildingAt: (i) => owners[i] > 0, siteAt: (i) => sites[i], ownerAt: (i) => owners[i] },
    waterHook: (i, wk) => (wk ? WATER_KIND.SEA : wk),
  });
  ground.group.position.set(OX, 0, OZ);
  ground.group.updateMatrixWorld(true);
  const group = new Group();
  group.name = 'ships-scene';
  group.add(ground.group);
  // The pass works in the game's tiles (a 3D unit a tile): its holder scales them to the lab's metres.
  const holder = new Group();
  holder.scale.setScalar(TILE);
  holder.position.set(OX, 0, OZ);
  group.add(holder);
  const pass = new ShipPass(holder);
  // The quays the moored ships lie at: an Emporium's and a wharf's front at the shore (records only: the
  // stone quay is drawn below), the Statio as the game draws it.
  const buildings = new Map([
    [901, { id: 901, type: 'dock', x: 2, y: SHORE, size: 3, waterSide: 0, berth: map.idx(3, SHORE - 1) }],
    [902, { id: 902, type: 'dock', x: 7, y: SHORE, size: 3, waterSide: 0, berth: map.idx(8, SHORE - 1) }],
    [903, { id: 903, type: 'wharf', x: 12, y: SHORE, size: 2, waterSide: 0, mooring: map.idx(12, SHORE - 1), boatId: 115 }],
    [904, { id: 904, type: 'naval_station', def: { kind: 'station' }, x: 20, y: SHORE - 2, size: 3, waterSide: 0, waterRows: 2, efficiency: 1 }],
  ]);
  const game = { map, buildings, units: new Map(), walkers: new Map(), military: { people: 'barbarians', active: null } };
  let raidId = 1;
  // The stone quay along the shore (a face of ashlar over the water's edge), where the moored lie alongside.
  const kits = new Map();
  const kitMeshes = (key, lod) => {
    const id = `${key}|${lod}`;
    let k = kits.get(id);
    if (k) return k;
    const kit = kitOf(modelFor(key).build(key, lod));
    k = kit.parts.map((p) => {
      const im = new InstancedMesh(p.geometry, p.material, 32);
      im.instanceMatrix.setUsage(DynamicDrawUsage);
      im.castShadow = p.cast;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      im.userData.when = p.when;
      holder.add(im);
      return im;
    });
    kits.set(id, k);
    return k;
  };
  // The Statio, as the game builds it (models/fleet.js), and a stone quay for the others (the Statio's own stone).
  const statio = new Group();
  group.add(statio);
  function buildStatio(lod) {
    statio.clear();
    const b = buildings.get(904);
    const v = MODELS.naval_station.variant(b, { snow: 0, T: 0 }, { game, frame: 0 });
    const all = [{ key: v.key, n: 1, mats: new Matrix4().toArray(), state: v.state }, ...(v.more || [])];
    const m = new Matrix4();
    for (const e of all) {
      const built = MODELS.naval_station.build(e.key, lod);
      for (let j = 0; j < e.n; j++) {
        const c = built.clone();
        c.matrixAutoUpdate = false;
        c.matrix.copy(m.fromArray(e.mats, j * 16));
        c.traverse((o) => { if (o.isMesh) o.visible = partShows(o.userData.when, e.state || 'always', false); });
        const at = new Group();
        at.position.set(OX + (b.x + 1.5) * TILE, 0, OZ + (b.y + 1.5) * TILE);
        at.add(c);
        statio.add(at);
      }
    }
  }
  const quay = new Group();
  group.add(quay);
  function buildQuay() {
    quay.clear();
    // A quay of travertine blocks along the shore, its face at the water's edge (where the moored lie alongside).
    const m = harbourMaterials();
    for (let x = 0; x < 18; x += 1.5) {
      const g = slab(1.48 * TILE, 1.25, 1.4, { bevel: 0.03, seed: 50 + x, wobble: 0.004, tone: 0.06, grime: 0.5 });
      const mesh = new Mesh(g, m.trav);
      mesh.position.set(OX + (x + 0.75) * TILE, -0.4, OZ + SHORE * TILE + 0.7);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      quay.add(mesh);
    }
  }
  const ships = SHIPS.map(([name, note, fields, how], i) => {
    const id = 100 + i;
    const e = { id, x: 0, y: 0, tx: 0, ty: 0, px: 0, py: 0, moving: !how.still && !how.moored, hp: 100, maxHp: 100, facing: 1, ...fields };
    // (A raider's warband aboard: the warriors stand on its decks.)
    if (e.type === 'raider_ship' && e.state !== 'offshore') e.crew = Array.from({ length: 8 }, () => 'raider');
    if (e.type === 'raider_ship') e.invasion = raidId++;
    return { name, note, e, how, id, unit: e.type === 'liburnian' || e.type === 'raider_ship', u: 0, v: 0 };
  });
  // The fishing boat at the wharf is the wharf's.
  buildings.get(903).boatId = ships.find((s) => s.how.owner === 903).id;
  let lod = 0;
  let last = 0;
  const r = { game, camera: { scale: SCALE_OF[0], x: 0, y: 0 }, viewTurn: 0, env: { lamps: 0, rain: 0 }, frameInfo: { tick: 0, selFort: 0 }, walkerSpots: [], shipSpots: [], selectedWalker: 0, selectedUnit: 0 };
  const LOOP = 27;
  const place = (s, t) => {
    const h = s.how;
    const e = s.e;
    let u;
    let v;
    let du = 0;
    let dv = 0;
    if (h.lane !== undefined) {
      const tiles = (t * h.speed) / TILE;
      u = 1 + ((h.x0 + tiles) % LOOP);
      v = h.lane;
      du = 1;
    } else if (h.circle) {
      const a = (t * h.speed) / (h.r * TILE);
      u = h.circle[0] + Math.cos(a) * h.r;
      v = h.circle[1] + Math.sin(a) * h.r;
      du = -Math.sin(a);
      dv = Math.cos(a);
    } else if (h.still) {
      [u, v] = h.still;
    } else {
      // Moored: the sim keeps it on its berth's tile, past the quay's front.
      const b = buildings.get(e.target || e.station || h.owner);
      u = b.x + 1.5;
      v = b.y - 0.5;
    }
    e.px = e.x;
    e.py = e.y;
    e.x = u;
    e.y = v;
    // (A walker's step: its tile and the next one, as the sim keeps them.)
    e.tx = e.x + du;
    e.ty = e.y + dv;
    s.u = u;
    s.v = v;
  };
  const life = (t) => {
    const dt = Math.max(0, Math.min(0.1, t - last));
    last = t;
    r.env.lamps = look && look.lamps && look.lamps[0] ? look.lamps[0].on : 0;
    r.env.sun = 1 - Math.min(1, r.env.lamps);
    r.camera.scale = SCALE_OF[lod];
    pass.begin(r, t, dt);
    for (const s of ships) {
      place(s, t);
      // (A walker's own place is its tile's corner: walkerWorld adds the half tile; a unit's is its middle.)
      // (Each raider's own people, as if its raid were the one under way: the pass asks the raid.)
      if (s.e.people) game.military.active = { id: s.e.invasion, people: s.e.people };
      pass.add(s.e, s.unit, s.u, s.v, {});
    }
    pass.end();
    for (const k of kits.values()) for (const im of k) im.count = 0;
    for (let i = 0; i < pass.nKits; i++) {
      const [key, m, state] = pass.kits[i];
      for (const im of kitMeshes(key, lod)) {
        if (!partShows(im.userData.when, state, false)) continue;
        if (im.count >= im.instanceMatrix.count) continue;
        m.toArray(im.instanceMatrix.array, im.count * 16);
        im.count++;
        im.instanceMatrix.needsUpdate = true;
      }
    }
  };
  buildStatio(0);
  buildQuay();
  let close = -1;
  // (Each label rides over its ship: the lab reads its place every frame.)
  const labelOf = (s) => ({ name: s.name, note: s.note, get x() { return OX + s.u * TILE; }, get z() { return OZ + s.v * TILE; }, y: 6.5 });
  // (One label for the three berthed liburnians.)
  const labelled = ships.filter((s) => !(s.e.state === 'berthed' && s.e.slot > 0));
  return {
    id: 'ships',
    title: 'Ships',
    key: 'Shift+B',
    info: INFO,
    group,
    ground,
    labels: labelled.map(labelOf),
    pass,
    // (The crews are posed on the GPU: GTAO's normal pass would see them at rest, so they throw no AO.)
    noAO: [pass.crew.group, pass.wake],
    figures: ships.map((s) => ({ name: s.name, get x() { return OX + s.u * TILE; }, get z() { return OZ + s.v * TILE; } })),
    fade: [-8, -8, 140, 160],
    lamp: [0, 2.2, 2],
    shadowBox: Math.max(W, H) * TILE * 0.55,
    life,
    get lod() { return lod; },
    setLod(l) {
      lod = l;
      buildStatio(l);
    },
    onKey(k, api) {
      if (k !== 'v') return false;
      close = close + 1 >= ships.length ? -1 : close + 1;
      if (api) api.closeUp(close, { dist: 14, el: 22, ty: 1.2, az: 40 });
      return true;
    },
    get close() { return close; },
    /** Where ship i is now (metres: the lab's ground), to aim a close-up at it. */
    where(i) {
      const s = ships[i];
      return s ? { x: OX + s.u * TILE, z: OZ + s.v * TILE } : null;
    },
    ships: ships.map((s) => ({ name: s.name, note: s.note, kind: s.e.type })),
    triangles: (key, l) => triangles(kitOf(modelFor(key).build(key, l)).parts[0].geometry),
    setTurn() {},
    setWinter() {},
    stats: () => ({ ...pass.stats, designs: Object.keys(DESIGNS).length }),
  };
}
