/**
 * models/circus.js
 * ----------------------------------------------------------------------------
 * The hippodrome of the 3D look: three 5 x 5 sections in a row (15 x 5
 * tiles, 60 by 20 m), each its own building and its own kit, from the record
 * rather than the 2D sprite:
 *
 *   - The Circus Maximus as Trajan rebuilt it (Dionysius of Halicarnassus
 *     III.68, Pliny, the Forma Urbis's fragments, the circus mosaics of
 *     Lyon, Piazza Armerina and Barcelona, the reliefs of Foligno): the long
 *     sand track round the barrier down its middle (the spina, or euripus
 *     for its basins of water), on which stood the obelisk Augustus brought
 *     from Heliopolis, shrines and statues, the seven eggs (ova) and the
 *     seven bronze dolphins taken down or turned one a lap so the crowd
 *     could count them, and at each end the turning posts (metae): three
 *     tall gilded cones on a curved base, the place of the crashes (the
 *     naufragia) every driver feared; the stands down both long sides and
 *     round the curved end (the sphendone), the arch of the triumphs in
 *     its middle; the starting gates (carceres) across the straight end,
 *     twelve stalls with their gates sprung at once by the signal, between
 *     two towers, the magistrate's box over the middle gate where he
 *     dropped the white cloth (mappa) to start the race; the emperor's box
 *     (pulvinar) on the Palatine side among the stands; outside, arcades of
 *     shops under the stands.
 *   - The provinces' circuses (Merida, Lepcis Magna, Tyre, Vienne) for one
 *     a colony might build: the same plan, smaller.
 *
 * So, in 60 m: the sand 12 m wide; the stands on both sides, 3.4 m deep,
 * five rows on two tiers over a podium wall 0.9 m high that kept the cars
 * off the crowd, an arcade of shops outside; the curved end in section 0
 * (the hippodrome's own, sim/entities.js spanLayout) with its triumphal
 * arch; the spina from one meta to the other, its water in two long basins,
 * the obelisk in the middle of section 1 with the eggs on their frame to one
 * side and the dolphins to the other, small shrines; the starting gates
 * and their towers in section 2, the magistrate's box over the middle gate;
 * the governor's box across from the camera's side in section 1, by the
 * finish line chalked on the sand.
 *
 * The sections are cut from one design in track metres (X along the 60 m
 * from the curved end, Z across), so what runs along the track meets at
 * every seam at any view turn (the tests compare the sections' edges).
 *
 * States (models.js partShows tags): 'open' races (the gates open, the
 * awnings over the governor's and the magistrate's boxes, the crowd:
 * models/venues.js), 'out' staffed and idle (the gates shut, attendants
 * raking the sand), 'shut' (nobody). The laps: the eggs and dolphins are
 * kits of their own (circusLaps), set by the race's laps.
 *
 * Metres, each section's middle at its origin, y up, +x along the track
 * toward the starting gates. Levels of detail 0 to 2.
 * ----------------------------------------------------------------------------
 */

import { CylinderGeometry, SphereGeometry, Shape, ExtrudeGeometry, ConeGeometry } from 'three';
import { boxUV, tintGeometry } from '../shapes.js';
import { TaggedParts } from './masonry.js';
import { lin, figureMass } from './domus.js';
import {
  venueMaterials, sweep, ellipseCurves, lineCurves, caveaProfile, box, staff, gates, sandFloor, rakeLines, rowSeats, tinted, lampstand, sheet,
} from './venue.js';
import { RACE } from './venueShow.js';

/** The circus's measures (metres, track coordinates: X 0 to 60 from the curved end, Z across): the tests and the game read them. */
export const CIRCUS = Object.freeze({
  length: 60,
  /** The sand's half width; the stands from there out to the outer face. */
  track: 6,
  /** The curved end's centre (X) and the starting gates' front (X). */
  curveX: 10,
  gatesX: 56.2,
  /** The spina: the metae's X (RACE's posts, models/venueShow.js), its half width, its height. */
  spina: Object.freeze([RACE.U0 * 4, RACE.U1 * 4]),
  spinaW: 0.7,
  spinaH: 0.45,
  /** Where the obelisk, the eggs and the dolphins stand (X). */
  obelisk: 30,
  eggs: 23.8,
  dolphins: 36.2,
  /** The governor's box (X, on the -Z side) and the finish line (X). */
  pulvinar: 31.5,
  finish: 34,
});

