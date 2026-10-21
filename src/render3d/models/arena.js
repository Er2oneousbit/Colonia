/**
 * models/arena.js
 * ----------------------------------------------------------------------------
 * The Great Arena of the 3D look on its 5 x 5 footprint (20 m): the earliest
 * kind of stone amphitheatre, from the record rather than the 2D sprite.
 * The game is set about 300 BC, when Rome's shows were held in timber stands
 * in the Forum; the first amphitheatre of stone, Pompeii's (about 70 BC, the
 * oldest that stands), was itself still of the Republic and still, in
 * essence, an earth bank round a pit. This is that building at the scale of
 * a town that has money:
 *
 *   - The bank: the seats lie on an embankment of earth, the arena dug
 *     below the ground inside it (the sand here stays at the ground's level,
 *     so the seating rises from it), held on the outside by a retaining
 *     wall: tufa ashlar for the footing, the buttresses and the copings,
 *     rubble faced in opus incertum (small irregular stones in mortar)
 *     between them, with a row of blind arches at the foot as buttressing.
 *   - The stairs: two great double staircases climb the outside of the bank
 *     to the top, on the long sides, two flights meeting at a landing (the
 *     feature Pompeii is known for: there are no stairs inside the bank). At
 *     the landing the way goes in through the timber stand.
 *   - The top tier: its seats are of timber, over the crest of the bank,
 *     behind a timber rail; the stone ledge along the wall's top holds the
 *     sockets of the masts (Pompeii's inscriptions promise an awning, vela,
 *     and the House of Actius Anicetus's picture of the riot of AD 59 shows
 *     it drawn over the upper seats, the stairs and the crowd): timber poles
 *     round the rim, the sailcloth spread on show days.
 *   - The entrances: two tunnels through the bank at the ends of the long
 *     axis, an arched portal outside between wing walls that step down, the
 *     passage sloping down to the arena and the gates in the podium; the
 *     beasts' cages open from them (the small barred hatches in the podium
 *     by each gate). No lifts and no cellars below the sand yet.
 *   - Inside: the sand, raked; the podium wall round it, plastered and
 *     painted in panels with gladiators and beasts (Pompeii's podium
 *     frescoes were of this kind); the magistrates' box on the short axis, a
 *     railed platform of boards over the podium, and the editor's seat
 *     opposite; the cavea in tiers by rank divided by walls (baltei) with
 *     radial gangways, the women and the poor at the top.
 *
 * So, in 20 m: an oval about 19 by 16 m; the wall 3 m high, the stand and
 * its rail over it 4.2 m; the sand 8 by 5 m; the stairs on the two long
 * sides; the tunnel portals on the ends; masts to 5.2 m. The height stays
 * low because from the game's camera a wall hides ground 1.7 times its height
 * behind it.
 *
 * States (models.js partShows tags): 'open' a show on (the awning, the
 * lamps lit, the gates open, the crowd: models/venues.js), 'out' staffed and
 * idle (the gates open, attendants raking), 'shut' (the gates shut).
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { material } from '../materials.js';
import { TaggedParts } from './masonry.js';
import { lin } from './domus.js';
import {
  venueMaterials, flatParts, sweep, ellipseCurves, caveaProfile, box, gates, sandFloor, rakeLines, rowSeats, tinted, velarium, lampstand,
} from './venue.js';

/** The Great Arena's measures (metres): the tests, the lab and the game read them. */
export const ARENA = Object.freeze({
  half: 10,
  /** The sand's half axes (x, z). */
  arena: Object.freeze([3.85, 2.5]),
  podium: 0.8,
  /** The retaining wall's height (the bank's crest, under the timber stand). */
  wall: 3,
});

