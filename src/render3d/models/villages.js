/**
 * models/villages.js
 * ----------------------------------------------------------------------------
 * The native villages as the game draws them (render3d/models.js MODELS
 * takes these entries as they are): the hut (Tugurium, models/tugurium.js),
 * the meeting place (Concilium, concilium.js) and the plot (Arvum,
 * arvum.js), their villagers as people (people/actors.js) and their flocks
 * (pecus.js), from the sim's own fields, read only (sim/natives.js).
 *
 * The people: the city's villages' (game.city.natives.people): 'ligurian'
 * in the missions that have them (Mutina, Luna), 'native' (the generic Iron
 * Age people) in the sandbox; each its own huts, meeting place and plots.
 *
 * States (villageState), the same for every piece of a village:
 *   'calm'   calmed by a missionary (anger under ANGER_MAX) and no attack:
 *            at work and at peace: the women grinding and spinning at their
 *            doors, the men at the hurdles and the flock, the children at
 *            play, the elders by a cooking fire under the cauldron, a plot
 *            being hoed
 *   'trade'  calm, and a mission post at work (sim/natives.js postWorking:
 *            the villages send their traders then): as calm, and the goods
 *            laid out at the meeting place for the native trader
 *   'angry'  a hut or meeting place whose anger is at ANGER_MAX (a plot
 *            follows its meeting place): the men gathered at the meeting
 *            place with their spears, one sounding the war horn, the fire
 *            built high, the spears and shields out by the shelter; at the
 *            huts a man at each door with his spear, fewer in the plots
 *   'war'    the village is attacking (the meeting place's attackDays): its
 *            men are away (they are the villagers out as units), so the
 *            huts and plots have only the women, children and old, the horn
 *            still calling at the meeting place and the fire high
 * A ghost or a piece seen without a game is 'calm'.
 *
 * Every piece's look is several kits instanced apart (`more`; its own kit
 * is empty), so that the things many share are drawn once for all of them:
 *   tugurium:<people>:<form>:<age>   a hut (six forms, two thatches), turned
 *                                    so its door faces its meeting place
 *   tugx:<thing>                     a yard's quern, woodpile, jars, rack,
 *                                    loom, chopping block, hurdle, beehive
 *   vsmoke:<hut|fire|war>            the smoke of a hut's hearth through its
 *                                    thatch, of the meeting place's fire
 *   concilium:<people>               the meeting place's ring, logs, shelter,
 *                                    fold, stele or posts
 *   vfire:<small|great>, vcauldron, varms:<people>, vgoods, voak:<look>
 *   arvum:<people>:<crop>:<stage>    a plot, its crop by the month
 *   pecus:<sheep|goat>:<coat>:<pose> a beast of the flock, moving by its
 *                                    matrix (livestock.js herdPlaces)
 * A piece's list is kept per building by a signature of its look (its form,
 * turn, things, state, month), made again only when that changes; its
 * beasts' matrices alone are refilled each frame.
 *
 * Night: each hut's hearth glows through its door (a lamp on its door's
 * side), the meeting place's fire (given facing both ways: open on all
 * sides). Variety: a piece's form, thatch, things, crop, coats and people
 * from its id (hash01: the same after a reload), so a village of eight huts
 * is not a pattern.
 * ----------------------------------------------------------------------------
 */

import { Group, Matrix4, Quaternion, Vector3 } from 'three';
import { NATIVES } from '../../data/natives.js';
import { postWorking } from '../../sim/natives.js';
import { cast, NOBODY, DYES, hash01, pick } from '../people/actors.js';
import { QUERN } from '../people/clips.js';
import { buildHut, yardThing, HUT_FORMS, HUT } from './tugurium.js';
import { buildConcilium, buildFire, buildCauldron, buildArms, buildGoods, buildOak, CONCILIUM } from './concilium.js';
import { buildPlot, CROPS, cropStage } from './arvum.js';
import { buildBeast, SHEEP_COATS, GOAT_COATS } from './pecus.js';
import { buildSmoke } from './sacra.js';
import { herdPlaces, penCells } from './livestock.js';
import { lookOf } from '../flora/species.js';
import { TaggedParts } from './masonry.js';
import { steamMaterial, plume } from './healing.js';

/** The types drawn here. */
export const VILLAGE_TYPES = Object.freeze(['native_hut', 'native_meeting', 'native_crops']);
/** The states (see the header). */
export const VILLAGE_STATES = Object.freeze(['calm', 'trade', 'angry', 'war']);

const TAU = Math.PI * 2;
const Q = Math.PI / 2;

/** The people of a game's villages: 'ligurian' or the generic 'native' (the sandbox's, and a look without a game). */
export function villagePeople(game) {
  const p = game && game.city && game.city.natives ? game.city.natives.people : null;
  return p === 'ligurian' ? 'ligurian' : 'native';
}

