/**
 * monumentArt.js
 * ----------------------------------------------------------------------------
 * Procedural art for the monuments (data/monuments.js) and their Work Camp,
 * all original:
 *
 *   Fanum          a terraced hillside sanctuary: three terraces stepping up
 *                  the slope, colonnades along each, a stair up the middle,
 *                  a curved colonnade and a temple at the top. Each god's in
 *                  its own roof, colors and emblem, and its pieces in front
 *                  (Ceres sheaves of wheat, Neptune a trident in a basin,
 *                  Mercury the caduceus and the winged hat, Mars spears and
 *                  shields, Venus roses and doves).
 *   Pantheum       a rotunda under a stepped, coffered dome with an oculus,
 *                  behind a deep columned portico with a pediment.
 *   Pharus         a stepped tower on a stone mole out over the water: a
 *                  square storey, an eight-sided one, a round lantern with
 *                  the fire burning in it and a figure on top.
 *   Mansio Magna   a walled road station round a courtyard: a gatehouse, the
 *                  inn along the back, stables, colonnades, mules and a cart.
 *   Thermae        a vaulted bath block on its furnaces: a domed hot hall,
 *                  two vaulted wings with great half-round windows, a pool
 *                  and an exercise court, smoke from the flues.
 *   Basilica       a long hall with a clerestory under a timber roof, a
 *                  columned front, an apse at its end and the magistrates'
 *                  tribunal before it.
 *   Work camp      timber sheds, a brick kiln, stacks of bricks, timber and
 *                  marble, an ox pen and the crew's tents.
 *
 * The art state is the monument's look (sim/monumentEffects.js
 * monumentLook): stage + 8 * side. `stage` is the stage under way while it is
 * a building site and the number of stages once it is finished; `side` is
 * the Pharus's water side (0 = -v, 1 = +u, 2 = +v, 3 = -u, as the docks').
 * A site shows what its finished stages built as finished masonry, the stage
 * under way half built inside timber scaffolding with a crane beside it,
 * and stacks of materials about; stage 0 shows the ground marked out with
 * stakes and lines and the foundation trenches dug.
 *
 * Every monument but the Pharus can be turned (render/turn.js): all of it is
 * drawn through footprint points, round parts as one piece about their axis
 * (revolve), so a turned drawing sorts and shades itself. The front (stair,
 * portico, gate) is on the +v face at turn 0, as every building's.
 * Painter's order at turn 0: back (small u + v) first, front last.
 * ----------------------------------------------------------------------------
 */

import { HALF_H } from '../config.js';
import { P, poly, quad, box, gableRoof, hipRoof, column, colonnade, windows, door, shade, cypress, hash01, horse } from './draw.js';
import { TS, unit, straight, decal, turnDir, turnRectNow, turnPointNow, mapping } from './turn.js';
import { turner, turnedRect } from './waterArt.js';
import { MONUMENT_TYPES } from '../data/monuments.js';
import { BUILDINGS } from '../data/buildings.js';
import { GODS } from '../data/gods.js';

const TAU = Math.PI * 2;
/** Px of height that look as long as a tile is deep: how a round outline's slope turns into its facing. */
const K = 2 * HALF_H;

const C = Object.freeze({
  earth: '#ad9570',
  trench: '#5c4530',
  trenchDeep: '#46331f',
  spoil: '#c4aa80',
  string: 'rgba(246,240,224,0.9)',
  stake: '#d8c49a',
  wood: '#8a5a33',
  woodDark: '#5e3b20',
  woodPale: '#c09060',
  rope: '#3a3026',
  brick: '#b0643e',
  brickDark: '#8e4b2c',
  stone: '#c8bea6',
  stoneDark: '#9a8f78',
  marble: '#f2eee6',
  stucco: '#ece2cc',
  terra: '#b8573a',
  terraDark: '#93432c',
  lead: '#9aa1a6',
  bronze: '#a8823a',
  gold: '#d9ae3e',
  glass: '#3a2f28',
  water: '#4f97c8',
  pool: '#62afd2',
  paving: '#d8cdb4',
  grass: '#7aa34e',
  sand: '#dcc58e',
  dark: '#3d332a',
});

/** Tunic colors of the builders on the scaffolds. */
const TUNICS = ['#b8573a', '#d8c79a', '#6b7f9a', '#8a6a4a', '#a8a07a'];

// ---------------------------------------------------------------------------
// The look from the art state
// ---------------------------------------------------------------------------

/**
 * The stage under way (the number of stages once finished), how many there
 * are and the water side, from a monument's art state.
 */
export function monumentStageOf(state, key) {
  const n = MONUMENT_TYPES[BUILDINGS[key]?.mon]?.stages.length || 1;
  const s = Math.max(0, Math.floor(Number(state) || 0));
  return { stage: Math.min(n, s % 8), n, side: Math.floor(s / 8) % 4 };
}

/**
 * How much of stage k a site at `stage` shows: 1 built, 0.5 half built (the
 * stage under way), 0 not begun.
 */
function builtShare(stage, k) {
  return stage > k ? 1 : stage === k ? 0.5 : 0;
}

// ---------------------------------------------------------------------------
// Pieces that turn with the building
// ---------------------------------------------------------------------------

/**
 * Draw `fn` as one piece of the drawing with its box u0..u1, v0..v1, z0..z1
 * given as the art is written: turned, the box is turned with it (round
 * things, figures and posts drawn through their own points).
 */
function solid(ctx, b, fn) {
  if (TS.rec && !TS.rec.depth) {
    const [a, c, da, dc] = turnRectNow(b[0], b[2], b[1] - b[0], b[3] - b[2]);
    unit([a, a + da, c, c + dc, b[4], b[5]], fn);
    return;
  }
  fn();
}

/** A figure or object standing at (u, v, z), `h` px tall and `r` tiles about: fn(x, y) draws it from its foot. */
function piece(ctx, u, v, z, h, r, fn) {
  solid(ctx, [u - r, u + r, v - r, v + r, z, z + h], () => {
    const [x, y] = P(u, v, z);
    fn(x, y);
  });
}

/** An upright pole (a scaffold standard, a stake) at (u, v) from z0 up h px. */
function pole(ctx, u, v, z0, h, color = C.wood, w = 1.1) {
  if (TS.rec && !TS.rec.depth) {
    const [a, b] = turnPointNow(u, v);
    unit([a, a, b, b, z0, z0 + h], () => straight(() => pole(ctx, a, b, z0, h, color, w)));
    return;
  }
  const [x, y] = P(u, v, z0);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y - h, w, h);
}

/** A straight timber or rope from footprint point a to b ([u, v, z] each), as one piece. */
function beam(ctx, a, b, color = C.woodDark, w = 1.2) {
  if (TS.rec && !TS.rec.depth) {
    const [au, av] = turnPointNow(a[0], a[1]);
    const [bu, bv] = turnPointNow(b[0], b[1]);
    unit([Math.min(au, bu), Math.max(au, bu), Math.min(av, bv), Math.max(av, bv), Math.min(a[2], b[2]), Math.max(a[2], b[2])],
      () => straight(() => beam(ctx, [au, av, a[2]], [bu, bv, b[2]], color, w)));
    return;
  }
  const p = P(a[0], a[1], a[2]);
  const q = P(b[0], b[1], b[2]);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(q[0], q[1]);
  ctx.stroke();
}

/**
 * Marks drawn on a box's wall (arches, bands, an inscription): `face`
 * 'left' is the +v face at v = v1 along u0..u1, 'right' the +u face at
 * u = u1. Turned, they go on whichever face of the same axis looks at the
 * viewer (as draw.js windows do), so a terrace keeps its arcade in front.
 * fn(at) draws through at(t, z): the point t (0..1) along the face, z up.
 */
function onFace(ctx, face, u0, v0, u1, v1, z0, z1, fn) {
  const turned = mapping() || TS.rec;
  let f = face;
  let a = u0;
  let b = v0;
  let c = u1;
  let d = v1;
  if (turned) {
    const [ta, tb, da, db] = turnRectNow(u0, v0, u1 - u0, v1 - v0);
    const n = face === 'left' ? turnDir(0, 1, TS.t) : turnDir(1, 0, TS.t);
    f = n[1] !== 0 ? 'left' : 'right';
    a = ta; b = tb; c = ta + da; d = tb + db;
  }
  const at = f === 'left' ? (t, z) => P(a + (c - a) * t, d, z) : (t, z) => P(c, b + (d - b) * t, z);
  if (!turned) { fn(at); return; }
  unit(f === 'left' ? [a, c, d, d, z0, z1] : [c, c, b, d, z0, z1], () => straight(() => fn(at)), f === 'left' ? [0, 1] : [1, 0]);
}

/** A row of `n` arched openings on a face (onFace), from z0 up h px. */
function arcade(ctx, face, u0, v0, u1, v1, z0, h, n, color = 'rgba(52,42,32,0.78)', o = {}) {
  onFace(ctx, face, u0, v0, u1, v1, z0, z0 + h, (at) => {
    const open = o.open ?? 0.56; // share of each bay that is opening
    for (let k = 0; k < n; k++) {
      const tm = (k + 0.5) / n;
      const hw = open / n / 2;
      const zs = z0 + (o.sill ?? 0);
      const zt = z0 + h * (o.spring ?? 0.66);
      const rise = h - (zt - z0) - (o.top ?? h * 0.08);
      const pts = [at(tm - hw, zs), at(tm + hw, zs), at(tm + hw, zt)];
      for (let j = 1; j < 6; j++) {
        const a = (Math.PI * j) / 6;
        pts.push(at(tm + hw * Math.cos(a), zt + rise * Math.sin(a)));
      }
      pts.push(at(tm - hw, zt));
      poly(ctx, pts, color);
    }
  });
}

/** A colored band along a face (a painted frieze, a string course). */
function band(ctx, face, u0, v0, u1, v1, z, h, color) {
  onFace(ctx, face, u0, v0, u1, v1, z, z + h, (at) => {
    poly(ctx, [at(0, z), at(1, z), at(1, z + h), at(0, z + h)], color);
  });
}

// ---------------------------------------------------------------------------
// Round things: solids of revolution
// ---------------------------------------------------------------------------

/** Signed area of a screen polygon (y down): positive when it faces the viewer, as revolve() builds its bands. */
function signedArea(q) {
  let s = 0;
  for (let i = 0; i < q.length; i++) {
    const a = q[i];
    const b = q[(i + 1) % q.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

const clampShade = (x) => Math.max(-0.62, Math.min(0.42, x));

/** Fill a quad of screen points, its edge stroked (the seams of a dome's coffers, or its own color to close hairline gaps). */
function fillQuad(ctx, q, fill, lines) {
  ctx.beginPath();
  ctx.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = lines || fill;
  ctx.lineWidth = lines ? 0.45 : 0.35;
  ctx.stroke();
}

/** Points of a level circle (u, v, radius r tiles, height z) through P(). */
function circlePts(u, v, r, z, n = 28, a0 = 0) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = a0 + (k * TAU) / n;
    out.push(P(u + Math.cos(a) * r, v + Math.sin(a) * r, z));
  }
  return out;
}

/**
 * The surface of revolution about the upright axis at (u, v): `prof` is its
 * outline as [radius (tiles), height (px)] from the bottom up (a drum, a
 * dome, a cone, a flight of round steps). Only the bands that face the
 * viewer are painted, each shaded by the way it faces after the turn, so the
 * same call draws right at every turn. o: seg (bands round; 8 with a0 =
 * PI/8 makes an eight-sided prism), a0/a1 (an arc only: an apse), lines
 * (seams: a dome's coffers), tone (added shade).
 */
function revolveRaw(ctx, u, v, prof, color, o = {}) {
  const seg = o.seg || 28;
  const a0 = o.a0 ?? 0;
  const a1 = o.a1 ?? a0 + TAU;
  const ang = (k) => a0 + ((a1 - a0) * k) / seg;
  const rings = prof.map(([r, z]) => Array.from({ length: seg + 1 }, (_, k) => P(u + Math.cos(ang(k)) * r, v + Math.sin(ang(k)) * r, z)));
  for (let j = 0; j + 1 < prof.length; j++) {
    // The band's facing in the (radius, height) plane, a tile counting as K px.
    let nh = prof[j + 1][1] - prof[j][1];
    let nz = (prof[j][0] - prof[j + 1][0]) * K;
    const len = Math.hypot(nh, nz) || 1;
    nh /= len;
    nz /= len;
    for (let k = 0; k < seg; k++) {
      const q = [rings[j][k], rings[j][k + 1], rings[j + 1][k + 1], rings[j + 1][k]];
      if (signedArea(q) < 0.02) continue; // turned away (or edge on)
      const a = ang(k + 0.5);
      const s = nh < 0 ? -1 : 1; // an inner face looks toward the axis
      const [du, dv] = turnDir(Math.cos(a) * s, Math.sin(a) * s, TS.t);
      // Lit like a box: +v faces in the plain color, +u faces darker, tops brighter.
      const amt = Math.abs(nh) * (-0.1 + 0.1 * (dv - du)) + (nz > 0 ? nz * 0.18 : nz * 0.3) + (o.tone || 0);
      fillQuad(ctx, q, shade(color, clampShade(amt)), o.lines ? shade(color, clampShade(amt - 0.16)) : null);
    }
  }
}

/** The box that holds a revolved outline of radius r (an arc a0..a1 of it, if given), for sorting. */
function arcBounds(u, v, r, z0, z1, a0 = 0, a1 = TAU) {
  let u0 = Infinity; let u1 = -Infinity; let v0 = Infinity; let v1 = -Infinity;
  for (let k = 0; k <= 24; k++) {
    const a = a0 + ((a1 - a0) * k) / 24;
    for (const rr of [0, r]) {
      u0 = Math.min(u0, u + Math.cos(a) * rr); u1 = Math.max(u1, u + Math.cos(a) * rr);
      v0 = Math.min(v0, v + Math.sin(a) * rr); v1 = Math.max(v1, v + Math.sin(a) * rr);
    }
  }
  return [u0, u1, v0, v1, z0, z1];
}

/** revolveRaw as one piece of the drawing (see solid). */
function revolve(ctx, u, v, prof, color, o = {}) {
  const rmax = Math.max(...prof.map((p) => p[0]));
  const zs = prof.map((p) => p[1]);
  solid(ctx, arcBounds(u, v, rmax, Math.min(...zs), Math.max(...zs), o.a0, o.a1 ?? (o.a0 ?? 0) + TAU), () => revolveRaw(ctx, u, v, prof, color, o));
}

/** Is the outward direction at angle a (as written) turned toward the viewer? (> 0: yes) */
function facing(a) {
  const [du, dv] = turnDir(Math.cos(a), Math.sin(a), TS.t);
  return du + dv;
}

/**
 * Openings round a drum (windows, niches, a kiln's mouth): n of them at
 * angles a0 + (k + 0.5) * TAU / n, each w tiles wide and h px tall from z,
 * arched at the top; only those facing the viewer are drawn.
 */
function drumMarks(ctx, u, v, r, n, z, h, w, color, a0 = 0, arched = true) {
  const rr = r + 0.004;
  const at = (a, zz) => P(u + Math.cos(a) * rr, v + Math.sin(a) * rr, zz);
  for (let k = 0; k < n; k++) {
    const a = a0 + ((k + 0.5) * TAU) / n;
    if (facing(a) < 0.45) continue;
    const da = w / rr / 2;
    const pts = [at(a - da, z), at(a + da, z), at(a + da, z + h)];
    if (arched) {
      for (let j = 1; j < 6; j++) {
        const t = j / 6;
        pts.push(at(a + da - 2 * da * t, z + h + Math.sin(Math.PI * t) * w * 9));
      }
    }
    pts.push(at(a - da, z + h));
    poly(ctx, pts, color);
  }
}

/** A line round a drum at height z (a string course, a cornice's shadow): the part facing the viewer. */
function ringLine(ctx, u, v, r, z, color, lw = 0.8) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  let pen = false;
  for (let k = 0; k <= 48; k++) {
    const a = (k * TAU) / 48;
    const p = P(u + Math.cos(a) * r, v + Math.sin(a) * r, z);
    if (facing(a) >= -0.05) {
      if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      pen = true;
    } else pen = false;
  }
  ctx.stroke();
}

