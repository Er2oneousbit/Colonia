/**
 * models/wsPotter.js
 * ----------------------------------------------------------------------------
 * The Potter (Figlina) of the 3D look, on the workshop kit (workshopKit.js),
 * from the record of the Roman potteries, not from the 2D sprite:
 *
 *   - the kick wheel (rota figularis): the potter seated at a wheel with a
 *     heavy flywheel low down on the axle, turned with the foot, the
 *     wheelhead a hand's breadth above his knees. Greek and Italic vase
 *     paintings and the potters' reliefs show it so, and the pottery
 *     quarters of Rome (the Monte Testaccio's source) and Arretium worked
 *     it; a bowl of slip stands by;
 *   - the clay: wedged on a table by hand, as Pliny (Natural History 35.46)
 *     has it, before it is thrown; the dug clay is kept wet in a trough;
 *   - the drying shelves along the back wall, where the thrown ware stands
 *     out of the sun and the draught until it is leather-hard, and the
 *     finished ware is racked after the kiln;
 *   - the kiln: the Italic updraught kiln, a round firebox of clay and
 *     brick with a stoke hole in front and a perforated floor, the ware
 *     stacked inside a dome that is plastered over and left a vent at the
 *     top (the kilns of Pompeii's Via dei Sepolcri, of Arretium and the
 *     Tiber's potteries); smoking while it is fired.
 *
 * Layout: the wheel at the back left under the shed, the shelves along the
 * back wall, the wedging table and the clay trough in the yard, the kiln at
 * the front right. The input (clay) lies in the trough and in lumps beside
 * it; the output (pots) stands on the shelves and in rows in the yard.
 *
 * States: 'open' staffed (lantern lit, the kiln mouth glowing, the potter at
 * the wheel, a man wedging clay; the kiln smokes), 'shut' not (boards across
 * the front, the kiln mouth bricked up).
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { slab } from './masonry.js';
import { jar } from './rural.js';
import { lump } from './industryKit.js';
import { WsYard, WS, F, WASH, DADO, shed, ground, tub, stool, trestle, plankShelves, seg, colour, stone, bx, cyl } from './workshopKit.js';

/** The potter's measures (metres): the actors and the smoke read them. */
export const POTTER = Object.freeze({
  wheel: Object.freeze({ x: -2.1, z: -2.25 }),
  /** The kiln: its middle, radius and the vent's height; the stoke hole faces +z. */
  kiln: Object.freeze({ x: 2.35, z: 1.45, r: 1.0, top: 1.62 }),
  table: Object.freeze({ x: -2.55, z: 1.0, w: 1.15, d: 0.6, top: 0.86 }),
  trough: Object.freeze({ x: -0.05, z: 1.25, w: 1.7, d: 0.55, h: 0.42 }),
  shelves: Object.freeze({ x0: 0.1, x1: 3.2, heights: Object.freeze([0.42, 0.95, 1.48]) }),
  lamp: WS.lamp,
  /** Where the kiln's smoke starts: over its vent. */
  smoke: Object.freeze({ x: 2.35, y: 1.62, z: 1.45 }),
});

const P = POTTER;
const CLAY_WET = [0.52, 0.34, 0.2];

/** One pot of a kind, on y = 0: 'olla' (a round cooking pot), 'jug' (lagoena), 'bowl', 'jar' (a storage jar with two handles). */
function pot(kind, lod, tone = 1) {
  const n = seg(lod, 10, 8, 5);
  const prof = {
    olla: [[0.04, 0], [0.1, 0.01], [0.14, 0.1], [0.12, 0.2], [0.09, 0.25], [0.11, 0.27], [0.1, 0.275], [0.07, 0.25], [0, 0.24]],
    jug: [[0.05, 0], [0.09, 0.03], [0.12, 0.13], [0.1, 0.23], [0.05, 0.3], [0.045, 0.38], [0.07, 0.41], [0.055, 0.405], [0, 0.39]],
    bowl: [[0.06, 0], [0.14, 0.04], [0.18, 0.1], [0.19, 0.105], [0.17, 0.1], [0.12, 0.05], [0, 0.04]],
    jar: [[0.06, 0], [0.12, 0.04], [0.19, 0.18], [0.18, 0.3], [0.1, 0.38], [0.09, 0.42], [0.12, 0.44], [0.1, 0.445], [0.07, 0.42], [0, 0.4]],
  }[kind];
  const g = revolve(profileOf(prof), { segments: n, metres: 0.4, tint: (p) => tone * (Math.hypot(p.x, p.z) < 0.07 && p.y > 0.2 ? 0.45 : 0.85 + 0.15 * Math.min(1, p.y / 0.3)) });
  if (kind === 'jug' && lod < 2) {
    const h = new BoxGeometry(0.02, 0.2, 0.04);
    h.rotateZ(0.5);
    h.translate(0.1, 0.27, 0);
    g.userData.handle = tintGeometry(boxUV(h), () => tone);
  }
  return g;
}

