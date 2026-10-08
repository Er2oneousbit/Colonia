/**
 * models/amphitheatrum.js
 * ----------------------------------------------------------------------------
 * The amphitheatre of the 3D look on its 3 x 3 footprint (12 m), from the
 * record rather than the 2D sprite:
 *
 *   - Pompeii's amphitheatre, the oldest that stands (about 70 BC, built by
 *     the duoviri Quinctius Valgus and Porcius at their own cost "for the
 *     colonists", its dedication says; called a spectacula, the word
 *     amphitheatrum came later): its arena dug into the ground and its
 *     seats laid on the banks of earth so raised, held by an outer wall of
 *     blind arches with buttresses; the double stairs up the outside to
 *     the walkway at the top (no stairs inside its banks); the two long
 *     passages through the banks to the arena at the ends of its long axis;
 *     the podium wall round the sand, painted (gladiators, beasts, Victory)
 *     and topped by a parapet, the magistrates' seats behind it; the masts'
 *     sockets round the top for the awnings the notices promised.
 *   - The riot of AD 59 painted in the House of Actius Anicetus: the
 *     amphitheatre seen from above, its stairs, its awning drawn over the
 *     upper seats, the crowd: the picture this model is built to.
 *   - The provincial amphitheatres (Merida, Paestum, Sutri cut in the
 *     rock) for a small town's: four rows of seats on two tiers, a walkway
 *     between them.
 *
 * So, in 12 m: an oval 11.4 by 9.4 m outside; the sand 5.5 by 3.5 m inside
 * a podium wall 0.8 m high painted in panels and capped in marble; the
 * gates in the podium at both ends of the long axis (the procession's, and
 * the gate of the goddess of death by which the dead were dragged out);
 * two tiers of two rows with a walkway and a low wall between; a parapet
 * round the top; the outer wall of tufa in blind arches between
 * buttresses, its own big arches at the gates, and the double stair up the
 * front; the editor's box on the long side across from it, under a purple
 * canopy; masts round the top and the awning on show days.
 *
 * States (models.js partShows tags):
 *   'open'   a show on: the awning spread, the gates open, the crowd, the
 *            fighters (models/venueShow.js), a play on a stage of boards
 *            at one end when the actors are booked too
 *   'out'    staffed, nothing booked: the gates open, an attendant raking
 *   'shut'   no staff: the gates shut
 *
 * Metres, the footprint's middle at the origin, y up, the street toward +z.
 * Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { TaggedParts } from './masonry.js';
import { lin } from './domus.js';
import {
  venueMaterials, sweep, ellipseCurves, caveaProfile, box, staff, gates, sandFloor, rakeLines, rowSeats, tinted, velarium, lampstand,
} from './venue.js';

/** The amphitheatre's measures (metres): the tests, the lab and the game read them. */
export const AMPHITHEATRUM = Object.freeze({
  half: 6,
  /** The sand's half axes (x, z). */
  arena: Object.freeze([2.75, 1.75]),
  podium: 0.8,
  /** The editor's box: on the far long side (-z), its floor at the podium's top. */
  box: Object.freeze([0, -1]),
});

const A = AMPHITHEATRUM;
const CAVEA = caveaProfile({ podium: A.podium, walk: 0.34, tiers: [[2, 0.6, 0.3, 0.2], [2, 0.6, 0.3, 0]] });
const TOP = Object.freeze({ d: CAVEA.top.d, y: CAVEA.top.y, par: 0.32, wall: 0.16 });
/** The outer face's offset from the sand's edge. */
const OUT = TOP.d + TOP.wall;
const AT = ellipseCurves(A.arena[0], A.arena[1]);
/** The gates: at t 0 (+x) and 0.5 (-x). */
const GATES = [0, 0.5];
/** The stair's flights along the front's outer wall: x from the landing out to the foot, its width. */
const STAIR = Object.freeze({ x0: 0.4, x1: 3.1, w: 0.7, rise: 0.17 });
const zFront = A.arena[1] + OUT;