const A = ARENA;
const CAVEA = caveaProfile({ podium: A.podium, walk: 0.32, tiers: [[3, 0.55, 0.3, 0.2], [3, 0.55, 0.3, 0.2], [2, 0.55, 0.3, 0]] });
/** Where the profile's third tier (the timber one) begins: the second wall's top, at the wall's height. */
const TIMBER_FROM = CAVEA.profile.findIndex(([, y], i) => i > 3 && Math.abs(y - A.wall) < 1e-6 && Math.abs(CAVEA.profile[i - 1][1] - A.wall) < 1e-6);
/** The timber stand's walkway behind the last row, its outer fascia, the wall's face (offsets from the sand's edge). */
const WALK = CAVEA.top.d + 0.24;
const FASCIA = WALK + 0.04;
const FACE = FASCIA + 0.28;
/** The timber stand's floor (the top row's height) and the rail over it. */
const DECK = CAVEA.top.y;
const RAIL = DECK + 0.62;
const AT = ellipseCurves(A.arena[0], A.arena[1]);
/** The stairs: the long sides' middles (t 0.25, 0.75); the tunnels: the ends (t 0, 0.5). */
const STAIRS = [0.25, 0.75];
const TUNNELS = [0, 0.5];
/** A stair's measures: the landing's half width, a flight's step run and radial depth, the landing's reach beyond the flights. */
const STAIR = Object.freeze({ x0: 0.75, run: 0.21, w: 0.8, reach: 0.3 });
/** Half the width (in t) of the gap in the timber rail at a stair's landing. */
const GAP = 0.0135;

/** The distance between two t on the closed oval (0 to 0.5). */
const around = (a, b) => {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
};

/** The materials of the bank and its wall (new looks: one key, one look). */
function arenaMaterials() {
  return {
    ...venueMaterials(),
    // Tufa in squared courses (opus quadratum): the footing, buttresses, arches, stairs, copings.
    ashlar: material('arena-ashlar', { surface: 'ashlar', vertexColors: true, snow: 1 }),
    // Rubble in mortar between the ashlar (opus incertum): small irregular stones, the wall's face.
    incertum: material('arena-incertum', { surface: 'polygonal', color: 0xd9c9a6, vertexColors: true, snow: 1 }),
    // The top tier's boards, the rail and the boxes' platforms: plain timber, weathered.
    timber: material('arena-timber', { surface: 'wood', color: 0xf4e8d2, vertexColors: true, snow: 1 }),
  };
}

/** The wall's outward frame at offset d and t: [x, z, ry] (a model built facing +z, turned by ry, faces outward). */
function frame(d, t) {
  const [x, z] = AT(d, t);
  const th = t * Math.PI * 2;
  return [x, z, Math.atan2(Math.cos(th) / (A.arena[0] + d), Math.sin(th) / (A.arena[1] + d))];
}

/** A geometry built about the origin facing +z, set at offset d, t on the oval. */
function put(g, d, t) {
  const [x, z, ry] = frame(d, t);
  g.rotateY(ry);
  g.translate(x, 0, z);
  return g;
}

/** The t, on a long side (the +z one if `front`), at which the oval at offset d is s along x from the side's middle. */
function tAlong(front, s, d) {
  const th = Math.acos(Math.max(-1, Math.min(1, s / (A.arena[0] + d))));
  return (front ? th : Math.PI * 2 - th) / (Math.PI * 2);
}

/** Is t in a stair's gap in the timber rail? */
const inGap = (t) => STAIRS.some((g) => Math.abs(t - g) < GAP);

/** A voussoir ring of `seg + 1` stones on a half circle (radius r about (0, y)), each `w` wide, `h` deep, `dz` thick, set at (d, t): geometries. */
function voussoirs(seg, r, y, w, h, dz, d, t, k) {
  const out = [];
  for (let j = 0; j <= seg; j++) {
    const a = Math.PI * (j / seg);
    const v = box(w, h, dz, 0, -h / 2, 0, j === seg / 2 ? k + 0.08 : k);
    v.rotateZ(a - Math.PI / 2);
    v.translate(Math.cos(a) * r, y + Math.sin(a) * r, 0);
    out.push(put(v, d, t));
  }
  return out;
}

