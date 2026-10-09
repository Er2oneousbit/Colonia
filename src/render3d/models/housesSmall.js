/**
 * models/housesSmall.js
 * ----------------------------------------------------------------------------
 * The two poorest of the five 3D homes, each on one 4 m tile with four looks:
 *
 *   Hut      a poor one-room house of rubble or mud brick on a stone footing,
 *            thatched (or roofed with a few crude tiles), a plank door, a
 *            bench and a jar by it, a clay smoke pot on the ridge for the
 *            hearth's smoke (a cottage of the Latium and Campania countryside
 *            as the small excavated farms and the huts of Rome's Palatine
 *            show them).
 *   Cottage  a small plastered house with a tiled roof, a red dado, a window
 *            with its shutters, and a tiny walled yard with a fig on a
 *            trellis and a cistern head (puteal), as the modest houses of
 *            Pompeii and Cosa.
 *
 * Variants are picked by the building's id (houses.js): a wash, a roof form
 * (gable along or across the street, hipped, lean-to), shutters open or
 * shut, what stands in the yard. Their states: 'open' lived in (doors and
 * shutters open, people), 'shut' empty (everything closed).
 * ----------------------------------------------------------------------------
 */

import { box, cyl } from './castra.js';
import { lin } from './rural.js';
import { pot } from './healing.js';
import {
  Bag, WASH, WOODS, CLOTH, shell, windowTrim, doorLeaf, ridgeRoof, pentRoof, fig, slabBox, tri,
} from './houseKit.js';

/** The hut's measures (metres): the tests, the lab and the people read them. */
export const HUT = Object.freeze({
  x0: -1.3, x1: 1.3, z0: -1.3, z1: 0.7, h: 1.75, door: Object.freeze({ w: 0.8, h: 1.55 }),
  /** A door's middle (x) by variant. */
  doorX: Object.freeze([-0.55, 0.5, 0, -0.45]),
});

/** The cottage's measures. */
export const COTTAGE = Object.freeze({
  x0: -1.45, x1: 1.45, z0: -1.65, z1: 0.65, h: 2.35, door: Object.freeze({ w: 0.85, h: 1.8 }),
  doorX: Object.freeze([0.5, -0.45, 0.35, -0.5]),
  /** The yard's front wall (z), and the gate in it (x). */
  yardZ: 1.9, gateX: Object.freeze([0, 0.9, -0.9, 0.5]),
  /** The window (x, sill y, w, h) of the front, by variant. */
  window: Object.freeze([[-0.7, 1.1, 0.6, 0.7], [0.6, 1.1, 0.6, 0.7], [-0.75, 1.1, 0.6, 0.7], [0.55, 1.1, 0.6, 0.7]]),
});

/** The hut's looks: wall wash and material, roof form, what stands by the door. */
const HUT_LOOKS = [
  { wall: WASH.mud, key: 'plaster', roof: 'thatch-gable', extra: ['bench', 'jar', 'wood'] },
  { wall: WASH.lime, key: 'plaster', roof: 'tile-pent', extra: ['fence', 'basket'] },
  { wall: WASH.sand, key: 'plaster', roof: 'thatch-hip', extra: ['jar', 'jar2', 'stool'] },
  { wall: 0x9a8f7c, key: 'rubble', roof: 'tile-gable-z', extra: ['jar', 'fence'] },
];

/** A footing of fieldstone round a wall: a course a little proud of it. */
function footing(bag, { x0, x1, z0, z1 }, h = 0.34) {
  const p = 0.05;
  const c = lin(0x9a9284, 0.9);
  bag.add('rubble', box(x1 - x0 + 2 * p, h, z1 - z0 + 2 * p, (x0 + x1) / 2, 0, (z0 + z1) / 2, c));
}

