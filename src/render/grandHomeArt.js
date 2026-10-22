/**
 * grandHomeArt.js
 * ----------------------------------------------------------------------------
 * The Classic sprites of the nine richest homes (levels 12 to 20), drawn to
 * the designs of their 3D models (src/render3d/models/housesVillas.js,
 * housesGrand.js and housesPalatia.js hold the full descriptions):
 *
 *   12 Insula            3 storeys of plastered rubble over a red dado, shops and
 *                        a door below, balconies on beam ends, a light well
 *   13 Villa             blank plastered street front, a Tuscan peristyle with the
 *                        roof falling inward to the compluvium, a kitchen garden
 *   14 Garden Villa      the house along the back over a loggia, a walled garden of
 *                        parterres, a fountain, a pergola and cypresses
 *   15 Peristyle Villa   atrium block on the street, peristyle garden behind it,
 *                        terracotta plaques along the eaves
 *   16 Marble Villa      the same with marble where it shows
 *   17 Mansion           a second storey over four shops, a second garden with a
 *                        long pool, and a corner dining tower
 *   18 Palatium          an Ionic porch, a double-height atrium, a great peristyle
 *                        with a long basin and statues, a garden pavilion
 *   19 Grand Palatium    a street of shops, two atria, two peristyles, a loggia
 *   20 Imperial Palatium an Ionic porch and forecourt, marble peristyles, a
 *                        belvedere tower and a garden pavilion
 *
 * The street is the +v face (front left on screen); the gardens lie behind,
 * toward small u + v. Republican, as the 3D homes: plastered fronts, no bare
 * brick, no chimney, no dome or apse, no Corinthian order. Every wall is a
 * box or a recorded polygon, so a turned home (turn.js) sorts as one, and
 * windows() and door() tell the night lights where the openings are.
 * ----------------------------------------------------------------------------
 */

import { P, poly, quad, box, gableRoof, hipRoof, column, colonnade, windows, door, shade, mix, tree, cypress, roofSnowAmount } from './draw.js';

// The palette: the Republic's plaster, dado and tufa (as buildingArt's COL), with marble and garden tones.
const PLASTER = ['#ebe0c6', '#efe6d0', '#e6d8b8', '#eadfc8'];
const DADO = '#a4472f';
const TUFA = '#bdae88';
const TUFA_DARK = '#9a8b68';
const STUCCO_COLUMN = '#dfd1b1'; // stuccoed tufa, the peristyle's Tuscan order
const MARBLE = '#f2eee6';
const MARBLE_DARK = '#cfc9bb';
const PAVE = '#cfc2a2';
const COURT = '#d6c9a8';
const LAWN = '#86a85a';
const BED = '#5d8a3e';
const SOIL = '#7d5c3b';
const HEDGE = '#4f7a3a';
const WATER = '#4a90c8';
const WOOD = '#8a5a33';
const WOOD_DARK = '#5e3b20';
const GLASS = '#3f3126';
const DARK = '#3a2c20';
const BRONZE = '#6f8f7c';
const GOLD = '#d6ab3c';
const TERRA = ['#b8573a', '#c26a3e', '#93432c', '#a45b44'];
const AWNINGS = ['#b8573a', '#5d7fa3', '#a38b3d', '#7a9c5a'];

const roofTone = (variant) => TERRA[variant % 4];
const wallTone = (variant) => PLASTER[variant % 4];
const lookAlt = (variant) => (variant >> 2) & 1;

/** Plastered wall over its dado (a box pair, one footprint so a turn keeps them together). */
function grandWall(ctx, u0, v0, du, dv, z0, h, tone, o = {}) {
  const dado = o.dado ?? Math.min(5, h * 0.3);
  // (no top on the dado: the plaster stands on it)
  box(ctx, u0, v0, du, dv, z0, dado, o.dadoColor ?? DADO, { plain: true, noTop: true });
  box(ctx, u0, v0, du, dv, z0 + dado, h - dado, tone);
}

/** A row of terracotta plaques (antefixes) along an eave on the +v face. */
function grandPlaques(ctx, u0, u1, v, z, n) {
  for (let k = 0; k < n; k++) {
    const [x, y] = P(u0 + ((u1 - u0) * (k + 0.5)) / n, v, z);
    ctx.fillStyle = '#c4633f';
    ctx.fillRect(x - 1, y - 1.8, 2, 2.2);
    ctx.fillStyle = '#e3d3a0';
    ctx.fillRect(x - 0.5, y - 1.3, 1, 1);
  }
}

/** Shop openings on the +v face: a dark bay, a counter and an awning each. */
function grandShops(ctx, u0, u1, v, n, top, variant) {
  for (let k = 0; k < n; k++) {
    const a = u0 + ((u1 - u0) * (k + 0.1)) / n;
    const b = u0 + ((u1 - u0) * (k + 0.9)) / n;
    poly(ctx, [P(a, v, 1), P(b, v, 1), P(b, v, top), P(a, v, top)], DARK);
    poly(ctx, [P(a, v, 1), P(b, v, 1), P(b, v + 0.04, 3.2), P(a, v + 0.04, 3.2)], TUFA);
    poly(ctx, [P(a - 0.02, v, top + 1.2), P(b + 0.02, v, top + 1.2), P(b + 0.02, v + 0.11, top - 1.8), P(a - 0.02, v + 0.11, top - 1.8)], AWNINGS[(k + variant) % 4]);
  }
}