/** Per game, what every piece asks once a tick: is a mission post at work (the villages trade)? */
const WATCH = new WeakMap();
function watchOf(game) {
  const tick = game.time ? game.time.totalTicks : 0;
  let w = WATCH.get(game);
  if (w && w.tick === tick) return w;
  w = { tick, post: !!game.buildings && postWorking(game) };
  WATCH.set(game, w);
  return w;
}

/** A piece's meeting place (itself for a meeting place), or null. */
function meetingOf(b, game) {
  if (b.type === 'native_meeting') return b;
  return game && game.buildings && b.village ? game.buildings.get(b.village) || null : null;
}

/** A village piece's state from the sim (see the header). */
export function villageState(b, game) {
  if (!game || b.id === null || b.id === undefined) return 'calm';
  const m = meetingOf(b, game);
  if (m && m.attackDays > 0) return 'war';
  const anger = b.type === 'native_crops' ? (m ? m.anger : 0) : b.anger;
  if ((anger ?? 0) >= NATIVES.ANGER_MAX) return 'angry';
  return watchOf(game).post ? 'trade' : 'calm';
}

// ---------------------------------------------------------------------------
// Matrices
// ---------------------------------------------------------------------------

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const UP = new Vector3(0, 1, 0);

/** One matrix (Float32Array of 16): at (x, z) on the ground, turned `ry`, scaled `s`. */
function at(x, z, ry = 0, s = 1, y = 0) {
  _p.set(x, y, z);
  _q.setFromAxisAngle(UP, ry);
  _s.setScalar(s);
  return _m.compose(_p, _q, _s).toArray(new Float32Array(16));
}

/** (x, z) turned `ry` about the origin (as a kit's matrix turns its frame). */
function turn(x, z, ry) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return [x * c + z * s, -x * s + z * c];
}

/** Write a stand-up matrix into `arr` at slot `i`. */
function put(arr, i, x, z, yaw, s = 1) {
  _p.set(x, 0, z);
  _q.setFromAxisAngle(UP, yaw);
  _s.setScalar(s);
  _m.compose(_p, _q, _s).toArray(arr, i * 16);
}

/**
 * The flock: n beasts of a kind's coats wandering their cells, their kits'
 * entries in `more` (matrices refilled each frame by moveFlock). `frame`
 * turns the cells (the piece's turn about its middle).
 */
function flock(more, n, cells, seed, kinds, rot) {
  const slots = new Map();
  const which = [];
  for (let i = 0; i < n; i++) {
    const kind = kinds[i % kinds.length];
    const coats = kind === 'goat' ? GOAT_COATS.length : SHEEP_COATS.length;
    const coat = Math.floor(hash01(seed, i, 21) * coats);
    which.push(['stand', 'graze'].map((pose) => {
      const key = `pecus:${kind}:${coat}:${pose}`;
      let e = slots.get(key);
      if (!e) {
        e = { key, mats: new Float32Array(16 * n), n: 0, state: 'always' };
        slots.set(key, e);
        more.push(e);
      }
      return e;
    }));
  }
  return { n, which, cells, slots: [...slots.values()], seed: seed * 7 + 3, places: [], rot };
}

/** Move a flock to where it is at time `t` (s). */
function moveFlock(f, t) {
  for (const e of f.slots) e.n = 0;
  herdPlaces(f.n, f.cells, f.seed, t, f.places, { pace: 0.22, still: 0.62 });
  for (let i = 0; i < f.n; i++) {
    const o = f.places[i];
    const e = f.which[i][o.pose];
    const [x, z] = turn(o.x, o.z, f.rot);
    put(e.mats, e.n++, x, z, o.yaw + f.rot, 1);
  }
}

// ---------------------------------------------------------------------------
// The villagers
// ---------------------------------------------------------------------------

/** Undyed wool in its sheep's shades, as the villagers' tunics (and the units' villagers: units/look.js). */
const UNDYED = [DYES.undyed, DYES.oatmeal, DYES.fawn, DYES.brownWool, DYES.grey];
const SKIN = [0xb88560, 0xa87452, 0x9a6a4a, 0xc8956c, 0xbf8b62];
const HAIR = [0x1d1612, 0x2a1e16, 0x3a2a1c, 0x4a3424, 0x6a4428];
/** The generic people's cloaks and shawls (the units' villagers' cloaks), the Ligurians' fleeces. */
const CLOAKS = [DYES.brownWool, DYES.green, DYES.ochre, DYES.walnut];
const FLEECES = [0xcfc2a2, 0x9a8668, 0x6e604f, 0xd8ccb0];
const SHAWLS = { ligurian: [DYES.walnut, DYES.fawn, DYES.brownWool, DYES.oatmeal], native: [DYES.woad, DYES.madder, DYES.green, DYES.walnut, DYES.weld] };