/** A dome's outline: radius r tiles springing at z0, rising h px; `upTo` (0..1) of its rise built; `oculus` (0..1) leaves a hole that wide at the top. */
function domeProf(r, z0, h, upTo = 1, oculus = 0, n = 7) {
  const top = oculus ? Math.acos(oculus) : Math.PI / 2;
  const end = Math.min(top, Math.asin(Math.min(1, upTo)));
  const out = [];
  for (let j = 0; j <= n; j++) {
    const phi = (end * j) / n;
    out.push([r * Math.cos(phi), z0 + h * Math.sin(phi)]);
  }
  return out;
}

/**
 * A ring of scaffolding round a drum or tower (radius r) from z0 to z1:
 * poles and ledgers on the side away from the viewer (front false) or
 * toward it (front true), so a round piece can be drawn between the two.
 */
function ringScaffoldRaw(ctx, u, v, r, z0, z1, front) {
  const n = 12;
  const rr = r + 0.13;
  const at = (a, z) => P(u + Math.cos(a) * rr, v + Math.sin(a) * rr, z);
  const angle = (k) => (k * TAU) / n + 0.13;
  for (let k = 0; k < n; k++) {
    if ((facing(angle(k)) >= 0) !== front) continue;
    const [x, y] = at(angle(k), z0);
    ctx.fillStyle = C.wood;
    ctx.fillRect(x - 0.55, y - (z1 - z0), 1.1, z1 - z0);
  }
  ctx.strokeStyle = C.woodPale;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let z = z0 + 8; z <= z1 - 1; z += 8) {
    for (let k = 0; k < n; k++) {
      if ((facing((angle(k) + angle(k + 1)) / 2) >= 0) !== front) continue;
      const p = at(angle(k), z);
      const q = at(angle(k + 1), z);
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    }
  }
  ctx.stroke();
}

/**
 * A drum still open at the top (a wall being raised, or waiting for its
 * dome): the dark inside, the far wall's inner face, the outer wall and the
 * top of the wall, `wall` tiles thick. Raw: inside a solid().
 */
function hollowDrumRaw(ctx, u, v, r, wall, z0, h, color, o = {}) {
  const zt = z0 + h;
  poly(ctx, circlePts(u, v, r - wall, zt), '#4a3e31');
  revolveRaw(ctx, u, v, [[r - wall, zt], [r - wall, Math.max(z0, zt - 30)]], color, { tone: -0.3 });
  revolveRaw(ctx, u, v, [[r, z0], [r, zt]], color, o);
  revolveRaw(ctx, u, v, [[r, zt], [r - wall, zt]], color);
}

/**
 * A dome being raised: the part built, open at the top, and the timber
 * centering that carries it, a cage of ribs in the dome's own shape.
 */
function domeBuildingRaw(ctx, u, v, r, z0, h, upTo, color) {
  const phi = Math.asin(upTo);
  const rc = r * Math.cos(phi);
  const zc = z0 + h * upTo;
  const ribs = (front) => {
    ctx.strokeStyle = front ? C.wood : C.woodDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k * TAU) / 10 + 0.3;
      if ((facing(a) >= 0) !== front) continue;
      for (let j = 0; j <= 6; j++) {
        const p = phi + ((Math.PI / 2 - phi) * j) / 6;
        const q = P(u + Math.cos(a) * r * Math.cos(p), v + Math.sin(a) * r * Math.cos(p), z0 + h * Math.sin(p));
        if (j) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
      }
    }
    ctx.stroke();
  };
  poly(ctx, circlePts(u, v, rc - 0.1, zc), '#4a3e31');
  ribs(false);
  revolveRaw(ctx, u, v, domeProf(r, z0, h, upTo), color, { lines: true });
  revolveRaw(ctx, u, v, [[rc, zc], [rc - 0.1, zc]], color);
  ribs(true);
  ringLine(ctx, u, v, r * Math.cos(phi + (Math.PI / 2 - phi) * 0.5), z0 + h * Math.sin(phi + (Math.PI / 2 - phi) * 0.5), C.woodPale, 1);
}

// ---------------------------------------------------------------------------
// The building site
// ---------------------------------------------------------------------------

/** Trampled earth over the whole site, with churned patches and spilt mortar. */
function siteGround(ctx, S, seed = 1) {
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, C.earth);
  for (let k = 0; k < S * 4; k++) {
    const u = 0.15 + hash01(seed, k, 1) * (S - 0.5);
    const v = 0.15 + hash01(seed, k, 2) * (S - 0.5);
    const s = 0.08 + hash01(seed, k, 3) * 0.2;
    quad(ctx, u, v, u + s, v + s * 0.7, 0, k % 3 ? 'rgba(92,68,42,0.2)' : 'rgba(238,230,212,0.4)');
  }
}

/** The four sides of a rectangle's frame, w wide: [u0, v0, u1, v1] each. */
function frame(u0, v0, u1, v1, w) {
  return [[u0, v0, u1, v0 + w], [u0, v1 - w, u1, v1], [u0, v0 + w, u0 + w, v1 - w], [u1 - w, v0 + w, u1, v1 - w]];
}

/** Foundation trenches dug round a rectangle, the spoil heaped along their outer edge. */
function trenchRect(ctx, u0, v0, u1, v1, w = 0.2) {
  for (const [a, b, c, d] of frame(u0 - 0.08, v0 - 0.08, u1 + 0.08, v1 + 0.08, 0.1)) quad(ctx, a, b, c, d, 0, C.spoil);
  for (const [a, b, c, d] of frame(u0, v0, u1, v1, w)) {
    quad(ctx, a, b, c, d, 0, C.trench);
    quad(ctx, a, b, a + (c - a) * (c - a < w + 0.01 ? 0.45 : 1), b + (d - b) * (d - b < w + 0.01 ? 0.45 : 1), 0, C.trenchDeep);
  }
}

/** A ring of foundation trench (a rotunda's), the spoil round its outer edge. */
function trenchRing(ctx, u, v, r, w = 0.22) {
  solid(ctx, [u - r - 0.1, u + r + 0.1, v - r - 0.1, v + r + 0.1, 0, 0], () => {
    for (const [r0, r1, color] of [[r + 0.1, r - w - 0.06, C.spoil], [r, r - w, C.trench], [r - w * 0.45, r - w, C.trenchDeep]]) {
      ctx.beginPath();
      for (const rr of [r0, r1]) {
        const pts = circlePts(u, v, rr, 0, 32);
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) ctx.lineTo(p[0], p[1]);
        ctx.closePath();
      }
      ctx.fillStyle = color;
      ctx.fill('evenodd');
    }
  });
}

/** A plan staked out: a stake at each corner and a line from one to the next. */
function stakeOut(ctx, pts, z = 4) {
  for (let k = 0; k < pts.length; k++) {
    const [u, v] = pts[k];
    const [u2, v2] = pts[(k + 1) % pts.length];
    beam(ctx, [u, v, z], [u2, v2, z], C.string, 0.5);
  }
  for (const [u, v] of pts) pole(ctx, u, v, 0, z + 2.5, C.stake, 1.3);
}

/** Timber scaffolding round a box: the two far sides ('back') or the two near ones with a ladder ('front'). */
function scaffold(ctx, u0, v0, du, dv, z0, z1, part) {
  const g = 0.09;
  const a = u0 - g;
  const b = v0 - g;
  const c = u0 + du + g;
  const d = v0 + dv + g;
  const nu = Math.max(1, Math.round((c - a) / 0.5));
  const nv = Math.max(1, Math.round((d - b) / 0.5));
  const h = z1 - z0;
  const lifts = [];
  for (let z = z0 + 9; z <= z1 - 1; z += 9) lifts.push(z);
  const plank = (pu, pv, lu, lv, z) => box(ctx, pu, pv, lu, lv, z, 1.1, C.woodPale, { plain: true });
  if (part === 'back') {
    for (let k = 0; k <= nu; k++) pole(ctx, a + ((c - a) * k) / nu, b, z0, h);
    for (let k = 1; k <= nv; k++) pole(ctx, a, b + ((d - b) * k) / nv, z0, h);
    for (const z of lifts) {
      plank(a, b - 0.03, c - a, 0.06, z);
      plank(a - 0.03, b, 0.06, d - b, z);
    }
    return;
  }
  for (let k = 1; k <= nv; k++) pole(ctx, c, b + ((d - b) * k) / nv, z0, h);
  for (let k = 1; k < nu; k++) pole(ctx, a + ((c - a) * k) / nu, d, z0, h);
  for (const z of lifts) {
    plank(c - 0.03, b, 0.06, d - b, z);
    plank(a, d - 0.03, c - a, 0.06, z);
  }
  ladder(ctx, a + (c - a) * 0.28, d + 0.03, z0, Math.min(z1, z0 + 30));
}

/** A ladder against the front of a scaffold (on the plane v = v), from z0 up to z1. */
function ladder(ctx, u, v, z0, z1) {
  ctx.strokeStyle = C.woodDark;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (const du of [-0.05, 0.05]) {
    const p = P(u + du, v, z0);
    const q = P(u + du, v, z1);
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  }
  for (let z = z0 + 2.5; z < z1; z += 2.8) {
    const p = P(u - 0.05, v, z);
    const q = P(u + 0.05, v, z);
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
}

/** A wall or block raised to share f (1: whole) of its height; half built, one course laid further along the far half. */
function riseBox(ctx, u0, v0, du, dv, z0, h, color, f, o = {}) {
  if (f >= 1) { box(ctx, u0, v0, du, dv, z0, h, color, o); return; }
  const hh = Math.round(h * f);
  box(ctx, u0, v0, du, dv, z0, hh, color, o);
  box(ctx, u0, v0, du * 0.5, dv * 0.6, z0 + hh, Math.min(4, h * 0.15), shade(color, 0.04), o);
}

/**
 * The walls of a hall not yet roofed, `h` px from z0 round u0..u1 by
 * v0..v1, so its floor shows: the far two walls, the floor and what stands
 * inside it (inside()), then the near two.
 */
function hallShell(ctx, u0, v0, u1, v1, z0, h, color, inside) {
  const t = 0.12;
  box(ctx, u0, v0, u1 - u0, t, z0, h, color);
  box(ctx, u0, v0 + t, t, v1 - v0 - 2 * t, z0, h, color);
  quad(ctx, u0 + t, v0 + t, u1 - t, v1 - t, z0 + 0.1, '#8a7860');
  inside();
  box(ctx, u1 - t, v0 + t, t, v1 - v0 - 2 * t, z0, h, color);
  box(ctx, u0, v1 - t, u1 - u0, t, z0, h, color);
}

/** A builder at work, standing at (u, v, z). */
function worker(ctx, u, v, z, k = 0) {
  piece(ctx, u, v, z, 8, 0.05, (x, y) => {
    ctx.fillStyle = '#4e3a2a';
    ctx.fillRect(x - 1, y - 1.8, 0.8, 1.8);
    ctx.fillRect(x + 0.2, y - 1.8, 0.8, 1.8);
    ctx.fillStyle = TUNICS[k % TUNICS.length];
    ctx.fillRect(x - 1.2, y - 5.4, 2.4, 3.8);
    ctx.fillStyle = '#d8a985';
    ctx.beginPath(); ctx.arc(x, y - 6.6, 1.25, 0, TAU); ctx.fill();
  });
}

/** A pallet of clay bricks, stacked in courses. */
function bricks(ctx, u, v, n = 3) {
  box(ctx, u, v, 0.34, 0.26, 0, 1.4, C.woodDark, { plain: true });
  for (let k = 0; k < n; k++) box(ctx, u + 0.02, v + 0.02, 0.3, 0.22, 1.4 + k * 2.6, 2.6, k % 2 ? '#b8683f' : '#a95b36', { plain: true, stroke: '#7a3c22' });
}

/** A stack of logs, their cut ends on the +u side. */
function logs(ctx, u, v, len = 0.62) {
  box(ctx, u, v, len, 0.3, 0, 7, '#8e6438', { plain: true, top: '#a77a48' });
  decal(1, 0, () => {
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < 3 - r; k++) {
        const [x, y] = P(u + len, v + 0.07 + k * 0.09 + r * 0.045, 1.9 + r * 3.4);
        ctx.fillStyle = '#d6b07a';
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#7a5530';
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }
    }
  });
}

/** Sawn planks and beams, stacked crosswise. */
function planks(ctx, u, v) {
  for (let k = 0; k < 4; k++) box(ctx, u, v, 0.6, 0.24, k * 1.8, 1.8, k % 2 ? C.woodPale : '#a57a4a', { plain: true });
}

/** Blocks of marble waiting to be dressed. */
function marbleBlocks(ctx, u, v) {
  box(ctx, u, v, 0.3, 0.24, 0, 6, '#e9e3d6');
  box(ctx, u + 0.34, v + 0.04, 0.22, 0.2, 0, 5, '#dfd9cc');
  box(ctx, u + 0.04, v + 0.02, 0.2, 0.18, 6, 4, '#f4f0e8');
}

/** Amphorae of wine and oil for a dedication, in two rows. */
function jars(ctx, u, v) {
  for (let k = 0; k < 6; k++) {
    const uu = u + (k % 3) * 0.11 + (k >= 3 ? 0.05 : 0);
    const vv = v + (k >= 3 ? 0.12 : 0);
    const color = k % 2 ? '#b89a46' : '#8a3a2a';
    piece(ctx, uu, vv, 0, 9, 0.05, (x, y) => {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x - 1, y - 0.5, 3.5, 1);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(x, y - 3.4, 2, 3.2, 0, 0, TAU); ctx.fill();
      ctx.fillRect(x - 0.8, y - 8, 1.6, 2);
      ctx.fillStyle = shade(color, 0.25);
      ctx.fillRect(x - 1.3, y - 5, 0.8, 2.2);
    });
  }
}

