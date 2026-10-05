/**
 * games.js
 * ----------------------------------------------------------------------------
 * Great games the governor can pay for (sim/games.js), each at its own kind
 * of venue, held from the venue's panel or the Entertainment advisor:
 *
 *   ludi       Ludi (Games): gladiators and beasts at a Great Arena
 *   circenses  Circenses (Chariot races): a day of races at the hippodrome
 *
 * Fields:
 *   venue     the venue kind that holds them (data/buildings.js `venue`)
 *   name, en  the Latin name and the English one
 *   factor    the key of their lift among the city mood's factors
 *             (city.sentimentFactors), and so its row in the breakdown
 *   mood      the lift to the city mood when held; it fades by GAMES_FADE a
 *             month, as a festival's does
 *   base, perHead  the cost: base Dn plus perHead a citizen
 *   cooldown  months before the same kind can be held again (each kind
 *             counts its own; one city-wide count per kind, however many
 *             venues the city has)
 *
 * The numbers, against festivals (sim/religion.js): a large festival costs
 * 150 Dn + 0.4 a citizen with food and wine (about 1,000 Dn's worth at 1,000
 * people, the wine bought in), lifts the city mood +8 (less if held within 3
 * months of another) and pleases a god, every 4 months at most. Games cost
 * money only (Ludi 200 + 0.6 a citizen, Circenses 150 + 0.5: 800 and 650 Dn
 * at 1,000 people), lift as much or a little more (+10, +8), please no god,
 * and come only every 6 months, by when the lift has faded to a quarter: a
 * treat to pay for again and again, not a lasting bonus. Holding one sets
 * the lift to its full value (what is left of the last is not added to).
 * Measured in the balance sim (level 3 uptown city of about 1,000 people,
 * six seeds, 4 years, simulate.mjs --games): Ludi whenever they could be
 * held kept the city mood about 5 higher for some 1,300 Dn a year, as the
 * demo city's small festivals do for about as much; Ludi and Circenses
 * together about 8 higher for 1,900 Dn a year. See docs/GAMEPLAY.md.
 * ----------------------------------------------------------------------------
 */

export const GAMES = Object.freeze({
  ludi: Object.freeze({ venue: 'colosseum', name: 'Ludi', en: 'Games', factor: 'games', mood: 10, base: 200, perHead: 0.6, cooldown: 6 }),
  circenses: Object.freeze({ venue: 'hippodrome', name: 'Circenses', en: 'Chariot races', factor: 'races', mood: 8, base: 150, perHead: 0.5, cooldown: 6 }),
});

/** The kinds of games, in the order the advisor lists them. */
export const GAME_KINDS = Object.freeze(Object.keys(GAMES));

/** A month's fade of a games' lift: it keeps this share (a fifth goes, as a festival's). */
export const GAMES_FADE = 0.8;
