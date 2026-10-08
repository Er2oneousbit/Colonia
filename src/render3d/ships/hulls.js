/**
 * ships/hulls.js
 * ----------------------------------------------------------------------------
 * The vessels' kits (designs.js says what each is and why): the model
 * pass builds them by key as it builds a building's look (models.js
 * MODEL_PARTS 'vessel') and draws every copy instanced, one draw a part:
 *
 *   vessel:<kind>:hull        the hull and all that stands still on it: the
 *                             shell's strakes (pitched below the water,
 *                             painted above), wales, rail, decks, the
 *                             deckhouse, masts and standing rigging, the
 *                             steering oars, the cargo, the lantern (lit at
 *                             night: tagged 'open', its dark pane 'shut')
 *   vessel:<kind>:yard        a mast's yard and its lifts (turned with the
 *                             wind, a brace about the mast)
 *   vessel:<kind>:sail[:c]    the sail hanging from the yard, its belly
 *                             along +z (the pass scales it by how full it
 *                             is, and up toward the yard as it is brailed);
 *                             a merchant's sail its partner's colour `c`
 *   vessel:<kind>:furl        the sail brailed up along the yard
 *   vessel:net                a fishing net cast on the water: its ring of
 *                             cork floats and the lines between
 *   vessel:catch              a basket of the catch
 *   vessel:debris             what floats off a ship that sinks: planks, a
 *                             spar, an amphora
 *
 * Built in the ship's frame with the waterline at y = 0 (a design's hull is
 * made keel at 0 and lowered by its draft); the look's clip hides what is
 * under the water. Materials: the harbour's (models/harbour.js) for wood,
 * rope, bronze and the sails' linen, one plain painted material taking its
 * colours from the vertices (paint, pitch, the eye), so a hull is a few
 * draws: wood, paint, metal, rope, the lantern's pane.
 * ----------------------------------------------------------------------------
 */

import { BufferGeometry, Float32BufferAttribute, CylinderGeometry, BoxGeometry, SphereGeometry, DoubleSide, TorusGeometry } from 'three';
import { boxUV, tintGeometry, tube, revolve, profileOf } from '../shapes.js';
import { material } from '../materials.js';
import { artRng } from '../texgen.js';
import { TaggedParts, lantern } from '../models/masonry.js';
import { lin, jar, basket, heap, paint } from '../models/rural.js';
import { harbourMaterials, sweep, board } from '../models/harbour.js';
import { DESIGNS, hullAt, deckY, mastOf, yardAt, benches, tAt } from './designs.js';
import { BEAT } from '../people/clips.js';

/** Where the liburnian's hortator stands (t along the hull, on the stern's fighting deck): look.js puts him there. */
export const HORTATOR_T = 0.205;

/** Materials the ships add to the harbour's: painted wood (plain, by vertex colour) and sailcloth seen from both sides. */
export function shipMaterials() {
  return {
    ...harbourMaterials(),
    painted: material('ship-paint', { color: 0xffffff, roughness: 0.62, vertexColors: true, snow: 0.9 }),
    // (Sailcloth lets the sun through: its shaded side glows a little by day, sailGlow.)
    cloth: material('sail-cloth', { surface: 'wool', color: 0xf2ead6, vertexColors: true, side: DoubleSide, snow: 0.35, normal: 0.6, emissive: 0xf4e6c8, emissiveIntensity: 0 }),
    hide: material('sail-hide', { surface: 'wool', color: 0xb08a62, vertexColors: true, side: DoubleSide, snow: 0.35, normal: 1.2, emissive: 0x6a4a2a, emissiveIntensity: 0 }),
  };
}

const PITCH = lin(0x2a2522);

/**
 * How much the sails glow with the light through them (0 at night, the
 * daylight's share by day): a sail seen from its shaded side is not dark,
 * linen and hide let the sun through (pass.js sets it each frame).
 */
export function sailGlow(day) {
  const m = shipMaterials();
  m.cloth.emissiveIntensity = 0.13 * day;
  m.hide.emissiveIntensity = 0.12 * day;
}

/** A grid of points (rows along, columns across) as a surface; `col(i, j, p)` its colour (a number or linear rgb). */
function surface(rows, col, flip = false) {
  const R = rows.length;
  const C = rows[0].length;
  const pos = [];
  const uv = [];
  const cl = [];
  const idx = [];
  for (let i = 0; i < R; i++) {
    let u = 0;
    for (let j = 0; j < C; j++) {
      const p = rows[i][j];
      if (j) u += Math.hypot(p[0] - rows[i][j - 1][0], p[1] - rows[i][j - 1][1], p[2] - rows[i][j - 1][2]);
      pos.push(p[0], p[1], p[2]);
      uv.push(u, p[2]);
      const k = col(i, j, p);
      if (typeof k === 'number') cl.push(k, k, k);
      else cl.push(k[0], k[1], k[2]);
    }
  }
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < C - 1; j++) {
      const a = i * C + j;
      const b = a + C;
      if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1);
      else idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(cl, 3));
  g.computeVertexNormals();
  return g;
}

/** A starboard geometry mirrored to port (its winding turned so it still faces out). */
function mirror(g) {
  const m = g.clone();
  m.scale(-1, 1, 1);
  const idx = m.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const k = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = k;
  }
  m.computeVertexNormals();
  return m;
}

/** The inward normal of the section at (t, f) (starboard side), in x-y. */
function inward(d, t, f) {
  const a = hullAt(d, t, Math.max(0, f - 0.01));
  const b = hullAt(d, t, Math.min(1, f + 0.01));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  return [-dy / l, dx / l];
}

/** A run of points along the hull at girth f, `off` out from the planking, t0 to t1. */
function run(d, f, off, t0, t1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const p = hullAt(d, t, f);
    const [nx, ny] = inward(d, t, f);
    pts.push([p[0] - nx * off, p[1] - ny * off, p[2]]);
  }
  return pts;
}

/** A plain painted piece: its geometry coloured `hex` (sRGB), times `k`. */
function painted(g, hex, k = 1) {
  return paint(boxUV(g), lin(hex, k));
}

/**
 * The shell: the strakes edge to edge, pitched below the waterline, their
 * own tones above, the top strakes painted (`paintFrom` girth up) in the
 * design's band; the inside a plank in, darker; the top edge. Pushes into
 * out.wood and out.painted (the hull frame, keel at 0).
 */
