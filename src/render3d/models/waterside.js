/**
 * models/waterside.js
 * ----------------------------------------------------------------------------
 * The three waterside works as the game draws them (render3d/models.js
 * MODELS takes these entries as they are): which look a building shows,
 * from the sim's own fields, read only.
 *
 *   dock      the Emporium (models/tradeDock.js): 'open' staffed, 'shut' not;
 *             the goods it holds on its quay as the warehouse's loads, one a
 *             hundred units (sim/trade.js: dock.stock by good, up to
 *             CONFIG.DOCK_CAPACITY), in the twelve places of its quay and
 *             shed, each good's loads together
 *   shipyard  the Fabrica Navalis (models/fishYard.js): 'open' staffed,
 *             'shut' not; the fishing boat on its slip by the sim's
 *             progress (fishHullStep: none, keel and posts, frames, planked,
 *             finished), its timber as two loads (a hundred each, the
 *             inputCap's 200), a smoke kit over the pitch kettle while it
 *             works
 *   wharf     the Piscatoria (models/fishWharf.js): 'open' staffed, 'shut'
 *             not; a basket of the catch on the deck for every twenty-five
 *             fish it holds, smoke over the smoke house while it works
 *
 * The ships are not part of these: the game draws a merchant ship moored
 * alongside the dock's front and the fishing boats alongside the shipyard's
 * and the wharf's (ships/moorings.js alongside: a hand off the front line),
 * so nothing here stands past the footprint and the front is a quay edge
 * with bollards and rings. A waterside building never turns (sim/
 * construction.js turnRule); it faces its water, `b.waterSide` (models/
 * fleet.js says how the side is told, and how its kits are turned to it):
 * the building's own kit is empty, everything it shows is a kit drawn in
 * its frame, so one kit serves all four sides. Their people are actors
 * (people/: tradeDockActors, fishYardActors, fishWharfActors), turned to
 * the side here and packed once a side and state.
 *
 * A hard frost (the sprites' deep snow) takes the foam from round the
 * piles, as the fleet's do ('<type>:ice').
 * ----------------------------------------------------------------------------
 */

import { Group } from 'three';
import { WARE_GOODS } from './wares.js';
import { buildTradeDock, tradeDockActors, TRADE_DOCK } from './tradeDock.js';
import { buildFishYard, buildFishHull, fishYardActors, fishHullStep, FISH_YARD } from './fishYard.js';
import { buildFishWharf, fishWharfActors, basketCount, FISH_WHARF } from './fishWharf.js';
import { SIDE_MATS, placeMats, cached, castOf, turnActors, waterSideOf, staffedState, overWater, lampsAt } from './fleet.js';

/** A hard frost: the sprites' deep snow (levels 2 and 3 of 0..3), as models.js reads it; the water's margins freeze. */
const frost = (place) => ((place && place.snow) || 0) >= 2;

/** Units in a cart's load (the warehouse's load kit shows this many). */
const LOAD = 100;

/**
 * The dock's goods as loads by good: [[good, n]] in the goods' order, one
 * load a hundred units (rounded up), at most `places` in all. Over that the
 * loads are shared out in proportion (every good held keeps at least one),
 * so a dock full of timber and a little wine still shows both.
 */
export function dockLoads(stock, places = TRADE_DOCK.loads.length) {
  const held = [];
  for (const g of WARE_GOODS) {
    const n = Math.ceil(((stock && stock[g]) || 0) / LOAD);
    if (n > 0) held.push([g, n]);
  }
  let total = held.reduce((s, [, n]) => s + n, 0);
  if (total <= places) return held;
  const scaled = held.map(([g, n]) => [g, Math.max(1, Math.floor((n * places) / total))]);
  total = scaled.reduce((s, [, n]) => s + n, 0);
  // Shave the largest while over (each keeps at least one), then top up the largest while under.
  while (total > places) {
    const big = scaled.reduce((a, e) => (e[1] > a[1] ? e : a));
    if (big[1] <= 1) break;
    big[1]--;
    total--;
  }
  while (total < places) {
    scaled.reduce((a, e) => (e[1] > a[1] ? e : a))[1]++;
    total++;
  }
  return scaled;
}

/** The yard's timber as loads: a hundred each, as many as its places. */
export function yardLoads(stock) {
  const n = Math.ceil(((stock && stock.timber) || 0) / LOAD);
  return Math.max(0, Math.min(FISH_YARD.stock.length, n));
}

/** A kit placed once at a point of the model's frame, turned to a side (a smoke kit over a chimney). */
const atPoint = (key, p, side) => ({ key, n: 1, mats: placeMats([[p[0], p[1], p[2], 0]], side), state: 'always' });

const DOCK_LAMPS = [0, 1, 2, 3].map((s) => lampsAt(TRADE_DOCK.lamps, s));
const YARD_LAMPS = [0, 1, 2, 3].map((s) => lampsAt(FISH_YARD.lamps, s));
const WHARF_LAMPS = [0, 1, 2, 3].map((s) => lampsAt(FISH_WHARF.lamps, s));

/** The kettle's smoke rises from its rim; the smoke house's from its vent's top. */
const KETTLE_TOP = [FISH_YARD.kettle.x, FISH_YARD.kettle.rim + 0.1, FISH_YARD.kettle.z];

