/**
 * models/religion.js
 * ----------------------------------------------------------------------------
 * The temples, the oracle and the mission post as the game draws them
 * (render3d/models.js MODELS takes these entries as they are): which look a
 * building shows and its state, from the sim's own fields, read only.
 *
 *   temple_<god>        the small temple (models/aedes.js)
 *   temple_large_<god>  the grand temple (models/templum.js)
 *   oracle              the round shrine (models/tholus.js)
 *   mission_post        the shrine of peace with its lodging (models/sacellum.js)
 *
 * Temples are placed often, so a temple is several kits instanced apart
 * (`more`): the body every god's temple of its size shares (podium, cella,
 * roof, altar, doors, the people of the rite), the columns of the god's
 * order (one kit an order, a copy a column), the smoke over the altar; the
 * building's own kit is only what makes it its god's (the painted frieze and
 * pediment, the sculpture, the acroteria, the cult statue, the things at
 * the altar: models/numina.js). A city of forty temples of five gods draws
 * the bodies in one call a part.
 *
 * States (models.js partShows tags):
 *   'open'  staffed: the doors open, the fire on the altar, the priest at it
 *   'shut'  unstaffed: the doors shut, cold ash, nobody
 *   'out'   staffed, and a festival held for its god this month (the
 *           god's monthsSinceFestival back at 0 with a festival held:
 *           sim/religion.js holdFestival): garlands, a big fire and its
 *           smoke, the crowd, the flute player, the victim by the altar
 * The god's mood shows in the smoke: a god angered (sim/religion.js
 * `angered`, from its wrath until its mood climbs back) has a dark, heavy
 * smoke over its altars, an ill omen the player can read across the city.
 * A build ghost shows a temple at work ('open').
 *
 * The oracle has no staff: always 'open', its tripod's fire burning and the
 * spring's vapour rising. The mission post: 'open' staffed (the gate open,
 * the envoys' fire lit, the standard flying), 'shut' unstaffed.
 * ----------------------------------------------------------------------------
 */

import { Group, Matrix4, Vector3 } from 'three';
import { BUILDINGS } from '../../data/buildings.js';
import { NUMEN, GODS } from './numina.js';
import { buildSmoke } from './sacra.js';
import { buildAedesBody, buildAedesGod, buildAedesColumn, AEDES_COLUMNS, AEDES_LAMPS, aedesHearth } from './aedes.js';
import { buildTemplumBody, buildTemplumGod, buildTemplumColumn, buildPorticoColumn, TEMPLUM_COLUMNS, TEMPLUM_LAMPS, PORTICO_COLUMNS, templumHearth } from './templum.js';
import { buildTholus, buildTholusColumn, THOLUS_COLUMNS, THOLUS_LAMPS, tholusVents } from './tholus.js';
import { buildSacellum, SACELLUM_LAMPS, SACELLUM_TREE, SACELLUM_GIFTS } from './sacellum.js';

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3), as models.js reads it. */
const frost = (place) => ((place && place.snow) || 0) >= 2;

/** The small and the grand temples' types, by god. */
export const TEMPLE_TYPES = Object.freeze(GODS.map((g) => `temple_${g}`));
export const GRAND_TYPES = Object.freeze(GODS.map((g) => `temple_large_${g}`));
/** Every religious type drawn as a model. */
export const RELIGION_TYPES = Object.freeze([...TEMPLE_TYPES, ...GRAND_TYPES, 'oracle', 'mission_post']);

/** A god's state in the sim (city.gods[god]), or null. */
function godOf(game, god) {
  return (game && game.city && game.city.gods && game.city.gods[god]) || null;
}

/** A festival of `god` held this month: its months since a festival back at 0 after one was held. */
export function festivalNow(game, god) {
  const s = godOf(game, god);
  return !!s && (s.festivalsHeld || 0) > 0 && s.monthsSinceFestival === 0;
}

/** Is `god` angered (its wrath fallen on the city and its mood not yet calm again)? */
export function godAngry(game, god) {
  const s = godOf(game, god);
  return !!s && !!s.angered;
}

/** A temple's state: 'shut' unstaffed, 'out' staffed in its god's festival month, else 'open'. A ghost (no id) shows 'open'. */
export function templeState(b, game) {
  if (!(b.efficiency > 0)) return 'shut';
  if (b.id === null || b.id === undefined) return 'open';
  return festivalNow(game, BUILDINGS[b.type].god) ? 'out' : 'open';
}

/** The mission post's state: 'open' staffed, else 'shut'. */
export function missionState(b) {
  return b.efficiency > 0 ? 'open' : 'shut';
}

