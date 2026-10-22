/**
 * models/wsWeaponsmith.js
 * ----------------------------------------------------------------------------
 * The Weaponsmith (Fabrica) of the 3D look, on the workshop kit
 * (workshopKit.js), from the record of Roman smithing, not from the sprite:
 *
 *   - the forge (the smith's hearth, focus fabrilis): a raised hearth of
 *     stone and clay against the wall, the fire blown with a pair of
 *     bellows (folles) of ox-hide on wooden boards, the blast led through a
 *     clay nozzle (tuyere) into the coals, a hood of clay and rubble above
 *     it taking the smoke up a flue through the roof (the smithies of
 *     Pompeii and the Saalburg; Virgil, Aeneid VIII on the Cyclopes'
 *     bellows and quench);
 *   - the anvil (incus), a block of iron with a horn, on a stump of oak to
 *     the height of the smith's knuckles, as the reliefs of the smith (the
 *     Louvre's, the Ostia reliefs) show it, and the hammer (malleus) and
 *     tongs (forceps);
 *   - the quench trough (the Aeneid's lake of water in which the hot iron
 *     hisses), a stone or timber tank beside the anvil;
 *   - the work: the iron in bars, the swords (gladii) with their wooden
 *     hilts, and the scuta (shields): planked laminations bent to a curve,
 *     faced with felt or leather, painted, bossed in bronze.
 *
 * Layout: the hearth at the back right under the flue, the anvil at the
 * middle, the quench trough beside it, the tools on the back wall, the bar
 * iron stacked in the yard, the shields and swords on racks along the left
 * of the shed.
 *
 * States: 'open' staffed (lantern lit, the hearth glowing and smoking, a
 * smith at the anvil with hammer and tongs, a boy at the bellows), 'shut'
 * not (the hearth black, boards across the front).
 * ----------------------------------------------------------------------------
 */

import { BoxGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { revolve, profileOf, boxUV, tintGeometry } from '../shapes.js';
import { artRng } from '../texgen.js';
import { mound } from './industryKit.js';
import { WsYard, WS, F, WASH, DADO, shed, ground, pegBoard, seg, lin, colour, stone, bx, cyl } from './workshopKit.js';

/** The smithy's measures (metres): the actors, the smoke and the tests read them. */
export const WEAPONSMITH = Object.freeze({
  hearth: Object.freeze({ x: 2.35, z: -2.85, w: 1.4, d: 1.0, top: 0.92 }),
  anvil: Object.freeze({ x: 0.35, z: -1.95, top: 0.9 }),
  trough: Object.freeze({ x: -0.95, z: -1.95 }),
  /** The bellows' handle end (the boy pumps it, clips.js PUMP): where his beam's pivot stands. */
  bellows: Object.freeze({ x: 1.2, z: -2.85, y: 1.1 }),
  /** The flue's top, where the smoke starts. */
  smoke: Object.freeze({ x: 2.35, y: 3.82, z: -3.0, kind: 'thick' }),
  lamp: WS.lamp,
});

const W = WEAPONSMITH;

/** The hearth, its hood and the flue stack through the roof, the coals, the bellows and their pipe. */
function forge(y, lod) {
  const h = W.hearth;
  const n = seg(lod, 6, 5, 4);
  // The hearth: a block of stone with a bowl of coals in the top, a stone wing either side.
  y.add('stone', stone(h.w, h.top, h.d, h.x, F, h.z, { bevel: 0.03, seed: 81, wobble: 0.01, tone: 0.1, grime: 0.6 }));
  y.add('stone', stone(0.12, 0.5, h.d, h.x - h.w / 2 + 0.06, F + h.top, h.z, { bevel: 0.02, seed: 82, wobble: 0.006, tone: 0.1, grime: 0.7 }));
  y.add('stone', stone(0.12, 0.5, h.d, h.x + h.w / 2 - 0.06, F + h.top, h.z, { bevel: 0.02, seed: 83, wobble: 0.006, tone: 0.1, grime: 0.7 }));
  // The coals: dark when shut, a bed of glowing embers when staffed.
  y.add('dark', bx(0.86, 0.05, 0.6, h.x, F + h.top - 0.01, h.z - 0.05, 1), 'shut', false);
  y.add('ember', bx(0.86, 0.06, 0.6, h.x, F + h.top - 0.01, h.z - 0.05, 1), 'open', false);
  if (lod < 2) {
    const rnd = artRng(8);
    const bits = [];
    for (let k = 0; k < (lod === 0 ? 9 : 4); k++) bits.push(colour(bx(0.1 + rnd() * 0.08, 0.06, 0.09, h.x - 0.35 + rnd() * 0.7, F + h.top + 0.04, h.z - 0.3 + rnd() * 0.5, 1), [1, 1, 1], 0.6 + rnd() * 0.3));
    y.add('dark', bits);
  }
  // The hood: a clay pyramid narrowing from the wings' tops to the flue, and the flue stack up through the roof.
  const hoodY = F + h.top + 0.5;
  const hood = new CylinderGeometry(0.27, 0.78, 1.15, 4, 1, true);
  hood.rotateY(Math.PI / 4);
  hood.scale(1, 1, 0.8);
  hood.translate(h.x, hoodY + 0.58, h.z);
  y.add('clay', tintGeometry(boxUV(hood), () => 0.78));
  y.add('clay', bx(0.5, 3.82 - (hoodY + 1.15), 0.5, W.smoke.x, hoodY + 1.15, W.smoke.z, 0.8));
  y.add('clay', bx(0.62, 0.1, 0.62, W.smoke.x, 3.7, W.smoke.z, 0.85));
  // The bellows: two boards hinged at the nozzle, the leather bag between, the handle end toward the boy.
  const b = W.bellows;
  y.add('wood', [bx(0.6, 0.03, 0.46, b.x, b.y - 0.1, b.z, 0.8), bx(0.5, 0.03, 0.4, b.x - 0.02, b.y + 0.22, b.z, 0.8)]);
  y.add('hide', colour(new BoxGeometry(0.55, 0.28, 0.42).translate(b.x, b.y + 0.06, b.z), [1, 1, 1], 0.6));
  y.add('wood', [bx(0.1, b.y - F, 0.5, b.x + 0.1, F, b.z, 0.74)]);
  // The pipe to the hearth and the nozzle in the clay.
  y.add('clay', cyl([b.x + 0.28, b.y + 0.04, b.z], [h.x - h.w / 2 + 0.1, F + h.top + 0.06, h.z], 0.04, 0.03, n));
}

/** The anvil on its stump, the tongs and hammer, and the quench trough. */
function anvilAndTrough(y, lod) {
  const a = W.anvil;
  const n = seg(lod, 12, 8, 6);
  const stump = new CylinderGeometry(0.26, 0.3, 0.6, n, 1);
  stump.translate(a.x, F + 0.3, a.z);
  y.add('bark', tintGeometry(boxUV(stump), (x, yy) => 0.7 + 0.2 * Math.min(1, yy / 0.6)));
  // The anvil: a waisted block with a face, a horn to one side and a heel to the other.
  const body = revolve(profileOf([[0, 0], [0.12, 0], [0.1, 0.1], [0.1, 0.22], [0.15, 0.28], [0.15, 0.3], [0, 0.3]]), { segments: seg(lod, 8, 6, 4), metres: 0.5 });
  body.scale(1.1, 1, 0.85);
  body.translate(a.x, F + 0.6, a.z);
  y.add('iron', body);
  y.add('iron', bx(0.5, 0.06, 0.2, a.x, F + 0.84, a.z, 1.0));
  y.add('iron', cyl([a.x - 0.25, F + 0.87, a.z], [a.x - 0.5, F + 0.87, a.z], 0.075, 0.015, n));
  // Tongs and hammer left on the stump when idle.
  if (lod < 2) {
    y.add('iron', [cyl([a.x + 0.05, F + 0.62, a.z + 0.24], [a.x + 0.45, F + 0.62, a.z + 0.3], 0.012, 0.012, 4), cyl([a.x + 0.05, F + 0.62, a.z + 0.28], [a.x + 0.45, F + 0.62, a.z + 0.3], 0.012, 0.012, 4)], 'shut');
    y.add('wood', cyl([a.x - 0.2, F + 0.62, a.z + 0.3], [a.x + 0.1, F + 0.62, a.z + 0.32], 0.016, 0.016, 4), 'shut');
    y.add('iron', bx(0.14, 0.07, 0.07, a.x + 0.14, F + 0.61, a.z + 0.32, 0.9), 'shut');
  }
  // The quench trough: a box of timber bound with iron, full of water.
  const t = W.trough;
  const tw = 0.95;
  const td = 0.45;
  y.add('wood', [bx(tw, 0.45, 0.06, t.x, F, t.z - td / 2 + 0.03, 0.78), bx(tw, 0.45, 0.06, t.x, F, t.z + td / 2 - 0.03, 0.78), bx(0.06, 0.45, td - 0.12, t.x - tw / 2 + 0.03, F, t.z, 0.78), bx(0.06, 0.45, td - 0.12, t.x + tw / 2 - 0.03, F, t.z, 0.78), bx(tw - 0.1, 0.04, td - 0.1, t.x, F, t.z, 0.7)]);
  y.add('iron', [bx(0.04, 0.47, td + 0.02, t.x - 0.25, F - 0.005, t.z, 0.9), bx(0.04, 0.47, td + 0.02, t.x + 0.25, F - 0.005, t.z, 0.9)]);
  y.add('water', bx(tw - 0.14, 0.01, td - 0.14, t.x, F + 0.38, t.z, 1), 'always', false);
}

/** The tool board on the back wall: tongs, hammers, chisels and punches hung from pegs. */
function tools(y, lod) {
  const zw = WS.zBack + WS.t + 0.02;
  y.add('wood', pegBoard(-3.1, -0.2, zw, 1.7, lod));
  if (lod >= 2) return;
  for (let k = 0; k < 6; k++) {
    const x = -2.95 + k * 0.5;
    if (k % 2) {
      y.add('iron', [cyl([x, 1.62, zw + 0.1], [x - 0.03, 1.12, zw + 0.1], 0.012, 0.012, 4), cyl([x + 0.03, 1.62, zw + 0.1], [x + 0.05, 1.12, zw + 0.1], 0.012, 0.012, 4)]);
    } else {
      y.add('wood', cyl([x, 1.62, zw + 0.1], [x, 1.2, zw + 0.1], 0.017, 0.015, 5));
      y.add('iron', bx(0.14, 0.07, 0.08, x, 1.14, zw + 0.1, 0.9));
    }
  }
}

/** Bar iron laid on sleepers in the yard (the stock's). */
function sleepersFor(y) {
  for (const dx of [-0.45, 0.45]) y.add('wood', bx(0.12, 0.08, 0.7, -2.55 + dx, F, 1.2, 0.7));
}

/** The yard's other things: the charcoal bin by the shed (the fuel, in lumps), the grindstone on its frame and the heap of slag. */
function dressing(y, lod) {
  // The charcoal in a timber bin with a heap standing in it.
  const bin = { x: 3.0, z: -0.6 };
  y.add('wood', [bx(1.1, 0.5, 0.06, bin.x, F, bin.z + 0.45, 0.78), bx(0.06, 0.5, 0.9, bin.x - 0.55, F, bin.z, 0.78), bx(0.06, 0.5, 0.9, bin.x + 0.55, F, bin.z, 0.78)]);
  y.add('dark', colour(mound(0.5, 0.55, 3, lod), [0.5, 0.5, 0.5]).translate(bin.x, F, bin.z - 0.0));
  // The grindstone: a disc in a frame with a crank, a trough under it for the water.
  const g = { x: 0.6, z: 0.5 };
  for (const s of [-1, 1]) y.add('wood', [bx(0.07, 0.7, 0.07, g.x + s * 0.25, F, g.z - 0.25, 0.76), bx(0.07, 0.7, 0.07, g.x + s * 0.25, F, g.z + 0.25, 0.76)]);
  y.add('wood', cyl([g.x - 0.4, F + 0.62, g.z], [g.x + 0.4, F + 0.62, g.z], 0.025, 0.025, 5));
  const disc = new CylinderGeometry(0.3, 0.3, 0.1, seg(lod, 18, 10, 6), 1);
  disc.rotateZ(Math.PI / 2);
  disc.translate(g.x, F + 0.62, g.z);
  y.add('stone', tintGeometry(boxUV(disc), () => 0.85));
  if (lod < 2) y.add('wood', cyl([g.x + 0.4, F + 0.62, g.z], [g.x + 0.4, F + 0.62, g.z - 0.25], 0.02, 0.02, 4));
  y.add('wood', bx(0.5, 0.12, 0.45, g.x, F, g.z, 0.7));
  // The slag heap at the front left, dark and glassy.
  y.add('dark', colour(mound(0.6, 0.4, 9, lod), [0.6, 0.55, 0.55]).translate(-3.1, F, 3.0));
}

/** Build the Weaponsmith: { group, meshes, triangles }. */
export function buildWeaponsmith({ lod = 0 } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const y = new WsYard('weapons_ws', lod);
  ground(y);
  shed(y, lod, { wash: WASH.grey, dado: DADO.oxblood, window: null, seed: 341 });
  forge(y, lod);
  anvilAndTrough(y, lod);
  tools(y, lod);
  sleepersFor(y);
  dressing(y, lod);
  return y.build();
}

/** A scutum: a curved rectangle (the semicylinder's strip) with a bronze boss and a rib, standing on its end, leaning. */
function shield(x, z, k, lod, lean = 0.14) {
  const n = lod === 0 ? 8 : 5;
  const g = new CylinderGeometry(0.5, 0.5, 0.95, n, 1, true, -0.62, 1.24);
  g.translate(0, 0.475, -0.5);
  g.rotateX(-lean);
  g.translate(0, 0, 0.5);
  g.translate(x, F, z);
  const red = [lin(0xa63a2a), lin(0x2c4a7a), lin(0x9a3a2a)][k % 3];
  const wood = tintGeometry(boxUV(g), () => red);
  const boss = new SphereGeometry(0.075, lod === 0 ? 8 : 5, lod === 0 ? 5 : 3, 0, Math.PI * 2, 0, Math.PI / 2);
  boss.rotateX(Math.PI / 2 - lean);
  boss.translate(x, F + 0.48, z + 0.5 - lean * 0.48);
  return { wood, boss };
}

/** A gladius with its hilt and a sheath-less blade, laid on pegs. */
function sword(x, y0, z, lod) {
  return {
    iron: [bx(0.04, 0.5, 0.012, x, y0, z, 1.1)],
    wood: [bx(0.05, 0.12, 0.03, x, y0 - 0.12, z, 0.72), bx(0.1, 0.02, 0.03, x, y0 - 0.0, z, 0.8)],
  };
}

/**
 * The stock. `in` is bar iron on sleepers in the yard (layers of 6, 6, 5, 4
 * bars), `out` the work: shields and swords on the racks along the left of
 * the shed (shields 2, 4, 6; swords 4, 8, 12).
 */
export function buildWeaponsmithStock(kind, step, { lod = 0 } = {}) {
  const y = new WsYard(`weapons_ws_${kind}`, lod);
  if (kind === 'in') {
    const layers = [0, 1, 2, 4][step];
    const rnd = artRng(13);
    const bars = [];
    for (let l = 0; l < layers; l++) {
      const n = [6, 6, 5, 4][l];
      if (lod === 2) {
        // (From far out one slab of bars a layer.)
        bars.push(bx(1.1, 0.05, n * 0.062, -2.55, F + 0.08 + l * 0.052, 1.2, 0.9));
        continue;
      }
      for (let i = 0; i < n; i++) bars.push(bx(1.1, 0.05, 0.05, -2.55 + (rnd() - 0.5) * 0.04, F + 0.08 + l * 0.052, 1.2 + (i - (n - 1) / 2) * 0.062, 0.85 + rnd() * 0.25));
    }
    y.add('iron', bars);
  } else {
    const nSh = [0, 2, 4, 6][step];
    const nSw = [0, 4, 8, 12][step];
    const wood = [];
    const boss = [];
    for (let k = 0; k < nSh; k++) {
      const s = shield(-3.1 + k * 0.5, -3.0, k, lod, 0.16);
      wood.push(s.wood);
      boss.push(s.boss);
    }
    y.add('wood', wood);
    y.add('bronze', boss);
    // The swords on a rack of two rails along the wall above the shields' tops.
    const zw = WS.zBack + WS.t + 0.02;
    y.add('wood', [bx(3.0, 0.04, 0.04, -1.55, 1.38, zw + 0.03, 0.75), bx(3.0, 0.04, 0.04, -1.55, 1.1, zw + 0.03, 0.75)]);
    const ir = [];
    const wd = [];
    for (let k = 0; k < nSw; k++) {
      const s = sword(-3.05 + k * 0.25, 1.15, zw + 0.06, lod);
      ir.push(...s.iron);
      wd.push(...s.wood);
    }
    y.add('iron', ir);
    y.add('wood', wd);
  }
  return y.build();
}

/**
 * The people: the smith at the anvil with hammer and punch, a boy pumping
 * the bellows. Nobody when shut.
 */
export function weaponsmithActors(state) {
  if (state !== 'open') return [];
  const a = W.anvil;
  const b = W.bellows;
  const tunic = { body: 'm', dress: ['tunic:short'], hair: 'crop' };
  return [
    { ...tunic, beard: 'short', clip: 'hammer', props: { R: 'hammer', L: 'chisel' }, at: [a.x, F, a.z + 0.42], ry: Math.PI, seed: 441, colours: { tunic: 0x6e604f } },
    // (The boy faces +x, the hearth: the beam's pivot is PUMP.ahead before him, past the bellows' handle.)
    { body: 'c', scale: 0.82, dress: ['tunic:short'], hair: 'curls', clip: 'pump', props: { R: 'beam' }, at: [b.x - 1.0, F, b.z], ry: Math.PI / 2, seed: 442, colours: { tunic: 0xa8977a } },
  ];
}
