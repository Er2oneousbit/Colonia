/**
 * walkers/look.js
 * ----------------------------------------------------------------------------
 * How each walker type looks in 3D: the figures it is drawn with (a person,
 * the family behind him, the beasts he leads, the cart he pushes), each
 * person's dress from the Roman record (the people's garments and the palette
 * of dyes, people/actors.js), what he carries, and the clips he walks and
 * stands with. Stable by the walker's id: the same walker keeps his look all
 * his life, and after a reload. Pure: no three, no GPU (the tests read it).
 *
 * walkerLook(w, ctx) -> { key, figures, loads }
 *   figures  [{ person | rigid, place, move, stand, ... }]; the first is the
 *            walker himself, where the game puts him (renderer.js walkerWorld):
 *     person   an actor spec (actors.js pack: body, dress, hair, beard, props,
 *              colours, old, seed) and `wprops` (walkers/props.js)
 *     rigid    a piece key (walkers/beasts.js: 'beast:mule:pack', 'cart:handcart')
 *     place    { at: 'self' } | { at: 'ahead', x, y, z } (in the walker's own
 *              frame: his cart, his chariot's team) | { at: 'trail', gap, side }
 *              (that far behind him along the way he came: his family, his mule)
 *              | { at: 'trail', gap, side, aim: k } (facing figure k: a wagon
 *              behind its ox) | { at: 'rope', from: [k, point], to: [k, point] }
 *     move, stand  the clips he walks and stands with (motion.js may choose
 *              others by what he does: a prefect runs to a fire)
 *     stride   a beast's metres a cycle of its legs; swing its legs' swing
 *              (rad, negative: a trot); bob its back's rise (m)
 *   loads    [{ good, n, on: k, at: [[x, y, z], ...], scale }]: the goods on
 *            figure k, as the warehouse stacks them (models/wares.js buildLoad)
 *   key      what the look was made from: a new key, a new look
 * ----------------------------------------------------------------------------
 */

import { WALKER_TYPES } from '../../data/walkers.js';
import { GOODS } from '../../data/goods.js';
import { GODS } from '../../data/gods.js';
import { DYES, TUNICS, PALLAE, pick, hash01 } from '../people/actors.js';
import { LEAD_HAND } from '../people/clips.js';
import { HANDCART_BED, WAGON_BED, CHARIOT, BEAST_STRIDE } from './beasts.js';
import { cartCapacity, isWagon, cargoLevel, horsesLed, LED_GOODS } from '../../render/cargoArt.js';

/** Walker kinds drawn as 3D people (ships keep their sprites). */
export function drawnIn3D(type) {
  const def = WALKER_TYPES[type];
  return !!def && def.kind !== 'ship';
}

/** Where a beast's halter is (its own frame), for the rope that leads it; where a pack mule's tail is tied to the next. */
export const HALTER = Object.freeze({ mule: [0, 1.22, 1.16], horse: [0, 1.46, 1.24], ox: [0, 0.8, 1.3] });
export const CRUPPER = Object.freeze([0, 1.05, -0.62]);

