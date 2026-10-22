/**
 * models/castraArcher.js
 * ----------------------------------------------------------------------------
 * The archer fort (Praesidium) of the 3D look: the post of an auxiliary
 * cohort of archers (sagittarii), lighter than the legion's, after the turf
 * and timber forts that came first on every frontier and the archers who
 * held them (the Hamian archers from Syria at Carvoran on Hadrian's Wall and
 * at Bar Hill on the Antonine Wall):
 *
 *   - the camp's rampart as castraPalisade.js builds it (bank of cut turves
 *     in courses, a palisade of stakes, platforms on posts at the corners,
 *     a timber gate tower with a painted board, SAGITTARII, the archers' name rather than an Imperial cohort's), the
 *     palisade lower than the legion's (about 1.9 m) where the archers stand
 *     near its right side
 *   - leather tents (papiliones, of calf hide panels as found at Vindolanda)
 *     in rows on one side of the yard, a hearth with its cauldron
 *   - a timber shrine for the standards at the back, thatched: the cohort's
 *     signum with its hand and discs, its vexillum in the archers' green
 *   - the butts: straw targets on trestles against the back rampart, arrows
 *     in them; a rack of composite bows and quivers by the gate
 *
 * States as the legion fort's (castraLegion.js): 'open' manned, 'out'
 * deployed (the standards out), 'shut' empty (the gate shut); 'home' and
 * 'staffed' tags. Manned, the watch keeps the bank (archerActors): an
 * archer shooting out over the stakes, a sentry pacing the crest left of
 * the gate and one down the right side, another archer at the butts.
 *
 * Metres, the fort's middle at the origin, y up, the gate toward +z.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry } from 'three';
import { boxUV, tintGeometry, tube } from '../shapes.js';
import { artRng } from '../texgen.js';
import { lin } from './rural.js';
import {
  CASTRA, fortBag, assemble, TANK_WATER, prism, box, cyl, staff, gravel, tent, signum, vexillum, imago,
  standardBase, soldier, wallSentry,
} from './castra.js';
import { CAMP, campRampart, timberBeam } from './castraPalisade.js';

/** The archer fort's measures (metres): the tests, the lab and the game read them. */
export const ARCHER_FORT = Object.freeze({
  /** The palisade's height over the ground (set by the archers' places along the right side). */
  stakes: 1.9,
  /** The shrine: x0, x1, z0, z1. */
  shrine: Object.freeze([-1.15, 1.15, -4.85, -3.75]),
  /** The tents' places (x, z) on the left of the yard. */
  tents: Object.freeze([[-3.45, -3.2], [-2.15, -3.2], [-3.45, -1.3], [-2.15, -1.3], [-3.45, 0.6]]),
  /** The butts (x, z), facing the gate. */
  butts: Object.freeze([[2.35, -4.15], [3.55, -3.8]]),
  lamps: Object.freeze([Object.freeze([-1.0, 1.62, 5.0]), Object.freeze([1.0, 1.62, 5.0])]),
});

const A = ARCHER_FORT;
const GREEN = lin(0x3f7a3a);

/** A straw target on a trestle facing +z, at (x, z): rings painted on its face, arrows in it (lod 0). */
function butt(x, z, lod, out, seed) {
  const r = 0.42;
  const cy = 0.95;
  const disc = new CylinderGeometry(r, r, 0.22, lod === 0 ? 20 : lod === 1 ? 12 : 8, 1);
  disc.rotateX(Math.PI / 2);
  disc.translate(x, cy, z);
  out.straw.push(tintGeometry(boxUV(disc), () => 0.95));
  if (lod < 2) {
    // The painted rings on its face.
    const rings = [[0.36, 0x9a2a1e], [0.25, 0xe8dcc0], [0.14, 0x9a2a1e], [0.05, 0x1e1a16]];
    rings.forEach(([rr, hex], i) => {
      const d = new CylinderGeometry(rr, rr, 0.005, lod === 0 ? 20 : 12, 1);
      d.rotateX(Math.PI / 2);
      d.translate(x, cy, z + 0.112 + i * 0.002);
      out.paint.push(tintGeometry(boxUV(d), () => lin(hex)));
    });
  }
  // The trestle: two legs splayed, a back strut.
  for (const s of [-1, 1]) out.wood.push(timberBeam([x + s * 0.32, 0, z + 0.12], [x + s * 0.16, cy + 0.2, z - 0.06], 0.06));
  out.wood.push(timberBeam([x, 0, z - 0.55], [x, cy + 0.1, z - 0.12], 0.06));
  if (lod === 0) {
    // Arrows stuck in it.
    const rnd = artRng(seed);
    for (let k = 0; k < 5; k++) {
      const a = rnd() * Math.PI * 2;
      const rr = rnd() * 0.28;
      const px = x + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      out.wood.push(staff([px, py, z + 0.1], [px + (rnd() - 0.5) * 0.08, py + (rnd() - 0.3) * 0.08, z + 0.62], 0.007, 3));
      out.paint.push(tintGeometry(box(0.003, 0.05, 0.1, px + (rnd() - 0.5) * 0.08, py + 0.0, z + 0.56, 1), () => lin(0xd8d0c0)));
    }
  }
}