/** A door in a frame: pilasters either side and a lintel (tufa, or marble in the Marble Villa). */
function grandDoor(ctx, u, v, h, stone, w = 0.2) {
  box(ctx, u - w / 2 - 0.07, v - 0.05, 0.07, 0.06, 0, h + 1.5, stone, { plain: true });
  box(ctx, u + w / 2, v - 0.05, 0.07, 0.06, 0, h + 1.5, stone, { plain: true });
  box(ctx, u - w / 2 - 0.07, v - 0.05, w + 0.14, 0.06, h, 1.6, stone, { plain: true });
  door(ctx, 'left', u - 0.5, v - 1, u + 0.5, v, 0, 0.5, '#4a3222', w, h);
}

/** Roof tiles' colour for a ring or a single gable (kept with the shade the lit side takes). */
function grandRoof(ctx, u0, v0, du, dv, z, rh, tone, axis) {
  gableRoof(ctx, u0, v0, du, dv, z, rh, tone, axis, 0.05);
}

/**
 * A roof that falls inward to an open compluvium: four lean-to strips round
 * the hole (hu0..hu1 x hv0..hv1), high at the outer wall (zEave) and low at
 * the hole (zIn). The hole shows the dark atrium and its basin.
 */
function grandAtrium(ctx, outer, hole, zEave, zIn, tone, columns = 0) {
  const [u0, v0, u1, v1] = outer;
  const [hu0, hv0, hu1, hv1] = hole;
  leanRoof(ctx, u0, v0, u1, hv0, 'v0', zEave, zIn, tone);
  leanRoof(ctx, u0, hv0, hu0, hv1, 'u0', zEave, zIn, tone);
  quad(ctx, hu0, hv0, hu1, hv1, zIn - 1.5, '#4a3a2c');
  quad(ctx, hu0 + 0.1, hv0 + 0.08, hu1 - 0.1, hv1 - 0.08, zIn - 1.2, mix(WATER, '#4a3a2c', 0.7));
  if (columns) {
    // the tetrastyle atrium: four posts round the basin
    for (const [u, v] of [[hu0 + 0.08, hv0 + 0.08], [hu1 - 0.08, hv0 + 0.08], [hu0 + 0.08, hv1 - 0.08], [hu1 - 0.08, hv1 - 0.08]]) column(ctx, u, v, zIn - 1.5, columns, STUCCO_COLUMN, 1.2);
  }
  leanRoof(ctx, hu1, hv0, u1, hv1, 'u1', zEave, zIn, tone);
  leanRoof(ctx, u0, hv1, u1, v1, 'v1', zEave, zIn, tone);
}

/** A marble or tufa basin: a rim and the water in it. */
function grandBasin(ctx, u0, v0, u1, v1, stone = TUFA) {
  box(ctx, u0, v0, u1 - u0, v1 - v0, 0, 1.8, stone, { plain: true, top: shade(stone, 0.1) });
  quad(ctx, u0 + 0.05, v0 + 0.05, u1 - 0.05, v1 - 0.05, 1.8, WATER, shade(WATER, -0.3));
}

/** A statue on a base, stone or bronze (the 3D homes' marble figures and bronze faun). */
function grandFigure(ctx, u, v, color = MARBLE, base = TUFA, s = 1) {
  const [x, y] = P(u, v);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x - 3 * s, y - 0.5, 7 * s, 1.4);
  ctx.fillStyle = base;
  ctx.fillRect(x - 2.6 * s, y - 4 * s, 5.2 * s, 4 * s);
  ctx.fillStyle = shade(base, 0.2);
  ctx.fillRect(x - 2.6 * s, y - 4 * s, 2 * s, 4 * s);
  ctx.fillStyle = color;
  ctx.fillRect(x - 1.1 * s, y - 10.5 * s, 2.2 * s, 6.5 * s);
  ctx.beginPath(); ctx.arc(x, y - 11.8 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(color, -0.2);
  ctx.fillRect(x + 0.6 * s, y - 10.5 * s, 0.7 * s, 6.5 * s);
}

/** A box-edged flower bed (a parterre): a green plot with a hedge border and blooms. */
function grandBed(ctx, u0, v0, u1, v1, variant, bloom = '#d9534f') {
  quad(ctx, u0, v0, u1, v1, 0, HEDGE);
  quad(ctx, u0 + 0.05, v0 + 0.05, u1 - 0.05, v1 - 0.05, 0.2, BED);
  const nu = Math.max(1, Math.round((u1 - u0) / 0.16));
  const nv = Math.max(1, Math.round((v1 - v0) / 0.16));
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      if ((i + j + variant) % 3 === 2) continue;
      const [x, y] = P(u0 + ((u1 - u0) * (i + 0.5)) / nu, v0 + ((v1 - v0) * (j + 0.5)) / nv, 0.4);
      ctx.fillStyle = (i + j) % 2 ? bloom : '#f0c24a';
      ctx.fillRect(x - 0.7, y - 1.4, 1.4, 1.4);
    }
  }
}

/** A low garden wall (plastered, capped) along a footprint rectangle. */
function grandLowWall(ctx, u0, v0, du, dv, h, tone) {
  box(ctx, u0, v0, du, dv, 0, h, tone, { top: shade(tone, 0.1) });
}

/** A column with Ionic volutes at its capital. */
function grandIonic(ctx, u, v, z0, h, color = MARBLE, r = 1.6) {
  column(ctx, u, v, z0, h, color, r);
  const [x, y] = P(u, v, z0 + h);
  ctx.fillStyle = shade(color, -0.2);
  ctx.beginPath(); ctx.arc(x - r - 0.6, y - 0.4, 1, 0, Math.PI * 2); ctx.arc(x + r + 0.6, y - 0.4, 1, 0, Math.PI * 2); ctx.fill();
}

