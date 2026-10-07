/**
 * labWalls.js
 * ----------------------------------------------------------------------------
 * The look lab's Walls scene (render3d/models/townWall.js, turris.js): a
 * piece of a walled town laid out on a small map of its own and read by the
 * game's own rules (walls/wallLayout.js wallPiece), so every tile shows the
 * piece the game would draw there:
 *
 *   - the north wall with a corner tower where the west wall meets it, a
 *     gate across the main road between its round flanking towers, a
 *     square tower on the run, and a watchtower (Turris) the wall runs
 *     into at its east end
 *   - an inner wall to the south showing the damage states side by side:
 *     sound, cracked, breaching; and a battered gate, shut (an enemy near)
 *
 * The stone is any of the provinces' (C cycles: polygonal, tufa, squared
 * limestone, brick); L the level of detail. Labels name each thing.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { buildWallPiece, WALL_TOP } from '../render3d/models/townWall.js';
import { buildTurris } from '../render3d/models/turris.js';
import { wallPiece, stubKey, WALL_LOOK_NAMES } from '../render3d/walls/wallLayout.js';
import { rotMask } from '../render/view.js';
import { partShows } from '../render3d/models.js';
import { buildFigure } from '../render3d/models/figure.js';
import { Wall } from '../world/map.js';

/** The scene's map: tiles W x H, 4 m each, its middle at the lab's origin. */
const MW = 18;
const MH = 12;
const TILE = 4;
/** Map tile (x, y) to the lab's metres (its middle). */
const at = (x, y) => [(x + 0.5 - MW / 2) * TILE, (y + 0.5 - MH / 2) * TILE];

/** A small map with the layers the wall rules read (world/map.js's names). */
function labMap() {
  const n = MW * MH;
  const map = {
    w: MW,
    h: MH,
    wall: new Uint8Array(n),
    road: new Uint8Array(n),
    building: new Uint16Array(n),
    inBounds: (x, y) => x >= 0 && y >= 0 && x < MW && y < MH,
    idx: (x, y) => y * MW + x,
    hasRoad(x, y) { return this.inBounds(x, y) && this.road[this.idx(x, y)] !== 0; },
  };
  const wall = (x, y, kind = Wall.WALL) => { map.wall[map.idx(x, y)] = kind; };
  // Roads: the main road north and south through both gates, a second through the inner gate.
  for (let y = 0; y < MH; y++) map.road[map.idx(6, y)] = 1;
  for (let y = 5; y < MH; y++) map.road[map.idx(11, y)] = 1;
  // The north wall, its corner with the west wall, the gate across the main road.
  for (let x = 1; x <= 14; x++) wall(x, 2, x === 6 ? Wall.GATE : Wall.WALL);
  for (let y = 3; y <= 11; y++) wall(1, y);
  // The watchtower east of the north wall's end (2 x 2 at 15..16, 1..2).
  const buildings = new Map([[7, { id: 7, type: 'tower', def: { kind: 'tower' }, x: 15, y: 1, size: 2, efficiency: 1 }]]);
  for (const [x, y] of [[15, 1], [16, 1], [15, 2], [16, 2]]) map.building[map.idx(x, y)] = 7;
  // The inner wall (damage states), its gate across the second road.
  // (Across the main road too: a sound gate there, between its flanking towers.)
  for (let x = 3; x <= 14; x++) wall(x, 8, x === 11 || x === 6 ? Wall.GATE : Wall.WALL);
  return { map, buildings };
}

/** Hit points per tile of the inner wall: what the sim's wallHpOf would say. */
const HP = {
  '8,8': { hp: 100, max: 220 }, // cracked (under half)
  '9,8': { hp: 40, max: 220 }, // breaching (under a quarter)
  '10,8': { hp: 150, max: 320 }, // the gate's flank: its tower cracked
  '11,8': { hp: 140, max: 320 }, // the gate battered
};

