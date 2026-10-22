/**
 * waterArt.js
 * ----------------------------------------------------------------------------
 * Procedural art for the fishing industry (all original): the shipyard with
 * the fishing boat on its slip while one is being built, the fishing wharf
 * with its catch, nets and smoke house, and the gulls that circle over the
 * fishing grounds (drawn live by the renderer). The drawings out over the
 * water follow the 3D models' designs (render3d/models/fishYard.js,
 * fishWharf.js, watersideKit.js), flattened to what a 64 px tile can carry;
 * the helpers they share with the Emporium (loads, lantern, line) are here.
 *
 * Both buildings stand on the bank with one edge facing the water, like the
 * dock: each is designed with the water on its +u edge and turned into place
 * by `side` (0 = -v, 1 = +u, 2 = +v, 3 = -u; sim/fishing.js waterBeside).
 * One out over the water (art state + OVER_WATER_ART, as every building
 * placed since that rule) has its own drawing, its row on the water raised
 * on piles (pierDeck, shared with the dock and the fleet's buildings); one
 * wholly on land, from an older save, keeps the first drawing.
 * Painter's order: back (small u+v after turning) first, front last.
 * ----------------------------------------------------------------------------
 */

import { P, poly, quad, box, gableRoof, shade } from './draw.js';
import { OVER_WATER_ART as OVER_WATER } from '../sim/entities.js';
import { mappedRect as turnedRect } from './turn.js';

const WOOD = '#8a5a33';
const WOOD_DARK = '#5e3b20';
const WOOD_PALE = '#b88a58';
const THATCH = '#c9a75b';
const NET = 'rgba(70,60,45,0.75)';
const FISH = '#a9bec7';

/** (u, v) as designed (water on +u) to (u, v) on the footprint, for the edge facing the water. */
export function turner(S, side) {
  return (u, v) => (side === 1 ? [u, v] : side === 3 ? [S - u, v] : side === 2 ? [v, u] : [v, S - u]);
}

/** A box given in designed coordinates, turned into place (its corners re-sorted): turn.js mappedRect under the shore's name. */
export { turnedRect };

/** Draw the queued pieces back to front by where they stand on screen. */
export function paint(items) {
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
}

/** A short wooden post standing at (x, y), `h` px tall. */
export function post(ctx, x, y, h, w = 1.4, color = WOOD_DARK) {
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y - h, w, h);
}

// ---------------------------------------------------------------------------
// Out over the water (OVER_WATER_ART, sim/entities.js waterRowsFor)
// ---------------------------------------------------------------------------

/**
 * A waterside building out over the water: its rows on the water are the
 * designed +u edge, u from S - rows to S; the rest is the shore. The water
 * tiles under it are drawn by the renderer as water, so what stands on them
 * is drawn raised on piles or stone piers, the water showing between them.
 */
export function overWater(S) {
  const rows = S <= 2 ? 1 : 2;
  return { rows, shore: S - rows };
}

/** The shore part of the footprint (designed u 0 to `shore`) as ground of `color`, turned into place. */
export function shoreGround(ctx, T, S, shore, color) {
  const r = turnedRect(T, 0.03, 0.03, shore - 0.03, S - 0.06);
  quad(ctx, r[0], r[1], r[0] + r[2], r[1] + r[3], 0, color);
}

/**
 * A deck out over the water on piles: designed u0..u1 by v0..v1, its top at
 * `z` px over the water, `thick` px deep, on square piles (`pile` tiles
 * across) every `step` tiles each way, standing in the water. Timber by
 * default; stone piers for a quay. Drawn as boxes, so every view turn shows
 * the faces it should (render/turn.js), and the piles stand under the deck.
 */
