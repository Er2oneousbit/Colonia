/**
 * monumentInfo.js
 * ----------------------------------------------------------------------------
 * The words and panel sections for monuments and the work camp: a site's
 * stage, its goods delivered and coming, what holds it up and the stages
 * ahead; a finished monument's effects, staff and store; a camp's carts,
 * crew, larder and water. The rules are sim/monuments.js; the info panel
 * (ui/infoPanel.js) and the advisors call these.
 * ----------------------------------------------------------------------------
 */

import { h, fmt, pct, bar, kv } from './dom.js';
import { GOODS } from '../data/goods.js';
import { MONUMENT_TYPES, FANUM_GODS, OPEN_STAFF, CAMP, THERMAE_REACH } from '../data/monuments.js';
import { isFinished, closedReason, monumentType } from '../sim/monumentEffects.js';
import {
  stageOf, workCap, siteStatus, setHalted, campCarts, siteFor, monumentUpkeep, builtSoFar, deityName,
} from '../sim/monuments.js';

/** "Marble" (a good's name; 'food' for the Mansio Magna's store). */
function goodName(g) {
  return g === 'food' ? 'Food' : GOODS[g]?.name || g;
}

/** What a finished monument does, in a sentence (the panel and the advisor). */
export function effectText(b) {
  switch (b.def.mon) {
    case 'fanum': {
      const f = FANUM_GODS.find((x) => x.god === b.def.deity);
      return `Counts as six temples of ${f.name}, whose mood never sinks low enough to strike, and whose blessings come after 8 months instead of 14. ${f.gift}`;
    }
    case 'pantheum': return 'Counts as two temples of every god and lifts every god\'s mood by 10; no god is ever jealous or minds a year without a festival.';
    case 'pharus': return 'Every sea partner buys and sells a quarter more a year; storms at sea last half as long; Neptune\'s anger keeps ships away 2 months instead of 5; fishing boats sail a quarter faster.';
    case 'mansio_magna': return 'Every land partner buys and sells a quarter more a year; each caravan carries 1,200 each way instead of 800; landslides and sandstorms last half as long.';
    case 'thermae': return `Every home within ${THERMAE_REACH} tiles has the baths; city health rises by 10, disease grows 30% slower, and the city's mood rises by 3.`;
    case 'basilica': return 'Every registered home pays a fifth more tax and stays registered 96 days instead of 48; unhappy homes breed trouble 30% less often; prosperity rises by 8.';
    default: return '';
  }
}

/** What raiders do to it on this difficulty (the panels say it, Insane loudest). */
export function raidNote(game) {
  return game.difficulty.monumentRaze
    ? 'On Insane, raiders who bring it to the ground raze it: every stage and every good built into it is lost. Wall it and garrison it.'
    : 'Raiders who break into the site undo half the work on the stage under way and smash a quarter of its goods; a finished stage is never lost. A finished monument they sack closes until it is repaired.';
}

/** The status line for a monument's or a work camp's panel. */
export function monumentStatus(game, b) {
  if (b.def.kind === 'work_camp') return campStatus(game, b);
  return siteStatus(game, b);
}

/** A work camp's status: the first thing holding it up. */
export function campStatus(game, b) {
  const c = b.camp;
  if (!c) return { level: 'warn', text: '' };
  if (b.efficiency <= 0) return { level: 'bad', text: 'No workers: no carts go out and nobody builds.' };
  const site = siteFor(game, b);
  if (!site) return { level: 'warn', text: 'No monument being built on its roads: nothing to do.' };
  if (!c.water && !c.fed) return { level: 'bad', text: 'No food and no water: work has stopped. Build a well or a fountain beside it, and keep a granary on its roads stocked.' };
  if (!c.water) return { level: 'warn', text: 'No water: working at half pace. A well or a fountain must reach one of its tiles.' };
  if (!c.fed) return { level: 'warn', text: 'No food: working at half pace. Its buyer fetches food from a granary on its roads.' };
  if (site.mon.halted) return { level: 'warn', text: `The ${site.def.name} is halted.` };
  return { level: b.efficiency < 1 ? 'warn' : 'good', text: `Building the ${site.def.name}${b.efficiency < 1 ? ` at ${pct(b.efficiency)} staff` : ''}.`, understaffed: b.efficiency < 1 };
}

/** One row a good: "Marble 600 / 800 (+400 on the way)". */
function goodRow(b, g, need) {
  const got = b.mon.got[g] || 0;
  const way = b.mon.way[g] || 0;
  return [kv(`${GOODS[g]?.icon || ''} ${goodName(g)}`, `${fmt(got)} / ${fmt(need)}${way > 0 ? ` (+${fmt(way)} on the way)` : ''}`), bar(got, need)];
}

/** The work bar, with the cap from the goods drawn as a mark on it. */
function workBar(b, st) {
  const cap = workCap(b);
  const el = bar(b.mon.work, st.work, 'mon');
  el.appendChild(h('b', { class: 'cap', style: { left: `${Math.min(100, (100 * cap) / st.work).toFixed(1)}%` }, title: 'The most work the goods delivered allow' }));
  return el;
}

/** The goods every stage after the one under way needs, added up, so the player can stockpile. */
function aheadText(b) {
  const t = monumentType(b);
  const sum = {};
  for (let k = b.mon.stage + 1; k < t.stages.length; k++) for (const [g, n] of Object.entries(t.stages[k].goods)) sum[g] = (sum[g] || 0) + n;
  const list = Object.entries(sum).map(([g, n]) => `${goodName(g).toLowerCase()} ${fmt(n)}`);
  return list.length ? `Stages ahead need: ${list.join(', ')}.` : 'The last stage.';
}

/**
 * A site's or a finished monument's sections for the info panel. `sec`
 * builds a titled section; `rerender` refreshes the panel after the Halt
 * button.
 */
