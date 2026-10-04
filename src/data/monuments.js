/**
 * monuments.js (data)
 * ----------------------------------------------------------------------------
 * The great works a late city may raise, one per city: what each costs, the
 * stages it is built in, what it needs once finished and how hard it is to
 * knock down. Colonia's own design after the community engines' monuments,
 * fitted to Colonia's goods (clay, timber, marble, iron and finished goods:
 * no stone, bricks, concrete or gold).
 *
 * The machinery (sim/monuments.js) reads only these tables, so a bigger
 * work later (Nova Roma's palace) is new data: its own stages, footprint
 * size (data/buildings.js `size`) and camp rule.
 *
 * Per monument type (MONUMENT_TYPES, keyed by `mon` in data/buildings.js):
 *   place      Dn paid to lay the site out (stage 1's money is paid with it,
 *              so the build menu shows what placing costs: data/buildings.js)
 *   stages     in order: { name, en, goods: { good: units }, work, money }.
 *              `work` is in camp-days, what one fully staffed work camp's
 *              builders do in a day; `money` is paid as the stage starts
 *   workers    staff once finished (an unfinished site employs nobody)
 *   upkeep     Dn a month once finished, x the difficulty's monumentUpkeep
 *   store      a good it burns or eats once finished, fetched by its own
 *              cart into a store of its own: { good, cap, perYear } (good
 *              'food': any food, from a granary). Empty store: no effects
 *   hp         [site, finished] hit points against raiders (sim/military.js)
 *   needs      'sea' (a sea partner and navigable water), 'land2' (two land
 *              partners), 'piped' (works only on piped water, like baths)
 *   fromStep   the first campaign step that offers it (the sandbox has all)
 *   campRule   how its work camps fare short of food or water (CAMP_RULES;
 *              missing: halfPace, every monument now)
 *
 * Every number here is Colonia's own (see docs/GAMEPLAY.md, Monuments).
 * ----------------------------------------------------------------------------
 */

/** The desirability of a site under construction, whatever it will be: a noisy yard (the work camp's value). */
export const SITE_DES = Object.freeze([-6, 1, 1, 4]);

/** A finished monument works while at least this share of its staff is at work (75%). */
export const OPEN_STAFF = 0.75;

/** What finishing one brings, once: Caesar's favor, the city's mood (fading like a festival's lift); and culture while it stands. */
export const DONE_FAVOR = 8;
export const DONE_MOOD = 6;
export const MONUMENT_CULTURE = 5;

/** Hall of Fame points for a finished monument standing at a win (sim/fame.js). */
export const FAME_MONUMENT = 150;

/**
 * The work camp (Castra Operarum). Its carts (by staffing, as the Emporium's
 * dock workers: 3 at 75% or more, 2 at 50%, 1 with any staff) each bring up
 * to CAMP_LOAD units from a warehouse; its crew works shifts of CREW_SHIFT
 * days on the site, then walks home to rest a day. At most CAMPS_PER_SITE
 * camps' crews count on one site (a site is only so big).
 */
export const CAMP = Object.freeze({
  load: 400, // units a cart brings a trip (the Emporium's wagon)
  minStock: 100, // a warehouse must hold this much of a good for a cart to go for it
  shift: 16, // days a crew works on the site before it walks home
  rest: 1, // days it rests at the camp between shifts
  perSite: 3, // camps whose crews count on one site
  larder: 200, // food the camp keeps
  larderLow: 100, // its buyer goes to a granary below this
  foodLoad: 100, // what the buyer brings back a trip
  eatsPerMonth: 20, // food eaten a month at full staff (in proportion below)
});

/**
 * How a camp works without food or water (sim/monuments.js supplyFactor).
 * 'halfPace' (every monument now): half pace lacking either, stopped lacking
 * both. 'stopAfterMonth' (for Nova Roma's palace, harsher): half pace for
 * the first month without either, then stopped until both are back.
 */
export const CAMP_RULES = Object.freeze({ halfPace: 'halfPace', stopAfterMonth: 'stopAfterMonth' });

/** Days a camp short of food or water keeps going at half pace under 'stopAfterMonth'. */
export const CAMP_GRACE_DAYS = 16;

/**
 * A raid on a site (sim/monuments.js siteStruck): the stage under way loses
 * this share of its work done and of each good delivered to it; a finished
 * stage is never lost. Insane may raze it instead (data/difficulty.js
 * monumentRaze).
 */
export const RAID_WORK_LOSS = 0.5;
export const RAID_GOODS_LOSS = 0.25;

/** The Thermae's reach: every home within this many tiles (as the crow flies) has baths. */
export const THERMAE_REACH = 24;