/** A bronze lampstand: a thin post with a bowl and a flame. */
function grandLamp(ctx, u, v) {
  const [x, y] = P(u, v);
  ctx.fillStyle = BRONZE;
  ctx.fillRect(x - 0.6, y - 12, 1.2, 12);
  ctx.fillRect(x - 1.8, y - 13, 3.6, 1.6);
  ctx.fillStyle = '#f2b84a';
  ctx.fillRect(x - 0.7, y - 15.5, 1.4, 2.5);
}

/**
 * A peristyle: a court ringed by a Tuscan colonnade under lean-to roofs that
 * fall toward the court, on its back, left and right sides (the front side is
 * the house). `c`: u0..u1 x v0..v1 outer rectangle, t wall thickness, d
 * portico depth, h column height, wallH side wall height, backH the back
 * wall's height (a range, taller), backHigh where the back portico's roof
 * meets it, nu / nv columns along the back and the sides.
 * `inner(ctx)` draws what stands in the court, after the back and left
 * porticos and before the right one.
 */
function grandCourt(ctx, c, inner) {
  const { u0, v0, u1, v1, t = 0.1, d = 0.28, h, wallH, backH = wallH, backHigh = wallH, floor = COURT, col = STUCCO_COLUMN, r = 1.3, nu, nv, roof, tone, backWindows } = c;
  const iu0 = u0 + t;
  const iu1 = u1 - t;
  const iv0 = v0 + t;
  const rightH = Math.min(wallH, h + 2); // lower on the viewer's side so the court stays readable
  quad(ctx, iu0, iv0, iu1, v1, 0, floor);
  grandWall(ctx, u0, v0, u1 - u0, t, 0, backH, tone);
  grandWall(ctx, u0, iv0, t, v1 - iv0, 0, wallH, tone);
  if (backWindows) windows(ctx, 'left', iu0 + 0.3, v0, iu1 - 0.3, iv0, 0, 1, backWindows, GLASS, { z: backH - 8, h: 4.5, w: 0.1 });
  leanRoof(ctx, iu0, iv0, iu1, iv0 + d, 'v0', backHigh, h + 1, roof);
  colonnade(ctx, iu0 + d, iv0 + d, iu1 - d, iv0 + d, nu, 0, h, col, r);
  leanRoof(ctx, iu0, iv0 + d, iu0 + d, v1, 'u0', wallH, h + 1, roof);
  colonnade(ctx, iu0 + d, iv0 + d, iu0 + d, v1 - 0.06, nv, 0, h, col, r);
  if (inner) inner(ctx);
  leanRoof(ctx, iu1 - d, iv0 + d, iu1, v1, 'u1', rightH, h + 1, roof);
  colonnade(ctx, iu1 - d, iv0 + d, iu1 - d, v1 - 0.06, nv, 0, h, col, r);
  grandWall(ctx, iu1, iv0, t, v1 - iv0, 0, rightH, tone, { dado: 3 });
}

/** Windows on the +u face of a wall block, for the lit-window overlay too. */
function sideWindows(ctx, u, v0, v1, rows, cols, z, h = 4.5, gap = 9.5, o = {}) {
  windows(ctx, 'right', u - 0.1, v0, u, v1, 0, rows, cols, GLASS, { z, h, gap, ...o });
}

// ---------------------------------------------------------------------------
// 12 Insula
// ---------------------------------------------------------------------------

function grandInsula(ctx, variant) {
  const tone = wallTone(variant);
  const roof = roofTone(variant);
  const alt = lookAlt(variant);
  const a = 0.1;
  const b = 1.9;
  const H = 31;
  quad(ctx, 0.03, 0.03, 1.97, 1.97, 0, PAVE);
  grandWall(ctx, a, a, b - a, b - a, 0, H, tone, { dado: 5 });
  // the light well, open to the sky between the two roofs
  quad(ctx, 0.7, 0.88, 1.3, 1.12, H, '#2f251d');
  grandRoof(ctx, a, a, b - a, 0.78, H, 6, shade(roof, -0.05), 'u');
  grandRoof(ctx, a, 1.1, b - a, 0.8, H, 9, roof, 'u'); // the street wing, the steepest
  // street face: three shops and the stair door, two storeys of windows above
  grandShops(ctx, a + 0.08, 1.5, b, 3, 10, variant);
  door(ctx, 'left', a, 0, b, b, 0, 0.88, '#4a3222', 0.17, 9);
  windows(ctx, 'left', a, a, b, b, 0, 2, 4, GLASS, { z: 14, h: 4.5, gap: 9.5, shutters: alt ? '#4f7a52' : null });
  sideWindows(ctx, b, a, b, 3, 4, 5, 4.5, 9.5, { flowers: !alt });
  // balconies on timber beams, along the street end of the side face
  for (const z of [13, 22.5]) {
    box(ctx, b, 0.4, 0.1, 1.3, z, 1.4, WOOD_DARK, { plain: true, top: WOOD });
    for (let k = 0; k < 5; k++) {
      const [x, y] = P(b, 0.45 + k * 0.3, z - 0.4);
      ctx.fillStyle = DARK;
      ctx.fillRect(x - 0.8, y - 0.2, 1.6, 2.2);
    }
  }
  if (alt) {
    // washing on a line across the street face
    const p = P(0.3, b + 0.1, 24);
    const q = P(1.1, b + 0.1, 24);
    ctx.strokeStyle = '#6b5a48';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = ['#f2eee6', '#b8573a', '#5d7fa3', '#e8d7a0'][(k + variant) % 4];
      ctx.fillRect(p[0] + (q[0] - p[0]) * (0.15 + k * 0.22) - 1.2, p[1] + (q[1] - p[1]) * (0.15 + k * 0.22), 2.4, 2.8);
    }
  }
}

// ---------------------------------------------------------------------------
// 13 Villa and 14 Garden Villa
// ---------------------------------------------------------------------------