/** A colour from a CSS '#rrggbb'. */
const hex = (css, fallback = 0xc9a86b) => (typeof css === 'string' && /^#[0-9a-f]{6}$/i.test(css) ? parseInt(css.slice(1), 16) : fallback);
/** A good's colour (data/goods.js), for a heap of it. */
export const goodColour = (good) => hex(GOODS[good]?.color);

/** Produce of a market's baskets: the colours of grain, greens, fruit, olives, grapes, fish. */
const PRODUCE = [0xd9b65a, 0x6a9a3f, 0xc8483a, 0x5a5a2a, 0x5a2a4a, 0xb0b8bc, 0xe08a30];
/** The four factions of the circus: the reds, the whites, the blues, the greens. */
const FACTIONS = [0xa8322b, 0xe8e2d4, 0x2f5f9e, 0x3f7a3a];
/** Beasts' coats (sRGB): bay, brown, grey, dun; an ox's greys and fawns. */
const MULE_COATS = [0x5a4030, 0x6e5440, 0x8a7a6a, 0x4a3a30, 0x7a6048];
const HORSE_COATS = [0x7a4626, 0x95562c, 0xb9b4aa, 0x2c2522, 0xb08a58, 0x4c2e1c];
const HORSE_MANES = [0x1f1714, 0xb07a4a, 0xd8d4cc, 0x1b1716, 0x3a2c22, 0x1d1612];
const OX_COATS = [0xcfc6b6, 0xb8ad9a, 0x9a8c78, 0xd8d0c0];

/** A person: body, dress, hair, props, colours by the walker's seed. */
function person(seed, o) {
  return {
    person: { body: 'm', hair: pick(['crop', 'crop', 'curls'], seed, 11), seed, ...o.spec },
    wprops: o.wprops || {},
    place: o.place || { at: 'self' },
    move: o.move || 'stride',
    stand: o.stand || 'idle',
    scale: o.spec && o.spec.body === 'c' ? 0.78 : 1,
    lift: o.lift || 0,
    // (A toga wearer plays the clips' toga variants: motion.js clipIndexOf.)
    toga: !!(o.spec && o.spec.dress && o.spec.dress.some((d) => d.startsWith('toga'))),
  };
}

/** A beast. */
function beast(kind, opts, place, colours) {
  const key = ['beast', kind, ...opts].join(':');
  const trot = opts.includes('trot');
  const stride = BEAST_STRIDE[trot ? `${kind}:trot` : kind];
  const swing = (kind === 'ox' ? 0.26 : trot ? 0.46 : 0.33) * (trot ? -1 : 1);
  return { rigid: key, beast: kind, place, stride, swing, bob: kind === 'ox' ? 0.02 : trot ? 0.045 : 0.03, colours, scale: 1 };
}

/** A rope from figure a's point to figure b's. */
function rope(a, pa, b, pb) {
  return { rigid: 'rope', rope: true, place: { at: 'rope', from: [a, pa], to: [b, pb] }, scale: 1, colours: {} };
}

/** The man who leads, his hand's place (clips.js LEAD_HAND) for the rope. */
const HAND = LEAD_HAND;

/** A beast's coat colours. */
function coat(kind, seed) {
  if (kind === 'horse') {
    const i = Math.floor(hash01(seed, 31) * HORSE_COATS.length) % HORSE_COATS.length;
    return { skin: HORSE_COATS[i], hair: HORSE_MANES[i], leather: 0x4a3020 };
  }
  if (kind === 'ox') return { skin: pick(OX_COATS, seed, 32), hair: 0x3a3028, leather: 0x5a3a24 };
  return { skin: pick(MULE_COATS, seed, 33), hair: 0x2a2018, leather: 0x5a3a24, mantle: pick([DYES.madder, DYES.woad, DYES.ochre, DYES.oatmeal], seed, 34) };
}

/**
 * The look of walker `w`. `ctx`: { origin: the def of the building that sent
 * it (a cart's), venue: the kind of venue an entertainer works for }.
 */
export function walkerLook(w, ctx = {}) {
  const seed = w.id * 1.618 + 3;
  // (A type with no look of its own, should one be added to the data: a plain citizen.)
  const make = LOOKS[w.type] || ((v, s) => [person(s, { spec: { dress: ['tunic:knee'] } })]);
  const out = make(w, seed, ctx);
  const look = Array.isArray(out) ? { figures: out, loads: [] } : { loads: [], ...out };
  look.key = lookKey(w, ctx);
  look.reach = reachOf(look.figures);
  return look;
}

/**
 * How far (metres along the walker's facing) what goes with him reaches, for
 * the click (renderer.js walker3d): the far end of a cart or a team before
 * him, else of a family or a beast behind him; 0 alone.
 */
export function reachOf(figures) {
  let ahead = 0;
  let behind = 0;
  for (const f of figures) {
    const p = f.place;
    if (p.at === 'ahead') ahead = Math.max(ahead, p.z + (f.rigid === 'cart:handcart' ? 1.9 : f.rigid === 'cart:chariot' ? 0.4 : 1.2));
    else if (p.at === 'trail') behind = Math.max(behind, p.gap + (f.rigid ? 1.1 : 0.2));
  }
  return ahead > 0 ? ahead : -behind;
}

/**
 * What a walker's look depends on, as one string: its type, what it carries
 * and how much, its family, its beasts, its venue. The pass makes the look
 * again only when this changes.
 */
export function lookKey(w, ctx = {}) {
  const c = w.cargo && w.cargo.amount > 0 ? `${w.cargo.good}:${w.cargo.amount}` : '';
  const packs = Array.isArray(w.packs) ? w.packs.join('+') : '';
  return `${w.type}|${c}|${w.people || 0}|${w.mule ? 1 : 0}|${packs}|${w.god || ''}|${w.venue || ctx.venue || ''}|${ctx.origin ? ctx.origin.kind + ':' + (ctx.origin.produces || '') : ''}`;
}

// ---------------------------------------------------------------------------
// The looks
// ---------------------------------------------------------------------------

/** A family walking behind its man: a woman, then a child (immigrants, emigrants). */
function family(w, seed, n, sad) {
  const out = [];
  if (n >= 2) {
    out.push(person(seed + 1, {
      spec: { body: 'f', dress: ['tunic:long', 'palla'], hair: 'bun', colours: { tunic: pick(sad ? [DYES.fawn, DYES.brownWool, DYES.grey] : [DYES.oatmeal, DYES.rose, DYES.sky, DYES.weld], seed, 41), mantle: pick(PALLAE, seed, 42) } },
      wprops: hash01(seed, 43) < 0.5 ? { L: 'basket' } : { L: 'bundle' },
      move: hash01(seed, 43) < 0.5 ? 'headCarry' : 'bundle',
      place: { at: 'trail', gap: 1.25, side: 0.28 },
    }));
  }
  if (n >= 3) {
    out.push(person(seed + 2, {
      spec: { body: 'c', dress: ['tunic:knee'], hair: pick(['curls', 'crop', 'bun'], seed, 44), colours: { tunic: pick(TUNICS, seed, 45) } },
      place: { at: 'trail', gap: 0.85, side: -0.34 },
    }));
  }
  return out;
}

/** A man leading a mule (and a second tied behind it), packed with `packs` goods' colours. */
function muleTrain(seed, leader, n, packs) {
  const figs = [leader];
  for (let k = 0; k < n; k++) {
    const good = packs[k % Math.max(1, packs.length)];
    figs.push(beast('mule', ['pack'], { at: 'trail', gap: 1.95 + k * 2.05, side: 0.05 }, { ...coat('mule', seed + k), accent: good ? goodColour(good) : 0xb59a6a }));
  }
  figs.push(rope(0, HAND, 1, HALTER.mule));
  for (let k = 1; k < n; k++) figs.push(rope(k, CRUPPER, k + 1, HALTER.mule));
  return figs;
}

const LOOKS = {
  // Vigiles: a short tunic of the red the game gives them, nailed boots, the esparto bucket; they run to a fire.
  prefect: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:short', 'caligae'], colours: { tunic: pick([DYES.madder, DYES.oxblood, DYES.madder], seed, 1), leather: 0x4a3020 } },
    wprops: { R: 'bucket' },
  })],
  // An architect's man: the ten-foot rod on his shoulder, his tool case.
  engineer: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:knee'], beard: hash01(seed, 2) < 0.5 ? 'short' : null, colours: { tunic: pick([DYES.ochre, DYES.walnut, DYES.fawn], seed, 1) } },
    wprops: { L: 'rod', R: 'case' }, move: 'haul',
  })],
  // A priest of the city's god: the toga drawn over his head (capite velato), its border the god's colour, the patera.
  priest: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:long', 'toga:velato'], hair: 'bald', old: true, props: { R: 'patera' }, colours: { tunic: DYES.white, mantle: DYES.candida, accent: w.god && GODS[w.god] ? hex(GODS[w.god].color) : DYES.murex } },
  })],
  // A mission's envoy in his travelling cloak, a staff.
  missionary: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:knee', 'paenula'], beard: 'full', colours: { tunic: DYES.undyed, mantle: pick([DYES.walnut, DYES.fawn, DYES.brownWool], seed, 1) } },
    wprops: { R: 'staff' }, move: 'march',
  })],
  // A schoolmaster (litterator): the Greek mantle, a roll and his tablets.
  teacher: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:knee', 'pallium'], beard: pick(['short', 'full', null], seed, 2), colours: { tunic: DYES.oatmeal, mantle: pick([DYES.woad, DYES.sky, DYES.fawn], seed, 1) }, props: { R: 'roll', L: 'tablet' } },
  })],
  // The library's man with a round book box (capsa) of rolls.
  librarian: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:long', 'pallium'], colours: { tunic: DYES.white, mantle: pick([DYES.murex, DYES.purple, DYES.woad], seed, 1) }, props: { L: 'roll' } },
    wprops: { R: 'capsa' },
  })],
  // A philosopher of the academy: old, bearded, the pallium, a roll and tablets.
  scholar: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:knee', 'pallium'], hair: 'bald', beard: 'full', old: true, colours: { tunic: DYES.oatmeal, mantle: pick([DYES.fawn, DYES.grey, DYES.green], seed, 1) }, props: { R: 'roll', L: 'tablet' } },
  })],
  // A barber (tonsor): short tunic, clean-shaven, his case of razors.
  barber: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:short'], hair: 'curls', colours: { tunic: pick([DYES.weld, DYES.saffron, DYES.ochre], seed, 1) } },
    wprops: { R: 'case' },
  })],
  // A physician (medicus), often a Greek: the pallium, his bronze-cornered case.
  physician: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:knee', 'pallium'], beard: 'short', colours: { tunic: DYES.white, mantle: pick([DYES.green, DYES.olive, DYES.sky], seed, 1) } },
    wprops: { R: 'medcase' },
  })],
  // A bath attendant: a towel over his shoulder, the oil flask and strigil on their ring.
  bather: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:short'], hair: 'curls', colours: { tunic: pick([DYES.sky, DYES.white, DYES.undyed], seed, 1) } },
    wprops: { L: 'towel', R: 'aryballos' }, move: 'haul',
  })],
  // An entertainer as his venue has him: an actor with his mask, a gladiator, a beast-fighter, a charioteer.
  entertainer: (w, seed, ctx) => performerLook(w, seed, ctx.venue || w.venue),
  performer: (w, seed, ctx) => performerLook(w, seed, w.venue || ctx.venue),
  charioteer: (w, seed) => chariotLook(w, seed),
  // A topiarius: green-brown tunic, shears.
  gardener: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:short'], colours: { tunic: pick([DYES.green, DYES.olive, DYES.fawn], seed, 1) } },
    wprops: { R: 'shears' },
  })],
  // A tax collector: a dark cloak, his tablets and the purse.
  taxman: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:knee', 'paenula'], colours: { tunic: DYES.oatmeal, mantle: pick([DYES.woad, DYES.black, DYES.grey], seed, 1) }, props: { R: 'purse', L: 'tablet' } },
  })],
  // A market woman with her basket on her head; now and then a man with one at his hip.
  vendor: (w, seed) => (hash01(seed, 3) < 0.7
    ? [person(seed, {
      spec: { body: 'f', dress: ['tunic:long', 'palla'], hair: 'bun', colours: { tunic: pick([DYES.oatmeal, DYES.rose, DYES.saffron, DYES.sky, DYES.weld], seed, 1), mantle: pick(PALLAE, seed, 2), trim: DYES.white, accent: pick(PRODUCE, seed, 4) } },
      wprops: { L: 'basket' }, move: 'headCarry',
    })]
    : [person(seed, {
      spec: { dress: ['tunic:short'], colours: { tunic: pick(TUNICS, seed, 1), accent: pick(PRODUCE, seed, 4) } },
      wprops: { L: 'hipBasket' }, move: 'hipCarry',
    })]),
  // A market's buyer: a basket at his hip, heaped with what he bought.
  buyer: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:short'], colours: { tunic: pick([DYES.ochre, DYES.fawn, DYES.madder, DYES.undyed], seed, 1), accent: w.cargo && w.cargo.amount > 0 ? goodColour(w.cargo.good) : 0x8a7050 } },
    wprops: { L: 'hipBasket' }, move: 'hipCarry',
  })],
  cart: (w, seed, ctx) => cartLook(w, seed, ctx),
  // A work camp's crew: a timber, tools, a basket of lime.
  builders: (w, seed) => [
    person(seed, { spec: { dress: ['tunic:short'], colours: { tunic: DYES.fawn } }, wprops: { L: 'plank' }, move: 'haul' }),
    person(seed + 1, { spec: { dress: ['tunic:short'], beard: 'short', colours: { tunic: DYES.brownWool } }, wprops: { R: 'case' }, place: { at: 'trail', gap: 1.15, side: 0.32 } }),
    person(seed + 2, { spec: { dress: ['tunic:short'], colours: { tunic: DYES.undyed, accent: 0xd8d2c4 } }, wprops: { L: 'basket' }, move: 'headCarry', place: { at: 'trail', gap: 2.2, side: -0.25 } }),
  ],
  immigrant: (w, seed) => settlers(w, seed, false),
  emigrant: (w, seed) => settlers(w, seed, true),
  // The homeless: alone, in a worn tunic, his bundle.
  homeless: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:short'], hair: 'curls', beard: 'full', colours: { tunic: pick([DYES.brownWool, DYES.grey, DYES.fawn], seed, 1), mantle: DYES.brownWool } },
    wprops: { L: 'bundle' }, move: 'bundle',
  })],
  // A recruit marching to his fort: mail, helmet, nailed boots, spear and shield.
  recruit: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:knee', 'lorica', 'caligae', 'helmet'], props: { R: 'spear', L: 'scutum' }, colours: { tunic: DYES.madder, accent: DYES.madder, metal: 0x8a8c90 } },
    move: 'march', stand: 'guard',
  })],
  // A trader from a distant city leading his pack mules.
  caravan: (w, seed) => muleTrain(seed, person(seed, {
    spec: { dress: ['tunic:knee', 'paenula'], beard: 'full', colours: { tunic: pick([DYES.saffron, DYES.madder, DYES.woad], seed, 1), mantle: pick([DYES.walnut, DYES.ochre, DYES.oxblood], seed, 2) } },
    move: 'lead',
  }), 2, Array.isArray(w.packs) ? w.packs : []),
  // A villager come to trade: the natives' undyed wool, long hair, a beard, his bundle.
  native_trader: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:knee'], hair: 'curls', beard: 'full', colours: { tunic: pick([DYES.undyed, DYES.fawn, DYES.oatmeal], seed, 1), mantle: pick([DYES.brownWool, DYES.green, DYES.ochre], seed, 2), skin: pick([0xb88560, 0xa87452, 0x9a6a4a], seed, 3) } },
    wprops: { L: 'bundle' }, move: 'bundle',
  })],
  // A protester: a placard shaken over his head.
  protester: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:knee'], beard: pick(['short', null], seed, 2), colours: { tunic: pick([DYES.fawn, DYES.brownWool, DYES.oatmeal], seed, 1) } },
    wprops: { R: 'placard' }, move: 'brandish', stand: 'protest',
  })],
  // A thief: a dark cloak, his loot over his shoulder.
  thief: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:short', 'paenula'], colours: { tunic: DYES.black, mantle: pick([DYES.black, DYES.brownWool], seed, 1) }, props: { L: 'sack' } },
    move: 'haul',
  })],
  // A rioter: a torch held up.
  rioter: (w, seed) => [person(seed, {
    spec: { dress: ['tunic:short'], beard: 'short', colours: { tunic: pick([DYES.oxblood, DYES.brownWool, DYES.madder], seed, 1) } },
    wprops: { R: 'torch' }, move: 'brandish', stand: 'protest',
  })],
};