const I = new Matrix4();
/** One matrix (Float32Array of 16) moving a kit to (x, y, z), turned ry about y, scaled s. */
function at(x, y, z, ry = 0, s = 1) {
  const m = new Matrix4().makeRotationY(ry).scale(new Vector3(s, s, s)).setPosition(x, y, z);
  return m.toArray(new Float32Array(16));
}
/** Matrices for kits standing at places [x, z] (or [x, z, ry]) on y. */
function mats(places, y = 0) {
  const out = new Float32Array(places.length * 16);
  const m = new Matrix4();
  places.forEach(([x, z, ry = 0], j) => m.makeRotationY(ry).setPosition(x, y, z).toArray(out, j * 16));
  return out;
}

/**
 * Each temple size: its parts' word (models.js MODEL_PARTS), its body's and
 * columns' builders, the columns' places and floor, the altar's hearth,
 * where the victim stands at a festival, its lamps.
 */
const SIZES = {
  aedes: { body: buildAedesBody, god: buildAedesGod, column: buildAedesColumn, cols: AEDES_COLUMNS, floor: () => 1.35, hearth: aedesHearth, victim: [1.12, 3.62, -Math.PI / 2 - 0.25], lamps: AEDES_LAMPS, extra: [] },
  // (The grand temple's court has its portico's columns too: a kit of their own, instanced.)
  templum: {
    body: buildTemplumBody, god: buildTemplumGod, column: buildTemplumColumn, cols: TEMPLUM_COLUMNS, floor: () => TEMPLUM_COLUMNS.floor, hearth: templumHearth, victim: [1.85, 5.2, -Math.PI / 2 - 0.25], lamps: TEMPLUM_LAMPS,
    extra: [Object.freeze({ key: 'templum:porticus', n: PORTICO_COLUMNS.length, mats: mats(PORTICO_COLUMNS, 0.05), state: 'always' })],
  },
};

/** The farms' pig (models/farm.js FARM_PARTS): a festival's victim, instanced with the farms' herds. */
const VICTIM = 'pig:1:stand';

/** A temple's `more`: its size's body, its order's columns, the smoke over its altar, the victim on a festival (kept by signature). */
const MORE = new Map();
function templeMore(size, god, state, angry) {
  const sig = `${size}|${god}|${state}|${angry ? 1 : 0}`;
  let list = MORE.get(sig);
  if (list) return list;
  const S = SIZES[size];
  const order = NUMEN[god].order;
  const [hx, hy, hz] = S.hearth();
  list = [
    { key: `${size}:body`, n: 1, mats: I.toArray(new Float32Array(16)), state },
    { key: `${size}:col:${order}`, n: S.cols.length, mats: mats(S.cols, S.floor()), state: 'always' },
    ...S.extra,
  ];
  if (state !== 'shut') {
    const kind = angry ? 'wrath' : state === 'out' ? 'thick' : 'thin';
    list.push({ key: `sacra:smoke:${kind}`, n: 1, mats: at(hx, hy + 0.15, hz), state: 'always' });
  }
  if (state === 'out') {
    const [vx, vz, vr] = S.victim;
    list.push({ key: VICTIM, n: 1, mats: at(vx, 0.05, vz, vr), state: 'always' });
  }
  list = Object.freeze(list.map((e) => Object.freeze(e)));
  MORE.set(sig, list);
  return list;
}

/** One temple's entry of MODELS (`size` 'aedes' or 'templum'). */
function templeEntry(size, god) {
  const S = SIZES[size];
  const type = size === 'aedes' ? `temple_${god}` : `temple_large_${god}`;
  return Object.freeze({
    variant: (b, place, ctx) => {
      const game = ctx ? ctx.game : null;
      const state = templeState(b, game);
      const angry = state !== 'shut' && b.id !== null && b.id !== undefined && godAngry(game, god);
      return { key: type, state, ice: false, more: templeMore(size, god, state, angry) };
    },
    // Every material the temples draw is in these: the god's own kit, the shared body and its order's
    // columns, the smoke (one program for the three kinds).
    warm: [type, `${size}:body`, `${size}:col:${NUMEN[god].order}`, 'sacra:smoke:thin', ...S.extra.map((e) => e.key)],
    lamps: (b) => (b.efficiency > 0 ? S.lamps : []),
    build: (key, lod) => S.god(god, { lod }).group,
  });
}

/** The oracle: its own kit, its ring of columns (instanced, each turned to face out), the vapour from the spring. */
const ORACLE_MORE = Object.freeze([
  Object.freeze({ key: 'oracle:col', n: THOLUS_COLUMNS.at.length, mats: mats(THOLUS_COLUMNS.at, THOLUS_COLUMNS.floor), state: 'always' }),
  ...tholusVents().map(([x, y, z, kind]) => Object.freeze({ key: `sacra:smoke:${kind}`, n: 1, mats: at(x, y, z), state: 'always' })),
]);