const C = CIRCUS;
const CAVEA = caveaProfile({ podium: 0.9, walk: 0.3, tiers: [[3, 0.6, 0.32, 0.18], [2, 0.6, 0.32, 0]] });
const TOP = Object.freeze({ d: CAVEA.top.d, y: CAVEA.top.y, par: 0.3, wall: 0.2 });
const OUT = TOP.d + TOP.wall + 0.23;
/** The stands' profile from the podium out: the steps, the parapet, the outer face. */
const PROF = [...CAVEA.profile, [TOP.d, TOP.y + TOP.par], [OUT, TOP.y + TOP.par], [OUT, 0]];
/** The curved end's curves: half circles about (curveX, 0) from +Z round the end to -Z. */
const END = ellipseCurves(C.track, C.track, Math.PI / 2, Math.PI * 1.5, C.curveX, 0);
/** The triumphal arch's half width (radians of the curved end), and the stands' gap for it. */
const ARCH_A = 0.17;
/** The section's X range. */
const range = (k) => [k * 20, k * 20 + 20];

/** A stand's tint: treads pale, risers in their shade, the outer face warmer. */
function standTint(x, y, z, i) {
  if (i >= CAVEA.profile.length) return [0.86, 0.8, 0.72];
  const tread = i >= 3 && (i - 3) % 2 === 1;
  const k = tread ? 1 : 0.8;
  return [k, k * 0.97, k * 0.92];
}

/** The straight stands of a side (s +1 on +Z, -1 on -Z) from X a to b. */
function straightStand(a, b, s, lod, p, M) {
  if (b - a < 0.01) return;
  const n = Math.max(2, Math.round((b - a) / (lod === 0 ? 1 : 2.5)));
  const at = lineCurves(a, s * C.track, b, s * C.track, 0, s);
  p.add('seats', M.seats, sweep(at, PROF, n, { tint: standTint }));
  p.add('marble', M.marble, sweep(at, [[-0.03, CAVEA.profile[1][1] - 0.02], [-0.03, CAVEA.profile[1][1] + 0.06], [0.18, CAVEA.profile[1][1] + 0.06]], n, { tint: () => 0.95 }));
  p.add('marble', M.marble, sweep(at, [[TOP.d - 0.03, TOP.y + TOP.par], [TOP.d - 0.03, TOP.y + TOP.par + 0.05], [OUT + 0.04, TOP.y + TOP.par + 0.05], [OUT + 0.04, TOP.y + TOP.par]], n, { tint: () => 0.95 }));
  arcade(a, b, s, lod, p, M);
}

/** The arcade of shops under a straight stand's outer face (bays every 2 m of X, so they meet across the seams). */
function arcade(a, b, s, lod, p, M) {
  if (lod === 2) return;
  const z = s * (C.track + OUT);
  for (let X = Math.ceil(a / 2) * 2; X < b - 0.01; X += 2) {
    const xm = X + 1;
    if (xm > b) break;
    // The shop's arched mouth (dark) and its pilasters either side, a string course over the arcade.
    p.add('dark', M.dark, box(1.0, 1.05, 0.02, xm, 0, z + s * 0.004, 1));
    const arch = new CylinderGeometry(0.5, 0.5, 0.02, lod ? 8 : 14, 1, false, -Math.PI / 2, Math.PI);
    arch.rotateX(Math.PI / 2);
    arch.translate(xm, 1.05, z + s * 0.004);
    p.add('dark', M.dark, tintGeometry(boxUV(arch)));
    p.add('trav', M.trav, box(0.24, 1.72, 0.08, X, 0, z + s * 0.03, 0.95));
    if (lod === 0) {
      // An upper window in each bay and the voussoirs round the arch.
      p.add('dark', M.dark, box(0.36, 0.34, 0.02, xm, 2.0, z + s * 0.004, 1));
      for (let j = 0; j <= 6; j++) {
        const t = Math.PI * (j / 6);
        p.add('trav', M.trav, box(0.1, 0.1, 0.05, xm + Math.cos(t) * 0.56, 1.0 + Math.sin(t) * 0.56, z + s * 0.015, 0.97));
      }
    }
  }
  const at = lineCurves(a, z, b, z, 0, s);
  p.add('trav', M.trav, sweep(at, [[0, 1.72], [0.07, 1.74], [0.07, 1.82], [0, 1.84]], 2, { tint: () => 0.95 }));
}