/** The seating inside: stone tiers on the bank, the timber top tier, the podium's frescoes, the gangways. */
function cavea(lod, p, M) {
  const n = lod === 0 ? 128 : lod === 1 ? 64 : 32;
  const stone = CAVEA.profile.slice(0, TIMBER_FROM + 1);
  const board = [...CAVEA.profile.slice(TIMBER_FROM), [WALK, DECK], [FASCIA, DECK]];
  const tint = (x, y, z, i) => {
    const tread = i >= 3 && (i - 3) % 2 === 1;
    const k = tread ? 1 : 0.8;
    return [k, k * 0.97, k * 0.92];
  };
  p.add('seats', M.seats, sweep(AT, stone, n, { tint }));
  // The top tier on timber over the crest: boards, the treads paler than the risers.
  p.add('timber', M.timber, sweep(AT, board, n, { tint: (x, y, z, i) => (i % 2 ? 1.12 : 0.9) }));
  // The podium's coping, of tufa, and the baltei's.
  p.add('ashlar', M.ashlar, sweep(AT, [[-0.03, A.podium - 0.02], [-0.03, A.podium + 0.06], [0.2, A.podium + 0.06]], n, { tint: () => 0.95 }));
  for (const k of [2, 5]) {
    const dw = CAVEA.rows[k].d + CAVEA.rows[k].depth;
    const yw = CAVEA.rows[k].y;
    p.add('ashlar', M.ashlar, sweep(AT, [[dw - 0.02, yw + 0.2], [dw - 0.02, yw + 0.24], [dw + 0.14, yw + 0.24]], n, { tint: () => 0.93 }));
  }
  if (lod === 2) return;
  // The gangways: sixteen worn radial strips over the stone tiers (the crowd leaves them clear), in a darker tread.
  for (let k = 0; k < 16; k++) {
    const t0 = (k + 0.5) / 16 - 0.01;
    const t1 = (k + 0.5) / 16 + 0.01;
    const at = (d, t) => AT(d, t0 + (t1 - t0) * t);
    p.add('seats', M.seats, sweep(at, stone.slice(3).map(([d, y]) => [d, y + 0.004]), 2, { tint: () => 0.62 }));
  }
  // The podium wall painted in panels over a dark dado: red and ochre fields, a gladiator or a lion in most.
  const panels = lod === 0 ? 28 : 14;
  const dark = lin(0x221a16, 1.2);
  for (let k = 0; k < panels; k++) {
    const t0 = (k + 0.08) / panels;
    const t1 = (k + 0.92) / panels;
    const c = k % 2 ? lin(0x9e2a1c, 1.4) : lin(0xd09a3a, 1.3);
    const at = (d, t) => AT(d, t0 + (t1 - t0) * t);
    p.add('fresco', M.fresco, sweep(at, [[-0.012, 0.22], [-0.012, A.podium - 0.1]], 4, { tint: () => c }));
    if (lod === 0) paintFigure(p, M, k, (t0 + t1) / 2, dark);
  }
  p.add('fresco', M.fresco, sweep(AT, [[-0.011, 0.02], [-0.011, 0.2]], n, { tint: () => dark }));
}

/** A figure on a podium panel at t: a gladiator with his shield, a lion, or nothing (a plain field), by `k`. Small flat boxes in the paint's dark. */
function paintFigure(p, M, k, t, dark) {
  const m = k % 3;
  if (m === 2) return;
  const y0 = 0.3;
  const z = 0.008;
  const parts = m === 0
    // A gladiator: legs, body, helmet, the great shield on his arm, a sword.
    ? [box(0.07, 0.14, 0.012, -0.02, y0, z), box(0.1, 0.16, 0.012, -0.02, y0 + 0.14, z), box(0.07, 0.06, 0.012, -0.02, y0 + 0.3, z), box(0.12, 0.24, 0.012, 0.1, y0 + 0.06, z), box(0.03, 0.2, 0.012, -0.12, y0 + 0.2, z)]
    // A lion: the long body on four legs, the head, the tail.
    : [box(0.4, 0.15, 0.012, 0, y0 + 0.1, z), box(0.12, 0.12, 0.012, 0.24, y0 + 0.16, z), box(0.03, 0.1, 0.012, -0.14, y0, z), box(0.03, 0.1, 0.012, 0.14, y0, z), box(0.03, 0.18, 0.012, -0.22, y0 + 0.1, z)];
  // (Built facing +z, the figures sit a hair out of the arena's side of the panel: the oval's offset is negative inward.)
  for (const g of parts) {
    g.rotateY(Math.PI);
    p.add('fresco', M.fresco, put(tinted(g, dark), -0.024, t));
  }
}