/** A jar by a door: an amphora or a big storage jar, leaning on the wall. */
function jarAt(bag, x, z, s = 0.62, tone = 0.95) {
  // (Far out a jar is a few facets: a revolved amphora costs a hundred triangles.)
  bag.add('clay', bag.lod === 2 ? cyl(s * 0.2, s * 0.14, s, 5, x, 0.02, z, lin(0xb8683f, tone)) : pot('amph', x, 0.02, z, s, bag.lod, tone));
}

/** A hut, its look `v` (0 to 3), at a level of detail. */
export function buildHut(v = 0, lod = 0) {
  const L = HUT_LOOKS[v & 3];
  const bag = new Bag(`hut${v}`, lod, 801 + v * 13);
  const { x0, x1, z0, z1, h, door } = HUT;
  const dx = HUT.doorX[v & 3];
  const wash = lin(L.wall);
  // The dirt of the yard, trodden flat in front of the door.
  slabBox(bag, 'earth', -1.85, 1.85, z1 - 0.05, 1.9, 0.03, lin(0xa89574, 0.9));
  footing(bag, HUT);
  const cx = (x0 + x1) / 2;
  const puts = shell(bag, {
    x0, x1, z0, z1, h, t: 0.3, c: wash, k: L.key === 'rubble' ? 0.95 : 0.97, key: L.key,
    openings: { '+z': [{ x: dx - cx, y: 0, w: door.w, h: door.h }] },
  });
  const front = puts['+z'];
  // The doorway: a timber lintel and posts, the plank door swung in when lived in.
  bag.add('wood', front(box(door.w + 0.26, 0.14, 0.22, dx, door.h, 0.0, lin(WOODS.oak, 0.85))));
  if (lod < 2) for (const s of [-1, 1]) bag.add('wood', front(box(0.1, door.h, 0.12, dx + s * (door.w / 2 + 0.03), 0, 0.02, lin(WOODS.oak, 0.8))));
  doorLeaf(bag, front, { x: dx, w: door.w, h: door.h, col: lin(WOODS.oak, 0.95), open: true });
  // A slit of a window high in the right wall, shuttered: the hearth's smoke finds its way out under the roof.
  if (lod < 2) bag.add('dark', puts['+x'](box(0.5, 0.16, 0.01, 0.1, 1.35, 0.006)));
  const f = L.roof;
  const ridge = (kind, o) => ridgeRoof(bag, { x0, x1, z0, z1, eaveY: h, kind, fill: wash.map((c) => c * 0.95), ...o });
  let ridgeY;
  if (f === 'thatch-gable') ridgeY = ridge('thatch', { along: 'x', rise: 0.95, over: 0.3 }).ridgeY;
  else if (f === 'thatch-hip') ridgeY = ridge('thatch', { along: 'x', rise: 0.9, over: 0.3, hip: true }).ridgeY;
  else if (f === 'tile-gable-z') ridgeY = ridge('tile', { along: 'z', rise: 0.78, over: 0.28 }).ridgeY;
  else {
    // A lean-to of crude tiles, high at the back, falling to the street.
    pentRoof(bag, { x0, x1, zHigh: z0 - 0.1, zLow: z1 + 0.05, yHigh: h + 0.75, yLow: h + 0.05, over: 0.3 });
    // (The back wall and the side walls rise to meet its slope: a strip and two wedges of wall.)
    bag.add('plaster', box(x1 - x0, 0.72, 0.3, 0, h, z0 + 0.15, wash.map((c) => c * 0.97)));
    for (const s of [-1, 1]) bag.add('plaster', tri([s * x1, h, z1], [s * x1, h, z0], [s * x1, h + 0.72, z0], [s, 0, 0], wash));
    ridgeY = h + 0.75;
  }
  // The clay pot on the ridge, its neck cut: the smoke of the hearth leaves there.
  const sx = f === 'tile-gable-z' ? 0 : 0.5;
  const sz = f === 'tile-gable-z' ? -0.2 : (z0 + z1) / 2;
  if (lod < 2 && f !== 'tile-pent') bag.add('clay', pot('jar', sx, ridgeY - 0.02, sz, 0.34, lod, 0.7));
  // By the door.
  const side = dx < 0 ? 1 : -1; // the side the door leaves free
  for (const e of L.extra) {
    if (e === 'bench') {
      bag.add('wood', box(0.9, 0.06, 0.32, side * 0.7, 0.4, z1 + 0.22, lin(WOODS.oak, 0.85)));
      if (lod < 2) for (const s of [-1, 1]) bag.add('wood', box(0.06, 0.4, 0.28, side * 0.7 + s * 0.36, 0, z1 + 0.22, lin(WOODS.oak, 0.75)));
    } else if (e === 'jar') jarAt(bag, side * 1.25, z1 + 0.35);
    else if (e === 'jar2') jarAt(bag, -side * 1.3, z1 + 0.3, 0.5, 0.85);
    else if (e === 'stool') bag.add('wood', cyl(0.2, 0.2, 0.35, 8, side * 0.7, 0, z1 + 0.5, lin(WOODS.oak, 0.85)));
    else if (e === 'wood') {
      for (let k = 0; k < (lod ? 2 : 4); k++) bag.add('wood', cyl(0.07, 0.07, 0.8, 5, -side * 1.3, 0.07 + (k % 2) * 0.13, z1 - 0.1 - Math.floor(k / 2) * 0.15, lin(0x6a5238, 0.9)));
    } else if (e === 'basket') bag.add('clay', cyl(0.24, 0.18, 0.28, 8, side * 1.15, 0, z1 + 0.4, lin(0xb08850)));
    else if (e === 'fence') {
      // A hurdle of woven withies along the yard's edge with a gap.
      const zf = 1.75;
      for (const [a, b] of [[-1.85, side * 0.2 - 0.5], [side * 0.2 + 0.5, 1.85]]) {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        if (hi - lo < 0.3) continue;
        bag.add('wood', box(hi - lo, 0.62, 0.04, (lo + hi) / 2, 0.02, zf, lin(0x8a7048, 0.9)));
        if (lod < 2) for (let x = lo; x <= hi + 1e-6; x += 0.6) bag.add('wood', box(0.05, 0.85, 0.05, x, 0, zf, lin(WOODS.oak, 0.8)));
      }
    }
  }
  return Object.assign(bag.build(), { doorX: dx });
}