/**
 * A crane at (u, v, z0): a treadwheel at its foot, two legs leaning out to
 * its head `h` px up in the direction (du, dv), a stay back to the ground
 * and a stone hanging on its rope down to `loadZ` (no wheel: shear legs).
 * Kept beside the work rather than over it, so it sorts behind or before it
 * whole at every turn.
 */
function crane(ctx, u, v, z0, du, dv, h, loadZ, wheel = true) {
  const L = Math.hypot(du, dv) || 1;
  const ux = du / L;
  const vx = dv / L;
  const head = [u + ux * 0.32, v + vx * 0.32, z0 + h];
  beam(ctx, [u - ux * 0.42, v - vx * 0.42, z0], head, C.rope, 0.6); // the stay
  if (wheel) {
    // The treadwheel, standing in the plane of the legs' lean.
    const R = 7;
    const ring = (rr) => {
      const pts = [];
      for (let k = 0; k <= 20; k++) {
        const a = (k * TAU) / 20;
        const t = (Math.cos(a) * rr) / 36;
        pts.push(P(u - ux * 0.12 + ux * t, v - vx * 0.12 + vx * t, z0 + R + Math.sin(a) * rr));
      }
      return pts;
    };
    const outer = ring(R);
    const inner = ring(R - 1.6);
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    outer.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    inner.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    for (let k = 0; k < 20; k += 4) {
      ctx.moveTo(inner[k][0], inner[k][1]);
      ctx.lineTo(inner[k + 10 > 20 ? k - 10 : k + 10][0], inner[k + 10 > 20 ? k - 10 : k + 10][1]);
    }
    ctx.stroke();
  }
  for (const s of [-1, 1]) beam(ctx, [u - vx * 0.11 * s, v + ux * 0.11 * s, z0], head, C.woodDark, 1.4);
  beam(ctx, head, [head[0], head[1], loadZ + 3], C.rope, 0.6);
  box(ctx, head[0] - 0.07, head[1] - 0.07, 0.14, 0.14, loadZ, 3, '#d8d0c0', { plain: true });
}

/** A small round fountain basin or well head at (u, v): stone rim, water inside. */
function basin(ctx, u, v, r, h, rim = C.marble, water = C.pool) {
  solid(ctx, [u - r, u + r, v - r, v + r, 0, h], () => {
    revolveRaw(ctx, u, v, [[r, 0], [r, h], [r - 0.05, h]], rim, { seg: 20 });
    poly(ctx, circlePts(u, v, r - 0.05, h - 0.6, 20), water);
  });
}

/** A wisp of smoke rising from (u, v, z) and drifting to the right with the wind. */
function smoke(ctx, u, v, z, dark = false) {
  piece(ctx, u, v, z, 26, 0.1, (x, y) => {
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = dark ? `rgba(70,64,60,${0.32 - k * 0.06})` : `rgba(226,224,220,${0.5 - k * 0.1})`;
      ctx.beginPath(); ctx.arc(x + k * 2.4, y - 3 - k * 5.5, 2 + k * 1.1, 0, TAU); ctx.fill();
    }
  });
}

/** A gilded figure on a little pedestal, on a building or the ground at (u, v, z). */
function giltFigure(ctx, u, v, z, s = 1) {
  piece(ctx, u, v, z, 16 * s, 0.08, (x, y) => {
    ctx.fillStyle = C.stoneDark;
    ctx.fillRect(x - 2 * s, y - 3 * s, 4 * s, 3 * s);
    ctx.fillStyle = C.gold;
    ctx.fillRect(x - 1.1 * s, y - 10 * s, 2.2 * s, 7 * s);
    ctx.beginPath(); ctx.arc(x, y - 11.3 * s, 1.4 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(C.gold, -0.25);
    ctx.fillRect(x + 1.1 * s, y - 12 * s, 0.7 * s, 8 * s);
  });
}

/** A flight of steps from the platform's edge at v0 (z1) down to v1 (z0), across u0..u1. */
function stairs(ctx, u0, u1, v0, v1, z0, z1, n, color) {
  const dv = (v1 - v0) / n;
  const dz = (z1 - z0) / n;
  for (let k = 0; k < n; k++) box(ctx, u0, v0, u1 - u0, v1 - v0 - k * dv, z0 + k * dz, dz, shade(color, k % 2 ? 0.05 : 0), { plain: true });
}

/** A pediment on a gable facing +v at v (from u0 to u1, its foot at z, rising `rise`), with an emblem drawn by fn(x, y). */
function pediment(ctx, u0, u1, v, z, rise, fill, fn = null) {
  decal(0, 1, () => {
    poly(ctx, [P(u0, v, z), P(u1, v, z), P((u0 + u1) / 2, v, z + rise)], fill, shade(fill, -0.4), 0.6);
    ctx.strokeStyle = shade(fill, 0.25);
    ctx.lineWidth = 0.8;
    const a = P(u0, v, z);
    const b = P(u1, v, z);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    if (fn) {
      const [x, y] = P((u0 + u1) / 2, v, z + rise * 0.36);
      fn(x, y);
    }
  });
}

/**
 * Bare roof trusses over a hall u0..u1 by v0..v1, from z rising rh, the
 * ridge along u (axis 'u') or along v: a roof being framed.
 */
function trusses(ctx, u0, u1, v0, v1, z, rh, step = 0.42, axis = 'u') {
  // (Written for a ridge along u; along v the two axes swap.)
  const at = axis === 'u' ? (a, b, zz) => [a, b, zz] : (a, b, zz) => [b, a, zz];
  const [a0, a1, b0, b1] = axis === 'u' ? [u0, u1, v0, v1] : [v0, v1, u0, u1];
  const bm = (b0 + b1) / 2;
  for (let a = a0 + 0.05; a <= a1; a += step) {
    beam(ctx, at(a, b0, z), at(a, bm, z + rh), C.wood, 1.1);
    beam(ctx, at(a, b1, z), at(a, bm, z + rh), C.wood, 1.1);
    beam(ctx, at(a, b0, z + 0.5), at(a, b1, z + 0.5), C.woodDark, 0.9);
  }
  beam(ctx, at(a0, bm, z + rh), at(a1, bm, z + rh), C.woodDark, 1.2);
}

// ---------------------------------------------------------------------------
// The gods' emblems and pieces (the Fanum)
// ---------------------------------------------------------------------------

/** Each god's sanctuary: roof, walls, the god's color (GODS[g].color) and pieces. */
const FANUM_LOOKS = Object.freeze({
  ceres: { roof: '#c98f3a', wall: '#ede1c4', accent: GODS.ceres.color, cloth: '#e3b93c', emblem: 'wheat' },
  neptune: { roof: '#3f8f86', wall: '#e1eae7', accent: GODS.neptune.color, cloth: '#3aa39a', emblem: 'trident' },
  mercury: { roof: '#8f8aa6', wall: '#e8e2d4', accent: GODS.mercury.color, cloth: '#8a70c8', emblem: 'caduceus' },
  mars: { roof: '#7a2a22', wall: '#ddc8b4', accent: GODS.mars.color, cloth: '#b5302a', emblem: 'shield' },
  venus: { roof: '#d9909c', wall: '#f5e8e8', accent: GODS.venus.color, cloth: '#ec94b4', emblem: 'dove' },
});

/** A god's emblem, about 9 px tall at s = 1, centered at (x, y). */
function godEmblem(ctx, kind, x, y, s = 1) {
  ctx.lineCap = 'round';
  switch (kind) {
    case 'wheat': // Ceres: a sheaf
      ctx.strokeStyle = '#f5df8a';
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      for (const dx of [-2, -0.7, 0.7, 2]) { ctx.moveTo(x, y + 4 * s); ctx.lineTo(x + dx * s, y - 1.6 * s); }
      ctx.stroke();
      ctx.fillStyle = '#f5df8a';
      for (const dx of [-2, -0.7, 0.7, 2]) { ctx.beginPath(); ctx.ellipse(x + dx * s, y - 2.8 * s, 0.8 * s, 1.6 * s, 0, 0, TAU); ctx.fill(); }
      break;
    case 'trident': // Neptune
      ctx.strokeStyle = '#eef3f5';
      ctx.lineWidth = 0.9 * s;
      ctx.beginPath();
      ctx.moveTo(x, y + 4 * s); ctx.lineTo(x, y - 4 * s);
      ctx.moveTo(x - 2.4 * s, y - 1 * s); ctx.lineTo(x + 2.4 * s, y - 1 * s);
      ctx.moveTo(x - 2.4 * s, y - 1 * s); ctx.lineTo(x - 2.4 * s, y - 3.6 * s);
      ctx.moveTo(x + 2.4 * s, y - 1 * s); ctx.lineTo(x + 2.4 * s, y - 3.6 * s);
      ctx.stroke();
      break;
    case 'caduceus': // Mercury: a winged staff with two snakes
      ctx.strokeStyle = '#f0d98a';
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      ctx.moveTo(x, y + 4 * s); ctx.lineTo(x, y - 3.6 * s);
      ctx.moveTo(x, y - 2.8 * s); ctx.lineTo(x - 2.8 * s, y - 4 * s);
      ctx.moveTo(x, y - 2.8 * s); ctx.lineTo(x + 2.8 * s, y - 4 * s);
      ctx.moveTo(x - 1.4 * s, y + 2.6 * s); ctx.quadraticCurveTo(x + 1.9 * s, y + 1 * s, x - 1.4 * s, y - 0.6 * s);
      ctx.moveTo(x + 1.4 * s, y + 2.6 * s); ctx.quadraticCurveTo(x - 1.9 * s, y + 1 * s, x + 1.4 * s, y - 0.6 * s);
      ctx.stroke();
      break;
    case 'shield': // Mars: a round shield over a spear
      ctx.strokeStyle = '#e8d6a8';
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath(); ctx.moveTo(x - 3.4 * s, y + 3.6 * s); ctx.lineTo(x + 3.4 * s, y - 3.6 * s); ctx.stroke();
      ctx.fillStyle = '#e0b04c';
      ctx.beginPath(); ctx.arc(x, y, 2.8 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a5a2a';
      ctx.beginPath(); ctx.arc(x, y, 1 * s, 0, TAU); ctx.fill();
      break;
    case 'dove': // Venus: a dove with its wings up
      ctx.fillStyle = '#fbeff3';
      ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 2.6 * s, 1.3 * s, -0.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 0.6 * s, y + 0.4 * s); ctx.lineTo(x - 2.6 * s, y - 3 * s); ctx.lineTo(x + 0.8 * s, y - 0.2 * s); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 2.4 * s, y + 0.2 * s, 0.9 * s, 0, TAU); ctx.fill();
      break;
    default:
      break;
  }
  ctx.lineCap = 'butt';
}