/** The Pharus's and the Mansio Magna's trade: partners of their kind buy and sell this much more a year. */
export const TRADE_BOOST = 1.25;
/** A caravan's load each way with the Mansio Magna (CONFIG.CARAVAN_MAX_TRADE without it). */
export const MANSIO_CARAVAN = 1200;
/** Trade disruptions of the monument's kind last this share as long (storms with the Pharus, landslides with the Mansio Magna). */
export const HALT_SHARE = 0.5;
/** Days Neptune's wrath keeps ships away with the Pharus lit (two months, not five). */
export const PHARUS_NEPTUNE_DAYS = 32;

/** What the gods get from a Fanum (to its god) and the Pantheum (to all). */
export const FANUM_TEMPLES = 6; // counts as six temples of its god
export const FANUM_MOOD_FLOOR = 70; // its god's mood target never falls below this: it can no longer strike
export const FANUM_BLESS_WAIT = 8; // months its god waits after a blessing (14 without)
export const PANTHEUM_TEMPLES = 2; // counts as two temples of every god
export const PANTHEUM_MOOD = 10; // every god's mood target, plus this

/** Each god's gift from a finished, working Fanum, in numbers (sim/monumentEffects.js reads them). */
export const GIFTS = Object.freeze({
  ceres: Object.freeze({ farmSpeed: 1.2 }), // wheat, vegetables, fruit and pigs grow a fifth faster
  neptune: Object.freeze({ catch: 150, waterReach: 1, health: 10 }),
  mercury: Object.freeze({ goodsUse: 0.8 }), // homes use a fifth less pottery, furniture, oil, wine and clothing
  mars: Object.freeze({ raidSize: 0.8, attack: 1.2, peace: 1, legionSize: 0.8 }),
  venus: Object.freeze({ homeMood: 10, decor: 1.5, devolveDays: 2 }),
});

/** The Thermae's and the Basilica's numbers. */
export const THERMAE = Object.freeze({ health: 10, disease: 0.7, mood: 3 });
export const BASILICA = Object.freeze({ taxes: 1.2, taxDays: 96, crime: 0.7, prosperity: 8 });
/** The Pharus's fishing boats: this much faster. */
export const PHARUS_BOATS = 1.25;

/** The five gods a Fanum may honor, with its Latin name and its gift in a line. */
export const FANUM_GODS = Object.freeze([
  Object.freeze({ god: 'ceres', name: 'Ceres', of: 'Cereris', gift: 'Every wheat, vegetable, fruit and pig farm grows a fifth faster.' }),
  Object.freeze({ god: 'neptune', name: 'Neptune', of: 'Neptuni', gift: 'Fishing boats land 150 fish a trip, wells and fountains reach a tile further, and city health rises by 10.' }),
  Object.freeze({ god: 'mercury', name: 'Mercury', of: 'Mercurii', gift: 'Homes use a fifth less pottery, furniture, oil, wine and clothing.' }),
  Object.freeze({ god: 'mars', name: 'Mars', of: 'Martis', gift: 'Warbands come a fifth smaller, soldiers and liburnians strike a fifth harder, and peace rises 1 a month. Where there is no army, Caesar\'s legions come a fifth smaller.' }),
  Object.freeze({ god: 'venus', name: 'Venus', of: 'Veneris', gift: 'Every home\'s mood rises by 10, gardens and statues give half again their desirability, and homes take 2 more bad days to fall back a level.' }),
]);

/** A stage row. */
function S(name, en, goods, work, money) {
  return Object.freeze({ name, en, goods: Object.freeze(goods), work, money });
}

