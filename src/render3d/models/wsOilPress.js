/**
 * models/wsOilPress.js
 * ----------------------------------------------------------------------------
 * The Oil Press (Trapetum) of the 3D look, on the workshop kit
 * (workshopKit.js), from Cato (De agri cultura 18-22 and 64-69) and Varro
 * (De re rustica I.55), and the presses of the farms of Campania, not from
 * the sprite:
 *
 *   - the trapetum, Cato's olive mill, named by its parts: a round masonry
 *     base (the mortarium) with a basin, a central pillar (the miliarium),
 *     two half-spherical millstones (orbes) on a beam (cupa) that turns
 *     about the pillar, driven by a man or a donkey on the bars. It
 *     crushes the fruit without breaking the stones (the gap set by blocks
 *     under the beam). It stands in the yard, in the open;
 *   - the lever press (prelum) under the shed: a stone bed (area) with a
 *     raised rim and a lip, on which the crushed paste in rope mats
 *     (fiscinae) is piled, a post and block (the pressing board and its
 *     stipes) on the stack, and a long timber beam, its butt held between
 *     two uprights (arbores) and its free end drawn down by a windlass
 *     (sucula) and a rope, as Cato describes and the press at Stabiae shows;
 *   - the oil runs from the lip into a sunk basin and is ladled into the
 *     settling vat (labrum), where the water and lees fall out, stirred and
 *     skimmed; then into amphorae, stoppered, and racked along the wall.
 *
 * Layout: the trapetum in the yard at the left, baskets of olives in the
 * yard at the right, the press bed at the middle of the shed with its beam
 * rising to the windlass at the right, the settling vat in the left bay,
 * and the amphorae in rows at the shed's front.
 *
 * States: 'open' staffed (lantern lit, boards up, a man winding the
 * windlass, a man stirring the vat, a porter with a sack of olives walking
 * between the baskets and the mill), 'shut' not (boards across the front).
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { artRng } from '../texgen.js';
import { beam, basket } from './rural.js';
import { mound } from './industryKit.js';
import { WINDLASS } from '../people/clips.js';
import { WsYard, WS, F, WASH, DADO, shed, ground, tub, amphora, basketOf, handcart, seg, lin, colour, stone, bx, cyl } from './workshopKit.js';

/** The oil press's measures (metres): the actors and the tests read them. */
export const OIL_PRESS = Object.freeze({
  mill: Object.freeze({ x: -2.0, z: 1.55, r: 0.9 }),
  /** The vat of oil in the left bay: its middle, radius and height (the stirrer's rim, clips.js MORTAR). */
  vat: Object.freeze({ x: -2.65, z: -2.85, r: 0.42, h: 0.86 }),
  /** The lever press: the bed's middle, the beam's butt and free end (x) and the row's z. */
  press: Object.freeze({ bedX: -0.1, pivotX: -1.5, endX: 2.1, z: -2.55 }),
  lamp: WS.lamp,
});

const M = OIL_PRESS;

/**
 * The lever press under the shed, drawn for the oil press and the winery:
 * `bedX` the stone bed's middle, `pivotX` the butt of the beam between its
 * uprights, `endX` the free end, with the windlass under it. Its axle lies
 * along x at the clip's crank height, and the winder stands past its right
 * end; `leverPress` returns where. Heights are fixed by the clip: the
 * crank turns at WINDLASS.height.
 */
