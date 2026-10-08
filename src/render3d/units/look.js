/**
 * units/look.js
 * ----------------------------------------------------------------------------
 * How each fighting unit looks in 3D: the figures it is drawn with (the man,
 * his horse; a chariot's car, ponies, driver and warrior; an elephant, its
 * mahout and the man in its tower; a wolf), what each wears and carries, and
 * which clips each plays as it moves, waits, holds the line, strikes, takes
 * a blow and falls. Fresh designs from the record, never the sprites':
 *
 *   Rome
 *     legionary    the late Republic's: a bronze Montefortino helmet with its
 *                  horsehair crest, mail (lorica hamata) over the red tunic,
 *                  caligae, the curved scutum painted with the legion's
 *                  wings and thunderbolts, the pilum on the march and the
 *                  gladius in battle (its scabbard on the right hip); the
 *                  first man of each fort is its signifer, a bear's skin over
 *                  his helmet, the century's standard and a small round shield
 *     archer       a Syrian auxiliary: the tall conical helmet, a bronze scale
 *                  shirt over a green tunic, the composite bow, the quiver
 *     cavalry      an auxiliary trooper: the imperial Gallic helmet with its
 *                  crest, mail, the flat oval shield, the lance, the spatha;
 *                  his horse under the four-horned saddle, bronze phalerae
 *     imperial     Caesar's legionary: the plate cuirass (segmentata), the
 *                  Gallic helmet with a tall white crest, the purple-faced
 *                  scutum; among them the vexillarius with his flag and the
 *                  aquilifer with the eagle under a lion's skin
 *   The raiders, by their people (data/peoples.js)
 *     Gauls (and the Boii and Insubres): long hair limed pale, the long
 *                  moustache, checked trousers, the torc; the swordsman's long
 *                  iron sword and tall painted oval shield, some in iron caps,
 *                  some bare to the waist; the axeman bare-chested with his
 *                  great axe; the war chariot's driver and warrior
 *     Ligurians:   lean hillmen in short tunics of undyed wool under a
 *                  sheepskin, barefoot; a hand axe and a small round shield,
 *                  or the sling
 *     Carthaginians: the Numidians in short white tunics with javelins and
 *                  the small round leather shield, riding bareback with a neck
 *                  rope; the heavy foot in linen cuirasses and Attic helmets,
 *                  the great bronze shield and the long spear; the elephant
 *                  with its tower
 *     Lusitanians: the caetrati: the small round shield, the falcata,
 *                  javelins, long hair bound back, a sinew cap now and then
 *     Cimbri and Teutones, the generic band: Germanic warriors, bearded,
 *                  hair in the Suebian knot, bare-chested or in tunics,
 *                  trousers and cloaks, round board shields, axes and swords
 *   gladiator      in his arena kit: a murmillo (the fish-crested helmet, the
 *                  scutum, the gladius), a thraex (the griffin's crest, the
 *                  small square shield, the curved sica, high greaves) or a
 *                  retiarius (bareheaded, the shoulder guard, net and trident)
 *   villager       a native in his wool tunic and cloak, a hunting spear, a
 *                  pitchfork or a club, now and then a wicker shield
 *   wolf           a grey wolf, its coat by its id
 *
 * unitLook(u, ctx) -> { key, figures, reach, arms }
 *   figures [{ person | quad | rigid, at: [x, y, z] (its place in the unit's
 *           frame, metres: +z ahead), mount (a figure it rides) and seat
 *           ('seat' or 'deck'), clips, colours }], the first the unit himself
 *   clips   a person's: move (walking), run (charging, fleeing), stand, ready
 *           (threatened), attack (with its blow's phase: clips.js HIT),
 *           flinch, fall; a beast's: stand, slow, fast, attack, fall
 *   arms    'march' or 'battle' (a legionary's pilum or gladius): a new arm,
 *           a new look
 * Stable by the unit's id (people/actors.js hash01): a man keeps his look.
 * Pure: no three, no GPU (the tests read it).
 * ----------------------------------------------------------------------------
 */

