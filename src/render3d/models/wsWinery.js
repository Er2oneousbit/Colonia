/**
 * models/wsWinery.js
 * ----------------------------------------------------------------------------
 * The Winery (Cella Vinaria) of the 3D look, on the workshop kit
 * (workshopKit.js), from Cato (De agri cultura 11-13, 23-26 and 112), Varro
 * (De re rustica I.54) and Columella (XII.18-19), and the wine farms of
 * Campania (the Villa Regina at Boscoreale, the farms of the Vesuvian
 * slopes), not from the sprite:
 *
 *   - the treading floor (calcatorium): a raised vat lined with lime
 *     mortar, in which the grapes were trodden by men with their tunics
 *     tucked up, holding to a bar overhead; the must ran out through a
 *     spout into a vessel sunk beneath;
 *   - the lever press (prelum) for the skins: the same beam, uprights and
 *     windlass as the oil press (wsOilPress.js leverPress), for the
 *     pressings of the marc after the treading;
 *   - the dolia: great globular jars of coarse ware, set into the earth to
 *     their shoulders so the must ferments cool, their mouths shut with
 *     wooden lids and clay (the cella defrutaria of the villa; a dolium or
 *     two here, as in the yard at Boscoreale);
 *   - the amphorae of the wine, laid on their sides in a cradle of planks
 *     (as in the cellars of Pompeii), their mouths stopped with clay and
 *     stamped.
 *
 * Layout: the treading vat in the yard at the left with its spout running to
 * a sunk dolium and two more beside it, baskets of grapes in the yard at
 * the right, the press under the shed (its beam rising to the windlass at
 * the middle), the amphorae in the cradle at the right-hand end of the
 * shed.
 *
 * States: 'open' staffed (lantern lit, boards up, a man treading the grapes
 * in the vat, a man winding the windlass, a porter with a sack of grapes),
 * 'shut' not (boards across the front, the vat's must still).
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { artRng } from '../texgen.js';
import { TREAD_SPEED } from './worksite.js';
import { leverPress, pressWindlass, winderAt } from './wsOilPress.js';
import { mound } from './industryKit.js';
import { WsYard, WS, F, WASH, DADO, shed, ground, tub, amphora, basketOf, handcart, seg, lin, colour, bx, cyl } from './workshopKit.js';

/** The winery's measures (metres): the actors and the tests read them. */
export const WINERY = Object.freeze({
  vat: Object.freeze({ x: -1.55, z: 1.4, r: 0.85, h: 0.7 }),
  press: Object.freeze({ bedX: -1.3, pivotX: -2.9, endX: 0.4, z: -2.55 }),
  /** The cradle of amphorae at the right-hand end of the shed: x0..x1, z0..z1. */
  cradle: Object.freeze({ x0: 2.0, x1: 3.3, z0: -3.3, z1: -1.7 }),
  lamp: WS.lamp,
});

const V = WINERY;
const MUST = lin(0x4a1a2c);