function shell(d, out, lod, rnd, { T0 = 0.015, T1 = 0.985, paintFrom = 0.8 } = {}) {
  const NT = lod === 0 ? 30 : lod === 1 ? 14 : 7;
  const strakes = lod === 0 ? 11 : lod === 1 ? 6 : 3;
  const ts = [];
  for (let i = 0; i <= NT; i++) ts.push(T0 + ((T1 - T0) * i) / NT);
  const water = d.draft;
  const band = lin(d.paint.band);
  for (let s = 0; s < strakes; s++) {
    const f0 = s / strakes;
    const f1 = (s + 1) / strakes;
    const tone = 0.8 + rnd() * 0.26;
    const fs = lod === 0 ? [f0, f0 + 0.08 / strakes, f1 - 0.08 / strakes, f1] : [f0, f1];
    const rows = ts.map((t) => fs.map((f) => hullAt(d, t, f)));
    const top = f0 >= paintFrom - 1e-6;
    const g = surface(rows, (i, j, p) => {
      const seam = lod === 0 && (j === 0 || j === fs.length - 1) ? 0.66 : 1;
      // Pitched up to a hand over the waterline, as the hulls of the wrecks were.
      if (p[1] < water + 0.07) return [PITCH[0] * seam, PITCH[1] * seam, PITCH[2] * seam];
      if (top) return [band[0] * seam, band[1] * seam, band[2] * seam];
      return tone * seam;
    }, true);
    (top ? out.painted : out.wood).push(g, mirror(g));
    if (lod < 2) {
      const inner = ts.map((t) => fs.map((f) => {
        const p = hullAt(d, t, f);
        const [nx, ny] = inward(d, t, f);
        return [p[0] + nx * 0.04, p[1] + ny * 0.04, p[2]];
      }));
      const gi = surface(inner, () => 0.45 * tone);
      out.wood.push(gi, mirror(gi));
    }
  }
  // The planking's top edge, from the outside to the inside.
  if (lod < 2) {
    const rows = ts.map((t) => {
      const p = hullAt(d, t, 1);
      const [nx, ny] = inward(d, t, 1);
      return [p, [p[0] + nx * 0.04, p[1] + ny * 0.04, p[2]]];
    });
    const g = surface(rows, () => 0.7, true);
    out.wood.push(g, mirror(g));
  }
  // The keel under the middle line.
  const keel = [];
  for (let i = 0; i <= 14; i++) {
    const t = 0.03 + (0.94 * i) / 14;
    const p = hullAt(d, t, 0);
    keel.push([0, p[1] - 0.06, p[2]]);
  }
  out.wood.push(sweep(keel, 0.12, 0.14, { side: [1, 0, 0], tint: () => 0.55 }));
}

/** Wales along the sides (thick strakes standing proud) at girths `fs`, the top one in the design's wale colour. */
function wales(d, out, fs, lod, t0 = 0.05, t1 = 0.96) {
  const n = lod === 2 ? 6 : 14;
  for (const f of fs) {
    const g = sweep(run(d, f, 0.035, t0, t1, n), 0.09, 0.07, { side: [0, 1, 0] });
    painted(g, d.paint.wale);
    out.painted.push(g, mirror(g));
  }
}

/** The gunwale's cap along the whole sheer (and, `rail`, a light rail on stanchions over it). */
function gunwale(d, out, lod, { rail = 0, colour = null, t0 = 0.03, t1 = 0.97 } = {}) {
  const n = lod === 2 ? 8 : 18;
  const cap = run(d, 1, -0.01, t0, t1, n).map((p) => [p[0], p[1] + 0.03, p[2]]);
  const g = sweep(cap, 0.08, 0.06, { side: [1, 0, 0] });
  if (colour !== null) painted(g, colour);
  (colour !== null ? out.painted : out.wood).push(g, mirror(g));
  if (!rail || lod === 2) return;
  const top = cap.map((p) => [p[0] - 0.01, p[1] + rail, p[2]]);
  const r = sweep(top, 0.05, 0.05, { side: [1, 0, 0] });
  out.wood.push(r, mirror(r));
  const every = lod ? 2 : 1;
  for (let i = 1; i < cap.length - 1; i += every) {
    const st = board(0.04, rail, 0.04, { tone: 0.8 }).translate(cap[i][0] - 0.01, cap[i][1], cap[i][2]);
    out.wood.push(st, mirror(st));
  }
}

/**
 * A planked deck across the hull at the design's deck girth from t0 to t1,
 * leaving out `gaps` ([ta, tb]: a hatch), the planks running fore and aft.
 */
function deck(d, out, lod, t0, t1, gaps = [], drop = 0.03) {
  const n = lod === 2 ? 4 : 12;
  const ts = [];
  for (let i = 0; i <= n; i++) ts.push(t0 + ((t1 - t0) * i) / n);
  const cuts = [[t0, t1]];
  for (const [a, b] of gaps) {
    const c = cuts.pop();
    cuts.push([c[0], a], [b, c[1]]);
  }
  const across = lod === 0 ? 8 : 3;
  for (const [a, b] of cuts) {
    const tt = [];
    const m = Math.max(2, Math.round(((b - a) / (t1 - t0)) * n));
    for (let i = 0; i <= m; i++) tt.push(a + ((b - a) * i) / m);
    const rows = tt.map((t) => {
      const p = hullAt(d, t, d.deck);
      const y = p[1] - drop;
      const row = [];
      for (let j = 0; j <= across; j++) row.push([-p[0] + (2 * p[0] * j) / across, y, p[2]]);
      return row;
    });
    out.wood.push(surface(rows, (i, j) => (lod === 0 ? 0.84 + 0.14 * ((j * 7) % 3) / 2 : 0.9), true));
  }
}

/** A mast: a tapered pole from its foot along its direction, `h` long, with a masthead block. */
function mast(out, foot, dir, h, r0, lod) {
  const seg = lod === 0 ? 12 : lod === 1 ? 7 : 5;
  const g = new CylinderGeometry(r0 * 0.6, r0, h, seg);
  g.translate(0, h / 2, 0);
  const a = Math.atan2(dir[2], dir[1]);
  g.rotateX(a);
  g.translate(foot[0], foot[1], foot[2]);
  out.wood.push(tintGeometry(boxUV(g), () => 0.78));
  if (lod < 2) {
    const head = new BoxGeometry(r0 * 1.6, r0 * 2.2, r0 * 1.6);
    head.translate(0, h - r0, 0).rotateX(a).translate(foot[0], foot[1], foot[2]);
    out.wood.push(tintGeometry(boxUV(head), () => 0.6));
  }
}

/**
 * A rope from a to b with a little sag, painted the dark of tarred hemp (a
 * rope's own texture is lost on a line a centimetre thick; one part fewer).
 * `into` the list it goes in (the painted parts, or a yard's wood).
 */
function line(out, a, b, lod, r = 0.014, sag = 0.04, into = 'painted') {
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2];
  const g = tube([a, m, b], r, { radial: lod ? 3 : 4, segments: lod ? 3 : 6, around: 0.05 });
  if (into === 'painted') out.painted.push(painted(g, 0x4a3c2e));
  else out[into].push(tintGeometry(g, () => 0.3));
}

/** A steering oar on the quarter (side s), its loom down and aft into the water, its tiller inboard. */
function steeringOar(d, out, s, lod) {
  const r = d.rudders;
  const q = hullAt(d, r.t, r.f);
  const x = s * (q[0] + 0.12);
  const top = [x, q[1] + 0.5, q[2] + 0.25];
  const mid = [s * (q[0] + 0.24), q[1] - 0.15, q[2] - 0.2];
  const low = [s * (q[0] + 0.3), d.draft - 0.55, q[2] - 0.62];
  out.wood.push(sweep([top, mid, low], 0.075, 0.075, { side: [1, 0, 0], tint: () => 0.7 }));
  const blade = board(0.05, 0.5, 0.36, { tone: 0.62 });
  blade.rotateX(-0.6).translate(low[0], low[1] - 0.45, low[2] - 0.12);
  out.wood.push(blade);
  // The tiller across the loom's head, inboard.
  out.wood.push(sweep([[top[0], top[1] - 0.05, top[2]], [s * Math.max(0.12, q[0] - 0.55), top[1] - 0.12, top[2] + 0.12]], 0.04, 0.04, { side: [0, 1, 0], tint: () => 0.66 }));
  // The bracket and lashing it turns in.
  if (lod < 2) out.wood.push(board(0.12, 0.12, 0.34, { tone: 0.6 }).translate(s * (q[0] + 0.06), q[1] - 0.02, q[2] + 0.12));
}

