/**
 * models/granary.js
 * ----------------------------------------------------------------------------
 * The public granary (horreum frumentarium) of the 3D look, fitted to the
 * game's 3 x 3 footprint (12 m square), from what survives of Roman
 * granaries rather than from the 2D sprite:
 *
 *   - Ostia's horrea (the Grandi Horrea, the Horrea Epagathiana et
 *     Epaphroditiana) and Rome's Horrea Galbana: rows of deep store rooms
 *     (cellae) of brick-banded concrete behind a portico, thick walls, few
 *     and narrow openings; the Grandi Horrea's floors raised on low walls
 *     with vents under them so the grain kept dry.
 *   - The military granaries of the frontier forts (Corbridge, Housesteads,
 *     Saalburg): a raised floor with vents in the wall under it, buttresses
 *     along the walls against the grain's thrust, louvred slits high up for
 *     air, and loading platforms at the doors at the height of a cart's bed,
 *     so sacks went from the cart straight in, under a porch on posts.
 *
 * So, in 12 m: a raised platform of limestone (cart high: 0.8 m) with vents
 * along its face; on it a square store of rubble with bands of brick every
 * metre or so (opus mixtum), buttresses and dressed quoins, a door in the
 * middle of each side under a little tiled hood on brackets, narrow vent
 * slits up under the eaves, a tiled gable roof; round the store the open
 * loading platform, where the goods wait to go in or out, steps up in the
 * middle of each side. (A portico of posts and lean-to roofs round it was
 * tried first: from the game's camera its roofs hid the goods under them.)
 *
 * How full it is shows on the platform: STOCK_SLOTS places for a cart's
 * load each (a twentieth of the granary), filled in turn round all four
 * sides (granaryStock), so whichever way the view is turned the two sides
 * it shows hold their share; each food in its own way (buildStockSlot):
 * sacks of wheat, baskets of vegetables and of fruit, hams hanging on a
 * rack beside salting tubs, baskets of fish beside amphorae. Empty, the
 * platform is bare.
 *
 * States: worked (doors open, the lantern at the front door lit at night in
 * the lab; in the game the night's light map draws its glow, models.js
 * modelLamps), idle (doors shut, the lantern out).
 *
 * Metres, the footprint's middle at the origin, y up; the front (+z) has
 * the lantern.
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, IcosahedronGeometry, PointLight, Vector3, Matrix4, Quaternion } from 'three';
import { revolve, profileOf, boxUV, tintGeometry, merge } from '../shapes.js';
import { material } from '../materials.js';
import { artRng, smoothstep } from '../texgen.js';
import {
  Parts, blk, beam, post, wallRun, gableRoof, leanTo, sack, sackLying, basket, heap, jar, lin, paint, D, doorLeaf,
} from './rural.js';

/** The granary's measures (metres): the tests, the lab and the game read them. */
export const GRANARY = Object.freeze({
  half: 5.1, // the platform's half side (its steps reach out to the footprint's edge)
  floorY: 0.8, // the platform's top: a cart's bed
  core: 3.2, // the store's half side (outer face): a 6.4 m store, leaving the platform room for the goods
  wall: 0.6,
  eaveY: 5.3,
  /** The lantern by the front door (x, y, z). */
  lamp: Object.freeze([1.62, 3.0, 3.35]),
});

/** The foods a granary keeps (data/goods.js FOOD_TYPES), in the order they fill the portico. */
export const GRANARY_FOODS = Object.freeze(['wheat', 'vegetables', 'fruit', 'meat', 'fish']);

/**
 * The portico's places for goods: 20, each a cart's load of the granary's
 * 2400 (config.js GRANARY_CAPACITY), as [x, z, yaw]: four along each side,
 * one in each corner. In the order they fill: round the four sides in turn,
 * nearest the doors first, the corners last.
 */
export const STOCK_SLOTS = (() => {
  const C = 4.15; // the platform's middle, out from the store's wall
  const along = [1.6, -1.6, 3.05, -3.05];
  const sides = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // +z, +x, -z, -x: the yaw turns the slot's front (+z) outward
  const out = [];
  for (const a of along) {
    sides.forEach(([sx, sz]) => {
      const yaw = Math.atan2(sx, sz);
      out.push(Object.freeze([sz ? a : sx * C, sx ? -a * sx : sz * C, yaw]));
    });
  }
  for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) out.push(Object.freeze([sx * C, sz * C, Math.atan2(sx, sz)]));
  return Object.freeze(out);
})();