/** The treading vat on its platform, its overhead bar, the spout, and the three dolia sunk in the yard. */
function treading(y, lod) {
  const v = V.vat;
  // The platform of stone the vat stands on.
  y.add('stone', bx(2 * v.r + 0.4, 0.12, 2 * v.r + 0.4, v.x, F, v.z, 0.8));
  const t = tub(v.x, v.z, v.r, v.h, lod, { y0: F + 0.12, liquid: MUST, level: 0.22, hoops: 3 });
  y.add('wood', t.wood);
  y.add('iron', t.iron);
  y.add('produce', t.liquid);
  // The bar the treaders hold: two posts either side and a bar across, and ropes hanging from it.
  for (const s of [-1, 1]) y.add('wood', bx(0.1, 1.9, 0.1, v.x + s * (v.r + 0.35), F, v.z + 0.2, 0.75));
  y.add('wood', cyl([v.x - v.r - 0.35, F + 1.75, v.z + 0.2], [v.x + v.r + 0.35, F + 1.75, v.z + 0.2], 0.05, 0.05, 6));
  if (lod < 2) for (const s of [-1, 1]) y.add('rope', cyl([v.x + s * 0.5, F + 1.75, v.z + 0.2], [v.x + s * 0.5, F + 1.2, v.z + 0.2], 0.014, 0.014, 4));
  // The spout: a clay pipe from the foot of the vat to the first dolium.
  const dol = dolia(lod)[0];
  y.add('clay', cyl([v.x + v.r - 0.02, F + 0.32, v.z], [dol.x - 0.15, F + 0.3, dol.z], 0.05, 0.05, 6));
  // The skins: a heap of trodden marc on a board by the vat.
  y.add('produce', tintGeometry(new BoxGeometry(0.6, 0.18, 0.45).translate(v.x - 1.35, F + 0.09, v.z + 0.7), () => lin(0x3a1a2a)));
}

/** The dolia's places (x, z) in the yard, the first at the vat's spout. */
function dolia() {
  return [{ x: -0.1, z: 1.4 }, { x: -0.1, z: 2.55 }, { x: 0.75, z: 1.95 }];
}

/** The dolia sunk to their shoulders, each with a wooden lid. */
function sunk(y, lod) {
  dolia().forEach((d, k) => {
    // (Only the part above the ground is drawn: the shoulder, the lip and the mouth.)
    const g = revolve(profileOf([[0.42, 0], [0.33, 0.045], [0.35, 0.09], [0.35, 0.14], [0.28, 0.15], [0.26, 0.08], [0, 0.03]]), { segments: seg(lod, 22, 12, 8), metres: 0.6, tint: (p) => (Math.hypot(p.x, p.z) < 0.27 ? 0.3 : 0.72 + 0.28 * Math.min(1, p.y / 0.14)) });
    g.translate(d.x, F, d.z);
    y.add('clay', g);
    if (lod < 2) {
      const lid = new CylinderGeometry(0.31, 0.31, 0.05, lod ? 10 : 18, 1);
      lid.translate(d.x, F + 0.17 + (k === 1 ? 0.03 : 0), d.z);
      y.add('wood', tintGeometry(boxUV(lid), () => 0.9));
    }
  });
}

/** The cradle at the shed's right-hand end: two shelves of planks on posts, rails to keep the jars from rolling. */
function cradle(y, lod) {
  const c = V.cradle;
  const w = c.x1 - c.x0;
  for (const h of [0.26, 0.72]) {
    y.add('wood', bx(w, 0.05, c.z1 - c.z0, (c.x0 + c.x1) / 2, F + h, (c.z0 + c.z1) / 2, 0.82));
    if (lod < 2) for (const x of [c.x0 + 0.01, c.x1 - 0.01]) y.add('wood', bx(0.05, 0.12, c.z1 - c.z0, x, F + h + 0.05, (c.z0 + c.z1) / 2, 0.8));
  }
  for (const x of [c.x0 + 0.04, c.x1 - 0.04]) for (const z of [c.z0 + 0.04, (c.z0 + c.z1) / 2, c.z1 - 0.04]) y.add('wood', bx(0.07, 1.0, 0.07, x, F, z, 0.76));
}

/** The yard's other things: the heap of pressed skins and pips (the marc, fed to the pigs and spread on the vines) and a cart with a cask. */
function dressing(y, lod) {
  y.add('produce', colour(mound(0.6, 0.42, 7, lod), lin(0x3a1a2a)).translate(-3.1, F, 3.0));
  const c = handcart(-1.4, 3.05, Math.PI / 2, lod, 8);
  y.add('wood', c.wood);
  y.add('iron', c.iron);
  const k = tub(-1.5, 3.15, 0.26, 0.45, lod, { y0: F + 0.3, hoops: 2 });
  y.add('wood', k.wood);
  y.add('iron', k.iron);
}