/** Round shields hung along the rail (the raiders'), `cols` sRGB painted faces. */
function shieldsAlongRail(d, out, lod, cols, n, t0, t1, seed) {
  if (lod === 2) return;
  const rnd = artRng(seed);
  for (let k = 0; k < n; k++) {
    const t = t0 + ((t1 - t0) * (k + 0.5)) / n;
    for (const s of [1, -1]) {
      const p = hullAt(d, t, 1);
      const g = new CylinderGeometry(0.22, 0.22, 0.03, lod ? 10 : 16);
      g.rotateZ(Math.PI / 2).translate(s * (p[0] + 0.03), p[1] - 0.02, p[2]);
      const c = cols[Math.floor(rnd() * cols.length)];
      out.painted.push(painted(g, c, 0.9 + rnd() * 0.2));
      const boss = new SphereGeometry(0.05, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      boss.rotateZ(-s * Math.PI / 2).translate(s * (p[0] + 0.045), p[1] - 0.02, p[2]);
      out.bronze.push(tintGeometry(boxUV(boss), () => 0.8));
    }
  }
}

/** The eye on the bow, each side (against ill luck; to see the way), at full detail. */
function eyes(d, out, t, f, r = 0.1) {
  const p = hullAt(d, t, f);
  const [nx, ny] = inward(d, t, f);
  for (const s of [1, -1]) {
    const e = new SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.18);
    e.scale(1.5, 1, 0.75);
    e.rotateZ(-s * Math.PI / 2);
    e.translate(s * (p[0] - nx * 0.06), p[1] - ny * 0.06, p[2]);
    out.painted.push(painted(e, 0xece6d8));
    const pu = new SphereGeometry(r * 0.5, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.2);
    pu.rotateZ(-s * Math.PI / 2);
    pu.translate(s * (p[0] - nx * (0.06 + r * 0.22)), p[1] - ny * 0.08, p[2] + r * 0.25);
    out.painted.push(painted(pu, 0x15181c));
  }
}

/** A bronze ram over the forefoot (after the Athlit ram): a sheath tapering forward to three fins. */
function ram(d, out, size = 1) {
  const fore = hullAt(d, 0.985, 0);
  const z0 = fore[2] - 0.32 * size;
  const head = fore[2] + 0.52 * size;
  const sec = (z, w, h, y) => [[-w, y - h, z], [w, y - h, z], [w, y + h, z], [-w, y + h, z]];
  const A = sec(z0, 0.17 * size, 0.22 * size, 0.24);
  const B = sec(head - 0.1, 0.11 * size, 0.12 * size, 0.3);
  const pos = [];
  for (let k = 0; k < 4; k++) {
    const q = [A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]];
    pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
  }
  pos.push(...B[0], ...B[1], ...B[2], ...B[0], ...B[2], ...B[3]);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  out.gilt.push(tintGeometry(boxUV(g), () => 0.9));
  for (const y of [0.2, 0.3, 0.4]) out.gilt.push(tintGeometry(boxUV(new BoxGeometry(0.34 * size, 0.03, 0.16).translate(0, y, head - 0.04)), () => 1));
  out.gilt.push(tintGeometry(boxUV(new BoxGeometry(0.03, 0.28 * size, 0.2).translate(0, 0.3, head - 0.02)), () => 1));
}

/** A stem or a sternpost: along `pts` ([dy, dz] from the sheer's end at t). */
function post(d, out, t, pts, w, h, key = 'wood', taper = 1) {
  const p = hullAt(d, t, 1);
  const path = pts.map(([y, z]) => [0, p[1] + y, p[2] + z]);
  out[key].push(sweep(path, w, h, { side: [1, 0, 0], taper }));
}

/** Amphorae stowed upright in the hold between t0 and t1 at floor y (the wrecks' cargo), `n` a row. */
function amphorae(d, out, lod, t0, t1, y, rows, seed) {
  if (lod === 2) return;
  const rnd = artRng(seed);
  const step = lod ? 0.36 : 0.28;
  for (let t = t0; t <= t1 + 1e-6; t += (step / (d.hull.L - 0.7))) {
    const half = hullAt(d, t, 0.6)[0] - 0.15;
    const z = (t - 0.5) * (d.hull.L - 0.7);
    for (let k = 0; k < rows; k++) {
      const x = -half + ((2 * half) * (k + 0.5)) / rows;
      const g = jar({ amphora: true, lod: 1, seed: seed + k });
      g.scale(0.62, 0.62, 0.62).rotateY(rnd() * 3).translate(x, y, z);
      out.painted.push(paint(g, lin(0xb4693e, 0.85 + rnd() * 0.25)));
    }
  }
}

/**
 * Where each kind's stern lantern hangs (the ship's frame, the water at 0):
 * recorded as its hull is built, for the night's light map (pass.js).
 */
export const LANTERNS = new Map();

/** The stern lantern on a bracket (bronze, its horn pane lit at night): pushes into out.bronze and out.pane. */
function sternLantern(d, out, lod, at) {
  const l = lantern(at[0], at[1], at[2], lod);
  out.bronze.push(...l.bronze);
  out.pane.push(l.pane);
  // Its post, down to the deck (or the planking) it stands on.
  const t = tAt(d, at[2]);
  const foot = Math.min(at[1] - 0.1, hullAt(d, Math.max(0.03, t), d.deck)[1] - 0.04);
  out.wood.push(board(0.05, at[1] - foot, 0.05, { tone: 0.6 }).translate(at[0], foot, at[2]));
  out.lantern = at;
}

// ---------------------------------------------------------------------------
// The kinds
// ---------------------------------------------------------------------------

/** The common parts of a hull's kit, by name, as harbourMaterials keys plus the ships'. */
function newOut() {
  return { wood: [], painted: [], gilt: [], bronze: [], rope: [], pane: [], hide: [] };
}

/** Masts and standing rigging of a design (forestay, backstay, shrouds). */
function rigging(d, out, lod, r0 = 0.09) {
  d.masts.forEach((m, i) => {
    const { foot, dir } = mastOf(d, i);
    // (A mast is stepped through the deck into the keelson: start it a little under.)
    const f0 = [foot[0], foot[1] - 0.3 * dir[1], foot[2] - 0.3 * dir[2]];
    mast(out, f0, dir, m.h + 0.35, i === 0 ? r0 : r0 * 0.7, lod);
    if (lod === 2) return;
    const head = [foot[0] + dir[0] * m.h, foot[1] + dir[1] * m.h, foot[2] + dir[2] * m.h];
    if (m.rake > 0.3) return; // (the artemon is stayed by the forestay that runs to it)
    const bow = hullAt(d, 0.97, 1);
    const stern = hullAt(d, 0.05, 1);
    line(out, head, [0, bow[1] + 0.1, bow[2] - 0.1], lod, 0.016, 0.02);
    line(out, head, [0, stern[1] + 0.2, stern[2] + 0.4], lod, 0.016, 0.05);
    for (const s of [1, -1]) {
      for (const dt of lod ? [-0.03] : [-0.05, 0.01]) {
        const at = hullAt(d, m.t + dt, 1);
        line(out, [head[0], head[1] - 0.2, head[2]], [s * at[0], at[1] + 0.04, at[2]], lod, 0.012, 0.01);
      }
    }
  });
}