/** Pots placed in a row or a grid: kinds cycle, each at (x, y, z) with its own tone. */
function potsAt(spots, lod, seed = 1) {
  const kinds = ['olla', 'jug', 'bowl', 'jar', 'olla', 'bowl', 'jug'];
  const out = [];
  spots.forEach(([x, y, z], k) => {
    const g = pot(kinds[(k + seed) % kinds.length], lod, 0.9 + 0.12 * ((k * 7 + seed) % 5) / 4);
    g.translate(x, y, z);
    out.push(g);
    if (g.userData.handle) out.push(g.userData.handle.translate(x, y, z));
  });
  return out;
}

/** The kick wheel with a pot on the wheelhead and the potter's stool, in the shed. */
function wheel(y, lod) {
  const { x, z } = P.wheel;
  const n = seg(lod, 24, 14, 8);
  // The frame: four legs and a table of boards the axle passes through; the flywheel low on the axle.
  const frame = [bx(0.85, 0.05, 0.7, x, F + 0.46, z, 0.82)];
  for (const a of [-1, 1]) for (const b of [-1, 1]) frame.push(bx(0.06, 0.46, 0.06, x + a * 0.38, F, z + b * 0.3, 0.78));
  y.add('wood', frame);
  y.add('wood', cyl([x, F + 0.1, z], [x, F + 0.68, z], 0.026, 0.026, seg(lod, 8, 6, 4)));
  const fly = new CylinderGeometry(0.34, 0.34, 0.07, n, 1);
  fly.translate(x, F + 0.2, z);
  y.add('stone', tintGeometry(boxUV(fly), () => 0.82));
  const head = new CylinderGeometry(0.2, 0.2, 0.045, n, 1);
  head.translate(x, F + 0.64, z);
  y.add('wood', tintGeometry(boxUV(head), () => 0.9));
  // The vessel in the making, a wet cylinder pulled up.
  const vase = revolve(profileOf([[0.0, 0], [0.1, 0], [0.12, 0.06], [0.1, 0.14], [0.065, 0.2], [0.07, 0.23], [0.05, 0.22], [0, 0.2]]), { segments: n, metres: 0.4, tint: () => CLAY_WET });
  vase.translate(x, F + 0.665, z);
  y.add('rawClay', vase);
  // The potter's stool is behind the wheel (toward the back wall), and a bowl of slip stands by.
  y.add('wood', stool(x, z - 0.3, { top: 0.45, s: 0.32 }));
  const slip = tub(x - 0.95, z - 0.1, 0.24, 0.42, lod, { liquid: [0.75, 0.66, 0.5], level: 0.08 });
  y.add('wood', slip.wood);
  y.add('iron', slip.iron);
  y.add('produce', slip.liquid);
}

/** The drying and finished shelves along the back wall (the planks; the ware is the stock's). */
function shelves(y, lod) {
  const s = P.shelves;
  y.add('wood', plankShelves(s.x0, s.x1, WS.zBack + WS.t + 0.02, 0.44, s.heights, { lod }));
}

/** The wedging table in the yard: a block of clay on it, the wire laid by, and its legs. */
function wedgingTable(y, lod) {
  const t = P.table;
  y.add('wood', trestle(t.x, t.z, t.w, t.d, t.top, { lod }));
  y.add('rawClay', colour(slab(0.42, 0.2, 0.3, { bevel: 0.04, seed: 5, wobble: 0.01, tone: 0.1, grime: 0 }), [1, 1, 1], 0.7).translate(t.x - 0.1, F + t.top, t.z));
  if (lod < 2) y.add('rawClay', colour(slab(0.2, 0.12, 0.2, { bevel: 0.04, seed: 6, wobble: 0.01, tone: 0.1, grime: 0 }), [1, 1, 1], 0.7).translate(t.x + 0.3, F + t.top, t.z + 0.05));
}

/** The clay trough: a long box of planks on legs, the clay lying in it (the stock's lumps). */
function trough(y, lod) {
  const t = P.trough;
  const p = [];
  p.push(bx(t.w, 0.04, t.d, t.x, F + 0.16, t.z, 0.8));
  for (const s of [-1, 1]) p.push(bx(t.w, t.h - 0.16, 0.05, t.x, F + 0.16, t.z + s * (t.d / 2 - 0.025), 0.85));
  for (const s of [-1, 1]) p.push(bx(0.05, t.h - 0.16, t.d - 0.1, t.x + s * (t.w / 2 - 0.025), F + 0.16, t.z, 0.85));
  for (const a of [-1, 1]) for (const b of [-1, 1]) if (lod < 2 || (a > 0 && b > 0)) p.push(bx(0.07, 0.16, 0.07, t.x + a * (t.w / 2 - 0.08), F, t.z + b * (t.d / 2 - 0.08), 0.75));
  y.add('wood', p);
  // The wet clay's own slurry in the bottom.
  y.add('rawClay', colour(bx(t.w - 0.16, 0.02, t.d - 0.14, t.x, F + 0.2, t.z, 0.5), [1, 1, 1], 1));
}

