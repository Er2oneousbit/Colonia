/**
 * labWalkers.js
 * ----------------------------------------------------------------------------
 * The look lab's Walkers scene (the = key): every walker type of the game as
 * the WebGL renderer draws it in 3D (render3d/walkers/: the game's own pass,
 * looks, motion and pieces), each walking a little loop of road of its own,
 * labelled: three tiles by two, turning at its corners as a walker turns at
 * a street's. The variants that look different have loops of their own: a
 * cart pushed loaded and empty, a farm's wagon, horses led, a settler's
 * family and his mule, the entertainers of each venue, a prefect running to
 * a fire and one throwing water at it, a protester standing.
 *
 * L: the level of detail. V: the camera close on the next loop (orbit),
 * then back. window.__lab.walkers: closeUp(i), loops, stats(), setLod(n).
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry, InstancedMesh, DynamicDrawUsage } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { WalkerPass } from '../render3d/walkers/pass.js';
import { kitOf } from '../render3d/kit.js';
import { modelFor } from '../render3d/models.js';
import { CONFIG } from '../config.js';

/** Tiles a loop's cell takes, columns of cells, metres a tile. */
const CELL = 4;
const COLS = 7;
const TILE = 4;
/** A loop: three tiles by two, round the tiles' middles. */
const LOOP = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1]];
/** The game's walking pace: tiles a second at 1x (config.js WALKER_SPEED x the ticks a second). */
const PACE = CONFIG.WALKER_SPEED * CONFIG.TICKS_PER_SECOND;