/** The wall: footing, rubble face, buttresses with blind arches, the coping and ledge; the timber fascia and rail over it. */
function wall(lod, p, M) {
  const n = lod === 0 ? 160 : lod === 1 ? 80 : 40;
  // The footing in tufa ashlar, the face in opus incertum, the coping and the ledge the masts stand on in ashlar.
  p.add('ashlar', M.ashlar, sweep(AT, [[FACE, 0.4], [FACE + 0.06, 0.4], [FACE + 0.06, 0]], n, { tint: () => 0.9 }));
  p.add('incertum', M.incertum, sweep(AT, [[FACE, A.wall - 0.14], [FACE, 0.4]], n, { tint: (x, y) => 0.86 + 0.1 * Math.min(1, y / A.wall) }));
  p.add('ashlar', M.ashlar, sweep(AT, [[FASCIA - 0.02, A.wall], [FACE + 0.06, A.wall], [FACE + 0.06, A.wall - 0.14], [FACE, A.wall - 0.14]], n, { tint: () => 1 }));
  // A buttress between each pair of blind arches round the foot; the tunnels and the stairs take the place of the arches there.
  const bays = lod === 0 ? 36 : lod === 1 ? 24 : 0;
  const special = [...TUNNELS, ...STAIRS];
  for (let k = 0; k < bays; k++) {
    const tm = (k + 0.5) / bays;
    if (!special.some((g) => around(tm, g) < 1.5 / bays)) {
      // The blind arch: a darker recess on the rubble, a round head over its jambs, ringed in ashlar.
      const ow = 0.9;
      const spring = 1.75;
      const shade = [0.62, 0.6, 0.56];
      p.add('incertum', M.incertum, put(tinted(box(ow, spring - 0.4, 0.01, 0, 0.4, 0, 1), shade), FACE + 0.004, tm));
      const head = new CylinderGeometry(ow / 2, ow / 2, 0.01, lod === 1 ? 6 : 12, 1, false, -Math.PI / 2, Math.PI);
      head.rotateX(-Math.PI / 2);
      head.translate(0, spring, 0);
      p.add('incertum', M.incertum, put(tinted(tintGeometry(boxUV(head)), shade), FACE + 0.004, tm));
      if (lod === 0) {
        for (const v of voussoirs(6, ow / 2 + 0.03, spring, 0.09, 0.1, 0.05, FACE + 0.02, tm, 0.98)) p.add('ashlar', M.ashlar, v);
        for (const sx of [-1, 1]) p.add('ashlar', M.ashlar, put(box(0.1, spring - 0.4, 0.05, sx * (ow / 2 + 0.03), 0.4, 0, 0.98), FACE + 0.02, tm));
      }
    }
    const t = k / bays;
    if (!special.some((g) => around(t, g) < 1 / bays)) {
      p.add('ashlar', M.ashlar, put(box(0.3, A.wall - 0.4, 0.2, 0, 0.4, 0.06, k % 2 ? 0.86 : 0.92), FACE, t));
    }
  }
  // The timber stand's fascia over the wall: planking from the deck down to the ledge, and the rail above it, both broken at the stairs.
  const skip = inGap;
  p.add('timber', M.timber, sweep(AT, [[FASCIA, DECK], [FASCIA, A.wall]], n, { tint: () => 0.88, skip }));
  for (const y of [DECK + 0.46, RAIL]) {
    p.add('timber', M.timber, sweep(AT, [[FASCIA - 0.05, y], [FASCIA - 0.05, y + 0.07], [FASCIA + 0.01, y + 0.07], [FASCIA + 0.01, y]].reverse(), n, { tint: () => 1, skip }));
  }
  const posts = lod === 2 ? 16 : 32;
  for (let k = 0; k < posts; k++) {
    const t = k / posts;
    if (inGap(t)) continue;
    p.add('timber', M.timber, put(box(0.1, RAIL - DECK + 0.14, 0.1, 0, DECK, 0, 0.85), FASCIA - 0.02, t));
  }
}

