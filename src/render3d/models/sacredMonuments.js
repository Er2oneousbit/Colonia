/**
 * models/sacredMonuments.js
 * ----------------------------------------------------------------------------
 * The religious monuments and the lighthouse as the game draws them
 * (render3d/models.js MODELS takes these entries as they are): which look a
 * monument shows at each stage of its building and once finished, from the
 * sim's own fields, read only.
 *
 *   fanum_<god>   the Great Sanctuary of each god (models/fanum.js,
 *                 fanumGods.js, fanumPeople.js), its summit temple the
 *                 god's own kits (models/aedes.js builders, numina.js)
 *   pantheum      the Pantheon (models/pantheum.js)
 *   pharus        the Lighthouse (models/pharus.js), on the water
 *
 * What the sim says (sim/monuments.js, monumentEffects.js), read here by
 * `sacredView`:
 *   stage    the stage under way (data/monuments.js stages), and how far
 *            along it the work is (work over the stage's work), in quarters:
 *            the kit's timeline `t` = stage + (quarter + 0.5) / 4, so a
 *            site shows what its finished stages built and the stage under
 *            way rising course by course; finished, t = the stages' count
 *   crew     a work camp's crew on the site today (its crew's record,
 *            counted once a game tick): the builders at work (actors), the
 *            treadwheels turning and lifting (worksite.js siteMotion); none
 *            while halted or without a crew, the cranes standing still
 *   piles    the goods delivered and not yet built in (worksite.js siteView)
 *   struck   a site set back by the raid now on: rubble about it until the
 *            raid is over (models/sacredRuin.js)
 *   sacked   a finished monument raiders brought down: closed, rubble,
 *            columns down, its fires out, until it is repaired
 *   open     finished, staffed (and the Pharus fuelled): the fires lit, the
 *            doors open, its people; the Pharus lit at night and smoking by
 *            day; dark without timber or keepers
 *   festival a Great Sanctuary open in its god's festival month: the feast
 *            (models/religion.js festivalNow)
 * A build ghost shows the finished monument at work.
 *
 * Each look is several kits (`more`), instanced apart, so a stage's change
 * builds only the kit that changed: the structure at the timeline's step,
 * the temple's body and the god's kit, the columns (a matrix a column, as
 * many as stand), the site's dressing (the shared construction site,
 * models/worksite.js), its turning wheels, the rubble, the smoke.
 * ----------------------------------------------------------------------------
 */

import { Group, Matrix4, Vector3 } from 'three';
import { BUILDINGS } from '../../data/buildings.js';
import { MONUMENT_TYPES } from '../../data/monuments.js';
import { closedReason } from '../../sim/monumentEffects.js';
import { raidKey } from '../../sim/monuments.js';
import { cast, NOBODY } from '../people/actors.js';
import { NUMEN, GODS } from './numina.js';
import { buildTempleBody, buildTempleGod, buildTempleColumn, templeHearth, templeLamps } from './aedes.js';
import { festivalNow } from './religion.js';
import { buildFanum, FANUM, FANUM_TEMPLE, TEMPLE_AT, FANUM_COLUMNS, PORTICO_COLUMNS, templeColumnsAt, porticoColumnsAt } from './fanum.js';
import { godGround, middleTerrace, STAIR_LAMPS } from './fanumGods.js';
import { fanumActors, fanumCrew, fanumSite, buildPorticoColumn } from './fanumPeople.js';
import { buildPantheum, buildPantheumColumn, PANTHEUM, PANTHEUM_COLUMNS, FORE_COLUMNS, pantheumColumnsAt, pgrow, pantheumActors, pantheumCrew, pantheumSite, PANTHEUM_LAMPS } from './pantheum.js';
import { buildPharus, buildPharusWood, PHARUS, pharusActors, pharusCrew, pharusSite } from './pharus.js';
import { buildRuin } from './sacredRuin.js';
import { siteGroup as worksiteGroup, siteMotion, siteActors, siteView } from './worksite.js';
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

/** The step of a stage's work a site shows: its work over the stage's, in quarters (0..3). */
export function stepOf(work, need) {
  if (!(need > 0)) return 0;
  return Math.max(0, Math.min(STEPS - 1, Math.floor((work / need) * STEPS + 1e-9)));
}