export const MONUMENT_TYPES = Object.freeze({
  // The terraced sanctuaries of the late Republic (Praeneste, Tibur).
  fanum: Object.freeze({
    place: 1000,
    stages: Object.freeze([
      S('Fundamenta', 'Foundations', { clay: 1000, timber: 400 }, 60, 500),
      S('Podium et cella', 'Podium and sanctuary walls', { clay: 800, marble: 800, iron: 200 }, 90, 500),
      S('Porticus et tectum', 'Colonnade and roof', { marble: 1600, timber: 800, iron: 200 }, 100, 500),
      S('Dedicatio', 'Dedication', { wine: 400, oil: 400 }, 40, 1000),
    ]),
    workers: 30, labor: 'govReligion', upkeep: 60, store: null,
    hp: Object.freeze([2400, 4000]), needs: null, fromStep: 6,
  }),
  // Agrippa's Pantheon, Hadrian's rotunda.
  pantheum: Object.freeze({
    place: 1500,
    stages: Object.freeze([
      S('Fundamenta', 'Foundations', { clay: 1200, timber: 600 }, 60, 750),
      S('Rotunda', 'The drum walls', { clay: 1600, iron: 200 }, 100, 750),
      S('Porticus', 'The portico\'s columns', { marble: 1600, timber: 600 }, 90, 750),
      S('Tholus', 'The dome', { clay: 1200, timber: 1000, iron: 200 }, 120, 750),
      S('Dedicatio', 'Dedication', { marble: 600, wine: 500, oil: 500 }, 40, 750),
    ]),
    workers: 40, labor: 'govReligion', upkeep: 100, store: null,
    hp: Object.freeze([2400, 4000]), needs: null, fromStep: 8,
  }),
  // The Pharos of Alexandria; Claudius's lighthouse at Ostia.
  pharus: Object.freeze({
    place: 1000,
    stages: Object.freeze([
      S('Fundamenta', 'Piers', { clay: 800, timber: 600, iron: 200 }, 60, 400),
      S('Turris prima', 'The square storey', { clay: 1000, marble: 400 }, 70, 400),
      S('Turris secunda', 'The eight-sided storey', { clay: 800, marble: 600, iron: 200 }, 70, 400),
      S('Ignis', 'The lantern and the first fire', { timber: 400, marble: 200, iron: 200 }, 30, 400),
    ]),
    workers: 12, labor: 'industry', upkeep: 40, store: Object.freeze({ good: 'timber', cap: 400, perYear: 400 }),
    hp: Object.freeze([1600, 2400]), needs: 'sea', fromStep: 6,
  }),
  // The road stations (mansiones) of the Roman highways.
  mansio_magna: Object.freeze({
    place: 1000,
    stages: Object.freeze([
      S('Area', 'The courtyard', { clay: 1000, timber: 400 }, 50, 400),
      S('Porticus et stabula', 'Colonnade and stables', { timber: 1000, clay: 800, iron: 200 }, 70, 400),
      S('Hospitium', 'The inn', { furniture: 400, pottery: 400, timber: 200 }, 40, 400),
    ]),
    workers: 20, labor: 'industry', upkeep: 40, store: Object.freeze({ good: 'food', cap: 200, perYear: 1200 }),
    hp: Object.freeze([2400, 4000]), needs: 'land2', fromStep: 6,
  }),
  // The Baths of Agrippa, later Caracalla's and Diocletian's.
  thermae: Object.freeze({
    place: 1200,
    stages: Object.freeze([
      S('Fundamenta et hypocausta', 'Foundations and underfloor heating', { clay: 1400, timber: 400 }, 70, 600),
      S('Caldarium et tepidarium', 'The hot and warm halls', { clay: 1200, iron: 400, timber: 400 }, 90, 600),
      S('Frigidarium et natatio', 'The cold hall and the pool', { marble: 1600, clay: 400 }, 90, 600),
      S('Palaestra', 'The exercise court and its fittings', { marble: 600, oil: 400, linen: 400 }, 40, 600),
    ]),
    workers: 40, labor: 'healthEdu', upkeep: 80, store: Object.freeze({ good: 'timber', cap: 300, perYear: 300 }),
    hp: Object.freeze([2400, 4000]), needs: 'piped', fromStep: 6,
  }),
  // The Basilica Porcia and Aemilia on the Forum: courts and a hall for business.
  basilica: Object.freeze({
    place: 1000,
    stages: Object.freeze([
      S('Fundamenta', 'Foundations', { clay: 1000, timber: 400 }, 60, 500),
      S('Muri', 'Walls and piers', { clay: 1200, marble: 400 }, 80, 500),
      S('Tectum', 'The great timber roof over the nave', { timber: 1400, iron: 300 }, 90, 500),
      S('Tribunal', 'The magistrates\' apse and its fittings', { marble: 800, furniture: 400 }, 40, 500),
    ]),
    workers: 30, labor: 'govReligion', upkeep: 50, store: null,
    hp: Object.freeze([2400, 4000]), needs: null, fromStep: 6,
  }),
});

/** Every good some monument's stages need, in the order the goods' table lists them. */
export function stageGoods(type) {
  const out = [];
  for (const st of MONUMENT_TYPES[type].stages) for (const g of Object.keys(st.goods)) if (!out.includes(g)) out.push(g);
  return out;
}

/** The whole of a monument's goods (units per good, every stage) and its money (placing and every stage). */
export function monumentTotals(type) {
  const t = MONUMENT_TYPES[type];
  const goods = {};
  let work = 0;
  let money = t.place;
  for (const st of t.stages) {
    for (const [g, n] of Object.entries(st.goods)) goods[g] = (goods[g] || 0) + n;
    work += st.work;
    money += st.money;
  }
  return { goods, units: Object.values(goods).reduce((a, b) => a + b, 0), work, money };
}
