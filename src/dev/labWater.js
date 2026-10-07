/**
 * labWater.js
 * ----------------------------------------------------------------------------
 * The look lab's Water scene (render3d/models/aqueduct.js, castellum.js): a
 * town's water laid out on a small map of its own and read by the game's
 * own rules (aqueducts/aqueductLayout.js aqueductPiece, reservoirJoins), so
 * every tile shows the piece the game would draw there:
 *
 *   - a castellum on a lake's shore, filled through its intake, and an
 *     aqueduct from it east over a road on its arch, turning south at a
 *     corner, branching at a tee into a second castellum, which a short
 *     spur leaves through its house; the run ends on its own
 *   - a dry aqueduct over the same road to a dry castellum that no water
 *     reaches: silt in the channel, the tank empty but for a puddle
 *
 * The stone is any of the three looks (C cycles: tufa and peperino,
 * limestone, brick); L the level of detail; a hard frost (winter, or snow 2
 * and over) freezes the running water's margins. Labels name each thing.
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry, Matrix4 } from 'three';
import { material, waterMaterial } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { buildAqueductPiece, AQ_TOP } from '../render3d/models/aqueduct.js';
import { buildCastellum, buildInlet, buildIntake } from '../render3d/models/castellum.js';
import { aqueductPiece, reservoirJoins, AQUEDUCT_LOOKS } from '../render3d/aqueducts/aqueductLayout.js';
import { inletMatrix, inletKind } from '../render3d/aqueducts/aqueductGame.js';
import { partShows } from '../render3d/models.js';
import { buildFigure } from '../render3d/models/figure.js';

/** The scene's map: tiles W x H, 4 m each, its middle at the lab's origin. */
const MW = 21;
const MH = 13;
const TILE = 4;
/** Map tile (x, y) to the lab's metres (its middle). */
const at = (x, y) => [(x + 0.5 - MW / 2) * TILE, (y + 0.5 - MH / 2) * TILE];
/** The lake: the map's columns west of this. */
const SHORE = 3;

/** A small map with the layers the rules read (world/map.js's names), and its reservoirs. */
function labMap() {
  const n = MW * MH;
  const map = {
    w: MW,
    h: MH,
    size: n,
    revision: 1,
    aqueduct: new Uint8Array(n),
    road: new Uint8Array(n),
    building: new Uint16Array(n),
    terrain: new Uint8Array(n),
    inBounds: (x, y) => x >= 0 && y >= 0 && x < MW && y < MH,
    idx: (x, y) => y * MW + x,
    hasRoad(x, y) { return this.inBounds(x, y) && this.road[this.idx(x, y)] !== 0; },
  };
  for (let y = 0; y < MH; y++) for (let x = 0; x < SHORE; x++) map.terrain[map.idx(x, y)] = 4;
  // A road north and south through the town, under both aqueducts.
  for (let y = 0; y < MH; y++) map.road[map.idx(9, y)] = 1;
  const buildings = new Map();
  const reservoir = (id, x, y, hasWater) => {
    buildings.set(id, { id, type: 'reservoir', def: { kind: 'reservoir' }, x, y, size: 3, turn: 0, hasWater });
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) map.building[map.idx(x + dx, y + dy)] = id;
  };
  reservoir(1, 3, 5, true); // on the lake's shore
  reservoir(2, 15, 7, true); // fed by the aqueduct
  reservoir(3, 16, 1, false); // no water reaches it
  const aq = (x, y, w) => { map.aqueduct[map.idx(x, y)] = w; };
  // The full run: east from the shore's castellum over the road, a corner, a tee into the second, an end.
  for (let x = 6; x <= 13; x++) aq(x, 6, 2);
  for (let y = 7; y <= 10; y++) aq(13, y, 2);
  aq(14, 8, 2);
  // A spur out of the second castellum's back, through its house.
  aq(16, 6, 2);
  aq(16, 5, 2);
  // The dry run: from the dry castellum west over the road.
  for (let x = 8; x <= 15; x++) aq(x, 2, 1);
  return { map, buildings };
}

/** Labels: [map x, map y, height (m), name, note]. */
const LABELS = [
  [4, 6, 6.2, 'Castellum aquae', 'On the shore: filled through its intake'],
  [6, 6, AQ_TOP + 1.4, 'Into the castellum', 'The channel steps down to its inlet'],
  [11, 6, AQ_TOP + 0.6, 'Arcade', 'An arch a tile, the specus on top'],
  [9, 6, AQ_TOP + 1.8, 'Over the road', 'Rusticated piers, a blank tablet (Porta Maggiore)'],
  [13, 6, AQ_TOP + 1.0, 'Corner', 'A solid pier where the line turns'],
  [13, 8, AQ_TOP + 0.8, 'Tee', 'A branch to the second castellum'],
  [16, 8, 6.4, 'Fed by the aqueduct', 'Full: its overflows run'],
  [16, 5, AQ_TOP + 0.9, 'Out through the house', 'Into the castellum divisorium'],
  [13, 10, AQ_TOP + 0.6, 'End', 'The channel closed'],
  [12, 2, AQ_TOP + 0.6, 'Dry aqueduct', 'No water: silt on the channel floor'],
  [17, 2, 6.4, 'Dry castellum', 'Empty but for a puddle'],
];

