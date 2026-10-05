/**
 * gamesInfo.js
 * ----------------------------------------------------------------------------
 * Ludi and Circenses (sim/games.js) in the interface: the venue panel's
 * section with its Hold button (ui/infoPanel.js), and the Entertainment
 * advisor's card that lists both kinds (ui/advisors.js). Both read the same
 * answers from the sim (cost, what stops them, the cooldown, the lift still
 * felt), so the panel and the advisor never disagree.
 * ----------------------------------------------------------------------------
 */

import { h, fmt, kv } from './dom.js';
import { BUILDINGS } from '../data/buildings.js';
import { GAMES, GAME_KINDS } from '../data/games.js';
import { withArticle } from '../sim/risk.js';
import { gamesCost, gamesBlocked, gamesStateOf, gamesVenue, holdGames } from '../sim/games.js';

/** "Ludi (Games)". */
export const gamesTitle = (kind) => `${GAMES[kind].name} (${GAMES[kind].en})`;

/** The button's words: "Hold games" or "Hold races". */
const holdWords = (kind) => (kind === 'circenses' ? 'Hold races' : 'Hold games');

/** "in 3 months" / "in 1 month". */
const months = (n) => `${n} month${n === 1 ? '' : 's'}`;

/**
 * The rows every view shows for a kind: its cost, what it does, the lift
 * still felt and when the next can be held.
 */
function gamesRows(g, kind) {
  const d = GAMES[kind];
  const s = gamesStateOf(g.city)[kind];
  return [
    kv('Cost', `${fmt(gamesCost(g, kind))} Dn`),
    kv('City mood', `+${d.mood}, fading a fifth a month`),
    s.boost > 0 ? kv('Still felt', `+${Math.round(s.boost)}`, 'ok') : null,
    kv('Next', s.cooldown > 0 ? `in ${months(s.cooldown)}` : `${months(d.cooldown)} after the last`),
  ];
}

/**
 * The Hold button for a kind at venue `b` (the advisor passes the best venue
 * for it, sim/games.js gamesVenue), greyed out with the reason as its title,
 * and the reason again in words below it (a phone has no hover).
 */
function holdControls(g, kind, b, onChange, toastError) {
  const why = gamesBlocked(g, kind, b);
  return [
    h('div', { class: 'row', style: { marginTop: '6px' } },
      h('button', {
        class: 'btn small primary',
        disabled: !!why,
        title: why || `${fmt(gamesCost(g, kind))} Dn: the city mood +${GAMES[kind].mood}`,
        dataset: { games: kind },
        onclick: () => {
          const res = holdGames(g, kind, b ? b.id : null);
          if (!res.ok) toastError(res.reason);
          onChange();
        },
      }, `${holdWords(kind)} (${fmt(gamesCost(g, kind))} Dn)`)),
    why ? h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '2px' }, dataset: { gamesWhy: kind } }, why) : null,
  ];
}

/** The venue panel's section for the games it holds (`sec` is the panel's section builder). */
export function gamesSection(g, b, kind, sec, onChange, toastError) {
  return sec(gamesTitle(kind),
    gamesRows(g, kind),
    holdControls(g, kind, b, onChange, toastError),
    h('div', { class: 'muted' }, kind === 'circenses'
      ? 'A great day of races for the whole city, paid from the treasury. The hippodrome must be staffed with races booked.'
      : 'Great games for the whole city, paid from the treasury. The Arena must be staffed with gladiators or beasts booked.'));
}

/** The Entertainment advisor's card: both kinds, each with its button at the best venue for it. */
export function gamesCard(g, onChange, toastError) {
  return h('div', { class: 'card games', style: { marginTop: '8px' } },
    h('h4', {}, 'Games and races'),
    GAME_KINDS.map((kind) => {
      const unlocked = g.isUnlocked(GAMES[kind].venue);
      const b = gamesVenue(g, kind);
      const venue = BUILDINGS[GAMES[kind].venue];
      return h('div', { style: { marginTop: '6px' }, dataset: { gamesKind: kind } },
        h('b', {}, gamesTitle(kind)), h('span', { class: 'muted' }, ` at ${withArticle(`${venue.name} (${venue.en})`)}`),
        unlocked ? [gamesRows(g, kind), holdControls(g, kind, b, onChange, toastError)]
          : h('div', { class: 'muted', style: { fontSize: '12px' } }, `This province has no ${venue.name}.`));
    }),
    h('div', { class: 'muted sub', style: { marginTop: '4px' } }, 'Paid in money only, all at once. They lift every home\'s mood through the city\'s, apart from festivals and on top of them, and each kind waits its own months before the next.'));
}
