/**
 * models/venueShow.js
 * ----------------------------------------------------------------------------
 * The shows that move about their venue: gladiators fighting in the
 * amphitheatre and the Great Arena, a hunter and a lion in the Arena, four
 * chariots racing round the Circus's spina. Pure: no three, no GPU (the
 * tests read it).
 *
 * They are drawn by the units' pass (render3d/units/), whose figures carry
 * the gladiators' kit (the murmillo's fish-crested helmet, the thraex's
 * griffin and curved sica, the retiarius's net and trident), the fight
 * clips timed to their blows, the beasts on their own skeleton and the
 * horses at the gallop: each show is a few made-up units, never the sim's
 * (their ids are negative, from the venue's id), placed on the map's tiles
 * as a unit is, and handed to the pass with the real ones each frame
 * (webglBackend.js venueShows). Every clock here is the game's (ticks):
 * paused, a show is a still picture, and at 4x it runs four times as fast.
 *
 *   bouts   a pair of gladiators (two at the Arena): they circle each
 *           other, then trade blows, each flinching at the other's
 *           (sim-like strikeTick and hitTick, so the units' motion lands
 *           every blow on its tick); the classic pairings, a murmillo
 *           against a thraex, a retiarius against a secutor
 *   hunt    a venator with his spear against a lion: it lopes round him,
 *           rushes in and bites while he thrusts, and backs off again
 *   races   four chariots of the four factions (red, white, green, blue)
 *           round the spina, lapping at a gallop on their own lanes, each a
 *           little faster or slower by turns so they pass; seven laps a race
 *           (the eggs and dolphins count them: models/circus.js)
 * ----------------------------------------------------------------------------
 */

import { spanOrigin } from '../../sim/entities.js';
import { turnUV, turnDir } from '../../render/turn.js';
import { TILE_M } from '../walkers/motion.js';

/** Ticks a second at 1x (config.js TICKS_PER_SECOND; kept here so this module stays light). */
export const SHOW_TPS = 8;

/** A venue's own metres (x, z from its footprint's middle) to the map's tiles, turned as it is. */
export function localToMap(b, lx, lz) {
  const S = b.size;
  const [u, v] = turnUV(S / 2 + lx / TILE_M, S / 2 + lz / TILE_M, S, b.turn || 0);
  return [b.x + u, b.y + v];
}

/** A direction in a venue's own frame (x, z) on the map, turned as it is. */
export function localDirToMap(b, dx, dz) {
  return turnDir(dx, dz, b.turn || 0);
}

/**
 * A point of the Circus's track on the map: U tiles along its 15 from the
 * rounded end (the main section's outer edge), v across its 5, for the
 * hippodrome whose main section is `b` (as renderer.js raceSpot lays the
 * 2D race: the sections in the row sim/entities.js spanLayout makes).
 */
export function trackToMap(b, U, v) {
  const t = (b.turn || 0) & 3;
  const o = spanOrigin(b.def || { size: b.size, span: 3 }, b.x, b.y, t);
  const L = b.size * 3;
  const S = b.size;
  if (t === 1) return [o.x + S - v, o.y + U];
  if (t === 2) return [o.x + L - U, o.y + S - v];
  if (t === 3) return [o.x + v, o.y + L - U];
  return [o.x + U, o.y + v];
}

/** A direction along the track (dU, dv) on the map. */
export function trackDirToMap(b, dU, dv) {
  return turnDir(dU, dv, b.turn || 0);
}

// ---------------------------------------------------------------------------
// The race
// ---------------------------------------------------------------------------

/**
 * The Circus's race course in track tiles: the spina's two turning posts
 * (metae) at U0 and U1 on the middle line v = 2.5, the lanes round them
 * at radius `lane` (tiles), the chariots' laps counted from the start at
 * the starting gates' end. Matches models/circus.js's spina.
 */
export const RACE = Object.freeze({ U0: 3.2, U1: 11.8, mid: 2.5, lanes: Object.freeze([0.62, 0.84, 1.06, 1.28]), speed: 0.23, laps: 7 });

/** A point `s` tiles round a lane of radius r (from the start, along the far straight toward the rounded end): [U, v, dU, dv]. */
export function laneAt(r, s) {
  const { U0, U1, mid } = RACE;
  const straight = U1 - U0;
  const arc = Math.PI * r;
  const L = 2 * straight + 2 * arc;
  let q = ((s % L) + L) % L;
  // The straight on the low v side, run toward the rounded end (-U), as Rome's ran anticlockwise from the gates.
  if (q < straight) return [U1 - q, mid - r, -1, 0];
  q -= straight;
  // Round each turning post clockwise in (U, v): the angle falls from where the straight left off.
  if (q < arc) {
    const a = -Math.PI / 2 - q / r;
    return [U0 + Math.cos(a) * r, mid + Math.sin(a) * r, Math.sin(a), -Math.cos(a)];
  }
  q -= arc;
  if (q < straight) return [U0 + q, mid + r, 1, 0];
  q -= straight;
  const a = Math.PI / 2 - q / r;
  return [U1 + Math.cos(a) * r, mid + Math.sin(a) * r, Math.sin(a), -Math.cos(a)];
}

