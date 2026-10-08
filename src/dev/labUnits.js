/**
 * labUnits.js
 * ----------------------------------------------------------------------------
 * The look lab's Army scene (the backslash key): every fighting unit of the
 * game as the WebGL renderer draws it in 3D (render3d/units/: the game's own
 * pass, looks, motion and pieces), in cells of open ground, labelled: a legion
 * marching in step round its loop behind its signifer, the line holding before
 * a Gaulish band, legionaries and Gauls at sword's point, archers loosing,
 * cavalry at the gallop, Caesar's men with the eagle and the flag, each people's
 * warriors at their work (the swordsman's cut, the axeman's chop, the sling,
 * the javelin, the spear), the Boii's chariot, a war elephant, gladiators,
 * a village's men, a wolf pack at the lope, wolves resting and biting, and the
 * fallen. The units are made up here; the pass, the motion and the pieces are
 * the game's.
 *
 * L: the level of detail. V: the camera close on the next cell (orbit).
 * window.__lab.army: closeUp(i), cells, where(i), stats(), setLod(n).
 * ----------------------------------------------------------------------------
 */

import { Group, Mesh, PlaneGeometry } from 'three';
import { material } from '../render3d/materials.js';
import { boxUV, tintGeometry } from '../render3d/shapes.js';
import { UnitPass } from '../render3d/units/pass.js';
import { UNIT_TYPES } from '../data/units.js';
import { CONFIG } from '../config.js';

/** Tiles a cell takes, cells a row, metres a tile. */
const CELL = 6;
const COLS = 6;
const TILE = 4;
const TPS = CONFIG.TICKS_PER_SECOND;

/**
 * The cells: [label, note, people, units]; a unit [type, x, y (tiles in the
 * cell), what it does, extra]. What it does: 'march' round a loop (with `w`,
 * `h` its size, `off` its place in a block), 'stand' facing `face`, 'fight'
 * striking toward `face` every cooldown, 'die' falling every few seconds.
 */