export function leverPress(y, lod, { bedX, pivotX, endX, z }) {
  const n = seg(lod, 12, 8, 6);
  // The bed: a slab with a rim round it and a lip at the front, the oil's way out.
  const bed = stone(1.5, 0.2, 1.1, bedX, F, z, { bevel: 0.03, seed: 31, wobble: 0.008, tone: 0.1, grime: 0.5 });
  y.add('stone', bed);
  if (lod < 2) {
    y.add('stone', [
      stone(1.5, 0.07, 0.09, bedX, F + 0.2, z - 0.5, { bevel: 0.01, seed: 32, wobble: 0.003, tone: 0.1, grime: 0.5 }),
      stone(1.5, 0.07, 0.09, bedX, F + 0.2, z + 0.5, { bevel: 0.01, seed: 33, wobble: 0.003, tone: 0.1, grime: 0.5 }),
      stone(0.09, 0.07, 0.92, bedX - 0.705, F + 0.2, z, { bevel: 0.01, seed: 34, wobble: 0.003, tone: 0.1, grime: 0.5 }),
      stone(0.09, 0.07, 0.92, bedX + 0.705, F + 0.2, z, { bevel: 0.01, seed: 35, wobble: 0.003, tone: 0.1, grime: 0.5 }),
      stone(0.24, 0.1, 0.3, bedX, F + 0.12, z + 0.68, { bevel: 0.015, seed: 36, wobble: 0.004, tone: 0.1, grime: 0.5 }),
    ]);
  }
  // The pile of rope mats with the paste between, the board on top and the block under the beam.
  const mats = [];
  const layers = lod === 2 ? 2 : 5;
  for (let k = 0; k < layers; k++) {
    const h = lod === 2 ? 0.2 : 0.065;
    const g = new CylinderGeometry(0.42 - 0.01 * (k % 2), 0.42 - 0.01 * (k % 2), h, n * 2, 1);
    g.translate(bedX, F + 0.27 + k * (h + 0.003) + (lod === 2 ? 0.1 : 0.03), z);
    mats.push(tintGeometry(boxUV(g), () => 0.8 + 0.1 * (k % 2)));
  }
  y.add('rope', mats);
  y.add('wood', bx(0.9, 0.07, 0.9, bedX, F + 0.62, z, 0.85));
  // The beam, rising from its butt to the free end; the block under it over the stack.
  const butt = [pivotX, 1.0, z];
  const tip = [endX, 1.85, z];
  y.add('wood', beam(butt, tip, 0.24, 41, lod));
  const beamAt = (x) => butt[1] + ((tip[1] - butt[1]) * (x - pivotX)) / (endX - pivotX);
  const blockTop = beamAt(bedX) - 0.12;
  y.add('wood', bx(0.34, blockTop - (F + 0.69), 0.34, bedX, F + 0.69, z, 0.78));
  // The uprights (arbores) either side of the butt, pegged through, and a tie to the wall.
  for (const s of [-1, 1]) y.add('wood', bx(0.2, 2.6, 0.17, pivotX, F, z + s * 0.24, 0.75));
  if (lod < 2) {
    y.add('wood', cyl([pivotX, 0.93, z - 0.4], [pivotX, 0.93, z + 0.4], 0.03, 0.03, 5));
    y.add('wood', bx(0.2, 0.14, 1.6, pivotX, 2.55, z - 0.4, 0.7));
  }
  // The windlass: forked posts, the drum with the rope coiled on it, the crank's boss, and the rope up to the beam.
  const ax = { x0: endX - 0.45, x1: endX + 0.45 };
  for (const x of [ax.x0 - 0.1, ax.x1 + 0.1]) {
    y.add('wood', bx(0.12, WINDLASS.height - F - 0.06, 0.12, x, F, z, 0.75));
    if (lod < 2) y.add('wood', [bx(0.12, 0.14, 0.04, x, WINDLASS.height - 0.08, z - 0.08, 0.75), bx(0.12, 0.14, 0.04, x, WINDLASS.height - 0.08, z + 0.08, 0.75)]);
  }
  y.add('wood', cyl([ax.x0 - 0.05, WINDLASS.height, z], [ax.x1 + 0.05, WINDLASS.height, z], 0.1, 0.1, seg(lod, 12, 8, 6)));
  if (lod < 2) y.add('rope', cyl([endX - 0.18, WINDLASS.height, z], [endX + 0.18, WINDLASS.height, z], 0.125, 0.125, seg(lod, 12, 8, 6)));
  y.add('rope', cyl([endX, WINDLASS.height + 0.1, z], [endX, 1.74, z], 0.025, 0.025, 5));
  y.add('iron', bx(0.1, 0.05, 0.1, endX, 1.7, z, 0.9));
  return pressWindlass({ endX, z });
}

/** The windlass's axle: its right end and its z (the winder stands by them). */
export function pressWindlass({ endX, z }) {
  return { x1: endX + 0.45, z };
}

