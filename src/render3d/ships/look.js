/**
 * ships/look.js
 * ----------------------------------------------------------------------------
 * What a vessel of the sim looks like in 3D, read from the sim's own
 * fields (never written): which kind (designs.js) every walker and unit
 * that sails is drawn as, what it is doing (under sail, rowing, moored,
 * at anchor, fishing, fighting), and its crew as actors of the people
 * system (people/actors.js specs) in the ship's frame (metres, the bow
 * +z, the water at y = 0):
 *
 *   ship (merchant)   a corbita, or a coaster for the near partners of the
 *                     western sea (Massilia's and Cirta's coasting trade);
 *                     its sail striped in the partner's colour. A
 *                     helmsman, the master, two sailors hauling on the
 *                     sheets; moored, the hands with sacks on their
 *                     shoulders and the master at the hatch
 *   fishing_boat      a fishing boat: out and home under sail (the helmsman
 *                     and two fishermen at ease), at the grounds the sail
 *                     brailed up and the net out, one casting, one hauling,
 *                     the helmsman holding her; home with a basket of the
 *                     catch; moored, one man left aboard with the nets
 *   liburnian         the liburnian: fourteen rowers pulling together to
 *                     the hortator's mallet, the helmsman, three marines
 *                     on the bow's fighting deck (spears and shields; bows
 *                     drawn when it fights); the sail set on passage,
 *                     furled to fight, at its berth or holding the water
 *   raider_ship       the craft of the raiding people (data/peoples.js):
 *                     the Gauls', the Boii's and the Cimbri's a Venetic
 *                     ship, the Carthaginians' a Punic galley, everyone
 *                     else's a lembos; its rowers, and as many warriors
 *                     standing on its decks as it still carries (u.crew);
 *                     one swings a fire pot at the bow as it throws
 *
 * Every kind of vessel the sim moves has a design (the tests check it): a
 * walker of kind 'ship' or a unit with `naval`.
 * ----------------------------------------------------------------------------
 */

import { DESIGNS } from './designs.js';
import { placesOf, HORTATOR_T } from './hulls.js';
import { DYES } from '../people/actors.js';
import { BEAT } from '../people/clips.js';

/** The near partners whose ships are coasters (their traders sail the coasts of the western sea). */
export const COASTER_PARTNERS = Object.freeze(['massilia', 'cirta']);

/** The raiders' craft by people (data/peoples.js ids); anyone else's is a lembos. */
export const RAIDER_CRAFT = Object.freeze({ gauls: 'gaulish', boii: 'gaulish', cimbri: 'gaulish', carthaginians: 'punic' });

/** Is `e` (a walker or a unit) a vessel the ships' pass draws? */
export function isVessel(e) {
  return e.kind === 'ship' || e.type === 'liburnian' || e.type === 'raider_ship';
}

/**
 * The design a vessel is drawn as. `people` the raid's people id (the
 * raider ship's invasion's, else the province's): sim/combat.js raidPeople.
 */
export function vesselKind(e, people = null) {
  if (e.type === 'fishing_boat') return 'fishing';
  if (e.type === 'liburnian') return 'liburnian';
  if (e.type === 'raider_ship') return RAIDER_CRAFT[people] || 'lembos';
  if (e.kind === 'ship') return COASTER_PARTNERS.includes(e.partner) ? 'coaster' : 'corbita';
  return null;
}

/**
 * What a vessel is doing, for its sail, oars and crew:
 *   sail      under way under sail (merchants, fishing boats; warships on passage, rowing too: `row`)
 *   moored    tied up at its quay or berth: sail furled, oars in
 *   anchor    lying still at sea (holding the water, waiting offshore): sail furled, oars resting
 *   fishing   at the grounds, the net out
 *   fight     rowing to fight, the sail furled
 * Returns { mode, row (its rowers pull), sail (its sail set), catch, net }.
 */