/** A rose bush in flower at (u, v). */
function roseBush(ctx, u, v) {
  piece(ctx, u, v, 0, 12, 0.14, (x, y) => {
    ctx.fillStyle = '#466f34';
    ctx.beginPath(); ctx.arc(x, y - 5, 5.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5f8f46';
    ctx.beginPath(); ctx.arc(x - 1.6, y - 6.8, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ee7ca4';
    for (const [rx, ry] of [[-2.6, -7.4], [2, -6.8], [0, -3.4], [3.4, -3.2], [-3.6, -3.6], [0.6, -9]]) { ctx.beginPath(); ctx.arc(x + rx, y + ry, 1.2, 0, TAU); ctx.fill(); }
  });
}

/** A dove perched at (x, y), facing right (f 1) or left (-1). */
function dove(ctx, x, y, f = 1) {
  ctx.fillStyle = '#f7f2f0';
  ctx.beginPath(); ctx.ellipse(x, y - 1.4, 2, 1.2, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + f * 1.9, y - 2.4, 0.9, 0, TAU); ctx.fill();
  ctx.fillStyle = '#c9c0bc';
  ctx.beginPath(); ctx.ellipse(x - f * 0.4, y - 1.6, 1.2, 0.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d98a4a';
  ctx.fillRect(x + f * 2.6 - 0.4, y - 2.5, 0.8, 0.5);
}

/**
 * The god's piece standing in front of a Fanum at (u, v): `which` 0 on the
 * left of the stair, 1 on the right.
 */
function godPiece(ctx, god, u, v, which) {
  const L = FANUM_LOOKS[god] || FANUM_LOOKS.ceres;
  switch (god) {
    case 'ceres': // a golden sheaf of wheat on a pedestal, baskets of grain at its foot
      box(ctx, u - 0.14, v - 0.14, 0.28, 0.28, 0, 6, C.marble);
      piece(ctx, u, v, 6, 20, 0.1, (x, y) => {
        ctx.strokeStyle = '#d9b347';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let k = -4; k <= 4; k++) { ctx.moveTo(x + k * 0.25, y - 1); ctx.lineTo(x + k * 1.2, y - 15); }
        ctx.stroke();
        ctx.fillStyle = '#f0cf5a';
        for (let k = -4; k <= 4; k++) { ctx.beginPath(); ctx.ellipse(x + k * 1.25, y - 16.5, 0.9, 2, k * 0.08, 0, TAU); ctx.fill(); }
        ctx.fillStyle = C.gold;
        ctx.fillRect(x - 2.2, y - 8, 4.4, 1.6); // the band that ties it
      });
      piece(ctx, u + 0.2, v + 0.18, 0, 6, 0.08, (x, y) => {
        ctx.fillStyle = '#8a6030';
        ctx.fillRect(x - 2.5, y - 4, 5, 4);
        ctx.fillStyle = '#e8c25a';
        ctx.beginPath(); ctx.ellipse(x, y - 4.4, 2.6, 1.2, 0, 0, TAU); ctx.fill();
      });
      break;
    case 'neptune': // a basin of water with a bronze trident standing in it
      basin(ctx, u, v, 0.24, 5, C.marble, C.pool);
      piece(ctx, u, v, 4, 26, 0.05, (x, y) => {
        ctx.strokeStyle = '#4f7f6a';
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x, y - 24);
        ctx.moveTo(x - 3.2, y - 18); ctx.lineTo(x + 3.2, y - 18);
        ctx.moveTo(x - 3.2, y - 18); ctx.lineTo(x - 3.2, y - 23);
        ctx.moveTo(x + 3.2, y - 18); ctx.lineTo(x + 3.2, y - 23);
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.fillStyle = 'rgba(220,240,250,0.7)'; // a jet of water at its foot
        ctx.beginPath(); ctx.ellipse(x, y - 1.5, 3.4, 1.4, 0, 0, TAU); ctx.fill();
      });
      break;
    case 'mercury': // the caduceus on the left, the winged hat on the right
      box(ctx, u - 0.13, v - 0.13, 0.26, 0.26, 0, 8, C.marble);
      piece(ctx, u, v, 8, 18, 0.08, (x, y) => {
        if (!which) {
          godEmblem(ctx, 'caduceus', x, y - 10, 2.6);
        } else {
          // the petasos: a round brimmed hat with a little wing each side
          ctx.fillStyle = '#c9a94a';
          ctx.beginPath(); ctx.ellipse(x, y - 3, 6, 2, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#e0c15e';
          ctx.beginPath(); ctx.ellipse(x, y - 5, 3.2, 3, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#f6f1e6';
          for (const f of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(x + f * 3, y - 5);
            ctx.lineTo(x + f * 8, y - 10);
            ctx.lineTo(x + f * 7.4, y - 7.6);
            ctx.lineTo(x + f * 8.4, y - 7.2);
            ctx.lineTo(x + f * 4, y - 3.6);
            ctx.closePath();
            ctx.fill();
          }
        }
      });
      break;
    case 'mars': // a trophy: crossed spears behind a round shield, a crested helmet on top
      box(ctx, u - 0.13, v - 0.13, 0.26, 0.26, 0, 5, C.stoneDark);
      piece(ctx, u, v, 5, 26, 0.08, (x, y) => {
        ctx.strokeStyle = '#6a4a2a';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x - 6, y); ctx.lineTo(x + 5, y - 24);
        ctx.moveTo(x + 6, y); ctx.lineTo(x - 5, y - 24);
        ctx.stroke();
        ctx.fillStyle = '#c9ccd0';
        for (const f of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + f * 5, y - 24); ctx.lineTo(x + f * 4, y - 28); ctx.lineTo(x + f * 6, y - 25); ctx.fill(); }
        ctx.fillStyle = L.accent;
        ctx.beginPath(); ctx.arc(x, y - 10, 5.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.fillStyle = C.gold;
        ctx.beginPath(); ctx.arc(x, y - 10, 1.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#b8903a';
        ctx.beginPath(); ctx.arc(x, y - 17, 2.4, Math.PI, 0); ctx.fill();
        ctx.fillStyle = L.accent;
        ctx.fillRect(x - 0.6, y - 21.5, 1.2, 3);
      });
      break;
    case 'venus': // rose bushes about a pedestal with doves on it
      for (const [du, dv] of [[-0.2, -0.12], [0.2, -0.16]]) roseBush(ctx, u + du, v + dv);
      box(ctx, u - 0.1, v - 0.08, 0.2, 0.2, 0, 13, C.marble);
      piece(ctx, u, v + 0.02, 13, 6, 0.08, (x, y) => { dove(ctx, x - 2, y, 1); dove(ctx, x + 2.4, y + 0.6, -1); });
      roseBush(ctx, u - 0.18, v + 0.2);
      roseBush(ctx, u + 0.22, v + 0.16);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Fanum (5x5): the terraced sanctuary
// ---------------------------------------------------------------------------

/**
 * A terraced sanctuary after Praeneste. Stage 0 (foundations) the lowest
 * terrace and its stair; 1 (podium and sanctuary walls) the two upper
 * terraces, their stairs and the temple's podium and cella; 2 (colonnade
 * and roof) the colonnades along the terraces, the curved one at the top and
 * the temple's columns and roof; 3 (dedication) the god's colors and gilding,
 * the emblem on the pediment, the pieces in front and the cypresses.
 */
function fanumArt(ctx, S, variant, state, key) {
  const { stage, n } = monumentStageOf(state, key);
  const god = BUILDINGS[key]?.deity || 'ceres';
  const L = FANUM_LOOKS[god] || FANUM_LOOKS.ceres;
  const done = stage >= n;
  const f = (k) => builtShare(stage, k);
  const wall = L.wall;
  const deco = done; // the god's colors go on at the dedication
  if (done) {
    quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#d4c9ad');
    quad(ctx, 0.12, 4.3, 1.95, 4.92, 0, C.grass);
    quad(ctx, 3.05, 4.3, 4.88, 4.92, 0, C.grass);
  } else siteGround(ctx, S, 3);

  // --- 0: the lowest terrace and its stair -----------------------------------
  if (f(0) === 0.5) {
    trenchRect(ctx, 0.2, 0.2, 4.8, 4.2);
    trenchRect(ctx, 2.0, 4.2, 3.0, 4.88, 0.14);
    box(ctx, 0.2, 0.2, 4.6, 0.22, 0, 3, C.stone, { plain: true }); // footings laid along the back
    box(ctx, 0.2, 0.42, 0.22, 2.4, 0, 3, C.stone, { plain: true }); // and up the left
    stakeOut(ctx, [[0.45, 0.4], [4.55, 0.4], [4.55, 3.2], [0.45, 3.2]]);
    stakeOut(ctx, [[1.65, 0.75], [3.35, 0.75], [3.35, 2.15], [1.65, 2.15]]);
    worker(ctx, 1.4, 0.3, 0, 0);
    worker(ctx, 0.3, 1.9, 0, 2);
    worker(ctx, 3.3, 4.1, 0, 1);
  } else if (f(0) === 1) {
    box(ctx, 0.2, 0.2, 4.6, 4.0, 0, 16, wall);
    arcade(ctx, 'left', 0.2, 0.2, 2.0, 4.2, 0, 13, 4);
    arcade(ctx, 'left', 3.0, 0.2, 4.8, 4.2, 0, 13, 4);
    arcade(ctx, 'right', 0.2, 0.2, 4.8, 4.2, 0, 13, 8);
    if (deco) {
      band(ctx, 'left', 0.2, 0.2, 4.8, 4.2, 13.2, 2, L.accent);
      band(ctx, 'right', 0.2, 0.2, 4.8, 4.2, 13.2, 2, L.accent);
    }
  }

  // --- 1: the upper terraces (the stage under way: the second whole, the third rising)
  if (f(1) > 0) {
    box(ctx, 0.45, 0.4, 4.1, 2.8, 16, 16, wall);
    if (deco) band(ctx, 'right', 0.45, 0.4, 4.55, 3.2, 29.2, 2, L.accent);
    if (f(1) === 0.5) scaffold(ctx, 0.75, 0.6, 3.5, 1.7, 32, 46, 'back');
    riseBox(ctx, 0.75, 0.6, 3.5, 1.7, 32, 16, wall, f(1));
    if (f(1) === 1) {
      arcade(ctx, 'right', 0.75, 0.6, 4.25, 2.3, 32, 13, 4);
      if (deco) band(ctx, 'right', 0.75, 0.6, 4.25, 2.3, 45.2, 2, L.accent);
    }
  }

  // --- the temple at the top: podium and cella (1), the curved colonnade, columns and roof (2), gilding (3)
  if (f(2) > 0) {
    // The curved colonnade behind the temple.
    for (let k = 0; k <= 6; k++) {
      const a = Math.PI + (k * Math.PI) / 6;
      const h = f(2) === 1 || k % 2 ? 15 : 6;
      column(ctx, 2.5 + Math.cos(a) * 1.45, 1.5 + Math.sin(a) * 0.82, 48, h, C.marble, 1.6);
    }
  }
  if (f(1) === 1) {
    if (f(2) === 0.5) scaffold(ctx, 1.5, 0.72, 2.0, 1.5, 48, 90, 'back');
    box(ctx, 1.5, 0.72, 2.0, 1.5, 48, 5, C.stone);
    stairs(ctx, 2.05, 2.95, 2.22, 2.32, 48, 53, 2, C.stone);
    box(ctx, 1.72, 0.82, 1.56, 1.0, 53, 24, wall);
    door(ctx, 'left', 1.72, 0.82, 3.28, 1.82, 53, 0.5, '#5a4a3a', 0.3, 14);
  }
  if (f(2) > 0) {
    colonnade(ctx, 3.38, 0.86, 3.38, 1.74, 4, 53, 24, C.marble, 2);
    colonnade(ctx, 1.6, 2.08, 3.38, 2.08, 6, 53, 24, C.marble, 2);
    if (f(2) === 1) {
      box(ctx, 1.55, 0.76, 1.95, 1.4, 77, 2.5, C.marble, { plain: true });
      gableRoof(ctx, 1.55, 0.76, 1.95, 1.4, 79.5, 15, L.roof, 'v', 0.06);
      pediment(ctx, 1.57, 3.48, 2.22, 80, 13.5, deco ? L.accent : C.marble, deco ? (x, y) => godEmblem(ctx, L.emblem, x, y, 1.35) : null);
      if (deco) {
        giltFigure(ctx, 2.525, 2.22, 93.5, 1);
        giltFigure(ctx, 1.6, 2.22, 80, 0.75);
        giltFigure(ctx, 3.45, 2.22, 80, 0.75);
      }
    } else {
      trusses(ctx, 1.6, 3.45, 0.76, 2.16, 79.5, 14, 0.36, 'v');
      scaffold(ctx, 1.5, 0.72, 2.0, 1.5, 48, 90, 'front');
      worker(ctx, 2.1, 2.31, 66, 3);
    }
  }
  if (stage === 3) {
    // The dedication under way: the temple's front being faced and gilded.
    for (let k = 0; k < 4; k++) pole(ctx, 1.47 + k * 0.68, 2.36, 48, 44);
    for (const z of [64, 79]) box(ctx, 1.45, 2.33, 2.1, 0.06, z, 1.1, C.woodPale, { plain: true });
    worker(ctx, 2.8, 2.36, 80, 4);
  }

  // --- 2: the colonnades along the terraces (on the upper terrace first, then the lower)
  const stoa = (vCol, vBack, z, groups, cols) => {
    for (const [u0, u1] of groups) {
      // the walk behind the columns, in shade under the colonnade's roof
      if (f(2) === 1) band(ctx, 'left', u0 - 0.1, vBack - 0.4, u1 + 0.1, vBack, z, 16, 'rgba(40,28,18,0.42)');
      if (f(2) === 1 && deco) {
        // Swags of the god's cloth hung between the columns.
        decal(0, 1, () => {
          ctx.strokeStyle = L.cloth;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let k = 0; k < cols - 1; k++) {
            const a = P(u0 + ((u1 - u0) * k) / (cols - 1), vCol + 0.02, z + 13);
            const b = P(u0 + ((u1 - u0) * (k + 1)) / (cols - 1), vCol + 0.02, z + 13);
            ctx.moveTo(a[0], a[1]);
            ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 4, b[0], b[1]);
          }
          ctx.stroke();
        });
      }
      for (let k = 0; k < cols; k++) {
        const h = f(2) === 1 || k % 2 === 0 ? 16 : 5;
        column(ctx, u0 + ((u1 - u0) * k) / (cols - 1), vCol, z, h, C.marble, 1.6);
      }
      if (f(2) === 1) {
        // the entablature on the columns and a low tiled roof over the walk
        box(ctx, u0 - 0.1, vBack, u1 - u0 + 0.2, vCol - vBack + 0.12, z + 16, 1.8, C.marble, { plain: true });
        gableRoof(ctx, u0 - 0.1, vBack, u1 - u0 + 0.2, vCol - vBack + 0.12, z + 17.8, 4, L.roof, 'u', 0.03);
      }
    }
  };
  if (f(2) > 0) stoa(2.6, 2.3, 32, [[0.9, 1.95], [3.05, 4.1]], 3);
  if (f(1) === 1) stairs(ctx, 2.1, 2.9, 2.3, 3.15, 32, 48, 7, shade(wall, -0.06));
  if (f(2) > 0) stoa(3.52, 3.2, 16, [[0.6, 1.9], [3.1, 4.4]], 4);
  if (f(1) > 0) stairs(ctx, 2.05, 2.95, 3.2, 4.05, 16, 32, 7, shade(wall, -0.06));
  if (f(0) === 1) stairs(ctx, 2.0, 3.0, 4.2, 4.9, 0, 16, 7, shade(wall, -0.06));
  if (f(1) === 0.5) {
    scaffold(ctx, 0.75, 0.6, 3.5, 1.7, 32, 46, 'front');
    worker(ctx, 1.4, 2.39, 41, 1);
    worker(ctx, 3.5, 2.39, 32, 2);
  }

  // --- the yard, or the god's pieces and cypresses once dedicated
  if (done) {
    cypress(ctx, 0.4, 4.55, 1.05);
    godPiece(ctx, god, 1.35, 4.58, 0);
    godPiece(ctx, god, 3.7, 4.58, 1);
    cypress(ctx, 4.62, 4.6, 1.05);
  } else {
    if (stage === 3) jars(ctx, 0.35, 4.4); else bricks(ctx, 0.4, 4.4);
    logs(ctx, 1.0, 4.42);
    if (stage >= 1) marbleBlocks(ctx, 3.2, 4.42); else planks(ctx, 3.25, 4.45);
    // the crane on the ground while the lowest terrace rises, then up on the second
    if (stage === 0) crane(ctx, 4.62, 4.55, 0, -1, -1, 24, 8);
    else crane(ctx, 4.42, 2.88, 32, -0.3, -1, stage === 1 ? 30 : 46, stage === 1 ? 42 : 62);
  }
}

// ---------------------------------------------------------------------------
// Pantheum (5x5): the rotunda
// ---------------------------------------------------------------------------

/** The rotunda's axis and radius, the dome's springing and rise. */
const PAN = Object.freeze({ u: 2.5, v: 1.85, r: 1.5, z0: 3, wall: 48, dome: 30 });

/**
 * The Pantheum: stage 0 the ring of foundations and the portico's podium;
 * 1 the drum walls and the block that joins the portico; 2 the portico's
 * columns, entablature and roof; 3 the dome; 4 the dedication (bronze doors,
 * the pediment's eagle and wreath, the gilded oculus ring, statues and
 * cypresses about the precinct).
 */
function pantheumArt(ctx, S, variant, state, key) {
  const { stage, n } = monumentStageOf(state, key);
  const done = stage >= n;
  const f = (k) => builtShare(stage, k);
  const { u, v, r, z0 } = PAN;
  const zw = z0 + PAN.wall; // the top of the drum
  const drumColor = '#e4d9c3';
  if (done) {
    quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#d8cfba');
    for (const [a, b] of [[0.3, 0.3], [4.7, 0.3]]) cypress(ctx, a, b, 1.1);
  } else siteGround(ctx, S, 5);

  // --- the rotunda: its foundations, drum and dome, one round piece each
  if (f(0) === 0.5) {
    trenchRing(ctx, u, v, r + 0.06, 0.26);
    trenchRect(ctx, 1.15, 3.45, 3.85, 4.75, 0.16);
    stakeOut(ctx, [[1.1, 3.4], [3.9, 3.4], [3.9, 4.8], [1.1, 4.8]]);
    pole(ctx, u, v, 0, 9, C.stake, 1.5); // the centre peg the ring was swung from
    beam(ctx, [u, v, 7], [u + r, v + 0.3, 2], C.string, 0.5);
    worker(ctx, u - 1.2, v + 0.9, 0, 1);
    worker(ctx, u + 0.9, v - 1.1, 0, 3);
  } else if (f(0) === 1) {
    revolve(ctx, u, v, [[r + 0.12, 0], [r + 0.12, z0], [0, z0]], C.stone, { seg: 32 });
  }
  if (f(1) > 0) {
    const h = f(1) === 1 ? PAN.wall : 22;
    const domed = f(3) > 0;
    // (Its box as tight as the drum unless scaffolded, so the block in front sorts clear of it.)
    solid(ctx, arcBounds(u, v, f(1) === 1 ? r + 0.01 : r + 0.15, z0, z0 + h + (f(1) === 1 ? 2 : 10)), () => {
      if (f(1) === 0.5) ringScaffoldRaw(ctx, u, v, r, z0, z0 + h + 9, false);
      if (domed) revolveRaw(ctx, u, v, [[r, z0], [r, zw]], drumColor, { seg: 32 });
      else hollowDrumRaw(ctx, u, v, r, 0.16, z0, h, drumColor, { seg: 32 });
      if (f(1) === 1) {
        for (const z of [z0 + 16, z0 + 33]) ringLine(ctx, u, v, r, z, shade(drumColor, -0.22), 1);
        drumMarks(ctx, u, v, r, 14, z0 + 20, 8, 0.22, 'rgba(70,58,44,0.55)', 0.1);
        drumMarks(ctx, u, v, r, 14, z0 + 37, 5, 0.18, 'rgba(70,58,44,0.4)', 0.1 + TAU / 28);
      } else {
        ringScaffoldRaw(ctx, u, v, r, z0, z0 + h + 9, true);
      }
    });
  }
  if (f(3) > 0) {
    // The dome on its stepped rings (the stage under way: half raised on its centering).
    const steps = [[r + 0.04, zw], [r + 0.04, zw + 2.5], [r - 0.06, zw + 2.5], [r - 0.06, zw + 6], [r - 0.16, zw + 6], [r - 0.16, zw + 9.5], [r - 0.26, zw + 9.5]];
    const dz = zw + 9.5;
    const dr = r - 0.26;
    solid(ctx, arcBounds(u, v, r + 0.04, zw, dz + PAN.dome + 2), () => {
      if (f(3) === 0.5) ringScaffoldRaw(ctx, u, v, r - 0.1, zw, dz + 18, false);
      revolveRaw(ctx, u, v, steps, '#dcd2be', { seg: 32 });
      if (f(3) === 1) {
        const prof = domeProf(dr, dz, PAN.dome, 1, 0.18, 7);
        revolveRaw(ctx, u, v, prof, done ? '#a9aeb0' : '#b8b2a6', { seg: 24, lines: true });
        const [ro, zo] = prof[prof.length - 1];
        poly(ctx, circlePts(u, v, ro, zo, 20), '#2a2420');
        ctx.strokeStyle = done ? C.gold : '#8f8a80';
        ctx.lineWidth = 1.2;
        const ring = circlePts(u, v, ro + 0.02, zo, 20);
        ctx.beginPath();
        ring.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        ctx.stroke();
      } else {
        domeBuildingRaw(ctx, u, v, dr, dz, PAN.dome, 0.5, '#bdb6a8');
        ringScaffoldRaw(ctx, u, v, r - 0.1, zw, dz + 18, true);
      }
    });
    if (f(3) === 0.5) worker(ctx, u + 0.3, v + 1.25, dz + 6, 2);
  }

  // --- the block that joins the portico to the rotunda (1), its gable (2)
  if (f(1) > 0) {
    if (f(1) === 0.5) scaffold(ctx, 1.45, 3.45, 2.1, 0.45, 0, 30, 'back');
    riseBox(ctx, 1.45, 3.45, 2.1, 0.45, 0, f(1) === 1 ? 50 : 22, drumColor, 1);
    if (f(1) === 1) {
      band(ctx, 'left', 1.45, 3.45, 3.55, 3.9, 36, 1.4, shade(drumColor, -0.18));
      door(ctx, 'left', 1.45, 3.45, 3.55, 3.9, 4, 0.5, done ? '#6e5528' : '#4f4234', 0.42, 24);
    }
    if (f(2) === 1) {
      gableRoof(ctx, 1.45, 3.45, 2.1, 0.45, 50, 11, '#9ba1a4', 'v', 0.04);
    }
    if (f(1) === 0.5) scaffold(ctx, 1.45, 3.45, 2.1, 0.45, 0, 30, 'front');
  }

  // --- the portico: podium and steps (0), columns, entablature and roof (2)
  if (f(0) === 1) {
    box(ctx, 1.15, 3.9, 2.7, 0.85, 0, 4, C.stone);
    stairs(ctx, 1.3, 3.7, 4.75, 4.97, 0, 4, 3, C.stone);
  }
  if (f(2) > 0) {
    const granite = '#cfc6bb';
    if (f(2) === 0.5) scaffold(ctx, 1.15, 3.9, 2.7, 0.85, 4, 44, 'back');
    colonnade(ctx, 1.3, 4.2, 3.7, 4.2, 4, 4, 32, granite, 2.3);
    colonnade(ctx, 3.7, 3.98, 3.7, 4.4, 2, 4, 32, granite, 2.3);
    for (let k = 0; k < 8; k++) {
      const h = f(2) === 1 || k % 3 !== 1 ? 32 : 9;
      column(ctx, 1.27 + (k * 2.46) / 7, 4.66, 4, h, granite, 2.5);
    }
    if (f(2) === 1) {
      box(ctx, 1.15, 3.9, 2.7, 0.85, 36, 5, C.marble);
      if (done) {
        // the inscription along the frieze
        onFace(ctx, 'left', 1.15, 3.9, 3.85, 4.75, 36, 41, (at) => {
          ctx.fillStyle = '#5a4a32';
          for (let k = 0; k < 15; k++) {
            const [x, y] = at(0.12 + k * 0.054, 38.2);
            ctx.fillRect(x - 1.1, y - 1.4, 2.2, 1.6);
          }
        });
      }
      gableRoof(ctx, 1.15, 3.9, 2.7, 0.85, 41, 13, '#9ba1a4', 'v', 0.05);
      pediment(ctx, 1.22, 3.78, 4.81, 41.5, 12, C.marble, done ? (x, y) => {
        // a gilded eagle in a wreath
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, y, 4.6, 3.4, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = C.gold;
        ctx.beginPath(); ctx.moveTo(x - 4.4, y - 2); ctx.lineTo(x, y + 0.6); ctx.lineTo(x + 4.4, y - 2); ctx.lineTo(x, y + 2.6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - 1.6, 1, 0, TAU); ctx.fill();
      } : null);
    } else {
      trusses(ctx, 1.2, 3.8, 3.9, 4.75, 38, 10, 0.5);
      scaffold(ctx, 1.15, 3.9, 2.7, 0.85, 4, 44, 'front');
      worker(ctx, 2.3, 4.84, 22, 0);
    }
  }
  if (stage === 4) {
    // The dedication under way: the pediment being carved and gilded.
    for (let k = 0; k < 5; k++) pole(ctx, 1.15 + k * 0.67, 4.88, 4, 50);
    for (const z of [26, 40]) box(ctx, 1.12, 4.85, 2.76, 0.06, z, 1.1, C.woodPale, { plain: true });
    worker(ctx, 2.0, 4.88, 41, 4);
  }

  // --- the precinct's front, or the yard
  if (done) {
    giltFigure(ctx, 0.75, 4.35, 0, 1.2);
    giltFigure(ctx, 4.25, 4.35, 0, 1.2);
    cypress(ctx, 0.35, 4.65, 0.95);
    cypress(ctx, 4.65, 4.65, 0.95);
  } else {
    const top = [8, 30, 46, 54, 50][stage];
    if (stage === 4) jars(ctx, 0.3, 4.35); else bricks(ctx, 0.35, 4.3);
    logs(ctx, 0.25, 3.7, 0.55);
    if (stage >= 2) marbleBlocks(ctx, 4.05, 3.8); else planks(ctx, 4.05, 3.9);
    crane(ctx, 4.62, 2.95, 0, -1, -0.3, top + 12, Math.max(4, top - 10));
  }
}

// ---------------------------------------------------------------------------
// Pharus (3x3, out over the water): the lighthouse
// ---------------------------------------------------------------------------

/** The mole's top over the water (px), and the tower's storeys (px). */
const PH = Object.freeze({ deck: 6, sq: 60, oct: 32, lan: 15 });

/**
 * The Pharus, designed with the water on its +u side (its two rows u 1..3),
 * turned into place by `side` (waterArt.js turner): a stone mole on arches
 * over the water with the tower on it, the shore row a quay with the
 * keeper's timber store. Stage 0 the piers (stone piers rising in a
 * cofferdam of piles); 1 the square storey; 2 the eight-sided storey; 3 the
 * lantern, and once finished the fire burning in it.
 */
function pharusArt(ctx, S, variant, state, key) {
  const { stage, n, side } = monumentStageOf(state, key);
  const done = stage >= n;
  const f = (k) => builtShare(stage, k);
  const T = turner(S, side);
  const Q = (u, v, z = 0) => P(...T(u, v), z);
  const R = (u0, v0, du, dv) => turnedRect(T, u0, v0, du, dv);
  const at = (u, v) => { const [a, b] = T(u, v); return a + b; };
  const shore = 1;
  const Z = PH.deck;
  const stone = '#cfc3a6';
  // Which designed faces look at the viewer here (their outward normals as placed).
  const seen = (nu, nv) => {
    const a = T(0, 0);
    const b = T(nu, nv);
    return b[0] - a[0] + (b[1] - a[1]) > 0;
  };

  // --- the quay on the shore row
  const land = R(0.03, 0.03, shore - 0.03, S - 0.06);
  if (f(0) === 1 || done) box(ctx, land[0], land[1], land[2], land[3], 0, Z, stone, { plain: true });
  else quad(ctx, land[0], land[1], land[0] + land[2], land[1] + land[3], 0, C.earth);

  // --- the mole out over the water (stage 0), on arches the sea runs through
  const items = [];
  if (f(0) === 1) {
    const m = R(shore, 0.05, S - shore - 0.03, S - 0.1);
    box(ctx, m[0], m[1], m[2], m[3], 0, Z, stone, { plain: true });
    // Arches at the waterline on whichever of its sea faces show.
    const faces = [
      [1, 0, (t, z) => Q(S - 0.03, 0.05 + (S - 0.1) * t, z)],
      [0, 1, (t, z) => Q(shore + (S - shore - 0.03) * t, S - 0.05, z)],
      [0, -1, (t, z) => Q(shore + (S - shore - 0.03) * t, 0.05, z)],
    ];
    for (const [nu, nv, atF] of faces) {
      if (!seen(nu, nv)) continue;
      const count = nu ? 4 : 3;
      for (let k = 0; k < count; k++) {
        const tm = (k + 0.5) / count;
        const hw = 0.28 / count;
        const pts = [atF(tm - hw, 0), atF(tm + hw, 0), atF(tm + hw, 2)];
        for (let j = 1; j < 6; j++) pts.push(atF(tm + hw * Math.cos((Math.PI * j) / 6), 2 + 2.6 * Math.sin((Math.PI * j) / 6)));
        pts.push(atF(tm - hw, 2));
        poly(ctx, pts, 'rgba(30,48,60,0.75)');
      }
      // the wet, weedy foot of the wall
      poly(ctx, [atF(0, 0), atF(1, 0), atF(1, 0.8), atF(0, 0.8)], 'rgba(40,70,50,0.45)');
    }
    // bollards along the sea edge
    for (const v of [0.35, S - 0.35]) {
      items.push({ d: at(S - 0.15, v) + 0.6, draw: () => {
        const [x, y] = Q(S - 0.15, v, Z);
        ctx.fillStyle = '#7d7462';
        ctx.fillRect(x - 1.3, y - 3.4, 2.6, 3.4);
        ctx.fillStyle = '#a49a84';
        ctx.fillRect(x - 1.7, y - 4.2, 3.4, 1.1);
      } });
    }
  } else {
    // The piers rising out of the water inside a cofferdam of piles.
    for (const [pu, pv, ph] of [[1.25, 0.35, 5], [1.25, 1.35, 6], [1.25, 2.35, 4], [2.25, 0.35, 3], [2.25, 1.35, 5], [2.25, 2.35, 2]]) {
      const p = R(pu, pv, 0.42, 0.32);
      items.push({ d: p[0] + p[1] + 0.3, draw: () => box(ctx, p[0], p[1], p[2], p[3], 0, ph, stone) });
    }
    for (let k = 0; k <= 8; k++) {
      for (const [pu, pv] of [[shore + 0.06 + (k * (S - shore - 0.15)) / 8, 0.1], [shore + 0.06 + (k * (S - shore - 0.15)) / 8, S - 0.1], [S - 0.08, 0.1 + (k * (S - 0.2)) / 8]]) {
        const [a, b] = T(pu, pv);
        items.push({ d: a + b + 0.4, draw: () => pole(ctx, a, b, 0, 7, '#5a4632', 1.6) });
      }
    }
    // the planking of the dam along its sea side
    items.push({ d: at(S - 0.08, S / 2) + 0.45, draw: () => {
      ctx.strokeStyle = '#7a5e40';
      ctx.lineWidth = 1.2;
      for (const z of [2.5, 5.5]) {
        const a = Q(shore, 0.1, z);
        const b = Q(S - 0.08, 0.1, z);
        const c = Q(S - 0.08, S - 0.1, z);
        const d = Q(shore, S - 0.1, z);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
      }
    } });
  }

  // --- the tower: square storey (1), eight-sided storey (2), lantern and fire (3)
  const tc = T(1.95, 1.5); // the tower's axis
  const dTower = tc[0] + tc[1];
  const sq = R(1.47, 1.02, 0.96, 0.96);
  if (f(1) > 0) {
    const h = f(1) === 1 ? PH.sq : 26;
    if (f(1) === 0.5) items.push({ d: dTower - 0.9, draw: () => scaffold(ctx, sq[0], sq[1], sq[2], sq[3], Z, Z + h + 8, 'back') });
    items.push({ d: dTower, draw: () => {
      riseBox(ctx, sq[0], sq[1], sq[2], sq[3], Z, h, '#e6dcc4', f(1));
      if (f(1) === 1) {
        windows(ctx, 'left', sq[0], sq[1], sq[0] + sq[2], sq[1] + sq[3], Z, 4, 2, C.glass, { z: Z + 12, h: 5, w: 0.07, gap: 11 });
        windows(ctx, 'right', sq[0], sq[1], sq[0] + sq[2], sq[1] + sq[3], Z, 4, 2, C.glass, { z: Z + 12, h: 5, w: 0.07, gap: 11 });
        // the door at the tower's foot, facing the land, when that side shows
        const toLand = [T(-1, 0)[0] - T(0, 0)[0], T(-1, 0)[1] - T(0, 0)[1]];
        if (toLand[0] > 0 || toLand[1] > 0) door(ctx, toLand[1] > 0 ? 'left' : 'right', sq[0], sq[1], sq[0] + sq[2], sq[1] + sq[3], Z, 0.5, '#4a3a2a', 0.2, 10);
        box(ctx, sq[0] - 0.06, sq[1] - 0.06, sq[2] + 0.12, sq[3] + 0.12, Z + h, 3, '#efe7d3', { plain: true });
      }
    } });
    if (f(1) === 0.5) {
      items.push({ d: dTower + 0.9, draw: () => {
        scaffold(ctx, sq[0], sq[1], sq[2], sq[3], Z, Z + h + 8, 'front');
        worker(ctx, sq[0] + sq[2] + 0.09, sq[1] + sq[3] * 0.5, Z + 18, 1);
      } });
    }
  }
  const zo = Z + PH.sq + 3; // the eight-sided storey's foot
  if (f(2) > 0) {
    const h = f(2) === 1 ? PH.oct : 15;
    items.push({ d: dTower + 0.01, draw: () => {
      solid(ctx, arcBounds(tc[0], tc[1], 0.66, zo, zo + h + 10), () => {
        if (f(2) === 0.5) ringScaffoldRaw(ctx, tc[0], tc[1], 0.42, zo, zo + h + 9, false);
        revolveRaw(ctx, tc[0], tc[1], [[0.42, zo], [0.42, zo + h], [0, zo + h]], '#e9e0ca', { seg: 8, a0: Math.PI / 8 });
        if (f(2) === 1) {
          drumMarks(ctx, tc[0], tc[1], 0.395, 8, zo + 10, 6, 0.06, C.glass, -Math.PI / 8, true); // a slit on each face
          revolveRaw(ctx, tc[0], tc[1], [[0.48, zo + h], [0.48, zo + h + 2.5], [0, zo + h + 2.5]], '#f0e8d6', { seg: 8, a0: Math.PI / 8 });
        } else {
          ringScaffoldRaw(ctx, tc[0], tc[1], 0.42, zo, zo + h + 9, true);
        }
      });
    } });
  }
  const zl = zo + PH.oct + 2.5; // the lantern's floor
  if (f(3) > 0) {
    items.push({ d: dTower + 0.02, draw: () => {
      solid(ctx, arcBounds(tc[0], tc[1], 0.5, zl, zl + 40), () => lanternRaw(ctx, tc[0], tc[1], zl, f(3), done));
    } });
  }

  // --- the keeper's timber store on the quay, and the yard
  const shed = R(0.12, 0.15, 0.72, 0.8);
  if (f(0) === 1) {
    items.push({ d: shed[0] + shed[1] + 0.3, draw: () => {
      box(ctx, shed[0], shed[1], shed[2], shed[3], Z, 12, '#c9b48e');
      gableRoof(ctx, shed[0], shed[1], shed[2], shed[3], Z + 12, 6, C.terra, shed[2] >= shed[3] ? 'u' : 'v');
    } });
  }
  const wood = T(0.25, 2.1);
  const block = T(0.3, 1.25);
  if (done) {
    items.push({ d: wood[0] + wood[1] + 0.3, draw: () => logs(ctx, wood[0] - 0.3, wood[1] - 0.15, 0.6) });
  } else {
    items.push({ d: wood[0] + wood[1] + 0.3, draw: () => (stage === 0 ? bricks(ctx, wood[0] - 0.17, wood[1] - 0.13) : logs(ctx, wood[0] - 0.3, wood[1] - 0.15, 0.6)) });
    items.push({ d: block[0] + block[1] + 0.3, draw: () => marbleBlocks(ctx, block[0] - 0.25, block[1] - 0.12) });
    // shear legs on the quay's edge, swinging stone out to the work
    const foot = T(0.8, 0.45);
    const out = T(1.8, 0.45);
    const z = f(0) === 1 ? Z : 0;
    const top = [10, 40, 76, 98][stage];
    items.push({ d: foot[0] + foot[1] + 0.2, draw: () => crane(ctx, foot[0], foot[1], z, out[0] - foot[0], out[1] - foot[1], top + 8, Math.max(z + 2, top - 20), stage > 0) });
  }
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
}

/**
 * The Pharus's lantern on its floor at zl: a ring of columns round the fire
 * under a bronze cone with a figure on top (share f 0.5: the columns half
 * raised in scaffolding, no fire yet). Raw: inside a solid().
 */
function lanternRaw(ctx, u, v, zl, f, lit) {
  const r = 0.26;
  const hc = 13;
  revolveRaw(ctx, u, v, [[r + 0.06, zl], [r + 0.06, zl + 2], [0, zl + 2]], '#e9e0ca', { seg: 16 });
  const col = (front) => {
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8 + 0.2;
      if ((facing(a) >= 0) !== front) continue;
      const h = f >= 1 || k % 2 ? hc : 5;
      column(ctx, u + Math.cos(a) * r, v + Math.sin(a) * r, zl + 2, h, '#f0e9da', 1.3);
    }
  };
  if (f < 1) ringScaffoldRaw(ctx, u, v, r, zl, zl + 20, false);
  col(false);
  if (f >= 1 && lit) {
    // The fire: a glow about the lantern, flames on the hearth.
    const [x, y] = P(u, v, zl + 6);
    for (const [rad, a] of [[16, 0.12], [10, 0.2], [6, 0.35]]) {
      ctx.fillStyle = `rgba(255,190,90,${a})`;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
    }
    for (const [dx, h, c] of [[-2.2, 7, '#e8742c'], [1.8, 8.5, '#f0902e'], [0, 10, '#f6c04a'], [0.4, 6, '#fff0a8']]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x + dx - 2.2, y + 4);
      ctx.quadraticCurveTo(x + dx - 1.6, y + 4 - h * 0.6, x + dx, y + 4 - h);
      ctx.quadraticCurveTo(x + dx + 1.6, y + 4 - h * 0.6, x + dx + 2.2, y + 4);
      ctx.closePath();
      ctx.fill();
    }
  }
  col(true);
  if (f >= 1) {
    revolveRaw(ctx, u, v, [[r + 0.08, zl + 2 + hc], [r + 0.08, zl + 4 + hc], [0.06, zl + 13 + hc], [0, zl + 13 + hc]], '#7f9a7c', { seg: 16 });
    const [x, y] = P(u, v, zl + 13 + hc);
    ctx.fillStyle = C.gold;
    ctx.fillRect(x - 1, y - 7.5, 2, 7.5);
    ctx.beginPath(); ctx.arc(x, y - 8.6, 1.3, 0, TAU); ctx.fill();
    ctx.fillRect(x + 1, y - 10, 0.7, 6); // a raised arm with a torch
    if (lit) smokeRaw(ctx, x + 1, y - 14);
  } else {
    ringScaffoldRaw(ctx, u, v, r, zl, zl + 20, true);
  }
}

/** A faint wisp from the fire, at screen point (x, y). */
function smokeRaw(ctx, x, y) {
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = `rgba(210,206,200,${0.35 - k * 0.09})`;
    ctx.beginPath(); ctx.arc(x + 2 + k * 3, y - k * 4.5, 1.8 + k, 0, TAU); ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Mansio Magna (5x5): the caravanserai
// ---------------------------------------------------------------------------

const PLASTER = '#e0cfa9';

/** A mule (a small horse with long ears) at (u, v), facing right (1) or left (-1), maybe with packs. */
function mule(ctx, u, v, face = 1, packs = null) {
  piece(ctx, u, v, 0, 14, 0.15, (x, y) => {
    horse(ctx, x, y, 0.7, '#7d6a58', face, 0, '#3e3026');
    ctx.strokeStyle = '#5e4c3c';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + face * 5.5, y - 9.6); ctx.lineTo(x + face * 5, y - 12.8);
    ctx.moveTo(x + face * 6.1, y - 9.6); ctx.lineTo(x + face * 6.4, y - 12.6);
    ctx.stroke();
    if (packs) {
      ctx.fillStyle = packs;
      ctx.fillRect(x - 3.4, y - 8.4, 3, 3.2);
      ctx.fillStyle = shade(packs, -0.2);
      ctx.fillRect(x - 0.4, y - 8.6, 3, 3.4);
    }
  });
}

/** A two-wheeled cart at (u, v), its shafts toward +u, loaded with bales and jars. */
function cart(ctx, u, v) {
  box(ctx, u, v, 0.46, 0.26, 4, 2.4, C.wood, { plain: true });
  box(ctx, u + 0.05, v + 0.03, 0.16, 0.2, 6.4, 4, '#d8c7a0', { plain: true });
  box(ctx, u + 0.24, v + 0.04, 0.14, 0.18, 6.4, 3, '#b89a6a', { plain: true });
  beam(ctx, [u + 0.46, v + 0.06, 5], [u + 0.8, v + 0.06, 4], C.woodDark, 0.8);
  beam(ctx, [u + 0.46, v + 0.2, 5], [u + 0.8, v + 0.2, 4], C.woodDark, 0.8);
  for (const vv of [v + 0.27, v - 0.01]) {
    piece(ctx, u + 0.22, vv, 0, 9, 0.02, (x, y) => {
      ctx.strokeStyle = '#4a3422';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, y - 4, 2.6, 4, 0.5, 0, TAU); ctx.stroke();
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x - 1.5, y - 6.8); ctx.lineTo(x + 1.5, y - 1.2); ctx.moveTo(x + 2, y - 5.4); ctx.lineTo(x - 2, y - 2.6); ctx.stroke();
    });
  }
}