/** Settlers: a man with his bundle and his family, or riding in with a mule. */
function settlers(w, seed, sad) {
  const n = Math.max(1, Math.min(3, w.people || 1));
  const tunic = sad ? pick([DYES.brownWool, DYES.grey, DYES.fawn, DYES.walnut], seed, 1) : pick([DYES.oatmeal, DYES.ochre, DYES.madder, DYES.woad, DYES.undyed], seed, 1);
  const man = person(seed, {
    spec: { dress: ['tunic:knee', 'paenula'], beard: pick(['short', 'full', null], seed, 2), old: sad && hash01(seed, 5) < 0.4, colours: { tunic, mantle: pick([DYES.walnut, DYES.fawn, DYES.brownWool, DYES.olive], seed, 3) } },
    wprops: w.mule ? {} : { L: 'bundle' }, move: w.mule ? 'lead' : 'bundle',
  });
  if (w.mule) return muleTrain(seed, man, 1, []);
  return [man, ...family(w, seed, n, sad)];
}

/** A performer as his venue has him. */
function performerLook(w, seed, venue) {
  if (venue === 'hippodrome') return chariotLook(w, seed);
  if (venue === 'amphitheater') {
    // A gladiator (a murmillo's gear): loincloth and belt, nailed boots, a crested helmet, the big shield and the short sword.
    return [person(seed, {
      spec: { dress: ['limus', 'caligae', 'helmet'], hair: 'crop', props: { L: 'scutum' }, colours: { tunic: DYES.white, trim: DYES.madder, accent: pick([DYES.madder, DYES.woad, DYES.green], seed, 1), metal: 0xb08848 } },
      wprops: { R: 'gladius' }, move: 'march', stand: 'guard',
    })];
  }
  if (venue === 'colosseum') {
    // A beast-fighter (bestiarius): a short tunic, bound legs, the hunting spear.
    return [person(seed, {
      spec: { dress: ['tunic:short', 'caligae'], props: { R: 'spear' }, colours: { tunic: pick([DYES.ochre, DYES.saffron], seed, 1) } },
      move: 'march', stand: 'guard',
    })];
  }
  // An actor of the theatre: a long bright tunic, his mask in his hand.
  return [person(seed, {
    spec: { dress: ['tunic:long'], hair: 'curls', colours: { tunic: pick([DYES.saffron, DYES.rose, DYES.sky, DYES.weld], seed, 1), trim: DYES.white } },
    wprops: { R: 'mask' },
  })];
}

