/**
 * models/sacredMonuments.js
 * ----------------------------------------------------------------------------
 * The religious monuments and the lighthouse as the game draws them
 * (render3d/models.js MODELS takes these entries as they are): which look a
 * monument shows at each stage of its building and once finished, from the
 * sim's own fields, read only.
 *
 *   fanum_<god>   the Great Sanctuary of each god (models/fanum.js,
 *                 fanumGods.js), its summit temple the god's own kits
 *                 (models/aedes.js builders, numina.js identities)
 *   pantheum      the Pantheon (models/pantheum.js)
 *   pharus        the Lighthouse (models/pharus.js), on the water
 *
 * What the sim says (sim/monuments.js, monumentEffects.js), read here by
 * `sacredView`:
 *   stage    the stage under way (data/monuments.js stages), and how far
 *            along it the work is (work / the stage's work), in quarters:
 *            the kit's timeline `t` = stage + (quarter + 0.5) / 4, so a
 *            site shows what its finished stages built and the stage under
 *            way rising course by course; finished, t = the stages' count
 *   crew     a work camp's crew on the site today (sim/monuments.js
 *            campsOnSite's test, counted once a game tick): the builders
 *            at work (actors); none while halted or without a crew, the
 *            cranes standing still
 *   struck   a site set back by the raid now on (`setbackRaid` is this
 *            raid's key): rubble about it until the raid is over
 *   sacked   a finished monument raiders brought down: closed, rubble,
 *            columns down, its fires out, until it is repaired
 *   open     finished, staffed (and the Pharus fuelled): the fires lit,
 *            the doors open, its people; the Pharus lit at night and
 *            smoking by day; dark without timber or keepers
 *   festival a Great Sanctuary open in its god's festival month: the feast
 *            (models/religion.js festivalNow)
 * A build ghost shows the finished monument at work.
 *
 * Each look is several kits (`more`), instanced apart, so a stage's change
 * builds only the kit that changed: the structure at the timeline's step,
 * the temple's body and the god's kit, the columns (a matrix a column, as
 * many as stand), the site's dressing (the shared construction site:
 * models/worksite.js siteParts), the rubble, the smoke.
 * ----------------------------------------------------------------------------
 */

import { Group, Matrix4, Vector3 } from 'three';
import { BUILDINGS } from '../../data/buildings.js';
import { MONUMENT_TYPES } from '../../data/monuments.js';
import { closedReason } from '../../sim/monumentEffects.js';
import { raidKey } from '../../sim/monuments.js';
import { cast, NOBODY } from '../people/actors.js';
import { NUMEN, GODS } from './numina.js';
import { buildTempleBody, buildTempleGod, buildTempleColumn, templeHearth, templeLamps, templeActors } from './aedes.js';
import { buildSmoke } from './sacra.js';
import { festivalNow } from './religion.js';
import { buildFanum, FANUM, FANUM_TEMPLE, TEMPLE_AT, FANUM_COLUMNS, PORTICO_COLUMNS, templeColumnsAt, porticoColumnsAt, grow } from './fanum.js';
import { godGround, middleTerrace, STAIR_LAMPS } from './fanumGods.js';
import { fanumActors, fanumCrew, fanumSite, buildPorticoColumn } from './fanumPeople.js';
import { buildPantheum, buildPantheumColumn, PANTHEUM, PANTHEUM_COLUMNS, pantheumColumnsAt, pantheumActors, pantheumCrew, pantheumSite, PANTHEUM_LAMPS } from './pantheum.js';
import { buildPharus, PHARUS, pharusActors, pharusCrew, pharusSite } from './pharus.js';
import { buildRuin } from './sacredRuin.js';
import { siteParts } from './siteStub.js';
import { waterSideOf, sideAngle, turnActors, turnPoint, overWater } from './fleet.js';

/** The types drawn here. */
export const FANUM_TYPES = Object.freeze(GODS.map((g) => `fanum_${g}`));
export const SACRED_TYPES = Object.freeze([...FANUM_TYPES, 'pantheum', 'pharus']);

/** Steps a stage's work is shown in. */
export const STEPS = 4;

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3). */
const frost = (place) => ((place && place.snow) || 0) >= 2;

// ---------------------------------------------------------------------------
// The sim's state, read
// ---------------------------------------------------------------------------