/** The timeline a stage and step show: stage + (step + 0.5) / STEPS; finished, the stages' count. */
export function timelineOf(stage, step, n) {
  return stage >= n ? n : stage + (step + 0.5) / STEPS;
}

/** The timeline of a kit's step key ('2.1'; 'done' is the stages' count `n`). */
export function timeOfKey(tk, n) {
  if (tk === 'done') return n;
  const [s, q] = tk.split('.').map(Number);
  return s + ((q || 0) + 0.5) / STEPS;
}

/**
 * A monument's look from the sim, read only: { n, stage, step, t, key
 * (the timeline's: 'done' or 'stage.step'), finished, crew, halted,
 * struck, sacked, open, lit, festival, stock (loads on site by good) }.
 * The site's own reading (worksite.js siteView) gives the step, the crew,
 * the setback and the goods; the finished monument's open and sacked are
 * the sim's closedReason.
 */
export function sacredView(b, game = null) {
  const def = BUILDINGS[b.type];
  const n = MONUMENT_TYPES[def.mon].stages.length;
  const ghost = b.id === null || b.id === undefined;
  if (ghost || !b.mon) {
    const done = ghost;
    return { n, stage: done ? n : 0, step: 0, t: done ? n : timelineOf(0, 0, n), key: done ? 'done' : '0.0', finished: done, crew: false, halted: false, struck: false, sacked: false, open: done, lit: done, festival: false, stock: {} };
  }
  const s = siteView({ ...b, def: b.def || def }, game);
  const finished = s.finished;
  const t = timelineOf(s.stage, s.step, n);
  const open = finished && !s.sacked && s.open;
  const festival = open && !!def.deity && festivalNow(game, def.deity);
  return {
    n, stage: s.stage, step: s.step, t, key: finished ? 'done' : `${s.stage}.${s.step}`, finished,
    crew: !finished && s.crew, halted: s.halted, struck: !finished && s.struck, sacked: finished && s.sacked, open, lit: open, festival, stock: s.stock,
  };
}

/** The kit state a monument's parts show: a feast, open, or shut (a site, closed, sacked). */
export function partState(v) {
  return v.festival ? 'out' : v.open ? 'open' : 'shut';
}