/** The curved end (section 0): the stands round it, the arch of the triumphs in their middle, its outer arcade. */
function curvedEnd(lod, p, M) {
  const n = lod === 0 ? 64 : lod === 1 ? 32 : 16;
  const skip = (t) => Math.abs(t - 0.5) < ARCH_A / Math.PI;
  p.add('seats', M.seats, sweep(END, PROF, n, { tint: standTint, skip }));
  p.add('marble', M.marble, sweep(END, [[-0.03, CAVEA.profile[1][1] - 0.02], [-0.03, CAVEA.profile[1][1] + 0.06], [0.18, CAVEA.profile[1][1] + 0.06]], n, { tint: () => 0.95, skip }));
  p.add('marble', M.marble, sweep(END, [[TOP.d - 0.03, TOP.y + TOP.par], [TOP.d - 0.03, TOP.y + TOP.par + 0.05], [OUT + 0.04, TOP.y + TOP.par + 0.05], [OUT + 0.04, TOP.y + TOP.par]], n, { tint: () => 0.95, skip }));
  // The shops' mouths round the outer face (the curve's own bays).
  if (lod < 2) {
    for (let k = 0; k < 12; k++) {
      const t = (k + 0.5) / 12;
      if (Math.abs(t - 0.5) < 0.1) continue;
      const [x, z] = END(OUT + 0.005, t);
      const [x2, z2] = END(OUT + 1, t);
      const g = box(1.0, 1.05, 0.02, 0, 0, 0, 1);
      g.rotateY(Math.atan2(x2 - x, z2 - z));
      g.translate(x, 0, z);
      p.add('dark', M.dark, g);
    }
  }
  // The triumphal arch through the stands at the end of the axis: piers, the arch, an attic with its dedication's band.
  const x0 = C.curveX - C.track - OUT - 0.1;
  const x1 = C.curveX - C.track + 0.1;
  const hw = 1.25;
  const H = TOP.y + TOP.par + 0.9;
  for (const s of [-1, 1]) {
    // (A metre thick: the stands' gap for the arch ends against them.)
    p.add('trav', M.trav, box(x1 - x0, H, 1.0, (x0 + x1) / 2, 0, s * hw, 0.97));
    // Half columns on the piers' outer face.
    if (lod < 2) p.add('marble', M.marble, tintGeometry(boxUV(new CylinderGeometry(0.1, 0.11, H - 0.9, lod ? 6 : 10).translate(x0 - 0.02, (H - 0.9) / 2, s * (hw - 0.25))), () => 0.97));
  }
  const s = new Shape();
  s.moveTo(-hw, 0);
  s.lineTo(-hw, H - 2.0);
  s.lineTo(hw, H - 2.0);
  s.lineTo(hw, 0);
  s.lineTo(0.75, 0);
  s.absarc(0, 0, 0.75, 0, Math.PI, false);
  s.lineTo(-hw, 0);
  const sp = new ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false, curveSegments: lod ? 6 : 12 });
  sp.rotateY(Math.PI / 2);
  sp.translate(x0, 1.65, 0);
  p.add('trav', M.trav, tintGeometry(boxUV(sp), () => 0.97));
  p.add('dark', M.dark, box(0.02, 2.4, 1.5, x0 - 0.01, 0, 0, 1));
  p.add('dark', M.dark, box(0.02, 2.4, 1.5, x1 + 0.01, 0, 0, 1));
  p.add('marble', M.marble, box(x1 - x0 + 0.1, 0.4, 2 * hw + 0.1, (x0 + x1) / 2, H - 0.4, 0, 0.98));
  p.add('trav', M.trav, box(x1 - x0 + 0.2, 0.1, 2 * hw + 0.2, (x0 + x1) / 2, H - 0.5, 0, 1.03));
  // A gilt quadriga's base on top would be lost from the game's camera; the arch's own torches instead.
}