function buildCorbita(d, lod, out, rnd) {
  shell(d, out, lod, rnd, { paintFrom: 0.84 });
  wales(d, out, [0.62, 0.8], lod);
  gunwale(d, out, lod, { rail: 0.32 });
  const hatch = [0.39, 0.5];
  deck(d, out, lod, 0.07, 0.95, [hatch]);
  // The hold under the hatch: its floor, the amphorae stowed upright on it, the coaming round it.
  const floorY = 0.62;
  const ha = hullAt(d, hatch[0], d.deck);
  const hb = hullAt(d, hatch[1], d.deck);
  out.wood.push(board(1.6, 0.04, hb[2] - ha[2] + 0.2, { tone: 0.5 }).translate(0, floorY - 0.04, (ha[2] + hb[2]) / 2));
  amphorae(d, out, lod, hatch[0] + 0.01, hatch[1] - 0.01, floorY, 4, 31);
  if (lod < 2) {
    for (const z of [ha[2], hb[2]]) out.wood.push(board(1.5, 0.14, 0.08, { tone: 0.72 }).translate(0, ha[1] - 0.04, z));
    for (const s of [1, -1]) out.wood.push(board(0.08, 0.14, hb[2] - ha[2], { tone: 0.72 }).translate(s * 0.72, ha[1] - 0.04, (ha[2] + hb[2]) / 2));
  }
  // The deckhouse aft (the master's cabin), planked, its roof curved, its door forward.
  const c0 = hullAt(d, 0.14, d.deck);
  const c1 = hullAt(d, 0.3, d.deck);
  const cy = Math.max(c0[1], c1[1]) - 0.03;
  const cw = 1.3;
  const cl = c1[2] - c0[2];
  const ch = 0.58;
  out.wood.push(board(cw, ch, cl, { tone: 1.05 }).translate(0, cy, (c0[2] + c1[2]) / 2));
  // Its roof: a shallow barrel of planks over it, painted (the arc's middle up: a cylinder's theta 0 is +z, turned to +y).
  const R = 0.95;
  const half = Math.asin((cw / 2 + 0.06) / R);
  const roof = new CylinderGeometry(R, R, cl + 0.14, lod ? 8 : 14, 1, true, Math.PI - half, 2 * half);
  roof.rotateX(Math.PI / 2).translate(0, cy + ch - R * Math.cos(half) + 0.02, (c0[2] + c1[2]) / 2);
  out.painted.push(painted(roof, d.paint.band, 0.8));
  const under = roof.clone();
  under.scale(0.98, 0.98, 1);
  out.wood.push(mirror(tintGeometry(boxUV(under), () => 0.45)));
  if (lod < 2) {
    out.painted.push(painted(new BoxGeometry(0.42, 0.48, 0.03).translate(0, cy + 0.04, c1[2] + 0.005), 0x2a1e16));
    // Its little windows each side.
    for (const s of [1, -1]) out.painted.push(painted(new BoxGeometry(0.03, 0.14, 0.22).translate(s * (cw / 2 + 0.005), cy + 0.36, (c0[2] + c1[2]) / 2), 0x1a1410));
  }
  // The sternpost: up from the stern and curling forward over the deckhouse into a swan's neck, the head gilt.
  post(d, out, 0.015, [[0.1, 0.25], [0.55, -0.05], [1.15, -0.18], [1.65, -0.02], [1.85, 0.3], [1.72, 0.6], [1.55, 0.68]], 0.16, 0.16, 'wood', 0.5);
  const st = hullAt(d, 0.015, 1);
  // The swan's head at the neck's end, looking forward and down, gilt.
  const neck = new SphereGeometry(0.09, lod ? 6 : 10, lod ? 4 : 8);
  neck.scale(0.9, 0.8, 1.6).rotateX(0.5).translate(0, st[1] + 1.5, st[2] + 0.74);
  out.gilt.push(tintGeometry(boxUV(neck)));
  if (lod < 2) {
    const beak = new CylinderGeometry(0.0, 0.035, 0.16, 6).rotateX(Math.PI / 2 + 0.6).translate(0, st[1] + 1.43, st[2] + 0.86);
    out.gilt.push(tintGeometry(boxUV(beak)));
  }
  // The stem, raked forward over the cutwater.
  post(d, out, 0.985, [[-1.3, -0.15], [-0.7, 0.06], [-0.2, 0.18], [0.2, 0.26], [0.42, 0.24]], 0.14, 0.15);
  // The steering oars on both quarters.
  for (const s of [1, -1]) steeringOar(d, out, s, lod);
  rigging(d, out, lod, 0.1);
  // A pennant-pole aft and a gilt band at the masthead.
  if (lod < 2) {
    const { foot, dir } = mastOf(d, 0);
    const top = [foot[0], foot[1] + dir[1] * d.masts[0].h, foot[2]];
    out.gilt.push(tintGeometry(boxUV(new CylinderGeometry(0.075, 0.075, 0.08, 10).translate(top[0], top[1] - 0.18, top[2]))));
  }
  sternLantern(d, out, lod, [0, st[1] + 0.55, st[2] + 0.42]);
}

function buildCoaster(d, lod, out, rnd) {
  shell(d, out, lod, rnd, { paintFrom: 0.84 });
  wales(d, out, [0.72], lod);
  gunwale(d, out, lod, { rail: 0 });
  // Half decks fore and aft, the hold open between them, its amphorae showing.
  deck(d, out, lod, 0.06, 0.32);
  deck(d, out, lod, 0.74, 0.95);
  const floorY = 0.44;
  const a = hullAt(d, 0.32, 0.5);
  const b = hullAt(d, 0.74, 0.5);
  out.wood.push(board(1.3, 0.04, b[2] - a[2], { tone: 0.5 }).translate(0, floorY - 0.04, (a[2] + b[2]) / 2));
  amphorae(d, out, lod, 0.34, 0.72, floorY, 3, 41);
  // Thwarts across the open hold.
  if (lod < 2) {
    for (const t of [0.44, 0.62]) {
      const p = hullAt(d, t, 0.9);
      out.wood.push(board(p[0] * 2, 0.05, 0.2, { tone: 0.85 }).translate(0, p[1] - 0.05, p[2]));
    }
  }
  post(d, out, 0.015, [[0.1, 0.2], [0.5, -0.04], [0.95, -0.12], [1.22, 0.02], [1.25, 0.16]], 0.13, 0.13, 'wood', 0.6);
  post(d, out, 0.985, [[-0.9, -0.1], [-0.4, 0.06], [0.1, 0.16], [0.3, 0.16]], 0.12, 0.13);
  steeringOar(d, out, 1, lod);
  rigging(d, out, lod, 0.08);
  const st = hullAt(d, 0.015, 1);
  sternLantern(d, out, lod, [0, st[1] + 0.62, st[2] + 0.3]);
}

/**
 * The liburnian afloat: the hull the Navalia builds (its shape, wales, oar
 * box, gilt rail, ram and eye after models/harbour.js liburnianHull), here
 * with its upper bank's ports where its rowers' sweeps come out (benches),
 * a narrow raised gangway between the rowers instead of the slip's wide
 * one, their benches under them, the fighting decks fore and aft, and a
 * mast, the steering oars lowered into the water.
 */