export function vesselMode(e, moving) {
  const t = e.type;
  if (t === 'ship') return e.state === 'docked' ? { mode: 'moored', row: false, sail: false } : { mode: 'sail', row: false, sail: true };
  if (t === 'fishing_boat') {
    if (e.state === 'fishing') return { mode: 'fishing', row: false, sail: false, net: true };
    if (e.state === 'moored' || e.state === 'spare') return { mode: 'moored', row: false, sail: false };
    return { mode: 'sail', row: false, sail: true, catch: e.state === 'homeWithCatch' };
  }
  if (t === 'liburnian') {
    if (e.state === 'berthed' || e.state === 'training') return { mode: 'moored', row: false, sail: false };
    if (e.state === 'engage') return { mode: 'fight', row: true, sail: false };
    if (!moving) return { mode: 'anchor', row: false, sail: false };
    return { mode: 'sail', row: true, sail: true };
  }
  if (t === 'raider_ship') {
    if (e.state === 'offshore' || !moving) return { mode: 'anchor', row: false, sail: false };
    return { mode: 'sail', row: true, sail: true };
  }
  return { mode: 'sail', row: false, sail: true };
}

/** A sailor: an undyed or cheaply dyed short tunic, bare-headed. */
function sailor(seed, extra = {}) {
  const tunics = [DYES.undyed, DYES.fawn, DYES.oatmeal, DYES.brownWool, DYES.sky, DYES.ochre];
  return { body: 'm', dress: ['tunic:short'], hair: seed % 3 ? 'crop' : 'curls', beard: seed % 2 ? 'short' : null, seed, colours: { tunic: tunics[seed % tunics.length] }, ...extra };
}

/** A marine of the fleet: mail, helmet, the red tunic of Rome's soldiers. */
function marine(seed, extra = {}) {
  return { body: 'm', dress: ['tunic:knee', 'lorica', 'caligae', 'helmet'], hair: 'crop', seed, colours: { tunic: DYES.madder, accent: DYES.madder, metal: 0x8a8c90 }, ...extra };
}

/** A raiding warrior of a people: their dress and colours (the raiders' own, not Rome's). */
function warrior(people, seed, extra = {}) {
  const gaul = RAIDER_CRAFT[people] === 'gaulish';
  const punic = people === 'carthaginians';
  const tunics = gaul ? [0x6a5a3a, 0x8a3a2a, 0x3e4a5a, 0x7a6a4a] : punic ? [DYES.white, 0x5b1e3c, DYES.madder, DYES.oatmeal] : [DYES.brownWool, DYES.fawn, 0x5a4a38, DYES.walnut];
  const dress = punic ? ['tunic:knee', 'lorica', 'helmet'] : seed % 3 === 0 ? ['tunic:short', 'helmet'] : ['tunic:short'];
  return {
    body: 'm', dress, hair: gaul ? 'curls' : seed % 2 ? 'curls' : 'crop', beard: gaul || seed % 2 ? 'full' : 'short', seed,
    colours: { tunic: tunics[seed % tunics.length], hair: gaul ? [0x9a7a4a, 0x7a3a20, 0x6a4428][seed % 3] : undefined, metal: 0x7a7468 }, ...extra,
  };
}

/** The deck's height (the ship's frame) at t, for a figure standing there. */
function on(P, t) {
  return P.deck(t);
}

/** A point at t along the middle line (z) at height y, x across. */
function at(kind, t, x, y) {
  const L = DESIGNS[kind].hull.L - 0.7;
  return [x, y, (t - 0.5) * L];
}

/** The rowers of an oared design: at their benches pulling (`row`), or sitting easy with their oars in. */
function rowers(kind, P, row, seed0, dress) {
  return P.benches.map((b, i) => {
    const base = dress(seed0 + i);
    if (row) return { ...base, clip: b.clip, props: { R: 'sweep' }, at: b.at, ry: Math.PI, stroke: true, phase: 0.06 * (((i * 0.618) % 1) - 0.5) };
    // (Easy on the bench: sitting, the feet a seat's height under it.)
    return { ...base, clip: 'sit', at: [b.at[0], b.at[1] - 0.07, b.at[2]], ry: b.s > 0 ? -Math.PI / 2 : Math.PI / 2 };
  });
}