/**
 * The Mansio Magna: stage 0 the courtyard (its walls, gatehouse, paving,
 * well and trough); 1 the stables down the left and the colonnades with
 * their storerooms; 2 the inn along the back, and once open its guests'
 * mules and cart in the yard.
 */
function mansioArt(ctx, S, variant, state, key) {
  const { stage, n } = monumentStageOf(state, key);
  const done = stage >= n;
  const f = (k) => builtShare(stage, k);
  if (done || f(0) === 1) quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#c9b893');
  else siteGround(ctx, S, 7);
  const wallH = 12;
  const yard = '#d6c9aa';
  // --- 0: the courtyard: paving, the outer wall's back and left runs
  if (f(0) === 1) {
    quad(ctx, 0.24, 0.24, 4.76, 4.76, 0, yard);
    for (let k = 1; k < 9; k++) quad(ctx, 0.24 + k * 0.5, 0.24, 0.26 + k * 0.5, 4.76, 0, 'rgba(120,100,70,0.18)');
    box(ctx, 0.1, 0.1, 4.8, 0.14, 0, wallH, PLASTER);
    box(ctx, 0.1, 0.24, 0.14, 4.66, 0, wallH, PLASTER);
  } else if (f(0) === 0.5) {
    trenchRect(ctx, 0.1, 0.1, 4.9, 4.9, 0.16);
    quad(ctx, 1.4, 1.5, 3.7, 3.4, 0, yard); // the first paving laid
    for (const [a, b] of [[1.4, 1.5], [3.7, 1.5], [3.7, 3.4], [1.4, 3.4]]) pole(ctx, a, b, 0, 6, C.stake, 1.2);
    box(ctx, 0.1, 0.1, 2.6, 0.14, 0, 5, PLASTER); // the back wall begun
    worker(ctx, 2.9, 0.35, 0, 0);
    worker(ctx, 2.3, 2.6, 0, 3);
  }

  // --- 2: the inn along the back
  if (f(2) > 0) {
    if (f(2) === 0.5) scaffold(ctx, 0.24, 0.24, 4.52, 1.1, 0, 26, 'back');
    riseBox(ctx, 0.24, 0.24, 4.52, 1.1, 0, 30, PLASTER, f(2));
    windows(ctx, 'left', 0.24, 0.24, 4.76, 1.34, 0, f(2) === 1 ? 2 : 1, 9, C.glass, { z: 6, h: 5, w: 0.11, gap: 12, shutters: f(2) === 1 ? '#6a7f5a' : null });
    windows(ctx, 'right', 0.24, 0.24, 4.76, 1.34, 0, f(2) === 1 ? 2 : 1, 2, C.glass, { z: 6, h: 5, w: 0.1, gap: 12 });
    if (f(2) === 1) {
      gableRoof(ctx, 0.24, 0.24, 4.52, 1.1, 30, 11, C.terra, 'u');
      box(ctx, 1.1, 0.5, 0.16, 0.16, 36, 10, '#c9b48e');
      smoke(ctx, 1.18, 0.58, 46);
    } else {
      scaffold(ctx, 0.24, 0.24, 4.52, 1.1, 0, 26, 'front');
      worker(ctx, 1.6, 1.43, 18, 1);
      worker(ctx, 3.4, 1.43, 9, 2);
    }
  }

  // --- 1: the colonnade along the inn, the stables (left), the storerooms and their colonnade (right)
  if (f(1) > 0) {
    const full = f(1) === 1;
    for (let k = 0; k < 6; k++) column(ctx, 1.5 + k * 0.42, 1.62, 0, full || k % 2 ? 13 : 4, '#efe6d2', 1.5);
    if (full) box(ctx, 1.34, 1.34, 2.42, 0.36, 13, 2, '#efe6d2', { top: C.terraDark });
    if (!full) scaffold(ctx, 0.24, 1.34, 1.05, 3.42, 0, 20, 'back');
    riseBox(ctx, 0.24, 1.34, 1.05, 3.42, 0, 15, '#cdb48a', f(1));
    if (full) {
      // the stalls open on the yard, a mule looking out of one
      onFace(ctx, 'right', 0.24, 1.34, 1.29, 4.76, 0, 12, (at) => {
        for (let k = 0; k < 6; k++) {
          const t = (k + 0.5) / 6;
          poly(ctx, [at(t - 0.055, 0), at(t + 0.055, 0), at(t + 0.055, 10), at(t - 0.055, 10)], 'rgba(48,36,26,0.85)');
        }
      });
      gableRoof(ctx, 0.24, 1.34, 1.05, 3.42, 15, 8, C.terraDark, 'v');
      box(ctx, 1.34, 3.9, 0.3, 0.3, 0, 4, '#d6bd6a', { top: '#e4cc78' }); // bales of hay
      box(ctx, 1.36, 4.25, 0.28, 0.3, 0, 4, '#ccb25e', { top: '#dcc46e' });
    } else {
      scaffold(ctx, 0.24, 1.34, 1.05, 3.42, 0, 20, 'front');
    }
    // the storerooms down the right, their doors on the yard (the far side from here)
    riseBox(ctx, 3.96, 1.34, 0.8, 3.42, 0, 15, PLASTER, full ? 1 : 0.5);
    if (full) gableRoof(ctx, 3.96, 1.34, 0.8, 3.42, 15, 7, C.terra, 'v');
  }

  // --- the yard: well and trough (0), and the guests once the inn is open
  if (f(0) === 1) {
    basin(ctx, 2.65, 2.6, 0.18, 6, '#bfb59c', '#3d6a86');
    beam(ctx, [2.5, 2.6, 6], [2.5, 2.6, 15], C.woodDark, 1);
    beam(ctx, [2.8, 2.6, 6], [2.8, 2.6, 15], C.woodDark, 1);
    beam(ctx, [2.5, 2.6, 14.5], [2.8, 2.6, 14.5], C.woodDark, 1.2);
    box(ctx, 1.75, 3.4, 0.6, 0.16, 0, 3.4, C.stoneDark, { top: '#5a8fb0' });
  }
  if (done) {
    cart(ctx, 2.6, 3.65);
    mule(ctx, 3.55, 3.75, 1);
    mule(ctx, 1.95, 3.85, -1, '#b89060');
    mule(ctx, 3.2, 2.4, 1, '#8a6a4a');
    jars(ctx, 3.3, 4.35);
  }

  // --- the outer wall's near runs and the gatehouse (0)
  if (f(0) === 1) {
    box(ctx, 4.76, 0.24, 0.14, 4.66, 0, wallH, PLASTER);
    box(ctx, 0.24, 4.76, 1.76, 0.14, 0, wallH, PLASTER);
    box(ctx, 3.0, 4.76, 1.76, 0.14, 0, wallH, PLASTER);
    for (const a of [1.9, 2.82]) box(ctx, a, 4.64, 0.28, 0.36, 0, 20, '#ece0c4');
    box(ctx, 1.9, 4.64, 1.2, 0.36, 20, 4, '#ece0c4');
    hipRoof(ctx, 1.86, 4.6, 1.28, 0.44, 24, 6, C.terra);
    if (done) {
      // the sign over the gate: a painted board
      onFace(ctx, 'left', 1.9, 4.64, 3.1, 5.0, 14, 19, (at) => {
        poly(ctx, [at(0.28, 14.5), at(0.72, 14.5), at(0.72, 18.5), at(0.28, 18.5)], '#7a2e22');
        poly(ctx, [at(0.33, 15.6), at(0.67, 15.6), at(0.67, 17.4), at(0.33, 17.4)], '#e8c56a');
      });
    }
  }
  if (!done) {
    bricks(ctx, 0.45, 4.35);
    logs(ctx, 3.4, 4.3);
    if (stage === 2) jars(ctx, 1.0, 4.35); else planks(ctx, 1.0, 4.4);
    const top = [6, 18, 28][stage];
    crane(ctx, 4.5, 2.6, 0, -1, 0, top + 14, Math.max(3, top - 6));
  }
}