/**
 * A villager's look: `who` 'man', 'woman', 'child', 'elder', 'crone'; the
 * Ligurians' men in short tunics of undyed wool and sheepskins, barefoot,
 * their hair long; the generic people's in knee-length tunics and cloaks,
 * bearded, as their villagers look in a raid (units/look.js villager).
 */
function villager(who, people, seed, more = {}) {
  const r = (k) => hash01(seed, k);
  const c = { tunic: pick(UNDYED, seed, 1), skin: pick(SKIN, seed, 3), hair: pick(HAIR, seed, 4), leather: 0x6a4a2e };
  const lig = people === 'ligurian';
  let spec;
  if (who === 'woman' || who === 'crone') {
    c.mantle = pick(SHAWLS[people], seed, 2);
    if (!lig && r(5) < 0.5) c.tunic = pick([DYES.ochre, DYES.oatmeal, DYES.rose, DYES.undyed], seed, 6);
    spec = { body: 'f', dress: ['tunic:long', ...(r(7) < (who === 'crone' ? 0.9 : 0.45) ? ['palla'] : [])], hair: 'bun', old: who === 'crone' };
  } else if (who === 'child') {
    spec = { body: 'c', dress: ['tunic:short'], hair: r(7) < 0.5 ? 'curls' : 'crop' };
  } else if (lig) {
    c.mantle = pick(FLEECES, seed, 2);
    const long = r(8) < 0.6 || who === 'elder';
    spec = { body: 'm', dress: [r(9) < 0.5 ? 'tunic:short' : 'tunic:knee', 'ugear:hide', 'ugear:belt', ...(long ? ['ugear:longhair'] : [])], hair: long ? null : 'curls', beard: who === 'elder' || r(10) < 0.6 ? 'short' : null, old: who === 'elder' };
    if (who === 'elder') spec.beard = 'full';
  } else {
    c.mantle = pick(CLOAKS, seed, 2);
    spec = { body: 'm', dress: ['tunic:knee', ...(r(8) < 0.45 || who === 'elder' ? ['ugear:sagum'] : [])], hair: 'curls', beard: 'full', old: who === 'elder' };
  }
  if (spec.old) c.hair = pick([0x8a8478, 0xa8a296, 0xc8c2b6, 0x6e6860], seed, 11);
  const { colours: own, ...rest } = more;
  return { ...spec, seed, ...rest, colours: { ...c, ...(own || {}) } };
}