/** The seats, the walls and the arena: the cavea swept round the oval. */
function cavea(lod, p, M) {
  const n = lod === 0 ? 96 : lod === 1 ? 48 : 24;
  const prof = [...CAVEA.profile, [TOP.d, TOP.y + TOP.par], [OUT, TOP.y + TOP.par], [OUT, 0]];
  const nRows = CAVEA.profile.length;
  const tint = (x, y, z, i) => {
    // Treads pale, risers in their shade, the podium painted (below), the outer wall tufa's grey-brown.
    if (i >= nRows) return [0.74, 0.68, 0.6];
    const tread = i >= 3 && (i - 3) % 2 === 1;
    const k = tread ? 1 : 0.8;
    return [k, k * 0.97, k * 0.92];
  };
  p.add('seats', M.seats, sweep(AT, prof, n, { tint }));
  // The parapet's coping and the podium's marble cap.
  p.add('marble', M.marble, sweep(AT, [[TOP.d - 0.03, TOP.y + TOP.par], [TOP.d - 0.03, TOP.y + TOP.par + 0.05], [OUT + 0.04, TOP.y + TOP.par + 0.05], [OUT + 0.04, TOP.y + TOP.par]], n, { tint: () => 0.95 }));
  p.add('marble', M.marble, sweep(AT, [[-0.03, A.podium - 0.02], [-0.03, A.podium + 0.06], [0.2, A.podium + 0.06]], n, { tint: () => 0.95 }));
  // The podium wall painted in panels: red and ochre fields framed in black over a dark dado.
  if (lod < 2) {
    const panels = lod === 0 ? 28 : 14;
    for (let k = 0; k < panels; k++) {
      const t0 = (k + 0.08) / panels;
      const t1 = (k + 0.92) / panels;
      const c = k % 2 ? lin(0x9e2a1c, 1.4) : lin(0xd09a3a, 1.3);
      const at = (d, t) => AT(d, t0 + (t1 - t0) * t);
      p.add('fresco', M.fresco, sweep(at, [[-0.012, 0.22], [-0.012, A.podium - 0.1]], 4, { tint: () => c }));
    }
    p.add('fresco', M.fresco, sweep(AT, [[-0.011, 0.02], [-0.011, 0.2]], n, { tint: () => lin(0x221a16, 1.2) }));
  }
  // The outer wall's dressing: buttresses with blind arches between, a cornice.
  const piers = lod === 0 ? 36 : lod === 1 ? 24 : 0;
  for (let k = 0; k < piers; k++) {
    const t = k / piers;
    const [x, z] = AT(OUT + 0.06, t);
    const [x2, z2] = AT(OUT + 1, t);
    const ry = Math.atan2(x2 - x, z2 - z);
    const g = box(0.26, TOP.y + TOP.par - 0.2, 0.14, 0, 0, 0, 0.66);
    g.rotateY(ry);
    g.translate(x, 0, z);
    p.add('tufa', M.tufa, g);
    if (lod === 0) {
      // The blind arch's ring between this buttress and the next: voussoirs of a paler stone.
      const tm = (k + 0.5) / piers;
      const [ax, az] = AT(OUT + 0.02, tm);
      const [bx, bz] = AT(OUT + 1, tm);
      const ar = Math.atan2(bx - ax, bz - az);
      for (let j = 0; j <= 4; j++) {
        const a = Math.PI * (j / 4);
        const v = box(0.1, 0.08, 0.05, Math.cos(a) * 0.32, TOP.y - 0.75 + Math.sin(a) * 0.32, 0, 0.92);
        v.rotateY(ar);
        v.translate(ax, 0, az);
        p.add('trav', M.trav, v);
      }
    }
  }
  p.add('trav', M.trav, sweep(AT, [[OUT, TOP.y - 0.12], [OUT + 0.07, TOP.y - 0.1], [OUT + 0.07, TOP.y - 0.02], [OUT, TOP.y]], n, { tint: () => 0.9 }));
}