/** The crews on each site today, counted once a game tick: site id -> camps whose crew is there. */
const CREWS = { game: null, tick: -1, by: new Map() };
function crewsOn(game, id) {
  if (!game || !game.buildings) return 0;
  const tick = game.time ? game.time.totalTicks : 0;
  if (CREWS.game !== game || CREWS.tick !== tick) {
    CREWS.game = game;
    CREWS.tick = tick;
    CREWS.by = new Map();
    for (const b of game.buildings.values()) {
      const c = b.camp && b.camp.crew;
      if (b.def && b.def.kind === 'work_camp' && c && c.state === 'site') CREWS.by.set(c.site, (CREWS.by.get(c.site) || 0) + 1);
    }
  }
  return CREWS.by.get(id) || 0;
}

/** The step of a stage's work a site shows: its work over the stage's, in quarters (0..3). */
export function stepOf(work, need) {
  if (!(need > 0)) return 0;
  return Math.max(0, Math.min(STEPS - 1, Math.floor((work / need) * STEPS)));
}

/** The timeline a stage and step show: stage + (step + 0.5) / STEPS; finished, the stages' count. */
export function timelineOf(stage, step, n) {
  return stage >= n ? n : stage + (step + 0.5) / STEPS;
}

/**
 * A monument's look from the sim, read only: { n, stage, step, t, key
 * (the timeline's: 'done' or 'stage.step'), finished, crew, halted,
 * struck, sacked, open, lit, festival }.
 */
export function sacredView(b, game = null) {
  const def = BUILDINGS[b.type];
  const n = MONUMENT_TYPES[def.mon].stages.length;
  const ghost = b.id === null || b.id === undefined;
  if (ghost) return { n, stage: n, step: 0, t: n, key: 'done', finished: true, crew: false, halted: false, struck: false, sacked: false, open: true, lit: true, festival: false };
  const m = b.mon || { stage: 0, work: 0, got: {} };
  const stage = Math.max(0, Math.min(n, m.stage | 0));
  const finished = stage >= n;
  const st = finished ? null : MONUMENT_TYPES[def.mon].stages[stage];
  const step = finished ? 0 : stepOf(m.work || 0, st.work);
  const t = timelineOf(stage, step, n);
  const halted = !!m.halted;
  const crew = !finished && !halted && crewsOn(game, b.id) > 0;
  let struck = false;
  if (!finished && m.setbackRaid && game && game.time) {
    try { struck = m.setbackRaid === raidKey(game); } catch { struck = false; }
  }
  const sacked = finished && !!m.sacked;
  const open = finished && !sacked && closedReason({ ...b, def: b.def || def, mon: m }) === null;
  const festival = open && !!def.deity && festivalNow(game, def.deity);
  return { n, stage, step, t, key: finished ? 'done' : `${stage}.${step}`, finished, crew, halted, struck, sacked, open, lit: open, festival };
}

/** The kit state a monument's parts show: a feast, open, or shut (a site, closed, sacked). */
export function partState(v) {
  return v.festival ? 'out' : v.open ? 'open' : 'shut';
}

/** The goods a site has in, as piles: each good of the stage under way 0..3 by its share delivered. */
export function pileLevels(b) {
  const def = BUILDINGS[b.type];
  const m = b.mon;
  if (!m) return {};
  const st = MONUMENT_TYPES[def.mon].stages[m.stage];
  if (!st) return {};
  const out = {};
  for (const [g, need] of Object.entries(st.goods)) out[g] = Math.max(0, Math.min(3, Math.ceil(((m.got[g] || 0) / need) * 3)));
  return out;
}