const CELLS = [
  ['Legion on the march', 'in step behind the signifer: scutum, pilum, mail, Montefortino', '', [
    ['legionary', 1, 1, 'march', { fort: 1, slot: 0, w: 4, h: 3, off: [0, 0] }],
    ...[1, 2, 3, 4, 5].map((k) => ['legionary', 1, 1, 'march', { fort: 1, slot: k, w: 4, h: 3, off: [((k - 1) % 2) * 0.55 - 0.27, -0.6 - Math.floor((k - 1) / 2) * 0.55] }]),
  ]],
  ['The line holds', 'the shield wall before a Gaulish band', 'gauls', [
    ...[0, 1, 2, 3].map((k) => ['legionary', 1.6 + k * 0.6, 2.2, 'stand', { fort: 2, slot: k + 1, face: [0, -1] }]),
    ...[0, 1, 2].map((k) => ['swordsman', 1.9 + k * 0.7, 0.6, 'stand', { face: [0, 1] }]),
  ]],
  ['Melee', 'gladius and scutum against the long sword', 'gauls', [
    ['legionary', 2, 2.4, 'fight', { fort: 3, slot: 1, face: [0, -1], arms: 'battle' }], ['swordsman', 2, 1.5, 'fight', { face: [0, 1], delay: 9 }],
    ['legionary', 3.3, 2.4, 'fight', { fort: 3, slot: 2, face: [0, -1], delay: 5 }], ['axeman', 3.3, 1.45, 'fight', { face: [0, 1], delay: 13 }],
  ]],
  ['Archers', 'Syrian auxiliaries: conical helmets, scale, the composite bow', '', [0, 1, 2].map((k) => ['archer', 1.5 + k * 1.2, 2.5, 'fight', { face: [0, -1], delay: k * 9 }])],
  ['Cavalry', 'at the gallop: four-horned saddle, oval shield, lance', '', [
    ['cavalry', 1, 1, 'march', { w: 4, h: 3, charge: true, speed: 1 }], ['cavalry', 1, 1, 'march', { w: 4, h: 3, charge: true, speed: 1, lead: 0.5 }],
  ]],
  ["Caesar's legion", 'plate cuirass, white crests; the eagle and the flag', '', [
    ['imperial', 1, 1, 'march', { w: 4, h: 3, id: 5, off: [0, 0] }], ['imperial', 1, 1, 'march', { w: 4, h: 3, id: 12, off: [0.6, 0] }],
    ['imperial', 1, 1, 'march', { w: 4, h: 3, id: 13, off: [0, -0.6] }], ['imperial', 1, 1, 'march', { w: 4, h: 3, id: 14, off: [0.6, -0.6] }],
  ]],
  ['Gauls', 'the long sword and oval shield, the great axe, the light man', 'gauls', [
    ['swordsman', 1.4, 2.4, 'fight', { face: [0, -1] }], ['axeman', 2.9, 2.4, 'fight', { face: [0, -1], delay: 8 }], ['raider', 4.4, 2.4, 'fight', { face: [0, -1], delay: 4 }],
  ]],
  ['Boii war chariot', 'driver and spearman, two ponies', 'boii', [['chariot', 1, 1, 'march', { w: 4, h: 3, charge: true }]]],
  ['Ligurians', 'hillmen: hand axe and small shield; the sling', 'ligurians', [
    ['raider', 1.4, 2.4, 'fight', { face: [0, -1] }], ['slinger', 2.9, 2.6, 'fight', { face: [0, -1], delay: 7 }], ['slinger', 4.4, 2.6, 'fight', { face: [0, -1], delay: 15 }],
  ]],
  ['Carthaginians', 'Libyan spearman, Numidian javelin man and horseman', 'carthaginians', [
    ['hoplite', 1.3, 2.4, 'fight', { face: [0, -1] }], ['javelineer', 2.7, 2.4, 'fight', { face: [0, -1], delay: 11 }], ['horseman', 4.2, 2.6, 'fight', { face: [0, -1], delay: 6 }],
  ]],
  ['War elephant', 'its tower and crew, at a walk', 'carthaginians', [['elephant', 1, 1, 'march', { w: 4, h: 3 }]]],
  ['Lusitanians', 'caetrati: falcata, javelin, horseman', 'lusitanians', [
    ['raider', 1.4, 2.4, 'fight', { face: [0, -1] }], ['javelineer', 2.9, 2.4, 'fight', { face: [0, -1], delay: 8 }], ['horseman', 4.4, 2.6, 'stand', { face: [0, -1] }],
  ]],
  ['Cimbri and Teutones', 'Germanic swordsman and axeman, a horseman', 'cimbri', [
    ['swordsman', 1.4, 2.4, 'fight', { face: [0, -1] }], ['axeman', 2.9, 2.4, 'fight', { face: [0, -1], delay: 10 }], ['horseman', 1, 1, 'march', { w: 4, h: 3, charge: true }],
  ]],
  ['Raiders', 'the band from beyond the frontier', 'barbarians', [
    ['raider', 1.4, 2.4, 'stand', { face: [0, -1] }], ['slinger', 2.9, 2.6, 'fight', { face: [0, -1] }], ['horseman', 4.4, 2.6, 'stand', { face: [0, -1] }],
  ]],
  ['Gladiators in revolt', 'murmillo, thraex, retiarius', '', [
    ['gladiator', 1.4, 2.4, 'fight', { face: [0, -1], id: 300 }], ['gladiator', 2.9, 2.4, 'fight', { face: [0, -1], id: 301, delay: 6 }], ['gladiator', 4.4, 2.4, 'fight', { face: [0, -1], id: 304, delay: 12 }],
  ]],
  ['Villagers', 'a village\'s men: spear, pitchfork, club', '', [
    ['villager', 1.4, 2.4, 'fight', { face: [0, -1], id: 400, attacking: true }], ['villager', 2.9, 2.4, 'fight', { face: [0, -1], id: 401, delay: 7, attacking: true }], ['villager', 4.4, 2.4, 'stand', { face: [0, -1], id: 402, attacking: true }],
  ]],
  ['Wolf pack', 'grey wolves at the lope, hunting', '', [0, 1, 2, 3].map((k) => ['wolf', 1, 1, 'march', { w: 4, h: 3, state: 'hunt', lead: k * 0.09, side: (k % 2 ? 0.4 : -0.4) }])],
  ['Wolves', 'at rest, prowling at a trot, biting', '', [
    ['wolf', 1.3, 2.6, 'stand', { state: 'rest', face: [1, -1] }], ['wolf', 1, 1, 'march', { w: 4, h: 1.2, state: 'prowl', off: [0, -0.2] }], ['wolf', 4.2, 2.6, 'fight', { face: [-1, 0] }],
  ]],
  ['The fallen', 'struck down, lying, then gone', 'gauls', [
    ['legionary', 1.3, 2.3, 'die', { fort: 9, slot: 3, face: [0, -1] }], ['swordsman', 2.6, 2.3, 'die', { face: [0, -1], delay: 2 }], ['cavalry', 4.0, 2.4, 'die', { face: [0, -1], delay: 4 }], ['wolf', 2.4, 1.0, 'die', { face: [1, 0], delay: 6 }],
  ]],
];