function grandVilla(ctx, variant) {
  const tone = wallTone(variant);
  const roof = roofTone(variant);
  const alt = lookAlt(variant);
  quad(ctx, 0.03, 0.03, 1.97, 1.97, 0, PAVE);
  // the kitchen garden at the back, walled, with its fig
  quad(ctx, 0.2, 0.2, 1.8, 0.5, 0, SOIL);
  for (let k = 0; k < 4; k++) quad(ctx, 0.28, 0.25 + k * 0.065, 1.72, 0.29 + k * 0.065, 0.2, k % 2 ? '#6f9a45' : BED);
  grandLowWall(ctx, 0.1, 0.1, 1.8, 0.09, 8, tone);
  tree(ctx, 1.4, 0.38, 0.55, '#6d9a3c', '#6b4a2a', variant);
  grandLowWall(ctx, 0.1, 0.19, 0.09, 0.4, 8, tone);
  // the peristyle court: Tuscan columns, roofs falling inward
  grandCourt(ctx, { u0: 0.1, v0: 0.55, u1: 1.9, v1: 1.3, t: 0.1, d: 0.27, h: 11, wallH: 19, nu: 4, nv: 3, roof, tone, r: 1.2 }, (c) => {
    box(c, 0.88, 0.95, 0.24, 0.2, 0, 4.5, TUFA, { plain: true }); // the cistern head
    quad(c, 0.93, 1.0, 1.07, 1.1, 4.5, '#3b3a36');
  });
  // the street block: its roof falls inward to the compluvium over the atrium
  grandWall(ctx, 0.1, 1.3, 1.8, 0.65, 0, 19, tone, { dado: 4 });
  grandAtrium(ctx, [0.1, 1.3, 1.9, 1.95], [0.62, 1.45, 1.38, 1.8], 19, 14, roof);
  // the blank street front: a studded door between pilasters, one small barred window
  grandDoor(ctx, 1.0, 1.95, 9, TUFA);
  poly(ctx, [P(1.5, 1.95, 9.5), P(1.66, 1.95, 9.5), P(1.66, 1.95, 13), P(1.5, 1.95, 13)], GLASS);
  poly(ctx, [P(1.58, 1.95, 9.5), P(1.58, 1.95, 13)], null, '#7a7266', 0.6);
  windows(ctx, 'right', 1.9, 1.3, 1.9, 1.95, 0, 1, 2, GLASS, { z: 8, h: 4.5, w: 0.1 });
  if (alt) grandPlaques(ctx, 0.2, 1.8, 1.97, 19.5, 8);
}

function grandGardenVilla(ctx, variant) {
  const tone = wallTone(variant);
  const roof = roofTone(variant);
  const alt = lookAlt(variant);
  quad(ctx, 0.03, 0.03, 1.97, 1.97, 0, PAVE);
  // the house along the back, two storeys, its gable roof ridge along u
  grandWall(ctx, 0.1, 0.1, 1.8, 0.55, 0, 18, tone, { dado: 4 });
  grandRoof(ctx, 0.1, 0.1, 1.8, 0.55, 18, 7, roof, 'u');
  windows(ctx, 'right', 1.9, 0.1, 1.9, 0.65, 0, 2, 2, GLASS, { z: 5, h: 4.5, gap: 8, w: 0.1 });
  // the loggia: Tuscan columns on the garden side, its roof leaning on the house
  leanRoof(ctx, 0.1, 0.65, 1.9, 0.9, 'v0', 12, 9, shade(roof, -0.04));
  colonnade(ctx, 0.2, 0.88, 1.8, 0.88, 6, 0, 8.5, STUCCO_COLUMN, 1.1);
  windows(ctx, 'left', 0.2, 0.1, 1.8, 0.65, 0, 1, 4, GLASS, { z: 19.5, h: 4, w: 0.1 }); // (upper storey, over the loggia roof)
  // the walled garden: lawn, parterres, a fountain, a pergola and cypresses
  quad(ctx, 0.19, 0.9, 1.81, 1.9, 0, LAWN);
  quad(ctx, 0.9, 0.9, 1.1, 1.9, 0, PAVE); // the path from the gate
  quad(ctx, 0.2, 1.38, 1.8, 1.52, 0, PAVE);
  grandBed(ctx, 0.28, 1.0, 0.82, 1.32, variant);
  grandBed(ctx, 1.18, 1.0, 1.72, 1.32, variant + 1, '#e9e2d2');
  grandBed(ctx, 0.28, 1.58, 0.82, 1.84, variant + 2, '#d9534f');
  grandBed(ctx, 1.18, 1.58, 1.72, 1.84, variant, '#f0c24a');
  grandBasin(ctx, 0.85, 1.3, 1.15, 1.6, TUFA);
  const [fx, fy] = P(1.0, 1.45, 1.8);
  ctx.fillStyle = '#cfe6f2';
  ctx.fillRect(fx - 0.5, fy - 6, 1, 6);
  if (alt) grandFigure(ctx, 1.0, 1.05, MARBLE, TUFA, 0.75); // the herm on its base
  grandLowWall(ctx, 0.1, 0.9, 0.09, 1.07, 7, tone);
  cypress(ctx, 0.3, 1.8, 0.6);
  cypress(ctx, 0.3, 1.0, 0.55);
  // the vine pergola on posts, along the garden's right side
  for (let k = 0; k < 4; k++) {
    const v = 1.05 + k * 0.22;
    const [x, y] = P(1.66, v);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x - 0.6, y - 9, 1.2, 9);
  }
  const p = P(1.66, 1.05, 9);
  const q = P(1.66, 1.71, 9);
  ctx.strokeStyle = '#2f5a2a';
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  grandLowWall(ctx, 1.81, 0.9, 0.09, 1.07, 7, tone);
  // the front wall, with the garden gate open at the middle
  grandLowWall(ctx, 0.1, 1.9, 0.8, 0.08, 7, tone);
  grandLowWall(ctx, 1.1, 1.9, 0.8, 0.08, 7, tone);
  cypress(ctx, 1.72, 1.85, 0.6);
}