import { UNIT_TYPES } from '../../data/units.js';
import { DYES, hash01, pick } from '../people/actors.js';
import { HIT } from './clips.js';

/** Unit types drawn as 3D figures (ships keep their own art: their builder's). */
export function unitDrawnIn3D(type) {
  const def = UNIT_TYPES[type];
  return !!def && !def.naval;
}

const hex = (css, fallback) => (typeof css === 'string' && /^#[0-9a-f]{6}$/i.test(css) ? parseInt(css.slice(1), 16) : fallback);

/** Skins: Italians, fair northerners, Iberians, Numidians and Syrians. */
const SKIN = {
  italian: [0xc8956c, 0xb88560, 0xa87452, 0xbf8b62, 0xd2a17a],
  fair: [0xcf9f7c, 0xc69676, 0xd3a483, 0xbf8f6e],
  iberian: [0xb88560, 0xa87452, 0xbf8b62, 0xc8956c],
  numidian: [0x8c5e40, 0x75492f, 0x9a6a4a, 0x6a4430],
  syrian: [0xa87452, 0x9a6a4a, 0xb88560],
};
const HAIR = {
  dark: [0x1d1612, 0x2a1e16, 0x3a2a1c, 0x1d1612],
  fair: [0x8a6a3e, 0xa07c4c, 0x7a3a20, 0x8a5a30, 0xa88a5a, 0x6a4428],
  limed: [0xc4a46a, 0xb08a52, 0x9e7a46, 0xa86a3a],
  brown: [0x4a3424, 0x3a2a1c, 0x6a4428, 0x2a1e16],
};
/** Northern cloth: bright dyes, the checks of their trousers and cloaks. */
const CELTIC = [DYES.madder, DYES.woad, DYES.weld, DYES.green, DYES.oxblood, DYES.saffron, DYES.olive];
const UNDYED = [DYES.undyed, DYES.oatmeal, DYES.fawn, DYES.brownWool, DYES.grey];
/** Shield fields of the northern peoples and their patterns' colours. */
const FIELDS = [0x7a2a24, 0x3f5a85, 0x5a6d3e, 0x8a6a3a, 0x6b4a32, 0x9a8c6a, 0x2f3a4a];
const PATTERNS = [0xe8dcc0, 0xd9b65a, 0x1d1612, 0xa3352b, 0xece6d8];
/** Horse coats [coat, mane and points, socks]: bays, chestnut, grey, black, dun. */
const HORSES = [[0x7a4626, 0x1f1714, 0x7a4626], [0x95562c, 0x1b1716, 0xe8e2d4], [0xb9b4aa, 0x8a8478, 0xb9b4aa], [0x2c2522, 0x1b1716, 0x2c2522], [0xb08a58, 0x3a2c22, 0xb08a58], [0x6a3a20, 0x1d1612, 0xe8e2d4]];
/** Wolves' coats [flanks, saddle, cream]. */
const WOLVES = [[0x7f7060, 0x3a332c, 0xcfc0a4], [0x75695a, 0x2c2824, 0xc4b498], [0x8a7a62, 0x463c32, 0xd6c8ac], [0x6a625a, 0x262220, 0xb8ab94]];

/** A person figure. */
function man(seed, spec, gear, props, clips, extra = {}) {
  return {
    person: { body: 'm', seed, ...spec },
    gear: gear.filter(Boolean).map((g) => `ugear:${g}`),
    props,
    clips: { flinch: 'flinch', fall: 'fall', ...clips },
    at: extra.at || [0, 0, 0],
    mount: extra.mount ?? -1,
    seat: extra.seat || 'seat',
    scale: 1,
  };
}

/** A beast figure. */
function beast(key, colours, clips, at = [0, 0, 0]) {
  return { quad: key, species: key.split(':')[1], colours, clips, at, mount: -1, scale: 1 };
}

/** A horse: its coat by seed; `tack` saddle, bare or yoke; `cloth` the saddle cloth's colour. */
function horse(seed, tack, cloth = 0xa3352b, at) {
  const [coat, mane, socks] = HORSES[Math.floor(hash01(seed, 31) * HORSES.length) % HORSES.length];
  return beast(`quad:horse:${tack}`, { skin: coat, hair: mane, trim: hash01(seed, 32) < 0.35 ? socks : coat, accent: cloth, leather: 0x4a3020, metal: 0xb08848 },
    { stand: 'horse:stand', slow: 'horse:canter', fast: 'horse:gallop', walk: 'horse:walk', attack: 'horse:fight', fall: 'horse:fall' }, at);
}

/** Romans' clips: in step on the march, the line when threatened, the gladius's thrust. */
const LEGION = { move: 'march', run: 'charge', stand: 'guard', ready: 'shieldWall', attack: 'fight' };
const ARCHER = { move: 'bowMarch', run: 'run', stand: 'idle', ready: 'idle', attack: 'shoot' };
const RIDER = { move: 'mounted', run: 'mounted', stand: 'mounted', ready: 'mounted', attack: 'rideStrike' };
const WARRIOR = { move: 'march', run: 'charge', stand: 'guard', ready: 'shieldWall', attack: 'hew' };
const SPEARMAN = { move: 'march', run: 'charge', stand: 'guard', ready: 'shieldWall', attack: 'thrust' };
const AXEMAN = { move: 'shoulderArms', run: 'charge', stand: 'idle', ready: 'idle', attack: 'chop' };
const SKIRMISHER = { move: 'charge', run: 'run', stand: 'guard', ready: 'guard', attack: 'throw' };
const SLINGER = { move: 'march', run: 'run', stand: 'idle', ready: 'idle', attack: 'sling' };
const BEARER = { move: 'march', run: 'march', stand: 'guard', ready: 'guard', attack: 'guard' };

/** The people of the raid a unit belongs to (ctx.people), else the generic band's. */
const PEOPLE_LOOK = {
  barbarians: 'german', gauls: 'gaul', boii: 'gaul', ligurians: 'ligurian', ligurians_coast: 'ligurian', ligurians_hills: 'ligurian',
  carthaginians: 'punic', lusitanians: 'iberian', cimbri: 'german',
};

/**
 * What a unit's look depends on: its type, its people, its role (a bearer),
 * its arms (march or battle). `ctx`: { people (the raid's people id), arms }.
 */
export function unitLookKey(u, ctx = {}) {
  // (A show's made-up figure names its look and its kit: models/venueShow.js.)
  return `${u.type}|${ctx.people || ''}|${roleOf(u)}|${ctx.arms || 'march'}${u.look ? `|${u.look}` : ''}${u.kit !== undefined ? `|${u.kit}` : ''}${u.faction !== undefined ? `|${u.faction}` : ''}`;
}

/** A unit's role in its band: the signifer (his fort's first man), the imperial standards, or a plain man. */
export function roleOf(u) {
  if (u.type === 'legionary' && u.fort && (u.slot | 0) === 0) return 'signifer';
  if (u.type === 'imperial') {
    if (u.id % 23 === 5) return 'aquilifer';
    if (u.id % 12 === 0) return 'vexillarius';
  }
  return 'ranks';
}

/** The look of unit `u` (see the header). */
export function unitLook(u, ctx = {}) {
  const seed = u.id * 1.618 + 7;
  const arms = ctx.arms || 'march';
  const make = (u.look && SHOW_LOOKS[u.look]) || LOOKS[u.type] || LOOKS.raider;
  const figures = make(u, seed, PEOPLE_LOOK[ctx.people] || 'german', arms, ctx);
  return { key: unitLookKey(u, ctx), figures, reach: reachOf(figures), arms };
}

/** How far ahead of the unit's place its figures reach (metres): a chariot's ponies, a horse's head. */
function reachOf(figures) {
  let r = 0;
  for (const f of figures) if (f.quad || f.rigid) r = Math.max(r, f.at[2] + (f.species === 'elephant' ? 1.9 : f.species === 'horse' ? 1.3 : 0.8));
  return r;
}

/** The legion's man. */
function legionary(u, seed, arms, o = {}) {
  const role = roleOf(u);
  const imperial = u.type === 'imperial';
  const shield = imperial ? hex(UNIT_TYPES.imperial.color, 0x6d2a6b) : hex(UNIT_TYPES.legionary.color, 0xa3352b);
  const colours = {
    tunic: DYES.madder, trim: imperial ? 0xece6d8 : hash01(seed, 5) < 0.7 ? 0xa3352b : 0x2a2522,
    accent: shield, metal: imperial ? 0x9aa0a8 : 0x5e6066, leather: 0x5a3a24, skin: pick(SKIN.italian, seed, 3), hair: pick(HAIR.dark, seed, 4),
  };
  const head = imperial ? ['helmet:m'] : [];
  const body = imperial ? ['tunic:short', 'caligae'] : ['tunic:short', 'lorica', 'caligae'];
  const spec = { dress: [...body, ...head], hair: 'crop', beard: hash01(seed, 6) < 0.25 ? 'short' : null, colours };
  if (role === 'signifer' || role === 'aquilifer' || role === 'vexillarius') {
    colours.mantle = role === 'aquilifer' ? 0xb08850 : 0x4a3626;
    if (role === 'vexillarius') colours.trim = shield;
    const pole = role === 'signifer' ? 'signum' : role === 'aquilifer' ? 'aquila' : 'vexillum';
    return [man(seed, spec, [imperial ? 'segmentata' : null, imperial ? null : 'montefortino', role === 'vexillarius' ? 'plume' : 'pelt', 'scabbard'],
      { R: `uprop:${pole}`, L: 'uprop:caetra' }, BEARER)];
  }
  const gear = imperial ? ['segmentata', 'plume', 'scabbard'] : ['montefortino', 'crest', 'scabbard'];
  return [man(seed, spec, gear, { L: 'uprop:scutum', R: arms === 'battle' ? 'prop:gladius' : 'uprop:pilum' }, { ...LEGION, ...(o.clips || {}) })];
}

/** A barbarian warrior of the people `folk` with his arms (`kind`: sword, axe2h, axe, spear, javelin, sling). */
function warrior(u, seed, folk, kind) {
  const r = (salt) => hash01(seed, salt);
  const c = {};
  const gear = [];
  const dress = [];
  let hair = 'curls';
  let beard = null;
  if (folk === 'gaul') {
    c.skin = pick(SKIN.fair, seed, 3);
    c.hair = pick(HAIR.limed, seed, 4);
    c.tunic = pick(CELTIC, seed, 5);
    c.trim = pick(CELTIC, seed, 6);
    c.mantle = pick(CELTIC, seed, 7);
    const bare = kind === 'axe2h' || r(8) < 0.35;
    if (!bare) dress.push('tunic:short');
    gear.push('bracae', 'belt');
    hair = null;
    gear.push(kind === 'sword' && r(9) < 0.4 ? 'celtic' : 'longhair');
    gear.push('moustache');
    if (r(10) < 0.5) gear.push('torc');
    if (!bare && r(11) < 0.3) gear.push('sagum');
  } else if (folk === 'german') {
    c.skin = pick(SKIN.fair, seed, 3);
    c.hair = pick(HAIR.fair, seed, 4);
    c.tunic = pick(UNDYED, seed, 5);
    c.trim = pick([DYES.brownWool, DYES.grey, DYES.fawn, DYES.olive, DYES.woad], seed, 6);
    c.mantle = pick([DYES.brownWool, DYES.walnut, DYES.grey, 0x5a4a38], seed, 7);
    const bare = kind === 'axe2h' || r(8) < 0.4;
    if (!bare) dress.push('tunic:short');
    gear.push('bracae', 'belt');
    hair = null;
    gear.push(r(9) < 0.5 ? 'knot' : 'longhair');
    beard = r(10) < 0.75 ? 'full' : 'short';
    if (r(11) < 0.35) gear.push(bare ? 'hide' : 'sagum');
  } else if (folk === 'ligurian') {
    c.skin = pick(SKIN.italian, seed, 3);
    c.hair = pick(HAIR.dark, seed, 4);
    c.tunic = pick(UNDYED, seed, 5);
    c.mantle = pick([0xcfc2a2, 0x9a8668, 0x6e604f], seed, 7);
    dress.push('tunic:short');
    gear.push('hide', 'belt');
    hair = r(9) < 0.5 ? 'curls' : null;
    if (!hair) gear.push('longhair');
    beard = r(10) < 0.6 ? 'short' : null;
  } else if (folk === 'iberian') {
    c.skin = pick(SKIN.iberian, seed, 3);
    c.hair = pick(HAIR.dark, seed, 4);
    c.tunic = DYES.white;
    c.trim = pick([DYES.madder, DYES.oxblood, DYES.woad], seed, 6);
    c.mantle = pick([DYES.black, DYES.brownWool], seed, 7);
    dress.push('tunic:short');
    gear.push('belt');
    hair = null;
    gear.push(r(9) < 0.35 ? 'cap' : 'longhair');
    beard = r(10) < 0.5 ? 'short' : null;
  } else if (folk === 'punic') {
    c.skin = pick(SKIN.numidian, seed, 3);
    c.hair = pick(HAIR.dark, seed, 4);
    c.tunic = pick([DYES.white, DYES.undyed, DYES.oatmeal], seed, 5);
    c.trim = DYES.madder;
    dress.push('tunic:short');
    gear.push('belt');
    hair = 'curls';
    beard = r(10) < 0.7 ? 'short' : null;
  }
  c.accent = pick(FIELDS, seed, 12);
  if (folk !== 'gaul' && folk !== 'german') c.trim = c.trim ?? pick(PATTERNS, seed, 13);
  else if (kind !== 'sword') c.trim = c.trim ?? pick(PATTERNS, seed, 13);
  c.metal = 0x7a7c80;
  c.leather = pick([0x5a3a24, 0x4a3020, 0x6e4a2e], seed, 14);
  const barefoot = folk === 'ligurian';
  if (!barefoot) dress.push('caligae');
  const spec = { dress, hair, beard, colours: c };
  // The arms by kind and people.
  let props;
  let clips;
  if (kind === 'sword') {
    props = { R: folk === 'iberian' ? 'uprop:falcata' : 'uprop:longsword', L: folk === 'german' ? 'uprop:round' : folk === 'iberian' ? 'uprop:caetra' : 'uprop:thureos' };
    clips = WARRIOR;
  } else if (kind === 'axe2h') {
    props = { R: 'uprop:greataxe' };
    clips = AXEMAN;
  } else if (kind === 'axe') {
    props = folk === 'iberian'
      ? { R: 'uprop:falcata', L: 'uprop:caetra' }
      : { R: 'uprop:handaxe', L: folk === 'ligurian' ? 'uprop:caetra' : 'uprop:round' };
    clips = WARRIOR;
  } else if (kind === 'javelin') {
    props = { R: 'uprop:javelin', L: folk === 'punic' || folk === 'iberian' ? 'uprop:caetra' : 'uprop:javelins' };
    clips = SKIRMISHER;
  } else if (kind === 'sling') {
    props = { R: 'uprop:sling' };
    clips = SLINGER;
  } else {
    props = { R: 'uprop:lance', L: 'uprop:round' };
    clips = SPEARMAN;
  }
  return man(seed, spec, gear, props, clips);
}

/** A horseman of a people: the rider on his horse (its tack by the people). */
function horseman(u, seed, folk) {
  const rider = warrior(u, seed, folk, 'javelin');
  rider.props = folk === 'german' || folk === 'gaul' ? { R: 'uprop:lance', L: 'uprop:round' } : { R: 'uprop:javelin', L: 'uprop:caetra' };
  rider.clips = { ...rider.clips, ...RIDER };
  rider.mount = 1;
  // (Bare legs on a horse: no trousers' seat over the saddle's leather, but boots stay.)
  const tack = folk === 'punic' || folk === 'german' ? 'bare' : 'saddle';
  const cloth = folk === 'iberian' ? DYES.madder : folk === 'gaul' ? pick(CELTIC, seed, 40) : 0x6b4a32;
  return [rider, horse(seed, tack, cloth)];
}

const LOOKS = {
  legionary: (u, seed, folk, arms) => legionary(u, seed, arms),
  imperial: (u, seed, folk, arms) => legionary(u, seed, arms),
  archer: (u, seed) => [man(seed, {
    dress: ['tunic:knee', 'caligae'], beard: hash01(seed, 6) < 0.7 ? 'short' : 'full', hair: 'curls',
    colours: { tunic: hex(UNIT_TYPES.archer.color, 0x3f7a3a), metal: 0xa08850, leather: 0x6b4a2a, skin: pick(SKIN.syrian, seed, 3), hair: pick(HAIR.dark, seed, 4) },
  }, ['conical', 'squamata', 'quiver'], { L: 'prop:bow', R: 'prop:arrow' }, ARCHER)],
  cavalry: (u, seed) => {
    const rider = man(seed, {
      dress: ['tunic:short', 'lorica', 'caligae', 'helmet'], hair: 'crop',
      colours: { tunic: DYES.madder, trim: 0xd9b65a, accent: hex(UNIT_TYPES.cavalry.color, 0xc9962e), metal: 0x5e6066, leather: 0x5a3a24, skin: pick(SKIN.iberian, seed, 3), hair: pick(HAIR.brown, seed, 4) },
    }, ['crest', 'scabbard:long'], { R: 'uprop:lance', L: 'uprop:clipeus' }, RIDER, { mount: 1 });
    return [rider, horse(seed, 'saddle', 0xa3352b)];
  },
  raider: (u, seed, folk) => [warrior(u, seed, folk, folk === 'iberian' ? 'axe' : 'axe')],
  horseman: (u, seed, folk) => horseman(u, seed, folk),
  slinger: (u, seed, folk) => [warrior(u, seed, folk === 'punic' ? 'ligurian' : folk, 'sling')],
  swordsman: (u, seed, folk) => [warrior(u, seed, folk, 'sword')],
  axeman: (u, seed, folk) => [warrior(u, seed, folk === 'punic' || folk === 'iberian' ? 'german' : folk, 'axe2h')],
  javelineer: (u, seed, folk) => [warrior(u, seed, folk === 'german' || folk === 'gaul' ? folk : folk === 'iberian' ? 'iberian' : 'punic', 'javelin')],
  hoplite: (u, seed) => [man(seed, {
    dress: ['tunic:short', 'caligae'], hair: 'curls', beard: hash01(seed, 6) < 0.6 ? 'short' : 'full',
    colours: { tunic: pick([DYES.madder, DYES.white], seed, 5), trim: pick([DYES.madder, 0x1d1612, DYES.white], seed, 6), metal: 0xb08848, leather: 0x5a3a24, skin: pick(SKIN.numidian.concat(SKIN.iberian), seed, 3), hair: pick(HAIR.dark, seed, 4) },
  }, ['linothorax', 'attic', 'greaves'], { R: 'uprop:dory', L: 'uprop:aspis' }, SPEARMAN)],
  chariot: (u, seed, folk) => {
    const driver = warrior(u, seed, 'gaul', 'axe');
    driver.props = {};
    driver.clips = { ...driver.clips, move: 'drive', run: 'drive', stand: 'drive', ready: 'drive', attack: 'drive' };
    driver.at = [0, 0.3, 0.12];
    const fighter = warrior(u, seed + 1, 'gaul', 'spear');
    fighter.clips = { ...fighter.clips, move: 'guard', run: 'guard', stand: 'guard', ready: 'guard' };
    fighter.at = [0.1, 0.3, -0.3];
    const ponies = [0.42, -0.42].map((x) => {
      const h = horse(seed + x * 10, 'yoke', 0x6b4a32, [x, 0, 2.05]);
      h.scale = 0.88;
      return h;
    });
    const car = { rigid: 'cart:chariot', at: [0, 0, 0], colours: { accent: pick(CELTIC, seed, 20) }, mount: -1, scale: 1, wheels: true };
    return [driver, car, fighter, ...ponies];
  },
  elephant: (u, seed) => {
    const el = beast('quad:elephant:tower', { skin: pick([0x847a6e, 0x786e64, 0x8c8276], seed, 30), hair: 0x3a3630, trim: pick([0xa3352b, 0xd9b65a, 0x3f5a85], seed, 31), accent: pick([0x7a2a24, 0x5a1838, 0x3f5a85], seed, 32) },
      { stand: 'elephant:stand', slow: 'elephant:walk', fast: 'elephant:walk', walk: 'elephant:walk', attack: 'elephant:fight', fall: 'elephant:fall' });
    const mahout = man(seed + 2, { dress: ['tunic:short'], hair: 'curls', colours: { tunic: DYES.white, skin: pick(SKIN.numidian, seed, 33) } }, [], { R: 'uprop:javelin' }, RIDER, { mount: 0, seat: 'seat' });
    mahout.clips = { ...mahout.clips, attack: 'mounted' };
    const crew = man(seed + 3, { dress: ['tunic:short', 'caligae'], hair: 'curls', beard: 'short', colours: { tunic: DYES.madder, metal: 0xb08848, skin: pick(SKIN.numidian, seed, 34) } }, ['attic'], { R: 'uprop:dory' }, { ...SPEARMAN, move: 'guard', run: 'guard', ready: 'guard' }, { mount: 0, seat: 'deck' });
    return [el, mahout, crew];
  },
  gladiator: (u, seed) => {
    // (A show's gladiator is given his kit: models/venueShow.js pairs them as the arenas did.)
    const kind = u.kit ?? Math.floor(hash01(seed, 50) * 3) % 3;
    const colours = { tunic: DYES.white, trim: pick([DYES.madder, DYES.woad, 0xd9b65a], seed, 51), accent: pick([DYES.madder, 0x3f5a85, 0x5a6d3e], seed, 52), metal: 0xb4b8be, leather: 0x6a4428, skin: pick(SKIN.italian.concat(SKIN.fair, SKIN.numidian), seed, 3), hair: pick(HAIR.dark, seed, 4) };
    if (kind === 0) {
      return [man(seed, { dress: ['caligae'], colours }, ['loin', 'murmillo', 'manica', 'greaves:left'], { L: 'prop:scutum', R: 'prop:gladius' }, { ...LEGION, move: 'march', stand: 'guard' })];
    }
    if (kind === 1) {
      return [man(seed, { dress: ['caligae'], colours }, ['loin', 'thraex', 'manica', 'wraps', 'greaves:high'], { L: 'uprop:parmula', R: 'uprop:sica' }, { ...LEGION, attack: 'hew' })];
    }
    return [man(seed, { dress: ['caligae'], hair: 'crop', colours }, ['loin', 'galerus', 'manica'], { L: 'uprop:net', R: 'uprop:trident' }, { ...SPEARMAN, ready: 'guard' })];
  },
  villager: (u, seed) => {
    const w = Math.floor(hash01(seed, 60) * 3) % 3;
    const colours = { tunic: pick(UNDYED, seed, 1), mantle: pick([DYES.brownWool, DYES.green, DYES.ochre, DYES.walnut], seed, 2), skin: pick([0xb88560, 0xa87452, 0x9a6a4a], seed, 3), hair: pick(HAIR.brown, seed, 4), accent: pick(FIELDS, seed, 5), trim: pick(PATTERNS, seed, 6) };
    const props = { R: w === 0 ? 'prop:spear' : w === 1 ? 'uprop:furca' : 'uprop:club' };
    if (hash01(seed, 61) < 0.3) props.L = 'uprop:round';
    return [man(seed, { dress: ['tunic:knee'], hair: 'curls', beard: 'full', colours }, [hash01(seed, 62) < 0.4 ? 'sagum' : null], props, w === 2 ? WARRIOR : { ...SPEARMAN, ready: 'guard' })];
  },
  wolf: (u, seed) => {
    const [flank, back, cream] = WOLVES[Math.floor(hash01(seed, 70) * WOLVES.length) % WOLVES.length];
    return [beast('quad:wolf', { skin: flank, mantle: flank, hair: back, trim: cream, accent: 0xc89a3a, leather: 0x2a2420 },
      { stand: 'wolf:stand', slow: 'wolf:trot', fast: 'wolf:lope', walk: 'wolf:walk', attack: 'wolf:bite', fall: 'wolf:fall', rest: 'wolf:lie', stalk: 'wolf:stalk' })];
  },
};

/** Each look's clips with their blows' phases (motion.js): `hit` of an attack clip. */
export function hitOf(clip) {
  return HIT[clip] ?? 0.35;
}

/** The factions' colours (the red, the white, the green, the blue: sRGB). */
const FACTION = [0xa3352b, 0xece6d8, 0x3f8a4a, 0x3a62a8];

/**
 * The shows' figures (models/venueShow.js: made-up units the venues hand the
 * pass), by their `look`:
 *   racer    a charioteer of the circus (auriga) in his faction's colour,
 *            the leather cap, the reins bound round his waist, in his light
 *            car behind a team of four (a quadriga): the two yoked in the
 *            middle and the two trace horses outside
 *   venator  the beast hunter: a short tunic, bound legs, the arm guard,
 *            the hunting spear
 *   lion     a lion of the hunts: the wolf's frame half again its size, a
 *            tawny coat and the dark mane (quadMesh.js `mane`)
 */
const SHOW_LOOKS = {
  racer: (u, seed) => {
    const fac = FACTION[(u.faction ?? 0) & 3];
    const driver = man(seed, { dress: ['tunic:short'], hair: 'crop', colours: { tunic: fac, trim: fac, leather: 0x4a3020, skin: pick(SKIN.italian, seed, 3), hair: pick(HAIR.dark, seed, 4) } }, ['cap', 'belt'], {}, { move: 'drive', run: 'drive', stand: 'drive', ready: 'drive', attack: 'drive' });
    driver.at = [0, 0.3, 0.12];
    const car = { rigid: 'cart:chariot', at: [0, 0, 0], colours: { accent: fac }, mount: -1, scale: 1, wheels: true };
    const team = [-0.98, -0.34, 0.34, 0.98].map((x, k) => {
      const h = horse(seed + k * 7, 'yoke', fac, [x, 0, Math.abs(x) > 1 ? 1.98 : 2.05]);
      h.scale = 0.9;
      return h;
    });
    return [driver, car, ...team];
  },
  venator: (u, seed) => [man(seed, { dress: ['tunic:short', 'caligae'], hair: 'crop', beard: 'short', colours: { tunic: pick([DYES.ochre, DYES.saffron, DYES.madder], seed, 1), metal: 0xb4b8be, leather: 0x5a3a24, skin: pick(SKIN.italian, seed, 3), hair: pick(HAIR.dark, seed, 4) } }, ['manica', 'wraps', 'belt'], { R: 'prop:spear' }, { ...SPEARMAN, ready: 'guard' })],
  lion: (u, seed) => {
    const lion = beast('quad:wolf:mane', { skin: 0xc0904e, mantle: 0xc49452, hair: 0xb08040, trim: 0xe2c89a, accent: 0xc89a3a, leather: 0x5e3a1c },
      { stand: 'wolf:stand', slow: 'wolf:trot', fast: 'wolf:lope', walk: 'wolf:walk', attack: 'wolf:bite', fall: 'wolf:fall', rest: 'wolf:lie', stalk: 'wolf:stalk' });
    lion.scale = 1.45;
    return [lion];
  },
};