// ---------------------------------------------------------------------------
// Thermae (5x5): the great baths
// ---------------------------------------------------------------------------

const BRICK_FACE = '#b47a54';

/** A great half-round window in a vault's end (the thermal window), on the +v face of a block. */
function thermalWindow(ctx, u0, u1, v, z, rise) {
  decal(0, 1, () => {
    const um = (u0 + u1) / 2;
    const hw = (u1 - u0) / 2;
    const pts = [];
    for (let j = 0; j <= 12; j++) {
      const a = (Math.PI * j) / 12;
      pts.push(P(um + hw * Math.cos(a), v, z + rise * Math.sin(a)));
    }
    poly(ctx, pts, '#3d3a3a');
    ctx.strokeStyle = '#e8dfcc';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (const t of [-0.34, 0.34]) {
      const a = P(um + hw * t, v, z);
      const b = P(um + hw * t, v, z + rise * Math.sqrt(1 - t * t));
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
  });
}

/**
 * The Thermae: stage 0 the platform over the furnaces (the floor on its
 * brick stacks being laid); 1 the hot hall under its dome and the warm hall
 * before it; 2 the two vaulted cold-hall wings and the pool; 3 the exercise
 * court with its colonnades. Finished, smoke rises from the furnaces' flues.
 */
function thermaeArt(ctx, S, variant, state, key) {
  const { stage, n } = monumentStageOf(state, key);
  const done = stage >= n;
  const f = (k) => builtShare(stage, k);
  if (done) {
    quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, C.grass);
    quad(ctx, 0.2, 0.2, 4.8, 4.8, 0, '#d8cfb9');
  } else siteGround(ctx, S, 11);
  const stucco = '#ebe0ca';

  // --- the flues at the back (2), smoking once lit
  if (f(2) === 1) {
    for (const a of [0.9, 3.95]) {
      box(ctx, a, 0.18, 0.16, 0.14, 0, 40, BRICK_FACE);
      if (done) smoke(ctx, a + 0.08, 0.25, 41, true);
    }
  }

  // --- 0: the platform over the hypocaust
  if (f(0) === 0.5) {
    trenchRect(ctx, 0.35, 0.35, 4.65, 2.6, 0.18);
    // the floor's brick stacks (pilae) going up in rows, the floor slabs laid over the first
    quad(ctx, 0.53, 0.53, 3.2, 2.42, 0, '#8f7052');
    box(ctx, 0.53, 0.53, 0.72, 1.89, 0, 5.7, '#c9b9a0', { plain: true }); // the floor laid over the first stacks
    for (let a = 0; a < 8; a++) {
      for (let b = 0; b < 6; b++) {
        if (a > 5 && b < 3) continue; // (the last rows still going up)
        box(ctx, 1.36 + a * 0.22, 0.62 + b * 0.3, 0.09, 0.09, 0, a > 5 ? 2.5 : 4.5, C.brick, { plain: true });
      }
    }
    stakeOut(ctx, [[0.6, 2.9], [2.45, 2.9], [2.45, 4.6], [0.6, 4.6]]);
    worker(ctx, 2.0, 1.2, 0, 2);
    worker(ctx, 3.3, 2.2, 0, 0);
  } else if (f(0) === 1) {
    box(ctx, 0.35, 0.35, 4.3, 2.25, 0, 5, BRICK_FACE);
    arcade(ctx, 'left', 0.35, 0.35, 4.65, 2.6, 0, 5, 10, 'rgba(40,24,16,0.8)', { open: 0.35, spring: 0.4 });
  }

  // --- 2: the left wing (the cold hall), behind the hot hall from here
  const wing = (u0, full) => {
    const h = full ? 26 : 12;
    if (!full) scaffold(ctx, u0, 0.45, 1.35, 2.15, 5, 5 + h + 8, 'back');
    riseBox(ctx, u0, 0.45, 1.35, 2.15, 5, h, stucco, full ? 1 : 0.5);
    if (full) {
      windows(ctx, 'right', u0, 0.45, u0 + 1.35, 2.6, 5, 1, 3, C.glass, { z: 10, h: 9, w: 0.14 });
      arcade(ctx, 'left', u0, 0.45, u0 + 1.35, 2.6, 5, 15, 3, 'rgba(58,46,36,0.75)', { open: 0.5 });
      box(ctx, u0 - 0.03, 0.42, 1.41, 2.21, 31, 2, '#f2eadb', { plain: true });
      gableRoof(ctx, u0, 0.45, 1.35, 2.15, 33, 12, C.terra, 'v', 0.04);
      thermalWindow(ctx, u0 + 0.2, u0 + 1.15, 2.6, 33, 9);
    } else {
      scaffold(ctx, u0, 0.45, 1.35, 2.15, 5, 5 + h + 8, 'front');
    }
  };
  if (f(2) > 0) wing(0.35, f(2) === 1);

  // --- 1: the hot hall and its dome, the warm hall before it
  if (f(1) > 0) {
    const full = f(1) === 1;
    if (!full) scaffold(ctx, 1.7, 0.4, 1.6, 1.6, 5, 30, 'back');
    riseBox(ctx, 1.7, 0.4, 1.6, 1.6, 5, full ? 32 : 16, stucco, full ? 1 : 0.5);
    if (full) {
      windows(ctx, 'right', 1.7, 0.4, 3.3, 2.0, 5, 1, 3, C.glass, { z: 22, h: 11, w: 0.12 });
      box(ctx, 1.66, 0.36, 1.68, 1.68, 37, 2, '#f2eadb', { plain: true });
      solid(ctx, arcBounds(2.5, 1.2, 0.72, 39, 72), () => {
        revolveRaw(ctx, 2.5, 1.2, [[0.7, 39], [0.7, 47]], stucco, { seg: 28 });
        drumMarks(ctx, 2.5, 1.2, 0.7, 10, 40.5, 4, 0.14, C.glass, 0.1);
        revolveRaw(ctx, 2.5, 1.2, [[0.74, 47], [0.74, 48.5], [0.68, 48.5], ...domeProf(0.68, 48.5, 22, 1, 0.14, 6)], '#c9c2b4', { seg: 24, lines: true });
        poly(ctx, circlePts(2.5, 1.2, 0.68 * 0.14, 48.5 + 22 * Math.sin(Math.acos(0.14)), 12), '#3a3230');
      });
      // the warm hall in front, lower, its vault's end facing the court
      box(ctx, 1.75, 2.0, 1.5, 0.6, 5, 20, stucco);
      arcade(ctx, 'left', 1.75, 2.0, 3.25, 2.6, 5, 14, 3, 'rgba(58,46,36,0.75)', { open: 0.5 });
      gableRoof(ctx, 1.75, 2.0, 1.5, 0.6, 25, 9, C.terra, 'v', 0.04);
      thermalWindow(ctx, 1.95, 3.05, 2.64, 25, 7);
    } else {
      scaffold(ctx, 1.7, 0.4, 1.6, 1.6, 5, 30, 'front');
      worker(ctx, 2.2, 2.09, 14, 1);
      worker(ctx, 3.39, 1.2, 23, 3);
    }
  }
  if (f(2) > 0) wing(3.3, f(2) === 1);

  // --- 2: the pool, front left
  if (f(2) === 0.5) {
    trenchRect(ctx, 0.55, 2.95, 2.45, 4.55, 0.22);
    quad(ctx, 0.77, 3.17, 2.23, 4.33, 0, '#7a5c40');
  } else if (f(2) === 1) {
    box(ctx, 0.5, 2.92, 2.0, 1.68, 0, 3, C.marble, { plain: true });
    quad(ctx, 0.62, 3.04, 2.38, 4.48, 3.05, C.pool);
    quad(ctx, 0.62, 3.04, 2.38, 3.2, 3.06, 'rgba(255,255,255,0.22)');
    for (let k = 0; k < 4; k++) quad(ctx, 0.9 + k * 0.38, 3.5 + (k % 2) * 0.45, 1.1 + k * 0.38, 3.56 + (k % 2) * 0.45, 3.07, 'rgba(255,255,255,0.45)');
    stairs(ctx, 0.62, 0.9, 3.04, 4.48, 0, 3, 2, C.marble);
    if (done) {
      giltFigure(ctx, 0.62, 4.75, 0, 1);
      giltFigure(ctx, 2.38, 4.75, 0, 1);
    }
  }

  // --- 3: the exercise court, front right
  if (f(3) > 0) {
    const full = f(3) === 1;
    quad(ctx, 2.75, 2.9, 4.7, 4.75, 0, C.sand);
    for (let k = 0; k < 4; k++) column(ctx, 2.9 + k * 0.42, 2.98, 0, full || k % 2 ? 14 : 5, C.marble, 1.5);
    if (full) {
      box(ctx, 2.78, 2.86, 1.62, 0.24, 14, 1.5, C.marble, { plain: true });
      gableRoof(ctx, 2.78, 2.86, 1.62, 0.24, 15.5, 4, C.terraDark, 'u', 0.03);
    }
    for (let k = 0; k < 5; k++) column(ctx, 4.58, 3.32 + k * 0.34, 0, full || k % 2 ? 14 : 5, C.marble, 1.5);
    if (full) {
      box(ctx, 4.46, 3.16, 0.24, 1.58, 14, 1.5, C.marble, { plain: true });
      gableRoof(ctx, 4.46, 3.16, 0.24, 1.58, 15.5, 4, C.terraDark, 'v', 0.03);
    }
    if (done) {
      giltFigure(ctx, 3.6, 3.85, 0, 1.3);
      worker(ctx, 3.2, 4.3, 0, 0);
      worker(ctx, 3.45, 4.45, 0, 1);
      worker(ctx, 4.1, 3.6, 0, 4);
    }
  }

  // --- the yard: timber for the furnaces, stacks of brick and marble
  if (done) logs(ctx, 4.68, 2.66, 0.25);
  else {
    if (stage === 3) jars(ctx, 3.2, 4.4); else bricks(ctx, 3.3, 4.35);
    logs(ctx, 3.8, 4.3);
    if (stage >= 2) marbleBlocks(ctx, 2.75, 3.6); else planks(ctx, 2.85, 3.7);
    const top = [8, 36, 38, 18][stage];
    crane(ctx, 4.55, 3.0, 0, -0.4, -1, top + 14, Math.max(4, top - 8));
  }
}