/** Where the winder stands for a press: past the axle's right end, at the clip's reach from it (ironMine.js's way). */
export function winderAt(press) {
  return [press.x1 + WINDLASS.x + 0.06, F, press.z + WINDLASS.ahead];
}

/** The trapetum in the yard: base, basin, pillar, two millstones on the beam, the bars. */
function mill(y, lod) {
  const { x, z } = M.mill;
  const n = seg(lod, 32, 16, 10);
  const base = new CylinderGeometry(0.88, 0.94, 0.5, n, 1);
  base.translate(x, F + 0.25, z);
  y.add('stone', tintGeometry(boxUV(base), (xx, yy) => 0.7 + 0.3 * Math.min(1, yy / 0.5)));
  const basin = revolve(profileOf([[0.88, 0.5], [0.89, 0.84], [0.83, 0.88], [0.74, 0.86], [0.72, 0.64], [0.34, 0.62], [0.18, 0.64], [0, 0.64]]), {
    segments: n, metres: 0.8, tint: (p) => (Math.hypot(p.x, p.z) < 0.73 && p.y < 0.82 ? 0.7 : 1),
  });
  basin.translate(x, F, z);
  y.add('stone', basin);
  // The milled paste in the basin, dark green-brown.
  const paste = new CylinderGeometry(0.7, 0.7, 0.03, n, 1);
  paste.translate(x, F + 0.7, z);
  y.add('produce', tintGeometry(boxUV(paste), () => lin(0x3a3a22)));
  const pillar = new CylinderGeometry(0.12, 0.14, 0.6, seg(lod, 12, 8, 6), 1);
  pillar.translate(x, F + 0.95, z);
  y.add('stone', tintGeometry(boxUV(pillar)));
  for (const s of [-1, 1]) {
    const orb = new CylinderGeometry(0.34, 0.34, 0.2, n, 1);
    orb.rotateZ(Math.PI / 2);
    orb.translate(x + s * 0.4, F + 0.98, z);
    y.add('stone', tintGeometry(boxUV(orb), () => 0.9));
  }
  // The beam through the pillar with the bars the driver pushes out to the sides.
  y.add('wood', beam([x - 0.9, F + 1.0, z], [x + 0.9, F + 1.0, z], 0.09, 861, lod));
  if (lod < 2) {
    y.add('wood', beam([x, F + 1.0, z - 0.2], [x, F + 1.0, z - 1.1], 0.07, 862, lod));
    y.add('wood', beam([x, F + 1.0, z + 0.2], [x, F + 1.0, z + 1.1], 0.07, 863, lod));
  }
}

/** The settling vat in the left bay, and the sunk basin the oil runs into from the press's lip. */
function vats(y, lod, press) {
  const v = M.vat;
  const t = tub(v.x, v.z, v.r, v.h, lod, { liquid: lin(0x9a8a2a), level: 0.1, hoops: 3 });
  y.add('wood', t.wood);
  y.add('iron', t.iron);
  y.add('produce', t.liquid);
  // The sunk basin in front of the lip.
  const bz = press.z + 0.95;
  const basin = revolve(profileOf([[0.3, 0], [0.34, 0.1], [0.34, 0.12], [0.28, 0.12], [0.26, 0.04], [0, 0.04]]), { segments: seg(lod, 16, 10, 6), metres: 0.8, tint: (p) => (Math.hypot(p.x, p.z) < 0.28 && p.y < 0.11 ? 0.45 : 1) });
  basin.translate(-0.1, F, bz);
  y.add('stone', basin);
  y.add('produce', colour(bx(0.4, 0.01, 0.4, -0.1, F + 0.07, bz - 0.2, 1), lin(0x9a8a2a)));
  // A ladle and a skimmer on the vat's rim when it is shut (the stirrer has them in his hand otherwise).
  if (lod < 2) y.add('wood', cyl([v.x + 0.1, F + v.h + 0.02, v.z], [v.x + 0.5, F + v.h + 0.02, v.z + 0.2], 0.014, 0.014, 4), 'shut');
}