/** A lane's length (tiles). */
export function laneLength(r) {
  return 2 * (RACE.U1 - RACE.U0) + 2 * Math.PI * r;
}

/**
 * Chariot k's place `tick` ticks into the game: its lane, how far it has
 * run (tiles), where, which way. Each runs its own lane at the race's
 * speed made faster and slower by turns (two slow waves of its own), so
 * they pass and are passed; their distance is kept round the inside lane's
 * length so the laps are counted alike.
 */
export function chariotAt(k, tick) {
  const r = RACE.lanes[k];
  const base = RACE.speed * tick;
  // (The waves' integrals: the extra distance gained by now, a few tiles either way.)
  const w1 = 0.011 + k * 0.0017;
  const w2 = 0.0047 + k * 0.0011;
  const extra = 1.8 * Math.sin(w1 * tick + k * 1.7) + 1.1 * Math.sin(w2 * tick + k * 2.9) - k * 0.6;
  const lap = laneLength(RACE.lanes[0]);
  const run = base + extra;
  const s = (run / lap) * laneLength(r);
  const [U, v, dU, dv] = laneAt(r, s);
  return { U, v, dU, dv, run, s };
}

/** Laps the leader has finished in the race now running (0 to RACE.laps; a new race starts after the last). */
export function lapsNow(tick) {
  const lap = laneLength(RACE.lanes[0]);
  let best = 0;
  for (let k = 0; k < RACE.lanes.length; k++) best = Math.max(best, chariotAt(k, tick).run);
  const laps = Math.max(0, Math.floor(best / lap));
  return laps % (RACE.laps + 1);
}

/** Where along the track (U, tiles) the leading chariot is now (the crowd rises as it passes). */
export function leaderU(tick) {
  let best = -Infinity;
  let U = 7.5;
  for (let k = 0; k < RACE.lanes.length; k++) {
    const c = chariotAt(k, tick);
    if (c.run > best) { best = c.run; U = c.U; }
  }
  return U;
}

// ---------------------------------------------------------------------------
// The figures
// ---------------------------------------------------------------------------

/** A made-up unit for the units' pass (the fields its motion and look read). */
function unit(id, type, extra) {
  return { id, type, side: 'show', moving: false, walked: 0, strikeTick: -99, hitTick: -99, state: 'fight', fort: 0, slot: 0, ...extra };
}

/** The latest tick at or before `now` of a beat every `every` ticks from `from` (or -99 before it). */
function lastBeat(now, from, every) {
  if (now < from) return -99;
  return from + Math.floor((now - from) / every) * every;
}

/**
 * A pair of gladiators about (cx, cz) (the venue's metres) at `tick`, of
 * kits `kits` [a, b] (0 murmillo, 1 thraex, 2 retiarius), `seed` setting
 * their own rhythm: [{ u, x, z, dx, dz, foe }] in the venue's metres
 * (foe the way to the other).
 */
export function boutAt(cx, cz, kits, tick, seed, idBase) {
  const P = 176;
  const t = (((tick + seed * 37) % P) + P) % P;
  const start = tick - t;
  const r = 0.85;
  const circling = t < 48;
  const a0 = seed * 1.3;
  const a = a0 + (Math.min(t, 48) / 48) * 1.6;
  const out = [];
  for (let k = 0; k < 2; k++) {
    const s = k ? -1 : 1;
    const x = cx + s * r * Math.cos(a);
    const z = cz + s * r * Math.sin(a);
    const u = unit(idBase - k, 'gladiator', { kit: kits[k], state: circling ? 'idle' : 'fight' });
    // Circling: a slow walk round, the ground covered (metres) driving the legs.
    u.moving = circling;
    u.walked = ((r * (a - a0)) / TILE_M + k * 0.5) % 100;
    const dx = circling ? -s * Math.sin(a) : 0;
    const dz = circling ? s * Math.cos(a) : 0;
    if (!circling) {
      // Blows by turns: one a cooldown (20 ticks) from the bout's start, the other half a beat after.
      const first = start + 48 + (k ? 10 : 0);
      u.strikeTick = lastBeat(tick, first, 20);
      // A blow taken: the other's, a few ticks after it fell (its clip's blow lands near its middle).
      const other = lastBeat(tick, start + 48 + (k ? 0 : 10), 20);
      u.hitTick = other > -99 ? other + 5 : -99;
    }
    out.push({ u, x, z, dx, dz, foe: [-s * Math.cos(a), -s * Math.sin(a)] });
  }
  return out;
}