/** The piles' signature in a kit key: 'clay2.timber1' (goods in order, loads 1..9). */
export function pileSig(stock) {
  return Object.keys(stock || {}).sort().filter((g) => stock[g] > 0).map((g) => `${g}${stock[g]}`).join('.') || '-';
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
// Matrices and kept lists
// ---------------------------------------------------------------------------

const I16 = new Matrix4().toArray(new Float32Array(16));
function at(x, y, z, ry = 0, s = 1) {
  return new Matrix4().makeRotationY(ry).scale(new Vector3(s, s, s)).setPosition(x, y, z).toArray(new Float32Array(16));
}
/** Matrices for places [x, z, ry?] on y, offset by (ox, oz), turned by `pre` (16 floats) if given. */
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

/** Lists, casts and site specs kept by signature (a city has one monument: a handful). */
const KEPT = new Map();
function kept(sig, make) {
  let v = KEPT.get(sig);
  if (v === undefined) {
    if (KEPT.size > 512) KEPT.clear();
    v = make();
    KEPT.set(sig, v);
  }
  return v;
}

function castOf(sig, make) {
  return kept(`cast|${sig}`, () => {
    const list = make();
    return list.length ? cast(list) : NOBODY;
  });
}

// ---------------------------------------------------------------------------
// The building site (the shared construction site, worksite.js)
// ---------------------------------------------------------------------------

/** The site specs by monument: (t, piles, crew) -> spec in the model's metres, its cranes at work with a crew. */
const SITES = {
  fanum: (t, piles) => fanumSite(t, piles),
  pantheum: (t, piles) => pantheumSite(t, piles),
  pharus: (t, piles) => pharusSite(t, piles),
};

/** A site's spec, kept by its key (the same object every frame: the moving cranes' lists are kept by it). */
function siteSpec(word, tk, n, sig, crew) {
  return kept(`site|${word}|${tk}|${sig}|${crew ? 1 : 0}`, () => {
    const s = SITES[word](timeOfKey(tk, n), pileParse(sig));
    for (const c of s.cranes) c.work = !!crew;
    return s;
  });
}

/**
 * The shared site's things split by the height they stand on (`y`: a
 * scaffold against the top face stands on the middle terrace, the
 * lighthouse's crane on its quay): the shared site stands everything on
 * the model's ground, so each level is made apart and lifted. Centering
 * keeps its own `y` (its springing). Kept by spec: [{ y, site }].
 */
const LEVELS = new WeakMap();
function levelsOf(spec) {
  let out = LEVELS.get(spec);
  if (out) return out;
  const by = new Map();
  const level = (y) => {
    let L = by.get(y);
    if (!L) {
      L = { scaffolds: [], cranes: [], centering: [], piles: [], rubble: [], mortar: [] };
      by.set(y, L);
    }
    return L;
  };
  for (const list of ['scaffolds', 'cranes', 'piles', 'rubble', 'mortar']) {
    for (const it of spec[list] || []) {
      const { y = 0, ...rest } = it;
      level(y)[list].push(rest);
    }
  }
  for (const c of spec.centering || []) level(0).centering.push(c);
  out = [...by.entries()].map(([y, site]) => ({ y, site }));
  LEVELS.set(spec, out);
  return out;
}

/** The site's dressing as one Group: each level's things made by the shared site and lifted to their level. */
export function siteKit(spec, lod) {
  const g = new Group();
  for (const { y, site } of levelsOf(spec)) {
    const part = worksiteGroup(site, lod);
    part.position.y = y;
    g.add(part);
  }
  return g;
}

/** The site's people: the stage's crew and the men its working cranes need (worksite.js siteActors), on their levels. */
function siteCrew(spec, crew) {
  const out = [...crew];
  for (const { y, site } of levelsOf(spec)) {
    for (const a of siteActors({ cranes: site.cranes })) out.push({ ...a, at: [a.at[0], a.at[1] + y, a.at[2]] });
  }
  return out;
}

const _a = new Matrix4();
const _b = new Matrix4();
const _pre = new Matrix4();
/**
 * The turning wheels and rising loads of a site's working cranes now
 * (worksite.js siteMotion), lifted to their levels and turned by `pre` (a
 * waterside building's side): `more` entries kept per spec, their
 * matrices refilled in place each call.
 */
const MOTION = new WeakMap();
function motionOf(spec, clock, pre) {
  let e = MOTION.get(spec);
  if (!e) {
    e = { parts: [] };
    for (const { y, site } of levelsOf(spec)) {
      if (!site.cranes.some((c) => c.work && c.kind !== 'shear')) continue;
      e.parts.push({ y, site: { cranes: site.cranes }, own: new Map() });
    }
    e.list = [];
    MOTION.set(spec, e);
  }
  if (!e.parts.length) return e.list;
  e.list.length = 0;
  _pre.fromArray(pre || I16);
  for (const part of e.parts) {
    for (const it of siteMotion(part.site, clock)) {
      let o = part.own.get(it.key);
      if (!o || o.mats.length < it.mats.length) {
        o = { key: it.key, n: 0, mats: new Float32Array(it.mats.length), state: 'always' };
        part.own.set(it.key, o);
      }
      o.n = it.n;
      for (let j = 0; j < it.n; j++) {
        _a.fromArray(it.mats, j * 16);
        _b.makeTranslation(0, part.y, 0).multiply(_a).premultiply(_pre).toArray(o.mats, j * 16);
      }
      if (o.n) e.list.push(o);
    }
  }
  return e.list;
}

/** A look's `more`: its kept base list and the moving cranes' (a list joined once per base, refilled in place). */
const JOINED = new WeakMap();
function withMotion(base, spec, clock, pre) {
  if (!spec) return base;
  const motion = motionOf(spec, clock, pre);
  if (!motion.length) return base;
  let j = JOINED.get(base);
  if (!j) {
    j = [];
    JOINED.set(base, j);
  }
  j.length = 0;
  j.push(...base, ...motion);
  return j;
}

/** The look's clock (the model pass's: paused or reduced motion, it stands still). */
function clockOf(ctx) {
  return ctx && typeof ctx.clock === 'number' ? ctx.clock : 0;
}

/** Wine and oil for a dedication come in amphorae: the warehouses' loads, a few by the piles. */
function amphorae(list, stock, spots, pre = null) {
  for (const [good, spot] of spots) {
    const k = Math.min(3, stock[good] || 0);
    if (k) list.push({ key: `warehouse:load:${good}`, n: k, mats: mats(Array.from({ length: k }, (_, i) => [spot[0] + i * 1.05 * Math.sign(-spot[0] || 1), spot[1], spot[2]]), spot[3] || 0, 0, 0, pre), state: 'always' });
  }
}

// ---------------------------------------------------------------------------
// The Great Sanctuaries
// ---------------------------------------------------------------------------

/** The sacked's fallen columns: which of the temple's and the porticoes' are down. */
const FALLEN_TEMPLE = new Set([1, 4]);
const FALLEN_PORTICO = new Set([2, 3, 8]);

function fanumMore(god, v) {
  const sig = pileSig(v.stock);
  return kept(`fanum|${god}|${v.key}|${partState(v)}|${v.struck ? 1 : 0}|${v.sacked ? 1 : 0}|${sig}|${v.crew ? 1 : 0}`, () => {
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
      list.push({ key: `fanum:site:${v.key}:${sig}:${v.crew ? 1 : 0}`, n: 1, mats: I16, state: 'always' });
      amphorae(list, v.stock, [['wine', [-7.4, 8.6, 0.3]], ['oil', [7.4, 8.6, -0.4]]]);
    }
    if (v.struck || v.sacked) list.push({ key: `fanum:ruin:${v.sacked ? 'done' : v.key}`, n: 1, mats: I16, state: 'always' });
    return Object.freeze(list.map((e) => Object.freeze(e)));
  });
}