function buildLiburnian(d, lod, out, rnd) {
  shell(d, out, lod, rnd, { paintFrom: 0.72 });
  wales(d, out, [0.55], lod);
  // The upper wale in the paint's red.
  const up = sweep(run(d, 0.8, 0.035, 0.05, 0.96, lod === 2 ? 6 : 14), 0.09, 0.06, { side: [0, 1, 0] });
  painted(up, d.paint.band, 0.9);
  out.painted.push(up, mirror(up));
  // The oar box along each side at the sheer, its ports where the benches' sweeps come out.
  const box = [];
  for (let i = 0; i <= 8; i++) {
    const t = 0.24 + (0.58 * i) / 8;
    const p = hullAt(d, t, 0.94);
    box.push([p[0] + 0.12, p[1] + 0.02, p[2]]);
  }
  const ob = sweep(box, 0.22, 0.17, { side: [1, 0, 0] });
  painted(ob, d.paint.band);
  out.painted.push(ob, mirror(ob));
  const B = benches(d);
  if (lod < 2) {
    for (const b of B) {
      const port = new BoxGeometry(0.025, 0.08, 0.11).translate(b.thole[0] + b.s * 0.005, b.thole[1], b.thole[2]);
      out.painted.push(painted(port, 0x101010));
      // The lower bank's ports (closed: this bank is not manned in the provincial fleet's peace).
      const q = hullAt(d, b.t - 0.035, 0.66);
      const lo = new CylinderGeometry(0.035, 0.035, 0.02, 8).rotateZ(Math.PI / 2).translate(b.s * (q[0] + 0.012), q[1], q[2]);
      out.painted.push(painted(lo, 0x2a1a12));
    }
  }
  gunwale(d, out, lod, { colour: d.paint.trim });
  // The rowers' benches across, under each pair; the narrow gangway over the middle line above their knees.
  if (lod < 2) {
    for (const b of B) {
      if (b.s < 0) continue;
      const w = hullAt(d, b.t, 0.4)[0] * 2 + 0.2;
      out.wood.push(board(w, 0.05, 0.24, { tone: 0.9 }).translate(0, b.at[1] + 0.33, b.at[2] - 0.2));
      // The stretcher their feet push on.
      out.wood.push(board(w - 0.1, 0.06, 0.06, { tone: 0.7 }).translate(0, b.at[1] + 0.02, b.at[2] + 0.36));
    }
    const g0 = hullAt(d, 0.24, 0.9);
    const g1 = hullAt(d, 0.82, 0.9);
    out.wood.push(board(0.22, 0.04, g1[2] - g0[2], { tone: 0.88 }).translate(0, hullAt(d, 0.5, 0.97)[1] + 0.02, (g0[2] + g1[2]) / 2));
  }
  // The fighting decks over the bow and the stern.
  deck(d, out, lod, 0.05, 0.22, [], 0.02);
  // The hortator's block on its post at the stern deck's fore edge, where his mallet comes down (people/clips.js BEAT).
  {
    const y = deckY(d, HORTATOR_T) - 0.02;
    const z = (HORTATOR_T - 0.5) * (d.hull.L - 0.7) + BEAT.ahead;
    const x = 0.05 + BEAT.side;
    out.wood.push(board(0.08, BEAT.height - 0.1, 0.08, { tone: 0.7 }).translate(x, y, z));
    out.wood.push(board(0.2, 0.1, 0.16, { tone: 0.85 }).translate(x, y + BEAT.height - 0.1, z));
  }
  deck(d, out, lod, 0.83, 0.95, [], 0.02);
  // Stem, the sternpost curling up and forward, gilt.
  const bow = hullAt(d, 0.985, 1);
  out.wood.push(sweep([[0, 0.02, bow[2] - 0.1], [0, 0.35, bow[2] + 0.06], [0, 0.75, bow[2] + 0.13], [0, bow[1] + 0.12, bow[2] + 0.16], [0, bow[1] + 0.32, bow[2] + 0.12]], 0.13, 0.15, { side: [1, 0, 0] }));
  const st = hullAt(d, 0.015, 1);
  out.gilt.push(sweep([[0, 0.32, st[2] + 0.25], [0, 0.6, st[2] - 0.02], [0, st[1], st[2] - 0.14], [0, st[1] + 0.5, st[2] - 0.26], [0, st[1] + 0.95, st[2] - 0.18], [0, st[1] + 1.2, st[2] + 0.02], [0, st[1] + 1.18, st[2] + 0.2], [0, st[1] + 1.06, st[2] + 0.3]], 0.12, 0.15, { side: [1, 0, 0], taper: 0.55 }));
  ram(d, out);
  if (lod < 2) {
    // The boar's head over the ram at the wale's end.
    const w = hullAt(d, 0.97, 0.8);
    const boar = revolve(profileOf([[0, 0], [0.07, 0], [0.09, 0.1], [0.07, 0.2], [0.03, 0.26], [0, 0.27]]), { segments: lod ? 6 : 10, metres: 0.3 });
    boar.rotateX(Math.PI / 2).translate(0, w[1], w[2] + 0.08);
    out.bronze.push(boar);
  }
  if (lod === 0) eyes(d, out, 0.9, 0.72);
  for (const s of [1, -1]) steeringOar(d, out, s, lod);
  rigging(d, out, lod, 0.08);
  // The marines' shields hung on the rail of the fighting decks: Rome's red with a bronze boss.
  shieldsAlongRail(d, out, lod, [0x9e3426, 0xa8322b], 2, 0.06, 0.2, 7);
  sternLantern(d, out, lod, [0, st[1] + 0.62, st[2] + 0.12]);
}

/** The lembos: low and lean, a pointed cutwater, the stern curling in, round shields along the rail. */
function buildLembos(d, lod, out, rnd) {
  shell(d, out, lod, rnd, { paintFrom: 0.86 });
  wales(d, out, [0.7], lod);
  gunwale(d, out, lod, { colour: d.paint.trim });
  deck(d, out, lod, 0.04, 0.17, [], 0.02);
  deck(d, out, lod, 0.88, 0.96, [], 0.02);
  if (lod < 2) {
    for (const b of benches(d)) {
      const w = hullAt(d, b.t, 0.5)[0] * 2;
      out.wood.push(board(w, 0.05, 0.2, { tone: 0.8 }).translate(0, b.at[1] + 0.33, b.at[2] - 0.2));
    }
  }
  // The cutwater: a pointed beak of oak, iron-tipped, at the waterline.
  const fore = hullAt(d, 0.985, 0.1);
  out.wood.push(sweep([[0, d.draft + 0.05, fore[2] - 0.4], [0, d.draft + 0.02, fore[2] + 0.1], [0, d.draft + 0.08, fore[2] + 0.55]], 0.12, 0.16, { side: [1, 0, 0], taper: 0.3, tint: () => 0.5 }));
  post(d, out, 0.985, [[-0.6, -0.06], [-0.1, 0.12], [0.35, 0.22], [0.7, 0.16], [0.82, 0.02]], 0.12, 0.14, 'wood', 0.5);
  post(d, out, 0.015, [[0.1, 0.2], [0.5, -0.04], [0.95, -0.08], [1.25, 0.08], [1.3, 0.28]], 0.12, 0.13, 'wood', 0.5);
  steeringOar(d, out, 1, lod);
  rigging(d, out, lod, 0.07);
  shieldsAlongRail(d, out, lod, [0x8a6a44, 0x5a3c22, 0x9b7a3a, 0x6e5236, 0xb0a080], 7, 0.2, 0.86, 13);
  const st = hullAt(d, 0.015, 1);
  sternLantern(d, out, lod, [0, st[1] + 0.35, st[2] + 0.35]);
}