/** An actor spec moved by the piece's turn `rot` about its middle (its place and facing, its route's ends' facings). */
function turned(a, rot) {
  const [x, z] = turn(a.at[0], a.at[2], rot);
  const out = { ...a, at: [x, a.at[1], z], ry: (a.ry || 0) + rot };
  if (a.route) {
    out.route = { ...a.route };
    if (a.route.faceEnd !== undefined) out.route.faceEnd = a.route.faceEnd + rot;
    if (a.route.faceStart !== undefined) out.route.faceStart = a.route.faceStart + rot;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The hut
// ---------------------------------------------------------------------------

/**
 * The hut's look from its id and its village: its form (the people's three,
 * the round and oval huts the commonest), its thatch's age, its door's turn
 * (toward its meeting place: a quarter turn, the hut itself a little off it),
 * what is in its yard and who works there.
 */
export function hutLook(b, game, people) {
  const id = b.id ?? 0;
  const h = (k) => hash01(id, k, 3);
  const forms = HUT_FORMS[people];
  const f = h(1);
  const form = forms[f < 0.45 ? 0 : f < 0.8 ? 1 : 2];
  // Its door toward the meeting place (the map's frame is the model's at the art's turn 0: models.js).
  const m = meetingOf(b, game);
  let face = h(2) * TAU;
  if (m) face = Math.atan2(m.x + m.size / 2 - (b.x + 0.5), m.y + m.size / 2 - (b.y + 0.5));
  const q = ((Math.round(face / Q) % 4) + 4) % 4;
  return {
    people, form, age: h(3) < 0.4 ? 1 : 0, q, jitter: (h(4) - 0.5) * 0.36,
    work: h(5) < 0.55 ? 'grind' : 'spin',
    things: thingsOf(h),
    man: h(7) < 0.5 ? 'mend' : 'herd',
    child: h(8) < 0.55,
    goats: h(9) < 0.4 ? 1 + Math.floor(h(10) * 2) : 0,
    crone: h(11) < 0.3,
  };
}

/** A hut's yard things beside its quern (two of them, by its id). */
function thingsOf(h) {
  const pool = ['woodpile', 'pots', 'rack', 'loom', 'chop', 'skep'];
  const a = pool[Math.floor(h(12) * pool.length) % pool.length];
  let b = pool[Math.floor(h(13) * pool.length) % pool.length];
  if (b === a) b = pool[(pool.indexOf(a) + 3) % pool.length];
  return [a, b];
}

/**
 * The yard's places, the hut's door toward +z (all within its tile: the yard
 * turns by quarter turns only, which keeps a square in its tile):
 *   quern   where the grinder kneels (the quern is built ahead of her)
 *   door    by the door (a spinner, a man on guard)
 *   a, b    the two things' places; c a third (the hurdle the man mends)
 *   child   where a child squats at play
 *   pen     the goats' corner [x0, z0, x1, z1]
 */
export const YARD = Object.freeze({
  quern: [-1.62, 1.12, Q], door: [0.72, 1.42, -2.6], a: [1.45, -1.5, Math.PI * 0.75], b: [-1.42, -1.55, -Math.PI * 0.75],
  c: [1.5, 0.92, -Q], child: [0.15, 1.72, Math.PI], pen: [0.9, 1.0, 1.9, 1.9], herd: [1.0, 1.55, -2.2],
});

/** Every look's hut kit at the hut's turn, its things, the hearth's smoke over the apex. */
function hutMore(L) {
  const rot = L.q * Q;
  const yaw = rot + L.jitter;
  const more = [{ key: `tugurium:${L.people}:${L.form}:${L.age}`, n: 1, mats: at(0, 0, yaw), state: 'always' }];
  const [ax, ay, az] = HUT[L.form].apex;
  const [sx, sz] = turn(ax, az, yaw);
  more.push({ key: 'vsmoke:hut', n: 1, mats: at(sx, sz, 0, 1, ay - 0.1), state: 'always' });
  if (L.work === 'grind') {
    const [x, z, r] = YARD.quern;
    const [px, pz] = turn(x, z, rot);
    more.push({ key: 'tugx:quern', n: 1, mats: at(px, pz, r + rot), state: 'always' });
  }
  for (const [k, name] of [['a', L.things[0]], ['b', L.things[1]]]) {
    const [x, z, r] = YARD[k];
    const [px, pz] = turn(x, z, rot);
    more.push({ key: `tugx:${name}`, n: 1, mats: at(px, pz, r + rot), state: 'always' });
  }
  if (L.man === 'mend') {
    const [x, z, r] = YARD.c;
    const [px, pz] = turn(x, z, rot);
    more.push({ key: 'tugx:hurdle', n: 1, mats: at(px, pz, r + rot), state: 'always' });
  }
  return more;
}

/** A hut's people in a state (actor specs in the tile's frame). */
export function hutActors(L, state, seed) {
  const rot = L.q * Q;
  const out = [];
  const p = L.people;
  const away = state === 'war';
  const roused = state === 'angry';
  if (!roused) {
    if (L.work === 'grind') {
      const [x, z, r] = YARD.quern;
      out.push(villager('woman', p, seed + 1, { clip: 'grind', props: { R: 'muller' }, at: [x, 0, z], ry: r }));
    } else {
      const [x, z, r] = YARD.door;
      out.push(villager('woman', p, seed + 1, { clip: 'spin', props: { L: 'distaff', R: 'spindle' }, at: [x, 0, z], ry: r }));
    }
    if (L.child && !away) {
      const [x, z, r] = YARD.child;
      out.push(villager('child', p, seed + 3, { clip: 'play', at: [x, 0, z], ry: r }));
    }
    if (!away) {
      if (L.man === 'mend') {
        // At the hurdle by the wall, mending its withies.
        const [x, z, r] = YARD.c;
        const [dx, dz] = turn(0, 0.42, r);
        out.push(villager('man', p, seed + 2, { clip: 'hammer', props: { L: 'chisel', R: 'hammer' }, at: [x + dx, 0, z + dz], ry: r + Math.PI }));
      } else if (L.goats) {
        const [x, z, r] = YARD.herd;
        out.push(villager('man', p, seed + 2, { clip: 'lean', props: { R: 'crook' }, at: [x, 0, z], ry: r }));
      }
    } else if (L.crone) {
      const [x, z, r] = YARD.herd;
      out.push(villager('crone', p, seed + 4, { clip: 'listen', at: [x, 0, z], ry: r }));
    }
  } else {
    // Roused: the man at his door with his spear, his wife beside him, the children kept in.
    const [x, z, r] = YARD.door;
    out.push(villager('man', p, seed + 2, { clip: 'guard', props: { R: 'spear' }, at: [x, 0, z], ry: r + 0.3 }));
    out.push(villager('woman', p, seed + 1, { clip: 'listen', at: [-0.75, 0, 1.55], ry: Math.PI * 0.85 }));
  }
  return out.map((a) => turned(a, rot));
}

const HUT_CASTS = new Map();
/** A hut's cast, kept by its look and state. */
function hutCast(L, state, seed) {
  const sig = `${L.people}|${L.form}|${L.q}|${L.work}|${L.man}|${L.child}|${L.goats}|${L.crone}|${state}|${seed}`;
  let c = HUT_CASTS.get(sig);
  if (!c) {
    const list = hutActors(L, state, seed);
    c = list.length ? cast(list) : NOBODY;
    if (HUT_CASTS.size > 4000) HUT_CASTS.clear();
    HUT_CASTS.set(sig, c);
  }
  return c;
}

/** The hut's lamp: its hearth glowing through its door (in the tile's frame), facing out of the door. */
function hutLamp(L) {
  const yaw = L.q * Q + L.jitter;
  const [dx, dz] = HUT[L.form].door;
  const [x, z] = turn(dx, dz, yaw);
  return [x, 0.55, z, Math.cos(yaw), Math.sin(yaw)];
}

// ---------------------------------------------------------------------------
// The meeting place
// ---------------------------------------------------------------------------

/** The meeting place's turn (a quarter turn by its id: three villages not alike). */
function meetingTurn(b) {
  return Math.floor(hash01(b.id ?? 0, 5, 7) * 4) % 4;
}

/** The meeting place's kits in a state, turned `q` quarter turns; `month` the oak's look's. */
function meetingMore(people, state, q, month, seed) {
  const rot = q * Q;
  const I = at(0, 0, rot);
  const more = [{ key: `concilium:${people}`, n: 1, mats: I, state: 'always' }];
  const roused = state === 'angry' || state === 'war';
  more.push({ key: `vfire:${roused ? 'great' : 'small'}`, n: 1, mats: I, state: 'always' });
  if (!roused) more.push({ key: 'vcauldron', n: 1, mats: I, state: 'always' });
  else more.push({ key: `varms:${people}`, n: 1, mats: I, state: 'always' });
  if (state === 'trade') more.push({ key: 'vgoods', n: 1, mats: I, state: 'always' });
  more.push({ key: `voak:${lookOf('oak', month)}`, n: 1, mats: I, state: 'always' });
  const [hx, hz] = CONCILIUM.hearth;
  const [sx, sz] = turn(hx, hz, rot);
  more.push({ key: `vsmoke:${roused ? 'war' : 'fire'}`, n: 1, mats: at(sx, sz, 0, 1, roused ? 1.2 : 2.1), state: 'always' });
  // The flock in the fold: four or five, sheep and goats.
  const [x0, z0, x1, z1] = CONCILIUM.fold;
  const n = 4 + Math.floor(hash01(seed, 31) * 2);
  const f = flock(more, n, penCells([x0 + 0.1, z0 + 0.1, x1 - 0.1, z1 - 0.1], Math.max(n, 4)), seed, people === 'ligurian' ? ['sheep', 'goat', 'sheep'] : ['sheep', 'sheep', 'goat'], rot);
  return { more, flock: f };
}

/** The meeting place's people in a state (actor specs, its frame before its turn). */
export function meetingActors(people, state, seed) {
  const p = people;
  const out = [];
  const [hx, hz] = CONCILIUM.hearth;
  const logs = CONCILIUM.logs;
  /** A seat on log k, `d` along it, facing the fire. */
  const seat = (k, d) => {
    const [x, z, ry] = logs[k];
    const [dx, dz] = turn(d, 0, ry);
    const sx = x + dx;
    const sz = z + dz;
    return { at: [sx, 0, sz], ry: Math.atan2(hx - sx, hz - sz) };
  };
  const toFire = (x, z) => Math.atan2(hx - x, hz - z);
  if (state === 'calm' || state === 'trade') {
    out.push(villager('elder', p, seed + 1, { clip: 'sitTalk', ...seat(0, -0.25) }));
    out.push(villager('elder', p, seed + 2, { clip: 'sit', ...seat(0, 0.32) }));
    out.push(villager('crone', p, seed + 3, { clip: 'listen', ...seat(1, 0.1) }));
    // The cook at the cauldron, stirring (the clips' MORTAR: she stands its `ahead` from its middle).
    const cx = hx - 0.62;
    const cz = hz + 0.5;
    out.push(villager('woman', p, seed + 4, { clip: 'stir', props: { R: 'pestle' }, at: [cx, 0, cz], ry: toFire(cx, cz) }));
    // The herdsman by the fold, children at play by the fire, a woman bringing water.
    out.push(villager('man', p, seed + 5, { clip: 'lean', props: { R: 'crook' }, at: [1.1, 0, 1.25], ry: 0.6 }));
    out.push(villager('child', p, seed + 6, { clip: 'play', at: [-0.55, 0, -0.75], ry: 0.4 }));
    out.push(villager('child', p, seed + 7, { clip: 'play', at: [-0.1, 0, -1.05], ry: -0.5 }));
    out.push(villager('woman', p, seed + 8, {
      clip: 'jarCarry', props: { L: 'jar' }, at: [-3.2, 0, -0.4], ry: 0.15, colours: { leather: 0xa0603a },
      route: { length: 2.6, speed: 0.6, pauseEnd: 3, pauseStart: 5, clipEnd: 'jarStand', clipStart: 'jarStand' },
    }));
    if (state === 'trade') {
      const [gx, gz] = CONCILIUM.goods;
      out.push(villager('man', p, seed + 9, { clip: 'talk', at: [gx + 0.15, 0, gz - 0.95], ry: 0.2 }));
      out.push(villager('woman', p, seed + 10, { clip: 'count', at: [gx + 0.95, 0, gz - 0.25], ry: -1.9 }));
    }
  } else {
    // Roused: the elder speaking by the fire, the war horn sounding; in an attack the men are away.
    out.push(villager('elder', p, seed + 1, { clip: 'orate', at: [hx - 1.0, 0, hz - 0.95], ry: toFire(hx - 1.0, hz - 0.95) + 0.3 }));
    out.push(villager(state === 'war' ? 'elder' : 'man', p, seed + 11, { clip: 'horn', props: { R: 'horn' }, at: [hx + 1.3, 0, hz - 1.35], ry: -2.4 }));
    if (state === 'angry') {
      const men = [[-1.4, 1.2, 'protest'], [-0.45, 1.6, 'guard'], [0.75, 1.45, 'protest'], [1.45, 0.65, 'guard'], [-1.7, 0.1, 'guard'], [0.2, -1.6, 'protest'], [-0.95, -1.35, 'guard']];
      men.forEach(([x, z, clip], k) => out.push(villager('man', p, seed + 20 + k, { clip, props: { R: 'spear' }, at: [x, 0, z], ry: toFire(x, z) })));
      out.push(villager('woman', p, seed + 30, { clip: 'listen', at: [-2.35, 0, 1.75], ry: toFire(-2.35, 1.75) }));
    } else {
      out.push(villager('crone', p, seed + 3, { clip: 'listen', ...seat(1, 0.1) }));
      out.push(villager('woman', p, seed + 31, { clip: 'listen', at: [-1.55, 0, 1.45], ry: toFire(-1.55, 1.45) }));
      out.push(villager('woman', p, seed + 32, { clip: 'idle', at: [-0.6, 0, 1.75], ry: toFire(-0.6, 1.75) }));
      out.push(villager('child', p, seed + 33, { clip: 'idle', at: [-1.0, 0, 1.95], ry: toFire(-1.0, 1.95) }));
    }
  }
  return out;
}

const MEET_CASTS = new Map();
function meetingCast(people, state, q, seed) {
  const sig = `${people}|${state}|${q}|${seed}`;
  let c = MEET_CASTS.get(sig);
  if (!c) {
    c = cast(meetingActors(people, state, seed).map((a) => turned(a, q * Q)));
    if (MEET_CASTS.size > 400) MEET_CASTS.clear();
    MEET_CASTS.set(sig, c);
  }
  return c;
}

// ---------------------------------------------------------------------------
// The plot
// ---------------------------------------------------------------------------

/** A plot's look: its crop (by its id: a village grows several side by side), its stage by the month, its turn. */
export function plotLook(b, people, month) {
  const id = b.id ?? 0;
  const crops = CROPS[people];
  const crop = crops[Math.floor(hash01(id, 1, 9) * crops.length) % crops.length];
  return { people, crop, stage: cropStage(crop, month), q: Math.floor(hash01(id, 2, 9) * 4) % 4 };
}

/** Whether the plot is worked (by the season's stage), and by whom, in a state. */
export function plotActors(L, state, seed) {
  if (state === 'war' || L.stage === 'ripe') return [];
  if (state === 'angry' && hash01(seed, 4) < 0.6) return [];
  const winter = L.stage === 'bare' && hash01(seed, 5) < 0.5;
  if (winter) return [];
  const who = state === 'angry' || hash01(seed, 6) < 0.5 ? 'woman' : 'man';
  // Between two rows (the rows run along x, 0.3 apart from -1.65), hoeing along them.
  const z = -1.65 + 0.3 * (3 + Math.floor(hash01(seed, 7) * 5)) + 0.15;
  const x = -0.9 + hash01(seed, 8) * 1.6;
  return [turned(villager(who, L.people, seed, { clip: 'hoe', props: { R: 'hoe' }, at: [x, 0, z], ry: hash01(seed, 9) < 0.5 ? Q : -Q }), L.q * Q)];
}

const PLOT_CASTS = new Map();
function plotCast(L, state, seed) {
  const sig = `${L.people}|${L.crop}|${L.stage}|${L.q}|${state}|${seed}`;
  let c = PLOT_CASTS.get(sig);
  if (!c) {
    const list = plotActors(L, state, seed);
    c = list.length ? cast(list) : NOBODY;
    if (PLOT_CASTS.size > 2000) PLOT_CASTS.clear();
    PLOT_CASTS.set(sig, c);
  }
  return c;
}

// ---------------------------------------------------------------------------
// The entries
// ---------------------------------------------------------------------------

/** How long a piece's kept look is remembered unseen (frames). */
const KEEP = 600;

/** A memo per pass (ctx) by building id, pruned of the long unseen. */
function memoOf(ctx) {
  const memo = (ctx.villageMemo ??= new Map());
  if (ctx.frame % KEEP === 0 && memo.pruned !== ctx.frame) {
    memo.pruned = ctx.frame;
    for (const [id, m] of memo) if (ctx.frame - m.seen > KEEP) memo.delete(id);
  }
  return memo;
}

/** The lamps of the huts drawn (by id: models.js modelLamps asks of a building alone). */
const HUT_LAMPS = new Map();
const MEET_LAMPS = new Map();

const NONE = new Group();

/** A seed for a piece's people from its place (the same after a reload). */
function seedOf(b) {
  return ((b.x * 73 + b.y * 151 + (b.id || 0)) % 997) + 1;
}

const HUT_ENTRY = Object.freeze({
  // Every material a village's huts draw is in these (one look and one yard thing of each material).
  warm: ['tugurium:ligurian:round:0', 'tugurium:native:capanna:0', 'tugx:quern', 'tugx:loom', 'tugx:skep', 'vsmoke:hut', 'pecus:goat:0:stand'],
  variant(b, place, ctx) {
    const game = ctx ? ctx.game : null;
    const people = ctx && ctx.people ? ctx.people : villagePeople(game);
    const state = villageState(b, game);
    const L = hutLook(b, game, people);
    const seed = seedOf(b);
    const sig = `${people}|${L.form}|${L.age}|${L.q}|${L.jitter}|${L.work}|${L.things}|${L.man}|${L.goats}`;
    let e = null;
    if (ctx && ctx.frame !== undefined && b.id !== null && b.id !== undefined) {
      const memo = memoOf(ctx);
      e = memo.get(b.id);
      if (!e || e.sig !== sig) {
        e = { sig, more: hutMore(L) };
        if (L.goats) {
          const [x0, z0, x1, z1] = YARD.pen;
          e.flock = flock(e.more, L.goats, penCells([x0, z0, x1, z1], 2), seed, ['goat'], L.q * Q);
        }
        memo.set(b.id, e);
      }
      e.seen = ctx.frame;
      if (e.flock) moveFlock(e.flock, ctx.clock || 0);
      HUT_LAMPS.set(b.id, [hutLamp(L)]);
    } else {
      // A ghost or a look outside the game: built each time, the beasts standing.
      e = { more: hutMore(L) };
      if (L.goats) {
        const [x0, z0, x1, z1] = YARD.pen;
        const f = flock(e.more, L.goats, penCells([x0, z0, x1, z1], 2), seed, ['goat'], L.q * Q);
        moveFlock(f, 0);
      }
    }
    return { key: 'tugurium:none', state: 'always', ice: false, more: e.more, actors: hutCast(L, state, seed) };
  },
  lamps: (b) => HUT_LAMPS.get(b.id) || [],
  build: (key, lod) => buildPart(key, lod),
});

const MEETING_ENTRY = Object.freeze({
  warm: ['concilium:ligurian', 'concilium:native', 'vfire:great', 'vcauldron', 'varms:native', 'vgoods', 'voak:leaf', 'vsmoke:fire', 'pecus:sheep:0:stand'],
  variant(b, place, ctx) {
    const game = ctx ? ctx.game : null;
    const people = ctx && ctx.people ? ctx.people : villagePeople(game);
    const state = villageState(b, game);
    const q = meetingTurn(b);
    const month = ctx ? ctx.month : null;
    const seed = seedOf(b);
    const sig = `${people}|${state}|${q}|${lookOf('oak', month)}`;
    let e = null;
    if (ctx && ctx.frame !== undefined && b.id !== null && b.id !== undefined) {
      const memo = memoOf(ctx);
      e = memo.get(b.id);
      if (!e || e.sig !== sig) {
        e = { sig, ...meetingMore(people, state, q, month, seed) };
        memo.set(b.id, e);
      }
      e.seen = ctx.frame;
      moveFlock(e.flock, ctx.clock || 0);
      const [hx, hz] = CONCILIUM.hearth;
      const [x, z] = turn(hx, hz, q * Q);
      MEET_LAMPS.set(b.id, [[x, 0.7, z, 1, 0], [x, 0.7, z, -1, 0]]);
    } else {
      e = meetingMore(people, state, q, month, seed);
      moveFlock(e.flock, 0);
    }
    return { key: 'concilium:none', state: 'always', ice: false, more: e.more, actors: meetingCast(people, state, q, seed) };
  },
  lamps: (b) => MEET_LAMPS.get(b.id) || [],
  build: (key, lod) => buildPart(key, lod),
});

const CROPS_ENTRY = Object.freeze({
  // (Its soil is the 3D ground's, as a farm's field is: with the ground's sprites the plot keeps its sprite.)
  needsGround: true,
  warm: ['arvum:ligurian:spelt:green', 'arvum:native:beans:green'],
  variant(b, place, ctx) {
    const game = ctx ? ctx.game : null;
    const people = ctx && ctx.people ? ctx.people : villagePeople(game);
    const state = villageState(b, game);
    const L = plotLook(b, people, ctx ? ctx.month : null);
    const more = PLOT_MORE.get(`${people}|${L.crop}|${L.stage}|${L.q}`) || plotMore(L);
    return { key: 'arvum:none', state: 'always', ice: false, more, actors: plotCast(L, state, seedOf(b)) };
  },
  build: (key, lod) => buildPart(key, lod),
});

/** A plot's list (one kit turned), kept by its look. */
const PLOT_MORE = new Map();
function plotMore(L) {
  const list = Object.freeze([Object.freeze({ key: `arvum:${L.people}:${L.crop}:${L.stage}`, n: 1, mats: at(0, 0, L.q * Q), state: 'always' })]);
  PLOT_MORE.set(`${L.people}|${L.crop}|${L.stage}|${L.q}`, list);
  return list;
}

/** The smoke of a village's fires: a hut's thin wisps through its thatch, the cooking fire's, a roused village's great fire's. */
function buildVillageSmoke(kind, lod) {
  if (kind === 'war') return buildSmoke('thick', lod);
  if (kind === 'fire') return buildSmoke('thin', lod);
  // A hut's: low, faint and wide, seeping out round the smoke hole and drifting.
  const p = new TaggedParts('smoke-hut');
  const g = plume(0, 0, 0, { h: 1.6, r: 0.16, n: lod ? 2 : 3, cols: lod === 2 ? 3 : 5, rows: lod === 2 ? 4 : 7, seed: 13, rgb: [0.92, 0.91, 0.9], alpha: 0.32, lean: [0.45, 0.2] });
  p.add('smoke', steamMaterial(), g, { cast: false });
  return p.build().group;
}

/** Build any of the villages' kits by its key (see the header). Returns a THREE.Group. */
export function buildPart(key, lod) {
  const k = key.split(':');
  switch (k[0]) {
    case 'tugurium': return k[1] === 'none' ? NONE.clone() : buildHut(k[2], { lod, age: Number(k[3]) }).group;
    case 'concilium': return k[1] === 'none' ? NONE.clone() : buildConcilium(k[1], { lod }).group;
    case 'arvum': return k[1] === 'none' ? NONE.clone() : buildPlot(k[1], k[2], k[3], { lod }).group;
    case 'tugx': return yardThing(k[1], { lod }).group;
    case 'vsmoke': return buildVillageSmoke(k[1], lod);
    case 'vfire': return buildFire(k[1], { lod }).group;
    case 'vcauldron': return buildCauldron({ lod }).group;
    case 'varms': return buildArms(k[1], { lod }).group;
    case 'vgoods': return buildGoods({ lod }).group;
    case 'voak': return buildOak(k[1], { lod });
    case 'pecus': return buildBeast(k[1], Number(k[2]), k[3], lod).group;
    default: throw new Error(`Unknown village part: ${key}`);
  }
}

export const VILLAGE_MODELS = Object.freeze({
  native_hut: HUT_ENTRY,
  native_meeting: MEETING_ENTRY,
  native_crops: CROPS_ENTRY,
});

/** The villages' part kits for models.js MODEL_PARTS, by their key's first word. */
export const VILLAGE_PARTS = Object.freeze(Object.fromEntries(['tugurium', 'concilium', 'arvum', 'tugx', 'vsmoke', 'vfire', 'vcauldron', 'varms', 'vgoods', 'voak', 'pecus'].map((w) => [w, Object.freeze({ build: buildPart })])));

/**
 * A piece's whole look as one Group, as the game shows it (the lab, the
 * tests): every kit of its `more` at their places. `game` (or null) gives
 * the state; `ctx` extra for the variant (people, month, clock).
 */
export function villageLook(b, lod, { game = null, people = null, month = null, clock = 0 } = {}) {
  const g = new Group();
  const v = VILLAGE_MODELS[b.type].variant(b, { snow: 0 }, { game, people, month, clock, frame: 1 });
  for (const e of v.more || []) {
    const kit = buildPart(e.key, lod);
    for (let j = 0; j < e.n; j++) {
      const c = j ? kit.clone() : kit;
      c.matrixAutoUpdate = false;
      c.matrix.fromArray(e.mats, j * 16);
      c.userData.part = e.key;
      g.add(c);
    }
  }
  return { group: g, variant: v };
}

/** (The quern the grinders kneel at: its place, for the tests.) */
export { QUERN };