// ---------------------------------------------------------------------------
// 15 to 17: the atrium house with its peristyle garden
// ---------------------------------------------------------------------------

/**
 * The Peristyle Villa, the Marble Villa and the Mansion, 3 x 3. `tier` picks
 * the dressing: marble in the door, columns and basin from 16, and from 17 a
 * second storey, a second garden and a dining tower.
 */
function grandAtriumHouse(ctx, variant, tier) {
  const tone = wallTone(variant);
  const roof = roofTone(variant);
  const alt = lookAlt(variant);
  const marble = tier >= 16;
  const mansion = tier >= 17;
  const stone = marble ? MARBLE : TUFA;
  quad(ctx, 0.03, 0.03, 2.97, 2.97, 0, PAVE);
  const courtBack = mansion ? 0.8 : 0.12;
  if (mansion) {
    // the second garden beyond the peristyle: a long pool between lawns, cypresses
    quad(ctx, 0.12, 0.12, 2.88, 0.84, 0, LAWN);
    quad(ctx, 0.5, 0.36, 2.5, 0.6, 0, MARBLE_DARK);
    quad(ctx, 0.56, 0.4, 2.44, 0.56, 0.6, WATER);
    for (const u of [0.35, 2.65]) cypress(ctx, u, 0.7, 0.8);
    cypress(ctx, 0.35, 0.3, 0.75);
    // the cenatio, the dining room in the corner: a tower under a pyramid roof
    box(ctx, 2.2, 0.12, 0.68, 0.68, 0, 32, tone, { top: shade(tone, 0.1) });
    hipRoof(ctx, 2.2, 0.12, 0.68, 0.68, 32, 10, roof, 0.07);
    windows(ctx, 'left', 2.2, 0.12, 2.88, 0.8, 0, 1, 2, GLASS, { z: 18, h: 6, w: 0.1 });
    windows(ctx, 'right', 2.2, 0.12, 2.88, 0.8, 0, 1, 2, GLASS, { z: 18, h: 6, w: 0.1 });
  }
  grandCourt(ctx, {
    u0: 0.12, v0: courtBack, u1: 2.88, v1: 1.8, t: 0.1, d: 0.3, h: 11, wallH: mansion ? 22 : 17,
    backH: mansion ? 16 : 17, backHigh: mansion ? 13 : 17, floor: marble ? '#d9d0b8' : COURT, col: marble ? MARBLE : STUCCO_COLUMN, r: 1.4,
    nu: 6, nv: 3, roof, tone, backWindows: 0,
  }, (c) => {
    const cv = (courtBack + 1.8) / 2 + 0.1;
    quad(c, 0.62, cv - 0.5, 2.38, cv + 0.5, 0, mansion ? LAWN : '#9bb56a', null);
    quad(c, 1.25, cv - 0.5, 1.75, cv + 0.5, 0, COURT);
    grandBasin(c, 1.1, cv - 0.22, 1.9, cv + 0.22, stone);
    if (marble) {
      const [x, y] = P(1.5, cv, 1.8);
      c.fillStyle = '#cfe6f2';
      c.fillRect(x - 0.5, y - 6, 1, 6);
      grandFigure(c, 2.15, cv - 0.15, MARBLE, MARBLE_DARK, 0.9);
    }
    tree(c, 0.85, cv - 0.15, 0.4, '#5b8a3a', '#6b4a2a', variant);
    if (!marble) tree(c, 2.15, cv + 0.15, 0.4, '#5b8a3a', '#6b4a2a', variant + 1);
    else grandBed(c, 0.7, cv + 0.2, 1.0, cv + 0.45, variant);
  });
  // the tablinum, the hall between atrium and garden, under its own gable
  grandWall(ctx, 1.05, 1.5, 0.9, 0.4, 0, 16, tone, { dado: 3 });
  grandRoof(ctx, 1.05, 1.5, 0.9, 0.4, 16, 6, shade(roof, -0.04), 'v');
  // the street block: atrium behind the shops, the roof falling in to the compluvium
  const front = mansion ? 26 : 18;
  const fv0 = 1.8;
  grandWall(ctx, 0.12, fv0, 2.76, 2.9 - fv0, 0, front, tone, { dado: 5, dadoColor: marble && !mansion ? '#b78a78' : DADO });
  if (mansion) box(ctx, 0.12, fv0, 2.76, 2.9 - fv0, 14.2, 1, shade(tone, -0.1), { plain: true, top: shade(tone, -0.1) }); // the storey band
  grandAtrium(ctx, [0.12, fv0, 2.88, 2.9], [1.15, 2.2, 1.85, 2.55], front, front - 5, roof);
  windows(ctx, 'right', 2.88, fv0, 2.88, 2.9, 0, mansion ? 2 : 1, 3, GLASS, { z: mansion ? 6 : 8, h: 5, gap: 11, w: 0.1 });
  // the street front: the porter's door, two shops (four under the Mansion's second storey)
  if (mansion) {
    grandShops(ctx, 0.25, 1.2, 2.9, 2, 11, variant);
    grandShops(ctx, 1.8, 2.75, 2.9, 2, 11, variant + 1);
    grandDoor(ctx, 1.5, 2.9, 10, stone, 0.24);
    windows(ctx, 'left', 0.25, 0.1, 2.75, 2.9, 0, 1, 5, GLASS, { z: 17, h: 5.5, w: 0.11 });
    box(ctx, 0.25, 2.9, 2.5, 0.1, 13.5, 1.3, WOOD_DARK, { plain: true, top: WOOD }); // the timber balcony
    for (let k = 0; k < 9; k++) {
      const [x, y] = P(0.3 + k * 0.28, 3.0, 12.5);
      ctx.fillStyle = DARK;
      ctx.fillRect(x - 0.8, y - 0.2, 1.6, 2.4);
    }
    const p = P(0.25, 3.0, 17);
    const q = P(2.75, 3.0, 17);
    ctx.strokeStyle = WOOD_DARK;
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  } else {
    grandShops(ctx, 0.3, 1.1, 2.9, 2, 10, variant);
    grandShops(ctx, 1.9, 2.7, 2.9, 2, 10, variant + 1);
    grandDoor(ctx, 1.5, 2.9, 9.5, stone, 0.24);
    if (alt) windows(ctx, 'left', 0.3, 0.1, 2.7, 2.9, 0, 1, 4, GLASS, { z: 12.5, h: 3, w: 0.08 });
  }
  if (marble) quad(ctx, 1.3, 2.9, 1.7, 3.0, 0, MARBLE); // the marble threshold
  grandPlaques(ctx, 0.2, 2.8, 2.93, front, 13);
}