/** The Punic galley: black-pitched, a purple band, a ram, a horse's head on the stem, the stern sweeping up aft. */
function buildPunic(d, lod, out, rnd) {
  shell(d, out, lod, rnd, { paintFrom: 0.78 });
  wales(d, out, [0.6], lod);
  gunwale(d, out, lod, { colour: d.paint.trim });
  deck(d, out, lod, 0.04, 0.18, [], 0.02);
  deck(d, out, lod, 0.86, 0.96, [], 0.02);
  if (lod < 2) {
    for (const b of benches(d)) {
      const w = hullAt(d, b.t, 0.5)[0] * 2;
      out.wood.push(board(w, 0.05, 0.2, { tone: 0.8 }).translate(0, b.at[1] + 0.33, b.at[2] - 0.2));
    }
  }
  ram(d, out, 0.9);
  // The stem rising to a horse's head looking forward (the Phoenicians' hippos), painted.
  const bow = hullAt(d, 0.985, 1);
  out.wood.push(sweep([[0, 0.3, bow[2] + 0.05], [0, bow[1], bow[2] + 0.14], [0, bow[1] + 0.35, bow[2] + 0.18], [0, bow[1] + 0.55, bow[2] + 0.1]], 0.12, 0.14, { side: [1, 0, 0], taper: 0.8 }));
  if (lod < 2) {
    // The horse: its neck arched up from the stem, the head bowed forward, the ears pricked, a mane.
    const seg = lod ? 6 : 10;
    const neck = tube([[0, bow[1] + 0.45, bow[2] + 0.12], [0, bow[1] + 0.68, bow[2] + 0.16], [0, bow[1] + 0.8, bow[2] + 0.26]], 0.075, { radial: seg, segments: 6, around: 0.2 });
    out.painted.push(painted(neck, 0xcdb88a));
    const head = new CylinderGeometry(0.045, 0.075, 0.3, seg);
    head.rotateX(Math.PI / 2 + 0.75).translate(0, bow[1] + 0.73, bow[2] + 0.4);
    out.painted.push(painted(head, 0xd6c49a));
    for (const s of [1, -1]) {
      const ear = new CylinderGeometry(0.0, 0.025, 0.09, 5).translate(s * 0.03, bow[1] + 0.88, bow[2] + 0.26);
      out.painted.push(painted(ear, 0xcdb88a));
    }
    const mane = sweep([[0, bow[1] + 0.5, bow[2] + 0.06], [0, bow[1] + 0.74, bow[2] + 0.1], [0, bow[1] + 0.86, bow[2] + 0.2]], 0.03, 0.06, { side: [1, 0, 0] });
    out.painted.push(painted(mane, 0x3a2418));
  }
  // The stern sweeping up and aft in a long curve.
  post(d, out, 0.015, [[0.1, 0.3], [0.6, -0.1], [1.2, -0.32], [1.6, -0.36], [1.85, -0.25]], 0.13, 0.15, 'gilt', 0.4);
  if (lod === 0) eyes(d, out, 0.9, 0.66, 0.09);
  for (const s of [1, -1]) steeringOar(d, out, s, lod);
  rigging(d, out, lod, 0.08);
  shieldsAlongRail(d, out, lod, [0x5b1e3c, 0xc9a14a, 0xd6c49a], 6, 0.22, 0.82, 17);
  const st = hullAt(d, 0.015, 1);
  sternLantern(d, out, lod, [0, st[1] + 0.3, st[2] + 0.3]);
}

/** The Veneti's ship: flat floored, high stem and stern, the great cross beams through the sides bolted with iron. */
function buildGaulish(d, lod, out, rnd) {
  shell(d, out, lod, rnd, { paintFrom: 0.9 });
  wales(d, out, [0.55, 0.78], lod);
  gunwale(d, out, lod, {});
  deck(d, out, lod, 0.08, 0.9, [[0.4, 0.62]]);
  // The cross beams, a foot thick, their ends through the planking, each with its iron bolt-heads.
  for (let t = 0.2; t < 0.86; t += lod === 2 ? 0.22 : 0.11) {
    const p = hullAt(d, t, 0.72);
    out.wood.push(board(p[0] * 2 + 0.36, 0.2, 0.2, { tone: 0.62 }).translate(0, p[1] - 0.1, p[2]));
    if (lod === 0) {
      for (const s of [1, -1]) {
        const bolt = new CylinderGeometry(0.03, 0.03, 0.03, 6).rotateZ(Math.PI / 2).translate(s * (p[0] + 0.19), p[1], p[2]);
        out.bronze.push(tintGeometry(boxUV(bolt), () => 0.35));
      }
    }
  }
  // The sweeps' ports in the high side.
  if (lod < 2) {
    for (const b of benches(d)) {
      out.painted.push(painted(new BoxGeometry(0.03, 0.12, 0.14).translate(b.thole[0] - b.s * 0.01, b.thole[1], b.thole[2]), 0x0e0c0a));
    }
  }
  // Straight raked stem and sternpost, high.
  post(d, out, 0.985, [[-1.0, -0.2], [-0.2, 0.08], [0.45, 0.26], [0.7, 0.3]], 0.16, 0.16);
  post(d, out, 0.015, [[-1.0, 0.2], [-0.2, -0.08], [0.45, -0.24], [0.7, -0.28]], 0.16, 0.16);
  // The anchor chain over the bow, down into the water.
  if (lod < 2) {
    const bow = hullAt(d, 0.93, 1);
    const pts = [];
    for (let k = 0; k <= 10; k++) pts.push([0.25, bow[1] - k * 0.12, bow[2] + 0.2 + k * 0.05]);
    for (let k = 0; k < pts.length - 1; k++) {
      const ring = new TorusGeometry(0.045, 0.012, 4, 8);
      if (k % 2) ring.rotateY(Math.PI / 2);
      ring.rotateX(Math.PI / 2 - 0.4).translate(...pts[k]);
      out.bronze.push(tintGeometry(boxUV(ring), () => 0.3));
    }
  }
  steeringOar(d, out, 1, lod);
  rigging(d, out, lod, 0.1);
  shieldsAlongRail(d, out, lod, [0x6e5a3a, 0x3e4a5a, 0x8a3a2a, 0xb0a07a], 5, 0.25, 0.8, 23);
  const st = hullAt(d, 0.015, 1);
  sternLantern(d, out, lod, [0, st[1] + 0.85, st[2] - 0.15]);
}

/** The fishing boat: open, thwarts, a short mast, the net heaped in the stern sheets. */
function buildFishing(d, lod, out, rnd) {
  shell(d, out, lod, rnd, { paintFrom: 0.8 });
  gunwale(d, out, lod, { colour: d.paint.trim });
  if (lod < 2) {
    for (const t of [0.3, 0.5, 0.72]) {
      const p = hullAt(d, t, 0.82);
      out.wood.push(board(p[0] * 2 - 0.04, 0.045, 0.2, { tone: 0.82 }).translate(0, p[1] - 0.04, p[2]));
    }
    // The bottom boards.
    const a = hullAt(d, 0.15, 0.2);
    const b = hullAt(d, 0.85, 0.2);
    out.wood.push(board(0.7, 0.03, b[2] - a[2], { tone: 0.6 }).translate(0, a[1] + 0.02, (a[2] + b[2]) / 2));
  }
  post(d, out, 0.985, [[-0.5, -0.06], [-0.1, 0.08], [0.2, 0.14]], 0.1, 0.11);
  post(d, out, 0.015, [[-0.4, 0.06], [0.0, -0.06], [0.22, -0.1]], 0.1, 0.11);
  if (lod === 0) eyes(d, out, 0.88, 0.75, 0.07);
  steeringOar(d, out, 1, lod);
  rigging(d, out, lod, 0.06);
  // The net heaped in the stern, its floats on top.
  const n = hullAt(d, 0.2, 0.6);
  const heapG = new SphereGeometry(0.34, lod ? 6 : 12, lod ? 4 : 8, 0, Math.PI * 2, 0, Math.PI / 2);
  heapG.scale(1.1, 0.5, 0.9).translate(0, n[1] - 0.04, n[2]);
  out.painted.push(painted(heapG, 0x6a5a44));
  if (lod < 2) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      out.painted.push(painted(new BoxGeometry(0.07, 0.04, 0.05).translate(Math.cos(a) * 0.22, n[1] + 0.1, n[2] + Math.sin(a) * 0.18), 0xd9b25a));
    }
  }
  const st = hullAt(d, 0.015, 1);
  sternLantern(d, out, lod, [0, st[1] + 0.25, st[2] + 0.2]);
}