/** The kiln: the firebox wall, the dome plastered over its stack, the vent, the stoke hole's arch and a glowing mouth. */
function kiln(y, lod) {
  const k = P.kiln;
  const n = seg(lod, 28, 16, 10);
  const prof = [[k.r, 0], [k.r, 0.55], [k.r * 0.95, 0.85], [k.r * 0.8, 1.2], [k.r * 0.55, 1.46], [k.r * 0.25, 1.58], [0.17, 1.6], [0.17, k.top - 0.02], [0.13, k.top - 0.02], [0.12, 1.5], [0, 1.45]];
  const dome = revolve(profileOf(prof), {
    segments: n, metres: 0.7,
    tint: (p) => {
      // The clay plaster scorched round the vent and the mouth.
      const burn = Math.max(0, 1 - Math.hypot(p.x, p.z) / 0.5) * (p.y > 1.2 ? 0.4 : 0);
      return 0.82 + 0.15 * Math.min(1, p.y / 1.3) - burn;
    },
  });
  dome.translate(k.x, F, k.z);
  y.add('clay', dome);
  // The foundation ring and the bands of brick that bind the dome (kilns were banded with hoops of fired clay).
  if (lod < 2) {
    for (const hh of [0.42, 0.95]) {
      const rr = hh < 0.5 ? k.r : k.r * 0.94;
      const band = new CylinderGeometry(rr + 0.03, rr + 0.03, 0.09, n, 1, true);
      band.translate(k.x, F + hh, k.z);
      y.add('clay', tintGeometry(boxUV(band), () => 0.72));
    }
  }
  // The stoke hole: a stone arch in the front, its mouth dark with a fire inside while it is fired.
  const mz = k.z + k.r - 0.02;
  y.add('stone', [stone(0.14, 0.62, 0.24, k.x - 0.4, F, mz, { bevel: 0.015, seed: 71, wobble: 0.004, tone: 0.1, grime: 0.5 }), stone(0.14, 0.62, 0.24, k.x + 0.4, F, mz, { bevel: 0.015, seed: 72, wobble: 0.004, tone: 0.1, grime: 0.5 }), stone(0.94, 0.14, 0.24, k.x, F + 0.62, mz, { bevel: 0.015, seed: 73, wobble: 0.004, tone: 0.1, grime: 0.5 })]);
  y.add('dark', bx(0.66, 0.5, 0.1, k.x, F + 0.02, mz - 0.1, 1));
  y.add('ember', bx(0.5, 0.2, 0.06, k.x, F + 0.04, mz + 0.0, 1), 'open', false);
  // Shut: the mouth is bricked up with clay.
  y.add('clay', colour(bx(0.68, 0.52, 0.08, k.x, F + 0.02, mz + 0.03, 1), [1, 1, 1], 0.8), 'shut');
  // A stack of firewood against the dome's side, and the poker.
  if (lod < 2) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) y.add('wood', cyl([k.x + k.r + 0.12 + r * 0.17, F + 0.1 + r * 0.15, k.z - 0.5 + c * 0.17 + r * 0.08], [k.x + k.r + 0.12 + r * 0.17, F + 0.1 + r * 0.15, k.z + 0.6 + c * 0.17 - 0.3], 0.07, 0.065, seg(lod, 7, 5, 4)));
  }
}

/** The yard's other things: two storage jars (dolia) by the fence, a water butt, and the heap of sherds from the kiln's spoiled ware. */
function dressing(y, lod) {
  for (const [x, z, k] of [[-3.15, 3.0, 1], [-2.45, 3.2, 2]]) y.add('clay', jar({ lod: lod === 0 ? 1 : 2, seed: 20 + k }).translate(x, F, z));
  const butt = tub(-3.2, 2.0, 0.3, 0.6, lod, { liquid: [0.35, 0.42, 0.38], level: 0.1 });
  y.add('wood', butt.wood);
  y.add('iron', butt.iron);
  y.add('produce', butt.liquid);
  // The sherds: broken ware thrown on a heap at the front right, a few bits strewn about.
  const heap = [];
  for (let k = 0; k < (lod === 0 ? 14 : 5); k++) heap.push(colour(slab(0.14 + (k % 3) * 0.04, 0.05, 0.1, { bevel: 0.01, seed: 60 + k, wobble: 0.01, tone: 0.2, grime: 0 }), [1, 1, 1], 0.8 + 0.06 * (k % 4)).rotateY(k * 1.3).translate(2.9 + ((k * 7) % 5) * 0.09 - 0.2, F + 0.03 + (k % 3) * 0.04, 3.0 + ((k * 3) % 4) * 0.08 - 0.12));
  y.add('clay', heap);
}