export function monumentSections(game, b, sec, rerender) {
  const t = monumentType(b);
  const out = [];
  const god = deityName(b);
  if (!isFinished(b)) {
    const st = stageOf(b);
    out.push(sec(`Stage ${b.mon.stage + 1} of ${t.stages.length}: ${st.name}`,
      h('div', { class: 'muted' }, st.en),
      kv('Work', `${fmt(b.mon.work)} / ${fmt(st.work)} camp-days`), workBar(b, st),
      Object.entries(st.goods).map(([g, n]) => goodRow(b, g, n)),
      kv('Money for this stage', b.mon.paid ? `${fmt(st.money)} Dn, paid` : `${fmt(st.money)} Dn, not yet paid`),
      h('div', { class: 'muted' }, aheadText(b)),
      h('div', { class: 'panel-sec row' },
        h('button', {
          class: 'btn small',
          dataset: { halt: b.mon.halted ? '1' : '0' }, // (for the smoke test)
          title: b.mon.halted ? 'Send the carts and crews back to work' : 'Stop the carts and send the crews home, keeping the goods for other uses',
          onclick: () => { setHalted(game, b, !b.mon.halted); rerender(); },
        }, b.mon.halted ? 'Resume construction' : 'Halt construction'))));
    const done = builtSoFar(b);
    out.push(sec('The work so far',
      kv('Stages finished', `${done.stages} of ${t.stages.length}`),
      kv('Goods built in', `${fmt(done.units)} units`),
      god ? kv('Dedicated to', god) : null,
      h('div', { class: 'muted' }, `Finished: ${effectText(b)}`),
      h('div', { class: game.difficulty.monumentRaze ? 'warn' : 'muted', dataset: { raze: game.difficulty.monumentRaze ? '1' : '0' } }, raidNote(game))));
    return out;
  }
  const why = closedReason(b);
  out.push(sec(why ? 'Closed' : 'Open',
    h('div', {}, effectText(b)),
    kv('Staff needed to open', `${Math.ceil(b.def.workers * OPEN_STAFF)} of ${b.def.workers}`),
    kv('Upkeep', `${fmt(monumentUpkeep(game, b))} Dn a month`),
    t.store ? [kv(`${goodName(t.store.good)} in store`, `${fmt(b.mon.store)} / ${fmt(t.store.cap)}`), bar(b.mon.store, t.store.cap),
      h('div', { class: 'muted' }, `It uses ${fmt(t.store.perYear)} a year; its own cart fetches more from a ${t.store.good === 'food' ? 'granary' : 'warehouse'} once the store is under half.`)] : null,
    h('div', { class: game.difficulty.monumentRaze ? 'warn' : 'muted', dataset: { raze: game.difficulty.monumentRaze ? '1' : '0' } }, raidNote(game))));
  return out;
}

/** A work camp's sections for the info panel: its carts, its crew, its larder and water, the site it serves. */
export function campSections(game, b, sec) {
  const c = b.camp;
  if (!c) return [];
  const walkers = b.walkers.map((id) => game.walkers.get(id)).filter(Boolean);
  const carts = walkers.filter((w) => w.type === 'cart');
  const site = siteFor(game, b);
  const crew = { home: 'At the camp', out: 'On the way to the site', site: 'Working on the site', back: 'On the way home' }[c.crew.state] || c.crew.state;
  const cartText = (w) => {
    const cl = w.campClaim;
    if (w.cargo && w.cargo.amount > 0) return `${fmt(w.cargo.amount)} ${goodName(w.cargo.good).toLowerCase()} to the site`;
    if (cl) return `fetching ${fmt(cl.amount)} ${goodName(cl.good).toLowerCase()}`;
    return 'coming home';
  };
  return [sec('Work camp',
    kv('Serves', site ? `${site.def.name}, stage ${site.mon.stage + 1}` : 'No monument on its roads'),
    kv('Ox carts out', `${carts.length} of ${campCarts(b)}`),
    carts.map((w) => h('div', { class: 'muted' }, `· ${cartText(w)}`)),
    kv('Crew', crew),
    kv('Larder', `${fmt(c.larder)} / ${CAMP.larder} food`), bar(c.larder, CAMP.larder),
    kv('Water', c.water ? 'A well or fountain reaches it' : 'None'),
    kv('Pace', c.factor >= 1 ? 'Full' : c.factor > 0 ? 'Half (short of food or water)' : 'Stopped'),
    h('div', { class: 'muted' }, `Its carts (3 at 75% staff, 2 at 50%, 1 with any) bring each stage's goods from the warehouses on its roads, ${CAMP.load} a trip; its crew works ${CAMP.shift} days on the site, then walks home to rest. Build it near the site: the walk costs work.`))];
}

/** The advisor's line for the city's monument: what it is and how far along, or null. */
export function monumentSummary(game, b) {
  if (!b) return null;
  const t = monumentType(b);
  if (isFinished(b)) {
    const why = closedReason(b);
    return `${b.def.name} (${b.def.en}): finished, ${why ? 'closed' : 'open'}.`;
  }
  const st = stageOf(b);
  const need = Object.entries(st.goods).map(([g, n]) => `${goodName(g).toLowerCase()} ${fmt(b.mon.got[g] || 0)} / ${fmt(n)}`).join(', ');
  return `${b.def.name} (${b.def.en}): stage ${b.mon.stage + 1} of ${t.stages.length}, ${st.name}; work ${fmt(b.mon.work)} / ${fmt(st.work)}; ${need}.`;
}

/** Every monument type's key in MONUMENT_TYPES (for the help and advisors' lists). */
export const MONUMENT_TYPE_KEYS = Object.freeze(Object.keys(MONUMENT_TYPES));