/** A charioteer: his faction's colour, the car, the two horses. */
function chariotLook(w, seed) {
  const fac = FACTIONS[Math.floor(hash01(seed, 21) * FACTIONS.length) % FACTIONS.length];
  const figs = [
    person(seed, { spec: { dress: ['tunic:short', 'helmet'], colours: { tunic: fac, metal: 0x6e4a2e } }, move: 'drive', stand: 'drive', lift: CHARIOT.floor }),
    { rigid: 'cart:chariot', place: { at: 'ahead', x: 0, y: 0, z: 0 }, scale: 1, colours: { accent: fac }, wheels: true },
  ];
  for (const [x, z] of CHARIOT.horses) figs.push(beast('horse', ['trot'], { at: 'ahead', x, y: 0, z }, coat('horse', seed + x)));
  return figs;
}

/** A cart pusher and his cart; a drover leading horses; a farm's wagon behind its ox. */
function cartLook(w, seed, ctx) {
  const origin = ctx.origin || null;
  const loaded = !!(w.cargo && w.cargo.amount > 0);
  const good = loaded ? w.cargo.good : null;
  const tunic = pick([DYES.fawn, DYES.undyed, DYES.oatmeal, DYES.brownWool, DYES.ochre], seed, 1);
  const leading = loaded ? LED_GOODS.includes(good) : LED_GOODS.includes(origin?.produces);
  if (leading) {
    // A ranch's drover leads the horses on a rope, nose to tail; home with the rope alone.
    const man = person(seed, { spec: { dress: ['tunic:short'], colours: { tunic } }, move: loaded ? 'lead' : 'stride' });
    if (!loaded) return [man];
    const n = Math.min(3, horsesLed(w.cargo.amount));
    const figs = [man];
    for (let k = 0; k < n; k++) figs.push(beast('horse', [], { at: 'trail', gap: 2.1 + k * 2.3, side: 0 }, coat('horse', seed + k * 3)));
    figs.push(rope(0, HAND, 1, HALTER.horse));
    for (let k = 1; k < n; k++) figs.push(rope(k, [0, 1.15, -0.75], k + 1, HALTER.horse));
    return figs;
  }
  const n = loaded ? cargoLevel(w.cargo.amount, cartCapacity(origin, w.cargo.amount)) : 0;
  if (isWagon(origin)) {
    // The farm's wagon: the drover leads the ox, the wagon behind it, its pole to the yoke.
    const B = WAGON_BED;
    const oxGap = 1.95;
    const figs = [
      person(seed, { spec: { dress: ['tunic:short'], hair: 'curls', colours: { tunic } }, move: 'lead' }),
      beast('ox', ['yoke'], { at: 'trail', gap: oxGap, side: 0 }, coat('ox', seed)),
      { rigid: 'cart:wagon', place: { at: 'trail', gap: oxGap + B.pole - 0.73, side: 0, aim: 1 }, scale: 1, colours: {}, wheels: true },
      rope(0, HAND, 1, HALTER.ox),
    ];
    const spots = [[-0.27, -0.5], [0.27, -0.5], [-0.27, 0.45], [0.27, 0.45]];
    return { figures: figs, loads: n ? [{ good, n, on: 2, at: spots.slice(0, n).map(([x, z]) => [x, B.y, z]), scale: 0.9 }] : [] };
  }
  // A handcart pushed before him.
  const H = HANDCART_BED;
  const figs = [
    person(seed, { spec: { dress: ['tunic:short'], colours: { tunic } }, move: 'push', stand: 'idle' }),
    { rigid: 'cart:handcart', place: { at: 'ahead', x: 0, y: 0, z: 0 }, scale: 1, colours: {}, wheels: true },
  ];
  const spots = [[-0.15, -0.24], [0.15, 0.24], [0.15, -0.24], [-0.15, 0.24]];
  return { figures: figs, loads: n ? [{ good, n, on: 1, at: spots.slice(0, n).map(([x, z]) => [x, H.y, H.z + z]), scale: 0.36 }] : [] };
}