// ---------------------------------------------------------------------------
// 18 Palatium
// ---------------------------------------------------------------------------

function grandPalatium(ctx, variant) {
  const tone = wallTone(variant);
  const roof = roofTone(variant);
  const alt = lookAlt(variant);
  quad(ctx, 0.03, 0.03, 2.97, 2.97, 0, PAVE);
  // the great peristyle: a long basin with a jet, statues on bases, a pavilion at the back
  grandCourt(ctx, { u0: 0.12, v0: 0.12, u1: 2.88, v1: 1.55, t: 0.1, d: 0.3, h: 11, wallH: 17, floor: '#d9d0b8', col: MARBLE, r: 1.4, nu: 6, nv: 3, roof, tone }, (c) => {
    // the garden pavilion at the back: a roofed room on four slim columns
    box(c, 1.2, 0.52, 0.6, 0.34, 0, 12, tone, { plain: true });
    hipRoof(c, 1.2, 0.52, 0.6, 0.34, 12, 6, roof, 0.07);
    quad(c, 0.75, 0.9, 2.25, 1.2, 0, LAWN);
    grandBasin(c, 0.85, 0.96, 2.15, 1.14, MARBLE);
    const [x, y] = P(1.5, 1.05, 1.8);
    c.fillStyle = '#cfe6f2';
    c.fillRect(x - 0.5, y - 7, 1, 7);
    for (const u of [0.55, 2.45]) grandFigure(c, u, 0.95, MARBLE, MARBLE_DARK, 0.9);
    grandFigure(c, 0.55, 1.3, MARBLE, MARBLE_DARK, 0.9);
    grandFigure(c, 2.45, 1.3, MARBLE, MARBLE_DARK, 0.9);
    cypress(c, 0.7, 0.5, 0.65);
    cypress(c, 2.3, 0.5, 0.65);
  });
  // the atrium range: a double-height nave between two lower side bays
  grandWall(ctx, 0.12, 1.5, 2.76, 0.95, 0, 17, tone, { dado: 4 });
  leanRoof(ctx, 0.12, 1.5, 0.95, 2.45, 'u1', 21, 16.5, shade(roof, -0.04));
  leanRoof(ctx, 2.05, 1.5, 2.88, 2.45, 'u0', 21, 16.5, roof);
  box(ctx, 0.95, 1.5, 1.1, 0.95, 17, 9, tone, { top: shade(tone, 0.1) }); // the nave's upper walls
  grandRoof(ctx, 0.95, 1.5, 1.1, 0.95, 26, 8, roof, 'v');
  windows(ctx, 'right', 2.05, 1.5, 2.05, 2.45, 0, 1, 3, GLASS, { z: 19.5, h: 5, w: 0.1 }); // the clerestory
  windows(ctx, 'left', 0.95, 0.12, 2.05, 2.45, 0, 1, 4, GLASS, { z: 19.5, h: 5, w: 0.09 });
  grandPlaques(ctx, 0.2, 2.8, 2.5, 17, 11);
  // the entrance range with its door, and the Ionic porch before it under a pediment
  grandWall(ctx, 0.12, 2.4, 2.76, 0.5, 0, 15, tone, { dado: 4 });
  leanRoof(ctx, 0.12, 2.4, 2.88, 2.92, 'v0', 19, 15.5, roof);
  windows(ctx, 'right', 2.88, 2.4, 2.88, 2.92, 0, 1, 2, GLASS, { z: 7, h: 5, w: 0.1 });
  windows(ctx, 'left', 0.12, 0.1, 0.8, 2.9, 0, 1, 2, GLASS, { z: 7, h: 5, w: 0.1 });
  windows(ctx, 'left', 2.2, 0.1, 2.88, 2.9, 0, 1, 2, GLASS, { z: 7, h: 5, w: 0.1 });
  box(ctx, 0.95, 2.62, 1.1, 0.38, 0, 1.6, TUFA, { plain: true }); // the porch's platform
  door(ctx, 'left', 0.95, 0, 2.05, 2.9, 1.6, 0.5, '#4a3222', 0.3, 11);
  for (let k = 0; k < 4; k++) grandIonic(ctx, 1.05 + k * 0.3, 2.9, 1.6, 15, MARBLE, 1.6);
  box(ctx, 0.95, 2.62, 1.1, 0.34, 16.6, 2.4, MARBLE, { plain: true });
  grandRoof(ctx, 0.95, 2.62, 1.1, 0.34, 19, 6, roof, 'v');
  if (alt) { grandLamp(ctx, 0.85, 2.98); grandLamp(ctx, 2.15, 2.98); }
}