const INFO = `<button class="close" type="button" aria-label="Close">Close</button>
<h2>The army</h2>
<p>Every fighting unit of the game as the WebGL renderer draws it in 3D: Rome's legionaries, archers and cavalry, Caesar's
legion, the warriors of each people that raids a province, the war chariot and the elephant, gladiators in revolt, a village's
men, the wolves. Fresh designs from the record: the legionary's Montefortino helmet, mail and painted scutum; the Gaul's long
sword, checked trousers and torc; the Numidian's javelins; the wolf's gait. They march in step, hold the line, strike on the
sim's tick, ride at the gallop, fall and lie dead a while. The game's own pass draws them: one float texture of places a frame,
one instanced draw a piece.</p>
<h3>Controls</h3>
<ul>
<li>Backslash: this scene. L: the level of detail. V: close on the next cell (orbit), and back. 1 to 4: day, golden hour, night,
winter. N: snow; T: rain. M, G, Z: the game's zooms; O: orbit.</li>
</ul>`;

/** The camera scale (device px a world px) that asks the people's level `lod` (modelPass.js peopleLodFor). */
const SCALE_OF = [5, 3, 1];

/** A point `s` tiles round a w x h loop (from its corner, clockwise in map terms), and the way it goes there. */
function loopAt(w, h, s) {
  const P = 2 * (w + h);
  let q = ((s % P) + P) % P;
  if (q < w) return [q, 0, 1, 0];
  q -= w;
  if (q < h) return [w, q, 0, 1];
  q -= h;
  if (q < w) return [w - q, h, -1, 0];
  q -= w;
  return [0, h - q, 0, -1];
}

