/**
 * advisorSig.js
 * ----------------------------------------------------------------------------
 * A cheap "has anything this Advisors tab shows changed?" signature, so the
 * window rebuilds a tab only when its numbers moved instead of every second
 * and a half (a rebuild drops button focus and redraws canvases).
 *
 * A signature lists the sim fields the tab prints, not the whole state. The
 * heavy tabs (Overview with its charts, Labor, Population, Finance, Trade with
 * its map, Messages with up to 150 rows) have their own; every other tab
 * follows the game day, which is what it effectively did before. Advisors
 * also rebuilds on a slow timer, so a field a signature misses is late, never
 * lost.
 * ----------------------------------------------------------------------------
 */

import { GOOD_KEYS } from '../data/goods.js';
import { LABOR_CATEGORIES } from '../data/buildings.js';
import { goalStatus } from '../sim/ratings.js';
import { cityStock } from '../sim/storage.js';
import { routeKind, shipsWaitingText, importWarnings } from '../sim/trade.js';
import { tradeHaltText } from '../sim/events.js';
import { tradeBoost } from '../sim/tradeDemand.js';

/** The seconds after which a tab is rebuilt whether or not its signature moved. */
export const SLOW_REFRESH = 10;

const time = (g) => [g.time.totalMonths, g.time.year];

function overview(g) {
  const c = g.city;
  return [time(g), c.population, c.treasury, c.workforce, c.jobs, c.unemploymentRate, c.vacancies, c.ratings?.favor, c.sentiment, c.victory,
    (c.history || []).length, Object.values(c.sentimentFactors || {}), goalStatus(g).map((r) => [r.ok, r.have, r.need])];
}

function labor(g) {
  const c = g.city;
  return [c.workforce, c.jobs, c.employed, c.unemployed, c.unemploymentRate, c.wage, c.laborPriority,
    Object.keys(LABOR_CATEGORIES).map((k) => { const d = c.laborByCat?.[k]; return d ? [d.employed, d.demand] : 0; }), c.lastMonth?.wages, g.time.year];
}

function population(g) {
  const c = g.city;
  return [c.population, c.plebs, c.patricians, c.houses, c.vacancies, c.sentiment, c.tierCounts,
    c.stats && [c.stats.peakPopulation, c.stats.immigrated, c.stats.emigrated, c.stats.evolutions, c.stats.devolutions]];
}

function finance(g) {
  const c = g.city;
  return [time(g), c.taxRate, c.taxCoverage, c.treasury, c.lastMonth?.wages, c.lastMonth?.taxes, c.governor?.savings,
    c.loan && [c.loan.left, c.loan.monthly], c.finance?.thisYear, c.finance?.lastYear, g.buildings.size];
}

function trade(g) {
  const t = g.city.trade;
  const docks = [...g.buildings.values()].filter((b) => b.def.kind === 'dock').map((b) => b.efficiency > 0);
  const routes = Object.keys(t.routes).map((id) => {
    const r = t.routes[id];
    return [id, r.open, r.sold, r.bought, r.off, tradeBoost(g, id) > 1, tradeHaltText(g, routeKind(id))];
  });
  return [time(g), !!g.map.seaEntry, docks, routes, GOOD_KEYS.map((k) => [t.settings[k]?.mode, t.settings[k]?.level, cityStock(g, k)]),
    shipsWaitingText(g), importWarnings(g), t.log.length, t.log[0]];
}

function messages(g) {
  const m = g.messages;
  return [m.length, m[0] && [m[0].date, m[0].text], m.length && m[m.length - 1].text];
}

const BY_TAB = { overview, labor, population, finance, trade, messages };

/** The signature of `tab`'s content now: a string, equal while nothing it shows changed. */
export function tabSignature(tab, g) {
  const fn = BY_TAB[tab];
  // The rest: the game day (and the headline numbers every tab leans on).
  return JSON.stringify(fn ? fn(g) : [g.time.totalDays, g.city.population, g.city.treasury, g.buildings.size, g.messages.length]);
}