const BUILDERS = { corbita: buildCorbita, coaster: buildCoaster, liburnian: buildLiburnian, lembos: buildLembos, punic: buildPunic, gaulish: buildGaulish, fishing: buildFishing };

/** A hull's kit (the model's Group in the ship's frame, the waterline at 0). */
export function buildHull(kind, lod) {
  const d = DESIGNS[kind];
  const out = newOut();
  BUILDERS[kind](d, lod, out, artRng(kind.length * 17 + 3));
  if (out.lantern) LANTERNS.set(kind, [out.lantern[0], out.lantern[1] + 0.12 - d.draft, out.lantern[2]]);
  const m = shipMaterials();
  const p = new TaggedParts(`vessel-${kind}`);
  const sink = (g) => g.translate(0, -d.draft, 0);
  // The lantern's horn pane, amber in the paint (its glow at night is the light map's: renderer.js
  // collectLights at the lantern's place, pass.js), so a hull is two draws at the middle and far levels.
  const panes = out.pane.map((g) => paint(g, lin(0xd8a860)));
  p.add('wood', m.wood, out.wood.map(sink));
  if (lod === 0) {
    p.add('paint', m.painted, out.painted.concat(panes).map(sink));
    // (Bronze and gilt in one metal part close up, the bronze darker by its vertex colour.)
    p.add('gilt', m.gilt, out.gilt.map(sink).concat(out.bronze.map((g) => sink(paint(g, [0.62, 0.5, 0.36])))));
  } else {
    // Farther out the metal is painted gold and bronze: its sheen is a few pixels, its draw a whole one.
    const gold = (g, k) => paint(g, lin(0xc9973c, k));
    p.add('paint', m.painted, out.painted.concat(panes, out.gilt.map((g) => gold(g, 1)), out.bronze.map((g) => gold(g, 0.62))).map(sink));
  }
  return p.build();
}

// ---------------------------------------------------------------------------
// Yards, sails, the furled sail
// ---------------------------------------------------------------------------

/**
 * A sail's cloth in its own frame: the yard along x at y = 0, the cloth
 * hanging down -y `h` (a square sail) or a triangle under a slanting yard
 * (a lateen), its belly along +z (`belly` metres at the middle of a full
 * sail), made of linen panels with darker seams and the brails' lines
 * (lod 0), and two stripes of `stripe` (sRGB) when given.
 */
function sailCloth(sail, lod, stripe, base = 0xf2ead6, seed = 1) {
  const { w, h, shape, belly } = sail;
  const nu = lod === 0 ? 14 : lod === 1 ? 7 : 3;
  const nv = lod === 0 ? 10 : lod === 1 ? 5 : 2;
  const rnd = artRng(seed);
  // The rows down the cloth: evenly, and twice at each stripe's edge (a sharp edge: the colour changes between the two).
  const edges = stripe != null && lod < 2 ? [0.28, 0.4, 0.6, 0.72] : [];
  const vs = [];
  for (let i = 0; i <= nv; i++) vs.push({ v: i / nv, band: null });
  for (const e of edges) vs.push({ v: e, band: 'above' }, { v: e, band: 'below' });
  vs.sort((p, q) => p.v - q.v || (p.band === 'above' ? -1 : 1));
  const inStripe = (v) => (v > 0.28 && v < 0.4) || (v > 0.6 && v < 0.72);
  const stripeC = stripe != null ? lin(stripe) : null;
  const baseC = lin(base);
  const rows = [];
  const colOf = [];
  for (const { v, band } of vs) {
    const row = [];
    for (let j = 0; j <= nu; j++) {
      const u = j / nu;
      let x;
      let y;
      if (shape === 'lateen') {
        // A triangle: the luff along a yard slanting up aft, the clew below its forward end.
        const yx = (u - 0.5) * w;
        const yy = (u - 0.5) * h * 0.55;
        x = yx * (1 - v * 0.15) - v * w * 0.25 * (1 - u);
        y = yy - v * (h * (1 - u) * 0.95 + 0.05);
      } else {
        x = (u - 0.5) * w * (1 + 0.06 * v);
        y = -v * h;
      }
      // The belly: none along the yard, growing down the cloth, deepest in the middle.
      const z = belly * Math.sin(Math.PI * u) ** 0.8 * v ** 0.6 * (1 - 0.25 * v ** 3);
      row.push([x, y, z]);
    }
    rows.push(row);
    const vv = band === 'above' ? v - 1e-4 : band === 'below' ? v + 1e-4 : v;
    colOf.push(stripeC && inStripe(vv) ? stripeC : baseC);
  }
  return surface(rows, (i, j) => {
    const c = colOf[i];
    // Seams between the panels (lod 0).
    const seam = lod === 0 && j % 2 === 0 ? 0.9 : 1;
    const k = (0.95 + rnd() * 0.06) * seam;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
}

/** A design's mast i's sail kit (its frame: the yard's middle at the origin; see sailCloth). */
export function buildSail(kind, i, lod, stripe = null) {
  const d = DESIGNS[kind];
  const sail = d.masts[i].sail;
  const m = shipMaterials();
  const p = new TaggedParts(`vessel-${kind}-sail`);
  const hide = kind === 'gaulish';
  const base = d.paint.sail || 0xf2ead6;
  const g = sailCloth(sail, lod, stripe, hide ? 0xffffff : base, kind.length + i * 7);
  // (Patches on the pirates' sails: darker panels.)
  if (kind === 'lembos' && lod < 2) {
    const col = g.attributes.color;
    const pos = g.attributes.position;
    for (let k = 0; k < col.count; k++) {
      const x = pos.getX(k);
      const y = pos.getY(k);
      if ((x > 0.2 && x < 0.8 && y < -0.5 && y > -1.1) || (x < -0.5 && x > -1.0 && y < -1.2)) col.setXYZ(k, col.getX(k) * 0.7, col.getY(k) * 0.65, col.getZ(k) * 0.6);
    }
  }
  p.add('sail', hide ? m.hide : m.cloth, [g], { cast: true });
  return p.build();
}

/** A mast's yard and the lifts from its ends to the masthead (the yard's frame, as the sail's). */
export function buildYard(kind, i, lod) {
  const d = DESIGNS[kind];
  const { sail, h, yard } = d.masts[i];
  const out = newOut();
  const len = sail.w + 0.3;
  const lateen = sail.shape === 'lateen';
  const r = Math.max(0.035, sail.w * 0.016);
  const half = (s) => {
    const g = new CylinderGeometry(r * 0.55, r, len / 2, lod ? 6 : 10);
    g.translate(0, len / 4, 0).rotateZ(-s * Math.PI / 2);
    if (lateen) g.rotateZ(Math.atan2(sail.h * 0.55, sail.w));
    return tintGeometry(boxUV(g), () => 0.72);
  };
  out.wood.push(half(1), half(-1));
  if (lod < 2) {
    const up = h - yard;
    for (const s of [1, -1]) {
      const end = lateen ? [s * len * 0.48, s * len * 0.48 * (sail.h * 0.55) / sail.w, 0] : [s * len * 0.48, 0, 0];
      line(out, end, [0, up, 0], lod, 0.01, 0.0, 'wood');
    }
    // The parrel lashing the yard to the mast.
    out.wood.push(tintGeometry(boxUV(new TorusGeometry(0.1, 0.02, 4, 10).rotateX(Math.PI / 2)), () => 0.32));
  }
  const m = shipMaterials();
  const p = new TaggedParts(`vessel-${kind}-yard`);
  // (Its shadow is a line a few pixels long: none, but close up.)
  p.add('wood', m.wood, out.wood, { cast: lod === 0 });
  return p.build();
}

/** The yard's own pieces (buildYard's), for the furled sail's kit: [geometries] in the wood's colours. */
function yardPieces(kind, i, lod) {
  const g = buildYard(kind, i, lod);
  const list = g.meshes.map((mesh) => mesh.geometry);
  return list;
}

/** A mast's sail brailed up along its yard: a roll of cloth under the yard, gaskets round it. */
export function buildFurl(kind, i, lod) {
  const d = DESIGNS[kind];
  const { sail } = d.masts[i];
  const lateen = sail.shape === 'lateen';
  const m = shipMaterials();
  const n = lod === 0 ? 9 : 5;
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const x = (u - 0.5) * sail.w * 0.96;
    const y = (lateen ? (u - 0.5) * sail.h * 0.55 : 0) - 0.1 - 0.04 * Math.sin(Math.PI * u);
    pts.push([x, y, 0.02]);
  }
  const roll = tube(pts, Math.max(0.06, sail.h * 0.035), { radial: lod ? 6 : 10, segments: lod ? 8 : 18, around: 0.4 });
  const base = d.paint.sail || 0xf2ead6;
  paint(roll, lin(kind === 'gaulish' ? 0xffffff : base, 0.92));
  const p = new TaggedParts(`vessel-${kind}-furl`);
  const parts = [roll];
  // The gaskets round it, in the cloth's own material, dark (one part).
  if (lod < 2) {
    for (let k = 1; k < n; k += 2) {
      const t = new TorusGeometry(Math.max(0.065, sail.h * 0.038), 0.012, 4, 8).rotateY(Math.PI / 2).translate(...pts[k]);
      parts.push(paint(boxUV(t), [0.2, 0.16, 0.12]));
    }
  }
  // The yard it is brailed to, in the same kit (the pass draws this kit in the yard's place, not the yard's
  // own): close up in the wood, farther out in the cloth's material coloured as wood (one draw for both).
  const yard = yardPieces(kind, i, lod);
  if (lod === 0) p.add('yard', m.wood, yard, { cast: false });
  else parts.push(...yard.map((g) => paint(g, lin(0x6a4c34))));
  p.add('sail', kind === 'gaulish' ? m.hide : m.cloth, parts, { cast: lod === 0 });
  return p.build();
}

// ---------------------------------------------------------------------------
// On the water: a cast net, a basket of the catch, a wreck's debris
// ---------------------------------------------------------------------------

/** A cast net on the water: its ring of cork floats and a few of its lines, about the origin (r metres). */
export function buildNet(lod, r = 1.5) {
  const m = shipMaterials();
  const p = new TaggedParts('vessel-net');
  const floats = [];
  const lines = [];
  const n = lod === 0 ? 16 : 10;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = r * (1 + 0.08 * Math.sin(k * 2.3));
    floats.push(painted(new CylinderGeometry(0.07, 0.07, 0.05, 6).translate(Math.cos(a) * rr, 0.015, Math.sin(a) * rr), 0xd9b25a));
  }
  if (lod < 2) {
    const ring = [];
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      ring.push([Math.cos(a) * r, 0.01, Math.sin(a) * r]);
    }
    lines.push(painted(tube(ring, 0.012, { radial: 3, segments: 24, around: 0.1 }), 0x5a4a38));
  }
  p.add('floats', m.painted, floats.concat(lines), { cast: false });
  return p.build();
}

