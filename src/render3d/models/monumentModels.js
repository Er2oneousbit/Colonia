/**
 * models/monumentModels.js
 * ----------------------------------------------------------------------------
 * The work camp and the Hall of Justice as the game draws them
 * (render3d/models.js MODELS takes these entries as they are): which look a
 * building shows and its state, from the sim's own fields, read only.
 *
 *   work_camp  the Castra Operarum (models/castraOperarum.js): 'shut'
 *              unstaffed; staffed, 'out' while its crew is away (on the
 *              road to the site, at work there, or walking back:
 *              sim/monuments.js b.camp.crew.state 'out', 'site', 'back'),
 *              else 'open' (the crew at home). Its supply is its key
 *              ('work_camp:ok|hungry|dry|both', from b.camp.fed and
 *              b.camp.water, while staffed). Its parked ox wagons are
 *              `more` (three less the carts out on the roads: its walkers
 *              of type 'cart'). Its braziers burn at night while staffed.
 *   basilica   the Hall of Justice (models/basilica.js), read through the
 *              shared stage view (worksite.js siteView): building, the
 *              stage and its quarters done pick its kit
 *              ('basilica:p<quarters>', ':x' after a raid's setback), with
 *              its site's scaffolds, cranes and centering merged in; its
 *              goods on site (worksite.js pileMore), its columns once they
 *              stand, the cranes' wheels and loads (siteMotion: turning
 *              while a camp's crew is on the site and it is not halted)
 *              are `more`; its crew and the cranes' men are actors.
 *              Finished, 'basilica:done' ('basilica:sacked' once raiders
 *              sacked it: the doors broken, rubble), 'open' while it works
 *              (staffed to OPEN_STAFF), else 'shut'.
 * ----------------------------------------------------------------------------
 */

import { Matrix4 } from 'three';
import { cast, NOBODY } from '../people/actors.js';
import { buildWorkCamp, buildCampWagon, campActors, CAMP3D, CAMP_LAMPS, CAMP_HEARTH_LAMP } from './castraOperarum.js';
import {
  buildBasilica, buildBasilicaColumn, basilicaSite, basilicaActors, basilicaPiles, naveColumns, porchColumns, progOf, BASILICA3D, BASILICA_LAMPS,
} from './basilica.js';
import { siteView, siteParts, siteMotion, siteActors, pileMore } from './worksite.js';
import { TaggedParts } from './masonry.js';
import { closedReason } from '../../sim/monumentEffects.js';

// ---------------------------------------------------------------------------
// The work camp
// ---------------------------------------------------------------------------

/** Ox carts a camp keeps: the most its staffing fields (sim/monuments.js campCarts). */
const WAGONS = 3;

/** The camp's state: 'shut' unstaffed, 'out' with its crew away, else 'open'. */
export function campState(b) {
  if (!(b.efficiency > 0)) return 'shut';
  const crew = b.camp && b.camp.crew;
  return crew && crew.state !== 'home' ? 'out' : 'open';
}

/** The camp's supply while staffed: 'ok', 'hungry' (no food), 'dry' (no water), 'both'; unstaffed or a ghost, 'ok'. */
export function campSupply(b) {
  const c = b.camp;
  if (!c || !(b.efficiency > 0)) return 'ok';
  if (!c.fed && !c.water) return 'both';
  return !c.fed ? 'hungry' : !c.water ? 'dry' : 'ok';
}

/** Carts of the camp out on the roads (its walkers of type 'cart'). */
export function cartsOut(b, game) {
  if (!game || !game.walkers || !b.walkers) return 0;
  let n = 0;
  for (const id of b.walkers) {
    const w = game.walkers.get(id);
    if (w && w.type === 'cart') n++;
  }
  return n;
}

/** The parked wagons' `more` by count, made once each. */
const WAGON_MORE = [];
function wagonMore(n) {
  if (WAGON_MORE[n]) return WAGON_MORE[n];
  const m = new Matrix4();
  const mats = new Float32Array(16 * Math.max(1, n));
  for (let i = 0; i < n; i++) {
    const [x, z] = CAMP3D.wagons[i];
    m.makeRotationY(0.05 * (i - 1)).setPosition(x, CAMP3D.floorY, z).toArray(mats, i * 16);
  }
  WAGON_MORE[n] = n ? Object.freeze([Object.freeze({ key: 'work_camp:wagon', n, mats, state: 'always' })]) : Object.freeze([]);
  return WAGON_MORE[n];
}

const CAMP_CASTS = {};
const campCast = (state, supply) => (CAMP_CASTS[`${state}|${supply}`] ??= cast(campActors(state, supply)));

const WORK_CAMP = Object.freeze({
  variant(b, place, ctx) {
    const state = campState(b);
    const supply = campSupply(b);
    const parked = Math.max(0, WAGONS - cartsOut(b, ctx && ctx.game));
    return { key: `work_camp:${supply}`, state, ice: false, more: wagonMore(parked), actors: campCast(state, supply) };
  },
  warm: ['work_camp:ok', 'work_camp:wagon'],
  // The braziers at the gate while staffed, the kitchen fire with food to cook.
  lamps: (b) => (b.efficiency > 0 ? (campSupply(b) === 'ok' || campSupply(b) === 'dry' ? [...CAMP_LAMPS, CAMP_HEARTH_LAMP] : CAMP_LAMPS) : []),
  build(key, lod) {
    const what = key.split(':')[1];
    if (what === 'wagon') return buildCampWagon(lod).group;
    return buildWorkCamp({ lod, supply: what }).group;
  },
});