/** The two great double stairs up the outside of the long sides to the landing at the wall's top, and the doorway into the stand. */
function stairs(lod, p, M) {
  const { x0, run, w, reach } = STAIR;
  const H = A.wall;
  const n = 16;
  const rise = H / (n + 1);
  for (const front of [true, false]) {
    const t0 = front ? 0.25 : 0.75;
    const dC = FACE + w / 2 - 0.01;
    for (const side of [-1, 1]) {
      for (let k = 0; k < n; k++) {
        const t = tAlong(front, side * (x0 + (k + 0.5) * run), dC);
        const h = H - (k + 1) * rise;
        // (Each step a block from the ground: the flight is solid masonry, as Pompeii's.)
        p.add('ashlar', M.ashlar, put(box(run + 0.012, h, w, 0, 0, 0, k % 2 ? 0.88 : 0.95), dC, t));
        // The parapet along the flight's outer edge, a step higher than the tread.
        if (lod < 2) p.add('ashlar', M.ashlar, put(box(run + 0.012, 0.3, 0.12, 0, h, w / 2 - 0.06, 0.82), dC, t));
      }
    }
    // The landing at the top, a little proud of the flights, with a low parapet round its three sides.
    p.add('ashlar', M.ashlar, put(box(2 * x0 + 0.02, H, w + reach, 0, 0, reach / 2, 1), dC, t0));
    if (lod < 2) {
      for (const side of [-1, 1]) p.add('ashlar', M.ashlar, put(box(0.1, 0.4, w + reach, side * x0, H, reach / 2, 0.85), dC, t0));
      p.add('ashlar', M.ashlar, put(box(2 * x0 + 0.1, 0.4, 0.1, 0, H, w / 2 + reach - 0.05, 0.85), dC, t0));
    }
    // The way in: the dark of the doorway through the timber stand, and two boards' steps up to its deck.
    p.add('dark', M.dark, put(box(2 * x0 - 0.1, DECK - H + 0.5, 0.02, 0, H, 0, 1), FASCIA + 0.01, t0));
    for (let j = 0; j < 2; j++) {
      const rise2 = ((DECK - H) * (j + 1)) / 3;
      p.add('timber', M.timber, put(box(2 * x0 - 0.1, rise2 + 0.02, 0.17, 0, H - 0.02, 0, 0.95), FACE - 0.07 - 0.17 * j, t0));
    }
  }
}

/** The tunnels' portals at the ends of the long axis: a great arch in the wall between wing walls that step down toward the ground. */
function portals(lod, p, M) {
  for (const t of TUNNELS) {
    const ow = 1.6;
    const spring = 1.7;
    p.add('dark', M.dark, put(box(ow, spring, 0.02, 0, 0, 0, 1), FACE + 0.012, t));
    const head = new CylinderGeometry(ow / 2, ow / 2, 0.02, lod ? 8 : 16, 1, false, -Math.PI / 2, Math.PI);
    head.rotateX(-Math.PI / 2);
    head.translate(0, spring, 0);
    p.add('dark', M.dark, put(tintGeometry(boxUV(head)), FACE + 0.012, t));
    // The jambs and the ring of voussoirs, in ashlar, a keystone the highest.
    for (const sx of [-1, 1]) p.add('ashlar', M.ashlar, put(box(0.3, spring, 0.22, sx * (ow / 2 + 0.15), 0, 0.08, 0.96), FACE, t));
    for (const v of voussoirs(lod === 0 ? 10 : lod === 1 ? 6 : 4, ow / 2 + 0.13, spring, 0.26, 0.26, 0.22, FACE + 0.08, t, 0.96)) p.add('ashlar', M.ashlar, v);
    // The wing walls stepping down toward the ground (the passage slopes down into the arena).
    if (lod < 2) {
      for (const sx of [-1, 1]) for (let j = 0; j < 3; j++) {
        p.add('ashlar', M.ashlar, put(box(0.26, 2.0 - 0.6 * j, 0.45, sx * (1.15 + 0.25 * j), 0, 0.22, 0.88 - 0.03 * j), FACE, t));
      }
    }
  }
}