/** A rack of composite bows and quivers at (x, z), along x: two posts and a rail, the bows' recurved limbs, quivers hung. */
function bowRack(x, z, lod, out) {
  for (const s of [-1, 1]) out.wood.push(box(0.08, 1.25, 0.08, x + s * 0.7, 0, z, 0.8));
  out.wood.push(box(1.5, 0.07, 0.07, x, 1.12, z, 0.8));
  out.wood.push(box(1.5, 0.06, 0.06, x, 0.45, z - 0.06, 0.8));
  if (lod === 2) return;
  // Bows hung by their strings from the rail: a curve of horn and wood, the tips turned back.
  for (let k = 0; k < 5; k++) {
    const bx = x - 0.56 + k * 0.28;
    const pts = [[0.06, 0.5, 0], [0.0, 0.38, 0], [-0.02, 0.0, 0], [0.0, -0.38, 0], [0.06, -0.5, 0]];
    const g = tube(pts.map(([px, py]) => [bx + px * 0.6, 0.62 + py * 0.95, z + 0.06]), 0.014, { radial: lod ? 3 : 5, segments: lod ? 4 : 10, around: 0.1 });
    out.leather.push(tintGeometry(g, () => lin(0x5a3a22)));
    if (lod === 0) out.rope.push(staff([bx + 0.036, 1.1, z + 0.06], [bx + 0.036, 0.15, z + 0.06], 0.003, 3));
  }
  // Quivers on pegs at the ends, fletchings out of their mouths.
  for (const s of [-1, 1]) {
    const qx = x + s * 0.82;
    const q = new CylinderGeometry(0.06, 0.05, 0.55, lod ? 6 : 10, 1);
    q.rotateZ(s * 0.12);
    q.translate(qx, 0.75, z + 0.05);
    out.leather.push(tintGeometry(boxUV(q), () => lin(0x6b4a2a)));
    if (lod === 0) for (let k = 0; k < 5; k++) out.paint.push(tintGeometry(box(0.012, 0.12, 0.012, qx - 0.03 + (k % 3) * 0.03, 1.04, z + 0.03 + (k >> 1) * 0.03, 1), () => lin(k % 2 ? 0xe8e0d0 : 0x8a2a1e)));
  }
}

/** The shrine of the standards: a small timber hall, plastered panels between its posts, thatched; the standards before it. */
function shrine(lod, seed, out, std) {
  const [x0, x1, z0, z1] = A.shrine;
  const cx = (x0 + x1) / 2;
  const eave = 1.5;
  // A sill of stones, the posts, the panels plastered and limewashed.
  out.stone.push(box(x1 - x0 + 0.1, 0.18, z1 - z0 + 0.1, cx, 0, (z0 + z1) / 2, 0.75));
  out.plaster.push(box(x1 - x0 - 0.06, eave - 0.18, z1 - z0 - 0.06, cx, 0.18, (z0 + z1) / 2, 0.92));
  for (const x of [x0, cx - 0.42, cx + 0.42, x1]) for (const z of [z0, z1]) out.wood.push(box(0.12, eave - 0.18, 0.12, Math.max(x0 + 0.06, Math.min(x1 - 0.06, x)), 0.18, z + (z === z0 ? 0.06 : -0.06), 0.75));
  out.wood.push(box(x1 - x0 + 0.04, 0.1, 0.13, cx, eave - 0.1, z1 - 0.06, 0.75));
  // The doorway (dark) and its frame.
  out.dark.push(box(0.7, 1.0, 0.02, cx, 0.18, z1 + 0.005));
  // The thatch: two thick slopes meeting on a ridge along z, steep, as a thatcher lays it.
  const rise = 0.95;
  for (const sgn of [-1, 1]) {
    const e = sgn * ((x1 - x0) / 2 + 0.3);
    const sec = [[e, eave - 0.1], [0, eave + rise], [0, eave + rise - 0.22], [e * 0.93, eave - 0.26]];
    // (prism runs along x and its section is in (z, y): built so, then turned to run along z.)
    const th = prism(z0 - 0.25, z1 + 0.3, sec, (gx, gy) => 0.78 + 0.22 * Math.min(1, (gy - eave + 0.2) / rise));
    th.rotateY(-Math.PI / 2);
    th.translate(cx, 0, 0);
    out.thatch.push(th);
  }
  // Gables of boards.
  for (const z of [z1, z0]) {
    const g = box(x1 - x0 - 0.04, 1, 0.05, cx, 0, z + (z === z1 ? -0.04 : 0.04), 0.7);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? eave + rise * 0.82 * (1 - Math.abs(p.getX(i) - cx) / ((x1 - x0) / 2)) : eave);
    g.computeVertexNormals();
    out.wood.push(g);
  }
  // The standards before its door.
  const z = z1 + 0.55;
  standardBase(-0.5, 0.5, z, lod, out, 3);
  signum(0, z, 2.0, lod, std, { hand: true, discs: 4 });
  vexillum(-0.5, z, 1.95, lod, std, GREEN);
  imago(0.5, z, 1.8, lod, std);
}