/** The spina between X a and b: its wall and basins of water, the coping; what stands on it in this stretch. */
function spina(a, b, lod, p, M) {
  const [m0, m1] = C.spina;
  const lo = Math.max(a, m0 + 0.6);
  const hi = Math.min(b, m1 - 0.6);
  const W = C.spinaW;
  const H = C.spinaH;
  if (hi > lo) {
    p.add('marble', M.marble, box(hi - lo, H, 2 * W, (lo + hi) / 2, 0, 0, 0.92));
    p.add('marble', M.marble, box(hi - lo, 0.06, 2 * W + 0.08, (lo + hi) / 2, H, 0, 1.0));
    // The basins: water in a channel down the top (the euripus), broken where the monuments stand.
    if (lod < 2) {
      const gaps = [C.obelisk, C.eggs, C.dolphins].map((x) => [x - 1.4, x + 1.4]);
      let x = lo + 0.25;
      const edges = [...gaps.flat(), hi - 0.25].filter((e) => e > x && e <= hi - 0.25).sort((u, v) => u - v);
      let inGap = gaps.some(([g0, g1]) => x > g0 && x < g1);
      for (const e of edges) {
        if (!inGap && e - x > 0.2) p.add('water', M.water, box(e - x, 0.012, 2 * W - 0.3, (x + e) / 2, H + 0.05, 0, 1), { cast: false });
        x = e;
        inGap = gaps.some(([g0, g1]) => x + 0.01 > g0 && x + 0.01 < g1);
      }
    }
  }
  // The metae: three tall gilt cones on a curved base at each end, the base's face toward the turn.
  for (const [X, dir] of [[m0, -1], [m1, 1]]) {
    if (X < a || X >= b) continue;
    const base = new CylinderGeometry(1.0, 1.0, 0.8, lod ? 8 : 18, 1, false, dir < 0 ? Math.PI : 0, Math.PI);
    base.translate(X, 0.4, 0);
    p.add('marble', M.marble, tintGeometry(boxUV(base), () => 0.94));
    p.add('marble', M.marble, box(0.3, 0.8, 2.0, X + dir * 0.15 - dir * 0.15, 0, 0, 0.94));
    for (const z of [-0.55, 0, 0.55]) {
      const cone = new ConeGeometry(0.2, 2.1, lod ? 6 : 12, 1);
      cone.translate(X + dir * 0.45, 0.8 + 1.05, z);
      p.add('gilt', M.gilt, tintGeometry(boxUV(cone), () => 0.95));
      if (lod < 2) {
        const egg = new SphereGeometry(0.11, lod ? 6 : 10, lod ? 4 : 7);
        egg.translate(X + dir * 0.45, 2.92, z);
        p.add('gilt', M.gilt, tintGeometry(boxUV(egg), () => 1.0));
      }
    }
  }
  // The obelisk: red granite on a pedestal, its pyramidion gilt (Augustus's from Heliopolis).
  if (C.obelisk >= a && C.obelisk < b) {
    const X = C.obelisk;
    p.add('marble', M.marble, box(1.1, 0.9, 1.1, X, H, 0, 0.92));
    p.add('marble', M.marble, box(1.25, 0.12, 1.25, X, H + 0.9, 0, 1));
    const shaft = new CylinderGeometry(0.2, 0.3, 4.2, 4, lod === 0 ? 6 : 1);
    shaft.rotateY(Math.PI / 4);
    shaft.translate(X, H + 1.02 + 2.1, 0);
    p.add('granite', M.marble, tintGeometry(boxUV(shaft), (x, y) => lin(0xb0705c, 0.92 + 0.04 * Math.sin(y * 9))));
    const tip = new ConeGeometry(0.2, 0.35, 4, 1);
    tip.rotateY(Math.PI / 4);
    tip.translate(X, H + 1.02 + 4.2 + 0.17, 0);
    p.add('gilt', M.gilt, tintGeometry(boxUV(tip), () => 1.0));
    if (lod === 0) {
      // Bands of carved signs down each face, a shade darker.
      for (let f = 0; f < 4; f++) {
        for (let k = 0; k < 9; k++) {
          const y = H + 1.3 + k * 0.42;
          const w = 0.26 - (k / 9) * 0.1;
          const g = box(w * 0.5, 0.06, 0.01, 0, y, 0, 1);
          g.translate(0, 0, 0.25 - (k / 9) * 0.09);
          g.rotateY((f * Math.PI) / 2);
          g.translate(X, 0, 0);
          p.add('granite', M.marble, tinted(g, lin(0x6a3a30)));
        }
      }
    }
  }
  // The frames of the eggs and of the dolphins: four columns, an architrave (what they hold is circusLaps's).
  for (const X of [C.eggs, C.dolphins]) {
    if (X < a || X >= b) continue;
    for (const dx of [-1.1, 1.1]) for (const z of [-0.35, 0.35]) {
      p.add('marble', M.marble, tintGeometry(boxUV(new CylinderGeometry(0.06, 0.07, 1.35, lod ? 5 : 10).translate(X + dx, H + 0.675, z)), () => 0.97));
    }
    p.add('marble', M.marble, box(2.5, 0.14, 0.9, X, H + 1.35, 0, 0.98));
  }
  // Shrines on the spina: a little aedicula and a statue on a column at each side of the obelisk.
  for (const [X, kind] of [[C.obelisk - 3.4, 'statue'], [C.obelisk + 3.4, 'statue'], [17.5, 'shrine'], [42.5, 'shrine']]) {
    if (X < a || X >= b || lod === 2) continue;
    if (kind === 'statue') {
      p.add('marble', M.marble, tintGeometry(boxUV(new CylinderGeometry(0.12, 0.13, 1.4, lod ? 6 : 12).translate(X, H + 0.7, 0)), () => 0.96));
      p.add('gilt', M.gilt, figureMass(X, H + 1.42, 0, 0.5, lod + 1));
    } else {
      for (const dx of [-0.35, 0.35]) for (const z of [-0.3, 0.3]) p.add('marble', M.marble, tintGeometry(boxUV(new CylinderGeometry(0.045, 0.05, 1.0, 6).translate(X + dx, H + 0.5, z)), () => 0.97));
      p.add('marble', M.marble, box(0.9, 0.1, 0.8, X, H + 1.0, 0, 0.98));
      const roof = new ConeGeometry(0.62, 0.3, 4, 1);
      roof.rotateY(Math.PI / 4);
      roof.scale(1, 1, 0.9);
      roof.translate(X, H + 1.25, 0);
      p.add('tile', M.tile, tintGeometry(boxUV(roof), () => 0.95));
      p.add('marble', M.marble, figureMass(X, H, 0, 0.42, lod + 1));
    }
  }
}

