/**
 * models/venue.js
 * ----------------------------------------------------------------------------
 * What the entertainment venues of the 3D look share (theatrum.js,
 * amphitheatrum.js, arena.js, circus.js): their materials, the seating
 * swept round its curve, the crowd in the seats, the velarium on its masts,
 * torches, gates and the arena's sand.
 *
 * The seating (cavea). A Roman theatre, amphitheatre or circus seated its
 * people on rows of stone steps (gradus), each a seat for one row and the
 * footrest of the row above, climbing from the arena's or the orchestra's
 * edge to the outer wall. Here a cavea is one profile (risers and treads,
 * the walkways between the tiers, the walls) swept along a family of
 * curves: concentric ellipses for an amphitheatre, circles for a theatre,
 * straight lines for a circus's long sides (sweep()). Each step of the
 * profile is a strip of its own, so a riser and a tread meet at a hard
 * edge, smooth along the curve.
 *
 * The rows are deeper and fewer than the real ones (0.55 to 0.6 m where
 * Rome built 0.7 to 0.8, a third of the count) so people of a real size fit
 * them, and a row reads at the game's zooms.
 *
 * The crowd. Thousands of people would be thousands of skinned figures; so
 * the crowd is kits (crowdGroup: three spectators side by side, one draw a
 * part for every group of the city in view), seated or on their feet with
 * their arms up, placed by matrices (models/venues.js crowdMore) and swapped
 * between the two as the show goes (a lap won, a blow landed): the crowd
 * rises and sits without a bone moving. Who sat where follows the rule
 * Augustus made for the games (the lex Iulia theatralis, Suetonius, Aug.
 * 44): citizens in the white toga in the lower rows, the poor in dark
 * cloaks (pullati) and the women at the top. Far out a group is two people
 * of a few boxes (the crowd thins with the distance).
 *
 * Metres, y up, facing +z, as the other models (models/well.js); every
 * geometry carries position, normal, uv (metres) and an RGB colour.
 * ----------------------------------------------------------------------------
 */

import { BufferGeometry, Float32BufferAttribute, CylinderGeometry, SphereGeometry, BoxGeometry, IcosahedronGeometry } from 'three';
import { boxUV, tintGeometry, merge } from '../shapes.js';
import { material } from '../materials.js';
import { TaggedParts, slab } from './masonry.js';
import { sacraMaterials, hearthFire } from './sacra.js';
import { box, lin, lantern, lanternPane, doubleDoor } from './domus.js';
import { staff } from './castra.js';
import { DYES, hash01 } from '../people/actors.js';

export { box, lin, staff, lantern, lanternPane };

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/** The venues' materials: the temples' and the residences' (sacra.js, domus.js) and their own. */
export function venueMaterials() {
  const m = sacraMaterials();
  return {
    ...m,
    // The arena's and the track's sand (harena): fine, pale, raked.
    // (On the stucco's fine grain, tinted: the earth's cracks and pebbles read as a dry field, not sand,
    // and the plaster's painted dado came through as red bands across the track.)
    sand: material('arena-sand', { surface: 'stucco', color: 0xe6c992, vertexColors: true, snow: 1 }),
    // The seats: travertine steps, their tones in the vertices.
    seats: m.trav,
    tufa: material('tufa', { surface: 'tufa', vertexColors: true, snow: 1 }),
    // The velarium's linen, its stripes in the vertices (built two-faced: castra.js clothBothSides).
    velum: material('velarium-linen', { surface: 'wool', vertexColors: true, snow: 0.8 }),
    // The crowd: the cloth in wool, the faces and hair plain (their tones in the vertices).
    crowdCloth: material('crowd-cloth', { surface: 'wool', vertexColors: true, snow: 0.6 }),
    crowdSkin: material('crowd-skin', { color: 0xffffff, roughness: 0.6, vertexColors: true, snow: 0.15, wet: 0.2 }),
    // A painted ground (the scaenae frons's panels, the stalls' doors): the colours in the vertices.
    paintBoard: material('venue-paint', { surface: 'wood', vertexColors: true, snow: 0.8 }),
  };
}

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