/** A basket of the catch (silver fish heaped in it), on y = 0. */
export function buildCatch(lod) {
  const m = shipMaterials();
  const p = new TaggedParts('vessel-catch');
  const b = basket(0.24, 0.26, 1, lod);
  const parts = [paint(b.wicker, lin(0xa8834e))];
  const fish = heap(lod ? 6 : 12, 0.2, 0.24, 0.06, [lin(0xb9c9cf), lin(0x8fa3ad), lin(0xc8cdc0)], 5, lod, 0.45);
  if (fish) parts.push(fish);
  p.add('paint', m.painted, parts);
  return p.build();
}

/** What floats off a sunk ship: planks, a broken spar, an amphora, a strake of hull, about the origin. */
export function buildDebris(lod) {
  const m = shipMaterials();
  const p = new TaggedParts('vessel-debris');
  const rnd = artRng(99);
  const wood = [];
  for (let k = 0; k < (lod === 2 ? 3 : 7); k++) {
    const a = rnd() * Math.PI * 2;
    const d = 0.6 + rnd() * 2.2;
    const g = board(0.18 + rnd() * 0.1, 0.05, 0.8 + rnd() * 1.2, { tone: 0.6 + rnd() * 0.3 });
    g.rotateY(rnd() * Math.PI).translate(Math.cos(a) * d, -0.02, Math.sin(a) * d);
    wood.push(g);
  }
  const spar = new CylinderGeometry(0.06, 0.07, 2.6, lod ? 5 : 8).rotateZ(Math.PI / 2).rotateY(0.7).translate(1.2, 0.0, -0.8);
  wood.push(tintGeometry(boxUV(spar), () => 0.7));
  p.add('wood', m.wood, wood);
  if (lod < 2) {
    const am = jar({ amphora: true, lod: 1, seed: 3 });
    am.scale(0.62, 0.62, 0.62).rotateZ(1.4).translate(-1.3, 0.02, 0.9);
    p.add('paint', m.painted, [paint(am, lin(0xb4693e))]);
  }
  return p.build();
}

/**
 * The 'vessel' kits by key (models.js MODEL_PARTS): 'vessel:<kind>:hull',
 * 'vessel:<kind>:yard:<mast>', 'vessel:<kind>:sail:<mast>[:<colour hex>]',
 * 'vessel:<kind>:furl:<mast>', 'vessel:net', 'vessel:catch',
 * 'vessel:debris'. Returns the model's Group.
 */
export function buildVesselPart(key, lod) {
  const [, a, b, c, e] = key.split(':');
  if (a === 'net') return buildNet(lod).group;
  if (a === 'catch') return buildCatch(lod).group;
  if (a === 'debris') return buildDebris(lod).group;
  if (!DESIGNS[a]) throw new Error(`No vessel ${a}`);
  const i = Number(c) || 0;
  if (b === 'hull') return buildHull(a, lod).group;
  if (b === 'yard') return buildYard(a, i, lod).group;
  if (b === 'sail') return buildSail(a, i, lod, e ? parseInt(e, 16) : null).group;
  if (b === 'furl') return buildFurl(a, i, lod).group;
  throw new Error(`No vessel part ${key}`);
}

/** Where things sit on a design (the pass and the tests): its deck's height at t, its masts and yards, all in the ship's frame (the water at 0). */
export function placesOf(kind) {
  let P = PLACES.get(kind);
  if (!P) PLACES.set(kind, (P = placesOfDesign(kind)));
  return P;
}
const PLACES = new Map();

function placesOfDesign(kind) {
  const d = DESIGNS[kind];
  const lower = (p) => [p[0], p[1] - d.draft, p[2]];
  return {
    deck: (t) => deckY(d, t) - d.draft,
    masts: d.masts.map((m, i) => ({ yard: lower(yardAt(d, i)), dir: mastOf(d, i).dir, rake: m.rake, sail: m.sail })),
    benches: benches(d).map((b) => ({ ...b, thole: lower(b.thole), at: lower(b.at) })),
    point: (t, f) => lower(hullAt(d, t, f)),
  };
}