/** The arena: its sand raked in rings, the gates in the podium at the ends of the long axis, the outer arches there. */
function arena(lod, p, M) {
  p.add('sand', M.sand, sandFloor(AT, lod ? 32 : 64, 0.02));
  if (lod < 2) p.add('sand', M.sand, rakeLines(AT, [-0.25, -0.55, -0.85, -1.15], 0.024, lod ? 48 : 96));
  for (const t of GATES) {
    const s = t === 0 ? 1 : -1;
    const x = s * (A.arena[0] + 0.004);
    // The gate in the podium: a dark arch (the passage behind), its leaves open while staffed, shut otherwise.
    const mouth = box(0.02, A.podium - 0.06, 0.9, x, 0, 0, 1);
    p.add('dark', M.dark, mouth);
    for (const [st, open] of [['staffed', true], ['shut', false]]) {
      const g = gates(0, 0, 0.88, A.podium - 0.08, 0, open, lod);
      for (const list of [g.wood, g.bronze]) {
        for (const q of list) {
          q.rotateY(s * Math.PI / 2);
          q.translate(x - s * 0.02, 0, 0);
        }
      }
      p.add(`gate-wood-${st}`, M.wood, g.wood, { when: st });
      if (g.bronze.length) p.add(`gate-bronze-${st}`, M.bronze, g.bronze, { when: st });
    }
    // The big arch outside, where the passage comes out at the oval's end.
    const xo = s * (A.arena[0] + OUT + 0.005);
    p.add('dark', M.dark, box(0.02, 1.4, 1.0, xo, 0, 0, 1));
    const arch = new CylinderGeometry(0.5, 0.5, 0.02, lod ? 8 : 16, 1, false, 0, Math.PI);
    arch.rotateZ(Math.PI / 2);
    arch.translate(xo, 1.4, 0);
    p.add('dark', M.dark, tintGeometry(boxUV(arch)));
    if (lod < 2) {
      for (let j = 0; j <= 8; j++) {
        const a = Math.PI * (j / 8);
        p.add('trav', M.trav, box(0.08, 0.12, 0.12, xo + s * 0.03, 1.36 + Math.sin(a) * 0.58, Math.cos(a) * 0.58, 0.95));
      }
    }
  }
}

/** The double stair up the front's outer wall to the walkway: two flights meeting at a landing, on a solid base. */
function stairs(lod, p, M) {
  const { x0, x1, w, rise } = STAIR;
  const H = TOP.y;
  const n = Math.round(H / rise);
  const run = (x1 - x0) / n;
  const z0 = zFront - 0.25;
  for (const s of [-1, 1]) {
    for (let k = 0; k < n; k++) {
      const h = H - k * rise;
      const xa = s * (x0 + k * run);
      // (Each step a block from the ground: the flight's base is solid masonry, as Pompeii's.)
      p.add('tufa', M.tufa, box(run + 0.01, h, w, xa + s * run / 2, 0, z0 + w / 2, k % 2 ? 0.68 : 0.72));
      if (lod < 2) p.add('trav', M.trav, box(run + 0.01, 0.04, w + 0.02, xa + s * run / 2, h - 0.04, z0 + w / 2, 0.96));
    }
    // The flight's parapet along its outer side.
    p.add('tufa', M.tufa, staff([s * x0, H + 0.3, z0 + w + 0.02], [s * x1, 0.3, z0 + w + 0.02], 0.05, 4));
  }
  // The landing at the top, against the walkway.
  p.add('trav', M.trav, box(2 * x0 + 0.02, H, w + 0.3, 0, 0, z0 + w / 2 - 0.15, 0.95));
}

/** The editor's box on the far long side: a platform over the podium, a balustrade, a purple canopy on four posts. */
function editorBox(lod, p, M) {
  const z = -(A.arena[1] + 0.2);
  const y = A.podium + 0.06;
  p.add('marble', M.marble, box(1.6, 0.06, 0.62, 0, y - 0.06, z - 0.12, 0.97));
  p.add('marble', M.marble, box(1.6, 0.34, 0.05, 0, y, z + 0.18, 0.95));
  for (const sx of [-0.75, 0.75]) for (const sz of [0.16, -0.4]) p.add('bronze', M.bronze, staff([sx, y, z + sz], [sx, y + 1.25, z + sz], 0.022, lod ? 4 : 6));
  const canopy = box(1.62, 0.04, 0.68, 0, y + 1.24, z - 0.12, 1);
  p.add('canopy', M.cloth, tinted(canopy, lin(0x6a2248)));
  // Its two chairs (the editor's and his guest's).
  for (const x of [-0.3, 0.3]) {
    p.add('bronze', M.bronze, box(0.44, 0.04, 0.32, x, y + 0.4, z - 0.2, 0.9));
    for (const sx of [-0.18, 0.18]) for (const sz of [-0.12, 0.12]) p.add('bronze', M.bronze, box(0.03, 0.4, 0.03, x + sx, y, z - 0.2 + sz, 0.85));
    if (lod < 2) p.add('cushion', M.cloth, tinted(box(0.42, 0.05, 0.3, x, y + 0.44, z - 0.2), lin(0x9e2a1c)));
  }
}

