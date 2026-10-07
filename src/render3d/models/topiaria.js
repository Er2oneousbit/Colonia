/**
 * models/topiaria.js
 * ----------------------------------------------------------------------------
 * The gardeners' yard of the 3D look: the topiarius's yard on one tile
 * (4 m), from what is known of Roman gardeners and their tools rather than
 * from the sprite:
 *
 *   - The topiarius was the slave or freedman who kept a house's garden and
 *     clipped its box and cypress into hedges, letters and beasts (Pliny's
 *     letters; Cicero's own topiarius, praised for his ivy). His tools are
 *     known from finds and reliefs: the hoe (ligo), the rake (rastrum), the
 *     pruning knife with its hooked blade (falx), shears, wicker baskets.
 *   - Plants were raised in pots and set out in them: the pierced pots
 *     (ollae perforatae) Jashemski found along the garden walls of Pompeii
 *     and in the gardens of Fishbourne, holes in their sides for the roots.
 *     Water came in a jar and was sprinkled by hand.
 *
 * So, in 4 m: a low wall of rubble round the yard with a gate to the
 * street (+z) between piers, a lantern on one; a shed at the back under a
 * lean-to of tiles, its door; a potting bench along a wall with pierced
 * pots of seedlings on it and under it; rows of seedlings in a bed; a
 * compost heap in a wattle bin; the tools against the shed; box clipped to
 * a cone and a ball in pots, waiting to go out to a garden.
 *
 * States (meshes tagged in userData.when, models.js partShows):
 *   'open'  staffed: the gate and the shed door open, a gardener clipping
 *           the cone with his shears, the lantern lit at night
 *   'shut'  no staff: shut up, the tools put away by the shed
 *
 * Metres, the tile's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { artRng } from '../texgen.js';
import { slab, lantern, lanternPane, TaggedParts } from './masonry.js';
import { lin, ruralMaterials, wallRun, leanTo, wattleFence, heap, basket, blk } from './rural.js';
import { people, staff } from './castra.js';
import { learningMaterials, person } from './learning.js';
import { hortusMaterials } from './hortus.js';

/** The yard's measures (metres): the tests, the lab and the game read them. */
export const TOPIARIA = Object.freeze({
  /** The wall's height and its outer face in from the tile's edge. */
  wallH: 0.78,
  inset: 0.05,
  /** The gate's opening in the front wall. */
  gate: Object.freeze([-0.5, 0.5]),
  /** The lantern on the right gate pier (x, y, z), facing the street. */
  lamp: Object.freeze([0.5, 1.0, 1.83]),
});

const T = TOPIARIA;
const E = 2 - T.inset;

/** A pierced pot (olla perforata) at (x, y, z), `r` round, with a seedling or a clipped plant in it. */
function pot(out, x, y, z, r, lod, rnd, { plant = 'seedling', h = r * 1.6 } = {}) {
  const seg = lod === 2 ? 6 : lod ? 9 : 14;
  out.clay.push(revolve(profileOf([[0, 0], [r * 0.7, 0], [r, h * 0.85], [r * 1.08, h * 0.92], [r * 1.05, h], [r * 0.9, h * 0.96], [0, h * 0.9]]), {
    segments: seg, metres: 0.3, tint: (p) => 0.75 + 0.25 * (p.y - y) / h,
  }).translate(x, y, z));
  if (lod === 0) {
    // Its holes: dark dots round its side.
    for (let k = 0; k < 3; k++) {
      const a = rnd() * Math.PI * 2;
      out.dark.push(tintGeometry(boxUV(new CylinderGeometry(0.012, 0.012, 0.01, 5, 1).rotateX(Math.PI / 2).rotateY(a).translate(x + Math.sin(a) * r * 0.86, y + h * 0.5, z + Math.cos(a) * r * 0.86))));
    }
  }
  const top = y + h * 0.9;
  if (plant === 'seedling') {
    for (let k = 0; k < (lod ? 1 : 3); k++) {
      const g = new ConeGeometry(r * 0.5, r * 1.4, lod ? 4 : 6, 1);
      g.translate(x + (rnd() - 0.5) * r * 0.6, top + r * 0.7, z + (rnd() - 0.5) * r * 0.6);
      out.leaf.push(tintGeometry(boxUV(g), () => lin(rnd() < 0.5 ? 0x5a8a34 : 0x4a7a2c)));
    }
  } else if (plant === 'cone' || plant === 'ball') {
    const g = plant === 'cone' ? new ConeGeometry(r * 1.3, r * 4.2, lod === 2 ? 6 : lod ? 10 : 16, lod ? 2 : 6) : new SphereGeometry(r * 1.45, lod === 2 ? 6 : lod ? 10 : 16, lod === 2 ? 5 : lod ? 8 : 12);
    g.translate(x, top + (plant === 'cone' ? r * 2.1 : r * 1.3), z);
    out.box.push(tintGeometry(boxUV(g), (px, py) => 0.75 + 0.25 * Math.min(1, (py - top) / (r * 3))));
  }
}