/** The sand of a section's stretch (the curved end's half disc in section 0), raked along the track. */
function sand(k, lod, p, M) {
  const [a, b] = range(k);
  const x0 = k === 0 ? C.curveX : a;
  const x1 = k === 2 ? C.gatesX : b;
  p.add('sand', M.sand, box(x1 - x0, 0.02, 2 * C.track, (x0 + x1) / 2, 0, 0, 1));
  if (k === 0) p.add('sand', M.sand, sandFloor(END, lod ? 24 : 48, 0.02, C.curveX, 0));
  if (lod < 2) {
    // The wheels' ruts round the spina: lanes of darker sand (straight here, round the turn at the ends).
    for (const r of RACE.lanes) {
      const z = r * 4;
      for (const s of [-1, 1]) p.add('sand', M.sand, tinted(box(x1 - x0, 0.004, 0.18, (x0 + x1) / 2, 0.02, s * (z + 0.25)), [0.86, 0.84, 0.8]));
    }
  }
  // The finish line, chalked across the track to the governor's box.
  if (C.finish >= x0 && C.finish < x1) for (const s of [-1, 1]) p.add('marble', M.marble, box(0.12, 0.006, C.track - C.spinaW, C.finish, 0.02, s * (C.spinaW + (C.track - C.spinaW) / 2), 1.1));
}