export function buildArmyScene() {
  const group = new Group();
  group.name = 'army-scene';
  const rows = Math.ceil(CELLS.length / COLS);
  const W = COLS * CELL;
  const H = rows * CELL;
  const ox = (W / 2) * TILE;
  const oz = (H / 2) * TILE;
  const floor = new Mesh(tintGeometry(boxUV(new PlaneGeometry(W * TILE + 8, H * TILE + 8).rotateX(-Math.PI / 2))), material('army-earth', { surface: 'earth', vertexColors: true, snow: 1 }));
  floor.receiveShadow = true;
  group.add(floor);
  const holder = new Group();
  holder.scale.setScalar(TILE);
  holder.position.set(-ox, 0, -oz);
  group.add(holder);
  const pass = new UnitPass(holder);
  let nextId = 1000;
  const cells = CELLS.map(([name, note, people, list], i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const at = [col * CELL + 0.5, row * CELL + 0.5];
    const units = list.map(([type, x, y, does, o = {}]) => {
      const def = UNIT_TYPES[type];
      const id = o.id ?? nextId++;
      const u = {
        id, type, side: def.side, x: at[0] + x, y: at[1] + y, px: at[0] + x, py: at[1] + y, hp: def.hp, maxHp: def.hp, moving: false, walked: 0,
        strikeTick: -99, hitTick: -99, state: o.state || 'idle', fort: o.fort || 0, slot: o.slot || 0, target: 0, attacking: !!o.attacking, facing: 1,
      };
      return { u, does, o, home: [at[0] + x, at[1] + y], born: 0, cell: name };
    });
    return { name, note, people, units, at, x: (at[0] + 2.5) * TILE - ox, z: (at[1] + 2.5) * TILE - oz };
  });
  const all = cells.flatMap((c) => c.units);
  const view = { vt: 0, W, H, x0: -1e6, x1: 1e6, y0: -1e6, y1: 1e6 };
  let lod = 0;
  const life = (t) => {
    const tick = t * TPS;
    // Every unit's state this frame, made up from the clock.
    for (const c of cells) {
      for (const L of c.units) {
        const { u, o } = L;
        const def = UNIT_TYPES[u.type];
        if (L.does === 'march') {
          const pace = def.speed * TPS * (o.speed || 1);
          const s = t * pace + (o.lead || 0) * 2 * (o.w + o.h);
          const [lx, ly, dx, dy] = loopAt(o.w, o.h, s);
          const off = o.off || [0, 0];
          const side = o.side || 0;
          // (A block's place: across the way (dy, -dx) and back along it.)
          const ax = lx + off[0] * -dy + off[1] * dx + side * -dy;
          const ay = ly + off[0] * dx + off[1] * dy + side * dx;
          u.px = u.x; u.py = u.y;
          u.x = c.at[0] + 0.6 + ax;
          u.y = c.at[1] + 0.6 + ay;
          u.moving = true;
          u.walked = (t * pace) % 100;
          L.dir = [dx, dy];
          L.foe = o.charge ? [dx * 2, dy * 2] : null;
          if (o.state) u.state = o.state;
          else if (o.charge) u.state = 'engage';
        } else if (L.does === 'fight') {
          const cd = def.cooldown;
          const ph = ((tick - (o.delay || 0)) % cd + cd) % cd;
          u.strikeTick = Math.floor(tick - ph);
          u.moving = false;
          L.dir = null;
          L.foe = o.face;
          u.state = 'fight';
          u.hitTick = o.delay ? u.strikeTick - Math.floor(cd / 2) : -99;
        } else if (L.does === 'die') {
          // Dies every 9 s (a new man stands there the next instant).
          const period = 9 * TPS;
          const k = Math.floor((tick + (o.delay || 0) * TPS) / period);
          if (L.cycle !== undefined && k !== L.cycle) {
            pass.died({ x: u.x, y: u.y, type: u.type });
            u.id = nextId++;
            // (The next man comes up a few seconds later, not standing in the fallen one's place at once.)
            L.hideUntil = tick + 5 * TPS;
          }
          L.cycle = k;
          u.moving = false;
          L.dir = null;
          L.foe = o.face;
          u.strikeTick = -99;
        } else {
          u.moving = false;
          L.dir = null;
          L.foe = o.face || null;
        }
      }
    }
    pass.begin(SCALE_OF[lod], tick, all.map((L) => L.u), view);
    for (const c of cells) {
      for (const L of c.units) {
        const u = L.u;
        if (L.hideUntil > tick) continue;
        if (!pass.canDraw(u, { people: c.people }, L.foe)) continue;
        pass.add(u, { fx: u.x, fy: u.y, lift: 0, stride: u.walked, vt: 0, W, H, dx: L.dir ? L.dir[0] : 0, dy: L.dir ? L.dir[1] : 0, foe: L.foe });
      }
    }
    pass.end();
  };
  let close = -1;
  return {
    id: 'army',
    title: 'Army',
    key: '\\',
    info: INFO,
    group,
    labels: cells.map((c) => ({ name: c.name, note: c.note, x: c.x, z: c.z - 2 * TILE, y: 4.5 })),
    pass,
    noAO: [pass.group],
    /** Every unit where it is now (metres: the lab's ground), cell by cell: the close-ups aim at them. */
    get figures() {
      return all.map((L) => ({ name: L.cell, type: L.u.type, x: L.u.x * TILE - ox, z: L.u.y * TILE - oz }));
    },
    /** Each cell's name and the index (in figures) of its first unit. */
    cells: cells.map((c) => ({ name: c.name, first: all.indexOf(c.units[0]) })),
    fade: [0, 0, 120, 140],
    lamp: [0, 2.2, 2],
    shadowBox: Math.max(W, H) * TILE * 0.55,
    life,
    get lod() { return lod; },
    setLod(n) { lod = n; },
    onKey(k, api) {
      if (k !== 'v') return false;
      close = close + 1 >= cells.length ? -1 : close + 1;
      if (api) api.closeUp(close < 0 ? -1 : cells[close].units.length ? all.indexOf(cells[close].units[0]) : -1, { dist: 16, el: 26, ty: 1.2, az: 30 });
      return true;
    },
    get close() { return close; },
    /** Where cell i's middle is (metres: the lab's ground), to aim a close-up at it. */
    where(i) {
      const c = cells[i];
      return c ? { x: c.x, z: c.z } : null;
    },
    setTurn() {},
    setWinter() {},
    stats: () => ({ ...pass.stats }),
  };
}