/** A long-handled tool leaning from its foot (x, z) up to `lean` toward -z: a hoe's or a rake's head at its foot. */
function tool(out, x, z, kind, lod, ry = 0) {
  const top = [x + Math.sin(ry) * 0.05, 1.38, z - 0.32];
  out.wood.push(...[staff([x, 0.06, z], top, 0.016, lod ? 4 : 6)]);
  if (kind === 'hoe') {
    // The ligo: a broad iron blade at right angles to the handle.
    out.iron.push(tintGeometry(boxUV(new BoxGeometry(0.18, 0.14, 0.012).rotateX(-0.35).translate(x, 0.1, z + 0.06))));
  } else if (lod < 2) {
    // The rastrum: a bar of iron teeth.
    out.iron.push(tintGeometry(boxUV(new BoxGeometry(0.3, 0.03, 0.03).translate(x, 0.08, z + 0.02))));
    for (let k = 0; k < (lod ? 3 : 6); k++) out.iron.push(tintGeometry(boxUV(new BoxGeometry(0.012, 0.08, 0.012).translate(x - 0.13 + k * (0.26 / ((lod ? 3 : 6) - 1)), 0.04, z + 0.05))));
  }
}

/** The shed at the back: rubble walls, a front of daub with its door, a lean-to of tiles. */
function shed(out, lod, seed) {
  const x0 = -1.7;
  const x1 = 0.75;
  const z0 = -E;
  const z1 = -0.62;
  const t = 0.22;
  out.wall.push(...wallRun('x', x0, x1, z0 + t / 2, t, 0, 2.15, [], seed, lod));
  for (const x of [x0 + t / 2, x1 - t / 2]) out.wall.push(...wallRun('z', z0 + t, z1, x, t, 0, 1.95, [], seed + 9, lod));
  // The front: plastered wattle and daub, the door's opening.
  const door = { a: -0.4, b: 0.36, lo: 0, hi: 1.62 };
  out.daub.push(...wallRun('x', x0 + t, x1 - t, z1 - 0.06, 0.12, 0, 1.78, [door], seed + 20, lod));
  out.dark.push(tintGeometry(boxUV(new BoxGeometry(door.b - door.a, door.hi, 0.02).translate((door.a + door.b) / 2, door.hi / 2, z1 - 0.2)), () => 1));
  // The lean-to over it all, from the back wall down to the front.
  const roof = leanTo({ L: x1 - x0 + 0.3, span: z1 - z0 + 0.05, topY: 2.15, eaveY: 1.78, lod, seed: seed + 3, over: 0.3 });
  for (const g of [...roof.tile, ...roof.wood]) g.translate((x0 + x1) / 2, 0, z0);
  out.tile.push(...roof.tile);
  out.wood.push(...roof.wood);
  // The door's leaf: shut in its opening, or swung back inside.
  for (const open of [false, true]) {
    const leaf = blk(lod, door.b - door.a - 0.04, door.hi - 0.04, 0.05, { bevel: 0.01, seed: seed + 30, wobble: 0.002, grime: 0.3, seg: 1 });
    leaf.translate(0, 0.02, 0);
    if (open) leaf.translate(-(door.b - door.a) / 2, 0, 0).rotateY(-1.5).translate(door.a + 0.02, 0, z1 - 0.12);
    else leaf.translate((door.a + door.b) / 2, 0, z1 - 0.06);
    (open ? out.doorOpen : out.doorShut).push(leaf);
  }
  // The falx hung on the front by the door: a hooked blade on a short handle.
  if (lod < 2) {
    out.wood.push(staff([0.52, 1.15, z1 + 0.02], [0.52, 1.42, z1 + 0.02], 0.014, 5));
    const hook = new CylinderGeometry(0.07, 0.07, 0.012, 10, 1, true, 0, Math.PI * 1.1);
    hook.rotateX(Math.PI / 2);
    hook.translate(0.5, 1.48, z1 + 0.025);
    out.iron.push(tintGeometry(boxUV(hook)));
  }
}

