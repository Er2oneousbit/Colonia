/**
 * models/villages.js
 * ----------------------------------------------------------------------------
 * The native villages as the game draws them (render3d/models.js MODELS
 * takes these entries as they are): the hut (Tugurium, models/tugurium.js),
 * the meeting place (Concilium, concilium.js) and the plot (Arvum,
 * arvum.js), their villagers as people and their flocks as beasts on the
 * beast rig (people/actors.js; units/quadRig.js: goats and sheep), from the
 * sim's own fields, read only (sim/natives.js).
 *
 * The people: the city's villages' (game.city.natives.people): 'ligurian'
 * in the missions that have them (Mutina, Luna), 'native' (the generic Iron
 * Age people) in the sandbox; each its own huts, meeting place and plots.
 *
 * States (villageState), the same for every piece of a village:
 *   'calm'   calmed by a missionary (anger under ANGER_MAX) and no attack:
 *            at work and at peace: the women grinding and spinning at their
 *            doors, the men at the fold and its gate, the children at
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
 * A piece's list is kept by its look (its form, turn, things, state,
 * month) and shared by every piece that looks so; the flocks are actors
 * (the fold's walking a few steps and grazing, a hut's tethered goat), so
 * nothing is written a frame.
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
import { buildSmoke } from './sacra.js';
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

/** Forget what a game's villages were seen to be this tick (the console's `villages`, which changes them while paused). */
export function forgetVillageWatch(game) {
  WATCH.delete(game);
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

/**
 * The flocks' coats (sRGB, the beast rig's slots: units/quadMesh.js): a
 * sheep's fleece in the mantle, its bare face and legs in the skin; a goat's
 * coat in the skin, its horns and beard in the hair. The hill flocks were of
 * mixed shades: the white fleece bred for later.
 */
const SHEEP_COATS = Object.freeze([
  { mantle: 0xd9cdb2, skin: 0x9a8a74, hair: 0x8a7a64 }, { mantle: 0x9a8a72, skin: 0x5e5244, hair: 0x6e6250 },
  { mantle: 0x6a5240, skin: 0x3e3024, hair: 0x5a4a3a }, { mantle: 0x3a332e, skin: 0x2a2420, hair: 0x4a4038 },
]);
const GOAT_COATS = Object.freeze([
  { skin: 0x9a6a3e, hair: 0x6e6250, mantle: 0x9a6a3e }, { skin: 0x2e2824, hair: 0x7a6e5a, mantle: 0x2e2824 },
  { skin: 0xd8d0c0, hair: 0x8a7e66, mantle: 0xd8d0c0 }, { skin: 0x7a5a3a, hair: 0x6a5e4a, mantle: 0x7a5a3a },
]);

/**
 * A beast of a flock (the beast rig's goat or sheep: units/quadRig.js) as an
 * actor: grazing where it stands, or (`route`) walking a few steps across
 * the fold and grazing at each end.
 */
function beast(kind, seed, at, ry, route = null) {
  const coats = kind === 'goat' ? GOAT_COATS : SHEEP_COATS;
  const spec = { beast: `quad:${kind}`, clip: route ? `${kind}:walk` : `${kind}:graze`, at, ry, seed, colours: coats[Math.floor(hash01(seed, 21) * coats.length) % coats.length] };
  if (route) spec.route = { length: route, speed: 0.32, pauseEnd: 9 + hash01(seed, 3) * 6, pauseStart: 7 + hash01(seed, 4) * 6, clipEnd: `${kind}:graze`, clipStart: hash01(seed, 5) < 0.5 ? `${kind}:graze` : `${kind}:stand` };
  return spec;
}

/** The fold's flock (the meeting place's frame): three or four, walking a few steps and grazing, inside the walls. */
function foldFlock(people, seed) {
  const kinds = people === 'ligurian' ? ['sheep', 'goat', 'sheep', 'goat', 'sheep'] : ['sheep', 'sheep', 'goat', 'sheep', 'sheep'];
  const places = [[1.95, 2.15, Q, 0.95], [3.05, 3.05, -Q, 0.95], [2.35, 2.75, 0.4, 0.45], [3.1, 2.3, Math.PI, 0], [2.0, 3.15, 2.4, 0]];
  const n = 3 + (hash01(seed, 31) < 0.5 ? 0 : 1);
  return places.slice(0, n).map(([x, z, ry, len], i) => beast(kinds[i], seed * 3 + i, [x, 0.02, z], ry, len || null));
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
    spec = { body: 'm', dress: [r(9) < 0.5 ? 'tunic:short' : 'tunic:knee'], gear: ['hide', 'belt', ...(long ? ['longhair'] : [])], hair: long ? null : 'curls', beard: who === 'elder' || r(10) < 0.6 ? 'short' : null, old: who === 'elder' };
    if (who === 'elder') spec.beard = 'full';
  } else {
    c.mantle = pick(CLOAKS, seed, 2);
    spec = { body: 'm', dress: ['tunic:knee'], gear: r(8) < 0.45 || who === 'elder' ? ['sagum'] : [], hair: 'curls', beard: 'full', old: who === 'elder' };
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
 * what is in its yard and who works there. (The men of a calm village are out
 * at the flock, the plots and the meeting place; a hut's yard is the women's.)
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
    people, form, age: hash01(b.village ?? id, 3, 5) < 0.4 ? 1 : 0, q, jitter: (h(4) - 0.5) * 0.36,
    work: h(5) < 0.55 ? 'grind' : 'spin',
    things: thingsOf(h, form),
    child: h(8) < 0.55,
    goat: h(9) < 0.35,
    crone: h(11) < 0.3,
  };
}