/** A Great Sanctuary's lamps: the temple's altar and lampstands and the stair's, while it is open. */
const FANUM_LAMPS = Object.freeze([
  ...templeLamps(FANUM_TEMPLE).map(([x, y, z, s]) => Object.freeze([x + TEMPLE_AT[0], y + TEMPLE_AT[1], z + TEMPLE_AT[2], s])),
  ...STAIR_LAMPS.map(([x, y, z]) => Object.freeze([x, y, z, 1])),
]);

/** A site's crew cast: the stage's builders and the cranes' men, kept by its spec. */
function crewCast(sig, spec, make) {
  return castOf(sig, () => siteCrew(spec, make()));
}

function fanumEntry(god) {
  const type = `fanum_${god}`;
  const order = NUMEN[god].order;
  return Object.freeze({
    variant(b, place, ctx) {
      const game = ctx ? ctx.game : null;
      const v = sacredView(b, game);
      const base = fanumMore(god, v);
      const state = partState(v);
      let actors = NOBODY;
      let more = base;
      if (v.finished) {
        if (v.open) actors = castOf(`fanum|${god}|${state}`, () => fanumActors(god, state));
      } else if (v.crew) {
        const spec = siteSpec('fanum', v.key, 4, pileSig(v.stock), true);
        actors = crewCast(`fanum-crew|${v.key}|${pileSig(v.stock)}`, spec, () => fanumCrew(v.stage));
        more = withMotion(base, spec, clockOf(ctx), null);
      }
      return { key: `${type}:${v.key}`, state, ice: false, more, actors };
    },
    warm: [`${type}:done`, 'fanum:body', `fanum:god:${god}`, `fanum:col:${order}`, `fanum:pcol:${order}`, 'sacra:smoke:thin'],
    lamps: (b) => (sacredView(b, null).open ? FANUM_LAMPS : []),
    build(key, lod) {
      const t = timeOfKey(key.split(':')[1], 4);
      const ground = godGround(god);
      return buildFanum(god, t, { lod, extra: (out, tt, l) => { ground(out, tt, l); middleTerrace(out, tt, l); } }).group;
    },
  });
}

/** The sanctuaries' shared kits by key: the temple's body, each god's kit, the columns, the site, the rubble. */
function buildFanumPart(key, lod) {
  const [, what, a, b, c] = key.split(':');
  if (what === 'body') return buildTempleBody(FANUM_TEMPLE, { lod, skipPaving: () => true }).group;
  if (what === 'god') return buildTempleGod(FANUM_TEMPLE, a, { lod }).group;
  if (what === 'col') return buildTempleColumn('fanum', a, FANUM_TEMPLE.colH, { lod }).group;
  if (what === 'pcol') return buildPorticoColumn(a, { lod }).group;
  if (what === 'site') return siteKit(siteSpec('fanum', a, 4, b, c === '1'), lod);
  if (what === 'ruin') return buildRuin('fanum', timeOfKey(a, 4), lod).group;
  return new Group();
}