// ---------------------------------------------------------------------------
// 19 and 20: the Faun's house at 16 m
// ---------------------------------------------------------------------------

/**
 * The Grand Palatium and the Imperial Palatium, 4 x 4: a street front, two
 * atria side by side, the tablinum between them and the garden, and two
 * peristyles one behind the other. The Imperial one adds an Ionic porch and a
 * forecourt on the street, marble columns and basins, a belvedere tower and a
 * garden pavilion.
 */
function grandFaunHouse(ctx, variant, tier) {
  const imperial = tier >= 20;
  const tone = wallTone(variant);
  const roof = roofTone(variant);
  const alt = lookAlt(variant);
  const col = imperial ? MARBLE : STUCCO_COLUMN;
  const stone = imperial ? MARBLE : TUFA;
  quad(ctx, 0.03, 0.03, 3.97, 3.97, 0, PAVE);
  const blockV0 = imperial ? 2.0 : 2.2;
  const blockV1 = imperial ? 3.0 : 3.45;
  grandCourt(ctx, {
    u0: 0.12, v0: 0.12, u1: 3.88, v1: blockV0, t: 0.1, d: 0.3, h: 11, wallH: 17, backH: 24, backHigh: 14,
    floor: imperial ? '#d9d0b8' : COURT, col, r: 1.4, nu: 8, nv: 4, roof, tone, backWindows: 6,
  }, (c) => {
    // the second peristyle at the back: a long pool, figs, cypresses, and (Imperial) the dining pavilion
    quad(c, 0.6, 0.4, 3.4, 0.98, 0, LAWN);
    quad(c, 1.0, 0.54, 3.0, 0.76, 0, imperial ? MARBLE : MARBLE_DARK);
    quad(c, 1.06, 0.58, 2.94, 0.72, 0.6, WATER);
    if (imperial) {
      box(c, 1.7, 0.3, 0.6, 0.22, 0, 11, tone, { plain: true });
      hipRoof(c, 1.7, 0.3, 0.6, 0.22, 11, 6, roof, 0.06);
    } else {
      tree(c, 0.85, 0.7, 0.5, '#6d9a3c', '#6b4a2a', variant);
      tree(c, 3.15, 0.7, 0.5, '#6d9a3c', '#6b4a2a', variant + 2);
    }
    cypress(c, 0.7, 0.95, 0.65);
    cypress(c, 3.3, 0.95, 0.65);
    // the cross wall between the peristyles, with its doorway
    grandLowWall(c, 0.5, 1.05, 1.5, 0.08, 8, tone);
    grandLowWall(c, 2.0, 1.05, 1.5, 0.08, 8, tone);
    // the first peristyle: a basin round a statue (a bronze faun, a marble figure in the Imperial house)
    quad(c, 1.0, 1.2, 3.0, 1.85, 0, imperial ? '#d9d0b8' : '#c8bb98');
    grandBasin(c, 1.6, 1.38, 2.4, 1.72, stone);
    grandFigure(c, 2.0, 1.55, imperial ? MARBLE : BRONZE, imperial ? MARBLE_DARK : TUFA, 0.9);
  });
  // the tablinum between the atria, under its own gable and a plaque
  grandWall(ctx, 1.55, blockV0 - 0.35, 0.9, 0.5, 0, 17, tone, { dado: 3 });
  grandRoof(ctx, 1.55, blockV0 - 0.35, 0.9, 0.5, 17, 7, shade(roof, -0.04), 'v');
  // the two atria: the left one Tuscan, the right one tetrastyle, each under its own compluvium
  const bv1 = blockV1;
  grandWall(ctx, 0.12, blockV0, 3.76, bv1 - blockV0, 0, 18, tone, { dado: 5 });
  const hv0 = blockV0 + 0.4;
  const hv1 = bv1 - 0.45;
  grandAtrium(ctx, [0.12, blockV0, 1.95, bv1], [0.55, hv0, 1.5, hv1], 18, 13, roof);
  grandAtrium(ctx, [2.05, blockV0, 3.88, bv1], [2.5, hv0, 3.45, hv1], 18, 13, roof, 6);
  windows(ctx, 'right', 3.88, blockV0, 3.88, bv1, 0, 1, 3, GLASS, { z: 9, h: 5, w: 0.1 });
  if (imperial) {
    // the belvedere tower over the left atrium's back corner: an open loggia of marble columns under a pyramid roof
    box(ctx, 0.12, blockV0, 0.62, 0.62, 18, 14, tone, { top: shade(tone, 0.1) });
    box(ctx, 0.12, blockV0, 0.62, 0.62, 32, 1.2, MARBLE, { plain: true });
    colonnade(ctx, 0.2, blockV0 + 0.55, 0.66, blockV0 + 0.55, 3, 33, 8, MARBLE, 1.2);
    colonnade(ctx, 0.66, blockV0 + 0.08, 0.66, blockV0 + 0.55, 3, 33, 8, MARBLE, 1.2);
    hipRoof(ctx, 0.12, blockV0, 0.62, 0.62, 42, 9, roof, 0.07);
    windows(ctx, 'left', 0.12, blockV0, 0.74, blockV0 + 0.62, 0, 1, 2, GLASS, { z: 22, h: 5, w: 0.1 });
    // the forecourt with its marble fountain and statues, between low walls
    quad(ctx, 0.12, 3.0, 3.88, 3.95, 0, '#d9d0b8');
    grandLowWall(ctx, 0.12, 3.0, 0.1, 0.95, 5, tone);
    grandBasin(ctx, 1.75, 3.2, 2.25, 3.6, MARBLE);
    const [fx, fy] = P(2.0, 3.4, 1.8);
    ctx.fillStyle = '#cfe6f2';
    ctx.fillRect(fx - 0.5, fy - 7, 1, 7);
    for (const u of [0.85, 3.15]) grandFigure(ctx, u, 3.3, MARBLE, MARBLE_DARK, 0.95);
    grandLowWall(ctx, 3.78, 3.0, 0.1, 0.95, 5, tone);
    // the porch: four Ionic columns on a marble platform under a pediment and its acroterion
    box(ctx, 1.1, 3.55, 1.8, 0.4, 0, 2, MARBLE, { plain: true });
    grandWall(ctx, 1.1, 3.55, 1.8, 0.1, 2, 13, tone, { dado: 3 });
    door(ctx, 'left', 1.1, 0, 2.9, 3.65, 2, 0.5, '#4a3222', 0.32, 11);
    for (let k = 0; k < 4; k++) grandIonic(ctx, 1.25 + k * 0.5, 3.92, 2, 15, MARBLE, 1.7);
    box(ctx, 1.1, 3.55, 1.8, 0.4, 17, 2.4, MARBLE, { plain: true });
    grandRoof(ctx, 1.1, 3.55, 1.8, 0.4, 19.4, 8, roof, 'v');
    grandLamp(ctx, 0.95, 3.9);
    grandLamp(ctx, 3.05, 3.9);
  } else {
    // a street of shops with two doors, then the atria behind
    grandWall(ctx, 0.12, 3.45, 3.76, 0.48, 0, 13, tone, { dado: 5 });
    leanRoof(ctx, 0.12, 3.45, 3.88, 3.97, 'v0', 17, 13.5, roof);
    grandShops(ctx, 0.25, 1.55, 3.93, 3, 10, variant);
    grandShops(ctx, 2.45, 3.75, 3.93, 3, 10, variant + 1);
    grandDoor(ctx, 1.85, 3.93, 9.5, TUFA, 0.2);
    grandDoor(ctx, 2.15, 3.93, 9.5, TUFA, 0.2);
  }
  grandPlaques(ctx, 0.2, 3.8, blockV1 + (imperial ? 0 : 0.5), 17.5, 16);
  if (alt && !imperial) { grandLamp(ctx, 1.65, 3.97); }
}