/**
 * A hut's yard things beside its quern (two of them, by its id). Under the
 * roundhouse's low eaves only the low things fit.
 */
function thingsOf(h, form) {
  const pool = form === 'roundhouse' ? ['woodpile', 'pots', 'chop', 'skep'] : ['woodpile', 'pots', 'rack', 'loom', 'chop', 'skep'];
  const a = pool[Math.floor(h(12) * pool.length) % pool.length];
  let b = pool[Math.floor(h(13) * pool.length) % pool.length];
  if (b === a) b = pool[(pool.indexOf(a) + 2) % pool.length];
  return [a, b];
}

/**
 * The yard's places, the hut's door toward +z, every form alike (all within
 * its tile: the yard turns by quarter turns only, which keeps a square in its
 * tile). Whoever stands stands in a front corner, past every form's eaves
 * (the tests check them against each form's roof: tugurium.js HUT `eave`);
 * the grinder kneels and the child squats under them.
 *   quern   where the grinder kneels, facing the door's side (the quern ahead of her)
 *   door    the front right corner (a spinner, a man on guard)
 *   side    the front left corner (a woman listening, the old woman)
 *   a, b    the two things' places, the back corners
 *   child   where a child squats at play
 *   goat    a tethered goat's place and facing, the back left corner (no thing b then)
 */
export const YARD = Object.freeze({
  quern: [-1.12, 1.2, Q], door: [1.62, 1.58, -2.4], side: [-1.64, 1.62, 2.5],
  a: [1.18, -1.22, Math.PI * 0.75], b: [-1.18, -1.26, -Math.PI * 0.75],
  child: [0.2, 1.72, Math.PI], goat: [-1.42, -1.42, -2.36],
});

/** Every look's hut kit at the hut's turn, its things, the hearth's smoke over the apex, its goat. */
function hutMore(L) {
  const rot = L.q * Q;
  const yaw = rot + L.jitter;
  const more = [{ key: `tugurium:${L.people}:${L.form}:${L.age}`, n: 1, mats: at(0, 0, yaw), state: 'always' }];
  const [ax, ay, az] = HUT[L.form].apex;
  const [sx, sz] = turn(ax, az, yaw);
  more.push({ key: 'vsmoke:hut', n: 1, mats: at(sx, sz, 0, 1, ay - 0.1), state: 'always' });
  const place = (k, key) => {
    const [x, z, r] = YARD[k];
    const [px, pz] = turn(x, z, rot);
    more.push({ key, n: 1, mats: at(px, pz, r + rot), state: 'always' });
  };
  if (L.work === 'grind') place('quern', 'tugx:quern');
  place('a', `tugx:${L.things[0]}`);
  // (A hut with a goat tethered keeps that back corner for it.)
  if (!L.goat) place('b', `tugx:${L.things[1]}`);
  return more;
}