/** A hearth of stones with a cauldron on a tripod (the tents' cooking). */
function hearth(x, z, lod, out) {
  const n = lod ? 6 : 9;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    out.stone.push(box(0.14, 0.1, 0.12, x + Math.cos(a) * 0.32, 0, z + Math.sin(a) * 0.32, 0.6));
  }
  out.dark.push(box(0.5, 0.02, 0.5, x, 0, z));
  if (lod === 2) return;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    out.iron.push(staff([x + Math.cos(a) * 0.42, 0, z + Math.sin(a) * 0.42], [x, 0.95, z], 0.012, 4));
  }
  const pot = new CylinderGeometry(0.17, 0.12, 0.22, lod ? 8 : 14, 1);
  pot.translate(x, 0.42, z);
  out.bronze.push(tintGeometry(boxUV(pot), () => 0.55));
  out.iron.push(staff([x, 0.53, z], [x, 0.93, z], 0.006, 3));
}

/** Build the archer fort: { group, meshes, triangles }; meshes tagged in userData.when. */
export function buildArcherFort({ lod = 0, seed = 131, stake = A.stakes } = {}) {
  lod = Math.max(0, Math.min(2, lod | 0));
  const out = fortBag();
  const std = { wood: [], gilt: [], silver: [], cloth: [], iron: [], bronze: [], rope: [] };
  campRampart({ lod, seed, out, stake, side: 1.0, label: 'SAGITTARII', boardWidth: 1.9 });
  // The yard.
  gravel(-CAMP.inner, CAMP.inner, -CAMP.inner, CAMP.inner, out);
  const shrineStd = std;
  shrine(lod, seed + 40, out, shrineStd);
  // Tents in their rows on the left; a hearth before them.
  A.tents.forEach(([x, z], i) => {
    const t = tent({ L: 1.45, w: 1.15, h: 1.08, wall: 0.28, lod, open: i % 2 === 0, seed: seed + 50 + i });
    for (const list of Object.values(t)) for (const g of list) g.translate(x, 0.03, z);
    out.leather.push(...t.leather);
    out.wood.push(...t.wood);
    out.rope.push(...t.rope);
    out.dark.push(...t.dark);
  });
  hearth(-2.15, 0.75, lod, out);
  for (const [i, [x, z]] of A.butts.entries()) butt(x, z, lod, out, seed + 60 + i);
  bowRack(3.15, 3.85, lod, out);
  // A water butt by the gate.
  out.wood.push(cyl(0.3, 0.27, 0.72, lod ? 8 : 14, -2.6, 0, 4.05, 0.8));
  if (lod < 2) for (const y of [0.12, 0.55]) out.iron.push(cyl(0.305, 0.3, 0.05, lod ? 8 : 14, -2.6, y, 4.05, 0.6));
  out.water.push(cyl(0.26, 0.26, 0.01, lod ? 8 : 14, -2.6, 0.64, 4.05));
  const { p } = assemble('praesidium', out, std, lod, A.lamps);
  // (The watch are actors: archerActors.)
  return p.build();
}

/**
 * The archer fort's watch (people/actors.js specs, its metres) while its
 * men are home ('open'): on the front walk right of the gate an archer
 * shooting out over the stakes (his bow above their points, his drawing
 * hand clear of the rail), a sentry pacing the walk left of the gate (short
 * of the corner tower's ladder) and one down the right side's walk, each
 * standing guard at the ends; an archer at the butts, loosing at the
 * nearer target from beyond the men's places in the yard. Not under the
 * towers' low roofs: a man stands taller than their decks leave room for.
 * Nobody while the men are out or the fort is empty.
 */
export function archerActors(state) {
  if (state !== 'open') return [];
  const archer = (extra) => soldier('archer', { clip: 'shoot', props: { L: 'bow', R: 'arrow' }, ...extra });
  const [bx, bz] = A.butts[1];
  const at = [3.6, CASTRA.floorY, -2.0];
  return [
    archer({ at: [3.0, CAMP.walkY, CAMP.walkZ], ry: 0, seed: 21 }),
    wallSentry('archer', -3.4, -1.95, CAMP.walkY, CAMP.walkZ, 22),
    wallSentry('archer', -3.0, 3.0, CAMP.walkY, CAMP.walkZ, 23, 1),
    archer({ at, ry: Math.atan2(bx - at[0], bz - at[2]), seed: 24 }),
  ];
}

export { TANK_WATER };