/** The starting gates (section 2): eight stalls and the procession's gate between two towers, the magistrate's box over it. */
function carceres(lod, p, M) {
  const X = C.gatesX;
  const D = 2.4;
  const H = 2.6;
  const zs = [];
  // Stalls: four either side of the middle gate, each 1.25 m.
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) zs.push(s * (1.0 + 0.625 + k * 1.25));
  // The building: its back and roof, its front's piers between the stalls.
  p.add('stucco', M.stucco, box(D - 0.5, H, 2 * C.track, X + 0.25 + (D - 0.5) / 2, 0, 0, 0.9));
  p.add('tile', M.tile, box(D + 0.2, 0.12, 2 * C.track + 0.2, X + D / 2, H, 0, 0.95));
  for (const z of [...zs.map((q) => q - 0.625 * Math.sign(q)), 1.0, -1.0, 6, -6]) p.add('trav', M.trav, box(0.35, H - 0.2, 0.22, X + 0.1, 0, z, 0.95));
  p.add('trav', M.trav, box(0.4, 0.25, 2 * C.track, X + 0.1, H - 0.25, 0, 1));
  for (const z of zs) {
    // Each stall's opening (dark) and its gate, swung open for a race, shut otherwise.
    p.add('dark', M.dark, box(0.02, 1.7, 1.0, X - 0.08, 0, z, 1));
    for (const [st, open] of [['open', true], ['home', false]]) {
      if (st === 'home') {
        for (const w of ['out', 'shut']) {
          const g = gates(0, 0, 0.98, 1.6, 0, false, lod);
          for (const q of g.wood) { q.rotateY(-Math.PI / 2); q.translate(X - 0.1, 0, z); }
          p.add(`gate-${w}`, M.paintBoard, g.wood.map((q) => tinted(q, lin(0x9e3a2a))), { when: w });
        }
      } else {
        const g = gates(0, 0, 0.98, 1.6, 0, open, lod);
        for (const q of g.wood) { q.rotateY(-Math.PI / 2); q.translate(X - 0.1, 0, z); }
        p.add('gate-open', M.paintBoard, g.wood.map((q) => tinted(q, lin(0x9e3a2a))), { when: 'open' });
      }
    }
    // A herm on each pier (the stalls' pillars were herms).
    if (lod === 0) p.add('marble', M.marble, figureMass(X - 0.05, H - 0.95, z - 0.62 * Math.sign(z), 0.3, 1));
  }
  // The procession's gate in the middle (dark, arched), and the magistrate's box over it with its awning.
  p.add('dark', M.dark, box(0.02, 2.0, 1.6, X - 0.08, 0, 0, 1));
  p.add('marble', M.marble, box(0.9, 0.1, 2.2, X - 0.2, H, 0, 0.98));
  p.add('marble', M.marble, box(0.06, 0.4, 2.2, X - 0.62, H + 0.1, 0, 0.97));
  for (const z of [-1.0, 1.0]) for (const dx of [-0.6, 0.2]) p.add('bronze', M.bronze, staff([X + dx, H + 0.1, z], [X + dx, H + 1.25, z], 0.022, lod ? 4 : 6));
  p.add('canopy', M.cloth, tinted(box(1.0, 0.04, 2.2, X - 0.2, H + 1.25, 0), lin(0x6a2248)), { when: 'open' });
  // The towers (oppida) at both ends over the stands' ends, crenellated.
  for (const s of [-1, 1]) {
    const z0 = s * C.track;
    const z1 = s * (C.track + OUT);
    p.add('trav', M.trav, box(3.4, 4.0, Math.abs(z1 - z0), X + 0.3, 0, (z0 + z1) / 2, 0.93));
    if (lod < 2) {
      for (let k = 0; k < 5; k++) p.add('trav', M.trav, box(0.38, 0.3, 0.3, X - 1.25 + k * 0.78, 4.0, z0 + s * 0.15, 0.96));
      for (const y of [1.5, 2.8]) p.add('dark', M.dark, box(0.02, 0.5, 0.3, X - 1.42, y, (z0 + z1) / 2, 1));
    }
  }
}