/** The arena: the sand, raked; the gates at both ends in the podium, the cages' hatches by them; lampstands. */
function arena(lod, p, M) {
  p.add('sand', M.sand, sandFloor(AT, lod ? 40 : 80, 0.02));
  if (lod < 2) p.add('sand', M.sand, rakeLines(AT, [-0.3, -0.7, -1.1, -1.5, -1.9], 0.024, lod ? 64 : 128));
  for (const t of TUNNELS) {
    const s = t === 0 ? 1 : -1;
    const x = s * (A.arena[0] + 0.004);
    p.add('dark', M.dark, box(0.02, A.podium - 0.06, 1.0, x, 0, 0, 1));
    for (const [st, open] of [['staffed', true], ['shut', false]]) {
      const g = gates(0, 0, 0.98, A.podium - 0.08, 0, open, lod);
      for (const list of [g.wood, g.bronze]) {
        for (const q of list) {
          q.rotateY(s * Math.PI / 2);
          q.translate(x - s * 0.02, 0, 0);
        }
      }
      p.add(`gate-wood-${st}`, M.wood, g.wood, { when: st });
      if (g.bronze.length) p.add(`gate-bronze-${st}`, M.bronze, g.bronze, { when: st });
    }
    // The beasts' cages: a barred hatch either side of the tunnel's mouth, a dark opening with timber bars and a lintel.
    if (lod < 2) {
      for (const z of [-1, 1]) {
        const zc = z * 0.98;
        p.add('dark', M.dark, box(0.02, 0.42, 0.34, x - s * 0.01, 0.1, zc, 1));
        p.add('wood', M.wood, box(0.04, 0.06, 0.42, x - s * 0.03, 0.52, zc, 0.7));
        if (lod === 0) for (let j = 0; j < 4; j++) p.add('wood', M.wood, box(0.03, 0.42, 0.03, x - s * 0.035, 0.1, zc - 0.135 + j * 0.09, 0.62));
      }
    }
    for (const z of [-0.85, 0.85]) {
      const l = lampstand(s * (A.arena[0] - 0.3), z, 1.0, 0.02, lod);
      p.add('bronze', M.bronze, l.bronze);
      p.add('flame', M.flame, l.flames, { when: 'open', cast: false });
    }
  }
}

/** The magistrates' box (-z) and the editor's seat opposite (+z): railed platforms of boards over the podium, chairs on them. */
function boxes(lod, p, M) {
  for (const [side, w, chairs] of [[-1, 2.0, [-0.5, 0, 0.5]], [1, 1.4, [-0.25, 0.25]]]) {
    const z = side * (A.arena[1] + 0.2);
    const y = A.podium + 0.07;
    // The platform: boards over the podium's top and the walkway behind it, to the first row's riser.
    p.add('timber', M.timber, box(w, 0.1, 0.4, 0, y - 0.1, z, 0.95));
    // The rail along the arena's side, posts and two rails; the magistrates' box has side rails too.
    const zf = z - side * 0.16;
    const rail = (x0, z0, x1, z1) => {
      for (const h of [0.3, 0.55]) p.add('timber', M.timber, box(Math.abs(x1 - x0) + 0.05, 0.04, Math.abs(z1 - z0) + 0.05, (x0 + x1) / 2, y + h, (z0 + z1) / 2, 0.9));
    };
    rail(-w / 2, zf, w / 2, zf);
    if (side < 0) for (const sx of [-w / 2, w / 2]) rail(sx, zf, sx, z + side * 0.16);
    for (const sx of [-w / 2, -w / 4, 0, w / 4, w / 2]) p.add('timber', M.timber, box(0.05, 0.62, 0.05, sx, y, zf, 0.85));
    for (const x of chairs) {
      p.add('bronze', M.bronze, box(0.46, 0.04, 0.34, x, y + 0.4, z, 0.9));
      for (const sx of [-0.19, 0.19]) for (const sz of [-0.13, 0.13]) p.add('bronze', M.bronze, box(0.03, 0.4, 0.03, x + sx, y, z + sz, 0.85));
      if (lod < 2) p.add('cushion', M.cloth, tinted(box(0.44, 0.05, 0.32, x, y + 0.44, z), lin(side < 0 ? 0x6a2248 : 0x9e2a1c)));
    }
  }
}