/**
 * A curve family for sweep(): concentric ellipses about (cx, cz), the
 * curve at offset d having half axes (a + d, b + d), walked from angle th0
 * to th1 (radians; x = cos, z = sin). A circle is a = b.
 */
export function ellipseCurves(a, b, th0 = 0, th1 = Math.PI * 2, cx = 0, cz = 0) {
  return (d, t) => {
    const th = th0 + (th1 - th0) * t;
    return [cx + (a + d) * Math.cos(th), cz + (b + d) * Math.sin(th)];
  };
}

/** A curve family of parallel straight lines: from (x0, z0) to (x1, z1), offset d along (nx, nz). */
export function lineCurves(x0, z0, x1, z1, nx, nz) {
  return (d, t) => [x0 + (x1 - x0) * t + nx * d, z0 + (z1 - z0) * t + nz * d];
}

/**
 * A profile [[d, y], ...] swept along a curve family `at(d, t)` -> [x, z]
 * (t from 0 to 1 in `n` steps). The profile is walked with its seen side
 * on its left in (d, y): from the arena up the steps (risers face the
 * arena, treads face up), over the top and down the outer face. Each
 * segment is a strip of its own (hard edges between them), smooth along
 * the curve; `skip(t)` leaves a step of the curve out (a gate through the
 * seats). UVs in metres (along the curve, along the profile); `tint(x, y,
 * z, i)` a vertex colour (i the segment's index). Returns a geometry.
 */
