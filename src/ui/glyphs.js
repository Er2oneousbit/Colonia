/**
 * glyphs.js
 * ----------------------------------------------------------------------------
 * The interface's small drawn icons (top bar, build categories, quick
 * actions) as inline SVG, one style throughout: a 24 x 24 grid, a rounded
 * line in the current text colour (so they follow the light and dark themes
 * and the hover and active states of the button that holds them), solid only
 * for the speed arrows.
 *
 * Why not emoji: the operating system draws those, so the same button looks
 * different on Windows, Mac, Linux and Android, in full colour against the
 * game's own Roman art. (The goods chips in the trade cards and the messages
 * still use emoji; a second set of drawn goods would be a project of its own.)
 * Not to be confused with icons.js, which draws the building previews.
 * ----------------------------------------------------------------------------
 */

const NS = 'http://www.w3.org/2000/svg';

// Each entry is the inner SVG markup; class "s" marks a solid shape.
const G = {
  // top bar
  coin: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8h2a4 4 0 0 1 0 8h-2z"/>',
  crowd: '<circle cx="12" cy="7.5" r="2.8"/><path d="M7 20v-3.5a5 5 0 0 1 10 0V20z"/><circle cx="4.8" cy="10" r="2"/><path d="M1.5 18v-2.5a3.3 3.3 0 0 1 3.3-3.3"/><circle cx="19.2" cy="10" r="2"/><path d="M22.5 18v-2.5a3.3 3.3 0 0 0-3.3-3.3"/>',
  pick: '<path d="M5 20 14 11"/><path d="M6.5 8c3.5-4 9.5-4.5 14 0-4-1.5-7-.5-9 1.5"/>',
  // the season: snowflake, laurel sprig, sun, sheaf
  winter: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.7 4.8 12 7l2.3-2.2M9.7 19.2 12 17l2.3 2.2"/>',
  spring: '<path d="M5 20c3-5 7-9 14-14"/><path d="M8.5 15.5c-3 0-4.5-2-4.5-4 3 0 4.5 1.5 4.5 4zM12 11.5c-2.5-1.5-3-4-2.5-6 2.5 1 3.5 3 2.5 6zM15.5 8.5c.5-2.5 2.5-4 5-4-.5 2.5-2 4-5 4zM13 14.5c2.5-.5 4.5.5 5.5 2.5-2.5 1-5 0-5.5-2.5z"/>',
  summer: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  autumn: '<path d="M12 21V9M12 9c-3-.5-4-3-3.5-5 2.5.5 3.5 2.5 3.5 5zM12 9c3-.5 4-3 3.5-5-2.5.5-3.5 2.5-3.5 5zM12 14c-3-.5-4.5-2.5-4-4.5 2.5.5 4 2 4 4.5zM12 14c3-.5 4.5-2.5 4-4.5-2.5.5-4 2-4 4.5z"/><path d="M8.5 21h7"/>',
  // mood: a face, by how content the city is
  'face-4': '<circle cx="12" cy="12" r="9"/><path d="M8.5 14c1 2.2 5.5 2.2 7 0"/><path d="M9 9.5v.5M15 9.5v.5"/>',
  'face-3': '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1.5 1.2 5.5 1.2 7 0"/><path d="M9 9.5v.5M15 9.5v.5"/>',
  'face-2': '<circle cx="12" cy="12" r="9"/><path d="M8.5 15h7"/><path d="M9 9.5v.5M15 9.5v.5"/>',
  'face-1': '<circle cx="12" cy="12" r="9"/><path d="M8.5 16.5c1.5-1.5 5.5-1.5 7 0"/><path d="M8 9l2 1M16 9l-2 1"/>',
  // buttons
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play1: '<path class="s" d="M8 5.5v13l10-6.5z"/>',
  play2: '<path class="s" d="M3 6v12l8-6zM12 6v12l8-6z"/>',
  play3: '<path class="s" d="M1.5 7v10L8 12zM8.5 7v10L15 12zM15.5 7v10L22 12z"/>',
  play4: '<path class="s" d="M4 6v12l9-6z"/><path d="M17 5.5v13"/>',
  'turn-left': '<path d="M5 9a8 8 0 1 1-1 5"/><path d="M5 4v5h5"/>',
  'turn-right': '<path d="M19 9a8 8 0 1 0 1 5"/><path d="M19 4v5h-5"/>',
  fullscreen: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  scroll: '<path d="M7 4h11v13a3 3 0 0 1-3 3H6"/><path d="M7 4a3 3 0 0 0-3 3v1h3M6 20a3 3 0 0 1-2-3v-1h3"/><path d="M10.5 9H15M10.5 13H15"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  hand: '<path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11M11 10V5a1.5 1.5 0 0 1 3 0v5.5M14 10.5v-4a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7-2.5 0-4-1.5-5-3.5L4 13.5c-.5-1.3 1-2 2-1z"/>',
  // build categories
  house: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/>',
  road: '<path d="M9 3 4 21M15 3l5 18"/><path d="M12 5v3M12 11v3M12 17v3"/>',
  drop: '<path d="M12 3C8 8.5 5.5 11.5 5.5 15a6.5 6.5 0 0 0 13 0C18.5 11.5 16 8.5 12 3z"/><path d="M9 16a3 3 0 0 0 2.5 2.5"/>',
  health: '<path d="M12 3v18"/><path d="M12 6c4 1 4 4 0 5s-4 4 0 5"/><path d="M8.5 5.5 12 3l3.5 2.5"/>',
  temple: '<path d="M3 9.5 12 4l9 5.5zM5 9.5V11M19 9.5V11"/><path d="M6.5 11v7M10 11v7M14 11v7M17.5 11v7"/><path d="M3.5 18h17M2.5 21h19"/>',
  mask: '<path d="M4 5h16v7a8 8 0 0 1-16 0z"/><path d="M7.5 9.5c1-1 2.5-1 3.5 0M13 9.5c1-1 2.5-1 3.5 0"/><path d="M8.5 14.5c1.5 2.5 5.5 2.5 7 0"/>',
  scales: '<path d="M12 4v16M7 20h10M4 7h16"/><path d="M4 7 1.5 13a3 3 0 0 0 5 0zM20 7l-2.5 6a3 3 0 0 0 5 0z"/>',
  hammer: '<path d="M10 11 4.5 19.5a1.6 1.6 0 0 0 2.8 1.5L13 13"/><path d="M8.5 7 13 3l7 6-3 3.5-3.5-2.5z"/>',
  flame: '<path d="M12 21c-4 0-6.5-2.5-6.5-6 0-3 2-5 3.5-7 .5 1.5 1.5 2.5 2.5 3 0-3 1-5.5 3-7.5.5 3.5 5 5.5 5 11.5 0 3.5-3.5 6-7.5 6z"/><path d="M12 21c-1.8 0-3-1.2-3-3 0-1.5 1.2-2.5 3-4.5 1.8 2 3 3 3 4.5 0 1.8-1.2 3-3 3z"/>',
  wheat: '<path d="M12 21V8"/><path d="M12 8c-2.5-.5-3.5-2.5-3.5-4.5 2.5.5 3.5 2.5 3.5 4.5zM12 8c2.5-.5 3.5-2.5 3.5-4.5-2.5.5-3.5 2.5-3.5 4.5zM12 14c-3-.5-4.5-2.5-4.5-5 3 .5 4.5 2.5 4.5 5zM12 14c3-.5 4.5-2.5 4.5-5-3 .5-4.5 2.5-4.5 5z"/><path d="M12 19c-2-.3-3.5-1.5-4-3.5 2 .3 3.5 1.5 4 3.5zM12 19c2-.3 3.5-1.5 4-3.5-2 .3-3.5 1.5-4 3.5z"/>',
  crate: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  swords: '<path d="M4 4l11 11M20 4 9 15"/><path d="M13.5 16.5l3-3M10.5 16.5l-3-3M5 19l2.5-2.5M19 19l-2.5-2.5"/><path d="M4 4v3.5M4 4h3.5M20 4v3.5M20 4h-3.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5"/>',
  tower: '<path d="M6 21V9h12v12zM5 9V4h3v2h2V4h4v2h2V4h3v5z"/><path d="M10.5 21v-5a1.5 1.5 0 0 1 3 0v5"/>',
};

/**
 * An icon as an SVG element, `size` px square (16 to 22 reads well).
 * An unknown name draws a plain box, so a typo shows.
 */
export function icon(name, size = 18) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', 'glyph');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = G[name] || '<rect x="4" y="4" width="16" height="16"/>';
  return svg;
}

/** Whether a glyph of this name exists (for the category table check). */
export const hasGlyph = (name) => name in G;

/** Swap the icon inside `host` for another, only when it is a different one (no DOM write per refresh). */
export function setGlyph(host, name, size = 18) {
  if (host.dataset.glyph === name) return;
  host.dataset.glyph = name;
  host.replaceChildren(icon(name, size));
}