/**
 * The crew of a vessel of `kind` in mode `m` (vesselMode), as actor specs
 * in the ship's frame. `people` a raider's; `aboard` how many warriors it
 * still carries; `throwing` a pot swung at the bow. Each spec may carry
 * `stroke` (its clip runs on the ship's stroke clock: a rower) and
 * `warrior` (the n-th warrior: shown only while that many are aboard).
 */
export function crewOf(kind, m, { people = null, throwing = false } = {}) {
  const P = placesOf(kind);
  const mode = m.mode;
  const list = [];
  if (kind === 'corbita' || kind === 'coaster') {
    const big = kind === 'corbita';
    const helm = big ? 0.11 : 0.12;
    list.push({ ...sailor(701), clip: 'idle', at: [0, on(P, helm), at(kind, helm, 0, 0)[2]], ry: 0 });
    if (mode === 'moored') {
      list.push({ ...sailor(702), clip: 'shoulder', props: { L: 'sack' }, at: [0.45, on(P, 0.62), at(kind, 0.62, 0, 0)[2]], ry: Math.PI / 2 });
      if (big) {
        list.push({ ...sailor(703), clip: 'shoulder', props: { L: 'sack' }, at: [-0.5, on(P, 0.66), at(kind, 0.66, 0, 0)[2]], ry: -Math.PI / 2 });
        list.push({ body: 'm', dress: ['tunic:knee', 'paenula'], hair: 'crop', beard: 'short', seed: 704, clip: 'hold', props: { R: 'tablet' }, at: [0.55, on(P, 0.36), at(kind, 0.36, 0, 0)[2]], ry: -Math.PI / 2, colours: { tunic: DYES.weld, mantle: DYES.walnut } });
      }
      return list;
    }
    // Under sail: the hands hauling on the sheets aft of the mast, the master watching the sail.
    // (Forward of the mast: aft of it on a corbita is the hatch over the hold.)
    const mt = DESIGNS[kind].masts[0].t;
    list.push({ ...sailor(702), clip: 'haulLine', at: [0.5, on(P, mt + 0.08), at(kind, mt + 0.08, 0, 0)[2]], ry: Math.PI + 0.5 });
    if (big) {
      list.push({ ...sailor(703), clip: 'haulLine', at: [-0.55, on(P, mt + 0.13), at(kind, mt + 0.13, 0, 0)[2]], ry: Math.PI - 0.5 });
      list.push({ body: 'm', dress: ['tunic:knee', 'paenula'], hair: 'crop', beard: 'short', seed: 704, clip: 'talk', at: [0.2, on(P, 0.33) + 0.75, at(kind, 0.22, 0, 0)[2]], ry: 0, colours: { tunic: DYES.weld, mantle: DYES.walnut } });
    }
    return list;
  }
  if (kind === 'fishing') {
    const helm = { ...sailor(711), clip: 'sit', at: [0.05, on(P, 0.1) - 0.45 + 0.05, at(kind, 0.1, 0, 0)[2]], ry: 0 };
    if (mode === 'moored') return [{ ...sailor(712), clip: 'sit', at: [0, on(P, 0.5) - 0.5, at(kind, 0.5, 0, 0)[2]], ry: Math.PI / 2 }];
    list.push(helm);
    if (mode === 'fishing') {
      // One casting the net over the side (the throw: douse, both hands), one hauling it in.
      // (Both at the starboard side, where the net is: hulls.js and pass.js put it there.)
      list.push({ ...sailor(712), clip: 'douse', at: [0.05, P.point(0.8, 0.3)[1], at(kind, 0.8, 0, 0)[2]], ry: Math.PI / 2 + 0.3, phase: 0.3 });
      list.push({ ...sailor(713), clip: 'haulLine', at: [0.12, P.point(0.42, 0.3)[1], at(kind, 0.42, 0, 0)[2]], ry: Math.PI / 2 });
      return list;
    }
    list.push({ ...sailor(712), clip: 'sit', at: [0, on(P, 0.5) - 0.5, at(kind, 0.5, 0, 0)[2]], ry: Math.PI / 2 + 0.3 });
    list.push({ ...sailor(713), clip: 'sit', at: [0, on(P, 0.3) - 0.5, at(kind, 0.3, 0, 0)[2]], ry: -Math.PI / 2 - 0.2 });
    return list;
  }
  if (kind === 'liburnian') {
    const row = m.row;
    list.push(...rowers(kind, P, row, 720, (s) => sailor(s)));
    // The hortator on the stern's deck facing the rowers, his mallet on his block (hulls.js puts it at BEAT).
    const hz = at(kind, HORTATOR_T, 0, 0)[2];
    if (row) list.push({ ...sailor(740, { old: true, hair: 'bald', beard: 'short' }), clip: 'beat', props: { R: 'hammer' }, at: [0.05, on(P, HORTATOR_T) - 0.02, hz], ry: 0, stroke: true, colours: { tunic: DYES.madder } });
    // The helmsman between the tillers.
    list.push({ ...sailor(741), clip: 'idle', at: [0, on(P, 0.1), at(kind, 0.1, 0, 0)[2]], ry: 0 });
    // The marines on the bow's fighting deck: spears and shields, or bows drawn when it fights.
    const fight = mode === 'fight';
    for (const [k, x, t, ry] of [[0, 0.35, 0.86, 0.6], [1, -0.35, 0.88, -0.6], [2, 0, 0.92, 0]]) {
      if (mode === 'moored' && k === 2) continue;
      list.push(fight
        ? marine(745 + k, { clip: 'shoot', props: { L: 'bow', R: 'arrow' }, at: [x, on(P, t), at(kind, t, 0, 0)[2]], ry: ry + (x > 0 ? Math.PI / 2 : x < 0 ? -Math.PI / 2 : Math.PI / 2) })
        : marine(745 + k, { clip: 'guard', props: { R: 'spear', L: 'scutum' }, at: [x, on(P, t), at(kind, t, 0, 0)[2]], ry }));
    }
    return list;
  }
  // The raiders' craft: rowers, a steersman, and the warriors aboard on the decks.
  const row = m.row;
  list.push(...rowers(kind, P, row, 760, (s) => warrior(people, s, { dress: ['tunic:short'] })));
  list.push({ ...warrior(people, 779), clip: 'idle', at: [0, on(P, 0.08), at(kind, 0.08, 0, 0)[2]], ry: 0 });
  const spots = [[0.92, 0], [0.88, 0.3], [0.88, -0.3], [0.15, 0.3], [0.15, -0.3], [0.2, 0], [0.84, 0], [0.11, 0]];
  spots.forEach(([t, x], n) => {
    const thrower = n === 0 && throwing;
    list.push({
      ...warrior(people, 781 + n), clip: thrower ? 'douse' : n % 3 === 2 ? 'cheer' : 'guard', props: thrower ? {} : { R: 'spear', L: n % 2 ? 'scutum' : undefined },
      at: [x, on(P, t), at(kind, t, 0, 0)[2]], ry: thrower ? 0 : x > 0 ? 0.9 : x < 0 ? -0.9 : 0, warrior: n,
    });
  });
  return list;
}

/** The hortator's block on a liburnian (hulls.js): BEAT before and to the right of the hortator's place (the tests). */
export function hortatorBlock(kind = 'liburnian') {
  const P = placesOf(kind);
  const z = at(kind, HORTATOR_T, 0, 0)[2];
  // He faces +z (the rowers ahead of him toward the bow): his right is -x.
  return [0.05 + BEAT.side, P.deck(HORTATOR_T) - 0.02 + BEAT.height, z + BEAT.ahead];
}

/**
 * The key a vessel's look is cached by (the crew's cast and the kits it
 * shows change only with these): its kind, mode, its partner's colour, a
 * raider's people, whether a pot is being thrown.
 */
export function lookKeyOf(kind, m, { partner = '', people = '', throwing = false } = {}) {
  return `${kind}|${m.mode}|${m.row ? 1 : 0}|${partner}|${people}|${throwing ? 1 : 0}`;
}