/** The stage of boards set up at the west end for a play (shown only when the actors are booked: its own kit, models/venues.js). */
export function buildAmphitheatrumStage({ lod = 0 } = {}) {
  const M = venueMaterials();
  const p = new TaggedParts('amphitheatrum-stage');
  const x = -A.arena[0] + 0.85;
  const h = 0.36;
  p.add('wood', M.wood, box(0.9, h, 1.6, x, 0, 0, 0.85));
  for (let k = 0; k < (lod ? 2 : 6); k++) p.add('wood', M.wood, box(0.92, 0.03, 1.6 / (lod ? 2 : 6) - 0.01, x, h, -0.8 + (k + 0.5) * (1.6 / (lod ? 2 : 6)), 0.95 + 0.05 * Math.sin(k * 2.3)));
  // A painted backdrop on two posts behind it (the scaena's doors painted on boards).
  p.add('paintBoard', M.paintBoard, tinted(box(0.05, 1.0, 1.4, x - 0.43, h, 0), lin(0x9e7a4a)));
  if (lod < 2) for (const z of [-0.4, 0.4]) p.add('dark', M.dark, box(0.02, 0.6, 0.26, x - 0.4, h, z, 1));
  return p.build();
}

/** Torches round the top (lit at night while a show runs: the lamps) and lampstands by the gates inside. */
function lights(lod, p, M) {
  for (const t of GATES) {
    const s = t === 0 ? 1 : -1;
    for (const z of [-0.7, 0.7]) {
      const l = lampstand(s * (A.arena[0] - 0.25), z, 0.95, 0.02, lod);
      p.add('bronze', M.bronze, l.bronze);
      p.add('flame', M.flame, l.flames, { when: 'open', cast: false });
    }
  }
}

/** The amphitheatre at a level of detail: { group, meshes, triangles }. */
export function buildAmphitheatrum({ lod = 0 } = {}) {
  const M = venueMaterials();
  const p = new TaggedParts('amphitheatrum');
  cavea(lod, p, M);
  arena(lod, p, M);
  stairs(lod, p, M);
  editorBox(lod, p, M);
  lights(lod, p, M);
  // Masts round the top, and the awning over the upper tier on show days.
  const masts = lod === 2 ? 12 : 20;
  velarium(p, M, AT, { ts: Array.from({ length: masts }, (_, k) => (k + 0.5) / masts), dm: OUT - 0.06, dIn: OUT - 0.75, y0: TOP.y - 0.5, yTop: TOP.y + TOP.par + 0.95, drop: 0.2, lod, closed: true, stripes: 64 });
  // The ground round it: flags at the stair's foot.
  p.add('paving', M.flags, box(7.2, 0.025, 6 - zFront - 0.02, 0, 0, (6 + zFront) / 2, 0.96));
  return p.build();
}

/** Where the crowd sits: [[x, y, z, ry, band, rise], ...] round the oval, clear of the gates and the editor's box. */
export function amphitheatrumSeats() {
  const out = [];
  CAVEA.rows.forEach((r, k) => {
    const skip = (t) => GATES.some((g) => Math.min(Math.abs(t - g), Math.abs(t - g - 1)) < 0.035) || (k === 0 && Math.abs(t - 0.75) < 0.06);
    for (const s of rowSeats(AT, r.d, r.y, 0, 1, skip)) out.push([...s, k < 2 ? 'toga' : k < 3 ? 'plebs' : 'pullati', r.rise]);
  });
  return out;
}

/** The lamps: the lampstands by the gates, and two over the stair's landing (facing the street). */
export const AMPHITHEATRUM_LAMPS = Object.freeze([
  ...[1, -1].flatMap((s) => [-0.7, 0.7].map((z) => Object.freeze([s * (A.arena[0] - 0.25), 1.05, z, 0, -s]))),
  Object.freeze([-0.5, TOP.y + 0.6, zFront, 1]),
  Object.freeze([0.5, TOP.y + 0.6, zFront, 1]),
]);

/** Where things are, for the people (models/venueActors.js). */
export const AMPHITHEATRUM_SPOTS = Object.freeze({
  editor: Object.freeze([[-0.3, A.podium + 0.06, -(A.arena[1] + 0.4)], [0.3, A.podium + 0.06, -(A.arena[1] + 0.4)]]),
  stage: Object.freeze([-A.arena[0] + 0.85, 0.36, 0]),
});