/** Build the gardeners' yard: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildYard({ lod = 0, seed = 311 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const rnd = artRng(seed);
  const keys = ['soil', 'gravel', 'wall', 'daub', 'cap', 'tile', 'wood', 'iron', 'clay', 'dark', 'leaf', 'box', 'compost', 'wicker', 'gateOpen', 'gateShut', 'doorOpen', 'doorShut', 'toolsOut', 'toolsIn'];
  const out = Object.fromEntries(keys.map((k) => [k, []]));
  // The ground: worked loam, a gravel path from the gate to the shed.
  out.soil.push(slab(3.98, 0.03, 3.98, { bevel: 0.01, seed, wobble: 0, tone: 0, grime: 0 }));
  out.gravel.push(slab(0.76, 0.045, 2.6, { bevel: 0.01, seed: seed + 1, wobble: 0, tone: 0, grime: 0 }).translate(0, 0, 0.66));
  // The wall round the yard: the sides and the front with its gate; a coping of flat stones.
  const t = 0.24;
  const [g0, g1] = T.gate;
  const runs = [['z', -0.62, E, -E + t / 2], ['z', -E, E, E - t / 2], ['x', -E + t, g0 - 0.12, E - t / 2], ['x', g1 + 0.12, E - t, E - t / 2], ['x', 0.75, E - t, -E + t / 2]];
  for (const [axis, a, b, at] of runs) {
    out.wall.push(...wallRun(axis, a, b, at, t, 0, T.wallH, [], seed + a * 10, lod));
    if (lod < 2) {
      const len = b - a;
      const g = new BoxGeometry(axis === 'x' ? len : t + 0.06, 0.06, axis === 'x' ? t + 0.06 : len);
      g.translate(axis === 'x' ? (a + b) / 2 : at, T.wallH + 0.03, axis === 'x' ? at : (a + b) / 2);
      out.cap.push(tintGeometry(boxUV(g), () => 0.9));
    }
  }
  // The gate's piers, and its two leaves of boards: shut, or swung in.
  for (const s of [-1, 1]) out.cap.push(slab(0.26, 1.0, 0.28, { bevel: 0.015, seed: seed + 5 + s, wobble: 0.003, tone: 0.04, grime: 0.35 }).translate(s * (g1 + 0.0), 0, E - t / 2));
  const leafW = g1 - 0.13;
  for (const s of [-1, 1]) {
    for (const open of [false, true]) {
      const leaf = blk(lod, leafW, 0.8, 0.04, { bevel: 0.008, seed: seed + 40 + s, wobble: 0.002, grime: 0.3, seg: 1 });
      leaf.translate(-s * leafW / 2, 0.05, 0);
      leaf.rotateY(open ? -s * 1.45 : 0);
      leaf.translate(s * (g1 - 0.13), 0, E - t / 2);
      (open ? out.gateOpen : out.gateShut).push(leaf);
    }
  }
  shed(out, lod, seed + 50);
  // The potting bench along the right wall, pots on it and under it.
  const bx = 1.42;
  out.wood.push(blk(lod, 0.42, 0.05, 1.5, { bevel: 0.01, seed: seed + 60, wobble: 0.002, grime: 0, seg: 1 }).translate(bx, 0.76, 0.15));
  for (const [dx, dz] of [[-0.17, -0.65], [0.17, -0.65], [-0.17, 0.95], [0.17, 0.95]]) out.wood.push(blk(lod, 0.06, 0.76, 0.06, { bevel: 0.01, seed: seed + 61, wobble: 0.003, grime: 0.3, seg: 1 }).translate(bx + dx, 0, 0.15 + dz));
  const nPots = lod === 2 ? 3 : lod ? 5 : 8;
  for (let k = 0; k < nPots; k++) pot(out, bx + (k % 2 ? 0.1 : -0.1), 0.81, -0.5 + (k * 1.3) / nPots, 0.075, lod, rnd);
  if (lod < 2) for (let k = 0; k < 4; k++) pot(out, bx + (rnd() - 0.5) * 0.15, 0, -0.4 + k * 0.38, 0.09, lod, rnd, { plant: 'none' });
  // Box clipped to a cone and a ball in big pots, waiting to go out; the cone at the gardener's hand.
  pot(out, 0.72, 0.0, 0.55, 0.17, lod, rnd, { plant: 'cone', h: 0.32 });
  pot(out, -0.75, 0.0, -0.25, 0.16, lod, rnd, { plant: 'ball', h: 0.3 });
  // Seedlings in rows in the bed by the gate (left), straw between them.
  const rows = lod === 2 ? 2 : 4;
  for (let r = 0; r < rows; r++) {
    const z = 0.35 + r * (1.2 / rows);
    out.compost.push(tintGeometry(boxUV(new BoxGeometry(1.0, 0.05, 0.12).translate(-1.15, 0.03, z)), () => 0.9));
    if (lod < 2) {
      for (let k = 0; k < (lod ? 4 : 8); k++) {
        const g = new ConeGeometry(0.045, 0.12, lod ? 4 : 5, 1);
        g.translate(-1.58 + k * (0.86 / (lod ? 3 : 7)), 0.1, z + (rnd() - 0.5) * 0.03);
        out.leaf.push(tintGeometry(boxUV(g), () => lin(rnd() < 0.5 ? 0x5e8e36 : 0x4c7a2e)));
      }
    }
  }
  // The compost heap in its wattle bin, back right, baskets by it.
  const fence = wattleFence([[0.95, -0.85], [0.95, -1.7], [1.75, -1.7], [1.75, -0.85]], { h: 0.55, seed: seed + 70, lod });
  out.wicker.push(...fence.wicker);
  out.wood.push(...fence.wood);
  const hp = heap(lod ? 6 : 14, 0.32, 0.0, 0.16, [lin(0x3a2c1e), lin(0x4a3a24), lin(0x5a5028)], seed + 71, lod, 0.6);
  if (hp) out.compost.push(hp.translate(1.35, 0, -1.28));
  if (lod < 2) {
    const bk = basket(0.2, 0.26, 0.6, lod);
    out.wicker.push(bk.wicker.translate(0.5, 0, -0.35));
    if (bk.fill) out.compost.push(bk.fill.translate(0.5, 0, -0.35));
    // The watering jar by the bench: a narrow-necked jug of clay.
    out.clay.push(revolve(profileOf([[0, 0], [0.08, 0], [0.13, 0.12], [0.12, 0.24], [0.05, 0.32], [0.04, 0.4], [0.055, 0.42], [0, 0.41]]), { segments: lod ? 8 : 14, metres: 0.3 }).translate(1.05, 0, 1.0));
  }
  // The tools: against the shed's front while nobody works; the shears in the gardener's hands while one does.
  const toolsIn = { wood: [], iron: [] };
  tool(toolsIn, -1.0, -0.42, 'hoe', lod);
  tool(toolsIn, -0.75, -0.42, 'rake', lod);
  out.toolsIn.push(...toolsIn.wood);
  const toolsOut = { wood: [], iron: [] };
  tool(toolsOut, -1.0, -0.42, 'hoe', lod);
  out.toolsOut.push(...toolsOut.wood);
  const m = { ...ruralMaterials(), ...learningMaterials() };
  const p = new TaggedParts('gardener_yard');
  const small = { cast: lod === 0 };
  const hm = hortusMaterials();
  p.add('soil', hm.soil, out.soil, { cast: false });
  p.add('gravel', hm.gravel, out.gravel, { cast: false });
  p.add('wall', ruralMaterials().wall, out.wall);
  p.add('daub', hm.plaster, out.daub);
  p.add('cap', m.stone, out.cap);
  p.add('roof', m.tile, out.tile);
  p.add('wood', m.wood, [...out.wood]);
  p.add('iron', m.iron, out.iron, small);
  p.add('tool-iron', m.iron, toolsIn.iron, { when: 'shut', cast: false });
  p.add('tool-iron', m.iron, toolsOut.iron, { when: 'open', cast: false });
  p.add('pots', m.clay, out.clay);
  p.add('inside', ruralMaterials().dark, out.dark, { cast: false });
  p.add('seedlings', ruralMaterials().leaf, out.leaf, small);
  p.add('box', hm.box, out.box);
  p.add('compost', m.earth, out.compost, { cast: false });
  p.add('wicker', m.wicker, out.wicker);
  p.add('gates', m.wood, out.gateOpen, { when: 'open' });
  p.add('gates', m.wood, out.gateShut, { when: 'shut' });
  p.add('door', m.wood, out.doorOpen, { when: 'open' });
  p.add('door', m.wood, out.doorShut, { when: 'shut' });
  p.add('tools', m.wood, out.toolsIn, { when: 'shut', cast: lod === 0 });
  p.add('tools', m.wood, out.toolsOut, { when: 'open', cast: lod === 0 });
  if (lod < 2) {
    const [lx, ly, lz] = T.lamp;
    const l = lantern(lx, ly, lz, lod);
    p.add('lantern', m.bronze, l.bronze, small);
    p.add('lamp', lanternPane(), [l.pane], { when: 'open', cast: false });
    p.add('lamp', material('lantern-pane-out', { color: 0x8a6a48, roughness: 0.5, snow: 0 }), [l.pane.clone()], { when: 'shut', cast: false });
  }
  if (lod === 0) {
    // The gardener at work: clipping the cone with his shears, in a tunic of undyed wool.
    const list = person(m, { cloth: 0x8a7656, hair: 0x2a1e16, skin: 0x9a6c4c, arms: 'hold' }, 0.3, 0.02, 0.7, Math.PI * 0.42);
    people(p, m, 'gardener', list, 'open');
    const shears = [];
    for (const s of [-1, 1]) shears.push(tintGeometry(boxUV(new BoxGeometry(0.012, 0.012, 0.26).rotateY(s * 0.18).translate(0.55, 1.12, 0.68 + s * 0.012))));
    p.add('shears', m.iron, shears, { when: 'open', cast: false });
  }
  const yard = p.build();
  // Over the ground: a leaning handle's end or a sandal's sole a little under it only costs depth.
  for (const m of yard.meshes) {
    const P = m.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) if (P.getY(i) < 0) P.setY(i, 0);
  }
  return yard;
}