/** The ground: beaten earth, basalt where the road runs, the lake to the west under a bank. */
function ground(map) {
  const g = new Group();
  const x0 = (SHORE - MW / 2) * TILE;
  const far = MW * TILE * 1.1;
  const earth = new PlaneGeometry(far - x0, MH * TILE * 2.2, 1, 1).rotateX(-Math.PI / 2).translate((x0 + far) / 2, 0, 0);
  g.add(new Mesh(tintGeometry(boxUV(earth)), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  // The bank down to the water, and the lake's bed under it.
  const bank = new PlaneGeometry(MH * TILE * 2.2, 0.9, 1, 1).rotateY(-Math.PI / 2).translate(x0, -0.45, 0);
  g.add(new Mesh(tintGeometry(boxUV(bank), () => 0.7), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  const bed = new PlaneGeometry(MW * TILE, MH * TILE * 2.2, 1, 1).rotateX(-Math.PI / 2).translate(x0 - MW * TILE / 2, -0.9, 0);
  g.add(new Mesh(tintGeometry(boxUV(bed), () => 0.35), material('earth', { surface: 'earth', vertexColors: true, snow: 1 })));
  const lake = new PlaneGeometry(MW * TILE, MH * TILE * 2.2, 1, 1).rotateX(-Math.PI / 2).translate(x0 - MW * TILE / 2, -0.22, 0);
  g.add(new Mesh(boxUV(lake), waterMaterial()));
  const basalt = material('basalt', { surface: 'basalt', vertexColors: true, snow: 0.6, normal: 1 });
  for (let x = 0; x < MW; x++) {
    if (!map.road[map.idx(x, 0)]) continue;
    const [cx] = at(x, 0);
    const p = new PlaneGeometry(TILE * 0.8, MH * TILE + 24, 1, 1).rotateX(-Math.PI / 2).translate(cx, 0.004, 0);
    g.add(new Mesh(tintGeometry(boxUV(p)), basalt));
  }
  for (const m of g.children) m.receiveShadow = true;
  return g;
}

const CONTROLS = `<h3>Controls</h3>
<ul>
<li>9: the water; C: the stone (tufa and peperino, limestone, brick); L: the level of detail (0 close, 1 middle, 2 far).</li>
<li>1 to 4: day, golden hour, night, winter (a hard frost). N: snow lying; T: rain. M, G, Z: the game's zooms; O: orbit; Q / E: turn the view.</li>
</ul>`;

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>Aqueducts and the castellum aquae</h2>
<p>Rome brought water to its towns in channels laid on a steady fall, underground where the land was high and carried on arcades over
the low ground: the Aqua Marcia and the Aqua Claudia across the Campagna in squared tufa and peperino, the Pont du Gard and Segovia in
squared stone laid dry, the Aqua Alexandrina in brick-faced concrete. On top runs the specus that Frontinus describes, a channel about two
feet wide between masonry walls, lined with opus signinum (lime and crushed tile, which holds water) and roofed with slabs; here the slabs
lie only over the piers, so the water is seen, as along the open channel on Segovia's arcade. A running channel leaks: its piers darken
under the joints. Over a road the arcade takes one wide arch of dressed travertine with rusticated piers and a blank tablet, as where the
Aqua Claudia crossed the Via Labicana and the Via Praenestina at the Porta Maggiore.</p>
<p>The water ends in a castellum aquae: an open tank lined with signinum on a paved podium, the channel stepping down to it and pouring in
over its coping. At its back the castellum divisorium, as at Pompeii's Porta Vesuvio: a small house over three outlets behind bronze
grilles (Vitruvius's three shares, for the basins, the baths and the houses), its three lead pipes leaving down its back with bronze
stopcocks. At its corners two water towers, the brick piers with lead tanks on top that stood along Pompeii's streets; on its sides the
overflows run into troughs. A castellum on a shore fills through an intake; one no water reaches stands dry, silt and a puddle in its tank.</p>
${CONTROLS}`;

/** The Water scene, in the commerce scenes' terms (labCommerce.js): { water: scene }. */
export function buildWaterScene() {
  const group = new Group();
  group.name = 'water-scene';
  const { map, buildings } = labMap();
  group.add(ground(map));
  const built = new Group();
  group.add(built);
  // Figures for scale: one walking under the full arch over the road, one on the podium by a trough.
  for (const [x, y, dx, dz, ry, opts] of [[9, 6, 0.3, 0.2, Math.PI, { cloth: 0x8a5a3a }], [9, 7, -0.4, 0.6, 0.3, { cloth: 0x6f5a8a, cloth2: 0xc2a46a, long: true, skin: 0xb08664, hair: 0x221812 }]]) {
    const f = buildFigure(opts);
    const [cx, cz] = at(x, y);
    f.position.set(cx + dx, 0.02, cz + dz);
    f.rotation.y = ry;
    group.add(f);
  }

  let lod = 0;
  let look = 'lime';
  let frost = false;
  const kits = new Map();
  const kit = (key) => {
    const k = `${key}|${lod}`;
    if (!kits.has(k)) {
      const [kind, lk, what = ''] = key.split(':');
      let m;
      if (kind === 'aqueduct') m = buildAqueductPiece(key, lod);
      else if (what.startsWith('inlet') || what === 'house') m = buildInlet({ look: lk, lod, house: what === 'house', off: Number(what.slice(5)) || 0 });
      else if (what === 'intake') m = buildIntake({ look: lk, lod });
      else m = buildCastellum({ look: lk, lod, ice: what === 'ice' });
      kits.set(k, m);
    }
    return kits.get(k);
  };
  /** A copy of a kit's meshes (shared geometry) at matrix `mat`, the parts its state shows. */
  const place = (m, mat, state, ice) => {
    const h = new Group();
    h.matrixAutoUpdate = false;
    h.matrix.copy(mat);
    for (const mesh of m.meshes) {
      if (!partShows(mesh.userData.when, state, ice)) continue;
      const c = new Mesh(mesh.geometry, mesh.material);
      c.castShadow = mesh.castShadow;
      c.receiveShadow = true;
      h.add(c);
    }
    built.add(h);
    return h;
  };
  const at4 = (x, z, T) => new Matrix4().makeRotationY((-T * Math.PI) / 2).setPosition(x, 0, z);
  const pieces = [];
  function build() {
    built.clear();
    for (const [, m] of kits) for (const mesh of m.meshes) mesh.geometry.dispose();
    kits.clear();
    pieces.length = 0;
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        const i = map.idx(x, y);
        if (!map.aqueduct[i]) continue;
        const p = aqueductPiece(map, buildings, x, y, 0, look);
        const [cx, cz] = at(x, y);
        place(kit(p.key), at4(cx, cz, p.T), p.state, frost && p.state === 'flowing');
        pieces.push({ x, y, key: p.key, T: p.T, state: p.state });
      }
    }
    for (const b of buildings.values()) {
      const [cx, cz] = at(b.x + 1, b.y + 1);
      const base = at4(cx, cz, 0);
      const state = b.hasWater ? 'flowing' : 'dry';
      place(kit(`reservoir:${look}${frost ? ':ice' : ''}`), base, state, frost);
      for (const j of reservoirJoins(map, b, (tx, ty) => map.inBounds(tx, ty) && map.terrain[map.idx(tx, ty)] === 4)) {
        const what = inletKind(j);
        const st = j.kind === 'water' ? state : j.state;
        place(kit(`reservoir:${look}:${what}`), base.clone().multiply(inletMatrix(j.side, j.k)), st, false);
      }
      pieces.push({ x: b.x, y: b.y, key: `reservoir:${look}`, T: 0, state });
    }
  }
  build();

  const labels = LABELS.map(([x, y, hgt, name, note]) => {
    const [lx, lz] = at(x, y);
    return { name, note, x: lx, y: hgt, z: lz };
  });
  return {
    water: {
      id: 'water',
      title: 'Water',
      key: '9',
      info: INFO,
      group,
      labels,
      fade: [0, 0, MW * TILE * 0.56, MW * TILE * 0.56 + 8],
      // The lamp's light by the second castellum's door.
      lamp: [at(16, 8)[0] + 2.2, 2.4, at(16, 8)[1] - 4.9],
      shadowBox: 46,
      get lod() { return lod; },
      get look() { return look; },
      pieces,
      setLod(n) {
        if (n === lod) return;
        lod = n;
        build();
      },
      setLook(name) {
        if (name === look || !AQUEDUCT_LOOKS.includes(name)) return;
        look = name;
        build();
      },
      /** C: the next stone. */
      onKey(k) {
        if (k !== 'c') return false;
        this.setLook(AQUEDUCT_LOOKS[(AQUEDUCT_LOOKS.indexOf(look) + 1) % AQUEDUCT_LOOKS.length]);
        return true;
      },
      setTurn() {},
      /** A hard frost: the running water's margins freeze, a dry tank's puddle turns to ice. */
      setWinter(on) {
        if (!!on === frost) return;
        frost = !!on;
        build();
      },
      /** Triangles of each piece shown, the castellum's and its inlets', at a level of detail (built fresh). */
      triangles(l = lod) {
        const out = {};
        for (const p of pieces) if (p.key.startsWith('aqueduct:')) out[p.key] ??= buildAqueductPiece(p.key, l).triangles;
        out.castellum = buildCastellum({ look, lod: l }).triangles;
        out.inlet = buildInlet({ look, lod: l }).triangles;
        out.intake = buildIntake({ look, lod: l }).triangles;
        return out;
      },
    },
  };
}
