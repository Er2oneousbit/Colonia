/**
 * models/government.js
 * ----------------------------------------------------------------------------
 * The senate house and the governor's three residences as the game draws
 * them (render3d/models.js MODELS takes these entries as they are): which
 * look a building shows and its state, from the sim's own fields, read only.
 *
 *   senate           the curia (models/curia.js)
 *   governor_house   the Praetorium, an atrium house (models/praetorium.js)
 *   governor_villa   the Praetorium Maius, a house round a great peristyle
 *                    (models/praetoriumMaius.js)
 *   governor_palace  the Regia, a palace round courts (models/regia.js)
 *
 * States (models.js partShows tags):
 *   'open'  staffed (efficiency above 0): in session, or lived in (the
 *           household about, the doors open, the fountains running, the
 *           lamps lit at night)
 *   'shut'  no staff: an empty office, a shuttered house (the sim's
 *           residence gives no desirability unstaffed); the lamps out
 *   'out'   staffed, with trouble close: a mob of rioters on its way to
 *           this very building (sim/crime.js: a rioter's `target`; the
 *           residence is a mob's first choice, the senate its second), or
 *           an enemy within ALARM_TILES of it (raiders, Caesar's legions
 *           marching on the residence, a native warband on the attack, and
 *           wild beasts too, as the town gates shut for them: sim/combat.js
 *           hostileToRome, walls/wallGame.js gateShut): the
 *           doors barred, the household indoors, soldiers at the door
 * A build ghost shows it 'open'.
 *
 * The columns of the porticoes are kits of their own (`more`, one copy a
 * column, instanced across every column of every such building in view):
 * a palace's fifty columns cost the GPU one draw a part, and their
 * geometry is held once. In a hard frost (snow 2 or 3) the residences'
 * pools are ice and their fountains stop (':ice').
 * ----------------------------------------------------------------------------
 */

import { Group, Matrix4 } from 'three';
import { iceMaterial } from '../materials.js';
import { TaggedParts } from './masonry.js';
import { govMaterials, column } from './domus.js';
import { buildCuria, CURIA, CURIA_LAMPS } from './curia.js';
import { buildPraetorium, PRAETORIUM_COLONNADES, PRAETORIUM_LAMPS } from './praetorium.js';
import { buildPraetoriumMaius, PRAETORIUM_MAIUS_COLONNADES, PRAETORIUM_MAIUS_LAMPS } from './praetoriumMaius.js';
import { buildRegia, REGIA_COLONNADES, REGIA_LAMPS } from './regia.js';
import { hostileToRome } from '../../sim/combat.js';

/** How near an enemy (tiles, from the building's middle) puts a residence or the senate on its guard: the town gates' watch. */
export const ALARM_TILES = 14;

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3), as models.js reads it. */
const frost = (place) => ((place && place.snow) || 0) >= 2;

/**
 * The trouble about the city, worked out once a tick: the buildings a mob
 * is making for (rioters' targets) and where the enemies stand. Kept per
 * game, by the tick.
 */
const WATCH = new WeakMap();
function watchOf(game) {
  const tick = game.time ? game.time.totalTicks : 0;
  let w = WATCH.get(game);
  if (w && w.tick === tick) return w;
  const targets = new Set();
  if (game.walkers) {
    for (const v of game.walkers.values()) {
      if (v && !v.dead && v.type === 'rioter' && v.target != null) targets.add(v.target);
    }
  }
  const hostile = [];
  if (game.units) for (const u of game.units.values()) if (u && !u.dead && hostileToRome(u)) hostile.push([u.x, u.y]);
  w = { tick, targets, hostile };
  WATCH.set(game, w);
  return w;
}

/** Is there trouble at `b`: a mob making for it, or an enemy within ALARM_TILES? A ghost (no id) never. */
export function alarmed(game, b) {
  if (!game || b.id === null || b.id === undefined) return false;
  const w = watchOf(game);
  if (w.targets.has(b.id)) return true;
  const cx = b.x + b.size / 2;
  const cy = b.y + b.size / 2;
  const r2 = ALARM_TILES * ALARM_TILES;
  for (const [x, y] of w.hostile) if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) return true;
  return false;
}

/** The state of a senate house or a residence: 'shut' unstaffed, 'out' staffed with trouble close, else 'open'. */
export function governmentState(b, game) {
  if (!(b.efficiency > 0)) return 'shut';
  return alarmed(game, b) ? 'out' : 'open';
}

/**
 * Each type: its builder, its colonnades (order, height from base to
 * abacus, the floor they stand on, their places [x, z] in metres), its
 * lamps (models.js modelLamps), whether it holds water (a frost's ice).
 */