/** Build the Winery: { group, meshes, triangles }. */
export function buildWinery({ lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const y = new WsYard('wine_ws', lod);
  ground(y);
  shed(y, lod, { wash: WASH.cream, dado: DADO.oxblood, window: 0.2, seed: 331 });
  leverPress(y, lod, V.press);
  treading(y, lod);
  sunk(y, lod);
  cradle(y, lod);
  dressing(y, lod);
  return y.build();
}

/** The grapes: dark and green bunches in the baskets. */
const GRAPES = [lin(0x3c2147), lin(0x4a2a55), lin(0x2e1a36), lin(0x6e8a3c)];

/**
 * The stock. `in` is baskets of grapes in the yard at the right (3, 6,
 * 10), `out` amphorae of wine laid in the cradle (4, 8, 12).
 */
export function buildWineryStock(kind, step, { lod = 0 } = {}) {
  const y = new WsYard(`wine_ws_${kind}`, lod);
  if (kind === 'in') {
    const spots = [];
    for (const z of [0.55, 1.3, 2.05, 2.8]) for (const x of [1.55, 2.2, 2.85]) spots.push([x, z]);
    const count = [0, 3, 6, 10][step];
    const wick = [];
    const fill = [];
    for (let k = 0; k < count; k++) {
      const b = basketOf(spots[k][0], spots[k][1], GRAPES, { r: 0.26, h: 0.3, lod: lod === 0 ? 1 : 2, seed: 40 + k, n: 12, rr: 0.04 });
      wick.push(...b.wicker);
      fill.push(...b.produce);
    }
    y.add('wicker', wick);
    y.add('produce', fill);
  } else {
    const c = V.cradle;
    const rnd = artRng(11);
    const slots = [];
    for (const h of [0.26, 0.72]) for (const dz of [0, 1]) for (let i = 0; i < 3; i++) slots.push([c.x0 + 0.22 + i * 0.42, F + h + 0.05 + 0.13, c.z0 + 0.05 + dz * 0.8]);
    const count = [0, 4, 8, 12][step];
    const jars = [];
    // Laid on their sides, necks toward the street (+z), as the cellars of Pompeii have them.
    for (let k = 0; k < count; k++) {
      const [x, yy, z] = slots[k];
      const g = amphora(0, 0, { y0: 0, lod: 2, seed: 60 + k, tone: 0.9 + rnd() * 0.15, s: 0.8 });
      g.rotateX(Math.PI / 2);
      g.translate(x, yy, z);
      jars.push(g);
    }
    y.add('clay', jars.filter((_, i) => lod < 2 || i % 2 === 0));
  }
  return y.build();
}

/**
 * The people: a man treading the grapes, a man at the windlass, a porter
 * with a sack of grapes to the vat. Nobody when shut.
 */
export function wineryActors(state) {
  if (state !== 'open') return [];
  const v = V.vat;
  const tunic = { body: 'm', dress: ['tunic:short'], hair: 'crop' };
  return [
    { ...tunic, hair: 'curls', clip: 'tread', at: [v.x, F + 0.24, v.z], ry: Math.PI, speed: TREAD_SPEED * 0.6, seed: 431, colours: { tunic: 0xb9a37a } },
    { ...tunic, hair: 'bald', clip: 'windlass', props: { R: 'crank' }, at: winderAt(pressWindlass(V.press)), ry: Math.PI, seed: 432, colours: { tunic: 0xa8977a } },
    {
      ...tunic, clip: 'carry', props: { L: 'sack' }, at: [3.2, F, 3.6], ry: -Math.PI / 2, seed: 433, colours: { tunic: 0x8a7a5a },
      route: { length: 4.2, speed: 0.8, pauseEnd: 3, pauseStart: 4, clipEnd: 'shoulder', clipStart: 'shoulder', faceEnd: Math.PI, faceStart: Math.PI },
    },
  ];
}