// ---------------------------------------------------------------------------
// The Hall of Justice
// ---------------------------------------------------------------------------

/** The columns' `more` (finished: the nave's and the porch's), made once. */
const COLS = new Map();
function columnMore(which) {
  if (COLS.has(which)) return COLS.get(which);
  const at = which === 'nave' ? naveColumns() : porchColumns();
  const m = new Matrix4();
  const mats = new Float32Array(16 * at.length);
  at.forEach(([x, z], i) => m.makeTranslation(x, BASILICA3D.floorY, z).toArray(mats, i * 16));
  const e = Object.freeze({ key: `basilica:col:${which}`, n: at.length, mats, state: 'always' });
  COLS.set(which, e);
  return e;
}

/** The columns standing at `prog`: the nave's and the porch's once finished (1.75 on), as basilica.js schedules them. */
function columnsAt(prog) {
  return prog >= 1.75 ? [columnMore('nave'), columnMore('porch')] : [];
}

/** The quarters built (0 to 16) from prog. */
const quarters = (prog) => Math.round(prog * 4);

/** The key of a basilica's look from its view. */
export function basilicaKey(view) {
  if (view.finished) return view.sacked ? 'basilica:sacked' : 'basilica:done';
  return `basilica:p${quarters(progOf(view))}${view.struck ? ':x' : ''}`;
}

/** A look's site objects, kept by their quarters, setback and crew (siteMotion keeps its matrices per object). */
const SITES = new Map();
function siteOf(q, struck, crew) {
  const k = `${q}|${struck ? 1 : 0}|${crew ? 1 : 0}`;
  let s = SITES.get(k);
  if (!s) {
    s = basilicaSite(q / 4, struck);
    // (A struck site's cranes stand still and nobody works: its crew went home.)
    if (crew && !struck) s = { ...s, cranes: s.cranes.map((c) => ({ ...c, work: true })) };
    SITES.set(k, s);
  }
  return s;
}

const COURT = { open: null };
const BUILD_CASTS = new Map();
function basilicaCast(view) {
  if (view.finished) return view.open && !view.sacked ? (COURT.open ??= cast(basilicaActors(4, { open: true }))) : NOBODY;
  const q = quarters(progOf(view));
  const crew = view.crew && !view.struck;
  if (!crew) return NOBODY;
  let c = BUILD_CASTS.get(q);
  if (!c) {
    c = cast([...basilicaActors(q / 4, { crew: true }), ...siteActors({ cranes: siteOf(q, false, true).cranes })]);
    BUILD_CASTS.set(q, c);
  }
  return c;
}

/** The finished, sacked look's rubble and fallen things (worksite.js), merged into its kit. */
const SACKED_SITE = Object.freeze({
  rubble: [{ x: -4.6, z: 8.4, w: 3.4, d: 1.6 }, { x: 3.2, z: 8.6, w: 2.6, d: 1.4 }, { x: 0, z: 6.0, w: 2.4, d: 1.2, y: BASILICA3D.floorY }],
  scaffolds: [{ x: 7.0, z: 8.6, w: 3.6, d: 1.6, h: 3, fallen: true }],
});

const BASILICA = Object.freeze({
  variant(b, place, ctx) {
    const game = ctx ? ctx.game : null;
    const view = siteView(b, game);
    const key = basilicaKey(view);
    if (view.finished) {
      return { key, state: view.open && !view.sacked ? 'open' : 'shut', ice: false, more: columnsAt(4), actors: basilicaCast(view) };
    }
    const prog = progOf(view);
    const q = quarters(prog);
    const crew = view.crew && !view.struck;
    const site = siteOf(q, view.struck, crew);
    const more = [...columnsAt(prog), ...pileMore(basilicaPiles(view.stock)), ...siteMotion(site, ctx ? ctx.clock || 0 : 0)];
    return { key, state: 'always', ice: false, more, actors: basilicaCast(view) };
  },
  warm: ['basilica:done', 'basilica:p6', 'basilica:col:nave', 'basilica:col:porch'],
  // The porch's lanterns while the courts sit (a finished, working basilica).
  lamps: (b) => (closedReason(b) === null ? BASILICA_LAMPS : []),
  build(key, lod) {
    const [, what, which] = key.split(':');
    if (what === 'col') return buildBasilicaColumn(which, lod).group;
    if (what === 'done' || what === 'sacked') {
      const g = buildBasilica({ lod, prog: 4, sacked: what === 'sacked' });
      if (what !== 'sacked') return g.group;
      const p = new TaggedParts('basilica-sacked');
      for (const e of siteParts(SACKED_SITE, lod)) p.add(e.name, e.material, [e.g], { cast: e.cast });
      g.group.add(p.build().group);
      return g.group;
    }
    const q = Number(what.slice(1));
    const g = buildBasilica({ lod, prog: q / 4 });
    const p = new TaggedParts('basilica-site');
    for (const e of siteParts(basilicaSite(q / 4, which === 'x'), lod)) p.add(e.name, e.material, [e.g], { cast: e.cast });
    g.group.add(p.build().group);
    return g.group;
  },
});

export const MONUMENT_MODELS = Object.freeze({ work_camp: WORK_CAMP, basilica: BASILICA });

/** The quarters a basilica's look is built at, building (every stage and quarter) and finished. */
export const BASILICA_LOOKS = Object.freeze([...Array.from({ length: 16 }, (_, q) => `basilica:p${q}`), 'basilica:done', 'basilica:sacked']);