/** The governor's box (pulvinar) on the -Z stands: a shrine-like box over the podium, columns, a pediment, chairs. */
function pulvinar(lod, p, M) {
  const X = C.pulvinar;
  const z = -(C.track + 0.4);
  const y = 0.96;
  p.add('marble', M.marble, box(2.6, 0.1, 1.5, X, y - 0.1, z - 0.3, 0.97));
  p.add('marble', M.marble, box(2.6, 0.34, 0.06, X, y, z + 0.42, 0.95));
  for (const dx of [-1.2, -0.4, 0.4, 1.2]) p.add('marble', M.marble, tintGeometry(boxUV(new CylinderGeometry(0.06, 0.07, 1.4, lod ? 5 : 10).translate(X + dx, y + 0.7, z + 0.36)), () => 0.97));
  p.add('marble', M.marble, box(2.7, 0.14, 1.6, X, y + 1.4, z - 0.3, 0.98));
  const ped = new CylinderGeometry(0.0001, 1.0, 0.36, 4, 1);
  ped.rotateY(Math.PI / 4);
  ped.scale(1.4, 1, 0.75);
  ped.translate(X, y + 1.54 + 0.18, z - 0.3);
  p.add('tile', M.tile, tintGeometry(boxUV(ped), () => 0.95));
  if (lod < 2) p.add('gilt', M.gilt, box(0.7, 0.18, 0.04, X, y + 1.42, z + 0.52, 1));
  for (const dx of [-0.6, 0, 0.6]) {
    p.add('bronze', M.bronze, box(0.46, 0.04, 0.34, X + dx, y + 0.4, z - 0.25, 0.9));
    for (const sx of [-0.19, 0.19]) for (const sz of [-0.13, 0.13]) p.add('bronze', M.bronze, box(0.03, 0.4, 0.03, X + dx + sx, y, z - 0.25 + sz, 0.85));
    if (lod < 2) p.add('cushion', M.cloth, tinted(box(0.44, 0.05, 0.32, X + dx, y + 0.44, z - 0.25), lin(0x6a2248)));
  }
}

/** Lampstands along the podium at the turns and by the gates (lit at night while races run). */
function lights(k, lod, p, M) {
  for (const [X, z] of CIRCUS_LAMP_SPOTS) {
    if (X < k * 20 || X >= k * 20 + 20) continue;
    const l = lampstand(X, z, 1.0, 0.02, lod);
    p.add('bronze', M.bronze, l.bronze);
    p.add('flame', M.flame, l.flames, { when: 'open', cast: false });
  }
}

/** The lampstands' places (track metres): by the podium at the turns and at the gates. */
const CIRCUS_LAMP_SPOTS = Object.freeze([[12, 5.6], [12, -5.6], [30, 5.6], [48, 5.6], [48, -5.6], [55.5, 5.4], [55.5, -5.4]]);

/** Section `k` (0 the curved end, 1 the middle, 2 the starting gates) at a level of detail, in its own metres: { group, meshes, triangles }. */
export function buildCircus(k, { lod = 0 } = {}) {
  const M = venueMaterials();
  const p = new TaggedParts(`circus-${k}`);
  const [a, b] = range(k);
  const sa = k === 0 ? C.curveX : a;
  const sb = k === 2 ? C.gatesX - 0.5 : b;
  for (const s of [-1, 1]) straightStand(sa, sb, s, lod, p, M);
  if (k === 0) curvedEnd(lod, p, M);
  if (k === 2) carceres(lod, p, M);
  if (k === 1) pulvinar(lod, p, M);
  sand(k, lod, p, M);
  spina(a, b, lod, p, M);
  lights(k, lod, p, M);
  const g = p.build();
  // From track metres to the section's own (its middle at the origin).
  for (const m of g.meshes) m.geometry.translate(-(a + 10), 0, 0);
  return g;
}