/** The yard's other things: the heap of pressed paste (sansa) that is carted off for fuel, a handcart and baskets stacked empty. */
function dressing(y, lod) {
  y.add('produce', colour(mound(0.62, 0.45, 5, lod), lin(0x4a3a24)).translate(3.05, F, 3.05));
  const c = handcart(0.4, 3.0, Math.PI / 2, lod, 6);
  y.add('wood', c.wood);
  y.add('iron', c.iron);
  if (lod < 2) {
    for (let k = 0; k < 3; k++) {
      const b = basket(0.26, 0.3, 0, lod);
      y.add('wicker', b.wicker.translate(-3.2, F + k * 0.22, 3.1 - 0.0));
    }
  }
}

/** Build the Oil Press: { group, meshes, triangles }. */
export function buildOilPress({ lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const y = new WsYard('oil_ws', lod);
  ground(y);
  shed(y, lod, { wash: WASH.pink, dado: DADO.ochre, window: -2.4, seed: 321 });
  const press = leverPress(y, lod, M.press);
  mill(y, lod);
  vats(y, lod, press);
  dressing(y, lod);
  return y.build();
}

/** The olives, as a heap of fruit in each basket: green and black. */
const OLIVES = [lin(0x5a6a2c), lin(0x3b2a3a), lin(0x6b7a38), lin(0x2c2230)];

/**
 * The stock. `in` is olives in baskets in the yard at the right (2, 5, 8),
 * `out` the oil in amphorae in rows at the shed's front (4, 9, 17).
 */
export function buildOilPressStock(kind, step, { lod = 0 } = {}) {
  const y = new WsYard(`oil_ws_${kind}`, lod);
  if (kind === 'in') {
    const spots = [[1.5, 0.7], [2.3, 0.9], [3.1, 0.7], [1.5, 1.55], [2.3, 1.75], [3.1, 1.55], [1.9, 2.6], [2.8, 2.5]];
    const count = [0, 2, 5, 8][step];
    const wick = [];
    const fill = [];
    for (let k = 0; k < count; k++) {
      const b = basketOf(spots[k][0], spots[k][1], OLIVES, { r: 0.27, h: 0.32, lod: lod === 0 ? 1 : 2, seed: 30 + k, n: 14, rr: 0.04 });
      wick.push(...b.wicker);
      fill.push(...b.produce);
    }
    y.add('wicker', wick);
    y.add('produce', fill);
  } else {
    const rnd = artRng(9);
    const rows = [[-3.1, -1.0, 9, 0.4], [-1.4, -1.45, 8, 0.42]];
    const count = [0, 4, 9, 17][step];
    const jars = [];
    let made = 0;
    for (const [x0, z, n, dx] of rows) {
      for (let k = 0; k < n && made < count; k++, made++) jars.push(amphora(x0 + k * dx, z, { lod: 2, seed: 50 + made, lz: (rnd() - 0.5) * 0.05, lx: -0.1 + (rnd() - 0.5) * 0.03, tone: 0.9 + rnd() * 0.15 }));
    }
    y.add('clay', jars.filter((_, i) => lod < 2 || i % 2 === 0));
  }
  return y.build();
}

/**
 * The people: a man at the windlass, a man stirring the vat of oil, a
 * porter with a sack of olives from the baskets to the mill. Nobody when
 * shut.
 */
export function oilPressActors(state) {
  if (state !== 'open') return [];
  const v = M.vat;
  const tunic = { body: 'm', dress: ['tunic:short'], hair: 'crop' };
  return [
    { ...tunic, hair: 'curls', clip: 'windlass', props: { R: 'crank' }, at: winderAt(pressWindlass(M.press)), ry: Math.PI, seed: 421, colours: { tunic: 0xa8977a } },
    { ...tunic, hair: 'bald', clip: 'stir', props: { R: 'pestle' }, at: [v.x, F, v.z + 0.62], ry: Math.PI, seed: 422, colours: { tunic: 0x8a7a5a } },
    {
      ...tunic, clip: 'carry', props: { L: 'sack' }, at: [2.6, F, 3.6], ry: -Math.PI / 2, seed: 423, colours: { tunic: 0xbfae8e },
      route: { length: 4.3, speed: 0.8, pauseEnd: 3, pauseStart: 4, clipEnd: 'shoulder', clipStart: 'shoulder', faceEnd: Math.PI, faceStart: Math.PI },
    },
  ];
}