export function pierDeck(ctx, T, u0, u1, v0, v1, { z = 4, thick = 1.5, step = 0.45, pile = 0.08, pileColor = WOOD_DARK, deck = '#a07e55', seams = 'rgba(70,45,25,0.45)', seamStep = 0.17 } = {}) {
  const nu = Math.max(1, Math.round((u1 - u0) / step));
  const nv = Math.max(1, Math.round((v1 - v0) / step));
  for (let a = 0; a <= nu; a++) {
    for (let b = 0; b <= nv; b++) {
      const u = Math.min(u1 - pile, Math.max(u0, u0 + ((u1 - u0) * a) / nu - pile / 2));
      const v = Math.min(v1 - pile, Math.max(v0, v0 + ((v1 - v0) * b) / nv - pile / 2));
      const p = turnedRect(T, u, v, pile, pile);
      box(ctx, p[0], p[1], p[2], p[3], 0, z - thick, pileColor, { plain: true });
    }
  }
  const d = turnedRect(T, u0, v0, u1 - u0, v1 - v0);
  box(ctx, d[0], d[1], d[2], d[3], z - thick, thick, deck, { plain: true });
  if (!seams) return;
  // planks (or paving joints) across the deck, parallel to the water's edge
  ctx.strokeStyle = seams;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let u = u0 + seamStep; u < u1 - 0.02; u += seamStep) {
    const p = P(...T(u, v0 + 0.03), z);
    const q = P(...T(u, v1 - 0.03), z);
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// What the waterside works share (the 3D models' watersideKit.js, drawn flat)
// ---------------------------------------------------------------------------

// The Republic's stone and finish: the values of buildingArt's COL.tufa, plaster and dado
// (this file cannot import them without a cycle).
const TUFA = '#bdae88';
const PLASTER = '#ebe0c6';
const DADO = '#a4472f';

/** A straight stroke between two screen points. */
export function waterLine(ctx, a, b, color, w = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

/** A lantern on a post standing at (x, y): the lit pane in a dark frame (the night glow itself is lighting.js's). */
export function waterLantern(ctx, x, y, h = 10) {
  post(ctx, x, y, h, 1.6, '#4a3a2a');
  ctx.fillStyle = '#3a2c20';
  ctx.fillRect(x - 2.2, y - h - 4.2, 4.4, 4.6);
  ctx.fillStyle = '#f0c25c';
  ctx.fillRect(x - 1.4, y - h - 3.4, 2.8, 3);
}

/**
 * One load of goods standing at designed (u, v), its foot `z` px up, in the
 * warehouse's vocabulary: a crate, a sack, an amphora, a bale of cloth.
 * T turns the designed point into place, Q is its screen point.
 */
export function waterLoad(ctx, T, Q, u, v, z, kind) {
  if (kind === 'crate' || kind === 'bale') {
    const r = turnedRect(T, u, v, kind === 'bale' ? 0.28 : 0.2, 0.2);
    box(ctx, r[0], r[1], r[2], r[3], z, 5, kind === 'bale' ? '#e8dcc4' : '#a57a4a', { plain: true });
    return;
  }
  const [x, y] = Q(u, v, z);
  if (kind === 'sack') {
    ctx.fillStyle = '#d9c9a0';
    ctx.beginPath(); ctx.ellipse(x, y - 3, 3.3, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bfae82';
    ctx.fillRect(x - 1, y - 7, 2, 1.6); // the tied neck
    return;
  }
  // amphora: a round belly, a neck, two handles
  ctx.fillStyle = '#c07a4a';
  ctx.beginPath(); ctx.ellipse(x, y - 4.2, 2.3, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(x - 0.9, y - 9.4, 1.8, 3);
  ctx.fillStyle = '#8f5530';
  ctx.fillRect(x - 1.5, y - 9.8, 3, 1);
  waterLine(ctx, [x - 1, y - 8.6], [x - 2.8, y - 6.8], '#8f5530', 0.8);
  waterLine(ctx, [x + 1, y - 8.6], [x + 2.8, y - 6.8], '#8f5530', 0.8);
}

/** A net hung on a frame between two screen foot points, `h` px up: twine, a head rope with its floats. */
function waterNet(ctx, a, b, h) {
  post(ctx, a[0], a[1], h + 1, 1.2);
  post(ctx, b[0], b[1], h + 1, 1.2);
  ctx.strokeStyle = NET;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let k = 0; k <= 7; k++) {
    const x = a[0] + (b[0] - a[0]) * (k / 7);
    const y = a[1] + (b[1] - a[1]) * (k / 7) - h;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (k % 2 ? 0.8 : -0.8), y + h * 0.62 + Math.sin(k * 1.7) * 1.4);
  }
  for (let r = 0; r < 4; r++) {
    ctx.moveTo(a[0], a[1] - h + r * 2.2);
    ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - h + r * 2.2 + 2, b[0], b[1] - h + r * 2.2);
  }
  ctx.stroke();
  ctx.fillStyle = '#e0c060'; // cork floats along the head rope
  for (let k = 1; k < 5; k++) ctx.fillRect(a[0] + (b[0] - a[0]) * (k / 5) - 0.8, a[1] + (b[1] - a[1]) * (k / 5) - h - 0.8, 1.6, 1.5);
}

/** A man at (x, y), his feet there: a tunic, a head, standing or seated (a net mender on a cask), an arm out to `reach`. */
function waterMan(ctx, x, y, { seated = false, tunic = '#b8683c', reach = null } = {}) {
  const hgt = seated ? 5 : 8;
  ctx.fillStyle = '#6b4a2a'; // legs
  if (seated) ctx.fillRect(x - 2.4, y - 2, 4.8, 2); else ctx.fillRect(x - 1.5, y - 3, 3, 3);
  ctx.fillStyle = tunic;
  ctx.beginPath();
  ctx.moveTo(x - 2.2, y - hgt + 1);
  ctx.lineTo(x + 2.2, y - hgt + 1);
  ctx.lineTo(x + 2.8, y - 2);
  ctx.lineTo(x - 2.8, y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d9a982';
  ctx.beginPath(); ctx.arc(x, y - hgt - 0.6, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a3322';
  ctx.beginPath(); ctx.arc(x, y - hgt - 1.2, 1.8, Math.PI, Math.PI * 2); ctx.fill();
  if (reach) waterLine(ctx, [x, y - hgt + 2], reach, '#d9a982', 1);
}

/** A few pale puffs of smoke rising from (x, y). */
function waterSmoke(ctx, x, y, n = 4) {
  for (let k = 0; k < n; k++) {
    ctx.fillStyle = `rgba(225,225,225,${0.5 - k * 0.1})`;
    ctx.beginPath(); ctx.arc(x + Math.sin(k * 1.9) * 1.8 + k * 0.6, y - k * 3.6, 1.7 + k * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}

/** A trestle: two crossed legs under a bar, standing at (x, y), `h` px high. */
function waterTrestle(ctx, x, y, h) {
  waterLine(ctx, [x - 2, y], [x + 1.5, y - h], WOOD_DARK, 1);
  waterLine(ctx, [x + 2, y], [x - 1.5, y - h], WOOD_DARK, 1);
}

// ---------------------------------------------------------------------------
// Shipyard
// ---------------------------------------------------------------------------

/**
 * Shipyard: a gravel yard with a timber shed and a stack of planks at the
 * back, a slipway running down into the water, a sheerlegs crane at the
 * water's edge and, while a boat is being built, its hull on the slip:
 * `stage` 1 the keel and bare ribs, 2 planked up to the gunwale.
 * state = side + 4 * stage.
 */
export function shipyardArt(ctx, S, variant, state = 1) {
  if (state >= OVER_WATER) { shipyardPierArt(ctx, S, state - OVER_WATER); return; }
  const side = state % 4;
  const stage = Math.floor(state / 4);
  const T = turner(S, side);
  const Q = (u, v, z = 0) => P(...T(u, v), z);
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#b6a27a');
  // the slipway: two rails on sleepers, running down to the water's edge
  const rail = (v) => { const a = Q(0.45, v, 3); const b = Q(S + 0.05, v, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  ctx.strokeStyle = shade(WOOD, -0.1);
  ctx.lineWidth = 1.2;
  for (let u = 0.55; u < S; u += 0.22) {
    const z = 3 * (1 - (u - 0.45) / (S - 0.4));
    const a = Q(u, 0.62, z);
    const b = Q(u, 1.38, z);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = 1.1;
  rail(0.78);
  rail(1.22);
  const items = [];
  const at = (u, v) => { const [a, b] = T(u, v); return a + b; };
  // the shed and the plank stack at the back of the yard
  const shed = turnedRect(T, 0.06, 0.06, 0.42, 0.58);
  items.push({ d: shed[0] + shed[1], draw: () => {
    box(ctx, shed[0], shed[1], shed[2], shed[3], 0, 12, '#c8b48e');
    gableRoof(ctx, shed[0], shed[1], shed[2], shed[3], 12, 6, '#8a5a3a', shed[2] >= shed[3] ? 'u' : 'v');
  } });
  const stack = turnedRect(T, 0.08, 1.48, 0.62, 0.36);
  items.push({ d: stack[0] + stack[1] + 0.2, draw: () => {
    for (let k = 0; k < 3; k++) box(ctx, stack[0], stack[1], stack[2], stack[3], k * 2, 2, k % 2 ? WOOD_PALE : '#a57a4a', { plain: true });
  } });
  // the sheerlegs crane at the water's edge, with a block and rope
  items.push({ d: at(S - 0.15, 0.3), draw: () => {
    const [x, y] = Q(S - 0.15, 0.3);
    ctx.strokeStyle = WOOD_DARK;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x - 3.5, y); ctx.lineTo(x, y - 24); ctx.lineTo(x + 3.5, y);
    ctx.stroke();
    const tip = Q(S - 0.45, 0.85, 24);
    ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
    ctx.strokeStyle = '#3a3026';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(tip[0], tip[1] + 9); ctx.stroke();
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(tip[0] - 1.5, tip[1] + 9, 3, 2.5);
  } });
  if (stage > 0) items.push({ d: at(1.2, 1.0) + 0.1, draw: () => hull(ctx, Q, at, stage) });
  paint(items);
}

/**
 * The shipyard out over the water, as the 3D model designs it (models/
 * fishYard.js): on the west a small slip, an ashlar bed on the shore with
 * sleepers and two greased ways running on out over piles to the water, a
 * four-post frame over it with a tackle, a windlass at its head, and the
 * fishing boat on it (the hull stage by stage); on the east the timber as
 * two loads, a pitch kettle smoking over its hearth, and a deck on piles
 * over the water with a mast and oars seasoning on trestles and bollards.
 * The finished boat lies afloat in front (the renderer draws it), so the
 * water at the front is left open.
 */
function shipyardPierArt(ctx, S, state) {
  const side = state % 4;
  const stage = Math.floor(state / 4);
  const T = turner(S, side);
  const Q = (u, v, z = 0) => P(...T(u, v), z);
  const at = (u, v) => { const [a, b] = T(u, v); return a + b; };
  const { shore } = overWater(S);
  const BED = 2.2; // the ashlar bed's top; the ways fall from it to the water
  const DECK = 4;
  const slipZ = (u) => (u <= shore ? BED : BED - 1.7 * Math.min(1, (u - shore) / (S - shore)));
  shoreGround(ctx, T, S, shore, '#b6a27a');
  // the piles under the slip's ways, out over the water
  for (const u of [1.15, 1.55, 1.9]) {
    for (const v of [0.12, 0.84]) {
      const p = turnedRect(T, u - 0.04, v, 0.08, 0.08);
      box(ctx, p[0], p[1], p[2], p[3], 0, Math.max(0.5, slipZ(u) - 0.5), WOOD_DARK, { plain: true });
    }
  }
  const items = [];
  const flat = (cells) => Math.min(...cells.map(([u, v]) => at(u, v))) - 1; // a thing lying on the ground sorts before what stands on it
  // the slip: the bed, the sleepers across, the two greased ways
  items.push({ d: flat([[0.05, 0.08], [S, 0.92]]), draw: () => {
    const bed = turnedRect(T, 0.05, 0.08, shore - 0.05, 0.84);
    box(ctx, bed[0], bed[1], bed[2], bed[3], 0, BED, TUFA, { plain: true });
    ctx.strokeStyle = shade(WOOD, -0.1);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let u = 0.2; u < S; u += 0.2) {
      const a = Q(u, 0.1, slipZ(u));
      const b = Q(u, 0.9, slipZ(u));
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    for (const v of [0.34, 0.66]) {
      waterLine(ctx, Q(0.12, v, slipZ(0.12)), Q(0.45, v, slipZ(0.45)), '#4b3a28', 1.2);
      waterLine(ctx, Q(0.45, v, slipZ(0.45)), Q(1, v, slipZ(1)), '#4b3a28', 1.2);
      waterLine(ctx, Q(1, v, slipZ(1)), Q(S - 0.02, v, slipZ(S - 0.02)), '#4b3a28', 1.2);
    }
  } });
  // the deck on piles over the water, east of the slip
  items.push({ d: flat([[shore, 1.05], [S, S - 0.06]]), draw: () => pierDeck(ctx, T, shore, S - 0.04, 1.05, S - 0.06, { z: DECK, step: 0.5 }) });
  // the frame over the slip: four posts, beams along and across, the tackle
  const U = [0.6, 1.1];
  const V = [0.12, 0.88];
  const TOP = 22;
  for (const u of U) for (const v of V) {
    items.push({ d: at(u, v), draw: () => {
      const [x, y] = Q(u, v, slipZ(u));
      post(ctx, x, y, TOP, 2, WOOD);
    } });
  }
  const beam = (u0, v0, u1, v1, w = 1.6) => items.push({ d: Math.max(at(u0, v0), at(u1, v1)) + 0.02, draw: () => {
    waterLine(ctx, Q(u0, v0, slipZ(u0) + TOP), Q(u1, v1, slipZ(u1) + TOP), WOOD_DARK, w);
  } });
  beam(U[0], V[0], U[1], V[0]);
  beam(U[0], V[1], U[1], V[1]);
  beam(U[0], V[0], U[0], V[1]);
  beam(U[1], V[0], U[1], V[1]);
  beam(0.85, V[0], 0.85, V[1], 1.3);
  items.push({ d: at(0.85, 0.5) + 0.03, draw: () => {
    // the tackle: a rope off the middle beam to a block, a plank on its hook while a hull is on the slip
    const [x, y] = Q(0.85, 0.5, slipZ(0.85) + TOP);
    waterLine(ctx, [x, y], [x, y + 11], '#3a3026', 0.6);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(x - 1.5, y + 11, 3, 2.5);
    if (stage > 0) waterLine(ctx, [x - 4, y + 15], [x + 4, y + 17], WOOD_PALE, 1.4);
  } });
  // the boat on the slip
  if (stage > 0) items.push({ d: at(1.0, 0.5) + 0.01, draw: () => waterHull(ctx, Q, at, stage, { vc: 0.5, hw: 0.27, U0: 0.35, U1: 1.75, z: (u) => slipZ(u) + 1.2 }) });
  // the windlass at the slip's head: a drum between two uprights, a crank, a rope to the boat
  items.push({ d: at(0.15, 0.5), draw: () => {
    const w = turnedRect(T, 0.1, 0.36, 0.14, 0.28);
    box(ctx, w[0], w[1], w[2], w[3], BED, 4, WOOD, { plain: true });
    const [x, y] = Q(0.17, 0.66, BED + 2);
    waterLine(ctx, [x, y], [x + 2.5, y - 3.5], WOOD_DARK, 1);
    if (stage > 0) waterLine(ctx, Q(0.24, 0.5, BED + 2.5), Q(0.4, 0.5, slipZ(0.4) + 3), '#3a3026', 0.7);
  } });
  // the timber: two loads of planks, stacked and stickered to dry
  for (const v of [1.12, 1.5]) {
    const r = turnedRect(T, 0.08, v, 0.56, 0.3);
    items.push({ d: r[0] + r[1] + 0.3, draw: () => {
      for (let k = 0; k < 3; k++) box(ctx, r[0], r[1], r[2], r[3], k * 2.2, 2.2, k % 2 ? WOOD_PALE : '#a57a4a', { plain: true });
    } });
  }
  // the pitch kettle on its tripod over a hearth, smoking
  items.push({ d: at(0.82, 1.75), draw: () => {
    const hearth = turnedRect(T, 0.72, 1.65, 0.2, 0.2);
    box(ctx, hearth[0], hearth[1], hearth[2], hearth[3], 0, 1.8, TUFA, { plain: true });
    const [x, y] = Q(0.82, 1.75, 1.8);
    for (const dx of [-3.4, 0, 3.4]) waterLine(ctx, [x + dx, y + (dx ? 0.5 : 1.5)], [x, y - 9], WOOD_DARK, 0.9);
    ctx.fillStyle = '#c4572a'; // the embers under the pot
    ctx.fillRect(x - 1.6, y - 0.8, 3.2, 1.2);
    ctx.fillStyle = '#1c1410';
    ctx.beginPath(); ctx.ellipse(x, y - 8, 3.2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2f26';
    ctx.beginPath(); ctx.ellipse(x, y - 9.4, 3, 1.2, 0, 0, Math.PI * 2); ctx.fill();
    waterSmoke(ctx, x + 1, y - 11, 4);
  } });
  // the mast and the oars seasoning on trestles on the deck
  items.push({ d: at(1.5, 1.45), draw: () => {
    for (const u of [1.2, 1.75]) for (const v of [1.35, 1.7]) {
      const [x, y] = Q(u, v, DECK);
      waterTrestle(ctx, x, y, 4);
    }
    waterLine(ctx, Q(1.05, 1.35, DECK + 4.6), Q(1.92, 1.35, DECK + 4.6), WOOD_PALE, 2.2);
    for (const v of [1.65, 1.75]) {
      const a = Q(1.1, v, DECK + 4.4);
      const b = Q(1.85, v, DECK + 4.4);
      waterLine(ctx, a, b, '#c79a5e', 0.9);
      ctx.fillStyle = '#c79a5e'; // the blade
      ctx.fillRect(b[0] - 1.2, b[1] - 1, 2.8, 2);
    }
  } });
  // bollards for the boat's lines and a lantern on the deck
  for (const v of [1.15, 1.85]) {
    items.push({ d: at(S - 0.1, v), draw: () => {
      const [x, y] = Q(S - 0.1, v, DECK);
      post(ctx, x, y, 5, 2.4, '#4a3a2a');
      ctx.fillStyle = '#6b5640';
      ctx.fillRect(x - 1.7, y - 5.6, 3.4, 1.2);
    } });
  }
  items.push({ d: at(1.05, 1.92), draw: () => waterLantern(ctx, ...Q(1.05, 1.92, DECK), 9) });
  paint(items);
}

/**
 * The boat on the slip, bow toward the water, its three stages: the keel
 * with its stem and sternpost, the frames and the lower strakes (stage 1);
 * planked to the gunwale and the blue band painted (stage 2). The far side
 * is drawn first. o: vc the slip's middle (v), hw the half beam, U0..U1
 * the length (u), z(u) the keel blocks' height along the slip.
 */
function waterHull(ctx, Q, at, stage, { vc, hw, U0, U1, z }) {
  const half = (u) => hw * Math.sin(Math.PI * Math.min(1, (u - U0 + 0.1) / (U1 - U0 + 0.1))); // tapers to the bow
  const GUN = 10; // the gunwale's height over the keel
  const us = [];
  for (let u = U0; u <= U1 + 1e-9; u += (U1 - U0) / 8) us.push(u);
  // keel, stem and sternpost
  const k0 = Q(U0, vc, z(U0));
  const k1 = Q(U1, vc, z(U1));
  const stem = Q(U1 + 0.06, vc, z(U1) + GUN + 2);
  const sternPost = Q(U0 - 0.04, vc, z(U0) + GUN + 1);
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(sternPost[0], sternPost[1]); ctx.lineTo(k0[0], k0[1]); ctx.lineTo(k1[0], k1[1]); ctx.lineTo(stem[0], stem[1]); ctx.stroke();
  // which side is nearer the viewer after turning (drawn last)
  const sides = at(1.0, vc - 0.3) < at(1.0, vc + 0.3) ? [-1, 1] : [1, -1];
  const strake = (s, f, from, to) => us.filter((u) => u >= from && u <= to).map((u) => Q(u, vc + s * half(u) * (0.3 + 0.7 * f), z(u) + 0.8 + (GUN - 0.8) * f));
  if (stage === 1) {
    ctx.strokeStyle = '#c79a5e';
    ctx.lineWidth = 1;
    for (const u of us.slice(1, -1)) {
      const w = half(u);
      const a = Q(u, vc - w, z(u) + GUN);
      const c = Q(u, vc, z(u) - 1);
      const b = Q(u, vc + w, z(u) + GUN);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]); ctx.stroke();
    }
    // the first strakes, edge-joined to the keel
    for (const s of sides) {
      for (const f of [0.18, 0.42]) {
        ctx.strokeStyle = '#a57a4a';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        strake(s, f, U0 + 0.1, U1 - 0.1).forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
        ctx.stroke();
      }
    }
    return;
  }
  for (const s of sides) {
    const top = us.map((u) => Q(u, vc + s * half(u), z(u) + GUN));
    const keel = us.map((u) => Q(u, vc, z(u) + 0.8)).reverse();
    const near = s === sides[1];
    poly(ctx, [...top, ...keel], near ? '#9a6a3c' : '#7d5430', shade(WOOD_DARK, -0.2), 0.6);
    // plank seams
    ctx.strokeStyle = 'rgba(50,30,15,0.45)';
    ctx.lineWidth = 0.5;
    for (const f of [0.3, 0.6]) {
      ctx.beginPath();
      strake(s, f, U0, U1).forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.stroke();
    }
    // the blue band under the gunwale
    const band = us.map((u) => Q(u, vc + s * half(u) * 0.95, z(u) + GUN - 2)).reverse();
    poly(ctx, [...top, ...band], near ? '#3f6f8f' : '#33596f');
  }
  // the gunwale's rim
  ctx.strokeStyle = '#c79a5e';
  ctx.lineWidth = 0.9;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    us.forEach((u, i) => { const p = Q(u, vc + s * half(u), z(u) + GUN); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.stroke();
  }
}

/**
 * A boat on the slip, bow toward the water: the keel and stem, then bare
 * ribs (stage 1) or planked sides (stage 2), the far side drawn first.
 */
function hull(ctx, Q, at, stage) {
  const U0 = 0.55;
  const U1 = 1.9;
  const half = (u) => 0.3 * Math.sin(Math.PI * Math.min(1, (u - U0 + 0.15) / (U1 - U0 + 0.15))); // tapers to the bow
  const z = (u) => 3.6 * (1 - (u - 0.45) / 1.6); // on the sloping slip
  const us = [];
  for (let u = U0; u <= U1 + 1e-9; u += (U1 - U0) / 8) us.push(u);
  // keel and stem
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = 1.6;
  const k0 = Q(U0, 1, z(U0) + 1);
  const k1 = Q(U1, 1, z(U1) + 1);
  const stem = Q(U1 + 0.08, 1, z(U1) + 10);
  ctx.beginPath(); ctx.moveTo(k0[0], k0[1]); ctx.lineTo(k1[0], k1[1]); ctx.lineTo(stem[0], stem[1]); ctx.stroke();
  const sternPost = Q(U0 - 0.05, 1, z(U0) + 9);
  ctx.beginPath(); ctx.moveTo(k0[0], k0[1]); ctx.lineTo(sternPost[0], sternPost[1]); ctx.stroke();
  // which side is nearer the viewer after turning (drawn last)
  const sides = at(1.2, 0.7) < at(1.2, 1.3) ? [-1, 1] : [1, -1];
  if (stage === 1) {
    ctx.strokeStyle = '#c79a5e';
    ctx.lineWidth = 1;
    for (const u of us.slice(1, -1)) {
      const w = half(u);
      const a = Q(u, 1 - w, z(u) + 8);
      const c = Q(u, 1, z(u) - 2);
      const b = Q(u, 1 + w, z(u) + 8);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]); ctx.stroke();
    }
    return;
  }
  for (const s of sides) {
    const top = us.map((u) => Q(u, 1 + s * half(u), z(u) + 8));
    const keel = us.map((u) => Q(u, 1, z(u) + 1)).reverse();
    poly(ctx, [...top, ...keel], s === sides[1] ? '#9a6a3c' : '#7d5430', shade(WOOD_DARK, -0.2), 0.6);
    // plank seams
    ctx.strokeStyle = 'rgba(50,30,15,0.45)';
    ctx.lineWidth = 0.5;
    for (const f of [0.35, 0.68]) {
      ctx.beginPath();
      us.forEach((u, i) => { const p = Q(u, 1 + s * half(u) * (1 - f * 0.4), z(u) + 8 - f * 6); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.stroke();
    }
  }
  // the gunwale's rim
  ctx.strokeStyle = '#c79a5e';
  ctx.lineWidth = 0.9;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    us.forEach((u, i) => { const p = Q(u, 1 + s * half(u), z(u) + 8); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Fishing wharf
// ---------------------------------------------------------------------------

/**
 * Fishing wharf: a plank deck out over the water's edge with mooring posts,
 * a thatched hut, a rack of fish drying in the sun and a net hung out on
 * poles; while the wharf holds fish, baskets of the catch wait on the deck.
 * state = side + 4 * (fish waiting ? 1 : 0).
 */
export function wharfArt(ctx, S, variant, state = 1) {
  if (state >= OVER_WATER) { wharfPierArt(ctx, S, state - OVER_WATER); return; }
  const side = state % 4;
  const catchIn = state >= 4;
  const T = turner(S, side);
  const Q = (u, v, z = 0) => P(...T(u, v), z);
  const at = (u, v) => { const [a, b] = T(u, v); return a + b; };
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#a99a74');
  // the deck: planks across the water edge half
  const deck = turnedRect(T, 0.95, 0.04, S - 0.95 + 0.06, S - 0.08);
  quad(ctx, deck[0], deck[1], deck[0] + deck[2], deck[1] + deck[3], 1, '#a07e55');
  ctx.strokeStyle = 'rgba(70,45,25,0.45)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let u = 1.1; u < S + 0.05; u += 0.17) {
    const p = Q(u, 0.06, 1);
    const q = Q(u, S - 0.06, 1);
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
  const items = [];
  // the hut
  const hut = turnedRect(T, 0.08, 0.08, 0.72, 0.66);
  items.push({ d: hut[0] + hut[1], draw: () => {
    box(ctx, hut[0], hut[1], hut[2], hut[3], 0, 11, '#cdb68c');
    gableRoof(ctx, hut[0], hut[1], hut[2], hut[3], 11, 7, THATCH, hut[2] >= hut[3] ? 'u' : 'v');
  } });
  // the drying rack: two posts, a pole, fish hanging from it
  items.push({ d: at(0.45, 1.45), draw: () => {
    const a = Q(0.2, 1.45);
    const b = Q(0.75, 1.45);
    post(ctx, a[0], a[1], 11);
    post(ctx, b[0], b[1], 11);
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a[0], a[1] - 10.5); ctx.lineTo(b[0], b[1] - 10.5); ctx.stroke();
    for (let k = 1; k < 6; k++) {
      const x = a[0] + (b[0] - a[0]) * (k / 6);
      const y = a[1] + (b[1] - a[1]) * (k / 6) - 10;
      ctx.fillStyle = k % 2 ? FISH : '#c2a77a'; // fresh and dried
      ctx.beginPath(); ctx.ellipse(x, y + 3, 0.9, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    }
  } });
  // the net hung out on two poles on the deck
  items.push({ d: at(1.55, 0.6), draw: () => {
    const a = Q(1.35, 0.25, 1);
    const b = Q(1.75, 0.95, 1);
    post(ctx, a[0], a[1], 13, 1.2);
    post(ctx, b[0], b[1], 13, 1.2);
    ctx.strokeStyle = NET;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) {
      const x = a[0] + (b[0] - a[0]) * (k / 6);
      const y = a[1] + (b[1] - a[1]) * (k / 6) - 12.5;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (k % 2 ? 0.8 : -0.8), y + 8 + Math.sin(k) * 1.5);
    }
    for (let r = 0; r < 4; r++) {
      ctx.moveTo(a[0], a[1] - 12.5 + r * 2.4);
      ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 10 + r * 2.4 + 2, b[0], b[1] - 12.5 + r * 2.4);
    }
    ctx.stroke();
    ctx.fillStyle = '#e0c060'; // cork floats along the head rope
    for (let k = 1; k < 4; k++) ctx.fillRect(a[0] + (b[0] - a[0]) * (k / 4) - 0.8, a[1] + (b[1] - a[1]) * (k / 4) - 13.2, 1.6, 1.4);
  } });
  // mooring posts at the water's edge
  for (const v of [0.25, S - 0.25]) {
    items.push({ d: at(S - 0.1, v), draw: () => {
      const [x, y] = Q(S - 0.1, v, 1);
      post(ctx, x, y + 3, 7, 2.2, '#4a3a2a');
      ctx.fillStyle = '#6b5640';
      ctx.fillRect(x - 1.5, y - 4.5, 3, 1.2);
    } });
  }
  // baskets of the catch, waiting for a cart
  if (catchIn) {
    for (const [u, v] of [[1.3, 1.25], [1.6, 1.5], [1.25, 1.65]]) {
      items.push({ d: at(u, v) + 0.05, draw: () => fishBasket(ctx, ...Q(u, v, 1)) });
    }
  }
  paint(items);
}

/**
 * The fishing wharf out over the water, as the 3D model designs it (models/
 * fishWharf.js): a timber deck on piles over its row on the water with two
 * steps up from the shore and bollards along its edge; on the deck the
 * baskets of the catch (while it holds fish) and a gutting table with its
 * tub and the man at it; on the shore the smoke house on the west, smoking,
 * and two frames of nets drying on the east with a fisherman mending one.
 * The boat lies afloat in front (the renderer draws it), so the front stays
 * open.
 */
function wharfPierArt(ctx, S, state) {
  const side = state % 4;
  const catchIn = state >= 4;
  const T = turner(S, side);
  const Q = (u, v, z = 0) => P(...T(u, v), z);
  const at = (u, v) => { const [a, b] = T(u, v); return a + b; };
  const { shore } = overWater(S);
  const Z = 4; // the deck over the water
  shoreGround(ctx, T, S, shore, '#a99a74');
  const items = [];
  items.push({ d: Math.min(at(0.92, 0.25), at(S, S - 0.25)) - 1, draw: () => pierDeck(ctx, T, 0.92, S - 0.04, 0.25, S - 0.25, { z: Z, step: 0.45 }) });
  // two steps up from the shore to the deck
  for (const [u0, h] of [[0.62, 1.8], [0.77, 3.4]]) {
    const r = turnedRect(T, u0, 0.85, 0.16, 0.3);
    items.push({ d: r[0] + r[1], draw: () => box(ctx, r[0], r[1], r[2], r[3], 0, h, WOOD_PALE, { plain: true }) });
  }
  // the smoke house: a closed hut of plastered rubble, a vent in its ridge, smoking
  const hut = turnedRect(T, 0.1, 0.08, 0.52, 0.54);
  items.push({ d: hut[0] + hut[1], draw: () => {
    box(ctx, hut[0], hut[1], hut[2], hut[3], 0, 6, DADO, { plain: true, noTop: true });
    box(ctx, hut[0], hut[1], hut[2], hut[3], 6, 9, PLASTER);
    gableRoof(ctx, hut[0], hut[1], hut[2], hut[3], 15, 6, '#b8573a', hut[2] >= hut[3] ? 'u' : 'v');
    const vent = turnedRect(T, 0.3, 0.27, 0.14, 0.14);
    box(ctx, vent[0], vent[1], vent[2], vent[3], 19, 3, '#3a2c20', { plain: true });
    const [x, y] = Q(0.37, 0.34, 23);
    waterSmoke(ctx, x, y, 4);
  } });
  // two frames of nets drying, and the fisherman mending one, seated on a cask
  for (const v of [1.15, 1.85]) items.push({ d: at(0.4, v), draw: () => waterNet(ctx, Q(0.12, v), Q(0.7, v), 12) });
  items.push({ d: at(0.45, 1.62), draw: () => {
    const [x, y] = Q(0.45, 1.62);
    ctx.fillStyle = WOOD;
    ctx.fillRect(x - 2.6, y - 3.5, 5.2, 3.5);
    waterLine(ctx, [x - 2.6, y - 2], [x + 2.6, y - 2], WOOD_DARK, 0.6);
    waterMan(ctx, x, y - 3.5, { seated: true, tunic: '#6f8fa8', reach: Q(0.45, 1.85, 7) });
  } });
  // the gutting table with its tub, and the man at it
  items.push({ d: at(1.3, 0.48), draw: () => {
    const t = turnedRect(T, 1.2, 0.38, 0.38, 0.2);
    box(ctx, t[0], t[1], t[2], t[3], Z, 4.5, WOOD, { plain: true });
    ctx.fillStyle = FISH;
    for (const [u, v] of [[1.3, 0.46], [1.45, 0.5]]) {
      const [x, y] = Q(u, v, Z + 4.5);
      ctx.beginPath(); ctx.ellipse(x, y - 0.6, 2, 0.7, 0.2, 0, Math.PI * 2); ctx.fill();
    }
  } });
  items.push({ d: at(1.66, 0.5), draw: () => {
    const [x, y] = Q(1.66, 0.5, Z);
    ctx.fillStyle = '#7d5430'; // the tub
    ctx.fillRect(x - 3, y - 4.5, 6, 4.5);
    ctx.fillStyle = '#d8d3c4';
    ctx.beginPath(); ctx.ellipse(x, y - 4.5, 3, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  } });
  items.push({ d: at(1.08, 0.5), draw: () => {
    const [x, y] = Q(1.08, 0.5, Z);
    waterMan(ctx, x, y, { tunic: '#b8683c', reach: Q(1.25, 0.48, Z + 5) });
  } });
  // the catch, in wicker baskets
  if (catchIn) {
    for (const [u, v] of [[1.4, 1.1], [1.65, 1.3], [1.35, 1.45]]) {
      items.push({ d: at(u, v) + 0.05, draw: () => fishBasket(ctx, ...Q(u, v, Z)) });
    }
  }
  // bollards along the deck's edge and a lantern
  for (const v of [0.4, S - 0.4]) {
    items.push({ d: at(S - 0.1, v), draw: () => {
      const [x, y] = Q(S - 0.1, v, Z);
      post(ctx, x, y, 5, 2.4, '#4a3a2a');
      ctx.fillStyle = '#6b5640';
      ctx.fillRect(x - 1.7, y - 5.6, 3.4, 1.2);
    } });
  }
  items.push({ d: at(1.0, 1.62), draw: () => waterLantern(ctx, ...Q(1.0, 1.62, Z), 9) });
  paint(items);
}

/** A round basket of fish standing at (x, y). */
function fishBasket(ctx, x, y) {
  ctx.fillStyle = '#b08850';
  ctx.beginPath(); ctx.ellipse(x, y - 1.5, 3.4, 1.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(x - 3.4, y - 4, 6.8, 2.5);
  ctx.fillStyle = '#8f6a3a';
  ctx.beginPath(); ctx.ellipse(x, y - 4, 3.4, 1.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = FISH;
  for (const [dx, r] of [[-1.3, 0.4], [0.9, -0.3], [0, 0.1]]) {
    ctx.beginPath(); ctx.ellipse(x + dx, y - 4.4, 1.8, 0.6, r, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Gulls over a fishing ground (drawn live by the renderer, not cached)
// ---------------------------------------------------------------------------

/**
 * A few gulls wheeling over the fishing ground at screen point (x, y) (the
 * water's surface, device px), and now and then a fish rising. `t` is the
 * time in seconds (0 for a still picture), `seed` keeps grounds out of step.
 */
export function drawGulls(ctx, x, y, k, t, seed) {
  // rings where fish rise
  for (let n = 0; n < 2; n++) {
    const p = (t * 0.35 + n * 0.5 + seed * 0.13) % 1;
    ctx.strokeStyle = `rgba(235,245,250,${0.45 * (1 - p)})`;
    ctx.lineWidth = 0.8 * k;
    ctx.beginPath();
    ctx.ellipse(x + (n ? 9 : -7) * k, y + (n ? -2 : 3) * k, (2 + p * 9) * k, (1 + p * 4.5) * k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let g = 0; g < 4; g++) {
    const a = t * (0.55 + g * 0.08) + g * 1.7 + seed;
    const r = (12 + g * 4) * k;
    const gx = x + Math.cos(a) * r;
    const gy = y - (26 + g * 5 + Math.sin(a * 1.3) * 3) * k + Math.sin(a) * r * 0.45;
    const flap = Math.sin(t * 9 + g * 2.1) * 1.8 * k;
    const s = (4.8 + (g % 2) * 0.8) * k;
    // shadow on the water
    ctx.fillStyle = 'rgba(0,30,50,0.18)';
    ctx.beginPath(); ctx.ellipse(gx, y + Math.sin(a) * r * 0.45 + 2 * k, s * 0.7, s * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    // the bird: a white body and two wings in a shallow V
    ctx.strokeStyle = '#f4f6f6';
    ctx.lineWidth = 1.5 * k;
    ctx.beginPath();
    ctx.moveTo(gx - s, gy - flap);
    ctx.quadraticCurveTo(gx - s * 0.4, gy - flap * 0.2 - 0.8 * k, gx, gy);
    ctx.quadraticCurveTo(gx + s * 0.4, gy - flap * 0.2 - 0.8 * k, gx + s, gy - flap);
    ctx.stroke();
    ctx.strokeStyle = '#5a6066'; // dark wing tips
    ctx.lineWidth = 1.2 * k;
    ctx.beginPath();
    ctx.moveTo(gx - s, gy - flap); ctx.lineTo(gx - s * 0.75, gy - flap * 0.8);
    ctx.moveTo(gx + s, gy - flap); ctx.lineTo(gx + s * 0.75, gy - flap * 0.8);
    ctx.stroke();
  }
}