/** The eggs or the dolphins on their frame (a kit, one a frame's place: circusLaps places seven). */
export function buildLapCounter(kind, { lod = 0 } = {}) {
  const M = venueMaterials();
  const p = new TaggedParts(`circus-${kind}`);
  if (kind === 'egg') {
    const g = new SphereGeometry(0.11, lod ? 6 : 12, lod ? 5 : 9);
    g.scale(1, 1.45, 1);
    g.translate(0, 0.16, 0);
    p.add('marble', M.marble, tintGeometry(boxUV(g), () => 0.98));
  } else {
    // A bronze dolphin, head down along +x, its tail up: a bent body, a fin, the tail's flukes.
    const pts = [[-0.22, 0.3, 0], [-0.12, 0.2, 0], [0, 0.14, 0], [0.12, 0.16, 0], [0.2, 0.24, 0]];
    for (let i = 0; i + 1 < pts.length; i++) p.add('bronze', M.bronze, staff(pts[i], pts[i + 1], 0.06 - i * 0.008, lod ? 5 : 8));
    if (lod < 2) {
      p.add('bronze', M.bronze, box(0.04, 0.08, 0.16, -0.24, 0.3, 0, 1));
      p.add('bronze', M.bronze, box(0.06, 0.07, 0.02, 0.0, 0.2, 0, 1));
    }
  }
  return p.build();
}

/** Where the seven eggs and the seven dolphins stand on their frames (section 1's metres), and how a counted lap shows. */
export const LAP_PLACES = Object.freeze({
  eggs: Object.freeze(Array.from({ length: 7 }, (_, i) => Object.freeze([C.eggs - 30 - 0.96 + i * 0.32, C.spinaH + 1.49, 0]))),
  dolphins: Object.freeze(Array.from({ length: 7 }, (_, i) => Object.freeze([C.dolphins - 30 - 0.96 + i * 0.32, C.spinaH + 1.49, 0]))),
});

/**
 * Where the crowd sits in section k: [[x, y, z, ry, band, rise], ...] in the
 * section's own metres: both straight stands, the curved end's in section
 * 0, clear of the arch, the governor's box and the towers.
 */
export function circusSeats(k) {
  const out = [];
  const [a, b] = range(k);
  const sa = k === 0 ? C.curveX : a;
  const sb = k === 2 ? C.gatesX - 0.6 : b;
  CAVEA.rows.forEach((r, i) => {
    const band = i < 2 ? 'toga' : i < 4 ? 'plebs' : 'pullati';
    for (const s of [-1, 1]) {
      const at = lineCurves(sa, s * C.track, sb, s * C.track, 0, s);
      const skip = (t) => {
        const X = sa + (sb - sa) * t;
        return s < 0 && i < 4 && Math.abs(X - C.pulvinar) < 1.7;
      };
      for (const q of rowSeats(at, r.d, r.y, 0, 1, skip)) out.push([q[0] - (a + 10), q[1], q[2], q[3], band, r.rise]);
    }
    if (k === 0) for (const q of rowSeats(END, r.d, r.y, 0, 1, (t) => Math.abs(t - 0.5) < ARCH_A / Math.PI + 0.03)) out.push([q[0] - 10, q[1], q[2], q[3], band, r.rise]);
  });
  return out;
}

/** The lamps (models.js modelLamps) of section k: its lampstands (facing the track's middle). */
export function circusLamps(k) {
  return Object.freeze(CIRCUS_LAMP_SPOTS.filter(([X]) => X >= k * 20 && X < k * 20 + 20).map(([X, z]) => Object.freeze([X - (k * 20 + 10), 1.1, z, -Math.sign(z)])));
}

/** Where things are for the people (track metres): the governor's chairs, the magistrate's box, the lap counters. */
export const CIRCUS_SPOTS = Object.freeze({
  governor: Object.freeze([-0.6, 0, 0.6].map((dx) => Object.freeze([C.pulvinar + dx, 0.96, -(C.track + 0.4) - 0.25, 0]))),
  magistrate: Object.freeze([C.gatesX - 0.2, 2.7, 0, -Math.PI / 2]),
  counters: Object.freeze([[C.eggs, C.spinaH, 0.75], [C.dolphins, C.spinaH, -0.75]]),
});

export { sheet };