/** The piles' signature in a kit key: 'clay2.timber1' (goods in order). */
function pileSig(levels) {
  return Object.entries(levels).filter(([, n]) => n > 0).map(([g, n]) => `${g}${n}`).join('.') || '-';
}
function pileParse(sig) {
  if (!sig || sig === '-') return {};
  const out = {};
  for (const s of sig.split('.')) {
    const m = /^([a-z]+)(\d)$/.exec(s);
    if (m) out[m[1]] = Number(m[2]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Matrices
// ---------------------------------------------------------------------------

const I16 = new Matrix4().toArray(new Float32Array(16));
function at(x, y, z, ry = 0, s = 1) {
  return new Matrix4().makeRotationY(ry).scale(new Vector3(s, s, s)).setPosition(x, y, z).toArray(new Float32Array(16));
}
/** Matrices for places [x, z, ry?] on y, offset by (ox, oz) and turned with `pre` (16 floats) if given. */
function mats(places, y, ox = 0, oz = 0, pre = null) {
  const out = new Float32Array(places.length * 16);
  const m = new Matrix4();
  const p = pre ? new Matrix4().fromArray(pre) : null;
  places.forEach(([x, z, ry = 0], j) => {
    m.makeRotationY(ry).setPosition(x + ox, y, z + oz);
    if (p) m.premultiply(p);
    m.toArray(out, j * 16);
  });
  return out;
}

/** Kept lists by signature (a few in a city: one monument). */
const KEPT = new Map();
function kept(sig, make) {
  let v = KEPT.get(sig);
  if (v === undefined) {
    if (KEPT.size > 256) KEPT.clear();
    v = make();
    KEPT.set(sig, v);
  }
  return v;
}

/** A cast kept by signature. */
function castOf(sig, make) {
  return kept(`cast|${sig}`, () => {
    const list = make();
    return list.length ? cast(list) : NOBODY;
  });
}

// ---------------------------------------------------------------------------
// The Great Sanctuaries
// ---------------------------------------------------------------------------

/** The sacked's fallen columns: which of the temple's and the porticoes' are down. */
const FALLEN_TEMPLE = new Set([1, 4]);
const FALLEN_PORTICO = new Set([2, 3, 8]);

/** A Great Sanctuary's `more` for its view. */
function fanumMore(god, v, levels) {
  const sig = `fanum|${god}|${v.key}|${partState(v)}|${v.struck ? 1 : 0}|${v.sacked ? 1 : 0}|${pileSig(levels)}`;
  return kept(sig, () => {
    const order = NUMEN[god].order;
    const state = partState(v);
    const [ox, oy, oz] = TEMPLE_AT;
    const list = [];
    const tCols = FANUM_COLUMNS.slice(0, templeColumnsAt(v.t)).filter((_, i) => !v.sacked || !FALLEN_TEMPLE.has(i));
    if (tCols.length) list.push({ key: `fanum:col:${order}`, n: tCols.length, mats: mats(tCols, oy + FANUM_TEMPLE.floorY, ox, oz), state: 'always' });
    const pCols = PORTICO_COLUMNS.slice(0, porticoColumnsAt(v.t)).filter((_, i) => !v.sacked || !FALLEN_PORTICO.has(i));
    if (pCols.length) list.push({ key: `fanum:pcol:${order}`, n: pCols.length, mats: mats(pCols, FANUM.t3.y), state: 'always' });
    if (v.t >= 3) {
      // The temple whole: the god's temple's body and the god's own kit (aedes.js builders, these measures).
      list.push({ key: 'fanum:body', n: 1, mats: at(ox, oy, oz), state });
      list.push({ key: `fanum:god:${god}`, n: 1, mats: at(ox, oy, oz), state });
    }
    if (v.open) {
      const [hx, hy, hz] = templeHearth(FANUM_TEMPLE);
      list.push({ key: `sacra:smoke:${v.festival ? 'thick' : 'thin'}`, n: 1, mats: at(ox + hx, oy + hy + 0.15, oz + hz), state: 'always' });
    }
    if (!v.finished) {
      list.push({ key: `fanum:site:${v.key}:${pileSig(levels)}`, n: 1, mats: I16, state: 'always' });
      // Wine and oil for the dedication come in amphorae: the warehouses' loads.
      for (const [good, spot] of [['wine', [-7.6, 8.6, 0.3]], ['oil', [7.4, 8.6, -0.4]]]) {
        const k = levels[good] || 0;
        if (k) list.push({ key: `warehouse:load:${good}`, n: k, mats: mats(Array.from({ length: k }, (_, i) => [spot[0] + i * 1.05 * Math.sign(-spot[0]), spot[1], spot[2]]), 0), state: 'always' });
      }
    }
    if (v.struck || v.sacked) list.push({ key: `fanum:ruin:${v.sacked ? 'done' : v.stage}`, n: 1, mats: I16, state: 'always' });
    return Object.freeze(list.map((e) => Object.freeze(e)));
  });
}

/** A Great Sanctuary's lamps: the temple's altar and lampstands and the stair's, while it is open. */
const FANUM_LAMPS = Object.freeze([
  ...templeLamps(FANUM_TEMPLE).map(([x, y, z, s]) => Object.freeze([x + TEMPLE_AT[0], y + TEMPLE_AT[1], z + TEMPLE_AT[2], s])),
  ...STAIR_LAMPS.map(([x, y, z]) => Object.freeze([x, y, z, 1])),
]);

function fanumEntry(god) {
  const type = `fanum_${god}`;
  const order = NUMEN[god].order;
  return Object.freeze({
    variant(b, place, ctx) {
      const game = ctx ? ctx.game : null;
      const v = sacredView(b, game);
      const levels = v.finished ? {} : pileLevels(b);
      const more = fanumMore(god, v, levels);
      const state = partState(v);
      const actors = v.finished
        ? (v.open ? castOf(`fanum|${god}|${state}`, () => fanumActors(god, state)) : NOBODY)
        : (v.crew ? castOf(`fanum-crew|${v.stage}`, () => fanumCrew(v.stage)) : NOBODY);
      return { key: `${type}:${v.key}`, state, ice: false, more, actors };
    },
    warm: [`${type}:done`, 'fanum:body', `fanum:god:${god}`, `fanum:col:${order}`, `fanum:pcol:${order}`, 'sacra:smoke:thin'],
    lamps: (b) => (sacredView(b, null).open ? FANUM_LAMPS : []),
    build(key, lod) {
      const tk = key.split(':')[1];
      const t = tk === 'done' ? 4 : timeOfKey(tk);
      const ground = godGround(god);
      return buildFanum(god, t, { lod, extra: (out, tt, l) => { ground(out, tt, l); middleTerrace(out, tt, l); } }).group;
    },
  });
}

/** The timeline of a kit's step key ('2.1'). */
function timeOfKey(tk) {
  const [s, q] = tk.split('.').map(Number);
  return s + ((q || 0) + 0.5) / STEPS;
}

/** The sanctuaries' shared kits by key: the temple's body, each god's kit, the columns, the site, the rubble. */
function buildFanumPart(key, lod) {
  const [, what, a, b] = key.split(':');
  if (what === 'body') return buildTempleBody(FANUM_TEMPLE, { lod, skipPaving: () => true }).group;
  if (what === 'god') return buildTempleGod(FANUM_TEMPLE, a, { lod }).group;
  if (what === 'col') return buildTempleColumn('fanum', a, FANUM_TEMPLE.colH, { lod }).group;
  if (what === 'pcol') return buildPorticoColumn(a, { lod }).group;
  if (what === 'site') return siteGroup(fanumSite(timeOfKey(a), pileParse(b)), lod);
  if (what === 'ruin') return buildRuin('fanum', a === 'done' ? 4 : Number(a), lod).group;
  return new Group();
}

// ---------------------------------------------------------------------------
// The Pantheon
// ---------------------------------------------------------------------------

const FALLEN_PANTHEUM = new Set([2, 5, 11]);

function pantheumMore(v, levels) {
  const sig = `pantheum|${v.key}|${partState(v)}|${v.struck ? 1 : 0}|${v.sacked ? 1 : 0}|${pileSig(levels)}`;
  return kept(sig, () => {
    const list = [];
    const n = pantheumColumnsAt(v.t);
    for (const shade of ['grey', 'pink']) {
      const cols = PANTHEUM_COLUMNS.filter((c, i) => c[3] === shade && i < n && !(v.sacked && FALLEN_PANTHEUM.has(i)));
      if (cols.length) list.push({ key: `pantheum:col:${shade}`, n: cols.length, mats: mats(cols.map(([x, z]) => [x, z]), PANTHEUM.floorY), state: 'always' });
    }
    if (!v.finished) list.push({ key: `pantheum:site:${v.key}:${pileSig(levels)}`, n: 1, mats: I16, state: 'always' });
    if (!v.finished) {
      for (const [good, spot] of [['wine', [-8.2, 8.9, 0.2]], ['oil', [8.2, 8.9, -0.3]]]) {
        const k = levels[good] || 0;
        if (k) list.push({ key: `warehouse:load:${good}`, n: k, mats: mats(Array.from({ length: k }, (_, i) => [spot[0] + i * 1.05 * Math.sign(-spot[0]), spot[1], spot[2]]), 0), state: 'always' });
      }
    }
    if (v.struck || v.sacked) list.push({ key: `pantheum:ruin:${v.sacked ? 'done' : v.stage}`, n: 1, mats: I16, state: 'always' });
    return Object.freeze(list.map((e) => Object.freeze(e)));
  });
}

const PANTHEUM_ENTRY = Object.freeze({
  variant(b, place, ctx) {
    const game = ctx ? ctx.game : null;
    const v = sacredView(b, game);
    const levels = v.finished ? {} : pileLevels(b);
    const state = partState(v);
    const actors = v.finished
      ? (v.open ? castOf(`pantheum|${state}`, () => pantheumActors(state)) : NOBODY)
      : (v.crew ? castOf(`pantheum-crew|${v.stage}`, () => pantheumCrew(v.stage)) : NOBODY);
    return { key: `pantheum:${v.key}`, state, ice: false, more: pantheumMore(v, levels), actors };
  },
  warm: ['pantheum:done', 'pantheum:col:grey', 'pantheum:col:pink'],
  lamps: (b) => (sacredView(b, null).open ? PANTHEUM_LAMPS : []),
  build(key, lod) {
    const [, tk, a, b] = key.split(':');
    if (tk === 'col') return buildPantheumColumn(a, { lod }).group;
    if (tk === 'site') return siteGroup(pantheumSite(timeOfKey(a), pileParse(b)), lod);
    if (tk === 'ruin') return buildRuin('pantheum', a === 'done' ? 5 : Number(a), lod).group;
    return buildPantheum(tk === 'done' ? 5 : timeOfKey(tk), { lod }).group;
  },
});

// ---------------------------------------------------------------------------
// The Lighthouse
// ---------------------------------------------------------------------------

/** The matrix that turns a model built facing +z to face its water `side` (16 floats). */
const SIDE_MATS = [0, 1, 2, 3].map((s) => new Matrix4().makeRotationY(sideAngle(s)).toArray(new Float32Array(16)));

/** The fire's lamp (high on the tower, seen from every side: given facing both ways). */
const PHARUS_LAMPS = [0, 1, 2, 3].map((s) => {
  const [x, y, z] = turnPoint(PHARUS.fire, s);
  return Object.freeze([Object.freeze([x, y + 0.3, z, 1]), Object.freeze([x, y + 0.3, z, -1])]);
});

function pharusMore(side, v, ice, levels) {
  const sig = `pharus|${side}|${v.key}|${v.lit ? 1 : 0}|${ice ? 1 : 0}|${v.struck ? 1 : 0}|${v.sacked ? 1 : 0}|${pileSig(levels)}`;
  return kept(sig, () => {
    const M = SIDE_MATS[side];
    const state = v.lit ? 'open' : 'shut';
    const list = [{ key: `pharus:${v.key}${ice ? ':ice' : ''}`, n: 1, mats: M, state }];
    if (v.lit) {
      // By day the fire's smoke over the tower's top, a big one (the altars' thick smoke, twice the size).
      const [x, y, z] = PHARUS.fire;
      const m = new Matrix4().fromArray(M).multiply(new Matrix4().makeScale(1.9, 1.9, 1.9).setPosition(x, y + 0.45, z));
      list.push({ key: 'sacra:smoke:thick', n: 1, mats: m.toArray(new Float32Array(16)), state: 'always' });
    }
    if (!v.finished) list.push({ key: `pharus:site:${v.key}:${pileSig(levels)}`, n: 1, mats: M, state: 'always' });
    if (v.struck || v.sacked) list.push({ key: `pharus:ruin:${v.sacked ? 'done' : v.stage}`, n: 1, mats: M, state: 'always' });
    return Object.freeze(list.map((e) => Object.freeze(e)));
  });
}

const PHARUS_ENTRY = Object.freeze({
  // (An older save's lighthouse wholly on land keeps its sprite, as the fleet's buildings do.)
  fits: overWater,
  variant(b, place, ctx) {
    const game = ctx ? ctx.game : null;
    const side = waterSideOf(b, ctx);
    const v = sacredView(b, game);
    const ice = frost(place);
    const levels = v.finished ? {} : pileLevels(b);
    const state = v.lit ? 'open' : 'shut';
    const actors = v.finished
      ? (v.open ? castOf(`pharus|${side}`, () => turnActors(pharusActors(), side)) : NOBODY)
      : (v.crew ? castOf(`pharus-crew|${side}|${v.stage}`, () => turnActors(pharusCrew(v.stage), side)) : NOBODY);
    return { key: 'pharus:none', state, ice: false, more: pharusMore(side, v, ice, levels), actors };
  },
  warm: ['pharus:done', 'sacra:smoke:thick'],
  lamps: (b) => (sacredView(b, null).lit ? PHARUS_LAMPS[waterSideOf(b, null)] : []),
  build(key, lod) {
    const [, tk, a, b] = key.split(':');
    if (tk === 'none') return new Group();
    if (tk === 'site') return siteGroup(pharusSite(timeOfKey(a), pileParse(b)), lod);
    if (tk === 'ruin') return buildRuin('pharus', a === 'done' ? 4 : Number(a), lod).group;
    return buildPharus(tk === 'done' ? 4 : timeOfKey(tk), { lod, ice: a === 'ice' }).group;
  },
});

// ---------------------------------------------------------------------------
// The site's dressing (the shared construction site)
// ---------------------------------------------------------------------------

/**
 * The shared site's parts for a spec, as a Group. The site's things stand
 * on the model's ground; a monument's terraces put some higher (a
 * scaffold against the top face stands on the middle terrace), so each
 * level's things (`y`, the height they stand on: 0 when not given) are
 * made apart and lifted, whatever siteParts makes of the rest. Its crew
 * are the monument's actors, not geometry.
 */
export function siteGroup(spec, lod) {
  const levels = new Map();
  for (const list of ['scaffolds', 'cranes', 'centering', 'piles']) {
    for (const it of spec[list] || []) {
      const y = it.y || 0;
      let L = levels.get(y);
      if (!L) {
        L = { scaffolds: [], cranes: [], centering: [], piles: [], crew: [] };
        levels.set(y, L);
      }
      const { y: _y, ...rest } = it;
      L[list].push(rest);
    }
  }
  const g = new Group();
  for (const [y, L] of levels) {
    const r = siteParts(L, lod);
    const part = r && r.isObject3D ? r : r.group;
    part.position.y = y;
    g.add(part);
  }
  return g;
}

export const SACRED_MODELS = Object.freeze({
  ...Object.fromEntries(GODS.map((g) => [`fanum_${g}`, fanumEntry(g)])),
  pantheum: PANTHEUM_ENTRY,
  pharus: PHARUS_ENTRY,
});

/** The sanctuaries' parts for models.js MODEL_PARTS, by their key's first word. */
export const SACRED_PARTS = Object.freeze({
  fanum: Object.freeze({ build: buildFanumPart }),
});

// ---------------------------------------------------------------------------
// For the lab and the tests
// ---------------------------------------------------------------------------

/**
 * A stand-in building for the lab and the tests: `type` at `stage` and
 * `work` share (0..1) with goods `got`, finished or not, staffed, its
 * store, sacked, halted. The sim's own fields, as a building carries them.
 */
export function standIn(type, { id = 1, stage = null, share = 0.5, got = null, staffed = true, store = true, sacked = false, halted = false, x = 0, y = 0, waterSide = 2 } = {}) {
  const def = BUILDINGS[type];
  const T = MONUMENT_TYPES[def.mon];
  const n = T.stages.length;
  const s = stage === null ? n : Math.min(n, stage);
  const st = T.stages[s];
  const mon = { stage: s, work: st ? st.work * share : 0, got: got || (st ? Object.fromEntries(Object.entries(st.goods).map(([g, need]) => [g, need * Math.min(1, share + 0.3)])) : {}), way: {}, paid: true, halted, store: store && T.store ? T.store.cap : 0, sacked, wasOpen: false };
  return { id, type, def, x, y, size: def.size, turn: 0, efficiency: staffed ? 1 : 0, mon, waterRows: def.placement === 'shore' ? 2 : 0, waterSide };
}

void FANUM_TYPES;
void grow;
void templeActors;