/** The venator and the lion about (cx, cz): the lion lopes round him, rushes in and bites, backs off. */
export function huntAt(cx, cz, tick, idBase) {
  const P = 160;
  const t = ((tick % P) + P) % P;
  const out = [];
  const hunter = unit(idBase, 'gladiator', { look: 'venator', state: 'fight' });
  const rushing = t >= 72;
  let a = (t / 72) * Math.PI * 1.6;
  let r = 1.9;
  if (rushing) {
    a = Math.PI * 1.6;
    r = Math.max(0.95, 1.9 - (t - 72) * 0.12);
  }
  const lx = cx + r * Math.cos(a);
  const lz = cz + r * Math.sin(a);
  // He turns to face it and thrusts while it is close.
  if (rushing && r < 1.2) hunter.strikeTick = lastBeat(tick, tick - t + 80, 20);
  out.push({ u: hunter, x: cx, z: cz, dx: 0, dz: 0, foe: [lx - cx, lz - cz] });
  const lion = unit(idBase - 1, 'wolf', { look: 'lion', state: rushing ? 'fight' : 'hunt' });
  lion.moving = !rushing || r > 0.96;
  // (The lion is drawn half again a wolf's size: its legs keep pace with the ground at that size.)
  lion.walked = ((1.9 * Math.min(t, 72) / 72 * Math.PI * 1.6 + (rushing ? (1.9 - r) : 0)) / TILE_M / 1.45) % 100;
  const dx = rushing ? -Math.cos(a) : -Math.sin(a);
  const dz = rushing ? -Math.sin(a) : Math.cos(a);
  if (rushing && r <= 0.96) lion.strikeTick = lastBeat(tick, tick - t + 81, 16);
  out.push({ u: lion, x: lx, z: lz, dx: lion.moving ? dx : 0, dz: lion.moving ? dz : 0, foe: [cx - lx, cz - lz] });
  return out;
}

/** The four chariots at `tick`: [{ u, U, v, dU, dv }] in track tiles. */
export function raceAt(tick, idBase) {
  const out = [];
  for (let k = 0; k < 4; k++) {
    const c = chariotAt(k, tick);
    const u = unit(idBase - k, 'chariot', { look: 'racer', faction: k, state: 'engage', moving: true });
    u.walked = (c.s % 100 + 100) % 100;
    out.push({ u, U: c.U, v: c.v, dU: c.dU, dv: c.dv });
  }
  return out;
}

/** Ids for a venue's show figures: negative, from its id, clear of every other's. */
export function showIds(b) {
  return -1000000 - (b.id || 0) * 16;
}

/**
 * Where each venue's shows stand, in its own metres: the bouts' middles,
 * the hunt's (models/amphitheatrum.js, arena.js keep their sand there).
 */
export const SHOW_SPOTS = Object.freeze({
  amphitheater: Object.freeze({ bouts: Object.freeze([Object.freeze([0.5, 0.15])]) }),
  colosseum: Object.freeze({ bouts: Object.freeze([Object.freeze([-2.2, 0.35]), Object.freeze([0.4, -0.55])]), hunt: Object.freeze([2.2, 0.45]) }),
});

/** The pairings of the bouts: a murmillo against a thraex, a retiarius against a secutor (the murmillo's helmet). */
const PAIRS = [[0, 1], [2, 0]];

/**
 * A venue's show figures now: [{ u, at: { fx, fy, dx, dy, foe, stride } }]
 * (map tiles; the caller adds the view: vt, W, H, lift). None unless a show
 * of theirs is on (staffed, booked); a hippodrome's race from its main
 * section only. `state` and `acts` as models/venues.js works them out
 * (given by the caller; else read off the building).
 */
export function venueShowList(b, game, tick, { state, acts } = {}) {
  const out = [];
  if (b.main) return out;
  const on = b.efficiency > 0 && !!b.shows && Object.values(b.shows).some((d) => d > 0);
  if ((state ?? (on ? 'open' : 'out')) !== 'open') return out;
  const a = acts ?? { bouts: b.shows.amphitheater > 0, hunt: b.shows.colosseum > 0, races: b.shows.hippodrome > 0 };
  const ids = showIds(b);
  const put = (f) => {
    const [fx, fy] = localToMap(b, f.x, f.z);
    const [dx, dy] = localDirToMap(b, f.dx, f.dz);
    const foe = f.foe ? localDirToMap(b, f.foe[0], f.foe[1]) : null;
    out.push({ u: Object.assign(f.u, { x: fx, y: fy }), at: { fx, fy, dx: dx * 0.01, dy: dy * 0.01, foe, stride: f.u.walked } });
  };
  const spots = SHOW_SPOTS[b.type];
  if (spots && a.bouts) spots.bouts.forEach(([cx, cz], k) => boutAt(cx, cz, PAIRS[k % PAIRS.length], tick, b.id * 3 + k, ids - k * 2).forEach(put));
  if (spots && spots.hunt && a.hunt) huntAt(spots.hunt[0], spots.hunt[1], tick, ids - 8).forEach(put);
  if (b.type === 'hippodrome' && a.races) {
    for (const c of raceAt(tick, ids - 10)) {
      const [fx, fy] = trackToMap(b, c.U, c.v);
      const [dx, dy] = trackDirToMap(b, c.dU, c.dv);
      out.push({ u: Object.assign(c.u, { x: fx, y: fy }), at: { fx, fy, dx: dx * 0.01, dy: dy * 0.01, foe: null, stride: c.u.walked } });
    }
  }
  return out;
}