// ---------------------------------------------------------------------------
// The Pantheon
// ---------------------------------------------------------------------------

const FALLEN_PANTHEUM = new Set([2, 5, 11]);
const FALLEN_FORE = new Set([3, 12]);

function pantheumMore(v) {
  const sig = pileSig(v.stock);
  return kept(`pantheum|${v.key}|${partState(v)}|${v.struck ? 1 : 0}|${v.sacked ? 1 : 0}|${sig}|${v.crew ? 1 : 0}`, () => {
    const list = [];
    const n = pantheumColumnsAt(v.t);
    for (const shade of ['grey', 'pink']) {
      const cols = PANTHEUM_COLUMNS.filter((c, i) => c[3] === shade && i < n && !(v.sacked && FALLEN_PANTHEUM.has(i)));
      if (cols.length) list.push({ key: `pantheum:col:${shade}`, n: cols.length, mats: mats(cols.map(([x, z]) => [x, z]), PANTHEUM.floorY), state: 'always' });
    }
    // The forecourt's colonnades, as they go up in the last stage.
    const nf = Math.round(Math.min(1, pgrow(v.t, 'fore') * 1.6) * FORE_COLUMNS.length);
    const fore = FORE_COLUMNS.filter((c, i) => i % (FORE_COLUMNS.length / 2) < nf / 2 && !(v.sacked && FALLEN_FORE.has(i)));
    if (fore.length) list.push({ key: 'pantheum:col:fore', n: fore.length, mats: mats(fore, 0), state: 'always' });
    if (!v.finished) {
      list.push({ key: `pantheum:site:${v.key}:${sig}:${v.crew ? 1 : 0}`, n: 1, mats: I16, state: 'always' });
      amphorae(list, v.stock, [['wine', [-8.2, 8.9, 0.2]], ['oil', [8.2, 8.9, -0.3]]]);
    }
    if (v.struck || v.sacked) list.push({ key: `pantheum:ruin:${v.sacked ? 'done' : v.key}`, n: 1, mats: I16, state: 'always' });
    return Object.freeze(list.map((e) => Object.freeze(e)));
  });
}