/** A hut's people in a state (actor specs in the tile's frame). */
export function hutActors(L, state, seed) {
  const rot = L.q * Q;
  const out = [];
  const p = L.people;
  const at3 = (k) => [YARD[k][0], 0, YARD[k][1]];
  if (state === 'angry') {
    // Roused: the man at his door's corner with his spear, his wife watching, the children kept in.
    out.push(villager('man', p, seed + 2, { clip: 'guard', props: { R: 'spear' }, at: at3('door'), ry: YARD.door[2] + 0.3 }));
    out.push(villager('woman', p, seed + 1, { clip: 'listen', at: at3('side'), ry: YARD.side[2] }));
  } else {
    if (L.work === 'grind') out.push(villager('woman', p, seed + 1, { clip: 'grind', props: { R: 'muller' }, at: at3('quern'), ry: YARD.quern[2] }));
    else out.push(villager('woman', p, seed + 1, { clip: 'spin', props: { L: 'distaff', R: 'spindle' }, at: at3('door'), ry: YARD.door[2] }));
    // At war the children are kept in, the old woman watches the road the men took.
    if (state === 'war') {
      if (L.crone) out.push(villager('crone', p, seed + 4, { clip: 'listen', at: at3('side'), ry: YARD.side[2] }));
    } else if (L.child) {
      out.push(villager('child', p, seed + 3, { clip: 'play', at: at3('child'), ry: YARD.child[2] }));
    }
  }
  // A goat tethered behind the hut, grazing (and now and then looking up), whatever the village's mood.
  if (L.goat) out.push(beast('goat', seed + 7, [YARD.goat[0], 0.02, YARD.goat[1]], YARD.goat[2]));
  return out.map((a) => turned(a, rot));
}