const DEFS = {
  senate: {
    build: buildCuria,
    cols: [{ order: 'corinthian', h: CURIA.colH, y: CURIA.floorY, at: CURIA.cols.map((x) => [x, CURIA.porchZ]) }],
    lamps: CURIA_LAMPS,
    water: false,
  },
  governor_house: { build: buildPraetorium, cols: PRAETORIUM_COLONNADES, lamps: PRAETORIUM_LAMPS, water: true },
  governor_villa: { build: buildPraetoriumMaius, cols: PRAETORIUM_MAIUS_COLONNADES, lamps: PRAETORIUM_MAIUS_LAMPS, water: true },
  governor_palace: { build: buildRegia, cols: REGIA_COLONNADES, lamps: REGIA_LAMPS, water: true },
};

/** The kit key of a colonnade's column: the type, 'col', its index in the type's list. */
const colKey = (type, i) => `${type}:col:${i}`;

/** Each type's `more`: one entry a colonnade, its column kit and a matrix a column (made once). */
const MORE = new Map();
function moreOf(type) {
  let list = MORE.get(type);
  if (list) return list;
  const m = new Matrix4();
  list = Object.freeze(DEFS[type].cols.map((c, i) => {
    const mats = new Float32Array(c.at.length * 16);
    c.at.forEach(([x, z], j) => m.makeTranslation(x, c.y, z).toArray(mats, j * 16));
    return Object.freeze({ key: colKey(type, i), n: c.at.length, mats, state: 'always' });
  }));
  MORE.set(type, list);
  return list;
}

/** A column kit: the column of a type's colonnade `i`, standing on y 0 (its shaft, its capital). */
function buildColumnKit(type, i, lod) {
  const c = DEFS[type].cols[i];
  const m = govMaterials();
  const col = column(c.order, c.h, lod, { smooth: !!c.smooth });
  const p = new TaggedParts(`${type}-column`);
  const stone = c.order === 'pompeian' ? m.stucco : m.marble;
  p.add('column', stone, col.stone);
  p.add('capital', c.order === 'gilt' ? m.gilt : stone === m.stucco ? m.stucco : m.marble, col.cap);
  return p.build().group;
}

/** Names of the parts that hold water (made ice in a hard frost) and of those that run (stopped). */
const STILL = new Set(['water', 'pool']);
const RUNNING = new Set(['jet', 'rings', 'sheet']);

/** A type's look as the game builds it: its own model (its water frozen in ':ice'), or one of its column kits. */
function buildLook(type, key, lod) {
  const [, what, i] = key.split(':');
  if (what === 'col') return buildColumnKit(type, Number(i), lod);
  const g = DEFS[type].build({ lod }).group;
  if (what === 'ice') {
    for (const mesh of [...g.children]) {
      if (STILL.has(mesh.name)) mesh.material = iceMaterial();
      else if (RUNNING.has(mesh.name)) {
        g.remove(mesh);
        mesh.geometry.dispose();
      }
    }
  }
  return g;
}

/** Lamps for models.js modelLamps: lit while staffed (in session, lived in, or under guard). */
function lampsOf(type) {
  const lit = DEFS[type].lamps;
  return (b) => (b.efficiency > 0 ? lit : []);
}

/** One entry of MODELS. */
function entry(type) {
  const d = DEFS[type];
  return Object.freeze({
    variant: (b, place, ctx) => {
      const ice = d.water && frost(place);
      return { key: ice ? `${type}:ice` : type, state: governmentState(b, ctx ? ctx.game : null), ice: false, more: moreOf(type) };
    },
    warm: [type, ...d.cols.map((c, i) => colKey(type, i))],
    lamps: lampsOf(type),
    build: (key, lod) => buildLook(type, key, lod),
  });
}

export const GOVERNMENT_MODELS = Object.freeze(Object.fromEntries(Object.keys(DEFS).map((t) => [t, entry(t)])));

/** The government types drawn as models. */
export const GOVERNMENT_TYPES = Object.freeze(Object.keys(DEFS));

/**
 * A type's whole look as one Group, as the game shows it (the lab, the
 * tests): its model and a copy of its column kit at every column, each
 * mesh shown only in `state` (models.js partShows by its tag, passed in as
 * `shows(when)`).
 */
export function governmentLook(type, lod, { ice = false, shows = null } = {}) {
  const g = new Group();
  const own = buildLook(type, ice && DEFS[type].water ? `${type}:ice` : type, lod);
  g.add(own);
  for (const e of moreOf(type)) {
    const kit = buildLook(type, e.key, lod);
    for (let j = 0; j < e.n; j++) {
      const c = j ? kit.clone() : kit;
      c.matrixAutoUpdate = false;
      c.matrix.fromArray(e.mats, j * 16);
      c.userData.column = true;
      g.add(c);
    }
  }
  if (shows) g.traverse((o) => { if (o.isMesh) o.visible = shows(o.userData.when); });
  return g;
}

/** The triangles a type's look draws at a level of detail (its model and every column), each state's parts counted once. */
export function governmentTriangles(type, lod) {
  let n = 0;
  governmentLook(type, lod).traverse((o) => {
    if (!o.isMesh) return;
    n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
  });
  return n;
}