const PANTHEUM_ENTRY = Object.freeze({
  variant(b, place, ctx) {
    const game = ctx ? ctx.game : null;
    const v = sacredView(b, game);
    const base = pantheumMore(v);
    const state = partState(v);
    let actors = NOBODY;
    let more = base;
    if (v.finished) {
      if (v.open) actors = castOf(`pantheum|${state}`, () => pantheumActors(state));
    } else if (v.crew) {
      const spec = siteSpec('pantheum', v.key, 5, pileSig(v.stock), true);
      actors = crewCast(`pantheum-crew|${v.key}|${pileSig(v.stock)}`, spec, () => pantheumCrew(v.stage));
      more = withMotion(base, spec, clockOf(ctx), null);
    }
    return { key: `pantheum:${v.key}`, state, ice: false, more, actors };
  },
  warm: ['pantheum:done', 'pantheum:col:grey', 'pantheum:col:pink', 'pantheum:col:fore'],
  lamps: (b) => (sacredView(b, null).open ? PANTHEUM_LAMPS : []),
  build(key, lod) {
    const [, tk, a, b, c] = key.split(':');
    if (tk === 'col') return buildPantheumColumn(a, { lod }).group;
    if (tk === 'site') return siteKit(siteSpec('pantheum', a, 5, b, c === '1'), lod);
    if (tk === 'ruin') return buildRuin('pantheum', timeOfKey(a, 5), lod).group;
    return buildPantheum(timeOfKey(tk, 5), { lod }).group;
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

/** How full the keeper's store is, in thirds (0 empty: the light goes dark). */
export function woodLevel(b) {
  const T = MONUMENT_TYPES.pharus.store;
  const n = (b && b.mon && b.mon.store) || 0;
  return n > 0 ? Math.max(1, Math.min(3, Math.ceil((n / T.cap) * 3))) : 0;
}

function pharusMore(side, v, ice, wood) {
  const sig = pileSig(v.stock);
  return kept(`pharus|${side}|${v.key}|${v.lit ? 1 : 0}|${ice ? 1 : 0}|${v.struck ? 1 : 0}|${v.sacked ? 1 : 0}|${sig}|${v.crew ? 1 : 0}|${wood}`, () => {
    const M = SIDE_MATS[side];
    const state = v.lit ? 'open' : 'shut';
    const list = [{ key: `pharus:${v.key}${ice ? ':ice' : ''}`, n: 1, mats: M, state }];
    if (v.finished && wood) list.push({ key: `pharus:wood:${wood}`, n: 1, mats: M, state: 'always' });
    if (v.lit) {
      // By day the fire's smoke over the tower's top, a big one (the altars' thick smoke, near twice the size).
      const [x, y, z] = PHARUS.fire;
      const m = new Matrix4().fromArray(M).multiply(new Matrix4().makeScale(1.9, 1.9, 1.9).setPosition(x, y + 0.45, z));
      list.push({ key: 'sacra:smoke:thick', n: 1, mats: m.toArray(new Float32Array(16)), state: 'always' });
    }
    if (!v.finished) list.push({ key: `pharus:site:${v.key}:${sig}:${v.crew ? 1 : 0}`, n: 1, mats: M, state: 'always' });
    if (v.struck || v.sacked) list.push({ key: `pharus:ruin:${v.sacked ? 'done' : v.key}`, n: 1, mats: M, state: 'always' });
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
    const wood = b.id === null || b.id === undefined ? 3 : woodLevel(b);
    const base = pharusMore(side, v, ice, wood);
    const state = v.lit ? 'open' : 'shut';
    let actors = NOBODY;
    let more = base;
    if (v.finished) {
      if (v.open) actors = castOf(`pharus|${side}`, () => turnActors(pharusActors(), side));
    } else if (v.crew) {
      const spec = siteSpec('pharus', v.key, 4, pileSig(v.stock), true);
      actors = castOf(`pharus-crew|${side}|${v.key}|${pileSig(v.stock)}`, () => turnActors(siteCrew(spec, pharusCrew(v.stage)), side));
      more = withMotion(base, spec, clockOf(ctx), SIDE_MATS[side]);
    }
    return { key: 'pharus:none', state, ice: false, more, actors };
  },
  warm: ['pharus:done', 'pharus:wood:3', 'sacra:smoke:thick'],
  lamps: (b) => (sacredView(b, null).lit ? PHARUS_LAMPS[waterSideOf(b, null)] : []),
  build(key, lod) {
    const [, tk, a, b, c] = key.split(':');
    if (tk === 'none') return new Group();
    if (tk === 'wood') return buildPharusWood(Number(a) || 0, { lod }).group;
    if (tk === 'site') return siteKit(siteSpec('pharus', a, 4, b, c === '1'), lod);
    if (tk === 'ruin') return buildRuin('pharus', timeOfKey(a, 4), lod).group;
    return buildPharus(timeOfKey(tk, 4), { lod, ice: a === 'ice' }).group;
  },
});

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
 * A stand-in building for the lab and the tests: `type` at `stage` with
 * `share` of its work done and its goods `got` (by default all its goods
 * in, the work part done), staffed, its store, sacked, halted, its water
 * side: the sim's own fields, as a building carries them.
 */
export function standIn(type, { id = 1, stage = null, share = 0.5, got = null, staffed = true, store = true, sacked = false, halted = false, x = 0, y = 0, waterSide = 2 } = {}) {
  const def = BUILDINGS[type];
  const T = MONUMENT_TYPES[def.mon];
  const n = T.stages.length;
  const s = stage === null ? n : Math.min(n, stage);
  const st = T.stages[s];
  const mon = { stage: s, work: st ? st.work * share : 0, got: got || (st ? { ...st.goods } : {}), way: {}, paid: true, halted, store: store && T.store ? T.store.cap : 0, sacked, wasOpen: false };
  return { id, type, def, x, y, size: def.size, turn: 0, efficiency: staffed ? 1 : 0, mon, waterRows: def.placement === 'shore' ? 2 : 0, waterSide };
}

/** A made-up game whose camp's crew is on site `id` (the lab's and the tests' stand-in for a working site). */
export function crewGame(id, extra = {}) {
  const camp = { id: 9000 + id, def: BUILDINGS.work_camp, camp: { crew: { state: 'site', site: id } } };
  return { buildings: new Map([[camp.id, camp]]), time: { totalTicks: 1, totalDays: 1 }, city: { gods: {} }, military: { active: null }, ...extra };
}

void closedReason;
void raidKey;
void buildPantheumColumn;