const HUT_CASTS = new Map();
/** A hut's cast, kept by its look and state. */
function hutCast(L, state, seed) {
  const sig = `${L.people}|${L.form}|${L.q}|${L.work}|${L.child}|${L.crone}|${L.goat}|${state}|${seed}`;
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
function meetingMore(people, state, q, month) {
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
  // (The flock in the fold is the meeting place's actors: beasts on the beast rig.)
  return Object.freeze(more.map((e) => Object.freeze(e)));
}

/** The meeting places' lists, kept by their look (a few a game: two peoples, four states, four turns, the oak's looks). */
const MEET_MORE = new Map();
function meetingMoreOf(people, state, q, month) {
  const sig = `${people}|${state}|${q}|${lookOf('oak', month)}`;
  let list = MEET_MORE.get(sig);
  if (!list) {
    list = meetingMore(people, state, q, month);
    MEET_MORE.set(sig, list);
  }
  return list;
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
    const cx = hx - 0.5;
    const cz = hz + 0.4;
    out.push(villager('woman', p, seed + 4, { clip: 'stir', props: { R: 'pestle' }, at: [cx, 0, cz], ry: toFire(cx, cz) }));
    // The herdsman by the fold, children at play by the fire, a woman bringing water.
    out.push(villager('man', p, seed + 5, { clip: 'lean', props: { R: 'crook' }, at: [1.1, 0, 1.25], ry: 0.6 }));
    // A man mending the fold's gate hurdle, leaning open by the gap.
    out.push(villager('man', p, seed + 12, { clip: 'hammer', props: { L: 'chisel', R: 'hammer' }, at: [0.58, 0, 2.35], ry: Q }));
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
  // The flock in the fold, whatever the village's mood.
  out.push(...foldFlock(people, seed));
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
  const m = month === null || month === undefined ? 6 : ((Math.round(month) % 12) + 12) % 12;
  // (Nobody works a plot in the dead of winter, Dec to Feb.)
  return { people, crop, stage: cropStage(crop, month), q: Math.floor(hash01(id, 2, 9) * 4) % 4, winter: m === 11 || m <= 1 };
}

/** Whether the plot is worked (by the season's stage), and by whom, in a state. */
export function plotActors(L, state, seed) {
  if (state === 'war' || L.stage === 'ripe' || L.winter) return [];
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
  const sig = `${L.people}|${L.crop}|${L.stage}|${L.q}|${L.winter}|${state}|${seed}`;
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

/**
 * The lamps of the pieces drawn (by id: models.js modelLamps asks of a
 * building alone), forgotten when the pass draws another game (a new game or
 * a load: the villages' ids start again at NATIVE_ID_BASE in every game).
 */
const HUT_LAMPS = new Map();
const MEET_LAMPS = new Map();
function lampsOf(ctx) {
  if (ctx.villageGame !== ctx.game) {
    ctx.villageGame = ctx.game;
    HUT_LAMPS.clear();
    MEET_LAMPS.clear();
  }
}

const NONE = new Group();

/** A seed for a piece's people from its place (the same after a reload). */
function seedOf(b) {
  return ((b.x * 73 + b.y * 151 + (b.id || 0)) % 997) + 1;
}

/** The huts' lists, kept by their look (a hut's list is all its own: its turn, its things). */
const HUT_MORE = new Map();
function hutMoreOf(L) {
  const sig = `${L.people}|${L.form}|${L.age}|${L.q}|${L.jitter}|${L.work}|${L.things}|${L.goat}`;
  let list = HUT_MORE.get(sig);
  if (!list) {
    list = Object.freeze(hutMore(L).map((e) => Object.freeze(e)));
    if (HUT_MORE.size > 4000) HUT_MORE.clear();
    HUT_MORE.set(sig, list);
  }
  return list;
}

const HUT_ENTRY = Object.freeze({
  // Every material a village's huts draw is in these (one look and one yard thing of each material).
  warm: ['tugurium:ligurian:round:0', 'tugurium:native:capanna:0', 'tugx:quern', 'tugx:loom', 'tugx:skep', 'vsmoke:hut'],
  variant(b, place, ctx) {
    const game = ctx ? ctx.game : null;
    const people = ctx && ctx.villagePeople ? ctx.villagePeople : villagePeople(game);
    const state = villageState(b, game);
    const L = hutLook(b, game, people);
    if (ctx && b.id !== null && b.id !== undefined) {
      lampsOf(ctx);
      HUT_LAMPS.set(b.id, [hutLamp(L)]);
    }
    return { key: 'tugurium:none', state: 'always', ice: false, more: hutMoreOf(L), actors: hutCast(L, state, seedOf(b)) };
  },
  lamps: (b) => HUT_LAMPS.get(b.id) || [],
  build: (key, lod) => buildPart(key, lod),
});

const MEETING_ENTRY = Object.freeze({
  warm: ['concilium:ligurian', 'concilium:native', 'vfire:great', 'vcauldron', 'varms:native', 'vgoods', 'voak:leaf', 'vsmoke:fire'],
  variant(b, place, ctx) {
    const game = ctx ? ctx.game : null;
    const people = ctx && ctx.villagePeople ? ctx.villagePeople : villagePeople(game);
    const state = villageState(b, game);
    const q = meetingTurn(b);
    const month = ctx ? ctx.month : null;
    if (ctx && b.id !== null && b.id !== undefined) {
      lampsOf(ctx);
      const [hx, hz] = CONCILIUM.hearth;
      const [x, z] = turn(hx, hz, q * Q);
      MEET_LAMPS.set(b.id, [[x, 0.7, z, 1, 0], [x, 0.7, z, -1, 0]]);
    }
    return { key: 'concilium:none', state: 'always', ice: false, more: meetingMoreOf(people, state, q, month), actors: meetingCast(people, state, q, seedOf(b)) };
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
    const people = ctx && ctx.villagePeople ? ctx.villagePeople : villagePeople(game);
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
    default: throw new Error(`Unknown village part: ${key}`);
  }
}

export const VILLAGE_MODELS = Object.freeze({
  native_hut: HUT_ENTRY,
  native_meeting: MEETING_ENTRY,
  native_crops: CROPS_ENTRY,
});

/** The villages' part kits for models.js MODEL_PARTS, by their key's first word. */
export const VILLAGE_PARTS = Object.freeze(Object.fromEntries(['tugurium', 'concilium', 'arvum', 'tugx', 'vsmoke', 'vfire', 'vcauldron', 'varms', 'vgoods', 'voak'].map((w) => [w, Object.freeze({ build: buildPart })])));

/**
 * A piece's whole look as one Group, as the game shows it (the lab, the
 * tests): every kit of its `more` at their places. `game` (or null) gives
 * the state; `ctx` extra for the variant (people, month, clock).
 */
export function villageLook(b, lod, { game = null, people = null, month = null, clock = 0 } = {}) {
  const g = new Group();
  const v = VILLAGE_MODELS[b.type].variant(b, { snow: 0 }, { game, villagePeople: people, month, clock, frame: 1 });
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