/** The nine homes' common entry: `tier` 12 to 20. */
export function grandHomeArt(ctx, S, variant, tier) {
  if (tier === 12) grandInsula(ctx, variant);
  else if (tier === 13) grandVilla(ctx, variant);
  else if (tier === 14) grandGardenVilla(ctx, variant);
  else if (tier <= 17) grandAtriumHouse(ctx, variant, tier);
  else if (tier === 18) grandPalatium(ctx, variant);
  else grandFaunHouse(ctx, variant, tier);
}

/**
 * A tiled roof that falls one way (a lean-to): the rectangle u0..u1 x v0..v1 rising to zHigh along its
 * `high` edge ('u0', 'u1', 'v0' or 'v1') and falling to zLow along the opposite one, with tile rows and
 * the snow on it. The same drawing as the civic halls' lean-to in buildingArt.js, kept here because the
 * two files may not import each other (tests/imports.test.mjs).
 */
function leanRoof(ctx, u0, v0, u1, v1, high, zHigh, zLow, color = COL.terra) {
  const z = (u, v) => {
    // 0 at the high edge, 1 at the low one
    const t = high === 'u0' ? (u - u0) / (u1 - u0) : high === 'u1' ? (u1 - u) / (u1 - u0) : high === 'v0' ? (v - v0) / (v1 - v0) : (v1 - v) / (v1 - v0);
    return zHigh + (zLow - zHigh) * t;
  };
  const corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  poly(ctx, corners.map(([u, v]) => P(u, v, z(u, v))), color, shade(color, -0.5), 0.6);
  // rows of tiles running along the high edge, in a darker tone of the roof
  const rows = 4;
  const along = high === 'u0' || high === 'u1';
  ctx.strokeStyle = shade(color, -0.22);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let k = 1; k < rows; k++) {
    const t = k / rows;
    const a = along ? [high === 'u0' ? u0 + (u1 - u0) * t : u1 - (u1 - u0) * t, v0] : [u0, high === 'v0' ? v0 + (v1 - v0) * t : v1 - (v1 - v0) * t];
    const b = along ? [a[0], v1] : [u1, a[1]];
    const p = P(a[0], a[1], z(a[0], a[1]));
    const q = P(b[0], b[1], z(b[0], b[1]));
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
  if (roofSnowAmount() > 0) {
    // snow from the high edge down, as far as the depth reaches
    const f = Math.min(1, 0.2 + roofSnowAmount() * 0.95);
    const cut = (u, v, t) => {
      // the point at fraction t down from the high edge, on the polygon's side
      const uu = along ? (high === 'u0' ? u0 + (u1 - u0) * t : u1 - (u1 - u0) * t) : u;
      const vv = along ? v : (high === 'v0' ? v0 + (v1 - v0) * t : v1 - (v1 - v0) * t);
      return P(uu, vv, z(uu, vv));
    };
    const hi = along ? [[high === 'u0' ? u0 : u1, v0], [high === 'u0' ? u0 : u1, v1]] : [[u0, high === 'v0' ? v0 : v1], [u1, high === 'v0' ? v0 : v1]];
    poly(ctx, [P(hi[0][0], hi[0][1], zHigh), P(hi[1][0], hi[1][1], zHigh), cut(hi[1][0], hi[1][1], f), cut(hi[0][0], hi[0][1], f)], '#e2e9ef');
  }
}