/** Every loop: [label, note, the walker's fields]. */
const WALKERS = [
  ['Prefect', 'vigiles: red tunic, caligae, the bucket', { type: 'prefect' }],
  ['Prefect to a fire', 'running', { type: 'prefect', state: 'toFire' }],
  ['Prefect at a fire', 'throwing water at it', { type: 'prefect', state: 'extinguish', still: true, aim: [1, 0] }],
  ['Engineer', 'the ten-foot rod, his tool case', { type: 'engineer' }],
  ['Priest', 'capite velato, the patera, his god\'s colour', { type: 'priest', god: 'mars' }],
  ['Missionary', 'paenula, a staff', { type: 'missionary' }],
  ['Teacher', 'pallium, a roll, tablets', { type: 'teacher' }],
  ['Librarian', 'a book box (capsa)', { type: 'librarian' }],
  ['Scholar', 'old, bearded, roll and tablets', { type: 'scholar' }],
  ['Barber', 'his case of razors', { type: 'barber' }],
  ['Physician', 'pallium, the medical case', { type: 'physician' }],
  ['Physician treating', 'standing, talking', { type: 'physician', state: 'treat', still: true }],
  ['Bath attendant', 'towel, oil flask and strigil', { type: 'bather' }],
  ['Actor', 'his mask (theatre)', { type: 'entertainer', venue: 'theater' }],
  ['Gladiator', 'helmet, shield, gladius (amphitheatre)', { type: 'entertainer', venue: 'amphitheater' }],
  ['Beast fighter', 'the hunting spear (arena)', { type: 'performer', venue: 'colosseum' }],
  ['Charioteer', 'a biga, his faction\'s colour', { type: 'charioteer', speed: 2 }],
  ['Gardener', 'shears', { type: 'gardener' }],
  ['Tax collector', 'purse and tablets', { type: 'taxman' }],
  ['Market vendor', 'a basket on her head', { type: 'vendor', id: 0 }],
  ['Market vendor', 'a basket at his hip', { type: 'vendor', id: 4 }],
  ['Market buyer', 'home with fruit', { type: 'buyer', cargo: { good: 'fruit', amount: 100 } }],
  ['Cart pusher', 'a handcart of wine', { type: 'cart', cargo: { good: 'wine', amount: 200 } }],
  ['Cart pusher', 'timber, half a load', { type: 'cart', cargo: { good: 'timber', amount: 100 } }],
  ['Cart pusher', 'empty', { type: 'cart' }],
  ['Farm wagon', 'the ox, its wagon of wheat', { type: 'cart', cargo: { good: 'wheat', amount: 400 }, origin: { kind: 'farm', produces: 'wheat' } }],
  ['Drover', 'horses led on a rope', { type: 'cart', cargo: { good: 'horses', amount: 200 }, origin: { kind: 'ranch', produces: 'horses' } }],
  ['Builders', 'a work camp\'s crew', { type: 'builders' }],
  ['Immigrants', 'a family, bundles and a basket', { type: 'immigrant', people: 3 }],
  ['Settler', 'with his mule', { type: 'immigrant', mule: true }],
  ['Emigrant', 'leaving, his bundle', { type: 'emigrant' }],
  ['Homeless', 'worn, alone', { type: 'homeless' }],
  ['Recruit', 'mail, helmet, spear and shield', { type: 'recruit' }],
  ['Trade caravan', 'pack mules: wine, iron', { type: 'caravan', packs: ['wine', 'iron'] }],
  ['Village trader', 'the natives\' wool, a bundle', { type: 'native_trader' }],
  ['Protester', 'a placard, standing', { type: 'protester', still: true }],
  ['Thief', 'his loot on his shoulder', { type: 'thief' }],
  ['Rioter', 'a torch', { type: 'rioter' }],
];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The walkers</h2>
<p>Every walker of the game as the WebGL renderer draws it while it draws the buildings as models: the people of the 3D look dressed
for their work from the Roman record, with what they carry, the beasts they lead and the carts they push, each walking its own loop.
Their legs step with the ground they cover (no sliding at any game speed, still when paused); they turn smoothly at a corner; their
families and mules follow the way they came. The game's own pass draws them: one float texture of places a frame, one instanced draw a
piece.</p>
<h3>Controls</h3>
<ul>
<li>=: this scene. L: the level of detail. V: close on the next loop (orbit), and back. 1 to 4: day, golden hour, night, winter.
N: snow; T: rain. M, G, Z: the game's zooms; O: orbit.</li>
</ul>`;

/** The camera scale (device px a world px) that asks the people's level `lod` (modelPass.js peopleLodFor). */
const SCALE_OF = [5, 3, 1];

export function buildWalkersScene() {
  const group = new Group();
  group.name = 'walkers-scene';
  const rows = Math.ceil(WALKERS.length / COLS);
  const W = COLS * CELL;
  const H = rows * CELL;
  // Tiles to the lab's metres: the scene centred on the origin.
  const ox = ((W - 1) / 2) * TILE;
  const oz = ((H - 1) / 2) * TILE;
  const floor = new Mesh(tintGeometry(boxUV(new PlaneGeometry(W * TILE + 8, H * TILE + 8).rotateX(-Math.PI / 2))), material('travertine', { surface: 'travertine', vertexColors: true, snow: 1 }));
  floor.receiveShadow = true;
  group.add(floor);
  // The roads: each loop's six tiles paved in basalt.
  const road = material('basalt', { surface: 'basalt', vertexColors: true, snow: 1 });
  // The pass draws in the game's tiles (a 3D unit a tile): its holder scales them to the lab's metres.
  const holder = new Group();
  holder.scale.setScalar(TILE);
  holder.position.set(-ox, 0, -oz);
  group.add(holder);
  const pass = new WalkerPass(holder);
  const walkers = WALKERS.map(([name, note, f], i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const at = [col * CELL, row * CELL];
    for (const [x, y] of LOOP) {
      const g = new PlaneGeometry(TILE, TILE).rotateX(-Math.PI / 2).translate((at[0] + x + 0.5) * TILE - ox, 0.01, (at[1] + y + 0.5) * TILE - oz);
      const m = new Mesh(tintGeometry(boxUV(g)), road);
      m.receiveShadow = true;
      group.add(m);
    }
    const { still, aim, origin, venue, speed = 1, id = 0, ...fields } = f;
    const w = { id: 100 + i * 7 + id, x: at[0], y: at[1], tx: at[0], ty: at[1], progress: 0, moving: !still, lastDir: 1, walked: 0, state: 'roam', speed: 0.1, cargo: null, people: 0, ...fields };
    return { name, note, w, at, still, aim: aim || null, ctx: { origin: origin || null, venue: venue || null }, speed, x: (at[0] + 1.5) * TILE - ox, z: (at[1] + 1) * TILE - oz };
  });
  // The goods on the carts: the warehouse's loads, as the game's model pass places them.
  const kits = new Map();
  const kitMeshes = (key, lod) => {
    const id = `${key}|${lod}`;
    let k = kits.get(id);
    if (k) return k;
    const kit = kitOf(modelFor(key).build(key, lod));
    k = kit.parts.map((p) => {
      const im = new InstancedMesh(p.geometry, p.material, 16);
      im.instanceMatrix.setUsage(DynamicDrawUsage);
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      holder.add(im);
      return im;
    });
    kits.set(id, k);
    return k;
  };
  let lod = 0;
  let last = 0;
  const life = (t) => {
    const dt = Math.max(0, Math.min(0.1, t - last));
    last = t;
    pass.begin(SCALE_OF[lod], t, dt);
    for (const L of walkers) {
      const w = L.w;
      const s = (t * PACE * L.speed + L.at[0] * 0.37) % LOOP.length;
      const i = Math.floor(s);
      const a = LOOP[i];
      const b = LOOP[(i + 1) % LOOP.length];
      if (!L.still) {
        w.x = L.at[0] + a[0];
        w.y = L.at[1] + a[1];
        w.tx = L.at[0] + b[0];
        w.ty = L.at[1] + b[1];
        w.progress = s - i;
        w.lastDir = b[0] > a[0] ? 1 : b[0] < a[0] ? 3 : b[1] > a[1] ? 2 : 0;
        w.walked = (t * PACE * L.speed) % 100;
      }
      if (!pass.canDraw(w, L.ctx)) continue;
      const p = w.moving ? w.progress : 0;
      pass.add(w, { fx: w.x + (w.tx - w.x) * p + 0.5, fy: w.y + (w.ty - w.y) * p + 0.5, lift: 0, stride: w.walked, vt: 0, W, H, aim: L.aim }, L.ctx);
    }
    pass.end();
    for (const k of kits.values()) for (const im of k) im.count = 0;
    const loadLod = lod;
    for (const [key, m] of pass.loads) {
      for (const im of kitMeshes(key, loadLod)) {
        if (im.count >= im.instanceMatrix.count) continue;
        m.toArray(im.instanceMatrix.array, im.count * 16);
        im.count++;
        im.instanceMatrix.needsUpdate = true;
      }
    }
  };
  let close = -1;
  return {
    id: 'walkers',
    title: 'Walkers',
    key: '=',
    info: INFO,
    group,
    labels: walkers.map((L) => ({ name: L.name, note: L.note, x: L.x, z: L.z, y: 2.6 })),
    pass,
    // (The people are posed on the GPU: GTAO's normal pass would see them at rest, so they throw no AO.)
    noAO: [pass.group],
    figures: walkers.map((L) => ({ name: L.name, x: L.x, z: L.z })),
    fade: [0, 0, 90, 110],
    lamp: [0, 2.2, 2],
    shadowBox: Math.max(W, H) * TILE * 0.55,
    life,
    get lod() { return lod; },
    setLod(n) { lod = n; },
    /** V: the next loop close up (the lab's orbit), then back. */
    onKey(k, api) {
      if (k !== 'v') return false;
      close = close + 1 >= walkers.length ? -1 : close + 1;
      if (api) api.closeUp(close, { dist: 13, el: 34, ty: 0.6, az: 35 });
      return true;
    },
    get close() { return close; },
    /** Where loop i's walker stands now (metres: the lab's ground), to aim a close-up at him. */
    where(i) {
      const L = walkers[i];
      if (!L) return null;
      const p = L.w.moving ? L.w.progress : 0;
      return { x: (L.w.x + (L.w.tx - L.w.x) * p + 0.5) * TILE - ox, z: (L.w.y + (L.w.ty - L.w.y) * p + 0.5) * TILE - oz };
    },
    setTurn() {},
    setWinter() {},
    stats: () => ({ ...pass.stats }),
  };
}