// ---------------------------------------------------------------------------
// Basilica (5x5): the hall of justice
// ---------------------------------------------------------------------------

/** The hall (u0..u1, v0..v1), its nave (v), aisles' and clerestory's heights. */
const BAS = Object.freeze({ u0: 0.3, u1: 3.95, v0: 0.9, v1: 3.6, nv0: 1.6, nv1: 2.9, wall: 26, base: 4 });

/**
 * The Basilica: stage 0 the platform and its steps; 1 the walls, the
 * nave's piers and the clerestory over them; 2 the great timber roof over
 * the nave and the aisles' roofs; 3 the magistrates' apse at the end with
 * its half dome, the tribunal before it, and the statues along the front.
 */
function basilicaArt(ctx, S, variant, state, key) {
  const { stage, n } = monumentStageOf(state, key);
  const done = stage >= n;
  const f = (k) => builtShare(stage, k);
  const { u0, u1, v0, v1, nv0, nv1, base } = BAS;
  const tr = '#e6dabd'; // travertine
  if (done) quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#d6ccb4');
  else siteGround(ctx, S, 13);
  const zw = base + BAS.wall; // the aisles' walls' top
  const zc = zw + 4; // the clerestory's foot, where the aisle roofs meet it
  const ch = 18; // the clerestory's height

  // --- 0: the platform
  if (f(0) === 0.5) {
    trenchRect(ctx, u0, v0, u1 + 0.75, v1 + 0.5, 0.2);
    for (let k = 0; k < 8; k++) {
      for (const v of [nv0, nv1]) quad(ctx, u0 + 0.25 + k * 0.45, v - 0.08, u0 + 0.41 + k * 0.45, v + 0.08, 0, C.trench); // the piers' footings
    }
    box(ctx, u0, v0, 1.6, v1 - v0, 0, 2, C.stone, { plain: true });
    stakeOut(ctx, [[u1, 1.5], [u1 + 0.75, 1.75], [u1 + 0.75, 2.75], [u1, 3.0]]);
    worker(ctx, 2.4, 1.3, 0, 0);
    worker(ctx, 3.1, 3.2, 0, 2);
  } else if (f(0) === 1) {
    box(ctx, u0 - 0.05, v0 - 0.05, u1 - u0 + 0.1, v1 - v0 + 0.6, 0, base, C.stone);
    stairs(ctx, u0 + 0.1, u1 - 0.1, v1 + 0.55, v1 + 0.95, 0, base, 3, C.stone);
  }

  // --- 1: the walls and the nave's piers; the clerestory over them
  if (f(1) > 0) {
    const full = f(1) === 1;
    if (!full) scaffold(ctx, u0, v0, u1 - u0, v1 - v0, base, base + 22, 'back');
    if (f(2) === 1) {
      // Roofed: the walls closed over by the aisles' roofs.
      box(ctx, u0, v0, u1 - u0, v1 - v0, base, BAS.wall, tr);
      gableRoof(ctx, u0, v0, u1 - u0, v1 - v0, zw, 8, C.terraDark, 'u', 0.05);
    } else {
      // Open to the sky: the walls (half raised, or whole), the floor and the
      // nave's piers inside (whole, they carry the clerestory).
      hallShell(ctx, u0, v0, u1, v1, base, full ? BAS.wall : 13, tr, () => {
        for (let k = 0; k < 8; k++) for (const v of [nv0, nv1]) box(ctx, u0 + 0.25 + k * 0.45, v - 0.06, 0.12, 0.12, base, full ? zc - base : 17, tr, { plain: true });
      });
    }
    if (full) {
      windows(ctx, 'right', u0, v0, u1, v1, base, 1, 4, C.glass, { z: base + 12, h: 8, w: 0.13 });
      // the clerestory, its windows high over the aisles
      box(ctx, u0, nv0, u1 - u0, nv1 - nv0, zc, ch, tr);
      windows(ctx, 'left', u0, nv0, u1, nv1, zc, 1, 8, C.glass, { z: zc + 5, h: 8, w: 0.17 });
      windows(ctx, 'right', u0, nv0, u1, nv1, zc, 1, 2, C.glass, { z: zc + 5, h: 8, w: 0.17 });
    }
  }

  // --- 2: the great timber roof over the nave (half: the trusses up, half the tiles on)
  if (f(2) > 0) {
    const zr = zc + ch;
    if (f(2) === 1) {
      gableRoof(ctx, u0 - 0.04, nv0 - 0.05, u1 - u0 + 0.08, nv1 - nv0 + 0.1, zr, 13, C.terra, 'u', 0.06);
    } else {
      scaffold(ctx, u0, nv0, u1 - u0, nv1 - nv0, zc, zr + 6, 'back');
      trusses(ctx, u0, u1, nv0 - 0.04, nv1 + 0.04, zr, 13, 0.4);
      gableRoof(ctx, u0 - 0.04, nv0 - 0.05, 1.5, nv1 - nv0 + 0.1, zr, 13, C.terra, 'u', 0.06);
      scaffold(ctx, u0, nv0, u1 - u0, nv1 - nv0, zc, zr + 6, 'front');
      worker(ctx, 2.6, nv1 + 0.1, zr + 2, 1);
    }
  }

  // --- 3: the apse at the end (a half drum under a half dome)
  if (f(3) > 0) {
    const [au, av, ar] = [u1, (v0 + v1) / 2, 0.72];
    const full = f(3) === 1;
    const h = full ? BAS.wall - 2 : 12;
    if (!full) scaffold(ctx, u1, av - ar, ar, ar * 2, base, base + h + 8, 'back');
    solid(ctx, arcBounds(au, av, ar + 0.05, base, base + h + 16, -Math.PI / 2, Math.PI / 2), () => {
      if (!full) {
        // the floor inside the half-raised wall
        const floor = [];
        for (let k = 0; k <= 14; k++) {
          const a = -Math.PI / 2 + (Math.PI * k) / 14;
          floor.push(P(au + Math.cos(a) * (ar - 0.14), av + Math.sin(a) * (ar - 0.14), base + 0.2));
        }
        poly(ctx, floor, '#7a6a54');
      }
      revolveRaw(ctx, au, av, [[ar, base], [ar, base + h]], tr, { seg: 14, a0: -Math.PI / 2, a1: Math.PI / 2 });
      if (full) {
        drumMarks(ctx, au, av, ar, 6, base + 9, 8, 0.14, C.glass, -Math.PI / 2 + Math.PI / 6 - TAU / 12);
        revolveRaw(ctx, au, av, [[ar + 0.04, base + h], [ar + 0.04, base + h + 2], ...domeProf(ar, base + h + 2, 12, 1, 0, 5)], C.terraDark, { seg: 14, a0: -Math.PI / 2, a1: Math.PI / 2 });
      } else {
        revolveRaw(ctx, au, av, [[ar, base + h], [ar - 0.14, base + h]], tr, { seg: 14, a0: -Math.PI / 2, a1: Math.PI / 2 });
      }
    });
    if (!full) {
      scaffold(ctx, u1, av - ar, ar, ar * 2, base, base + h + 8, 'front');
      worker(ctx, u1 + 0.82, av, base + 9, 3);
    }
  }

  // --- 1/2: the front: a colonnade under an entablature, the statues on it (3)
  if (f(1) > 0) {
    const full = f(1) === 1;
    for (let k = 0; k < 10; k++) column(ctx, u0 + 0.12 + k * 0.38, v1 + 0.42, base, full || k % 3 === 0 ? 24 : 8, C.marble, 1.8);
    if (full) {
      box(ctx, u0, v1, u1 - u0, 0.5, base + 24, 4, C.marble);
      if (f(2) === 1) box(ctx, u0, v1, u1 - u0, 0.5, base + 28, 0.8, C.terraDark, { plain: true });
      if (done) for (let k = 0; k < 6; k++) giltFigure(ctx, u0 + 0.3 + k * 0.62, v1 + 0.3, base + 28.8, 0.8);
    }
    if (!full) scaffold(ctx, u0, v0, u1 - u0, v1 - v0, base, base + 22, 'front');
  }
  if (stage === 3) worker(ctx, 1.4, v1 + 0.62, base, 4);

  // --- the tribunal before the apse (3): a dais, the curule chair, the fasces; or the yard
  if (done) {
    box(ctx, 4.15, 3.25, 0.62, 0.62, 0, 6, C.marble);
    stairs(ctx, 4.25, 4.67, 3.87, 4.05, 0, 6, 3, C.marble);
    piece(ctx, 4.46, 3.5, 6, 10, 0.1, (x, y) => {
      // the curule chair: an ivory folding seat on crossed legs
      ctx.strokeStyle = '#e8dcc0';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y - 5); ctx.moveTo(x + 3, y); ctx.lineTo(x - 3, y - 5); ctx.stroke();
      ctx.fillStyle = '#7a2848';
      ctx.fillRect(x - 3.6, y - 6.2, 7.2, 1.6);
    });
    for (const [fu, fv] of [[4.2, 3.32], [4.72, 3.32]]) {
      piece(ctx, fu, fv, 6, 14, 0.04, (x, y) => {
        // the lictors' fasces: rods bound round an axe
        ctx.fillStyle = '#9a7048';
        ctx.fillRect(x - 1.2, y - 12, 2.4, 12);
        ctx.strokeStyle = '#d9b26a';
        ctx.lineWidth = 0.5;
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - 1.2, y - 2 - k * 3); ctx.lineTo(x + 1.2, y - 3 - k * 3); ctx.stroke(); }
        ctx.fillStyle = '#c9ccd0';
        ctx.beginPath(); ctx.moveTo(x + 1.2, y - 12); ctx.lineTo(x + 3.6, y - 13); ctx.lineTo(x + 3.6, y - 9.6); ctx.lineTo(x + 1.2, y - 10.4); ctx.fill();
      });
    }
    cypress(ctx, 4.65, 0.45, 1);
    cypress(ctx, 4.7, 4.65, 0.9);
  } else {
    if (stage === 3) marbleBlocks(ctx, 4.2, 3.6); else bricks(ctx, 4.3, 3.6);
    logs(ctx, 4.25, 4.2, 0.55);
    planks(ctx, 4.25, 0.3);
    const top = [6, 26, 60, 32][stage];
    crane(ctx, 4.6, 0.95, 0, -0.5, 1, top + 12, Math.max(4, top - 10));
  }
}