export function sweep(at, profile, n, { tint = null, skip = null } = {}) {
  const pos = [];
  const uv = [];
  const col = [];
  const idx = [];
  let v0 = 0;
  for (let i = 0; i + 1 < profile.length; i++) {
    const [d0, y0] = profile[i];
    const [d1, y1] = profile[i + 1];
    const segLen = Math.hypot(d1 - d0, y1 - y0);
    if (segLen < 1e-6) continue;
    const base = pos.length / 3;
    // Along the curve: arc length at this strip's two edges.
    let u0 = 0;
    let u1 = 0;
    let p0 = at(d0, 0);
    let p1 = at(d1, 0);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const a = at(d0, t);
      const b = at(d1, t);
      if (k) {
        u0 += Math.hypot(a[0] - p0[0], a[1] - p0[1]);
        u1 += Math.hypot(b[0] - p1[0], b[1] - p1[1]);
      }
      p0 = a;
      p1 = b;
      pos.push(a[0], y0, a[1], b[0], y1, b[1]);
      uv.push(u0, v0, u1, v0 + segLen);
      const c0 = tint ? tint(a[0], y0, a[1], i) : 1;
      const c1 = tint ? tint(b[0], y1, b[1], i) : 1;
      for (const c of [c0, c1]) {
        const q = typeof c === 'number' ? [c, c, c] : c;
        col.push(q[0], q[1], q[2]);
      }
    }
    // Which way the strip's faces turn: the seen side is (-dy, dd) in the profile's plane.
    const e = 1e-3;
    const pa = at(d0, 0.5);
    const pb = at(d0 + e, 0.5);
    const ol = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1;
    const o = [(pb[0] - pa[0]) / ol, (pb[1] - pa[1]) / ol];
    const dd = (d1 - d0) / segLen;
    const dy = (y1 - y0) / segLen;
    const want = [-dy * o[0], dd, -dy * o[1]];
    // A quad's normal as built (the middle step), against the wanted one.
    const k = Math.floor(n / 2);
    const A = base + k * 2;
    const tri = [A, A + 2, A + 1];
    const P = (j) => [pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]];
    const [q0, q1, q2] = tri.map(P);
    const e1 = [q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]];
    const e2 = [q2[0] - q0[0], q2[1] - q0[1], q2[2] - q0[2]];
    const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const flip = nrm[0] * want[0] + nrm[1] * want[1] + nrm[2] * want[2] < 0;
    for (let s = 0; s < n; s++) {
      if (skip && skip((s + 0.5) / n)) continue;
      const a = base + s * 2;
      if (!flip) idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
      else idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
    v0 += segLen;
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A cavea's profile from the arena's edge outward: the podium wall `podium`
 * high at d = 0, a walkway `walk` deep, then the tiers: each [rows, depth,
 * rise, wall] (a tier's rows, and a wall `wall` high at its back, the
 * balteus, before the next tier). Returns { profile, rows: [{ d, y }] (the
 * front edge of each row's tread and its height), top: { d, y } }.
 */
export function caveaProfile({ podium, walk, tiers }) {
  const profile = [[0, 0], [0, podium], [walk, podium]];
  const rows = [];
  let d = walk;
  let y = podium;
  for (const [n, depth, rise, wall = 0] of tiers) {
    for (let k = 0; k < n; k++) {
      profile.push([d, y + rise]);
      y += rise;
      profile.push([d + depth, y]);
      rows.push({ d, y, depth, rise });
      d += depth;
    }
    if (wall > 0) {
      profile.push([d, y + wall]);
      y += wall;
      // (A walkway on top of the balteus: the next tier starts a little back.)
      profile.push([d + 0.12, y]);
      d += 0.12;
    }
  }
  return { profile, rows, top: { d, y } };
}

// ---------------------------------------------------------------------------
// The crowd
// ---------------------------------------------------------------------------

/** People a crowd group holds (two far out), and the width of its seat (m). */
export const GROUP_N = 3;
export const GROUP_W = 1.38;

/**
 * The crowd's dress by band (the lex Iulia theatralis): 'toga' citizens in
 * white in the lower rows, 'plebs' the people in tunics and cloaks above,
 * 'pullati' the poor in dark wool and the women at the top. Each band two
 * variants (the order of the people in a group, their colours).
 */
export const CROWD_BANDS = Object.freeze(['toga', 'plebs', 'pullati']);
export const CROWD_VARIANTS = 2;

/** Skin and hair tones (sRGB). */
const SKINS = [0xc8956c, 0xb88560, 0xa87452, 0xd2a17a, 0x9a6a4a, 0xbf8b62, 0xdcb08c, 0x8c5e40];
const HAIRS = [0x1d1612, 0x2a1e16, 0x3a2a1c, 0x4a3424, 0x6a4428, 0x8a8478, 0x1d1612];

/** One spectator's look by band, variant and place in the group (a stable pick, never random). */
function dressOf(band, variant, k) {
  const h = (s) => hash01(variant * 17 + k * 5 + band.length, s);
  const pick = (list, s) => list[Math.floor(h(s) * list.length) % list.length];
  const skin = pick(SKINS, 1);
  const hair = pick(HAIRS, 2);
  if (band === 'toga') {
    // White wool, a little off-white in the shade of each fleece; now and then a bordered toga.
    const toga = pick([DYES.candida, DYES.white, 0xe6dccb, DYES.candida], 3);
    return { body: toga, legs: toga, mantle: null, sash: toga, skin, hair, veil: false, toga: true, border: h(4) < 0.25 ? DYES.purple : null };
  }
  if (band === 'plebs') {
    const tunic = pick([DYES.undyed, DYES.oatmeal, DYES.madder, DYES.ochre, DYES.woad, DYES.white, DYES.rose, DYES.green, DYES.weld], 3);
    const woman = h(5) < 0.3;
    return { body: tunic, legs: tunic, mantle: h(6) < 0.45 ? pick([DYES.walnut, DYES.fawn, DYES.olive, DYES.woad], 7) : null, skin, hair, veil: woman, palla: woman ? pick([DYES.saffron, DYES.sky, DYES.rose, DYES.green], 8) : null, toga: false };
  }
  // The pullati and the women at the top: dark cloaks, coloured pallae over the head.
  const woman = h(5) < 0.5;
  const dark = pick([DYES.brownWool, DYES.grey, DYES.black, DYES.walnut, DYES.fawn], 3);
  return { body: woman ? pick([DYES.saffron, DYES.sky, DYES.rose, DYES.green, DYES.weld, DYES.white], 9) : dark, legs: dark, mantle: woman ? null : dark, skin, hair, veil: woman, palla: woman ? pick([DYES.woad, DYES.madder, DYES.olive, DYES.oxblood, DYES.sky], 8) : null, toga: false };
}

/** sRGB hex to linear RGB (the vertex colours are linear). */
const rgb = (hex, k = 1) => lin(hex, k);

/** Paint a geometry one colour (sRGB hex, times k). */
function paint(g, hex, k = 1) {
  const c = rgb(hex, k);
  return tintGeometry(g, () => c);
}

/** A limb from a to b ([x, y, z]), radius r: an open-ended tube of `radial` sides. */
function limb(a, b, r, radial, k, colour) {
  const g = staff(a, b, r, radial);
  return tintGeometry(g, () => rgb(colour, k));
}

/** A blob about c (rx, ry, rz) of w x h segments (a head, a hand, hair). */
function blob(c, rx, ry, rz, w, h, colour, k = 1, phi = [0, Math.PI]) {
  const g = new SphereGeometry(1, w, h, 0, Math.PI * 2, phi[0], phi[1] - phi[0]);
  g.scale(rx, ry, rz);
  g.translate(c[0], c[1], c[2]);
  return tintGeometry(boxUV(g), (x, y) => rgb(colour, k * (0.82 + 0.18 * Math.min(1, Math.max(0, (y - c[1] + ry) / (2 * ry))))));
}

/** A tapered trunk from y0 to y1 at (x, z): bottom half widths (w0, d0), top (w1, d1), `radial` sides. */
function trunk(x, y0, z, y1, w0, d0, w1, d1, radial, colour, lean = 0) {
  const g = new CylinderGeometry(1, 1, y1 - y0, radial, 1, false);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const top = P.getY(i) > 0;
    const w = top ? w1 : w0;
    const d = top ? d1 : d0;
    P.setXYZ(i, P.getX(i) * w, P.getY(i) + (y1 - y0) / 2 + y0, P.getZ(i) * d + (top ? lean : 0));
  }
  g.computeVertexNormals();
  g.translate(x, 0, z);
  return tintGeometry(boxUV(g), (px, py) => rgb(colour, 0.78 + 0.22 * Math.min(1, (py - y0) / Math.max(0.01, y1 - y0))));
}

/**
 * One spectator at x (the group's frame: the seat's front edge at z = 0,
 * the tread at y = 0, facing +z), `pose` 'sit' or 'up' (on his feet, arms
 * raised), `arms` how ('up' both, 'one' one up and one out, 'clap'), `rise`
 * the step down to the row in front (where a seated man's feet go). Returns
 * { cloth: [], skin: [] }.
 */
function spectator(x, d, pose, arms, lod, rise) {
  const cloth = [];
  const skin = [];
  const R = lod === 0 ? 8 : lod === 1 ? 5 : 4;
  const sit = pose === 'sit';
  // Heights: a seated man's hips on the seat a little back from its edge, his knees over the edge, his feet on the row below.
  const hipY = sit ? 0.1 : 0.86;
  const hipZ = sit ? -0.16 : -0.12;
  const shY = sit ? 0.6 : 1.36;
  const headY = sit ? 0.79 : 1.55;
  const lean = sit ? 0.04 : 0;
  const sx = 0.11;
  if (lod === 2) {
    // Far out: a body, a head, the legs as one box.
    cloth.push(paint(box(0.34, shY - hipY + 0.12, 0.24, x, hipY - 0.08, hipZ, 1), d.body));
    skin.push(tintGeometry(boxUV(new IcosahedronGeometry(0.11, 0).translate(x, headY, hipZ + 0.02)), () => rgb(d.veil ? d.palla : d.skin)));
    if (sit) cloth.push(tintGeometry(box(0.3, 0.14, 0.42, x, 0.04, hipZ + 0.28), () => rgb(d.legs, 0.8)));
    else cloth.push(tintGeometry(box(0.28, hipY, 0.18, x, 0, hipZ), () => rgb(d.legs, 0.75)));
    if (!sit && arms !== 'clap') cloth.push(tintGeometry(box(0.42, 0.42, 0.08, x, shY - 0.02, hipZ), () => rgb(d.body, 0.9)));
    return { cloth, skin };
  }
  // The trunk: a tunic or a toga, broader at the hips seated (the cloth over the lap).
  cloth.push(trunk(x, hipY - 0.08, hipZ, shY, sit ? 0.19 : 0.16, sit ? 0.15 : 0.12, 0.18, 0.11, R, d.body, lean));
  // The shoulders' round over the trunk's top.
  cloth.push(blob([x, shY - 0.01, hipZ + lean], 0.19, 0.07, 0.115, R, Math.max(2, R / 2), d.body, 0.95, [0, Math.PI / 2]));
  // A toga's sinus and balteus: the fold across the chest from the left shoulder to the right hip.
  if (d.toga && lod === 0) {
    const g = box(0.045, 0.6, 0.03, 0, 0, 0);
    g.rotateZ(-0.62);
    g.translate(x + 0.01, (hipY + shY) / 2 - 0.12, hipZ + 0.115 + lean * 0.5);
    cloth.push(tintGeometry(g, () => rgb(d.border || d.body, d.border ? 1 : 0.86)));
  }
  // A cloak over the shoulders and down the back.
  if (d.mantle) cloth.push(trunk(x, hipY + 0.1, hipZ - 0.035, shY + 0.03, 0.2, 0.12, 0.2, 0.12, R, d.mantle, lean));
  // The head, the hair or a palla over it.
  const hz = hipZ + 0.02 + lean;
  skin.push(blob([x, headY, hz], 0.095, 0.115, 0.105, R, Math.max(3, R - 2), d.skin));
  if (d.veil) cloth.push(blob([x, headY + 0.01, hz - 0.015], 0.115, 0.135, 0.125, R, Math.max(3, R - 2), d.palla, 0.95, [0, Math.PI * 0.62]));
  else skin.push(blob([x, headY + 0.015, hz - 0.012], 0.103, 0.115, 0.112, R, Math.max(2, R / 2), d.hair, 1, [0, Math.PI * 0.5]));
  // The arms: hanging to the lap seated, raised on his feet.
  const r = 0.042;
  const handR = 0.04;
  for (const s of [-1, 1]) {
    const sh = [x + s * 0.17, shY - 0.04, hipZ + lean];
    let el;
    let hd;
    if (sit) {
      el = [x + s * 0.2, hipY + 0.24, hipZ + 0.12];
      hd = [x + s * 0.12, hipY + 0.12, hipZ + 0.33];
      if (arms === 'clap') {
        el = [x + s * 0.21, shY - 0.22, hipZ + 0.16];
        hd = [x + s * 0.03, shY - 0.04, hipZ + 0.3];
      }
    } else if (arms === 'clap') {
      el = [x + s * 0.22, shY - 0.24, hipZ + 0.12];
      hd = [x + s * 0.035, shY - 0.05, hipZ + 0.32];
    } else if (arms === 'one' && s < 0) {
      el = [x + s * 0.3, shY - 0.18, hipZ + 0.08];
      hd = [x + s * 0.3, shY + 0.05, hipZ + 0.22];
    } else {
      el = [x + s * 0.28, shY + 0.24, hipZ + 0.06];
      hd = [x + s * 0.26, shY + 0.5, hipZ + 0.14];
    }
    cloth.push(limb(sh, el, r * 1.35, Math.max(4, R - 3), 0.92, d.body));
    skin.push(limb(el, hd, r * 1.0, Math.max(4, R - 3), 1, d.skin));
    skin.push(blob(hd, handR, handR, handR, Math.max(4, R - 3), 3, d.skin));
  }
  // The legs: seated, thighs forward over the seat's edge and shins down to the row below; on his feet, straight.
  for (const s of [-1, 1]) {
    const hip = [x + s * sx * 0.85, hipY, hipZ + 0.02];
    const knee = sit ? [x + s * sx, hipY + 0.06, 0.2] : [x + s * sx, 0.46, hipZ + 0.04];
    const foot = sit ? [x + s * sx * 1.1, -rise + 0.04, 0.27] : [x + s * sx, 0.05, hipZ + 0.05];
    cloth.push(limb(hip, knee, 0.078, Math.max(4, R - 2), 0.85, d.legs));
    // (A long robe, a toga or a woman's stola, falls to the shins on her feet.)
    if (!sit && (d.toga || d.veil)) cloth.push(limb(knee, [foot[0], 0.18, foot[2]], 0.08, Math.max(4, R - 2), 0.8, d.legs));
    skin.push(limb(knee, foot, 0.05, Math.max(4, R - 3), 0.95, d.skin));
    // (The sandal: a box at the foot.)
    skin.push(paint(box(0.08, 0.05, 0.2, foot[0], foot[1] - 0.05, foot[2] + 0.05), 0x5a3a24, 0.9));
  }
  return { cloth, skin };
}

/**
 * A crowd group's kit: GROUP_N spectators (two far out) on a GROUP_W
 * stretch of seat, the seat's front edge at z = 0 and its tread at y = 0,
 * facing +z, in `pose` ('sit' or 'up'), of `band` and `variant` (who they
 * are), `rise` the row's step (the seated men's feet go down it). Built by
 * its key, `crowd:<pose>:<band>:<variant>`; tagged 'always' (the variant's
 * `more` list says where it shows). Returns a Group.
 */
export function buildCrowdGroup(pose, band, variant, lod = 0, rise = 0.33) {
  const p = new TaggedParts(`crowd-${pose}-${band}-${variant}`);
  const n = lod === 2 ? GROUP_N - 1 : GROUP_N;
  const step = GROUP_W / n;
  const cloth = [];
  const skin = [];
  for (let k = 0; k < n; k++) {
    const x = -GROUP_W / 2 + step * (k + 0.5) + (hash01(variant, k, 3) - 0.5) * 0.08;
    const d = dressOf(band, variant, k);
    // On their feet, each his own way: both arms up, one up, clapping.
    const h = hash01(variant, k, 11);
    const arms = pose === 'up' ? (h < 0.5 ? 'up' : h < 0.8 ? 'one' : 'clap') : h < 0.2 ? 'clap' : 'lap';
    const s = spectator(x, d, pose, arms, lod, rise);
    cloth.push(...s.cloth);
    skin.push(...s.skin);
  }
  const M = venueMaterials();
  // (Far out a crowd's shadow is a few pixels: none, a draw saved in the sun's pass.)
  // (Their shadows only close up: from the middle distance a seated man's is a few pixels on the step
  // behind him, and the crowd's parts were a third of the sun's pass's draws.)
  p.add('cloth', M.crowdCloth, cloth, { cast: lod === 0 });
  p.add('skin', M.crowdSkin, skin, { cast: lod === 0 });
  return p.build().group;
}

/**
 * Seats along a row: groups every GROUP_W along the curve `at` at offset d
 * (a row's front edge, its tread at height y), from t0 to t1, facing in
 * (toward the arena: -d), skipping where `skip(t)`. Returns [[x, y, z,
 * ry], ...] (ry turns the group's +z to face the arena).
 */
export function rowSeats(at, d, y, t0, t1, skip = null, steps = 400) {
  const out = [];
  // (The first group a little in from the row's end: its people's arms stay over their own row's stone.)
  let acc = GROUP_W / 2 - 0.14;
  let prev = at(d, t0);
  for (let k = 1; k <= steps; k++) {
    const t = t0 + ((t1 - t0) * k) / steps;
    const p = at(d, t);
    acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
    if (acc < GROUP_W) continue;
    acc -= GROUP_W;
    if (k === steps) break;
    if (skip && skip(t)) continue;
    // Facing in: toward smaller d.
    const q = at(d - 0.5, t);
    const ry = Math.atan2(q[0] - p[0], q[1] - p[1]);
    out.push([p[0], y, p[1], ry]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fittings
// ---------------------------------------------------------------------------

/**
 * A torch on a bracket or a lampstand at (x, y, z): its bronze bowl and,
 * lit (`when` 'open': a show on), its flames. Returns { bronze, flames }.
 */
export function torch(x, y, z, lod = 0, big = 0.55) {
  const out = { bronze: [], flames: [], hot: [] };
  const seg = lod ? 6 : 10;
  const bowl = new CylinderGeometry(0.11 * big * 1.6, 0.05 * big * 1.6, 0.1, seg, 1, false).translate(x, y + 0.05, z);
  out.bronze.push(tintGeometry(boxUV(bowl), () => 0.8));
  const f = hearthFire([x, y + 0.08, z], 0.1, { lod, seed: Math.round(x * 13 + z * 7), big });
  out.flames.push(...f.flames);
  out.hot.push(...f.hot);
  return out;
}

/** A lampstand (candelabrum): a moulded bronze shaft on three feet, its torch on top. Returns { bronze, flames, hot }. */
export function lampstand(x, z, h, y0 = 0, lod = 0) {
  const seg = lod ? 5 : 8;
  const bronze = [];
  bronze.push(tintGeometry(boxUV(new CylinderGeometry(0.025, 0.035, h, seg, 1).translate(x, y0 + h / 2, z)), () => 0.85));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    bronze.push(staff([x, y0 + 0.16, z], [x + Math.cos(a) * 0.14, y0, z + Math.sin(a) * 0.14], 0.016, 4));
  }
  const t = torch(x, y0 + h, z, lod, 0.5);
  return { bronze: [...bronze, ...t.bronze], flames: t.flames, hot: t.hot };
}

/**
 * A pair of gates in an opening w wide and h high at (x, z), facing +z,
 * swung open (`open`) or shut. Returns geometries of wood and iron:
 * domus.js doubleDoor.
 */
export function gates(x, z, w, h, y0, open, lod) {
  return doubleDoor(x, z, w, h, y0, { open, lod, studs: lod === 0 });
}

/**
 * The arena's sand over a curve's inside (`at(0, t)`, a closed outline):
 * a fan of triangles from (cx, cz), y high, raked in rings by its tone.
 */
export function sandFloor(at, n, y, cx = 0, cz = 0) {
  const pos = [cx, y, cz];
  const col = [1, 1, 1];
  for (let k = 0; k <= n; k++) {
    const [x, z] = at(0, k / n);
    pos.push(x, y, z);
    col.push(0.94, 0.94, 0.94);
  }
  const idx = [];
  for (let k = 1; k <= n; k++) idx.push(0, k + 1, k);
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // (Facing up whichever way the outline runs.)
  if (g.attributes.normal.getY(0) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return boxUV(g);
}

/**
 * A rake's furrows on the sand: thin pale and dark lines along `at(d, t)`
 * at the offsets `ds` (ellipses round the arena), just over y. Returns
 * geometries for the sand's material.
 */
export function rakeLines(at, ds, y, n = 96) {
  const out = [];
  for (const [j, d] of ds.entries()) {
    out.push(sweep(at, [[d, y], [d - 0.05, y]], n, { tint: () => (j % 2 ? 0.86 : 1.06) }));
  }
  return out;
}

/** Multiply a geometry's vertex colours by a linear colour (paint over its shading). */
export function tinted(g, c) {
  const col = g.attributes.color;
  if (!col) return tintGeometry(g, () => c);
  for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * c[0], col.getY(i) * c[1], col.getZ(i) * c[2]);
  return g;
}

/** A sheet of quads with both faces (cloth: an awning) from a grid of points: `quads` the first corner of each, `stride` the grid's row. */
export function sheet(pos, cols, quads, stride) {
  const P = [];
  const C = [];
  for (const q of quads) {
    const a = q;
    const b = q + 1;
    const c = q + stride;
    const d = q + stride + 1;
    for (const [i, j, k] of [[a, c, b], [b, c, d], [a, b, c], [b, d, c]]) {
      for (const v of [i, j, k]) {
        P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
        // (Each quad the colour of its first corner: stripes with sharp edges, not blended across the quad.)
        C.push(cols[a * 3], cols[a * 3 + 1], cols[a * 3 + 2]);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(P, 3));
  g.setAttribute('color', new Float32BufferAttribute(C, 3));
  g.computeVertexNormals();
  return boxUV(g);
}

/**
 * The velarium round a closed (or open) curve family `at`: `n` masts at
 * offset dm standing from y0 to yTop (t at each mast in `ts`), and the
 * awning spread from the masts' tops in to offset dIn, falling `drop` and
 * sagging a little between the masts, in stripes of linen and madder.
 * Added to `p` tagged: the awning and its ropes 'open', the linen furled
 * on each mast's yard otherwise ('out', 'shut').
 */
export function velarium(p, M, at, { ts, dm, dIn, y0, yTop, drop = 0.3, lod = 0, stripes = 24, sag = 0.05, mastR = 0.032, closed = false }) {
  for (const t of ts) {
    const [x, z] = at(dm, t);
    p.add('wood', M.wood, staff([x, y0, z], [x, yTop, z], mastR, lod ? 5 : 8));
    const [x2, z2] = at(dm - 0.3, t);
    const roll = new CylinderGeometry(0.06, 0.06, 0.42, lod ? 5 : 8);
    roll.rotateZ(Math.PI / 2);
    roll.rotateY(-Math.atan2(z2 - z, x2 - x) + Math.PI / 2);
    roll.translate(x, yTop - 0.22, z);
    const furled = tintGeometry(boxUV(roll), () => lin(0xe8dcc0));
    p.add('velum-furled-out', M.velum, furled, { when: 'out' });
    p.add('velum-furled-shut', M.velum, furled.clone(), { when: 'shut' });
  }
  const n = lod === 0 ? 96 : lod === 1 ? 40 : 16;
  const rows = lod === 0 ? 3 : 1;
  const pos = [];
  const cols = [];
  const quads = [];
  const span = ts.length > 1 ? Math.abs(ts[1] - ts[0]) : 1;
  for (let i = 0; i <= n; i++) {
    const t = ts[0] + ((closed ? 1 : ts[ts.length - 1] - ts[0]) * i) / n;
    const between = ((t - ts[0]) / span) % 1;
    const sg = sag * Math.sin(Math.PI * between);
    for (let j = 0; j <= rows; j++) {
      const s = j / rows;
      const [x, z] = at(dm + (dIn - dm) * s, t);
      pos.push(x, yTop - 0.05 - s * drop - sg * (0.5 + s), z);
      // (Linen with a narrow band of madder every fourth stripe: a ring of solid red read as a lifebuoy from above.)
      cols.push(...(lod === 0 && Math.floor((i / n) * stripes) % 4 === 0 ? lin(0xa83a2a) : lin(0xeee2c8, 0.95 + 0.05 * (j % 2))));
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) quads.push(i * (rows + 1) + j);
  p.add('velum', M.velum, sheet(pos, cols, quads, rows + 1), { when: 'open' });
}

/** Parts that lie flat or are painted on a face, whose shadows nobody sees: they cast none (a draw saved each in the sun's pass). */
const FLAT = new Set(['dark', 'sand', 'paving', 'water', 'fresco', 'flame', 'embers']);
/** A built model ({ group, meshes }) with its flat parts casting no shadow. */
export function flatParts(built) {
  for (const m of built.meshes) if (FLAT.has(m.name)) m.castShadow = false;
  return built;
}

/** A stone at the full detail (masonry.js slab) or a plain box far out. */
export function stone(lod, w, h, d, x, y, z, opts = {}) {
  if (lod === 0) return slab(w, h, d, { bevel: 0.012, wobble: 0.002, ...opts }).translate(x, y, z);
  return box(w, h, d, x, y, z, 1 - (opts.grime || 0) * 0.2);
}

export { merge, slab };