/**
 * How many of the portico's places each food fills: in proportion to what
 * the granary holds of it against its capacity (a place is a twentieth),
 * whole places by the largest remainders, so the places filled are the
 * whole store's share rounded, and a food with any stock shows at least one
 * place while there is room. Returns [{ food, n }] in GRANARY_FOODS order.
 */
export function granaryStock(stock, capacity) {
  const N = STOCK_SLOTS.length;
  const amounts = GRANARY_FOODS.map((f) => Math.max(0, (stock && stock[f]) || 0));
  const used = amounts.reduce((a, b) => a + b, 0);
  const total = Math.min(N, Math.round((used / capacity) * N));
  const exact = amounts.map((a) => (used > 0 ? (a / used) * total : 0));
  const n = exact.map(Math.floor);
  let left = total - n.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    n[i]++;
    left--;
  }
  // A food the granary holds shows, if there is a place for it to take from the most plentiful.
  for (let i = 0; i < n.length; i++) {
    if (amounts[i] > 0 && n[i] === 0 && total > 0) {
      const big = n.indexOf(Math.max(...n));
      if (n[big] > 1) {
        n[big]--;
        n[i]++;
      }
    }
  }
  return GRANARY_FOODS.map((food, i) => ({ food, n: n[i] }));
}

/** The granary's building (no stock): `idle` with no workers, its doors shut. Returns { group, meshes, triangles, lamp, pane }. */
export function buildGranary({ lod = 0, idle = false, seed = 5 } = {}) {
  const G = GRANARY;
  const p = new Parts();
  const rnd = artRng(seed);
  const H = G.half;
  const F = G.floorY;
  // The platform: a facing of limestone blocks in two courses round a core, vents under its lip.
  const face = [];
  const vents = [];
  if (lod < 2) {
    for (const [ax, sgn] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
      for (let c = 0; c < 2; c++) {
        let a = -H + (c ? 0.35 : 0);
        while (a < H - 0.05) {
          const b = Math.min(H, a + 0.8 + rnd() * 0.5);
          // (Where a vent opens, leave its slot: the stones either side and a lintel.)
          const h = c ? F - 0.4 : 0.4;
          const y = c ? 0.4 : 0;
          const w = b - a - 0.012;
          const g = blk(lod, ax === 'x' ? w : 0.3, h, ax === 'x' ? 0.3 : w, { bevel: 0.025, seed: seed * 50 + face.length, wobble: 0.006, grime: c ? 0.1 : 0.55, seg: 1, tone: 0.08 });
          const m = (a + b) / 2;
          if (ax === 'x') g.translate(m, y, sgn * (H - 0.15)); else g.translate(sgn * (H - 0.15), y, m);
          face.push(g);
          a = b;
        }
      }
    }
    // Vents: dark slots under the lip, three each side of the steps.
    for (const [sx, sz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      for (const a of [-4.2, -2.6, 2.6, 4.2]) {
        const g = new BoxGeometry(sz ? 0.42 : 0.04, 0.16, sz ? 0.04 : 0.42);
        g.translate(sz ? a : sx * (H + 0.005), 0.5, sx ? a : sz * (H + 0.005));
        boxUV(g);
        vents.push(tintGeometry(g));
      }
    }
  } else {
    face.push(blk(2, 2 * H, F, 2 * H, { seed, grime: 0.5 }));
  }
  p.add('stone', face).add('dark', vents);
  // The platform's top: a floor of big slabs (one slab far out).
  const top = new BoxGeometry(2 * H - 0.02, 0.06, 2 * H - 0.02);
  top.translate(0, F - 0.03, 0);
  boxUV(top);
  p.add('stone', tintGeometry(top, () => 0.93));
  if (lod < 2) p.add('wall', blk(1, 2 * H - 0.6, F - 0.05, 2 * H - 0.6, { seed: 2, grime: 0 }));
  // Steps up in the middle of each side, cut into the platform's edge.
  for (const [sx, sz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    for (let s = 0; s < 3; s++) {
      const depth = 0.28 * (3 - s);
      const g = blk(lod, sz ? 1.5 : depth, F * ((s + 1) / 3), sz ? depth : 1.5, { bevel: 0.02, seed: seed + 70 + s, wobble: 0.004, grime: 0.4, seg: 1 });
      g.translate(sx * (H + depth / 2 - 0.02), 0, sz * (H + depth / 2 - 0.02));
      p.add('stone', g);
    }
  }
  // The store: thick rubble walls round four doors, slits high up, bands of brick, buttresses, quoins.
  const C = G.core;
  const T = G.wall;
  const E = G.eaveY;
  const doorW = 1.6;
  const doorH = 2.6;
  const slits = (a) => [-2.4, -0.98, 0.98, 2.4].map((x) => ({ a: a + x - 0.11, b: a + x + 0.11, lo: 4.15, hi: 5.05 }));
  const door = { a: -doorW / 2, b: doorW / 2, lo: F, hi: F + doorH };
  p.add('wall', wallRun('x', -C, C, C - T / 2, T, F, E, [door, ...slits(0)], seed + 100, lod));
  p.add('wall', wallRun('x', -C, C, -C + T / 2, T, F, E, [door, ...slits(0)], seed + 200, lod));
  p.add('wall', wallRun('z', -C + T, C - T, C - T / 2, T, F, E, [door, ...slits(0)].map((o) => ({ ...o, a: Math.max(-C + T, o.a), b: Math.min(C - T, o.b) })), seed + 300, lod));
  p.add('wall', wallRun('z', -C + T, C - T, -C + T / 2, T, F, E, [door, ...slits(0)].map((o) => ({ ...o, a: Math.max(-C + T, o.a), b: Math.min(C - T, o.b) })), seed + 400, lod));
  // The gables over the ends (the ridge runs along x).
  const rise = C * Math.tan(D(22));
  for (const e of [-1, 1]) {
    const g = new BoxGeometry(2 * C, rise, T, 2, 1, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) > 0 ? rise * (1 - Math.abs(pos.getX(i)) / C) : 0);
    g.computeVertexNormals();
    g.rotateY(Math.PI / 2);
    g.translate(e * (C - T / 2), E, 0);
    boxUV(g);
    p.add('wall', tintGeometry(g));
  }
  // The dark inside, seen through the doors and slits.
  p.add('dark', blk(1, 2 * (C - T) + 0.04, E - F - 0.1, 2 * (C - T) + 0.04, { seed: 1, grime: 0 }).translate(0, F, 0));
  if (lod < 2) {
    // Bonding courses of brick every metre or so, a little proud of the rubble.
    const brick = [];
    for (let y = F + 1.05; y < E - 0.3; y += 1.15) {
      for (const [ax, s] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
        const runs = [[-C - 0.01, -doorW / 2 - 0.02], [doorW / 2 + 0.02, C + 0.01]];
        for (const [a, b] of (y > F + doorH + 0.1 ? [[-C - 0.01, C + 0.01]] : runs)) {
          const g = blk(1, ax === 'x' ? b - a : 0.04, 0.13, ax === 'x' ? 0.04 : b - a, { seed: 3, grime: 0 });
          if (ax === 'x') g.translate((a + b) / 2, y, s * (C + 0.005)); else g.translate(s * (C + 0.005), y, (a + b) / 2);
          brick.push(g);
        }
      }
    }
    p.add('clay', brick);
    // Buttresses against the grain's push, between the slits; quoins at the corners.
    const stone = [];
    for (const [sx, sz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      for (const a of [-1.7, 1.7]) {
        const g = blk(lod, sz ? 0.5 : 0.32, E - F - 0.15, sz ? 0.32 : 0.5, { bevel: 0.02, seed: seed + 500 + a * 3 + sx, wobble: 0.004, grime: 0.3, seg: 1 });
        // A buttress's face slopes back toward its top.
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const k = smoothstep(0, E - F, pos.getY(i)) * 0.14;
          if (sz) pos.setZ(i, pos.getZ(i) * (1 - k * 2.2)); else pos.setX(i, pos.getX(i) * (1 - k * 2.2));
        }
        g.computeVertexNormals();
        g.translate(sz ? a : sx * (C + 0.14), F, sx ? a : sz * (C + 0.14));
        stone.push(g);
      }
    }
    for (const [cx, cz] of [[C, C], [-C, C], [C, -C], [-C, -C]]) {
      for (let y = F, i = 0; y < E - 0.2; y += 0.42, i++) {
        const long = i % 2 === 0;
        const g = blk(lod, long ? 0.7 : 0.42, 0.4, long ? 0.42 : 0.7, { bevel: 0.02, seed: seed + 600 + i + cx * 5 + cz, wobble: 0.004, grime: 0.15, seg: 1, tone: 0.06 });
        g.translate(cx - Math.sign(cx) * ((long ? 0.7 : 0.42) / 2 - 0.02), y, cz - Math.sign(cz) * ((long ? 0.42 : 0.7) / 2 - 0.02));
        stone.push(g);
      }
    }
    p.add('stone', stone);
    // Louvres in the slits: three boards slanted down, keeping the rain out.
    if (lod === 0) {
      const wood = [];
      for (const [sx, sz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        for (const a of [-2.4, -0.98, 0.98, 2.4]) {
          for (let k = 0; k < 3; k++) {
            const g = new BoxGeometry(sz ? 0.22 : 0.3, 0.03, sz ? 0.3 : 0.22);
            g.rotateX(sz ? sz * 0.6 : 0);
            g.rotateZ(sx ? -sx * 0.6 : 0);
            g.translate(sz ? a : sx * (C - T / 2), 4.4 + k * 0.27, sx ? a : sz * (C - T / 2));
            boxUV(g);
            wood.push(tintGeometry(g, () => 0.7));
          }
        }
      }
      p.add('wood', wood);
    }
  }
  // Door frames: limestone jambs and a lintel; the leaves open against the jambs, or shut.
  for (const [sx, sz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const yaw = Math.atan2(sx, sz);
    const pieces = [];
    for (const s of [-1, 1]) pieces.push(blk(lod, 0.22, doorH, T + 0.06, { bevel: 0.02, seed: seed + 700 + s, wobble: 0.004, grime: 0.35, seg: 1 }).translate(s * (doorW / 2 + 0.11), F, -T / 2 + 0.03));
    pieces.push(blk(lod, doorW + 0.6, 0.3, T + 0.08, { bevel: 0.02, seed: seed + 703, wobble: 0.004, grime: 0, seg: 1 }).translate(0, F + doorH, -T / 2 + 0.03));
    for (const g of pieces) {
      g.rotateY(yaw);
      g.translate(sx * C, 0, sz * C);
      p.add('stone', g);
    }
    // Shut, the two leaves fill the doorway; open, they stand back inside it, in the dark.
    if (idle) {
      for (const s of [-1, 1]) {
        const lw = doorW / 2 - 0.02;
        const g = doorLeaf(lw, doorH - 0.05, seed + 710 + s, lod);
        g.translate(s * lw / 2, F, -T / 2);
        g.rotateY(yaw);
        g.translate(sx * C, 0, sz * C);
        p.add('wood', g);
      }
    }
  }
  // The roof: a tiled gable over the store, along x.
  const roof = gableRoof({ x0: -C, x1: C, z0: -C, z1: C, eaveY: E, pitch: D(22), along: 'x', lod, seed: seed + 800, over: 0.55, gableOver: 0.35 });
  p.add('tile', roof.tile).add('wood', roof.wood);
  // Over each door a hood: a short tiled lean-to on two timber brackets, keeping the rain off the
  // doorway while sacks go in (the platform itself is open, so the goods on it show from afar).
  for (const [sx, sz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const yaw = Math.atan2(sx, sz);
    const hood = leanTo({ L: doorW + 1.1, span: 1.0, topY: F + doorH + 0.75, eaveY: F + doorH + 0.35, lod, seed: seed + 960 + sx * 2 + sz, over: 0.15 });
    const wood = [...hood.wood];
    if (lod < 2) for (const s of [-1, 1]) wood.push(beam([s * (doorW / 2 + 0.4), F + doorH - 0.15, 0.02], [s * (doorW / 2 + 0.4), F + doorH + 0.38, 0.98], 0.09, seed + 970 + s, lod));
    for (const g of [...hood.tile, ...wood]) {
      g.rotateY(yaw);
      g.translate(sx * C, 0, sz * C);
    }
    p.add('tile', hood.tile).add('wood', wood);
  }
  // At the front door: the lantern on its bracket.
  let paneGeo = null;
  if (lod < 2) {
    const [lx, ly, lz] = G.lamp;
    const iron = [beam([lx, ly + 0.25, C + 0.02], [lx, ly + 0.25, lz], 0.025, 990, 1)];
    const bronze = [];
    const base = revolve(profileOf([[0, 0], [0.08, 0], [0.085, 0.03], [0.07, 0.05], [0, 0.05]]), { segments: 12, metres: 0.3 });
    const cap = revolve(profileOf([[0, 0.2], [0.085, 0.2], [0.05, 0.28], [0.015, 0.31], [0, 0.32]]), { segments: 12, metres: 0.3 });
    for (const g of [base, cap]) {
      g.translate(lx, ly - 0.08, lz);
      bronze.push(g);
    }
    paneGeo = new CylinderGeometry(0.072, 0.072, 0.15, 12, 1, true);
    paneGeo.translate(lx, ly - 0.08 + 0.125, lz);
    boxUV(paneGeo);
    paneGeo = tintGeometry(paneGeo);
    p.add('iron', iron).add('bronze', bronze);
  }
  // (A shut granary's lantern is out: its own glass, never lit.)
  const pane = material(idle ? 'granary-lantern-out' : 'granary-lantern', { color: 0xc89a5a, roughness: 0.45, emissive: 0xffb25c, emissiveIntensity: 0, snow: 0 });
  if (paneGeo) p.add('pane', paneGeo);
  const out = p.build(idle ? 'granary-idle' : 'granary', {
    extra: { bronze: material('bronze', { surface: 'bronze', vertexColors: true, snow: 0.7 }), pane },
    noShadow: ['pane'],
  });
  out.pane = pane;
  out.lampAt = new Vector3(...G.lamp);
  return out;
}

/** Hams hanging from a rack, and salting tubs: the meat's place. */
function meatSlot(p, lod, seed) {
  const rnd = artRng(seed);
  for (const s of [-1, 1]) {
    p.add('wood', beam([s * 0.5, 0, -0.35], [s * 0.5, 1.25, -0.2], 0.05, seed + s, lod));
    p.add('wood', beam([s * 0.5, 0, -0.05], [s * 0.5, 1.25, -0.2], 0.05, seed + s + 4, lod));
  }
  p.add('wood', beam([-0.6, 1.22, -0.2], [0.6, 1.22, -0.2], 0.05, seed + 9, lod));
  const n = lod === 2 ? 2 : 4;
  for (let k = 0; k < n; k++) {
    const x = -0.36 + (k * 0.72) / (n - 1);
    const ham = revolve(profileOf([[0, 0], [0.07, 0.04], [0.13, 0.18], [0.12, 0.3], [0.06, 0.4], [0.025, 0.46], [0, 0.48]]), { segments: lod === 0 ? 12 : 6, metres: 0.4 });
    ham.scale(1, 1, 0.7);
    ham.translate(x, 0.62 + rnd() * 0.05, -0.2);
    p.add('produce', paint(ham, lin(rnd() < 0.5 ? 0x8a4a34 : 0x7a3e2c), (xx, y) => 0.75 + 0.3 * smoothstep(0.6, 1.1, y)));
    if (lod < 2) p.add('rope', beam([x, 1.1, -0.2], [x, 1.22, -0.2], 0.01, seed + 20 + k, 1));
  }
  for (const [x, z] of [[-0.32, 0.4], [0.32, 0.42]]) {
    const tub = revolve(profileOf([[0, 0], [0.26, 0], [0.3, 0.42], [0.27, 0.44], [0.24, 0.05], [0, 0.05]]), { segments: lod === 0 ? 16 : 8, metres: 0.6, tint: (pp) => (Math.hypot(pp.x, pp.z) < 0.25 && pp.y > 0.03 ? 0.45 : 1) });
    tub.translate(x, 0, z);
    p.add('wood', tub);
    if (lod < 2) {
      const salt = new CylinderGeometry(0.255, 0.255, 0.02, lod === 0 ? 14 : 8, 1);
      salt.translate(x, 0.38, z);
      boxUV(salt);
      p.add('produce', paint(salt, lin(0xd8d2c4)));
    }
  }
}

/** Baskets of fish, and amphorae of salted fish: the fish's place. */
function fishSlot(p, lod, seed) {
  const rnd = artRng(seed);
  for (const [x, z] of [[-0.3, 0.25], [0.3, 0.3], [0.0, -0.2]]) {
    const b = basket(0.27, 0.24, 1, lod);
    b.wicker.translate(x, 0, z);
    p.add('wicker', b.wicker);
    if (lod < 2) {
      const fish = [];
      for (let f = 0; f < (lod === 0 ? 7 : 3); f++) {
        const g = new IcosahedronGeometry(0.06, 0);
        g.scale(2.2, 0.45, 0.7);
        g.rotateY(rnd() * 3.14);
        g.translate(x + (rnd() - 0.5) * 0.28, 0.26 + rnd() * 0.05, z + (rnd() - 0.5) * 0.28);
        fish.push(paint(g, lin(rnd() < 0.6 ? 0x9eb0b8 : 0x7a8a92), (xx, y) => 0.8 + 0.3 * smoothstep(0.24, 0.3, y)));
      }
      p.add('produce', merge(fish));
    } else if (b.fill) {
      p.add('produce', paint(b.fill.translate(x, 0, z), lin(0x9eb0b8)));
    }
  }
  for (const [k, x, z, lean] of [[0, -0.45, -0.45, 0.15], [1, 0.45, -0.45, -0.15]]) {
    const a = jar({ amphora: true, lod, seed: seed + 40 + k });
    a.rotateZ(lean);
    a.translate(x, 0, z);
    p.add('clay', a);
  }
}

/** Baskets of vegetables or fruit, and a crate: their place. `fruit` picks the colours. */
function basketSlot(p, lod, seed, fruit) {
  const rnd = artRng(seed);
  const pal = fruit
    ? [[0xb8322a, 0xc9542c, 0xa62a24], [0xc9b84a, 0xb9a43c], [0x4b2a44, 0x5a3050], [0xd68a2a, 0xc87a24]]
    : [[0x5d8f3c, 0x6f9e48], [0x8a3a4a, 0xa4545a, 0xc8a070], [0xe6dccc, 0xb57aa8], [0xc75a2c, 0xd9a440]];
  const spots = [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.25], [0.3, -0.25]];
  spots.forEach(([x, z], k) => {
    const b = basket(0.25, 0.28, 1, lod);
    b.wicker.translate(x, 0, z);
    p.add('wicker', b.wicker);
    const c = pal[(k + Math.floor(rnd() * 2)) % pal.length];
    const r = fruit ? 0.045 : k % 2 ? 0.045 : 0.075;
    const h = heap(lod === 2 ? 2 : lod === 1 ? 5 : fruit ? 12 : 8, 0.2, 0.26, r * (lod === 2 ? 1.6 : 1), c.map((v) => lin(v)), seed + k, lod);
    if (h) {
      h.translate(x, 0, z);
      p.add('produce', h);
    }
  });
  // A crate on top of the back pair.
  if (lod < 2) {
    const cr = blk(lod, 0.6, 0.3, 0.42, { bevel: 0.01, seed: seed + 9, wobble: 0.003, grime: 0.2, seg: 1 });
    cr.translate(0, 0.34, -0.25);
    p.add('wood', cr);
  }
}

/** Sacks of grain: three lying, two on them, one standing at the back. */
function wheatSlot(p, lod, seed) {
  if (lod === 2) {
    const g = blk(2, 1.15, 0.7, 0.8, { seed, grime: 0.1 });
    p.add('sack', g);
    return;
  }
  for (let k = 0; k < 3; k++) p.add('sack', sackLying(0.42, 0.66, seed + k, lod).rotateY(Math.PI / 2 + (k - 1) * 0.06).translate(-0.4 + k * 0.4, 0, 0.15));
  for (let k = 0; k < 2; k++) p.add('sack', sackLying(0.42, 0.66, seed + 5 + k, lod).rotateY(Math.PI / 2 + (k ? 0.08 : -0.05)).translate(-0.2 + k * 0.4, 0.31, 0.15));
  p.add('sack', sack(0.44, 0.66, seed + 9, lod).translate(0.15, 0, -0.42));
  p.add('sack', sack(0.42, 0.62, seed + 10, lod).rotateY(0.6).translate(-0.35, 0, -0.45));
}

/** One place's goods (a cart's load) of `food`, facing +z, centred on the origin. Returns a Group (Parts.build). */
export function buildStockSlot(food, { lod = 0, seed = 7 } = {}) {
  const p = new Parts();
  switch (food) {
    case 'wheat': wheatSlot(p, lod, seed); break;
    case 'vegetables': basketSlot(p, lod, seed + 100, false); break;
    case 'fruit': basketSlot(p, lod, seed + 200, true); break;
    case 'meat': meatSlot(p, lod, seed + 300); break;
    case 'fish': fishSlot(p, lod, seed + 400); break;
    default: wheatSlot(p, lod, seed);
  }
  return p.build(`granary-${food}`);
}

/** The lantern's light (the lab's night): a warm point light at the front door. */
export function granaryLamp() {
  const l = new PointLight(0xffa04a, 0, 10, 2);
  l.position.set(...GRANARY.lamp);
  l.castShadow = false;
  return l;
}

/** Each place's matrix (the granary's own metres): STOCK_SLOTS as 4 x 4 matrices, standing on the platform. */
const SLOT_MATS = (() => {
  const m = new Matrix4();
  const q = new Quaternion();
  // (A little larger than life: a cart's load reads as a pile from the game's camera.)
  const s = new Vector3(1.3, 1.3, 1.3);
  const p = new Vector3();
  const up = new Vector3(0, 1, 0);
  const out = new Float32Array(16 * STOCK_SLOTS.length);
  STOCK_SLOTS.forEach(([x, z, yaw], i) => {
    p.set(x, GRANARY.floorY, z);
    q.setFromAxisAngle(up, yaw);
    m.compose(p, q, s).toArray(out, i * 16);
  });
  return out;
})();

/**
 * The goods in a granary's portico as modelPass.js reads them: one entry a
 * food it holds, [{ key: 'gstock:food', mats, n }], the places taken in
 * STOCK_SLOTS order (round the four sides), each food after the one before.
 */
export function granaryParts(fill) {
  const more = [];
  let at = 0;
  for (const { food, n } of fill) {
    if (!n) continue;
    more.push({ key: `gstock:${food}`, mats: SLOT_MATS.subarray(at * 16, (at + n) * 16), n });
    at += n;
  }
  return more;
}

/** Build a granary kit by its key: 'granary:n' (worked) or 'granary:i' (idle), 'gstock:food' (a place's goods). */
export function buildGranaryPart(key, lod) {
  const [w, arg] = key.split(':');
  if (w === 'gstock') return buildStockSlot(arg, { lod }).group;
  return buildGranary({ lod, idle: arg === 'i' }).group;
}

/** The granary's entry for models.js MODELS (its stock kept per building, rebuilt only when a place fills or empties). */
export function granaryModel(capacity) {
  return Object.freeze({
    warm: ['granary:n', 'gstock:wheat', 'gstock:meat', 'gstock:fish'],
    // The lantern at the front door, lit while it is staffed (the night's light map draws its glow: models.js modelLamps).
    lamps: (b) => (b.efficiency > 0 ? [GRANARY.lamp] : []),
    variant(b, place, ctx) {
      // (A ghost shows the granary as it will stand, open and empty.)
      const ghost = b.id === null || b.id === undefined;
      const idle = !ghost && !(b.efficiency > 0);
      const key = `granary:${idle ? 'i' : 'n'}`;
      if (ghost) return { key, state: 'always', ice: false, more: [] };
      const fill = granaryStock(b.stock, capacity);
      if (!ctx) return { key, state: 'always', ice: false, more: granaryParts(fill) };
      const memo = (ctx.granaryMemo ??= new Map());
      const sig = fill.map((f) => f.n).join(',');
      let e = memo.get(b.id);
      if (!e || e.sig !== sig) {
        e = { sig, more: granaryParts(fill) };
        memo.set(b.id, e);
      }
      e.seen = ctx.frame;
      // (Forget granaries long unseen: demolished, or another city's.)
      if (ctx.frame % 600 === 0 && memo.pruned !== ctx.frame) {
        memo.pruned = ctx.frame;
        for (const [id, m] of memo) if (ctx.frame - m.seen > 600) memo.delete(id);
      }
      return { key, state: 'always', ice: false, more: e.more };
    },
    build: buildGranaryPart,
  });
}