// ---------------------------------------------------------------------------
// The Work Camp (3x3)
// ---------------------------------------------------------------------------

/** An ox, standing at (u, v), facing right (1) or left (-1). */
function ox(ctx, u, v, face = 1) {
  piece(ctx, u, v, 0, 12, 0.18, (x, y) => {
    const f = face;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(x, y, 7.5, 2.2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6a5a48';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const lx of [-4.6, -3, 3, 4.4]) { ctx.moveTo(x + f * lx, y - 4); ctx.lineTo(x + f * lx, y); }
    ctx.stroke();
    ctx.fillStyle = '#d9cbb0';
    ctx.beginPath(); ctx.ellipse(x, y - 6, 6.4, 3.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c9b99a';
    ctx.beginPath(); ctx.ellipse(x + f * 6.6, y - 6.4, 2.4, 2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#efe6d0';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x + f * 5.6, y - 8); ctx.quadraticCurveTo(x + f * 5.2, y - 11, x + f * 4, y - 10.6); ctx.moveTo(x + f * 7.6, y - 8); ctx.quadraticCurveTo(x + f * 8.4, y - 11, x + f * 9.4, y - 10.4); ctx.stroke();
    ctx.fillStyle = '#efe6d2';
    ctx.beginPath(); ctx.ellipse(x - f * 1, y - 7.6, 3.6, 1.1, 0, 0, TAU); ctx.fill();
  });
}

/** A low tent for the crew at (u, v). */
function crewTent(ctx, u, v, color = '#e3d7bb') {
  gableRoof(ctx, u, v, 0.42, 0.36, 0, 9, color, 'u', 0);
}

/**
 * The Castra Operarum: timber sheds along the back with sawn wood inside, a
 * domed brick kiln smoking at the back right, the crew's tents, a fenced
 * pen with the carts' oxen, and stacks of bricks, timber and marble by the
 * road with an ox cart loading.
 */
function workCampArt(ctx, S) {
  quad(ctx, 0.03, 0.03, S - 0.03, S - 0.03, 0, '#b6a07a');
  for (let k = 0; k < 10; k++) {
    const u = 0.2 + hash01(17, k, 1) * (S - 0.5);
    const v = 0.2 + hash01(17, k, 2) * (S - 0.5);
    quad(ctx, u, v, u + 0.14, v + 0.1, 0, k % 2 ? 'rgba(92,68,42,0.2)' : 'rgba(170,90,60,0.18)');
  }
  // the timber shed: open on its front, planks stacked inside
  box(ctx, 0.1, 0.1, 1.75, 0.66, 0, 13, '#a98458');
  onFace(ctx, 'left', 0.1, 0.1, 1.85, 0.76, 0, 11, (at) => {
    for (let k = 0; k < 3; k++) {
      const t = (k + 0.5) / 3;
      poly(ctx, [at(t - 0.13, 0), at(t + 0.13, 0), at(t + 0.13, 10), at(t - 0.13, 10)], 'rgba(44,32,22,0.85)');
      for (let j = 0; j < 3; j++) poly(ctx, [at(t - 0.12, j * 2.2), at(t + 0.12, j * 2.2), at(t + 0.12, j * 2.2 + 1.6), at(t - 0.12, j * 2.2 + 1.6)], j % 2 ? C.woodPale : '#b48858');
    }
  });
  gableRoof(ctx, 0.1, 0.1, 1.75, 0.66, 13, 7, '#8a6a48', 'u');
  // the brick kiln, smoking
  solid(ctx, arcBounds(2.4, 0.55, 0.36, 0, 20), () => {
    revolveRaw(ctx, 2.4, 0.55, [[0.34, 0], [0.34, 6], [0.29, 11], [0.2, 15], [0.1, 17.5], [0.1, 19], [0.06, 19]], C.brick, { seg: 18 });
    drumMarks(ctx, 2.4, 0.55, 0.34, 4, 0, 4, 0.16, '#e0782c', Math.PI / 4 - TAU / 8, true);
  });
  smoke(ctx, 2.42, 0.55, 20, true);
  // tents
  crewTent(ctx, 0.15, 1.05);
  crewTent(ctx, 0.68, 1.0, '#d8cba8');
  crewTent(ctx, 0.15, 1.6, '#d8cba8');
  // the ox pen: a rail fence round the oxen and their hay
  const pen = [1.45, 1.05, 2.9, 2.1];
  box(ctx, 2.45, 1.15, 0.3, 0.26, 0, 4, '#d6bd6a', { top: '#e4cc78' });
  const rail = (a, b) => {
    beam(ctx, [a[0], a[1], 3], [b[0], b[1], 3], C.wood, 0.9);
    beam(ctx, [a[0], a[1], 6], [b[0], b[1], 6], C.wood, 0.9);
  };
  rail([pen[0], pen[1]], [pen[2], pen[1]]);
  rail([pen[0], pen[1]], [pen[0], pen[3]]);
  for (const [u, v] of [[pen[0], pen[1]], [pen[2], pen[1]], [pen[0], pen[3]], [(pen[0] + pen[2]) / 2, pen[1]]]) pole(ctx, u, v, 0, 7.5, C.woodDark, 1.2);
  ox(ctx, 1.95, 1.55, 1);
  ox(ctx, 2.35, 1.85, -1);
  rail([pen[2], pen[1]], [pen[2], pen[3]]);
  rail([pen[0], pen[3]], [pen[2], pen[3]]);
  for (const [u, v] of [[pen[2], pen[3]], [pen[2], (pen[1] + pen[3]) / 2], [(pen[0] + pen[2]) / 2, pen[3]]]) pole(ctx, u, v, 0, 7.5, C.woodDark, 1.2);
  // the stacks by the road
  bricks(ctx, 0.15, 2.3);
  bricks(ctx, 0.52, 2.42, 2);
  logs(ctx, 0.95, 2.3, 0.6);
  marbleBlocks(ctx, 1.75, 2.4);
  cart(ctx, 2.25, 2.55);
}

// ---------------------------------------------------------------------------
// Registration (render/buildingArt.js)
// ---------------------------------------------------------------------------

/** Art per building key. */
export const MONUMENT_ART = Object.freeze({
  fanum_ceres: fanumArt,
  fanum_neptune: fanumArt,
  fanum_mercury: fanumArt,
  fanum_mars: fanumArt,
  fanum_venus: fanumArt,
  pantheum: pantheumArt,
  pharus: pharusArt,
  mansio_magna: mansioArt,
  thermae: thermaeArt,
  basilica: basilicaArt,
  work_camp: workCampArt,
});

/**
 * Extra art height (px above the footprint's top corner): room for the
 * tallest point of every stage at every turn (a temple 100 px up the
 * Fanum's terraces sits well back, so it needs less room than it rises),
 * with a few px to spare. The Pharus's figure stands 130 px over the water.
 */
export const MONUMENT_HEIGHT = Object.freeze({
  fanum_ceres: 64, fanum_neptune: 64, fanum_mercury: 64, fanum_mars: 64, fanum_venus: 64,
  pantheum: 50, pharus: 122, mansio_magna: 48, thermae: 52, basilica: 50, work_camp: 34,
});

/** Shadow lengths (tiles). */
export const MONUMENT_SHADOW = Object.freeze({
  fanum_ceres: 0.95, fanum_neptune: 0.95, fanum_mercury: 0.95, fanum_mars: 0.95, fanum_venus: 0.95,
  pantheum: 1.05, pharus: 0.9, mansio_magna: 0.5, thermae: 0.8, basilica: 0.9, work_camp: 0.35,
});