const ORACLE = Object.freeze({
  // No staff: always at work. In a hard frost its spring is ice.
  variant: (b, place) => ({ key: frost(place) ? 'oracle:ice' : 'oracle', state: 'open', ice: false, more: ORACLE_MORE }),
  warm: ['oracle', 'oracle:col'],
  lamps: () => THOLUS_LAMPS,
  build: (key, lod) => (key.startsWith('oracle:col') ? buildTholusColumn({ lod }).group : buildTholus({ lod, ice: key.endsWith(':ice') }).group),
});

/** The mission post: its own kit, the olive tree in its court (the farms' olive, instanced with theirs). */
const MISSION_MORE = Object.freeze([
  Object.freeze({ key: 'tree:olive:0:leaf:0', n: 1, mats: at(SACELLUM_TREE[0], 0.08, SACELLUM_TREE[1], 0.6, 0.85), state: 'always' }),
  // The gifts for the villages: the warehouse's loads (models/commerce.js), instanced with every store's.
  ...SACELLUM_GIFTS.map(([good, x, z, ry]) => Object.freeze({ key: `warehouse:load:${good}`, n: 1, mats: at(x, 0.04, z, ry), state: 'always' })),
]);

const MISSION = Object.freeze({
  variant: (b) => ({ key: 'mission_post', state: missionState(b), ice: false, more: MISSION_MORE }),
  warm: ['mission_post'],
  lamps: (b) => (b.efficiency > 0 ? SACELLUM_LAMPS : []),
  build: (key, lod) => buildSacellum({ lod }).group,
});

export const RELIGION_MODELS = Object.freeze({
  ...Object.fromEntries(GODS.map((g) => [`temple_${g}`, templeEntry('aedes', g)])),
  ...Object.fromEntries(GODS.map((g) => [`temple_large_${g}`, templeEntry('templum', g)])),
  oracle: ORACLE,
  mission_post: MISSION,
});

/** Build a part of a temple's look by its key: `aedes:body`, `aedes:col:<order>`, the same for `templum`, `sacra:smoke:<kind>`. */
function buildPart(key, lod) {
  const [w, what, arg] = key.split(':');
  if (w === 'sacra') return buildSmoke(arg, lod);
  const S = SIZES[w];
  if (what === 'col') return S.column(arg, { lod }).group;
  if (what === 'porticus') return buildPorticoColumn({ lod }).group;
  return S.body({ lod }).group;
}

/** The temples' parts for models.js MODEL_PARTS, by their key's first word. */
export const RELIGION_PARTS = Object.freeze({
  aedes: Object.freeze({ build: buildPart }),
  templum: Object.freeze({ build: buildPart }),
  sacra: Object.freeze({ build: buildPart }),
});

/**
 * A type's whole look as one Group, as the game shows it (the lab, the
 * tests): its own kit and every kit of its `more` at their places, each
 * mesh shown only where `shows(when, entryState)` says (models.js
 * partShows by its tag). `extra(key, lod)` builds a part the religion
 * module does not own (the farms' pig and olive: the lab passes theirs).
 */
export function religionLook(type, lod, { state = 'open', angry = false, ice = false, shows = null, extra = null } = {}) {
  const g = new Group();
  const def = RELIGION_MODELS[type];
  const b = { id: 1, type, x: 0, y: 0, size: BUILDINGS[type].size, efficiency: state === 'shut' ? 0 : 1 };
  const god = BUILDINGS[type].god;
  const ctx = { game: { city: { gods: god ? { [god]: { festivalsHeld: state === 'out' ? 1 : 0, monthsSinceFestival: 0, angered: angry } } : {} } } };
  const v = def.variant(b, { snow: ice ? 3 : 0 }, ctx);
  const own = def.build(v.key, lod);
  own.traverse((o) => { if (o.isMesh) o.userData.state = v.state; });
  g.add(own);
  for (const e of v.more || []) {
    const w = e.key.split(':')[0];
    const kit = RELIGION_PARTS[w] ? RELIGION_PARTS[w].build(e.key, lod) : e.key === 'oracle:col' ? def.build(e.key, lod) : extra ? extra(e.key, lod) : null;
    if (!kit) continue;
    for (let j = 0; j < e.n; j++) {
      const c = j ? kit.clone() : kit;
      c.matrixAutoUpdate = false;
      c.matrix.fromArray(e.mats, j * 16);
      c.userData.part = e.key;
      c.traverse((o) => { if (o.isMesh) o.userData.state = e.state; });
      g.add(c);
    }
  }
  if (shows) g.traverse((o) => { if (o.isMesh) o.visible = shows(o.userData.when, o.userData.state); });
  return g;
}

/** The triangles a look draws in a state (its own kit and its `more`, what shows in that state). */
export function religionTriangles(type, lod, state = 'open', partShows = null) {
  let n = 0;
  religionLook(type, lod, { state }).traverse((o) => {
    if (!o.isMesh) return;
    if (partShows && !partShows(o.userData.when, o.userData.state, false)) return;
    n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
  });
  return n;
}