/** Labels: [map x, map y, height (m), name, note]. */
const LABELS = [
  [1, 2, WALL_TOP + 4.6, 'Corner tower', 'Square, under a hipped roof'],
  [6, 2, 8.4, 'Gate (porta)', 'Open to the townsfolk'],
  [5, 2, 9.8, 'Flanking tower', 'Sixteen-sided, as the Porta Palatina'],
  [12, 2, 9.4, 'Wall tower', 'Every eight tiles along a run'],
  [15.5, 1.5, 10.6, 'Watchtower (Turris)', 'Manned: archers on the gallery'],
  [3, 2, WALL_TOP + 0.6, 'Curtain wall', 'Footing, string course, parapets, merlons'],
  [4, 8, WALL_TOP + 0.6, 'Sound', 'Over half its hit points'],
  [8, 8, WALL_TOP + 0.6, 'Cracked', 'Under half: merlons down, cracks'],
  [9, 8, 3.6, 'Breaching', 'Under a quarter: broken down'],
  [11, 8, 8.2, 'Gate, battered and shut', 'An enemy near: the doors shut'],
];

/** The ground: beaten earth, basalt where the roads run. */
function ground(map) {
  const g = new Group();
  const earth = new PlaneGeometry(MW * TILE * 2.2, MH * TILE * 2.2, 1, 1).rotateX(-Math.PI / 2);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  const basalt = material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 });
  for (let x = 0; x < MW; x++) {
    let y0 = -1;
    for (let y = 0; y <= MH; y++) {
      const on = y < MH && map.road[map.idx(x, y)];
      if (on && y0 < 0) y0 = y;
      if (!on && y0 >= 0) {
        const [cx] = at(x, 0);
        const z0 = (y0 - MH / 2) * TILE - (y0 === 0 ? 12 : 0);
        const z1 = (y - MH / 2) * TILE + (y === MH ? 12 : 0);
        const p = new PlaneGeometry(TILE * 0.8, z1 - z0, 1, 1).rotateX(-Math.PI / 2).translate(cx, 0.004, (z0 + z1) / 2);
        g.add(new Mesh(tintGeometry(boxUV(p)), basalt));
        y0 = -1;
      }
    }
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

const CONTROLS = `<h3>Controls</h3>
<ul>
<li>A: the walls; C: the stone (polygonal, tufa, squared limestone, brick); L: the level of detail (0 close, 1 middle, 2 far).</li>
<li>1 to 4: day, golden hour, night, winter. N: snow lying; T: rain. M, G, Z: the game's zooms; O: orbit; Q / E: turn the view.</li>
</ul>`;

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>Town walls, gates and towers</h2>
<p>A Roman town was walled: the Servian Wall round Rome in squared tufa, the colonies of the Republic in the stone of their hills,
polygonal blocks fitted dry at Cosa, Alatri and Norba, squared limestone at Paestum, brick at Turin where the Po plain gave no stone.
Here a curtain about two storeys to its wall-walk on a footing of bigger stones, a string course under the walk, a parapet on each face
with merlons capped in dressed stone; square towers under hipped roofs at its corners and along its runs, as Pompeii's and Aosta's.</p>
<p>The gate is a gatehouse across the road: one arched passage with dressed voussoirs and a keystone, a gallery storey over it with
arched windows (the Porta Palatina's), crenels on top, studded doors standing open to the townsfolk and shut when an enemy is near,
torches in iron brackets either side of the arch. Its flanking towers are sixteen-sided under cones of tiles.</p>
<p>The watchtower (Turris) is after Hadrian's Wall's turrets and the towers on Trajan's Column: a stone tower with a timber gallery on
beams round its upper storey, a ladder, a tiled roof, a torch out of the window, a crib of logs for the beacon and a rick of hay
beside it; manned, two archers keep watch. Walls struck by raiders crack, lose their merlons and break down; a breached wall leaves
rubble, and built again it rises new.</p>
${CONTROLS}`;

/** The Walls scene, in the commerce scenes' terms (labCommerce.js): { walls: scene }. */
export function buildWallsScene() {
  const group = new Group();
  group.name = 'walls-scene';
  const { map, buildings } = labMap();
  group.add(ground(map));
  const built = new Group();
  group.add(built);
  // Figures for scale: one in the gate's passage, one on the road outside it.
  for (const [x, y, dz, ry, opts] of [[6, 2, 0.4, Math.PI, { cloth: 0x8a5a3a }], [6, 1, -1.0, 0.2, { cloth: 0x6f5a8a, cloth2: 0xc2a46a, long: true, skin: 0xb08664, hair: 0x221812 }]]) {
    const f = buildFigure(opts);
    const [cx, cz] = at(x, y);
    f.position.set(cx + 0.6, 0.02, cz + dz);
    f.rotation.y = ry;
    group.add(f);
  }

  let lod = 0;
  let look = 'polygonal';
  const kits = new Map();
  const kit = (key) => {
    const k = `${key}|${lod}`;
    if (!kits.has(k)) kits.set(k, key.startsWith('tower:') ? buildTurris({ look, lod }) : buildWallPiece(key, lod));
    return kits.get(k);
  };
  /** A copy of a kit's meshes (shared geometry) placed at (x, z) turned T, the parts its state shows. */
  const place = (m, x, z, T, state) => {
    const h = new Group();
    h.position.set(x, 0, z);
    h.rotation.y = (-T * Math.PI) / 2;
    for (const mesh of m.meshes) {
      if (!partShows(mesh.userData.when, state, false)) continue;
      const c = new Mesh(mesh.geometry, mesh.material);
      c.castShadow = mesh.castShadow;
      c.receiveShadow = true;
      h.add(c);
    }
    built.add(h);
    return h;
  };
  const pieces = [];
  function build() {
    built.clear();
    for (const [, m] of kits) for (const mesh of m.meshes) mesh.geometry.dispose();
    kits.clear();
    pieces.length = 0;
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        const i = map.idx(x, y);
        if (!map.wall[i]) continue;
        const p = wallPiece(map, buildings, x, y, 0, look, HP[`${x},${y}`] || null);
        const [cx, cz] = at(x, y);
        // The inner gate is shut: an enemy is near it.
        const state = p.gate ? (x === 11 ? 'shut' : 'open') : 'always';
        const h = place(kit(p.key), cx, cz, p.T, state);
        for (const bit of p.stubs) {
          let R = 0;
          while (rotMask(2, R) !== bit) R++;
          place(kit(stubKey(look)), cx, cz, R, 'always');
        }
        pieces.push({ x, y, key: p.key, T: p.T, h });
      }
    }
    const [tx, tz] = at(15.5, 1.5);
    place(kit(`tower:${look}`), tx, tz, 0, 'open');
  }
  build();

  const labels = LABELS.map(([x, y, hgt, name, note]) => {
    const [lx, lz] = at(x, y);
    return { name, note, x: lx, y: hgt, z: lz };
  });
  return {
    walls: {
      id: 'walls',
      title: 'Walls',
      key: 'A',
      info: INFO,
      group,
      labels,
      fade: [0, 0, MW * TILE * 0.62, MW * TILE * 0.62 + 8],
      // The lamp's light at the gate's torch (its right-hand bracket, on the face toward the road outside).
      lamp: [at(6, 2)[0] + 1.62, 3.15, at(6, 2)[1] + 1.88],
      shadowBox: 40,
      get lod() { return lod; },
      get look() { return look; },
      pieces,
      setLod(n) {
        if (n === lod) return;
        lod = n;
        build();
      },
      setLook(name) {
        if (name === look || !WALL_LOOK_NAMES.includes(name)) return;
        look = name;
        build();
      },
      /** C: the next stone. */
      onKey(k) {
        if (k !== 'c') return false;
        this.setLook(WALL_LOOK_NAMES[(WALL_LOOK_NAMES.indexOf(look) + 1) % WALL_LOOK_NAMES.length]);
        return true;
      },
      setTurn() {},
      setWinter() {},
      /** Triangles of each piece shown, and the watchtower's, at a level of detail (built fresh). */
      triangles(l = lod) {
        const out = {};
        for (const p of pieces) out[p.key] ??= buildWallPiece(p.key, l).triangles;
        out.stub = buildWallPiece(stubKey(look), l).triangles;
        out.turris = buildTurris({ look, lod: l }).triangles;
        return out;
      },
    },
  };
}