/** The Great Arena at a level of detail: { group, meshes, triangles }. */
export function buildArena({ lod = 0 } = {}) {
  const M = arenaMaterials();
  const p = new TaggedParts('arena');
  cavea(lod, p, M);
  wall(lod, p, M);
  stairs(lod, p, M);
  portals(lod, p, M);
  arena(lod, p, M);
  boxes(lod, p, M);
  // Timber masts on the wall's ledge (in their stone sockets) and the awning of sailcloth over the top tier on show days.
  const masts = lod === 2 ? 16 : 32;
  const ts = Array.from({ length: masts }, (_, k) => (k + 0.5) / masts);
  velarium(p, M, AT, { ts, dm: FASCIA + 0.16, dIn: FASCIA - 0.9, y0: A.wall, yTop: RAIL + 0.95, drop: 0.22, lod, closed: true, stripes: 96 });
  if (lod < 2) {
    for (const t of ts) {
      const [x, z] = AT(FASCIA + 0.16, t);
      p.add('ashlar', M.ashlar, box(0.16, 0.12, 0.16, x, A.wall, z, 0.9));
    }
  }
  return flatParts(p.build());
}

/** Where the crowd sits: [[x, y, z, ry, band, rise], ...]: the togate in the first tier, the people in the second, the women and the poor in the third. */
export function arenaSeats() {
  const out = [];
  CAVEA.rows.forEach((r, k) => {
    // Clear of the gates, the boxes (first row only) and the gangways (the tiers' sixteenths).
    const skip = (t) => [0, 0.5].some((g) => around(t, g) < 0.03)
      || (k < 2 && (Math.abs(t - 0.75) < 0.06 || Math.abs(t - 0.25) < 0.045))
      || Math.abs(((t * 16) % 1) - 0.5) < 0.12;
    for (const s of rowSeats(AT, r.d, r.y, 0, 1, skip)) out.push([...s, k < 3 ? 'toga' : k < 6 ? 'plebs' : 'pullati', r.rise]);
  });
  return out;
}

/** The lamps: the lampstands by the gates, and a lantern by each stair's landing and each tunnel's portal (each facing out). */
export const ARENA_LAMPS = Object.freeze([
  ...[1, -1].flatMap((s) => [-0.85, 0.85].map((z) => Object.freeze([s * (A.arena[0] - 0.3), 1.1, z, 0, -s]))),
  Object.freeze([0, A.wall + 0.7, A.arena[1] + FACE + 0.4, 1]),
  Object.freeze([0, A.wall + 0.7, -(A.arena[1] + FACE + 0.4), -1]),
  Object.freeze([A.arena[0] + FACE + 0.3, 2.3, 0, 0, 1]),
  Object.freeze([-(A.arena[0] + FACE + 0.3), 2.3, 0, 0, -1]),
]);

/** Where things are, for the people (models/venueActors.js): the boxes' chairs [x, y (floor), z, ry]. */
export const ARENA_SPOTS = Object.freeze({
  governor: Object.freeze([-0.5, 0, 0.5].map((x) => Object.freeze([x, A.podium + 0.07, -(A.arena[1] + 0.2), 0]))),
  editor: Object.freeze([-0.25, 0.25].map((x) => Object.freeze([x, A.podium + 0.07, A.arena[1] + 0.2, Math.PI]))),
});