/** Build the Potter: { group, meshes, triangles }; meshes tagged in userData.when ('open', 'shut'). */
export function buildPotter({ lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const y = new WsYard('pottery_ws', lod);
  ground(y);
  shed(y, lod, { wash: WASH.cream, dado: DADO.red, window: -1.0, seed: 301 });
  wheel(y, lod);
  shelves(y, lod);
  wedgingTable(y, lod);
  trough(y, lod);
  kiln(y, lod);
  dressing(y, lod);
  return y.build();
}

/**
 * The stock. `in` is the clay (lumps in the trough and heaped beside it),
 * `out` the pots (on the shelves and in the yard), a third each step.
 */
export function buildPotterStock(kind, step, { lod = 0 } = {}) {
  const y = new WsYard(`pottery_ws_${kind}`, lod);
  if (kind === 'in') {
    const t = P.trough;
    const nLump = [0, 3, 6, 9][step];
    const lumps = [];
    for (let k = 0; k < nLump; k++) {
      const c = k % 5;
      const r = 0.15 + 0.02 * (k % 3);
      const g = lump(r, 90 + k, { sx: 1.25, sy: 0.8, sz: 1 });
      lumps.push(colour(g, [1, 1, 1], 0.72 + 0.05 * (k % 3)).translate(t.x - t.w / 2 + 0.3 + c * 0.3, F + 0.2, t.z + (k < 5 ? 0 : 0.1)));
    }
    y.add('rawClay', lumps.slice(0, lod === 2 ? 4 : 99));
    // The third step: a heap of dug lumps on the ground beside the trough, under a wet sack.
    if (step === 3) {
      const heap = [];
      for (let k = 0; k < (lod === 2 ? 3 : 8); k++) {
        const a = (k / 8) * 6.28;
        heap.push(colour(lump(0.17, 120 + k, { sx: 1.2, sy: 0.8 }), [1, 1, 1], 0.7 + 0.05 * (k % 3)).translate(t.x + 1.35 + Math.cos(a) * 0.25 * (k < 7 ? 1 : 0), F + (k < 7 ? 0 : 0.2), t.z + 0.1 + Math.sin(a) * 0.25 * (k < 7 ? 1 : 0)));
      }
      y.add('rawClay', heap);
    }
  } else {
    const s = P.shelves;
    const spots = [];
    const perShelf = 6;
    const shelvesFull = [0, 1, 2, 3][step];
    for (let h = 0; h < Math.min(3, shelvesFull + (step === 2 ? 0 : 0)); h++) {
      for (let k = 0; k < perShelf; k++) spots.push([s.x0 + 0.2 + k * ((s.x1 - s.x0 - 0.4) / (perShelf - 1)), F + s.heights[h] + 0.04, WS.zBack + WS.t + 0.26 - (k % 2) * 0.05]);
    }
    // Step 2 and 3 also stand rows on the ground in the yard.
    if (step >= 2) {
      const rows = step === 3 ? 2 : 1;
      for (let r = 0; r < rows; r++) for (let k = 0; k < 5; k++) spots.push([-1.0 + k * 0.5, F + 0.04, 2.75 + r * 0.45]);
    }
    const g = potsAt(lod === 2 ? spots.filter((_, i) => i % 2 === 0) : spots, lod);
    y.add('clay', g);
    if (step >= 2) y.add('wood', bx(3.3, 0.04, step === 3 ? 1.0 : 0.55, 0.1, F, 2.75 + (step === 3 ? 0.22 : 0), 0.8));
  }
  return y.build();
}

/**
 * The people (people/actors.js specs, the shed's metres): the potter
 * seated at the wheel, a man wedging clay at the table. Nobody when shut.
 */
export function potterActors(state) {
  if (state !== 'open') return [];
  const w = P.wheel;
  const t = P.table;
  const tunic = { body: 'm', dress: ['tunic:short'], hair: 'crop' };
  return [
    { ...tunic, hair: 'curls', clip: 'sit', at: [w.x, F, w.z - 0.3], ry: 0, seed: 401, colours: { tunic: 0xb9a37a } },
    { ...tunic, hair: 'bald', clip: 'stir', at: [t.x, F, t.z + t.d / 2 + 0.25], ry: Math.PI, seed: 402, colours: { tunic: 0x8a7a5a } },
  ];
}