/** A ghost has no id and no stock: the work as it will stand, staffed and empty, its people not drawn. */
const isGhost = (b) => b.id === null || b.id === undefined;

export const WATERSIDE_MODELS = Object.freeze({
  dock: Object.freeze({
    fits: overWater,
    warm: ['dock', 'warehouse:load:timber'],
    lamps: (b) => (b.efficiency > 0 ? DOCK_LAMPS[waterSideOf(b, null)] : []),
    variant(b, place, ctx) {
      const side = waterSideOf(b, ctx);
      const state = staffedState(b);
      const ice = frost(place);
      const held = isGhost(b) ? [] : dockLoads(b.stock);
      const sig = held.map(([g, n]) => `${g}${n}`).join(',');
      const more = cached(`dock|${side}|${state}|${ice ? 1 : 0}|${sig}`, () => {
        const list = [{ key: ice ? 'dock:ice' : 'dock', n: 1, mats: SIDE_MATS[side], state }];
        let at = 0;
        for (const [g, n] of held) {
          list.push({ key: `warehouse:load:${g}`, n, mats: placeMats(TRADE_DOCK.loads.slice(at, at + n), side), state: 'always' });
          at += n;
        }
        return list;
      });
      const actors = castOf(`dock|${side}|${state}`, () => turnActors(tradeDockActors(state), side));
      return { key: 'dock:none', state, ice: false, more, actors };
    },
    build(key, lod) {
      const kind = key.split(':')[1];
      if (kind === 'none') return new Group();
      return buildTradeDock({ lod, ice: kind === 'ice' }).group;
    },
  }),
  shipyard: Object.freeze({
    fits: overWater,
    warm: ['shipyard', 'shipyard:hull:4', 'warehouse:load:timber', 'sacra:smoke:thin'],
    lamps: (b) => (b.efficiency > 0 ? YARD_LAMPS[waterSideOf(b, null)] : []),
    variant(b, place, ctx) {
      const side = waterSideOf(b, ctx);
      const state = staffedState(b);
      const ice = frost(place);
      const ghost = isGhost(b);
      const step = ghost ? 0 : fishHullStep(b);
      const t = ghost ? 0 : yardLoads(b.stock);
      const smoking = state === 'open' && !ghost;
      const more = cached(`shipyard|${side}|${state}|${ice ? 1 : 0}|${step}|${t}|${smoking ? 1 : 0}`, () => {
        const list = [{ key: ice ? 'shipyard:ice' : 'shipyard', n: 1, mats: SIDE_MATS[side], state }];
        if (step) list.push({ key: `shipyard:hull:${step}`, n: 1, mats: SIDE_MATS[side], state });
        if (t) list.push({ key: 'warehouse:load:timber', n: t, mats: placeMats(FISH_YARD.stock.slice(0, t), side), state: 'always' });
        if (smoking) list.push(atPoint('sacra:smoke:thin', KETTLE_TOP, side));
        return list;
      });
      const actors = castOf(`shipyard|${side}|${state}|${step ? 1 : 0}`, () => turnActors(fishYardActors(state, step > 0), side));
      return { key: 'shipyard:none', state, ice: false, more, actors };
    },
    build(key, lod) {
      const [, kind, arg] = key.split(':');
      if (kind === 'none') return new Group();
      if (kind === 'hull') return buildFishHull(Number(arg) || 1, { lod }).group;
      return buildFishYard({ lod, ice: kind === 'ice' }).group;
    },
  }),
  wharf: Object.freeze({
    fits: overWater,
    warm: ['wharf', 'vessel:catch', 'sacra:smoke:thin'],
    lamps: (b) => (b.efficiency > 0 ? WHARF_LAMPS[waterSideOf(b, null)] : []),
    variant(b, place, ctx) {
      const side = waterSideOf(b, ctx);
      const state = staffedState(b);
      const ice = frost(place);
      const ghost = isGhost(b);
      const baskets = ghost ? 0 : basketCount(b.stock && b.stock.fish);
      const smoking = state === 'open' && !ghost;
      const more = cached(`wharf|${side}|${state}|${ice ? 1 : 0}|${baskets}|${smoking ? 1 : 0}`, () => {
        const list = [{ key: ice ? 'wharf:ice' : 'wharf', n: 1, mats: SIDE_MATS[side], state }];
        if (baskets) list.push({ key: 'vessel:catch', n: baskets, mats: placeMats(FISH_WHARF.baskets.slice(0, baskets).map(([x, y, z], i) => [x, y, z, i * 1.3]), side), state: 'always' });
        if (smoking) list.push(atPoint('sacra:smoke:thin', FISH_WHARF.hut.vent, side));
        return list;
      });
      const actors = castOf(`wharf|${side}|${state}`, () => turnActors(fishWharfActors(state), side));
      return { key: 'wharf:none', state, ice: false, more, actors };
    },
    build(key, lod) {
      const kind = key.split(':')[1];
      if (kind === 'none') return new Group();
      return buildFishWharf({ lod, ice: kind === 'ice' }).group;
    },
  }),
});