/** The cottage's looks: the wash, the dado, the roof, the shutters, what grows in the yard. */
const COTTAGE_LOOKS = [
  { wall: WASH.cream, dado: WASH.red, roof: 'gable-x', shut: WOODS.olive, shutters: 'open', yard: ['fig-left', 'puteal-right'] },
  { wall: WASH.ochre, dado: null, roof: 'gable-z', shut: WOODS.oak, shutters: 'closed', yard: ['trellis-side', 'puteal-left'] },
  { wall: WASH.white, dado: WASH.red, roof: 'hip', shut: WOODS.brown, shutters: 'open', yard: ['arbor', 'jar'] },
  { wall: WASH.pink, dado: null, roof: 'gable-x', shut: WOODS.olive, shutters: 'open', yard: ['shed', 'fig-left', 'bench'] },
];

/** A cottage, its look `v` (0 to 3), at a level of detail. */
export function buildCottage(v = 0, lod = 0) {
  const L = COTTAGE_LOOKS[v & 3];
  const bag = new Bag(`cottage${v}`, lod, 851 + v * 17);
  const { x0, x1, z0, z1, h, door } = COTTAGE;
  const dx = COTTAGE.doorX[v & 3];
  const [wx, wy, ww, wh] = COTTAGE.window[v & 3];
  const wash = lin(L.wall);
  const cx = (x0 + x1) / 2;
  // The yard: beaten earth between its low walls.
  slabBox(bag, 'earth', -1.9, 1.9, z1 - 0.05, COTTAGE.yardZ, 0.03, lin(0xa89574, 0.92));
  footing(bag, COTTAGE, 0.22);
  const puts = shell(bag, {
    x0, x1, z0, z1, h, t: 0.3, c: wash, k: 0.97,
    openings: {
      '+z': [{ x: dx - cx, y: 0, w: door.w, h: door.h }, { x: wx - cx, y: wy, w: ww, h: wh }],
      '+x': [{ x: 0.2, y: wy, w: 0.5, h: 0.6 }],
      '-x': [{ x: -0.2, y: wy, w: 0.5, h: 0.6 }],
    },
  });
  const front = puts['+z'];
  const col = lin(L.shut);
  windowTrim(bag, front, { x: wx - cx, y: wy, w: ww, h: wh }, { shutters: L.shutters, col });
  windowTrim(bag, puts['+x'], { x: 0.2, y: wy, w: 0.5, h: 0.6 }, { shutters: 'closed', col, sill: false });
  windowTrim(bag, puts['-x'], { x: -0.2, y: wy, w: 0.5, h: 0.6 }, { shutters: 'closed', col, sill: false });
  // The door in stone, its leaf swung in when lived in.
  bag.add('stone', front(box(door.w + 0.4, 0.14, 0.16, dx - cx, door.h, 0.06, 0.95)));
  if (lod < 2) for (const s of [-1, 1]) bag.add('stone', front(box(0.14, door.h + 0.1, 0.16, dx - cx + s * (door.w / 2 + 0.05), 0, 0.06, 0.95)));
  doorLeaf(bag, front, { x: dx - cx, w: door.w, h: door.h, col: lin(WOODS.oak), open: true });
  // The dado: a band of red to a metre, round the front and the sides.
  if (L.dado && lod < 2) {
    const c = lin(L.dado);
    bag.add('plaster', front(box(x1 - x0 - 0.1, 0.9, 0.014, 0, 0.35, 0.007, c)));
  }
  // The roof.
  const over = L.roof === 'hip' ? 0.3 : 0.28;
  const roof = { x0, x1, z0, z1, eaveY: h, over, fill: wash.map((c) => c * 0.96) };
  if (L.roof === 'gable-x') ridgeRoof(bag, { ...roof, along: 'x', rise: 0.82 });
  else if (L.roof === 'gable-z') ridgeRoof(bag, { ...roof, along: 'z', rise: 0.8, over: 0.2 });
  else ridgeRoof(bag, { ...roof, along: 'x', rise: 0.8, hip: true });
  // The yard's low walls: plastered, capped with tile, with a gate.
  const wallC = lin(WASH.lime, 0.95);
  const yz = COTTAGE.yardZ;
  const gx = COTTAGE.gateX[v & 3];
  const lowWall = (a0, a1, b0, b1) => {
    slabBox(bag, 'plaster', a0, a1, b0, b1, 0.62, wallC);
    if (lod < 2) bag.add('tile', box(a1 - a0 + 0.04, 0.05, b1 - b0 + 0.06, (a0 + a1) / 2, 0.62, (b0 + b1) / 2, lin(0xb8603c, 0.9)));
  };
  lowWall(-1.9, gx - 0.45, yz - 0.12, yz);
  lowWall(gx + 0.45, 1.9, yz - 0.12, yz);
  if (lod < 2) {
    lowWall(-1.9, -1.78, z1, yz - 0.12);
    lowWall(1.78, 1.9, z1, yz - 0.12);
  }
  // The gate posts.
  if (lod < 2) for (const s of [-1, 1]) bag.add('stone', box(0.2, 0.85, 0.2, gx + s * 0.5, 0, yz - 0.06, 0.95));
  // What grows and stands in the yard.
  for (const e of L.yard) {
    if (e === 'fig-left') fig(bag, -1.25, z1 + 0.7, 0.55, 5 + v);
    else if (e === 'puteal-right' || e === 'puteal-left') {
      const px = e.endsWith('right') ? 1.25 : -1.2;
      bag.add('stone', cyl(0.32, 0.34, 0.55, lod ? 8 : 14, px, 0, z1 + 0.75, 0.97));
      if (lod < 2) {
        bag.add('dark', cyl(0.22, 0.22, 0.01, lod ? 8 : 12, px, 0.56, z1 + 0.75, 1));
        // The windlass's frame over the well head: two posts and a bar.
        for (const s of [-1, 1]) bag.add('wood', box(0.06, 0.85, 0.06, px + s * 0.3, 0.55, z1 + 0.75, lin(WOODS.oak, 0.8)));
        bag.add('wood', box(0.72, 0.07, 0.07, px, 1.34, z1 + 0.75, lin(WOODS.oak, 0.8)));
      }
    } else if (e === 'trellis-side') {
      // A vine on a trellis along the right-hand wall.
      for (let k = 0; k < 4; k++) bag.add('wood', box(0.05, 1.7, 0.05, 1.7, 0, z1 + 0.15 + k * 0.28, lin(WOODS.oak, 0.8)));
      bag.add('wood', box(0.05, 0.05, 1.0, 1.7, 1.65, z1 + 0.5, lin(WOODS.oak, 0.8)), box(0.05, 0.05, 1.0, 1.7, 0.8, z1 + 0.5, lin(WOODS.oak, 0.8)));
      bag.add('leaf', cyl(0.02, 0.32, 1.5, 6, 1.7, 0.1, z1 + 0.4, [0.05, 0.12, 0.03]), cyl(0.02, 0.28, 1.2, 6, 1.7, 0.2, z1 + 0.75, [0.06, 0.11, 0.03]));
    } else if (e === 'arbor') {
      // An arbor over the path to the door: two pairs of posts, rafters, a vine.
      for (const s of [-1, 1]) for (const z of [z1 + 0.35, z1 + 1.1]) bag.add('wood', box(0.07, 2.0, 0.07, dx + s * 0.55, 0, z, lin(WOODS.oak, 0.8)));
      for (const z of [z1 + 0.35, z1 + 0.72, z1 + 1.1]) bag.add('wood', box(1.3, 0.06, 0.06, dx, 2.0, z, lin(WOODS.oak, 0.8)));
      bag.add('leaf', cyl(0.02, 0.5, 0.3, 6, dx, 2.05, z1 + 0.72, [0.05, 0.12, 0.035]));
    } else if (e === 'jar') jarAt(bag, -1.3, z1 + 0.5, 0.8);
    else if (e === 'bench') bag.add('wood', box(0.9, 0.06, 0.3, 1.2, 0.42, z1 + 0.5, lin(WOODS.oak, 0.85)), box(0.06, 0.42, 0.26, 0.85, 0, z1 + 0.5, lin(WOODS.oak, 0.75)), box(0.06, 0.42, 0.26, 1.55, 0, z1 + 0.5, lin(WOODS.oak, 0.75)));
    else if (e === 'shed') {
      // A lean-to by the right wall: a woodpile under a slope of tiles.
      for (let k = 0; k < (lod ? 2 : 3); k++) bag.add('wood', cyl(0.08, 0.08, 0.9, 5, 1.45, 0.08 + k * 0.15, z1 - 0.35 + (k % 2) * 0.1, lin(0x6a5238, 0.9)).rotateY(Math.PI / 2));
    }
  }
  return Object.assign(bag.build(), { doorX: dx });
}

/** Lit windows by variant: [x, y, z] of a front window's middle, for models.js modelLamps. */
export const COTTAGE_LAMPS = Object.freeze(COTTAGE.window.map(([x, y, w, h]) => Object.freeze([x, y + h / 2, COTTAGE.z1 + 0.05, 1])));
/** The hut has no window to light: its door glows (a hearth's fire inside). */
export const HUT_LAMPS = Object.freeze(HUT.doorX.map((x) => Object.freeze([x, 0.9, HUT.z1 + 0.04, 1])));

export { CLOTH };
